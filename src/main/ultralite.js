// ============================================================================
// F9 · Ultra für schwache PCs („Ultra · Leicht"): the pure rules the renderer, the world and the game share — no GL, no
// DOM, node-tested (test/ultralite_*.js). Plan: docs/superpowers/plans/2026-10-08-f-ultralite.md
//   UL.Shadow   Schatten-Takt: the shadow map kept up to date in tiles (toroidal addressing, cadence by ring, the sun
//               step built over a few frames in a second buffer)
// ============================================================================
(function (VR) {
  'use strict';
  const UL = VR.UL = VR.UL || {};

  // ---------------------------------------------------------------- Schatten-Takt
  // The map is the same as without the takt (the same size, reach R, texel lattice and filtering). Only its addressing
  // and its updates differ:
  //  · texel = light-space position mod 2R (the shaders add u_shadowOff = frac((Wc − R) / 2R) to their window coordinate
  //    and sample with REPEAT): the window [Wc − R, Wc + R] moves by whole tiles and only the tiles entering it are drawn
  //  · depth is measured from a fixed light-space origin P0 (a full redraw re-bases it, when the eye is REBASE blocks away)
  //  · a changed section marks the tiles under its light-space box; dirty tiles are redrawn by ring: the 3 × 3 around the
  //    eye the same frame, ring 1 every 2nd frame, ring 2 every 4th (slow × 2 when the governor asks)
  //  · a sun step (the renderer's 0.0044 rad quantum, ≈ 0.25°) builds the next map in a second buffer, a slice of the
  //    casters a frame (depth is order-independent), then the buffers swap
  const SH = UL.Shadow = {};
  SH.N = 16;          // tiles a side (12 blocks on shadows 3)
  SH.HYST = 0.75;     // the window moves when the eye is this many tiles off its centre
  SH.REBASE = 64;     // blocks from the depth origin (horizontal + ½ vertical) before a full redraw
  SH.SLICES = 6;      // a sun step is drawn over this many frames
  SH.Q = 0.0044;      // the sun's angle step (radians), as renderShadows
  SH.DEPTH = 260;     // the depth range ± around the origin, as renderShadows
  SH.MAX_TILES = 40;  // dirty tiles redrawn in one frame at most (the rest wait, nearest first)
  SH.tile = (R, N) => 2 * R / (N || SH.N);
  // the window centre on one axis (a multiple of the tile T): kept while the eye stays within HYST tiles of it
  SH.center = function (prev, l, T) {
    if (prev !== null && prev !== undefined && Math.abs(l - prev) <= SH.HYST * T) return prev;
    return Math.round(l / T) * T;
  };
  SH.offset = function (wc, R) { const v = (wc - R) / (2 * R); return v - Math.floor(v); };
  SH.slot = (i, N) => (((i % N) + N) % N);
  // the window's tile range around a centre wc (absolute tile indices, inclusive)
  SH.windowTiles = function (wc, T, N) { const k = Math.round(wc / T), n = N || SH.N; return [k - n / 2, k + n / 2 - 1]; };
  SH.ring = function (ti, tj, ci, cj) { const d = Math.max(Math.abs(ti - ci), Math.abs(tj - cj)); return d <= 1 ? 0 : d <= 3 ? 1 : 2; };
  SH.due = function (ring, frame, slow) { const k = slow > 1 ? slow : 1; return ring === 0 ? true : ring === 1 ? frame % (2 * k) === 0 : frame % (4 * k) === 0; };
  // the tiles that enter the window when its centre tile moves kOld → kNew on one axis: [first, last], null or 'all'
  SH.entering = function (kOld, kNew, N) {
    const n = N || SH.N, d = kNew - kOld;
    if (!d) return null;
    if (Math.abs(d) >= n) return 'all';
    return d > 0 ? [kOld + n / 2, kNew + n / 2 - 1] : [kNew - n / 2, kOld - n / 2 - 1];
  };
  // a tile range split where the texels wrap (each run is contiguous in the texture)
  SH.runs = function (i0, i1, N) {
    const n = N || SH.N, out = [];
    let a = i0;
    while (a <= i1) { const b = Math.min(i1, (Math.floor(a / n) + 1) * n - 1); out.push([a, b]); a = b + 1; }
    return out;
  };
  // the light's view (rotation only), as renderShadows builds it
  SH.lightView = function (out, L) {
    const up = Math.abs(L[1]) > 0.99;
    return VR.mat4.lookAt(out, 0, 0, 0, -L[0], -L[1], -L[2], up ? 1 : 0, up ? 0 : 1, 0);
  };
  SH.toLight = (lv, X) => [lv[0] * X[0] + lv[4] * X[1] + lv[8] * X[2], lv[1] * X[0] + lv[5] * X[1] + lv[9] * X[2], lv[2] * X[0] + lv[6] * X[1] + lv[10] * X[2]];
  SH.apply = function (m, v) {
    const x = m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], y = m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13];
    const z = m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14], w = m[3] * v[0] + m[7] * v[1] + m[11] * v[2] + m[15];
    return [x / w, y / w, z / w];
  };
  // ortho(x0, x1, y0, y1, ±depth) × translate(lv · d − (wx, wy, 0)) × lv: camera-relative positions → clip
  function compose(out, lv, d, wx, wy, x0, x1, y0, y1, depth) {
    const M4 = VR.mat4, t = M4.create(), o = M4.create(), m = M4.create();
    const l = SH.toLight(lv, d);
    t[12] = l[0] - wx; t[13] = l[1] - wy; t[14] = l[2];
    M4.ortho(o, x0, x1, y0, y1, -depth, depth);
    M4.mul(m, t, lv);
    return M4.mul(out, o, m);
  }
  // the lookup: d = eye − P0, wcRel = window centre − P0 in light space; the window maps to clip [−1, 1]
  SH.lookupMatrix = (out, lv, d, wcRel, R, depth) => compose(out, lv, d, wcRel[0], wcRel[1], -R, R, -R, R, depth || SH.DEPTH);
  // drawing a light-space rectangle [x0, x1] × [y0, y1] (relative to P0) into its viewport
  SH.tileMatrix = (out, lv, d, x0, x1, y0, y1, depth) => compose(out, lv, d, 0, 0, x0, x1, y0, y1, depth || SH.DEPTH);
  // a world box's light-space extent [x0, x1, y0, y1] (centre ± |lv| · half size)
  SH.lightBox = function (lv, x0, y0, z0, x1, y1, z1, out) {
    const cx = (x0 + x1) * 0.5, cy = (y0 + y1) * 0.5, cz = (z0 + z1) * 0.5, hx = (x1 - x0) * 0.5, hy = (y1 - y0) * 0.5, hz = (z1 - z0) * 0.5;
    const lx = lv[0] * cx + lv[4] * cy + lv[8] * cz, ly = lv[1] * cx + lv[5] * cy + lv[9] * cz;
    const ex = Math.abs(lv[0]) * hx + Math.abs(lv[4]) * hy + Math.abs(lv[8]) * hz, ey = Math.abs(lv[1]) * hx + Math.abs(lv[5]) * hy + Math.abs(lv[9]) * hz;
    out[0] = lx - ex; out[1] = lx + ex; out[2] = ly - ey; out[3] = ly + ey;
    return out;
  };
  SH.tilesOf = function (lb, T, out) { out[0] = Math.floor(lb[0] / T); out[1] = Math.floor(lb[1] / T); out[2] = Math.floor(lb[2] / T); out[3] = Math.floor(lb[3] / T); return out; };
  // the stepped sun (renderShadows' quantization): its key and its direction
  SH.sunKey = function (L) {
    const q = SH.Q, qe = Math.round(Math.asin(Math.max(-1, Math.min(1, L[1]))) / q) * q, qz = Math.round(Math.atan2(L[2], L[0]) / q) * q;
    return { key: (qe * 1000 + qz).toFixed(4), L: [Math.cos(qz) * Math.cos(qe), Math.sin(qe), Math.sin(qz) * Math.cos(qe)] };
  };
  SH.slice = (n, K, k) => [Math.floor(k * n / K), Math.floor((k + 1) * n / K)];

  // ---------------------------------------------------------------- Weltgenerierung im Takt (world.js streamTakt)
  // The main thread's share of the streaming — a generated column's arrival (counts, heights, seam light), the uploads,
  // the mesh-job starts — follows the frame's headroom instead of arriving whenever a worker answers. CPU and GPU work
  // side by side: a frame takes max(gpu, js), so the main thread may use up to max(budget, gpu) − js without making the
  // frame longer. (Subtracting the GPU's time as if the two ran one after the other would starve the streaming exactly on
  // a GPU-bound machine — an integrated GPU — and the world would load slower: the "hang" the owner felt.)
  const ST = UL.Stream = {};
  ST.TARGET = 55;                  // the frame rate the governor aims at
  ST.MIN = 0.75;                   // ms a frame at least (the world never stops streaming)
  ST.MAX = 4;                      // ms a frame at most
  ST.SHARE = 0.6;                  // the share of the headroom the streaming takes
  ST.BYTES = 2 * 1024 * 1024;      // upload bytes a frame at most (beside F8's ms budget)
  ST.budget = function (gpuMs, jsMs, target) {
    const b = 1000 / (target || ST.TARGET);
    const top = gpuMs > 0 ? Math.max(b, gpuMs) : b;
    const head = top - (jsMs > 0 ? jsMs : 0);
    return Math.max(ST.MIN, Math.min(ST.MAX, head * ST.SHARE));
  };
  ST.jobs = (ms) => Math.max(2, Math.round(ms * 4));   // mesh-job starts a frame (each copies a padded section)
  // a queued generation the player has moved away from: beyond the load radius around the loading centre (dxL, dzL), or —
  // while moving — behind the player (dxP, dzP) near the edge of the view; (ux, uz) the direction of travel
  ST.away = function (dxL, dzL, dxP, dzP, rd, ux, uz, moving) {
    if (dxL * dxL + dzL * dzL > (rd + 1.5) * (rd + 1.5)) return true;
    if (!moving) return false;
    const d = Math.hypot(dxP, dzP);
    return d > rd - 1 && (dxP * ux + dzP * uz) < -0.25 * d;
  };
  // a generation's place in the queue (world.update's own order: the distance, discounted for columns ahead)
  ST.genPrio = function (ex, ez, ux, uz, ahead) { const along = ahead ? Math.max(0, ex * ux + ez * uz) : 0; return ex * ex + ez * ez - along * along * 0.5; };

  // ---------------------------------------------------------------- Fern-Cache (renderer.js farFrame, q.farCache)
  // The sky, the sections beyond half the render distance, ring 1 and the horizon tiles are drawn into a cache (colour and
  // depth, a little wider than the screen) and composited every frame — reprojected with the cached depth, so turning is
  // exact and a short walk is followed — while the near world is drawn live over it. A new cache is begun when the eye
  // moved 1.5 m or turned 4° from the cached one, after 500 ms, or when the day moved on two game minutes; it is drawn
  // into a second buffer a vertical strip a frame (SLICES strips: the sky, the far sections and the horizon in each), then
  // the two swap — no frame pays for the whole far world. A cache is shown while the eye is within 6 m and 7.5° (its
  // overscan) of it; else the frame draws live. Faster than FAST m/s (a flight) or turning faster than TURN_FAST the
  // frames draw live and no cache is drawn (it would be off before it is done).
  const FC = UL.Far = {};
  FC.MOVE = 1.5;                         // m
  FC.TURN = 4 * Math.PI / 180;           // rad (3.5° of the overscan left while the next one is drawn)
  FC.AGE = 500;                          // ms
  FC.SUN = 2 * 2 * Math.PI / 1440;       // rad: the sun's way in two game minutes (0.5°; the Zeitraffer goes faster)
  FC.SLICES = 4;                         // frames a new cache takes (a vertical strip of it a frame)
  FC.FAST = 10;                          // m/s: faster, everything is drawn live
  FC.TURN_FAST = 90 * Math.PI / 180;     // rad/s: turning faster, everything is drawn live
  FC.MARGIN = 7.5 * Math.PI / 180;       // the cache's overscan beyond each edge of the screen
  FC.TOO_OLD_MOVE = 6; FC.TOO_OLD_TURN = FC.MARGIN;   // a cache further off than this is not shown (the frame draws live)
  // why a cache (c: its eye x y z, forward fx fy fz, fov, aspect, time t ms, sun direction, size w h) is stale for this
  // camera, or '' when it is still good
  // (slow: the governor's cheap rung — 2 doubles the step, the age and the sun's way; the turn stays, the overscan is for it)
  FC.stale = function (c, cam, now, sun, w, h, slow) {
    const k = slow > 1 ? slow : 1;
    if (!c || !c.ok) return 'none';
    if (c.w !== w || c.h !== h || Math.abs(c.fov - cam.fov) > 1e-6 || Math.abs(c.aspect - cam.aspect) > 1e-6) return 'size';
    if (Math.hypot(cam.x - c.x, cam.y - c.y, cam.z - c.z) > FC.MOVE * k) return 'move';
    if (FC.turn(c, cam) > FC.TURN) return 'turn';
    if (now - c.t > FC.AGE * k) return 'age';
    if (sun && c.sun && Math.acos(Math.max(-1, Math.min(1, sun[0] * c.sun[0] + sun[1] * c.sun[1] + sun[2] * c.sun[2]))) > FC.SUN * k) return 'tod';
    return '';
  };
  FC.turn = function (c, cam) { const d = c.fx * cam.fx + c.fy * cam.fy + c.fz * cam.fz; return Math.acos(Math.max(-1, Math.min(1, d))); };
  // can the cache be shown at all: not too far off (else the frame draws everything live)
  FC.within = function (c, cam) { return !!c && Math.hypot(cam.x - c.x, cam.y - c.y, cam.z - c.z) <= FC.TOO_OLD_MOVE && FC.turn(c, cam) <= FC.TOO_OLD_TURN; };
  FC.showable = function (c, cam) { return !!(c && c.ok) && FC.within(c, cam); };
  // the near radius in blocks (sections nearer than this to the cache's eye are drawn live)
  FC.near = (rd) => Math.max(48, rd * 8);
  // the cache's projection: every direction within MARGIN of the screen's view lies in it (the screen's corners and edge
  // middles turned by MARGIN every way, the widest kept), with the same pixels per unit of view as the screen
  // → { sx, sy } (its size: w × sx, h × sy), fov (vertical, rad), aspect
  FC.overscan = function (fov, aspect) {
    const tv = Math.tan(fov / 2), th = tv * aspect, c = Math.cos(FC.MARGIN), s = Math.sin(FC.MARGIN), cap = Math.tan(89 * Math.PI / 180);
    let mx = th, my = tv;
    const edge = []; for (let i = 0; i <= 8; i++) { edge.push([1, i / 8]); edge.push([i / 8, 1]); }   // (the screen's edges, by symmetry one quarter)
    for (const [px, py] of edge) {
      const l = Math.hypot(px * th, py * tv, 1), d = [px * th / l, py * tv / l, -1 / l];
      // two directions across d, then MARGIN round it in 24 steps
      const e1 = Math.abs(d[1]) < 0.9 ? [d[2], 0, -d[0]] : [0, -d[2], d[1]], l1 = Math.hypot(e1[0], e1[1], e1[2]);
      e1[0] /= l1; e1[1] /= l1; e1[2] /= l1;
      const e2 = [d[1] * e1[2] - d[2] * e1[1], d[2] * e1[0] - d[0] * e1[2], d[0] * e1[1] - d[1] * e1[0]];
      for (let k = 0; k < 24; k++) {
        const a = k / 24 * 2 * Math.PI, ca = Math.cos(a), sa = Math.sin(a);
        const q = [d[0] * c + (e1[0] * ca + e2[0] * sa) * s, d[1] * c + (e1[1] * ca + e2[1] * sa) * s, d[2] * c + (e1[2] * ca + e2[2] * sa) * s];
        if (q[2] > -1e-3) { mx = my = cap; continue; }
        mx = Math.max(mx, Math.min(cap, Math.abs(q[0] / q[2]))); my = Math.max(my, Math.min(cap, Math.abs(q[1] / q[2])));
      }
    }
    mx = Math.min(cap, mx * 1.004); my = Math.min(cap, my * 1.004);   // (a hair more: the edges between the samples)
    return { sx: mx / th, sy: my / tv, fov: 2 * Math.atan(my), aspect: mx / my };
  };
  // the cache's size and view for a screen of w × h pixels whose projection has this fov and aspect: the screen's pixel
  // grid extended by whole pixels on every side (mx, my), at least the overscan — so an eye where the cache was drawn reads
  // every screen pixel's own texel at its centre (the composite copies the far world as it was drawn, not resampled)
  FC.grid = function (fov, aspect, w, h) {
    const os = FC.overscan(fov, aspect);
    const mx = Math.ceil(w * (os.sx - 1) / 2), my = Math.ceil(h * (os.sy - 1) / 2);
    const tw = w + 2 * mx, th = h + 2 * my, sx = tw / w, sy = th / h;
    return { tw, th, mx, my, sx, sy, fov: 2 * Math.atan(Math.tan(fov / 2) * sy), aspect: aspect * sx / sy };
  };
  // strip k of K of a cache w pixels wide: its pixel columns [x0, x1)
  FC.strip = (k, K, w) => [Math.floor(k * w / K), Math.floor((k + 1) * w / K)];
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

// ============================================================================
// f-ux · information lives in the world, not in boxes (plan docs/superpowers/plans/2026-11-02-f-ux.md). The owner: a
// cooler UI, a calm screen. Each part behind a switch (⚙ Spiel · „Anzeige in der Welt"), each with a calm default:
//   · goalTrail — the tracked goal (VR.Quests.target(), or D.setGoal) as glowing footprints and small lanterns on the
//     ground, 2–16 m ahead; a wooden Wegweiser at the trail's end with the goal's name and distance; Funke leans toward
//     the goal and trails sparks that way (a compass). The shared particle pool: none at all on Very Low (particles 0).
//   · mapRose — a small compass rose instead of the minimap and its text lines (N, the goal ✦, the nearest waypoint ◆)
//   · bookStyle — the Wanderbuch as a book: paper pages, a page-turn, a drawn map page, a sticker board you stick on
//     (meta.wander.board: [[name, x %, y %, turn °], …], 40 at most)
//   · satchel — the inventory opens out of a satchel (a flap and a rise, 0.32 s; none with Weniger Bewegung)
//   · vitals — 'world': low health / hunger / air as a soft edge and a quiet breath (our own synth), hurt / heal as
//     gentle colour pulses (through VR.A11y.flash, the limiter); the bars only in danger · 'both' · 'bars' (as before)
//   · radial — hold Tab (the mouse or the wheel picks) or the pad's D-pad up (the right stick picks); release picks
//   · the star map's labels in reach: the nearest 24 (D.capNear, starmap.js; creative had 1518 "in reach")
// Pure (node, test/diegetic.js): trail · sign · vitals · pick · wheelStep · capNear · RADIAL · KEYS
// Cost 🟢: per frame one early return when nothing shows; the DOM at 4 Hz on change; the trail ≤ 14 particles every
// 0.5 s from the shared pool (Very Low: none); the signpost one style write a frame while it shows. D.cost: ms / frame.
// ============================================================================
(function (VR) {
  'use strict';
  const D = VR.Diegetic = VR.Diegetic || {};
  const hasDoc = typeof document !== 'undefined' && !!document.createElement;
  const T = (k, v) => (VR.I18N && VR.I18N.t ? VR.I18N.t(k, v) : k);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const fin = Number.isFinite;
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const esc = (s) => String(s === undefined || s === null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------------------------------------------------------------- the trail (pure)
  D.TRAIL_FROM = 2; D.TRAIL_TO = 16; D.STEP = 1.25; D.LANTERN = 5; D.SIDE = 0.2;
  D.trail = function (px, pz, tx, tz) {
    const out = [];
    if (![px, pz, tx, tz].every(fin)) return out;
    const dx = tx - px, dz = tz - pz, L = Math.hypot(dx, dz);
    if (L < 2.5) return out;
    const ux = dx / L, uz = dz / L, end = Math.min(D.TRAIL_TO, L - 1.2);
    let i = 0;
    for (let s = D.TRAIL_FROM; s <= end + 1e-6; s += D.STEP, i++) {
      const side = i & 1 ? -1 : 1;
      out.push({ x: px + ux * s - uz * side * D.SIDE, z: pz + uz * s + ux * side * D.SIDE, side, lantern: i % D.LANTERN === 2, k: 1 - 0.55 * (s - D.TRAIL_FROM) / (D.TRAIL_TO - D.TRAIL_FROM), s });
    }
    return out;
  };
  // the Wegweiser: beyond 20 m, at the trail's end
  D.sign = (d) => (fin(d) && d > 20 ? { at: D.TRAIL_TO } : null);

  // ================================================================ f-ux2 (pure): the trail along a walkable path
  // poly: [[x, z], …] from the player (a VR.Folk.findPath result, cell centres). Steps every D.STEP m of the path's own
  // length, left/right, each facing along its stretch (h: 0 = north −z, π/2 = east +x).
  function arcOf(poly) { const L = [0]; for (let i = 1; i < poly.length; i++) L.push(L[i - 1] + Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1])); return L; }
  function at(poly, L, s, o) {
    const n = poly.length; if (s <= 0) { o[0] = poly[0][0]; o[1] = poly[0][1]; return o; }
    let i = 1; while (i < n - 1 && L[i] < s) i++;
    const a = poly[i - 1], b = poly[i], seg = L[i] - L[i - 1] || 1, u = clamp((s - L[i - 1]) / seg, 0, 1);
    o[0] = a[0] + (b[0] - a[0]) * u; o[1] = a[1] + (b[1] - a[1]) * u; o[2] = (u < 0.5 ? a : b)[2]; return o;
  }
  const _a = [0, 0], _b = [0, 0];
  D.trailPath = function (poly) {
    const out = [];
    if (!Array.isArray(poly) || poly.length < 2) return out;
    const L = arcOf(poly), tot = L[L.length - 1]; if (tot < 2.5) return out;
    const end = Math.min(D.TRAIL_TO, tot - 1.2);
    let i = 0;
    for (let s = D.TRAIL_FROM; s <= end + 1e-6; s += D.STEP, i++) {
      at(poly, L, s - 0.9, _a); at(poly, L, Math.min(tot, s + 0.9), _b);
      const h = Math.atan2(_b[0] - _a[0], -(_b[1] - _a[1])), rx = Math.cos(h), rz = Math.sin(h);
      const c = at(poly, L, s, [0, 0, undefined]), side = i & 1 ? -1 : 1;
      out.push({ x: c[0] + rx * side * D.SIDE, z: c[1] + rz * side * D.SIDE, y: fin(c[2]) ? c[2] : undefined, side, h, lantern: i % D.LANTERN === 2, k: 1 - 0.55 * (s - D.TRAIL_FROM) / (D.TRAIL_TO - D.TRAIL_FROM), s });
    }
    return out;
  };
  // a cheap grid A* (f-ux2): a (2R+1)² window around `from`, typed arrays kept between searches (no allocation but the
  // result), each cell's standing height found lazily (≤ 5 block reads), steps up 1 / down 3, diagonals only past free
  // corners, water slow, doors open. pass(s) → 0 blocked · 1 free · 2 door · 3 water; stand(s) → 1 can stand on it.
  // → { path: [[x, z, y], …] cell centres from `from`, complete, expanded } or null
  const GP = { R: 0 };
  D.gridPath = function (getBlock, pass, stand, from, to, R, max) {
    R = R | 0; const N = 2 * R + 1, NN = N * N;
    if (GP.R !== R) { GP.R = R; GP.cost = new Float32Array(NN); GP.came = new Int32Array(NN); GP.hy = new Int16Array(NN); GP.st = new Uint8Array(NN); GP.hk = new Int32Array(NN * 4); GP.hv = new Float32Array(NN * 4); }
    const cost = GP.cost, came = GP.came, hy = GP.hy, st = GP.st, hk = GP.hk, hv = GP.hv;
    cost.fill(Infinity); st.fill(0);
    const x0 = from[0] - R, z0 = from[2] - R, tx = to[0], tz = to[2], near2 = 4;
    const free = (x, y, z) => { const a = pass(getBlock(x, y, z)); return a && pass(getBlock(x, y + 1, z)) ? a : 0; };
    const standAt = (x, z, yr) => { for (let k = 0; k < 5; k++) { const y = yr + (k === 0 ? 0 : k === 1 ? 1 : 1 - k); if (free(x, y, z) && stand(getBlock(x, y - 1, z))) return y; } return -32768; };
    const hh = (x, z) => { const dx = Math.abs(x - tx), dz = Math.abs(z - tz); return (dx > dz ? dx + 0.414 * dz : dz + 0.414 * dx) * 1.1; };
    let hn = 0;
    const push = (k, v) => { let i = hn++; hk[i] = k; hv[i] = v; while (i > 0) { const q = (i - 1) >> 1; if (hv[q] <= hv[i]) break; const tk = hk[q], tv = hv[q]; hk[q] = hk[i]; hv[q] = hv[i]; hk[i] = tk; hv[i] = tv; i = q; } };
    const pop = () => { const top = hk[0]; hn--; if (hn > 0) { hk[0] = hk[hn]; hv[0] = hv[hn]; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < hn && hv[l] < hv[m]) m = l; if (r < hn && hv[r] < hv[m]) m = r; if (m === i) break; const tk = hk[m], tv = hv[m]; hk[m] = hk[i]; hv[m] = hv[i]; hk[i] = tk; hv[i] = tv; i = m; } } return top; };
    // the straight way first (open land: no search at all)
    { const L = Math.hypot(tx - from[0], tz - from[2]), ux = (tx - from[0]) / (L || 1), uz = (tz - from[2]) / (L || 1), line = [[from[0] + 0.5, from[2] + 0.5, from[1]]];
      let lx = from[0], lz = from[2], ly = from[1], ok = L > 0;
      for (let t = 0.5; ok && t <= L; t += 0.5) {
        const cx = Math.floor(from[0] + 0.5 + ux * t), cz = Math.floor(from[2] + 0.5 + uz * t); if (cx === lx && cz === lz) continue;
        if (cx !== lx && cz !== lz && (!free(cx, ly, lz) || !free(lx, ly, cz))) { ok = false; break; }
        const ny = standAt(cx, cz, ly); if (ny === -32768 || (ny > ly && !pass(getBlock(lx, ly + 2, lz)))) { ok = false; break; }
        lx = cx; lz = cz; ly = ny; line.push([cx + 0.5, cz + 0.5, ny]);
      }
      if (ok && line.length > 1) return { path: line, complete: true, expanded: 0, straight: true }; }
    const k0 = R * N + R; cost[k0] = 0; hy[k0] = from[1]; came[k0] = -1; st[k0] = 1; push(k0, hh(from[0], from[2]));
    let best = k0, bestH = hh(from[0], from[2]), n = 0, goal = -1;
    while (hn > 0 && n < max && hn < hk.length - 8) {
      const k = pop(); if (st[k] === 2) continue; st[k] = 2; n++;
      const cx = ((k / N) | 0) + x0, cz = (k % N) + z0, cy = hy[k];
      const ddx = cx - tx, ddz = cz - tz; if (ddx * ddx + ddz * ddz <= near2) { goal = k; break; }
      const hc = hh(cx, cz); if (hc < bestH) { bestH = hc; best = k; }
      for (let di = 0; di < 8; di++) {
        const dx = di < 4 ? (di === 0 ? 1 : di === 1 ? -1 : 0) : (di & 1 ? -1 : 1), dz = di < 4 ? (di === 2 ? 1 : di === 3 ? -1 : 0) : (di < 6 ? 1 : -1);
        const nx = cx + dx, nz = cz + dz, ix = nx - x0, iz = nz - z0; if (ix < 0 || iz < 0 || ix >= N || iz >= N) continue;
        const nk = ix * N + iz; if (st[nk] === 2) continue;
        if (di >= 4 && (!free(cx + dx, cy, cz) || !free(cx, cy, cz + dz))) continue;
        const ny = standAt(nx, nz, cy); if (ny === -32768) continue;
        if (ny > cy && !pass(getBlock(cx, cy + 2, cz))) continue;   // (a step up needs the head room)
        const a = pass(getBlock(nx, ny, nz)), nc = cost[k] + (di >= 4 ? 1.414 : 1) + (a === 3 ? 4 : 0) + (ny !== cy ? 0.5 : 0);
        if (nc >= cost[nk]) continue;
        cost[nk] = nc; came[nk] = k; hy[nk] = ny; st[nk] = 1; push(nk, nc + hh(nx, nz));
      }
    }
    const end = goal >= 0 ? goal : best; if (end === k0) return null;
    const path = []; for (let k = end, g = 0; k >= 0 && g < NN; k = came[k], g++) path.push([((k / N) | 0) + x0 + 0.5, (k % N) + z0 + 0.5, hy[k]]);
    path.reverse();
    return { path, complete: goal >= 0, expanded: n };
  };
  // the Wegweiser at a fork: where the way turns more than 35° (over 3 m before and after: the grid's staircase is no
  // turn), the sharpest point of each bend, ≥ 8 m apart, at most two, 4 m on
  D.FORK_DEG = 35;
  D.forks = function (poly, maxS) {
    const out = []; if (!Array.isArray(poly) || poly.length < 3) return out;
    const L = arcOf(poly), tot = L[L.length - 1], lim = Math.min(maxS || 40, tot - 3), c = [0, 0, 0], p0 = [0, 0, 0], p1 = [0, 0, 0];
    let best = null;
    const flush = () => { if (best && (!out.length || best.s - out[out.length - 1].s >= 8) && out.length < 2) out.push(best); best = null; };
    for (let s = 4; s <= lim + 1e-6; s += 0.5) {
      at(poly, L, s, c); at(poly, L, s - 3, p0); at(poly, L, s + 3, p1);
      const ax = c[0] - p0[0], az = c[1] - p0[1], bx = p1[0] - c[0], bz = p1[1] - c[1];
      const cs = (ax * bx + az * bz) / ((Math.hypot(ax, az) * Math.hypot(bx, bz)) || 1), deg = Math.acos(clamp(cs, -1, 1)) * 180 / Math.PI;
      if (deg > D.FORK_DEG) { if (!best || deg > best.turn) best = { x: c[0], z: c[1], y: c[2], s, turn: deg, h: Math.atan2(bx, -bz), dir: ax * bz - az * bx > 0 ? 1 : -1 }; }
      else flush();
    }
    flush();
    return out;
  };
  // one sole on the ground (a ball and a heel, stretched along h, the right one mirrored): triangles (x, y, z) into buf
  // from o; returns the floats written. k: size.
  D.SOLE_SIZE = 1.9;   // (a step's print ≈ 37 × 21 cm: read from the third-person view)
  D.SOLE_N = 8; D.SOLE_FLOATS = D.SOLE_N * 2 * 9;
  D.sole = function (buf, o, x, y, z, h, side, k) {
    const s = k || 1, toe = 0.12 * side, hh = h + toe, fx = Math.sin(hh), fz = -Math.cos(hh), rx = Math.cos(hh), rz = Math.sin(hh), N = D.SOLE_N;
    const o0 = o;
    // [across, along, half-width, half-length]: the ball forward (its inner edge straighter), the heel behind
    const E = [[side * 0.012, 0.065, 0.056, 0.095], [side * 0.004, -0.105, 0.042, 0.05]];
    for (const e of E) {
      const cu = e[0] * s, cv = e[1] * s, cxw = x + rx * cu + fx * cv, czw = z + rz * cu + fz * cv;
      for (let i = 0; i < N; i++) {
        const a0 = i / N * 6.2832, a1 = (i + 1) / N * 6.2832;
        buf[o++] = cxw; buf[o++] = y; buf[o++] = czw;
        let u = Math.cos(a0) * e[2] * s, v = Math.sin(a0) * e[3] * s;
        buf[o++] = cxw + rx * u + fx * v; buf[o++] = y; buf[o++] = czw + rz * u + fz * v;
        u = Math.cos(a1) * e[2] * s; v = Math.sin(a1) * e[3] * s;
        buf[o++] = cxw + rx * u + fx * v; buf[o++] = y; buf[o++] = czw + rz * u + fz * v;
      }
    }
    return o - o0;
  };

  // ================================================================ f-ux2 (pure): ink doodles for the Wanderbuch
  // D.doodle(kind, seed) → pen strokes [[[x, y], …], …] in a 0..1 box (y down), a hand's small wobble by the seed.
  // Our own little drawings (houses, a tower, a tree, people, the fox, …), procedural.
  const dh = (a, b) => { let x = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35); x ^= x >>> 13; x = Math.imul(x, 0x27d4eb2f); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
  const DRAW = {
    house: (q) => { q.P([.15, .9], [.85, .9], [.85, .48], [.5, .16], [.15, .48], [.15, .9]); q.P([.08, .52], [.5, .12], [.92, .52]); q.P([.42, .9], [.42, .66], [.58, .66], [.58, .9]); q.P([.24, .58], [.36, .58], [.36, .7], [.24, .7], [.24, .58]); q.P([.66, .28], [.66, .14], [.74, .14], [.74, .36]); },
    tower: (q) => { q.P([.3, .92], [.34, .3], [.66, .3], [.7, .92]); q.P([.28, .3], [.28, .18], [.36, .18], [.36, .24], [.46, .24], [.46, .18], [.54, .18], [.54, .24], [.64, .24], [.64, .18], [.72, .18], [.72, .3]); q.P([.46, .92], [.46, .76], [.54, .76], [.54, .92]); q.P([.47, .44], [.47, .54], [.53, .54], [.53, .44]); q.P([.08, .92], [.92, .92]); },
    tree: (q) => { q.P([.47, .92], [.48, .6], [.4, .5]); q.P([.53, .92], [.52, .6], [.62, .48]); q.C(.5, .36, .24, 0, 6.3); q.C(.34, .48, .14, 1.6, 4.9); q.C(.66, .46, .14, -1.7, 1.6); q.P([.3, .92], [.7, .92]); },
    person: (q) => { q.C(.5, .2, .1, 0, 6.3); q.P([.5, .3], [.5, .62]); q.P([.28, .46], [.5, .38], [.72, .46]); q.P([.36, .92], [.5, .62], [.64, .92]); q.P([.36, .12], [.64, .12]); },
    fox: (q) => { q.P([.12, .5], [.2, .3], [.26, .44], [.34, .3], [.38, .5]); q.P([.12, .5], [.24, .62], [.38, .5]); q.P([.36, .52], [.7, .5], [.8, .62]); q.P([.32, .58], [.68, .64]); q.P([.42, .62], [.4, .86]); q.P([.64, .64], [.66, .86]); q.P([.8, .62], [.94, .42], [.88, .74], [.72, .66]); q.P([.21, .48], [.22, .49]); },
    rabbit: (q) => { q.C(.55, .64, .2, 0, 6.3); q.C(.32, .48, .11, 0, 6.3); q.P([.3, .38], [.24, .1], [.34, .36]); q.P([.36, .38], [.4, .1], [.42, .38]); q.C(.78, .62, .05, 0, 6.3); q.P([.4, .84], [.7, .84]); },
    dog: (q) => { q.C(.24, .36, .13, 0, 6.3); q.P([.12, .4], [.06, .44]); q.P([.16, .3], [.12, .5]); q.P([.32, .44], [.76, .46], [.86, .3]); q.P([.32, .6], [.76, .6]); q.P([.36, .6], [.36, .84]); q.P([.7, .6], [.72, .84]); q.P([.76, .46], [.76, .6]); },
    pup: (q) => { q.C(.34, .4, .15, 0, 6.3); q.P([.24, .28], [.2, .1], [.32, .26]); q.P([.38, .25], [.46, .08], [.48, .3]); q.P([.44, .52], [.8, .56], [.82, .84], [.46, .84], [.44, .52]); q.P([.56, .54], [.6, .4], [.66, .55], [.72, .42], [.76, .56]); q.P([.82, .7], [.94, .58]); q.P([.29, .38], [.3, .39]); q.P([.84, .2], [.88, .14]); q.P([.12, .62], [.16, .58]); },
    pot: (q) => { q.P([.16, .44], [.84, .44]); q.C(.5, .44, .34, 0, 3.15); q.P([.12, .5], [.04, .46]); q.P([.88, .5], [.96, .46]); q.P([.38, .32], [.34, .2], [.4, .1]); q.P([.56, .32], [.6, .2], [.54, .08]); q.P([.3, .92], [.7, .92]); },
    cart: (q) => { q.P([.12, .4], [.8, .4], [.74, .66], [.18, .66], [.12, .4]); q.C(.3, .76, .1, 0, 6.3); q.C(.64, .76, .1, 0, 6.3); q.P([.8, .4], [.94, .3]); q.P([.24, .4], [.3, .24], [.5, .22], [.62, .4]); },
    basket: (q) => { q.P([.14, .5], [.86, .5], [.76, .88], [.24, .88], [.14, .5]); q.C(.5, .5, .3, 3.2, 6.25); q.P([.2, .64], [.8, .64]); q.P([.24, .76], [.76, .76]); q.P([.4, .5], [.4, .88]); q.P([.6, .5], [.6, .88]); },
    note: (q) => { q.C(.3, .76, .1, 0, 6.3); q.C(.7, .68, .1, 0, 6.3); q.P([.4, .76], [.4, .2], [.8, .12], [.8, .68]); q.P([.4, .32], [.8, .24]); },
    kite: (q) => { q.P([.5, .08], [.8, .36], [.5, .66], [.22, .36], [.5, .08]); q.P([.5, .08], [.5, .66]); q.P([.22, .36], [.8, .36]); q.P([.5, .66], [.42, .78], [.56, .86], [.46, .96]); },
    rainbow: (q) => { q.C(.5, .82, .4, 3.15, 6.28); q.C(.5, .82, .3, 3.15, 6.28); q.C(.5, .82, .2, 3.15, 6.28); q.P([.04, .84], [.96, .84]); },
    mushroom: (q) => { q.C(.5, .5, .32, 3.15, 6.28); q.P([.18, .5], [.82, .5]); q.P([.42, .5], [.4, .86], [.6, .86], [.58, .5]); q.C(.38, .36, .04, 0, 6.3); q.C(.6, .3, .05, 0, 6.3); q.P([.2, .9], [.8, .9]); },
    cairn: (q) => { q.C(.5, .78, .24, 0, 6.3); q.C(.5, .5, .17, 0, 6.3); q.C(.5, .28, .11, 0, 6.3); q.P([.1, .96], [.9, .96]); },
    gate: (q) => { q.P([.28, .92], [.28, .26]); q.P([.72, .92], [.72, .26]); q.P([.12, .2], [.5, .14], [.88, .2]); q.P([.2, .34], [.8, .34]); q.P([.1, .92], [.9, .92]); },
    scroll: (q) => { q.P([.2, .2], [.8, .2], [.8, .8], [.2, .8], [.2, .2]); q.C(.2, .2, .06, 0, 6.3); q.C(.8, .8, .06, 0, 6.3); q.P([.3, .38], [.7, .38]); q.P([.3, .5], [.6, .5]); q.P([.36, .64], [.5, .58], [.62, .66]); },
    signpost: (q) => { q.P([.48, .94], [.48, .14]); q.P([.52, .94], [.52, .14]); q.P([.2, .2], [.76, .2], [.88, .28], [.76, .36], [.2, .36], [.2, .2]); q.P([.8, .48], [.24, .48], [.12, .56], [.24, .64], [.8, .64], [.8, .48]); },
    star: (q) => { q.P([.5, .1], [.6, .4], [.9, .42], [.66, .6], [.76, .9], [.5, .72], [.24, .9], [.34, .6], [.1, .42], [.4, .4], [.5, .1]); q.P([.84, .14], [.86, .12]); q.P([.14, .16], [.16, .14]); },
    lantern: (q) => { q.P([.5, .04], [.5, .16]); q.C(.5, .5, .3, 0, 6.3); q.P([.36, .2], [.64, .2]); q.P([.36, .8], [.64, .8]); q.P([.5, .2], [.5, .8]); q.P([.5, .84], [.5, .96]); },
    well: (q) => { q.P([.16, .56], [.84, .56], [.8, .9], [.2, .9], [.16, .56]); q.P([.22, .56], [.22, .26]); q.P([.78, .56], [.78, .26]); q.P([.1, .3], [.5, .08], [.9, .3]); q.P([.22, .36], [.78, .36]); q.P([.5, .36], [.5, .46]); q.P([.2, .72], [.8, .72]); },
  };
  D.DOODLES = Object.keys(DRAW);
  D.doodle = function (kind, seed) {
    const f = DRAW[kind] || DRAW.star, sd = (seed >>> 0) || 1, out = [];
    let n = 0;
    const wob = (x, y, am) => { n++; const A = am === undefined ? 0.03 : am; return [clamp(x + (dh(sd, n * 2) - 0.5) * A, 0.01, 0.99), clamp(y + (dh(sd, n * 2 + 1) - 0.5) * A, 0.01, 0.99)]; };
    const q = {
      P: (...pts) => { const s = []; for (let i = 0; i < pts.length; i++) { if (i) { const a = pts[i - 1], b = pts[i]; s.push(wob((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)); } s.push(wob(pts[i][0], pts[i][1])); } out.push(s); },
      C: (cx, cy, r, a0, a1) => { const s = [], m = Math.max(6, Math.round(Math.abs(a1 - a0) * 5)); for (let i = 0; i <= m; i++) { const a = a0 + (a1 - a0) * i / m; s.push(wob(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0.03 * Math.min(1, r * 4))); } out.push(s); },
    };
    f(q);
    return out;
  };
  const STK = { traveller: 'person', caravan: 'cart', pet: 'dog', picnic: 'basket', musician: 'note', kites: 'kite', crossing: 'fox', rainbow: 'rainbow', glade: 'mushroom', cairn: 'cairn', shrine: 'gate', ruins: 'tower', scrap: 'scroll', sign: 'signpost', stargazer: 'star', lanterns: 'lantern', well: 'well' };
  const PLACES = ['house', 'tower', 'tree', 'gate', 'well'];
  const hsd = (s) => { let x = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619); return x >>> 0; };
  D.hsd = hsd;
  D.doodleKind = function (page, id) {
    const s = String(id === undefined || id === null ? '' : id);
    if (page === 'creatures') return DRAW[s] ? s : /hase|rabbit/.test(s) ? 'rabbit' : 'fox';
    if (page === 'people') return 'person';
    if (page === 'recipes') return 'pot';
    if (page === 'stickers') return STK[s] || 'star';
    if (page === 'places') return /^v:|dorf|village|hafen/i.test(s) ? 'house' : PLACES[hsd(s) % PLACES.length];
    return 'star';
  };
  // the book's pages: the map, then two sections a page, the sticker board last
  D.pairPages = function (secs) {
    const out = [{ map: true }];
    for (let i = 0; i < secs.length; i += 2) out.push({ html: secs[i] + (secs[i + 1] || ''), n: secs[i + 1] ? 2 : 1 });
    out.push({ board: true });
    return out;
  };

  // ---------------------------------------------------------------- the vitals (pure): the edge's strength and kind
  D.vitals = function (hp, food, air) {
    const h = fin(hp) ? clamp(hp, 0, 1) : 1, f = fin(food) ? clamp(food, 0, 1) : 1, a = fin(air) ? clamp(air, 0, 1) : 1;
    const eh = h < 0.5 ? (0.5 - h) / 0.5 : 0, ef = f < 0.3 ? (0.3 - f) / 0.3 : 0, ea = a < 0.5 ? (0.5 - a) / 0.5 : 0;
    let kind = null, e = 0;
    if (eh > 0 && eh >= ef && eh >= ea) { kind = 'hurt'; e = eh; } else if (ea > 0 && ea >= ef) { kind = 'air'; e = ea; } else if (ef > 0) { kind = 'hungry'; e = ef * 0.8; }
    return { a: e > 0 ? +(0.2 + e * 0.6).toFixed(3) : 0, kind, breath: h < 0.35 };
  };

  // ---------------------------------------------------------------- the radial (pure)
  D.RADIAL = [
    { id: 'build', ico: '🔨', lab: 'g.ux.r.build' }, { id: 'map', ico: '🗺', lab: 'g.ux.r.map' }, { id: 'book', ico: '📖', lab: 'g.ux.r.book' }, { id: 'photo', ico: '📷', lab: 'g.ux.r.photo' },
    { id: 'funke', ico: '✨', lab: 'g.ux.r.funke' }, { id: 'journal', ico: '🧭', lab: 'g.ux.r.journal' }, { id: 'wave', ico: '👋', lab: 'g.ux.r.wave' }, { id: 'here', ico: '📍', lab: 'g.ux.r.here' },
  ];
  D.DEAD = 0.35;
  // a direction (screen: +x right, +y down) → the slice, clockwise from up; the centre: -1
  D.pick = function (dx, dy, n) {
    if (!fin(dx) || !fin(dy) || Math.hypot(dx, dy) < D.DEAD) return -1;
    const a = Math.atan2(dx, -dy), k = Math.round(a / (Math.PI * 2 / n));
    return ((k % n) + n) % n;
  };
  D.wheelStep = (sel, d, n) => (sel < 0 ? (d > 0 ? 0 : n - 1) : (((sel + Math.sign(d)) % n) + n) % n);

  // ---------------------------------------------------------------- the star map's labels (pure)
  D.STAR_LABELS = 24;
  D.capNear = function (near, n) {
    if (!Array.isArray(near) || near.length <= n) return near;
    return near.slice().sort((a, b) => a.d - b.d).slice(0, n);
  };

  // ---------------------------------------------------------------- the words and the switches
  D.KEYS = ['g.ux.sign', 'g.ux.book.notYet', 'g.ux.rose.n', 'g.ux.rose.goal', 'g.ux.book.prev', 'g.ux.book.next', 'g.ux.book.map', 'g.ux.book.mapNote', 'g.ux.book.board', 'g.ux.book.boardNote', 'g.ux.book.tray', 'g.ux.book.you', 'g.ux.book.page', 'g.ux.radial', 'g.ux.r.none', 'g.ux.wave', 'g.ux.here', 'g.ux.book.nomap'];
  D.ROWS = [
    { key: 'goalTrail', g: 'play', sec: 'ux', t: 'switch', lab: 'g.set.goalTrail', tip: 'g.set.goalTrail.tip', cost: 'low', def: true },
    { key: 'mapRose', g: 'play', sec: 'ux', t: 'switch', lab: 'g.set.mapRose', tip: 'g.set.mapRose.tip', cost: 'low', def: true },
    { key: 'vitals', g: 'play', sec: 'ux', t: 'choice', lab: 'g.set.vitals', tip: 'g.set.vitals.tip', cost: 'low', def: 'world', opts: [['world', 'g.set.vitals.world', 'g.set.vitals.world.tip'], ['both', 'g.set.vitals.both', 'g.set.vitals.both.tip'], ['bars', 'g.set.vitals.bars', 'g.set.vitals.bars.tip']] },
    { key: 'bookStyle', g: 'play', sec: 'ux', t: 'switch', lab: 'g.set.bookStyle', tip: 'g.set.bookStyle.tip', cost: 'low', def: true },
    { key: 'satchel', g: 'play', sec: 'ux', t: 'switch', lab: 'g.set.satchel', tip: 'g.set.satchel.tip', cost: 'low', def: true },
    { key: 'radial', g: 'play', sec: 'ux', t: 'switch', lab: 'g.set.radial', tip: 'g.set.radial.tip', cost: 'low', def: true },
  ];
  if (VR.Settings && VR.Settings.add) {
    try {
      const SE = VR.Settings.SECTIONS; if (SE && SE.play && SE.play.indexOf('ux') < 0) SE.play.push('ux');
      for (const r of D.ROWS) if (!VR.Settings.byKey || !VR.Settings.byKey(r.key)) VR.Settings.add(Object.assign({}, r));
    } catch (e) { /* an older registry: the defaults hold */ }
  }
  const DEF = {}; for (const r of D.ROWS) DEF[r.key] = r.def;
  const opt = (g, k) => { const S = g && g.settings; return S && S[k] !== undefined ? S[k] : DEF[k]; };
  D.opt = opt;
  const less = (g) => !!(VR.A11y && VR.A11y.less && VR.A11y.less(g && g.settings));

  if (typeof window === 'undefined' || !hasDoc) return;   // node: the pure parts only

  // ================================================================ the game side
  const CSS = `
.dgsign{position:absolute;left:0;top:0;display:none;pointer-events:none;transform:translate(-50%,-30px);z-index:3;filter:drop-shadow(0 3px 4px rgba(0,0,0,.45))}
.dgsign .pl{display:flex;align-items:center;gap:6px;padding:4px 14px 4px 10px;background:linear-gradient(180deg,#9a6b3f,#7a5130);color:#fff4dc;font:600 calc(13px*var(--ux-scale,1)) Georgia,serif;border-radius:4px 10px 10px 4px/4px 6px 6px 4px;clip-path:polygon(0 0,88% 0,100% 50%,88% 100%,0 100%);border:1px solid #4a2f18;text-shadow:0 1px 0 #3a2410;white-space:nowrap}
.dgsign .pl b{font-weight:700}.dgsign .pl i{font-style:normal;opacity:.85;font-size:.9em}
.dgsign .post{width:5px;height:var(--post,26px);margin:0 auto;background:linear-gradient(90deg,#5a3a20,#7a5130,#5a3a20);border-radius:1px}
.dgsign.l .pl{clip-path:polygon(12% 0,100% 0,100% 100%,12% 100%,0 50%);padding:4px 10px 4px 14px;border-radius:10px 4px 4px 10px/6px 4px 4px 6px}.dgsign.l .pl span{display:inline-block;transform:scaleX(-1);order:-1}.dgsign.fork .pl{font-size:calc(12px*var(--ux-scale,1))}
#dgrose{position:absolute;right:16px;top:14px;width:calc(64px*var(--ux-scale,1));height:calc(64px*var(--ux-scale,1));pointer-events:none;opacity:.78;transition:opacity .4s}
#dgrose .ring{position:absolute;inset:0;border-radius:50%;border:1.5px solid rgba(255,236,200,.55);background:radial-gradient(circle,rgba(10,14,28,.32),rgba(10,14,28,.12) 70%,transparent 72%)}
#dgrose .ring span{position:absolute;left:50%;top:50%;width:14px;height:14px;margin:-7px;text-align:center;font:700 10px/14px var(--display,sans-serif);color:rgba(255,240,215,.75)}
#dgrose .ring span.n{color:#ff9b7a;font-size:12px}
#dgrose .tick{position:absolute;inset:0;display:none}#dgrose .tick i{position:absolute;left:50%;top:-3px;margin-left:-6px;width:12px;height:12px;font-style:normal;font-size:12px;line-height:12px;text-align:center;color:#ffd166;text-shadow:0 0 6px rgba(255,200,90,.9),0 0 1px #000}
#dgrose .tick.wp i{color:#9fe3ff;font-size:9px;text-shadow:0 0 4px rgba(120,200,255,.8),0 0 1px #000}
#dgrose .me{position:absolute;left:50%;top:50%;width:0;height:0;margin:-6px 0 0 -4px;border:4px solid transparent;border-bottom:9px solid rgba(255,244,220,.85);border-top:0}
body.dg-rose #hud #minimap,body.dg-rose #hud #compass{display:none!important}
#dgvig{position:fixed;inset:0;pointer-events:none;z-index:2;opacity:0;transition:opacity .9s ease;background:radial-gradient(ellipse farthest-side at 50% 50%,transparent 50%,var(--dgv,rgba(90,0,8,.9)) 105%)}
#dgpulse{position:fixed;inset:0;pointer-events:none;z-index:2;opacity:0;background:radial-gradient(ellipse farthest-side at 50% 50%,transparent 45%,var(--dgp,rgba(140,10,20,.8)) 110%)}
#dgpulse.go{animation:dgpulse .65s ease-out}
@keyframes dgpulse{0%{opacity:0}18%{opacity:var(--dgpa,.32)}100%{opacity:0}}
body.dg-vit #hud #stats:not(.dg-danger){opacity:0!important;pointer-events:none}
#dgradial{position:fixed;left:50%;top:50%;width:min(340px,80vmin);height:min(340px,80vmin);transform:translate(-50%,-50%) scale(.86);opacity:0;pointer-events:none;z-index:30;transition:opacity .14s,transform .14s}
#dgradial.on{opacity:1;transform:translate(-50%,-50%) scale(1)}
#dgradial .disc{position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle,rgba(12,16,30,.18) 0 22%,rgba(12,16,30,.62) 23% 69%,transparent 70%);border:1px solid rgba(255,230,190,.12)}
#dgradial .it{position:absolute;width:64px;height:64px;margin:-32px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:26px;color:#fff3dc;background:rgba(30,36,58,.55);border:1.5px solid rgba(255,230,190,.25);transition:transform .1s,background .1s}
#dgradial .it.sel{transform:scale(1.18);background:rgba(255,190,90,.38);border-color:#ffd38a;box-shadow:0 0 18px rgba(255,190,90,.45)}
#dgradial .lab{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);max-width:30%;text-align:center;font:600 calc(14px*var(--ux-scale,1)) var(--display,sans-serif);color:#ffe7b8;text-shadow:0 1px 3px #000}
html.a11y-hc #dgradial .it{background:#000;border-color:#fff}html.a11y-hc #dgradial .it.sel{outline:3px solid #ffe600}html.a11y-hc .dgsign .pl{background:#000;color:#fff;border-color:#fff}
body.dg-satchel #inventory.on #invpanel{animation:dgsatch .34s cubic-bezier(.2,.9,.3,1.15);transform-origin:50% 100%}
body.dg-satchel #inventory.on #invpanel::before{content:'';position:absolute;left:10%;right:10%;top:-16px;height:46px;border-radius:6px 6px 30px 30px;background:linear-gradient(180deg,#8a5a34,#6b4325);border:2px dashed rgba(255,220,170,.35);box-shadow:0 4px 8px rgba(0,0,0,.4);transform-origin:50% 0;animation:dgflap .42s ease-in forwards;pointer-events:none;z-index:5}
body.dg-satchel #inventory.on #invpanel::after{content:'';position:absolute;left:50%;top:-2px;width:22px;height:16px;margin-left:-11px;border-radius:4px;background:linear-gradient(180deg,#e8c27a,#a87b34);box-shadow:0 1px 2px rgba(0,0,0,.5);animation:dgbuckle .42s ease-in forwards;pointer-events:none;z-index:6}
body.dg-satchel #inventory.on #invpanel{border:2px solid #6b4325;box-shadow:0 0 0 4px rgba(107,67,37,.35),inset 0 0 0 3px rgba(0,0,0,.15);outline:1.5px dashed rgba(255,220,170,.25);outline-offset:-8px}
body.dg-satchel #inventory.on #invpanel{position:relative}
@keyframes dgsatch{0%{transform:translateY(18%) scale(.72,.5);opacity:0}55%{opacity:1}100%{transform:none;opacity:1}}
@keyframes dgflap{0%{transform:perspective(500px) rotateX(0)}100%{transform:perspective(500px) rotateX(-150deg) scaleY(.6)}}@keyframes dgbuckle{0%{transform:translateY(30px)}100%{transform:translateY(-14px)}}
html.a11y-less body.dg-satchel #inventory.on #invpanel,html.a11y-less body.dg-satchel #inventory.on #invpanel::before,html.a11y-less body.dg-satchel #inventory.on #invpanel::after{animation:none}
#wanderbuch.dgb{perspective:1600px;align-items:center;justify-content:center}
#wanderbuch.dgb .wdcard{max-width:min(980px,96vw);width:min(980px,96vw);max-height:none;overflow:visible;background:transparent;border:0;box-shadow:none;padding:0;color:#3b2a1a}
#wanderbuch .dgbook{position:relative;display:grid;grid-template-columns:1fr 1fr;min-height:min(560px,76vh);background:#5a3a22;padding:14px;border-radius:14px 14px 18px 18px;box-shadow:0 18px 40px rgba(0,0,0,.55),inset 0 0 0 2px #3c2614;transform-style:preserve-3d;animation:dgbopen .5s ease-out}
@keyframes dgbopen{0%{transform:rotateX(18deg) translateY(30px) scale(.92);opacity:0}100%{transform:none;opacity:1}}
#wanderbuch .dgpage{position:relative;padding:22px 26px 34px;overflow:auto;max-height:min(600px,74vh);background:#f4e7c9;background-image:repeating-linear-gradient(180deg,transparent 0 27px,rgba(110,140,170,.22) 27px 28px),radial-gradient(ellipse at 30% 20%,rgba(255,250,235,.7),transparent 60%),radial-gradient(ellipse at 80% 90%,rgba(200,160,100,.25),transparent 55%);font:15px/28px Georgia,'Times New Roman',serif;color:#3b2a1a}
#wanderbuch .dgpage.l{border-radius:8px 2px 2px 8px;box-shadow:inset -18px 0 22px -12px rgba(80,50,20,.45)}
#wanderbuch .dgpage.r{border-radius:2px 8px 8px 2px;box-shadow:inset 18px 0 22px -12px rgba(80,50,20,.45)}
#wanderbuch .dgpage h3{margin:0 0 6px;font:italic 700 21px/28px Georgia,serif;color:#6a3d1c;border-bottom:2px solid rgba(106,61,28,.35);border-radius:0 0 40% 60%/0 0 6px 4px}
#wanderbuch .dgpage h3 .note{font:400 13px Georgia,serif;opacity:.7;color:#6a3d1c}
#wanderbuch .dgpage .wdsec{margin-bottom:14px}#wanderbuch .dgpage .wdbar{height:7px;border-radius:4px;background:rgba(106,61,28,.15);border:1px solid rgba(106,61,28,.35)}#wanderbuch .dgpage .wdbar i{background:repeating-linear-gradient(45deg,#c27a3a 0 4px,#d9935a 4px 8px)}
#wanderbuch .dgpage .chip{display:inline-block;padding:0 8px;margin:2px 3px;background:transparent;color:#3b2a1a;border:1.5px solid rgba(59,42,26,.55);border-radius:255px 15px 225px 15px/15px 225px 15px 255px;line-height:22px}
#wanderbuch .dgpage .wdst{background:transparent;border:1.5px dashed rgba(59,42,26,.4);border-radius:50%;color:#3b2a1a}#wanderbuch .dgpage .wdst.on{background:rgba(255,255,255,.5);border-style:solid}
#wanderbuch .dgpage .note{opacity:.85;font-size:13px;color:#6a4a2a}
#wanderbuch .dgnum{position:absolute;bottom:8px;left:0;right:0;text-align:center;font:italic 12px Georgia,serif;opacity:.6}
#wanderbuch .dghead{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 8px;padding:6px 10px 6px 14px;border-radius:12px;background:rgba(30,20,12,.72);color:#ffe7c2}#wanderbuch .dghead .note{flex:1;min-width:0;font:italic 13px/1.35 Georgia,serif;color:#f1dcbc;opacity:.9}
#wanderbuch .dghead h2{margin:0;font:italic 700 24px Georgia,serif;text-shadow:0 2px 4px #000}
#wanderbuch .dgnav{display:flex;gap:6px}
#wanderbuch .dgnav button{font:600 15px Georgia,serif;min-width:44px;min-height:40px}
#wanderbuch .dgleaf{position:absolute;top:14px;bottom:14px;left:50%;width:calc(50% - 14px);transform-origin:0 50%;background:#efdfbd;background-image:linear-gradient(90deg,rgba(60,40,20,.28),rgba(60,40,20,0) 22%,rgba(255,250,235,.35) 70%,rgba(60,40,20,.12)),repeating-linear-gradient(180deg,transparent 0 27px,rgba(110,140,170,.2) 27px 28px);border-radius:2px 8px 8px 2px;box-shadow:0 0 18px rgba(0,0,0,.35);backface-visibility:hidden;pointer-events:none;z-index:4}
#wanderbuch .dgleaf.fw{animation:dgturn .55s ease-in-out forwards}#wanderbuch .dgleaf.bw{left:14px;transform-origin:100% 50%;border-radius:8px 2px 2px 8px;animation:dgturnb .55s ease-in-out forwards}
@keyframes dgturn{0%{transform:rotateY(0)}100%{transform:rotateY(-178deg);opacity:.2}}@keyframes dgturnb{0%{transform:rotateY(0)}100%{transform:rotateY(178deg);opacity:.2}}
html.a11y-less #wanderbuch .dgbook,html.a11y-less #wanderbuch .dgleaf{animation:none!important}html.a11y-less #wanderbuch .dgleaf{display:none}
#wanderbuch .dgdoods{display:flex;flex-wrap:wrap;gap:4px 8px;margin:4px 0 6px}#wanderbuch .dgdood{margin:0;width:62px;text-align:center;transform:rotate(var(--r,0deg))}#wanderbuch .dgdood canvas{width:56px;height:56px;display:block;margin:0 auto}#wanderbuch .dgdood figcaption{font:italic 11px/13px Georgia,serif;color:#5a3a1c;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#wanderbuch .dgdood.faint{opacity:.45;width:auto}#wanderbuch .dgdood.faint figcaption{white-space:normal}
#wanderbuch .dgmap{display:block;width:min(100%,44vh);margin:0 auto;aspect-ratio:1;border-radius:6px 10px 7px 12px/10px 6px 12px 7px;border:2px solid rgba(59,42,26,.6)}
#wanderbuch .dgboard{position:relative;height:min(300px,30vh);margin-top:6px;border:2px dashed rgba(106,61,28,.35);border-radius:12px;cursor:crosshair;overflow:hidden}
#wanderbuch .dgboard .stk{position:absolute;font-size:34px;line-height:1;transform:translate(-50%,-50%) rotate(var(--r,0deg));filter:drop-shadow(1px 2px 0 #fff) drop-shadow(-1px -1px 0 #fff) drop-shadow(0 2px 3px rgba(0,0,0,.3));cursor:pointer;user-select:none}
#wanderbuch .dgtray{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}#wanderbuch .dgtray button{font-size:22px;width:42px;height:42px;border-radius:50%;border:1.5px solid rgba(59,42,26,.45);background:rgba(255,255,255,.4);cursor:pointer}
#wanderbuch .dgtray button.on{outline:3px solid #c27a3a;background:#fff}
html.a11y-hc #wanderbuch .dgpage{background:#fff;color:#000}
@media (max-width:760px){#wanderbuch .dgbook{grid-template-columns:1fr}#wanderbuch .dgpage.r{display:none}}
`;
  let styled = false;
  function style() { if (styled || !document.head) return; styled = true; const s = document.createElement('style'); s.id = 'dgcss'; s.textContent = CSS; document.head.appendChild(s); }
  const $ = (id) => document.getElementById(id);
  const mk = (tag, id, cls, html, parent) => { const e = document.createElement(tag); if (id) e.id = id; if (cls) e.className = cls; if (html) e.innerHTML = html; (parent || $('hud') || document.body).appendChild(e); return e; };

  D.cost = { frames: 0, ms: 0, worst: 0, spawns: 0 };
  D.forced = null;
  D.setGoal = (t) => { D.forced = t && fin(t.x) && fin(t.z) ? { x: t.x, y: fin(t.y) ? t.y : null, z: t.z, label: String(t.label || '') } : null; };
  const S = { acc: 0, trailT: 0, goal: null, goalD: 0, pts: [], sign: null, signShown: false, roseOn: null, vitOn: null, satOn: null, vig: -1, vigKind: null, breathT: 0, hp: -1, roseK: '', world: null };
  D.state = S;
  function goalOf(g) {
    if (D.forced) return D.forced;
    try { const Q = VR.Quests, t = Q && Q.target ? Q.target() : null; if (t && fin(t.x) && fin(t.z)) return t; } catch (e) { /* no quests here */ }
    // no quest: the waypoint placed last (a goal the player set), within 3 km
    const gad = g.gadgets, wl = gad && gad.waypoints, wp = wl && wl.length ? wl[wl.length - 1] : null, p = g.player;
    if (wp && fin(wp.x) && fin(wp.z) && Math.hypot(wp.x - p.pos[0], wp.z - p.pos[2]) < 3000) return { x: wp.x + 0.5, y: wp.y, z: wp.z + 0.5, label: String(wp.name || '') };
    return null;
  }
  const PO = { life: 1.1, size: 0.09, grav: 0, col: [1, 0.82, 0.45], emis: 1, drag: 0, collide: false, force: true, uv: [0, 0, 1, 1], alpha: 0.9 };
  const PL = { life: 1.1, size: 0.2, grav: 0, col: [1, 0.72, 0.32], emis: 1, drag: 0, collide: false, force: true, uv: [0, 0, 1, 1], alpha: 0.8 };
  const groundY = (g, x, z, y0) => { const w = g.world; if (!w || !w.topAt) return y0; const h = w.topAt(Math.floor(x), Math.floor(z)); return h > 0 && Math.abs(h + 1 - y0) < 12 ? h + 1 : y0; };
  // (the trail shows: the setting, particles on — Very Low has none —, on foot, no auto-walk)
  const trailOn = (g) => !!(opt(g, 'goalTrail') && ((g.settings && g.settings.particles) | 0) > 0 && !g.flight && !(VR.Intent && VR.Intent.current && VR.Intent.current()));
  function trailFrame(g, dt) {
    const P = g.particles, p = g.player;
    if (!P || !S.goal || !trailOn(g)) return;
    if ((S.trailT -= dt) > 0) return;
    S.trailT = 0.5;
    const pts = S.pts, y0 = p.pos[1], t = g.time || 0, decal = !!S.soleN;
    for (let i = 0; i < pts.length; i++) {
      const q = pts[i], y = q.y === undefined ? (q.y = groundY(g, q.x, q.z, y0)) : q.y;
      const tw = 0.75 + 0.25 * Math.sin(t * 2 + i * 0.9);
      if (!decal) { PO.alpha = 0.85 * q.k * tw; PO.size = 0.085 + 0.02 * q.k; P.spawn(q.x, y + 0.04, q.z, 0, 0.02, 0, PO); D.cost.spawns++; }   // (the steps are soles now; the dots only without the decal batch)
      if (q.lantern) { PL.alpha = 0.7 * q.k * tw; P.spawn(q.x - q.side * 0.5, y + 0.85 + 0.06 * Math.sin(t * 1.7 + i), q.z, 0, 0.03, 0, PL); D.cost.spawns++; }
    }
  }
  // f-ux2: the walkable way to the goal — VR.Folk.findPath to a point ≤ 40 m toward it, searched again only when you
  // moved 3 m or the goal moved 2 m, at most every 1.5 s, ≤ 700 cells (400 when the main thread is the bottleneck)
  D.decals = true; D.paths = true;   // (false: the f-ux trail — round dots on the straight line; test/ux2_shots.mjs's „before“)
  D.PATH_REACH = 32; D.PATH_MAX = 1400;
  function pathFor(g, p, goal) {
    const F = VR.Folk, w = g.world;
    if (!F || !F.passable || !F.standable || !w || !w.getBlock || (F.warmed && !F.warmed())) return null;
    const px = p.pos[0], pz = p.pos[2], t = now();
    const moved = S.pFrom ? Math.hypot(px - S.pFrom[0], pz - S.pFrom[1]) : 1e9, gm = S.pGoal ? Math.hypot(goal.x - S.pGoal[0], goal.z - S.pGoal[1]) : 1e9;
    if ((moved > 3 || gm > 2 || S.pW !== w) && t - (S.pathT || -1e9) > 1500) {
      S.pathT = t; S.pFrom = [px, pz]; S.pGoal = [goal.x, goal.z]; S.pW = w; S.poly = null;
      const dx = goal.x - px, dz = goal.z - pz, L = Math.hypot(dx, dz) || 1, r0 = Math.min(L, D.PATH_REACH);
      const gx = Math.floor(px + dx / L * r0), gz = Math.floor(pz + dz / L * r0);
      const top = w.topAt ? w.topAt(gx, gz) : -1, fy = Math.floor(p.pos[1] + 0.1), gy = top > 0 && Math.abs(top + 1 - fy) < 16 ? top + 1 : fy;
      try {
        const t1 = now(), gb = (x, y, z) => w.getBlock(x, y, z), r = D.gridPath(gb, F.passable, F.standable, [Math.floor(px), fy, Math.floor(pz)], [gx, gy, gz], D.PATH_REACH + 2, g.cpuBound ? D.PATH_MAX >> 1 : D.PATH_MAX);
        const ms = now() - t1; D.cost.pathN = (D.cost.pathN || 0) + 1; D.cost.pathMs = (D.cost.pathMs || 0) + ms; if (ms > (D.cost.pathWorst || 0)) D.cost.pathWorst = ms;
        if (r && r.path && r.path.length > 1) S.poly = r.path;
      } catch (e) { S.poly = null; }
    }
    const poly = S.poly; if (!poly) return null;
    // from where you stand: the nearest of its first cells on
    let j = 0, bd = 1e18; for (let i = 0; i < Math.min(poly.length, 14); i++) { const d = (poly[i][0] - px) ** 2 + (poly[i][1] - pz) ** 2; if (d < bd) { bd = d; j = i; } }
    if (bd > 36) return null;
    const out = [[px, pz, Math.floor(p.pos[1] + 0.1)]]; for (let i = j + 1; i < poly.length; i++) out.push(poly[i]);
    return out;
  }
  D._pathFor = pathFor;   // (test/ux2_trail.js)
  // the soles: one small batch (≤ 14 × 16 triangles), rebuilt with the trail (4 Hz), drawn after the crack (popFx)
  const SOLES = 14; S.soleBuf = null; S.soleN = 0; S.soleVer = 0; S.soleK = new Float32Array(SOLES); S.soleAt = new Int32Array(SOLES); S.soleCnt = new Int32Array(SOLES);
  D._buildSoles = (g, h0) => buildSoles(g, h0);
  function buildSoles(g, h0) {
    if (!S.soleBuf) S.soleBuf = new Float32Array(SOLES * D.SOLE_FLOATS);
    const pts = S.pts, y0 = g.player.pos[1], fr = y0 - Math.floor(y0 + 0.1), lift = (fr > 0 && fr < 0.95 ? fr : 0) + 0.03; let o = 0, n = 0;   // (the floor's own height: a plate or a slab under your feet)
    for (let i = 0; i < pts.length && n < SOLES; i++, n++) {
      const q = pts[i], y = q.y === undefined ? (q.y = groundY(g, q.x, q.z, y0)) : q.y;
      S.soleAt[n] = o / 3; const w = D.sole(S.soleBuf, o, q.x, (q.y === Math.floor(q.y) ? y + lift : y + 0.03), q.z, fin(q.h) ? q.h : h0, q.side, D.SOLE_SIZE); S.soleCnt[n] = w / 3; S.soleK[n] = q.k; o += w;
    }
    S.soleN = n; S.soleVer++;
  }
  D.drawSoles = function (ren) {
    const g = VR.game; if (!S.soleN || !g || !S.goal || !trailOn(g) || g.state !== 'play') return 0;
    const gl = ren.gl, p = ren.P && ren.P.line, cam = ren.cam; if (!gl || !p || !cam) return 0;
    if (!S.soleVBO) {
      S.soleVBO = gl.createBuffer(); S.soleVAO = gl.createVertexArray();
      gl.bindVertexArray(S.soleVAO); gl.bindBuffer(gl.ARRAY_BUFFER, S.soleVBO); gl.bufferData(gl.ARRAY_BUFFER, S.soleBuf.byteLength, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0); S.soleUp = -1; S.soleGL = gl;
    }
    gl.bindVertexArray(S.soleVAO);
    if (S.soleUp !== S.soleVer) { gl.bindBuffer(gl.ARRAY_BUFFER, S.soleVBO); gl.bufferSubData(gl.ARRAY_BUFFER, 0, S.soleBuf); S.soleUp = S.soleVer; }
    gl.useProgram(p.p);
    gl.uniformMatrix4fv(p.u.u_viewProj, false, ren.viewProj);
    gl.uniform3f(p.u.u_offset, -cam.x, -cam.y, -cam.z);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.disable(gl.CULL_FACE);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -2);
    const t = g.time || 0, E = g.env, night = E && fin(E.night) ? clamp(E.night, 0, 1) : 0.3, gain = 1.9 + 0.8 * night;
    for (let i = 0; i < S.soleN; i++) {
      const tw = 0.85 + 0.15 * Math.sin(t * 2 - i * 0.7), a = clamp(0.95 * S.soleK[i] * tw, 0, 1);
      gl.uniform4f(p.u.u_color, 1.0 * gain, 0.72 * gain, 0.3 * gain, a);
      gl.drawArrays(gl.TRIANGLES, S.soleAt[i], S.soleCnt[i]);
    }
    gl.disable(gl.POLYGON_OFFSET_FILL); gl.depthMask(true); gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE);
    gl.bindVertexArray(null);
    D.cost.soleDraws = (D.cost.soleDraws || 0) + 1;
    return S.soleN;
  };
  const RenC = VR.Renderer;
  if (RenC && RenC.prototype && !(RenC.prototype.popFx && RenC.prototype.popFx.__dgs)) {
    const pf = RenC.prototype.popFx;
    RenC.prototype.popFx = function (F) { const r = pf ? pf.apply(this, arguments) : undefined; try { if (S.soleN) D.drawSoles(this); } catch (e) { /* the frame goes on */ } return r; };
    RenC.prototype.popFx.__dgs = true;
  }
  // the signposts: projected (intent.js's projection) — the one at the trail's end and one at each fork on the way
  function project(g, sg, el) {
    const c = g.cam, cy = Math.cos(c.yaw), sy = Math.sin(c.yaw), cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
    const fx = -sy * cp, fy = sp, fz = -cy * cp, rx = cy, rz = -sy, ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;
    const dx = sg.x - c.x, dy = sg.y - c.y, dz = sg.z - c.z, zc = dx * fx + dy * fy + dz * fz;
    const W = window.innerWidth || 960, H = window.innerHeight || 540, ty = Math.tan((c.fov || 1.2) / 2), txx = ty * W / H;
    if (zc <= 1.5) return false;
    const nx = (dx * rx + dz * rz) / zc / txx, ny = (dx * ux + dy * uy + dz * uz) / zc / ty;
    if (Math.abs(nx) >= 1.1 || Math.abs(ny) >= 1.1) return false;
    const gy = dy - 1.9, ny2 = (dx * ux + gy * uy + dz * uz) / zc / ty, post = Math.max(6, Math.min(140, (ny - ny2) * 0.5 * H + 4));
    el.style.left = ((nx * 0.5 + 0.5) * W).toFixed(1) + 'px'; el.style.top = ((0.5 - ny * 0.5) * H).toFixed(1) + 'px'; el.style.setProperty('--post', post.toFixed(0) + 'px');
    el.style.opacity = zc > 34 ? String(clamp(1 - (zc - 34) / 10, 0.25, 1)) : '';
    return true;
  }
  function signFrame(g) {
    const base = !!(opt(g, 'goalTrail') && g.cam && !g.hideHud && !(g.ui && g.ui.screen) && !g.flight);
    const sg = S.sign, el = S.signEl;
    let show = !!(base && sg && el);
    if (show && sg.occ) show = false;
    if (show) show = project(g, sg, el);
    if (show !== S.signShown) { S.signShown = show; if (el) el.style.display = show ? 'block' : 'none'; }
    for (let i = 0; i < S.forkEls.length; i++) {
      const f = S.forks[i], fe = S.forkEls[i]; let on = !!(base && f);
      if (on && f.occ) on = false;
      if (on) on = project(g, f, fe);
      if (on !== fe._on) { fe._on = on; fe.style.display = on ? 'block' : 'none'; }
    }
  }
  S.forks = []; S.forkEls = []; S.forksShown = 0;
  // a sign behind a wall stays hidden (one ray from the eye to its board, at 4 Hz)
  function hidden(g, sg) {
    const c = g.cam, PH = VR.PHYS, w = g.world; if (!c || !PH || !PH.raycast || !w) return false;
    const dx = sg.x - c.x, dy = sg.y - 0.4 - c.y, dz = sg.z - c.z, L = Math.hypot(dx, dy, dz); if (L < 2) return false;
    const hit = PH.raycast((x, y, z) => w.getBlock(x, y, z), c.x, c.y, c.z, dx / L, dy / L, dz / L, L - 0.8);
    return !!(hit && hit.state && VR.R && VR.F && (VR.R.T.flags[hit.state] & VR.F.SOLID) && !(VR.R.T.flags[hit.state] & VR.F.PLANT));   // (a flower or the grass hides nothing)
  }
  const fmtD = (d) => (d >= 1000 ? (d / 1000).toFixed(1).replace('.', VR.I18N && VR.I18N.lang === 'en' ? '.' : ',') + ' km' : Math.round(d) + ' m');
  const signHtml = '<div class="pl"><b></b><i></i><span>➜</span></div><div class="post"></div>';
  function signText(el, txt, d, key) { if (el._k !== key) { el._k = key; el.querySelector('b').textContent = txt; el.querySelector('i').textContent = '· ' + d; } }
  function slow(g) {
    const p = g.player;
    // the goal, the trail, the sign
    S.goal = goalOf(g);
    S.pts.length = 0; S.sign = null; S.forks.length = 0; S.soleN = 0; S.onPath = false;
    if (S.goal) {
      const dx = S.goal.x - p.pos[0], dz = S.goal.z - p.pos[2]; S.goalD = Math.hypot(dx, dz);
      if (opt(g, 'goalTrail')) {
        const on = trailOn(g), way = on && D.paths && S.goalD > 2.5 ? pathFor(g, p, S.goal) : null;
        const tr = way ? D.trailPath(way) : D.trail(p.pos[0], p.pos[2], S.goal.x, S.goal.z); for (const q of tr) S.pts.push(q);
        S.onPath = !!way;
        if (on && S.pts.length && D.decals) buildSoles(g, Math.atan2(dx, -dz));
        const txt = S.goal.label || T('g.ux.sign');
        if (way && S.goalD > 20) { for (const f of D.forks(way, D.PATH_REACH)) { const ox = Math.cos(f.h) * 1.1 * f.dir, oz = Math.sin(f.h) * 1.1 * f.dir; S.forks.push({ x: f.x - ox, z: f.z - oz, y: (fin(f.y) ? f.y : groundY(g, f.x, f.z, p.pos[1])) + 1.9, s: f.s, dir: f.dir }); } }
        if (D.sign(S.goalD)) {
          let x, z, y;
          const last = way && S.pts.length ? S.pts[S.pts.length - 1] : null;
          if (last) { x = last.x + Math.cos(last.h) * 0.9; z = last.z + Math.sin(last.h) * 0.9; y = (last.y === undefined ? groundY(g, x, z, p.pos[1]) : last.y) + 1.9; }
          else { const L = S.goalD || 1; x = p.pos[0] + dx / L * D.TRAIL_TO + dz / L * 0.9; z = p.pos[2] + dz / L * D.TRAIL_TO - dx / L * 0.9; y = groundY(g, x, z, p.pos[1]) + 1.9; }
          const near = S.forks.some(f => Math.hypot(f.x - x, f.z - z) < 5);
          if (!near) {
            S.sign = { x, z, y };
            if (!S.signEl) S.signEl = mk('div', 'dgsign', 'dgsign', signHtml);
            signText(S.signEl, txt, fmtD(S.goalD), txt + fmtD(S.goalD));
          }
        }
        for (let i = 0; i < S.forks.length; i++) {
          const f = S.forks[i]; if (!S.forkEls[i]) { const e = mk('div', '', 'dgsign fork', signHtml); e._on = false; S.forkEls.push(e); }
          const e = S.forkEls[i], d = fmtD(Math.max(0, S.goalD - f.s)); e.classList.toggle('l', f.dir < 0); signText(e, txt, d, txt + d);
        }
      }
    }

    if (S.sign) S.sign.occ = hidden(g, S.sign);
    for (const f of S.forks) f.occ = hidden(g, f);
    // the rose
    const roseOn = !!opt(g, 'mapRose') && g.settings.minimap !== false && !g.hideHud && !g.photo;
    if (roseOn !== S.roseOn) { S.roseOn = roseOn; document.body.classList.toggle('dg-rose', roseOn); if (S.roseEl) S.roseEl.style.display = roseOn ? '' : 'none'; if (g.map) g.map.shown = undefined; }
    if (roseOn) {
      if (!S.roseEl) {
        S.roseEl = mk('div', 'dgrose', '', '<div class="ring">' + ['n', 'e', 's', 'w'].map((k, i) => `<span class="${k}" style="transform:rotate(${i * 90}deg) translateY(-${'calc(32px*var(--ux-scale,1) - 9px)'}) rotate(${-i * 90}deg)">${esc(T('g.ux.rose.' + (k === 'n' ? 'n' : k)))}</span>`).join('') + '</div><div class="tick goal"><i>✦</i></div><div class="tick wp"><i>◆</i></div><div class="me"></div>');
        S.roseEl.setAttribute('aria-hidden', 'true');
      }
      const ring = S.roseEl.firstChild, yaw = p.yaw || 0, deg = (r) => ((r * 180 / Math.PI) % 360).toFixed(0);
      const gT = S.roseEl.querySelector('.goal'), wT = S.roseEl.querySelector('.wp');
      const ga = S.goal ? Math.atan2(S.goal.x - p.pos[0], -(S.goal.z - p.pos[2])) : null;
      const gad = g.gadgets; let best = null, bd = 1e18;
      if (gad && gad.waypoints) for (const wp of gad.waypoints) { const d = (wp.x - p.pos[0]) ** 2 + (wp.z - p.pos[2]) ** 2; if (d < bd) { bd = d; best = wp; } }
      const wa = best ? Math.atan2(best.x - p.pos[0], -(best.z - p.pos[2])) : null, k = deg(yaw);
      const key = k + '|' + (ga === null ? '-' : deg(ga + yaw)) + '|' + (wa === null ? '-' : deg(wa + yaw));
      if (key !== S.roseK) {   // (written only when it turned a degree)
        S.roseK = key;
        ring.style.transform = 'rotate(' + k + 'deg)';
        for (const sp of ring.children) { const i = ['n', 'e', 's', 'w'].indexOf(sp.className); sp.style.transform = `rotate(${i * 90}deg) translateY(calc(-32px*var(--ux-scale,1) + 9px)) rotate(${-i * 90 - (+k)}deg)`; }
        if (ga !== null) { gT.style.display = 'block'; gT.style.transform = 'rotate(' + deg(ga + yaw) + 'deg)'; } else gT.style.display = 'none';
        if (wa !== null) { wT.style.display = 'block'; wT.style.transform = 'rotate(' + deg(wa + yaw) + 'deg)'; } else wT.style.display = 'none';
      }
      if (S.goal) S.roseEl.title = T('g.ux.rose.goal', { name: S.goal.label || '', d: fmtD(S.goalD) });
    }
    // the vitals
    const vm = opt(g, 'vitals'), surv = p.mode === 'survival', vitOn = vm !== 'bars' && surv && !g.hideHud;
    const mx = p.maxHealth || 20, hp = clamp((p.health === undefined ? mx : p.health) / mx, 0, 1), food = clamp((p.food === undefined ? 20 : p.food) / 20, 0, 1), air = clamp((p.air === undefined ? 300 : p.air) / 300, 0, 1);
    const hideBars = vm === 'world' && surv;
    if (hideBars !== S.vitOn) { S.vitOn = hideBars; document.body.classList.toggle('dg-vit', hideBars); }
    const st = $('stats'); if (st) { const dz = hp < 0.3 || air < 0.3; if (S.dz !== dz) { S.dz = dz; st.classList.toggle('dg-danger', dz); } }
    const v = vitOn ? D.vitals(hp, food, air) : { a: 0, kind: null, breath: false };
    if (!S.vigEl && v.a > 0) S.vigEl = mk('div', 'dgvig', '', '', document.getElementById('game') || document.body);
    if (S.vigEl && (v.a !== S.vig || v.kind !== S.vigKind)) {
      S.vig = v.a; S.vigKind = v.kind;
      S.vigEl.style.setProperty('--dgv', v.kind === 'hungry' ? 'rgba(70,52,20,.92)' : v.kind === 'air' ? 'rgba(10,40,80,.92)' : 'rgba(80,0,10,.92)');
      S.vigEl.style.opacity = String(v.a);
    }
    if (v.breath) { if ((S.breathT -= 0.25) <= 0) { S.breathT = 2.8 + 1.4 * hp; breath(g, hp); } } else S.breathT = 0.5;
    // the satchel
    const sat = !!opt(g, 'satchel'); if (sat !== S.satOn) { S.satOn = sat; document.body.classList.toggle('dg-satchel', sat); }
  }
  // a quiet breath: band-passed noise, in and out (our own synth)
  let noiseBuf = null;
  function noise(c) { if (!noiseBuf) { noiseBuf = c.createBuffer(1, Math.floor(c.sampleRate * 1.2), c.sampleRate); const d = noiseBuf.getChannelData(0); let s = 1234567; for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = (s / 2147483647) * 2 - 1; } } return noiseBuf; }
  function breath(g, hp) {
    const A = g.audio, c = A && A.ctx; if (!c || !A.sfx || c.state !== 'running') return;
    try {
      noise(c);
      const t0 = c.currentTime + 0.02, vol = 0.05 + 0.07 * clamp(1 - hp / 0.35, 0, 1);
      for (const [at, dur, f] of [[0, 0.55, 900], [0.75, 0.7, 620]]) {
        const src = c.createBufferSource(); src.buffer = noiseBuf;
        const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 0.8;
        const gn = c.createGain(); gn.gain.setValueAtTime(0, t0 + at); gn.gain.linearRampToValueAtTime(vol, t0 + at + dur * 0.4); gn.gain.linearRampToValueAtTime(0, t0 + at + dur);
        src.connect(bp); bp.connect(gn); gn.connect(A.sfx); src.start(t0 + at); src.stop(t0 + at + dur + 0.05);
      }
    } catch (e) { /* no sound: the edge says it */ }
  }
  // a page turns: a short soft rustle (the same noise, high-passed)
  function rustle(g) {
    const A = g.audio, c = A && A.ctx; if (!c || !A.sfx || c.state !== 'running') return;
    try {
      noise(c);
      const t0 = c.currentTime + 0.01, src = c.createBufferSource(); src.buffer = noiseBuf;
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2200;
      const gn = c.createGain(); gn.gain.setValueAtTime(0, t0); gn.gain.linearRampToValueAtTime(0.06, t0 + 0.08); gn.gain.exponentialRampToValueAtTime(0.001, t0 + 0.38);
      src.connect(hp); hp.connect(gn); gn.connect(A.sfx); src.start(t0, 0.2); src.stop(t0 + 0.4);
    } catch (e) { /* silent pages */ }
  }
  // hurt / heal: a gentle pulse (the a11y limiter decides)
  function pulse(kind) {
    if (!S.pulseEl) S.pulseEl = mk('div', 'dgpulse', '', '', document.getElementById('game') || document.body);
    const A = VR.A11y; if (A && A.flash && !A.flash('dgpulse', 1)) return;
    const e = S.pulseEl;
    e.style.setProperty('--dgp', kind === 'heal' ? 'rgba(200,235,255,.75)' : 'rgba(120,8,18,.85)');
    e.style.setProperty('--dgpa', kind === 'heal' ? '.22' : '.3');
    e.classList.remove('go'); void e.offsetWidth; e.classList.add('go');
  }
  D.pulse = pulse;

  D.tick = function (g, dt) {
    if (!g || g.state !== 'play' || !g.player) return;
    const t0 = now(), p = g.player;
    style(); if (!S.hooked) { S.hooked = true; if (D.hookBook) D.hookBook(); }
    if (g.world !== S.world) { S.world = g.world; S.hp = -1; S.pts.length = 0; }
    // hurt / heal by the health's change (survival)
    if (p.mode === 'survival' && opt(g, 'vitals') !== 'bars') {
      const h = p.health === undefined ? 20 : p.health;
      if (S.hp >= 0 && h !== S.hp && !p.dead) pulse(h < S.hp ? 'hurt' : 'heal');
      S.hp = h;
    } else S.hp = -1;
    // (4 Hz of real time: the game's dt is clamped, a slow frame must not stall it)
    if (t0 - S.acc >= 250) { S.acc = t0; try { slow(g); } catch (e) { if (!D.warned) { D.warned = true; console.warn('diegetic', e); } } }
    trailFrame(g, dt);
    signFrame(g);
    const ms = now() - t0, C = D.cost; C.frames++; C.ms += ms; if (ms > C.worst) C.worst = ms;
  };
  D.costPerFrame = () => (D.cost.frames ? D.cost.ms / D.cost.frames : 0);
  D.resetCost = () => { D.cost.frames = 0; D.cost.ms = 0; D.cost.worst = 0; D.cost.spawns = 0; };
  // one hook: after the fading HUD (game.js calls it every play frame)
  const HF = VR.HudFade;
  if (HF && HF.tick && !HF.tick.__dg) { const ht = HF.tick; HF.tick = function (g, dt) { const r = ht.apply(this, arguments); try { D.tick(g, dt); } catch (e) { /* the frame goes on */ } return r; }; HF.tick.__dg = true; }
  // the minimap stays away while the rose shows (map.js's update shows it on change)
  if (VR.MapView && VR.MapView.prototype && !VR.MapView.prototype.update.__dg) {
    const MU = VR.MapView.prototype.update;
    VR.MapView.prototype.update = function (dt) { if (S.roseOn) { if (this.shown !== false) { this.shown = false; this.mini.style.display = 'none'; this.compass.style.display = 'none'; } return; } return MU.apply(this, arguments); };
    VR.MapView.prototype.update.__dg = true;
  }

  // ---------------------------------------------------------------- Funke as a compass
  const F = VR.Funke;
  if (F && F.Actor && !F.Actor.prototype.__dg) {
    const AP = F.Actor.prototype; AP.__dg = true;
    const pl = AP.place;
    AP.place = function (T0) {
      const r = pl.apply(this, arguments);
      try {
        const g = this.g, gl = S.goal;
        if (gl && opt(g, 'goalTrail') && !this.line && !(this.wayT > 0) && !this.ph && !this.foe && !this.inVehicle()) {
          const P = g.player.pos, dx = gl.x - P[0], dz = gl.z - P[2], L = Math.hypot(dx, dz);
          if (L > 4) {
            const A = this.anchor; A[0] += dx / L * 0.55; A[2] += dz / L * 0.55;
            const Pp = g.particles;
            if (Pp && ((g.settings && g.settings.particles) | 0) > 0 && (this._dgT = (this._dgT || 0) - 1) <= 0) {
              this._dgT = 9;
              PO.alpha = 0.9; PO.size = 0.05;
              Pp.spawn(this.pos[0], this.pos[1], this.pos[2], dx / L * 0.9, 0.05, dz / L * 0.9, PO); D.cost.spawns++;
            }
          }
        }
      } catch (e) { /* it flies on */ }
      return r;
    };
  }

  // ---------------------------------------------------------------- the radial
  const R = D.R = { open: false, sel: -1, vx: 0, vy: 0, src: null, padT: 0, el: null };
  function radialEl() {
    if (R.el) return R.el;
    style();
    const e = mk('div', 'dgradial', '', '<div class="disc"></div><div class="lab"></div>', document.getElementById('game') || document.body);
    e.setAttribute('role', 'menu'); e.setAttribute('aria-label', T('g.ux.radial'));
    const n = D.RADIAL.length;
    D.RADIAL.forEach((it, i) => {
      const a = i / n * Math.PI * 2, b = document.createElement('div'); b.className = 'it'; b.setAttribute('role', 'menuitem'); b.setAttribute('aria-label', T(it.lab));
      b.style.left = (50 + Math.sin(a) * 36).toFixed(2) + '%'; b.style.top = (50 - Math.cos(a) * 36).toFixed(2) + '%'; b.textContent = it.ico; e.appendChild(b);
    });
    return (R.el = e);
  }
  function radialShow(on, src) {
    const e = radialEl(); R.open = on; R.src = on ? src : null;
    if (on) { R.sel = -1; R.vx = R.vy = 0; draw(); }
    e.classList.toggle('on', on);
  }
  function draw() {
    const e = R.el; if (!e) return;
    const its = e.querySelectorAll('.it'); its.forEach((b, i) => b.classList.toggle('sel', i === R.sel));
    const lab = e.querySelector('.lab'), t = R.sel >= 0 ? T(D.RADIAL[R.sel].lab) : T('g.ux.r.none');
    if (lab.textContent !== t) lab.textContent = t;
  }
  D.radialDo = function (g, id) {
    switch (id) {
      case 'build': return !!(VR.Bauhand && VR.Bauhand.open && VR.Bauhand.open());
      case 'map': return !!(g.map && g.map.openBig && (g.map.openBig(), true));
      case 'book': return !!(VR.Wander && VR.Wander.open && VR.Wander.open(g));
      case 'photo': return !!(g.photoMode && (g.photoMode(true), true));
      case 'funke': return !!(VR.Funke && VR.Funke.ask && VR.Funke.ask(g));
      case 'journal': return !!(VR.Quests && VR.Quests.journal && VR.Quests.journal()) || !!(VR.Wander && VR.Wander.open && VR.Wander.open(g));
      case 'wave': case 'here': {
        const K = VR.Konvoi, sent = !!(K && K.emote && K.emote(id));
        const p = g.player, Pp = g.particles;
        if (Pp && p) for (let i = 0; i < 10; i++) Pp.spawn(p.pos[0] + (Math.random() - 0.5) * 0.6, p.pos[1] + 2.1, p.pos[2] + (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.8, 1.2 + Math.random(), (Math.random() - 0.5) * 0.8, PL);
        if (!sent && g.ui && g.ui.toast) g.ui.toast(D.RADIAL.find(r => r.id === id).ico, T(id === 'wave' ? 'g.ux.wave' : 'g.ux.here'), null);
        if (id === 'here' && !sent && g.gadgets && g.gadgets.addWaypoint && p) { try { g.gadgets.addWaypoint(Math.floor(p.pos[0]), Math.floor(p.pos[1]), Math.floor(p.pos[2])); } catch (e) { /* the emote alone */ } }
        return true;
      }
    }
    return false;
  };
  function radialClose(g, doIt) {
    const id = R.sel >= 0 ? D.RADIAL[R.sel].id : null;
    radialShow(false);
    if (doIt && id && g) { try { D.radialDo(g, id); } catch (e) { console.warn('radial', e); } }
  }
  D.radialOpen = (src) => radialShow(true, src || 'key');
  D.radialClose = (doIt) => radialClose(VR.game, doIt);
  const canRadial = (g) => !!(g && g.state === 'play' && g.player && !(g.ui && (g.ui.screen && g.ui.screen !== 'hud' || g.ui.typing)) && opt(g, 'radial') && !g.flight);
  // the input: while the ring is open the look and the wheel pick (and do not turn the view or the hotbar)
  const IN = VR.Input;
  if (IN && IN.prototype && IN.prototype.beginFrame && !IN.prototype.beginFrame.__dg) {
    const bf = IN.prototype.beginFrame;
    IN.prototype.beginFrame = function (dt) {
      const r = bf.apply(this, arguments);
      try {
        const g = VR.game, pad = this.pad;
        // the pad: D-pad up held 0.25 s
        const up = !!(pad && pad.connected && pad.buttons && pad.buttons[12]);
        if (up && canRadial(g)) { R.padT += dt || 0.016; if (!R.open && R.padT > 0.25) radialShow(true, 'pad'); } else R.padT = 0;
        if (R.open && R.src === 'pad' && !up) radialClose(g, true);
        if (R.open) {
          const m = this.mouse;
          if (R.src === 'pad' && pad && pad.connected) { const s = D.pick(pad.look[0], pad.look[1], D.RADIAL.length); if (s >= 0) R.sel = s; m.dx = 0; m.dy = 0; }
          else {
            R.vx = clamp(R.vx + m.dx * 0.012, -1.2, 1.2); R.vy = clamp(R.vy + m.dy * 0.012, -1.2, 1.2);
            const s = D.pick(R.vx, R.vy, D.RADIAL.length); if (s >= 0) R.sel = s;
            if (m.wheel) { R.sel = D.wheelStep(R.sel, m.wheel, D.RADIAL.length); const a = R.sel / D.RADIAL.length * Math.PI * 2; R.vx = Math.sin(a) * 0.8; R.vy = -Math.cos(a) * 0.8; }
            m.dx = 0; m.dy = 0;
          }
          m.wheel = 0; draw();
        }
      } catch (e) { /* the input goes on */ }
      return r;
    };
    IN.prototype.beginFrame.__dg = true;
  }
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Tab' || e.repeat) return;
    const g = VR.game; if (!canRadial(g)) return;
    e.preventDefault(); radialShow(true, 'key');
  }, true);
  window.addEventListener('keyup', (e) => { if (e.code === 'Tab' && R.open && R.src === 'key') { e.preventDefault(); radialClose(VR.game, true); } }, true);
  window.addEventListener('blur', () => { if (R.open) radialShow(false); });

  // ---------------------------------------------------------------- the Wanderbuch as a book
  let W = VR.Wander;
  const B = D.book = { page: 0, sel: null };
  // f-ux2: two sections a page, each with a strip of ink doodles of what you found (the newest first, ≤ 5)
  function doodles(g, page) {
    const Bk = (W && W.book && W.book(g.meta)) || {}, src = Bk[page] || {};
    let ids = page === 'stickers' ? W.NAMES.filter(n => src[n]) : Object.keys(src);
    ids = ids.slice(-5).reverse();
    const cap = (id) => page === 'places' ? W.placeName(id, typeof src[id] === 'string' ? src[id] : id) : page === 'creatures' ? T('g.wd.cr.' + id) : page === 'recipes' ? T('g.wd.r.' + id) : page === 'stickers' ? T('g.wd.k.' + id) : typeof src[id] === 'string' ? src[id] : id;
    const one = (k, sd, c, i, faint) => `<figure class="dgdood${faint ? ' faint' : ''}" style="--r:${((sd % 9) - 4) * 1.2}deg"><canvas width="112" height="112" data-k="${esc(k)}" data-s="${sd}" data-i="${i}"></canvas><figcaption>${esc(String(c).slice(0, 22))}</figcaption></figure>`;
    if (!ids.length) { const k = D.doodleKind(page, page === 'creatures' ? 'fox' : page === 'stickers' ? 'sign' : page); return `<div class="dgdoods">${one(k, 3, T('g.ux.book.notYet'), 0, true)}</div>`; }
    return `<div class="dgdoods">${ids.map((id, i) => { const sd = D.hsd(page + ':' + id); return one(D.doodleKind(page, id), sd, cap(id), i, false); }).join('')}</div>`;
  }
  D.bookV = 2;   // (1: the f-ux book — one section a page, no doodles; test/ux2_shots.mjs's „before“)
  function bookPages(g, html) {
    const tmp = document.createElement('div'); tmp.innerHTML = html;
    if (D.bookV === 1) return [{ map: true }].concat(Array.prototype.slice.call(tmp.querySelectorAll('.wdsec')).map(s0 => ({ html: s0.outerHTML })), [{ board: true }]);
    const secs = Array.prototype.slice.call(tmp.querySelectorAll('.wdsec')).map((sec, i) => {
      const page = W && W.PAGES ? W.PAGES[i] : null;
      if (page) { const h = sec.querySelector('h3'); if (h) h.insertAdjacentHTML('afterend', doodles(g, page)); }
      return sec.outerHTML;
    });
    return D.pairPages(secs);
  }
  // the pen: wobbly strokes in sepia ink, a second fainter pass a hair off (a sketch, not a vector), a light wash under
  const WASH = { house: '#d9a066', tower: '#a8a29a', tree: '#8fb46a', person: '#d99a7a', fox: '#e08a3a', rabbit: '#c8b8a0', dog: '#c89a6a', pup: '#9ad0e0', pot: '#c8925a', cart: '#b88a5a', basket: '#d0a860', note: '#a0a0d0', kite: '#e07060', rainbow: '#e0b0d0', mushroom: '#e07a6a', cairn: '#a0a098', gate: '#d0705a', scroll: '#e0d0a0', signpost: '#b8905a', star: '#f0d060', lantern: '#f0a050', well: '#8ab0d0' };
  function inkDoodle(cv) {
    const x = cv.getContext && cv.getContext('2d'); if (!x) return;
    const w = cv.width, h = cv.height, k = cv.dataset.k, sd = +cv.dataset.s || 1, st = D.doodle(k, sd), pad = 10;
    x.clearRect(0, 0, w, h);
    x.globalAlpha = 0.35; x.fillStyle = WASH[k] || '#d0b080'; x.beginPath(); x.ellipse(w / 2 + (sd % 7) - 3, h / 2 + 6, w * 0.34, h * 0.26, ((sd % 5) - 2) * 0.2, 0, 6.2832); x.fill(); x.globalAlpha = 1;
    x.lineCap = 'round'; x.lineJoin = 'round';
    for (let pass = 0; pass < 2; pass++) {
      x.strokeStyle = pass ? 'rgba(59,42,26,.35)' : 'rgba(52,36,20,.9)'; x.lineWidth = pass ? 1.2 : 2.1;
      const ox = pass ? 1.1 : 0, oy = pass ? -0.8 : 0;
      for (const sk of st) { x.beginPath(); for (let i = 0; i < sk.length; i++) { const X = pad + sk[i][0] * (w - 2 * pad) + ox, Y = pad + sk[i][1] * (h - 2 * pad) + oy; i ? x.lineTo(X, Y) : x.moveTo(X, Y); } x.stroke(); }
    }
  }
  function drawMap(g, cv) {
    const M = g.map, x = cv.getContext('2d'); if (!x) return false;
    const w = cv.width, h = cv.height;
    x.fillStyle = '#efe0bf'; x.fillRect(0, 0, w, h);
    if (M && M.renderBig && M.big) {
      const c0 = M.center, s0 = M.scale;
      const rd = (g.world && g.world.renderDist) || (g.settings && g.settings.renderDist) || 8; B.mapScale = clamp(rd * 16 * 2.2 / 640, 0.25, 2);
      try { M.center = [g.player.pos[0], g.player.pos[2]]; M.scale = B.mapScale; M.renderBig(); } finally { M.center = c0; M.scale = s0; }
      try { x.filter = 'sepia(0.9) saturate(0.55) contrast(0.92) brightness(1.08)'; } catch (e) { /* no filter: the plain colours */ }
      x.globalAlpha = 0.92; x.drawImage(M.big, 0, 0, w, h); x.globalAlpha = 1; try { x.filter = 'none'; } catch (e) { /* — */ }
      // the land not seen yet stays paper (the map's dark checker → parchment, a few pencil dots)
      try {
        const im = x.getImageData(0, 0, w, h), d = im.data;
        for (let i = 0, n = 0; i < d.length; i += 4, n++) if (d[i] + d[i + 1] + d[i + 2] < 150) { const dot = ((n * 2654435761) >>> 0) % 97 === 0; d[i] = dot ? 150 : 239; d[i + 1] = dot ? 120 : 224; d[i + 2] = dot ? 90 : 191; }
        x.putImageData(im, 0, 0);
      } catch (e) { /* a tainted canvas never happens here; the map stays as drawn */ }
    } else { x.fillStyle = '#6a3d1c'; x.font = 'italic 16px Georgia,serif'; x.textAlign = 'center'; x.fillText(T('g.ux.book.nomap'), w / 2, h / 2); return true; }
    // ink: a wobbly frame, the hatched edge, the rose, you
    x.strokeStyle = 'rgba(59,42,26,.75)'; x.lineWidth = 2.2; x.beginPath();
    for (let i = 0; i <= 80; i++) { const u = i / 80, j = Math.sin(i * 1.7) * 1.6; const P = u < 0.25 ? [8 + u * 4 * (w - 16), 8 + j] : u < 0.5 ? [w - 8 + j, 8 + (u - 0.25) * 4 * (h - 16)] : u < 0.75 ? [w - 8 - (u - 0.5) * 4 * (w - 16), h - 8 + j] : [8 + j, h - 8 - (u - 0.75) * 4 * (h - 16)]; i ? x.lineTo(P[0], P[1]) : x.moveTo(P[0], P[1]); }
    x.stroke();
    const cx = w - 42, cy = 42; x.fillStyle = 'rgba(59,42,26,.8)'; x.beginPath(); x.moveTo(cx, cy - 26); x.lineTo(cx + 6, cy); x.lineTo(cx, cy + 26); x.lineTo(cx - 6, cy); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(cx - 22, cy); x.lineTo(cx, cy + 5); x.lineTo(cx + 22, cy); x.lineTo(cx, cy - 5); x.closePath(); x.globalAlpha = 0.5; x.fill(); x.globalAlpha = 1;
    x.font = 'italic 700 13px Georgia,serif'; x.textAlign = 'center'; x.fillText(T('g.ux.rose.n'), cx, cy - 31);
    x.strokeStyle = '#9b2a1a'; x.lineWidth = 3; x.beginPath(); x.moveTo(w / 2 - 7, h / 2 - 7); x.lineTo(w / 2 + 7, h / 2 + 7); x.moveTo(w / 2 + 7, h / 2 - 7); x.lineTo(w / 2 - 7, h / 2 + 7); x.stroke();
    x.fillStyle = '#9b2a1a'; x.font = 'italic 13px Georgia,serif'; x.fillText(T('g.ux.book.you'), w / 2, h / 2 + 22);
    if (S.goal) {
      const k = w / (640 * (B.mapScale || 2)), gx = w / 2 + (S.goal.x - g.player.pos[0]) * k, gy = h / 2 + (S.goal.z - g.player.pos[2]) * k;
      x.setLineDash([4, 5]); x.strokeStyle = 'rgba(155,42,26,.7)'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(w / 2, h / 2); x.lineTo(clamp(gx, 12, w - 12), clamp(gy, 12, h - 12)); x.stroke(); x.setLineDash([]);
      x.fillStyle = '#b8742a'; x.font = '18px Georgia,serif'; x.fillText('✦', clamp(gx, 12, w - 12), clamp(gy, 12, h - 12) + 6);
    }
    return true;
  }
  function pageHtml(g, pg, i) {
    if (!pg) return '';
    const num = `<div class="dgnum">— ${i + 1} —</div>`;
    if (pg.map) return `<h3>${esc(T('g.ux.book.map'))}</h3><div class="note">${esc(T('g.ux.book.mapNote'))}</div><canvas class="dgmap" width="420" height="420"></canvas>${num}`;
    if (pg.board) {
      const Bk = W.book(g.meta) || {}, have = W.NAMES.filter(n => Bk.stickers && Bk.stickers[n]);
      const board = (Array.isArray(Bk.board) ? Bk.board : []).map((s, j) => (W.KINDS[s[0]] ? `<span class="stk" data-j="${j}" style="left:${+s[1]}%;top:${+s[2]}%;--r:${+s[3]}deg">${W.KINDS[s[0]].ico}</span>` : '')).join('');
      return `<h3>${esc(T('g.ux.book.board'))}</h3><div class="note">${esc(T('g.ux.book.boardNote'))}</div><div class="dgboard">${board}</div><div class="note">${esc(T('g.ux.book.tray'))}</div><div class="dgtray">${have.map(n => `<button type="button" data-n="${esc(n)}" class="${B.sel === n ? 'on' : ''}" title="${esc(T('g.wd.k.' + n))}" aria-label="${esc(T('g.wd.k.' + n))}">${W.KINDS[n].ico}</button>`).join('') || `<span class="note">${esc(T('g.wd.none'))}</span>`}</div>${num}`;
    }
    return pg.html + num;
  }
  function bindPage(g, el, pg) {
    el.querySelectorAll('canvas[data-k]').forEach(inkDoodle);
    if (pg.map) { const cv = el.querySelector('canvas'); if (cv) drawMap(g, cv); }
    if (pg.board) {
      el.querySelectorAll('.dgtray button').forEach(b => { b.onclick = () => { B.sel = B.sel === b.dataset.n ? null : b.dataset.n; el.querySelectorAll('.dgtray button').forEach(q => q.classList.toggle('on', q.dataset.n === B.sel)); }; });
      const bd = el.querySelector('.dgboard');
      if (bd) bd.onclick = (e) => {
        const Bk = W.book(g.meta); if (!Bk) return;
        if (!Array.isArray(Bk.board)) Bk.board = [];
        const st = e.target && e.target.classList && e.target.classList.contains('stk') ? e.target : null;
        if (st) { Bk.board.splice(+st.dataset.j, 1); }
        else if (B.sel) { const r = bd.getBoundingClientRect(); const x = clamp((e.clientX - r.left) / Math.max(1, r.width) * 100, 4, 96), y = clamp((e.clientY - r.top) / Math.max(1, r.height) * 100, 6, 94); Bk.board.push([B.sel, +x.toFixed(1), +y.toFixed(1), Math.round((Math.random() - 0.5) * 30)]); if (Bk.board.length > 40) Bk.board.shift(); }
        else return;
        if (g.audio && g.audio.play) g.audio.play('pop');
        try { const p = g.saveMeta && g.saveMeta(); if (p && p.catch) p.catch(() => {}); } catch (e2) { /* the autosave keeps it */ }
        renderBook(g, 0);
      };
    }
  }
  // the board kept valid in a save (never more than 40, only known stickers, numbers in range)
  D.cleanBoard = function (b) { if (!Array.isArray(b)) return []; return b.filter(s => Array.isArray(s) && W && W.KINDS && W.KINDS[s[0]] && fin(+s[1]) && fin(+s[2])).slice(-40).map(s => [s[0], clamp(+s[1], 0, 100), clamp(+s[2], 0, 100), clamp(fin(+s[3]) ? +s[3] : 0, -45, 45)]); };
  function renderBook(g, dir) {
    const s = $('wanderbuch'); if (!s || !B.pages) return;
    const card = s.querySelector('.wdcard'), n = B.pages.length;
    const spread = $('dgspread') || null;
    const L = s.querySelector('.dgpage.l'), Rr = s.querySelector('.dgpage.r');
    if (!L || !Rr) return;
    const i = B.page;
    const paint = () => { L.innerHTML = pageHtml(g, B.pages[i], i); Rr.innerHTML = pageHtml(g, B.pages[i + 1], i + 1); if (B.pages[i]) bindPage(g, L, B.pages[i]); if (B.pages[i + 1]) bindPage(g, Rr, B.pages[i + 1]); };
    const pv = s.querySelector('[data-dg="prev"]'), nx = s.querySelector('[data-dg="next"]');
    if (pv) pv.disabled = i <= 0; if (nx) nx.disabled = i + 2 >= n;
    void card; void spread;
    if (dir && !less(g)) {
      const leaf = document.createElement('div'); leaf.className = 'dgleaf ' + (dir > 0 ? 'fw' : 'bw'); s.querySelector('.dgbook').appendChild(leaf);
      rustle(g);
      setTimeout(paint, 260); setTimeout(() => { if (leaf.parentNode) leaf.parentNode.removeChild(leaf); }, 600);
    } else paint();
  }
  D.turn = function (g, d) { if (!B.pages) return; const n = B.pages.length, np = clamp(B.page + d * 2, 0, Math.max(0, n - 2 + (n % 2))); if (np === B.page) return; B.page = np; renderBook(g, d); };
  function hookBook() {
  W = VR.Wander;
  if (W && W.open && !W.open.__dg) {
    const wo = W.open;
    W.open = function (g) {
      const r = wo.apply(this, arguments);
      try {
        const s = $('wanderbuch'); if (!s) return r;
        if (!opt(g, 'bookStyle')) { s.classList.remove('dgb'); return r; }
        style();
        const p = s.querySelector('.panel'), meta = g.meta; if (!p || !meta) return r;
        const Bk = W.book(meta); if (Bk && Bk.board !== undefined) Bk.board = D.cleanBoard(Bk.board);
        B.pages = bookPages(g, W.html(meta)); if (B.page + 1 >= B.pages.length) B.page = 0;
        s.classList.add('dgb');
        const nx = g.wanderer && g.wanderer.next ? ` · 🏮 ${esc(T('g.wd.next', { place: g.wanderer.next.name }))}` : '';
        p.innerHTML = `<div class="dghead"><h2>📖 ${esc(T('g.wd.book'))}</h2><span class="note">${esc(T('g.wd.bookNote'))}${nx}</span><div class="dgnav"><button type="button" class="btn small" data-dg="prev" aria-label="${esc(T('g.ux.book.prev'))}">◀</button><button type="button" class="btn small" data-dg="next" aria-label="${esc(T('g.ux.book.next'))}">▶</button><button type="button" class="btn small" data-wd="close">${esc(T('g.wd.close'))}</button></div></div><div class="dgbook"><div class="dgpage l"></div><div class="dgpage r"></div></div>`;
        p.querySelector('[data-wd="close"]').onclick = () => W.close(g);
        p.querySelector('[data-dg="prev"]').onclick = () => D.turn(g, -1);
        p.querySelector('[data-dg="next"]').onclick = () => D.turn(g, 1);
        renderBook(g, 0);
      } catch (e) { console.warn('book', e); }
      return r;
    };
    W.open.__dg = true;
    window.addEventListener('keydown', (e) => {
      const g = VR.game; if (!g || !g.ui || g.ui.screen !== 'wanderbuch' || !B.pages) return;
      if (e.code === 'ArrowRight' || e.code === 'PageDown') { e.preventDefault(); D.turn(g, 1); } else if (e.code === 'ArrowLeft' || e.code === 'PageUp') { e.preventDefault(); D.turn(g, -1); }
    }, true);
  }
  }
  D.hookBook = hookBook; hookBook();
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

// ============================================================================
// e-uhr · E1 · Schattenuhr (spec docs/superpowers/specs/2026-11-15-echt.md, plan
// docs/superpowers/plans/2026-11-15-e-uhr.md): sun and moon shadows as TIMES.
//
// The sun and the moon travel ONE fixed arc over the land (arc(s), s = 0 rising … 1 setting; the moon is the sun twelve
// hours later). So everything a point of the world needs to know about its shadows is WHEN the light reaches it: the
// (up to two) intervals of s in which the sun's disc is not hidden — four bytes (r1, e1, r2, e2; s·255; an empty slot
// is r 255, e 0). The worker finds them once per mesh with real rays: exact 3-D voxel rays through a bit volume of
// the 5 × 5 × 3 sections round the section (reach ≥ 32 blocks), and behind it the far field as shadow heights from two
// height maps (the columns' tops at 1 m, the far land at 8 m). The picture then needs no shadow pass and no march per
// pixel: the vertex shader takes the signed time to the nearest shadow edge,
//     d(s) = max(min(s − r1, e1 − s), min(s − r2, e2 − s))          (positive: lit)
// and the fragment shader a clamp of it. Interpolated across a face, the zero line of d IS the shadow edge — exact for
// a straight edge that moves at a constant speed — so per-vertex data draws an edge finer than a block, and it moves
// smoothly. An edge as wide as a fixed span of time is narrow where the shadow moves slowly (a near caster) and wide
// where it moves fast (a far one): the penumbra of a sun with a disc, for nothing.
//
// Pure: the same code in the workers (the bake), on the main thread (the probes' read-out) and in node (the tests).
// ============================================================================
(function (VR) {
  'use strict';
  const SC = VR.SunClock = VR.SunClock || {};

  // ---------------------------------------------------------------- the arc (env.js takes its sun and moon from here)
  // "eternal dusk" (TRAILER.md §2.1): the light circles low — it rises in the east, peaks at 0.42 rad (24°) in the
  // south and sets in the west. th = s·π; the day's clock is tod·2π: the sun is up for th in 0…π, the moon is the sun
  // at th − π.
  SC.EL = 0.42; SC.AZ0 = 0.4;
  SC.arc = function (s, out) {
    const th = s * Math.PI, el = Math.sin(th) * SC.EL, az = th + SC.AZ0, ce = Math.cos(el);
    out[0] = Math.cos(az) * ce; out[1] = Math.sin(el); out[2] = Math.sin(az) * ce;
    return out;
  };
  // the day's clock (tod 0…1) → { s, moon }: the arc parameter of the light that is up. The picture changes lights
  // where the sun stands 0.12 under the horizon (shaders: sunUp), so s runs a little outside 0…1 round dusk and dawn.
  SC.SWITCH_Y = -0.12;
  SC.ofDay = function (tod) {
    const t = ((tod % 1) + 1) % 1, sunY = Math.sin(Math.sin(t * 2 * Math.PI) * SC.EL);
    if (sunY > SC.SWITCH_Y) return { s: t < 0.75 ? t * 2 : t * 2 - 2, moon: false };
    return { s: t * 2 - 1, moon: true };
  };

  // ---------------------------------------------------------------- the clock's four bytes
  SC.EMPTY = (255 | (0 << 8) | (255 << 16) | (0 << 24)) >>> 0;      // never lit
  SC.FULL = (0 | (255 << 8) | (255 << 16) | (0 << 24)) >>> 0;       // lit the whole arc
  SC.pack = function (iv) {   // iv: [[r, e], …] in arc units, any number, any order → the two longest, the earlier first
    let a = null, b = null;
    for (let i = 0; i < iv.length; i++) {
      const r = Math.max(0, Math.min(255, Math.round(iv[i][0] * 255))), e = Math.max(0, Math.min(255, Math.round(iv[i][1] * 255)));
      if (e <= r) continue;
      const q = [r, e];
      if (!a || e - r > a[1] - a[0]) { b = a; a = q; } else if (!b || e - r > b[1] - b[0]) b = q;
    }
    if (a && b && b[0] < a[0]) { const t = a; a = b; b = t; }
    if (!a) return SC.EMPTY;
    return (a[0] | (a[1] << 8) | ((b ? b[0] : 255) << 16) | ((b ? b[1] : 0) << 24)) >>> 0;
  };
  // the signed time to the nearest shadow edge, in arc units (positive: lit) — the shader's formula
  SC.signed = function (u, s) {
    const r1 = (u & 255) / 255, e1 = ((u >>> 8) & 255) / 255, r2 = ((u >>> 16) & 255) / 255, e2 = (u >>> 24) / 255;
    return Math.max(Math.min(s - r1, e1 - s), Math.min(s - r2, e2 - s));
  };
  // how much of the light reaches a point whose clock is u at arc time s (w: half the penumbra's time)
  SC.vis = function (u, s, w) { const x = SC.signed(u, s) / (2 * (w || SC.W)) + 0.5; return x < 0 ? 0 : x > 1 ? 1 : x; };
  SC.W = 0.006;   // the penumbra's half width in arc units: the sun crosses about twice its own disc in it

  // ---------------------------------------------------------------- the bit volume
  // 80 × 48 × 80 cells (x, y, z): the section's 5 × 5 neighbours wide, its own 16 layers and the 32 above (a ray of this
  // low arc rises at most 22 blocks before it leaves sideways). One Uint16 per 16 cells in x: word (y·80 + z)·5 + (x >> 4).
  const VX = SC.VX = 80, VY = SC.VY = 48, VZ = SC.VZ = 80, RW = 5, VPAD = SC.VPAD = 32;
  SC.volumeWords = VY * VZ * RW;
  SC.newVolume = () => new Uint16Array(VY * VZ * RW);
  SC.setBit = (V, x, y, z) => { V[(y * VZ + z) * RW + (x >> 4)] |= 1 << (x & 15); };
  SC.getBit = (V, x, y, z) => (V[(y * VZ + z) * RW + (x >> 4)] >> (x & 15)) & 1;
  // which block states stop the sun (the registry's flags; the columns' shadow heights use the same rule plus slabs,
  // stairs and walls; glass, water, plants, fences and panes let it pass; leaves stop it)
  SC.opaqueTable = function () {
    if (SC._opq && SC._opqN === VR.R.stateCount) return SC._opq;
    const R = VR.R, F = VR.F, SH = VR.SHAPE, T = R.T, n = R.stateCount, O = new Uint8Array(n);
    for (let s = 1; s < n; s++) {
      const f = T.flags[s], sh = T.shape[s];
      if (f & F.FLUID) continue;
      if (f & F.LEAVES) { O[s] = 2; continue; }
      if (f & F.OPAQUE) { O[s] = 1; continue; }
      if ((f & F.SOLID) && !(f & (F.TRANS | F.CUTOUT)) && (sh === SH.SLAB || sh === SH.STAIRS || sh === SH.WALL)) O[s] = 1;
    }
    SC._opq = O; SC._opqN = n;
    return O;
  };

  // ---------------------------------------------------------------- the bake of one section
  // job: { ox, oy, oz (the section's world origin), vol (the bit volume, origin ox − 32, oy, oz − 32),
  //        top, topX0, topZ0, topW (Uint8: each column's top face height, 1 m cells, a square of topW),
  //        far, farX0, farZ0, farW, farCell (Int16: the far land's heights, farCell metres a cell) — far is optional }
  const K = SC.K = 48, BIS = 4, LAT = 5, LSTEP = 4;
  const DIRS = new Float64Array(K * 3), SLOPE = new Float64Array(K), HX = new Float64Array(K), HZ = new Float64Array(K);
  (function () { const d = [0, 0, 0]; for (let k = 0; k < K; k++) { SC.arc((k + 0.5) / K, d); DIRS[k * 3] = d[0]; DIRS[k * 3 + 1] = d[1]; DIRS[k * 3 + 2] = d[2]; const h = Math.hypot(d[0], d[2]); HX[k] = d[0] / h; HZ[k] = d[2] / h; SLOPE[k] = d[1] / h; } })();
  const NS = SC.NS = 24, SKY = new Float64Array(NS * 3);
  (function () { for (let i = 0; i < NS; i++) { const u = (i + 0.5) / NS, ph = i * 2.399963229728653, sn = Math.sqrt(u); SKY[i * 3] = Math.cos(ph) * sn; SKY[i * 3 + 1] = Math.sqrt(1 - u); SKY[i * 3 + 2] = Math.sin(ph) * sn; } })();
  const NB2 = SC.NB2 = 16, SPH = new Float64Array(NB2 * 3);   // E2b: directions over the whole sphere (Fibonacci)
  (function () { for (let i = 0; i < NB2; i++) { const y = 1 - 2 * (i + 0.5) / NB2, r = Math.sqrt(1 - y * y), ph = i * 2.399963229728653; SPH[i * 3] = Math.cos(ph) * r; SPH[i * 3 + 1] = y; SPH[i * 3 + 2] = Math.sin(ph) * r; } })();
  // the block ids the bounce rays read: the 3 × 3 columns round the section (volume x, z 16…63), the volume's 48 layers
  SC.IDW = 48;
  SC.bounceIds = () => new Uint16Array(48 * 48 * 48);
  SC.idSet = (ids, x, y, z, s) => { const X = x + 16, Z = z + 16; if (X >= 0 && Z >= 0 && X < 48 && Z < 48 && y >= 0 && y < 48) ids[(y * 48 + Z) * 48 + X] = s; };
  // the colour of every block state from the textures' averages (the top face's layer), as RGB bytes (the worker's table)
  SC.colorTable = function (avg) {
    const R = VR.R, n = R.stateCount, out = new Uint8Array(n * 3).fill(110);
    if (!avg) return out;
    for (let st = 1; st < n; st++) { const layer = R.T.tex[st * 6 + 2] & 0xfff; if (avg[layer * 4 + 3] > 0.05) { out[st * 3] = Math.min(255, avg[layer * 4] * 255); out[st * 3 + 1] = Math.min(255, avg[layer * 4 + 1] * 255); out[st * 3 + 2] = Math.min(255, avg[layer * 4 + 2] * 255); } }
    return out;
  };
  const NRM = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];   // the mesher's face order
  const _d = [0, 0, 0];

  SC.begin = function (job) {
    const V = job.vol, ox = job.ox, oy = job.oy, oz = job.oz;
    // bricks of 4³: a ray crosses an empty one in a single step
    const BXN = VX >> 2, BYN = VY >> 2, BZN = VZ >> 2, BR = new Uint8Array(BXN * BYN * BZN);
    for (let y = 0; y < VY; y++) for (let z = 0; z < VZ; z++) {
      const row = (y * VZ + z) * RW, b0 = ((y >> 2) * BZN + (z >> 2)) * BXN;
      for (let w = 0; w < RW; w++) { const v = V[row + w]; if (!v) continue; for (let n = 0; n < 4; n++) if ((v >> (n * 4)) & 15) BR[b0 + w * 4 + n] = 1; }
    }
    // … and the height of each 4 × 4 column of cells (the first free layer above its highest set cell): a rising ray
    // above it crosses the whole column in one step
    const CM = new Uint8Array(BXN * BZN);
    for (let by = BYN - 1; by >= 0; by--) for (let bz = 0; bz < BZN; bz++) for (let bx = 0; bx < BXN; bx++) {
      const ci = bz * BXN + bx;
      if (CM[ci] || !BR[(by * BZN + bz) * BXN + bx]) continue;
      for (let y = by * 4 + 3; y >= by * 4; y--) { let hit = false; for (let z = bz * 4; z < bz * 4 + 4 && !hit; z++) if ((V[(y * VZ + z) * RW + (bx >> 2)] >> ((bx & 3) * 4)) & 15) hit = true; if (hit) { CM[ci] = y + 1; break; } }
    }
    // the far field: for the 5 × 5 lattice of the section (every 4 blocks) and every bin, the height under which a
    // point is in the shadow of something beyond the bit volume: max over the columns q along the light's way of
    // H(q) − t·slope (t: the way to q on the ground). Independent of the point's own height, so one number serves a
    // whole column of points.
    const YC = new Float32Array(LAT * LAT * (K + 2));
    const top = job.top, tw = job.topW | 0, tx0 = job.topX0 | 0, tz0 = job.topZ0 | 0;
    const far = job.far || null, fw = job.farW | 0, fx0 = job.farX0 | 0, fz0 = job.farZ0 | 0, fc = job.farCell || 8;
    let hMax = 0;
    if (top) for (let i = 0; i < top.length; i++) if (top[i] > hMax) hMax = top[i];
    if (far) for (let i = 0; i < far.length; i++) if (far[i] > hMax) hMax = far[i];
    const x0 = ox - VPAD, x1 = ox + 16 + VPAD, z0 = oz - VPAD, z1 = oz + 16 + VPAD;
    function farHeight(lx, lz, hx, hz, m) {
      // where the ray leaves the bit volume's ground plan
      let t = 1e9;
      if (hx > 1e-9) t = Math.min(t, (x1 - lx) / hx); else if (hx < -1e-9) t = Math.min(t, (x0 - lx) / hx);
      if (hz > 1e-9) t = Math.min(t, (z1 - lz) / hz); else if (hz < -1e-9) t = Math.min(t, (z0 - lz) / hz);
      let best = -1e9;
      if (top) {
        for (; ; t += 1) {
          if (hMax - m * t <= best) return best;   // nothing farther can reach higher
          const cx = Math.floor(lx + hx * t) - tx0, cz = Math.floor(lz + hz * t) - tz0;
          if (cx < 0 || cz < 0 || cx >= tw || cz >= tw) break;
          const h = top[cz * tw + cx] - m * t;
          if (h > best) best = h;
        }
      }
      if (far) {
        for (; ; t += fc * 0.5) {
          if (hMax - m * t <= best) return best;
          const cx = Math.floor((lx + hx * t - fx0) / fc), cz = Math.floor((lz + hz * t - fz0) / fc);
          if (cx < 0 || cz < 0 || cx >= fw || cz >= fw) break;
          const h = far[cz * fw + cx] - m * t;
          if (h > best) best = h;
        }
      }
      return best;
    }
    if (top || far) {
      for (let lz = 0; lz < LAT; lz++) for (let lx = 0; lx < LAT; lx++) {
        const o = (lz * LAT + lx) * (K + 2), wx = ox + lx * LSTEP, wz = oz + lz * LSTEP;
        for (let k = 0; k < K; k++) YC[o + k + 1] = farHeight(wx, wz, HX[k], HZ[k], Math.max(SLOPE[k], 1e-4));
        YC[o] = YC[o + 1]; YC[o + K + 1] = YC[o + K];   // the ends: the first and the last bin's value
      }
    } else YC.fill(-1e9);
    // the far shadow height at a point of the section (x, z section-local, 0…16) and a bin coordinate f = s·K − 0.5
    function ycrit(x, z, f) {
      let fx = x / LSTEP, fz = z / LSTEP;
      fx = fx < 0 ? 0 : fx > LAT - 1 ? LAT - 1 : fx; fz = fz < 0 ? 0 : fz > LAT - 1 ? LAT - 1 : fz;
      const ix = fx >= LAT - 1 ? LAT - 2 : fx | 0, iz = fz >= LAT - 1 ? LAT - 2 : fz | 0, ax = fx - ix, az = fz - iz;
      let g = f + 1; g = g < 0 ? 0 : g > K + 1 ? K + 1 : g;
      const ik = g >= K + 1 ? K : g | 0, ak = g - ik;
      const o00 = (iz * LAT + ix) * (K + 2) + ik, o10 = o00 + (K + 2), o01 = o00 + LAT * (K + 2), o11 = o01 + (K + 2);
      const a = YC[o00] + (YC[o00 + 1] - YC[o00]) * ak, b = YC[o10] + (YC[o10 + 1] - YC[o10]) * ak;
      const c = YC[o01] + (YC[o01 + 1] - YC[o01]) * ak, e = YC[o11] + (YC[o11 + 1] - YC[o11]) * ak;
      return (a + (b - a) * ax) * (1 - az) + (c + (e - c) * ax) * az;
    }
    // one ray through the bit volume from (px, py, pz) (volume-local) along a unit direction: true when it leaves
    // the volume unhindered. Two levels: empty 4³ bricks in one step, cells inside the others.
    let steps = 0;
    const HIT = [0, 0, 0];   // (the cell a blocked ray hit, volume coordinates — the bounce asks what it was)
    // (e-lampe: with tmax > 0 the ray ends there — a lamp's light: true when nothing hides the lamp's cell TC)
    const TC = [0, 0, 0];
    function ray(px, py, pz, dx, dy, dz, tmax) {
      const E = 1e-4, lim = tmax || 0;
      let x = px + dx * E, y = py + dy * E, z = pz + dz * E, T = E;
      if (y < 0) { if (dy <= 1e-9) return true; const t0 = -y / dy + E; x += dx * t0; y += dy * t0; z += dz * t0; T += t0; }   // (from under the volume's floor: up into it; what lies below is not known)
      const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
      const ix = dx !== 0 ? 1 / Math.abs(dx) : 1e30, iy = dy !== 0 ? 1 / Math.abs(dy) : 1e30, iz = dz !== 0 ? 1 / Math.abs(dz) : 1e30;
      for (let guard = 0; guard < 400; guard++) {
        const cx = Math.floor(x), cy = Math.floor(y), cz = Math.floor(z);
        if (cx < 0 || cy < 0 || cz < 0 || cx >= VX || cy >= VY || cz >= VZ) return true;
        steps++;
        let size = 1, bx = cx, by = cy, bz = cz;
        if (dy > 0 && y >= CM[(cz >> 2) * BXN + (cx >> 2)]) {
          // above everything in this 4 × 4 column and rising: out of the column sideways in one step
          bx = cx & ~3; bz = cz & ~3;
          const tx = (sx > 0 ? bx + 4 - x : x - bx) * ix, tz = (sz > 0 ? bz + 4 - z : z - bz) * iz, t = (tx < tz ? tx : tz) + E;
          x += dx * t; y += dy * t; z += dz * t; T += t;
          if (lim && T >= lim) return true;
          continue;
        }
        if (!BR[((cy >> 2) * BZN + (cz >> 2)) * BXN + (cx >> 2)]) { size = 4; bx = cx & ~3; by = cy & ~3; bz = cz & ~3; }
        else if ((V[(cy * VZ + cz) * RW + (cx >> 4)] >> (cx & 15)) & 1) { if (lim && cx === TC[0] && cy === TC[1] && cz === TC[2]) return true; HIT[0] = cx; HIT[1] = cy; HIT[2] = cz; return false; }
        // to the box's far wall along the ray
        const tx = (sx > 0 ? bx + size - x : x - bx) * ix, ty = (sy > 0 ? by + size - y : y - by) * iy, tz = (sz > 0 ? bz + size - z : z - bz) * iz;
        const t = (tx < ty ? (tx < tz ? tx : tz) : (ty < tz ? ty : tz)) + E;
        x += dx * t; y += dy * t; z += dz * t; T += t;
        if (lim && T >= lim) return true;
      }
      return true;
    }
    // is the point (section-local) lit at arc time s? (the far field first: at a low sun it answers most questions)
    function lit(px, py, pz, s) {
      if (s <= 0 || s >= 1) return false;
      if (py + oy < ycrit(px, pz, s * K - 0.5)) return false;
      SC.arc(s, _d);
      return ray(px + VPAD, py, pz + VPAD, _d[0], _d[1], _d[2]);
    }
    const ST = new Uint8Array(K), IV = [];
    const Q = { o00: 0, o10: 0, o01: 0, o11: 0, w00: 0, w10: 0, w01: 0, w11: 0, wy: 0, vx: 0, vz: 0, py: 0, nx: 0, ny: 0, nz: 0, all: false };
    function bin(k) {
      const dx = DIRS[k * 3], dy = DIRS[k * 3 + 1], dz = DIRS[k * 3 + 2];
      if (!Q.all && Q.nx * dx + Q.ny * dy + Q.nz * dz <= 0.02) return 2;
      if (Q.wy < YC[Q.o00 + k] * Q.w00 + YC[Q.o10 + k] * Q.w10 + YC[Q.o01 + k] * Q.w01 + YC[Q.o11 + k] * Q.w11) return 0;
      return ray(Q.vx, Q.py, Q.vz, dx, dy, dz) ? 1 : 0;
    }
    // the clock of a point with a normal (nx, ny, nz): bins where the face looks away from the light are "don't care"
    // (they take their neighbour's state: no false edge at the terminator; the n·l of the picture is zero there)
    function clock(px, py, pz, nx, ny, nz, all) {
      let any = false;
      // the far field's four lattice corners and weights for this point, once
      let fx = px / LSTEP, fz = pz / LSTEP;
      fx = fx < 0 ? 0 : fx > LAT - 1 ? LAT - 1 : fx; fz = fz < 0 ? 0 : fz > LAT - 1 ? LAT - 1 : fz;
      const ix = fx >= LAT - 1 ? LAT - 2 : fx | 0, iz = fz >= LAT - 1 ? LAT - 2 : fz | 0, ax = fx - ix, az = fz - iz;
      Q.o00 = (iz * LAT + ix) * (K + 2) + 1; Q.o10 = Q.o00 + (K + 2); Q.o01 = Q.o00 + LAT * (K + 2); Q.o11 = Q.o01 + (K + 2);
      Q.w00 = (1 - ax) * (1 - az); Q.w10 = ax * (1 - az); Q.w01 = (1 - ax) * az; Q.w11 = ax * az; Q.wy = py + oy; Q.vx = px + VPAD; Q.vz = pz + VPAD; Q.py = py;
      Q.nx = nx; Q.ny = ny; Q.nz = nz; Q.all = all;
      // coarse to fine: the even bins first, an odd bin only where its two neighbours disagree (a shadow shorter than
      // two bins — a thin far trunk — may slip through; its penumbra would be wider than itself anyway)
      for (let k = 0; k < K; k += 2) ST[k] = bin(k);
      for (let k = 1; k < K; k += 2) { const a = ST[k - 1], b = k + 1 < K ? ST[k + 1] : a; ST[k] = a === b && a !== 2 ? a : bin(k); }
      for (let k = 0; k < K; k++) if (ST[k] === 1) { any = true; break; }
      if (!any) return SC.EMPTY;
      // edges: between two bins that know (bisected), at the arc's ends (bisected), in the middle of a don't-care run
      IV.length = 0;
      let open = -1, prev = 0, prevK = -1;   // prev: the last known state (before the arc: dark, at s = 0)
      const bis = (a, b, aLit) => { for (let i = 0; i < BIS; i++) { const m = (a + b) / 2; if (lit(px, py, pz, m) === aLit) a = m; else b = m; } return (a + b) / 2; };
      for (let k = 0; k <= K; k++) {
        const st = k < K ? ST[k] : 0;
        if (st === 2) continue;
        if (st !== prev) {
          const sa = prevK < 0 ? 0 : (prevK + 0.5) / K, sb = k < K ? (k + 0.5) / K : 1;
          let t;
          if (k - prevK === 1 || (prevK < 0 && k === 0) ) t = (prevK < 0 || k === K) ? (st ? bis(sa, sb, false) : bis(sa, sb, true)) : bis(sa, sb, prev === 1);
          else if (prevK < 0) t = 0;            // the don't-care bins before the first known one take its state
          else if (k === K) t = 1;              // … and those after the last known one too
          else t = (sa + sb) / 2;               // a don't-care run between two known bins: its middle
          if (st === 1) open = t; else if (open >= 0) { IV.push([open, t]); open = -1; }
        }
        prev = st; prevK = k;
      }
      return SC.pack(IV);
    }
    const cache = new Map();
    // E2 · Himmelslicht: the share of the sky a point sees — NS rays, cosine-weighted about straight up (each counts the
    // same), through the bit volume; a ray that leaves it has reached the sky
    function sky(px, py, pz) {
      let n = 0;
      for (let i = 0; i < NS; i++) if (ray(px + VPAD, py, pz + VPAD, SKY[i * 3], SKY[i * 3 + 1], SKY[i * 3 + 2])) n++;
      return n / NS;
    }
    // E2b · Rückstrahlung: what colour the surroundings give back — NB2 rays over the sphere, each that hits a block
    // within the ids' window brings its colour; → [r, g, b] (0…255, the mean over ALL rays: open sky gives nothing)
    const IDS = job.ids || null, COL = job.colors || null, BO = [0, 0, 0];
    function bounce(px, py, pz) {
      BO[0] = BO[1] = BO[2] = 0;
      if (!IDS || !COL) return BO;
      for (let i = 0; i < NB2; i++) {
        if (ray(px + VPAD, py, pz + VPAD, SPH[i * 3], SPH[i * 3 + 1], SPH[i * 3 + 2])) continue;
        const X = HIT[0] - 16, Y = HIT[1], Z = HIT[2] - 16;
        if (X < 0 || Z < 0 || X >= 48 || Z >= 48) { BO[0] += 110; BO[1] += 110; BO[2] += 110; continue; }
        const st = IDS[(Y * 48 + Z) * 48 + X], c = st * 3;
        BO[0] += COL[c]; BO[1] += COL[c + 1]; BO[2] += COL[c + 2];
      }
      BO[0] /= NB2; BO[1] /= NB2; BO[2] /= NB2;
      return BO;
    }
    // E2c · Lampenlicht: the lamps' light at a point with real shadows — every lamp of job.lamps (volume x, y, z and its
    // packed rgb levels) within its reach, a ray to its cell; the light falls off with the straight distance as the flood
    // fill's does with steps (level − d), the brightest per channel wins. → [r, g, b] levels 0…15
    // (only the lamps that can reach the section: within 15 of its box; the brightest first, so the test "could it add
    // anything" ends the search early)
    // (DK: the straight distance counts 1.3 ×, as the flood fill's steps go round — about the mean of |x|+|y|+|z| over
    // |p| in 3-D — so a lamp's pool keeps the size it had, only rounder and with shadows)
    const DK = 1.3;
    let LAMPS = null; const LO = [0, 0, 0];
    if (job.lamps && job.lamps.length) {
      const keep = [];
      for (let i = 0; i < job.lamps.length; i += 4) { const x = job.lamps[i] - VPAD, y = job.lamps[i + 1], z = job.lamps[i + 2] - VPAD; if (x >= -15 && x <= 30 && z >= -15 && z <= 30 && y >= -15 && y <= 30) keep.push(i); }
      const lev = (i) => { const pk = job.lamps[i + 3]; return Math.max((pk >> 8) & 15, (pk >> 4) & 15, pk & 15); };
      keep.sort((a, b) => lev(b) - lev(a));
      LAMPS = new Int32Array(keep.length * 4); keep.forEach((i, k) => { for (let q = 0; q < 4; q++) LAMPS[k * 4 + q] = job.lamps[i + q]; });
    }
    function lamp(px, py, pz) {
      LO[0] = LO[1] = LO[2] = 0;
      if (!LAMPS) return LO;
      const vx = px + VPAD, vz = pz + VPAD;
      for (let i = 0; i < LAMPS.length; i += 4) {
        const lx = LAMPS[i] + 0.5, ly = LAMPS[i + 1] + 0.5, lz = LAMPS[i + 2] + 0.5, pk = LAMPS[i + 3];
        const r = (pk >> 8) & 15, g = (pk >> 4) & 15, b = pk & 15, L = r > g ? (r > b ? r : b) : (g > b ? g : b);
        const dx = lx - vx, dy = ly - py, dz = lz - vz, de = Math.sqrt(dx * dx + dy * dy + dz * dz), d = de * DK;
        if (d >= L) continue;
        if (r - d <= LO[0] && g - d <= LO[1] && b - d <= LO[2]) continue;   // (it could add nothing)
        TC[0] = Math.floor(lx); TC[1] = Math.floor(ly); TC[2] = Math.floor(lz);
        if (de > 0.9 && !ray(vx, py, vz, dx / de, dy / de, dz / de, de)) continue;
        if (r - d > LO[0]) LO[0] = r - d; if (g - d > LO[1]) LO[1] = g - d; if (b - d > LO[2]) LO[2] = b - d;
      }
      return LO;
    }
    const B = {
      sky, bounce, lamp,
      steps: () => steps,
      lit, ycrit,
      // a cube face's corner: the lattice point (x, y, z) of the section (0…16) on a face that looks along d (0…5)
      corner(x, y, z, d) {
        const key = (((y * 17 + z) * 17 + x) * 6 + d);
        let u = cache.get(key);
        if (u === undefined) { const n = NRM[d]; u = clock(x + n[0] * 1e-3, y + n[1] * 1e-3, z + n[2] * 1e-3, n[0], n[1], n[2], false); cache.set(key, u); }
        return u;
      },
      // any point of the section with its normal (a sculpted vertex, a plant's foot): lifted off the surface
      point(px, py, pz, nx, ny, nz, lift) {
        const l = lift === undefined ? 0.6 : lift;
        let x = px + nx * l, y = py + ny * l, z = pz + nz * l;
        // out of a solid start cell (a sculpted surface runs through the cubes' corners): up to a block and a half more
        for (let i = 0; i < 3 && inSolid(x, y, z); i++) { x += nx * 0.5; y += ny * 0.5; z += nz * 0.5; }
        return clock(x, y, z, nx, ny, nz, false);
      },
      // a probe in the air (figures, particles): every bin counts, whatever way a surface would look
      probe(px, py, pz) { return inSolid(px, py, pz) ? SC.EMPTY : clock(px, py, pz, 0, 1, 0, true); },
    };
    function inSolid(x, y, z) { const cx = Math.floor(x) + VPAD, cy = Math.floor(y), cz = Math.floor(z) + VPAD; return cx >= 0 && cy >= 0 && cz >= 0 && cx < VX && cy < VY && cz < VZ && ((V[(cy * VZ + cz) * RW + (cx >> 4)] >> (cx & 15)) & 1) === 1; }
    return B;
  };
  // ---------------------------------------------------------------- the clocks of one section's cells (the clock volume)
  // The picture reads the clocks from a 3-D texture round the eye (renderer: u_clockVol): a face samples the air cell
  // in front of it (its position + normal / 2), filtered between cell centres — the same linear blend of the four bytes
  // a vertex stream would give, without a new vertex format. So a section needs the clocks of its air cells next to a
  // surface (6-neighbours: an opaque cell, the layer under the section in job.below); a solid cell takes the clock of
  // the air above it (or beside it) so the filter never pulls a surface into the dark; an air cell farther from any
  // surface takes a computed neighbour's. → { data: Uint8Array(16³ · 4) (x fastest, then z, then y), n: cells traced }
  SC.bakeSection = function (job) {
    const B = SC.begin(job), V = job.vol, below = job.below || null;
    const out = new Uint8Array(4096 * 4), st = new Uint8Array(4096);   // st: 0 unknown, 1 traced, 2 copied
    const skyB = new Uint8Array(4096);   // (E2: the share of the sky each cell sees, 0…255)
    const env = new Uint8Array(4096 * 4);   // (E2b: rgb the colour given back, a the sky)
    const lampB = job.lamps ? new Uint8Array(4096 * 4) : null;   // (E2c: rgb the lamps' light, levels × 17; a 255 known)
    const solid = (x, y, z) => {
      if (y < 0) { if (!below || x < 0 || x > 15 || z < 0 || z > 15) return 0; return (below[z] >> x) & 1; }
      return (V[(y * VZ + z + VPAD) * RW + ((x + VPAD) >> 4)] >> ((x + VPAD) & 15)) & 1;
    };
    const put = (i, u) => { out[i * 4] = u & 255; out[i * 4 + 1] = (u >>> 8) & 255; out[i * 4 + 2] = (u >>> 16) & 255; out[i * 4 + 3] = u >>> 24; };
    let n = 0;
    for (let y = 0; y < 16; y++) for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      if (solid(x, y, z)) continue;
      if (!(solid(x + 1, y, z) | solid(x - 1, y, z) | solid(x, y + 1, z) | solid(x, y - 1, z) | solid(x, y, z + 1) | solid(x, y, z - 1))) continue;
      const i = (y * 16 + z) * 16 + x;
      put(i, B.probe(x + 0.5, y + 0.5, z + 0.5)); st[i] = 1; n++;
      skyB[i] = Math.round(B.sky(x + 0.5, y + 0.5, z + 0.5) * 255);
      const bo = B.bounce(x + 0.5, y + 0.5, z + 0.5); env[i * 4] = bo[0]; env[i * 4 + 1] = bo[1]; env[i * 4 + 2] = bo[2]; env[i * 4 + 3] = skyB[i];
      if (lampB) { const lo = B.lamp(x + 0.5, y + 0.5, z + 0.5); lampB[i * 4] = Math.round(lo[0] * 17); lampB[i * 4 + 1] = Math.round(lo[1] * 17); lampB[i * 4 + 2] = Math.round(lo[2] * 17); lampB[i * 4 + 3] = 255; }
    }
    // the others: from a traced neighbour (the one above first: a solid cell shows the light on its top)
    const NB = [[0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, -1, 0]];
    for (let y = 0; y < 16; y++) for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const i = (y * 16 + z) * 16 + x; if (st[i]) continue;
      let u = SC.EMPTY, sv = 255, ej = -1;
      for (const d of NB) { const X = x + d[0], Y = y + d[1], Z = z + d[2]; if (X < 0 || Y < 0 || Z < 0 || X > 15 || Y > 15 || Z > 15) continue; const j = (Y * 16 + Z) * 16 + X; if (st[j] === 1) { u = out[j * 4] | (out[j * 4 + 1] << 8) | (out[j * 4 + 2] << 16) | (out[j * 4 + 3] << 24); u >>>= 0; sv = skyB[j]; ej = j; break; } }
      put(i, u); skyB[i] = sv; st[i] = 2;
      if (ej >= 0) { env[i * 4] = env[ej * 4]; env[i * 4 + 1] = env[ej * 4 + 1]; env[i * 4 + 2] = env[ej * 4 + 2]; } env[i * 4 + 3] = sv;
      if (lampB && ej >= 0) { lampB[i * 4] = lampB[ej * 4]; lampB[i * 4 + 1] = lampB[ej * 4 + 1]; lampB[i * 4 + 2] = lampB[ej * 4 + 2]; lampB[i * 4 + 3] = 255; }
    }
    return { data: out, sky: skyB, env, lamp: lampB, n, steps: B.steps() };
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

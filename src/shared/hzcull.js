// ============================================================================
// Horizontschatten (VR.HzCull): welche Abschnitte der Welt hinter Hügeln liegen. Sie werden gar nicht erst gezeichnet,
// das Bild bleibt Pixel für Pixel dasselbe.
// Horizon culling: the 16³ sections hidden behind solid ground, from the camera — not drawn at all, the picture the
// same pixel for pixel. Found in the lab (lab/tools/horizon.js, 27 Nov 2026): over open hills the renderer drew every
// section the cave walk reached in the frustum; from a walker's eye a fifth of them (up to half) lay behind hills, and the
// owner's integrated GPU is bound by exactly that geometry (/kosten: the opaque pass).
//   Occluders: per block column the top run of opaque full blocks [bot, top); a 4 × 4 cell is solid in the band
//     [max of its bots, min of its tops] — eroded by E blocks every way (the smooth ground's drawn surface lies within a
//     block of its cubes: surface nets, round hills) — and 8 × 8 and 16 × 16 cells take the bands' intersection
//     (wider occluders survive the eye's slack below)
//   Polar horizon: BINS directions round the eye (a pseudo-angle: no trigonometry); occluders (keyed by their farthest
//     corner) and targets (keyed by their nearest point) are visited by distance, targets first on a tie; a bin holds
//     ONE interval of blocked slopes — the union of the overlapping intervals of the occluders that cover it wholly (a
//     slope in the union is blocked by one of them); a target is hidden when, in every bin it touches, its whole range
//     of slopes lies inside that interval (+ MARGIN)
//   The eye's slack δ: occluders shrunk by δ every way, targets grown by δ (+ PAD for geometry past the blocks) — then
//     every eye within δ of the eye used sees the same (a ray from eye + v to t, moved by −v, is a ray from the eye to a
//     point of the grown target, blocked inside the shrunk occluder; moved back, the blocking point is inside the
//     occluder). The game recomputes when the eye has moved more than δ.
//   Proof: test/hzcull.js walks voxel rays from eyes within δ to the visible surface of every hidden section — none clear.
// ============================================================================
(function (VR) {
  'use strict';
  const HC = VR.HzCull = VR.HzCull || {};
  HC.RUN = 2;          // the thinnest band an occluder keeps (blocks)
  HC.E = 1;            // the erosion (blocks): the drawn surface of smooth ground lies within a block of its cubes
  HC.BINS = 1024;      // directions round the eye (2048 hid no more in the lab's 21 views and took 40 % longer)
  HC.PAD = 1.25;       // a target grows by this much (blocks) beyond its blocks: geometry past a cell (plants' sway, round crowns, water's waves)
  HC.MARGIN = 0.002;   // slope margin

  // ---- per column: the top opaque run of each block column and each section's content top
  // blocks: H × 256 (index (y << 8) | (z << 4) | x); opaque(state) → bool (opaque AND a full cube)
  // → { run: Int16Array(512) [bot, top) per block column (bot = top = 0: none), top: Int16Array(H >> 4) (the highest
  //   non-air block + 1 within the section, or −1 when it is empty) }
  HC.runs = function (blocks, H, opaque, out) {
    const run = out && out.run ? out.run : new Int16Array(512), NS = H >> 4;
    const top = out && out.top && out.top.length === NS ? out.top : new Int16Array(NS);
    top.fill(-1);
    for (let col = 0; col < 256; col++) {
      let y = H - 1;
      while (y >= 0 && !blocks[(y << 8) | col]) y--;
      if (y < 0) { run[col * 2] = 0; run[col * 2 + 1] = 0; continue; }
      // the content tops: this column's highest block for its section; sections below it count as full (conservative)
      const sy = y >> 4; if (y + 1 > top[sy]) top[sy] = y + 1;
      for (let s2 = 0; s2 < sy; s2++) top[s2] = (s2 + 1) * 16;
      // the top opaque run
      let yo = y; while (yo >= 0 && !opaque(blocks[(yo << 8) | col])) yo--;
      if (yo < 0) { run[col * 2] = 0; run[col * 2 + 1] = 0; continue; }
      let yb = yo; while (yb > 0 && opaque(blocks[((yb - 1) << 8) | col])) yb--;
      run[col * 2] = yb; run[col * 2 + 1] = yo + 1;
    }
    return { run, top };
  };

  // ---- a chunk's occluder cells from its runs and its 8 neighbours' (nb(dx, dz) → their run array, or null: unknown —
  // a cell whose eroded window reaches into an unknown neighbour gets no band)
  // E: the erosion — a number (every way), or [sideways, top, bottom]: the drawn ground of smooth slopes only comes down
  //    at its tops ([0, 1, 0]); round hills, round isles and the soft ground lie within a block every way ([1, 1, 1]);
  //    plain cubes need none (0)
  // → Int16Array(42): 21 bands [bot, top] (16 cells of 4 × 4, then 4 of 8 × 8, then 1 of 16 × 16); top ≤ bot: none
  HC.cells = function (run, nb, Ein, out) {
    const o = out || new Int16Array(42), RUN = HC.RUN;
    const E = typeof Ein === 'number' ? Ein : Ein[0], Et = typeof Ein === 'number' ? Ein : Ein[1], Eb = typeof Ein === 'number' ? Ein : Ein[2];
    for (let ci = 0; ci < 16; ci++) {
      const x0 = (ci & 3) * 4, z0 = (ci >> 2) * 4;
      let bot = -32768, top = 32767, ok = true;
      for (let z = z0 - E; z < z0 + 4 + E && ok; z++) for (let x = x0 - E; x < x0 + 4 + E; x++) {
        const dx = x < 0 ? -1 : x > 15 ? 1 : 0, dz = z < 0 ? -1 : z > 15 ? 1 : 0;
        const r = dx || dz ? nb(dx, dz) : run;
        if (!r) { ok = false; break; }
        const i = (((z & 15) << 4) | (x & 15)) << 1, b = r[i], t = r[i + 1];
        if (t <= b) { ok = false; break; }
        if (b > bot) bot = b; if (t < top) top = t;
      }
      bot += Eb; top -= Et;
      if (!ok || top - bot < RUN) { o[ci * 2] = 0; o[ci * 2 + 1] = -1; } else { o[ci * 2] = bot; o[ci * 2 + 1] = top; }
    }
    // 8 × 8: the four cells' intersection; 16 × 16: the four 8 × 8s'
    const merge = (dst, a, b, c, d) => {
      let bot = -32768, top = 32767;
      for (const k of [a, b, c, d]) { const kb = o[k * 2], kt = o[k * 2 + 1]; if (kt <= kb) { o[dst * 2] = 0; o[dst * 2 + 1] = -1; return; } if (kb > bot) bot = kb; if (kt < top) top = kt; }
      if (top - bot < RUN) { o[dst * 2] = 0; o[dst * 2 + 1] = -1; } else { o[dst * 2] = bot; o[dst * 2 + 1] = top; }
    };
    merge(16, 0, 1, 4, 5); merge(17, 2, 3, 6, 7); merge(18, 8, 9, 12, 13); merge(19, 10, 11, 14, 15);
    merge(20, 16, 17, 18, 19);
    return o;
  };
  // a cell's footprint within its chunk (blocks): [x0, z0, size]
  HC.cellRect = (k) => (k < 16 ? [(k & 3) * 4, (k >> 2) * 4, 4] : k < 20 ? [((k - 16) & 1) * 8, ((k - 16) >> 1) * 8, 8] : [0, 0, 16]);

  // ---- the cull
  // eye [x, y, z]; delta: the eye's slack (blocks); occ: Float64Array [x0, x1, z0, z1, bot, top] × nOcc (world blocks);
  // tgt: Float64Array [x0, x1, y0, y1, z0, z1] × nTgt (the targets' blocks, ungrown); hidden: Uint8Array(nTgt) (out)
  // → the number hidden
  let S = null;   // scratch (kept: the game culls every few frames)
  function scratch(n, nb) {
    if (!S || S.cap < n) { const cap = Math.max(n, S ? S.cap * 2 : 4096); S = { cap, a0: new Float64Array(cap), a1: new Float64Array(cap), lo: new Float64Array(cap), hi: new Float64Array(cap), key: new Float64Array(cap), ord: new Int32Array(cap), tix: new Int32Array(cap), cnt: null, binLo: null, binHi: null, bins: 0 }; }
    if (S.bins !== nb) { S.bins = nb; S.binLo = new Float64Array(nb); S.binHi = new Float64Array(nb); }
    return S;
  }
  // the pseudo-angle of a direction (monotone in the true angle, period 4)
  const pang = (dx, dz) => { const s = Math.abs(dx) + Math.abs(dz); if (s === 0) return 0; const t = dz / s; return dx >= 0 ? (dz >= 0 ? t : 4 + t) : 2 - t; };
  // the smallest arc [a0, a1] (a1 may pass 4) holding a box's four corners seen from (px, pz); false when the eye is in it
  const ARC = [0, 0], PA = [0, 0, 0, 0];
  function arc(px, pz, x0, x1, z0, z1) {
    if (px >= x0 && px <= x1 && pz >= z0 && pz <= z1) return false;
    PA[0] = pang(x0 - px, z0 - pz); PA[1] = pang(x1 - px, z0 - pz); PA[2] = pang(x0 - px, z1 - pz); PA[3] = pang(x1 - px, z1 - pz);
    let best = 9;
    for (let i = 0; i < 4; i++) { let w = 0; for (let j = 0; j < 4; j++) { let d = PA[j] - PA[i]; if (d < 0) d += 4; if (d > w) w = d; } if (w < best) { best = w; ARC[0] = PA[i]; ARC[1] = PA[i] + w; } }
    return true;
  }
  // the direction of a pseudo-angle (its inverse; not normalised)
  const UV = [0, 0];
  function dirOf(p) { p = p % 4; if (p < 0) p += 4; if (p < 1) { UV[0] = 1 - p; UV[1] = p; } else if (p < 2) { UV[0] = 1 - p; UV[1] = 2 - p; } else if (p < 3) { UV[0] = p - 3; UV[1] = 2 - p; } else { UV[0] = p - 3; UV[1] = p - 4; } }
  // the nearest and farthest distance of the part of the box [x0, x1] × [z0, z1] inside the wedge [al, be] seen from
  // (px, pz) — a convex polygon: its farthest point is a vertex (a corner inside the wedge, or where a side ray enters or
  // leaves the box), its nearest a vertex or the foot of the perpendicular onto a side
  const SUB = [0, 0];
  function subDist(px, pz, x0, x1, z0, z1, al, be) {
    let dn = Infinity, df = 0;
    const w = be - al + 1e-9;
    const inArc = (p) => { let q = p - al; q -= Math.floor(q / 4) * 4; return q <= w || q >= 4 - 1e-9; };
    const pt = (x, z) => { const dd = Math.sqrt((x - px) * (x - px) + (z - pz) * (z - pz)); if (dd < dn) dn = dd; if (dd > df) df = dd; };
    if (inArc(pang(x0 - px, z0 - pz))) pt(x0, z0); if (inArc(pang(x1 - px, z0 - pz))) pt(x1, z0);
    if (inArc(pang(x0 - px, z1 - pz))) pt(x0, z1); if (inArc(pang(x1 - px, z1 - pz))) pt(x1, z1);
    for (let r = 0; r < 2; r++) {
      dirOf(r ? be : al); const ux = UV[0], uz = UV[1];
      let t0 = 0, t1 = Infinity;
      if (ux !== 0) { let a = (x0 - px) / ux, b = (x1 - px) / ux; if (a > b) { const t = a; a = b; b = t; } if (a > t0) t0 = a; if (b < t1) t1 = b; } else if (px < x0 || px > x1) continue;
      if (uz !== 0) { let a = (z0 - pz) / uz, b = (z1 - pz) / uz; if (a > b) { const t = a; a = b; b = t; } if (a > t0) t0 = a; if (b < t1) t1 = b; } else if (pz < z0 || pz > z1) continue;
      if (t1 < t0) continue;
      pt(px + ux * t0, pz + uz * t0); pt(px + ux * t1, pz + uz * t1);
    }
    if (pz >= z0 && pz <= z1) { if (inArc(pang(x0 - px, 0))) pt(x0, pz); if (inArc(pang(x1 - px, 0))) pt(x1, pz); }
    if (px >= x0 && px <= x1) { if (inArc(pang(0, z0 - pz))) pt(px, z0); if (inArc(pang(0, z1 - pz))) pt(px, z1); }
    SUB[0] = Math.max(0.25, dn); SUB[1] = df;
    return df > 0 && dn <= df;
  }
  HC.SLICE = 48;   // an occluder's arc is cut into pieces of about this many bins (at most 8): each piece is keyed by its own
                   // farthest point (a wide cell close behind a target's nearest point still counts for the bins it covers
                   // in front) and its slopes use its own distances
  HC.cull = function (eye, delta, occ, nOcc, tgt, nTgt, hidden) {
    const px = eye[0], py = eye[1], pz = eye[2], d = Math.max(0, delta || 0), grow = d + HC.PAD, M = HC.MARGIN;
    const BINS = HC.BINS, bw = 4 / BINS, cap = nOcc * 8 + nTgt;
    const sc = scratch(cap, BINS), a0 = sc.a0, a1 = sc.a1, lo = sc.lo, hi = sc.hi, key = sc.key, ord = sc.ord;
    const tix = sc.tix && sc.tix.length >= cap ? sc.tix : (sc.tix = new Int32Array(Math.max(cap, sc.cap)));
    let dMax = 0, ne = 0;
    // the events: slopes, arcs and distance keys (0.5-block buckets; ×2 + 1 for an occluder, so targets come first)
    for (let i = 0; i < nOcc; i++) {
      const o = i * 6, x0 = occ[o] + d, x1 = occ[o + 1] - d, z0 = occ[o + 2] + d, z1 = occ[o + 3] - d, bot = occ[o + 4] + d, top = occ[o + 5] - d;
      if (x1 <= x0 || z1 <= z0 || top <= bot || !arc(px, pz, x0, x1, z0, z1)) continue;
      // the bins wholly inside the arc, cut into k runs of bins: each piece's arc is its bins' own (no bin straddles two)
      const A0 = ARC[0], A1 = ARC[1], B0 = Math.ceil(A0 / bw), B1 = Math.floor(A1 / bw) - 1, nb = B1 - B0 + 1;
      if (nb < 1) continue;
      const k = Math.max(1, Math.min(8, Math.round(nb / HC.SLICE)));
      for (let q = 0; q < k; q++) {
        const c0 = B0 + Math.floor(nb * q / k), c1 = B0 + Math.floor(nb * (q + 1) / k) - 1;
        if (c1 < c0) continue;
        const al = k === 1 ? A0 : c0 * bw, be = k === 1 ? A1 : (c1 + 1) * bw;
        let dn, df;
        if (k === 1) {
          const dx = Math.max(x0 - px, 0, px - x1), dz = Math.max(z0 - pz, 0, pz - z1); dn = Math.max(0.25, Math.sqrt(dx * dx + dz * dz));
          const fx = Math.max(Math.abs(x0 - px), Math.abs(x1 - px)), fz = Math.max(Math.abs(z0 - pz), Math.abs(z1 - pz)); df = Math.sqrt(fx * fx + fz * fz);
        } else { if (!subDist(px, pz, x0, x1, z0, z1, al, be)) continue; dn = SUB[0]; df = SUB[1]; }
        // the slopes every ray in the piece is blocked in, at every distance of it
        const sTop = (top - py) / (top >= py ? df : dn), sBot = (bot - py) / (bot >= py ? dn : df);
        if (!(sTop > sBot)) continue;
        a0[ne] = al; a1[ne] = be; lo[ne] = sBot; hi[ne] = sTop; key[ne] = df; tix[ne] = -1; ne++;
        if (df > dMax) dMax = df;
      }
    }
    for (let j = 0; j < nTgt; j++) {
      const o = j * 6, x0 = tgt[o] - grow, x1 = tgt[o + 1] + grow, y0 = tgt[o + 2] - grow, y1 = tgt[o + 3] + grow, z0 = tgt[o + 4] - grow, z1 = tgt[o + 5] + grow;
      hidden[j] = 0;
      if (!arc(px, pz, x0, x1, z0, z1)) continue;
      const dx = Math.max(x0 - px, 0, px - x1), dz = Math.max(z0 - pz, 0, pz - z1), dn = Math.max(0.25, Math.sqrt(dx * dx + dz * dz));
      const fx = Math.max(Math.abs(x0 - px), Math.abs(x1 - px)), fz = Math.max(Math.abs(z0 - pz), Math.abs(z1 - pz)), df = Math.sqrt(fx * fx + fz * fz);
      const sHi = (y1 - py) / (y1 >= py ? dn : df), sLo = (y0 - py) / (y0 >= py ? df : dn);
      a0[ne] = ARC[0]; a1[ne] = ARC[1]; lo[ne] = sLo; hi[ne] = sHi; key[ne] = dn; tix[ne] = j; ne++;
      if (dn > dMax) dMax = dn;
    }
    // counting sort by bucket (targets before occluders in a bucket: an occluder in the same half block may reach past
    // the target's nearest point)
    const NB = Math.ceil(dMax * 2) + 2, K = NB * 2;
    if (!sc.cnt || sc.cnt.length < K + 1) sc.cnt = new Int32Array(K + 1);
    const cnt = sc.cnt; cnt.fill(0, 0, K + 1);
    for (let i = 0; i < ne; i++) { const b = Math.floor(key[i] * 2) * 2 + (tix[i] < 0 ? 1 : 0); key[i] = b; cnt[b + 1]++; }
    for (let k = 0; k < K; k++) cnt[k + 1] += cnt[k];
    const m = ne; for (let i = 0; i < ne; i++) ord[cnt[key[i]]++] = i;
    const bL = sc.binLo, bH = sc.binHi; bL.fill(Infinity); bH.fill(-Infinity);
    let nh = 0;
    for (let k = 0; k < m; k++) {
      const i = ord[k], s0 = a0[i], s1 = a1[i], l = lo[i], h = hi[i];
      if (tix[i] < 0) {
        // the bins wholly inside the occluder's arc
        const b0 = Math.ceil(s0 / bw), b1 = Math.floor(s1 / bw) - 1;
        for (let b = b0; b <= b1; b++) {
          const q = b >= BINS ? b - BINS : b, cl = bL[q], ch = bH[q];
          if (ch < cl) { bL[q] = l; bH[q] = h; }                                    // (empty)
          else if (l <= ch && h >= cl) { if (l < cl) bL[q] = l; if (h > ch) bH[q] = h; }   // overlapping: the union
          else if (h > ch) { bL[q] = l; bH[q] = h; }                                // apart: the higher one
        }
      } else {
        const b0 = Math.floor(s0 / bw), b1 = Math.floor(s1 / bw);
        let hid = true;
        for (let b = b0; b <= b1; b++) { const q = b >= BINS ? b - BINS : b; if (!(bL[q] < l - M && bH[q] > h + M)) { hid = false; break; } }
        if (hid) { hidden[tix[i]] = 1; nh++; }
      }
    }
    return nh;
  };
})(VR);

// ============================================================================
// Column-local light computation (worker). Light word: sky<<12 | r<<8 | g<<4 | b
// Sky light: 15 straight down through transparent blocks, -1 per step otherwise.
// Block light: RGB flood fill, -1 per step (+ filter), channels propagate together.
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R;
  // the flood-fill queue (a ring) is kept between columns: a worker lights hundreds of columns in a row, and a fresh
  // 1 MB queue for each was a quarter of its garbage. computeColumnLight never re-enters itself, so one is enough.
  let Q = new Int32Array(1 << 18);
  // a column is 16 × 16 × H (H = blocks.length / 256, a multiple of 16; 256 for generated terrain, taller where the
  // player has built higher — see world.js growColumn)
  VR.computeColumnLight = function (blocks, hasSky) {
    const T = R.T, filter = T.filter, emit = T.emit;
    const N = blocks.length, H = N >> 8, TOP = H - 1;
    const light = new Uint16Array(N);
    let QN = Q.length; while (QN < N * 4) QN <<= 1;
    if (QN !== Q.length) Q = new Int32Array(QN);
    const q = Q, QM = QN - 1;
    let qh = 0, qt = 0;
    const push = (i) => { q[qt] = i; qt = (qt + 1) & QM; };
    // the highest row holding any block: everything above it is open air (full sky, nothing to seed or emit)
    let maxTop = -1;
    for (let y = TOP; y >= 0 && maxTop < 0; y--) { const o = y << 8; for (let c = 0; c < 256; c++) if (blocks[o | c]) { maxTop = y; break; } }
    // ---------- sky ----------
    if (hasSky) {
      if (maxTop < TOP) light.fill(0xf000, (maxTop + 1) << 8);
      for (let col = 0; col < 256; col++) {
        let v = 15;
        for (let y = maxTop; y >= 0; y--) {
          const i = (y << 8) | col;
          const f = filter[blocks[i]];
          if (f >= 15) { v = 0; } else if (f > 0) { v = v - f; if (v < 0) v = 0; }
          if (v === 0) { // rest of column below stays 0 (opaque) unless open again (handled by BFS)
            light[i] = 0;
            if (f >= 15) { for (let yy = y - 1; yy >= 0; yy--) light[(yy << 8) | col] = 0; break; }
            continue;
          }
          light[i] = v << 12;
        }
      }
      // seed voxels whose neighbors are darker (none above the row over the highest block: all its neighbours are open sky)
      const seedTop = Math.min(H, maxTop + 2);
      for (let y = 0; y < seedTop; y++) {
        for (let col = 0; col < 256; col++) {
          const i = (y << 8) | col;
          const s = light[i] >>> 12;
          if (s < 2) continue;
          const x = col & 15, z = col >> 4;
          let need = false;
          if (x > 0 && (light[i - 1] >>> 12) < s - 1 && filter[blocks[i - 1]] < 15) need = true;
          else if (x < 15 && (light[i + 1] >>> 12) < s - 1 && filter[blocks[i + 1]] < 15) need = true;
          else if (z > 0 && (light[i - 16] >>> 12) < s - 1 && filter[blocks[i - 16]] < 15) need = true;
          else if (z < 15 && (light[i + 16] >>> 12) < s - 1 && filter[blocks[i + 16]] < 15) need = true;
          else if (y > 0 && (light[i - 256] >>> 12) < s - 1 && filter[blocks[i - 256]] < 15) need = true;
          if (need) push(i);
        }
      }
      while (qh !== qt) {
        const i = q[qh]; qh = (qh + 1) & QM;
        const s = light[i] >>> 12;
        if (s <= 1) continue;
        const x = i & 15, z = (i >> 4) & 15, y = i >> 8;
        for (let d = 0; d < 6; d++) {
          let n;
          if (d === 0) { if (x === 15) continue; n = i + 1; } else if (d === 1) { if (x === 0) continue; n = i - 1; }
          else if (d === 2) { if (y === TOP) continue; n = i + 256; } else if (d === 3) { if (y === 0) continue; n = i - 256; }
          else if (d === 4) { if (z === 15) continue; n = i + 16; } else { if (z === 0) continue; n = i - 16; }
          const f = filter[blocks[n]];
          if (f >= 15) continue;
          const nv = (d === 3 && s === 15 && f === 0) ? 15 : s - 1 - f;
          if (nv > (light[n] >>> 12)) { light[n] = (light[n] & 0x0fff) | (nv << 12); push(n); }
        }
      }
    }
    // ---------- block light ----------
    qh = qt = 0;
    const emitEnd = (maxTop + 1) << 8;   // air emits nothing
    for (let i = 0; i < emitEnd; i++) {
      const e = emit[blocks[i]];
      if (e) { light[i] = (light[i] & 0xf000) | e; push(i); }
    }
    while (qh !== qt) {
      const i = q[qh]; qh = (qh + 1) & QM;
      const l = light[i];
      const r = (l >> 8) & 15, g = (l >> 4) & 15, b = l & 15;
      if (r <= 1 && g <= 1 && b <= 1) continue;
      const x = i & 15, z = (i >> 4) & 15, y = i >> 8;
      for (let d = 0; d < 6; d++) {
        let n;
        if (d === 0) { if (x === 15) continue; n = i + 1; } else if (d === 1) { if (x === 0) continue; n = i - 1; }
        else if (d === 2) { if (y === TOP) continue; n = i + 256; } else if (d === 3) { if (y === 0) continue; n = i - 256; }
        else if (d === 4) { if (z === 15) continue; n = i + 16; } else { if (z === 0) continue; n = i - 16; }
        const f = filter[blocks[n]];
        if (f >= 15) continue;
        const dec = 1 + f;
        const nl = light[n];
        const nr = r - dec, ng = g - dec, nb = b - dec;
        const cr = (nl >> 8) & 15, cg = (nl >> 4) & 15, cb = nl & 15;
        if (nr > cr || ng > cg || nb > cb) {
          light[n] = (nl & 0xf000) | (Math.max(nr, cr) << 8) | (Math.max(ng, cg) << 4) | Math.max(nb, cb);
          push(n);
        }
      }
    }
    return light;
  };
})(VR);

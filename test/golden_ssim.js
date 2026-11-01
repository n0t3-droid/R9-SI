// w-golden · the picture comparison of the golden shots (test/golden.mjs): a windowed SSIM of two RGB pictures of the
// same size, on luma (Y) and on the two chroma planes (Cb, Cr), implemented here (Wang et al. 2004: the mean, the
// variance and the covariance of 8 × 8 windows, stride 4, the constants C1 = (0.01·255)², C2 = (0.03·255)²).
// Besides the whole picture's mean it reports the worst tile of a G × G grid: a landmark that vanished from a wide view
// (the citadel on the horizon) moves the picture's mean SSIM by little, the tile it stood in by a lot.
//   compare(a, b, w, h, { ch: 3|4, grid: 8 }) → { y, c, tile, tileAt: [i, j], map: Float32Array (luma SSIM a window) , mw, mh }
// (a, b: Uint8Array / Buffer raw pixels; plain node, no dependencies; test/golden_ssim_unit.js pins it)
'use strict';
const WIN = 8, STRIDE = 4, C1 = (0.01 * 255) ** 2, C2 = (0.03 * 255) ** 2;
function planes(px, w, h, ch) {
  const n = w * h, Y = new Float32Array(n), U = new Float32Array(n), V = new Float32Array(n);
  for (let i = 0, k = 0; i < n; i++, k += ch) {
    const r = px[k], g = px[k + 1], b = px[k + 2];
    Y[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    U[i] = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    V[i] = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  }
  return [Y, U, V];
}
// the SSIM of every window: a map of mw × mh
function ssimMap(A, B, w, h) {
  const mw = Math.max(1, Math.floor((w - WIN) / STRIDE) + 1), mh = Math.max(1, Math.floor((h - WIN) / STRIDE) + 1);
  const map = new Float32Array(mw * mh), N = WIN * WIN;
  for (let j = 0; j < mh; j++) for (let i = 0; i < mw; i++) {
    const x0 = i * STRIDE, y0 = j * STRIDE;
    let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
    for (let y = y0; y < y0 + WIN && y < h; y++) for (let x = x0, o = y * w + x0; x < x0 + WIN && x < w; x++, o++) {
      const a = A[o], b = B[o]; sa += a; sb += b; saa += a * a; sbb += b * b; sab += a * b;
    }
    const ma = sa / N, mb = sb / N, va = saa / N - ma * ma, vb = sbb / N - mb * mb, cov = sab / N - ma * mb;
    map[j * mw + i] = ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2));
  }
  return { map, mw, mh };
}
const mean = (m) => { let s = 0; for (let i = 0; i < m.length; i++) s += m[i]; return s / m.length; };
function compare(a, b, w, h, o = {}) {
  const ch = o.ch || 3, G = o.grid || 8;
  if (a.length !== b.length || a.length < w * h * ch) throw new Error('golden_ssim: the pictures differ in size');
  const [Ya, Ua, Va] = planes(a, w, h, ch), [Yb, Ub, Vb] = planes(b, w, h, ch);
  const L = ssimMap(Ya, Yb, w, h), cu = mean(ssimMap(Ua, Ub, w, h).map), cv = mean(ssimMap(Va, Vb, w, h).map);
  // the tiles: the luma windows whose corner lies in the tile (half luma, half chroma would hide a grey change; the
  // landmark's shape is luma)
  let tile = 1, tileAt = [0, 0];
  for (let tj = 0; tj < G; tj++) for (let ti = 0; ti < G; ti++) {
    let s = 0, n = 0;
    for (let j = Math.floor(tj * L.mh / G); j < Math.floor((tj + 1) * L.mh / G); j++) for (let i = Math.floor(ti * L.mw / G); i < Math.floor((ti + 1) * L.mw / G); i++) { s += L.map[j * L.mw + i]; n++; }
    if (n && s / n < tile) { tile = s / n; tileAt = [ti, tj]; }
  }
  return { y: mean(L.map), c: (cu + cv) / 2, tile, tileAt, map: L.map, mw: L.mw, mh: L.mh };
}
// the verdict against a shot's thresholds { y, c, tile }
function verdict(s, t) {
  const bad = [];
  if (s.y < t.y) bad.push(`luma SSIM ${s.y.toFixed(3)} < ${t.y}`);
  if (s.c < t.c) bad.push(`chroma SSIM ${s.c.toFixed(3)} < ${t.c}`);
  if (s.tile < t.tile) bad.push(`worst tile ${s.tile.toFixed(3)} < ${t.tile} at [${s.tileAt}]`);
  return bad;
}
module.exports = { compare, verdict, ssimMap, planes, WIN, STRIDE };

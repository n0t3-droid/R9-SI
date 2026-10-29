// f-stipple · the stipple detector (review R50-08: fade-ins and LOD seams as screen-door checkerboards). A picture's
// share of pixels that sit in a coherent 2-px checker (the 4x4 ordered dither at fades 1/4 … 3/4, also after the TSR's
// upscale): per pixel r = a − b − c + d over its 2x2 block (zero on edges, stripes and gradients), signed by (−1)^(x+y);
// a pixel is stippled where the mean of that signed r over a 6x6 window is ≥ AMP luma and ≥ COH × the mean |r| there
// (a checker is coherent, texture noise is not) and |r| ≥ AMP in ≥ DENSE of the window (a dither fills it; an edge's
// staircase is a line through it). The share counts the flagged pixels, grown by the window.
//   node test/stipple.js                 the calibration (synthetic frames) — ALL OK / FAILED n
//   node test/stipple.js a.png b.jpg …   each picture's share (and the calibration)
//   require('./stipple.js').measure(file) → Promise<{ share, w, h }>   ·   .measureRaw(lum, w, h) → share
const path = require('path');
const AMP = 14, COH = 0.5, WIN = 6, DENSE = 0.6;
let sharp = null;
for (const p of ['sharp', '/home/dev/.npm-global/lib/node_modules/sharp']) { try { sharp = require(p); break; } catch (e) { /* next */ } }

function measureRaw(L, w, h, withMask) {
  const W1 = w + 1, n = W1 * (h + 1);
  const S = new Float64Array(n), A = new Float64Array(n), D = new Float64Array(n);   // integral images: the signed r, |r|, |r| ≥ AMP
  for (let y = 0; y < h; y++) {
    let rs = 0, ra = 0, rd = 0;
    for (let x = 0; x < w; x++) {
      let r = 0;
      if (x + 1 < w && y + 1 < h) { const i = y * w + x; r = L[i] - L[i + 1] - L[i + w] + L[i + w + 1]; if ((x + y) & 1) r = -r; }
      rs += r; ra += Math.abs(r); rd += Math.abs(r) >= AMP ? 1 : 0;
      S[(y + 1) * W1 + x + 1] = S[y * W1 + x + 1] + rs; A[(y + 1) * W1 + x + 1] = A[y * W1 + x + 1] + ra; D[(y + 1) * W1 + x + 1] = D[y * W1 + x + 1] + rd;
    }
  }
  const box = (I, x0, y0, x1, y1) => I[y1 * W1 + x1] - I[y0 * W1 + x1] - I[y1 * W1 + x0] + I[y0 * W1 + x0];
  // flag each window (stride 2), then count the pixels under any flagged window
  const flag = new Uint8Array(w * h);
  for (let y = 0; y + WIN <= h - 1; y += 2) for (let x = 0; x + WIN <= w - 1; x += 2) {
    const k = WIN * WIN, s = Math.abs(box(S, x, y, x + WIN, y + WIN)) / k, a = box(A, x, y, x + WIN, y + WIN) / k;
    if (s >= AMP && s >= COH * a && box(D, x, y, x + WIN, y + WIN) >= DENSE * k) for (let yy = y; yy < y + WIN; yy++) flag.fill(1, yy * w + x, yy * w + x + WIN);
  }
  let c = 0; for (let i = 0; i < flag.length; i++) c += flag[i];
  return withMask ? { share: c / (w * h), flag } : c / (w * h);
}
async function measure(file) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height, ch = info.channels, L = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) L[i] = ch >= 3 ? 0.2126 * data[i * ch] + 0.7152 * data[i * ch + 1] + 0.0722 * data[i * ch + 2] : data[i * ch];
  return { share: measureRaw(L, w, h), w, h };
}
module.exports = { measure, measureRaw, AMP, COH, WIN, DENSE };

if (require.main === module) (async () => {
  let fails = 0;
  const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
  const W = 640, H = 360;
  // two procedural textures: smooth value noise with a 1-px grain (a grass-like and a bark-like one)
  let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
  const tex = (base, amp, grain) => { const g = new Float32Array(W * H), C = 12, cw = Math.ceil(W / C) + 2, cc = new Float32Array(cw * (Math.ceil(H / C) + 2)); for (let i = 0; i < cc.length; i++) cc[i] = rnd();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const gx = x / C, gy = y / C, ix = gx | 0, iy = gy | 0, fx = gx - ix, fy = gy - iy, v = (cc[iy * cw + ix] * (1 - fx) + cc[iy * cw + ix + 1] * fx) * (1 - fy) + (cc[(iy + 1) * cw + ix] * (1 - fx) + cc[(iy + 1) * cw + ix + 1] * fx) * fy; g[y * W + x] = base + amp * v + grain * (rnd() - 0.5); }
    return g; };
  const A = tex(60, 90, 18), B = tex(130, 80, 18);
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const inRegion = (x, y) => x < W * 0.7 && y < H * 0.5;   // 35 % of the frame
  const make = (f) => { const L = new Float32Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; L[i] = f(x, y, i); } return L; };
  const r1 = (x) => Math.round(x * 1000) / 10;
  check(measureRaw(A, W, H) < 0.005, `a clean texture: ${r1(measureRaw(A, W, H))} %`);
  const blend = make((x, y, i) => (inRegion(x, y) ? 0.5 * A[i] + 0.5 * B[i] : A[i]));
  check(measureRaw(blend, W, H) < 0.005, `a true 50 % alpha blend over 35 %: ${r1(measureRaw(blend, W, H))} %`);
  const stripes = make((x, y, i) => (inRegion(x, y) ? (x & 1 ? A[i] : B[i]) : A[i]));
  check(measureRaw(stripes, W, H) < 0.025, `1-px stripes over 35 % (~0: only where they end on a line): ${r1(measureRaw(stripes, W, H))} %`);
  for (const fade of [0.25, 0.5, 0.75]) {
    const d = make((x, y, i) => (inRegion(x, y) && BAYER[(y & 3) * 4 + (x & 3)] / 16 < fade ? B[i] : A[i]));
    const s = measureRaw(d, W, H);
    check(s >= 0.28 && s <= 0.42, `a 4x4 dither at fade ${fade} over 35 %: ${r1(s)} %`);
    // the same after an upscale of 0.9 (Balanced's TSR: the low-res pattern stretched, nearest)
    const u = make((x, y, i) => { const sx = Math.floor(x * 0.9), sy = Math.floor(y * 0.9); return inRegion(x, y) && BAYER[(sy & 3) * 4 + (sx & 3)] / 16 < fade ? B[i] : A[i]; });
    check(measureRaw(u, W, H) >= 0.15, `  … upscaled from 0.9: ${r1(measureRaw(u, W, H))} %`);
  }
  for (const f of process.argv.slice(2)) { try { const m = await measure(f); console.log(`  ${path.basename(f)}: ${r1(m.share)} % stippled (${m.w}x${m.h})`); } catch (e) { check(false, f + ': ' + e.message); } }
  console.log(fails ? 'FAILED ' + fails : 'ALL OK');
  process.exit(fails ? 1 : 0);
})();

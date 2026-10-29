// u-orbit2 · Herzwelt from orbit and the airless descents in numbers (docs/superpowers/plans/2026-10-29-u-orbit2.md;
// review docs/reviews/v0.51.md R52-09, R52-10). Checks:
//   1. the globe (bodytex.js, seed 53): water 24–36 % of the disc; the seas coherent (most water texels inside water);
//      land with soft gradients (few hard edges between land texels)
//   2. the night lights clustered: the variance-to-mean ratio of the lit texels in 8 × 8 blocks ≥ 2× a uniform scatter's;
//      dark country between (≥ 50 % of the land's blocks unlit)
//   3. the truth at home: within 1.2 km of the Heartland the generator's own land and water (BT.macro says 0.5); the
//      planet tiles follow the macro's seas (a forced sea is flat at the sea)
//   4. the airless sky (bodysky.js): the sky's stops black on a body; the far ground stays its own colour
//   5. the plume's colour: Opal's ice brighter than its ground, Basalt's dust darker than its ground
//   bash test/wt_run.sh orbit2.js 300
const V = require('./load_shared.js');
require('../src/shared/bodytex.js');
require('../src/shared/planetlod.js');
const BT = V.BodyTex, PL = V.PlanetLOD;
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const g = new V.OverworldGen(53, { vgen: 13 }), gen = () => g;

console.log('1 · the globe');
const W = 512, H = 256, r = BT.job({ type: 'bodytex', body: 'herz', w: W, h: H, y0: 0, y1: H }, gen);
const wet = (i, j) => r.b[((j * W + ((i + W) % W)) * 4) + 2] < 128;
let nW = 0, nIn = 0, nArea = 0, edges = 0, pairs = 0;
for (let j = 1; j < H - 1; j++) {
  const wt = Math.sin((j + 0.5) / H * Math.PI);   // (the texels' area on the sphere)
  for (let i = 0; i < W; i++) {
    nArea += wt;
    if (wet(i, j)) { nW += wt; if (wet(i - 1, j) && wet(i + 1, j) && wet(i, j - 1) && wet(i, j + 1)) nIn += wt; continue; }
    if (!wet(i + 1, j)) {
      const k = (j * W + i) * 4, k2 = (j * W + (i + 1) % W) * 4;
      const d = Math.abs(r.a[k] - r.a[k2]) + Math.abs(r.a[k + 1] - r.a[k2 + 1]) + Math.abs(r.a[k + 2] - r.a[k2 + 2]);
      pairs++; if (d > 36) edges++;
    }
  }
}
const wf = nW / nArea, coh = nIn / Math.max(1, nW), ef = edges / Math.max(1, pairs);
check(wf >= 0.24 && wf <= 0.36, `water ${(wf * 100).toFixed(1)} % of the globe (24–36 %)`);
check(coh >= 0.6, `the seas coherent: ${(coh * 100).toFixed(0)} % of the water texels inside water (≥ 60 %)`);
check(ef <= 0.08, `the land soft: ${(ef * 100).toFixed(2)} % of the land's neighbours with a hard edge (ΔRGB > 36; ≤ 8 %; v0.51 49 %)`);

console.log('2 · the night lights');
const B = 8, counts = [];
let litBlocks = 0, landBlocks = 0;
for (let bj = 4; bj < H / B - 4; bj++) for (let bi = 0; bi < W / B; bi++) {
  let n = 0, land = 0;
  for (let j = bj * B; j < bj * B + B; j++) for (let i = bi * B; i < bi * B + B; i++) { if (!wet(i, j)) land++; if (r.b[(j * W + i) * 4] > 0) n++; }
  if (land < B * B * 0.5) continue;
  counts.push(n); landBlocks++; if (n > 0) litBlocks++;
}
const mean = counts.reduce((a, b) => a + b, 0) / counts.length, vr = counts.reduce((a, b) => a + (b - mean) ** 2, 0) / counts.length;
const p = mean / (B * B), uni = (B * B) * p * (1 - p), vmr = vr / Math.max(1e-6, uni);
check(vmr >= 2, `clustered: the lit texels' variance ${vr.toFixed(1)} against a uniform scatter's ${uni.toFixed(1)} (${vmr.toFixed(1)}× ≥ 2×)`);
check(1 - litBlocks / landBlocks >= 0.5, `dark country: ${((1 - litBlocks / landBlocks) * 100).toFixed(0)} % of the land's blocks unlit (≥ 50 %; v0.51 19 %)`);

console.log('3 · the truth at home');
let home = true;
for (let k = 0; k < 200; k++) { const a = k * 2.399, d = 1200 * Math.sqrt(k / 200); const m = BT.macro && BT.macro(Math.cos(a) * d, Math.sin(a) * d, g.seed); if (!m || Math.abs(m.land - 0.5) > 1e-9 || m.river) home = false; }
check(home, 'within 1.2 km of the Heartland the generator\'s own coast (BT.macro: 0.5, no river)');
let sea = null;
for (let k = 0; k < 4000 && !sea; k++) { const x = 20000 + (k % 63) * 1500, z = -60000 + Math.floor(k / 63) * 1500; const m = BT.macro(x, z, g.seed); if (m.land < 0.05 && g.computeClimate(x, z).H > (V.C.SEA + 6)) sea = [x, z]; }
if (sea) { const t = PL.job({ type: 'ptile', x0: sea[0] - 4 * 128, z0: sea[1] - 4 * 128, s: 128 }, gen); check(t.hMin === 0 && t.hMax < 3, `a forced sea's tile flat at the sea (${t.hMin}–${t.hMax.toFixed(1)} m)`); }
else check(false, 'no forced sea over high land found');

console.log('4 · the airless sky');
require('../src/main/bodysky.js');
const BS = V.BodySky;
{
  const E = {}, env = { day: 3, ticks: 6000 };
  BS.eye = [0, 120, 0]; BS.groundY = 90;
  BS.env(E, env, { dim: 'opal', renderDist: 8 }, 0.016);
  const mx = (c) => Math.max(c[0], c[1], c[2]);
  check(E.zenith && mx(E.zenith) < 0.002 && mx(E.skyMid) < 0.002 && mx(E.horizon) < 0.002, `Opal: the sky's stops black (zenith ${E.zenith && E.zenith.map(v => v.toFixed(3))}, horizon ${E.horizon && E.horizon.map(v => v.toFixed(3))})`);
  check(E.bodySky && mx(E.bodySky.ground) > 0.01, `the far ground keeps its colour (${E.bodySky && Array.from(E.bodySky.ground).slice(0, 3).map(v => v.toFixed(3))})`);
}

console.log('5 · the plume');
{
  require('../src/main/cruise.js');
  const C = V.Cruise, lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const D = C && C.DUST, G = C && C.GROUND;
  check(!!(D && G), 'VR.Cruise.DUST and .GROUND (the plume\'s and the ground\'s colours)');
  if (D && G) {
    check(lum(D.opal) > lum(G.opal) * 1.08, `Opal: the ice plume brighter than the ice (${lum(D.opal).toFixed(2)} > ${lum(G.opal).toFixed(2)})`);
    check(lum(D.basalt) < lum(G.basalt), `Basalt: the dust darker than the ground (${lum(D.basalt).toFixed(2)} < ${lum(G.basalt).toFixed(2)})`);
  }
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

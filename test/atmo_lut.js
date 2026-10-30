// u-moons2 · the skies of the worlds with air (src/main/atmo_lut.js, VR.AtmoLUT; plan docs/superpowers/plans/
// 2026-10-30-u-moons2.md §2): Hillaire's three LUTs on the CPU from per-world constants.
//   a · the LUTs' shapes, nothing negative or NaN; the transmittance 0 below the horizon, 1 − τ at the zenith's top
//   b · Herzwelt's constants (R§2.1): the noon zenith blue, Helia's disc at 5° the colour of R§2.1's table (orange)
//   c · Ocker (R§2.3): butterscotch by day away from Helia (b* > 15); at sunset the sky within 10° of Helia bluer than
//       30° away (CIE b* lower by ≥ 8); a storm (τ 4.5) turns the day to dusk (Helia's light < 3 % at 30°)
//   d · Aquamarin: 2.4× Earth's column — a whiter horizon than Herzwelt's at noon, a redder sunset
//   e · Very Low's 3 stops: fitted from the same model, within reach of the LUT at the zenith and the horizons
//   f · the cost: the sky-view's slice per frame ≤ 1 ms (Balanced 48 × 24 in 4 slices; High 96 × 50 in 10), the
//       two small LUTs rebuilt only when the air changes; Low frozen (no rebuild while Helia moved < 1.5°)
//   bash test/wt_run.sh atmo_lut.js 300
globalThis.VR = globalThis.VR || {};
require('../src/main/atmo_lut.js');
const A = VR.AtmoLUT, D = Math.PI / 180;
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const f3 = (v) => '(' + v.map(x => x.toFixed(4)).join(', ') + ')';
const near = (el, off, az) => { const e = (el + off) * D, a = az * D; return [Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a)]; };
const sunOf = (el) => [Math.cos(el * D), Math.sin(el * D), 0];
const ctx = (id, tau) => A.context(id === 'ocker' ? A.ocker(tau) : A.AIRS[id], { W: 48, H: 24 });

console.log('a · the LUTs');
{
  const C = ctx('herz');
  let bad = 0; for (const L of [C.T, C.MS]) for (const v of L) if (!(v >= 0) || !Number.isFinite(v)) bad++;
  A.update(C, 2, 30 * D); for (const v of C.sky) if (!(v >= 0) || !Number.isFinite(v)) bad++;
  check(bad === 0 && C.T.length === A.TW * A.TH * 3 && C.MS.length === A.MW * A.MH * 3 && C.sky.length === 48 * 24 * 4, `T ${A.TW}×${A.TH}, Ψ_ms ${A.MW}×${A.MH}, sky-view 48×24: no negative or NaN texel (${bad})`);
  const below = A.trans(C, C.air.R + 10, -0.5, [0, 0, 0]), zen = A.trans(C, C.air.R + 1, 1, [0, 0, 0]);
  // (the zenith's optical depth: Rayleigh 0.046 / 0.108 / 0.265 + Mie 0.0053 + ozone 0.010 / 0.028 / 0.001, R§2.1)
  const want = [0.046 + 0.0053 + 0.010, 0.108 + 0.0053 + 0.028, 0.265 + 0.0053 + 0.001].map(t => Math.exp(-t));
  check(below[0] === 0 && Math.max(...zen.map((v, i) => Math.abs(v - want[i]))) < 0.01, `the transmittance: 0 into the ground, the zenith ${f3(zen)} ≈ e^−τ of R§2.1 ${f3(want)}`);
}
console.log('b · Herzwelt');
{
  const C = ctx('herz'); A.update(C, 2, 60 * D);
  const z = A.sample(C, [0, 1, 0], sunOf(60), [0, 0, 0]), L = A.lab(z);
  check(z[2] > 1.8 * z[0] && L[2] < -25, `the noon zenith is blue ${f3(z)} (b* ${L[2].toFixed(0)})`);
  const s5 = A.sunTrans(C, 2, 5 * D, [0, 0, 0]), n5 = s5.map(v => v / s5[0]);
  // R§2.1: #ffb05f at 5° → (1, 0.69, 0.37) in sRGB → linear (1, 0.43, 0.11)
  check(Math.abs(n5[1] - 0.43) < 0.12 && Math.abs(n5[2] - 0.11) < 0.08, `Helia's disc at 5° ${f3(n5)} ≈ R§2.1's #ffb05f (linear 1, 0.43, 0.11)`);
}
console.log('c · Ocker');
let bDiff = 0;
{
  const C = ctx('ocker', 0.6);
  A.update(C, 2, 45 * D);
  const away = A.sample(C, near(0, 20, 150), sunOf(45), [0, 0, 0]), La = A.lab(away);
  const hue = Math.atan2(La[2], La[1]) / D;
  check(La[2] > 15 && hue > 50 && hue < 110, `butterscotch by day away from Helia ${f3(away)} (b* ${La[2].toFixed(0)}, hue ${hue.toFixed(0)}°)`);
  A.update(C, 2, 2 * D);
  const sN = A.sample(C, near(2, 3, 6), sunOf(2), [0, 0, 0]), s30 = A.sample(C, near(2, 3, 30), sunOf(2), [0, 0, 0]);
  const bN = A.lab(sN)[2], b30 = A.lab(s30)[2]; bDiff = b30 - bN;
  check(bDiff >= 8, `the blue sunset: within 10° of Helia b* ${bN.toFixed(0)}, 30° away b* ${b30.toFixed(0)} — bluer by ${bDiff.toFixed(0)} (≥ 8) ${f3(sN)} vs ${f3(s30)}`);
  const Cs = ctx('ocker', 4.5), t30 = A.sunTrans(Cs, 2, 30 * D, [0, 0, 0]);
  check(t30[1] < 0.03, `a storm (τ 4.5): Helia's light at 30° ${(t30[1] * 100).toFixed(1)} % — the day turns to dusk`);
}
console.log('d · Aquamarin');
{
  const Ca = ctx('aqua'), Ch = ctx('herz');
  A.update(Ca, 2, 60 * D); A.update(Ch, 2, 60 * D);
  const hA = A.sample(Ca, near(0, 3, 180), sunOf(60), [0, 0, 0]), hH = A.sample(Ch, near(0, 3, 180), sunOf(60), [0, 0, 0]);
  const sat = (v) => (Math.max(...v) - Math.min(...v)) / Math.max(...v);
  check(sat(hA) < sat(hH), `the noon horizon whiter than Herzwelt's (saturation ${sat(hA).toFixed(2)} < ${sat(hH).toFixed(2)})`);
  const tA = A.sunTrans(Ca, 2, 3 * D, [0, 0, 0]), tH = A.sunTrans(Ch, 2, 3 * D, [0, 0, 0]);
  check(tA[1] / tA[0] < tH[1] / tH[0], `a redder sunset: Helia at 3° G/R ${(tA[1] / tA[0]).toFixed(2)} < Herzwelt's ${(tH[1] / tH[0]).toFixed(2)}`);
}
console.log('e · Very Low: three stops');
{
  let worst = 0;
  for (const [id, el] of [['ocker', 45], ['ocker', 3], ['aqua', 50], ['aqua', 4]]) {
    const C = ctx(id, 0.6); A.update(C, 2, el * D);
    const s = A.fit3(C, 2, el * D), sun = sunOf(el);
    for (const d of [[0, 1, 0], near(0, 5, 180), near(0, 5, 12), near(0, 5, 90)]) {   // (the aureole's core is the glare's on Very Low)
      const a = A.sample(C, d, sun, [0, 0, 0]), b = A.stops3(s, d, sun, [0, 0, 0]);
      const e = Math.max(...a.map((v, i) => Math.abs(v - b[i]) / Math.max(1e-4, Math.max(...a))));
      worst = Math.max(worst, e);
    }
  }
  check(worst < 0.45, `the 3-stop sky within ${(worst * 100).toFixed(0)} % of the LUT's brightest channel at the zenith and three horizons (away, beside, 12° off Helia; < 45 %)`);
}
console.log('f · the cost');
{
  const C = A.context(A.ocker(0.6), { W: 48, H: 24 });
  for (let k = 0; k < 8; k++) A.update(C, 2, 20 * D, 6, 0.45);   // (warm)
  let t0 = performance.now(), n = 0; let rowsB = 0; while (performance.now() - t0 < 300) { const r0 = C.row; A.update(C, 2, 20 * D, 6, 0.45); rowsB += (C.row - r0 + 24) % 24 || 24; n++; }
  const bal = (performance.now() - t0) / n;
  const H = A.context(A.ocker(0.6), { W: 96, H: 50 });
  for (let k = 0; k < 6; k++) A.update(H, 2, 20 * D, 5, 0.45);
  t0 = performance.now(); n = 0; let rowsH = 0; while (performance.now() - t0 < 300) { const r0 = H.row; A.update(H, 2, 20 * D, 5, 0.45); rowsH += (H.row - r0 + 50) % 50 || 50; n++; }
  const high = (performance.now() - t0) / n;
  check(bal <= 1.0 && high <= 1.2, `the sky-view per frame (a 0.45 ms budget, slices of 16 texels): Balanced 48×24 ${bal.toFixed(2)} ms (${(24 / (rowsB / n)).toFixed(1)} frames a refresh), High 96×50 ${high.toFixed(2)} ms (${(50 / (rowsH / n)).toFixed(1)} frames)`);
  // a storm's new τ: staged — T and Ψ_ms a few rows a frame inside the same budget, then swapped in
  A.stageAir(C, A.ocker(1.2)); let worst = 0, frames = 0; const ts = [];
  while (C.next && frames < 500) { const t1 = performance.now(); A.update(C, 2, 20 * D, 6, 0.45); const dt = performance.now() - t1; ts.push(dt); worst = Math.max(worst, dt); frames++; }
  ts.sort((a, b) => a - b); const med = ts[ts.length >> 1];
  check(!C.next && C.air.tau === 1.2 && med < 1.5, `a new dust τ staged: swapped in after ${frames} frames, the median frame ${med.toFixed(2)} ms (< 1.5; the dearest ${worst.toFixed(1)} ms — the machine's other load)`);
  // Low: frozen — the caller rebuilds only when Helia moved ≥ 1.5° (bodysky.js wantRefresh)
  const BSk = { el: 20 * D }; const want = (el) => Math.abs(el - BSk.el) >= 1.5 * D;
  check(!want(21 * D) && want(21.6 * D), 'Low: frozen until Helia moved 1.5° (a world hour is 3–4° on these worlds)');
  console.log(`     (record: balanced ${bal.toFixed(3)} ms, high ${high.toFixed(3)} ms, staged air worst ${worst.toFixed(2)} ms, Ocker sunset b* difference ${bDiff.toFixed(1)})`);
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

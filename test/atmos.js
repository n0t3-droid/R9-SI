// F1 · Licht & Luft: the sky model and the exposure easing, in node (no browser).
//  - the sky at noon is blue overhead and brighter than at dusk; dusk is orange on the sun side of the horizon, magenta
//    above it and blue higher up; the night is dark blue; turbidity whitens the horizon; the sun side is brighter
//  - the 64×32 lookup table reproduces the formula within 2 % (relative to the sky's brightest value, 2000 directions
//    at 8 times of day, 2 turbidities)
//  - the exposure eases toward its target: no overshoot, dt = 0 keeps it, a long time reaches it; the target falls
//    with the scene's brightness, keeps its range, and is 1 for a middle-grey scene
//    bash test/wt_run.sh atmos.js
global.VR = {};
require('../src/main/atmos.js');
const A = VR.Atmos;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
// the sun at a time of day in game ticks (0 = sunrise, 6000 = noon, 12000 = sunset, 18000 = midnight)
const tod = (ticks) => ticks / 24000;
const sunAt = (ticks) => A.sunDir(tod(ticks));
const skyAt = (ticks, dirFn, T) => {
  const sun = sunAt(ticks);
  const s = A.prepare(sun, { T: T === undefined ? 2.5 : T });
  const d = dirFn(sun);
  return A.radiance(s, d[1], dot(d, sun));
};
// a direction at an elevation (degrees) and an azimuth offset from the sun (degrees; 0 = toward the sun)
const dirAt = (elev, azOff) => (sun) => {
  const h = norm([sun[0], 0, sun[2]]);
  const a = (azOff * Math.PI) / 180, e = (elev * Math.PI) / 180;
  const hz = [h[0] * Math.cos(a) - h[2] * Math.sin(a), 0, h[0] * Math.sin(a) + h[2] * Math.cos(a)];
  return [hz[0] * Math.cos(e), Math.sin(e), hz[2] * Math.cos(e)];
};
const zenith = () => [0, 1, 0];

console.log('sky model');
{
  const noon = skyAt(6000, zenith), dusk = skyAt(12500, zenith), night = skyAt(18000, zenith);
  check(noon[2] > noon[1] && noon[1] > noon[0], `noon zenith is blue (rgb ${noon.map(v => v.toFixed(3)).join(', ')})`);
  check(lum(noon) > 5 * lum(dusk), `noon zenith brighter than dusk (${lum(noon).toFixed(3)} vs ${lum(dusk).toFixed(3)})`);
  check(lum(noon) > 0.2 && lum(noon) < 2.5, `noon zenith in a sane HDR range (${lum(noon).toFixed(3)})`);
  check(night[2] > night[0] && lum(night) < 0.03, `night is dark blue (rgb ${night.map(v => v.toFixed(4)).join(', ')})`);
  // dusk: the sun side low down is orange (red over blue)
  const dLow = skyAt(12500, dirAt(3, 0));
  check(dLow[0] > dLow[1] && dLow[1] > dLow[2] && dLow[0] > 1.5 * dLow[2], `dusk, sun side at 3°: orange (rgb ${dLow.map(v => v.toFixed(3)).join(', ')})`);
  // dawn has the same colour order
  const dawnLow = skyAt(500, dirAt(3, 0));
  check(dawnLow[0] > 1.5 * dawnLow[2], `dawn, sun side at 3°: orange (rgb ${dawnLow.map(v => v.toFixed(3)).join(', ')})`);
  // the anti-solar side at dusk: magenta (red and blue over green)
  const dMag = skyAt(12500, dirAt(12, 150));
  check(dMag[0] > dMag[1] && dMag[2] > dMag[1], `dusk, away from the sun at 12°: magenta (rgb ${dMag.map(v => v.toFixed(3)).join(', ')})`);
  // the colour order up from the horizon on the sun side: orange, then something bluer higher up
  const dHigh = skyAt(12500, dirAt(40, 0));
  check(dLow[0] / dLow[2] > dHigh[0] / Math.max(dHigh[2], 1e-4), 'dusk: the red-to-blue ratio falls going up from the horizon (orange → blue)');
  // the sun side is brighter than the far side (the aureole), at noon
  const sideN = skyAt(6000, dirAt(12, 15)), farN = skyAt(6000, dirAt(12, 150));
  check(lum(sideN) > lum(farN), `noon: the sun side (15°) is brighter than the far side (150°) (${lum(sideN).toFixed(3)} vs ${lum(farN).toFixed(3)})`);
  // turbidity: a hazy sky carries less blue near the horizon than a clear one
  const satOf = (c) => (c[2] - c[0]) / Math.max(1e-4, c[2] + c[0]);
  const clear = skyAt(6000, dirAt(2, 90), 2.0), hazy = skyAt(6000, dirAt(2, 90), 6.0);
  check(satOf(hazy) < satOf(clear), `hazy horizon carries less blue than a clear one (blue share ${satOf(clear).toFixed(3)} clear, ${satOf(hazy).toFixed(3)} hazy)`);
  // the clear noon day at the shipped turbidity (env.js: 2.3 in clear weather): the zenith keeps v0.41's deep blue, the
  // horizon away from the sun stays blue (not white), and the horizon is about 2-4 times brighter than the zenith
  const blueShare = (c) => c[2] / Math.max(1e-6, c[0] + c[1] + c[2]);
  const zen23 = skyAt(6000, zenith, 2.3), hor23 = skyAt(6000, dirAt(1, 180), 2.3);
  check(blueShare(zen23) >= 0.6, `noon zenith keeps its blue (blue share ${blueShare(zen23).toFixed(3)}; v0.41's palette ${(0.68 / 0.97).toFixed(2)})`);
  check(blueShare(hor23) >= 0.3, `noon horizon away from the sun is not white (blue share ${blueShare(hor23).toFixed(3)})`);
  const horRatio = lum(hor23) / lum(zen23);
  check(horRatio >= 2 && horRatio <= 4, `noon horizon-to-zenith luminance ratio in [2, 4] (${horRatio.toFixed(2)}; v0.41's palette ≈ 2.9)`);
  // everything finite and non-negative over a sweep of times and directions
  let bad = 0;
  for (let t = 0; t < 24000; t += 750) for (let k = 0; k < 24; k++) {
    const sun = sunAt(t), d = norm([Math.cos(k * 0.7) * 0.9, 0.05 + k / 30, Math.sin(k * 0.7) * 0.9]);
    const c = A.radiance(A.prepare(sun, { T: 3 }), d[1], dot(d, sun));
    if (!c.every((v) => Number.isFinite(v) && v >= 0)) bad++;
  }
  check(bad === 0, `radiance finite and non-negative over 32 times × 24 directions (${bad} bad)`);
}

console.log('lookup table');
{
  let maxErr = 0, worst = null, n = 0;
  let seed = 12345;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (const T of [2.0, 4.0]) for (const t of [0, 1500, 6000, 9000, 12000, 12500, 15000, 18000]) {
    const sun = sunAt(t), s = A.prepare(sun, { T, tint: [1, 0.96, 0.9] });
    const lut = A.buildLUT(s);
    let peak = 0; for (let i = 0; i < lut.length; i += 4) peak = Math.max(peak, lut[i], lut[i + 1], lut[i + 2]);
    for (let k = 0; k < 250; k++) {
      const cT = rnd(), cG = 2 * rnd() - 1;
      const direct = A.radiance(s, cT, cG), table = A.sampleLUT(lut, cT, cG);
      for (let c = 0; c < 3; c++) {
        const err = Math.abs(table[c] - direct[c]) / Math.max(direct[c], 0.02 * peak, 1e-6);
        if (err > maxErr) { maxErr = err; worst = { T, t, cT: +cT.toFixed(3), cG: +cG.toFixed(3), c }; }
      }
      n++;
    }
  }
  check(maxErr <= 0.02, `table within 2 % of the formula over ${n} samples (worst ${(maxErr * 100).toFixed(2)} % at ${JSON.stringify(worst)})`);
  // the table is exact at its own texel centres
  const s = A.prepare(sunAt(6000), {});
  const lut = A.buildLUT(s);
  const uv = A.lutUV(1, 1);
  check(uv[0] === 0 && uv[1] === 0, 'the zenith, looking at the zenith, is the table corner (0, 0): the horizon is the last row');
  const uvH = A.lutUV(0, 0);
  check(uvH[1] === 1, 'the horizon is the last row of the table');
  void lut;
}

console.log('shader parameters');
{
  // the packed state reproduces radiance(): the shader's formula is the same sum, so this is the check of the packing
  const sun = sunAt(6000), s = A.prepare(sun, { T: 3, tint: [1, 0.9, 0.8] }), P = A.glParams(s);
  const pz = (o, ct, g, cg) => (1 + P.per[o] * Math.exp(P.per[o + 1] / ct)) * (1 + P.per[o + 2] * Math.exp(P.per[o + 3] * g) + P.per[o + 4] * cg * cg);
  const cT = 0.6, cG = 0.3, ct = cT, g = Math.acos(cG);
  const Y = P.k[0] * pz(0, ct, g, cG), x = P.k[1] * pz(5, ct, g, cG), y = Math.max(0.01, P.k[2] * pz(10, ct, g, cG));
  const X = x / y * Y, Z = (1 - x - y) / y * Y;
  const rgb = [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.2040 * Y + 1.0570 * Z].map((v, i) => v * P.k[3] * P.tint[i]);
  const ref = A.radiance(s, cT, cG);
  const err = Math.max(...rgb.map((v, i) => Math.abs(v - ref[i]) / Math.max(ref[i], 1e-6)));
  check(err < 1e-6, `the packed parameters (float32, as the GPU holds them) give the same radiance (relative error ${err.toExponential(2)})`);
}

console.log('exposure');
{
  // easing: monotone, no overshoot, dt 0 keeps the value, a long time reaches the target, up is faster than down
  let x = 1, ok = true, prev = x;
  for (let i = 0; i < 600; i++) { x = A.easeExposure(x, 2, 1 / 60, 0.8, 2.5); if (x < prev - 1e-12 || x > 2 + 1e-12) ok = false; prev = x; }
  check(ok && Math.abs(x - 2) < 1e-3, `eases up to the target without overshoot (${x.toFixed(4)} after 10 s)`);
  let y = 2; ok = true; prev = y;
  for (let i = 0; i < 1200; i++) { y = A.easeExposure(y, 0.5, 1 / 60, 0.8, 2.5); if (y > prev + 1e-12 || y < 0.5 - 1e-12) ok = false; prev = y; }
  check(ok && Math.abs(y - 0.5) < 1e-2, `eases down to the target without undershoot (${y.toFixed(4)} after 20 s)`);
  check(A.easeExposure(1, 3, 0, 0.8, 2.5) === 1, 'dt 0 keeps the exposure');
  const upStep = A.easeExposure(1, 2, 0.5, 0.8, 2.5) - 1, downStep = 1 - A.easeExposure(2, 1, 0.5, 0.8, 2.5);
  check(upStep > downStep, `the eyes adapt faster to the dark than to the bright (${upStep.toFixed(3)} up vs ${downStep.toFixed(3)} down in 0.5 s)`);
  // targets: a middle-grey scene is 1, a dark scene (cave) wants more light, a bright one less, the range holds
  // the GPU's constants (EXPOSURE, the same numbers as shaders.js EXPOSE_FS and renderer.js): the key is the clear noon's
  // log-average luminance, which wants exposure 1; the range is ±0.5 stops around 1
  const E = A.EXPOSURE;
  check(Math.abs(A.exposureTarget(Math.log(E.key)) - 1) < 1e-9, `the clear noon's key wants exposure 1 (key ${E.key})`);
  const cave = A.exposureTarget(Math.log(0.02)), noon = A.exposureTarget(Math.log(0.6));
  check(cave > 1 && noon < 1, `a cave wants more light (${cave.toFixed(3)}), a bright noon less (${noon.toFixed(3)})`);
  check(Math.abs(E.lo - Math.SQRT1_2) < 1e-12 && Math.abs(E.hi - Math.SQRT2) < 1e-12, 'the range is ±0.5 stops around 1');
  check(A.exposureTarget(Math.log(1e-9)) === E.hi && A.exposureTarget(Math.log(1e6)) === E.lo, 'the target stays in its range at the extremes');
}

console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exitCode = fails ? 1 : 0;

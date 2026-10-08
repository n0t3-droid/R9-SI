// F1 · Licht & Luft: the sky as the player sees it, against v0.41's, in node (no browser).
// Both skies go through the same composite (env.js's exposure and grade, the vivid ACES curve, the saturation, the
// lift, the display gamma) and the same cosmic veil (u_skyMagic 0.8, Balanced): v0.41's sky is its palette gradient
// with its warm glow (ported from v0.41's shaders.js as the reference), F1's is VR.Atmos.air() — the Perez sky (or its
// table), the sun-side glow and the weather, the same sum as the shaders' atmoAir().
//  - rain and storm: the sky is v0.41's grey (luminance within 25 %), not a white or blue haze
//  - the clear noon: every probed direction at least as saturated as v0.41's (−0.03), the luminance within 15 %;
//    the sun side keeps v0.41's warm glow (its red at least 90 % of v0.41's)
//  - fog keeps the blue sky above it (the zenith within 15 % of v0.41's luminance)
//  - dawn and dusk: the zenith is blue-violet (blue over red and green), as bright as v0.41's within 40 %
//  - the haze the far land turns toward (applyFog's colour) is the sky's colour, never white: in the clear noon its
//    saturation is at least 0.15 and it is no brighter than the sky at the horizon
//    bash test/wt_run.sh atmos_look.js
require('./load_shared.js');
require('../src/main/atmos.js');
require('../src/main/weather.js');
require('../src/main/skybodies.js');
require('../src/main/env.js');
const A = VR.Atmos;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const mulv = (a, b) => [a[0] * b[0], a[1] * b[1], a[2] * b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const lumv = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
// the composite (shaders.js COMPOSITE_FS) for a sky pixel: exposure, grade, the vivid ACES blend, saturation, lift, gamma
const aces = (x) => clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0, 1);
function tonemap(x, vivid) {
  const f = x.map(aces), l = lumv(x);
  let h = mul(x, aces(l) / Math.max(l, 1e-5));
  const m = Math.max(h[0], h[1], h[2]);
  if (m > 1) h = mix3(mul(h, 1 / m), [1, 1, 1], clamp((m - 1) * 0.35, 0, 1));
  return mix3(f, h.map(v => clamp(v, 0, 1)), vivid);
}
function display(c, E, gpuExp) {
  c = tonemap(mulv(mul(c, E.exposure * gpuExp), E.grade), E.vivid);
  const l = lumv(c);
  c = mix3([l, l, l], c, E.saturation);
  const L = E.lift || [0, 0, 0];
  return c.map((v, i) => Math.pow(clamp(clamp(v, 0, 1) + L[i] * (1 - clamp(v, 0, 1)), 0, 1), 1 / 2.2));
}
const satOf = (p) => (Math.max(...p) - Math.min(...p)) / Math.max(1e-4, Math.max(...p));
const lumD = (p) => 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];
const rgb8 = (p) => p.map(v => Math.round(v * 255)).join(',');

// v0.41's sky (shaders.js skyColor at 9bf1448, before the bodies): the palette gradient, the band, the warm glow
function sky041(dir, E) {
  const h = Math.max(dir[1], 0), dayK = 1 - E.night;
  let col = mix3(E.horizon, E.zenith, Math.pow(h, 0.42));
  col = mix3(col, add(mulv(E.horizon, [1.16, 1.1, 1.02]), mul([0.035, 0.04, 0.03], dayK)), Math.pow(1 - h, 16) * 0.6 * dayK);
  col = add(col, mul([0, 0.012, 0.03], Math.pow(Math.max(1 - Math.abs(dir[1] - 0.35), 0), 6) * dayK));
  const toSun = Math.max(dot(dir, E.sunDir), 0);
  col = add(col, mul(E.sunset, (Math.pow(toSun, 7) * 1.3 + Math.pow(1 - h, 5) * 0.45) * (0.3 + 0.7 * toSun)));
  col = add(col, mul(E.sunColor, Math.pow(toSun, 60) * 0.45 * (1 - E.rain)));
  return col;
}
// v0.41's haze colour (hazeColor mixed with the fog colour, applyFog)
function haze041(dir, E) {
  const h = Math.max(dir[1], 0), toSun = Math.max(dot(dir, E.sunDir), 0);
  let col = mix3(E.horizon, E.zenith, Math.pow(h, 0.55));
  col = add(col, add(mul(E.sunset, Math.pow(toSun, 6) * 0.55 + Math.pow(1 - h, 6) * 0.18), mul(E.sunColor, Math.pow(toSun, 32) * 0.1 * (1 - E.rain))));
  return mix3(col, E.fogColor, 0.35);
}
// the cosmic veil's colour shift by day (the same code in both builds; the nebula's noise left out)
function veil(col, dir, E, magic) {
  const clear = 1 - E.rain, magicDay = magic * (1 - E.night), horizonFade = sstep(-0.12, 0.08, dir[1]);
  const golden = (1 - sstep(0.02, 0.4, E.sunDir[1])) * (E.sunDir[1] >= -0.05 ? 1 : 0);
  const cosmic = clamp(E.night + magicDay * (0.4 + 0.25 * sstep(0.2, 0.9, dir[1]) + golden * 0.5 * sstep(0.05, 0.5, dir[1])), 0, 1) * clear * horizonFade;
  const planetsK = clamp(E.night + magicDay * 0.7, 0, 1) * clear * horizonFade;
  return planetsK > 0.01 ? mix3(col, add(mulv(col, [0.6, 0.48, 0.9]), [0.02, 0, 0.05]), cosmic * (1 - E.night) * 0.7) : col;
}
// F1: the sky state as the renderer builds it, and the air toward a direction (the shaders' atmoAir). Without air()
// (the state of f1a364d) the shaders' sum of that state stands in: the radiance, greyed by 45 % of the rain, and a haze
// of 60 % of the sky's chroma — so this test tells the washed-out sky from the reworked one
const air = A.air || ((st, cT, cG, P) => { let c = A.radiance(st, cT, cG); if (P.rain > 0) { const l = lumv(c); c = mix3(c, [l, l, l], P.rain * 0.45); } return c; });
const airParams = A.airParams || ((E) => ({ rain: E.rain }));
const skyState = (E) => A.prepare(E.sunDir, { T: E.skyT, overcast: E.skyOvercast, tint: E.skyTint });
const f1Sky = (dir, E, st) => air(st, dir[1], dot(dir, E.sunDir), airParams(E), 1);
const f1Haze = (dir, E, st) => {
  const d = [dir[0], Math.max(dir[1], 0), dir[2]];
  if (!A.haze) { const c = air(st, d[1], dot(d, E.sunDir), airParams(E)), l = lumv(c); return mix3([l, l, l], c, 0.6); }
  return A.haze(st, d[1], dot(d, E.sunDir), A.airParams(E), E.fogColor);
};

const env = new VR.Env();
const biome = VR.biomeByKey('plains');
function stateAt(kind, ticks) {
  env.setTime(ticks);
  env.wx.setSeed(424242);
  env.wx.force(kind);
  for (let i = 0; i < 80; i++) env.update(1, { dim: 'overworld', biome, eyeSky: 1, renderDist: 7, horizon: 0, freezeTime: true, freezeWeather: false });
  return JSON.parse(JSON.stringify(env.E));
}
// a direction at an elevation and an azimuth offset from the sun (degrees; 0 = toward the sun)
const dirAt = (E, el, az) => {
  const a = Math.atan2(E.sunDir[2], E.sunDir[0]) + az * Math.PI / 180, e = el * Math.PI / 180;
  return [Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)];
};
const both = (E, el, az) => {
  const st = skyState(E), d = dirAt(E, el, az);
  return { old: display(veil(sky041(d, E), d, E, 0.8), E, 1), now: display(veil(f1Sky(d, E, st), d, E, 0.8), E, 1) };
};

console.log('rain and storm: the sky is grey, as v0.41 drew it');
for (const kind of ['regen', 'gewitter']) {
  const E = stateAt(kind, 6000);
  let worst = 1, at = '';
  for (const [el, az] of [[90, 0], [60, 180], [35, 180], [35, 0], [15, 90]]) {
    const p = both(E, el, az), r = lumD(p.now) / lumD(p.old);
    if (Math.abs(r - 1) > Math.abs(worst - 1)) { worst = r; at = `${el}° up, ${az}°: ${rgb8(p.now)} against ${rgb8(p.old)}`; }
  }
  check(Math.abs(worst - 1) <= 0.25, `${kind}: the sky's luminance within 25 % of v0.41's at 5 directions (worst ×${worst.toFixed(2)}, ${at})`);
  const z = both(E, 90, 0);
  check(satOf(z.now) <= satOf(z.old) + 0.08, `${kind}: the zenith is grey, not blue (saturation ${satOf(z.now).toFixed(2)} against v0.41's ${satOf(z.old).toFixed(2)})`);
}

console.log('the clear noon');
{
  const E = stateAt('klar', 6000);
  let worstS = 1, atS = '', worstL = 1, atL = '';
  for (const el of [90, 60, 35, 15, 5, 1]) for (const az of [180, 90, 0]) {
    if (el === 90 && az !== 0) continue;
    const p = both(E, el, az), ds = satOf(p.now) - satOf(p.old), rl = lumD(p.now) / lumD(p.old);
    if (ds < worstS) { worstS = ds; atS = `${el}° up, ${az}°: ${rgb8(p.now)} s ${satOf(p.now).toFixed(2)} against ${rgb8(p.old)} s ${satOf(p.old).toFixed(2)}`; }
    if (Math.abs(rl - 1) > Math.abs(worstL - 1)) { worstL = rl; atL = `${el}° up, ${az}°: ${rgb8(p.now)} against ${rgb8(p.old)}`; }
  }
  check(worstS >= -0.03, `every direction at least as saturated as v0.41's (worst ${worstS.toFixed(3)}: ${atS})`);
  check(Math.abs(worstL - 1) <= 0.15, `the luminance within 15 % of v0.41's everywhere (worst ×${worstL.toFixed(2)}: ${atL})`);
  for (const el of [35, 15]) {
    const p = both(E, el, 0);
    check(p.now[0] >= 0.9 * p.old[0] && p.now[0] > p.now[1], `the sun side ${el}° up keeps the warm glow (${rgb8(p.now)} against v0.41's ${rgb8(p.old)})`);
  }
  // the haze the far land turns toward: the sky's colour, not white
  const st = skyState(E);
  for (const az of [180, 90]) {
    const d = dirAt(E, 0.5, az);
    const hz = display(f1Haze(d, E, st), E, 1), sk = display(veil(f1Sky(d, E, st), d, E, 0.8), E, 1), old = display(haze041(d, E), E, 1);
    check(satOf(hz) >= 0.15 && lumD(hz) <= lumD(sk) + 0.02, `the haze at ${az}° is the sky's colour, not white (${rgb8(hz)} s ${satOf(hz).toFixed(2)}; the sky ${rgb8(sk)}; v0.41's haze ${rgb8(old)})`);
  }
}

console.log('fog keeps the blue sky above it');
{
  const E = stateAt('nebel', 6000), p = both(E, 90, 0);
  check(Math.abs(lumD(p.now) / lumD(p.old) - 1) <= 0.15 && satOf(p.now) >= satOf(p.old) - 0.05, `the zenith in fog (${rgb8(p.now)} against v0.41's ${rgb8(p.old)})`);
}

console.log('dawn and dusk: a blue-violet zenith');
for (const [name, ticks] of [['06:30', 500], ['18:30', 12500], ['17:30', 11500]]) {
  const E = stateAt('klar', ticks), p = both(E, 90, 0);
  const z = p.now;
  check(z[2] > z[0] && z[2] > z[1] && Math.abs(lumD(z) / lumD(p.old) - 1) <= 0.4, `${name}: the zenith ${rgb8(z)} is blue-violet, as bright as v0.41's ${rgb8(p.old)} within 40 %`);
}

console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exitCode = fails ? 1 : 0;

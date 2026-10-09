// The trailer's sky in env.js (t-sky): the three stops per time of day and what they look like through the composite, in
// node. The shader (shaders.js skyColor) mixes the horizon, the middle and the zenith with two smoothsteps at the stops'
// heights; this test mirrors that gradient (without the cosmic layer: test/trailer_skycurve.mjs measures the real
// shader in the game's pictures) and the composite's tone path (exposure, grade, the vivid ACES blend, saturation, the
// contrast curve, the display gamma), and checks:
//  - the palette by the sun's height: noon and 15:00 are day, 19:00 dusk, 23:00 night, 17:00 a blend; E carries the
//    middle stop, the four stop numbers and the four space numbers the renderer passes on
//  - by day, through the composite, at the band heights of the trailer's measure (a camera pitched up 12°, the horizon
//    line 10 rows above the geometric one): every band within ΔE 12 of the frames' day target (docs/trailer/sky_ref.json),
//    the luminance falling from a bright horizon (L* > 65) to a dark navy top (L* < 32, blue over red and green)
//  - at dusk the same against the dusk target; at night the zenith black-navy
//  - the far haze by day is the horizon's colour (ΔE < 15 through the composite), at dusk t-look's violet veil
//  t-sky2: by day the gradient is the ground under the space (the nebula and the stars lift its top half; the browser
//    test measures the whole): the lower bands within ΔE 12 of the day target, the haze over the horizon as the frames'
//    (its bottom's L* within 2, its width within the frames' range), the top a dark navy under the frames' mean, space
//    from the blue band (VR.Sky.space), E.skyDay (the haze band, the day weight) and the dusk's space as t-sky had it
//  - the sun's warm glow is halved by day, the halo tighter by day than at dusk
//  - rain greys and darkens all three stops; VR.Sky.on = 0 gives t-look's two colours back (the A/B switch)
// usage: node test/sky_stops.js
globalThis.VR = globalThis.VR || {};
require('./load_shared.js');
require('../src/main/weather.js'); require('../src/main/skybodies.js'); require('../src/main/env.js');
const SR = require('./sky_ref.js');
const ref = JSON.parse(require('fs').readFileSync(SR.REF, 'utf8'));
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const ss = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
const aces = (x) => clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0, 1);
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
// the composite (shaders.js COMPOSITE_FS) for one HDR colour, without bloom, rays and vignette
function display(c, E) {
  const x = c.map((v, i) => v * E.exposure * E.grade[i]);
  const f = x.map(aces), l = lum(x);
  let h = x.map(v => v * (aces(l) / Math.max(l, 1e-5)));
  const m = Math.max(...h);
  if (m > 1) h = h.map(v => v / m + (1 - v / m) * clamp((m - 1) * 0.35, 0, 1));
  let o = f.map((v, i) => v + (clamp(h[i], 0, 1) - v) * E.vivid);
  const l2 = lum(o); o = o.map(v => clamp(l2 + (v - l2) * E.saturation, 0, 1));
  o = o.map(v => v + (v * v * (3 - 2 * v) - v) * (E.contrast || 0));
  return o.map(v => 255 * Math.pow(clamp(v, 0, 1), 1 / 2.2));
}
// the gradient of skyColor: the three stops and the haze band at the horizon (the sun's glow left out: the views look away)
function grad(E, dy) {
  const h = Math.max(dy, 0), s = E.skyStops, s1 = ss(0, s[0], h), s2 = ss(s[1], s[2], h);
  let c = [0, 1, 2].map(i => { const a = E.horizon[i] + (E.skyMid[i] - E.horizon[i]) * s1; return a + (E.zenith[i] - a) * s2; });
  const q = 1 - h, dayK = 1 - E.night, z = E.skyDay || [0.6, 1, 0, 0], zh16 = Math.pow(1 - Math.min(1, h * z[1]), 16);   // t-sky2: the haze band from E.skyDay
  const hb = [E.horizon[0] * 1.16 + 0.035 * dayK, E.horizon[1] * 1.1 + 0.04 * dayK, E.horizon[2] * 1.02 + 0.03 * dayK];
  return c.map((v, i) => v + (hb[i] - v) * zh16 * z[0] * dayK + E.sunset[i] * Math.pow(q, 5) * 0.45 * 0.3);
}
const envAt = (tod, o) => { const env = new VR.Env(); env.setTime(tod); env.wx.setSeed(7); env.wx.force((o && o.kind) || 'klar'); for (let i = 0; i < 80; i++) env.update(1, { dim: 'overworld', biome: null, eyeSky: 1, renderDist: 10, horizon: 4096, freezeTime: true, freezeWeather: true }); return env.E; };
// the band heights of the measure: pitch 12°, vertical fov 72° at 360 rows, the horizon line 10 rows above the geometric
// one; each band averaged over its rows and over the picture's width (a row's height falls toward the picture's sides)
const t = Math.tan(36 * Math.PI / 180), asp = 16 / 9, P = 12 * Math.PI / 180, Hl = Math.round(180 + 180 / t * Math.tan(P)) - 10;
function curve(E) {
  const out = [];
  for (let k = 0; k < 8; k++) {
    const [ya, yb] = SR.bandRows(Hl, k), acc = [0, 0, 0]; let n = 0;
    for (let y = ya; y < yb; y += 2) for (let x = 0; x < 640; x += 32) {
      const nx = ((x + 16) / 640 * 2 - 1) * t * asp, ny = (1 - (y + 0.5) / 360 * 2) * t;
      const dy = (Math.sin(P) + Math.cos(P) * ny) / Math.hypot(1, nx, ny);
      const d = display(grad(E, dy), E); acc[0] += d[0]; acc[1] += d[1]; acc[2] += d[2]; n++;
    }
    out.push(acc.map(v => v / n));
  }
  return out;
}
const rgb = (c) => c.map(Math.round).join(',');
// t-sky2: the haze — the L* profile in the measure's 20 slices from the horizon line up, its bottom and where it falls
// under L* 60 (test/sky_ref.js hazeOf on the frames)
function haze(E) {
  const prof = [];
  for (let s = 0; s < SR.NSLICE; s++) {
    const ya = Math.round(Hl * (1 - (s + 1) / SR.NSLICE)), yb = Math.round(Hl * (1 - s / SR.NSLICE)); let acc = 0, n = 0;
    for (let y = ya; y < yb; y++) for (let x = 0; x < 640; x += 64) {
      const nx = ((x + 32) / 640 * 2 - 1) * t * asp, ny = (1 - (y + 0.5) / 360 * 2) * t;
      acc += SR.lab(display(grad(E, (Math.sin(P) + Math.cos(P) * ny) / Math.hypot(1, nx, ny)), E))[0]; n++;
    }
    prof.push(acc / n);
  }
  let width = null;
  for (let s = 1; s < prof.length; s++) if (prof[s] < SR.HAZE_L) { const a = prof[s - 1], b = prof[s]; width = (s - 0.5 + (a - SR.HAZE_L) / (a - b)) / SR.NSLICE; break; }
  return { L0: prof[0], width, prof };
}

console.log('== the palette by the time of day');
const S = VR.Sky;
check(!!S && S.on === 1 && ['day', 'dusk', 'night'].every(k => S[k].hor.length === 3 && S[k].mid.length === 3 && S[k].zen.length === 3 && S[k].stops.length === 4), 'VR.Sky: day, dusk and night, each with three stops and four stop numbers');
const noon = envAt(6000), t15 = envAt(9000), t17 = envAt(11000), dusk = envAt(13000), night = envAt(17000);
check(noon.skyMid && noon.skyStops.length === 4 && noon.skySpace.length === 4, 'E carries the middle stop, the stops [h1, h2a, h2b, halo] and the space [from, to, day, nebula by day]');
const near = (a, b, e) => a.every((v, i) => Math.abs(v - b[i]) < (e || 1e-6));
check(near(noon.horizon, S.day.hor) && near(noon.zenith, S.day.zen) && near(t15.skyMid, S.day.mid), 'noon and 15:00 have the day palette');
check(near(dusk.horizon, S.dusk.hor, 0.01) && near(dusk.skyMid, S.dusk.mid, 0.01), '19:00 has the dusk palette');
check(near(night.zenith, S.night.zen) && near(night.horizon, S.night.hor), '23:00 has the night palette');
check(!near(t17.horizon, S.day.hor, 0.01) && !near(t17.horizon, S.dusk.hor, 0.01), '17:00 blends the day into the dusk');

console.log('== by day, through the composite: the gradient under the space, against the trailer\'s day target');
const TH = ref.targets.day.haze, HW = Object.values(ref.frames).filter(f => f.kind === 'day' && f.haze && f.haze.width !== null).map(f => f.haze.width);
for (const [name, E] of [['noon', noon], ['15:00', t15]]) {
  const cv = curve(E), T = ref.targets.day.bands;
  const dE = cv.map((c, k) => SR.dE(SR.lab(c), T[k].lab));
  console.log(`   ${name}: ${cv.map(rgb).join(' | ')}`);
  console.log(`   ΔE ${dE.map(v => v.toFixed(1)).join(' ')}`);
  check(dE.slice(0, 4).every(v => v <= 12), `${name}: the lower bands (0–3, under the space) within ΔE 12 of the day target (worst ${Math.max(...dE.slice(0, 4)).toFixed(1)})`);
  const L = cv.map(c => SR.lab(c)[0]);
  check(L[0] > 65 && L.every((v, k) => k === 0 || v <= L[k - 1] + 1), `${name}: bright at the horizon (L* ${L[0].toFixed(0)}), falling band by band to the top (L* ${L[7].toFixed(0)})`);
  const top = cv[7], tl = SR.lab(top);
  check(tl[0] < T[7].L - 5 && top[2] > top[0] + 15 && top[2] > top[1] + 10, `${name}: the space's ground at the top is a dark navy under the frames' mean (${rgb(top)}, L* ${tl[0].toFixed(0)} vs ${T[7].L}: the nebula and the stars lift it)`);
  const hor = cv[0];
  check(hor[2] >= hor[1] && hor[1] > hor[0] + 20, `${name}: the horizon is white-cyan (${rgb(hor)})`);
  const hz = haze(E);
  console.log(`   haze profile ${hz.prof.map(v => v.toFixed(0)).join(' ')}`);
  check(Math.abs(hz.L0 - TH.L0) <= 2 && hz.width !== null && hz.width >= Math.min(...HW) && hz.width <= Math.max(...HW), `${name}: the haze over the horizon as the frames' (L* ${hz.L0.toFixed(1)} at the bottom vs ${TH.L0}; under L* ${SR.HAZE_L} from ${hz.width && hz.width.toFixed(3)} of the sky's height, the frames ${Math.min(...HW).toFixed(3)}–${Math.max(...HW).toFixed(3)}, median ${TH.width})`);
}
{
  const sp = noon.skySpace, sd = dusk.skySpace;
  check(sp[0] >= 0.12 && sp[0] <= 0.25 && sp[1] >= 0.35 && sp[1] <= 0.5 && sp[2] === 1, `by day space shows from the blue band: none under dir.y ${sp[0]}, all above ${sp[1]} (all of it: ${sp[2]}); the nebula's day brightness ${sp[3]}`);
  check(near(sd, [0.2, 0.7, 0.9, 0.55], 1e-6), `at dusk the space as t-sky had it (${sd.join(', ')}): the dusk and the night stay`);
  const zd = noon.skyDay, zk = dusk.skyDay;
  check(!!zd && !!zk && zd[2] === 1 && near(zd.slice(0, 2), S.haze) && zk[2] === 0 && near(zk.slice(0, 2), [0.6, 1]), `E.skyDay: by day the haze band ${zd ? zd.slice(0, 2).join(', ') : '—'} and the day weight 1; at dusk t-sky's band (0.6, 1) and 0`);
}
console.log('== at dusk and at night');
{
  const cv = curve(dusk), T = ref.targets.dusk.bands;
  const dE = cv.map((c, k) => SR.dE(SR.lab(c), T[k].lab));
  console.log(`   19:00: ${cv.map(rgb).join(' | ')}`);
  console.log(`   ΔE ${dE.map(v => v.toFixed(1)).join(' ')}`);
  check(dE.every(v => v <= 12), `19:00: every band within ΔE 12 of the dusk target (worst ${Math.max(...dE).toFixed(1)}; the sun's glow left out)`);
  const z = display(night.zenith, night);
  check(SR.lab(z)[0] < 12 && z[2] >= z[0], `23:00: the zenith is black-navy (${rgb(z)})`);
}
console.log('== the haze, the glow, the weather, the switch');
{
  const fog = display(noon.fogColor, noon), hor = display(noon.horizon, noon);
  check(SR.dE(SR.lab(fog), SR.lab(hor)) < 15, `by day the far haze is the horizon's colour (fog ${rgb(fog)}, horizon ${rgb(hor)})`);
  const veil = [0, 1, 2].map(i => dusk.horizon[i] + ([0.25, 0.22, 0.46][i] - dusk.horizon[i]) * 0.6);
  check(near(dusk.fogColor, veil, 1e-6), 'at dusk the far haze is t-look\'s violet veil');
  // the warm glow: the same sun height by day and with the day palette off
  const glowOn = t15.sunset[0];
  S.on = 0; const t15off = envAt(9000); S.on = 1;
  check(Math.abs(glowOn - t15off.sunset[0] * 0.5) < 1e-6, `the sun's warm glow is halved by day (${glowOn.toFixed(3)} vs ${t15off.sunset[0].toFixed(3)})`);
  check(noon.skyStops[3] < dusk.skyStops[3], `the sun's halo is tighter by day (${noon.skyStops[3]}) than at dusk (${dusk.skyStops[3].toFixed(2)})`);
  const rain = envAt(6000, { kind: 'regen' });
  const sat = (c) => (Math.max(...c) - Math.min(...c)) / Math.max(...c);
  check(['horizon', 'skyMid', 'zenith'].every(k => sat(rain[k]) < sat(noon[k]) && lum(rain[k]) < lum(noon[k])), 'rain greys and darkens all three stops');
  // the switch: t-look's two colours (the day horizon lilac, the zenith violet) and its veil
  S.on = 0; const off = envAt(6000); S.on = 1;
  check(off.horizon[0] > off.horizon[1] && off.zenith[2] > off.zenith[1] * 2 && near(off.skyStops, [0.25, 0.1, 1.0, 0.45]), `VR.Sky.on = 0: t-look's lilac horizon (${off.horizon.map(v => v.toFixed(2)).join(',')}) and violet zenith through the same stops`);
}
console.log(fails === 0 ? 'ALL OK' : 'FAILED ' + fails);
process.exit(fails ? 1 : 0);

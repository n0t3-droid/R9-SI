// t-polish2 · the golden hour's grade against the frames (gap 4 of docs/superpowers/plans/2026-10-16-t-polish2.md): the
// land of the golden pictures (test/land_ref.js's measure: the lower half's four bands and the split of the lightest over
// the darkest 15 %) with the grade of the pictures taken back out and the grade of this checkout put in — so a change of
// the golden stop (light2.js GRADE.gold) is measured against the frames before a browser runs. The grade is the last step
// of the frame (display space: the curve, the split toning, the mid-tones' saturation, the vignette — l2Grade), so the
// picture before it is recovered from the picture after it (each step inverted; clipped pixels stay as they are).
//   node test/land_grade.js [dir] [tag] — the pictures light2_<view>_golden_on_<tag>.png in dir (default t-light2's final
//   ones: /home/dev/vr/.worktrees/t-light2/test/shots, tag after); the grade they were made with: v0.48's (GRADE48 below)
//   EXPORTS: { gradeJS, ungradeJS, GRADE48 } for test/light2.js-style checks
// regress: skip  (a measurement over browser pictures that are not in the repository)
const fs = require('fs'), path = require('path');
const V = require('./load_shared.js');
require('../src/main/light2.js');
const L2 = V.Light2;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const sstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const lumaOf = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
// v0.48's grade (light2.js GRADE as merged in 92835e8): the pictures of the base were graded with it
const GRADE48 = {
  day: { toe: 0.014, mid: 0.5, s: 0.3, sh: 0.985, dark: [0.008, 0.004, -0.012], light: [-0.008, 0.002, 0.014], sat: 1.1, vig: 0.16 },
  gold: { toe: 0.016, mid: 0.5, s: 0.32, sh: 0.985, dark: [-0.02, 0.0, 0.04], light: [0.062, 0.022, -0.045], sat: 1.16, vig: 0.2 },
  dusk: { toe: 0.022, mid: 0.5, s: 0.28, sh: 0.975, dark: [0.01, -0.014, 0.05], light: [0.065, 0.018, -0.035], sat: 1.15, vig: 0.24 },
  night: { toe: 0.026, mid: 0.48, s: 0.25, sh: 0.97, dark: [-0.026, 0.016, 0.042], light: [0.055, 0.022, -0.028], sat: 1.08, vig: 0.28 },
};
// a table's grade at the moods m (light2.js L2.grade's blend)
const gradeAt = (T, m) => {
  const o = {};
  for (const k of ['toe', 'mid', 's', 'sh', 'sat', 'vig']) o[k] = m.day * T.day[k] + m.gold * T.gold[k] + m.dusk * T.dusk[k] + m.night * T.night[k];
  o.dark = [0, 1, 2].map(i => m.day * T.day.dark[i] + m.gold * T.gold.dark[i] + m.dusk * T.dusk.dark[i] + m.night * T.night.dark[i]);
  o.light = [0, 1, 2].map(i => m.day * T.day.light[i] + m.gold * T.gold.light[i] + m.dusk * T.dusk.light[i] + m.night * T.night.light[i]);
  o.g = Math.log(o.mid) / Math.log(0.5);
  return o;
};
const curve = (x, G) => { x = clamp(x, 0, 1); let y = Math.pow(x, G.g); y = y + (y * y * (3 - 2 * y) - y) * G.s; return G.toe + (G.sh - G.toe) * y; };
const uncurve = (y, G) => { let a = 0, b = 1; for (let i = 0; i < 30; i++) { const m = (a + b) / 2; if (curve(m, G) < y) a = m; else b = m; } return (a + b) / 2; };
const vigAt = (u, v, aspect, G) => { const x = (u - 0.5) * aspect, y = v - 0.5; return 1 - G.vig * sstep(0.25, 0.95, (x * x + y * y) * 2.2); };
// l2Grade in JS (display colour c 0..1 at uv → the picture's colour)
function gradeJS(c, u, v, aspect, G) {
  const k = [curve(c[0], G), curve(c[1], G), curve(c[2], G)];
  const l = lumaOf(k[0], k[1], k[2]), wd = (1 - l) * (1 - l), wl = l * l;
  let s = [0, 1, 2].map(i => k[i] + G.dark[i] * wd + G.light[i] * wl);
  const dl = lumaOf(s[0], s[1], s[2]) - l; s = s.map(x => x - dl);
  const mid = 1 - Math.abs(2 * l - 1), t = 1 + (G.sat - 1) * mid;
  s = s.map(x => l + (x - l) * t);
  const vg = vigAt(u, v, aspect, G);
  return s.map(x => clamp(x * vg, 0, 1));
}
// its inverse (the picture's colour → the display colour before the grade)
function ungradeJS(p, u, v, aspect, G) {
  const vg = vigAt(u, v, aspect, G);
  let s = p.map(x => x / vg);
  const l = lumaOf(s[0], s[1], s[2]), mid = 1 - Math.abs(2 * l - 1), t = 1 + (G.sat - 1) * mid;
  s = s.map(x => l + (x - l) / t);
  const wd = (1 - l) * (1 - l), wl = l * l, add = [0, 1, 2].map(i => G.dark[i] * wd + G.light[i] * wl), al = lumaOf(add[0], add[1], add[2]);
  const k = [0, 1, 2].map(i => s[i] - add[i] + al);
  return k.map(y => uncurve(clamp(y, G.toe, G.sh), G));
}
module.exports = { gradeJS, ungradeJS, GRADE48, gradeAt };

if (require.main === module) (async () => {
  const SR = require('./sky_ref.js'), LR = require('./land_ref.js');
  require('./dom_stub.js'); require('../src/main/weather.js'); require('../src/main/skybodies.js'); require('../src/main/env.js');
  const dir = process.argv[2] || '/home/dev/vr/.worktrees/t-light2/test/shots', tag = process.argv[3] || 'after';
  const VIEWS = (process.env.VIEWS || 'avenue,temple,hills,lake,villa,trees,hallcity').split(',');
  // the hour of the pictures (light2.mjs TIMES.golden 10800): the sun's height, the moods
  const env = new V.Env(); env.setTime(10800); env.update(0.016, { dim: 'overworld', eyeSky: 1, renderDist: 8, freezeTime: true, horizon: 0 });
  const m = L2.moods(env.E.sunDir[1]), G0 = gradeAt(GRADE48, m), G1 = gradeAt(L2.GRADE, m);
  console.log(`the golden pictures at 10800: the sun ${(Math.asin(env.E.sunDir[1]) * 180 / Math.PI).toFixed(1)}° up, moods ${JSON.stringify(Object.fromEntries(Object.entries(m).map(([k, v]) => [k, +v.toFixed(2)])))}`);
  // the frames' golden land (land_ref.js)
  const fr = [];
  for (const [name, F] of Object.entries(SR.FRAMES)) { if (F.kind !== 'golden') continue; const img = await SR.load(path.join(__dirname, '..', 'docs', 'trailer', 'frames', name + '.jpg')); const q = LR.landOf(img, F.H + 2, img.h); if (q) fr.push(q); }
  const med = (v) => { const s = [...v].sort((a, b) => a - b), k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };
  const T = { bands: [0, 1, 2, 3].map(k => [0, 1, 2].map(i => med(fr.map(f => f.bands[k][i])))), split: med(fr.map(f => f.split)) };
  let n = 0, dA = 0, dB = 0, sA = 0, sB = 0;
  for (const v of VIEWS) {
    const file = path.join(dir, `light2_${v}_golden_on_${tag}.png`);
    if (!fs.existsSync(file)) { console.log(`  (${v}: no picture)`); continue; }
    const img = await SR.load(file, 640, 360), out = { d: Buffer.alloc(img.d.length), w: img.w, h: img.h }, aspect = img.w / img.h;
    for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
      const o = (y * img.w + x) * 3, uu = (x + 0.5) / img.w, vv = 1 - (y + 0.5) / img.h, p = [img.d[o] / 255, img.d[o + 1] / 255, img.d[o + 2] / 255];
      const c = ungradeJS(p, uu, vv, aspect, G0), q = gradeJS(c, uu, vv, aspect, G1);
      out.d[o] = Math.round(q[0] * 255); out.d[o + 1] = Math.round(q[1] * 255); out.d[o + 2] = Math.round(q[2] * 255);
    }
    const a = LR.landOf(img, 180, 360), b = LR.landOf(out, 180, 360);
    const da = LR.dEb(a, T), db = LR.dEb(b, T);
    console.log(`  ${v.padEnd(9)} bands ΔE ${da.toFixed(1)} → ${db.toFixed(1)} · split ${a.split.toFixed(1)} → ${b.split.toFixed(1)} · the light's b* ${a.lightB.toFixed(1)} → ${b.lightB.toFixed(1)}, the shade's ${a.darkB.toFixed(1)} → ${b.darkB.toFixed(1)} · bands ${b.bands.map(q => q.map(z => z.toFixed(0)).join('/')).join(' ')}`);
    n++; dA += da; dB += db; sA += a.split; sB += b.split;
    if (process.env.OUT) await require('/home/dev/.npm-global/lib/node_modules/sharp')(out.d, { raw: { width: out.w, height: out.h, channels: 3 } }).png().toFile(path.join(process.env.OUT, `regraded_${v}.png`));
  }
  if (!n) { console.log('no pictures'); process.exit(1); }
  console.log(`the golden land against the frames' (bands ${T.bands.map(q => q.map(z => z.toFixed(0)).join('/')).join(' ')}, split ${T.split.toFixed(1)}): bands ΔE ${(dA / n).toFixed(2)} → ${(dB / n).toFixed(2)} · split ${(sA / n).toFixed(2)} → ${(sB / n).toFixed(2)} (${n} views)`);
})();

// t-light2 · the land's light against the trailer's frames (step 5 of docs/superpowers/plans/2026-10-15-t-light2.md).
// test/sky_ref.js measures the sky above the horizon; this measures the LAND below it — the frames' (docs/trailer/frames:
// the day, golden and dusk kinds with their horizon row H from sky_ref.js) and the game's (test/shots/light2_<view>_<time>
// _<config>_<TAG>.png: the lower half, where the views have their land), the frames' kind against the game's hour (day ↔
// noon, golden ↔ golden, dusk ↔ dusk; the frames have no night land: the night is the game's alone):
//   bands     4 bands from the horizon to the bottom: the trimmed mean colour (CIELAB)
//   split     the darkest 15 % of the land and the lightest 15 %: their mean b* (blue − / yellow +) — the frames' shade is
//             cool and their light warm (b*light − b*dark: the split), the game's grey-violet throughout
//   contrast  the land's L* spread (RMS) and its mean chroma C*
// The checks (the light off against on, TAG's pictures): with the light on the land is nearer the frames than with it
// off — the split of warm light over cool shade, the mean ΔE of the bands — at noon, the golden hour and dusk (the mean
// over the views); at night the shade keeps a cool lean and the lamps a warm one. No pictures: the frames only.
// usage: node test/land_ref.js  (TAG=after · OFF_TAG=… · VIEWS=avenue,… · after test/light2.mjs wrote its pictures)
// regress: skip  (a measurement over test/light2.mjs's pictures, which change with every run of it — the node gates of
// the light are test/light2.js; run this by hand after the browser run)
const fs = require('fs'), path = require('path');
const SR = require('./sky_ref.js');
const sharp = require('/home/dev/.npm-global/lib/node_modules/sharp');
const FRAMES_DIR = path.join(__dirname, '..', 'docs', 'trailer', 'frames');
const SHOTS = '/home/dev/vr/test/shots';   // (test/wt_run.sh points it at this checkout's)
const TAG = process.env.TAG || 'after', OFF_TAG = process.env.OFF_TAG || TAG;   // (OFF_TAG: the light-off pictures of another run)
const VIEWS = (process.env.VIEWS || 'avenue,temple,hills,lake,villa,trees,hallcity').split(',');
const KIND_OF = { noon: 'day', golden: 'golden', dusk: 'dusk' };
const NBL = 4;
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const r1 = (x) => Math.round(x * 10) / 10;
const median = (v) => { const s = [...v].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// the land of a picture: rows [y0, y1) (all columns) → bands, the split, the contrast
function landOf(img, y0, y1) {
  const px = [];
  for (let y = Math.max(0, y0); y < Math.min(img.h, y1); y++) for (let x = 0; x < img.w; x += 2) {
    const p = (y * img.w + x) * 3;
    px.push(SR.lab([img.d[p], img.d[p + 1], img.d[p + 2]]).concat([y]));
  }
  if (px.length < 200) return null;
  const bands = [];
  for (let k = 0; k < NBL; k++) {
    const a = y0 + (y1 - y0) * k / NBL, b = y0 + (y1 - y0) * (k + 1) / NBL;
    const v = px.filter(c => c[3] >= a && c[3] < b).sort((p, q) => p[0] - q[0]);
    const lo = Math.floor(v.length * 0.1), hi = Math.ceil(v.length * 0.9), m = [0, 0, 0];
    for (let i = lo; i < hi; i++) { m[0] += v[i][0]; m[1] += v[i][1]; m[2] += v[i][2]; }
    bands.push(m.map(x => x / Math.max(1, hi - lo)));
  }
  const byL = [...px].sort((p, q) => p[0] - q[0]), n = byL.length, q = Math.max(1, Math.floor(n * 0.15));
  const mean = (arr, i) => arr.reduce((s, c) => s + c[i], 0) / arr.length;
  const dark = byL.slice(0, q), light = byL.slice(n - q);
  const Lm = mean(px, 0), sd = Math.sqrt(px.reduce((s, c) => s + (c[0] - Lm) * (c[0] - Lm), 0) / n);
  const C = px.reduce((s, c) => s + Math.hypot(c[1], c[2]), 0) / n;
  return { bands, darkB: mean(dark, 2), lightB: mean(light, 2), darkL: mean(dark, 0), lightL: mean(light, 0), split: mean(light, 2) - mean(dark, 2), L: Lm, sd, C };
}
const dEb = (A, B) => A.bands.reduce((s, b, k) => s + SR.dE(b, B.bands[k]), 0) / A.bands.length;
module.exports = { landOf, dEb };
if (require.main === module) (async () => {
  // ---- the frames: the land below each frame's horizon
  const frames = {};
  for (const [name, F] of Object.entries(SR.FRAMES)) {
    if (!['day', 'golden', 'dusk'].includes(F.kind)) continue;
    const img = await SR.load(path.join(FRAMES_DIR, name + '.jpg'));
    const m = landOf(img, F.H + 2, img.h);
    if (m) frames[name] = Object.assign({ kind: F.kind }, m);
  }
  const target = {};
  for (const kind of ['day', 'golden', 'dusk']) {
    const fs_ = Object.values(frames).filter(f => f.kind === kind);
    if (!fs_.length) continue;
    target[kind] = {
      n: fs_.length,
      bands: [0, 1, 2, 3].map(k => [0, 1, 2].map(i => median(fs_.map(f => f.bands[k][i])))),
      split: median(fs_.map(f => f.split)), darkB: median(fs_.map(f => f.darkB)), lightB: median(fs_.map(f => f.lightB)),
      sd: median(fs_.map(f => f.sd)), C: median(fs_.map(f => f.C)), L: median(fs_.map(f => f.L)),
    };
  }
  console.log('the frames\' land (below the horizon): per kind the median of its frames');
  for (const [kind, t] of Object.entries(target)) console.log(`  ${kind.padEnd(6)} (${t.n}) L* ${r1(t.L)} ±${r1(t.sd)} · C* ${r1(t.C)} · the shade's b* ${r1(t.darkB)}, the light's ${r1(t.lightB)}: split ${r1(t.split)} · bands ${t.bands.map(b => b.map(r1).join('/')).join('  ')}`);
  // (by day the frames' lightest land is white-cyan — the pale paving and walls in the sun — and their darkest the warm
  // greens and trunks: a split under 0; from the golden hour the light is warm over a cool shade)
  check(target.day && target.golden && target.dusk && target.golden.split > 0 && target.dusk.split > target.golden.split && target.day.split < target.golden.split, `the frames: by day a white-cyan light (split ${target.day && r1(target.day.split)}), the golden hour warm over cool (${target.golden && r1(target.golden.split)}), dusk more so (${target.dusk && r1(target.dusk.split)})`);

  // ---- the game's pictures (when there are any)
  const shot = (v, t, c) => path.join(SHOTS, `light2_${v}_${t}_${c}_${c === 'off' ? OFF_TAG : TAG}.png`);
  const have = VIEWS.filter(v => fs.existsSync(shot(v, 'noon', 'on')) && fs.existsSync(shot(v, 'noon', 'off')));
  if (!have.length) { console.log(`(no pictures of TAG ${TAG} with the light on and off: the frames only)`); console.log(fails ? 'FAILED ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0); }
  const game = {};
  for (const v of have) for (const t of ['noon', 'golden', 'dusk', 'night']) for (const c of ['off', 'on']) {
    if (!fs.existsSync(shot(v, t, c))) continue;
    const img = await SR.load(shot(v, t, c), 640, 360);
    const m = landOf(img, 180, 360);
    if (m) game[`${v}_${t}_${c}`] = m;
  }
  console.log(`\nthe game's land (the lower half of ${have.join(', ')}, TAG ${TAG}): off → on, against the frames`);
  const avg = (keys, f) => { const v = keys.map(k => game[k]).filter(Boolean).map(f); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN; };
  for (const t of ['noon', 'golden', 'dusk']) {
    const T = target[KIND_OF[t]]; if (!T) continue;
    const off = have.map(v => `${v}_${t}_off`), on = have.map(v => `${v}_${t}_on`);
    const sOff = avg(off, g => g.split), sOn = avg(on, g => g.split), dOff = avg(off, g => dEb(g, T)), dOn = avg(on, g => dEb(g, T));
    const cOff = avg(off, g => g.sd), cOn = avg(on, g => g.sd);
    console.log(`  ${t.padEnd(6)} split ${r1(sOff)} → ${r1(sOn)} (frames ${r1(T.split)}) · contrast ±${r1(cOff)} → ±${r1(cOn)} (±${r1(T.sd)}) · bands ΔE ${r1(dOff)} → ${r1(dOn)}`);
    for (const v of have) { const a = game[`${v}_${t}_off`], b = game[`${v}_${t}_on`]; if (a && b) console.log(`     ${v.padEnd(9)} split ${r1(a.split)} → ${r1(b.split)} · shade b* ${r1(a.darkB)} → ${r1(b.darkB)} · light b* ${r1(a.lightB)} → ${r1(b.lightB)} · ±${r1(a.sd)} → ±${r1(b.sd)} · ΔE ${r1(dEb(a, T))} → ${r1(dEb(b, T))}`); }
    check(Math.abs(sOn - T.split) < Math.abs(sOff - T.split), `${t}: the split of warm light over cool shade nearer the frames with the light on (${r1(sOff)} → ${r1(sOn)}, frames ${r1(T.split)})`);
    check(dOn < dOff + 0.5, `${t}: the land's bands no further from the frames (ΔE ${r1(dOff)} → ${r1(dOn)})`);
  }
  // the night: the shade cool, the lamps warm (the frames have no night land: the rule of the plan)
  const nOn = have.map(v => game[`${v}_night_on`]).filter(Boolean);
  if (nOn.length) {
    const dB = nOn.reduce((s, g) => s + g.darkB, 0) / nOn.length;
    check(dB < 0, `night: the shade leans cool (its b* ${r1(dB)}, the mean of ${nOn.length} views)`);
  }
  console.log(fails ? 'FAILED ' + fails : 'ALL OK');
  process.exit(fails ? 1 : 0);
})();

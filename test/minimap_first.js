// The minimap's first picture (a-session; plan docs/superpowers/plans/2026-10-31-a-session.md §2.3, f-hud's self-review
// 3: a black disc at 4 s in a new Abenteuer world): src/main/map.js MapView.update on a stand-in world whose columns
// arrive after the first frames.
//  a · a slow machine (dt 1 s a frame — SwiftShader's start): the columns arrive at frame 3 → the picture is whole
//      (≤ 10 % of it unloaded) by frame 4 — not after the eight frames of 16-row passes;
//  b · a fast one (dt 1/60): while columns are missing the whole-picture passes come at most every 0.25 s (the cost
//      bounded: ≤ 6 of them in the first 1.5 s), then the 16-row passes as before (≤ 16 × 128 samples a frame);
//  c · a world loaded from the start: one whole pass, then the 16-row passes (unchanged).
//   bash test/wt_run.sh minimap_first.js 120
const path = require('path');
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const ctx2d = () => ({ createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }), putImageData() {}, clearRect() {}, save() {}, restore() {}, beginPath() {}, arc() {}, clip() {}, fillRect() {}, translate() {}, rotate() {}, scale() {}, drawImage() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {}, stroke() {}, fillText() {}, strokeText() {} });
const el = () => ({ width: 180, height: 180, style: {}, getContext: ctx2d, addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) });
global.document = { getElementById: () => el(), createElement: () => el() };
global.window = global.window || { addEventListener() {} };
global.performance = global.performance || { now: () => Date.now() };
global.VR = global.VR || {};
VR.R = { T: { tex: new Uint16Array(64 * 6), tint: new Uint8Array(64), flags: new Uint32Array(64) } };
VR.F = { WATER: 1 << 9 };
require(path.join(__dirname, '..', 'src/main/map.js'));
const MV = VR.MapView;
function world(loadAt) {
  const W = { frame: 0, samples: 0, col(cx, cz) { W.samples++; if (W.frame < loadAt) return null; return COL; } };
  const COL = { height: new Uint8Array(256).fill(64), blocks: new Uint16Array(256 * 256), grass: new Uint16Array(256), water: new Uint16Array(256), foliage: new Uint16Array(256) };
  for (let i = 0; i < 256; i++) COL.blocks[(64 << 8) | i] = 1;
  return W;
}
function game(w) {
  return { world: w, settings: { minimap: true }, state: 'play', hideHud: false, photo: false, player: { pos: [8.5, 65, 8.5], yaw: 0 }, tex: { avgColor: new Float32Array(4096 * 4).fill(0.5) }, gadgets: { waypoints: [] }, villages: null, wonders: null, mp: null, entities: { mobs: [] } };
}
// the share of the last finished picture still unloaded (the dark fill 8, 10, 18)
const dark = (mv) => { const d = mv.img.data; let n = 0, k = 0; for (let i = 0; i < d.length; i += 4) { n++; if (d[i] === 8 && d[i + 1] === 10 && d[i + 2] === 18) k++; } return k / n; };
// a · slow
{
  const w = world(3), g = game(w), mv = new MV(g); let whole = -1;
  for (let f = 0; f < 12; f++) { w.frame = f; mv.update(1); if (whole < 0 && mv.snap && f >= 3 && dark(mv) <= 0.1) whole = f; }
  check(whole >= 0 && whole <= 4, `a slow start (1 s a frame, the columns at frame 3): the minimap whole by frame ${whole} (≤ 4)`);
}
// b · fast
{
  const w = world(60), g = game(w), mv = new MV(g); let wholes = 0, worst = 0;
  for (let f = 0; f < 150; f++) {
    w.frame = f; const s0 = w.samples; mv.update(1 / 60); const n = w.samples - s0;
    if (n >= 128 * 128) { if (f < 90) wholes++; } else worst = Math.max(worst, n);
  }
  check(wholes >= 2 && wholes <= 7, `a fast start (1/60 s, the columns at frame 60): ${wholes} whole passes in the first 1.5 s (2–7: at most every 0.25 s)`);
  check(dark(mv) <= 0.1, `… the picture whole after the columns came (${(dark(mv) * 100).toFixed(0)} % dark)`);
  check(worst <= 16 * 128 * 3 + 16, `… the other frames sample ≤ 16 rows (${worst} column reads at most)`);
}
// c · loaded from the start
{
  const w = world(0), g = game(w), mv = new MV(g); const per = [];
  for (let f = 0; f < 20; f++) { w.frame = f; const s0 = w.samples; mv.update(1 / 60); per.push(w.samples - s0); }
  check(per[0] >= 128 * 128 && per.slice(1).every(n => n <= 16 * 128 * 3 + 16), `a loaded world: one whole pass (${per[0]} reads), then 16-row passes (max ${Math.max(...per.slice(1))})`);
}
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);

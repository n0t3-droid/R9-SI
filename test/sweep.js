// 📊 Stufentest (src/main/sweep.js): every quality step measured in turn on the scene the player stands in, no DOM.
//  (a) the plan: the presets in order from Very Low to Ultra (and Ultra · Leicht when the build has it), each once
//  (b) the run on a fake game: a preset is applied with the governor off, settles 1.2 s, is measured 3 s (wall clock,
//      frames after the first half second), then the next; the settings before the test come back untouched at the end
//  (c) the verdict: the highest step whose slow frames (p90) still make 50 fps is 'flüssig', the highest with a median
//      of 30 fps 'spielbar'; none → the lowest step
//  (d) the record: the result goes to localStorage r9si.sweep (when, the GPU, the table) and reads back
//  (e) the text: one line per step in German and English (the texts via I18N keys, both tables, test/lang.js)
//  (f) a second start while one runs is refused; a start without a world is refused
//   bash test/wt_run.sh sweep.js
require('./dom_stub.js');
globalThis.VR = {};
require('../src/main/i18n.js'); require('../src/main/lang_en.js'); require('../src/main/lang_de.js');
require('../src/main/bench.js');
require('../src/main/sweep.js');
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
const SW = VR.Sweep;
if (!SW) { console.log('VR.Sweep missing'); console.log('FAILED 1'); process.exit(1); }
const PRESETS = { potato: { scale: 0.55, renderDist: 4, dynRes: true }, low: { scale: 0.75, renderDist: 6, dynRes: true }, balanced: { scale: 0.9, renderDist: 10, dynRes: true }, high: { scale: 1, renderDist: 14, dynRes: true }, ultra: { scale: 1, renderDist: 16, dynRes: true } };

console.log('a · the plan');
check(JSON.stringify(SW.plan(PRESETS)) === JSON.stringify(['potato', 'low', 'balanced', 'high', 'ultra']), 'five steps in order', JSON.stringify(SW.plan(PRESETS)));
check(JSON.stringify(SW.plan(Object.assign({ ultraLite: {} }, PRESETS))) === JSON.stringify(['potato', 'low', 'balanced', 'high', 'ultraLite', 'ultra']), 'Ultra · Leicht, when the build has it, before Ultra');

// a fake game: a clock, settings, the frame rate the fake GPU gives per preset
let now = 0;
globalThis.performance = { now: () => now };
function fakeGame(fpsOf) {
  const g = {
    state: 'play', world: {}, settings: { preset: 'high', renderDist: 14, scale: 1, dynRes: true, fov: 75, bau: 'site' },
    applied: [], saved: 0, PRESETS, ui: { msgs: [], sweepStep(p, i, n) { this.msgs.push('step ' + p + ' ' + i + '/' + n); }, sweepDone(r) { this.msgs.push('done ' + r.results.length); this.result = r; } },
    applyPreset(p) { this.settings.preset = p; Object.assign(this.settings, PRESETS[p]); this.applied.push(p); this.applySettings('*'); this.saveSettings(); },
    applySettings() { this.applies = (this.applies || 0) + 1; }, saveSettings() { this.saved++; },
    // the loop: frames at the fake GPU's rate for the current preset, the governor's state visible
    frames(seconds) { const f = fpsOf(this.settings.preset); const n = Math.round(seconds * f); for (let i = 0; i < n; i++) { now += 1000 / f; if (this.sweep) this.sweep.tick(); } },
  };
  return g;
}
const RATE = { potato: 80, low: 60, balanced: 45, high: 32, ultra: 21 };

console.log('b · the run');
{
  const g = fakeGame((p) => RATE[p]);
  const before = JSON.stringify(g.settings);
  const sw = new SW(g); g.sweep = sw;
  check(sw.start() === true, 'starts in play');
  check(g.applied[0] === 'potato' && g.settings.dynRes === false, 'the first step is applied with the governor off', JSON.stringify(g.applied));
  g.frames(1.0);
  check(sw.results.length === 0 && sw.phase === 'settle', 'settling: nothing measured in the first second', sw.phase);
  g.frames(0.4);
  check(sw.phase === 'measure', 'measuring after 1.2 s', sw.phase);
  g.frames(3.2);
  check(sw.results.length === 1 && sw.results[0].preset === 'potato' && Math.abs(sw.results[0].fps - 80) < 2, 'the first step measured: ~80 fps', JSON.stringify(sw.results[0]));
  check(g.applied[1] === 'low', 'the next step follows at once');
  for (let i = 0; i < 4; i++) g.frames(4.6);
  check(sw.results.length === 5 && !g.sweep, 'all five steps measured, the test over', sw.results.map((r) => r.preset + ' ' + Math.round(r.fps)).join(', '));
  check(JSON.stringify(g.settings) === before, 'the settings from before the test are back (preset, view distance, governor)', JSON.stringify(g.settings));
  check(g.saved >= 1 && g.applies >= 6, 'applied and saved');
  check(g.ui.msgs[0] === 'step potato 1/5' && g.ui.msgs[5] === 'done 5', 'the UI hears every step and the end', g.ui.msgs.join(' | '));
  const r = sw.results.map((x) => Math.round(x.fps));
  check(r[0] > r[1] && r[1] > r[2] && r[2] > r[3] && r[3] > r[4], 'the frame rates fall from Very Low to Ultra', r.join(' > '));
  check(sw.results.every((x) => x.n >= 50 && x.p90fps > 0), 'every step counted its frames and a p90', JSON.stringify(sw.results.map((x) => x.n)));
}

console.log('c · the verdict');
{
  const res = (fps) => Object.keys(fps).map((p) => ({ preset: p, fps: fps[p], p90fps: fps[p] * 0.85, n: 100 }));
  let v = SW.pick(res({ potato: 80, low: 60, balanced: 45, high: 32, ultra: 21 }));
  check(v.smooth === 'low' && v.playable === 'high', 'smooth = the highest step whose p90 makes 50 fps (Low: 51), playable = median 30 fps (High)', JSON.stringify(v));
  v = SW.pick(res({ potato: 200, low: 150, balanced: 120, high: 90, ultra: 70 }));
  check(v.smooth === 'ultra' && v.playable === 'ultra', 'a strong machine: Ultra for both');
  v = SW.pick(res({ potato: 25, low: 20, balanced: 15, high: 10, ultra: 7 }));
  check(v.smooth === 'potato' && v.playable === 'potato' && v.smoothOk === false && v.playableOk === false, 'a weak machine: the lowest step named for both, neither mark reached');
  VR.I18N.lang = 'de';
  check(/keine Stufe ganz \(Sehr niedrig kommt am nächsten\)/.test(SW.text({ results: res({ potato: 25, low: 20 }), smooth: 'potato', playable: 'potato', smoothOk: false, playableOk: false })), 'the text says that no step reaches the mark');
  v = SW.pick(res({ potato: 80, low: 70, balanced: 65, high: 30, ultra: 21 }));
  check(v.smooth === 'balanced' && v.playable === 'high', 'a jump in the ladder: Balanced smooth, High playable');
  check(SW.pick([]).smooth === null, 'no results: no verdict');
}

console.log('d · the record');
{
  const g = fakeGame((p) => RATE[p]);
  VR.GL = { rendererName: 'ANGLE (AMD, AMD Radeon Graphics (0x1638))' };
  const sw = new SW(g); g.sweep = sw; sw.start();
  for (let i = 0; i < 5; i++) g.frames(4.6);
  const rec = SW.last();
  check(rec && rec.results.length === 5 && rec.gpu.indexOf('Radeon') >= 0 && rec.when > 0, 'the record reads back: table, GPU, time', rec && rec.gpu);
  check(rec.smooth === 'low' && rec.playable === 'high', 'with the verdict', rec.smooth + ' / ' + rec.playable);
  localStorage.setItem('r9si.sweep', '{broken');
  check(SW.last() === null, 'a damaged record reads as none');
  localStorage.removeItem('r9si.sweep');
  check(SW.last() === null, 'no record: none');
}

console.log('e · the text');
{
  const r = { results: [{ preset: 'potato', fps: 80.4, p90fps: 70 }, { preset: 'low', fps: 60, p90fps: 52 }, { preset: 'balanced', fps: 45, p90fps: 38 }, { preset: 'high', fps: 32, p90fps: 27 }, { preset: 'ultra', fps: 21, p90fps: 17 }], smooth: 'low', playable: 'high' };
  VR.I18N.lang = 'de';
  const de = SW.text(r);
  check(/Sehr niedrig 80 fps/.test(de) && /Ultra 21 fps/.test(de), 'German: every step with its fps', de);
  check(/[Rr]uckelfrei[^.]*Niedrig/.test(de) && /[Ss]pielbar[^.]*Hoch/.test(de), 'German: the verdict names the steps', de);
  VR.I18N.lang = 'en';
  const en = SW.text(r);
  check(/Very Low 80 fps/.test(en) && /smooth[^.]*Low/i.test(en) && /playable[^.]*High/i.test(en), 'English: the same', en);
  VR.I18N.lang = 'de';
  check(/Sehr niedrig 25 fps/.test(SW.text({ results: [{ preset: 'potato', fps: 25, p90fps: 20 }], smooth: 'potato', playable: 'potato' })), 'one step');
}

console.log('f · refusals');
{
  const g = fakeGame((p) => RATE[p]);
  const sw = new SW(g); g.sweep = sw;
  check(sw.start() === true && sw.start() === false, 'a second start while running is refused');
  const g2 = fakeGame((p) => RATE[p]); g2.state = 'title'; g2.world = null;
  const sw2 = new SW(g2); g2.sweep = sw2;
  check(sw2.start() === false && g2.applied.length === 0, 'no world: refused, nothing applied');
  const g3 = fakeGame((p) => RATE[p]); g3.bench = {};
  const sw3 = new SW(g3); g3.sweep = sw3;
  check(sw3.start() === false, 'the Automatik runs: refused');
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

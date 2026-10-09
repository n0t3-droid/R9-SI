// F9 · Ultra runs the smart quality (game.js), no browser:
//  a · presets: Ultra runs smart quality and keeps its picture; the other presets and Very Low are as before; a saved choice stays
//  b · the governor on Ultra: a slow machine takes the steps and keeps the view distance; a fine one takes them back
//  c · the memory per GPU (localStorage r9si.aqmem): key, read, write, damaged store, cap of 24 entries, cleaned strings
//  d · the start: the remembered steps go on at the first frame of play (no probe), and wait before they are taken back
//   bash test/wt_run.sh ultra_smart.js
require('./dom_stub.js');
const V = require('./load_shared.js');
require('../src/main/i18n.js'); require('../src/main/lang_en.js'); require('../src/main/lang_de.js');
require('../src/main/settings_reg.js');
require('../src/main/game.js');
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
const G = V.Game, P = G && G.PRESETS;
if (!P) { console.log('VR.Game.PRESETS missing'); console.log('FAILED 1'); process.exit(1); }
const proto = G.prototype;
// the governor's methods on a stand-in game object (the same way far_presets.js calls them)
const GOV = ['smartQuality', 'aqState', 'aqGpuRungs', 'aqCpuRungs', 'aqPush', 'aqPop', 'aqReset', 'aqApply', 'aqRemember', 'aqRestoreSteps', 'aqRestoreStart', 'aqMemKey', 'aqMemRead', 'aqMemWrite'];
function stand(over) {
  const g = { renderer: { gpuMs: undefined, setOverride() {} }, jsMs: 4, fps: 0, time: 0, slowBase: false, folkBase: 120, folkDist: 120, horizon: null, bench: false, world: null, state: 'play', aqChanged() {} };
  for (const k of GOV) g[k] = proto[k];
  return Object.assign(g, over || {});
}
const memRaw = () => JSON.parse(localStorage.getItem('r9si.aqmem') || '{}');
const ULTRA = Object.assign({ preset: 'ultra' }, P.ultra);

console.log('a · presets');
check(P.ultra.dynRes === true, 'Ultra runs smart quality (dynRes on)');
check(['potato', 'low', 'balanced', 'high'].every(k => P[k].dynRes === true), 'the other presets run it as before');
check(P.potato.scale === 0.55 && P.potato.renderDist === 4 && P.potato.horizon === 2 && P.potato.upload === 1.5 && P.potato.shadows === 0 && P.potato.bloom === false && P.potato.rays === false && P.potato.lite === true && P.potato.vxLod === 12 && P.potato.folk === 32, 'Very Low: the same values as before');
check(P.ultra.scale === 1 && P.ultra.shadows === 3 && P.ultra.renderDist === 16 && P.ultra.far === 64 && P.ultra.rdMax === 32 && P.ultra.tsr === true && P.ultra.vxLod === 96, 'Ultra keeps its picture (scale 1, shadows 3, view 16, ring 1 64, rdMax 32, vxLod 96)');
{
  localStorage.setItem('r9si.settings', JSON.stringify({ preset: 'ultra', dynRes: false }));
  check(proto.loadSettings.call({}).dynRes === false, 'a saved choice stays as it is (re-pick Ultra once to get the new default)');
  localStorage.removeItem('r9si.settings');
}

console.log('b · the governor on Ultra');
{
  // a frame-rate model: 26 fps with nothing taken, 6 fps more per step taken (60 at most); 80 fps once the load is gone
  const w = { renderDist: 16, meshBudget: 6, streamRung: 0 };
  const g = stand({ settings: ULTRA, world: w });
  let over = null, depthMax = 0, rdMin = 99, sawRaysOff = false;
  g.renderer.setOverride = (o) => { over = o; };
  const sec = (s, fpsOf) => {
    for (let t = 0; t < s;) {
      const aq = g.aqState(), f = fpsOf(aq.stack.length);
      g.fps = f; g.renderer.gpuMs = 1000 / f * 0.9; g.jsMs = 4;
      const dt = 1 / f; g.time += dt; t += dt;
      g.smartQuality(dt, ULTRA, w);
      depthMax = Math.max(depthMax, aq.stack.length); rdMin = Math.min(rdMin, w.renderDist);
      if (over && over.rays === false) sawRaysOff = true;
    }
  };
  const slow = (d) => Math.min(60, 26 + 6 * d), fine = () => 80;
  sec(40, slow);
  const aq = g.aqState();
  check(depthMax >= 2 && aq.stack.length >= 2, 'a slow machine takes steps: the governor climbs the ladder', 'depth ' + depthMax + ', now ' + aq.stack.join(''));
  check(sawRaysOff, 'deeper on the ladder the sun rays go off (the renderer got it; F9: Ultra\'s cheap rungs come first)');
  check(aq.g <= 7 && aq.c <= 5, 'never more steps than the ladders have');
  check(rdMin === 16, 'the view distance is never lowered (16 chunks all the time)', 'lowest ' + rdMin);
  // (the frame-rate window is two seconds behind, so ten fine seconds count from about the fourth second of fine frames)
  sec(16, fine);
  const mid = memRaw()['gpu|ultra'];
  check(mid && /^[gc]+$/.test(mid.s) && mid.s.length <= depthMax, 'after ten fine seconds the depth is remembered for the GPU', mid ? mid.s : 'nothing');
  sec(60, fine);
  check(g.aqState().stack.length === 0, 'the load is gone: the steps come back one by one');
  check(!memRaw()['gpu|ultra'], 'a machine that holds full Ultra clears its entry (nothing remembered)');
  check(rdMin === 16, 'still 16 chunks after the whole run');
}

console.log('c · the memory per GPU');
{
  const g = stand({});
  const key = g.aqMemKey('Intel(R) UHD Graphics 620', 'ultra');
  check(key === 'Intel(R) UHD Graphics 620|ultra' && g.aqMemKey('', '') === 'gpu|custom', 'the key: the GPU name and the preset (stand-ins when missing)');
  g.aqMemWrite(key, 'ggc');
  check(g.aqMemRead(key) === 'ggc' && memRaw()[key].s === 'ggc', 'written, and read back');
  check(g.aqMemRead('other GPU|ultra') === '' && g.aqMemRead(g.aqMemKey('Intel(R) UHD Graphics 620', 'high')) === '', 'another GPU or another preset reads nothing');
  localStorage.setItem('r9si.aqmem', '{not json');
  let threw = false;
  try { check(g.aqMemRead(key) === '', 'a damaged store reads as nothing (no throw)'); g.aqMemWrite(key, 'gg'); } catch (e) { threw = true; }
  check(!threw && g.aqMemRead(key) === 'gg', 'a damaged store is replaced by the next write');
  g.aqMemWrite(key, '');
  check(g.aqMemRead(key) === '' && !(key in memRaw()), 'an empty write removes the entry');
  for (let i = 0; i < 30; i++) g.aqMemWrite('gpu' + i + '|ultra', 'g');
  const ks = Object.keys(memRaw());
  check(ks.length === 24 && g.aqMemRead('gpu29|ultra') === 'g' && g.aqMemRead('gpu0|ultra') === '', 'at most 24 entries, the oldest go first', ks.length + ' kept');
  localStorage.setItem('r9si.aqmem', JSON.stringify({ [key]: { s: 'x g-c' + 'g'.repeat(40), t: 1 } }));
  const clean = g.aqMemRead(key);
  check(/^[gc]*$/.test(clean) && clean.length <= 24 && clean.length > 0, 'a stored string is cleaned: only g and c, at most 24 steps', clean.length + ' steps');
  localStorage.removeItem('r9si.aqmem');
}

console.log('d · the start');
{
  const key = proto.aqMemKey.call({}, undefined, 'ultra');   // 'gpu|ultra' (no GPU name in node)
  localStorage.setItem('r9si.aqmem', JSON.stringify({ [key]: { s: 'ggc', t: Date.now() } }));
  const w = { renderDist: 16, meshBudget: 6, streamRung: 0 };
  const g = stand({ settings: Object.assign({}, ULTRA), world: w });
  let over = null;
  g.renderer.setOverride = (o) => { over = o; };
  g.aqRestoreStart();
  const aq = g.aqState();
  check(aq.pending === 'ggc' && aq.memS === 'ggc', 'at the start the remembered steps wait for the first frame of play', aq.pending);
  check(aq.stack.length === 0, 'nothing is taken before the world runs');
  g.fps = 30; g.renderer.gpuMs = 34; g.time = 5;
  g.smartQuality(1 / 30, g.settings, w);
  check(aq.stack.join('') === 'ggc' && aq.pending === '', 'the first frame of play takes them, the same steps', aq.stack.join(''));
  check(over && over.shadowEvery === 2 && over.reflLite === true, 'the renderer gets the steps at once (F9: Ultra\'s cheap rungs — shadows every other frame, the light mirror)');
  check(aq.backoff >= 30 && aq.hold > 0, 'the governor waits before it takes any of them back');
  const gOff = stand({ settings: Object.assign({}, ULTRA, { dynRes: false }) });
  gOff.aqRestoreStart();
  check(gOff.aqState().pending === '', 'with smart quality off nothing is restored');
  const other = stand({ settings: Object.assign({ preset: 'balanced' }, P.balanced) });
  other.aqRestoreStart();
  check(other.aqState().pending === '', 'an entry for another preset is not taken');
  localStorage.removeItem('r9si.aqmem');
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

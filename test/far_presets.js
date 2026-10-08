// F-Far · the presets, the settings and the governor (game.js, settings_reg.js), no browser:
//  a · ring 1 (far) on High and Ultra only, 64 chunks; the render-distance slider's top (rdMax) 32 on Ultra, 24 elsewhere;
//      Very Low, Low and Balanced keep their old values
//  b · the quality governor never lowers the rings: no rung of either ladder touches the render distance, the horizon or
//      ring 1; with every rung taken, the world's renderDist, the horizon level and ring 1's radius are what the preset asked
//  c · saved settings from before the rings follow their preset (custom: ring 1 from renderDist 14 on)
//  d · the slider: its top follows rdMax (32 on Ultra), snapFor keeps a value inside it
//   bash test/wt_run.sh far_presets.js
require('./dom_stub.js');
const V = require('./load_shared.js');
require('../src/main/i18n.js'); require('../src/main/lang_en.js'); require('../src/main/lang_de.js');
require('../src/main/settings_reg.js');
require('../src/main/game.js');
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
const G = V.Game, P = G && G.PRESETS;
if (!P) { console.log('VR.Game.PRESETS missing'); console.log('FAILED 1'); process.exit(1); }

console.log('a · presets');
check(P.potato.far === 0 && P.low.far === 0 && P.balanced.far === 0, 'Very Low, Low, Balanced: no ring 1');
check(P.high.far === 64 && P.ultra.far === 64, 'High and Ultra: ring 1 out to 64 chunks (~1 km)');
check(P.ultra.rdMax === 32 && ['potato', 'low', 'balanced', 'high'].every(k => P[k].rdMax === 24), 'the render distance\'s top: 32 on Ultra, 24 elsewhere');
check(P.potato.renderDist === 4 && P.low.renderDist === 6 && P.balanced.renderDist === 10 && P.high.renderDist === 14 && P.ultra.renderDist === 16, 'ring 0 as before: 4 · 6 · 10 · 14 · 16 chunks');
check(P.potato.horizon === 2 && P.potato.upload === 1.5 && P.potato.scale === 0.55 && P.potato.lite === true, 'Very Low otherwise unchanged (horizon 2, upload 1.5, scale 0.55, lite)');

console.log('b · the governor never lowers the rings');
{
  const S = Object.assign({ preset: 'high' }, P.high);
  const proto = G.prototype, gl = proto.aqGpuRungs.call({}, S), cl = proto.aqCpuRungs.call({}, S);
  const o = {}; for (const f of gl) f(o); for (const f of cl) f(o);
  const bad = ['rd', 'hz', 'far', 'renderDist', 'horizon', 'r1'].filter(k => o[k] !== undefined);
  check(bad.length === 0, 'no rung sets rd, hz, far or the horizon', gl.length + ' picture rungs, ' + cl.length + ' main-thread rungs' + (bad.length ? ': ' + bad.join() : ''));
  for (const preset of ['high', 'ultra', 'potato']) {
    const S2 = Object.assign({ preset }, P[preset]);
    let level = S2.horizon, far = S2.far;
    const fake = {
      renderer: { setOverride() {} }, aqChanged() {},
      horizon: { get level() { return level; }, setLevel(l) { level = l; }, setFar(r) { far = r; } },
      aqGpuRungs: proto.aqGpuRungs, aqCpuRungs: proto.aqCpuRungs,
    };
    const w = { renderDist: S2.renderDist };
    const aq = { g: proto.aqGpuRungs.call(fake, S2).length, c: proto.aqCpuRungs.call(fake, S2).length, hzBase: -1, stack: [] };
    proto.aqApply.call(fake, aq, S2, w);
    // (the world's distance never drops under the preset's; game.js keeps at least 5 chunks, so Very Low's 4 reads 5)
    check(w.renderDist >= S2.renderDist && level === S2.horizon && far === S2.far, preset + ': every rung taken, no ring is lowered', 'renderDist ' + w.renderDist + ' (preset ' + S2.renderDist + '), horizon ' + level + ', ring 1 ' + far);
  }
}

console.log('c · settings saved before the rings');
{
  const load = (saved) => { localStorage.setItem('r9si.settings', JSON.stringify(saved)); return G.prototype.loadSettings.call({}); };
  check(load({ preset: 'high', renderDist: 14 }).far === 64 && load({ preset: 'ultra' }).rdMax === 32, 'High and Ultra saved before: ring 1 on, Ultra\'s top 32');
  check(load({ preset: 'potato', renderDist: 4 }).far === 0 && load({ preset: 'balanced' }).far === 0, 'Very Low and Balanced saved before: no ring 1');
  check(load({ preset: 'custom', renderDist: 24 }).far === 64 && load({ preset: 'custom', renderDist: 10 }).far === 0 && load({ preset: 'custom', renderDist: 20, lite: true }).far === 0, 'custom: ring 1 from renderDist 14 on, not on the lite look');
  check(load({ preset: 'high', far: 0 }).far === 0, 'a saved choice stays as it is');
  localStorage.removeItem('r9si.settings');
}

console.log('d · the slider');
{
  const S = V.Settings, rd = S.byKey('renderDist');
  check(S.maxOf(rd, { rdMax: 32 }) === 32 && S.maxOf(rd, { rdMax: 24 }) === 24 && S.maxOf(rd, {}) === 24, 'the top: 32 with Ultra\'s rdMax, 24 otherwise');
  check(S.snapFor(rd, 40, { rdMax: 32 }) === 32 && S.snapFor(rd, 30, { rdMax: 24 }) === 24 && S.snapFor(rd, 27.6, { rdMax: 32 }) === 28, 'snapFor keeps the value inside its top');
  check(S.snap(rd, 99) === 24, 'the registry\'s own snap is unchanged (24)');
  const de = V.I18N.dict.de['g.set.renderDist.tip'], en = V.I18N.dict.en['g.set.renderDist.tip'];
  check(/Ring 0/.test(de) && /Ring 1/.test(de) && /Ring 2/.test(de) && /ring 1/.test(en) && /1 km/.test(de + en), 'the tip says what the rings are (German and English)');
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

// F10 · Bandbreite: the five switches in the settings and the presets (game.js, settings_reg.js, ipu.js), no browser:
//  a · the presets: off on every preset but Ultra · Leicht (on there — texLite aside: no preset turns it on, it softens far
//      slopes); a switch changed by hand makes it „Eigene"
//  b · an integrated GPU (the owner's Radeon Graphics through ANGLE): any preset turns them on (Very Low: not zPre); the
//      first start on that GPU turns them on once, a switch changed by hand stays until the next preset change; a dedicated
//      GPU and SwiftShader keep the presets' values
//  c · applySettings hands them to the renderer (its qBase), dprCap only on Ultra · Leicht
//  d · the settings rows: Bild · Qualität, a switch each, cost low, label and tip in both languages
//   bash test/wt_run.sh ipu_preset.js
require('./dom_stub.js');
const V = require('./load_shared.js');
require('../src/main/i18n.js'); require('../src/main/lang_en.js'); require('../src/main/lang_de.js');
require('../src/main/settings_reg.js');
require('../src/main/bench.js');
require('../src/main/ultralite.js');
require('../src/main/ipu.js');
require('../src/main/game.js');
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
const G = V.Game, P = G && G.PRESETS, proto = G && G.prototype, IPU = V.IPU;
const SW = ['hdrLite', 'postLite', 'zPre', 'texLite', 'dprLite'];
if (!P || !IPU) { console.log('PRESETS or VR.IPU missing'); console.log('FAILED 1'); process.exit(1); }
const VEGA = 'ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001638) Direct3D11 vs_5_0 ps_5_0, D3D11)';
const RTX = 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)';
const SWS = 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)';
// a stand-in game: applyPreset / applySettings / ipuDefaults with a renderer that records its quality
const game = (gpu, preset) => {
  V.GL = V.GL || {}; V.GL.rendererName = gpu;
  const r = { qBase: null, set: null, setQuality(q) { this.set = Object.assign({}, this.qBase || {}, q); this.qBase = Object.assign(this.qBase || {}, q); }, setOverride() {} };
  const g = { settings: Object.assign({}, P[preset || 'balanced'], { preset: preset || 'balanced' }), renderer: r, applySettings: proto.applySettings, saveSettings() {}, applyLook() {}, aqApply() {}, propMask: proto.propMask, ipuDefaults: proto.ipuDefaults };
  g.applyPreset = proto.applyPreset;
  return g;
};
const all = (o, v) => SW.every(k => o[k] === v);
// on: every switch but texLite (no preset turns it on: it softens far slopes — the player's choice), and on Very Low not zPre
const on = (o, potato) => SW.every(k => o[k] === (k !== 'texLite' && !(potato && k === 'zPre')));

console.log('a · the presets');
{
  check(on(P.ultraLite), 'Ultra · Leicht: the switches on (texLite aside)');
  check(Object.keys(P).filter(p => p !== 'ultraLite').every(p => all(P[p], false)), 'every other preset: off (Very Low too)', Object.keys(P).join(' '));
  const g = game(RTX, 'high');
  g.applyPreset('ultraLite');
  check(g.settings.preset === 'ultraLite' && on(g.settings), 'choosing Ultra · Leicht turns them on');
  g.applyPreset('high');
  check(g.settings.preset === 'high' && all(g.settings, false), 'High afterwards: off again (a dedicated GPU)');
  g.settings.zPre = true; g.applySettings('zPre');
  check(g.settings.preset === 'custom', 'a switch changed by hand: the preset is „Eigene"');
}

console.log('b · an integrated GPU');
{
  const g = game(VEGA, 'balanced');
  check(g.ipuDefaults(false) === true && on(g.settings), 'the first start on the Radeon Graphics: the switches on (Balanced; texLite aside)');
  g.settings.hdrLite = false; g.settings.texLite = true;
  check(g.ipuDefaults(false) === false && g.settings.hdrLite === false && g.settings.texLite === true, 'the next start: a switch changed by hand stays as it is');
  g.applyPreset('potato');
  check(g.settings.preset === 'potato' && on(g.settings, true), 'a preset change: the defaults again — Very Low too, but for zPre (its prepass draws the cut-out layer twice)');
  g.applyPreset('high');
  check(on(g.settings), 'High: on');
  for (const [name, gpu] of [['a GeForce', RTX], ['SwiftShader', SWS]]) {
    const d = game(gpu, 'high');
    const changed = d.ipuDefaults(false);
    d.applyPreset('balanced');
    check(!changed && all(d.settings, false), `${name}: the presets' values (off)`);
  }
}

console.log('c · to the renderer');
{
  const g = game(RTX, 'ultraLite');
  g.applySettings('*');
  const q = g.renderer.set;
  check(q && on(q) && q.dprCap === true, 'Ultra · Leicht: the renderer gets the switches and the 1920 × 1080 cap', q ? SW.concat('dprCap').map(k => k + ' ' + q[k]).join(' · ') : 'nothing');
  const v = game(VEGA, 'high'); v.ipuDefaults(true); v.applySettings('*');
  check(on(v.renderer.set) && v.renderer.set.dprCap === false, 'High on the Radeon Graphics: the switches, no 1080p cap (only Ultra · Leicht has it)');
  v.settings.texLite = true; v.applySettings('texLite');
  check(v.renderer.set.texLite === true && v.settings.preset === 'custom', 'texLite turned on by hand: the renderer gets it, the preset is „Eigene"');
  const h = game(RTX, 'potato'); h.applySettings('*');
  check(all(h.renderer.set, false) && h.renderer.set.dprCap === false, 'Very Low on a GeForce: all off — the renderer as before');
}

console.log('d · the settings rows');
{
  const I = V.I18N, rows = SW.map(k => V.Settings.byKey(k));
  check(rows.every(x => x && x.g === 'img' && x.sec === 'quality' && x.t === 'switch' && x.cost === 'low' && x.def === false), 'a row each in Bild · Qualität: a switch, cost 🟢, default off (the preset decides)');
  const de = I.dict.de, en = I.dict.en;
  const txt = rows.every(x => x && de[x.lab] && en[x.lab] && de[x.tip] && en[x.tip] && de[x.lab] !== en[x.lab]);
  check(txt, 'label and tip in German and English', rows.map(x => x && de[x.lab]).join(' · '));
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

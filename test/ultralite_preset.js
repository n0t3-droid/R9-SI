// F9 · the preset „Ultra · Leicht" (game.js PRESETS.ultraLite, the governor's rungs, bench.js, settings_reg.js), no browser:
//  a · the preset: Ultra's look (shadows 3, rays, bloom, water 2, ring 1 64, vxLod 96, smooth plants 2, folk 120, view 16,
//      scale 1) and the switches on (Fern-Cache, Schatten-Takt, Weltgenerierung im Takt, Spiegelung leicht); every other
//      preset has them off — a preset change sets them all; a switch changed by hand makes it „Eigene"
//  b · the governor on Ultra and Ultra · Leicht takes the cheap rungs first (far-cache refresh, shadow cadence, the light
//      mirror, folk LOD) before rays, detail, the shadow map, clouds and only then the resolution; never the view
//      distance; no rung that changes nothing with these settings; every rung has its name for the ⚙ line
//  c · ⚡ Automatik by the GPU's name: an integrated GPU (Radeon Graphics, Vega, Iris, UHD, Intel, Adreno, Mali, Apple M)
//      starts on Ultra · Leicht and measures there (50 fps hold it); a dedicated GPU keeps the old ladder (Ultra on top)
//  d · the settings: a row per switch (Bild · Qualität, switch, cost low) with label and tip in both languages; the preset
//      in the panel's list and the Automatik's answer with its own name and tip
//   bash test/wt_run.sh ultralite_preset.js
require('./dom_stub.js');
const V = require('./load_shared.js');
require('../src/main/i18n.js'); require('../src/main/lang_en.js'); require('../src/main/lang_de.js');
require('../src/main/settings_reg.js');
require('../src/main/bench.js');
require('../src/main/ultralite.js');
require('../src/main/game.js');
const fs = require('fs'), path = require('path');
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
const G = V.Game, P = G && G.PRESETS, proto = G && G.prototype;
const SW = ['farCache', 'shadowTakt', 'streamTakt', 'reflLite'];
if (!P || !P.ultraLite) { console.log('PRESETS.ultraLite missing'); console.log('FAILED 1'); process.exit(1); }

console.log('a · the preset');
{
  const U = P.ultra, L = P.ultraLite;
  const look = ['far', 'rdMax', 'renderDist', 'scale', 'shadows', 'clouds', 'particles', 'bloom', 'rays', 'fxaa', 'fancyLeaves', 'magic', 'horizon', 'sunShadows', 'tsr', 'vxLod', 'lite', 'folk', 'wetGround', 'anim', 'matTier', 'dropShadow', 'lampGlow', 'water', 'smoothPlants', 'smoothFurn'];
  const diff = look.filter(k => U[k] !== L[k]);
  check(!diff.length, 'Ultra · Leicht has every look value of Ultra', diff.join(', ') || 'shadows 3 · rays · bloom · water 2 · ring 64 · vxLod 96 · plants 2 · folk 120 · view 16');
  check(SW.every(k => L[k] === true) && L.dynRes === true, 'and the four switches and the smart quality on');
  check(Object.keys(P).filter(p => p !== 'ultraLite').every(p => SW.every(k => P[p][k] === false)), 'every other preset has them off (Very Low too)');
  check(P.potato.scale === 0.55 && P.potato.renderDist === 4 && P.potato.shadows === 0 && P.potato.lite === true && P.potato.vxLod === 12, 'Very Low: as before');
  // a stand-in game: applyPreset and applySettings without a renderer
  const g = { settings: Object.assign({}, P.balanced, { preset: 'balanced' }), applySettings: proto.applySettings, saveSettings() {}, applyLook() {}, aqApply() {}, propMask: proto.propMask };
  g.applyPreset = proto.applyPreset;
  g.applyPreset('ultraLite');
  check(g.settings.preset === 'ultraLite' && SW.every(k => g.settings[k] === true), 'choosing Ultra · Leicht turns the switches on');
  g.applyPreset('high');
  check(g.settings.preset === 'high' && SW.every(k => g.settings[k] === false), 'choosing High afterwards turns them off again');
  g.settings.farCache = true; g.applySettings('farCache');
  check(g.settings.preset === 'custom', 'a switch changed by hand: the preset is „Eigene"');
}

console.log('b · the governor\'s rungs');
{
  const stand = (S) => ({ settings: S });
  const names = (S) => proto.aqGpuRungs.call(stand(S), S).map(f => f.lab);
  const run = (S) => { const o = {}, out = []; for (const f of proto.aqGpuRungs.call(stand(S), S)) { f(o); out.push(JSON.stringify(o)); } return out; };
  const L = Object.assign({ preset: 'ultraLite' }, P.ultraLite), U = Object.assign({ preset: 'ultra' }, P.ultra), H = Object.assign({ preset: 'high' }, P.high);
  const nl = names(L), nu = names(U), nh = names(H);
  console.log('     Ultra · Leicht: ' + nl.join(' → '));
  console.log('     Ultra:          ' + nu.join(' → '));
  const cheap = ['g.aq.ul.far', 'g.aq.ul.shadow', 'g.aq.ul.refl', 'g.aq.ul.folk'];
  const firstScale = (n) => n.findIndex(x => x === 'g.aq.g6');
  check(nl.slice(0, 4).join() === cheap.join() && firstScale(nl) > 4, 'Ultra · Leicht: far cache, shadow cadence, mirror, folk first; the resolution only after rays, detail, shadow map and clouds');
  check(nu.slice(0, 3).join() === cheap.slice(1).join() && !nu.includes('g.aq.ul.far') && firstScale(nu) > 3, 'Ultra: shadow cadence, the light mirror, folk first (no far-cache rung: its cache is off)');
  check(/"reflLite":true/.test(run(U)[1]), 'Ultra\'s mirror rung makes it the light one; Ultra · Leicht\'s (already light) draws it every other frame', run(U)[1]);
  check(nh[0] === 'g.aq.g1' && nh[1] === 'g.aq.g2' && nh.length === 7 && !nh.some(n => /^g\.aq\.ul/.test(n)), 'High and below: the old ladder, unchanged', nh.join(' '));
  const sl = run(L);
  check(/"farSlow":2/.test(sl[0]) && /"shadowEvery":2/.test(sl[1]) && /"reflEvery":2/.test(sl[2]) && /"folkDist":72/.test(sl[3]), 'what they do: far cache twice as patient, shadows half as often, the mirror lighter, people drawn to 72 blocks', sl.slice(0, 4).join(' '));
  const all = sl[sl.length - 1];
  check(!/"rd"/.test(all) && !/renderDist/.test(all), 'no rung lowers the view distance');
  const allNames = [...nl, ...nu];
  check(allNames.every(n => n && V.I18N.dict.de[n] && V.I18N.dict.en[n]), 'every rung has its name in both languages (the ⚙ line)');
}

console.log('c · ⚡ Automatik by the GPU');
{
  const B = V.Bench; V.GL = V.GL || {};
  const igpu = ['ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001638) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'AMD Radeon(TM) Vega 8 Graphics', 'Intel(R) UHD Graphics 620', 'Intel(R) Iris(R) Xe Graphics', 'ANGLE (Intel, Intel(R) HD Graphics 520 Direct3D11 vs_5_0 ps_5_0)', 'Adreno (TM) 650', 'Mali-G78 MC14', 'Apple M1', 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Pro, Unspecified Version)'];
  const dgpu = ['ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)', 'AMD Radeon RX 6700 XT', 'Radeon RX Vega 64', 'NVIDIA GeForce GTX 1060 6GB', 'AMD Radeon Pro 5500M'];
  check(igpu.every(n => B.integrated(n)), 'integrated: Radeon Graphics, Vega 8, UHD, Iris, HD, Adreno, Mali, Apple M', igpu.filter(n => !B.integrated(n)).join(' | ') || 'all');
  check(dgpu.every(n => !B.integrated(n)) && !B.integrated('') && !B.integrated(undefined), 'dedicated: GeForce, Radeon RX (the RX Vega too), Radeon Pro; unknown: not integrated', dgpu.filter(n => B.integrated(n)).join(' | ') || 'none');
  const top = B.ladder(true)[8], topD = B.ladder(false)[8];
  check(top.p === 'ultraLite' && top.v === 16 && topD.p === 'ultra' && B.LADDER[8].p === 'ultra', 'the top of the ladder: Ultra · Leicht on an integrated GPU, Ultra on a dedicated one (the old LADDER unchanged)');
  check(B.stepOf('ultraLite', 16, true) === 8, 'Ultra · Leicht at 16 chunks is the top step on the integrated ladder');
  const hold = B.decide({ ms: 19.5, step: 8, target: 60, igpu: true }), down = B.decide({ ms: 24, step: 8, target: 60, igpu: true });
  check(hold.preset === 'ultraLite' && hold.action === 'hold', 'measured 51 fps there: it holds (the governor\'s cheap rungs carry the rest)', JSON.stringify(hold));
  check(down.preset !== 'ultraLite' && down.step < 8, 'measured 42 fps: a step down', down.preset + ' ' + down.renderDist);
  check(B.decide({ ms: 19.5, step: 8, target: 60 }).step === 7, 'a dedicated GPU at the top: the old table (19.5 ms is a step down)');
  // the game: on an integrated GPU the Automatik starts on Ultra · Leicht, then measures
  const was = V.GL.rendererName;
  const mk = () => { const g = { settings: Object.assign({}, P.balanced, { preset: 'balanced' }), ui: null, saveSettings() {}, applyLook() {}, aqApply() {}, propMask: proto.propMask }; for (const k of ['applySettings', 'applyPreset', 'benchStart', 'benchTick', 'benchFinish']) g[k] = proto[k]; return g; };
  V.GL.rendererName = igpu[0];
  const gi = mk(); gi.benchStart();
  check(gi.settings.preset === 'ultraLite' && gi.bench && gi.bench.was.preset === 'balanced', 'integrated: the run starts on Ultra · Leicht (the old choice kept to return to)');
  gi.bench.dts = Array(120).fill(19); const r1 = gi.benchFinish();
  check(r1 && gi.settings.preset === 'ultraLite' && SW.every(k => gi.settings[k]), 'it holds Ultra · Leicht at 52 fps', r1 && r1.preset);
  V.GL.rendererName = dgpu[0];
  const gd = mk(); gd.benchStart();
  check(gd.settings.preset === 'balanced', 'dedicated: the run measures the current preset (as before)');
  gd.bench.dts = Array(120).fill(5); const r2 = gd.benchFinish();
  check(r2 && (gd.settings.preset === 'high' || gd.settings.preset === 'balanced') && SW.every(k => !gd.settings[k]), 'and climbs the old ladder (switches off)', r2 && r2.preset);
  V.GL.rendererName = was;
}

console.log('d · the settings');
{
  const S = V.Settings;
  for (const k of SW) {
    const it = S.byKey(k);
    check(it && it.g === 'img' && it.sec === 'quality' && it.t === 'switch' && it.cost === 'low' && it.def === false, `a row for ${k}: Bild · Qualität, a switch, cost low, off by default`);
    check(it && V.I18N.dict.de[it.lab] && V.I18N.dict.en[it.lab] && V.I18N.dict.de[it.tip] && V.I18N.dict.en[it.tip], `${k}: label and tip in both languages`, it && V.I18N.dict.de[it.lab]);
  }
  check(V.I18N.dict.de['g.set.pUltraLite'] === 'Ultra · Leicht' && V.I18N.dict.en['g.set.pUltraLite'] === 'Ultra · Light' && V.I18N.dict.de['g.set.pUltraLiteTip'] && V.I18N.dict.en['g.set.pUltraLiteTip'], 'the preset\'s name (Ultra · Leicht / Ultra · Light) and tip');
  const panel = fs.readFileSync(path.join(__dirname, '..', 'src', 'main', 'settings_panel.js'), 'utf8'), ui = fs.readFileSync(path.join(__dirname, '..', 'src', 'main', 'ui.js'), 'utf8');
  check(/ultraLite: 'g\.set\.pUltraLite'/.test(panel) && /'ultra', 'ultraLite'\]/.test(panel) && /pUltraLiteTip/.test(panel), 'the panel lists it after Ultra, with its tip');
  check(/ultraLite: 'g\.set\.pUltraLite'/.test(ui), 'the Automatik\'s answer names it');
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

// x-top · Spitzenbild (src/main/xtop.js, xtop_gl.js; plan docs/superpowers/plans/2026-11-06-x-top.md), no browser:
//   a  the switches by preset (Very Low, Low, Balanced none), their rows and texts, game.js / build.js / settings_reg.js
//   b  the shaders: with the switches off the terrain and the composite are the same text as without xtop.js; the
//      defines only on their programs; both functions and calls present when on
//   c  the mirrors: Tiefe (vertex AO, the sun's share, the AO numbers), Klarheit (darker than the surroundings darker,
//      nothing far away), Filmkamera's shutter (0 at a cut / first frame / stall, ≤ 1)
//   d  the GL side: l2Ssao swaps Tiefe's AO numbers in and restores light2's
const fs = require('fs'), path = require('path');
const V = require('./load_shared.js');
global.window = { devicePixelRatio: 1, screen: { width: 1280, height: 720 } };
global.WebGLFramebuffer = class {};
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
const SRC = path.join(__dirname, '..', 'src', 'main');
require(SRC + '/gl.js'); require(SRC + '/light2.js'); require(SRC + '/sky3.js'); require(SRC + '/look.js');
require(SRC + '/shaders.js');
const S0 = Object.assign({}, V.SHADERS), hook0 = V.GL.defineHook;
delete require.cache[require.resolve(SRC + '/shaders.js')];
require(SRC + '/xtop.js'); require(SRC + '/shaders.js');
const S1 = V.SHADERS, X = V.XTop;
if (!X) { console.log('VR.XTop missing'); console.log('FAILED 1'); process.exit(1); }
const strip = (s) => s.split('\n').filter(l => !/^\s*#/.test(l)).join('\n');
// the text that survives the preprocessor with these defines (enough for #ifdef/#if defined/#endif/#else)
function pre(src, defs) {
  const D = new Set(defs.map(d => d.split(' ')[0])), out = [], st = [];
  const ev = (e) => !!eval(e.replace(/defined\s*\(\s*(\w+)\s*\)/g, (m, n) => (D.has(n) ? '1' : '0')).replace(/\b[A-Z_][A-Z_0-9]*\b/g, (n) => (D.has(n) ? '1' : '0')));
  for (const line of src.split('\n')) {
    const t = line.trim(); let m;
    if ((m = /^#ifdef\s+(\w+)/.exec(t))) { st.push({ on: D.has(m[1]), done: D.has(m[1]) }); continue; }
    if ((m = /^#ifndef\s+(\w+)/.exec(t))) { st.push({ on: !D.has(m[1]), done: !D.has(m[1]) }); continue; }
    if ((m = /^#if\s+(.*)$/.exec(t))) { const on = ev(m[1]); st.push({ on, done: on }); continue; }
    if ((m = /^#elif\s+(.*)$/.exec(t))) { const s = st[st.length - 1]; if (s.done) s.on = false; else { s.on = ev(m[1]); s.done = s.on; } continue; }
    if (/^#else/.test(t)) { const s = st[st.length - 1]; s.on = !s.done; s.done = true; continue; }
    if (/^#endif/.test(t)) { st.pop(); continue; }
    if (st.every(s => s.on)) { const c = line.replace(/\/\/.*$/, '').trim(); if (c) out.push(c); }
  }
  if (st.length) throw new Error('unbalanced #if');
  return out.join('\n');
}

console.log('a · the switches');
{
  const d = (p) => X.defaults(p);
  check(['potato', 'low', 'balanced'].every(p => X.SW.every(k => !d(p)[k])), 'Very Low, Low and Balanced: none of them');
  check(d('high').xDepth === 1 && d('high').xClar && d('high').xBlur, 'High: Tiefe 1, Klarheit, Filmkamera');
  check(d('ultra').xDepth === 2 && d('ultra').xClar && d('ultra').xBlur, 'Ultra: Tiefe 2 (Kino), Klarheit, Filmkamera');
  check(d('ultraLite').xDepth === 1 && d('ultraLite').xClar && !d('ultraLite').xBlur, 'Ultra · Leicht: Tiefe 1, Klarheit');
  check(X.ROWS.length === X.SW.length && X.ROWS.every(r => X.SW.includes(r.key) && r.cost && r.lab === 'g.set.' + r.key && r.tip === r.lab + '.tip'), 'a settings row with a cost for every switch');
  const de = fs.readFileSync(SRC + '/lang_de.js', 'utf8'), en = fs.readFileSync(SRC + '/lang_en.js', 'utf8');
  const keys = [].concat(...X.ROWS.map(r => [r.lab, r.tip])).concat(['g.set.xDepthV']);
  check(keys.every(k => de.includes("'" + k + "'") && en.includes("'" + k + "'")), 'their texts in German and English', keys.length + ' keys');
  const g = fs.readFileSync(SRC + '/game.js', 'utf8'), b = fs.readFileSync(path.join(__dirname, '..', 'build.js'), 'utf8'), sr = fs.readFileSync(SRC + '/settings_reg.js', 'utf8');
  check(/VR\.XTop\.defaults\(p\)/.test(g) && /XT_SW\.includes\(key\)/.test(g) && /for \(const k of XT_SW\) qb\[k\]/.test(g), 'game.js: the presets, a hand change → custom, the renderer gets them');
  check(b.indexOf("'xtop'") > b.indexOf("'look'") && b.indexOf("'xtop'") < b.indexOf("'shaders'") && b.indexOf("'xtop_gl'") > b.indexOf("'look_gl'"), 'build.js: xtop after look and before shaders, xtop_gl after look_gl');
  check(/VR\.XTop\.ROWS/.test(sr), 'settings_reg.js shows the rows');
  check(X.key({ xDepth: 2, xBlur: true }) === '201' && X.key(null) === '000' && X.key({ xDepth: 9 }) === '200', 'the key');
}

console.log('b · the shaders');
{
  const sets = [[], ['LIGHT2'], ['LIGHT2', 'L2AO', 'AIR2'], ['LIGHT2', 'L2AO', 'AIR2', 'PBR', 'FADE']];
  let same = 0; for (const s of sets) if (pre(S0.TERRAIN_FS, s) === pre(S1.TERRAIN_FS, s)) same++;
  check(same === sets.length, 'switches off: the terrain is the same text as before', same + '/' + sets.length);
  const csets = [[], ['GRADE2'], ['GRADE2', 'LOOKV', 'LV_HAZE', 'LV_SOFT', 'LV_WRAP', 'LV_TONE', 'LV_PAL'], ['LOOKV', 'LV_HAZE', 'LV_PAL', 'LV_TONE']];
  let cs = 0; for (const s of csets) if (pre(S0.COMPOSITE_FS, s) === pre(S1.COMPOSITE_FS, s)) cs++;
  check(cs === csets.length, 'switches off: the composite is the same text as before', cs + '/' + csets.length);
  X.use(X.off());
  check(['terrain', 'terrainCut', 'composite', 'sky', 'folk'].every(n => X.definesFor(n).length === 0), 'off: no defines anywhere');
  const qh = X.defaults('high'), qu = X.defaults('ultra');
  check(X.definesFor('terrain', qu).join() === 'XDEPTH,XD_VAO 0.280,XD_SUN 0.650,XD_AMB 0.800' && X.definesFor('terrainCut', qh).join() === 'XDEPTH,XD_VAO 0.250,XD_SUN 0.500,XD_AMB 0.880', 'Tiefe: the terrain programs, its numbers by level');
  check(X.definesFor('composite', qh).join() === 'X_CLAR,X_BLUR' && ['sky', 'water', 'prop', 'folk', 'bloom'].every(n => X.definesFor(n, qu).length === 0), 'Klarheit and Filmkamera on the composite only');
  const t = pre(S1.TERRAIN_FS, ['LIGHT2', 'L2AO', 'AIR2', 'XDEPTH']);
  check(t.includes('ao = 1.0 - v_ao * XD_VAO;') && t.includes('direct *= mix(1.0, l2a, XD_SUN);'), 'Tiefe: the corners and the sun\'s share in the terrain');
  const c = pre(S1.COMPOSITE_FS, ['GRADE2', 'LOOKV', 'LV_HAZE', 'LV_SOFT', 'LV_WRAP', 'LV_TONE', 'LV_PAL', 'X_CLAR', 'X_BLUR']);
  check(c.includes('vec3 xClar(') && c.includes('c = xClar(c, sc, z);') && c.includes('vec3 xBlur(') && c.includes('c = xBlur(c, uv);'), 'Klarheit and Filmkamera: functions and calls');
  check(c.indexOf('vec3 xClar(') < c.indexOf('vec3 lvHdr(') && c.indexOf('uniform highp sampler2D u_lvDepth') < c.indexOf('vec3 xBlur('), 'declared before use');
  const nolook = pre(S1.COMPOSITE_FS, ['GRADE2', 'X_CLAR', 'X_BLUR']);
  check(!nolook.includes('xBlur(') && !nolook.includes('xClar(c'), 'without v-look\'s composite neither runs (they need its depth and soft copy)');
  X.use(qu); V.Look.use(V.Look.defaults('high')); const h = V.GL.defineHook('composite', ['Q']); V.Look.use(V.Look.off());
  check(h.includes('Q') && h.includes('X_BLUR') && h.includes('LOOKV'), 'the define hook chains after the others', h.join());
  X.use(X.off()); check(V.GL.defineHook('terrain', ['Q']).join() === hook0('terrain', ['Q']).join(), 'off: the chain gives what it gave before');
}

console.log('c · the mirrors');
{
  check(Math.abs(X.vao(3, 0) - 0.4) < 1e-9 && Math.abs(X.vao(3, 2) - 0.16) < 1e-9 && X.vao(0, 2) === 1, 'Tiefe: a deep corner 0.4 → 0.16 at Kino, an open face 1');
  check(X.sunK(0.4, 0) === 1 && Math.abs(X.sunK(0.4, 1) - 0.7) < 1e-9 && Math.abs(X.sunK(0.4, 2) - 0.61) < 1e-9 && X.sunK(1, 2) === 1, 'the sun\'s share: none before, 30 % / 39 % darker at a 0.4 contact shadow');
  const A = V.Light2.AO, a2 = X.aoFor(A, 2);
  check(Math.abs(a2.radius[3] - A.radius[3] * 2) < 1e-9 && Math.abs(a2.strength[3] - A.strength[3] * 1.7) < 1e-9 && a2.bias === A.bias && A.radius[3] === 1.2 && X.aoFor(A, 0) === A, 'the AO numbers: wider and stronger, light2\'s untouched');
  check(X.clarK(0.1, 0.3, 5) < 0.8 && X.clarK(0.6, 0.3, 5) > 1.15 && X.clarK(0.3, 0.3, 5) === 1, 'Klarheit: darker than the surroundings darker, brighter brighter, even unchanged');
  check(X.clarK(0.01, 1, 5) >= X.CLAR.lo - 1e-9 && X.clarK(5, 0.01, 5) <= X.CLAR.hi + 1e-9, 'clamped (no halos past ' + X.CLAR.lo + ' … ' + X.CLAR.hi + ')');
  check(X.clarK(0.1, 0.3, 200) === 1 && X.clarK(0.1, 0.3, 100) > X.clarK(0.1, 0.3, 30), 'nothing far away (the haze stays soft), fading between 70 and 160 m');
  check(X.shutterK(1 / 12, false) === 0.25 && X.shutterK(1 / 48, false) === 1 && X.shutterK(1 / 60, false) === 1, 'the shutter: a quarter of 1/12 s, all of 1/48 s, capped at 1');
  check(X.shutterK(1 / 24, true) === 0 && X.shutterK(0, false) === 0 && X.shutterK(-1, false) === 0 && X.shutterK(2, false) === 0, '0 at a cut, the first frame, a stall');
}

console.log('d · the GL side');
{
  global.VR.Renderer = function () {}; const R = V.Renderer.prototype;
  let seen = null; R.l2Ssao = function () { seen = V.Light2.AO; }; R.buildPrograms = function () {}; R.applyQ = function () {}; R.l2Post = null;
  delete require.cache[require.resolve(SRC + '/xtop_gl.js')]; require(SRC + '/xtop_gl.js');
  const r = new V.Renderer(); r.q = { xDepth: 2 }; const A = V.Light2.AO;
  r.l2Ssao({}, {});
  check(seen !== A && Math.abs(seen.radius[3] - 2.4) < 1e-9 && V.Light2.AO === A, 'Tiefe Kino: the pass sees 2.4 blocks, light2\'s numbers back after it');
  const s1 = seen; r.l2Ssao({}, {}); check(seen === s1, 'made once (no allocation per frame)');
  r.q = { xDepth: 0 }; r.l2Ssao({}, {}); check(seen === A, 'Tiefe off: light2\'s own numbers');
  let built = 0; R.buildPrograms = function () { built++; }; r.q = { xDepth: 0 }; r.xKey = '000';
  r.applyQ(); check(built === 0, 'applyQ: nothing rebuilt while the key holds');
  r.q.xClar = true; r.applyQ(); check(built === 1, 'a switch changed: the programs again');
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

// q-art2 · Bildregie II (src/main/qart2.js, qart2_gl.js; plan docs/superpowers/plans/2026-11-06-q-art2.md), no browser:
//   a  the switches by preset (Very Low and Low none), their rows, cost tiers and texts, the wiring (game.js, build.js,
//      settings_reg.js)
//   b  the shaders: with the switches off every touched program is the same text as without qart2.js; the defines only
//      on their programs (Fernkronen only with Laubkronen and fancy leaves); functions and calls in place when on
//   c  the mirrors: the isles near the eye from a generator (pure; sorted, at most 8, packed as uniforms), the isle's
//      underside normal (down and out, outward at the rim), the shadow under an isle (along the sun, soft, none beside),
//      the far cut (coarse, lasts past q-art's fade, never a face's middle, both sides of a face alike)
//   d  the GL side: a switch change rebuilds the programs, nothing while the key holds
const fs = require('fs'), path = require('path');
const V = require('./load_shared.js');
global.window = { devicePixelRatio: 1, screen: { width: 1280, height: 720 } };
global.WebGLFramebuffer = class {};
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
const SRC = path.join(__dirname, '..', 'src', 'main');
require(SRC + '/gl.js'); require(SRC + '/light2.js'); require(SRC + '/sky3.js'); require(SRC + '/look.js'); require(SRC + '/xtop.js'); require(SRC + '/qart.js');
require(SRC + '/shaders.js');
const S0 = Object.assign({}, V.SHADERS), hook0 = V.GL.defineHook;
delete require.cache[require.resolve(SRC + '/shaders.js')];
require(SRC + '/qart2.js'); require(SRC + '/shaders.js');
const S1 = V.SHADERS, Q2 = V.QArt2, QA = V.QArt;
if (!Q2) { console.log('VR.QArt2 missing'); console.log('FAILED 1'); process.exit(1); }
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
  const d = (p) => Q2.defaults(p);
  check(Q2.SW.join() === 'qGrass,qIsle,qCrown', 'three switches: Wiese, Schwebeinseln, Fernkronen');
  check(['potato', 'low'].every(p => Q2.SW.every(k => !d(p)[k])), 'Very Low and Low: none of them');
  check(['balanced', 'high', 'ultra', 'ultraLite'].every(p => Q2.SW.every(k => d(p)[k] === true)), 'Balanced and up: all three');
  check(Q2.ROWS.length === Q2.SW.length && Q2.ROWS.every(r => Q2.SW.includes(r.key) && ['low', 'mid', 'high'].includes(r.cost) && r.lab === 'g.set.' + r.key && r.tip === r.lab + '.tip'), 'a settings row with a cost tier for every switch');
  const de = fs.readFileSync(SRC + '/lang_de.js', 'utf8'), en = fs.readFileSync(SRC + '/lang_en.js', 'utf8');
  const keys = [].concat(...Q2.ROWS.map(r => [r.lab, r.tip]));
  check(keys.every(k => de.includes("'" + k + "'") && en.includes("'" + k + "'")), 'their texts in German and English', keys.length + ' keys');
  const g = fs.readFileSync(SRC + '/game.js', 'utf8'), b = fs.readFileSync(path.join(__dirname, '..', 'build.js'), 'utf8'), sr = fs.readFileSync(SRC + '/settings_reg.js', 'utf8');
  check(/VR\.QArt2\.defaults\(p\)/.test(g) && /Q2_SW\.includes\(key\)/.test(g) && /for \(const k of Q2_SW\) qb\[k\]/.test(g), 'game.js: the presets, a hand change → custom, the renderer gets them');
  check(b.includes("MAIN.splice(MAIN.indexOf('qart') + 1, 0, 'qart2')") && b.includes("MAIN.splice(MAIN.indexOf('qart_gl') + 1, 0, 'qart2_gl')"), 'build.js: qart2 right after qart (before shaders), qart2_gl right after qart_gl');
  check(/VR\.QArt2\.ROWS/.test(sr), 'settings_reg.js shows the rows');
  check(Q2.key({ qGrass: 1 }, 'balanced', true) !== Q2.key({ qGrass: 1 }, 'high', true) && Q2.key(null) === Q2.key(Q2.off()) && Q2.key({ qCrown: 1 }, 'high', false) === Q2.key(Q2.off()), 'the key (the tufts\' steps by preset; Fernkronen needs fancy leaves)');
  check(Q2.tuftSteps('balanced') === 4 && Q2.tuftSteps('high') === 6 && Q2.tuftSteps('potato') === 0, 'the blade layer: 4 steps on Balanced, 6 on High');
}

console.log('b · the shaders');
{
  const fsets = [[], ['CUTOUT'], ['CUTOUT', 'ZPRE', 'ZINV'], ['LIGHT2', 'L2AO', 'AIR2'], ['LIGHT2', 'L2AO', 'AIR2', 'PBR', 'FADE', 'CUTOUT', 'Q_LEAF'], ['LITE', 'FADE'], ['MOTION', 'LV_MEADOW', 'Q_LEAF', 'Q_PLAZA'], ['MODEL', 'Q_GRASS', 'Q_ISLE', 'Q_CROWN', 'Q_LEAF', 'CUTOUT']];
  const off = (s) => s.filter(x => !/^Q_(GRASS|ISLE|CROWN|TUFT)/.test(x));
  let same = 0; for (const s of fsets) if (pre(S0.TERRAIN_FS, off(s)) === pre(S1.TERRAIN_FS, s)) same++;
  check(same === fsets.length, 'switches off (and the models with them on): the terrain is the same text as before', same + '/' + fsets.length);
  const vsets = [[], ['MOTION', 'SEASON'], ['SHADOWS', 'FADE', 'MULTIDRAW', 'Q_LEAF'], ['MODEL', 'Q_ISLE']];
  let vs = 0; for (const d of vsets) if (pre(S0.TERRAIN_VS, off(d)) === pre(S1.TERRAIN_VS, d)) vs++;
  check(vs === vsets.length, 'the terrain\'s vertex shader the same text when off', vs + '/' + vsets.length);
  const ssets = [[], ['CUTOUT'], ['CUTOUT', 'MULTIDRAW']];
  let ss = 0; for (const d of ssets) if (pre(S0.SHADOW_VS, d) === pre(S1.SHADOW_VS, d) && pre(S0.SHADOW_FS, d) === pre(S1.SHADOW_FS, d)) ss++;
  check(ss === ssets.length, 'the shadow programs the same text when off', ss + '/' + ssets.length);
  check(['SKY_FS', 'COMPOSITE_FS', 'WATER_FS', 'TRANS_FS', 'LOD_FS', 'LOD_VS'].every(k => !S0[k] || S0[k] === S1[k]), 'no other program\'s text changes');
  Q2.use(Q2.off(), { fancy: true, leaf: true, preset: 'high' });
  check(['terrain', 'terrainCut', 'terrainCutZ', 'shadowCut', 'composite', 'sky'].every(n => Q2.definesFor(n).length === 0), 'off: no defines anywhere');
  const on = Q2.defaults('high'), o = { fancy: true, leaf: true, preset: 'high' };
  const has = (n, d, oo) => Q2.definesFor(n, on, oo || o).some(x => x.split(' ')[0] === d);
  check(has('terrain', 'Q_GRASS') && !has('terrainCut', 'Q_GRASS') && !has('shadow', 'Q_GRASS'), 'Wiese on the opaque terrain only (the grass tops)');
  check(Q2.definesFor('terrain', on, o).includes('Q_TUFT_N 6') && Q2.definesFor('terrain', on, Object.assign({}, o, { preset: 'balanced' })).includes('Q_TUFT_N 4'), 'the blade layer\'s steps by preset');
  check(has('terrain', 'Q_ISLE') && has('terrainCut', 'Q_ISLE') && !has('terrainCutZ', 'Q_ISLE') && !has('shadowCut', 'Q_ISLE'), 'Schwebeinseln on the terrain and its cut-out (the plants on the land under an isle in its shadow too)');
  check(['terrain', 'terrainCut', 'terrainCutZ', 'shadowCut'].every(n => has(n, 'Q_CROWN')) && !has('shadow', 'Q_CROWN'), 'Fernkronen on the leaf programs, the depth prepass and the cut-out shadow');
  check(!has('terrainCut', 'Q_CROWN', { fancy: false, leaf: true, preset: 'high' }) && !has('shadowCut', 'Q_CROWN', { fancy: true, leaf: false, preset: 'high' }), 'no Fernkronen without fancy leaves or without Laubkronen');
  check(['sky', 'water', 'prop', 'folk', 'composite', 'trans', 'lod'].every(n => Q2.definesFor(n, on, o).length === 0), 'nothing on other programs');
  const t = pre(S1.TERRAIN_FS, ['LIGHT2', 'L2AO', 'Q_GRASS', 'Q_TUFT_N 6', 'Q_ISLE', 'MOTION']);
  check(t.includes('vec3 qGrass(') && t.includes('alb.rgb = qGrass(') && t.includes('vec3 qIsleAlb(') && t.includes('alb.rgb = qIsleAlb(') && t.includes('qIsleShadow(') && t.includes('in vec4 v_qI;'), 'on: the functions and their calls');
  check(t.indexOf('alb.rgb = qGrass(') < t.indexOf('float ndl') && t.indexOf('qIsleShadow(v_localPos') > t.indexOf('float sh =') && t.indexOf('qBounce') > t.indexOf('vec3 col = alb.rgb * lighting;'), 'the grass before the light, the isle\'s shadow after the shadow map, its bounce after the light');
  check(!/u_blockVar < 0\.5[^\n]*qGrass/.test(t) ? false : true, 'never in the Klassisch look (its crisp ground and block grid stay)');
  const v = pre(S1.TERRAIN_VS, ['Q_ISLE']);
  check(v.includes('void qIsleV(') && v.indexOf('qIsleV(wp)') > v.indexOf('vec3 wp ='), 'the isle per vertex (after the position is known)');
  const z = pre(S1.TERRAIN_FS, ['CUTOUT', 'ZPRE', 'ZINV', 'Q_LEAF', 'Q_CROWN']);
  check(z.includes('qCut(') && z.indexOf('qCut(v_localPos') < z.indexOf('o_col = vec4(1.0 / 255.0') && /QS = dist > 40\.0/.test(z), 'the far cut in the depth prepass too (both passes cut alike)');
  check(!/qGreen\(alb\.rgb \* v_tint\) > 0\.5 && qCut/.test(z), 'Fernkronen: blossom and autumn crowns take the cut');
  const sf = pre(S1.SHADOW_FS, ['CUTOUT', 'Q_CROWN']), sv = pre(S1.SHADOW_VS, ['Q_CROWN']);
  check(sf.includes('qCutS(') && sf.includes('discard') && sv.includes('v_qW = rel + u_qCamF;'), 'the shadow pass cuts the leaf corners (its world position from the camera)');
  check(V.GL.defineHook('terrain', ['Q']).join() === hook0('terrain', ['Q']).join(), 'off: the define chain gives what it gave before');
}

console.log('c · the mirrors');
{
  // a stand-in generator: isles on a 72-block lattice where a hash says so (the real one's islandCell has this form)
  const cells = new Map();
  const g = { islandCell(i, j) { const k = i + ',' + j; if (!cells.has(k)) { const h = Math.abs(Math.sin(i * 12.9898 + j * 78.233) * 43758.5453) % 1; cells.set(k, h < 0.5 ? { x: i * 72 + 30, z: j * 72 + 30, r: 8 + h * 40, y: 140 + h * 30, dome: 3, deep: 1.2 } : null); } return cells.get(k); } };
  const L = Q2.islesNear(g, [100, 80, 100]);
  check(L.length > 0 && L.length <= 8, 'the isles near the eye: at most eight', L.length);
  const dist = (I) => Math.hypot(I.x - 100, I.z - 100) - I.r;
  check(L.every((I, k) => k === 0 || dist(L[k - 1]) <= dist(I) + 1e-9), 'the nearest first');
  const D = { designedIslands: () => [{ x: 330, z: 140, r: 42, y: 158, dome: 3, deep: 0.9 }], islandCell: () => null };
  check(Q2.islesNear(D, [330, 90, 140]).length === 1 && Q2.islesNear({ islandCell: () => null }, [0, 0, 0]).length === 0 && Q2.islesNear(null, [0, 0, 0]).length === 0, 'the designed isles count; none without a generator');
  const P = Q2.pack(L, [96, 70, 99]);
  check(P.A.length === 32 && P.B.length === 32 && P.n === L.length && Math.abs(P.A[0] - (L[0].x - 96)) < 1e-4 && Math.abs(P.A[1] - (L[0].y - 70)) < 1e-4 && Math.abs(P.A[3] - L[0].r) < 1e-4, 'packed as uniforms relative to the camera\'s block');
  const I = { x: 0, z: 0, r: 30, y: 150, dome: 3, deep: 1 };
  const nUnder = Q2.isleNormal(I, [10, 130, 0]), nTip = Q2.isleNormal(I, [0.5, 128, 0.5]), nRim = Q2.isleNormal(I, [29, 148.5, 0]);
  check(nUnder && nUnder[1] < -0.2 && nUnder[0] > 0.1 && nTip[1] < -0.9 && nRim[0] > 0.6, 'the underside\'s normal: down and out, straight down at the tip, outward at the rim', nUnder && nUnder.map(x => x.toFixed(2)).join());
  check(Q2.isleNormal(I, [60, 130, 0]) === null && Q2.isleNormal(I, [5, 170, 5]) === null, 'nothing beside or above an isle');
  const sun = [0.3, 0.8, 0.1], s = Math.hypot(...sun), Ls = sun.map(x => x / s);
  const under = [-Ls[0] / Ls[1] * 80, 70, -Ls[2] / Ls[1] * 80];   // straight under the isle along the sun, 80 below its rock
  check(Q2.isleShadow([I], under, Ls) < 0.6 && Q2.isleShadow([I], [0, 70, 0], [0, 1, 0]) < 0.6, 'the land under an isle (along the sun) in its shadow', Q2.isleShadow([I], under, Ls).toFixed(2));
  check(Q2.isleShadow([I], [80, 70, 0], [0, 1, 0]) === 1 && Q2.isleShadow([I], [0, 160, 0], [0, 1, 0]) === 1 && Q2.isleShadow([I], under, [0.99, 0.05, 0]) === 1, 'none beside it, above it or with the sun at the horizon');
  const edge = Q2.isleShadow([I], [I.r * 0.8, 70, 0], [0, 1, 0]);
  check(edge > 0.45 && edge < 0.98, 'a soft edge', edge.toFixed(2));
  let centre = 0, sym = 0, cutN = 0, tot = 0, lasts = 0;
  for (let i = 0; i < 3000; i++) {
    const w = [Math.floor(Math.sin(i * 1.7) * 300) + (i % 16 + 0.5) / 16, 64, Math.floor(Math.cos(i * 2.3) * 300) + ((i * 7) % 16 + 0.5) / 16];
    tot++;
    const c = Q2.cutFar(w, 2, 120);
    const fx = w[0] - Math.floor(w[0]), fz = w[2] - Math.floor(w[2]);
    if (c && Math.abs(fx - 0.5) < 0.18 && Math.abs(fz - 0.5) < 0.18) centre++;
    if (c) cutN++;
    if (Q2.cutFar(w, 2, 220)) lasts++;
    if (Q2.cutFar(w, 2, 120) === Q2.cutFar(w, 3, 120)) sym++;
  }
  check(centre === 0 && sym === 3000, 'the far cut: never a face\'s middle, the same on both sides of a face');
  check(cutN > tot * 0.05 && cutN < tot * 0.35 && lasts > tot * 0.02 && !QA.cut([0.03, 64, 0.03], 2, 120), 'it cuts corners at 120 and 220 m, where q-art\'s cut is gone', (cutN / tot * 100).toFixed(1) + ' % / ' + (lasts / tot * 100).toFixed(1) + ' %');
}

console.log('d · the GL side');
{
  global.VR.Renderer = function () {}; const R = V.Renderer.prototype;
  let built = 0; R.buildPrograms = function () { built++; }; R.applyQ = function () {}; R.common = function () {}; R.drawSections = function () {};
  delete require.cache[require.resolve(SRC + '/qart2_gl.js')]; require(SRC + '/qart2_gl.js');
  const r = new V.Renderer(); r.q = Object.assign({ qLeaf: true }, Q2.off()); r.buildPrograms(); const b0 = built;
  r.applyQ(); check(built === b0, 'applyQ: nothing rebuilt while the key holds');
  r.q.qGrass = true; r.applyQ(); check(built === b0 + 1 && Q2.q.qGrass === true, 'a switch changed: the programs again, the switches seen');
  r.q.qIsle = true; r.applyQ(); check(built === b0 + 2, 'Schwebeinseln: the programs again');
  Q2.use(Q2.off(), { fancy: true, leaf: true, preset: 'high' });
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

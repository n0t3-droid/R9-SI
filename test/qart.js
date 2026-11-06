// q-art · Bildregie (src/main/qart.js, qart_gl.js; plan docs/superpowers/plans/2026-11-06-q-art.md), no browser:
//   a  the switches by preset (Very Low and Low none), their rows and texts, game.js / build.js / settings_reg.js / env.js
//   b  the shaders: with the switches off the terrain is the same text as without qart.js; the defines only on their
//      programs (Laubkronen only with fancy leaves); functions and calls present when on, the cut before ZPRE's return
//   c  the mirrors: the clump field (unit normal, outward, negative inside), the cut (never a face's centre, the same on
//      both sides of a shared face, fades out far away, cuts some corners), the plaza's luma, the sky script (warmer and
//      bluer by day, nothing at night, the rain keeps its grey)
//   d  the GL side: a switch change rebuilds the programs, nothing while the key holds
const fs = require('fs'), path = require('path');
const V = require('./load_shared.js');
global.window = { devicePixelRatio: 1, screen: { width: 1280, height: 720 } };
global.WebGLFramebuffer = class {};
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
const SRC = path.join(__dirname, '..', 'src', 'main');
require(SRC + '/gl.js'); require(SRC + '/light2.js'); require(SRC + '/sky3.js'); require(SRC + '/look.js'); require(SRC + '/xtop.js');
require(SRC + '/shaders.js');
const S0 = Object.assign({}, V.SHADERS), hook0 = V.GL.defineHook;
delete require.cache[require.resolve(SRC + '/shaders.js')];
require(SRC + '/qart.js'); require(SRC + '/shaders.js');
const S1 = V.SHADERS, QA = V.QArt;
if (!QA) { console.log('VR.QArt missing'); console.log('FAILED 1'); process.exit(1); }
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
  const d = (p) => QA.defaults(p);
  check(['potato', 'low'].every(p => QA.SW.every(k => !d(p)[k])), 'Very Low and Low: none of them');
  check(['balanced', 'high', 'ultra', 'ultraLite'].every(p => QA.SW.every(k => d(p)[k] === true)), 'Balanced and up: all three');
  check(QA.ROWS.length === QA.SW.length && QA.ROWS.every(r => QA.SW.includes(r.key) && ['low', 'mid', 'high'].includes(r.cost) && r.lab === 'g.set.' + r.key && r.tip === r.lab + '.tip'), 'a settings row with a cost tier for every switch');
  const de = fs.readFileSync(SRC + '/lang_de.js', 'utf8'), en = fs.readFileSync(SRC + '/lang_en.js', 'utf8');
  const keys = [].concat(...QA.ROWS.map(r => [r.lab, r.tip]));
  check(keys.every(k => de.includes("'" + k + "'") && en.includes("'" + k + "'")), 'their texts in German and English', keys.length + ' keys');
  const g = fs.readFileSync(SRC + '/game.js', 'utf8'), b = fs.readFileSync(path.join(__dirname, '..', 'build.js'), 'utf8'), sr = fs.readFileSync(SRC + '/settings_reg.js', 'utf8'), en2 = fs.readFileSync(SRC + '/env.js', 'utf8');
  check(/VR\.QArt\.defaults\(p\)/.test(g) && /QA_SW\.includes\(key\)/.test(g) && /for \(const k of QA_SW\) qb\[k\]/.test(g), 'game.js: the presets, a hand change → custom, the renderer gets them');
  check(b.indexOf("'qart'") > b.indexOf("'xtop'") && b.indexOf("'qart'") < b.indexOf("'shaders'") && b.indexOf("'qart_gl'") > b.indexOf("'xtop_gl'"), 'build.js: qart before shaders, qart_gl after xtop_gl');
  check(/VR\.QArt\.ROWS/.test(sr), 'settings_reg.js shows the rows');
  check(/dim === 'overworld' && SKY\.on && VR\.QArt && VR\.QArt\.q\.qSky\) VR\.QArt\.skyScript\(/.test(en2), 'env.js: the colour script, the overworld only, behind its switch');
  check(QA.key({ qLeaf: true }, true) === '100' && QA.key({ qLeaf: true }, false) === '000' && QA.key(null) === '000' && QA.key({ qSky: 1, qPlaza: 1 }) === '011', 'the key (Laubkronen needs fancy leaves)');
}

console.log('b · the shaders');
{
  const sets = [[], ['CUTOUT'], ['CUTOUT', 'ZPRE', 'ZINV'], ['LIGHT2', 'L2AO', 'AIR2'], ['LIGHT2', 'L2AO', 'AIR2', 'PBR', 'FADE', 'CUTOUT'], ['LITE', 'FADE'], ['MODEL', 'Q_LEAF', 'Q_PLAZA', 'CUTOUT']];
  let same = 0; for (const s of sets) if (pre(S0.TERRAIN_FS, s.filter(x => x[0] !== 'Q')) === pre(S1.TERRAIN_FS, s)) same++;
  check(same === sets.length, 'switches off (and the models with them on): the terrain is the same text as before', same + '/' + sets.length);
  check(['VS', 'SKY_FS', 'COMPOSITE_FS', 'WATER_FS'].every(k => !S0[k] || S0[k] === S1[k]) && S0.TERRAIN_VS === S1.TERRAIN_VS, 'no other program\'s text changes');
  QA.use(QA.off(), true);
  check(['terrain', 'terrainCut', 'terrainCutZ', 'composite', 'sky'].every(n => QA.definesFor(n).length === 0), 'off: no defines anywhere');
  const on = QA.defaults('high');
  check(QA.definesFor('terrainCut', on, true)[0] === 'Q_LEAF' && QA.definesFor('terrainCutZ', on, true)[0] === 'Q_LEAF' && QA.definesFor('terrain', on, true).includes('Q_PLAZA') && !QA.definesFor('terrainCut', on, true).includes('Q_PLAZA'), 'Laubkronen on the terrain programs (the cut-out and its depth pass alike), Platzbelag on the opaque terrain');
  check(QA.definesFor('terrainCut', on, false).length === 0 && ['sky', 'water', 'prop', 'folk', 'composite', 'shadow'].every(n => QA.definesFor(n, on, true).length === 0), 'no Laubkronen without fancy leaves; nothing on other programs');
  const pd = QA.definesFor('terrain', on, true).find(d => d.startsWith('Q_PLAZA_L(l) ('));
  check(!!pd && /l == \d+\.0 \|\| l == /.test(pd) && !/Q_PLAZA_L|plazaLayers/.test(S1.TERRAIN_FS.replace('return Q_PLAZA_L(l);', '')), 'Platzbelag: the floors\' layers as a macro made when the program is built (not baked at load)', pd && pd.slice(0, 60));
  const t = pre(S1.TERRAIN_FS, ['CUTOUT', 'LIGHT2', 'L2AO', 'Q_LEAF', 'Q_PLAZA']);
  check(t.includes('vec4 qClump(') && t.includes('bool qCut(') && t.includes('qC = qClump(') && t.includes('col = qCanopy(') && t.includes('alb.rgb = qPlaza('), 'on: the functions and their calls');
  const z = pre(S1.TERRAIN_FS, ['CUTOUT', 'ZPRE', 'ZINV', 'Q_LEAF']);
  check(z.indexOf('qCut(') > 0 && z.indexOf('qCut(v_localPos') < z.indexOf('o_col = vec4(1.0 / 255.0'), 'the cut before the depth pass returns (both passes cut alike)');
  check(t.indexOf('n = normalize(mix(n, qC.xyz') < t.indexOf('float ndl') && t.indexOf('col = qCanopy(') > t.indexOf('vec3 col = alb.rgb * lighting;'), 'the volume normal before the light, the crown\'s light after it');
  check(V.GL.defineHook('terrain', ['Q']).join() === hook0('terrain', ['Q']).join(), 'off: the define chain gives what it gave before');
  QA.use(on, true); const h = V.GL.defineHook('terrainCut', ['Q']); QA.use(QA.off(), true);
  check(h.includes('Q') && h.includes('Q_LEAF'), 'the define hook chains after the others', h.slice(0, 3).join());
}

console.log('c · the mirrors');
{
  let unit = true, outward = 0, inside = 0, N = 0;
  for (let i = 0; i < 400; i++) {
    const p = [Math.sin(i * 12.9) * 400, 60 + Math.cos(i * 7.3) * 20, Math.cos(i * 3.7) * 400];
    const c = QA.clump(p); if (Math.abs(Math.hypot(c[0], c[1], c[2]) - 1) > 1e-6) unit = false;
    const e = 0.05, c2 = QA.clump([p[0] + c[0] * e, p[1] + c[1] * e, p[2] + c[2] * e]); N++;
    if (c2[3] >= c[3] - 1e-4) outward++;
    if (c[3] < 0) inside++;
  }
  check(unit && outward >= N * 0.95, 'the clump field: a unit normal that points out of the clumps', outward + '/' + N);
  check(inside > N * 0.25 && inside < N * 0.95, 'clumps and gaps between them (a share of the space inside)', inside + '/' + N);
  let centre = 0, sym = 0, cutN = 0, far = 0, tot = 0;
  for (let i = 0; i < 3000; i++) {
    const w = [Math.floor(Math.sin(i * 1.7) * 300) + (i % 16 + 0.5) / 16, 64, Math.floor(Math.cos(i * 2.3) * 300) + ((i * 7) % 16 + 0.5) / 16];
    for (const face of [2, 3]) {
      tot++;
      const c = QA.cut(w, face, 10);
      const fx = w[0] - Math.floor(w[0]), fz = w[2] - Math.floor(w[2]);
      if (c && Math.abs(fx - 0.5) < 0.18 && Math.abs(fz - 0.5) < 0.18) centre++;
      if (c) cutN++;
      if (QA.cut(w, face, 200)) far++;
    }
    if (QA.cut(w, 2, 10) === QA.cut(w, 3, 10)) sym++;
  }
  check(centre === 0, 'the cut never takes a face\'s middle (a single leaf block stays a leaf block)');
  check(sym === 3000, 'the same cut on both sides of a shared face (no gap that only one side shows)');
  check(cutN > tot * 0.05 && cutN < tot * 0.3, 'it takes the corners and some rim (a share of the face)', (cutN / tot * 100).toFixed(1) + ' %');
  let all4 = 0, some = 0;
  for (let i = 0; i < 2000; i++) {
    const vx = Math.floor(Math.sin(i * 3.1) * 500), vz = Math.floor(Math.cos(i * 1.9) * 500), e = 1.5 / 16;
    const q = [[vx + e, vz + e], [vx - e, vz + e], [vx + e, vz - e], [vx - e, vz - e]].map(([x, z]) => QA.cut([x, 70, z], 2, 10)).filter(Boolean).length;
    if (q === 4) all4++; if (q > 0) some++;
  }
  check(all4 < 2000 * 0.12 && some > 2000 * 0.4, 'each block\'s corner on its own: rarely all four round a vertex (no \'+\' holes in a flat wall)', all4 + ' of 2000 all four, ' + some + ' some');
  check(far === 0, 'nothing cut far away (no shimmer past ' + QA.LEAF.far[1] + ' m)');
  check(QA.green([0.25, 0.55, 0.15]) === 1 && QA.green([0.95, 0.75, 0.85]) === 0 && QA.green([0.8, 0.35, 0.1]) === 0 && QA.green([0.8, 0.83, 0.9]) === 0, 'Laubkronen\'s cut and hue only on green crowns (blossom, autumn, frost keep theirs)');
  check(Math.abs(QA.plazaLum(0.7) - (0.3 + 0.4 * 0.38)) < 1e-9 && QA.plazaLum(0.2) === 0.2 && QA.plazaLum(0.9) < 0.55, 'Platzbelag: the light floors compressed to a mid-tone, the darker ones untouched');
  const E0 = () => ({ horizon: [0.3941, 0.6291, 0.7533], skyMid: [0.0247, 0.0885, 0.2516], zenith: [0.0022, 0.0038, 0.0273], skyStops: [0.39, 0.35, 0.6, 0.2], skySpace: [0.18, 0.42, 1, 0.8], ambSky: [0.36, 0.44, 0.66], fogColor: [0.3, 0.45, 0.6] });
  const warm = (c) => c[0] / c[2], viol = (c) => (c[0] + c[2]) / 2 - c[1];
  const a = QA.skyScript(E0(), 0.8, 0, 0), b = E0();
  check(warm(a.horizon) > warm(b.horizon) + 0.3 && warm(a.ambSky) > warm(b.ambSky), 'by day the horizon and the fill light warmer');
  check(a.zenith[2] > b.zenith[2] * 5 && a.skySpace[2] < 0.5 && a.skySpace[3] < 0.4, 'by day a blue top, not navy space; the space and the nebula faint');
  const lum = (c) => c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
  check(Math.abs(lum(a.ambSky) - lum(b.ambSky)) < 1e-6, 'the fill light\'s level kept (only its hue)');
  check(viol(QA.SKY.mid) < viol(b.skyMid) + 0.05 && QA.SKY.mid[1] > QA.SKY.mid[0] * 1.8, 'the blue is blue (green over red, no violet)');
  const n = QA.skyScript(E0(), -0.3, 0, 0);
  check(JSON.stringify(n) === JSON.stringify(E0()), 'at night nothing changes (the night stays t-sky3\'s)');
  const r = QA.skyScript(E0(), 0.8, 1, 0);
  check(Math.abs(r.zenith[2] - b.zenith[2]) < Math.abs(a.zenith[2] - b.zenith[2]) * 0.2, 'in the rain the weather\'s grey mostly stays');
}

console.log('d · the GL side');
{
  global.VR.Renderer = function () {}; const R = V.Renderer.prototype;
  let built = 0; R.buildPrograms = function () { built++; }; R.applyQ = function () {};
  delete require.cache[require.resolve(SRC + '/qart_gl.js')]; require(SRC + '/qart_gl.js');
  const r = new V.Renderer(); r.q = QA.off(); r.buildPrograms(); const b0 = built;
  r.applyQ(); check(built === b0, 'applyQ: nothing rebuilt while the key holds');
  r.q.qLeaf = true; r.applyQ(); check(built === b0 + 1 && QA.q.qLeaf === true, 'a switch changed: the programs again, the switches seen');
  r.q.qSky = true; r.applyQ(); check(built === b0 + 2 && QA.q.qSky === true, 'Farbdrehbuch: env.js sees it');
  QA.use(QA.off(), true);
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

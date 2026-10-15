// t-material · PBR-lite (plan docs/superpowers/plans/2026-10-15-t-material.md, step 1), no browser:
//  a · the material table (tex_pbr.js): name → metal, clear coat, roughness scale, flags for the materials the frames show
//      glossy (marble, the plaza's gloss tiles, the hall's white stone, the hulls, varnished wood, metals, window panes)
//      and the ones that stay matte (grass, soil, sand, cloth, leaves); every layer has its four bytes
//  b · the painter's outputs: the mean roughness it writes for those materials (the per-texel detail the table scales)
//  c · the programs' defines: none of the new code on the lite look (Very Low), PBR from tier 1, SSR from tier 2
//  d · the presets, the settings row and its texts; applySettings hands the tier to the renderer; a change by hand makes
//      the preset „Eigene"
//  e · the shader text: the gloss code sits behind #ifdef PBR in the terrain programs
//   bash test/wt_run.sh material.js 300
require('./dom_stub.js');
const V = require('./load_shared.js');
for (const f of ['tex_core', 'tex_recipes1', 'tex_recipes2', 'tex_recipes3', 'tex_recipes4', 'tex_recipes5', 'tex_recipes6', 'tex_items', 'tex_groceries', 'tex_vox', 'tex_layout', 'tex_mat', 'tex_build', 'tex_pbr']) require('../src/main/' + f + '.js');
require('../src/main/i18n.js'); require('../src/main/lang_en.js'); require('../src/main/lang_de.js');
require('../src/main/settings_reg.js');
require('../src/main/bench.js'); require('../src/main/ultralite.js'); require('../src/main/ipu.js');
require('../src/main/game.js');
require('../src/main/shaders.js');
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
const R = V.R, P = V.PBR, names = R.texNames, L = names.length;

console.log('a · the material table');
{
  const of = (n) => P.of(n), fmt = (n) => { const m = of(n); return `${n}: metal ${m.metal} coat ${m.coat} rk ${m.rk} flags ${m.flags}`; };
  const glossy = ['marble_white', 'travertine', 'quartz_bricks', 'polished_andesite', 'vx_tile_gloss', 'vx_smooth_gloss', 'vollton_gloss', 'porcelain_tile', 'vx_mat_marble'];
  check(glossy.every(n => names.includes(n) && of(n).coat >= 0.5 && of(n).metal === 0), 'polished stone, the gloss tiles and the VX lacquer carry a clear coat ≥ 0.5, no metal', glossy.map(fmt).join(' · '));
  const metals = ['block:gold', 'block:iron', 'copper:block:0', 'vx_mat_metal', 'mod_steel'];
  check(metals.every(n => names.includes(n) && of(n).metal >= 0.9), 'the metal blocks and the brushed steel are metal', metals.map(fmt).join(' · '));
  const hulls = ['hull:white', 'hull:gray', 'hull_stripe:orange'];
  check(hulls.every(n => names.includes(n) && of(n).coat >= 0.6 && of(n).metal < 0.5), 'the hulls are painted metal under a lacquer', hulls.map(fmt).join(' · '));
  check(['oak_herringbone', 'vx_mat_wood'].every(n => names.includes(n) && of(n).coat >= 0.4), 'parquet and the furniture wood are varnished', fmt('oak_herringbone'));
  const matte = names.filter(n => /^(grass_top|grass_side|dirt|sand|gravel|podzol)$|^leaves:|^wool:|^short_grass|^flower:/.test(n));
  check(matte.length >= 20 && matte.every(n => of(n).coat === 0 && of(n).metal === 0 && of(n).rk >= 1), `the ground, the leaves, the flowers and the wool stay matte (${matte.length} layers)`, matte.slice(0, 6).map(fmt).join(' · '));
  check(['planks:oak', 'stone', 'cobblestone', 'bricks', 'stucco_white'].every(n => of(n).coat === 0 && of(n).metal === 0), 'rustic planks, stone, cobble, bricks and stucco keep their own (rough) look');
  const wins = ['ctm:white:0', 'window_black', 'vx_glass', 'stained_glass:blue'].filter(n => names.includes(n));
  check(wins.length >= 3 && wins.every(n => (of(n).flags & P.WIN) && of(n).coat === 1), 'window panes glow at night (the flag) and are smooth', wins.map(fmt).join(' · '));
  check(['glass_rail', 'frosted_glass', 'glass'].every(n => !(of(n).flags & P.WIN) && (of(n).flags & P.GLASS)), 'railings, frosted and plain glass are glass that does not glow');
  check(['item:quartz', 'ore:gold:stone'].every(n => of(n).metal === 0 && of(n).coat === 0), 'items and ores take nothing');
  const row = P.row(names);
  let ok = row.length >= L * 4;
  for (let l = 0; l < L && ok; l++) { const m = P.of(names[l]); if (row[l * 4] !== Math.round(m.metal * 255) || row[l * 4 + 1] !== Math.round(m.coat * 255) || row[l * 4 + 3] !== m.flags) ok = false; }
  check(ok, `every layer has its four bytes in the row (${L} layers, ${row.length} bytes)`);
  const nCoat = names.filter(n => P.of(n).coat > 0).length, nMetal = names.filter(n => P.of(n).metal > 0).length;
  console.log(`     ${nCoat} layers with a coat, ${nMetal} metallic, ${L - nCoat - nMetal} as before`);
}

console.log('b · the painter\'s outputs');
{
  const want = ['marble_white', 'vx_tile_gloss', 'hull:white', 'quartz_bricks', 'travertine', 'grass_top', 'dirt', 'sand', 'wool:white', 'vx_smooth_gloss'];
  const sub = want.filter(n => names.includes(n));
  const out = V.buildTextureArrays({ names: sub, cubeMask: new Uint8Array(sub.length).fill(1), bevel: 1, bevelAll: false, classic: false });
  const N = out.size, mean = {};
  sub.forEach((n, l) => { let s = 0; const m = out.material[0], b = l * N * N * 4; for (let i = 0; i < N * N; i++) s += m[b + i * 4 + 2]; mean[n] = +(s / N / N / 255).toFixed(3); });
  console.log('     mean roughness', JSON.stringify(mean));
  check(mean.marble_white <= 0.2 && mean.vx_tile_gloss <= 0.35 && mean['hull:white'] <= 0.4 && mean.vx_smooth_gloss <= 0.3, 'the painter writes marble, the gloss tiles, the VX lacquer and the hull smooth');
  check(mean.quartz_bricks <= 0.5 && mean.travertine <= 0.45, 'the hall\'s white stone is honed (≤ 0.5)');
  check(['grass_top', 'dirt', 'sand'].every(n => mean[n] >= 0.85) && mean['wool:white'] >= 0.9, 'grass, soil and sand ≥ 0.85, wool ≥ 0.9 (matte)');
  const eff = (n) => Math.min(1, mean[n] * P.of(n).rk);
  check(['grass_top', 'dirt', 'sand', 'wool:white'].every(n => eff(n) >= 0.93), 'and the table makes them rougher still (≥ 0.93: the shader skips their gloss)', ['grass_top', 'dirt', 'sand', 'wool:white'].map(n => n + ' ' + eff(n).toFixed(2)).join(', '));
}

console.log('c · the programs\' defines');
{
  const d = P.defines;
  check(d({ lite: true, pbr: 2 }).length === 0, 'the lite look (Very Low) gets none of the new code, whatever the tier');
  check(d({ pbr: 0 }).length === 0 && d({}).length === 0, 'tier 0: none');
  check(JSON.stringify(d({ pbr: 1 })) === '["PBR"]' && JSON.stringify(d({ pbr: 2 })) === '["PBR","SSR"]', 'tier 1: PBR; tier 2: PBR and SSR');
}

console.log('d · the presets, the settings row, applySettings');
{
  const G = V.Game, PR = G.PRESETS, proto = G.prototype;
  const tiers = ['potato', 'low', 'balanced', 'high', 'ultra', 'ultraLite'].map(p => PR[p].pbr);
  check(JSON.stringify(tiers) === '[0,1,1,2,2,2]', 'the tiers: Very Low 0, Low 1, Balanced 1, High 2, Ultra 2, Ultra · Leicht 2', JSON.stringify(tiers));
  const it = V.Settings.byKey('pbr');
  check(!!it && it.t === 'slider' && it.min === 0 && it.max === 2 && it.cost === 'mid' && it.sec === 'light', 'a slider 0–2 in Bild · Licht, cost 🟡', it && JSON.stringify({ t: it.t, min: it.min, max: it.max, cost: it.cost, sec: it.sec }));
  const I = V.I18N;
  for (const lang of ['de', 'en']) {
    I.lang = lang;
    const d = I.dict[lang] || {}, lab = d[it.lab], tip = d[it.tip], vals = d[it.vals];
    check(typeof lab === 'string' && typeof tip === 'string' && Array.isArray(vals) && vals.length === 3, `its label, tip and three values in ${lang}`, `${lab} — ${tip} — ${vals}`);
  }
  const r = { qBase: null, set: null, setQuality(q) { this.set = Object.assign({}, this.qBase || {}, q); this.qBase = Object.assign(this.qBase || {}, q); }, setOverride() {} };
  const g = { settings: Object.assign({}, PR.high, { preset: 'high' }), renderer: r, applySettings: proto.applySettings, saveSettings() {}, applyLook() {}, aqApply() {}, propMask: proto.propMask, ipuDefaults: proto.ipuDefaults };
  g.applySettings('*');
  check(r.set && r.set.pbr === 2, 'applySettings hands the tier to the renderer', r.set && r.set.pbr);
  g.settings.pbr = 1; g.applySettings('pbr');
  check(r.set.pbr === 1 && g.settings.preset === 'custom', 'a tier chosen by hand reaches the renderer and makes the preset „Eigene"', g.settings.preset);
}

console.log('e · the shader text');
{
  const S = V.SHADERS, fs = S.TERRAIN_FS;
  check(/#ifdef PBR[\s\S]*uniform sampler2D u_pbr;/.test(fs), 'the terrain shader reads the table only with PBR (u_pbr)');
  check(/#if defined\(PBR\)[\s\S]*pbrShade\(/.test(fs) && /#elif !defined\(LITE\)/.test(fs), 'the gloss replaces the old highlight with PBR; without it the old highlight stays (not on LITE)');
  const fsPbr = fs.indexOf('vec3 pbrShade(');
  check(fsPbr > 0 && fs.lastIndexOf('#ifdef PBR', fsPbr) > fs.lastIndexOf('#endif', fsPbr), 'pbrShade lives inside #ifdef PBR');
}

console.log('f · glass and the light lines');
{
  const S = V.SHADERS, ts = S.TRANS_FS, i = ts.indexOf('t-material · glass'), j = ts.lastIndexOf('#ifdef PBR', i);
  check(i > 0 && j > ts.lastIndexOf('#endif', i) && /u_glassRefr/.test(ts.slice(i)) && /glowK/.test(ts.slice(i)), 'the glass shading (Fresnel sky and sun, the filter through the copy, the night windows) sits behind #ifdef PBR');
  // the light lines' block light: the paving two blocks beside a line is washed in its colour (it was not)
  const R = V.R, T = R.T, line = R.byName.vx_floor_plaza_line, amber = R.byName.vx_floor_plaza_line_amber, pave = R.byName.vx_floor_plaza.defaultState;
  const nib = (e) => [(e >> 8) & 15, (e >> 4) & 15, e & 15];
  check(JSON.stringify(nib(T.emit[line.defaultState])) === '[0,7,9]' && JSON.stringify(nib(T.emit[amber.defaultState])) === '[9,5,1]', 'the cyan line emits [0, 7, 9], the amber [9, 5, 1]', `${nib(T.emit[line.defaultState])} · ${nib(T.emit[amber.defaultState])}`);
  const col = new Uint16Array(65536);
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) col[(80 << 8) | (z << 4) | x] = x === 8 ? line.defaultState : pave;
  const light = V.computeColumnLight(col, true), at = (x, y, z) => nib(light[(y << 8) | (z << 4) | x]);
  const a1 = at(9, 81, 8), a2 = at(10, 81, 8), a3 = at(11, 81, 8);
  check(a1[2] >= 7 && a2[2] >= 6 && a3[2] >= 5, 'the air over the paving one, two, three blocks beside the line holds its light (blue ≥ 7, 6, 5)', `${a1} · ${a2} · ${a3}`);
  // the flood's cost in the workers: a column of paving with sixteen lines, the new emission against the old
  const old = T.emit[line.defaultState]; const cpu = (f, n) => { let best = 1e9; for (let r = 0; r < 5; r++) { const c0 = process.cpuUsage(); for (let k = 0; k < n; k++) f(); const c1 = process.cpuUsage(c0); best = Math.min(best, (c1.user + c1.system) / 1000 / n); } return best; };
  const many = new Uint16Array(65536); for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) many[(80 << 8) | (z << 4) | x] = (x % 4 === 0) ? line.defaultState : pave;
  const tNew = cpu(() => V.computeColumnLight(many, true), 20);
  T.emit[line.defaultState] = (0 << 8) | (3 << 4) | 4; const tOld = cpu(() => V.computeColumnLight(many, true), 20); T.emit[line.defaultState] = old;
  console.log(`     a column of paving with 64 line blocks: ${tNew.toFixed(2)} ms to light (the old emission ${tOld.toFixed(2)} ms)`);
  check(tNew < tOld * 1.6 + 0.3, 'the brighter lines cost the workers' + "'" + ' light flood little (a worst case: a line every fourth block)', `×${(tNew / tOld).toFixed(2)}`);
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

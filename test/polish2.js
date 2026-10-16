// t-polish2 · WOW VIII, the gaps of v0.48 (docs/superpowers/plans/2026-10-16-t-polish2.md) — the logic, no browser:
//  5 · Villa Nova's windows carry the sky: the material table's GLOWSKY flag on the fine VX pieces' plain layer (not on
//      the 8³ pieces', not on glass), the shader's Fresnel over the glow (PBR only; the lite look never sees it)
//   bash test/wt_run.sh polish2.js 300
require('./dom_stub.js');
const V = require('./load_shared.js');
for (const f of ['tex_core', 'tex_recipes1', 'tex_recipes2', 'tex_recipes3', 'tex_recipes4', 'tex_recipes5', 'tex_recipes6', 'tex_items', 'tex_groceries', 'tex_vox', 'tex_layout', 'tex_mat', 'tex_build', 'tex_pbr']) require('../src/main/' + f + '.js');
global.self = global; require('../src/main/water_fx.js'); require('../src/main/light2.js'); require('../src/main/shaders.js');
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
const S = V.SHADERS, P = V.PBR, R = V.R;
// the text between `#ifdef X` and its `#endif` that holds `needle` (the nearest #ifdef before it, no #endif between)
const inside = (src, needle, def) => { const i = src.indexOf(needle); if (i < 0) return false; const j = src.lastIndexOf('#ifdef ' + def, i), k = src.lastIndexOf('#endif', i); return j > 0 && j > k; };

console.log('5 · Villa Nova\'s windows carry the sky (tex_pbr.js GLOWSKY, TERRAIN_FS)');
{
  check(P.GLOWSKY === 8 && (P.of('vx_smooth').flags & P.GLOWSKY) && !(P.of('vx_tile').flags & P.GLOWSKY) && !(P.of('vx_glass').flags & P.GLOWSKY) && !(P.of('vx_smooth_gloss').flags & P.GLOWSKY), 'the flag sits on the fine VX pieces\' plain layer only (not the 8³ pieces\', not glass, not the lacquer)', JSON.stringify(P.of('vx_smooth')));
  check(P.of('vx_smooth').coat === 0 && P.of('vx_smooth').metal === 0, 'the plain surface itself keeps no gloss (the flag is for its glowing voxels)');
  const names = R.texNames, row = P.row(names), i = names.indexOf('vx_smooth');
  check(i >= 0 && (row[i * 4 + 3] & 15) === 8 && (row[i * 4 + 3] >> 4) === 0, 'the row carries it in the flags\' low bits', i >= 0 ? row[i * 4 + 3] : 'no layer');
  // Villa Nova's window, meshed: its glass and frame voxels glow on the plain fine layer (voxnova.js: EMIS, no gloss, 16³)
  {
    const PAD = V.MESH_PAD || 1, PS = V.MESH_PS || 18, PSS = PS * PS, t = R.byName.vx_nova_window, s = t.has('facing') ? t.state({ facing: 0 }) : t.defaultState;
    const blocks = new Uint16Array(PSS * PS), light = new Uint16Array(PSS * PS).fill(0xf000), tn = new Uint16Array(PSS);
    for (const [x, y] of [[8, 8], [9, 8], [8, 9], [9, 9]]) blocks[(y + PAD) * PSS + (8 + PAD) * PS + (x + PAD)] = s;
    const r = V.meshSection({ blocks, light, grass: tn, foliage: tn, water: tn, sy: 0, ox: 0, oz: 0, smooth: true, fancyLeaves: true, vxLod: true }), a = r.vx || new Uint16Array(0), lay = {};
    for (let i = 0; i < a.length; i += 8) if ((a[i + 5] >> 12) & 1) { const n = R.texNames[a[i + 3] & 4095]; lay[n] = (lay[n] || 0) + 1; }
    check(Object.keys(lay).length === 1 && lay.vx_smooth > 200, 'a 2 × 2 Villa Nova window\'s glowing faces (glass, frame) all lie on that layer', JSON.stringify(lay));
  }
  const fs = S.TERRAIN_FS, k = fs.indexOf('a glowing pane carries the sky');
  check(k > 0 && inside(fs, 'a glowing pane carries the sky', 'PBR') && /& 8u/.test(fs.slice(k, k + 900)) && /pbrSky\(reflect\(-V, N\)/.test(fs.slice(k, k + 900)), 'the shader mirrors the sky over the glow by Fresnel, PBR only');
  check(k > fs.indexOf('col = mix(col, alb.rgb * (1.4 + u_emissiveBoost), e);'), 'after the emissive mix (it would overwrite it)');
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

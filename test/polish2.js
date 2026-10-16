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

console.log('3 · the wood\'s shafts: the march weighted by the canopy\'s gaps (light2.js volGap, VOL_FS)');
{
  const L2 = V.Light2;
  check(L2.crossings([1, 1, 1, 1]) === 0 && L2.crossings([0, 0, 0]) === 0 && L2.crossings([0, 1, 0, 1]) === 3 && Math.abs(L2.crossings([0, 0.5, 1]) - 1) < 1e-9, 'the crossings: 0 for a ray all lit or all in shade, one per edge between light and shade', L2.crossings([0, 1, 0, 1]));
  const noon = 0.4, gold = 0.12;
  check(L2.volGap(0, 6, noon) === 1 && L2.volGap(0.3, 6, noon) > 1, 'the open land (no canopy over the eye) is untouched, however broken its rays');
  check(L2.volGap(1, 0, noon) === 1 && L2.volGap(1, 1, noon) === 1, 'under the canopy a ray that crosses no shaft (all shade, or one edge) is untouched');
  const g2 = L2.volGap(1, 2, noon), g3 = L2.volGap(1, 3, noon), g5 = L2.volGap(1, 5, noon);
  check(g2 > 1 && g3 > g2 && g5 === g3 && g3 === 1 + L2.VOL.gap, 'a ray that crosses shafts under the canopy: its air ×(1 + gap) from three crossings on', [g2, g3, g5].map(x => x.toFixed(2)).join(' · '));
  check(L2.volGap(1, 3, gold) < L2.volGap(1, 3, noon) && L2.volGap(1, 3, gold) > 1 + L2.VOL.gap * 0.3, 'strongest with the sun high (noon\'s shafts were missing); at the golden hour a third of it (its shafts showed already)', L2.volGap(1, 3, gold).toFixed(2));
  // the canopy over the eye: light2.mjs's wood (oaks 5 apart, crowns 5 wide, 4–6 high) and the open ground
  const leaves = new Set();
  for (let i = 0; i < 9; i++) for (let j = 0; j < 7; j++) { const x = i * 5 + (j % 2) * 2, z = j * 6 + (i % 3), h = 4 + ((i * 7 + j * 3) % 3); for (let dy = -2; dy <= 1; dy++) { const r = dy === 1 ? 1 : 2; for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) leaves.add((x + dx) + ',' + (h + dy) + ',' + (z + dz)); } }
  const isLeaf = (x, y, z) => leaves.has(x + ',' + y + ',' + z);
  const inWood = L2.canopy(isLeaf, 21, 1, 19), open = L2.canopy(isLeaf, 120, 1, 120);
  const lone = L2.canopy((x, y, z) => x === 3 && z === 0 && y === 5, 0, 1, 0);
  check(inWood >= 0.8 && open === 0 && lone < 0.2, 'the canopy over an eye in light2.mjs\'s wood (its broken crowns count full), under one column of a crown a little, on open ground none', [inWood, lone, open].map(x => x.toFixed(2)).join(' · '));
  const fs = L2.VOL_FS;
  check(/crs \+= abs\(vis - pv\)/.test(fs) && /acc \*= 1\.0 \+ u_volGap\.y \* u_volGap\.x \* smoothstep\(1\.0, 3\.0, crs\)/.test(fs), 'the march counts the crossings and weighs its air as L2.volGap does');
  const gsrc = require('fs').readFileSync(__dirname + '/../src/main/light2_gl.js', 'utf8');
  check(/u_volGap, this\.l2Canopy \|\| 0, sunUp \? K\.gap \* L2\.volGapSun\(L\[1\]\) : 0\)/.test(gsrc) && /L2\.canopy\(/.test(gsrc), 'light2_gl.js hands the canopy and the gain by the sun\'s height to the march (the moon\'s light none)');
  check(V.Light2.defaults('potato').l2Vol === false && V.Light2.defaults('balanced').l2Vol === false && V.Light2.defaults('high').l2Vol === true, 'the volumetric light stays High and Ultra\'s (Very Low, Low, Balanced: no march, no cost)');
}

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

console.log('8 · the Hangar Hall\'s air (light2.js ROOM, l2Fog under AIR2)');
{
  const L2 = V.Light2, RM = L2.ROOM;
  check(L2.roomIndoor(1) === 0 && L2.roomIndoor(0.1) === 1 && L2.roomIndoor(0.55) > 0.3 && L2.roomIndoor(0.55) < 0.7, 'only indoors: the eye\'s sky light 1 → none, 0.1 → full', [L2.roomIndoor(1), L2.roomIndoor(0.55).toFixed(2), L2.roomIndoor(0.1)].join(' · '));
  const t40 = L2.roomHaze(40, RM.rho), t8 = L2.roomHaze(8, RM.rho), t200 = L2.roomHaze(200, RM.rho);
  check(t40 > 0.15 && t40 < 0.3 && t8 < 0.06 && Math.abs(t200 - L2.roomHaze(RM.max, RM.rho)) < 1e-9, 'thin: the hall\'s far end (40 blocks) a fifth toward the lamps\' colour, 8 blocks hardly, the haze ends at the room\'s reach', [t8, t40, t200].map(x => x.toFixed(3)).join(' · '));
  // the hangar's strips: cyan block light round the eye → a cyan haze; a lantern's room → a warm one; no light → none
  const cy = L2.roomColor([[0, 9, 12], [0, 7, 9], [0, 10, 13], [1, 8, 11], [0, 6, 8], [0, 11, 14], [0, 5, 7]]), warm = L2.roomColor([[12, 8, 4], [10, 7, 3], [9, 6, 3]]), dark = L2.roomColor([[0, 0, 0], [0, 0, 0]]);
  check(cy[2] > cy[1] && cy[1] > cy[0] * 4 && cy[2] < 0.3, 'the hangar\'s cyan strips give a cyan haze, a dim one (HDR < 0.3)', cy.map(x => x.toFixed(3)).join(', '));
  check(warm[0] > warm[2] * 2 && dark[0] + dark[1] + dark[2] === 0, 'a lantern\'s room a warm one, a dark room none');
  const fs = S.COMMON || '', src = L2.glslCommon();
  check(/uniform vec4 u_l2Room;/.test(src) && inside(src, 'uniform vec4 u_l2Room;', 'AIR2') && inside(src, 'if (u_l2Room.w > 0.0)', 'AIR2'), 'the room haze is AIR2\'s (Low and up; Very Low\'s programs never see it)');
  check(src.indexOf('if (u_l2Room.w > 0.0)') < src.indexOf('return mix(col, fc, clamp(f, 0.0, 1.0));', src.indexOf('if (u_l2Room.w > 0.0)')) && src.indexOf('if (u_dim != 0) return') < src.indexOf('if (u_l2Room.w > 0.0)'), 'after the open air, before the distance fog; never under water or in another dimension');
  const gsrc = require('fs').readFileSync(__dirname + '/../src/main/light2_gl.js', 'utf8');
  check(/u_l2Room, 0, 0, 0, 0/.test(gsrc) && /u\.u_l2Room\) \{ const r = this\.l2Room/.test(gsrc) && /L2\.roomIndoor\(this\.l2EyeSky\)/.test(gsrc), 'light2_gl.js sets it every frame from the eye (indoors only) and zero where the light is off');
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

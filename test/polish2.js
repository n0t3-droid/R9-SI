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

console.log('2 · the vistas at night: the far citadel\'s lights (gen_citadel.js lodBoxes, vgen 12), the far lights in LOD_FS, the halos by the lamp');
{
  const CIT = V.CitadelGen, C = V.Heart.CITADEL;
  const g11 = V.makeGen('overworld', 53, { vgen: 11 }), g12 = V.makeGen('overworld', 53, { vgen: 12 });
  const siteOf = (g) => CIT.near(g, C.x - 40, C.z - 40, C.x + 40, C.z + 40, 0).find(s => s.home);
  const s11 = siteOf(g11), s12 = siteOf(g12);
  check(!!s11 && !!s12 && JSON.stringify(CIT.lodBoxes(s11, g11)) === JSON.stringify(CIT.lodBoxes(s11)) && !CIT.farLit(g11) && CIT.farLit(g12), 'worlds before vgen 12 keep their far citadel (the boxes as without the world)');
  // the slits: far.js / lod.js draw a slit ±(r + 0.6) along the tower; the body box at the slit's middle has its own r
  const poke = (B) => B.filter(b => b.slits).map(b => { const ym = (b.y0 + b.y1) / 2, body = B.find(q => q.kd === 0 && q.x === b.x && q.z === b.z && q.y0 <= ym && q.y1 > ym); return body ? b.r + 0.6 - body.r : 99; });
  const B11 = CIT.lodBoxes(s11, g11), B12 = CIT.lodBoxes(s12, g12), p11 = poke(B11), p12 = poke(B12);
  check(p11.filter(d => d <= 0).length > p11.length / 2, 'v0.48\'s far slits lay inside the spire\'s body (the far citadel showed none)', p11.filter(d => d <= 0).length + ' of ' + p11.length + ' inside');
  check(p12.length === p11.length && p12.every(d => d >= 0.5), 'at vgen 12 every slit stands out of the body (≥ 0.5 block on each face)', 'least ' + Math.min(...p12).toFixed(2));
  const sl12 = B12.filter(b => b.slits), tr12 = B12.filter(b => b.kd === 4 && !b.slits && b.c[1] === 0x9A), tip12 = B12.filter(b => b.kd === 4 && b.c[0] === 0xFF && b.c[1] === 0x3A && b.r > 1);
  check(sl12.every(b => b.y1 - b.y0 === 9) && tr12.length > 0 && tr12.every(b => b.y1 - b.y0 === 2) && tip12.length > 0 && tip12.every(b => b.r === 1.5), 'the slits 9 tall, the trim rings 2, the tip beacons 3 wide', [sl12.length, tr12.length, tip12.length].join(' · '));
  const beam = B12.filter(b => b.night), main = s12.towers.find(T => T.kind === 'main');
  check(beam.length === CIT.BEAM.seg && beam.every(b => b.kd === 4 && b.x === main.x && b.z === main.z) && beam[0].y0 === s12.y + 3 + main.h && Math.abs(beam[beam.length - 1].y1 - beam[0].y0 - CIT.BEAM.up) < 1e-9 && beam.every((b, i) => i === 0 || b.night < beam[i - 1].night) && !B11.some(b => b.night), 'the Heartland\'s beam: over the main spire\'s tip, ' + CIT.BEAM.up + ' up in ' + CIT.BEAM.seg + ' pieces, fainter up the beam (vgen 12 only)', beam.map(b => b.night).join(' '));
  // the meshes: ring 1 (far.js) carries the beam as night boxes (aux bit 7, its strength), ring 2 (lod.js) none and the same glowing geometry as before
  const glowAux = (m) => { const u8 = new Uint8Array(m.verts.buffer || m.verts), n = u8.length / 12; let night = 0, glow = 0, strengths = new Set(); for (let i = 0; i < n; i++) { const k = u8[i * 12 + 6] >> 3, a = u8[i * 12 + 7]; if (k === 4) { glow++; if (a >= 128) { night++; strengths.add(a & 127); } } } return { night, glow, strengths: [...strengths].sort((x, y) => y - x) }; };
  const f11 = glowAux(V.Far.form(g11, { tx: -7, tz: 5, cell: 4 })), f12 = glowAux(V.Far.form(g12, { tx: -7, tz: 5, cell: 4 }));
  check(f11.night === 0 && f12.night === CIT.BEAM.seg * 16 && f12.strengths.join(' ') === '127 95 64 32', 'ring 1: the beam\'s four sides per piece flagged as night lights (aux 128 + strength), none before vgen 12', `${f12.night} of ${f12.glow} glowing vertices · strengths ${f12.strengths.join(' ')}`);
  const l11 = glowAux(V.LOD.build(g11, { level: 0, tx: -4, tz: 2 })), l12 = glowAux(V.LOD.build(g12, { level: 0, tx: -4, tz: 2 }));
  check(l12.night === 0 && l12.glow === l11.glow && l11.glow > 0, 'ring 2 (every preset): no beam, as many glowing vertices as before (the boxes only larger)', `${l11.glow} → ${l12.glow}`);
  // the far lights: LOD_FS under LIGHT2 only (Very Low's program as before: test/vl_programs.js), the night switch under FORM
  const L2 = V.Light2, fs = S.LOD_FS;
  check(Math.abs(L2.farLight(1) - (1 + L2.FARLIT.night)) < 1e-9 && L2.farLight(0) === 1 && L2.farLight(1) * 0.85 * 1.3 > L2.GRADE.night.bThr * 1.5, 'at night a far light ×' + L2.farLight(1).toFixed(1) + ' — over the bloom\'s night threshold (' + L2.GRADE.night.bThr + '), so it glows; by day as before');
  check(L2.farPierce(600) > 0.65 && L2.farPierce(1600) < 0.4 && L2.farPierce(0) === 1, 'it keeps exp(−d/' + L2.FARLIT.pierce + ') of itself through the haze: at 600 blocks ' + L2.farPierce(600).toFixed(2));
  check(inside(fs, 'col *= 1.0 + ', 'LIGHT2') && inside(fs, 'col = mix(col, lit0, lk * exp(-dist / ', 'LIGHT2') && /else if \(v_kind == 7u\) lk = step\(0\.28, hash13\(floor\(vec3\(wp\.x, v_rel\.y \+ u_camFrac\.y \+ float\(u_camInt\.y\), wp\.y\) - N \* 0\.02\) \* 1\.37 \+ 5\.1\)\)/.test(fs), 'LOD_FS: the boost and the piercing under LIGHT2; a window counts where it is lit (the same hash as its lamplight)');
  check(inside(fs, 'v_aux >= 128u', 'FORM') && /th >= float\(v_aux & 127u\) \/ 127\.0 \* \(1\.0 - smoothstep\(-0\.06, 0\.1, u_sunDir\.y\)\)\) discard;/.test(fs), 'the night lights drawn by the far ring\'s program only, at night, dithered by their strength');
  // the halos: a small lantern 0.6 of the lamp post's
  global.self = global; require('../src/main/motion.js'); require('../src/main/particles.js');
  const Pa = V.Particles, hz = Pa.haloSizes(), hs = Pa.haloStates();
  const st = (n) => { const t = R.byName[n]; for (let s = 1; t && s < R.T.type.length; s++) if (R.types[R.T.type[s]] === t && R.T.emit[s]) return s; return 0; };   // (a lit state)
  check(V.Motion.HALO.small === 0.6 && V.Motion.HALO.size === 1 && hz[st('lantern')] && hz[st('vx_lantern')] && hz[st('candle')] && hz[st('torch')] && !hz[st('vx_lamppost')] && !hz[st('vm_town_lamp')] && hs[st('lantern')] && hs[st('vx_lamppost')], 'the halos by the lamp: lanterns, candles, torches 0.6 — the lamp posts\' heads 1.0 (the vista balconies\' lanterns no longer 2-block discs)');
  const psrc = require('fs').readFileSync(__dirname + '/../src/main/particles.js', 'utf8');
  check(/o\.size = HL\.size \* \(HZ\[L\[i \+ 3\]\] \? small : 1\);/.test(psrc), 'particles.js sizes each lamp\'s halo by its kind');
}

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

console.log('4 · the golden hour\'s grade toward the frames (light2.js GRADE.gold; measured by test/land_grade.js)');
{
  const L2 = V.Light2, LG = require('./land_grade.js'), g = L2.GRADE.gold, g48 = LG.GRADE48.gold;
  // the measure's own footing: the grade taken back out of a picture gives the colour it was made from
  let worst = 0;
  for (const c of [[0.1, 0.12, 0.2], [0.45, 0.3, 0.2], [0.6, 0.62, 0.5], [0.8, 0.7, 0.55], [0.3, 0.5, 0.25]]) for (const [u, v] of [[0.5, 0.5], [0.1, 0.2]]) {
    const G = LG.gradeAt(LG.GRADE48, { day: 0.06, gold: 0.94, dusk: 0, night: 0 }), b = LG.ungradeJS(LG.gradeJS(c, u, v, 16 / 9, G), u, v, 16 / 9, G);
    worst = Math.max(worst, ...b.map((x, i) => Math.abs(x - c[i])));
  }
  check(worst < 0.004, 'land_grade.js: the grade taken back out of a picture gives back its colour (the measure\'s footing)', worst.toFixed(4));
  // the stop: the lights' lean halved (v0.48's golden split 9.2 against the frames' 6.2), the mid-tones less saturated
  const lean = (G, l) => { const c = L2.split([l, l, l], G.dark, G.light); return c[0] - c[2]; };
  check(lean(g, 0.85) > 0.02 && lean(g, 0.85) < lean(g48, 0.85) * 0.6 && lean(g, 0.1) < -0.01 && JSON.stringify(g.dark) === JSON.stringify(g48.dark), 'the lights\' warm lean about half of v0.48\'s, the shade\'s cool lean kept', [lean(g48, 0.85), lean(g, 0.85), lean(g, 0.1)].map(x => x.toFixed(3)).join(' · '));
  check(g.sat < g48.sat && g.sat >= 1 && g.s <= g48.s && g.mid === g48.mid && g.toe === g48.toe && g.sh === g48.sh, 'the mid-tones\' saturation 1.16 → ' + g.sat + ', the S ' + g48.s + ' → ' + g.s + '; the curve\'s ends and middle kept (the sky\'s fit)');
  // a warm sunlit wall in the middle of the picture: less orange than v0.48 graded it, still warm
  const m = { day: 0.06, gold: 0.94, dusk: 0, night: 0 }, wall = [0.78, 0.6, 0.42];
  const a = LG.gradeJS(wall, 0.5, 0.5, 16 / 9, LG.gradeAt(LG.GRADE48, m)), b = LG.gradeJS(wall, 0.5, 0.5, 16 / 9, LG.gradeAt(L2.GRADE, m));
  check(b[0] - b[2] < a[0] - a[2] && b[0] - b[2] > 0.3, 'a sunlit wall: less orange than v0.48 graded it, still warm (r − b)', [a[0] - a[2], b[0] - b[2]].map(x => x.toFixed(3)).join(' → '));
  for (const k of ['day', 'dusk', 'night']) check(JSON.stringify(L2.GRADE[k]).replace(/,"b(Thr|Str)":[\d.]+/g, '') === JSON.stringify(LG.GRADE48[k]), 'the ' + k + '\'s grade untouched');
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

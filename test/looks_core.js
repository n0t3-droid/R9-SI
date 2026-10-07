// Phase B1 „🎨 Aussehen" — the looks core (src/shared/looks.js) in node: the colour table, the VX roles and the
// wall/floor material set on the spec in place, the textured blocks' recolour (T.rc → the mesher's tint + w5 bit 15)
// and „Oberfläche" (another cube's face textures, slab faces too), and „Original wiederherstellen" byte-identical:
// every registry table, every VX spec and every mesh stream as before any look.
//   bash test/wt_run.sh looks_core.js
const V = require('./load_shared.js');
const R = V.R, T = R.T, VX = V.VX, F = V.F, SH = V.SHAPE;
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const L = V.Looks;
check(!!L && typeof L.apply === 'function', 'VR.Looks loads with the shared modules');
if (!L) { console.log('FAILED ' + fails); process.exit(1); }

// ---------------------------------------------------------------- helpers
const PAD = V.MESH_PAD, PS = V.MESH_PS, PSS = PS * PS;
const P = (x, y, z) => (y + PAD) * PSS + (z + PAD) * PS + (x + PAD);
// a little scene: a plaster wall with a window (VX), oak planks, a stone brick slab, stairs and a wall, a glass block,
// panorama glass, a grass block, an oak log and a torch — on a stone floor, in full daylight
function scene() {
  const blocks = new Uint16Array(PSS * PS), light = new Uint16Array(PSS * PS).fill(0xf000);
  const gr = new Uint16Array(PSS).fill(V.rgb565(120, 190, 80)), fo = new Uint16Array(PSS).fill(V.rgb565(90, 160, 60)), wa = new Uint16Array(PSS).fill(V.rgb565(60, 110, 220));
  const S = (n, p) => R.S(n, p);
  for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) blocks[P(x, 0, z)] = S('stone');
  for (let x = 2; x < 9; x++) for (let y = 1; y < 4; y++) blocks[P(x, y, 4)] = S('vx_plaster_white');
  blocks[P(5, 2, 4)] = S('vx_window', { facing: 0 });
  for (let x = 2; x < 6; x++) blocks[P(x, 1, 8)] = S('oak_planks');
  // each block on its own (air around it): its faces are found by place and texture
  blocks[P(7, 1, 8)] = S('stone_brick_slab', { type: 0 });
  blocks[P(9, 1, 8)] = S('stone_brick_stairs', { facing: 1, half: 0 });
  blocks[P(11, 1, 8)] = S('stone_brick_wall');
  blocks[P(13, 1, 8)] = S('stone_bricks');
  blocks[P(2, 1, 10)] = S('glass');
  blocks[P(4, 1, 10)] = S('panorama_white');
  blocks[P(6, 1, 10)] = S('grass_block');
  blocks[P(2, 1, 12)] = S('oak_log', { axis: 0 });
  blocks[P(3, 1, 12)] = S('oak_log', { axis: 1 });
  blocks[P(5, 1, 12)] = S('torch');
  blocks[P(7, 1, 12)] = S('vx_floor_oak');
  blocks[P(9, 1, 12)] = S('vx_redbrick');
  return { blocks, light, grass: gr, foliage: fo, water: wa, sy: 0, ox: 0, oz: 0, smooth: true, fancyLeaves: true };
}
const SCENE = scene();
function mesh() { const r = V.meshSection(SCENE); return [r.opaque, r.cutout, r.trans]; }
const sameArr = (a, b) => { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; };
const sameMesh = (a, b) => a.every((x, i) => sameArr(x, b[i]));
// every per-state table, copied
const TABLES = Object.keys(T);
const snapTables = () => TABLES.map(k => T[k].slice());
const sameTables = (s) => TABLES.every((k, i) => sameArr(T[k], s[i]));
const specJSON = () => JSON.stringify(R.types.filter(t => t.o.vx && !(t.o.vx.res >= 16)).map(t => { const o = {}; for (const k of Object.keys(t.o.vx).sort()) if (typeof t.o.vx[k] !== 'object' && typeof t.o.vx[k] !== 'function') o[k] = t.o.vx[k]; return [t.name, o]; }));
const modelsRef = () => R.models.slice();
const sameRefs = (a) => a.every((m, i) => R.models[i] === m);
// the vertices (8 × u16) of one stream whose texture layer is one of `layers` (and, with `at`, whose quad lies in that
// block's cell: a quad's centre, ±0.01)
const DEC = (v) => v / 2048 - 4;
function vertsOf(stream, layers, at) {
  const out = [];
  for (let q = 0; q < stream.length; q += 32) {
    if (!layers.has(stream[q + 3] & 0xfff)) continue;
    if (at) {
      let cx = 0, cy = 0, cz = 0; for (let k = 0; k < 4; k++) { cx += DEC(stream[q + k * 8]) / 4; cy += DEC(stream[q + k * 8 + 1]) / 4; cz += DEC(stream[q + k * 8 + 2]) / 4; }
      if (cx < at[0] - 0.01 || cx > at[0] + 1.01 || cy < at[1] - 0.01 || cy > at[1] + 1.01 || cz < at[2] - 0.01 || cz > at[2] + 1.01) continue;
    }
    for (let k = 0; k < 4; k++) out.push(stream.subarray(q + k * 8, q + k * 8 + 8));
  }
  return out;
}
const layersOf = (name) => { const t = R.byName[name], s = new Set(); for (let st = t.base; st < t.base + t.nstates; st++) for (let f = 0; f < 6; f++) s.add(T.tex[st * 6 + f] & 0xfff); return s; };

const T0 = snapTables(), SPEC0 = specJSON(), M0 = modelsRef();
VX.clearCache();
const MESH0 = mesh();

// ---------------------------------------------------------------- 1 · the colour table
{
  const keys = L.ROLES.map(r => r[0]).join(',');
  check(keys === 'col,col2,trim,plinth,corner,lintel,jamb,frame,sill,cap,glow,cushion,top', 'the 13 colour roles in the spec\'s order (' + keys + ')');
  const de = L.ROLES.map(r => r[1]).join(', ');
  check(de === 'Grundfarbe, Zweitfarbe, Kante, Sockel, Ecke, Sturz, Laibung, Rahmen, Fensterbank, Abdeckung, Leuchtfarbe, Polster, Platte', 'German role names: ' + de);
  check(L.ROLES.every(r => r.length >= 3 && r[2] && r[2] !== r[1]), 'every role has an English name too');
  check(T.rc instanceof Uint16Array && T.rc.length === R.stateCount && T.rc.every(v => v === 0), 'T.rc: one RGB565 per state, 0 = no colour');
  check(L.hex2int('#e2c995') === 0xe2c995 && L.int2hex(0x5a3f2a) === '#5a3f2a' && L.hex2int('e2c995') === -1 && L.hex2int('#xyz') === -1, 'hex ↔ int');
  check(L.to565(0xffffff) === 0xffff && L.to565(0) !== 0 && L.to565(0xff0000) === 0xf800, 'RGB565 (black is never 0, 0 means "none")');
  const rp = L.rolesOf('vx_plaster_white');
  check(['col', 'trim', 'plinth', 'lintel', 'jamb'].every(k => rp.includes(k)) && !rp.includes('glow') && !rp.includes('frame'), 'plaster wall roles: only what its spec has (' + rp.join(',') + ')');
  const rw = L.rolesOf('vx_window');
  check(rw.includes('frame') && rw.includes('sill'), 'window roles: frame, sill (' + rw.join(',') + ')');
  check(L.kindOf('vx_plaster_white') === 'vx' && L.kindOf('oak_planks') === 'tex' && L.kindOf('stone_brick_slab') === 'tex' && L.kindOf('water') === null && L.kindOf('air') === null && L.kindOf('nope') === null, 'kindOf: vx · tex · fluids and unknown names not offered');
  check(L.kindOf('vm_sofa_navy') === 'model' && L.kindOf('panorama_white') === null, 'kindOf: furniture models keep the Item-Crafter, connected panorama glass has no colour');
  const wp = L.patternsFor('vx_plaster_white').map(p => p[0]), fp = L.patternsFor('vx_floor_oak').map(p => p[0]);
  check(['plaster', 'timber', 'bricks', 'siding'].every(p => wp.includes(p)) && wp.every(p => V.VX.PAT[p]), 'walls: Material = their pattern (' + wp.join(',') + ')');
  check(['planks', 'tiles', 'marble'].every(p => fp.includes(p)), 'floors: Material = their pattern (' + fp.join(',') + ')');
  check(L.patternsFor('oak_planks').length === 0 && L.patternsFor('vx_window').length === 0, 'no Material for other blocks');
  check(L.surfaceOK('stone_bricks') && L.surfaceOK('stone_brick_slab') && L.surfaceOK('stone_brick_stairs') && !L.surfaceOK('torch') && !L.surfaceOK('vx_plaster_white'), '„Oberfläche" for cube families only');
  check(L.donorOK('polished_andesite') && !L.donorOK('glass') && !L.donorOK('stone_brick_slab') && !L.donorOK('vx_redbrick'), 'texture donors: full opaque cubes only');
}

// ---------------------------------------------------------------- 2 · normalize (what is stored and sent)
{
  const n = L.normalize({ v: 1, looks: { oak_planks: { rc: '#E6CFA4', junk: 1 }, vx_plaster_white: { vx: { col: '#e2c995', trim: 'red', pat: 'bricks', nope: '#000000' } }, gone_block: { rc: '#123456' }, x: { vx: { pat: 'lava' } } }, slots: {}, next: 'x' });
  check(n.looks.oak_planks.rc === '#e6cfa4' && !('junk' in n.looks.oak_planks), 'colours lower-case, unknown keys dropped');
  check(n.looks.vx_plaster_white.vx.col === '#e2c995' && !('trim' in n.looks.vx_plaster_white.vx) && n.looks.vx_plaster_white.vx.pat === 'bricks' && !('nope' in n.looks.vx_plaster_white.vx), 'a bad colour and an unknown role are dropped, a known pattern kept');
  check(n.looks.gone_block && n.looks.gone_block.rc === '#123456', 'an unknown block name stays stored (ignored when applied)');
  check(!n.looks.x, 'an entry left empty is dropped (unknown pattern)');
  check(n.next === 0 && n.v === 1, 'next defaults to 0');
  const e = L.normalize(null);
  check(e && e.v === 1 && Object.keys(e.looks).length === 0 && Object.keys(e.slots).length === 0, 'nothing stored → an empty set');
}

// ---------------------------------------------------------------- 3 · VX: roles and material on the spec, in place
{
  const wall = R.byName.vx_plaster_white, sp = wall.o.vx, idx = V.VX.WALLSPECS ? V.VX.WALLSPECS.indexOf(sp) : -2;
  const ch = L.apply({ looks: { vx_plaster_white: { vx: { col: '#e2c995', trim: '#5a3f2a', pat: 'bricks' } } } });
  check(sp.col === 0xe2c995 && sp.trim === 0x5a3f2a && sp.pat === 'bricks' && typeof sp.col2 === 'number', 'the spec takes the colours and the pattern (bricks get a mortar colour)');
  check(wall.o.vx === sp && (idx < 0 || V.VX.WALLSPECS[idx] === sp), 'the spec object stays the same (windows borrow it)');
  check(Array.isArray(ch) && ch.includes(wall.id), 'apply reports the changed block types');
  const m = mesh();
  const vxQuads = (ms) => ms[0].length;
  check(!sameMesh(m, MESH0) && vxQuads(m) > 0, 'the wall meshes in its new look');
  // the window next to the wall borrows the wall's (new) material: its section is in the same scene and it changed
  L.apply({ looks: {} });
  check(specJSON() === SPEC0 && sp.col2 === undefined, '↺ Original: the spec exactly as before (the added mortar colour removed again)');
  check(sameMesh(mesh(), MESH0), '↺ Original: every vertex as before');
}

// ---------------------------------------------------------------- 4 · textured blocks: the colour
{
  const oak = R.byName.oak_planks, rc = L.to565(0xe6cfa4);
  const ch = L.apply({ looks: { oak_planks: { rc: '#e6cfa4' } } });
  check(T.rc[oak.defaultState] === rc && ch.includes(oak.id), 'oak planks: T.rc = the RGB565 colour');
  const m = mesh(), oakL = layersOf('oak_planks');
  const vs = vertsOf(m[0], oakL);
  check(vs.length > 0 && vs.every(v => (v[5] & 0x8000) && !(v[5] & 0x4000) && v[7] === rc), 'every oak face: w5 bit 15 (recolour), tint = the colour (' + vs.length + ' vertices)');
  const others = vertsOf(m[0], layersOf('stone'));
  check(others.length > 0 && others.every(v => !(v[5] & 0x8000)), 'the stone floor around is not recoloured');
  // grass: its biome tint gives way to the chosen colour; a cut-out (torch) and a translucent block (glass) work too
  L.apply({ looks: { grass_block: { rc: '#3366cc' }, torch: { rc: '#ff8800' }, glass: { rc: '#88ccff' }, panorama_white: { rc: '#ff0000' }, stone_brick_slab: { rc: '#9aa0a8' }, stone_brick_stairs: { rc: '#9aa0a8' }, stone_brick_wall: { rc: '#9aa0a8' } } });
  const m2 = mesh();
  const gv = vertsOf(m2[0], layersOf('grass_block'));
  check(gv.length > 0 && gv.every(v => (v[5] & 0x8000) && v[7] === L.to565(0x3366cc)), 'grass block: recoloured on every face (the biome tint gives way)');
  const tv = vertsOf(m2[1], layersOf('torch'));
  check(tv.length > 0 && tv.every(v => (v[5] & 0x8000) && v[7] === L.to565(0xff8800)), 'torch (cut-out model): recoloured');
  const glv = vertsOf(m2[1].length ? new Uint16Array([...m2[1], ...m2[2]]) : m2[2], layersOf('glass'));
  check(glv.length > 0 && glv.every(v => (v[5] & 0x8000) && v[7] === L.to565(0x88ccff)), 'glass: recoloured');
  const pv = vertsOf(m2[2], layersOf('panorama_white'));
  check(pv.every(v => !((v[5] & 0xc000) === 0x8000)), 'connected panorama glass (w5 bit 14) never gets the recolour bit (' + pv.length + ' vertices)');
  const AT = { stone_brick_slab: [7, 1, 8], stone_brick_stairs: [9, 1, 8], stone_brick_wall: [11, 1, 8] };
  for (const n of Object.keys(AT)) { const v = vertsOf(m2[0], layersOf(n), AT[n]); check(v.length > 0 && v.every(q => (q[5] & 0x8000) && q[7] === L.to565(0x9aa0a8)), n + ': recoloured (' + v.length + ' vertices)'); }
  const sbv = vertsOf(m2[0], layersOf('stone_bricks'), [13, 1, 8]);
  check(sbv.length > 0 && sbv.every(q => !(q[5] & 0x8000)), 'stone bricks next to them (same texture, no look): not recoloured');
  L.apply({ looks: {} });
  check(sameTables(T0) && sameMesh(mesh(), MESH0), '↺ Original: T.rc back to 0, every vertex as before');
}

// ---------------------------------------------------------------- 5 · „Oberfläche": another cube's textures (cube families)
{
  const sb = R.byName.stone_bricks, pa = R.byName.polished_andesite, slab = R.byName.stone_brick_slab, stairs = R.byName.stone_brick_stairs, log = R.byName.oak_log;
  const paTop = T.tex[pa.defaultState * 6 + 2] & 0xfff, paSide = T.tex[pa.defaultState * 6 + 4] & 0xfff;
  const st = R.byName.stone; const stTop = T.tex[st.defaultState * 6 + 2] & 0xfff;
  L.apply({ looks: { stone_bricks: { tex: 'polished_andesite' }, stone_brick_slab: { tex: 'polished_andesite' }, stone_brick_stairs: { tex: { top: 'stone', side: 'polished_andesite', bottom: 'polished_andesite' } }, oak_log: { tex: { top: 'stone', side: 'polished_andesite' } } } });
  let ok = true; for (let f = 0; f < 6; f++) if ((T.tex[sb.defaultState * 6 + f] & 0xfff) !== (f === 2 ? paTop : (T.tex[pa.defaultState * 6 + f] & 0xfff))) ok = false;
  check(ok, 'stone bricks: all six faces from polished andesite');
  const s0 = slab.state({ type: 0 }), faces = R.models[s0];
  check(Array.isArray(faces) && faces.length && faces.every(f => (f.tex & 0xfff) === paTop || (f.tex & 0xfff) === paSide) && faces !== M0[s0], 'the slab\'s baked faces take the new textures');
  check((T.tex[stairs.defaultState * 6 + 2] & 0xfff) === stTop && (T.tex[stairs.defaultState * 6 + 4] & 0xfff) === paSide, 'stairs: top from stone, sides from andesite');
  // a log lying along x shows its end (top) texture east and west: the role follows the face, not the direction
  const lx = log.state({ axis: 1 }), ly = log.state({ axis: 0 });
  const endOK = (T.tex[ly * 6 + 2] & 0xfff) === stTop && (T.tex[ly * 6 + 4] & 0xfff) === paSide;
  const lxEnds = [0, 1].every(f => (T.tex[lx * 6 + f] & 0xfff) === stTop), lxSides = [2, 3, 4, 5].every(f => (T.tex[lx * 6 + f] & 0xfff) === paSide);
  check(endOK && lxEnds && lxSides, 'oak log: ends take the new top, the bark the new side — in every axis');
  const m = mesh();
  check(!sameMesh(m, MESH0), 'the scene meshes with the borrowed textures');
  L.apply({ looks: {} });
  check(sameTables(T0) && sameRefs(M0), '↺ Original: T.tex and the slab\'s face list exactly as before (the same objects)');
  check(sameMesh(mesh(), MESH0), '↺ Original: every vertex as before');
}

// ---------------------------------------------------------------- 6 · a long day of changes, then everything back
{
  const seq = [
    { looks: { oak_planks: { rc: '#e6cfa4' }, vx_plaster_white: { vx: { col: '#e2c995' } } } },
    { looks: { oak_planks: { rc: '#202020', tex: 'polished_andesite' }, vx_plaster_white: { vx: { col: '#e2c995', pat: 'timber' } }, vx_window: { vx: { frame: '#203040', sill: '#ffffff' } } } },
    { looks: { vx_window: { vx: { frame: '#ff0000' } }, stone_brick_slab: { rc: '#9aa0a8', tex: 'stone' }, vx_floor_oak: { vx: { pat: 'marble', col: '#f0f0f0' } } } },
    { looks: { vx_window: { vx: { frame: '#ff0000' } }, stone_brick_slab: { rc: '#9aa0a8', tex: 'stone' } } },
  ];
  let changedOK = true;
  for (const d of seq) { const ch = L.apply(d); if (!Array.isArray(ch)) changedOK = false; mesh(); }
  // the same data again changes nothing (no remesh work for an unchanged look)
  const again = L.apply(seq[seq.length - 1]);
  check(changedOK && Array.isArray(again) && again.length === 0, 'applying the same looks again changes no block type');
  L.apply({ looks: {} });
  check(sameTables(T0), '↺ after many changes: every registry table byte-identical');
  check(specJSON() === SPEC0, '↺ after many changes: every VX spec as shipped');
  check(sameRefs(M0), '↺ after many changes: every state\'s face list the same object');
  check(sameMesh(mesh(), MESH0), '↺ after many changes: every vertex as before');
}

// ---------------------------------------------------------------- 7 · cost (tables only; the remesh is the game's)
{
  const big = { looks: {} };
  const names = R.types.filter(t => L.kindOf(t.name) === 'tex').slice(0, 40).map(t => t.name);
  names.forEach((n, i) => { big.looks[n] = { rc: L.int2hex((i * 2654435761) & 0xffffff) }; });
  const vxs = R.types.filter(t => L.kindOf(t.name) === 'vx').slice(0, 20).map(t => t.name);
  vxs.forEach((n) => { big.looks[n] = { vx: { col: '#336699' } }; });
  L.apply(big); L.apply({ looks: {} });
  const t0 = process.hrtime.bigint();
  L.apply(big); L.apply({ looks: {} });
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 2;
  console.log('    apply 60 looks: ' + ms.toFixed(2) + ' ms');
  check(ms < 8, 'apply of 60 looks takes ' + ms.toFixed(2) + ' ms (budget 2 ms on tables; node with a cold JIT: < 8)');
  check(sameTables(T0) && specJSON() === SPEC0, 'and everything back');
}

// ---------------------------------------------------------------- 8 · the forged textures never depend on a look
{
  require('../src/main/tex_layout.js');
  const key = () => { const m = V.textureMasks(); return [m.cube.join(''), m.cut.join(''), m.leaf.join(''), m.block.join('')].join('|'); };
  const k0 = key();
  const d = { looks: { stone_bricks: { tex: 'polished_andesite' }, stone_brick_slab: { tex: { top: 'stone', side: 'stone' } }, oak_planks: { rc: '#e6cfa4' }, glass: { rc: '#ff0000' } } };
  const r = L.addVariant(d, { src: 'oak_leaves', name: 'Laub', look: { rc: '#ff8800' } }); const r2 = L.addVariant(r.data, { src: 'stone_brick_slab', name: 'Platte', look: { tex: 'polished_andesite' } });
  L.apply(r2.data);
  check(key() === k0, 'cube / cut-out / leaf / block masks (the texture cache key) are the same with looks and variants');
  L.apply({ looks: {} });
  check(key() === k0 && sameTables(T0), 'and after ↺ Original');
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

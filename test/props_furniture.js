// The smooth furniture (t-smooth, src/main/props.js): every furniture model is built from numbers and is a real piece —
// a sane number of vertices, no NaN, unit normals, its triangles wound outward (the face agrees with its vertices'
// normals: the pass culls back faces), the opaque part inside the block footprint of its voxel piece (a little room for
// the contact shadow and for decorations above a table), the materials set (fabric, wood, metal, light … and the tint
// slots of the coloured pieces), a far mesh of a few boxes; every furniture block the mesher knows (VR.PROP_FURN) has a
// model of its voxel piece's size, and the centre each anchor gets is the centre of the piece's cells for every facing.
//   bash test/wt_run.sh props_furniture.js
require('./load_shared.js');
require('../src/main/props.js');
const PR = VR.Props, VM = VR.VM, R = VR.R, S = PR.VSTRIDE, MAT = PR.MAT;
let fails = 0; const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const PLANTS = { monstera: 0.66, olive: 0.62 };   // leaves may reach a little past the pot's cell
const ABOVE = 0.45;                               // a vase or a lamp's top may rise above the piece's cells

// 1. every model: sizes, numbers, normals, winding, bounds, materials, the far mesh
const keys = Object.keys(PR.FURN);
check(keys.length >= 24, 'the furniture models are there (' + keys.length + ')');
let total = 0;
for (const key of keys) {
  const md = PR.FURN[key], m = PR.furnModel(key), nr = m.near, [W, H, D] = md.size;
  const v = nr.verts, ix = nr.idx, bad = [];
  if (!(nr.nv >= 24 && nr.nv <= 8000)) bad.push('vertices ' + nr.nv);
  if (!Array.from(v).every(Number.isFinite)) bad.push('NaN');
  if (!Array.from(ix).every(i => i < nr.nv)) bad.push('index out of range');
  let unit = 0, mats = new Set(), tints = new Set(), aoBad = 0;
  for (let i = 0; i < nr.nv; i++) {
    const o = i * S, l = Math.hypot(v[o + 3], v[o + 4], v[o + 5]);
    if (Math.abs(l - 1) > 0.02) unit++;
    mats.add(Math.round(v[o + 11])); tints.add(Math.round(v[o + 12]));
    if (!(v[o + 13] > 0.3 && v[o + 13] <= 1.0001)) aoBad++;
  }
  if (unit) bad.push(unit + ' normals not unit');
  if (aoBad) bad.push(aoBad + ' AO out of range');
  if ([...mats].some(x => !Object.values(MAT).includes(x))) bad.push('unknown material ' + [...mats].join(','));
  // winding: the opaque triangles face where their vertices' normals point (the pass culls back faces)
  let wrong = 0, tris = 0;
  for (let t = 0; t < nr.nOpaque; t += 3) {
    const a = ix[t] * S, b = ix[t + 1] * S, c = ix[t + 2] * S;
    const e1 = [v[b] - v[a], v[b + 1] - v[a + 1], v[b + 2] - v[a + 2]], e2 = [v[c] - v[a], v[c + 1] - v[a + 1], v[c + 2] - v[a + 2]];
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], ln = Math.hypot(n[0], n[1], n[2]);
    if (ln < 1e-7) continue;
    const vn = [v[a + 3] + v[b + 3] + v[c + 3], v[a + 4] + v[b + 4] + v[c + 4], v[a + 5] + v[b + 5] + v[c + 5]];
    tris++; if (n[0] * vn[0] + n[1] * vn[1] + n[2] * vn[2] <= 0) wrong++;
  }
  if (wrong > tris * 0.02) bad.push(wrong + ' of ' + tris + ' triangles wound inward');
  // the opaque part's box: inside the footprint (plants: a little past it), from the floor up to the cells (and a bit)
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let t = 0; t < nr.nOpaque; t++) { const o = ix[t] * S; for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], v[o + k]); mx[k] = Math.max(mx[k], v[o + k]); } }
  const tol = PLANTS[key] || 0.0, hw = W / 2 + Math.max(0.035, tol - 0.5), hd = D / 2 + Math.max(0.035, tol - 0.5);
  if (mn[0] < -hw || mx[0] > hw || mn[2] < -hd || mx[2] > hd) bad.push('outside the footprint x ' + mn[0].toFixed(2) + '…' + mx[0].toFixed(2) + ' z ' + mn[2].toFixed(2) + '…' + mx[2].toFixed(2) + ' (± ' + (W / 2) + ', ± ' + (D / 2) + ')');
  // (a table lamp on its side table stands on the table's top in the cell below: its model's drop)
  if (mn[1] < -0.02 - (md.drop || 0) || mx[1] > H + ABOVE) bad.push('height ' + mn[1].toFixed(2) + '…' + mx[1].toFixed(2) + ' (0…' + H + ')');
  // the far mesh: a few boxes, inside the near mesh's box
  const f = m.far;
  if (!f || !(f.nt >= 12 && f.nt <= 120)) bad.push('far mesh ' + (f ? f.nt + ' triangles' : 'missing'));
  else { for (let i = 0; i < f.nv; i++) for (let k = 0; k < 3; k++) { const q = f.verts[i * S + k]; if (q < m.near.min[k] - 0.05 || q > m.near.max[k] + 0.05) { bad.push('far mesh outside the near box'); i = f.nv; break; } } }
  total += nr.nt;
  check(!bad.length, `${key}: ${nr.nv} vertices, ${nr.nt} triangles (${nr.nt - nr.nOpaque / 3} translucent), far ${f ? f.nt : 0}, materials ${[...mats].sort((a, b) => a - b).join(',')}${bad.length ? ' — ' + bad.join('; ') : ''}`);
}
console.log('    all models: ' + total + ' triangles');

// 2. the materials of the pieces that need them: upholstery takes the piece's colour (tint 1), lamps glow, glass is
//    translucent, the plants have leaves
const has = (key, mat) => { const m = PR.furnModel(key).near; for (let i = 0; i < m.nv; i++) if (Math.round(m.verts[i * S + 11]) === mat) return true; return false; };
const tinted = (key, slot) => { const m = PR.furnModel(key).near; for (let i = 0; i < m.nv; i++) if (Math.round(m.verts[i * S + 12]) === slot) return true; return false; };
for (const k of ['sofa', 'chaise', 'armchair', 'bed']) check(has(k, MAT.fabric) && tinted(k, 1), `${k}: fabric in the piece's colour (tint slot 1)`);
check(tinted('sofa', 2) && tinted('bed', 2), 'the sofa\'s pillows and the bed\'s frame take the second colour (tint slot 2)');
for (const k of ['tripod', 'arclamp', 'pendant', 'nightstand', 'tv', 'chandelier', 'tablelamp:0', 'tablelamp:1']) check(has(k, MAT.light), `${k}: a part that glows (light)`);
for (const k of ['tripod', 'nightstand', 'tablelamp:0']) check(has(k, MAT.shade), `${k}: a fabric shade lit from inside`);
for (const k of ['barcart']) check(PR.furnModel(k).near.nOpaque < PR.furnModel(k).near.idx.length, `${k}: its bottles and trays are glass (the translucent part)`);
check(has('stool', MAT.leather) && has('console', MAT.wood) && has('sidetable:0', MAT.wood), 'the stool\'s seat is leather, the console and the side table are walnut');
for (const k of ['ctable_glass', 'dtable_oak', 'island']) check(PR.furnModel(k).near.nOpaque < PR.furnModel(k).near.idx.length, `${k}: glass drawn in the translucent part`);
for (const k of ['monstera', 'olive', 'planter']) check(has(k, MAT.leaf), `${k}: leaves`);
for (const k of ['dtable_oak', 'bookshelf', 'lowboard', 'kitchen:cabinet:w']) check(has(k, MAT.wood), `${k}: wood`);
for (const k of ['kitchen:cabinet', 'kitchen:sink', 'arclamp']) check(has(k, MAT.metal) || has(k, MAT.marble), `${k}: metal or marble`);
check(PR.furnModel('sofa') === PR.furnModel('sofa'), 'a model is built once and kept');

// 3. every furniture block of the mesher's list has a model of its voxel piece's size, and its colours
const list = VR.PROP_FURN || [];
check(list.length >= 50, 'the mesher lists the furniture blocks (' + list.length + ')');
let sized = 0, missing = [];
// (a VX32 piece's size is its model's; a village piece is one block, the bed two — its foot and its head)
for (let i = 0; i < list.length; i++) {
  const name = list[i], d = PR.furnDef(PR.FURN0 + i), vm = VM.MODELS[name], t = R.byName[name], key = PR.furnKey(PR.FURN0 + i, 0);
  if (!d || !PR.FURN[key] || !t) { missing.push(name); continue; }
  const want = vm ? [vm.W, vm.H, vm.D] : t.has('part') && t.o.kind === 'bed' ? [1, 1, 2] : [1, 1, 1], sz = PR.FURN[key].size;
  if (sz[0] === want[0] && sz[1] === want[1] && sz[2] === want[2]) sized++; else missing.push(name + ' size ' + sz + ' vs ' + want);
}
check(!missing.length && sized === list.length, `every furniture block has a model of its voxel piece's size (${sized} of ${list.length}${missing.length ? ': ' + missing.slice(0, 6).join(', ') : ''})`);
check(PR.furnDef(PR.FURN0 + list.indexOf('vm_sofa_navy')).a === 0x2F3F60 && PR.furnDef(PR.FURN0 + list.indexOf('vm_bed_rose')).b === 0xD9C6A5, 'the colours come from the voxel pieces (a navy sofa, a rose bed on ash)');

// 4. the anchor's centre and turn: the centre of the piece's cells (VM.footprint from part 0) for every facing
let placeOk = 0, placeAll = 0;
for (const name of ['vm_sofa_navy', 'vm_chaise_cream', 'vm_bed_grey', 'vm_arc_lamp', 'vm_island', 'vm_tv', 'vm_bookshelf', 'vm_armchair_sage']) {
  const vm = VM.MODELS[name], d = PR.FDEF[name], size = PR.FURN[d.model].size;
  for (let f = 0; f < 4; f++) {
    const fp = VM.footprint(vm, f); let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [dx, , dz] of fp) { x0 = Math.min(x0, dx); x1 = Math.max(x1, dx + 1); z0 = Math.min(z0, dz); z1 = Math.max(z1, dz + 1); }
    const out = PR.furnPlace(size, 100, 64, -200, f, [0, 0, 0, 0]);
    placeAll++;
    if (Math.abs(out[0] - (100 + (x0 + x1) / 2)) < 1e-9 && Math.abs(out[2] - (-200 + (z0 + z1) / 2)) < 1e-9 && Math.abs(out[3] - f * Math.PI / 2) < 1e-9) placeOk++;
    else console.log('    ' + name + ' facing ' + f + ': centre ' + out.slice(0, 3) + ' vs cells ' + [x0, x1, z0, z1]);
  }
}
check(placeOk === placeAll, `the centre and turn of a piece match its cells for every facing (${placeOk} of ${placeAll})`);
// the village bed: its anchor is the foot, its head lies one cell along its facing (gen_city: foot at v, head at v + 1 for
// facing 2); the centre is between the two cells
{
  const DIR = [[0, -1], [1, 0], [0, 1], [-1, 0]], d = PR.FDEF.vx_bed_red; let ok = 0;
  for (let f = 0; f < 4; f++) { const o = PR.furnPlace(PR.FURN.vbed.size, 40, 70, 20, f, [0, 0, 0, 0], d.cell); const hx = 40 + DIR[f][0], hz = 20 + DIR[f][1]; if (Math.abs(o[0] - ((40 + hx) / 2 + 0.5)) < 1e-9 && Math.abs(o[2] - ((20 + hz) / 2 + 0.5)) < 1e-9) ok++; }
  check(ok === 4, 'a village bed\'s centre lies between its foot and its head for every facing (' + ok + ' of 4)');
}
// the modular sofa: its variant follows the row bits of its anchor (bit 2 a neighbour on +x, bit 3 on −x)
{
  const k = PR.FURN0 + list.indexOf('vx_sofa_white');
  check(PR.furnKey(k, 2) === 'vsofa:0' && PR.furnKey(k, 2 | 4) === 'vsofa:1' && PR.furnKey(k, 2 | 8) === 'vsofa:2' && PR.furnKey(k, 2 | 12) === 'vsofa:3', 'a sofa in a row takes the variant of its neighbours (no arm where the row goes on)');
  const arms = (key) => { const m = PR.furnModel(key).near; let lo = 0, hi = 0; for (let i = 0; i < m.nv; i++) { const o = i * S; if (m.verts[o + 1] > 0.68 && m.verts[o + 1] < 0.76 && m.verts[o + 2] < 0.1) { if (m.verts[o] < -0.4) lo++; if (m.verts[o] > 0.4) hi++; } } return [lo > 0, hi > 0]; };
  const a0 = arms('vsofa:0'), a1 = arms('vsofa:1'), a2 = arms('vsofa:2'), a3 = arms('vsofa:3');
  check(a0[0] && a0[1] && a1[0] && !a1[1] && !a2[0] && a2[1] && !a3[0] && !a3[1], 'the arms stand only at the row\'s open ends (' + [a0, a1, a2, a3].map(a => a.map(Number).join('')).join(' ') + ')');
}
// the rugs: the variant follows the four sides of the anchor (bits 2–5); the border (the second colour, tint 2) runs only
// along the open sides, a rug block in the middle of a rug is all pile (tint 1)
{
  const k = PR.FURN0 + list.indexOf('vx_rug_sand');
  check(PR.furnKey(k, 0) === 'rug:0' && PR.furnKey(k, 4 | 16) === 'rug:5' && PR.furnKey(k, 60) === 'rug:15', 'a rug takes the variant of its four sides (rug:0, rug:5, rug:15)');
  const border = (key) => { const m = PR.furnModel(key).near, e = [0, 0, 0, 0]; let pile = 0; for (let i = 0; i < m.nv; i++) { const o = i * S; if (Math.round(m.verts[o + 12]) === 1) pile++; if (Math.round(m.verts[o + 12]) !== 2 || m.verts[o + 4] < 0.9) continue; const x = m.verts[o], z = m.verts[o + 2]; if (x < -0.4 && Math.abs(z) < 0.3) e[0]++; if (x > 0.4 && Math.abs(z) < 0.3) e[1]++; if (z < -0.4 && Math.abs(x) < 0.3) e[2]++; if (z > 0.4 && Math.abs(x) < 0.3) e[3]++; } return { e: e.map(v => v > 0), pile }; };
  const b0 = border('rug:0'), b5 = border('rug:5'), b15 = border('rug:15');
  check(b0.e.every(Boolean) && b5.e[0] && !b5.e[1] && b5.e[2] && !b5.e[3] && !b15.e.some(Boolean) && b15.pile > 0, 'the border runs along the open sides only (alone: all four; joined on +x and +z: −x and −z; in the middle: none, all pile)');
  const top = PR.furnModel('rug:15').near; let hi = -1; for (let i = 0; i < top.nv; i++) hi = Math.max(hi, top.verts[i * S + 1]);
  check(hi > 0.03 && hi < 0.08, 'a rug is a soft pile a few hundredths of a block thick (' + hi.toFixed(3) + ')');
}
// a table lamp on its side table stands on the table's top (10 units up the cell below: −6/16), the table under a lamp
// has no vase; apart they stand on the floor and the table keeps its vase
{
  const kl = PR.FURN0 + list.indexOf('vm_table_lamp'), kt = PR.FURN0 + list.indexOf('vm_side_table');
  const lo = (key) => PR.furnModel(key).near.min[1], hi = (key) => PR.furnModel(key).near.max[1];
  check(PR.furnKey(kl, 4) === 'tablelamp:1' && PR.furnKey(kl, 0) === 'tablelamp:0' && PR.furnKey(kt, 4) === 'sidetable:1', 'the lamp and the table take their stacked variants from bit 2');
  check(Math.abs(lo('tablelamp:1') + 6 / 16) < 1e-6 && Math.abs(lo('tablelamp:0')) < 1e-6, 'the lamp\'s base: on the table\'s top (' + lo('tablelamp:1').toFixed(3) + '), on the floor (' + lo('tablelamp:0').toFixed(3) + ')');
  check(hi('sidetable:1') < 10.1 / 16 && hi('sidetable:0') > 0.9, 'the table under a lamp leaves its top free (' + hi('sidetable:1').toFixed(3) + '), alone it carries its vase (' + hi('sidetable:0').toFixed(3) + ')');
}
// the turn: a quarter turn of the model takes its front (−z) to +x, as VM.footprint turns its cells
{
  const yaw = Math.PI / 2, c = Math.cos(yaw), s = Math.sin(yaw), fz = [0, 0, -1], q = [c * fz[0] - s * fz[2], s * fz[0] + c * fz[2]];
  const vm = VM.MODELS.vm_lowboard, fp = VM.footprint(vm, 1), xs = fp.map(p => p[0]), zs = fp.map(p => p[2]);
  check(Math.abs(q[0] - 1) < 1e-9 && Math.abs(q[1]) < 1e-9 && Math.max(...zs) - Math.min(...zs) === 2 && Math.max(...xs) === Math.min(...xs), 'facing 1 turns the front to +x and the three-block lowboard along z (the shader\'s turn and the cells agree)');
}

// 5. the instance of a piece: 12 floats — the centre, the turn, the first colour (linear), the second (sRGB number), the light
{
  const kind = PR.FURN0 + list.indexOf('vm_bed_sage'), out = new Float64Array(12);
  const end = PR.anchorData(kind, 10, 70, -30, 0xC9A5, out, 0, 2);
  const lin = (c) => Math.pow(c / 255, 2.2);
  check(end === 12 && out[0] === 10 && out[2] === -30 && out[1] === 70 && Math.abs(out[3] - Math.PI) < 1e-9, 'a bed facing 2: its centre is the shared corner of its four cells, turned half round (' + Array.from(out.slice(0, 4)).map(x => +x.toFixed(3)) + ')');
  check(Math.abs(out[4] - lin(0x8F)) < 1e-6 && out[7] === 0xB89262, 'the duvet colour (linear) and the frame\'s wood (the sRGB number) travel with the instance');
  check(Math.abs(out[8] - 12 / 15) < 1e-9 && Math.abs(out[9] - 9 / 15) < 1e-9 && Math.abs(out[11] - 5 / 15) < 1e-9, 'the light at the anchor (sky 12, block 9 10 5)');
}

// 6. the atlas: the leaves are cutout, the TV picture and the white quarter are solid
{
  const at = PR.furnAtlas(), A = (x, y) => at.data[(y * at.w + x) * 4 + 3];
  let leafOn = 0, leafOff = 0, cut = true;
  for (let y = 0; y < 128; y++) for (let x = 0; x < 256; x++) { const a = A(x, y); if (a === 255) leafOn++; else if (a === 0) leafOff++; else cut = false; }
  let solid = true; for (let y = 128; y < 256; y++) for (let x = 0; x < 256; x++) if (A(x, y) !== 255) solid = false;
  check(cut && leafOn > 4000 && leafOff > 4000, 'the leaves are cutout (' + leafOn + ' on, ' + leafOff + ' off)');
  check(solid, 'the TV picture and the white quarter are solid');
  const mx = 32, my = 64; check(A(mx, my) === 255 || A(mx + 1, my) === 255, 'the monstera leaf is there (its midrib)');
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

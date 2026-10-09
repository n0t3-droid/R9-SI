// Smooth furniture, round II (t-smooth2, src/main/props2.js and the mesher's lists): the pieces round I left as voxels are
// real furniture now — every model is built (vertex bounds, inside its footprint, materials, no NaN: props_furniture.js
// checks all of them; this test checks what each one must have): the curtain hangs in folds from a rod; the fridge is a
// rounded steel box with a door seam, handles and a dark vent on top; the dishwasher has a black glass front; the range
// hood a chimney and a light strip; art a thin frame round its painting (the atlas); mirrors the mirror material; the desk
// a thin top on a trestle and a drawer box; the wardrobes doors with seams, handles and a plinth; the lights glow (the
// lantern hangs when something is above it); the corner sofa joins the rows; and a rug runs on under the furniture that
// stands on it (a 3 × 4 rug with an armchair in it). The Klassisch look changes the material response only.
//   bash test/wt_run.sh props_furniture2.js
require('./load_shared.js');
require('../src/main/props.js');
require('../src/main/props2.js');
const fs = require('fs');
const PR = VR.Props, VM = VR.VM, R = VR.R, S = PR.VSTRIDE, MAT = PR.MAT;
let fails = 0; const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
// the vertices of a model (units: 16 a block, the footprint's corner at 0 as in the builder)
const verts = (key) => { const m = PR.furnModel(key), md = PR.FURN[key], v = m.near.verts, out = [], cx = md.size[0] * 8, cz = md.size[2] * 8; for (let i = 0; i < m.near.nv; i++) { const o = i * S; out.push({ x: v[o] * 16 + cx, y: v[o + 1] * 16, z: v[o + 2] * 16 + cz, nx: v[o + 3], ny: v[o + 4], nz: v[o + 5], u: v[o + 6], vv: v[o + 7], r: v[o + 8], g: v[o + 9], b: v[o + 10], m: Math.round(v[o + 11]), t: Math.round(v[o + 12]) }); } return out; };
const lum = (p) => 0.2126 * p.r + 0.7152 * p.g + 0.0722 * p.b;
const some = (key, f) => verts(key).some(f), count = (key, f) => verts(key).filter(f).length;

// 1. the curtain: a rod with rings under the ceiling, the sheet in folds from the rod to the floor, both faces, its colour
{
  const V = verts('curtain'), fab = V.filter(p => p.m === MAT.fabric);
  check(V.some(p => p.m === MAT.metal && p.y > 30.4) && fab.length > 400, `the curtain hangs from a metal rod at the top (${fab.length} fabric vertices)`);
  check(fab.every(p => p.t === 1), 'the sheet takes the curtain\'s colour (tint 1)');
  const ys = fab.map(p => p.y); check(Math.min(...ys) < 0.8 && Math.max(...ys) > 30, `it reaches from the rod to the floor (${Math.min(...ys).toFixed(1)}…${Math.max(...ys).toFixed(1)} units)`);
  const row = fab.filter(p => Math.abs(p.y - 15.4) < 1.2 && p.nz < -0.3).sort((a, b) => a.x - b.x);
  let crests = 0; for (let i = 1; i < row.length - 1; i++) if (row[i].z < row[i - 1].z && row[i].z <= row[i + 1].z) crests++;
  check(crests >= 4, `soft vertical folds across it (${crests} folds toward the room at mid height)`);
  check(fab.some(p => p.nz < -0.5) && fab.some(p => p.nz > 0.5), 'both faces of the sheet are drawn');
  check(PR.FDEF.vx_curtain_grey.model === 'curtain' && PR.FDEF.vx_curtain_grey.a === 0x8A8E96 && PR.FDEF.vm_curtain.a === 0xE8E2D4, 'linen and grey curtains share the model in their colours');
}
// 2. the fridges: a rounded steel box, the seam between the freezer drawer and the door, handles, a dark vent on top
for (const key of ['fridge', 'fridge:fr']) {
  const V = verts(key), metal = V.filter(p => p.m === MAT.metal);
  check(metal.some(p => Math.abs(p.nx) > 0.3 && Math.abs(p.nz) > 0.3), `${key}: a steel box with rounded edges`);
  const fronts = metal.filter(p => p.nz < -0.9 && p.z > 1.0 && p.z < 1.4 && p.x > 2 && p.x < 14);
  const seamY = key === 'fridge' ? [19.6, 19.85] : [11.65, 11.9];
  check(fronts.some(p => p.y < seamY[0]) && fronts.some(p => p.y > seamY[1]) && !fronts.some(p => p.y > seamY[0] && p.y < seamY[1]), `${key}: a door seam across the front (no door face at ${seamY.join('…')} units)`);
  check(metal.filter(p => p.z < 0.6).length > 20, `${key}: bar handles on stand-off posts in front of the doors`);
  check(V.some(p => p.y > 31.4 && p.z < 8 && lum(p) < 0.05), `${key}: a dark vent along the top's front edge`);
}
// 3. the dishwasher: a steel door round a black glass front, the cabinets' carcass (tint 1), the marble top
{
  const V = verts('dishwasher');
  check(V.some(p => p.m === MAT.metal && p.nz < -0.9) && V.some(p => p.m === MAT.gloss && p.nz < -0.9 && p.z < 0.7 && lum(p) < 0.01), 'dishwasher: a steel door with a black glass front');
  check(V.some(p => p.t === 1) && V.some(p => p.m === MAT.marble && p.y > 13.9), 'dishwasher: the carcass in the kitchen\'s colour and the marble worktop');
}
// 4. the range hoods: a chimney up to the ceiling, a light strip under the front edge
{
  const V = verts('hood');
  check(V.some(p => p.m === MAT.metal && p.y > 15.9) && V.filter(p => p.m === MAT.metal && p.y > 10).every(p => p.x > 4 && p.x < 12), 'hood: a slim chimney rises to the ceiling over the canopy');
  check(V.some(p => p.m === MAT.light && p.y < 5.6 && p.z < 3.5), 'hood: a light strip under the canopy\'s front edge');
  check(some('hood:island', p => p.m === MAT.light) && some('hood:island', p => p.t === 1), 'the island hood: its light strip, its colour (tint 1)');
}
// 5. art: a thin frame round a canvas painted in the atlas (the painting is the picture of the block)
{
  const A = PR.furnAtlas();
  for (const k of ['warm', 'cool', 'gold', 'abstract', 'landscape']) {
    const key = ['warm', 'cool', 'gold'].includes(k) ? 'vart:' + k : 'art:' + k, V = verts(key), r = PR.ATL['paint_' + k];
    const cv = V.filter(p => p.m === MAT.matte && p.u >= r[0] - 1e-6 && p.u <= r[2] + 1e-6 && p.vv >= r[1] - 1e-6 && p.vv <= r[3] + 1e-6 && !(p.u === 0.875 && p.vv === 0.875));
    const zs = V.filter(p => p.m !== MAT.matte).map(p => p.z);
    check(cv.length >= 4 && cv.every(p => p.nz < -0.9), `${key}: the canvas faces the room with the painting's atlas rectangle (${cv.length} vertices)`);
    check(Math.max(...zs) - Math.min(...zs) <= 1.7, `${key}: a thin frame (${(Math.max(...zs) - Math.min(...zs)).toFixed(2)} units deep)`);
    const px = Math.floor(r[0] * 256) + 20, py = Math.floor(r[1] * 256) + 20, o = (py * 256 + px) * 4, want = PR.paint(k, (px - (r[0] * 256 - 0.5)) / ((r[2] - r[0]) * 256 + 1), (py - (r[1] * 256 - 0.5)) / ((r[3] - r[1]) * 256 + 1));
    check(A.data[o + 3] === 255 && Math.abs(A.data[o] - want[0]) < 30 && Math.abs(A.data[o + 2] - want[2]) < 30, `${key}: the atlas holds the painting (${A.data[o]},${A.data[o + 1]},${A.data[o + 2]})`);
  }
  check(count('art:photo', p => p.m === MAT.metal) > 40, 'art:photo: three slim black frames');
  check(A.data[(224 * 256 + 224) * 4] === 255 && A.data[(224 * 256 + 224) * 4 + 1] === 255, 'the atlas keeps its white corner round UV0');
}
// 6. mirrors: the mirror material (MAT.mirror, the shader's reflective F2 response) facing the room
for (const key of ['mirror:floor', 'mirror:round', 'vmirror', 'wardrobe', 'vanity']) check(some(key, p => p.m === MAT.mirror && p.nz < -0.9), `${key}: mirror glass (MAT.mirror) facing the room`);
check(MAT.mirror === 12, 'MAT.mirror is material 12');
// 7. desks: a thin top, a trestle or slab legs, a drawer box
{
  const V = verts('desk'), top = V.filter(p => p.m === MAT.wood && p.y > 11 && p.y < 13 && p.ny > 0.9);
  check(top.length > 0 && Math.max(...V.filter(p => p.m === MAT.wood && p.x < 18 && p.y > 11).map(p => p.y)) - 11.3 <= 1.3, 'desk: a thin oak top (1.2 units)');
  check(V.some(p => p.m === MAT.metal && p.x < 3.4 && p.y < 1) && V.some(p => p.m === MAT.metal && p.x < 3.4 && p.y > 10), 'desk: a black steel trestle under one end');
  check(V.filter(p => p.m === MAT.wood && p.x > 19 && p.y < 11 && p.nz < -0.9).length >= 12 && V.filter(p => p.m === MAT.metal && p.x > 19 && p.z < 1.7).length > 30, 'desk: a drawer box with three drawer fronts and their pulls under the other end');
  check(some('tdesk', p => p.m === MAT.light) && some('sdesk', p => p.t === 1), 'the tech desk\'s screen glows; the school desk\'s seat takes its colour');
}
// 8. wardrobes: tall, two doors with seams, handles, a plinth; lacquer or wood
for (const [key, mat] of [['vwardrobe:lacquer', MAT.gloss], ['vwardrobe:wood', MAT.wood], ['wardrobe:walnut', MAT.wood]]) {
  const V = verts(key), doors = V.filter(p => p.m === mat && p.nz < -0.9 && p.z < 4.6 && p.y > 1 && p.y < 31.2);
  const W = PR.FURN[key].size[0] * 16, mid = W / 2;
  check(Math.max(...V.map(p => p.y)) >= 31.5, `${key}: a tall box (two blocks high)`);
  check(doors.some(p => p.x < mid - 0.3) && doors.some(p => p.x > mid + 0.3) && !doors.some(p => Math.abs(p.x - mid) < 0.1), `${key}: two doors with a seam between them`);
  check(V.some(p => p.m === MAT.metal && p.z < 3.4), `${key}: handles in front of the doors`);
  check(V.some(p => p.y < 0.8 && lum(p) < 0.05), `${key}: a dark plinth`);
}
// 9. lights: they glow; the lantern hangs from a chain when something is above it, stands on the floor otherwise
{
  check(count('vchandelier', p => p.m === MAT.light) > 50 && some('vchandelier', p => p.m === MAT.metal && p.y > 15.5), 'the chandelier: glowing bulbs and crystal drops on a brass frame from the ceiling');
  const l0 = verts('lantern:0'), l1 = verts('lantern:1');
  check(Math.min(...l0.map(p => p.y)) < 0.1 && Math.min(...l1.map(p => p.y)) > 3.5 && Math.max(...l1.map(p => p.y)) > 15.5, 'the lantern stands on the floor, or hangs on its chain from the ceiling');
  check(l0.some(p => p.m === MAT.light && p.t === 1), 'the lantern\'s glass glows in its colour (warm, or the crystal\'s violet: tint 1)');
  check(some('vpendant', p => p.m === MAT.light) && some('vpendant', p => p.t === 1) && some('sconce', p => p.m === MAT.light), 'the pendant glows inside its shade (black or brass), the sconce up and down the wall');
}
// 10. the corner sofa: backs along the back and the left side; an arm on the right unless a sofa continues there
{
  const arm = (key) => verts(key).some(p => p.t === 1 && p.x > 12.6 && p.y > 10.8 && p.y < 11.8 && p.z < 6);
  check(arm('vcorner:0') && !arm('vcorner:1'), 'the corner has an arm on its open right side, none where the row goes on');
  check(some('vcorner:0', p => p.t === 1 && p.x < 3 && p.y > 13) && some('vcorner:0', p => p.t === 1 && p.z > 13 && p.y > 13), 'its backs run along the back and the left side');
  const ck = VR.PROP_FURN0 + VR.PROP_FURN.indexOf('vx_sofa_corner_cream');
  check(PR.furnKey(ck, 1) === 'vcorner:0' && PR.furnKey(ck, 1 | 4) === 'vcorner:1', 'the corner takes its variant from its row bit');
}
// 11. the rows: the joining pieces have their four variants, the long table its legs only at the ends
{
  let ok = 0; for (const m of ['vupper', 'vcounter:p', 'vcounter:s', 'vcounter:h', 'vtub', 'vdtable:w', 'vdtable:m', 'vtvwall']) for (let j = 0; j < 4; j++) if (PR.FURN[m + ':' + j]) ok++;
  check(ok === 32, `the joining pieces have their four variants each (${ok} of 32)`);
  const legs = (key) => verts(key).filter(p => p.t === 2 && p.m !== MAT.shadow).length;
  check(legs('vdtable:w:0') > 0 && legs('vdtable:w:3') === 0 && legs('vdtable:w:1') > 0 && legs('vdtable:w:1') < legs('vdtable:w:0'), 'the long table: legs at both ends alone, at one end in a row, none in the middle');
}

// 12. the mesher: the round II names are appended (round I's kinds keep their numbers), the joins, the hanging lantern
const PS = VR.MESH_PS || 20, PSS = PS * PS, PAD = VR.MESH_PAD || 2;
const at = (x, y, z) => (y + PAD) * PSS + (z + PAD) * PS + (x + PAD);
const job = (place, mask) => { const blocks = new Uint16Array(PS * PS * PS), light = new Uint16Array(PS * PS * PS).fill(0xF000); place((x, y, z, s) => { blocks[at(x, y, z)] = s; }); const j = { blocks, light, grass: new Uint16Array(PS * PS), foliage: new Uint16Array(PS * PS), water: new Uint16Array(PS * PS), sy: 0, ox: 0, oz: 0, smooth: true, fancyLeaves: true, vxLod: true, vxDetail: true }; if (mask !== undefined) j.smoothProps = mask; return j; };
const anchors = (r) => { const L = []; if (r.props) for (let i = 0; i < r.props.length; i += 6) L.push(Array.from(r.props.slice(i, i + 6))); return L; };
const K = (name) => VR.PROP_FURN0 + VR.PROP_FURN.indexOf(name);
const FURN = (VR.PROP_GROUP || {}).furniture || 2;
{
  check(VR.PROP_FURN.indexOf('vx_rug_sand') === 80 && VR.PROP_FURN.indexOf('vm_sofa_charcoal') === 0 && VR.PROP_FURN.length >= 160 && VR.PROP_FURN0 + VR.PROP_FURN.length - 1 < 256, `round I's kinds keep their numbers, round II is appended (${VR.PROP_FURN.length} pieces, kinds up to ${VR.PROP_FURN0 + VR.PROP_FURN.length - 1})`);
  const r = VR.meshSection(job((put) => { put(4, 1, 4, R.S('vx_lantern')); put(4, 2, 4, R.S('stone')); put(8, 1, 8, R.S('vx_lantern_crystal')); }, FURN)), L = anchors(r);
  const f = (x) => (L.find(a => a[0] === x) || [])[4];
  check(f(4) === 4 && f(8) === 0, `the lantern under a block hangs (bit 2), the one on the floor stands (${f(4)}, ${f(8)})`);
  // an L: a row of two cream sofas facing north, the corner at its west end, a second row going south from the corner
  const r2 = VR.meshSection(job((put) => { put(5, 1, 5, R.S('vx_sofa_corner_cream', { facing: 0 })); put(6, 1, 5, R.S('vx_sofa_cream', { facing: 0 })); put(7, 1, 5, R.S('vx_sofa_cream', { facing: 0 })); put(5, 1, 6, R.S('vx_sofa_cream', { facing: 1 })); }, FURN)), L2 = anchors(r2);
  const g = (x, z) => (L2.find(a => a[0] === x && a[2] === z) || [])[4];
  check((g(5, 5) & 4) && (g(6, 5) & 8) && !(g(7, 5) & 4), `the corner joins the row on its right and the row loses its arm there (corner ${g(5, 5)}, row ${g(6, 5)}, ${g(7, 5)})`);
  check(PR.furnKey(K('vx_sofa_corner_cream'), g(5, 5)) === 'vcorner:1' && PR.furnKey(K('vx_sofa_cream'), g(6, 5)) === 'vsofa:3' && PR.furnKey(K('vx_sofa_cream'), g(7, 5)) === 'vsofa:2', 'the corner and the row take their joined variants (the row\'s last sofa keeps its arm on the open end)');
  const r3 = VR.meshSection(job((put) => { for (const x of [3, 4, 5]) put(x, 1, 9, R.S('vx_kitchen_' + (x === 3 ? 'sink' : x === 4 ? 'hob' : 'island'), { facing: 0 })); }, FURN)), L3 = anchors(r3);
  check(L3.length === 3 && PR.furnKey(K('vx_kitchen_sink'), L3.find(a => a[0] === 3)[4]) === 'vcounter:s:1' && PR.furnKey(K('vx_kitchen_hob'), L3.find(a => a[0] === 4)[4]) === 'vcounter:h:3', 'a run of sink, hob and counter is one worktop (the sink joins on its right, the hob on both sides)');
}
// 13. the rug under the furniture: a 3 × 4 rug with an armchair in it (the generator gave the armchair's cell to the
// chair): the rug runs on under the chair and the rugs round it join it; a chair beside the rug gets none
{
  const rug = R.S('vx_rug_sand'), kr = K('vx_rug_sand'), ka = K('vm_armchair_sage');
  const place = (put) => { for (let x = 3; x <= 5; x++) for (let z = 3; z <= 6; z++) if (!(x === 4 && z === 4)) put(x, 1, z, rug); VM.put((xx, yy, zz, n, pr) => put(xx, yy, zz, R.S(n, pr)), 4, 1, 4, 'vm_armchair_sage', 0); VM.put((xx, yy, zz, n, pr) => put(xx, yy, zz, R.S(n, pr)), 8, 1, 4, 'vm_armchair_sage', 1); };
  const L = anchors(VR.meshSection(job(place, FURN)));
  const rugAt = (x, z) => L.find(a => a[0] === x && a[2] === z && a[3] === kr);
  check(L.some(a => a[0] === 4 && a[2] === 4 && a[3] === ka) && rugAt(4, 4) && rugAt(4, 4)[4] === 60, `a rug anchor under the armchair, joined on all four sides (${rugAt(4, 4) ? rugAt(4, 4)[4] : 'none'})`);
  check(rugAt(4, 3)[4] === (4 | 8 | 16) && rugAt(3, 4)[4] === (4 | 16 | 32) && rugAt(5, 4)[4] === (8 | 16 | 32) && rugAt(4, 5)[4] === 60, `the rugs round it join it: no bordered hole (${[rugAt(4, 3)[4], rugAt(3, 4)[4], rugAt(5, 4)[4], rugAt(4, 5)[4]].join(',')})`);
  check(L.filter(a => a[3] === kr).length === 12 && !rugAt(8, 4), `one rug of 3 × 4 cells; the armchair beside it stands on the floor (${L.filter(a => a[3] === kr).length} rug anchors)`);
  // the reading corner of the villas: rug at the corners and the front row, a floor lamp, two armchairs and the side table
  const place2 = (put) => { for (const [x, z] of [[3, 3], [5, 3], [3, 5], [4, 5], [5, 5]]) put(x, 1, z, rug); VM.put((xx, yy, zz, n, pr) => put(xx, yy, zz, R.S(n, pr)), 4, 1, 3, 'vm_floor_lamp', 0); for (const [x, f] of [[3, 1], [5, 3]]) VM.put((xx, yy, zz, n, pr) => put(xx, yy, zz, R.S(n, pr)), x, 1, 4, 'vm_armchair_sage', f); put(4, 1, 4, R.S('vm_side_table', { facing: 0, part: 0 })); };
  const L2 = anchors(VR.meshSection(job(place2, FURN))), rug2 = L2.filter(a => a[3] === kr && a[1] === 1);
  check(rug2.length === 9 && rug2.every(a => a[0] >= 3 && a[0] <= 5 && a[2] >= 3 && a[2] <= 5), `the reading corner's rug runs under the lamp, the chairs and the side table: 3 × 3 (${rug2.length} cells)`);
  const none = VR.meshSection(job(place)), plants = VR.meshSection(job(place, 1));
  check(none.props === undefined && plants.props && plants.props.length === 0, 'without the furniture asked for, no anchors: the voxel rug and chair are meshed as before');
}
// 14. the Klassisch look changes the furniture's material response only (FURN_FS reads u_blockVar; the vertex shader,
// the shape, does not); the water's reflection draws the props (renderer.js reflectPass → drawProps)
{
  const sh = fs.readFileSync(__dirname + '/../src/main/shaders.js', 'utf8'), rd = fs.readFileSync(__dirname + '/../src/main/renderer.js', 'utf8');
  const fsrc = sh.slice(sh.indexOf('S.FURN_FS'), sh.indexOf('S.FURN_SHADOW_FS')), vsrc = sh.slice(sh.indexOf('S.FURN_VS'), sh.indexOf('S.FURN_FS'));
  check(/uniform float u_blockVar/.test(fsrc) && /u_blockVar > 0\.5/.test(fsrc) && !/u_blockVar/.test(vsrc), 'Klassisch: the furniture shader reads the look in its material response, the vertex shader never (no change of shape)');
  check(/m == 12/.test(fsrc), 'the furniture shader knows the mirror material (12)');
  const rp = rd.slice(rd.indexOf('reflectPass(F, E, world, vis, camPos) {'), rd.indexOf('waterUniforms(p, E) {'));
  check(/drawProps\(/.test(rp) && /noReflProps/.test(rp), 'the water\'s planar reflection draws the props (with a switch: renderer.noReflProps)');
}
// 15. the last pieces of the test's rooms: the mansion hall's fountain holds water in its basin and its bowl, the garden
// light (the villa's pool edge) and the villages' arc lamp glow; all three are in the mesher's list
{
  const V = verts('fountain'), water = V.filter(p => p.m === MAT.glass && p.ny > 0.9);
  check(water.some(p => p.y > 2 && p.y < 3.6) && water.some(p => p.y > 10 && p.y < 11.5) && V.some(p => p.m === MAT.marble && p.y > 3.4 && Math.hypot(p.x - 8, p.z - 8) > 7.4), `the fountain: water in the basin and in the upper bowl, a stone rim round it (${water.length} water vertices)`);
  check(some('glamp', p => p.m === MAT.light && p.y > 9 && p.y < 13) && some('glamp', p => p.m === MAT.metal && p.y < 1), 'the garden light: a glowing drum on a black post and foot');
  check(some('varclamp', p => p.m === MAT.light && p.x < 8.5 && p.z < 8.5) && some('varclamp', p => p.m === MAT.gloss && p.y < 1.4 && p.x > 8), 'the arc lamp: the foot in the back corner, the glowing shade over the front corner');
  check(['vx_fountain', 'vx_garden_lamp', 'vx_arc_lamp'].every(n => VR.PROP_FURN.includes(n) && PR.FDEF[n]), 'the fountain, the garden light and the arc lamp are listed and defined');
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

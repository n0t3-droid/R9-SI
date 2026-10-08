// Villa Nova (gen_nova.js, voxnova.js, the catalogue entry in gen_plan.js) — the trailer's house as blocks:
//   1. the catalogue: Villa Nova is appended (index 11, lot 25 × 25), the town lots (PLAN.DIMS) and PLAN.pick are as before
//   2. the build: every block name exists, the same plan twice gives the same blocks, the info record (door, beds, seats)
//   3. the masses: three storeys, each set back from the one below at the front and the sides; three slab zones, each
//      two blocks thick and cantilevering past the walls below; a light line (vx_nova_band, cyan + orange underglow) on
//      every cell of every slab edge; white balusters on every terrace edge
//   4. the windows: per facade every window is one closed rectangle of vx_nova_window in one wall plane (the frame
//      joins: a 2 × 3 cluster has frame cells only on its outer ring), every storey's front is glazed, lintels over them
//   5. the hall: the glass wall to the garden, the pad and the cyan ring round it, two floating stairs (one tread cell per
//      block up and one forward, head room above every tread, the first floor open over them), the cove ring
//   6. the garden: lawn, hedges, round bushes and trees, palms with crowns on trunks, planters, the curved path joined from
//      the street to the door with light lines on both edges
//   7. the new pieces: registered after the shipped ids, the lazy models build to their declared cells, every state
//      paints and meshes under 1000 quads
// SLICES=1 prints the lot as ASCII slices per level.   bash test/wt_run.sh trailer_villa.js
const V = require('./load_shared.js');
const R = V.R, VG = V.VillageGen, PLAN = VG.plan2, VM = V.VM, VX = V.VX;
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const nameOf = (s) => (s ? R.types[R.T.type[s]].name : '');
const propOf = (s, k) => { const t = s && R.types[R.T.type[s]]; return t && t.has(k) ? t.get(s, k) : undefined; };

console.log('1 · the catalogue');
const BASE_DIMS = [[37, 33], [34, 31], [31, 30], [35, 34], [37, 35], [32, 28], [35, 30], [47, 40], [29, 28], [24, 28], [19, 25]];
const T = PLAN.TRAILER, cat = PLAN.CATALOGUE[T];
check(T === 11 && cat && cat.name === 'Villa Nova' && cat.special && cat.lot.join() === '25,25', 'Villa Nova is the catalogue\'s 12th house (index ' + T + ', lot ' + (cat && cat.lot.join(' × ')) + ')');
check(JSON.stringify(PLAN.DIMS) === JSON.stringify(BASE_DIMS) && JSON.stringify(VG.modern.DIMS.home) === JSON.stringify(BASE_DIMS), 'the town lots are the eleven of before (the towns draw the same houses)');
check(BASE_DIMS.every(([w, d]) => !PLAN.pick(w, d).special) && !PLAN.pick(60, 60).special && PLAN.pick(25, 25) === cat, 'PLAN.pick never hands it to a town lot, only to a lot of exactly 25 × 25');
check(PLAN.templates.trailer === cat.make && cat.make({}).family === 'trailer' && PLAN.SKINS.nova && V.ITEMS['blueprint_' + T], 'the family id trailer, the skin nova and the blueprint item blueprint_' + T);

// ---------------------------------------------------------------- the build into a cell map (the worker's way: last write wins)
const F = 64, W = cat.lot[0], D = cat.lot[1];
function build() {
  const rec = new Map(), names = new Set(), unknown = new Set();
  const L = VG.makeLot((x, y, z, s) => rec.set(x + ',' + y + ',' + z, s), 0, 0, 0);
  const P0 = L.P;
  L.P = (u, y, v, name, pr) => { if (typeof name === 'string') { names.add(name); if (!R.byName[name]) unknown.add(name); } return P0(u, y, v, name, pr); };
  const info = PLAN.build(L, { w: W, d: D, F, r: 0, ox: 0, oz: 0, kind: 'home' }, { index: T, rng: new V.RNG(7), ground: () => F - 1, beds: 3 });
  return { rec, names, unknown, info };
}
const A = build(), B = build();
const at = (u, y, v) => A.rec.get(u + ',' + (F + y) + ',' + v) || 0;
const nm = (u, y, v) => nameOf(at(u, y, v));
const hash = (rec) => { let h = 2166136261 >>> 0; for (const k of [...rec.keys()].sort()) { for (const c of k) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } h ^= rec.get(k); h = Math.imul(h, 16777619) >>> 0; } return h; };
console.log('2 · the build');
check(A.unknown.size === 0, 'every block name exists (' + A.names.size + ' names' + (A.unknown.size ? ', unknown: ' + [...A.unknown].join(', ') : '') + ')');
check(hash(A.rec) === hash(B.rec), 'the same plan twice gives the same blocks (' + A.rec.size + ' cells)');
const info = A.info, H = info.plan;
check(info.skin === 'nova' && H.family === 'trailer' && H.u0 === 2 && H.v0 === 6 && H.w === 21 && H.d === 15, 'the info record: skin nova, family trailer, house 21 × 15 at (2, 6)');
check(info.door && nm(info.door[0], info.door[1] - F, info.door[2]) === 'door_glass_white' && info.beds.length >= 1 && info.seats.length >= 6 && info.roofTop >= F + 20, 'a glass front door at the door cell, ' + info.beds.length + ' bed, ' + info.seats.length + ' seats, the roof at +' + (info.roofTop - F));

// ---------------------------------------------------------------- 3 · the masses
console.log('3 · the masses');
const NOVA = PLAN.NOVA, { G, U, T: Tt, OVER } = NOVA;
const WALLS = new Set(['vollton_stone_grey', 'vollton_light_grey', 'vollton_mid_grey', 'vx_nova_window', 'vx_nova_band', 'door_glass_white', 'panorama_white', 'vx_beam_white']);
// the footprint of a storey: the bounding box of wall cells at its middle height (gardens, crowns and bushes excluded)
const footprint = (y) => { let u0 = 99, v0 = 99, u1 = -99, v1 = -99; for (let v = -4; v < D + 4; v++) for (let u = -4; u < W + 4; u++) if (WALLS.has(nm(u, y, v))) { u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); } return { u0, v0, u1, v1 }; };
const fG = footprint(3), fU = footprint(U.y + 3), fT = footprint(Tt.y + 3);
console.log('    footprints  G ' + JSON.stringify(fG) + '  U ' + JSON.stringify(fU) + '  T ' + JSON.stringify(fT));
check(fU.v0 - fG.v0 >= 2 && fU.u0 - fG.u0 >= 2 && fG.u1 - fU.u1 >= 2, 'the first floor stands back from the ground floor at the front (' + (fU.v0 - fG.v0) + ') and the sides (' + (fU.u0 - fG.u0) + ', ' + (fG.u1 - fU.u1) + ')');
check(fT.v0 - fU.v0 >= 2 && fT.u0 - fU.u0 >= 2 && fU.u1 - fT.u1 >= 2, 'the top floor stands back from the first floor at the front (' + (fT.v0 - fU.v0) + ') and the sides (' + (fT.u0 - fU.u0) + ', ' + (fU.u1 - fT.u1) + ')');
// the slab zones: rings of vx_nova_band, two rows, the outer ring past the walls below
const slabRect = (Rr, ov) => [Rr.u0 - ov[1], Rr.v0 - ov[0], Rr.u1 + ov[1], Rr.v1 + ov[2]];
const ring = (r) => { const out = []; for (let v = r[1]; v <= r[3]; v++) for (let u = r[0]; u <= r[2]; u++) if (u === r[0] || u === r[2] || v === r[1] || v === r[3]) out.push([u, v]); return out; };
let slabs = 0, edgeCells = 0, edgeLit = 0, under = 0;
for (const [Rr, ov] of [[G, OVER.G], [U, OVER.U], [Tt, OVER.T]]) {
  const r = slabRect(Rr, ov), cells = ring(r);
  const lower = cells.filter(([u, v]) => nm(u, Rr.slab, v) === 'vx_nova_band').length, upper = cells.filter(([u, v]) => nm(u, Rr.slab + 1, v) === 'vx_nova_band').length;
  if (lower === cells.length && upper === cells.length && r[1] < Rr.v0 && r[0] < Rr.u0) slabs++;
  for (const [u, v] of cells) { edgeCells++; const g = propOf(at(u, Rr.slab, v), 'glow'); if (g === 1 || g === 3) edgeLit++; if (g === 3 && !at(u, Rr.slab - 1, v)) under++; }
}
check(slabs === 3, 'three slab zones, each two blocks of slab edge all round and cantilevering past the walls below (' + slabs + ')');
check(edgeLit === edgeCells && edgeCells > 150, 'a cyan light line on every slab-edge cell (' + edgeLit + ' of ' + edgeCells + ')');
check(under >= edgeCells * 0.9, 'and the orange underglow under the edge where it hangs free (' + under + ' of ' + edgeCells + ')');
// balusters on every terrace edge (no railing on the ledge behind a flush back wall)
const terraceRing = (r, above) => ring(r).filter(([u, v]) => !(u >= above.u0 && u <= above.u1 && v >= above.v0 && v <= above.v1) && !(v > above.v1 && u >= above.u0 && u <= above.u1));
let railN = 0, railOk = 0;
for (const [Rr, ov, above] of [[G, OVER.G, U], [U, OVER.U, Tt]]) for (const [u, v] of terraceRing(slabRect(Rr, ov), above)) { railN++; if (nm(u, Rr.slab + 2, v) === 'vx_balustrade') railOk++; }
for (const [u, v] of ring(slabRect(Tt, OVER.T))) { railN++; if (nm(u, Tt.slab + 2, v) === 'vx_balustrade') railOk++; }
check(railOk === railN && railN > 100, 'white balusters on every terrace edge and round the roof (' + railOk + ' of ' + railN + ')');

// ---------------------------------------------------------------- 4 · the windows
console.log('4 · the windows');
const winCells = []; for (const [k, s] of A.rec) if (nameOf(s) === 'vx_nova_window') { const [x, y, z] = k.split(',').map(Number); winCells.push([x, y - F, z, propOf(s, 'facing')]); }
// group by wall plane (facing parity + the fixed coordinate), then 4-connected components in the plane
const planes = new Map();
for (const [u, y, v, f] of winCells) { const key = (f & 1) + ':' + ((f & 1) ? u : v); if (!planes.has(key)) planes.set(key, []); planes.get(key).push([(f & 1) ? v : u, y]); }
let comps = 0, rects = 0; const compList = [];
for (const [key, cells] of planes) {
  const set = new Set(cells.map(c => c[0] + ',' + c[1])), seen = new Set();
  for (const c of cells) {
    const k0 = c[0] + ',' + c[1]; if (seen.has(k0)) continue;
    const st = [c], comp = []; seen.add(k0);
    while (st.length) { const [a, y] = st.pop(); comp.push([a, y]); for (const [da, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = (a + da) + ',' + (y + dy); if (set.has(k) && !seen.has(k)) { seen.add(k); st.push([a + da, y + dy]); } } }
    comps++;
    const a0 = Math.min(...comp.map(q => q[0])), a1 = Math.max(...comp.map(q => q[0])), y0 = Math.min(...comp.map(q => q[1])), y1 = Math.max(...comp.map(q => q[1]));
    const area = (a1 - a0 + 1) * (y1 - y0 + 1);
    // a closed rectangle — or the entrance screen: side lights and a transom round the door (an inverted U whose gap is the door)
    let ok = area === comp.length;
    if (!ok) { let gap = 0, door = 0; const cs = new Set(comp.map(q => q[0] + ',' + q[1])); const [par, fixed] = key.split(':').map(Number); for (let a = a0; a <= a1; a++) for (let y = y0; y <= y1; y++) if (!cs.has(a + ',' + y)) { gap++; const n2 = par ? nm(fixed, y, a) : nm(a, y, fixed); if (n2 === 'door_glass_white') door++; } ok = gap === door && door > 0; }
    if (ok) rects++;
    compList.push({ key, a0, a1, y0, y1, n: comp.length });
  }
}
check(comps >= 20 && rects === comps, 'every window is one closed rectangle in one wall plane (or a glazed screen round a door): ' + rects + ' of ' + comps + ' windows, ' + winCells.length + ' cells');
const frontOf = (Rr, yy) => compList.filter(c => c.key === '0:' + Rr.v0 || c.key === '0:' + (Rr.v0 - 1)).filter(c => c.y0 >= yy && c.y1 <= yy + Rr.clear).length;
check(frontOf(G, 1) >= 4 && frontOf(U, U.y + 1) >= 3 && frontOf(Tt, Tt.y + 1) >= 2, 'every storey\'s front is glazed (ground ' + frontOf(G, 1) + ', first ' + frontOf(U, U.y + 1) + ', top ' + frontOf(Tt, Tt.y + 1) + ' windows)');
// the frame joins: a 2 × 3 cluster (VR.Nova.winCell with its neighbour bits) has frame cells only on its outer ring
const N = V.Nova; let inner = 0, outer = 0;
for (let bx = 0; bx < 2; bx++) for (let by = 0; by < 3; by++) {
  const m = (bx < 1 ? 1 : 0) | (bx > 0 ? 2 : 0) | (by < 2 ? 4 : 0) | (by > 0 ? 8 : 0);
  for (let v = 0; v < 16; v++) for (let u = 0; u < 16; u++) {
    const w = N.winCell(u, v, m), X = bx * 16 + u, Y = by * 16 + v, edge = Math.min(X, 31 - X, Y, 47 - Y);
    if (w.kind === 'frame') { if (edge >= N.FRAME) inner++; else outer++; }
    else if (edge < N.FRAME) inner++;
  }
}
check(inner === 0 && outer > 0, 'the frame joins: a 2 × 3 nova window has one frame on its outer ring and none inside (' + outer + ' frame voxels, ' + inner + ' misplaced)');
let lint = 0; for (const c of compList) { const [par, fixed] = c.key.split(':').map(Number); let any = false; for (let a = c.a0; a <= c.a1; a++) { const n2 = par ? nm(fixed, c.y1 + 1, a) : nm(a, c.y1 + 1, fixed); if (n2 === 'vx_nova_band' || n2 === 'vollton_white' || n2 === '') any = true; } if (any) lint++; }
check(lint >= comps * 0.8, 'lintels (a light band with an orange line) over the windows (' + lint + ' of ' + comps + ')');

// ---------------------------------------------------------------- 5 · the hall
console.log('5 · the hall');
let glass = 0; for (let u = G.u0 + 2; u <= G.u1 - 2; u++) for (let y = 1; y <= G.clear; y++) if (/^panorama_white$|^vx_beam_white$|^door_glass_white$/.test(nm(u, y, G.v1))) glass++;
check(glass === (G.u1 - G.u0 - 3) * G.clear, 'the glass wall to the garden fills the back of the hall floor to ceiling (' + glass + ' cells)');
const [pu, pv] = NOVA.PAD;
let pad = 0; for (let v = pv; v < pv + 3; v++) for (let u = pu; u < pu + 3; u++) if (nm(u, 1, v) === 'vm_nova_pad') pad++;
let ringN = 0; for (const [u, v] of ring([pu - 1, pv - 1, pu + 3, pv + 3])) if (nm(u, 0, v) === 'vx_floor_plaza_line') ringN++;
check(pad === 9 && ringN === 16, 'the light pad (3 × 3, ' + pad + ' cells) on the hall floor and the cyan ring round it in the floor (' + ringN + ' of 16)');
let stairsOk = 0;
for (const st of NOVA.STAIRS) {
  let ok = true;
  for (let k = 1; k <= 7; k++) {
    const v = G.v1 - k;
    for (let du = 0; du <= 1; du++) {
      if (nm(st.u + du, k, v) !== 'vm_nova_tread') ok = false;
      for (let h = 1; h <= 2; h++) { const n2 = nm(st.u + du, k + h, v); if (n2 && n2 !== 'vx_spot') ok = false; }
    }
  }
  // the top tread lands on the first floor: its floor at the arrival, air above it
  if (!at(st.u, U.y, G.v1 - 8) || at(st.u, U.y + 1, G.v1 - 8)) ok = false;
  if (ok) stairsOk++;
}
check(stairsOk === 2, 'two floating stairs: seven tread cells each, one up and one forward, two cells of head room over every tread, the first floor open over them and its floor at the top (' + stairsOk + ' of 2)');
let cove = 0; for (let v = 13; v <= 18; v++) for (let u = 8; u <= 16; u++) { const s = at(u, G.slab, v); if (nameOf(s) === 'vx_nova_band' && propOf(s, 'glow') === 1) cove++; }
check(cove >= 20 && !at(12, G.slab, 15), 'the cove in the hall ceiling: a recess ringed by a cyan light line (' + cove + ' ring cells)');

// ---------------------------------------------------------------- 6 · the garden
console.log('6 · the garden');
let lawn = 0, hedge = 0; for (let v = 0; v < D; v++) for (let u = 0; u < W; u++) { if (nm(u, -1, v) === 'grass_block') lawn++; if (nm(u, 0, v) === 'vx_hedge') hedge++; }
const parts0 = (name) => { let n = 0; for (const s of A.rec.values()) if (nameOf(s) === name && propOf(s, 'part') === 0) n++; return n; };
check(lawn >= 120 && hedge >= 50, 'lawn (' + lawn + ' cells) and hedges (' + hedge + ' cells)');
check(parts0('vm_bush_blossom') >= 2 && parts0('vm_tree_round_s') >= 1, 'round bushes (' + parts0('vm_bush_blossom') + ') and round trees (' + parts0('vm_tree_round_s') + ')');
let palms = 0; for (const [k, s] of A.rec) if (nameOf(s) === 'vm_palm_crown' && propOf(s, 'part') === 0) { const [x, y, z] = k.split(',').map(Number); if (nameOf(A.rec.get((x + 3) + ',' + (y - 1) + ',' + (z + 3))) === 'vx_palm_trunk') palms++; }
check(palms >= 4, 'palms: the shared crown (vm_palm_crown) on a ringed trunk (' + palms + ')');
let planters = 0; for (const s of A.rec.values()) if (nameOf(s) === 'vx_tech_planter') planters++;
check(planters >= 6, 'planters (' + planters + ')');
// the path: the paved cells at the yard level joined from the street (v 0) to the step in front of the door
const pathAt = (u, v) => /^vx_floor_plaza(_line)?$/.test(nm(u, -1, v));
const seen = new Set(), stack = []; for (let u = 0; u < W; u++) if (pathAt(u, 0)) { stack.push([u, 0]); seen.add(u + ',0'); }
while (stack.length) { const [u, v] = stack.pop(); for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = u + du, b = v + dv, k = a + ',' + b; if (a >= 0 && a < W && b >= 0 && b < D && !seen.has(k) && pathAt(a, b) && b < G.v0) { seen.add(k); stack.push([a, b]); } } }
const door = info.door, reach = seen.has(door[0] + ',' + (door[2] - 1));
let lines = 0, lineEdge = 0; for (const k of seen) { const [u, v] = k.split(',').map(Number); const isLine = nm(u, -1, v) === 'vx_floor_plaza_line'; if (isLine) lines++; const lawnNb = [[1, 0], [-1, 0], [0, 1]].some(([du, dv]) => nm(u + du, -1, v + dv) === 'grass_block'); if (lawnNb) { lineEdge++; if (!isLine) lineEdge -= 1000; } }
check(reach && seen.size >= 30, 'the curved path runs from the street to the step in front of the door (' + seen.size + ' paved cells)');
check(lines >= 16 && lineEdge > 0, 'a cyan light line along both of its edges: every paved cell beside the lawn is a line block (' + lines + ' line cells)');

// ---------------------------------------------------------------- 7 · the new pieces
console.log('7 · the new pieces');
const snap = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'id_snapshot.json'), 'utf8'));
const shippedEnd = Math.max(...snap.map(r => r[1] + r[2])), NEW = ['vx_nova_window', 'vx_nova_band', 'vm_nova_tread', 'vm_nova_pad'];
check(NEW.every(n => R.byName[n] && R.byName[n].base >= shippedEnd), 'the new pieces come after every shipped state id (' + NEW.map(n => n + ' ' + (R.byName[n] ? R.byName[n].base : '?')).join(', ') + ')');
for (const n of ['vm_nova_tread', 'vm_nova_pad']) { const m = VM.MODELS[n]; VM.materialize(m); const scan = VM.scanParts(m).map(p => p.px + ',' + p.py + ',' + p.pz).join(' '), decl = m.parts.map(p => p.px + ',' + p.py + ',' + p.pz).join(' '); check(scan === decl, n + ' builds to its declared cells (' + m.parts.length + ' parts)'); }
// every state of the new pieces paints and meshes (a one-block section around it) under 1000 quads
let maxQ = 0, worst = '', meshed = 0;
const PAD = V.MESH_PAD || 2, PS = V.MESH_PS || 20, PSS = PS * PS;
for (const n of NEW) { const t = R.byName[n]; for (let s = t.base; s < t.base + t.nstates; s++) {
  const blocks = new Uint16Array(PSS * PS), light = new Uint16Array(PSS * PS).fill(0xf000);
  blocks[(8 + PAD) * PSS + (8 + PAD) * PS + (8 + PAD)] = s;
  const r = V.meshSection({ blocks, light, grass: new Uint16Array(PSS), foliage: new Uint16Array(PSS), water: new Uint16Array(PSS), sy: 0, ox: 0, oz: 0, smooth: true, fancyLeaves: true, vxLod: true });
  const q = ((r.vx ? r.vx.length : 0) + r.opaque.length + r.cutout.length + r.trans.length) / 32; meshed++;
  if (q > maxQ) { maxQ = q; worst = n + ' #' + (s - t.base); }
} }
check(meshed > 40 && maxQ > 0 && maxQ < 1000, 'every state of the new pieces meshes, at most ' + maxQ + ' quads (' + worst + ')');

if (process.env.SLICES) {
  const CH = { vollton_stone_grey: '=', vollton_light_grey: '#', vollton_mid_grey: '_', vx_nova_band: 'F', vollton_white: 'w', vollton_white_gloss: '.', vx_floor_plaza: ':', vx_floor_plaza_line: '~', vx_balustrade: 'b', vx_nova_window: 'W', panorama_white: 'G', vx_beam_white: '|', vx_led_strip: 'o', door_glass_white: 'D', vx_hedge: 'h', grass_block: ',', vx_glass_wall: 'g', vx_spot: '*', vx_tech_railing: 'r', vm_nova_tread: 'T', vm_nova_pad: 'P', vx_palm_trunk: 'I', vm_palm_crown: '%', vx_tech_planter: 'p', vm_bush_blossom: 'B', vm_tree_round_s: 'Y' };
  for (const y of [-1, 0, 1, 3, 5, 6, 7, 8, 10, 12, 14, 16, 18, 20]) { console.log('y = F' + (y < 0 ? '' : '+') + y); for (let v = -1; v <= D; v++) { let row = String(v).padStart(3) + ' '; for (let u = -1; u <= W; u++) { const n = nm(u, y, v); row += n ? (CH[n] || '?') : ' '; } console.log(row); } }
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

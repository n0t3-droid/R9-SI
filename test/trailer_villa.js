// Villa Nova (gen_nova.js, voxnova.js, the catalogue entry in gen_plan.js) — the trailer's house as blocks:
//   1. the catalogue: Villa Nova is appended (index 11, lot 25 × 31), the town lots (PLAN.DIMS) and PLAN.pick are as before
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
check(T === 11 && cat && cat.name === 'Villa Nova' && cat.special && cat.lot.join() === '25,31', 'Villa Nova is the catalogue\'s 12th house (index ' + T + ', lot ' + (cat && cat.lot.join(' × ')) + ': the street on the v = 0 side, ten rows of garden behind the house)');
check(JSON.stringify(PLAN.DIMS) === JSON.stringify(BASE_DIMS) && JSON.stringify(VG.modern.DIMS.home) === JSON.stringify(BASE_DIMS), 'the town lots are the eleven of before (the towns draw the same houses)');
check(BASE_DIMS.every(([w, d]) => !PLAN.pick(w, d).special) && !PLAN.pick(60, 60).special && PLAN.pick(25, 31) === cat, 'PLAN.pick never hands it to a town lot, only to a lot of exactly 25 × 31');
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
// (the storey's own walls: grey stone, its windows and doors — the light-grey box bays standing out of it are counted apart)
const STOREY = new Set(['vollton_stone_grey', 'vollton_mid_grey']);
const footprint = (y) => { let u0 = 99, v0 = 99, u1 = -99, v1 = -99; for (let v = -4; v < D + 4; v++) for (let u = -4; u < W + 4; u++) if (STOREY.has(nm(u, y, v))) { u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); } return { u0, v0, u1, v1 }; };
const fG = footprint(3), fU = footprint(U.y + 3), fT = footprint(Tt.y + 3);
console.log('    footprints  G ' + JSON.stringify(fG) + '  U ' + JSON.stringify(fU) + '  T ' + JSON.stringify(fT));
check(fU.v0 - fG.v0 >= 2 && fU.u0 - fG.u0 >= 2 && fG.u1 - fU.u1 >= 2, 'the first floor stands back from the ground floor at the front (' + (fU.v0 - fG.v0) + ') and the sides (' + (fU.u0 - fG.u0) + ', ' + (fG.u1 - fU.u1) + ')');
// t1_24 / t2_23: the top is a box at one side and the roof garden with a big round tree beside it, not a centred tier
check(fT.v0 - fU.v0 >= 3 && fT.u0 - fU.u0 >= 1 && fT.u0 - fU.u0 <= 2 && fU.u1 - fT.u1 >= 6, 'the top storey is a box at the left, set back at the front (' + (fT.v0 - fU.v0) + ') and on the left (' + (fT.u0 - fU.u0) + '), the right of the first floor\'s roof left to the roof garden (' + (fU.u1 - fT.u1) + ')');
{ let tree = 0, grass = 0; for (const [k, s] of A.rec) { const [x, y, z] = k.split(',').map(Number); if (y - F === U.slab + 2 && nameOf(s) === 'vm_tree_round_l' && propOf(s, 'part') === 0 && x > fT.u1) tree++; if (y - F === U.slab + 1 && nameOf(s) === 'grass_block' && x > fT.u1 && x <= fU.u1) grass++; }
  check(tree === 1 && grass >= 30, 'the roof garden beside the top box: lawn (' + grass + ' cells) and the big round tree (' + tree + ') rising to the top box\'s roof'); }
// the first floor's boxes stand two blocks out over the terrace below and hang free of it (the orange glow under them)
{ let boxes = 0; for (const [a0, a1] of [[5, 9], [15, 19]]) { let ok = true; for (let a = a0; a <= a1; a++) for (const v of [U.v0 - 1, U.v0 - 2]) { if (nm(a, U.y + 3, v) !== 'vollton_light_grey' && nm(a, U.y + 3, v) !== 'vx_nova_window' && nm(a, U.y + 3, v) !== '') ok = false; const lo = at(a, U.y + 2, v); if (nameOf(lo) !== 'vx_nova_band' || propOf(lo, 'glow') !== 2 || at(a, U.y + 1, v)) ok = false; } if (ok) boxes++; }
  let side = 0; for (let v = 13; v <= 17; v++) for (const u of [U.u1 + 1, U.u1 + 2]) { const lo = at(u, U.y + 2, v); if (nameOf(lo) === 'vx_nova_band' && propOf(lo, 'glow') === 2 && !at(u, U.y + 1, v)) side++; }
  check(boxes === 2 && side === 10, 'the first floor\'s front boxes stand two blocks out over the terrace and hang free with the orange glow under them (' + boxes + ' of 2), and the box on its right side (' + side + ' of 10 cells)'); }
// the slab zones: rings of vx_nova_band, two rows, the outer ring past the walls below
const slabRect = (Rr, ov) => [Rr.u0 - ov[1], Rr.v0 - ov[0], Rr.u1 + ov[1], Rr.v1 + ov[2]];
const ring = (r) => { const out = []; for (let v = r[1]; v <= r[3]; v++) for (let u = r[0]; u <= r[2]; u++) if (u === r[0] || u === r[2] || v === r[1] || v === r[3]) out.push([u, v]); return out; };
let slabs = 0, edgeCells = 0, edgeLit = 0, under = 0, free = 0;
for (const [Rr, ov] of [[G, OVER.G], [U, OVER.U], [Tt, OVER.T]]) {
  const r = slabRect(Rr, ov), cells = ring(r);
  const lower = cells.filter(([u, v]) => nm(u, Rr.slab, v) === 'vx_nova_band').length, upper = cells.filter(([u, v]) => nm(u, Rr.slab + 1, v) === 'vx_nova_band').length;
  if (lower === cells.length && upper === cells.length && r[1] < Rr.v0 && r[0] < Rr.u0) slabs++;
  for (const [u, v] of cells) { edgeCells++; const g = propOf(at(u, Rr.slab, v), 'glow'); if (g === 1 || g === 3) edgeLit++; if (!at(u, Rr.slab - 1, v)) { free++; if (g === 3) under++; } }
}
check(slabs === 3, 'three slab zones, each two blocks of slab edge all round and cantilevering past the walls below (' + slabs + ')');
check(edgeLit === edgeCells && edgeCells > 150, 'a cyan light line on every slab-edge cell (' + edgeLit + ' of ' + edgeCells + ')');
check(under === free && free >= edgeCells * 0.8, 'and the orange underglow under the edge wherever it hangs free (' + under + ' of ' + free + ' free edge cells; ' + edgeCells + ' in all)');
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
// (in the wall or in the face of a box standing one or two blocks out of it)
const frontWins = (Rr, yy) => compList.filter(c => [0, 1, 2].some(k => c.key === '0:' + (Rr.v0 - k))).filter(c => c.y0 >= yy && c.y1 <= yy + Rr.clear);
const frontOf = (Rr, yy) => frontWins(Rr, yy).length, topGlass = frontWins(Tt, Tt.y + 1).reduce((n, c) => n + c.n, 0);
check(frontOf(G, 1) >= 4 && frontOf(U, U.y + 1) >= 3 && frontOf(Tt, Tt.y + 1) >= 1 && topGlass >= 15, 'every storey\'s front is glazed (ground ' + frontOf(G, 1) + ', first ' + frontOf(U, U.y + 1) + ' windows; the top box one glazed front of ' + topGlass + ' cells)');
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
let glass = 0, posts = 0; for (let u = G.u0 + 2; u <= G.u1 - 2; u++) for (let y = 1; y <= G.clear; y++) { const n2 = nm(u, y, G.v1); if (/^vx_nova_glass$|^door_glass_white$/.test(n2)) glass++; if (n2 === 'vx_nova_glass' && propOf(at(u, y, G.v1), 'post') === 1) posts++; }
check(glass === (G.u1 - G.u0 - 3) * G.clear && posts >= 2 * G.clear, 'the glass wall to the garden: one clear sheet (vx_nova_glass) floor to ceiling with slim mullions (' + glass + ' cells, ' + posts + ' mullion cells) and the garden door');
// the partition between the foyer and the hall: clear glass, the middle open
let part = 0, partOpen = 0; for (let u = G.u0 + 2; u <= G.u1 - 2; u++) for (let y = 1; y <= G.clear; y++) { const n2 = nm(u, y, NOVA.PARTITION); if (n2 === 'vx_nova_glass') part++; else if (!n2) partOpen++; }
check(part >= 10 * G.clear && partOpen === 3 * G.clear, 'the glass partition between the foyer and the hall: clear sheets (' + part + ' cells) with the open middle (' + partOpen + ')');
const [pu, pv] = NOVA.PAD;
let pad = 0; for (let v = pv; v < pv + 3; v++) for (let u = pu; u < pu + 3; u++) if (nm(u, 1, v) === 'vm_nova_pad') pad++;
let ringN = 0; for (const [u, v] of ring([pu - 1, pv - 1, pu + 3, pv + 3])) if (nm(u, 0, v) === 'vx_floor_plaza_line') ringN++;
check(pad === 9 && ringN === 16, 'the light pad (3 × 3, ' + pad + ' cells) on the hall floor and the cyan ring round it in the floor (' + ringN + ' of 16)');
// the stairs: two blocks deep in front of the glass wall, from the side walls up toward the middle (the V of t1_29 / t1_30)
let stairsOk = 0; const SV0 = NOVA.STAIR_V, EU0 = NOVA.ENTRY;
for (const st of NOVA.STAIRS) {
  let ok = true; const uk = (k) => st.u + st.du * (k - 1);
  for (let k = 1; k <= U.y; k++) for (let dv = 0; dv <= 1; dv++) {
    // the tread row of the piece (parts 0, 1) one block up and one along per piece; over it only its own glass cheeks
    const s = at(uk(k), k, SV0 + dv); if (nameOf(s) !== 'vm_nova_tread' || propOf(s, 'part') > 1) ok = false;
    for (let h = 1; h <= 2; h++) { const s2 = at(uk(k), k + h, SV0 + dv), n2 = nameOf(s2); if (n2 && !(n2 === 'vm_nova_tread' && propOf(s2, 'part') > 1) && n2 !== 'vx_spot') ok = false; }
  }
  // it runs toward the middle in front of the glass wall, and the top tread lands on the first floor: its floor next to the
  // top tread, air over that
  if (Math.abs(uk(U.y) - EU0) >= Math.abs(st.u - EU0) || SV0 + 2 !== G.v1) ok = false;
  if (!at(uk(U.y) + st.du, U.y, SV0) || at(uk(U.y) + st.du, U.y + 1, SV0)) ok = false;
  if (ok) stairsOk++;
}
check(stairsOk === 2, 'two floating glass stairs in front of the glass wall, from the side walls up toward the middle: seven tread pieces each, one up and one along, nothing but their glass cheeks in the two cells over every tread, the first floor\'s floor at the top (' + stairsOk + ' of 2)');
// the cheeks: the glass stringer on both sides of the piece climbs one block over its depth (in steps), from half a block
// under the nosing line to a block over it, so the cheeks of the pieces join from one to the next
{ const m = VM.MODELS.vm_nova_tread; VM.materialize(m); const Rs = m.res / 16, st = V.Nova.CHEEK.step; let joins = 0;
  for (const x of [0.5, 31.5]) { const X = Math.floor(x * Rs); const top = (z) => { let y = -1; for (let yy = 0; yy < m.VH; yy++) if (m.get(X, yy, Math.floor(z * Rs))) y = yy; return (y + 1) / Rs; };
    const bot = (z) => { for (let yy = 0; yy < m.VH; yy++) if (m.get(X, yy, Math.floor(z * Rs))) return yy / Rs; return -1; };
    if (Math.abs(top(16 - st) - top(0) - (16 - st)) <= 1 && Math.abs(top(0) - 24) <= 1 && Math.abs(bot(0)) <= 1 && Math.abs(bot(16 - st) - (16 - st)) <= 1) joins++; }
  check(joins === 2, 'the glass cheeks on both sides of the tread piece climb one block over its depth, from half a block under the nosing line to a block over it (' + joins + ' of 2)'); }
let cove = 0; for (let v = 12; v <= 17; v++) for (let u = 8; u <= 16; u++) { const s = at(u, G.slab, v); if (nameOf(s) === 'vx_nova_band' && propOf(s, 'glow') === 1) cove++; }
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
// (lawn: grass at the yard level with nothing built on it — the box bays stand on grass too)
const lawnCell = (u, v) => nm(u, -1, v) === 'grass_block' && !WALLS.has(nm(u, 0, v));
let lines = 0, lineEdge = 0; for (const k of seen) { const [u, v] = k.split(',').map(Number); const isLine = nm(u, -1, v) === 'vx_floor_plaza_line'; if (isLine) lines++; const lawnNb = [[1, 0], [-1, 0], [0, 1]].some(([du, dv]) => lawnCell(u + du, v + dv)); if (lawnNb) { lineEdge++; if (!isLine) lineEdge -= 1000; } }
check(reach && seen.size >= 30, 'the curved path runs from the street to the step in front of the door (' + seen.size + ' paved cells)');
check(lines >= 16 && lineEdge > 0, 'a cyan light line along both of its edges: every paved cell beside the lawn is a line block (' + lines + ' line cells)');
// the lines are unbroken (run 1: dashes and dots — line cells that met only at a corner): the line piece joins its
// neighbours across sides only, so every line cell has one or two line neighbours across a side, every paved cell that
// touches the lawn across a side or a corner joins a chain, and each path has its two chains (front and back garden)
const lineAt = (u, v) => nm(u, -1, v) === 'vx_floor_plaza_line';
const chainCheck = (v0, v1) => {
  let cells = 0, bad = 0, comps = 0; const seen2 = new Set();
  for (let v = v0; v <= v1; v++) for (let u = 0; u < W; u++) {
    if (!lineAt(u, v)) continue; cells++;
    const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([du, dv]) => lineAt(u + du, v + dv) && v + dv >= v0 && v + dv <= v1).length;
    if (n < 1 || n > 2) bad++;
    const k = u + ',' + v; if (seen2.has(k)) continue; comps++; const st = [[u, v]]; seen2.add(k);
    while (st.length) { const [a, b] = st.pop(); for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k2 = (a + du) + ',' + (b + dv); if (b + dv >= v0 && b + dv <= v1 && lineAt(a + du, b + dv) && !seen2.has(k2)) { seen2.add(k2); st.push([a + du, b + dv]); } } }
  }
  return { cells, bad, comps };
};
const cF = chainCheck(0, G.v0 - 1), cB = chainCheck(G.v1 + 1, D - 1);
check(cF.cells >= 20 && cF.bad === 0 && cF.comps === 2, 'the front path\'s light lines are two unbroken chains (' + cF.cells + ' line cells, ' + cF.comps + ' chains, ' + cF.bad + ' cells with no or three line neighbours)');
check(cB.cells >= 20 && cB.bad === 0 && cB.comps <= 2, 'the back garden\'s path and terrace: the light lines unbroken too (' + cB.cells + ' line cells, ' + cB.comps + ' chains, ' + cB.bad + ' odd cells)');
// the back garden (t1_29 / t1_30 through the glass: lawn, palms, round trees, green mounds, a curved path)
const backRows = D - 1 - G.v1;
let mound = 0, moundTop = 0; for (let v = G.v1 + 1; v < D; v++) for (let u = 0; u < W; u++) for (let y = 0; y <= 4; y++) if (nm(u, y, v) === 'grass_block') { mound++; moundTop = Math.max(moundTop, y + 1); }
let backPalms = 0; for (const [k, s] of A.rec) if (nameOf(s) === 'vm_palm_crown' && propOf(s, 'part') === 0) { const [x, y, z] = k.split(',').map(Number); if (z + 3 > G.v1 + 1 && nameOf(A.rec.get((x + 3) + ',' + (y - 1) + ',' + (z + 3))) === 'vx_palm_trunk') backPalms++; }
const backPath = (() => { const door = [NOVA.ENTRY, G.v1 + 1]; const sn = new Set([door.join()]), st = [door]; let far = 0; while (st.length) { const [u, v] = st.pop(); far = Math.max(far, v - G.v1); for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = u + du, b = v + dv, k = a + ',' + b; if (b > G.v1 && b < D && a >= 0 && a < W && !sn.has(k) && pathAt(a, b)) { sn.add(k); st.push([a, b]); } } } return far; })();
check(backRows >= 10 && mound >= 30 && moundTop >= 2 && backPalms >= 3 && backPath >= 6, 'the back garden: ' + backRows + ' rows behind the glass wall, green mounds (' + mound + ' cells, ' + moundTop + ' high), ' + backPalms + ' palms, the path from the garden door ' + backPath + ' rows back');

// ---------------------------------------------------------------- 7 · the new pieces
console.log('7 · the new pieces');
// (from the checkout's test folder: test/wt_run.sh runs a copy of this file from .tmp_tests)
const snap = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'test', 'id_snapshot.json'), 'utf8'));
const shippedEnd = Math.max(...snap.map(r => r[1] + r[2])), NEW = ['vx_nova_window', 'vx_nova_band', 'vm_nova_tread', 'vm_nova_pad', 'vx_nova_glass'];
check(NEW.every(n => R.byName[n] && R.byName[n].base >= shippedEnd), 'the new pieces come after every shipped state id (' + NEW.map(n => n + ' ' + (R.byName[n] ? R.byName[n].base : '?')).join(', ') + ')');
// the glass sheet (t1_29, t3_10: clear floor-to-ceiling glass) joins its neighbours in BOTH looks: a 3 × 2 sheet is clear
// glass everywhere but a slim frame on its outer ring; the post state stands a slim mullion in the middle of its cell
{ const gt = R.byName.vx_nova_glass; let inner = 0, frame = 0, glassN = 0, post = 0;
  for (let bx = 0; bx < 3; bx++) for (let by = 0; by < 2; by++) {
    const m = (bx < 2 ? 1 : 0) | (bx > 0 ? 2 : 0) | (by < 1 ? 4 : 0) | (by > 0 ? 8 : 0) | (bx === 1 ? 16 : 0);
    for (let v = 0; v < 16; v++) for (let u = 0; u < 16; u++) {
      const w = N && N.glassCell ? N.glassCell(u, v, m) : { kind: '?' }, X = bx * 16 + u, Y = by * 16 + v, edge = Math.min(X, 47 - X, Y, 31 - Y);
      if (w.kind === 'frame') { if (edge >= 1) inner++; else frame++; }
      else if (w.kind === 'post') { if (bx === 1 && Math.abs(u - 7.5) <= 1) post++; else inner++; }
      else if (w.kind === 'glass') { if (edge < 1) inner++; else glassN++; }
      else inner++;
    }
  }
  // (the mullion: two voxels wide over the sheet's height but the frame rows at its top and bottom: 2 × 30)
  check(gt && gt.base >= shippedEnd && inner === 0 && frame > 0 && glassN > 1000 && post === 60,'the glass sheet joins in both looks: a 3 × 2 sheet is clear glass (' + glassN + ' cells) in one slim frame (' + frame + ') with a slim mullion in its post cell (' + post + '), ' + inner + ' misplaced'); }
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

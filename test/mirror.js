// 🪞 Spiegel-Bauen (wave 2, W-C) — the pure mirror module VR.Mirror (src/shared/mirror.js), without a browser:
//  (a) the modes cycle X → Z → 4-fach → 8-fach → aus; 4-fach is three copies, 8-fach seven (the symmetries of a square)
//  (b) positions for a centre ON a block (odd doubled coordinate) and BETWEEN two blocks (even); 8-fach turns a quarter
//      around the centre; the 8-fold set of a block has no duplicates, on the axes and the diagonals too; 8-fach snaps a
//      mixed centre (on in x, between in z) onto a block
//  (c) the state table for every directional kind and every transform: stairs (facing, half), doors (facing, hinge, both
//      halves), trapdoors, gates, logs / pillars (axis), beds (two cells), buttons and levers, wall torches, ladders,
//      rails (straights, slopes, curves), vines / lichen faces, stems, VX roofs and low hip roofs (_l/_r corners),
//      6-way facings, the hopper, signs (rotation 16, generic), VM models (facing + parts)
//  (d) for EVERY state of EVERY block type: a mirrored state is a state of the same type, the identity keeps it, a
//      reflection twice gives it back, four quarter turns give it back, and the group laws hold (fd = fx∘r90,
//      fa = fz∘r90, r180 = r90∘r90 = fx∘fz) — so every prop map is consistent, not only the ones listed in (c)
//  (e) pieces: a door and a bed copy whole and stay consistent (head = foot + facing); a VM model under a reflection is
//      re-anchored as a valid placement of the same model on the mirrored cells; copies() drops copies that land on the
//      original or on each other; points() for breaking
//  (f) the axis guide geometry: one strip and one plane per mirror line, finite, around the centre
// usage: node test/mirror.js
const ROOT = require('path').join(__dirname, '..');
const VR = require(ROOT + '/test/load_shared.js');
const R = VR.R, M = VR.Mirror;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
if (!M) { console.log('  ✗ VR.Mirror exists (src/shared/mirror.js in the SHARED list and test/load_shared.js)'); console.log('FAILED 1'); process.exit(1); }

const S = (name, props) => { const t = R.byName[name]; if (!t) throw new Error('no block ' + name); let s = t.defaultState; for (const k in props || {}) s = t.with(s, k, props[k]); return s; };
const P = (s) => { const t = R.types[R.T.type[s]], o = { name: t.name }; for (const p of t.props) o[p.name] = t.getV(s, p.name); return o; };
const pv = (s, k) => P(s)[k];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const ALL = ['fx', 'fz', 'r90', 'r180', 'r270', 'fd', 'fa'];

console.log('a · modes');
check(M.next(null) === 'x' && M.next('x') === 'z' && M.next('z') === 'xz' && M.next('xz') === 'r8' && M.next('r8') === null, 'the cycle: aus → X → Z → 4-fach → 8-fach → aus');
check(same(M.transforms('x'), ['fx']) && same(M.transforms('z'), ['fz']), 'X mirrors x, Z mirrors z (one copy each)');
check(M.transforms('xz').length === 3 && ['fx', 'fz', 'r180'].every(t => M.transforms('xz').includes(t)), '4-fach: X, Z and the half turn (three copies)');
check(M.transforms('r8').length === 7 && ALL.every(t => M.transforms('r8').includes(t)), '8-fach: three turns and four reflections (seven copies)');
check(same(M.transforms(null), []) && same(M.transforms('nope'), []), 'off or unknown: no copies');

console.log('b · positions');
// centre ON block 10 (doubled 21) and BETWEEN blocks 9 and 10 (doubled 20)
const pos = (t, c2x, c2z, x, z) => M.pos(t, c2x, c2z, x, z);
check(same(pos('fx', 21, 21, 12, 5), [8, 5]) && same(pos('fx', 21, 21, 10, 5), [10, 5]) && same(pos('fx', 21, 21, 7, 3), [13, 3]), 'X on a block: 12 → 8, the axis block stays, 7 → 13');
check(same(pos('fx', 20, 21, 10, 5), [9, 5]) && same(pos('fx', 20, 21, 12, 5), [7, 5]) && same(pos('fx', 20, 21, 9, 5), [10, 5]), 'X between 9 and 10: 10 ↔ 9, 12 → 7');
check(same(pos('fz', 21, 21, 4, 12), [4, 8]) && same(pos('fz', 21, 20, 4, 10), [4, 9]), 'Z on a block and between');
check(same(pos('r180', 21, 21, 12, 13), [8, 7]) && same(pos('r180', 20, 20, 10, 10), [9, 9]), 'the half turn (on a block, between)');
check(same(pos('r90', 21, 21, 12, 10), [10, 12]) && same(pos('r90', 21, 21, 10, 8), [12, 10]), 'a quarter turn is clockwise seen from above (north → east, east → south)');
check(same(pos('r90', 20, 20, 10, 10), [9, 10]) && same(pos('r90', 20, 20, 9, 10), [9, 9]) && same(pos('r90', 20, 20, 9, 9), [10, 9]), 'a quarter turn around a corner between four blocks walks them round');
check(same(pos('fd', 21, 21, 12, 11), [11, 12]) && same(pos('fa', 21, 21, 12, 11), [9, 8]), 'the two diagonal mirrors');
let lawPos = true;
for (const c of [[21, 21], [20, 20], [21, 20], [-7, 33]]) for (let x = -3; x < 4; x++) for (let z = -2; z < 3; z++) {
  for (const t of ['fx', 'fz', 'r180']) { const a = pos(t, c[0], c[1], x, z), b = pos(t, c[0], c[1], a[0], a[1]); if (!same(b, [x, z])) lawPos = false; }
  if (c[0] % 2 === c[1] % 2 || c[0] % 2 === -(c[1] % 2)) { let a = [x, z]; for (let k = 0; k < 4; k++) a = pos('r90', c[0], c[1], a[0], a[1]); if (!same(a, [x, z])) lawPos = false; }
}
check(lawPos, 'reflections twice and four quarter turns come back, for centres on, between and far from the origin');
check(same(M.center('r8', 20, 21), [21, 21]) && same(M.center('r8', 21, 20), [21, 21]) && same(M.center('r8', 20, 20), [20, 20]) && same(M.center('xz', 20, 21), [20, 21]), '8-fach snaps a mixed centre onto the block; the other modes keep it');
const orbit = (mode, c2x, c2z, x, z) => M.points(mode, c2x, c2z, x, z);
const uniq = (list) => new Set(list.map(p => p.join(','))).size === list.length;
const o1 = orbit('r8', 21, 21, 12, 13), o2 = orbit('r8', 21, 21, 10, 13), o3 = orbit('r8', 21, 21, 13, 13), o4 = orbit('r8', 21, 21, 10, 10), o5 = orbit('r8', 20, 20, 10, 12), o6 = orbit('r8', 20, 20, 11, 11);
check(o1.length === 7 && uniq(o1) && !o1.some(p => p[0] === 12 && p[1] === 13), '8-fach: a block off the axes has seven distinct copies (' + o1.length + ')');
check(o2.length === 3 && uniq(o2), '8-fach: a block on an axis has three (' + o2.length + ')');
check(o3.length === 3 && uniq(o3), '8-fach: a block on a diagonal has three (' + o3.length + ')');
check(o4.length === 0, '8-fach: the centre block has none');
check(o5.length === 7 && uniq(o5) && o6.length === 3 && uniq(o6), '8-fach between blocks: seven off the diagonals, three on one (' + o5.length + ', ' + o6.length + ')');
const q1 = orbit('xz', 21, 21, 12, 13), q2 = orbit('xz', 21, 21, 10, 13), q3 = orbit('x', 20, 21, 10, 13);
check(q1.length === 3 && uniq(q1) && q2.length === 1 && q3.length === 1 && same(q3[0], [9, 13]), '4-fach: three copies, one on an axis; X between blocks: one');

console.log('c · the state table');
const F = ['north', 'east', 'south', 'west'];
const mf = (t, name, props) => P(M.state(t, S(name, props)));
// stairs: facing flipped on the mirrored axis only, half kept
{
  const ok = [['fx', 'north', 'north'], ['fx', 'east', 'west'], ['fz', 'north', 'south'], ['fz', 'east', 'east'], ['r90', 'north', 'east'], ['r180', 'east', 'west'], ['r270', 'north', 'west'], ['fd', 'north', 'west'], ['fd', 'east', 'south'], ['fa', 'north', 'east'], ['fa', 'east', 'north']]
    .every(([t, a, b]) => { const r = mf(t, 'oak_stairs', { facing: a, half: 'top' }); return r.facing === b && r.half === 'top'; });
  check(ok, 'stairs: facing per transform (X: east ↔ west, Z: north ↔ south, turns, diagonals), half kept');
}
// doors: facing like stairs, hinge swaps on reflections only, open and half kept
{
  const d = (t, f, h, half) => mf(t, 'oak_door', { facing: f, hinge: h, half, open: 1 });
  const a = d('fx', 'east', 'left', 'bottom'), b = d('fz', 'east', 'left', 'top'), c = d('r90', 'east', 'left', 'bottom'), e = d('r180', 'north', 'right', 'top'), g = d('fd', 'north', 'left', 'bottom');
  check(a.facing === 'west' && a.hinge === 'right' && a.half === 'bottom' && a.open === 1, 'door X: east/left → west/right (' + a.facing + '/' + a.hinge + ')');
  check(b.facing === 'east' && b.hinge === 'right' && b.half === 'top', 'door Z: east/left → east/right, upper half stays upper');
  check(c.facing === 'south' && c.hinge === 'left' && e.facing === 'south' && e.hinge === 'right', 'door turned: the hinge stays (' + c.facing + '/' + c.hinge + ', ' + e.facing + '/' + e.hinge + ')');
  check(g.facing === 'west' && g.hinge === 'right', 'door on a diagonal mirror: north/left → west/right');
  const cu = mf('fx', 'copper_door', { facing: 'south', hinge: 'right', stage: 2, waxed: 1 });
  check(cu.hinge === 'left' && cu.stage === 2 && cu.waxed === 1 && cu.facing === 'south', 'copper door: hinge swapped, its stage and wax kept');
}
// trapdoors, gates, ladders, wall mounts, VX roofs, glazed terracotta, chests: plain facing
check(mf('fz', 'oak_trapdoor', { facing: 'north', half: 'top', open: 1 }).facing === 'south' && mf('fz', 'oak_trapdoor', { facing: 'north', half: 'top', open: 1 }).half === 'top', 'trapdoor: facing mirrored, half and open kept');
check(mf('fx', 'oak_fence_gate', { facing: 'east', open: 1 }).facing === 'west' && mf('r90', 'oak_fence_gate', { facing: 'east' }).facing === 'south', 'fence gate');
check(mf('fz', 'ladder', { facing: 'south' }).facing === 'north' && mf('fx', 'ladder', { facing: 'south' }).facing === 'south', 'ladder');
check(mf('fx', 'vx_roof_red', { facing: 'east' }).facing === 'west' && mf('r270', 'vx_roof_red', { facing: 'east' }).facing === 'north', 'VX roof');
check(mf('fx', 'vx_holo_screen', { facing: 'west' }).facing === 'east', 'wall mount (holo screen)');
check(mf('fx', 'white_glazed_terracotta', { facing: 'east' }).facing === 'west', 'glazed terracotta');
check(mf('fa', 'vx_sign', { facing: 'south', icon: 3 }).facing === 'west' && mf('fa', 'vx_sign', { facing: 'south', icon: 3 }).icon === 3, 'VX sign: facing, its icon kept');
// low hip roof: the corner side swaps on reflections (_l ↔ _r, _vl ↔ _vr), upper/lower kept
{
  const h = (t, f, part) => mf(t, 'vx_hip_red', { facing: f, part });
  check(h('fx', 'north', 'lower_l').part === 'lower_r' && h('fx', 'north', 'upper_vr').part === 'upper_vl' && h('fz', 'east', 'upper_r').part === 'upper_l', 'hip roof corners swap sides on a mirror (lower_l → lower_r, upper_vr → upper_vl)');
  check(h('r90', 'north', 'lower_l').part === 'lower_l' && h('r90', 'north', 'lower_l').facing === 'east' && h('fx', 'north', 'upper').part === 'upper', 'turned: the corner stays; a plain piece stays plain');
}
// logs and pillars: axis x ↔ z on quarter turns and diagonals, kept on X / Z mirrors; y always kept
check(mf('fx', 'oak_log', { axis: 'x' }).axis === 'x' && mf('r90', 'oak_log', { axis: 'x' }).axis === 'z' && mf('fd', 'oak_log', { axis: 'z' }).axis === 'x' && mf('r90', 'oak_log', { axis: 'y' }).axis === 'y', 'log axis: x ↔ z on turns and diagonals, kept on mirrors, y kept');
check(mf('fa', 'ember_gate', { axis: 'x' }).axis === 'z', 'portal gate axis (x / z only)');
// beds: facing per cell, the parts stay foot and head
check(mf('fx', 'white_bed', { facing: 'east', part: 'head' }).facing === 'west' && mf('fx', 'white_bed', { facing: 'east', part: 'head' }).part === 'head', 'bed: facing mirrored, head stays head');
// buttons and levers: wall facing mirrored, floor / wall / ceiling kept
check(mf('fx', 'oak_button', { face: 'wall', facing: 'east' }).facing === 'west' && mf('fx', 'oak_button', { face: 'wall', facing: 'east' }).face === 'wall' && mf('r90', 'lever', { face: 'ceiling', facing: 'north' }).facing === 'east', 'buttons and levers');
// torches: face 0 floor, 1..4 the wall facing (north, east, south, west)
check(mf('fx', 'torch', { face: 2 }).face === 4 && mf('fx', 'torch', { face: 0 }).face === 0 && mf('fz', 'torch', { face: 1 }).face === 3 && mf('r90', 'torch', { face: 4 }).face === 1, 'wall torch: east → west on X, north → south on Z, a floor torch stays');
check(mf('fx', 'volt_torch', { face: 2, lit: 1 }).face === 4 && mf('fx', 'volt_torch', { face: 2, lit: 1 }).lit === 1, 'volt torch the same, lit kept');
// 6-way facing and the hopper: horizontal mirrored, up / down kept
check(mf('fx', 'piston', { facing: 'east' }).facing === 'west' && mf('fx', 'piston', { facing: 'up' }).facing === 'up' && mf('r90', 'piston', { facing: 'down' }).facing === 'down', 'piston (6-way): horizontal mirrored, up and down kept');
check(mf('fz', 'hopper', { facing: 'north' }).facing === 'south' && mf('fz', 'hopper', { facing: 'down' }).facing === 'down', 'hopper (4 + down)');
check(mf('fx', 'amethyst_cluster', { facing: 'east' }).facing === 'west', 'crystal cluster');
// rails: 0 ns, 1 ew, 2 asc_e, 3 asc_w, 4 asc_n, 5 asc_s, 6 se, 7 sw, 8 nw, 9 ne
{
  const r = (t, sh) => mf(t, 'rail', { shape: sh }).shape;
  check(r('fx', 0) === 0 && r('fx', 1) === 1 && r('r90', 0) === 1 && r('fd', 1) === 0, 'rail straights: kept on mirrors, swapped on turns and diagonals');
  check(r('fx', 2) === 3 && r('fx', 4) === 4 && r('fz', 4) === 5 && r('r90', 4) === 2 && r('r90', 2) === 5, 'rail slopes: east ↔ west on X, north ↔ south on Z, north → east on a turn');
  check(r('fx', 6) === 7 && r('fx', 9) === 8 && r('fz', 6) === 9 && r('r90', 6) === 7 && r('r180', 6) === 8, 'rail curves: se → sw on X, se → ne on Z, se → sw on a turn, se → nw on a half turn');
  check([0, 1, 2, 3, 4, 5].every(sh => ALL.every(t => { const v = mf(t, 'powered_rail', { shape: sh, powered: 1 }); return v.shape <= 5 && v.powered === 1; })), 'powered rail: never a curve (its shapes are 0..5), powered kept');
}
// vines and lichen: the face bits 1 n, 2 e, 4 s, 8 w move; 16 up, 32 down stay
check(mf('fx', 'vines', { faces: 1 | 2 }).faces === (1 | 8) && mf('r90', 'vines', { faces: 1 | 2 | 16 }).faces === (2 | 4 | 16), 'vines: north + east → north + west on X; turned: east + south (+ up kept)');
check(mf('fz', 'glow_lichen', { faces: 4 | 32 }).faces === (1 | 32), 'glow lichen: south → north on Z, down kept');
// stems: attach 1..4 point east, south, west, north
check(mf('fx', 'melon_stem', { attach: 1, age: 7 }).attach === 3 && mf('r90', 'melon_stem', { attach: 4 }).attach === 1 && mf('fx', 'melon_stem', { attach: 0 }).attach === 0, 'stems: the attached side mirrored');
// ground cover, dripleaf, cocoa, campfire, furnace: facing; slabs, lanterns, lamp posts: nothing to mirror
check(mf('fz', 'leaf_litter', { facing: 'north', count: 2 }).facing === 'south' && mf('fz', 'leaf_litter', { facing: 'north', count: 2 }).count === P(S('leaf_litter', { count: 2 })).count, 'leaf litter: facing, count kept');
check(mf('fx', 'big_dripleaf', { facing: 'east', part: 'stem', tilt: 1 }).facing === 'west' && mf('fx', 'big_dripleaf', { facing: 'east', part: 'stem', tilt: 1 }).part === 'stem', 'big dripleaf');
check(mf('fx', 'furnace', { facing: 'east', lit: 1 }).facing === 'west' && mf('fx', 'furnace', { facing: 'east', lit: 1 }).lit === 1, 'furnace');
check(M.state('fx', S('oak_slab', { type: 'top' })) === S('oak_slab', { type: 'top' }) && M.state('r90', S('lantern', { hanging: 1 })) === S('lantern', { hanging: 1 }) && M.state('fd', S('stone')) === S('stone') && M.state('fx', 0) === 0, 'slabs, lanterns, plain blocks and air stay as they are');
// VM models per cell: facing turned, part kept
check(mf('r90', 'vm_sofa_charcoal', { facing: 'north', part: 'p200' }).facing === 'east' && mf('r90', 'vm_sofa_charcoal', { facing: 'north', part: 'p200' }).part === 'p200', 'VM model cell turned: facing east, part kept');
// signs: rotation 16 (generic; 0 north, 4 east, 8 south, 12 west)
check([[0, 'fx', 0], [4, 'fx', 12], [3, 'fx', 13], [0, 'fz', 8], [2, 'fz', 6], [1, 'r90', 5], [15, 'r90', 3], [0, 'fd', 12], [4, 'fd', 8], [0, 'fa', 4], [5, 'fa', 15], [6, 'r180', 14]].every(([r, t, w]) => M.rot16(t, r) === w), 'rotation 16 (signs): mirrored and turned on the 22.5° steps');

console.log('d · every state of every type');
{
  const n = R.stateCount;
  let bad = 0, idBad = 0, invBad = 0, rotBad = 0, lawBad = 0, changed = 0, ex = [];
  const st = (t, s) => M.state(t, s);
  for (let s = 1; s < n; s++) {
    const ty = R.T.type[s];
    for (const t of ALL) { const m = st(t, s); if (!(m > 0 && m < n) || R.T.type[m] !== ty) { bad++; if (ex.length < 6) ex.push(R.types[ty].name + ' ' + t); } else if (m !== s) changed++; }
    if (st('id', s) !== s) idBad++;
    for (const t of ['fx', 'fz', 'fd', 'fa', 'r180']) if (st(t, st(t, s)) !== s) { invBad++; if (ex.length < 6) ex.push('inv ' + R.types[ty].name + ' ' + t); }
    if (st('r90', st('r90', st('r90', st('r90', s)))) !== s || st('r270', st('r90', s)) !== s) rotBad++;
    const r90 = st('r90', s);
    if (st('fd', s) !== st('fx', r90) || st('fa', s) !== st('fz', r90) || st('r180', s) !== st('r90', r90) || st('r180', s) !== st('fx', st('fz', s))) { lawBad++; if (ex.length < 6) ex.push('law ' + R.types[ty].name); }
  }
  console.log('  ' + (n - 1) + ' states × 7 transforms, ' + changed + ' mirrored states differ from their source' + (ex.length ? ' · e.g. ' + ex.join(', ') : ''));
  check(!bad, 'every mirrored state is a valid state of the same block type (' + bad + ' bad)');
  check(!idBad, 'the identity keeps every state');
  check(!invBad, 'every reflection (and the half turn) applied twice gives the state back (' + invBad + ')');
  check(!rotBad, 'four quarter turns, and a quarter turn there and back, give the state back (' + rotBad + ')');
  check(!lawBad, 'the group laws hold for every state: fd = fx∘r90, fa = fz∘r90, r180 = r90∘r90 = fx∘fz (' + lawBad + ')');
  check(changed > 20000, 'directional states really change (' + changed + ')');
}

console.log('e · pieces and copies');
const cell = (x, y, z, s) => ({ x, y, z, state: s });
const key = (g) => g.map(c => c.x + ',' + c.y + ',' + c.z).sort().join(';');
{
  // a door two blocks east of the centre (block 10, doubled 21), facing north, hinge left
  const door = [cell(12, 64, 5, S('oak_door', { facing: 'north', half: 'bottom', hinge: 'left' })), cell(12, 65, 5, S('oak_door', { facing: 'north', half: 'top', hinge: 'left' }))];
  const g = M.group('fx', 21, 21, door);
  check(g.length === 2 && g.every(c => c.x === 8 && c.z === 5) && g[0].y === 64 && g[1].y === 65, 'door X: both halves at x 8');
  check(g.every(c => pv(c.state, 'facing') === 'north' && pv(c.state, 'hinge') === 'right') && pv(g[0].state, 'half') === 'bottom' && pv(g[1].state, 'half') === 'top', 'door X: facing north, hinge right, lower and upper half');
  const cs = M.copies('xz', 21, 21, door);
  check(cs.length === 3 && cs.every(gr => gr.length === 2), '4-fach: three whole doors');
  const facings = cs.map(gr => pv(gr[0].state, 'facing') + '/' + pv(gr[0].state, 'hinge')).sort();
  check(same(facings, ['north/right', 'south/left', 'south/right']), '4-fach doors: north/right (X), south/right (Z), south/left (half turn) — ' + facings.join(' '));
  check(M.copies('x', 25, 21, door).length === 0, 'a door on the X axis (block 12) mirrors onto itself and is no copy');
}
{
  // a bed: foot at (12, 64, 5), head one north (facing north) — mirrored on every transform: head = foot + facing
  const bed = [cell(12, 64, 5, S('vx_bed_red', { facing: 'north', part: 'foot' })), cell(12, 64, 4, S('vx_bed_red', { facing: 'north', part: 'head' }))];
  let ok = true;
  for (const t of ALL) {
    const g = M.group(t, 21, 21, bed), foot = g.find(c => pv(c.state, 'part') === 'foot'), head = g.find(c => pv(c.state, 'part') === 'head');
    if (!foot || !head) { ok = false; continue; }
    const f = R.types[R.T.type[foot.state]].get(foot.state, 'facing');
    if (head.x - foot.x !== VR.HF_DX[f] || head.z - foot.z !== VR.HF_DZ[f] || pv(head.state, 'facing') !== pv(foot.state, 'facing')) ok = false;
  }
  check(ok, 'a bed stays a bed on every transform (head = foot + facing)');
}
{
  // VM models: a 3-wide sofa (symmetric) and an arc lamp (an L, not symmetric) — the copy is a valid placement of the model
  const place = (name, f, x, y, z) => { const m = VR.VM.MODELS[name], t = R.byName[name]; return VR.VM.footprint(m, f).map(([dx, dy, dz, i]) => cell(x + dx, y + dy, z + dz, t.with(t.with(t.defaultState, 'facing', f), 'part', i))); };
  const valid = (name, g) => {
    const t = R.byName[name], m = VR.VM.MODELS[name];
    if (!g.length || g.some(c => R.T.type[c.state] !== t.id)) return false;
    const f = t.get(g[0].state, 'facing'), fp = VR.VM.footprint(m, f);
    if (g.some(c => t.get(c.state, 'facing') !== f) || g.length !== fp.length) return false;
    const c0 = g.find(c => t.get(c.state, 'part') === 0); if (!c0) return false;
    return g.every(c => { const o = fp[t.get(c.state, 'part')]; return c.x - c0.x === o[0] && c.y - c0.y === o[1] && c.z - c0.z === o[2]; });
  };
  const bbox = (g) => { const b = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9]; for (const c of g) { b[0] = Math.min(b[0], c.x); b[1] = Math.min(b[1], c.y); b[2] = Math.min(b[2], c.z); b[3] = Math.max(b[3], c.x); b[4] = Math.max(b[4], c.y); b[5] = Math.max(b[5], c.z); } return b.join(','); };
  let okSofa = true, okLamp = true, exactSofa = true, okTurn = true;
  for (const f of [0, 1, 2, 3]) for (const t of ALL) {
    const sofa = place('vm_sofa_charcoal', f, 13, 64, 6), gs = M.group(t, 21, 21, sofa);
    const want = sofa.map(c => { const p = M.pos(t, 21, 21, c.x, c.z); return cell(p[0], c.y, p[1], 0); });
    if (!valid('vm_sofa_charcoal', gs) || bbox(gs) !== bbox(want)) okSofa = false;
    if (key(gs) !== key(want)) exactSofa = false;
    const lamp = place('vm_arc_lamp', f, 13, 64, 6), gl = M.group(t, 21, 21, lamp);
    const wantL = lamp.map(c => { const p = M.pos(t, 21, 21, c.x, c.z); return cell(p[0], c.y, p[1], 0); });
    if (!valid('vm_arc_lamp', gl) || bbox(gl) !== bbox(wantL)) okLamp = false;
    if (t[0] === 'r' && key(gl) !== key(wantL)) okTurn = false;
  }
  check(okSofa && exactSofa, 'a symmetric VM model (3-wide sofa) mirrors exactly onto the mirrored cells, as a valid placement, every facing × transform');
  check(okLamp, 'an asymmetric VM model (arc lamp) mirrors as a valid placement on the mirrored bounding box');
  check(okTurn, 'turned, an asymmetric model lands exactly on the turned cells');
  const fp = M.group('fx', 21, 21, place('vm_sofa_charcoal', 1, 13, 64, 6));
  check(fp.every(c => pv(c.state, 'facing') === 'west'), 'the sofa facing east faces west in the X mirror');
}
{
  const one = [cell(12, 64, 13, S('oak_stairs', { facing: 'east' }))];
  const c8 = M.copies('r8', 21, 21, one), c4 = M.copies('xz', 21, 21, one);
  check(c8.length === 7 && new Set(c8.map(key)).size === 7 && !c8.some(g => key(g) === key(one)), '8-fach: seven copies of a stair, none on another or on the original');
  check(c4.length === 3, '4-fach: three copies');
  const fs = c4.map(g => pv(g[0].state, 'facing')).sort();
  check(same(fs, ['east', 'west', 'west']), '4-fach stair facings: west (X), east (Z), west (half turn) — ' + fs.join(' '));
  check(M.copies('r8', 21, 21, [cell(10, 64, 10, S('stone'))]).length === 0, 'the centre block has no copies');
  check(M.copies('x', 21, 21, [cell(10, 64, 7, S('stone'))]).length === 0, 'a block on the axis has no copy');
  check(M.copies(null, 21, 21, one).length === 0, 'off: no copies');
  const pts = M.points('xz', 21, 21, 12, 13);
  check(pts.length === 3 && pts.some(p => same(p, [8, 13])) && pts.some(p => same(p, [12, 7])) && pts.some(p => same(p, [8, 7])), 'points() for breaking: the three mirrored spots');
}

console.log('f · the axis guide');
{
  const out = new Float32Array(M.GUIDE_FLOATS), res = {};
  const lines = { x: 1, z: 1, xz: 2, r8: 4 };
  let ok = true;
  for (const mode of ['x', 'z', 'xz', 'r8']) {
    const r = M.guide(mode, out, res);
    const n = lines[mode];
    if (r !== res || res.lines !== n || res.halo[1] !== 6 * n || res.core[1] !== 6 * n || res.plane[1] !== 6 * n) { ok = false; console.log('    ', mode, JSON.stringify(res)); }
    const used = (res.plane[0] + res.plane[1]) * 3;
    for (let i = 0; i < used; i++) if (!Number.isFinite(out[i]) || Math.abs(out[i]) > M.GUIDE_LEN + M.GUIDE_H + 2) ok = false;
  }
  check(ok, 'one halo strip, one core strip and one plane per mirror line (X 1, Z 1, 4-fach 2, 8-fach 4), finite, near the centre');
  M.guide('x', out, res);
  let alongZ = true; for (let i = res.core[0]; i < res.core[0] + res.core[1]; i++) if (Math.abs(out[i * 3]) > 0.2) alongZ = false;
  check(alongZ, 'the X mirror line runs along z through the centre (x within its thin width)');
  check(M.GUIDE_FLOATS <= 4 * 18 * 3 + 64, 'the guide buffer is small (' + M.GUIDE_FLOATS + ' floats)');
}

console.log('g · in the game: the hand, its copies, the world edit path (src/main/mirrorbuild.js on a small fake world)');
{
  globalThis.window = globalThis; globalThis.document = { getElementById: () => null, addEventListener() {} };
  for (const f of ['place', 'player', 'mirrorbuild', 'game']) require(ROOT + '/src/main/' + f + '.js');
  // a fake world with the game's listener chain (a guest / the host would send what onBlockChanged hears)
  const blocks = new Map(), K = (x, y, z) => x + ',' + y + ',' + z, sent = [];
  const world = {
    listeners: [{ onBlockChanged: (x, y, z, old, s) => sent.push([x, y, z, s]) }],
    getBlock: (x, y, z) => blocks.get(K(x, y, z)) || 0,
    setBlock(x, y, z, s, flags) { const old = this.getBlock(x, y, z); if (old === s) return false; if (s) blocks.set(K(x, y, z), s); else blocks.delete(K(x, y, z)); if (!(flags & 2)) for (const l of this.listeners) l.onBlockChanged(x, y, z, old, s); return true; },
    getLight: () => 0, col: () => ({}), isLoaded: () => true,
  };
  const sounds = { place: 0, dig: 0 }, hints = [];
  const game = {
    world, settings: {}, state: 'play', mp: null,
    audio: { play() {}, place() { sounds.place++; }, dig() { sounds.dig++; } }, particles: { breakBlock() {}, hitBlock() {} },
    ui: { blocking: false, chatLine() {}, hint: (t) => hints.push(String(t)) },
    entityBlocks: () => false, breakMulti: VR.Game.prototype.breakMulti,
  };
  const p = game.player = new VR.Player(game);
  p.mode = 'creative'; p.pos = [10.5, 64, 22.5];
  const mb = game.mirror = new VR.MirrorBuild(game);
  const Y = 64, st = (n) => R.byName[n].defaultState;
  const floor = () => { blocks.clear(); for (let x = -2; x <= 22; x++) for (let z = -2; z <= 24; z++) blocks.set(K(x, Y - 1, z), st('stone')); };
  const look = (pt) => { const e = p.eyePos(), d = [pt[0] - e[0], pt[1] - e[1], pt[2] - e[2]]; p.yaw = Math.atan2(-d[0], -d[2]); p.pitch = Math.atan2(d[1], Math.hypot(d[0], d[2])); };
  // the hand places `name` on top of the floor block (x, Y-1, z), the player looking north (stairs and doors face north)
  const place = (name, x, z, top) => { p.yaw = 0; p.pitch = -0.5; const y = top === undefined ? Y - 1 : top, s = blocks.get(K(x, y, z)) || 0; return p.placeFromHit(R.byName[name], { x, y, z, face: 2, state: s, px: x + 0.5, py: y + 1, pz: z + 0.5 }); };
  const at = (x, y, z) => { const s = world.getBlock(x, y, z); return s ? P(s) : null; };
  const nOf = (name) => { let n = 0; const id = R.byName[name].id; for (const s of blocks.values()) if (R.T.type[s] === id) n++; return n; };
  floor();
  // the centre: the top of block (10, 63, 10) in its middle → on the block; near its west edge → between 9 and 10
  look([10.5, Y, 10.5]); mb.set('xz');
  check(mb.mode === 'xz' && mb.c2x === 21 && mb.c2z === 21 && mb.gy === Y, 'switched on, the centre is the block pointed at (doubled 21, 21; the guide on its top, y ' + mb.gy + ')');
  look([10.06, Y, 10.5]); mb.set('x', true);
  check(mb.c2x === 20 && mb.c2z === 21, 'aimed near its west edge: between blocks 9 and 10 in x (' + mb.c2x + ', ' + mb.c2z + ')');
  look([10.5, Y, 10.5]); mb.set('xz', true);
  // stairs: 4-fach → four, facings mirrored, the hand's sound once, every copy through world.setBlock (sent like any edit)
  sent.length = 0; sounds.place = 0;
  check(place('oak_stairs', 12, 13) === true, 'the hand places a stair');
  const sf = [[12, 13], [8, 13], [12, 7], [8, 7]].map(([x, z]) => at(x, Y, z));
  check(sf.every(s => s && s.name === 'oak_stairs'), '4-fach: four stairs (12|13, 8|13, 12|7, 8|7)');
  check(sf.map(s => s && s.facing).join(' ') === 'north north south south', 'their facings: north, north (X), south (Z), south (half turn) — ' + sf.map(s => s && s.facing).join(' '));
  check(sent.length === 4 && sounds.place === 1, 'four world edits that go out like any edit (' + sent.length + '), one sound (' + sounds.place + ')');
  // a door: four whole doors, the hinge mirrored
  sent.length = 0;
  check(place('oak_door', 13, 12) === true, 'the hand places a door');
  const dd = [[13, 12], [7, 12], [13, 8], [7, 8]].map(([x, z]) => [at(x, Y, z), at(x, Y + 1, z)]);
  check(dd.every(([a, b]) => a && b && a.name === 'oak_door' && b.name === 'oak_door' && a.half === 'bottom' && b.half === 'top' && a.facing === b.facing && a.hinge === b.hinge), '4-fach: four doors, each with both halves');
  check(dd.map(([a]) => a.facing + '/' + a.hinge).join(' ') === 'north/left north/right south/right south/left', 'door facings and hinges: north/left, north/right (X), south/right (Z), south/left (half turn) — ' + dd.map(([a]) => a && a.facing + '/' + a.hinge).join(' '));
  check(sent.length === 8, 'eight door cells went out (' + sent.length + ')');
  // breaking one copy takes the other three too (the mirror of a copy is the original and the other copies)
  sounds.dig = 0;
  p.breakBlock(8, Y, 7, world.getBlock(8, Y, 7), false, true);
  check(nOf('oak_stairs') === 0 && sounds.dig === 1, 'breaking one stair (a copy) breaks all four, one sound (' + nOf('oak_stairs') + ' left)');
  p.breakBlock(7, Y + 1, 12, world.getBlock(7, Y + 1, 12), false, true);
  check(nOf('oak_door') === 0, 'breaking a door\'s upper half breaks all four doors, both halves (' + nOf('oak_door') + ' cells left)');
  // a blaster's break is not mirrored (only the hand's)
  place('stone_bricks', 12, 13); p.breakBlock(12, Y, 13, world.getBlock(12, Y, 13), true);
  check(nOf('stone_bricks') === 3, 'a break that is not by hand (a blaster\'s) is not mirrored (3 copies stay)');
  floor();
  // skipped copies: a cell taken by another block, the player standing in one; a stair placed into the gap later
  blocks.set(K(8, Y, 13), st('oak_planks')); p.pos = [12.5, Y, 7.5]; sent.length = 0; const sk = mb.stats.skipped;
  place('oak_stairs', 12, 13);
  check(at(8, Y, 13).name === 'oak_planks' && !at(12, Y, 7) && at(8, Y, 7) && at(8, Y, 7).name === 'oak_stairs' && mb.stats.skipped === sk + 2, 'a copy never overwrites another block and never lands in the player (2 skipped, 1 placed)');
  p.pos = [10.5, Y, 22.5];
  // a slab on a slab: the copies become double slabs too
  floor(); mb.set('x');
  place('oak_slab', 12, 13);
  check(at(8, Y, 13) && at(8, Y, 13).type === 'bottom', 'X: a slab and its copy');
  p.placeFromHit(R.byName.oak_slab, { x: 12, y: Y, z: 13, face: 2, state: world.getBlock(12, Y, 13), px: 12.5, py: Y + 0.5, pz: 13.5 });
  check(at(12, Y, 13).type === 'double' && at(8, Y, 13).type === 'double', 'a slab on the slab: both double');
  // 8-fach: eight blocks; a sofa (VM model) in 4-fach: four whole sofas
  floor(); mb.set('r8');
  place('stone_bricks', 12, 13);
  check(nOf('stone_bricks') === 8, '8-fach: eight blocks from one (' + nOf('stone_bricks') + ')');
  floor(); mb.set('xz');
  place('vm_sofa_charcoal', 13, 14);
  check(nOf('vm_sofa_charcoal') === 12, '4-fach: a 3-wide sofa four times, whole (' + nOf('vm_sofa_charcoal') + ' cells)');
  // far from the centre (more than 96 blocks along x or z): nothing is mirrored, a hint says why
  floor(); blocks.set(K(130, Y - 1, 13), st('stone')); hints.length = 0;
  place('stone_bricks', 130, 13);
  check(nOf('stone_bricks') === 1 && hints.some(h => /Spiegel|mirror/.test(h)), 'an edit 120 blocks from the centre is not mirrored, a hint says so');
  // off: single again; Überleben: no copies, the mode switches off, the key gives the kind hint
  floor(); mb.set(null);
  place('oak_stairs', 12, 13);
  check(nOf('oak_stairs') === 1 && mb.guide() === null, 'aus: one stair, no guide');
  look([10.5, Y, 10.5]); mb.set('xz'); const G = mb.guide();
  check(G && G.parts[0].n === 12 && G.parts[1].n === 12 && G.parts[2].n === 12 && G.ox === 10.5 && G.oz === 10.5 && G.oy === Y, 'on: the guide (2 lines × halo, core, plane) stands at the centre on the ground');
  const v0 = G.ver; mb.update(0.1); mb.guide();
  check(G.ver === v0 && mb.guide() === G, 'every frame the same guide object, not rebuilt (no allocation per frame)');
  p.mode = 'survival'; floor();
  place('oak_stairs', 12, 13);
  check(nOf('oak_stairs') === 1, 'Überleben: no copies');
  mb.update(0.1);
  check(mb.mode === null, 'in Überleben the mirror goes off');
  hints.length = 0; mb.key();
  check(mb.mode === null && hints.length === 1 && /Kreativ|Creative/.test(hints[0]), 'the key in Überleben: a kind hint (' + hints[0] + ')');
  p.mode = 'creative'; mb.command(['8']);
  check(mb.mode === 'r8', '/spiegel 8 → 8-fach');
  mb.command(['aus']);
  check(mb.mode === null, '/spiegel aus → off');
  mb.command(['constructor']); mb.command(['quatsch']);
  check(mb.mode === null, 'an unknown word changes nothing (the usage line instead)');
  mb.key(); mb.key(); mb.key();
  check(mb.mode === 'xz', 'the key three times: X → Z → 4-fach');
  mb.key(); mb.key();
  check(mb.mode === null, 'two more: 8-fach → aus');
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

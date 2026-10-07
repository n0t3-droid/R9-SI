// W2 „Bauhand & ✨" (spec 2026-10-07-all-ages-workflow-design.md §4, §8) — the parts that need no browser:
// 1 · Blueprints: a Bauteil (r9si.library: pal + RLE) as a plan of kind 'piece' — built where it is planned, turned
//     with the plan, keep cells leave the world alone, air cells clear; a plan with settle finds its floor on the
//     ground; tryBuild builds one plan at once (the Bauhand's click); a big piece goes in slices and cancelSlices puts
//     the world back exactly; a plan the browser could not keep says so (storePlans → false).
// 2 · the Bauhand's model: the ring (starter set on empty favourites, ★ newest first, „▸ alle" beyond eight, only
//     blocks in a guest world), the plan a Ding becomes, the state machine (closed → open → holding → closed).
const store = new Map();
globalThis.__full = false;
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { if (globalThis.__full) { const e = new Error('The quota has been exceeded.'); e.name = 'QuotaExceededError'; throw e; } store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
  key: (i) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
  clear: () => store.clear(),
};
global.window = global; global.self = global;
require('./load_shared.js');
require('../src/main/favs.js');
require('../src/main/pack.js');
require('../src/main/blueprints.js');
const R = VR.R, CU = VR.Custom, KEEP = 0xffff;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const st = (n) => R.byName[n].defaultState;
const STONE = st('stone'), GLASS = st('glass'), GRASS = st('grass_block'), DIRT = st('dirt'), PLANKS = st('oak_planks');

// ---------------------------------------------------------------- a small flat world: ground top at y 3 (grass), air above
function makeWorld() {
  const blocks = new Map(), key = (x, y, z) => x + ',' + y + ',' + z;
  const w = {
    blocks,
    getBlock(x, y, z) { const v = blocks.get(key(x, y, z)); if (v !== undefined) return v; return y < 3 ? STONE : y === 3 ? GRASS : 0; },
    set(x, y, z, s) { blocks.set(key(x, y, z), s); },
    col() { return { ready: true }; },
    bulkSet(list) { for (const [x, y, z, s] of list) blocks.set(key(x, y, z), s); },
  };
  return w;
}
function makeGame(world) {
  const undo = [];
  const g = { world, meta: { id: 'wtest' }, state: 'play', ui: { hint() {}, toast() {}, chatLine() {} }, audio: { play() {}, place() {} }, player: { unstick() {}, creative: true } };
  // the worker pool: Forge jobs answered a moment later (like the real worker)
  g.pool = { jobs: [], direct(wi, msg, tr, cb) { this.jobs.push(() => cb(msg.type === 'forge' ? VR.Forge.job(msg) : { type: 'error', msg: 'no ' + msg.type })); } , flush() { const j = this.jobs.splice(0); for (const f of j) f(); } };
  const gad = { g, wand: { undo }, applyEdit(list, u) { world.bulkSet(list); if (u) undo.push(u); }, noteBlock() {}, undo() { const u = undo.pop(); if (u) world.bulkSet(u); } };
  return { g, gad, blue: new VR.Blueprints(gad), undo };
}
// a Bauteil in the library: cells given as [x, y, z, state | 'keep' | 'air']
function libItem(id, sx, sy, sz, cells, dy, extra) {
  const pal = [0, 'air'], map = new Map(), idx = new Uint16Array(sx * sy * sz);
  for (const [x, y, z, s] of cells) {
    let k;
    if (s === 'keep') k = 0; else if (s === 'air') k = 1; else { k = map.get(s); if (k === undefined) { k = pal.length; pal.push(CU.portable(s)); map.set(s, k); } }
    idx[(y * sz + z) * sx + x] = k;
  }
  return Object.assign({ id, name: 'Teil ' + id, t: Date.now(), sx, sy, sz, dy: dy || 0, pal, rle: CU.b64(CU.vrle(idx)) }, extra || {});
}
const putLib = (items) => store.set('r9si.library', JSON.stringify({ v: 1, items, t: Date.now() }));
const plansOf = () => (JSON.parse(store.get('r9si.plans.wtest') || '{"plans":[]}').plans || []);

console.log('1 · a Bauteil as a plan (kind piece)');
{
  store.clear();
  // 2 × 3 × 2: a stone floor, a glass column at (0, *, 0), keep at (1, 1, 1), air at (1, 2, 1)
  const cells = [[0, 0, 0, STONE], [1, 0, 0, STONE], [0, 0, 1, STONE], [1, 0, 1, STONE], [0, 1, 0, GLASS], [0, 2, 0, GLASS], [1, 1, 1, 'keep'], [1, 2, 1, 'air']];
  putLib([libItem('t1', 2, 3, 2, cells, 0)]);
  const world = makeWorld(), { blue, undo } = makeGame(world);
  world.set(11, 5, 21, PLANKS);   // something where the keep cell is (1, 1, 1) → (11, 5, 21): it stays
  world.set(11, 6, 21, PLANKS);   // and where the air cell is (1, 2, 1) → (11, 6, 21): it is cleared
  check(typeof blue.tryBuild === 'function', 'Blueprints has tryBuild(plan)');
  const pl = { id: 'pa', kind: 'piece', piece: 'p:t1', ox: 10, oz: 20, F: 4, r: 0, status: 'pending', t: 1, from: 'hand' };
  blue.loadPlans(); blue.plans.push(pl);
  check(blue.storePlans((ps) => ps.concat([pl])) === true, 'storePlans says the browser kept it');
  const res = blue.tryBuild ? blue.tryBuild(pl) : null;
  check(res === 'built', 'tryBuild builds a ready piece at once (' + res + ')');
  check(world.getBlock(10, 4, 20) === STONE && world.getBlock(11, 4, 21) === STONE && world.getBlock(10, 5, 20) === GLASS && world.getBlock(10, 6, 20) === GLASS, 'its cells stand where they were planned (F 4, ox 10, oz 20)');
  check(world.getBlock(11, 5, 21) === PLANKS, 'a keep cell leaves the world as it was');
  check(world.getBlock(11, 6, 21) === 0, 'an air cell clears what was there');
  check(undo.length === 1 && pl.status === 'built', 'one undo step; the plan is built');
  check(plansOf().length === 1 && plansOf()[0].status === 'built', 'r9si.plans.<w> has it as built');
  const u = undo.pop(); world.bulkSet(u);
  check(world.getBlock(10, 5, 20) === 0 && world.getBlock(11, 6, 21) === PLANKS && world.getBlock(10, 4, 20) === 0, 'its undo puts the world back');
  check(typeof blue.removePlan === 'function' && (blue.removePlan('pa'), plansOf().length === 0 && !blue.plans.some(p => p.id === 'pa')), 'removePlan drops it from the plans (the Studio never shows it)');
}

console.log('2 · turned: r 1 puts (u, v) at (−v, u)');
{
  store.clear();
  putLib([libItem('t2', 3, 1, 1, [[0, 0, 0, STONE], [1, 0, 0, GLASS], [2, 0, 0, PLANKS]], 0)]);
  const world = makeWorld(), { blue } = makeGame(world);
  blue.loadPlans();
  const pl = { id: 'pb', kind: 'piece', piece: 'p:t2', ox: 0, oz: 0, F: 4, r: 1, status: 'pending', t: 1 };
  blue.plans.push(pl);
  const res = blue.tryBuild(pl);
  check(res === 'built' && world.getBlock(0, 4, 0) === STONE && world.getBlock(0, 4, 1) === GLASS && world.getBlock(0, 4, 2) === PLANKS, 'a row along x stands along z after a quarter turn (' + res + ')');
}

console.log('3 · height offset and settle');
{
  store.clear();
  putLib([libItem('t3', 2, 2, 2, [[0, 0, 0, STONE], [1, 0, 0, STONE], [0, 0, 1, STONE], [1, 0, 1, STONE], [0, 1, 0, GLASS]], -1)]);
  const world = makeWorld(), { blue } = makeGame(world);
  blue.loadPlans();
  const pl = { id: 'pc', kind: 'piece', piece: 'p:t3', ox: 5, oz: 5, F: 4, r: 0, status: 'pending', t: 1 };
  blue.plans.push(pl); blue.tryBuild(pl);
  check(world.getBlock(5, 3, 5) === STONE && world.getBlock(5, 4, 5) === GLASS, 'dy −1: the bottom row sits in the ground (the floor slab of a house)');
  // settle: the floor is found on the ground — the highest ground under it (a bump at (21, 5, 20))
  world.set(21, 4, 20, DIRT); world.set(21, 5, 20, GRASS);
  putLib([libItem('t4', 2, 1, 2, [[0, 0, 0, PLANKS], [1, 0, 0, PLANKS], [0, 0, 1, PLANKS], [1, 0, 1, PLANKS]], 0)]);
  const ps = { id: 'pd', kind: 'piece', piece: 'p:t4', ox: 20, oz: 20, F: 0, r: 0, settle: true, status: 'pending', t: 1 };
  blue.plans.push(ps);
  const res = blue.tryBuild(ps);
  check(res === 'built' && ps.F === 6 && world.getBlock(20, 6, 20) === PLANKS && world.getBlock(21, 6, 21) === PLANKS, 'settle: F from the highest ground under the piece (' + res + ', F ' + ps.F + ')');
  check(plansOf().length === 0 || plansOf().every(p => p.id !== 'pd' || p.F === 6), 'the settled floor is what the plans keep');
}

console.log('4 · a big piece goes in slices; cancelSlices puts the world back');
{
  store.clear();
  // 40 × 30 × 20 = 24 000 cells of planks: more than one bulk edit
  const cells = []; for (let y = 0; y < 20; y++) for (let z = 0; z < 30; z++) for (let x = 0; x < 40; x++) cells.push([x, y, z, PLANKS]);
  putLib([libItem('big', 40, 20, 30, cells, 0)]);
  const world = makeWorld(), { blue, undo } = makeGame(world);
  blue.loadPlans();
  const pl = { id: 'pe', kind: 'piece', piece: 'p:big', ox: 100, oz: 100, F: 4, r: 0, status: 'pending', t: 1 };
  blue.plans.push(pl);
  const res = blue.tryBuild(pl);
  check(res === 'sliced' && pl.status === 'building' && !!blue.slices, 'tryBuild starts slices (' + res + ')');
  blue.tickPlans(1);   // one slice
  const some = world.getBlock(100, 4, 100) === PLANKS, notAll = world.getBlock(139, 23, 129) !== PLANKS;
  check(some && notAll, 'one slice later: the bottom stands, the top not yet');
  check(typeof blue.cancelSlices === 'function' && blue.cancelSlices('pe') === true, 'cancelSlices stops the build');
  let left = 0; for (const v of world.blocks.values()) if (v === PLANKS) left++;
  check(left === 0 && !blue.slices && undo.length === 0, 'and nothing of it is left, no undo step (' + left + ' planks)');
  // the same again to the end: one undo step for all of it
  const pl2 = { id: 'pf', kind: 'piece', piece: 'p:big', ox: 100, oz: 100, F: 4, r: 0, status: 'pending', t: 1 };
  blue.plans.push(pl2); blue.tryBuild(pl2);
  for (let i = 0; i < 20 && blue.slices; i++) blue.tickPlans(1);
  let all = 0; for (const v of world.blocks.values()) if (v === PLANKS) all++;
  check(all === 24000 && pl2.status === 'built' && undo.length === 1, 'all slices: 24 000 blocks, built, one undo step');
  world.bulkSet(undo.pop());
  let back = 0; for (const v of world.blocks.values()) if (v === PLANKS) back++;
  check(back === 0, 'that one undo takes all of it back');
}

console.log('5 · a Forge plan waits for the worker, then builds');
{
  store.clear();
  const world = makeWorld(), { g, blue } = makeGame(world);
  blue.loadPlans();
  const dna = VR.Forge.fromText('Park');
  const pl = { id: 'pg', kind: 'forge', dna, ox: 0, oz: 0, F: 4, r: 0, status: 'pending', t: 1 };
  blue.plans.push(pl);
  check(blue.tryBuild(pl) === 'wait', 'first: wait for the worker');
  g.pool.flush();
  const res = blue.tryBuild(pl);
  check(res === 'built' || res === 'sliced', 'then it builds (' + res + ')');
  for (let i = 0; i < 30 && blue.slices; i++) blue.tickPlans(1);
  let n = 0; for (const v of world.blocks.values()) if (v) n++;
  check(pl.status === 'built' && n > 100, 'the park stands (' + n + ' blocks)');
}

console.log('6 · the browser storage is full');
{
  store.clear();
  const world = makeWorld(), { blue } = makeGame(world);
  blue.loadPlans();
  globalThis.__full = true;
  const ok = blue.storePlans((ps) => ps.concat([{ id: 'ph', kind: 'piece', piece: 'p:x', status: 'pending' }]));
  globalThis.__full = false;
  check(ok === false, 'storePlans says so (false)');
}

// ---------------------------------------------------------------- 2 · the Bauhand's model (no DOM)
console.log('7 · the ring');
{
  require('../src/shared/ding.js');
  let BH = null;
  try { require('../src/main/bauhand.js'); BH = VR.Bauhand; } catch (e) { console.log('  (bauhand.js: ' + String(e.message).slice(0, 200) + ')'); }
  check(!!(BH && BH.ringList), 'VR.Bauhand.ringList exists');
  if (BH && BH.ringList) {
    store.clear(); VR.Favs.sync();
    const r0 = BH.ringList({});
    check(r0.slots.length >= 6 && r0.starter === true && r0.slots.every(s => s.starter), 'empty favourites: the starter set (' + r0.slots.map(s => s.id).join(' ') + ')');
    const names = r0.slots.map(s => s.name).join(' ');
    check(/Bank/.test(names) && /Laterne/.test(names) && /Apfelbaum/.test(names) && /Blumenbeet/.test(names) && /Zaun/.test(names) && /Bungalow/.test(names), 'Bank · Laterne · Apfelbaum · Blumenbeet · Zaun · Bungalow (' + names + ')');
    check(r0.slots.every(s => VR.Ding.parse(s.id)), 'every starter is a Ding');
    // ★ newest first
    for (const id of ['oak_planks', 'glass', 'stone_bricks']) VR.Favs.add(id);
    const r1 = BH.ringList({});
    check(r1.starter === false && r1.slots[0].id === 'b:stone_bricks' && r1.slots[1].id === 'b:glass', '★ favourites, the newest first (' + r1.slots.map(s => s.id).join(' ') + ')');
    for (let i = 0; i < 10; i++) VR.Favs.add(['lantern', 'torch', 'cobblestone', 'bricks', 'sandstone', 'oak_log', 'birch_planks', 'spruce_planks', 'white_wool', 'red_wool'][i]);
    const r2 = BH.ringList({});
    check(r2.slots.length === 8 && r2.more === true && r2.all.length >= 13, 'more than eight: eight slots and „▸ alle" (' + r2.all.length + ')');
    // a guest world: blocks only
    VR.Favs.add('blueprint_6');
    const r3 = BH.ringList({ guest: true });
    check(r3.slots.every(s => s.id[0] === 'b'), 'a guest world: blocks only');
    // the plan a Ding becomes
    check(BH.kindOf('h:6') === 'house' && BH.kindOf('m:vm_bench') === 'model' && BH.kindOf('f:park:#1') === 'forge' && BH.kindOf('p:x') === 'piece' && BH.kindOf('b:stone') === 'block', 'kindOf: house · model · forge · piece · block');
  }
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

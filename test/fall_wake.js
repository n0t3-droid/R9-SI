// A waterfall that wakes up pours on down — it does not grow sideways in mid-air (t-land C2).
// The sky islands' falls (gen_realm.js: a spring on the rim, a 2×2 curtain of falling water down to the ground) sleep
// until a block next to them changes — a covered grass block turning to dirt on a random tick is enough, or a player's
// block. The fluid step then spread every falling block of the curtain sideways (level 8 → 1 into the air), each new
// block fell and spread again: in a minute the curtain grew into a hanging cone of water as wide as its island
// (test/shots/land_far_3_after.png of run 1; in node, the game's Sim on the generated chunks round that camera put
// 200 000 blocks of water into the air in 1200 ticks). A falling block over its own fluid spreads no more; over ground
// it still spreads (the puddle at the foot of a fall), and a spring on a flat top still flows out.
//   node test/fall_wake.js        (the game's sim.js on a small fake world, like doors_node.js)
const ROOT = require('path').join(__dirname, '..');
const VR = require(ROOT + '/test/load_shared.js');
globalThis.window = globalThis; globalThis.document = { getElementById: () => null, addEventListener() {} };
require(ROOT + '/src/main/sim.js');
const R = VR.R;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const S = (n) => R.byName[n].defaultState;
const nameOf = (s) => (s ? R.types[R.T.type[s]].name : 'air');

function makeWorld() {
  const blocks = new Map(), K = (x, y, z) => x + ',' + y + ',' + z;
  const world = {
    listeners: [], blocks,
    getBlock: (x, y, z) => blocks.get(K(x, y, z)) || 0,
    setBlock(x, y, z, s, flags) { const old = this.getBlock(x, y, z); if (old === s) return false; if (s) blocks.set(K(x, y, z), s); else blocks.delete(K(x, y, z)); if (!(flags & 2)) for (const l of this.listeners) l.onBlockChanged(x, y, z, old, s); return true; },
    getLight: () => 15 << 12, col: () => null, isLoaded: () => true,
  };
  const game = { world, settings: {}, mp: null, skyBright: 1, env: { rain: 0 }, dim: 'overworld', player: { pos: [0, 70, 0], mode: 'creative' },
    audio: { play() {}, place() {} }, particles: { breakBlock() {}, spark() {}, smoke() {}, glow() {} }, dropsFor() {}, dropStack() {}, entities: { spawnFalling() {}, mobs: [] },
    onBlockChanged(x, y, z, old, s) { this.sim.onBlockChanged(x, y, z, old, s); } };
  game.sim = new VR.Sim(game);
  game.sim.randomTicks = () => {};   // (the scheduled ticks only: the wake is made by hand below)
  world.listeners.push(game);
  return { world, game };
}
const water = (W, fn) => { let n = 0; for (const [k, s] of W.blocks) { if (nameOf(s) !== 'water') continue; const [x, y, z] = k.split(',').map(Number); if (!fn || fn(x, y, z)) n++; } return n; };

// ---------------------------------------------------------------- an island's fall, as gen_realm lays it
console.log('1 · a sky island\'s fall, woken by a block that changes beside it');
for (const wake of ['the rim', 'the curtain', 'its foot']) {
  const { world: W, game: G } = makeWorld();
  const TOP = 100, GROUND = 64;
  for (let x = -12; x <= 12; x++) for (let z = -12; z <= 12; z++) W.setBlock(x, GROUND, z, S('stone'), 2);
  for (let x = -4; x <= 3; x++) for (let z = -4; z <= 4; z++) { W.setBlock(x, TOP - 1, z, S('stone'), 2); W.setBlock(x, TOP, z, S('grass_block'), 2); }
  // the spring pool on the rim (2×2 sources in the top layer) and the curtain just outside it (2×2, level 8 to the ground)
  const fall = S('water'), fallT = R.types[R.T.type[fall]];
  for (const z of [0, 1]) { W.setBlock(3, TOP, z, fall, 2); for (let y = TOP; y > GROUND; y--) W.setBlock(4, y, z, fallT.state({ level: 8 }), 2); }
  for (const z of [0, 1]) for (let y = TOP; y > GROUND; y--) W.setBlock(5, y, z, 0, 2);
  const before = water(W);
  // the wake: a covered grass block on the rim turns to dirt (a random tick), or a block set beside the curtain and taken away
  if (wake === 'the rim') W.setBlock(3, TOP, 2, S('dirt'), 1);
  else { const y = wake === 'its foot' ? GROUND + 1 : 82; W.setBlock(5, y, 0, S('stone'), 0); W.setBlock(5, y, 0, 0, 0); }
  for (let t = 0; t < 900; t++) G.sim.step(false);
  const midAir = water(W, (x, y, z) => y > GROUND + 2 && y < TOP - 1 && !(x === 4 && (z === 0 || z === 1)));
  const foot = water(W, (x, y) => y === GROUND + 1);
  const all = water(W);
  check(midAir === 0, `woken at ${wake}: no water grows in mid-air beside the curtain (${midAir} blocks; the curtain 2 × ${TOP - GROUND} and its spring: ${before} blocks before, ${all} after 45 s)`);
  if (wake === 'its foot') check(foot >= 12 && foot <= 150, `woken at ${wake}: the fall still spreads on the ground — a puddle, not a flood (${foot} blocks)`);
}

// ---------------------------------------------------------------- the ordinary flows stay as they were
console.log('2 · water still flows as before');
{
  const { world: W, game: G } = makeWorld();
  for (let x = -10; x <= 10; x++) for (let z = -10; z <= 10; z++) W.setBlock(x, 64, z, S('stone'), 2);
  W.setBlock(0, 65, 0, S('water'), 0);   // a source placed on flat ground (a player's bucket)
  for (let t = 0; t < 400; t++) G.sim.step(false);
  const n = water(W, (x, y) => y === 65);
  check(n >= 60 && n <= 113, `a source on flat ground spreads to a puddle of radius 7 (${n} blocks)`);
  // a source on a ledge: it flows over the edge and falls to the ground, where it spreads again
  const { world: W2, game: G2 } = makeWorld();
  for (let x = -10; x <= 10; x++) for (let z = -10; z <= 10; z++) W2.setBlock(x, 60, z, S('stone'), 2);
  for (let x = -10; x <= 0; x++) for (let z = -10; z <= 10; z++) W2.setBlock(x, 70, z, S('stone'), 2);
  W2.setBlock(-1, 71, 0, S('water'), 0);
  for (let t = 0; t < 600; t++) G2.sim.step(false);
  const fell = water(W2, (x, y) => x >= 1 && y > 61 && y <= 70), ground = water(W2, (x, y) => y === 61);
  check(fell >= 9 && fell <= 40 && ground >= 10 && ground <= 150, `a source on a ledge pours over its edge — one column, not a wall (${fell} falling blocks) — and spreads on the ground below (${ground})`);
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

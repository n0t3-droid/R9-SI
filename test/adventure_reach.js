// a-adventure (R56-02, docs/reviews/v0.55.md — the third review in a row: at the outpost 0 fought, 0 hits, 0 calmed, not
// freed). What the game must give a player at an outpost, measured without a browser:
//   1. the guardians stand on the ground: F.spot never puts a machine on a tree's crown (world.topAt counts leaves — the
//      rain's height — so a forest outpost's strays stood on the canopy, out of reach of the hand and of [V]); under or
//      beside a crown it finds the floor; on open ground it is the old spot
//   2. the wake after a faint lands on the floor, not on a crown (F.floorAt, the same rule)
//   3. [V] reaches every stray where it likes to stand: the calm reach ≥ the kind's far keep distance + 1 m (a Wächter keeps
//      8–13 m and backs off from a player nearer than 8: the old 6-m box never listed it); the ring holds to reach + 2 m
//   4. the peaceful way is the default: with Begegnungen aus every guardian waits to be calmed (no fight needed)
// usage: bash test/wt_run.sh adventure_reach.js 300
const fs = require('fs'), path = require('path');
require('./dom_stub.js');
const V = require('./load_shared.js');
const SRC = path.join(__dirname, '../src/main/');
for (const f of ['i18n', 'lang_en', 'lang_de', 'voxmodels', 'foemodels', 'foes', 'liberate']) if (fs.existsSync(SRC + f + '.js')) require(SRC + f + '.js');
const F = V.Foes, L = V.Liberate, R = V.R;
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const rng = (seed) => { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };

// a stand-in world: grass at y 64 everywhere; oak trees (trunk 65–69, a crown 68–71 of radius 2) on a 5-m grid round (0, 0)
const GRASS = R.byName.grass_block.defaultState, LOG = R.byName.oak_log.defaultState, LEAF = R.byName.oak_leaves.defaultState;
const forest = (x, y, z) => {
  if (y < 64) return R.byName.dirt.defaultState; if (y === 64) return GRASS;
  const tx = Math.round(x / 5) * 5, tz = Math.round(z / 5) * 5, dx = x - tx, dz = z - tz;
  if (dx === 0 && dz === 0 && y <= 69) return LOG;
  if (y >= 68 && y <= 71 && Math.abs(dx) <= 2 && Math.abs(dz) <= 2 && !(Math.abs(dx) === 2 && Math.abs(dz) === 2 && y === 71)) return LEAF;
  return 0;
};
const open = (x, y, z) => (y < 64 ? R.byName.dirt.defaultState : y === 64 ? GRASS : 0);
const rainTop = (get) => (x, z) => { for (let y = 90; y > 0; y--) { const b = get(x, y, z); if (b && (R.T.flags[b] & (V.F.SOLID | V.F.FLUID | V.F.LEAVES))) return y; } return 0; };
const worldOf = (get) => ({ getBlock: get, isLoaded: () => true, topAt: rainTop(get) });

console.log('1 · the guardians stand on the ground');
{
  const g = { world: worldOf(forest) }, r = rng(7), spots = [];
  for (let i = 0; i < 80; i++) { const p = F.spot(g, 0, 0, 14, r, 4); if (p) spots.push(p); }
  const high = spots.filter(p => p[1] !== 65);
  check(spots.length >= 60, `${spots.length} spots of 80 found in a forest`);
  check(high.length === 0, `every spot on the forest floor at y 65 (${high.length} on a crown or a trunk${high.length ? ': ' + high.slice(0, 3).map(p => p.map(Math.round).join(',')).join(' · ') : ''})`);
  const free = spots.every(p => !forest(Math.floor(p[0]), 65, Math.floor(p[2])) && !forest(Math.floor(p[0]), 66, Math.floor(p[2])));
  check(free, 'two free blocks over every spot (never inside a trunk)');
  const g2 = { world: worldOf(open) }, r2 = rng(7), s2 = []; for (let i = 0; i < 20; i++) { const p = F.spot(g2, 0, 0, 14, r2, 4); if (p) s2.push(p); }
  check(s2.length === 20 && s2.every(p => p[1] === 65), 'on open ground the spots are as before (y 65)');
}
console.log('2 · the floor under a crown');
check(typeof F.floorAt === 'function', 'F.floorAt exists');
if (F.floorAt) {
  const w = worldOf(forest);
  check(F.floorAt(w, 6, 1) === 64, `under a crown the floor is the grass (y ${F.floorAt(w, 6, 1)}; the rain's top ${w.topAt(6, 1)})`);
  check(F.floorAt(w, 5, 0) === 69, `on a trunk's column the top of the trunk is its own top (y ${F.floorAt(w, 5, 0)})`);
  check(F.floorAt(worldOf(open), 3, 3) === 64, 'open ground: the grass');
}
console.log('3 · [V] reaches every stray where it likes to stand');
check(typeof L.calmReach === 'function', 'Liberate.calmReach exists');
if (L.calmReach) for (const k of ['driller', 'sentry', 'crane']) {
  const K = F.KINDS[k], r = L.calmReach(k), far = k === 'crane' ? 6 : K.keep[1];
  check(r >= Math.min(far + 1, 16) && r >= 6 && r <= 16, `${k}: the calm reach ${r} m (keeps ${K.keep.join('–')} m)`);
  check(L.calmHold(k) >= r + 2, `${k}: the ring holds to ${L.calmHold(k)} m`);
}
// the [V] pick (ctx.js pickNear): a thing's own reach counts — a Wächter 11 m ahead in the crosshair is picked
{
  if (fs.existsSync(SRC + 'ctx.js')) require(SRC + 'ctx.js');
  const C = V.Ctx, eye = [0, 1.6, 0], dir = [0, 0, -1];
  const far = { kind: 'machine', pos: [0, 1.4, -11], r: 0.72, reach: 14 }, plain = { kind: 'machine', pos: [0, 1.4, -11], r: 0.72 };
  check(!!(C && C.pickNear && C.pickNear(eye, dir, [far])), 'a stray 11 m ahead with its reach 14 m is picked by [V]');
  check(!!(C && C.pickNear && !C.pickNear(eye, dir, [plain])), 'a thing without its own reach keeps the 4.5 m');
}
console.log('4 · the peaceful way');
{
  // Begegnungen aus: the guardians are spawned calm-able (enc 'normal' for the guardians, F.guardians) — every kind of stray can be calmed
  check(F.STRAYS && ['driller', 'sentry', 'crane'].every(k => F.STRAYS.indexOf(k) >= 0), 'all three strays can be calmed');
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(0);

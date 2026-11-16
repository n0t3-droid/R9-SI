// f-spawn · VR.PlaceSense (src/main/placesense.js): one sense of place for everything that appears by itself.
// A made-up world of columns (the real registry): a meadow, a house with a roof, a tree, a city plaza with lawn beds,
// a pond, a bridge, a ledge.
//   a  ground: under leaves and plants; null where nothing is loaded
//   b  a meadow is a place for a wild animal; its y is the ground's
//   c  never on a roof, never on a crown (the ground under the tree instead), never in water, never under a bridge
//   d  a lawn bed between pavements is not wild land (built-up ring); the same lawn in open country is
//   e  a ledge (a step of more than a block beside it) is no place to stand; level ground is
//   f  lawn() wants grass: sand is wild ground but no lawn
const V = require('./load_shared.js');
require('../src/main/placesense.js');
const PL = V.PlaceSense, R = V.R;
let fails = 0;
const check = (ok, msg) => { console.log((ok ? '  ✓ ' : '  ✗ ') + msg); if (!ok) fails++; };
const st = (n) => { const t = R.byName[n]; if (!t) throw new Error('no block ' + n); return t.defaultState; };
const GRASS = st('grass_block'), DIRT = st('dirt'), SAND = st('sand'), STONE = st('stone'), PLANKS = st('oak_planks'), BRICK = st('stone_bricks'),
  LEAVES = st('oak_leaves'), LOG = st('oak_log'), WATER = st('water'), FLOWER = st('poppy');
// the world: a map "x,z" → array of blocks from y = 0 up
const cols = new Map();
const col = (x, z) => cols.get(x + ',' + z);
const put = (x, z, arr) => cols.set(x + ',' + z, arr);
const W = {
  isLoaded: (x, z) => cols.has(x + ',' + z),
  topAt: (x, z) => { const c = col(x, z); let y = c.length - 1; while (y > 0 && !c[y]) y--; return y; },
  getBlock: (x, y, z) => { const c = col(x, z); return c && y >= 0 && y < c.length ? c[y] : 0; },
};
const ground = (h, top) => { const a = []; for (let y = 0; y < h; y++) a.push(STONE); a.push(top); return a; };
// open meadow everywhere first (x, z in −40…40), ground top at y = 10
for (let x = -40; x <= 40; x++) for (let z = -40; z <= 40; z++) put(x, z, ground(10, GRASS));
// a flower on the meadow at (3, 3)
col(3, 3).push(FLOWER);
// a house at x 10…16, z 10…16: plank floor at y = 10, walls, a plank roof at y = 15
for (let x = 10; x <= 16; x++) for (let z = 10; z <= 16; z++) { const a = ground(10, PLANKS); for (let y = 11; y < 15; y++) a.push((x === 10 || x === 16 || z === 10 || z === 16) ? PLANKS : 0); a.push(PLANKS); put(x, z, a); }
// a tree at (−10, −10): trunk 4 high, a 5 × 5 crown of leaves two layers thick
for (let x = -12; x <= -8; x++) for (let z = -12; z <= -8; z++) { const a = ground(10, GRASS); for (let y = 11; y < 15; y++) a.push(x === -10 && z === -10 ? LOG : 0); a.push(LEAVES); a.push(LEAVES); put(x, z, a); }
// a city plaza at x −30…−12, z 12…30: stone-brick paving with a 3 × 3 lawn bed at (−21, 21)
for (let x = -30; x <= -12; x++) for (let z = 12; z <= 30; z++) put(x, z, ground(10, (Math.abs(x + 21) <= 1 && Math.abs(z - 21) <= 1) ? GRASS : BRICK));
// a pond at x 20…30, z −30…−20: sand bed at y = 8, two of water
for (let x = 20; x <= 30; x++) for (let z = -30; z <= -20; z++) { const a = ground(8, SAND); a.push(WATER); a.push(WATER); put(x, z, a); }
// a bridge over the meadow at z = −35, x −5…5: planks at y = 14
for (let x = -5; x <= 5; x++) { const a = ground(10, GRASS); a.push(0, 0, 0); a.push(PLANKS); put(x, -35, a); }
// a ledge: the meadow three blocks higher for x ≥ 30 (z 0…10)
for (let x = 30; x <= 40; x++) for (let z = 0; z <= 10; z++) put(x, z, ground(13, GRASS));
// a beach: sand at x −40…−34, z −40…−34
for (let x = -40; x <= -34; x++) for (let z = -40; z <= -34; z++) put(x, z, ground(10, SAND));

console.log('a  ground');
check(PL.ground(W, 0, 0) === 10, 'the meadow: the grass block');
check(PL.ground(W, 3, 3) === 10, 'under a flower: the grass, not the flower');
check(PL.ground(W, -11, -11) === 10, 'under a crown: the grass, not the leaves');
check(PL.ground(W, 999, 999) === null, 'not loaded: null');
console.log('b  a meadow');
check(PL.wild(W, 0, 0) === 10, 'open meadow: yes, at the ground');
check(PL.wild(W, -11, -9) === 10, 'under the crown beside the trunk: the forest floor');
console.log('c  never on a roof, a crown, in water, under a bridge');
check(PL.wild(W, 13, 13) === null, 'the house: no (a floor under a roof)');
check(W.topAt(13, 13) === 15 && PL.ground(W, 13, 13) === 15, '(the house column\'s top is its roof)');
check(PL.wild(W, 25, -25) === null, 'the pond: no');
check(PL.wild(W, 0, -35) === null, 'under the bridge: no (a roof over the grass)');
check(PL.wild(W, -10, -10) === null, 'the trunk\'s own column: no (wood, not ground)');
console.log('d  a lawn bed between pavements');
const bed = PL.sense(W, -21, 21);
check(bed && bed.nat && bed.grass && bed.built > 0.5, 'the bed is grass, its ring mostly built (' + (bed ? bed.built.toFixed(2) : '-') + ')');
check(PL.wild(W, -21, 21) === null, 'no wild animal on a city lawn bed');
check(PL.sense(W, 0, 0).built === 0, 'open country: nothing built round it');
console.log('e  a ledge');
check(PL.wild(W, 29, 5) === null && PL.wild(W, 30, 5) === null, 'beside a three-block step: no');
check(PL.wild(W, 35, 5) === 13, 'on the level ground above: yes');
console.log('f  lawn wants grass');
check(PL.wild(W, -37, -37) === 10 && PL.lawn(W, -37, -37) === null, 'sand: wild ground, no lawn');
check(PL.lawn(W, 0, 0) === 10, 'the meadow: a lawn');
console.log('g  near(): the ground at a walker\'s own height (a visitor at the door, a farm animal at its anchor)');
// a low cottage at x 10…16, z −16…−10: floor y = 10, two cells of room, its roof at y = 13 (three above the floor)
for (let x = 10; x <= 16; x++) for (let z = -16; z <= -10; z++) { const a = ground(10, PLANKS); a.push((x === 10 || x === 16 || z === -16 || z === -10) ? PLANKS : 0); a.push((x === 10 || x === 16 || z === -16 || z === -10) ? PLANKS : 0); a.push(PLANKS); put(x, z, a); }
check(typeof PL.near === 'function', 'PL.near exists');
if (typeof PL.near === 'function') {
  const yard = PL.near(W, 8, -13, 11, 3), inside = PL.near(W, 13, -13, 11, 3), tall = PL.near(W, 13, 13, 11, 3);
  check(yard && yard.y === 10 && !yard.roofed && yard.room && !yard.wet, 'the yard beside the cottage: the grass, open sky, room');
  check(inside && inside.y === 10 && inside.roofed, 'inside the low cottage (roof 3 above the floor): its floor under a roof — never the roof (' + (inside && inside.y) + ')');
  check(tall && tall.y === 10 && tall.roofed, 'inside the tall house: its floor under a roof');
  check(PL.sense(W, 13, -13).y === 13, '(sense() answers the roof there — a walker at door height must ask near())');
  const pond = PL.near(W, 25, -25, 11, 3);
  check(pond && pond.wet, 'the pond: wet');
  const crown = PL.near(W, -11, -11, 11, 3);
  check(crown && crown.y === 10 && !crown.roofed && crown.room, 'under the tree\'s crown: the forest floor, not roofed (leaves are no roof)');
  const br = PL.near(W, 0, -35, 11, 3);
  check(br && br.y === 10 && br.roofed, 'under the bridge: the grass, roofed');
  check(PL.near(W, 0, -35, 15, 2) && PL.near(W, 0, -35, 15, 2).y === 14, 'on the bridge (a walker at deck height): the deck');
  check(PL.near(W, 35, 5, 11, 2) === null, 'a ground three blocks higher than the walker with a tolerance of two: nothing');
  check(PL.near(W, 999, 999, 11, 3) === null, 'not loaded: null');
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

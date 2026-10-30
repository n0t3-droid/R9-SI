// Generated terrain must not change when the generator's loops are tuned: the blocks, biomes and tints of columns
// of every world kind (a vgen-5 world with the Heartland city and a modern town, a vgen-1 world, a single-biome
// world, the Drift) are hashed and compared with what the v0.39 generator made. The hash moves only when the
// terrain changes on purpose — then record the new one with --write.
//   bash test/wt_run.sh gen_same.js
const V = require('./load_shared.js');
const EXPECT = '3b54af9e';
const fnv = (h, a) => { for (let i = 0; i < a.length; i++) { h ^= a[i]; h = Math.imul(h, 16777619) >>> 0; } return h; };
const scenes = [
  ['vgen 5 · near the Heartland city', V.makeGen('overworld', 12345, { vgen: 5 }), [[0, 0], [1, -13], [2, -13], [1, -12], [-3, 2], [7, 7]]],
  ['vgen 5 · a modern town, seed 4242', V.makeGen('overworld', 4242, { vgen: 5 }), [[0, 0], [1, 0], [0, 1], [-2, -2], [12, -9]]],
  ['vgen 5 · far land and sea', V.makeGen('overworld', 12345, { vgen: 5 }), [[-26, 8], [40, 40], [-60, 25], [100, -100]]],
  ['vgen 1 · an old world', V.makeGen('overworld', 777, { vgen: 1 }), [[0, 0], [3, -3], [-8, 5]]],
  ['single biome (jungle)', V.makeGen('overworld', 99, { vgen: 5, worldType: 'single', biome: 'jungle' }), [[0, 0], [2, 2]]],
  ['the Drift', V.makeGen('drift', 12345, {}), [[0, 0], [1, 1], [-4, 3]]],
];
let h = 2166136261 >>> 0, n = 0, blocksN = 0;
const t0 = performance.now();
for (const [name, g, cols] of scenes) {
  let hs = 2166136261 >>> 0;
  for (const [cx, cz] of cols) {
    const c = g.generate(cx, cz);
    hs = fnv(hs, c.blocks); if (c.biome) hs = fnv(hs, c.biome); if (c.caveBiome) hs = fnv(hs, c.caveBiome);
    if (c.tints) { hs = fnv(hs, c.tints.grass); hs = fnv(hs, c.tints.foliage); hs = fnv(hs, c.tints.water); }
    for (let i = 0; i < c.blocks.length; i++) if (c.blocks[i]) blocksN++;
    n++;
  }
  console.log(`     ${name}: ${cols.length} columns, hash ${hs.toString(16).padStart(8, '0')}`);
  h = fnv(h, [hs & 0xffff, hs >>> 16]);
}
const hex = h.toString(16).padStart(8, '0');
console.log(`${n} columns, ${blocksN} blocks, ${(performance.now() - t0).toFixed(0)} ms cold · hash ${hex}`);
// vgen 12 (t-polish2: Weißstadt's polished nave floor) has its own pin — the scenes above keep EXPECT: seed 53's hall city,
// four chunks over its street and plaza (the cells only vgen 12 lays in porcelain and andesite)
const EXPECT12 = 'b59b0b12';
let h12 = 2166136261 >>> 0;
{ const g12 = V.makeGen('overworld', 53, { vgen: 12 }); for (const [cx, cz] of [[-59, -19], [-60, -19], [-61, -19], [-59, -18]]) { const c = g12.generate(cx, cz); h12 = fnv(h12, c.blocks); if (c.biome) h12 = fnv(h12, c.biome); } }
const hex12 = h12.toString(16).padStart(8, '0');
console.log(`     vgen 12 · Weißstadt's nave, seed 53: 4 columns, hash ${hex12}`);
// vgen 13 (f-arrival: the trees' tops on their crowns, the vistas' views cleared as cones, the frames out of the eye's
// face) has its own pin: seed 53's arrival — four chunks along the temple vista's cone — and two of seed 4242's woods (a
// spruce stand on the ridge, a cherry grove)
const EXPECT13 = 'a6bd3215';
let h13 = 2166136261 >>> 0;
{ for (const [seed, cols] of [[53, [[18, -12], [16, -11], [13, -10], [11, -8]]], [4242, [[-40, -2], [-24, 7]]]]) { const g13 = V.makeGen('overworld', seed, { vgen: 13 }); for (const [cx, cz] of cols) { const c = g13.generate(cx, cz); h13 = fnv(h13, c.blocks); if (c.biome) h13 = fnv(h13, c.biome); } } }
const hex13 = h13.toString(16).padStart(8, '0');
console.log(`     vgen 13 · seed 53's arrival cone and seed 4242's woods: 6 columns, hash ${hex13}`);
// vgen 14 (t-hangar: the Gate Temple's dark stone, gatehouse and gate glow, the Hangar Hall's bay, coffer, navy lining,
// screens and consoles) has its own pin: six chunks of seed 4242's temple — and the same six chunks of a vgen-13 world
// pinned beside it (the temple as v0.51 built it: c9f35c0a, recorded from the base build before t-hangar)
const T14 = [[0, -1], [0, 1], [-1, 0], [0, -3], [3, 0], [-2, -2]], EXPECT14 = 'a081e5c3', EXPECT13T = 'c9f35c0a';
const pinT = (vg) => { let h = 2166136261 >>> 0; const g = V.makeGen('overworld', 4242, { vgen: vg }); for (const [cx, cz] of T14) h = fnv(h, g.generate(cx, cz).blocks); return h.toString(16).padStart(8, '0'); };
const hex14 = pinT(14), hex13T = pinT(13);
console.log(`     vgen 14 · seed 4242's Gate Temple and Hangar Hall: 6 columns, hash ${hex14} (vgen 13 there: ${hex13T})`);
if (process.argv.includes('--write')) { console.log('record in test/gen_same.js: EXPECT =', JSON.stringify(hex), '· EXPECT12 =', JSON.stringify(hex12), '· EXPECT13 =', JSON.stringify(hex13), '· EXPECT14 =', JSON.stringify(hex14)); process.exit(0); }
const ok = hex === EXPECT, ok12 = hex12 === EXPECT12, ok13 = hex13 === EXPECT13 && hex13T === EXPECT13T, ok14 = hex14 === EXPECT14;
console.log(ok ? '  ✓ the generated terrain is the same as before' : `  ✗ the terrain changed (expected ${EXPECT})`);
console.log(ok12 ? '  ✓ vgen 12\'s hall city is as pinned' : `  ✗ vgen 12's hall city changed (expected ${EXPECT12})`);
console.log(ok13 ? '  ✓ vgen 13\'s arrival cone and woods are as pinned (and its temple as v0.51 built it)' : `  ✗ vgen 13's arrival cone, woods or temple changed (expected ${EXPECT13}, ${EXPECT13T})`);
console.log(ok14 ? '  ✓ vgen 14\'s Gate Temple and Hangar Hall are as pinned' : `  ✗ vgen 14's temple changed (expected ${EXPECT14})`);
const nf = (ok ? 0 : 1) + (ok12 ? 0 : 1) + (ok13 ? 0 : 1) + (ok14 ? 0 : 1);
console.log(nf ? 'FAILED ' + nf : 'ALL OK');
process.exit(nf ? 1 : 0);

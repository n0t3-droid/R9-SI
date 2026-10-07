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
if (process.argv.includes('--write')) { console.log('record in test/gen_same.js: EXPECT =', JSON.stringify(hex)); process.exit(0); }
const ok = hex === EXPECT;
console.log(ok ? '  ✓ the generated terrain is the same as before' : `  ✗ the terrain changed (expected ${EXPECT})`);
console.log(ok ? 'ALL OK' : 'FAILED 1');
process.exit(ok ? 0 : 1);

// The land between (t-land, vgen 10) leaves every older world as it was: the Heartland's chunks of a vgen-9 world (the
// default of v0.44) and a vgen-8 world are hashed — blocks, biomes, tints, spawns — and compared with the hashes taken
// before the land layer existed. Only modified columns are saved (storage.js), so a changed vgen-9 generator would grow
// woods and paths beside a player's saved columns: the land is vgen 10 only.
//   bash test/wt_run.sh land_v9_same.js 600        (--write records new hashes, only on purpose)
const V = require('./load_shared.js');
const EXPECT = { v9: '286b5b76', v8: 'b9e64d28' };
const fnv = (h, a) => { for (let i = 0; i < a.length; i++) { h ^= a[i]; h = Math.imul(h, 16777619) >>> 0; } return h; };
const str = (h, s) => { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; };
// the land between the sites (west, north, north-east, east, the lake, the river's course), the temple, the city's
// edges, the hills, the canyon, the citadel and the station
const COLS = [[0, 0], [-9, -6], [8, -6], [0, -20], [20, -15], [-30, 3], [-5, -35], [20, 6], [0, 20], [-26, 24], [33, -12], [-24, -9], [19, -18], [21, -9], [-36, 4], [-10, -30]];
const scene = (vgen) => {
  const g = V.makeGen('overworld', 4242, { vgen });
  let h = 2166136261 >>> 0;
  for (const [cx, cz] of COLS) {
    const c = g.generate(cx, cz);
    h = fnv(h, c.blocks); if (c.biome) h = fnv(h, c.biome);
    if (c.tints) { h = fnv(h, c.tints.grass); h = fnv(h, c.tints.foliage); h = fnv(h, c.tints.water); }
    if (c.spawns) h = str(h, JSON.stringify(c.spawns));
  }
  return h.toString(16).padStart(8, '0');
};
const t0 = Date.now();
const got = { v9: scene(9), v8: scene(8) };
console.log(`  vgen 9: ${got.v9} · vgen 8: ${got.v8} (${COLS.length} columns each, ${Date.now() - t0} ms)`);
if (process.argv.includes('--write')) { console.log('record in test/land_v9_same.js: EXPECT =', JSON.stringify(got)); process.exit(0); }
let fails = 0;
for (const k of ['v9', 'v8']) { const ok = got[k] === EXPECT[k]; if (!ok) fails++; console.log(ok ? `  ✓ the ${k} Heartland is the same as before the land layer` : `  ✗ the ${k} Heartland changed (expected ${EXPECT[k]})`); }
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

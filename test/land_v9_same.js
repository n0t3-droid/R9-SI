// The land between (t-land, vgen 10) leaves every older world as it was: the Heartland's chunks of a vgen-9 world (the
// default of v0.44) and a vgen-8 world — blocks, biomes, tints, spawns — and their horizon tiles (lod.js) are hashed
// twice: here with the shared code as built, and in a second node with the same code but without gen_land.js. Only
// modified columns are saved (storage.js), so a changed vgen-9 generator would grow woods and paths beside a player's
// saved columns: the land is vgen 10 only. (The hashes are compared, not pinned: other fronts may change vgen 9 on
// purpose, the land layer may not.)
//   bash test/wt_run.sh land_v9_same.js 900
const { execFileSync } = require('child_process');
const COLS = [[0, 0], [-9, -6], [8, -6], [0, -20], [20, -15], [-30, 3], [-5, -35], [20, 6], [0, 20], [-26, 24], [33, -12], [-24, -9], [19, -18], [21, -9], [-36, 4], [-10, -30], [-38, -20], [27, -33]];
const TILES = [[0, -4, -4], [0, 3, -2], [1, -3, 0], [2, 0, -1], [3, -1, -1]];   // [level, tx, tz]
const hashes = () => {
  const V = require('./load_shared.js');
  const fnv = (h, a) => { for (let i = 0; i < a.length; i++) { h ^= a[i]; h = Math.imul(h, 16777619) >>> 0; } return h; };
  const str = (h, s) => { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; };
  const out = {};
  for (const vgen of [9, 8]) {
    const g = V.makeGen('overworld', 4242, { vgen });
    let h = 2166136261 >>> 0;
    for (const [cx, cz] of COLS) {
      const c = g.generate(cx, cz);
      h = fnv(h, c.blocks); if (c.biome) h = fnv(h, c.biome);
      if (c.tints) { h = fnv(h, c.tints.grass); h = fnv(h, c.tints.foliage); h = fnv(h, c.tints.water); }
      if (c.spawns) h = str(h, JSON.stringify(c.spawns));
    }
    out['chunks_v' + vgen] = h.toString(16).padStart(8, '0');
    let ht = 2166136261 >>> 0;
    if (V.LOD && V.LOD.build) for (const [level, tx, tz] of TILES) { const t = V.LOD.build(g, { level, tx, tz }); if (!t) continue; for (const k of Object.keys(t).sort()) { const v = t[k]; if (v instanceof ArrayBuffer) ht = fnv(ht, new Uint8Array(v)); else if (v && v.buffer && v.length !== undefined) ht = fnv(ht, new Uint8Array(v.buffer, v.byteOffset, v.byteLength)); else if (typeof v === 'number') ht = str(ht, k + v); } }
    out['lod_v' + vgen] = ht.toString(16).padStart(8, '0');
  }
  return out;
};
if (process.argv[2] === '--child') { process.stdout.write(JSON.stringify(hashes())); process.exit(0); }
const t0 = Date.now();
const withLand = hashes();
const without = JSON.parse(execFileSync(process.execPath, [__filename, '--child'], { env: Object.assign({}, process.env, { R9_SKIP: 'gen_land' }), maxBuffer: 1 << 20 }).toString());
console.log(`  with gen_land.js: ${JSON.stringify(withLand)}\n  without:          ${JSON.stringify(without)}  (${COLS.length} columns and ${TILES.length} horizon tiles each, ${Date.now() - t0} ms)`);
let fails = 0;
for (const k of Object.keys(without)) { const ok = withLand[k] === without[k]; if (!ok) fails++; console.log(ok ? `  ✓ ${k}: the same with the land layer loaded` : `  ✗ ${k}: the land layer changed it (${withLand[k]} against ${without[k]})`); }
const V = require('./load_shared.js');
const sane = !!V.Land && Object.keys(without).length === 4;
if (!sane) fails++;
console.log(sane ? '  ✓ the land layer is loaded here and left out in the second node' : '  ✗ the comparison is not what it says (gen_land.js missing, or hashes missing)');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

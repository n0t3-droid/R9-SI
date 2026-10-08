// The horizon tiles (src/shared/lod.js LOD.build) must not change when their surface look is shared with ring 1 (F-Far:
// LOD.look is the same per-cell colour code, called from LOD.build and from VR.Far.form). Eight tiles of a new world
// (seed 1, vgen 6: the Heartland's city, temple, canyon, citadel and isles; the procedural land beyond) on the levels
// 0–3 are hashed — vertex bytes, indices, bounds — and compared with the hashes the code wrote before the refactor.
//   bash test/wt_run.sh lod_same.js        (--write prints new hashes: only for a change of the tiles on purpose)
const V = require('./load_shared.js');
const EXPECT = { tiles: 'c3a53fc1' };   // recorded on v042's lod.js (5eff944), before LOD.look
function fnv(h, a) { for (let i = 0; i < a.length; i++) { h ^= a[i]; h = Math.imul(h, 16777619) >>> 0; } return h; }
const g = V.makeGen('overworld', 1, { vgen: 6 });
// level, tx, tz (tile = 32 cells of 4 << level blocks)
const TILES = [[0, 0, -2], [0, 0, 0], [0, 2, 3], [1, -2, 1], [1, 1, 0], [2, 0, 0], [3, -1, -1], [1, 12, -9]];
let h = 2166136261 >>> 0, verts = 0, tris = 0;
const t0 = performance.now();
for (const [level, tx, tz] of TILES) {
  const r = V.LOD.build(g, { level, tx, tz });
  if (!r || r.empty) { h = fnv(h, [level, tx & 0xffff, tz & 0xffff, 0]); continue; }
  h = fnv(h, new Uint8Array(r.verts));
  h = fnv(h, r.idx);
  h = fnv(h, [r.count, Math.round(r.minY * 8) & 0xffff, Math.round(r.maxY * 8) & 0xffff, Math.round(r.bx0) & 0xffff, Math.round(r.bz0) & 0xffff, Math.round(r.bx1) & 0xffff, Math.round(r.bz1) & 0xffff]);
  verts += r.verts.byteLength / 12; tris += r.count / 3;
}
const hex = h.toString(16).padStart(8, '0');
console.log(`${TILES.length} tiles, ${verts} vertices, ${tris} triangles, ${(performance.now() - t0).toFixed(0)} ms · hash ${hex}`);
if (process.argv.includes('--write')) { console.log('record in test/lod_same.js: EXPECT.tiles =', JSON.stringify(hex)); process.exit(0); }
const ok = hex === EXPECT.tiles;
console.log(ok ? '  ✓ the horizon tiles are the same as before' : '  ✗ the horizon tiles changed: ' + hex + ', expected ' + EXPECT.tiles);
console.log(ok ? 'ALL OK' : 'FAILED 1');
process.exit(ok ? 0 : 1);

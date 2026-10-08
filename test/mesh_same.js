// The mesher's output must not change when its inner loops are tuned: every vertex stream (opaque, cutout, trans,
// vx, vxFar) and the visibility mask of 48 sections of three scenes (plain land, the middle of Nova Haven, deep ocean) are hashed
// and compared with the streams the v0.39 mesher wrote. The hash only moves when the mesher's output changes on
// purpose (a new block look, a new vertex layout) — then record the new one here with --write.
//   bash test/wt_run.sh mesh_same.js
const V = require('./load_shared.js');
const PAD = V.MESH_PAD || 1, PS = V.MESH_PS || 18, PSS = PS * PS;
// the hashes moved once, with the trailer's plants (voxplants.js: seven late models): the cutout texture indices after them
// moved up by 7 (the texture word of 36 quads in four sections); the geometry, the other streams and the colours are the
// same, compared word by word. Before that: classic 03c11a5c64, seamless 78cb0c3268. classic: Klassisch v2 (per-block variation, the normal map turning with the tile); the gfx branch's own mesher writes exactly this — the faster mesher keeps it
const EXPECT = { classic: '85e924f064', seamless: 'fd3e627e68' };
function fnv(h, a) { for (let i = 0; i < a.length; i++) { h ^= a[i]; h = Math.imul(h, 16777619) >>> 0; } return h; }
function jobs(opts, CX, CZ) {
  const g = V.makeGen('overworld', 12345, opts);
  const cols = {};
  for (let cz = -1; cz <= 1; cz++) for (let cx = -1; cx <= 1; cx++) { const c = g.generate(CX + cx, CZ + cz); c.light = V.computeColumnLight(c.blocks, true); cols[cx + ',' + cz] = c; }
  const out = [];
  for (let sy = 0; sy < 16; sy++) {
    const blocks = new Uint16Array(PSS * PS), light = new Uint16Array(PSS * PS);
    const gr = new Uint16Array(PSS), fo = new Uint16Array(PSS), wa = new Uint16Array(PSS);
    for (let y = -PAD; y < 16 + PAD; y++) for (let z = -PAD; z < 16 + PAD; z++) for (let x = -PAD; x < 16 + PAD; x++) {
      const wy = sy * 16 + y; const cx = Math.floor(x / 16), cz = Math.floor(z / 16); const c = cols[cx + ',' + cz];
      const lx = ((x % 16) + 16) % 16, lz = ((z % 16) + 16) % 16;
      const pi = (y + PAD) * PSS + (z + PAD) * PS + (x + PAD);
      if (y === 0) { gr[(z + PAD) * PS + x + PAD] = c.tints.grass[lz * 16 + lx]; fo[(z + PAD) * PS + x + PAD] = c.tints.foliage[lz * 16 + lx]; wa[(z + PAD) * PS + x + PAD] = c.tints.water[lz * 16 + lx]; }
      if (wy < 0 || wy > 255) { blocks[pi] = 0; light[pi] = wy > 255 ? 0xf000 : 0; continue; }
      const i = (wy << 8) | (lz << 4) | lx; blocks[pi] = c.blocks[i]; light[pi] = c.light[i];
    }
    out.push({ blocks, light, grass: gr, foliage: fo, water: wa, sy, ox: CX * 16, oz: CZ * 16, smooth: true, fancyLeaves: true, vxLod: true });
  }
  return out;
}
const all = jobs({}, 0, 0).concat(jobs({ vgen: 5 }, 1, -13), jobs({}, -26, 8));   // land, the town, deep ocean
const res = {}, write = process.argv.includes('--write');
let fail = 0;
for (const look of ['classic', 'seamless']) {
  V.setLook(look); V.VX.clearCache();
  let h = 2166136261 >>> 0, verts = 0;
  const t0 = performance.now();
  for (const j of all) {
    const r = V.meshSection(j);
    for (const k of ['opaque', 'cutout', 'trans', 'vx', 'vxFar']) { if (!r[k]) continue; h = fnv(h, r[k]); h = fnv(h, [r[k].length & 0xffff, r[k].length >>> 16]); verts += r[k].length / 8; }
    h = fnv(h, [r.vis & 0xffff]);
  }
  const ms = performance.now() - t0;
  const hex = h.toString(16).padStart(8, '0') + (verts % 256).toString(16).padStart(2, '0');
  res[look] = hex;
  const ok = hex === EXPECT[look];
  if (!ok && !write) fail++;
  console.log(`${look}: ${all.length} sections, ${verts} verts, ${ms.toFixed(0)} ms (cold) · hash ${hex} ${write ? '' : ok ? 'OK' : 'MISMATCH, expected ' + EXPECT[look]}`);
}
if (write) { console.log('record in test/mesh_same.js: EXPECT =', JSON.stringify(res)); process.exit(0); }
console.log(fail ? `  ✗ the mesher output changed in ${fail} of 2 looks` : '  ✓ the mesher writes the same vertices as before');
console.log(fail ? 'FAILED ' + fail : 'ALL OK');
process.exit(fail ? 1 : 0);

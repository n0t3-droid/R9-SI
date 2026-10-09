// The Weißstadt's geometry cost (plan docs/superpowers/plans/2026-10-08-t-town.md): the hall is big but hollow, so a chunk
// column of the hall city must not cost the mesher more than 25 % over a column of the v042 village it replaces. Seed 53,
// the meadow site of cell (−2, −1): every column within 90 blocks of the hall's centre (vgen 9) against every column
// within 60 blocks of the village's (vgen 8), sections y 48–143, the Nahtlos look, the meshing flags of test/mesh_same.js.
// Prints the triangles per column of each stream (opaque, cutout, trans, the VX detail near and its far boxes).
// usage: bash test/wt_run.sh hallcity_cost.js 600
const V = require('./load_shared.js');
const VG = V.VillageGen;
const PAD = V.MESH_PAD || 1, PS = V.MESH_PS || 18, PSS = PS * PS;
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
function measure(vgen, radius) {
  const g = new V.OverworldGen(53, { worldType: 'default', vgen });
  const s = VG.site(g, -2, -1), plan = VG.plan(g, s);
  const keys = [...plan.chunks.keys()].map(k => k.split(',').map(Number)).filter(([cx, cz]) => Math.hypot(cx * 16 + 8 - s.x, cz * 16 + 8 - s.z) <= radius);
  const cache = new Map();
  const col = (cx, cz) => { const k = cx + ',' + cz; let c = cache.get(k); if (!c) { c = g.generate(cx, cz); c.light = V.computeColumnLight(c.blocks, true); cache.set(k, c); } return c; };
  const tris = { opaque: 0, cutout: 0, trans: 0, vx: 0, vxFar: 0 };
  for (const [CX, CZ] of keys) {
    const cols = {}; for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) cols[dx + ',' + dz] = col(CX + dx, CZ + dz);
    for (let sy = 3; sy <= 8; sy++) {
      const blocks = new Uint16Array(PSS * PS), light = new Uint16Array(PSS * PS), gr = new Uint16Array(PSS), fo = new Uint16Array(PSS), wa = new Uint16Array(PSS);
      for (let y = -PAD; y < 16 + PAD; y++) for (let z = -PAD; z < 16 + PAD; z++) for (let x = -PAD; x < 16 + PAD; x++) {
        const wy = sy * 16 + y, cx = Math.floor(x / 16), cz = Math.floor(z / 16), c = cols[cx + ',' + cz];
        const lx = ((x % 16) + 16) % 16, lz = ((z % 16) + 16) % 16, pi = (y + PAD) * PSS + (z + PAD) * PS + (x + PAD);
        if (y === 0) { gr[(z + PAD) * PS + x + PAD] = c.tints.grass[lz * 16 + lx]; fo[(z + PAD) * PS + x + PAD] = c.tints.foliage[lz * 16 + lx]; wa[(z + PAD) * PS + x + PAD] = c.tints.water[lz * 16 + lx]; }
        if (wy < 0 || wy > 255) { light[pi] = wy > 255 ? 0xf000 : 0; continue; }
        const i = (wy << 8) | (lz << 4) | lx; blocks[pi] = c.blocks[i]; light[pi] = c.light[i];
      }
      const r = V.meshSection({ blocks, light, grass: gr, foliage: fo, water: wa, sy, ox: CX * 16, oz: CZ * 16, smooth: true, fancyLeaves: true, vxLod: true });
      for (const k of Object.keys(tris)) if (r[k]) tris[k] += r[k].length / 8 / 2;
    }
  }
  const n = keys.length, per = {}; for (const k of Object.keys(tris)) per[k] = Math.round(tris[k] / n);
  per.near = per.opaque + per.cutout + per.trans + per.vx; per.blocks = per.opaque + per.cutout + per.trans;
  console.log(`  vgen ${vgen}: ${n} columns · triangles per column: near ${per.near} (opaque ${per.opaque}, cutout ${per.cutout}, trans ${per.trans}, vx ${per.vx}) · far vx boxes ${per.vxFar}`);
  return per;
}
V.setLook && V.setLook('seamless');
const a = measure(8, 60), b = measure(9, 90);
const near = b.near / a.near, far = b.vxFar / Math.max(1, a.vxFar), blocks = b.blocks / a.blocks;
console.log(`  hall / village: near ${near.toFixed(2)} · far boxes ${far.toFixed(2)} · the blocks' streams alone ${blocks.toFixed(2)}`);
check(near <= 1.25, `a hall city column costs at most 25 % over a village column (${(100 * near).toFixed(0)} %)`);
check(far <= 1.25, `its far boxes too (${(100 * far).toFixed(0)} %)`);
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

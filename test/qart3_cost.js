// q-art3: the vertex count and mesh time of mesh_same's scenes with the leaf modes (true · 2 Runde Kronen · 6 + Runde Hänge)
// regress: skip  (a measurement, no verdict)
const V = require('./load_shared.js');
const PAD = V.MESH_PAD, PS = V.MESH_PS, PSS = PS * PS;
function jobs(opts, CX, CZ) {
  const g = V.makeGen('overworld', 12345, opts); const cols = {};
  for (let cz = -1; cz <= 1; cz++) for (let cx = -1; cx <= 1; cx++) { const c = g.generate(CX + cx, CZ + cz); c.light = V.computeColumnLight(c.blocks, true); cols[cx + ',' + cz] = c; }
  const out = [];
  for (let sy = 0; sy < 16; sy++) {
    const blocks = new Uint16Array(PSS * PS), light = new Uint16Array(PSS * PS); const gr = new Uint16Array(PSS), fo = new Uint16Array(PSS), wa = new Uint16Array(PSS);
    for (let y = -PAD; y < 16 + PAD; y++) for (let z = -PAD; z < 16 + PAD; z++) for (let x = -PAD; x < 16 + PAD; x++) {
      const wy = sy * 16 + y; const cx = Math.floor(x / 16), cz = Math.floor(z / 16); const c = cols[cx + ',' + cz]; const lx = ((x % 16) + 16) % 16, lz = ((z % 16) + 16) % 16; const pi = (y + PAD) * PSS + (z + PAD) * PS + (x + PAD);
      if (y === 0) { gr[(z + PAD) * PS + x + PAD] = c.tints.grass[lz * 16 + lx]; fo[(z + PAD) * PS + x + PAD] = c.tints.foliage[lz * 16 + lx]; wa[(z + PAD) * PS + x + PAD] = c.tints.water[lz * 16 + lx]; }
      if (wy < 0 || wy > 255) { blocks[pi] = 0; light[pi] = wy > 255 ? 0xf000 : 0; continue; }
      const i = (wy << 8) | (lz << 4) | lx; blocks[pi] = c.blocks[i]; light[pi] = c.light[i];
    }
    out.push({ blocks, light, grass: gr, foliage: fo, water: wa, sy, ox: CX * 16, oz: CZ * 16, smooth: true, vxLod: true });
  }
  return out;
}
V.setLook('seamless'); V.VX.clearCache();
const scenes = { land: jobs({}, 0, 0), forest: jobs({}, 11, 3), hills: jobs({}, -40, 25) };
for (const [n, J] of Object.entries(scenes)) {
  for (const fl of [true, 2, 6]) {
    let v = 0; const t0 = process.hrtime.bigint();
    for (let rep = 0; rep < 3; rep++) for (const j of J) { j.fancyLeaves = fl; const r = V.meshSection(j); if (rep === 0) for (const k of ['opaque', 'cutout', 'trans', 'vx', 'vxFar']) if (r[k]) v += r[k].length / 8; }
    console.log(n, 'fancyLeaves=' + fl, 'verts', v, 'ms/section', (Number(process.hrtime.bigint() - t0) / 1e6 / (3 * J.length)).toFixed(2));
  }
}

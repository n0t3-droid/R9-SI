// q-art4: what Runde Inseln costs and saves — the far tiles' vertices and build time with and without the isles' forms
// (lod.js per level over a ring of tiles round the spawn; far.js ring 1), and the chunk sections of a big isle's rim with
// the blob (mesher bit 16) — the vertex counts are the evidence SwiftShader's frame time cannot resolve
// regress: skip  (a measurement, no verdict)
const V = require('./load_shared.js');
const IS = V.IsleShell;
const g = V.makeGen('overworld', 12345, { vgen: 16 });
V.LOD.setAvg(null);
const vn = (r) => (r && !r.empty ? r.verts.byteLength / 12 : 0), tn = (r) => (r && !r.empty ? r.count / 3 : 0);
for (const L of [-1, 0, 1, 2, 3, 4]) {
  const T = 32 * V.LOD.cell(L); let a = 0, b = 0, ta = 0, tb = 0, nI = 0, xa = 0, xb = 0;
  const R = L <= 0 ? 3 : L >= 4 ? 1 : 2;
  for (let j = -R; j < R; j++) for (let i = -R; i < R; i++) {
    let t0 = process.hrtime.bigint(); const A = V.LOD.build(g, { level: L, tx: i, tz: j }); a += vn(A); xa += tn(A); ta += Number(process.hrtime.bigint() - t0) / 1e6;
    t0 = process.hrtime.bigint(); const B = V.LOD.build(g, { level: L, tx: i, tz: j, isleForm: 1 }); b += vn(B); xb += tn(B); tb += Number(process.hrtime.bigint() - t0) / 1e6;
    nI += IS.anchored(g, i * T, j * T, (i + 1) * T, (j + 1) * T).filter(J => J.r >= IS.minR(L)).length;
  }
  console.log('lod level ' + L + ' (' + (2 * R) ** 2 + ' tiles, ' + nI + ' isles): verts ' + a + ' → ' + b + ' (' + ((b / a - 1) * 100).toFixed(1) + ' %), tris ' + xa + ' → ' + xb + ' (' + ((xb / xa - 1) * 100).toFixed(1) + ' %), build ms ' + ta.toFixed(0) + ' → ' + tb.toFixed(0));
}
{
  let a = 0, b = 0;
  for (let j = -3; j < 3; j++) for (let i = -3; i < 3; i++) { a += vn(V.Far.form(g, { tx: i, tz: j, cell: 2 })); b += vn(V.Far.form(g, { tx: i, tz: j, cell: 2, isleForm: 1 })); }
  console.log('ring 1 (36 forms, 2-block cells): verts ' + a + ' → ' + b + ' (' + ((b / a - 1) * 100).toFixed(1) + ' %)');
}
{
  V.setLook('seamless');
  const PAD = V.MESH_PAD, PS = V.MESH_PS, PSS = PS * PS;
  const big = IS.anchored(g, -1200, -1200, 1200, 1200).filter(I => !I.designed).sort((x, y) => y.r - x.r)[0];
  let a = 0, b = 0;
  for (const [ox, oz] of [[0.75, 0], [-0.75, 0], [0, 0.75], [0, 0]]) {
    const CX = Math.floor((big.x + big.r * ox) / 16), CZ = Math.floor((big.z + big.r * oz) / 16), cols = {};
    for (let cz = -1; cz <= 1; cz++) for (let cx = -1; cx <= 1; cx++) { const c = g.generate(CX + cx, CZ + cz); c.light = V.computeColumnLight(c.blocks, true); cols[cx + ',' + cz] = c; }
    const isle = IS.columns(g, CX * 16, CZ * 16);
    for (let sy = Math.floor((big.y - big.r * 1.2) / 16); sy <= Math.floor((big.y + 8) / 16); sy++) {
      const blocks = new Uint16Array(PSS * PS), light = new Uint16Array(PSS * PS), t = new Uint16Array(PSS).fill(0x4d6a);
      for (let y = -PAD; y < 16 + PAD; y++) for (let z = -PAD; z < 16 + PAD; z++) for (let x = -PAD; x < 16 + PAD; x++) {
        const wy = sy * 16 + y, c = cols[Math.floor(x / 16) + ',' + Math.floor(z / 16)], lx = ((x % 16) + 16) % 16, lz = ((z % 16) + 16) % 16, pi = (y + PAD) * PSS + (z + PAD) * PS + (x + PAD);
        if (wy < 0 || wy > 255) { light[pi] = wy > 255 ? 0xf000 : 0; continue; }
        const i = (wy << 8) | (lz << 4) | lx; blocks[pi] = c.blocks[i]; light[pi] = c.light[i];
      }
      const j = { blocks, light, grass: t, foliage: t, water: t, sy, ox: CX * 16, oz: CZ * 16, smooth: true, vxLod: true };
      const n = (r) => ['opaque', 'cutout', 'trans', 'vx'].reduce((s, k) => s + (r[k] ? r[k].length / 8 : 0), 0);
      a += n(V.meshSection(Object.assign({}, j, { fancyLeaves: 2 }))); b += n(V.meshSection(Object.assign({}, j, { fancyLeaves: 18, isle })));
    }
  }
  console.log('near isle (4 columns of a big isle, its sections): verts ' + a + ' → ' + b + ' (' + ((b / a - 1) * 100).toFixed(1) + ' %)');
}

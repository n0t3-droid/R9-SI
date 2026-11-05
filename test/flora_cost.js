// v-flora · what the bloom costs the mesher (docs/superpowers/plans/2026-11-05-v-flora.md): the same 3×3 chunks of seed 4242
// (the meadow walk by the way, the Traumbaum, the glow ring) meshed for vgen 16 and vgen 17 — the vertices of
// every stream and the time — with Very Low's leaves (fast: fancyLeaves off) and High's (fancy). The flora is blocks
// only: the opaque/cutout streams grow, no new stream, no new program. Bounds: Very Low's meadow walk ≤ 2.2× the
// vertices of vgen 16, the Traumbaum's 3×3 ≤ 3.5× (one spot per region).
//   bash test/wt_run.sh flora_cost.js 300
const V = require('./load_shared.js');
const PAD = V.MESH_PAD || 1, PS = V.MESH_PS || 18, PSS = PS * PS;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
function fnv(h, a) { for (let i = 0; i < a.length; i++) { h ^= a[i]; h = Math.imul(h, 16777619) >>> 0; } return h; }
function jobs(opts, CX, CZ) {
  const g = V.makeGen('overworld', 4242, opts);
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
    out.push({ blocks, light, grass: gr, foliage: fo, water: wa, sy, ox: CX * 16, oz: CZ * 16, smooth: true, fancyLeaves: !!opts.fancy, vxLod: true, smoothProps: 0 });
  }
  return out;
}

const SPOTS = { meadow: [-21, 0], giant: [17, 2], ring: [-14, -12] };
V.setLook('classic');
const res = {};
for (const [name, [CX, CZ]] of Object.entries(SPOTS)) for (const fancy of [false, true]) for (const vgen of [16, 17]) {
  V.VX.clearCache();
  const js = jobs({ vgen, fancy }, CX, CZ);
  const t0 = performance.now(); let verts = 0;
  for (const j of js) { const r = V.meshSection(j); for (const k of ['opaque', 'cutout', 'trans', 'vx', 'vxFar']) if (r[k]) verts += r[k].length / 8; }
  const ms = performance.now() - t0;
  res[name + (fancy ? '.high' : '.vl') + '.' + vgen] = { verts, ms: +ms.toFixed(1) };
}
for (const k of Object.keys(res)) console.log('     ' + k.padEnd(18) + res[k].verts + ' verts, ' + res[k].ms + ' ms');
const q = (n, t) => res[n + '.' + t + '.17'].verts / res[n + '.' + t + '.16'].verts;
check(q('meadow', 'vl') <= 2.2, `Very Low, the meadow walk: ${q('meadow', 'vl').toFixed(2)}× vgen 16's vertices (≤ 2.2)`);
check(q('giant', 'vl') <= 3.5, `Very Low, the Traumbaum: ${q('giant', 'vl').toFixed(2)}× (≤ 3.5)`);
check(q('ring', 'vl') <= 2.2, `Very Low, the glow ring: ${q('ring', 'vl').toFixed(2)}× (≤ 2.2)`);
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);

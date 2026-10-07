// The worker's job handling, run in node with a fake `self`: a mesh job answers with the quads of VR.meshSection
// expanded to triangle lists (0 1 2, 0 2 3) and every buffer transferred; a job that throws answers {type:'error'}
// with its id instead of killing the worker; the quad → triangle expansion matches a reference expansion exactly.
//   bash test/wt_run.sh worker_jobs.js
const V = require('./load_shared.js');
const posted = [];
global.self = { postMessage: (m, tr) => posted.push([m, tr || []]) };
global.performance = global.performance || { now: () => Date.now() };
require('../src/worker/worker_main.js');
let fail = 0;
const check = (ok, what) => { console.log((ok ? 'OK   ' : 'FAIL ') + what); if (!ok) fail++; };
// reference: the expansion the v0.39 worker did with subarray views
function refTris(q) {
  const nq = q.length >> 5, out = new Uint16Array(nq * 48);
  for (let i = 0; i < nq; i++) { const s = i * 32, d = i * 48; out.set(q.subarray(s, s + 24), d); out.set(q.subarray(s, s + 8), d + 24); out.set(q.subarray(s + 16, s + 32), d + 32); }
  return out;
}
const same = (a, b) => { if (!a && !b) return true; if (!a || !b || a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; };
// a padded section of Nova Haven's middle (mini-voxel pieces, glass, plain blocks) and one of the open sea
const PAD = V.MESH_PAD, PS = V.MESH_PS, PSS = PS * PS;
function job(opts, CX, CZ, sy) {
  const g = V.makeGen('overworld', 12345, opts);
  const cols = {};
  for (let cz = -1; cz <= 1; cz++) for (let cx = -1; cx <= 1; cx++) { const c = g.generate(CX + cx, CZ + cz); c.light = V.computeColumnLight(c.blocks, true); cols[cx + ',' + cz] = c; }
  if (sy === undefined) { // the richest section of the column (the most mini-voxel pieces)
    let best = 0, bestN = -1;
    for (let s = 0; s < 16; s++) { const r = V.meshSection(pad(cols, CX, CZ, s)); const n = (r.vx ? r.vx.length : 0) + r.opaque.length; if (n > bestN) { bestN = n; best = s; } }
    sy = best;
  }
  return pad(cols, CX, CZ, sy);
}
function pad(cols, CX, CZ, sy) {
  const blocks = new Uint16Array(PSS * PS), light = new Uint16Array(PSS * PS), gr = new Uint16Array(PSS), fo = new Uint16Array(PSS), wa = new Uint16Array(PSS);
  for (let y = -PAD; y < 16 + PAD; y++) for (let z = -PAD; z < 16 + PAD; z++) for (let x = -PAD; x < 16 + PAD; x++) {
    const wy = sy * 16 + y, cx = Math.floor(x / 16), cz = Math.floor(z / 16), c = cols[cx + ',' + cz], lx = ((x % 16) + 16) % 16, lz = ((z % 16) + 16) % 16, pi = (y + PAD) * PSS + (z + PAD) * PS + (x + PAD);
    if (y === 0) { gr[(z + PAD) * PS + x + PAD] = c.tints.grass[lz * 16 + lx]; fo[(z + PAD) * PS + x + PAD] = c.tints.foliage[lz * 16 + lx]; wa[(z + PAD) * PS + x + PAD] = c.tints.water[lz * 16 + lx]; }
    if (wy < 0 || wy > 255) { light[pi] = wy > 255 ? 0xf000 : 0; continue; }
    const i = (wy << 8) | (lz << 4) | lx; blocks[pi] = c.blocks[i]; light[pi] = c.light[i];
  }
  return { blocks, light, grass: gr, foliage: fo, water: wa, sy, ox: CX * 16, oz: CZ * 16, smooth: true, fancyLeaves: true, vxLod: true };
}
self.onmessage({ data: { type: 'init', seed: 12345, opts: { vgen: 5 } } });
check(posted.length === 1 && posted[0][0].type === 'ready', 'init answers ready');
let id = 10;
for (const [name, j] of [['town section', job({ vgen: 5 }, 1, -13)], ['sea section', job({}, -26, 8, 3)]]) {
  const ref = V.meshSection(Object.assign({}, j));
  const want = { opaque: refTris(ref.opaque), cutout: refTris(ref.cutout), trans: refTris(ref.trans), vx: ref.vx ? refTris(ref.vx) : null, vxFar: ref.vxFar ? refTris(ref.vxFar) : null };
  posted.length = 0;
  const m = Object.assign({ type: 'mesh', id: ++id, key: 7, ver: 3 }, j);
  self.onmessage({ data: m });
  const [r, tr] = posted[0];
  check(r.type === 'mesh' && r.id === id && r.key === 7 && r.sy === j.sy && r.ver === 3 && r.vis === ref.vis, name + ': mesh answer carries id, key, sy, ver, vis');
  for (const k of ['opaque', 'cutout', 'trans', 'vx', 'vxFar']) check(same(r[k], want[k]), `${name}: ${k} = ${want[k] ? want[k].length / 8 : 0} triangle vertices, the reference expansion`);
  const bufs = ['opaque', 'cutout', 'trans', 'vx', 'vxFar'].filter(k => r[k]).map(k => r[k].buffer);
  check(bufs.every(b => tr.includes(b)) && tr.length === bufs.length, name + ': every stream buffer is transferred, nothing else');
  check(r.opaque.length % 48 === 0 && r.opaque.length === ref.opaque.length / 32 * 48, name + ': 6 vertices per quad');
}
// a job that throws inside answers an error with the job id (the pool frees the slot; the section is asked for again)
posted.length = 0;
self.onmessage({ data: { type: 'mesh', id: 99, key: 1, sy: 0, blocks: null } });
check(posted.length === 1 && posted[0][0].type === 'error' && posted[0][0].id === 99, 'a broken job answers {type: error, id} instead of throwing');
// speed: the expansion of a big stream (10k quads) — the reference used three subarray views per quad
{
  const q = new Uint16Array(10000 * 32); for (let i = 0; i < q.length; i++) q[i] = (i * 7) & 0xffff;
  const time = (f) => { let best = 1e9; for (let r = 0; r < 9; r++) { const t0 = process.hrtime.bigint(); f(q); best = Math.min(best, Number(process.hrtime.bigint() - t0) / 1e6); } return best; };
  const tNew = time(V.quadsToTris), tRef = time(refTris);
  check(same(V.quadsToTris(q), refTris(q)), 'quadsToTris on 10k quads matches the reference');
  console.log(`     quadsToTris 10k quads: ${tNew.toFixed(2)} ms (reference with subarray views: ${tRef.toFixed(2)} ms)`);
}
console.log(fail ? `FAILED ${fail}` : 'ALL OK');
process.exit(fail ? 1 : 0);

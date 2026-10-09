// t-folk (the owner: „natürlich keine Lego-Villagers, wir wollen schon Realismus"): real people instead of block people,
// measured without a browser.
//   §1 proportions — the rig (src/main/folkmodel.js buildPerson) assembled at rest by the rig's own matrices
//      (src/shared/folksmooth.js rigMats, the matrices entities.js drawModel builds): heads tall (sole to crown over chin
//      to crown), the hip joint at half the height, the shoulders against the head, the fingertips at mid-thigh, the
//      height in blocks — adults 7–7.6 heads, children 4.6–5.4, elders 6.8–7.6 (the old rig: 3.9 / 2.75 / 3.8)
// usage: bash test/wt_run.sh folk_real.js 300
const V = require('./load_shared.js');
require('../src/shared/smoothvox.js'); require('../src/shared/folksmooth.js');
require('../src/main/voxmodels.js'); require('../src/main/villagers.js'); require('../src/main/folkmodel.js');
const Folk = V.Folk, FS = V.FolkSmooth, m4 = V.mat4;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const f2 = (x) => (Math.round(x * 100) / 100).toFixed(2);

// ---------------------------------------------------------------- the rig at rest: every part's voxels in model units
// (a voxel x of a part's grid spans [x − ox, x − ox + 1] in the part's frame; its centre is transformed)
const TAG = Folk.TAG;
function assemble(def, pose) {
  const mats = FS.rigMats(def, m4.create(), pose || null, {});
  const out = {};
  for (const name of def.order) {
    const pr = def.parts[name]; if (!pr) continue;
    const g = pr.grid || pr, M = mats[name], vox = [];
    for (let y = 0; y < g.sy; y++) for (let z = 0; z < g.sz; z++) for (let x = 0; x < g.sx; x++) {
      const v = g.c[g.i(x, y, z)]; if (!v) continue;
      const px = x - g.ox + 0.5, py = y - g.oy + 0.5, pz = z - g.oz + 0.5;
      vox.push({ x: M[0] * px + M[4] * py + M[8] * pz + M[12], y: M[1] * px + M[5] * py + M[9] * pz + M[13], z: M[2] * px + M[6] * py + M[10] * pz + M[14], tag: (v >>> 26) & 7, col: v & 0xffffff, lx: x - g.ox, ly: y - g.oy, lz: z - g.oz });
    }
    out[name] = { vox, M };
  }
  return out;
}
// the measures of a person (model units, 32 a block): the sole, the crown (the skull and its hair, not a hat), the chin
// (the head's pivot: its lowest skull row sits on it), the head's width at the eyes (skull and hair), the shoulders (the
// upper arms' outer edges), the hip joint, the fingertips (the left hand's lowest skin voxel: the right one holds tools)
function measure(def) {
  const A = assemble(def);
  let sole = Infinity; for (const k of ['shin_l', 'shin_r']) for (const v of A[k].vox) sole = Math.min(sole, v.y - 0.5);
  const head = A.head, chin = head.M[13];
  // the crown: the head's middle column from the chin up, as far as it is filled (the skull, the scalp, the hair lying on
  // it; the people measured wear short hair and no hat — a bun, curls or a hat add to the figure, not to the head)
  const col = new Set();
  for (const v of head.vox) if (Math.abs(v.lx + 0.5) <= 1 && v.lz >= -1 && v.lz <= 0) col.add(v.ly);
  let top = 0; while (col.has(top + 1)) top++;
  let hx0 = Infinity, hx1 = -Infinity;
  const eyeRow = 3;
  for (const v of head.vox) if (v.ly === eyeRow && (v.tag === TAG.skin || v.tag === TAG.hair) && Math.abs(v.lz) <= 3) { hx0 = Math.min(hx0, v.x - 0.5); hx1 = Math.max(hx1, v.x + 0.5); }
  const crown = chin + top + 1;
  let sx0 = Infinity, sx1 = -Infinity;
  for (const k of ['arm_l', 'arm_r']) for (const v of A[k].vox) { sx0 = Math.min(sx0, v.x - 0.5); sx1 = Math.max(sx1, v.x + 0.5); }
  let tip = Infinity; for (const v of A.fore_l.vox) if (v.tag === TAG.skin) tip = Math.min(tip, v.y - 0.5);
  const H = crown - sole, headH = crown - chin;
  return { H, headH, heads: H / headH, headW: hx1 - hx0, shoulders: sx1 - sx0, hip: (def.layout.hips || def.layout.body)[1] - sole, tip: tip - sole, blocks: H / def.unit };
}

// ---------------------------------------------------------------- §1 the proportions
console.log('§1 proportions (model units, 32 a block)');
const PEOPLE = [
  ['crafter', 'adult', 11, null], ['scholar', 'adult', 22, null], ['office', 'adult', 33, null], ['crafter', 'adult', 44, 'hall'],
  ['smith', 'adult', 55, null], ['teacher', 'adult', 66, 'hall'], ['child', 'child', 77, null], ['child', 'child', 88, 'hall'],
  ['child', 'child', 99, null], ['elder', 'elder', 111, null], ['elder', 'elder', 122, 'hall'],
];
const RANGE = { adult: [7.0, 7.6], child: [4.6, 5.4], elder: [6.8, 7.6] };
const rows = [];
for (const [role, age, seed, style] of PEOPLE) {
  // (measured with short hair and no hat: the head's own height — the roles chosen wear none)
  const L = Object.assign(Folk.look(seed, role, age, null, style), { hs: 'short', kidHat: null, elderHat: null });
  const def = Folk.buildHiRes(L), m = measure(def), drawn = age === 'child' ? 0.82 : 1;
  rows.push([role, age, m]);
  console.log(`    ${role.padEnd(8)} ${age.padEnd(6)} ${(style || '').padEnd(4)} H ${f2(m.H)} (${f2(m.blocks * drawn)} blocks drawn) head ${f2(m.headH)} → ${f2(m.heads)} heads · head width ${f2(m.headW)} shoulders ${f2(m.shoulders)} (${f2(m.shoulders / m.headW)} heads) · hip ${f2(m.hip / m.H)} H · fingertips ${f2(m.tip / m.H)} H · hair ${L.hs}`);
  const [lo, hi] = RANGE[age];
  check(m.heads >= lo && m.heads <= hi, `${role} (${age}${style ? ', ' + style : ''}): ${f2(m.heads)} heads tall (${lo}–${hi}; the old rig: ${age === 'child' ? '2.75' : age === 'elder' ? '3.8' : '3.9'})`);
  if (age === 'adult') {
    check(m.hip / m.H >= 0.47 && m.hip / m.H <= 0.53, `${role}: the hip joint at ${f2(m.hip / m.H)} of the height (legs half the body; the old rig 0.41)`);
    check(m.shoulders / m.headW >= 1.9 && m.shoulders / m.headW <= 2.6, `${role}: shoulders ${f2(m.shoulders / m.headW)} head widths (the old rig 1.5)`);
    check(m.tip / m.H >= 0.33 && m.tip / m.H <= 0.43, `${role}: the fingertips at ${f2(m.tip / m.H)} of the height (mid-thigh)`);
    check(m.blocks >= 1.72 && m.blocks <= 1.86, `${role}: ${f2(m.blocks)} blocks tall`);
  }
  if (age === 'child') check(m.blocks * drawn >= 1.05 && m.blocks * drawn <= 1.25, `${role} (child): ${f2(m.blocks * drawn)} blocks tall as drawn (× 0.82)`);
}

// ---------------------------------------------------------------- §2 the smooth people
// a part's grid cut to what it holds (FolkSmooth.crop), its key, its surface-nets mesh (closed: every edge between two
// positions has an even number of triangles — no hole; the painted detail kept as the covered voxels' colour: the iris
// on the head's mesh), a whole person in one buffer (FolkSmooth.person, the worker's 'folkmesh' job: every vertex names
// its part, the indices stay in range), and the worker's LRU over 40 villagers of a town (the parts they share)
console.log('§2 smooth people');
const unpack = (data, nv) => { const f32 = new Float32Array(data.buffer, data.byteOffset, nv * 5), u8 = new Uint8Array(data.buffer, data.byteOffset, nv * 20); return { f32, u8 }; };
function closed(mesh) {
  const { f32 } = unpack(mesh.data, mesh.nv), id = new Map(), pid = new Int32Array(mesh.nv);
  for (let i = 0; i < mesh.nv; i++) { const k = Math.round(f32[i * 5] * 1000) + ',' + Math.round(f32[i * 5 + 1] * 1000) + ',' + Math.round(f32[i * 5 + 2] * 1000); let v = id.get(k); if (v === undefined) id.set(k, v = id.size); pid[i] = v; }
  const E = new Map(), I = mesh.idx;
  for (let t = 0; t < I.length; t += 3) for (let e = 0; e < 3; e++) { const a = pid[I[t + e]], b = pid[I[t + (e + 1) % 3]]; if (a === b) continue; const k = a < b ? a * 1e6 + b : b * 1e6 + a; E.set(k, (E.get(k) || 0) + 1); }
  let odd = 0; for (const c of E.values()) if (c & 1) odd++;
  return { edges: E.size, odd };
}
{
  const L = Object.assign(Folk.look(22, 'scholar', 'adult'), { hs: 'short' });
  const def = Folk.buildHiRes(L), head = def.parts.head.grid;
  const c = FS.crop(head);
  let n0 = 0, n1 = 0; for (const v of head.c) if (v) n0++; for (const v of c.c) if (v) n1++;
  check(c && n0 === n1 && c.sx * c.sy * c.sz < head.sx * head.sy * head.sz / 3, `crop: the head's ${n0} voxels in a ${c.sx}×${c.sy}×${c.sz} box (laid out ${head.sx}×${head.sy}×${head.sz})`);
  const g2 = new V.VoxGrid(head.sx + 4, head.sy, head.sz, head.ox + 4, head.oy, head.oz); for (let y = 0; y < head.sy; y++) for (let z = 0; z < head.sz; z++) for (let x = 0; x < head.sx; x++) g2.c[g2.i(x + 4, y, z)] = head.c[head.i(x, y, z)];
  check(FS.keyOf(FS.crop(g2)) === FS.keyOf(c), 'the key of a part does not depend on how its grid was laid out');
  const m = FS.mesh(c), cl = closed(m);
  console.log(`    head: ${m.nv} vertices, ${m.nt} triangles, ${m.ms.toFixed(1)} ms; ${cl.edges} edges, ${cl.odd} open`);
  check(cl.odd === 0, `the head's smooth mesh is closed (${cl.odd} open edges of ${cl.edges})`);
  // the eyes on the smooth head: the vertices round each eye's socket (folkmodel.js: the iris a voxel deep under the brow,
  // at the eye row, x ±1) are darker than the cheek's skin below them
  const { f32, u8 } = unpack(m.data, m.nv), lum = (i) => u8[i * 20 + 16] * 0.3 + u8[i * 20 + 17] * 0.59 + u8[i * 20 + 18] * 0.11;
  const front = (x, y, r) => { const out = []; for (let i = 0; i < m.nv; i++) { const nz = (u8[i * 20 + 14] << 24) >> 24; if (nz < -40 && Math.abs(f32[i * 5] - x) < r && Math.abs(f32[i * 5 + 1] - y) < r) out.push(i); } return out; };
  let eyesOk = 0;
  for (const ex of [-1, 1]) {
    const eye = front(ex + 0.5, 3.5, 0.75), cheek = front(ex + 0.5, 1.6, 0.75);
    const le = Math.min(...eye.map(lum)), lc = cheek.length ? cheek.map(lum).reduce((a, b) => a + b) / cheek.length : 0;
    console.log(`    eye at x ${ex}: darkest ${le.toFixed(0)} against the cheek ${lc.toFixed(0)} (${eye.length} and ${cheek.length} vertices)`);
    if (eye.length && cheek.length && le < lc * 0.6) eyesOk++;
  }
  check(eyesOk === 2, `the eyes are on the smooth head: both eye sockets darker than the cheeks (${eyesOk} of 2)`);
  let all = 0, open = 0, tris = 0;
  for (const name of def.order) { const g = def.parts[name].grid, cg = FS.crop(g); if (!cg) continue; const mm = FS.mesh(cg); if (!mm) continue; const q = closed(mm); all++; if (q.odd) open++; tris += mm.nt; }
  check(open === 0, `every part of the scholar is closed (${all - open} of ${all}; ${tris} triangles)`);
  // a whole person in one buffer
  const parts = [], seen = new Map();
  def.order.forEach((name, bone) => { const g = def.parts[name].grid; let k = seen.get(g); if (k === undefined) { const cg = FS.crop(g); if (!cg) return; k = FS.keyOf(cg); seen.set(g, k); parts.push(Object.assign({ key: k, bone }, cg)); } else parts.push({ key: k, bone }); });
  FS.cache = null;
  const P = FS.person({ parts });
  let bonesOk = true, inRange = true; const used = new Set();
  const { u8: pu } = unpack(P.data, P.nv);
  for (let i = 0; i < P.nv; i++) { const b = pu[i * 20 + 15]; used.add(b); if (b >= def.order.length) bonesOk = false; }
  for (const i of P.idx) if (i >= P.nv) inRange = false;
  check(!P.error && bonesOk && inRange && used.size >= def.order.length - 2, `a person in one buffer: ${P.nv} vertices, ${P.nt} triangles, ${used.size} parts named (of ${def.order.length}), indices in range, ${P.ms.toFixed(0)} ms meshing`);
  check(used.has(def.order.indexOf('arm_l')) && used.has(def.order.indexOf('arm_r')), 'the left and the right arm: one mesh, two parts');
}
{
  // 40 villagers of a village (the trades, the children, the elders as villages.js deals them) and 40 of the hall city:
  // the worker's LRU shares their parts
  for (const style of [null, 'hall']) {
    FS.cache = null;
    const roles = ['farmer', 'farmer', 'crafter', 'gardener', 'builder', 'baker', 'smith', 'scholar', 'healer', 'ranger'];
    let hits = 0, miss = 0, ms = 0, bytes = 0, nt = 0;
    for (let i = 0; i < 40; i++) {
      const age = i % 5 === 3 ? 'child' : i % 9 === 8 ? 'elder' : 'adult', role = age === 'adult' ? roles[i % roles.length] : age;
      const def = Folk.buildHiRes(Folk.look(500 + i * 37, role, age, null, style)), parts = [], seen = new Map();
      def.order.forEach((name, bone) => { const g = def.parts[name].grid; let k = seen.get(g); if (k === undefined) { const cg = FS.crop(g); if (!cg) return; k = FS.keyOf(cg); seen.set(g, k); parts.push(Object.assign({ key: k, bone }, cg)); } else parts.push({ key: k, bone }); });
      const P = FS.person({ parts }); hits += P.hits; miss += P.miss; ms += P.ms; bytes += P.data.byteLength + P.idx.byteLength; nt += P.nt;
    }
    const rate = hits / (hits + miss);
    console.log(`    ${style || 'village'}: 40 people, ${hits} part meshes from the LRU, ${miss} made (${ms.toFixed(0)} ms), ${(bytes / 40 / 1024).toFixed(0)} KB and ${(nt / 40) | 0} triangles a person, the LRU ${(FS.cache.bytes / 1048576).toFixed(1)} MB`);
    check(rate >= 0.4, `${style || 'village'}: the LRU's hit rate over 40 villagers ${(rate * 100).toFixed(0)} % (≥ 40 %)`);
  }
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

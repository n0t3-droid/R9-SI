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
require('../src/main/villages.js'); require('../src/main/folklife.js');
const Folk = V.Folk, FS = V.FolkSmooth, m4 = V.mat4, FA_ = V.FolkAnim;
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
  // the parts' ranges (folkgpu.js, the split draw: a part at a time with its own matrix): one after the other over all the
  // indices, each range's vertices of its own bone
  { const R = P.ranges || []; let next = 0, ok = R.length >= 3 * 10; for (let q = 0; q < R.length; q += 3) { if (R[q + 1] !== next) ok = false; for (let i = R[q + 1]; i < R[q + 1] + R[q + 2]; i += 97) if (pu[P.idx[i] * 20 + 15] !== R[q]) ok = false; next = R[q + 1] + R[q + 2]; }
    check(ok && next === P.idx.length, `the person's ranges: ${R.length / 3} parts over all ${P.idx.length} indices, each of its own bone`); }
  // the worker's way (folksmooth.js FS.personFromLook): the look in, the rig built (with the fine head: §2b), cut, meshed
  // and merged there, the rig's joints back for the draw — the same buffer as the same parts sent from outside
  const Q = FS.personFromLook(L), dF = Folk.buildFine(L), partsF = [], seenF = new Map();
  dF.order.forEach((name, bone) => { const g = (dF.fine && dF.fine[name]) || dF.parts[name].grid; let k = seenF.get(g); if (k === undefined) { const cg = FS.crop(g); if (!cg) return; k = FS.keyOf(cg); seenF.set(g, k); partsF.push(Object.assign({ key: k, bone }, cg)); } else partsF.push({ key: k, bone }); });
  const PF = FS.person({ parts: partsF });
  check(!Q.error && Q.nv === PF.nv && Q.nt === PF.nt && Q.rig && Q.rig.order.length === def.order.length && JSON.stringify(Q.rig.layout) === JSON.stringify(def.layout), `a person from its look alone: ${Q.nv} vertices, the rig's joints back (built in ${(Q.buildMs || 0).toFixed(1)} ms)`);
  check(FS.personFromLook(Folk.heroLook({ suit: 0 })).error === 'not a person', 'the trailer heroes keep their own build (no smooth mesh)');
  // the smooth person is posed exactly as the voxel one: FolkSmooth.rigMats (folkgpu.js's bones) against the matrices
  // entities.js drawModel hands the GL for every part, with a walking pose, a turn, a pitch and a child's scale
  require('../src/main/entities.js');
  const ent = Object.create(V.Entities.prototype); ent.mm = new Float32Array(16); ent.tmp = new Float32Array(16);
  const got = [], glMock = { uniform1f() {}, uniform3f() {}, uniformMatrix4fv(loc, tr, m) { got.push(Float32Array.from(m)); }, bindVertexArray() {}, drawArrays() {} };
  const model = { def, parts: {} }; for (const n of def.order) model.parts[n] = { vao: n, count: 3 };
  const Gw = Folk.gaitFor(L); FA_.stride(Gw, 2.2, 0.31, false); const pose = FA_.walkPerson(Gw, 1, {}); pose.head = [0.1, 0.4, 0.05, 0, 0, 0];
  const cam = { x: 3, y: 60, z: -2 }, pos = [10.5, 64, 7.25], yaw = 0.8, opts = { shade: 0, scale: 0.82, pitch: 0.2 };
  ent.drawModel({ gl: glMock }, { u: {} }, model, pos, cam, yaw, pose, { sky: 1, bl: [0, 0, 0] }, opts);
  const base = m4.create(); m4.translate(base, base, pos[0] - cam.x, pos[1] - cam.y, pos[2] - cam.z); m4.rotY(base, base, yaw); m4.rotX(base, base, opts.pitch); const sc = opts.scale / def.unit; m4.scale(base, base, sc, sc, sc);
  const mine = FS.rigMats(def, base, pose, {});
  let worstM = 0; def.order.forEach((n, i) => { for (let k = 0; k < 16; k++) worstM = Math.max(worstM, Math.abs(mine[n][k] - got[i][k])); });
  check(got.length === def.order.length && worstM < 1e-5, `the smooth person's bones are the voxel person's part matrices (${got.length} parts, worst difference ${worstM.toExponential(1)})`);
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

// ---------------------------------------------------------------- §2b the fine face
// The surface nets give every vertex the mean colour of the voxel faces round it: a one-voxel eye or lip at 32 a block
// (3 cm) faded into the skin of the smooth head (folk_sheet_portrait.png: the eyes thin slits, the lips gone). The smooth
// path builds the head at 64 a block (Folk.buildFine: the 32-a-block head's skull, hair, beard and hat taken up smoothly,
// the face drawn anew at 1.5 cm a voxel — eyes with their whites round a dark iris in a shallow socket, the upper lid's
// line, brows, a nose standing out with its tip, two lips; the blink lids and the talking mouth at the same scale).
// Measured on the head's mesh as the worker makes it (in the head's own units, 32 a block: the fine mesh is scaled down)
console.log('§2b the fine face');
{
  const beardL = (() => { for (let s = 1; s < 999; s++) { const q = Folk.look(s, 'crafter', 'adult'); if (q.beard) return q; } })();
  const cast = [[Object.assign(Folk.look(22, 'scholar', 'adult'), { hs: 'short' }), 'a scholar with glasses'], [Folk.look(11, 'crafter', 'adult'), 'a crafter'],
    [Folk.look(77, 'child', 'child'), 'a child'], [beardL, 'a bearded crafter'], [Folk.look(808, 'elder', 'elder'), 'an elder'], [Folk.look(4, 'crafter', 'adult', null, 'hall'), 'a Weißstadt crafter']];
  // (rosy: the red against the green and blue — a ratio, so the faces' shading does not change it)
  const rosy = (u8, i) => u8[i * 20 + 16] / Math.max(1, (u8[i * 20 + 17] + u8[i * 20 + 18]) / 2), lumOf = (u8, i) => u8[i * 20 + 16] * 0.3 + u8[i * 20 + 17] * 0.59 + u8[i * 20 + 18] * 0.11;
  for (const [L, who] of cast) {
    const def = Folk.buildFine ? Folk.buildFine(L) : null, fh = def && def.fine && def.fine.head;
    check(!!fh && fh.res === 2 && !!def.fine.lids && !!def.fine.mouth, `${who}: the smooth path's head, lids and mouth at 64 a block`);
    if (!fh) continue;
    const coarse = def.parts.head.grid;
    const c = FS.crop(fh), m = FS.mesh(c), cl = closed(m), m32 = FS.mesh(FS.crop(coarse));
    console.log(`    ${who}: the fine head ${m.nv} vertices, ${m.nt} triangles (at 32 a block ${m32.nv} and ${m32.nt}), ${m.ms.toFixed(1)} ms; ${cl.odd} open edges of ${cl.edges}`);
    check(cl.odd === 0, `${who}: the fine head's mesh is closed`);
    check(m.nt <= 5000, `${who}: the fine head within its budget (${m.nt} triangles ≤ 5000)`);
    // its place: the fine mesh in the head's own units lies where the coarse head is (± a voxel)
    const { f32, u8 } = unpack(m.data, m.nv);
    let bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity; for (let i = 0; i < m.nv; i++) { bx0 = Math.min(bx0, f32[i * 5]); bx1 = Math.max(bx1, f32[i * 5]); by0 = Math.min(by0, f32[i * 5 + 1]); by1 = Math.max(by1, f32[i * 5 + 1]); }
    const q = unpack(m32.data, m32.nv); let cx0 = Infinity, cx1 = -Infinity, cy0 = Infinity, cy1 = -Infinity; for (let i = 0; i < m32.nv; i++) { cx0 = Math.min(cx0, q.f32[i * 5]); cx1 = Math.max(cx1, q.f32[i * 5]); cy0 = Math.min(cy0, q.f32[i * 5 + 1]); cy1 = Math.max(cy1, q.f32[i * 5 + 1]); }
    check(Math.abs(bx0 - cx0) < 1 && Math.abs(bx1 - cx1) < 1 && Math.abs(by0 - cy0) < 1 && Math.abs(by1 - cy1) < 1.2, `${who}: the fine head stands where the coarse one does (x ${f2(bx0)}…${f2(bx1)} against ${f2(cx0)}…${f2(cx1)}, y ${f2(by0)}…${f2(by1)} against ${f2(cy0)}…${f2(cy1)})`);
    // the face's features, on the vertices that look forward (−z): the eyes (each a white and a dark iris, darker than
    // the cheek), the lips (rosier than the cheek), the nose's tip before the cheeks
    const A = fh.face, fwd = (i) => ((u8[i * 20 + 14] << 24) >> 24) < -50;
    const near = (x, y, rx, ry) => { const out = []; for (let i = 0; i < m.nv; i++) if (fwd(i) && Math.abs(f32[i * 5] - x) <= rx && Math.abs(f32[i * 5 + 1] - y) <= ry) out.push(i); return out; };
    const cheek = near(A.cheekX, A.cheekY, 0.35, 0.3), lc = cheek.length ? cheek.map(i => lumOf(u8, i)).reduce((a, b) => a + b) / cheek.length : 0, rc = cheek.length ? cheek.map(i => rosy(u8, i)).reduce((a, b) => a + b) / cheek.length : 0;
    const eyes = [];
    for (const ex of A.eyesX) {
      // (the whites lighter than the cheek; the iris darker than half the brightest white — on a dark skin the eye reads
      // by its whites, the iris as dark as the skin)
      const e = near(ex, A.eyeY, 0.85, 0.3), wl = e.length ? Math.max(...e.map(i => lumOf(u8, i))) : 0;
      const white = e.filter(i => lumOf(u8, i) > Math.max(150, lc + 25)).length, dark = e.filter(i => lumOf(u8, i) < wl * 0.45).length;
      eyes.push({ white, dark, n: e.length });
    }
    console.log(`      the eyes: ${eyes.map(e => `${e.white} white, ${e.dark} dark of ${e.n}`).join(' · ')} (the cheek's light ${lc.toFixed(0)})`);
    check(eyes.every(e => e.white >= 2 && e.dark >= 1), `${who}: both eyes show their whites round a dark iris`);
    check(Math.abs(eyes[0].white - eyes[1].white) <= 2 && Math.abs(eyes[0].dark - eyes[1].dark) <= 2, `${who}: the two eyes alike (mirrored)`);
    if (!L.beard) {
      // the lips a colour of their own: the farthest of the mouth's vertices from the cheek's mean colour, and redder
      const cm = [0, 1, 2].map(k => cheek.length ? cheek.map(i => u8[i * 20 + 16 + k]).reduce((a, b) => a + b) / cheek.length : 0);
      const lips = near(A.mouthX, A.mouthY, 0.8, 0.45);
      let best = 0, bestR = 0; for (const i of lips) { const d = Math.hypot(u8[i * 20 + 16] - cm[0], u8[i * 20 + 17] - cm[1], u8[i * 20 + 18] - cm[2]); if (d > best) { best = d; bestR = rosy(u8, i); } }
      // (rosier than the cheek on a fair skin; on a darker one the lower lip is the lighter tone)
      const fair = lc > 140;
      check(best > 25 && (!fair || bestR > rc), `${who}: the lips a colour of their own (${best.toFixed(0)} from the cheek's${fair ? `, red ${bestR.toFixed(2)} × the green and blue against ${rc.toFixed(2)}` : ''})`);
    }
    let noseZ = Infinity, cheekZ = Infinity;
    for (let i = 0; i < m.nv; i++) { const x = f32[i * 5], y = f32[i * 5 + 1], z = f32[i * 5 + 2]; if (Math.abs(x - A.mouthX) < 0.35 && y > A.noseY - 0.4 && y < A.noseY + 0.6) noseZ = Math.min(noseZ, z); if (Math.abs(x - A.cheekX) < 0.3 && Math.abs(y - A.cheekY) < 0.3) cheekZ = Math.min(cheekZ, z); }
    check(cheekZ - noseZ >= (L.age === 'child' ? 0.25 : 0.4), `${who}: the nose stands out of the face (${f2(cheekZ - noseZ)} head units before the cheek)`);
    // the lids, drawn while blinking, close both eyes: they cover the eye cells
    const lg = def.fine.lids; let covered = 0;
    for (const ex of A.eyesX) { let hit = false; for (let y = 0; y < lg.sy && !hit; y++) for (let z = 0; z < lg.sz && !hit; z++) for (let x = 0; x < lg.sx; x++) { if (!lg.c[lg.i(x, y, z)]) continue; const hx = (x - lg.ox + 0.5) / 2, hy = (y - lg.oy + 0.5) / 2; if (Math.abs(hx - ex) < 0.5 && Math.abs(hy - A.eyeY) < 0.4) { hit = true; break; } } if (hit) covered++; }
    check(covered === 2, `${who}: the blink lids cover both eyes (${covered} of 2)`);
  }
  // the worker's person takes the fine head: its head bone carries the fine mesh (more vertices than the coarse head's)
  FS.cache = null;
  const L = Folk.look(11, 'crafter', 'adult'), Q = FS.personFromLook(L), def = Folk.buildHiRes(L), hb = def.order.indexOf('head');
  let nHead = 0; const pu = new Uint8Array(Q.data.buffer, Q.data.byteOffset, Q.nv * 20); for (let i = 0; i < Q.nv; i++) if (pu[i * 20 + 15] === hb) nHead++;
  const m32 = FS.mesh(FS.crop(def.parts.head.grid));
  check(!Q.error && nHead > m32.nv * 2, `the worker's smooth person wears the fine head (${nHead} head vertices; the coarse head ${m32.nv}), ${Q.nv} vertices and ${Q.nt} triangles in all`);
  check(def.fine === undefined, 'the voxel people (Very Low, Low, the far LOD) keep the head at 32 a block: buildHiRes builds no fine head');
}

// ---------------------------------------------------------------- §3 clothes and hair
// the towns' people as villages.js makes them (makeRoster: the families, the trades, the looks, then Folk.unlike): at
// least six outfit families in a village and in the hall city, no two neighbours (a home's members and the next home's,
// three either way in the roster) dressed alike; the clothes and the hair have volume (a collar standing out of the
// chest, cuffs out of the sleeve, a hem with folds, the hair a shell over the skull)
console.log('§3 clothes and hair');
{
  const VG = V.VillageGen, Vs = V.Villages;
  const towns = [];
  for (const [vgen, cell] of [[9, [-2, -1]], [8, [-2, -1]], [8, [3, 2]], [8, [0, 3]]]) {
    const og = new V.OverworldGen(53, { worldType: 'default', vgen }), s = VG.site(og, cell[0], cell[1]);
    if (!s) continue;
    const vil = { plan: VG.summary(VG.plan(og, s)), st: {} }; Vs.makeRoster(vil);
    towns.push([vgen === 9 ? 'the hall city' : `the village at ${cell}`, vil]);
  }
  for (const [name, vil] of towns) {
    const fams = new Map(); for (const p of vil.people) { const f = Folk.familyOf(p.look); fams.set(f, (fams.get(f) || 0) + 1); }
    let clash = 0, pairs = 0;
    for (let i = 0; i < vil.people.length; i++) for (let j = Math.max(0, i - 3); j < i; j++) { pairs++; if (Folk.outfitKey(vil.people[i].look) === Folk.outfitKey(vil.people[j].look)) clash++; }
    console.log(`    ${name}: ${vil.people.length} people, ${fams.size} outfit families — ${[...fams].map(([k, n]) => k + ' ' + n).join(', ')}`);
    if (vil.people.length >= 20) check(fams.size >= 6, `${name}: ${fams.size} outfit families (≥ 6)`);
    check(clash === 0, `${name}: no two neighbours dressed alike (${clash} of ${pairs} pairs)`);
  }
  // the volume: a coat's collar stands a voxel out of the chest, the cuff a voxel out of the sleeve, a robe's hem has folds
  // (voxels a step further out every other fourteenth of its round), the hair is a shell a voxel over the skull
  const coatL = (() => { for (let s = 1; s < 400; s++) { const q = Folk.look(s, 'crafter', 'adult', null, 'hall'); if (q.garb === 'coat') return q; } })();
  const robeL = (() => { for (let s = 1; s < 400; s++) { const q = Folk.look(s, 'crafter', 'adult', null, 'hall'); if (q.garb === 'robe') return q; } })();
  const d1 = Folk.buildHiRes(coatL), d2 = Folk.buildHiRes(robeL);
  const at = (g, x, y, z) => { const X = x + g.ox, Y = y + g.oy, Z = z + g.oz; return g.in(X, Y, Z) ? g.c[g.i(X, Y, Z)] : 0; };
  const bg = d1.parts.body.grid, top = 18;
  const plain = Folk.buildHiRes(Folk.look(7, 'office', 'adult')).parts.body.grid;   // (a jacket's V, no lapels a voxel out)
  check(!!at(bg, 2, top - 1, -3) && !!at(bg, -2, top - 1, -3) && !at(plain, 2, top - 1, -3), "a coat's lapels stand a voxel out of its chest (a shirt has none)");
  const fg = d1.parts.fore_l.grid; let cuff = 0; for (let y = -10; y <= 0; y++) if (at(fg, 2, y, 0) || at(fg, -2, y, 0)) cuff++;
  check(cuff >= 1, `the cuffs stand out of the sleeve (${cuff} rows)`);
  const hg = d2.parts.hips.grid; let lo = Infinity; for (let y = -40; y < 0; y++) for (let x = -12; x <= 12; x++) for (let z = -12; z <= 12; z++) if (at(hg, x, y, z)) lo = Math.min(lo, y);
  let ring = 0, fold = 0; for (let x = -12; x <= 12; x++) for (let z = -12; z <= 12; z++) { if (!at(hg, x, lo, z)) continue; ring++; const r = Math.hypot(x, z + 0.5); if (r > 8.4) fold++; }
  check(fold >= 4, `a robe's hem has folds (${fold} of its ${ring} hem voxels a step further out)`);
  const head = d1.parts.head.grid; let shell = 0; for (let x = -2; x <= 2; x++) for (let z = -2; z <= 1; z++) if ((at(head, x, 7, z) >>> 26 & 7) === Folk.TAG.hair) shell++;
  check(shell >= 12, `the hair is a shell over the skull (${shell} hair voxels a row over the crown)`);
}

// ---------------------------------------------------------------- §4 movement
// the gait (folkanim.js FA.walkPerson) walked on the rig: a planted foot does not slide (its sole's speed over the ground
// in the middle of its stance), the arms swing against the legs, the pelvis shifts over the stance foot and turns while
// the shoulders turn against it, a robe's legs stay inside its hem; standing, the weight moves from leg to leg and the
// chest breathes; the head turns at most 40° toward what the person looks at (the shoulders the rest); seated, the
// thighs rest on the seat and the feet on the floor
console.log('§4 movement');
const FA = V.FolkAnim;
// a foot's sole in the world (model units, the base at the walker's place): the shin's frame point (0, sole, 0)
function soleAt(def, base, pose, side) {
  const mats = FS.rigMats(def, base, pose, {}), M = mats['shin_' + side], g = def.parts['shin_' + side].grid;
  let row = 0; while (row < g.sy) { let any = false; for (let z = 0; z < g.sz && !any; z++) for (let x = 0; x < g.sx; x++) if (g.c[g.i(x, row, z)]) { any = true; break; } if (any) break; row++; }
  const y = row - g.oy;   // (the bottom of the shin's lowest row of voxels: the sole)
  return [M[4] * y + M[12], M[5] * y + M[13], M[6] * y + M[14]];
}
function walkRun(L, v, run, secs) {
  const def = Folk.buildHiRes(L), G = Folk.gaitFor(L), u = def.unit / G.scale;   // model units a block, as drawn
  const dt = 1 / 240, out = {};
  let x = 0, worst = 0, maxSwing = 0, maxFoot = 0, sxCorr = 0, yawCorr = 0;
  const arms = [], legs = [];
  let prev = null;
  for (let i = 0; i < secs / dt; i++) {
    FA.stride(G, v, dt, run); x += v * dt;
    FA.walkPerson(G, 1, out);
    const base = m4.create(); m4.translate(base, base, 0, 0, -x * u);   // (walking toward −z: the models face −z)
    const sl = soleAt(def, base, out, 'l'), sr = soleAt(def, base, out, 'r');
    const TAU = Math.PI * 2, uL = ((G.ph % TAU) + TAU) % TAU / TAU, beta = run ? 0.38 : 0.6;
    if (prev && i * dt > 0.5) {
      // in the middle 80 % of the left foot's stance: its sole's speed over the ground (blocks a second)
      if (uL > beta * 0.1 && uL < beta * 0.9) { const vz = Math.hypot(sl[0] - prev[0], sl[2] - prev[2]) / u / dt; worst = Math.max(worst, vz / v); }
      maxSwing = Math.max(maxSwing, Math.abs(out.leg_l[0]), Math.abs(out.leg_r[0]));
      maxFoot = Math.max(maxFoot, Math.abs(sl[2] + x * u));
      arms.push(out.arm_l[0]); legs.push(out.leg_l[0]);
      sxCorr += out.hips[3] * (uL < beta ? -1 : 1);
      yawCorr += out.hips[1] * out.body[1];
    }
    prev = sl; void sr;
  }
  // the correlation of the left arm's swing with the left thigh's (about their means)
  const mean = (A) => A.reduce((p, q) => p + q, 0) / A.length, ma = mean(arms), ml = mean(legs);
  let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < arms.length; i++) { const da = arms[i] - ma, dl = legs[i] - ml; sab += da * dl; saa += da * da; sbb += dl * dl; }
  return { worst, maxSwing, maxFoot, arm: sab / Math.sqrt(saa * sbb || 1), sx: sxCorr, yaw: yawCorr, G, S: G.S };
}
{
  const cases = [
    ['trousers, 2.2 blocks/s', Folk.look(11, 'crafter', 'adult'), 2.2, false],
    ['an elder, 1.5 blocks/s', Folk.look(111, 'elder', 'elder'), 1.5, false],
    ['a robe, 2.2 blocks/s', Folk.look(4, 'crafter', 'adult', null, 'hall'), 2.2, false],
    ['a child running, 2.9 blocks/s', Folk.look(77, 'child', 'child'), 2.9 * 1.0, true],
  ];
  for (const [name, L0, v, run] of cases) {
    const L = name.startsWith('a robe') ? (() => { for (let s = 1; s < 400; s++) { const q = Folk.look(s, 'crafter', 'adult', null, 'hall'); if (q.garb === 'robe') return q; } return L0; })() : L0;
    const r = walkRun(L, v, run, 3);
    console.log(`    ${name}: step ${r.S.toFixed(2)} blocks, the stance foot's speed ≤ ${(r.worst * 100).toFixed(1)} % of the walk's, thigh swing ≤ ${r.maxSwing.toFixed(2)} rad (the clothes allow ${r.G.maxSwing}), arm·leg ${r.arm.toFixed(2)}`);
    check(r.worst < 0.08, `${name}: a planted foot does not slide (${(r.worst * 100).toFixed(1)} % of the walking speed)`);
    check(r.arm < -0.5, `${name}: the arm swings against the leg on its side (correlation ${r.arm.toFixed(2)})`);
    check(r.sx > 0 && r.yaw < 0, `${name}: the pelvis shifts over the stance foot and the shoulders turn against it`);
    if (L.garb === 'robe') {
      // the legs inside the robe: at 24 moments of a cycle, the thigh and shin voxels above the hem against the robe's
      // own outline at their height (its front and back, its sides) — a leg voxel outside it pokes through the cloth
      const def = Folk.buildHiRes(L), G = Folk.gaitFor(L), out = {};
      let worstOut = 0, legs = 0;
      for (let k = 0; k < 24; k++) {
        G.ph = k / 24 * Math.PI * 2; G.S = FA.stepLen(G, v, false); FA.walkPerson(G, 1, out);
        const A = assemble(def, out), rows = new Map();
        let hem = Infinity; for (const q of A.hips.vox) hem = Math.min(hem, q.y);
        for (const q of A.hips.vox) { const y = Math.round(q.y), r = rows.get(y) || { z0: Infinity, z1: -Infinity, x0: Infinity, x1: -Infinity }; r.z0 = Math.min(r.z0, q.z); r.z1 = Math.max(r.z1, q.z); r.x0 = Math.min(r.x0, q.x); r.x1 = Math.max(r.x1, q.x); rows.set(y, r); }
        let outN = 0, n = 0;
        for (const part of ['leg_l', 'leg_r', 'shin_l', 'shin_r']) for (const q of A[part].vox) {
          if (q.y < hem + 2) continue;   // (the feet below the hem show, as they should)
          const r = rows.get(Math.round(q.y)); n++;
          if (!r || q.z < r.z0 - 0.6 || q.z > r.z1 + 0.6 || q.x < r.x0 - 0.6 || q.x > r.x1 + 0.6) outN++;
        }
        worstOut = Math.max(worstOut, outN / Math.max(1, n)); legs = n;
      }
      check(worstOut < 0.02, `a robe's legs stay inside it: at worst ${(worstOut * 100).toFixed(1)} % of the leg voxels above the hem outside its outline (of ${legs})`);
    }
  }
}
{
  // standing: FA.pose with the gait — the weight from leg to leg, the free knee bent, the chest breathing
  const L = Folk.look(11, 'crafter', 'adult'), G = Folk.gaitFor(L), a = { seedW: 3 };
  let tx0 = Infinity, tx1 = -Infinity, knee = 0, by0 = Infinity, by1 = -Infinity;
  for (let i = 0; i < 20 * 30; i++) { const P = FA.pose(a, 'idle', 1 / 30, 0, 0, false, a.poseOut || (a.poseOut = {}), undefined, G); tx0 = Math.min(tx0, P.hips[3]); tx1 = Math.max(tx1, P.hips[3]); knee = Math.min(knee, P.shin_l[0], P.shin_r[0]); by0 = Math.min(by0, P.body[4]); by1 = Math.max(by1, P.body[4]); }
  check(tx1 - tx0 > 0.8 && knee < -0.08, `standing, the weight moves from leg to leg (the pelvis slides ${(tx1 - tx0).toFixed(2)} units, the free knee bends ${(-knee).toFixed(2)} rad)`);
  check(by1 - by0 > 0.2, `standing, the chest breathes (rises ${(by1 - by0).toFixed(2)} units)`);
  // an elder stoops a little, standing and walking; the head comes up to look ahead
  const E = Folk.look(111, 'elder', 'elder'), GE = Folk.gaitFor(E), b = { seedW: 5 };
  const Ps = FA.pose(b, 'idle', 1 / 30, 0, 0, false, {}, undefined, GE);
  FA.stride(GE, 1.5, 0.2, false); const Pw = FA.pose(b, 'idle', 1 / 30, 0, 1, false, {}, undefined, GE);
  check(Ps.body[0] > 0.08 && Pw.body[0] > 0.08 && Ps.head[0] < -0.05, `an elder stoops (the back ${Ps.body[0].toFixed(2)} rad standing, ${Pw.body[0].toFixed(2)} walking; the head up ${(-Ps.head[0]).toFixed(2)})`);
}
{
  // the head: a person looking at something 90° to its right turns the head 40° at most, the shoulders the rest
  const mgr = Object.create(V.Villages.prototype);
  mgr.g = { player: { pos: [1000, 0, 1000] } };
  const L = Folk.look(11, 'crafter', 'adult');
  const a = { pos: [0, 70, 0], vel: [0, 0, 0], yaw: 0, walk: 0, walkAmt: 0, pose: 'stand', p: { look: L, seed: 5 }, headYaw: 0, headPitch: 0, lookAt: [-5, 71.5, 0], kid: false };
  let P; for (let i = 0; i < 60; i++) P = mgr.pose(a, i / 30);
  // (40° of looking, the idle's own small glance on top)
  check(Math.abs(P.head[1]) <= 0.7 + 0.1 && Math.abs(P.body[1]) > 0.3, `the head turns ${(Math.abs(P.head[1]) * 180 / Math.PI).toFixed(0)}° toward the target 90° aside (40° of looking and the idle's glance), the shoulders ${(Math.abs(P.body[1]) * 180 / Math.PI).toFixed(0)}°`);
}
{
  // seated: the sit clip on the rig, placed as villages.js draws it (the seat half a block up from the seat block's floor)
  for (const [L, who] of [[Folk.look(11, 'crafter', 'adult'), 'an adult'], [Folk.look(77, 'child', 'child'), 'a child']]) {
    const def = Folk.buildHiRes(L), G = Folk.gaitFor(L), P = FA.sample(FA.clips.sit, 0, {});
    const dy = 0.05 + 0.45 - (G.hip - 4) * G.bpu;   // villages.js: the agent stands 0.05 over the floor, the draw adds this
    const base = m4.create(); m4.translate(base, base, 0, dy * def.unit / G.scale, 0);
    const A = assemble(def, P);
    let under = Infinity, sole = Infinity;
    for (const k of ['leg_l', 'leg_r']) { const mats = FS.rigMats(def, base, P, {}), M = mats[k], g = def.parts[k].grid; for (let y = 0; y < g.sy; y++) for (let z = 0; z < g.sz; z++) for (let x = 0; x < g.sx; x++) { if (!g.c[g.i(x, y, z)]) continue; const px = x - g.ox + 0.5, py = y - g.oy, pz = z - g.oz + 0.5; under = Math.min(under, M[1] * px + M[5] * py + M[9] * pz + M[13]); } }
    for (const k of ['shin_l', 'shin_r']) { const s = soleAt(def, base, P, k.slice(-1)); sole = Math.min(sole, s[1]); }
    const ub = under * G.bpu, sb = sole * G.bpu;   // blocks above the floor
    void A;
    console.log(`    ${who} seated: the thighs' underside ${ub.toFixed(2)} blocks over the floor (the seat 0.5), the soles ${sb.toFixed(2)}`);
    check(Math.abs(ub - 0.5) < 0.07, `${who} seated: the thighs rest on the seat (${ub.toFixed(2)} blocks, the seat at 0.50)`);
    if (who === 'an adult') check(sb > -0.03 && sb < 0.14, `an adult seated: the feet on the floor (${sb.toFixed(2)} blocks)`);
  }
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

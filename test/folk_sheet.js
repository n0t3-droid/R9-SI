// The people, looked at without a browser (t-folk): a lineup of villagers — the trades, the Weißstadt's robes and coats,
// children, elders — posed by the rig (src/shared/folksmooth.js rigMats, the same matrices as entities.js drawModel)
// and drawn by a small software rasterizer (perspective, z-buffer, the vertex normals and colours, a sun and the sky's
// hemisphere; 2× supersampled), twice: as voxels (voxmodels.js meshGrid, what Very Low and Low draw) and smooth
// (folksmooth.js FolkSmooth.mesh, what Balanced and up draw within 24 blocks). Pictures:
//   test/shots/folk_sheet_vox.png, folk_sheet_smooth.png — the lineup at eye height from 4 blocks
//   test/shots/folk_sheet_portrait.png — four heads at 1 block, voxels left, smooth right
//   test/shots/folk_sheet_walk.png — the lineup walking (the gait of folkanim.js)
//   test/shots/folk_sheet_faces.png — six faces at two blocks, smooth
//   test/shots/folk_sheet_hall.png — the hall city's garbs (robe, coat, tunic, gown, cape), the front five and the back five
// Each picture is checked to hold the people (pixels drawn); ALL OK when every one does.
// regress: skip (a tool for the eyes)
//   bash test/wt_run.sh folk_sheet.js 600
const V = require('./load_shared.js');
require('../src/shared/smoothvox.js'); require('../src/shared/folksmooth.js');
require('../src/main/voxmodels.js'); require('../src/main/villagers.js'); require('../src/main/folkmodel.js');
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const Folk = V.Folk, FS = V.FolkSmooth, FA = V.FolkAnim, m4 = V.mat4;
let fails = 0; const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };

// ---------------------------------------------------------------- a PNG
function crc32(buf) { let c, crc = 0xffffffff; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; }
function png(w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; Buffer.from(rgb.buffer, rgb.byteOffset + y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1); }
  const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
// ---------------------------------------------------------------- the 20-byte vertex meshes → arrays
function unpack(m) {
  if (!m) return null;
  const n = m.data.byteLength / 20, f32 = new Float32Array(m.data.buffer, m.data.byteOffset, n * 5), i8 = new Int8Array(m.data.buffer, m.data.byteOffset, n * 20), u8 = new Uint8Array(m.data.buffer, m.data.byteOffset, n * 20);
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), rgb = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { for (let k = 0; k < 3; k++) { pos[i * 3 + k] = f32[i * 5 + k]; nrm[i * 3 + k] = i8[i * 20 + 12 + k] / 127; rgb[i * 3 + k] = u8[i * 20 + 16 + k] / 255; } }
  let idx = m.idx; if (!idx) { idx = new Uint32Array(n); for (let i = 0; i < n; i++) idx[i] = i; }
  return { pos, nrm, rgb, idx, n };
}
// ---------------------------------------------------------------- the rasterizer: perspective, a z-buffer
function Canvas(W, H, bg) {
  this.W = W; this.H = H; this.S = 2; const w = W * 2, h = H * 2;
  this.col = new Float32Array(w * h * 3); this.zb = new Float32Array(w * h).fill(1e30); this.drawn = 0;
  for (let y = 0; y < h; y++) { const t = y / h; for (let x = 0; x < w; x++) { const i = (y * w + x) * 3; this.col[i] = bg[0] * (1 - t) + bg[3] * t; this.col[i + 1] = bg[1] * (1 - t) + bg[4] * t; this.col[i + 2] = bg[2] * (1 - t) + bg[5] * t; } }
}
const SUN = (() => { const v = [0.5, 0.75, -0.45]; const l = Math.hypot(...v); return v.map(x => x / l); })();
Canvas.prototype.cam = function (eye, at, fov) {
  this.view = m4.lookAt(new Float32Array(16), eye[0], eye[1], eye[2], at[0], at[1], at[2], 0, 1, 0);
  this.proj = m4.perspective(new Float32Array(16), fov * Math.PI / 180, this.W / this.H, 0.05, 100);
  this.vp = m4.mul(new Float32Array(16), this.proj, this.view); this.eye = eye;
};
Canvas.prototype.mesh = function (M, mat) {
  const w = this.W * this.S, h = this.H * this.S, vp = this.vp, n = M.n;
  const X = new Float32Array(n), Y = new Float32Array(n), Z = new Float32Array(n), WN = new Float32Array(n * 3), WP = new Float32Array(n * 3);
  const sc = Math.hypot(mat[0], mat[1], mat[2]);
  for (let i = 0; i < n; i++) {
    const px = M.pos[i * 3], py = M.pos[i * 3 + 1], pz = M.pos[i * 3 + 2];
    const wx = mat[0] * px + mat[4] * py + mat[8] * pz + mat[12], wy = mat[1] * px + mat[5] * py + mat[9] * pz + mat[13], wz = mat[2] * px + mat[6] * py + mat[10] * pz + mat[14];
    WP[i * 3] = wx; WP[i * 3 + 1] = wy; WP[i * 3 + 2] = wz;
    const nx = M.nrm[i * 3], ny = M.nrm[i * 3 + 1], nz = M.nrm[i * 3 + 2];
    WN[i * 3] = (mat[0] * nx + mat[4] * ny + mat[8] * nz) / sc; WN[i * 3 + 1] = (mat[1] * nx + mat[5] * ny + mat[9] * nz) / sc; WN[i * 3 + 2] = (mat[2] * nx + mat[6] * ny + mat[10] * nz) / sc;
    const cx = vp[0] * wx + vp[4] * wy + vp[8] * wz + vp[12], cy = vp[1] * wx + vp[5] * wy + vp[9] * wz + vp[13], cw = vp[3] * wx + vp[7] * wy + vp[11] * wz + vp[15];
    X[i] = (cx / cw * 0.5 + 0.5) * w; Y[i] = (1 - (cy / cw * 0.5 + 0.5)) * h; Z[i] = cw;
  }
  const I = M.idx;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2];
    if (Z[a] < 0.05 || Z[b] < 0.05 || Z[c] < 0.05) continue;
    // back faces culled, as the game draws the people (beginVox: CULL_FACE; the meshes wind counter-clockwise outward)
    { const ux = WP[b * 3] - WP[a * 3], uy = WP[b * 3 + 1] - WP[a * 3 + 1], uz = WP[b * 3 + 2] - WP[a * 3 + 2], vx = WP[c * 3] - WP[a * 3], vy = WP[c * 3 + 1] - WP[a * 3 + 1], vz = WP[c * 3 + 2] - WP[a * 3 + 2];
      const gx = uy * vz - uz * vy, gy = uz * vx - ux * vz, gz = ux * vy - uy * vx;
      if (gx * (this.eye[0] - WP[a * 3]) + gy * (this.eye[1] - WP[a * 3 + 1]) + gz * (this.eye[2] - WP[a * 3 + 2]) <= 0) continue; }
    const x0 = X[a], y0 = Y[a], x1 = X[b], y1 = Y[b], x2 = X[c], y2 = Y[c];
    const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0); if (Math.abs(area) < 1e-9) continue;
    const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2))), maxX = Math.min(w - 1, Math.ceil(Math.max(x0, x1, x2))), minY = Math.max(0, Math.floor(Math.min(y0, y1, y2))), maxY = Math.min(h - 1, Math.ceil(Math.max(y0, y1, y2)));
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5, py = y + 0.5, w0 = ((x1 - px) * (y2 - py) - (x2 - px) * (y1 - py)) / area, w1 = ((x2 - px) * (y0 - py) - (x0 - px) * (y2 - py)) / area, w2 = 1 - w0 - w1;
      if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
      const z = w0 * Z[a] + w1 * Z[b] + w2 * Z[c], zi = y * w + x; if (z >= this.zb[zi]) continue; this.zb[zi] = z;
      let nx = w0 * WN[a * 3] + w1 * WN[b * 3] + w2 * WN[c * 3], ny = w0 * WN[a * 3 + 1] + w1 * WN[b * 3 + 1] + w2 * WN[c * 3 + 1], nz = w0 * WN[a * 3 + 2] + w1 * WN[b * 3 + 2] + w2 * WN[c * 3 + 2];
      const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      // the vox shader's light, roughly: a wrapped sun, the sky's hemisphere, a rim
      const wrap = Math.max(0, (nx * SUN[0] + ny * SUN[1] + nz * SUN[2] + 0.3) / 1.3);
      const hemi = 0.42 + 0.2 * (ny * 0.5 + 0.5);
      const lit = hemi + wrap * 0.85;
      for (let k = 0; k < 3; k++) { const alb = Math.pow(w0 * M.rgb[a * 3 + k] + w1 * M.rgb[b * 3 + k] + w2 * M.rgb[c * 3 + k], 2.2); this.col[zi * 3 + k] = Math.pow(Math.min(1, alb * lit * 1.05), 1 / 2.2); }
      this.drawn++;
    }
  }
};
Canvas.prototype.png = function () {
  const out = new Uint8Array(this.W * this.H * 3), w = this.W * this.S, S = this.S;
  for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) for (let k = 0; k < 3; k++) { let s = 0; for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) s += this.col[((y * S + dy) * w + x * S + dx) * 3 + k]; out[(y * this.W + x) * 3 + k] = Math.round(255 * s / (S * S)); }
  return png(this.W, this.H, out);
};
// ---------------------------------------------------------------- the people
const OUT = '/home/dev/vr/test/shots'; fs.mkdirSync(OUT, { recursive: true });
const cast = [
  ['farmer', 'adult', 101, null], ['baker', 'adult', 202, null], ['scholar', 'adult', 303, null], ['healer', 'adult', 404, null],
  ['crafter', 'adult', 505, 'hall'], ['farmer', 'adult', 606, 'hall'], ['child', 'child', 707, null], ['elder', 'elder', 808, null],
  ['mayor', 'adult', 909, null], ['builder', 'adult', 1010, null], ['office', 'adult', 1111, null], ['child', 'child', 1212, 'hall'],
];
const meshCache = new Map(); let tParts = 0, tMs = 0, hits = 0;
// (smooth: as the worker meshes a person — folksmooth.js FS.personFromLook — the head, its lids and its talking mouth at
// 64 a block, Folk.buildFine's def.fine, every part cut to what it holds)
function partMeshes(def, smooth) {
  const out = {};
  for (const name in def.parts) {
    const g = smooth ? FS.crop((def.fine && def.fine[name]) || def.parts[name].grid) : def.parts[name].grid;
    if (!g) continue;
    const key = (smooth ? 's:' : 'v:') + FS.keyOf(g);
    let m = meshCache.get(key);
    if (!m) { if (smooth) { const r = FS.mesh(g); tMs += r ? r.ms : 0; m = unpack(r); } else m = unpack(V.meshVoxGrid(g)); meshCache.set(key, m); } else hits++;
    tParts++;
    out[name] = m;
  }
  return out;
}
function drawPerson(cv, def, meshes, x, z, yaw, pose, scale, hide) {
  const base = m4.create(); m4.translate(base, base, x, 0, z); m4.rotY(base, base, yaw); const s = (scale || 1) / def.unit; m4.scale(base, base, s, s, s);
  const mats = FS.rigMats(def, base, pose, {});
  for (const name of def.order) { if (hide && hide[name]) continue; if ((name === 'joy' || name === 'wow') && !(hide && hide.expr === name)) continue; const M = meshes[name]; if (M) cv.mesh(M, mats[name]); }
}
const people = cast.map(([role, age, seed, style]) => { const L = Folk.look(seed, role, age, null, style); return { L, def: Folk.buildFine(L), kid: age === 'child' }; });
const idle = FA.sample(FA.clips.idle, 0.7, {});
const BG = [0.62, 0.74, 0.88, 0.86, 0.84, 0.8];
for (const smooth of [false, true]) {
  const cv = new Canvas(1280, 720, BG);
  cv.cam([0, 1.45, -5.2], [0, 1.0, 0], 50);   // (the people face −z)
  people.forEach((p, i) => drawPerson(cv, p.def, partMeshes(p.def, smooth), (i - (people.length - 1) / 2) * 0.62, (i & 1) * 0.35, 0.18 * ((i % 3) - 1), idle, p.kid ? 0.82 : 1, { lids: true, mouth: true }));
  fs.writeFileSync(path.join(OUT, `folk_sheet_${smooth ? 'smooth' : 'vox'}.png`), cv.png());
  check(cv.drawn > 50000, `the lineup drawn ${smooth ? 'smooth' : 'as voxels'} (${cv.drawn} pixels)`);
}
{
  const cv = new Canvas(1280, 720, BG);
  cv.cam([0, 1.62, -1.2], [0, 1.6, 0], 40);
  const four = [people[0], people[4], people[8], people[2]];
  four.forEach((p, i) => { const x = (i - 1.5) * 0.36; drawPerson(cv, p.def, partMeshes(p.def, false), x + 0.09, 0, -0.25, idle, 1, { lids: true, mouth: true }); drawPerson(cv, p.def, partMeshes(p.def, true), x - 0.09, 0, 0.25, idle, 1, { lids: true, mouth: true }); });
  fs.writeFileSync(path.join(OUT, 'folk_sheet_portrait.png'), cv.png());
  check(cv.drawn > 50000, `the portraits drawn (${cv.drawn} pixels)`);
}
{
  const cv = new Canvas(1280, 720, BG);
  cv.cam([-3.2, 1.3, -3.6], [0, 0.9, 0], 50);
  // (the people's own gait, folkanim.js FA.walkPerson: each at another moment of its cycle)
  people.slice(0, 8).forEach((p, i) => { const G = Folk.gaitFor(p.L); G.ph = i * 0.7; G.S = FA.stepLen(G, p.kid ? 2.9 : 2.2, false); const P = FA.walkPerson(G, 1, {}); drawPerson(cv, p.def, partMeshes(p.def, true), (i - 3.5) * 0.7, 0, Math.PI / 2, P, p.kid ? 0.82 : 1, { lids: true, mouth: true }); });
  fs.writeFileSync(path.join(OUT, 'folk_sheet_walk.png'), cv.png());
  check(cv.drawn > 30000, `the walk drawn (${cv.drawn} pixels)`);
}
{
  // the hall city's townsfolk (villagers.js V.WEISS): a robe, a coat, a tunic, a gown and a cape twice each, smooth
  const want = ['robe', 'coat', 'tunic', 'gown', 'cape', 'robe', 'coat', 'tunic', 'gown', 'cape'], hall = [];
  for (const g of want) for (let s2 = 1 + hall.length * 97; s2 < 5000; s2++) { const L = Folk.look(s2, s2 & 1 ? 'crafter' : 'gardener', 'adult', null, 'hall'); if (L.garb === g) { hall.push({ L, def: Folk.buildFine(L), kid: false }); break; } }
  const cv = new Canvas(1280, 720, BG);
  cv.cam([0, 1.45, -5.2], [0, 1.0, 0], 50);
  hall.forEach((p, i) => drawPerson(cv, p.def, partMeshes(p.def, true), (i - (hall.length - 1) / 2) * 0.62, (i & 1) * 0.35, 0.25 * ((i % 3) - 1) + (i >= 5 ? Math.PI : 0), idle, 1, { lids: true, mouth: true }));
  fs.writeFileSync(path.join(OUT, 'folk_sheet_hall.png'), cv.png());
  check(cv.drawn > 50000, `the hall city's garbs drawn smooth, front and back (${cv.drawn} pixels)`);
}
{
  // faces at two blocks (the game's close portrait): six people, smooth, front-lit — the beard, the glasses, a child
  const six = [Folk.look(4, 'crafter', 'adult', null, 'hall'), Folk.look(31, 'scholar', 'adult'), Folk.look(9, 'gardener', 'adult', null, 'hall'), Folk.look(1212, 'child', 'child'), Folk.look(808, 'elder', 'elder'), Folk.look(15, 'baker', 'adult')];
  for (let s2 = 1; s2 < 999; s2++) { const L = Folk.look(s2, 'crafter', 'adult'); if (L.beard) { six[0] = L; break; } }
  const cv = new Canvas(1280, 720, BG);
  cv.cam([0, 1.5, -2.0], [0, 1.45, 0], 36);
  six.forEach((L, i) => { const def = Folk.buildFine(L); drawPerson(cv, def, partMeshes(def, true), (i - 2.5) * 0.36, 0, 0, idle, L.age === 'child' ? 0.82 : 1, { lids: true, mouth: true }); });
  fs.writeFileSync(path.join(OUT, 'folk_sheet_faces.png'), cv.png());
  check(cv.drawn > 50000, `six faces at two blocks, smooth (${cv.drawn} pixels)`);
}
{
  // u-folk2: the expressions — the same three faces resting, in joy and in surprise (folkmodel.js joy / wow parts)
  const three = [Folk.look(31, 'scholar', 'adult'), Folk.look(1212, 'child', 'child'), Folk.look(15, 'baker', 'adult')];
  const cv = new Canvas(1280, 720, BG);
  cv.cam([0, 1.5, -2.2], [0, 1.4, 0], 40);
  let i = 0;
  for (const L of three) for (const ex of [null, 'joy', 'wow']) { const def = Folk.buildFine(L); drawPerson(cv, def, partMeshes(def, true), (i - 4) * 0.27, 0, 0, idle, L.age === 'child' ? 0.82 : 1, { lids: true, mouth: true, expr: ex }); i++; }
  fs.writeFileSync(path.join(OUT, 'folk_sheet_expr.png'), cv.png());
  check(cv.drawn > 50000, `three faces resting, in joy, in surprise (${cv.drawn} pixels)`);
}
{
  // every hat and hair style on the fine face (folkmodel.js fineFace), two rows of heads at 1.1 blocks: the trades' hats
  // (straw, chef, hard, top, visor, goggles, cap, sun), the children's (beanie, kid's cap, bow), an elder's flat cap, the
  // hair styles bare — test/shots/folk_sheet_heads.png
  const heads = [];
  for (const role of ['farmer', 'baker', 'builder', 'mayor', 'ranger', 'pilot', 'healer', 'gardener', 'scholar']) heads.push(Object.assign(Folk.look(31 + heads.length * 7, role, 'adult'), { beard: false }));
  for (const kh of ['beanie', 'kidcap', 'bow']) heads.push(Object.assign(Folk.look(5 + heads.length, 'child', 'child'), { kidHat: kh }));
  heads.push(Object.assign(Folk.look(808, 'elder', 'elder'), { elderHat: 'flat', hs: 'short' }));
  for (const hs of ['long', 'bob', 'bun', 'pony', 'curly', 'spiky', 'braids', 'afro', 'bald']) heads.push(Object.assign(Folk.look(61 + heads.length * 3, 'crafter', 'adult'), { hs, beard: hs === 'bald' }));
  const cv = new Canvas(1280, 720, BG);
  cv.cam([0, 1.3, -2.1], [0, 1.27, 0], 48);
  const perRow = 11;
  heads.forEach((L, i) => {
    const row = (i / perRow) | 0, col = i % perRow, def = Folk.buildFine(L), kid = L.age === 'child';
    // (each head's chin at 1.46 blocks, the second row 0.45 lower: two rows of busts)
    const x = (col - (perRow - 1) / 2) * 0.3, hy = 1.5 - row * 0.45;
    const base = m4.create(); m4.translate(base, base, x, hy - (kid ? 0.82 * 36 : 50) / 32, 0); m4.rotY(base, base, 0.25 * Math.sin(i)); const s = (kid ? 0.82 : 1) / def.unit; m4.scale(base, base, s, s, s);
    const mats = FS.rigMats(def, base, idle, {}), meshes = partMeshes(def, true);
    for (const name of ['head']) { const M = meshes[name]; if (M) cv.mesh(M, mats[name]); }
  });
  fs.writeFileSync(path.join(OUT, 'folk_sheet_heads.png'), cv.png());
  check(cv.drawn > 50000, `every hat and hair style on the fine face (${heads.length} heads, ${cv.drawn} pixels)`);
}
{
  // t-folk2: seated (folkanim.js FA.sitPose, as villages.js draws a guest: the root raised and moved forward on the seat) —
  // a robe, a coat, trousers and a child on chairs (0.484, the bentwood chair's seat), the first three at a café table
  // one block ahead (the marble table: its top 0.75, its radius 0.3125, the right forearm on it); seen from the front
  // three-quarters (upper row) and from the side (lower row) — test/shots/folk_sheet_sit.png
  const box = (x0, y0, z0, x1, y1, z1, c) => {
    const P = [], N = [], C = [], I = [];
    const quad = (a, b, cc, d, n) => { const k = P.length / 3; for (const v of [a, b, cc, d]) { P.push(...v); N.push(...n); C.push(...c); } I.push(k, k + 1, k + 2, k, k + 2, k + 3); };
    quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]); quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]);
    quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]); quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]);
    quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]); quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]);
    return { pos: new Float32Array(P), nrm: new Float32Array(N), rgb: new Float32Array(C), idx: new Uint32Array(I), n: P.length / 3 };
  };
  const wood = [0.45, 0.28, 0.18], marble = [0.92, 0.92, 0.9];
  const guests = [[Folk.look(3301, 'crafter', 'adult', null, 'hall'), true], [Folk.look(3304, 'crafter', 'adult', null, 'hall'), true], [Folk.look(4242, 'farmer', 'adult', null, null), true], [Folk.look(77, 'child', 'child', null, null), false]];
  const cv = new Canvas(1280, 720, BG);
  cv.cam([0.6, 2.7, -5.2], [0.6, 0.45, 1.1], 44);
  for (const [row, yaw0] of [[0, 0.5], [1, Math.PI / 2]]) guests.forEach(([L, atTable], i) => {
    const G = Folk.gaitFor(L), def = Folk.buildFine(L), kid = L.age === 'child';
    const o = { seat: 0.484, table: atTable ? { d: 1, h: 0.75, r: 0.3125 } : null, side: 'r' }, P = {}, sp = FA.sitPose(G, o, P);
    // (the guest's pose seen at a quarter turn (upper) and from the side (lower): the chair at x, the table ahead of it)
    const x = (i - 1.5) * 1.25 + 0.6, z = row ? 2.6 : -0.6, fx = -Math.sin(yaw0), fz = -Math.cos(yaw0);
    const tr = (px, py, pz) => { const m = m4.create(); m4.translate(m, m, x + px, py, z + pz); return m; };
    const turned = m4.create(); m4.translate(turned, turned, x, 0, z); m4.rotY(turned, turned, yaw0);
    cv.mesh(box(-0.2, 0.44, -0.2, 0.2, 0.484, 0.2, wood), turned);
    cv.mesh(box(-0.2, 0.484, 0.16, 0.2, 0.95, 0.2, wood), turned);   // (the chair's back, behind the guest)
    if (atTable) { cv.mesh(box(-0.3, 0.71, -0.3, 0.3, 0.75, 0.3, marble), tr(fx, 0, fz)); cv.mesh(box(-0.04, 0, -0.04, 0.04, 0.71, 0.04, [0.1, 0.1, 0.1]), tr(fx, 0, fz)); }
    const s = (kid ? 0.82 : 1);
    const base = m4.create(); m4.translate(base, base, x + fx * sp.fwd, sp.rootY - 0.05, z + fz * sp.fwd); m4.rotY(base, base, yaw0); m4.scale(base, base, s / def.unit, s / def.unit, s / def.unit);
    const mats = FS.rigMats(def, base, P, {}), meshes = partMeshes(def, true);
    // (as villages.js draws a guest: the things held put down, a robe's thighs under its lap — FA.sitHides)
    for (const name of def.order) { if (name === 'lids' || name === 'mouth' || name === 'item_r' || name === 'item_l') continue; if (FA.SIT_HIDE.includes(name) && FA.sitHides(G)) continue; const M = meshes[name]; if (M) cv.mesh(M, mats[name]); }
  });
  fs.writeFileSync(path.join(OUT, 'folk_sheet_sit.png'), cv.png());
  check(cv.drawn > 30000, `seated at a café table and on a chair (${cv.drawn} pixels)`);
}
console.log(`    ${tParts} parts, ${meshCache.size} meshes built (${hits} shared), smooth meshing ${tMs.toFixed(0)} ms`);
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

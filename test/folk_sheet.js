// The people, looked at without a browser (t-folk): a lineup of villagers — the trades, the Weißstadt's robes and coats,
// children, elders — posed by the rig (src/shared/folksmooth.js rigMats, the same matrices as entities.js drawModel)
// and drawn by a small software rasterizer (perspective, z-buffer, the vertex normals and colours, a sun and the sky's
// hemisphere; 2× supersampled), twice: as voxels (voxmodels.js meshGrid, what Very Low and Low draw) and smooth
// (folksmooth.js FolkSmooth.mesh, what Balanced and up draw within 24 blocks). Pictures:
//   test/shots/folk_sheet_vox.png, folk_sheet_smooth.png — the lineup at eye height from 4 blocks
//   test/shots/folk_sheet_portrait.png — four heads at 1 block, voxels left, smooth right
//   test/shots/folk_sheet_walk.png — the lineup walking (the gait of folkanim.js)
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
const OUT = '/home/claude/vr/test/shots'; fs.mkdirSync(OUT, { recursive: true });
const cast = [
  ['farmer', 'adult', 101, null], ['baker', 'adult', 202, null], ['scholar', 'adult', 303, null], ['healer', 'adult', 404, null],
  ['crafter', 'adult', 505, 'hall'], ['farmer', 'adult', 606, 'hall'], ['child', 'child', 707, null], ['elder', 'elder', 808, null],
  ['mayor', 'adult', 909, null], ['builder', 'adult', 1010, null], ['office', 'adult', 1111, null], ['child', 'child', 1212, 'hall'],
];
const meshCache = new Map(); let tParts = 0, tMs = 0, hits = 0;
function partMeshes(def, smooth) {
  const out = {};
  for (const name in def.parts) {
    const g = def.parts[name].grid, key = (smooth ? 's:' : 'v:') + FS.keyOf(g);
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
  for (const name of def.order) { if (hide && hide[name]) continue; const M = meshes[name]; if (M) cv.mesh(M, mats[name]); }
}
const people = cast.map(([role, age, seed, style]) => { const L = Folk.look(seed, role, age, null, style); return { L, def: Folk.buildHiRes(L), kid: age === 'child' }; });
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
  people.slice(0, 8).forEach((p, i) => { const ph = i * 0.7; const P = FA.walk(ph, 1, false, {}); drawPerson(cv, p.def, partMeshes(p.def, true), (i - 3.5) * 0.7, 0, Math.PI / 2, P, p.kid ? 0.82 : 1, { lids: true, mouth: true }); });
  fs.writeFileSync(path.join(OUT, 'folk_sheet_walk.png'), cv.png());
  check(cv.drawn > 30000, `the walk drawn (${cv.drawn} pixels)`);
}
console.log(`    ${tParts} parts, ${meshCache.size} meshes built (${hits} shared), smooth meshing ${tMs.toFixed(0)} ms`);
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

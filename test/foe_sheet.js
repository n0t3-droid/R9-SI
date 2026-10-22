// The foes, looked at without a browser (a-foes): the game's own F.draw (foes.js — the parts, their poses, the optic's
// and the core's tints) and F.drawExtra (the shed plates, gears and shards, a bolt, a pile) are run against a recording
// stand-in for WebGL, and every recorded draw is rasterised in software (perspective, z-buffer, a sun and the sky's
// hemisphere; the emissive voxels unlit and tinted, as the vox shader lights them). Three rows:
//   test/shots/foe_sheet_patrol.png — Bohrläufer, Wächter, Kranarm, Schattendrohne, Schattenwesen as they patrol
//   test/shots/foe_sheet_warn.png   — each in its warning (the optic flaring, the shield swung aside, the arm raised)
//   test/shots/foe_sheet_after.png  — a power-down (kneeling), a calmed Wächter, a Helfer, the parts, a bolt, a pile
// Each picture is checked to hold the foes (pixels drawn); ALL OK when every one does.
// regress: skip (a tool for the eyes)
//   bash test/wt_run.sh foe_sheet.js 300
require('./dom_stub.js');
const V = require('./load_shared.js');
const fs = require('fs'), path = require('path'), zlib = require('zlib');
for (const f of ['i18n', 'lang_en', 'lang_de', 'voxmodels', 'foemodels', 'foes']) require('../src/main/' + f + '.js');
const F = V.Foes, m4 = V.mat4;
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
// ---------------------------------------------------------------- the 20-byte vertex meshes → arrays (with the emissive byte)
function unpack(m) {
  const n = m.data.byteLength / 20, f32 = new Float32Array(m.data.buffer, m.data.byteOffset, n * 5), i8 = new Int8Array(m.data.buffer, m.data.byteOffset, n * 20), u8 = new Uint8Array(m.data.buffer, m.data.byteOffset, n * 20);
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), rgb = new Float32Array(n * 3), em = new Uint8Array(n);
  for (let i = 0; i < n; i++) { for (let k = 0; k < 3; k++) { pos[i * 3 + k] = f32[i * 5 + k]; nrm[i * 3 + k] = i8[i * 20 + 12 + k] / 127; rgb[i * 3 + k] = u8[i * 20 + 16 + k] / 255; } em[i] = u8[i * 20 + 19] > 127 ? 1 : 0; }
  return { pos, nrm, rgb, em, n };
}
// ---------------------------------------------------------------- the rasterizer
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
// tint: the vox shader's u_tint (a multiplier; an emissive voxel shows it unlit and boosted), flash: red
Canvas.prototype.mesh = function (M, mat, tint, flash, dim) {
  const w = this.W * this.S, h = this.H * this.S, vp = this.vp, n = M.n;
  const X = new Float32Array(n), Y = new Float32Array(n), Z = new Float32Array(n), WN = new Float32Array(n * 3), WP = new Float32Array(n * 3);
  const sc = Math.hypot(mat[0], mat[1], mat[2]) || 1;
  for (let i = 0; i < n; i++) {
    const px = M.pos[i * 3], py = M.pos[i * 3 + 1], pz = M.pos[i * 3 + 2];
    const wx = mat[0] * px + mat[4] * py + mat[8] * pz + mat[12], wy = mat[1] * px + mat[5] * py + mat[9] * pz + mat[13], wz = mat[2] * px + mat[6] * py + mat[10] * pz + mat[14];
    WP[i * 3] = wx; WP[i * 3 + 1] = wy; WP[i * 3 + 2] = wz;
    const nx = M.nrm[i * 3], ny = M.nrm[i * 3 + 1], nz = M.nrm[i * 3 + 2];
    WN[i * 3] = (mat[0] * nx + mat[4] * ny + mat[8] * nz) / sc; WN[i * 3 + 1] = (mat[1] * nx + mat[5] * ny + mat[9] * nz) / sc; WN[i * 3 + 2] = (mat[2] * nx + mat[6] * ny + mat[10] * nz) / sc;
    const cx = vp[0] * wx + vp[4] * wy + vp[8] * wz + vp[12], cy = vp[1] * wx + vp[5] * wy + vp[9] * wz + vp[13], cw = vp[3] * wx + vp[7] * wy + vp[11] * wz + vp[15];
    X[i] = (cx / cw * 0.5 + 0.5) * w; Y[i] = (1 - (cy / cw * 0.5 + 0.5)) * h; Z[i] = cw;
  }
  for (let t = 0; t < n; t += 3) {
    const a = t, b = t + 1, c = t + 2;
    if (Z[a] < 0.05 || Z[b] < 0.05 || Z[c] < 0.05) continue;
    { const ux = WP[b * 3] - WP[a * 3], uy = WP[b * 3 + 1] - WP[a * 3 + 1], uz = WP[b * 3 + 2] - WP[a * 3 + 2], vx = WP[c * 3] - WP[a * 3], vy = WP[c * 3 + 1] - WP[a * 3 + 1], vz = WP[c * 3 + 2] - WP[a * 3 + 2];
      const gx = uy * vz - uz * vy, gy = uz * vx - ux * vz, gz = ux * vy - uy * vx;
      if (gx * (this.eye[0] - WP[a * 3]) + gy * (this.eye[1] - WP[a * 3 + 1]) + gz * (this.eye[2] - WP[a * 3 + 2]) <= 0) continue; }
    const x0 = X[a], y0 = Y[a], x1 = X[b], y1 = Y[b], x2 = X[c], y2 = Y[c];
    const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0); if (Math.abs(area) < 1e-9) continue;
    const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2))), maxX = Math.min(w - 1, Math.ceil(Math.max(x0, x1, x2))), minY = Math.max(0, Math.floor(Math.min(y0, y1, y2))), maxY = Math.min(h - 1, Math.ceil(Math.max(y0, y1, y2)));
    const em = M.em[a];
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5, py = y + 0.5, w0 = ((x1 - px) * (y2 - py) - (x2 - px) * (y1 - py)) / area, w1 = ((x2 - px) * (y0 - py) - (x0 - px) * (y2 - py)) / area, w2 = 1 - w0 - w1;
      if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
      const z = w0 * Z[a] + w1 * Z[b] + w2 * Z[c], zi = y * w + x; if (z >= this.zb[zi]) continue; this.zb[zi] = z;
      let nx = w0 * WN[a * 3] + w1 * WN[b * 3] + w2 * WN[c * 3], ny = w0 * WN[a * 3 + 1] + w1 * WN[b * 3 + 1] + w2 * WN[c * 3 + 1], nz = w0 * WN[a * 3 + 2] + w1 * WN[b * 3 + 2] + w2 * WN[c * 3 + 2];
      const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      const wrap = Math.max(0, (nx * SUN[0] + ny * SUN[1] + nz * SUN[2] + 0.3) / 1.3), hemi = 0.42 + 0.2 * (ny * 0.5 + 0.5), lit = (hemi + wrap * 0.85) * (dim || 1);
      for (let k = 0; k < 3; k++) {
        let alb = Math.pow(w0 * M.rgb[a * 3 + k] + w1 * M.rgb[b * 3 + k] + w2 * M.rgb[c * 3 + k], 2.2) * (tint ? tint[k] : 1);
        if (flash) alb = alb * (1 - flash * 0.6) + (k === 0 ? flash * 0.6 : 0);
        const v = em ? alb * 2.2 : alb * lit * 1.05;
        this.col[zi * 3 + k] = Math.pow(Math.min(1, v), 1 / 2.2);
      }
      this.drawn++;
    }
  }
};
Canvas.prototype.png = function () {
  const out = new Uint8Array(this.W * this.H * 3), w = this.W * this.S, S = this.S;
  for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) for (let k = 0; k < 3; k++) { let s = 0; for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) s += this.col[((y * S + dy) * w + x * S + dx) * 3 + k]; out[(y * this.W + x) * 3 + k] = Math.round(Math.min(1, s / (S * S)) * 255); }
  return png(this.W, this.H, out);
};
// ---------------------------------------------------------------- a stand-in for WebGL that records the draws
const REC = [];
V.VoxGPU.upload = (gl, mesh) => ({ vao: { M: unpack(mesh) }, count: mesh.count });
const gl = {
  _vao: null, _tint: [1, 1, 1], _flash: 0, _model: null, TRIANGLES: 4,
  uniform1f(u, v) { if (u === 'flash') this._flash = v; }, uniform3f(u, a, b, c) { if (u === 'tint') this._tint = [a, b, c]; },
  uniformMatrix4fv(u, tr, m) { if (u === 'model') this._model = Float32Array.from(m); },
  bindVertexArray(v) { this._vao = v; }, drawArrays() { if (this._vao && this._vao.M) REC.push({ M: this._vao.M, mat: this._model, tint: this._tint.slice(), flash: this._flash }); },
};
const r = { gl, frame: 0 }, prog = { u: { u_tint: 'tint', u_flash: 'flash', u_model: 'model', u_sky: 'sky', u_blockLight: 'bl', u_sunShadow: 'ss', u_noFog: 'nf' } };
const En = { lightAt: () => ({ sky: 1, bl: [0, 0, 0] }), sunShade: () => 0 };
const cam = { x: 0, y: 0, z: 0 };
let ID = 1;
const mob = (k, x, z, yaw, set) => { const K = F.KINDS[k], m = { id: ID++, pos: [x, K.fly ? 0.9 : 0, z], vel: [0, 0, 0], yaw, walkAmt: 0, h: K.h }; m.foe = F.make(k, m.id, m.pos); m.foe.spin = 0.8; if (set) set(m.foe, m); return m; };
const scene = (name, list, extra, eye, at, dim) => {
  REC.length = 0;
  for (const m of list) F.draw(En, r, prog, m, cam, 0);
  if (extra) extra();
  const cv = new Canvas(1280, 480, dim ? [0.08, 0.08, 0.16, 0.05, 0.05, 0.09] : [0.62, 0.74, 0.88, 0.86, 0.84, 0.8]);
  cv.cam(eye || [0, 1.5, -6.4], at || [0, 0.75, 0], 46);
  for (const d of REC) cv.mesh(d.M, d.mat, d.tint, d.flash, dim);
  fs.writeFileSync(path.join(OUT, name + '.png'), cv.png());
  check(cv.drawn > 20000, name + ': ' + list.length + ' foes, ' + REC.length + ' draws, ' + cv.drawn + ' pixels');
  return cv;
};
const OUT = path.join(__dirname, 'shots'); fs.mkdirSync(OUT, { recursive: true });
const X = [-3.6, -1.6, 0.6, 2.3, 3.8];
scene('foe_sheet_patrol', [mob('driller', X[0], 0, 0.45), mob('sentry', X[1], 0, 0.25), mob('crane', X[2], 0.6, -0.5), mob('drone', X[3], 0, -0.3), mob('wisp', X[4], 0, -0.5)]);
scene('foe_sheet_warn', [
  mob('driller', X[0], 0, 0.45, (f) => { f.st = 'tele'; f.t = 0.7; f.flare = 0.9; }),
  mob('sentry', X[1], 0, 0.25, (f) => { f.st = 'tele'; f.t = 0.5; f.flare = 0.8; }),
  mob('crane', X[2], 0.6, -0.5, (f) => { f.st = 'tele'; f.t = 0.7; f.flare = 0.8; }),
  mob('drone', X[3], 0, -0.3, (f) => { f.st = 'tele'; f.t = 0.5; f.flare = 0.85; }),
  mob('wisp', X[4], 0, -0.5, (f) => { f.st = 'tele'; f.t = 0.5; f.flare = 0.85; }),
]);
F.bits.length = 0;
for (const [what, x, y, z, a, b] of [['plate', -0.2, 0.06, -0.6, 0.4, 1.2], ['plate', 0.35, 0.3, -0.9, 1.5, 0.3], ['gear', 0.8, 0.06, -0.4, 0, 0.8], ['shard', 1.3, 0.06, -0.7, 0.7, 2.1], ['shard', 1.55, 0.4, -0.5, 2.0, 0.5]]) F.bits.push({ model: 'foe_' + what, pos: [x, y, z], vel: [0, 0, 0], rot: [a, b], spin: [0, 0], t: 1 });
F.bolts.length = 0; F.bolts.push({ pos: [2.2, 1.2, -0.8], vel: [0, 0, -6], t: 0.3, k: 'drone' });
F.pile = { pos: [3.2, 0.05, -0.6], n: 4 };
scene('foe_sheet_after', [
  mob('driller', X[0], 0, 0.45, (f) => { f.st = 'down'; f.t = 1.0; f.kneel = 1; }),
  mob('sentry', X[1], 0, 0.25, (f) => { f.st = 'calm'; f.calm = 1; f.kneel = 1; }),
  mob('driller', -0.6, 0.4, -0.2, (f) => { f.st = 'helper'; f.helper = true; f.calm = 1; }),
], () => F.drawExtra(En, r, prog, cam));
F.bits.length = 0; F.bolts.length = 0; F.pile = null;
scene('foe_sheet_night', [mob('wisp', -1.2, 0, 0.3), mob('wisp', 0.4, 0.5, -0.2, (f) => { f.st = 'strike'; f.flare = 1; }), mob('drone', 1.9, 0.2, -0.4)], null, [0, 1.4, -5], [0, 0.8, 0], 0.22);
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

// Glatt-Modelle, looked at without a browser (t-form): every piece the game draws from surface nets, three ways side by
// side — its voxels, the 16-a-block surface (the near mesh) and the 32-a-block fine surface (res-32 pieces; drawn close
// by on Ausgewogen and up) — rendered by a small software rasterizer (orthographic, z-buffer, the vertex normals, colours
// and occlusion, a key light; 2× supersampled) into sheets of 16 rows, two pieces a row:
//   test/shots/smoothvox_sheet_<k>.png (k = 1, 2, …) and the row names on the console. NAMES=a,b,c draws just those.
// Each tile is checked to hold the piece (pixels drawn); ALL OK when every one does.
// regress: skip (a tool for the eyes: some 200 pieces three ways take a minute)
//   bash test/wt_run.sh smoothvox_sheet.js 600
require('./load_shared.js');
require('../src/shared/smoothvox.js');
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const SV = VR.SmoothVox, VM = VR.VM;
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
// ---------------------------------------------------------------- the rasterizer: a tile of a sheet
const BG = 24;
function Sheet(cols, rows, tw, th) { this.tw = tw; this.th = th; this.W = cols * tw; this.H = rows * th; this.px = new Uint8Array(this.W * this.H * 3).fill(BG); }
Sheet.prototype.draw = function (c, r, mesh, view) {
  const S = 2, W = this.tw * S, H = this.th * S, col = new Float32Array(W * H * 3).fill(BG / 255), zb = new Float32Array(W * H).fill(-1e30);
  const cy = Math.cos(view.yaw), sy = Math.sin(view.yaw), cp = Math.cos(view.pitch), sp = Math.sin(view.pitch);
  const tr = (x, y, z) => { const x1 = cy * x - sy * z, z1 = sy * x + cy * z; return [x1, cp * y - sp * z1, sp * y + cp * z1]; };
  const b = view.box; let mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9;
  for (let k = 0; k < 8; k++) { const p = tr(k & 1 ? b[1][0] : b[0][0], k & 2 ? b[1][1] : b[0][1], k & 4 ? b[1][2] : b[0][2]); mnx = Math.min(mnx, p[0]); mxx = Math.max(mxx, p[0]); mny = Math.min(mny, p[1]); mxy = Math.max(mxy, p[1]); }
  const sc = Math.min((W * 0.9) / (mxx - mnx), (H * 0.9) / (mxy - mny)), ox = W / 2 - sc * (mnx + mxx) / 2, oy = H / 2 + sc * (mny + mxy) / 2;
  const L = [0.45, 0.8, 0.6].map((v, _, a) => v / Math.hypot(...a));
  const P = mesh.pos, N = mesh.nrm, C = mesh.rgb, A = mesh.ao, I = mesh.idx, nv = P.length / 3;
  const X = new Float32Array(nv), Y = new Float32Array(nv), Z = new Float32Array(nv);
  for (let i = 0; i < nv; i++) { const p = tr(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); X[i] = ox + p[0] * sc; Y[i] = oy - p[1] * sc; Z[i] = p[2]; }
  let drawn = 0;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], bb = I[t + 1], cc = I[t + 2], x0 = X[a], y0 = Y[a], x1 = X[bb], y1 = Y[bb], x2 = X[cc], y2 = Y[cc];
    const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0); if (Math.abs(area) < 1e-9) continue;
    const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2))), maxX = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2))), minY = Math.max(0, Math.floor(Math.min(y0, y1, y2))), maxY = Math.min(H - 1, Math.ceil(Math.max(y0, y1, y2)));
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5, py = y + 0.5, w0 = ((x1 - px) * (y2 - py) - (x2 - px) * (y1 - py)) / area, w1 = ((x2 - px) * (y0 - py) - (x0 - px) * (y2 - py)) / area, w2 = 1 - w0 - w1;
      if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
      const z = w0 * Z[a] + w1 * Z[bb] + w2 * Z[cc], zi = y * W + x; if (z <= zb[zi]) continue; zb[zi] = z;
      let nx = w0 * N[a * 3] + w1 * N[bb * 3] + w2 * N[cc * 3], ny = w0 * N[a * 3 + 1] + w1 * N[bb * 3 + 1] + w2 * N[cc * 3 + 1], nz = w0 * N[a * 3 + 2] + w1 * N[bb * 3 + 2] + w2 * N[cc * 3 + 2];
      const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      if (tr(nx, ny, nz)[2] < 0) { nx = -nx; ny = -ny; nz = -nz; }
      const ao = A ? w0 * A[a] + w1 * A[bb] + w2 * A[cc] : 1, ndl = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
      const lit = (0.36 + 0.64 * ndl) * Math.max(0.35, ao) + 0.1 * Math.max(0, ny) ** 2;
      for (let k = 0; k < 3; k++) col[zi * 3 + k] = Math.min(1, (w0 * C[a * 3 + k] + w1 * C[bb * 3 + k] + w2 * C[cc * 3 + k]) / 255 * lit);
      drawn++;
    }
  }
  for (let y = 0; y < this.th; y++) for (let x = 0; x < this.tw; x++) for (let k = 0; k < 3; k++) {
    let s = 0; for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) s += col[((y * S + dy) * W + x * S + dx) * 3 + k];
    this.px[((r * this.th + y) * this.W + c * this.tw + x) * 3 + k] = Math.round(255 * s / (S * S));
  }
  return drawn;
};
// a voxel model as cubes (its exposed faces, flat)
function voxMesh(V, VW, VH, VD, scale) {
  const pos = [], nrm = [], rgb = [], idx = [], at = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < VW && y < VH && z < VD ? V[(y * VD + z) * VW + x] : 0;
  for (let y = 0; y < VH; y++) for (let z = 0; z < VD; z++) for (let x = 0; x < VW; x++) {
    const v = at(x, y, z); if (!v) continue;
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      if (at(x + dx, y + dy, z + dz)) continue;
      const u = dx ? [0, 1, 0] : [1, 0, 0], w = dz ? [0, 1, 0] : [0, 0, 1], o = [x + (dx > 0), y + (dy > 0), z + (dz > 0)], n0 = pos.length / 3;
      for (const [i, j] of [[0, 0], [1, 0], [1, 1], [0, 1]]) { pos.push((o[0] + u[0] * i + w[0] * j) * scale, (o[1] + u[1] * i + w[1] * j) * scale, (o[2] + u[2] * i + w[2] * j) * scale); nrm.push(dx, dy, dz); rgb.push((v >> 16) & 255, (v >> 8) & 255, v & 255); }
      idx.push(n0, n0 + 1, n0 + 2, n0, n0 + 2, n0 + 3);
    }
  }
  return { pos: Float32Array.from(pos), nrm: Float32Array.from(nrm), rgb: Uint8Array.from(rgb), ao: null, idx: Uint32Array.from(idx) };
}
const smooth = (src, step, up) => { const res = src.res, g = SV.mesh(src, { step, up, aoScale: res * up / step / 16 }); return { pos: Float32Array.from(g.pos, v => v / res), nrm: g.nrm, rgb: g.rgb, ao: g.ao, idx: g.idx, nt: g.idx.length / 3 }; };

// ---------------------------------------------------------------- the pieces
const A = SV.autoTables(), only = process.env.NAMES ? process.env.NAMES.split(',') : null;
const names = only || [...new Set(A.list.filter(e => !e.hand && !e.off).map(e => e.name))];
const ROWS = 16, PER = 2, TW = 170, TH = 140, view = { yaw: 3.76, pitch: 0.42 };
const OUT = '/home/claude/vr/test/shots'; fs.mkdirSync(OUT, { recursive: true });   // (test/wt_run.sh writes this checkout's root here)
let sheet = null, k = 0, empty = [], t0 = Date.now(), tri = [0, 0, 0];
for (let i = 0; i < names.length; i++) {
  const n = names[i], slot = i % (ROWS * PER);
  if (!slot) { sheet = new Sheet(3 * PER, ROWS, TW, TH); k++; }
  let src = VM.MODELS[n]; if (!src && /^vx_/.test(n)) src = SV.paintVX(n, 0);
  if (!src) { empty.push(n + ' (no model)'); continue; }
  if (!src.V && src.vol === undefined && VM.materialize) VM.materialize(src);
  let V = src.V; if (!V) { V = new Uint32Array(src.VW * src.VH * src.VD); for (let j = 0; j < V.length; j++) { const q = src.vol[j]; if (q) V[j] = src.pal[q]; } }
  const res = src.res, box = [[0, 0, 0], [src.W, src.H, src.D]], row = Math.floor(slot / PER), c0 = (slot % PER) * 3;
  const vm = voxMesh(V, src.VW, src.VH, src.VD, 1 / res), near = smooth(src, SV.stepFor(res), SV.upFor(res)), fine = res >= 32 ? smooth(src, SV.stepFor(res, true), 1) : null;
  const d = [sheet.draw(c0, row, vm, Object.assign({ box }, view)), sheet.draw(c0 + 1, row, near, Object.assign({ box }, view)), fine ? sheet.draw(c0 + 2, row, fine, Object.assign({ box }, view)) : 1];
  if (d.some(x => !x)) empty.push(n);
  tri[0] += vm.idx.length / 3; tri[1] += near.nt; tri[2] += fine ? fine.nt : near.nt;
  console.log(`  sheet ${k} row ${row + 1} ${slot % PER ? 'right' : 'left '}: ${n} (${src.W}×${src.H}×${src.D}, 1/${res}) — ${near.nt} / ${fine ? fine.nt : '–'} triangles`);
  if (slot === ROWS * PER - 1 || i === names.length - 1) fs.writeFileSync(path.join(OUT, `smoothvox_sheet_${k}.png`), png(sheet.W, sheet.H, sheet.px));
}
console.log(`    ${names.length} pieces on ${k} sheets in ${((Date.now() - t0) / 1000).toFixed(0)} s; the voxels' faces ${tri[0]}, 16 a block ${tri[1]}, fine ${tri[2]} triangles`);
check(names.length > 0 && !empty.length, `every piece drawn three ways (${names.length - empty.length} of ${names.length}${empty.length ? '; empty: ' + empty.slice(0, 6).join(', ') : ''})`);
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);

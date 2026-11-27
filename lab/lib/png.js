// ============================================================================
// R9-SI Lab · Bilder ohne Zusatzpakete: PNG schreiben (zlib aus node), vergrößern, nebeneinander setzen.
// Pictures without extra packages: write a PNG (node's zlib), scale by whole pixels, set pictures side by side.
// An image is {w, h, data: Uint8Array RGBA}.
// ============================================================================
'use strict';
const zlib = require('zlib'), fs = require('fs');
const P = module.exports = {};
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (buf) => { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, 'ascii'), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, c]); };
P.image = (w, h, rgba) => ({ w, h, data: new Uint8Array(w * h * 4).fill(0).map((v, i) => (rgba ? rgba[i & 3] : (i & 3) === 3 ? 255 : 0)) });
P.encode = function (img) {
  const { w, h, data } = img, raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(data.buffer, data.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6; ih[10] = 0; ih[11] = 0; ih[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
};
P.save = (img, file) => { fs.mkdirSync(require('path').dirname(file), { recursive: true }); fs.writeFileSync(file, P.encode(img)); return file; };
P.dataURI = (img) => 'data:image/png;base64,' + P.encode(img).toString('base64');
// nearest-neighbour scale by a whole factor
P.scale = function (img, k) {
  k = Math.max(1, k | 0); if (k === 1) return img;
  const W = img.w * k, H = img.h * k, out = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const si = (((y / k) | 0) * img.w + ((x / k) | 0)) * 4, di = (y * W + x) * 4; out[di] = img.data[si]; out[di + 1] = img.data[si + 1]; out[di + 2] = img.data[si + 2]; out[di + 3] = img.data[si + 3]; }
  return { w: W, h: H, data: out };
};
// pictures side by side (bottoms aligned), a gap between, on a ground colour
P.row = function (imgs, gap, bg) {
  gap = gap === undefined ? 12 : gap; bg = bg || [233, 237, 242, 255];
  const W = imgs.reduce((a, im) => a + im.w, 0) + gap * (imgs.length - 1), H = Math.max(...imgs.map((im) => im.h));
  const out = new Uint8Array(W * H * 4); for (let i = 0; i < W * H; i++) out.set(bg, i * 4);
  let ox = 0;
  for (const im of imgs) { const oy = H - im.h; for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) { const si = (y * im.w + x) * 4, a = im.data[si + 3] / 255; if (a <= 0) continue; const di = ((y + oy) * W + x + ox) * 4; for (let c = 0; c < 3; c++) out[di + c] = Math.round(im.data[si + c] * a + out[di + c] * (1 - a)); out[di + 3] = 255; } ox += im.w + gap; }
  return { w: W, h: H, data: out };
};
// the smallest box round the opaque pixels (a picture drawn on transparent ground, cropped to its content)
P.trim = function (img, pad) {
  pad = pad || 4; let x0 = img.w, y0 = img.h, x1 = -1, y1 = -1;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (img.data[(y * img.w + x) * 4 + 3] > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return img;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(img.w - 1, x1 + pad); y1 = Math.min(img.h - 1, y1 + pad);
  const W = x1 - x0 + 1, H = y1 - y0 + 1, out = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) out.set(img.data.subarray(((y + y0) * img.w + x0) * 4, ((y + y0) * img.w + x0 + W) * 4), y * W * 4);
  return { w: W, h: H, data: out };
};

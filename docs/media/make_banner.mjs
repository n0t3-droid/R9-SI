// The README's banner and GitHub's social preview from the marketing shots (test/marketing_shots.mjs):
//   docs/media/banner.jpg (1600 × 640): the golden-hour vista with the title
//   docs/media/social_preview.jpg (1280 × 640): for Settings → Social preview
//   docs/media/gallery.jpg (1600 × 900): four shots in a 2 × 2 grid
// usage: node docs/media/make_banner.mjs
import sharp from '/home/dev/.npm-global/lib/node_modules/sharp/lib/index.js';
import fs from 'fs';
const D = new URL('./', import.meta.url).pathname;
const shot = (n) => D + 'shot_' + n + '.jpg';
const title = (W, H) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#070b16" stop-opacity="0.88"/><stop offset="0.55" stop-color="#070b16" stop-opacity="0.35"/><stop offset="1" stop-color="#070b16" stop-opacity="0"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <text x="64" y="${H / 2 - 70}" font-family="DejaVu Sans" font-size="22" letter-spacing="5" fill="#7fe3e6">OPEN SOURCE · KOSTENLOS · IM BROWSER</text>
  <text x="60" y="${H / 2 + 40}" font-family="DejaVu Sans" font-weight="bold" font-size="132" fill="#ffffff">R9-SI</text>
  <text x="64" y="${H / 2 + 100}" font-family="DejaVu Sans" font-size="31" fill="#e8eef9">Eine ganze Voxelwelt in einer HTML-Datei.</text>
  <text x="64" y="${H / 2 + 142}" font-family="DejaVu Sans" font-size="22" fill="#b8c4da">Läuft auch auf schwachen PCs · keine Installation · keine Werbung</text>
</svg>`);
async function banner(src, W, H, out, pos) {
  const base = await sharp(src).resize(W, H, { fit: 'cover', position: pos || 'attention' }).toBuffer();
  await sharp(base).composite([{ input: title(W, H) }]).jpeg({ quality: 90, mozjpeg: true }).toFile(out);
}
await banner(shot('vista'), 1600, 640, D + 'banner.jpg', 'centre');
await banner(shot('vista'), 1280, 640, D + 'social_preview.jpg', 'centre');
const names = ['vista', 'isles', 'pier', 'aurora'].filter(n => fs.existsSync(shot(n)));   // (the pond's shot looks down into grass: not in the gallery)
if (names.length >= 2) {
  const cw = 799, ch = 449, gap = 2, cols = 2, rows = Math.ceil(names.length / cols);
  const tiles = await Promise.all(names.map(async (n, i) => ({ input: await sharp(shot(n)).resize(cw, ch, { fit: 'cover' }).toBuffer(), left: (i % cols) * (cw + gap), top: Math.floor(i / cols) * (ch + gap) })));
  await sharp({ create: { width: cols * cw + (cols - 1) * gap, height: rows * ch + (rows - 1) * gap, channels: 3, background: '#0b0f1a' } }).composite(tiles).jpeg({ quality: 88, mozjpeg: true }).toFile(D + 'gallery.jpg');
}
console.log('banner, social preview' + (names.length >= 2 ? ', gallery (' + names.length + ')' : ''));

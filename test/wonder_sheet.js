// Sheets of the eight wonders without a browser: each one is built, ray-cast in software over its block grid (faces
// coloured by the game's own texture averages, glass see-through) by day and by night (a dark sky, the light of every
// glowing block spread through the open cells like the game's block light, coloured) — to look at them while shaping
// them. Writes test/shots/wsheet_<type>.png (day front, day from the side, night front, night from low).
//   node test/wonder_sheet.js                  every type
//   node test/wonder_sheet.js kristall mondtempel
//   SEED=1234 SIZE=420 CUT=12 (cut away everything above row 12: a look inside)
const sharp = require('/home/claude/.npm-global/lib/node_modules/sharp');
require('./load_shared.js');
for (const f of ['tex_core', 'tex_recipes1', 'tex_recipes2', 'tex_recipes3', 'tex_recipes4', 'tex_recipes5', 'tex_recipes6', 'tex_items', 'tex_groceries', 'tex_vox', 'tex_layout', 'tex_build']) { try { require('../src/main/' + f + '.js'); } catch (e) { /* optional */ } }
const Forge = VR.Forge, R = VR.R, T = R.T, KEEP = 0xFFFF, W = VR.Wonders;
const SIZE = +(process.env.SIZE || 400), LABEL = 26, CUT = process.env.CUT ? +process.env.CUT : null, SEED = process.env.SEED ? parseInt(process.env.SEED, 16) : 0x5eed;
let AVG = null;
function textures() {
  if (AVG) return AVG;
  const L = R.texNames.length, cube = new Uint8Array(L), cut = new Uint8Array(L);
  for (let s = 0; s < T.shape.length; s++) { if (T.shape[s] === VR.SHAPE.CUBE && T.layer[s] === 0) for (let f = 0; f < 6; f++) cube[T.tex[s * 6 + f] & 0xfff] = 1; if (T.layer[s] === 1) for (let f = 0; f < 6; f++) cut[T.tex[s * 6 + f] & 0xfff] = 1; }
  AVG = VR.buildTextureArrays({ names: R.texNames, cubeMask: cube, cutoutMask: cut, bevel: 1 }).avgColor;
  return AVG;
}
const colCache = new Map();
function faceColor(s, face) {
  if (!s || s === KEEP) return null;
  const k = s * 8 + face; let c = colCache.get(k); if (c) return c;
  const avg = textures(), li = T.tex[s * 6 + face] & 0xfff;
  let r = avg[li * 4], g = avg[li * 4 + 1], b = avg[li * 4 + 2], a = avg[li * 4 + 3];
  const t = R.types[T.type[s]], nm = t ? t.name : '';
  if (!(a > 0)) { r = 0.6; g = 0.6; b = 0.6; a = 1; }
  const fl = T.flags[s], tc = T.tint[s];
  if (tc >= 8 && R.tintColors[tc - 8] !== undefined) { const v = R.tintColors[tc - 8]; r *= ((v >> 16) & 255) / 255; g *= ((v >> 8) & 255) / 255; b *= (v & 255) / 255; }
  else if (tc === 1 || tc === 2) { r *= 0.5; g *= 0.75; b *= 0.33; }
  else if (tc === 3) { r *= 0.25; g *= 0.46; b *= 0.9; }
  if (/(^|_)glass|_pane$|panorama|window|frosted|glass_rail|iron_bars|_bars$/.test(nm) && !/window_warm|vx_glass_wall/.test(nm)) a = Math.min(a, 0.45);
  if (fl & VR.F.FLUID) { r = 0.22; g = 0.42; b = 0.82; a = 0.62; }
  if (/leaves/.test(nm)) { if (!/cherry|azalea|flowering/.test(nm)) { r *= 0.55; g *= 0.85; b *= 0.5; } a = 1; }
  if (/^grass_block$/.test(nm) && face === 2) { r = 0.42; g = 0.66; b = 0.3; }
  if (/short_grass|tall_grass|fern|poppy|dandelion|tulip|cornflower|allium|daisy|lily/.test(nm)) { r = 0.4; g = 0.6; b = 0.3; a = 0.9; }
  c = [r * 255, g * 255, b * 255, a]; colCache.set(k, c); return c;
}
const emitOf = (s) => (s && s !== KEEP ? T.emit[s] : 0);
function norm(a) { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// the block light of a grid (r, g, b nibbles), spread like the game's: −1 − filter per step from every glowing block
function lightField(g) {
  const N = g.sx * g.sy * g.sz, L = [new Uint8Array(N), new Uint8Array(N), new Uint8Array(N)], q = new Int32Array(N * 3 + 16);
  const filter = (s) => (s === KEEP ? 15 : T.filter[s]);
  for (let ch = 0; ch < 3; ch++) {
    const A = L[ch]; let h = 0, t = 0;
    for (let i = 0; i < N; i++) { const e = emitOf(g.blocks[i]); const v = (e >> (8 - ch * 4)) & 15; if (v) { A[i] = v; q[t++] = i; } }
    while (h < t) {
      const i = q[h++], v = A[i]; if (v <= 1) continue;
      const x = i % g.sx, z = Math.floor(i / g.sx) % g.sz, y = Math.floor(i / (g.sx * g.sz));
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
        const nx = x + dx, ny = y + dy, nz = z + dz; if (nx < 0 || ny < 0 || nz < 0 || nx >= g.sx || ny >= g.sy || nz >= g.sz) continue;
        const n = (ny * g.sz + nz) * g.sx + nx, f = filter(g.blocks[n]); if (f >= 15) continue;
        const nv = v - 1 - f; if (nv > A[n]) { A[n] = nv; if (t < q.length) q[t++] = n; }
      }
    }
  }
  return L;
}
const VIEWS = { front: [0.62, -0.5, 0.78], side: [0.95, -0.42, -0.2], back: [-0.6, -0.5, -0.8], top: [0.2, -1, 0.3], low: [0.55, -0.2, 0.82] };
function render(g, size, view, night) {
  const W0 = g.sx, H = g.sy, D = g.sz, floorY = -g.dy, gnd = () => floorY - 1;
  const LF = night ? lightField(g) : null;
  const f = norm(VIEWS[view] || VIEWS.front), r = norm([-f[2], 0, f[0]]), u = cross(r, f);
  const pad = 3, lo = [-pad, Math.min(0, floorY - 4), -pad], hi = [W0 + pad, H, D + pad];
  let minU = 1e9, maxU = -1e9, minV = 1e9, maxV = -1e9;
  for (const x of [lo[0], hi[0]]) for (const y of [lo[1], hi[1]]) for (const z of [lo[2], hi[2]]) { const a = dot([x, y, z], r), b = dot([x, y, z], u); minU = Math.min(minU, a); maxU = Math.max(maxU, a); minV = Math.min(minV, b); maxV = Math.max(maxV, b); }
  const s = Math.max(maxU - minU, maxV - minV) * 1.03 / size, cu = (minU + maxU) / 2, cv = (minV + maxV) / 2;
  const img = Buffer.alloc(size * size * 4);
  const far = W0 + H + D + 40, light = norm([-0.45, 0.9, -0.35]);
  const inG = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < W0 && y < H && z < D;
  const at = (x, y, z) => {
    if (x < 0 || z < 0 || x >= W0 || z >= D) return y <= gnd() ? -2 : 0;
    if (y < 0) return -2;
    if (y >= H) return 0;
    if (CUT !== null && y > floorY + CUT) return 0;
    const sv = g.blocks[(y * D + z) * W0 + x];
    if (sv === KEEP) return y <= gnd() ? -2 : 0;
    return sv;
  };
  const lightAt = (x, y, z) => { if (!LF || !inG(x, y, z)) return [0, 0, 0]; const i = (y * D + z) * W0 + x; return [LF[0][i] / 15, LF[1][i] / 15, LF[2][i] / 15]; };
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const pu = cu + (i - size / 2) * s, pv = cv + (size / 2 - j) * s;
    const o = [r[0] * pu + u[0] * pv - f[0] * far, r[1] * pu + u[1] * pv - f[1] * far, r[2] * pu + u[2] * pv - f[2] * far];
    let acc = [0, 0, 0], accA = 0, col = null;
    let t0 = 0, t1 = 1e9;
    for (let k = 0; k < 3; k++) { if (Math.abs(f[k]) < 1e-9) { if (o[k] < lo[k] || o[k] > hi[k]) { t0 = 1e9; break; } continue; } let a = (lo[k] - o[k]) / f[k], b = (hi[k] - o[k]) / f[k]; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b); }
    if (t0 < t1) {
      const p = [o[0] + f[0] * (t0 + 1e-5), o[1] + f[1] * (t0 + 1e-5), o[2] + f[2] * (t0 + 1e-5)];
      let x = Math.floor(p[0]), y = Math.floor(p[1]), z = Math.floor(p[2]);
      const st = f.map(v => v > 0 ? 1 : -1), td = f.map(v => Math.abs(1 / v));
      const tm = [0, 1, 2].map(k => ((st[k] > 0 ? Math.floor(p[k]) + 1 - p[k] : p[k] - Math.floor(p[k])) * td[k]));
      let axis = 1, lastGlass = -1;
      { let best = -1, bt = -1e9; for (let k = 0; k < 3; k++) { if (Math.abs(f[k]) < 1e-9) continue; let a = (lo[k] - o[k]) / f[k], b = (hi[k] - o[k]) / f[k]; const e = Math.min(a, b); if (e > bt) { bt = e; best = k; } } axis = best; }
      for (let n = 0; n < far * 2; n++) {
        if (x < lo[0] || y < lo[1] || z < lo[2] || x >= hi[0] || y >= hi[1] || z >= hi[2]) break;
        const sv = at(x, y, z);
        if (sv) {
          const face = axis === 0 ? (st[0] > 0 ? 1 : 0) : axis === 1 ? (st[1] > 0 ? 3 : 2) : (st[2] > 0 ? 5 : 4);
          let c = sv === -2 ? ((face === 2) ? [112, 158, 78, 1] : [122, 94, 62, 1]) : faceColor(sv, face);
          if (c) {
            const nrm = [0, 0, 0]; nrm[axis] = -st[axis];
            const em = sv > 0 ? emitOf(sv) : 0;
            let cc;
            if (!night) { const sh = em ? 1.12 : 0.5 + 0.55 * Math.max(0, dot(nrm, light)) + (axis === 1 && nrm[1] > 0 ? 0.08 : 0); cc = [c[0] * sh, c[1] * sh, c[2] * sh]; }
            else {
              const px = x - (axis === 0 ? st[0] : 0), py = y - (axis === 1 ? st[1] : 0), pz = z - (axis === 2 ? st[2] : 0);
              const Lb = lightAt(px, py, pz), moon = 0.13 + 0.07 * Math.max(0, nrm[1]);
              if (em) cc = [c[0] * 1.25 + 30, c[1] * 1.25 + 30, c[2] * 1.25 + 30];
              else cc = [c[0] * (moon * 0.8 + Lb[0] * 1.15), c[1] * (moon * 0.9 + Lb[1] * 1.1), c[2] * (moon * 1.3 + Lb[2] * 1.05)];
            }
            cc = cc.map(v => Math.min(255, v));
            if (c[3] < 0.95) { if (lastGlass !== sv) { const a = c[3]; for (let k = 0; k < 3; k++) acc[k] += (1 - accA) * a * cc[k]; accA += (1 - accA) * a; } lastGlass = sv; }
            else { col = cc; break; }
          }
        } else lastGlass = -1;
        const k = tm[0] < tm[1] ? (tm[0] < tm[2] ? 0 : 2) : (tm[1] < tm[2] ? 1 : 2);
        if (k === 0) { x += st[0]; tm[0] += td[0]; } else if (k === 1) { y += st[1]; tm[1] += td[1]; } else { z += st[2]; tm[2] += td[2]; }
        axis = k;
      }
    }
    const bg = night ? [10 + j * 0.02, 14 + j * 0.03, 34 + j * 0.05] : [196 + j * 0.05, 214 + j * 0.04, 236];
    const base = col || bg;
    const q = (j * size + i) * 4; for (let k = 0; k < 3; k++) img[q + k] = Math.max(0, Math.min(255, acc[k] + (1 - accA) * base[k])); img[q + 3] = 255;
  }
  return img;
}
(async () => {
  const want = process.argv.slice(2);
  for (const t of W.TYPES) {
    if (want.length && !want.includes(t.id)) continue;
    const dna = W.dna(t.id, SEED), t0 = Date.now(), g = Forge.build(dna), ms = Date.now() - t0;
    const cells = [['front', false], ['side', false], ['front', true], ['low', true]];
    const comps = []; let svg = `<svg width="${SIZE * 4}" height="${SIZE + LABEL}" xmlns="http://www.w3.org/2000/svg">`;
    cells.forEach(([view, night], k) => { comps.push({ input: render(g, SIZE - 6, view, night), raw: { width: SIZE - 6, height: SIZE - 6, channels: 4 }, left: k * SIZE + 3, top: 3 }); });
    let glow = 0; for (const s of g.blocks) if (emitOf(s)) glow++;
    const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    svg += `<text x="8" y="${SIZE + 17}" font-family="DejaVu Sans, sans-serif" font-size="14" fill="#222">${esc(t.icon + ' ' + t.de + ' · ' + dna + ' · ' + g.sx + '×' + g.sy + '×' + g.sz + ' · ' + g.meta.n.toLocaleString() + ' cells · ' + glow + ' glowing · ' + ms + ' ms · heart ' + JSON.stringify(g.meta.heart))}</text></svg>`;
    comps.push({ input: Buffer.from(svg), left: 0, top: 0 });
    const file = __dirname + '/shots/wsheet_' + t.id + '.png';
    await sharp({ create: { width: SIZE * 4, height: SIZE + LABEL, channels: 4, background: { r: 250, g: 250, b: 250, alpha: 1 } } }).composite(comps).png().toFile(file);
    console.log(file, g.sx + '×' + g.sy + '×' + g.sz, ms + ' ms', glow + ' glowing');
  }
})();

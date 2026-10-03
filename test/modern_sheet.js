// Thumbnail sheets of the Modern Living pack (a look at every model, no browser needed): each model is built and
// ray-cast in software (front-left view from above; glowing voxels bright, glass see-through), labelled, and laid out
// per set into test/shots/modern_<set>.png.
//   node test/modern_sheet.js            every set
//   node test/modern_sheet.js light      one set (or any id regex);  --off  shows the lamps switched off
const sharp = require('/home/claude/.npm-global/lib/node_modules/sharp');
require('./load_shared.js');
const R = VR.R, VM = VR.VM, VX = VR.VX;
const arg = process.argv.slice(2).filter(a => !a.startsWith('--'))[0] || '';
const OFF = process.argv.includes('--off');
const CELL = 230, LABEL = 34, COLS = 6;
const EMIS = VX.EMIS, GLASS = VX.GLASS, PRESENT = VX.PRESENT;

function render(m, size) {
  VM.materialize(m);
  const W = m.VW, H = m.VH, D = m.VD;
  const f = norm([0.62, -0.55, 1]), r = norm([-f[2], 0, f[0]]), u = cross(r, f);
  // fit: project the 8 corners
  let minU = 1e9, maxU = -1e9, minV = 1e9, maxV = -1e9;
  for (const x of [0, W]) for (const y of [0, H]) for (const z of [0, D]) { const a = dot([x, y, z], r), b = dot([x, y, z], u); minU = Math.min(minU, a); maxU = Math.max(maxU, a); minV = Math.min(minV, b); maxV = Math.max(maxV, b); }
  const span = Math.max(maxU - minU, maxV - minV) * 1.06, s = span / size, cu = (minU + maxU) / 2, cv = (minV + maxV) / 2;
  const img = Buffer.alloc(size * size * 4);
  const far = W + H + D;
  const light = norm([0.35, 0.9, -0.45]);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const pu = cu + (i - size / 2) * s, pv = cv + (size / 2 - j) * s;
    const o = [r[0] * pu + u[0] * pv - f[0] * far, r[1] * pu + u[1] * pv - f[1] * far, r[2] * pu + u[2] * pv - f[2] * far];
    let col = null, alpha = 1, acc = [0, 0, 0], accA = 0;
    // slab entry
    let t0 = 0, t1 = 1e9;
    for (let k = 0; k < 3; k++) { const lo = 0, hi = [W, H, D][k]; if (Math.abs(f[k]) < 1e-9) { if (o[k] < lo || o[k] > hi) { t0 = 1e9; break; } continue; } let a = (lo - o[k]) / f[k], b = (hi - o[k]) / f[k]; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b); }
    if (t0 < t1) {
      const p = [o[0] + f[0] * (t0 + 1e-6), o[1] + f[1] * (t0 + 1e-6), o[2] + f[2] * (t0 + 1e-6)];
      let x = Math.min(W - 1, Math.max(0, Math.floor(p[0]))), y = Math.min(H - 1, Math.max(0, Math.floor(p[1]))), z = Math.min(D - 1, Math.max(0, Math.floor(p[2])));
      const st = f.map(v => v > 0 ? 1 : -1), td = f.map(v => Math.abs(1 / v));
      let tm = [0, 1, 2].map(k => ((st[k] > 0 ? Math.floor(p[k]) + 1 - p[k] : p[k] - Math.floor(p[k])) * td[k]));
      let face = t0 === (() => 0)() ? -1 : -1, lastAxis = -1;
      // which slab we entered through
      { let best = -1, bt = -1e9; for (let k = 0; k < 3; k++) { if (Math.abs(f[k]) < 1e-9) continue; const lo = 0, hi = [W, H, D][k]; let a = (lo - o[k]) / f[k], b = (hi - o[k]) / f[k]; const e = Math.min(a, b); if (e > bt) { bt = e; best = k; } } lastAxis = best; }
      for (let n = 0; n < W + H + D + 4; n++) {
        const v = m.get(x, y, z);
        if (v & PRESENT) {
          const c = [(v >> 16) & 255, (v >> 8) & 255, v & 255];
          let sh;
          if (v & EMIS) sh = 1.12;
          else { const nrm = [0, 0, 0]; nrm[lastAxis] = -st[lastAxis]; sh = 0.52 + 0.55 * Math.max(0, dot(nrm, light)) + (lastAxis === 1 ? 0.06 : 0); }
          const cc = c.map(q => Math.min(255, q * sh));
          if (v & GLASS) { const a = 0.38; for (let k = 0; k < 3; k++) acc[k] += (1 - accA) * a * cc[k]; accA += (1 - accA) * a; }
          else { col = cc; break; }
        }
        const k = tm[0] < tm[1] ? (tm[0] < tm[2] ? 0 : 2) : (tm[1] < tm[2] ? 1 : 2);
        if (k === 0) { x += st[0]; tm[0] += td[0]; } else if (k === 1) { y += st[1]; tm[1] += td[1]; } else { z += st[2]; tm[2] += td[2]; }
        lastAxis = k; void face;
        if (x < 0 || y < 0 || z < 0 || x >= W || y >= H || z >= D) break;
      }
    }
    const bg = [236 - j * 0.08, 238 - j * 0.08, 242 - j * 0.06];
    const base = col || bg;
    const out = [0, 1, 2].map(k => acc[k] + (1 - accA) * base[k]);
    const q = (j * size + i) * 4; img[q] = out[0]; img[q + 1] = out[1]; img[q + 2] = out[2]; img[q + 3] = 255;
    void alpha;
  }
  return img;
}
function norm(a) { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');

async function sheet(tag, types) {
  const rows = Math.ceil(types.length / COLS), Wd = COLS * CELL, Ht = rows * (CELL + LABEL);
  const comps = [];
  let svg = `<svg width="${Wd}" height="${Ht}" xmlns="http://www.w3.org/2000/svg">`;
  types.forEach((t, k) => {
    const m = VM.MODELS[t.name];
    let img;
    if (OFF && t.o.toggle) { // the switched-off look: paint the off colour into a copy of the volume
      VM.materialize(m); const pal = m.pal, keep = pal.slice();
      for (let i = 0; i < pal.length; i++) if (pal[i] & EMIS) pal[i] = VM.M.gloss(VM.offColor(pal[i]));
      img = render(m, CELL - 10); for (let i = 0; i < pal.length; i++) pal[i] = keep[i];
    } else img = render(m, CELL - 10);
    const cx = (k % COLS) * CELL, cy = Math.floor(k / COLS) * (CELL + LABEL);
    comps.push({ input: img, raw: { width: CELL - 10, height: CELL - 10, channels: 4 }, left: cx + 5, top: cy + 5 });
    svg += `<text x="${cx + CELL / 2}" y="${cy + CELL + 12}" font-family="DejaVu Sans, sans-serif" font-size="12" text-anchor="middle" fill="#222">${esc(t.display)}</text>`;
    svg += `<text x="${cx + CELL / 2}" y="${cy + CELL + 26}" font-family="DejaVu Sans Mono, monospace" font-size="9.5" text-anchor="middle" fill="#777">${esc(t.name.replace(/^vm_/, ''))} · ${m.W}×${m.H}×${m.D} · 1/${m.res}</text>`;
  });
  svg += '</svg>';
  comps.push({ input: Buffer.from(svg), left: 0, top: 0 });
  const file = '/home/claude/vr/test/shots/modern_' + tag + (OFF ? '_off' : '') + '.png';
  await sharp({ create: { width: Wd, height: Ht, channels: 4, background: { r: 250, g: 250, b: 250, alpha: 1 } } }).composite(comps).png().toFile(file);
  console.log('sheet', file, types.length, 'models');
}
(async () => {
  const pack = R.types.filter(t => t.o.modern);
  const sets = [...new Set(pack.map(t => t.name.split('_')[1]))];
  if (arg && sets.includes(arg)) await sheet(arg, pack.filter(t => t.name.split('_')[1] === arg));
  else if (arg) await sheet('pick', pack.filter(t => new RegExp(arg).test(t.name)));
  else for (const s of sets) await sheet(s, pack.filter(t => t.name.split('_')[1] === s));
})();

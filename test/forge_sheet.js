// Thumbnail sheets of the Forge's structures (a look at every type × style, no browser needed): each DNA is built,
// ray-cast in software over the block grid (front-left view from above, faces coloured by the game's own texture
// averages, glass see-through, ground drawn under the floor — with the terrain profile for bridges and walls),
// labelled, and laid out into test/shots/forge_<type>.png.
//   node test/forge_sheet.js            every type
//   node test/forge_sheet.js tower      one type
//   node test/forge_sheet.js 'tower:f30,glas#3' 'bridge:l60,k2,stahl#1'   any DNAs onto forge_pick.png
//   SIZE=420 for bigger cells; VIEW=front|side|back for other angles
const sharp = require('/home/claude/.npm-global/lib/node_modules/sharp');
require('./load_shared.js');
for (const f of ['tex_core', 'tex_recipes1', 'tex_recipes2', 'tex_recipes3', 'tex_recipes4', 'tex_recipes5', 'tex_recipes6', 'tex_items', 'tex_groceries', 'tex_vox', 'tex_build']) { try { require('../src/main/' + f + '.js'); } catch (e) { /* optional */ } }
const Forge = VR.Forge, R = VR.R, T = R.T, KEEP = 0xFFFF;
const args = process.argv.slice(2);
const SIZE = +(process.env.SIZE || 330), LABEL = 34, COLS = +(process.env.COLS || 4), VIEW = process.env.VIEW || 'front';
// ---- face colours from the texture build (average colour + coverage per layer)
let AVG = null;
function textures() {
  if (AVG) return AVG;
  const L = R.texNames.length, cube = new Uint8Array(L), cut = new Uint8Array(L);
  for (let s = 0; s < T.shape.length; s++) { if (T.shape[s] === VR.SHAPE.CUBE && T.layer[s] === 0) for (let f = 0; f < 6; f++) cube[T.tex[s * 6 + f] & 0xfff] = 1; if (T.layer[s] === 1) for (let f = 0; f < 6; f++) cut[T.tex[s * 6 + f] & 0xfff] = 1; }
  AVG = VR.buildTextureArrays({ names: R.texNames, cubeMask: cube, cutoutMask: cut, bevel: 1 }).avgColor;
  return AVG;
}
const colCache = new Map();
// [r, g, b, a] of a state's face (0 +x, 1 −x, 2 +y, 3 −y, 4 +z, 5 −z); air and keep → null
function faceColor(s, face) {
  if (!s || s === KEEP) return null;
  const k = s * 8 + face; let c = colCache.get(k); if (c) return c;
  const avg = textures(), li = T.tex[s * 6 + face] & 0xfff;
  let r = avg[li * 4], g = avg[li * 4 + 1], b = avg[li * 4 + 2], a = avg[li * 4 + 3];
  const t = R.types[T.type[s]], nm = t ? t.name : '';
  if (!(a > 0)) { r = 0.6; g = 0.6; b = 0.6; a = 1; }
  const fl = T.flags[s];
  // panes, glass, water: see-through
  if (/glass|pane|panorama|window|frosted|rail$/.test(nm) && !/window_warm/.test(nm)) a = Math.min(a, 0.42);
  if (fl & VR.F.FLUID) { r = 0.25; g = 0.45; b = 0.85; a = 0.6; }
  if (/leaves/.test(nm)) { r *= 0.55; g *= 0.85; b *= 0.5; a = 1; }
  if (/^grass_block$/.test(nm) && face === 2) { r = 0.42; g = 0.66; b = 0.3; }
  if (/short_grass|tall_grass|fern|flower|poppy|dandelion|tulip|cornflower|allium|daisy|lily/.test(nm)) { r = 0.4; g = 0.6; b = 0.3; a = 0.9; }
  c = [r * 255, g * 255, b * 255, a]; colCache.set(k, c); return c;
}
const glowing = (s) => s && s !== KEEP && T.emit[s] > 0;
function norm(a) { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const VIEWS = { front: [0.62, -0.5, 0.78], side: [0.95, -0.45, 0.25], back: [-0.6, -0.5, -0.8], top: [0.2, -1, 0.3], low: [0.7, -0.22, 0.75] };
// render a grid: ground under the floor (with a terrain profile when given), an orthographic view, Lambert shading
function render(g, size, ground) {
  const W = g.sx, H = g.sy, D = g.sz, floorY = -g.dy;                      // floorY: the row of world F
  const gnd = (x, z) => floorY - 1 + (ground ? ground(x, z) + 1 : 0);      // the top row of the earth (world F − 1 on flat ground)
  const f = norm(VIEWS[VIEW] || VIEWS.front), r = norm([-f[2], 0, f[0]]), u = cross(r, f);
  const pad = 2, lo = [-pad, Math.min(0, floorY - 6), -pad], hi = [W + pad, H, D + pad];
  let minU = 1e9, maxU = -1e9, minV = 1e9, maxV = -1e9;
  for (const x of [lo[0], hi[0]]) for (const y of [lo[1], hi[1]]) for (const z of [lo[2], hi[2]]) { const a = dot([x, y, z], r), b = dot([x, y, z], u); minU = Math.min(minU, a); maxU = Math.max(maxU, a); minV = Math.min(minV, b); maxV = Math.max(maxV, b); }
  const spanU = maxU - minU, spanV = maxV - minV, s = Math.max(spanU, spanV) * 1.04 / size, cu = (minU + maxU) / 2, cv = (minV + maxV) / 2;
  const img = Buffer.alloc(size * size * 4);
  const far = W + H + D + 40, light = norm([-0.45, 0.9, -0.35]);
  const at = (x, y, z) => {
    if (x < 0 || z < 0 || x >= W || z >= D) return y <= gnd(Math.max(0, Math.min(W - 1, x)), Math.max(0, Math.min(D - 1, z))) ? -2 : 0;
    if (y < 0) return -2;
    if (y >= H) return 0;
    const s = g.blocks[(y * D + z) * W + x];
    if (s === KEEP) return y <= gnd(x, z) ? -2 : 0;
    return s;
  };
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const pu = cu + (i - size / 2) * s, pv = cv + (size / 2 - j) * s;
    const o = [r[0] * pu + u[0] * pv - f[0] * far, r[1] * pu + u[1] * pv - f[1] * far, r[2] * pu + u[2] * pv - f[2] * far];
    let acc = [0, 0, 0], accA = 0, col = null;
    // enter the scene box
    let t0 = 0, t1 = 1e9;
    for (let k = 0; k < 3; k++) { if (Math.abs(f[k]) < 1e-9) { if (o[k] < lo[k] || o[k] > hi[k]) { t0 = 1e9; break; } continue; } let a = (lo[k] - o[k]) / f[k], b = (hi[k] - o[k]) / f[k]; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b); }
    if (t0 < t1) {
      const p = [o[0] + f[0] * (t0 + 1e-5), o[1] + f[1] * (t0 + 1e-5), o[2] + f[2] * (t0 + 1e-5)];
      let x = Math.floor(p[0]), y = Math.floor(p[1]), z = Math.floor(p[2]);
      const st = f.map(v => v > 0 ? 1 : -1), td = f.map(v => Math.abs(1 / v));
      const tm = [0, 1, 2].map(k => ((st[k] > 0 ? Math.floor(p[k]) + 1 - p[k] : p[k] - Math.floor(p[k])) * td[k]));
      let axis = 1, lastGlass = -1;
      { let best = -1, bt = -1e9; for (let k = 0; k < 3; k++) { if (Math.abs(f[k]) < 1e-9) continue; let a = (lo[k] - o[k]) / f[k], b = (hi[k] - o[k]) / f[k]; const e = Math.min(a, b); if (e > bt) { bt = e; best = k; } } axis = best; }
      for (let n = 0; n < far; n++) {
        if (x < lo[0] || y < lo[1] || z < lo[2] || x >= hi[0] || y >= hi[1] || z >= hi[2]) break;
        const sv = at(x, y, z);
        if (sv) {
          const face = axis === 0 ? (st[0] > 0 ? 1 : 0) : axis === 1 ? (st[1] > 0 ? 3 : 2) : (st[2] > 0 ? 5 : 4);
          let c;
          if (sv === -2) c = (face === 2) ? [112, 158, 78, 1] : [122, 94, 62, 1];
          else c = faceColor(sv, face);
          if (c) {
            const nrm = [0, 0, 0]; nrm[axis] = -st[axis];
            const sh = glowing(sv) ? 1.15 : 0.5 + 0.55 * Math.max(0, dot(nrm, light)) + (axis === 1 && nrm[1] > 0 ? 0.08 : 0);
            const cc = [Math.min(255, c[0] * sh), Math.min(255, c[1] * sh), Math.min(255, c[2] * sh)];
            if (c[3] < 0.95) { if (lastGlass !== sv) { const a = c[3]; for (let k = 0; k < 3; k++) acc[k] += (1 - accA) * a * cc[k]; accA += (1 - accA) * a; } lastGlass = sv; }
            else { col = cc; break; }
          }
        } else lastGlass = -1;
        const k = tm[0] < tm[1] ? (tm[0] < tm[2] ? 0 : 2) : (tm[1] < tm[2] ? 1 : 2);
        if (k === 0) { x += st[0]; tm[0] += td[0]; } else if (k === 1) { y += st[1]; tm[1] += td[1]; } else { z += st[2]; tm[2] += td[2]; }
        axis = k;
      }
    }
    const bg = [196 + j * 0.05, 214 + j * 0.04, 236];
    const base = col || bg;
    const q = (j * size + i) * 4; for (let k = 0; k < 3; k++) img[q + k] = Math.max(0, Math.min(255, acc[k] + (1 - accA) * base[k])); img[q + 3] = 255;
  }
  return img;
}
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
async function sheet(tag, items) {
  const cols = Math.min(COLS, items.length), rows = Math.ceil(items.length / cols), Wd = cols * SIZE, Ht = rows * (SIZE + LABEL);
  const comps = []; let svg = `<svg width="${Wd}" height="${Ht}" xmlns="http://www.w3.org/2000/svg">`;
  items.forEach((it, k) => {
    const t0 = Date.now();
    let g; try { g = Forge.build(it.dna, it.env); } catch (e) { console.log('  ✗ ' + it.dna + ': ' + e.message); return; }
    const img = render(g, SIZE - 8, it.ground);
    const cx = (k % cols) * SIZE, cy = Math.floor(k / cols) * (SIZE + LABEL);
    comps.push({ input: img, raw: { width: SIZE - 8, height: SIZE - 8, channels: 4 }, left: cx + 4, top: cy + 4 });
    svg += `<text x="${cx + SIZE / 2}" y="${cy + SIZE + 12}" font-family="DejaVu Sans, sans-serif" font-size="12" text-anchor="middle" fill="#222">${esc(Forge.describe(it.dna))}</text>`;
    svg += `<text x="${cx + SIZE / 2}" y="${cy + SIZE + 26}" font-family="DejaVu Sans Mono, monospace" font-size="9.5" text-anchor="middle" fill="#777">${esc(it.dna)} · ${g.sx}×${g.sy}×${g.sz} · ${g.meta.n.toLocaleString()} · ${g.meta.ms.toFixed(0)} ms build · ${Date.now() - t0} ms</text>`;
    console.log('  ' + it.dna + ' · ' + g.sx + '×' + g.sy + '×' + g.sz + ' · ' + g.meta.n + ' cells · build ' + g.meta.ms.toFixed(0) + ' ms');
  });
  svg += '</svg>';
  comps.push({ input: Buffer.from(svg), left: 0, top: 0 });
  const file = __dirname + '/shots/forge_' + tag + '.png';
  await sharp({ create: { width: Wd, height: Ht, channels: 4, background: { r: 250, g: 250, b: 250, alpha: 1 } } }).composite(comps).png().toFile(file);
  console.log('sheet', file, items.length, 'structures');
}
// what each sheet shows: every style, plus the parameters that change the shape
const hill = (u, v) => -3 - Math.round(6 * Math.sin(v / 7));
const valley = (u, v) => -Math.round(10 * Math.sin(Math.PI * v / 59)) - 2;
const SHEETS = {
  tower: (t) => t.styles.map((s, i) => ({ dna: Forge.dna('tower', { f: [16, 24, 10, 32, 20][i % 5], w: [20, 18, 24, 22, 20][i % 5], d: [18, 18, 20, 22, 20][i % 5], c: i % 4, u: i & 1, s: i % 3 }, 3 + i, s.id) })).concat([{ dna: 'tower:f48,w26,d24,glas,c3#9' }, { dna: 'tower:f6,w16,d16,backstein,p0,s0,c1,u1#4' }, { dna: 'tower:f40,w30,d30,tech,s2,c2#5' }]),
  house: (t) => t.styles.map((s, i) => ({ dna: Forge.dna('house', { f: 1 + (i % 3), r: i & 1, g: i % 3, t: 1, c: (i + 1) & 1, b: 1, p: i & 1 }, 11 + i, s.id) })).concat([{ dna: 'house:f2,w17,d12,weiss,g2,t1,c1,b1,p1#21' }, { dna: 'house:f3,w13,d10,anthrazit,r1,g2,t1#22' }, { dna: 'house:f1,w15,d11,holz,r1,g1,t1,c1#23' }]),
  bridge: (t) => t.styles.map((s, i) => ({ dna: Forge.dna('bridge', { l: 60, w: 5 + (i & 1) * 2, k: i % 3, r: i & 1, m: 1 }, 5 + i, s.id), env: { ground: valley }, ground: valley })).concat([{ dna: 'bridge:l80,w7,k2,r1,m1,stahl#8', env: { ground: valley }, ground: valley }, { dna: 'bridge:l40,w4,k1,stein#9', env: { ground: hill }, ground: hill }, { dna: 'bridge:l30,w3,k0,holz#2', env: { ground: hill }, ground: hill }]),
  wall: (t) => t.styles.map((s, i) => ({ dna: Forge.dna('wall', { l: 40, h: 2 + (i % 3), k: i % 3, g: 1 }, 2 + i, s.id), env: { ground: hill }, ground: hill })),
  lookout: (t) => t.styles.map((s, i) => ({ dna: Forge.dna('lookout', { h: 16 + i * 6, k: i & 1, p: 5 + (i & 1) * 2, r: i & 1 }, 4 + i, s.id) })),
  hall: (t) => t.styles.map((s, i) => ({ dna: Forge.dna('hall', { l: 32 + i * 4, w: 16 + i * 2, h: 8 + i, c: 1, m: i & 1 }, 6 + i, s.id) })),
  castle: (t) => t.styles.map((s, i) => ({ dna: Forge.dna('castle', { w: 36 + i * 4, d: 32 + i * 2, h: 7 + i, t: i & 1, k: 1 }, 8 + i, s.id) })),
  shuttle: (t) => t.styles.map((s, i) => ({ dna: Forge.dna('shuttle', { a: i % 6, p: i & 1 }, 21 + i, s.id) })),
  park: (t) => t.styles.map((s, i) => ({ dna: Forge.dna('park', { w: 32, d: 28, t: 1 + (i % 3), p: i & 1, f: (i + 1) & 1 }, 13 + i, s.id) })),
  stadium: (t) => t.styles.map((s, i) => ({ dna: Forge.dna('stadium', {}, 1 + i, s.id) })),
};
(async () => {
  const want = args.filter(a => !a.includes(':')), dnas = args.filter(a => a.includes(':'));
  if (dnas.length) { await sheet('pick', dnas.map(d => ({ dna: d, env: Forge.meta(d) && Forge.meta(d).terrain ? { ground: valley } : null, ground: Forge.meta(d) && Forge.meta(d).terrain ? valley : null }))); return; }
  for (const t of Forge.types) { if (want.length && !want.includes(t.id)) continue; const mk = SHEETS[t.id]; if (!mk) continue; console.log('— ' + t.icon + ' ' + t.id); await sheet(t.id, mk(t)); }
})();

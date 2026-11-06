// v-flora · the pictures' places found in node (docs/superpowers/plans/2026-11-05-v-flora.md): before a browser is
// asked, the views of flora.mjs are chosen and drawn from the generated chunks of seed 4242 (vgen 16 and 17, the same
// ground): a small ray picture (block by block, flat colours by block, flowers and sprites as solid cells, the air
// thickening with distance) — test/vista_preview.js's method.
//   meadow   the best colour field near a way: candidate eyes along the ways within 260 blocks, eight headings each,
//            scored by the share of the picture's lower half that is flowers (vgen 17) — the walk a player takes
//   tree     a lone L-system blossom tree in the meadow (the planter recorded), the camera 13 blocks off, nothing between
//   giant    Traumbaum 0, the heading with the crown free; ring / ringnight: glow ring 0 from 9 blocks, a little above
//   vista    over the land toward Traumbaum 0, 70 blocks off and 24 up
// → test/shots/flora_views.json (the poses flora.mjs reads) and test/shots/flora_preview.png (16 | 17 per view)
//   bash test/wt_run.sh flora_preview.js 900
const V = require('./load_shared.js');
const fs = require('fs');
const sharp = require('/home/dev/.npm-global/lib/node_modules/sharp/lib/index.js');
const R = V.R, F = V.F, RT = R.T, LAND = V.Land, FL = V.Flora;
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const SEED = +(process.env.SEED || 4242), W = +(process.env.W || 320), H = Math.round(W * 9 / 16), ASPECT = 16 / 9, FOV = 70;
const SHOTS = __dirname.replace(/\/\.tmp_tests$/, '/test') + '/shots';
fs.mkdirSync(SHOTS, { recursive: true });
const gens = { 16: V.makeGen('overworld', SEED, { vgen: 16 }), 17: V.makeGen('overworld', SEED, { vgen: 17 }) };
const CH = { 16: new Map(), 17: new Map() };
let VG = 17;
const chunk = (cx, cz) => { const M = CH[VG], k = cx * 65536 + cz; let c = M.get(k); if (!c) { c = gens[VG].generate(cx, cz).blocks; M.set(k, c); if (M.size > 700) M.delete(M.keys().next().value); } return c; };
const blockAt = (x, y, z) => (y < 0 || y > 255 ? 0 : chunk(x >> 4, z >> 4)[(y << 8) | ((z & 15) << 4) | (x & 15)]);
const nameOf = (s) => (s ? R.types[RT.type[s]].name : 'air');
const hits = (s) => s && !!((RT.flags[s] & (F.OPAQUE | F.LEAVES | F.FLUID | F.SOLID | F.PLANT)));
const FLOWER = /tulip|poppy|daisy|cornflower|wildflowers|allium|bluet|dandelion|lily_of|petals|candle_flower|umbel_flower|bell_tower|glowbell|lilac|peony|rose_bush|sunflower/;
const PAL = new Map();
const colOf = (s) => {
  let c = PAL.get(s); if (c) return c;
  const n = nameOf(s);
  const rules = [
    [/bloom_snow/, [238, 240, 248]], [/bloom_lilac/, [168, 120, 214]], [/bloom_gold/, [240, 196, 60]], [/bloom_rose|cherry.*leaves/, [232, 124, 164]],
    [/pink_petals|pink_tulip|bell_tower/, [240, 150, 190]], [/poppy|red_tulip|rose/, [214, 46, 40]], [/cornflower|candle_flower/, [86, 104, 220]],
    [/dandelion|sunflower/, [246, 214, 40]], [/oxeye|white_tulip|umbel|lily_of|azure/, [240, 240, 236]], [/allium|lilac/, [176, 96, 214]],
    [/glowbell/, [150, 220, 255]], [/clover/, [118, 170, 84]], [/wildflowers|orange_tulip/, [244, 160, 60]],
    [/tall_grass|short_grass|^grass$|fern|bush/, [96, 152, 60]], [/leaves/, [52, 98, 44]], [/_log$|_wood$|stem$/, [96, 70, 46]],
    [/grass_block|moss/, [86, 140, 58]], [/coarse|dirt|path|podzol|mud|farmland/, [128, 92, 60]], [/sand/, [214, 200, 154]],
    [/water/, [58, 108, 168]], [/snow/, [242, 246, 250]], [/glass|pane/, [170, 204, 226]],
    [/bench|plank|fence|door|barrel|crate/, [150, 108, 64]], [/stone|cobble|gravel|andesite|brick/, [128, 124, 118]],
  ];
  c = [150, 140, 130];
  for (const [re, col] of rules) if (re.test(n)) { c = col; break; }
  PAL.set(s, c); return c;
};
const basis = (yaw, pitch) => { const cp = Math.cos(pitch), sp = Math.sin(pitch), f = [-Math.sin(yaw) * cp, sp, -Math.cos(yaw) * cp], r = [Math.cos(yaw), 0, -Math.sin(yaw)], u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]]; return { f, r, u }; };
const FAR = 160;
// a plant is a crossed sprite: the ray's samples inside the cell near one of the two diagonal planes, under 0.9
const sprite = (e, d, t0, t1, x, y, z) => { for (let k = 0; k < 6; k++) { const t = t0 + (t1 - t0) * (k + 0.5) / 6, fx = e[0] + d[0] * t - x, fy = e[1] + d[1] * t - y, fz = e[2] + d[2] * t - z; if (fy < 0.9 && (Math.abs(fx - fz) < 0.09 || Math.abs(fx + fz - 1) < 0.09)) return t; } return -1; };
function cast(e, d) {
  let x = Math.floor(e[0]), y = Math.floor(e[1]), z = Math.floor(e[2]);
  const sx = d[0] > 0 ? 1 : -1, sy = d[1] > 0 ? 1 : -1, sz = d[2] > 0 ? 1 : -1;
  const tdx = Math.abs(1 / (d[0] || 1e-9)), tdy = Math.abs(1 / (d[1] || 1e-9)), tdz = Math.abs(1 / (d[2] || 1e-9));
  let tx = (d[0] > 0 ? x + 1 - e[0] : e[0] - x) * tdx, ty = (d[1] > 0 ? y + 1 - e[1] : e[1] - y) * tdy, tz = (d[2] > 0 ? z + 1 - e[2] : e[2] - z) * tdz;
  let s = 0, face = 1;
  for (let k = 0; k < 2000; k++) {
    if (s > FAR || (y > 200 && d[1] >= 0) || y < 0) return null;
    const b = blockAt(x, y, z);
    if (hits(b)) { if (!(RT.flags[b] & F.PLANT) || (RT.flags[b] & F.LEAVES)) return { s, b, face, x, y, z }; const t = sprite(e, d, s, Math.min(tx, ty, tz), x, y, z); if (t >= 0) return { s: t, b, face: 0, x, y, z, fy: (e[1] + d[1] * t) - y }; }
    if (tx < ty && tx < tz) { s = tx; tx += tdx; x += sx; face = 0; } else if (ty < tz) { s = ty; ty += tdy; y += sy; face = 1; } else { s = tz; tz += tdz; z += sz; face = 2; }
  }
  return null;
}
const SKY0 = [196, 206, 222], SKY1 = [92, 120, 176];
const shade = (hit, d) => {
  if (!hit) { const t = Math.max(0, Math.min(1, d[1] * 2.2 + 0.1)); return SKY0.map((a, i) => a + (SKY1[i] - a) * t); }
  const c = hit.fy !== undefined && hit.fy < 0.45 && !/petals|clover/.test(nameOf(hit.b)) ? [78, 132, 52] : colOf(hit.b), k = hit.face === 1 ? 1 : hit.face === 0 ? 0.8 : 0.66, a = 1 - Math.exp(-hit.s / 220);
  return c.map((v, i) => v * k * (1 - a) + SKY0[i] * a);
};
// a view: eye, yaw, pitch → the picture (w × h) and its measures (flowers in the lower half, blossom, near blockers)
function view(v, w, h, img) {
  const { f, r, u } = basis(v.yaw, v.pitch), tf = Math.tan(FOV * Math.PI / 360), d = [0, 0, 0];
  let fl = 0, low = 0, bloom = 0, near = 0, n = 0;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const nx = ((i + 0.5) / w * 2 - 1) * tf * ASPECT, ny = (1 - (j + 0.5) / h * 2) * tf;
    for (let q = 0; q < 3; q++) d[q] = f[q] + r[q] * nx + u[q] * ny;
    const l = Math.hypot(d[0], d[1], d[2]); d[0] /= l; d[1] /= l; d[2] /= l;
    const hit = cast(v.eye, d); n++;
    if (img) { const c = shade(hit, d), o = (j * w + i) * 3; img[o] = c[0]; img[o + 1] = c[1]; img[o + 2] = c[2]; }
    if (!hit) continue;
    const nm = nameOf(hit.b);
    if (j > h / 2) { low++; if (FLOWER.test(nm)) fl++; }
    if (/^bloom_|cherry.*leaves/.test(nm)) bloom++;
    if (hit.s < 7 && (!(RT.flags[hit.b] & F.PLANT) || (RT.flags[hit.b] & F.LEAVES)) && hit.y > v.eye[1] - 2) near++;
  }
  return { fl: fl / Math.max(1, low), bloom: bloom / n, near: near / n };
}
const aim = (e, t) => [Math.atan2(-(t[0] - e[0]), -(t[2] - e[2])), Math.atan2(t[1] - e[1], Math.hypot(t[0] - e[0], t[2] - e[2]))];
const groundY = (x, z) => { for (let y = 200; y > 40; y--) { const b = blockAt(x, y, z); if (b && (RT.flags[b] & (F.OPAQUE | F.FLUID)) && !(RT.flags[b] & F.LEAVES)) return y; } return 64; };
const g17 = gens[17], P = LAND.plan(g17), r1 = (x) => Math.round(x * 100) / 100;
const views = {};
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
// ---- the wonder spots
const G0 = P.pieces.find(p => p.kind === 'blossom_giant'), R0 = P.pieces.find(p => p.kind === 'glow_ring');
check(!!G0 && !!R0, `the wonder spots are in the plan (Traumbaum ${G0 && [G0.x, G0.z]}, ring ${R0 && [R0.x, R0.z]})`);
const best = (cands, score) => { let b = null, bs = -1e9; for (const c of cands) { const s = score(c); c.score = s; if (s > bs) { bs = s; b = c; } } return b; };
const ring = (cx, cz, dist, up, tgt, n = 12) => { const out = []; for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2, x = cx + Math.cos(a) * dist, z = cz + Math.sin(a) * dist, y = g17.surfaceY(Math.floor(x), Math.floor(z)) + 1 + up; const e = [x, y, z], [yaw, pitch] = aim(e, tgt); out.push({ eye: e, yaw, pitch }); } return out; };
if (G0) {
  const tgt = [G0.x + 0.5, G0.y + 9, G0.z + 0.5];
  views.giant = best(ring(G0.x, G0.z, 27, 1.62, tgt), (v) => { const m = view(v, 48, 27); return m.bloom * 2 + m.fl - m.near * 4; });
  const vt = [G0.x + 0.5, G0.y + 4, G0.z + 0.5];
  views.vista = best(ring(G0.x, G0.z, 72, 24, vt, 16), (v) => { const m = view(v, 48, 27); return m.bloom * 3 + m.fl - m.near * 4; });
  console.log(`     giant ${JSON.stringify(views.giant.eye.map(r1))} score ${r1(views.giant.score)} · vista score ${r1(views.vista.score)} (${secs()})`);
}
if (R0) {
  const tgt = [R0.x + 0.5, R0.y, R0.z + 0.5];
  views.ring = best(ring(R0.x, R0.z, 9, 3.2, tgt), (v) => { const m = view(v, 48, 27); return m.fl - m.near * 4; });
  views.ringnight = Object.assign({}, views.ring);
}
// ---- a lone blossom tree: the planter recorded over the meadow within 260 blocks
const planted = [];
{ const orig = FL.plant, rec = { get: () => 0, set: () => {}, place: () => {} };
  FL.plant = function (w, name, x, y, z) { if (FL.TREES.includes(name)) planted.push({ name, x, y, z }); return orig.apply(this, arguments); };
  LAND.soloTrees(g17, P, rec, -260, -260, 260, 260); FL.plant = orig; }
check(planted.length > 20, `lone blossom trees within 260 blocks: ${planted.length}`);
{ const cands = [];
  for (const t of planted.sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z)).slice(0, 14)) for (const v of ring(t.x, t.z, 13, 1.62, [t.x + 0.5, t.y + 4, t.z + 0.5], 8)) { v.tree = t.name; cands.push(v); }
  views.tree = best(cands, (v) => { const m = view(v, 40, 22); return m.bloom * 3 + m.fl * 0.7 - m.near * 4; });
  console.log(`     tree ${views.tree.tree} ${JSON.stringify(views.tree.eye.map(r1))} score ${r1(views.tree.score)} (${secs()})`); }
// ---- the meadow walk: eyes beside the ways, eight headings, the flowers in the lower half
{ const cands = [];
  for (const L of P.lines) for (let i = 0; i < L.pts.length; i += 14) {
    const [x, z] = L.pts[i]; if (Math.hypot(x, z) > 260 || LAND.zoneAt(g17, x | 0, z | 0)) continue;
    const y = g17.surfaceY(Math.floor(x), Math.floor(z)) + 1 + 1.62;
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; cands.push({ eye: [Math.floor(x) + 0.5, y, Math.floor(z) + 0.5], yaw: a, pitch: -0.12 }); }
  }
  const pre = cands.map(v => (v.m = view(v, 24, 14), v)).filter(v => v.m.near < 0.02).sort((a, b) => b.m.fl - a.m.fl).slice(0, 24);
  views.meadow = best(pre, (v) => { const m = view(v, 64, 36); return m.fl + m.bloom - m.near * 4; });
  console.log(`     meadow ${JSON.stringify(views.meadow.eye.map(r1))} of ${cands.length} candidates, flowers ${r1(views.meadow.score)} (${secs()})`); }
// ---- the pictures, 16 and 17
const out = {}, tiles = [];
for (const name of ['meadow', 'tree', 'giant', 'ring', 'vista']) {
  const v = views[name]; if (!v) continue;
  out[name] = { from: v.eye.map(r1), yaw: r1(v.yaw), pitch: r1(v.pitch) };
  const ms = {};
  for (const vg of [16, 17]) {
    VG = vg; const img = Buffer.alloc(W * H * 3), m = view(v, W, H, img); ms[vg] = m;
    tiles.push({ input: await_png(img), name, vg });
  }
  console.log(`     ${name}: flowers ${r1(ms[16].fl)} → ${r1(ms[17].fl)}, blossom ${r1(ms[16].bloom)} → ${r1(ms[17].bloom)}`);
  check(ms[17].fl + ms[17].bloom > (ms[16].fl + ms[16].bloom) * 1.3 + 0.03, `${name}: vgen 17 shows more bloom than 16`);
}
out.ringnight = out.ring;
function await_png(img) { return { raw: img }; }
fs.writeFileSync(SHOTS + '/flora_views.json', JSON.stringify(out, null, 1));
(async () => {
  const comp = [];
  tiles.forEach((t, i) => comp.push({ input: t.input.raw, raw: { width: W, height: H, channels: 3 }, left: (i % 2) * (W + 4), top: Math.floor(i / 2) * (H + 4) }));
  const rows = Math.ceil(tiles.length / 2);
  await sharp({ create: { width: W * 2 + 4, height: rows * (H + 4), channels: 3, background: { r: 12, g: 12, b: 16 } } }).composite(comp).png().toFile(SHOTS + '/flora_preview.png');
  console.log('     → test/shots/flora_preview.png, flora_views.json (' + secs() + ')');
  console.log(fails ? `FAILED ${fails}` : 'ALL OK');
  process.exit(fails ? 1 : 0);
})();

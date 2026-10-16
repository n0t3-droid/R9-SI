// Aussichten · the postcards in node (t-vista, vgen 11; plan docs/superpowers/plans/2026-10-15-t-vista.md §5): every
// vista point's composition drawn from the generated chunks before a browser is asked — a small ray picture (the near
// field block by block, the far field over the land's surface and through the landmark's own chunks; flat colours by
// block, the faces shaded, the air thickening with distance) and the composition rules measured on it:
//   bank      no land in the eye's face: the share of the picture covered by natural ground (grass, dirt, stone…) higher
//             than two blocks over the spur's floor and nearer than 16 blocks — a way cut into a slope, its bank beside the
//             spur's mouth (vista.mjs's v3 of the first runs: a third of the picture a dirt wall) — at most 3 %
//   posts     the two lantern posts along the walk, one either side of it: inside the picture's sides where they are in it
//             (looking up at a high landmark they stand under its foot), the cell no wider than a quarter of it
//   landmark  the rays at the upper 40 % of the landmark's box not stopped nearer than the landmark (the frame trees, the
//             grove, the land, a building) in at least 70 % of them
// → test/shots/vista_preview_<id>.png (320 × 180 each) and test/shots/vista_preview_sheet.png (all of them, labelled)
//   bash test/wt_run.sh vista_preview.js 900          (SEED=… another world · ONLY=v0,v3 some · W=480 a bigger picture)
const V = require('./load_shared.js');
const fs = require('fs');
const sharp = require('/home/dev/.npm-global/lib/node_modules/sharp/lib/index.js');
const R = V.R, F = V.F, RT = R.T, LAND = V.Land, VI = V.Vista, SEA = V.C.SEA;
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const SEED = +(process.env.SEED || 4242), ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const W = +(process.env.W || 320), H = Math.round(W * 9 / 16), ASPECT = 16 / 9;
const SHOTS = __dirname + '/shots';
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(1) + ' s';
const g = V.makeGen('overworld', SEED, { vgen: 11 }), P = LAND.plan(g);
console.log(`the plan: ${P.vistas.length} vista points (${secs()})`);

// ---------------------------------------------------------------- the world: chunks near, a coarse surface far
const CH = new Map();
const chunk = (cx, cz) => { const k = cx * 65536 + cz; let c = CH.get(k); if (!c) { c = g.generate(cx, cz).blocks; CH.set(k, c); if (CH.size > 900) CH.delete(CH.keys().next().value); } return c; };
const blockAt = (x, y, z) => (y < 0 || y > 255 ? 0 : chunk(x >> 4, z >> 4)[(y << 8) | ((z & 15) << 4) | (x & 15)]);
const SURF = new Map();
const surfAt = (x, z) => { const X = x >> 2, Z = z >> 2, k = X * 65536 + Z; let h = SURF.get(k); if (h === undefined) { h = g.surfaceY(X * 4 + 2, Z * 4 + 2); SURF.set(k, h); } return h; };
const nameOf = (s) => (s ? R.types[RT.type[s]].name : 'air');
const hits = (s) => { if (!s) return false; const f = RT.flags[s]; return !!((f & (F.OPAQUE | F.LEAVES | F.FLUID)) || ((f & F.SOLID) && !(f & F.PLANT))); };
// flat colours by name (a preview, not the game's look)
const PAL = new Map();
const colOf = (s) => {
  let c = PAL.get(s); if (c) return c;
  const n = nameOf(s), f = RT.flags[s];
  const rules = [
    [/cherry.*leaves|pink/, [214, 128, 176]], [/leaves/, [52, 98, 44]], [/_log$|_wood$|stem$/, [96, 70, 46]],
    [/grass_block|moss/, [92, 146, 62]], [/coarse|dirt|path|podzol|mud|farmland/, [128, 92, 60]], [/sand/, [214, 200, 154]],
    [/water/, [58, 108, 168]], [/lava|magma/, [255, 120, 32]], [/snow|powder/, [242, 246, 250]], [/ice/, [160, 196, 236]],
    [/lantern|neon|light|glow|beacon|lamp|torch|amber/, [255, 214, 140]], [/gold/, [228, 188, 80]], [/glass|pane/, [170, 204, 226]],
    [/quartz|white|calcite|marble/, [232, 232, 226]], [/temple/, [110, 124, 142]], [/spire|citadel|obsidian|dusk/, [70, 66, 88]],
    [/flagstone|plaza|paving|tile/, [156, 136, 116]], [/stone_brick|brick|chiseled|balustrade|polished/, [128, 122, 112]],
    [/bench|plank|fence|door|ladder|barrel|crate/, [150, 108, 64]], [/roof|slate/, [70, 76, 92]], [/terracotta|ochre|umber|red_sand|clay/, [176, 96, 52]],
    [/stone|andesite|cobble|gravel|tuff|deepslate|granite|diorite|rock|basalt/, [120, 120, 118]], [/wool|concrete|vollton/, [200, 190, 180]],
  ];
  c = [140, 130, 120];
  for (const [re, col] of rules) if (re.test(n)) { c = col; break; }
  if (f & F.EMISSIVE) c = [Math.max(c[0], 230), Math.max(c[1], 200), Math.max(c[2], 140)];
  PAL.set(s, c); return c;
};

// ---------------------------------------------------------------- the camera (the game's: vertical fov, 16:9; as vista.mjs)
const basis = (yaw, pitch) => { const cp = Math.cos(pitch), sp = Math.sin(pitch), f = [-Math.sin(yaw) * cp, sp, -Math.cos(yaw) * cp], r = [Math.cos(yaw), 0, -Math.sin(yaw)], u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]]; return { f, r, u }; };
const project = (v, q) => { const { f, r, u } = basis(v.yaw, v.pitch), d = [q[0] - v.eye[0], q[1] - v.eye[1], q[2] - v.eye[2]], zc = d[0] * f[0] + d[1] * f[1] + d[2] * f[2]; if (zc <= 0.05) return null; const t = Math.tan(v.fov * Math.PI / 360); return [(d[0] * r[0] + d[1] * r[1] + d[2] * r[2]) / (zc * t * ASPECT), (d[0] * u[0] + d[1] * u[1] + d[2] * u[2]) / (zc * t), zc]; };

// one ray: the first block it meets {s (the distance), b (the state, -1 the land's surface far, -2 water far), face,
// x, y, z} or null (the sky). Near (≤ NEAR) and in the landmark's footprint block by block, elsewhere over the surface.
const NEAR = 140, FAR = 1300;
function cast(e, d, lmk) {
  let x = Math.floor(e[0]), y = Math.floor(e[1]), z = Math.floor(e[2]);
  const sx = d[0] > 0 ? 1 : -1, sy = d[1] > 0 ? 1 : -1, sz = d[2] > 0 ? 1 : -1;
  const tdx = Math.abs(1 / (d[0] || 1e-9)), tdy = Math.abs(1 / (d[1] || 1e-9)), tdz = Math.abs(1 / (d[2] || 1e-9));
  let tx = (d[0] > 0 ? x + 1 - e[0] : e[0] - x) * tdx, ty = (d[1] > 0 ? y + 1 - e[1] : e[1] - y) * tdy, tz = (d[2] > 0 ? z + 1 - e[2] : e[2] - z) * tdz;
  let s = 0, face = 1;
  for (let k = 0; k < 4000; k++) {
    if (s > FAR || (y > 262 && d[1] >= 0) || y < 0) return null;
    const inLm = lmk && lmk.some(L => Math.abs(x - L.x) <= L.r && Math.abs(z - L.z) <= L.r);
    if (s <= NEAR || inLm) { const b = blockAt(x, y, z); if (hits(b)) return { s, b, face, x, y, z }; }
    else { const h = surfAt(x, z); if (y <= h) return { s, b: h < SEA ? -2 : -1, face, x, y, z, h }; if (y < SEA && h < SEA) return { s, b: -2, face: 1, x, y, z, h }; }
    if (tx < ty && tx < tz) { s = tx; tx += tdx; x += sx; face = 0; }
    else if (ty < tz) { s = ty; ty += tdy; y += sy; face = 1; }
    else { s = tz; tz += tdz; z += sz; face = 2; }
  }
  return null;
}
const SKY0 = [196, 206, 222], SKY1 = [92, 120, 176];
function shade(hit, d) {
  if (!hit) { const t = Math.max(0, Math.min(1, d[1] * 2.2 + 0.1)); return [SKY0[0] + (SKY1[0] - SKY0[0]) * t, SKY0[1] + (SKY1[1] - SKY0[1]) * t, SKY0[2] + (SKY1[2] - SKY0[2]) * t]; }
  let c = hit.b === -1 ? (hit.h > 150 ? [150, 150, 150] : [86, 128, 66]) : hit.b === -2 ? [58, 108, 168] : colOf(hit.b);
  const k = hit.face === 1 ? (d[1] < 0 ? 1 : 0.5) : hit.face === 0 ? 0.8 : 0.66;
  const em = hit.b > 0 && (RT.flags[hit.b] & F.EMISSIVE) ? 1 : k, a = 1 - Math.exp(-hit.s / 650);
  return [c[0] * em * (1 - a) + SKY0[0] * a, c[1] * em * (1 - a) + SKY0[1] * a, c[2] * em * (1 - a) + SKY0[2] * a];
}

// ---------------------------------------------------------------- the spur's own blocks, the landmark's footprint
const SPUR = /stone_brick_wall|balustrade|lantern|vx_bench|flagstone|vx_floor_plaza|quartz_pillar|stone_bricks|chiseled|smooth_quartz/;
const LM = VI.landmarks(g, P);
const footprint = (v) => { const L = LM.find(l => l.id === v.lm); if (!L) return []; return (L.members || [L]).map(q => ({ x: q.x, z: q.z, r: Math.min(60, q.r + 6) })); };
// the lantern posts along the walk (a lantern on a post beside its first 6 blocks)
function mouthPosts(v) {
  const out = [], [ux, uz] = v.u;
  for (let dz = -7; dz <= 7; dz++) for (let dx = -7; dx <= 7; dx++) {
    const x = v.x + dx, z = v.z + dz, t = dx * ux + dz * uz, o = -dx * uz + dz * ux;   // (the cell's middle against the spur's origin, the middle of its first cell)
    if (t < -1 || t > 6 || Math.abs(o) < 2.2 || Math.abs(o) > 4.5) continue;
    if (/wall|pillar/.test(nameOf(blockAt(x, v.y + 1, z))) && nameOf(blockAt(x, v.y + 2, z)) === 'lantern') out.push({ x, z, t: +t.toFixed(1), o: +o.toFixed(1) });
  }
  return out;
}

// ---------------------------------------------------------------- the pictures and the measures
const vs = P.vistas.filter(v => !ONLY || ONLY.includes(v.id));
const rows = [], writes = [];
for (const v of vs) {
  const t0 = Date.now(), { f, r, u } = basis(v.yaw, v.pitch), tf = Math.tan(v.fov * Math.PI / 360), lmk = footprint(v);
  const img = Buffer.alloc(W * H * 3);
  let bank = 0, leavesNear = 0;
  const d = [0, 0, 0];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const nx = ((i + 0.5) / W * 2 - 1) * tf * ASPECT, ny = (1 - (j + 0.5) / H * 2) * tf;
    d[0] = f[0] + r[0] * nx + u[0] * ny; d[1] = f[1] + r[1] * nx + u[1] * ny; d[2] = f[2] + r[2] * nx + u[2] * ny;
    const l = Math.hypot(d[0], d[1], d[2]); d[0] /= l; d[1] /= l; d[2] /= l;
    const hit = cast(v.eye, d, lmk), c = shade(hit, d), o = (j * W + i) * 3;
    img[o] = c[0]; img[o + 1] = c[1]; img[o + 2] = c[2];
    if (hit && hit.b > 0 && hit.s < 16) {
      const fl = RT.flags[hit.b];
      if ((fl & F.SMOOTH) && hit.y >= v.y + 2 && !SPUR.test(nameOf(hit.b))) bank++;
      if ((fl & F.LEAVES) || /_log$/.test(nameOf(hit.b))) leavesNear++;
    }
  }
  // the landmark's rays: a 9 × 9 grid over the upper 40 % of its box in the picture (its foot may stand behind the land)
  const [x0, y0, z0, x1, y1, z1] = v.box, pts = []; let L0 = 9, R0 = -9, T0b = -9, B0 = 9;
  for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) { const p = project(v, [x, y, z]); if (!p) continue; L0 = Math.min(L0, p[0]); R0 = Math.max(R0, p[0]); B0 = Math.min(B0, p[1]); T0b = Math.max(T0b, p[1]); }
  const dl = Math.hypot(v.aim[0] - v.eye[0], v.aim[2] - v.eye[2]), rl = (v.box[3] - v.box[0]) / 2;
  let lmRays = 0, lmClear = 0;
  for (let a = 0; a < 9; a++) for (let b = 0; b < 9; b++) {
    const px = Math.max(-1, Math.min(1, L0 + (R0 - L0) * (a + 0.5) / 9)), py = Math.max(-1, Math.min(1, T0b - (T0b - B0) * 0.4 * (b + 0.5) / 9));
    d[0] = f[0] + r[0] * px * tf * ASPECT + u[0] * py * tf; d[1] = f[1] + r[1] * px * tf * ASPECT + u[1] * py * tf; d[2] = f[2] + r[2] * px * tf * ASPECT + u[2] * py * tf;
    const l = Math.hypot(d[0], d[1], d[2]); d[0] /= l; d[1] /= l; d[2] /= l;
    const hit = cast(v.eye, d, lmk); lmRays++;
    if (!hit || hit.s >= dl - rl - 8) lmClear++;
  }
  const posts = mouthPosts(v).map(p => {
    // (its width in the picture: the post's cell, from its foot to the lantern's top — all eight corners)
    const q = project(v, [p.x + 0.5, v.y + 2, p.z + 0.5]); let l = 9, r = -9;
    for (const cx of [p.x, p.x + 1]) for (const cy of [v.y + 1, v.y + 3]) for (const cz of [p.z, p.z + 1]) { const c = project(v, [cx, cy, cz]); if (c) { l = Math.min(l, c[0]); r = Math.max(r, c[0]); } }
    return Object.assign(p, { ndc: q ? +q[0].toFixed(2) : null, ndcY: q ? +q[1].toFixed(2) : null, wide: r > l ? +(r - l).toFixed(2) : 9 });
  });
  // (in the picture — not under its foot, as when the eye looks up at a high landmark — a post stands inside its sides,
  // on its own side of the walk, not too wide; an arch is the frame instead)
  const shown = posts.filter(p => p.ndc !== null && p.ndcY >= -1.05), lft = posts.filter(p => p.o < 0), rgt = posts.filter(p => p.o > 0);
  const postsOk = !!v.arch || (lft.length >= 1 && rgt.length >= 1 && shown.every(p => Math.abs(p.ndc) <= 0.95 && p.wide <= 0.5 && Math.sign(p.ndc) === Math.sign(p.o)));
  const row = { id: v.id, lm: v.lm, d: v.d, fov: v.fov, wow: !!v.wow, bank: +(bank / (W * H)).toFixed(3), leavesNear: +(leavesNear / (W * H)).toFixed(3), lmClear: +(lmClear / lmRays).toFixed(2), posts, postsOk, ms: Date.now() - t0 };
  rows.push(row);
  const path = `${SHOTS}/vista_preview_${v.id}.png`;
  writes.push(sharp(img, { raw: { width: W, height: H, channels: 3 } }).png().toFile(path).catch(() => {}));
  row.png = path;
  console.log(`  ${v.id} ${v.lm} ${v.d} m: bank ${(row.bank * 100).toFixed(1)} % · leaves near ${(row.leavesNear * 100).toFixed(1)} % · the landmark's rays clear ${(row.lmClear * 100).toFixed(0)} % · posts ${posts.map(p => `t ${p.t.toFixed ? p.t.toFixed(1) : p.t} o ${p.o.toFixed ? p.o.toFixed(1) : p.o} → ${p.ndc}, ${p.ndcY} (${p.wide} wide)`).join(', ') || (v.arch ? 'the arch' : 'none')} ${postsOk ? '' : '✗'} (${row.ms} ms, ${CH.size} chunks)`);
}

// ---------------------------------------------------------------- the sheet
(async () => {
  await Promise.all(writes);
  const cols = 4, LBL = 16, comps = [], esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  for (let k = 0; k < rows.length; k++) {
    const row = rows[k], x = (k % cols) * W, y = Math.floor(k / cols) * (H + LBL);
    try { comps.push({ input: await sharp(row.png).toBuffer(), left: x, top: y + LBL }); } catch (e) { /* not written */ }
    const lab = `${row.id} ${row.lm} ${row.d} m ${row.wow ? '★' : '·'} ${row.fov}° · bank ${(row.bank * 100).toFixed(1)} % · lm ${(row.lmClear * 100).toFixed(0)} % · posts ${row.postsOk ? 'ok' : '✗'}`;
    comps.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${LBL}"><rect width="${W}" height="${LBL}" fill="#13233a"/><text x="4" y="${LBL - 4}" font-family="DejaVu Sans, sans-serif" font-size="10.5" fill="#e8eef8">${esc(lab)}</text></svg>`), left: x, top: y });
  }
  const SW = cols * W, SH = Math.ceil(rows.length / cols) * (H + LBL);
  if (rows.length) await sharp({ create: { width: SW, height: SH, channels: 3, background: '#000' } }).composite(comps).png().toFile(`${SHOTS}/vista_preview_sheet.png`);
  console.log(`the sheet: test/shots/vista_preview_sheet.png (${secs()})`);
  const n = rows.length;
  check(rows.every(q => q.bank <= 0.03), `no land in the eye's face: natural ground over the spur's floor nearer than 16 blocks covers at most 3 % of every picture (${rows.filter(q => q.bank > 0.03).map(q => `${q.id} ${(q.bank * 100).toFixed(1)} %`).join(', ') || 'all'}${rows.some(q => q.bank > 0.03) ? '' : ' within it'}; the worst ${(Math.max(...rows.map(q => q.bank)) * 100).toFixed(1)} %)`);
  check(rows.every(q => q.postsOk), `the lantern posts along every walk (one either side) stand inside the picture's sides where they are in it, the cell neither wider than a quarter of it (the post itself half of that), or the arch frames it (${rows.filter(q => q.postsOk).length} of ${n}${rows.some(q => !q.postsOk) ? '; not: ' + rows.filter(q => !q.postsOk).map(q => q.id + ' ' + JSON.stringify(q.posts.map(p => [p.o, p.ndc, p.wide]))).join(', ') : ''})`);
  check(rows.every(q => q.lmClear >= 0.7), `the landmark's rays reach it from every vista point (≥ 70 % of a 9 × 9 grid over its box; ${rows.map(q => q.id + ' ' + Math.round(q.lmClear * 100) + ' %').join(' · ')})`);
  try { fs.writeFileSync(`${SHOTS}/vista_preview.json`, JSON.stringify(rows.map(q => Object.assign({}, q, { png: undefined })), null, 1)); } catch (e) { /* a convenience */ }
  console.log(`(${secs()})`);
  console.log(fails ? 'FAILED ' + fails : 'ALL OK');
  process.exit(fails ? 1 : 0);
})();

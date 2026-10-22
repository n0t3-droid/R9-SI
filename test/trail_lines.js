// f-flow · R50-04's measure in pictures (docs/reviews/v0.49.md: "no straight segment > 150 px of constant width in the
// meadow and session pictures — a line detector on the sky band"; plan docs/superpowers/plans/2026-10-23-f-flow.md §2.5).
// The detector: the sky band (the top 45 % of the picture) → luma → a white top-hat (the luma minus its opening with a
// square of ≈ W/140, at least 5 px: what stays is thin and bright — a contrail, a star, a thin edge) → a threshold →
// components smaller than 12 px (stars) dropped → Hough lines, the strongest first: each one walked across the picture,
// at every pixel the width of the bright run across it → segments where it is there (gaps ≤ 3 px) → split where the width
// leaves max(1.5 px, 30 %) of its running median for 3 steps: what is left is a straight segment of constant width. A line
// within 3° of the horizontal is not counted (the horizon's haze band, the land's lit edge, a hall's neon strips — the
// trails of v0.49's pictures lie 7–52° off it), nor one within 12° of it whose two sides (the opening, 8–14 px out) lie
// 20 levels apart: a silhouette, land against sky (a hill's lit crest). The result: the longest of them (px), each with
// its angle, width and sides.
//   node test/trail_lines.js [pictures…]     prints each picture's longest constant-width straight segment (px)
//   bash test/wt_run.sh trail_lines.js 300   the self-test: synthetic pictures (a 200-px rod is found ≥ 180; a puffy,
//                                            widening trail and a field of stars give nothing > 150) and v0.49's meadow
//                                            picture when it is there (its rods > 150 px)
const fs = require('fs'), path = require('path');
const SHARP = '/home/dev/.npm-global/lib/node_modules/sharp';

// ---------------------------------------------------------------- the detector (on a luma array W × H)
function minmax1(src, dst, W, H, r, horiz, isMin) {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = isMin ? 255 : 0;
    for (let d = -r; d <= r; d++) {
      const xx = horiz ? x + d : x, yy = horiz ? y : y + d;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const q = src[yy * W + xx]; v = isMin ? (q < v ? q : v) : (q > v ? q : v);
    }
    dst[y * W + x] = v;
  }
}
function detect(L, W, H, o) {
  o = o || {};
  const k = o.k || Math.max(5, Math.round(W / 140) | 1), r = k >> 1, T = o.T || 14, minLen = o.minLen || 30;
  const a = new Float32Array(W * H), b = new Float32Array(W * H);
  minmax1(L, a, W, H, r, true, true); minmax1(a, b, W, H, r, false, true);    // erosion
  minmax1(b, a, W, H, r, true, false); minmax1(a, b, W, H, r, false, false);  // dilation: the opening
  const M = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) M[i] = L[i] - b[i] >= T ? 1 : 0;
  const BG = b;   // (the opening: the picture without its thin bright things — the sky test reads it beside a segment)
  // components: drop the small ones (stars)
  const lab = new Int32Array(W * H), stack = [];
  let nl = 0;
  for (let i = 0; i < W * H; i++) {
    if (!M[i] || lab[i]) continue;
    nl++; const pix = []; stack.push(i); lab[i] = nl;
    while (stack.length) { const p = stack.pop(); pix.push(p); const px = p % W, py = (p / W) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = px + dx, y = py + dy; if (x < 0 || y < 0 || x >= W || y >= H) continue; const q = y * W + x; if (M[q] && !lab[q]) { lab[q] = nl; stack.push(q); } } }
    let x0 = W, x1 = 0, y0 = H, y1 = 0; for (const p of pix) { const x = p % W, y = (p / W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (pix.length < 12 || Math.hypot(x1 - x0, y1 - y0) < 20) for (const p of pix) M[p] = 0;
  }
  // the Hough lines, the strongest first; each one walked
  const NT = 180, diag = Math.ceil(Math.hypot(W, H)), NR = 2 * diag + 1, CS = new Float32Array(NT), SN = new Float32Array(NT);
  for (let t = 0; t < NT; t++) { CS[t] = Math.cos(t * Math.PI / NT); SN[t] = Math.sin(t * Math.PI / NT); }
  const segs = [];
  for (let iter = 0; iter < (o.lines || 14); iter++) {
    const acc = new Int32Array(NT * NR);
    let any = false;
    for (let i = 0; i < W * H; i++) { if (!M[i]) continue; any = true; const x = i % W, y = (i / W) | 0; for (let t = 0; t < NT; t++) acc[t * NR + Math.round(x * CS[t] + y * SN[t]) + diag]++; }
    if (!any) break;
    let best = 0, bi = -1; for (let i = 0; i < acc.length; i++) if (acc[i] > best) { best = acc[i]; bi = i; }
    if (best < minLen * 0.6) break;
    const t = Math.floor(bi / NR), rho = (bi % NR) - diag, c = CS[t], s = SN[t];
    // the line: points (x, y) with x c + y s = rho; its direction (−s, c); walked over the picture
    const dx = -s, dy = c, x0 = rho * c, y0 = rho * s;
    const steps = [];
    for (let u = -diag; u <= diag; u++) {
      const fx = x0 + dx * u, fy = y0 + dy * u, X = Math.round(fx), Y = Math.round(fy);
      if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      // the bright run across the line through the nearest mask pixel within ±1.5 px
      let hit = null;
      for (const d of [0, 1, -1, 2, -2]) { const xx = Math.round(fx + c * d * 0.75), yy = Math.round(fy + s * d * 0.75); if (xx >= 0 && yy >= 0 && xx < W && yy < H && M[yy * W + xx]) { hit = d * 0.75; break; } }
      if (hit === null) { steps.push({ u, x: X, y: Y, on: false, w: 0 }); continue; }
      let w = 1;
      for (const sg of [1, -1]) for (let e = 1; e <= k + 2; e++) { const xx = Math.round(fx + c * (hit + sg * e)), yy = Math.round(fy + s * (hit + sg * e)); if (xx < 0 || yy < 0 || xx >= W || yy >= H || !M[yy * W + xx]) break; w++; }
      steps.push({ u, x: X, y: Y, on: true, w });
    }
    // segments: present with gaps ≤ 3; split where the width leaves its running median
    let cur = null, gap = 0;
    const close = () => { if (cur && cur.pts.length) { const n0 = segs.length; splitConst(cur, segs, t, minLen); for (let q = n0; q < segs.length; q++) skyTest(segs[q], BG, W, H, c, s, k, o.G); } cur = null; };
    for (const st of steps) {
      if (st.on) { if (!cur) cur = { pts: [] }; cur.pts.push(st); gap = 0; }
      else if (cur) { gap++; if (gap > 3) close(); }
    }
    close();
    // the line's pixels leave the mask (the next strongest comes next)
    for (const st of steps) { if (!st.on) continue; for (let e = -(k + 2); e <= k + 2; e++) { const xx = Math.round(st.x + c * e), yy = Math.round(st.y + s * e); if (xx >= 0 && yy >= 0 && xx < W && yy < H) M[yy * W + xx] = 0; } }
  }
  segs.sort((p, q) => q.len - p.len);
  const sky = segs.filter(q => q.sky);
  return { k, T, segs, sky, longest: sky.length ? sky[0].len : 0, longestAny: segs.length ? segs[0].len : 0 };
}
// is a segment in the sky: the background (the opening) beside it, k+3 … k+9 px out on both sides, smooth on both (a
// neon strip on a tiled wall and the horizon's haze line over the land are not: their sides have texture or land)
function skyTest(q, BG, W, H, c, s, k, G) {
  const n = Math.max(2, Math.round(q.len / 2)), side = [[], []], gr = [[], []];
  let rough = [0, 0], cnt = [0, 0];
  for (let i = 0; i <= n; i++) {
    const x = q.from[0] + (q.to[0] - q.from[0]) * i / n, y = q.from[1] + (q.to[1] - q.from[1]) * i / n;
    for (let sg = 0; sg < 2; sg++) {
      let prev = null;
      for (let d = k + 3; d <= k + 9; d += 2) {
        const e = sg ? -d : d, X = Math.round(x + c * e), Y = Math.round(y + s * e);
        if (X < 0 || Y < 0 || X >= W || Y >= H) { prev = null; continue; }
        const v = BG[Y * W + X]; side[sg].push(v); if (G) gr[sg].push(G[Y * W + X]);
        if (prev !== null) { rough[sg] += Math.abs(v - prev); cnt[sg]++; }
        prev = v;
      }
    }
  }
  // along the strips too: neighbouring samples' difference
  for (let sg = 0; sg < 2; sg++) { const v = side[sg]; for (let i = 4; i < v.length; i++) { rough[sg] += Math.abs(v[i] - v[i - 4]); cnt[sg]++; } }
  const r0 = cnt[0] ? rough[0] / cnt[0] : 99, r1 = cnt[1] ? rough[1] / cnt[1] : 99;
  q.rough = [+r0.toFixed(1), +r1.toFixed(1)];
  const mean = v => v.length ? v.reduce((p, x) => p + x, 0) / v.length : 0;
  q.side = [Math.round(mean(side[0])), Math.round(mean(side[1]))];
  // (the roughness beside it is kept for the record: in 480 × 270 JPEGs a squadron's parallel trails and the ship
  // itself make one side rough — it cannot decide. What decides: a line within 3° of the horizontal is the horizon's
  // haze band, a lit edge of the land or a neon strip of a hall, not a trail — the trails of v0.49's pictures lie
  // 7–52° off it)
  q.flat = Math.abs(q.deg - 90) <= 3;
  // a silhouette: within 12° of the horizontal and the two sides 20 levels apart — land on one side, sky on the other
  // (f-flow's meadow picture: a hill's crest at 4°, sides 88 | 59; the trails of v0.49's pictures: sides 11–15 apart)
  q.edge = !q.flat && Math.abs(q.deg - 90) <= 12 && Math.abs(q.side[0] - q.side[1]) >= 20;
  // land beside it: green on a side (G − max(R, B) ≥ 10 on average — grass and leaves; a sky of any hour, its clouds
  // and its nebula stay below 0): a ridge or a hill's crest, not a trail (f-flow's meadow picture: the hill's slope
  // against a sky of the same luma, sides 81 | 83)
  q.green = [Math.round(mean(gr[0])), Math.round(mean(gr[1]))];
  q.land = !!G && Math.max(q.green[0], q.green[1]) >= 10;
  q.sky = !q.flat && !q.edge && !q.land;
}
function splitConst(seg, out, t, minLen) {
  const P = seg.pts;
  let a = 0;
  while (a < P.length) {
    let b = a, bad = 0;
    const ws = [P[a].w];
    for (let i = a + 1; i < P.length; i++) {
      const med = median(ws), w = P[i].w;
      if (Math.abs(w - med) > Math.max(1.5, 0.3 * med)) { bad++; if (bad >= 3) break; }
      else { bad = 0; b = i; }
      ws.push(w);
    }
    const len = Math.hypot(P[b].x - P[a].x, P[b].y - P[a].y);
    if (len >= minLen) out.push({ len: Math.round(len), from: [P[a].x, P[a].y], to: [P[b].x, P[b].y], deg: Math.round(t), width: +median(P.slice(a, b + 1).map(q => q.w)).toFixed(1) });
    a = Math.max(b + 1, a + 1);
  }
}
function median(v) { const s = v.slice().sort((p, q) => p - q); return s.length ? s[s.length >> 1] : 0; }
// the top-hat keeps what is thinner than its square: a rod as wide as k or wider, near the horizontal, would slip
// through it (the ×3 trails can be that wide) — so the picture is also read at ½ and ⅓ (box-averaged, the square then
// 2 and 3 times as wide) and the longest of all is the answer (lengths, ends and widths in the picture's own pixels)
function down(L, W, H, s) {
  const w = Math.floor(W / s), h = Math.floor(H / s), D = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let a = 0; for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) a += L[(y * s + j) * W + x * s + i]; D[y * w + x] = a / (s * s); }
  return { L: D, W: w, H: h };
}
function detectMulti(L, W, H, o) {
  const scales = (o && o.scales) || [1, 2, 3], all = [];
  let k = 0;
  for (const s of scales) {
    const D = s === 1 ? { L, W, H } : down(L, W, H, s), G = o && o.G ? (s === 1 ? o.G : down(o.G, W, H, s).L) : null;
    const r = detect(D.L, D.W, D.H, Object.assign({}, o, { G }));
    if (s === 1) k = r.k;
    for (const q of r.segs) all.push(Object.assign({}, q, { len: q.len * s, from: q.from.map(v => v * s), to: q.to.map(v => v * s), width: +(q.width * s).toFixed(1), scale: s }));
  }
  all.sort((p, q) => q.len - p.len);
  const sky = all.filter(q => q.sky);
  return { k, segs: all, sky, longest: sky.length ? sky[0].len : 0, longestAny: all.length ? all[0].len : 0 };
}

// ---------------------------------------------------------------- pictures
async function lumaOf(file, band) {
  const sharp = require(SHARP);
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = Math.max(8, Math.floor(info.height * (band || 0.45))), L = new Float32Array(W * H), G = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) { const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2]; L[i] = 0.299 * r + 0.587 * g + 0.114 * b; G[i] = g - Math.max(r, b); }
  return { L, G, W, H, full: [info.width, info.height] };
}
async function measure(file, o) { const p = await lumaOf(file, o && o.band); const r = detectMulti(p.L, p.W, p.H, Object.assign({}, o, { G: p.G })); return Object.assign(r, { file, size: p.full }); }
module.exports = { detect, detectMulti, measure, lumaOf };

// ---------------------------------------------------------------- the CLI and the self-test
if (require.main === module) (async () => {
  const files = process.argv.slice(2);
  if (files.length) {
    for (const f of files) { try { const r = await measure(f); console.log(`${path.basename(f)}: longest in the sky ${r.longest} px (any ${r.longestAny})${r.segs.length ? ' — ' + r.segs.slice(0, 5).map(q => `${q.len} px ${q.deg}° w${q.width} (${q.from}→${q.to}) ${q.sky ? 'sky' : q.flat ? 'flat' : q.edge ? 'edge' : 'land'} sides ${q.side} green ${q.green} ×1/${q.scale}`).join(' · ') : ''}`); } catch (e) { console.log(`${f}: ${e.message}`); } }
    return;
  }
  let fails = 0;
  const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
  const W = 640, H = 288, sky = () => { const L = new Float32Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) L[y * W + x] = 120 + 30 * (y / H) + 6 * Math.sin(x * 0.02 + y * 0.03); return L; };
  const stamp = (L, x, y, r, v) => { for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) { const d = Math.hypot(dx, dy); if (d > r + 0.5) continue; const X = Math.round(x + dx), Y = Math.round(y + dy); if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const a = Math.min(1, r + 0.5 - d); L[Y * W + X] = Math.max(L[Y * W + X], L[Y * W + X] * (1 - a) + v * a); } };
  // a v0.49 rod: 200 px, 4 px wide, constant
  { const L = sky(); for (let u = 0; u <= 200; u += 0.5) stamp(L, 150 + u * Math.cos(-0.6), 220 + u * Math.sin(-0.6), 2, 215); const r = detectMulti(L, W, H); check(r.longest >= 180, `a 200-px rod of constant width is found: ${r.longest} px (${JSON.stringify(r.segs[0] || {})})`); }
  // the same trail as smoke: widening ×3 along it, puffs with gaps (the noise of the arc length)
  { const L = sky(); for (let u = 0; u <= 260; u += 0.5) { const n = 0.5 + 0.5 * Math.sin(u * 0.21) * Math.sin(u * 0.067 + 1); if (n < 0.35) continue; stamp(L, 120 + u * Math.cos(-0.5), 230 + u * Math.sin(-0.5), 1 + 2.4 * (u / 260) * (0.6 + 0.4 * n), 120 + 95 * (1 - u / 300) * n + 30); } const r = detectMulti(L, W, H); check(r.longest <= 150, `a widening, puffy trail of 260 px gives no constant-width segment over 150: ${r.longest} px`); }
  // a hill's crest 4° off the horizontal, lit along its rim (sky 70 above, land 100 below): a silhouette, not a trail
  { const L = sky(); const cr = x => 150 + (x - 100) * Math.tan(4 * Math.PI / 180); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) L[y * W + x] = y < cr(x) ? 70 : 100; for (let x = 100; x <= 500; x += 0.5) stamp(L, x, cr(x), 1, 140); const r = detectMulti(L, W, H); check(r.longest <= 150 && r.segs.some(q => q.edge && q.len > 150), `a lit hill crest at 4° is a silhouette, not a trail: ${r.longest} px in the sky (${r.segs.filter(q => q.edge).map(q => q.len + ' px ' + q.deg + '° sides ' + q.side).join(', ')})`); }
  // a rod 7° off the horizontal across an even sky: still a rod
  { const L = sky(); const a = -7 * Math.PI / 180; for (let u = 0; u <= 200; u += 0.5) stamp(L, 200 + u * Math.cos(a), 160 + u * Math.sin(a), 2, 215); const r = detectMulti(L, W, H); check(r.longest >= 180, `a 200-px rod 7° off the horizontal is found: ${r.longest} px`); }
  // a wide rod (13 px, as wide as two of the top-hat's squares) 7° off the horizontal: found at ½ or ⅓
  { const L = sky(); const a = -7 * Math.PI / 180; for (let u = 0; u <= 220; u += 0.5) stamp(L, 180 + u * Math.cos(a), 170 + u * Math.sin(a), 6, 225); const r = detectMulti(L, W, H); check(r.longest >= 180, `a 13-px wide rod is found too: ${r.longest} px (×1/${r.sky.length ? r.sky[0].scale : '-'}, w${r.sky.length ? r.sky[0].width : '-'})`); }
  // a field of stars and a soft cloud: nothing
  { const L = sky(); for (let i = 0; i < 300; i++) stamp(L, (i * 97) % W, (i * 57) % H, 0.8, 230); for (let y = 40; y < 120; y++) for (let x = 300; x < 460; x++) L[y * W + x] = Math.max(L[y * W + x], 120 + 80 * Math.exp(-(((x - 380) / 60) ** 2 + ((y - 80) / 30) ** 2))); const r = detectMulti(L, W, H); check(r.longest < 60, `stars and a soft cloud: no line (${r.longest} px)`); }
  // v0.49's pictures, where this machine has them
  const before = ['/home/dev/vr/.worktrees/v042/test/shots/wow48_meadow_v049.png', '/home/dev/vr/.worktrees/r-v049/test/shots/session_builder_gap.jpg'];
  for (const f of before) {
    if (!fs.existsSync(f)) { console.log(`  (no ${f}: not checked)`); continue; }
    const r = await measure(f);
    check(r.longest > 150, `v0.49 ${path.basename(f)}: the rods found — ${r.longest} px (${r.segs.slice(0, 3).map(q => q.len + ' px ' + q.deg + '° w' + q.width).join(', ')})`);
  }
  console.log(fails ? 'FAILED ' + fails : 'ALL OK');
  process.exit(fails ? 1 : 0);
})();

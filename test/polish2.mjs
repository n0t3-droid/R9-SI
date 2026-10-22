// t-polish2 · WOW VIII · Die Lücken der v0.48 — the browser test of docs/superpowers/plans/2026-10-16-t-polish2.md: per
// gap its pictures before (v0.48: this branch's base 92835e8, built into .tmp_tests/base_dist — BEFORE_DIST) and after
// (this branch's dist), the same cameras, High as a player gets it (the dynamic resolution held off, view distance 8),
// 1280 × 720, de-DE. Two worlds a build, each in a page of its own:
//   world A — seed 4242, vgen 10 (test/light2.mjs's world, its wood of 63 oaks and birches planted east of the lake)
//     shafts  (gap 3) the wood, the lake, the temple's plaza at noon: the light on, and the light without the volumetric
//             pass (novol) — on − novol ΔE is that pass's light alone (the wood wants ≥ 0.6, the open land ≤ 0.35)
//     golden  (gap 4) the golden hour (10800) at the avenue, the temple, the hills, the lake, the villa, the wood and (world
//             B) the hall city: test/land_ref.js's land below the horizon against the golden frames (the bands' ΔE, the
//             split of the lightest 15 % over the darkest 15 %: the frames 6.2)
//     hangar  (gap 8) the Hangar Hall's floor toward its pad (material.mjs's 'hangar': the craft on its pad, 4000)
//   world B — seed 53, the build's own default (vgen 11 before, 12 after: what a player's new world gets)
//     floor   (gap 1) Weißstadt's street under its glass vault from the nave's west end (light2.mjs's hallcity, which is
//             motion.mjs's street) at noon and at night — against t1_22
//     rain    (gap 6) the same street in the rain (wet, the puddles full): the floor's ΔE rain against dry (the lower part
//             of the picture) — under the vault it should not get wet
//     street  (gap 7) the same street at noon, three frames 10 game frames apart with the actors held (motion.mjs's
//             method): the mean absolute change a pixel, and the difference ×8 as a picture
//     glass   (gap 5) a Villa Nova glass front at the golden hour (12500; material.mjs's 'glass': the lot with the most
//             panes facing open air, from 15 blocks out)
//     vistas  (gap 2) the citadel's vista (v1, 630 m) and the lighthouse's (v2) at night (16000): the far lights, the halos
//   cost    High: in the pages above (the street, the wood, the hangar: CPU ms a frame of this test's browser processes,
//           the kept frame drawn N times); Very Low: two fresh pages (this build and the build before) side by side in
//           world A at the avenue and the temple, rounds in turns — not slower (≤ ×1.03), the same picture (ΔE < 1)
// Pictures: test/shots/polish2_<view>_<tag>.png (tag before | after), polish2_<tag>.json (the numbers), the sheet
// test/shots/polish2_sheet.jpg (Trailer · Vorher (v0.48) · Nachher, a row a gap; /root/r9coord/sheet.py); the golden ones
// also as light2_<view>_golden_on_polish2<tag>.png (test/land_ref.js's names).
// usage: nohup bash test/wt_run.sh polish2.mjs 7200 > .tmp_tests/polish2.log 2>&1 &
//   TAGS=after,before (the builds, in this order) · ONLY=hall,glass,… (views) · BONLY=wood (the build before's views) · NO_COST=1 · NO_VL=1 · SHEET_ONLY=1 ·
//   BEFORE_DIST=file:///…/index.html · LH=v2 (the lighthouse's vista) · N=3 · ROUNDS=4
// regress: skip  (a showcase: the pictures are the evidence; the gates are the node tests polish2.js, motion_cloth.js,
// hallfloor.js, wet.js, vl_programs.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import sharp from '/home/dev/.npm-global/lib/node_modules/sharp/lib/index.js';
import { createRequire } from 'module';
import { execSync, execFileSync } from 'child_process';
import fs from 'fs';
const require = createRequire(import.meta.url);
const ROOT = new URL('../', import.meta.url).pathname;   // this checkout (the test runs from test/ or from .tmp_tests/)
const SHOTS = ROOT + 'test/shots/', FRAMES = ROOT + 'docs/trailer/frames/';
const DISTS = { after: process.env.DIST || 'file://' + ROOT + 'dist/index.html', before: process.env.BEFORE_DIST || 'file://' + ROOT + '.tmp_tests/base_dist/index.html' };
const TAGS = (process.env.TAGS || 'after,before').split(',');
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const N = +(process.env.N || 3), ROUNDS = +(process.env.ROUNDS || 4), RD = 8, EYE = 1.62;
const TOD = { noon: 6000, golden: 10800, night: 16500, am: 4000, glass: 12500, vnight: 16000 };
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const r1 = (x) => Math.round(x * 10) / 10, r2 = (x) => Math.round(x * 100) / 100;
const med = (a) => { const b = a.slice().sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
const shot = (view, tag) => `${SHOTS}polish2_${view}_${tag}.png`;

// ---------------------------------------------------------------- the cameras computed in node (the shared code)
const V = require(ROOT + 'test/load_shared.js');
let vCit = null, vLh = null, glassCam = null;
{
  // the vistas (wow48.mjs: vgen 11's plan, the same for vgen 12 — only the hall city's floor differs)
  const g11 = V.makeGen('overworld', 53, { vgen: 11 }), P = V.Land.plan(g11);
  const byId = (id) => P.vistas.find(v => v.id === id) || null;
  vCit = byId('v1') && byId('v1').lm === 'citadel' ? byId('v1') : P.vistas.find(v => v.lm === 'citadel') || null;
  const lh = process.env.LH || 'v2';
  vLh = byId(lh) && byId(lh).lm === 'lighthouse' ? byId(lh) : P.vistas.find(v => v.lm === 'lighthouse') || null;
  // a Villa Nova glass front (material.mjs's 'glass'): the lot whose street side has the most panes facing open air, from
  // 15 blocks out at eye height, the line to the glass clear of the plan's blocks
  const R = V.R, VG = V.VillageGen, site = VG.sitesFor(g11, 0, -9).find(x => x.home), plan = site && VG.plan(g11, site), city = plan && plan.nova;
  if (city) {
    const at = new Map();
    for (const [, b] of plan.chunks) { for (let i = 0; i < b.f.length; i += 5) for (let y = b.f[i + 2]; y <= b.f[i + 3]; y++) at.set(b.f[i] + ',' + y + ',' + b.f[i + 1], b.f[i + 4]); for (let i = 0; i < b.o.length; i += 4) at.set(b.o[i] + ',' + b.o[i + 1] + ',' + b.o[i + 2], b.o[i + 3]); }
    const nm = (q) => q ? R.types[R.T.type[q]].name : 'air', glass = [];
    for (const [k, q] of at) if (/^vx_nova_window|^panorama_|vx_nova_glass/.test(nm(q))) glass.push(k.split(',').map(Number));
    let best = null;
    for (const lot of city.lots) {
      const mine = glass.filter(([x, , z]) => Math.abs(x - lot.ox) < 16 && Math.abs(z - lot.oz) < 16);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const face = mine.filter(([x, y, z]) => !at.get((x + dx) + ',' + y + ',' + (z + dz)));
        if (face.length < 12) continue;
        const cx = face.reduce((a, q) => a + q[0], 0) / face.length, cy = face.reduce((a, q) => a + q[1], 0) / face.length, cz = face.reduce((a, q) => a + q[2], 0) / face.length;
        let clear = true; for (let t = 1; t < 14 && clear; t++) for (let y = lot.F + 1; y <= lot.F + 3; y++) if (at.get(Math.floor(cx + dx * t) + ',' + y + ',' + Math.floor(cz + dz * t))) clear = false;
        if (clear && (!best || face.length > best.n)) best = { n: face.length, at: [cx + 0.5, cy + 0.5, cz + 0.5], feet: [cx + 0.5 + dx * 15, lot.F + 1, cz + 0.5 + dz * 15] };
      }
    }
    glassCam = best;
  }
  console.log(`cameras: citadel ${vCit ? vCit.id + ' ' + vCit.d + ' m' : '—'} · lighthouse ${vLh ? vLh.id + ' ' + vLh.d + ' m' : '—'} · glass ${glassCam ? JSON.stringify(glassCam) : '—'}`);
}
// a natural wood of world A where the noon sun breaks in (the first run: the planted wood east of the lake is closed to
// the sun — 24° up at noon in this sky's "eternal dusk" (env.js) — so no ray under it met light, with or without the
// canopy's weight): the north-west's deep woods (gen_land.js woodAt), an eye under a canopy and in shade, facing the sun's
// side ±0.6 rad, the air ahead (five rays, 2–26 blocks) part lit and part shaded — the most light/shade crossings
let woodCam = null;
{
  const g = V.makeGen('overworld', 4242, { vgen: 10 }), RT = V.R.T, FL = V.F, CH = new Map();
  const blk = (x, y, z) => { y = Math.floor(y); if (y < 0 || y > 255) return 0; const X = Math.floor(x), Z = Math.floor(z), k = (X >> 4) + ',' + (Z >> 4); let c = CH.get(k); if (!c) { c = g.generate(X >> 4, Z >> 4); CH.set(k, c); } return c.blocks[(y << 8) | ((Z & 15) << 4) | (X & 15)]; };
  const leaf = (b) => b && (RT.flags[b] & FL.LEAVES), opaque = (b) => b && (RT.flags[b] & (FL.OPAQUE | FL.LEAVES));
  const ground = (x, z) => { for (let y = 160; y > 40; y--) { const b = blk(x, y, z); if (b && (RT.flags[b] & (FL.OPAQUE | FL.FLUID)) && !leaf(b)) return y; } return -1; };
  const th = Math.PI / 2, el = Math.sin(th) * 0.42, az = th + 0.4, S = [Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)];   // (env.js: the sun at noon, 6000)
  const lit = (x, y, z) => { for (let t = 0.7; t < 48; t += 0.7) if (opaque(blk(x + S[0] * t, y + S[1] * t, z + S[2] * t))) return 0; return 1; };
  const canopy = (x, y, z) => { let n = 0; for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { for (let u = 1; u <= 12; u++) if (leaf(blk(x + dx * 3, y + u, z + dz * 3))) { n++; break; } } return n / 9; };
  const sunYaw = Math.atan2(-S[0], -S[2]);
  for (let gz = -200; gz <= -80; gz += 12) for (let gx = -320; gx <= -240; gx += 12) {
    if (V.Land.woodAt(g, gx, gz).d < 0.5) continue;
    const gy = ground(gx + 0.5, gz + 0.5); if (gy < 0) continue;
    const ey = gy + 1 + EYE;
    if (opaque(blk(gx, ey, gz)) || opaque(blk(gx, ey - 1, gz)) || canopy(gx, Math.floor(ey), gz) < 0.4 || lit(gx + 0.5, ey, gz + 0.5)) continue;
    for (const dyaw of [-0.6, -0.3, 0, 0.3, 0.6]) {
      const yaw = sunYaw + dyaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      let n = 0, l = 0, crs = 0;
      for (const side of [-0.35, -0.15, 0, 0.15, 0.35]) {
        const dx = fx * Math.cos(side) - fz * Math.sin(side), dz = fx * Math.sin(side) + fz * Math.cos(side);
        let pv = -1;
        for (let t = 2; t <= 26; t++) { const x = gx + 0.5 + dx * t, z = gz + 0.5 + dz * t, y = ey - 0.3; if (opaque(blk(x, y, z))) break; const v = lit(x, y, z); n++; l += v; if (pv >= 0 && v !== pv) crs++; pv = v; }
      }
      if (n < 60 || l / n < 0.15 || l / n > 0.5) continue;
      if (!woodCam || crs > woodCam.crs) woodCam = { x: gx + 0.5, z: gz + 0.5, gy, yaw, crs, lit: +(l / n).toFixed(2), at: [gx + 0.5 + fx * 20, gy + 2.5, gz + 0.5 + fz * 20] };
    }
  }
  console.log(`the natural wood: ${woodCam ? JSON.stringify(woodCam) : '—'}`);
}

// ---------------------------------------------------------------- the views
// cam: light2.mjs's ({x, z, eye: above the ground | {y} | {feet}, at: [x, y | null, z], fov, clear, far, forest} or the
// hall city's {hall, u, v, at}); feet + at (material.mjs); vista. shots: [what, config] — what: noon | golden | night |
// am | glass | vnight (a time), rain (noon in the rain), seq (the motion sequence at noon); config: on | novol
const A_VIEWS = [
  { name: 'hangar', cam: { feet: [0.5, 82.4, 9], at: [0.5, 83.2, -10], fov: 74, far: false }, prep: 'hangar', shots: [['am', 'on']], cost: 'am' },
  { name: 'avenue', cam: { x: 1.5, z: -62.5, eye: EYE, at: [1, 83, -100], fov: 70, clear: true }, shots: [['golden', 'on']] },
  { name: 'villa', cam: { x: 56.5, z: -133.5, eye: EYE, at: [76, 86, -110], fov: 75, clear: true }, shots: [['golden', 'on']] },
  { name: 'hills', cam: { x: 0.5, z: -292.5, eye: { y: 136 }, at: [0, 84, -105], fov: 60, clear: true }, shots: [['golden', 'on']] },
  { name: 'temple', cam: { x: 4.5, z: 74.5, eye: EYE, at: [0, 93, 0], fov: 70, clear: true }, shots: [['noon', 'on'], ['noon', 'novol'], ['golden', 'on']] },
  { name: 'lake', cam: { x: 201.5, z: 6.5, eye: EYE, at: [250, 64, 70], fov: 70, clear: true }, shots: [['noon', 'on'], ['noon', 'novol'], ['golden', 'on']] },
  { name: 'trees', cam: { x: 238.5, z: 12.5, eye: EYE, at: [252, null, 52], fov: 70, forest: true }, shots: [['noon', 'on'], ['noon', 'novol'], ['golden', 'on']], cost: 'noon' },
  woodCam ? { name: 'wood', cam: { x: woodCam.x, z: woodCam.z, eye: EYE, at: woodCam.at, fov: 70 }, shots: [['noon', 'on'], ['noon', 'novol'], ['golden', 'on'], ['golden', 'novol']] } : null,
].filter(Boolean);
const B_VIEWS = [
  { name: 'hall', cam: { hall: true, u: 0.5, v: -24.5, at: [0.5, 40, 8], fov: 66, far: false }, shots: [['noon', 'on'], ['night', 'on'], ['golden', 'on'], ['rain', 'on'], ['seq', 'on']], cost: 'noon' },
  glassCam ? { name: 'glass', cam: { feet: glassCam.feet, at: glassCam.at, fov: 66 }, shots: [['glass', 'on']] } : null,
  vLh ? { name: 'vista_lh', vista: vLh, shots: [['vnight', 'on']] } : null,
  vCit ? { name: 'vista_cit', vista: vCit, shots: [['vnight', 'on']] } : null,
].filter(Boolean);
const want = (v) => !ONLY || ONLY.includes(v.name);
// (BONLY: the views the build before shoots in this run — its others kept from the run before: v0.48 does not change)
const BONLY = process.env.BONLY ? process.env.BONLY.split(',') : null;
const wantT = (tag, v) => (tag === 'before' && BONLY ? BONLY.includes(v.name) : want(v));
if (process.env.CAMS_ONLY) { for (const v of A_VIEWS.concat(B_VIEWS)) console.log(v.name, JSON.stringify(v.cam || { vista: v.vista.id, eye: v.vista.eye, yaw: v.vista.yaw, pitch: v.vista.pitch, fov: v.vista.fov }), JSON.stringify(v.shots)); process.exit(0); }

// ---------------------------------------------------------------- picture measures
const lab = (() => {
  const lin = new Float64Array(256); for (let i = 0; i < 256; i++) { const c = i / 255; lin[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return (r, g, b, out) => {
    const R = lin[r], G = lin[g], B = lin[b];
    const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047, Y = 0.2126 * R + 0.7152 * G + 0.0722 * B, Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
    const fx = f(X), fy = f(Y), fz = f(Z);
    out[0] = 116 * fy - 16; out[1] = 500 * (fx - fy); out[2] = 200 * (fy - fz);
  };
})();
const raw = async (p) => { const { data, info } = await sharp(p).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { d: data, w: info.width, h: info.height }; };
// ΔE (CIE76) of two pictures over a region (fractions x0, y0, x1, y1 of the picture)
const dE = async (a, b, rect = [0, 0, 1, 1]) => {
  const A = await raw(a), B = await raw(b);
  if (A.w !== B.w || A.h !== B.h) return null;
  const la = [0, 0, 0], lb = [0, 0, 0], x0 = Math.floor(rect[0] * A.w), x1 = Math.floor(rect[2] * A.w), y0 = Math.floor(rect[1] * A.h), y1 = Math.floor(rect[3] * A.h);
  let s = 0, n = 0, over = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const o = (y * A.w + x) * 3; lab(A.d[o], A.d[o + 1], A.d[o + 2], la); lab(B.d[o], B.d[o + 1], B.d[o + 2], lb); const d = Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]); s += d; n++; if (d > 2.3) over++; }
  return { mean: r2(s / n), over: r1(100 * over / n) };
};
// ΔE of the light alone: both pictures brought down to 64 × 36 first (a wisp of grass or a wave that moved between two
// pictures no longer counts — run 1's planted wood: its grass swayed between the light on and the light without the
// volumetric pass in the build before, ΔE 7.1 over a light change of nothing)
const dEsoft = async (a, b) => {
  const lo = async (p) => { const { data, info } = await sharp(p).removeAlpha().resize(64, 36, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true }); return { d: data, w: info.width, h: info.height }; };
  const A = await lo(a), B = await lo(b), la = [0, 0, 0], lb = [0, 0, 0]; let s = 0, n = 0;
  for (let i = 0; i < A.w * A.h; i++) { lab(A.d[i * 3], A.d[i * 3 + 1], A.d[i * 3 + 2], la); lab(B.d[i * 3], B.d[i * 3 + 1], B.d[i * 3 + 2], lb); s += Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]); n++; }
  return { mean: r2(s / n) };
};
// the mean linear luminance of a region (fractions)
const lumOf = async (p, rect) => {
  const A = await raw(p), x0 = Math.floor(rect[0] * A.w), x1 = Math.floor(rect[2] * A.w), y0 = Math.floor(rect[1] * A.h), y1 = Math.floor(rect[3] * A.h), lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  let s = 0, n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const o = (y * A.w + x) * 3; s += 0.2126 * lin(A.d[o]) + 0.7152 * lin(A.d[o + 1]) + 0.0722 * lin(A.d[o + 2]); n++; }
  return s / n;
};
// a region's light: L* mean and spread, a* b*, the share brighter than L* 60 and 85
const statsOf = async (p, rect = [0, 0, 1, 1]) => {
  const A = await raw(p), L = [0, 0, 0], x0 = Math.floor(rect[0] * A.w), x1 = Math.floor(rect[2] * A.w), y0 = Math.floor(rect[1] * A.h), y1 = Math.floor(rect[3] * A.h);
  let s = 0, s2 = 0, sa = 0, sb = 0, n = 0, b60 = 0, b85 = 0;
  for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) { const o = (y * A.w + x) * 3; lab(A.d[o], A.d[o + 1], A.d[o + 2], L); s += L[0]; s2 += L[0] * L[0]; sa += L[1]; sb += L[2]; n++; if (L[0] > 60) b60++; if (L[0] > 85) b85++; }
  const m = s / n;
  return { L: r1(m), sd: r1(Math.sqrt(Math.max(0, s2 / n - m * m))), a: r1(sa / n), b: r1(sb / n), b60: r2(100 * b60 / n), b85: r2(100 * b85 / n) };
};
// the mean absolute change of two pictures (0–255 over the three channels; motion.mjs) and a difference picture ×k
const change = (A, B) => { let s = 0, big = 0; const n = A.w * A.h; for (let i = 0, p = 0; i < n; i++, p += 3) { const d = Math.abs(A.d[p] - B.d[p]) + Math.abs(A.d[p + 1] - B.d[p + 1]) + Math.abs(A.d[p + 2] - B.d[p + 2]); s += d; if (d > 18) big++; } return { mean: +(s / n / 3).toFixed(3), share: +(big / n).toFixed(4) }; };
const diffPic = async (A, B, out, k) => { const o = Buffer.alloc(A.w * A.h * 3); for (let i = 0; i < o.length; i++) o[i] = Math.min(255, Math.abs(A.d[i] - B.d[i]) * k); await sharp(o, { raw: { width: A.w, height: A.h, channels: 3 } }).png().toFile(out); };
// test/land_ref.js's land: the golden frames' target and a picture's bands and split (its lower half at 640 × 360)
const SR = require(ROOT + 'test/sky_ref.js'), LR = require(ROOT + 'test/land_ref.js');
let GOLD = null;
const goldTarget = async () => {
  if (GOLD) return GOLD;
  const fsx = [];
  for (const [name, F] of Object.entries(SR.FRAMES)) { if (F.kind !== 'golden') continue; const img = await SR.load(FRAMES + name + '.jpg'); const m = LR.landOf(img, F.H + 2, img.h); if (m) fsx.push(m); }
  GOLD = { n: fsx.length, bands: [0, 1, 2, 3].map(k => [0, 1, 2].map(i => med(fsx.map(f => f.bands[k][i])))), split: med(fsx.map(f => f.split)) };
  return GOLD;
};
const landOf = async (p) => { const img = await SR.load(p, 640, 360); return LR.landOf(img, 180, 360); };

// ---------------------------------------------------------------- the browser, a page (light2.mjs's)
const browser = process.env.SHEET_ONLY ? null : await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
// the CPU time (ms) of this test's browser processes (utime + stime of every process below this node process — ipu.mjs)
const cpuNow = () => {
  const kids = new Map();
  for (const l of execSync('ps -e -o pid=,ppid=').toString().trim().split('\n')) { const [p, pp] = l.trim().split(/\s+/).map(Number); if (!kids.has(pp)) kids.set(pp, []); kids.get(pp).push(p); }
  let t = 0; const st = [process.pid];
  while (st.length) { for (const c of kids.get(st.pop()) || []) { st.push(c); try { const s = fs.readFileSync(`/proc/${c}/stat`, 'utf8'), f = s.slice(s.lastIndexOf(')') + 2).split(' '); t += +f[11] + +f[12]; } catch (e) { } } }
  return t * 10;
};
async function openPage(dist) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail|missing|shader/i.test(s)) logs.push(`[${t}] ${s.slice(0, 600)}`); });
  page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
  page.on('crash', () => { logs.push('[pageerror] the page crashed'); console.log('  !! the page crashed'); });
  await page.goto(dist, { timeout: 240000 });   // (the 10 MB page under a loaded machine: run 1's Very Low pages timed out at 30 s)
  const wait = (ms) => page.waitForTimeout(ms);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
  // the render stub: a step draws nothing (the world streams in), the frame object of the last step is kept (__F); a
  // picture: 'still' draws the kept frame k times (the same scene: only the light switches differ — on | novol), 'loop'
  // runs k game frames drawn (the halos, the steam, the motion live); then the screen is read back. The people within 6
  // blocks of the eye stand aside for the picture (light2.mjs)
  await ev(() => {
    const g = VR.game, r = g.renderer, gl = r.gl;
    window.__px = new Uint8Array(4);
    window.__sync = () => { const d = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING), rd = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, window.__px); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, d); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, rd); };
    r._render = r.render;
    r.render = function (F) { if (window.__norender) { window.__F = F; this.setupCamera(F.cam); return; } return this._render(F); };
    window.__shot = (mode, k) => {
      const p = g.player, Vg = g.villages, C = VR.Crowd, keepV = Vg && Vg.agents, keepC = C && C.heroes;
      const away = (a) => !a || !a.pos || Math.hypot(a.pos[0] - p.pos[0], a.pos[2] - p.pos[2]) > 6;
      if (keepV) Vg.agents = keepV.filter(away);
      if (keepC) C.heroes = keepC.filter(away);
      window.__norender = false;
      try {
        r.tsrReset = true; r.shadowValid = false;
        if (mode === 'still') { const F = window.__F; r.frameNo = 1000; for (let i = 0; i < k; i++) r.render(F); }
        else for (let i = 0; i < k; i++) { g.last = performance.now() - 33; g.loop(performance.now()); }
      } finally { if (keepV) Vg.agents = keepV; if (keepC) C.heroes = keepC; }
      const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, px = new Uint8Array(W * H * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
      window.__norender = true;
      let s = ''; const CH = 0x8000; for (let i = 0; i < px.length; i += CH) s += String.fromCharCode.apply(null, px.subarray(i, i + CH));
      const st = r.stats || {};
      return { png: btoa(s), W, H, draws: st.draws, tris: Math.round(st.tris || 0), fs: st.fsPasses };
    };
  });
  const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(4); } };
  const boost = (on) => ev((on) => { const g = VR.game, q = g.renderer && g.renderer.q; if (!q) return; if (on) { if (q.__up === undefined) q.__up = q.upload; q.upload = 24; } else if (q.__up !== undefined) { q.upload = q.__up; delete q.__up; } }, on);
  const holdFar = (on) => ev((on) => { const pool = VR.game.pool; if (!pool || !pool.queueFar) return 0; if (on) pool.__heldFar = (pool.__heldFar || []).concat(pool.queueFar.splice(0)); else if (pool.__heldFar) { for (const j of pool.__heldFar) pool.queueFar.push(j); pool.__heldFar = null; pool.queueDirty = true; if (pool.pump) pool.pump(); } return pool.queueFar.length + (pool.__heldFar ? pool.__heldFar.length : 0); }, on);
  // settled (wow48.mjs): nothing to generate, mesh, upload or fade in round the eye and every column in the render distance
  // shown (a dirty count that stops falling for six rounds counts), then up to farS seconds more for the horizon and the
  // far ring; maxS seconds at most
  const settle = async (maxS, farS = 0) => {
    let s = null, last = Infinity, stall = 0, nearAt = -1; const t0 = Date.now();
    await boost(true);
    for (let i = 0; ; i++) {
      await step(10);
      s = await ev(() => { const g = VR.game, w = g.world, p = g.player, rd = Math.max(1, (w.renderDist | 0) - 1), ri = Math.max(1, rd - 2), pcx = Math.floor(p.pos[0]) >> 4, pcz = Math.floor(p.pos[2]) >> 4; let dirty = 0; for (const c of w.cols.values()) { let n = 0; for (const sc of c.sec) if ((sc.dirty || sc.pending) && sc.count > 0) n++; const ex = c.cx - pcx, ez = c.cz - pcz; if (n && ex * ex + ez * ez <= ri * ri) dirty += n; } let unshown = 0; for (let dz = -rd; dz <= rd; dz++) for (let dx = -rd; dx <= rd; dx++) { if (dx * dx + dz * dz > rd * rd) continue; const c = w.col(pcx + dx, pcz + dz); if (!c || !(c.shownAt >= 0)) unshown++; } const h = g.horizon, f = h && h.far, fr = f && f.report ? f.report() : null; return { busy: g.pool.busy, pend: w.pending.size, dirty, up: w.uploadQ ? w.uploadQ.size : 0, fading: w.fading ? w.fading.size : 0, unshown, arr: w.arrivals ? w.arrivals.length : 0, hz: h ? h.inflight : 0, far: fr ? fr.inflight + fr.want : 0 }; });
      const shown = s.pend === 0 && s.up === 0 && s.fading === 0 && s.unshown === 0 && s.arr === 0;
      stall = shown && s.dirty >= last ? stall + 1 : 0; last = s.dirty;
      const near = shown && ((s.busy === 0 && s.dirty === 0) || stall >= 6), el = (Date.now() - t0) / 1000;
      s.s = Math.round(el);
      if (near && i > 2) { if (nearAt < 0) nearAt = el; if (!farS || (s.hz === 0 && s.far === 0) || el - nearAt >= farS) break; }
      if (el >= maxS) break;
      await wait(60);
    }
    await boost(false);
    s.near = nearAt < 0 ? -1 : Math.round(nearAt);
    return s;
  };
  // the VX detail (crowns, furniture, facade pieces) within the detail distance, uploaded before a picture (ipu.mjs)
  const warmVx = () => ev(() => {
    const g = VR.game, r = g.renderer, p = g.player; if (!r.vxResidency || !g.world) return -1;
    const Q = g.world.uploadQ && g.world.uploadQ.drain ? g.world.uploadQ : null, queued = !!(r.queueVx && Q);
    if (queued) r.upQ = Q;
    const cam = [p.pos[0], p.pos[1] + (p.eye || 1.62), p.pos[2]], list = [];
    for (const c of g.world.cols.values()) for (const s of c.sec) if (s && s.hasMesh) list.push(s);
    const D = (r.q && r.q.vxLod) || 48, up2 = D * D; let n = 0;
    for (; n < 600; n++) { let w8 = 0; for (const s of list) { if (!s.vxData || s.mesh[3]) continue; const dx = s.ox + 8 - cam[0], dy = s.oy + 8 - cam[1], dz = s.oz + 8 - cam[2]; if (dx * dx + dy * dy * 0.5 + dz * dz < up2) w8++; } if (!w8) break; r.vxResidency(list, cam); if (queued) Q.drain(1e6, null, 0, 0); }
    return n;
  });
  const groundY = (x, z) => ev(([x, z]) => { const w = VR.game.world, R = VR.R, F = VR.F; for (let y = 200; y > 30; y--) { const s = w.getBlock(Math.floor(x), y, Math.floor(z)); if (s && (R.T.flags[s] & (F.OPAQUE | F.FLUID)) && !(R.T.flags[s] & F.LEAVES)) return y; } return 80; }, [x, z]);
  const clearEye = (x, y, z, yaw, pitch, need) => ev(([x, y, z, yaw, pitch, need]) => {
    const w = VR.game.world, R = VR.R, F = VR.F;
    const fl = (x, y, z) => { const s = w.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)); return s ? R.T.flags[s] : 0; };
    const cp = Math.cos(pitch), dx = -Math.sin(yaw) * cp, dy = Math.sin(pitch), dz = -Math.cos(yaw) * cp, hx = Math.hypot(dx, dz) || 1;
    const box = (x, y, z) => { for (const b of [-0.6, 0, 0.9]) for (let a = -1; a <= 1; a++) for (let c = -1; c <= 1; c++) if (fl(x + a * 0.9, y + b, z + c * 0.9) & F.SOLID) return false; return true; };
    const ray = (x, y, z) => { for (let t = 0.5; t <= need; t += 0.25) if (fl(x + dx * t, y + dy * t, z + dz * t) & (t <= 2.5 ? F.SOLID : F.OPAQUE | F.LEAVES)) return false; return true; };
    for (let back = 0; back <= 12; back += 2) { const bx = x - dx / hx * back, bz = z - dz / hx * back; for (let up = 0; up <= 24; up++) if (box(bx, y + up, bz) && ray(bx, y + up, bz)) return { x: bx, y: y + up, z: bz, up, back }; }
    return { x, y, z, up: 0, back: 0, stuck: true };
  }, [x, y, z, yaw, pitch, need]);
  const pose = (x, feet, z, yaw, pitch, fov) => ev(([x, y, z, yaw, pitch, fov]) => { const g = VR.game, p = g.player; p.flying = true; p.noclip = true; p.teleport(x, y, z); p.yaw = yaw; p.pitch = pitch; p.viewYaw = yaw; p.fovKick = 0; p.vel = [0, 0, 0]; g.settings.fov = fov; const e = g.entities; if (e && e.mobs) e.mobs.length = 0; }, [x, feet, z, yaw, pitch, fov]);
  // the eye's light settled at this time (light2.mjs: the exposure follows the light at the eye)
  const setTime = (tod) => ev((tod) => { const g = VR.game, p = g.player; g.env.setTime(tod); g.env.anim = 499; if (g.envFor) g.envFor(p.eyePos(), 1, { freezeTime: true, freezeWeather: true }); g.env.anim = 499; if (g.envFor) g.envFor(p.eyePos(), 1, { freezeTime: true, freezeWeather: true }); return g.env.timeOfDay; }, tod);
  // the weather (material.mjs): dry or in the rain (the wet state set directly: env.wetS in both builds)
  const weather = (kind) => ev((kind) => {
    const g = VR.game, E = g.env, wx = E.wx, rain = kind === 'rain' ? 1 : 0, wet = rain, pud = rain;
    if (wx && wx.force) wx.force(kind === 'rain' ? 'regen' : 'klar');
    if (wx) { wx.frozen = null; if (wx.v) { wx.v.rain = rain; if (rain) { wx.v.cloud = 0.9; wx.v.sun = 0.35; wx.v.dark = 0.3; } else { wx.v.dark = 0; wx.v.sun = 1; } } }
    E.puddle = pud; if (E.wetS) { E.wetS.wet = wet; E.wetS.pud = pud; }
    if (!rain) { E.rain = 0; E.rainTarget = 0; }
    return { rain, wet, pud, has: !!E.wetS };
  }, kind);
  // the light switches (light2.mjs config): on (the preset's defaults) or novol (all but the volumetric pass)
  const config = (c) => ev((c) => {
    const g = VR.game, r = g.renderer, L2 = VR.Light2;
    if (!L2 || !L2.SW) return 'none';
    const dflt = L2.defaults(g.settings.preset), q = {};
    for (const k of L2.SW) q[k] = c === 'novol' && k === 'l2Vol' ? false : dflt[k];
    r.setQuality(q);
    return L2.SW.filter(k => r.q[k]).map(k => k + (typeof r.q[k] === 'number' ? '=' + r.q[k] : '')).join(',') || 'off';
  }, c);
  const picture = async (path, mode, k) => {
    const m = await ev(([mode, k]) => window.__shot(mode, k), [mode, k]);
    await sharp(Buffer.from(m.png, 'base64'), { raw: { width: m.W, height: m.H, channels: 4 } }).flip().removeAlpha().png().toFile(path);
    delete m.png;
    return m;
  };
  // the frame's cost (light2.mjs): k frames of the kept frame to warm, then n timed (each synced); the CPU ms of the browser
  const cost = async (k, n) => {
    await ev((k) => { const g = VR.game, r = g.renderer, F = window.__F; window.__norender = false; r.frameNo = 1000; r.tsrReset = true; r.shadowValid = false; for (let i = 0; i < k; i++) r.render(F); window.__sync(); window.__norender = true; }, k);
    const c0 = cpuNow();
    const wall = await ev((n) => { const g = VR.game, r = g.renderer, F = window.__F, out = []; window.__norender = false; for (let i = 0; i < n; i++) { const t0 = performance.now(); r.render(F); window.__sync(); out.push(performance.now() - t0); } window.__norender = true; return out; }, n);
    return { cpuMs: Math.round((cpuNow() - c0) / n), wallMs: Math.round(med(wall)) };
  };
  return { ctx, page, logs, ev, wait, step, settle, holdFar, warmVx, groundY, clearEye, pose, setTime, weather, config, picture, cost };
}
const errsOf = (P) => P.logs.filter(l => l.startsWith('[pageerror]'));
async function makeWorld(P, seed, vgen, preset) {
  await P.ev(([p, rd]) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.renderDist = Math.min(rd, (VR.Game.PRESETS[p] || {}).renderDist || rd); g.applySettings('*'); }, [preset, RD]);
  await P.ev(([seed, v]) => VR.game.createWorld(Object.assign({ name: 'Polish ' + seed, mode: 'creative', difficulty: 'peaceful', type: 'default', seed, cheats: true, kit: true }, v ? { vgen: v } : {})), [seed, vgen]);
  for (let i = 0; i < 150; i++) { await P.wait(1000); if (await P.ev(() => VR.game.state) === 'play') break; }
  const ok = await P.ev(() => VR.game.state) === 'play';
  // (the game's own frames stop once the world is there: from now on the test steps the loop itself; the wow moments off)
  await P.ev(() => { const g = VR.game; g.zenFreezeTime = true; g.zenFreezeWeather = true; if (g.env.wx && g.env.wx.force) g.env.wx.force('klar'); g.env.rain = 0; g.env.rainTarget = 0; g.settings.wowMoments = false; window.requestAnimationFrame = () => 0; g.hideHud = true; for (const id of ['hud', 'ui', 'hints']) { const h = document.getElementById(id); if (h) h.style.display = 'none'; } });
  const meta = await P.ev(() => { const g = VR.game, r = g.renderer, q = r.q || {}, L2 = VR.Light2; return { vgen: (g.meta && g.meta.vgen) || 0, preset: g.settings.preset, rd: g.settings.renderDist, lang: VR.I18N && VR.I18N.lang, light2: L2 && L2.SW ? L2.SW.filter(k => q[k]).join(',') || 'none' : 'n/a', pbr: q.pbr, ssr: q.ssr, motion: g.settings.motion, lite: !!q.lite }; });
  return { ok, meta };
}
// the forest east of the lake (light2.mjs / ipu.mjs: 63 oaks and birches, short grass and poppies between them)
const forest = (P) => P.ev(() => {
  const g = VR.game, w = g.world, R = VR.R, F = VR.F;
  const st = (n) => { const t = R.byName[n]; return t ? t.defaultState : 0; };
  const gy = (x, z) => { for (let y = 160; y > 30; y--) { const s = w.getBlock(x, y, z); if (s && (R.T.flags[s] & F.OPAQUE) && !(R.T.flags[s] & F.LEAVES)) return y; } return -1; };
  const list = [], put = (x, y, z, s) => list.push([x, y, z, s]);
  const tree = (x, z, kind, h) => {
    const y0 = gy(x, z); if (y0 < 0) return 0;
    const log = st(kind + '_log'), leaves = st(kind + '_leaves');
    for (let y = 1; y <= h; y++) put(x, y0 + y, z, log);
    for (let dy = -2; dy <= 1; dy++) { const r = dy === 1 ? 1 : 2; for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) { if (Math.abs(dx) === r && Math.abs(dz) === r && (dy !== -1 || (dx + dz) % 2)) continue; if (dx === 0 && dz === 0 && dy < 1) continue; put(x + dx, y0 + h + dy, z + dz, leaves); } }
    return 1;
  };
  let n = 0;
  for (let i = 0; i < 9; i++) for (let j = 0; j < 7; j++) n += tree(232 + i * 5 + (j % 2) * 2, 10 + j * 6 + (i % 3), (i + j) % 3 === 0 ? 'birch' : 'oak', 4 + ((i * 7 + j * 3) % 3));
  const set = new Set(list.map(e => e[0] + ',' + e[1] + ',' + e[2]));
  for (let x = 226; x < 280; x++) for (let z = 6; z < 54; z++) { if ((x * 7 + z * 13) % 3) continue; const y0 = gy(x, z); if (y0 < 0 || set.has(x + ',' + (y0 + 1) + ',' + z) || w.getBlock(x, y0 + 1, z)) continue; put(x, y0 + 1, z, (x + z) % 11 === 0 ? st('poppy') : st('short_grass')); }
  w.bulkSet(list, false);
  return { trees: n, blocks: list.length };
});
const ROT = [(u, v) => [u, v], (u, v) => [-v, u], (u, v) => [-u, -v], (u, v) => [v, -u]];
const aimAt = (x, y, z, at) => { const dx = at[0] - x, dy = at[1] - y, dz = at[2] - z; return [Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz))]; };
// a camera placed: the columns round it loaded first (teleported high, the far ring held), the eye on the ground or where
// the camera says, cleared by the camera rule, aimed; then settled there (the far ring and the horizon farS seconds more)
async function place(P, v) {
  let c = v.cam, x, z, eyeY, yaw, pitch, fov, moved = null;
  if (v.vista) { const q = v.vista; x = q.eye[0]; z = q.eye[2]; eyeY = q.eye[1]; yaw = q.yaw; pitch = q.pitch; fov = q.fov || 62; }
  else {
    if (c.hall) { const s = P.site, q = ROT[s.r](c.u, c.v), t = ROT[s.r](c.at[0], c.at[1]); c = Object.assign({}, c, { x: s.x + q[0], z: s.z + q[1], eye: { feet: s.F + 1 }, at: [s.x + t[0], s.F + 1 + c.at[2], s.z + t[1]] }); }
    if (c.feet) c = Object.assign({}, c, { x: c.feet[0], z: c.feet[2], eye: c.feet[1] === null ? EYE : { feet: c.feet[1] } });
    x = c.x; z = c.z; fov = c.fov;
  }
  await P.ev(([x, z]) => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(x, 150, z); }, [x, z]);
  await P.holdFar(true); const s0 = await P.settle(P.first ? 240 : 400, 0); P.first = true; await P.holdFar(false);
  if (!v.vista) {
    const gy = await P.groundY(x, z);
    eyeY = typeof c.eye === 'number' ? gy + 1 + c.eye : c.eye.y !== undefined ? c.eye.y : c.eye.feet + EYE;
    const at = c.at.slice(); if (at[1] === null) at[1] = (await P.groundY(at[0], at[2])) + 1 + 3;
    [yaw, pitch] = aimAt(x, eyeY, z, at);
    if (c.clear) { const C = await P.clearEye(x, eyeY, z, yaw, pitch, 6); if (C.up || C.back) { moved = { up: C.up, back: C.back }; x = C.x; z = C.z; eyeY = C.y; [yaw, pitch] = aimAt(x, eyeY, z, at); } if (C.stuck) moved = 'stuck'; }
  }
  await P.pose(x, eyeY - EYE, z, yaw, pitch, fov);
  const s1 = await P.settle(240, v.vista ? 90 : c.far === false ? 0 : 40); await P.step(4); await P.warmVx(); await P.step(2);
  return { x: r2(x), feet: r2(eyeY - EYE), z: r2(z), yaw: r2(yaw), pitch: r2(pitch), fov, moved, settle: [s0 && s0.s, s1 && s1.s, s1 && s1.near] };
}

// ---------------------------------------------------------------- one build: its two worlds
async function shootBuild(tag) {
  const rec = { tag, dist: DISTS[tag], worlds: {}, views: {}, cost: {} }, recPath = `${SHOTS}polish2_${tag}.json`;
  // (a run of some views only: the record of the others is kept from the run before)
  if (ONLY || (tag === 'before' && BONLY)) { try { const old = JSON.parse(fs.readFileSync(recPath, 'utf8')); rec.views = old.views || {}; rec.worlds = old.worlds || {}; } catch (e) { /* none yet */ } }
  const save = () => { try { fs.writeFileSync(recPath, JSON.stringify(rec, null, 1)); } catch (e) { /* a convenience */ } };
  for (const [wname, seed, vgen, views] of [['A', '4242', 10, A_VIEWS], ['B', '53', 0, B_VIEWS]]) {
    const list = views.filter(v => wantT(tag, v)); if (!list.length) continue;
    let P = await openPage(DISTS[tag]);
    const { ok, meta } = await makeWorld(P, seed, vgen, 'high');
    rec.worlds[wname] = meta;
    check(ok, `${tag} · world ${wname} (seed ${seed}, vgen ${meta.vgen}) is loaded: ${JSON.stringify(meta)} (${secs()})`);
    if (!ok) { await P.ctx.close(); continue; }
    if (wname === 'B') {
      // the hall city of seed 53, cell (−2, −1) (light2.mjs): its site and its hall's turn from the game's own generator
      P.site = await P.ev(() => { try { const W = VR.game.world, VG = VR.VillageGen, og = new VR.OverworldGen(W.seed, W.genOpts); const s = VG.site(og, -2, -1); if (!s) return null; const Pl = VG.plan(og, s), h = Pl.hall || null; return h ? { x: s.x, z: s.z, r: h.r, F: h.F } : null; } catch (e) { return null; } }) || { x: -944, z: -296, r: 3, F: 73, fallback: true };
      console.log(`  the hall city ${JSON.stringify(P.site)}`);
    }
    for (const v of list) {
      const t0 = Date.now(), R = rec.views[v.name] = { pics: {} };
      try {
        if (v.cam && v.cam.forest && !P.forest) {
          await P.ev(([x, z]) => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(x, 150, z); }, [v.cam.x + 12, v.cam.z + 20]);
          await P.holdFar(true); await P.settle(300, 0); P.forest = await forest(P); await P.settle(200, 0); await P.holdFar(false);
          console.log(`  forest: ${JSON.stringify(P.forest)} (${secs()})`);
        }
        R.pose = await place(P, v);
        if (v.prep === 'hangar') { await P.ev(() => { const g = VR.game; if (g.hall && g.hall.flight && g.hall.flight.jumpPhase) { g.hall.flight.update(0.03); const L = g.hall.flight.plan && g.hall.flight.plan.legs.find(l => l.name === 'pad'); g.hall.flight.jumpPhase('pad', L ? Math.min(0.6, 21 / L.T) : 0.3); } if (g.hall && g.hall.jump) g.hall.jump(8); }); await P.step(4); }
        console.log(`  ${tag} · ${v.name}: ${JSON.stringify(R.pose)} (${secs()})`);
        for (const [what, cf] of v.shots) {
          const name = v.name + '_' + what + (cf === 'on' ? '' : '_' + cf), path = shot(name, tag);
          if (what === 'seq') {
            // the motion (motion.mjs): noon, the actors held (ships, the life director, trams, the people, the animals), 5 s
            // for what they left in the air to fade, then three frames 10 game frames apart
            await P.setTime(TOD.noon); await P.config('on');
            await P.ev(() => { const g = VR.game; g.__frozen = []; for (const k of ['traffic', 'padLife', 'lifeDirector', 'director', 'starships', 'hall', 'trams', 'companions', 'entities', 'mirror']) { const o = g[k]; if (o && typeof o.update === 'function') { g.__frozen.push([o, 'update', o.update]); o.update = k === 'entities' ? function (dt) { const L = this.land; if (L && L.effects && g.particles && g.settings.preset !== 'potato') L.effects(dt, g.settings.preset); } : function () {}; } } const Vg = g.villages; for (const k of ['updateAgent', 'updateBoats']) if (Vg && typeof Vg[k] === 'function') { g.__frozen.push([Vg, k, Vg[k]]); Vg[k] = function () {}; } });
            await P.step(150); await P.warmVx();
            const fr = [];
            for (let i = 0; i < 3; i++) { if (i) await P.step(6); const p = shot(`${v.name}_seq_f${i}`, tag); await P.picture(p, 'loop', 4); fr.push(await raw(p)); }
            await P.ev(() => { const g = VR.game; for (const [o, k, f] of g.__frozen || []) o[k] = f; g.__frozen = null; });
            const c01 = change(fr[0], fr[1]), c12 = change(fr[1], fr[2]);
            R.motion = { mean: +((c01.mean + c12.mean) / 2).toFixed(3), share: +((c01.share + c12.share) / 2).toFixed(4), c01, c12 };
            await diffPic(fr[0], fr[2], shot(`${v.name}_seq_diff`, tag), 8);
            const steam = await P.ev(() => { const a = VR.game.motionAir; return a ? { tables: a.tables.length, steam: a.drawn.steam } : null; });
            R.motion.steam = steam;
            console.log(`    seq: motion ${R.motion.mean} (f0→f1 ${c01.mean}, f1→f2 ${c12.mean}; ${(R.motion.share * 100).toFixed(2)} % of the pixels) · steam ${JSON.stringify(steam)}`);
            continue;
          }
          const tod = what === 'rain' ? TOD.noon : TOD[what];
          await P.setTime(tod);
          const q = await P.config(cf);
          let mode = what === 'noon' || what === 'golden' ? 'still' : 'loop';
          if (what === 'rain') { R.weather = await P.weather('rain'); await P.step(30); mode = 'loop'; }
          await P.step(2);
          const m = await P.picture(path, mode, mode === 'still' ? 2 : 4);
          if (what === 'rain') { await P.weather('dry'); await P.step(10); }
          const st = await statsOf(path);
          R.pics[what + '_' + cf] = Object.assign({ q, mode }, m, st);
          if (what === 'golden') fs.copyFileSync(path, `${SHOTS}light2_${v.name === 'hall' ? 'hallcity' : v.name}_golden_on_polish2${tag}.png`);
          console.log(`    ${what} ${cf} [${q}]: L* ${st.L} ±${st.sd}, a* ${st.a} b* ${st.b}, > 60: ${st.b60} %, > 85: ${st.b85} %, ${m.draws} draws (${secs()})`);
        }
        await P.config('on');
        // the frame's cost on High at this view (the kept frame at its first time)
        if (v.cost && !process.env.NO_COST) { await P.setTime(TOD[v.cost]); await P.step(2); R.cost = await P.cost(4, N); console.log(`    cost (High, ${v.cost}): ${JSON.stringify(R.cost)}`); }
      } catch (e) {
        R.error = String(e.stack || e.message || e).slice(0, 400);
        console.log(`  !! ${tag} · ${v.name}: ${R.error}`);
        const alive = await Promise.race([P.ev(() => 1).then(() => 'answers', () => 'error'), new Promise(ok => setTimeout(() => ok('silent'), 20000))]);
        if (alive !== 'answers') { console.log(`  !! the page is ${alive}: the rest of world ${wname} is skipped`); break; }
      }
      R.ms = Date.now() - t0;
      save();
    }
    const errs = errsOf(P);
    check(errs.length === 0, `${tag} · world ${wname}: no page error (${errs.length})`);
    for (const l of P.logs.slice(0, 8)) console.log('    ' + l);
    await Promise.race([P.ctx.close().catch(() => {}), new Promise(ok => setTimeout(ok, 30000))]);
  }
  save();
  return rec;
}

// ---------------------------------------------------------------- the sheet
const SHEET = [
  ['floor', 'hall_night', 't1_22', '1 Hallenboden: Strasse unterm Glasdach, Nacht (vgen 11 -> 12)'],
  ['floor_noon', 'hall_noon', 't1_22', '1 Hallenboden: Strasse unterm Glasdach, Mittag'],
  ['vista', 'vista_cit_vnight', 't1_05', `2 Zitadelle aus ${vCit ? vCit.d : '?'} m bei Nacht: Lichter in der Ferne, kleinere Laternenhalos`],
  ['vista_lh', 'vista_lh_vnight', 't1_07', `2 Leuchtturm-Aussicht (${vLh ? vLh.id : '?'}) bei Nacht`],
  // (gap 3 taken back: its after is the canopy weight's attempt of the second run — the final march is v0.48's, so the
  //  final wood is the picture before; the attempt's pictures are kept as polish2_wood_*_gapboost.png)
  ['shafts', 'wood_noon', 't1_09', '3 Wald, Mittag: rechts der Versuch, zurueckgenommen (final = v0.48)', 'gapboost'],
  ['shafts_golden', 'wood_golden', 't1_07', '3 Wald, goldene Stunde: rechts der Versuch, zurueckgenommen', 'gapboost'],
  ['golden', 'hills_golden', 't1_07', '4 Goldene Stunde: Huegel'],
  ['golden_av', 'avenue_golden', 't1_09', '4 Goldene Stunde: Allee'],
  ['villa', 'glass_glass', 't1_24', '5 Villa Nova: Fenster spiegeln den Himmel, goldene Stunde'],
  ['rain', 'hall_rain', null, '6 Regen: unterm Glasdach bleibt der Boden trocken'],
  ['street', 'hall_seq_f0', null, '7 Strasse zu Mittag (Bild 1 von 3)'],
  ['street_motion', 'hall_seq_diff', null, '7 Strasse: Bewegung Bild 1 -> 3 (Differenz x8): Markisen, Dampf'],
  ['hangar', 'hangar_am', 't1_13', '8 Hangarhalle: die Luft traegt das Cyan'],
];
function sheet() {
  const PY = '/root/r9coord/sheet.py';
  if (!fs.existsSync(PY)) { console.log(`  (no ${PY}: no sheet)`); return; }
  // the pairs under the gaps' names (polish2_<gap>_{before,after}.png) and the sheet
  // (a row's fifth field names the tag its right-hand picture comes from: 'gapboost', an attempt taken back)
  for (const [gap, view, , , at] of SHEET) for (const t of ['before', at || 'after']) if (fs.existsSync(shot(view, t))) fs.copyFileSync(shot(view, t), `${SHOTS}polish2_${gap}_${t}.png`);
  const pic = (gap, t) => (fs.existsSync(`${SHOTS}polish2_${gap}_${t}.png`) ? `${SHOTS}polish2_${gap}_${t}.png` : null);
  const spec = { cols: ['Trailer', 'Vorher (v0.48)', 'Nachher'], w: 560, rows: SHEET.map(([gap, , f, l, at]) => ({ label: l + (f ? `  [Trailer ${f}]` : '  [kein Trailerbild]'), imgs: [f ? FRAMES + f + '.jpg' : null, pic(gap, 'before'), pic(gap, at || 'after')] })) };
  const sp = `${ROOT}.tmp_tests/polish2_sheet.json`;
  fs.writeFileSync(sp, JSON.stringify(spec, null, 1));
  try { console.log('  sheet ' + execFileSync('python3', [PY, `${SHOTS}polish2_sheet.jpg`, sp]).toString().trim()); } catch (e) { console.log(`  !! the sheet: ${String(e.message || e).split('\n')[0].slice(0, 200)}`); }
}
// the numbers per gap, before against after (from the records of both builds, whichever this run made)
async function report() {
  const load = (t) => { try { return JSON.parse(fs.readFileSync(`${SHOTS}polish2_${t}.json`, 'utf8')); } catch (e) { return null; } };
  const B = load('before'), A = load('after'), out = {};
  const both = (f) => [B ? f(B) : null, A ? f(A) : null];
  // gap 3: on − novol (the volumetric pass's light alone) at noon — and the natural wood at the golden hour. The wood's
  // 'after' of the second run is the canopy weight's attempt (kept as tag 'gapboost'; taken back: the final march is
  // v0.48's, test/polish2.js 3): how much the pass adds and how much of the picture it blows out (> L* 85)
  for (const [v, t0] of [['wood', 'noon'], ['wood', 'golden'], ['trees', 'noon'], ['lake', 'noon'], ['temple', 'noon']]) {
    const d = [], tags = v === 'wood' ? ['before', 'gapboost'] : ['before', 'after'];
    for (const t of tags) {
      const on = shot(`${v}_${t0}`, t), nv = shot(`${v}_${t0}_novol`, t);
      if (!fs.existsSync(on) || !fs.existsSync(nv)) { d.push(null); continue; }
      const e = await dEsoft(on, nv), so = await statsOf(on), sn = await statsOf(nv);
      d.push(Object.assign(e, { b85: r2(so.b85 - sn.b85) }));
    }
    out[`shafts_${v}_${t0}`] = d;
    console.log(`  3 · ${v} at ${t0}, on − novol ΔE (the share it blows out > L* 85): ${tags[0]} ${d[0] ? d[0].mean + ' (' + d[0].b85 + ' %)' : '—'} · ${tags[1]} ${d[1] ? d[1].mean + ' (' + d[1].b85 + ' %)' : '—'}`);
  }
  // (the open land has no canopy over the eye: the pass's light there as before)
  for (const v of ['lake', 'temple']) { const d = out[`shafts_${v}_noon`]; if (d && d[0] && d[1]) check(d[1].mean <= d[0].mean + 0.3, `3 · the open ${v} not veiled more than before: on − novol ΔE ${d[0].mean} → ${d[1].mean}`); }
  // gap 4: the golden land against the frames (world A's six views: the same world in both builds — the hall city's floor
  // is vgen 12's porcelain after, which moves its land by itself)
  const T = await goldTarget(), gv = ['avenue', 'temple', 'hills', 'lake', 'villa', 'trees'];
  for (const t of ['before', 'after']) {
    const ms = []; for (const v of gv) { const p = shot(`${v}_golden`, t); if (fs.existsSync(p)) { const m = await landOf(p); if (m) ms.push([v, m]); } }
    if (!ms.length) continue;
    const dEm = ms.reduce((s, [, m]) => s + LR.dEb(m, T), 0) / ms.length, split = ms.reduce((s, [, m]) => s + m.split, 0) / ms.length;
    out['golden_' + t] = { n: ms.length, bandsDE: r1(dEm), split: r1(split), per: Object.fromEntries(ms.map(([v, m]) => [v, { dE: r1(LR.dEb(m, T)), split: r1(m.split) }])) };
    console.log(`  4 · golden land (${ms.length} views) ${t}: bands ΔE ${r1(dEm)}, split ${r1(split)} (the frames ${r1(T.split)}) · ${ms.map(([v, m]) => v + ' ' + r1(LR.dEb(m, T)) + '/' + r1(m.split)).join(', ')}`);
  }
  if (out.golden_before && out.golden_after) check(Math.abs(out.golden_after.split - T.split) <= Math.abs(out.golden_before.split - T.split) && out.golden_after.bandsDE <= out.golden_before.bandsDE + 0.5, `4 · the golden land nearer the frames: split ${out.golden_before.split} → ${out.golden_after.split} (frames ${r1(T.split)}), bands ΔE ${out.golden_before.bandsDE} → ${out.golden_after.bandsDE}`);
  // gap 6: the street in the rain against dry at noon — how much more the floor darkens than the walls (a wet floor is
  // darker; the rain's grey sky darkens both): the floor's ratio over the walls' (1: the floor no wetter than a wall; run 1
  // measured the floor's ΔE first, which the light's change and the café's steam drowned)
  const rd = [];
  for (const t of ['before', 'after']) {
    const a = shot('hall_noon', t), b = shot('hall_rain', t);
    if (!fs.existsSync(a) || !fs.existsSync(b)) { rd.push(null); continue; }
    const fl = [0.5, 0.7, 0.8, 1.0], w1 = [0.86, 0.05, 1.0, 0.45], w2 = [0.0, 0.0, 0.14, 0.25];
    const f = (await lumOf(b, fl)) / (await lumOf(a, fl)), w = ((await lumOf(b, w1)) / (await lumOf(a, w1)) + (await lumOf(b, w2)) / (await lumOf(a, w2))) / 2;
    rd.push({ floor: r2(f), walls: r2(w), wet: r2(f / w) });
  }
  out.rain = rd;
  console.log(`  6 · the street in the rain: the floor's darkening over the walls' (1 = dry) before ${rd[0] ? JSON.stringify(rd[0]) : '—'} · after ${rd[1] ? JSON.stringify(rd[1]) : '—'}`);
  if (rd[0] && rd[1]) check(rd[1].wet > rd[0].wet + 0.03, `6 · under the glass vault the floor stays drier in the rain (the floor's darkening over the walls' ${rd[0].wet} → ${rd[1].wet})`);
  // gap 7: the street's motion
  const mo = both(R => R.views.hall && R.views.hall.motion ? R.views.hall.motion.mean : null);
  out.motion = mo;
  console.log(`  7 · the street's motion: before ${mo[0]} · after ${mo[1]}${mo[0] && mo[1] ? ' (×' + r2(mo[1] / mo[0]) + ')' : ''}`);
  if (mo[0] && mo[1]) check(mo[1] >= 1.3 * mo[0], `7 · the street moves more: ${mo[0]} → ${mo[1]} mean change a pixel (×${r2(mo[1] / mo[0])}, ≥ ×1.3)`);
  // gap 2: the vistas' lights at night (the upper 60 %: the landmark's lights; the whole picture's glows)
  for (const v of ['vista_cit', 'vista_lh']) {
    const s = []; for (const t of ['before', 'after']) { const p = shot(`${v}_vnight`, t); s.push(fs.existsSync(p) ? [await statsOf(p, [0, 0, 1, 0.6]), await statsOf(p, [0, 0.6, 1, 1])] : null); }
    out[v] = s;
    console.log(`  2 · ${v} at night, the upper 60 % > 60: ${s.map(q => q ? q[0].b60 + ' %' : '—').join(' → ')}, > 85: ${s.map(q => q ? q[0].b85 + ' %' : '—').join(' → ')} · the lower 40 % > 85 (the halos): ${s.map(q => q ? q[1].b85 + ' %' : '—').join(' → ')}`);
  }
  // gap 8: the hangar's air (the upper middle: the far end), gap 5: the glass front, gap 1: the floor (the lower third)
  for (const [k, view, rect] of [['hangar', 'hangar_am', [0.25, 0.15, 0.75, 0.55]], ['glass', 'glass_glass', [0.25, 0.2, 0.75, 0.8]], ['floor_night', 'hall_night', [0.15, 0.66, 0.85, 1]], ['floor_noon', 'hall_noon', [0.15, 0.66, 0.85, 1]]]) {
    const s = []; for (const t of ['before', 'after']) { const p = shot(view, t); s.push(fs.existsSync(p) ? await statsOf(p, rect) : null); }
    out[k] = s;
    console.log(`  ${k}: ${s.map(q => q ? `L* ${q.L} ±${q.sd} a* ${q.a} b* ${q.b} > 85 ${q.b85} %` : '—').join(' → ')}`);
  }
  // the High cost
  for (const v of ['hall', 'trees', 'hangar']) { const c = both(R => R.views[v] && R.views[v].cost ? R.views[v].cost.cpuMs : null); out['cost_' + v] = c; console.log(`  cost High · ${v}: CPU ms a frame ${c[0]} → ${c[1]}`); }
  try { fs.writeFileSync(`${SHOTS}polish2_report.json`, JSON.stringify(out, null, 1)); } catch (e) { /* a convenience */ }
}

// ---------------------------------------------------------------- Very Low: both builds side by side, rounds in turns
async function veryLow() {
  const out = { views: {} };
  let P = null, Q = null;
  try {
    P = await openPage(DISTS.after); Q = await openPage(DISTS.before);
    const a = await makeWorld(P, '4242', 10, 'potato'), b = await makeWorld(Q, '4242', 10, 'potato');
    check(a.ok && b.ok, `Very Low: both builds' worlds are loaded (${JSON.stringify(a.meta)} · ${JSON.stringify(b.meta)}) (${secs()})`);
    check(a.meta.lite && a.meta.light2 === 'none' && !a.meta.motion, `Very Low draws lite, with none of the light switches and no motion (${a.meta.light2}, motion ${a.meta.motion})`);
    for (const v of A_VIEWS.filter(x => x.name === 'avenue' || x.name === 'temple')) {
      await place(P, v); await place(Q, v);
      for (const X of [P, Q]) { await X.setTime(TOD.noon); await X.step(2); }
      const pa = shot(`vl_${v.name}`, 'after'), pb = shot(`vl_${v.name}`, 'before');
      await P.picture(pa, 'still', 9); await Q.picture(pb, 'still', 9);
      const runs = { this: [], base: [] };
      for (let k = 0; k < ROUNDS; k++) for (const [lbl, X] of (k % 2 ? [['base', Q], ['this', P]] : [['this', P], ['base', Q]])) runs[lbl].push((await X.cost(9, Math.max(3, N))).cpuMs);
      const ratio = r2(med(runs.this) / med(runs.base) * 100) / 100, d = await dE(pb, pa);
      out.views[v.name] = { runs, ratio, dE: d };
      console.log(`  Very Low · ${v.name}: CPU ms a frame this ${runs.this.join(' ')} · before ${runs.base.join(' ')} → ×${ratio} · picture ΔE ${d ? d.mean : '?'}`);
      check(ratio <= 1.03, `Very Low at the ${v.name}: not slower than v0.48 (×${ratio}, the medians of ${ROUNDS} rounds in turns; ≤ ×1.03)`);
      check(d && d.mean < 1.0, `Very Low at the ${v.name}: the same picture as v0.48 (ΔE ${d ? d.mean : '?'}, ${d ? d.over : '?'} % > 2.3)`);
    }
    check(errsOf(P).length === 0 && errsOf(Q).length === 0, `Very Low: no page error (${errsOf(P).length} · ${errsOf(Q).length})`);
  } catch (e) { check(false, 'Very Low: ' + String(e.stack || e.message || e).slice(0, 300)); }
  if (P) await P.ctx.close().catch(() => {}); if (Q) await Q.ctx.close().catch(() => {});
  try { fs.writeFileSync(`${SHOTS}polish2_verylow.json`, JSON.stringify(out, null, 1)); } catch (e) { /* a convenience */ }
}

// ---------------------------------------------------------------- the run
if (!process.env.SHEET_ONLY) {
  for (const tag of TAGS) {
    const rec = await shootBuild(tag);
    const views = Object.values(rec.views), errs = Object.entries(rec.views).filter(([, r]) => r.error).map(([k]) => k);
    check(views.length > 0 && !errs.length, `${tag}: every view has its pictures (${views.length} views${errs.length ? '; failed: ' + errs.join(', ') : ''})`);
    const blank = []; for (const [k, r] of Object.entries(rec.views)) for (const [p, m] of Object.entries(r.pics || {})) if (!(m.sd > 3)) blank.push(k + ' ' + p);
    check(blank.length === 0, `${tag}: no picture is blank${blank.length ? ' (' + blank.join(', ') + ')' : ''}`);
  }
  if (!process.env.NO_VL && TAGS.includes('after')) await veryLow();
}
if (browser) await browser.close();
await report();
sheet();
console.log(`(${secs()})`);
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

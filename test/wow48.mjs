// wow48 · the picture sheet of the v0.48 WOW release (the four fronts merged on v042: t-light2 · t-material · t-motion ·
// t-vista) against the build before (v0.47) and the trailer frames. One run shoots one build: a new default world of seed
// 53 (the Heartland; vgen 11 in v0.48, vgen 10 in v0.47 — no vgen is passed, each build makes what a player gets) on the
// High preset as a player gets it (only the dynamic resolution held off), view distance 8, 1280 × 720, de-DE — twelve
// views, each taken the way the front that made it takes it (its camera, its time of day, its preparation, its settle):
//   sun               t-light2: into the sun from the hills' terrace at its golden hour (10800; the hills camera, turned
//                     to the sun 7° up — light2.mjs's 'sun')
//   lake              t-light2: the lake under the isles at the golden hour (10800)
//   temple            t-light2: the Gate Temple from the plaza path at dusk (12600)
//   hallcity          t-light2: the Weißstadt's street under its glass vault at night (16500)
//   hangar            t-material: the Hangar Hall's navy floor, the craft on its pad, the crew out (its prep; 4000)
//   plaza             t-material: the crescent's paving at night (16000)
//   rain_after        t-material: the avenue a few minutes after the rain — wet, the puddles shrinking (prep 'after'; noon)
//   meadow            t-motion: the meadow at the east crossing at noon
//   storm             t-motion: a Gewitter forced, facing the next bolt — its bolt frame (f1)
//   rainbow           t-motion: the same place after the storm cleared (40 s on), facing away from the sun
//   vista_citadel     t-vista: the citadel's vista (seed 53: v1, the citadel on its peak, 630 m) at night (16000)
//   vista_lighthouse  t-vista: the lighthouse under the isles at the golden hour (12500) — seed 53's v3 is the isles' own
//                     vista (the lighthouse out of its frame): the lighthouse's best vista is taken, ranked as vista.mjs
//                     ranks them (seed 53: v2, 128 m — the lighthouse in the middle on the shore, the isles' undersides
//                     and falls top left; its v6 from 170 m has trees before the tower, only its lamp shows)
// The vistas are computed in node as test/vista.mjs does (vgen 11, the same plan as the page's workers); the build before
// has none and stands at the same eyes. Only the time of day and the weather are held (as every front's test does; the
// wow moments off as in vista.mjs, the animals at the lens sent away as in light2.mjs and material.mjs); the world's life
// goes on. A view settles until the chunks round it are generated, meshed, uploaded and shown (light2.mjs's settle; then
// the far ring and the horizon), BUDGET seconds at most (240).
// → test/shots/wow48_<view>_<TAG>.png and test/shots/wow48_<TAG>.json (the cameras, the settle, the frame's stats); one
// line per view with its settle time; a view that fails (an exception, a timeout) is logged and the run goes on (a page
// that no longer answers is replaced by a new one with a new world).
// The sheets (SHEET=1 after the run, SHEET_ONLY=1 alone, from the pictures of TAG=before and TAG=after there; with the
// coordinator's /root/r9coord/sheet.py): test/shots/wow48_sheet.jpg — Trailer · Vorher (v0.47) · Nachher (v0.48), a row a
// view, the trailer frame the view answers to (SHEET below) — and test/shots/wow48_sheet_after.jpg (the after pictures,
// two a row, 720 wide).
// usage (the build after first, then the build before):
//   TAG=after DIST=file:///home/dev/vr/.worktrees/v042/dist/index.html nohup bash test/wt_run.sh wow48.mjs 5400 > .tmp_tests/wow48_after.log 2>&1 &
//   TAG=before DIST=file:///home/dev/vr/dist/index.html nohup bash test/wt_run.sh wow48.mjs 5400 > .tmp_tests/wow48_before.log 2>&1 &
//   DIST: the page (default: this checkout's dist — wt_run.sh rewrites the path; in the v042 worktree v042's) · TAG=after |
//   before · ONLY=sun,storm (views) · SEED=53 · BUDGET=240 (s of settling a view) · LH=v2 (the lighthouse's vista by its
//   id) · CAMS_ONLY=1 (print the cameras) · SHEET=1 · SHEET_ONLY=1 · TRAIL=1 (f-flow: the meadow again with a forced low pass and
//   its contrail: wow48_meadow_trail_<TAG>.png)
// regress: skip  (a showcase: the pictures are the evidence)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import sharp from '/home/dev/.npm-global/lib/node_modules/sharp/lib/index.js';
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import fs from 'fs';
const require = createRequire(import.meta.url);
const SEED = process.env.SEED || '53', TAG = process.env.TAG || 'after', BUDGET = +(process.env.BUDGET || 240);
const ROOT = new URL('../', import.meta.url).pathname;   // this checkout (the test runs from test/ or from .tmp_tests/)
const DIST = process.env.DIST || 'file://' + ROOT + 'dist/index.html';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const PRESET = 'high', RD = 8, EYE = 1.62;
const SHOTS = ROOT + 'test/shots/';
// the fronts' times of day
const L2T = { noon: 6000, golden: 10800, dusk: 12600, night: 16500 };   // test/light2.mjs TIMES
const MAT = { am: 4000, noon: 6000, golden: 12500, night: 16000 };      // test/material.mjs
const MOT = { noon: 6000, night: 16000 };                                // test/motion.mjs
const VIS = { golden: 12500, night: 16000 };                             // test/vista.mjs
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const r2 = (x) => Math.round(x * 100) / 100;

// ---------------------------------------------------------------- the cameras (node: the shared code, the same seed)
const V = require(new URL('../test/load_shared.js', import.meta.url).pathname);   // this checkout's shared code (from test/ or from .tmp_tests/)
let meadow = null, hillsY = 136, vCit = null, vLh = null, vNote = '';
{
  // t-motion's meadow (motion.mjs: land.mjs's way — the first eye round the east crossing, in the open, whose lines to the
  // crossing and to points round it are clear, nothing within 10 blocks in the frame; vgen 10 as motion.mjs computes it —
  // vgen 11 gives the same eye for seed 53) and its hills eye for the storm and the rainbow
  const g = V.makeGen('overworld', +SEED, { vgen: 10 }), P = V.Land.plan(g);
  const RT = V.R.T, FL = V.F, CH = new Map();
  const blk = (x, y, z) => { y = Math.floor(y); if (y < 0 || y > 255) return 0; const X = Math.floor(x), Z = Math.floor(z), k = (X >> 4) + ',' + (Z >> 4); let c = CH.get(k); if (!c) { c = g.generate(X >> 4, Z >> 4); CH.set(k, c); } return c.blocks[(y << 8) | ((Z & 15) << 4) | (X & 15)]; };
  const open = (b) => !b || !(RT.flags[b] & (FL.OPAQUE | FL.LEAVES | FL.SOLID));
  const ground = (x, z) => { let y = 200; for (; y > 30; y--) { const b = blk(x, y, z); if (b && (RT.flags[b] & (FL.OPAQUE | FL.FLUID)) && !(RT.flags[b] & FL.LEAVES)) break; } return y; };
  const clearLine = (a, b) => { const d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), n = Math.ceil(d / 0.4); for (let i = 1; i < n; i++) { const t = i / n; if (!open(blk(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t))) return false; } return true; };
  const eyeOpen = (x, y, z) => { for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (!open(blk(x + dx, y + dy, z + dz))) return false; return true; };
  const findView = (tgt, az0, dists, ups, around) => {
    for (let k = 0; k < 24; k++) {
      const az = az0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 12);
      for (const up of ups) for (const d of dists) {
        const x = tgt[0] + Math.cos(az) * d, z = tgt[2] + Math.sin(az) * d, y = ground(x, z) + 1 + up, ex = [x, y, z];
        if (!eyeOpen(x, y, z)) continue;
        const px = -Math.sin(az), pz = Math.cos(az), pts = [tgt].concat((around || []).map(([side, dy]) => [tgt[0] + px * side, tgt[1] + dy, tgt[2] + pz * side]));
        const fx = tgt[0] - x, fz = tgt[2] - z, fa = Math.atan2(fz, fx), fe = Math.atan2(tgt[1] - y, Math.hypot(fx, fz));
        let near = false;
        for (let ha = -40; ha <= 40 && !near; ha += 10) for (let va = -4; va <= 20 && !near; va += 8) { const A = fa + ha * Math.PI / 180, Ev = fe + va * Math.PI / 180; if (!clearLine(ex, [x + Math.cos(A) * Math.cos(Ev) * 10, y + Math.sin(Ev) * 10, z + Math.sin(A) * Math.cos(Ev) * 10])) near = true; }
        if (!near && pts.every(q => clearLine(ex, q))) return { x, y, z };
      }
    }
    return null;
  };
  const ce = P.sites.find(s => s.id === 'cross_e');
  if (ce) { const tgt = [ce.x, ground(ce.x, ce.z) + 2, ce.z], v = findView(tgt, Math.atan2(20, -14), [22, 28, 34], [2, 4, 6], [[-8, 2], [8, 2]]); if (v) meadow = { x: v.x, z: v.z, eye: { y: v.y }, at: tgt }; }
  hillsY = Math.max(136, ground(0.5, -292.5) + 30);
}
{
  // t-vista's vista points (vista.mjs: vgen 11's plan) — the eye, the yaw, the pitch and the lens of each
  const g11 = V.makeGen('overworld', +SEED, { vgen: 11 }), P = V.Land.plan(g11), LM = V.Vista.landmarks(g11, P);
  const ASPECT = 1280 / 720;
  const project = (v, q) => { const cp = Math.cos(v.pitch), sp = Math.sin(v.pitch), f = [-Math.sin(v.yaw) * cp, sp, -Math.cos(v.yaw) * cp], r = [Math.cos(v.yaw), 0, -Math.sin(v.yaw)], u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]], d = [q[0] - v.eye[0], q[1] - v.eye[1], q[2] - v.eye[2]]; const zc = d[0] * f[0] + d[1] * f[1] + d[2] * f[2]; if (zc <= 0.1) return null; const t = Math.tan(v.fov * Math.PI / 360); return [0.5 + 0.5 * (d[0] * r[0] + d[1] * r[1] + d[2] * r[2]) / (zc * t * ASPECT), 0.5 - 0.5 * (d[0] * u[0] + d[1] * u[1] + d[2] * u[2]) / (zc * t)]; };
  const isles = LM.find(l => l.id === 'isles'), islesUp = (v) => isles ? isles.members.map(m => project(v, [m.x, m.top, m.z])).filter(p => p && p[0] > 0 && p[0] < 1 && p[1] > 0 && p[1] < 0.5).length : 0;
  const best = (lm, f) => P.vistas.filter(v => v.lm === lm).sort((a, b) => f(b) - f(a) || (b.wow ? 1 : 0) - (a.wow ? 1 : 0) || b.score - a.score)[0] || null;
  const byId = (id) => P.vistas.find(v => v.id === id) || null;
  vCit = byId('v1') && byId('v1').lm === 'citadel' ? byId('v1') : best('citadel', () => 0);
  vLh = process.env.LH && byId(process.env.LH) ? byId(process.env.LH) : byId('v3') && byId('v3').lm === 'lighthouse' ? byId('v3') : best('lighthouse', () => 0);
  if (process.env.LH) vNote = `the lighthouse's vista by LH=${process.env.LH}`;
  else if (byId('v3') && byId('v3').lm !== 'lighthouse') vNote = `v3 of seed ${SEED} is the ${byId('v3').lm}' vista — the lighthouse's best vista (vista.mjs's rank: the wow ones, then the score): ${vLh ? vLh.id + ' (' + vLh.d + ' m, ' + islesUp(vLh) + ' isles in the upper half of its frame)' : 'none'}`;
  console.log(`the vistas (${P.vistas.length}): citadel ${vCit ? vCit.id + ' ' + vCit.d + ' m ' + vCit.fov + '°' : '—'} · lighthouse ${vLh ? vLh.id + ' ' + vLh.d + ' m ' + vLh.fov + '°' : '—'}${vNote ? ' (' + vNote + ')' : ''}`);
}

// ---------------------------------------------------------------- the views (in the sheet's order)
// front light2: cam = light2.mjs's CAMS entry ({x, z, eye: blocks above the ground | {y} | {feet}, at, fov, clear, far} or
// the hall city's {hall, u, v, at}); material: feet ([x, y | null, z]), at, fov, prep; motion: x, z, eye, at, fov, wx;
// vista: the vista record. tod: the front's time; farS: seconds for the far ring and the horizon after the near world.
const VIEWS = [
  { name: 'sun', front: 'light2', cam: { x: 0.5, z: -292.5, eye: { y: 136 }, at: [0, 84, -105], fov: 60, clear: true }, sun: true, tod: L2T.golden, farS: 60 },
  { name: 'lake', front: 'light2', cam: { x: 201.5, z: 6.5, eye: EYE, at: [250, 64, 70], fov: 70, clear: true }, tod: L2T.golden, farS: 60 },
  { name: 'temple', front: 'light2', cam: { x: 4.5, z: 74.5, eye: EYE, at: [0, 93, 0], fov: 70, clear: true }, tod: L2T.dusk, farS: 60 },
  { name: 'hallcity', front: 'light2', cam: { hall: true, u: 0.5, v: -24.5, at: [0.5, 40, 8], fov: 66, far: false }, tod: L2T.night, farS: 0 },
  { name: 'hangar', front: 'material', feet: [0.5, 82.4, 9], at: [0.5, 83.2, -10], fov: 74, prep: 'hangar', tod: MAT.am, farS: 30 },
  { name: 'plaza', front: 'material', feet: [-22.5, null, -63.5], at: [-70, 82.6, -72], fov: 70, tod: MAT.night, farS: 40 },
  { name: 'rain_after', front: 'material', feet: [1.5, null, -62.5], at: [1, 83, -100], fov: 70, prep: 'after', tod: MAT.noon, farS: 40 },
  meadow ? Object.assign({ name: 'meadow', front: 'motion', fov: 70, tod: MOT.noon, wx: 'klar', farS: 30 }, meadow) : { name: 'meadow', missing: 'no meadow camera (cross_e)' },
  { name: 'storm', front: 'motion', x: 0.5, z: -292.5, eye: { y: hillsY }, at: null, fov: 70, tod: null, wx: 'gewitter', farS: 30 },
  { name: 'rainbow', front: 'motion', x: 0.5, z: -292.5, eye: { y: hillsY }, at: null, fov: 70, tod: null, wx: 'dry', farS: 30 },
  vCit ? { name: 'vista_citadel', front: 'vista', vista: vCit, tod: VIS.night, farS: 90 } : { name: 'vista_citadel', missing: 'no citadel vista' },
  vLh ? { name: 'vista_lighthouse', front: 'vista', vista: vLh, tod: VIS.golden, farS: 90 } : { name: 'vista_lighthouse', missing: 'no lighthouse vista' },
];
// the order they are shot in: the places near each other one after another, the weather's views last (the storm leaves
// its rain and the rainbow its bow in the sky)
const ORDER = ['hangar', 'temple', 'plaza', 'rain_after', 'lake', 'meadow', 'vista_lighthouse', 'vista_citadel', 'hallcity', 'sun', 'storm', 'rainbow'];
const SHOOT = ORDER.map(n => VIEWS.find(v => v.name === n)).filter(v => v && (!ONLY || ONLY.includes(v.name)));
console.log('views', JSON.stringify(VIEWS.map(v => [v.name, v.front || '—', v.cam ? [v.cam.x, v.cam.z] : v.feet ? v.feet : v.vista ? [v.vista.id, ...v.vista.eye] : [v.x !== undefined ? +v.x.toFixed(1) : null, v.z !== undefined ? +v.z.toFixed(1) : null], v.tod])));
if (process.env.CAMS_ONLY) { for (const v of VIEWS) console.log(JSON.stringify(v)); process.exit(0); }

// ---------------------------------------------------------------- the sheets
// the trailer frame each view answers to (docs/trailer/README.md's shot list, TRAILER.md, the fronts' plans; null: no frame
// shows it) and the row's German label (ASCII: the sheet's default font has no umlauts)
const SHEET = [
  ['sun', 't1_01', '1 Sonne im Gegenlicht, Huegelterrasse, goldene Stunde'],
  ['lake', 't1_09', '2 See unter den Himmelsinseln, goldene Stunde'],
  ['temple', 't1_10', '3 Tor-Tempel vom Platzweg, Abenddaemmerung'],
  ['hallcity', 't1_22', '4 Weissstadt: Hallenstrasse unterm Glasdach, Nacht'],
  ['hangar', 't1_13', '5 Hangarhalle: Schiff auf dem Pad, Spiegelboden'],
  ['plaza', 't1_24', '6 Platz: Pflaster mit Lichtlinien, Nacht'],
  ['rain_after', 't3_05', '7 Allee nach dem Regen: nass, Pfuetzen, Mittag'],
  ['meadow', 't3_09', '8 Wiese an der Ostkreuzung, Mittag'],
  ['storm', null, '9 Gewitter ueber den Huegeln: das Blitzbild'],
  ['rainbow', null, '10 Regenbogen nach dem Gewitter'],
  ['vista_citadel', 't1_05', `11 Aussicht ${vCit ? vCit.id : '?'}: die Zitadelle (${vCit ? vCit.d : '?'} m), Nacht`],
  ['vista_lighthouse', 't1_07', `12 Aussicht ${vLh ? vLh.id : '?'}: Leuchtturm unter den Inseln (${vLh ? vLh.d : '?'} m), goldene Stunde`],
];
function sheets() {
  const PY = '/root/r9coord/sheet.py', FRAMES = ROOT + 'docs/trailer/frames/';
  if (!fs.existsSync(PY)) { console.log(`  (no ${PY}: no sheet)`); return; }
  const shot = (v, t) => { const p = `${SHOTS}wow48_${v}_${t}.png`; return fs.existsSync(p) ? p : null; };
  const main = { cols: ['Trailer', 'Vorher (v0.47)', 'Nachher (v0.48)'], w: 560, rows: SHEET.map(([v, f, l]) => ({ label: l + (f ? `  [Trailer ${f}]` : '  [kein Trailerbild]'), imgs: [f ? FRAMES + f + '.jpg' : null, shot(v, 'before'), shot(v, 'after')] })) };
  const after = { cols: [], w: 720, rows: [] };
  for (let i = 0; i + 1 < SHEET.length; i += 2) after.rows.push({ label: SHEET[i][2], labels: [SHEET[i][2], SHEET[i + 1][2]], imgs: [shot(SHEET[i][0], 'after'), shot(SHEET[i + 1][0], 'after')] });   // (sheet.py: one label per picture)
  for (const [name, spec] of [['wow48_sheet', main], ['wow48_sheet_after', after]]) {
    const sp = `${ROOT}.tmp_tests/${name}.json`;
    fs.writeFileSync(sp, JSON.stringify(spec, null, 1));
    try { console.log('  sheet ' + execFileSync('python3', [PY, `${SHOTS}${name}.jpg`, sp]).toString().trim()); } catch (e) { console.log(`  !! ${name}: ${String(e.message || e).split('\n')[0].slice(0, 200)}`); }
  }
}
if (process.env.SHEET_ONLY) { sheets(); process.exit(0); }

const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });

// ---------------------------------------------------------------- a page with a world (light2.mjs's page, material.mjs's world)
async function openWorld(dist) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail|missing|shader/i.test(s)) logs.push(`[${t}] ${s.slice(0, 600)}`); });
  page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1200)));
  page.on('crash', () => { logs.push('[pageerror] the page crashed'); console.log('  !! the page crashed'); });
  await page.goto(dist);
  const wait = (ms) => page.waitForTimeout(ms);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
  // the render stub (light2.mjs): a step draws nothing while the world streams in, the camera follows
  await ev(() => { const r = VR.game.renderer; if (r._render) return; r._render = r.render; r.render = function (F) { if (window.__norender) { window.__F = F; this.setupCamera(F.cam); return; } return this._render(F); }; });
  const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(4); } };
  const boost = (on) => ev((on) => { const g = VR.game, q = g.renderer && g.renderer.q; if (!q) return; if (on) { if (q.__up === undefined) q.__up = q.upload; q.upload = 24; } else if (q.__up !== undefined) { q.upload = q.__up; delete q.__up; } }, on);
  // the far ring's queued jobs held (light2.mjs, ipu.mjs): the near world settles first, the far forms come after it
  const holdFar = (on) => ev((on) => { const pool = VR.game.pool; if (!pool || !pool.queueFar) return 0; if (on) pool.__heldFar = (pool.__heldFar || []).concat(pool.queueFar.splice(0)); else if (pool.__heldFar) { for (const j of pool.__heldFar) pool.queueFar.push(j); pool.__heldFar = null; pool.queueDirty = true; if (pool.pump) pool.pump(); } return pool.queueFar.length + (pool.__heldFar ? pool.__heldFar.length : 0); }, on);
  // settled (light2.mjs): nothing to generate, mesh, upload or fade in round the eye and every column in the render
  // distance shown (a dirty count that stops falling for six rounds counts — the re-meshes the world leaves for later);
  // then up to farS seconds more for the horizon and the far ring. By the clock (vista.mjs): maxS seconds at most
  const settle = async (maxS, farS = 0) => {
    let s = null, last = Infinity, stall = 0, nearAt = -1; const t0 = Date.now();
    await boost(true);
    for (let i = 0; ; i++) {
      await step(10);
      s = await ev(() => { const g = VR.game, w = g.world, p = g.player, rd = Math.max(1, (w.renderDist | 0) - 1), ri = Math.max(1, rd - 2), pcx = Math.floor(p.pos[0]) >> 4, pcz = Math.floor(p.pos[2]) >> 4; let dirty = 0; for (const c of w.cols.values()) { let n = 0; for (const sc of c.sec) if ((sc.dirty || sc.pending) && sc.count > 0) n++; const ex = c.cx - pcx, ez = c.cz - pcz; if (n && ex * ex + ez * ez <= ri * ri) dirty += n; } let unshown = 0; for (let dz = -rd; dz <= rd; dz++) for (let dx = -rd; dx <= rd; dx++) { if (dx * dx + dz * dz > rd * rd) continue; const c = w.col(pcx + dx, pcz + dz); if (!c || !(c.shownAt >= 0)) unshown++; } const h = g.horizon, f = h && h.far, fr = f && f.report ? f.report() : null; return { busy: g.pool.busy, pend: w.pending.size, dirty, up: w.uploadQ ? w.uploadQ.size : 0, fading: w.fading ? w.fading.size : 0, unshown, arr: w.arrivals ? w.arrivals.length : 0, hz: h ? h.inflight : 0, far: fr ? fr.inflight + fr.want : 0 }; });
      const shown = s.pend === 0 && s.up === 0 && s.fading === 0 && s.unshown === 0 && s.arr === 0;
      stall = shown && s.dirty >= last ? stall + 1 : 0; last = s.dirty;
      const near = shown && ((s.busy === 0 && s.dirty === 0) || stall >= 6), el = (Date.now() - t0) / 1000;
      s.i = i; s.s = Math.round(el);
      if (near && i > 2) { if (nearAt < 0) nearAt = el; if (!farS || (s.hz === 0 && s.far === 0) || el - nearAt >= farS) break; }
      if (el >= maxS) break;
      await wait(60);
    }
    await boost(false);
    s.near = nearAt < 0 ? -1 : Math.round(nearAt);
    return s;
  };
  // the VX detail (crowns, furniture, facade pieces) within the detail distance, uploaded before a picture (light2.mjs)
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
  // the camera rule (light2.mjs, beauty_audit.mjs): nothing solid round the eye, the view ray free for its first blocks —
  // else up a block at a time, else back along the view
  const clearEye = (x, y, z, yaw, pitch, need) => ev(([x, y, z, yaw, pitch, need]) => {
    const w = VR.game.world, R = VR.R, F = VR.F;
    const fl = (x, y, z) => { const s = w.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)); return s ? R.T.flags[s] : 0; };
    const cp = Math.cos(pitch), dx = -Math.sin(yaw) * cp, dy = Math.sin(pitch), dz = -Math.cos(yaw) * cp, hx = Math.hypot(dx, dz) || 1;
    const box = (x, y, z) => { for (const b of [-0.6, 0, 0.9]) for (let a = -1; a <= 1; a++) for (let c = -1; c <= 1; c++) if (fl(x + a * 0.9, y + b, z + c * 0.9) & F.SOLID) return false; return true; };
    const ray = (x, y, z) => { for (let t = 0.5; t <= need; t += 0.25) if (fl(x + dx * t, y + dy * t, z + dz * t) & (t <= 2.5 ? F.SOLID : F.OPAQUE | F.LEAVES)) return false; return true; };
    for (let back = 0; back <= 12; back += 2) { const bx = x - dx / hx * back, bz = z - dz / hx * back; for (let up = 0; up <= 24; up++) if (box(bx, y + up, bz) && ray(bx, y + up, bz)) return { x: bx, y: y + up, z: bz, up, back }; }
    return { x, y, z, up: 0, back: 0, stuck: true };
  }, [x, y, z, yaw, pitch, need]);
  // the pose (light2.mjs's, with the time of day of material.mjs's and vista.mjs's); the animals at the lens away where the
  // front's test sent them away (light2, material)
  const pose = (x, feet, z, yaw, pitch, fov, tod, noMobs) => ev(([x, y, z, yaw, pitch, fov, tod, noMobs]) => { const g = VR.game, p = g.player; p.flying = true; p.noclip = true; p.teleport(x, y, z); p.yaw = yaw; p.pitch = pitch; p.viewYaw = yaw; p.fovKick = 0; p.vel = [0, 0, 0]; g.settings.fov = fov; if (tod !== null) g.env.setTime(tod); const e = g.entities; if (noMobs && e && e.mobs) e.mobs.length = 0; }, [x, feet, z, yaw, pitch, fov, tod, !!noMobs]);
  // the eye's light settled at this time (light2.mjs: the exposure follows the light at the eye and must not still move)
  const setTimeL2 = (tod) => ev((tod) => { const g = VR.game, p = g.player; g.env.setTime(tod); g.env.anim = 499; if (g.envFor) g.envFor(p.eyePos(), 1, { freezeTime: true, freezeWeather: true }); g.env.anim = 499; if (g.envFor) g.envFor(p.eyePos(), 1, { freezeTime: true, freezeWeather: true }); return g.env.timeOfDay; }, tod);
  // the weather of a material view (material.mjs): dry, in the rain, or a few minutes after it — the wet state set directly
  // where the build has it (env.wetS: v0.48; env.puddle: the build before's), so both builds show the same moment
  const weather = (kind) => ev((kind) => {
    const g = VR.game, E = g.env, wx = E.wx;
    const rain = kind === 'rain' ? 1 : 0, wet = kind === 'rain' ? 1 : kind === 'after' ? 0.7 : 0, pud = kind === 'rain' ? 1 : kind === 'after' ? 0.75 : 0;
    if (wx && wx.force) wx.force(kind === 'rain' ? 'regen' : 'klar');
    if (wx) { wx.frozen = null; if (wx.v) { wx.v.rain = rain; if (kind === 'rain') { wx.v.cloud = 0.9; wx.v.sun = 0.35; wx.v.dark = 0.3; } else { wx.v.dark = 0; wx.v.sun = 1; } } }
    E.puddle = pud; if (E.wetS) { E.wetS.wet = wet; E.wetS.pud = pud; }
    return { rain, wet, pud, has: !!E.wetS };
  }, kind);
  // a picture (material.mjs's, motion.mjs's, vista.mjs's): the VX detail up, the time of day set, the frames drawn with
  // the villagers at the lens left out (light2.mjs: the crowd's heroes too) — the temporal history reset first, so the
  // picture carries nothing of the place before (light2.mjs) — then the screenshot; once the compositor's frame fails to
  // come (material.mjs runs 4, 5) the canvas itself is read, in the task that drew it (the HUD is hidden: the same picture)
  let shotDead = false;
  const picture = async (path, o) => {
    await warmVx();
    const st = await ev(([tod, frames, strike, heroes]) => {
      window.__norender = false; const g = VR.game, r = g.renderer, Vg = g.villages, C = VR.Crowd, p = g.player;
      if (tod !== null) g.env.setTime(tod);
      if (!strike) { r.tsrReset = true; r.shadowValid = false; }   // (the storm's f1 follows its f0 from the same eye, as in motion.mjs)
      const keep = Vg && Vg.agents ? Vg.agents : null, keepC = heroes && C && C.heroes ? C.heroes : null;
      if (keep) Vg.agents = keep.filter(a => !a || !a.pos || Math.hypot(a.pos[0] - p.pos[0], a.pos[2] - p.pos[2]) > 8);
      if (keepC) C.heroes = keepC.filter(a => !a || !a.pos || Math.hypot(a.pos[0] - p.pos[0], a.pos[2] - p.pos[2]) > 6);
      try { for (let i = 0; i < frames; i++) { if (strike && i === 0) g.env.lightning(); g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); }
      finally { if (keep) Vg.agents = keep; if (keepC) C.heroes = keepC; window.__norender = true; }
      const s = r.stats || {}; return { draws: s.draws, tris: Math.round(s.tris || 0), fs: s.fsPasses, tod: Math.round(g.env.timeOfDay || 0) };
    }, [o.tod === undefined ? null : o.tod, o.frames || 4, !!o.strike, !!o.heroes]);
    await page.bringToFront().catch(() => {});
    if (!shotDead) try { await page.screenshot({ path, timeout: 90000 }); return st; } catch (e) {
      const alive = await Promise.race([ev(() => Math.round(performance.now())).then(() => 'answers', () => 'error'), wait(20000).then(() => 'silent')]);
      console.log(`  !! screenshot ${path.replace(/^.*\//, '')} failed (${String(e.message || e).split('\n')[0].slice(0, 120)}); the page ${alive}`);
      if (alive !== 'answers') throw e;
      shotDead = true;
    }
    const url = await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } const u = g.renderer.gl.canvas.toDataURL('image/png'); window.__norender = true; return u; });
    await sharp(Buffer.from(url.split(',')[1], 'base64')).resize(1280, 720).png().toFile(path);
    console.log(`  (${path.replace(/^.*\//, '')}: read from the canvas)`);
    return st;
  };
  // the world (material.mjs, motion.mjs): the preset as a player gets it, the dynamic resolution off, the view distance 8;
  // a new default world (the Heartland), creative; the game's own frames stop once it is there, the HUD and the hints hidden
  await ev(([p, rd]) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.renderDist = rd; g.applySettings('*'); }, [PRESET, RD]);
  await ev(`VR.game.createWorld({name:'WOW 0.48',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',cheats:true,kit:true})`);
  for (let i = 0; i < 150; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
  const ok = await ev(() => VR.game.state) === 'play';
  await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.zenFreezeWeather = true; if (g.env.wx && g.env.wx.force) g.env.wx.force('klar'); g.env.rain = 0; g.env.rainTarget = 0; g.settings.wowMoments = false; window.requestAnimationFrame = () => 0; g.hideHud = true; for (const id of ['hud', 'ui', 'hints']) { const h = document.getElementById(id); if (h) h.style.display = 'none'; } if (!document.getElementById('__nohint')) { const st = document.createElement('style'); st.id = '__nohint'; st.textContent = '#hint,#hints,#lockhint{display:none !important}'; document.head.appendChild(st); } });
  return { ctx, page, logs, ev, wait, step, settle, holdFar, warmVx, groundY, clearEye, pose, setTimeL2, weather, picture, ok };
}
const notBlank = async (path) => { try { const { data, info } = await sharp(path).raw().toBuffer({ resolveWithObject: true }); let s = 0, s2 = 0, n = 0; for (let i = 0; i < data.length; i += info.channels * 7) { const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]; s += l; s2 += l * l; n++; } const m = s / n; return { ok: Math.sqrt(Math.max(0, s2 / n - m * m)) > 6, mean: Math.round(m), sd: Math.round(Math.sqrt(Math.max(0, s2 / n - m * m))) }; } catch (e) { return { ok: false }; } };
const ROT = [(u, v) => [u, v], (u, v) => [-v, u], (u, v) => [-u, -v], (u, v) => [v, -u]];
const aimAt = (x, y, z, at) => { const dx = at[0] - x, dy = at[1] - y, dz = at[2] - z; return [Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz))]; };

// ---------------------------------------------------------------- one view
// returns {pose, settle: [the columns, at the pose], pic}; left(): the seconds of settling this view has left
async function shootView(A, v, path) {
  const t0 = Date.now(), left = () => Math.max(5, BUDGET - (Date.now() - t0) / 1000), out = { name: v.name, front: v.front };
  // the columns round the place first (teleported high: light2.mjs's place, material.mjs's and motion.mjs's views; the far
  // ring held meanwhile) — at least 60 s of the budget kept for the settle at the pose
  const columns = async (x, z) => { await A.ev(([x, z]) => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(x, 150, z); }, [x, z]); await A.holdFar(true); const s = await A.settle(Math.max(10, left() - 60), 0); await A.holdFar(false); return s; };
  let s0 = null, s1 = null, tod = v.tod, o = { tod };
  if (v.front === 'light2') {
    let c = v.cam;
    if (c.hall) {
      // the hall city of seed 53, cell (−2, −1) (light2.mjs): its site and its hall's turn from the game's own generator
      if (!A.site) A.site = await A.ev(() => { try { const W = VR.game.world, VG = VR.VillageGen, og = new VR.OverworldGen(W.seed, W.genOpts); const s = VG.site(og, -2, -1); if (!s) return null; const P = VG.plan(og, s), h = P.hall || null; return h ? { x: s.x, z: s.z, r: h.r, F: h.F, style: s.style } : { x: s.x, z: s.z, r: (s.seed >>> 3) & 3, F: s.y, style: s.style }; } catch (e) { return { err: String(e.message || e) }; } });
      // (no site: material.mjs's numbers of the same hall — world = (cx + v, cz − u), the floor at 73)
      const site = A.site && !A.site.err ? A.site : { x: -944, z: -296, r: 3, F: 73, fallback: A.site && A.site.err };
      out.site = site;
      const q = ROT[site.r](c.u, c.v), t = ROT[site.r](c.at[0], c.at[1]);
      c = Object.assign({}, c, { x: site.x + q[0], z: site.z + q[1], eye: { feet: site.F + 1 }, at: [site.x + t[0], site.F + 1 + c.at[2], site.z + t[1]] });
    }
    let x = c.x, z = c.z;
    s0 = await columns(x, z);
    const gy = await A.groundY(x, z);
    let eyeY = typeof c.eye === 'number' ? gy + 1 + c.eye : c.eye.y !== undefined ? c.eye.y : c.eye.feet + EYE;
    const at = c.at.slice(); if (at[1] === null) at[1] = (await A.groundY(at[0], at[2])) + 1 + 3;
    let [yaw, pitch] = aimAt(x, eyeY, z, at), moved = null;
    if (c.clear) { const C = await A.clearEye(x, eyeY, z, yaw, pitch, 6); if (C.up || C.back) { moved = { up: C.up, back: C.back }; x = C.x; z = C.z; eyeY = C.y; [yaw, pitch] = aimAt(x, eyeY, z, at); } if (C.stuck) moved = 'stuck'; }
    let fov = c.fov;
    if (v.sun) {
      // into the sun (light2.mjs): from the hills' terrace at the golden hour, turned to the sun 7° up (the pitch a little
      // under it), the lens 70°
      await A.setTimeL2(tod);
      const sd = await A.ev(() => VR.game.env.E.sunDir.slice());
      yaw = Math.atan2(-sd[0], -sd[2]); pitch = Math.atan2(sd[1], Math.hypot(sd[0], sd[2])) - 0.06; fov = 70;
      out.sunDir = sd.map(q => r2(q));
    }
    await A.pose(x, eyeY - EYE, z, yaw, pitch, fov, tod, true);
    s1 = await A.settle(left(), c.far === false ? 0 : v.farS); await A.step(4); await A.warmVx(); await A.step(2);
    await A.setTimeL2(tod);
    out.pose = { x: r2(x), feet: r2(eyeY - EYE), z: r2(z), yaw: r2(yaw), pitch: r2(pitch), fov, moved };
    o = { tod, heroes: true };
  } else if (v.front === 'material') {
    const [fx, fy, fz] = v.feet;
    s0 = await columns(fx, fz);
    const feet = fy === null ? (await A.groundY(fx, fz)) + 1 : fy, eyeY = feet + EYE;
    const [yaw, pitch] = aimAt(fx, eyeY, fz, v.at);
    await A.pose(fx, feet, fz, yaw, pitch, v.fov, tod, true);
    out.weather = await A.weather(v.prep === 'rain' ? 'rain' : v.prep === 'after' ? 'after' : 'dry');
    s1 = await A.settle(left(), v.farS); await A.step(6);
    // the scene's moment (material.mjs): the hall's craft on its pad with the crew out
    if (v.prep === 'hangar') { await A.ev(() => { const g = VR.game; if (g.hall && g.hall.flight && g.hall.flight.jumpPhase) { g.hall.flight.update(0.03); const L = g.hall.flight.plan && g.hall.flight.plan.legs.find(l => l.name === 'pad'); g.hall.flight.jumpPhase('pad', L ? Math.min(0.6, 21 / L.T) : 0.3); } if (g.hall && g.hall.jump) g.hall.jump(8); }); await A.step(4); }
    out.pose = { x: fx, feet: r2(feet), z: fz, yaw: r2(yaw), pitch: r2(pitch), fov: v.fov };
    o = { tod };
  } else if (v.front === 'motion') {
    s0 = await columns(v.x, v.z);
    const gy = await A.groundY(v.x, v.z), eyeY = typeof v.eye === 'object' ? v.eye.y : gy + 1 + v.eye;
    let yaw = 0, pitch = 0;
    if (v.at) { let ay = v.at[1]; if (typeof ay === 'object') ay = (await A.groundY(v.at[0], v.at[2])) + 1 + ay.up; [yaw, pitch] = aimAt(v.x, eyeY, v.z, [v.at[0], ay, v.at[2]]); }
    // the storm and the rainbow (motion.mjs): an afternoon whose sun stands 15–30° up (the bow's place); their weather
    if (v.tod === null) tod = await A.ev(() => { const g = VR.game; for (const t of [9500, 9000, 10000, 8500, 10500, 3500, 3000]) { g.env.setTime(t); g.last = performance.now() - 16; window.__norender = true; g.loop(performance.now()); const s = g.env.E && g.env.E.sunDir; if (s && s[1] > 0.26 && s[1] < 0.5) return t; } return 9500; });
    await A.pose(v.x, eyeY - EYE, v.z, yaw, pitch, v.fov, tod, false);
    // (the storm: 12 s for the rain and the wind to come up, then no bolt of its own — the one in f1 is struck by hand; the
    // rainbow: a storm first if none came before, then forced dry and 40 s for the bow)
    if (v.wx === 'gewitter') { await A.ev(() => VR.game.env.wx.force('gewitter')); await A.step(360); await A.ev(() => { VR.game.env.wx.bolt = 1e9; }); }
    else if (v.wx === 'dry') { if (await A.ev(() => VR.game.env.wx.kind !== 'gewitter')) { await A.ev(() => VR.game.env.wx.force('gewitter')); await A.step(90); } await A.ev(() => VR.game.env.wx.force('klar')); await A.step(1200); }
    else await A.ev((k) => VR.game.env.wx.force(k), v.wx);
    // the storm faces the side the storm comes from, a little up; the rainbow faces away from the sun, the bow's top in the
    // upper half (motion.mjs)
    if (v.name === 'storm') { const a = await A.ev(() => (VR.game.env.wx.windAngle || 0) + Math.PI); yaw = Math.atan2(-Math.cos(a), -Math.sin(a)); pitch = 0.06; }
    if (v.name === 'rainbow') { const s = await A.ev(() => VR.game.env.E.sunDir.slice()); yaw = Math.atan2(s[0], s[2]); pitch = (42 * Math.PI / 180 - Math.asin(Math.max(-1, Math.min(1, s[1])))) * 0.45; out.sunDir = s.map(q => r2(q)); }
    await A.pose(v.x, eyeY - EYE, v.z, yaw, pitch, v.fov, tod, false);
    s1 = await A.settle(left(), v.farS); await A.step(150);   // (motion.mjs: 5 s — what the actors left in the air fades; the steady air stays)
    out.pose = { x: r2(v.x), feet: r2(eyeY - EYE), z: r2(v.z), yaw: r2(yaw), pitch: r2(pitch), fov: v.fov, tod };
    o = { tod: null };
    if (v.name === 'storm') {
      // the sequence's first frames (f0), the next bolt chosen within ±26° of the view's middle (this build: VR.WX.boltOf,
      // the seeded place the strike will take; the build before has none), 6 steps on, the bolt struck: f1 (motion.mjs)
      await A.warmVx();
      await A.ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 4; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; });
      out.bolt = await A.ev(() => { const wx = VR.game.env.wx, W = VR.WX; if (!W || !W.boltOf) return null; const fa = (wx.windAngle || 0) + Math.PI; for (let n = wx.strikes; n < wx.strikes + 400; n++) { let d = W.boltOf(wx.seed, n + 1, fa, 1).ang - fa; d = Math.atan2(Math.sin(d), Math.cos(d)); if (Math.abs(d) < 0.45) { wx.strikes = n; return +d.toFixed(3); } } return null; });
      await A.step(6);
      o = { tod: null, strike: true };
    }
  } else if (v.front === 'vista') {
    const q = v.vista;
    // (vista.mjs poses at the eye and settles there; the columns are loaded from above first like the other views)
    s0 = await columns(q.eye[0], q.eye[2]);
    await A.pose(q.eye[0], q.eye[1] - EYE, q.eye[2], q.yaw, q.pitch, q.fov || 62, tod, false);
    s1 = await A.settle(left(), v.farS); await A.step(6);
    out.pose = { id: q.id, lm: q.lm, d: q.d, x: q.eye[0], feet: r2(q.eye[1] - EYE), z: q.eye[2], yaw: q.yaw, pitch: q.pitch, fov: q.fov };
    o = { tod, frames: 3 };
  }
  out.settle = [s0, s1]; out.settleS = Math.round((Date.now() - t0) / 1000);
  const tp = Date.now();
  out.st = await A.picture(path, o);
  out.picS = Math.round((Date.now() - tp) / 1000);
  // f-flow (R50-04): TRAIL=1 — the meadow again with a low pass forced across the view (the life director's 'flyover', its
  // contrail): stepped until its lead has passed the middle of its path and 2.5 s on → wow48_meadow_trail_<TAG>.png
  if (process.env.TRAIL && v.name === 'meadow') {
    const tp2 = path.replace('wow48_meadow_', 'wow48_meadow_trail_');
    out.trail = await A.ev(() => { const g = VR.game, D = g.lifeDirector; if (!D) return { ok: false, why: 'no director' }; D.update(0.01); const ok = !!D.force('flyover', { k: 777001 }); return { ok, tag: ok ? 'ld777001' : null }; });   // (force() says whether it started; the act's tag is 'ld' + its k)
    // (the craft's design is built by a worker: the pass starts when it is there — up to 60 s by the clock; then a second
    // of play at a time until the lead is past its nearest point)
    const lead = () => A.ev((tag) => { const T = VR.game.traffic, s = T.ships.find(z => z.tag === tag && !z.wing); return s ? { t: +s.t.toFixed(3), pos: s.pos.map(x => Math.round(x)) } : { none: true, pending: T.pending | 0 }; }, out.trail.tag);
    for (let i = 0; i < 120 && out.trail.ok; i++) { const q = await lead(); out.trail.lead = q; if (!q.none) break; await A.wait(500); await A.step(2); }
    for (let i = 0; i < 60 && out.trail.ok && !out.trail.lead.none; i++) { await A.step(30); const q = await lead(); if (q.none) break; out.trail.lead = q; if (q.t > 0.56) break; }
    await A.step(75);
    out.trail.pic = await A.picture(tp2, { tod: null, frames: 4 });
    console.log(`  the meadow with a low pass: ${JSON.stringify(out.trail)}`);
  }
  if (v.front === 'material') await A.weather('dry');
  return out;
}

// ---------------------------------------------------------------- the run
const rec = { tag: TAG, seed: SEED, dist: DIST, budget: BUDGET, vistaNote: vNote, views: [] }, recPath = `${SHOTS}wow48_${TAG}.json`;
// (ONLY: the views of an earlier run of this tag are kept in the record, those shot again replaced)
if (ONLY) { try { const old = JSON.parse(fs.readFileSync(recPath, 'utf8')); rec.views = (old.views || []).filter(q => !ONLY.includes(q.name)); if (old.meta) rec.meta = old.meta; } catch (e) { /* none yet */ } }
const save = () => { try { fs.writeFileSync(recPath, JSON.stringify(rec, null, 1)); } catch (e) { /* a convenience */ } };
let A = null, pages = 0;
const newPage = async () => {
  if (A) { const old = A; A = null; await Promise.race([old.ctx.close().catch(() => {}), new Promise(ok => setTimeout(ok, 30000))]); }
  pages++;
  A = await openWorld(DIST);
  check(A.ok, `${TAG} (page ${pages}): the world is loaded (${secs()})`);
  const meta = await A.ev(() => { const g = VR.game, s = g.settings, r = g.renderer, q = r.q || {}, L2 = VR.Light2; return { vgen: (g.meta && g.meta.vgen) || 0, type: g.meta && g.meta.type, mode: g.meta && g.meta.mode, preset: s.preset, rd: s.renderDist, dynRes: s.dynRes, lang: VR.I18N && VR.I18N.lang ? VR.I18N.lang : navigator.language, light2: L2 && L2.SW ? L2.SW.filter(k => q[k]).map(k => k + '=' + q[k]).join(',') || 'off' : 'n/a', pbr: q.pbr, ssr: q.ssr, texHi: q.texHi, water: q.water, motion: s.motion, cloudShadow: s.cloudShadow, wxDrama: s.wxDrama, vista: !!VR.Vista, wow: !!g.wow, canvas: [r.gl.drawingBufferWidth, r.gl.drawingBufferHeight] }; });
  console.log(TAG, 'world', JSON.stringify(meta));
  rec.meta = rec.meta || meta;
  const s = await A.settle(150, 20);
  console.log(`  the start settled ${JSON.stringify(s)} (${secs()})`);
};
await newPage();
let pics = 0;
const blank = [], failed = [];
for (const v of SHOOT) {
  const path = `${SHOTS}wow48_${v.name}_${TAG}.png`;
  if (v.missing) { console.log(`  !! ${v.name}: ${v.missing}`); failed.push(v.name); continue; }
  try { fs.unlinkSync(path); } catch (e) { /* none there */ }
  let out = null;
  try {
    // (a view that hangs does not hold the run: BUDGET for the settle, the prep and the picture on top)
    let timer = null;
    out = await Promise.race([shootView(A, v, path), new Promise((_, no) => { timer = setTimeout(() => no(new Error(`no answer in ${BUDGET + 420} s`)), (BUDGET + 420) * 1000); })]);
    clearTimeout(timer);
    const nb = fs.existsSync(path) ? await notBlank(path) : { ok: false };
    out.blank = !nb.ok; out.lum = [nb.mean, nb.sd];
    if (fs.existsSync(path)) { pics++; if (!nb.ok) blank.push(v.name); } else failed.push(v.name);
    const s1 = out.settle[1] || {}, s0 = out.settle[0] || {}, done = s1.near >= 0;
    console.log(`  ${v.name}: settled in ${out.settleS} s (the columns ${s0.s} s, at the pose ${s1.s} s, near after ${s1.near} s${done ? '' : ' — NOT complete'}: ${JSON.stringify({ pend: s1.pend, dirty: s1.dirty, up: s1.up, unshown: s1.unshown, busy: s1.busy, hz: s1.hz, far: s1.far })}) · picture ${out.picS} s (${JSON.stringify(out.st)}, L ${nb.mean} ±${nb.sd}) · ${JSON.stringify(out.pose)}${out.bolt !== undefined ? ' · bolt ' + out.bolt : ''}${out.sunDir ? ' · sun ' + JSON.stringify(out.sunDir) : ''} → ${path.replace(/^.*test\//, 'test/')} (${secs()})`);
  } catch (e) {
    const msg = String(e.message || e).split('\n')[0].slice(0, 240);
    console.log(`  !! ${v.name}: ${msg} (${secs()})`);
    failed.push(v.name); out = Object.assign(out || {}, { name: v.name, error: msg });
    // the page still there? else a new one with a new world
    const alive = await Promise.race([A.ev(() => Math.round(performance.now())).then(() => 'answers', () => 'error'), new Promise(ok => setTimeout(() => ok('silent'), 20000))]);
    if (alive !== 'answers') { console.log(`  !! the page is ${alive}: a new page (${secs()})`); try { await newPage(); } catch (e2) { console.log(`  !! no new page: ${String(e2.message || e2).slice(0, 200)}`); break; } }
  }
  rec.views = rec.views.filter(q => q.name !== out.name).concat([out]); save();
}
check(pics === SHOOT.length - VIEWS.filter(v => v.missing && SHOOT.includes(v)).length && pics > 0 && !failed.length, `${TAG}: every view has its picture (${pics} of ${SHOOT.length}${failed.length ? '; failed: ' + failed.join(', ') : ''})`);
check(blank.length === 0, `${TAG}: no picture is blank (${blank.length}${blank.length ? ': ' + blank.join(', ') : ''})`);
const errs = A ? A.logs.filter(l => l.startsWith('[pageerror]')) : [];
console.log(`--- ${TAG} logs (${A ? A.logs.length : 0})`); if (A) for (const l of A.logs.slice(0, 12)) console.log(l);
check(errs.length === 0, `${TAG}: no page error (${errs.length})`);
rec.failed = failed; rec.blank = blank; save();
if (A) await Promise.race([A.ctx.close().catch(() => {}), new Promise(ok => setTimeout(ok, 30000))]);
await browser.close();
if (process.env.SHEET) sheets();
console.log(`(${secs()})`);
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

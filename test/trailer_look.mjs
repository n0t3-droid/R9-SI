// Trailer look (t-look): the game's picture against the trailer frames, in one browser session. Four shots framed as in
// regress: skip — a calibration showcase (the statistics' bands are the trailer's; the Very Low lawn fails them until the lite terrain's green is decided)
// the trailer, on High and on Very Low, photographed at the game's own camera (vertical fov 72° at 1280 × 720):
//   vista     tod 9800 golden hour · the canyon with the ringed giant to the right of centre (trailer t1_03)
//   citadel   tod 11700 dusk       · the Spire Citadel's fluted cluster in the middle distance (t1_05; t3_02 for the glow)
//   meadow    tod 9800             · the flat Gate Plateau grass at eye level, the horizon near the middle (the lawn kind: t3_08)
//   meadowlow tod 9800             · the same grass from eye level, looking down on the lawn (t1_24: the lawn at a palm terrace's foot)
// The session has three parts:
//   1 before      the baseline build (DIST_BEFORE, the v0.41 picture before this grade): the four shots on High and Very Low
//   2 candidates  six whole grades (CANDS: the VR.Grade knobs in env.js), each shot on the High shots and on the Very Low
//                 shots (vista, meadow, meadowlow); a grade's score is its shots' distance outside the frames' bands; the
//                 best grade is the one of part 3
//   3 after       the chosen grade: the four shots on High and Very Low, asserted: every statistic within the frames' band
//                 of the picture's kind, widened by half the band's width and a small margin per statistic
// Each picture goes to test/shots/trailer_<shot>_<preset>_<before|after|candK<n>>.png. The Very Low frame time on the vista
// (the median of 4 blocks of 3 frames; each block ends with a read of one pixel, which waits for the GPU) is measured
// before and after. Also: no page or WebGL errors. Statistics: test/look_stats.js (luma, contrast, saturation, the white
// share, the sky's cast). usage: nohup bash test/wt_run.sh trailer_look.mjs 5400 > .tmp_tests/trailer_look.log 2>&1 &
// Knobs only (SKIP_BEFORE=1 leaves out part 1; SWEEP=0 leaves out part 2, with the defaults as the after).
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import LS from '/home/claude/vr/test/look_stats.js';
const { load, statsOf, row, frameStats, bandsOf, table, KINDS, COLS, fmt } = LS;

const DIST = process.env.DIST || '/home/claude/vr/dist/index.html';
const DIST_BEFORE = process.env.DIST_BEFORE || '/home/claude/vr/.tmp_tests/dist_before/index.html';
const SKIP_BEFORE = !!process.env.SKIP_BEFORE;
const DO_SWEEP = process.env.SWEEP !== '0';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const logs = [];
let page = null;
// a fresh page for every build: the previous game page is closed first (its unload flushes and its workers)
const newPage = async () => {
  if (page) await page.close().catch(() => {});
  page = await ctx.newPage();
  page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || /error|fail|missing/i.test(s)) logs.push(`[${t}] ${s.slice(0, 700)}`); });
  page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
};
await newPage();
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 16) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(4); } };
const settle = async (max = 60) => { for (let i = 0; i < max; i++) { await step(10); const s = await ev(() => { const g = VR.game; let dirty = 0; for (const c of g.world.cols.values()) for (const sc of c.sec) if (sc.dirty || sc.pending) dirty++; return { busy: g.pool.busy, pend: g.world.pending.size, dirty }; }); if (s.busy === 0 && s.pend === 0 && s.dirty === 0 && i > 2) break; await wait(60); } };
const shotPath = (name) => `/home/claude/vr/test/shots/${name}.png`;
const shot = async (name, frames = 3) => { await ev((frames) => { window.__norender = false; const hn = document.getElementById('hint'); if (hn) hn.style.display = 'none'; const g = VR.game; for (let i = 0; i < frames; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }, frames); await page.screenshot({ path: shotPath(name), timeout: 240000 }); console.log('shot', name); };
const measure = async (name) => { const p = await load(shotPath(name)); return row(statsOf(p.d, p.w, p.h)); };
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };

// a fresh game on a build: the Heartland (seed 4242, as trailer_sky.mjs), clear sky, the loop driven by the test
const boot = async (dist) => {
  await newPage();
  // domcontentloaded, and one retry: the default 'load' wait (30 s) timed out once on the loaded machine
  for (let attempt = 1; ; attempt++) {
    try { await page.goto('file://' + dist, { waitUntil: 'domcontentloaded', timeout: 180000 }); break; }
    catch (e) { if (attempt >= 2) throw e; console.log('goto failed once (' + e.message.split('\n')[0] + '), again'); await newPage(); }
  }
  for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => typeof VR !== 'undefined' && !!VR.game && VR.game.state === 'title')) break; }
  await ev(() => { const g = VR.game; g.applyPreset('high'); g.settings.dynRes = false; g.settings.renderDist = 10; g.applySettings('*'); });
  await ev(`VR.game.createWorld({name:'Trailer Look',mode:'creative',difficulty:'peaceful',type:'default',seed:'4242',cheats:true,kit:true})`);
  for (let i = 0; i < 90; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
  await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.zenFreezeWeather = true; g.env.wx.force('klar'); g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; const h = document.getElementById('hud'); if (h) h.style.display = 'none'; window.__gradeDefault = Object.assign({}, VR.Grade || {}); });
};

// a look direction from a camera position and a target point: yaw 0 looks along −z, as in the game (player.lookDir)
const aim = (from, to) => { const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2]; return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) }; };
const place = (cam, yaw, pitch, tod) => ev(([cam, yaw, pitch, tod]) => { const g = VR.game, p = g.player; g.env.setTime(tod); p.flying = true; p.noclip = true; p.teleport(cam[0], cam[1] - p.eye, cam[2]); p.yaw = yaw; p.pitch = pitch; p.fovKick = 0; p.vel = [0, 0, 0]; }, [cam, yaw, pitch, tod]);
// the ringed giant's direction at a time of day: the game's own formula (env.js), the giant circles the sky at ~33°
const giantDir = (tod) => { const th = tod / 24000 * 2 * Math.PI, pa = th * 0.5 + 0.55; const v = [Math.cos(pa) * 0.84, 0.55, Math.sin(pa) * 0.84]; const l = Math.hypot(...v); return v.map(c => c / l); };
const VISTA_TOD = 9800;
const VISTA = { cam: [-60, 150, 260] };
{ const P = giantDir(VISTA_TOD), a = -0.2, c = Math.cos(a), s = Math.sin(a); const D = [c * P[0] - s * P[2], 0.21, s * P[0] + c * P[2]]; VISTA.look = [VISTA.cam[0] + D[0] * 1000, VISTA.cam[1] + D[1] * 1000, VISTA.cam[2] + D[2] * 1000]; }
const MEADOW_EYE = [-100, 82.6, 80];   // the grass of the plateau (ground at y 81), 1.6 blocks of eye height
const SHOTS = [
  { name: 'vista', cam: VISTA.cam, look: VISTA.look, tod: VISTA_TOD, kind: 'sky' },
  { name: 'citadel', cam: [-372, 204, 440], look: [-420, 206, 380], tod: 11700, kind: 'sky' },
  { name: 'meadow', cam: MEADOW_EYE, look: [-400, 64.6, 80], tod: 9800, kind: 'lawn' },
  { name: 'meadowlow', cam: MEADOW_EYE, look: [-140, 74.5, 80], tod: 9800, kind: 'lawn' },
];
const shootOne = async (s, preset, tag) => {
  const a = aim(s.cam, s.look);
  await place(s.cam, a.yaw, a.pitch, s.tod);
  await settle(40);
  await ev(() => { const e = VR.game.entities; if (e && e.mobs) e.mobs.length = 0; });
  await step(6);
  const name = `trailer_${s.name}_${preset}_${tag}`;
  await shot(name, 3);
  return { name, shot: s.name, preset, kind: s.kind, st: await measure(name) };
};
const shootSet = async (tag, presets) => {
  const out = [];
  for (const preset of presets) {
    console.log('== the four shots on ' + preset + ' (' + tag + ')');
    await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.applySettings('*'); }, preset);
    await settle(30);
    for (const s of SHOTS) out.push(await shootOne(s, preset, tag));
  }
  return out;
};
// the Very Low frame time on the vista: the median of 4 blocks of 3 frames (the loop with the drawing on); each block ends
// with a read of one pixel, which waits until the GPU has drawn the frames
const veryLowTiming = async (tag) => {
  await ev(() => { const g = VR.game; g.applyPreset('potato'); g.settings.dynRes = false; g.applySettings('*'); });
  await place(VISTA.cam, aim(VISTA.cam, VISTA.look).yaw, aim(VISTA.cam, VISTA.look).pitch, VISTA_TOD);
  await settle(40); await step(6);
  const ms = [];
  for (let b = 0; b < 4; b++) ms.push(await ev(() => { const g = VR.game; window.__norender = false; const t0 = performance.now(); for (let i = 0; i < 3; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } const gl = g.renderer.gl; gl.finish(); const px = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); const dt = (performance.now() - t0) / 3; window.__norender = true; return dt; }));
  const sorted = [...ms].sort((a, b) => a - b), median = (sorted[1] + sorted[2]) / 2;
  console.log('potato ' + tag + ' ' + JSON.stringify({ ms: ms.map(v => +v.toFixed(1)), median: +median.toFixed(1) }));
  return { ms, median };
};

// the assertion: the frames' bands, widened by half the band's width and a margin per statistic
const ASSERT_MARGIN = { L: 6, p95: 12, spread: 12, S: 0.03, S90: 0.05, white: 0.01, dark: 0.02, skyS: 0.04, skyRB: 8, gndS: 0.04 };
const ASSERT_KEYS = Object.keys(ASSERT_MARGIN);
// the distance of a picture outside its band's assertion range, per statistic in units of the margin: 0 = every statistic
// inside; a grade's score is the sum over its shots, so the candidates are ranked by what the assertion would count
const outside = (st, band) => ASSERT_KEYS.reduce((acc, c) => {
  const b = band[c], iqr = b.p90 - b.p10, lo = b.p10 - 0.5 * iqr - ASSERT_MARGIN[c], hi = b.p90 + 0.5 * iqr + ASSERT_MARGIN[c], v = st[c];
  return acc + (v < lo ? (lo - v) / ASSERT_MARGIN[c] : v > hi ? (v - hi) / ASSERT_MARGIN[c] : 0);
}, 0);

let chosen = {};
const frames = await frameStats();
const bands = bandsOf(frames);
const results = { before: [], after: [] };
const timing = {};

// ------------------------------------------------------------ 1 before: the baseline build
if (!SKIP_BEFORE && fs.existsSync(DIST_BEFORE)) {
  await boot(DIST_BEFORE);
  results.before = await shootSet('before', ['high', 'potato']);
  timing.before = await veryLowTiming('before');
  console.log('\nbefore (the baseline build)\n' + table(results.before.map(r => [r.name, r.st])));
  console.log('RESULT_BEFORE ' + JSON.stringify(results.before.map(r => ({ name: r.name, st: r.st }))));
}

// ------------------------------------------------------------ 2 candidates: six whole grades, each on the same shots
// Designed from the one-knob sweep of the previous session (the numbers are in the plan): the saturation and the sun's
// warmth set the colour of the lawn, the sunset glow sets the warm cast of the sky, the exposure and the god rays set the
// spread. High: the vista, the citadel, the meadow and the meadowlow; Very Low: the vista, the meadow and the meadowlow.
const B = { expo: 0.7, sat: 1.12, contrast: 0.3, vignette: 0.3, fogDens: 0.00016, nebula: 0.55, sunDisc: 8, bloomThr: 1.15, bloomStr: 0.1, rays: 0.55, sunK: 1, sunWarm: 0.5, sunsetK: 0.3 };
const CANDS = [
  { name: 'K1', o: { ...B } },
  { name: 'K2', o: { ...B, sat: 1.18, sunWarm: 0.3 } },
  { name: 'K3', o: { ...B, sunsetK: 0.6 } },
  { name: 'K4', o: { ...B, sunWarm: 1 } },
  { name: 'K5', o: { ...B, expo: 0.75, rays: 0.3 } },
  { name: 'K6', o: { ...B, sunWarm: 0.2, sunsetK: 0.2, fogDens: 0.00024 } },
];
const CAND_SHOTS = { high: [0, 1, 2, 3], potato: [0, 2, 3] };
await boot(DIST);
if (DO_SWEEP) {
  console.log('\n== the candidate grades (' + CANDS.length + ' grades, ' + (CAND_SHOTS.high.length + CAND_SHOTS.potato.length) + ' shots each)');
  for (const preset of ['high', 'potato']) {
    await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.applySettings('*'); }, preset);
    await settle(30);
    for (const c of CANDS) {
      await ev((o) => { Object.assign(VR.Grade, window.__gradeDefault, o); }, c.o);
      c.shots = c.shots || [];
      for (const i of CAND_SHOTS[preset]) {
        const s = SHOTS[i];
        const r = await shootOne(s, preset, 'cand' + c.name);
        c.shots.push({ shot: s.name, preset, kind: s.kind, st: r.st, score: outside(r.st, bands[s.kind]) });
      }
    }
  }
  for (const c of CANDS) {
    c.score = c.shots.reduce((a, s) => a + s.score, 0);
    console.log('candidate ' + c.name + ' score ' + c.score.toFixed(2) + '  ' + JSON.stringify(c.o));
    for (const s of c.shots) console.log('   ' + (s.shot + ' ' + s.preset).padEnd(18) + 'score ' + s.score.toFixed(2) + '  ' + JSON.stringify(Object.fromEntries(['L', 'S', 'S90', 'spread', 'p95', 'skyS', 'skyRB', 'gndS'].map(k => [k, +s.st[k].toFixed(3)]))));
  }
  const best = CANDS.reduce((a, b) => (b.score < a.score ? b : a));
  chosen = best.o;
  console.log('chosen ' + best.name + ' ' + JSON.stringify(chosen));
  console.log('RESULT_CANDS ' + JSON.stringify(CANDS.map(c => ({ name: c.name, o: c.o, score: +c.score.toFixed(3), shots: c.shots.map(s => ({ n: s.shot + '_' + s.preset, score: +s.score.toFixed(3), st: s.st })) }))));
  await ev(() => { Object.assign(VR.Grade, window.__gradeDefault); });
}

// ------------------------------------------------------------ 3 after: the chosen grade on the four shots, both presets
await ev((o) => { Object.assign(VR.Grade, window.__gradeDefault, o); }, chosen);
results.after = await shootSet('after', ['high', 'potato']);
timing.after = await veryLowTiming('after');
console.log('\nafter (the chosen grade)\n' + table(results.after.map(r => [r.name, r.st])));
console.log('\nbands of the frames (p10 .. p90):');
for (const kind of ['sky', 'lawn']) console.log('  ' + kind.padEnd(8) + COLS.map(c => (c + ' ' + fmt(c, bands[kind][c].p10) + '..' + fmt(c, bands[kind][c].p90))).join('  '));
console.log('RESULT_AFTER ' + JSON.stringify(results.after.map(r => ({ name: r.name, st: r.st }))));
console.log('RESULT_MS ' + JSON.stringify({ before: timing.before ? timing.before.median : null, after: timing.after.median, chosen }));

// the checks: the pictures exist, no page errors, and every statistic of the after pictures inside the frames' band
for (const r of [...results.before, ...results.after]) check(fs.existsSync(shotPath(r.name)) && fs.statSync(shotPath(r.name)).size > 20000, `picture ${r.name} written`);
check(logs.filter(l => l.startsWith('[pageerror]') || l.startsWith('[error]')).length === 0, 'no page or WebGL errors');
check(Number.isFinite(timing.after.median), 'Very Low frame time measured');
for (const r of results.after) {
  const b = bands[r.kind];
  const bad = [];
  for (const c of ASSERT_KEYS) {
    const lo = b[c].p10 - 0.5 * (b[c].p90 - b[c].p10) - ASSERT_MARGIN[c], hi = b[c].p90 + 0.5 * (b[c].p90 - b[c].p10) + ASSERT_MARGIN[c];
    const v = r.st[c];
    if (v < lo || v > hi) bad.push(`${c} ${fmt(c, v)} outside ${fmt(c, lo)}..${fmt(c, hi)}`);
  }
  check(bad.length === 0, `${r.name} within the ${r.kind} band${bad.length ? ': ' + bad.join('; ') : ''}`);
}
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 12)) console.log(l);
await browser.close();
console.log(fails === 0 ? 'ALL OK' : 'FAILED ' + fails);

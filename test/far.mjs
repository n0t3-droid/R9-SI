// F-Far · die echte Ferne (three rings), browser test. A new world (seed 1, noon, zen freeze, 1280x720), the camera
// 120 blocks above the land north of the Pod Hills (0, 200, -560), looking south over the Heartland: Nova Haven, the
// Gate Temple, the Ember Canyon's mesas, the Spire Citadel to the right, the Sky Isles to the left.
//  1. High, on the build before (v042's dist) and after (this checkout's dist): wait for the rings, then
//     test/shots/far_high_before.png and far_high_after.png; numbers per build: ring-1 columns loaded, the time to the
//     first ring-1 frame, video memory per ring (bytes: ring 0 = the chunk arenas, ring 1 = the forms, ring 2 = the far
//     tiles), frame ms (median of the measured frames, each frame waits for the GPU with a one-pixel read)
//  2. the same camera on Very Low, both builds side by side (frames measured in turn, A B A B …): the after build draws
//     no ring 1 at all and its frame ms stays within ±5 % of the build before
//   bash test/wt_run.sh far.mjs 5400      (in the background: nohup … > .tmp_tests/far.log 2>&1 &)
//   MODE=before | after | both (default) · BEFORE_URL / AFTER_URL · SETTLE_HIGH (s) · FRAMES
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const MODE = process.env.MODE || 'both';
// (the path is put together so that wt_run.sh, which points every path of the main checkout at this worktree, leaves it alone)
const BEFORE_URL = process.env.BEFORE_URL || 'file://' + ['', 'home', 'claude', 'vr', '.worktrees', 'v042', 'dist', 'index.html'].join('/');
const AFTER_URL = process.env.AFTER_URL || 'file:///home/claude/vr/dist/index.html';
const SEED = process.env.SEED || '1';
const SETTLE_HIGH = +(process.env.SETTLE_HIGH || 900), SETTLE_LOW = +(process.env.SETTLE_LOW || 420);
const FRAMES = +(process.env.FRAMES || 16), FRAMES_LOW = +(process.env.FRAMES_LOW || 24);
const CAM = { x: 0.5, y: 200, z: -560.5, yaw: Math.PI, pitch: -0.16 };   // yaw π looks along +z (south)
const SHOTS = '/home/claude/vr/test/shots', OUT = '/home/claude/vr/.tmp_tests';
const BUILDS = [];
if (MODE !== 'after') BUILDS.push({ label: 'before', url: BEFORE_URL });
if (MODE !== 'before') BUILDS.push({ label: 'after', url: AFTER_URL });
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info ? '  ' + info : '')); };
const median = (a) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[b.length >> 1] : 0; };
const errsAll = [];

// one page with a new world on a build; the page's own loop is stopped (every frame is one g.loop call)
async function open(build) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
  const page = await ctx.newPage();
  page.on('pageerror', e => errsAll.push('[pageerror] ' + build.label + ': ' + (e.stack || e.message).slice(0, 600)));
  page.on('console', m => { if (m.type() === 'error') errsAll.push('[console] ' + build.label + ': ' + m.text().slice(0, 300)); });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  await page.goto(build.url);
  for (let i = 0; i < 200; i++) { await page.waitForTimeout(500); if (await ev(() => !!(window.VR && VR.game && VR.game.state === 'title'))) break; }
  await ev((seed) => VR.game.createWorld({ name: 'Ferne', mode: 'creative', difficulty: 'peaceful', type: 'default', seed, cheats: true, kit: false }), SEED);
  for (let i = 0; i < 180; i++) { await page.waitForTimeout(1000); if (await ev(() => VR.game.state) === 'play') break; }
  await ev(() => {
    const g = VR.game;
    window.requestAnimationFrame = () => 0;
    g.hideHud = true; for (const id of ['hud', 'ui']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; }   // (the hints and toasts too)
    g.env.setTime(6000); g.zenFreezeTime = true; g.zenFreezeWeather = true;
    if (g.env.wx && g.env.wx.setMode) g.env.wx.setMode('off');
    // one frame, waited for: a one-pixel read makes the GPU (SwiftShader) finish the frame inside the timing
    window.__px = new Uint8Array(4);
    window.__frame = () => { const gg = VR.game, gl = gg.renderer.gl; gg.last = performance.now() - 33; const t = performance.now(); gg.loop(t); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, window.__px); return performance.now() - t; };
    window.__place = (c) => { const p = VR.game.player; p.flying = true; p.teleport(c.x, c.y, c.z); p.yaw = c.yaw; p.pitch = c.pitch; if (p.vel) { p.vel[0] = 0; p.vel[1] = 0; p.vel[2] = 0; } };
    // the rings: ring 0 = the chunk arenas, ring 1 = the forms (horizon.far; absent before), ring 2 = the far tiles
    window.__rings = () => {
      const gg = VR.game, h = gg.horizon, r = gg.renderer, w = gg.world, f = h && h.far;
      let shown = 0; for (const c of w.cols.values()) if (c.shownAt >= 0) shown++;
      const f1 = f && f.report ? f.report() : null;
      return { preset: gg.settings.preset, rd: w.renderDist, cols: w.cols.size, shown, ring0Bytes: Math.round(r.gpuMemoryMB() * 1048576), ring2Bytes: h ? Math.round(h.bytes || 0) : 0, ring2Tiles: h ? h.tiles.size : 0, ring2Drawn: h ? h.stats.drawn : 0, ring1: f1, draws: r.stats.draws, tris: Math.round(r.stats.tris) };
    };
    // between two frames (each takes seconds on the software renderer) the game's streaming runs on its own: the world,
    // the horizon and the worker pool are ticked every 50 ms without drawing — on a real GPU the frames do that 60 times a
    // second. The same for both builds.
    window.__tick = () => { const gg = VR.game, p2 = gg.player, now = performance.now(); gg.world.update(p2.pos[0], p2.pos[1], p2.pos[2], now); if (gg.horizon) gg.horizon.update({ x: p2.pos[0], y: p2.pos[1] + p2.eye, z: p2.pos[2], yaw: p2.yaw, pitch: p2.pitch, fov: gg.settings.fov * Math.PI / 180 }); gg.pool.pump(); };
    window.__quiet = () => { const gg = VR.game, h = gg.horizon, w = gg.world, f = h && h.far, fr = f && f.report ? f.report() : null; return gg.pool.busy === 0 && w.pending.size === 0 && (!h || h.inflight === 0) && !((w.lastWant || 0) + (h ? h.stats.want || 0 : 0)) && !(w.fading && w.fading.size) && !(w.uploadQ && w.uploadQ.size) && (!fr || (fr.inflight === 0 && fr.want === 0)); };
  });
  return { build, ctx, page, ev };
}
async function settle(P, maxS) {
  const t0 = Date.now(); let quiet = 0;
  while (Date.now() - t0 < maxS * 1000) {
    // one drawn frame, then 5 s of streaming ticks (a frame costs seconds on the software renderer; the workers would idle)
    await P.ev(() => { const g = VR.game; g.last = performance.now() - 33; g.loop(performance.now()); });
    for (let k = 0; k < 100; k++) { await P.page.waitForTimeout(50); await P.ev(() => window.__tick()); }
    if (await P.ev(() => window.__quiet())) quiet++; else quiet = 0;
    if (quiet >= 5) break;
  }
  return +((Date.now() - t0) / 1000).toFixed(1);
}
async function preset(P, name) {
  // (the cloud deck is at the camera's height here: off in both builds, so the pictures show the land)
  await P.ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.minimap = false; g.settings.clouds = 0; g.applySettings('*'); g.env.setTime(6000); window.__tPreset = performance.now(); }, name);
  await P.ev((c) => window.__place(c), CAM);
}

const results = {};
// ---- 1. High, one build after the other (a High world is heavy on this machine)
for (const build of BUILDS) {
  const P = await open(build);
  await preset(P, 'high');
  const settleS = await settle(P, SETTLE_HIGH);
  await P.ev((c) => window.__place(c), CAM);
  const ms = [];
  for (let k = 0; k < FRAMES + 1; k++) { const m = await P.ev(() => window.__frame()); if (k) ms.push(m); }
  const st = await P.ev(() => window.__rings());
  const r1 = st.ring1;
  const out = { build: build.label, preset: 'high', settleS, frameMedianMs: +median(ms).toFixed(1), frameMaxMs: +Math.max(...ms).toFixed(1), rd: st.rd, cols: st.cols, shown: st.shown,
    ring0Bytes: st.ring0Bytes, ring1Bytes: r1 ? r1.bytes : 0, ring2Bytes: st.ring2Bytes, ring1Cols: r1 ? r1.cols : 0, ring1Tiles: r1 ? r1.ready : 0, ring1Drawn: r1 ? r1.drawn : 0, ring1Tris: r1 ? r1.tris : 0,
    firstRing1UploadMs: r1 && r1.firstUploadMs >= 0 ? Math.round(r1.firstUploadMs) : null, firstRing1FrameMs: r1 && r1.firstFrameMs >= 0 ? Math.round(r1.firstFrameMs) : null, ring1AllMs: r1 && r1.allMs >= 0 ? Math.round(r1.allMs) : null, ring2Tiles: st.ring2Tiles, ring2Drawn: st.ring2Drawn, draws: st.draws, tris: st.tris };
  console.log('HIGH ' + JSON.stringify(out));
  results['high_' + build.label] = out;
  await P.page.screenshot({ path: `${SHOTS}/far_high_${build.label}.png`, timeout: 900000 });
  console.log('  → test/shots/far_high_' + build.label + '.png');
  if (build.label === 'after') {
    check(out.ring1Cols > 0 && out.ring1Drawn > 0, 'High draws ring 1 (the forms)', out.ring1Cols + ' columns, ' + out.ring1Drawn + ' tiles drawn');
    check(out.firstRing1FrameMs !== null, 'the time to the first ring-1 frame is known', out.firstRing1FrameMs + ' ms');
    check(r1 && r1.radius >= 60, 'ring 1 reaches out to ~1 km (64 chunks)', r1 ? r1.radius + ' chunks' : '');
    const MB = 1048576, cap = 192 * MB, b = results.high_before;
    check(out.ring1Bytes + out.ring2Bytes <= cap, 'video memory: ring 1 + ring 2 within the 5 km horizon\'s cap (192 MB)', ((out.ring1Bytes + out.ring2Bytes) / MB).toFixed(1) + ' MB' + (b ? ' (before: ring 2 ' + (b.ring2Bytes / MB).toFixed(1) + ' MB)' : ''));
  }
  await P.ctx.close();
}

// ---- 2. Very Low: both builds side by side, frames measured in turn (SKIP_LOW=1: the High pictures only)
const lows = [];
if (!process.env.SKIP_LOW) for (const build of BUILDS) { const P = await open(build); await preset(P, 'potato'); lows.push(P); }
for (const P of lows) { const s = await settle(P, SETTLE_LOW); console.log('  ' + P.build.label + ' Very Low settled in ' + s + ' s'); }
const lowMs = lows.map(() => []);
if (lows.length) for (let k = 0; k < FRAMES_LOW + 2; k++) for (let i = 0; i < lows.length; i++) { const m = await lows[i].ev(() => window.__frame()); if (k >= 2) lowMs[i].push(m); }
for (let i = 0; i < lows.length; i++) {
  const st = await lows[i].ev(() => window.__rings());
  const out = { build: lows[i].build.label, preset: 'potato', frameMedianMs: +median(lowMs[i]).toFixed(2), frameMaxMs: +Math.max(...lowMs[i]).toFixed(1), rd: st.rd, cols: st.cols, ring0Bytes: st.ring0Bytes, ring2Bytes: st.ring2Bytes, ring1: st.ring1 };
  console.log('VERYLOW ' + JSON.stringify(out));
  results['potato_' + lows[i].build.label] = out;
  if (lows[i].build.label === 'after') check(!st.ring1 || (st.ring1.tiles === 0 && st.ring1.requested === 0), 'Very Low: no ring 1 at all', JSON.stringify(st.ring1));
  await lows[i].page.screenshot({ path: `${SHOTS}/far_verylow_${lows[i].build.label}.png`, timeout: 900000 });
}
if (results.potato_before && results.potato_after) {
  const a = results.potato_before.frameMedianMs, b = results.potato_after.frameMedianMs, d = b / a - 1;
  check(Math.abs(d) <= 0.05, 'Very Low: frame ms unchanged (±5 %)', `before ${a} ms, after ${b} ms (${(d * 100).toFixed(1)} %)`);
}
for (const P of lows) await P.ctx.close();
try { fs.writeFileSync(`${OUT}/far_${MODE}.json`, JSON.stringify(results, null, 1)); } catch (e) { /* ignore */ }
console.log('--- errors (' + errsAll.length + ')'); for (const e of errsAll.slice(0, 12)) console.log(e);
check(errsAll.filter(e => e.startsWith('[pageerror]')).length === 0, 'no page errors');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
await browser.close();
process.exit(fails ? 1 : 0);

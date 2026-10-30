// regress: skip — e-engine's engine bench (docs/superpowers/plans/2026-10-30-e-engine.md): the same measures on the build
// before (.tmp_tests/before_dist/index.html) and this branch's dist/index.html, served over http (as GitHub Pages does),
// the builds in turns. Everything is measured from outside the game (an init script wraps WebGL, Worker and the frame),
// so both builds are measured alike.
//  1. LOAD — navigation → the first played frame of a new world from the start screen (seed 53, first: true, as the ▶
//     „Neue Welt" makes it), Very Low and Balanced (the preset saved before the page opens), ROUNDS rounds:
//       cold  a new browser and context: no shader cache, no texture cache (a player's first start)
//       warm  the same context loaded again (the textures from IndexedDB, the browser's shader cache warm)
//     phases (ms from the navigation): scripts (DOMContentLoaded), boot (VR.game), workers (the first worker's first
//     message), textures (g.tex), title, world (state 'loading': the spawn known), near (the near sections up), play,
//     frame; and the main thread's time inside WebGL's shader calls (compile, link, the status queries: the waits for
//     the compiler), the programs linked, the long tasks
//  2. FLIGHT — 60 s of game time over the Heartland (seed 53, FRAMES frames of DT s at SPEED blocks/s, 40 blocks over the
//     land, turns), Very Low and Balanced at 960 × 540: every frame g.loop + a one-pixel read; the main thread's work per
//     frame = the loop's JS + the worker messages' handlers since the frame before; p50/p99, hitches (> 2 × median),
//     the heap allocated per frame
//  3. LEAK — Very Low: LOOPS out-and-back flights of OUT blocks (streaming ticks, a frame every 0.5 s of game time), the
//     JS heap (after gc) and the GPU bytes (buffers + textures, counted at the WebGL calls) at the start and after each loop
//  4. VIEWS — two fixed views, settled, time and weather frozen: the pictures of both builds, their mean difference
// usage: nohup bash test/wt_run.sh engine_bench.mjs 10800 > .tmp_tests/engine_bench.log 2>&1 &
//   BUILDS=before,after · PARTS=load,flight,leak,views · ROUNDS=3 · PRESETS=potato,balanced · FRAMES=300 · DT=0.2 ·
//   SPEED=20 · OUT=1000 · LOOPS=3 · TAG (the json's name: test/shots/engine_bench_<TAG>.json)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import sharp from '/home/dev/.npm-global/lib/node_modules/sharp/lib/index.js';
import fs from 'fs';
import http from 'http';
const ROOT = new URL('../', import.meta.url).pathname;
const SHOTS = ROOT + 'test/shots/';
const ENV = process.env;
const BUILDS_ALL = { before: ROOT + '.tmp_tests/before_dist/index.html', after: ROOT + 'dist/index.html' };
const BUILDS = (ENV.BUILDS || 'before,after').split(',').filter(b => BUILDS_ALL[b]);
const PARTS = (ENV.PARTS || 'load,flight,leak,views').split(',');
const ROUNDS = +(ENV.ROUNDS || 3), PRESETS = (ENV.PRESETS || 'potato,balanced').split(',');
const FRAMES = +(ENV.FRAMES || 300), DT = +(ENV.DT || 0.2), SPEED = +(ENV.SPEED || 20), OUT = +(ENV.OUT || 1000), LOOPS = +(ENV.LOOPS || 3);
const TAG = ENV.TAG || BUILDS.join('_');
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
const pct = (a, q) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : NaN; };
const r0 = (x) => (Number.isFinite(x) ? Math.round(x) : null), r1 = (x) => (Number.isFinite(x) ? Math.round(x * 10) / 10 : null);
fs.mkdirSync(SHOTS, { recursive: true });
for (const b of BUILDS) if (!fs.existsSync(BUILDS_ALL[b])) { console.log('missing build ' + b + ': ' + BUILDS_ALL[b]); console.log('FAILED 1'); process.exit(1); }

// ---------------------------------------------------------------- the pages over http (a copy: a build meanwhile must not change them)
const COPY = {};
for (const b of BUILDS) COPY[b] = fs.readFileSync(BUILDS_ALL[b]);
const server = http.createServer((req, res) => {
  const m = /^\/(\w+)\/index\.html/.exec(req.url || '');
  if (m && COPY[m[1]]) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); res.end(COPY[m[1]]); return; }
  res.writeHead(404); res.end();
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;
const urlOf = (b) => `http://127.0.0.1:${PORT}/${b}/index.html`;
const rec = { builds: BUILDS, parts: PARTS, load: {}, flight: {}, leak: {}, views: {} };
const save = () => { try { fs.writeFileSync(SHOTS + `engine_bench_${TAG}.json`, JSON.stringify(rec, null, 1)); } catch (e) { /* a convenience */ } };
const ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--enable-precise-memory-info', '--js-flags=--expose-gc'];
const launch = () => chromium.launch({ channel: 'chromium', args: ARGS });

// ---------------------------------------------------------------- the probe in the page (before the game's scripts)
const PROBE = (opt) => {
  const T = window.__eb = { t: {}, gl: { ms: 0, msLoad: 0, links: 0, compiles: 0, waits: 0 }, gpu: { buf: 0, tex: 0 }, wk: { first: 0, n: 0, hMs: 0, hMsAll: 0, types: {} }, long: [], err: [], frames: 0, loadFrames: 0, loadFrameMs: 0 };
  const now = () => performance.now();
  const mark = (k) => { if (T.t[k] === undefined) T.t[k] = now(); };
  T.mark = mark;
  if (opt && opt.settings) { try { localStorage.setItem('r9si.settings', opt.settings); } catch (e) { T.err.push('settings: ' + e.message); } }
  document.addEventListener('DOMContentLoaded', () => mark('dcl'));
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) T.long.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: true }); } catch (e) { /* no long tasks here */ }
  // WebGL: the time the main thread spends in the shader calls (the queries wait for the compiler), the GPU bytes
  const P = WebGL2RenderingContext.prototype;
  const timed = (name, kind) => { const o = P[name]; if (!o) return; P[name] = function () { const t0 = now(); try { return o.apply(this, arguments); } finally { const d = now() - t0; T.gl.ms += d; if (T.t.play === undefined) T.gl.msLoad += d; else if (T.t.frame === undefined) { T.gl.msFirst = (T.gl.msFirst || 0) + d; if (kind === 'links') T.gl.linksFirst = (T.gl.linksFirst || 0) + 1; } if (kind) T.gl[kind]++; } }; };
  timed('compileShader', 'compiles'); timed('linkProgram', 'links'); timed('getShaderParameter', 'waits'); timed('getProgramParameter', 'waits');
  timed('getUniformBlockIndex'); timed('getActiveUniform'); timed('getUniformLocation'); timed('getShaderInfoLog'); timed('getProgramInfoLog'); timed('getAttribLocation');
  const bound = new Map(), bufB = new WeakMap(), texB = new WeakMap(), texBound = new Map();
  const wrap = (name, fn) => { const o = P[name]; if (!o) return; P[name] = function () { try { fn.apply(this, arguments); } catch (e) { /* counting only */ } return o.apply(this, arguments); }; };
  wrap('bindBuffer', (t, b) => bound.set(t, b));
  wrap('bufferData', (t, d) => { const b = bound.get(t); if (!b) return; const n = typeof d === 'number' ? d : (d && d.byteLength) || 0; T.gpu.buf += n - (bufB.get(b) || 0); bufB.set(b, n); });
  wrap('deleteBuffer', (b) => { if (b && bufB.has(b)) { T.gpu.buf -= bufB.get(b); bufB.delete(b); } });
  wrap('bindTexture', (t, x) => texBound.set(t, x));
  const texAdd = (t, n) => { const x = texBound.get(t); if (!x) return; T.gpu.tex += n; texB.set(x, (texB.get(x) || 0) + n); };
  wrap('texStorage2D', (t, lv, f, w, h) => { let n = 0; for (let i = 0; i < lv; i++) n += Math.max(1, w >> i) * Math.max(1, h >> i) * 4; texAdd(t, n); });
  wrap('texStorage3D', (t, lv, f, w, h, d) => { let n = 0; for (let i = 0; i < lv; i++) n += Math.max(1, w >> i) * Math.max(1, h >> i) * d * 4; texAdd(t, n); });
  wrap('texImage2D', function (t, lv, f, w, h) { if (arguments.length >= 9 && typeof w === 'number') texAdd(t, w * h * 4); });
  wrap('texImage3D', (t, lv, f, w, h, d) => texAdd(t, w * h * d * 4));
  wrap('deleteTexture', (x) => { if (x && texB.has(x)) { T.gpu.tex -= texB.get(x); texB.delete(x); } });
  // the workers: the first message, the handlers' main-thread time, the jobs' worker ms by type
  const W = window.Worker;
  T.wk.hBy = {};
  const timeH = (fn) => function (e) { const t0 = now(); try { return fn.call(this, e); } finally { const d = now() - t0; T.wk.hMs += d; T.wk.hMsAll += d; const ty = (e && e.data && e.data.type) || '?'; const r = T.wk.hBy[ty] || (T.wk.hBy[ty] = [0, 0, 0]); r[0]++; r[1] += d; if (d > r[2]) r[2] = d; } };
  window.Worker = function (url, o) {
    const w = new W(url, o);
    T.wk.n++;
    w.addEventListener('message', (e) => { const d = e.data; if (!T.wk.first) T.wk.first = now(); const ty = d && d.type; if (ty) { const r = T.wk.types[ty] || (T.wk.types[ty] = { n: 0, ms: 0, loadN: 0, loadMs: 0, last: 0 }); r.n++; r.last = now(); if (d.ms > 0) r.ms += d.ms; if (T.t.play === undefined) { r.loadN++; if (d.ms > 0) r.loadMs += d.ms; } } });
    const oAdd = w.addEventListener.bind(w);
    w.addEventListener = (ty, fn, o2) => oAdd(ty, ty === 'message' && typeof fn === 'function' ? timeH(fn) : fn, o2);
    let h = null;
    Object.defineProperty(w, 'onmessage', { get: () => h, set: (fn) => { if (h) w.removeEventListener('message', h.__t); h = fn; if (fn) { fn.__t = timeH(fn); oAdd('message', fn.__t); } } });
    return w;
  };
  window.Worker.prototype = W.prototype;
  // the game's marks
  const iv = setInterval(() => {
    const V = window.VR, g = V && V.game;
    if (!g) return;
    mark('boot');
    if (g.tex) mark('textures');
    if (g.state === 'title') mark('title');
    if (g.state === 'loading') mark('world');
    if (g.nearReadyAt) mark('near');
    if (g.state === 'play') mark('play');
    if (g.renderer && !T.hooked) {
      T.hooked = true;
      const r = g.renderer, orig = r.render;
      r.render = function () {
        const t0 = now();
        const out = orig.apply(this, arguments);
        T.frames++;
        const st = window.VR.game.state;
        if (st === 'loading') { T.loadFrames++; T.loadFrameMs += now() - t0; }
        if (st === 'play' && T.t.frame === undefined) { T.firstRenderMs = now() - t0; mark('frame'); try { T.heap = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null; } catch (e) { T.heap = null; } }
        return out;
      };
    }
    if (opt && opt.create && g.state === 'title' && !T.created) {
      T.created = true; mark('create');
      try { const p = g.createWorld(opt.create); if (p && p.catch) p.catch((e) => T.err.push('create: ' + e.message)); } catch (e) { T.err.push('create: ' + e.message); }
    }
    if (T.t.frame !== undefined && !(opt && opt.keepPolling)) clearInterval(iv);
  }, 10);
};

// ---------------------------------------------------------------- the presets' saved settings (once per build)
const SETTINGS = {};
async function settingsFor(b) {
  if (SETTINGS[b]) return SETTINGS[b];
  const br = await launch(), ctx = await br.newContext({ viewport: { width: 640, height: 360 }, locale: 'de-DE' }), page = await ctx.newPage();
  await page.goto(urlOf(b), { waitUntil: 'commit' });
  for (let i = 0; i < 600; i++) { await page.waitForTimeout(500); if (await page.evaluate(() => !!(window.VR && VR.game && VR.game.state === 'title')).catch(() => false)) break; }
  const out = {};
  for (const p of PRESETS.concat(['potato']).filter((x, i, a) => a.indexOf(x) === i)) out[p] = await page.evaluate((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.autoPreset = false; return JSON.stringify(g.settings); }, p);
  await br.close();
  return (SETTINGS[b] = out);
}

// ---------------------------------------------------------------- 1. LOAD
const LOAD_LIMIT = 420000;
async function loadOnce(ctx, b, preset, kind, seedN) {
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const t0 = Date.now();
  let res = null;
  try {
    await page.goto(urlOf(b), { waitUntil: 'commit', timeout: 120000 });
    for (;;) {
      await page.waitForTimeout(300);
      res = await page.evaluate(() => { const T = window.__eb; if (!T) return null; const g = window.VR && VR.game; return { t: T.t, gl: T.gl, firstRenderMs: T.firstRenderMs, wk: { first: T.wk.first, n: T.wk.n, hMs: T.wk.hMsAll, types: T.wk.types, hBy: T.wk.hBy }, long: T.long, err: T.err, heap: T.heap, loadFrames: T.loadFrames, loadFrameMs: T.loadFrameMs, texMs: g && g.texMs, texFromCache: g && !!g.texFromCache, loadStart: g && g.loadStart, nearAt: g && g.nearReadyAt, workers: g && g.pool && g.pool.workers ? g.pool.workers.length : null, preset: g && g.settings && g.settings.preset, rd: g && g.settings && g.settings.renderDist }; }).catch(() => null);
      if ((res && res.t.frame !== undefined) || Date.now() - t0 > LOAD_LIMIT) break;
    }
  } catch (e) { errs.push('harness: ' + String(e.message || e).slice(0, 200)); }
  await page.close().catch(() => {});
  const t = (res && res.t) || {};
  const L = { b, preset, kind, round: seedN, ...t, glMsLoad: res && r0(res.gl.msLoad), glMsFirst: res && r0(res.gl.msFirst || 0), linksFirst: res && (res.gl.linksFirst || 0), firstRenderMs: res && r0(res.firstRenderMs), hBy: res && Object.fromEntries(Object.entries(res.wk.hBy || {}).map(([k, v]) => [k, [v[0], r0(v[1]), r0(v[2])]])), long: res && res.long, links: res && res.gl.links, compiles: res && res.gl.compiles, wkFirst: res && r0(res.wk.first), workers: res && res.workers, handlersMs: res && r0(res.wk.hMs), texMs: res && res.texMs, texFromCache: res && res.texFromCache, heapMB: res && res.heap, loadFrames: res && res.loadFrames, loadFrameMs: res && r0(res.loadFrameMs),
    longMs: res ? res.long.filter(l => l[0] < (t.frame || 1e9)).reduce((a, l) => a + l[1], 0) : null, longMax: res ? Math.max(0, ...res.long.filter(l => l[0] < (t.frame || 1e9)).map(l => l[1])) : null,
    jobs: res ? Object.fromEntries(Object.entries(res.wk.types).map(([k, v]) => [k, { n: v.loadN, ms: r0(v.loadMs) }])) : null, preset2: res && res.preset, rd: res && res.rd, err: errs.concat((res && res.err) || []) };
  for (const k of ['dcl', 'boot', 'textures', 'title', 'create', 'world', 'near', 'play', 'frame']) if (L[k] !== undefined) L[k] = r0(L[k]);
  const s = (x) => (Number.isFinite(x) ? (x / 1000).toFixed(1) : '–');
  console.log(`  ${b.padEnd(6)} ${preset.padEnd(8)} ${kind} ${seedN}: scripts ${s(L.dcl)} · workers ${s(L.wkFirst)} · textures ${s(L.textures)} (${L.texFromCache ? 'cache' : 'forged'} ${s(L.texMs)}) · title ${s(L.title)} · world ${s(L.world)} · near ${s(L.near)} · play ${s(L.play)} · FRAME ${s(L.frame)} s | gl ${s(L.glMsLoad)} s (${L.links} links; play→frame ${s(L.glMsFirst)} s, ${L.linksFirst} links, render ${s(L.firstRenderMs)} s) · long ${s(L.longMs)} s (max ${L.longMax} ms) · handlers ${s(L.handlersMs)} s · ${L.workers} workers · ${L.preset2}/${L.rd}${L.err.length ? ' · ERR ' + L.err[0].slice(0, 140) : ''} (${secs()})`);
  return L;
}
if (PARTS.includes('load')) {
  for (const b of BUILDS) await settingsFor(b);
  for (let r = 0; r < ROUNDS; r++) for (const preset of PRESETS) {
    const order = r % 2 ? BUILDS.slice().reverse() : BUILDS;
    for (const b of order) {
      const br = await launch();
      const ctx = await br.newContext({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
      await ctx.addInitScript(PROBE, { settings: SETTINGS[b][preset], create: { name: 'Ladezeit', mode: 'creative', difficulty: 'peaceful', type: 'default', seed: '53', cheats: true, kit: true, first: true } });
      const key = b + '_' + preset;
      (rec.load[key] = rec.load[key] || []).push(await loadOnce(ctx, b, preset, 'cold', r + 1));
      rec.load[key].push(await loadOnce(ctx, b, preset, 'warm', r + 1));
      save();
      await br.close();
    }
  }
  console.log('\nLOAD medians (s from the navigation): cold first frame · warm first frame · cold phases');
  rec.loadMed = {};
  for (const key of Object.keys(rec.load)) {
    const L = rec.load[key], m = (kind, k) => med(L.filter(l => l.kind === kind).map(l => l[k]));
    const M = rec.loadMed[key] = {};
    for (const kind of ['cold', 'warm']) for (const k of ['dcl', 'wkFirst', 'textures', 'title', 'world', 'near', 'play', 'frame', 'glMsLoad', 'glMsFirst', 'firstRenderMs', 'longMs', 'handlersMs', 'texMs', 'loadFrameMs', 'loadFrames', 'heapMB']) M[kind + '_' + k] = m(kind, k);
    const s = (x) => (Number.isFinite(x) ? (x / 1000).toFixed(1) : '–');
    console.log(`  ${key.padEnd(16)} cold ${s(M.cold_frame)} · warm ${s(M.warm_frame)} | cold: textures ${s(M.cold_textures)} title ${s(M.cold_title)} world ${s(M.cold_world)} near ${s(M.cold_near)} play ${s(M.cold_play)} gl ${s(M.cold_glMsLoad)} long ${s(M.cold_longMs)} | warm: title ${s(M.warm_title)} world ${s(M.warm_world)} near ${s(M.warm_near)} gl ${s(M.warm_glMsLoad)}`);
    check(L.every(l => Number.isFinite(l.frame) && !l.err.some(e => !/^harness/.test(e))), `${key}: every load reached its first played frame without a page error` + (L.find(l => l.err.length) ? ': ' + L.find(l => l.err.length).err[0].slice(0, 160) : ''));
  }
  save();
}

// ---------------------------------------------------------------- an open world for the flight, the leak and the views
async function openWorld(br, b, preset, w, h) {
  const st = await settingsFor(b);
  const ctx = await br.newContext({ viewport: { width: w, height: h }, locale: 'de-DE' });
  await ctx.addInitScript(PROBE, { settings: st[preset], keepPolling: true, create: { name: 'Flug', mode: 'creative', difficulty: 'peaceful', type: 'default', seed: '53', cheats: true, kit: false } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (fn, arg) => page.evaluate(fn, arg);
  await page.goto(urlOf(b), { waitUntil: 'commit', timeout: 120000 });
  for (let i = 0; i < 900; i++) { await page.waitForTimeout(500); if (await ev(() => !!(window.VR && VR.game && VR.game.state === 'play')).catch(() => false)) break; }
  await ev(() => {
    const g = VR.game;
    window.requestAnimationFrame = () => 0;
    g.hideHud = true; for (const id of ['hud', 'ui']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; }
    g.env.setTime(6000); g.zenFreezeTime = true; g.zenFreezeWeather = true;
    if (g.env.wx && g.env.wx.setMode) g.env.wx.setMode('off');
    const pl = g.player; pl.flying = true; pl.noclip = true;
    window.__px = new Uint8Array(4);
    window.__place = (x, y, z, yaw, pitch) => { const q = VR.game.player; q.teleport(x, y, z); q.yaw = yaw; q.pitch = pitch; q.viewYaw = yaw; q.fovKick = 0; if (q.vel) { q.vel[0] = 0; q.vel[1] = 0; q.vel[2] = 0; } };
    const mem = () => (performance.memory ? performance.memory.usedJSHeapSize : 0);
    window.__frame = (dtS) => {
      const gg = VR.game, gl = gg.renderer.gl, T = window.__eb;
      const h0 = T.wk.hMs; T.wk.hMs = 0;
      gg.last = performance.now() - dtS * 1000;
      const m0 = mem(), t0 = performance.now(); gg.loop(t0); const t1 = performance.now(), m1 = mem();
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, window.__px);
      const t2 = performance.now();
      return { ms: t2 - t0, js: t1 - t0, hand: h0, allocKB: m1 >= m0 ? (m1 - m0) / 1024 : -1 };
    };
    window.__tick = () => { const gg = VR.game, p2 = gg.player, now = performance.now(); gg.world.update(p2.pos[0], p2.pos[1], p2.pos[2], now); if (gg.horizon) gg.horizon.update({ x: p2.pos[0], y: p2.pos[1] + p2.eye, z: p2.pos[2], yaw: p2.yaw, pitch: p2.pitch, fov: 1.3, far: gg.farFor ? gg.farFor(gg.world) : 512 }); };
    window.__quiet = () => { const gg = VR.game, h = gg.horizon, w = gg.world; return gg.pool.busy === 0 && w.pending.size === 0 && (!h || !h.inflight) && (!w.uploadQ || !w.uploadQ.size); };
    window.__mem = () => { if (window.gc) { window.gc(); window.gc(); } const T = window.__eb, w = VR.game.world; let secs = 0; for (const c of w.cols.values()) for (const s of c.sec) if (s.hasMesh) secs++; return { heapMB: +(mem() / 1048576).toFixed(1), bufMB: +(T.gpu.buf / 1048576).toFixed(1), texMB: +(T.gpu.tex / 1048576).toFixed(1), cols: w.cols.size, secs }; };
  });
  return { b, preset, ctx, page, ev, errs };
}
async function settle(P, maxS) {
  const t0 = Date.now(); let quiet = 0;
  while (Date.now() - t0 < maxS * 1000) {
    await P.ev(() => window.__frame(0.05));
    for (let k = 0; k < 30; k++) { await P.page.waitForTimeout(50); await P.ev(() => window.__tick()); }
    if (await P.ev(() => window.__quiet())) quiet++; else quiet = 0;
    if (quiet >= 3) break;
  }
  return +((Date.now() - t0) / 1000).toFixed(0);
}
// the path: from the spawn north, a right turn, west, a left turn, north again; 40 blocks over the land
const pathFor = (P, n, dt, v) => P.ev(([N, dt, v]) => {
  const g = VR.game, w = g.world, p = g.player, gen = VR.makeGen ? VR.makeGen('overworld', w.seed, w.genOpts) : null;
  const ground = (x, z) => { if (!gen || !gen.surfaceY) return 70; let h = 0; for (const [ox, oz] of [[0, 0], [24, 0], [-24, 0], [0, 24], [0, -24]]) h = Math.max(h, gen.surfaceY(Math.floor(x + ox), Math.floor(z + oz))); return h; };
  let x = p.pos[0], z = p.pos[2], y = ground(x, z) + 40;
  const out = [];
  for (let i = 0; i < N; i++) {
    const t = i * dt, T = N * dt;
    const yaw = t < T * 0.33 ? 0 : t < T * 0.36 ? -Math.PI / 2 * (t - T * 0.33) / (T * 0.03) : t < T * 0.66 ? -Math.PI / 2 : t < T * 0.69 ? -Math.PI / 2 + Math.PI / 2 * (t - T * 0.66) / (T * 0.03) : 0;
    x += -Math.sin(yaw) * v * dt; z += -Math.cos(yaw) * v * dt;
    const yy = ground(x, z) + 40; y += (yy - y) * 0.15;
    out.push([+x.toFixed(2), +y.toFixed(2), +z.toFixed(2), +yaw.toFixed(4), -0.3]);
  }
  return out;
}, [n, dt, v]);

// ---------------------------------------------------------------- 2. FLIGHT
if (PARTS.includes('flight')) {
  for (const preset of PRESETS) {
    const order = preset === PRESETS[0] ? BUILDS : BUILDS.slice().reverse();
    for (const b of order) {
      const br = await launch();
      const P = await openWorld(br, b, preset, 960, 540);
      const path = await pathFor(P, FRAMES, DT, SPEED);
      await P.ev((c) => window.__place(...c), path[0]);
      const settleS = await settle(P, 600);
      const fr = [];
      for (let i = 0; i < path.length; i++) { await P.ev((c) => window.__place(...c), path[i]); fr.push(await P.ev((dt) => window.__frame(dt), DT)); }
      const main = fr.map(f => f.js + f.hand), tot = fr.map(f => f.ms + f.hand), js = fr.map(f => f.js);
      const mM = med(main), mT = med(tot);
      const alloc = fr.map(f => f.allocKB).filter(x => x >= 0);
      const o = { b, preset, settleS, frames: fr.length, mainMed: r1(mM), mainP99: r1(pct(main, 0.99)), mainMax: r1(Math.max(...main)), mainHitches: main.filter(x => x > 2 * mM).length,
        jsMed: r1(med(js)), jsP99: r1(pct(js, 0.99)), handMed: r1(med(fr.map(f => f.hand))), handP99: r1(pct(fr.map(f => f.hand), 0.99)),
        totMed: r0(mT), totP99: r0(pct(tot, 0.99)), totHitches: tot.filter(x => x > 2 * mT).length, allocKBMed: r0(med(alloc)), allocKBP95: r0(pct(alloc, 0.95)), gcFrames: fr.filter(f => f.allocKB < 0).length, mem: await P.ev(() => window.__mem()), errs: P.errs.length };
      rec.flight[b + '_' + preset] = { o, fr: fr.map(f => [r1(f.ms), r1(f.js), r1(f.hand), r0(f.allocKB)]) };
      console.log('FLIGHT ' + JSON.stringify(o) + ` (${secs()})`);
      save();
      await br.close();
    }
  }
}

// ---------------------------------------------------------------- 3. LEAK (Very Low)
if (PARTS.includes('leak')) {
  for (const b of BUILDS) {
    const br = await launch();
    const P = await openWorld(br, b, 'potato', 960, 540);
    const start = await P.ev(() => { const p = VR.game.player; return [p.pos[0], p.pos[1] + 30, p.pos[2]]; });
    await P.ev((c) => window.__place(c[0], c[1], c[2], 0, -0.3), start);
    await settle(P, 600);
    const pts = [await P.ev(() => window.__mem())];
    console.log(`  LEAK ${b} start ${JSON.stringify(pts[0])} (${secs()})`);
    const dt = 0.5, n = Math.round(OUT / SPEED / dt);
    for (let L = 0; L < LOOPS; L++) {
      for (const dir of [1, -1]) for (let i = 1; i <= n; i++) {
        const k = dir > 0 ? i : n - i;
        await P.ev(([x, y, z, yaw]) => window.__place(x, y, z, yaw, -0.3), [start[0], start[1], start[2] - k * SPEED * dt, dir > 0 ? 0 : Math.PI]);
        await P.ev((d) => window.__frame(d), dt);
        await P.ev(() => window.__tick());
      }
      await P.ev((c) => window.__place(c[0], c[1], c[2], 0, -0.3), start);
      await settle(P, 600);
      pts.push(await P.ev(() => window.__mem()));
      console.log(`  LEAK ${b} after loop ${L + 1}: ${JSON.stringify(pts[pts.length - 1])} (${secs()})`);
    }
    rec.leak[b] = { pts, gameS: LOOPS * 2 * n * dt, errs: P.errs.length };
    const a = pts[1], z = pts[pts.length - 1];
    check(z.heapMB - a.heapMB < Math.max(8, a.heapMB * 0.08) && z.bufMB - a.bufMB < Math.max(4, a.bufMB * 0.08) && z.texMB - a.texMB < 4, `${b}: no growth from loop 1 to loop ${LOOPS} (heap ${a.heapMB} → ${z.heapMB} MB, buffers ${a.bufMB} → ${z.bufMB} MB, textures ${a.texMB} → ${z.texMB} MB; start ${pts[0].heapMB} / ${pts[0].bufMB} / ${pts[0].texMB})`);
    save();
    await br.close();
  }
}

// ---------------------------------------------------------------- 4. VIEWS (two fixed views, both builds)
if (PARTS.includes('views')) {
  const shots = {};
  for (const b of BUILDS) {
    const br = await launch();
    const P = await openWorld(br, b, 'potato', 1280, 720);
    const sp = await P.ev(() => { const p = VR.game.player; return [p.pos[0], p.pos[1], p.pos[2]]; });
    const views = [[sp[0], sp[1] + 6, sp[2], 0.6, -0.15], [sp[0] + 40, sp[1] + 35, sp[2] + 60, 2.4, -0.35]];
    shots[b] = [];
    for (let v = 0; v < views.length; v++) {
      await P.ev((c) => window.__place(...c), views[v]);
      await settle(P, 600);
      for (let i = 0; i < 4; i++) await P.ev(() => window.__frame(0.0));
      const f = `${SHOTS}engine_view${v + 1}_${b}.png`;
      await P.page.screenshot({ path: f, timeout: 600000 });
      shots[b].push(f);
    }
    await br.close();
  }
  if (shots.before && shots.after) for (let v = 0; v < shots.before.length; v++) {
    const img = async (f) => sharp(f).resize(320, 180, { fit: 'fill' }).removeAlpha().raw().toBuffer();
    const ia = await img(shots.after[v]), ib = await img(shots.before[v]);
    let d = 0; for (let i = 0; i < ia.length; i++) d += Math.abs(ia[i] - ib[i]);
    const mad = d / ia.length;
    rec.views['view' + (v + 1)] = r1(mad * 100) / 100;
    check(mad < 3, `view ${v + 1}: the pictures alike before | after (mean difference ${mad.toFixed(2)} of 255)`);
  }
  save();
}
server.close();
console.log(`\n(${secs()})`);
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

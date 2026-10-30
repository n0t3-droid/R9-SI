// e-perf2 · the hitch gate (docs/superpowers/plans/2026-10-30-e-perf2.md): this build against the last release, the same
// scripted flight flown by both IN TURNS, FRAME BY FRAME — both pages open in one browser, frame i drawn on one build and
// then on the other (the order alternating), so the machine's load (other agents, a shared 2-CPU box) falls on both alike.
//   per preset (Very Low, Balanced) and round: a new world (seed 53, „Neue Welt"), both settled at the spawn, then the
//   flight (60 s of game time over the Heartland: north, a right turn, west, a left turn, north; 40 blocks over the land,
//   20 blocks/s); a frame = g.loop + a one-pixel read; measured = the main thread's work a frame (the loop's JS + the
//   worker answers' handlers since the frame before), as test/engine_bench.mjs measures it.
//   per frame also the systems that took the time: the game's larger methods (one called > 30 times between two frames
//   loses its timer at once — so the timers cost nothing measurable) timed inclusive, the handlers by message type, a heap drop (a GC) — both builds alike.
// The checks (the release lane): the median ≤ the release's × (1 + TOL); hitches (frames over 2 × the release's median)
// and p99 not worse than the release's × (1 − DOWN) (DOWN 0: not worse; e-perf2's acceptance ran DOWN=0.2); no page
// errors; the end pictures alike (the same view after the flight). JSON: test/shots/hitch_gate_<TAG>.json (every frame).
//   nohup bash test/wt_run.sh hitch_gate.mjs 10800 > .tmp_tests/hitch_gate.log 2>&1 &
//   BASE (a tag; default the last tag before HEAD's own) · HEAD (dist = this checkout's dist/, or a tag) · ROUNDS (1)
//   PRESETS (potato,balanced) · FRAMES_potato 300 DT_potato 0.2 · FRAMES_balanced 150 DT_balanced 0.4 · TOL (0.05)
//   DOWN (0) · TAG · W×H 640×360. A tag's build: git archive into .tmp_tests/tag_<tag>/, built there once.
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import sharp from '/home/dev/.npm-global/lib/node_modules/sharp/lib/index.js';
import fs from 'fs';
import http from 'http';
import { execSync } from 'child_process';
const ROOT = new URL('../', import.meta.url).pathname;
const SHOTS = ROOT + 'test/shots/';
const ENV = process.env;
const sh = (c) => execSync(c, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const lastTag = () => { const own = sh('git tag --points-at HEAD').split('\n').filter(Boolean); const t = sh('git describe --tags --abbrev=0 ' + (own.length ? 'HEAD^' : 'HEAD')); return t; };
const BASE = ENV.BASE || lastTag(), HEADB = ENV.HEAD || 'dist';
const ROUNDS = +(ENV.ROUNDS || 1), PRESETS = (ENV.PRESETS || 'potato,balanced').split(',');
const TOL = +(ENV.TOL || 0.05), DOWN = +(ENV.DOWN || 0), W = +(ENV.W || 640), H = +(ENV.H || 360), SPEED = 20;
const FR = { potato: [300, 0.2], balanced: [150, 0.4] };
const TAG = ENV.TAG || (BASE + '_' + HEADB).replace(/[^\w.]/g, '_');
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
const pct = (a, q) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : NaN; };
const r1 = (x) => (Number.isFinite(x) ? Math.round(x * 10) / 10 : null);
fs.mkdirSync(SHOTS, { recursive: true });

// ---------------------------------------------------------------- the two builds (a tag: built once from git archive)
function buildOf(ref) {
  if (ref === 'dist') { const f = ROOT + 'dist/index.html'; if (!fs.existsSync(f)) sh('node build.js'); return f; }
  const dir = ROOT + '.tmp_tests/tag_' + ref + '/', f = dir + 'dist/index.html';
  if (!fs.existsSync(f)) { fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true }); sh(`git archive ${ref} | tar -x -C "${dir}"`); execSync('node build.js', { cwd: dir, stdio: 'ignore' }); }
  return f;
}
const BUILDS = [{ id: 'base', ref: BASE }, { id: 'head', ref: HEADB }];
const COPY = {};
for (const b of BUILDS) COPY[b.id] = fs.readFileSync(buildOf(b.ref));   // (a copy: a build meanwhile must not change them)
console.log(`hitch gate: ${BASE} (base) against ${HEADB} (head) · ${ROUNDS} round(s) · ${PRESETS.join(', ')} · ${W}×${H}`);
const server = http.createServer((req, res) => {
  const m = /^\/(\w+)\/index\.html/.exec(req.url || '');
  if (m && COPY[m[1]]) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); res.end(COPY[m[1]]); return; }
  res.writeHead(404); res.end();
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const urlOf = (id) => `http://127.0.0.1:${server.address().port}/${id}/index.html`;
const ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--enable-precise-memory-info'];

// ---------------------------------------------------------------- in the page before the game: the preset, the world, the handlers' time
const PROBE = (opt) => {
  const T = window.__hg = { hMs: 0, hBy: {}, err: [], genN: 0 };
  try { localStorage.setItem('r9si.settings', opt.settings); } catch (e) { T.err.push(e.message); }
  const W0 = window.Worker, now = () => performance.now();
  const timeH = (fn) => function (e) { const t0 = now(); try { return fn.call(this, e); } finally { const d = now() - t0; T.hMs += d; const ty = (e && e.data && e.data.type) || '?'; T.hBy[ty] = (T.hBy[ty] || 0) + d; if (ty === 'gen') T.genN++; } };
  window.Worker = function (url, o) {
    const w = new W0(url, o), oAdd = w.addEventListener.bind(w);
    w.addEventListener = (ty, fn, o2) => oAdd(ty, ty === 'message' && typeof fn === 'function' ? timeH(fn) : fn, o2);
    let h = null;
    Object.defineProperty(w, 'onmessage', { get: () => h, set: (fn) => { if (h) w.removeEventListener('message', h.__t); h = fn; if (fn) { fn.__t = timeH(fn); oAdd('message', fn.__t); } } });
    return w;
  };
  window.Worker.prototype = W0.prototype;
  const iv = setInterval(() => {
    const g = window.VR && window.VR.game;
    if (g && g.state === 'title' && !T.created) { T.created = true; try { const p = g.createWorld(opt.create); if (p && p.catch) p.catch((e) => T.err.push(e.message)); } catch (e) { T.err.push(e.message); } }
    if (g && g.state === 'play') clearInterval(iv);
  }, 20);
};
async function settingsFor(br, id) {
  const ctx = await br.newContext({ viewport: { width: 640, height: 360 }, locale: 'de-DE' }), page = await ctx.newPage();
  await page.goto(urlOf(id), { waitUntil: 'commit' });
  for (let i = 0; i < 600; i++) { await page.waitForTimeout(500); if (await page.evaluate(() => !!(window.VR && VR.game && VR.game.state === 'title')).catch(() => false)) break; }
  const out = {};
  for (const p of PRESETS) out[p] = await page.evaluate((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.autoPreset = false; return JSON.stringify(g.settings); }, p);
  await ctx.close();
  return out;
}
async function open(br, b, st) {
  const ctx = await br.newContext({ viewport: { width: W, height: H }, locale: 'de-DE' });
  await ctx.addInitScript(PROBE, { settings: st, create: { name: 'Takt', mode: 'creative', difficulty: 'peaceful', type: 'default', seed: '53', cheats: true, kit: false } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  await page.goto(urlOf(b.id), { waitUntil: 'commit', timeout: 120000 });
  return { b, ctx, page, errs, ev: (fn, arg) => page.evaluate(fn, arg) };
}
const SETUP = () => {
  const g = VR.game, T = window.__hg;
  window.requestAnimationFrame = () => 0;
  g.hideHud = true; for (const id of ['hud', 'ui']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; }
  g.env.setTime(6000); g.zenFreezeTime = true; g.zenFreezeWeather = true;
  if (g.env.wx && g.env.wx.setMode) g.env.wx.setMode('off');
  const pl = g.player; pl.flying = true; pl.noclip = true;
  window.__px = new Uint8Array(4);
  window.__place = (x, y, z, yaw, pitch) => { const q = VR.game.player; q.teleport(x, y, z); q.yaw = yaw; q.pitch = pitch; q.viewYaw = yaw; q.fovKick = 0; if (q.vel) { q.vel[0] = 0; q.vel[1] = 0; q.vel[2] = 0; } };
  // the systems' timers: every prototype method of the game's objects longer than 300 characters (inclusive ms, calls)
  const acc = T.acc = new Map(), calls = T.calls = new Map(), orig = T.orig = [];
  const seen = new Set();
  const wrapObj = (o, label) => {
    let proto = Object.getPrototypeOf(o);
    while (proto && proto !== Object.prototype && !seen.has(proto)) {
      seen.add(proto);
      const P0 = proto;   // (this prototype, for its methods' closures: proto itself walks on — a timer must come off where it was put)
      for (const k of Object.getOwnPropertyNames(proto)) {
        if (k === 'constructor') continue;
        const d = Object.getOwnPropertyDescriptor(proto, k);
        if (!d || typeof d.value !== 'function' || d.value.__w) continue;
        const f = d.value; let src = ''; try { src = Function.prototype.toString.call(f); } catch (e) { continue; }
        if (src.length < 300 || /^class\b/.test(src)) continue;
        const name = label + '.' + k;
        // (a method called more than 30 times between two frames loses its timer at once — _spread, _touch …: a timer there
        // would cost more than it tells, and it would cost the build that streams more)
        const w = function () { const n = (calls.get(name) || 0) + 1; calls.set(name, n); if (n > 30 && P0[k] === w) P0[k] = f; const t0 = performance.now(); try { return f.apply(this, arguments); } finally { acc.set(name, (acc.get(name) || 0) + performance.now() - t0); } };
        w.__w = true; P0[k] = w; orig.push([P0, k, f, name]);
      }
      proto = Object.getPrototypeOf(proto);
    }
  };
  wrapObj(g, 'game');
  for (const k of Object.keys(g)) { const o = g[k]; if (o && typeof o === 'object' && !Array.isArray(o) && !(o instanceof Node) && !ArrayBuffer.isView(o) && Object.getPrototypeOf(o) !== Object.prototype) { try { wrapObj(o, k); } catch (e) { /* skip */ } } }
  if (g.horizon && g.horizon.far) wrapObj(g.horizon.far, 'far');
  if (g.world && g.world.uploadQ) wrapObj(g.world.uploadQ, 'uploadQ');
  window.__kept = () => T.orig.filter(([proto, k, f]) => proto[k] !== f).length;
  const mem = () => (performance.memory ? performance.memory.usedJSHeapSize : 0);
  window.__frame = (dtS, rec) => {
    const gg = VR.game, gl = gg.renderer.gl;
    const hand = T.hMs, hBy = T.hBy, genN = T.genN; T.hMs = 0; T.hBy = {}; T.genN = 0;
    gg.last = performance.now() - dtS * 1000;
    const m0 = mem(), t0 = performance.now(); gg.loop(t0); const t1 = performance.now(), m1 = mem();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, window.__px);
    const t2 = performance.now();
    T.calls.clear();
    if (!rec) { T.acc.clear(); return null; }
    const top = [...T.acc.entries()].filter(e => e[1] >= 1 && !/\.(loop|frame|playFrame)$/.test(e[0])).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => [k, Math.round(v * 10) / 10]);
    const hTop = Object.entries(hBy).filter(e => e[1] >= 1).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, v]) => ['h:' + k, Math.round(v * 10) / 10]);
    T.acc.clear();
    return [t1 - t0 + hand, t1 - t0, hand, t2 - t0, m1 >= m0 ? Math.round((m1 - m0) / 1024) : -1, top.concat(hTop), genN];
  };
  window.__tick = () => { const gg = VR.game, p2 = gg.player, now = performance.now(); gg.world.update(p2.pos[0], p2.pos[1], p2.pos[2], now); if (gg.horizon) gg.horizon.update({ x: p2.pos[0], y: p2.pos[1] + p2.eye, z: p2.pos[2], yaw: p2.yaw, pitch: p2.pitch, fov: 1.3, far: gg.farFor ? gg.farFor(gg.world) : 512 }); };
  window.__quiet = () => { const gg = VR.game, h = gg.horizon, w = gg.world; return gg.pool.busy === 0 && w.pending.size === 0 && (!h || !h.inflight) && (!w.uploadQ || !w.uploadQ.size); };
};
async function settle(P, maxS) {
  const t0 = Date.now(); let quiet = 0;
  while (Date.now() - t0 < maxS * 1000) {
    await P.ev(() => window.__frame(0.05, false));
    for (let k = 0; k < 30; k++) { await P.page.waitForTimeout(50); await P.ev(() => window.__tick()); }
    if (await P.ev(() => window.__quiet())) quiet++; else quiet = 0;
    if (quiet >= 3) break;
  }
  return Math.round((Date.now() - t0) / 1000);
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

// ---------------------------------------------------------------- the flights
const rec = { base: BASE, head: HEADB, rounds: ROUNDS, w: W, h: H, runs: [] };
const save = () => { try { fs.writeFileSync(SHOTS + `hitch_gate_${TAG}.json`, JSON.stringify(rec)); } catch (e) { /* a convenience */ } };
const errsAll = [];
const br0 = await chromium.launch({ channel: 'chromium', args: ARGS });
const ST = {}; for (const b of BUILDS) ST[b.id] = await settingsFor(br0, b.id);
await br0.close();
for (let round = 0; round < ROUNDS; round++) for (const preset of PRESETS) {
  const [N, DT] = FR[preset] || [300, 0.2];
  const br = await chromium.launch({ channel: 'chromium', args: ARGS });
  const Ps = [];
  for (const b of BUILDS) Ps.push(await open(br, b, ST[b.id][preset]));
  for (const P of Ps) { for (let i = 0; i < 1200; i++) { await P.page.waitForTimeout(500); if (await P.ev(() => !!(window.VR && VR.game && VR.game.state === 'play')).catch(() => false)) break; } await P.ev(SETUP); }
  const path = await pathFor(Ps[0], +(ENV['FRAMES_' + preset] || N), +(ENV['DT_' + preset] || DT), SPEED);
  const dt = +(ENV['DT_' + preset] || DT);
  const settleS = [];
  for (const P of Ps) { await P.ev((c) => window.__place(...c), path[0]); settleS.push(await settle(P, 600)); }
  const kept = [];
  for (const P of Ps) { for (let i = 0; i < 4; i++) await P.ev(() => window.__frame(0.05, false)); }
  // the first round: the sampled allocations of both (by function, self) — where the garbage of a frame comes from
  const cdps = [];
  if (round === 0) for (const P of Ps) { const c = await P.ctx.newCDPSession(P.page); await c.send('HeapProfiler.enable'); await c.send('HeapProfiler.startSampling', { samplingInterval: 32768, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true }); cdps.push(c); }
  const fr = Ps.map(() => []);
  for (let i = 0; i < path.length; i++) {
    const order = (i + round) % 2 ? [1, 0] : [0, 1];
    for (const j of order) { await Ps[j].ev((c) => window.__place(...c), path[i]); fr[j].push(await Ps[j].ev((d) => window.__frame(d, true), dt)); }
    if (i % 50 === 49) console.log(`    ${preset} round ${round + 1}: frame ${i + 1}/${path.length} (${secs()})`);
  }
  for (const P of Ps) kept.push(await P.ev(() => window.__kept()));
  const allocs = [];
  for (const c of cdps) {
    const { profile } = await c.send('HeapProfiler.stopSampling');
    const al = new Map();
    const walk = (n) => { const cf = n.callFrame, k = `${cf.functionName || '(anon)'}:${cf.lineNumber + 1}`; al.set(k, (al.get(k) || 0) + n.selfSize); for (const ch of n.children || []) walk(ch); };
    walk(profile.head);
    const tot = [...al.values()].reduce((a, b) => a + b, 0);
    allocs.push({ MB: +(tot / 1048576).toFixed(1), top: [...al.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => [k, +(v / 1048576).toFixed(1)]) });
  }
  // how far each kept up: the columns round the player shown when the flight ends (a build that streams more works more)
  const shown = [];
  for (const P of Ps) shown.push(await P.ev(() => { const w = VR.game.world, p = VR.game.player, cx = Math.floor(p.pos[0]) >> 4, cz = Math.floor(p.pos[2]) >> 4, rd = w.renderDist; let n = 0; for (const c of w.cols.values()) { const dx = c.cx - cx, dz = c.cz - cz; if (dx * dx + dz * dz <= (rd + 0.5) * (rd + 0.5) && c.shownAt >= 0) n++; } return n; }));
  // the end: both back at the start, low over the land (the flight's end is fog over half-loaded land), settled, the same
  // view photographed (the pictures alike)
  const shots = [];
  if (round === 0) {
    const [x0, , z0] = path[0];
    const view = await Ps[0].ev(([x, z]) => { const g = VR.game, gen = VR.makeGen ? VR.makeGen('overworld', g.world.seed, g.world.genOpts) : null; const y = gen && gen.surfaceY ? gen.surfaceY(Math.floor(x), Math.floor(z)) : 70; return [x, y + 14, z, 0.6, -0.22]; }, [x0, z0]);
    // (the clock again: something on the way may have let it go — run 1's Balanced views were dawn | noon)
    for (const P of Ps) { await P.ev((c) => { const g = VR.game; g.env.setTime(6000); g.zenFreezeTime = true; g.zenFreezeWeather = true; if (g.env.wx && g.env.wx.setMode) g.env.wx.setMode('off'); window.__place(...c); }, view); await settle(P, 420); }
    const clocks = []; for (const P of Ps) clocks.push(await P.ev(() => { const g = VR.game; g.env.setTime(6000); return [Math.round(g.env.ticks || 0), !!g.zenFreezeTime]; }));
    console.log('  the views\' clocks: ' + JSON.stringify(clocks));
    for (const P of Ps) {
      await P.ev((c) => window.__place(...c), view);
      for (let i = 0; i < 4; i++) await P.ev(() => window.__frame(0.0, false));
      const f = `${SHOTS}hitch_gate_${preset}_${P.b.id}.png`; await P.page.screenshot({ path: f, timeout: 900000 }); shots.push(f);
    }
  }
  const bMed = med(fr[0].map(f => f[0]));
  const run = { round, preset, settleS, kept, shots, allocs, builds: {} };
  for (let j = 0; j < 2; j++) {
    const main = fr[j].map(f => f[0]), m = med(main);
    run.builds[Ps[j].b.id] = { med: r1(m), p99: r1(pct(main, 0.99)), p95: r1(pct(main, 0.95)), max: r1(Math.max(...main)), hitches: main.filter(x => x > 2 * bMed).length, hitchesOwn: main.filter(x => x > 2 * m).length,
      jsMed: r1(med(fr[j].map(f => f[1]))), handMed: r1(med(fr[j].map(f => f[2]))), gcFrames: fr[j].filter(f => f[4] < 0).length, errs: Ps[j].errs.length, cols: fr[j].reduce((a, f) => a + f[6], 0), shown: shown[j], fr: fr[j].map(f => [r1(f[0]), r1(f[1]), r1(f[2]), r1(f[3]), f[4], f[5], f[6]]) };
    errsAll.push(...Ps[j].errs.map(e => Ps[j].b.id + ': ' + e));
  }
  rec.runs.push(run); save();
  const s = (id) => { const o = run.builds[id]; return `median ${o.med} · p95 ${o.p95} · p99 ${o.p99} · max ${o.max} · hitches ${o.hitches} (own ${o.hitchesOwn}) · gc ${o.gcFrames} · columns arrived ${o.cols}, shown at the end ${o.shown}`; };
  console.log(`RUN ${preset} round ${round + 1} (settled ${settleS.join('/')} s, timers ${kept.join('/')}):\n  base ${s('base')}\n  head ${s('head')}  (${secs()})`);
  for (let j = 0; j < allocs.length; j++) console.log(`  allocated ${BUILDS[j].id}: ${allocs[j].MB} MB in the flight — ` + allocs[j].top.slice(0, 10).map(x => x[0] + ' ' + x[1]).join(' · '));
  // the worst frames of each, with what took them
  for (const id of ['base', 'head']) {
    const w = run.builds[id].fr.map((f, i) => [i, ...f]).sort((a, b) => b[1] - a[1]).slice(0, 6);
    console.log(`  worst ${id}: ` + w.map(f => `#${f[0]} ${f[1]}ms(js ${f[2]} h ${f[3]}${f[5] < 0 ? ' GC' : ''}) ${f[6].slice(0, 3).map(x => x[0].replace(/^(game|world|renderer)\./, '') + ' ' + x[1]).join(', ')}`).join(' | '));
  }
  await br.close();
}
await new Promise((r) => server.close(r));

// ---------------------------------------------------------------- the verdict per preset (over the rounds)
const sum = {};
for (const preset of PRESETS) {
  const runs = rec.runs.filter(r => r.preset === preset);
  if (!runs.length) continue;
  const agg = (id) => { const all = runs.flatMap(r => r.builds[id].fr.map(f => f[0])); return { med: r1(med(runs.map(r => r.builds[id].med))), p99: r1(pct(all, 0.99)), hitches: runs.reduce((a, r) => a + r.builds[id].hitches, 0), frames: all.length }; };
  const b = agg('base'), h = agg('head'), ratio = h.med / b.med;
  sum[preset] = { base: b, head: h, ratio: +ratio.toFixed(3) };
  console.log(`--- ${preset}: median ${b.med} → ${h.med} ms (× ${ratio.toFixed(3)}), p99 ${b.p99} → ${h.p99}, hitches ${b.hitches} → ${h.hitches} (${runs.length} round(s), ${h.frames} frames each)`);
  check(ratio <= 1 + TOL, `${preset}: the median frame not slower than ${BASE} (× ${ratio.toFixed(3)} ≤ ${(1 + TOL).toFixed(2)})`);
  check(h.hitches <= Math.floor(b.hitches * (1 - DOWN)) + (DOWN ? 0 : 2), `${preset}: hitches ${b.hitches} → ${h.hitches} (${DOWN ? '≥ ' + Math.round(DOWN * 100) + ' % fewer' : 'not more'})`);
  check(h.p99 <= b.p99 * (1 - DOWN) * (DOWN ? 1 : 1.15), `${preset}: p99 ${b.p99} → ${h.p99} ms (${DOWN ? '≥ ' + Math.round(DOWN * 100) + ' % lower' : 'not clearly worse'})`);
  const r0 = runs.find(r => r.shots && r.shots.length === 2);
  if (r0) {
    const img = (f) => sharp(f).resize(320, 180, { fit: 'fill' }).removeAlpha().raw().toBuffer();
    const [ia, ib] = [await img(r0.shots[0]), await img(r0.shots[1])];
    let d = 0; for (let i = 0; i < ia.length; i++) d += Math.abs(ia[i] - ib[i]);
    sum[preset].viewDiff = +(d / ia.length).toFixed(2);
    check(d / ia.length < 8, `${preset}: the end views alike (mean difference ${(d / ia.length).toFixed(2)} of 255; test/shots/hitch_gate_${preset}_{base,head}.png)`);
  }
}
rec.sum = sum; save();
console.log('--- page errors (' + errsAll.length + ')'); for (const e of errsAll.slice(0, 8)) console.log('  ' + e);
check(errsAll.length === 0, 'no page errors');
console.log(`(${secs()})`);
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

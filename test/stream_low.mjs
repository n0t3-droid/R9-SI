// p-stream · does the world keep up on Low and Very Low when you fly fast or walk into unloaded land? Browser test.
// Per build (BEFORE_URL = .tmp_tests/before_dist, the v042 build; AFTER_URL = dist) and preset (low, potato): a fresh
// world (seed 1, noon, frozen weather), settled at the spawn; then four straight runs of RUN_S seconds from the spawn,
// each in its own direction (fresh land): walk 5 m/s on the ground, fly 20 / 40 / 80 m/s 35 blocks over the land.
// The flight is driven inside the page in real time (a 30 fps tick: world.update + horizon.update, the game's rendering
// stopped — a software frame costs seconds here, the workers run at their real speed), and every 100 ms it records:
//   chunks requested / generated / meshed / uploaded, the worker queues (length, age of the oldest job), cancels;
//   the view cone ahead (horizontal field of view, a polar grid of ground points weighted by 1/d ≈ their screen area):
//   real % (a shown chunk column), coarse % (only a far tile stands in), void % (neither: a sky hole) — near (inside the
//   render distance) and far (to 600 m); time-to-visible of the columns that enter the cone inside the render distance
//   while not shown (median, p90, and the share never shown while in the cone); the streaming ms of each tick (hitches).
// Then a picture ahead of the camera 12 s into a 40 and an 80 m/s flight (extra runs, so the measured runs are not
// paused): test/shots/stream_<preset>_<speed>_<build>.png and the sheet test/shots/stream_sheet.jpg (German captions).
// Pure measuring: with both builds it checks that the after build fills the cone ahead better at every speed.
//   nohup bash test/wt_run.sh stream_low.mjs 5400 > .tmp_tests/stream_low.log 2>&1 &
//   BUILDS (before,after) · PRESETS (low,potato) · SPEEDS (5,20,40,80) · RUN_S (30) · SKIP_SHOTS=1
//   PREV_JSON: an earlier run's .tmp_tests/stream_low.json — its other build joins the table, the checks and the sheet
//   SLOW (3): the workers' answers held back as if each worker were SLOW times slower — this server's core makes a column
//   in ~15 ms, a low-end laptop's in 40–60 ms; SLOW=1 measures this server as it is
// regress: skip  (a before/after benchmark of ~40 min that needs the build before in .tmp_tests/before_dist)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.basename(HERE) === '.tmp_tests' ? path.dirname(HERE) : path.dirname(HERE);
const URLS = { before: process.env.BEFORE_URL || 'file://' + ROOT + '/.tmp_tests/before_dist/index.html', after: process.env.AFTER_URL || 'file://' + ROOT + '/dist/index.html' };
const BUILDS = (process.env.BUILDS || 'before,after').split(',').filter(b => fs.existsSync(URLS[b].replace('file://', '')));
const PRESETS = (process.env.PRESETS || 'low,potato').split(',');
const SPEEDS = (process.env.SPEEDS || '5,20,40,80').split(',').map(Number);
const RUN_S = +(process.env.RUN_S || 30);
const SLOW = +(process.env.SLOW || 3);   // the worker k times slower (a low-end PC; 1 = this server)
const SHOTS = ROOT + '/test/shots', OUT = ROOT + '/.tmp_tests';
fs.mkdirSync(SHOTS, { recursive: true });
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  ' + info : '')); };
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const errs = [];

// ---- in the page: the instruments and the flight
const PAGE_INIT = () => {
  window.__instr = () => {
    const g = VR.game, w = g.world, pool = g.pool;
    if (w.__instr) return;
    w.__instr = true;
    const C = window.__C = { req: 0, gen: 0, wasted: 0, cancel: {}, done: {} };
    const rq = w.requestColumn.bind(w); w.requestColumn = function (...a) { C.req++; return rq(...a); };
    const oc = w.onColumn.bind(w); w.onColumn = function (m) { C.gen++; return oc(m); };
    const uc = w.unloadColumn.bind(w); w.unloadColumn = function (c) { if (c.shownAt < 0) C.wasted++; return uc(c); };
    if (!pool.__instr) {
      pool.__instr = true;
      // a weaker PC (SLOW = k): every answer is held back (k − 1) × the job's time — the worker slot stays busy, as if the
      // worker were k times slower (this server's core is several times a low-end laptop's)
      const k = window.__SLOW || 1;
      if (k > 1) { const om = pool.onMsg.bind(pool); pool.onMsg = function (w, m) { if (m.type === 'log' || m.type === 'waiting') return om(w, m); const st = pool.started.get(m.id), ms = m.ms !== undefined ? m.ms : st ? performance.now() - st.t0 : 0; setTimeout(() => om(w, m), Math.min(2000, ms * (k - 1))); }; for (const w of pool.workers) w.onmessage = (e) => pool.onMsg(w, e.data); }
      const sb = pool.submit.bind(pool);
      pool.submit = function (msg, tr, cb, prio) {
        msg._t = performance.now(); const ty = msg.type;
        const cb2 = cb ? (m) => { const C2 = window.__C; if (C2) { if (m.type === 'cancelled') C2.cancel[ty] = (C2.cancel[ty] || 0) + 1; else C2.done[ty] = (C2.done[ty] || 0) + 1; } return cb(m); } : cb;
        return sb(msg, tr, cb2, prio);
      };
    }
  };
  // one streaming tick (no drawing)
  window.__tick = () => {
    const g = VR.game, p = g.player, now = performance.now(), w = g.world;
    const vd = w.viewDir || (w.viewDir = [0, 0]); vd[0] = -Math.sin(p.yaw); vd[1] = -Math.cos(p.yaw);   // (as game.js does each frame)
    w.viewCos = Math.cos(Math.atan(Math.tan((g.settings.fov || 75) * Math.PI / 360) * 16 / 9));
    if (VR.StreamPlan) w.streamPlan = g.settings.streamPlan !== false;
    g.world.update(p.pos[0], p.pos[1], p.pos[2], now);
    const t1 = performance.now(); window.__wMs = t1 - now;
    if (g.horizon) g.horizon.update({ x: p.pos[0], y: p.pos[1] + p.eye, z: p.pos[2], yaw: p.yaw, pitch: p.pitch, fov: g.settings.fov * Math.PI / 180 });
    g.pool.pump();
  };
  window.__quiet = () => { const g = VR.game, h = g.horizon, w = g.world; return g.pool.busy === 0 && w.pending.size === 0 && (!h || h.inflight === 0) && !((w.lastWant || 0) + (h ? h.stats.want || 0 : 0)) && !(w.fading && w.fading.size) && !(w.uploadQ && w.uploadQ.size) && !(w.arrivals && w.arrivals.length); };
  window.__settle = async (maxS) => {
    const t0 = performance.now(); let q = 0;
    while (performance.now() - t0 < maxS * 1000) { window.__tick(); await new Promise(r => setTimeout(r, 33)); if (window.__quiet()) { if (++q > 20) break; } else q = 0; }
    return +((performance.now() - t0) / 1000).toFixed(1);
  };
  // the cone ahead: real (a shown column), coarse (a ready far tile), void
  const coverAt = (w, h, x, z) => {
    const c = w.cols.get(VR.ckey ? VR.ckey(Math.floor(x) >> 4, Math.floor(z) >> 4) : null);
    if (c && c.shownAt >= 0) return 2;
    if (h && h.tiles) for (let L = 0; L <= 4; L++) { const S = 128 << L, t = h.tiles.get(h.key(L, Math.floor(x / S), Math.floor(z / S))); if (t && t.state === 1 && (t.vao || t.empty)) return 1; }
    return 0;
  };
  window.__cone = (yaw, hHalf) => {
    const g = VR.game, w = g.world, h = g.horizon && g.horizon.enabled() ? g.horizon : null, p = g.player, rdB = w.renderDist * 16;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const acc = { nr: 0, nc: 0, nv: 0, nw: 0, fc: 0, fv: 0, fw: 0 };
    for (let ai = 0; ai <= 10; ai++) {
      const a = -hHalf + 2 * hHalf * ai / 10, ca = Math.cos(a), sa = Math.sin(a);
      const dx = fx * ca - fz * sa, dz = fx * sa + fz * ca;
      for (let d = 8; d <= 600; d *= 1.12) {
        const k = coverAt(w, h, p.pos[0] + dx * d, p.pos[2] + dz * d), wt = 1 / d;
        if (d <= rdB) { acc.nw += wt; if (k === 2) acc.nr += wt; else if (k === 1) acc.nc += wt; else acc.nv += wt; }
        else { acc.fw += wt; if (k === 0) acc.fv += wt; else acc.fc += wt; }
      }
    }
    return { real: acc.nr / acc.nw, coarse: acc.nc / acc.nw, voidN: acc.nv / acc.nw, voidF: acc.fw ? acc.fv / acc.fw : 0, voidAll: (acc.nv + acc.fv) / (acc.nw + acc.fw) };
  };
  // a straight run from (x0, z0): heading yaw, speed v (m/s), secs; walk = on the ground, else 35 blocks over the land
  window.__fly = async (o) => {
    window.__instr();
    const g = VR.game, w = g.world, p = g.player, pool = g.pool, C = window.__C;
    const gen = VR.makeGen('overworld', w.seed, w.genOpts);
    const fx = -Math.sin(o.yaw), fz = -Math.cos(o.yaw), L = o.v * o.secs + 64;
    const prof = [];
    for (let s = 0; s <= L; s += 16) { const x = o.x0 + fx * s, z = o.z0 + fz * s; let hh = 0; const off = o.walk ? [[0, 0]] : [[0, 0], [32, 0], [-32, 0], [0, 32], [0, -32]]; for (const [a, b] of off) hh = Math.max(hh, gen.surfaceY(Math.floor(x + a), Math.floor(z + b))); prof.push(hh); }
    if (!o.walk) { const raw = prof.slice(); for (let i = 0; i < prof.length; i++) for (let j = 1; j <= 4 && i + j < raw.length; j++) prof[i] = Math.max(prof[i], raw[i + j]); }   // (the hill 64 m ahead: climb before it)
    for (let i = 1; i < prof.length; i++) if (!o.walk) prof[i] = Math.max(prof[i], prof[i - 1] - 3);
    const yAt = (s) => { const i = Math.min(prof.length - 2, Math.floor(s / 16)), f = s / 16 - i; return prof[i] * (1 - f) + prof[i + 1] * f + (o.walk ? 1.62 : 35); };
    const hHalf = Math.atan(Math.tan((g.settings.fov || 75) * Math.PI / 360) * 16 / 9);
    p.yaw = o.yaw; p.viewYaw = o.yaw; p.pitch = o.walk ? -0.08 : -0.22; p.flying = true; p.noclip = true;
    const C0 = JSON.parse(JSON.stringify(C)), mesh0 = w.stats.mesh, up0 = w.stats.uploaded || 0;
    const rec = [], ent = new Map(), ttv = [], tickMs = [], hit = [];
    let missed = 0, s = 0, t0 = performance.now(), last = t0, nextRec = t0;
    const rd = w.renderDist;
    while (true) {
      const now = performance.now(), el = (now - t0) / 1000;
      if (el >= o.secs) break;
      s += o.v * Math.min(0.1, (now - last) / 1000); last = now;
      p.pos[0] = o.x0 + fx * s; p.pos[2] = o.z0 + fz * s; p.pos[1] = yAt(s);
      const a = performance.now(); window.__tick(); const tk = performance.now() - a; tickMs.push(tk); if (tk > 16) hit.push([+tk.toFixed(1), +window.__wMs.toFixed(1)]);
      if (now >= nextRec) {
        nextRec = now + 100;
        // columns entering the cone inside the render distance
        const pcx = Math.floor(p.pos[0]) >> 4, pcz = Math.floor(p.pos[2]) >> 4, seen = new Set();
        for (let dz = -rd; dz <= rd; dz++) for (let dx = -rd; dx <= rd; dx++) {
          if (dx * dx + dz * dz > (rd + 0.5) * (rd + 0.5) || (Math.abs(dx) <= 1 && Math.abs(dz) <= 1)) continue;
          const ex = (pcx + dx) * 16 + 8 - p.pos[0], ez = (pcz + dz) * 16 + 8 - p.pos[2], d = Math.hypot(ex, ez);
          if ((ex * fx + ez * fz) / d < Math.cos(hHalf)) continue;
          const k = VR.ckey(pcx + dx, pcz + dz), c = w.cols.get(k), shown = c && c.shownAt >= 0;
          seen.add(k);
          const e = ent.get(k);
          if (!e) { if (!shown) ent.set(k, now); else ent.set(k, -1); }
          else if (e > 0 && shown) { ttv.push(now - e); ent.set(k, -1); }
        }
        for (const [k, e] of ent) if (!seen.has(k)) { if (e > 0) missed++; ent.delete(k); }
        const cv = window.__cone(o.yaw, hHalf);
        let a0 = 0, a1 = 0; for (const j of pool.queue) if (j.msg._t) a0 = Math.max(a0, now - j.msg._t); for (const j of pool.queueFar) if (j.msg._t) a1 = Math.max(a1, now - j.msg._t);
        rec.push({ t: +el.toFixed(2), req: C.req - C0.req, gen: C.gen - C0.gen, mesh: w.stats.mesh - mesh0, up: (w.stats.uploaded || 0) - up0, q0: pool.queue.length, q1: pool.queueFar.length, age0: Math.round(a0), age1: Math.round(a1), pend: w.pending.size, upQ: w.uploadQ ? w.uploadQ.size : 0,
          real: +cv.real.toFixed(3), coarse: +cv.coarse.toFixed(3), voidN: +cv.voidN.toFixed(3), voidF: +cv.voidF.toFixed(3), voidAll: +cv.voidAll.toFixed(3), tick: +Math.max(...tickMs.slice(-4)).toFixed(1) });
      }
      await new Promise(r => setTimeout(r, Math.max(0, 33 - (performance.now() - now))));
    }
    const end = performance.now(); let open = 0; for (const e of ent.values()) if (e > 0) { ttv.push(end - e); open++; }
    const cancel = {}; for (const k in C.cancel) cancel[k] = C.cancel[k] - (C0.cancel[k] || 0);
    const done = {}; for (const k in C.done) done[k] = C.done[k] - (C0.done[k] || 0);
    return { rec, ttv, missed, open, tickMs, hit: hit.sort((x, y) => y[0] - x[0]).slice(0, 5), cancel, done, wasted: C.wasted - C0.wasted, pos: [p.pos[0], p.pos[1], p.pos[2]] };
  };
};

async function open(build, preset) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
  await ctx.addInitScript(PAGE_INIT);
  await ctx.addInitScript((k) => { window.__SLOW = k; }, SLOW);
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push('[pageerror] ' + build + ': ' + (e.stack || e.message).slice(0, 500)));
  page.on('console', m => { if (m.type() === 'error') errs.push('[console] ' + build + ': ' + m.text().slice(0, 240)); });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  await page.goto(URLS[build]);
  for (let i = 0; i < 240; i++) { await page.waitForTimeout(500); if (await ev(() => !!(window.VR && VR.game && VR.game.state === 'title'))) break; }
  await ev(() => VR.game.createWorld({ name: 'Strom', mode: 'creative', difficulty: 'peaceful', type: 'default', seed: '1', cheats: true, kit: false }));
  for (let i = 0; i < 300; i++) { await page.waitForTimeout(1000); if (await ev(() => VR.game.state) === 'play') break; }
  const info = await ev((p) => {
    const g = VR.game;
    window.requestAnimationFrame = () => 0;
    g.hideHud = true; for (const id of ['hud', 'ui']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; }
    g.applyPreset(p); const S = g.settings; S.minimap = false; S.airLife = false; g.applySettings('*');
    g.env.setTime(6000); g.zenFreezeTime = true; g.zenFreezeWeather = true;
    if (g.env.wx && g.env.wx.setMode) g.env.wx.setMode('off');
    const pl = g.player; pl.flying = true; pl.noclip = true;
    window.__spawn = [pl.pos[0], pl.pos[1], pl.pos[2]];
    window.__px = new Uint8Array(4);
    window.__frame = (dtS) => { const gg = VR.game, gl = gg.renderer.gl; gg.last = performance.now() - dtS * 1000; const t0 = performance.now(); gg.loop(t0); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, window.__px); return performance.now() - t0; };
    return { workers: g.pool.workers.length, rd: g.world.renderDist, cores: navigator.hardwareConcurrency, horizon: g.horizon && g.horizon.level };
  }, preset);
  return { build, preset, ctx, page, ev, info };
}
const home = (P) => P.ev(async () => { const p = VR.game.player, s = window.__spawn; p.pos[0] = s[0]; p.pos[1] = s[1] + 30; p.pos[2] = s[2]; return window.__settle(60); });

const med = (a) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[b.length >> 1] : 0; };
const pct = (a, q) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(q * b.length))] : 0; };
const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const results = {};
for (let pi = 0; pi < PRESETS.length; pi++) {
  const preset = PRESETS[pi];
  const order = pi % 2 === 0 ? BUILDS : BUILDS.slice().reverse();   // (the order alternates: the machine's load drifts)
  for (const build of order) {
    const P = await open(build, preset);
    const st0 = await P.ev(() => window.__settle(180));
    console.log(`== ${build} · ${preset}: ${JSON.stringify(P.info)} · spawn settled in ${st0} s`);
    for (let si = 0; si < SPEEDS.length; si++) {
      const v = SPEEDS[si];
      const hs = await home(P);
      const sp = await P.ev(() => window.__spawn);
      const r = await P.ev((o) => window.__fly(o), { x0: sp[0], z0: sp[2], yaw: si * Math.PI / 2 + 0.35, v, secs: RUN_S, walk: v <= 6 });
      const R = r.rec, steady = R.filter(x => x.t >= 3);
      const out = {
        build, preset, v, homeS: hs, ttvMed: Math.round(med(r.ttv)), ttvP90: Math.round(pct(r.ttv, 0.9)), entered: r.ttv.length + r.missed, missedPct: +(100 * r.missed / Math.max(1, r.ttv.length + r.missed)).toFixed(0),
        real: +(100 * mean(steady.map(x => x.real))).toFixed(1), coarse: +(100 * mean(steady.map(x => x.coarse))).toFixed(1), voidN: +(100 * mean(steady.map(x => x.voidN))).toFixed(1), voidF: +(100 * mean(steady.map(x => x.voidF))).toFixed(1),
        voidAll: +(100 * mean(steady.map(x => x.voidAll))).toFixed(1), voidMax: +(100 * Math.max(0, ...steady.map(x => x.voidAll))).toFixed(1),
        req: R.length ? R[R.length - 1].req : 0, gen: R.length ? R[R.length - 1].gen : 0, mesh: R.length ? R[R.length - 1].mesh : 0, up: R.length ? R[R.length - 1].up : 0, wasted: r.wasted,
        q0Max: Math.max(0, ...R.map(x => x.q0)), q1Max: Math.max(0, ...R.map(x => x.q1)), age0Max: Math.max(0, ...R.map(x => x.age0)), age1Max: Math.max(0, ...R.map(x => x.age1)), upQMax: Math.max(0, ...R.map(x => x.upQ)),
        tickMed: +med(r.tickMs).toFixed(2), tickP99: +pct(r.tickMs, 0.99).toFixed(1), tickMax: +Math.max(...r.tickMs).toFixed(1), hitches: r.tickMs.filter(m => m > 16).length,
        cancel: r.cancel, done: r.done, worst: r.hit, slow: SLOW,
      };
      console.log('RUN ' + JSON.stringify(out));
      results[`${preset}_${v}_${build}`] = { out, rec: R };
    }
    // the pictures: 12 s into a 40 and an 80 m/s flight (own runs, own directions)
    if (!process.env.SKIP_SHOTS) for (const [j, v] of [[0, 40], [1, 80]]) {
      await home(P);
      const sp = await P.ev(() => window.__spawn);
      const r = await P.ev((o) => window.__fly(o), { x0: sp[0], z0: sp[2], yaw: 0.35 + Math.PI / 4 + j * Math.PI, v, secs: 12, walk: false });
      const cone = r.rec.length ? r.rec[r.rec.length - 1] : {};
      await P.ev(() => { VR.game.renderer.tsrReset = true; });   // (the drawing was stopped during the flight: no old picture in the history)
      for (let i = 0; i < 4; i++) await P.ev(() => window.__frame(0.033));
      const shot = `${SHOTS}/stream_${preset}_${v}_${build}.png`;
      await P.page.screenshot({ path: shot, timeout: 600000 });
      results[`shot_${preset}_${v}_${build}`] = { shot, real: cone.real, coarse: cone.coarse, voidAll: cone.voidAll };
      console.log(`  shot ${shot}  real ${cone.real} coarse ${cone.coarse} void ${cone.voidAll}`);
    }
    await P.ctx.close();
  }
}
// PREV_JSON: the results of an earlier run (the other build, measured the same way) join this run's table, checks and sheet
if (process.env.PREV_JSON) { const prev = JSON.parse(fs.readFileSync(process.env.PREV_JSON, 'utf8')); for (const k in prev) if (!results[k] && !BUILDS.some(b => k.endsWith('_' + b))) results[k] = prev[k]; for (const b of ['before', 'after']) if (!BUILDS.includes(b) && Object.keys(prev).some(k => k.endsWith('_' + b))) BUILDS.push(b); BUILDS.sort((x, y) => (x === 'before' ? -1 : 1) - (y === 'before' ? -1 : 1)); console.log('joined ' + process.env.PREV_JSON + ' · builds ' + BUILDS.join(', ')); }
try { fs.writeFileSync(`${OUT}/stream_low.json`, JSON.stringify(results)); } catch (e) { console.log('could not write the json: ' + e.message); }
// ---- the table
console.log('\npreset  v   build   ttv med/p90 ms  missed%  real%  coarse%  voidN%  voidF%  void%(max)  gen  mesh  wasted  q0max age0max  tick p99/max  hitches');
for (const preset of PRESETS) for (const v of SPEEDS) for (const b of BUILDS) {
  const o = results[`${preset}_${v}_${b}`]; if (!o) continue; const x = o.out;
  console.log(`${preset.padEnd(7)} ${String(v).padStart(2)}  ${b.padEnd(6)}  ${String(x.ttvMed).padStart(6)}/${String(x.ttvP90).padEnd(6)}  ${String(x.missedPct).padStart(5)}   ${String(x.real).padStart(5)}  ${String(x.coarse).padStart(6)}  ${String(x.voidN).padStart(6)}  ${String(x.voidF).padStart(6)}  ${String(x.voidAll).padStart(5)}(${x.voidMax})  ${String(x.gen).padStart(4)}  ${String(x.mesh).padStart(4)}  ${String(x.wasted).padStart(5)}  ${String(x.q0Max).padStart(5)} ${String(x.age0Max).padStart(6)}  ${x.tickP99}/${x.tickMax}  ${x.hitches}`);
}
// ---- the checks (both builds): never more void, never less real terrain ahead (3 points of noise), a walk's columns there
// sooner, no more streaming hitches
if (BUILDS.length === 2) for (const preset of PRESETS) for (const v of SPEEDS) {
  const b = results[`${preset}_${v}_before`], a = results[`${preset}_${v}_after`]; if (!a || !b) continue;
  check(a.out.voidAll <= b.out.voidAll + 0.5, `${preset} ${v} m/s: no more void ahead`, `${b.out.voidAll} → ${a.out.voidAll} %`);
  check(a.out.real >= b.out.real - 3, `${preset} ${v} m/s: at least as much real terrain in the cone ahead`, `${b.out.real} → ${a.out.real} %`);
  if (v <= 6) check(a.out.ttvP90 < b.out.ttvP90, `${preset} walk: the columns coming into view are there sooner (p90)`, `${b.out.ttvP90} → ${a.out.ttvP90} ms`);
  check(a.out.hitches <= b.out.hitches + 3, `${preset} ${v} m/s: no more streaming hitches (ticks over 16 ms)`, `${b.out.hitches} → ${a.out.hitches} (max ${b.out.tickMax} → ${a.out.tickMax} ms)`);
}
// ---- the sheet (German captions)
if (!process.env.SKIP_SHOTS && BUILDS.length) {
  const rows = [];
  for (const preset of PRESETS) for (const v of [40, 80]) {
    const imgs = BUILDS.map(b => results[`shot_${preset}_${v}_${b}`]).filter(Boolean);
    if (!imgs.length) continue;
    const nm = preset === 'potato' ? 'Sehr niedrig' : 'Niedrig';
    const lab = imgs.map((s, i) => `${BUILDS[i] === 'before' ? 'vorher' : 'nachher'}: echt ${Math.round(100 * (s.real || 0))} %, grob ${Math.round(100 * (s.coarse || 0))} %, Loch ${Math.round(100 * (s.voidAll || 0))} %`).join(' | ');
    rows.push({ label: `${nm} · Flug ${v} m/s nach 12 s — ${lab}`, imgs: imgs.map(s => s.shot) });
  }
  const spec = `${OUT}/stream_sheet.json`;
  fs.writeFileSync(spec, JSON.stringify({ w: 620, rows }));
  try { execFileSync('python3', ['/root/r9coord/pairs.py', `${SHOTS}/stream_sheet.jpg`, spec]); console.log('sheet ' + SHOTS + '/stream_sheet.jpg'); } catch (e) { console.log('no sheet: ' + String(e.message).slice(0, 200)); }
}
console.log('--- errors (' + errs.length + ')'); for (const e of errs.slice(0, 10)) console.log(e);
check(errs.filter(e => e.startsWith('[pageerror]')).length === 0, 'no page errors');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
await browser.close();
process.exit(fails ? 1 : 0);

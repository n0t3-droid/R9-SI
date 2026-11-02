// regress: skip — f-perf8's Very Low bench (docs/superpowers/plans/2026-11-02-f-perf8.md, R57-01): several builds on
// Very Low in one browser (critic_vl.mjs's warm-up, world, poses and kept-frame cost — its helpers copied here), in turns:
//   load      createWorld → 'play' (s) and its main-thread sampling profile by source module (the debug page's markers:
//             the player page keeps the debug page's lines)
//   heap      the JS heap after the plaza settled, after a forced GC (MB)
//   logic     the game's own frame without the draw (g.loop with the renderer's draw skipped, dt 16.7 ms, the HUD shown):
//             wall ms a frame, the browser's CPU a frame, and a sampling profile of FR frames by source module
//   render    the plaza's kept frame drawn (critic_vl's cost: wall and CPU a frame), the orbit (/raum herz) the same
// usage: R9_EXCLUSIVE=1 nohup bash test/wt_run.sh perf8.mjs 3600 > .tmp_tests/perf8.log 2>&1 &
//   BUILDS=tag=path,… (default v0541, v0556 from .tmp_tests/b_<tag>/dist, cur = dist) · ROUNDS=5 · N=4 · FR=1200 · NO_SPACE=1
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import sharp from '/home/dev/.npm-global/lib/node_modules/sharp/lib/index.js';
import fs from 'fs';
import { execSync } from 'child_process';
const ROOT = new URL('../', import.meta.url).pathname;
const SHOTS = ROOT + 'test/shots/';
const BUILDS = (process.env.BUILDS || `v0541=${ROOT}.tmp_tests/b_v0.54.1/dist/index.html,v0556=${ROOT}.tmp_tests/b_v0.55.6/dist/index.html,cur=${ROOT}dist/index.html`).split(',').map(s => { const [tag, p] = s.split('='); return { tag, path: p }; });
const SEED = process.env.SEED || '53', ROUNDS = +(process.env.ROUNDS || 5), N = +(process.env.N || 4), FR = +(process.env.FR || 1200);
const VW = 1280, VH = 720, EYE = 1.62, PFX = 'perf8_vl';
const TAG = {}; for (const b of BUILDS) TAG[b.tag] = b.tag;
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const r1 = (x) => Math.round(x * 10) / 10, r3 = (x) => Math.round(x * 1000) / 1000;
const med = (a) => { const s = a.filter(Number.isFinite).slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
const rec = { builds: BUILDS, seed: SEED, rounds: ROUNDS, n: N, fr: FR, pages: {} };
const save = () => { try { fs.mkdirSync(ROOT + '.tmp_tests', { recursive: true }); fs.writeFileSync(ROOT + '.tmp_tests/perf8.json', JSON.stringify(rec, null, 1)); fs.writeFileSync(SHOTS + PFX + '.json', JSON.stringify(rec, null, 1)); } catch (e) { /* a convenience */ } };
fs.mkdirSync(SHOTS, { recursive: true });
const aimAt = (x, y, z, at) => { const dx = at[0] - x, dy = at[1] - y, dz = at[2] - z; return [Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz))]; };
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--enable-precise-memory-info'] });
// the CPU time (ms) of this test's browser processes (space0.mjs, ipu.mjs)
const cpuNow = () => {
  const kids = new Map();
  for (const l of execSync('ps -e -o pid=,ppid=').toString().trim().split('\n')) { const [p, pp] = l.trim().split(/\s+/).map(Number); if (!kids.has(pp)) kids.set(pp, []); kids.get(pp).push(p); }
  let t = 0; const st = [process.pid];
  while (st.length) { for (const c of kids.get(st.pop()) || []) { st.push(c); try { const s = fs.readFileSync(`/proc/${c}/stat`, 'utf8'), f = s.slice(s.lastIndexOf(')') + 2).split(' '); t += +f[11] + +f[12]; } catch (e) { /* gone */ } } }
  return t * 10;
};
// ---------------------------------------------------------------- a page with a Very Low world (space0.mjs's, wow48.mjs's helpers)
async function openWorld(dist, tag) {
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, locale: 'de-DE' });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const logs = [];
  page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail|missing|incomplete/i.test(s)) logs.push(`[${t}] ${s.slice(0, 600)}`); });
  page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
  page.on('crash', () => { logs.push('[pageerror] the page crashed'); console.log(`  !! ${tag}: the page crashed`); });
  await page.goto(dist);
  const wait = (ms) => page.waitForTimeout(ms);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  for (let i = 0; i < 160; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title').catch(() => false)) break; }
  await ev(() => {
    const r = VR.game.renderer, gl = r.gl;
    window.__px = new Uint8Array(4);
    window.__sync = () => { const d = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING), rd = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, window.__px); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, d); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, rd); };
    if (!r._render) { r._render = r.render; r.render = function (F) { if (window.__norender) { window.__F = F; this.setupCamera(F.cam); return; } return this._render(F); }; }
  });
  const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(4); } };
  const boost = (on) => ev((on) => { const q = VR.game.renderer && VR.game.renderer.q; if (!q) return; if (on) { if (q.__up === undefined) q.__up = q.upload; q.upload = 24; } else if (q.__up !== undefined) { q.upload = q.__up; delete q.__up; } }, on);
  const holdFar = (on) => ev((on) => { const pool = VR.game.pool; if (!pool || !pool.queueFar) return 0; if (on) pool.__heldFar = (pool.__heldFar || []).concat(pool.queueFar.splice(0)); else if (pool.__heldFar) { for (const j of pool.__heldFar) pool.queueFar.push(j); pool.__heldFar = null; pool.queueDirty = true; if (pool.pump) pool.pump(); } return 0; }, on);
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
  // the highest standing block below y0 (an isle's top: from 210 down; the land: from 200 down), leaves skipped
  const groundY = (x, z, y0 = 200) => ev(([x, z, y0]) => { const w = VR.game.world, R = VR.R, F = VR.F; for (let y = y0; y > 30; y--) { const s = w.getBlock(Math.floor(x), y, Math.floor(z)); if (s && (R.T.flags[s] & (F.OPAQUE | F.FLUID)) && !(R.T.flags[s] & F.LEAVES)) return y; } return 80; }, [x, z, y0]);
  const clearEye = (x, y, z, yaw, pitch, need) => ev(([x, y, z, yaw, pitch, need]) => {
    const w = VR.game.world, R = VR.R, F = VR.F;
    const fl = (x, y, z) => { const s = w.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)); return s ? R.T.flags[s] : 0; };
    const cp = Math.cos(pitch), dx = -Math.sin(yaw) * cp, dy = Math.sin(pitch), dz = -Math.cos(yaw) * cp, hx = Math.hypot(dx, dz) || 1;
    const box = (x, y, z) => { for (const b of [-0.6, 0, 0.9]) for (let a = -1; a <= 1; a++) for (let c = -1; c <= 1; c++) if (fl(x + a * 0.9, y + b, z + c * 0.9) & F.SOLID) return false; return true; };
    const ray = (x, y, z) => { for (let t = 0.5; t <= need; t += 0.25) if (fl(x + dx * t, y + dy * t, z + dz * t) & (t <= 2.5 ? F.SOLID : F.OPAQUE | F.LEAVES)) return false; return true; };
    for (let back = 0; back <= 12; back += 2) { const bx = x - dx / hx * back, bz = z - dz / hx * back; for (let up = 0; up <= 24; up++) if (box(bx, y + up, bz) && ray(bx, y + up, bz)) return { x: bx, y: y + up, z: bz, up, back }; }
    return { x, y, z, up: 0, back: 0, stuck: true };
  }, [x, y, z, yaw, pitch, need]);
  const pose = (x, feet, z, yaw, pitch, fov) => ev(([x, y, z, yaw, pitch, fov]) => { const g = VR.game, p = g.player; p.flying = true; p.noclip = true; p.teleport(x, y, z); p.yaw = yaw; p.pitch = pitch; p.viewYaw = yaw; p.fovKick = 0; p.vel = [0, 0, 0]; g.settings.fov = fov; g.env.setTime(6000); const e = g.entities; if (e && e.mobs) e.mobs.length = 0; }, [x, feet, z, yaw, pitch, fov]);
  // the world: Very Low as a player gets it (its own view distance), the dynamic resolution off; a new default world
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 1000 }); await cdp.send('Profiler.start');
  const t0 = Date.now();
  await ev(() => { const g = VR.game; g.applyPreset('potato'); g.settings.dynRes = false; g.applySettings('*'); });
  await ev((seed) => VR.game.createWorld({ name: 'Kritik VL', mode: 'creative', difficulty: 'peaceful', type: 'default', seed, cheats: true, kit: true }), SEED);
  for (let i = 0; i < 960; i++) { await wait(250); if (await ev(() => VR.game.state).catch(() => '') === 'play') break; }
  const ok = await ev(() => VR.game.state) === 'play';
  const loadS = (Date.now() - t0) / 1000;
  const loadProf = (await cdp.send('Profiler.stop')).profile;
  await ev(() => {
    const g = VR.game; g.zenFreezeTime = true; g.zenFreezeWeather = true;
    if (g.env.wx && g.env.wx.force) g.env.wx.force('klar'); g.env.rain = 0; g.env.rainTarget = 0;
    g.settings.wowMoments = false; if (g.arrival && g.arrival.skip) { try { g.arrival.skip(); } catch (e) { /* none */ } }
    window.requestAnimationFrame = () => 0;   // (f-perf8: the HUD stays — its updates are part of a player's frame)
  });
  const info = await ev(() => { const g = VR.game; return { vgen: g.meta && g.meta.vgen, preset: g.settings.preset, rd: g.settings.renderDist, scale: g.settings.scale, dynRes: g.settings.dynRes }; });
  return { tag, ctx, page, cdp, loadProf, logs, ev, wait, step, settle, holdFar, warmVx, groundY, clearEye, pose, ok, loadS, info };
}
const errsOf = (P) => P.logs.filter(l => l.startsWith('[pageerror]'));
// a kept frame (window[key]) drawn k times, the screen read back into a picture (space0.mjs)
const picture = async (P, key, path, k = 2) => {
  const m = await P.ev(([key, k]) => {
    const g = VR.game, r = g.renderer, gl = r.gl, F = window[key];
    if (!F) return { err: 'no frame kept' };
    window.__norender = false;
    r.frameNo = 1000; r.tsrReset = true; r.shadowValid = false;
    try { for (let i = 0; i < k; i++) r.render(F); } catch (e) { window.__norender = true; return { err: String(e && e.stack || e).slice(0, 600) }; }
    const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, px = new Uint8Array(W * H * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let s = ''; const CH = 0x8000; for (let i = 0; i < px.length; i += CH) s += String.fromCharCode.apply(null, px.subarray(i, i + CH));
    window.__norender = true;
    return { png: btoa(s), W, H, draws: r.stats.draws, tris: Math.round(r.stats.tris), fs: r.stats.fsPasses };
  }, [key, k]);
  if (m.err) return m;
  await sharp(Buffer.from(m.png, 'base64'), { raw: { width: m.W, height: m.H, channels: 4 } }).flip().removeAlpha().png().toFile(path);
  delete m.png;
  return m;
};
const cost = async (P, key, k, n) => {
  await P.ev(([key, k]) => { const r = VR.game.renderer, F = window[key]; window.__norender = false; r.frameNo = 1000; r.tsrReset = true; r.shadowValid = false; for (let i = 0; i < k; i++) r.render(F); window.__sync(); window.__norender = true; }, [key, k]);
  const c0 = cpuNow();
  const wall = await P.ev(([key, n]) => { const r = VR.game.renderer, F = window[key], out = []; window.__norender = false; for (let i = 0; i < n; i++) { const t0 = performance.now(); r.render(F); window.__sync(); out.push(performance.now() - t0); } window.__norender = true; return out; }, [key, n]);
  return { cpuMs: (cpuNow() - c0) / n, wallMs: med(wall) };
};
const enterRaum = async (A, cmd, key, setup) => {
  await A.ev(([cmd, setup]) => { const g = VR.game, p = g.player, SS = VR.SpaceScene, BT = VR.BodyTex; g.env.day = 2; g.env.ticks = 6000; if (setup && VR.Fields) Object.assign(VR.Fields, setup); if (cmd === 'herz' && SS && BT) { const sp = BT.toSphere(p.pos[0], p.pos[2]), e = SS.ephemeris(SS.worldTime(2, 6000), {}), s = SS.localSun(e, sp[0], sp[1]); p.yaw = p.viewYaw = SS.yawFor(s.az - 0.3, p.pos[0], p.pos[2]); } g.chat('/raum ' + cmd); }, [cmd, setup || null]);
  const t1 = Date.now(); let st = null;
  for (let i = 0; i < 600; i++) {
    await A.step(3);
    st = await A.ev(() => { const g = VR.game, SS = VR.SpaceScene, need = (SS && SS.cur_need) || []; return g.space ? { ready: g.space.ready, frames: g.space.frames, done: need.filter(s => s.done).length, need: need.length } : { closed: true }; });
    if (st.closed || (st.ready && st.done === st.need && st.frames >= 3)) break;
    if (Date.now() - t1 > 300000) break;
    await A.wait(40);
  }
  await A.ev((key) => { window[key] = window.__F; }, key);
  const m = await picture(A, key, SHOTS + `${PFX}_${key.replace('__F_', '')}_${TAG[A.tag]}.png`, 2);
  const fs0 = await A.ev(() => VR.Fields && VR.Fields.stats ? { chunks: VR.Fields.stats.chunks } : null).catch(() => null);
  await A.ev(() => { if (VR.game.space) VR.game.chat('/raum aus'); }).catch(() => {});
  for (let i = 0; i < 40; i++) { await A.step(2); if (!(await A.ev(() => !!VR.game.space))) break; }
  return { st, shownS: r1((Date.now() - t1) / 1000), draws: m.draws, err: m.err, fields: fs0 };
};

// ---------------------------------------------------------------- the profile by source module
// the debug page has the source text and the same lines as the player page: its markers /* main/x.js */ name the lines
const lineMap = (pagePath) => {
  const at = [], name = [], L = fs.readFileSync(pagePath.replace(/index\.html$/, 'index.debug.html'), 'utf8').split('\n');
  for (let i = 0; i < L.length; i++) { const m = /\/\* (main|shared|studio)\/([\w]+)\.js \*\//.exec(L[i]); if (m) { at.push(i); name.push(m[2]); } }
  return { at, name };
};
const modAt = (M, line) => { let lo = 0, hi = M.at.length - 1, r = -1; while (lo <= hi) { const k = (lo + hi) >> 1; if (M.at[k] <= line) { r = k; lo = k + 1; } else hi = k - 1; } return r < 0 ? '(page)' : M.name[r]; };
const byModule = (prof, M, per) => {
  const node = new Map(); for (const n of prof.nodes) node.set(n.id, n);
  const mods = {}, fns = {}; let total = 0;
  for (let i = 0; i < prof.samples.length; i++) {
    const n = node.get(prof.samples[i]), dt = (prof.timeDeltas[i + 1] !== undefined ? prof.timeDeltas[i + 1] : 0) / 1000, cf = n.callFrame;
    let mod;
    if (cf.url && /index\.html$/.test(cf.url)) mod = modAt(M, cf.lineNumber);
    else if (!cf.url) mod = cf.functionName || '(native)';
    else mod = 'other';
    if (mod === '(idle)') continue;
    total += dt; mods[mod] = (mods[mod] || 0) + dt;
    const fk = mod + ' ' + (cf.functionName || '(anon)') + ':' + (cf.lineNumber + 1); fns[fk] = (fns[fk] || 0) + dt;
  }
  const top = (o, k) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, k).map(([m, v]) => [m, Math.round(v / per * 1000) / 1000]);
  return { totalMs: Math.round(total / per * 1000) / 1000, mods: top(mods, 40), fns: top(fns, 30) };
};
// the game's own frame without the draw: n frames of g.loop, dt 16.7 ms, the renderer's draw skipped (critic_vl's __norender)
const logic = async (P, n, prof) => {
  if (prof) { await P.cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await P.cdp.send('Profiler.start'); }
  const c0 = cpuNow();
  const ms = await P.ev((n) => { const g = VR.game, out = []; window.__norender = true; for (let i = 0; i < n; i++) { const t0 = performance.now(); g.last = t0 - 16.7; g.loop(t0); out.push(performance.now() - t0); } return out; }, n);
  const cpuMs = (cpuNow() - c0) / n;
  const r = { wallMs: r3(ms.reduce((a, b) => a + b, 0) / n), medMs: r3(med(ms)), maxMs: r1(Math.max(...ms)), cpuMs: r3(cpuMs) };
  if (prof) r.prof = byModule((await P.cdp.send('Profiler.stop')).profile, P.map, n);
  return r;
};
const heapMB = async (P) => { try { await P.cdp.send('HeapProfiler.collectGarbage'); } catch (e) { /* none */ } return P.ev(() => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null)); };

// ---------------------------------------------------------------- run
for (const b of BUILDS) {   // (critic_vl: each build's title once on Very Low first, closed again — the cold caches)
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, locale: 'de-DE' }), page = await ctx.newPage();
  try {
    await page.goto('file://' + b.path);
    for (let i = 0; i < 160; i++) { await page.waitForTimeout(500); if (await page.evaluate(() => !!(window.VR && VR.game && VR.game.state === 'title')).catch(() => false)) break; }
    await page.evaluate(() => { const g = VR.game; g.applyPreset('potato'); g.settings.dynRes = false; g.applySettings('*'); }).catch(() => 0);
    await page.waitForTimeout(3000);
  } catch (e) { console.log('  (warm-up: ' + e.message.slice(0, 80) + ')'); }
  await ctx.close();
}
console.log(`warmed (${secs()})`);
const PAGES = [];
for (const b of BUILDS) {
  const P = await openWorld('file://' + b.path, b.tag); P.map = lineMap(b.path); PAGES.push(P);
  const lp = byModule(P.loadProf, P.map, 1); delete P.loadProf;
  rec.pages[b.tag] = { loadS: r1(P.loadS), info: P.info, loadProf: lp };
  console.log(`${b.tag}: ${P.ok ? 'play' : 'NOT play'} after ${r1(P.loadS)} s · main thread ${Math.round(lp.totalMs)} ms busy: ` + lp.mods.slice(0, 10).map(([m, v]) => `${m} ${Math.round(v)}`).join(', ') + ` (${secs()})`);
  check(P.ok, `${b.tag}: the world is there`);
  save();
}
// the plaza (critic_vl's: light2.mjs's 'temple' eye) settled, posed, the frame kept and pictured
for (const P of PAGES) {
  const x = 4.5, z = 74.5, at = [0, 93, 0], fov = 70;
  await P.ev(([x, z]) => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(x, 160, z); }, [x, z]);
  await P.holdFar(true); await P.settle(240, 0); await P.holdFar(false);
  const feet = (await P.groundY(x, z, 200)) + 1, [yaw, pitch] = aimAt(x, feet + EYE, z, at);
  await P.pose(x, feet, z, yaw, pitch, fov);
  const s1 = await P.settle(240, 20); await P.step(4); await P.warmVx(); await P.step(3);
  await P.ev(() => { window.__F_plaza = window.__F; });
  const m = await picture(P, '__F_plaza', SHOTS + `${PFX}_plaza_${P.tag}.png`, 2);
  const R = rec.pages[P.tag]; R.plaza = { draws: m.draws, tris: m.tris, err: m.err, settle: s1 && s1.s, heapMB: await heapMB(P) };
  console.log(`  ${P.tag} plaza: ${m.err ? 'ERR ' + m.err : m.draws + ' draws, ' + m.tris + ' tris'} · heap ${R.plaza.heapMB} MB (${secs()})`);
  save();
}
// the rounds in turns (the order turns each round): the plaza's kept frame drawn, then the game's frame without the draw
const W = {}; for (const P of PAGES) W[P.tag] = { r: [], rc: [], l: [], lc: [], o: [], oc: [], ol: [] };
for (let rd = 0; rd < ROUNDS; rd++) {
  const order = PAGES.map((_, i) => PAGES[(i + rd) % PAGES.length]);
  for (const P of order) { const c = await cost(P, '__F_plaza', 2, N); W[P.tag].r.push(c.wallMs); W[P.tag].rc.push(c.cpuMs); }
  for (const P of order) { const c = await logic(P, 300, false); W[P.tag].l.push(c.wallMs); W[P.tag].lc.push(c.cpuMs); }
  console.log(`  round ${rd + 1}/${ROUNDS}: ` + PAGES.map(P => `${P.tag} draw ${r1(W[P.tag].r[rd])} · logic ${r3(W[P.tag].l[rd])} ms`).join(' | ') + ` (${secs()})`);
}
// the profile of FR frames on each page
for (const P of PAGES) {
  const c = await logic(P, FR, true);
  rec.pages[P.tag].logicProf = c;
  console.log(`  ${P.tag} logic ×${FR}: ${c.wallMs} ms a frame (median ${c.medMs}, max ${c.maxMs}) · profiled ${c.prof.totalMs} ms: ` + c.prof.mods.slice(0, 14).map(([m, v]) => `${m} ${v}`).join(', '));
  save();
}
// the orbit (/raum herz) on each page, its kept frame in turns
if (!process.env.NO_SPACE) {
  for (const P of PAGES) { try { const s = await enterRaum(P, 'herz', '__F_orbit'); rec.pages[P.tag].orbit = { draws: s.draws, err: s.err, shownS: s.shownS }; } catch (e) { rec.pages[P.tag].orbit = { err: String(e.message || e).slice(0, 200) }; } }
  for (let rd = 0; rd < ROUNDS; rd++) {
    const order = PAGES.map((_, i) => PAGES[(i + rd) % PAGES.length]);
    for (const P of order) { if (rec.pages[P.tag].orbit.err) continue; const c = await cost(P, '__F_orbit', 2, N); W[P.tag].o.push(c.wallMs); W[P.tag].oc.push(c.cpuMs); }
  }
}
// the table: medians; the ratios to the base (v0556) by round
const BASE = process.env.BASE || 'v0556', CUR = process.env.CUR || 'cur';
const ratioMed = (a, b) => r3(med(a.map((x, i) => x / b[i])));
for (const P of PAGES) {
  const w = W[P.tag], R = rec.pages[P.tag], B = W[BASE];
  R.table = { drawMs: r1(med(w.r)), drawCpu: r1(med(w.rc)), logicMs: r3(med(w.l)), logicCpu: r3(med(w.lc)), orbitMs: r1(med(w.o)), orbitCpu: r1(med(w.oc)), rounds: w };
  if (B) R.vsBase = { draw: ratioMed(w.r, B.r), drawCpu: ratioMed(w.rc, B.rc), logic: ratioMed(w.l, B.l), logicCpu: ratioMed(w.lc, B.lc), orbit: w.o.length === B.o.length ? ratioMed(w.o, B.o) : null, orbitCpu: w.oc.length === B.oc.length ? ratioMed(w.oc, B.oc) : null };
  console.log(`  ${P.tag}: load ${R.loadS} s · heap ${R.plaza && R.plaza.heapMB} MB · plaza draw ${R.table.drawMs} ms (CPU ${R.table.drawCpu}) · logic ${R.table.logicMs} ms (CPU ${R.table.logicCpu}) · orbit ${R.table.orbitMs} ms (CPU ${R.table.orbitCpu}) · vs ${BASE} ${JSON.stringify(R.vsBase)}`);
}
save();
const C = rec.pages[CUR];
if (C && C.vsBase && rec.pages[BASE]) {
  check(C.vsBase.drawCpu <= 1.03 && C.vsBase.draw <= 1.03, `plaza draw not slower than ${BASE} (×${C.vsBase.draw}, CPU ×${C.vsBase.drawCpu} ≤ 1.03)`);
  check(C.vsBase.logic <= 1.03, `the game's frame (no draw) not slower than ${BASE} (×${C.vsBase.logic}, CPU ×${C.vsBase.logicCpu} ≤ 1.03)`);
  if (C.vsBase.orbit !== null) check(C.vsBase.orbit <= 1.03, `orbit not slower than ${BASE} (×${C.vsBase.orbit}, CPU ×${C.vsBase.orbitCpu})`);
  check(C.loadS <= Math.max(13, rec.pages[BASE].loadS * 1.03), `load ${C.loadS} s ≤ 13 s or ${BASE}'s ${rec.pages[BASE].loadS} s`);
  check(C.plaza.heapMB <= rec.pages[BASE].plaza.heapMB * 1.05 + 2, `heap ${C.plaza.heapMB} MB ≤ ${BASE}'s ${rec.pages[BASE].plaza.heapMB} MB (+5 %)`);
  check(C.plaza.draws === rec.pages[BASE].plaza.draws, `the same draws (${C.plaza.draws} / ${rec.pages[BASE].plaza.draws})`);
}
for (const P of PAGES) { const e = P.logs.filter(l => l.startsWith('[pageerror]')); check(e.length === 0, `${P.tag}: no page error (${e.length})` + (e.length ? ': ' + e[0].slice(0, 300) : '')); await P.ctx.close().catch(() => {}); }
await browser.close();
save();
console.log(`\n${fails ? 'FAILED ' + fails : 'ALL OK'} (${secs()})`);
process.exit(fails ? 1 : 0);

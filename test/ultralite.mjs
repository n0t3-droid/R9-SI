// F9 · Ultra für schwache PCs („Ultra · Leicht", plan docs/superpowers/plans/2026-10-08-f-ultralite.md): Ultra vs Ultra-Lite
// (and Very Low before / after) in the same world, seed 4242 (Nova Haven, vgen 8), noon, 1280 × 720, SwiftShader.
//   scenes   hall (the Hangar Hall's door), plaza (the Nova Haven fork, trailer_city F1), village (the nearest village)
//   per scene and preset: the frame (synced by a one-texel read), the passes (each timed alone: synced at its ends), draw calls by pass,
//            triangles, a full shadow-map redraw, the picture test/shots/ultralite_<scene>_<preset>_<TAG>.png
//   walks    stream: 200 m south from the hall, nothing drawn, every frame's main-thread time = the loop + the worker
//            messages handled since the last frame (a frame over 40 ms is a hitch); shadow: 60 m back north with the
//            time running, only the shadow work drawn — redraws, ms per frame (mean / max)
// usage: DIST=file:///…/index.html TAG=before PRESETS=ultra,potato bash test/wt_run.sh ultralite.mjs 3600
//   PRESETS (default ultra,ultraLite,potato; 'ultra+shadowTakt' turns a switch on over a preset) · SCENES=hall,plaza,village
//   WALK=0 skips the walks · N=3 timed frames · RD=8 the render distance of every preset (one worker on this machine)
// regress: skip  (developing: the gate is added with the preset)
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const TAG = process.env.TAG || 'after', N = +(process.env.N || 3);
const DIST = process.env.DIST || 'file:///home/claude/vr/dist/index.html';
const PRESETS = (process.env.PRESETS || 'ultra,ultraLite,potato').split(',');
const SCENES = (process.env.SCENES || 'hall,plaza,village').split(',');
const WALK = process.env.WALK !== '0';
const RD = +(process.env.RD || 8);   // (the render distance of every preset here: this 2-CPU machine has one worker, Ultra's 16 would take many minutes a scene)
const NOON = 6000;
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail|missing/i.test(s)) logs.push(`[${t}] ${s.slice(0, 700)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto(DIST);
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
// the render stub: __norender draws nothing (setupCamera only); __shadowOnly also runs the frame's shadow work (the
// visible list, the VX detail uploads and the shadow update, as render() does them), timed with the sync
const stub = () => ev(() => {
  const g = VR.game, r = g.renderer;
  if (r._render) return;
  // (gl.finish alone returns before the GPU process has drawn: a one-texel read of the screen waits for everything before it)
  window.__px = new Uint8Array(4);
  window.__sync = () => { const gl = r.gl, d = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING), rd = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, window.__px); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, d); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, rd); };
  r._render = r.render;
  window.__shMs = 0; window.__shN = 0; window.__shMax = 0;
  r.render = function (F) {
    if (!window.__norender) return this._render(F);
    this.setupCamera(F.cam);
    if (!window.__shadowOnly || !F.world) return;
    const gl = this.gl;
    this.frameNo++;
    const vis = this.collectVisible(F.world, F.cam);
    this.vxResidency(vis, [F.cam.x, F.cam.y, F.cam.z]);
    window.__sync(); const t0 = performance.now();
    if (this.shadowFrame) this.shadowFrame(F.world, F.env, F.cam);
    else { const on = (this.frameNo % (this.q.shadowEvery || 1) === 0 || !this.shadowValid) ? this.renderShadows(F.world, F.env) : this.shadowValid; this.shadowValid = on; }
    window.__sync(); const ms = performance.now() - t0; void gl;
    window.__shMs += ms; window.__shN++; window.__shMax = Math.max(window.__shMax, ms);
  };
});
// the pass timers and the draw-call counters (installed once; on only while a frame is measured)
const instrument = () => ev(() => {
  const g = VR.game, r = g.renderer, gl = r.gl;
  if (window.__pass) return;
  const P = window.__pass = { on: false, ms: {}, calls: {}, sub: {}, cat: [] };
  const timed = (obj, name, key) => {
    const f = obj && obj[name]; if (!f || f.__w) return;
    const w = function (...a) {
      if (!P.on || P.cat.length) return f.apply(this, a);   // nested: counted with the outer pass
      window.__sync(); const t0 = performance.now(); P.cat.push(key);
      try { return f.apply(this, a); } finally { P.cat.pop(); window.__sync(); P.ms[key] = (P.ms[key] || 0) + performance.now() - t0; }
    };
    w.__w = 1; obj[name] = w;
  };
  for (const [n, k] of [['renderShadows', 'shadow'], ['shadowFrame', 'shadow'], ['reflectPass', 'refl'], ['drawProps', 'props'], ['drawClouds', 'clouds'], ['post', 'post'], ['superRes', 'tsr'], ['drawSections', 'terrain'], ['farComposite', 'farcache'], ['farRefresh', 'farcache']]) timed(r, n, k);
  if (g.horizon) timed(g.horizon, 'draw', 'far');
  const count = (k, sub) => { if (!P.on) return; const c = P.cat[0] || 'scene'; P.calls[c] = (P.calls[c] || 0) + 1; if (sub) P.sub[c] = (P.sub[c] || 0) + sub; };
  for (const fn of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) { const f = gl[fn].bind(gl); gl[fn] = (...a) => { count(fn); return f(...a); }; }
  const md = gl.getExtension('WEBGL_multi_draw');
  if (md) for (const fn of ['multiDrawArraysWEBGL', 'multiDrawElementsWEBGL', 'multiDrawArraysInstancedWEBGL', 'multiDrawElementsInstancedWEBGL']) { if (!md[fn]) continue; const f = md[fn].bind(md); md[fn] = (...a) => { count(fn, a[a.length - 1]); return f(...a); }; }
  // the game's own draws (entities, villagers, ships …) are a pass of their own
  const R0 = r.render;
  r.render = function (F) {
    if (P.on && F) {
      for (const [k, key] of [['drawOpaque', 'things'], ['drawTranslucent', 'thingsT']]) {
        const f = F[k]; if (!f) continue;
        F[k] = (rr, E) => { if (P.cat.length) return f(rr, E); window.__sync(); const t0 = performance.now(); P.cat.push(key); try { return f(rr, E); } finally { P.cat.pop(); window.__sync(); P.ms[key] = (P.ms[key] || 0) + performance.now() - t0; } };
      }
    }
    return R0.call(this, F);
  };
});
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(4); } };
const settle = async (max = 60) => { for (let i = 0; i < max; i++) { await step(10); const s = await ev(() => { const g = VR.game, w = g.world; let dirty = 0; for (const c of w.cols.values()) for (const sc of c.sec) if (sc.dirty || sc.pending) dirty++; const p = g.player, rd = Math.max(1, (w.renderDist | 0) - 1), pcx = Math.floor(p.pos[0]) >> 4, pcz = Math.floor(p.pos[2]) >> 4; let unshown = 0; for (let dz = -rd; dz <= rd; dz++) for (let dx = -rd; dx <= rd; dx++) { if (dx * dx + dz * dz > rd * rd) continue; const c = w.col(pcx + dx, pcz + dz); if (!c || !(c.shownAt >= 0)) unshown++; } return { busy: g.pool.busy, pend: w.pending.size, dirty, up: w.uploadQ ? w.uploadQ.size : 0, fading: w.fading ? w.fading.size : 0, unshown }; }); if (s.busy === 0 && s.pend === 0 && s.dirty === 0 && s.up === 0 && s.fading === 0 && s.unshown === 0 && i > 2) return true; await wait(60); } return false; };
const warmVx = () => ev(() => {
  const g = VR.game, r = g.renderer, p = g.player; if (!r.vxResidency || !g.world) return -1;
  const cam = [p.pos[0], p.pos[1] + (p.eye || 1.62), p.pos[2]], list = [];
  for (const c of g.world.cols.values()) for (const s of c.sec) if (s && s.hasMesh) list.push(s);
  const D = (r.q && r.q.vxLod) || 48, up2 = D * D; let n = 0;
  for (; n < 600; n++) { let w8 = 0; for (const s of list) { if (!s.vxData || s.mesh[3]) continue; const dx = s.ox + 8 - cam[0], dy = s.oy + 8 - cam[1], dz = s.oz + 8 - cam[2]; if (dx * dx + dy * dy * 0.5 + dz * dz < up2) w8++; } if (!w8) break; r.vxResidency(list, cam); }
  return n;
});
const groundY = (x, z) => ev(([x, z]) => { const w = VR.game.world, R = VR.R, F = VR.F; for (let y = 160; y > 30; y--) { const s = w.getBlock(Math.floor(x), y, Math.floor(z)); if (s && (R.T.flags[s] & F.OPAQUE) && !(R.T.flags[s] & F.LEAVES)) return y; } return 80; }, [x, z]);
const place = async (x, z, eye, yaw, pitch) => {
  await ev(([x, z]) => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(x, 130, z); }, [x, z]);
  const ok0 = await settle(400);
  const feet = typeof eye === 'object' ? eye.y : (await groundY(x, z)) + 1 + (eye - 1.62);
  await ev(([x, y, z, yaw, pitch]) => { const g = VR.game, p = g.player; p.flying = true; p.noclip = true; p.teleport(x, y, z); p.yaw = yaw; p.pitch = pitch; p.fovKick = 0; p.vel = [0, 0, 0]; g.settings.fov = 75; g.env.setTime(6000); const e = g.entities; if (e && e.mobs) e.mobs.length = 0; }, [x, feet, z, yaw, pitch]);
  const ok1 = await settle(400); await step(6);
  if (!ok0 || !ok1) console.log(`  (not settled: ${ok0} ${ok1})`);
  return feet;
};
// one measured frame: the whole frame, then its passes (each alone: synced at its ends) and its draw calls
const measure = async () => {
  await warmVx();
  await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } window.__sync(); });
  const frames = [];
  for (let i = 0; i < N; i++) frames.push(await ev(() => { const g = VR.game, r = g.renderer; window.__sync(); const t0 = performance.now(); g.last = t0 - 33; g.loop(t0); window.__sync(); return { ms: performance.now() - t0, draws: r.stats.draws, tris: r.stats.tris, sh: r.stats.shadowTiles || 0 }; }));
  const passes = await ev(() => { const g = VR.game, P = window.__pass; P.ms = {}; P.calls = {}; P.sub = {}; P.on = true; window.__sync(); const t0 = performance.now(); g.last = t0 - 33; g.loop(t0); window.__sync(); const ms = performance.now() - t0; P.on = false; return { ms, pass: P.ms, calls: P.calls, sub: P.sub }; });
  const full = await ev(() => { const g = VR.game, r = g.renderer, gl = r.gl; if (!r.q.shadows) return null; const E = g.env.E; window.__sync(); const t0 = performance.now(); if (r.shadowFrame) { if (r.sht) r.sht.front.ok = false; r.shadowValid = false; r.shadowFrame(g.world, E, r.cam); } else { r.shadowValid = false; r.renderShadows(g.world, E); } window.__sync(); return performance.now() - t0; });
  await ev(() => { window.__norender = true; });
  const ms = frames.map(f => f.ms).sort((a, b) => a - b);
  const r1 = (x) => Math.round(x * 10) / 10;
  const pass = {}; let sum = 0; for (const k in passes.pass) { pass[k] = r1(passes.pass[k]); sum += passes.pass[k]; } pass.rest = r1(passes.ms - sum);
  return { frameMs: r1(ms[ms.length >> 1]), frames: ms.map(r1), draws: frames[frames.length - 1].draws, tris: Math.round(frames[frames.length - 1].tris / 1000) + 'k', passMs: r1(passes.ms), pass, calls: passes.calls, sub: passes.sub, fullShadowMs: full === null ? null : r1(full) };
};
const shot = async (name) => {
  const path = `/home/claude/vr/test/shots/ultralite_${name}_${TAG}.png`;
  await warmVx();
  await ev(() => { window.__norender = false; const g = VR.game, V = g.villages, p = g.player; const keep = V && V.agents ? V.agents : null; if (keep) V.agents = keep.filter(a => Math.hypot(a.pos[0] - p.pos[0], a.pos[2] - p.pos[2]) > 12); for (let i = 0; i < 4; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } window.__sync(); if (keep) V.agents = keep; window.__norender = true; });
  await page.screenshot({ path, timeout: 180000 });
  return fs.existsSync(path);
};
// the walk: the eye 1.62 above the ground, 4.3 m/s, 30 frames a second of game time; every frame is one setTimeout so the
// worker messages are handled between frames as in the game
const walk = (from, to, opts) => ev(([from, to, o]) => new Promise((ok) => {
  const g = VR.game, p = g.player, w = g.world, R = VR.R, F = VR.F;
  const pool = g.pool;
  if (!pool.__onMsg) { pool.__onMsg = pool.onMsg; window.__msgMs = 0; window.__msgN = 0; window.__msgBy = {}; pool.onMsg = function (wk, m) { const t0 = performance.now(); try { return this.__onMsg(wk, m); } finally { const dt = performance.now() - t0; window.__msgMs += dt; window.__msgN++; const k = (m && m.type) || '?', b = window.__msgBy[k] || (window.__msgBy[k] = [0, 0, 0]); b[0]++; b[1] += dt; b[2] = Math.max(b[2], dt); } }; }
  window.__msgBy = {};
  // the column's arrival on the main thread, part by part (world.onColumn, its seam light, the dirtying)
  if (!w.__onColumn) { const wrap = (name) => { const f = w[name]; w['__' + name] = f; w[name] = function (...a) { const t0 = performance.now(); try { return f.apply(this, a); } finally { const dt = performance.now() - t0, b = window.__msgBy['w.' + name] || (window.__msgBy['w.' + name] = [0, 0, 0]); b[0]++; b[1] += dt; b[2] = Math.max(b[2], dt); } }; }; for (const n of ['onColumn', 'seamLight', 'flushChanged', 'integrate']) if (w[n]) wrap(n); }
  const gy = (x, z, y0) => { for (let y = Math.min(250, Math.floor(y0) + 12); y > 30; y--) { const s = w.getBlock(Math.floor(x), y, Math.floor(z)); if (s && (R.T.flags[s] & F.OPAQUE) && !(R.T.flags[s] & F.LEAVES)) return y + 1; } return y0; };
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]), n = Math.ceil(len / 4.3 * 30);
  window.__norender = true; window.__shadowOnly = !!o.shadow; window.__shMs = 0; window.__shN = 0; window.__shMax = 0;
  g.zenFreezeTime = !o.time;
  const r = g.renderer, red0 = r.stats.shadowRenders || 0, cols0 = w.cols.size;
  const out = { frames: 0, long: 0, max: 0, sum: 0, msgMax: 0, list: [] };
  let i = 0, y = p.pos[1];
  window.__msgMs = 0; window.__msgN = 0;
  const f = () => {
    const msg = window.__msgMs; window.__msgMs = 0;
    const k = i / n, x = from[0] + (to[0] - from[0]) * k, z = from[1] + (to[1] - from[1]) * k;
    y = gy(x, z, y);
    p.flying = true; p.noclip = true; p.teleport(x, y, z); p.yaw = Math.atan2(-(to[0] - from[0]), -(to[1] - from[1])); p.pitch = -0.05;
    const t0 = performance.now(); g.last = t0 - 33.3; g.loop(t0); const loopMs = performance.now() - t0;
    const fm = loopMs + msg;
    out.frames++; out.sum += fm; out.max = Math.max(out.max, fm); out.msgMax = Math.max(out.msgMax, msg); if (fm > 40) out.long++; out.list.push(Math.round(fm));
    if (++i <= n) setTimeout(f, 0);
    else { window.__shadowOnly = false; g.zenFreezeTime = true; out.list.sort((a, b) => b - a); out.top = out.list.slice(0, 8); delete out.list; out.mean = Math.round(out.sum / out.frames * 10) / 10; delete out.sum; out.max = Math.round(out.max); out.msgMax = Math.round(out.msgMax); out.redraws = (r.stats.shadowRenders || 0) - red0; out.shMs = Math.round(window.__shMs); out.shMean = Math.round(window.__shMs / Math.max(1, window.__shN) * 10) / 10; out.shMax = Math.round(window.__shMax); out.cols = w.cols.size - cols0; out.secs = Math.round(n / 30 * 10) / 10; out.by = {}; for (const k in window.__msgBy) { const b = window.__msgBy[k]; out.by[k] = [b[0], Math.round(b[1]), Math.round(b[2])]; } ok(out); }
  };
  f();
}), [from, to, opts || {}]);

for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
const have = await ev(() => Object.keys(VR.Game.PRESETS || {}));
console.log(TAG, 'presets in this build:', have.join(' '));
await ev(() => { const g = VR.game; g.applyPreset('high'); g.settings.dynRes = false; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Ultra Leicht',mode:'creative',difficulty:'peaceful',type:'default',seed:'4242',cheats:true,kit:true})`);
for (let i = 0; i < 150; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
check(await ev(() => VR.game.state) === 'play', `${TAG}: the world is loaded`);
await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; for (const id of ['hud', 'ui']) { const h = document.getElementById(id); if (h) h.style.display = 'none'; } g.env.setTime(6000); });
await stub(); await instrument();
// the village: the nearest village site that is not Nova Haven itself
const vil = await ev(() => new Promise((ok) => VR.game.pool.direct(0, { type: 'villages', dim: 'overworld', x: 0, z: -60, r: 2500 }, null, (m) => ok((m.list || []).map(s => [s.x, s.z, s.name || s.id, s.kind || s.style || ''])))));
console.log('village sites', JSON.stringify(vil.slice(0, 12)));
const vsite = vil.filter(s => Math.hypot(s[0] - 0, s[1] + 60) > 200).sort((a, b) => Math.hypot(a[0], a[1] + 60) - Math.hypot(b[0], b[1] + 60))[0] || [300, 300, '?'];
console.log('village site', JSON.stringify(vsite), 'of', vil.length);
const CAM = {
  hall: [0.5, -9.5, { y: 81 }, Math.PI, 0],
  plaza: [3.5, -96.5, 1.62, 0.3, 0.03],
  village: [vsite[0] + 22.5, vsite[1] + 22.5, 1.62, Math.atan2(22.5, 22.5), -0.06],
};
const results = {};
for (const preset of PRESETS) {
  const [pname, ...sw] = preset.split('+');
  if (!have.includes(pname)) { console.log(`${TAG}: no preset ${pname} in this build — skipped`); continue; }
  await ev(([p, sw, rd]) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.renderDist = rd; for (const k of sw) g.settings[k] = true; g.applySettings('*'); }, [pname, sw, RD]);
  console.log(`== ${TAG} ${preset}`);
  results[preset] = {};
  for (const sc of SCENES) {
    const c = CAM[sc]; if (!c) continue;
    const feet = await place(c[0], c[1], c[2], c[3], c[4]);
    const m = await measure();
    results[preset][sc] = m;
    console.log(`  ${sc} (feet ${typeof feet === 'number' ? feet.toFixed(1) : feet}): ${JSON.stringify(m)}`);
    check(await shot(`${sc}_${preset}`), `${TAG} ${preset} ${sc}: the picture is written`);
  }
  if (WALK && pname !== 'potato') {
    await place(0.5, -9.5, 1.62, Math.PI, 0);
    const s = await walk([0.5, -9.5], [0.5, -209.5], {});
    console.log(`  walk-stream ${preset}: ${JSON.stringify(s)}`);
    results[preset].walkStream = s;
    await settle(60);
    const h = await walk([0.5, -209.5], [0.5, -149.5], { shadow: true, time: true });
    console.log(`  walk-shadow ${preset}: ${JSON.stringify(h)}`);
    results[preset].walkShadow = h;
  }
}
fs.writeFileSync(`/home/claude/vr/.tmp_tests/ultralite_${TAG}.json`, JSON.stringify(results, null, 1));
const errs = logs.filter(l => l.startsWith('[pageerror]'));
console.log(`--- ${TAG} logs (${logs.length})`); for (const l of logs.slice(0, 12)) console.log(l);
check(errs.length === 0, `${TAG}: no page error (${errs.length})`);
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

// F10 · Bandbreite (plan docs/superpowers/plans/2026-10-15-f-ipu.md): the five switches measured in one world, seed 4242
// (vgen 8), noon, 1280 × 720, SwiftShader (the CPU draws: relative costs only).
//   scenes   hall (the Hangar Hall's deck), plaza (the Nova Haven fork), lake (the mirror's lake east of the hall) —
//            ultralite.mjs's cameras
//   presets  High, Ultra · Leicht, Very Low (PRESETS=…); at each scene and preset the switches all off, each alone, all on
//   per run  the frame (CPU time of the browser's processes and wall time, every frame synced by a one-texel read), the
//            passes timed alone (post, the copy, the cut-out pass, the terrain), the full-screen passes the renderer
//            counted (stats.fsPasses) and their bytes (stats.fsList, ipu.js bytes), the scene format; the picture of the
//            same view (the clocks pinned, the TSR jitter restarted, what moves left out) and its ΔE (CIE76) against the
//            switches off: mean, the share of pixels above 2.3 (a just noticeable difference), the worst
//   checks   the switches cost less (the frame with all on ≤ all off at High and Ultra · Leicht); the pictures the same
//            (ΔE mean < 1.0); the fallback forced (VR.GL.noFloatColor = true): RGBA16F and the picture of the switches off;
//            zPre: fewer fragments run the full shader; Very Low with the defaults: nothing on (SwiftShader is no iGPU)
//   pictures test/shots/ipu_<scene>_<preset>_<config>_<TAG>.png, the difference maps ipu_<…>_diff_<TAG>.png — LOOK at them
// usage: bash test/wt_run.sh ipu.mjs 3000 · SCENES=hall,plaza,lake PRESETS=high,ultraLite,potato CONFIGS=off,hdrLite,…,all
//   N=3 timed frames · DIST=file:///…/index.html (another build) TAG=before · MODE=quick (the plaza, High, off/hdrLite/all)
//   VIEW=1920x1080 the page at 1080p (texLite: the far mip bias and the skipped material read judged where it shows most)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import sharp from '/home/dev/.npm-global/lib/node_modules/sharp/lib/index.js';
import fs from 'fs';
import { execSync } from 'child_process';
const TAG = process.env.TAG || 'after', N = +(process.env.N || 3), MODE = process.env.MODE || 'full';
const DIST = process.env.DIST || 'file:///home/dev/vr/dist/index.html';
const SW = ['hdrLite', 'postLite', 'zPre', 'texLite'];   // (dprLite changes the backing store: its own check below)
const QUICK = MODE === 'quick';
const SCENES = (process.env.SCENES || (QUICK ? 'plaza' : 'plaza,sun,forest,hall,lake')).split(',');
const PRESETS = (process.env.PRESETS || (QUICK ? 'high' : 'high,ultraLite,potato')).split(',');
const CONFIGS = (process.env.CONFIGS || (QUICK ? 'off,hdrLite,all' : ['off', ...SW, 'all'].join(','))).split(',');
const RD = +(process.env.RD || 8), VGEN = +(process.env.VGEN || 8);
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const r1 = (x) => Math.round(x * 10) / 10, r2 = (x) => Math.round(x * 100) / 100;
const shotPath = (name) => `/home/dev/vr/test/shots/ipu_${name}_${TAG}.png`;
// the CPU time (ms) of this test's browser processes (utime + stime of every process below this node process): what a
// frame costs a weak PC, hardly moved by the other agents' load on this shared machine (ultralite.mjs)
const cpuNow = () => {
  const kids = new Map();
  for (const l of execSync('ps -e -o pid=,ppid=').toString().trim().split('\n')) { const [p, pp] = l.trim().split(/\s+/).map(Number); if (!kids.has(pp)) kids.set(pp, []); kids.get(pp).push(p); }
  let t = 0; const st = [process.pid];
  while (st.length) { for (const c of kids.get(st.pop()) || []) { st.push(c); try { const s = fs.readFileSync(`/proc/${c}/stat`, 'utf8'), f = s.slice(s.lastIndexOf(')') + 2).split(' '); t += +f[11] + +f[12]; } catch (e) { } } }
  return t * 10;
};
// ---- ΔE (CIE76) of two sRGB pictures, per pixel: mean, the share above 2.3 (just noticeable), the worst; a difference map
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
const dE = async (a, b, mapName) => {
  const A = await sharp(shotPath(a)).raw().toBuffer({ resolveWithObject: true }), B = await sharp(shotPath(b)).raw().toBuffer({ resolveWithObject: true });
  const da = A.data, db = B.data, C = A.info.channels, n = A.info.width * A.info.height;
  const la = [0, 0, 0], lb = [0, 0, 0], map = Buffer.alloc(n * 3);
  let s = 0, over = 0, worst = 0, sx = 0, sy = 0, sw = 0;
  for (let i = 0; i < n; i++) {
    lab(da[i * C], da[i * C + 1], da[i * C + 2], la); lab(db[i * C], db[i * C + 1], db[i * C + 2], lb);
    const d = Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]);
    s += d; if (d > 2.3) { over++; sx += i % A.info.width; sy += Math.floor(i / A.info.width); sw++; } if (d > worst) worst = d;
    const v = Math.min(255, Math.round(d * 25)); map[i * 3] = v; map[i * 3 + 1] = v; map[i * 3 + 2] = v;
  }
  if (mapName) await sharp(map, { raw: { width: A.info.width, height: A.info.height, channels: 3 } }).png().toFile(shotPath(mapName));
  return { mean: r2(s / n), over: r2(100 * over / n), worst: r1(worst), at: sw ? [Math.round(sx / sw), Math.round(sy / sw)] : null };
};

const openPage = async (vw, vh) => {
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, locale: 'de-DE' });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail|missing|incomplete/i.test(s)) logs.push(`[${t}] ${s.slice(0, 700)}`); });
  page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
  await page.goto(DIST);
  return { page, logs, ctx };
};
const [VW, VH] = (process.env.VIEW || '1280x720').split('x').map(Number);   // (VIEW=1920x1080: texLite's pictures at 1080p)
const { page, logs } = await openPage(VW, VH);
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);

// ---- the render stub (frames stepped without drawing while the world settles), the sync, the pass timers
const instrument = () => ev(() => {
  const g = VR.game, r = g.renderer, gl = r.gl;
  if (window.__pass) return;
  window.__px = new Uint8Array(4);
  window.__sync = () => { const d = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING), rd = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, window.__px); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, d); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, rd); };
  const P = window.__pass = { on: false, ms: {}, cat: [], fs: 0, blit: 0 };
  const timed = (obj, name, key) => {
    const f = obj && obj[name]; if (!f || f.__w) return;
    const w = function (...a) {
      if (!P.on || P.cat.length) return f.apply(this, a);
      window.__sync(); const t0 = performance.now(); P.cat.push(key);
      try { return f.apply(this, a); } finally { P.cat.pop(); window.__sync(); P.ms[key] = (P.ms[key] || 0) + performance.now() - t0; }
    };
    w.__w = 1; obj[name] = w;
  };
  for (const [n, k] of [['shadowFrame', 'shadow'], ['reflectPass', 'refl'], ['drawProps', 'props'], ['drawClouds', 'clouds'], ['post', 'post'], ['superRes', 'tsr'], ['farFrame', 'farcache'], ['refrCopy', 'copy'], ['zPrepass', 'zpre']]) timed(r, n, k);
  // the terrain's passes by layer (drawSections' second argument), the cut-out one with its prepass
  const ds = r.drawSections;
  if (!ds.__w) {
    r.drawSections = function (list, layer, ...a) {
      if (!P.on || P.cat.length) return ds.call(this, list, layer, ...a);
      const key = 'terrain' + layer;
      window.__sync(); const t0 = performance.now(); P.cat.push(key);
      try { return ds.call(this, list, layer, ...a); } finally { P.cat.pop(); window.__sync(); P.ms[key] = (P.ms[key] || 0) + performance.now() - t0; }
    };
    r.drawSections.__w = 1;
  }
  const fs0 = r.fs; r.fs = function (p) { if (P.on) P.fs++; return fs0.call(this, p); };
  const bl = gl.blitFramebuffer.bind(gl); gl.blitFramebuffer = (...a) => { if (P.on) P.blit++; return bl(...a); };
  r._render = r.render;
  r.render = function (F) {
    if (window.__still && F) { F.drawOpaque = null; F.drawTranslucent = null; F.particles = null; }
    if (window.__norender) { this.setupCamera(F.cam); return; }
    return this._render(F);
  };
});
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(4); } };
let lastSettle = null;
const settle = async (max = 60) => { for (let i = 0; i < max; i++) { await step(10); const s = await ev(() => { const g = VR.game, w = g.world; const p = g.player, rd = Math.max(1, (w.renderDist | 0) - 1), pcx = Math.floor(p.pos[0]) >> 4, pcz = Math.floor(p.pos[2]) >> 4; let dirty = 0; for (const c of w.cols.values()) { const ex = c.cx - pcx, ez = c.cz - pcz; if (ex * ex + ez * ez > rd * rd) continue; for (const sc of c.sec) if (sc.dirty || sc.pending) dirty++; } let unshown = 0; for (let dz = -rd; dz <= rd; dz++) for (let dx = -rd; dx <= rd; dx++) { if (dx * dx + dz * dz > rd * rd) continue; const c = w.col(pcx + dx, pcz + dz); if (!c || !(c.shownAt >= 0)) unshown++; } return { busy: g.pool.busy, pend: w.pending.size, dirty, up: w.uploadQ ? w.uploadQ.size : 0, fading: w.fading ? w.fading.size : 0, unshown, arr: w.arrivals ? w.arrivals.length : 0 }; }); lastSettle = s; if (s.busy === 0 && s.pend === 0 && s.dirty === 0 && s.up === 0 && s.fading === 0 && s.unshown === 0 && s.arr === 0 && i > 2) return true; await wait(60); } return false; };
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
const groundY = (x, z) => ev(([x, z]) => { const w = VR.game.world, R = VR.R, F = VR.F; for (let y = 160; y > 30; y--) { const s = w.getBlock(Math.floor(x), y, Math.floor(z)); if (s && (R.T.flags[s] & F.OPAQUE) && !(R.T.flags[s] & F.LEAVES)) return y; } return 80; }, [x, z]);
const place = async (x, z, eye, yaw, pitch, max = 400) => {
  await ev(([x, z]) => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(x, 130, z); }, [x, z]);
  const ok0 = await settle(max);
  const feet = typeof eye === 'object' ? eye.y : (await groundY(x, z)) + 1 + (eye - 1.62);
  await ev(([x, y, z, yaw, pitch]) => { const g = VR.game, p = g.player; p.flying = true; p.noclip = true; p.teleport(x, y, z); p.yaw = yaw; p.pitch = pitch; p.fovKick = 0; p.vel = [0, 0, 0]; g.settings.fov = 75; g.env.setTime(6000); const e = g.entities; if (e && e.mobs) e.mobs.length = 0; }, [x, feet, z, yaw, pitch]);
  const ok1 = await settle(400); await step(6);
  if (!ok0 || !ok1) console.log(`  (not settled: ${ok0} ${ok1} — ${JSON.stringify(lastSettle)})`);
  return feet;
};
// the forest (zPre's scene: the cut-out layer's leaves, grass and flowers fill the view): 63 oaks and birches on the grass
// east of the lake, short grass and poppies between them — built once into the world (bulkSet), then meshed
const forest = () => ev(() => {
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
let forestBuilt = false;
const holdFar = (on) => ev((on) => { const pool = VR.game.pool; if (on) pool.__heldFar = (pool.__heldFar || []).concat(pool.queueFar.splice(0)); else if (pool.__heldFar) { for (const j of pool.__heldFar) pool.queueFar.push(j); pool.__heldFar = null; pool.queueDirty = true; if (pool.pump) pool.pump(); } return pool.queueFar.length + (pool.__heldFar ? pool.__heldFar.length : 0); }, on);
const setPreset = (p) => ev(([p, rd]) => { const g = VR.game, own = (VR.Game.PRESETS[p] || {}).renderDist || rd; g.applyPreset(p); g.settings.dynRes = false; g.settings.renderDist = Math.min(rd, own); g.applySettings('*'); return g.settings.renderDist; }, [p, RD]);
// a configuration of the switches straight on the renderer (the settings rows are tested in node): all off, one, all
// (postLite-<part> / texLite-bias: one part off — the rays' mask, the copy, the far mip bias — to tell what each part does)
// all: what an integrated GPU gets on this preset (ipu.js defaults: zPre not on Very Low); all-<switch>: that one off
const config = (c) => ev(([c, SW]) => {
  const r = VR.game.renderer, q = {}, [base, minus] = c.split('-');
  const dflt = VR.IPU && VR.IPU.defaults ? VR.IPU.defaults(VR.game.settings.preset, 'AMD Radeon(TM) Graphics') : {};
  for (const k of SW) q[k] = base === 'all' ? dflt[k] !== false && k !== minus : base === k;
  q.plRays = minus !== 'rays'; q.plCopy = minus !== 'copy'; q.tlBias = minus !== 'bias';   // (texLite-bias: the anisotropy alone)
  r.setQuality(q);
  return { fmt: r.stats.sceneFmt, q: SW.filter(k => r.q[k]).join(',') || 'off' };
}, [c, SW]);
// K frames drawn from the same start: the frame counter (the TSR jitter), the history, the clocks — the same picture
// whatever ran before; then N timed frames (each synced), one instrumented frame, and the picture read back
// the frames of a measurement, each from the same start: the frame counter (the TSR jitter), the history, the clocks
const FRAME = `const g = VR.game, r = g.renderer; window.__norender = false; window.__still = true; const frame = () => { g.env.anim = 500; g.last = performance.now() - 33; g.loop(performance.now()); };`;
// 1 · K frames to build up the picture (TSR's eight jittered frames on Very Low, the far cache's strips on Ultra · Leicht)
const warmUp = (K) => ev(new Function('K', FRAME + `r.frameNo = 1000; r.tsrReset = true; r.shadowValid = false; for (let i = 0; i < K; i++) frame(); window.__sync(); window.__norender = true; window.__still = false;`), K);
// 2 · n timed frames (each synced; the CPU time is taken around this call alone)
const timed = (K, n) => ev(new Function('a', FRAME + `const out = []; for (let i = 0; i < a[1]; i++) { r.frameNo = 1000 + a[0] - 1; const t0 = performance.now(); frame(); window.__sync(); out.push(performance.now() - t0); } window.__norender = true; window.__still = false; return out;`), [K, n]);
// 3 · one frame with every pass timed alone and the full-screen passes logged, one frame counting the cut-out layer's
// fragments (renderer.zCount), then the picture: the same K frames again and the screen read back
const detail = (K) => ev(new Function('K', FRAME + `
  const gl = r.gl, P = window.__pass, out = {};
  r.passLog = true;
  P.ms = {}; P.fs = 0; P.blit = 0; P.on = true; r.frameNo = 1000 + K - 1; window.__sync(); const t0 = performance.now(); frame(); window.__sync(); out.passMs = performance.now() - t0; P.on = false;
  out.pass = P.ms; out.fs = P.fs; out.blit = P.blit; out.draws = r.stats.draws; out.tris = r.stats.tris; out.fmt = r.stats.sceneFmt; out.fsPasses = r.stats.fsPasses; out.fsBytes = r.stats.fsBytes;
  out.fsList = (r.stats.fsList || []).map(x => x.name).join(' ');
  r.passLog = false;
  r.zCount = true; r.frameNo = 1000 + K - 1; frame(); out.counts = r.stats.zCount || null; r.zCount = false;
  r.frameNo = 1000; r.tsrReset = true;
  for (let i = 0; i < K; i++) frame();
  const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, px = new Uint8Array(W * H * 4);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let s = ''; const CH = 0x8000; for (let i = 0; i < px.length; i += CH) s += String.fromCharCode.apply(null, px.subarray(i, i + CH));
  out.png = btoa(s); out.W = W; out.H = H;
  window.__norender = true; window.__still = false;
  return out;`), K);
const measure = async (name, K) => {
  await warmVx();
  await warmUp(K);
  const c0 = cpuNow();
  const ms0 = await timed(K, N);
  const cpuMs = (cpuNow() - c0) / N;
  const m = await detail(K);
  const raw = Buffer.from(m.png, 'base64'); delete m.png;
  // (readPixels is bottom-up: flipped into a picture)
  await sharp(raw, { raw: { width: m.W, height: m.H, channels: 4 } }).flip().removeAlpha().png().toFile(shotPath(name));
  const ms = ms0.slice().sort((a, b) => a - b);
  const pass = {}; for (const k in m.pass) pass[k] = r1(m.pass[k]);
  const fb = m.fsBytes ? { n: m.fsBytes.n, MB: r1(m.fsBytes.all / 1048576), fetchK: Math.round(m.fsBytes.fetch / 1000) } : null;
  return { frameMs: r1(ms[ms.length >> 1]), cpuMs: r1(cpuMs), fs: m.fs, blit: m.blit, fsPasses: m.fsPasses, fsBytes: fb, fsList: m.fsList, draws: m.draws, tris: Math.round(m.tris / 1000) + 'k', fmt: m.fmt, pass, passMs: r1(m.passMs), counts: m.counts };
};

for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
const info = await ev(() => ({ gpu: VR.GL.rendererName, presets: Object.keys(VR.Game.PRESETS || {}), ipu: !!VR.IPU, r11: VR.IPU && VR.GL.ext ? VR.IPU.probe(VR.GL.gl, VR.GL.ext) : null, aniso: VR.GL.ext && VR.GL.ext.aniso ? VR.GL.gl.getParameter(VR.GL.ext.aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 0 }));
console.log(TAG, JSON.stringify(info));
await setPreset('high');
await ev((v) => VR.game.createWorld({ name: 'Bandbreite', mode: 'creative', difficulty: 'peaceful', type: 'default', seed: '4242', cheats: true, kit: true, vgen: v }), VGEN);
for (let i = 0; i < 150; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
check(await ev(() => VR.game.state) === 'play', `${TAG}: the world is loaded`);
await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; for (const id of ['hud', 'ui']) { const h = document.getElementById(id); if (h) h.style.display = 'none'; } g.env.setTime(6000); if (VR.UL && VR.UL.Far) VR.UL.Far.AGE = 1e9; });
await instrument();
const defaults = await ev(() => { const r = VR.game.renderer; return { q: ['hdrLite', 'postLite', 'zPre', 'texLite', 'dprLite'].filter(k => r.q[k]), fmt: r.stats.sceneFmt }; });
check(!info.ipu || defaults.q.length === 0, `${TAG}: the defaults here (SwiftShader, no iGPU, High): no switch on (${defaults.q.join(',') || 'none'}, ${defaults.fmt})`);
const CAM = {
  hall: [0.5, -9.5, { y: 81 }, Math.PI, 0],
  plaza: [3.5, -96.5, 1.62, 0.3, 0.03],
  lake: [220.5, 30.5, { y: 66 }, Math.PI / 2, -0.1],
  sun: [3.5, -96.5, 1.62, 2.74, 0.25],   // (the plaza looking up into the noon sun, 24° high in the south: the god rays on)
  forest: [224.5, 30.5, 1.62, -Math.PI / 2, -0.05],   // (east through the test's forest: forest())
};
const res = { info, scenes: {}, ab: {} };
const save = () => fs.writeFileSync(`/home/dev/vr/.tmp_tests/ipu_${TAG}.json`, JSON.stringify(res, null, 1));
// MODE=ab: the CPU time of two configurations in turns — A B A B … (ROUNDS rounds of N frames each, every block after the
// same K warm-up frames): on this shared machine the load drifts over minutes and a single pair of measurements can be
// 10 % apart; in turns both see the same drift. AB="off:all,off:texLite" · the medians and their ratio
const ROUNDS = +(process.env.ROUNDS || 4);
const abRun = async (sc, p, A, B, K) => {
  const out = { [A]: [], [B]: [] };
  for (let r = 0; r < ROUNDS; r++) for (const cf of (r % 2 ? [B, A] : [A, B])) {
    await config(cf); await warmVx(); await warmUp(K);
    const c0 = cpuNow(); await timed(K, N); out[cf].push((cpuNow() - c0) / N);
  }
  await config('off');
  const med = (a) => { const b = a.slice().sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
  const a = med(out[A]), b = med(out[B]);
  return { A, B, a: r1(a), b: r1(b), ratio: Math.round(b / a * 1000) / 1000, runsA: out[A].map(r1), runsB: out[B].map(r1) };
};
if (MODE === 'ab') {
  const pairs = (process.env.AB || 'off:all').split(',').map(x => x.split(':'));
  for (const sc of SCENES) {
    const c = CAM[sc]; if (!c) continue;
    let first = true;
    for (const p of PRESETS) {
      if (!info.presets.includes(p)) continue;
      await setPreset(p);
      await place(c[0], c[1], c[2], c[3], c[4], first ? 1500 : 400);
      if (sc === 'forest' && !forestBuilt) { const f = await forest(); forestBuilt = true; await settle(400); await step(6); console.log(`  forest: ${f.trees} trees, ${f.blocks} blocks set`); }
      if (first) { await holdFar(true); await settle(300); first = false; }
      const K = p === 'potato' ? 9 : p === 'ultraLite' ? 6 : +(process.env.KH || 3);
      for (const [A, B] of pairs) {
        const m = await abRun(sc, p, A, B, K);
        (res.ab[sc] || (res.ab[sc] = {}))[p + ' ' + A + ':' + B] = m;
        console.log(`  ab ${sc} ${p} ${A} → ${B}: CPU ${m.a} → ${m.b} ms a frame (×${m.ratio}; ${A} ${m.runsA.join(' ')} · ${B} ${m.runsB.join(' ')})`);
        if (p === 'potato' && A === 'off') check(m.ratio <= 1.03, `${sc} Very Low: ${B} costs no more than off (×${m.ratio}, the noise of this machine ±3 %)`);
        save();
      }
    }
    await holdFar(false);
  }
}
for (const sc of MODE === 'ab' ? [] : SCENES) {
  const c = CAM[sc]; if (!c) continue;
  res.scenes[sc] = {};
  let first = true;
  for (const p of PRESETS) {
    if (!info.presets.includes(p)) { console.log(`  no preset ${p} in this build`); continue; }
    if (sc === 'sun' && p !== 'high' && !process.env.PRESETS) continue;   // (the rays' scene: High only)
    const rd = await setPreset(p);
    await place(c[0], c[1], c[2], c[3], c[4], first ? 1500 : 400);
    if (sc === 'forest' && !forestBuilt) { const f = await forest(); forestBuilt = true; await settle(400); await step(6); console.log(`  forest: ${f.trees} trees, ${f.blocks} blocks set`); }
    if (first) { const held = await holdFar(true); await settle(300); console.log(`  ${sc}: the far ring's ${held} queued jobs held`); first = false; }
    const K = p === 'potato' ? 9 : p === 'ultraLite' ? 6 : +(process.env.KH || 3);   // (Very Low's TSR builds its picture over 8 jittered frames; the far cache takes 4 strips)
    const R = res.scenes[sc][p] = {};
    // (each switch alone, and postLite without its bloom fold, at the plaza on High; the rays' part looking into the sun;
    // elsewhere off and all)
    const cfs = process.env.CONFIGS || QUICK ? CONFIGS : p !== 'high' ? ['off', 'all'] : sc === 'plaza' ? ['off', 'hdrLite', 'postLite', 'zPre', 'texLite', 'all'] : sc === 'sun' ? ['off', 'postLite', 'postLite-rays', 'all'] : sc === 'forest' ? ['off', 'zPre', 'texLite', 'all'] : ['off', 'all'];
    for (const cf of cfs) {
      if (!info.ipu && cf !== 'off') continue;   // (an older build: the switches off only)
      const st = info.ipu ? await config(cf) : { fmt: '?', q: 'off' };
      const m = await measure(`${sc}_${p}_${cf}`, K);
      m.q = st.q; R[cf] = m;
      console.log(`  ${sc} ${p} (rd ${rd}) ${cf}: ${JSON.stringify(m)}`);
      if (cf !== 'off' && R.off) {
        m.dE = await dE(`${sc}_${p}_off`, `${sc}_${p}_${cf}`, `${sc}_${p}_${cf}_diff`);
        console.log(`     ΔE against off: ${JSON.stringify(m.dE)} · frame ${R.off.frameMs} → ${m.frameMs} ms, CPU ${R.off.cpuMs} → ${m.cpuMs} ms`);
      }
      save();
    }
    if (info.ipu) await config('off');
    if (R.off && R.off.counts && R.off.counts.one > 0) {
      const c = R.off.counts;
      console.log(`     the cut-out layer's fragments that run the full shader: one pass ${c.one} → after the prepass ${c.pre} (${Math.round(100 * (1 - c.pre / c.one))} % fewer; ${(c.one / c.px).toFixed(3)} → ${(c.pre / c.px).toFixed(3)} a pixel)`);
      check(c.pre <= c.one, `${sc} ${p}: zPre — no more cut-out fragments reach the full shader (${c.one} → ${c.pre})`);
    }
    if (R.all && R.off) {
      check(R.all.dE.mean < 1.0, `${sc} ${p}: the picture with every switch on is the same (ΔE mean ${R.all.dE.mean} < 1.0; ${R.all.dE.over} % of the pixels above 2.3, the worst ${R.all.dE.worst})`);
      if (p !== 'potato') check(R.all.cpuMs <= R.off.cpuMs * 1.02, `${sc} ${p}: every switch on costs no more (CPU ${R.off.cpuMs} → ${R.all.cpuMs} ms a frame)`);
    }
  }
  await holdFar(false);
}
// dprLite in the browser: a screen of 1000 × 563 CSS pixels at dpr 1 — the backing store follows it (off: the window's 1280)
if (info.ipu && !QUICK && MODE !== 'ab') {
  const d = await ev(() => {
    const r = VR.game.renderer, was = Object.getOwnPropertyDescriptor(window, 'screen');
    Object.defineProperty(window, 'screen', { value: { width: 1000, height: 563 }, configurable: true });
    r.setQuality({ dprLite: false }); const off = [r.W, r.H, r.canvas.width];
    r.setQuality({ dprLite: true }); const on = [r.W, r.H, r.canvas.width];
    r.setQuality({ dprLite: false });
    if (was) Object.defineProperty(window, 'screen', was); else delete window.screen;
    return { off, on, back: [r.W, r.H] };
  });
  res.dpr = d;
  check(d.off[0] === 1280 && d.on[0] <= 1000 && d.on[1] <= 563 && d.on[2] === d.on[0] && d.back[0] === 1280, `dprLite: the backing store never larger than the screen (a 1000 × 563 screen: ${d.off.slice(0, 2).join(' × ')} → ${d.on.slice(0, 2).join(' × ')}; off again: ${d.back.join(' × ')})`);
}
// the fallback forced: R11F_G11F_B10F refused → RGBA16F, the picture of the switches off
if (info.ipu && !QUICK && MODE !== 'ab') {
  const sc = SCENES[0], c = CAM[sc];
  await setPreset('high');
  await place(c[0], c[1], c[2], c[3], c[4], 400);
  await config('off');
  const off = await measure(`${sc}_fallback_off`, 4);
  const fb = await ev(() => { VR.GL.noFloatColor = true; const r = VR.game.renderer; r.setQuality({ hdrLite: true }); return r.stats.sceneFmt; });
  const m = await measure(`${sc}_fallback_on`, 4);
  const d = await dE(`${sc}_fallback_off`, `${sc}_fallback_on`, `${sc}_fallback_diff`);
  await ev(() => { VR.GL.noFloatColor = false; VR.game.renderer.setQuality({ hdrLite: false }); });
  res.fallback = { fmt: fb, dE: d, off: off.frameMs, on: m.frameMs };
  check(fb === 'RGBA16F' && d.mean < 0.05, `the fallback (VR.GL.noFloatColor): hdrLite on draws in ${fb}, the picture as with it off (ΔE mean ${d.mean})`);
  save();
}
save();
const errs = logs.filter(l => l.startsWith('[pageerror]'));
console.log(`--- ${TAG} logs (${logs.length})`); for (const l of logs.slice(0, 12)) console.log(l);
check(errs.length === 0, `${TAG}: no page error (${errs.length})`);
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

// t-light2 · WOW I · DAS LICHT (plan docs/superpowers/plans/2026-10-15-t-light2.md): the same eight views at four times of
// day — noon (6000), the golden hour (10800, the sun 7° high), dusk (12600, the sun just under) and night (16500) — with
// the light switches off and on, on the High preset as a player gets it (the dynamic resolution held off), 1280 × 720,
// SwiftShader (the CPU draws: relative costs only).
//   views    avenue (Nova Haven up the avenue to the fork, t3_05/t3_06) · temple (the Gate Temple from the plaza path,
//            t1_10/t3_03) · hills (the terraced hills over the city, t3_07) · lake (the lake under the isles) · villa
//            (Villa Nova's garden, t1_24) · hangar (the Hangar Hall toward its portal, t1_12–t1_16) · trees (under a wood of
//            63 oaks and birches the test sets east of the lake: ipu.mjs's forest) — world seed 4242, vgen 10 — and
//            hallcity (the Weißstadt's street under its glass vault, seed 53: trailer_town.mjs's P1)
//   pictures the frame object of one game step is kept and drawn again for every time and configuration (the same people,
//            the same clocks: only the light differs) and read back: test/shots/light2_<view>_<time>_<config>_<TAG>.png,
//            the sheet test/shots/light2_sheet.png (a row a view: the times, each off | on)
//   cost     per view at noon, off and on: the frame's CPU time (the browser's processes) and the passes timed alone (each
//            synced by a one-texel read), the full-screen passes; Very Low: its pictures and, with BASE_DIST (the build
//            before, built elsewhere), its frame in turns against that build — not slower (≤ ×1.03, this machine's noise)
//   checks   every picture written and not blank; with the switches off the picture is the build before's where TAG_BASE's
//            pictures exist (ΔE mean < 1.0); the switches' defaults per preset (VR.Light2 on Very Low: none); no page error
// usage: nohup bash test/wt_run.sh light2.mjs 7200 > .tmp_tests/light2.log 2>&1 &
//   TAG=after · CONFIGS=off,on (a build without VR.Light2: off only) · VIEWS=avenue,… · TIMES=noon,golden,dusk,night · K=2
//   frames a picture · PRESET=high · RD=10 · BASE_DIST=file:///…/index.html (Very Low in turns) · TAG_BASE=base (the
//   pictures of the build before, compared with this build's off) · NO_COST=1 · NO_VL=1 · ROUNDS=4 · N=2
// regress: skip  (a showcase: the pictures are the evidence; the gates are the node tests, test/light2.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import sharp from '/home/dev/.npm-global/lib/node_modules/sharp/lib/index.js';
import fs from 'fs';
import { execSync } from 'child_process';
const TAG = process.env.TAG || 'after', DIST = process.env.DIST || 'file:///home/dev/vr/dist/index.html';
const BASE_DIST = process.env.BASE_DIST || '', TAG_BASE = process.env.TAG_BASE || 'base';
const PRESET = process.env.PRESET || 'high', RD = +(process.env.RD || 10), VGEN = +(process.env.VGEN || 10), K = +(process.env.K || 2);
const N = +(process.env.N || 2), ROUNDS = +(process.env.ROUNDS || 4);
const TIMES = { noon: 6000, golden: 10800, dusk: 12600, night: 16500 };
const TLIST = (process.env.TIMES || 'noon,golden,dusk,night').split(',');
const VIEWS = (process.env.VIEWS || 'avenue,temple,hills,lake,villa,hangar,trees,hallcity').split(',');
let CONFIGS = (process.env.CONFIGS || 'off,on').split(',');
const EYE = 1.62;
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const r1 = (x) => Math.round(x * 10) / 10, r2 = (x) => Math.round(x * 100) / 100;
const shotPath = (name) => `/home/dev/vr/test/shots/light2_${name}.png`;
const rec = { tag: TAG, dist: DIST, preset: PRESET, views: {}, cost: {}, vl: {} };
const save = () => { try { fs.writeFileSync(`/home/dev/vr/.tmp_tests/light2_${TAG}.json`, JSON.stringify(rec, null, 1)); } catch (e) { /* a convenience */ } };

// ---------------------------------------------------------------- the cameras
// eye: a number = the eye that far above the ground; {y} = the eye's absolute height; {feet} = the feet's absolute height
// at: the look-at point ([x, y, z]; y null = 3 above the ground there) · w: the world (1 = seed 4242, 2 = seed 53)
const CAMS = {
  avenue: { w: 1, x: 1.5, z: -62.5, eye: EYE, at: [1, 83, -100], fov: 70, clear: true },
  temple: { w: 1, x: 4.5, z: 74.5, eye: EYE, at: [0, 93, 0], fov: 70, clear: true },
  hills: { w: 1, x: 0.5, z: -292.5, eye: { y: 136 }, at: [0, 84, -105], fov: 60, clear: true },
  lake: { w: 1, x: 201.5, z: 6.5, eye: EYE, at: [250, 64, 70], fov: 70, clear: true },
  villa: { w: 1, x: 56.5, z: -133.5, eye: EYE, at: [76, 86, -110], fov: 75, clear: true },
  hangar: { w: 1, x: 0.5, z: -30.5, eye: { feet: 81 }, at: [0.5, 85, 20], fov: 70, far: false },
  trees: { w: 1, x: 238.5, z: 12.5, eye: EYE, at: [252, null, 52], fov: 70, forest: true },
  hallcity: { w: 2, u: 0.5, v: -24.5, at: [0.5, 40, 8], fov: 66, far: false },
};

// ---------------------------------------------------------------- pictures: ΔE, not blank, the sheet
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
const dE = async (a, b) => {
  const A = await sharp(a).raw().toBuffer({ resolveWithObject: true }), B = await sharp(b).raw().toBuffer({ resolveWithObject: true });
  if (A.info.width !== B.info.width || A.info.height !== B.info.height) return null;
  const da = A.data, db = B.data, C = A.info.channels, Cb = B.info.channels, n = A.info.width * A.info.height;
  const la = [0, 0, 0], lb = [0, 0, 0], all = new Float32Array(n); let s = 0, over = 0, worst = 0;
  for (let i = 0; i < n; i++) { lab(da[i * C], da[i * C + 1], da[i * C + 2], la); lab(db[i * Cb], db[i * Cb + 1], db[i * Cb + 2], lb); const d = Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]); all[i] = d; s += d; if (d > 2.3) over++; if (d > worst) worst = d; }
  all.sort();
  return { mean: r2(s / n), median: r2(all[n >> 1]), over: r2(100 * over / n), worst: r1(worst) };
};
// the picture's light in numbers: the mean L*, the L* spread (the contrast), the lower half's mean colour, and the share of
// pixels brighter than L* 90 (the glows) — the bands of the land against the frames are measured in node (test/land_ref.js)
const stats = async (path) => {
  const { data, info } = await sharp(path).raw().toBuffer({ resolveWithObject: true });
  const C = info.channels, W = info.width, H = info.height, L = [0, 0, 0];
  let s = 0, s2 = 0, n = 0, hi = 0, la = 0, lb = 0, nl = 0;
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) { const o = (y * W + x) * C; lab(data[o], data[o + 1], data[o + 2], L); s += L[0]; s2 += L[0] * L[0]; n++; if (L[0] > 90) hi++; if (y >= H / 2) { la += L[1]; lb += L[2]; nl++; } }
  const m = s / n;
  return { L: r1(m), sd: r1(Math.sqrt(Math.max(0, s2 / n - m * m))), glow: r2(100 * hi / n), lowAB: [r1(la / nl), r1(lb / nl)] };
};
const notBlank = (st) => st && st.sd > 3;

// ---------------------------------------------------------------- the browser, a page
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
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
  page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail|missing|incomplete/i.test(s)) logs.push(`[${t}] ${s.slice(0, 600)}`); });
  page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
  page.on('crash', () => { logs.push('[pageerror] the page crashed'); console.log('  !! the page crashed'); });
  await page.goto(dist);
  const wait = (ms) => page.waitForTimeout(ms);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
  // the render stub: steps draw nothing (the world streams in) — the frame object of the last step is kept (__F)
  await ev(() => {
    const g = VR.game, r = g.renderer, gl = r.gl;
    window.__px = new Uint8Array(4);
    window.__sync = () => { const d = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING), rd = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, window.__px); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, d); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, rd); };
    const P = window.__pass = { on: false, ms: {}, cat: [] };
    const timed = (obj, name, key) => {
      const f = obj && obj[name]; if (!f || f.__w) return;
      const w = function (...a) { if (!P.on || P.cat.length) return f.apply(this, a); window.__sync(); const t0 = performance.now(); P.cat.push(key); try { return f.apply(this, a); } finally { P.cat.pop(); window.__sync(); P.ms[key] = (P.ms[key] || 0) + performance.now() - t0; } };
      w.__w = 1; obj[name] = w;
    };
    // (the light's own passes by the names the renderer gives them — l2Ssao, l2Vol — where they exist)
    for (const [n, k] of [['shadowFrame', 'shadow'], ['reflectPass', 'mirror'], ['drawProps', 'props'], ['drawClouds', 'clouds'], ['post', 'post'], ['superRes', 'tsr'], ['refrCopy', 'copy'], ['l2Ssao', 'ssao'], ['l2Vol', 'vol'], ['l2Beams', 'beams']]) timed(r, n, k);
    const ds = r.drawSections;
    r.drawSections = function (list, layer, ...a) { if (!P.on || P.cat.length) return ds.call(this, list, layer, ...a); const key = 'terrain' + layer; window.__sync(); const t0 = performance.now(); P.cat.push(key); try { return ds.call(this, list, layer, ...a); } finally { P.cat.pop(); window.__sync(); P.ms[key] = (P.ms[key] || 0) + performance.now() - t0; } };
    r._render = r.render;
    r.render = function (F) { if (window.__norender) { window.__F = F; this.setupCamera(F.cam); return; } return this._render(F); };
  });
  const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(4); } };
  const boost = (on) => ev((on) => { const g = VR.game, q = g.renderer && g.renderer.q; if (!q) return; if (on) { if (q.__up === undefined) q.__up = q.upload; q.upload = 24; } else if (q.__up !== undefined) { q.upload = q.__up; delete q.__up; } }, on);
  // the far ring's queued jobs held (ipu.mjs): the near world settles first, the far forms come after it
  const holdFar = (on) => ev((on) => { const pool = VR.game.pool; if (!pool || !pool.queueFar) return 0; if (on) pool.__heldFar = (pool.__heldFar || []).concat(pool.queueFar.splice(0)); else if (pool.__heldFar) { for (const j of pool.__heldFar) pool.queueFar.push(j); pool.__heldFar = null; pool.queueDirty = true; if (pool.pump) pool.pump(); } return pool.queueFar.length + (pool.__heldFar ? pool.__heldFar.length : 0); }, on);
  // settled: nothing to generate, mesh, upload or fade in round the eye and every column in the render distance shown (a
  // view whose dirty count stops falling for six rounds counts: beauty_audit.mjs — the re-meshes the world leaves for
  // later); farMax > 0: then up to that many rounds more for the horizon and the far ring
  const settle = async (max = 400, farMax = 0) => {
    let s = null, last = Infinity, stall = 0, nearAt = -1;
    await boost(true);
    for (let i = 0; i < max; i++) {
      await step(10);
      s = await ev(() => { const g = VR.game, w = g.world, p = g.player, rd = Math.max(1, (w.renderDist | 0) - 1), ri = Math.max(1, rd - 2), pcx = Math.floor(p.pos[0]) >> 4, pcz = Math.floor(p.pos[2]) >> 4; let dirty = 0; for (const c of w.cols.values()) { let n = 0; for (const sc of c.sec) if ((sc.dirty || sc.pending) && sc.count > 0) n++; const ex = c.cx - pcx, ez = c.cz - pcz; if (n && ex * ex + ez * ez <= ri * ri) dirty += n; } let unshown = 0; for (let dz = -rd; dz <= rd; dz++) for (let dx = -rd; dx <= rd; dx++) { if (dx * dx + dz * dz > rd * rd) continue; const c = w.col(pcx + dx, pcz + dz); if (!c || !(c.shownAt >= 0)) unshown++; } const h = g.horizon, f = h && h.far, fr = f && f.report ? f.report() : null; return { busy: g.pool.busy, pend: w.pending.size, dirty, up: w.uploadQ ? w.uploadQ.size : 0, fading: w.fading ? w.fading.size : 0, unshown, arr: w.arrivals ? w.arrivals.length : 0, hz: h ? h.inflight : 0, far: fr ? fr.inflight + fr.want : 0 }; });
      const shown = s.pend === 0 && s.up === 0 && s.fading === 0 && s.unshown === 0 && s.arr === 0;
      stall = shown && s.dirty >= last ? stall + 1 : 0; last = s.dirty;
      const near = shown && ((s.busy === 0 && s.dirty === 0) || stall >= 6);
      s.i = i;
      if (near) { if (nearAt < 0) nearAt = i; if (!farMax || (s.hz === 0 && s.far === 0) || i - nearAt >= farMax) break; }
      await wait(60);
    }
    await boost(false);
    if (s) s.near = nearAt;
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
  // the camera rule (beauty_audit.mjs): nothing solid round the eye, the view ray free for its first blocks — else up a
  // block at a time, else back along the view
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
  return { ctx, page, logs, ev, wait, step, settle, holdFar, warmVx, groundY, clearEye, pose };
}
const errsOf = (P) => P.logs.filter(l => l.startsWith('[pageerror]'));
// a configuration of the light switches straight on the renderer: off (all of them off), on (the preset's defaults:
// VR.Light2.defaults), or a list "ssao,vol" (those on, as the preset gives them, the rest off). A build without VR.Light2
// has no switches: every configuration draws the same
const config = (ev, c) => ev((c) => {
  const g = VR.game, r = g.renderer, L2 = VR.Light2;
  if (!L2 || !L2.SW) return { q: 'none', has: false };
  const dflt = L2.defaults(g.settings.preset), q = {};
  const want = c === 'on' ? null : c === 'off' ? [] : c.split('+');
  for (const k of L2.SW) q[k] = want === null ? dflt[k] : want.includes(k) ? (dflt[k] || L2.MAX[k] || 1) : (typeof dflt[k] === 'number' ? 0 : false);
  r.setQuality(q);
  return { q: L2.SW.filter(k => r.q[k]).map(k => k + (typeof r.q[k] === 'number' ? '=' + r.q[k] : '')).join(',') || 'off', has: true };
}, c);
// the eye's light settled at this time (the exposure follows the light at the eye — env.js — and must not still be moving)
const setTime = (ev, tod) => ev((tod) => { const g = VR.game, p = g.player; g.env.setTime(tod); g.env.anim = 499; if (g.envFor) g.envFor(p.eyePos(), 1, { freezeTime: true, freezeWeather: true }); g.env.anim = 499; if (g.envFor) g.envFor(p.eyePos(), 1, { freezeTime: true, freezeWeather: true }); return g.env.timeOfDay; }, tod);
// K frames of the kept frame object (the same scene every time), then the screen read back into a picture
const picture = async (P, path, k) => {
  const m = await P.ev((k) => {
    const g = VR.game, r = g.renderer, gl = r.gl, F = window.__F;
    if (!F) return { err: 'no frame kept' };
    window.__norender = false;
    r.frameNo = 1000; r.tsrReset = true; r.shadowValid = false;
    for (let i = 0; i < k; i++) r.render(F);
    const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, px = new Uint8Array(W * H * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let s = ''; const CH = 0x8000; for (let i = 0; i < px.length; i += CH) s += String.fromCharCode.apply(null, px.subarray(i, i + CH));
    window.__norender = true;
    return { png: btoa(s), W, H, draws: r.stats.draws, tris: Math.round(r.stats.tris), fs: r.stats.fsPasses };
  }, k);
  if (m.err) return m;
  await sharp(Buffer.from(m.png, 'base64'), { raw: { width: m.W, height: m.H, channels: 4 } }).flip().removeAlpha().png().toFile(path);
  delete m.png;
  return m;
};
// the frame's cost: K frames to warm, then n timed frames (each synced; the CPU time round them), then one frame with every
// pass timed alone (the renderer's methods wrapped: shadow, mirror, props, clouds, post, the light's passes, the terrain by
// layer)
const cost = async (P, k, n) => {
  await P.ev((k) => { const g = VR.game, r = g.renderer, F = window.__F; window.__norender = false; r.frameNo = 1000; r.tsrReset = true; r.shadowValid = false; for (let i = 0; i < k; i++) r.render(F); window.__sync(); window.__norender = true; }, k);
  const c0 = cpuNow();
  const wall = await P.ev((n) => { const g = VR.game, r = g.renderer, F = window.__F, out = []; window.__norender = false; for (let i = 0; i < n; i++) { const t0 = performance.now(); r.render(F); window.__sync(); out.push(performance.now() - t0); } window.__norender = true; return out; }, n);
  const cpuMs = (cpuNow() - c0) / n;
  const d = await P.ev(() => { const g = VR.game, r = g.renderer, F = window.__F, P = window.__pass; window.__norender = false; P.ms = {}; P.on = true; window.__sync(); const t0 = performance.now(); r.render(F); window.__sync(); const all = performance.now() - t0; P.on = false; window.__norender = true; const ms = {}; for (const k in P.ms) ms[k] = Math.round(P.ms[k]); return { all: Math.round(all), ms, fs: r.stats.fsPasses, draws: r.stats.draws }; });
  return { cpuMs: Math.round(cpuMs), wallMs: Math.round(wall.sort((a, b) => a - b)[wall.length >> 1]), pass: d.ms, passAll: d.all, fs: d.fs, draws: d.draws };
};

// ---------------------------------------------------------------- the worlds and the cameras
// the forest east of the lake (ipu.mjs: 63 oaks and birches, short grass and poppies between them), set into world 1
const forest = (ev) => ev(() => {
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
async function makeWorld(P, seed, name, preset) {
  await P.ev(([p, rd]) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.renderDist = Math.min(rd, (VR.Game.PRESETS[p] || {}).renderDist || rd); g.applySettings('*'); }, [preset, RD]);
  await P.ev(([seed, name, v]) => VR.game.createWorld({ name, mode: 'creative', difficulty: 'peaceful', type: 'default', seed, cheats: true, kit: true, vgen: v }), [seed, name, VGEN]);
  for (let i = 0; i < 150; i++) { await P.wait(1000); if (await P.ev(() => VR.game.state) === 'play') break; }
  const ok = await P.ev(() => VR.game.state) === 'play';
  // (the game's own frames stop once the world is there: from now on the test steps the loop itself)
  await P.ev(() => { const g = VR.game; g.zenFreezeTime = true; g.zenFreezeWeather = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; for (const id of ['hud', 'ui', 'hints']) { const h = document.getElementById(id); if (h) h.style.display = 'none'; } });
  return ok;
}
// a camera placed: the columns round it loaded (teleported high first), the eye on the ground or where the camera says,
// cleared by the camera rule, the look-at point aimed at; returns the pose
async function place(P, c) {
  let x = c.x, z = c.z;
  if (c.w === 2) {
    const site = P.site;
    const q = ROT[site.r](c.u, c.v), t = ROT[site.r](c.at[0], c.at[1]);
    x = site.x + q[0]; z = site.z + q[1];
    c = Object.assign({}, c, { x, z, eye: { feet: site.F + 1 }, at: [site.x + t[0], site.F + 1 + c.at[2], site.z + t[1]] });
  }
  await P.ev(([x, z]) => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(x, 150, z); }, [x, z]);
  await P.holdFar(true);
  const s0 = await P.settle(P.first === false ? 600 : 1500);   // (the first view loads the world round it: up to 1500 rounds)
  P.first = false;
  await P.holdFar(false);
  const gy = await P.groundY(x, z);
  let eyeY = typeof c.eye === 'number' ? gy + 1 + c.eye : c.eye.y !== undefined ? c.eye.y : c.eye.feet + EYE;
  const at = c.at.slice(); if (at[1] === null) at[1] = (await P.groundY(at[0], at[2])) + 1 + 3;
  const aim = (x, y, z) => { const dx = at[0] - x, dy = at[1] - y, dz = at[2] - z; return [Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz))]; };
  let [yaw, pitch] = aim(x, eyeY, z), moved = null;
  if (c.clear) { const C = await P.clearEye(x, eyeY, z, yaw, pitch, 6); if (C.up || C.back) { moved = { up: C.up, back: C.back }; x = C.x; z = C.z; eyeY = C.y; [yaw, pitch] = aim(x, eyeY, z); } if (C.stuck) moved = 'stuck'; }
  await P.pose(x, eyeY - EYE, z, yaw, pitch, c.fov);
  const st = await P.settle(600, c.far === false ? 0 : 80); st.first = s0 && s0.i; await P.step(4);
  await P.warmVx();
  await P.step(2);   // (one step after the pose: the frame object kept is this camera's)
  return { x: r2(x), feet: r2(eyeY - EYE), z: r2(z), yaw: r2(yaw), pitch: r2(pitch), fov: c.fov, moved, settle: st };
}

// ---------------------------------------------------------------- the run
let A = await openPage(DIST);
const info = await A.ev(() => ({ gpu: VR.GL && VR.GL.rendererName, light2: !!(VR.Light2 && VR.Light2.SW), sw: VR.Light2 && VR.Light2.SW ? VR.Light2.SW : [], presets: Object.keys(VR.Game.PRESETS || {}) }));
console.log(TAG, JSON.stringify(info), secs());
rec.info = info;
if (!info.light2) CONFIGS = ['off'];
// the switches' defaults per preset (the rule: VR.Light2.defaults; Very Low gets none)
if (info.light2) {
  const d = await A.ev(() => { const L2 = VR.Light2, o = {}; for (const p of Object.keys(VR.Game.PRESETS)) { const q = L2.defaults(p); o[p] = L2.SW.filter(k => q[k]).map(k => k + '=' + q[k]).join(',') || 'none'; } return o; });
  console.log('  defaults', JSON.stringify(d));
  rec.defaults = d;
  check(d.potato === 'none', `Very Low gets none of the light switches (${d.potato})`);
}
const order = VIEWS.filter(v => CAMS[v]);
let world = 0, pics = 0, wanted = 0;
const blank = [];
for (const v of order) {
  const c = CAMS[v];
  try {
    if (world !== c.w) {
      // (each world in a page of its own: a second createWorld in one page is not what a player does)
      if (world) { check(errsOf(A).length === 0, `world ${world}: no page error (${errsOf(A).length})`); for (const l of A.logs.slice(0, 8)) console.log(l); await A.ctx.close(); A = await openPage(DIST); }
      const ok = c.w === 1 ? await makeWorld(A, '4242', 'Licht', PRESET) : await makeWorld(A, '53', 'Weissstadt', PRESET);
      check(ok, `world ${c.w} (seed ${c.w === 1 ? 4242 : 53}, vgen ${VGEN}) is loaded (${secs()})`);
      world = c.w;
      if (c.w === 2) {
        A.site = await A.ev(() => { const W = VR.game.world, VG = VR.VillageGen, og = new VR.OverworldGen(W.seed, W.genOpts); const s = VG.site(og, -2, -1); if (!s) return null; const P = VG.plan(og, s), h = P.hall || null; return h ? { x: s.x, z: s.z, r: h.r, F: h.F, style: s.style } : { x: s.x, z: s.z, r: (s.seed >>> 3) & 3, F: s.y, style: s.style }; });
        console.log('  the hall city', JSON.stringify(A.site));
        if (!A.site) { check(false, 'the hall city site of seed 53, cell (-2, -1)'); continue; }
      }
    }
    if (c.forest && !A.forest) {
      // the wood is set once its columns are there (the camera first stands at it)
      await A.ev(([x, z]) => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(x, 150, z); }, [c.x + 12, c.z + 20]);
      await A.holdFar(true); await A.settle(A.first === false ? 600 : 1500); A.first = false;
      const f = await forest(A.ev); A.forest = f; console.log(`  forest: ${f.trees} trees, ${f.blocks} blocks set (${secs()})`);
      await A.settle(600); await A.holdFar(false);
    }
    const pose = await place(A, c);
    console.log(`  ${v}: (${pose.x}, ${pose.feet}, ${pose.z}) yaw ${pose.yaw} pitch ${pose.pitch} fov ${pose.fov}${pose.moved ? ' moved ' + JSON.stringify(pose.moved) : ''} · settle ${JSON.stringify(pose.settle)} (${secs()})`);
    const R = rec.views[v] = { pose, pics: {} };
    for (const t of TLIST) {
      await setTime(A.ev, TIMES[t]);
      for (const cf of CONFIGS) {
        const q = await config(A.ev, cf);
        const path = shotPath(`${v}_${t}_${cf}_${TAG}`);
        wanted++;
        const m = await picture(A, path, K);
        if (m.err) { console.log(`    ${t} ${cf}: ${m.err}`); continue; }
        const st = await stats(path);
        if (notBlank(st)) pics++; else blank.push(path);
        R.pics[t + '_' + cf] = Object.assign({ q: q.q }, m, st);
        let cmp = '';
        if (cf !== 'off' && R.pics[t + '_off']) { const d = await dE(shotPath(`${v}_${t}_off_${TAG}`), path); R.pics[t + '_' + cf].dE = d; cmp = ` · against off ΔE ${d.mean} (${d.over} % > 2.3)`; }
        if (cf === 'off' && TAG !== TAG_BASE && fs.existsSync(shotPath(`${v}_${t}_off_${TAG_BASE}`))) { const d = await dE(shotPath(`${v}_${t}_off_${TAG_BASE}`), path); R.pics[t + '_off'].dEbase = d; cmp = ` · against ${TAG_BASE} ΔE ${d ? d.mean : '?'}`; }
        console.log(`    ${t} ${cf} [${q.q}]: L* ${st.L} ±${st.sd}, glow ${st.glow} %, lower half a*b* ${st.lowAB.join(' ')}, ${m.draws} draws, ${m.fs} full-screen passes${cmp}`);
      }
    }
    // into the sun (the lake at the golden hour, turned to the sun 7° up: the flare's ghosts and the light in the air
    // toward it — none of the eight views has the sun in its frame)
    if (v === 'lake' && !process.env.NO_SUN && TLIST.includes('golden')) {
      await setTime(A.ev, TIMES.golden);
      const sd = await A.ev(() => VR.game.env.E.sunDir.slice());
      const yaw = Math.atan2(-sd[0], -sd[2]), pitch = Math.atan2(sd[1], Math.hypot(sd[0], sd[2])) - 0.1;
      await A.pose(pose.x, pose.feet, pose.z, yaw, pitch, 70);
      await A.settle(300, 60); await A.step(4); await A.warmVx(); await A.step(2);
      for (const cf of CONFIGS) {
        const q = await config(A.ev, cf), path = shotPath(`lakesun_golden_${cf}_${TAG}`);
        wanted++;
        const m = await picture(A, path, K);
        if (m.err) { console.log(`    into the sun ${cf}: ${m.err}`); continue; }
        const st = await stats(path);
        if (notBlank(st)) pics++; else blank.push(path);
        R.pics['sun_' + cf] = Object.assign({ q: q.q, yaw: r2(yaw), pitch: r2(pitch) }, m, st);
        console.log(`    into the sun (yaw ${r2(yaw)}, pitch ${r2(pitch)}) ${cf} [${q.q}]: L* ${st.L} ±${st.sd}, glow ${st.glow} %`);
      }
      await A.pose(pose.x, pose.feet, pose.z, pose.yaw, pose.pitch, pose.fov); await A.step(2);
    }
    // the cost at noon, off and on (High): the frame and its passes
    if (!process.env.NO_COST && ['avenue', 'hallcity', 'trees', 'hangar'].includes(v)) {
      await setTime(A.ev, TIMES.noon);
      R.cost = {};
      for (const cf of CONFIGS) { await config(A.ev, cf); R.cost[cf] = await cost(A, K, N); console.log(`    cost ${cf}: ${JSON.stringify(R.cost[cf])}`); }
      await config(A.ev, 'on');
    }
    save();
  } catch (e) { check(false, `${v}: ${String(e.stack || e.message || e).slice(0, 400)}`); }
}
check(pics === wanted && wanted > 0, `every picture is written and not blank (${pics} of ${wanted}${blank.length ? '; blank: ' + blank.join(', ') : ''})`);
// with the switches off the picture is the build before's (where its pictures are here)
{
  // (the same light: the mean ΔE under 1 — or, where the people walked on between the two runs (the hall city's crowd),
  // the light unchanged everywhere else: the median under 0.3 and under 8 % of the pixels over 2.3, where they stand)
  const diffs = []; for (const v of order) for (const t of TLIST) { const p = rec.views[v] && rec.views[v].pics[t + '_off']; if (p && p.dEbase) diffs.push([v + ' ' + t, p.dEbase.mean, p.dEbase.median, p.dEbase.over]); }
  if (diffs.length) check(diffs.every(d => d[1] < 1.0 || (d[2] !== undefined && d[2] < 0.3 && d[3] < 8)), `with the switches off the pictures are the ${TAG_BASE} build's (ΔE mean · median · % over 2.3: ${diffs.map(d => d[0] + ' ' + d[1] + ' · ' + d[2] + ' · ' + d[3]).join(', ')})`);
}
check(errsOf(A).length === 0, `${TAG}: no page error (${errsOf(A).length})`);
console.log(`--- ${TAG} logs (${A.logs.length})`); for (const l of A.logs.slice(0, 12)) console.log(l);

// ---------------------------------------------------------------- Very Low: its pictures, and its frame against the build before
if (!process.env.NO_VL) {
  try {
    await A.ctx.close();
    const V = await openPage(DIST);
    const ok = await makeWorld(V, '4242', 'Licht', 'potato');
    check(ok, `Very Low: the world is loaded (${secs()})`);
    const q = await V.ev(() => { const r = VR.game.renderer; return { lite: r.q.lite, tsr: r.q.tsr, w: r.w, W: r.W, light2: VR.Light2 && VR.Light2.SW ? VR.Light2.SW.filter(k => r.q[k]).join(',') || 'none' : 'n/a' }; });
    console.log('  very low', JSON.stringify(q));
    check(q.light2 === 'none' || q.light2 === 'n/a', `Very Low draws with none of the light switches (${q.light2})`);
    let B = null;
    if (BASE_DIST) { B = await openPage(BASE_DIST); const okb = await makeWorld(B, '4242', 'Licht', 'potato'); check(okb, `the build before on Very Low is loaded (${secs()})`); }
    for (const v of ['avenue', 'temple']) {
      const c = CAMS[v];
      const pose = await place(V, c); if (B) await place(B, c);
      await setTime(V.ev, TIMES.noon); if (B) await setTime(B.ev, TIMES.noon);
      const m = await picture(V, shotPath(`vl_${v}_noon_${TAG}`), 9);
      if (B) await picture(B, shotPath(`vl_${v}_noon_${TAG}_base`), 9);
      rec.vl[v] = { pose, pic: m };
      if (B) {
        // in turns: A B B A …, N frames each after the same warm-up; the CPU time of the browser's processes
        const runs = { this: [], base: [] };
        for (let k = 0; k < ROUNDS; k++) for (const [lbl, P] of (k % 2 ? [['base', B], ['this', V]] : [['this', V], ['base', B]])) { const cst = await cost(P, 9, Math.max(3, N)); runs[lbl].push(cst.cpuMs); }
        const med = (a) => { const b = a.slice().sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
        const ratio = Math.round(med(runs.this) / med(runs.base) * 1000) / 1000;
        rec.vl[v].cost = { runs, ratio };
        console.log(`  very low ${v}: CPU ms a frame this ${runs.this.join(' ')} · before ${runs.base.join(' ')} → ×${ratio}`);
        check(ratio <= 1.03, `Very Low at ${v}: not slower than the build before (×${ratio}, the medians of ${ROUNDS} rounds in turns; ≤ ×1.03, this machine's noise)`);
        const d = await dE(shotPath(`vl_${v}_noon_${TAG}_base`), shotPath(`vl_${v}_noon_${TAG}`));
        rec.vl[v].dE = d;
        check(d && d.mean < 1.0, `Very Low at ${v}: the same picture as the build before (ΔE mean ${d ? d.mean : '?'}, ${d ? d.over : '?'} % > 2.3)`);
      } else { const cst = await cost(V, 9, Math.max(3, N)); rec.vl[v].cost = cst; console.log(`  very low ${v}: ${JSON.stringify(cst)}`); }
      save();
    }
    check(errsOf(V).length === 0, `Very Low: no page error (${errsOf(V).length})`);
    if (B) { check(errsOf(B).length === 0, `the build before: no page error (${errsOf(B).length})`); await B.ctx.close(); }
    await V.ctx.close();
  } catch (e) { check(false, `Very Low: ${String(e.stack || e.message || e).slice(0, 400)}`); }
}

// ---------------------------------------------------------------- the sheet: a row a view, the times, each off | on
try {
  const cw = 320, ch = 180, head = 22, label = 18;
  const cols = []; for (const t of TLIST) for (const cf of CONFIGS) cols.push([t, cf]);
  const rows = order.filter(v => rec.views[v]);
  const W = cols.length * cw, H = head + rows.length * (ch + label);
  const parts = [];
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const txt = (s, x, y, size = 13) => ({ input: Buffer.from(`<svg width="${cw}" height="${label}"><rect width="100%" height="100%" fill="#111"/><text x="4" y="${size}" font-family="sans-serif" font-size="${size}" fill="#eee">${esc(s)}</text></svg>`), left: x, top: y });
  cols.forEach(([t, cf], i) => parts.push(Object.assign(txt(`${t} · ${cf}`, 0, 0), { left: i * cw, top: 2 })));
  for (let ri = 0; ri < rows.length; ri++) {
    const v = rows[ri], y = head + ri * (ch + label);
    for (let ci = 0; ci < cols.length; ci++) {
      const [t, cf] = cols[ci], p = shotPath(`${v}_${t}_${cf}_${TAG}`);
      parts.push(txt(`${v} ${t} ${cf}`, ci * cw, y));
      if (fs.existsSync(p)) parts.push({ input: await sharp(p).resize(cw, ch).toBuffer(), left: ci * cw, top: y + label });
    }
  }
  await sharp({ create: { width: W, height: H, channels: 3, background: '#000' } }).composite(parts).png().toFile(`/home/dev/vr/test/shots/light2_sheet${TAG === 'after' ? '' : '_' + TAG}.png`);
  console.log(`  the sheet: test/shots/light2_sheet${TAG === 'after' ? '' : '_' + TAG}.png (${W} × ${H})`);
} catch (e) { console.log('  (the sheet: ' + String(e.message || e).slice(0, 200) + ')'); }
save();
await browser.close();
console.log(`(${secs()})`);
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

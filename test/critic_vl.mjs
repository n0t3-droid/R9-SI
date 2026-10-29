// regress: skip — the critic's Very Low bench (docs/process/SELF-REVIEW.md §2.5, review docs/reviews/v0.49.md): the frame at
// the standing places on Very Low, this build against the previous release's, the same poses on two pages of one browser,
// the rounds in turns (this build first in odd rounds, the previous one first in even rounds), the medians of ROUNDS.
//   places (seed 53, the Heartland, a new default world on each build, noon, clear, creative, Very Low as a player gets it,
//   the dynamic resolution off so the two builds draw the same pixels):
//     plaza   the Gate Temple from the plaza path (light2.mjs's 'temple' eye: (4.5, 74.5) → (0, 93, 0))
//     hall    Weißstadt's hall street under the glass vault (wow48.mjs's 'hallcity': the hall of cell (−2, −1), u 0.5, v −24.5)
//     canyon  the Ember Canyon's site (the land plan's 'canyon', (−246, 112)) toward the Spire Citadel
//     isles   on the Sky Isles (the landmark's centre, (330, 140)) toward the lighthouse
//     space   /raum herz on this build (the first look into space — no counterpart before it: against its own plaza)
//   numbers   the wall time of a synced frame (the median of N in a round, then the median of the rounds) and the CPU of the
//             browser's processes a frame; draws and triangles; the JS heap after the plaza; the time from createWorld to
//             'play'. A place is an item when this build's frame is > 1.03 × the previous one's (SELF-REVIEW §2.5).
//   pictures  test/shots/critic_v0.49_vl_<place>_<v049|v048>.png (the kept frame drawn once more) and the sheet
//             test/shots/critic_v0.49_vl_sheet.png; every number in .tmp_tests/critic_vl.json and test/shots/critic_v0.49_vl.json
// usage: R9_EXCLUSIVE=1 nohup bash test/wt_run.sh critic_vl.mjs 5400 > .tmp_tests/critic_vl.log 2>&1 &
//   DIST_PREV=file:///tmp/r9prev/dist/index.html (git worktree add /tmp/r9prev v0.48; node build.js there) · ROUNDS=7 ·
//   N=4 (timed frames a round) · SEED=53 · W=1280 H=720 · ONLY=plaza,hall (places) · NO_SPACE=1
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import sharp from '/home/dev/.npm-global/lib/node_modules/sharp/lib/index.js';
import fs from 'fs';
import { execSync } from 'child_process';
const ROOT = new URL('../', import.meta.url).pathname;
const SHOTS = ROOT + 'test/shots/';
const DIST = process.env.DIST || 'file://' + ROOT + 'dist/index.html';
const DIST_PREV = process.env.DIST_PREV || 'file:///tmp/r9prev/dist/index.html';
const SEED = process.env.SEED || '53', ROUNDS = +(process.env.ROUNDS || 7), N = +(process.env.N || 4);
const VW = +(process.env.W || 1280), VH = +(process.env.H || 720);
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const TAG = { cur: process.env.TAG_CUR || 'v049', prev: process.env.TAG_PREV || 'v048' };   // (v0.51 review: TAG_CUR=v051 TAG_PREV=v050 REL=0.51)
const PFX = 'critic_v' + (process.env.REL || '0.49') + '_vl';
const EYE = 1.62;
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const r1 = (x) => Math.round(x * 10) / 10, r3 = (x) => Math.round(x * 1000) / 1000;
const med = (a) => { const s = a.filter(Number.isFinite).slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
const rec = { dist: DIST, distPrev: DIST_PREV, seed: SEED, rounds: ROUNDS, n: N, size: [VW, VH], pages: {}, places: {}, space: null };
const save = () => { try { fs.mkdirSync(ROOT + '.tmp_tests', { recursive: true }); fs.writeFileSync(ROOT + '.tmp_tests/critic_vl.json', JSON.stringify(rec, null, 1)); fs.writeFileSync(SHOTS + PFX + '.json', JSON.stringify(rec, null, 1)); } catch (e) { /* a convenience */ } };
fs.mkdirSync(SHOTS, { recursive: true });
const ROT = [(u, v) => [u, v], (u, v) => [-v, u], (u, v) => [-u, -v], (u, v) => [v, -u]];
const aimAt = (x, y, z, at) => { const dx = at[0] - x, dy = at[1] - y, dz = at[2] - z; return [Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz))]; };
const PLACES = [
  { id: 'plaza', x: 4.5, z: 74.5, at: [0, 93, 0], fov: 70 },
  { id: 'hall', hall: { u: 0.5, v: -24.5, at: [0.5, 40, 8] }, fov: 66 },
  { id: 'canyon', x: -246, z: 112, at: [-420, 180, 380], fov: 70, lift: 1, clear: true },
  { id: 'isles', x: 330, z: 140, at: [484, 95, 136], fov: 70, top: true, clear: true },
].filter(p => !ONLY || ONLY.includes(p.id));

const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
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
  const t0 = Date.now();
  await ev(() => { const g = VR.game; g.applyPreset('potato'); g.settings.dynRes = false; g.applySettings('*'); });
  await ev((seed) => VR.game.createWorld({ name: 'Kritik VL', mode: 'creative', difficulty: 'peaceful', type: 'default', seed, cheats: true, kit: true }), SEED);
  for (let i = 0; i < 240; i++) { await wait(1000); if (await ev(() => VR.game.state).catch(() => '') === 'play') break; }
  const ok = await ev(() => VR.game.state) === 'play';
  const loadS = (Date.now() - t0) / 1000;
  await ev(() => {
    const g = VR.game; g.zenFreezeTime = true; g.zenFreezeWeather = true;
    if (g.env.wx && g.env.wx.force) g.env.wx.force('klar'); g.env.rain = 0; g.env.rainTarget = 0;
    g.settings.wowMoments = false; if (g.arrival && g.arrival.skip) { try { g.arrival.skip(); } catch (e) { /* none */ } }
    window.requestAnimationFrame = () => 0; g.hideHud = true;
    for (const id of ['hud', 'ui', 'hints']) { const h = document.getElementById(id); if (h) h.style.display = 'none'; }
  });
  const info = await ev(() => { const g = VR.game; return { vgen: g.meta && g.meta.vgen, preset: g.settings.preset, rd: g.settings.renderDist, scale: g.settings.scale, dynRes: g.settings.dynRes }; });
  return { tag, ctx, page, logs, ev, wait, step, settle, holdFar, warmVx, groundY, clearEye, pose, ok, loadS, info };
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
// a kept frame's cost: k frames to warm, then n timed frames, each synced (one pixel read back); the CPU of the browser round them
const cost = async (P, key, k, n) => {
  await P.ev(([key, k]) => { const r = VR.game.renderer, F = window[key]; window.__norender = false; r.frameNo = 1000; r.tsrReset = true; r.shadowValid = false; for (let i = 0; i < k; i++) r.render(F); window.__sync(); window.__norender = true; }, [key, k]);
  const c0 = cpuNow();
  const wall = await P.ev(([key, n]) => { const r = VR.game.renderer, F = window[key], out = []; window.__norender = false; for (let i = 0; i < n; i++) { const t0 = performance.now(); r.render(F); window.__sync(); out.push(performance.now() - t0); } window.__norender = true; return out; }, [key, n]);
  return { cpuMs: (cpuNow() - c0) / n, wallMs: med(wall) };
};

// ---------------------------------------------------------------- the places on a page: settled, posed, the frame kept
async function prepare(P) {
  const out = {};
  for (const pl of PLACES) {
    const t1 = Date.now();
    try {
      let x = pl.x, z = pl.z, at = pl.at, fov = pl.fov, feetY = null;
      if (pl.hall) {
        // the hall city of seed 53, cell (−2, −1): its site and its hall's turn from the game's own generator (wow48.mjs)
        const site0 = await P.ev(() => { try { const W = VR.game.world, VG = VR.VillageGen, og = new VR.OverworldGen(W.seed, W.genOpts); const s = VG.site(og, -2, -1); if (!s) return null; const Pl = VG.plan(og, s), h = Pl.hall || null; return h ? { x: s.x, z: s.z, r: h.r, F: h.F, style: s.style } : { x: s.x, z: s.z, r: (s.seed >>> 3) & 3, F: s.y, style: s.style }; } catch (e) { return { err: String(e.message || e) }; } });
        const site = site0 && !site0.err ? site0 : { x: -944, z: -296, r: 3, F: 73, fallback: site0 && site0.err };
        const q = ROT[site.r](pl.hall.u, pl.hall.v), t = ROT[site.r](pl.hall.at[0], pl.hall.at[1]);
        x = site.x + q[0]; z = site.z + q[1]; feetY = site.F + 1; at = [site.x + t[0], site.F + 1 + pl.hall.at[2], site.z + t[1]];
        out.site = site;
      }
      await P.ev(([x, z]) => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(x, 160, z); }, [x, z]);
      await P.holdFar(true); const s0 = await P.settle(240, 0); await P.holdFar(false);
      let feet = feetY !== null ? feetY : (await P.groundY(x, z, pl.top ? 215 : 200)) + 1 + (pl.lift || 0);
      let eyeY = feet + EYE;
      let [yaw, pitch] = aimAt(x, eyeY, z, at), moved = null;
      if (pl.clear) { const C = await P.clearEye(x, eyeY, z, yaw, pitch, 6); if (C.up || C.back) { moved = { up: C.up, back: C.back }; x = C.x; z = C.z; eyeY = C.y; [yaw, pitch] = aimAt(x, eyeY, z, at); } if (C.stuck) moved = 'stuck'; }
      await P.pose(x, eyeY - EYE, z, yaw, pitch, fov);
      const s1 = await P.settle(240, 20); await P.step(4); await P.warmVx(); await P.step(3);
      await P.ev((id) => { window['__F_' + id] = window.__F; }, pl.id);
      const pic = SHOTS + `${PFX}_${pl.id}_${TAG[P.tag]}.png`, m = await picture(P, '__F_' + pl.id, pic, 2);
      const heap = await P.ev(() => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null));
      out[pl.id] = { pose: { x: r1(x), feet: r1(eyeY - EYE), z: r1(z), yaw: r3(yaw), pitch: r3(pitch), fov, moved }, settle: [s0 && s0.s, s1 && s1.s], draws: m.draws, tris: m.tris, fs: m.fs, err: m.err, heapMB: heap, s: Math.round((Date.now() - t1) / 1000) };
      console.log(`  ${P.tag} ${pl.id}: ${m.err ? 'ERR ' + m.err : m.draws + ' draws, ' + m.tris + ' tris, ' + m.fs + ' passes'} · heap ${heap} MB · settled ${s0 && s0.s} + ${s1 && s1.s} s (${secs()})`);
    } catch (e) { out[pl.id] = { err: String(e.stack || e.message || e).slice(0, 400) }; console.log(`  !! ${P.tag} ${pl.id}: ${out[pl.id].err}`); }
    save();
  }
  return out;
}

// ---------------------------------------------------------------- run
const A = await openWorld(DIST, 'cur');
console.log(`this build: ${A.ok ? 'play' : 'NOT play'} after ${r1(A.loadS)} s ${JSON.stringify(A.info)} (${secs()})`);
const B = await openWorld(DIST_PREV, 'prev');
console.log(`the previous release: ${B.ok ? 'play' : 'NOT play'} after ${r1(B.loadS)} s ${JSON.stringify(B.info)} (${secs()})`);
rec.pages = { cur: { loadS: r1(A.loadS), info: A.info }, prev: { loadS: r1(B.loadS), info: B.info } };
check(A.ok && B.ok, 'both worlds are there');
rec.pages.cur.places = await prepare(A);
rec.pages.prev.places = await prepare(B);
save();

// the rounds in turns: this build first in odd rounds, the previous one first in even ones
const W = {}; for (const pl of PLACES) W[pl.id] = { cur: [], prev: [], curCpu: [], prevCpu: [] };
for (let rd = 0; rd < ROUNDS; rd++) {
  const order = rd % 2 ? [B, A] : [A, B];
  for (const pl of PLACES) for (const P of order) {
    if (rec.pages[P.tag].places[pl.id] && rec.pages[P.tag].places[pl.id].err) continue;
    try { const c = await cost(P, '__F_' + pl.id, 2, N); W[pl.id][P.tag].push(c.wallMs); W[pl.id][P.tag + 'Cpu'].push(c.cpuMs); } catch (e) { console.log(`  !! round ${rd + 1} ${P.tag} ${pl.id}: ${String(e.message || e).slice(0, 200)}`); }
  }
  console.log(`  round ${rd + 1}/${ROUNDS}: ` + PLACES.map(pl => `${pl.id} ${r1(W[pl.id].cur[rd])}/${r1(W[pl.id].prev[rd])} ms`).join(' · ') + ` (${secs()})`);
}
for (const pl of PLACES) {
  const w = W[pl.id], R = rec.places[pl.id] = { curMs: r1(med(w.cur)), prevMs: r1(med(w.prev)), curCpu: r1(med(w.curCpu)), prevCpu: r1(med(w.prevCpu)), rounds: { cur: w.cur.map(r1), prev: w.prev.map(r1) } };
  R.ratio = r3(R.curMs / R.prevMs); R.ratioCpu = r3(R.curCpu / R.prevCpu);
  const a = rec.pages.cur.places[pl.id] || {}, b = rec.pages.prev.places[pl.id] || {};
  R.draws = [a.draws, b.draws]; R.tris = [a.tris, b.tris];
  console.log(`  ${pl.id}: ${TAG.cur} ${R.curMs} ms (CPU ${R.curCpu}) · ${TAG.prev} ${R.prevMs} ms (CPU ${R.prevCpu}) → ×${R.ratio} (CPU ×${R.ratioCpu}) · draws ${R.draws.join(' / ')} · tris ${R.tris.join(' / ')}`);
  check(Number.isFinite(R.ratio) && R.ratio <= 1.03, `${pl.id}: Very Low not slower than ${TAG.prev} (×${R.ratio} ≤ 1.03)`);
}
save();

// /raum herz on this build against its own plaza (space0.mjs's view: day 2, noon, toward Helia)
const A0 = A, B0 = B;
rec.spaceBy = {};
if (!process.env.NO_SPACE) for (const A of [A0, B0]) {
  try {
    await A.ev(() => { if (VR.UIPrefs) VR.UIPrefs.set({ pro: true }); const ui = VR.game.ui, cl = ui.chatLine.bind(ui); window.__lines = []; ui.chatLine = (t, c) => { window.__lines.push(String(t)); return cl(t, c); }; });
    await A.ev(() => { const g = VR.game, p = g.player, SS = VR.SpaceScene, BT = VR.BodyTex; g.env.day = 2; g.env.ticks = 6000; if (SS && BT) { const sp = BT.toSphere(p.pos[0], p.pos[2]), e = SS.ephemeris(SS.worldTime(2, 6000), {}), s = SS.localSun(e, sp[0], sp[1]); p.yaw = p.viewYaw = SS.yawFor(s.az - 0.3, p.pos[0], p.pos[2]); } g.chat('/raum herz'); });
    const t1 = Date.now(); let st = null;
    for (let i = 0; i < 600; i++) {
      await A.step(3);
      st = await A.ev(() => { const g = VR.game, SS = VR.SpaceScene, need = (SS && SS.cur_need) || []; return g.space ? { ready: g.space.ready, frames: g.space.frames, done: need.filter(s => s.done).length, need: need.length } : { closed: true }; });
      if (st.closed || (st.ready && st.done === st.need && st.frames >= 3)) break;
      if (Date.now() - t1 > 300000) break;
      await A.wait(40);
    }
    await A.ev(() => { window.__F_space = window.__F; });
    const m = await picture(A, '__F_space', SHOTS + `${PFX}_space_herz_${TAG[A.tag]}.png`, 2);
    const cp = [], cs = [], wp = [], ws = [];
    for (let rd = 0; rd < ROUNDS; rd++) {
      const order = rd % 2 ? ['__F_space', '__F_plaza'] : ['__F_plaza', '__F_space'];
      for (const key of order) { const c = await cost(A, key, 2, N); if (key === '__F_space') { cs.push(c.cpuMs); ws.push(c.wallMs); } else { cp.push(c.cpuMs); wp.push(c.wallMs); } }
    }
    rec.space = rec.spaceBy[A.tag] = { shownS: r1((Date.now() - t1) / 1000), state: st, draws: m.draws, err: m.err, spaceMs: r1(med(ws)), plazaMs: r1(med(wp)), spaceCpu: r1(med(cs)), plazaCpu: r1(med(cp)), prevPlazaMs: rec.places.plaza ? rec.places.plaza.prevMs : null };
    console.log(`  ${A.tag} space (/raum herz): ${rec.space.spaceMs} ms (CPU ${rec.space.spaceCpu}) against this build's plaza ${rec.space.plazaMs} ms (CPU ${rec.space.plazaCpu}); ${m.draws} draws; shown after ${rec.space.shownS} s`);
    check(st && st.ready && rec.space.spaceMs <= rec.space.plazaMs, `Very Low: the space frame is not dearer than the plaza (${rec.space.spaceMs} ≤ ${rec.space.plazaMs} ms)`);
    await A.ev(() => { if (VR.game.space) VR.game.chat('/raum'); }).catch(() => {});
  } catch (e) { check(false, 'space: ' + String(e.stack || e.message || e).slice(0, 300)); }
  save();
}
if (rec.spaceBy.cur && rec.spaceBy.prev) { rec.space = rec.spaceBy.cur; rec.space.ratio = r3(rec.spaceBy.cur.spaceMs / rec.spaceBy.prev.spaceMs); rec.space.ratioCpu = r3(rec.spaceBy.cur.spaceCpu / rec.spaceBy.prev.spaceCpu); console.log(`  space: ${TAG.cur} ${rec.spaceBy.cur.spaceMs} ms (CPU ${rec.spaceBy.cur.spaceCpu}) · ${TAG.prev} ${rec.spaceBy.prev.spaceMs} ms (CPU ${rec.spaceBy.prev.spaceCpu}) → ×${rec.space.ratio} (CPU ×${rec.space.ratioCpu})`); }
save();
for (const P of [A, B]) { const e = errsOf(P); check(e.length === 0, `${P.tag}: no page error (${e.length})` + (e.length ? ': ' + e[0].slice(0, 300) : '')); }
await A.ctx.close().catch(() => {}); await B.ctx.close().catch(() => {});
await browser.close();

// the sheet: a row a place, this build | the previous release (PIL; a label over each picture)
try {
  const rows = PLACES.map(p => p.id).concat(rec.space ? ['space_herz'] : []);
  const spec = { rows: rows.map(id => ({ id, a: SHOTS + `${PFX}_${id}_${TAG.cur}.png`, b: SHOTS + `${PFX}_${id}_${TAG.prev}.png`, label: id === 'space_herz' ? `space /raum herz: ${TAG.cur} ${rec.spaceBy.cur && rec.spaceBy.cur.spaceMs} ms · ${TAG.prev} ${rec.spaceBy.prev && rec.spaceBy.prev.spaceMs} ms · ×${rec.space && rec.space.ratio}` : `${id}: ${TAG.cur} ${rec.places[id] && rec.places[id].curMs} ms · ${TAG.prev} ${rec.places[id] && rec.places[id].prevMs} ms · ×${rec.places[id] && rec.places[id].ratio}` })) };
  fs.writeFileSync(ROOT + '.tmp_tests/critic_vl_sheet.json', JSON.stringify(spec));
  const py = `import json,sys\nfrom PIL import Image, ImageDraw\nS=json.load(open(sys.argv[1]));W,H=640,360;out=Image.new('RGB',(W*2+12,(H+26)*len(S['rows'])),(14,14,20));d=ImageDraw.Draw(out)\nfor i,r in enumerate(S['rows']):\n  y=i*(H+26);d.text((6,y+6),r['label']+'   [links neu | rechts vorher]',fill=(240,240,245))\n  for j,k in enumerate(['a','b']):\n    p=r.get(k)\n    if not p: continue\n    try: im=Image.open(p).convert('RGB').resize((W,H))\n    except Exception: continue\n    out.paste(im,(j*(W+12),y+26))\nout.save(sys.argv[2])\n`;
  fs.writeFileSync(ROOT + '.tmp_tests/critic_vl_sheet.py', py);
  execSync(`python3 -I ${ROOT}.tmp_tests/critic_vl_sheet.py ${ROOT}.tmp_tests/critic_vl_sheet.json ${SHOTS}${PFX}_sheet.png`);
  console.log('  sheet test/shots/' + PFX + '_sheet.png');
} catch (e) { console.log('  (no sheet: ' + String(e.message || e).slice(0, 200) + ')'); }
save();
console.log(`\n${fails ? 'FAILED ' + fails : 'ALL OK'} (${secs()})`);
process.exit(fails ? 1 : 0);

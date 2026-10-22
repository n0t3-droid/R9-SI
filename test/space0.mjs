// u-space0 · the space scene in the browser (docs/superpowers/plans/2026-10-22-u-space0.md §3): /raum's views on High and
// Very Low in a new default world (seed 53, the Heartland; creative with cheats — /raum sits with the cheat commands),
// 1280 × 720, de-DE. A page a preset: the world settles round the temple plaza (light2.mjs's 'temple' eye) at noon and
// its frame is kept (the plaza frame); then each view is opened the way a player opens it — the world clock set to the
// view's moment (the times test/space0_offline.js tuned: findTime's for the giant and the moons, the Heartland's noon,
// its last hour of night and its dawn), the player turned (the herz views toward Helia's azimuth there: SS.yawFor), the
// chat line '/raum <view>' — and stepped until its textures are all in (the worker's bodytex jobs), then pictured.
//   pictures  test/shots/space0_<view>_<high|vl>.png — herz_day (noon, toward Helia: the glint), herz_night (the hour
//             before dawn: the villages' lights, the airglow, the dawn on the limb), herz_dawn (Helia over the limb),
//             amarant (the giant and its ring over Herzwelt's limb), zinn (the giant 37° wide over Zinnober's pole),
//             aqua (Aquamarin and Herzwelt behind it); space0_plaza_<high|vl>.png (the world frame the costs compare
//             with); the sheet test/shots/space0_sheet.jpg (High · Very Low, a row a view)
//   numbers   the draws of a space frame (≤ 12); the GPU bytes of its textures (SS.stats: ≤ 24 MB Very Low, ≤ 96 MB
//             High); the worker's time of every bodytex job (≤ 0.8 s; a body of 512 × 256 is one job on Very Low) and the
//             wall time till a view's textures are in; the six programs compiled; Very Low: the space frame against
//             the plaza frame on the same page (rounds in turns, the medians: not slower); no page error
// → .tmp_tests/space0_run.json (every number); one line a view.
// usage: nohup bash test/wt_run.sh space0.mjs 3600 > .tmp_tests/space0.log 2>&1 &
//   PRESETS=high,potato · ONLY=herz_day,zinn · SEED=53 · RD=8 · ROUNDS=3 · K=3 (frames a picture)
// regress: skip  (a showcase: the pictures are the evidence; the gates are test/space0.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import sharp from '/home/dev/.npm-global/lib/node_modules/sharp/lib/index.js';
import fs from 'fs';
import { execSync, execFileSync } from 'child_process';
const ROOT = new URL('../', import.meta.url).pathname;   // this checkout (the test runs from test/ or from .tmp_tests/)
const DIST = process.env.DIST || 'file://' + ROOT + 'dist/index.html';
const SHOTS = ROOT + 'test/shots/';
const SEED = process.env.SEED || '53', RD = +(process.env.RD || 8), ROUNDS = +(process.env.ROUNDS || 3), K = +(process.env.K || 3);
const PRESETS = (process.env.PRESETS || 'high,potato').split(',');
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const TAGP = { high: 'high', potato: 'vl' }, NAMEP = { high: 'High', potato: 'Very Low' };
const EYE = 1.62;
// the views: the chat word, the world clock (day, ticks), the turn toward Helia's azimuth (rad, + = clockwise; null: the
// player's own look), the cost measured on it
const VIEWS = [
  { id: 'herz_day', cmd: 'herz', day: 2, ticks: 6000, sun: -0.3, cost: true },
  { id: 'herz_night', cmd: 'herz', day: 2, ticks: 21500, sun: 0 },
  { id: 'herz_dawn', cmd: 'herz', day: 2, ticks: 22300, sun: 0 },
  { id: 'amarant', cmd: 'amarant', day: 20, ticks: 14400, sun: null },
  { id: 'zinn', cmd: 'zinn', day: 6, ticks: 19200, sun: null },
  { id: 'aqua', cmd: 'aqua', day: 14, ticks: 14400, sun: null },
].filter(v => !ONLY || ONLY.includes(v.id));
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const r1 = (x) => Math.round(x * 10) / 10;
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
const rec = { dist: DIST, seed: SEED, presets: {} };
const save = () => { try { fs.writeFileSync(ROOT + '.tmp_tests/space0_run.json', JSON.stringify(rec, null, 1)); } catch (e) { /* a convenience */ } };

// the picture's spread of lightness (a blank or one-colour frame has none)
const spread = async (path) => {
  const { data, info } = await sharp(path).raw().toBuffer({ resolveWithObject: true });
  const C = info.channels; let s = 0, s2 = 0, n = 0;
  for (let i = 0; i < data.length; i += C * 7) { const L = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]; s += L; s2 += L * L; n++; }
  const m = s / n; return { mean: r1(m), sd: r1(Math.sqrt(Math.max(0, s2 / n - m * m))) };
};

// ---------------------------------------------------------------- the browser, a page (light2.mjs's helpers, trimmed)
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
// the CPU time (ms) of this test's browser processes (every process below this node process — ipu.mjs)
const cpuNow = () => {
  const kids = new Map();
  for (const l of execSync('ps -e -o pid=,ppid=').toString().trim().split('\n')) { const [p, pp] = l.trim().split(/\s+/).map(Number); if (!kids.has(pp)) kids.set(pp, []); kids.get(pp).push(p); }
  let t = 0; const st = [process.pid];
  while (st.length) { for (const c of kids.get(st.pop()) || []) { st.push(c); try { const s = fs.readFileSync(`/proc/${c}/stat`, 'utf8'), f = s.slice(s.lastIndexOf(')') + 2).split(' '); t += +f[11] + +f[12]; } catch (e) { } } }
  return t * 10;
};
async function openPage() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail|missing|incomplete/i.test(s)) logs.push(`[${t}] ${s.slice(0, 600)}`); });
  page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
  page.on('crash', () => { logs.push('[pageerror] the page crashed'); console.log('  !! the page crashed'); });
  await page.goto(DIST);
  const wait = (ms) => page.waitForTimeout(ms);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
  // the render stub: while __norender the steps draw nothing, the frame object of the last step is kept (__F)
  await ev(() => {
    const r = VR.game.renderer, gl = r.gl;
    window.__px = new Uint8Array(4);
    window.__sync = () => { const d = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING), rd = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, window.__px); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, d); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, rd); };
    r._render = r.render;
    r.render = function (F) { if (window.__norender) { window.__F = F; this.setupCamera(F.cam); return; } return this._render(F); };
  });
  const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(4); } };
  const boost = (on) => ev((on) => { const q = VR.game.renderer && VR.game.renderer.q; if (!q) return; if (on) { if (q.__up === undefined) q.__up = q.upload; q.upload = 24; } else if (q.__up !== undefined) { q.upload = q.__up; delete q.__up; } }, on);
  // settled: nothing to generate, mesh, upload or fade in round the eye (a dirty count that stops falling for six rounds
  // counts — beauty_audit.mjs)
  const settle = async (max = 400) => {
    let s = null, last = Infinity, stall = 0;
    await boost(true);
    for (let i = 0; i < max; i++) {
      await step(10);
      s = await ev(() => { const g = VR.game, w = g.world, p = g.player, rd = Math.max(1, (w.renderDist | 0) - 1), ri = Math.max(1, rd - 2), pcx = Math.floor(p.pos[0]) >> 4, pcz = Math.floor(p.pos[2]) >> 4; let dirty = 0; for (const c of w.cols.values()) { let n = 0; for (const sc of c.sec) if ((sc.dirty || sc.pending) && sc.count > 0) n++; const ex = c.cx - pcx, ez = c.cz - pcz; if (n && ex * ex + ez * ez <= ri * ri) dirty += n; } let unshown = 0; for (let dz = -rd; dz <= rd; dz++) for (let dx = -rd; dx <= rd; dx++) { if (dx * dx + dz * dz > rd * rd) continue; const c = w.col(pcx + dx, pcz + dz); if (!c || !(c.shownAt >= 0)) unshown++; } return { busy: g.pool.busy, pend: w.pending.size, dirty, up: w.uploadQ ? w.uploadQ.size : 0, fading: w.fading ? w.fading.size : 0, unshown, arr: w.arrivals ? w.arrivals.length : 0 }; });
      const shown = s.pend === 0 && s.up === 0 && s.fading === 0 && s.unshown === 0 && s.arr === 0;
      stall = shown && s.dirty >= last ? stall + 1 : 0; last = s.dirty;
      s.i = i;
      if (shown && ((s.busy === 0 && s.dirty === 0) || stall >= 6)) break;
      await wait(60);
    }
    await boost(false);
    return s;
  };
  const groundY = (x, z) => ev(([x, z]) => { const w = VR.game.world, R = VR.R, F = VR.F; for (let y = 200; y > 30; y--) { const s = w.getBlock(Math.floor(x), y, Math.floor(z)); if (s && (R.T.flags[s] & (F.OPAQUE | F.FLUID)) && !(R.T.flags[s] & F.LEAVES)) return y; } return 80; }, [x, z]);
  const pose = (x, feet, z, yaw, pitch, fov) => ev(([x, y, z, yaw, pitch, fov]) => { const g = VR.game, p = g.player; p.flying = true; p.noclip = true; p.teleport(x, y, z); p.yaw = yaw; p.pitch = pitch; p.viewYaw = yaw; p.fovKick = 0; p.vel = [0, 0, 0]; g.settings.fov = fov; const e = g.entities; if (e && e.mobs) e.mobs.length = 0; }, [x, feet, z, yaw, pitch, fov]);
  return { ctx, page, logs, ev, wait, step, settle, groundY, pose };
}
const errsOf = (P) => P.logs.filter(l => l.startsWith('[pageerror]'));
async function makeWorld(P, preset) {
  await P.ev(([p, rd]) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.renderDist = Math.min(rd, (VR.Game.PRESETS[p] || {}).renderDist || rd); g.applySettings('*'); }, [preset, RD]);
  await P.ev((seed) => VR.game.createWorld({ name: 'Raum', mode: 'creative', difficulty: 'peaceful', type: 'default', seed, cheats: true, kit: true }), SEED);
  for (let i = 0; i < 150; i++) { await P.wait(1000); if (await P.ev(() => VR.game.state) === 'play') break; }
  const ok = await P.ev(() => VR.game.state) === 'play';
  // (the game's own frames stop once the world is there: from now on the test steps the loop itself)
  await P.ev(() => { const g = VR.game; g.zenFreezeTime = true; g.zenFreezeWeather = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; for (const id of ['hud', 'ui', 'hints']) { const h = document.getElementById(id); if (h) h.style.display = 'none'; } });
  return ok;
}
// a kept frame (window[key]) drawn k times, the screen read back into a picture
const picture = async (P, key, path, k) => {
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
// a kept frame's cost: k frames to warm, then n timed frames (each synced; the CPU time of the browser round them)
const cost = async (P, key, k, n) => {
  await P.ev(([key, k]) => { const r = VR.game.renderer, F = window[key]; window.__norender = false; r.frameNo = 1000; r.tsrReset = true; r.shadowValid = false; for (let i = 0; i < k; i++) r.render(F); window.__sync(); window.__norender = true; }, [key, k]);
  const c0 = cpuNow();
  const wall = await P.ev(([key, n]) => { const r = VR.game.renderer, F = window[key], out = []; window.__norender = false; for (let i = 0; i < n; i++) { const t0 = performance.now(); r.render(F); window.__sync(); out.push(performance.now() - t0); } window.__norender = true; return out; }, [key, n]);
  return { cpuMs: (cpuNow() - c0) / n, wallMs: med(wall) };
};

// ---------------------------------------------------------------- a preset
async function runPreset(preset) {
  const tag = TAGP[preset] || preset, R = rec.presets[tag] = { views: {}, cost: {} };
  console.log(`\n${NAMEP[preset] || preset} (${secs()})`);
  const P = await openPage();
  try {
    const info = await P.ev(() => ({ gpu: VR.GL && VR.GL.rendererName, space: !!VR.SpaceScene, raum: !!(VR.Game && VR.Game.prototype.raumCommand), shaders: !!VR.SpaceShaders, bodytex: !!VR.BodyTex }));
    check(info.space && info.raum && info.shaders && info.bodytex, `the build has the space scene (${JSON.stringify(info)})`);
    const ok = await makeWorld(P, preset);
    check(ok, `the world is loaded (${secs()})`);
    if (!ok) return;
    // the chat commands are a Profi thing (start.js: Einfach answers every command outside its friendly list with a note —
    // run 2 met it), and the chat's lines are kept for the log
    await P.ev(() => { if (VR.UIPrefs) VR.UIPrefs.set({ pro: true }); const ui = VR.game.ui, cl = ui.chatLine.bind(ui); window.__lines = []; ui.chatLine = (t, c) => { window.__lines.push(String(t)); return cl(t, c); }; });
    // the plaza: the temple from the plaza path at noon (light2.mjs 'temple')
    const px = 4.5, pz = 74.5;
    await P.ev(([x, z]) => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(x, 150, z); }, [px, pz]);
    const s0 = await P.settle(1500);
    const gy = await P.groundY(px, pz), eyeY = gy + 1 + EYE, at = [0, 93, 0];
    const yaw = Math.atan2(-(at[0] - px), -(at[2] - pz)), pitch = Math.atan2(at[1] - eyeY, Math.hypot(at[0] - px, at[2] - pz));
    await P.ev(() => { const g = VR.game; g.env.day = 2; g.env.setTime(6000); });
    await P.pose(px, eyeY - EYE, pz, yaw, pitch, 70);
    const s1 = await P.settle(600);
    await P.step(4);
    await P.ev(() => { window.__Fplaza = window.__F; });
    const pp = SHOTS + `space0_plaza_${tag}.png`, pm = await picture(P, '__Fplaza', pp, K);
    R.plaza = { settle: [s0 && s0.i, s1 && s1.i], draws: pm.draws, err: pm.err };
    check(!pm.err && (await spread(pp)).sd > 3, `the plaza frame (${pm.err || pm.draws + ' draws'}; settled in ${s0 && s0.i} + ${s1 && s1.i} rounds, ${secs()})`);
    // the views
    let firstWall = null;
    for (const v of VIEWS) {
      const t1 = Date.now();
      try {   // (a view that throws is logged and the next one runs)
      await P.ev(([d, tk, sun, cmd]) => {
        const g = VR.game, p = g.player, SS = VR.SpaceScene, BT = VR.BodyTex;
        g.env.day = d; g.env.ticks = tk;
        if (sun !== null) { const sp = BT.toSphere(p.pos[0], p.pos[2]), e = SS.ephemeris(SS.worldTime(d, tk), {}), s = SS.localSun(e, sp[0], sp[1]); p.yaw = p.viewYaw = SS.yawFor(s.az + sun, p.pos[0], p.pos[2]); }
        g.chat('/raum ' + cmd);
      }, [v.day, v.ticks, v.sun, v.cmd]);
      const opened = await P.ev(() => ({ open: !!VR.game.space, line: (window.__lines || []).slice(-1)[0] || '' }));
      if (!opened.open) { check(false, `${v.id}: /raum ${v.cmd} did not open the view (the chat: “${opened.line}”)`); continue; }
      // stepped till the view is shown and every texture it asked for is in (the worker's jobs), 240 s at most
      let st = null;
      for (let i = 0; i < 600; i++) {
        await P.step(3);
        st = await P.ev(() => { const g = VR.game, SS = VR.SpaceScene, need = SS.cur_need || []; return g.space ? { ready: g.space.ready, frames: g.space.frames, done: need.filter(s => s.done).length, need: need.length } : { closed: true }; });
        if (st.closed || (st.ready && st.done === st.need && st.frames >= 3)) break;
        if (Date.now() - t1 > 240000) break;
        await P.wait(40);
      }
      const wallS = (Date.now() - t1) / 1000;
      if (firstWall === null) firstWall = wallS;
      await P.ev(() => { window.__Fspace = window.__F; });
      const path = SHOTS + `space0_${v.id}_${tag}.png`;
      const m = await picture(P, '__Fspace', path, K);
      const S = await P.ev(() => { const g = VR.game, SS = VR.SpaceScene, s = SS.stats(g); s.list = SS.cur ? SS.cur.draws.map(d => d.prog).join(' ') : ''; s.nList = SS.cur ? SS.cur.draws.length : 0; s.exposure = SS.cur ? +SS.cur.look.exposure.toFixed(2) : null; return s; });
      const sp = m.err ? { sd: 0, mean: 0 } : await spread(path);
      const V = R.views[v.id] = { wallS: r1(wallS), state: st, draws: m.draws, list: S.list, nList: S.nList, gpuMB: S.gpuMB, exposure: S.exposure, sunVis: S.sunVis, progs: S.progs, failed: S.failed, picture: sp, err: m.err };
      console.log(`  ${v.id}: ${st && st.ready ? 'shown' : 'NOT shown'} after ${r1(wallS)} s (textures ${st ? st.done + '/' + st.need : '?'}), ${m.err ? 'ERR ' + m.err : m.draws + ' draws (' + S.list + ')'}, exposure ${S.exposure}, picture L ${sp.mean} ± ${sp.sd} (${secs()})`);
      check(st && st.ready && st.done === st.need && !m.err, `${v.id}: shown with all its textures (${st ? st.done + '/' + st.need : '?'})`);
      check(m.draws <= 12 && S.nList <= 12, `${v.id}: ${m.draws} draws in the frame, ${S.nList} in the space scene's list (≤ 12)`);
      check(sp.sd > 3, `${v.id}: the picture is not blank (L spread ${sp.sd})`);
      check(S.progs === 6 && !S.failed.length, `${v.id}: the six programs compiled (${S.progs}${S.failed.length ? ', failed ' + S.failed.join(',') : ''})`);
      // the frame's cost against the plaza's on the same page (rounds in turns, the medians)
      if (v.cost) {
        const cp = [], cs = [], wp = [], ws = [];
        for (let rd = 0; rd < ROUNDS; rd++) {
          const a = await cost(P, '__Fplaza', 2, 6), b = await cost(P, '__Fspace', 2, 6);
          cp.push(a.cpuMs); cs.push(b.cpuMs); wp.push(a.wallMs); ws.push(b.wallMs);
        }
        R.cost = { plazaCpu: r1(med(cp)), spaceCpu: r1(med(cs)), plazaWall: r1(med(wp)), spaceWall: r1(med(ws)), rounds: ROUNDS };
        console.log(`  cost: plaza ${R.cost.plazaWall} ms (CPU ${R.cost.plazaCpu}) · space ${R.cost.spaceWall} ms (CPU ${R.cost.spaceCpu}) — the medians of ${ROUNDS} rounds in turns`);
        if (preset === 'potato') check(R.cost.spaceWall <= R.cost.plazaWall && R.cost.spaceCpu <= R.cost.plazaCpu * 1.03, `Very Low: the space frame is not dearer than the plaza frame (${R.cost.spaceWall} ≤ ${R.cost.plazaWall} ms, CPU ${R.cost.spaceCpu} ≤ ${R.cost.plazaCpu} ms)`);
      }
      } catch (e) { check(false, `${v.id}: ${String(e.stack || e.message || e).slice(0, 400)}`); }
      await P.ev(() => { if (VR.game.space) VR.game.chat('/raum'); }).catch(() => {});
      await P.step(2).catch(() => {});
      save();
    }
    // the textures: the GPU bytes and the worker's time of every job
    const S = await P.ev(() => VR.SpaceScene.stats(VR.game));
    R.gpuMB = S.gpuMB; R.jobs = S.jobs; R.firstWallS = r1(firstWall || 0);
    const cap = preset === 'potato' ? 24 : 96;
    check(S.gpuMB <= cap && (S.patches === undefined || S.patches <= 2), `the space textures take ${S.gpuMB} MB of the GPU (≤ ${cap} MB; ${S.patches} patches kept, ≤ 2)`);
    const jobs = Object.entries(S.jobs), worst = jobs.reduce((a, [k, j]) => (j.maxMs > a[1] ? [k, j.maxMs] : a), ['', 0]);
    console.log('  bodytex: ' + jobs.map(([k, j]) => `${k} ${j.w}×${j.h} ${j.jobs} job${j.jobs > 1 ? 's' : ''} ${j.ms} ms (max ${j.maxMs}, wall ${j.wall})`).join(' · '));
    check(jobs.length >= 8 && jobs.every(([, j]) => j.done), `every bodytex texture came back (${jobs.length})`);
    check(worst[1] <= 800, `no bodytex job longer than 0.8 s in the worker (the longest: ${worst[0]} ${worst[1]} ms)`);
    if (preset === 'potato') { const h = S.jobs['herz@0'], a = S.jobs['amarant@0']; check(h && a && h.w === 512 && h.ms <= 800 && a.ms <= 800, `a body at 512 × 256 within 0.8 s: Herzwelt ${h && h.ms} ms, Amarant ${a && a.ms} ms`); }
    check(errsOf(P).length === 0, `no page error (${errsOf(P).length})` + (errsOf(P).length ? ': ' + errsOf(P)[0].slice(0, 300) : ''));
    save();
  } catch (e) { check(false, `${NAMEP[preset]}: ${String(e.stack || e.message || e).slice(0, 500)}`); }
  finally { await P.ctx.close().catch(() => {}); }
}

for (const p of PRESETS) await runPreset(p);
await browser.close();

// ---------------------------------------------------------------- the sheet (High · Very Low, a row a view)
try {
  const rows = ['plaza'].concat(VIEWS.map(v => v.id)).map(id => ({ label: id, imgs: PRESETS.map(p => { const f = SHOTS + `space0_${id}_${TAGP[p] || p}.png`; return fs.existsSync(f) ? f : null; }) }));
  const spec = ROOT + '.tmp_tests/space0_sheet.json';
  fs.writeFileSync(spec, JSON.stringify({ cols: PRESETS.map(p => NAMEP[p] || p), w: 560, rows }));
  execFileSync('python3', ['/root/r9coord/sheet.py', SHOTS + 'space0_sheet.jpg', spec], { stdio: 'inherit' });
} catch (e) { console.log('  (no sheet: ' + String(e.message || e).slice(0, 200) + ')'); }
save();
console.log(`\n${fails ? fails + ' FAILED' : 'ALL OK'} (${secs()})`);
process.exit(fails ? 1 : 0);

// u-cruise · between the worlds of Helia in the browser (docs/superpowers/plans/2026-10-29-u-cruise.md §3): a shuttle on
// the Gate Temple's apron of a new default world (seed 53, creative), 1280 × 720, de-DE; High first, then Very Low.
//   pictures  test/shots/cruise_depart.png (the drive taking hold, Herzwelt falling away), cruise_mid.png (half way, Opal
//             ahead), cruise_arrive_opal.png (the drop-out into Opal's orbit), descent_opal.png / descent_basalt.png (the
//             ship sinking onto the moon, the regolith plume), cruise_landed_opal.png, cruise_vl_mid.png (Very Low), the
//             plaza frames; the chase camera behind the ship, the target beyond it; the sheet test/shots/cruise_sheet.jpg
//   numbers   the trip's time (the law's phases), the High cruise frame against the plaza frame on the same page, Very Low
//             the same; the frames while a descent streams (none over 2× the median); Heimkehr from Opal to the apron
//             (≤ 10 s); no page error
// → .tmp_tests/cruise_run.json.   usage: nohup bash test/wt_run.sh cruise.mjs 3600 > .tmp_tests/cruise.log 2>&1 &
//   PRESETS=high,potato · ONLY=cruise,opal,home,basalt · SEED=53 · RD=6 · K=3
// regress: skip  (a debug page: the cruise's frames; not a test)
// (a showcase: the pictures are the evidence; the gates are test/cruise.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import { execSync, execFileSync } from 'child_process';
const ROOT = new URL('../', import.meta.url).pathname;   // this checkout (the test runs from test/ or from .tmp_tests/)
const DIST = process.env.DIST || 'file://' + ROOT + 'dist/index.html';
const SHOTS = ROOT + 'test/shots/';
const BASE = process.env.BASE_DIST || (fs.existsSync(ROOT + '.tmp_tests/base0d0/dist/index.html') ? 'file://' + ROOT + '.tmp_tests/base0d0/dist/index.html' : '');
const SEED = process.env.SEED || '53', RD = +(process.env.RD || 8), ROUNDS = +(process.env.ROUNDS || 3), K = +(process.env.K || 3);
const PRESETS = (process.env.PRESETS || 'high,potato').split(',');
const SH = (n) => SHOTS + n;
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const want = (s) => !ONLY || ONLY.includes(s);
const TAGP = { high: 'high', potato: 'vl' }, NAMEP = { high: 'High', potato: 'Very Low' };
const ALTS = [300, 600, 900, 1200, 1500, 1800, 2100, 2400];
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const r1 = (x) => Math.round(x * 10) / 10;
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
const rec = { dist: DIST, seed: SEED, presets: {} };
const save = () => { try { fs.writeFileSync(ROOT + '.tmp_tests/cruise_run.json', JSON.stringify(rec, null, 1)); } catch (e) { /* a convenience */ } };
fs.mkdirSync(SHOTS, { recursive: true });
// ---------------------------------------------------------------- the browser, a page (space0.mjs's helpers)
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const cpuNow = () => {
  const kids = new Map();
  for (const l of execSync('ps -e -o pid=,ppid=').toString().trim().split('\n')) { const [p, pp] = l.trim().split(/\s+/).map(Number); if (!kids.has(pp)) kids.set(pp, []); kids.get(pp).push(p); }
  let t = 0; const st = [process.pid];
  while (st.length) { for (const c of kids.get(st.pop()) || []) { st.push(c); try { const s = fs.readFileSync(`/proc/${c}/stat`, 'utf8'), f = s.slice(s.lastIndexOf(')') + 2).split(' '); t += +f[11] + +f[12]; } catch (e) { } } }
  return t * 10;
};
async function openPage(url = DIST) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail|missing|incomplete/i.test(s)) logs.push(`[${t}] ${s.slice(0, 600)}`); });
  page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
  page.on('crash', () => { logs.push('[pageerror] the page crashed'); console.log('  !! the page crashed'); });
  await page.goto(url);
  const wait = (ms) => page.waitForTimeout(ms);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
  await ev(() => {
    const r = VR.game.renderer, gl = r.gl;
    window.__px = new Uint8Array(4);
    window.__sync = () => { const d = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING), rd = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, window.__px); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, d); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, rd); };
    r._render = r.render;
    r.render = function (F) { if (window.__norender) { window.__F = F; this.setupCamera(F.cam); return; } return this._render(F); };
  });
  const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(4); } };
  const boost = (on) => ev((on) => { const q = VR.game.renderer && VR.game.renderer.q; if (!q) return; if (on) { if (q.__up === undefined) q.__up = q.upload; q.upload = 24; } else if (q.__up !== undefined) { q.upload = q.__up; delete q.__up; } }, on);
  const settle = async (max = 400) => {
    let s = null, last = Infinity, stall = 0;
    await boost(true);
    for (let i = 0; i < max; i++) {
      await step(10);
      s = await ev(() => { const g = VR.game, w = g.world, p = g.player, rd = Math.max(1, (w.renderDist | 0) - 1), ri = Math.max(1, rd - 2), pcx = Math.floor(p.pos[0]) >> 4, pcz = Math.floor(p.pos[2]) >> 4; let dirty = 0; for (const c of w.cols.values()) { let n = 0; for (const sc of c.sec) if ((sc.dirty || sc.pending) && sc.count > 0) n++; const ex = c.cx - pcx, ez = c.cz - pcz; if (n && ex * ex + ez * ez <= ri * ri) dirty += n; } let unshown = 0; for (let dz = -rd; dz <= rd; dz++) for (let dx = -rd; dx <= rd; dx++) { if (dx * dx + dz * dz > rd * rd) continue; const c = w.col(pcx + dx, pcz + dz); if (!c || !(c.shownAt >= 0)) unshown++; } const hz = g.horizon; return { busy: g.pool.busy, pend: w.pending.size, dirty, up: w.uploadQ ? w.uploadQ.size : 0, fading: w.fading ? w.fading.size : 0, unshown, arr: w.arrivals ? w.arrivals.length : 0, hz: hz && hz.progress ? +hz.progress().toFixed(2) : 1 }; });
      const shown = s.pend === 0 && s.up === 0 && s.fading === 0 && s.unshown === 0 && s.arr === 0 && s.hz >= 0.98;
      stall = shown && s.dirty >= last ? stall + 1 : 0; last = s.dirty;
      s.i = i;
      if (shown && ((s.busy === 0 && s.dirty === 0) || stall >= 6)) break;
      await wait(60);
    }
    await boost(false);
    return s;
  };
  const groundY = (x, z) => ev(([x, z]) => { const w = VR.game.world, R = VR.R, F = VR.F; for (let y = 220; y > 30; y--) { const s = w.getBlock(Math.floor(x), y, Math.floor(z)); if (s && (R.T.flags[s] & (F.OPAQUE | F.FLUID)) && !(R.T.flags[s] & F.LEAVES)) return y; } return 80; }, [x, z]);
  return { ctx, page, logs, ev, wait, step, settle, groundY };
}
const errsOf = (P) => P.logs.filter(l => l.startsWith('[pageerror]'));
async function makeWorld(P, preset) {
  await P.ev(([p, rd]) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.camShake = false; g.settings.renderDist = Math.min(rd, (VR.Game.PRESETS[p] || {}).renderDist || rd); g.applySettings('*'); }, [preset, RD]);
  await P.ev((seed) => VR.game.createWorld({ name: 'Aufstieg', mode: 'creative', difficulty: 'peaceful', type: 'default', seed, cheats: true, kit: true }), SEED);
  for (let i = 0; i < 150; i++) { await P.wait(1000); if (await P.ev(() => VR.game.state) === 'play') break; }
  const ok = await P.ev(() => VR.game.state) === 'play';
  await P.ev(() => { const g = VR.game; g.zenFreezeTime = true; g.zenFreezeWeather = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; for (const id of ['hud', 'ui', 'hints']) { const h = document.getElementById(id); if (h) h.style.display = 'none'; } const ui = g.ui, cl = ui.chatLine.bind(ui); window.__lines = []; ui.chatLine = (t, c) => { window.__lines.push(String(t)); return cl(t, c); }; });
  return ok;
}
// a kept frame (window[key]) drawn k times, the screen read back into a picture (with the overlay canvas laid over)
const picture = async (P, key, path, k, overlay) => {
  // (the PNG made in the page: the read-back flipped into a 2D canvas, the screen's overlay drawn over it)
  const m = await P.ev(([key, k, overlay]) => {
    const g = VR.game, r = g.renderer, gl = r.gl, F = window[key];
    if (!F) return { err: 'no frame kept' };
    window.__norender = false;
    r.frameNo = 1000; r.tsrReset = true; r.shadowValid = false;
    try { for (let i = 0; i < k; i++) { if (g.cockpit) g.cockpit.drawnAt = -1; r.render(F); } } catch (e) { window.__norender = true; return { err: String(e && e.stack || e).slice(0, 600) }; }
    const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, px = new Uint8Array(W * H * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    window.__norender = true;
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'), id = x.createImageData(W, H);
    let s = 0, s2 = 0, n = 0;
    for (let y = 0; y < H; y++) { const src = (H - 1 - y) * W * 4; id.data.set(px.subarray(src, src + W * 4), y * W * 4); }
    for (let i = 0; i < id.data.length; i += 4) { id.data[i + 3] = 255; if ((i >> 2) % 7 === 0) { const L = 0.2126 * id.data[i] + 0.7152 * id.data[i + 1] + 0.0722 * id.data[i + 2]; s += L; s2 += L * L; n++; } }
    x.putImageData(id, 0, 0);
    let ov = false; const fx = document.getElementById('ascFx'); if (overlay && fx && fx.style.display !== 'none') { x.drawImage(fx, 0, 0, W, H); ov = true; }
    const mean = s / n;
    return { png: c.toDataURL('image/png').split(',')[1], W, H, draws: r.stats.draws, tris: Math.round(r.stats.tris), overlay: ov, mean: Math.round(mean * 10) / 10, sd: Math.round(Math.sqrt(Math.max(0, s2 / n - mean * mean)) * 10) / 10 };
  }, [key, k, !!overlay]);
  if (m.err) return m;
  fs.writeFileSync(path, Buffer.from(m.png, 'base64'));
  delete m.png;
  return m;
};
// the flown ship in a kept frame: the frame drawn as it is and once without the ship, the pixels that differ (runs 1–2 flew
// a hidden ship: nothing would have differed)
const shipSeen = (P, key) => P.ev((key) => {
  const g = VR.game, r = g.renderer, gl = r.gl, F = window[key], s = g.starships && g.starships.pilot;
  if (!F || !s) return { changed: 0, hidden: null };
  const was = !!s.hidden, W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
  const shot = (hide) => { s.hidden = hide; window.__norender = false; r.frameNo = 1000; r.tsrReset = true; if (g.cockpit) g.cockpit.drawnAt = -1; r.render(F); window.__norender = true; const px = new Uint8Array(W * H * 4); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; };
  const a = shot(was), b = shot(true); s.hidden = was;
  let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 30) n++;
  return { changed: n, hidden: was };
}, key);
const cost = async (P, key, k, n) => {
  await P.ev(([key, k]) => { const r = VR.game.renderer, F = window[key]; window.__norender = false; r.frameNo = 1000; r.tsrReset = true; r.shadowValid = false; for (let i = 0; i < k; i++) r.render(F); window.__sync(); window.__norender = true; }, [key, k]);
  const c0 = cpuNow();
  const wall = await P.ev(([key, n]) => { const r = VR.game.renderer, F = window[key], out = []; window.__norender = false; for (let i = 0; i < n; i++) { const t0 = performance.now(); r.render(F); window.__sync(); out.push(performance.now() - t0); } window.__norender = true; return out; }, [key, n]);
  return { cpuMs: (cpuNow() - c0) / n, wallMs: med(wall) };
};
// the ship's state, the space scene's textures
const st = (P) => P.ev(() => VR.SpaceFlight.debug.state(VR.game));
const spaceReady = (P) => P.ev(() => { const need = VR.SpaceScene.cur_need || []; return { done: need.filter(s => s.done).length, need: need.length }; });
// step until the space scene's textures are in (the patch round the nadir included), max ms
// (dtms: the game time a frame — in orbit 1 ms, so the ship waits where it was put: run 2's night picture was taken 97 km
// on, in that place's morning, the nadir's patch never caught up with a ship moving 4 km every five seconds)
const waitTex = async (P, maxMs, dtms = 33) => { const t0 = Date.now(); let s = null; for (;;) { await P.step(6, dtms); s = await spaceReady(P); if ((s.need && s.done === s.need) || Date.now() - t0 > maxMs) return s; await P.wait(60); } };
const view = (P, v, hp, hy) => P.ev(([v, hp, hy]) => { const fl = VR.game.flight; fl.view = v; VR.game.camMode = v === 0 ? 0 : 1; fl.headPitch = hp; fl.headYaw = hy || 0; fl.backT = 0; fl.recenter = false; fl.mouseIdle = 0; fl.chaseYaw = null; fl.shot = null; fl.shakeAmp = 0; fl.bump = 0; }, [v, hp, hy]);

// the plaza view: the Gate Temple from the plaza path at noon (space0.mjs), the animation clock pinned so the two builds
// draw the same moment; the frame kept as __Fplaza and pictured
async function plaza(P, path) {
  const px = 4.5, pz = 74.5;
  await P.ev(([x, z]) => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(x, 150, z); }, [px, pz]);
  await P.settle(1500);
  const gy = await P.groundY(px, pz), eyeY = gy + 1 + 1.62, at = [0, 93, 0];
  await P.ev(([x, y, z, at]) => { const g = VR.game, p = g.player; g.env.day = 2; g.env.setTime(6000); p.teleport(x, y - 1.62, z); p.yaw = p.viewYaw = Math.atan2(-(at[0] - x), -(at[2] - z)); p.pitch = Math.atan2(at[1] - y, Math.hypot(at[0] - x, at[2] - z)); g.settings.fov = 70; }, [px, eyeY, pz, at]);
  await P.settle(400);
  await P.step(60);   // (the last columns' fade-in: two seconds of game time — run 1's v0.49 page was caught mid-fade)
  await P.settle(60);
  await P.ev(() => { const e = VR.game.env; e.anim = 600; e.cloudDrift = [540, 0]; });
  await P.step(4);
  await P.ev(() => { window.__Fplaza = window.__F; });
  return picture(P, '__Fplaza', path, K);
}

const cr = (P) => P.ev(() => { const g = VR.game, fl = g.flight, a = fl && fl.asc, c = a && a.cruise, L = g.cruiseLand; return { regime: fl ? fl.regime || 'air' : null, frame: a ? a.st.frame : null, phase: c ? c.phase || c.kind : null, dist: c && c.dist, speed: c && c.speed, total: c && c.total, last: VR.Cruise.last, state: g.state, dim: g.dim, land: L ? { alt: L.alt, t: L.t, ready: L.tReady || null, hovered: L.hovered || 0 } : null, flState: fl ? fl.state : null }; });
// the chase camera behind the ship (the drive points the nose at the target: the target beyond the ship)
const chase = (P, hp, hy) => view(P, 1, hp, hy);
async function board(P) {
  const ap = await P.ev(() => VR.SpaceFlight.apron());
  const ay = await P.groundY(ap.x, ap.z);
  await P.ev(([x, y, z]) => { const g = VR.game, p = g.player; p.flying = false; p.noclip = false; p.teleport(x + 0.5, y + 1, z + 12.5); p.yaw = 0; g.starships.placeInFront(4242, 'shuttle', null, p); }, [ap.x, ay, ap.z]);
  const mine = () => P.ev(() => { const s = VR.game.starships.ships.find(q => q.d.seed === 4242 && !q.hangar); return !!(s && s.d.meta && s.d.cells); });
  for (let i = 0; i < 90; i++) { await P.step(4); if (await mine()) break; await P.wait(100); }
  return P.ev(() => { const g = VR.game, s = g.starships.ships.find(q => q.d.seed === 4242 && !q.hangar); if (!s || !s.d.meta || !s.d.cells) return null; g.starships.board(s, g.player); const fl = s.flight; fl.power = 'running'; fl.startT = 3; return { name: s.d.meta.name, pilot: g.starships.pilot === s }; });
}
// the hour when Opal is lit from Herzwelt's side (the ship comes at its day side) and Amarant stands beside the way

const P = await openPage();
await makeWorld(P, process.env.PRE || 'potato');
const bd = await board(P); console.log('board', JSON.stringify(bd));
await P.step(10);
await P.ev(() => { const g = VR.game; g.env.day = 36; g.env.setTime(15000); VR.SpaceFlight.debug.orbit(g, 0, 40, 3063); });
await view(P, 1, 0.2, 0);
await waitTex(P, 60000, 1); await P.step(4);
await P.ev(() => VR.Cruise.start(VR.game.flight, 'opal'));
for (let i = 0; i < 2000; i++) { await P.step(6); const s = await cr(P); if (!s.phase || (s.phase === 'cruise' && s.dist < 140000)) break; }
await waitTex(P, 20000, 1);
const info = await P.ev(() => {
  const g = VR.game, fl = g.flight, a = fl.asc, st = a.st, S = VR.Universe.home, A = VR.Ascent;
  const pf = S.pos(st.frame, st.t, new Float64Array(3)), P0 = [pf[0] + st.r[0], pf[1] + st.r[1], pf[2] + st.r[2]], q = S.pos('opal', st.t, new Float64Array(3));
  const d = [q[0] - P0[0], q[1] - P0[1], q[2] - P0[2]], l = Math.hypot(...d), M = A.localFrame(st, new Float64Array(9));
  const dm = [0, 1, 2].map(i => (M[i] * d[0] + M[3 + i] * d[1] + M[6 + i] * d[2]) / l);
  const fr = VR.SpaceFlight.cur, ob = fr.bodies.opal, od = fr.draws.find(x => x.prog === 'moon' && x.tex.u_tex === 'opal');
  const eph = VR.SpaceFlight.eph, sp = eph.bodies.opal.p, cam = fr.pos, rel = [sp[0] - cam[0], sp[1] - cam[1], sp[2] - cam[2]];
  return { frame: st.frame, blend: VR.Cruise.blend, cam: g.cam, heading: fl.b.heading, pitch: fl.pitch, roll: fl.roll, opalMap: dm, M: Array.from(M), axes: fr.axes, cdir: od && od.u.u_cdir, ob, relScene: rel.map(x => x / Math.hypot(...rel)), t: st.t, ephT: eph.t, ephSrc: eph.src };
});
console.log(JSON.stringify(info, null, 0));
await P.ev(() => { window.__Fx = window.__F; });
await picture(P, '__Fx', SHOTS + 'dbg_chase.png', 2);
await view(P, 0, 0, 0); await P.step(2); await P.ev(() => { window.__Fx = window.__F; });
await picture(P, '__Fx', SHOTS + 'dbg_cockpit.png', 2);
await browser.close();

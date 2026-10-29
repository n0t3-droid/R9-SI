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
// regress: skip  (a showcase: the pictures are the evidence; the gates are test/cruise.js)
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
async function pickHour(P) {
  return P.ev(() => {
    const U = VR.Universe, S = U.home; let best = null;
    for (let day = 2; day < 40; day++) for (let tk = 0; tk < 24000; tk += 600) {
      const t = U.worldSeconds(day, tk), st = S.state(t), o = st.b.opal.r, h = st.b.herz.r, sun = st.b.helia.r, a = st.b.amarant.r;
      const u = (p, q) => { const d = [p[0] - q[0], p[1] - q[1], p[2] - q[2]], l = Math.hypot(...d); return [d[0] / l, d[1] / l, d[2] / l]; };
      const toS = u(sun, o), toH = u(h, o), lit = toS[0] * toH[0] + toS[1] * toH[1] + toS[2] * toH[2];
      const D = Math.hypot(o[0] - h[0], o[1] - h[1], o[2] - h[2]);
      const ah = u(a, h), oh = u(o, h), sep = Math.acos(Math.max(-1, Math.min(1, ah[0] * oh[0] + ah[1] * oh[1] + ah[2] * oh[2]))) * 180 / Math.PI;
      const sc = lit * 2 + (sep > 12 && sep < 40 ? 1 : 0) - D / 1.2e7;
      if (!best || sc > best.sc) best = { day, tk, lit: +lit.toFixed(2), sep: +sep.toFixed(0), D: Math.round(D / 1000), sc };
    }
    const g = VR.game; g.env.day = best.day; g.env.setTime(best.tk);
    return best;
  });
}
// frames rendered for real, each synced: their times (ms)
const realFrames = (P, n) => P.ev((n) => { const g = VR.game, out = []; window.__norender = false; for (let i = 0; i < n; i++) { const t0 = performance.now(); g.last = t0 - 33; g.loop(t0); window.__sync(); out.push(+(performance.now() - t0).toFixed(1)); } window.__norender = true; return out; }, n);
async function waitPlay(P, maxMs) { const t0 = Date.now(); for (;;) { await P.step(2); const s = await P.ev(() => VR.game.state); if (s === 'play') return true; if (Date.now() - t0 > maxMs) return false; await P.wait(150); } }
const keep = (P, k) => P.ev((k) => { window[k] = window.__F; }, k);
// the descent into the world below the orbit (V): the trip, the ship over the site, the frames while it streams, the
// plume picture at ~30 m, the landing
async function descent(P, body, tag, Rr) {
  const D = Rr['descent_' + body] = {};
  await P.ev(() => VR.SpaceFlight.land(VR.game.flight));
  for (let i = 0; i < 40; i++) { await P.step(10); const s = await cr(P); if (s.state !== 'play' || s.dim !== 'overworld') break; }
  const t0 = Date.now(), ok = await waitPlay(P, 120000);
  await P.step(2);
  D.tripMs = Date.now() - t0;
  let s = await cr(P);
  for (let i = 0; i < 200 && !s.land; i++) { await P.step(5); await P.wait(50); s = await cr(P); }
  check(ok && s.dim === body && !!s.land, `${body}: the trip with the ship, flying over the site (${s.dim}, ${s.land ? Math.round(s.land.alt) + ' m up' : 'not in the air'}) (${secs()})`);
  if (!s.land) return D;
  // the frames while the near columns stream in (rendered and synced; the first three are the upload's warm-up)
  const fr = await realFrames(P, 40), ms = fr.slice(3), m = med(ms), mx = Math.max(...ms);
  D.frames = { median: m, max: mx, all: fr };
  console.log(`  ${body}: the descent's frames while it streams: median ${m} ms, max ${mx} ms (${secs()})`);
  check(mx <= 2 * m, `${body}: no frame over twice the median while the descent streams (${mx} ≤ 2 × ${m} ms)`);
  // down to ~30 m (the hover while the site is surveyed on the way)
  let shot = false;
  for (let i = 0; i < 700; i++) {
    await P.step(10); s = await cr(P);
    if (!s.land) break;
    if (!shot && s.land.alt < 34 && s.land.alt > 12) {
      await chase(P, 0.32, 2.6); await P.step(3);
      await keep(P, '__Fd'); const mm = await picture(P, '__Fd', SH(`descent_${body}${tag}.png`), K);
      D.plume = { alt: Math.round(s.land.alt), draws: mm.draws, err: mm.err || null }; shot = true;
      console.log(`  ${body}: the plume picture at ${Math.round(s.land.alt)} m (${mm.err || mm.draws + ' draws'}) (${secs()})`);
    }
    if (i % 20 === 0) { await P.wait(40); if (i % 100 === 0) console.log(`    ${body}: ${s.flState}, ${Math.round(s.land.alt)} m, t ${r1(s.land.t)} s, ready ${s.land.ready}, hovered ${r1(s.land.hovered)} s`); }
  }
  const fin = await cr(P);
  D.hovered = s.land ? s.land.hovered : null; D.landed = fin.flState === 'landed';
  check(shot && D.landed, `${body}: down through the plume and landed (${fin.flState})`);
  if (D.landed) { await P.settle(300); await chase(P, 0.22, 2.2); await P.step(4); await keep(P, '__Fl'); await picture(P, '__Fl', SH(`cruise_landed_${body}${tag}.png`), K); }
  return D;
}

async function runPreset(preset) {
  const tag = TAGP[preset] || preset, hi = preset !== 'potato', Rr = rec.presets[tag] = {};
  const sfx = hi ? '' : '_vl';
  console.log(`\n${NAMEP[preset] || preset} (${secs()})`);
  const P = await openPage();
  try {
    const ok = await makeWorld(P, preset);
    check(ok, `the world is loaded (${secs()})`); if (!ok) return;
    const pm = await plaza(P, SH(`cruise_plaza_${tag}.png`));
    const pc = await cost(P, '__Fplaza', 2, hi ? 4 : 6);
    Rr.plaza = { draws: pm.draws, wall: r1(pc.wallMs), cpu: r1(pc.cpuMs) };
    console.log(`  the plaza frame: ${Rr.plaza.wall} ms (CPU ${Rr.plaza.cpu}), ${pm.draws} draws (${secs()})`);
    const bd = await board(P);
    check(!!bd && bd.pilot, `the shuttle on the apron, boarded (${bd && bd.name})`); if (!bd) return;
    await P.step(20);
    const hour = Rr.hour = await pickHour(P);
    console.log(`  the hour: day ${hour.day} tick ${hour.tk} (Opal lit ${hour.lit}, Amarant ${hour.sep}° off the way, ${hour.D} km) (${secs()})`);
    // ---- the cruise to Opal from a low orbit over the Heartland
    if (want('cruise')) {
      await P.ev(() => { const g = VR.game; VR.SpaceFlight.debug.orbit(g, 0, 40, 3063); });
      await chase(P, 0.1, 0);
      await waitTex(P, 60000, 1); await P.step(6);
      const started = await P.ev(() => VR.Cruise.start(VR.game.flight, 'opal'));
      check(started, 'the Reiseantrieb to Opal engaged');
      let s = await cr(P), dep = false, mid = false, half = false, D0 = null;
      for (let i = 0; i < 2000 && s.phase; i++) {
        await P.step(hi ? 3 : 6); s = await cr(P);
        if (D0 === null && s.dist) D0 = s.dist;
        if (hi && !dep && s.phase === 'depart' && s.total > 2.4) {
          // the departure from the side and a little ahead, looking back along the ship at Herzwelt falling away
          await chase(P, 0.12, 2.3); await P.step(1); await keep(P, '__Fc1');
          const m = await picture(P, '__Fc1', SH('cruise_depart.png'), K, true); dep = true;
          check(!m.err && m.sd > 4, `depart: the picture not blank (L ${m.mean} ± ${m.sd})`);
          console.log(`  depart: ${Math.round(s.speed)} m/s, ${Math.round(s.dist / 1000)} km to go (${m.err || m.draws + ' draws'}) (${secs()})`);
          await chase(P, 0.1, 0);
        }
        if (hi && !half && s.phase === 'cruise' && s.dist < 0.5 * D0) {
          await chase(P, 0.14, 0.35); await P.step(1); await keep(P, '__Fc4');
          const m = await picture(P, '__Fc4', SH('cruise_half.png'), K); half = true;
          console.log(`  half way: ${Math.round(s.dist / 1000)} km to go at ${r1(s.speed / 1000)} km/s (${m.err || m.draws + ' draws'}, L ${m.mean} ± ${m.sd}) (${secs()})`);
          await chase(P, 0.1, 0);
        }
        if (!mid && s.phase === 'cruise' && s.dist < 140000) {
          await chase(P, 0.2, 0.25); await P.step(1);
          await waitTex(P, 20000, 1);
          await keep(P, '__Fc2');
          const m = await picture(P, '__Fc2', SH(hi ? 'cruise_mid.png' : 'cruise_vl_mid.png'), K); mid = true;
          check(!m.err && m.sd > 4, `mid-way: the picture not blank (L ${m.mean} ± ${m.sd})`);
          const c2 = await cost(P, '__Fc2', 2, hi ? 4 : 6);
          Rr.cruiseFrame = { wall: r1(c2.wallMs), cpu: r1(c2.cpuMs), draws: m.draws, km: Math.round(s.dist / 1000) };
          console.log(`  mid-way: ${Math.round(s.dist / 1000)} km to go at ${r1(s.speed / 1000)} km/s; the cruise frame ${Rr.cruiseFrame.wall} ms (CPU ${Rr.cruiseFrame.cpu}), ${m.draws} draws — the plaza's ${Rr.plaza.wall} ms (${secs()})`);
          check(!m.err && Rr.cruiseFrame.wall <= Math.max(Rr.plaza.wall * 1.1, Rr.plaza.wall + 2), `${NAMEP[preset]}: the cruise frame not dearer than the plaza frame (${Rr.cruiseFrame.wall} vs ${Rr.plaza.wall} ms)`);
        }
      }
      s = await cr(P);
      Rr.trip = s.last;
      check(s.frame === 'opal' && s.regime === 'space' && !s.phase, `arrived in orbit round Opal (${s.frame}, ${s.regime}); the trip ${r1(s.last && s.last.total)} s, to 2 R ${r1(s.last && s.last.t2R)} s`);
      await P.step(40);
      await chase(P, 0.2, 0.4); await waitTex(P, 60000, 1); await P.step(4);
      await keep(P, '__Fc3'); const m3 = await picture(P, '__Fc3', SH(hi ? 'cruise_arrive_opal.png' : 'cruise_vl_opal.png'), K);
      check(!m3.err && m3.sd > 4, `the arrival picture (${m3.err || m3.draws + ' draws'}, L ${m3.mean} ± ${m3.sd}: not blank)`);
      save();
      // ---- Landen: the descent into Opal's world, then Heimkehr from there to the apron
      if (hi && want('opal')) {
        await chase(P, 0.12, 0);
        Rr.opal = await descent(P, 'opal', '', Rr);
        save();
        if (want('home') && Rr.opal.landed) {
          const t0 = Date.now();
          await P.ev(() => { window.__h0 = performance.now(); VR.game.goHome(); });
          let okH = false;
          for (let i = 0; i < 200; i++) { await P.step(4); await P.wait(60); const q = await P.ev(() => ({ st: VR.game.state, dim: VR.game.dim, busy: VR.Travel.busy(VR.game), last: VR.Travel.last })); if (q.st === 'play' && q.dim === 'overworld' && !q.busy) { okH = true; Rr.home = q.last; break; } }
          const wall = Date.now() - t0, pos = await P.ev(() => VR.game.player.pos.map(Math.round)), ap = await P.ev(() => VR.SpaceFlight.apron());
          Rr.homeWall = wall; Rr.homePos = pos;
          const dAp = Math.hypot(pos[0] - ap.x, pos[2] - ap.z);
          console.log(`  Heimkehr from Opal: ${wall} ms wall (the trip's own ${Rr.home && Rr.home.totalMs} ms), at ${pos.join(', ')} — ${Math.round(dAp)} m from the apron (${secs()})`);
          check(okH && (Rr.home ? Rr.home.totalMs : wall) <= 10000, `Heimkehr Opal → Herzwelt in ≤ 10 s (${Rr.home && Rr.home.totalMs} ms)`);
          save();
        }
      }
    }
    // ---- the descent onto Basalt (High): the Reisesprung there, Landen
    if (hi && want('basalt')) {
      const st0 = await P.ev(() => VR.game.dim);
      if (st0 !== 'overworld') { await P.ev(() => VR.game.goHome()); await waitPlay(P, 60000); }
      await P.step(60);
      const bd2 = await P.ev(() => !!(VR.game.flight && VR.game.flight.b && VR.game.starships.pilot));
      if (!bd2) { const b2 = await board(P); console.log(`  boarded again: ${JSON.stringify(b2)}`); }
      await P.ev(() => { const g = VR.game; VR.SpaceFlight.debug.orbit(g, 0, 40, 3063); VR.SpaceFlight.jumpStart(g.flight, 'basalt'); });
      await P.step(220);
      const s = await cr(P);
      check(s.frame === 'basalt', `the Reisesprung to Basalt (${s.frame})`);
      if (s.frame === 'basalt') { await chase(P, 0.12, 0); Rr.basalt = await descent(P, 'basalt', '', Rr); }
      save();
    }
    Rr.errors = errsOf(P);
    check(errsOf(P).length === 0, `no page error (${errsOf(P).length})` + (errsOf(P).length ? ': ' + errsOf(P)[0].slice(0, 400) : ''));
    Rr.lines = await P.ev(() => (window.__lines || []).slice(-30));
    save();
  } catch (e) { check(false, `${NAMEP[preset]}: ${String(e.stack || e.message || e).slice(0, 500)}`); }
  finally { await P.ctx.close().catch(() => {}); }
}

for (const p of PRESETS) await runPreset(p);
await browser.close();
try {
  const f = (n) => { const p = SHOTS + n; try { return fs.statSync(p).mtimeMs >= T0 ? p : null; } catch (e) { return null; } };
  const rows = [];
  const row = (label, names) => { const imgs = names.map(f).filter(Boolean); if (imgs.length) rows.push({ label, imgs }); };
  row('Reiseantrieb · los, halbwegs (High)', ['cruise_depart.png', 'cruise_half.png']);
  row('Opal wächst heran, Ankunft (High)', ['cruise_mid.png', 'cruise_arrive_opal.png']);
  row('Landen · Opal, Basalt, gelandet', ['descent_opal.png', 'descent_basalt.png', 'cruise_landed_opal.png']);
  row('Very Low · halbwegs, Opal · Plätze', ['cruise_vl_mid.png', 'cruise_vl_opal.png', 'cruise_plaza_high.png']);
  fs.writeFileSync(ROOT + '.tmp_tests/cruise_sheet.json', JSON.stringify({ w: 620, rows }));
  execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + 'cruise_sheet.jpg', ROOT + '.tmp_tests/cruise_sheet.json']);
  console.log('sheet: ' + SHOTS + 'cruise_sheet.jpg');
} catch (e) { console.log('(no sheet: ' + String(e.message || e).slice(0, 200) + ')'); }
save();
console.log(`\n${fails ? 'FAILED ' + fails : 'ALL OK'} (${secs()})`);
process.exit(fails ? 1 : 0);

// u-stations · the stations in the browser (docs/superpowers/plans/2026-10-31-u-stations.md): a shuttle on the apron of a
// new default world (seed 53, creative, the Abenteuer switched on for the shop), 1280 × 720, de-DE; High, then Very Low.
//   pictures  test/shots/ringstation_outside.png (the ring from above, Herzwelt behind it), docking.png (up the corridor
//             through the guide rings), station_window.png (the window wall: Herzwelt 81.5° wide beyond the deck),
//             station_interior.png (the Panoramahalle), station_traffic.png (a shuttle coming down on the deck),
//             station_shop.png (+ station_shop_panel.png), station_window_vl.png; the sheet test/shots/stations_sheet.jpg
//   numbers   no frame over 2× the median through the docking and the hand-off; the station's Very Low frame ≤ the plaza's;
//             the shop, a job handed in, undocking; no page error
// → .tmp_tests/stations_run.json.   usage: nohup bash test/wt_run.sh stations.mjs 3600 > .tmp_tests/stations.log 2>&1 &
//   PRESETS=high,potato · SEED=53 · RD=6 · K=3
// regress: skip  (a showcase: the pictures are the evidence; the gates are test/stations.js)
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
const save = () => { try { fs.writeFileSync(ROOT + '.tmp_tests/stations_run.json', JSON.stringify(rec, null, 1)); } catch (e) { /* a convenience */ } };
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
  await P.ev((seed) => VR.game.createWorld({ name: 'Station', mode: 'creative', difficulty: 'peaceful', type: 'default', seed, cheats: true, kit: true }), SEED);
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
const realFrames = (P, n) => P.ev((n) => { const g = VR.game, out = []; window.__norender = false; for (let i = 0; i < n; i++) { const t0 = performance.now(); g.last = t0 - 33; g.loop(t0); window.__sync(); const L = g.cruiseLand; out.push([+(performance.now() - t0).toFixed(1), L && !L.ok ? 1 : 0]); } window.__norender = true; return out; }, n);
async function waitPlay(P, maxMs) { const t0 = Date.now(); for (;;) { await P.step(2); const s = await P.ev(() => VR.game.state); if (s === 'play') return true; if (Date.now() - t0 > maxMs) return false; await P.wait(150); } }
const keep = (P, k) => P.ev((k) => { window[k] = window.__F; }, k);

// ================================================================ u-stations
const S_ = (P) => P.ev(() => { const g = VR.game, fl = g.flight, a = fl && fl.asc, j = a && a.jump; return { state: g.state, dim: g.dim, regime: fl ? fl.regime || 'air' : null, frame: a ? a.st.frame : null, dock: j && j.dock ? { s: +j.s.toFixed(2), ph: j.ph, dur: +j.J.dur.toFixed(1), hold: !!j.hold } : null, pilot: !!(g.starships && g.starships.pilot), stats: Object.assign({}, VR.Stations.stats, { dockMs: null }), pos: g.player ? g.player.pos.map(x => Math.round(x * 10) / 10) : null }; });
// the ship put near the ring: `off` metres from its middle along (zenith, east, north) of the station, at rest against it,
// its nose toward the ring
const nearRing = (P, off) => P.ev((off) => {
  const g = VR.game, fl = g.flight, A = VR.Ascent, STN = VR.Stations, a = fl.asc;
  const cp = STN.chartPos(); VR.SpaceFlight.debug.orbit(g, cp[0], cp[2], 3063);
  const st = a.st, t = st.t, Pl = STN.place('ring', t, {});
  for (let i = 0; i < 3; i++) { st.r[i] = Pl.r[i] + Pl.A[i] * off[0] + Pl.e1[i] * off[1] + Pl.e2[i] * off[2]; st.v[i] = Pl.v[i]; }
  st.coast = true; VR.Universe.verletInit(st, VR.Universe.home.body('herz').mu);
  const d = [Pl.r[0] - st.r[0], Pl.r[1] - st.r[1], Pl.r[2] - st.r[2]], L = Math.hypot(...d);
  A.frameFrom(d.map(x => x / L), Pl.A, a.S);
  const mp = [0, 0, 0], mv = [0, 0, 0]; A.toMap(st, mp, mv); for (let i = 0; i < 3; i++) { a.pos[i] = mp[i]; fl.b.pos[i] = mp[i]; }
  fl.auto = null; fl.throttle = 0;
  return { d: Math.round(L), y: Math.round(mp[1]) };
}, off);
async function stationRun(P, hi, Rr, tag) {
  const bd = await board(P);
  check(!!bd && bd.pilot, `the shuttle boarded (${bd && bd.name})`); if (!bd) return;
  await P.ev(() => { const g = VR.game; g.env.day = 3; g.env.setTime(4600); if (VR.Adventure && VR.Adventure.setOn) VR.Adventure.setOn(true); });
  await P.step(10);
  // ---- outside: the ring from above, Herzwelt behind it
  if (hi) {
    const n = await nearRing(P, [1500, -900, 700]);
    await chase(P, 0.12, 0.25);
    await waitTex(P, 60000, 1); await P.step(20, 1);
    for (let i = 0; i < 30; i++) { const s = await S_(P); if (s.stats.meshes >= 4) break; await P.step(4, 1); await P.wait(200); }
    await P.step(4, 1); await keep(P, '__Fo');
    const m = await picture(P, '__Fo', SH('ringstation_outside.png'), K);
    const s = await S_(P);
    check(!m.err && m.sd > 6 && s.stats.drawn >= 6, `ringstation_outside: ${n.d} m from the ring, ${s.stats.drawn} meshes drawn, ${s.stats.shuttles} shuttles (L ${m.mean} ± ${m.sd}) ${m.err || ''}`);
  }
  // ---- docking from 8 km out (G: looking at it)
  await nearRing(P, hi ? [-2500, 6000, 3000] : [-2500, 6000, 3000]);
  await chase(P, 0.1, 0); await P.step(6, 1);
  const tg = await P.ev(() => { const g = VR.game, t = VR.Stations.target(g, g.flight); return t && { d: Math.round(t.d), ang: +(t.ang * 57.3).toFixed(1), ok: t.ok }; });
  const g0 = await P.ev(() => VR.SpaceFlight.toggle(VR.game.flight));
  let s = await S_(P);
  check(tg && tg.ok && g0 && s.dock, `G at the station starts the docking (${tg && tg.d} m, ${tg && tg.ang}° off the nose; ${s.dock ? s.dock.dur + ' s' : 'no plan'})`);
  if (!s.dock) return;
  const frames = []; let shot = false, ph = new Set();
  for (let i = 0; i < 2400; i++) {
    const f = await P.ev(() => { const g = VR.game, t0 = performance.now(); window.__norender = false; g.last = t0 - 33; g.loop(t0); window.__sync(); window.__norender = true; return +(performance.now() - t0).toFixed(1); });
    frames.push(f);
    s = await S_(P);
    if (s.dock) ph.add(s.dock.ph);
    if (hi && !shot && s.dock && s.dock.ph === 'corridor' && s.dock.s > s.dock.dur * 0.5) {
      await chase(P, 0.05, 0.4); await P.step(1, 0); await keep(P, '__Fd');
      const m = await picture(P, '__Fd', SH('docking.png'), K, true); shot = true;
      console.log(`  docking: the corridor at ${s.dock.s} s (${m.err || m.draws + ' draws'}, L ${m.mean} ± ${m.sd}) (${secs()})`);
      await chase(P, 0.1, 0);
    }
    if (s.state !== 'play' || s.dim !== 'overworld') break;
  }
  const dockF = frames.slice(5), dm = med(dockF), dx = Math.max(...dockF);
  Rr.dockFrames = { median: dm, max: dx, n: dockF.length };
  check(['transfer', 'corridor', 'align', 'clamp'].every(p => ph.has(p)), 'the phases flown: ' + [...ph].join(' → '));
  console.log(`  the docking's frames: median ${dm} ms, max ${dx} ms over ${dockF.length} (${secs()})`);
  check(dx <= 2 * dm, `no frame over twice the median through the docking (${dx} ≤ 2 × ${dm} ms)`);
  const ok = await waitPlay(P, 120000);
  await P.step(4);
  for (let i = 0; i < 60; i++) { s = await S_(P); if (s.pilot) break; await P.step(4); await P.wait(100); }
  check(ok && s.dim === 'stn.ring' && s.pilot, `docked: in ${s.dim}, the ship on the berth, aboard (${s.pos && s.pos.join(', ')})`);
  if (s.dim !== 'stn.ring') return;
  // the first frames in the station (the hand-off: as dear as the ones after it)
  await P.settle(800);
  const hf = await realFrames(P, 30), hm = med(hf.slice(3).map(x => x[0])), hx = Math.max(...hf.slice(3).map(x => x[0]));
  Rr.handoff = { median: hm, max: hx };
  check(hx <= 2 * hm, `the hand-off: no frame over twice the median in the station (${hx} ≤ 2 × ${hm} ms)`);
  // out of the ship, into the hall
  await P.ev(() => { const g = VR.game; g.starships.exit(); });
  const look = async (x, y, z, yaw, pitch, name, cap) => {
    await P.ev(([x, y, z, yaw, pitch]) => { const g = VR.game, p = g.player; g.camMode = 0; p.flying = true; p.noclip = true; p.teleport(x, y, z); p.yaw = p.viewYaw = yaw; p.pitch = pitch; g.settings.fov = 75; }, [x, y, z, yaw, pitch]);
    await P.settle(300); await P.step(6); await keep(P, '__F' + name);
    const m = await picture(P, '__F' + name, SH(name + '.png'), K);
    check(!m.err && m.sd > 5, `${name}: ${cap} (${m.err || m.draws + ' draws'}, L ${m.mean} ± ${m.sd})`);
    return m;
  };
  if (hi) {
    await look(-6.5, 64, 9.5, -0.25, 0.12, 'station_window', 'the window wall, Herzwelt 81.5° wide beyond the deck');
    await look(12.5, 66, -3.5, Math.PI - 0.5, -0.12, 'station_interior', 'the Panoramahalle, the garden beyond');
    // a shuttle landing on the deck: the hangar deck's clock a few seconds before a touchdown
    const vt = await P.ev(() => { const g = VR.game, Lf = g.stnLife; if (!Lf) return null; const pad = Lf.actor.pads.get('stn'), T = VR.Stations.visits('ring', g.meta.seed | 0, Lf.actor.clock, Lf.actor.clock + 400); const Tn = T[1] || T[0]; Lf.actor.clock = Tn - 9; return { T: Tn, pad: [pad.x, pad.y, pad.z] }; });
    if (vt) { for (let i = 0; i < 30; i++) { await P.step(2); const c = await P.ev(() => { const L = VR.game.stnLife.actor; return L.st.visible + L.st.crafts; }); if (c) break; await P.wait(150); } }
    await P.ev(() => { const L = VR.game.stnLife.actor; L.clock -= 0.5; });
    await look(6.5, 66, -3.5, -0.55, -0.18, 'station_traffic', 'a shuttle coming down on the deck through the window');
    Rr.traffic = await P.ev(() => Object.assign({}, VR.game.stnLife.actor.st));
    console.log(`  the deck's PadLife: ${JSON.stringify(Rr.traffic)}`);
    // the shop: the counter, and its panel
    await look(24.5, 64, 6.5, -Math.PI / 2 - 0.2, -0.05, 'station_shop', 'the Stationsladen, its counter');
    const op = await P.ev(() => VR.Stations.openShop(VR.game));
    if (op) { await P.ev(() => { for (const id of ['ui']) { const h = document.getElementById(id); if (h) h.style.display = ''; } }); await P.wait(300); await P.page.screenshot({ path: SH('station_shop_panel.png') }); await P.ev(() => VR.Shop.close()); }
    check(op, 'the shop 🛰 opens (' + (await P.ev(() => VR.Shop.catalog('station').length)) + ' wares)');
    // the job board
    const jb = await P.ev(() => { const g = VR.game; VR.Stations.board(g); const R0 = g.meta.stations, k = Object.keys(R0.jobs)[0]; const J = R0.jobs[k]; const job = VR.Stations.JOBS.find(j => j.id === J.taken); if (job && job.kind === 'bring') g.player.inv.add(job.item, job.n); const t0 = (VR.Adventure && VR.Adventure.rec) ? VR.Adventure.rec.me.taler : 0; VR.Stations.board(g); return { taken: job && job.id, done: J.done.slice(), taler: [t0, VR.Adventure.rec ? VR.Adventure.rec.me.taler : 0] }; });
    check(jb && jb.done.length === 1, `a station job taken and handed in (${JSON.stringify(jb)})`);
  }
  // the interior's Very Low (and High) frame: the window view
  await P.ev(() => { const p = VR.game.player; p.teleport(-6.5, 64, 9.5); p.yaw = p.viewYaw = -0.25; p.pitch = 0.12; });
  await P.settle(300); await P.step(6); await keep(P, '__Fin');
  if (!hi) await picture(P, '__Fin', SH('station_window_vl.png'), K);
  const ic = await cost(P, '__Fin', 2, hi ? 4 : 6);
  Rr.interior = { wall: r1(ic.wallMs), cpu: r1(ic.cpuMs) };
  console.log(`  the station's window frame: ${Rr.interior.wall} ms (CPU ${Rr.interior.cpu}) — the plaza's ${Rr.plaza.wall} ms (${secs()})`);
  check(hi || Rr.interior.wall <= Math.max(Rr.plaza.wall * 1.05, Rr.plaza.wall + 1), `${hi ? 'High' : 'Very Low'}: the station's frame ≤ the plaza frame (${Rr.interior.wall} vs ${Rr.plaza.wall} ms)`);
  // undocking: G in the ship
  if (hi) {
    await P.ev(() => { const g = VR.game, s = g.starships.ships.find(q => q.d.seed === 4242); if (s) g.starships.board(s, g.player); });
    await P.step(4);
    const u = await P.ev(() => VR.SpaceFlight.toggle(VR.game.starships.pilot.flight));
    for (let i = 0; i < 40; i++) { await P.step(10); s = await S_(P); if (s.dim !== 'stn.ring') break; }
    await waitPlay(P, 120000);
    for (let i = 0; i < 80; i++) { await P.step(4); s = await S_(P); if (s.regime === 'space') break; await P.wait(100); }
    check(u && s.regime === 'space' && s.frame === 'herz', `undocked: back in space by the ring (${s.dim}, ${s.regime}, ${s.frame})`);
  }
}
async function runPreset(preset) {
  const tag = TAGP[preset] || preset, hi = preset !== 'potato', Rr = rec.presets[tag] = {};
  console.log(`\n${NAMEP[preset] || preset} (${secs()})`);
  const P = await openPage();
  try {
    const ok = await makeWorld(P, preset);
    check(ok, `the world is loaded (${secs()})`); if (!ok) return;
    const pm = await plaza(P, SH(`stations_plaza_${tag}.png`));
    const pc = await cost(P, '__Fplaza', 2, hi ? 4 : 6);
    Rr.plaza = { draws: pm.draws, wall: r1(pc.wallMs), cpu: r1(pc.cpuMs) };
    console.log(`  the plaza frame: ${Rr.plaza.wall} ms (CPU ${Rr.plaza.cpu}), ${pm.draws} draws (${secs()})`);
    await stationRun(P, hi, Rr, tag);
  } catch (e) { check(false, 'the run threw: ' + String(e && e.stack || e).slice(0, 800)); }
  finally {
    const errs = errsOf(P); Rr.errors = errs.slice(0, 6);
    const se = await P.ev(() => VR.Stations.stats.err).catch(() => null);
    check(!errs.length && !se, `no page error (${errs.length}${errs.length ? ': ' + errs[0].slice(0, 300) : ''}${se ? '; stations: ' + se.slice(0, 300) : ''})`);
    save(); await P.ctx.close();
  }
}
for (const p of PRESETS) await runPreset(p);
await browser.close();
save();
// the sheet
try {
  const rows = [{ label: 'Ringstation · outside, docking', imgs: ['ringstation_outside.png', 'docking.png'].map(SH).filter(f => fs.existsSync(f)) },
    { label: 'the window · the hall', imgs: ['station_window.png', 'station_interior.png'].map(SH).filter(f => fs.existsSync(f)) },
    { label: 'traffic on the deck · the shop', imgs: ['station_traffic.png', 'station_shop.png'].map(SH).filter(f => fs.existsSync(f)) },
    { label: 'Very Low: the window · the plaza', imgs: ['station_window_vl.png', 'stations_plaza_vl.png'].map(SH).filter(f => fs.existsSync(f)) }].filter(r => r.imgs.length);
  fs.writeFileSync(ROOT + '.tmp_tests/stations_sheet.json', JSON.stringify({ w: 620, rows }));
  execFileSync('python3', ['/root/r9coord/pairs.py', SH('stations_sheet.jpg'), ROOT + '.tmp_tests/stations_sheet.json']);
  console.log('  the sheet: test/shots/stations_sheet.jpg');
} catch (e) { console.log('  (no sheet: ' + String(e.message || e).slice(0, 200) + ')'); }
console.log(JSON.stringify(rec.presets));
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

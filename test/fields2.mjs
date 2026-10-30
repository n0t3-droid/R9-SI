// u-fields2 · into the fields yourself in the browser (plan docs/superpowers/plans/2026-10-30-u-fields2.md): a shuttle on
// the apron of a new default world (seed 53, creative), 1280 × 720, de-DE.
//   High: the Reiseantrieb to Amarant's ring (cruise_to_ring: the entry down to the sheet; ring_flythrough: the chunks
//         streaming past), V there → the cloud tops (cloudtops_pass: the ship pushed down, the autopilot's pull-up below
//         1 km, the towering heads), G → the Trümmerschwarm (swarm_arrive), V → the rock looked at (the trip by ship,
//         the landing), on foot: the neighbours in the sky, G on one → the hop (hop_neighbour), a glowspar cluster
//         (rubble_ore)
//   Very Low: the rubble body's frame with the neighbours against the plaza frame, and with them off
// → test/shots/fields2_sheet.jpg, .tmp_tests/fields2_run.json
//   nohup bash test/wt_run.sh fields2.mjs 3600 > .tmp_tests/fields2.log 2>&1 &      PRESETS=high,potato · ONLY=ring,clouds,swarm,rock
// regress: skip  (a showcase: the pictures are the evidence; the gate is test/fields2.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import { execSync, execFileSync } from 'child_process';
const ROOT = new URL('../', import.meta.url).pathname;
const DIST = process.env.DIST || 'file://' + ROOT + 'dist/index.html';
const SHOTS = ROOT + 'test/shots/';
const SEED = process.env.SEED || '53', RD = +(process.env.RD || 8), K = +(process.env.K || 3);
const PRESETS = (process.env.PRESETS || 'high,potato').split(',');
const SH = (n) => SHOTS + n;
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const want = (s) => !ONLY || ONLY.includes(s);
const TAGP = { high: 'high', potato: 'vl' }, NAMEP = { high: 'High', potato: 'Very Low' };
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const r1 = (x) => Math.round(x * 10) / 10;
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
const rec = { dist: DIST, seed: SEED, presets: {} };
const save = () => { try { fs.writeFileSync(ROOT + '.tmp_tests/fields2_run.json', JSON.stringify(rec, null, 1)); } catch (e) { /* a convenience */ } };
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
const realFrames = (P, n) => P.ev((n) => { const g = VR.game, out = []; window.__norender = false; for (let i = 0; i < n; i++) { const t0 = performance.now(); g.last = t0 - 33; g.loop(t0); window.__sync(); const L = g.cruiseLand; out.push([+(performance.now() - t0).toFixed(1), L && !L.ok ? 1 : 0]); } window.__norender = true; return out; }, n);
async function waitPlay(P, maxMs) { const t0 = Date.now(); for (;;) { await P.step(2); const s = await P.ev(() => VR.game.state); if (s === 'play') return true; if (Date.now() - t0 > maxMs) return false; await P.wait(150); } }
const keep = (P, k) => P.ev((k) => { window[k] = window.__F; }, k);
// the descent into the world below the orbit (V): the trip, the ship over the site, the frames while it streams, the
// plume picture at ~30 m, the landing

// ---------------------------------------------------------------- u-fields2's own
const f2 = (P) => P.ev(() => { const g = VR.game, fl = g.flight, a = fl && fl.asc, F2 = VR.Fields2; return { alt: F2.alt, pulls: F2.pulls || 0, sky: (F2.sky || []).map(n => n.k), hop: F2.lastHop || null, stats: VR.Fields.stats, frame: a ? a.st.frame : null }; });
// fly the cruise until it is done (each: called every round with the state)
async function fly(P, each, max = 3000, n = 3) { let s = await cr(P); for (let i = 0; i < max && s.phase; i++) { await P.step(n); s = await cr(P); if (each && await each(s)) break; } return s; }
const shoot = async (P, name, key) => { await keep(P, key); const m = await picture(P, key, SH(name), K); console.log(`  ${name}: ${m.err || m.draws + ' draws, ' + m.tris + ' tris'}, L ${m.mean} ± ${m.sd} (${secs()})`); return m; };
// on a rubble body on foot: look along a local direction (the world's x, y, z)
const lookAlong = (P, d) => P.ev((d) => { const g = VR.game, p = g.player; p.yaw = p.viewYaw = Math.atan2(-d[0], -d[2]); p.pitch = Math.asin(Math.max(-1, Math.min(1, d[1]))); g.cam.yaw = p.yaw; g.cam.pitch = p.pitch; }, d);
async function waitDim(P, dim, max = 120000) { const t0 = Date.now(); for (;;) { await P.step(4); const s = await P.ev(() => ({ st: VR.game.state, dim: VR.game.dim, busy: VR.Travel.busy(VR.game) })); if (s.st === 'play' && s.dim === dim && !s.busy) return true; if (Date.now() - t0 > max) return false; await P.wait(150); } }

async function runPreset(preset) {
  const tag = TAGP[preset] || preset, hi = preset !== 'potato', Rr = rec.presets[tag] = {};
  console.log(`\n${NAMEP[preset] || preset} (${secs()})`);
  const P = await openPage();
  try {
    const ok = await makeWorld(P, preset);
    check(ok, `the world is loaded (${secs()})`); if (!ok) return;
    const pm = await plaza(P, SH(`fields2_plaza_${tag}.png`));
    const pc = await cost(P, '__Fplaza', 2, hi ? 4 : 6);
    Rr.plaza = { draws: pm.draws, wall: r1(pc.wallMs), cpu: r1(pc.cpuMs) };
    console.log(`  the plaza frame: ${Rr.plaza.wall} ms (CPU ${Rr.plaza.cpu}), ${pm.draws} draws (${secs()})`);
    if (hi) {
      const bd = await board(P);
      check(!!bd && bd.pilot, `the shuttle boarded (${bd && bd.name})`); if (!bd) return;
      await P.step(20);
      await P.ev(() => { const g = VR.game; g.env.day = 3; g.env.setTime(5000); });
      // ---- the ring
      if (want('ring')) {
        await P.ev(() => VR.SpaceFlight.debug.orbit(VR.game, 0, 40, 3063));
        await chase(P, 0.1, 0); await waitTex(P, 60000, 1); await P.step(6);
        const go = await P.ev(() => VR.Cruise.start(VR.game.flight, 'ring'));
        check(go, 'G on the ring: the Reiseantrieb engaged (to Amarant, then the entry)');
        let shot = false;
        const s = await fly(P, async (s) => {
          if (!shot && s.phase === 'entry' && s.total > 0) {
            const e = await P.ev(() => { const c = VR.game.flight.asc.cruise; return c && c.entry ? c.entry.s : 0; });
            if (e > 5.2) { await chase(P, 0.16, 0.5); await P.step(1); await waitTex(P, 15000, 1); Rr.toRing = await shoot(P, 'cruise_to_ring.png', '__Fr1'); shot = true; await chase(P, 0.1, 0); }
          }
        });
        const q = await f2(P);
        check(s.frame === 'amarant' && !s.phase, `arrived in the ring (${s.frame}; the trip ${r1(s.last && s.last.total)} s)`);
        await P.step(45);
        const q2 = await f2(P);
        Rr.ring = q2.stats;
        await chase(P, 0.05, 0.9); await P.step(2);
        const m = Rr.flythrough = await shoot(P, 'ring_flythrough.png', '__Fr2');
        check(q2.stats && q2.stats.where === 'ring' && q2.stats.chunks > 1000 && m.sd > 4, `in the sheet: ${q2.stats && q2.stats.chunks} chunks drawn round the ship (τ ${q2.stats && q2.stats.tau}) — the picture not blank`);
        void q;
        save();
      }
      // ---- the cloud tops: V round Amarant, then pushed down; the autopilot pulls up below 1 km
      if (want('clouds')) {
        const v = await P.ev(() => VR.SpaceFlight.land(VR.game.flight));
        check(v, 'V round Amarant: down to the cloud tops');
        let s = await fly(P);
        await P.step(6);
        let q = await f2(P);
        check(s.frame === 'amarant' && Math.abs(q.alt - 15000) < 400, `over the cloud tops: ${Math.round(q.alt)} m (${s.frame})`);
        await P.ev(() => { const st = VR.game.flight.asc.st, l = Math.hypot(...st.r); for (let i = 0; i < 3; i++) st.v[i] -= st.r[i] / l * 520; });
        let minAlt = 1e9, shot = false;
        for (let i = 0; i < 700; i++) {
          await P.step(3); q = await f2(P); minAlt = Math.min(minAlt, q.alt);
          if (!shot && q.alt < 3500) { await chase(P, 0.12, 0.35); await P.step(1); Rr.clouds = await shoot(P, 'cloudtops_pass.png', '__Fc'); shot = true; await chase(P, 0.1, 0); }
          if (q.pulls > 0 && i > 40 && q.alt > 1200) break;
        }
        Rr.pull = { minAlt: Math.round(minAlt), pulls: q.pulls };
        check(q.pulls > 0 && minAlt > 300 && minAlt < 1000, `the autopilot pulled up: the lowest ${Math.round(minAlt)} m over the tops (${q.pulls} steps of the pull)`);
        save();
      }
      // ---- the swarm
      if (want('swarm')) {
        await P.ev(() => { const fl = VR.game.flight; fl.auto = null; if (fl.asc && fl.asc.cruise) fl.asc.cruise = null; });
        const go = await P.ev(() => VR.Cruise.start(VR.game.flight, 'swarm'));
        check(go, 'G on the Trümmerschwarm: the Reiseantrieb engaged');
        const s = await fly(P, null, 6000, 6);
        await P.step(30);
        const q = await f2(P);
        check(!s.phase && q.stats && q.stats.where === 'swarm', `arrived in the swarm (${s.frame}; ${q.stats && q.stats.swarmD} m off its centre, the trip ${r1(s.last && s.last.total)} s)`);
        await chase(P, 0.08, 0.3); await P.step(2);
        Rr.swarm = await shoot(P, 'swarm_arrive.png', '__Fs');
        save();
        // V: the rock looked at (else the nearest) → the trip by ship → the landing
        const v = await P.ev(() => VR.SpaceFlight.land(VR.game.flight));
        check(v, 'V in the swarm: on to a rock');
        let dim = null;
        for (let i = 0; i < 60; i++) { await P.step(10); const c = await cr(P); if (c.state !== 'play' || /^rock\./.test(c.dim)) { dim = c.dim; break; } }
        for (let i = 0; i < 100; i++) { await P.wait(200); await P.step(2); const c = await cr(P); if (c.state === 'play' && /^rock\./.test(c.dim)) { dim = c.dim; break; } }
        check(/^rock\.\d+$/.test(dim || ''), `the trip by ship to ${dim}`);
        let c = await cr(P);
        for (let i = 0; i < 700 && c.land; i++) { await P.step(10); c = await cr(P); if (i % 30 === 0) await P.wait(40); }
        Rr.landed = c.flState;
        check(c.flState === 'landed', `landed on the rock (${c.flState})`);
        Rr.rock = dim;
      }
      // ---- on the rock: the neighbours in the sky, the hop; the ore
      if (want('rock')) {
        let dim = await P.ev(() => VR.game.dim);
        if (!/^rock\./.test(dim)) { await P.ev(() => VR.Travel.go(VR.game, { dim: 'rock.0', via: 'cmd' })); await waitDim(P, 'rock.0'); dim = 'rock.0'; }
        await P.ev(() => { const g = VR.game; if (g.starships && g.starships.pilot) g.starships.exit(); });
        await P.settle(300);
        // stand at the spawn, Helia low (the shadows long), look at the biggest neighbour 
        await P.ev(() => { VR.Fields.sunFix = [0.55, 0.35, 0.76]; const g = VR.game, sp = VR.Fields.rock.spawn; if (sp) { g.player.flying = false; g.player.teleport(sp[0], sp[1] + 0.5, sp[2]); } });
        await P.step(20);
        const sky = await P.ev(() => (VR.Fields2.sky || []).map(n => ({ k: n.k, dir: n.dir, deg: +(n.rad * 360 / Math.PI).toFixed(1) })));
        Rr.sky = sky;
        check(sky.length >= 3, `the neighbours in ${dim}'s sky: ${sky.map(n => 'TS-' + (n.k + 1) + ' ' + n.deg + '°').join(', ')}`);
        if (sky.length) {
          sky.sort((a, b) => b.dir[1] * b.deg - a.dir[1] * a.deg);
          // 45 m from the landing place toward the neighbour (the parked ship behind)
          await P.ev((d) => { const g = VR.game, p = g.player, gen = new VR.RubbleGen(0, g.dim, { bgen: { rubble: 2 } }), l = Math.hypot(d[0], d[2]) || 1; for (let r = 45; r > 5; r -= 5) { const x = Math.round(p.pos[0] + d[0] / l * r), z = Math.round(p.pos[2] + d[2] / l * r), y = gen.surfaceY(x, z); if (y > 0) { p.teleport(x + 0.5, y + 1.2, z + 0.5); return; } } }, sky[0].dir);
          await P.settle(200);
          const d = sky[0].dir, look = [d[0] * 0.92, d[1] * 0.92 - 0.12, d[2] * 0.92], l = Math.hypot(...look);
          await lookAlong(P, look.map(x => x / l)); await P.step(3); await P.settle(100); await P.step(2);
          await P.ev(() => { window.__Fh = window.__F; });
          Rr.hopPic = await picture(P, '__Fh', SH('hop_neighbour.png'), K);
          console.log(`  hop_neighbour: ${Rr.hopPic.err || Rr.hopPic.draws + ' draws'}, L ${Rr.hopPic.mean} ± ${Rr.hopPic.sd} (${secs()})`);
          await lookAlong(P, d); await P.step(2);
          const ok2 = await P.ev(() => VR.Fields2.hop(VR.game, false));
          const to = 'rock.' + sky[0].k, arr = ok2 && await waitDim(P, to);
          check(ok2 && arr, `G on TS-${sky[0].k + 1}: the hop to ${to} (${arr ? 'there' : 'not there'})`);
          Rr.hop = await P.ev(() => VR.Fields2.lastHop);
        }
        // the ore: the body's first glowspar cluster, from beside it
        const ore = await P.ev(() => { const g = VR.game, gen = new VR.RubbleGen(0, g.dim, { bgen: { rubble: 2 } }), p = gen.spar[0]; if (!p) return null; const y = gen.surfaceY(Math.round(p.x + 4), Math.round(p.z + 3)); return { x: p.x, y: p.y, z: p.z, ey: Math.max(y, p.y) + 2.6 }; });
        if (ore) {
          await P.ev((o) => { const g = VR.game, pl = g.player; pl.flying = true; pl.noclip = true; pl.teleport(o.x + 4, o.ey - 1.62, o.z + 3); VR.Fields.sunFix = [0.4, 0.5, -0.77]; }, ore);
          await P.settle(300);
          await lookAlong(P, (() => { const d = [-4, ore.y - ore.ey, -3], l = Math.hypot(...d); return d.map(x => x / l); })());
          await P.step(3); await P.ev(() => { window.__Fo = window.__F; });
          Rr.ore = await picture(P, '__Fo', SH('rubble_ore.png'), K);
          const n = await P.ev(() => { const g = VR.game, w = g.world, S = VR.R.S('glowspar'); let n = 0; const p = g.player.pos; for (let x = -8; x <= 8; x++) for (let y = -8; y <= 8; y++) for (let z = -8; z <= 8; z++) if (w.getBlock(Math.floor(p[0]) + x, Math.floor(p[1]) + y, Math.floor(p[2]) + z) === S) n++; return n; });
          check(n > 0 && !Rr.ore.err, `rubble_ore: ${n} glowspar blocks in reach (${Rr.ore.err || Rr.ore.draws + ' draws'}, L ${Rr.ore.mean} ± ${Rr.ore.sd})`);
        } else check(false, 'no glowspar cluster on ' + dim);
        save();
      }
    } else {
      // Very Low: a rubble body's frame (the neighbours' discs in the sky) against the plaza, and with the discs off
      await P.ev(() => VR.Travel.go(VR.game, { dim: 'rock.0', via: 'cmd' }));
      check(await waitDim(P, 'rock.0'), 'Very Low: on TS-01');
      await P.settle(400);
      await P.ev(() => { VR.Fields.sunFix = [0.55, 0.35, 0.76]; const g = VR.game, sp = VR.Fields.rock.spawn; g.player.flying = true; g.player.noclip = true; g.player.teleport(sp[0], sp[1] + 0.5, sp[2]); });
      await P.step(10);
      const sky = await P.ev(() => (VR.Fields2.sky || []).map(n => n.dir));
      if (sky.length) await lookAlong(P, sky[0]);
      await P.step(4); await P.ev(() => { window.__Fv = window.__F; });
      const mv = await picture(P, '__Fv', SH('rubble_sky_vl.png'), K);
      // (the two frames in turns, three rounds: the medians)
      await P.ev(() => { window.__noNb = VR.Fields2.neighbours; VR.Fields2.neighbours = () => []; });
      await P.step(4); await P.ev(() => { window.__Fv0 = window.__F; });
      await P.ev(() => { VR.Fields2.neighbours = window.__noNb; });
      await P.step(4); await P.ev(() => { window.__Fv = window.__F; });
      const w1 = [], w0 = [], u1 = [];
      for (let r = 0; r < 3; r++) {
        await P.ev(() => { VR.Fields2.neighbours = window.__noNb; }); await P.step(2); await keep(P, '__Fv'); const a = await cost(P, '__Fv', 1, 4); w1.push(a.wallMs); u1.push(a.cpuMs);
        await P.ev(() => { VR.Fields2.neighbours = () => []; }); await P.step(2); await keep(P, '__Fv0'); const b = await cost(P, '__Fv0', 1, 4); w0.push(b.wallMs);
      }
      await P.ev(() => { VR.Fields2.neighbours = window.__noNb; });
      const c1 = { wallMs: med(w1), cpuMs: med(u1) }, c0 = { wallMs: med(w0) };
      Rr.rock = { wall: r1(c1.wallMs), cpu: r1(c1.cpuMs), wallOff: r1(c0.wallMs), draws: mv.draws };
      console.log(`  Very Low on TS-01: ${Rr.rock.wall} ms with the neighbours, ${Rr.rock.wallOff} ms without; the plaza ${Rr.plaza.wall} ms (${secs()})`);
      check(Rr.rock.wall <= Math.max(Rr.plaza.wall * 1.1, Rr.plaza.wall + 2), `Very Low: the rubble frame not dearer than the plaza (${Rr.rock.wall} vs ${Rr.plaza.wall} ms)`);
      check(Rr.rock.wall <= Rr.rock.wallOff * 1.1 + 1, `Very Low: the neighbours cost nothing to speak of (${Rr.rock.wall} vs ${Rr.rock.wallOff} ms)`);
      save();
    }
    const errs = P.logs.filter(l => l.startsWith('[pageerror]') || /shader|fields/i.test(l));
    check(!errs.length, `no page or shader error${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
  } catch (e) { check(false, 'the run threw: ' + String(e && e.stack || e).slice(0, 600)); }
  finally { await P.ctx.close(); }
}

for (const p of PRESETS) await runPreset(p);
await browser.close();
try {
  const f = (n) => { const p = SHOTS + n; try { return fs.statSync(p).mtimeMs >= T0 ? p : null; } catch (e) { return null; } };
  const rows = [];
  const row = (label, names) => { const imgs = names.map(f).filter(Boolean); if (imgs.length) rows.push({ label, imgs }); };
  row('Reiseantrieb zum Ring · im Ring', ['cruise_to_ring.png', 'ring_flythrough.png']);
  row('Wolkenflug (Hochziehen unter 1 km) · Ankunft im Schwarm', ['cloudtops_pass.png', 'swarm_arrive.png']);
  row('Nachbar am Himmel (G: Sprung) · Glimmspat', ['hop_neighbour.png', 'rubble_ore.png']);
  row('Very Low · Brocken mit Nachbarn · Platz', ['rubble_sky_vl.png', 'fields2_plaza_vl.png']);
  fs.writeFileSync(ROOT + '.tmp_tests/fields2_sheet.json', JSON.stringify({ w: 620, rows }));
  execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + 'fields2_sheet.jpg', ROOT + '.tmp_tests/fields2_sheet.json']);
  console.log('sheet: ' + SHOTS + 'fields2_sheet.jpg');
} catch (e) { console.log('(no sheet: ' + String(e.message || e).slice(0, 200) + ')'); }
save();
console.log(`\n${fails ? 'FAILED ' + fails : 'ALL OK'} (${secs()})`);
process.exit(fails ? 1 : 0);

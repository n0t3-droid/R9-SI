// u-dims · the worlds of one save in the browser (docs/superpowers/plans/2026-10-22-u-dims.md): pictures, the switch
// time, memory after round trips and the Very Low frame.
//  1 · page A (this build, Balanced, view 8): a world (seed 4242), a drift gate set into a stone frame in front of the
//      spawn (test/shots/dims_gate.png), the player steps into it: two seconds later the Driftinseln
//      (test/shots/dims_drift.png); 🏠 Heimkehr (game.goHome, the pause menu's button): back at Herzwelt's spawn
//      (test/shots/dims_home.png — the view Heimkehr chose, f-arrival R50-06: out of the hangar, the nearest geometry in
//      the frame's middle third ≥ 8 m; test/shots/dims_home_before.png the same place facing north as v0.49 showed it,
//      the hangar's craft 2 m ahead). Checks: the dims, where the player stands, the veil open again, the pointer never
//      handed back to a loading screen, no page error.
//  2 · page A: three round trips Herzwelt ⇄ Driftinseln (/dim and Heimkehr); after each return, settled at the spawn: the
//      JS heap after a GC (CDP) and the GPU arenas (count, MB allocated, MB used); the third within 5 % of the first.
//  3 · pages B (this build) and C (the build before, BEFORE_DIST, default .tmp_tests/before_src/dist — v042 de4d638) on
//      Very Low (potato): the Nova Haven plaza (ipu.mjs's plaza), the actors held still, rounds in turns (ms per frame
//      with the GPU drained, draws, triangles): ×1.00 ± 0.03 (or the same draws and triangles). Then on page B with the
//      game's own frame loop running: a gate trip and Heimkehr timed (gate → first frame of the other world, ms;
//      Heimkehr ≤ 6 s), the frame it opens on (test/shots/dims_home_potato.png). Both pages make the world at vgen 12
//      (CMP_VGEN): the same land in both builds, the code's cost compared (vgen 13's trees: test/arrival.js).
//  4 · pages B' and C' on High (view 8, ring 1's far forms off in both): the same plaza, the same work in both builds,
//      the frame before/after.
//   nohup bash test/wt_run.sh dims.mjs 5400 > .tmp_tests/dims.log 2>&1 &
//  5 · (HOME_VL=1: this part alone; f-arrival) Heimkehr on Very Low in both builds, the frames stepped: left from home
//      and from away, ≤ 6 s, facing out (test/shots/dims_home_vl_{after,before}.png)
//   NO_COST=1 · NO_HIGH=1 · ROUNDS=9 · N=30 · ROUNDS_HIGH=5 · N_HIGH=10 · SEED=4242 · BEFORE_DIST=file:///…/index.html
//   HOME_VL=1 · ROUNDS_H=2 · CMP_VGEN=12
// regress: skip  (a showcase with pictures and the cost against the build before; the gate is test/dims.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const ROOT = new URL('../', import.meta.url).pathname.replace(/\/$/, '');
const DIST = process.env.DIST || 'file://' + ROOT + '/dist/index.html';
const BEFORE = process.env.BEFORE_DIST || 'file://' + ROOT + '/.tmp_tests/before_src/dist/index.html';
const SHOTS = ROOT + '/test/shots/';
const SEED = process.env.SEED || '4242', ROUNDS = +(process.env.ROUNDS || 9), N = +(process.env.N || 30);
const CMP_VGEN = +(process.env.CMP_VGEN || 12);   // (the cost pages' generator in both builds: the same land, the code compared)
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const rec = { seed: SEED, trips: [], memory: [], cost: null, timed: null };
const save = () => { try { fs.writeFileSync(SHOTS + 'dims.json', JSON.stringify(rec, null, 1)); } catch (e) { /* a convenience */ } };
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });

// ---------------------------------------------------------------- a page with a world (motion.mjs's machinery)
async function openWorld(dist, preset, rd, natural, extra, wopt) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 500)}`); });
  page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1200)));
  page.on('crash', () => { logs.push('[pageerror] the page crashed'); console.log('  !! the page crashed'); });
  await page.goto(dist);
  const wait = (ms) => page.waitForTimeout(ms);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(4); } };
  const boost = (on) => ev((on) => { const g = VR.game, q = g.renderer && g.renderer.q; if (!q) return; if (on) { if (q.__up === undefined) q.__up = q.upload; q.upload = 24; } else if (q.__up !== undefined) { q.upload = q.__up; delete q.__up; } }, on);
  const settle = async (max = 60, farMax = 30) => {
    let s = null;
    await boost(true);
    for (let i = 0; i < max; i++) {
      await step(20, 16);
      s = await ev(() => { const g = VR.game, w = g.world, p = g.player; if (!w || !p || g.state !== 'play') return { state: g.state }; const rd = Math.max(1, (w.renderDist | 0) - 1), pcx = Math.floor(p.pos[0]) >> 4, pcz = Math.floor(p.pos[2]) >> 4; let dirty = 0; for (const c of w.cols.values()) { let n = 0; for (const sc of c.sec) if (sc.dirty || sc.pending) n++; const ex = c.cx - pcx, ez = c.cz - pcz; if (n && ex * ex + ez * ez <= rd * rd) dirty += n; } let unshown = 0; for (let dz = -rd; dz <= rd; dz++) for (let dx = -rd; dx <= rd; dx++) { if (dx * dx + dz * dz > rd * rd) continue; const c = w.col(pcx + dx, pcz + dz); if (!c || !(c.shownAt >= 0)) unshown++; } const h = g.horizon, f = h && h.far, fr = f && f.report ? f.report() : null; return { state: g.state, busy: g.pool.busy, pend: w.pending.size, dirty, up: w.uploadQ ? w.uploadQ.size : 0, fading: w.fading ? w.fading.size : 0, unshown, hz: h && h.enabled() ? h.inflight : 0, far: fr ? fr.inflight + fr.want : 0, hold: !!p.hold }; });
      const near = s.state === 'play' && s.busy === 0 && s.pend === 0 && s.dirty === 0 && s.up === 0 && s.fading === 0 && s.unshown === 0 && !s.hold;
      s.i = i;
      if (near && i > 2 && ((s.hz === 0 && s.far === 0) || i >= farMax)) break;
      await wait(30);
    }
    await boost(false);
    return s;
  };
  const picture = async (path, frames = 4) => {
    await ev((frames) => { window.__norender = false; const g = VR.game; for (let i = 0; i < frames; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }, frames);
    for (let k = 0; k < 2; k++) {
      try { await page.screenshot({ path, timeout: 150000 }); return true; } catch (e) { console.log(`  !! screenshot ${path.replace(/^.*\//, '')} failed (${String(e.message || e).split('\n')[0].slice(0, 120)})`); }
    }
    return false;
  };
  const cdp = await ctx.newCDPSession(page);
  const heapMB = async () => { await cdp.send('HeapProfiler.collectGarbage'); await wait(200); await cdp.send('HeapProfiler.collectGarbage'); const u = await cdp.send('Runtime.getHeapUsage'); return +(u.usedSize / 1048576).toFixed(2); };
  for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
  await ev(([p, rd, ex]) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; if (rd) g.settings.renderDist = rd; if (ex) Object.assign(g.settings, ex); g.applySettings('*'); }, [preset, rd, extra || null]);
  await ev((o) => VR.game.createWorld(Object.assign({ name: 'Welten', mode: 'creative', difficulty: 'peaceful', type: 'default', cheats: true, kit: true }, o)), Object.assign({ seed: SEED }, wopt || {}));
  for (let i = 0; i < 180; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
  const ok = await ev(() => VR.game.state) === 'play';
  // the test drives the frames itself (the page's own loop off), the weather clear, the hints away (pictures)
  await ev((natural) => { const g = VR.game; window.__raf = window.requestAnimationFrame.bind(window); if (!natural) window.requestAnimationFrame = () => 0; g.zenFreezeTime = true; g.zenFreezeWeather = true; g.env.wx.force('klar'); if (!document.getElementById('__nohint')) { const st = document.createElement('style'); st.id = '__nohint'; st.textContent = '#hint,#hints,#lockhint{display:none !important}'; document.head.appendChild(st); } }, !!natural);
  return { ctx, page, logs, ev, wait, step, settle, picture, heapMB, ok };
}
// the nearest geometry in the middle third (a third across, a third up) of the player's frame (f-arrival, R50-06): 9 × 5
// rays at the player's camera through the loaded blocks (no plants, no fluids; the ground under the feet not counted) and
// the ships near by as boxes (the test's own rays — not VR.Travel.facing's)
const midThird = (A) => A.ev(() => {
  const g = VR.game, w = g.world, p = g.player, R = VR.R, F = VR.F, fov = ((g.settings && g.settings.fov) || 75) * Math.PI / 180, th = Math.tan(fov / 2), asp = g.canvas.width / g.canvas.height;
  const eye = [p.pos[0], p.pos[1] + (p.eye || 1.62), p.pos[2]], feet = Math.floor(p.pos[1] + 0.01), yaw = p.yaw, pitch = p.pitch || 0;
  const f = [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)], r = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const boxes = []; for (const s of (g.starships && g.starships.ships) || []) { if (!s || !s.pos || Math.hypot(s.pos[0] - eye[0], s.pos[2] - eye[2]) > 60) continue; const m = s.d && s.d.meta, hw = m && m.bounds ? Math.max(m.bounds[3] - m.bounds[0], m.bounds[5] - m.bounds[2]) / 2 : 10, h = m && m.height ? m.height : 8; boxes.push([s.pos[0] - hw, s.pos[1], s.pos[2] - hw, s.pos[0] + hw, s.pos[1] + h, s.pos[2] + hw]); }
  let near = 60, what = 'nothing within 60 m';
  for (let j = 0; j < 5; j++) for (let i = 0; i < 9; i++) {
    const a = (-1 / 3 + i / 8 * (2 / 3)) * th * asp, b = (-1 / 3 + j / 4 * (2 / 3)) * th, d = [0, 1, 2].map(k => f[k] + r[k] * a + u[k] * b), l = Math.hypot(d[0], d[1], d[2]); for (let k = 0; k < 3; k++) d[k] /= l;
    for (const bx of boxes) { let t0 = -Infinity, t1 = Infinity; for (let k = 0; k < 3; k++) { const iv = 1 / (d[k] || 1e-12), q0 = (bx[k] - eye[k]) * iv, q1 = (bx[k + 3] - eye[k]) * iv; t0 = Math.max(t0, Math.min(q0, q1)); t1 = Math.min(t1, Math.max(q0, q1)); } if (t1 >= t0 && t1 > 0 && Math.max(0, t0) < near) { near = Math.max(0, t0); what = 'a ship'; } }
    for (let t = 0.05; t < near; t += 0.05) {
      const x = Math.floor(eye[0] + d[0] * t), y = Math.floor(eye[1] + d[1] * t), z = Math.floor(eye[2] + d[2] * t);
      if (y < feet) { if (d[1] < 0) break; continue; }
      const s = w.getBlock(x, y, z); if (!s) continue; const fl = R.T.flags[s];
      if ((fl & F.PLANT) || (fl & F.FLUID) || !((fl & (F.OPAQUE | F.LEAVES)) || (fl & F.SOLID))) continue;
      near = t; what = R.types[R.T.type[s]].name + ' (' + (x - Math.floor(eye[0])) + ', ' + (y - feet) + ', ' + (z - Math.floor(eye[2])) + ')'; break;
    }
  }
  return { near: +near.toFixed(1), what, yaw: +yaw.toFixed(3), pitch: +pitch.toFixed(3), fovDeg: Math.round(fov * 180 / Math.PI), ships: boxes.length };
});
const gpuOf = (A) => A.ev(() => { const r = VR.game.renderer; let cap = 0; for (const a of r.arenas) cap += a.cap * 16; return { arenas: r.arenas.length, allocMB: +(cap / 1048576).toFixed(1), usedMB: +r.gpuMemoryMB().toFixed(2), hzMB: VR.game.horizon && VR.game.horizon.stats ? +(VR.game.horizon.stats.mb || 0).toFixed(1) : 0 }; });
// a trip: started by `start` (in the page), the frames stepped until the first frame in `to`
async function trip(A, to, start, label) {
  await A.ev(() => { window.__lastTrip = VR.Travel.last; });
  const t0 = Date.now();
  await A.ev(start);
  let s = null;
  for (let i = 0; i < 900; i++) {
    await A.step(10, 33);
    s = await A.ev((to) => { const g = VR.game, L = VR.Travel.last; return { state: g.state, dim: g.dim, busy: VR.Travel.busy(g), arrived: !!(L && L !== window.__lastTrip && L.to === to), last: L }; }, to);
    if (s.arrived && s.state === 'play') break;
    await A.wait(20);
  }
  const r = { label, to, wallMs: Date.now() - t0, last: s && s.last, dim: s && s.dim };
  rec.trips.push(r); save();
  console.log(`  trip ${label}: ${JSON.stringify(r.last)} · ${r.wallMs} ms wall (stepped) (${secs()})`);
  return s;
}

// ================================================================ 5 · (HOME_VL=1 alone) Heimkehr on Very Low, both builds (f-arrival)
// The game's own loop runs a frame every few seconds on SwiftShader on this machine (part 3's run: the gate's 2 s took
// 140 s, its Heimkehr's 28.7 s were a handful of frames — u-dims measured 28–30 s the same way), so the trips are timed
// as u-home's newlife.mjs times them: the frames stepped by the test, nothing drawn until the arrival, VR.Travel.last's
// ms from the veil's start to the first play frame. Pages B (this build) and C (the build before), Very Low, the same
// land (vgen CMP_VGEN), in turns × ROUNDS_H: from home (the spawn's ring loaded when leaving: kept) and from 150 blocks
// away (nothing kept): /dim drift, 🏠. This build: ≤ 6 s both ways, facing out (the frame's middle third ≥ 8 m);
// test/shots/dims_home_vl_{after,before}.png the frame each opens on.
if (process.env.HOME_VL) {
  const out = { after: [], before: [] }, pages = [];
  const pB = await openWorld(DIST, 'potato', 0, false, null, { vgen: CMP_VGEN }); check(pB.ok, `page B (this build, Very Low) is loaded (${secs()})`); pages.push(['after', pB]);
  if (fs.existsSync(BEFORE.replace(/^file:\/\//, ''))) { const pC = await openWorld(BEFORE, 'potato', 0, false, null, { vgen: CMP_VGEN }); check(pC.ok, `page C (the build before, Very Low) is loaded (${secs()})`); pages.push(['before', pC]); }
  for (const [, P] of pages) { await P.page.bringToFront(); await P.settle(80, 10); }
  const R_H = +(process.env.ROUNDS_H || 2);
  for (let r = 0; r < R_H; r++) for (const [lbl, P] of (r & 1 ? pages.slice().reverse() : pages)) {
    await P.page.bringToFront();
    for (const from of ['home', 'away']) {
      await P.ev((away) => { const g = VR.game, p = g.player, s = p.spawn; p.flying = !!away; p.noclip = !!away; if (away) p.teleport(s[0] + 150, s[1] + 40, s[2]); else p.teleport(s[0], s[1], s[2]); p.yaw = 0; p.pitch = 0; }, from === 'away');
      await P.settle(60, 6);
      await trip(P, 'drift', () => { VR.Travel.go(VR.game, { dim: 'drift', via: 'cmd' }); }, `${lbl} (Very Low): /dim drift from ${from}`);
      await P.settle(30, 4);
      const s = await trip(P, 'overworld', () => { const g = VR.game; if (g.ui && g.ui.resume) g.ui.resume(); g.goHome(); }, `${lbl} (Very Low): Heimkehr, left from ${from}`);
      out[lbl].push({ from, round: r, ms: s && s.last ? s.last.totalMs : null, loadMs: s && s.last ? s.last.loadMs : null, face: s && s.last ? s.last.face || null : null });
    }
  }
  const med = (a) => { const b = a.filter(v => v !== null).sort((p, q) => p - q); return b.length ? b[b.length >> 1] : null; };
  for (const [lbl, P] of pages) {
    await P.page.bringToFront(); await P.step(24, 33);   // (the veil's 0.65 s)
    out[lbl + 'Mid'] = await midThird(P);
    await P.picture(SHOTS + 'dims_home_vl_' + lbl + '.png', 4);
  }
  rec.homeVL = out; save();
  const mh = med(out.after.filter(q => q.from === 'home').map(q => q.ms)), ma = med(out.after.filter(q => q.from === 'away').map(q => q.ms));
  const bh = med(out.before.filter(q => q.from === 'home').map(q => q.ms)), ba = med(out.before.filter(q => q.from === 'away').map(q => q.ms));
  console.log('  Heimkehr on Very Low (stepped)', JSON.stringify(out));
  check(mh !== null && ma !== null && mh <= 6000 && ma <= 6000, `Heimkehr on Very Low (SwiftShader, stepped): left from home ${mh} ms, from 150 blocks away ${ma} ms (≤ 6 s; the build before: ${bh} ms, ${ba} ms)`);
  const fa = out.after.map(q => q.face).filter(Boolean), mid = out.afterMid;
  check(fa.length === out.after.length && fa.every(f => f.clear >= 8) && mid && mid.near >= 8, `every Heimkehr faces out: ${fa.map(f => (f.yaw * 180 / Math.PI).toFixed(0) + '° ' + f.clear + ' m').join(', ')}; the last frame's middle third ${mid ? mid.near + ' m (' + mid.what + ')' : '—'} (the build before: ${out.beforeMid ? out.beforeMid.near + ' m, ' + out.beforeMid.what : '—'})`);
  for (const [lbl, P] of pages) { const errs = P.logs.filter(l => l.startsWith('[pageerror]')); check(errs.length === 0, `page ${lbl}: no page error (${errs.length})`); await P.ctx.close(); }
  await browser.close();
  console.log(`(${secs()})`);
  console.log(fails ? 'FAILED ' + fails : 'ALL OK');
  process.exit(fails ? 1 : 0);
}

// ================================================================ 1 · the gate, the drift, Heimkehr (pictures)
const A = await openWorld(DIST, 'balanced', 8, false);
check(A.ok, `page A: the world is loaded (Balanced, ${secs()})`);
await A.settle(80);
const info = await A.ev(() => { const g = VR.game, p = g.player; return { dim: g.dim, pos: p.pos.map(v => +v.toFixed(1)), spawn: p.spawn.map(v => +v.toFixed(1)), dimreg: !!VR.DimReg, travel: !!VR.Travel, gates: VR.Travel ? VR.Travel.portalTable().byName : null }; });
console.log('  start', JSON.stringify(info));
check(info.dim === 'overworld' && info.dimreg && info.travel, 'the game starts in Herzwelt with VR.DimReg and VR.Travel');
// a gate of the drift in a stone frame, 6 blocks north of the player (the player looks north: yaw 0 → −z)
const gate = await A.ev(() => {
  const g = VR.game, w = g.world, p = g.player, R = VR.R, F = VR.F;
  const st = (n, props) => { const t = R.byName[n]; return t ? (props ? t.state(props) : t.defaultState) : 0; };
  const x0 = Math.floor(p.pos[0]), z = Math.floor(p.pos[2]) - 6;
  const gy = (x, z) => { for (let y = 200; y > 20; y--) { const s = w.getBlock(x, y, z); if (s && (R.T.flags[s] & F.SOLID) && !(R.T.flags[s] & F.LEAVES)) return y; } return 60; };
  const y0 = Math.max(gy(x0, z), gy(x0 + 1, z)) + 1, frame = st('stone_bricks'), dg = st('drift_gate'), list = [];   // (its default: the panel across x, facing the player)
  for (let dx = -1; dx <= 2; dx++) for (let dy = -1; dy <= 3; dy++) {
    const x = x0 + dx, y = y0 + dy, edge = dx === -1 || dx === 2 || dy === -1 || dy === 3;
    list.push([x, y, z, edge ? frame : dg]);
  }
  for (let dx = -1; dx <= 2; dx++) for (let dz = 1; dz <= 5; dz++) for (let dy = 0; dy <= 3; dy++) { const s = w.getBlock(x0 + dx, y0 + dy, z + dz); if (s && dy >= 0) list.push([x0 + dx, y0 + dy, z + dz, 0]); }   // (a clear walk to it)
  w.bulkSet(list, false);
  p.flying = false; p.teleport(x0 + 0.5, y0, z + 5.5); p.yaw = 0; p.pitch = 0.08;
  return { x: x0, y: y0, z, cells: list.length, drift: !!R.byName.drift_gate };
});
console.log('  gate', JSON.stringify(gate));
await A.settle(40, 4);
await A.ev(() => { VR.game.env.setTime(5200); VR.game.env.wx.force('klar'); });
check(await A.picture(SHOTS + 'dims_gate.png', 6), 'test/shots/dims_gate.png — the drift gate in Herzwelt');
// the player walks into the gate and stands there: two seconds later the drift
const lockHandedBack = await A.ev(() => { window.__screens = []; const ui = VR.game.ui, sh = ui.show.bind(ui); ui.show = (id) => { window.__screens.push(id); return sh(id); }; return true; });
void lockHandedBack;
await A.ev(([x, y, z]) => { const p = VR.game.player; p.teleport(x + 0.5, y, z + 0.5); p.yaw = 0; window.__gateAt = performance.now(); }, [gate.x, gate.y, gate.z]);
let s1 = null;
{
  await A.ev(() => { window.__lastTrip = VR.Travel.last; });
  let started = false, charge = 0;
  for (let i = 0; i < 400; i++) {
    await A.step(4, 33);
    const s = await A.ev(() => { const g = VR.game, el = document.getElementById('travelVeil'); return { busy: VR.Travel.busy(g), state: g.state, op: el ? +el.style.opacity : 0, gateT: g.travel ? +g.travel.gateT.toFixed(2) : 0 }; });
    charge = Math.max(charge, s.op);
    if (s.busy) { started = true; break; }
  }
  check(started, `standing in the gate starts the trip (the veil charged to ${charge.toFixed(2)})`);
  s1 = await trip(A, 'drift', () => {}, 'gate → drift');
}
const atDrift = await A.ev(() => { const g = VR.game, p = g.player; return { dim: g.dim, wdim: g.world.dim, sky: g.world.hasSky, dimId: g.env.E.dimId, pos: p.pos.map(v => +v.toFixed(1)), meta: { dim: g.meta.dim, pos: Object.keys(g.meta.pos || {}) }, screens: window.__screens.slice(), captured: g.input.captured }; });
console.log('  drift', JSON.stringify(atDrift));
check(s1 && s1.arrived && atDrift.dim === 'drift' && atDrift.wdim === 'drift' && atDrift.sky === true && atDrift.dimId === 3, 'through the gate into the Driftinseln (the world, its sky, u_dim 3)');
check(!atDrift.screens.includes('loading'), `no loading screen during the trip (the veil instead; screens shown: ${JSON.stringify(atDrift.screens)})`);
check(atDrift.meta.dim === 'drift' && atDrift.meta.pos.includes('overworld'), 'the save knows: in the drift, Herzwelt\'s place kept');
await A.settle(80, 10);
await A.ev(() => { const g = VR.game, p = g.player; g.env.setTime(5200); g.env.wx.force('klar'); p.pitch = -0.12; });
await A.step(40, 33);   // (the veil's 0.65 s and a little more)
const veil1 = await A.ev(() => { const el = document.getElementById('travelVeil'); return el ? +el.style.opacity : -1; });
check(veil1 === 0, `the veil is open again (opacity ${veil1})`);
check(await A.picture(SHOTS + 'dims_drift.png', 6), 'test/shots/dims_drift.png — arrived on the Driftinseln');
// 🏠 Heimkehr, as the pause menu's button does it (resume, then goHome)
const s2 = await trip(A, 'overworld', () => { const g = VR.game; g.ui.resume(); g.goHome(); }, 'Heimkehr drift → Herzwelt');
const atHome = await A.ev(() => { const g = VR.game, p = g.player, sp = p.spawn; return { dim: g.dim, pos: p.pos.map(v => +v.toFixed(1)), spawn: sp.map(v => +v.toFixed(1)), d: Math.hypot(p.pos[0] - sp[0], p.pos[2] - sp[2]), hold: !!p.hold, keys: Object.keys(g.meta.pos || {}) }; });
console.log('  home', JSON.stringify(atHome));
await A.settle(100, 30);
const atHome2 = await A.ev(() => { const g = VR.game, p = g.player, sp = p.spawn; return { dim: g.dim, pos: p.pos.map(v => +v.toFixed(1)), d: Math.hypot(p.pos[0] - sp[0], p.pos[2] - sp[2]) }; });
check(s2 && s2.arrived && atHome2.dim === 'overworld' && atHome2.d < 4, `Heimkehr: back in Herzwelt at the spawn (${atHome2.d.toFixed(1)} blocks from it)`);
// the workers kept Herzwelt's generator warm (worker_main.js init keep): Heimkehr is not the loading screen's 25-s limit
// (run 1, before the keep: 25.0–25.9 s every time — the Heartland's plans built again)
check(s2 && s2.last && s2.last.loadMs < 15000, `Heimkehr loads in ${s2 && s2.last ? s2.last.loadMs : '?'} ms (below 15 s; the loading limit is 25 s)`);
check(atHome.keys.includes('drift'), 'the drift\'s place is kept for the next visit');
// (f-arrival, R50-06: the view Heimkehr chose is kept for the picture — u-dims's run turned it north, into the hangar's
// craft, and that was the picture the review saw: dims_home_before.png shows that view again)
await A.ev(() => { const g = VR.game; g.env.setTime(5200); g.env.wx.force('klar'); });
await A.step(40, 33);
const face = s2 && s2.last ? s2.last.face : null, mid = await midThird(A);
rec.home = { face, mid }; save();
console.log('  Heimkehr\'s view', JSON.stringify(rec.home));
check(await A.picture(SHOTS + 'dims_home.png', 6), 'test/shots/dims_home.png — after Heimkehr, the view it chose');
check(!!face && face.clear >= 8 && mid.near >= 8, `Heimkehr faces out: the view ${face ? (face.yaw * 180 / Math.PI).toFixed(0) + '°' + (face.kept ? ' (the world\'s own spawn view)' : '') : '—'}; the nearest geometry in its frame's middle third ${mid.near} m (${mid.what}; Travel.facing's rays: ${face ? face.clear + ' m' : '—'}) — ≥ 8 m`);
const yaw1 = await A.ev(() => { const p = VR.game.player, y = [p.yaw, p.pitch]; p.yaw = 0; if ('viewYaw' in p) p.viewYaw = 0; p.pitch = 0.04; return y; });
await A.step(4, 33);
rec.homeBefore = await midThird(A); save();
check(await A.picture(SHOTS + 'dims_home_before.png', 6), `test/shots/dims_home_before.png — the same place facing north, as v0.49's picture showed it (its middle third: ${rec.homeBefore.near} m, ${rec.homeBefore.what})`);
await A.ev((y) => { const p = VR.game.player; p.yaw = y[0]; if ('viewYaw' in p) p.viewYaw = y[0]; p.pitch = y[1]; }, yaw1);

// ================================================================ 2 · three round trips: memory
console.log(`round trips (${secs()})`);
{
  const base = { heap: await A.heapMB(), gpu: await gpuOf(A) };
  rec.memory.push(Object.assign({ after: 'start' }, base)); save();
  console.log('  memory at the start', JSON.stringify(base));
  for (let i = 1; i <= 3; i++) {
    await trip(A, 'drift', () => { VR.Travel.go(VR.game, { dim: 'drift', via: 'cmd' }); }, `round ${i}: /dim drift`);
    await A.settle(40, 4);
    await trip(A, 'overworld', () => { VR.game.goHome(); }, `round ${i}: Heimkehr`);
    const st = await A.settle(100, 30);
    const m = { after: 'round ' + i, heap: await A.heapMB(), gpu: await gpuOf(A), settled: st };
    rec.memory.push(m); save();
    console.log(`  memory after round ${i}`, JSON.stringify({ heap: m.heap, gpu: m.gpu }));
  }
  const r1 = rec.memory[1], r3 = rec.memory[3];
  const hr = r3.heap / r1.heap, ur = r3.gpu.usedMB / r1.gpu.usedMB;
  check(Math.abs(hr - 1) <= 0.05, `the JS heap after three round trips is within 5 % of the first (${r1.heap} → ${r3.heap} MB, ×${hr.toFixed(3)})`);
  check(r3.gpu.arenas <= r1.gpu.arenas && Math.abs(ur - 1) <= 0.05, `the GPU arenas too (${r1.gpu.arenas} → ${r3.gpu.arenas} arenas, ${r1.gpu.allocMB} → ${r3.gpu.allocMB} MB allocated, used ${r1.gpu.usedMB} → ${r3.gpu.usedMB} MB, ×${ur.toFixed(3)})`);
}
{
  const errs = A.logs.filter(l => l.startsWith('[pageerror]'));
  console.log(`--- page A logs (${A.logs.length})`); for (const l of A.logs.slice(0, 12)) console.log(l);
  check(errs.length === 0, `page A: no page error (${errs.length})`);
  check(!A.logs.some(l => /shader|compile|link/i.test(l)), 'page A: every shader compiles');
}
await A.ctx.close();

// ================================================================ 3 · Very Low: the plaza frame against the build before, the switch time
if (!process.env.NO_COST) {
  const beforeOk = fs.existsSync(BEFORE.replace(/^file:\/\//, ''));
  if (!beforeOk) console.log(`  (no build before at ${BEFORE}: the cost is not compared)`);
  const PLAZA = [3.5, -96.5, 1.62, 0.3, 0.03];
  const place = async (Pg, farMax = 200) => {
    await Pg.page.bringToFront();
    await Pg.ev(([x, z]) => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(x, 150, z); }, PLAZA);
    await Pg.settle(60, 6);
    await Pg.ev(([x, z, eye, yaw, pitch]) => { const g = VR.game, w = g.world, p = g.player, R = VR.R, F = VR.F; let y = 160; for (; y > 30; y--) { const s = w.getBlock(Math.floor(x), y, Math.floor(z)); if (s && (R.T.flags[s] & F.OPAQUE) && !(R.T.flags[s] & F.LEAVES)) break; } p.teleport(x, y + 1 + eye - 1.62, z); p.yaw = yaw; p.pitch = pitch; p.vel = [0, 0, 0]; g.env.setTime(6000); }, PLAZA);
    const st = await Pg.settle(200, farMax); await Pg.step(6);
    // the actors hold still in both builds (the same code in both): what moves is not this front's
    await Pg.ev(() => { const g = VR.game; for (const k of ['traffic', 'padLife', 'lifeDirector', 'director', 'starships', 'hall', 'trams', 'companions', 'entities', 'mirror', 'wow']) { const o = g[k]; if (o && typeof o.update === 'function') o.update = function () {}; } const V = g.villages; for (const k of ['updateAgent', 'updateBoats']) if (V && typeof V[k] === 'function') V[k] = function () {}; });
    return st;
  };
  // (each page in front while it is measured: a page behind another has its timers and frames held back)
  const measure = async (Pg, n) => { await Pg.page.bringToFront(); await Pg.wait(150); return measure1(Pg, n); };
  const measure1 = (Pg, n) => Pg.ev((n) => new Promise((ok, no) => { const g = VR.game, gl = g.renderer.gl; window.__norender = false; let k = -2, sum = 0, d = 0, t = 0; const f = () => { try { const t0 = performance.now(); g.last = performance.now() - 33; g.loop(performance.now()); gl.finish(); const dt = performance.now() - t0; if (k < 0) { k++; setTimeout(f, 0); return; } const st = g.renderer.stats || {}; sum += dt; d += st.draws || 0; t += st.tris || 0; if (++k < n) setTimeout(f, 0); else { window.__norender = true; ok({ ms: +(sum / n).toFixed(2), draws: Math.round(d / n), tris: Math.round(t / n) }); } } catch (e) { no(String(e)); } }; f(); }), n);
  // rounds in turns (the order flips every round), each page n frames: medians, the lower halves, the pairs' ratio
  const compare = async (pages, nRounds, n) => {
    const rounds = {};
    for (let r = 0; r < nRounds; r++) { const order = r & 1 ? pages.slice().reverse() : pages; for (const [lbl, Pg] of order) (rounds[lbl] = rounds[lbl] || []).push(await measure(Pg, n)); }
    const out = {};
    for (const lbl of Object.keys(rounds)) { const ms = rounds[lbl].map(q => q.ms).sort((a, b) => a - b), mid = rounds[lbl][nRounds >> 1], lo = ms.slice(0, Math.ceil(ms.length / 2)); out[lbl] = { msMedian: ms[ms.length >> 1], msLow: +(lo.reduce((a, b) => a + b, 0) / lo.length).toFixed(2), ms, draws: mid.draws, tris: mid.tris }; }
    out.ratio = +(out.after.msMedian / out.before.msMedian).toFixed(3); out.lowRatio = +(out.after.msLow / out.before.msLow).toFixed(3);
    // the rounds in pairs (the two pages measured back to back): the median of the pairs' ratios, the machine's drift out
    const pr = rounds.after.map((q, i) => q.ms / rounds.before[i].ms).sort((a, b) => a - b);
    out.pairRatio = +pr[pr.length >> 1].toFixed(3);
    out.sameWork = out.after.draws === out.before.draws && Math.abs(out.after.tris - out.before.tris) <= 0.001 * out.before.tris;   // (the actors stand where they stood when held: a few triangles apart)
    return out;
  };
  const pages = [];
  try {
    const B = await openWorld(DIST, 'potato', 0, false, null, { vgen: CMP_VGEN }); check(B.ok, `page B (this build, Very Low) is loaded (${secs()})`); pages.push(['after', B]);
    console.log('  B settled', JSON.stringify(await place(B)));
    await B.picture(SHOTS + 'dims_potato_plaza.png', 8);
    if (beforeOk) { const C = await openWorld(BEFORE, 'potato', 0, false, null, { vgen: CMP_VGEN }); check(C.ok, `page C (the build before, Very Low) is loaded (${secs()})`); pages.push(['before', C]); console.log('  C settled', JSON.stringify(await place(C))); }
    if (pages.length === 2) {
      const out = await compare(pages, ROUNDS, N);
      rec.cost = out; save();
      console.log('  very low · plaza', JSON.stringify(out));
      // ×1.00 ± 0.03 — swiftshader's noise between rounds is larger than that, so: never slower than ×1.03 (the pairs'
      // median), with the same draws and triangles (the same work); faster is noise and is reported as it is
      check(out.pairRatio <= 1.03 && out.sameWork, `the Very Low plaza frame is unchanged: the pairs ×${out.pairRatio}, the medians ×${out.ratio} (${out.after.msMedian} against ${out.before.msMedian} ms), the lower halves ×${out.lowRatio}; draws ${out.after.draws}/${out.before.draws}, triangles ${out.after.tris}/${out.before.tris}`);
    }
    // close the build before's page first: the switch time is taken on this build alone, with its own frame loop
    for (const [lbl, Pg] of pages) if (lbl === 'before') { const errs = Pg.logs.filter(l => l.startsWith('[pageerror]')); check(errs.length === 0, `page C: no page error (${errs.length})`); await Pg.ctx.close(); }
    // the switch time on Very Low, the game running on its own (its rAF loop, every frame drawn) — page B in front (a
    // page behind another gets its frames and timers held back: run 1 timed 95 s for the gate's 2 s)
    await B.page.bringToFront(); await B.wait(300);
    console.log('  page B:', JSON.stringify(await B.ev(() => ({ visibility: document.visibilityState, focus: document.hasFocus() }))));
    const tm = await B.ev(() => new Promise((ok) => {
      const g = VR.game, w = g.world, p = g.player, R = VR.R;
      window.__norender = false; window.requestAnimationFrame = window.__raf; g.last = performance.now(); requestAnimationFrame((t) => g.loop(t));
      const x = Math.floor(p.pos[0]) + 3, z = Math.floor(p.pos[2]), y = Math.floor(p.pos[1] + 0.01);
      p.noclip = false; p.flying = false;
      w.bulkSet([[x, y, z, R.byName.drift_gate.defaultState], [x, y + 1, z, R.byName.drift_gate.defaultState]], false);
      const out = { gateAt: 0, start: 0, play: 0, home0: 0, homePlay: 0 };
      setTimeout(() => {
        p.teleport(x + 0.5, y, z + 0.5); out.gateAt = performance.now();
        const L0 = VR.Travel.last;
        const poll = setInterval(() => {
          if (!out.start && VR.Travel.busy(g)) out.start = performance.now();
          const L = VR.Travel.last;
          if (!out.play && L && L !== L0 && L.to === 'drift' && g.state === 'play') {
            out.play = performance.now(); out.toDrift = L;
            setTimeout(() => { const L1 = VR.Travel.last; out.home0 = performance.now(); g.goHome(); const poll2 = setInterval(() => { const L2 = VR.Travel.last; if (L2 && L2 !== L1 && L2.to === 'overworld' && g.state === 'play') { out.homePlay = performance.now(); out.toHome = L2; clearInterval(poll2); ok(out); } }, 25); }, 1500);
          }
          if (performance.now() - out.gateAt > 240000) { clearInterval(poll); ok(out); }
        }, 25);
      }, 500);
    }));
    const t = { gateToStartMs: Math.round(tm.start - tm.gateAt), switchMs: tm.toDrift ? tm.toDrift.totalMs : null, gateToFrameMs: tm.play ? Math.round(tm.play - tm.gateAt) : null, toDrift: tm.toDrift, homeMs: tm.toHome ? tm.toHome.totalMs : null, toHome: tm.toHome };
    rec.timed = t; save();
    console.log('  timed (Very Low, its own loop)', JSON.stringify(t));
    check(t.switchMs !== null && t.homeMs !== null, `the switch time on Very Low: the trip ${t.switchMs} ms from its start to the first frame of the Driftinseln (the gate's 2 s before it: ${t.gateToStartMs} ms), Heimkehr ${t.homeMs} ms`);
    // (f-arrival, R50-06) Heimkehr on Very Low: within 6 s, and the frame it opens on faces out
    await B.wait(1200);
    const midP = await midThird(B), faceP = t.toHome ? t.toHome.face : null;
    rec.timed.mid = midP; save();
    try { await B.page.screenshot({ path: SHOTS + 'dims_home_potato.png', timeout: 150000 }); } catch (e) { console.log('  !! screenshot dims_home_potato.png failed'); }
    check(t.homeMs !== null && t.homeMs <= 6000 && !!faceP && midP.near >= 8, `Heimkehr on Very Low (SwiftShader, the game's own loop): ${t.homeMs} ms (≤ 6 s), the view ${faceP ? JSON.stringify(faceP) : '—'}, the nearest geometry in the frame's middle third ${midP.near} m (${midP.what}) — test/shots/dims_home_potato.png`);
    const errs = B.logs.filter(l => l.startsWith('[pageerror]'));
    console.log(`--- page B logs (${B.logs.length})`); for (const l of B.logs.slice(0, 8)) console.log(l);
    check(errs.length === 0, `page B: no page error (${errs.length})`);
    await B.ctx.close();
  } catch (e) { check(false, `the Very Low part ran (${String(e.message || e).slice(0, 300)})`); }
  // ---------------------------------------------------------------- 4 · High: the same plaza, both builds (the cost before/after)
  // High's switches (shadows, bloom, rays, materials, water) at view 8 with ring 1's far forms off in both builds (their
  // minutes of worker time on this machine, as cost_before_after.mjs holds the view): the same work in both, timed in turns
  if (!process.env.NO_HIGH && fs.existsSync(BEFORE.replace(/^file:\/\//, ''))) {
    const pagesH = [];
    try {
      const BH = await openWorld(DIST, 'high', 8, false, { far: 0 }, { vgen: CMP_VGEN }); check(BH.ok, `page B' (this build, High) is loaded (${secs()})`); pagesH.push(['after', BH]);
      const sb = await place(BH, 150); console.log('  B\' settled', JSON.stringify(sb));
      const CH = await openWorld(BEFORE, 'high', 8, false, { far: 0 }, { vgen: CMP_VGEN }); check(CH.ok, `page C' (the build before, High) is loaded (${secs()})`); pagesH.push(['before', CH]);
      const sc = await place(CH, 150); console.log('  C\' settled', JSON.stringify(sc));
      const outH = await compare(pagesH, +(process.env.ROUNDS_HIGH || 5), +(process.env.N_HIGH || 10));
      outH.settled = [sb && sb.hz === 0 && sb.far === 0, sc && sc.hz === 0 && sc.far === 0];
      rec.costHigh = outH; save();
      console.log('  high · plaza', JSON.stringify(outH));
      check(outH.sameWork, `High: the same work in both builds (draws ${outH.after.draws}/${outH.before.draws}, triangles ${outH.after.tris}/${outH.before.tris}); the frame ×${outH.pairRatio} (pairs), ×${outH.ratio} (medians ${outH.after.msMedian} against ${outH.before.msMedian} ms)`);
      for (const [lbl, Pg] of pagesH) { const errs = Pg.logs.filter(l => l.startsWith('[pageerror]')); check(errs.length === 0, `High page ${lbl}: no page error (${errs.length})`); }
    } catch (e) { check(false, `the High part ran (${String(e.message || e).slice(0, 300)})`); }
    for (const [, Pg] of pagesH) { try { await Pg.ctx.close(); } catch (e) { /* closed */ } }
  }
}
await browser.close();
console.log(`(${secs()})`);
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

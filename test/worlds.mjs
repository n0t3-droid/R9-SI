// u-moons1 · Basalt and Opal in the browser (docs/superpowers/plans/2026-10-22-u-moons1.md §3): the pictures, the jump,
// the column time, the frames.
//  1 · page A (this build, High, view 8 at home and High's own 14 on the moons, seed 4242, no HUD): /dim basalt →
//      basalt_noon (the landing, Helia high), basalt_amarantrise (Helia just over the western horizon, Amarant full and
//      rising in the east), basalt_crater (the landmark from its central peak: the floor, the west wall's terraces in the
//      morning sun), basalt_amarantnight (night under a full Amarant); the jump on Basalt; /dim opal → opal_geyser (a
//      vent erupting, against the light), opal_lineae (from 28 m up), opal_eclipse (Helia behind Amarant); the jump on
//      Opal in the game's own loop (27.6 ± 0.5 m); the moons' column time against Herzwelt's (the generators in the
//      page, the same chunks)
//  2 · Very Low (potato): page B1 (this build) and page C (the build before, BEFORE_DIST — v042 0d0144b) at the Nova
//      Haven plaza, rounds in turns: the frame ×1.00 (never slower than ×1.03, the same draws and triangles); then page
//      B2 (this build) on Basalt's landing against B1's plaza: the moon's frame no dearer; pictures basalt_noon_vl,
//      opal_eclipse_vl
//  3 · High (view 8, far forms off): page A2 (this build) and C2 (before) at the plaza: the frame before/after
//   nohup bash test/wt_run.sh worlds.mjs 5400 > .tmp_tests/worlds.log 2>&1 &
//   NO_COST=1 · NO_HIGH=1 · ROUNDS=7 · N=16 · SEED=4242 · BEFORE_DIST=file:///…/index.html · ONLY=basalt|opal
// regress: skip  (a showcase with pictures and the costs; the gates are test/bodies.js and test/body_same.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const ROOT = new URL('../', import.meta.url).pathname.replace(/\/$/, '');
const DIST = process.env.DIST || 'file://' + ROOT + '/dist/index.html';
const BEFORE = process.env.BEFORE_DIST || 'file://' + ROOT + '/.tmp_tests/before_src/dist/index.html';
const SHOTS = ROOT + '/test/shots/';
const SEED = process.env.SEED || '4242', ROUNDS = +(process.env.ROUNDS || 7), N = +(process.env.N || 16);
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
// the run's own deadline (wt_run's timeout is 3600 s): a part that would not fit is skipped and counted, so the run
// always ends with its verdict
const BUDGET = +(process.env.BUDGET || 3350), left = () => BUDGET - (Date.now() - T0) / 1000;
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const rec = { seed: SEED, pictures: {}, jumps: {}, columns: null, cost: null, costMoon: null, costHigh: null };
const save = () => { try { fs.writeFileSync(SHOTS + 'worlds.json', JSON.stringify(rec, null, 1)); } catch (e) { /* a convenience */ } };
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });

// ---------------------------------------------------------------- a page with a world (dims.mjs's machinery)
async function openWorld(dist, preset, rd, extra) {
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
  for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
  await ev(([p, rd, ex]) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; if (rd) g.settings.renderDist = rd; if (ex) Object.assign(g.settings, ex); g.applySettings('*'); }, [preset, rd, extra || null]);
  await ev(`VR.game.createWorld({name:'Monde',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',cheats:true,kit:true})`);
  for (let i = 0; i < 180; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
  const ok = await ev(() => VR.game.state) === 'play';
  await ev(() => { const g = VR.game; window.__raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = () => 0; g.zenFreezeTime = true; g.zenFreezeWeather = true; g.env.wx.force('klar'); if (!document.getElementById('__nohint')) { const st = document.createElement('style'); st.id = '__nohint'; st.textContent = '#hint,#hints,#lockhint,#toasts,.toast{display:none !important}'; document.head.appendChild(st); } g.hideHud = true; const hud = document.getElementById('hud'); if (hud) hud.style.visibility = 'hidden'; });   // (postcards: no HUD, no hand)
  return { ctx, page, logs, ev, wait, step, settle, picture, ok };
}
// a trip to `to` (/dim), the frames stepped until the first frame there
async function trip(A, to) {
  await A.ev(() => { window.__lastTrip = VR.Travel.last; });
  await A.ev((to) => { VR.Travel.go(VR.game, { dim: to, via: 'cmd' }); }, to);
  let s = null;
  for (let i = 0; i < 900; i++) {
    await A.step(10, 33);
    s = await A.ev((to) => { const g = VR.game, L = VR.Travel.last; return { state: g.state, dim: g.dim, arrived: !!(L && L !== window.__lastTrip && L.to === to), last: L }; }, to);
    if (s.arrived && s.state === 'play') break;
    await A.wait(20);
  }
  console.log(`  trip → ${to}: ${JSON.stringify(s && s.last)} (${secs()})`);
  return s;
}
// the world clock set so that VR.Universe's time is t seconds (frozen: zenFreezeTime)
const setT = (A, t) => A.ev((t) => { const e = VR.game.env, k = Math.round(t * 20); e.day = Math.floor(k / 24000); e.ticks = k - e.day * 24000; }, t);
// the camera: flying in place at (x, y, z) looking at yaw / pitch (radians)
const place = (A, x, y, z, yaw, pitch) => A.ev(([x, y, z, yaw, pitch]) => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(x, y, z); p.yaw = yaw; p.pitch = pitch; p.vel = [0, 0, 0]; }, [x, y, z, yaw, pitch]);
const shot = async (A, name, frames = 6) => { await A.step(60, 33); const ok = await A.picture(SHOTS + name + '.png', frames); const info = await A.ev(() => { const B = VR.BodySky, c = B && B.cur; return c ? { exposure: +VR.game.env.E.exposure.toFixed(2), sunEl: +(c.light.sunEl * 57.3).toFixed(1), lightK: +c.light.lightK.toFixed(2), eclipse: +c.light.eclipse.toFixed(2), parEl: +(c.light.parEl * 57.3).toFixed(1), parPhase: +c.light.parPhase.toFixed(2), plumes: B.plumes.length, bodySky: !!VR.game.renderer.bsBuilt, dimId: VR.game.env.E.dimId } : null; }); rec.pictures[name] = info; save(); check(ok, `test/shots/${name}.png ${JSON.stringify(info)}`); return ok; };
// a jump in the game's own loop: the up-velocity of player.js's jump (9.1 m/s), the frames stepped, the highest point
const jumpOf = (A) => A.ev(() => new Promise((ok) => {
  const g = VR.game, p = g.player; p.flying = false; p.noclip = false;
  let i = 0; const y0 = p.pos[1]; let top = 0, t = 0, left = false;
  const f = () => { g.last = performance.now() - 16.7; g.loop(performance.now()); t += 1 / 60; top = Math.max(top, p.pos[1] - y0); if (p.pos[1] > y0 + 0.1) left = true; if ((left && p.onGround) || ++i > 60 * 40) return ok({ top: +top.toFixed(2), air: +t.toFixed(2), g: VR.DimReg.gravity(g.dim) }); f(); };
  for (let k = 0; k < 20; k++) { g.last = performance.now() - 16.7; g.loop(performance.now()); }
  p.vel[1] = 9.1; p.onGround = false; f();
}));

// ================================================================ 1 · page A: the pictures, the jumps, the columns
const ONLY = process.env.ONLY || '';
const A = await openWorld(DIST, 'high', 8, { far: 0 });
check(A.ok, `page A: the world is loaded (High, view 8, ${secs()})`);
await A.settle(60, 6);
// the column time: the moons' generators against Herzwelt's, in the page (the code the workers run), the same chunks
{
  const c = await A.ev(() => {
    const seed = VR.game.meta.seed >>> 0, coords = []; for (let k = 0; k < 16; k++) coords.push([((k * 7) % 11) - 5 + 30, ((k * 5) % 9) - 4 - 20]);
    const time = (g) => { for (const [x, z] of coords.slice(0, 3)) g.generate(x + 40, z + 40); const t0 = performance.now(); for (const [x, z] of coords) g.generate(x, z); return (performance.now() - t0) / coords.length; };
    return { overworld: +time(VR.makeGen('overworld', seed, { vgen: VR.game.meta.vgen })).toFixed(1), basalt: +time(new VR.BodyGen(seed, 'basalt', {})).toFixed(1), opal: +time(new VR.BodyGen(seed, 'opal', {})).toFixed(1) };
  });
  rec.columns = c; save();
  check(c.basalt <= c.overworld && c.opal <= c.overworld, `a moon's chunk no slower than Herzwelt's (ms a chunk: Herzwelt ${c.overworld}, Basalt ${c.basalt}, Opal ${c.opal})`);
}
const homeJump = await jumpOf(A);
rec.jumps.home = homeJump; save();
if (ONLY !== 'opal') {
  const s = await trip(A, 'basalt');
  const at = await A.ev(() => { const g = VR.game, p = g.player; return { dim: g.dim, dimId: g.env.E.dimId, sky: g.world.hasSky, pos: p.pos.map(v => +v.toFixed(1)), yaw: +p.yaw.toFixed(2), want: VR.BodySky.want }; });
  console.log('  basalt', JSON.stringify(at));
  check(s && s.arrived && at.dim === 'basalt' && at.dimId === 5 && at.want, 'with /dim to Basalt (u_dim 5, the body\'s sky)');
  // the pictures at High's own view (14 chunks: a crater's walls 180 m off, the moon's horizon 300 m off)
  await A.ev(() => { const g = VR.game; g.settings.renderDist = 14; g.applySettings('renderDist'); });
  await A.settle(80, 6);
  const L = await A.ev(() => { const g = new VR.BodyGen(VR.game.meta.seed >>> 0, 'basalt', {}), L = g.landmark; return { x: L.x, z: L.z, R: L.R, rimY: g.surfaceY(Math.round(L.x), Math.round(L.z + L.R)), peakY: g.surfaceY(Math.floor(L.x), Math.floor(L.z)), spawnY: g.surfaceY(0, 0) }; });
  // the landing at noon: north over the mare (Helia high behind)
  await setT(A, 2850); await place(A, 0.5, L.spawnY + 2.62, 0.5, 0, -0.06);
  await A.settle(40, 4); await shot(A, 'basalt_noon');
  // Helia setting in the west, Amarant full and rising in the east over the long shadows
  await setT(A, 440); await place(A, 0.5, L.spawnY + 2.62, 0.5, -99 * Math.PI / 180, 0.05);
  await A.settle(20, 2); await shot(A, 'basalt_amarantrise');
  // the landmark from the top of its central peak: the flat floor of dark melt, the west wall's terraces rising 40 m to the
  // rim 180 m off, lit by the morning sun from the east-south-east behind (run 1 from the south rim at view 8 saw no crater)
  await setT(A, 2400); await place(A, L.x + 0.5, L.peakY + 2.0, L.z + 0.5, Math.PI / 2, 0.04);
  await A.settle(80, 6); await shot(A, 'basalt_crater');
  // night under a full Amarant (34° high): the mare in the giant's lilac light, the eye opened
  await setT(A, 1300); await place(A, 0.5, L.spawnY + 2.62, 0.5, Math.PI, 0.3);
  await A.settle(20, 2); await shot(A, 'basalt_amarantnight');
  // the jump on Basalt (8.4 m)
  await place(A, 0.5, L.spawnY + 1.2, 0.5, 0, 0); await A.settle(20, 2);
  rec.jumps.basalt = await jumpOf(A); save();
  check(Math.abs(rec.jumps.basalt.top - 8.43) < 0.4, `a jump on Basalt in the game: ${JSON.stringify(rec.jumps.basalt)} (8.4 m)`);
}
if (ONLY !== 'basalt') {
  const s = await trip(A, 'opal');
  const at = await A.ev(() => { const g = VR.game, p = g.player; return { dim: g.dim, dimId: g.env.E.dimId, pos: p.pos.map(v => +v.toFixed(1)), want: VR.BodySky.want }; });
  console.log('  opal', JSON.stringify(at));
  check(s && s.arrived && at.dim === 'opal' && at.dimId === 5 && at.want, 'with /dim to Opal');
  await A.settle(80, 6);
  // a vent erupting under a high Helia (in the morning: 1500–3300 s), seen from 230 m north, against the light
  const G = await A.ev(() => {
    const gen = new VR.BodyGen(VR.game.meta.seed >>> 0, 'opal', {}), prof = VR.Bodies.profile('opal'), BL = VR.BodyLife;
    let best = null;
    for (const v of gen.vents()) { if (Math.abs(v.x) > 700) continue; for (let t = 2000; t < 3200; t += 1) { const c = BL.cycle(v, t, prof); if (t - c.start >= 11 && t - c.start <= 12 && t - c.start < c.dur) { best = { x: v.x, y: v.y, z: v.z, t, stripe: v.stripe, ground: gen.surfaceY(Math.floor(v.x), Math.floor(v.z) - 230), dur: c.dur }; break; } } if (best) break; }
    let ecl = 0; for (let t = 3300; t < 3900; t += 5) { const r = VR.BodySky.compute('opal', [0.5, 73.6, 0.5], t, {}); if (r.light.eclipse > 0.98) { ecl = t + 10; break; } }
    return { vent: best, eclipse: ecl, landY: gen.surfaceY(0, 0) };
  });
  console.log('  opal moments', JSON.stringify(G));
  if (G.vent) {
    await setT(A, G.vent.t); await place(A, G.vent.x, G.vent.ground + 3.6, G.vent.z - 230, Math.PI, 0.32);
    await A.settle(80, 6); await A.step(150, 33);   // (the column's foot: five seconds of grains)
    await shot(A, 'opal_geyser');
  } else check(false, 'a vent erupting in the morning');
  await setT(A, 1800); await place(A, 0.5, G.landY + 28, 60.5, 0, -0.38);
  await A.settle(60, 4); await shot(A, 'opal_lineae');
  if (G.eclipse) { await setT(A, G.eclipse); await place(A, 0.5, G.landY + 2.62, 0.5, Math.PI, 0.42); await A.settle(30, 2); await shot(A, 'opal_eclipse'); }
  else check(false, 'the eclipse found');
  await place(A, 0.5, G.landY + 1.2, 0.5, 0, 0); await A.settle(20, 2);
  rec.jumps.opal = await jumpOf(A); save();
  check(Math.abs(rec.jumps.opal.top - 27.6) <= 0.5, `a jump on Opal in the game: ${JSON.stringify(rec.jumps.opal)} (27.6 ± 0.5 m)`);
}
check(Math.abs(homeJump.top - 1.38) < 0.15, `and at home the genre's jump stays: ${JSON.stringify(homeJump)}`);
{
  const errs = A.logs.filter(l => l.startsWith('[pageerror]'));
  console.log(`--- page A logs (${A.logs.length})`); for (const l of A.logs.slice(0, 12)) console.log(l);
  check(errs.length === 0, `page A: no page error (${errs.length})`);
  check(!A.logs.some(l => /shader|compile|link/i.test(l)), 'page A: every shader compiles (BODYSKY too)');
}
await A.ctx.close();

// ================================================================ 2 · Very Low: the plaza before/after, the moon's frame
const PLAZA = [3.5, -96.5, 1.62, 0.3, 0.03];
const atPlaza = async (Pg, farMax = 200) => {
  await Pg.page.bringToFront();
  await Pg.ev(([x, z]) => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(x, 150, z); }, PLAZA);
  await Pg.settle(60, 6);
  await Pg.ev(([x, z, eye, yaw, pitch]) => { const g = VR.game, w = g.world, p = g.player, R = VR.R, F = VR.F; let y = 160; for (; y > 30; y--) { const s = w.getBlock(Math.floor(x), y, Math.floor(z)); if (s && (R.T.flags[s] & F.OPAQUE) && !(R.T.flags[s] & F.LEAVES)) break; } p.teleport(x, y + 1 + eye - 1.62, z); p.yaw = yaw; p.pitch = pitch; p.vel = [0, 0, 0]; g.env.setTime(6000); }, PLAZA);
  const st = await Pg.settle(200, farMax); await Pg.step(6);
  await Pg.ev(() => { const g = VR.game; for (const k of ['traffic', 'padLife', 'lifeDirector', 'director', 'starships', 'hall', 'trams', 'companions', 'entities', 'mirror', 'wow']) { const o = g[k]; if (o && typeof o.update === 'function') o.update = function () {}; } const V = g.villages; for (const k of ['updateAgent', 'updateBoats']) if (V && typeof V[k] === 'function') V[k] = function () {}; });
  return st;
};
// (the frames in one tight loop: a page behind another has its timers clamped to a second — run 1's rounds with a
// setTimeout between the frames took twenty minutes)
const measure = async (Pg, n) => { await Pg.page.bringToFront(); await Pg.wait(150); return Pg.ev((n) => { const g = VR.game, gl = g.renderer.gl; window.__norender = false; let sum = 0, d = 0, t = 0; for (let k = -2; k < n; k++) { const t0 = performance.now(); g.last = performance.now() - 33; g.loop(performance.now()); gl.finish(); const dt = performance.now() - t0; if (k < 0) continue; const st = g.renderer.stats || {}; sum += dt; d += st.draws || 0; t += st.tris || 0; } window.__norender = true; return { ms: +(sum / n).toFixed(2), draws: Math.round(d / n), tris: Math.round(t / n) }; }, n); };
const compare = async (pages, nRounds, n) => {
  const rounds = {};
  for (let r = 0; r < nRounds; r++) { const order = r & 1 ? pages.slice().reverse() : pages; for (const [lbl, Pg] of order) (rounds[lbl] = rounds[lbl] || []).push(await measure(Pg, n)); }
  const out = {}, [a, b] = pages.map(q => q[0]);
  for (const lbl of Object.keys(rounds)) { const ms = rounds[lbl].map(q => q.ms).sort((x, y) => x - y), mid = rounds[lbl][nRounds >> 1]; out[lbl] = { msMedian: ms[ms.length >> 1], ms, draws: mid.draws, tris: mid.tris }; }
  const pr = rounds[a].map((q, i) => q.ms / rounds[b][i].ms).sort((x, y) => x - y);
  out.pairRatio = +pr[pr.length >> 1].toFixed(3); out.ratio = +(out[a].msMedian / out[b].msMedian).toFixed(3);
  out.sameWork = out[a].draws === out[b].draws && Math.abs(out[a].tris - out[b].tris) <= 0.001 * Math.max(1, out[b].tris);
  return out;
};
console.log(`== Very Low (${secs()})`);
if (!process.env.NO_COST && left() < 900) check(false, `the costs are not measured: ${left().toFixed(0)} s left of the run`);
else if (!process.env.NO_COST) {
  const beforeOk = fs.existsSync(BEFORE.replace(/^file:\/\//, ''));
  let B1 = null, C = null, B2 = null;
  try {
    B1 = await openWorld(DIST, 'potato', 0); check(B1.ok, `page B1 (this build, Very Low) is loaded (${secs()})`);
    console.log('  B1 at the plaza', JSON.stringify(await atPlaza(B1)));
    if (beforeOk) {
      C = await openWorld(BEFORE, 'potato', 0); check(C.ok, `page C (the build before, Very Low) is loaded (${secs()})`);
      console.log('  C at the plaza', JSON.stringify(await atPlaza(C)));
      const out = await compare([['after', B1], ['before', C]], ROUNDS, N);
      rec.cost = out; save();
      console.log('  very low · plaza', JSON.stringify(out));
      check(out.pairRatio <= 1.03 && out.sameWork, `Very Low at Herzwelt's plaza unchanged: the pairs ×${out.pairRatio}, the medians ×${out.ratio} (${out.after.msMedian} against ${out.before.msMedian} ms); draws ${out.after.draws}/${out.before.draws}, triangles ${out.after.tris}/${out.before.tris}`);
      const errs = C.logs.filter(l => l.startsWith('[pageerror]')); check(errs.length === 0, `page C: no page error (${errs.length})`);
      await C.ctx.close(); C = null;
    } else console.log(`  (no build before at ${BEFORE}: the plaza is not compared)`);
    // the moon on Very Low: B2 on Basalt's landing at noon, against B1's plaza
    if (left() < 600) throw new Error(`${left().toFixed(0)} s left: the moon's Very Low frame is not measured`);
    B2 = await openWorld(DIST, 'potato', 0); check(B2.ok, `page B2 (this build, Very Low) is loaded (${secs()})`);
    await trip(B2, 'basalt'); await B2.settle(80, 6);
    const y0 = await B2.ev(() => new VR.BodyGen(VR.game.meta.seed >>> 0, 'basalt', {}).surfaceY(0, 0));
    await setT(B2, 2850); await place(B2, 0.5, y0 + 2.62, 0.5, 0, -0.06); await B2.settle(40, 4); await B2.step(60, 33);
    await shot(B2, 'basalt_noon_vl');
    const outM = await compare([['moon', B2], ['plaza', B1]], ROUNDS, N);
    rec.costMoon = outM; save();
    console.log('  very low · Basalt against the plaza', JSON.stringify(outM));
    check(outM.moon.msMedian <= outM.plaza.msMedian * 1.03, `Very Low on Basalt's landing no dearer than Herzwelt's plaza: ${outM.moon.msMedian} against ${outM.plaza.msMedian} ms (pairs ×${outM.pairRatio}; draws ${outM.moon.draws}/${outM.plaza.draws}, triangles ${outM.moon.tris}/${outM.plaza.tris})`);
    await trip(B2, 'opal'); await B2.settle(60, 4);
    const ecl = await B2.ev(() => { for (let t = 3300; t < 3900; t += 5) { const r = VR.BodySky.compute('opal', [0.5, 73.6, 0.5], t, {}); if (r.light.eclipse > 0.98) return t + 10; } return 0; });
    const yo = await B2.ev(() => new VR.BodyGen(VR.game.meta.seed >>> 0, 'opal', {}).surfaceY(0, 0));
    await setT(B2, ecl); await place(B2, 0.5, yo + 2.62, 0.5, Math.PI, 0.42); await B2.settle(30, 2);
    await shot(B2, 'opal_eclipse_vl');
    for (const [lbl, Pg] of [['B1', B1], ['B2', B2]]) { const errs = Pg.logs.filter(l => l.startsWith('[pageerror]')); console.log(`--- page ${lbl} logs (${Pg.logs.length})`); for (const l of Pg.logs.slice(0, 8)) console.log(l); check(errs.length === 0, `page ${lbl}: no page error (${errs.length})`); }
  } catch (e) { check(false, `the Very Low part ran (${String(e.message || e).slice(0, 300)})`); }
  for (const Pg of [B1, C, B2]) { try { if (Pg) await Pg.ctx.close(); } catch (e) { /* closed */ } }
  // ---------------------------------------------------------------- 3 · High: the plaza before/after
  console.log(`== High (${secs()})`);
  if (!process.env.NO_HIGH && beforeOk && left() < 800) check(false, `High before/after is not measured: ${left().toFixed(0)} s left of the run`);
  else if (!process.env.NO_HIGH && beforeOk) {
    const pagesH = [];
    try {
      const AH = await openWorld(DIST, 'high', 8, { far: 0 }); check(AH.ok, `page A2 (this build, High) is loaded (${secs()})`); pagesH.push(['after', AH]);
      console.log('  A2 at the plaza', JSON.stringify(await atPlaza(AH, 150)));
      const CH = await openWorld(BEFORE, 'high', 8, { far: 0 }); check(CH.ok, `page C2 (the build before, High) is loaded (${secs()})`); pagesH.push(['before', CH]);
      console.log('  C2 at the plaza', JSON.stringify(await atPlaza(CH, 150)));
      const outH = await compare(pagesH, +(process.env.ROUNDS_HIGH || 5), +(process.env.N_HIGH || 10));
      rec.costHigh = outH; save();
      console.log('  high · plaza', JSON.stringify(outH));
      check(outH.sameWork, `High at the plaza: the same work in both builds (draws ${outH.after.draws}/${outH.before.draws}, triangles ${outH.after.tris}/${outH.before.tris}); the frame ×${outH.pairRatio} (pairs), ×${outH.ratio} (medians ${outH.after.msMedian} against ${outH.before.msMedian} ms)`);
      for (const [lbl, Pg] of pagesH) { const errs = Pg.logs.filter(l => l.startsWith('[pageerror]')); check(errs.length === 0, `High page ${lbl}: no page error (${errs.length})`); }
    } catch (e) { check(false, `the High part ran (${String(e.message || e).slice(0, 300)})`); }
    for (const [, Pg] of pagesH) { try { await Pg.ctx.close(); } catch (e) { /* closed */ } }
  }
}
await browser.close();
console.log(`(${secs()})`);
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

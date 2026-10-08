// 🎬 The game's own trailer (t-cinema: src/main/director.js, src/shared/cine.js). One browser, passes in order:
//  BEFORE  (MODE=before|both) the six-shot director of v0.41 (BEFORE_URL: the build of HEAD). Its pictures at three
//          moments of each shot: test/shots/cinema_before_<shot>_<s>s.png
//  P1      (MODE=ride|both) the start screen's 🎬 Trailer, High: the whole ride — the title card, shots A–G, the second
//          cut and the closing card. Checks: the order of the shots, each shot's length, the time of day per shot, the HUD
//          hidden and the letterbox on, every cut made with the chunks in (no column pending at the first frame of a
//          shot), the title cards read R9-SI, and at the end the start screen is back and the temporary world is gone.
//          Pictures at the key seconds of every shot: test/shots/cinema_<shot>[_<n>].png.
//  P2      the pause menu's 🎬 Trailer in a world of your own, High: Esc gives the player back exactly where he was.
//  P3      the start screen's 🎬 Trailer on Very Low (the potato preset): the frame times of the whole ride.
// Frame times are the game's own work per frame (the loop with the rendering skipped: the headless software GL is not a
// graphics card, the pictures are taken separately). They are written to test/shots/cinema_frametimes.json; no frame may
// take more than 3× the median.
import { writeFileSync } from 'node:fs';
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const MODE = process.env.MODE || 'ride';
const BEFORE_URL = process.env.BEFORE_URL || 'file:///home/claude/vr/.tmp_old/dist/index.html';
const RIDE_URL = process.env.RIDE_URL || 'file:///home/claude/vr/dist/index.html';
const W = 1296, H = 704, DT = 0.05;
const T0 = Date.now();
const log = (s) => console.log(`${String(Math.round((Date.now() - T0) / 1000)).padStart(5)} s  ${s}`);
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 700)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
const sleep = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; log('  ✗ ' + msg); } else log('  ✓ ' + msg); };
const frametimes = {};

// the title screen, the presets and the render hook (the loop is driven by hand; pictures render on demand)
async function bootTitle(url, preset, high) {
  await page.goto(url);
  for (let i = 0; i < 120; i++) { await sleep(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
  await ev(([p, hi]) => { const g = VR.game; g.applyPreset(p); if (hi) { g.settings.dynRes = false; g.settings.renderDist = 12; g.settings.horizon = 2; g.applySettings('*'); } }, [preset, !!high]);
  await ev(() => { const g = VR.game; window.requestAnimationFrame = () => 0; const R = g.renderer; if (!R._render) { R._render = R.render; R.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; g.env.rain = 0; g.env.rainTarget = 0; });
}
// one loop call of d seconds; the rendering only when asked. Returns the time the loop took (ms)
const stepGame = (d, render) => ev(([dd, r]) => { const g = VR.game; window.__norender = !r; g.last = performance.now() - dd * 1000; const t0 = performance.now(); g.loop(performance.now()); return performance.now() - t0; }, [d, !!render]);
// the loop is driven by hand (bootTitle replaces the animation frames), so every wait steps it: the world loads, the ride starts
const waitFor = async (cond, maxMs) => { const t0 = Date.now(); while (Date.now() - t0 < maxMs) { if (await ev(cond)) return true; await stepGame(DT, false); await sleep(10); } return !!(await ev(cond)); };
// a picture: two rendered loops of 1 ms each (a picture does not move the ride), then the screenshot
const shot = async (name) => { await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 2; i++) { g.last = performance.now() - 1; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }); await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 180000 }); log('  shot ' + name); };
const state = () => ev(() => {
  const g = VR.game, d = g.director;
  if (!d || !d.active) return { active: false, state: g.state };
  const s = VR.Cine.SHOTS[d.si];
  return { active: true, state: g.state, si: d.si, id: s ? s.id : (d.si < 0 ? 'pre' : '?'), kind: s ? s.kind || 'shot' : '?', phase: d.phase, t: d.t, dur: s ? s.dur : 0, tod: g.env.timeOfDay, want: s ? s.tod : undefined, pend: g.world ? g.world.pending.size : -1, hud: document.getElementById('hud').style.visibility, cine: document.getElementById('cine').classList.contains('on'), cap: document.querySelector('#cine .cap').textContent, ships: d.myShips.length, actors: d.actors.length, rnd: g.traffic ? g.traffic.ships.filter((x) => !x.scripted && !x.dead).length : 0 };
});
// the ride, from the moment it is on until it ends: records the frame times of the run and the shots' lengths
const KEYS = { title: [1.2], A: [1.0], B: [2.0], C: [1.0, 2.0], D: [0.75, 1.5], E: [0.75, 4.75, 7.75], F: [1.75, 4.75, 6.75], G: [0.5, 3.0], A2: [1.0], D2: [1.0], F2: [2.5], F3: [2.5], G2: [1.5], end: [1.2] };
async function ride(pictures, maxSteps = 9000) {
  const rec = { ms: [], order: [], lastT: {}, firstPend: {}, todBad: [], hudBad: 0, cineBad: 0, caps: [], frames: 0, ships: {}, actors: {}, rnd: 0 };
  const done = new Set();
  let prevId = null;
  for (let i = 0; i < maxSteps; i++) {
    const st = await state();
    if (!st.active) break;
    if (st.id !== 'pre' && st.id !== prevId) { rec.order.push(st.id); prevId = st.id; log('  · ' + st.id); }
    if (st.kind === 'title' && st.cap) rec.caps.push(st.cap);
    if (st.phase === 'run') {
      rec.frames++;
      if (st.hud !== 'hidden') rec.hudBad++;
      if (!st.cine) rec.cineBad++;
      rec.lastT[st.id] = st.t;
      rec.ships[st.id] = Math.max(rec.ships[st.id] || 0, st.ships); rec.actors[st.id] = Math.max(rec.actors[st.id] || 0, st.actors); rec.rnd = Math.max(rec.rnd, st.rnd);
      if (!(st.id in rec.firstPend)) { rec.firstPend[st.id] = st.pend; if (st.want !== undefined && Math.abs(st.tod - st.want) > 2) rec.todBad.push(st.id + ' ' + st.tod + '≠' + st.want); }
    }
    // the pictures: at the key second of each shot (its run) and of each title card (the card's own clock); taken right
    // here, the ride goes on between the steps
    if (pictures && KEYS[st.id] && (st.phase === 'run' || (st.kind === 'title' && st.phase === 'card'))) for (let n = 0; n < KEYS[st.id].length; n++) { const key = st.id + ':' + n; if (!done.has(key) && st.t >= KEYS[st.id][n]) { done.add(key); await shot(`cinema_${st.id}${n ? '_' + n : ''}`); } }
    const ms = await stepGame(DT, false);
    if (st.phase === 'run') rec.ms.push(ms);
    await sleep(st.phase === 'load' || st.phase === 'card' ? 25 : 3);
  }
  return rec;
}
const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const pct = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const EXPECT = ['title', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'A2', 'D2', 'F2', 'F3', 'G2', 'end'];
const startTrailer = async () => { await ev(() => { const b = document.querySelector('#title [data-act="trailer"]'); if (b) b.click(); }); return waitFor(() => !!(VR.game.director && VR.game.director.active), 120000); };

// ---------------------------------------------------------------- BEFORE: the v0.41 director, its pictures
async function beforePass() {
  await bootTitle(BEFORE_URL, process.env.PRESET || 'high', true);
  const SEED = process.env.SEED || '4242';   // (a Node value: the browser code below cannot read process.env)
  await ev((seed) => { const g = VR.game; g.createWorld && g.createWorld({ name: 'Trailer', mode: 'creative', difficulty: 'peaceful', type: 'default', seed, cheats: true, kit: true }); }, SEED);
  await waitFor(() => VR.game.state === 'play', 90000);
  const LET = ['A', 'B', 'C', 'D', 'E', 'F'], targets = [0.8, 2.4, 3.8];
  const started = await ev(() => VR.game.director ? VR.game.director.play('trailer') : false);
  check(started, 'the director plays the trailer of v0.41');
  const done = new Set();
  for (let i = 0; i < 2400; i++) {
    await stepGame(DT, false); await sleep(4);
    const st = await ev(() => { const d = VR.game.director; return { active: d.active, si: d.si, phase: d.phase, t: +d.t.toFixed(2) }; });
    if (!st.active) break;
    if (st.phase !== 'run') continue;
    const hit = targets.findIndex((x) => Math.abs(st.t - x) < 0.03), k = st.si * 10 + hit;
    if (hit >= 0 && !done.has(k)) { done.add(k); await shot(`cinema_before_${LET[st.si] || st.si}_${targets[hit]}s`); }
  }
  check(done.size >= 12, 'pictures of the v0.41 trailer: ' + done.size);
}

// ---------------------------------------------------------------- the ride: P1, P2, P3
async function ridePasses() {
  // ---------------------------------------------------------------- P1: the start screen, High
  await bootTitle(RIDE_URL, 'high', true);
  const ok = await startTrailer();
  check(ok, 'the start screen\'s 🎬 Trailer starts the ride (a temporary world is made and the ride begins)');
  if (ok) {
    const rec = await ride(true);
    check(JSON.stringify(rec.order) === JSON.stringify(EXPECT), 'the shots run in order: ' + rec.order.join(' '));
    const want = await ev(() => VR.Cine.SHOTS.map((s) => [s.id, s.dur, (s.ships || []).length, (s.actors || []).length]));
    let lenOk = true, lens = [];
    for (const [id, dur] of want) { if (id === 'title' || id === 'end') continue; const t = rec.lastT[id]; lens.push(id + ' ' + (t === undefined ? '—' : t.toFixed(2)) + '/' + dur); if (t === undefined || Math.abs(t - dur) > 0.12) lenOk = false; }
    check(lenOk, 'every shot runs its length: ' + lens.join(', '));
    const noShip = want.filter(([id, , n]) => n > 0 && !(rec.ships[id] >= 1)).map(([id]) => id);
    check(noShip.length === 0, 'the scripted ships fly in every shot that has them' + (noShip.length ? ' — none in: ' + noShip.join(', ') : ''));
    const noHero = want.filter(([id, , , h]) => h > 0 && !(rec.actors[id] >= 1)).map(([id]) => id);
    check(noHero.length === 0, 'the heroes stand in every shot that has them' + (noHero.length ? ' — none in: ' + noHero.join(', ') : ''));
    check(rec.rnd === 0, 'no random sky traffic flies through the ride (' + rec.rnd + ' ships at most)');
    check(rec.todBad.length === 0, 'the time of day is set per shot' + (rec.todBad.length ? ' — off: ' + rec.todBad.join(', ') : ''));
    check(rec.hudBad === 0 && rec.cineBad === 0, 'the HUD is hidden and the letterbox is on in all ' + rec.frames + ' frames of the ride');
    const cut = Object.entries(rec.firstPend).filter(([id]) => id !== 'title' && id !== 'end');
    check(cut.every(([, p]) => p === 0), 'every cut waits for the chunks: no column pending at the first frame of a shot');
    check(rec.caps.length > 0 && rec.caps.every((c) => c === 'R9-SI'), 'the title cards read R9-SI (' + rec.caps.length + ' frames)');
    const m = median(rec.ms), mx = Math.max(...rec.ms);
    log(`  frame time (High, logic): median ${m.toFixed(2)} ms, p95 ${pct(rec.ms, 0.95).toFixed(2)} ms, max ${mx.toFixed(2)} ms over ${rec.ms.length} frames`);
    frametimes.P1_High = { n: rec.ms.length, median: m, p95: pct(rec.ms, 0.95), max: mx, ms: rec.ms.map((x) => +x.toFixed(3)) };
    check(mx <= 3 * m, 'no frame above 3× the median on High');
    // the end: back on the start screen, the temporary world removed
    const gone = await waitFor(async () => { const g = VR.game; if (g.state !== 'title') return false; try { const ws = await g.store.listWorlds(); return ws.filter((w) => w && w.tmp).length === 0; } catch (e) { return false; } }, 30000);
    check(gone, 'after the ride the start screen is back and the temporary trailer world is removed');
  }
  // ---------------------------------------------------------------- P2: the pause menu, Esc
  await ev(() => { const g = VR.game; g.createWorld({ name: 'Trailer P2', mode: 'creative', difficulty: 'peaceful', type: 'default', seed: '4242', cheats: true, kit: true }); });
  await waitFor(() => VR.game.state === 'play', 120000);
  for (let i = 0; i < 80; i++) { await stepGame(DT, false); await sleep(5); }
  const before = await ev(() => { const p = VR.game.player; return { pos: p.pos.slice(), yaw: p.yaw, pitch: p.pitch, tod: VR.game.env.timeOfDay }; });
  await ev(() => VR.game.ui.pause());
  await sleep(200);
  const clicked = await ev(() => { const b = document.querySelector('#pause [data-act="trailer"]'); if (!b) return false; b.click(); return true; });
  check(clicked, 'the pause menu has 🎬 Trailer');
  const on = await waitFor(() => !!VR.game.director.active, 10000);
  check(on, 'the pause menu\'s 🎬 Trailer starts the ride in this world');
  for (let i = 0; i < 60; i++) { await stepGame(DT, false); await sleep(5); }
  check(await ev(() => VR.game.director.si >= 0 && VR.game.director.t > 0.5), 'the ride from the pause menu runs (3 s in)');
  await ev(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' })));
  for (let i = 0; i < 6; i++) { await stepGame(DT, false); await sleep(10); }
  const after = await ev(() => { const g = VR.game, p = g.player; return { active: g.director.active, state: g.state, pos: p.pos.slice(), yaw: p.yaw, pitch: p.pitch, hud: document.getElementById('hud').style.visibility, tod: g.env.timeOfDay }; });
  check(!after.active && after.state === 'play', 'Esc ends the ride and the player is in the world again');
  const dpos = Math.hypot(after.pos[0] - before.pos[0], after.pos[1] - before.pos[1], after.pos[2] - before.pos[2]);
  check(dpos < 0.02 && Math.abs(after.yaw - before.yaw) < 1e-6 && Math.abs(after.pitch - before.pitch) < 1e-6, 'the player is where he was (moved ' + dpos.toFixed(3) + ' blocks)');
  check(after.hud !== 'hidden', 'the HUD is back');
  // ---------------------------------------------------------------- P3: Very Low, the frame times of the whole ride
  await bootTitle(RIDE_URL, 'potato', false);
  const ok3 = await startTrailer();
  check(ok3, 'Very Low: the ride starts from the start screen');
  if (ok3) {
    const rec3 = await ride(false);
    const m3 = median(rec3.ms), mx3 = Math.max(...rec3.ms);
    log(`  frame time (Very Low, logic): median ${m3.toFixed(2)} ms, p95 ${pct(rec3.ms, 0.95).toFixed(2)} ms, max ${mx3.toFixed(2)} ms over ${rec3.ms.length} frames`);
    frametimes.P3_VeryLow = { n: rec3.ms.length, median: m3, p95: pct(rec3.ms, 0.95), max: mx3, ms: rec3.ms.map((x) => +x.toFixed(3)) };
    check(rec3.ms.length > 500, 'the whole ride ran on Very Low (' + rec3.ms.length + ' frames)');
    check(mx3 <= 3 * m3, 'Very Low: no frame above 3× the median (max ' + mx3.toFixed(2) + ' ms, median ' + m3.toFixed(2) + ' ms)');
    check(JSON.stringify(rec3.order) === JSON.stringify(EXPECT), 'Very Low: the shots run in order');
  }
}

if (MODE === 'before' || MODE === 'both') { try { await beforePass(); } catch (e) { check(false, 'the BEFORE pass stopped: ' + e.message); } }
if (MODE === 'ride' || MODE === 'both') { try { await ridePasses(); } catch (e) { check(false, 'the ride passes stopped: ' + e.message); } }
if (Object.keys(frametimes).length) writeFileSync('/home/claude/vr/test/shots/cinema_frametimes.json', JSON.stringify(frametimes));
log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 12)) log(l);
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
await browser.close();

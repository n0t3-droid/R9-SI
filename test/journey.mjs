// o-seamless in the browser (docs/superpowers/plans/2026-11-01-o-seamless.md): a new Kreativ world (seed 4242), 960 × 540,
// de-DE, High, in real time. 0 · Very Low keeps the film; the costs. 1 · die Himmelsleiter: to the Bergstation, stand in
// the cabin → the ride up to the Ringstation. 2 · a Lichtbrücke from the station to Aquamarin, walked (W). 3 · home, a
// caravan from the nearest place to the next (with a reload mid-ride). A picture every 5 s of each journey's own clock;
// the arrival alive (a moment ≤ 20 s). → test/shots/jy_*.jpg, test/shots/seamless_sheet.jpg, .tmp_tests/journey_run.json
//   nohup bash test/wt_run.sh journey.mjs 3600 > .tmp_tests/journey.log 2>&1 &   (ONLY=cost,lift,bridge,ride)
// regress: skip  (a showcase with pictures; the gate is test/journey.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import { execFileSync } from 'child_process';
const ROOT = new URL('../', import.meta.url).pathname.replace(/\/$/, '').replace(/\/\.tmp_tests$/, '');
const DIST = process.env.DIST || 'file://' + ROOT + '/dist/index.html';
const SHOTS = ROOT + '/test/shots/';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null, want = (s) => !ONLY || ONLY.includes(s);
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + ' (' + secs() + ')'); };
const run = {};
const saveRun = () => { try { fs.writeFileSync(ROOT + '/.tmp_tests/journey_run.json', JSON.stringify(run, null, 1)); } catch (e) { /* a convenience */ } };
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 800, height: 450 }, locale: 'de-DE' });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /journey/i.test(s)) logs.push(`[${t}] ${s.slice(0, 400)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1200)));
const wait = (ms) => page.waitForTimeout(ms);
let where = 'boot';
const ev = (fn, a) => Promise.race([page.evaluate(fn, a), new Promise((_, rej) => setTimeout(() => rej(new Error('evaluate timeout at ' + where)), 120000))]);
setInterval(() => console.log('    … ' + secs() + ' at ' + where), 60000).unref();
const shot = async (name) => { await ev(() => VR.Journey.pause(true)); await wait(150); try { await page.screenshot({ path: SHOTS + name, type: 'jpeg', quality: 82, timeout: 240000 }); console.log('  📷 ' + name); } catch (e) { console.log('  (no picture ' + name + ': ' + e.message.slice(0, 80) + ')'); } await ev(() => VR.Journey.pause(false)); return SHOTS + name; };
const stats = () => ev(() => Object.assign(VR.Journey.stats(), { dim: VR.game.dim, state: VR.game.state, pj: !!VR.Portal.J() }));
const sheet = [];
const writeSheet = () => { if (!sheet.length) return; const spec = ROOT + '/.tmp_tests/seamless_sheet.json'; fs.writeFileSync(spec, JSON.stringify({ w: 620, rows: sheet })); try { console.log('  ' + execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + 'seamless_sheet.jpg', spec]).toString().trim()); } catch (e) { console.log('  (no sheet: ' + e.message.slice(0, 100) + ')'); } };
const strip = (label, imgs) => { for (let i = 0; i < imgs.length; i += 6) sheet.push({ label: label + (imgs.length > 6 ? ' ' + (i / 6 + 1) : ''), imgs: imgs.slice(i, i + 6) }); };
// a journey's picture strip: every 5 s of its own clock, until it ends (or maxS of the wall clock)
async function follow(tag, maxS, each) {
  const imgs = [], t0 = Date.now(); let next = 0, last = null, lines = 0;
  while ((Date.now() - t0) / 1000 < maxS) {
    await wait(300);
    where = tag + ' follow'; const s = await stats(); lines = Math.max(lines, s.lines || 0);
    if (!s.kind && !s.pj) { last = s; break; }
    if (each) await each(s);
    if (s.kind && s.t >= next) { if (each) await each(s, true); imgs.push(await shot(`jy_${tag}_${String(Math.round(next)).padStart(3, '0')}.jpg`)); console.log(`    ${tag} t ${s.t} s · ${s.ph} · alt ${s.alt} · s ${s.s} · k ${s.k} · gl ${s.shots} · ${s.dim}${s.portal ? ' · pt ' + JSON.stringify(s.portal) : ''}`); next += 5; }
    last = s;
  }
  return { imgs, last, lines, wall: (Date.now() - t0) / 1000 };
}
async function alive(tag) {
  for (let i = 0; i < 50; i++) { await wait(500); const s = await stats(); if (s.alive && s.alive.at !== null) return s.alive; }
  return (await stats()).alive;
}

await page.goto(DIST);
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.applyPreset('high'); g.settings.dynRes = false; g.settings.renderDist = 5; g.applySettings('*'); });
await ev(() => VR.game.createWorld({ name: 'Unterwegs', mode: 'creative', difficulty: 'peaceful', type: 'default', seed: '4242', cheats: true, kit: true }));
for (let i = 0; i < 240; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
check(await ev(() => VR.game.state) === 'play', 'a new world');
await ev(() => { const g = VR.game; if (g.ui.screen) g.ui.resume(); g.zenFreezeTime = true; g.zenFreezeWeather = true; if (g.env.wx && g.env.wx.force) g.env.wx.force('klar'); g.env.setTime(2600); if (g.settings) g.settings.wow = false; VR.Journey.forceGL = true; });
await wait(8000);
check(await ev(() => !!VR.Journey && !!VR.JourneyCore && typeof VR.Portal.route === 'function'), 'VR.Journey routes the Leuchtpfad');

if (want('cost')) {
  console.log('0 · Very Low keeps the film; the costs');
  const r = await ev(() => {
    const g = VR.game, out = {};
    for (const preset of ['potato', 'high']) for (const on of [false, true]) {
      g.applyPreset(preset); g.settings.dynRes = false; g.settings.journeys = on; g.applySettings('*');
      const gl = g.renderer.gl, times = [];
      for (let i = 0; i < 14; i++) { const a = performance.now(); g.last = a - 33; g.loop(a); gl.finish(); if (i >= 4) times.push(performance.now() - a); }
      times.sort((x, y) => x - y);
      out[preset + (on ? '_on' : '_off')] = { frame: +times[Math.floor(times.length / 2)].toFixed(1), idle: on ? +VR.Journey.cost(g, 300).toFixed(4) : 0 };
    }
    g.applyPreset('potato'); g.settings.journeys = true; g.applySettings('*');
    out.potatoRoute = VR.Portal.route(g, { dim: 'aqua', id: 'w:aqua' });
    g.applyPreset('high'); g.settings.dynRes = false; g.settings.renderDist = 5; g.settings.journeys = false; g.applySettings('*');
    out.offRoute = VR.Portal.route(g, { dim: 'aqua', id: 'w:aqua' });
    g.settings.journeys = true; g.applySettings('*');
    return out;
  });
  run.cost = r;
  console.log('  ' + JSON.stringify(r));
  check(r.potatoRoute === null && r.offRoute === null, 'Very Low and the switch off: the Leuchtpfad\'s film as before (no journey)');
  check(r.potato_on.idle < 0.05 && r.high_on.idle < 0.05, 'the idle look: Very Low ' + r.potato_on.idle + ' ms, High ' + r.high_on.idle + ' ms');
  saveRun();
}

if (want('lift')) {
  console.log('1 · die Himmelsleiter');
  await ev(() => { const p = VR.game.player; p.flying = true; p.safeTeleport(-283.5, 120, -126.5); });
  let base = null;
  where = 'lift: the base';
  for (let i = 0; i < 90 && !base; i++) { await wait(1000); if (i % 10 === 0) console.log('    base? ' + i + ' ' + JSON.stringify(await ev(() => ({ p: VR.game.player.pos.map(Math.round), hold: !!VR.game.player.hold, scr: VR.game.ui.screen, st: VR.game.state, pend: VR.game.world.pending.size, D: !!VR.game.wanderer })))); base = await ev(() => { const b = VR.Journey.M.base; return b && b.y !== null ? { x: b.x, y: b.y, z: b.z } : null; }); }
  check(!!base, 'the cabin stands at the Bergstation ' + JSON.stringify(base));
  const lift = [];
  if (!base) { await ev(() => { const p = VR.game.player; p.flying = false; p.safeTeleport(0.5, 90, 0.5); }); await wait(8000); }
  if (true) {
    if (base) await ev((b) => { const p = VR.game.player; p.pos = [b.x + 7, b.y + 2, b.z + 9]; p.yaw = Math.atan2(7, 9); p.pitch = 0.18; p.flying = true; }, base);
    if (base) { await wait(5000); lift.push(await shot('jy_lift_base.jpg')); where = 'lift: stand in the cabin';
      await ev((b) => { const p = VR.game.player; p.flying = false; p.pos = [b.x, b.y + 0.2, b.z]; p.vel = [0, 0, 0]; p.yaw = 0.6; p.pitch = -0.12; }, base); }
    let started = false; for (let i = 0; i < 30 && !started && base; i++) { await wait(500); started = (await stats()).kind === 'lift'; }
    check(started, 'standing in the cabin starts the Himmelsleiter');
    if (!started) await ev(() => VR.Journey.lift(VR.game));
    const t0 = Date.now();
    const F = await follow('lift', 1800, async (s, pic) => { if (pic && s.ph !== 'space') await ev((k) => { const p = VR.game.player; p.yaw = 0.6 + k * 0.8; p.pitch = -0.12 - k * 0.35; }, Math.min(1, s.t / 24)); });
    lift.push(...F.imgs);
    run.lift = { wall: F.wall, n: F.imgs.length, last: F.last };
    const L = await ev(() => VR.Journey.M.log.map(e => e.what));
    run.lift.log = L;
    check(F.last && F.last.dim === 'stn.ring' && F.last.state === 'play', 'up the tether to the Ringstation (' + (F.last && F.last.dim) + ', ' + F.wall.toFixed(0) + ' s wall)');
    check(L.includes('handoff') && L.some(x => /lift depart|handoff/.test(x)) && L.some(x => /end lift arrived/.test(x)), 'the hand-off, the world switch under it, the arrival: ' + L.filter(x => /lift|handoff|end/.test(x)).slice(-6).join(' · '));
    check(F.imgs.length >= 9, F.imgs.length + ' pictures, one every 5 s of the 52-s ride');
    const A = await alive('lift'); run.lift.alive = A;
    console.log('  the station: ' + JSON.stringify(A));
    await wait(3000); lift.push(await shot('jy_lift_arrive.jpg'));
    strip('Himmelsleiter (alle 5 s)', lift.filter(Boolean));
    void t0;
  }
  saveRun(); writeSheet();
}

if (want('bridge')) {
  console.log('2 · eine Lichtbrücke nach Aquamarin');
  const r = await ev(() => VR.Portal.go(VR.game, { dim: 'aqua', id: 'w:aqua' }));
  check(!!r && (await stats()).kind === 'bridge', 'the gate trip is a Lichtbrücke');
  await page.keyboard.down('w');
  const F = await follow('bridge', 1500);
  await page.keyboard.up('w');
  run.bridge = { wall: F.wall, n: F.imgs.length, last: F.last, portal: await ev(() => VR.Portal.last) };
  const L = await ev(() => VR.Journey.M.log.map(e => e.what));
  const walkT = run.bridge.portal ? run.bridge.portal.ms : null;
  check(F.last && F.last.dim === 'aqua', 'arrived on foot on Aquamarin (' + (F.last && F.last.dim) + ')');
  check(L.some(x => /end bridge arrived/.test(x)), 'the bridge ends as an arrival');
  check(F.imgs.length >= 4, F.imgs.length + ' pictures along the path');
  const A = await alive('bridge'); run.bridge.alive = A;
  check(A && A.at !== null && A.at >= 0 && A.at <= 20, 'Aquamarin is alive: a moment ' + (A && A.at) + ' s after the arrival (' + (A && A.kind) + ')');
  const arr = await shot('jy_bridge_arrive.jpg');
  strip('Lichtbrücke → Aquamarin (alle 5 s)', F.imgs.concat([arr]).filter(Boolean));
  void walkT;
  saveRun(); writeSheet();
}

if (want('ride')) {
  console.log('3 · eine Karawane auf Herzwelt');
  if (await ev(() => VR.game.dim) !== 'overworld') {
    await ev(() => VR.Travel.go(VR.game, { dim: 'overworld', via: 'cmd' }));
    for (let i = 0; i < 240; i++) { await wait(1000); const s = await ev(() => ({ d: VR.game.dim, st: VR.game.state, b: VR.Travel.busy(VR.game) })); if (s.d === 'overworld' && s.st === 'play' && !s.b) break; }
  }
  await ev(() => { const p = VR.game.player; p.flying = true; p.safeTeleport(-112, 100, -90); });   // (the city: a place with a cart)
  let carts = [];
  for (let i = 0; i < 90 && !carts.length; i++) { await wait(1000); carts = await ev(() => VR.Journey.carts()); }
  check(carts.length > 0, carts.length + ' caravan cart(s) near: ' + carts.map(c => c.name).join(', '));
  const ride = [];
  if (carts.length) {
    const c = carts[0];
    await ev((c) => { const p = VR.game.player; p.flying = false; p.pos = [c.x + 2.6, c.y + 0.2, c.z + 1.2]; p.vel = [0, 0, 0]; p.yaw = Math.atan2(2.6, 1.2); p.pitch = -0.1; }, c);
    await wait(4000);
    ride.push(await shot('jy_ride_cart.jpg'));
    await ev((c) => { const p = VR.game.player; p.pos = [c.x + 1.2, c.y + 0.2, c.z + 0.6]; }, c);
    let off = null; for (let i = 0; i < 20 && !off; i++) { await wait(500); off = (await stats()).offer; }
    check(!!off, 'by the cart: the offer ([V] aufsitzen)');
    await page.keyboard.press('v');
    await wait(800);
    check((await stats()).kind === 'ride', '[V]: on the cart');
    let reloaded = null;
    const F = await follow('ride', 2400, async (s, pic) => {
      if (pic) await ev(() => { const J = VR.Journey.M.J; if (J && J.at) { const p = VR.game.player; p.yaw = J.at.yaw + 0.35; p.pitch = -0.07; } });
      if (!reloaded && s.kind === 'ride' && s.t > 25) { const s0 = s.s; const ok = await ev(() => VR.Journey.reload(VR.game)); const s1 = (await stats()).s; reloaded = { ok, s0, s1 }; console.log('    reload mid-ride: ' + JSON.stringify(reloaded)); }
    });
    run.ride = { wall: F.wall, n: F.imgs.length, last: F.last, reloaded, lines: F.lines };
    const L = await ev(() => VR.Journey.M.log.map(e => e.what));
    run.ride.log = L.filter(x => /ride|alive|resume/.test(x));
    check(reloaded && reloaded.ok && Math.abs(reloaded.s1 - reloaded.s0) < 3, 'a reload mid-ride: back on the cart where it was (' + (reloaded && reloaded.s0) + ' → ' + (reloaded && reloaded.s1) + ' m)');
    check(L.some(x => /end ride arrived/.test(x)), 'the caravan reached the next place');
    check(L.filter(x => /ride line:/.test(x)).length >= 2 && L.some(x => /ride moment/.test(x)), 'the driver\'s lines and a moment on the way: ' + L.filter(x => /line:|moment/.test(x)).join(' · '));
    ride.push(...F.imgs);
    const A = await alive('ride'); run.ride.alive = A;
    check(A && A.at !== null && A.at >= 0 && A.at <= 20, 'the place is alive: a moment ' + (A && A.at) + ' s after the arrival (' + (A && A.kind) + ')');
    ride.push(await shot('jy_ride_arrive.jpg'));
    strip('Karawane (alle 5 s)', ride.filter(Boolean));
  }
  saveRun(); writeSheet();
}

const bad = logs.filter(l => /journey|pageerror/i.test(l));
check(bad.length === 0, 'no journey errors' + (bad.length ? ': ' + bad.slice(0, 3).join(' | ') : ''));
if (logs.length) console.log('  logs: ' + logs.slice(0, 6).join('\n  '));
saveRun();
await browser.close();
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);

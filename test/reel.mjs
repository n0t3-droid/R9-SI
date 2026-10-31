// regress: skip — 🎬 the highlight reel, played (e-cam; plan docs/superpowers/plans/2026-10-31-e-cam.md). One browser run (≤ 3 in all).
// A new default world (the Heartland, seed 4242), Creative · Friedlich, Balanced at 960 × 540, de-DE. A scripted session of ~10 minutes of play:
// the Gate Temple in the morning (an arrival, a wow moment's vista), a little tower built by the plaza (a build finished), the Spire Citadel
// (stand-in: an outpost freed there), the Sky Isles (stand-in: the boss), the golden hour, a real star jump (StarJump.enter / jump: its
// postcard) and a real landing on Basalt (Travel.go: its hello, its postcard) and home again; the emitters are the game's own (EventLog.emit).
// Then F9 → the reel: a picture at the middle of every shot (page screenshots: the letterbox and the captions are the page's), B during it
// (frames at 2×), the restoration checked; a second reel with V (a WebM recorded) ended by Esc; a third on Very Low (0.45 of the pixels).
// → test/shots/reel_NN.png, reel_sheet.jpg (8 frames of one reel), reel_numbers.json
//   nohup bash test/wt_run.sh reel.mjs 3600 > .tmp_tests/reel.log 2>&1 &
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import fs from 'fs';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SHOTS = ROOT + 'test/shots/';
fs.mkdirSync(SHOTS, { recursive: true });
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, locale: 'de-DE' });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail|reel/i.test(s)) { logs.push(`[${t}] ${s.slice(0, 400)}`); if (/reel/i.test(s)) console.log('  ! page: ' + s.slice(0, 300)); } });
page.on('pageerror', (e) => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1200)));
const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
const NUM = { at: new Date().toISOString() };
await page.goto(new URL('../dist/index.html', import.meta.url).href);
for (let i = 0; i < 240; i++) { await wait(500); if (await ev(() => !!(window.VR && VR.game && VR.game.state === 'title')).catch(() => false)) break; }
await ev(() => {
  const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 8; g.settings.wowMoments = false; g.applySettings('*');
  // the frames: simulated at 1/30 s, drawn only when asked (window.__draw)
  window.__step = (n, draw) => { const g = VR.game; for (let i = 0; i < n; i++) { window.__nodraw = !(draw && i >= n - 1); g.last = performance.now() - 1000 / 30; g.loop(performance.now()); } window.__nodraw = true; };
  const r = g.renderer, r0 = r.render; r.render = function (F) { if (window.__nodraw) { this.setupCamera(F.cam); return; } return r0.call(this, F); };
  window.__nodraw = true;
});
await ev(() => VR.game.createWorld({ name: 'Herzland', mode: 'creative', difficulty: 'peaceful', type: 'default', seed: '4242', cheats: true, kit: true }));
for (let i = 0; i < 120; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { window.requestAnimationFrame = () => 0; VR.game.zenFreezeWeather = true; VR.game.env.rain = 0; VR.game.env.rainTarget = 0; });   // (the clock is ours: no animation frames — every g.loop would queue one more)
const step = (n, draw) => ev(([n, d]) => window.__step(n, d), [n, !!draw]);
for (let i = 0; i < 20; i++) { await step(10); await wait(300); }
check(await ev(() => VR.game.state === 'play' && !!VR.Reel && !!VR.DirCam.Track), 'in play, VR.Reel loaded');

// ---- the session's helpers (in the page): the ground, a walk, the events through the game's own log
await ev(() => {
  const g = VR.game;
  window.__gy = (x, z) => { const w = g.world, col = w.col(Math.floor(x) >> 4, Math.floor(z) >> 4); return col && col.ready ? col.height[((Math.floor(z) & 15) << 4) | (Math.floor(x) & 15)] + 1 : null; };
  window.__look = (x, y, z) => { const p = g.player, e = [p.pos[0], p.pos[1] + p.eye, p.pos[2]]; p.yaw = Math.atan2(-(x - e[0]), -(z - e[2])); p.pitch = Math.atan2(y - e[1], Math.hypot(x - e[0], z - e[2])); p.viewYaw = p.yaw; };
});
// walk to (x, z) at 5 m/s along the ground, the chunks ahead waited for; look at (lx, ly, lz) on the way's end
const walkTo = async (x, z, look) => {
  for (let k = 0; k < 400; k++) {
    const r = await ev(([x, z]) => {
      const g = VR.game, p = g.player; p.flying = true; p.vel = [0, 0, 0];
      const dx = x - p.pos[0], dz = z - p.pos[2], d = Math.hypot(dx, dz); if (d < 1) return { done: true };
      const ahead = [p.pos[0] + dx / d * Math.min(d, 24), p.pos[2] + dz / d * Math.min(d, 24)];
      if (window.__gy(ahead[0], ahead[1]) === null) { window.__step(3); return { wait: true }; }
      for (let i = 0; i < 15 && Math.hypot(x - p.pos[0], z - p.pos[2]) > 0.3; i++) {
        const ex = x - p.pos[0], ez = z - p.pos[2], e = Math.hypot(ex, ez), s = Math.min(e, 5 / 30), nx = p.pos[0] + ex / e * s, nz = p.pos[2] + ez / e * s, gy = window.__gy(nx, nz);
        p.pos = [nx, gy !== null ? gy : p.pos[1], nz]; p.yaw = Math.atan2(-ex, -ez); p.viewYaw = p.yaw; p.pitch = -0.05;
        window.__step(1);
      }
      return { d };
    }, [x, z]);
    if (r.done) break;
    if (r.wait) await wait(120);
  }
  if (look) await ev(([a, b, c]) => window.__look(a, b, c), look);
};
// a jump straight there (the session's long ways: the world must not stream 800 m in the dark), then the last 40 m on foot
const goTo = async (x, z, look) => {
  await ev(([x, z]) => { const p = VR.game.player; p.flying = true; p.pos = [x, 140, z]; p.vel = [0, 0, 0]; }, [x - 40, z - 10]);
  for (let i = 0; i < 80; i++) { const gy = await ev(([x, z]) => window.__gy(x, z), [x - 40, z - 10]); if (gy !== null) { await ev(([x, z, y]) => { VR.game.player.pos = [x, y, z]; }, [x - 40, z - 10, gy]); break; } await step(3); await wait(200); }
  await walkTo(x, z, look);
};
const stay = async (s) => { for (let i = 0; i < Math.round(s * 30); i += 30) { await step(30); await wait(20); } };
const tod = (t) => ev((t) => VR.game.env.setTime(t), t);
const emit = (a) => ev((a) => { const r = VR.EventLog.emit(a[0], a[1], a[2], a[3], a[4], a[5]); return r ? { w: r.w, inView: r.inView } : null; }, a);

console.log('— the session (' + secs() + ')');
const sp = await ev(() => VR.game.player.pos.map((v) => +v.toFixed(1)));
console.log('  spawn ' + sp.join(', '));
// 1 · the Gate Temple in the morning: an arrival, then a vista's moment
await tod(2600);
await goTo(20, -90, [0, 120, -15]);
console.log('  arrive', JSON.stringify(await emit(['travel', 'arrive', 3, [0, 120, -15], 'intent', 40])));
await stay(50);
await ev(() => window.__look(0, 130, -15));
console.log('  wow', JSON.stringify(await emit(['wow', 'temple', 3, null, 'wow'])));
await stay(60);
// 2 · a little tower by the way: built block by block, then the build stands
await tod(4200);
const B = await ev(() => {
  const g = VR.game, p = g.player, R = VR.R, sb = R.byName.stone_bricks.defaultState, ln = (R.byName.lantern || R.byName.glowstone).defaultState;
  const x0 = Math.floor(p.pos[0]) + 8, z0 = Math.floor(p.pos[2]) - 6, y0 = window.__gy(x0, z0) || Math.floor(p.pos[1]);
  return { x0, z0, y0, sb, ln };
});
for (let y = 0; y < 9; y++) {
  await ev(([b, y]) => { const w = VR.game.world; for (let dx = 0; dx < 4; dx++) for (let dz = 0; dz < 4; dz++) if (y < 8 ? (dx === 0 || dx === 3 || dz === 0 || dz === 3) : (dx === 1 || dx === 2) && (dz === 1 || dz === 2)) w.setBlock(b.x0 + dx, b.y0 + y, b.z0 + dz, y < 8 ? b.sb : b.ln); }, [B, y]);
  await step(15);
}
await ev((b) => window.__look(b.x0 + 2, b.y0 + 5, b.z0 + 2), B);
console.log('  build', JSON.stringify(await emit(['build', 'site_done', 3, [B.x0 + 2, B.y0 + 4.5, B.z0 + 2], 'site', 6])));
await stay(60);
// 3 · the Spire Citadel at noon: an outpost freed there (the freeing's own emit is liberate.js's — here its stand-in)
await tod(6400);
await goTo(-360, 330, [-420, 200, 380]);
console.log('  freed', JSON.stringify(await emit(['milestone', 'freed', 5, [-420, 190, 380], 'liberate', 40])));
await stay(80);
// 4 · the Sky Isles in the afternoon: the boss (stand-in: rpg_boss.js's emit)
await tod(8600);
await goTo(270, 90, [330, 160, 140]);
console.log('  boss', JSON.stringify(await emit(['milestone', 'boss', 5, [330, 165, 140], 'rpg', 60])));
await stay(80);
// 5 · the golden hour on the open land west of the isles: 14 s with the low sun
await tod(11850);
await ev(() => { const g = VR.game, p = g.player, az = VR.DirCam.sunAz(11850); window.__look(p.pos[0] + Math.cos(az) * 100, p.pos[1] + 4, p.pos[2] + Math.sin(az) * 100); g.zenFreezeTime = true; });
await stay(16);
await ev(() => { VR.game.zenFreezeTime = false; });
const lowSun = await ev(() => ({ n: VR.EventLog.samples().filter((s) => s.sky === 'low_sun').length, hl: VR.Reel.hl.filter((h) => h.sub === 'sunset' || h.sub === 'sunrise').length }));
console.log('  golden hour: ' + JSON.stringify(lowSun) + ' (samples of a low sun, highlights)');
// 6 · a star jump (the real one): into a system, a jump on, its arrival's postcard
let jumped = null;
try {
  jumped = await ev(() => { const g = VR.game, SJ = VR.StarJump; if (!SJ) return 'no StarJump'; SJ.enter(g, 1, { quiet: true }); return SJ.jump(g, 2, { force: true }) ? 'ok' : 'no jump'; });
  for (let i = 0; i < 40 && jumped === 'ok'; i++) { const j = await ev(() => !!(VR.game.stars && VR.game.stars.J)); if (!j) break; await step(15); }
  await step(2, true); await step(1, true);
  await stay(6);
  await ev(() => { if (VR.StarJump && VR.game.stars && VR.game.stars.on) VR.StarJump.leave(VR.game); });
} catch (e) { jumped = 'error ' + e.message; }
console.log('  star jump: ' + jumped + ', postcards ' + (await ev(() => VR.Reel.cards)));
// 7 · the landing on Basalt (the real trip) and home again
let moon = null;
try {
  moon = await ev(() => { const g = VR.game; if (!VR.Travel || !VR.Travel.go) return 'no Travel'; window.__trip = 'going'; Promise.resolve(VR.Travel.go(g, { dim: 'basalt', via: 'cmd' })).then(() => { window.__trip = 'done'; }, (e) => { window.__trip = 'error ' + e; }); return 'go'; });
  for (let i = 0; i < 240; i++) { await step(5); await wait(250); const r = await ev(() => ({ dim: VR.game.dim, st: VR.game.state, trip: window.__trip, hello: VR.Reel.hl.some((h) => h.sub === 'moon_land') })); if (r.hello) break; if (i % 20 === 0) console.log('    trip ' + JSON.stringify(r)); }
  moon += ' · ' + (await ev(() => VR.game.dim));
  await step(1, true); await step(1, true);
  await stay(8);
  await ev(() => { const g = VR.game; window.__trip = 'home'; Promise.resolve(VR.Travel.goHome(g)).then(() => { window.__trip = 'done'; }, (e) => { window.__trip = 'error ' + e; }); });
  for (let i = 0; i < 240; i++) { await step(5); await wait(250); const r = await ev(() => ({ dim: VR.game.dim, st: VR.game.state, trip: window.__trip })); if (r.dim === 'overworld' && r.st === 'play' && r.trip === 'done') break; }
  for (let i = 0; i < 20; i++) { await step(10); await wait(200); }
  const home = await ev(() => VR.game.dim);
  moon += ' → ' + home;
} catch (e) { moon = 'error ' + e.message; }
console.log('  moon: ' + moon + ', postcards ' + (await ev(() => VR.Reel.cards)));
await tod(9000);
await stay(30);
const sess = await ev(() => { const g = VR.game, R = VR.Reel; return { time: +g.time.toFixed(0), hl: R.hl.map((h) => `${h.sub}@${h.t.toFixed(0)}${h.card ? '🖼' : ''}${h.dim !== 'overworld' ? '(' + h.dim + ')' : ''}`), track: R.track.n, bytes: R.track.bytes, meta: (g.meta.highlights || []).length, rec: R.stats }; });
console.log('  session: ' + JSON.stringify(sess));
NUM.session = sess;
check(sess.bytes <= 200 * 1024, `the track ${Math.round(sess.bytes / 1024)} KB (≤ 200 KB for 20 minutes)`);
check(sess.hl.length >= 6, `${sess.hl.length} highlights logged`);
check(sess.meta >= 6, `meta.highlights keeps them (${sess.meta})`);
const trackMs = sess.rec.calls ? sess.rec.recMs / sess.rec.calls : 0;
console.log(`  the track's cost: ${(trackMs * 1000).toFixed(2)} µs a frame; postcards ${sess.rec.cards} at ${(sess.rec.cardMs / Math.max(1, sess.rec.cards)).toFixed(2)} ms each`);
NUM.trackUs = +(trackMs * 1000).toFixed(3);

// ---- the reel
console.log('— the reel (' + secs() + ')');
await ev(() => window.__look(VR.game.player.pos[0] + 10, VR.game.player.pos[1] + 1, VR.game.player.pos[2]));
const before = await ev(() => { const g = VR.game, p = g.player; return { tod: Math.round(g.env.timeOfDay), pos: p.pos.map((v) => +v.toFixed(2)), camMode: g.camMode, freeze: !!g.zenFreezeTime, pad: g.padLife ? +g.padLife.clock.toFixed(3) : null, tram: g.trams ? +g.trams.clock.toFixed(3) : null, scale: g.renderer.q.scale, hud: document.getElementById('hud').style.visibility }; });
const startW = Date.now();
const st = await ev(() => { const g = VR.game; g.input.pressed.add('F9'); window.__step(1); return { run: !!VR.Reel.run, ms: VR.Reel.stats.startMs, plan: VR.Reel.run ? VR.Reel.run.plan.shots.map((s) => `${s.frame}:${s.dur}${s.h ? ':' + s.h.sub : ''}`) : null, dur: VR.Reel.run ? VR.Reel.run.plan.dur : 0 }; });
console.log('  plan: ' + JSON.stringify(st));
check(st.run, 'F9 starts the reel');
check(st.ms <= 1000, `the reel built in ${st.ms.toFixed(1)} ms (≤ 1 s)`);
check(st.dur >= 30 && st.dur <= 90, `the reel ${st.dur} s (30–90)`);
let firstRun = null; const pics = [], shotsSeen = new Set(); let pressedB = false, simT = 0;
for (let k = 0; k < 6000; k++) {
  const s = await ev(() => { const d = VR.game.director, run = VR.Reel.run; if (!run || !d.active) return null; const sh = d.shots[d.si]; return { si: d.si, phase: d.phase, t: d.t, dur: sh ? sh.dur : 0, frame: sh && sh.reel ? sh.reel.frame : '', sub: sh && sh.reel && sh.reel.h ? sh.reel.h.sub : '', cap: d.dom.querySelector('.cap').textContent, fade: d.dom.querySelector('.fade').style.opacity }; });
  if (!s) break;
  if (s.phase === 'run' && firstRun === null) { firstRun = { simT, wall: Date.now() - startW }; }
  if (s.phase === 'load' || s.phase === 'next') { await step(1); simT += 1 / 30; await wait(100); continue; }
  if (s.si === 2 && !pressedB) { pressedB = true; await ev(() => VR.game.input.pressed.add('KeyB')); }
  if (!shotsSeen.has(s.si) && s.t >= s.dur * 0.5) {
    shotsSeen.add(s.si);
    await step(1, true); await step(1, true);
    const name = `reel_${String(s.si).padStart(2, '0')}`;
    await page.screenshot({ path: SHOTS + name + '.png', timeout: 120000 });
    const info = await ev(() => { const g = VR.game, run = VR.Reel.run, c = run && run.cam; return { cam: c ? [c.x, c.y, c.z].map((v) => +v.toFixed(1)) : null, tod: Math.round(g.env.timeOfDay), camMode: g.camMode, avatar: g.player.pos.map((v) => +v.toFixed(1)), scale: g.renderer.q.scale }; });
    pics.push({ si: s.si, frame: s.frame, sub: s.sub, cap: s.cap, file: SHOTS + name + '.png', ...info });
    console.log(`  shot ${s.si} ${s.frame} ${s.sub} — „${s.cap}" ${JSON.stringify(info)} (${secs()})`);
    continue;
  }
  const n = Math.max(1, Math.min(15, Math.round((s.t < s.dur * 0.5 && !shotsSeen.has(s.si) ? s.dur * 0.5 - s.t : s.dur - s.t) * 30) + 1));
  await step(n); simT += n / 30;
}
NUM.firstRun = firstRun; NUM.pics = pics;
console.log('  the first shot runs after ' + JSON.stringify(firstRun));
check(firstRun && firstRun.simT <= 1.0, `the reel runs ${firstRun ? firstRun.simT.toFixed(2) : '?'} s of play after F9 (≤ 1 s; ${firstRun ? (firstRun.wall / 1000).toFixed(1) : '?'} s on this SwiftShader machine)`);
check(pics.length >= 8, `${pics.length} shots pictured`);
check(pics.filter((p) => p.camMode === 1).length >= 3, `the avatar in ${pics.filter((p) => p.camMode === 1).length} shots (its track replayed)`);
check(new Set(pics.map((p) => p.tod)).size >= 4, `the shots at ${new Set(pics.map((p) => p.tod)).size} different times of day`);
check(pics.every((p) => p.cap && p.cap.length > 2), 'every shot captioned');
check(pics.some((p) => p.frame === 'card' || p.frame === 'cardpan'), 'a postcard from another world in the reel');
await step(3, true);
const after = await ev(() => { const g = VR.game, p = g.player; return { run: !!VR.Reel.run, active: g.director.active, tod: Math.round(g.env.timeOfDay), pos: p.pos.map((v) => +v.toFixed(2)), camMode: g.camMode, freeze: !!g.zenFreezeTime, pad: g.padLife ? +g.padLife.clock.toFixed(3) : null, tram: g.trams ? +g.trams.clock.toFixed(3) : null, scale: g.renderer.q.scale, hud: document.getElementById('hud').style.visibility, saved: VR.Reel.stats.saved, photo: VR.PhotoMode.last ? { w: VR.PhotoMode.last.w, h: VR.PhotoMode.last.h, bytes: VR.PhotoMode.last.bytes } : null, W: g.renderer.W, H: g.renderer.H }; });
console.log('  before ' + JSON.stringify(before)); console.log('  after  ' + JSON.stringify(after));
NUM.restore = { before, after };
check(!after.run && !after.active, 'the reel ended by itself');
check(Math.abs(after.tod - before.tod) <= 5 && after.freeze === before.freeze, `the time of day given back (${before.tod} → ${after.tod})`);
check(after.pos.join() === before.pos.join() && after.camMode === before.camMode && after.hud === before.hud, 'the place, the view and the HUD given back');
check(Math.abs(after.pad - before.pad) < 0.2 && Math.abs(after.tram - before.tram) < 0.2, `the pads' and the trams' clocks given back (${before.pad} → ${after.pad}, ${before.tram} → ${after.tram})`);
check(after.saved >= 1 && after.photo && after.photo.w >= 2 * after.W - 2, `B: ${after.saved} frames saved at 2× (${after.photo ? after.photo.w + ' × ' + after.photo.h : '—'})`);

// ---- V: the reel recorded as a WebM, ended by Esc
console.log('— V: the video (' + secs() + ')');
const vid = { ok: false };
try {
  await ev(() => { VR.game.input.pressed.add('F9'); window.__step(1); });
  for (let i = 0; i < 60; i++) { const ph = await ev(() => VR.game.director.phase); if (ph === 'run') break; await step(1); await wait(100); }
  await ev(() => { VR.game.input.pressed.add('KeyV'); window.__step(1); });
  vid.rec = await ev(() => !!(VR.Reel.run && VR.Reel.run.rec));
  for (let i = 0; i < 40; i++) { await step(1, true); await wait(60); }
  await ev(() => { VR.game.input.pressed.add('Escape'); window.__step(1); });
  for (let i = 0; i < 30; i++) { await wait(200); if (await ev(() => !!VR.Reel.stats.video)) break; }
  Object.assign(vid, await ev(() => ({ video: VR.Reel.stats.video, name: VR.Reel.lastVideo && VR.Reel.lastVideo.name, run: !!VR.Reel.run })));
} catch (e) { vid.err = e.message; }
console.log('  ' + JSON.stringify(vid));
NUM.video = vid;
check(vid.rec && vid.video && vid.video.bytes > 1000 && !vid.run, `V: a WebM recorded and saved locally (${vid.video ? Math.round(vid.video.bytes / 1024) + ' KB ' + vid.name : '—'}), Esc ends it`);

// ---- the costs: a drawn frame in play and in the reel, Very Low and High
console.log('— costs (' + secs() + ')');
const bench = {};
for (const preset of ['potato', 'high']) {
  await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.applySettings('*'); }, preset);
  for (let i = 0; i < 10; i++) { await step(5); await wait(200); }
  const frames = (n) => ev((n) => { const g = VR.game; let ms = 0; for (let i = 0; i < n; i++) { window.__nodraw = false; const t = performance.now(); g.last = t - 1000 / 30; g.loop(t); g.renderer.gl.finish(); ms += performance.now() - t; } window.__nodraw = true; return ms / n; }, n);
  const loopOnly = (on, n) => ev(([on, n]) => { const g = VR.game; VR.Reel.on = on; let ms = 0; for (let i = 0; i < n; i++) { const t = performance.now(); g.last = t - 1000 / 30; g.loop(t); ms += performance.now() - t; } VR.Reel.on = true; return ms / n; }, [on, n]);
  const b = { play: await frames(12), loopOn: await loopOnly(true, 200), loopOff: await loopOnly(false, 200) };
  b.loopOn2 = await loopOnly(true, 200); b.loopOff2 = await loopOnly(false, 200);
  await ev(() => { VR.game.input.pressed.add('F9'); window.__step(1); });
  for (let i = 0; i < 80; i++) { const ph = await ev(() => VR.game.director.phase); if (ph === 'run') break; await step(1); await wait(100); }
  b.reelScale = await ev(() => VR.game.renderer.q.scale);
  b.reel = await frames(12);
  if (preset === 'potato') { await step(1, true); await page.screenshot({ path: SHOTS + 'reel_verylow.png', timeout: 120000 }); }
  await ev(() => { VR.game.input.pressed.add('Escape'); window.__step(1); });
  b.scaleAfter = await ev(() => VR.game.renderer.q.scale);
  bench[preset] = b;
  console.log(`  ${preset}: ${JSON.stringify(b)}`);
}
NUM.bench = bench;
check(bench.potato.reelScale <= 0.45 + 1e-6 && Math.abs(bench.potato.scaleAfter - 0.55) < 1e-6, `Very Low: the reel at ${bench.potato.reelScale} of the pixels, ${bench.potato.scaleAfter} again after`);
check(bench.potato.reel <= bench.potato.play * 1.15, `Very Low: a reel frame ${bench.potato.reel.toFixed(1)} ms ≤ a play frame ${bench.potato.play.toFixed(1)} ms (+15 %)`);

// ---- the sheet: 8 frames of the reel
const pick = [];
const order = [...pics.filter((p) => p.frame !== 'title' && p.frame !== 'end' && !/card/.test(p.frame)), ...pics.filter((p) => /card/.test(p.frame)), ...pics.filter((p) => p.frame === 'title')];
for (const p of order) if (pick.length < 8 && !pick.includes(p)) pick.push(p);
pick.sort((a, b) => a.si - b.si);
const rows = []; for (let i = 0; i < pick.length; i += 2) rows.push({ label: pick.slice(i, i + 2).map((p) => `${p.si} · ${p.frame} · „${p.cap}" · ${p.tod}`).join('   |   '), imgs: pick.slice(i, i + 2).map((p) => p.file) });
fs.writeFileSync(ROOT + '.tmp_tests/reel_sheet.json', JSON.stringify({ w: 620, rows }));
try { execSync(`python3 /root/r9coord/pairs.py ${SHOTS}reel_sheet.jpg ${ROOT}.tmp_tests/reel_sheet.json`); } catch (e) { console.log('  ! sheet: ' + e.message.slice(0, 200)); }
check(fs.existsSync(SHOTS + 'reel_sheet.jpg') && pick.length === 8, 'test/shots/reel_sheet.jpg with 8 frames of one reel');
fs.writeFileSync(SHOTS + 'reel_numbers.json', JSON.stringify(NUM, null, 1));
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 20)) console.log(l);
check(!logs.some((l) => /pageerror\]/.test(l)), 'no page errors');
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

// e-funke · Funke, the companion drone, in the browser (plan docs/superpowers/plans/2026-10-22-e-funke.md):
//  1 · a world (seed 4242, Balanced, 1280 × 720, German) at a vista at the golden hour:
//      funke_follow.png      third person: the drone at the shoulder, lit, its eye and antenna
//      funke_close.png       the photo mode's free camera close by: the drone and the player
//      funke_talk.png        first person: asked, it peeks into the view and its bubble speaks (German)
//      funke_way.png         a waypoint ahead: the ribbon of light from the drone toward it
//      funke_scan.png        chests and ores buried around: their boxes glow through the ground
//      funke_photo.png       the picture Funke took from its spot (the 2× PNG photomode saves) + funke_photo_screen.png
//      funke_cockpit.png     in a shuttle's cockpit: on the dashboard, turned to the pilot
//      funke_hint.png        Einfach: a 🧭 hint as Funke's line (the box hidden)
//    checks: the drone is drawn, the lines are German and say what they should, the bubble shows, the hint relay and its
//    end, „Funke, Ruhe!", the switch off draws nothing, no page error, every shader compiles
//  2 · Very Low (potato) and High: Funke's own cost a frame (its update and its draw, measured in the page — ≤ 0.1 ms on
//      Very Low), and the frame with the switch on and off (rounds in turns, the GPU drained)
//   nohup bash test/wt_run.sh funke.mjs 3600 > .tmp_tests/funke.log 2>&1 &
//   SEED=4242 · NO_COST=1 · ROUNDS=6 · N=10
// regress: skip  (pictures and costs; the gate is test/funke.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const ROOT = new URL('../', import.meta.url).pathname.replace(/\/$/, '');
const DIST = process.env.DIST || 'file://' + ROOT + '/dist/index.html';
const SHOTS = ROOT + '/test/shots/';
const SEED = process.env.SEED || '4242', ROUNDS = +(process.env.ROUNDS || 6), N = +(process.env.N || 10);
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const rec = { seed: SEED, lines: {}, cost: {}, scenes: {} };
const save = () => { try { fs.writeFileSync(SHOTS + 'funke.json', JSON.stringify(rec, null, 1)); } catch (e) { /* a convenience */ } };
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });

// ---------------------------------------------------------------- a page with a world (dims.mjs's machinery)
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 500)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1200)));
page.on('crash', () => { logs.push('[pageerror] the page crashed'); console.log('  !! the page crashed'); });
// (the greeting and the first-time tips already said: the pictures show what the test asks for)
await page.addInitScript(() => { try { localStorage.setItem('r9si.funke', JSON.stringify({ hello: 1, help: { villager: 1, ship: 1, chest: 1, door: 1, bed: 1, vista: 1, night: 1, water: 1, photo: 1 } })); localStorage.setItem('r9si.lang', 'de'); localStorage.setItem('r9si.hints', JSON.stringify({ v: 1, seen: {}, done: { move: 1, fly: 1, play: 1, bauhand: 1, bhring: 1, bhundo: 1, bhchange: 1 }, n: {} })); } catch (e) { /* */ } });
await page.goto(DIST);
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(4); } };
const boost = (on) => ev((on) => { const g = VR.game, q = g.renderer && g.renderer.q; if (!q) return; if (on) { if (q.__up === undefined) q.__up = q.upload; q.upload = 24; } else if (q.__up !== undefined) { q.upload = q.__up; delete q.__up; } }, on);
const settle = async (max = 60, farMax = 20) => {
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
const picture = async (path, frames = 3) => {
  await ev((frames) => { window.__norender = false; const g = VR.game; for (let i = 0; i < frames; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }, frames);
  for (let k = 0; k < 2; k++) {
    try { await page.screenshot({ path, timeout: 150000 }); return true; } catch (e) { console.log(`  !! screenshot ${path.replace(/^.*\//, '')} failed (${String(e.message || e).split('\n')[0].slice(0, 120)})`); }
  }
  return false;
};
const fk = () => ev(() => { const g = VR.game, a = g.funke, F = VR.Funke, b = document.getElementById('funkebub'); return a ? { pos: a.pos.map(v => +v.toFixed(2)), anchor: a.anchor.map(v => +v.toFixed(2)), visible: a.visible, line: a.line ? a.line.text : null, last: F.last ? F.last.text : null, wayT: +a.wayT.toFixed(2), wayPts: a.wayPts, scanT: +a.scanT.toFixed(2), scanN: a.scanN, draws: F.cost.draws, bub: b ? { shown: b.style.display !== 'none', text: (b.querySelector('.tx') || {}).textContent, tf: b.style.transform } : null, roll: +a.roll.toFixed(3), seat: !!a.seat } : null; });
// (the photo's shutter flash fades out on requestAnimationFrame, which this test holds: it is taken away by hand)
const unflash = () => ev(() => { for (const d of document.querySelectorAll('div')) if (d.style && d.style.zIndex === '32' && d.style.background && /255, 255, 255|#fff/.test(d.style.background)) d.remove(); });
const run = async (name, fn) => { try { await fn(); } catch (e) { check(false, `${name}: ${String(e && e.stack || e).split('\n').slice(0, 3).join(' | ')}`); } };

for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 8; g.settings.wowMoments = false; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Funke',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',cheats:true,kit:true})`);
for (let i = 0; i < 180; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
check(await ev(() => VR.game.state) === 'play', `the world is loaded (Balanced, ${secs()})`);
// the test drives the frames (the page's own loop off), the time held at the golden hour, clear weather, the HUD's
// hint boxes and the photo mode's note out of the pictures
await ev(() => { const g = VR.game; window.requestAnimationFrame = () => 0; g.zenFreezeTime = true; g.zenFreezeWeather = true; g.env.wx.force('klar'); g.env.setTime(10800); const st = document.createElement('style'); st.textContent = '#lockhint,#photonote,#hint{display:none !important}'; document.head.appendChild(st); });
await settle(60);
const info0 = await ev(() => { const g = VR.game; return { funke: !!g.funke, actor: !!(g.funke && g.funke.update), api: typeof VR.Funke.ask, model: !!VR.VOXMODELS.funke, vistas: g.wow ? g.wow.list.size : 0, pos: g.player.pos.map(v => +v.toFixed(1)) }; });
console.log('  start', JSON.stringify(info0));
check(info0.funke && info0.actor && info0.api === 'function' && info0.model, 'Funke is there (g.funke, VR.Funke.ask, the model)');

// ---------------------------------------------------------------- the place: a vista near the spawn (its composed view), seen
const place = await ev(() => {
  const g = VR.game, p = g.player, list = g.wow ? [...g.wow.list.values()] : [];
  let v = null, bd = 1e9; for (const q of list) { const d = Math.hypot(q.x - p.pos[0], q.z - p.pos[2]); if (q.wow !== false && d < bd) { bd = d; v = q; } }
  if (v) { VR.WowMoment.mark(g.meta, v.id); p.teleport(v.eye[0], v.eye[1] - 1.62, v.eye[2]); p.yaw = v.yaw; p.pitch = Math.max(-0.2, Math.min(0.1, v.pitch)); p.flying = false; }
  return v ? { id: v.id, lm: v.lm, at: [v.x, v.y, v.z], yaw: +v.yaw.toFixed(3) } : null;
});
console.log('  vista', JSON.stringify(place));
rec.scenes.vista = place; save();
await settle(60);
await ev(() => { const g = VR.game; g.env.setTime(10800); g.env.wx.force('klar'); });
await step(30);

// ================================================================ 1 · follow (third person) and close
await run('follow', async () => {
  await ev(() => { const g = VR.game; g.camMode = 1; VR.Funke.cost.draws = 0; });
  await step(60);
  const f = await fk();
  console.log('  follow', JSON.stringify(f));
  check(await picture(SHOTS + 'funke_follow.png', 3), 'test/shots/funke_follow.png — third person: the drone at the shoulder');
  const d = await fk();
  check(d && d.draws > 0 && d.visible, `the drone is drawn (${d && d.draws} draws in the picture's frames)`);
  check(d && Math.hypot(d.pos[0] - d.anchor[0], d.pos[1] - d.anchor[1], d.pos[2] - d.anchor[2]) < 0.4, 'it hovers at its place at the shoulder');
  rec.scenes.follow = d; save();
  // a turn while walking: it lags and banks (the roll measured)
  const roll = await ev(async () => { const g = VR.game, p = g.player; let mx = 0; for (let i = 0; i < 40; i++) { p.yaw += 0.05; g.last = performance.now() - 33; g.loop(performance.now()); mx = Math.max(mx, Math.abs(g.funke.roll)); } for (let i = 0; i < 40; i++) { p.yaw -= 0.05; g.last = performance.now() - 33; g.loop(performance.now()); } return mx; });
  check(roll > 0.03, `turning: it banks into the turn (roll up to ${roll.toFixed(2)} rad)`);
  await step(40);
  // close: the photo mode's free camera 1.3 m in front of the drone and to its right, the player's head behind it — in
  // the photo mode Funke turns to the camera (it poses)
  await ev(() => { const g = VR.game, a = g.funke, p = g.player; g.photoMode(true); const s = g.photoCam.s; const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw); s.x = a.pos[0] + fx * 1.15 + rx * 0.75; s.y = a.pos[1] + 0.22; s.z = a.pos[2] + fz * 1.15 + rz * 0.75; const vx = (a.pos[0] - rx * 0.25) - s.x, vy = a.pos[1] - 0.05 - s.y, vz = (a.pos[2] - rz * 0.25) - s.z; s.yaw = Math.atan2(-vx, -vz); s.pitch = Math.atan2(vy, Math.hypot(vx, vz)); g.camMode = 1; });
  await step(40);
  check(await picture(SHOTS + 'funke_close.png', 3), 'test/shots/funke_close.png — close by: the drone, its eye and antenna, the player');
  await ev(() => { const g = VR.game; g.photoMode(false); g.camMode = 0; });
  await step(10);
});

// ================================================================ 2 · talk (first person): asked, it peeks in and speaks
await run('talk', async () => {
  await ev(() => { const g = VR.game; g.camMode = 0; g.player.pitch = 0; });
  await step(10);
  const ok = await ev(() => VR.Funke.wow());
  await step(45);
  const f = await fk();
  console.log('  talk', JSON.stringify(f));
  rec.lines.talk = f && f.last; save();
  check(ok && f && f.line && /[äöüß]|\b(Jetzt|Gleich|Heute|Minute|goldene|Stare|Aussicht|ruhig|du|ist|der|die|das)\b/.test(f.line) && !/\b(the|is|you)\b/.test(f.line), `asked about the next wow, it speaks German: „${f && f.line}"`);
  check(f && f.bub && f.bub.shown && f.bub.text === f.line, 'its bubble shows the line beside it');
  check(await picture(SHOTS + 'funke_talk.png', 3), 'test/shots/funke_talk.png — first person: it peeks into the view and talks');
  const proj = await ev(() => { const g = VR.game, r = g.renderer, a = g.funke, c = g.cam, vp = r.viewProj, x = a.pos[0] - c.x, y = a.pos[1] - c.y, z = a.pos[2] - c.z, w = vp[3] * x + vp[7] * y + vp[11] * z + vp[15]; return w > 0 ? [(vp[0] * x + vp[4] * y + vp[8] * z + vp[12]) / w, (vp[1] * x + vp[5] * y + vp[9] * z + vp[13]) / w] : null; });
  check(!!proj && Math.abs(proj[0]) < 0.95 && Math.abs(proj[1]) < 0.95, `the drone is in the view while it talks (screen ${proj ? proj.map(v => v.toFixed(2)).join(', ') : '—'})`);
  await step(150);   // (the line ends)
});

// ================================================================ 3 · the way: a waypoint ahead, the ribbon of light
await run('way', async () => {
  const wp = await ev(() => { const g = VR.game, p = g.player, w = g.world, fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), x = Math.floor(p.pos[0] + fx * 140 + Math.cos(p.yaw) * 25), z = Math.floor(p.pos[2] + fz * 140 - Math.sin(p.yaw) * 25), y = w.topAt(x, z) + 1; g.gadgets.addWaypoint(x, y, z); return [x, y, z]; });
  await ev(() => { const g = VR.game; g.player.pitch = -0.08; g.funke.askT = -1e9; });
  const ok = await ev(() => VR.Funke.way());
  await step(18);
  const f = await fk();
  console.log('  way', JSON.stringify(f), JSON.stringify(wp));
  rec.lines.way = f && f.last; save();
  check(ok && f && f.wayT > 0 && f.wayPts > 4 && /Wegpunkt|entfernt|lang/.test(f.line || ''), `the way: a line of ${f && f.wayPts} points toward the waypoint, „${f && f.line}"`);
  check(await picture(SHOTS + 'funke_way.png', 2), 'test/shots/funke_way.png — the ribbon of light toward the waypoint');
  await step(140);
  const g2 = await fk();
  check(g2 && g2.wayT === 0, 'the light line is gone after 4 s');
});

// ================================================================ 4 · the scan: chests and ores buried around
await run('scan', async () => {
  const put = await ev(() => {
    const g = VR.game, p = g.player, w = g.world, R = VR.R, st = (n) => R.byName[n] ? R.byName[n].defaultState : 0;
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw), x0 = p.pos[0], z0 = p.pos[2];
    const at = (f, r, dy) => { const x = Math.floor(x0 + fx * f + rx * r), z = Math.floor(z0 + fz * f + rz * r); return [x, w.topAt(x, z) - dy, z]; };
    const list = [];
    for (const [f, r, dy, n] of [[6, 2, 2, 'chest'], [11, -4, 3, 'chest'], [16, 5, 2, 'barrel'], [8, -2, 5, 'iron_ore'], [9, -1, 5, 'iron_ore'], [9, -2, 6, 'iron_ore'], [13, 3, 6, 'gold_ore'], [19, -6, 7, 'diamond_ore'], [21, 1, 5, 'emerald_ore'], [24, 7, 6, 'iron_ore'], [7, 6, 4, 'coal_ore'], [7, 7, 4, 'coal_ore'], [12, 9, 5, 'lapis_ore']]) { const q = at(f, r, dy); list.push([q[0], q[1], q[2], st(n)]); }
    w.bulkSet(list, false);
    return list.length;
  });
  await step(4);
  await ev(() => { const g = VR.game; g.player.pitch = -0.62; g.funke.askT = -1e9; });
  const ok = await ev(() => VR.Funke.scan());
  await step(40);
  const f = await fk();
  console.log('  scan', JSON.stringify(f), put);
  rec.lines.scan = f && f.last; save();
  check(ok && f && f.scanN >= 10 && /Truhe|Eisen|Gold|Diamant/.test(f.line || ''), `the scan: ${f && f.scanN} boxes, „${f && f.line}"`);
  check(await picture(SHOTS + 'funke_scan.png', 2), 'test/shots/funke_scan.png — the chests and ores glow through the ground');
  await step(240);
  const g2 = await fk();
  check(g2 && g2.scanT === 0, 'the glow is gone after 8 s');
  await ev(() => { VR.game.player.pitch = 0; });
});

// ================================================================ 5 · the photo from Funke's spot
await run('photo', async () => {
  await ev(() => { const g = VR.game; g.player.pitch = -0.05; window.__lastPhoto = VR.PhotoMode.last || null; });
  await step(10);
  const ok = await ev(() => VR.Funke.photo());
  let shotAt = -1, saved = null;
  for (let i = 0; i < 80 && !saved; i++) {
    await step(2);
    if (shotAt < 0 && await ev(() => !!VR.game.funke.shot)) { shotAt = i; await unflash(); await picture(SHOTS + 'funke_photo_screen.png', 1); }
    saved = await ev(() => { const L = VR.PhotoMode.last; return L && L !== window.__lastPhoto ? { name: L.name, w: L.w, h: L.h, bytes: L.bytes, url: L.url } : null; });
    if (!saved) await wait(120);
  }
  console.log('  photo', JSON.stringify(saved), 'shot at step', shotAt);
  check(ok && shotAt >= 0, 'Funke flew to its spot and the camera took its place (funke_photo_screen.png)');
  if (saved) {
    const b64 = await ev(async (url) => { const r = await fetch(url), b = new Uint8Array(await r.arrayBuffer()); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); }, saved.url);
    fs.writeFileSync(SHOTS + 'funke_photo.png', Buffer.from(b64, 'base64'));
  }
  check(!!saved && saved.w >= 2000, `the picture is saved at 2× (${saved ? saved.w + ' × ' + saved.h + ', ' + Math.round(saved.bytes / 1024) + ' KB' : 'none'}) → test/shots/funke_photo.png`);
  await step(30);
  const f = await fk();
  rec.lines.photo = f && f.last; save();
  check(f && /Hab dich|Klick/.test(f.last || ''), `and says so: „${f && f.last}"`);
  await unflash();
  check(await ev(() => VR.game.camMode === 0 && !VR.game.funke.shot), 'the view is the player\'s own again');
});

// ================================================================ 6 · Einfach: a hint as Funke's line
await run('hint', async () => {
  await step(150);
  await ev(() => { const g = VR.game; g.funke.inputT = g.time; const H = VR.Hints; H.dismiss(); window.__hintOk = H.show('funketest', { text: '🖱 bewegen = umschauen · W A S D = laufen', picto: ['mouse', 'W', 'A', 'S', 'D'] }); });
  await step(20);
  const f = await fk(), box = await ev(() => { const h = document.getElementById('hints'); return h ? { funke: h.classList.contains('funke'), on: h.classList.contains('on') } : null; });
  console.log('  hint', JSON.stringify(f && f.bub), JSON.stringify(box));
  check(f && f.bub && f.bub.shown && /W A S D/.test(f.bub.text || '') && box && box.funke, 'Einfach: the hint is Funke\'s line, the box hidden');
  check(await picture(SHOTS + 'funke_hint.png', 2), 'test/shots/funke_hint.png — the 🧭 hint as Funke\'s bubble');
  await ev(() => VR.Hints.done('funketest'));
  await step(4);
  const g2 = await fk(), box2 = await ev(() => { const h = document.getElementById('hints'); return h ? h.classList.contains('funke') : false; });
  check(g2 && !g2.line && !box2, 'done: the bubble goes and the box is the box again');
});

// ================================================================ 7 · the cockpit: on the dashboard
await run('cockpit', async () => {
  const key = await ev(() => { const g = VR.game, p = g.player; p.flying = false; const d = g.starships.placeInFront(12345, 'shuttle', null, p); return d ? d.key : null; });
  for (let i = 0; i < 60; i++) { await step(5); if (await ev((k) => VR.game.starships.ships.some(s => s.d.key === k && s.d.meta && s.d.cells), key)) break; await wait(150); }
  await ev((k) => { const g = VR.game, s = g.starships.ships.find(q => q.d.key === k); g.player.flying = false; g.starships.board(s, g.player); }, key);
  await step(4);
  for (let i = 0; i < 80; i++) { if (await ev(() => !!(VR.game.flight && VR.game.cockpit.ready(VR.game.flight)))) break; await step(2); await wait(100); }
  await ev(() => { const fl = VR.game.flight; if (fl.setPower) fl.setPower(true); if (fl.startEngines) fl.startEngines(); });
  await step(100);
  await ev(() => { const g = VR.game, fl = g.flight; fl.headYaw = -0.24; fl.headPitch = -0.14; fl.recenter = false; g.funke.askT = -1e9; VR.Funke.wow(); });
  await step(20);
  const f = await fk();
  console.log('  cockpit', JSON.stringify(f));
  check(f && f.seat, 'in the ship it sits on the dashboard');
  check(await picture(SHOTS + 'funke_cockpit.png', 3), 'test/shots/funke_cockpit.png — on the dashboard, turned to the pilot');
  rec.scenes.cockpit = f; save();
  await ev(() => { const g = VR.game; if (g.starships && g.starships.exit) g.starships.exit(); });
  await step(30);
});

// ================================================================ 8 · Ruhe, the switch
await run('mute', async () => {
  const m = await ev(() => { const g = VR.game, a = g.funke, F = VR.Funke; F.mute(); const muted = F.muted(); a.inputT = g.time; const can = a.budget.can(g.time + 100, false), asked = a.budget.can(g.time + 1, true); return { muted, can, asked }; });
  check(m.muted && !m.can && m.asked, '„Funke, Ruhe!": muted (nothing unprompted for 10 minutes, asked lines still answer)');
  await ev(() => VR.Funke.mute(null, false));
  const sw = await ev(() => { const g = VR.game, C = VR.Funke.cost, n = (on) => { g.settings.funke = on; C.draws = 0; window.__norender = false; for (let i = 0; i < 3; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } window.__norender = true; return C.draws; }; g.camMode = 1; const on = n(true), off = n(false); g.settings.funke = true; g.camMode = 0; return { on, off }; });
  check(sw.on > 0 && sw.off === 0, `the switch off: no drone drawn (on ${sw.on} draws, off ${sw.off})`);
});
{
  const errs = logs.filter(l => l.startsWith('[pageerror]'));
  console.log(`--- logs (${logs.length})`); for (const l of logs.slice(0, 14)) console.log(l);
  check(errs.length === 0, `no page error (${errs.length})`);
  check(!logs.some(l => /shader|compile|link/i.test(l)), 'every shader compiles (Funke\'s light program included)');
}

// ================================================================ 9 · the cost: Very Low and High, Funke on and off
// (run 1 measured with gl.finish() alone: SwiftShader did not wait there — "Very Low on 1971.7 / off 4.1 ms"; now every
// frame is drained by a 1-pixel read of the picture; the full probe with six states is test/funke_cost.mjs)
if (!process.env.NO_COST) {
  for (const preset of ['potato', 'high']) {
    await run('cost ' + preset, async () => {
      await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.renderDist = 8; g.applySettings('*'); g.camMode = 1; g.settings.funke = true; }, preset);
      await settle(40, 4);
      await step(20);
      const ab = await ev(([rounds, n]) => {
        const g = VR.game, r = g.renderer, gl = r.gl, A = g.funke, C = VR.Funke.cost, px = new Uint8Array(4), out = { none: [], off: [], on: [] };
        window.__norender = false;
        const drain = () => { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
        const frame = () => { const t0 = performance.now(); g.last = t0 - 33; g.loop(performance.now()); drain(); return performance.now() - t0; };
        const set = (s) => { g.funke = s === 'none' ? null : A; g.settings.funke = s !== 'off'; };
        drain(); for (const k in C) C[k] = 0;
        const S = ['none', 'off', 'on'];
        for (let k = 0; k < rounds; k++) for (const s of S.slice(k % 3).concat(S.slice(0, k % 3))) { set(s); frame(); const ts = []; for (let i = 0; i < n; i++) ts.push(frame()); ts.sort((a, b) => a - b); out[s].push(ts[n >> 1]); }
        set('on'); window.__norender = true;
        const med = (a) => { const b = a.slice().sort((x, y) => x - y); return +b[b.length >> 1].toFixed(2); };
        return { none: med(out.none), off: med(out.off), on: med(out.on), rounds, own: { upd: C.ms / Math.max(1, C.frames), draw: C.drawMs / Math.max(1, C.frames), worst: C.worst, frames: C.frames } };
      }, preset === 'high' ? [3, 4] : [ROUNDS, N]);
      const tot = ab.own.upd + ab.own.draw;
      rec.cost[preset] = { ab, total: +tot.toFixed(4) }; save();
      console.log(`  ${preset}: Funke ${(ab.own.upd * 1000).toFixed(1)} µs update + ${(ab.own.draw * 1000).toFixed(1)} µs draw a frame (worst ${ab.own.worst.toFixed(3)} ms) · frame (drained) without Funke ${ab.none} ms / off ${ab.off} ms / on ${ab.on} ms`);
      if (preset === 'potato') check(tot <= 0.1 && ab.off <= ab.none * 1.1 + 0.5, `Very Low: Funke costs ${(tot * 1000).toFixed(1)} µs a frame (≤ 100 µs); the frame without it ${ab.none} ms, off ${ab.off} ms, on ${ab.on} ms`);
    });
  }
}
{
  const errs = logs.filter(l => l.startsWith('[pageerror]') || l.startsWith('[error]'));
  console.log(`--- all logs (${logs.length}, errors ${errs.length})`); for (const l of logs.slice(0, 20)) console.log(l);
}
save();
await browser.close();
console.log(`(${secs()})`);
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);

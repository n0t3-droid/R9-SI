// e-portal · the Leuchtpfad in the browser (docs/superpowers/plans/2026-10-31-e-portal.md): a new default world (seed 53,
// creative), 1280 × 720, de-DE, High then Very Low for the film's cost.
//   pictures  test/shots/gate_picker.png, journey_clouds.png, journey_planet.png, journey_arrival_opal.png,
//             journey_exo_tunnel.png, arrival_caption.png, creative_fast_flight_x1.png / _x8.png; the sheet
//             test/shots/portal_sheet.jpg
//   numbers   the film's draw ms (High / Very Low), the idle cost a frame, a real trip Herzwelt → Opal by gate (the
//             film, the arrival, the caption, the episode), fast flight ×8 in Kreativ and ×1 as a multiplayer host
// → .tmp_tests/portal_run.json.   usage: nohup bash test/wt_run.sh portal.mjs 3600 > .tmp_tests/portal.log 2>&1 &
// regress: skip  (a showcase: the pictures are the evidence; the rules are test/portal.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import { execFileSync } from 'child_process';
const ROOT = new URL('../', import.meta.url).pathname.replace(/\.tmp_tests\/$/, '');
const DIST = process.env.DIST || 'file://' + ROOT + 'dist/index.html';
const SHOTS = ROOT + 'test/shots/';
fs.mkdirSync(SHOTS, { recursive: true });
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const rec = {};
const save = () => { try { fs.writeFileSync(ROOT + '.tmp_tests/portal_run.json', JSON.stringify(rec, null, 1)); } catch (e) { /* convenience */ } };
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
const page = await ctx.newPage();
const logs = [];
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 800)));
page.on('console', m => { if (m.type() === 'error' || /travel|portal/i.test(m.text())) { logs.push('[' + m.type() + '] ' + m.text().slice(0, 300)); if (/travel|portal/i.test(m.text())) console.log('    console: ' + m.text().slice(0, 200)); } });
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, a) => page.evaluate(fn, a);
// (SwiftShader: the 3D frame is held while the page is pictured — the last frame stays on the screen, the DOM and the film's canvas on top)
const shot = async (name) => { await ev(() => { window.__norender = true; }); await wait(400); try { await page.screenshot({ path: SHOTS + name, timeout: 120000 }); } catch (e) { console.log('  (no picture ' + name + ': ' + e.message.slice(0, 80) + ')'); } await ev(() => { window.__norender = false; }); return SHOTS + name; };
await page.goto(DIST);
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const r = VR.game.renderer; r._render = r.render; r.render = function (F) { if (window.__norender) return; return this._render(F); }; });
await ev(() => { const g = VR.game; g.applyPreset('high'); g.settings.renderDist = 6; g.settings.dynRes = false; g.applySettings('*'); });
await ev(() => VR.game.createWorld({ name: 'Portal', mode: 'creative', difficulty: 'peaceful', type: 'default', seed: '53', cheats: true, kit: true }));
for (let i = 0; i < 180; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
check(await ev(() => VR.game.state) === 'play', 'the world plays');
await ev(() => { const g = VR.game; g.zenFreezeTime = true; if (g.env) { g.env.rain = 0; g.env.rainTarget = 0; } for (const id of ['hints']) { const h = document.getElementById(id); if (h) h.style.display = 'none'; } });
await wait(9000);
// ---------------------------------------------------------------- the idle cost
rec.idleMs = await ev(() => VR.Portal.idleCost(VR.game, 400));
check(rec.idleMs < 0.05, 'idle: the gates\' and fast flight\'s look ' + rec.idleMs.toFixed(4) + ' ms a frame');
// ---------------------------------------------------------------- the picker
await ev(() => { const g = VR.game, C = VR.PortalCore, r = C.rec(g.meta); C.favAdd(r, { dim: g.dim, at: g.player.pos, yaw: g.player.yaw }); C.favToggleWorld(r, 'opal'); });
check(await ev(() => VR.Portal.open(VR.game, 'gate')), 'the picker opens');
await wait(900);
const st0 = await ev(() => VR.Portal.stats());
check(st0.pick && st0.cards >= 10, 'cards: ' + st0.cards);
await shot('gate_picker.png');
await ev(() => VR.Portal.close(false));
// ---------------------------------------------------------------- the films (dry: the film only)
const filmWith = (o) => ev((o) => { const C = VR.PortalCore; for (let s = 1; s < 400; s++) { const F = C.film(C.rec({}), s, o.from, o.to, { low: o.low }); if (o.need.every(n => F.shots.some(q => q.id === n))) return F; } return null; }, o);
const at = (F, id, k) => { let t = 0; for (const s of F.shots) { if (s.id === id) return t + s.dur * k; t += s.dur; } return 0; };
async function filmShot(dest, F, id, k, name) {
  await ev(([d, F]) => VR.Portal.go(VR.game, d, { dry: true, film: F }), [dest, F]);
  await wait(200);
  const sh = await ev((t) => VR.Portal.seek(t), at(F, id, k));
  await wait(250);
  const p = await shot(name);
  await ev(() => VR.Portal.cancel());
  await wait(100);
  return { sh, p };
}
const F1 = await filmWith({ from: 'overworld', to: 'opal', need: ['clouds', 'curve', 'moon'] });
check(!!F1, 'a film Herzwelt → Opal with clouds, curve and moon: ' + (F1 && F1.id));
const a1 = await filmShot({ dim: 'opal' }, F1, 'clouds', 0.45, 'journey_clouds.png');
const a2 = await filmShot({ dim: 'opal' }, F1, 'curve', 0.7, 'journey_planet.png');
const a3 = await filmShot({ dim: 'opal' }, F1, 'arrive', 0.55, 'journey_arrival_opal.png');
check(a1.sh === 'clouds' && a2.sh === 'curve' && a3.sh === 'arrive', 'the shots: ' + [a1.sh, a2.sh, a3.sh].join(', '));
const F2 = await filmWith({ from: 'overworld', to: 'x.2.1.1', need: ['tunnel'] });
const a4 = await filmShot({ dim: 'x.2.1.1' }, F2, 'tunnel', 0.6, 'journey_exo_tunnel.png');
const a5 = await filmShot({ dim: 'opal' }, F1, 'swallow', 0.55, 'journey_swallow.png');
const a6 = await filmShot({ dim: 'opal' }, F1, 'moon', 0.75, 'journey_moon_opal.png');
check(a4.sh === 'tunnel', 'the star-jump tunnel to another star');
// the film's draw cost: High, then Very Low (a dry film played for 3 s each)
for (const pr of ['high', 'potato']) {
  await ev((p) => { const g = VR.game; g.settings.preset = p; }, pr);
  await ev((F) => VR.Portal.go(VR.game, { dim: 'opal' }, { dry: true, film: Object.assign({}, F, { low: VR.game.settings.preset === 'potato' }) }), F1);
  await wait(4000);
  const s = await ev(() => VR.Portal.stats());
  rec['film_' + pr] = { drawMs: s.drawMs, maxMs: s.maxMs, w: s.film && s.film.w, h: s.film && s.film.h };
  await ev(() => VR.Portal.cancel());
}
await ev(() => { const g = VR.game; g.applyPreset('high'); g.settings.renderDist = 6; g.applySettings('*'); });
console.log('  film draw ms: High ' + JSON.stringify(rec.film_high) + ' · Very Low ' + JSON.stringify(rec.film_potato));
check(rec.film_potato.drawMs <= rec.film_high.drawMs + 0.5, 'Very Low draws the film no dearer than High');
save();
// ---------------------------------------------------------------- a real trip: Herzwelt → Opal
rec.ctxBefore = await ev(() => ({ ctx: VR.Portal.ctx(VR.game), screen: VR.game.ui.screen, blocking: VR.game.ui.blocking, state: VR.game.state, mode: VR.game.player.mode, adv: VR.Adventure && VR.Adventure.on && VR.Adventure.on(), role: VR.game.mp && VR.game.mp.role }));
console.log('  before the trip: ' + JSON.stringify(rec.ctxBefore));
await ev(() => { const g = VR.game; if (g.ui.screen) g.ui.resume(); });
const t0 = Date.now();
const film = await ev(() => { const g = VR.game; const F = VR.Portal.go(g, { dim: 'opal', id: 'w:opal' }); return F && F.id; });
check(!!film, 'the journey starts: ' + film);
let capShot = null, phase = null;
for (let i = 0; i < 600; i++) {
  await wait(500);
  const s = await ev(() => ({ st: VR.Portal.stats(), dim: VR.game.dim, state: VR.game.state, screen: VR.game.ui.screen, busy: VR.Travel.busy(VR.game), trip: VR.game.travel && VR.game.travel.trip && { to: VR.game.travel.trip.to, sw: VR.game.travel.trip.tSwitch } }));
  if (i % 20 === 0) console.log('    ' + (i / 2) + ' s: ' + JSON.stringify({ f: s.st.film && { t: s.st.film.t, ph: s.st.film.phase, went: s.st.film.went, arr: s.st.film.arrived }, dim: s.dim, state: s.state, screen: s.screen, busy: s.busy, trip: s.trip }));
  if (s.st.film) phase = s.st.film.phase;
  if (s.st.film && s.st.film.phase === 'reveal' && !capShot) { await wait(1400); capShot = await shot('arrival_caption.png'); }
  if (!s.st.film && s.dim === 'opal' && s.state === 'play') break;
}
rec.trip = await ev(() => ({ last: VR.Portal.last, dim: VR.game.dim, travel: VR.Travel.last, cap: document.getElementById('ptCap') && document.getElementById('ptCap').textContent }));
rec.tripS = (Date.now() - t0) / 1000;
check(rec.trip.dim === 'opal' && !!capShot, 'arrived on Opal by the Leuchtpfad, the caption pictured (' + rec.tripS.toFixed(0) + ' s, the film ' + (rec.trip.last && rec.trip.last.len) + ' s)');
check(rec.trip.last && rec.trip.last.episode, 'the first gate arrival: an episode (' + (rec.trip.last && rec.trip.last.episode) + ')');
check(rec.trip.travel && rec.trip.travel.via === 'portal', 'VR.Travel did the trip (via portal)');
console.log('  caption: ' + String(rec.trip.cap).slice(0, 200));
save();
await wait(9000);
// ---------------------------------------------------------------- fast flight (back on Herzwelt: a quick trip home by the film, skipped)
await ev(() => VR.Portal.go(VR.game, { dim: 'overworld', id: 'w:overworld' }));
for (let i = 0; i < 200; i++) { await wait(500); await page.keyboard.press('Space'); const s = await ev(() => ({ f: VR.Portal.stats().film, dim: VR.game.dim })); if (!s.f && s.dim === 'overworld') break; }
await wait(6000);
async function fly(mul, name) {
  await ev((m) => { const g = VR.game, p = g.player; g.settings.flyFast = m; p.flying = true; p.pitch = -0.12; g.input.captured = true; if (g.ui.screen) g.ui.resume(); g.input.keys.add('KeyW'); g.input.keys.add('ControlLeft'); }, mul);
  await wait(2500);
  const r = await ev(() => { const p = VR.game.player; return { flySpeed: p.flySpeed, hs: Math.hypot(p.vel[0], p.vel[2]), fly: VR.Portal.fly(), ctx: VR.Portal.ctx(VR.game), flying: p.flying, sprint: p.sprinting, screen: VR.game.ui.screen }; });
  await shot(name);
  await ev(() => { const g = VR.game; g.input.keys.delete('KeyW'); g.input.keys.delete('ControlLeft'); });
  await wait(800);
  return r;
}
rec.fly1 = await fly(1, 'creative_fast_flight_x1.png');
rec.fly8 = await fly(8, 'creative_fast_flight_x8.png');
console.log('  fly ×1 ' + JSON.stringify(rec.fly1) + ' · ×8 ' + JSON.stringify(rec.fly8));
check(rec.fly8.flySpeed >= 2 && rec.fly8.hs > rec.fly1.hs * 1.8 && rec.fly8.fly.fov > rec.fly1.fly.fov, 'Kreativ ×8: faster, the view wider');
rec.flyMp = await ev(() => { const g = VR.game, mp = g.mp, was = mp.role; mp.role = 'host'; g.settings.flyFast = 8; g.playFrame(0.016); const v = g.player.flySpeed; mp.role = was; return v; });
check(rec.flyMp === 1, 'as a multiplayer host: ×1 (' + rec.flyMp + ')');
rec.flySurv = await ev(() => { const g = VR.game, p = g.player; p.mode = 'survival'; g.playFrame(0.016); const v = p.flySpeed; p.mode = 'creative'; return v; });
check(rec.flySurv === 1, 'in Überleben: ×1');
const errs = logs.filter(l => l.startsWith('[pageerror]'));
check(errs.length === 0, 'no page error' + (errs.length ? ': ' + errs[0] : ''));
save();
try {
  const spec = { w: 620, rows: [
    { label: 'Das Tor: Wohin soll die Reise gehen? · das Licht verschluckt dich', imgs: [SHOTS + 'gate_picker.png', SHOTS + 'journey_swallow.png'] },
    { label: 'Durch die Wolken · die Krümmung der Welt', imgs: [SHOTS + 'journey_clouds.png', SHOTS + 'journey_planet.png'] },
    { label: 'Ankunft Opal · der Sternensprung-Tunnel', imgs: [SHOTS + 'journey_arrival_opal.png', SHOTS + 'journey_exo_tunnel.png'] },
    { label: 'Die Enthüllung mit Titel · Kreativ-Flug ×1', imgs: [SHOTS + 'arrival_caption.png', SHOTS + 'creative_fast_flight_x1.png'] },
    { label: 'Kreativ-Flug ×8 · Opal schwillt an (Amarant dahinter)', imgs: [SHOTS + 'creative_fast_flight_x8.png', SHOTS + 'journey_moon_opal.png'] },
  ] };
  fs.writeFileSync(ROOT + '.tmp_tests/portal_sheet.json', JSON.stringify(spec));
  execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + 'portal_sheet.jpg', ROOT + '.tmp_tests/portal_sheet.json']);
  console.log('  sheet: ' + SHOTS + 'portal_sheet.jpg');
} catch (e) { console.log('  (no sheet: ' + e.message.slice(0, 200) + ')'); }
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

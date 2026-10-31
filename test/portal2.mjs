// e-portal2 · the Leuchtpfad's film from the real space renderer, a skip that always takes, fast flight proven, the star
// map's first frame (docs/superpowers/plans/2026-10-31-e-portal2.md; review docs/reviews/v0.54.md R55-05/-06/-07/-08).
// A new default world (seed 53, Kreativ), 1280 × 720, de-DE.
//   TAG=before  only the pictures (every film shot, the star map) and the film's cost grid — for the base build
//   (default)   the pictures (p2_<shot>_after.png …), the film's cost High vs Very Low (the preset switched, the 3-D
//               shots included), the star map's first frame (centre luma sd, labels), a real trip Herzwelt → Opal
//               skipped by Space at 3 s (the film ends ≤ 1.5 s after the land is there), a gamepad skip, the reveal's
//               luma sd, fast flight ×1 / ×8 after the film's end (hs ×8 ≥ 1.8 × ×1), ×1 as a host
// → .tmp_tests/portal2_<tag>.json.   usage: nohup bash test/wt_run.sh portal2.mjs 3600 > .tmp_tests/portal2.log 2>&1 &
// regress: skip  (a showcase: the pictures are the evidence; the rules are test/portal2.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import { execFileSync } from 'child_process';
const ROOT = new URL('../', import.meta.url).pathname.replace(/\.tmp_tests\/$/, '');
const TAG = process.env.TAG || 'after', BEFORE = TAG === 'before';
const DIST = process.env.DIST || 'file://' + ROOT + 'dist/index.html';
const SHOTS = ROOT + 'test/shots/';
fs.mkdirSync(SHOTS, { recursive: true });
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const rec = { tag: TAG };
const save = () => { try { fs.writeFileSync(ROOT + '.tmp_tests/portal2_' + TAG + '.json', JSON.stringify(rec, null, 1)); } catch (e) { /* convenience */ } };
// the luma of a picture's centre (the middle 60 % × 60 %): mean and sd (PIL)
const luma = (p, box) => { try { return JSON.parse(execFileSync('python3', ['-c', `import sys,json
from PIL import Image, ImageStat
im=Image.open(sys.argv[1]).convert('L'); w,h=im.size; b=json.loads(sys.argv[2])
c=im.crop((int(w*b[0]),int(h*b[1]),int(w*b[2]),int(h*b[3]))); s=ImageStat.Stat(c); print(json.dumps({'mean':round(s.mean[0],1),'sd':round(s.stddev[0],1)}))`, p, JSON.stringify(box || [0.2, 0.2, 0.8, 0.8])]).toString()); } catch (e) { return { mean: -1, sd: -1 }; } };
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
const page = await ctx.newPage();
const logs = [];
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 800)));
page.on('console', m => { if (m.type() === 'error') logs.push('[error] ' + m.text().slice(0, 300)); });
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, a) => page.evaluate(fn, a);
const shot = async (name) => { await ev(() => { window.__norender = true; }); await wait(300); try { await page.screenshot({ path: SHOTS + name, timeout: 240000 }); } catch (e) { console.log('  (no picture ' + name + ': ' + e.message.slice(0, 80) + ')'); } await ev(() => { window.__norender = false; }); return SHOTS + name; };
await page.goto(DIST);
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const r = VR.game.renderer; r._render = r.render; r.render = function (F) { if (window.__norender) return; return this._render(F); }; });
await ev(() => { const g = VR.game; g.applyPreset('high'); g.settings.renderDist = 6; g.settings.dynRes = false; g.applySettings('*'); });
await ev(() => VR.game.createWorld({ name: 'Portal2', mode: 'creative', difficulty: 'peaceful', type: 'default', seed: '53', cheats: true, kit: true }));
for (let i = 0; i < 180; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
check(await ev(() => VR.game.state) === 'play', 'the world plays');
await ev(() => { const g = VR.game; g.zenFreezeTime = true; if (g.env) { g.env.rain = 0; g.env.rainTarget = 0; } const h = document.getElementById('hints'); if (h) h.style.display = 'none'; });
await wait(6000);

// ---------------------------------------------------------------- the films (dry: the film only), every shot
const stn = await ev(() => { const S = VR.Stations; return S && S.IDS && S.IDS.length ? S.LIST[S.IDS[0]].dim : null; });
const filmWith = (o) => ev((o) => { const C = VR.PortalCore; for (let s = 1; s < 600; s++) { const F = C.film(C.rec({}), s, o.from, o.to, { low: !!o.low }); if (o.need.every(n => F.shots.some(q => q.id === n))) return F; } return null; }, o);
const at = (F, id, k) => { let t = 0; for (const s of F.shots) { if (s.id === id) return t + s.dur * k; t += s.dur; } return 0; };
if (!BEFORE) {   // the space textures the film's 3-D shots read (the picker asks for them when it opens)
  await ev(() => VR.Portal.prewarm && VR.Portal.prewarm(VR.game));
  for (let i = 0; i < 90; i++) { await wait(1000); if (await ev(() => VR.Portal.spaceReady && VR.Portal.spaceReady(VR.game))) { rec.texS = i + 1; break; } }
  check(!!rec.texS, 'the space textures are there for the film (' + rec.texS + ' s)');
}
async function filmShot(dest, F, id, k, name) {
  await ev(([d, F]) => VR.Portal.go(VR.game, d, { dry: true, film: F }), [dest, F]);
  await wait(200);
  const sh = await ev((t) => VR.Portal.seek(t), at(F, id, k));
  await wait(BEFORE ? 250 : 2500);   // (a 3-D shot: a few SwiftShader frames)
  const p = await shot(name);
  const gl = await ev(() => VR.Portal.stats().film && VR.Portal.stats().film.gl);
  await ev(() => VR.Portal.cancel());
  await wait(100);
  return { sh, p, gl, l: luma(p) };
}
const F1 = await filmWith({ from: 'overworld', to: 'opal', need: ['clouds', 'curve', 'ring', 'moon'] }) || await filmWith({ from: 'overworld', to: 'opal', need: ['clouds', 'curve', 'moon'] });
const F2 = await filmWith({ from: 'overworld', to: 'x.2.1.1', need: ['tunnel'] });
const F3 = stn ? await filmWith({ from: 'overworld', to: stn, need: ['station'] }) : null;
const F4 = await filmWith({ from: 'overworld', to: 'zinn', need: ['moon'] });
const want = [['swallow', F1, 'opal', 0.55], ['clouds', F1, 'opal', 0.3], ['curve', F1, 'opal', 0.75], ['ring', F1, 'opal', 0.5], ['moon', F1, 'opal', 0.8], ['arrive', F1, 'opal', 0.55], ['tunnel', F2, 'x.2.1.1', 0.6], ['station', F3, stn, 0.7], ['zinn', F4, 'zinn', 0.8]];
rec.shots = {};
for (const [id, F, to, k] of want) {
  if (!F) { console.log('  (no film with ' + id + ')'); continue; }
  const sid = id === 'zinn' ? 'moon' : id;
  if (!F.shots.some(s => s.id === sid)) { console.log('  (film ' + F.id + ' has no ' + sid + ')'); continue; }
  const r = await filmShot({ dim: to }, F, sid, k, 'p2_' + id + '_' + TAG + '.png');
  rec.shots[id] = { film: F.id, shot: r.sh, gl: r.gl, luma: r.l };
  console.log('  ' + id + ': ' + JSON.stringify(rec.shots[id]));
  if (!BEFORE && ['curve', 'ring', 'moon', 'zinn', 'arrive'].includes(id)) check(r.gl === true && r.l.sd > 12, id + ': drawn by the space renderer (' + r.gl + '), centre sd ' + r.l.sd);
}
save();

// ---------------------------------------------------------------- the film's cost: High and Very Low (the preset itself)
async function bench(preset) {
  await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.renderDist = 6; g.settings.dynRes = false; g.applySettings('*'); }, preset);
  await wait(3000);
  if (!BEFORE) { for (let i = 0; i < 60; i++) { if (await ev(() => VR.Portal.spaceReady(VR.game))) break; await wait(1000); } }
  return ev(([F, lo]) => VR.Portal.bench(F, 40, lo), [F1, preset === 'potato']);
}
rec.film_high = await bench('high');
rec.film_potato = await bench('potato');
rec.film_high2 = await bench('high');
console.log('  film ms a frame: High ' + rec.film_high.toFixed(1) + ' / ' + rec.film_high2.toFixed(1) + ' · Very Low ' + rec.film_potato.toFixed(1));
if (!BEFORE) check(rec.film_potato <= Math.min(rec.film_high, rec.film_high2), 'Very Low draws the film no dearer than High');
if (BEFORE) {   // the 2-D canvas alone at its sizes and particle counts: where Very Low's cost comes from
  rec.grid = await ev((F) => {
    const out = {}, PF = VR.PortalFilm;
    for (const sc of [0.4, 0.55, 0.75]) for (const lo of [false, true]) {
      const c = document.createElement('canvas'); c.width = Math.round(innerWidth * sc); c.height = Math.round(innerHeight * sc);
      const x = c.getContext('2d'), P = PF.make(Object.assign({}, F, { low: lo }), ['#ffe0b0', '#a0a8c0', '#202438'], ['#9ad0ff', '#4f8a3c', '#10203a'], { to: 'opal', from: 'overworld', kind: 'moon' });
      P.draw(x, c.width, c.height, 0.5); const t0 = performance.now(); for (let i = 0; i < 30; i++) P.draw(x, c.width, c.height, (i + 0.5) / 30 * P.len); x.getImageData(0, 0, 1, 1);
      out[sc + (lo ? 'L' : 'H')] = +((performance.now() - t0) / 30).toFixed(1);
    }
    return out;
  }, F1);
  console.log('  2-D grid ms: ' + JSON.stringify(rec.grid));
}
save();

if (!BEFORE) {
  // -------------------------------------------------------------- a real trip Herzwelt → Opal, skipped at 3 s
  await ev(() => { const g = VR.game; if (g.ui.screen) g.ui.resume(); });
  const t0 = Date.now();
  await ev(() => VR.Portal.go(VR.game, { dim: 'opal', id: 'w:opal' }));
  let skipT = null, landT = null, endT = null, capShot = null;
  for (let i = 0; i < 400; i++) {
    await wait(250);
    const s = await ev(() => ({ f: VR.Portal.stats().film, dim: VR.game.dim, state: VR.game.state, busy: VR.Travel.busy(VR.game) }));
    const el = (Date.now() - t0) / 1000;
    if (!skipT && s.f && s.f.t >= 3) { await page.keyboard.press('Space'); skipT = el; }
    if (!landT && s.f && s.f.arrived) landT = el;
    if (s.f && s.f.phase === 'reveal' && !capShot) { await wait(1500); capShot = await shot('p2_reveal_after.png'); }
    if (!s.f && s.dim === 'opal' && s.state === 'play') { endT = el; break; }
    if (i % 40 === 0) console.log('    ' + el.toFixed(0) + ' s ' + JSON.stringify({ f: s.f && { t: s.f.t, ph: s.f.phase, arr: s.f.arrived, sk: s.f.skip }, dim: s.dim, busy: s.busy }));
  }
  rec.trip = { skipT, landT, endT, last: await ev(() => VR.Portal.last) };
  check(rec.trip.endT && rec.trip.last && rec.trip.last.skipped, 'the trip to Opal, skipped by Space at ' + skipT + ' s: land ' + landT + ' s, the film gone ' + endT + ' s');
  check(landT && endT && endT - Math.max(landT, skipT) < 6.5, 'after the skip the film waits only for the land (' + (endT - Math.max(landT || 0, skipT || 0)).toFixed(1) + ' s incl. the 3.2 s reveal)');
  if (capShot) { rec.reveal = luma(capShot, [0, 0.1, 1, 0.9]); check(rec.reveal.sd > 30, 'the reveal: luma sd ' + rec.reveal.sd + ' > 30 (mean ' + rec.reveal.mean + ')'); }
  rec.revealTime = await ev(() => ({ ticks: VR.game.env && VR.game.env.ticks, best: VR.Portal.last && VR.Portal.last.hour }));
  save();
  await wait(4000);
  // -------------------------------------------------------------- the trip home, skipped by a gamepad's A
  await ev(() => { window.__pad = { b: false }; navigator.getGamepads = () => [{ id: 'test pad', connected: true, index: 0, buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: i === 0 && window.__pad.b, value: i === 0 && window.__pad.b ? 1 : 0 })), axes: [0, 0, 0, 0] }]; });
  const t1 = Date.now();
  await ev(() => VR.Portal.go(VR.game, { dim: 'overworld', id: 'w:overworld' }));
  let padT = null, home = null;
  for (let i = 0; i < 400; i++) {
    await wait(250);
    const s = await ev(() => ({ f: VR.Portal.stats().film, dim: VR.game.dim, state: VR.game.state }));
    if (!padT && s.f && s.f.t >= 2.5) { await ev(() => { window.__pad.b = true; }); await wait(300); await ev(() => { window.__pad.b = false; }); padT = (Date.now() - t1) / 1000; }
    if (!s.f && s.dim === 'overworld' && s.state === 'play') { home = (Date.now() - t1) / 1000; break; }
  }
  rec.pad = { padT, home, skipped: await ev(() => VR.Portal.last && VR.Portal.last.skipped) };
  check(!!home && rec.pad.skipped, 'home again, skipped by the gamepad\'s A (' + padT + ' s → ' + home + ' s)');
  save();
  // -------------------------------------------------------------- fast flight ×1 / ×8 once the film is gone and the land is there
  for (let i = 0; i < 60; i++) { await wait(1000); const ok = await ev(() => { const g = VR.game; return !VR.Portal.stats().film && g.state === 'play' && !VR.Travel.busy(g) && !(g.world && g.world.pending && g.world.pending.size > 40); }); if (ok) break; }
  await wait(3000);
  async function fly(mul, name) {
    await ev((m) => { const g = VR.game, p = g.player; g.settings.flyFast = m; p.flying = true; p.pitch = -0.05; p.pos[1] = Math.max(p.pos[1], 110); g.input.captured = true; if (g.ui.screen) g.ui.resume(); g.input.keys.add('KeyW'); g.input.keys.add('ControlLeft'); }, mul);
    let best = { hs: 0 };
    for (let i = 0; i < 6; i++) { await wait(700); const r = await ev(() => { const p = VR.game.player; return { flySpeed: p.flySpeed, hs: Math.hypot(p.vel[0], p.vel[2]), fly: VR.Portal.fly(), film: !!VR.Portal.stats().film, ctx: VR.Portal.ctx(VR.game), sprint: p.sprinting }; }); if (r.hs >= best.hs) best = r; }
    await shot(name);
    await ev(() => { const g = VR.game; g.input.keys.delete('KeyW'); g.input.keys.delete('ControlLeft'); });
    await wait(800);
    return best;
  }
  rec.fly1 = await fly(1, 'p2_fly_x1_after.png');
  rec.fly8 = await fly(8, 'p2_fly_x8_after.png');
  console.log('  fly ×1 ' + JSON.stringify(rec.fly1) + ' · ×8 ' + JSON.stringify(rec.fly8));
  check(!rec.fly8.film && rec.fly8.hs >= rec.fly1.hs * 1.8 && rec.fly1.hs > 1, 'Kreativ ×8: hs ' + rec.fly8.hs.toFixed(1) + ' ≥ 1.8 × ×1 ' + rec.fly1.hs.toFixed(1) + ', no film in the frame');
  rec.flyMp = await ev(() => { const g = VR.game, mp = g.mp, was = mp.role; mp.role = 'host'; g.settings.flyFast = 8; g.playFrame(0.016); const v = g.player.flySpeed; mp.role = was; return v; });
  check(rec.flyMp === 1, 'as a multiplayer host: ×1 (' + rec.flyMp + ')');
}
// (last: in the base build the page hung once the map was open)
// ---------------------------------------------------------------- the star map (O) for a new player: its first frame
{
  const t0 = Date.now();
  const evT = (fn, ms) => Promise.race([ev(fn), new Promise((r) => setTimeout(() => r('timeout'), ms))]);
  await ev(() => { const g = VR.game; if (g.ui.screen) g.ui.resume(); });
  const op = await evT(() => { window.__norender = true; const t = performance.now(); VR.StarMap.open(VR.game); return performance.now() - t; }, 120000);
  console.log('  star map open: ' + (typeof op === 'number' ? op.toFixed(0) + ' ms' : op));
  rec.mapOpenMs = Date.now() - t0;
  // the map's own canvas, as it is right after the open (a page picture can wait long on a held frame: run 1 timed out)
  const durl = await evT(() => { const c = document.getElementById('smCv'); return c ? c.toDataURL('image/png') : null; }, 120000);
  if (durl && durl !== 'timeout') fs.writeFileSync(SHOTS + 'p2_starmap_' + TAG + '.png', Buffer.from(durl.split(',')[1], 'base64'));
  try { await page.screenshot({ path: SHOTS + 'p2_starmap_page_' + TAG + '.png', timeout: 60000 }); } catch (e) { console.log('  (no page picture of the map: ' + e.message.slice(0, 60) + ')'); }
  rec.mapMs = Date.now() - t0;
  rec.map = Object.assign(luma(SHOTS + 'p2_starmap_' + TAG + '.png', [0.3, 0.2, 0.7, 0.8]), { st: await evT(() => VR.StarMap.stats(), 60000) });
  await evT(() => { VR.StarMap.close(VR.game); window.__norender = false; }, 60000);
  console.log('  star map: ' + JSON.stringify(rec.map));
  if (!BEFORE) check(rec.map.sd > 15 && (rec.map.st.labels || 0) >= 20, 'the star map\'s first frame: centre luma sd ' + rec.map.sd + ' > 15, ' + (rec.map.st && rec.map.st.labels) + ' labels ≥ 20');
}
save();

save();
const errs = logs.filter(l => l.startsWith('[pageerror]'));
check(errs.length === 0, 'no page error' + (errs.length ? ': ' + errs[0] : ''));
if (logs.length) console.log('  logs: ' + logs.slice(0, 4).join(' | '));
save();
if (!BEFORE) try {
  const p = (n, t) => SHOTS + 'p2_' + n + '_' + t + '.png', ex = (f) => fs.existsSync(f);
  const rows = [];
  for (const [id, lab] of [['swallow', 'Das Tor verschluckt dich'], ['clouds', 'Durch die Wolken'], ['curve', 'Die Krümmung der Herzwelt'], ['ring', 'Amarants Ring und sein Schatten'], ['moon', 'Opal schwillt an, Amarant dahinter'], ['zinn', 'Zinnober schwillt an, Amarant dahinter'], ['station', 'Die Station'], ['tunnel', 'Der Sternensprung-Tunnel'], ['arrive', 'Ankunft im Licht des Ziels'], ['starmap', 'Die Sternkarte (O), erstes Bild']]) {
    const imgs = [p(id, 'before'), p(id, 'after')].filter(ex); if (imgs.length) rows.push({ label: lab + ' — vorher · nachher', imgs });
  }
  const tail = [p('reveal', 'after'), p('fly_x8', 'after')].filter(ex); if (tail.length) rows.push({ label: 'Die Enthüllung zur besten Stunde · Kreativ-Flug ×8', imgs: tail });
  fs.writeFileSync(ROOT + '.tmp_tests/portal2_sheet.json', JSON.stringify({ w: 620, rows }));
  execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + 'portal2_sheet.jpg', ROOT + '.tmp_tests/portal2_sheet.json']);
  console.log('  sheet: ' + SHOTS + 'portal2_sheet.jpg');
} catch (e) { console.log('  (no sheet: ' + e.message.slice(0, 200) + ')'); }
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

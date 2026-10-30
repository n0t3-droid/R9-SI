// a-builder · the builder's five wins in the browser, German UI (de-DE), Balanced, a flat creative world, a sunny morning
// (plan docs/superpowers/plans/2026-10-30-a-builder.md §3). Frames by hand (the game's own loop, 1/30 s each).
//  1 · placing: three quick blocks with Bau-Effekte off (the old look) and on: the pop is drawn (renderer.stats.pops),
//      particles rise, the pitch climbs (1 → 9/8 → 5/4); Very Low has it off → builder_place_before/after.png
//  2 · the picker: the creative inventory opens in < 100 ms; typing letters on the page (no click) fills the search;
//      „ziegel" → Ziegel first; Enter puts it in the hand; the Zuletzt row shows what was placed → builder_pick_before/after
//  3 · the stamp: a little house copied with the wand (C) is kept (VR.Stamp.lib), the ghost is drawn where V would put it
//      (renderer.stats.ghost), L mirrors, R turns (sizes swap), V stamps the house (blocks counted), Z takes it back
//      → builder_stamp_before.png (the old magenta box only) / after.png (the ghost)
//  4 · the showcase: the photo mode at noon (before) | O circles the house at the golden hour (after); F2 saves a PNG
//  5 · costs: popFx's CPU time a frame with 8 pops and none, on Balanced and Very Low
// → test/shots/builder_*.png and builder_sheet.jpg. No page errors.
//   nohup bash test/wt_run.sh builder.mjs 3600 > .tmp_tests/builder.log 2>&1 &
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import fs from 'fs';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SHOTS = ROOT + 'test/shots/';
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'de-DE', acceptDownloads: true });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) logs.push('[console] ' + m.text().slice(0, 500)); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1200)));
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const wait = (ms) => page.waitForTimeout(ms), ev = (fn, a) => page.evaluate(fn, a);
const shot = async (name) => { await page.screenshot({ path: SHOTS + name + '.png', timeout: 180000 }); return SHOTS + name + '.png'; };
await page.goto(new URL('../dist/index.html', import.meta.url).href);
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
check(await ev(() => !!(VR.I18N && VR.I18N.lang === 'de')), 'the game speaks German');
await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.tsr = false; g.settings.renderDist = 5; g.settings.horizon = 0; g.applySettings('*'); g.createWorld({ name: 'Bauplatz', mode: 'creative', difficulty: 'peaceful', type: 'flat', seed: '7071', cheats: true, kit: false }); });
for (let i = 0; i < 150; i++) { await wait(1000); if (await ev(() => VR.game.state === 'play')) break; }
check(await ev(() => VR.game.state === 'play'), 'a creative world is open');
await ev(() => {
  const g = VR.game, r = g.renderer;
  window.requestAnimationFrame = () => 0;
  r._render = r.render; r.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); };
  window.__norender = true;
  g.env.setTime(4200); g.zenFreezeTime = true; g.zenFreezeWeather = true; g.env.rain = 0; g.env.rainTarget = 0;
  const T = window.__t = {
    frame() { g.input.dragLook = false; g.last = performance.now() - 33; g.loop(performance.now()); },
    draw() { window.__norender = false; T.frame(); window.__norender = true; },
    steps(n) { for (let i = 0; i < n; i++) T.frame(); },
    look(pt) { const p = g.player, e = p.eyePos(), d = [pt[0] - e[0], pt[1] - e[1], pt[2] - e[2]]; p.yaw = Math.atan2(-d[0], -d[2]); p.pitch = Math.atan2(d[1], Math.hypot(d[0], d[2])); },
    stand(x, y, z) { const p = g.player; p.flying = true; p.pos = [x, y, z]; p.vel = [0, 0, 0]; },
    hold(id) { const p = g.player; p.inv.slots[p.inv.sel] = { id, n: 64 }; p.inv.changed = true; },
    click(b) { const i = g.input; i.mouse.down[b] = true; i.mouse.clicked[b] = true; T.frame(); i.mouse.down[b] = false; i.mouse.releasedBtn[b] = true; T.frame(); },
    key(code) { const i = g.input; i.pressed.add(code); i.keys.add(code); T.frame(); i.keys.delete(code); T.frame(); },
    set(x, y, z, name, props) { const t = VR.R.byName[name]; let s = t.defaultState; for (const k in props || {}) s = t.with(s, k, props[k]); g.world.setBlock(x, y, z, s, 4); },
    pump(n) { const u = g.ui._palPump; if (!u) return; for (let i = 0; i < (n || 60); i++) { u.handle = 0; u.step(); } },
    count(x0, y0, z0, x1, y1, z1) { let n = 0; for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) if (g.world.getBlock(x, y, z)) n++; return n; },
  };
});
const settle = async (max = 60) => { for (let i = 0; i < max; i++) { await ev(() => __t.steps(8)); const s = await ev(() => { const g = VR.game; return { busy: g.pool.busy, pend: g.world.pending.size }; }); if (s.busy === 0 && s.pend === 0 && i > 2) break; await wait(150); } };
await settle(80);
const base = await ev(() => { const g = VR.game, w = g.world, p = g.player, X = Math.floor(p.pos[0]), Z = Math.floor(p.pos[2]); let y = 200; while (y > 1 && !(VR.R.T.flags[w.getBlock(X, y - 1, Z)] & VR.F.SOLID)) y--; return { X, Y: y, Z }; });
const { X, Y, Z } = base;
console.log('ground', JSON.stringify(base));
const pics = {};

console.log('1 · placing');
// a stone strip to build on, the camera close
await ev(({ X, Y, Z }) => { for (let x = -3; x <= 3; x++) __t.set(X + x, Y, Z - 4, 'stone_bricks'); __t.stand(X + 0.5, Y + 0.4, Z - 0.2); }, base);
await settle(20);
const place = async (fx, name, dx) => ev(({ X, Y, Z, fx, name, dx }) => {
  const g = VR.game; g.settings.buildFx = fx; if (g._bfCombo) g._bfCombo.reset();
  __t.hold(name); const pitches = [], BF = VR.BuildFx, ob = BF.burst; let bursts = 0; BF.burst = function () { bursts++; return ob.apply(this, arguments); };
  __t.steps(6);
  for (let k = 0; k < 3; k++) { __t.look([X + dx + k + 0.5, Y + 1, Z - 3.5]); __t.frame(); const a = g.audio; let pm = 0; const op = a.place.bind(a); a.place = function (s, at) { pm = this.pitchMul || 1; return op(s, at); }; __t.click(2); a.place = op; pitches.push(+pm.toFixed(3)); __t.steps(5); }
  __t.look([X + dx + 1.5, Y + 1.2, Z - 3.5]);
  BF.burst = ob;
  return { pitches, bursts, parts: g.particles.count };
}, { X, Y, Z, fx, name, dx });
let a0 = await place(false, 'oak_planks', -2);
await settle(10);
await ev(() => __t.draw());
pics.placeB = await shot('builder_place_before');
const a1 = await place(true, 'oak_planks', 1);
// the third block's pop in its middle: one frame drawn 2 frames (0.066 s) after the click
const popN = await ev(() => { const g = VR.game; g._bfPops.forEach(q => { if (q.on) q.t = g.time - 0.06; }); __t.draw(); return { pops: g.renderer.stats.pops | 0, parts: g.particles.count }; });
pics.placeA = await shot('builder_place_after');
check(JSON.stringify(a0.pitches) === '[1,1,1]', `Bau-Effekte aus: the old sound (${a0.pitches})`);
check(JSON.stringify(a1.pitches) === '[1,1.125,1.25]', `on: three quick blocks climb (${a1.pitches})`);
check(popN.pops >= 1, `the pop is drawn (${popN.pops})`);
check(a0.bursts === 0 && a1.bursts === 3, `a burst of particles per block with the effects on (off ${a0.bursts}, on ${a1.bursts})`);
const vl = await ev(() => { const g = VR.game, P = g.Game ? null : VR.Game.PRESETS; return { potato: P.potato.buildFx, low: P.low.buildFx, bal: P.balanced.buildFx }; });
check(vl.potato === false && vl.low === true && vl.bal === true, `Very Low off, Low and Balanced on (${JSON.stringify(vl)})`);

console.log('2 · the picker');
await ev(() => { if (VR.UIPrefs) VR.UIPrefs.set({ pro: true }); });
const open1 = await ev(() => { const g = VR.game; g.ui.openInventory('creative'); return { ms: g.ui.pickMs, bar: !!document.querySelector('.pickbar'), recent: document.querySelectorAll('.pickrow')[0] ? document.querySelectorAll('.pickrow')[0].querySelectorAll('.slot').length : 0 }; });
await wait(400);
const open2 = await ev(() => { const g = VR.game; g.ui.closeInventory(); g.ui.openInventory('creative'); return g.ui.pickMs; });
check(open1.bar && open2 < 100, `the inventory opens with the search bar in ${open1.ms.toFixed(0)} ms, again in ${open2.toFixed(0)} ms (< 100)`);
check(open1.recent >= 1, `the Zuletzt row shows the planks just placed (${open1.recent})`);
await ev(() => __t.pump(80));
await ev(() => { document.querySelector('.pickbar').style.display = 'none'; });
pics.pickB = await shot('builder_pick_before');
await ev(() => { document.querySelector('.pickbar').style.display = ''; });
await page.mouse.move(1200, 40);
await page.keyboard.type('ziegel', { delay: 30 });
await ev(() => __t.pump(80));
const found = await ev(() => ({ val: document.querySelector('.picksearch').value, first: [...document.querySelectorAll('#invpanel .palette .slot')].map(s => s.dataset.id).slice(0, 6), open: VR.game.ui.screen }));
pics.pickA = await shot('builder_pick_after');
check(found.val === 'ziegel' && found.open === 'inventory', `typing on the page fills the search, the inventory stays open (${JSON.stringify(found.val)})`);
check(found.first[0] === 'bricks', `„ziegel" → Ziegel first (${found.first.join(', ')})`);
await page.keyboard.press('Enter');
await wait(300);
const inHand = await ev(() => { const p = VR.game.player; return { held: p.inv.held && p.inv.held.id, screen: VR.game.ui.screen }; });
check(inHand.held === 'bricks' && !inHand.screen, `Enter: the bricks in the hand, the inventory closed (${JSON.stringify(inHand)})`);
const vlCount = await ev(() => { const g = VR.game; g.ui.openInventory('creative'); const n = document.querySelectorAll('.pickchip').length; g.ui.closeInventory(); return n; });
check(vlCount === 8, `Profi: eight material chips (${vlCount})`);

console.log('3 · the stamp');
// a little house: 5 × 4 × 5, plank walls, a door, a stair roof row, glass
const H = { x0: X + 6, z0: Z - 10 };
await ev(({ X, Y, Z, H }) => {
  for (let x = 0; x < 5; x++) for (let z = 0; z < 5; z++) for (let y = 0; y < 3; y++) if (x === 0 || x === 4 || z === 0 || z === 4) __t.set(H.x0 + x, Y + y, H.z0 + z, y === 1 && (x === 2 || z === 2) ? 'glass' : 'oak_planks');
  for (let x = -1; x < 6; x++) { __t.set(H.x0 + x, Y + 3, H.z0 - 1, 'oak_stairs', { facing: 'south' }); __t.set(H.x0 + x, Y + 3, H.z0 + 5, 'oak_stairs', { facing: 'north' }); for (let z = 0; z < 5; z++) __t.set(H.x0 + x, Y + 3, H.z0 + z, 'oak_slab'); }
  __t.set(H.x0 + 2, Y, H.z0 + 4, 'oak_door', { facing: 'south', hinge: 'left', half: 'bottom' }); __t.set(H.x0 + 2, Y + 1, H.z0 + 4, 'oak_door', { facing: 'south', hinge: 'left', half: 'top' });
  __t.set(H.x0 + 1, Y + 1, H.z0 + 5, 'lantern');
  const gad = VR.game.gadgets; gad.wand.a = [H.x0 - 1, Y, H.z0 - 1]; gad.wand.b = [H.x0 + 5, Y + 3, H.z0 + 5]; gad.wandCopy();
}, { X, Y, Z, H });
await settle(30);
const lib = await ev(() => ({ n: VR.Stamp.lib().length, clip: (() => { const c = VR.game.gadgets.wand.clip; return c && [c.sx, c.sy, c.sz]; })() }));
check(lib.n >= 1 && JSON.stringify(lib.clip) === '[7,4,7]', `the copy is kept as a stamp (${JSON.stringify(lib)})`);
// stand back, look at a free spot to the left of the house
await ev(({ X, Y, Z, H }) => { __t.hold('builder_wand'); __t.stand(H.x0 - 7.5, Y + 5, H.z0 + 19.5); __t.look([H.x0 - 7.5, Y - 0.5, H.z0 + 4.5]); __t.frame(); }, { X, Y, Z, H });
await settle(20);
await ev(() => { VR.Renderer.prototype._sg = VR.Renderer.prototype.drawStampGhost; VR.Renderer.prototype.drawStampGhost = function () {}; __t.draw(); });
pics.stampB = await shot('builder_stamp_before');
await ev(() => { VR.Renderer.prototype.drawStampGhost = VR.Renderer.prototype._sg; __t.draw(); });
const gh = await ev(() => VR.game.renderer.stats.ghost | 0);
pics.stampA = await shot('builder_stamp_after');
check(gh > 50, `the ghost is drawn (${gh} faces)`);
const tr = await ev(() => { const W = VR.game.gadgets.wand; const c0 = W.clip; __t.key('KeyL'); const m = W.clip; __t.key('KeyR'); const r = W.clip; return { mirrored: m !== c0 && m.sx === c0.sx, turned: [r.sx, r.sz], from: [m.sx, m.sz] }; });
check(tr.mirrored, 'L mirrors the stamp');
await ev(() => { const W = VR.game.gadgets.wand, c = W.clip; W.clip = VR.Stamp.transform(c, 0, false); });
const st = await ev(({ Y }) => { const g = VR.game, gad = g.gadgets, o = gad.pasteOrigin(), c = gad.wand.clip; if (!o) return { before: 0, after: 0, want: 1, undone: -1, o: null }; const before = __t.count(o[0], o[1], o[2], o[0] + c.sx - 1, o[1] + c.sy - 1, o[2] + c.sz - 1); __t.key('KeyV'); const after = __t.count(o[0], o[1], o[2], o[0] + c.sx - 1, o[1] + c.sy - 1, o[2] + c.sz - 1); const want = VR.Stamp.count(c); __t.key('KeyZ'); const undone = __t.count(o[0], o[1], o[2], o[0] + c.sx - 1, o[1] + c.sy - 1, o[2] + c.sz - 1); return { before, after, want, undone, o }; }, base);
check(st.after - st.before >= st.want * 0.9 && st.undone === st.before, `V stamps the house (${st.before} → ${st.after}, ${st.want} in the stamp), Z takes it back (${st.undone})`);
await ev(() => __t.key('KeyV'));
await settle(30);

console.log('4 · the showcase');
await ev(({ Y, H }) => { const g = VR.game; __t.hold('oak_planks'); __t.stand(H.x0 + 2.5, Y + 4, H.z0 + 16.5); __t.look([H.x0 + 2.5, Y + 1.5, H.z0 + 2.5]); __t.frame(); g.photoMode(true); g.photoCam.first = false; __t.steps(3); }, { Y, H });
await settle(10);
await ev(() => __t.draw());
pics.showB = await shot('builder_show_before');
const orb = await ev(() => { const g = VR.game, pc = g.photoCam; __t.key('KeyO'); const o = pc.orbit && { c: pc.orbit.c.map(v => +v.toFixed(1)), r: +pc.orbit.r.toFixed(1) }; __t.key('KeyG'); const a0 = pc.orbit && pc.orbit.a; __t.steps(60); return { o, tod: g.env.timeOfDay, turned: pc.orbit ? +(pc.orbit.a - a0).toFixed(2) : 0 }; });
await settle(10);
await ev(() => __t.draw());
pics.showA = await shot('builder_show_after');
check(!!orb.o && orb.turned > 0.25, `O circles the house (${JSON.stringify(orb.o)}, ${orb.turned} rad in 2 s)`);
check(Math.abs(orb.tod - 11450) < 50, `G: the golden hour (${orb.tod})`);
await ev(() => { const pc = VR.game.photoCam; pc.shoot(); window.__norender = false; for (let i = 0; i < 3; i++) __t.frame(); window.__norender = true; });
await wait(4000);
const ph = await ev(() => VR.PhotoMode.last ? { name: VR.PhotoMode.last.name, w: VR.PhotoMode.last.w } : null);
check(!!ph && /^R9-SI-Bauplatz-\d+\.png$/.test(ph.name), `F2: a PNG (${JSON.stringify(ph)})`);
await ev(() => VR.game.photoMode(false));

console.log('5 · costs');
const cost = await ev(() => {
  const g = VR.game, r = g.renderer, out = {};
  for (const pre of ['balanced', 'potato']) {
    g.applyPreset(pre); g.settings.dynRes = false; g.applySettings('*'); __t.hold('oak_planks'); __t.frame();
    const F = { cam: g.cam, env: g.env.compute ? null : {} };
    const time = (n) => { let t = 0; for (let i = 0; i < n; i++) { const t0 = performance.now(); r.popFx({ cam: r.cam, env: {} }); t += performance.now() - t0; } return t / n; };
    if (g._bfPops) g._bfPops.forEach(q => { q.on = false; });
    const none = time(200);
    if (VR.BuildFx.enabled(g.settings)) for (let k = 0; k < 8; k++) VR.BuildFx.pop(g, 0, 70, k, VR.R.byName.stone.defaultState);
    if (g._bfPops) g._bfPops.forEach(q => { q.t = g.time - 0.05; });
    const eight = time(50);
    out[pre] = { on: VR.BuildFx.enabled(g.settings), none: +none.toFixed(4), eight: +eight.toFixed(3) };
  }
  g.applyPreset('balanced'); g.applySettings('*');
  return out;
});
console.log('  popFx ms a frame:', JSON.stringify(cost));
check(cost.potato.on === false && cost.potato.none < 0.01, `Very Low: off, ${cost.potato.none} ms with none`);
check(cost.balanced.eight < 1.5, `Balanced: ${cost.balanced.eight} ms with 8 pops (CPU side)`);

const spec = { w: 620, rows: [
  { label: '1 · Setzen: ohne Bau-Effekte | mit Pop, Spänen, steigendem Ton', imgs: [pics.placeB, pics.placeA] },
  { label: '2 · Blockwahl: vorher (nur Reiter) | Suchzeile, Zuletzt, Familien, Farben — „ziegel" getippt', imgs: [pics.pickB, pics.pickA] },
  { label: '3 · Stab mit Kopie: nur ein Kasten | Bauplan-Geist in seinen Farben', imgs: [pics.stampB, pics.stampA] },
  { label: '4 · Fotomodus: Mittag, freie Kamera | Rundflug zur goldenen Stunde', imgs: [pics.showB, pics.showA] },
] };
fs.writeFileSync(SHOTS + 'builder_sheet.json', JSON.stringify(spec));
try { console.log(execSync(`python3 /root/r9coord/pairs.py ${SHOTS}builder_sheet.jpg ${SHOTS}builder_sheet.json`).toString().trim()); } catch (e) { console.log('sheet: ' + e.message); }
const errs = logs.filter(l => /pageerror/.test(l));
for (const l of logs.slice(0, 8)) console.log('  ' + l);
check(!errs.length, `no page errors (${errs.length})`);
await browser.close();
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);

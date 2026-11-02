// f-ux · the pictures (docs/superpowers/plans/2026-11-02-f-ux.md): before (BASE=…/index.html, the v042 build) and after
// (this checkout's dist/) — a survival world (seed 4242, peaceful, de-DE, 960 × 540), live frames:
//   spawn (the HUD at spawn) · goal (a waypoint set 70 m ahead: the minimap's line before, the trail / signpost / rose
//   after) · vitals (health at 5 of 20, a hit) · book (the Wanderbuch, a page turned) · satchel (the inventory opening)
//   · radial (Tab held) — test/shots/ux_<before|after>_<id>.png; the costs VR.Diegetic and the frame time, Very Low and
//   High; the checks: no page errors, the after build's parts there (trail particles, the sign shown, the rose, the
//   vignette, the book's pages, the wheel's pick → its action).
//   usage: BASE=file:///…/.tmp_tests/base/dist/index.html nohup bash test/wt_run.sh ux_shots.mjs 3600 > .tmp_tests/ux_shots.log 2>&1 &
// regress: skip  (a picture run)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import sharp from '/home/dev/.npm-global/lib/node_modules/sharp/lib/index.js';
const ROOT = new URL('../', import.meta.url).pathname;
const SHOTS = ROOT + 'test/shots/';
const AFTER = process.env.DIST || 'file://' + ROOT + 'dist/index.html';
const BASE = process.env.BASE || 'file://' + ROOT + '.tmp_tests/base/dist/index.html';
fs.mkdirSync(SHOTS, { recursive: true });
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const out = { costs: {} };

async function run(tag, url) {
  console.log('--- ' + tag + ' (' + secs() + ')');
  const page = await browser.newPage({ viewport: { width: 960, height: 540 }, locale: 'de-DE' });
  const logs = [];
  page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 600)));
  await page.goto(url);
  const ev = (fn, arg) => page.evaluate(fn, arg), wait = (ms) => page.waitForTimeout(ms);
  const shot = async (id) => { const f = SHOTS + 'ux_' + tag + '_' + id + '.png'; await page.screenshot({ path: f }); console.log('  📷 ' + f); };
  for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => !!(window.VR && VR.game && VR.game.state === 'title'))) break; }
  await ev(() => VR.game.createWorld({ name: 'UX', mode: 'survival', difficulty: 'peaceful', type: 'default', seed: '4242', cheats: true, kit: true }));
  for (let i = 0; i < 240; i++) { await wait(500); if (await ev(() => VR.game.state) === 'play') break; }
  check(await ev(() => VR.game.state) === 'play', tag + ': in the world at ' + secs());
  if (await ev(() => VR.game.state) !== 'play') { await page.close(); return; }
  await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.renderDist = 5; g.settings.dynRes = false; g.applySettings('*'); g.env.setTime(5200); g.zenFreezeTime = true; if (g.env.wx && g.env.wx.force) g.env.wx.force('klar'); if (VR.Funke) g.settings.funke = true; });
  await wait(9000);
  // the HUD at spawn (a slot change just now: the hotbar shows in both builds)
  await ev(() => { const p = VR.game.player; p.inv.sel = (p.inv.sel + 1) % 9; p.inv.changed = true; });
  await wait(1200); await shot('spawn');
  // a goal: a waypoint 70 m ahead, a little to the right
  await ev(() => { const g = VR.game, p = g.player, fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw); const x = Math.floor(p.pos[0] + fx * 70 + rx * 18), z = Math.floor(p.pos[2] + fz * 70 + rz * 18); g.gadgets.addWaypoint(x, Math.floor(g.world.topAt(x, z) + 1), z, 'Aussichtspunkt'); p.pitch = -0.22; });
  await wait(5000); await shot('goal');
  if (tag === 'after') {
    const st = await ev(() => { const S = VR.Diegetic.state; return { goal: !!S.goal, pts: S.pts.length, sign: S.signShown, rose: !!S.roseOn, spawns: VR.Diegetic.cost.spawns, mini: getComputedStyle(document.getElementById('minimap')).display }; });
    console.log('  ' + JSON.stringify(st));
    check(st.goal && st.pts >= 8, 'after: the waypoint is the goal, the trail has ' + st.pts + ' steps');
    check(st.spawns >= 12, 'after: the trail glows (particles spawned ' + st.spawns + ')');
    check(st.sign, 'after: the signpost shows');
    check(st.rose && st.mini === 'none', 'after: the compass rose instead of the minimap');
  }
  const hold = (on) => ev((on) => { const r = VR.game.renderer; if (on && !r.__hold) { r.__hold = r.render; r.render = function () {}; } else if (!on && r.__hold) { r.render = r.__hold; r.__hold = null; } }, on);
  // vitals: low health, a hit
  // (peaceful heals fast: the health held low while the edge comes)
  for (let i = 0; i < 8; i++) { await ev((h) => { const p = VR.game.player; p.health = h; }, i < 7 ? 5 : 4); await wait(350); }
  await ev(() => { const st = document.createElement('style'); st.id = 'uxnotr'; st.textContent = '#dgvig{transition:none!important}'; document.head.appendChild(st); });
  await hold(true); for (let i = 0; i < 6; i++) { await ev(() => { VR.game.player.health = 4; }); await wait(500); }
  console.log('  vitals: ' + JSON.stringify(await ev(() => ({ hp: VR.game.player.health, vig: (document.getElementById('dgvig') || {}).style ? document.getElementById('dgvig').style.opacity : null, danger: document.getElementById('stats').className, body: document.body.className.slice(0, 80) }))));
  await shot('vitals');
  if (tag === 'after') {   // the edge is seen: the left strip with it and without it (mean brightness)
    const edge = async () => { const b = await page.screenshot(); const st = await sharp(b).extract({ left: 0, top: 120, width: 60, height: 300 }).stats(); return st.channels.slice(0, 3).reduce((a, c) => a + c.mean, 0) / 3; };
    const withE = await edge(); await ev(() => { document.getElementById('dgvig').style.visibility = 'hidden'; }); const without = await edge(); await ev(() => { document.getElementById('dgvig').style.visibility = ''; });
    check(withE < without * 0.85, `after: the edge darkens the screen's side (${withE.toFixed(1)} vs ${without.toFixed(1)} without)`);
  }
  await hold(false);
  if (tag === 'after') { const o = await ev(() => +getComputedStyle(document.getElementById('dgvig') || document.body).opacity); check(o > 0.2, 'after: the edge shows at 4 of 20 (' + o + ')'); }
  await ev(() => { const p = VR.game.player; p.health = 20; });
  await wait(1200);
  if (process.env.VITALS_ONLY !== '1') {
  // the book
  await ev((tag) => { const g = VR.game, W = VR.Wander, B = W.book(g.meta); for (const n of W.NAMES.slice(0, 6)) B.stickers[n] = 1; B.places['l:x1'] = 'Mühlbach'; B.places['l:x2'] = 'Birkenhain'; B.people.a = 'Ilse'; B.people.b = 'Tomek'; B.creatures.fox = 1; B.creatures.rabbit = 1; B.recipes.applecake = 1; if (tag === 'after') B.board = [[W.NAMES[0], 30, 40, -8], [W.NAMES[2], 62, 58, 12]]; W.open(g); }, tag);
  await hold(true); await wait(2500); await shot('book');
  if (tag === 'after') {
    const n = await ev(() => document.querySelectorAll('#wanderbuch .dgpage').length);
    check(n === 2, 'after: the book has two pages open (' + n + ')');
    await ev(() => VR.Diegetic.turn(VR.game, 1)); await wait(200); await shot('book_turn'); await wait(700); await shot('book2');
    await ev(() => { VR.Diegetic.turn(VR.game, 1); VR.Diegetic.turn(VR.game, 1); }); await wait(900); await shot('book3');
  }
  await ev(() => VR.Wander.close(VR.game)); await hold(false); await wait(400);
  // the satchel (the inventory, caught while it opens and open)
  await hold(true); await ev(() => VR.game.ui.openInventory());
  await wait(150); await shot('satchel_open'); await wait(900); await shot('satchel');
  await ev(() => VR.game.ui.closeInventory()); await hold(false); await wait(600);
  // the radial: Tab held, the mouse to the right
  if (tag === 'after') {
    await ev(() => { VR.Diegetic.radialOpen('key'); const I = VR.game.input; I.mouse.dx += 120; });
    await wait(1500); await hold(true); await wait(300); await shot('radial'); await hold(false);
    const sel = await ev(() => VR.Diegetic.R.sel);
    check(sel === 2, 'after: the mouse to the right picks the third (the book): ' + sel);
    await ev(() => VR.Diegetic.radialClose(true)); await wait(600);
    check(await ev(() => VR.game.ui.screen) === 'wanderbuch', 'after: releasing opens the picked one (the Wanderbuch)');
    await ev(() => VR.Wander.close(VR.game));
  } else { await shot('radial'); }
  // the costs: Very Low and High, 24 live frames each (SwiftShader on 2 CPUs: seconds a frame — the module's own ms is the measure)
  for (const pr of ['potato', 'high']) {
    await ev((pr) => { const g = VR.game; g.applyPreset(pr); g.settings.dynRes = false; g.applySettings('*'); if (VR.Diegetic) VR.Diegetic.resetCost(); }, pr);
    await wait(4000);
    const c = await ev(() => new Promise(res => { const g = VR.game; if (VR.Diegetic) VR.Diegetic.resetCost(); let n = 0; const t0 = performance.now(); const f = () => { if (++n >= 24) res({ frame: (performance.now() - t0) / n, dg: VR.Diegetic ? VR.Diegetic.costPerFrame() : 0, worst: VR.Diegetic ? VR.Diegetic.cost.worst : 0, spawns: VR.Diegetic ? VR.Diegetic.cost.spawns : 0 }); else requestAnimationFrame(f); }; requestAnimationFrame(f); }));
    out.costs[tag + '_' + pr] = c; console.log('  cost ' + pr + ' ' + JSON.stringify(c));
  }
  if (tag === 'after') check(out.costs.after_potato.spawns === 0, 'after: Very Low spawns no trail particles');
  }
  check(!logs.length, tag + ': no page errors' + (logs.length ? ' — ' + logs.slice(0, 3).join(' | ') : ''));
  await page.close();
}
if (process.env.SKIP_BEFORE !== '1') await run('before', BASE);
await run('after', AFTER);
fs.writeFileSync(ROOT + '.tmp_tests/ux_costs.json', JSON.stringify(out, null, 1));
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

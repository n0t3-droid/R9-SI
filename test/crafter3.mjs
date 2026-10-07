// v0.33 Crafter UI: the icon tool strip and the mouse legend instead of text, the paint tool (one piece / a whole
// surface / everything of a kind) with its glowing preview and the [old → new ×n] badge, hold-to-confirm for big
// changes (a quick click does nothing there), one undo for all of it, the help card, and painting in player mode.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--allow-file-access-from-files'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 } });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { if (m.type() === 'error' || /error|fail/i.test(m.text())) logs.push(m.text().slice(0, 400)); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 900)));
await page.goto('file:///home/claude/vr/dist/studio.html');
const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const shot = (n) => page.screenshot({ path: `/home/claude/vr/test/shots/${n}.png`, timeout: 180000 });
await ev(() => { try { localStorage.removeItem('r9si.studio'); } catch (e) { /* */ } });
for (let i = 0; i < 240; i++) { await wait(500); const s = await ev(() => ({ boot: document.getElementById('studio').classList.contains('boot'), houses: window.__studio ? window.__studio.HOUSE.size : -1 })); if (!s.boot && s.houses >= 2) break; }
await ev(() => window.__studio.selectHouse(0)); await wait(500);
await ev(() => window.__studioCore.setMode('craft'));
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => !!(VR.Crafter.house && VR.Crafter.gpu))) break; }
await wait(1500);
const view = await page.$('#view'), box = await view.boundingBox(), cx = box.x + box.width / 2, cy = box.y + box.height / 2;

console.log('1 · pictures instead of text');
const ui = await ev(() => ({ tools: document.querySelectorAll('#craftTools button').length, legend: !!document.querySelector('#craftLegend.on .mouse'), oldHelp: !!document.getElementById('craftHelp'), panel: document.getElementById('partsBody').innerText.replace(/\s+/g, ' ').trim() }));
console.log('   panel text:', JSON.stringify(ui.panel.slice(0, 160)), '(' + ui.panel.length + ' chars)');
check(ui.tools >= 5, 'tool strip with ' + ui.tools + ' icon buttons');
check(ui.legend, 'mouse legend shows what the buttons do');
check(!ui.oldHelp, 'the long help line is gone');
check(ui.panel.length < 260, 'the panel is short');
await shot('cr3_1_ui');

console.log('2 · paint a facade');
// look straight at the middle of the front wall
const wall = await ev(() => {
  const C = VR.Crafter, h = C.house, R = VR.R, T = R.T, F = VR.F;
  const zf = h.pad, cxl = h.pad + Math.floor(h.lot[0] / 2);
  let best = null;
  for (let y = h.F + 1; y < h.F + 8 && !best; y++) for (let dx = 0; dx < 12 && !best; dx++) for (const x of [cxl + dx, cxl - dx]) for (let z = zf; z < zf + 4 && !best; z++) {
    const s = C.gGet(x, y, z), n = C.gGet(x, y, z - 1);
    if (s && (T.flags[s] & F.OPAQUE) && !n) best = [x, y, z, R.types[T.type[s]].name];
  }
  const S = window.__st; S.scene.center = [best[0] + 0.5, best[1] + 0.5, best[2]]; S.cam.yaw = Math.PI; S.cam.pitch = 0.05; S.cam.dist = 11;
  C.hot[C.slot] = 'vollton_coral'; C.drawBar();
  return best;
});
console.log('   wall block', JSON.stringify(wall));
await page.keyboard.press('t'); await wait(300);
const t1 = await ev(() => ({ tool: VR.Crafter.tool, scopes: document.querySelectorAll('#craftTools .sub button').length }));
check(t1.tool === 'paint' && t1.scopes === 3, 'T takes the brush, three reaches appear');
await page.mouse.move(cx + 3, cy + 2); await wait(400); await page.mouse.move(cx, cy); await wait(600);
const pv1 = await ev(() => { const p = VR.Crafter.paint.preview(); return p ? { n: p.n, cells: p.cells.length, from: p.from.name, to: p.to && p.to.name, badge: document.getElementById('paintBadge').classList.contains('on'), badgeText: document.getElementById('paintBadge').innerText } : null; });
console.log('   preview', JSON.stringify(pv1));
check(pv1 && pv1.n > 4 && pv1.badge, 'pointing at the wall: the whole surface glows, the badge shows it');
await wait(500);
await shot('cr3_2_preview_face');
// a quick click on a big surface does nothing (it must be held)
const before = await ev(() => { const h = VR.Crafter.house; let n = 0; for (let i = 0; i < h.blocks.length; i++) if (h.blocks[i] !== h.base[i]) n++; return n; });
if (pv1 && pv1.n > 24) {
  await page.mouse.down(); await wait(80); await page.mouse.up(); await wait(400);
  const after = await ev(() => { const h = VR.Crafter.house; let n = 0; for (let i = 0; i < h.blocks.length; i++) if (h.blocks[i] !== h.base[i]) n++; return { n, tip: document.getElementById('craftTip').innerText }; });
  check(after.n === before, 'a quick click on a big change changes nothing (' + after.tip + ')');
}
// holding paints it
await page.mouse.move(cx, cy); await wait(300);
await page.mouse.down(); await wait(1500); await page.mouse.up(); await wait(1200);
const painted = await ev((w) => { const C = VR.Crafter, R = VR.R; const h = C.house; let n = 0; for (let i = 0; i < h.blocks.length; i++) if (h.blocks[i] !== h.base[i]) n++; return { n, at: R.types[R.T.type[C.gGet(w[0], w[1], w[2])]].name }; }, wall);
console.log('   painted', JSON.stringify(painted));
check(painted.at === 'vollton_coral' && painted.n - before >= (pv1 ? pv1.cells : 1) - 2, 'held: the whole surface is new (' + (painted.n - before) + ' blocks)');
await wait(600);
await shot('cr3_3_painted');
// one undo takes it back
await page.keyboard.press('Control+z'); await wait(800);
const undone = await ev((w) => VR.R.types[VR.R.T.type[VR.Crafter.gGet(w[0], w[1], w[2])]].name, wall);
check(undone === wall[3], 'one Strg+Z brings the old facade back');

console.log('3 · reaches: one piece, everything of a kind');
await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await wait(200);   // face → all → one
const sc1 = await ev(() => VR.Crafter.scope);
check(sc1 === 'one', 'Tab cycles the reach (now ' + sc1 + ')');
await page.mouse.move(cx + 1, cy); await wait(500);
await page.mouse.down(); await wait(60); await page.mouse.up(); await wait(900);
const one = await ev((w) => VR.R.types[VR.R.T.type[VR.Crafter.gGet(w[0], w[1], w[2])]].name, wall);
check(one === 'vollton_coral', 'one piece: a click is enough');
await page.keyboard.press('Control+z'); await wait(500);
// every window of a kind: aim a window programmatically, scope all, hold
const win = await ev(() => {
  const C = VR.Crafter, h = C.house, R = VR.R, T = R.T;
  let w = null; for (let i = 0; i < h.blocks.length && !w; i++) { const s = h.blocks[i]; if (s && /^window_|^panorama_/.test(R.types[T.type[s]].name)) { const x = i % h.sx, z = Math.floor(i / h.sx) % h.sz, y = Math.floor(i / (h.sx * h.sz)); if (C.inLot(x, z)) w = { x, y, z, face: 5, state: s, name: R.types[T.type[s]].name }; } }
  if (!w) return null;
  let n = 0; for (let i = 0; i < h.blocks.length; i++) if (h.blocks[i] && T.type[h.blocks[i]] === T.type[w.state]) n++;
  C.scope = 'all'; C.hot[C.slot] = w.name === 'panorama_white' ? 'panorama_black' : 'panorama_white'; C.hover = w; C.paint.update();
  const p = C.paint.preview();
  return { name: w.name, n, pv: p ? p.n : 0, to: C.hot[C.slot], at: [w.x, w.y, w.z] };
});
console.log('   windows', JSON.stringify(win));
if (win) {
  const r = await ev(async (w) => { const C = VR.Crafter; C.paint.down(); const quick = (() => { C.paint.up(); return VR.R.types[VR.R.T.type[C.gGet(w.at[0], w.at[1], w.at[2])]].name; })(); C.hover = { x: w.at[0], y: w.at[1], z: w.at[2], face: 5, state: C.gGet(w.at[0], w.at[1], w.at[2]) }; C.paint.update(); C.paint.down(); await new Promise(r => setTimeout(r, 900)); C.paint.up(); const h = C.house; let left = 0; for (let i = 0; i < h.blocks.length; i++) if (h.blocks[i] && VR.R.types[VR.R.T.type[h.blocks[i]]].name === w.name) left++; return { quick, left }; }, win);
  console.log('   ', JSON.stringify(r));
  check(r.quick === win.name, 'everything of a kind: a quick click changes nothing');
  check(r.left === 0, 'held: every ' + win.name + ' in the house is ' + win.to);
  await page.keyboard.press('Control+z'); await wait(500);
}

console.log('4 · help card');
await page.keyboard.press('?'); await wait(400);
const card = await ev(() => document.getElementById('craftCard').classList.contains('on'));
check(card, '? opens the picture card');
await shot('cr3_4_card');
await page.keyboard.press('Escape'); await wait(200);
check(!(await ev(() => document.getElementById('craftCard').classList.contains('on'))), 'Esc closes it');

console.log('5 · painting as the player');
const pmp = await ev((w) => {
  const C = VR.Crafter, P = C.player; P.noLock = true; C.scope = 'face'; P.enter();
  P.pos = [w[0] + 0.5, w[1] - 1, w[2] - 3.5]; P.vel = [0, 0, 0]; P.yaw = 0; P.pitch = 0.15; P.flying = true; P.step(1 / 60, 3);
  P.yaw = Math.atan2(-((w[0] + 0.5) - P.pos[0]), -((w[2]) - P.pos[2])); P.locked = true; P.step(1 / 60); P.aim();
  const p = C.paint.preview();
  return { tool: C.tool, hover: C.hover ? [C.hover.x, C.hover.y, C.hover.z] : null, n: p ? p.n : 0 };
}, wall);
console.log('   ', JSON.stringify(pmp));
check(pmp.n > 0, 'the crosshair aims the brush in player mode');
await ev(() => { document.getElementById('studio').classList.add('pmlocked'); });
await wait(900);
await shot('cr3_5_player_paint');
await ev(() => { VR.Crafter.player.locked = false; VR.Crafter.player.exit(); });
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 12)) console.log(l);
check(!logs.some(l => /pageerror\]/.test(l)), 'no page errors');
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

// glass in the Studio's own renderer (Crafter): window glass, plain glass, panes against blocks (v0.33.2: every block its own frame)
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
page.on('pageerror', e => console.log('[pageerror] ' + (e.stack || e.message).slice(0, 900)));
await page.goto('file:///home/claude/vr/dist/studio.html');
const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
for (let i = 0; i < 240; i++) { await wait(500); const s = await ev(() => ({ boot: document.getElementById('studio').classList.contains('boot'), houses: window.__studio ? window.__studio.HOUSE.size : -1 })); if (!s.boot && s.houses >= 2) break; }
await ev(() => window.__studio.selectHouse(0)); await wait(500);
await ev(() => window.__studioCore.setMode('craft'));
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => !!(VR.Crafter.house && VR.Crafter.gpu))) break; }
await wait(1000);
const r = await ev(() => {
  const C = VR.Crafter, h = C.house, R = VR.R, st = (n) => R.byName[n].defaultState;
  // a wall above the roof (free sky behind it): window glass, plain glass, a pane row and stained panes
  const L = [], x0 = h.pad + 6, z0 = h.pad + 10, y0 = (h.roofTop || 40) + 4;
  for (let x = 0; x < 13; x++) for (let y = 0; y < 5; y++) L.push([x0 + x, y0 + y, z0, st('vollton_white')]);
  for (let x = 1; x < 4; x++) for (let y = 1; y < 4; y++) L.push([x0 + x, y0 + y, z0, st('window_black')]);
  for (let x = 5; x < 8; x++) for (let y = 1; y < 4; y++) L.push([x0 + x, y0 + y, z0, st(x === 7 ? 'panorama_black' : 'window_black')]);
  for (let x = 9; x < 12; x++) for (let y = 1; y < 4; y++) L.push([x0 + x, y0 + y, z0, st('glass')]);
  for (let x = 0; x < 13; x++) L.push([x0 + x, y0, z0 + 3, st('vollton_white')]);
  for (let x = 1; x < 12; x++) { L.push([x0 + x, y0 + 1, z0 + 3, st('glass_pane')]); L.push([x0 + x, y0 + 2, z0 + 3, st('light_blue_stained_glass_pane')]); }
  L.push([x0, y0 + 1, z0 + 3, st('vollton_white')], [x0, y0 + 2, z0 + 3, st('vollton_white')], [x0 + 12, y0 + 1, z0 + 3, st('glass')], [x0 + 12, y0 + 2, z0 + 3, st('glass')]);
  // a mint backdrop behind it, so the glass shows something (the Studio's sky is dark)
  for (let x = -2; x < 15; x++) for (let y = -1; y < 7; y++) L.push([x0 + x, y0 + y, z0 - 4, st('vollton_mint')]);
  C.applyChanges(L);
  const S = window.__st; S.scene.center = [x0 + 6.5, y0 + 2.5, z0 + 1.5]; S.cam.yaw = 0.18; S.cam.pitch = 0.12; S.cam.dist = 17;
  return { x0, y0, z0, sy: h.sy };
});
console.log(JSON.stringify(r));
await wait(6000);
await page.screenshot({ path: '/home/claude/vr/test/shots/gs_1.png', timeout: 180000 });
await ev(() => { const S = window.__st; S.cam.yaw = -0.55; S.cam.pitch = 0.32; S.cam.dist = 12; });
await wait(2500);
await page.screenshot({ path: '/home/claude/vr/test/shots/gs_2.png', timeout: 180000 });
await browser.close();

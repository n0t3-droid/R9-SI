import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
page.on('pageerror', e => console.log('[pageerror] ' + (e.stack || e.message).slice(0, 900)));
page.on('console', m => { if (m.type() === 'error') console.log('[err] ' + m.text().slice(0, 300)); });
await page.goto('file:///home/claude/vr/dist/studio.html');
const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
for (let i = 0; i < 240; i++) { await wait(500); const s = await ev(() => ({ boot: document.getElementById('studio').classList.contains('boot'), houses: window.__studio ? window.__studio.HOUSE.size : -1 })); if (!s.boot && s.houses >= 2) break; }
await ev(() => window.__studio.selectHouse(0)); await wait(500);
await ev(() => window.__studioCore.setMode('craft'));
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => !!(VR.Crafter.house && VR.Crafter.gpu))) break; }
await wait(1000);
console.log(JSON.stringify(await ev(() => { const P = VR.Crafter.player; P.noLock = true; P.enter(); return { pos: P.pos, yaw: P.yaw, keys: P.keys }; })));
console.log(JSON.stringify(await ev(() => {
  const C = VR.Crafter, P = C.player, R = VR.R, T = R.T;
  P.keys = { w: true }; const a = P.pos.slice(); const out = [];
  for (let i = 0; i < 6; i++) { P.step(1 / 60, 10); out.push([P.pos.map(v => +v.toFixed(2)), P.vel.map(v => +v.toFixed(2)), P.onGround, P.hitWall]); }
  P.keys = {};
  const around = []; for (let dz = -1; dz <= 2; dz++) for (let dx = -1; dx <= 2; dx++) for (let dy = 0; dy <= 2; dy++) { const s = C.gGet(Math.floor(a[0]) + dx, Math.floor(a[1]) + dy, Math.floor(a[2]) + dz); if (s) around.push([dx, dy, dz, R.types[T.type[s]].name]); }
  return { a, yaw: P.yaw, out, around };
})));
await browser.close();

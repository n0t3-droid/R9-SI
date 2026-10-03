// diagnose: break glass in the Crafter — does anything appear next to it (blocks or mesh)?
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--allow-file-access-from-files'] });
const page = await (await browser.newContext({ viewport: { width: 1100, height: 760 } })).newPage();
const logs = [];
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 900)));
await page.goto('file:///home/claude/vr/dist/studio.html');
const ev = (fn, arg) => page.evaluate(fn, arg), wait = (ms) => page.waitForTimeout(ms);
for (let i = 0; i < 240; i++) { await wait(500); const s = await ev(() => ({ boot: document.getElementById('studio').classList.contains('boot'), houses: window.__studio ? window.__studio.HOUSE.size : -1 })); if (!s.boot && s.houses >= 2) break; }
await ev(() => window.__studio.selectHouse(0)); await wait(300);
await ev(() => window.__studioCore.setMode('craft'));
for (let i = 0; i < 160; i++) { await wait(500); if (await ev(() => !!(VR.Crafter.house && VR.Crafter.gpu && VR.Crafter.meadow))) break; }
// a window of window_black on the outside: a glass cell with glass left/right and air in front
const w = await ev(() => {
  const C = VR.Crafter, h = C.house, R = VR.R, T = R.T, g = (x, y, z) => C.gGet(x, y, z), nm = (s) => s ? R.types[T.type[s]].name : 'air';
  for (let i = 0; i < h.blocks.length; i++) {
    const s = h.blocks[i]; if (!s || nm(s) !== 'window_black') continue;
    const x = i % h.sx, z = Math.floor(i / h.sx) % h.sz, y = Math.floor(i / (h.sx * h.sz));
    if (nm(g(x, y, z - 1)) === 'air' && nm(g(x - 1, y, z)) === 'window_black' && nm(g(x + 1, y, z)) === 'window_black') return { x, y, z, face: 'z-' };
    if (nm(g(x - 1, y, z)) === 'air' && nm(g(x, y, z - 1)) === 'window_black' && nm(g(x, y, z + 1)) === 'window_black') return { x, y, z, face: 'x-' };
  }
  return null;
});
console.log('window cell', JSON.stringify(w));
const around = (c) => ev((c) => { const C = VR.Crafter, R = VR.R, T = R.T, out = []; for (let dy = -1; dy <= 1; dy++) { const row = []; for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const s = C.gGet(c.x + dx, c.y + dy, c.z + dz); row.push(s ? R.types[T.type[s]].name.slice(0, 10) : '.'); } out.push(row.join(' ')); } return out; }, c);
const look = async (c) => ev((c) => { const S = window.__studioCore.S; const away = c.face === 'z-' ? [0, 0, -4] : [-4, 0, 0]; S.cam.fly = { pos: [c.x + 0.5 + away[0], c.y + 0.6, c.z + 0.5 + away[2]], yaw: c.face === 'z-' ? 0 : -Math.PI / 2, pitch: -0.05, speed: 8 }; }, c);
await look(w); await wait(1500);
console.log('before', JSON.stringify(await around(w)));
await page.screenshot({ path: '/home/claude/vr/test/shots/' + (process.env.TAG || '') + 'glass_pop_a.png' });
await ev((c) => VR.Crafter.breakAt({ x: c.x, y: c.y, z: c.z }), w);
await wait(4000);
console.log('after', JSON.stringify(await around(w)));
await page.screenshot({ path: '/home/claude/vr/test/shots/' + (process.env.TAG || '') + 'glass_pop_b.png' });
// as the player: hold left on the next glass
await ev((c) => { const C = VR.Crafter, PM = C.player; PM.enter(); const away = c.face === 'z-' ? [0, 0, -3] : [-3, 0, 0]; PM.pos = [c.x + 1.5 + away[0], c.y - 0.99, c.z + 0.5 + away[2]]; PM.yaw = c.face === 'z-' ? 0 : -Math.PI / 2; PM.pitch = 0.1; PM.step(1 / 60, 1); PM.aim(); }, w);
await wait(1200);
const hv = await ev(() => { const h = VR.Crafter.hover; return h ? [h.x, h.y, h.z, h.face, h.ground ? 'ground' : ''] : null; });
console.log('player aims at', JSON.stringify(hv), 'ghost', JSON.stringify(await ev(() => VR.Crafter.ghost)));
await page.screenshot({ path: '/home/claude/vr/test/shots/' + (process.env.TAG || '') + 'glass_pop_c.png' });
console.log(logs.join('\n'));
await browser.close();

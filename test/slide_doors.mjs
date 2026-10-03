// v0.33.2 game: the voxel sliding glass doors (shops, modern houses) open by themselves as the player comes close —
// the whole door (panels side by side and stacked) — and close again behind the player.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
const logs = [];
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 600)));
await page.goto('file:///home/claude/vr/dist/index.html');
const ev = (fn, arg) => page.evaluate(fn, arg), wait = (ms) => page.waitForTimeout(ms);
const step = async (n) => { for (let k = 0; k < n; k += 10) { await ev((m) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { this.setupCamera(F.cam); }; } for (let i = 0; i < m; i++) { g.last = performance.now() - 50; g.loop(performance.now()); } }, Math.min(10, n - k)); await wait(5); } };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.settings.renderDist = 3; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Slide',mode:'creative',difficulty:'peaceful',type:'flat',seed:'9',cheats:true,kit:false})`);
for (let i = 0; i < 90; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { window.requestAnimationFrame = () => 0; });
await step(20);
const at = await ev(() => {
  const g = VR.game, p = g.player, t = VR.R.byName.vx_glass_door_black, x = Math.floor(p.pos[0]) + 6, y = Math.floor(p.pos[1]), z = Math.floor(p.pos[2]);
  for (const dx of [0, 1]) for (const dy of [0, 1]) g.world.setBlock(x + dx, y + dy, z, t.with(t.defaultState, 'open', 0), 4);
  return [x, y, z];
});
const state = () => ev((a) => { const w = VR.game.world, t = VR.R.byName.vx_glass_door_black; return [0, 1].map(dx => [0, 1].map(dy => t.get(w.getBlock(a[0] + dx, a[1] + dy, a[2]), 'open')).join('')).join('|'); }, at);
const s0 = await state();
await ev((a) => { const p = VR.game.player; p.teleport(a[0] + 1, a[1], a[2] + 1.5); p.vel = [0, 0, 0]; }, at);
await step(12);
const s1 = await state();
await ev((a) => { const p = VR.game.player; p.teleport(a[0] + 1, a[1], a[2] + 9); p.vel = [0, 0, 0]; }, at);
await step(40);
const s2 = await state();
console.log('closed:', s0, '· near:', s1, '· after leaving:', s2);
const ok = s0 === '00|00' && s1 === '11|11' && s2 === '00|00';
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 5)) console.log(l);
console.log(ok ? 'OK' : 'FAIL');
await browser.close();
process.exit(ok ? 0 : 1);

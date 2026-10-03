// A column you changed, left far behind (unloaded → saved) and came back to must come back from the save — before
// v0.33 it was generated anew in the same session and the change seemed gone (and was lost for good if you built there again).
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
const logs = [];
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 600)));
await page.goto('file:///home/claude/vr/dist/index.html');
const ev = (fn, arg) => page.evaluate(fn, arg), wait = (ms) => page.waitForTimeout(ms);
const step = async (n) => { for (let k = 0; k < n; k += 10) { await ev((m) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { this.setupCamera(F.cam); }; } for (let i = 0; i < m; i++) { g.last = performance.now() - 16; g.loop(performance.now()); } }, Math.min(10, n - k)); await wait(5); } };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.settings.renderDist = 4; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Revisit',mode:'creative',difficulty:'peaceful',type:'flat',seed:'5',cheats:true,kit:false})`);
for (let i = 0; i < 90; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { window.requestAnimationFrame = () => 0; });
await step(40);
const at = await ev(() => { const g = VR.game, p = g.player, x = Math.floor(p.pos[0]) + 2, y = Math.floor(p.pos[1]), z = Math.floor(p.pos[2]); g.world.setBlock(x, y, z, VR.R.byName.vollton_coral.defaultState, 4); return [x, y, z]; });
await step(20);
const far = async (dx) => { await ev((dx) => { const p = VR.game.player; p.flying = true; p.teleport(p.pos[0] + dx, p.pos[1], p.pos[2]); }, dx); for (let i = 0; i < 30; i++) { await step(10); await wait(60); } };
await far(400);
const gone = await ev((a) => !VR.game.world.col(a[0] >> 4, a[2] >> 4), at);
await far(-400);
for (let i = 0; i < 40; i++) { await step(10); if (await ev((a) => { const c = VR.game.world.col(a[0] >> 4, a[2] >> 4); return !!(c && c.ready); }, at)) break; await wait(100); }
const back = await ev((a) => { const s = VR.game.world.getBlock(a[0], a[1], a[2]); return s ? VR.R.types[VR.R.T.type[s]].name : 'air'; }, at);
console.log('unloaded while away:', gone, '· the block after coming back:', back);
console.log(gone && back === 'vollton_coral' ? 'OK' : 'FAIL');
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 5)) console.log(l);
await browser.close();

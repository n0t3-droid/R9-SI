// Villager model gallery: a lineup of roles / ages in a flat creative world
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 640 } });
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || t === 'warning' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 700)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.settings.renderDist = 4; g.settings.dynRes = false; g.settings.minimap = false; g.applySettings('renderDist'); });
await ev(`VR.game.createWorld({name:'Lineup',mode:'creative',difficulty:'peaceful',type:'flat',seed:'1',cheats:true,kit:false})`);
for (let i = 0; i < 60; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
const setup = await ev(([seedBase, poseName]) => {
  const g = VR.game, V = g.villages, F = VR.Folk;
  const p = g.player; p.flying = true;
  const y0 = Math.floor(p.pos[1]);
  const roles = [['farmer', 'adult'], ['baker', 'adult'], ['smith', 'adult'], ['scholar', 'adult'], ['healer', 'adult'], ['mayor', 'adult'], ['builder', 'adult'], ['ranger', 'adult'], ['pilot', 'adult'], ['gardener', 'adult'], ['crafter', 'adult'], ['elder', 'elder'], ['child', 'child'], ['child', 'child'], ['child', 'child'], ['farmer', 'adult']];
  const list = [];
  roles.forEach(([role, age], i) => {
    const seed = seedBase + i * 7919;
    const look = F.look(seed, role, age, null);
    list.push({ pos: [i * 1.25 - roles.length * 0.62, y0, 0.5], yaw: Math.PI, p: { look, seed, name: role, bed: null }, kid: age === 'child', walkAmt: 0, walk: 0, pose: poseName || 'stand', act: null, bubble: null, headYaw: 0, headPitch: 0, hurt: 0, talkAnim: 0 });
  });
  V._agents = list; V.update = () => {}; Object.defineProperty(V, 'agents', { get() { return this._agents; }, set(v) { } , configurable: true });
  V.updateBubbles = () => {};
  p.teleport(0, y0 + 0.6, 6.2); p.yaw = 0; p.pitch = -0.06;
  g.env.setTime(3000);
  return { y0, n: list.length, styles: list.map(a => a.p.look.hs + '/' + (a.p.look.kidHat || a.p.look.elderHat || '')).join(' ') };
}, [+(process.env.SEED || 101), process.env.POSE || 'stand']);
console.log(JSON.stringify(setup));
const shot = async (name) => { await ev(() => { const g = VR.game; g.env.rain = 0; g.env.rainTarget = 0; g.last = performance.now() - 33; g.loop(performance.now()); g.renderer.gl.finish(); }); await wait(200); await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 90000 }); console.log('shot', name); };
for (let i = 0; i < 6; i++) { await ev(() => { const g = VR.game; g.last = performance.now() - 33; g.loop(performance.now()); }); await wait(200); }
await shot('lineup_' + (process.env.TAG || 'a'));
// close-ups: faces
await ev(() => { const p = VR.game.player; p.teleport(-8.2, p.pos[1] - 0.1, 2.3); p.yaw = 0.0; p.pitch = 0.05; });
await shot('lineup_close_' + (process.env.TAG || 'a'));
await ev(() => { const p = VR.game.player; p.teleport(5.2, p.pos[1] - 0.5, 1.9); p.yaw = 0.0; p.pitch = -0.02; });
await shot('lineup_close2_' + (process.env.TAG || 'a'));
// back view
await ev(() => { const p = VR.game.player; p.teleport(-4, p.pos[1] + 0.6, -5); p.yaw = Math.PI; p.pitch = -0.1; });
await shot('lineup_back_' + (process.env.TAG || 'a'));
// first-person arm: empty hand, a tool, a block
await ev(() => { const p = VR.game.player; p.teleport(0, p.pos[1], 8); p.yaw = 0; p.pitch = 0; const inv = p.inv; inv.slots[8] = null; inv.sel = 8; inv.changed = true; });
await shot('hand_empty_' + (process.env.TAG || 'a'));
await ev(() => { const p = VR.game.player; const inv = p.inv; inv.slots[8] = { id: 'iron_pickaxe', n: 1 }; inv.sel = 8; inv.changed = true; });
await shot('hand_tool_' + (process.env.TAG || 'a'));
await ev(() => { const p = VR.game.player; const inv = p.inv; inv.slots[8] = { id: 'vx_window_shutter_green', n: 1 }; inv.sel = 8; inv.changed = true; });
await shot('hand_vx_' + (process.env.TAG || 'a'));
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 25)) console.log(l);
await browser.close();

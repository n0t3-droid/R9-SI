// Villager animation gallery: one villager per animation state in a flat world, two moments in time
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 640 } });
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 700)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.settings.renderDist = 4; g.settings.dynRes = false; g.settings.minimap = false; g.applySettings('renderDist'); });
await ev(`VR.game.createWorld({name:'Anim',mode:'creative',difficulty:'peaceful',type:'flat',seed:'1',cheats:true,kit:false})`);
for (let i = 0; i < 60; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
const STATES = ['idle', 'walk', 'run', 'sit', 'sitground', 'work', 'crouch', 'read', 'talk', 'wave', 'cheer', 'dance', 'stretch', 'hug', 'aim'];
await ev((STATES) => {
  const g = VR.game, V = g.villages, F = VR.Folk;
  const p = g.player; p.flying = true;
  const y0 = Math.floor(p.pos[1]);
  const list = [];
  STATES.forEach((st, i) => {
    const seed = 101 + i * 7919, role = ['farmer', 'baker', 'smith', 'scholar', 'builder', 'ranger', 'gardener', 'office', 'teacher', 'mayor', 'child', 'barista', 'office', 'healer', 'ranger'][i % 15];
    const look = F.look(seed, role, role === 'child' ? 'child' : 'adult', null);
    const a = { pos: [i * 1.4 - STATES.length * 0.7, y0, 0.5], yaw: Math.PI, p: { look, seed, name: st, bed: null }, kid: role === 'child', walkAmt: 0, walk: 0, pose: 'stand', act: null, bubble: null, headYaw: 0, headPitch: 0, hurt: 0, talkAnim: 0, glance: 0, glanceP: 0, glanceT: 99 };
    if (st === 'walk') { a.walkAmt = 1; a.walk = 0.4; }
    else if (st === 'run') { a.walkAmt = 1; a.walk = 0.4; a.act = { type: 'go', run: true }; }
    else if (st === 'cheer') { a.walkAmt = 0.6; a.walk = 0.2; a.act = { type: 'play', game: 'hop' }; }
    else if (st === 'wave') a.waveT = 99;
    else if (st === 'dance') a.dance = true;
    else if (st === 'stretch') a.stretchT = 99;
    else if (st !== 'idle') a.pose = st;
    list.push(a);
  });
  V._agents = list; V.update = () => {}; Object.defineProperty(V, 'agents', { get() { return this._agents; }, set(v) { }, configurable: true });
  V.updateBubbles = () => {};
  p.teleport(0, y0 + 0.9, 7.5); p.yaw = 0; p.pitch = -0.05;
  g.env.setTime(4000);
}, STATES);
const shot = async (name) => { await ev(() => { const g = VR.game; g.env.rain = 0; g.env.rainTarget = 0; g.last = performance.now() - 33; g.loop(performance.now()); g.renderer.gl.finish(); }); await wait(200); await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 90000 }); console.log('shot', name); };
const tick = async (n) => { for (let i = 0; i < n; i++) { await ev(() => { const g = VR.game; g.last = performance.now() - 33; g.loop(performance.now()); for (const a of g.villages.agents) if (a.walkAmt) a.walk += 0.033 * 1.6; }); await wait(30); } };
await tick(8); await shot('anim_a');
await tick(12); await shot('anim_b');
// close-ups: the walker and the waver from the side
await ev(() => { const p = VR.game.player; p.teleport(-9.9 + 1.4 * 1, p.pos[1] - 0.2, 3.4); p.yaw = 0.0; p.pitch = -0.05; });
await tick(3); await shot('anim_walk_close');
await ev(() => { const p = VR.game.player; p.teleport(-9.9 + 1.4 * 9 + 2.6, p.pos[1], 2.4); p.yaw = -0.7; p.pitch = -0.05; });
await tick(3); await shot('anim_wave_close');
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 8)) console.log(l);
await browser.close();

// the Lantern Festival: villagers gather & dance, lanterns at dusk, fireworks at night
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 700)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(5); } };
const shot = async (name) => { await ev(() => { window.__norender = false; const g = VR.game; g.env.rain = 0; g.env.rainTarget = 0; g.last = performance.now() - 33; g.loop(performance.now()); g.renderer.gl.finish(); window.__norender = true; }); await wait(150); await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 120000 }); console.log('shot', name); };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.settings.renderDist = 6; g.settings.dynRes = false; g.settings.bloom = true; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Fest',mode:'creative',difficulty:'peaceful',type:'default',seed:'${process.env.SEED || '424242'}',cheats:true,kit:false})`);
for (let i = 0; i < 60; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; g.env.setTime(11250); g.zenFreezeTime = true; window.requestAnimationFrame = () => 0; g.hideHud = false; });
for (let i = 0; i < 15; i++) { await step(10); await wait(80); }
const info = await ev(() => { const g = VR.game, V = g.villages; const vil = [...V.known.values()].find(v => v.active); if (!vil) return null; const pz = vil.plan.plaza; return { name: vil.name, day: g.env.day, festDay: V.festivalDay(vil), on: V.festivalOn(vil, g.env.timeOfDay), plaza: [pz.x, pz.y, pz.z, pz.r], agents: vil.agents.length, acts: vil.agents.map(a => a.act && a.act.type).join(',') }; });
console.log(JSON.stringify(info));
// let everyone walk to the plaza (≈ 40 s)
for (let i = 0; i < 12; i++) { await step(40); await wait(50); }
const near = await ev(() => { const g = VR.game, V = g.villages; const vil = [...V.known.values()].find(v => v.active); const pz = vil.plan.plaza; return { at: vil.agents.filter(a => Math.hypot(a.pos[0] - pz.x, a.pos[2] - pz.z) < pz.r + 4).length, of: vil.agents.length, roles: vil.fest ? [...vil.fest.roles.values()].join(',') : null }; });
console.log('gathered', JSON.stringify(near));
// stand at the plaza edge, a bit raised, looking at the well
await ev(() => { const g = VR.game, V = g.villages; const vil = [...V.known.values()].find(v => v.active); const pz = vil.plan.plaza; const p = g.player; const ex = pz.x + 0.5 + pz.r + 7, ez = pz.z + 0.5 + 3; p.teleport(ex, pz.y + 4, ez); p.flying = true; p.yaw = Math.atan2(-(pz.x + 0.5 - ex), -(pz.z + 0.5 - ez)); p.pitch = -0.28; });
await ev(() => VR.game.env.setTime(12650));
for (let i = 0; i < 8; i++) { await step(30); await wait(40); }
await shot('fest_dusk');
await ev(() => { const g = VR.game, V = g.villages; const vil = [...V.known.values()].find(v => v.active); const pz = vil.plan.plaza; const p = g.player; const ex = pz.x + 0.5 + pz.r + 26, ez = pz.z + 0.5 + 10; p.teleport(ex, pz.y + 9, ez); p.flying = true; p.yaw = Math.atan2(-(pz.x + 0.5 - ex), -(pz.z + 0.5 - ez)); p.pitch = 0.3; g.env.setTime(13900); });
for (let k = 0; k < 4; k++) {
  for (let i = 0; i < 4; i++) { await step(20); await wait(30); }
  const r = await ev(() => { const g = VR.game, V = g.villages; const vil = [...V.known.values()].find(v => v.active); return { rockets: vil.fest ? vil.fest.rockets.length : 0, parts: g.particles.n }; });
  console.log('night', k, JSON.stringify(r));
  await shot('fest_night' + k);
}
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 25)) console.log(l);
await browser.close();

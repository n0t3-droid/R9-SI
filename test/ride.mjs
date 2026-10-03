// ask the village pilot for a ride: board the pad shuttle with the autopilot set
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
await ev(() => { const g = VR.game; g.settings.renderDist = 6; g.settings.dynRes = false; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Ride',mode:'creative',difficulty:'peaceful',type:'default',seed:'${process.env.SEED || '424242'}',cheats:true,kit:false})`);
for (let i = 0; i < 60; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { VR.game.env.setTime(3200); VR.game.zenFreezeTime = true; window.requestAnimationFrame = () => 0; });
// find a village with a pad: walk there if needed
let info = null;
for (let tries = 0; tries < 6 && !info; tries++) {
  for (let i = 0; i < 12; i++) { await step(10); await wait(80); }
  info = await ev((tries) => { const g = VR.game, V = g.villages; for (const vil of V.known.values()) { if (!vil.plan.pad || !vil.active) continue; const pilot = vil.agents.find(a => a.role === 'pilot'); const ship = V.padShip(vil); if (pilot && ship) return { vil: vil.name, pad: [vil.plan.pad.x, vil.plan.pad.y, vil.plan.pad.z], pilot: pilot.p.name, ship: ship.d.meta.name }; } const pads = [...V.known.values()].filter(v => v.plan.pad); if (pads.length) { const pd = pads[0].plan.pad; g.player.teleport(pd.x + 8, pd.y + 1, pd.z + 8); } else { const s = V.list()[tries % Math.max(1, V.list().length)]; if (s) g.player.teleport(s.x + 0.5, s.y + 3, s.z + 0.5); } return null; }, tries);
}
console.log(JSON.stringify(info));
if (info) {
  const r = await ev(() => { const g = VR.game, V = g.villages; const vil = [...V.known.values()].find(v => v.active && v.plan.pad); const pilot = vil.agents.find(a => a.role === 'pilot'); g.player.teleport(pilot.pos[0] + 1.5, pilot.pos[1], pilot.pos[2]); V.openTalk(pilot); V.rideMenu(pilot); const btns = [...document.querySelectorAll('#tk_opts button')].map(b => b.textContent); document.querySelector('#tk_opts button').click(); const S = g.starships; return { btns, pilot: !!S.pilot, auto: S.auto && S.auto.site.name }; });
  console.log(JSON.stringify(r));
  for (let i = 0; i < 8; i++) { await step(20); await wait(40); }
  console.log(JSON.stringify(await ev(() => { const S = VR.game.starships; return { pilot: !!S.pilot, auto: S.auto && S.auto.site.name, dist: S.auto && Math.round(S.auto.dist), alt: S.pilot && Math.round(S.pilot.pos[1]) }; })));
  await shot('ride_takeoff');
}
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 25)) console.log(l);
await browser.close();

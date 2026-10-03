import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || t === 'warning' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 700)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(10); } };
const shot = async (name, tod) => { await ev((tod) => { window.__norender = false; const g = VR.game; if (tod !== undefined) g.env.setTime(tod); g.env.rain = 0; g.env.rainTarget = 0; g.last = performance.now() - 33; g.loop(performance.now()); g.renderer.gl.finish(); window.__norender = true; }, tod); await wait(150); await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 90000 }); console.log('shot', name); };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.settings.renderDist = 6; g.settings.dynRes = false; g.settings.minimap = false; g.applySettings('renderDist'); });
await ev(`VR.game.createWorld({name:'Folk',mode:'creative',difficulty:'normal',type:'default',seed:'${process.env.SEED || '777'}',cheats:true,kit:true})`);
for (let i = 0; i < 60; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; g.env.setTime(+(window.__TOD || 2500)); });
for (let i = 0; i < 20; i++) { await step(10); await wait(300); }
const info = await ev(() => { const V = VR.game.villages; return { known: [...V.known.values()].map(v => ({ name: v.name, people: v.people.length, active: v.active, agents: v.agents.length, roles: v.people.map(p => p.role).join(',') })), agents: V.agents.length, sites: V.sites.length }; });
console.log(JSON.stringify(info));
// simulate a bit of village life
for (let i = 0; i < 30; i++) { await step(10); await wait(100); }
const pos = await ev(() => VR.game.villages.agents.slice(0, 8).map(a => [a.p.name, a.role, a.act && a.act.type, a.pose, a.pos.map(v => v.toFixed(1)).join(' '), a.path ? a.path.length : 0]));
console.log(JSON.stringify(pos));
const sp = await ev(() => { const p = VR.game.player; return [p.pos[0], p.pos[1], p.pos[2], p.yaw]; });
const look = async (name, pos, tgt, tod) => {
  await ev(([pos, tgt]) => { const p = VR.game.player; p.teleport(pos[0], pos[1], pos[2]); p.flying = true; const dx = tgt[0] - pos[0], dy = tgt[1] - pos[1] - 1.6, dz = tgt[2] - pos[2]; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); }, [pos, tgt]);
  await step(4);
  await shot(name, tod);
};
// look at the plaza from spawn
await shot('folk_spawn');
// close-up of the nearest villager
const near = await ev(() => { const V = VR.game.villages, p = VR.game.player; let best = null, bd = 1e9; for (const a of V.agents) { const d = Math.hypot(a.pos[0] - p.pos[0], a.pos[2] - p.pos[2]); if (d < bd) { bd = d; best = a; } } return best ? [best.pos[0], best.pos[1], best.pos[2], best.p.name] : null; });
console.log('nearest', JSON.stringify(near));
if (near) {
  await look('folk_close', [near[0] + 2.2, near[1] + 0.4, near[2] + 2.2], [near[0], near[1] + 0.3, near[2]]);
  await look('folk_group', [sp[0] + 6, sp[1] + 5, sp[2] + 6], [sp[0] - 3, sp[1], sp[2] - 3]);
  // talk panel
  await ev(() => { const V = VR.game.villages, p = VR.game.player; let best = null, bd = 1e9; for (const a of V.agents) { const d = Math.hypot(a.pos[0] - p.pos[0], a.pos[2] - p.pos[2]); if (d < bd) { bd = d; best = a; } } if (best) V.openTalk(best); });
  await wait(300);
  await page.screenshot({ path: '/home/claude/vr/test/shots/folk_talk.png' }); console.log('shot folk_talk');
  await ev(() => { const V = VR.game.villages; V.talkText(V.aboutVillage(V.talking)); });
  await wait(200);
  await page.screenshot({ path: '/home/claude/vr/test/shots/folk_talk2.png' }); console.log('shot folk_talk2');
  await ev(() => VR.game.villages.showTrade(VR.game.villages.talking));
  await wait(200);
  await page.screenshot({ path: '/home/claude/vr/test/shots/folk_trade.png' }); console.log('shot folk_trade');
  await ev(() => VR.game.villages.closeTalk());
}
// night: everyone in bed
await ev(() => VR.game.env.setTime(17000));
for (let i = 0; i < 40; i++) { await step(10); await wait(60); }
const night = await ev(() => VR.game.villages.agents.map(a => a.pose).reduce((m, p) => (m[p] = (m[p] || 0) + 1, m), {}));
console.log('night poses', JSON.stringify(night));
const sleeper = await ev(() => { const a = VR.game.villages.agents.find(a => a.pose === 'sleep'); return a ? [a.pos[0], a.pos[1], a.pos[2]] : null; });
if (sleeper) await look('folk_sleep', [sleeper[0] + 1.6, sleeper[1] + 1.4, sleeper[2] + 1.6], [sleeper[0], sleeper[1] - 0.8, sleeper[2]], 17000);
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 25)) console.log(l);
await browser.close();

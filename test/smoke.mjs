import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
let fails = 0; const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || t === 'warning' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 600)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 20) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(20, n - k), dtms]); } };
const shot = async (name, tod) => { await ev((tod) => { window.__norender = false; const g = VR.game; if (tod !== undefined) g.env.setTime(tod); g.env.rain = 0; g.env.rainTarget = 0; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }, tod); await wait(200); await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 120000 }); console.log('shot', name); };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.settings.renderDist = 7; g.settings.dynRes = false; g.applySettings('renderDist'); });
for (let i = 0; i < 12; i++) { await step(10); await wait(400); }
await shot('smoke_title', 12900);
await ev(`VR.game.createWorld({name:'Smoke',mode:'survival',difficulty:'normal',type:'default',seed:'424242',cheats:true,kit:true})`);
for (let i = 0; i < 60; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
for (let i = 0; i < 16; i++) { await step(20); await wait(250); }
console.log(JSON.stringify(await ev(() => { const g = VR.game, V = g.villages; return { pos: g.player.pos.map(Math.round), vil: [...V.known.values()].map(v => [v.name, v.people.length, v.active, v.plan.lots.length, v.people.filter(p => p.role === 'builder').length]), agents: V.agents.length, sites: V.sites.length }; })));
await shot('smoke_spawn', 4500);
// inventory open / close: the game must want the mouse back afterwards
await ev(() => VR.game.ui.openInventory());
await step(4);
await shot('smoke_inv');
await ev(() => VR.game.ui.closeInventory());
await step(4);
console.log('after inventory', JSON.stringify(await ev(() => { const i = VR.game.input; return { captured: i.captured, locked: i.locked, dragLook: i.dragLook, lockFailed: i.lockFailed, fails: i.lockFails, screen: VR.game.ui.screen }; })));
check((await ev(() => VR.game.input.captured)) === true, 'after the inventory closes the game wants the mouse back');
await wait(900); await step(2);
console.log('after 900ms', JSON.stringify(await ev(() => { const i = VR.game.input; return { captured: i.captured, dragLook: i.dragLook, lockFailed: i.lockFailed, fails: i.lockFails, hint: (document.getElementById('lockhint') || {}).style ? document.getElementById('lockhint').style.display : 'none' }; })));
check((await ev(() => VR.game.input.captured)) === true, 'and it still does 900 ms later');
// creative voxel homes palette
await ev(() => { const g = VR.game; g.player.setMode('creative'); g.ui.creativeTab = 'arch'; g.ui.openInventory(); });
await step(2);
await shot('smoke_palette');
await ev(() => VR.game.ui.closeInventory());
// a few minutes of village life in survival at night: monsters vs rangers
await ev(() => VR.game.env.setTime(14000));
for (let i = 0; i < 20; i++) { await step(20); }
console.log(JSON.stringify(await ev(() => { const g = VR.game; return { mobs: g.entities.mobs.length, hostile: g.entities.mobs.filter(m => m.def.hostile).length, sleep: g.villages.agents.filter(a => a.pose === 'sleep').length, fight: g.villages.agents.filter(a => a.act && a.act.type === 'fight').length, hp: g.player.health }; })));
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 25)) console.log(l);
check(!logs.some(l => /pageerror\]/.test(l)), 'no page errors');
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

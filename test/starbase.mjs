// the Starbase: new worlds start in the control room; look at the portal, the consoles, walk out to the apron
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const W = +(process.env.W || 960), H = +(process.env.H || 540);
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || /error|fail|village gen/i.test(s)) logs.push(`[${t}] ${s.slice(0, 700)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(5); } };
const settle = async (max = 60) => { for (let i = 0; i < max; i++) { await step(10); const s = await ev(() => { const g = VR.game; return { busy: g.pool.busy, pend: g.world.pending.size, lod: g.horizon ? g.horizon.inflight : 0, want: g.world.lastWant || 0 }; }); if (s.busy === 0 && s.pend === 0 && s.lod === 0 && !s.want && i > 3) break; await wait(100); } };
const shot = async (name) => { await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }); await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 180000 }); console.log('shot', name); };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.renderDist = 8; g.applySettings('*'); }, process.env.PRESET || 'high');
await ev(`VR.game.createWorld({name:'Base',mode:'creative',difficulty:'peaceful',type:'default',seed:'${process.env.SEED || '424242'}',cheats:true,kit:true})`);
for (let i = 0; i < 90; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.env.setTime(3400); });
await settle(120); await step(30);
const st = await ev(() => { const g = VR.game, p = g.player; return { pos: p.pos.map(v => +v.toFixed(1)), yaw: +p.yaw.toFixed(2), block: g.world.getBlock(Math.floor(p.pos[0]), Math.floor(p.pos[1]) - 1, Math.floor(p.pos[2])) }; });
console.log('spawn', JSON.stringify(st));
await shot('base_spawn');                 // first thing you see: the control room and the portal
await ev(() => { const g = VR.game; g.hideHud = true; const h = document.getElementById('hud'); if (h) h.style.display = 'none'; g.player.pitch = 0.12; g.player.yaw += Math.PI; });
await step(4); await shot('base_back');   // the holo wall & consoles
await ev(() => { const g = VR.game, p = g.player; p.yaw -= Math.PI; p.flying = true; const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw); p.teleport(p.pos[0] + fx * 16, p.pos[1] + 1.2, p.pos[2] + fz * 16); p.yaw += Math.PI; p.pitch = 0.05; });
await settle(60); await step(10); await shot('base_apron');   // from the apron back at the portal
await ev(() => VR.game.env.setTime(15800)); await step(4); await shot('base_apron_night');
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 30)) console.log(l);
await browser.close();

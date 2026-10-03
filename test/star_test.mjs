import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || t === 'warning' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 500)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(15); } };
const shot = async (name) => { const ms = await ev(() => { window.__norender = false; const g = VR.game; const t0 = performance.now(); g.last = performance.now() - 33; g.loop(performance.now()); g.renderer.gl.finish(); window.__norender = true; return performance.now() - t0; }); await wait(150); await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 90000 }); console.log('shot', name, Math.round(ms) + 'ms'); };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.settings.renderDist = 5; g.settings.dynRes = false; g.settings.minimap = false; g.applySettings('renderDist'); });
await ev(`VR.game.createWorld({name:'Star',mode:'creative',difficulty:'normal',type:'default',seed:'${process.env.SEED || '424242'}',cheats:true,kit:true})`);
for (let i = 0; i < 40; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
const out = await ev(() => new Promise((res) => { const g = VR.game, p = g.player; g.pool.direct(0, { type: 'locate', dim: 'overworld', biome: 'outpost', x: Math.floor(p.pos[0]), z: Math.floor(p.pos[2]) }, null, (m) => res(m.pos)); }));
console.log('outpost', JSON.stringify(out));
await ev((o) => { const p = VR.game.player; p.teleport(o[0] + 18.5, o[1] + 9, o[2] + 18.5); p.flying = true; p.yaw = Math.PI * 0.25; p.pitch = -0.35; }, out);
for (let i = 0; i < 14; i++) { await step(20); await wait(250); }
console.log('ships', await ev(() => JSON.stringify(VR.game.starships.ships.map(s => ({ pos: s.pos, yaw: s.yaw, meta: s.d.meta && s.d.meta.name, tris: s.d.meta && Math.round(s.d.meta.tris) })))));
await shot('st1_parked');
// walk on it? check proxy collision
console.log('near', await ev(() => VR.game.starships.near.length));
// board & fly
await ev(() => { const g = VR.game, s = g.starships.ships[0]; if (s) g.starships.board(s, g.player); g.camMode = 1; const i = g.input; i.captured = true; i.keys.add('Space'); });
await step(30);
await ev(() => { const i = VR.game.input; i.keys.delete('Space'); i.keys.add('KeyW'); i.mouse.dx = 60; });
await step(30);
await shot('st2_flying');
console.log('pilot', await ev(() => { const s = VR.game.starships.pilot; return s ? JSON.stringify({ pos: s.pos.map(v => +v.toFixed(1)), vel: s.vel.map(v => +v.toFixed(1)), gear: s.gear.toFixed(2) }) : 'none'; }));
await ev(() => { VR.game.camMode = 0; });
await step(3);
await shot('st3_cockpit');
await ev(() => { const i = VR.game.input; i.keys.delete('KeyW'); });
await step(20);
await ev(() => { VR.game.input.pressed.add('KeyV'); });
await step(2);
console.log('landed', await ev(() => { const g = VR.game; return JSON.stringify({ pilot: !!g.starships.pilot, riding: !!g.gadgets.riding, ships: g.starships.ships.map(s => s.state + '@' + s.pos.map(v => Math.round(v)).join(',')) }); }));
await ev(() => { const g = VR.game; g.camMode = 1; g.player.pitch = -0.3; });
await step(5);
await shot('st4_landed');
// traffic
await ev(() => { const g = VR.game; g.camMode = 0; const p = g.player; p.pitch = 0.35; g.traffic.spawnFlight({ arch: 'carrier' }); g.traffic.spawnFlight({ arch: 'interceptor' }); g.traffic.spawnFlight({ arch: 'freighter' }); });
await wait(1500); await step(10);
await ev(() => { const g = VR.game; for (const s of g.traffic.ships) { s.t = Math.max(s.t, 0.45); } const p = g.player; const s0 = g.traffic.ships[0]; if (s0) { const dx = s0.pos[0] - p.pos[0], dz = s0.pos[2] - p.pos[2]; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(s0.pos[1] - p.pos[1], Math.hypot(dx, dz)); } });
await step(2);
await shot('st5_traffic');
console.log('traffic', await ev(() => JSON.stringify(VR.game.traffic.ships.map(s => s.arch + ' ' + (s.d.meta && s.d.meta.name) + ' ' + s.pos.map(Math.round).join(',')))));
await ev(() => { VR.game.ui.syArch = 'shuttle'; VR.game.ui.openShipyard(); });
await wait(2500);
await page.screenshot({ path: '/home/claude/vr/test/shots/st6_shipyard.png' });
console.log('--- logs (' + logs.length + ')');
for (const l of logs.slice(0, 30)) console.log(l);
await browser.close();

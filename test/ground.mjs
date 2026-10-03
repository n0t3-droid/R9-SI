// "bug with the ground": look straight down at the ground the way the report did (creative, standing,
// yaw -2.5, pitch -0.92), in fresh worlds, before and after placing grass blocks
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const FILE = process.env.FILE || '/home/claude/vr/dist/index.html';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || t === 'warning' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 700)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto('file://' + FILE + (process.env.Q || ''));
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(5); } };
const settle = async (max = 60) => { for (let i = 0; i < max; i++) { await step(10); const s = await ev(() => { const g = VR.game; return { busy: g.pool.busy, pend: g.world.pending.size, lod: g.horizon ? g.horizon.inflight : 0, want: g.world.lastWant || 0 }; }); if (s.busy === 0 && s.pend === 0 && s.lod === 0 && !s.want && i > 3) break; await wait(100); } };
const shot = async (name) => { await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }); await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 120000 }); console.log('shot', name); };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev((pr) => { const g = VR.game; g.applyPreset(pr); g.settings.dynRes = false; g.applySettings('*'); }, process.env.PRESET || 'balanced');
const seed = process.env.SEED || String(Math.floor(Math.random() * 1e9));
console.log('seed', seed);
await ev(`VR.game.createWorld({name:'New World',mode:'creative',difficulty:'normal',type:'default',seed:'${seed}',cheats:true,kit:true})`);
for (let i = 0; i < 60; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { window.requestAnimationFrame = () => 0; VR.game.env.setTime(4000); VR.game.zenFreezeTime = true; });
await settle(80);
const info = async () => await ev(() => { const g = VR.game, p = g.player, w = g.world; const x = Math.floor(p.pos[0]), z = Math.floor(p.pos[2]); const below = []; for (let y = Math.floor(p.pos[1]) - 1; y > Math.floor(p.pos[1]) - 5; y--) below.push(VR.R.T.name ? VR.R.T.name[w.getBlock(x, y, z)] : w.getBlock(x, y, z)); return { pos: p.pos.map(v => +v.toFixed(2)), onGround: p.onGround, flying: p.flying, hold: !!p.hold, top: w.topAt(x, z), below, light: (w.getLight(x, Math.floor(p.pos[1]), z) >>> 12) }; });
console.log('spawn', JSON.stringify(await info()));
await ev(() => { const p = VR.game.player; p.flying = false; p.yaw = -2.496; p.pitch = -0.918; });
await step(30);
console.log('standing', JSON.stringify(await info()));
await shot('ground_a_look');
for (const tod of (process.env.TODS || '').split(',').filter(Boolean)) { await ev((t) => VR.game.env.setTime(+t), tod); await step(4); await shot('ground_tod_' + tod); }
// walk a bit in the look direction, then look down again
await ev(() => { const g = VR.game, p = g.player; p.teleport(p.pos[0] - Math.sin(p.yaw) * -12, p.pos[1] + 3, p.pos[2] - Math.cos(p.yaw) * 12); });
await settle(30); await step(40);
console.log('walked', JSON.stringify(await info()));
await shot('ground_b_look');
// place a few grass blocks on the ground in front, like building
await ev(() => { const g = VR.game, p = g.player, w = g.world; const s = VR.R.byName.grass_block.defaultState; const x0 = Math.floor(p.pos[0]) - 2, z0 = Math.floor(p.pos[2]) - 3; const y0 = w.topAt(x0, z0) + 1; for (let dx = 0; dx < 3; dx++) for (let dz = 0; dz < 3; dz++) w.setBlock(x0 + dx, y0, z0 + dz, s, 0); return y0; });
await step(40);
await shot('ground_c_placed');
// from high above, looking down
await ev(() => { const p = VR.game.player; p.flying = true; p.teleport(p.pos[0], p.pos[1] + 25, p.pos[2]); p.pitch = -1.4; });
await settle(20); await step(20);
await shot('ground_d_above');
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 30)) console.log(l);
await browser.close();

// engine trails: fly a starship in chase view with thrust, and watch sky traffic pass
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 700)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(5); } };
const settle = async (max = 60) => { for (let i = 0; i < max; i++) { await step(10); const s = await ev(() => { const g = VR.game; return { busy: g.pool.busy, pend: g.world.pending.size }; }); if (s.busy === 0 && s.pend === 0 && i > 3) break; await wait(100); } };
const shot = async (name) => { await ev(() => { window.__norender = false; const g = VR.game; g.last = performance.now() - 33; g.loop(performance.now()); g.renderer.gl.finish(); window.__norender = true; }); await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 120000 }); console.log('shot', name); };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.applyPreset('high'); g.settings.dynRes = false; g.applySettings('*'); });
await ev(() => VR.game.createWorld({ name: 'Trails', mode: 'creative', difficulty: 'peaceful', type: 'default', seed: '424242', cheats: true, kit: true }));
for (let i = 0; i < 60; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.env.setTime(11000); window.requestAnimationFrame = () => 0; g.hideHud = true; const h = document.getElementById('hud'); if (h) h.style.display = 'none'; });
await settle(40);
await ev(() => { const g = VR.game; g.starships.placeInFront(12345, 'shuttle', null, g.player); });
for (let i = 0; i < 30; i++) { await step(10); const ok = await ev(() => VR.game.starships.ships.length > 0 && !!VR.game.starships.ships[VR.game.starships.ships.length - 1].d.meta); if (ok) break; await wait(200); }
await ev(() => { const g = VR.game, s = g.starships.ships[g.starships.ships.length - 1]; g.starships.board(s, g.player); s.pos[1] += 40; g.camMode = 1; g.player.pitch = -0.05; });
// fly: hold W and a little turn
await ev(() => { VR.game.input.keys.add('KeyW'); VR.game.input.keys.add('ControlLeft'); });
for (let i = 0; i < 12; i++) { await ev(() => { VR.game.player.yaw += 0.03; }); await step(10); }
await shot('trails_chase');
await ev(() => { VR.game.input.keys.delete('ControlLeft'); VR.game.env.setTime(15500); });
for (let i = 0; i < 6; i++) { await ev(() => { VR.game.player.yaw -= 0.05; }); await step(10); }
await shot('trails_chase_night');
await ev(() => { VR.game.input.keys.clear(); });
// sky traffic seen from the side
await ev(() => { const g = VR.game; g.starships.leave && g.starships.leave(); g.env.setTime(4000); for (let k = 0; k < 3; k++) g.traffic.spawnFlight(); });
for (let i = 0; i < 40; i++) { await step(10); const n = await ev(() => VR.game.traffic.ships.filter(s => s.t > 0.25 && !s.warpOut).length); if (n) break; }
await ev(() => { const g = VR.game, s = g.traffic.ships.find(s => s.t > 0.25 && !s.warpOut) || g.traffic.ships[0]; if (!s) return; const h = s.heading, side = [Math.cos(h), 0, -Math.sin(h)]; g.player.teleport(s.pos[0] + side[0] * 30, s.pos[1], s.pos[2] + side[2] * 30); g.player.flying = true; g.vehicleCam = (cam) => { const q = s.pos; return { x: q[0] + side[0] * 40 + Math.sin(h) * 25, y: q[1] + 4, z: q[2] + side[2] * 40 + Math.cos(h) * 25, yaw: Math.atan2(-(q[0] - (q[0] + side[0] * 40 + Math.sin(h) * 25)), -(q[2] - (q[2] + side[2] * 40 + Math.cos(h) * 25))), pitch: -0.05, roll: 0, fov: cam.fov, far: cam.far, fixed: true }; }; });
await step(20);
await shot('trails_traffic');
console.log('trails', await ev(() => VR.game.trails.map.size));
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 20)) console.log(l);
await browser.close();

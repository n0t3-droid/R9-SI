// what a flight looks like: the player jumps 1.2 km ahead and the picture is taken right away (LOD stands in),
// after a couple of seconds (chunks arriving) and once everything settled; plus a high aerial view of the
// chunk ↔ horizon transition. PRESET / SEED / TAG env.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const W = +(process.env.W || 1280), H = +(process.env.H || 720);
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 700)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 16) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(2); } };
const shot = async (name) => { await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }); await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 180000 }); console.log('shot', name); };
const stat = () => ev(() => { const g = VR.game, w = g.world, p = g.player, rd = w.renderDist; const pcx = Math.floor(p.pos[0]) >> 4, pcz = Math.floor(p.pos[2]) >> 4; let miss = 0, n = 0; for (let dz = -rd; dz <= rd; dz++) for (let dx = -rd; dx <= rd; dx++) { if (dx * dx + dz * dz > rd * rd) continue; n++; const c = w.col(pcx + dx, pcz + dz); if (!c) { miss++; continue; } for (const s of c.sec) if (s.dirty || s.pending) { miss++; break; } } return { missing: Math.round(100 * miss / n) + '%', cols: w.cols.size, hz: g.horizon.tiles.size, hzDrawn: g.horizon.stats.drawn, hzTris: Math.round(g.horizon.stats.tris / 1000) + 'k', hzProg: +g.horizon.progress().toFixed(2), gpuMB: Math.round(g.renderer.gpuMemoryMB()) }; });
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
const preset = process.env.PRESET || 'balanced', tag = process.env.TAG || preset;
await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.applySettings('*'); window.requestAnimationFrame = () => 0; }, preset);
const t0 = Date.now();
await ev((seed) => VR.game.createWorld({ name: 'Fly', mode: 'creative', difficulty: 'peaceful', type: 'default', seed, cheats: true, kit: false }), process.env.SEED || '4242');
for (let i = 0; i < 400; i++) { await step(10); if (await ev(() => VR.game.state) === 'play') break; await wait(20); }
console.log('play after', ((Date.now() - t0) / 1000).toFixed(1), 's', JSON.stringify(await stat()));
await ev((tod) => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; g.hideHud = true; const h = document.getElementById('hud'); if (h) h.style.display = 'none'; g.env.setTime(tod); const p = g.player; p.flying = true; p.noclip = true; }, +(process.env.TOD || 4000));
// real-time run until the radius is full
const run = async (sec) => { const ts = Date.now(); while (Date.now() - ts < sec * 1000) { await ev(() => { const g = VR.game; g.last = performance.now() - 16; g.loop(performance.now()); }); await wait(12); } };
await run(12);
console.log('settled', JSON.stringify(await stat()));
const sp = await ev(() => VR.game.player.pos.slice());
// aerial view of the transition
await ev(([sp]) => { const p = VR.game.player; p.teleport(sp[0], 150, sp[2]); p.yaw = 0.8; p.pitch = -0.35; }, [sp]);
await run(3);
await shot(`fly_${tag}_1_aerial`); console.log('  ', JSON.stringify(await stat()));
// the jump: 1.2 km ahead at 120 m, looking forward and slightly down
await ev(([sp, jy]) => { const p = VR.game.player; p.teleport(sp[0] + 1200, jy, sp[2]); p.yaw = Math.PI * 1.5; p.pitch = -0.28; }, [sp, +(process.env.JY || 230)]);
await ev(() => { const g = VR.game; g.last = performance.now() - 16; g.loop(performance.now()); });
await shot(`fly_${tag}_2_jump_t0`); console.log('  t0', JSON.stringify(await stat()));
await run(2);
await shot(`fly_${tag}_3_jump_t2`); console.log('  t2', JSON.stringify(await stat()));
await run(6);
await shot(`fly_${tag}_4_jump_t8`); console.log('  t8', JSON.stringify(await stat()));
// ground level there: the near detail
await ev(() => { const g = VR.game, p = g.player, w = g.world; const y = w.topAt(Math.floor(p.pos[0]), Math.floor(p.pos[2])); p.teleport(p.pos[0], y + 2, p.pos[2]); p.pitch = -0.05; });
await run(3);
await shot(`fly_${tag}_5_ground`); console.log('  ground', JSON.stringify(await stat()));
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 12)) console.log(l);
await browser.close();

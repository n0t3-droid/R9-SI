// hero looks: the local player in third person (front view) in each suit, with and without a blaster
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 700)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(5); } };
const settle = async (max = 60) => { for (let i = 0; i < max; i++) { await step(10); const s = await ev(() => { const g = VR.game; return { busy: g.pool.busy, pend: g.world.pending.size }; }); if (s.busy === 0 && s.pend === 0 && i > 3) break; await wait(100); } };
const shot = async (name) => { await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }); await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 120000 }); console.log('shot', name); };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.applyPreset('high'); g.settings.dynRes = false; g.applySettings('*'); });
await ev(() => VR.game.createWorld({ name: 'Heroes', mode: 'creative', difficulty: 'peaceful', type: 'default', seed: '424242', cheats: true, kit: true }));
for (let i = 0; i < 60; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.env.setTime(3500); window.requestAnimationFrame = () => 0; g.hideHud = true; const h = document.getElementById('hud'); if (h) h.style.display = 'none'; });
await settle(60);
const n = await ev(() => VR.Folk.HERO_SUITS.length);
for (let i = 0; i < (+process.env.N || n); i++) {
  await ev((i) => { const g = VR.game, p = g.player; g.settings.hero = { suit: i, hair: (i * 3) % 7, hs: i % 9, skin: (i * 2) % 7, lashes: i & 1 }; g.camMode = 2; p.pitch = -0.1; p.flying = false; const inv = p.inv; inv.slots[inv.sel] = (i & 1) ? { id: 'laser_blaster', n: 1 } : { id: 'grass_block', n: 64 }; }, i);
  await step(6);
  await shot('hero_' + i);
  if (process.env.SIDE) {
    await ev(() => { const g = VR.game, p = g.player; g.camMode = 1; const y = p.yaw + Math.PI / 2; const fx = -Math.sin(y), fz = -Math.cos(y); g.vehicleCam = (cam) => ({ x: p.pos[0] - fx * 3.2, y: p.pos[1] + 1.2, z: p.pos[2] - fz * 3.2, yaw: y, pitch: -0.05, roll: 0, fov: cam.fov, far: cam.far, fixed: true }); });
    await step(3); await shot('hero_side_' + i); await ev(() => { VR.game.vehicleCam = null; });
  }
}
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 20)) console.log(l);
await browser.close();

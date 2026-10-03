// R9 Super Resolution while playing: walking + turning at 60 fps; compare native, plain 50% and R9SR 50%
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const W = +(process.env.W || 960), H = +(process.env.H || 540);
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const logs = [];
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(5); } };
const settle = async (max = 60) => { for (let i = 0; i < max; i++) { await step(10); const s = await ev(() => { const g = VR.game; return { busy: g.pool.busy, pend: g.world.pending.size }; }); if (s.busy === 0 && s.pend === 0 && i > 3) break; await wait(100); } };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.applyPreset('low'); g.settings.dynRes = false; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'TSRm',mode:'creative',difficulty:'peaceful',type:'default',seed:'${process.env.SEED || '424242'}',cheats:true,kit:true})`);
for (let i = 0; i < 60; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev((f) => { window.__frames = f; }, +(process.env.FRAMES || 40));
await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; const h = document.getElementById('hud'); if (h) h.style.display = 'none'; g.env.setTime(3000); });
await settle(100);
const start = await ev(() => { const p = VR.game.player; return [p.pos[0], p.pos[1], p.pos[2], p.yaw]; });
const run = async (name, o) => {
  await ev(([o, s]) => { const g = VR.game; Object.assign(g.settings, o); g.applySettings('*'); const p = g.player; p.teleport(s[0], s[1], s[2]); p.yaw = s[3]; p.pitch = -0.1; p.flying = false; }, [o, start]);
  await ev(() => { window.__norender = false; const g = VR.game, p = g.player; for (let i = 0; i < +(window.__frames || 40); i++) { p.yaw += 0.018 * Math.sin(i * 0.15); const f = 0.07; p.pos[0] -= Math.sin(p.yaw) * f; p.pos[2] -= Math.cos(p.yaw) * f; g.last = performance.now() - 16; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; });
  await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 180000 }); console.log('shot', name);
};
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const R = async (n, o, dbg) => { if (only && !only.includes(n)) return; await ev((d) => { Object.assign(VR.game.renderer, { dbgNoDither: false, dbgMip1: false }, d || {}); }, dbg || {}); await run(n, o); };
await R('mo_native', { scale: 1, tsr: false, fxaa: true });
await R('mo_75_plain', { scale: 0.75, tsr: false, fxaa: true });
await R('mo_75_r9sr', { scale: 0.75, tsr: true, sharpen: true });
await R('mo_100_r9sr', { scale: 1, tsr: true, sharpen: true });
await R('mo_50_r9sr', { scale: 0.5, tsr: true, sharpen: true });
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 20)) console.log(l);
await browser.close();

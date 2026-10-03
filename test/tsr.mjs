// R9 Super Resolution: same view at native res, at 50% without and with temporal upscaling, and while turning
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const W = +(process.env.W || 960), H = +(process.env.H || 540);
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 700)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(5); } };
const settle = async (max = 60) => { for (let i = 0; i < max; i++) { await step(10); const s = await ev(() => { const g = VR.game; return { busy: g.pool.busy, pend: g.world.pending.size, lod: g.horizon ? g.horizon.inflight : 0, want: g.world.lastWant || 0 }; }); if (s.busy === 0 && s.pend === 0 && s.lod === 0 && !s.want && i > 3) break; await wait(100); } };
const shot = async (name, frames = 2, turn = 0) => { await ev(([n, turn]) => { window.__norender = false; const g = VR.game; for (let i = 0; i < n; i++) { g.player.yaw += turn; g.last = performance.now() - 16; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }, [frames, turn]); await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 120000 }); console.log('shot', name); };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.applyPreset('high'); g.settings.dynRes = false; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'TSR',mode:'creative',difficulty:'peaceful',type:'default',seed:'${process.env.SEED || '424242'}',cheats:true,kit:true})`);
for (let i = 0; i < 60; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; const h = document.getElementById('hud'); if (h) h.style.display = 'none'; g.env.setTime(3000); const p = g.player; p.flying = true; p.pitch = -0.2; });
await settle(100); await step(20);
const set = (o) => ev((o) => { const g = VR.game; Object.assign(g.settings, o); g.applySettings('*'); }, o);
await set({ scale: 1, tsr: false, fxaa: true }); await shot('tsr_native', 3);
await set({ scale: 0.5, tsr: false, fxaa: true }); await shot('tsr_half_plain', 3);
await set({ scale: 0.5, tsr: true }); await shot('tsr_half_r9sr', 16);
await shot('tsr_half_r9sr_turn', 12, 0.01);
await set({ scale: 1, tsr: true }); await shot('tsr_native_taa', 16);
// timing on this machine (software GL): ms per rendered frame
const t = await ev(() => { const g = VR.game, r = g.renderer; const out = {}; for (const [k, sc, ts] of [['native', 1, false], ['half', 0.5, false], ['half_r9sr', 0.5, true]]) { Object.assign(g.settings, { scale: sc, tsr: ts }); g.applySettings('*'); window.__norender = false; for (let i = 0; i < 2; i++) g.loop(performance.now()); r.gl.finish(); const t0 = performance.now(); for (let i = 0; i < 6; i++) { g.last = performance.now() - 16; g.loop(performance.now()); } r.gl.finish(); out[k] = +((performance.now() - t0) / 6).toFixed(1); } window.__norender = true; return out; });
console.log('ms/frame', JSON.stringify(t));
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 20)) console.log(l);
await browser.close();

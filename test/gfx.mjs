// graphics check: the same views at each preset — screenshots + render cost (SwiftShader is a CPU
// rasterizer: absolute ms mean little, but relative cost between presets/features tracks fill-rate cost)
// env: PRESETS=low,balanced,high  TAG=a  VIEWS=village,vista,golden  W=960 H=540
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const W = +(process.env.W || 960), H = +(process.env.H || 540);
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 700)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto('file:///home/claude/vr/dist/index.html' + (process.env.Q || ''));
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(5); } };
const settle = async (max = 60) => { for (let i = 0; i < max; i++) { await step(10); const s = await ev(() => { const g = VR.game; return { busy: g.pool.busy, pend: g.world.pending.size, lod: g.horizon ? g.horizon.inflight : 0, want: g.world.lastWant || 0 }; }); if (s.busy === 0 && s.pend === 0 && s.lod === 0 && !s.want && i > 3) break; await wait(100); } };
const render = async (n) => await ev((n) => {
  window.__norender = false; const g = VR.game, r = g.renderer, gl = r.gl; const ts = []; r.stats.shadowRenders = 0;
  for (let i = 0; i < n; i++) { g.last = performance.now() - 33; const t0 = performance.now(); g.loop(performance.now()); gl.finish(); ts.push(performance.now() - t0); }
  window.__norender = true; ts.sort((a, b) => a - b);
  return { ms: +ts[Math.floor(ts.length / 2)].toFixed(1), scale: r.q.scale, w: r.w, h: r.h, draws: r.stats.draws, shadowDraws: r.stats.shadowDraws, shadowRenders: r.stats.shadowRenders || 0 };
}, n);
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.settings.dynRes = false; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Gfx',mode:'creative',difficulty:'peaceful',type:'default',seed:'${process.env.SEED || '424242'}',cheats:true,kit:true})`);
for (let i = 0; i < 60; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; const h = document.getElementById('hud'); if (h) h.style.display = 'none'; });
const home = await ev(() => VR.game.player.pos.slice());
const VIEWS = {
  // standing in the village in the morning light
  village: { pos: [0, 1, 0], yaw: 0.6, pitch: -0.12, tod: 2600 },
  // up high, the land toward the far horizon, late afternoon (long shadows)
  vista: { pos: [-30, 38, 20], yaw: 2.4, pitch: -0.28, tod: 9800 },
  // golden hour, looking toward the setting sun
  golden: { pos: [10, 12, -10], yaw: -1.57, pitch: -0.1, tod: 11500 },
};
const tag = process.env.TAG || 'a';
const presets = (process.env.PRESETS || 'low,balanced,high').split(',');
const views = (process.env.VIEWS || 'village,vista,golden').split(',');
const results = {};
for (const pr of presets) {
  await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.applySettings('*'); }, pr);
  for (const v of views) {
    const V = VIEWS[v];
    await ev(([h, V]) => { const g = VR.game, p = g.player; p.flying = true; p.teleport(h[0] + V.pos[0], h[1] + V.pos[1], h[2] + V.pos[2]); p.yaw = V.yaw; p.pitch = V.pitch; g.env.setTime(V.tod); }, [home, V]);
    await settle(70);
    const r = await render(7);
    results[pr + '/' + v] = r;
    await page.screenshot({ path: `/home/claude/vr/test/shots/gfx_${tag}_${pr}_${v}.png`, timeout: 120000 });
    console.log(pr.padEnd(9), v.padEnd(8), JSON.stringify(r));
  }
}
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 25)) console.log(l);
await browser.close();

// look-dev: load once, then render the same views with different environment tweaks
// usage: node test/look.mjs  (edit VARIANTS below; env PRESET=high VIEWS=village,golden)
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
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
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
const preset = process.env.PRESET || 'high';
await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.applySettings('*'); }, preset);
await ev(`VR.game.createWorld({name:'Look',mode:'creative',difficulty:'peaceful',type:'default',seed:'${process.env.SEED || '424242'}',cheats:true,kit:true})`);
for (let i = 0; i < 60; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; const h = document.getElementById('hud'); if (h) h.style.display = 'none';
  // post-process the environment each frame with window.__tweak (a function body string)
  const u = g.env.update.bind(g.env); g.env.update = (dt, o) => { const E = u(dt, o); if (window.__tweak) { try { window.__tweak(E); } catch (e) { console.error(e); } } return E; }; });
const home = await ev(() => VR.game.player.pos.slice());
const VIEWS = {
  village: { pos: [0, 1, 0], yaw: 0.6, pitch: -0.12, tod: 2600 },
  vista: { pos: [-30, 38, 20], yaw: 2.4, pitch: -0.28, tod: 9800 },
  golden: { pos: [10, 12, -10], yaw: 1.57, pitch: -0.1, tod: 11400 },
  noon: { pos: [0, 30, 40], yaw: 3.1, pitch: -0.35, tod: 6000 },
  night: { pos: [0, 1, 0], yaw: 0.6, pitch: -0.05, tod: 16500 },
};
const variants = JSON.parse(fs.readFileSync(process.env.VARIANTS || '/home/claude/vr/test/look_variants.json', 'utf8'));
const views = (process.env.VIEWS || 'village,golden').split(',');
for (const v of views) {
  const V = VIEWS[v];
  await ev(([h, V]) => { const g = VR.game, p = g.player; p.flying = true; p.teleport(h[0] + V.pos[0], h[1] + V.pos[1], h[2] + V.pos[2]); p.yaw = V.yaw; p.pitch = V.pitch; g.env.setTime(V.tod); }, [home, V]);
  await settle(70);
  for (const [name, body] of Object.entries(variants)) {
    await ev((body) => { window.__tweak = body ? new Function('E', body) : null; }, body);
    await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 3; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; });
    await page.screenshot({ path: `/home/claude/vr/test/shots/look_${v}_${name}.png`, timeout: 120000 });
    console.log('shot', v, name);
  }
}
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 25)) console.log(l);
await browser.close();

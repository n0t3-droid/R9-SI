// where does the main-thread time go in the city street? per-system timings over 120 sim frames (no rendering)
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Prof',mode:'creative',difficulty:'peaceful',type:'default',seed:'4242',cheats:true,kit:true})`);
for (let i = 0; i < 90; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; g.env.rain = 0; g.env.rainTarget = 0; g.hideHud = true; window.requestAnimationFrame = () => 0; const pl = g.player; pl.flying = true; pl.teleport(-30, 83, -150); pl.yaw = 1.2; pl.pitch = 0; });
for (let i = 0; i < 150; i++) { await ev(() => { const g = VR.game; g.last = performance.now() - 33; g.loop(performance.now()); }); const s = await ev(() => { const g = VR.game; return { busy: g.pool.busy, pend: g.world.pending.size }; }); if (s.busy === 0 && s.pend === 0 && i > 10) break; await wait(150); }
const r = await ev(() => {
  const g = VR.game, R = g.renderer;
  if (!R._render) { R._render = R.render; R.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; }
  window.__norender = true;
  const T = {};
  const wrap = (obj, name, label) => { const f = obj[name]; if (!f) return; obj[name] = function () { const t0 = performance.now(); const r = f.apply(this, arguments); T[label] = (T[label] || 0) + performance.now() - t0; return r; }; };
  wrap(g.villages, 'updateAgent', 'agents'); wrap(g.villages, 'separate', 'separate'); wrap(g.villages, 'updateDoors', 'doors'); wrap(g.villages, 'updateBubbles', 'bubbles'); wrap(g.villages, 'update', 'villages.total');
  wrap(g.world, 'update', 'world'); wrap(g.entities, 'update', 'entities'); if (g.sim) wrap(g.sim, 'update', 'sim'); if (g.particles) wrap(g.particles, 'update', 'particles'); if (g.horizon) wrap(g.horizon, 'update', 'horizon');
  if (g.starships) wrap(g.starships, 'update', 'starships'); if (g.traffic) wrap(g.traffic, 'update', 'traffic'); if (g.trails) wrap(g.trails, 'update', 'trails'); if (g.trams) wrap(g.trams, 'update', 'trams'); if (g.gadgets) wrap(g.gadgets, 'update', 'gadgets');
  wrap(g, 'envFor', 'env'); wrap(g.player, 'update', 'player'); if (g.audio) wrap(g.audio, 'update', 'audio');
  const F = VR.Folk; if (F && F.findPath) wrap(F, 'findPath', 'findPath');
  const N = 120, t0 = performance.now();
  for (let i = 0; i < N; i++) { g.last = performance.now() - 16.7; g.loop(performance.now()); }
  const total = performance.now() - t0;
  const out = { totalPerFrame: +(total / N).toFixed(2), villagers: g.villages.agents.length };
  for (const k in T) out[k] = +(T[k] / N).toFixed(2);
  return out;
});
console.log(JSON.stringify(r));
await browser.close();

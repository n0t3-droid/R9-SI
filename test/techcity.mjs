// find a tropical tech city near spawn, fly there, screenshot it by day, at dusk and at night
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
const shot = async (name) => { await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }); await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 120000 }); console.log('shot', name); };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
const seed = process.env.SEED || '424242';
await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.applySettings('*'); }, process.env.PRESET || 'high');
const found = await ev((seed) => {
  const gen = new VR.OverworldGen(VR.M ? VR.hashSeed ? VR.hashSeed(seed) : seed : seed);
  return null;
}, seed).catch(() => null);
await ev(`VR.game.createWorld({name:'Tech',mode:'creative',difficulty:'peaceful',type:'default',seed:'${seed}',cheats:true,kit:true})`);
for (let i = 0; i < 60; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; const h = document.getElementById('hud'); if (h) h.style.display = 'none'; });
// search village sites with a generator on this page (same seed as the world)
const site = await ev(() => {
  const g = VR.game;
  const gen = new VR.OverworldGen(g.meta.seed >>> 0, {});
  const VG = VR.VillageGen; let best = null, bd = 1e18;
  const p = g.player.pos;
  for (let i = -8; i <= 8; i++) for (let j = -8; j <= 8; j++) {
    const s = VG.site(gen, i, j); if (!s || s.style !== 'tech') continue;
    const d = (s.x - p[0]) ** 2 + (s.z - p[2]) ** 2; if (d < bd) { bd = d; best = { x: s.x, y: s.y, z: s.z, name: s.name, biome: s.biome, dist: Math.round(Math.sqrt(d)) }; }
  }
  return best;
});
console.log('tech site', JSON.stringify(site));
if (site) {
  await ev((s) => { const p = VR.game.player; p.flying = true; p.teleport(s.x - 26, s.y + 22, s.z + 26); p.yaw = Math.atan2(-(s.x - (s.x - 26)), -(s.z - (s.z + 26))); p.pitch = -0.42; VR.game.env.setTime(3600); }, site);
  await settle(120); await step(30);
  await shot('tech_city_day');
  await ev(() => VR.game.env.setTime(12300)); await step(4); await shot('tech_city_dusk');
  await ev(() => VR.game.env.setTime(16000)); await step(4); await shot('tech_city_night');
  // street level on the plaza
  await ev((s) => { const p = VR.game.player; p.teleport(s.x + 3.5, s.y + 1.2, s.z + 6.5); p.yaw = Math.atan2(-(s.x - (s.x + 3.5)), -(s.z - (s.z + 6.5))); p.pitch = 0.02; VR.game.env.setTime(4200); }, site);
  await settle(40); await step(20);
  await shot('tech_city_street');
  await ev(() => VR.game.env.setTime(15500)); await step(4); await shot('tech_city_street_night');
}
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 30)) console.log(l);
await browser.close();

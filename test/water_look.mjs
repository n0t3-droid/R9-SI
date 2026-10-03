import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const FILE = process.env.FILE || 'index.html', TAG = process.env.TAG || 'new';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const logs = [];
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 800)));
await page.goto('file:///home/claude/vr/dist/' + FILE);
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 20) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(20, n - k), dtms]); } };
const shot = async (name, tod) => { await ev((tod) => { window.__norender = false; const g = VR.game; g.env.setTime(tod); g.env.rain = 0; g.env.rainTarget = 0; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }, tod); await wait(200); await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 120000 }); console.log('shot', name); };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.settings.renderDist = 7; g.settings.dynRes = false; g.settings.minimap = false; g.applySettings('renderDist'); });
await ev(`VR.game.createWorld({name:'Water',mode:'creative',difficulty:'peaceful',type:'default',seed:'${process.env.SEED || '777'}',cheats:true,kit:true})`);
for (let i = 0; i < 60; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; g.hideHud = true; document.getElementById('hud').style.visibility = 'hidden'; });
for (let i = 0; i < 20; i++) { await step(20); await wait(250); }
// go to the nearest ocean and find a broad, deep water surface
const oc = await ev(() => new Promise((res) => { const g = VR.game, p = g.player; g.pool.direct(0, { type: 'locate', dim: 'overworld', biome: 'ocean', x: Math.floor(p.pos[0]), z: Math.floor(p.pos[2]) }, null, (m) => res(m.pos)); }));
console.log('ocean', JSON.stringify(oc));
if (oc) { await ev((o) => { const p = VR.game.player; p.teleport(o[0] + 0.5, 90, o[2] + 0.5); p.flying = true; }, oc); for (let i = 0; i < 24; i++) { await step(20); await wait(300); } }
const spot = await ev(() => {
  const g = VR.game, w = g.world, p = g.player, R = VR.R;
  let best = null, bs = 0;
  for (let dz = -60; dz <= 60; dz += 4) for (let dx = -60; dx <= 60; dx += 4) {
    const x = Math.floor(p.pos[0] + dx), z = Math.floor(p.pos[2] + dz);
    if (!w.isLoaded(x, z)) continue;
    const y = w.topAt(x, z); const s = w.getBlock(x, y, z);
    if (!(R.T.flags[s] & VR.F.WATER)) continue;
    let depth = 0; while (depth < 30 && (R.T.flags[w.getBlock(x, y - depth, z)] & VR.F.WATER)) depth++;
    if (depth > bs) { bs = depth; best = [x, y, z, depth]; }
  }
  return best;
});
console.log('water at', JSON.stringify(spot));
if (spot) {
  const look = async (name, dir, tod) => {
    await ev(([s, dir]) => { const p = VR.game.player; const x = s[0] - dir[0] * 10, z = s[2] - dir[1] * 10; p.teleport(x, s[1] + 7, z); p.flying = true; p.yaw = Math.atan2(dir[0], dir[1]) + Math.PI; p.pitch = -0.32; }, [spot, dir]);
    await step(2);
    await shot(name, tod);
  };
  for (const [nm, tod] of [['day', 3500], ['gold', 11300]]) {
    await look(`water_${TAG}_${nm}_E`, [1, 0], tod);
    await look(`water_${TAG}_${nm}_W`, [-1, 0], tod);
  }
}
console.log(logs.slice(0, 5).join('\n'));
await browser.close();

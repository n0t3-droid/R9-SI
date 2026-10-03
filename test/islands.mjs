// sky islands: find an archipelago near spawn and photograph it from the side and from above
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
const settle = async (max = 60) => { for (let i = 0; i < max; i++) { await step(10); const s = await ev(() => { const g = VR.game; return { busy: g.pool.busy, pend: g.world.pending.size, lod: g.horizon ? g.horizon.inflight : 0, want: g.world.lastWant || 0 }; }); if (s.busy === 0 && s.pend === 0 && s.lod === 0 && !s.want && i > 3) break; await wait(100); } };
const shot = async (name) => { await ev(() => { window.__norender = false; const g = VR.game; g.last = performance.now() - 33; g.loop(performance.now()); g.renderer.gl.finish(); window.__norender = true; }); await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 120000 }); console.log('shot', name); };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.applyPreset('high'); g.settings.dynRes = false; g.applySettings('*'); });
const seed = process.env.SEED || '424242';
await ev(`VR.game.createWorld({name:'Isles',mode:'creative',difficulty:'peaceful',type:'default',seed:'${seed}',cheats:true,kit:true})`);
for (let i = 0; i < 60; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; const h = document.getElementById('hud'); if (h) h.style.display = 'none'; });
const spot = await ev(() => {
  const g = VR.game, gen = new VR.OverworldGen(g.meta.seed >>> 0, {}), p = g.player.pos;
  let best = null, bs = -1;
  for (let r = 0; r < 1600; r += 24) for (let a = 0; a < 24; a++) {
    const x = Math.round(p[0] + Math.cos(a / 24 * 6.283) * r), z = Math.round(p[2] + Math.sin(a / 24 * 6.283) * r);
    // count island columns around
    let n = 0; for (let dx = -60; dx <= 60; dx += 12) for (let dz = -60; dz <= 60; dz += 12) if (gen.islandAt(x + dx, z + dz)) n++;
    if (n > bs) { bs = n; best = [x, z, n]; }
    if (bs > 60) break;
  }
  // the biggest island near there
  let big = null;
  const ci = Math.floor(best[0] / 72), cj = Math.floor(best[1] / 72);
  for (let j = cj - 3; j <= cj + 3; j++) for (let i = ci - 3; i <= ci + 3; i++) { const c = gen.islandCell(i, j); if (c && (!big || c.r > big.r)) big = c; }
  const I = big ? gen.islandAt(Math.round(big.x), Math.round(big.z)) : null;
  return { x: big ? Math.round(big.x) : best[0], z: big ? Math.round(big.z) : best[1], n: best[2], r: big ? big.r : 0, top: I ? I.top : 160, falls: big ? big.falls : 0 };
});
console.log('archipelago', JSON.stringify(spot));
await ev((s) => { const p = VR.game.player; p.flying = true; p.teleport(s.x - s.r * 3.2 - 20, s.top - 14, s.z + 6); p.yaw = -Math.PI / 2; p.pitch = 0.06; VR.game.env.setTime(9200); }, spot);
await settle(120); await step(20);
await shot('isles_side');
await ev((s) => { const p = VR.game.player; p.teleport(s.x - 40, s.top + 40, s.z - 40); p.pitch = -0.55; VR.game.env.setTime(4200); }, spot);
await settle(60); await step(10);
await shot('isles_above');
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 20)) console.log(l);
await browser.close();

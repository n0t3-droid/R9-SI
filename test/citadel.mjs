// citadels: fly to the nearest one and photograph it from the side, from the terrace and from afar (horizon LOD)
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const W = +(process.env.W || 960), H = +(process.env.H || 540);
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || /error|fail|citadel gen/i.test(s)) logs.push(`[${t}] ${s.slice(0, 700)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(5); } };
const settle = async (max = 60) => { for (let i = 0; i < max; i++) { await step(10); const s = await ev(() => { const g = VR.game; return { busy: g.pool.busy, pend: g.world.pending.size, lod: g.horizon ? g.horizon.inflight : 0, want: g.world.lastWant || 0 }; }); if (s.busy === 0 && s.pend === 0 && s.lod === 0 && !s.want && i > 3) break; await wait(100); } };
const shot = async (name) => { await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }); await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 180000 }); console.log('shot', name); };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.renderDist = 14; g.applySettings('*'); }, process.env.PRESET || 'high');
await ev(`VR.game.createWorld({name:'Cit',mode:'creative',difficulty:'peaceful',type:'default',seed:'${process.env.SEED || '424242'}',cheats:true,kit:true})`);
for (let i = 0; i < 60; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; const h = document.getElementById('hud'); if (h) h.style.display = 'none'; g.env.setTime(3200); });
const s = await ev(() => { const g = VR.game, gen = new VR.OverworldGen(g.meta.seed >>> 0, { vgen: g.meta.vgen || 3 }); const p = g.player.pos; const s = gen.nearestCitadel(p[0], p[2], 4000); return s ? { x: s.x, y: s.y, z: s.z, R: s.R, h: s.towers[0].h, n: s.towers.length, pal: s.pal } : null; });
console.log('citadel', JSON.stringify(s));
const look = async (from, to, pitch) => { await ev(([c, t, p]) => { const pl = VR.game.player; pl.flying = true; pl.teleport(c[0], c[1], c[2]); pl.yaw = Math.atan2(-(t[0] - c[0]), -(t[2] - c[2])); pl.pitch = p; }, [from, to, pitch]); await settle(150); await step(20); };
if (s) {
  await look([s.x + 120, s.y + 40, s.z + 120], [s.x, s.y + 55, s.z], null); await shot('cit_side');
  await ev(() => VR.game.env.setTime(12400)); await step(4); await shot('cit_side_dusk');
  await ev(() => VR.game.env.setTime(16500)); await step(4); await shot('cit_side_night');
  await ev(() => VR.game.env.setTime(3200));
  await look([s.x + 30, s.y + 2.6, s.z + 30], [s.x, s.y + 40, s.z], 0.5); await shot('cit_terrace');
  await look([s.x + 380, s.y + 60, s.z + 380], [s.x, s.y + 20, s.z], -0.08); await shot('cit_far');
}
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 30)) console.log(l);
await browser.close();

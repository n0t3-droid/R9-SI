// world survey: photographs the places the trailer shows — spawn/base, the home city, the nearest citadel,
// sky islands and ember canyons — so a build can be compared against the trailer frames side by side.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const W = +(process.env.W || 1296), H = +(process.env.H || 704);
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 700)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(5); } };
const settle = async (max = 120) => { for (let i = 0; i < max; i++) { await step(10); const s = await ev(() => { const g = VR.game; return { busy: g.pool.busy, pend: g.world.pending.size, lod: g.horizon ? g.horizon.inflight : 0, want: g.world.lastWant || 0 }; }); if (s.busy === 0 && s.pend === 0 && s.lod === 0 && !s.want && i > 3) break; await wait(100); } };
const shot = async (name) => { await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }); await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 180000 }); console.log('shot', name); };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.renderDist = +(window.__rd || 10); g.settings.horizon = 2; g.applySettings('*'); }, process.env.PRESET || 'high');
await ev(`window.__rd=${process.env.RD || 10}; window.__tod=${process.env.TOD || 3200}`);
await ev(`VR.game.createWorld({name:'Survey',mode:'creative',difficulty:'peaceful',type:'default',seed:'${process.env.SEED || '4242'}',cheats:true,kit:true})`);
for (let i = 0; i < 90; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; const h = document.getElementById('hud'); if (h) h.style.display = 'none'; g.env.setTime(+(window.__tod || 3200)); });
const tag = process.env.TAG || 'cur';
const info = await ev(() => {
  const g = VR.game, gen = new VR.OverworldGen(g.meta.seed >>> 0, { vgen: g.meta.vgen || 3 });
  const p = g.player.pos;
  const cit = gen.nearestCitadel ? gen.nearestCitadel(p[0], p[2], 4000) : null;
  const vil = gen.villageNear ? gen.villageNear(p[0], p[2], 200) : null;
  let isle = null;
  for (let r = 0; r < 1200 && !isle; r += 24) for (let a = 0; a < 16 && !isle; a++) { const x = Math.round(p[0] + Math.cos(a * 0.3927) * r), z = Math.round(p[2] + Math.sin(a * 0.3927) * r); const I = gen.islandAt(x, z); if (I && I.isle && I.isle.r > 18) isle = { x: I.isle.x, z: I.isle.z, y: I.isle.y, r: I.isle.r }; }
  let ember = null;
  for (let r = 0; r < 2400 && !ember; r += 32) for (let a = 0; a < 16 && !ember; a++) { const x = Math.round(p[0] + Math.cos(a * 0.3927) * r), z = Math.round(p[2] + Math.sin(a * 0.3927) * r); const cl = gen.climateAt(x, z); if (cl.ember > 0.7) ember = { x, z, y: gen.surfaceY(x, z) }; }
  return { spawn: p.map(v => +v.toFixed(1)), yaw: g.player.yaw, cit: cit ? { x: cit.x, y: cit.y, z: cit.z, R: cit.R, h: cit.towers[0].h } : null, vil: vil ? { x: vil.x, z: vil.z, rad: vil.rad } : null, isle, ember };
});
console.log('info', JSON.stringify(info));
const look = async (from, to, pitch) => { await ev(([c, t, p]) => { const pl = VR.game.player; pl.flying = true; pl.teleport(c[0], c[1], c[2]); pl.yaw = Math.atan2(-(t[0] - c[0]), -(t[2] - c[2])); pl.pitch = p !== null ? p : Math.atan2(t[1] - c[1], Math.hypot(t[0] - c[0], t[2] - c[2])); }, [from, to, pitch]); await settle(150); await step(20); };
const sp = info.spawn;
// 1. the player's first view at spawn
await shot(`sv_${tag}_1_spawn`);
// 2. base & city from above (like the trailer's aerial establishing shots)
await look([sp[0] + 90, sp[1] + 70, sp[2] + 120], [sp[0], sp[1], sp[2]], null); await shot(`sv_${tag}_2_base_aerial`);
// 3. city street level
if (info.vil) { await look([info.vil.x + 30, sp[1] + 2, info.vil.z + 30], [info.vil.x, sp[1] + 2, info.vil.z], -0.05); await shot(`sv_${tag}_3_city_street`); }
// 4. nearest citadel
if (info.cit) { const s = info.cit; await look([s.x + 110, s.y + 45, s.z + 110], [s.x, s.y + 40, s.z], null); await shot(`sv_${tag}_4_citadel`); }
// 5. sky island
if (info.isle) { const I = info.isle; await look([I.x + I.r * 2.2, I.y + 40, I.z + I.r * 2.2], [I.x, I.y, I.z], null); await shot(`sv_${tag}_5_island`); }
// 6. ember canyons
if (info.ember) { const e = info.ember; await look([e.x + 60, e.y + 60, e.z + 90], [e.x, e.y, e.z], null); await shot(`sv_${tag}_6_ember`); }
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 30)) console.log(l);
await browser.close();

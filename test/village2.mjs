// v2 villages: fly over the spawn village, look at the market, a farmstead and the streets
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const W = +(process.env.W || 960), H = +(process.env.H || 540);
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || /error|fail|village gen/i.test(s)) logs.push(`[${t}] ${s.slice(0, 700)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(5); } };
const settle = async (max = 60) => { for (let i = 0; i < max; i++) { await step(10); const s = await ev(() => { const g = VR.game; return { busy: g.pool.busy, pend: g.world.pending.size, lod: g.horizon ? g.horizon.inflight : 0, want: g.world.lastWant || 0 }; }); if (s.busy === 0 && s.pend === 0 && s.lod === 0 && !s.want && i > 3) break; await wait(100); } };
const shot = async (name) => { await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }); await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 180000 }); console.log('shot', name); };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.renderDist = 10; g.applySettings('*'); }, process.env.PRESET || 'high');
await ev(`VR.game.createWorld({name:'V2',mode:'creative',difficulty:'peaceful',type:'default',seed:'${process.env.SEED || '424242'}',cheats:true,kit:true})`);
for (let i = 0; i < 60; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; const h = document.getElementById('hud'); if (h) h.style.display = 'none'; g.env.setTime(3400); });
await settle(60);
// the spawn village plan (from the villages manager once it arrives)
let info = null;
for (let i = 0; i < 40 && !info; i++) { await step(10); await wait(200); info = await ev(() => { const V = VR.game.villages; if (!V) return null; const vil = [...V.known.values()][0]; if (!vil) return null; const P = vil.plan; return { name: vil.name, x: P.x, y: P.y, z: P.z, rad: P.rad, homes: P.homes.length, work: P.work.map(w => w.kind), shops: P.shops, pastures: P.pastures, orchards: P.orchards, windmills: P.windmills, farms: P.farms.length }; }); }
console.log(JSON.stringify({ name: info.name, homes: info.homes, work: info.work, shops: info.shops.length, pastures: info.pastures.length, orchards: info.orchards.length, windmills: info.windmills.length, farms: info.farms, rad: info.rad }));
const look = async (from, to, pitch) => { await ev(([c, t, p]) => { const pl = VR.game.player; pl.flying = true; pl.teleport(c[0], c[1], c[2]); pl.yaw = Math.atan2(-(t[0] - c[0]), -(t[2] - c[2])); pl.pitch = p; }, [from, to, pitch]); await settle(120); await step(20); };
// aerial
if (!process.env.QUICK) { await look([info.x - 70, info.y + 60, info.z + 70], [info.x, info.y, info.z], -0.55); await shot('v2_aerial');
await ev(() => VR.game.env.setTime(12600)); await step(4); await shot('v2_aerial_dusk');
await ev(() => VR.game.env.setTime(3400)); }
// market
if (info.shops.length) { const m = info.shops[0]; const e = m.exit, i2 = m.inside; const dx = Math.sign(e[0] - i2[0]), dz = Math.sign(e[2] - i2[2]); await look([e[0] + dx * 9 + dz * 5, e[1] + 3, e[2] + dz * 9 + dx * 5], [i2[0], i2[1] + 1, i2[2]], -0.12); await shot('v2_market'); await look([m.inside[0], m.inside[1] + 1.4, m.inside[2] + 1], [m.inside[0], m.inside[1] + 1, m.inside[2] + 6], -0.05); await shot('v2_market_inside'); }
if (info.pastures.length) { const p = info.pastures[0]; const cx = (p.box[0] + p.box[3]) / 2, cz = (p.box[2] + p.box[5]) / 2; const gt = p.gate; const dx = Math.sign(gt[0] - cx) || 0, dz = Math.sign(gt[2] - cz) || 0; await look([gt[0] + dx * 5 + dz * 3, p.y + 2.5, gt[2] + dz * 5 + dx * 3], [cx, p.y, cz], -0.15); await shot('v2_pasture'); }
if (info.orchards.length) { const o = info.orchards[0]; const t = o.trees[0]; await look([t[0] + 10, t[1] + 6, t[2] + 10], [t[0], t[1] + 1, t[2]], -0.35); await shot('v2_orchard'); }
if (info.windmills.length) { const wm = info.windmills[0]; const t = wm.top; await look([t[0] + 14, t[1] - 2, t[2] + 14], [t[0], t[1] - 4, t[2]], -0.15); await shot('v2_windmill'); }
// a street with yards
if (!process.env.QUICK) { await look([info.x + 12, info.y + 1.6, info.z + 12], [info.x + 30, info.y, info.z + 30], 0.0); await shot('v2_street'); }
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 30)) console.log(l);
await browser.close();

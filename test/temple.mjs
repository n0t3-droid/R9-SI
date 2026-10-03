// the Gate Temple from the plaza, from the air, its hall and the city side (TRAILER.md §4)
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const W = +(process.env.W || 1296), H = +(process.env.H || 704);
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || /error|fail|heartland|village gen/i.test(s)) logs.push(`[${t}] ${s.slice(0, 700)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(5); } };
const settle = async (max = 400) => { for (let i = 0; i < max; i++) { await step(10); const s = await ev(() => { const g = VR.game; return { busy: g.pool.busy, pend: g.world.pending.size, lod: g.horizon ? g.horizon.inflight : 0, want: g.world.lastWant || 0 }; }); if (s.busy === 0 && s.pend === 0 && s.lod === 0 && !s.want && i > 3) break; await wait(100); } };
const shot = async (name) => { await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }); await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 180000 }); console.log('shot', name); };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(`window.__hz=${process.env.HZ === undefined ? 2 : +process.env.HZ}`);
await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.renderDist = 16; g.settings.horizon = window.__hz === undefined ? 2 : window.__hz; g.applySettings('*'); }, process.env.PRESET || 'high');
await ev(`VR.game.createWorld({name:'Temple',mode:'creative',difficulty:'peaceful',type:'default',seed:'${process.env.SEED || '4242'}',cheats:true,kit:true})`);
for (let i = 0; i < 90; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev((tod) => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; const h = document.getElementById('hud'); if (h) h.style.display = 'none'; g.env.setTime(tod); }, +(process.env.TOD || 3200));
const tag = process.env.TAG || 't';
const look = async (from, to, pitch) => { await ev(([c, t, p]) => { const pl = VR.game.player; pl.flying = true; pl.teleport(c[0], c[1], c[2]); pl.yaw = Math.atan2(-(t[0] - c[0]), -(t[2] - c[2])); pl.pitch = p !== null ? p : Math.atan2(t[1] - c[1], Math.hypot(t[0] - c[0], t[2] - c[2])); }, [from, to, pitch]); await settle(200); await step(20); };
const shots = (process.env.SHOTS || 'plaza,aerial,hall,city,portal').split(',');
if (shots.includes('plaza')) { await look([0.5, 86, 125], [0, 100, 0], null); await shot(`${tag}_plaza`); }
if (shots.includes('portal')) { await look([0.5, 83, 40], [0, 88, 20], null); await shot(`${tag}_portal`); }
if (shots.includes('aerial')) { await look([130, 160, 170], [0, 95, -10], null); await shot(`${tag}_aerial`); }
if (shots.includes('hall')) { await look([0.5, 84, -36], [0, 84, 20], 0); await shot(`${tag}_hall`); }
if (shots.includes('city')) { await look([0.5, 84, -90], [0, 90, -40], null); await shot(`${tag}_city`); }
if (shots.includes('cityair')) { await look([60, 150, -260], [0, 82, -140], null); await shot(`${tag}_cityair`); }
if (shots.includes('wing')) { await look([90, 100, 40], [40, 92, -6], null); await shot(`${tag}_wing`); }
if (shots.includes('isles')) { await look([330 + 150, 215, 140 + 230], [330, 150, 140], null); await shot(`${tag}_isles`); }
if (shots.includes('isles2')) { await look([330 + 40, 175, 140 + 120], [330, 156, 120], null); await shot(`${tag}_isles2`); }
if (shots.includes('canyon')) { await look([30, 150, 90], [40, 95, 380], null); await shot(`${tag}_canyon`); }
if (shots.includes('loop')) { await look([150, 125, 150], [190, 100, 300], null); await shot(`${tag}_loop`); }
if (shots.includes('hills')) { await look([40, 130, -170], [0, 100, -320], null); await shot(`${tag}_hills`); }
if (shots.includes('hills2')) { await look([-40, 112, -235], [0, 110, -320], null); await shot(`${tag}_hills2`); }
if (shots.includes('station')) { const S = await ev(() => { const g = VR.game, gen = new VR.OverworldGen(g.meta.seed >>> 0, { vgen: 3 }); return VR.StationGen.site(gen); }); await look([S.x + 90, S.y + 40, S.z + 70], [S.x, S.y + 25, S.z], null); await shot(`${tag}_station`); await look([S.x - 60, S.y + 70, S.z + 100], [S.x, S.y + 30, S.z], null); await shot(`${tag}_station2`); }
if (shots.includes('street')) { await look([-40, 83, -150], [0, 84, -120], -0.05); await shot(`${tag}_street`); }
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 30)) console.log(l);
await browser.close();

// a quick visual tour with the far horizon: cockpit at altitude, dusk village plaza, night plaza
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 700)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(5); } };
const shot = async (name, tod) => { await ev((tod) => { window.__norender = false; const g = VR.game; if (tod !== undefined) g.env.setTime(tod); g.env.rain = 0; g.env.rainTarget = 0; g.last = performance.now() - 33; g.loop(performance.now()); g.renderer.gl.finish(); window.__norender = true; }, tod); await wait(150); await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 120000 }); console.log('shot', name); };
const settle = async (max = 60) => { for (let i = 0; i < max; i++) { await step(10); const s = await ev(() => { const g = VR.game; return { busy: g.pool.busy, pend: g.world.pending.size, lod: g.horizon ? g.horizon.inflight : 0, want: g.world.lastWant || 0 }; }); if (s.busy === 0 && s.pend === 0 && s.lod === 0 && !s.want && i > 3) break; await wait(100); } };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.settings.renderDist = 7; g.settings.dynRes = false; g.settings.horizon = 2; g.settings.bloom = true; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Tour',mode:'creative',difficulty:'peaceful',type:'default',seed:'${process.env.SEED || '4242'}',cheats:true,kit:true})`);
for (let i = 0; i < 60; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { VR.game.env.setTime(3200); VR.game.zenFreezeTime = true; window.requestAnimationFrame = () => 0; });
await settle(80);
const tag = process.env.TAG || 'a';
// village plaza at dusk and at night
await shot(`tour_${tag}_plaza_dusk`, 12300);
await shot(`tour_${tag}_plaza_night`, 17000);
// cockpit flight at altitude
await ev((arch) => { const g = VR.game; g.starships.placeInFront(12345, arch, null, g.player); }, process.env.ARCH || 'shuttle');
for (let i = 0; i < 30; i++) { await step(10); const ok = await ev(() => VR.game.starships.ships.length > 0 && !!VR.game.starships.ships[VR.game.starships.ships.length - 1].d.meta); if (ok) break; await wait(200); }
await ev(() => { const g = VR.game, s = g.starships.ships[g.starships.ships.length - 1]; g.starships.board(s, g.player); s.pos[1] += 70; g.player.pitch = -0.12; });
await settle(80);
await shot(`tour_${tag}_cockpit_day`, 3200);
await ev(() => { const g = VR.game; g.player.yaw += 2.2; });
await settle(60);
await shot(`tour_${tag}_cockpit_sunset`, 11800);
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 25)) console.log(l);
await browser.close();

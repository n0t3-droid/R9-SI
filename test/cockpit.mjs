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
const shot = async (name) => { await ev(() => { window.__norender = false; const g = VR.game; g.env.rain = 0; g.env.rainTarget = 0; g.last = performance.now() - 33; g.loop(performance.now()); g.renderer.gl.finish(); window.__norender = true; }); await wait(150); await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 90000 }); console.log('shot', name); };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.settings.renderDist = 6; g.settings.dynRes = false; g.applySettings('renderDist'); });
await ev(`VR.game.createWorld({name:'Cockpit',mode:'creative',difficulty:'peaceful',type:'default',seed:'4242',cheats:true,kit:true})`);
for (let i = 0; i < 60; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { VR.game.env.setTime(3200); VR.game.zenFreezeTime = true; window.requestAnimationFrame = () => 0; });
await wait(300);
for (let i = 0; i < 10; i++) await step(10);
await ev((arch) => { const g = VR.game; g.starships.placeInFront(12345, arch, null, g.player); }, process.env.ARCH || 'shuttle');
for (let i = 0; i < 30; i++) { await step(10); const ok = await ev(() => VR.game.starships.ships.length > 0 && !!VR.game.starships.ships[VR.game.starships.ships.length - 1].d.meta); if (ok) break; await wait(200); }
await ev(() => { const g = VR.game, s = g.starships.ships[g.starships.ships.length - 1]; g.starships.board(s, g.player); s.pos[1] += 25; const f = g.flight; f.state = 'flying'; f.holdAlt = s.pos[1]; f.headPitch = -0.05; });
for (let i = 0; i < 6; i++) await step(10);
await shot('cockpit_a');
await ev(() => { const f = VR.game.flight; f.headYaw += 1.2; f.headPitch = 0.1; });
for (let i = 0; i < 12; i++) await step(10);
await shot('cockpit_b');
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 25)) console.log(l);
await browser.close();

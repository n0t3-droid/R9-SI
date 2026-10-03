// v0.35: the R9 Studio over the running game — pause menu → "R9 Studio · this world" opens the Studio in a layer on the
// open world (Werkbank tab), an edit there, "◂ Spiel" closes the layer and the edit is in the game at once.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const PORT = 8765 + Math.floor(Math.random() * 200);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', '/home/claude/vr/dist'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 900));
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const logs = [];
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 700)));
page.on('console', m => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) logs.push('[console] ' + m.text().slice(0, 300)); });
await page.goto(`http://127.0.0.1:${PORT}/index.html`);
const ev = (fn, a) => page.evaluate(fn, a), wait = (ms) => page.waitForTimeout(ms);
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const step = async (n) => { for (let k = 0; k < n; k += 10) { await ev((m) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { this.setupCamera(F.cam); }; } for (let i = 0; i < m; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } }, Math.min(10, n - k)); await wait(5); } };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.settings.renderDist = 4; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Livewelt',mode:'creative',difficulty:'peaceful',type:'flat',seed:'77',cheats:true,kit:false})`);
for (let i = 0; i < 90; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { window.requestAnimationFrame = () => 0; });
await step(40);
const P = await ev(() => { const p = VR.game.player; return [Math.floor(p.pos[0]), Math.floor(p.pos[1]), Math.floor(p.pos[2])]; });
// pause menu → the Studio button
await ev(() => VR.game.ui.pause());
const btn = await page.$('#studiolive');
check(!!btn && await btn.isVisible(), 'the pause menu has "R9 Studio · this world"');
await btn.click();
let up = false;
for (let i = 0; i < 300; i++) { await wait(500); up = await ev(() => { const f = document.getElementById('studioFrame'); try { const w = f && f.contentWindow; return !!(w && w.VR && w.VR.StudioWorld && w.VR.StudioWorld.world && !w.VR.StudioWorld.loading && w.VR.StudioWorld.wb && w.VR.StudioWorld.wb.region === w.VR.StudioWorld.region); } catch (e) { return false; } }); if (up) break; }
const st = await ev(() => { const f = document.getElementById('studioFrame'), w = f.contentWindow; return { on: f.classList.contains('on'), open: VR.game.studioOpen, tab: w.VR.StudioWorld.tab, world: w.VR.StudioWorld.world.name }; });
console.log('  layer', JSON.stringify(st));
check(up && st.on && st.open && st.tab === 'bench' && st.world === 'Livewelt', 'the Studio opened over the game on this world\'s Werkbank');
await page.screenshot({ path: '/home/claude/vr/test/shots/live_1.png', timeout: 180000 });
// an edit in the Studio: a little tower next to the player
await ev((P) => { const w = document.getElementById('studioFrame').contentWindow, s = w.VR.R.byName.vollton_signal_red.defaultState, out = []; for (let k = 0; k < 6; k++) out.push([P[0] + 3, P[1] + k, P[2] + 3, s]); w.VR.StudioWorld.wb.edit(out, 'Turm'); }, P);
const before = await ev((P) => VR.game.world.getBlock(P[0] + 3, P[1] + 5, P[2] + 3), P);
// back to the game with the Studio's own button (▶ Spielen)
await ev(() => { const w = document.getElementById('studioFrame').contentWindow; w.document.querySelector('.gamelink').click(); });
await wait(300);
const after = await ev((P) => ({ open: VR.game.studioOpen, layer: document.getElementById('studioFrame').classList.contains('on'), screen: VR.game.ui.screen, top: VR.R.types[VR.R.T.type[VR.game.world.getBlock(P[0] + 3, P[1] + 5, P[2] + 3)]].name }), P);
console.log('  back', JSON.stringify({ before, ...after }));
check(!after.open && !after.layer && after.top === 'vollton_signal_red', '▶ Spielen closes the layer — the tower is in the game at once');
check(!after.screen, 'and you play on (no pause menu in between)');
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 8)) console.log(l);
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
await browser.close(); srv.kill();
process.exit(fails ? 1 : 0);

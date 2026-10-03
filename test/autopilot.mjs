// autopilot: board a shuttle in a village, G → fly to the next village, land there
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
const shot = async (name) => { await ev(() => { window.__norender = false; const g = VR.game; g.env.rain = 0; g.env.rainTarget = 0; g.last = performance.now() - 33; g.loop(performance.now()); g.renderer.gl.finish(); window.__norender = true; }); await wait(150); await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 120000 }); console.log('shot', name); };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.settings.renderDist = 6; g.settings.dynRes = false; g.settings.horizon = 1; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Auto',mode:'creative',difficulty:'peaceful',type:'default',seed:'${process.env.SEED || '424242'}',cheats:true,kit:true})`);
for (let i = 0; i < 60; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { VR.game.env.setTime(3200); VR.game.zenFreezeTime = true; window.requestAnimationFrame = () => 0; });
for (let i = 0; i < 20; i++) { await step(10); await wait(100); }
await ev(() => { const g = VR.game; g.starships.placeInFront(777, 'shuttle', null, g.player); });
for (let i = 0; i < 40; i++) { await step(10); const ok = await ev(() => VR.game.starships.ships.length > 0 && !!VR.game.starships.ships[VR.game.starships.ships.length - 1].d.meta && VR.game.villages.list().length > 1); if (ok) break; await wait(200); }
const r0 = await ev(() => { const g = VR.game, s = g.starships.ships[g.starships.ships.length - 1]; g.starships.board(s, g.player); g.starships.toggleAuto(); const A = g.starships.auto; return { sites: g.villages.list().map(v => v.name + '@' + Math.round(Math.hypot(v.x - s.pos[0], v.z - s.pos[2]))), to: A && A.site.name, pos: s.pos.map(Math.round) }; });
console.log(JSON.stringify(r0));
let landed = false;
for (let i = 0; i < 90; i++) {
  await step(20); await wait(40);
  const st = await ev(() => { const g = VR.game, S = g.starships, s = S.pilot, A = S.auto; let below = null, col = null; if (s) { below = S.hits(s, s.pos[0], s.pos[1] - 1.5, s.pos[2], s.yaw); const w = g.world, x = Math.floor(s.pos[0]), z = Math.floor(s.pos[2]); col = []; for (let y = Math.floor(s.pos[1]); y > Math.floor(s.pos[1]) - 60 && y > 0; y--) { const b = w.getBlock(x, y, z); if (b) { col.push(y + ':' + VR.R.types[VR.R.T.type[b]].name); if (col.length > 2) break; } } const c = w.col(x >> 4, z >> 4); col.push('ready=' + !!(c && c.ready)); } return { pilot: !!s, auto: !!A, dist: A ? Math.round(A.dist) : null, alt: s ? +s.pos[1].toFixed(1) : null, vy: s ? +s.vel[1].toFixed(1) : null, cruise: A ? Math.round(A.cruise) : null, spot: A && A.spot ? A.spot.map(Math.round) : null, v: s ? Math.round(Math.hypot(s.vel[0], s.vel[2])) : 0, climb: A ? +A.climb.toFixed(1) : 0, below, col }; });
  if (i % 5 === 0 || !st.pilot) console.log(i, JSON.stringify(Object.assign(st, { col: undefined })));
  if (i === 12) await shot('auto_cruise');
  if (i === 14) { await ev(() => { VR.game.player.yaw += 1.2; VR.game.player.pitch = -0.2; }); await step(2); await shot('auto_freelook'); await ev(() => { VR.game.player.yaw -= 1.2; VR.game.player.pitch = 0; }); }
  if (!st.pilot) { landed = true; break; }
}
console.log('landed', landed);
if (landed) { for (let i = 0; i < 10; i++) { await step(10); await wait(100); } await shot('auto_arrived'); }
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 25)) console.log(l);
await browser.close();

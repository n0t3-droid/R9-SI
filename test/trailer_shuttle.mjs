// The trailer's shuttle shots (docs/trailer, shots A and D): the shuttle docks on the Gate Temple's apron in front of the
// portal and parks there, the sky traffic flies loose formations over the Heartland, and the cost of the flight effects on
// Very Low (potato). Pictures: test/shots/trailer_<tag>_<shot>.png — R9_TAG names the build (before / after), R9_URL picks
// it (default: this checkout's dist). Run it through test/wt_run.sh, never directly.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const URL = process.env.R9_URL || 'file:///home/claude/vr/dist/index.html';
const TAG = process.env.R9_TAG || 'after';
const browser = await chromium.launch({ channel: 'chromium', args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const logs = [];
let fails = 0; const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 500)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1200)));
await page.goto(URL);
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
// the game loop is stepped by hand (headless animation frames are lazy): each call advances the simulation 33 ms
const frames = (n) => ev((n) => { const g = VR.game; let t = window.__t || performance.now(); for (let i = 0; i < n; i++) { t += 33; g.last = t - 33; g.loop(t); } window.__t = t; return n; }, n);
const shot = async (name) => { await ev(() => { const g = VR.game; window.__t = (window.__t || performance.now()) + 33; g.last = window.__t - 33; g.loop(window.__t); g.renderer.gl.finish(); }); await page.screenshot({ path: `/home/claude/vr/test/shots/trailer_${TAG}_${name}.png` }); };
await wait(6000);
await ev(() => { const g = VR.game; g.settings.renderDist = 6; g.settings.dynRes = false; g.settings.minimap = false; g.applySettings('renderDist'); });
await ev(`VR.game.createWorld({name:'Trailer',mode:'creative',difficulty:'normal',type:'default',seed:'424242',cheats:true,kit:true})`);
for (let i = 0; i < 60; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await frames(30);
// ---- shot D: the apron, the portal behind, a shuttle docking (after: it comes in over the plaza and parks; before: it flies by)
await ev(() => { const g = VR.game, p = g.player; p.teleport(0.5, 81, 100.5); p.flying = true; p.yaw = 0; p.pitch = -0.08; g.env.setTime(12600); });
await frames(40);
const spawned = await ev(() => { const g = VR.game; g.traffic.spawnFlight({ arch: 'shuttle', dock: true }); return true; });
check(spawned, 'a shuttle is launched toward the Gate Temple');
await frames(60);
await ev(() => { const g = VR.game; g.player.pos[1] = 84; });
for (let i = 0; i < (TAG === "after" ? 40 : 1); i++) { await frames(20); if (await ev(() => VR.game.traffic.ships.some(s => s.dock && s.dock.phase === "park"))) break; }
await frames(30);
const parked = await ev(() => VR.game.traffic.ships.filter(s => s.dock && s.dock.phase === 'park').map(s => ({ y: +s.pos[1].toFixed(2), z: +s.pos[2].toFixed(1) })));
check(TAG !== 'after' || parked.length > 0, 'the shuttle parks on the apron (' + JSON.stringify(parked) + ')');
await shot('plaza');
// ---- formation: the sky traffic over the canyon, loose formations of 2 to 4
await ev(() => { const g = VR.game, p = g.player; p.teleport(-160, 128, 240); p.yaw = 0.6; p.pitch = -0.12; });
for (let k = 0; k < 3; k++) await ev(() => { VR.game.traffic.spawnFlight({ arch: 'shuttle' }); return 1; });
await frames(200);
const fl = await ev(() => VR.game.traffic.ships.filter(s => s.arch === 'shuttle' && !s.dock).length);
check(fl >= 2, 'several shuttles fly over the Heartland (' + fl + ')');
await shot('formation');
// ---- cost on Very Low: the frame's JS time with the flight effects on (potato), averaged over 90 frames
await ev(() => VR.game.applyPreset('potato'));
await frames(60);
const cost = await ev(() => { const g = VR.game; let s = 0, n = 0; for (let i = 0; i < 90; i++) { window.__t += 33; g.last = window.__t - 33; g.loop(window.__t); s += g.jsMs || 0; n++; } return { js: s / n, fps: g.fps || 0, ships: g.traffic.ships.length }; });
console.log('COST ' + TAG + ' potato js_ms ' + cost.js.toFixed(2) + ' fps ' + Math.round(cost.fps) + ' traffic ' + cost.ships);
check(cost.js < 60, 'the frame logic stays under 60 ms on Very Low (' + cost.js.toFixed(1) + ' ms)');
check(!logs.some(l => /pageerror/.test(l)), 'no page errors');
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 20)) console.log(l);
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

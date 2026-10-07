import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const logs = [];
let fails = 0; const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || t === 'warning' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 600)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const shot = async (name) => { const ms = await page.evaluate(() => { window.__norender = false; const g = VR.game; const t0 = performance.now(); g.last = performance.now() - 33; g.loop(performance.now()); g.renderer.gl.finish(); window.__norender = true; return performance.now() - t0; }); await page.waitForTimeout(200); await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 90000 }); console.log('shot', name, Math.round(ms) + 'ms'); };
const ev = (fn, arg) => page.evaluate(fn, arg);
// step the game loop manually (headless rAF is lazy)
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(20); } };
await wait(6000);
await ev(() => { const g = VR.game; g.settings.renderDist = 5; g.settings.dynRes = false; g.settings.minimap = false; g.applySettings('renderDist'); });
await ev(`VR.game.createWorld({name:'Ship',mode:'${process.env.MODE || 'creative'}',difficulty:'normal',type:'default',seed:'${process.env.SEED || '424242'}',cheats:true,kit:true})`);
for (let i = 0; i < 40; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
const out = await ev(() => new Promise((res) => { const g = VR.game, p = g.player; g.pool.direct(0, { type: 'locate', dim: 'overworld', biome: 'outpost', x: Math.floor(p.pos[0]), z: Math.floor(p.pos[2]) }, null, (m) => res(m.pos)); }));
console.log('outpost', JSON.stringify(out));
if (!out) { check(false, 'an outpost is found near the player'); console.log('no outpost'); await browser.close(); console.log('FAILED ' + fails); process.exit(1); }
await ev((o) => { const p = VR.game.player; p.teleport(o[0] + 0.5, o[1] + 14, o[2] + 26.5); p.flying = true; p.yaw = 0; p.pitch = -0.35; }, out);
for (let i = 0; i < 30; i++) { await step(20); const n = await ev(() => { const g = VR.game, w = g.world, p = g.player; let n = 0; for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if (w.col((Math.floor(p.pos[0]) >> 4) + dx, (Math.floor(p.pos[2]) >> 4) + dz)) n++; return n + ' pend ' + g.pool.busy; }); if (i % 5 === 0) console.log('load', n); if (n.startsWith('25 pend') && i > 6) break; await wait(300); }
await step(30);
await shot('s1_outpost');
// find the helm
const helm = await ev((o) => { const g = VR.game, w = g.world, R = VR.R; const id = R.byName.helm.id; for (let y = o[1] - 3; y < o[1] + 12; y++) for (let z = o[2] - 16; z <= o[2] + 16; z++) for (let x = o[0] - 16; x <= o[0] + 16; x++) { const s = w.getBlock(x, y, z); if (s && R.T.type[s] === id) return [x, y, z]; } return null; }, out);
console.log('helm', JSON.stringify(helm));
check(!!helm, 'a helm is found at the outpost');
if (helm) {
  await ev((h) => VR.game.gadgets.takeHelm(h[0], h[1], h[2]), helm);
  for (let i = 0; i < 20; i++) { await step(5); await wait(200); const st = await ev(() => VR.game.gadgets.ship && VR.game.gadgets.ship.state); if (st === 'flying') break; }
  check(await ev(() => !!VR.game.gadgets.ship && VR.game.gadgets.ship.state === 'flying'), 'the ship lifts off (state flying)');
  console.log(await ev(() => { const S = VR.game.gadgets.ship, R = VR.R; const h = {}; for (let i = 0; i < S.all.length; i += 4) { const n = R.types[R.T.type[S.all[i + 3]]].name; h[n] = (h[n] || 0) + 1; } return JSON.stringify(h); }));
  console.log(await ev(() => { const S = VR.game.gadgets.ship; return JSON.stringify({ state: S.state, count: S.count, thr: S.thrusters.length, max: S.maxSpeed.toFixed(1), turn: S.turnRate.toFixed(2), sx: S.sx, sy: S.sy, sz: S.sz, cells: S.cells.length / 3, pos: S.pos }); }));
  await ev(() => { VR.game.camMode = 1; });
  await step(20);
  await shot('s2_ship_chase');
  // fly up and forward
  await ev(() => { const i = VR.game.input; i.captured = true; i.keys.add('Space'); });
  await step(40);
  await ev(() => { const i = VR.game.input; i.keys.delete('Space'); i.keys.add('KeyW'); i.mouse.dx = 120; });
  await step(60);
  await shot('s3_ship_flying');
  console.log(await ev(() => { const S = VR.game.gadgets.ship; return JSON.stringify({ pos: S.pos.map(v => +v.toFixed(1)), vel: S.vel.map(v => +v.toFixed(1)), psi: S.psi.toFixed(2), roll: S.roll.toFixed(2) }); }));
  await ev(() => { VR.game.camMode = 0; });
  await step(10);
  await shot('s4_cockpit');
  await ev(() => { const i = VR.game.input; i.keys.delete('KeyW'); });
  await step(60);
  await ev(() => { VR.game.input.pressed.add('KeyV'); });
  await step(2);
  console.log('after land:', await ev(() => { const g = VR.game, S = g.gadgets.ship; return JSON.stringify({ ship: S && S.state, riding: !!g.gadgets.riding, pos: g.player.pos.map(v => +v.toFixed(1)) }); }));
  check(await ev(() => { const g = VR.game, S = g.gadgets.ship; return !!S && S.state === 'landing' && !g.gadgets.riding; }), 'V lands the ship and the pilot steps out');
  await ev(() => { VR.game.camMode = 1; const p = VR.game.player; p.pitch = -0.4; });
  await step(40);
  await wait(1500);
  await step(20);
  await shot('s5_landed');
  console.log('final:', await ev(() => { const g = VR.game, S = g.gadgets.ship; return JSON.stringify({ ship: S && S.state }); }));
}
// hoverbike
await ev(() => { const g = VR.game; g.camMode = 1; g.chat('/bike'); const b = g.gadgets.bikes[g.gadgets.bikes.length - 1]; g.gadgets.useBike(b, g.player); });
await step(20);
await ev(() => { const i = VR.game.input; i.keys.add('KeyW'); });
await step(50);
await shot('s6_bike');
console.log('bike', await ev(() => { const g = VR.game, b = g.gadgets.riding && g.gadgets.riding.bike; return b ? JSON.stringify({ pos: b.pos.map(v => +v.toFixed(1)), spd: b.spd.toFixed(1) }) : 'none'; }));
check(await ev(() => !!(VR.game.gadgets.riding && VR.game.gadgets.riding.bike)), 'the hoverbike can be ridden');
await ev(() => { const i = VR.game.input; i.keys.delete('KeyW'); i.pressed.add('ShiftLeft'); });
await step(3);
// map screen & codex
await ev(() => { VR.game.map.openBig(); });
await wait(500);
await shot('s7_map');
await ev(() => { VR.game.ui.showCodex(); });
await wait(300);
await shot('s8_codex');
check(!logs.some(l => /pageerror\]/.test(l)), 'no page errors');
console.log('--- logs (' + logs.length + ')');
for (const l of logs.slice(0, 40)) console.log(l);
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

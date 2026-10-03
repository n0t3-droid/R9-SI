// R9 Smooth Ground v2: a hill in the kit world, then the things a player does to it — stand on a slope (no jitter),
// walk over it (grounded all the way), dig single blocks and 2×2 pits (crisp hole vs. soft bowl), place single
// blocks and rows (cube vs. ridge), toggle a block cut/smooth with the shovel, and put dirt back into a hole.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 700)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 16) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(4); } };
const settle = async (max = 60) => { for (let i = 0; i < max; i++) { await step(10); const s = await ev(() => { const g = VR.game; let dirty = 0; for (const c of g.world.cols.values()) for (const sc of c.sec) if (sc.dirty || sc.pending) dirty++; return { busy: g.pool.busy, pend: g.world.pending.size, dirty }; }); if (s.busy === 0 && s.pend === 0 && s.dirty === 0 && i > 2) break; await wait(60); } };
const shot = async (name) => { await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }); await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 180000 }); console.log('shot', name); };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.horizon = 1; g.settings.renderDist = 6; g.applySettings('*'); }, process.env.PRESET || 'high');
await ev(`VR.game.createWorld({name:'Terrain',mode:'creative',difficulty:'peaceful',type:'flat',seed:'7',cheats:true,kit:true})`);
for (let i = 0; i < 90; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; const h = document.getElementById('hud'); if (h) h.style.display = 'none'; g.env.setTime(4500); });
await settle(60);
// the hill: a smooth dome + a ridge, grass over dirt, 30 blocks east of spawn, on the flat world's surface
const base = await ev(() => { const g = VR.game, w = g.world, p = g.player, R = VR.R; const ox = Math.floor(p.pos[0]) + 20, oz = Math.floor(p.pos[2]) - 20, y0 = Math.floor(p.pos[1]) - 1;
  const st = (n) => R.byName[n].defaultState; const G = st('grass_block'), D = st('dirt');
  const list = [];
  for (let z = 0; z < 44; z++) for (let x = 0; x < 44; x++) { const h = Math.round(6 * Math.exp(-((x - 22) ** 2 + (z - 22) ** 2) / 90) + 2 * Math.exp(-((x - 10) ** 2) / 12)); for (let y = -1; y <= 9; y++) { const yy = y0 + y; let b = 0; if (y < h) b = D; else if (y === h) b = G; list.push([ox + x, yy, oz + z, b]); } }
  w.bulkSet(list, false);
  return [ox, y0, oz]; });
const [ox, y0, oz] = base;
await settle(80);
const look = async (name, pos, yaw, pitch) => { await ev(([pos, yaw, pitch]) => { const g = VR.game, p = g.player; p.flying = true; p.noclip = true; p.teleport(pos[0], pos[1], pos[2]); p.yaw = yaw; p.pitch = pitch; }, [pos, yaw, pitch]); await settle(30); await step(6); await shot(name); };
await look('te_1_hill', [ox + 22, y0 + 14, oz + 48], 0, -0.5);
// ---- stand on the slope: the body must not move at all
const stand = await ev(([ox, y0, oz]) => { const g = VR.game, p = g.player; p.flying = false; p.noclip = false; const sx = ox + 15.5, sz = oz + 22.5; const top = g.world.topAt(Math.floor(sx), Math.floor(sz)); p.teleport(sx, top + 2, sz); p.vel[0] = p.vel[1] = p.vel[2] = 0; let ys = []; for (let i = 0; i < 180; i++) { g.last = performance.now() - 16; g.loop(performance.now()); if (i >= 60) ys.push(p.pos[1]); } const mn = Math.min(...ys), mx = Math.max(...ys); return { y: +ys[ys.length - 1].toFixed(3), jitter: +(mx - mn).toFixed(4), onGround: p.onGround }; }, base);
console.log('stand on slope:', JSON.stringify(stand), stand.jitter < 0.002 ? 'OK (no jitter)' : 'JITTER!');
// ---- walk over the dome: grounded all the way, no flying off the downhill side
const walk = await ev(([ox, y0, oz]) => { const g = VR.game, p = g.player; p.teleport(ox + 4.5, g.world.topAt(ox + 4, oz + 22) + 1, oz + 22.5); p.yaw = -Math.PI / 2; p.vel[0] = p.vel[1] = p.vel[2] = 0; const out = []; let air = 0; for (let i = 0; i < 420; i++) { p.vel[0] = 4; g.last = performance.now() - 16; g.loop(performance.now()); if (!p.onGround) air++; if (i % 30 === 0) out.push([+(p.pos[0] - ox).toFixed(1), +p.pos[1].toFixed(2), p.onGround ? 1 : 0]); } return { trace: out, airFrames: air }; }, base);
console.log('walk over the dome [x, y, onGround]:', JSON.stringify(walk.trace), 'frames in the air:', walk.airFrames);
// ---- edits: a single dug block, a 2×2 pit, a single placed block, a row of three, a cut block, dirt back into a hole
await ev(([ox, y0, oz]) => { const g = VR.game, w = g.world, p = g.player, R = VR.R; const st = (n) => R.byName[n].defaultState;
  const top = (x, z) => w.topAt(ox + x, oz + z);
  const dig = (x, y, z) => p.breakBlock(x, y, z, w.getBlock(x, y, z), false);          // as the player digs: crisp voxels around the hole
  dig(ox + 22, top(22, 30), oz + 30);                                                 // 1 block dug on the slope
  for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) dig(ox + 14 + dx, top(14, 30), oz + 30 + dz);   // 2×2 pit
  for (let k = 0; k < 6; k++) dig(ox + 26 + k, top(26, 26), oz + 26);                  // a 1-wide trench
  w.setBlock(ox + 30, top(30, 36) + 1, oz + 36, st('dirt_cut'), 4);                    // 1 block placed on the flat (hand-placed = cut)
  for (let k = 0; k < 4; k++) w.setBlock(ox + 34 + k, top(34, 36) + 1, oz + 36, st('grass_block_cut'), 4);   // a hand-placed row
  for (let k = 0; k < 4; k++) w.setBlock(ox + 34 + k, top(34, 40) + 1, oz + 40, st('grass_block_cut'), 4);   // the same row, then smoothed with the shovel
  g.sim.toggleCut(ox + 35, top(34, 40) + 1, oz + 40, w.getBlock(ox + 35, top(34, 40) + 1, oz + 40), p, true);
  dig(ox + 22, top(22, 34), oz + 34); w.setBlock(ox + 22, top(22, 34) - 1, oz + 34, st('dirt_cut'), 4);   // dug, dirt put back → crisp patch; then smoothed
  g.sim.toggleCut(ox + 22, top(22, 34) - 1, oz + 34, w.getBlock(ox + 22, top(22, 34) - 1, oz + 34), p, true);
}, base);
await settle(60);
await look('te_2_edits', [ox + 22, y0 + 12, oz + 52], 0, -0.62);
await look('te_3_edits_low', [ox + 22, y0 + 4, oz + 42], 0, -0.25);
await look('te_4_pit_close', [ox + 15, y0 + 6, oz + 36], 0, -0.7);
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 8)) console.log(l);
await browser.close();

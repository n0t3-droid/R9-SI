// v0.38 📍 Spawnpunkt & ▶ Spielen: you never land in a wall, a new thing you set into a world from the R9 Studio is
// where ▶ Spielen takes you (standing in front of it, looking at it), otherwise ▶ takes you to your spawn point; the
// spawn point is set in the game's pause menu or with 📍 in the Studio; ▶ starts the world directly (no title); over the
// open game ▶ shows the new thing, or lets you play on where you were. Flat creative world, the real game and Studio.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const PORT = 8765 + Math.floor(Math.random() * 200);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', '/home/claude/vr/dist'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 900));
const URL0 = `http://127.0.0.1:${PORT}`;
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 1360, height: 860 } });
const page = await ctx.newPage();
const logs = [];
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 900)));
page.on('console', m => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) logs.push('[console] ' + m.text().slice(0, 300)); });
page.on('dialog', d => d.accept('x'));
const ev = (fn, a) => page.evaluate(fn, a);
const wait = (ms) => page.waitForTimeout(ms);
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const done = async () => { console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 12)) console.log(l); check(!logs.some(l => /pageerror/.test(l)), 'no page errors'); console.log(fails ? 'FAILED ' + fails : 'ALL OK'); await browser.close(); srv.kill(); process.exit(fails ? 1 : 0); };
const safe = async (fn, a) => { try { return await ev(fn, a); } catch (e) { return null; } };   // (a page that is navigating answers nothing)

// ---- helpers: the game, the Studio
// (in the game, standing: arrived, the Studio closed, no arrival flight running any more)
async function inGame(id, maxS = 150) { for (let i = 0; i < maxS * 2; i++) { await wait(500); if (await safe((id) => { const g = window.VR && VR.game; return !!(g && g.state === 'play' && g.meta && g.meta.id === id && g.player && !g.player.hold && !g.studioOpen && !g.revealPending && !(g.director && g.director.active)); }, id)) return true; } return false; }
async function atTitle(maxS = 90) { for (let i = 0; i < maxS * 2; i++) { await wait(500); if (await safe(() => !!(window.VR && VR.game && VR.game.state === 'title'))) return true; } return false; }
async function inStudio(id, maxS = 200) { for (let i = 0; i < maxS * 2; i++) { await wait(500); if (await safe((id) => { const WM = window.VR && VR.StudioWorld; return !!(WM && WM.world && WM.world.id === id && !WM.loading && WM.cols.size && WM.wb && WM.wb.region === WM.region && document.getElementById('playBtn')); }, id)) return true; } return false; }
// where the player is, and whether that spot is a sound one
const me = () => ev(() => {
  const g = VR.game, p = g.player, w = g.world, T = VR.R.T, F = VR.F;
  const solid = (x, y, z) => !!(T.flags[w.getBlock(x, y, z)] & F.SOLID);
  const fx = Math.floor(p.pos[0]), fy = Math.floor(p.pos[1] + 0.01), fz = Math.floor(p.pos[2]);
  return { pos: p.pos.map(v => +v.toFixed(2)), yaw: +p.yaw.toFixed(3), spawn: p.spawn ? p.spawn.map(v => +v.toFixed(2)) : null, wall: solid(fx, fy, fz) || solid(fx, fy + 1, fz), ground: solid(fx, fy - 1, fz) };
});
// a box of one block (inclusive corners) through the Werkbank, as every tool there does
const place1 = (b, name, label) => ev(([b, name, label]) => { const s = VR.R.byName[name].defaultState, L = []; for (let y = b[1]; y <= b[4]; y++) for (let z = b[2]; z <= b[5]; z++) for (let x = b[0]; x <= b[3]; x++) L.push([x, y, z, s]); return VR.StudioWorld.wb.edit(L, label); }, [b, name, label]);
// (a Studio that has only just opened the world may still be settling: one more try a moment later, and say why)
async function place(b, name, label) {
  let n = await place1(b, name, label);
  if (!n) { console.log('  (nothing set at once: ' + JSON.stringify(await ev(([b]) => { const WM = VR.StudioWorld; return { region: !!WM.region, wb: WM.wb.region === WM.region, loading: !!WM.loading, at: VR.R.types[VR.R.T.type[WM.getBlock(b[0], b[1], b[2])]].name, type: WM.world && WM.world.type }; }, [b])) + ')'); await wait(1500); n = await place1(b, name, label); }
  return n;
}
// is the box standing in the game yet (its centre block)?
const built = (b, name) => safe(([b, name]) => VR.game.world.getBlock((b[0] + b[3]) >> 1, b[1], (b[2] + b[5]) >> 1) === VR.R.byName[name].defaultState, [b, name]);
// standing in front of a box: outside it, 2–30 blocks from its side, on the ground, looking at its middle
function inFront(P, b) {
  const [x, y, z] = P.pos, cx = (b[0] + b[3] + 1) / 2, cz = (b[2] + b[5] + 1) / 2;
  const dx = Math.max(b[0] - x, 0, x - (b[3] + 1)), dz = Math.max(b[2] - z, 0, z - (b[5] + 1)), dist = Math.hypot(dx, dz);
  const vx = cx - x, vz = cz - z, vl = Math.hypot(vx, vz) || 1, look = -Math.sin(P.yaw) * vx / vl - Math.cos(P.yaw) * vz / vl;
  return { ok: dist >= 2 && dist <= 30 && !P.wall && P.ground && look > 0.7, dist: +dist.toFixed(1), look: +look.toFixed(2) };
}
const hdist = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const playBtn = () => safe(() => { const b = document.getElementById('playBtn'); return b ? b.textContent.trim() : null; });

// ---- 1. a flat creative world
await page.goto(URL0 + '/index.html');
check(await atTitle(), 'the game is at its title');
await ev(() => { const g = VR.game; g.applyPreset('potato'); g.settings.dynRes = false; g.settings.renderDist = 4; g.settings.horizon = 0; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Spawnwelt',mode:'creative',difficulty:'peaceful',seed:'4711',type:'flat',cheats:true,kit:false})`);
for (let i = 0; i < 240; i++) { await wait(500); if (await safe(() => VR.game.state === 'play' && VR.game.player && !VR.game.player.hold)) break; }
const W = await ev(() => { const g = VR.game, p = g.player; return { id: g.meta.id, P0: p.pos.map(v => Math.floor(v)), spawn: p.spawn.slice() }; });
const [X, Y, Z] = W.P0;
console.log('world', JSON.stringify(W));

console.log('2 · 📍 in the pause menu');
const s1 = await ev(async ([X, Y, Z]) => {
  const g = VR.game, p = g.player;
  p.teleport(X + 8.5, Y, Z + 0.5);
  g.ui.pause();
  const b = document.querySelector('#pause [data-act="sethome"]'); if (b) b.click();
  const r = { btn: b ? b.textContent.trim() : null, spawn: p.spawn.slice(), bed: p.spawnBed };
  g.ui.resume && g.ui.resume();
  p.teleport(X + 0.5, Y, Z + 0.5);
  await g.quitToTitle();
  return r;
}, W.P0);
console.log('  pause', JSON.stringify(s1));
const S1 = [X + 8.5, Y, Z + 0.5];
check(s1.btn && /spawn/i.test(s1.btn) && hdist(s1.spawn, S1) < 0.6 && !s1.bed, '📍 in the pause menu sets the spawn point where you stand (' + s1.spawn + ')');
check(await atTitle(), 'saved and back at the title');

console.log('3 · the Studio sets a stone block onto your last position');
await page.goto(URL0 + '/studio.html#world/' + encodeURIComponent(W.id) + '/bench');
check(await inStudio(W.id), 'the Studio opens the world (its 🧰 Werkbank) with a ▶ button');
const lab0 = await playBtn();
const CUBE = [X - 2, Y, Z - 2, X + 2, Y + 3, Z + 2];
const n3 = await place(CUBE, 'stone', '🧱 Würfel');
const lab1 = await playBtn();
console.log('  labels', JSON.stringify([lab0, lab1]), n3);
await ev(() => { const S = window.__st; S.cam.pitch = 0.55; S.cam.dist = 40; });
await wait(1200);
await page.screenshot({ path: '/home/claude/vr/test/shots/spawn_1_studio.png', timeout: 120000 });
check(/Spawn/i.test(lab0 || '') && /Neu/i.test(lab1 || '') && n3 === 100, '▶ says where you will land: "' + lab0 + '" → after setting something: "' + lab1 + '"');

console.log('4 · from the title you play on where you were — never inside the stone');
await page.goto(URL0 + '/index.html');
check(await atTitle(), 'the title (the plain way in)');
await ev(async (id) => { const g = VR.game, ws = await g.store.listWorlds(); g.loadWorld(ws.find(w => w.id === id)); }, W.id);
check(await inGame(W.id), 'the world is open');
for (let i = 0; i < 40 && !(await built(CUBE, 'stone')); i++) await wait(500);
await wait(1500);
const p4 = await me();
const outCube = Math.abs(p4.pos[0] - (X + 0.5)) > 2.5 || Math.abs(p4.pos[2] - (Z + 0.5)) > 2.5 || p4.pos[1] >= Y + 4;
console.log('  title', JSON.stringify(p4));
check(await built(CUBE, 'stone'), 'the stone block from the Studio stands in the game');
check(!p4.wall && p4.ground && outCube && hdist(p4.pos, [X + 0.5, Y, Z + 0.5]) <= 10, 'not inside the stone: at the nearest free spot next to it (' + p4.pos + ')');
await ev(() => VR.game.quitToTitle()); await atTitle();

console.log('5 · a new house in the Studio, ▶ Spielen: you stand in front of it');
await page.goto(URL0 + '/studio.html#world/' + encodeURIComponent(W.id) + '/bench');
check(await inStudio(W.id), 'the Studio again');
const HOUSE = [X + 16, Y, Z - 3, X + 22, Y + 4, Z + 3];
// a wall between the house and where you came from: the spot you land on must still see the house
await place([X + 12, Y - 1, Z - 5, X + 12, Y + 4, Z + 5], 'stone', '🧱 Mauer');
await place(HOUSE, 'oak_planks', '🏠 Haus');
await ev(() => document.getElementById('playBtn').click());
const g5 = await inGame(W.id);
check(g5, '▶ starts this very world (no title screen in between)');
for (let i = 0; i < 40 && !(await built(HOUSE, 'oak_planks')); i++) await wait(500);
await wait(800);
const p5 = await me(), f5 = inFront(p5, HOUSE);
const r5 = await ev(() => VR.game.lastReveal || null);
// the line from your eyes to the middle of the house: no block in between (the house itself not counted)
const los5 = await ev(([b]) => {
  const g = VR.game, p = g.player, w = g.world, T = VR.R.T, F = VR.F;
  const ex = p.pos[0], ey = p.pos[1] + p.eye, ez = p.pos[2], cx = (b[0] + b[3] + 1) / 2, cy = b[1] + (b[4] - b[1] + 1) / 2, cz = (b[2] + b[5] + 1) / 2;
  const n = Math.ceil(Math.hypot(cx - ex, cy - ey, cz - ez) * 4); let hit = null;
  for (let k = 1; k < n && !hit; k++) { const t = k / n, x = Math.floor(ex + (cx - ex) * t), y = Math.floor(ey + (cy - ey) * t), z = Math.floor(ez + (cz - ez) * t); if (x >= b[0] && x <= b[3] && y >= b[1] && y <= b[4] && z >= b[2] && z <= b[5]) break; if (T.flags[w.getBlock(x, y, z)] & F.SOLID) hit = [x, y, z, VR.R.types[T.type[w.getBlock(x, y, z)]].name]; }
  return hit;
}, [HOUSE]);
check(!los5, 'nothing blocks the view from there to the house (a wall stood on the near side: ' + (los5 ? 'blocked by ' + los5.join(' ') : 'clear') + ')');
check(r5 && /Haus/.test(r5.label || ''), 'a short flight showed the new house before handing you the view (' + (r5 && r5.label) + ')');
await page.screenshot({ path: '/home/claude/vr/test/shots/spawn_2_landed.png', timeout: 120000 });
console.log('  play', JSON.stringify(p5), JSON.stringify(f5));
check(f5.ok, 'in front of the new house, looking at it (' + f5.dist + ' blocks away, view ' + f5.look + ')');
await ev(() => VR.game.quitToTitle()); await atTitle();

console.log('6 · ▶ with nothing new: at your spawn point');
await page.goto(URL0 + '/studio.html#world/' + encodeURIComponent(W.id) + '/bench');
check(await inStudio(W.id), 'the Studio again');
const lab6 = await playBtn();
await ev(() => document.getElementById('playBtn').click());
check(await inGame(W.id), '▶ starts the world');
await wait(800);
const p6 = await me();
console.log('  spawn', lab6, JSON.stringify(p6));
check(/Spawn/i.test(lab6 || '') && hdist(p6.pos, S1) <= 1.5 && !p6.wall, 'nothing new: at the spawn point from the pause menu (' + p6.pos + ')');
await ev(() => VR.game.quitToTitle()); await atTitle();

console.log('7 · 📍 in the Studio');
await page.goto(URL0 + '/studio.html#world/' + encodeURIComponent(W.id) + '/bench');
check(await inStudio(W.id), 'the Studio again');
const Q = [X - 11.5, Y, Z + 9.5];
const s7 = await ev((Q) => { const b = document.querySelector('[data-spawn]'); VR.StudioWorld.setSpawn(Q); return { btn: !!b, label: document.getElementById('playBtn').textContent.trim() }; }, Q);
await ev(() => document.getElementById('playBtn').click());
check(await inGame(W.id), '▶ starts the world');
await wait(800);
const p7 = await me();
console.log('  studio spawn', JSON.stringify(s7), JSON.stringify(p7));
check(s7.btn && hdist(p7.pos, Q) <= 1.5 && p7.spawn && hdist(p7.spawn, Q) < 0.6, '📍 set in the Studio: ▶ lands there, and it is the game\'s spawn point now (' + p7.pos + ')');

console.log('8 · the Studio over the open game');
const frameStudio = () => page.frames().find(f => /studio\.html/.test(f.url()));
const fev = (fn, a) => frameStudio().evaluate(fn, a);
await ev(() => VR.game.openStudio());
let ready8 = false;
for (let i = 0; i < 400 && !ready8; i++) { await wait(500); const f = frameStudio(); if (!f) continue; try { ready8 = await f.evaluate((id) => { const WM = window.VR && VR.StudioWorld; return !!(WM && WM.world && WM.world.id === id && !WM.loading && WM.cols.size && WM.wb && WM.wb.region === WM.region && document.getElementById('playBtn')); }, W.id); } catch (e) { /* loading */ } }
check(ready8, 'the Studio opens over the game, on this world');
const TOWER = [X - 3, Y, Z - 26, X + 3, Y + 5, Z - 20];
await fev(([b, label]) => { const s = VR.R.byName.stone_bricks.defaultState, L = []; for (let y = b[1]; y <= b[4]; y++) for (let z = b[2]; z <= b[5]; z++) for (let x = b[0]; x <= b[3]; x++) L.push([x, y, z, s]); return VR.StudioWorld.wb.edit(L, label); }, [TOWER, '🏰 Turm']);
await fev(() => document.getElementById('playBtn').click());
check(await inGame(W.id), '▶: back in the game');
for (let i = 0; i < 40 && !(await built(TOWER, 'stone_bricks')); i++) await wait(500);
await wait(800);
const p8 = await me(), f8 = inFront(p8, TOWER);
console.log('  overlay', JSON.stringify(p8), JSON.stringify(f8));
check(f8.ok, 'in front of what was just set, looking at it (' + f8.dist + ' blocks, view ' + f8.look + ')');
const before9 = await me();
await ev(() => VR.game.openStudio());
let ready9 = false;
for (let i = 0; i < 400 && !ready9; i++) { await wait(500); const f = frameStudio(); if (!f) continue; try { ready9 = await f.evaluate((id) => { const WM = window.VR && VR.StudioWorld; return !!(WM && WM.world && WM.world.id === id && !WM.loading && WM.cols.size && document.getElementById('playBtn')); }, W.id); } catch (e) { /* loading */ } }
const lab9 = await fev(() => document.getElementById('playBtn').textContent.trim());
await fev(() => document.getElementById('playBtn').click());
check(await inGame(W.id), '▶ again, nothing new set');
await wait(600);
const p9 = await me();
console.log('  stay', lab9, JSON.stringify(before9.pos), JSON.stringify(p9.pos));
check(hdist(p9.pos, before9.pos) <= 0.5 && Math.abs(p9.pos[1] - before9.pos[1]) <= 0.6, 'nothing new over the open game: you play on where you were ("' + lab9 + '")');
await done();

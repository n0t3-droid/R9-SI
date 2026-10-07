// Doors open with a right click — also when the button is held a moment (a held click used to open and close the
// door again after 0.22 s, so it looked as if nothing happened), and the sliding glass doors of modern houses and
// shops open with a right click too (it used to place the held block into the doorway instead).
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const PORT = 8765 + Math.floor(Math.random() * 200);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', '/home/claude/vr/dist'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 900));
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 600)));
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const ev = (fn, a) => page.evaluate(fn, a);
await page.goto(`http://127.0.0.1:${PORT}/index.html`);
for (let i = 0; i < 120; i++) { await page.waitForTimeout(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 4; g.settings.horizon = 0; g.applySettings('*'); g.createWorld({ name: 'Türen', mode: 'creative', difficulty: 'peaceful', seed: '4711', cheats: true, kit: false }); });
for (let i = 0; i < 120; i++) { await page.waitForTimeout(1000); if (await ev(() => VR.game.state === 'play')) break; }

// a stage in the air: a stone floor, the player on it looking north (−z), a door 2 blocks ahead
const setup = await ev(() => {
  const g = VR.game, w = g.world, p = g.player, R = VR.R;
  const X = Math.floor(p.pos[0]), Y = Math.floor(p.pos[1]) + 20, Z = Math.floor(p.pos[2]);
  const S = (n) => R.byName[n].defaultState;
  for (let x = X - 6; x <= X + 6; x++) for (let z = Z - 8; z <= Z + 4; z++) { w.setBlock(x, Y - 1, z, S('stone'), 4); for (let y = Y; y < Y + 4; y++) w.setBlock(x, y, z, 0, 4); }
  p.pos = [X + 0.5, Y, Z + 0.5]; p.vel = [0, 0, 0]; p.flying = false; p.yaw = 0; p.pitch = -0.35;
  if (g.input) g.input.dragLook = false;   // a locked pointer, as in a real browser: holding the button repeats
  // hold a flagstone, like the player who reported it
  p.inv.slots[p.inv.sel] = { id: R.byName.flagstone ? 'flagstone' : 'stone', n: 64 }; p.inv.changed = true;
  return { X, Y, Z };
});
const step = async (n) => { for (let k = 0; k < n; k++) await ev(() => { const g = VR.game; if (g.input) g.input.dragLook = false; g.last = performance.now() - 33; g.loop(performance.now()); }); };
// place a door at dz blocks ahead and turn the player until the crosshair is on it
const aimAt = async (name, dz, wide) => ev(({ name, dz, wide, X, Y, Z }) => {
  const g = VR.game, w = g.world, p = g.player, R = VR.R, t = R.byName[name];
  const z = Z + dz, cells = [];
  for (let dx = 0; dx < (wide ? 2 : 1); dx++) for (let dy = 0; dy < 2; dy++) {
    let s = t.defaultState;
    if (t.has('half')) s = t.with(s, 'half', dy);
    if (t.has('facing')) s = t.with(s, 'facing', 0);
    w.setBlock(X + dx, Y + dy, z, s, 4); cells.push([X + dx, Y + dy, z]);
  }
  return cells;
}, { name, dz, wide, ...setup });
const target = () => ev(() => { const t = VR.game.player.target; return t ? [t.x, t.y, t.z] : null; });
const openOf = (c) => ev((c) => { const w = VR.game.world, R = VR.R, s = w.getBlock(c[0], c[1], c[2]), t = R.types[R.T.type[s]]; return { name: t ? t.name : null, open: t && t.has('open') ? t.get(s, 'open') : null }; }, c);
// a right click held for ms milliseconds (the first frame is the click)
const rightClick = async (ms) => {
  await ev(() => { const i = VR.game.input; i.mouse.down[2] = true; i.mouse.clicked[2] = true; });
  await step(1);
  const frames = Math.max(0, Math.round(ms / 33) - 1);
  for (let k = 0; k < frames; k++) { await ev(() => { VR.game.input.mouse.down[2] = true; }); await step(1); }
  await ev(() => { const i = VR.game.input; i.mouse.down[2] = false; i.mouse.releasedBtn[2] = true; });
  await step(2);
};

console.log('1 · a wooden door, a quick click and a held click');
const d1 = await aimAt('oak_door', -2, false);
await step(3);
let tg = await target();
// the crosshair: the lower or the upper half of the door, either is fine
const onDoor = (tg, cells) => !!tg && cells.some(c => c[0] === tg[0] && c[1] === tg[1] && c[2] === tg[2]);
if (!onDoor(tg, d1)) { await ev(() => { VR.game.player.pitch = 0; }); await step(2); tg = await target(); }
check(onDoor(tg, d1), 'the crosshair is on the door (' + JSON.stringify(tg) + ')');
await rightClick(60);
check((await openOf(d1[0])).open === 1 && (await openOf(d1[1])).open === 1, 'a quick right click opens it (both halves)');
await rightClick(60);
check((await openOf(d1[0])).open === 0, 'another quick click closes it');
await rightClick(900);
const held = await openOf(d1[0]);
check(held.open === 1, 'a right click held for almost a second opens it — and it stays open (open ' + held.open + ')');
const after = await ev(({ X, Y, Z }) => { const w = VR.game.world; let n = 0; for (let y = Y; y < Y + 3; y++) for (let z = Z - 3; z <= Z; z++) { const s = w.getBlock(X, y, z); if (s && VR.R.types[VR.R.T.type[s]].name !== 'oak_door') n++; } return n; }, setup);
check(after === 0, 'nothing else was placed while the button was held (' + after + ' blocks)');

console.log('2 · a sliding glass door (modern houses, shops)');
await ev(({ X, Y, Z }) => { const w = VR.game.world; for (let y = Y; y < Y + 2; y++) w.setBlock(X, y, Z - 2, 0, 4); }, setup);
const d2 = await aimAt('vx_glass_door_black', -3, true);
await ev(() => { VR.game.player.pitch = -0.2; }); await step(3);
tg = await target();
if (!onDoor(tg, d2)) { await ev(() => { VR.game.player.pitch = 0; }); await step(2); tg = await target(); }
check(onDoor(tg, d2), 'the crosshair is on the glass door (' + JSON.stringify(tg) + ')');
const before = await ev(({ X, Y, Z }) => { const w = VR.game.world; let n = 0; for (let y = Y; y < Y + 3; y++) for (let z = Z - 3; z <= Z; z++) for (let x = X - 1; x <= X + 2; x++) if (w.getBlock(x, y, z)) n++; return n; }, setup);
await rightClick(60);
const g2 = await Promise.all(d2.map(openOf));
check(g2.every(o => o.open === 1), 'a right click slides the whole door open (' + g2.map(o => o.open).join('') + ')');
const after2 = await ev(({ X, Y, Z }) => { const w = VR.game.world; let n = 0; for (let y = Y; y < Y + 3; y++) for (let z = Z - 3; z <= Z; z++) for (let x = X - 1; x <= X + 2; x++) if (w.getBlock(x, y, z)) n++; return n; }, setup);
check(after2 === before, 'and no block lands in the doorway (' + before + ' → ' + after2 + ')');
// walking up to it keeps it open; walking away closes it after a while
await step(10);
check((await Promise.all(d2.map(openOf))).every(o => o.open === 1), 'it stays open a moment');
await ev(({ X, Y, Z }) => { const p = VR.game.player; p.pos = [X + 0.5, Y, Z + 6.5]; }, setup);
for (let k = 0; k < 30; k++) await step(2);
const closed = await Promise.all(d2.map(openOf));
check(closed.every(o => o.open === 0), 'walked away: it slides shut again (' + closed.map(o => o.open).join('') + ')');
await ev(({ X, Y, Z }) => { const p = VR.game.player; p.pos = [X + 0.5, Y, Z - 1.6]; }, setup);
await step(6);
check((await Promise.all(d2.map(openOf))).every(o => o.open === 1), 'walking up to it still opens it by itself');

console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 8)) console.log(l);
check(!logs.length, 'no page errors');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
await browser.close(); srv.kill(); process.exit(fails ? 1 : 0);

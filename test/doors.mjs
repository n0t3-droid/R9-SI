// Doors open with a right click — also when the button is held a moment (a held click used to open and close the
// door again after 0.22 s, so it looked as if nothing happened), and the sliding glass doors of modern houses and
// shops open with a right click too (it used to place the held block into the doorway instead).
// Every other right-click use happens once per click as well, quick or held: trapdoor, gate, lever (and the door it
// powers), a modern hinged door, a Modern Living lamp, a chest, a bed, a seat — and the door of a generated village
// house, walked through. The world is hosted (multiplayer over a local room): each change goes out to the guests once,
// a guest's door stays open, a friend at a sliding door opens it. Holding the button with a block still builds a row.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const PORT = 8765 + Math.floor(Math.random() * 200);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', '/home/claude/vr/dist'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 900));
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 600)));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) logs.push('[console] ' + m.text().slice(0, 400)); });   // the game loop reports its errors here
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const ev = (fn, a) => page.evaluate(fn, a);
// a local multiplayer room: the world is hosted, as the owner did when the doors "did not open"
await page.goto(`http://127.0.0.1:${PORT}/index.html?mp=local:doors${PORT}`);
for (let i = 0; i < 120; i++) { await page.waitForTimeout(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 4; g.settings.horizon = 0; g.applySettings('*'); g.createWorld({ name: 'Türen', mode: 'creative', difficulty: 'peaceful', type: 'default', seed: '424242', cheats: true, kit: false }); });
for (let i = 0; i < 120; i++) { await page.waitForTimeout(1000); if (await ev(() => VR.game.state === 'play')) break; }

// frames are stepped by hand (no animation-frame loop of its own, nothing drawn): 33 ms each, a locked pointer
await ev(() => {
  const g = VR.game;
  window.requestAnimationFrame = () => 0;
  g.renderer.render = function (F) { this.setupCamera(F.cam); };
  g.env.setTime(3000); g.zenFreezeTime = true;
  const T = window.__t = {
    frame() { g.input.dragLook = false; g.last = performance.now() - 33; g.loop(performance.now()); },
    steps(n) { for (let i = 0; i < n; i++) T.frame(); },
    // look from the eye at a point
    look(pt) { const p = g.player, e = p.eyePos(), d = [pt[0] - e[0], pt[1] - e[1], pt[2] - e[2]]; p.yaw = Math.atan2(-d[0], -d[2]); p.pitch = Math.atan2(d[1], Math.hypot(d[0], d[2])); },
    // turn until the crosshair is on one of these cells (tries points across them)
    aim(cells) {
      const p = g.player, w = g.world, on = (h) => !!h && cells.some(c => c[0] === h.x && c[1] === h.y && c[2] === h.z);
      const offs = [0.5, 0.25, 0.75, 0.1, 0.9];
      for (const c of cells) for (const oy of [0.5, 0.25, 0.75, 0.1, 0.9]) for (const ox of offs) for (const oz of offs) {
        T.look([c[0] + ox, c[1] + oy, c[2] + oz]);
        const e = p.eyePos(), d = p.lookDir();
        const h = VR.PHYS.raycast((x, y, z) => w.getBlock(x, y, z), e[0], e[1], e[2], d[0], d[1], d[2], p.reach, { nb: (x, y, z, k) => w.getBlock(x + VR.HF_DX[k], y, z + VR.HF_DZ[k]) });
        if (on(h)) { T.frame(); if (on(p.target)) return [p.target.x, p.target.y, p.target.z]; }
      }
      return null;
    },
    // a right click held for ms milliseconds (the first frame is the click); counts how often the watched cells change
    click(ms, watch) {
      const i = g.input, w = g.world, sig = () => watch.map(c => w.getBlock(c[0], c[1], c[2])).join(',');
      let last = sig(), changes = 0;
      const look = () => { const s = sig(); if (s !== last) { changes++; last = s; } };
      i.mouse.down[2] = true; i.mouse.clicked[2] = true; T.frame(); look();
      for (let k = Math.max(0, Math.round(ms / 33) - 1); k > 0; k--) { i.mouse.down[2] = true; T.frame(); look(); }
      i.mouse.down[2] = false; i.mouse.releasedBtn[2] = true; T.frame(); look(); T.frame(); look();
      return changes;
    },
    prop(c, name) { const s = g.world.getBlock(c[0], c[1], c[2]), t = VR.R.types[VR.R.T.type[s]]; return t && t.has(name) ? t.get(s, name) : null; },
    count(a, b) { const w = g.world; let n = 0; for (let x = a[0]; x <= b[0]; x++) for (let y = a[1]; y <= b[1]; y++) for (let z = a[2]; z <= b[2]; z++) if (w.getBlock(x, y, z)) n++; return n; },
  };
  // every block change the host sends to its guests
  const mp = g.mp; window.__sent = [];
  if (mp) { const o = mp.onBlockChanged.bind(mp); mp.onBlockChanged = (x, y, z, old, s) => { if (mp.active && !mp.applying) window.__sent.push([x, y, z, s]); return o(x, y, z, old, s); }; }
  const said = window.__said = []; const cl = g.ui.chatLine.bind(g.ui); g.ui.chatLine = (t, c) => { said.push(String(t)); return cl(t, c); };
});
await ev(() => __t.steps(20));
console.log('0 · the world is hosted');
check(await ev(() => !!VR.game.mp && VR.game.mp.role === 'host'), 'multiplayer: this page hosts the world (' + (await ev(() => VR.game.mp && VR.game.mp.role)) + ')');

// a stage in the air: a stone floor, the player on it looking north (−z), holding a flagstone (like the player who reported it)
const setup = await ev(() => {
  const g = VR.game, w = g.world, p = g.player, R = VR.R;
  const X = Math.floor(p.pos[0]), Y = Math.floor(p.pos[1]) + 20, Z = Math.floor(p.pos[2]);
  for (let x = X - 6; x <= X + 6; x++) for (let z = Z - 8; z <= Z + 4; z++) { w.setBlock(x, Y - 1, z, R.byName.stone.defaultState, 4); for (let y = Y; y < Y + 4; y++) w.setBlock(x, y, z, 0, 4); }
  p.pos = [X + 0.5, Y, Z + 0.5]; p.vel = [0, 0, 0]; p.flying = false; p.yaw = 0; p.pitch = -0.35;
  p.inv.slots[p.inv.sel] = { id: R.byName.flagstone ? 'flagstone' : 'stone', n: 64 }; p.inv.changed = true;
  return { X, Y, Z };
});
const { X, Y, Z } = setup;
const stageN = () => ev(([a, b]) => __t.count(a, b), [[X - 6, Y, Z - 8], [X + 6, Y + 3, Z + 4]]);
const clearStage = () => ev(({ X, Y, Z }) => { const g = VR.game, w = g.world, p = g.player; for (let x = X - 6; x <= X + 6; x++) for (let z = Z - 8; z <= Z + 4; z++) for (let y = Y; y < Y + 4; y++) w.setBlock(x, y, z, 0, 4); p.pos = [X + 0.5, Y, Z + 0.5]; p.vel = [0, 0, 0]; p.flying = false; p.yaw = 0; p.pitch = -0.35; __t.steps(3); }, setup);
// put a block (two halves for a door) dz ahead, facing the player; props per cell
const put = (name, cells, props) => ev(({ name, cells, props }) => { const t = VR.R.byName[name], w = VR.game.world; cells.forEach((c, i) => { let s = t.defaultState; for (const k in (props[i] || {})) if (t.has(k)) s = t.with(s, k, props[i][k]); w.setBlock(c[0], c[1], c[2], s, 4); }); __t.steps(2); return cells; }, { name, cells, props });
const doorCells = (dx, dz) => [[X + dx, Y, Z + dz], [X + dx, Y + 1, Z + dz]];
const doorProps = [{ half: 0, facing: 0 }, { half: 1, facing: 0 }];
const aim = (cells) => ev((c) => __t.aim(c), cells);
const click = (ms, watch) => ev(([ms, w]) => __t.click(ms, w), [ms, watch]);
const prop = (c, n) => ev(([c, n]) => __t.prop(c, n), [c, n]);
const props = (cells, n) => Promise.all(cells.map(c => prop(c, n)));
const sentFor = (cells) => ev((cells) => window.__sent.filter(e => cells.some(c => c[0] === e[0] && c[1] === e[1] && c[2] === e[2])).length, cells);
const clearSent = () => ev(() => { window.__sent.length = 0; });

console.log('1 · a wooden door, a quick click and a held click');
const d1 = await put('oak_door', doorCells(0, -2), doorProps);
check(!!(await aim(d1)), 'the crosshair is on the door');
await clearSent();
let n = await click(60, d1);
check((await props(d1, 'open')).join('') === '11' && n === 1, 'a quick right click opens it (both halves; changes ' + n + ')');
await ev(() => __t.steps(10));
check((await props(d1, 'open')).join('') === '11', 'and it stays open (the volt update after the change used to shut it again a tick later)');
check(await sentFor(d1) === 2, 'the guests get the change once (' + (await sentFor(d1)) + ' block changes sent)');
// (an open door stands aside: the crosshair goes onto it again before every click)
await aim(d1);
n = await click(60, d1);
check((await props(d1, 'open')).join('') === '00' && n === 1, 'another quick click closes it');
const s1 = await stageN();
await aim(d1);
n = await click(900, d1);
check((await props(d1, 'open')).join('') === '11' && n === 1, 'a right click held for almost a second opens it — and it stays open (changes ' + n + ')');
check(await stageN() === s1, 'nothing else was placed while the button was held');
await aim(d1);
n = await click(900, d1);
check((await props(d1, 'open')).join('') === '00' && n === 1, 'held again: it closes, once');

console.log('2 · a sliding glass door (modern houses, shops)');
await clearStage();
const d2 = await put('vx_glass_door_black', [[X, Y, Z - 3], [X + 1, Y, Z - 3], [X, Y + 1, Z - 3], [X + 1, Y + 1, Z - 3]], [{ facing: 0 }, { facing: 0 }, { facing: 0 }, { facing: 0 }]);
check(!!(await aim(d2)), 'the crosshair is on the glass door');
const s2 = await stageN();
await clearSent();
n = await click(60, d2);
check((await props(d2, 'open')).join('') === '1111', 'a right click slides the whole door open (' + (await props(d2, 'open')).join('') + ')');
check(await stageN() === s2, 'and no block lands in the doorway');
check(await sentFor(d2) === 4, 'the guests get it once (' + (await sentFor(d2)) + ' block changes sent)');
await ev(() => __t.steps(10));
check((await props(d2, 'open')).join('') === '1111', 'it stays open a moment (long enough to walk up to it)');
await ev(({ X, Y, Z }) => { const p = VR.game.player; p.pos = [X + 0.5, Y, Z + 6.5]; }, setup);
await ev(() => __t.steps(90));
check((await props(d2, 'open')).join('') === '0000', 'walked away: it slides shut again (' + (await props(d2, 'open')).join('') + ')');
await ev(({ X, Y, Z }) => { const p = VR.game.player; p.pos = [X + 0.5, Y, Z - 1.6]; }, setup);
await ev(() => __t.steps(6));
check((await props(d2, 'open')).join('') === '1111', 'walking up to it still opens it by itself');
await ev(({ X, Y, Z }) => { const p = VR.game.player; p.pos = [X + 0.5, Y, Z + 0.5]; }, setup);
await ev(() => __t.steps(90));
check((await props(d2, 'open')).join('') === '0000', 'and it closes behind');
await ev(() => { VR.game.player.pitch = -0.2; });
check(!!(await aim(d2)), 'aimed at it again');
n = await click(900, d2);
check((await props(d2, 'open')).join('') === '1111' && await stageN() === s2, 'a held click opens it and places nothing (' + (await stageN()) + ' blocks, ' + s2 + ' before)');
// a friend (a guest of this world) walks up to it while the host stands far away
await ev(({ X, Y, Z }) => { const p = VR.game.player; p.pos = [X + 0.5, Y, Z + 3.5]; }, setup);
await ev(() => __t.steps(90));
check((await props(d2, 'open')).join('') === '0000', 'closed again');
await ev(({ X, Y, Z }) => { const mp = VR.game.mp; mp.__players = mp.players; mp.players = () => [{ peer: 'pGuest', name: 'Buddy', host: false, pos: [X + 1.0, Y, Z - 3.9], dist: 8 }]; }, setup);
await ev(() => __t.steps(6));
check((await props(d2, 'open')).join('') === '1111', 'a friend at the door: it opens for them (on the host)');
await ev(() => { const mp = VR.game.mp; mp.players = mp.__players; });
await ev(() => __t.steps(90));
check((await props(d2, 'open')).join('') === '0000', 'the friend went on: it closes');
// a guest's own game (the host runs the world): the sliding doors around the guest answer the guest at once
const gst = await ev(({ X, Y, Z }) => { const g = VR.game, p = g.player; p.pos = [X + 0.5, Y, Z - 1.6]; g.sim.schedule(X + 5, Y, Z + 3, 100, 'volt'); for (let i = 0; i < 6; i++) g.sim.update(0.05, true); return g.sim.sched.size; }, setup);
check((await props(d2, 'open')).join('') === '1111' && gst === 0, 'as a guest: walking up opens it, the rest of the world stays the host\'s (' + gst + ' scheduled)');

console.log('3 · trapdoor, gate, modern door, lever — a quick and a held click');
for (const [name, cells, pr, key] of [
  ['oak_trapdoor', [[X, Y, Z - 2]], [{ half: 0, facing: 0 }], 'open'],
  ['oak_fence_gate', [[X, Y, Z - 2]], [{ facing: 0 }], 'open'],
  ['door_flush_white', doorCells(0, -2), doorProps, 'open'],
  ['door_strip_anthracite', doorCells(0, -2), doorProps, 'open'],
  ['birch_door', doorCells(0, -2), doorProps, 'open'],
  ['lever', [[X, Y, Z - 2]], [{}], 'powered'],
]) {
  await clearStage();
  const c = await put(name, cells, pr);
  const on = await aim(c);
  if (!on) { check(false, name + ': the crosshair is on it'); continue; }
  const st0 = await stageN();
  const v0 = (await props(c, key)).join('');
  const nq = await click(60, c); const v1 = (await props(c, key)).join('');
  await ev(() => __t.steps(10)); const v1b = (await props(c, key)).join('');
  await aim(c);
  const nh = await click(900, c); const v2 = (await props(c, key)).join('');
  await ev(() => __t.steps(10)); const v2b = (await props(c, key)).join('');
  check(v1 !== v0 && v1b === v1 && nq === 1, name + ': a quick click switches it, and it stays (' + v0 + ' → ' + v1 + ' → ' + v1b + ', changes ' + nq + ')');
  check(v2 === v0 && v2b === v2 && nh === 1, name + ': a held click switches it back, once (' + v1 + ' → ' + v2 + ' → ' + v2b + ', changes ' + nh + ')');
  check(await stageN() === st0, name + ': no block placed');
}

// a button: pressed once by a quick or a held click, it pops back after its pulse (1.5 s)
await clearStage();
const bu = await put('oak_button', [[X, Y, Z - 2]], [{}]);
if (!(await aim(bu))) check(false, 'oak_button: the crosshair is on it');
else {
  const st0 = await stageN();
  const nq = await click(60, bu); const p1 = (await props(bu, 'powered')).join('');
  await ev(() => __t.steps(60)); const p2 = (await props(bu, 'powered')).join('');
  await aim(bu);
  const nh = await click(900, bu); const p3 = (await props(bu, 'powered')).join('');
  await ev(() => __t.steps(60)); const p4 = (await props(bu, 'powered')).join('');
  check(p1 === '1' && nq === 1 && p2 === '0', 'oak_button: a quick click presses it, it pops back (' + p1 + ' → ' + p2 + ')');
  check(p3 === '1' && nh === 1 && p4 === '0', 'oak_button: a held click presses it once (' + p3 + ' → ' + p4 + ', changes ' + nh + ')');
  check(await stageN() === st0, 'oak_button: no block placed');
}

console.log('4 · a lever powers a door — a hand on the door still counts');
await clearStage();
const d4 = await put('oak_door', doorCells(0, -2), doorProps);
const lv = await put('lever', [[X + 1, Y, Z - 2]], [{}]);
await ev(({ X, Y, Z }) => { const p = VR.game.player; p.pos = [X + 1.5, Y, Z + 0.5]; __t.steps(2); }, setup);
const flip = async () => { await aim(lv); return click(60, lv); };
const hand = async () => { await aim(d4); return click(60, d4); };
await flip(); await ev(() => __t.steps(10));
check((await props(d4, 'open')).join('') === '11', 'lever on: the door opens');
await hand(); await ev(() => __t.steps(10));
check((await props(d4, 'open')).join('') === '00', 'shut by hand while powered: it stays shut');
await flip(); await ev(() => __t.steps(10));
check((await props(d4, 'open')).join('') === '00', 'lever off: still shut');
await flip(); await ev(() => __t.steps(10));
check((await props(d4, 'open')).join('') === '11', 'lever on again: it opens');
await flip(); await ev(() => __t.steps(10));
check((await props(d4, 'open')).join('') === '00', 'lever off: it closes');

console.log('5 · a Modern Living lamp, a chest, a bed, a seat');
// the lamp: every part switches together, once per click
await clearStage();
const lamp = await ev(({ X, Y, Z }) => { const g = VR.game, w = g.world, R = VR.R, VM = VR.VM, name = 'vm_light_floor_globe_brass', t = R.byName[name], m = VM.MODELS[name]; const cells = []; for (const [dx, dy, dz, i] of VM.footprint(m, 0)) { w.setBlock(X + dx, Y + dy, Z - 2 + dz, t.state({ facing: 0, part: i, lit: 1 }), 4); cells.push([X + dx, Y + dy, Z - 2 + dz]); } __t.steps(2); return cells; }, setup);
if (!(await aim(lamp))) check(false, 'lamp: the crosshair is on it');
else {
  const st0 = await stageN();
  const nq = await click(60, lamp); const l1 = (await props(lamp, 'lit')).join('');
  await aim(lamp);
  const nh = await click(900, lamp); const l2 = (await props(lamp, 'lit')).join('');
  check(/^0+$/.test(l1) && nq === 1, 'lamp: a quick click switches it off, all parts (' + l1 + ', changes ' + nq + ')');
  check(/^1+$/.test(l2) && nh === 1, 'lamp: a held click switches it on, once (' + l2 + ', changes ' + nh + ')');
  check(await stageN() === st0, 'lamp: no block placed');
}
// containers — a chest and a Modern Living kitchen cupboard: the inventory opens, nothing is put in front of them
for (const name of ['chest', 'vm_kitchen_sage_drawers']) {
  await clearStage();
  const ch = await ev(({ X, Y, Z, name }) => { const g = VR.game, w = g.world, R = VR.R, VM = VR.VM, t = R.byName[name], m = VM && VM.MODELS[name]; const cells = []; if (m) { for (const [dx, dy, dz, i] of VM.footprint(m, 2)) { w.setBlock(X + dx, Y + dy, Z - 2 + dz, t.state({ facing: 2, part: i }), 4); cells.push([X + dx, Y + dy, Z - 2 + dz]); } } else { w.setBlock(X, Y, Z - 2, t.with(t.defaultState, 'facing', 2), 4); cells.push([X, Y, Z - 2]); } __t.steps(2); return cells; }, { ...setup, name });
  if (!(await aim(ch))) { check(false, name + ': the crosshair is on it'); continue; }
  const st0 = await stageN();
  await click(60, ch);
  const o1 = await ev(() => ({ screen: VR.game.ui.screen, kind: VR.game.ui.invKind }));
  await ev(() => { VR.game.ui.closeInventory(); __t.steps(2); });
  await aim(ch);
  await click(900, ch);
  const o2 = await ev(() => ({ screen: VR.game.ui.screen, kind: VR.game.ui.invKind }));
  await ev(() => { VR.game.ui.closeInventory(); __t.steps(2); });
  check(o1.screen === 'inventory' && o1.kind === 'chest', name + ': a quick click opens it (' + JSON.stringify(o1) + ')');
  check(o2.screen === 'inventory' && o2.kind === 'chest', name + ': a held click opens it (' + JSON.stringify(o2) + ')');
  check(await stageN() === st0, name + ': no block placed');
}
// the bed (by day): the spawn point, said once per click
await clearStage();
const bed = await put('white_bed', [[X, Y, Z - 2], [X, Y, Z - 3]], [{ facing: 0, part: 0 }, { facing: 0, part: 1 }]);
if (!(await aim(bed))) check(false, 'bed: the crosshair is on it');
else {
  const st0 = await stageN();
  await ev(() => { window.__said.length = 0; VR.game.player.spawnBed = null; });
  await click(60, bed);
  const b1 = await ev(() => ({ bed: VR.game.player.spawnBed, said: window.__said.filter(t => /Spawn point/.test(t)).length }));
  await ev(() => { window.__said.length = 0; });
  await aim(bed);
  await click(900, bed);
  const b2 = await ev(() => window.__said.filter(t => /Spawn point/.test(t)).length);
  check(!!b1.bed && bed.some(c => c.join() === b1.bed.join()) && b1.said === 1, 'bed: a quick click sets the spawn point (' + JSON.stringify(b1) + ')');
  check(b2 === 1, 'bed: a held click does it once (' + b2 + ' messages)');
  check(await stageN() === st0, 'bed: no block placed');
}
// a seat (Modern Living armchair): sit down once, stand up with Shift
await clearStage();
const seat = await ev(({ X, Y, Z }) => { const g = VR.game, w = g.world, R = VR.R, VM = VR.VM, name = 'vm_armchair_cream', t = R.byName[name], m = VM.MODELS[name]; const cells = []; for (const [dx, dy, dz, i] of VM.footprint(m, 2)) { w.setBlock(X + dx, Y + dy, Z - 2 + dz, t.state({ facing: 2, part: i }), 4); cells.push([X + dx, Y + dy, Z - 2 + dz]); } __t.steps(2); return cells; }, setup);
for (const ms of [60, 900]) {
  if (!(await aim(seat))) { check(false, 'seat: the crosshair is on it'); break; }
  const st0 = await stageN();
  await click(ms, seat);
  const r = await ev(() => { const G = VR.game.gadgets; return G && G.riding ? G.riding.type : null; });
  check(r === 'seat' && await stageN() === st0, 'seat: a ' + (ms > 100 ? 'held' : 'quick') + ' click sits down, nothing placed (' + r + ')');
  await ev(({ X, Y, Z }) => { const g = VR.game; if (g.gadgets && g.gadgets.riding) g.gadgets.dismount(); const p = g.player; p.pos = [X + 0.5, Y, Z + 0.5]; p.vel = [0, 0, 0]; __t.steps(3); }, setup);
}

console.log('6 · a guest opens a door: it stays open in the host\'s world');
await clearStage();
const d6 = await put('oak_door', doorCells(0, -2), doorProps);
await clearSent();
await ev((cells) => {
  const g = VR.game, mp = g.mp, w = g.world, R = VR.R;
  const pairs = []; let cx = 0, cz = 0;
  for (const c of cells) { const s = w.getBlock(c[0], c[1], c[2]), t = R.types[R.T.type[s]]; pairs.push((c[1] << 8) | ((c[2] & 15) << 4) | (c[0] & 15), t.with(s, 'open', 1)); cx = c[0] >> 4; cz = c[2] >> 4; }
  mp.onEdit({ sameTab: false, peer: 'pGuest', data: { s: mp.session, c: [[cx, cz, VR.Net.b64(new Uint8Array(new Int32Array(pairs).buffer))]] } });
  __t.steps(20);
}, d6);
check((await props(d6, 'open')).join('') === '11', 'the guest\'s door is open on the host and stays open');
check(await ev((cells) => window.__sent.filter(e => cells.some(c => c[0] === e[0] && c[1] === e[1] && c[2] === e[2]) && VR.R.types[VR.R.T.type[e[3]]].get(e[3], 'open') === 0).length, d6) === 0, 'the host never sends it shut again');

// a guest presses a button: in the host's world it pops back too (it used to stay pressed for good)
await clearStage();
const b6 = await put('oak_button', [[X + 2, Y, Z - 2]], [{}]);
await ev((c) => {
  const g = VR.game, mp = g.mp, w = g.world, R = VR.R, s = w.getBlock(c[0], c[1], c[2]), t = R.types[R.T.type[s]];
  const pairs = [(c[1] << 8) | ((c[2] & 15) << 4) | (c[0] & 15), t.with(s, 'powered', 1)];
  mp.onEdit({ sameTab: false, peer: 'pGuest', data: { s: mp.session, c: [[c[0] >> 4, c[2] >> 4, VR.Net.b64(new Uint8Array(new Int32Array(pairs).buffer))]] } });
  __t.steps(3);
}, b6[0]);
const gb1 = (await props(b6, 'powered')).join('');
await ev(() => __t.steps(60));
check(gb1 === '1' && (await props(b6, 'powered')).join('') === '0', 'a guest\'s button press arrives and pops back after its pulse (' + gb1 + ' → ' + (await props(b6, 'powered')).join('') + ')');
// a friend steps onto a pressure plate in front of a door: it opens for them, and closes when they step off
const d6c = await put('oak_door', doorCells(2, -4), doorProps);
const pl = await put('oak_pressure_plate', [[X + 2, Y, Z - 3]], [{}]);
await ev(({ X, Y, Z }) => { const mp = VR.game.mp; mp.__players = mp.players; mp.players = () => [{ peer: 'pGuest', name: 'Buddy', host: false, pos: [X + 2.5, Y, Z - 2.5], dist: 4 }]; __t.steps(12); }, setup);
const pp1 = [(await props(pl, 'powered')).join(''), (await props(d6c, 'open')).join('')];
await ev(() => { const mp = VR.game.mp; mp.players = mp.__players; __t.steps(12); });
const pp2 = [(await props(pl, 'powered')).join(''), (await props(d6c, 'open')).join('')];
check(pp1.join(' ') === '1 11' && pp2.join(' ') === '0 00', 'a friend on a pressure plate opens the door, stepping off closes it (' + pp1.join(' ') + ' → ' + pp2.join(' ') + ')');

console.log('6b · a villager opens a door on the way: it stays open until they are through, then they close it');
await clearStage();
const d6b = await put('oak_door', doorCells(0, -2), doorProps);
await ev((c) => { VR.game.villages.tryOpenDoor(c[0], c[1], c[2]); __t.steps(10); }, d6b[0]);
check((await props(d6b, 'open')).join('') === '11', 'opened by a villager, it stays open (it used to snap shut a tick later)');
await ev(() => __t.steps(90));
check((await props(d6b, 'open')).join('') === '00', 'and the villager closes it behind them');

console.log('7 · holding the button with a block still builds');
await clearStage();
// a pillar 4 blocks ahead at eye height: the held button builds a row from it towards the player (who is never walled in)
const built = await ev(({ X, Y, Z }) => {
  const g = VR.game, p = g.player, i = g.input, w = g.world, R = VR.R;
  w.setBlock(X, Y + 1, Z - 4, R.byName.stone.defaultState, 4);
  p.inv.slots[p.inv.sel] = { id: 'stone', n: 64 }; p.inv.changed = true;
  __t.look([X + 0.5, Y + 1.5, Z - 3]); __t.frame();
  const before = __t.count([X - 6, Y, Z - 8], [X + 6, Y + 3, Z + 4]);
  i.mouse.down[2] = true; i.mouse.clicked[2] = true; __t.frame();
  for (let k = 0; k < 34; k++) { i.mouse.down[2] = true; __t.frame(); }
  i.mouse.down[2] = false; i.mouse.releasedBtn[2] = true; __t.frame();
  return __t.count([X - 6, Y, Z - 8], [X + 6, Y + 3, Z + 4]) - before;
}, setup);
check(built === 3, 'a held right click with stone builds a row of 3 up to the player (' + built + ' blocks in ~1.1 s)');

console.log('8 · the door of a generated village house');
let home = null;
for (let i = 0; i < 60 && !home; i++) {
  home = await ev(() => {
    const g = VR.game, V = g.villages, w = g.world, R = VR.R, p = g.player; if (!V) return null;
    let best = null, bd = 1e9;
    for (const vil of V.known.values()) for (const h of vil.plan.homes || []) {
      if (!h.door || !h.outside || !h.inside) continue;
      const d = Math.hypot(h.door[0] - p.pos[0], h.door[2] - p.pos[2]); if (d < bd) { bd = d; best = { door: h.door, outside: h.outside, inside: h.inside, village: vil.name }; }
    }
    if (!best) __t.steps(10);
    return best;
  });
}
if (!home) check(false, 'a village with houses was found');
else {
  // the villagers wait a moment (and step aside), so every door change counted here is the player's
  await ev((h) => { const V = VR.game.villages; V.__update = V.update; V.update = () => {}; V.__away = []; for (const a of V.agents) if (Math.hypot(a.pos[0] - h.door[0], a.pos[2] - h.door[2]) < 8) { V.__away.push([a, a.pos.slice()]); a.pos[1] += 60; } }, home);
  const arrived = await ev(async (h) => {
    const g = VR.game, p = g.player, w = g.world;
    p.flying = false; p.safeTeleport(h.outside[0] + 0.5, h.outside[1], h.outside[2] + 0.5, { exact: true });
    for (let k = 0; k < 900; k++) { __t.frame(); if (!p.hold && w.isLoaded(h.door[0], h.door[2]) && k > 20) break; if (k % 10 === 9) await new Promise(r => setTimeout(r, 100)); }
    __t.steps(5);
    const s = w.getBlock(h.door[0], h.door[1], h.door[2]), t = VR.R.types[VR.R.T.type[s]];
    return { pos: p.pos.map(v => Math.round(v * 10) / 10), kind: t ? t.o.kind : null, name: t ? t.name : null, hold: !!p.hold };
  }, home);
  console.log('  ' + home.village + ': door ' + JSON.stringify(home.door) + ' ' + arrived.name + ', standing at ' + JSON.stringify(arrived.pos));
  const hd = [home.door, [home.door[0], home.door[1] + 1, home.door[2]]];
  check(arrived.kind === 'door', 'the house has a hinged door (' + arrived.name + ')');
  // a villager may have left it open just now: shut, as the house was built
  await ev((hd) => { const w = VR.game.world, R = VR.R; for (const c of hd) { const s = w.getBlock(c[0], c[1], c[2]), t = R.types[R.T.type[s]]; if (t && t.has('open')) w.setBlock(c[0], c[1], c[2], t.with(s, 'open', 0), 4); } __t.steps(2); }, hd);
  const a8 = await aim(hd);
  check(!!a8, 'the crosshair is on the house door');
  if (a8) {
    const nq = await click(60, hd);
    check((await props(hd, 'open')).join('') === '11' && nq === 1, 'a quick click opens the house door (' + (await props(hd, 'open')).join('') + ', changes ' + nq + ')');
    await ev(() => __t.steps(10));
    check((await props(hd, 'open')).join('') === '11', 'and it stays open');
    // walk in: W held, towards the inside
    const walk = await ev((h) => {
      const g = VR.game, p = g.player, i = g.input;
      const go = [h.inside[0] + 0.5, h.inside[1] + 1.6, h.inside[2] + 0.5]; __t.look(go); p.pitch = 0;
      const ux = h.inside[0] - h.outside[0], uz = h.inside[2] - h.outside[2], ul = Math.hypot(ux, uz);
      const along = () => ((p.pos[0] - (h.door[0] + 0.5)) * ux + (p.pos[2] - (h.door[2] + 0.5)) * uz) / ul;
      const a0 = along();
      i.keys.add('KeyW'); for (let k = 0; k < 30; k++) __t.frame(); i.keys.delete('KeyW'); __t.steps(5);
      return { a0: Math.round(a0 * 10) / 10, a1: Math.round(along() * 10) / 10, pos: p.pos.map(v => Math.round(v * 10) / 10) };
    }, home);
    check(walk.a0 < 0 && walk.a1 > 0.6, 'and the player walks into the house through it (' + walk.a0 + ' → ' + walk.a1 + ' blocks past the door)');
    // from inside: a held click shuts it, once
    const a8b = await aim(hd);
    if (!a8b) check(false, 'from inside, the crosshair is on the door');
    else {
      const nh = await click(900, hd);
      check((await props(hd, 'open')).join('') === '00' && nh === 1, 'from inside, a held click shuts it, once (changes ' + nh + ')');
    }
  }
  await ev(() => { const V = VR.game.villages; V.update = V.__update; for (const [a, pos] of V.__away) a.pos = pos; });
}

console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 8)) console.log(l);
check(!logs.length, 'no page errors');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
await browser.close(); srv.kill(); process.exit(fails ? 1 : 0);

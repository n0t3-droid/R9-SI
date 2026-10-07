// Doors & every right-click use, without a browser (a second instead of a turn at the browser lock): the game's own
// player, sim and interaction code on a small fake world. A door opened by hand stays open (the volt update after the
// change used to shut it a tick later), a held right click uses a block once and only ever repeats PLACING, sliding
// glass doors open on a right click (nothing lands in the doorway) and for friends in a multiplayer world, a lever
// still drives its door (power swings it when the power changes), a guest's button pops back, a friend's pressure
// plate works. The browser test (doors.mjs) checks the same in the real game.
// usage: node test/doors_node.js
const ROOT = require('path').join(__dirname, '..');
const VR = require(ROOT + '/test/load_shared.js');
globalThis.window = globalThis; globalThis.document = { getElementById: () => null, addEventListener() {} };
for (const f of ['sim', 'place', 'player', 'game']) require(ROOT + '/src/main/' + f + '.js');
const R = VR.R;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };

// ---- a fake world (a Map) with the game's listener chain: world → game.onBlockChanged → sim
const blocks = new Map(), K = (x, y, z) => x + ',' + y + ',' + z;
const world = {
  listeners: [],
  getBlock: (x, y, z) => blocks.get(K(x, y, z)) || 0,
  setBlock(x, y, z, s, flags) { const old = this.getBlock(x, y, z); if (old === s) return false; if (s) blocks.set(K(x, y, z), s); else blocks.delete(K(x, y, z)); if (!(flags & 2)) for (const l of this.listeners) l.onBlockChanged(x, y, z, old, s); return true; },
  getLight: () => 0, col: () => null, isLoaded: () => true,
};
const calls = { sleep: 0, open: 0, sit: 0 };
const game = {
  world, settings: {}, mp: null,
  audio: { play() {}, place() {}, tone() {}, dig() {} }, particles: { breakBlock() {}, spark() {}, smoke() {}, glow() {} },
  ui: { blocking: false, chatLine() {}, openInventory() {} },
  gadgets: { update: () => false, sit: () => calls.sit++ },
  sleep: () => calls.sleep++, openContainer: () => calls.open++,
  onBlockPlaced() {}, entityBlocks: () => false,
  onBlockChanged(x, y, z, old, s) { if (!(this.mp && this.mp.isClient)) this.sim.onBlockChanged(x, y, z, old, s); },
  interactBlock: VR.Game.prototype.interactBlock,
};
game.sim = new VR.Sim(game);
world.listeners.push(game);
const p = game.player = new VR.Player(game);
p.mode = 'creative'; p.eye = 1.62;
const S = (n) => R.byName[n].defaultState;
const Y = 64;
for (let x = -6; x <= 6; x++) for (let z = -8; z <= 4; z++) world.setBlock(x, Y - 1, z, S('stone'), 0);

// ---- input, frames, aiming, clicks
const input = { captured: true, dragLook: false, mouse: { down: [false, false, false], clicked: [false, false, false], releasedBtn: [false, false, false], wheel: 0, dx: 0, dy: 0 }, hit: () => false, down: () => false };
const frame = () => { p.interact(0.033, input); game.sim.update(0.033, !!(game.mp && game.mp.isClient)); input.mouse.clicked = [false, false, false]; input.mouse.releasedBtn = [false, false, false]; };
const steps = (n) => { for (let i = 0; i < n; i++) frame(); };
const look = (pt) => { const e = p.eyePos(), d = [pt[0] - e[0], pt[1] - e[1], pt[2] - e[2]]; p.yaw = Math.atan2(-d[0], -d[2]); p.pitch = Math.atan2(d[1], Math.hypot(d[0], d[2])); };
const aim = (cells) => {
  const on = (h) => !!h && cells.some(c => c[0] === h.x && c[1] === h.y && c[2] === h.z), o = [0.5, 0.25, 0.75, 0.1, 0.9];
  for (const c of cells) for (const oy of o) for (const ox of o) for (const oz of o) { look([c[0] + ox, c[1] + oy, c[2] + oz]); frame(); if (on(p.target)) return true; }
  return false;
};
// a right click held for ms (the first frame is the click); how often the watched cells change meanwhile
const click = (ms, watch) => {
  const sig = () => watch.map(c => world.getBlock(c[0], c[1], c[2])).join(','); let last = sig(), n = 0;
  const seen = () => { const s = sig(); if (s !== last) { n++; last = s; } };
  input.mouse.down[2] = true; input.mouse.clicked[2] = true; frame(); seen();
  for (let k = Math.max(0, Math.round(ms / 33) - 1); k > 0; k--) { frame(); seen(); }
  input.mouse.down[2] = false; input.mouse.releasedBtn[2] = true; frame(); seen(); frame(); seen();
  return n;
};
const count = () => { let n = 0; for (let x = -6; x <= 6; x++) for (let y = Y; y < Y + 4; y++) for (let z = -8; z <= 4; z++) if (world.getBlock(x, y, z)) n++; return n; };
const clear = () => { for (let x = -6; x <= 6; x++) for (let y = Y; y < Y + 4; y++) for (let z = -8; z <= 4; z++) world.setBlock(x, y, z, 0, 0); p.pos = [0.5, Y, 0.5]; steps(3); };
const put = (name, cells, props) => { const t = R.byName[name]; cells.forEach((c, i) => { let s = t.defaultState; for (const k in (props[i] || {})) if (t.has(k)) s = t.with(s, k, props[i][k]); world.setBlock(c[0], c[1], c[2], s, 4); }); return cells; };
const putModel = (name, f, x, z) => { const VM = VR.VM, t = R.byName[name], m = VM.MODELS[name], cells = []; for (const [dx, dy, dz, i] of VM.footprint(m, f)) { world.setBlock(x + dx, Y + dy, z + dz, t.state({ facing: f, part: i, lit: 1 }), 4); cells.push([x + dx, Y + dy, z + dz]); } return cells; };
const prop = (cells, k) => cells.map(c => { const s = world.getBlock(c[0], c[1], c[2]), t = R.types[R.T.type[s]]; return t && t.has(k) ? t.get(s, k) : '-'; }).join('');
const door = (x, z) => [[x, Y, z], [x, Y + 1, z]], DP = [{ half: 0, facing: 0 }, { half: 1, facing: 0 }];
p.inv.slots[0] = { id: 'flagstone', n: 64 }; p.inv.sel = 0;

console.log('1 · a quick and a held right click: once, and it stays');
for (const [name, cells, pr, key] of [
  ['oak_door', door(0, -2), DP, 'open'], ['door_flush_white', door(0, -2), DP, 'open'], ['birch_door', door(0, -2), DP, 'open'],
  ['oak_trapdoor', [[0, Y, -2]], [{ half: 0, facing: 0 }], 'open'], ['oak_fence_gate', [[0, Y, -2]], [{ facing: 0 }], 'open'], ['lever', [[0, Y, -2]], [{}], 'powered'],
]) {
  clear(); put(name, cells, pr);
  if (!aim(cells)) { check(false, name + ': aimed at'); continue; }
  const c0 = count(), v0 = prop(cells, key), nq = click(60, cells), v1 = prop(cells, key); steps(10); const v1b = prop(cells, key);
  aim(cells); const nh = click(900, cells), v2 = prop(cells, key); steps(10); const v2b = prop(cells, key);
  check(v1 !== v0 && v1b === v1 && nq === 1 && v2 === v0 && v2b === v0 && nh === 1 && count() === c0, name + ': quick ' + v0 + '→' + v1 + '→' + v1b + ' (' + nq + '×), held →' + v2 + '→' + v2b + ' (' + nh + '×), nothing placed');
}
clear(); const lamp = putModel('vm_light_floor_globe_brass', 0, 0, -2);
if (aim(lamp)) { const nq = click(60, lamp), l1 = prop(lamp, 'lit'); aim(lamp); const nh = click(900, lamp); check(/^0+$/.test(l1) && nq === 1 && /^1+$/.test(prop(lamp, 'lit')) && nh === 1, 'a Modern Living lamp: off and on again, all parts, once per click'); } else check(false, 'lamp: aimed at');
for (const [what, name, mk] of [['open', 'chest', () => put('chest', [[0, Y, -2]], [{ facing: 2 }])], ['open', 'vm_kitchen_sage_drawers', () => putModel('vm_kitchen_sage_drawers', 2, 0, -2)], ['sleep', 'white_bed', () => put('white_bed', [[0, Y, -2], [0, Y, -3]], [{ facing: 0, part: 0 }, { facing: 0, part: 1 }])], ['sit', 'vm_armchair_cream', () => putModel('vm_armchair_cream', 2, 0, -2)]]) {
  clear(); const cells = mk(); calls[what] = 0;
  if (!aim(cells)) { check(false, name + ': aimed at'); continue; }
  const c0 = count(); click(60, cells); const a = calls[what]; aim(cells); click(900, cells);
  check(a === 1 && calls[what] === 2 && count() === c0, name + ': ' + what + ' once per click, quick and held (' + calls[what] + '×), nothing placed');
}

console.log('2 · holding the button with a block builds a row (and only that repeats)');
clear(); world.setBlock(0, Y + 1, -4, S('stone'), 0); p.inv.slots[0] = { id: 'stone', n: 64 };
look([0.5, Y + 1.5, -3]); frame(); { const c0 = count(); input.mouse.down[2] = true; input.mouse.clicked[2] = true; frame(); steps(34); input.mouse.down[2] = false; frame(); check(count() - c0 === 3, 'a row of 3 up to the player (' + (count() - c0) + ')'); }
p.inv.slots[0] = { id: 'flagstone', n: 64 };

console.log('3 · sliding glass doors');
clear(); const md = put('vx_glass_door_black', [[0, Y, -3], [1, Y, -3], [0, Y + 1, -3], [1, Y + 1, -3]], [{ facing: 0 }, { facing: 0 }, { facing: 0 }, { facing: 0 }]);
p.pos = [0.5, Y, 2.5]; steps(2);
if (!aim(md)) check(false, 'aimed at the glass door');
else {
  const c0 = count(); click(900, md);
  check(prop(md, 'open') === '1111' && count() === c0, 'a right click (held) slides the whole door open, nothing lands in the doorway');
  let shut = -1; for (let i = 1; i <= 120 && shut < 0; i++) { frame(); if (prop(md, 'open') === '0000') shut = i; }
  check(shut > 30 && shut < 90, 'it stays open long enough to walk up to it, then closes (' + shut + ' frames after the held click)');
  p.pos = [0.5, Y, -1.6]; steps(6); check(prop(md, 'open') === '1111', 'walking up opens it by itself');
  p.pos = [0.5, Y, 4.5]; steps(40); check(prop(md, 'open') === '0000', 'and it closes behind');
  game.mp = { active: true, isClient: false, players: () => [{ pos: [1.0, Y, -3.9] }] }; steps(6);
  check(prop(md, 'open') === '1111', 'a friend (multiplayer) at the door opens it');
  game.mp.players = () => []; steps(40); check(prop(md, 'open') === '0000', 'the friend went on: it closes');
  game.mp = { active: true, isClient: true, players: () => [] }; p.pos = [0.5, Y, -1.6]; game.sim.schedule(5, Y, 3, 100, 'volt'); steps(6);
  check(prop(md, 'open') === '1111' && game.sim.sched.size === 0, 'as a guest: it opens for the guest, the rest of the world stays the host\'s');
  game.mp = null; p.pos = [0.5, Y, 0.5];
}

console.log('4 · power: a lever drives its door, a hand still counts');
clear(); const d4 = put('oak_door', door(0, -2), DP), lv = put('lever', [[1, Y, -2]], [{}]);
const flip = () => { aim(lv); click(60, lv); steps(6); return prop(d4, 'open'); }, hand = () => { aim(d4); click(60, d4); steps(6); return prop(d4, 'open'); };
check(flip() === '11', 'lever on: the door opens');
check(hand() === '00', 'shut by hand while powered: it stays shut');
check(flip() === '00', 'lever off: still shut');
check(flip() === '11' && flip() === '00', 'lever on: opens, off: closes');

console.log('5 · multiplayer (host): a guest\'s door, button and pressure plate');
clear(); game.mp = { active: true, isClient: false, players: () => [] };
const d5 = put('oak_door', door(0, -2), [{ half: 0, facing: 0, open: 1 }, { half: 1, facing: 0, open: 1 }]);   // arrives like a guest's edit (setBlock, notify)
steps(20); check(prop(d5, 'open') === '11', 'a door a guest opened stays open in the host\'s world');
const b5 = put('oak_button', [[2, Y, -2]], [{ powered: 1 }]); steps(3); const pressed = prop(b5, 'powered'); steps(60);
check(pressed === '1' && prop(b5, 'powered') === '0', 'a button a guest pressed pops back after its pulse');
const d5b = put('oak_door', door(2, -4), DP), pl = put('oak_pressure_plate', [[2, Y, -3]], [{}]);
game.mp.players = () => [{ pos: [2.5, Y, -2.5] }]; steps(12); const on = prop(pl, 'powered') + ' ' + prop(d5b, 'open');
game.mp.players = () => []; steps(12); const off = prop(pl, 'powered') + ' ' + prop(d5b, 'open');
check(on === '1 11' && off === '0 00', 'a friend on a pressure plate opens the door, stepping off closes it (' + on + ' → ' + off + ')');
game.mp = null;

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

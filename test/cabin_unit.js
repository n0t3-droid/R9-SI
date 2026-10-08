// Walking inside a shuttle without a browser: the real starship generator (the carved cabin & cargo bay, the walk
// grid), starships.js + cabin.js over a fake flat world. Up the ramp, through the cargo bay and the cabin, the cockpit
// door opens as you come, up the steps, into the pilot seat and out of it again, out of the side door and down the
// stair; walls stop you; hovering ships carry you along. Run: node test/cabin_unit.js
const VR = require('./load_shared.js');
globalThis.VR = VR;
global.window = global.window || {};
global.document = global.document || { getElementById: () => null, createElement: () => ({ style: {}, getContext: () => null }) };
global.performance = global.performance || { now: () => Date.now() };
VR.SHADERS = VR.SHADERS || {};
require(__dirname + '/../src/main/voxmodels.js');
require(__dirname + '/../src/main/flight.js');
require(__dirname + '/../src/main/cockpit.js');
require(__dirname + '/../src/main/starships.js');
require(__dirname + '/../src/main/cabin.js');
const R = VR.R;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };

// ---- a fake world: flat stone up to y = G
const G = 64, STONE = R.byName.stone.defaultState;
class World {
  constructor() { this.cols = new Map(); }
  col(cx, cz) { const k = cx + ',' + cz; let c = this.cols.get(k); if (!c) { c = this.make(cx, cz); this.cols.set(k, c); } return c; }
  make(cx, cz) { const c = { cx, cz, ready: true, H: 256, height: new Uint8Array(256).fill(G - 1), blocks: new Uint16Array(256 * 256), blockEntities: new Map(), sec: [] }; for (let y = 0; y < G; y++) c.blocks.fill(STONE, y << 8, (y << 8) + 256); return c; }
  getBlock(x, y, z) { if (y < 0 || y >= 256) return 0; const c = this.col(x >> 4, z >> 4); return c.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)]; }
  getLight() { return 0xf000; }
}
const world = new World();
const hints = [];
const ui = { hint(t) { hints.push(t); }, chatLine() { }, typing: false, vehicleHud() { } };
const g = { world, frame: 0, renderer: { gl: null }, particles: { spawn() { }, smoke() { }, spark() { }, explosion() { } }, settings: { camShake: true }, ui, audio: { play() { }, loop() { }, turbine() { }, tone() { }, step() { } }, trails: null, time: 0, meta: {} };
g.player = { pos: [0, G, 0], vel: [0, 0, 0], eye: 1.62, yaw: 0, pitch: 0, flying: false, teleport(x, y, z) { this.pos = [x, y, z]; this.vel = [0, 0, 0]; }, lookDir() { return [0, 0, -1]; } };
g.pool = { workers: [{ inflight: 0 }], direct(i, msg, tr, cb) {
  if (msg.type === 'surface') { cb({ res: msg.points.map(() => G - 1) }); return; }
  const r = VR.Starship.build(msg.seed, msg.arch); cb({ type: 'starship', meta: r.meta, occ: r.occ, walk: r.walk, hull: { count: 0 }, glass: { count: 0 }, gear: { count: 0 } }); } };
VR.C = VR.C || {}; if (VR.C.SEA === undefined) VR.C.SEA = 40;
g.villages = { list: () => [] };
g.gadgets = { riding: null, freeSpot: (c) => c[0] };
const mgr = g.starships = new VR.Starships(g, { title: true });

const input = { keys: new Set(), pressed: new Set(), captured: true, sensitivity: 0.0024, invertY: false, dragLook: false, mouse: { dx: 0, dy: 0, down: [false, false, false], clicked: [false, false, false], wheel: 0 },
  down(c) { return this.keys.has(c); }, hit(c) { return this.pressed.has(c); }, dbl() { return false; }, clickAction() { return false; } };
// one frame of the game's ship systems: hatches, the walker (or the pilot), the world's player otherwise (a plain walker
// on the flat ground: WASD along its yaw)
const frame = (dt) => {
  g.time += dt;
  const r = g.gadgets.riding;
  if (r && r.type === 'cabin') mgr.walk(dt, input, false);
  else if (r && r.type === 'starship') mgr.drive(dt, input, false);
  else { const p = g.player, fw = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0), cy = Math.cos(p.yaw), sy = Math.sin(p.yaw); p.pos[0] += -sy * fw * 4.3 * dt; p.pos[2] += -cy * fw * 4.3 * dt; p.pos[1] = G; }
  mgr.update(dt);
  input.pressed.clear(); input.mouse.dx = 0; input.mouse.dy = 0; input.mouse.clicked = [false, false, false];
};
const run = (sec, dt = 1 / 30, each) => { const n = Math.round(sec / dt); for (let i = 0; i < n; i++) { if (each && each(i) === false) break; frame(dt); } };
const W = () => mgr.cabin.w;

// ---- a shuttle on the ground
const s = mgr.spawn(4242, 'shuttle', null, [0.5, G, 0.5], 0);
const C = s.d.meta.cabin, ck = s.d.meta.cockpit;
check(!!C && !!s.d.walk, 'the shuttle has a cabin and a walk grid (' + (C && C.items.length) + ' furnishings, deck at ' + (C && C.floor) + ' m)');
check(C && C.items.filter(q => q.kind === 'seat').length >= 4 && C.items.filter(q => q.kind === 'seat').length <= 6, 'four to six seats (' + C.items.filter(q => q.kind === 'seat').length + ')');
check(C && C.items.some(q => q.kind === 'table') && C.items.some(q => q.kind === 'bike') && C.items.some(q => q.kind === 'crate') && C.items.some(q => q.kind === 'locker'), 'a holo table, a hoverbike, crates and lockers');
const solid = (x, y, z) => VR.ShipCabin.solid(s.d.walk, x, y, z);
check(!solid(0, C.floor + 0.5, (C.zIn + C.zEnd) / 2) && !solid(0, C.floor + 1.7, (C.zIn + C.zEnd) / 2) && solid(0, C.floor - 0.1, (C.zIn + C.zEnd) / 2), 'standing room down the middle, a deck under it');

console.log('1 · the ramp');
mgr.cabin.toggleRamp(s, true); run(3);
check(s.hatch.ramp === 1 && Math.abs(s.kneel - 0.5) < 1e-6, 'the ramp is down and the ship kneels (' + s.hatch.ramp + ', kneel ' + s.kneel + ')');
const foot = mgr.cabin.toWorld(s, [0, mgr.cabin.rampY(C, C.ramp.hinge[2] + mgr.cabin.rampRun(C) * 0.9), C.ramp.hinge[2] + mgr.cabin.rampRun(C) * 0.9]);
check(Math.abs(foot[1] - G) < 0.25, 'its foot touches the ground (' + (foot[1] - G).toFixed(2) + ' m)');
// stand behind the ship and walk up to the ramp
g.player.teleport(foot[0], G, foot[2] + 1.2); g.player.yaw = 0;
run(0.3);
check(!W(), 'a metre behind the ramp you are still outside');
input.keys.add('KeyW');
let tIn = -1; run(2, 1 / 30, (i) => { if (W()) { tIn = i / 30; return false; } });
check(W() && W().s === s, 'walking onto the ramp\'s foot takes you aboard (after ' + tIn.toFixed(2) + ' s)');
let maxY = -9; run(2.5, 1 / 30, () => { if (W()) maxY = Math.max(maxY, W().p[1]); });
check(W() && W().p[2] < C.zEnd - 0.5 && Math.abs(W().p[1] - C.floor) < 0.05, 'walked up the ramp into the cargo bay (z ' + (W() && W().p[2].toFixed(2)) + ', y ' + (W() && W().p[1].toFixed(2)) + ')');

console.log('2 · through the ship to the cockpit');
// keep to the middle, walk forward until the cockpit
// (the aisle runs along the door side; the doorway is in the middle)
const tb = C.items.find(q => q.kind === 'table'), aisle = -Math.sign(tb.x) * 0.45;
let opened = 0; run(9, 1 / 30, () => { if (W()) { const tx = W().p[2] < C.zIn + 1.2 ? 0 : aisle; W().yaw = Math.atan2(-(tx - W().p[0]) * 0.6, 1); } if (s.hatch.cdoor > 0.9) opened = 1; if (W() && W().p[2] < C.zb - 0.6) return false; });
input.keys.delete('KeyW');
check(opened && s.hatch.cdoorOpen, 'the cockpit door slid open as you came near');
check(W() && W().p[2] < C.zb && Math.abs(W().p[1] - ck.floor) < 0.06, 'up the steps into the cockpit (y ' + (W() && W().p[1].toFixed(2)) + ', cockpit deck ' + ck.floor + ')');
// a wall stops you: walk sideways into the console
const x0 = W() ? W().p[0] : 0; input.keys.add('KeyA'); run(2); input.keys.delete('KeyA');
check(W() && W().p[0] > -ck.hw && W().p[0] < x0, 'the cockpit\'s side stops you (x ' + (W() && W().p[0].toFixed(2)) + ')');

console.log('3 · the pilot seat');
input.pressed.add('KeyV'); run(0.1);
check(mgr.pilot === s && !W() && g.gadgets.riding && g.gadgets.riding.type === 'starship', 'V: in the pilot seat');
const fl = s.flight;
fl.setPower(true); fl.startEngines(); run(3.5);
input.keys.add('Space'); run(2); input.keys.delete('Space'); input.pressed.add('KeyX'); run(2);
check(fl.state === 'flying' && fl.alt > 8 && fl.speed < 1, 'took off and hovers (' + fl.alt.toFixed(1) + ' m, ' + fl.speed.toFixed(2) + ' m/s)');
const up = mgr.cabin.standUp(s); run(0.1);
check(up && W() && !mgr.pilot && fl.state === 'flying', 'stood up while it hovers: walking in the cockpit');
const wy0 = g.player.pos[1], ly0 = W().p[1]; fl.holdAlt += 6; run(3);
check(Math.abs(W().p[1] - ly0) < 0.05 && g.player.pos[1] - wy0 > 4, 'the hovering ship carries you (local Δy ' + (W().p[1] - ly0).toFixed(2) + ', world Δy ' + (g.player.pos[1] - wy0).toFixed(1) + ')');
// the gamepad's walk stick (input.padMove, F5's pad.js: analog, not the W key) walks the deck as W does
const pz0 = W().p[2]; W().yaw = Math.PI; input.padMove = { fwd: 1, str: 0 }; run(0.8); input.padMove = { fwd: 0, str: 0 }; run(0.2);
check(W() && W().p[2] - pz0 > 0.8, 'the gamepad\'s walk stick walks the deck (z ' + pz0.toFixed(2) + ' → ' + (W() && W().p[2].toFixed(2)) + ')');
input.pressed.add('KeyV'); run(0.1);
check(mgr.pilot === s, 'and V sits you back down');
input.pressed.add('KeyV'); run(8);
check(fl.state === 'landed', 'V lands it (' + fl.state + ')');

console.log('4 · out of the side door and down the stair');
const up2 = mgr.cabin.standUp(s); run(0.2);
check(up2 && W(), 'out of the seat on the ground');
// teleport the walker into the cabin next to the door, facing it
const D = C.door; W().p = [D.side * (C.wx - 0.6), C.floor, D.z]; W().yaw = D.side < 0 ? Math.PI / 2 : -Math.PI / 2;
mgr.cabin.toggleDoor(s, true); run(2);
check(s.hatch.door === 1, 'the side door is open');
input.keys.add('KeyW'); let out = false; run(5, 1 / 30, () => { if (!W()) { out = true; return false; } });
input.keys.delete('KeyW');
check(out && !g.gadgets.riding, 'walked out of the door and down the stair into the world');
check(Math.abs(g.player.pos[1] - G) < 0.5, 'standing on the ground beside the ship (y ' + (g.player.pos[1] - G).toFixed(2) + ')');

console.log('5 · cost');
mgr.cabin.toggleRamp(s, true); run(3);
const f2 = mgr.cabin.toWorld(s, [0, 0.6, C.ramp.hinge[2] + mgr.cabin.rampRun(C) * 0.9]);
g.player.teleport(f2[0], G, f2[2]); run(0.2);
let t0 = process.hrtime.bigint(); input.keys.add('KeyW'); run(2, 1 / 60); input.keys.delete('KeyW');
const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 120;
check(ms < 1, 'walking costs ' + ms.toFixed(3) + ' ms a frame');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

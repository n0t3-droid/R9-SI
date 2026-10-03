// Flight model without a browser: the real flight.js + starships.js (a real generated shuttle design) over a fake
// flat world. Fast checks of the physics (head look vs. heading, throttle, hover, bank, landing, stuck blocks,
// walls at 10 fps, no NaN). Run: node test/flight_unit.js
const VR = require('./load_shared.js');
globalThis.VR = VR;
global.window = global.window || {};
global.document = global.document || { getElementById: () => null, createElement: () => ({ style: {}, getContext: () => null }) };
global.performance = global.performance || { now: () => Date.now() };
require(__dirname + '/../src/main/flight.js');
require(__dirname + '/../src/main/starships.js');
require(__dirname + '/../src/main/gadgets.js');
const R = VR.R;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };

// ---- a fake world: flat stone up to y = G
const G = 64, STONE = R.byName.stone.defaultState;
class World {
  constructor() { this.cols = new Map(); }
  col(cx, cz) { const k = cx + ',' + cz; let c = this.cols.get(k); if (!c) { c = this.make(cx, cz); this.cols.set(k, c); } return c; }
  make(cx, cz) { const c = { cx, cz, ready: true, H: 256, height: new Uint8Array(256).fill(G - 1), blocks: new Uint16Array(256 * 256), blockEntities: new Map(), sec: [] }; for (let y = 0; y < G; y++) c.blocks.fill(STONE, y << 8, (y << 8) + 256); return c; }
  bulkSet(list) { for (const e of list) this.setBlock(e[0], e[1], e[2], e[3]); }
  nbFn() { return this._nb || (this._nb = (x, y, z, d) => this.getBlock(x + VR.HF_DX[d], y, z + VR.HF_DZ[d])); }
  getBlock(x, y, z) { if (y < 0 || y >= 256) return 0; const c = this.col(x >> 4, z >> 4); return c.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)]; }
  setBlock(x, y, z, s) { const c = this.col(x >> 4, z >> 4), i = ((z & 15) << 4) | (x & 15); c.blocks[(y << 8) | i] = s; if (s && y > c.height[i]) c.height[i] = y; if (!s && y === c.height[i]) { let yy = y - 1; while (yy > 0 && !c.blocks[(yy << 8) | i]) yy--; c.height[i] = yy; } }
  getLight() { return 0xf000; }
}
const world = new World();
const ui = { hint() { }, chatLine() { }, typing: false, vehicleHud() { } };
const particles = { spawn() { }, smoke() { }, spark() { }, explosion() { } };
const g = { world, frame: 0, renderer: { gl: null, uploadShip: () => [], freeShip() { } }, particles, settings: { camShake: true }, ui, audio: { play() { }, loop() { }, turbine() { }, tone() { } }, trails: null, time: 0, meta: {}, player: { pos: [0, G, 0], eye: 1.62, yaw: 0, pitch: 0, teleport(x, y, z) { this.pos = [x, y, z]; }, lookDir() { return [0, 0, -1]; } } };
g.pool = { workers: [{ inflight: 0 }], direct(i, msg, tr, cb) {
  if (msg.type === 'surface') { cb({ res: msg.points.map(() => G - 1) }); return; }
  if (msg.type === 'shipmesh') { cb({ type: 'shipmesh', sections: [] }); return; }
  const r = VR.Starship.build(msg.seed, msg.arch); cb({ type: 'starship', meta: r.meta, occ: r.occ, hull: { count: 0 }, glass: { count: 0 }, gear: { count: 0 } }); } };
VR.C = VR.C || {}; if (VR.C.SEA === undefined) VR.C.SEA = 40;
if (!VR.ckey) VR.ckey = (cx, cz) => cx + ',' + cz;
g.villages = { list: () => [{ id: 1, name: 'Testdorf', x: 700, z: 300, y: G, rad: 30 }, { id: 2, name: 'Weiler', x: -900, z: 50, y: G, rad: 30 }] };
const mgr = new VR.Starships(g, { title: true });
mgr.g.gadgets = { riding: null, freeSpot: (c) => c[0] };

// ---- input
const input = { keys: new Set(), pressed: new Set(), captured: true, sensitivity: 0.0024, invertY: false, dragLook: false, mouse: { dx: 0, dy: 0, down: [false, false, false], clicked: [false, false, false], wheel: 0 },
  down(c) { return this.keys.has(c); }, hit(c) { return this.pressed.has(c); }, clickAction() { return false; } };
const frame = (dt) => { g.time += dt; mgr.drive(dt, input, false); input.pressed.clear(); input.mouse.dx = 0; input.mouse.dy = 0; input.mouse.wheel = 0; input.mouse.clicked = [false, false, false]; };
const run = (sec, dt = 1 / 30, each) => { const n = Math.round(sec / dt); for (let i = 0; i < n; i++) { if (each) each(i); frame(dt); if (!mgr.pilot) break; } };
const hold = (codes, sec, dt) => { for (const c of codes) input.keys.add(c); run(sec, dt); for (const c of codes) input.keys.delete(c); };
const press = (c) => input.pressed.add(c);

// ---- a shuttle on the ground, boarded
const s = mgr.spawn(4242, 'shuttle', null, [0.5, G, 0.5], 0);
mgr.board(s, g.player);
const fl = s.flight;
console.log('shuttle', s.d.meta.name, 'speed', s.d.meta.speed, 'cruise', fl.cruise.toFixed(1), 'gear feet', JSON.stringify(s.d.meta.gear), 'belly', s.d.belly.length, 'cells', s.d.cells.length / 3);
check(fl.state === 'landed', 'boarded on the ground: landed (' + fl.state + ', alt ' + fl.alt + ')');
hold(['Space'], 2.5); run(1);
check(fl.state === 'flying' && s.pos[1] - G > 15, 'Space climbs (' + (s.pos[1] - G).toFixed(1) + ' m)');
// mouse = head
let h0 = s.yaw; run(0.4, 1 / 30, () => { input.mouse.dx += 40; });
check(Math.abs(s.yaw - h0) < 1e-3 && Math.abs(fl.headYaw) > 0.3, 'mouse moves the head (' + fl.headYaw.toFixed(2) + ') not the ship (Δ' + (s.yaw - h0).toExponential(1) + ')');
input.mouse.clicked[1] = true; run(0.5);
check(Math.abs(fl.headYaw) < 0.01, 'middle click re-centres');
h0 = s.yaw; input.mouse.down[2] = true; run(0.4, 1 / 30, () => { input.mouse.dx += 40; }); run(0.7); input.mouse.down[2] = false;
check(s.yaw < h0 - 0.1, 'right mouse held steers right (' + (s.yaw - h0).toFixed(2) + ')');
input.mouse.clicked[1] = true; run(0.4);
// throttle
let v0 = fl.speed; hold(['KeyW'], 2); const v1 = fl.speed;
check(fl.throttle >= 0.9 && v1 > v0 + 5, 'W: throttle ' + fl.throttle.toFixed(2) + ', ' + v0.toFixed(1) + ' → ' + v1.toFixed(1) + ' m/s');
run(1); check(fl.throttle >= 0.9 && fl.speed >= v1 - 0.5, 'throttle stays (' + fl.speed.toFixed(1) + ')');
run(6); check(Math.abs(fl.speed - fl.cruise) < 1, 'settles at cruise ' + fl.speed.toFixed(1));
hold(['ControlLeft'], 1); check(!fl.boost && fl.speed < fl.cruise + 0.6, 'Ctrl: no boost');
hold(['KeyB'], 1.5); check(fl.boost && fl.speed > fl.cruise + 3, 'B: boost ' + fl.speed.toFixed(1) + ' energy ' + fl.energy.toFixed(2));
run(0.5); check(!fl.boost, 'boost ends on release');
// bank
h0 = s.yaw; hold(['KeyD'], 1.2);
check(s.roll < -0.1 && s.yaw < h0 - 0.2, 'D: roll ' + s.roll.toFixed(3) + ', turned ' + (s.yaw - h0).toFixed(2));
run(2); check(Math.abs(s.roll) < 0.02, 'levels within 2 s (' + s.roll.toFixed(4) + ')');
// hover
const y0 = s.pos[1]; press('KeyX'); run(6);
check(fl.speed < 0.5 && Math.abs(s.pos[1] - y0) < 0.3, 'X hover: ' + fl.speed.toFixed(2) + ' m/s, Δy ' + (s.pos[1] - y0).toFixed(2));
// reverse
hold(['KeyS'], 2); run(3);
check(fl.throttle < 0 && fl.vF < -5, 'S below zero: reverse (' + fl.throttle.toFixed(2) + ', ' + fl.vF.toFixed(1) + ' m/s)');
press('KeyX'); run(3);
// stuck block
const c = fl.toWorld([0, 2.6, 0]), bx = Math.floor(c[0]), by = Math.floor(c[1]), bz = Math.floor(c[2]);
world.setBlock(bx, by, bz, STONE);
const in0 = fl.inside(); run(0.5);
check(in0 && !fl.inside(), 'block in the hull (' + in0 + ') → free after 0.5 s');
world.setBlock(bx, by, bz, 0);
// landing with V
let last = s.pos.slice(), jump = 0, td = null, gearLow = 1, prev = fl.state, vyPrev = 0;
press('KeyV');
run(40, 1 / 30, () => {
  const p = s.pos; jump = Math.max(jump, Math.hypot(p[0] - last[0], p[1] - last[1], p[2] - last[2])); last = p.slice();
  if (fl.alt !== null && fl.alt < 3 && fl.state !== 'landed') gearLow = Math.min(gearLow, fl.gear);
  if (fl.state === 'landed' && prev !== 'landed' && !td) td = vyPrev;
  prev = fl.state; vyPrev = s.vel[1];
  if (fl.state === 'landed') input.keys.add('__stop');
});
check(fl.state === 'landed', 'V: landed (alt ' + (fl.alt !== null ? fl.alt.toFixed(3) : '?') + ', y ' + s.pos[1].toFixed(2) + ')');
check(gearLow > 0.9, 'gear down below 3 m (' + gearLow.toFixed(2) + ')');
check(td !== null && Math.abs(td) < 2, 'touchdown ' + (td !== null ? td.toFixed(2) : '?') + ' m/s');
check(jump < 1, 'no teleport (max step ' + jump.toFixed(2) + ' m)');
// take off & the wall at 10 fps
hold(['Space'], 0.8); run(0.5);
const h = s.yaw, fx = -Math.sin(h), fz = -Math.cos(h), rx = Math.cos(h), rz = -Math.sin(h), cx = s.pos[0] + fx * 45, cz = s.pos[2] + fz * 45;
const wallCells = [];
for (let q = -25; q <= 25; q += 0.5) for (let d = 0; d < 4; d += 0.5) for (let y = G; y < G + 30; y++) { const c3 = [Math.floor(cx + rx * q + fx * d), y, Math.floor(cz + rz * q + fz * d)]; world.setBlock(c3[0], c3[1], c3[2], STONE); wallCells.push(c3); }
let passed = false, nan = false;
input.keys.add('KeyW'); input.keys.add('KeyB');
run(4, 0.1, () => { const d = (s.pos[0] - cx) * fx + (s.pos[2] - cz) * fz; if (d > 0.5) passed = true; if (!s.pos.concat(s.vel).every(isFinite)) nan = true; });
input.keys.delete('KeyW'); input.keys.delete('KeyB');
check(!passed && !nan && !fl.inside(), 'boost into a wall at 10 fps: stopped in front (' + ((s.pos[0] - cx) * fx + (s.pos[2] - cz) * fz).toFixed(1) + ' m), no NaN, not inside');
for (const c3 of wallCells) world.setBlock(c3[0], c3[1], c3[2], 0);
// exit
press('KeyX'); run(2); press('KeyV'); run(20, 1 / 30, () => { if (fl.state === 'landed') input.keys.add('__x'); });
const at = s.pos.slice(); press('KeyV'); run(0.1);
check(!mgr.pilot && s.state === 'parked' && Math.hypot(s.pos[0] - at[0], s.pos[1] - at[1], s.pos[2] - at[2]) < 0.01, 'V when landed: out, the ship stays put');
// autopilot: G → the nearest village, flown through the same flight model, landed on the gear next to it
mgr.board(s, g.player);
press('KeyG'); run(0.1);
check(fl.auto && fl.auto.site.name === 'Testdorf', 'G: autopilot to the nearest village (' + (fl.auto && fl.auto.site.name) + ')');
let apMax = 0, apJump = 0, apLast = s.pos.slice();
run(150, 1 / 30, () => { apMax = Math.max(apMax, fl.speed); const q = s.pos; apJump = Math.max(apJump, Math.hypot(q[0] - apLast[0], q[1] - apLast[1], q[2] - apLast[2])); apLast = q.slice(); if (!fl.auto && fl.state === 'landed') input.keys.add('__done'); });
const dSite = Math.hypot(s.pos[0] - 700, s.pos[2] - 300);
check(!fl.auto && fl.state === 'landed' && dSite < 120 && dSite > 20, 'the autopilot flew there and landed beside the village (' + dSite.toFixed(0) + ' m from its centre, top speed ' + apMax.toFixed(0) + ' m/s, max step ' + apJump.toFixed(2) + ' m)');
press('KeyV'); run(0.1);
// ---- the block-built ship: a ShipGen shuttle in the world, take its helm, fly, land, back onto the block grid
{
  const gad = new VR.Gadgets(g); g.gadgets = gad; mgr.g.gadgets = gad;
  const bp = VR.ShipGen.design(777, 'shuttle'), B0 = [-300, G, -300];
  VR.ShipGen.place(bp, (x, y, z, st) => world.setBlock(x, y, z, st), B0[0], B0[1], B0[2], 0);
  let hp = null; const hid = R.byName.helm.id;
  for (let y = G; y < G + 14 && !hp; y++) for (let z = B0[2] - 12; z <= B0[2] + 12 && !hp; z++) for (let x = B0[0] - 10; x <= B0[0] + 10; x++) { const st = world.getBlock(x, y, z); if (st && R.T.type[st] === hid) { hp = [x, y, z]; break; } }
  check(!!hp, 'block shuttle built, helm at ' + hp);
  g.player.pos = [hp[0] + 0.5, hp[1], hp[2] + 1.5];
  gad.takeHelm(hp[0], hp[1], hp[2]);
  const S = gad.ship, bf = S && S.flight;
  check(S && S.state === 'flying' && bf && g.flight === bf && bf.state === 'landed', 'helm taken: a flight standing on the ground (' + (S && S.state) + ', ' + (bf && bf.state) + ', alt ' + (bf && bf.alt) + ')');
  const bframe = (dt) => { g.time += dt; gad.drive(dt, input, false); input.pressed.clear(); input.mouse.dx = 0; input.mouse.dy = 0; input.mouse.wheel = 0; input.mouse.clicked = [false, false, false]; };
  const brun = (sec, dt = 1 / 30, each) => { const n = Math.round(sec / dt); for (let i = 0; i < n; i++) { if (each) each(i); bframe(dt); if (!gad.riding) break; } };
  const bhold = (codes, sec) => { for (const c of codes) input.keys.add(c); brun(sec); for (const c of codes) input.keys.delete(c); };
  const y0b = S.pos[1]; bhold(['Space'], 2); brun(0.5);
  check(bf.state === 'flying' && S.pos[1] - y0b > 10, 'block ship climbs (' + (S.pos[1] - y0b).toFixed(1) + ' m)');
  let hb = bf.heading; brun(0.4, 1 / 30, () => { input.mouse.dx += 40; });
  check(Math.abs(bf.heading - hb) < 1e-3, 'block ship: the mouse only looks');
  input.mouse.clicked[1] = true; brun(0.4);
  hb = bf.heading; bhold(['KeyW', 'KeyD'], 1.4);
  check(bf.throttle >= 0.9 && S.roll < -0.05 && bf.heading < hb - 0.2, 'block ship: W + D (throttle ' + bf.throttle.toFixed(2) + ', roll ' + S.roll.toFixed(2) + ', turned ' + (bf.heading - hb).toFixed(2) + ')');
  press('KeyX'); brun(4); press('KeyV');
  let bj = 0, bl = S.pos.slice(), btd = null, bprev = bf.state, bvy = 0;
  brun(30, 1 / 30, () => { const q = S.pos; bj = Math.max(bj, Math.hypot(q[0] - bl[0], q[1] - bl[1], q[2] - bl[2])); bl = q.slice(); if (bf.state === 'landed' && bprev !== 'landed' && btd === null) btd = bvy; bprev = bf.state; bvy = S.vel[1]; if (bf.state === 'landed') input.keys.add('__b'); });
  check(bf.state === 'landed' && btd !== null && Math.abs(btd) < 2 && bj < 1, 'block ship: V lands it (touchdown ' + (btd !== null ? btd.toFixed(2) : '?') + ' m/s, max step ' + bj.toFixed(2) + ')');
  const before = S.pos.slice(); press('KeyV'); brun(0.1);
  check(!gad.riding && !g.flight && S.state === 'landing', 'block ship: V again — blocks back on the grid, you get out (' + S.state + ', moved ' + Math.hypot(S.pos[0] - before[0], S.pos[1] - before[1], S.pos[2] - before[2]).toFixed(2) + ' m to snap)');
  let n = 0; for (let i = 0; i < S.all.length; i += 4) n++;
  let placed = 0; for (let y = G - 2; y < G + 16; y++) for (let z = Math.floor(S.pos[2]) - 14; z <= S.pos[2] + 14; z++) for (let x = Math.floor(S.pos[0]) - 14; x <= S.pos[0] + 14; x++) if (world.getBlock(x, y, z) && y >= G) placed++;
  check(placed >= n, 'all ' + n + ' blocks are back in the world (' + placed + ' found above the ground)');
  mgr.g.gadgets = { riding: null, freeSpot: (c) => c[0] }; g.gadgets = mgr.g.gadgets;
}
// timing: cruising high (no collision tests) and low over the ground (sub-stepped collision tests)
s.yaw += Math.PI; mgr.rotOf(s);
mgr.board(s, g.player); hold(['Space'], 2); input.keys.add('KeyW'); run(5);
let t0 = process.hrtime.bigint(); run(5, 1 / 60); let ms = Number(process.hrtime.bigint() - t0) / 1e6 / 300;
console.log('  sim cost high ' + ms.toFixed(3) + ' ms/frame at ' + fl.speed.toFixed(0) + ' m/s, sky clear ' + fl.skyClear);
input.keys.add('ShiftLeft'); run(3); input.keys.delete('ShiftLeft');
t0 = process.hrtime.bigint(); run(5, 1 / 60); ms = Number(process.hrtime.bigint() - t0) / 1e6 / 300;
console.log('  sim cost low ' + ms.toFixed(3) + ' ms/frame at ' + fl.speed.toFixed(0) + ' m/s, alt ' + fl.alt.toFixed(1) + ', sky clear ' + fl.skyClear);
check(ms < 2, 'flight costs < 2 ms a frame');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

// u-ascent · ground → sky → orbit → back without a browser (docs/superpowers/plans/2026-10-22-u-ascent.md §4): the real
// flight.js + starships.js (a generated shuttle) over a flat fake world, with VR.Ascent (the climb band, the one state),
// VR.SpaceFlight (the autopilot's space modes, the Reisesprung) and VR.Entry (the way down, local time).
//   (a) the bands and the air · (b) the regimes through flight.js · (c) the hand-off's continuity · (d) the orbit at 3 km
//   and the coasting energy · (e) Zum Orbit from 252 m · (j) the LVLH hold · (f) the entry from 3 km to the ground · (g) the
//   postcard's glide · (h) local time · (i) the Reisesprung's path · (k) wiring · the cost
// Run: node test/ascent.js   (bash test/wt_run.sh ascent.js 300 in a worktree)
const fs = require('fs');
const VR = require('./load_shared.js');
globalThis.VR = VR;
global.window = global.window || {};
global.document = global.document || { getElementById: () => null, createElement: () => ({ style: {}, getContext: () => null }) };
global.performance = global.performance || { now: () => Date.now() };
VR.SHADERS = VR.SHADERS || {};
const ROOT = __dirname + '/../';
for (const f of ['voxmodels', 'flight', 'cockpit', 'starships', 'gadgets', 'skybodies', 'ascent', 'spaceflight', 'entry']) require(ROOT + 'src/main/' + f + '.js');
const R = VR.R, A = VR.Ascent, SF = VR.SpaceFlight, EN = VR.Entry, U = VR.Universe, S = U.home, HZ = S.body('herz');
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
const len = (a) => Math.hypot(a[0], a[1], a[2]), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const ang = (a, b) => Math.atan2(len(cross(a, b)), dot(a, b));
const D2R = Math.PI / 180, g0 = 9.81;
const f1 = (x) => Number(x).toFixed(1), f0 = (x) => Number(x).toFixed(0);

// ---- a fake world: flat stone up to y = G (as test/flight_unit.js)
const G = 64, STONE = R.byName.stone.defaultState;
class World {
  constructor() { this.cols = new Map(); }
  col(cx, cz) { const k = cx + ',' + cz; let c = this.cols.get(k); if (!c) { c = this.make(cx, cz); this.cols.set(k, c); } return c; }
  make(cx, cz) { const c = { cx, cz, ready: true, H: 256, height: new Uint8Array(256).fill(G - 1), blocks: new Uint16Array(256 * 256), blockEntities: new Map(), sec: [] }; for (let y = 0; y < G; y++) c.blocks.fill(STONE, y << 8, (y << 8) + 256); return c; }
  nbFn() { return this._nb || (this._nb = (x, y, z, d) => this.getBlock(x + VR.HF_DX[d], y, z + VR.HF_DZ[d])); }
  getBlock(x, y, z) { if (y < 0 || y >= 256) return 0; const c = this.col(x >> 4, z >> 4); return c.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)]; }
  setBlock() { }
  getLight() { return 0xf000; }
}
const world = new World();
const hints = [], chats = [];
const ui = { hint(t) { hints.push(t); }, chatLine(t) { chats.push(t); }, typing: false, vehicleHud() { } };
const particles = { spawn() { }, smoke() { }, spark() { }, explosion() { } };
const g = { world, frame: 0, renderer: { gl: null, uploadShip: () => [], freeShip() { } }, particles, settings: { camShake: true }, ui, audio: { play() { }, loop() { }, turbine() { }, tone() { } }, trails: null, time: 0, meta: {}, player: { pos: [0, G, 0], eye: 1.62, yaw: 0, pitch: 0, teleport(x, y, z) { this.pos = [x, y, z]; }, lookDir() { return [0, 0, -1]; } } };
g.pool = { workers: [{ inflight: 0 }], direct(i, msg, tr, cb) {
  if (msg.type === 'surface') { cb({ res: msg.points.map(() => G - 1) }); return; }
  if (msg.type === 'shipmesh') { cb({ type: 'shipmesh', sections: [] }); return; }
  const r = VR.Starship.build(msg.seed, msg.arch); cb({ type: 'starship', meta: r.meta, occ: r.occ, hull: { count: 0 }, glass: { count: 0 }, gear: { count: 0 } }); } };
VR.C = VR.C || {}; if (VR.C.SEA === undefined) VR.C.SEA = 40;
if (!VR.ckey) VR.ckey = (cx, cz) => cx + ',' + cz;
g.villages = { list: () => [] };
const mgr = new VR.Starships(g, { title: true });
mgr.g.gadgets = { riding: null, freeSpot: (c) => c[0] };
const input = { keys: new Set(), pressed: new Set(), captured: true, sensitivity: 0.0024, invertY: false, dragLook: false, mouse: { dx: 0, dy: 0, down: [false, false, false], clicked: [false, false, false], wheel: 0 },
  down(c) { return this.keys.has(c); }, hit(c) { return this.pressed.has(c); }, clickAction() { return false; } };
const frame = (dt) => { g.time += dt; mgr.drive(dt, input, false); input.pressed.clear(); input.mouse.dx = 0; input.mouse.dy = 0; input.mouse.wheel = 0; input.mouse.clicked = [false, false, false]; };
const run = (sec, dt, each) => { dt = dt || 1 / 60; const n = Math.round(sec / dt); for (let i = 0; i < n; i++) { if (each && each(i) === false) break; frame(dt); } };

// ================================================================ (a) the bands and the air
console.log('(a) the bands and the air');
check(A.rho(100) === 1.225 && A.rho(300) === 1.225 && Math.abs(A.rho(700) / 1.225 - Math.exp(-1)) < 1e-12, 'ρ: 1.225 kg/m³ to 300 m, then a 400-m scale height', 'ρ(700) ' + A.rho(700).toFixed(4));
let mono = true; for (let y = 300; y < 3000; y += 5) if (A.rho(y + 5) > A.rho(y)) mono = false;
check(mono && A.rho(2999) < 2e-5 && A.rho(3000) === 0 && A.rho(3063) === 0 && A.rho(2750) < 1.225 * Math.exp(-2450 / 400) * 0.6, 'the air thins all the way and ends at 3,000 m: the orbit at 3 km is drag-free', 'ρ(2500) ' + A.rho(2500).toExponential(2));
check(A.airK(250) === 1 && Math.abs(A.airK(1200) - Math.exp(-900 / 400)) < 1e-12 && A.airK(2500) < 0.005, 'the sky\'s air: 1 to 300 m, e^−(y−300)/400', 'airK(600) ' + A.airK(600).toFixed(2) + ', airK(1200) ' + A.airK(1200).toFixed(3) + ', airK(2500) ' + A.airK(2500).toFixed(4));
check(A.curve(100) === 0 && A.curve(300) === 0 && Math.abs(A.curve(2500) - 0.5 / HZ.R) < 1e-15 && A.curve(1400) > 0 && A.curve(1400) < A.curve(2500), 'the world\'s bend u_curve = climbK(y)/2R: 0 to 300 m (the ground frame unchanged), 1/2R at 2,500 m', 'drop at 5 km from 2,500 m: ' + f1(A.curve(2500) * 25e6) + ' m');
check(A.BAND.air === 252 && A.BAND.edge === 2500 && A.BAND.back === 2450, 'the bands: the climb from 252 m, space from 2,500 m, back below 2,450 m');

// ================================================================ (b) the regimes through flight.js (a shuttle, flown)
console.log('(b) the regimes');
const s = mgr.spawn(4242, 'shuttle', null, [0.5, G, 0.5], 0);
mgr.board(s, g.player);
const fl = s.flight, H = s.d.meta.height;
console.log('  shuttle ' + s.d.meta.name + ', height ' + H + ' m');
check(A.mayClimb(fl) === null && A.mayClimb({ b: { kind: 'ship' }, g }) === 'g.asc.noHelm', 'a starship may climb; a block ship keeps the cap (noHelm)');
input.keys.add('Space'); run(5);
check(fl.running && fl.state === 'flying', 'Space: the engines start and the shuttle lifts off');
// up at 14 m/s to the cap: the cap is the door into the climb
let L = null, trace = [];
for (let i = 0; i < 60 * 30 && !L; i++) {
  const r0 = fl.regime || 'air', p0 = s.pos.slice(), v0 = s.vel.slice();
  frame(1 / 60);
  trace.push({ r: fl.regime || 'air', p: s.pos.slice(), v: s.vel.slice() });
  if (trace.length > 8) trace.shift();
  if (r0 === 'air' && fl.regime === 'climb') L = { p0, v0, i };
}
check(!!L, 'a starship climbing past 252 m (its top) enters the climb', L ? 'at y ' + f1(L.p0[1]) + ' + ' + H : 'still ' + (fl.regime || 'air') + ' at ' + f1(s.pos[1]));
if (L) {
  check(L.p0[1] + H > 251 && L.p0[1] + H < 253.5 && L.v0[1] > 5, 'at the cap, going up', 'top ' + f1(L.p0[1] + H) + ', vy ' + f1(L.v0[1]));
  for (let i = 0; i < 4; i++) { frame(1 / 60); trace.push({ r: fl.regime || 'air', p: s.pos.slice(), v: s.vel.slice() }); }
}
// (c) the continuity across the door: no position step beyond v·dt, the map velocity within g·dt in the climb's frames
let maxP = 0, maxV = 0;
for (let i = 1; i < trace.length; i++) {
  const a = trace[i - 1], b = trace[i], step = len(sub(b.p, a.p)) - Math.max(len(a.v), len(b.v)) / 60;
  maxP = Math.max(maxP, step); if (b.r === 'climb') maxV = Math.max(maxV, len(sub(b.v, a.v)));
}
check(maxP < 1e-3, '(c) air → climb: no position step beyond v·dt', 'worst excess ' + maxP.toExponential(1) + ' m');
check(maxV <= g0 / 60, '(c) air → climb: the first climb frames\' map velocity within g·dt of the air regime\'s', 'max Δv ' + maxV.toFixed(3) + ' m/s a frame');
// the climb: the nose up, the lever open: thrust along the nose, the land falls away
input.keys.delete('Space');
const tC = fl.ascT;
input.keys.add('Space'); run(1.6); input.keys.delete('Space');
check(fl.pitch > 70 * D2R, 'Space in the climb pitches the nose up (real pitch, not the 14 m/s climb)', 'pitch ' + f0(fl.pitch / D2R) + '°');
input.keys.add('KeyW'); run(1.5); input.keys.delete('KeyW');
check(fl.throttle > 0.9, 'W opens the lever (0–3 g along the nose)', 'throttle ' + fl.throttle.toFixed(2));
run(5);
const vTop = A.ascOf(fl).info.speed;
check(fl.regime === 'climb' && s.pos[1] > 500 && vTop > 80, 'full thrust nose up: the land falls away', 'y ' + f0(s.pos[1]) + ' after ' + f1(fl.ascT - tC) + ' s, ' + f0(vTop) + ' m/s');
// cut the lever: the jets throttle back (gravity and the air brake the climb), then they hold the ship where it is
input.pressed.add('KeyX'); run(30);
const vHold = len(s.vel), yHold = s.pos[1]; run(3);
check(fl.regime === 'climb' && vHold < 3 && Math.abs(s.pos[1] - yHold) < 6, 'X cuts the lever: the ship coasts up, slows and stays in the sky (a pilot can stop anywhere and look)', 'speed ' + f1(vHold) + ' m/s, moved ' + f1(Math.abs(s.pos[1] - yHold)) + ' m in 3 s at ' + f0(s.pos[1]) + ' m');
// climb → space at 2,500 m, back below 2,450 m (the lever a touch open: no hover hold; the nose level)
const a = A.ascOf(fl);
A.enterClimb(fl, [s.pos[0], 2480, s.pos[2]], [0, 40, 0]);
fl.throttle = 0.05; fl.pitch = 0;
let ySpace = null;
const mp = [0, 0, 0], mv = [0, 0, 0], stTrace = [];
const sample = () => { A.toMap(a.st, mp, mv); stTrace.push({ r: fl.regime, p: mp.slice(), v: mv.slice() }); if (stTrace.length > 6) stTrace.shift(); };
let edge1 = null;
for (let i = 0; i < 120 && fl.regime === 'climb'; i++) { frame(1 / 60); sample(); if (fl.regime === 'space') { edge1 = stTrace.slice(); ySpace = mp[1]; } }
check(fl.regime === 'space' && ySpace !== null && ySpace >= 2500 && ySpace < 2502, 'at 2,500 m the space regime takes over', ySpace !== null ? 'at ' + f1(ySpace) + ' m' : fl.regime + ' at ' + f1(mp[1]));
run(0.5);
A.toMap(a.st, mp, mv);
const bFrozen = s.pos.slice();
check(fl.regime === 'space' && mp[1] > 2505 && len(sub(s.pos, bFrozen)) === 0, 'in space the ship waits on its map spot (the space frame draws it there)', 'state at ' + f1(mp[1]) + ' m');
A.fromMap(a.st, mp.slice(), [0, -40, 0], a.st.t);
let yBack = null, sawBand = false, edge2 = null;
for (let i = 0; i < 400 && fl.regime === 'space'; i++) { frame(1 / 60); sample(); const y = stTrace[stTrace.length - 1].p[1]; if (fl.regime === 'space' && y < 2495 && y > 2452) sawBand = true; if (fl.regime === 'climb') { yBack = y; edge2 = stTrace.slice(); } }
check(sawBand && yBack !== null && yBack <= 2450 && yBack > 2448, 'back down: still space between 2,500 and 2,450 m (the hysteresis), the climb below 2,450', yBack !== null ? 'at ' + f1(yBack) : 'not back');
check(edge2 && len(sub(s.pos, stTrace[stTrace.length - 1].p)) < 1e-6, 'space → climb: the ship is put on the map where the state is', edge2 ? f1(s.pos[1]) : '-');
// (c) the inertial state across both edges: no step beyond v·dt
let maxE = 0;
for (const E of [edge1, edge2]) if (E) for (let i = 1; i < E.length; i++) maxE = Math.max(maxE, len(sub(E[i].p, E[i - 1].p)) - Math.max(len(E[i].v), len(E[i - 1].v)) / 60);
check(edge1 && edge2 && maxE < 1e-3, '(c) climb ↔ space: the map place moves by v·dt at both edges', 'worst excess ' + maxE.toExponential(1) + ' m');
// the cap stays for guests, hosts with guests, other worlds
const backToAir = (y) => { fl.regime = 'air'; fl.auto = null; s.pos[1] = y; s.vel[0] = s.vel[1] = s.vel[2] = 0; fl.holdAlt = y; fl.pitch = 0; fl.roll = 0; fl.throttle = 0; fl.state = 'flying'; };
const capped = (why, set, unset) => {
  backToAir(225); set(); hints.length = 0; if (fl.asc) fl.asc.warned = -99;
  input.keys.add('Space'); run(4); input.keys.delete('Space');
  // (the air regime brakes its 14 m/s climb at 16 m/s² once the top passes 252 m: 6 m over, as it always did)
  const ok = (fl.regime || 'air') === 'air' && s.pos[1] + H <= 252 + 14 * 14 / 32 + 0.2 && hints.includes(why);
  unset(); return ok;
};
check(capped('g.asc.guest', () => { g.meta.guest = true; }, () => { g.meta.guest = false; }), 'a guest keeps the cap at 252 m (one hint)');
check(capped('g.asc.guests', () => { g.mp = { isHost: true, remote: new Map([[7, {}]]) }; }, () => { g.mp = null; }), 'a host with guests keeps the cap (the sky stays theirs)');
check(capped('g.asc.notHere', () => { g.dim = 'underforge'; }, () => { g.dim = undefined; }), 'other worlds keep the cap');

// ================================================================ (c) map ↔ inertial
console.log('(c) map ↔ inertial');
let rt = 0;
const st0 = A.newState(), pB = [0, 0, 0], vB = [0, 0, 0];
for (const [p, v, t] of [[[0, 252, 0], [12, 14, -3], 0], [[15000, 1200, -8000], [-200, 30, 400], 777.7], [[100000, 2500, 30000], [900, -5, 120], 12345.6], [[-250000, 3063, 120000], [0, 0, 0], 1e5]]) {
  A.fromMap(st0, p, v, t); A.toMap(st0, pB, vB);
  rt = Math.max(rt, len(sub(p, pB)), len(sub(v, vB)));
}
check(rt < 1e-6, 'map → inertial → map: the place and the map velocity come back', 'worst ' + rt.toExponential(1));
A.fromMap(st0, [0, 252, 0], [0, 0, 0], 0);
const vg = len(st0.v);
check(Math.abs(vg - S.surfaceSpeed('herz', 0, 0) * (HZ.R + 252 - 63) / HZ.R) < 1e-6 && vg > 200 && vg < 225, 'a ship resting over the Heartland moves with the ground (U§3: 213 m/s east)', f1(vg) + ' m/s');

// ================================================================ (d) the orbit at 3 km, the coasting energy
console.log('(d) the orbit at 3 km');
const so = A.newState();
A.circularAt(so, [0, 3063, 0], 500);
const ob = A.orbitOf(so), nrm = unit(cross(so.r, so.v));
const en = (st) => 0.5 * dot(st.v, st.v) - HZ.mu / len(st.r);
let tt = 0, turned = 0, Tret = null, pr = Float64Array.from(so.r);
const E0 = en(so);
while (tt < 760 && Tret === null) {
  A.step(so, 0.25, null, null); tt += 0.25;
  const da = Math.atan2(dot(cross(pr, so.r), nrm), dot(pr, so.r));
  if (turned + da >= 2 * Math.PI) Tret = tt - 0.25 + 0.25 * (2 * Math.PI - turned) / da;
  turned += da; pr = Float64Array.from(so.r);
}
check(Tret !== null && Math.abs(Tret / 60 - 11.0) <= 0.2 && Math.abs(Tret - ob.period) < 0.01, 'the orbit at 3 km takes 11.0 ± 0.2 min (by its return)', Tret ? (Tret / 60).toFixed(3) + ' min, v ' + f1(len(so.v)) + ' m/s' : '-');
for (let i = 0; i < 10 * 662 * 4; i++) A.step(so, 0.25, null, null);
check(Math.abs(en(so) / E0 - 1) < 1e-9 && so.coast, 'coasting: the energy stays over 10 orbits (analytic)', 'drift ' + Math.abs(en(so) / E0 - 1).toExponential(1));
// a burn: the energy changes by the work done, then stays
const sb = A.newState(); A.circularAt(sb, [0, 3063, 0], 900);
let W = 0; const Eb0 = en(sb), thr = new Float64Array(3);
for (let i = 0; i < 600; i++) { const d = unit(sb.v); thr[0] = d[0] * g0; thr[1] = d[1] * g0; thr[2] = d[2] * g0; const v0 = Float64Array.from(sb.v); A.step(sb, 1 / 120, thr, null); W += g0 * (len(v0) + len(sb.v)) / 2 / 120; }
const Eb1 = en(sb);
check(Math.abs((Eb1 - Eb0) / W - 1) < 1e-4, 'a 1-g burn of 5 s: the energy grows by the work done (velocity Verlet at 1/120 s)', 'ΔE/W ' + ((Eb1 - Eb0) / W).toFixed(6));
for (let i = 0; i < 4 * 900; i++) A.step(sb, 0.25, null, null);
check(Math.abs(en(sb) / Eb1 - 1) < 1e-9, '… and stays after the burn ends (Verlet → Kepler without a kick)', 'drift ' + Math.abs(en(sb) / Eb1 - 1).toExponential(1));

// ================================================================ (e) Zum Orbit from 252 m
console.log('(e) Zum Orbit');
backToAir(238); s.yaw = 1.0; fl.asc = null;
SF.start(fl, 'orbit');
let dv = 0, gMax = 0, tSpace = null, tEnd = null, maxQ = 0, yEdge = null;
const t0 = fl.t;
let phases = [];
for (let i = 0; i < 60 * 240; i++) {
  frame(1 / 60);
  const I = fl.asc && fl.asc.info;
  if (fl.regime && fl.regime !== 'air' && I) { dv += Math.abs(I.thrust || 0) * g0 / 60; gMax = Math.max(gMax, I.g || 0); maxQ = Math.max(maxQ, I.q || 0); }
  if (fl.regime === 'space' && tSpace === null) { tSpace = fl.t - t0; yEdge = A.mapY(fl.asc.st); }
  const ph = fl.auto ? fl.auto.space + ':' + (fl.auto.phase || '') : 'off';
  if (phases[phases.length - 1] !== ph) phases.push(ph);
  if (!fl.auto) { tEnd = fl.t - t0; break; }
}
const oE = A.orbitOf(fl.asc.st);
console.log('  phases ' + phases.join(' → '));
check(tSpace !== null && tSpace < 70, 'the gravity turn reaches space (2,500 m)', tSpace !== null ? f1(tSpace) + ' s' : '-');
check(tEnd !== null && fl.regime === 'space', 'Zum Orbit, then the Kreisbahn polish: the autopilot hands back in orbit', tEnd !== null ? f1(tEnd) + ' s' : 'still ' + phases[phases.length - 1]);
check(Math.abs(oE.apo - 3063) < 100 && Math.abs(oE.peri - 3063) < 100 && oE.e < 0.01, 'a circular orbit at 3 km (e < 0.01)', 'Ap ' + f0(oE.apo - 63) + ' m, Pe ' + f0(oE.peri - 63) + ' m, e ' + oE.e.toFixed(4) + ', ' + (oE.period / 60).toFixed(2) + ' min');
check(dv > 1100 * 0.85 && dv < 1100 * 1.15, 'Δv ≈ 1,100 m/s ± 15 % (the ground\'s 213 m/s for free)', f0(dv) + ' m/s');
check(gMax <= 3.5, 'the peak load ≤ 3.5 g', gMax.toFixed(2) + ' g');
check(chats.some(c => c === 'g.asc.inOrbit') && chats.some(c => c === 'g.asc.circDone'), 'the radio: in orbit, the circle done');

// ================================================================ (j) the LVLH hold over one orbit
console.log('(j) the LVLH hold');
const nose = () => [-fl.asc.S[2], -fl.asc.S[5], -fl.asc.S[8]];
const horiz = () => { const st = fl.asc.st, up = unit(st.r), n = nose(), h = unit(sub(st.v, up.map(x => x * dot(st.v, up)))); return [Math.asin(dot(n, up)), Math.atan2(dot(cross(h, n), up), dot(h, n))]; };
const h0 = horiz(); let hDev = 0;
const Ej0 = en(fl.asc.st);
run(oE.period, 1 / 30, () => { const h = horiz(); hDev = Math.max(hDev, Math.abs(h[0] - h0[0]), Math.abs(h[1] - h0[1])); });
check(hDev < 1e-6, 'coasting with no hands: the nose keeps its angle to the horizon and the way (parallel transport)', 'worst ' + hDev.toExponential(1) + ' rad');
check(Math.abs(en(fl.asc.st) / Ej0 - 1) < 1e-9, 'the free orbit through the flight: the energy stays', 'drift ' + Math.abs(en(fl.asc.st) / Ej0 - 1).toExponential(1));

// ================================================================ (i) the Reisesprung and the home jump (pure paths)
console.log('(i) the Reisesprung');
const tJ = fl.asc.st.t, sysP = (st) => { const p = S.pos(st.frame, st.t); return [p[0] + st.r[0], p[1] + st.r[1], p[2] + st.r[2]]; };
let jOk = true, jInfo = [];
for (const to of SF.JUMP_TO) {
  const J = SF.jumpPlan({ r: sysP(fl.asc.st) }, to, tJ), B = S.body(to), RA = S.body('amarant').R, e = J.end;
  const rr = len(e.r), vv = len(e.v), k = SF.arrivalK(to);
  const okP = len(sub(SF.jumpAt(J, 0), J.P0)) < 1e-6 && len(sub(SF.jumpAt(J, J.dur), J.P1)) < 1e-6 && J.dur === 6;
  const okC = Math.abs(rr / (k * B.R) - 1) < 1e-9 && k >= 1.3 && rr < 0.85 * B.soi && Math.abs(vv / Math.sqrt(B.mu / rr) - 1) < 1e-9 && Math.abs(dot(e.r, e.v)) / (rr * vv) < 1e-9 && e.frame === to;
  const okA = to === 'amarant' || J.minAmarant > 1.5 * RA;
  if (!(okP && okC && okA)) jOk = false;
  jInfo.push(to + ' ' + k.toFixed(2) + 'R' + (to === 'amarant' ? '' : ' (Amarant ' + (J.minAmarant / RA).toFixed(1) + 'R)'));
}
check(jOk, 'to every body of U§2.1: 6 s, from the ship to a circular orbit (2 R, Amarant 1.5 R, a small moon well inside its sphere of influence), Amarant cleared by > 1.5 of its radii', jInfo.join(', '));
const apron = [VR.Heart ? VR.Heart.TEMPLE.x : 0, 2400, VR.Heart ? VR.Heart.TEMPLE.front + 10 : 40];
const JH = SF.jumpPlan({ r: sysP(fl.asc.st) }, 'herz', tJ, { home: true, at: apron });
const hp = [0, 0, 0], hv = [0, 0, 0]; S.inertialToChart('herz', JH.end.r, JH.end.v, JH.end.t, hp, hv);
check(JH.end.frame === 'herz' && len(sub(hp, apron)) < 1e-6 && len(hv) < 1e-6 && JH.end.t === tJ + 6, 'Heimkehr: the home jump ends at rest 2,400 m over the Gate Temple\'s apron', hp.map(f0).join(', '));
// a jump flown by the ship: away to Opal and back home
SF.jumpStart(fl, 'opal');
let jumpBad = false; run(6.5, 1 / 60, () => { if (!isFinite(fl.asc.st.r[0])) jumpBad = true; });
const so2 = fl.asc.st;
check(!jumpBad && so2.frame === 'opal' && fl.regime === 'space' && Math.abs(len(so2.r) / (SF.arrivalK('opal') * S.body('opal').R) - 1) < 1e-3 && !fl.asc.jump, 'the ship flies the jump: in orbit round Opal after 6 s', so2.frame + ' at ' + f0(len(so2.r) - S.body('opal').R) + ' m');
check(SF.landable('opal') === !!(VR.DimReg && VR.DimReg.has && VR.DimReg.has('opal')) && SF.landable('herz') === false, 'landing only where a dim exists (Opal and Basalt come with u-moons1)');
const muO = S.body('opal').mu, enO = (st) => 0.5 * dot(st.v, st.v) - muO / len(st.r), eO0 = enO(so2);
run(30, 1 / 30);
check(fl.asc.st.frame === 'opal' && Math.abs(enO(fl.asc.st) / eO0 - 1) < 1e-9, 'there the ship coasts round Opal (its own frame, its own μ)', 'drift ' + Math.abs(enO(fl.asc.st) / eO0 - 1).toExponential(1));

// ================================================================ (f) the entry from 3 km to the ground
console.log('(f) the entry');
// back in orbit round Herzwelt, over the Heartland
A.orbitAt(fl, [0, 3063, 0], fl.asc.st.t);
SF.land(fl);
let fq = 0, fyq = 0, fg = 0, glowTop = null, glowBot = null, glowT0 = 0, glowT1 = 0, preds = [], descStart = null, at1500 = null, landed = null, tE = 0, rhoTop = 0;
let lastPredT = -99, phaseLog = [];
const tF0 = fl.t;
for (let i = 0; i < 60 * 600; i++) {
  frame(1 / 60);
  const st = fl.asc.st, I = fl.asc.info, y = fl.regime === 'air' ? s.pos[1] : A.mapY(st);
  const ph = fl.auto ? fl.auto.phase : null;
  if (phaseLog[phaseLog.length - 1] !== ph) phaseLog.push(ph);
  if (fl.regime !== 'air') {
    if (I.q > fq) { fq = I.q; fyq = y; }
    fg = Math.max(fg, I.g);
    const gl = A.glowOf(I.q);
    if (gl > 0.05) { if (glowTop === null) { glowTop = y; glowT0 = fl.t; } glowBot = y; glowT1 = fl.t; }
    if (ph === 'entry' && fl.t - lastPredT > 3 && y > 1600) { lastPredT = fl.t; const P = EN.predict(st, 'entry'); if (P) preds.push({ y, x: P.x, z: P.z }); }
    if (ph === 'descend' && !descStart) { const p = [0, 0, 0]; A.toMap(st, p, null); descStart = { x: p[0], z: p[2], y: p[1], t: fl.t - tF0 }; }
    if (at1500 === null && y < 1500) at1500 = { v: I.speed, y };
  }
  if (fl.state === 'landed') { landed = { t: fl.t - tF0, x: s.pos[0], z: s.pos[2] }; break; }
}
console.log('  phases ' + phaseLog.join(' → ') + ', ' + preds.length + ' predictions');
check(fyq > 1700 && fyq < 2300, 'the heating ρv³ peaks between 1,700 and 2,300 m (by ρ, not by height)', (fq / 1e6).toFixed(2) + ' MW at ' + f0(fyq) + ' m');
check(glowTop !== null && glowBot > 1500 && glowT1 - glowT0 >= 12 && glowT1 - glowT0 <= 40, 'the plasma glows high, for a while (U§5.6), and clears above 1,500 m', glowTop !== null ? f0(glowTop) + ' → ' + f0(glowBot) + ' m, ' + f0(glowT1 - glowT0) + ' s' : 'no glow');
check(fg <= 3.5, 'the deceleration stays ≤ 3.5 g', fg.toFixed(2) + ' g');
check(at1500 && at1500.v < 60, 'at 1,500 m the ship is slow', at1500 ? f1(at1500.v) + ' m/s' : '-');
let spread = 0; for (const p of preds) for (const q of preds) spread = Math.max(spread, Math.hypot(p.x - q.x, p.z - q.z));
const pd = descStart && preds.length ? Math.hypot(preds[0].x - descStart.x, preds[0].z - descStart.z) : Infinity;
check(preds.length >= 3 && spread < 1000, 'the landing place, predicted every 3 s from the start of the entry, stays put (< 1 km)', f0(spread) + ' m over ' + preds.length);
check(pd < 2000, 'the speed is gone within 2 km of the first prediction (the world streams there from the start)', descStart ? f0(pd) + ' m, at ' + f0(descStart.y) + ' m after ' + f0(descStart.t) + ' s' : '-');
check(!!landed && landed.t < 420, 'then the straight descent and the last 300 m as today\'s landing: down on the ground', landed ? f0(landed.t) + ' s from orbit, ' + f1(Math.hypot(landed.x - descStart.x, landed.z - descStart.z)) + ' m from where the speed went' : fl.regime + ' ' + fl.state + ' at ' + f0(s.pos[1]));
check(descStart && Math.hypot(descStart.x, descStart.z) > 20000, 'the ship comes down far from the Heartland (anywhere on Herzwelt)', descStart ? f0(Math.hypot(descStart.x, descStart.z) / 1000) + ' km away' : '-');

// ================================================================ (g) the postcard's glide
console.log('(g) the postcard');
const envSun = (tk) => { const th = tk / 24000 * Math.PI * 2, el = Math.sin(th) * 0.42, az = th + 0.4; return unit([Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)]); };
const mkE = (tk) => { const th = tk / 24000 * Math.PI * 2, SB = VR.SkyBodies.at(th); const E = { sunDir: envSun(tk), moonDir: envSun(tk).map(x => -x), bodies: SB, planetDir: SB.giant, ringNormal: SB.ring, planet2Dir: SB.blue }; return E; };
let gOk300 = true, gTrue = 0, sunMove = 0, gGone = true;
for (const day of [0, 3, 41, 200]) for (let tk = 0; tk < 24000; tk += 1500) {
  const t = U.worldSeconds(day, tk);
  const E3 = mkE(tk), E3b = JSON.stringify(mkE(tk));
  A.env(E3, { pos: [0, 300, 0], t, dim: 'overworld' });
  if (JSON.stringify(E3) !== E3b) gOk300 = false;
  const E25 = mkE(tk), sun0 = E25.sunDir.slice();
  A.env(E25, { pos: [0, 2500, 0], t, dim: 'overworld' });
  const sky = U.localSky('overworld', [0, 2500, 0], t), by = sky._byId;
  gTrue = Math.max(gTrue, ang(E25.planetDir, by.amarant.dir), ang(E25.planet2Dir, by.aqua.dir), ang(E25.ringNormal, by.amarant.pole), ang(E25.sunDir, sky.sun.dir));
  ['zinn', 'opal', 'basalt', 'ocker'].forEach((id, k) => { const m = E25.bodies.moons[k]; gTrue = Math.max(gTrue, ang([m[0], m[1], m[2]], by[id].dir)); });
  if (E25.bodies.radius.giant !== 0 || E25.bodies.moons.some(m => m[3] !== 0)) gGone = false;
  // (the sizes: the blend at its end, k = 1 — above 2,450 m the space scene's own bodies stand there instead)
  const Ek = mkE(tk); A.blendSky(Ek, sky, 1);
  gTrue = Math.max(gTrue, Math.abs(Ek.bodies.radius.giant - by.amarant.ang), Math.abs(Ek.bodies.radius.blue - by.aqua.ang));
  ['zinn', 'opal', 'basalt', 'ocker'].forEach((id, k) => { gTrue = Math.max(gTrue, Math.abs(Ek.bodies.moons[k][3] - by[id].ang)); });
  sunMove = Math.max(sunMove, ang(sun0, E25.sunDir) / D2R);
}
check(gOk300, 'at 300 m the sky is the postcard\'s exactly (the ground\'s picture unchanged)');
check(gTrue < 1e-9, 'at 2,500 m the bodies stand where VR.Universe has them (direction, size, the ring\'s pole)', 'worst ' + gTrue.toExponential(1));
check(sunMove <= 2.7, 'the sun moves at most 2.7° on the way (it is nearly true already)', sunMove.toFixed(2) + '°');
check(gGone, 'above 2,450 m the postcard\'s discs are gone: the space scene\'s true bodies stand there (no double Amarant)');
const Em = mkE(6000); A.env(Em, { pos: [0, 1400, 0], t: U.worldSeconds(3, 6000), dim: 'overworld' });
const sk14 = U.localSky('overworld', [0, 1400, 0], U.worldSeconds(3, 6000)), E0m = mkE(6000), k14 = U.climbK(1400);
const mid = ang(E0m.planetDir, Em.planetDir) / Math.max(1e-9, ang(E0m.planetDir, sk14._byId.amarant.dir));
check(Math.abs(mid - k14) < 1e-6, 'between, Amarant glides along the great circle by climbK(y)', 'at 1,400 m ' + mid.toFixed(3) + ' of the way (climbK ' + k14.toFixed(3) + ')');
const Ed = mkE(6000); Ed.zenith = [0.2, 0.4, 0.9]; Ed.horizon = [0.8, 0.9, 1]; Ed.skyMid = [0.4, 0.6, 1]; Ed.fog = [100, 1000, 0.0002, 0];
A.env(Ed, { pos: [0, 1200, 0], t: U.worldSeconds(3, 6000), dim: 'overworld' });
check(Math.abs(Ed.zenith[2] - 0.9 * A.airK(1200)) < 1e-12 && Ed.horizon[2] > Ed.zenith[2] && Ed.fog[2] < 0.0002 * 0.2, 'the sky thins: the zenith first, the horizon band last, the haze with the air', 'zenith ' + Ed.zenith[2].toFixed(3) + ', horizon ' + Ed.horizon[2].toFixed(3));
const Eo = mkE(6000), Eo0 = JSON.stringify(Eo); A.env(Eo, { pos: [0, 1500, 0], t: 100, dim: 'aqua' });
check(JSON.stringify(Eo) === Eo0, 'other worlds: untouched');

// ================================================================ (h) local time
console.log('(h) local time');
const sh = (x, z) => EN.tickShift(x, z);
check(sh(0, 0) === 0 && sh(3000, 0) === 0 && sh(-3900, 100) === 0 && sh(0, 3999) === 0, 'within 4 km of the Heartland the clock is the world\'s own');
const perKm = sh(15000, 0) / 15;
check(perKm > 85 && perKm < 105 && sh(-15000, 0) < 0, '15 km east the sun is later: ~94 ticks a km (4.7 s of a 20-min day)', f1(perKm) + ' ticks/km');
let wr = 0; for (let x = -300000; x <= 300000; x += 25000) for (let z = -300000; z <= 300000; z += 25000) wr = Math.max(wr, Math.abs(sh(x, z)));
check(wr <= 12000, 'the shift wraps to ±12,000 ticks (the other side of the world: half a day)', 'max ' + f0(wr));
let jmp = 0; for (let x = 3800; x < 12500; x += 50) jmp = Math.max(jmp, Math.abs(sh(x + 50, 0) - sh(x, 0)));
check(jmp < 15, 'it fades in between 4 and 12 km without a step', 'max ' + f1(jmp) + ' ticks per 50 m');

// ================================================================ (k) wiring
console.log('(k) wiring');
const src = (f) => fs.readFileSync(ROOT + f, 'utf8');
const B = src('build.js'), mi = B.indexOf("'ascent'");
check(mi > 0 && B.indexOf("'spaceflight'") > mi && B.indexOf("'entry'") > mi && mi > B.indexOf("'spacescene'"), 'build.js: ascent, spaceflight, entry after the space scene');
const FL = src('src/main/flight.js');
check((FL.match(/\/\/ u-ascent/g) || []).length >= 5 && /VR\.Ascent\.simulate\(this, dt\)/.test(FL) && /VR\.Ascent\.lift\(this/.test(FL), 'flight.js: the regime switch, the cap\'s door and the autopilot hooks (marked)');
const SH = src('src/main/shaders.js');
check((SH.match(/u_curve/g) || []).length >= 4 && /u-ascent/.test(SH), 'shaders.js: the bend in the terrain and the tile programs');
const RN = src('src/main/renderer.js'), HO = src('src/main/horizon.js'), EV = src('src/main/env.js'), GM = src('src/main/game.js'), CK = src('src/main/cockpit.js'), SS = src('src/main/spacescene.js'), SP = src('src/main/space_shaders.js');
const SFs = src('src/main/spaceflight.js');
check(/u_curve/.test(RN) && /VR\.Ascent/.test(RN) && /u-ascent/.test(HO) && /VR\.Ascent\.env/.test(EV) && /VR\.Entry\.tickShift/.test(EV) && /u-ascent/.test(GM) && /u-ascent/.test(CK) && /u-ascent/.test(SS) && !/u-ascent/.test(SP) && /u_fadeOut/.test(SFs) && /u_cut/.test(SFs) && /SH\.programs = /.test(SFs), 'renderer, horizon, env, game, cockpit and the space scene hooked (marked); the space programs\' fade and cut wrapped from spaceflight.js (space_shaders.js untouched)');
const LD = src('src/main/lang_de.js'), LE = src('src/main/lang_en.js');
const keys = new Set(); for (const f of ['ascent', 'spaceflight', 'entry']) for (const m of src('src/main/' + f + '.js').matchAll(/'(g\.(?:asc|set)\.[A-Za-z0-9_.]+)'/g)) if (!m[1].endsWith('.')) keys.add(m[1]);
for (const m of ['orbit', 'circ', 'land', 'descend']) { keys.add('g.asc.site.' + m); keys.add('g.asc.go.' + m); }
const missing = [...keys].filter(k => !LD.includes("'" + k + "'") || !LE.includes("'" + k + "'"));
check(keys.size >= 10 && !missing.length, 'every g.asc.* text in German and English', keys.size + ' keys' + (missing.length ? ', missing ' + missing.join(' ') : ''));
check(/key: 'curvature'/.test(src('src/main/ascent.js')), 'the switch „Krümmung" (curvature) via VR.Settings.add');

// ================================================================ the cost of the physics (medians: other tests may share the CPU)
console.log('the cost');
const median = (f, reps, per) => { f(); const xs = []; for (let k = 0; k < reps; k++) { const c0 = process.hrtime.bigint(); f(); xs.push(Number(process.hrtime.bigint() - c0) / 1e6 / per); } xs.sort((p, q) => p - q); return xs[xs.length >> 1]; };
backToAir(238); fl.asc = null; SF.start(fl, 'orbit');
run(20);   // in the climb, under thrust
let ms = median(() => { for (let i = 0; i < 60; i++) A.simulate(fl, 1 / 60); }, 7, 60);
check(ms < 0.05, 'the climb under thrust costs < 0.05 ms a frame', ms.toFixed(4) + ' ms (' + fl.regime + ', y ' + f0(A.mapY(fl.asc.st)) + ')');
fl.auto = null; A.orbitAt(fl, [0, 3063, 0], fl.asc.st.t); fl.throttle = 0;
ms = median(() => { for (let i = 0; i < 60; i++) A.simulate(fl, 1 / 60); }, 7, 60);
check(ms < 0.05, 'coasting in orbit costs < 0.05 ms a frame (one Kepler solve)', ms.toFixed(4) + ' ms');
let gp = null; ms = median(() => { gp = SF.ghost(fl.asc.st, gp); }, 9, 1);
check(ms < 3, 'the ghost path (every 0.5 s) < 3 ms', ms.toFixed(2) + ' ms, ' + gp.pts.length / 3 + ' points');
const stP = A.newState(); A.circularAt(stP, [0, 3063, 0], 100);
ms = median(() => { EN.predict(stP, 'deorbit'); }, 5, 1);
check(ms < 6, 'the landing prediction (every 3 s) < 6 ms', ms.toFixed(2) + ' ms');

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

// The trailer's camera ride (src/shared/cine.js): the spline and the easing, and the shot list.
//  (a) smootherstep: 0 and 1 at the ends, zero speed and acceleration there, monotone, derivative matches
//  (b) a track passes through every key exactly, and evaluates into the buffer it is given (no allocation)
//  (c) C1: position and velocity are continuous at every inner key (finite differences from both sides agree)
//  (d) bounded speed: no NaN, the camera never moves faster than 100 blocks a second, and it starts and ends at rest
//  (e) the look targets keep the pitch in a sane range (never straight up or down)
//  (f) the shot list: title card first and last, A–G in order with the first trailer's durations (±12 %), the whole
//      ride between 50 and 60 s, every shot's start is the sum of the durations before it, and every ship and actor
//      has a valid arch, timing and track
//  (g) the 'reveal' keys convert to the flat camera keys, and the title cards preload the next real shot
global.VR = {};
require('../src/shared/cine.js');
const C = VR.Cine;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const near = (a, b, eps) => Math.abs(a - b) <= eps;

// (a) easing
check(near(C.ease(0), 0, 1e-12) && near(C.ease(1), 1, 1e-12), 'smootherstep: 0 at the start, 1 at the end');
check(C.ease(-1) === 0 && C.ease(2) === 1, 'smootherstep clamps outside [0, 1]');
let mono = true, dmax = 0;
for (let i = 1; i <= 2000; i++) { const u = i / 2000; if (C.ease(u) < C.ease(u - 1 / 2000) - 1e-12) mono = false; const h = 1e-6, num = (C.ease(u + h) - C.ease(u - h)) / (2 * h); dmax = Math.max(dmax, Math.abs(num - C.easeD(u))); }
check(mono, 'smootherstep is monotone');
check(dmax < 1e-4, 'its derivative matches the numeric one (max error ' + dmax.toExponential(2) + ')');
check(near(C.easeD(0), 0, 1e-12) && near(C.easeD(1), 0, 1e-12), 'zero speed at both ends');

// (b) keys are exact, evaluation writes into the buffer it is given
const keys = [[0, 0, 0, 0], [1, 10, 2, -4], [2.5, 12, 9, -30], [4, 40, 5, -31], [6, 41, 3, -60]];
const tr = new C.Track(keys), buf = new Float64Array(3);
let exact = true;
for (const k of keys) { const r = tr.eval(k[0], buf); if (!(near(r[0], k[1], 1e-9) && near(r[1], k[2], 1e-9) && near(r[2], k[3], 1e-9))) exact = false; }
check(exact, 'a track passes through every key exactly');
check(tr.eval(0.5, buf) === buf && tr.eval(3, buf) === buf, 'evaluation returns the buffer it was given (no allocation)');
const e0 = tr.eval(-5, buf).slice(), e1 = tr.eval(99, buf).slice();
check(near(e0[0], 0, 1e-12) && near(e1[0], 41, 1e-12), 'before the first key and after the last one the track holds its ends');

// (c) C1 at the inner keys, and (d) bounded speed over the real camera tracks
let c1 = 0, maxSpeed = 0, nan = false, maxPitch = 0;
const shots = C.SHOTS.filter((s) => s.cam);
const h = 1e-5, pb = new Float64Array(3), pa = new Float64Array(3), pc = new Float64Array(3);
for (const s of shots) {
  const T = s.posTrack;
  for (let i = 1; i < T.n - 1; i++) {
    const t = T.t[i];
    const L0 = T.eval(t - h, pa).slice(), L1 = T.eval(t, pc).slice(), R1 = T.eval(t + h, pa).slice();
    for (let k = 0; k < 3; k++) { const dl = (L1[k] - L0[k]) / h, dr = (R1[k] - L1[k]) / h; c1 = Math.max(c1, Math.abs(dl - dr)); }
  }
  for (let t = 0; t <= T.dur + 1e-9; t += 1 / 400) {
    const p = T.eval(t, pb);
    if (!(isFinite(p[0]) && isFinite(p[1]) && isFinite(p[2]))) nan = true;
    const q = T.eval(t + 1e-4, pc);
    maxSpeed = Math.max(maxSpeed, Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) / 1e-4);
  }
  const L = s.lookTrack;
  for (let t = 0; t <= L.dur + 1e-9; t += 1 / 100) {
    const p = T.eval(t, pb).slice(), q = L.eval(t, pc);
    const dx = q[0] - p[0], dy = q[1] - p[1], dz = q[2] - p[2];
    maxPitch = Math.max(maxPitch, Math.abs(Math.atan2(dy, Math.hypot(dx, dz))));
  }
}
check(c1 < 1e-3, 'C1 at the inner keys: the velocities from both sides agree (max difference ' + c1.toExponential(2) + ')');
check(!nan, 'no NaN on the ride');
check(maxSpeed < 100, 'the camera never moves faster than 100 blocks a second (max ' + maxSpeed.toFixed(1) + ')');
check(maxPitch < 1.3, 'the pitch stays below 1.3 rad, no look straight up or down (max ' + maxPitch.toFixed(2) + ')');
let restOk = true;
for (const s of shots) {
  const T = s.posTrack, p0 = T.eval(0, pb).slice(), p1 = T.eval(1e-3, pc).slice();
  const v = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]) / 1e-3;
  if (v > 2) restOk = false;
}
check(restOk, 'every shot starts at rest (speed under 2 blocks a second in its first millisecond)');

// (f) the shot list
const S = C.SHOTS;
const ids = S.map((s) => s.id);
check(S[0].kind === 'title' && S[S.length - 1].kind === 'title', 'a title card at the start and at the end');
check(S[0].caption === 'R9-SI' && S[S.length - 1].caption === 'R9-SI', 'the title card reads R9-SI');
const order = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const pos = order.map((id) => ids.indexOf(id));
check(pos.every((p) => p >= 0) && pos.every((p, i) => i === 0 || p > pos[i - 1]), 'A–G appear in order: ' + order.map((id) => id + '@' + ids.indexOf(id)).join(' '));
const first = { A: 2.75, B: 2.75, C: 2.75, D: 1.75, E: 7.75, F: 7.25, G: 3.5 };
let durOk = true, durTxt = [];
for (const id of order) { const s = S.find((x) => x.id === id); const want = first[id], rel = Math.abs(s.dur - want) / want; durTxt.push(id + ' ' + s.dur + ' (first ' + want + ')'); if (rel > 0.12) durOk = false; }
check(durOk, 'the shots keep the first trailer\'s durations (±12 %): ' + durTxt.join(', '));
const tot = C.total();
check(tot >= 50 && tot <= 60, 'the whole ride is 50–60 s (' + tot.toFixed(2) + ' s)');
const st = C.starts();
let startsOk = true;
for (let i = 0; i < S.length; i++) { let sum = 0; for (let k = 0; k < i; k++) sum += S[k].dur; if (!near(st[i], sum, 1e-9)) startsOk = false; }
check(startsOk, 'every shot starts at the sum of the durations before it');
const ARCH = ['shuttle', 'interceptor', 'gunship'];
let shipsOk = true, nShips = 0;
for (const s of S) for (const sp of s.ships || []) {
  nShips++;
  if (!ARCH.includes(sp.arch) || !(sp.dur > 0) || !(sp.t0 >= 0) || sp.A.length !== 3 || sp.B.length !== 3 || sp.C.length !== 3) shipsOk = false;
}
check(shipsOk && nShips >= 9, 'every scripted ship has a known arch, a positive flight time, a start inside the shot (' + nShips + ' flights)');
let actorsOk = true, nActors = 0;
for (const s of S) for (const a of s.actors || []) {
  nActors++;
  if (!a.look || !a.pos || a.pos.length !== 3 || !(a.walk ? a.walk.length >= 2 : true)) actorsOk = false;
}
check(actorsOk && nActors >= 6, 'every actor has a look, a place and a walk track (' + nActors + ' heroes)');
const follow = S.find((s) => s.follow);
check(!!follow && follow.ships && follow.ships[follow.follow.ship] !== undefined, 'the follow-cam (C) follows a ship that is in the shot');
const aFirst = S.find((s) => s.id === 'A'), bFirst = S.find((s) => s.id === 'B');
check(aFirst && bFirst && aFirst.fov > 60 && aFirst.tod > 11000, 'the golden hour: the shots run at a low sun (tod 11000+)');
const nxt = C.nextReal(0);
check(nxt === S.findIndex((s) => s.id === 'A'), 'the opening card preloads shot A');
check(C.nextReal(S.findIndex((s) => s.id === 'G2')) === -1, 'after the last real shot only the closing card follows');

// (g) reveal keys → flat keys
const flat = C.fromKeys([[0, [1, 2, 3], [4, 5, 6]], [2.6, [7, 8, 9], [10, 11, 12]]]);
check(flat.length === 2 && flat[0][1] === 1 && flat[0][6] === 6 && flat[1][4] === 10, 'the reveal keys convert to the flat camera keys');

console.log(fails ? 'FAILED ' + fails : 'ALL OK');

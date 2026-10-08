// Docking and the flare without a browser: traffic.js's docking flight (the Gate Temple's apron, in front of the portal)
// and flight.js's landing flare, on the real modules. Run: node test/dock_unit.js
const VR = require('./load_shared.js');
globalThis.VR = VR;
global.window = global.window || {};
global.document = global.document || { getElementById: () => null, createElement: () => ({ style: {}, getContext: () => null }) };
global.performance = global.performance || { now: () => Date.now() };
VR.SHADERS = VR.SHADERS || {};
require(__dirname + '/../src/main/flight.js');
require(__dirname + '/../src/main/traffic.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };

// ---- the apron: in front of the portal, on the plaza's deck (the temple's own base.apron: [0, Y + 1, 30])
const g = { state: 'play', dim: 'overworld', player: { pos: [0, 81, 300] }, particles: { spawn() { } }, audio: { play() { }, loop() { } }, settings: { preset: 'balanced' }, raidActive: false };
const T = new VR.Traffic(g);
const dp = T.dockPoint();
check(dp && dp[0] === 0 && dp[1] === 81 && dp[2] === 30, 'the apron is in front of the portal, on the plaza (' + JSON.stringify(dp) + ')');

// ---- a docking shuttle: in over the plaza, parked on the apron, idle, then out and gone
const H = 5, hover = [dp[0], dp[1] + H * 0.5 + 2.5, dp[2]];
const A = [dp[0] + 10, 120, dp[2] + 190], C = [dp[0], 104, dp[2] + 70];
const mk = (t0, parkDur) => ({ d: { meta: { height: H, length: 20, width: 4 } }, A: A.slice(), B: hover.slice(), C: C.slice(), off: [0, 0, 0], t: t0, dur: 6, speed: 30, age: 0, heading: 0, roll: 0, pitch: 0, gear: 0, prevYaw: null, pos: A.slice(), arch: 'shuttle', big: false, fire: 9, defender: false, circle: null, life: 0, dock: { phase: 'in', parkT: 0, parkDur } });
const s = mk(0, 10);
const step = (sh, sec) => { for (let i = 0; i < Math.round(sec * 60); i++) { sh.age += 1 / 60; T.flyDock(sh, 1 / 60); } };
step(s, 2);
check(s.dock.phase === 'in' && s.pos[0] !== A[0] && s.pos[1] < A[1], 'flying in: it has left the sky point and is coming down (y ' + s.pos[1].toFixed(1) + ')');
step(s, 4.5);
check(s.dock.phase === 'park', 'arrived: it parks on the apron (' + s.dock.phase + ')');
const d0 = Math.hypot(s.pos[0] - hover[0], s.pos[1] - hover[1], s.pos[2] - hover[2]);
check(d0 < 0.25, 'parked at the hover point over the apron (' + d0.toFixed(2) + ' m off, bob only)');
// on the apron the craft turns round to face the plaza (its nose away from the portal), then lifts off with no snap
const offPortal = (h) => Math.abs(Math.atan2(Math.sin(h - Math.PI), Math.cos(h - Math.PI)));
step(s, 5);
check(s.dock.phase === 'park' && offPortal(s.heading) < 0.05, 'idles on the apron turned to face the plaza (' + offPortal(s.heading).toFixed(3) + ' rad from the portal, parked ' + s.dock.parkT.toFixed(1) + ' s)');
let turn = 0, hp = s.heading;
for (let i = 0; i < 6 * 60; i++) { s.age += 1 / 60; T.flyDock(s, 1 / 60); turn = Math.max(turn, Math.abs(Math.atan2(Math.sin(s.heading - hp), Math.cos(s.heading - hp)))); hp = s.heading; }
check(s.dock.phase === 'out', 'lifts off after 9–15 s (phase ' + s.dock.phase + ')');
check(turn < 0.1, 'the lift-off does not snap the craft round (largest turn in one frame ' + turn.toFixed(3) + ' rad)');
step(s, 2);
check(s.pos[1] > hover[1] + 3 || s.pos[2] > hover[2] + 5, 'leaves the apron: climbing or moving away (' + s.pos.map(v => v.toFixed(1)).join(', ') + ')');
step(s, 12);
check(s.dead === true, 'gone after the departure');

// ---- a wingman waits behind its leader (its start is negative) and then joins the same apron
const w = mk(-0.5, 10); w.off = [-6, 0, 4];
const w0 = w.pos.slice();
step(w, 0.2);
check(w.t < 0 && w.pos.every((v, i) => v === w0[i]), 'a wingman that has not started stays where it was');
step(w, 9.5);   // it starts 0.5 of its flight late (3 s): 9 s of flight in all
step(w, 6);   // parked for about 6 s: its turn to face the plaza is done by then
check(w.dock.phase === 'park' || w.dock.phase === 'out', 'the wingman reaches the apron after its start (' + w.dock.phase + ')');
check(Math.abs(w.pos[2] - hover[2]) < 0.5 && Math.abs(w.pos[0] - hover[0]) > 3, 'parked, the wingman sits beside its leader, not behind it in the temple (' + (w.pos[0] - hover[0]).toFixed(1) + ' m across, ' + (w.pos[2] - hover[2]).toFixed(2) + ' m along)');

// ---- the landing flare: the sink eases off as the gear nears the ground (no bounce, a soft touchdown)
const flare = (a) => VR.Flight.prototype.flareSink.call({ alt: a });
check(Math.abs(flare(12) + 8.9) < 1e-9, 'the glide at 12 m: 8.9 m/s down (' + flare(12).toFixed(2) + ')');
check(flare(3) > -2.7 && flare(3) < -2.5, 'the flare at 3 m: about 2.6 m/s down (' + flare(3).toFixed(2) + ')');
check(flare(0.2) > -0.7 && flare(0.2) <= -0.5, 'at touchdown height the sink is gentle (' + flare(0.2).toFixed(2) + ')');
check(flare(null) === -6, 'with no ground loaded the sink is a steady 6 m/s');
check(flare(40) === -10, 'high up the glide is capped at 10 m/s');

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

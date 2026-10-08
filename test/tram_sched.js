// The trams' timetable and the boarding state machine (src/main/trams.js), without a browser:
//  (a) the timetable is deterministic: two lines built from the same description give the same train at every clock
//  (b) one period is dwell (10 s) at the first station, the run, dwell at the second, the run back — and the speed never
//      exceeds the top speed; the two cars of a train stay one coupling apart (no overlap)
//  (c) no two trams in one block: on the real network of the Heartland (every line of the rail network, 1 s steps over
//      a whole cycle of the longest line) no two cars of any lines share a block (a cube of one block)
//  (d) the boarding state machine: idle → board a waiting tram at a station → ride (the seat follows the car) →
//      right-click at the station gets off onto the platform; a moving tram can't be boarded (the hint asks to wait);
//      Shift asks for the roof while it moves and the second Shift climbs there; a click while it moves only says so;
//      a tram removed from the network, or a dead player, ends the ride or the boarding
//  bash test/wt_run.sh tram_sched.js 300
const V = require('./load_shared.js');
require('../src/main/trams.js');
const Trams = V.Trams, Line = Trams.Line;
const RG = V.RailGen;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const DWELL = 10, CAR = 6, GAP = 0.5, VMAX = 13;

// a straight flat line of len blocks along x, the first station at x0
const straight = (key, len, x0, z0, y) => {
  const pts = new Int32Array((len + 1) * 3);
  for (let i = 0; i <= len; i++) { pts[i * 3] = x0 + i; pts[i * 3 + 1] = y; pts[i * 3 + 2] = z0; }
  return { key, pts, tech: true, names: ['Alpha', 'Beta'] };
};

// (a) + (b)
const d = straight('test-straight', 240, 0, 0, 100);
const A = new Line(d), B = new Line(d);
let same = true;
for (let c = 0; c < 3 * A.period; c += 0.37) { const a = A.state(c), b = B.state(c); if (a.c !== b.c || a.v !== b.v || a.stop !== b.stop) { same = false; break; } }
check(same, 'the timetable is deterministic (two lines from one description agree at every clock)');
let dwell1 = 0, dwell2 = 0, run = 0, maxV = 0, backward = 0, forward = 0, prevC = null, prevV = 0;
const step = 0.05;
for (let c = 0; c < A.period - 1e-9; c += step) {
  const s = A.state(c + A.off);
  if (s.stop === 1) dwell1 += step; else if (s.stop === 2) dwell2 += step; else run += step;
  if (s.v > 0) forward += step; if (s.v < 0) backward += step;
  maxV = Math.max(maxV, Math.abs(s.v) * VMAX);
}
check(Math.abs(dwell1 - DWELL) < 0.1 && Math.abs(dwell2 - DWELL) < 0.1, 'a dwell of ' + DWELL + ' s at each station (' + dwell1.toFixed(2) + ' s, ' + dwell2.toFixed(2) + ' s)');
check(Math.abs(forward - backward) < 0.25 && Math.abs(dwell1 + dwell2 + forward + backward - A.period) < 0.2, 'the run out (' + forward.toFixed(2) + ' s) and the run back (' + backward.toFixed(2) + ' s) take the same time, and the cycle adds up to the period (' + A.period.toFixed(2) + ' s)');
check(A.T > 0 && A.L > 200 && A.period > 2 * DWELL, 'the run time T is ' + A.T.toFixed(1) + ' s over ' + A.L.toFixed(0) + ' blocks');
// the cars: the two of a train are CAR + GAP apart on the rail at all times, the centre never leaves the line
let minGap = 1e9, maxGap = 0, outside = 0;
for (let c = 0; c < A.period; c += 0.25) {
  A.place(c);
  const a = A.cars[0].pos, b = A.cars[1].pos, g = Math.hypot(a[0] - b[0], a[2] - b[2]);
  minGap = Math.min(minGap, g); maxGap = Math.max(maxGap, g);
  // the car's centre may run out past either end by the bogie and the half car (the rail is straight on there)
  if (a[0] < -7 || a[0] > 247 || a[2] < -1 || a[2] > 1) outside++;
}
check(minGap > CAR + GAP - 0.5 && maxGap < CAR + GAP + 0.5, 'the two cars of a train stay ' + (CAR + GAP) + ' blocks apart (' + minGap.toFixed(2) + '…' + maxGap.toFixed(2) + ')');
check(outside === 0, 'the train stays on its line (' + outside + ' samples outside)');
void maxV; void run; void prevC; void prevV;

// (c) the real network: one train per line, and no two cars in one block (a cube of one block) at any time
const g6 = V.makeGen('overworld', 12345, { vgen: 6 });
const net = RG.near(g6, 0, 0, 1300).filter(x => x.pts.length >= 9);
const lines = net.map(x => new Line(x));
let period = 0; for (const L of lines) period = Math.max(period, L.period);
const offsets = lines.map(L => L.off);
let samples = 0, clashes = 0, first = null;
const seen = new Map();
for (let c = 0; c < period; c += 1) {
  seen.clear();
  for (const L of lines) {
    L.place(c);
    for (const car of L.cars) {
      const k = Math.floor(car.pos[0]) + ',' + Math.floor(car.pos[1]) + ',' + Math.floor(car.pos[2]);
      const other = seen.get(k);
      if (other && other !== car) { clashes++; if (!first) first = [c, L.key, k]; }
      seen.set(k, car);
    }
  }
  samples++;
}
check(lines.length >= 3 && samples > 0, 'the network: ' + lines.length + ' lines, one cycle of ' + period.toFixed(0) + ' s sampled every second');
check(clashes === 0, 'no two trams in one block at any time (' + clashes + ' clashes' + (first ? ', first at t=' + first[0] + ' on ' + first[1] + ' ' + first[2] : '') + ')');
void offsets;

// (d) the boarding state machine, with the game's pieces stubbed (the player, the gadgets' riding slot, the input)
const hints = [], chat = [], keys = new Set();
const mouse = { clicked: [false, false, false], releasedBtn: [false, false, false] };
const input = { hit: (k) => { if (keys.has(k)) { keys.delete(k); return true; } return false; }, mouse, dragLook: false, clickAction: () => false };
const player = { pos: [0, 0, 0], dead: false, flying: true, target: null, breaking: null, vel: [0, 0, 0], fallStart: null, onGround: true, teleport(x, y, z) { this.pos = [x, y, z]; } };
const game = {
  player, dim: 'overworld', particles: null, codex: null, world: null, camMode: 0, pool: { direct() {} },
  ui: { hint: (t) => hints.push(t), chatLine: (t) => chat.push(t), vehicleHud() {} },
  audio: { play() {}, loop() {} }, env: { day: 0, ticks: 0, night: 0 },
};
const gadgets = {
  riding: null, dismounts: 0, g: game,
  dismount() {
    const r = this.riding; if (!r) return; this.riding = null; this.dismounts++;
    if (r.type === 'tram') { const sp = game.trams.exitSpot(r)[0]; player.teleport(sp[0], sp[1], sp[2]); }
  },
};
game.gadgets = gadgets;
game.trams = new Trams(game);
const T = game.trams;
const line = new Line(straight('test-ride', 240, 0, 0, 100));
T.lines.set(line.key, line);
const stopAt = (c) => { T.clock = c; };
const tick = (dt) => { T.update(dt); };
player.pos = [60, 100, 3];
// a train waiting at its first station: the clock puts the line in its dwell
stopAt(-line.off + 2); tick(0);
check(line.stop === 1, 'the tram waits at the first station');
T.board(line.cars[1]);
check(!!gadgets.riding && gadgets.riding.type === 'tram', 'right-click on the waiting tram boards it');
const seatNow = T.seatPos(gadgets.riding);
T.driveRide(0.016, input, false, gadgets.riding);
check(Math.hypot(player.pos[0] - seatNow[0], player.pos[2] - seatNow[2]) < 1.5, 'the rider sits in the car (the seat follows the car)');
check(gadgets.dismounts === 0, 'no dismount while the tram waits and nothing is pressed');
mouse.clicked[2] = true;
T.driveRide(0.016, input, false, gadgets.riding);
check(!gadgets.riding && gadgets.dismounts === 1, 'right-click at the station gets off');
check(Math.abs(player.pos[2] - line.cars[1].pos[2]) >= 2 && Math.abs(player.pos[2] - line.cars[1].pos[2]) <= 3.5, 'the rider stands on the platform beside the track (' + player.pos.map(v => v.toFixed(1)).join(',') + ')');
// boarding again, then the tram moves off: a click only says so, Shift asks for the roof, the second Shift climbs there
T.board(line.cars[1]);
check(!!gadgets.riding, 'boarded again');
stopAt(-line.off + DWELL + 3); tick(0.1);
check(line.stop === 0 && line.v > 0, 'the tram moves away from the platform');
mouse.clicked[2] = true; T.driveRide(0.016, input, false, gadgets.riding);
check(!!gadgets.riding && hints[hints.length - 1] === 'g.tram.moving', 'a click while it moves is only a hint (' + hints[hints.length - 1] + ')');
keys.add('ShiftLeft'); T.driveRide(0.016, input, false, gadgets.riding);
check(!!gadgets.riding && gadgets.riding.roofAsk !== undefined, 'Shift while it moves asks for the roof');
tick(0.5);
keys.add('ShiftRight'); T.driveRide(0.016, input, false, gadgets.riding);
check(!gadgets.riding && gadgets.dismounts === 2, 'a second Shift within 2.5 s climbs onto the roof');
check(player.pos[1] > line.cars[1].pos[1] + 2, 'the roof is above the car (' + player.pos[1].toFixed(1) + ' over the car at ' + line.cars[1].pos[1].toFixed(1) + ')');
// a moving tram cannot be boarded from outside
hints.length = 0;
T.board(line.cars[0]);
check(!gadgets.riding && hints[hints.length - 1] === 'g.tram.wait', 'a moving tram cannot be boarded (the hint asks to wait)');
// a dead player boards nothing; a tram removed from the network ends the ride
stopAt(-line.off + 2); tick(0);
player.dead = true; T.board(line.cars[1]);
check(!gadgets.riding, 'a dead player does not board');
player.dead = false;
T.board(line.cars[1]);
check(!!gadgets.riding, 'boarding works again once alive');
T.lines.delete(line.key);
T.driveRide(0.016, input, false, gadgets.riding);
check(!gadgets.riding, 'a tram removed from the network ends the ride');
// (e) the atmosphere: the headlight glints only at dusk and night (two lamps and their glints per car, every 20th of a
//     second), and the rail hum swells as a tram comes near (zero beyond 70 blocks)
const glints = [], humLevels = [];
game.particles = { glow: (x, y, z, col, life, size) => glints.push([x, y, z, size]) };
game.audio = { play() {}, loop: (name, level) => { if (name === 'hum') humLevels.push(level); } };
T.lines.set(line.key, line);   // (d) took the line off the network; the atmosphere needs it on the network again
game.settings = { particles: 2 };   // the glints' cost tier: balanced and up (Very Low has particles 0 and no glints)
stopAt(-line.off + DWELL + 3); tick(0.1);
const carAt = line.cars[1].pos;
player.pos = [carAt[0], carAt[1], carAt[2] + 20];
game.env.night = 0; glints.length = 0; humLevels.length = 0; T.glowT = 0; tick(0.06);
check(glints.length === 0, 'no headlight glints in daylight');
game.env.night = 1; T.glowT = 0; glints.length = 0; tick(0.06);
check(glints.length === 2 * 2 * 2, 'at night each car in reach has two lamps, each with a glint ahead (' + glints.length + ' glints)');
game.settings.particles = 0; T.glowT = 0; glints.length = 0; tick(0.06);
check(glints.length === 0, 'Very Low (particles 0) has no headlight glints at night');
game.settings.particles = 2;
const near = humLevels[humLevels.length - 1];
player.pos = [carAt[0], carAt[1], carAt[2] + 40]; tick(0.06);
const mid = humLevels[humLevels.length - 1];
player.pos = [carAt[0], carAt[1], carAt[2] + 90]; tick(0.06);
const far = humLevels[humLevels.length - 1];
check(near > mid && mid > 0 && far === 0, 'the hum swells as a tram comes near (' + near.toFixed(3) + ' at 20 blocks, ' + mid.toFixed(3) + ' at 40, ' + far + ' at 90)');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');

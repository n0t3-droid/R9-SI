// F5 · Gamepad (spec 2026-10-08 realism wave, §F5 and the all-ages W3 mapping): src/main/pad.js, no DOM.
//  (a) sticks: a radial dead zone, the magnitude rescaled so a full push reads 1, the direction kept
//  (b) the standard mapping: A jumps, B sneaks, X undoes, Y opens the inventory, LB/RB turn the hotbar, LT places,
//      RT breaks, View opens the map, Start pauses (the Escape key), a stick click sprints, the D-pad moves the focus
//  (c) edges: a press is reported once, a held button is down every frame, a release is reported once
//  (d) a pad without the standard layout (mapping '') still works; a disconnected pad counts as none
//  (e) rumble on landing: no rumble for a step, a stronger and longer one for a long fall, never above the limits
//  (f) menu focus: from a button, the nearest button in the pressed direction (geometry only), staying put at an edge
require('./dom_stub.js');
globalThis.VR = {};
require('../src/main/pad.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const P = VR.Pad;
if (!P || typeof P.poll !== 'function') { console.log('VR.Pad.poll missing'); console.log('FAILED 1'); process.exit(1); }
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;

console.log('a · sticks');
check(P.stick(0.1, 0.05, 0.15)[0] === 0 && P.stick(0.1, 0.05, 0.15)[1] === 0, 'inside the dead zone the stick reads zero');
const full = P.stick(1, 0, 0.15);
check(near(full[0], 1) && near(full[1], 0), 'a full push reads 1');
const half = P.stick(0, -0.575, 0.15);
check(near(half[1], -0.5, 1e-3) && near(half[0], 0), 'the magnitude is rescaled after the dead zone (0.575 → 0.5), the sign is kept');
const diag = P.stick(0.9, 0.9, 0.15);
check(Math.hypot(diag[0], diag[1]) <= 1 + 1e-9 && near(diag[0], diag[1]), 'a diagonal push stays inside the unit circle with equal parts');
check(P.stick(NaN, 0, 0.15)[0] === 0 && P.stick(3, 0, 0.15)[0] === 1, 'bad values are zero, over-range values are clamped to 1');

// a fake pad in the standard layout: 17 buttons, 4 axes
const pad = (over = {}) => {
  const btn = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
  return Object.assign({ index: 0, id: 'Test Pad', mapping: 'standard', connected: true, axes: [0, 0, 0, 0], buttons: btn }, over);
};
const press = (p, i, v = 1) => { p.buttons[i] = { pressed: v > 0.5, value: v }; return p; };
const release = (p, i) => { p.buttons[i] = { pressed: false, value: 0 }; return p; };

console.log('b · the standard mapping');
let prev = null;
let p = pad();
let st = P.poll([p], prev); prev = st;
check(st.connected === true && st.id === 'Test Pad' && st.move[0] === 0 && st.look[1] === 0 && st.down.length === 0, 'an idle pad: connected, no movement, nothing down');
p = press(pad(), 0); st = P.poll([p], prev); prev = st;
check(st.down.includes('jump') && st.pressed.includes('jump'), 'A (0) jumps: down and pressed on the first frame');
st = P.poll([p], prev); prev = st;
check(st.down.includes('jump') && !st.pressed.includes('jump'), 'a held A stays down, not pressed again');
p = release(p, 0); st = P.poll([p], prev); prev = st;
check(!st.down.includes('jump') && st.released.includes('jump'), 'releasing A reports one release');
const mapped = [[1, 'sneak'], [2, 'undo'], [3, 'inv'], [8, 'map'], [10, 'sprint'], [11, 'cam']];
check(mapped.every(([b, a]) => { const q = P.poll([press(pad(), b)], null); return q.down.includes(a); }), 'B sneaks, X undoes, Y opens the inventory, View opens the map, stick click sprints, R3 switches the camera');
let q = P.poll([press(pad(), 9)], null);
check(q.physPressed.includes('Escape') && q.down.length === 0, 'Start presses Escape (pause); it is no game action of its own');
q = P.poll([press(pad(), 7, 0.9)], null);
check(q.mouseDown[0] === true && q.mouseDown[2] === false, 'RT (7) breaks: the left mouse button is held');
q = P.poll([press(pad(), 6, 0.9)], null);
check(q.mouseDown[2] === true && q.mouseClicked[2] === true, 'LT (6) places: the right mouse button clicks on the first frame');
q = P.poll([press(pad(), 6, 0.3)], null);
check(q.mouseDown[2] === false, 'a trigger pulled only a little (under 0.5) does nothing');
let p4 = press(pad(), 4); let s4 = P.poll([p4], null);
check(s4.wheel === -1, 'LB turns the hotbar back by one');
s4 = P.poll([p4], s4);
check(s4.wheel === 0, 'a held LB turns once only');
const p5 = press(pad(), 5);
check(P.poll([p5], null).wheel === 1, 'RB turns the hotbar forward by one');
const dp = press(pad(), 14); const sd = P.poll([dp], null);
check(sd.dpad.includes('left') && sd.down.length === 0, 'the D-pad left is reported as a focus move (not a game key)');
check(['up', 'down', 'left', 'right'].every((d, i) => P.poll([press(pad(), 12 + i)], null).dpad.includes(d)), 'D-pad: 12 up, 13 down, 14 left, 15 right');
check(P.poll([press(pad(), 0)], null).menu.includes('ok') && P.poll([press(pad(), 1)], null).menu.includes('back'), 'in menus A is OK and B is back');
const lx = pad({ axes: [0.8, -0.6, 0.5, 0] });
const sl = P.poll([lx], null);
check(sl.move[0] > 0.6 && sl.move[1] < -0.4 && sl.look[0] > 0.3 && sl.look[1] === 0, 'left stick moves, right stick looks, both past the dead zone');

console.log('c · edges and the first pad');
const two = [null, pad({ index: 1, buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: i === 0, value: i === 0 ? 1 : 0 })) })];
const s2 = P.poll(two, null);
check(s2.index === 1 && s2.down.includes('jump'), 'the first connected pad is used, empty slots are skipped');
check(P.poll([pad({ connected: false })], null).connected === false, 'a disconnected pad counts as none');
check(P.poll([], null).connected === false && P.poll(undefined, null).connected === false, 'no pads at all: not connected, all zeros');
const none = P.poll([], null);
check(none.move[0] === 0 && none.look[0] === 0 && none.down.length === 0 && none.pressed.length === 0, 'the empty state is all zeros');
check(P.poll([pad({ mapping: '' })], null).down.length === 0 && P.poll([press(pad({ mapping: '' }), 0)], null).down.includes('jump'), 'a pad with no mapping name still reads the standard layout');

console.log('d · rumble on landing');
const r0 = P.rumbleFor(0.5);
check(r0 === null, 'a step of half a block gives no rumble');
const r1 = P.rumbleFor(3), r2 = P.rumbleFor(10), r3 = P.rumbleFor(40);
check(r1 && r2 && r3 && r1.strong < r2.strong && r2.strong <= r3.strong, 'a longer fall rumbles harder');
check([r1, r2, r3].every(x => x.strong >= 0 && x.strong <= 1 && x.weak >= 0 && x.weak <= 1 && x.duration >= 60 && x.duration <= 300), 'every rumble stays inside 0–1 strength and 60–300 ms');
check(P.rumbleFor(NaN) === null && P.rumbleFor(-2) === null, 'nonsense heights give no rumble');

console.log('e · menu focus geometry');
const grid = [
  { x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 0, w: 10, h: 10 },
  { x: 0, y: 20, w: 10, h: 10 }, { x: 20, y: 20, w: 10, h: 10 },
];
check(P.navNearest(grid, 0, 'right') === 1 && P.navNearest(grid, 0, 'down') === 2, 'right and down go to the neighbour in that direction');
check(P.navNearest(grid, 3, 'up') === 1 && P.navNearest(grid, 3, 'left') === 2, 'up and left from the far corner');
check(P.navNearest(grid, 1, 'right') === 1 && P.navNearest(grid, 0, 'up') === 0, 'at an edge the focus stays where it is');
const row = [{ x: 0, y: 0, w: 10, h: 10 }, { x: 30, y: 0, w: 10, h: 10 }, { x: 30, y: 40, w: 10, h: 10 }];
check(P.navNearest(row, 0, 'right') === 1, 'to the right the nearer of two buttons wins');
check(P.navNearest(row, 1, 'down') === 2 && P.navNearest(row, 2, 'up') === 1, 'down and up follow the column');
check(P.navNearest([], 0, 'right') === -1 && P.navNearest(grid, 9, 'right') === -1, 'no list, or an unknown start, gives -1');

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
if (fails) process.exit(1);

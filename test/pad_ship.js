// 🚀 The gamepad in a ship (t-shuttle on top of F5's pad.js): flight.js asks for its keys by their default names, so
// while the player pilots (VR.game.flight) the pad flies the ship instead of walking. No DOM: binds.js, pad.js and
// input.js run in node with the stubbed window (test/dom_stub.js), as in test/controls_frame.js.
//  (a) VR.Pad.ship maps one polled frame: left stick A/D and Space/Shift, RT/LT W/S, A boost B, B hover X, X gear F,
//      Y view C, LB look back Q, D-pad G/V/L/R, RB the left mouse button, R3 the middle one; a light push does nothing
//  (b) in a ship, input.down/hit answer those names (a press once, held every frame, gone on release), the walking
//      actions are off (A is no jump, Y opens no inventory, the walk stick and the hotbar are still), RB clicks, the
//      right stick still looks, Start is still Escape
//  (c) on foot nothing changes: A jumps, no ship key is down; an open menu takes the pad in a ship too
//   bash test/wt_run.sh pad_ship.js 300
require('./dom_stub.js');
globalThis.VR = {};
require('../src/main/binds.js');
require('../src/main/pad.js');
require('../src/main/input.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const P = VR.Pad;

// a pad in the standard layout: 17 buttons, 4 axes
const mk = (held = [], axes = [0, 0, 0, 0]) => ({ index: 0, id: 'Test pad', mapping: 'standard', connected: true, axes: axes.slice(), buttons: Array.from({ length: 17 }, (_, i) => held.includes(i) ? { pressed: true, value: 1 } : { pressed: false, value: 0 }) });
const keysOf = (held, axes) => { const o = P.ship ? P.ship(P.poll([mk(held, axes)], null)) : { keys: [], mouse: [] }; return o.keys.slice().sort().join(','); };

console.log('a · the mapping');
check(typeof P.ship === 'function', 'VR.Pad.ship exists');
if (typeof P.ship === 'function') {
  check(keysOf([], [-1, 0, 0, 0]) === 'KeyA' && keysOf([], [1, 0, 0, 0]) === 'KeyD', 'left stick left / right: A / D (turn)');
  check(keysOf([], [0, -1, 0, 0]) === 'Space' && keysOf([], [0, 1, 0, 0]) === 'ShiftLeft', 'left stick up / down: Space / Shift (climb, descend)');
  check(keysOf([], [0.4, -0.4, 0, 0]) === '', 'a light push (0.4) does nothing');
  check(keysOf([7]) === 'KeyW' && keysOf([6]) === 'KeyS', 'RT / LT: W / S (throttle)');
  check(keysOf([0]) === 'KeyB' && keysOf([1]) === 'KeyX' && keysOf([2]) === 'KeyF' && keysOf([3]) === 'KeyC' && keysOf([4]) === 'KeyQ', 'A boost (B) · B hover (X) · X gear (F) · Y view (C) · LB look back (Q)');
  check(keysOf([12]) === 'KeyG' && keysOf([13]) === 'KeyV' && keysOf([14]) === 'KeyL' && keysOf([15]) === 'KeyR', 'D-pad: up autopilot (G) · down land / get out (V) · left lights (L) · right ramp (R)');
  const m = P.ship(P.poll([mk([5, 11])], null));
  check(m.mouse[0] === true && m.mouse[1] === true && m.mouse[2] === false && m.keys.length === 0, 'RB the left mouse button, R3 the middle one');
  check(P.ship(P.poll([], null)).keys.length === 0, 'no pad: no keys');
  const out = { keys: [], mouse: [false, false, false] }, r1 = P.ship(P.poll([mk([7])], null), out), r2 = P.ship(P.poll([mk([6])], null), out);
  check(r1 === out && r2 === out && out.keys.join() === 'KeyS', 'the result object is filled in place (no allocation per frame)');
}

console.log('b · in a ship');
const canvas = { addEventListener() {}, requestPointerLock: null };
let pads = [];
navigator.getGamepads = () => pads;
VR.Binds.current = new VR.Binds.Bindings();
const inp = new VR.Input(canvas);
const frame = (fn) => { inp.beginFrame(1 / 60); const r = fn ? fn() : null; inp.endFrame(); return r; };
VR.game = { flight: {} };
pads = [mk([7])];
const f1 = frame(() => [inp.down('KeyW'), inp.hit('KeyW')]);
const f2 = frame(() => [inp.down('KeyW'), inp.hit('KeyW')]);
pads = [mk([])];
const f3 = frame(() => [inp.down('KeyW'), inp.hit('KeyW')]);
check(f1.join() === 'true,true' && f2.join() === 'true,false' && f3.join() === 'false,false', 'RT held: W is pressed once, down while held, up after the release (' + [f1, f2, f3].map(x => x.join('/')).join(' · ') + ')');
pads = [mk([0])];
const f4 = frame(() => [inp.hit('KeyB'), inp.down('KeyB'), inp.down('Space')]);
check(f4.join() === 'true,true,false', 'A boosts (B) and does not jump (Space) in a ship');
pads = [mk([3])];
const f5 = frame(() => [inp.hit('KeyC'), inp.hit('KeyE'), inp.down('KeyE')]);
check(f5.join() === 'true,false,false', 'Y switches the view (C) and opens no inventory (E)');
pads = [mk([5], [1, 0, 0, 0])];
const f6 = frame(() => [inp.mouse.down[0], inp.mouse.clicked[0], inp.padMove.fwd, inp.padMove.str, inp.down('KeyD')]);
check(f6[0] === true && f6[1] === true && f6[2] === 0 && f6[3] === 0 && f6[4] === true, 'RB clicks the left button; the left stick turns (D) and does not walk');
pads = [mk([], [0, 0, 1, 0])];
const f7 = frame(() => inp.mouse.dx);
check(f7 > 0, 'the right stick still looks around (dx ' + f7.toFixed(1) + ')');
pads = [mk([9])];
const f8 = frame(() => inp.hit('Escape'));
check(f8 === true, 'Start is still Escape');
pads = [mk([14])];
const wheel = frame(() => [inp.mouse.wheel, inp.hit('KeyL')]);
check(wheel[0] === 0 && wheel[1] === true, 'D-pad left switches the lights (L) and turns no hotbar');

console.log('c · on foot and in menus');
VR.game = { flight: null };
pads = [mk([])]; frame();
pads = [mk([0])];
const g1 = frame(() => [inp.down('Space'), inp.hit('KeyB'), inp.down('KeyB')]);
check(g1.join() === 'true,false,false', 'on foot A jumps (Space) and no ship key is down');
VR.game = { flight: {} };
inp.menuOpen = true;
pads = [mk([])]; frame();
pads = [mk([7])];
const g2 = frame(() => [inp.down('KeyW'), inp.hit('KeyW')]);
check(g2.join() === 'false,false', 'an open menu takes the pad: no throttle while it is open');
inp.menuOpen = false;

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

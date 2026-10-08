// F5 · Steuerung (spec 2026-10-08 realism wave, §F5): src/main/input.js with the bindings (binds.js) and the gamepad
// (pad.js) — node, a stubbed window, document, canvas and gamepad list.
//  (a) the game's default names work as before with no rebinding (W is forward, Escape is Escape)
//  (b) a rebound action answers its new keys for down / hit / dbl, and its old key no longer does; a second action on
//      the same key answers both
//  (c) the pad and the touch layer name an action: down and hit answer for the action's name, also when it is unbound
//  (d) the capture: the next key goes to the callback once and never to the game
//  (e) mouse smoothing: off passes the look through; on glides (less on the first frame, the total turn is kept)
//  (f) the right stick turns the view, the left stick gives forward and sideways; menus take no game keys from the pad
//  (g) raw movement: the lock asks for unadjusted movement; a refused raw request retries plainly and turns raw off
require('./dom_stub.js');
globalThis.VR = {};
require('../src/main/binds.js');
require('../src/main/pad.js');
require('../src/main/input.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const B = VR.Binds;

const canvas = { addEventListener() {}, requestPointerLock: null };
const mk = () => new VR.Input(canvas);
const kd = (code) => window.dispatchEvent({ type: 'keydown', code, target: { tagName: 'DIV' }, preventDefault() {} });

console.log('a · the default names');
B.current = new B.Bindings();
let inp = mk();
inp.keys.add('KeyW');
check(inp.down('KeyW') === true && inp.down('KeyS') === false, 'W is held: the forward name answers');
inp.keys.clear();
inp.pressed.add('Space');
check(inp.hit('Space') === true && inp.hit('KeyE') === false, 'Space pressed this frame is a jump press');
inp.pressed.clear();
inp.keys.add('Escape');
check(inp.down('Escape') === true, 'a name no action owns (Escape) is the physical key');
inp.keys.clear();

console.log('b · rebinding');
B.current = new B.Bindings();
B.current.set('fwd', 0, 'KeyI');
inp = mk();
inp.keys.add('KeyW');
check(inp.down('KeyW') === false, 'after the rebind, W no longer moves forward');
inp.keys.clear(); inp.keys.add('KeyI');
check(inp.down('KeyW') === true, 'I moves forward: the game asks for W and gets I');
inp.keys.clear(); inp.pressed.add('KeyI');
check(inp.hit('KeyW') === true, 'a press of I is a press of the forward action');
inp.pressed.clear(); inp.doubleTap.add('KeyI');
check(inp.dbl('KeyW') === true, 'a double tap of I counts as the double tap of forward (sprint)');
inp.doubleTap.clear();
B.current.set('back', 0, 'KeyI');
inp.keys.add('KeyI');
check(inp.down('KeyW') === true && inp.down('KeyS') === true, 'two actions on one key: both answer (the conflict is shown, not hidden)');
inp.keys.clear();
B.current = new B.Bindings();
B.current.set('jump', 0, 'KeyJ');
inp = mk();
inp.pressed.add('Space');
check(inp.hit('Space') === false, 'Space stops jumping once jump is on J');
inp.pressed.clear(); inp.pressed.add('KeyJ');
check(inp.hit('Space') === true, 'J is the jump key for the game');
inp.pressed.clear();
B.current = new B.Bindings();
B.current.clear('sneak', 0); B.current.clear('sneak', 1);
inp = mk();
inp.keys.add('ShiftRight');
check(inp.down('ShiftLeft') === false && inp.down('ShiftRight') === false, 'a cleared action answers nothing');
inp.keys.clear();

console.log('c · the pad and the touch layer name actions');
B.current = new B.Bindings();
inp = mk();
inp.padDown.add('jump');
check(inp.down('Space') === true, 'a pad jump is down for the Space name');
inp.padDown.clear();
inp.padPressed.add('fwd');
check(inp.hit('KeyW') === true && inp.hit('KeyS') === false, 'a pressed action answers only its own name');
inp.padPressed.clear();
inp.vPhys.add('Escape');
check(inp.hit('Escape') === true, 'the pad Start presses Escape');
inp.vPhys.clear();
B.current.clear('chat', 0);
inp.tPressed.add('chat');
check(inp.hit('KeyT') === true, 'a virtual press also works for an unbound (cleared) action');
inp.padPressed.clear();

console.log('d · the capture');
B.current = new B.Bindings();
inp = mk();
let got = null, calls = 0;
inp.captureNext((code) => { calls++; got = code; });
kd('KeyP');
check(calls === 1 && got === 'KeyP' && inp.keys.has('KeyP') === false, 'the next key goes to the capture, not to the game');
kd('KeyQ');
check(calls === 1 && inp.keys.has('KeyQ') === true, 'after the capture, keys reach the game again');
inp.keys.clear();
inp.captureNext((code) => { got = code; });
inp.cancelCapture();
kd('KeyR');
check(inp.keys.has('KeyR') === true, 'a cancelled capture lets the key through');
inp.keys.clear();

console.log('e · mouse smoothing');
inp = mk();
inp.mouse.dx = 100;
inp.beginFrame(1 / 60);
check(inp.mouse.dx === 100, 'smoothing off: the look passes through unchanged');
inp.endFrame();
inp.smooth = true;
inp.smX = 0; inp.smY = 0;   // a fresh glide starts from rest (a turn that began while smoothing was off carries on from its last value)
inp.mouse.dx = 100;
inp.beginFrame(1 / 60);
const first = inp.mouse.dx;
check(first > 0 && first < 60, 'smoothing on: the first frame turns part of the way (' + first.toFixed(1) + ' of 100)');
inp.endFrame();
let total = first;
for (let i = 0; i < 200; i++) { inp.mouse.dx = 0; inp.beginFrame(1 / 60); total += inp.mouse.dx; inp.endFrame(); }
check(near(total, 100, 0.5), 'smoothing keeps the total turn (' + total.toFixed(2) + ')');
inp.smooth = false;
inp.endFrame();

console.log('f · the gamepad');
const btns = (over = {}) => Array.from({ length: 17 }, (_, i) => over[i] || { pressed: false, value: 0 });
let fakePads = [];
navigator.getGamepads = () => fakePads;
const padAt = (axes, buttons) => ({ index: 0, id: 'Test', mapping: 'standard', connected: true, axes, buttons: buttons || btns() });
B.current = new B.Bindings();
inp = mk();
fakePads = [padAt([0, 0, 1, 0])];
inp.beginFrame(1 / 60);
check(near(inp.mouse.dx, 1400 / 60, 0.01) && inp.mouse.dy === 0, 'the right stick at full push turns the view by 1400 px a second');
inp.endFrame();
fakePads = [padAt([0, -1, 0, 0])];
inp.beginFrame(1 / 60);
check(near(inp.padMove.fwd, 1) && inp.padMove.str === 0, 'the left stick up is forward (1)');
inp.endFrame();
fakePads = [padAt([-1, 0, 0, 0])];
inp.beginFrame(1 / 60);
check(near(inp.padMove.str, -1) && inp.padMove.fwd === 0, 'the left stick left is sideways (-1)');
inp.endFrame();
fakePads = [padAt([0, 0, 0, 0], btns({ 0: { pressed: true, value: 1 } }))];
inp.beginFrame(1 / 60);
check(inp.down('Space') === true && inp.hit('Space') === true, 'A jumps: down and pressed for the Space name');
inp.endFrame();
fakePads = [padAt([0, 0, 0, 0], btns({ 0: { pressed: true, value: 1 } }))];
inp.menuOpen = true;
inp.beginFrame(1 / 60);
check(inp.down('Space') === false && inp.hit('Space') === false && inp.padMove.fwd === 0, 'with a menu open the pad gives no game keys (it moves the focus instead)');
inp.endFrame();
inp.menuOpen = false;
fakePads = [padAt([0, 0, 0, 0], btns({ 7: { pressed: true, value: 1 } }))];
inp.beginFrame(1 / 60);
check(inp.mouse.down[0] === true && inp.holdAction(0) === true, 'RT holds the break button');
inp.endFrame();
fakePads = [padAt([0, 0, 0, 0], btns())];
inp.beginFrame(1 / 60);
check(inp.mouse.down[0] === false && inp.mouse.releasedBtn[0] === true, 'releasing RT ends the hold once');
inp.endFrame();
fakePads = [];
inp.beginFrame(1 / 60);
check(inp.padMove.fwd === 0 && inp.padDown.size === 0, 'no pad: nothing is taken from the pad');

console.log('g · raw movement');
const calls2 = [];
const cv = { addEventListener() {}, requestPointerLock(opts) {
  calls2.push(opts);
  if (opts && opts.unadjustedMovement) return Promise.reject(Object.assign(new Error('unsupported'), { name: 'NotSupportedError' }));
  return Promise.resolve();
} };
const inp2 = new VR.Input(cv);
inp2.captured = true;
inp2.requestLock();
setTimeout(() => {}, 0);
check(calls2.length === 1 && calls2[0] && calls2[0].unadjustedMovement === true, 'the first lock asks for unadjusted movement');
const done = new Promise((res) => setTimeout(res, 20)).then(() => {
  check(calls2.length === 2 && calls2[1] === undefined && inp2.raw === false, 'refused raw: a plain retry, and raw movement is switched off');
  console.log(fails ? 'FAILED ' + fails : 'ALL OK');
  if (fails) process.exit(1);
});
void done;

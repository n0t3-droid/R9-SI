// F5 · Steuerung (spec 2026-10-08 realism wave, "Measuring"): what the controls layer costs per frame on the CPU. The real
// modules (binds.js, pad.js, input.js) run in node with a stubbed window, document, canvas and gamepad list, and each
// per-frame path is timed on its own: input.beginFrame + endFrame with a connected gamepad (two sticks, two buttons held)
// and with three keys held, the pad poll alone, and one binding lookup. The browser numbers of the cost run cannot show
// this (the shared machine draws a frame in seconds); these are the CPU numbers the plan's "Measured" section quotes.
// Every per-frame path must stay under 0.2 ms. Ends with ALL OK / FAILED n.
//   node test/controls_frame.js
require('./dom_stub.js');
globalThis.VR = {};
require('../src/main/binds.js');
require('../src/main/pad.js');
require('../src/main/input.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const canvas = { addEventListener() {}, requestPointerLock: null };
const btns = (over = {}) => Array.from({ length: 17 }, (_, i) => over[i] || { pressed: false, value: 0 });
let pads = [];
navigator.getGamepads = () => pads;
const N = 20000;
// milliseconds per call, averaged over n calls (after a warm-up of n / 10)
const timeMs = (n, fn) => { for (let i = 0; i < n / 10; i++) fn(i); const t0 = process.hrtime.bigint(); for (let i = 0; i < n; i++) fn(i); return Number(process.hrtime.bigint() - t0) / 1e6 / n; };

VR.Binds.current = new VR.Binds.Bindings();
const inp = new VR.Input(canvas);
pads = [{ index: 0, id: 'Benchmark pad', mapping: 'standard', connected: true, axes: [0.6, -0.8, 0.7, 0.1], buttons: btns({ 0: { pressed: true, value: 1 }, 6: { pressed: true, value: 0.5 } }) }];
const frame = () => { inp.beginFrame(1 / 60); inp.endFrame(); };

console.log('the frame with a connected gamepad');
const padFrame = timeMs(N, frame);
check(padFrame < 0.2, 'beginFrame + endFrame with the pad: ' + (padFrame * 1000).toFixed(2) + ' µs per frame');
const padPoll = timeMs(N, () => VR.Pad.poll(pads, null));
check(padPoll < 0.2, 'the pad poll on its own: ' + (padPoll * 1000).toFixed(2) + ' µs per call');

console.log('the frame with keys held as well');
inp.keys.add('KeyW'); inp.keys.add('KeyI'); inp.keys.add('ShiftLeft');
const keysFrame = timeMs(N, frame);
check(keysFrame < 0.2, 'beginFrame + endFrame with the pad and three keys held: ' + (keysFrame * 1000).toFixed(2) + ' µs per frame');

console.log('one binding lookup');
let hits = 0;
const lookup = timeMs(N * 5, () => { if (inp.down('KeyW')) hits++; });
check(lookup < 0.01 && hits > 0, 'down(name) through the bindings: ' + (lookup * 1000).toFixed(3) + ' µs per call');

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

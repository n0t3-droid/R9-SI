// The palette's icon pump (src/main/icons.js, VR.IconPump) and the idle warm of the Modern Living pictures (VR.iconWarm).
// Frames and idle callbacks are fakes: the clock moves only with the paints, frames run when the test says so.
// Frame rules: a frame paints until 6 ms are used (the check is before each paint), so a model still to be built is one
// paint like the others; a detached canvas is dropped without a paint. The warm builds nothing before notBefore (10 s
// of play), one picture per idle slice with more than 8 ms left, largest model first, and stops while the page is hidden.
// VR.warmQueue is the same warm for any list of ids (the Studio's Modern thumbnails), in the order given.
require('./load_shared.js');
require('/home/claude/vr/src/main/icons.js');
const VM = VR.VM;
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };

// a fake browser for the pump: requestAnimationFrame queues a callback for the next frame
const frameEnv = () => {
  const e = { t: 0, frames: [], rafCalls: 0 };
  e.now = () => e.t;
  e.raf = (cb) => { e.rafCalls++; e.frames.push(cb); return e.rafCalls; };
  e.runFrame = () => { const cbs = e.frames; e.frames = []; for (const cb of cbs) cb(); };
  return e;
};
const canvas = () => ({ isConnected: true });

// 1 · a frame paints until 6 ms are used: 2 ms paints give 3 per frame, then the rest
{
  const e = frameEnv(), painted = [];
  const pump = new VR.IconPump({ budget: 6, now: e.now, raf: e.raf, paint: (cv, id) => { painted.push(id); e.t += 2; } });
  for (let i = 0; i < 10; i++) pump.add(canvas(), 'w' + i);
  const sizes = [];
  for (let k = 0; k < 20 && pump.pending; k++) { const b = painted.length; e.runFrame(); sizes.push(painted.length - b); }
  check(sizes.join() === '3,3,3,1' && painted.join() === 'w0,w1,w2,w3,w4,w5,w6,w7,w8,w9', 'frames paint 3, 3, 3, 1 items of 2 ms (' + sizes.join(',') + ')');
}

// 2 · a model still to be built is one paint like the others: its frame holds it, then the budget closes the frame
{
  const e = frameEnv(), painted = [], cold = new Set(['c']);
  const pump = new VR.IconPump({ budget: 6, now: e.now, raf: e.raf, paint: (cv, id) => { painted.push(id); e.t += cold.has(id) ? 30 : 1; } });
  for (const id of ['w1', 'c', 'w2', 'w3']) pump.add(canvas(), id);
  const frames = [];
  for (let k = 0; k < 20 && pump.pending; k++) { const b = painted.length; e.runFrame(); frames.push(painted.slice(b).join('+')); }
  check(frames.join(' | ') === 'w1+c | w2+w3', 'a cold model shares the frame before it and closes it (' + frames.join(' | ') + ')');
}

// 3 · a frame closes once 6 ms are used: 4 ms paints go two to a frame (at most one paint runs past the budget)
{
  const e = frameEnv(), painted = [];
  const pump = new VR.IconPump({ budget: 6, now: e.now, raf: e.raf, paint: (cv, id) => { painted.push(id); e.t += 4; } });
  for (const id of ['a', 'b', 'c', 'd', 'e']) pump.add(canvas(), id);
  const frames = [];
  for (let k = 0; k < 10 && pump.pending; k++) { const b = painted.length; e.runFrame(); frames.push(painted.slice(b).join('+')); }
  check(frames.join(' | ') === 'a+b | c+d | e', 'frames of 4 ms paints: two per frame (' + frames.join(' | ') + ')');
}

// 3b · an expensive build (30 ms) fills its frame; the paint behind it waits for the next frame
{
  const e = frameEnv(), painted = [];
  const pump = new VR.IconPump({ budget: 6, now: e.now, raf: e.raf, paint: (cv, id) => { painted.push(id); e.t += id === 'c' ? 30 : 1; } });
  pump.add(canvas(), 'c'); pump.add(canvas(), 'w');
  const frames = [];
  for (let k = 0; k < 5 && pump.pending; k++) { const b = painted.length; e.runFrame(); frames.push(painted.slice(b).join('+')); }
  check(frames.join(' | ') === 'c | w', 'a 30 ms build alone in its frame, the next paint after it (' + frames.join(' | ') + ')');
}

// 4 · detached canvases are dropped without a paint
{
  const e = frameEnv(), painted = [];
  const pump = new VR.IconPump({ budget: 6, now: e.now, raf: e.raf, paint: (cv, id) => { painted.push(id); e.t += 1; } });
  pump.add({ isConnected: false }, 'x'); pump.add(canvas(), 'y'); pump.add({ isConnected: false }, 'z');
  e.runFrame();
  check(painted.join() === 'y' && pump.pending === 0, 'a detached canvas is dropped without a paint (painted ' + painted.join() + ')');
}

// 5 · one frame loop however many items and start() calls, and nothing is scheduled once the queue is empty
{
  const e = frameEnv();
  const pump = new VR.IconPump({ budget: 6, now: e.now, raf: e.raf, paint: () => { e.t += 1; } });
  pump.add(canvas(), 'a'); pump.add(canvas(), 'b'); pump.start(); pump.start();
  check(e.frames.length === 1, 'a single frame loop (' + e.frames.length + ' pending frame callbacks)');
  e.runFrame();
  check(e.frames.length === 0 && pump.pending === 0, 'nothing is scheduled once every icon is painted');
}

// ---- the idle warm (VR.iconWarm): a fake idle queue, like test/prewarm.js
const idleEnv = () => {
  const env = { t: 0, isHidden: false, queue: [], cancels: 0 };
  env.idle = (cb) => { const h = { cb, off: false }; env.queue.push(h); return h; };
  env.cancel = (h) => { if (h && !h.off) { h.off = true; env.cancels++; } };
  env.now = () => env.t;
  env.hidden = () => env.isHidden;
  env.pending = () => env.queue.filter(h => !h.off).length;
  env.slice = (left) => { let h; while ((h = env.queue.shift()) && h.off); if (!h) return false; h.cb({ timeRemaining: () => left }); return true; };
  return env;
};
// the real pack: three items of different sizes, in the order the warm must use (largest volume first)
const pick = ['vm_garden_hammock_stand', 'vm_light_pendant_globe_brass', 'vm_kitchen_fridge_french'];
const vol = (n) => { const m = VM.MODELS[n]; return m.VW * m.VH * m.VD; };
const want = [...pick].sort((a, b) => (vol(b) - vol(a)) || (a < b ? -1 : a > b ? 1 : 0));

// 6 · nothing before notBefore; then one picture per idle slice, largest first, each once; done means no more slices
{
  const env = idleEnv(), got = [];
  const icons = { get: (id) => { got.push(id); return {}; } };
  const w = VR.iconWarm(icons, pick, { notBefore: 10000, now: env.now, idle: env.idle, cancel: env.cancel, hidden: env.hidden });
  env.t = 4000; env.slice(30);
  check(got.length === 0 && env.pending() === 1, 'no picture 4 s into play (asked again)');
  env.t = 10000; env.slice(30); env.slice(30); env.slice(30);
  check(got.join() === want.join() && w.done() && env.pending() === 0, 'one picture per slice from 10 s on, largest model first: ' + got.map(n => n.replace(/^vm_/, '')).join(' · '));
  check(w.left() === 0, 'nothing left to warm');
}

// 7 · a slice needs more than 8 ms left; a hidden page stops the warm and show starts it again
{
  const env = idleEnv(), got = [];
  const icons = { get: (id) => { got.push(id); return {}; } };
  const w = VR.iconWarm(icons, [pick[0]], { notBefore: 0, now: env.now, idle: env.idle, cancel: env.cancel, hidden: env.hidden });
  env.slice(8); check(got.length === 0 && env.pending() === 1, 'with 8 ms left nothing is painted');
  env.isHidden = true; env.slice(30);
  check(got.length === 0 && env.pending() === 0, 'a hidden page stops the warm');
  env.isHidden = false; w.start(); env.slice(30);
  check(got.join() === pick[0] && w.done(), 'shown again: the warm resumes and finishes');
}

// 8 · VR.warmQueue (the Studio's ✨ Modern thumbnails, studio/catalog.js): build(id) once per id, in the order given, one
// per idle slice, nothing before notBefore, a second start() does not double the queue, a failing build does not stop it
{
  const env = idleEnv(), got = [];
  const ids = ['vm_b_one', 'vm_a_two', 'vm_c_three'];
  const w = VR.warmQueue(ids, (id) => { if (id === 'vm_a_two' && got.length === 1 && !w.failed) { w.failed = true; throw new Error('test failure'); } got.push(id); }, { notBefore: 10000, now: env.now, idle: env.idle, cancel: env.cancel, hidden: env.hidden });
  check(got.length === 0 && env.pending() === 0 && !w.done(), 'a queue does not start by itself');
  w.start(); w.start();
  env.t = 4000; env.slice(30);
  check(got.length === 0 && env.pending() === 1, 'nothing before notBefore (asked again, one idle request only)');
  const warn = console.warn; console.warn = () => {};
  env.t = 10000; env.slice(30);
  check(got.join() === 'vm_b_one', 'one id per idle slice from 10 s on: ' + got.join());
  env.slice(30); env.slice(30); env.slice(30);
  console.warn = warn;
  check(got.join() === 'vm_b_one,vm_c_three' && w.failed && w.done() && env.pending() === 0, 'a failing build is skipped, the rest is built once each in the order given: ' + got.join(' · '));
}

// 9 · a picture drawn in slices (the pump's ready, Icons.stepIcon): a frame ends when more() says its budget is spent, and an
// item is painted only once ready says it is complete, in the frame that completes it
{
  const e = frameEnv(), painted = [], need = { a: 1, b: 3 }, left = {};
  const ready = (id, more) => {   // like stepIcon: at least one step per call, more steps while more() says so
    if (left[id] === undefined) left[id] = need[id];
    do { e.t += 2; left[id]--; if (left[id] <= 0) return true; } while (more());
    return false;
  };
  const pump = new VR.IconPump({ budget: 6, now: e.now, raf: e.raf, ready, paint: (cv, id) => { painted.push(id + '@' + e.t); e.t += 1; } });
  pump.add(canvas(), 'a'); pump.add(canvas(), 'b');
  for (let k = 0; k < 10 && pump.pending; k++) e.runFrame();
  check(painted.join() === 'a@2,b@9' && pump.pending === 0 && e.rafCalls === 2, 'a sliced picture waits for its frames and is painted when complete: ' + painted.join(' · ') + ' in ' + e.rafCalls + ' frames');
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

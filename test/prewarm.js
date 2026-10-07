// Pre-warm of the lazy models (voxmodel.js VM.prewarm): in idle time, one model per idle slice, largest volume first, a
// slice builds only while the browser has more than 8 ms left, nothing before notBefore (the game starts it 10 s into
// play), it stops while the page is hidden and when every model is built, and stop() cancels the pending slice.
// The idle callback, the clock and the visibility are fakes; the last part runs the real builds through the scheduler.
require('./load_shared.js');
const VM = VR.VM;
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };

// a fake browser: requestIdleCallback queues its callback; slice(left) runs the next queued one with `left` ms in it
const fakeEnv = () => {
  const env = { t: 0, isHidden: false, queue: [], cancels: 0 };
  env.idle = (cb) => { const h = { cb, off: false }; env.queue.push(h); return h; };
  env.cancel = (h) => { if (h && !h.off) { h.off = true; env.cancels++; } };
  env.now = () => env.t;
  env.hidden = () => env.isHidden;
  env.pending = () => env.queue.filter(h => !h.off).length;
  env.slice = (left) => { let h; while ((h = env.queue.shift()) && h.off); if (!h) return false; h.cb({ timeRemaining: () => left }); return true; };
  return env;
};
const fakeModel = (name, vol) => ({ name, lazy: true, compiled: false, VW: vol, VH: 1, VD: 1 });
const fakeBuild = (log) => (m) => { m.compiled = true; log.push(m.name); };
const opts = (env, models, log) => ({ models, build: fakeBuild(log), now: env.now, idle: env.idle, cancel: env.cancel, hidden: env.hidden });

// 1 · one model per slice, largest first; nothing is pending once all are built
{
  const env = fakeEnv(), built = [];
  const pw = VM.prewarm(opts(env, [fakeModel('a', 10), fakeModel('b', 1000), fakeModel('c', 100), fakeModel('d', 5000)], built));
  pw.start();
  check(env.pending() === 1, 'start() asks for one idle slice');
  const per = [], pend = [];
  for (let k = 0; k < 4; k++) { env.slice(30); per.push(built.length); pend.push(env.pending()); }
  check(per.join() === '1,2,3,4' && pend.join() === '1,1,1,0', 'one model per slice (built ' + per.join(',') + ', pending after each ' + pend.join(',') + ')');
  check(built.join() === 'd,b,c,a', 'largest volume first: ' + built.join(' '));
  check(pw.done() && pw.left() === 0 && env.pending() === 0, 'all built: done, nothing left, no more slices asked for');
}

// 2 · a slice builds only with more than 8 ms left (the frame budget); a short slice asks again without building
{
  const env = fakeEnv(), built = [];
  const pw = VM.prewarm(opts(env, [fakeModel('x', 50)], built));
  pw.start();
  env.slice(8); check(built.length === 0 && env.pending() === 1, 'with 8 ms left nothing is built and the next slice is asked for');
  env.slice(3); check(built.length === 0 && env.pending() === 1, 'with 3 ms left nothing is built either');
  env.slice(8.5); check(built.join() === 'x' && pw.done() && env.pending() === 0, 'with 8.5 ms left the model is built, and the scheduler is done');
}

// 3 · nothing before notBefore (the game starts it 10 s into play), then it starts
{
  const env = fakeEnv(), built = [];
  const pw = VM.prewarm(Object.assign(opts(env, [fakeModel('p', 9)], built), { notBefore: 10000 }));
  env.t = 0; pw.start();
  env.t = 4000; env.slice(30);
  check(built.length === 0 && env.pending() === 1, 'no build 4 s into play (asked again)');
  env.t = 9999; env.slice(30);
  check(built.length === 0 && env.pending() === 1, 'no build at 9.999 s');
  env.t = 10000; env.slice(30);
  check(built.join() === 'p' && pw.done(), 'the first model is built at 10 s');
}

// 4 · the page is hidden: a slice builds nothing and asks for no more; shown again, start() resumes
{
  const env = fakeEnv(), built = [];
  const pw = VM.prewarm(opts(env, [fakeModel('h1', 9), fakeModel('h2', 8)], built));
  pw.start();
  env.isHidden = true; env.slice(30);
  check(built.length === 0 && env.pending() === 0 && !pw.done(), 'hidden: nothing is built and no slice is asked for');
  env.isHidden = false; pw.start();
  check(env.pending() === 1, 'shown again: start() asks for a slice');
  env.slice(30); env.slice(30);
  check(built.join() === 'h1,h2' && pw.done(), 'then the two are built, one per slice');
}

// 5 · stop() cancels the pending slice; nothing is built after it
{
  const env = fakeEnv(), built = [];
  const pw = VM.prewarm(opts(env, [fakeModel('s', 9)], built));
  pw.start(); pw.stop();
  check(env.cancels === 1 && env.pending() === 0, 'stop() cancels the pending slice');
  const ran = env.slice(30);
  check(!ran && built.length === 0 && !pw.done(), 'and nothing is built after it');
}

// 6 · a model built meanwhile (a paint, a pick) is skipped without using up the slice
{
  const env = fakeEnv(), built = [];
  const d = fakeModel('d', 500), b = fakeModel('b', 100);
  const pw = VM.prewarm(opts(env, [d, b], built));
  pw.start();
  d.compiled = true;
  env.slice(30);
  check(built.join() === 'b' && pw.done(), 'a model already built is skipped, the slice builds the next one');
}

// 7 · nothing to build (every model is built already): done at the first slice, no slice asked for after it
{
  const env = fakeEnv(), built = [];
  const z = fakeModel('z', 1); z.compiled = true;
  const pw = VM.prewarm(opts(env, [z], built));
  pw.start(); env.slice(30);
  check(built.length === 0 && pw.done() && env.pending() === 0 && pw.left() === 0, 'nothing unbuilt: done at once, nothing built');
}

// 8 · the real pack: the list is every unbuilt lazy model (largest first); each slice compiles exactly one real model
{
  const env = fakeEnv();
  const unbuilt = () => Object.values(VM.MODELS).filter(m => m.lazy && !m.compiled);
  const before = unbuilt();
  const pw = VM.prewarm({ now: env.now, idle: env.idle, cancel: env.cancel, hidden: env.hidden });
  check(pw.left() === before.length && before.length >= 236, 'the list is every unbuilt lazy model (' + before.length + ', the pack has 236)');
  pw.start();
  const vol = (m) => m.VW * m.VH * m.VD, per = [];
  const t0 = Date.now();
  for (let k = 0; k < 3; k++) { const c0 = VM.stats.compiled; env.slice(30); per.push(VM.stats.compiled - c0); }
  const ms = Date.now() - t0, now = unbuilt(), built = before.filter(m => m.compiled), left = before.filter(m => !m.compiled);
  check(per.join() === '1,1,1' && pw.left() === before.length - 3, 'three slices, three real builds (' + per.join(',') + ') in ' + ms + ' ms');
  check(built.length === 3 && Math.min(...built.map(vol)) >= Math.max(...left.map(vol)), 'the three largest by volume came first (volumes ' + built.map(vol).join(', ') + ')');
  check(now.length === before.length - 3, 'nothing else was built (' + now.length + ' still unbuilt)');
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

// The worker pool must survive a worker that dies or throws: its in-flight jobs get an answer (type 'error'), its
// slot is free again, and a worker that stops answering is replaced by a fresh one that is told the world again
// (init, style, custom, look). A section whose mesh job failed is meshed again (a few times, not forever); a
// column whose generation failed is asked for again after a pause.
//   bash test/wt_run.sh pool_recover.js
const V = require('./load_shared.js');
// ---- a fake browser: Worker, Blob, URL ----
const made = [];
class FakeWorker {
  constructor(url) { this.url = url; this.sent = []; this.alive = true; this.idx = made.length; made.push(this); }
  postMessage(m, tr) { if (!this.alive) return; this.sent.push(m); if (this.onPost) this.onPost(m, tr); }
  terminate() { this.alive = false; }
  // the worker answers a job
  answer(m) { this.onmessage({ data: m }); }
}
global.Worker = FakeWorker;
global.Blob = class { constructor(parts) { this.parts = parts; } };
global.URL = { createObjectURL: () => 'blob:fake' };
global.window = undefined;
require('../src/main/world.js');
let fail = 0;
const check = (ok, what) => { console.log((ok ? 'OK   ' : 'FAIL ') + what); if (!ok) fail++; };
// ---- 1. a worker throws (onerror): in-flight jobs answered, slot free ----
{
  const pool = new V.WorkerPool('/* src */', 2);
  pool.maxInflight = 2;
  pool.broadcast({ type: 'init', seed: 7, opts: { vgen: 5 } });
  pool.broadcast({ type: 'look', mode: 'seamless' });
  const got = [];
  for (let i = 0; i < 5; i++) pool.submit({ type: 'mesh', key: i }, null, (m) => got.push([i, m.type]), i);
  pool.pump();
  const w0 = pool.workers[0], w1 = pool.workers[1];
  check(w0.inflight === 2 && w1.inflight === 2 && pool.queued === 1, 'five jobs: two in flight per worker, one queued');
  const err = { message: 'RangeError: out of memory', preventDefault() {} };
  const held = [...pool.started.values()].filter(st => st.w === w0).length;
  w0.onerror(err);
  check(held === 2 && [...pool.started.values()].every(st => st.w !== w0 || st.t0 > 0) && got.filter(x => x[1] === 'error').length === 2, 'after an uncaught error both jobs that were in that worker hear {type: error}');
  check(w0.inflight === 1 && pool.queued === 0, 'its slots are free again: the queued job went to it at once');
  check(pool.busy === 3, 'three jobs in flight, nothing stuck');
}
// ---- 2. a worker that never answers is replaced; the replacement learns the world ----
{
  const pool = new V.WorkerPool('/* src */', 2);
  pool.maxInflight = 2;
  const init = { type: 'init', seed: 99, opts: { worldType: 'default', vgen: 5 }, custom: { models: {} } };
  pool.broadcast(init);
  pool.broadcast({ type: 'style', style: { sv: 2, rules: [['a', 'b']] } });
  pool.broadcast({ type: 'look', mode: 'classic' });
  pool.broadcast({ type: 'lodinit', avg: new Float32Array(4) });
  pool.broadcast({ type: 'custom', custom: { models: { x: 1 } } });
  const got = [];
  pool.submit({ type: 'gen', cx: 1, cz: 1 }, null, (m) => got.push(['gen', m.type]));
  pool.submit({ type: 'lod', lane: 1, level: 2 }, null, (m) => got.push(['lod', m.type]));
  pool.pump();
  const dead = pool.workers[0], other = pool.workers[1];
  check(dead.inflight + other.inflight === 2, 'two jobs in flight');
  // time passes without an answer from either worker
  const t0 = performance.now();
  const stale = pool.stuckMs || 45000;
  for (const st of pool.started.values()) st.t0 = t0 - stale - 1;
  pool.pump();
  const nw0 = pool.workers[0], nw1 = pool.workers[1];
  check(dead.alive === false && other.alive === false, 'both silent workers were terminated');
  check(nw0 !== dead && nw1 !== other && nw0.alive && nw1.alive && pool.workers.length === 2, 'two fresh workers took their places');
  check(got.length === 2 && got.every(x => x[1] === 'error'), 'the jobs the dead workers held hear {type: error} (their owners ask again)');
  const types = nw0.sent.map(m => m.type);
  const custom = nw0.sent.find(m => m.type === 'custom');
  check(types[0] === 'init' && nw0.sent[0].seed === 99 && types.indexOf('custom') > 0 && custom.custom.models.x === 1, 'the replacement is told the world first: init with the seed, then the latest designs (' + types.join(', ') + ')');
  check(types.includes('style') && types.includes('look') && types.includes('lodinit') && nw0.sent.find(m => m.type === 'look').mode === 'classic', 'and the style, the look and the horizon colours');
  check(nw0.inflight === 0 && nw1.inflight === 0 && pool.busy === 0, 'nothing counts as in flight on the new workers');
  // the new worker is used for new work
  pool.submit({ type: 'mesh', key: 5 }, null, () => {});
  pool.pump();
  check(nw0.inflight + nw1.inflight === 1, 'new jobs go to the new workers');
  // a job that answers in time is never mistaken for a stuck one
  const w = nw0.inflight ? nw0 : nw1; const id = w.sent[w.sent.length - 1].id;
  for (const st of pool.started.values()) st.t0 = performance.now() - 1000;
  pool.pump();
  check(w.alive && pool.workers.includes(w), 'a worker busy for a second is left alone');
  w.answer({ type: 'mesh', id, ms: 3 });
  check(w.inflight === 0 && pool.started.size === 0, 'its answer frees the slot');
  // a direct job (the textures at boot) on a worker that dies is answered too — the boot never waits forever
  let texAnswer = null;
  pool.direct(0, { type: 'textures', bevel: 1 }, null, (m) => { texAnswer = m; });
  for (const st of pool.started.values()) st.t0 = performance.now() - stale - 1;
  pool.pump();
  check(texAnswer && texAnswer.type === 'error' && pool.workers[0].alive && pool.workers[0] !== nw0, 'a direct job on a worker that died hears {type: error}; the worker is replaced');
}
// ---- 3. the world asks again: a failed mesh job re-dirties the section (three tries), a failed column is retried after a pause ----
{
  const pool = new V.WorkerPool('/* src */', 1);
  pool.maxInflight = 4;
  const renderer = { freeSection() {}, uploadSection(s) { s.hasMesh = true; }, q: { vxLod: 48 } };
  const world = new V.World({}, { dim: 'overworld', seed: 1, genOpts: {}, pool, renderer, renderDist: 2 });
  // nine ready columns around 0,0 (flat stone floor) so section 0,3,0 can be meshed
  const stone = V.R.byName.stone.defaultState;
  for (let cz = -1; cz <= 1; cz++) for (let cx = -1; cx <= 1; cx++) {
    const blocks = new Uint16Array(65536); for (let i = 0; i < 256 * 60; i++) blocks[i] = stone;
    world.onColumn({ cx, cz, blocks, light: new Uint16Array(65536), biome: new Uint8Array(256), caveBiome: new Int8Array(256), grass: new Uint16Array(256), foliage: new Uint16Array(256), water: new Uint16Array(256), chests: [], spawns: [] });
  }
  pool.clear();   // the columns' own mesh requests are not the point here
  const c = world.col(0, 0), s = c.sec[3];
  s.dirty = true; s.pending = false;
  world.meshSection(c, 3, false, 0, [8, 60, 8]);
  pool.pump();
  const w = pool.workers[0];
  const job = w.sent.find(m => m.type === 'mesh');
  check(!!job && s.pending === true, 'the section\'s mesh job is in flight');
  w.answer({ type: 'error', id: job.id, msg: 'boom' });
  check(s.pending === false && s.dirty === true, 'a failed mesh job: the section is dirty again (meshed again next frame)');
  for (let k = 0; k < 3; k++) { s.pending = false; world.meshSection(c, 3, false, 0, [8, 60, 8]); pool.pump(); const j = w.sent[w.sent.length - 1]; w.answer({ type: 'error', id: j.id, msg: 'boom' }); }
  check(s.dirty === false, 'after a few failures in a row the section is given up (no endless loop of failing jobs)');
  // a column whose generation fails is asked for again, but not in the same frame
  world.requestColumn(5, 5, V.ckey(5, 5), 0);
  pool.pump();
  const gen = w.sent[w.sent.length - 1];
  check(gen.type === 'gen' && gen.cx === 5 && world.pending.has(V.ckey(5, 5)), 'a column is requested');
  w.answer({ type: 'error', id: gen.id, msg: 'gen boom' });
  check(!world.pending.has(V.ckey(5, 5)) && !world.cols.has(V.ckey(5, 5)), 'after a failed generation the column is neither pending nor loaded');
  const now = performance.now();
  check(typeof world.retryAfter === 'function' && world.retryAfter(V.ckey(5, 5), now) > now && world.retryAfter(V.ckey(5, 5), now + 10000) <= now + 10000, 'it is asked for again after a pause, not at once');
}
console.log(fail ? `FAIL ${fail}` : 'OK — the worker pool recovers');
process.exit(fail ? 1 : 0);

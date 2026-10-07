// The worker pool's size (VR.poolSize, src/main/world.js; game.js starts the pool with it): one worker on a 1–2 core
// machine, two on 3–4 cores, cores − 2 above that (at most 6); the quality preset caps it (potato 2, low 3). And a
// pool of ONE worker works: its jobs are answered in order, and its direct jobs (worker 0) get their answers.
//   bash test/wt_run.sh pool_size.js
const V = require('./load_shared.js');
// ---- a fake browser: Worker, Blob, URL (as in pool_recover.js) ----
const made = [];
class FakeWorker {
  constructor(url) { this.url = url; this.sent = []; this.alive = true; this.idx = made.length; made.push(this); }
  postMessage(m) { if (this.alive) this.sent.push(m); }
  terminate() { this.alive = false; }
  answer(m) { this.onmessage({ data: m }); }
}
global.Worker = FakeWorker;
global.Blob = class { constructor(parts) { this.parts = parts; } };
global.URL = { createObjectURL: () => 'blob:fake' };
global.window = undefined;
require('../src/main/world.js');
let fail = 0;
const check = (ok, what) => { console.log((ok ? 'OK   ' : 'FAIL ') + what); if (!ok) fail++; };

// ---- 1. the rule: the expected count for 1..16 cores, per preset (balanced, high, ultra and custom: no cap below 6) ----
const byCores = [1, 1, 2, 2, 3, 4, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6];      // cores 1..16 → min(base, 6)
const cap = { potato: 2, low: 3 };
const expect = (cores, preset) => Math.min(byCores[cores - 1], cap[preset] || 6);
const presets = ['potato', 'low', 'balanced', 'high', 'ultra', 'custom'];
let rows = 0, bad = [];
for (const p of presets) for (let c = 1; c <= 16; c++) {
  rows++;
  const got = V.poolSize(c, p);
  if (got !== expect(c, p)) bad.push(`${c} cores ${p}: ${got}, expected ${expect(c, p)}`);
}
check(bad.length === 0, `the rule for 1–16 cores × ${presets.length} presets (${rows} cases)${bad.length ? ': ' + bad.join('; ') : ''}`);
check(V.poolSize(2, 'balanced') === 1 && V.poolSize(4, 'balanced') === 2 && V.poolSize(8, 'high') === 6, 'the examples: 2 cores → 1, 4 cores → 2, 8 cores → 6');
check(V.poolSize(8, 'potato') === 2 && V.poolSize(8, 'low') === 3, 'the caps: 8 cores on potato → 2, on low → 3');
check(V.poolSize(1, undefined) === 1 && V.poolSize(0, 'balanced') === 2 && V.poolSize(NaN, 'balanced') === 2, 'no or odd core count: 1 core → 1; unknown (0 or NaN) → the 4-core default, 2');
check(V.poolSize(12, undefined) === 6, 'no preset given: no cap below 6');

// ---- 2. a pool of one worker: queued jobs are answered, the direct job of worker 0 gets its answer ----
{
  const pool = new V.WorkerPool('/* src */', 1);
  pool.maxInflight = 2;
  pool.broadcast({ type: 'init', seed: 7, opts: { vgen: 5 } });
  check(pool.workers.length === 1, 'the pool has one worker');
  const w0 = pool.workers[0];
  const got = [];
  for (let i = 0; i < 5; i++) pool.submit({ type: 'mesh', key: i }, null, (m) => got.push(m.key), i);
  pool.pump();
  check(w0.inflight === 2 && pool.queued === 3, 'five jobs on one worker: two in flight, three queued');
  const answered = new Set();
  for (let round = 0; round < 20 && got.length < 5; round++) {
    pool.pump();
    for (const m of w0.sent) if (m.type === 'mesh' && !answered.has(m.id)) { answered.add(m.id); w0.answer({ type: 'mesh', id: m.id, key: m.key }); }
  }
  check(got.length === 5 && got.join() === '0,1,2,3,4', 'all five jobs of the one worker are answered, in order');
  let direct = null;
  pool.direct(0, { type: 'textures', bevel: 1 }, null, (m) => { direct = m.type; });
  const dm = w0.sent.find(m => m.type === 'textures');
  check(!!dm && w0.inflight >= 1, 'a direct job goes to worker 0');
  w0.answer({ type: 'textures', id: dm.id });
  check(direct === 'textures', 'its answer reaches the caller');
  check(w0.inflight === 0 && pool.queued === 0 && pool.busy === 0, 'nothing is left in flight');
}
console.log(fail ? `FAILED ${fail}` : 'the pool size follows the rule, and a pool of one worker works\nALL OK');
process.exit(fail ? 1 : 0);

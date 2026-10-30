// e-engine (docs/superpowers/plans/2026-10-30-e-engine.md) · the loading screen's streaming between the frames: on a slow
// frame (a weak GPU drawing the sky, a software renderer: 0.5 frames a second here) the column requests were topped up
// every other frame only — six columns per two frames for one worker, which then waited most of the start.
//  1. WorkerPool tells its owner of every answer (onAnswer) after the callback and the pump
//  2. World.update(…, off = true): the requests on every such call (not every other frame); the frame clock (lastUpd,
//     the upload scheduler's frame), the fades and the uploads stay with the frames
//  3. the model of a start: frames 1.8 s apart, a worker answering a column in 60 ms — the columns of radius 4 arrive
//     within the frames' pace only with the pump (at least 3 × as many columns after 4 frames)
//   bash test/wt_run.sh load_pump.js
const V = require('./load_shared.js');
class FakeWorker {
  constructor() { this.sent = []; }
  postMessage(m) { this.sent.push(m); }
  terminate() {}
}
global.Worker = FakeWorker;
global.Blob = class { constructor(p) { this.parts = p; } };
global.URL = { createObjectURL: () => 'blob:fake' };
global.window = undefined;
require('../src/main/world.js');
let fail = 0;
const check = (ok, what) => { console.log((ok ? 'OK   ' : 'FAIL ') + what); if (!ok) fail++; };
const renderer = { freeSection() {}, uploadSection(s) { s.hasMesh = true; }, q: { vxLod: 48 } };
const colMsg = (cx, cz, id) => ({ type: 'gen', id, cx, cz, blocks: new Uint16Array(65536), light: new Uint16Array(65536), biome: new Uint8Array(256), caveBiome: new Int8Array(256), grass: new Uint16Array(256), foliage: new Uint16Array(256), water: new Uint16Array(256), chests: [], spawns: [] });

// ---- 1. onAnswer
{
  const pool = new V.WorkerPool('/* src */', 1); pool.maxInflight = 2;
  const seen = [];
  pool.onAnswer = (m) => seen.push(m.type);
  pool.submit({ type: 'mesh', key: 1 }, null, () => seen.push('cb'), 0);
  pool.pump();
  const w = pool.workers[0], job = w.sent[0];
  w.onmessage({ data: { type: 'mesh', id: job.id, ms: 2 } });
  check(seen.join() === 'cb,mesh', 'the pool tells its owner of an answer after the job\'s own callback (' + seen.join() + ')');
  w.onmessage({ data: { type: 'waiting', id: 99 } });
  check(seen.length === 2, 'a worker\'s "waiting" (a plan slice) is no answer');
}
// ---- 2. update(off)
{
  const pool = new V.WorkerPool('/* src */', 1); pool.maxInflight = 2;
  const world = new V.World({}, { dim: 'overworld', seed: 1, genOpts: {}, pool, renderer, renderDist: 4 });
  world.update(8, 80, 8, 1000);
  const lu = world.lastUpd, gens = () => pool.workers[0].sent.filter(m => m.type === 'gen').length + pool.queue.filter(j => j.msg.type === 'gen').length;
  const n0 = world.pending.size;
  let frames = 0; const fr0 = world.uploadQ.frN;
  // the pending columns answered (nothing integrated: their requests just leave), then two calls between the frames
  for (const k of [...world.pending.keys()]) world.pending.delete(k);
  world.update(8, 80, 8, 1010, true); const a = world.pending.size;
  for (const k of [...world.pending.keys()]) world.pending.delete(k);
  world.update(8, 80, 8, 1020, true); const b = world.pending.size;
  check(n0 > 0 && a > 0 && b > 0, `a call between the frames asks for columns every time (${n0} at the frame, then ${a}, ${b})`);
  check(world.lastUpd === lu && world.uploadQ.frN === fr0, 'the frame clock and the upload scheduler\'s frames are left to the frames');
  frames = gens(); check(frames > 0, 'the requests reach the pool');
}
// ---- 3. the model of a start (radius 4: 61 columns in the circle of loadR = 5 … the first 45 nearest)
const startModel = (pump) => {
  const pool = new V.WorkerPool('/* src */', 1); pool.maxInflight = 2;
  const world = new V.World({}, { dim: 'overworld', seed: 1, genOpts: {}, pool, renderer, renderDist: 4 });
  const w = pool.workers[0];
  let t = 0, done = 0;
  const queue = [];   // the worker's jobs (60 ms each)
  w.postMessage = (m) => { if (m.type === 'gen') queue.push(m); };
  if (pump) pool.onAnswer = () => world.update(8, 80, 8, t, true);
  // 4 frames, 1.8 s apart: between them the worker runs its queue in 60 ms steps
  for (let f = 0; f < 4; f++) {
    world.update(8, 80, 8, t);
    const end = t + 1800;
    while (t + 60 <= end && queue.length) { t += 60; const m = queue.shift(); w.onmessage({ data: colMsg(m.cx, m.cz, m.id) }); done++; }
    t = end;
  }
  return done;
};
const slow = startModel(false), fast = startModel(true);
check(fast >= 3 * slow, `4 slow frames: ${slow} columns with the frames alone, ${fast} with the pump (≥ 3 ×)`);
console.log(fail ? `FAILED ${fail}` : 'ALL OK');
process.exit(fail ? 1 : 0);

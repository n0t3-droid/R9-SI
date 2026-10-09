// F9 · Weltgenerierung im Takt (src/main/ultralite.js VR.UL.Stream + world.js streamTakt), no browser:
//  a · the budget rule: the main thread's streaming ms from the frame's headroom (CPU and GPU run side by side: a
//      GPU-bound frame leaves the main thread max(budget, gpu) − js ms that cost no frame time)
//  b · the byte cap: uploads stop at 2 MB a frame; a bigger item runs alone once it has waited four frames
//  c · away from the player: a queued generation the player has moved away from is cancelled
//  d · the arrivals: generated columns wait and are integrated in the frame within the budget — at least one a frame,
//      nearest first, the request stays pending until then (never asked twice), one far away by now is dropped
//  e · the queue follows the player: queued generations and meshes are re-ordered by the current distance
//  f · off (every preset but Ultra · Leicht): the world streams exactly as before
//   bash test/wt_run.sh ultralite_stream.js
const V = require('./load_shared.js');
global.window = undefined;
require('../src/main/gl.js'); require('../src/main/shaders.js'); require('../src/main/ultralite.js'); require('../src/main/renderer.js');
global.Worker = class { constructor() { this.inflight = 0; } postMessage() {} terminate() {} };
global.Blob = class {}; global.URL = { createObjectURL: () => 'blob:x' };
require('../src/main/world.js');
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
const ST = V.UL && V.UL.Stream;
if (!ST) { console.log('VR.UL.Stream missing'); console.log('FAILED 1'); process.exit(1); }

console.log('a · the budget rule');
{
  const b = (g, j) => ST.budget(g, j);
  check(b(6, 3) === ST.MAX, 'an idle frame streams at the most', b(6, 3));
  check(b(8, 17.5) === ST.MIN && b(8, 30) === ST.MIN, 'a frame whose main thread is at or over its budget streams the least (never nothing)', b(8, 17.5));
  check(b(22, 5) === ST.MAX, 'a GPU-bound frame (gpu 22 ms, js 5 ms): the main thread waits for the GPU anyway — it streams', b(22, 5));
  check(b(22, 18) < b(22, 12) && b(22, 12) <= b(22, 5), 'less headroom, less streaming (monotonic in js)', [b(22, 18), b(22, 12), b(22, 5)].map(x => x.toFixed(2)).join(' ≤ '));
  check(b(10, 12) === b(16, 12), 'a GPU under its budget does not change the main thread\'s share (only its own time does)');
  check(b(undefined, 10) > ST.MIN && b(undefined, 10) <= ST.MAX && b(undefined, 18) === ST.MIN, 'no GPU timer: the main thread\'s own headroom', b(undefined, 10).toFixed(2));
  check(ST.jobs(ST.MIN) >= 2 && ST.jobs(ST.MAX) === Math.round(ST.MAX * 4), 'mesh-job starts: four per millisecond, at least two', ST.jobs(ST.MIN) + ' … ' + ST.jobs(ST.MAX));
}

console.log('b · the byte cap');
{
  const q = new V.Stream.UploadScheduler({ msPerByte: 1e-9 });
  let ran = 0;
  for (let i = 0; i < 10; i++) q.push({ key: i, x: i, z: 0, bytes: 600 * 1024, run: () => { ran++; } });
  const r = q.drain(100, () => 0, 0, 0, ST.BYTES);
  check(ST.BYTES === 2 * 1024 * 1024 && r.ran === 3 && r.left === 7, 'ten uploads of 600 KB: three go up this frame (2 MB), the rest wait', `${r.ran} ran, ${r.left} left`);
  const r2 = q.drain(100, () => 0, 0, 0);
  check(r2.ran === 7, 'without a byte cap (every preset but Ultra · Leicht) the ms budget alone decides, as before');
  const q2 = new V.Stream.UploadScheduler({ msPerByte: 1e-9 });
  q2.push({ key: 'big', x: 0, z: 0, bytes: 5 * 1024 * 1024, run: () => { ran++; } });
  const runs = []; for (let f = 0; f < 6; f++) runs.push(q2.drain(100, () => 0, 0, 0, ST.BYTES).ran);
  check(runs.join('') === '000010', 'a 5 MB upload waits four frames, then goes up alone', runs.join(''));
}

console.log('c · away from the player');
{
  // (dxL, dzL from the loading centre — it runs ahead of a moving player — and dxP, dzP from the player, in chunks)
  const rd = 10;
  check(!ST.away(3, 4, 3, 4, rd, 0, 0, false) && ST.away(9, 8, 9, 8, rd, 0, 0, false), 'standing: kept inside the load radius, cancelled beyond rd + 1.5 (was rd + 3)');
  check(ST.away(-9.5, 0, -9.5, 0, rd, 1, 0, true) && !ST.away(9.5, 0, 9.5, 0, rd, 1, 0, true), 'walking east: behind near the edge is cancelled, ahead at the same distance is kept');
  check(!ST.away(-3, 0, -3, 0, rd, 1, 0, true), 'walking: close behind is kept (the player may turn round)');
  check(!ST.away(8, 0, 11, 0, rd, 1, 0, true), 'flying: a column near the loading centre ahead is kept even when it is far from the player');
}

// ---- a world as in frame_cost.js: a fake pool collects the jobs; columns arrive when the test answers them ----
function makeWorld(takt) {
  const pool = { workers: [{ inflight: 0 }, { inflight: 0 }], queue: [], queueFar: [], submitted: [], submit(msg, tr, cb, prio) { this.submitted.push({ msg, cb, prio }); this.queue.push({ msg, cb, prio: prio || 0 }); this.queueDirty = true; }, pump() {}, broadcast() {}, direct() {}, queueDirty: false };
  const renderer = { freeSection() {}, uploadSection() {}, q: { vxLod: 48, upload: 3 } };
  const w = new V.World({ vents: null }, { dim: 'overworld', seed: 1, genOpts: {}, pool, renderer, renderDist: 6 });
  w.streamTakt = takt; w.streamMs = takt ? 1 : undefined;
  return { w, pool };
}
const stone = V.R.byName.stone.defaultState;
function genMsg(cx, cz) {
  const blocks = new Uint16Array(256 * 256), light = new Uint16Array(256 * 256);
  for (let i = 0; i < 256 * 64; i++) blocks[i] = stone;
  for (let i = 256 * 64; i < blocks.length; i++) light[i] = 0xf000;
  return { type: 'gen', cx, cz, blocks, light, biome: new Uint8Array(256), caveBiome: new Int8Array(256), grass: new Uint16Array(256), foliage: new Uint16Array(256), water: new Uint16Array(256) };
}

console.log('d · the arrivals');
{
  const { w, pool } = makeWorld(true);
  w.update(8, 70, 8, 1000);   // asks for the columns around the player
  const gens = pool.submitted.filter(j => j.msg.type === 'gen');
  check(gens.length >= 6, 'the world asks for columns', gens.length);
  // six answers land between two frames (six workers on a 16-thread machine)
  const six = gens.slice(0, 6).reverse();
  for (const j of six) j.cb(genMsg(j.msg.cx, j.msg.cz));
  check(w.cols.size === 0 && w.arrivals && w.arrivals.length === 6, 'they wait: nothing integrated in the message handler', `${w.cols.size} columns, ${w.arrivals ? w.arrivals.length : 0} waiting`);
  const keys = six.map(j => V.ckey(j.msg.cx, j.msg.cz));
  check(keys.every(k => w.pending.has(k)), 'their requests stay pending (the next scan does not ask again)');
  const before = pool.submitted.length;
  w.update(8, 70, 8, 1033);
  const asked = pool.submitted.slice(before).filter(j => j.msg.type === 'gen').map(j => V.ckey(j.msg.cx, j.msg.cz));
  check(!asked.some(k => keys.includes(k)), 'none of the waiting columns is asked for again');
  check(w.cols.size >= 1 && w.cols.size < 6, 'the frame integrates within its budget — at least one', `${w.cols.size} of 6 in the first frame (budget ${w.streamMs} ms)`);
  const firstIn = [...w.cols.values()][0];
  const dist = (c) => Math.hypot(c.cx, c.cz);
  check(six.every(j => Math.hypot(j.msg.cx, j.msg.cz) >= dist(firstIn) - 1e-9), 'the nearest first');
  let frames = 1; while (w.arrivals.length && frames < 20) { w.update(8, 70, 8, 1033 + 33 * frames); frames++; }
  check(w.arrivals.length === 0 && six.every(j => w.cols.has(V.ckey(j.msg.cx, j.msg.cz))), 'all six are in after a few frames', frames + ' frames');
  // an answer for a column the player has left far behind is dropped
  const { w: w2, pool: p2 } = makeWorld(true);
  w2.update(8, 70, 8, 1000);
  const g2 = p2.submitted.find(j => j.msg.type === 'gen');
  g2.cb(genMsg(g2.msg.cx, g2.msg.cz));
  w2.update(8 + 16 * 40, 70, 8, 1033);   // 40 chunks east in one jump
  check(!w2.cols.has(V.ckey(g2.msg.cx, g2.msg.cz)) && !w2.pending.has(V.ckey(g2.msg.cx, g2.msg.cz)), 'a column answered after the player left is dropped (and may be asked for again later)');
}

console.log('e · the queue follows the player');
{
  const { w, pool } = makeWorld(true);
  // queued generations on a line west–east (cx −7 … 7, cz 3), asked for with the player at the origin
  for (let cx = -7; cx <= 7; cx++) w.requestColumn(cx, 3, V.ckey(cx, 3), cx * cx + 9);
  // the player walks east 4 chunks (4.3 m/s: the loading centre stays at the player)
  for (let f = 1; f <= 450; f++) w.update(8 + f * 0.1433, 70, 8, 1000 + f * 33.3);
  pool.queue.sort((a, b) => a.prio - b.prio);
  const line = pool.queue.filter(j => j.msg.type === 'gen' && j.msg.cz === 3);
  const first = line.slice(0, 4).map(j => j.msg.cx);
  check(first.length === 4 && first.every(cx => cx >= 2 && cx <= 6), 'after the walk the first of them lie where the player is now (east)', first.join(' '));
  const cancelled = line.filter(j => j.msg.cancel && j.msg.cancel()).map(j => j.msg.cx);
  check(cancelled.includes(-7) && cancelled.includes(-4) && !cancelled.some(cx => cx >= 2), 'the ones left behind near the edge answer "cancel" when their turn comes, none ahead', cancelled.join(' '));
}

console.log('g · the seam light in the takt: the same light, spread over frames');
{
  // nine real town columns (Nova Haven, seed 4242): integrated once as before (the seam light at once) and once in the
  // takt (the seeds at the arrival, the spreading a little a frame), the same order; the light must be identical
  const gen = V.makeGen('overworld', 4242, { vgen: 8 });
  const cols = [];
  for (let cz = -7; cz <= -5; cz++) for (let cx = -1; cx <= 1; cx++) { const c = gen.generate(cx, cz); cols.push({ cx, cz, c, light: V.computeColumnLight(c.blocks, true) }); }
  const msgOf = (o) => ({ type: 'gen', cx: o.cx, cz: o.cz, blocks: o.c.blocks.slice(), light: o.light.slice(), biome: o.c.biome, caveBiome: o.c.caveBiome, grass: o.c.tints.grass, foliage: o.c.tints.foliage, water: o.c.tints.water });
  const order = cols.slice().sort((a, b) => Math.hypot(a.cx, a.cz + 6) - Math.hypot(b.cx, b.cz + 6));
  const { w: w0 } = makeWorld(false), { w: w1 } = makeWorld(true);
  for (const o of order) w0.onColumn(msgOf(o));
  let frames = 0, maxStep = 0, held = 0; const steps = [];
  for (const o of order) {
    w1.onColumn(msgOf(o));
    // a frame or two between arrivals, each spreading for at most 0.3 ms
    for (let k = 0; k < 2; k++) { const t = process.hrtime.bigint(); w1.seamStep(0.3); const ms = Number(process.hrtime.bigint() - t) / 1e6; steps.push(ms); maxStep = Math.max(maxStep, ms); frames++; if (w1.seamHold && w1.seamHold.size) held++; }
  }
  let rest = 0; while (w1.seamPending() && rest < 10000) { w1.seamStep(0.3); rest++; }
  let diff = 0, cells = 0;
  for (const o of order) { const a = w0.cols.get(V.ckey(o.cx, o.cz)).light, b = w1.cols.get(V.ckey(o.cx, o.cz)).light; for (let i = 0; i < a.length; i++) { cells++; if (a[i] !== b[i]) diff++; } }
  check(diff === 0, 'the light of nine town columns is identical cell for cell (seams spread over frames vs at once)', `${cells} cells, ${diff} differ; ${frames + rest} frames of spreading`);
  check(held > 0 && !w1.seamPending() && (!w1.seamHold || !w1.seamHold.size), 'while a seam spreads, the columns round it wait to be meshed; when it is done they may');
  steps.sort((a, b) => a - b);
  check(steps[steps.length >> 1] < 1.5, 'a frame\'s share of the spreading stays small (the median step; this shared machine adds GC and scheduling pauses)', `median ${steps[steps.length >> 1].toFixed(2)} ms, at most ${maxStep.toFixed(2)} ms (budget 0.3 ms, checked every 256 cells)`);
  // a player's block edit first finishes any seam still spreading (the edit's light update then works on settled light)
  const { w: w2 } = makeWorld(true);
  for (const o of order) w2.onColumn(msgOf(o));
  const pend = w2.seamPending();
  w2.setBlock(8, 120, -88, V.R.byName.stone.defaultState);
  check(pend && !w2.seamPending(), 'a block set while seams are spreading finishes them first');
  // the wait is bounded: in a burst of arrivals the queue may not empty for a while — a column waits at most
  // SEAM_HOLD frames from its first hold, then it is meshed anyway (a later light change remeshes it, as a neighbour does)
  const { w: w3 } = makeWorld(true);
  for (const o of order) w3.onColumn(msgOf(o));
  const k0 = V.ckey(order[0].cx, order[0].cz), f0 = w3.frame;
  const heldNow = w3.seamPending() && w3.seamHeld(k0);
  w3.frame = f0 + w3.SEAM_HOLD - 1; const heldLate = w3.seamHeld(k0);
  w3.frame = f0 + w3.SEAM_HOLD; const heldOver = w3.seamHeld(k0);
  check(heldNow && heldLate && !heldOver && w3.seamPending(), 'a column waits for a spreading seam at most SEAM_HOLD frames, even while the spreading goes on', `SEAM_HOLD ${w3.SEAM_HOLD}`);
}

console.log('f · off: as before');
{
  const { w, pool } = makeWorld(false);
  w.update(8, 70, 8, 1000);
  const g = pool.submitted.find(j => j.msg.type === 'gen');
  g.cb(genMsg(g.msg.cx, g.msg.cz));
  check(w.cols.has(V.ckey(g.msg.cx, g.msg.cz)) && !(w.arrivals && w.arrivals.length), 'without the takt a column is integrated in its message, as before');
  check(!w.pending.has(V.ckey(g.msg.cx, g.msg.cz)), 'and its request is done');
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

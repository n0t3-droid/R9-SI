// F-Far · ring 1 on the main thread (src/main/farring.js VR.FarRing), in node with a stub GL, pool and world:
//  a · switched on (High's 64 chunks), it asks the workers for the nearest forms first, a few per worker; off (0) or with
//      the horizon off it asks for nothing
//  b · a worker's answer waits in the world's upload queue (the F8 budget per frame covers every ring); run, it goes up
//      with a 300 ms fade, its bytes are booked; an empty answer is ready without an upload
//  c · a new world object (a dimension and back, a new game) takes the old upload queue with it: the forms that waited
//      in it are asked for again (dropQueued), the old queue's items upload nothing any more
//  d · a failed job rests 10 s before the tile is asked for again
//   bash test/wt_run.sh far_ring_main.js
const V = require('./load_shared.js');
require('../src/main/farring.js');
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
if (!V.FarRing) { console.log('VR.FarRing missing'); console.log('FAILED 1'); process.exit(1); }

// stubs: a GL that hands out objects, a pool that keeps the jobs, a world with an upload queue
const gl = new Proxy({}, { get: (o, k) => (k in o ? o[k] : (typeof k === 'string' && /^[A-Z_0-9]+$/.test(k) ? 1 : () => ({}))) });
const makeWorld = () => ({ renderDist: 14, uploadQ: { items: [], push(it) { this.items.push(it); } } });
const pool = { workers: [{}, {}], jobs: [], submit(msg, tr, cb, prio) { const j = { msg, prio, done: false }; j.cb = (m) => { j.done = true; cb(m); }; this.jobs.push(j); } };
const g = { world: makeWorld(), pool, renderer: { gl } };
const hz = { g, level: 4, bytes: 0, maskF: null, enabled: () => hzOn };
let hzOn = true;
const answer = (job, extra) => job.cb(Object.assign({ type: 'form', verts: new ArrayBuffer(48), idx: new Uint16Array(6), count: 6, big: false, minY: 60, maxY: 80, bx0: 0, bz0: 0, bx1: 64, bz1: 64, tris: 2 }, extra || {}));
const cam = { x: 8.5, y: 100, z: 8.5 };

console.log('a · asking');
const R = new V.FarRing(hz);
R.update(cam);
check(pool.jobs.length === 0, 'off by default (radius 0): nothing asked');
R.setRadius(64);
R.update(cam);
const maxIn = 2 + pool.workers.length * 2;
check(pool.jobs.length === maxIn && pool.jobs.every(j => j.msg.type === 'form' && j.msg.lane === 1 && j.msg.dim === 'overworld'), 'on: the first forms are asked for on the far lane, a few per worker', pool.jobs.length + ' jobs');
const d0 = pool.jobs.map(j => V.Far.tileDist(j.msg.tx, j.msg.tz, 0, 0)[0]);
check(d0.every((d, i) => i === 0 || d >= d0[i - 1] - 1e-9) && pool.jobs.every(j => j.msg.cell === V.Far.cellFor(V.Far.tileDist(j.msg.tx, j.msg.tz, 0, 0)[0])), 'nearest first, with the cell size of their distance', d0.map(d => d.toFixed(1)).join(' '));
R.update(cam);
check(pool.jobs.length === maxIn, 'no more while they are on their way');

console.log('b · answers and uploads');
const j0 = pool.jobs[0], t0 = R.set.tiles.get(V.Far.key(j0.msg.tx, j0.msg.tz));
answer(j0);
check(g.world.uploadQ.items.length === 1 && g.world.uploadQ.items[0].key === null && t0.state === 0, 'an answer waits in the world\'s upload queue', g.world.uploadQ.items.length + ' item');
R.update(cam);
check(pool.jobs.length === maxIn + 1, 'its slot asks for the next form');
g.world.uploadQ.items[0].run(); g.world.uploadQ.items.length = 0;
check(t0.state === 1 && t0.gpu && R.live.includes(t0) && R.set.bytes === 48 + 12 && t0.shownAt >= 0, 'run from the queue: on the GPU, its bytes booked, fading in', R.set.bytes + ' bytes');
const j1 = pool.jobs[1], t1 = R.set.tiles.get(V.Far.key(j1.msg.tx, j1.msg.tz));
j1.cb({ type: 'form', empty: true });
check(t1.state === 1 && !t1.gpu && g.world.uploadQ.items.length === 0, 'an empty answer is ready without an upload');

console.log('c · a new world object');
const j2 = pool.jobs[2], t2 = R.set.tiles.get(V.Far.key(j2.msg.tx, j2.msg.tz));
answer(j2);
const oldQ = g.world.uploadQ, item = oldQ.items[0];
check(item && t2.state === 0, 'a form waits in the old world\'s queue');
if (typeof R.dropQueued !== 'function') check(false, 'VR.FarRing.dropQueued missing');
else {
  g.world = makeWorld();
  R.dropQueued();
  const n0 = pool.jobs.length;
  R.update(cam);
  const again = pool.jobs.slice(n0).some(j => j.msg.tx === j2.msg.tx && j.msg.tz === j2.msg.tz);
  check(R.set.tiles.get(t2.key) !== t2 && again, 'the waiting form is asked for again', (pool.jobs.length - n0) + ' new jobs');
  item.run();
  check(!t2.gpu && t0.gpu && R.live.includes(t0), 'the old queue\'s item uploads nothing; the forms already up stay');
}

console.log('d · a failed job');
const jf = pool.jobs[pool.jobs.length - 1], tf = R.set.tiles.get(V.Far.key(jf.msg.tx, jf.msg.tz));
jf.cb({ type: 'error' });
check(tf.state === 2 && R.failed.includes(tf), 'a failed form rests');
const nf = pool.jobs.length;
R.update(cam);
check(!pool.jobs.slice(nf).some(j => j.msg.tx === jf.msg.tx && j.msg.tz === jf.msg.tz), 'not asked again at once');
for (const j of pool.jobs) if (!j.done) j.cb({ type: 'form', empty: true });   // (room in flight)
const nf2 = pool.jobs.length;
tf.failedAt -= 10001; R.update(cam);
check(pool.jobs.slice(nf2).some(j => j.msg.tx === jf.msg.tx && j.msg.tz === jf.msg.tz), 'asked again after 10 s');

console.log('e · off');
hzOn = false; R.update(cam);
check(R.set.tiles.size === 0 && R.live.length === 0, 'the horizon off (another dimension): ring 1 lets go of everything');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

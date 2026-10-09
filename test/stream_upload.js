// F10 · streaming without hitches on a weak GPU (src/shared/stream.js UploadScheduler, src/main/world.js, renderer.js
// staging, horizon.js): the owner's integrated GPU shares the system memory, and the frame that uploads a burst of meshes
// is the frame that hitches.
//  1 · measured cost: the byte budget comes from the measured cost per byte — a slower msPerByte halves the bytes per
//      frame; the calibration (gl.finish around 1 MB) and the fence fit (lag = a + b · bytes, polled at the next frames)
//      find a slow GPU that the CPU-side timing cannot see; the CPU side still raises it; the frame factor gives a slow
//      machine the same share of its frame; an overrun shrinks the budget, headroom restores it, an overrun without
//      uploads changes nothing; a forced frame's overspend is paid back; the hitch meter counts frames over 2x the
//      usual frame within 10 s
//  2 · packets: a 400 KB column through the real World and the renderer's staging (a recording GL) spends at most the
//      budget per frame and is shown only when complete; a remeshed section keeps its old mesh until the new one is in;
//      a newer mesh aborts the older; an unloaded column gives its staging back; the player's edit goes whole and first
//  3 · priority by view: in the view first (nearest first), beside, behind last; the ground under the player first;
//      a 90° turn re-sorts
//  4 · one budget: the far lane (horizon tiles, forms) gets its share while sections wait and all of it when they do not;
//      a burst of 50 tiles never exceeds the frame's bytes; horizon tiles wait in the queue with ring 1 off too
//  5 · cost: the drain is not slower than v042's (which built an object per item and two arrays a frame)
//   bash test/wt_run.sh stream_upload.js
const V = require('./load_shared.js');
const S = V.Stream;
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
const near = (a, b, rel) => Math.abs(a - b) <= Math.abs(b) * (rel || 1e-9) + 1e-12;
const MB = 1 << 20;
let seed = 4242; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

// a parted item: step(max) writes up to max bytes (whole 16-byte vertices), commit() when the last byte is up
const parted = (bytes, extra) => {
  const it = Object.assign({ bytes, x: 0, z: 0, wrote: [], committed: false, aborted: false }, extra || {});
  it.step = (max) => { const left = bytes - it.wrote.reduce((a, b) => a + b, 0); const b = Math.min(left, Math.floor(max / 16) * 16); if (b > 0) it.wrote.push(b); return b; };
  it.commit = () => { it.committed = true; };
  it.abort = () => { it.aborted = true; };
  return it;
};
const atomic = (bytes, extra) => { const it = Object.assign({ bytes, x: 0, z: 0, ran: false }, extra || {}); it.run = () => { it.ran = true; }; return it; };
const uploaded = (items) => items.reduce((a, it) => a + (it.wrote ? it.wrote.reduce((x, y) => x + y, 0) : it.ran ? it.bytes : 0), 0);

console.log('1 · measured cost');
{
  // a · bytes = ms / msPerByte: twice the cost per byte, half the bytes
  const a = new S.UploadScheduler({ msPerByte: 2e-6 }), b = new S.UploadScheduler({ msPerByte: 4e-6 });
  check(typeof a.budgetBytes === 'function' && near(b.budgetBytes(2.5), a.budgetBytes(2.5) / 2) && near(a.budgetBytes(2.5), 2.5 / 2e-6), 'a slower msPerByte halves the byte budget', a.budgetBytes && Math.round(a.budgetBytes(2.5)) + ' → ' + Math.round(b.budgetBytes(2.5)) + ' bytes');
  // the same through drain: one big mesh in parts, no clock (nothing measured): the bytes of one frame
  const ia = parted(8 * MB), ib = parted(8 * MB);
  a.push(ia); b.push(ib); a.drain(2.5); b.drain(2.5);
  const ua = uploaded([ia]), ub = uploaded([ib]);
  check(ua > 0 && Math.abs(ub - ua / 2) <= 16 && ua <= 2.5 / 2e-6, 'drain: a frame uploads budget ÷ msPerByte bytes, half of them at twice the cost', ua + ' vs ' + ub + ' bytes');
}
{
  // b · the calibration: 1 MB in 15 ms (a slow shared-memory path) — the estimate and the bytes follow it
  const s = new S.UploadScheduler({ msPerByte: 2e-6 });
  s.calibrate(15, MB);
  check(near(s.msPerByte, 15 / MB) && s.cal > 0, 'calibrate: 1 MB in 15 ms sets the cost per byte', s.msPerByte.toExponential(2));
  check(near(s.budgetBytes(3), 3 / (15 / MB), 1e-6), 'calibrate: 3 ms buy 205 KB on that machine (not 1.5 MB at the old constant)', Math.round(s.budgetBytes(3) / 1024) + ' KB');
  const f = new S.UploadScheduler({ msPerByte: 2e-6 }); f.calibrate(0.4, MB);
  check(f.budgetBytes(3) > s.budgetBytes(3) * 30, 'a fast machine (0.4 ms per MB) gets many times the bytes', Math.round(f.budgetBytes(3) / 1024) + ' KB');
}
{
  // c · the fence fit: a fake GPU whose lag is 40 ms of frame work + 2e-5 ms per byte (50 MB/s), seen only at the next
  // poll (a 16.7 ms grid with a random phase) with ±6 ms of noise; the calibration said 4x faster (an idle GPU)
  const bt = 2e-5, s = new S.UploadScheduler({ msPerByte: 3e-7 });
  s.calibrate(bt / 4 * MB, MB);
  const est0 = s.msPerByte;
  for (let k = 0; k < 400; k++) {
    const x = rnd() < 0.25 ? 0 : Math.round(20000 + rnd() * 400000);
    const done = 40 + bt * x + (rnd() - 0.5) * 12, phase = rnd() * 16.7;
    const lag = Math.ceil((done + phase) / 16.7) * 16.7 - phase;
    s.gpuSample(x, lag);
  }
  check(est0 < bt / 3 && Math.abs(s.msPerByte / bt - 1) < 0.3, 'fence fit: the slope of lag over bytes finds the slow GPU the calibration missed', (est0 / bt).toFixed(2) + 'x → ' + (s.msPerByte / bt).toFixed(2) + 'x of the true cost');
  // frames that all upload the same amount tell no slope: the estimate stays where it was
  const s2 = new S.UploadScheduler({ msPerByte: 3e-7 }); s2.calibrate(bt * MB, MB);
  for (let k = 0; k < 100; k++) s2.gpuSample(200000, 40 + 200000 * bt * 3 + (rnd() - 0.5) * 30);
  check(near(s2.msPerByte, bt, 0.05), 'fence fit: no spread in the volumes, no conclusion (the estimate holds)', (s2.msPerByte / bt).toFixed(2) + 'x');
  // the fit is held within ½ … 8x of the calibration: noise never takes the budget to nothing
  const s3 = new S.UploadScheduler({ msPerByte: 3e-7 }); s3.calibrate(1e-6 * MB, MB);
  for (let k = 0; k < 200; k++) { const x = rnd() < 0.5 ? 0 : 300000; s3.gpuSample(x, x ? 900 : 40); }
  check(s3.msPerByte <= 8e-6 + 1e-12 && s3.msPerByte > 4e-6, 'fence fit: held within 8x of the calibration', (s3.msPerByte / 1e-6).toFixed(2) + 'x');
}
{
  // d · the CPU side still counts: a JS-side copy measured slower than the calibration raises the estimate
  const s = new S.UploadScheduler({ msPerByte: 2e-6 }); s.calibrate(1, MB);
  let now = 0; const clock = () => now;
  for (let k = 0; k < 6; k++) { const it = atomic(100000); it.run = () => { now += 3; }; s.push(it); }
  s.drain(50, clock);
  check(s.msPerByte >= 2e-5, 'the CPU side raises the estimate toward 3 ms per 100 KB (from 1 ms per MB)', s.msPerByte.toExponential(2));
  // one call preempted by the system (4 ms for 50 KB) does not cap the budget for good: the next normal frames bring it back
  const p = new S.UploadScheduler({ msPerByte: 2e-6 }); p.calibrate(1, MB);
  let t = 0; const ck = () => t;
  const one = (ms) => { const it = parted(50000); const st = it.step; it.step = (m) => { t += ms; return st(m); }; p.push(it); p.drain(2, ck); };
  one(4);
  const spiked = p.msPerByte;
  for (let k = 0; k < 40; k++) one(0.02);
  check(spiked <= 4 * 9.6e-7 && p.msPerByte < 1.2e-6, 'a preempted call raises the estimate at most 4x, and normal frames bring it back', (spiked / 9.54e-7).toFixed(1) + 'x, then ' + (p.msPerByte / 9.54e-7).toFixed(2) + 'x');
}
{
  // e · the frame feedback: a steady 50 ms machine (the owner's Low), then overruns and headroom
  const s = new S.UploadScheduler({ msPerByte: 1e-6 });
  let t = 0;
  const up = () => { s.push(parted(1024)); s.drain(10); };
  for (let k = 0; k < 64; k++) s.frame(50, t += 50);
  check(near(s.medianMs, 50, 1e-6) && near(s.frameK, 1.5, 1e-6), 'a 50 ms machine: the median frame and the frame factor (the preset\'s ms are for 33.3 ms)', s.medianMs + ' ms, ×' + s.frameK);
  const b0 = s.budgetBytes(2);
  check(near(b0, 2 * 1.5 / 1e-6, 1e-9), 'the frame factor: Low\'s 2 ms become 3 ms of a 50 ms frame', Math.round(b0) + ' bytes');
  up(); s.frame(120, t += 120);
  check(near(s.scale, 0.5) && near(s.budgetBytes(2), b0 / 2, 1e-6), 'an overrun right after an upload halves the budget', 'scale ' + s.scale);
  up(); s.frame(120, t += 120); up(); s.frame(120, t += 120); up(); s.frame(120, t += 120);
  check(near(s.scale, S.SCALE_MIN), 'never below a quarter', 'scale ' + s.scale);
  let k = 0; while (s.scale < 1 && k < 40) { up(); s.frame(45, t += 45); k++; }
  check(s.scale === 1 && k <= 16, 'headroom restores it (+0.05 a good frame)', k + ' frames');
  for (let i = 0; i < 6; i++) s.frame(50, t += 50);
  s.frame(150, t += 150);
  check(s.scale === 1, 'an overrun with no upload in the last frames is not the uploads\' doing: unchanged', 'scale ' + s.scale);
  const fast = new S.UploadScheduler({ msPerByte: 1e-6 }); let t2 = 0;
  for (let i = 0; i < 64; i++) fast.frame(16.7, t2 += 16.7);
  check(fast.frameK === 1, 'a 60 fps machine keeps the preset\'s ms (frame factor 1)');
}
{
  // f · a forced frame's overspend is paid back: the player's edit (1 MB) goes whole over a 100 KB budget
  const s = new S.UploadScheduler({ msPerByte: 1e-6 }), budget = 100000 * 1e-6;
  const edit = parted(MB, { urgent: true }); s.push(edit);
  for (let i = 0; i < 30; i++) s.push(parted(50000, { x: 40 + i, z: 0 }));
  s.drain(budget);
  check(edit.committed && uploaded([edit]) === MB, 'the player\'s edit goes up whole in its frame');
  let quiet = 0;
  for (let f = 0; f < 30; f++) { const before = uploaded(s.items); const r = s.drain(budget); if (r.bytes === 0) quiet++; else break; void before; }
  check(quiet >= 8 && quiet <= 10, 'the overspend is paid back from the next frames (no burst after a burst)', quiet + ' frames without uploads');
  const r = s.drain(budget);
  check(r.bytes > 0 && r.bytes <= 100000, 'then the budget again', r.bytes + ' bytes');
}
{
  // g · the hitch meter: frames over 2x the usual frame in the last 10 s
  const s = new S.UploadScheduler({ msPerByte: 1e-6 });
  let t = 0;
  for (let k = 0; k < 64; k++) s.frame(50, t += 50);
  s.frame(90, t += 90); s.frame(120, t += 120); s.frame(50, t += 50); s.frame(130, t += 130);
  check(s.hitches(t) === 2, 'two frames over 100 ms (2 × the 50 ms median) are hitches, the 90 ms one is not', s.hitches(t));
  check(s.hitches(t + 9900) === 1 && s.hitches(t + 10001) === 0, 'they drop out after 10 s', s.hitches(t + 9900) + ' then ' + s.hitches(t + 10001));
  const f = new S.UploadScheduler({ msPerByte: 1e-6 }); let t2 = 0;
  for (let k = 0; k < 64; k++) f.frame(8, t2 += 8);
  f.frame(30, t2 += 30); f.frame(36, t2 += 36);
  check(f.hitches(t2) === 1, 'on a 120 fps machine a hitch is still a frame over 2 × 16.7 ms', f.hitches(t2));
}

console.log('3 · priority by view');
{
  // the camera at the origin looking along +z; the horizontal half field of view 53.7° (75° vertical at 16:9)
  const half = Math.atan(Math.tan(37.5 * Math.PI / 180) * 16 / 9), ch = Math.cos(half);
  const pts = { under: [5, -10], ahead: [0, 60], edge: [70, 60], rim: [80, 50], aheadFar: [30, 200], sideNear: [40, 0], side: [100, 10], behind: [0, -50], behindFar: [-20, -150] };
  const order = (vx, vz) => {
    const s = new S.UploadScheduler({ msPerByte: 1e-6 }), got = [];
    for (const k of Object.keys(pts)) { const it = atomic(100, { dx: pts[k][0], dz: pts[k][1] }); it.run = () => got.push(k); s.push(it); }
    s.drain(100, null, vx, vz, ch);
    return got.join(',');
  };
  check(typeof S.viewTier === 'function' && S.viewTier(0, 60, 0, 1, ch) === 0 && S.viewTier(100, 10, 0, 1, ch) === 1 && S.viewTier(0, -50, 0, 1, ch) === 2, 'tiers: in the view 0, beside 1, behind 2');
  check(S.viewTier && S.viewTier(5, -10, 0, 1, ch) === 0, 'the ground under the player (within 24 blocks) is tier 0 whatever the view');
  check(S.viewTier && S.viewTier(80, 50, 0, 1, ch) === 0 && Math.atan2(80, 50) > half, 'a column just outside the half angle but reaching into the view is in it (its width)');
  const o1 = order(0, 1);
  check(o1 === 'under,ahead,edge,rim,aheadFar,sideNear,side,behind,behindFar', 'looking +z: in the view nearest first, then beside, behind last', o1);
  const o2 = order(1, 0);
  check(o2 === 'under,sideNear,edge,rim,side,behind,ahead,aheadFar,behindFar', 'a 90° turn (looking +x) re-sorts the same queue', o2);
  // the same scheduler, items kept, turned between two frames: the order of the second frame follows the new view
  const s = new S.UploadScheduler({ msPerByte: 1e-6 }), got = [];
  for (const k of Object.keys(pts)) { const it = atomic(1000, { dx: pts[k][0], dz: pts[k][1] }); it.run = () => got.push(k); s.push(it); }
  s.drain(0.003, null, 0, 1, ch);      // three fit
  s.drain(0.003, null, 1, 0, ch);      // turned: the next three by the new view
  check(got.join(',') === 'under,ahead,edge,sideNear,rim,side', 'a turn between frames: the waiting columns are taken in the new order', got.join(','));
  // the player's own edit before everything, an upload in progress before the rest
  const s2 = new S.UploadScheduler({ msPerByte: 1e-6 }), seen = [];
  const big = parted(30000, { dx: 0, dz: 300 }), mine = atomic(500, { dx: 0, dz: -200, urgent: true });
  big.step0 = big.step; big.step = (m) => { seen.push('big'); return big.step0(m); }; mine.run = () => seen.push('edit');
  s2.push(big); s2.drain(0.01, null, 0, 1, ch);                 // big starts (10 000 bytes)
  const nearIt = atomic(100, { dx: 0, dz: 30 }); nearIt.run = () => seen.push('near'); s2.push(nearIt);
  s2.push(mine);
  s2.drain(0.01, null, 0, 1, ch);
  check(seen.join(',') === 'big,edit,big', 'the player\'s edit first, then the upload in progress continues before a new near column', seen.join(','));
}

console.log('4 · one budget for everything');
{
  // sections (near lane) and far tiles (far lane) wait together: the far lane gets 30 % of the bytes
  const s = new S.UploadScheduler({ msPerByte: 1e-6 });
  const secs = [], tiles = [];
  for (let i = 0; i < 20; i++) { const it = parted(100000, { dx: 20 + i, dz: 0 }); secs.push(it); s.push(it); }
  for (let i = 0; i < 20; i++) { const it = parted(30000, { lane: 1, prio: i * 0.1, x: 3000 }); tiles.push(it); s.push(it); }
  const r = s.drain(0.3);
  const ub = uploaded(secs), tb = uploaded(tiles);
  check(r.bytes <= 300000 && ub + tb === r.bytes, 'one frame: sections and tiles together within the 300 KB', r.bytes + ' bytes');
  check(tb >= 0.3 * 300000 - 16 && tb <= 0.3 * 300000 + 16, 'the far lane gets its 30 % while sections wait', tb + ' bytes of tiles');
  // the far lane in its own order: the horizon's priority (coarse and near first)
  check(tiles[0].committed && tiles[1].committed && uploaded([tiles[2]]) > 0 && tiles.slice(3).every(t => !t.wrote.length), 'the far lane follows the horizon\'s priority (coarse and near first)');
  // sections done: the far lane gets everything
  for (const it of secs) it.alive = () => false;
  const r2 = s.drain(0.3);
  check(r2.bytes > 290000 && uploaded(secs) === ub, 'with no section waiting the far lane gets the whole budget', r2.bytes + ' bytes');
  // the near lane takes what the far lane leaves
  const s2 = new S.UploadScheduler({ msPerByte: 1e-6 }), a = [];
  for (let i = 0; i < 10; i++) { const it = parted(100000, { dx: 30, dz: 0 }); a.push(it); s2.push(it); }
  const t1 = parted(20000, { lane: 1, prio: 0 }); s2.push(t1);
  const r3 = s2.drain(0.3);
  check(t1.committed && near(r3.bytes, 300000, 1e-3) && uploaded(a) >= 279000, 'the near lane gets what the far lane leaves', uploaded(a) + ' bytes of sections');
}
{
  // a burst: 50 tiles arrive at once; every frame stays within its bytes
  const s = new S.UploadScheduler({ msPerByte: 1e-6 }), tiles = [];
  for (let i = 0; i < 50; i++) { const it = atomic(40000 + (i % 7) * 9000, { lane: 1, prio: i * 0.01 }); tiles.push(it); s.push(it); }
  let worst = 0, frames = 0;
  while (s.size && frames < 200) { const r = s.drain(0.25); worst = Math.max(worst, r.bytes); frames++; }
  check(worst <= 250000 && tiles.every(t => t.ran), 'a burst of 50 tiles goes up within the frame\'s bytes', 'worst ' + worst + ' bytes, ' + frames + ' frames');
}
{
  // stale items are dropped without spending bytes, and their staging is given back
  const s = new S.UploadScheduler({ msPerByte: 1e-6 });
  const dead = parted(50000, { dx: 1, dz: 1 }); dead.alive = () => false;
  const live = parted(50000, { dx: 50, dz: 50 });
  s.push(dead); s.push(live);
  const r = s.drain(1);
  check(dead.aborted && uploaded([dead]) === 0 && live.committed && r.bytes === 50000, 'a stale item is aborted (its staging released) and costs nothing');
  const p = parted(10000); s.push(p);
  s.clear();
  check(p.aborted && s.size === 0, 'clear() aborts what waits (a world torn down)');
}

console.log('2 · packets: a column through the World and the renderer\'s staging');
global.window = undefined;
require('../src/main/gl.js'); require('../src/main/shaders.js'); require('../src/main/renderer.js');
global.Worker = class { constructor() { this.inflight = 0; } postMessage() {} terminate() {} };
global.Blob = class {}; global.URL = { createObjectURL: () => 'blob:x' };
require('../src/main/world.js');
// a GL that records what goes up (bytes per frame) and hands out buffers
let frameBytes = 0, bufId = 0;
const GLX = { ARRAY_BUFFER: 0x8892, ELEMENT_ARRAY_BUFFER: 0x8893, DYNAMIC_DRAW: 0x88e8, STATIC_DRAW: 0x88e4, UNSIGNED_SHORT: 0x1403, SHORT: 0x1402, UNSIGNED_BYTE: 0x1401, UNSIGNED_INT: 0x1405,
  createBuffer: () => ({ id: ++bufId }), deleteBuffer() {}, bindBuffer() {}, bufferData(t, d) { if (typeof d !== 'number') frameBytes += d.byteLength; },
  bufferSubData(t, off, d, so, len) { frameBytes += (len !== undefined ? len : d.length - (so || 0)) * d.BYTES_PER_ELEMENT; },
  createVertexArray: () => ({}), deleteVertexArray() {}, bindVertexArray() {}, enableVertexAttribArray() {}, vertexAttribPointer() {}, vertexAttribIPointer() {} };
const mkRenderer = () => { const r = Object.create(V.Renderer.prototype); Object.assign(r, { gl: GLX, arenas: [], arenaSize: 1 << 16, propSecs: new Set(), q: { upload: 0.05, vxLod: 48, shadowDist: 64 }, visDirty: false, shadowCam: null, stats: {} }); return r; };
const jobs = [];
const pool = { workers: [{ inflight: 0 }], queue: [], queueFar: [], submit(msg, tr, cb, prio) { jobs.push({ msg, cb, prio }); }, pump() {}, broadcast() {}, queueDirty: false };
const mkCol = (w, cx, cz, counts) => {
  const c = new V.Column(cx, cz);
  c.blocks = new Uint16Array(65536); c.light = new Uint16Array(65536); c.biome = new Uint8Array(256); c.caveBiome = new Int8Array(256);
  c.grass = new Uint16Array(256); c.foliage = new Uint16Array(256); c.water = new Uint16Array(256);
  for (let sy = 0; sy < 16; sy++) c.sec[sy].count = counts[sy] || 0;
  c.ready = true; w.cols.set(c.key, c); return c;
};
const verts = (bytes) => new Uint16Array(Math.round(bytes / 16) * 8);
const mesh = (o, cu, tr, vxFar) => ({ type: 'mesh', opaque: verts(o), cutout: verts(cu || 0), trans: verts(tr || 0), vx: null, vxFar: vxFar ? verts(vxFar) : null, props: null, vis: 0x7fff });
const answer = (sy, m) => { const i = jobs.findIndex(j => j.msg.sy === sy && !j.done); const j = jobs[i]; j.done = true; j.cb(m); return j; };
const used = (r) => r.arenas.reduce((a, ar) => a + ar.used, 0);
const cap96 = (n) => Math.ceil(n / 96) * 96;   // (the arenas hand out ranges in steps of 96 vertices)
{
  const r = mkRenderer();
  const w = new V.World({}, { dim: 'overworld', seed: 1, genOpts: {}, pool, renderer: r, renderDist: 6 });
  w.uploadQ.calibrate(1, 1e6);                       // 1e-6 ms per byte: the frame's 0.05 ms are 50 KB
  w._clk = () => 0;                                  // (the GL calls untimed: the machine's load must not move the budget here)
  check(typeof r.newStage === 'function' && typeof r.stagePart === 'function' && typeof r.commitStage === 'function' && typeof r.dropStage === 'function', 'the renderer stages a mesh in parts (newStage, stagePart, commitStage, dropStage)');
  // a column of 400 KB: four sections with meshes, twelve empty
  const counts = []; counts[3] = 900; counts[4] = 700; counts[5] = 500; counts[6] = 300;
  const c = mkCol(w, 0, 0, counts);
  for (let sy = 0; sy < 16; sy++) w.meshSection(c, sy, false, sy, [8, 64, 8]);
  const sizes = { 3: [150000, 20000, 0], 4: [100000, 0, 30000], 5: [60000, 0, 0], 6: [40000, 0, 0] };
  for (const sy of [3, 4, 5, 6]) answer(sy, mesh(...sizes[sy]));
  const total = 400000;
  check(w.uploadQ.size === 4 && c.shownAt < 0, 'four section meshes wait; the column is not shown', w.uploadQ.size + ' items');
  let frames = 0, worst = 0, sum = 0, shownEarly = false, drawnEarly = false;
  while (w.uploadQ.size && frames < 40) {
    frameBytes = 0; w.drainUploads(8, 8); frames++;
    worst = Math.max(worst, frameBytes); sum += frameBytes;
    if (w.uploadQ.size && c.shownAt >= 0) shownEarly = true;
    if (w.uploadQ.size) for (const sy of [3, 4, 5, 6]) if (c.sec[sy].mesh[0] && !c.sec[sy].meshed) drawnEarly = true;
  }
  check(worst <= 50000 && frames >= 8, 'every frame stays within its 50 KB (the 400 KB column takes ' + frames + ' frames)', 'worst ' + worst + ' bytes');
  check(Math.abs(sum - total) <= 64, 'all of it went up, once', sum + ' bytes');
  check(!shownEarly && !drawnEarly && c.shownAt >= 0, 'shown only when complete (no section drawn half-uploaded, the column\'s fade starts after the last)');
  check([3, 4, 5, 6].every(sy => c.sec[sy].meshed && c.sec[sy].hasMesh && c.sec[sy].mesh[0]) && c.sec[4].mesh[2] && !c.sec[5].mesh[1], 'each section has its layers', '');
  // a remeshed section keeps drawing its old mesh until the new one is in
  const u0 = used(r), old0 = c.sec[3].mesh[0];
  c.sec[3].ver++; w.meshSection(c, 3, false, 0, [8, 64, 8]);
  answer(3, mesh(160000, 20000, 0));
  frameBytes = 0; w.drainUploads(8, 8);
  check(frameBytes > 0 && c.sec[3].mesh[0] === old0 && used(r) > u0, 'a remesh in progress: the old mesh still draws, the new one is staged beside it', frameBytes + ' bytes staged');
  let k = 0; while (w.uploadQ.size && k < 40) { frameBytes = 0; w.drainUploads(8, 8); k++; }
  check(c.sec[3].mesh[0] !== old0 && c.sec[3].mesh[0].count === 10000 && used(r) - u0 === cap96(10000) - cap96(9375), 'committed: the new mesh draws, the old range is given back', 'arena ' + (used(r) - u0) + ' vertices more');
  // a newer mesh of the same section aborts the older one that is still going up
  const u1 = used(r);
  c.sec[4].ver++; w.meshSection(c, 4, false, 0, [8, 64, 8]);
  answer(4, mesh(200000, 0, 0));
  frameBytes = 0; w.drainUploads(8, 8);
  const mid = used(r);
  c.sec[4].ver++; w.meshSection(c, 4, false, 0, [8, 64, 8]);
  answer(4, mesh(80000, 0, 0));
  k = 0; while (w.uploadQ.size && k < 60) { frameBytes = 0; w.drainUploads(8, 8); k++; }
  check(mid > u1 && c.sec[4].mesh[0].count === 5000 && used(r) === u1 - cap96(6250) - cap96(1875) + cap96(5000), 'a newer mesh aborts the older one in progress: its staging is given back, only the newest goes in', 'arena ' + used(r) + ' (was ' + u1 + ')');
  // an unloaded column gives its staging back
  const u2 = used(r);
  const c2 = mkCol(w, 1, 0, { 2: 400, 3: 400 });
  for (let sy = 0; sy < 16; sy++) w.meshSection(c2, sy, false, sy, [8, 64, 8]);
  answer(2, mesh(120000)); answer(3, mesh(90000));
  frameBytes = 0; w.drainUploads(8, 8);
  const stagedC2 = used(r) - u2;
  w.unloadColumn(c2);
  frameBytes = 0; w.drainUploads(8, 8);
  check(stagedC2 > 0 && used(r) === u2 && frameBytes === 0 && w.uploadQ.size === 0, 'an unloaded column: what it had staged goes back, nothing more is uploaded for it', stagedC2 + ' vertices staged, then ' + (used(r) - u2));
  // the player's own edit goes up whole and first, even over the frame's bytes
  const c3 = mkCol(w, 0, 1, { 7: 300 });
  for (let sy = 0; sy < 16; sy++) w.meshSection(c3, sy, false, sy, [8, 64, 8]);
  answer(7, mesh(45000));
  c.sec[5].ver++; w.meshSection(c, 5, true, undefined, undefined, true);   // (hand: setBlock with 4 | SB_EDIT, below)
  answer(5, mesh(90000, 0, 0));
  frameBytes = 0; w.drainUploads(8, 8);
  check(c.sec[5].mesh[0] && c.sec[5].mesh[0].count === 90000 / 16 && frameBytes >= 90000 && c3.shownAt < 0, 'the player\'s edit (90 KB) goes up whole in its frame, before the waiting column', frameBytes + ' bytes this frame');
  k = 0; while (w.uploadQ.size && k < 20) { w.drainUploads(8, 8); k++; }
  // the player's edit reaches the mesher as `hand` (setBlock flags 4 | SB_EDIT), the simulation's (4 alone) does not
  {
    const seen = [], ms0 = w.meshSection;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (!w.col(10 + dx, 10 + dz)) mkCol(w, 10 + dx, 10 + dz, { 4: 10 });
    w.meshSection = (cc, sy, urgent, prio, pos, hand) => seen.push(!!urgent + '/' + !!hand);
    w.setBlock(168, 70, 168, V.R.byName.stone.defaultState, 4 | V.SB_EDIT);
    w.setBlock(169, 70, 168, V.R.byName.stone.defaultState, 4);
    w.meshSection = ms0;
    check(seen[0] === 'true/true' && seen[seen.length - 1] === 'true/false', 'setBlock: the player\'s edit (4 | SB_EDIT) is meshed as a hand edit, the simulation\'s (4) as urgent only', seen.join(' '));
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) w.cols.delete(V.ckey(10 + dx, 10 + dz));
  }
  // the world torn down: what waits is aborted
  const c4 = mkCol(w, -1, 0, { 4: 300 });
  for (let sy = 0; sy < 16; sy++) w.meshSection(c4, sy, false, sy, [8, 64, 8]);
  answer(4, mesh(100000));
  frameBytes = 0; w.drainUploads(8, 8);
  const u3 = used(r);
  w.destroy();
  check(w.uploadQ.size === 0 && used(r) < u3 && used(r) === 0, 'a world torn down: the queue is cleared and every range goes back', used(r) + ' vertices left');
}
{
  // the calibration: a 1 MB buffer, gl.finish before and after the upload (twice, the faster counts) — at world start
  const seq = [];
  const gl = Object.assign({}, GLX, { finish: () => seq.push('finish'), bufferData: (t, d) => seq.push('data ' + (typeof d === 'number' ? d : d.byteLength)), bufferSubData: (t, o, d) => seq.push('sub ' + d.byteLength) });
  const r = mkRenderer(); r.gl = gl;
  const cal = r.calibrateUploads ? r.calibrateUploads() : null;
  check(cal && cal.bytes === MB && cal.ms > 0 && seq.join(',') === 'data ' + MB + ',finish,sub ' + MB + ',finish,sub ' + MB + ',finish', 'calibrateUploads: 1 MB, finished before and after', seq.join(','));
  const w = new V.World({}, { dim: 'overworld', seed: 1, genOpts: {}, pool, renderer: r, renderDist: 6 });
  check(w.uploadQ.cal > 0, 'a new world asks for it and the scheduler starts from it');
  const r2 = mkRenderer();
  check(r2.calibrateUploads() === null, 'no finish (a stub GL): no calibration, the constant stands');
}
{
  // the fences: one at the end of a frame that uploaded, polled at the next frames with timeout 0, never more than four
  const waits = []; let pending = [], behind = 2;   // (behind: the polls until a new fence signals)
  const gl = Object.assign({}, GLX, { SYNC_GPU_COMMANDS_COMPLETE: 0x9117, TIMEOUT_EXPIRED: 0x911b, CONDITION_SATISFIED: 0x911c, ALREADY_SIGNALED: 0x911a, WAIT_FAILED: 0x911d,
    fenceSync: () => { const f = { polls: 0, after: behind }; pending.push(f); return f; }, deleteSync: (f) => { f.deleted = true; },
    clientWaitSync: (f, flags, timeout) => { waits.push(timeout); f.polls++; return f.polls >= f.after ? 0x911a : 0x911b; } });
  const r = mkRenderer(); r.gl = gl;
  const samples = [], Q = { last: { bytes: 0 }, gpuSample: (b, lag) => samples.push([b, lag]) };
  check(typeof r.upGauge === 'function', 'renderer.upGauge exists');
  let t = 0;
  const frame = (bytes) => { Q.last.bytes = bytes; Q.last.gauged = false; t += 50; r.upGauge(Q, t); };
  frame(100000);
  check(pending.length === 1 && samples.length === 0, 'a frame that uploaded sets a fence');
  frame(0); frame(0);
  check(samples.length === 1 && samples[0][0] === 100000 && samples[0][1] === 100 && pending[0].deleted, 'seen signalled two frames later: its bytes and its lag go to the fit', JSON.stringify(samples[0]));
  check(waits.every(x => x === 0), 'clientWaitSync with timeout 0 only (never blocking)', waits.join(','));
  behind = 1e9;   // a GPU far behind
  const n0 = pending.length;
  for (let k = 0; k < 10; k++) frame(50000);
  check(pending.filter(f => !f.deleted).length <= 4 && pending.length - n0 <= 4, 'never more than four fences pending', pending.filter(f => !f.deleted).length + ' pending');
  behind = 2; for (const f of pending) f.after = 0;
  frame(0);
  // a settled world: no fence at all (Very Low pays nothing when nothing streams)
  const p0 = pending.length;
  for (let k = 0; k < 400; k++) frame(0);
  const late = pending.length;
  for (let k = 0; k < 200; k++) frame(0);
  check(pending.length === late && late - p0 <= 40, 'a settled world sets no fence (only base-line ones within 120 frames of the last upload)', (late - p0) + ' base-line fences, then ' + (pending.length - late));
  const r3 = mkRenderer();
  check((() => { try { r3.upGauge(Q, 1); return true; } catch (e) { return false; } })(), 'no fences (a stub GL): nothing happens');
}
{
  // the mini-voxel detail (vxResidency) goes through the queue too: no more six uploads a frame outside any budget
  const r = mkRenderer();
  const w = new V.World({}, { dim: 'overworld', seed: 1, genOpts: {}, pool, renderer: r, renderDist: 6 });
  w.uploadQ.calibrate(1, 1e6); w._clk = () => 0;
  r.upQ = w.uploadQ;
  const secs = [];
  for (let i = 0; i < 8; i++) { const s = new V.Column(i, 0).sec[4]; s.ox = i * 16; s.oy = 64; s.oz = 0; s.mesh = [null, null, null, null, null]; s.vxData = verts(40000); s.hasMesh = true; secs.push(s); }
  frameBytes = 0;
  r.vxResidency(secs, [8, 70, 8]);
  check(frameBytes === 0 && w.uploadQ.size > 0 && secs.every(s => !s.mesh[3]), 'within the detail distance the detail waits in the queue (nothing uploaded in the draw)', w.uploadQ.size + ' queued');
  r.vxResidency(secs, [8, 70, 8]);
  const q1 = w.uploadQ.size;
  check(q1 === secs.filter(s => s.vxQ).length, 'asked once per section (not every frame again)', q1 + ' items');
  let worst = 0, k = 0;
  while (w.uploadQ.size && k < 30) { frameBytes = 0; w.drainUploads(8, 8); worst = Math.max(worst, frameBytes); r.vxResidency(secs, [8, 70, 8]); k++; }
  const up = secs.filter(s => s.mesh[3]);
  check(worst <= 50000 && up.length === q1 && up.every(s => s.mesh[3].count === 2500), 'within the frame\'s bytes, nearest first, each in place once complete', up.length + ' up, worst ' + worst + ' bytes');
  // a section that loses its detail while waiting gives its staging back
  const s = secs[secs.length - 1]; s.mesh[3] = null; s.vxData = verts(120000); s.vxQ = null;   // (more than a frame's bytes)
  r.vxResidency([s], [s.ox + 8, 70, 8]);
  frameBytes = 0; w.drainUploads(8, 8);
  const u = used(r);
  s.vxData = null;
  w.drainUploads(8, 8);
  check(used(r) < u && !s.vxQ && !s.mesh[3], 'its data dropped while it went up: the staged range is given back');
}
{
  // without the staging (a stub renderer, the tests' and the ships'): one item per section, run whole, as in v042
  const calls = [];
  const r = { q: { upload: 2.5, vxLod: 48 }, uploadSection: (s, c, sy, o) => calls.push(sy), freeSection() {} };
  const w = new V.World({}, { dim: 'overworld', seed: 1, genOpts: {}, pool, renderer: r, renderDist: 4 });
  const c = mkCol(w, 5, 5, { 1: 100 });
  for (let sy = 0; sy < 16; sy++) w.meshSection(c, sy, false, sy, [88, 30, 88]);
  answer(1, mesh(5000));
  w.drainUploads(88, 88);
  check(calls.length === 1 && calls[0] === 1 && c.shownAt >= 0, 'a renderer without staging: the section goes up whole (uploadSection), as before');
}

console.log('4b · horizon tiles and far forms in the same queue');
require('../src/main/horizon.js'); require('../src/main/farring.js');
{
  // ring 1 off (Very Low, Low, Balanced): a tile's mesh no longer goes up the moment the worker answers
  const sch = new S.UploadScheduler({ msPerByte: 1e-6 });
  const hjobs = [];
  const g = { world: { uploadQ: sch, renderDist: 6, dim: 'overworld' }, dim: 'overworld', renderer: { gl: GLX }, pool: { workers: [{}], submit(msg, tr, cb, prio) { hjobs.push({ msg, cb, prio }); }, broadcast() {} } };
  const hz = new V.Horizon(g); hz.setLevel(3);
  check(!hz.farOn(), 'ring 1 off');
  const tiles = [];
  for (let i = 0; i < 12; i++) { hz.request(1, i, 0, 300 + i * 50); tiles.push(hz.tiles.get(hz.key(1, i, 0))); }
  frameBytes = 0;
  for (const j of hjobs) j.cb({ type: 'lod', verts: new ArrayBuffer(36000), idx: new Uint16Array(6000), count: 6000, big: false, minY: 40, maxY: 90 });
  check(frameBytes === 0 && tiles.every(t => t.state === 0 && !t.vao) && sch.size === 12 && sch.items.every(r => r.lane === 1 && Number.isFinite(r.prio)), 'the twelve answers wait in the world\'s queue on the far lane, in the horizon\'s order', sch.size + ' items');
  let worst = 0, f = 0;
  while (sch.size && f < 20) { frameBytes = 0; sch.drain(0.1); worst = Math.max(worst, frameBytes); f++; }
  check(worst <= 100000 && tiles.every(t => t.state === 1 && t.vao) && hz.bytes === 12 * 48000, 'they go up within the frame\'s bytes (a burst never stalls a frame)', f + ' frames, worst ' + worst + ' bytes');
  // a tile the horizon let go of while it waited is dropped without an upload
  hz.request(1, 40, 0, 900);
  const t = hz.tiles.get(hz.key(1, 40, 0));
  hjobs[hjobs.length - 1].cb({ type: 'lod', verts: new ArrayBuffer(36000), idx: new Uint16Array(6000), count: 6000, big: false, minY: 40, maxY: 90 });
  hz.tiles.delete(hz.key(1, 40, 0));
  frameBytes = 0; sch.drain(1);
  check(frameBytes === 0 && !t.vao && sch.size === 0, 'a tile evicted while it waited costs nothing');
}
{
  // ring 1 (High, Ultra): the forms in the same far lane, with their priority
  const sch = new S.UploadScheduler({ msPerByte: 1e-6 });
  const fjobs = [];
  const g = { world: { uploadQ: sch, renderDist: 14 }, pool: { workers: [{}, {}], submit(msg, tr, cb, prio) { fjobs.push({ msg, cb, prio }); } }, renderer: { gl: GLX } };
  const hz = { g, level: 4, bytes: 0, maskF: null, enabled: () => true };
  const R = new V.FarRing(hz); R.setRadius(64); R.update({ x: 8.5, y: 100, z: 8.5 });
  for (const j of fjobs) j.cb({ type: 'form', verts: new ArrayBuffer(48000), idx: new Uint16Array(6000), count: 6000, big: false, minY: 60, maxY: 80, bx0: 0, bz0: 0, bx1: 64, bz1: 64, tris: 2000 });
  check(sch.size === fjobs.length && sch.items.every(r => r.lane === 1 && Number.isFinite(r.prio) && r.it.alive && r.it.alive()), 'the forms wait on the far lane with their priority', sch.size + ' items');
  let f = 0; while (sch.size && f < 20) { sch.drain(0.1); f++; }
  check(R.live.length === fjobs.length, 'and go up', R.live.length + ' forms');
}

console.log('4c · the block look\'s textures through the same queue');
{
  let texId = 0; const calls = [];
  const gl = Object.assign({}, GLX, { TEXTURE_2D_ARRAY: 0x8c1a, RGBA8: 0x8058, SRGB8_ALPHA8: 0x8c43, RGBA: 0x1908, NEAREST_MIPMAP_LINEAR: 0x2702, NEAREST: 0x2600, REPEAT: 0x2901, TEXTURE_MIN_FILTER: 0x2801, TEXTURE_MAG_FILTER: 0x2800, TEXTURE_WRAP_S: 0x2802, TEXTURE_WRAP_T: 0x2803,
    createTexture: () => ({ tex: ++texId }), deleteTexture: (t) => calls.push('del ' + t.tex), bindTexture() {}, texParameteri() {}, texParameterf() {},
    texStorage3D: (t, levels, fmt, w, h, d) => calls.push('storage ' + levels + ' ' + w + ' ' + d),
    texSubImage3D: (t, lv, x, y, z, w, h, d, f, ty, data, off) => { frameBytes += w * h * d * 4; if (off !== z * w * h * 4 || data.length < off + w * h * d * 4) calls.push('BAD ' + lv + ' ' + z); } });
  const r = mkRenderer(); r.gl = gl; r.texAlbedo = { tex: 'oldA' }; r.texMaterial = { tex: 'oldM' }; r.layers = 100;
  const sch = new S.UploadScheduler({ msPerByte: 1e-6 });
  const levels = (n) => { const out = []; for (let l = 0; l < 6; l++) out.push(new Uint8Array(((32 >> l) ** 2) * 4 * n)); return out; };
  const tex = { type: 'textures', size: 32, levels: 6, layers: 100, albedo: levels(100), material: levels(100) };
  check(typeof r.queueTextures === 'function', 'renderer.queueTextures exists');
  let done = 0;
  r.queueTextures(tex, sch, () => done++);
  sch.push(parted(30000, { dx: 5, dz: 5 }));   // a section waiting nearby: the textures come first
  let worst = 0, f = 0, oldUntil = 0;
  while (sch.size && f < 40) { frameBytes = 0; sch.drain(0.1); worst = Math.max(worst, frameBytes); f++; if (r.texAlbedo.tex === 'oldA') oldUntil = f; }
  const total = 2 * 100 * 4 * (1024 + 256 + 64 + 16 + 4 + 1);
  check(worst <= 100000 && done === 1 && f >= 10, 'a look\'s textures (' + (total / 1024).toFixed(0) + ' KB) go up within the frame\'s 100 KB', f + ' frames, worst ' + worst + ' bytes');
  check(oldUntil >= f - 1 && r.texAlbedo.tex !== 'oldA' && r.texMaterial.tex !== 'oldM' && calls.includes('del oldA') && calls.includes('del oldM'), 'the old look draws until the new arrays are complete, then they are swapped in and the old ones deleted');
  check(!calls.some(c => c.startsWith('BAD')) && calls.filter(c => c.startsWith('storage 6 32 100')).length === 2, 'every slice lands at its layers (srcOffset), full mip chains in new arrays', calls.filter(c => c.startsWith('BAD')).slice(0, 3).join(' '));
  // a newer set aborts the one in progress (its new arrays deleted); the newer one goes in
  const r2 = mkRenderer(); r2.gl = gl; r2.texAlbedo = { tex: 'A0' }; r2.texMaterial = { tex: 'M0' }; r2.layers = 100;
  const s2 = new S.UploadScheduler({ msPerByte: 1e-6 });
  let d1 = 0, d2 = 0;
  r2.queueTextures(tex, s2, () => d1++); s2.drain(0.1);
  const id1 = texId;
  r2.queueTextures(tex, s2, () => d2++);
  let k = 0; while (s2.size && k < 40) { s2.drain(0.1); k++; }
  check(d1 === 0 && d2 === 1 && calls.includes('del ' + id1) && calls.includes('del ' + (id1 - 1)) && r2.texAlbedo.tex > id1, 'a newer set aborts the one in progress: its arrays deleted, the newer one swapped in');
  // the world goes away (clear) before the set is complete: it is applied at once, so the look is never lost
  const r3 = mkRenderer(); r3.gl = gl; r3.texAlbedo = { tex: 'A3' }; r3.texMaterial = { tex: 'M3' }; r3.layers = 100;
  const s3 = new S.UploadScheduler({ msPerByte: 1e-6 });
  let d3 = 0;
  r3.queueTextures(tex, s3, () => d3++); s3.drain(0.1);
  s3.clear();
  check(d3 === 1 && r3.texAlbedo.tex !== 'A3', 'a set dropped with its world is finished at once (the new look is never lost)');
}

console.log('5 · cost: the drain against v042\'s');
// v042's scheduler, verbatim (src/shared/stream.js at a00fd82): the reference for the cost
class OldScheduler {
  constructor(opts) { this.items = []; this.msPerByte = (opts && opts.msPerByte) || 2e-6; this.last = null; }
  get size() { return this.items.length; }
  push(item) { this.items.push({ key: item.key, col: item.col, x: item.x, z: item.z, bytes: item.bytes || 0, dx: item.dx || 0, dz: item.dz || 0, run: item.run, age: 0 }); }
  prune(keep) { this.items = this.items.filter(it => keep(it)); }
  drain(budgetMs, clock, vx, vz) {
    const now = clock || (() => 0);
    const order = this.items.map((it) => ({ it, p: S.viewPrio(it.dx, it.dz, vx || 0, vz || 0) }));
    order.sort((a, b) => a.p - b.p);
    const keep = [];
    let spent = 0, ran = 0, forced = 0, blocked = false;
    for (const { it } of order) {
      if (blocked) { it.age++; keep.push(it); continue; }
      const est = it.bytes * this.msPerByte;
      if (spent + est > budgetMs + 1e-9) {
        if (spent === 0 && est > budgetMs && it.age >= 4) forced++;
        else { blocked = true; it.age++; keep.push(it); continue; }
      }
      const t0 = now();
      it.run();
      const ms = Math.max(0, now() - t0);
      spent += ms; ran++;
      if (it.bytes > 0) { const per = ms / it.bytes; this.msPerByte = per > this.msPerByte ? per : this.msPerByte * 0.8 + per * 0.2; }
    }
    this.items = keep;
    this.last = { ran, spentMs: spent, forced, left: keep.length };
    return this.last;
  }
}
(async () => {
  const { PerformanceObserver } = require('perf_hooks');
  let gcs = 0;
  // (minor collections only — scavenges are what allocation causes; V8's memory reducer may run a major one any time)
  const obs = new PerformanceObserver((list) => { for (const e of list.getEntries()) if ((e.detail ? e.detail.kind : e.kind) === 1) gcs++; });
  obs.observe({ entryTypes: ['gc'] });
  const tick = () => new Promise((res) => setImmediate(res));
  const cpuMs = (f, n) => { let best = 1e9; for (let r = 0; r < 5; r++) { const c0 = process.cpuUsage(); for (let i = 0; i < n; i++) f(i); const c1 = process.cpuUsage(c0); best = Math.min(best, (c1.user + c1.system) / 1000 / n); } return best; };
  // a world streaming in: 300 sections waiting around the camera, about a dozen fit a frame and as many new ones arrive.
  // Both schedulers get the same clock: every run takes its bytes × 1e-6 ms (so v042's learning keeps its estimate)
  let fake = 0; const clock = () => fake;
  const item = (k) => { const b = 30000 + (k % 13) * 4000; return { x: ((k * 37) % 400) - 200, z: ((k * 91) % 400) - 200, dx: ((k * 37) % 400) - 200, dz: ((k * 91) % 400) - 200, bytes: b, run() { fake += b * 1e-6; } }; };
  const fill = (sch) => { for (let i = 0; i < 300; i++) sch.push(item(i)); };
  let kNew = 1000, kOld = 1000;
  const streamNew = (sch) => { const before = sch.size; sch.drain(0.5, clock, 0.6, 0.8, 0.6); for (let i = sch.size; i < before; i++) sch.push(item(kNew++)); };
  const streamOld = (sch) => { const before = sch.size; sch.drain(0.5, clock, 0.6, 0.8); for (let i = sch.size; i < before; i++) sch.push(item(kOld++)); };
  const sNew = new S.UploadScheduler({ msPerByte: 1e-6 }), sOld = new OldScheduler({ msPerByte: 1e-6 });
  fill(sNew); fill(sOld);
  const tNew = cpuMs(() => streamNew(sNew), 400), tOld = cpuMs(() => streamOld(sOld), 400);
  console.log(`     a streaming frame (300 waiting, ~12 up): v042 ${(tOld * 1000).toFixed(1)} µs, now ${(tNew * 1000).toFixed(1)} µs (queue ${sOld.size} / ${sNew.size})`);
  check(tNew <= tOld * 1.1 && sOld.size === 300 && sNew.size === 300, 'the drain is not slower than v042\'s while the world streams in (Very Low: never slower)', (tNew / tOld).toFixed(2) + 'x');
  // a frame where nothing fits (the budget spent): the queue is only looked at (ages kept under the forced rule)
  const young = (sch) => { const a = sch.items; for (let i = 0; i < a.length; i++) a[i].age = 0; };
  const iNew = cpuMs(() => { sNew.drain(1e-9, clock, 0.6, 0.8, 0.6); young(sNew); }, 2000), iOld = cpuMs(() => { sOld.drain(1e-9, clock, 0.6, 0.8); young(sOld); }, 2000);
  console.log(`     a frame that waits (300 queued, none fits): v042 ${(iOld * 1000).toFixed(1)} µs, now ${(iNew * 1000).toFixed(1)} µs`);
  check(iNew <= iOld * 1.1 && sNew.size === 300 && sOld.size === 300, 'a waiting frame is not slower either', (iNew / iOld).toFixed(2) + 'x');
  // allocations: a queue that waits allocates nothing a frame — the heap does not grow over 20 000 frames (measured over a
  // loop no collection fell into: tried up to three times); v042's made an object per item and two arrays a frame
  let grow = Infinity;
  for (let tries = 0; tries < 3 && grow === Infinity; tries++) {
    await tick(); await tick(); gcs = 0;
    const h0 = process.memoryUsage().heapUsed;
    for (let i = 0; i < 20000; i++) { sNew.drain(1e-9, clock, 0.6, 0.8, 0.6); young(sNew); }
    const h1 = process.memoryUsage().heapUsed;
    await tick(); await tick();
    if (gcs === 0) grow = h1 - h0;
  }
  await tick(); await tick(); gcs = 0;
  for (let i = 0; i < 20000; i++) { sOld.drain(1e-9, clock, 0.6, 0.8); young(sOld); }
  await tick(); await tick();
  const gOld = gcs;
  obs.disconnect();
  check(grow < 65536 && gOld > 0, 'no allocation per frame: 20 000 waiting frames, the heap grew ' + (grow / 1024).toFixed(1) + ' KB (v042: ' + gOld + ' scavenges)');
  console.log(fails ? 'FAILED ' + fails : 'ALL OK');
  process.exit(fails ? 1 : 0);
})();

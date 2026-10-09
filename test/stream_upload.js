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
  check(s.msPerByte >= 3 / 100000 - 1e-12, 'the CPU side raises the estimate (3 ms for 100 KB)', s.msPerByte.toExponential(2));
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
  s2.push(atomic(100, { dx: 0, dz: 30 })); s2.items[s2.items.length - 1].run = () => seen.push('near');
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
  s.push(parted(10000)); const p = s.items[0];
  s.clear();
  check(p.aborted && s.size === 0, 'clear() aborts what waits (a world torn down)');
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

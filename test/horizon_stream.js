// F8 · Sichtweite, the pure parts (src/shared/stream.js): the soft mask edge between chunks and the far LOD tiles (no
// holes, no double pops), the 300 ms dithered fade-in, the upload scheduler (never over its budget, strict priority by
// view direction, a forced item only after it has waited), and the streaming rung under frame-time pressure.
//   bash test/wt_run.sh horizon_stream.js
const VR = require('./load_shared.js');
const S = VR.Stream;
let fails = 0;
const check = (name, ok, info) => { if (ok) console.log('ok    ' + name); else { fails++; console.log('FAIL  ' + name + (info ? '  ' + info : '')); } };
const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-9);

// ---- fade curve: 0 at the start, 1 after 300 ms, smooth and monotone
check('fade: 0 at t=0, 1 at 300 ms', S.fadeCurve(0) === 0 && S.fadeCurve(300) === 1);
check('fade: half way at 150 ms', near(S.fadeCurve(150), 0.5, 1e-9));
check('fade: clamped outside [0, 300]', S.fadeCurve(-40) === 0 && S.fadeCurve(9999) === 1);
{
  let mono = true, prev = -1;
  for (let t = 0; t <= 300; t += 2) { const f = S.fadeCurve(t); if (f < prev - 1e-12) mono = false; prev = f; }
  check('fade: monotone over 0..300 ms', mono);
}
check('fade: the default duration is 300 ms', S.FADE_MS === 300 && near(S.fadeCurve(75, 300), 0.15625, 1e-9));

// ---- the 4x4 ordered dither: the sixteen levels, period 4, mean 7.5/16 (the thresholds of the shaders)
{
  const seen = new Set(); let sum = 0, periodic = true, inRange = true;
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const t = S.bayer4(x, y); seen.add(Math.round(t * 16)); sum += t;
    if (t < 0 || t > 15 / 16) inRange = false;
    if (S.bayer4(x + 4, y) !== t || S.bayer4(x, y + 4) !== t) periodic = false;
  }
  check('bayer: sixteen distinct levels in a 4x4 tile', seen.size === 16);
  check('bayer: thresholds in [0, 15/16] and periodic with period 4', inRange && periodic);
  check('bayer: mean of the tile is 7.5/16', near(sum / 16, 7.5 / 16, 1e-9), String(sum / 16));
  check('bayer: the classic matrix (0,0)=0 (1,0)=8/16 (0,1)=12/16', S.bayer4(0, 0) === 0 && near(S.bayer4(1, 0), 0.5) && near(S.bayer4(0, 1), 0.75));
}

// ---- a chunk keeps a pixel iff its threshold is under the fade; the fade 1 keeps all, 0 keeps none
{
  let all1 = true, none0 = true;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { if (!S.chunkKeeps(1, x, y)) all1 = false; if (S.chunkKeeps(0, x, y)) none0 = false; }
  check('chunk: fade 1 keeps every pixel, fade 0 keeps none', all1 && none0);
  let cnt = 0; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (S.chunkKeeps(0.5, x, y)) cnt++;
  check('chunk: fade 0.5 keeps half of a 4x4 tile', cnt === 8, String(cnt));
}

// ---- the soft mask edge: the LOD's cut is min(bilinear, nearest) — never above the chunk's own fade
{
  let ok = true;
  for (let i = 0; i <= 40; i++) for (let j = 0; j <= 40; j++) {
    const n = i / 40, b = j / 40, c = S.lodCover(n, b);
    if (c > n + 1e-12 || c > b + 1e-12 || c < 0) ok = false;
  }
  check('cover: never above the nearest chunk fade, never above the bilinear value, never negative', ok);
  check('cover: clamps its inputs to [0, 1]', S.lodCover(2, 2) === 1 && S.lodCover(-1, 0.5) === 0);
}
// no holes: for every pixel, the chunk draws it or the LOD draws it — exhaustively for a grid of fades and blends
{
  let holes = 0, tested = 0;
  for (let i = 0; i <= 20; i++) for (let j = 0; j <= 20; j++) {
    const f = i / 20, bil = j / 20, cov = S.lodCover(f, bil);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const t = S.bayer4(x, y);
      const chunk = t < f, lod = !(t < cov);
      tested++;
      if (!chunk && !lod) holes++;
    }
  }
  check('no holes: chunk or LOD draws every pixel for every fade and blend (' + tested + ' cases)', holes === 0, 'holes ' + holes);
}
// through the GPU's bilinear read of a real 64x64 mask: a random fade pattern, random pixels, random positions
{
  let seed = 12345; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const N = 64, tex = new Uint8Array(N * N);
  for (let k = 0; k < N * N; k++) tex[k] = rnd() < 0.5 ? 255 : Math.floor(rnd() * 256);
  let holes = 0, tested = 0;
  for (let k = 0; k < 20000; k++) {
    const u = 20 + rnd() * 24, v = 20 + rnd() * 24;           // texel units (centres at i + 0.5)
    const f = tex[Math.floor(v) * N + Math.floor(u)] / 255;   // the chunk's own fade: its texel
    const cov = S.lodCover(f, S.maskSample(tex, N, u, v));
    const x = Math.floor(rnd() * 4), y = Math.floor(rnd() * 4), t = S.bayer4(x, y);
    tested++;
    if (!(t < f) && !(!(t < cov))) holes++;
  }
  check('no holes through the bilinear mask (' + tested + ' samples)', holes === 0, 'holes ' + holes);
}
// the soft edge is wide: one shown chunk next to an empty one → the transition spans about a chunk (16 blocks)
{
  const N = 64, tex = new Uint8Array(N * N); tex[32 * N + 32] = 255;   // one shown column at texel (32, 32)
  let prev = 2, mono = true, band = 0, last = null, first = null;
  for (let p = 32.5; p <= 33.5; p += 1 / 64) {              // from the shown texel's centre to the empty texel's centre
    const v = S.maskSample(tex, N, p, 32.5);
    if (v > prev + 1e-9) mono = false;
    prev = v;
    if (v > 0.05 && v < 0.95) { band += 1 / 64; if (first === null) first = p; last = p; }
  }
  check('edge: the transition is monotone', mono);
  check('edge: the shown texel reads 1 at its centre, the empty one 0', near(S.maskSample(tex, N, 32.5, 32.5), 1, 1e-9) && near(S.maskSample(tex, N, 33.5, 32.5), 0, 1e-9));
  check('edge: the soft band is at least 8 blocks wide (half a chunk)', band * 16 >= 8, 'band ' + (band * 16).toFixed(2) + ' blocks');
  check('edge: the half-way point sits on the chunk border (p = 33.0)', near(S.maskSample(tex, N, 33.0, 32.5), 0.5, 1e-9));
}

// ---- stream priority: the view direction counts; a chunk straight ahead comes before the same distance behind
{
  const ahead = S.viewPrio(0, 100, 0, 1), behind = S.viewPrio(0, -100, 0, 1), side = S.viewPrio(100, 0, 0, 1);
  check('prio: straight ahead is cheaper than straight behind at the same distance', ahead < behind);
  check('prio: ahead at 100 blocks beats behind at 60', S.viewPrio(0, 100, 0, 1) < S.viewPrio(0, -60, 0, 1));
  check('prio: the side sits between ahead and behind', side > ahead && side < behind);
  check('prio: without a view it is the plain distance', near(S.viewPrio(3, 4, 0, 0), 5));
}

// ---- the upload scheduler: never over budget, strict priority, forced item only after waiting
function run(budget, items, opts) {
  const sch = new S.UploadScheduler(opts || { msPerByte: 1e-3 });
  let now = 0; const clock = () => now;
  const order = [];
  for (const it of items) sch.push({ key: it.key, bytes: it.bytes, dx: it.dx, dz: it.dz, run: () => { order.push(it.key); now += it.bytes * (opts && opts.trueMsPerByte || 1e-3); } });
  const r = sch.drain(budget, clock, 0, 1);
  return { r, order, spent: now, left: sch.size, sch, clock, now: () => now };
}
{
  // 50 sections of 400 bytes at 0.4 ms each, budget 2 ms: five fit, the rest wait
  const items = []; for (let k = 0; k < 50; k++) items.push({ key: k, bytes: 400, dx: 16 + k, dz: 0 });
  const o = run(2.0, items);
  check('budget: never more than the budget (spent ' + o.spent.toFixed(3) + ' ms ≤ 2.0)', o.spent <= 2.0 + 1e-9);
  check('budget: five 0.4 ms uploads fit in 2 ms', o.r.ran === 5 && o.left === 45, 'ran ' + o.r.ran + ' left ' + o.left);
}
{
  // a budget of zero uploads nothing; a generous budget uploads everything
  check('budget: zero budget runs nothing', run(0, [{ key: 1, bytes: 400, dx: 0, dz: 1 }]).r.ran === 0);
  const items = []; for (let k = 0; k < 10; k++) items.push({ key: k, bytes: 100, dx: 10 + k, dz: 0 });
  check('budget: a big budget runs all', run(100, items).r.ran === 10);
}
{
  // strict priority: the order of the runs is the view priority order, and nothing behind a waiting item runs
  const items = [
    { key: 'behind', bytes: 400, dx: 0, dz: -60 },  // prio 132 (behind, view +z)
    { key: 'ahead', bytes: 400, dx: 0, dz: 100 },   // prio 100 (ahead)
    { key: 'near-side', bytes: 400, dx: 40, dz: 0 }, // prio 64 (side, 40 · 1.6)
    { key: 'far-ahead', bytes: 400, dx: 0, dz: 300 }, // prio 300
  ];
  const sch = new S.UploadScheduler({ msPerByte: 1e-3 });
  let now = 0; const clock = () => now; const order = [];
  for (const it of items) sch.push({ key: it.key, bytes: it.bytes, dx: it.dx, dz: it.dz, run: () => { order.push(it.key); now += 0.4; } });
  sch.drain(10, clock, 0, 1);
  // (F10: the columns in the view first, nearest first, then beside, behind last — v042 weighted the distance by the
  // angle instead and sent the near column at the side first: near-side, ahead, behind, far-ahead)
  check('priority: runs in view order (ahead, far-ahead in the view, then near-side beside, behind last)', order.join(',') === 'ahead,far-ahead,near-side,behind', order.join(','));
}
{
  // a big item that does not fit blocks the smaller ones behind it this frame (no overtaking), then runs next frame
  const sch = new S.UploadScheduler({ msPerByte: 1e-3 });
  let now = 0; const clock = () => now; const order = [];
  sch.push({ key: 'first', bytes: 1000, dx: 10, dz: 0, run: () => { order.push('first'); now += 1.0; } });
  sch.push({ key: 'small', bytes: 100, dx: 50, dz: 0, run: () => { order.push('small'); now += 0.1; } });
  const r1 = sch.drain(0.5, clock, 0, 1);
  check('priority: a head item that does not fit blocks the rest this frame', r1.ran === 0 && order.length === 0);
  const r2 = sch.drain(2.0, clock, 0, 1);
  check('priority: next frame the head runs first, then the small one', order.join(',') === 'first,small' && r2.ran === 2, order.join(','));
}
{
  // a single upload bigger than the whole budget is forced only after it waited four drains, and then it is reported
  const sch = new S.UploadScheduler({ msPerByte: 1e-2 });
  let now = 0; const clock = () => now; let ran = 0;
  sch.push({ key: 'huge', bytes: 500, dx: 0, dz: 5, run: () => { ran++; now += 5; } });
  let forcedAt = -1, forcedTotal = 0;
  for (let f = 1; f <= 6; f++) { const r = sch.drain(1.0, clock, 0, 1); if (r.forced && forcedAt < 0) forcedAt = f; forcedTotal += r.forced; }
  check('forced: an oversized item waits, then runs once (after four drains)', ran === 1 && forcedAt === 5, 'ran ' + ran + ' at drain ' + forcedAt);
  check('forced: the forced run is counted', forcedTotal === 1);
}
{
  // the estimate learns the real rate: a scheduler that starts with a wrong guess stays within budget after one item
  const sch = new S.UploadScheduler({ msPerByte: 1e-6 });   // far too optimistic
  let now = 0; const clock = () => now;
  for (let k = 0; k < 40; k++) sch.push({ key: k, bytes: 1000, dx: 20 + k, dz: 0, run: () => { now += 0.5; } });   // true cost 0.5 ms each
  let worst = 0;
  for (let f = 0; f < 30; f++) { const t0 = now; sch.drain(2.0, clock, 0, 1); worst = Math.max(worst, now - t0); }
  check('estimate: after learning, a frame never spends more than the budget plus one item (worst ' + worst.toFixed(2) + ' ms)', worst <= 2.0 + 0.5 + 1e-9);
  check('estimate: the rate moves toward the measured 0.5 ms per 1000 bytes', sch.msPerByte > 2e-4, String(sch.msPerByte));
}

// ---- streaming rung under frame-time pressure: the stream drops first, one rung at a time, never below one quarter
{
  const target = 16.7;
  let r = 0; r = S.streamRung(30, target, r); check('rung: a slow frame steps the stream down (0 → 1)', r === 1);
  r = S.streamRung(30, target, r); check('rung: a second slow window steps down again (1 → 2)', r === 2);
  r = S.streamRung(60, target, r); check('rung: the stream never goes below a quarter (stays at 2)', r === 2);
  r = S.streamRung(10, target, r); check('rung: a fine frame steps it back up (2 → 1)', r === 1);
  r = S.streamRung(16.9, target, 1); check('rung: frames near the target keep the rung (hysteresis)', r === 1);
  check('rung: the scale is 1, 1/2, 1/4', S.streamScale(0) === 1 && S.streamScale(1) === 0.5 && S.streamScale(2) === 0.25);
  check('rung: the scale is clamped', S.streamScale(9) === 0.25 && S.streamScale(-3) === 1);
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');

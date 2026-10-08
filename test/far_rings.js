// F-Far · the ring bookkeeping (src/shared/far.js): which ring a chunk column is in at a distance, which ring-1 tiles
// (4 x 4 columns) are wanted, kept and freed as the camera moves (promotion into ring 0, demotion out of it, the outer
// edge), the far mask's rule that every pixel is drawn by one ring at least and a settled column by exactly one, no
// allocation in a steady update, and the budget arithmetic (bytes in, bytes out, the cap, the farthest tile goes first).
//   bash test/wt_run.sh far_rings.js
const V = require('./load_shared.js');
const F = V.Far;
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
if (!F || !F.RingSet) { console.log('VR.Far.RingSet missing'); console.log('FAILED 1'); process.exit(1); }

console.log('a · which ring a column is in');
check(F.ringOf(0, 14, 64) === 0 && F.ringOf(14, 14, 64) === 0 && F.ringOf(14.5, 14, 64) === 0, 'ring 0 up to renderDist + 0.5 (the renderer\'s visible radius)');
check(F.ringOf(14.51, 14, 64) === 1 && F.ringOf(40, 14, 64) === 1 && F.ringOf(64.5, 14, 64) === 1, 'ring 1 from there out to r1 + 0.5');
check(F.ringOf(64.51, 14, 64) === 2 && F.ringOf(300, 14, 64) === 2, 'ring 2 beyond');
check(F.ringOf(20, 14, 0) === 2 && F.ringOf(3, 4, 0) === 0, 'without ring 1 (Very Low … Balanced): ring 0, then ring 2');
{ // every column of a square gets exactly one ring, and the rings are nested by distance
  let bad = 0, n = 0;
  for (let dz = -70; dz <= 70; dz++) for (let dx = -70; dx <= 70; dx++) {
    const d = Math.hypot(dx, dz), r = F.ringOf(d, 16, 64); n++;
    const exp = d <= 16.5 ? 0 : d <= 64.5 ? 1 : 2;
    if (r !== exp || ![0, 1, 2].includes(r)) bad++;
  }
  check(bad === 0, 'every column of a 141 × 141 square is in exactly one ring', n + ' columns');
}
const td = F.tileDist(0, 0, 0, 0);
check(td[0] === 0 && Math.abs(td[1] - Math.hypot(3, 3)) < 1e-9, 'tile distance: the camera\'s own tile spans 0 … √18 chunks', td.join(' … '));
check(F.cellFor(10) === 2 && F.cellFor(32) === 2 && F.cellFor(33) === 4, 'cells: 2 blocks within 32 chunks, 4 beyond');

console.log('b · the band of ring-1 tiles');
const S = new F.RingSet();
S.update(0, 0, 14, 64);
const wanted = S.wantedKeys();
let inner = 0, outer = 0, edge = 0;
for (const k of wanted) { const [tx, tz] = F.unkey(k), [dmin, dmax] = F.tileDist(tx, tz, 0, 0); if (dmax < 12) inner++; if (dmin > 64.5) outer++; if (dmin <= 14.5 && dmax >= 12) edge++; }
check(wanted.length > 100 && inner === 0 && outer === 0, 'wanted: no tile wholly inside ring 0 (all its columns < rd − 2), none beyond r1', wanted.length + ' tiles');
check(edge > 0, 'the tiles across the edge of ring 0 are wanted (the form is there before a chunk leaves)', edge + ' tiles');
const order = S.requestOrder();
let sorted = true; for (let i = 1; i < order.length; i++) if (F.tileDist(...F.unkey(order[i]), 0, 0)[0] < F.tileDist(...F.unkey(order[i - 1]), 0, 0)[0] - 1e-9) sorted = false;
check(order.length === wanted.length && sorted, 'requests go nearest first', order.length + ' in order');
check(F.bandTiles(14, 64) === wanted.length, 'bandTiles(rd, r1) counts the same band', F.bandTiles(14, 64));
// Very Low: no ring 1, no tiles at all
const S0 = new F.RingSet(); S0.update(0, 0, 4, 0);
check(S0.wantedKeys().length === 0 && S0.requestOrder().length === 0, 'r1 = 0 (Very Low): no tile is wanted');

console.log('c · promotion, demotion, the outer edge');
// tiles are created when asked for, then made ready (as the worker answers)
const T = new F.RingSet();
T.update(0, 0, 14, 64);
for (const k of T.requestOrder()) { const [tx, tz] = F.unkey(k); const t = T.add(tx, tz, F.cellFor(F.tileDist(tx, tz, 0, 0)[0])); T.ready(t, 1000); }
const n0 = T.tiles.size;
check(n0 === T.wantedKeys().length && T.bytes === n0 * 1000, 'every wanted tile made and ready; bytes summed', n0 + ' tiles, ' + T.bytes + ' bytes');
// the camera flies 40 chunks east: tiles behind it leave ring 1 (freed), tiles at the new centre come into ring 0
// (freed: promoted), tiles that were deep in ring 0 behind it are wanted again (demoted to ring 1)
T.update(40, 0, 14, 64);
const freed = T.freeList().slice(), asked = T.requestOrder().slice();
let farFreed = 0, innerFreed = 0, wrong = 0;
for (const t of freed) { const [dmin, dmax] = F.tileDist(t.tx, t.tz, 40, 0); if (dmin > 64.5 + 2) farFreed++; else if (dmax < 14 - 4) innerFreed++; else wrong++; }
check(farFreed > 0 && innerFreed > 0 && wrong === 0, 'freed: the tiles beyond r1 + 2 behind (out to ring 2) and the ones wholly inside ring 0 at the new centre (promoted)', farFreed + ' beyond, ' + innerFreed + ' inside ring 0');
let demoted = 0; for (const k of asked) { const [tx, tz] = F.unkey(k), d0 = F.tileDist(tx, tz, 0, 0); if (d0[1] < 12) demoted++; }
check(demoted > 0, 'asked: tiles that were deep inside ring 0 before are wanted again (demotion)', demoted + ' tiles');
for (const t of freed) T.free(t);
check(T.bytes === T.tiles.size * 1000, 'bytes follow the frees');
// hysteresis: a step back and forth by one chunk frees nothing that is still near the band
const H = new F.RingSet();
H.update(0, 0, 14, 64);
for (const k of H.requestOrder()) { const [tx, tz] = F.unkey(k); H.ready(H.add(tx, tz, 2), 10); }
H.update(1, 0, 14, 64); const f1 = H.freeList().length; H.update(0, 0, 14, 64); const f2 = H.freeList().length;
check(f1 === 0 && f2 === 0, 'hysteresis: one chunk back and forth frees no tile', f1 + ', ' + f2);
// a ring-0 change (the player sets the distance) moves the band
H.update(0, 0, 24, 64);
let inside = 0; for (const t of H.freeList()) { if (F.tileDist(t.tx, t.tz, 0, 0)[1] < 24 - 4) inside++; }
check(inside > 0 && inside === H.freeList().length, 'renderDist 14 → 24: the tiles now wholly inside ring 0 are freed', inside + ' tiles');

console.log('d · the far mask: every pixel drawn by one ring at least, a settled column by exactly one');
{
  let holes = 0, cases = 0, doubles = 0, settled = 0;
  const vals = [0, 0.25, 0.5, 0.75, 1];
  for (const nR of vals) for (const bR of vals) for (const nG of vals) for (const bG of vals) for (let k = 0; k < 16; k++) {
    const t = F.bayerLevels[k];
    const d = F.draws(t, nR, bR, nG, bG);
    cases++;
    if (!d.r0 && !d.r1 && !d.r2) holes++;
    if ((nR === 0 || nR === 1) && (nG === 0 || nG === 1) && bR === nR && bG === nG) { settled++; if ((d.r0 ? 1 : 0) + (d.r1 ? 1 : 0) + (d.r2 ? 1 : 0) !== 1) doubles++; }
  }
  check(holes === 0, 'no threshold of any fade combination is left undrawn', cases + ' cases');
  check(doubles === 0 && settled > 0, 'a settled column (fades 0 or 1) is drawn by exactly one ring', settled + ' cases');
  const a = F.draws(0.3, 1, 1, 1, 1), b = F.draws(0.3, 0, 0, 1, 1), c = F.draws(0.3, 0, 0, 0, 0);
  check(a.r0 && !a.r1 && !a.r2 && !b.r0 && b.r1 && !b.r2 && !c.r0 && !c.r1 && c.r2, 'ring 0 shown → only ring 0; form ready → only ring 1; nothing → ring 2');
  const m = F.draws(0.3, 0.5, 0.5, 1, 1), m2 = F.draws(0.7, 0.5, 0.5, 1, 1);
  check(m.r0 && !m.r1 && !m2.r0 && m2.r1, 'promotion: halfway through the chunk\'s fade, low thresholds show the chunk, high ones the form');
}

console.log('e · no allocation in a steady update');
{
  const R = new F.RingSet();
  R.update(5, -3, 16, 64);
  const a1 = R.requestOrder(), w1 = R.scanCount;
  let changed = 0;
  for (let i = 0; i < 2000; i++) if (R.update(5, -3, 16, 64)) changed++;
  check(changed === 0 && R.scanCount === w1, 'the same camera column: no rescan in 2000 frames', 'scans ' + R.scanCount);
  R.update(6, -3, 16, 64);
  check(R.requestOrder() === a1 && R.scanCount === w1 + 1, 'a new column: one rescan into the same arrays (no new array)');
  if (global.gc) {
    global.gc(); const h0 = process.memoryUsage().heapUsed;
    for (let i = 0; i < 20000; i++) R.update(6, -3, 16, 64);
    global.gc(); const h1 = process.memoryUsage().heapUsed;
    check(h1 - h0 < 64 * 1024, 'heap after 20000 steady updates within 64 KB', (h1 - h0) + ' bytes');
  }
}

console.log('f · budget arithmetic');
{
  const MB = 1048576;
  check(F.capBytes(4) === 192 * MB && F.capBytes(3) === 128 * MB && F.capBytes(0) === 0, 'the cap of the horizon levels (today\'s budget of High/Ultra: level 4 = 192 MB)');
  check(F.canAsk(10 * MB, 30 * MB, 50 * 1024, F.capBytes(4)) === true, 'room: 10 MB of forms + 30 MB of tiles under 192 MB');
  check(F.canAsk(150 * MB, 30 * MB, 50 * 1024, F.capBytes(4)) === false, 'full: 150 + 30 MB is over 92 % of the cap: no new form');
  const B = new F.RingSet();
  B.update(0, 0, 14, 64);
  for (const k of B.requestOrder()) { const [tx, tz] = F.unkey(k); B.ready(B.add(tx, tz, 2), 100000); }
  const before = B.bytes, ev = B.evictOver(before - 350000);
  check(ev.length === 4 && B.bytes === before - 400000, 'over the budget: the tiles go until it fits', ev.length + ' evicted');
  let farthest = true; const dmins = [...B.tiles.values()].map(t => F.tileDist(t.tx, t.tz, 0, 0)[0]); const kept = Math.max(...dmins);
  for (const t of ev) if (F.tileDist(t.tx, t.tz, 0, 0)[0] < kept - 1e-9) farthest = false;
  check(farthest, 'the farthest tiles go first');
  const n = F.bandTiles(14, 64), per = 40 * 1024;
  check(n * per < F.capBytes(4) / 2, 'arithmetic: the whole band at 40 KB a tile fits in half the cap', n + ' tiles × 40 KB = ' + (n * per / MB).toFixed(1) + ' MB');
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

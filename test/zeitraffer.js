// 📽 Zeitraffer — the recorder (src/main/zeit_rec.js) in node:
//  (a) packing: random changes (positions, states, kinds, dims, times, sky ticks) come back exactly; runs; sizes of a
//      filled box, a house-like plan and hand placements
//  (b) the recorder: hand changes within 40 ms are one batch, bulk edits one batch each, check-points rewrite the open
//      segment under its key, a sealed segment starts a new one, a new recorder of the same world continues after it
//  (c) the ring buffer: with small limits the oldest segments go; what is left is the newest changes, in order
//  (d) the persistence format: seg records {v, t0, t1, n, nb, dims, b} and idx records {t0, t1, n, bytes}
//  (e) the choke points in world.js: setBlock with VR.SB_EDIT (hand) and VR.SB_GUEST, bulkSet with a kind; an undo
//      batch mirrors its edit; flags without SB_EDIT and bulkSet without a kind record nothing
//  (f) cost: under 0.1 ms per recorded change on this thread (measured)
//  (g) scan / collect / timeline / start state: counts per column, the area's changes in order, idle gaps capped,
//      bursts spread, the land as it was = every change undone newest → oldest, forward again = the world now
//   bash test/wt_run.sh zeitraffer.js
const V = require('./load_shared.js');
global.Worker = class { postMessage() {} terminate() {} };
global.Blob = class { constructor(p) { this.parts = p; } };
global.URL = { createObjectURL: () => 'blob:fake' };
require('../src/main/world.js');
require('../src/main/zeit_rec.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const Z = V.ZeitRec;
if (!Z) { check(false, 'VR.ZeitRec exists (src/main/zeit_rec.js)'); console.log('FAILED ' + fails); process.exit(1); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
// a decoded segment list as flat rows: [t, kind, dim, ticks, x, y, z, old, new]
function rows(segs) {
  const out = []; let cur = null;
  for (const s of segs) Z.decode(s, { batch(t, kind, dim, ticks) { cur = [t, kind, dim, ticks]; }, change(x, y, z, o, n) { out.push(cur.concat([x, y, z, o, n])); } });
  return out;
}
let seed = 12345; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));

(async () => {
  // ---------------------------------------------------------------- (a) packing round trip
  {
    const W = new Z.Writer(1000), want = [];
    let t = 1000;
    for (let b = 0; b < 400; b++) {
      t += ri(0, 1) ? ri(0, 60) : ri(0, 9e9);   // seconds and months between batches
      const kind = ri(1, 6), dim = ['overworld', 'flat', 'realm'][ri(0, 2)], ticks = ri(0, 2399) * 10;
      W.batch(t, kind, dim, ticks);
      let x = ri(-524000, 524000), y = ri(0, 4000), z = ri(-524000, 524000), o = ri(0, 12000), n = ri(0, 12000);
      const k = ri(1, 40);
      for (let i = 0; i < k; i++) {
        const r = rnd();
        if (r < 0.4) { x++; } else if (r < 0.6) { x += ri(-3, 3); z += ri(-2, 2); } else { x = ri(-524000, 524000); y = ri(0, 4095); z = ri(-524000, 524000); }
        if (rnd() < 0.3) o = ri(0, 12426); if (rnd() < 0.3) n = ri(0, 12426);
        W.change(x, y, z, o, n); want.push([t, kind, dim, ticks, x, y, z, o, n]);
      }
    }
    const seg = W.record(7); const got = rows([seg]);
    const same = got.length === want.length && got.every((r, i) => r.every((v, j) => v === want[i][j]));
    check(same, 'random changes come back exactly: ' + want.length + ' changes in 400 batches (positions to ±524 000, y to 4095, states to 12 426, months between batches)');
    check(seg.v === 1 && seg.id === 7 && seg.t0 === 1000 && seg.t1 === t && seg.n === want.length && seg.nb === 400 && seg.b instanceof Uint8Array && Array.isArray(seg.dims), 'a segment record: v 1, id, t0, t1, n, nb, dims, bytes');
  }
  // sizes: a filled 32³ box (same block over air, row by row), a house-like plan, hand placements
  {
    const W = new Z.Writer(0); W.batch(5, Z.K.TOOL, 'overworld', 0);
    for (let y = 0; y < 32; y++) for (let z = 0; z < 32; z++) for (let x = 0; x < 32; x++) W.change(100 + x, 64 + y, -50 + z, 0, 77);
    const fill = W.record(1), fb = fill.b.length / 32768;
    check(fb < 0.5 && rows([fill]).length === 32768, 'a filled 32³ box packs to ' + fb.toFixed(3) + ' B per change (< 0.5) and comes back whole');
    check(fill.b.indexOf(8) >= 0, 'rows of the same block over the same ground are runs (op 8)');
    const H = new Z.Writer(0); H.batch(5, Z.K.PLAN, 'overworld', 0); let n = 0;
    for (let y = 0; y < 12; y++) for (let z = 0; z < 14; z++) for (let x = 0; x < 18; x++) { if (rnd() < 0.15) continue; H.change(x, 70 + y, z, rnd() < 0.7 ? 0 : 9, [3, 3, 3, 120, 121, 900, 4511][ri(0, 6)]); n++; }
    const house = H.record(2), hb = house.b.length / n;
    check(hb < 4, 'a house-like plan packs to ' + hb.toFixed(2) + ' B per change (< 4)');
    const P = new Z.Writer(0); let tt = 0;
    for (let i = 0; i < 200; i++) { tt += ri(150, 900); P.batch(tt, Z.K.HAND, 'overworld', 6000); P.change(ri(-20, 20), ri(60, 80), ri(-20, 20), 0, ri(1, 400)); }
    const hand = P.record(3), pb = hand.b.length / 200;
    check(pb < 16, 'a hand placement with its batch packs to ' + pb.toFixed(1) + ' B (< 16)');
  }

  // ---------------------------------------------------------------- (b) the recorder
  {
    const be = new Z.MemBackend();
    let now = 1e12;
    const r = new Z.Rec('wA', be, { checkMs: 30 }); r.now = () => now; r.ticks = () => 11230;
    // hand: two changes within 40 ms (a door's two halves) → one batch; 41 ms later → a new batch
    r.one(1, 70, 1, 0, 50, 'overworld', Z.K.HAND); now += 10; r.one(1, 71, 1, 0, 51, 'overworld', Z.K.HAND);
    now += 41; r.one(5, 70, 1, 0, 52, 'overworld', Z.K.HAND);
    // a guest's edit is its own batch (another kind), a bulk edit is one batch whatever its size
    now += 5; r.one(9, 70, 9, 0, 53, 'overworld', Z.K.GUEST);
    now += 5; r.begin(Z.K.TOOL, 'overworld'); for (let i = 0; i < 100; i++) r.add(i, 60, 0, 0, 3); r.end();
    now += 5; r.begin(Z.K.UNDO, 'overworld'); for (let i = 0; i < 100; i++) r.add(i, 60, 0, 3, 0); r.end();
    await sleep(80);   // the check-point (30 ms) writes the open segment
    let segs = await be.list('wA');
    check(segs.length === 1 && segs[0].n === 204 && segs[0].nb === 5, 'check-point: the open segment is written under its key (' + (segs[0] ? segs[0].n + ' changes, ' + segs[0].nb + ' batches' : 'none') + '; door halves one batch, bulk edits one batch each)');
    const R0 = rows(segs);
    check(R0[0][1] === Z.K.HAND && R0[1][0] === R0[0][0] && R0[2][0] === R0[0][0] + 51 && R0[3][1] === Z.K.GUEST && R0[4][1] === Z.K.TOOL && R0[104][1] === Z.K.UNDO && R0[0][3] === 11230, 'kinds, batch times and the sky ticks are kept');
    // more changes: the same key is rewritten (no second segment), then seal → the next change opens a new one
    now += 1000; r.one(2, 70, 2, 0, 60, 'overworld', Z.K.HAND); await r.flush();
    segs = await be.list('wA');
    check(segs.length === 1 && segs[0].n === 205, 'the next check-point rewrites the same segment (' + segs.length + ' segment, ' + (segs[0] && segs[0].n) + ' changes)');
    await r.seal(); now += 1000; r.one(3, 70, 3, 0, 61, 'overworld', Z.K.HAND); await r.flush();
    segs = await be.list('wA');
    check(segs.length === 2 && segs[1].id > segs[0].id && segs[1].n === 1, 'after a seal the next change opens a new segment with a later id');
    const snap = await r.snapshot();
    check(snap.length === 2 && rows(snap).length === 206, 'snapshot: everything recorded so far (' + rows(snap).length + ' changes)');
    // a new recorder of the same world (the next session) continues after the last segment
    await r.close();
    const r2 = new Z.Rec('wA', be, {}); r2.now = () => now - 5000;   // (a clock that went back: ids still grow)
    r2.one(4, 70, 4, 0, 62, 'overworld', Z.K.HAND); await r2.close();
    segs = await be.list('wA');
    check(segs.length === 3 && segs[2].id > segs[1].id && rows(segs).length === 207, 'a new recorder of the same world continues after it (ids grow even when the clock went back)');
    // the open segment is sealed when it reaches segBytes
    const r3 = new Z.Rec('wB', be, { segBytes: 2048, checkMs: 10000 }); r3.now = () => (now += 3);
    for (let i = 0; i < 600; i++) r3.one(ri(-999, 999), ri(1, 200), ri(-999, 999), ri(0, 999), ri(0, 999), 'overworld', Z.K.HAND);
    await sleep(20); await r3.idle();
    const sb = await be.list('wB');   // (sealed ones only: the open one waits for its check-point)
    await r3.close();
    const sb2 = await be.list('wB');
    check(sb.length >= 2 && sb.every(s => s.b.length >= 2048) && sb2.length === sb.length + 1 && rows(sb2).length === 600, 'a full segment (segBytes) is sealed by itself and a new one opened (' + sb.length + ' sealed of ' + sb.map(s => s.b.length).join(', ') + ' bytes; all 600 changes after close)');
  }

  // ---------------------------------------------------------------- (c) the ring buffer
  {
    const be = new Z.MemBackend();
    let now = 2e12;
    const r = new Z.Rec('wR', be, { segBytes: 4096, maxN: 10000, maxBytes: 1 << 30, checkMs: 1e9 }); r.now = () => (now += 7);
    const all = [];
    for (let b = 0; b < 1000; b++) { r.begin(Z.K.TOOL, 'overworld'); const x0 = ri(-200, 200); for (let i = 0; i < 100; i++) { const c = [x0 + i, 64 + (b % 50), b, b & 7, (b + 1) & 7]; r.add(...c); all.push(c); } r.end(); if (b % 10 === 9) await r.seal(); }
    await r.close();
    const idx = await be.idx('wR'), n = idx.reduce((a, e) => a + e[1].n, 0);
    const segs = await be.list('wR'), got = rows(segs).map(e => e.slice(4));
    const tail = all.slice(all.length - got.length);
    check(n <= 10000 && n >= 9000, 'over 10 000 changes the oldest segments go: ' + n + ' kept of ' + all.length);
    check(got.length === n && got.every((e, i) => e.every((v, j) => v === tail[i][j])), 'what is left is the newest changes, in order (a contiguous tail)');
    const r2 = new Z.Rec('wS', be, { segBytes: 4096, maxN: 1e9, maxBytes: 20000, checkMs: 1e9 }); r2.now = () => (now += 7);
    for (let b = 0; b < 300; b++) { r2.begin(Z.K.HAND, 'overworld'); for (let i = 0; i < 30; i++) r2.add(ri(-9e5, 9e5), ri(0, 4000), ri(-9e5, 9e5), ri(0, 12000), ri(0, 12000)); r2.end(); if (b % 20 === 19) await r2.seal(); }
    await r2.close();
    const bytes = (await be.idx('wS')).reduce((a, e) => a + e[1].bytes, 0);
    check(bytes <= 20000 && bytes > 10000, 'and over the byte limit too: ' + bytes + ' bytes kept (limit 20 000)');
    check(Z.LIMITS.maxN === 2000000 && Z.LIMITS.maxBytes === 20 * 1024 * 1024, 'the shipped limits: 2 M changes or 20 MB per world');
  }

  // ---------------------------------------------------------------- (d) the persistence format
  {
    const be = new Z.MemBackend();
    const r = new Z.Rec('wF', be, {}); r.now = () => 1700000000000; r.ticks = () => 6000;
    r.begin(Z.K.PLAN, 'flat'); r.add(10, 5, 10, 0, 33); r.add(11, 5, 10, 0, 33); r.end(); await r.close();
    const segs = await be.list('wF'), idx = await be.idx('wF'), s = segs[0];
    check(s && s.v === 1 && s.t0 === 1700000000000 && s.t1 === 1700000000000 && s.n === 2 && s.nb === 1 && s.dims.join() === 'flat' && s.b instanceof Uint8Array, 'seg record: {v:1, t0, t1, n, nb, dims, b}');
    check(idx.length === 1 && idx[0][0] === s.id && idx[0][1].n === 2 && idx[0][1].bytes === s.b.length && idx[0][1].t0 === s.t0, 'idx record: {t0, t1, n, bytes} under the same key');
    check(s.b[0] === 9, 'a segment starts with a batch (op 9)');
    await be.drop('wF');
    check((await be.list('wF')).length === 0 && (await be.idx('wF')).length === 0, 'drop() forgets a world\'s history (deleting the world)');
    check(Z.DB === 'r9si-history', 'the history has its own database: ' + Z.DB + ' (the worlds stay in r9si)');
  }

  // ---------------------------------------------------------------- (e) the choke points in world.js
  {
    const pool = { workers: [{}], submit() {}, pump() {}, busy: 0, queueDirty: false };
    const w = new V.World({}, { dim: 'overworld', seed: 1, pool, renderer: { freeSection() {} }, store: null });
    for (let cz = -1; cz <= 1; cz++) for (let cx = -1; cx <= 1; cx++) {
      const c = new V.Column(cx, cz); c.blocks = new Uint16Array(256 * 256); c.light = new Uint16Array(256 * 256).fill(0xf000);
      c.biome = new Uint8Array(256); c.grass = new Uint16Array(256); c.foliage = new Uint16Array(256); c.water = new Uint16Array(256);
      for (let i = 0; i < 256 * 60; i++) c.blocks[i] = 1;
      c.ready = true; w.cols.set(c.key, c);
    }
    const be = new Z.MemBackend(); const r = new Z.Rec('wW', be, { checkMs: 1e9 }); let now = 3e12; r.now = () => (now += 1);
    w.zr = r;
    check(typeof V.SB_EDIT === 'number' && typeof V.SB_GUEST === 'number' && V.EDIT && V.EDIT.UNDO === Z.K.UNDO && V.EDIT.PLAN === Z.K.PLAN, 'world.js exports VR.SB_EDIT, VR.SB_GUEST and VR.EDIT (= the recorder\'s kinds)');
    w.setBlock(3, 61, 3, 9, 1);                                   // a sim-like change (no SB_EDIT): not recorded
    w.setBlock(4, 61, 4, 9, 1 | V.SB_EDIT);                       // the player
    w.setBlock(4, 61, 4, 9, 1 | V.SB_EDIT);                       // no change: nothing
    w.setBlock(5, 61, 5, 7, 1 | V.SB_EDIT | V.SB_GUEST);          // a friend at the host
    w.bulkSet([[0, 62, 0, 5], [1, 62, 0, 5], [2, 62, 0, 1]], false);   // no kind: not recorded
    const list = [], undo = [];
    for (let x = -3; x <= 3; x++) for (let y = 62; y < 65; y++) { list.push([x, y, 7, 44]); undo.push([x, y, 7, w.getBlock(x, y, 7)]); }
    w.bulkSet(list, false, V.EDIT.TOOL);
    w.bulkSet(undo, false, V.EDIT.UNDO);
    const R = rows(await r.snapshot());
    check(R.length === 2 + 21 + 21, 'recorded: the player\'s change, the friend\'s, the fill and its undo — nothing else (' + R.length + ' changes)');
    check(R[0][1] === V.EDIT.HAND && R[0][4] === 4 && R[0][7] === 0 && R[0][8] === 9, 'setBlock with SB_EDIT records (x, y, z, old, new) as a hand change');
    check(R[1][1] === V.EDIT.GUEST && R[1][8] === 7, 'SB_GUEST marks a friend\'s edit');
    const fill = R.slice(2, 23), un = R.slice(23);
    check(fill.every(e => e[1] === V.EDIT.TOOL && e[7] === 0 && e[8] === 44), 'bulkSet with a kind records each changed cell once, with its old state');
    check(un.every((e, i) => e[1] === V.EDIT.UNDO && e[7] === fill[i][8] && e[8] === fill[i][7] && e[4] === fill[i][4] && e[5] === fill[i][5]), 'the undo batch mirrors the edit: old ↔ new, same cells');
    check(w.getBlock(0, 63, 7) === 0, '(the world itself is as before the fill)');
  }

  // ---------------------------------------------------------------- (f) cost per change
  {
    const be = new Z.MemBackend(); const r = new Z.Rec('wT', be, { checkMs: 1e9, segBytes: 1 << 30 }); r.now = () => 4e12;
    const N = 1000000, t0 = process.hrtime.bigint();
    r.begin(Z.K.PLAN, 'overworld');
    for (let i = 0; i < N; i++) r.add((i & 63) - 32, 64 + ((i >> 12) & 63), (i >> 6) & 63, (i * 7) & 4095, (i * 13) & 4095);
    r.end();
    const bulkMs = Number(process.hrtime.bigint() - t0) / 1e6;
    const M = 20000, t1 = process.hrtime.bigint();
    for (let i = 0; i < M; i++) r.one(i & 255, 70, i >> 8, 0, 5, 'overworld', Z.K.HAND);
    const handMs = Number(process.hrtime.bigint() - t1) / 1e6;
    const per = bulkMs / N, perH = handMs / M;
    console.log('    bulk ' + (per * 1000).toFixed(3) + ' µs per change (' + bulkMs.toFixed(0) + ' ms for 1 M), hand ' + (perH * 1000).toFixed(3) + ' µs per change; ' + (r.cur.w.len / (N + M)).toFixed(2) + ' B per change');
    check(per < 0.1 && perH < 0.1, 'recording costs < 0.1 ms per change on this thread (bulk ' + (per * 1000).toFixed(2) + ' µs, hand ' + (perH * 1000).toFixed(2) + ' µs)');
    await r.close();
  }

  // ---------------------------------------------------------------- (g) scan, collect, timeline, start state
  {
    const be = new Z.MemBackend(); let now = 5e12;
    const r = new Z.Rec('wG', be, { checkMs: 1e9 }); r.now = () => now;
    // a house at chunk (2,3) built by hand over 20 s, a tower at chunk (2,3)/(3,3) in one bulk, something far away and something in another dimension
    const world = new Map(), K = (x, y, z) => x + ',' + y + ',' + z, get = (x, y, z) => world.get(K(x, y, z)) || 0;
    const put = (kind, list) => { r.begin(kind, 'overworld'); for (const [x, y, z, s] of list) { r.add(x, y, z, get(x, y, z), s); world.set(K(x, y, z), s); } r.end(); };
    const before = new Map(world);
    for (let i = 0; i < 40; i++) { now += 500; const x = 34 + (i % 8), z = 50 + ((i >> 3) % 5); r.one(x, 70, z, get(x, 70, z), 20 + i, 'overworld', Z.K.HAND); world.set(K(x, 70, z), 20 + i); }
    now += 60 * 60 * 1000;   // an hour later
    const tower = []; for (let y = 0; y < 40; y++) for (let z = 48; z < 52; z++) for (let x = 44; x < 52; x++) tower.push([x, 71 + y, z, 300]);
    put(Z.K.PLAN, tower);
    now += 2000; put(Z.K.TOOL, [[900, 70, 900, 5], [901, 70, 900, 5]]);
    now += 2000; r.begin(Z.K.HAND, 'realm'); r.add(35, 70, 50, 0, 99); r.end();
    now += 1000; put(Z.K.UNDO, [[34, 70, 50, 0]]);   // the first block of the house taken back
    const segs = await r.snapshot();
    const sc = Z.scan(segs, 'overworld');
    check(sc.n === 40 + tower.length + 2 + 1 && sc.cols.get(V.ckey(2, 3)) > 0 && sc.cols.get(V.ckey(56, 56)) === 2 && !sc.cols.has(V.ckey(2, 3) + 99999), 'scan counts the changes per column of this dimension (' + sc.n + ', the realm left out)');
    const area = Z.pickArea(sc.cols, { loaded: (cx, cz) => Math.abs(cx) < 20 && Math.abs(cz) < 20, maxCols: 64, radius: 4 });
    check(area && area.keys.size >= 2 && area.keys.has(V.ckey(2, 3)) && area.keys.has(V.ckey(3, 3)) && !area.keys.has(V.ckey(56, 56)), 'pickArea: the busiest place among the loaded columns (' + (area ? [...area.keys].length + ' columns, centre ' + area.center.join(',') : 'none') + '), the far one left out');
    const C = Z.collect(segs, 'overworld', (cx, cz) => area.keys.has(V.ckey(cx, cz)));
    check(C.n === 40 + tower.length + 1 && C.nb === 40 + 1 + 1, 'collect: the area\'s changes in order (' + C.n + ' changes, ' + C.nb + ' batches)');
    const T = Z.timeline(C);
    const gaps = []; for (let b = 1; b < C.nb; b++) gaps.push(T.E[b] - T.E[b - 1]);
    check(gaps.slice(0, 39).every(g => Math.abs(g - 500) < 1e-6), 'timeline: hand placements keep their rhythm (500 ms apart)');
    const towerB = 40, hourGap = T.E[towerB] - T.E[towerB - 1];
    check(hourGap <= Z.TIME.gap + 1e-6, 'an hour of nothing becomes ' + hourGap + ' ms');
    const towerDur = T.E[towerB + 1] - T.E[towerB];
    check(towerDur >= tower.length * Z.TIME.per - 1e-6, 'the tower (one batch of ' + tower.length + ') is spread over ' + (towerDur / 1000).toFixed(1) + ' s of replay time');
    let mono = true; for (let i = 1; i < C.n; i++) if (T.at(i) < T.at(i - 1)) mono = false;
    check(mono && T.total > T.at(C.n - 1), 'replay times grow with every change; total ' + (T.total / 1000).toFixed(1) + ' s');
    const sp = Z.speedFor(T.total);
    check(Z.SPEEDS.includes(sp) && sp >= 10 && sp <= 1000, 'the default speed fits the whole replay into about half a minute: ×' + sp);
    // the land as it was: undo newest → oldest; forward again = the world now; back to the middle and forward again
    const grid = new Map(world), set = (x, y, z, s) => { if (s) grid.set(K(x, y, z), s); else grid.delete(K(x, y, z)); };
    Z.move(C, C.n, 0, set);
    const keep = (m) => [...m.entries()].filter(([k, v]) => { const [x, , z] = k.split(',').map(Number); return v && area.keys.has(V.ckey(x >> 4, z >> 4)); }).sort().join(';');
    check(keep(grid) === keep(before), 'start state: every recorded change undone newest → oldest = the land as it was');
    Z.move(C, 0, C.n, set);
    check(keep(grid) === keep(world), 'forward to the end = the world now');
    Z.move(C, C.n, 100, set); Z.move(C, 100, C.n, set);
    check(keep(grid) === keep(world), 'back to the middle and forward again = the world now');
    await r.close();
  }
  console.log(fails ? 'FAILED ' + fails : 'ALL OK');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('  ✗ crashed: ' + (e && e.stack || e)); console.log('FAILED ' + (fails + 1)); process.exit(1); });

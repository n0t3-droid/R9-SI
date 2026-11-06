// p-stream · the streaming plan (src/shared/stream.js VR.StreamPlan + world.js streamPlan), no browser:
//  a · worth: while moving fast a column is asked for only if it is still in the view cone when it is ready; the
//      columns round the player always; slow (walking, plain flight) everything as before
//  b · order: the old distance order, a column outside the view cone later
//  c · the far lane's share grows with the deficit (speed × latency against the render distance), 30 % while slow
//  d · far tiles behind the camera wait while moving fast
//  e · a simulated flight (the real World and WorkerPool, one simulated worker in virtual time: a generation 40 ms, a
//      section mesh 8 ms): at 20 and 40 m/s the plan shows more of the cone ahead and wastes fewer columns (generated and
//      dropped unseen) than the old way; at 80 m/s the chunks rest (as much real terrain, half the columns made: the far
//      tiles get the worker); walking at 5 m/s it is the old way exactly
//  f · a queued request no longer worth it is cancelled before a worker touches it
//  g · turning back: the columns just unloaded come from a small memory (no generation), with the same blocks and light
//   bash test/wt_run.sh stream_plan.js
const V = require('./load_shared.js');
global.window = undefined;
require('../src/main/gl.js'); require('../src/main/shaders.js'); require('../src/main/ultralite.js'); require('../src/main/renderer.js');
const SIM = { now: 0, workers: [] };
const COST = { gen: 40, mesh: 8, lod: 40 };
global.Worker = class {
  constructor() { this.jobs = []; this.end = 0; SIM.workers.push(this); }
  postMessage(m) { if (!m || !m.id) return; const t = Math.max(SIM.now, this.end) + (COST[m.type] || 5); this.end = t; this.jobs.push({ m, at: t }); }
  terminate() {}
};
global.Blob = class {}; global.URL = { createObjectURL: () => 'blob:x' };
require('../src/main/world.js');
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
const SP = V.StreamPlan;
if (!SP) { console.log('VR.StreamPlan missing'); console.log('FAILED 1'); process.exit(1); }
const cotH = 1 / Math.tan(54 * Math.PI / 180), cosH = Math.cos(54 * Math.PI / 180);

console.log('a · worth');
{
  // flying north (uz = -1) at 40 m/s with a latency of 1.5 s: the flight covers 3.75 chunks in that time
  const w = (ex, ez, sp, lat) => SP.worth(ex, ez, 0, -1, sp, lat, cotH);
  check(w(0, -8, 40, 1.5) && w(2, -7, 40, 1.5), 'ahead, near the flight line: worth it');
  check(!w(0, 6, 40, 1.5) && !w(-5, 3, 40, 1.5), 'behind and beside-behind: not worth it (the camera has left before it is ready)');
  check(!w(6, -1, 40, 1.5), 'far to the side just ahead: leaves the cone before it is ready');
  check(w(1, 1, 80, 3) && w(0, 1, 80, 3), 'the columns round the player: always');
  check(w(0, 6, 5, 1.5) && w(-5, 3, 11, 1.5), 'walking or plain flight (11 m/s): everything, as before');
  check(w(0, -4, 80, 0.2) && !w(0, -4, 80, 4), 'the latency decides: the same column ahead is worth it when the world is quick, not when it lags');
  check(SP.timeLeft(0, -8, 0, -1, 2.5, cotH) > SP.timeLeft(0, -4, 0, -1, 2.5, cotH), 'farther ahead stays longer in view');
}

console.log('b · order');
{
  const p = (ex, ez) => SP.prio(ex, ez, 0, -1, 3, cosH);
  check(p(0, -3) < p(3, 0) && p(3, 0) < p(-6, 0), 'ahead first; outside the cone later than an equal distance inside');
  check(SP.prio(3, 4, 0, -1, 0, cosH) === 25, 'standing (no look-ahead): plain distance², as before');
}

console.log('c · the far lane\'s share');
{
  check(SP.share(5, 2, 6) === SP.SHARE_BASE && SP.share(11, 2, 6) === SP.SHARE_BASE, 'walking / plain flight: 30 %, as before');
  check(SP.share(40, 1.5, 6) > SP.SHARE_BASE && SP.share(80, 1.5, 6) >= SP.share(40, 1.5, 6) && SP.share(80, 3, 4) === SP.SHARE_MAX, 'fast: more for the far tiles, the more the chunks lag behind', [SP.share(40, 1.5, 6), SP.share(80, 1.5, 6), SP.share(80, 3, 4)].map(x => x.toFixed(2)).join(' ≤ '));
  check(SP.lat(1, 3) > 1 && SP.lat(1, 3) < 3 && SP.lat(1, 100) <= SP.LAT_MAX && SP.lat(0, 0) >= SP.LAT_MIN, 'the latency: a smoothed average, clamped');
}

console.log('d · far tiles behind the camera');
{
  check(SP.tileK(0, 1000, 128, 0, 0, 0, -1, 40) > 0 && SP.tileK(0, -1000, 128, 0, 0, 0, -1, 40) === 0, 'flying north: a tile south waits, one north does not');
  check(SP.tileK(0, 1000, 128, 0, 0, 0, -1, 8) === 0 && SP.tileK(0, 50, 128, 0, 0, 0, -1, 40) === 0, 'slow, or the tile under the camera: no change');
}

// ---- the simulated flight
const stone = V.R.byName.stone.defaultState;
const BL = (() => { const b = new Uint16Array(256 * 256); for (let i = 0; i < 256 * 60; i++) b[i] = stone; return b; })();
const LI = (() => { const l = new Uint16Array(256 * 256); for (let i = 256 * 60; i < l.length; i++) l[i] = 0xf000; return l; })();
const reply = (m) => {
  if (m.type === 'gen') return { type: 'gen', id: m.id, ms: COST.gen, cx: m.cx, cz: m.cz, blocks: BL.slice(), light: LI.slice(), biome: new Uint8Array(256), caveBiome: new Int8Array(256), grass: new Uint16Array(256), foliage: new Uint16Array(256), water: new Uint16Array(256) };
  if (m.type === 'mesh') return { type: 'mesh', id: m.id, ms: COST.mesh, vis: 0x7fff, opaque: new Float32Array(8), cutout: null, trans: null, vx: null, vxFar: null, props: null };
  return { type: 'error', id: m.id, msg: 'sim' };
};
function fly(plan, speed, secs, rd) {
  SIM.now = 0; SIM.workers.length = 0;
  const pool = new V.WorkerPool('', 1);
  const renderer = { freeSection() {}, uploadSection() {}, q: { vxLod: 12, upload: 2 } };
  const w = new V.World({ vents: null }, { dim: 'overworld', seed: 1, genOpts: {}, pool, renderer, renderDist: rd });
  w.streamPlan = plan; w.viewDir = [0, -1]; w.viewCos = cosH;
  w.uploadQ.cpuEst = w.uploadQ.msPerByte = 1e-9;
  let wasted = 0; const uc = w.unloadColumn.bind(w); w.unloadColumn = (c) => { if (c.shownAt < 0) wasted++; uc(c); };
  let gens = 0; const oc = w.onColumn.bind(w); w.onColumn = (m) => { gens++; oc(m); };
  const step = (z) => {
    w.update(8, 100, z, SIM.now);
    for (const wk of SIM.workers) { while (wk.jobs.length && wk.jobs[0].at <= SIM.now) { const j = wk.jobs.shift(); wk.onmessage({ data: reply(j.m) }); } }
    SIM.now += 33.3;
  };
  for (let f = 0; f < 900; f++) step(8);   // 30 s at the start: the disk loaded
  let z = 8; const ttv = [], ent = new Map(); let real = 0, n = 0, missed = 0;
  const F = Math.round(secs * 30);
  for (let f = 0; f < F; f++) {
    z -= speed / 30; step(z);
    if (f % 3) continue;
    const pcz = Math.floor(z) >> 4, seen = new Set();
    for (let dz = -rd; dz <= 0; dz++) for (let dx = -rd; dx <= rd; dx++) {
      if (dx * dx + dz * dz > (rd + 0.5) * (rd + 0.5) || (Math.abs(dx) <= 1 && Math.abs(dz) <= 1)) continue;
      const ex = dx * 16, ez = (pcz + dz) * 16 + 8 - z, d = Math.hypot(ex, ez);
      if (-ez / d < cosH) continue;
      const k = V.ckey(dx, pcz + dz), c = w.cols.get(k), sh = !!(c && c.shownAt >= 0);
      seen.add(k); n++; if (sh) real++;
      const e = ent.get(k);
      if (e === undefined) ent.set(k, sh ? -1 : SIM.now); else if (e >= 0 && sh) { ttv.push(SIM.now - e); ent.set(k, -1); }
    }
    for (const [k, e] of ent) if (!seen.has(k)) { if (e >= 0) missed++; ent.delete(k); }
  }
  ttv.sort((a, b) => a - b);
  return { real: +(100 * real / Math.max(1, n)).toFixed(1), ttvMed: Math.round(ttv[ttv.length >> 1] || 0), shownN: ttv.length, missed, wasted, gens, lat: +(w.lat || 0).toFixed(2), share: pool.farShare };
}

console.log('e · a simulated flight on Low (render distance 6, one worker)');
{
  for (const sp of [20, 40, 80]) {
    const o = fly(false, sp, 20, 6), p = fly(true, sp, 20, 6);
    console.log(`     ${sp} m/s  old: ${JSON.stringify(o)}\n             plan: ${JSON.stringify(p)}`);
    // (at 80 m/s the flight crosses the render distance faster than a column is made: the chunks rest, the far tiles get
    // the worker — the real share stays what the old way managed, a few columns at the start)
    if (sp < 80) check(p.real > o.real, `${sp} m/s: more of the cone ahead is real terrain`, `${o.real} → ${p.real} %`);
    else check(p.real >= o.real - 0.5, `${sp} m/s: as much real terrain as the old way (it cannot keep up either)`, `${o.real} → ${p.real} %`);
    check(p.wasted < o.wasted || p.gens < o.gens, `${sp} m/s: fewer columns generated for nothing`, `wasted ${o.wasted} → ${p.wasted}, generated ${o.gens} → ${p.gens}`);
    check(p.share > SP.SHARE_BASE, `${sp} m/s: the far tiles get more of the worker`, p.share.toFixed(2));
  }
  const o = fly(false, 5, 20, 6), p = fly(true, 5, 20, 6);
  check(o.real === p.real && o.gens === p.gens && p.share === SP.SHARE_BASE, 'walking 5 m/s: exactly as before', `${o.real} / ${p.real} %, ${o.gens} / ${p.gens} columns`);
}

console.log('f · stale requests are cancelled');
{
  SIM.now = 0; SIM.workers.length = 0;
  const pool = new V.WorkerPool('', 1);
  const w = new V.World({ vents: null }, { dim: 'overworld', seed: 1, genOpts: {}, pool, renderer: { freeSection() {}, uploadSection() {}, q: { vxLod: 12, upload: 2 } }, renderDist: 6 });
  w.streamPlan = true; w.viewDir = [0, -1]; w.viewCos = cosH; w.lat = 0.8;
  // fly north fast (no worker answers): the motion is learnt; then a fresh set of requests ahead; then the flight turns south
  let z = 8; for (let f = 0; f < 16; f++) { z -= 60 / 30; SIM.now += 33; w.update(8, 100, z, SIM.now); }
  pool.queue.length = 0; w.pending.clear(); w.frame |= 1;
  z -= 2; SIM.now += 33; w.frame = (w.frame | 1) - 1; w.update(8, 100, z, SIM.now);
  const q = pool.queue.filter(j => j.msg.type === 'gen' && j.msg.cancel);
  const pz0 = Math.floor(z) >> 4;
  w.viewDir = [0, 1];
  for (let f = 0; f < 20; f++) { z += 60 / 30; SIM.now += 33; w.update(8, 100, z, SIM.now); }
  let cancelled = 0; const ahead = q.filter(j => j.msg.cz <= pz0);
  for (const j of ahead) if (j.msg.cancel()) cancelled++;
  check(ahead.length > 0 && cancelled === ahead.length, 'turned round at speed: the queued columns now behind are cancelled', `${cancelled} / ${ahead.length}`);
}

console.log('g · turning back: the columns just left come from memory (no generation), the same blocks and light');
{
  const run = (cacheN) => {
    SIM.now = 0; SIM.workers.length = 0;
    const pool = new V.WorkerPool('', 1);
    const w = new V.World({ vents: null }, { dim: 'overworld', seed: 1, genOpts: {}, pool, renderer: { freeSection() {}, uploadSection() {}, q: { vxLod: 12, upload: 2 } }, renderDist: 4 });
    w.viewDir = [0, -1]; w.viewCos = cosH; w.uploadQ.cpuEst = w.uploadQ.msPerByte = 1e-9;
    if (cacheN !== undefined) w.colCacheN = cacheN;
    let gens = 0, hits = 0, same = true;
    const oc = w.onColumn.bind(w); w.onColumn = (m) => { if (m.cached) { hits++; const r = reply({ type: 'gen', cx: m.cx, cz: m.cz }); for (let i = 0; i < r.blocks.length; i += 97) if (r.blocks[i] !== m.blocks[i] || r.light[i] !== m.light[i]) same = false; } else gens++; oc(m); };
    let z = 8;
    const step = () => { w.update(8, 100, z, SIM.now); for (const wk of SIM.workers) { while (wk.jobs.length && wk.jobs[0].at <= SIM.now) { const j = wk.jobs.shift(); wk.onmessage({ data: reply(j.m) }); } } SIM.now += 33.3; };
    for (let f = 0; f < 600; f++) step();
    for (let f = 0; f < 450; f++) { z -= 6 / 30; step(); }      // 90 blocks north at 6 m/s
    const g0 = gens;
    w.viewDir = [0, 1];
    for (let f = 0; f < 450; f++) { z += 6 / 30; step(); }      // and back
    for (let f = 0; f < 150; f++) step();
    return { back: gens - g0, hits, same, cache: w.colCache ? w.colCache.size : 0 };
  };
  const off = run(0), on = run();
  check(on.hits > 10 && on.back < off.back, 'the way back: columns from memory instead of the worker', `generated on the way back ${off.back} → ${on.back}, ${on.hits} from memory (cache ${on.cache})`);
  check(on.same, 'a column from memory has the blocks and the light a fresh generation gives');
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

// e-perf2 (docs/superpowers/plans/2026-10-30-e-perf2.md) · the hitch sources of a flight, budgeted per frame — no browser:
//  a · the clouds' shadow mask (Balanced+): built in slices of rows a frame (renderer.updateCloudShadow, clouds.js
//      shadowRows), the old mask read meanwhile — byte-identical to the mask built at once (and to v0.52.6's pinned hashes),
//      no frame's slice longer than its budget and a band
//  b · the seam light (every preset; before only Ultra · Leicht's takt): in play a column's arrival seeds its seams, the
//      spreading runs within World.seamMs a frame (seamStep) — the same light cell for cell as at once, no frame over the
//      budget and a check; on the loading screen and with seamMs 0 at once, as before
//  c · the cloud grid's step (renderer.updateClouds) without garbage: the order sorted as indices, the instances written into
//      a kept Float32Array — the same bytes as v0.52.6 (pinned) over a flight of 80 steps with a cover change
//   bash test/wt_run.sh perf2.js
const V = require('./load_shared.js');
global.window = undefined;
require('../src/main/gl.js'); require('../src/main/shaders.js'); require('../src/main/clouds.js'); require('../src/main/renderer.js');
require('../src/main/ultralite.js');
global.Worker = class { postMessage() {} terminate() {} }; global.Blob = class {}; global.URL = { createObjectURL: () => 'blob:x' };
require('../src/main/world.js');
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
const fnv = (u8) => { let h = 2166136261 >>> 0; for (let i = 0; i < u8.length; i++) { h ^= u8[i]; h = Math.imul(h, 16777619) >>> 0; } return h.toString(16); };
const ms = (f) => { const t = process.hrtime.bigint(); f(); return Number(process.hrtime.bigint() - t) / 1e6; };

console.log('a · the clouds\' shadow mask in slices');
{
  const C = V.Clouds, N = C.SHADOW.n;
  const views = [[0, 0, 0.5], [1234.5, -777.25, 0.35], [-5000, 2600.7, 0.8], [40.1, 9000, 0.6]];
  const pins = ['8e79e445', 'fd6de96e', '89aa4912', '833d0c8d'];   // (v0.52.6's shadowMask, the same views)
  check(views.every((v, i) => fnv(C.shadowMask(...v)) === pins[i]), 'the mask built at once: v0.52.6\'s bytes (four views, four covers)');
  let same = 0;
  for (const [cx, cz, cov] of views) {
    const o = new Uint8Array(N * N), acc = new Float32Array(N * N), memo = new Map();
    for (let j = 0; j < N; j += 8) C.shadowRows(cx, cz, cov, o, acc, j, j + 8, memo);
    if (fnv(o) === fnv(C.shadowMask(cx, cz, cov))) same++;
  }
  check(same === views.length, 'built in slices of eight rows: byte-identical', `${same}/${views.length}`);
  // the renderer: a flight of 200 frames at 0.5 blocks a frame over two cover changes; each new mask in slices
  const mk = (budget) => {
    const r = Object.create(V.Renderer.prototype), ups = [];
    r.gl = { R8: 1, RED: 2, UNSIGNED_BYTE: 3, LINEAR: 4, CLAMP_TO_EDGE: 5, TEXTURE_2D: 6, UNPACK_ALIGNMENT: 7, bindTexture() {}, pixelStorei() {}, texSubImage2D: (...a) => ups.push(fnv(a[8])) };
    r.q = { cloudShadow: 1, clouds: 2 }; r.stats = {}; r.csBudget = budget; r.ups = ups;
    return r;
  };
  V.GL.tex2D = () => ({});
  let a, centres, worst = 1e9;
  for (let rep = 0; rep < 3; rep++) {   // (the least worst frame of three flights: a loaded machine's spikes are not the code's)
  a = mk(1); centres = [];
  let wst = 0;
  for (let i = 0; i < 400; i++) {
    const E = { cloudDrift: [i * 0.3, 0.1 * i], time: i, cloudCover: i < 150 ? 0.45 : i < 300 ? 0.62 : 0.5, dimId: 0, sunDir: [0.3, 0.8, 0.2] }, cam = { x: 8 + i * 1.7, y: 100, z: -3 - i * 0.9 };
    const before = a.csAt;
    const t = ms(() => a.updateCloudShadow(E, cam)); if (i) wst = Math.max(wst, t);   // (the first mask: at once, as before)
    if (a.csAt !== before) centres.push(a.csAt.slice());
  }
  worst = Math.min(worst, wst);
  }
  // the reference: each mask the sliced renderer swapped in, built at once at the same centre and cover
  const ref = centres.map(([cx, cz, cov]) => fnv(C.shadowMask(cx, cz, cov)));
  check(a.ups.length === centres.length && a.ups.length >= 5 && a.ups.every((h, i) => h === ref[i]), 'every mask swapped in equals the mask built at once at its centre', `${a.ups.length} masks`);
  check(!!a.csJob === false || a.csJob.j < N, 'a slice build in progress keeps the old mask readable');
  // the cost a frame: the budget (1 ms) and one band at most (a loaded machine: × 4 margin on the band)
  const full = Math.min(...[0, 1, 2].map(() => ms(() => C.shadowMask(5, 5, 0.5))));
  const band = Math.min(...[0, 1, 2].map(() => ms(() => C.shadowRows(5, 5, 0.5, new Uint8Array(N * N), new Float32Array(N * N), 60, 68, null))));
  console.log(`    the mask at once ${full.toFixed(2)} ms · a band of 8 rows ${band.toFixed(2)} ms · the worst frame in slices ${worst.toFixed(2)} ms`);
  // b (at once, csBudget 0) for comparison: its worst frame is the whole mask
  const b = mk(0); let worstB = 0; for (let i = 0; i < 200; i++) { const E = { cloudDrift: [0, 0], time: i, cloudCover: 0.45, dimId: 0, sunDir: [0.3, 0.8, 0.2] }; const t = ms(() => b.updateCloudShadow(E, { x: i * 1.7, y: 100, z: 0 })); if (i) worstB = Math.max(worstB, t); }
  check(worst < worstB || worst <= 1 + 4 * band + 0.5, 'no frame of the flight pays for a whole mask', `${worst.toFixed(2)} ms in slices, ${worstB.toFixed(2)} ms at once`);
}

console.log('b · the seam light a little a frame');
{
  // 36 real columns of the flight's world (seed 53, the Heartland): one world integrates them in play with the budget,
  // one at once (seamMs 0); a frame (update) between arrivals, two arrivals a frame
  const gen = V.makeGen('overworld', 53, {});
  const msgs = [];
  for (let cz = 0; cz < 6; cz++) for (let cx = 0; cx < 6; cx++) { const c = gen.generate(cx, cz); msgs.push({ type: 'gen', cx, cz, blocks: c.blocks, light: V.computeColumnLight(c.blocks, true), biome: c.biome, caveBiome: c.caveBiome, grass: c.tints.grass, foliage: c.tints.foliage, water: c.tints.water }); }
  const copy = (m) => Object.assign({}, m, { blocks: m.blocks.slice(), light: m.light.slice() });
  const mkW = (state, seamMs) => {
    const pool = { workers: [{ inflight: 0 }], queue: [], queueFar: [], submit() {}, pump() {}, cancel() {} };
    const w = new V.World({ vents: null, state }, { dim: 'overworld', seed: 53, genOpts: {}, pool, renderer: { freeSection() {}, uploadSection() {}, nearShadow() {}, q: { vxLod: 48, upload: 3 } }, renderDist: 6 });
    if (seamMs !== undefined) w.seamMs = seamMs;
    return w;
  };
  // a tiny budget (one check of 256 cells a step) shows the slicing without timing a loaded machine
  const run = (ms0) => {
    const ref = mkW('play', 0), bud = mkW('play', ms0), load = mkW('loading');
    let queued = 0, steps = 0, maxCells = 0;
    for (let i = 0; i < msgs.length; i++) {
      ref.onColumn(copy(msgs[i])); load.onColumn(copy(msgs[i])); bud.onColumn(copy(msgs[i]));
      if (bud.seamPending()) queued++;
      if (i & 1) { const n = bud.seamStep(bud.seamBudget()); if (n) { steps++; maxCells = Math.max(maxCells, n); } }
    }
    while (bud.seamPending() && steps < 1e6) { maxCells = Math.max(maxCells, bud.seamStep(bud.seamBudget())); steps++; }
    let diff = 0, diffL = 0, cells = 0;
    for (const [k, c] of ref.cols) { const b2 = bud.cols.get(k), l = load.cols.get(k); for (let i = 0; i < c.light.length; i++) { cells++; if (b2.light[i] !== c.light[i]) diff++; if (l.light[i] !== c.light[i]) diffL++; } }
    return { queued, steps, maxCells, diff, diffL, cells, held: bud.seamHold ? bud.seamHold.size : 0, loadPending: load.seamPending() };
  };
  check(mkW('play').seamMs > 0 && mkW('play').seamMs <= 3 && mkW('loading').seamBudget() === undefined && mkW('play', 0).seamBudget() === undefined, 'the budget: 2 ms a frame in play; the loading screen and seamMs 0 at once', mkW('play').seamMs + ' ms');
  { const w = mkW('play'); w.frameDt = 1 / 60; const a = w.seamBudget(); w.frameDt = 0.05; const b = w.seamBudget(); w.frameDt = 0.5; const c = w.seamBudget(); check(a === 2 && Math.abs(b - 6) < 1e-9 && c === 12 && !w.streamTakt && w.SEAM_HOLD === 20, 'a share of the frame: 2 ms at 60 frames a second, 6 ms at 20, at most 12; a column waits ≤ 20 frames', [a, b, c].join(' / ') + ' ms'); }
  const r = run(1e-6);
  check(r.queued > 0 && !r.loadPending, 'in play the seams wait for the frame; on the loading screen they spread at once', `${r.queued} arrivals queued`);
  check(r.maxCells === 256, 'the spreading in slices (a step ends at its budget, checked every 256 cells)', `${r.steps} steps, at most ${r.maxCells} cells`);
  check(r.diff === 0 && r.diffL === 0 && r.cells > 1e6 && r.held === 0, 'the same light cell for cell (in slices, on the loading screen, at once); no column left held', `${r.cells} cells, ${r.diff} / ${r.diffL} differ`);
}

console.log('c · the cloud grid without garbage');
{
  const pins = { 1: [72, 1669488, 'b798c200'], 2: [72, 2711120, '9ba06d7d'] };   // (v0.52.6's updateClouds, the same flight)
  for (const q of [{ clouds: 1, horizon: 2 }, { clouds: 2, horizon: 4 }]) {
    const r = Object.create(V.Renderer.prototype); let h = 2166136261 >>> 0, n = 0, tot = 0;
    const datas = new Set();
    r.gl = { ARRAY_BUFFER: 1, DYNAMIC_DRAW: 2, bindBuffer() {}, bufferData: (t, d, u, off, len) => { datas.add(d.buffer); const b = new Uint8Array(d.buffer, d.byteOffset + (off || 0) * 4, len !== undefined ? len * 4 : d.byteLength); for (let i = 0; i < b.length; i++) { h ^= b[i]; h = Math.imul(h, 16777619) >>> 0; } n++; tot += b.length; } };
    r.q = q; r.cloudInst = {};
    for (let i = 0; i < 80; i++) r.updateClouds({ cloudDrift: [i * 0.7, i * 0.2], time: i, cloudCover: i < 40 ? 0.45 : 0.62 }, { x: 8 + i * 9.5, y: 100, z: -3 - i * 4.1 });
    const pin = pins[q.clouds], got = [n, tot, h.toString(16)];
    check(JSON.stringify(got) === JSON.stringify(pin), `clouds ${q.clouds}: the same instance bytes as v0.52.6 over 80 steps`, got.join(' · '));
    check(datas.size <= 2, `clouds ${q.clouds}: one kept array uploaded (grown at most once)`, datas.size + ' arrays for ' + n + ' grids');
  }
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

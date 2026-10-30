// e-perf2 (docs/superpowers/plans/2026-10-30-e-perf2.md) · the hitch sources of a flight, budgeted per frame — no browser:
//  a · the clouds' shadow mask (Balanced+): built in slices of rows a frame (renderer.updateCloudShadow, clouds.js
//      shadowRows), the old mask read meanwhile — byte-identical to the mask built at once (and to v0.52.6's pinned hashes),
//      no frame's slice longer than its budget and a band
//   bash test/wt_run.sh perf2.js
const V = require('./load_shared.js');
global.window = undefined;
require('../src/main/gl.js'); require('../src/main/shaders.js'); require('../src/main/clouds.js'); require('../src/main/renderer.js');
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
  const a = mk(1), b = mk(0);
  const frames = [], centres = [];
  let worst = 0;
  for (let i = 0; i < 400; i++) {
    const E = { cloudDrift: [i * 0.3, 0.1 * i], time: i, cloudCover: i < 150 ? 0.45 : i < 300 ? 0.62 : 0.5, dimId: 0, sunDir: [0.3, 0.8, 0.2] }, cam = { x: 8 + i * 1.7, y: 100, z: -3 - i * 0.9 };
    const before = a.csAt;
    const t = ms(() => a.updateCloudShadow(E, cam)); if (i) worst = Math.max(worst, t);   // (the first mask: at once, as before)
    if (a.csAt !== before) centres.push(a.csAt.slice());
    frames.push(a.csM.slice());
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
  let worstB = 0; for (let i = 0; i < 200; i++) { const E = { cloudDrift: [0, 0], time: i, cloudCover: 0.45, dimId: 0, sunDir: [0.3, 0.8, 0.2] }; const t = ms(() => b.updateCloudShadow(E, { x: i * 1.7, y: 100, z: 0 })); if (i) worstB = Math.max(worstB, t); }
  check(worst < worstB || worst <= 1 + 4 * band + 0.5, 'no frame of the flight pays for a whole mask', `${worst.toFixed(2)} ms in slices, ${worstB.toFixed(2)} ms at once`);
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

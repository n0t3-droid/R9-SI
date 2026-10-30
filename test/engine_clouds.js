// e-engine (docs/superpowers/plans/2026-10-30-e-engine.md) · the cloud grid (renderer.updateClouds) was computed anew
// whenever the camera crossed a 12-block cell: up to 129 × 129 cells × two noise octaves on the main thread — a 20–27 ms
// frame every ~0.6 s of a flight on the software GPU here (the engine bench's profile). Now each cell's noise is kept by
// its place, and a step computes the new row only.
//  1. the same instances (bytes equal) as the grid computed from nothing, over a flight of 60 steps, Very Low and Balanced
//     radii, with a cover change on the way
//  2. a step ≥ 1.5 × cheaper (2.4–5.7 × measured; the sort of the runs stays; best of 5 — the margin is for a loaded machine)
//   bash test/wt_run.sh engine_clouds.js
const V = require('./load_shared.js');
global.window = undefined;
require('../src/main/gl.js'); require('../src/main/shaders.js'); require('../src/main/renderer.js');
try { require('../src/main/clouds.js'); } catch (e) { /* the box threshold falls back */ }
let fail = 0;
const check = (ok, what, info) => { console.log((ok ? 'OK   ' : 'FAIL ') + what + (info !== undefined ? '  (' + info + ')' : '')); if (!ok) fail++; };
const mk = (q) => {
  const r = Object.create(V.Renderer.prototype);
  const out = [];
  r.gl = { ARRAY_BUFFER: 1, DYNAMIC_DRAW: 2, bindBuffer() {}, bufferData: (t, d) => out.push(new Uint8Array(d.buffer.slice(0))) };
  r.q = q; r.cloudInst = {}; r.out = out;
  return r;
};
const fnv = (u8) => { let h = 2166136261 >>> 0; for (let i = 0; i < u8.length; i++) { h ^= u8[i]; h = Math.imul(h, 16777619) >>> 0; } return h.toString(16); };
for (const [label, q] of [['Very Low', { clouds: 1, horizon: 0 }], ['Balanced', { clouds: 2, horizon: 4 }]]) {
  const a = mk(q), b = mk(q);
  let same = 0, n = 0;
  for (let i = 0; i < 60; i++) {
    const E = { cloudDrift: [i * 0.7, i * 0.2], time: i, cloudCover: i < 30 ? 0.45 : 0.6 }, cam = { x: 8 + i * 9.5, y: 100, z: -3 - i * 4.1 };
    b.cloudV = null;   // (the reference: from nothing, as before)
    a.updateClouds(E, cam); b.updateClouds(E, cam);
  }
  n = b.out.length;
  for (let i = 0; i < n; i++) if (a.out[i] && fnv(a.out[i]) === fnv(b.out[i])) same++;
  check(n > 20 && a.out.length === n && same === n, `${label}: the same cloud instances over a flight (${n} grids)`, `${same}/${n} equal`);
  // the cost of a step: warm (a neighbour cell) against from nothing
  const cost = (fresh) => { let best = 1e9; for (let r = 0; r < 5; r++) { const R = mk(q); R.updateClouds({ cloudDrift: [0, 0], time: 0, cloudCover: 0.5 }, { x: 0, y: 100, z: 0 }); const t0 = process.hrtime.bigint(); for (let i = 1; i <= 20; i++) { if (fresh) R.cloudV = null; R.updateClouds({ cloudDrift: [0, 0], time: 0, cloudCover: 0.5 }, { x: i * 12, y: 100, z: 0 }); } best = Math.min(best, Number(process.hrtime.bigint() - t0) / 1e6 / 20); } return best; };
  const old = cost(true), now = cost(false);
  check(now * 1.5 <= old, `${label}: a step of one cell ${old.toFixed(2)} → ${now.toFixed(2)} ms`, (old / now).toFixed(1) + ' ×');
}
console.log(fail ? `FAILED ${fail}` : 'ALL OK');
process.exit(fail ? 1 : 0);

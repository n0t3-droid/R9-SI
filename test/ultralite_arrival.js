// F9 · Weltgenerierung im Takt — what a generated column's arrival (world.onColumn) costs the main thread, for real
// Nova Haven columns (seed 4242, vgen 8, around the fork, in a walk's arrival order): the old way (the seam light with
// the neighbours at once) and in the takt (the seeds at the arrival, the spreading a little a frame — seamStep, 2 ms).
// Each column's time is the least of three runs (this shared machine adds GC and scheduling pauses). A measurement for
// the plan: it fails only if the two ways end in different light or the takt's heaviest arrival is heavier.
//   bash test/wt_run.sh ultralite_arrival.js
// regress: skip  (a measurement, slow: it generates 25 town columns and integrates them six times)
const V = require('./load_shared.js');
global.window = undefined;
require('../src/main/gl.js'); require('../src/main/shaders.js'); require('../src/main/ultralite.js'); require('../src/main/renderer.js');
global.Worker = class { constructor() { this.inflight = 0; } postMessage() {} terminate() {} };
global.Blob = class {}; global.URL = { createObjectURL: () => 'blob:x' };
require('../src/main/world.js');
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
const g = V.makeGen('overworld', 4242, { vgen: 8 });
const msgs = [];
const t0 = Date.now();
for (let cz = -8; cz <= -4; cz++) for (let cx = -2; cx <= 2; cx++) {
  const col = g.generate(cx, cz), light = V.computeColumnLight(col.blocks, true);
  msgs.push({ type: 'gen', cx, cz, blocks: col.blocks, light, biome: col.biome, caveBiome: col.caveBiome, grass: col.tints.grass, foliage: col.tints.foliage, water: col.tints.water });
}
console.log(`     generated and lit 25 columns in ${((Date.now() - t0) / 1000).toFixed(1)} s (the workers' share)`);
// the arrival order of a walk: nearest to the fork first
msgs.sort((a, b) => Math.hypot(a.cx, a.cz + 6) - Math.hypot(b.cx, b.cz + 6));
const copy = (m0) => Object.assign({}, m0, { blocks: m0.blocks.slice(), light: m0.light.slice() });   // (a seam light writes into the arrays)
const pool = { workers: [{ inflight: 0 }], queue: [], queueFar: [], submit() {}, pump() {}, broadcast() {}, direct() {} };
const mk = (takt) => { const w = new V.World({ vents: null }, { dim: 'overworld', seed: 4242, genOpts: {}, pool, renderer: { freeSection() {}, uploadSection() {}, q: { vxLod: 48 } }, renderDist: 8 }); w.streamTakt = takt; return w; };
const ms = (t) => Number(process.hrtime.bigint() - t) / 1e6;
const N = msgs.length, REP = 3;
const oldT = new Array(N).fill(Infinity), newT = new Array(N).fill(Infinity), stepT = new Array(N).fill(Infinity), spreadT = new Array(N).fill(Infinity);
let wOld = null, wNew = null, nSteps = 0;
for (let r = 0; r < REP; r++) {
  const a = mk(false), b = mk(true);
  msgs.forEach((m, i) => { const mm = copy(m); const t = process.hrtime.bigint(); a.onColumn(mm); oldT[i] = Math.min(oldT[i], ms(t)); });
  let steps = 0;
  msgs.forEach((m, i) => {
    const mm = copy(m); const t = process.hrtime.bigint(); b.onColumn(mm); newT[i] = Math.min(newT[i], ms(t));
    let worst = 0, all = 0;
    while (b.seamPending() && steps < 100000) { const t1 = process.hrtime.bigint(); b.seamStep(2); const s = ms(t1); worst = Math.max(worst, s); all += s; steps++; }
    stepT[i] = Math.min(stepT[i], worst); spreadT[i] = Math.min(spreadT[i], all);
  });
  nSteps = steps; wOld = a; wNew = b;
}
check(wOld.cols.size === N && wNew.cols.size === N, 'all 25 columns are integrated both ways', `${wOld.cols.size} / ${wNew.cols.size}`);
let diff = 0, cells = 0;
for (const [k, c] of wOld.cols) { const a = c.light, b = wNew.cols.get(k).light; if (a.length !== b.length) { diff += Math.abs(a.length - b.length); continue; } for (let i = 0; i < a.length; i++) { cells++; if (a[i] !== b[i]) diff++; } }
check(diff === 0, 'both ways end in the same light, cell for cell', `${cells} cells, ${diff} differ`);
const desc = (A) => A.slice().sort((x, y) => y - x), med = (A) => desc(A)[N >> 1], sum = (A) => A.reduce((s, x) => s + x, 0);
const O = desc(oldT), Nw = desc(newT), St = desc(stepT);
console.log(`     the old way: an arrival ${med(oldT).toFixed(1)} ms median, the heaviest ${O.slice(0, 3).map(x => x.toFixed(1)).join(' / ')} ms, all 25 ${sum(oldT).toFixed(0)} ms`);
console.log(`     in the takt: an arrival ${med(newT).toFixed(1)} ms median, the heaviest ${Nw.slice(0, 3).map(x => x.toFixed(1)).join(' / ')} ms, all 25 ${sum(newT).toFixed(0)} ms;`);
console.log(`                  the spreading ${sum(spreadT).toFixed(0)} ms in ${nSteps} steps of at most 2 ms, a column's longest step ${St[0].toFixed(1)} ms (median ${med(stepT).toFixed(1)})`);
check(Nw[0] <= O[0] * 1.05, 'the heaviest arrival is not heavier in the takt', `${Nw[0].toFixed(1)} vs ${O[0].toFixed(1)} ms`);
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

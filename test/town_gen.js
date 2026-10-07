// plans modern towns in node. Per town: the whole plan in one call (VG.plan: what a worker job used to run in one go)
// and, where the planner runs in slices (VG.planAdvance), the same plan built in SLICE ms turns, each turn a macrotask
// as in the worker (so the GC observer gets its entries between turns). Reported per town: the whole plan's time,
// the number of turns, the longest turn, and the longest turn without the garbage collector's pauses inside it
// (a pause is V8's, and happens whatever the planner does; the heap of this process holds every plan it made).
// Before/after: run it on the commit before the slices (no planAdvance) and on this tree.
//   usage: node test/town_gen.js   (env SEED, VGEN, N = towns, SLICE = ms per turn, default 20)
require('./load_shared.js');
const { PerformanceObserver, performance } = require('perf_hooks');
const VG = VR.VillageGen;
const seed = +(process.env.SEED || 424242), vgen = +(process.env.VGEN || 5);
const N = +(process.env.N || 3), SLICE = +(process.env.SLICE || 20);
const gcs = [];
new PerformanceObserver((list) => { for (const e of list.getEntries()) gcs.push([e.startTime, e.startTime + e.duration]); }).observe({ entryTypes: ['gc'] });
const gcIn = (t0, t1) => { let s = 0, mx = 0; for (const [a, b] of gcs) { const o = Math.min(b, t1) - Math.max(a, t0); if (o > 0) { s += o; mx = Math.max(mx, o); } } return s; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cpuMs = () => { const u = process.threadCpuUsage(); return (u.user + u.system) / 1000; };   // this thread's CPU
const mk = () => new VR.OverworldGen(seed >>> 0, { vgen });
const sum = (p) => JSON.stringify(VG.summary ? VG.summary(p) : [p.homes.length, p.lots.length, p.work.length]);

async function main() {
  const slicedRuns = [];
  const towns = [];
  { const g = mk(); for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) { const s = VG.site(g, i, j); if (s && s.style === 'modern') towns.push([i, j, s]); } }
  console.log('modern sites', towns.length, towns.slice(0, 6).map(([i, j, s]) => `${i},${j}@${s.x},${s.z}`).join(' '));
  for (const [i, j, s] of towns.slice(0, N)) {
    const g1 = mk();
    const w0 = performance.now();
    const plan = VG.plan(g1, s);
    const w1 = performance.now();
    const whole = w1 - w0;
    const kinds = {}; for (const w of plan.work) kinds[w.kind] = (kinds[w.kind] || 0) + 1;
    let ops = 0; for (const [, b] of plan.chunks) ops += b.o.length / 4;
    const fams = {}; for (const h of plan.homes) { const f = h.skin || '?'; fams[f] = (fams[f] || 0) + 1; }
    let line = `site ${i},${j} r=${s.rad} plan ${whole.toFixed(0)} ms homes ${plan.homes.length} lots ${plan.lots.length} work ${JSON.stringify(kinds)} skins ${JSON.stringify(fams)} chunks ${plan.chunks.size} ops ${ops}`;
    if (VG.planAdvance) {
      const g2 = mk();                       // the same town, built a turn at a time
      const turns = [];
      let p = null;
      while (!p) {
        await sleep(0);
        const t = performance.now(), c = cpuMs();
        p = VG.planAdvance(g2, s, SLICE);
        turns.push([t, performance.now(), cpuMs() - c]);
      }
      const total = turns.reduce((a, [t0, t1]) => a + (t1 - t0), 0);
      const cpuLongest = Math.max(...turns.map(x => x[2]));
      line += `\n     in turns of ${SLICE} ms: ${turns.length} turns, total ${total.toFixed(0)} ms, longest turn of CPU time ${cpuLongest.toFixed(1)} ms, same plan: ${sum(p) === sum(plan)}`;
      slicedRuns.push({ site: `${i},${j}`, turns });
    }
    console.log(line);
  }
  // the GC observer's entries reach us between macrotasks: attribute the pauses once they have all arrived
  await sleep(300);
  for (const { site, turns } of slicedRuns) {
    let longest = 0, longestNoGc = 0, at = -1, ownCpu = 0;
    turns.forEach(([t0, t1, cpu], k) => { const d = t1 - t0; if (d > longest) { longest = d; at = k; } longestNoGc = Math.max(longestNoGc, d - gcIn(t0, t1)); ownCpu = Math.max(ownCpu, cpu - gcIn(t0, t1)); });
    const cpuTop = turns.map((x, k) => [x[2], k]).sort((a, b) => b[0] - a[0]).slice(0, 2).map(([v, k]) => `${v.toFixed(1)} (turn ${k})`).join(', ');
    console.log(`site ${site}: longest turn ${longest.toFixed(1)} ms wall (turn ${at}), ${longestNoGc.toFixed(1)} ms without the collector's pauses; the planner's own CPU in the longest turn ${ownCpu.toFixed(1)} ms; longest CPU times ${cpuTop}`);
  }
  const big = gcs.map(([a, b]) => b - a).sort((x, y) => y - x);
  console.log(`GC pauses in this run: ${gcs.length}, longest ${big.length ? big[0].toFixed(0) : 0} ms`);
  process.exit(0);
}
main().catch((err) => { console.error(err); process.exit(1); });

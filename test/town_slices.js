// A town's plan is built in slices in the worker (gen_village.js planAdvance; worker_main.js parks a job until its plan
// is there). Checked here with the real worker code, in node, with a fake `self`:
//  1. every reply is what the generator makes directly: chunk columns, horizon tiles, the spawn, the village plan;
//  2. a job waiting for a plan does not hold the worker: the slices of planning are short (each turn is timed, see below);
//  3. a plan built a slice at a time is the same plan (hash of every block op of every chunk, the summary);
//  4. a job still waiting when the world is replaced (init) is answered 'cancelled', not with the new world's data.
//   bash test/wt_run.sh town_slices.js
const V = require('./load_shared.js');
const { PerformanceObserver } = require('perf_hooks');
const VG = V.VillageGen, LOD = V.LOD;
const SEED = 4242, VGEN = 5;
const fnv = (h, a) => { for (let i = 0; i < a.length; i++) { h ^= a[i] & 0xffff; h = Math.imul(h, 16777619) >>> 0; h ^= (a[i] / 65536) & 0xffff; h = Math.imul(h, 16777619) >>> 0; } return h; };
const bytes = (x) => x instanceof ArrayBuffer ? new Uint8Array(x) : new Uint8Array(x.buffer, x.byteOffset, x.byteLength);
const hashBytes = (x) => { let h = 2166136261 >>> 0; const b = bytes(x); for (let i = 0; i < b.length; i++) h = Math.imul(h ^ b[i], 16777619) >>> 0; return h; };
const hex = (h) => (h >>> 0).toString(16).padStart(8, '0');
let fail = 0;
const check = (ok, what) => { console.log((ok ? 'OK   ' : 'FAIL ') + what); if (!ok) fail++; };

// ---- the worker, with a fake self ----
const replies = [];
global.self = { postMessage(m) { replies.push(m); }, onmessage: null };
require('../src/worker/worker_main.js');
const inner = self.onmessage;
// a turn's time is the thread's CPU time (process.threadCpuUsage: this thread's own work; a shared, loaded box and the
// collector's helper threads do not count). The collector's pauses on this thread are taken out in section 2 (gcIn).
const cpuMs = () => { const u = process.threadCpuUsage(); return (u.user + u.system) / 1000; };
const gcs = [];   // the collector's pauses: perf_hooks 'gc' entries, delivered between macrotasks
new PerformanceObserver((list) => { for (const e of list.getEntries()) gcs.push([e.startTime, e.startTime + e.duration]); }).observe({ entryTypes: ['gc'] });
const gcIn = (t0, t1) => { let s = 0; for (const [a, b] of gcs) { const o = Math.min(b, t1) - Math.max(a, t0); if (o > 0) s += o; } return s; };
let planTurns = 0, jobTurns = 0, maxJobTurn = 0;
const planRec = [];   // [CPU ms, start, end] of each planning turn
self.onmessage = function (e) {          // every turn of the worker is timed (the parked jobs re-enter through here too)
  const m = e.data, before = m.planMs || 0, t0 = performance.now(), c0 = cpuMs();
  inner(e);
  const dt = cpuMs() - c0;
  if ((m.planMs || 0) > before) { planTurns++; planRec.push([dt, t0, performance.now()]); }
  else { jobTurns++; if (dt > maxJobTurn) maxJobTurn = dt; }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(pred, what, limitMs = 240000) {
  const t0 = performance.now();
  while (!pred()) { if (performance.now() - t0 > limitMs) { console.log('timeout waiting for ' + what); return false; } await sleep(5); }
  return true;
}
const answers = (id) => replies.filter((r) => r.id === id && r.type !== 'waiting');

// ---- the reference: the same generator, made directly ----
const R = V.makeGen('overworld', SEED, { vgen: VGEN });
const town = (() => {
  for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) { const s = VG.site(R, i, j); if (s && s.style === 'modern') return s; }
  return null;
})();
check(!!town, 'a modern town near the origin (seed ' + SEED + ')');

async function main() {
  let id = 1;
  self.onmessage({ data: { type: 'init', seed: SEED, opts: { vgen: VGEN }, custom: undefined } });
  const jobs = [];
  const cx0 = town.x >> 4, cz0 = town.z >> 4;
  for (let cz = cz0 - 6; cz <= cz0 + 6; cz += 2) for (let cx = cx0 - 6; cx <= cx0 + 6; cx += 2) jobs.push({ type: 'gen', dim: 'overworld', cx, cz });
  jobs.push({ type: 'gen', dim: 'overworld', cx: 0, cz: 0 });                       // far from any town: no plan needed
  const tiles = [];
  for (const L of [0, 1]) { const T = 32 * (4 << L); for (const [tx, tz] of [[Math.floor(town.x / T), Math.floor(town.z / T)], [Math.floor(town.x / T) + 1, Math.floor(town.z / T)]]) tiles.push({ type: 'lod', dim: 'overworld', level: L, tx, tz }); }
  jobs.push(...tiles);
  jobs.push({ type: 'spawn', dim: 'overworld' });
  jobs.push({ type: 'villageplan', dim: 'overworld', vid: town.id });
  // interleaved, as the pool sends them: the chunks, the tiles and the others come in one after another
  const sent = jobs.map((j) => ({ ...j, id: id++ }));
  for (const j of sent) self.onmessage({ data: j });
  const done = await until(() => sent.every((j) => answers(j.id).length >= 1), 'every job');
  check(done, 'every job is answered (' + sent.length + ' jobs, ' + replies.filter((r) => r.type === 'waiting').length + ' waits)');
  check(!replies.some((r) => r.type === 'error'), 'no job failed');

  // 1. the replies are the generator's own
  let colOK = 0, colN = 0;
  for (const j of sent.filter((j) => j.type === 'gen')) {
    const a = answers(j.id)[0]; colN++;
    const c = R.generate(j.cx, j.cz);
    if (a.type === 'gen' && hashBytes(a.blocks) === hashBytes(c.blocks) && hashBytes(a.biome) === hashBytes(c.biome) && hashBytes(a.grass) === hashBytes(c.tints.grass) && hashBytes(a.foliage) === hashBytes(c.tints.foliage) && hashBytes(a.water) === hashBytes(c.tints.water)) colOK++;
  }
  check(colOK === colN, `chunk columns: ${colOK}/${colN} identical to the generator's`);
  let tileOK = 0;
  const RL = V.makeGen('overworld', SEED, { vgen: VGEN });
  for (const j of sent.filter((x) => x.type === 'lod')) {
    const a = answers(j.id)[0], r = LOD.build(RL, j);
    const same = !!a && a.type === 'lod' && (!r || r.empty ? a.empty === true : (!a.empty && hashBytes(a.verts) === hashBytes(r.verts) && hashBytes(a.idx) === hashBytes(r.idx) && a.count === r.count));
    if (same) tileOK++;
  }
  check(tileOK === tiles.length, `horizon tiles: ${tileOK}/${tiles.length} identical to LOD.build's`);
  const sp = answers(sent.find((j) => j.type === 'spawn').id)[0], rsp = R.findSpawn();
  check(sp && sp.type === 'spawn' && JSON.stringify(sp.pos) === JSON.stringify(rsp), 'spawn: ' + JSON.stringify(sp && sp.pos) + ' = the generator\'s ' + JSON.stringify(rsp));
  const vp = answers(sent.find((j) => j.type === 'villageplan').id)[0];
  const refSummary = JSON.stringify(VG.summary(VG.plan(V.makeGen('overworld', SEED, { vgen: VGEN }), town)));
  check(vp && vp.type === 'villageplan' && JSON.stringify(vp.plan) === refSummary, 'village plan summary is the generator\'s');

  // 2. the slices: no planning turn holds the worker for long (each turn is one slice, or one job)
  // the bound: a planning turn is one slice (20 ms) and the step it ends in. The collector's pauses are not the planner's
  // (a pause happens in any job that allocates), so they are taken out of each turn; what is left is the planner's own CPU
  await sleep(300);   // the observer's entries of the last turns arrive between macrotasks
  const own = planRec.map(([cpu, t0, t1]) => Math.max(0, cpu - gcIn(t0, t1))).sort((a, b) => a - b);
  const median = own[own.length >> 1] || 0, longest = own[own.length - 1] || 0;
  const worst = planRec.map(([cpu, t0, t1]) => [cpu, gcIn(t0, t1)]).reduce((a, x) => (x[0] > a[0] ? x : a), [0, 0]);
  console.log(`     turns: ${planTurns} planning, ${jobTurns} job turns (longest ${maxJobTurn.toFixed(1)} ms CPU; base terrain per chunk is not planning)`);
  console.log(`     planning turns, the planner's own CPU: median ${median.toFixed(1)} ms, over 50 ms: ${own.filter((x) => x > 50).length} of ${own.length}, longest ${longest.toFixed(1)} ms`);
  console.log(`     the longest planning turn by CPU: ${worst[0].toFixed(1)} ms, of which ${worst[1].toFixed(1)} ms were collector pauses`);
  check(planTurns > 0, 'the town was built in slices (' + planTurns + ' planning turns)');
  check(median <= 50, `a typical planning turn holds the worker for at most 50 ms (median ${median.toFixed(1)} ms of the planner's CPU)`);
  check(longest <= 50, `no planning turn holds the worker for more than 50 ms (longest ${longest.toFixed(1)} ms of the planner's CPU)`);

  // 3. a plan built a slice at a time is the same plan (every block op of every chunk, and the summary)
  const sliceG = V.makeGen('overworld', SEED, { vgen: VGEN });
  sliceG._vilPlans = new Map();
  const steps = [];   // [CPU ms, start, end] of each call: a 0 ms slice runs one step
  let p = null;
  while (!p) { const c = cpuMs(), t = performance.now(); p = VG.planAdvance(sliceG, town, 0); steps.push([cpuMs() - c, t, performance.now()]); }
  const planHash = (plan) => { let h = 2166136261 >>> 0; for (const k of [...plan.chunks.keys()].sort()) { const b = plan.chunks.get(k); h = fnv(h, [...k].map((c) => c.charCodeAt(0))); h = fnv(h, b.f); h = fnv(h, b.o); } return hex(fnv(h, [...JSON.stringify(VG.summary(plan))].map((c) => c.charCodeAt(0)))); };
  const whole = planHash(VG.plan(V.makeGen('overworld', SEED, { vgen: VGEN }), town));
  check(planHash(p) === whole, `a plan built in ${steps.length} slices of 0 ms is the same plan (${whole})`);
  await sleep(300);
  const stepOwn = Math.max(0, ...steps.map(([cpu, t0, t1]) => cpu - gcIn(t0, t1)));
  console.log(`     one step at a time: ${steps.length} calls, the longest step's own CPU ${stepOwn.toFixed(1)} ms`);

  // 4. a job waiting when the world is replaced is cancelled
  const waitingJob = { id: id++, type: 'gen', dim: 'overworld', cx: cx0, cz: cz0 + 1 };
  // a world the worker has not planned yet: a fresh init (the generators are replaced), then the job
  self.onmessage({ data: { type: 'init', seed: SEED + 1, opts: { vgen: VGEN }, custom: undefined } });
  const townB = (() => { const g = V.makeGen('overworld', SEED + 1, { vgen: VGEN }); for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) { const s = VG.site(g, i, j); if (s && s.style === 'modern') return s; } return null; })();
  const jobB = { id: id++, type: 'gen', dim: 'overworld', cx: townB.x >> 4, cz: townB.z >> 4 };
  self.onmessage({ data: jobB });
  const parked = replies.some((r) => r.id === jobB.id && r.type === 'waiting');
  check(parked, 'a job for an unplanned town waits (the slices run in later turns)');
  self.onmessage({ data: { type: 'init', seed: SEED + 2, opts: { vgen: VGEN }, custom: undefined } });
  const cancelled = await until(() => answers(jobB.id).length >= 1, 'the cancelled job', 60000);
  check(cancelled && answers(jobB.id)[0].type === 'cancelled', 'after init the waiting job is answered cancelled');
  check(!replies.some((r) => r.type === 'error'), 'no job failed');
  console.log(fail ? `FAILED ${fail}` : 'the town plans are built in slices and the replies are the generator\'s\nALL OK');
  process.exit(fail ? 1 : 0);
}
main().catch((err) => { console.error(err); process.exit(1); });

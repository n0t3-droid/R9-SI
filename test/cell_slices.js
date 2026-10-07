// A chunk's generation reads the village sites of a window of cells (~120 cells: the village's 3 x 3 and the rails'
// 11 x 11, see VG.cellNeeds). A cold window used to be searched inside the job (up to ~300 ms of one worker turn). Now
// the worker builds those cells in slices (VG.siteAdvance, one candidate of a search per step) before the job runs.
// Checked here with the real worker code, in node, with a fake `self`:
//  1. every chunk reply in a cold region is the generator's own (blocks, biome, tints), for the Heartland (vgen 5),
//     a modern-town world (vgen 5) and an old world with a village at the origin (vgen 2);
//  2. the cells are built in slices: cold jobs wait (`waiting` replies) and no turn holds the worker for long;
//  3. a cell a run reaches without its need (no VG.cellNeeds here) is caught by VG.probe, the job waits and the reply
//     is still the generator's own;
//  4. the site of every cell the windows read is the generator's own (VG.site, the unsliced search).
//   bash test/wt_run.sh cell_slices.js
const V = require('./load_shared.js');
const VG = V.VillageGen;
const cpu = () => { const u = process.threadCpuUsage(); return (u.user + u.system) / 1000; };
const bytes = (x) => new Uint8Array(x.buffer, x.byteOffset, x.byteLength);
const hashBytes = (x) => { let h = 2166136261 >>> 0; const b = bytes(x); for (let i = 0; i < b.length; i++) h = Math.imul(h ^ b[i], 16777619) >>> 0; return h; };
let fail = 0;
const check = (ok, what) => { console.log((ok ? 'OK   ' : 'FAIL ') + what); if (!ok) fail++; };

// ---- the worker, with a fake self ----
const replies = [];
global.self = { postMessage(m) { replies.push(m); }, onmessage: null };
require('../src/worker/worker_main.js');
const inner = self.onmessage;
let turnsWaiting = 0, turnsJob = 0; const waitCpu = [], jobCpu = [];
self.onmessage = function (e) {
  const c0 = cpu(); const n0 = replies.length;
  inner(e);
  const dt = cpu() - c0;
  const parked = replies.slice(n0).some((r) => r.type === 'waiting');
  if (parked) { turnsWaiting++; waitCpu.push(dt); } else { turnsJob++; jobCpu.push(dt); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(pred, what, limitMs = 240000) {
  const t0 = Date.now();
  while (!pred()) { if (Date.now() - t0 > limitMs) { console.log('timeout waiting for ' + what); return false; } await sleep(5); }
  return true;
}
const answerOf = (id) => replies.find((r) => r.id === id && r.type !== 'waiting');

// the columns of a job list: a chunk window across a cell edge (cells are 40 chunks wide at vgen 5)
function columns(cx0, cz0, n) { const out = []; for (let cz = cz0 - n; cz <= cz0 + n; cz++) for (let cx = cx0 - n; cx <= cx0 + n; cx++) out.push([cx, cz]); return out; }

async function runWorld(label, vgen, seed, cols, opts = {}) {
  let id = 1000 * (opts.salt || 1);
  self.onmessage({ data: { type: 'init', seed, opts: { vgen }, custom: undefined } });
  const R = V.makeGen('overworld', seed, { vgen });   // the reference: the same generator, made directly
  if (R.constructor.name !== 'OverworldGen') throw new Error('not an overworld');
  const jobs = cols.map(([cx, cz]) => ({ type: 'gen', dim: 'overworld', cx, cz, id: id++ }));
  for (const j of jobs) self.onmessage({ data: j });
  const done = await until(() => jobs.every((j) => answerOf(j.id)), label + ': every chunk answered');
  check(done, `${label}: every chunk is answered (${jobs.length} jobs)`);
  check(!replies.some((r) => r.type === 'error'), `${label}: no job failed`);
  let same = 0;
  for (const j of jobs) {
    const a = answerOf(j.id), c = R.generate(j.cx, j.cz);
    if (a && a.type === 'gen' && hashBytes(a.blocks) === hashBytes(c.blocks) && hashBytes(a.biome) === hashBytes(c.biome) && hashBytes(a.grass) === hashBytes(c.tints.grass) && hashBytes(a.water) === hashBytes(c.tints.water)) same++;
  }
  check(same === jobs.length, `${label}: ${same}/${jobs.length} chunk replies are the generator's own`);
  return { R, jobs };
}

async function main() {
  // 1 and 2: a cold Heartland window (vgen 5), a modern-town world (vgen 5) and an old world (vgen 2) with a village
  const waitsBefore = turnsWaiting;
  const worlds = [
    ['Heartland (vgen 5, seed 12345)', 5, 12345, columns(0, 0, 3).concat(columns(40, 0, 1))],
    ['modern towns (vgen 5, seed 4242)', 5, 4242, columns(0, 0, 2)],
    ['old world (vgen 2, seed 3)', 2, 3, columns(0, 0, 2)],
  ];
  let salt = 1;
  for (const [label, vgen, seed, cols] of worlds) await runWorld(label, vgen, seed, cols, { salt: salt++ });
  check(turnsWaiting - waitsBefore > 0, `cold cells were built in slices (${turnsWaiting - waitsBefore} turns that waited)`);
  const worst = (a) => a.length ? Math.max(...a) : 0;
  const med = (a) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
  console.log(`     waiting turns: ${waitCpu.length}, CPU median ${med(waitCpu).toFixed(1)} ms, longest ${worst(waitCpu).toFixed(1)} ms`);
  console.log(`     job turns: ${jobCpu.length}, CPU median ${med(jobCpu).toFixed(1)} ms, longest ${worst(jobCpu).toFixed(1)} ms`);
  check(med(waitCpu) < 25, `a typical waiting turn holds the worker for under 25 ms (median ${med(waitCpu).toFixed(1)} ms)`);
  check(worst(waitCpu) < 80, `no waiting turn holds the worker for 80 ms or more (longest ${worst(waitCpu).toFixed(1)} ms; GC pauses included)`);

  // 3: the probe: the needs left empty, so the run itself meets the cold cells and parks for each of them
  const savedNeeds = VG.cellNeeds.slice();
  VG.cellNeeds.length = 0;
  const missesBefore = turnsWaiting;
  const { R } = await runWorld('probe fallback (vgen 5, seed 777)', 5, 777, [[0, 0], [1, 0], [-2, 3]], { salt: 9 });
  VG.cellNeeds.push(...savedNeeds);
  check(turnsWaiting - missesBefore > 0, `cells the run met without their need were waited for (${turnsWaiting - missesBefore} turns)`);

  // 4: the sites the windows read: a cell built one candidate per turn (siteAdvance with 0 ms) is the unsliced search's
  let siteSame = 0, siteN = 0, siteSteps = 0;
  const RS = V.makeGen('overworld', 12345, { vgen: 5 });
  for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) {
    siteN++;
    const direct = VG.site(RS, i, j);
    const G2 = V.makeGen('overworld', 12345, { vgen: 5 });
    let s;
    while (s === undefined) { s = VG.siteAdvance(G2, i, j, 0); siteSteps++; }
    if (JSON.stringify(s) === JSON.stringify(direct)) siteSame++;
  }
  check(siteSame === siteN, `sites: ${siteSame}/${siteN} cells built a candidate per turn (${siteSteps} turns) are the unsliced search's`);
  check(!replies.some((r) => r.type === 'error'), 'no job failed');
  console.log(fail ? `FAIL ${fail}` : 'ALL OK');
  process.exit(fail ? 1 : 0);
}
main().catch((err) => { console.error(err); console.log('FAILED 1'); process.exit(1); });

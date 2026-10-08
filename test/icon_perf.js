// The icon work of the Modern Living tab stays small (iconperf). Budgets are wide, but they fail the v0.40 code: VM.icon
// scanned the whole span box (up to 26 ms per icon), and the hammock's extrude made 2 million edge tests (a 130-190 ms
// first paint in the browser).
// The times are CPU time of this process (user + system), not the wall clock: on this 2-CPU machine the wall clock also
// counts the time the other tests hold the CPU (under a load of 5 the first use of the pack took 2.3 times as long in
// wall time as in CPU time; the CPU time is the quiet machine's figure). A repeated item keeps its best of three runs,
// since the machine only ever adds time to a run.
// 1 · the lazy builds, every pack model on its first use (a build is what a first paint pays for)
// 2 · VM.icon over the whole pack (every model built first, outside the timers): the total and the slowest icon
// 3 · Builder.extrude of the hammock's sagging cloth (168 edges, 6 layers), ten builds
require('./load_shared.js');
const VM = VR.VM;
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const pack = VR.R.types.filter(t => t.o.modern);
const BUILD_BUDGET = 60, TOTAL_BUDGET = 150, ONE_BUDGET = 12, EXTRUDE_BUDGET = 60;
const volOf = (m) => m.VW * m.VH * m.VD;
// the CPU time (user + system) that fn takes, in ms
const cpuMs = (fn) => { const u = process.cpuUsage(); fn(); const d = process.cpuUsage(u); return (d.user + d.system) / 1000; };

// 1 · the lazy builds, every pack model on its first use (a build is what a first paint pays for)
{
  const fresh = pack.map(t => VM.MODELS[t.name]).filter(m => !m.compiled);
  const times = fresh.map(m => [m.name, cpuMs(() => VM.materialize(m))]);
  const top = [...times].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const worst = top[0];
  console.log('    builds of ' + times.length + ' models in ' + times.reduce((a, b) => a + b[1], 0).toFixed(0) + ' ms CPU; slowest: ' + top.map(([n, dt]) => n.replace(/^vm_/, '') + ' ' + dt.toFixed(0)).join(' · ') + ' ms');
  check(worst[1] < BUILD_BUDGET, 'every pack model builds in under ' + BUILD_BUDGET + ' ms CPU on its first use (worst ' + worst[0] + ' ' + worst[1].toFixed(1) + ' ms)');
}

// 2 · the icon pass over the whole pack (every model built first, outside the timers)
{
  const built = pack.map(t => VM.materialize(VM.MODELS[t.name]));
  const best = new Map(built.map(m => [m, Infinity]));
  for (let run = 0; run < 3; run++) for (const m of built) best.set(m, Math.min(best.get(m), cpuMs(() => VM.icon({ model: m }))));
  const per = [...best].map(([m, dt]) => [m.name, dt]).sort((a, b) => b[1] - a[1]);
  const total = per.reduce((a, b) => a + b[1], 0), voxels = built.reduce((a, m) => a + volOf(m), 0);
  console.log('    icons of ' + built.length + ' models: ' + total.toFixed(0) + ' ms CPU in all, best of three runs each (' + (voxels / 1e6).toFixed(1) + ' M voxels of volume), slowest ' + per[0][0] + ' ' + per[0][1].toFixed(1) + ' ms');
  check(total < TOTAL_BUDGET, 'the icons of the whole pack take ' + total.toFixed(0) + ' ms CPU in all (budget ' + TOTAL_BUDGET + ')');
  check(per[0][1] < ONE_BUDGET, 'no single icon takes more than ' + ONE_BUDGET + ' ms CPU (' + per[0][0] + ' ' + per[0][1].toFixed(1) + ' ms)');
}

// 3 · the hammock's cloth: the same polygon as voxmodern.js (a sag curve in 0.5 steps, both edges), six layers, ten builds
{
  const sag = (x) => 5 + 7 * ((x - 24) / 21) ** 2, poly = [];
  for (let x = 3.5; x <= 44.5; x += 0.5) poly.push([x, sag(x) + 1]);
  for (let x = 44.5; x >= 3.5; x -= 0.5) poly.push([x, sag(x)]);
  const cloth = VM.M.fabric(0xE8D8B8);
  const ten = () => { for (let k = 0; k < 10; k++) new VM.Builder(3, 1, 1, 32).extrude(poly, 'z', 5, 11, cloth); };
  const dt = Math.min(cpuMs(ten), cpuMs(ten), cpuMs(ten));
  console.log('    the cloth extruded ten times: ' + dt.toFixed(1) + ' ms CPU (best of three runs)');
  check(dt < EXTRUDE_BUDGET, 'the cloth extrudes ten times in ' + dt.toFixed(0) + ' ms CPU (budget ' + EXTRUDE_BUDGET + ')');
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

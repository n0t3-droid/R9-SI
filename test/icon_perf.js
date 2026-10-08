// The icon work of the Modern Living tab stays small (iconperf). Budgets are wide (this runs on a busy machine with other
// tests), but they fail the v0.40 code: VM.icon scanned the whole span box (up to 26 ms per icon), and the hammock's
// extrude made 2 million edge tests (a 130-190 ms first paint in the browser).
// 1 · the lazy builds of the 12 largest models, each on its first use (a fresh model: nothing built it yet)
// 2 · VM.icon over the whole pack (every model built first, outside the timers): the total and the slowest icon
// 3 · Builder.extrude of the hammock's sagging cloth (168 edges, 6 layers), ten builds
require('./load_shared.js');
const VM = VR.VM;
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const pack = VR.R.types.filter(t => t.o.modern);
const BUILD_BUDGET = 60, TOTAL_BUDGET = 150, ONE_BUDGET = 12, EXTRUDE_BUDGET = 60;
const volOf = (m) => m.VW * m.VH * m.VD;

// 1 · the lazy builds, every pack model on its first use (a build is what a first paint pays for)
{
  const fresh = pack.map(t => VM.MODELS[t.name]).filter(m => !m.compiled);
  const times = fresh.map(m => { const t0 = performance.now(); VM.materialize(m); return [m.name, performance.now() - t0]; });
  const top = [...times].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const worst = top[0];
  console.log('    builds of ' + times.length + ' models in ' + times.reduce((a, b) => a + b[1], 0).toFixed(0) + ' ms; slowest: ' + top.map(([n, dt]) => n.replace(/^vm_/, '') + ' ' + dt.toFixed(0)).join(' · ') + ' ms');
  check(worst[1] < BUILD_BUDGET, 'every pack model builds in under ' + BUILD_BUDGET + ' ms on its first use (worst ' + worst[0] + ' ' + worst[1].toFixed(1) + ' ms)');
}

// 2 · the icon pass over the whole pack
{
  const built = pack.map(t => VM.materialize(VM.MODELS[t.name]));
  const per = [];
  let total = 0, voxels = 0;
  for (const m of built) { const t0 = performance.now(); VM.icon({ model: m }); const dt = performance.now() - t0; total += dt; per.push([m.name, dt]); voxels += volOf(m); }
  per.sort((a, b) => b[1] - a[1]);
  console.log('    icons of ' + built.length + ' models: ' + total.toFixed(0) + ' ms in all (' + (voxels / 1e6).toFixed(1) + ' M voxels of volume), slowest ' + per[0][0] + ' ' + per[0][1].toFixed(1) + ' ms');
  check(total < TOTAL_BUDGET, 'the icons of the whole pack take ' + total.toFixed(0) + ' ms in all (budget ' + TOTAL_BUDGET + ')');
  check(per[0][1] < ONE_BUDGET, 'no single icon takes more than ' + ONE_BUDGET + ' ms (' + per[0][0] + ' ' + per[0][1].toFixed(1) + ' ms)');
}

// 3 · the hammock's cloth: the same polygon as voxmodern.js (a sag curve in 0.5 steps, both edges), six layers, ten builds
{
  const sag = (x) => 5 + 7 * ((x - 24) / 21) ** 2, poly = [];
  for (let x = 3.5; x <= 44.5; x += 0.5) poly.push([x, sag(x) + 1]);
  for (let x = 44.5; x >= 3.5; x -= 0.5) poly.push([x, sag(x)]);
  const cloth = VM.M.fabric(0xE8D8B8);
  const t0 = performance.now();
  for (let k = 0; k < 10; k++) new VM.Builder(3, 1, 1, 32).extrude(poly, 'z', 5, 11, cloth);
  const dt = performance.now() - t0;
  console.log('    the cloth extruded ten times: ' + dt.toFixed(1) + ' ms');
  check(dt < EXTRUDE_BUDGET, 'the cloth extrudes ten times in ' + dt.toFixed(0) + ' ms (budget ' + EXTRUDE_BUDGET + ')');
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

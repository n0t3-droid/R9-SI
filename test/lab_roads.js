// R9-SI Lab · die Straßen der Dörfer — a lab regression (lab/detect/detectors.js's road detector found it, 27 Nov 2026):
//  a · vgen 21's places are unchanged: Finkenbach and Birkenhain (seed 3616214791) build every block as before (their
//      plans' fills and ops pinned — a world made before keeps every chunk it generated)
//  b · vgen 22: no bare ground lies on a road — the yards filled dirt up over the paving in front of every house that
//      stands above its street (vgen 21: 490 cells in Finkenbach, 1454 in seed 1's first four places) — and the road's
//      width has no holes (a yard's margin took the diagonal gaps before v0.56.5's finishing pass could pave them)
//      and nothing stands in a lane — a later road paved round a lamp or a palm of an earlier one, a lot's hedge row or
//      yard paving reached a street at its side (the home city, Nova Haven, keeps its own kerbs and turning circles)
//      and every door can be walked out of — the town hall's spot in front of its door lay in its fountain's basin — and
//      no plant stands on paving in Fliederfeld (the park's random tufts and beds stood on its fountain's ring)
//  c · the villages keep their houses (≥ 90 % of vgen 21's homes) and their plans take no longer (≤ 1.35×, CPU time)
//   bash test/wt_run.sh lab_roads.js 300   (PIN=1 prints vgen 21's hashes)
'use strict';
const W = require('../lab/lib/world.js'), D = require('../lab/detect/detectors.js');
let fails = 0;
const check = (ok, msg, info) => { if (!ok) { fails++; console.log('  ✗ ' + msg + (info ? '  — ' + info : '')); } else console.log('  ✓ ' + msg); };
const fnv = (h, a) => { for (let i = 0; i < a.length; i++) { h ^= a[i]; h = Math.imul(h, 16777619) >>> 0; } return h; };
const planHash = (plan) => { let h = 2166136261 >>> 0; for (const k of [...plan.chunks.keys()].sort()) { const b = plan.chunks.get(k); h = fnv(h, b.f); h = fnv(h, b.o); } return h.toString(16); };
const SEEDS = [3616214791, 1, 12345, 4242], SITES = 4;
const PIN21 = { Finkenbach: '55a52c3e', Birkenhain: 'befad6d8' };

// the first SITES places near a world's spawn, their plans (and the CPU time the plans took)
function places(seed, vgen) {
  const g = W.gen(seed, vgen), sp = g.findSpawn();
  const out = [];
  for (const site of W.sitesNear(g, sp[0], sp[2], 2500).slice(0, SITES)) {
    const c0 = process.cpuUsage(), plan = W.plan(g, site), c1 = process.cpuUsage(c0);
    out.push({ site, plan, ms: (c1.user + c1.system) / 1000, g });
  }
  return out;
}

console.log('a · vgen 21 unchanged');
const old = new Map();
for (const seed of SEEDS) old.set(seed, places(seed, 21));
{
  const fink = old.get(3616214791).map((p) => p.plan).filter((p) => p.name in PIN21);
  if (process.env.PIN) for (const p of fink) console.log('    PIN', p.name, planHash(p));
  for (const name of Object.keys(PIN21)) { const p = fink.find((q) => q.name === name); check(!!p && planHash(p) === PIN21[name], `${name} (vgen 21) builds every block as before`, p ? planHash(p) : 'not found'); }
}

console.log('b · vgen 22: the roads');
let lane = 0, holes = 0, bumps = 0, obst = 0, doors = 0, doorBad = [], homes21 = 0, homes22 = 0, ms21 = 0, ms22 = 0;
const worst = [];
for (const seed of SEEDS) {
  const now = places(seed, 22), was = old.get(seed);
  for (const p of now) {
    const r = D.roads(p.g, p.plan);
    lane += r.lane; holes += r.holes; bumps += r.bumps;
    const dr = D.doors(p.g, p.plan); doors += dr.doors; for (const f of dr.finds) doorBad.push(`${seed} ${p.site.name}: ${f.info}`);
    if (!p.site.home) { obst += r.obstacles; for (const f of r.finds.filter((f) => f.kind === 'road-obstacle').slice(0, 2)) worst.push(`${seed} ${p.site.name}: ${f.info} at ${f.x},${f.y},${f.z}`); }
    if (r.holes + r.bumps) worst.push(`${seed} ${p.site.name} (${p.site.style}): ${r.holes} holes, ${r.bumps} bumps` + (r.finds[0] ? ` e.g. ${r.finds[0].kind} at ${r.finds[0].x},${r.finds[0].y},${r.finds[0].z} ${r.finds[0].info}` : ''));
    const q = was.find((w) => w.site.id === p.site.id);
    if (q) { homes21 += q.plan.homes.length; homes22 += p.plan.homes.length; ms21 += q.ms; ms22 += p.ms; }
  }
}
check(lane > 15000, `the roads of ${SEEDS.length * SITES} places looked at (${lane} road cells)`);
check(bumps === 0, `no bare ground lies on any road (${bumps} cells)`, worst.slice(0, 4).join(' · '));
check(holes === 0, `no holes in the roads' width (${holes} cells)`, worst.slice(0, 4).join(' · '));
check(doors > 300 && doorBad.length === 0, `every door can be walked out of (${doors} doors, ${doorBad.length} not)`, doorBad.slice(0, 3).join(' · '));
{
  const fl = places(3616214791, 22).find((p) => p.site.name === 'Fliederfeld'), pz = fl && fl.plan.plaza;
  const r = fl ? D.plantsOnPaving(fl.g, { x0: pz.x - 72, x1: pz.x + 72, z0: pz.z - 72, z1: pz.z + 72, y0: pz.y - 14, y1: pz.y + 34 }) : { finds: [1] };
  check(!!fl && r.finds.length === 0, `no plant on paving in Fliederfeld (${r.finds.length})`, r.finds.slice(0, 2).map((f) => f.info + ' at ' + f.x + ',' + f.z).join(' · '));
}
check(obst === 0, `nothing stands in a lane (${obst} cells)`, worst.filter((w) => / at -?\d/.test(w)).slice(0, 4).join(' · '));

console.log('c · the villages keep their houses');
check(homes22 >= homes21 * 0.9, `homes: ${homes22} (vgen 21: ${homes21})`);
check(ms22 <= ms21 * 1.35 + 30, `the plans take no longer: ${ms22.toFixed(0)} ms CPU (vgen 21: ${ms21.toFixed(0)} ms)`);

console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);

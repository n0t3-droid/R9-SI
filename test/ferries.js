// a-life (docs/superpowers/plans/2026-10-30-a-life.md §2): the pure part of VR.Ferries.
//  a · the ferry schedule: per route and dock a PadLife pad whose departures (the lift) come every 120–240 s, pure (the
//      same clock gives the same answer, with or without the cache, from any start), the next ferry from any moment
//  b · the space traffic: bounded per tier (Very Low ≤ 16, High ≤ 64), pure, every rideable route served; the cruise-law
//      path starts and ends just over the two surfaces and lingers near them
//  c · the settlement: a plan per moon in its own style (domes on Basalt, ice-block halls on Opal), homes with doors and
//      beds, lots unlocked over three game days, a home on that moon adds two neighbours; ops inside the settlement's box;
//      the pads apart; the founding rule (first landing settles it, once; the home's world settles near the home)
//  d · the blocks (appended last), the texts in both tables
//   bash test/wt_run.sh ferries.js 300
const V = require('./load_shared.js');
global.window = global.window || { addEventListener() {} };
global.document = global.document || { getElementById: () => null, createElement: () => ({ style: {}, getContext: () => null }) };
global.performance = global.performance || { now: () => Date.now() };
const fs = require('fs');
for (const f of ['peace', 'lifekit', 'padlife', 'ferries']) { const p = require('path').join(__dirname, '..', 'src', 'main', f + '.js'); if (fs.existsSync(p)) require(p); }
let fails = 0;
const check = (ok, what) => { console.log((ok ? '  ✓ ' : '  ✗ ') + what); if (!ok) fails++; };
const Fe = V.Ferries;
check(!!Fe && typeof Fe.departures === 'function', 'VR.Ferries loads in node');
if (!Fe) { console.log('FAILED 1'); process.exit(1); }

console.log('a · the schedule');
{
  const ferries = Fe.ROUTES.filter(r => r.ferry);
  check(ferries.length >= 3 && ferries.some(r => r.a === 'overworld' && r.b === 'basalt') && ferries.some(r => r.b === 'opal'), `rideable routes: ${ferries.map(r => r.id).join(', ')}`);
  let lo = 1e9, hi = 0, n = 0;
  for (const r of ferries) for (const end of [r.a, r.b]) for (const ws of [1, 4242, 99]) {
    const d = Fe.departures(r.id, end, ws, 1000, 1000 + 3600);
    for (let i = 1; i < d.length; i++) { const g = d[i] - d[i - 1]; lo = Math.min(lo, g); hi = Math.max(hi, g); n++; }
  }
  check(n > 100 && lo >= 120 - 1e-6 && hi <= 240 + 1e-6, `a ferry every ${lo.toFixed(0)}–${hi.toFixed(0)} s per route and dock (${n} gaps over an hour, three worlds)`);
  const a1 = Fe.departures('herz-basalt', 'basalt', 7, 5000, 6000), a2 = Fe.departures('herz-basalt', 'basalt', 7, 5000, 6000), a3 = Fe.departures('herz-basalt', 'basalt', 7, 4000, 6000).filter(t => t >= 5000);
  check(JSON.stringify(a1) === JSON.stringify(a2) && JSON.stringify(a1) === JSON.stringify(a3), 'pure: the same departures from any start');
  const c = {}; let ok = true;
  for (let t = 0; t < 2000; t += 7.3) { const q1 = Fe.next('herz-opal', 'opal', 5, t, c), q2 = Fe.next('herz-opal', 'opal', 5, t, null); if (q1.dep !== q2.dep || q1.parked !== q2.parked || !(q1.dep >= t) || !(q1.dep - t <= 240 + 60)) ok = false; }
  check(ok, 'the next ferry: the same with and without the cache, never in the past, ≤ 5 min ahead');
  let parked = 0, tot = 0; for (let t = 0; t < 3600; t += 1) { tot++; if (Fe.next('basalt-opal', 'basalt', 3, t, c).parked) parked++; }
  check(parked / tot > 0.8, `a ferry stands at the dock ${(parked / tot * 100).toFixed(0)} % of an hour (boarding at once)`);
}

console.log('b · the traffic');
{
  const out = []; let maxL = 0, maxH = 0, kinds = new Set(), routes = new Set();
  for (let t = 100; t < 3700; t += 13) { Fe.traffic(t, 4242, 0, out); maxL = Math.max(maxL, out.length); Fe.traffic(t, 4242, 2, out); maxH = Math.max(maxH, out.length); for (const c of out) { kinds.add(c.kind); routes.add(c.route); if (!(c.u >= 0 && c.u <= 1)) maxH = 1e9; } }
  check(maxL <= 16 && maxH <= 64 && maxH >= 12, `bounded: Very Low ≤ ${maxL}, High ≤ ${maxH} craft at once`);
  check(kinds.has('ferry') && kinds.has('freighter') && kinds.has('small'), 'ferries, freighters and small craft: ' + [...kinds].join(', '));
  check(Fe.ROUTES.every(r => routes.has(r.id)), 'every route has traffic');
  // the craft over a settlement: one every ~32 s, passing 35–110 m from the plaza
  let np = 0, dmin = 1e9, dmax = 0; const archs = new Set();
  for (let k = 10; k < 10 + 120; k++) { const P = Fe.passAt(77, k); archs.add(P.arch); let best = 1e9; for (let t = P.t0; t < P.t0 + 70; t += 0.25) { const q = Fe.passPos(P, t, 0, 0, 0, null); if (!q) continue; best = Math.min(best, Math.hypot(q.pos[0], q.pos[1], q.pos[2])); } if (best < 1e9) { np++; dmin = Math.min(dmin, best); dmax = Math.max(dmax, best); } }
  check(np === 120 && dmin >= 40 && dmax <= 115 && archs.size === 3, `the craft over the settlement: ${np} in an hour of slots (${(60 / Fe.PASS.slot).toFixed(1)} a minute), nearest ${dmin.toFixed(0)}–${dmax.toFixed(0)} m, ${[...archs].join(', ')}`);
  const ob = Fe.orbiters(500, 4242, 2, []), ob0 = Fe.orbiters(500, 4242, 0, []), ob2 = Fe.orbiters(560, 4242, 2, []);
  check(ob.length === 24 && ob0.length === 8 && ob.every(c => c.alt >= 4000 && c.alt <= 30000 && Math.abs(c.e1[0] * c.e2[0] + c.e1[1] * c.e2[1] + c.e1[2] * c.e2[2]) < 1e-9) && ob2.every((c, i) => c.th > ob[i].th), `craft in orbit round ${Fe.ORBIT_AT.length} worlds: ${ob.length} (Very Low ${ob0.length}), 4–30 km up, moving`);
  const o1 = JSON.stringify(Fe.traffic(1234.5, 9, 2, [])), o2 = JSON.stringify(Fe.traffic(1234.5, 9, 2, []));
  check(o1 === o2, 'pure: the same clock, the same craft');
  const A = [0, 0, 0], B = [1e9, 0, 0], p = [0, 0, 0];
  Fe.along(A, 1e6, B, 2e6, 0, 0, p); const s0 = p[0] - 1e6;
  Fe.along(A, 1e6, B, 2e6, 1, 0, p); const s1 = (1e9 - 2e6) - p[0];
  Fe.along(A, 1e6, B, 2e6, 0.1, 0, p); const s10 = p[0] - 1e6;
  check(s0 > 0 && s0 < 50e3 && s1 > 0 && s1 < 50e3, `the path starts ${(s0 / 1e3).toFixed(0)} km over A and ends ${(s1 / 1e3).toFixed(0)} km over B`);
  check(s10 < 0.02 * 1e9, `the cruise law: a tenth of the trip is ${(s10 / 1e9 * 100).toFixed(2)} % of the way (slow near the bodies)`);
}

console.log('c · the settlement');
{
  const ground = () => 70;
  for (const dim of ['basalt', 'opal']) {
    const site = { x: 100, y: 70, z: -40, id: dim + ':s' };
    const P = Fe.plan(dim, site, ground, { home: false });
    const style = dim === 'basalt' ? 'dome' : 'ice';
    check(P && P.kit === style && P.homes.length >= 1 && P.lots.length >= 4, `${dim}: a plan in its style (${P && P.kit}): ${P && P.homes.length} home(s) at the start, ${P && P.lots.length} lots`);
    const homes = P.homes.concat(P.lots);
    check(homes.every(h => h.door && h.outside && h.beds.length >= 1 && h.ops && h.ops.length % 4 === 0 && h.ops.length > 40), 'every home: a door, beds, its blocks');
    let inBox = true; for (const h of homes.concat(P.prefab)) for (let i = 0; i < h.ops.length; i += 4) { if (Math.abs(h.ops[i] - site.x) > 34 || Math.abs(h.ops[i + 2] - site.z) > 34 || h.ops[i + 1] < site.y - 4 || h.ops[i + 1] > site.y + 12) inBox = false; }
    check(inBox, 'every block inside the settlement (±34 m, −4 … +12)');
    const ids = new Set(); let st = true; for (const h of homes.concat(P.prefab)) for (let i = 3; i < h.ops.length; i += 4) { if (!(h.ops[i] >= 0 && h.ops[i] < V.R.stateCount)) st = false; ids.add(V.R.T.type[h.ops[i]]); }
    check(st && ids.has(V.R.byName.ferry_dock && V.R.byName.ferry_dock.id) && ids.has(V.R.byName.grow_lamp && V.R.byName.grow_lamp.id), `real block states (${ids.size} kinds, the dock and the grow lamps among them)`);
    check(P.pads.length === Fe.ROUTES.filter(r => r.ferry && (r.a === dim || r.b === dim)).length && P.pads.every((a, i) => P.pads.every((b, j) => i === j || Math.hypot(a.x - b.x, a.z - b.z) >= 30)), `${P.pads.length} ferry pads, ≥ 30 m apart`);
    check(P.work.some(w => w.kind === 'garden') && P.plaza && Number.isFinite(P.plaza.x), 'a greenhouse to tend, a plaza');
  }
  const n = (d, h) => Fe.unlocked(d, h);
  check(n(0, false) < n(1, false) && n(1, false) < n(2, false) && n(2, false) < n(3, false) && n(3, false) === n(30, false), `grows over three days: lots ${[0, 1, 2, 3, 30].map(d => n(d, false)).join(' → ')}`);
  check(n(3, true) === n(3, false) + 2, 'a home on that moon: two neighbours more');
  const PH = Fe.plan('basalt', { x: 0, y: 70, z: 0, id: 'b' }, ground, { home: true }), PN = Fe.plan('basalt', { x: 0, y: 70, z: 0, id: 'b' }, ground, { home: false });
  check(PH.lots.length === PN.lots.length + 2 && PH.lots.slice(0, PN.lots.length).every((l, i) => JSON.stringify(l.ops) === JSON.stringify(PN.lots[i].ops)), 'the neighbours come after the others (saved lot indices stay)');
  check(Fe.prefabsFor(PN, 0).length < Fe.prefabsFor(PN, 3).length, `prefabs (greenhouses, lamps) by day: ${Fe.prefabsFor(PN, 0).length} → ${Fe.prefabsFor(PN, 3).length}`);
  // founding
  const rec = {};
  const s1 = Fe.found(rec, 'basalt', 2, [10, 70, 10], null, 4242);
  const s2 = Fe.found(rec, 'basalt', 5, [900, 70, 900], null, 4242);
  check(s1 && s2 === s1 && rec.sites.basalt.day0 === 2, 'settled on the first landing, once (day 2)');
  const d1 = Math.hypot(s1.x - 10, s1.z - 10);
  check(d1 >= 40 && d1 <= 90, `the site ${d1.toFixed(0)} m from the landing (in sight, not on top of it)`);
  const s3 = Fe.found(rec, 'opal', 1, [0, 70, 0], { dim: 'opal', pos: [500, 80, 500] }, 4242);
  check(Math.hypot(s3.x - 500, s3.z - 500) <= 70 && Math.hypot(s3.x - 500, s3.z - 500) >= 30, 'on the home\'s world it grows next to the home');
  check(Fe.found(rec, 'overworld', 1, [0, 70, 0], null, 1) === null && Fe.found(rec, 'zinn', 1, [0, 70, 0], null, 1) === null, 'only the moons are settled');
  check(Fe.daysOf(rec.sites.basalt, 2) === 0 && Fe.daysOf(rec.sites.basalt, 5) === 3, 'its age in game days');
}

console.log('d · blocks and texts');
{
  const R = V.R, last = R.types.slice(-2).map(t => t.name).join(', ');
  check(last === 'ferry_dock, grow_lamp', 'the last blocks: ' + last);
  check(R.T.emit[R.byName.grow_lamp.defaultState] > 0 && R.T.emit[R.byName.ferry_dock.defaultState] > 0, 'the grow lamp and the dock glow');
  const path = require('path'), de = fs.readFileSync(path.join(__dirname, '..', 'src', 'main', 'lang_de.js'), 'utf8'), en = fs.readFileSync(path.join(__dirname, '..', 'src', 'main', 'lang_en.js'), 'utf8');
  const keys = Fe.KEYS || [];
  check(keys.length >= 10 && keys.every(k => de.includes('"' + k + '"') && en.includes('"' + k + '"')), `${keys.length} keys in both tables`);
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

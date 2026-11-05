// u-stations (docs/superpowers/plans/2026-10-31-u-stations.md): the pure part of VR.Stations, the Forge's station kind,
// the stn.* dims and their blocks.
//  a · the Ringstation geostationary: 52.9 km over the equator (∛(μT²/4π²) with Herzwelt's μ and day), Herzwelt 81.5°
//      wide there, the station's place turns with the ground (a circular orbit's speed = the ground's turn there), on
//      the equator under the Heartland's meridian; the outposts on low circles round Basalt and Opal
//  b · the shuttles: a touchdown every 60–120 s (PadLife's own schedule: the same in the station's hangar deck and in
//      space), pure (any start, any cache: the same answer — host and guest), the craft near the station on their way
//      in, at a berth, on their way out
//  c · docking: the plan from a ship in a low orbit — continuous (no step over the speed bound), through the five gates
//      on the corridor's axis, at rest at the berth at the clamp, ≤ 30 s; the hand-off: the berth stands on the
//      generated deck in the station's dim, with room for a ship
//  d · the station: the Forge kind builds both kinds strictly (no unknown block), the hall's window wall to the planet,
//      walkable from the spawn to the deck, the shop's counter, the cabins, the garden and the ring corridor; the dims
//      (sky, home gravity, finite, deterministic, the spawn on the floor)
//  e · the blocks appended last; the texts in both tables
//   bash test/wt_run.sh stations.js 300
const V = require('./load_shared.js');
global.window = global.window || { addEventListener() {} };
global.document = global.document || { getElementById: () => null, createElement: () => ({ style: {}, getContext: () => null }) };
global.performance = global.performance || { now: () => Date.now() };
const fs = require('fs'), path = require('path');
for (const f of ['peace', 'lifekit', 'padlife', 'stations']) { const p = path.join(__dirname, '..', 'src', 'main', f + '.js'); if (fs.existsSync(p)) require(p); }
let fails = 0;
const check = (ok, what) => { console.log((ok ? '  ✓ ' : '  ✗ ') + what); if (!ok) fails++; };
const STN = V.Stations, U = V.Universe, S = U && U.home;
check(!!STN && typeof STN.place === 'function', 'VR.Stations loads in node');
if (!STN) { console.log('FAILED 1'); process.exit(1); }
const len = (a) => Math.hypot(a[0], a[1], a[2]), sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const D2R = Math.PI / 180;

console.log('a · geostationary');
{
  const H = S.body('herz'), alt = STN.ringAlt();
  check(Math.abs(alt - 52900) < 250, `the ring ${(alt / 1000).toFixed(2)} km over the ground (U§3: 52.9 km)`);
  const P = STN.place('ring', 1234, {}), r = len(P.r), w = 2 * Math.asin(H.R / r) / D2R;
  check(Math.abs(r - H.R - alt) < 2, `its place ${((r - H.R) / 1000).toFixed(2)} km from the surface`);
  check(Math.abs(w - 81.5) < 0.3, `Herzwelt ${w.toFixed(1)}° wide in its windows (81.5°)`);
  const vC = Math.sqrt(H.mu / r), vG = len(P.v);
  check(Math.abs(vG / vC - 1) < 0.005, `a circular orbit there ${vC.toFixed(1)} m/s = the ground's turn ${vG.toFixed(1)} m/s (geostationary)`);
  const lat = Math.asin(dot(P.r, H.spin.axis) / r) / D2R;
  check(Math.abs(lat) < 0.01, `on the equator (latitude ${lat.toFixed(4)}°)`);
  const c1 = [0, 0, 0], c2 = [0, 0, 0], v = [0, 0, 0];
  S.inertialToChart('herz', STN.place('ring', 100, {}).r, STN.place('ring', 100, {}).v, 100, c1, v);
  S.inertialToChart('herz', STN.place('ring', 900, {}).r, STN.place('ring', 900, {}).v, 900, c2, v);
  check(len(sub(c1, c2)) < 1, `fixed over the map: ${len(sub(c1, c2)).toFixed(3)} m in 800 s`);
  const cp = STN.chartPos(), ch = S.chart('herz');
  const toO = Math.atan2(-ch.P[0], -ch.P[1]), toS = Math.atan2(cp[0] - ch.P[0], cp[2] - ch.P[1]);
  check(Math.abs(toO - toS) < 1e-6 && Math.hypot(cp[0], cp[2]) > 100000, `under the Heartland's meridian, ${(Math.hypot(cp[0], cp[2]) / 1000).toFixed(1)} km south of the map's origin`);
  const ax = P.A, sp = dot(ax, sub(STN.deck('ring', 0, 1234, {}).p, P.r));
  check(Math.abs(sp - STN.DECK_Y) < 1e-6, 'the decks on the planet side of the ring');
  const d0 = STN.deck('ring', 0, 0, {}).p, d1 = STN.deck('ring', 0, STN.SPIN / 4, {}).p, cen0 = STN.place('ring', 0, {}).r, cen1 = STN.place('ring', STN.SPIN / 4, {}).r;
  const ang = Math.acos(dot(sub(d0, cen0), sub(d1, cen1)) / (len(sub(d0, cen0)) * len(sub(d1, cen1)))) / D2R;
  check(Math.abs(ang - 90) < 1.5, `the ring turns: a quarter in ${STN.SPIN / 4} s (${ang.toFixed(1)}°)`);
  for (const id of ['basalt', 'opal']) {
    const B = S.body(id), q = STN.place(id, 500, {}), h = len(q.r) - B.R, vc = Math.sqrt(B.mu / len(q.r));
    check(h > 1500 && h < 6000 && Math.abs(len(q.v) / vc - 1) < 1e-6 && Math.abs(dot(q.r, q.v)) < 1e-3 * len(q.r) * len(q.v), `the ${id} outpost on a circle ${(h / 1000).toFixed(1)} km up at ${vc.toFixed(1)} m/s`);
  }
}

console.log('b · the shuttles');
{
  let lo = 1e9, hi = 0, n = 0;
  for (const id of STN.IDS) for (const ws of [1, 4242, 99]) {
    const T = STN.visits(id, ws, 1000, 1000 + 3600);
    for (let i = 1; i < T.length; i++) { const d = T[i] - T[i - 1]; lo = Math.min(lo, d); hi = Math.max(hi, d); n++; }
  }
  check(n > 200 && lo >= 60 - 1e-6 && hi <= 120 + 1e-6, `a shuttle docks every ${lo.toFixed(0)}–${hi.toFixed(0)} s (${n} gaps over an hour, three stations, three worlds)`);
  const a1 = STN.visits('ring', 7, 5000, 6000), a2 = STN.visits('ring', 7, 3000, 6000).filter(t => t >= 5000);
  check(a1.length > 6 && JSON.stringify(a1) === JSON.stringify(a2), 'pure: the same touchdowns from any start');
  // host and guest: two machines, two caches, different moments they asked first — the same craft at the same places
  const host = {}, guest = {}; let same = true, seen = 0, phases = new Set();
  for (let t = 4000; t < 4000 + 900; t += 3.7) {
    const L1 = STN.shuttles('ring', 7, t, [], host), L2 = STN.shuttles('ring', 7, t, [], (t % 2 < 1) ? guest : null);
    if (JSON.stringify(L1.map(c => [c.n, c.berth, c.phase, c.p.map(x => Math.round(x))])) !== JSON.stringify(L2.map(c => [c.n, c.berth, c.phase, c.p.map(x => Math.round(x))]))) same = false;
    seen += L1.length; for (const c of L1) phases.add(c.phase);
  }
  check(same && seen > 100, `the craft identical for host and guest (${seen} craft-moments)`);
  check(phases.has('approach') && phases.has('docked') && phases.has('leave'), 'craft on the way in, at a berth, on the way out: ' + [...phases].join(', '));
  // the interior's pad uses the same schedule: PadLife's own visits (touchdown T) are the space traffic's
  const pad = STN.padFor('ring', 7), c = V.PadLife.visitAt(pad.seed, 5000, null, pad.o), Ts = STN.visits('ring', 7, 4000, 6000);
  check(Ts.some(t => Math.abs(t - c.T) < 1e-9), 'the hangar deck\'s PadLife pad lands the same shuttles');
  let near = true;
  for (let t = 4000; t < 5000; t += 11) for (const cr of STN.shuttles('ring', 7, t, [], host)) { const D = STN.deck('ring', cr.berth, t, {}); if (len(sub(cr.p, D.p)) > 4000) near = false; if (cr.phase === 'docked' && len(sub(cr.p, D.p)) > 10) near = false; }
  check(near, 'every craft within 4 km of its berth, at the berth while docked');
}

console.log('c · docking');
{
  // a ship in a 3-km parking orbit over the Heartland
  const H = S.body('herz'), t0 = 2000, r0 = [0, 0, 0], v0 = [0, 0, 0];
  S.chartToInertial('herz', [0, 3063, 0], [0, 0, 0], t0, r0, v0);
  const rr = len(r0), vc = Math.sqrt(H.mu / rr), e = [-r0[1] / Math.hypot(r0[0], r0[1]), r0[0] / Math.hypot(r0[0], r0[1]), 0];
  const V0 = [e[0] * vc, e[1] * vc, e[2] * vc];
  const J = STN.dockPlan('ring', 0, t0, r0, V0);
  check(J.dur <= 30 && J.dur >= 20, `the docking takes ${J.dur.toFixed(1)} s (transfer ${J.T1.toFixed(1)}, corridor ${J.T2}, align ${J.T3}, clamp ${J.T4})`);
  const o = {}, h = 1 / 60; let prev = null, prevV = null, maxJump = 0, maxDv = 0, gates = 0, off = 0, phases = [];
  const passed = new Set();
  for (let s = 0; s <= J.dur + 1e-9; s += h) {
    STN.dockAt(J, s, o);
    const edge = phases[phases.length - 1] !== o.phase;
    if (edge) phases.push(o.phase);
    if (prev) { const v = sub(o.p, prev).map(x => x / h); if (prevV && o.phase !== 'transfer' && !edge) maxDv = Math.max(maxDv, len(sub(v, prevV))); prevV = v; maxJump = Math.max(maxJump, len(sub(o.p, prev))); }
    prev = o.p.slice();
    if (o.phase === 'corridor' || o.phase === 'align') {
      const D = STN.deck('ring', 0, J.t0 + s, {}), rel = sub(o.p, D.p), along = dot(rel, D.n), lat = len(sub(rel, D.n.map(x => x * along)));
      off = Math.max(off, lat);
      STN.GATES.forEach((g, i) => { if (Math.abs(along - g) < 30) passed.add(i); });
    }
  }
  gates = passed.size;
  // at each phase change: the position and the velocity the same on both sides (1 ms each way)
  const vel = (s) => { const a = STN.dockAt(J, s - 5e-4, {}).p, b = STN.dockAt(J, s + 5e-4, {}).p; return sub(b, a).map(x => x / 1e-3); };
  let edgeDv = 0, edgeDp = 0;
  for (const sb of [J.T1, J.T1 + J.T2, J.T1 + J.T2 + J.T3]) { edgeDv = Math.max(edgeDv, len(sub(vel(sb - 2e-3), vel(sb + 2e-3)))); edgeDp = Math.max(edgeDp, len(sub(STN.dockAt(J, sb - 1e-6, {}).p, STN.dockAt(J, sb + 1e-6, {}).p))); }
  check(edgeDv < 0.5 && edgeDp < 0.05, `no step at the phase changes: ${edgeDp.toFixed(4)} m, ${edgeDv.toFixed(3)} m/s`);
  check(phases.join('>') === 'transfer>corridor>align>clamp', 'the phases: ' + phases.join(' → '));
  check(maxDv < 1, `up the corridor the speed changes at most ${maxDv.toFixed(2)} m/s in a frame (≤ 60 m/s²)`);
  check(gates === STN.GATES.length && off < 0.5, `through all ${gates} gates on the axis (at most ${off.toFixed(3)} m off it)`);
  STN.dockAt(J, J.dur, o); const D = STN.deck('ring', 0, J.t0 + J.dur, {});
  STN.dockAt(J, J.dur - 0.05, prev = {}); const vRel = len(sub(sub(o.p, prev.p).map(x => x / 0.05), STN.deck('ring', 0, J.t0 + J.dur - 0.025, {}).v));
  check(Math.abs(dot(sub(o.p, D.p), D.n) - STN.CLAMP_D) < 0.01 && vRel < 0.05, `at rest at the clamp: ${STN.CLAMP_D} m under the deck, ${vRel.toFixed(3)} m/s against it`);
  check(dot(o.fwd, D.n) < -0.999, 'the nose up into the berth');
  const ho = STN.handoff('ring');
  check(ho.dim === 'stn.ring' && ho.at.length === 3, `the hand-off: Travel to ${ho.dim} at ${ho.at.join(', ')}`);
  const G = V.makeGen('stn.ring', 1, {}), get = (x, y, z) => { const c = G.generate(Math.floor(x) >> 4, Math.floor(z) >> 4); return c.blocks[(y << 8) | ((Math.floor(z) & 15) << 4) | (Math.floor(x) & 15)]; };
  let room = true; for (let dx = -8; dx <= 8; dx += 4) for (let dz = -8; dz <= 8; dz += 4) { if (!get(ho.at[0] + dx, ho.at[1] - 1, ho.at[2] + dz)) room = false; for (let y = 0; y < 10; y++) if (get(ho.at[0] + dx, ho.at[1] + y, ho.at[2] + dz)) room = false; }
  check(room, 'the berth: a floor under 17 × 17 m and 10 m of room above it');
  const U0 = STN.undockState('ring', 0, 3000, {}), D3 = STN.deck('ring', 0, 3000, {});
  check(dot(sub(U0.r, D3.p), D3.n) > 100 && dot(sub(U0.v, D3.v), D3.n) > 5, 'undocking: the ship set out on the corridor, moving away from the deck');
}

console.log('d · the station');
{
  const Fo = V.Forge, STA = Fo.Station;
  Fo.strict = true; let g0 = null, g1 = null, err = null;
  try { g0 = Fo.build(STA.dna(0)); g1 = Fo.build(STA.dna(1)); } catch (e) { err = e.message; }
  Fo.strict = false;
  check(!err && g0 && g1, 'both kinds build with known blocks only' + (err ? ': ' + err : ''));
  if (g0) {
    const B = STA.box(0), P = STA.place(0), R = V.R;
    const at = (x, y, z) => { const gx = x - B.x0, gy = y - B.y0, gz = z - B.z0; return gx < 0 || gy < 0 || gz < 0 || gx >= g0.sx || gy >= g0.sy || gz >= g0.sz ? 0 : g0.blocks[(gy * g0.sz + gz) * g0.sx + gx]; };
    const nm = (s) => (s ? R.types[R.T.type[s]].name : 'air');
    let glass = 0; for (let x = P.window.x0; x <= P.window.x1; x++) for (let y = P.window.y0; y <= P.window.y1; y++) if (/glass|viewport/.test(nm(at(x, y, P.window.z)))) glass++;
    check(glass > 220, `the window wall to the planet (−z): ${glass} panes`);
    const W = Fo.walkable(g0, [P.spawn[0] - 0.5 - B.x0 | 0, P.spawn[1] - B.y0, P.spawn[2] - 0.5 - B.z0 | 0]);
    const reach = (p) => W.reach.has((Math.floor(p[0]) - B.x0) + ',' + (p[1] - B.y0) + ',' + (Math.floor(p[2]) - B.z0));
    const near = (p) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => reach([p[0] + a, p[1], p[2] + b]));
    check(reach(P.berth), 'from the hall out to the player\'s berth on the deck');
    check(near([P.counter[0] - 1, FYof(STA), P.counter[2]]), 'to the shop\'s counter');
    check(P.cabins.length === 8 && P.cabins.every(c => near(c.inside)), `into all ${P.cabins.length} cabins`);
    check(near(P.garden) && near(P.control), 'to the garden and the control room');
    check(nm(at(P.counter[0], P.counter[1], P.counter[2])) === 'vx_shop_checkout' && P.cabins.every(c => /bed/.test(nm(at(c.bed[0], c.bed[1], c.bed[2])))), 'the counter and a bed in every cabin');
    let rise = 0; for (let y = 64; y < 104; y++) if (at(90, y, 3) && /deck/.test(nm(at(90, y, 3)))) rise = y - 63;
    check(rise > 20, `the ring corridor curves up ${rise} m at its far end`);
    let plates = 0, clamps = 0; for (const s of g0.blocks) { if (s && R.T.type[s] === R.byName.stn_gravplate.id) plates++; if (s && R.T.type[s] === R.byName.stn_clamp.id) clamps++; }
    check(plates > 60 && clamps === 12, `${plates} gravity plates, ${clamps} clamps`);
  }
  for (const id of ['stn.ring', 'stn.basalt', 'stn.opal']) {
    const d = V.DimReg.get(id);
    check(!!d && d.sky && V.DimReg.gravity(id) === 30 && d.travel && /:/.test(id) === false, `${id}: a dim with a sky, home gravity, reachable`);
  }
  const G = V.makeGen('stn.ring', 5, {}), G2 = V.makeGen('stn.ring', 9, {});
  const c1 = G.generate(0, 0), c2 = G2.generate(0, 0), far = G.generate(20, 20);
  let eq = c1.blocks.length === c2.blocks.length, any = 0; for (let i = 0; i < c1.blocks.length; i++) { if (c1.blocks[i] !== c2.blocks[i]) eq = false; if (far.blocks[i]) any++; }
  check(eq && !any, 'deterministic, and nothing but void beyond the station');
  const sp = G.findSpawn(), sc = G.generate(Math.floor(sp[0]) >> 4, Math.floor(sp[2]) >> 4), li = ((Math.floor(sp[2]) & 15) << 4) | (Math.floor(sp[0]) & 15);
  check(sc.blocks[((sp[1] - 1) << 8) | li] && !sc.blocks[(sp[1] << 8) | li] && !sc.blocks[((sp[1] + 1) << 8) | li], 'the spawn stands on the hall\'s floor');
}
function FYof(STA) { return STA.FY; }

console.log('e · blocks and texts');
{
  const R = V.R, last = R.types.filter(t => !/^(bloom_snow_leaves|bloom_lilac_leaves|bloom_gold_leaves|bloom_rose_leaves|candle_flower|umbel_flower|bell_tower_flower|glowbell|clover)$/.test(t.name)).slice(-2).map(t => t.name).join(', ');
  check(last === 'stn_gravplate, stn_clamp', 'the two station blocks are the last: ' + last);
  const de = fs.readFileSync(path.join(__dirname, '..', 'src', 'main', 'lang_de.js'), 'utf8'), en = fs.readFileSync(path.join(__dirname, '..', 'src', 'main', 'lang_en.js'), 'utf8');
  const keys = STN.keys(), miss = keys.filter(k => !de.includes('"' + k + '"') || !en.includes('"' + k + '"'));
  check(keys.length > 20 && !miss.length, `${keys.length} texts in both tables` + (miss.length ? ' — missing ' + miss.slice(0, 6).join(' ') : ''));
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

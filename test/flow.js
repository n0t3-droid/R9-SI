// f-flow · R50-03 (docs/reviews/v0.49.md; plan docs/superpowers/plans/2026-10-23-f-flow.md §2.3): the Regisseur des Lebens
// rotates and paces, on a simulated hour — the real life director, the real sky traffic and the real event log in node,
// on a stand-in world (flat ground, a village with its plaza, lamps, chimneys and a wall; the Heartland's places by their
// coordinates), the player walking slowly through the hangar's deck, the village, the wild, the isles and the hills while
// three days of the world's clock pass (dt 0.1 s):
//  · no act twice within 60 s (t-wild's sightings: their own wait); the fly-bys ≤ ⅓ of the acts and never two within 60 s;
//  · no two starts within the pace (15 s); no stretch over 32 s without a start or a weighted event seen (while the place
//    has two candidates or more) — the idle fill;
//  · the background traffic's flights pass ≥ 250 m from the player while the director is on (no event), a craft is still
//    in the sky (≥ 90 % of the time within 550 m) — with the switch off, they pass as before (some within 250 m);
//  · the hour's event log: the most repeated event ≤ 40 % of all, ≥ 6 kinds seen in the best ten minutes, spam ≤ 2 / 10 min;
//  · Funke's forecast of the next slot is what plays (≥ 90 %); a heron in view is sent up by the idle fill, one behind is
//    not; the balloon stands 45–80 m out; the close pass and the low pass cross in front of the eye.
//   bash test/wt_run.sh flow.js 300
const V = require('./load_shared.js');
global.window = global.window || {};
global.performance = global.performance || { now: () => Date.now() };
for (const f of ['lifekit', 'lifedirector', 'traffic', 'eventlog']) require(__dirname + '/../src/main/' + f + '.js');
const SS = require(__dirname + '/../src/shared/sessionstats.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const LD = V.LifeDirector, L = V.EventLog, DEG = Math.PI / 180;
check(!!(LD && LD.okNow && LD.order && LD.FLY && LD.ROT && V.Traffic && L), 'the rotation (LD.okNow, LD.order, LD.FLY, LD.ROT), the traffic and the log exist');

// ---------------------------------------------------------------- the rotation (pure)
{
  const H = [[0, 'birds'], [20, 'pigeons'], [40, 'flyby']];
  check(!LD.okNow('birds', H, 59) && LD.okNow('birds', H, 61) && !LD.okNow('flyover', H, 70) && !LD.okNow('flyby', H, 99) && LD.okNow('cart', H, 41), 'okNow: the same act not within 60 s; a fly-by not within 60 s of another (the family)');
  const H2 = [[0, 'birds'], [70, 'pigeons']];
  check(LD.okNow('flyby', H2, 140) && !LD.okNow('flyby', [[0, 'birds']], 80), `okNow: a fly-by only while the fly-bys stay ≤ ⅓ (after two others: yes; after one: no)`);
  const C = ['birds', 'pigeons', 'cart', 'kids'], o = LD.order(4242, 7, C, [[0, 'cart'], [30, 'birds']], 75, 'kids');
  check(o.join() === 'kids,pigeons,cart', `order: the slot's own pick first, then the never played, then the least recently; the birds of 45 s ago not yet (${o.join(', ')})`);
  check(LD.okNow('heron', [[0, 'heron']], 120) === false && LD.okNow('rays', [[0, 'rays']], 200) === false, "t-wild's sightings wait longer (heron 180 s, rays 300 s)");
}

// ---------------------------------------------------------------- the stand-in world
const R = V.R, st = (n) => R.byName[n].defaultState, STONE = st('stone'), LAMP = st('vx_lamppost');
const VX = -500, VZ = -700;   // the village's plaza
const LAMPS = [[VX + 4, VZ], [VX - 4, VZ], [VX, VZ + 6], [VX + 8, VZ + 8], [VX - 8, VZ + 8], [VX + 10, VZ - 6]];
const getBlock = (x, y, z) => {
  if (y <= 80) return STONE;
  if (x === VX + 6 && z >= VZ - 6 && z <= VZ + 6 && y <= 82) return STONE;
  for (const [lx, lz] of LAMPS) if (x === lx && z === lz && (y === 81 || y === 82)) return LAMP;
  return 0;
};
const plan = { id: 'v1', x: VX, z: VZ, rad: 75, style: 'meadow', plaza: { x: VX, y: 81, z: VZ, r: 4 }, lamps: LAMPS.map(([x, z]) => [x, 82, z]), chimneys: [[VX + 12, 86, VZ + 12], [VX - 10, 86, VZ + 14]] };
V.Folk = V.Folk || {}; V.Folk.look = V.Folk.look || ((seed, role) => ({ role })); V.Folk.model = () => ({ def: {} });
V.getVoxModel = V.getVoxModel || (() => ({ def: { radius: 1 }, parts: {} }));
V.Companions = V.Companions || { poseOf: () => ({}) };
const fake = (arch) => ({ key: 'k' + arch, seed: 1, meta: { arch, height: 4, length: arch === 'freighter' || arch === 'cruiser' ? 30 : 16, width: 10, exhaust: [[0, 1, 6, 0.6]], bounds: [-5, 0, -8, 5, 4, 8] }, gpu: null, last: 0 });
function makeGame(preset, lifeDir) {
  const g = {
    state: 'play', dim: 'overworld', time: 0, difficulty: 'peaceful', raidActive: false,
    settings: { preset, fov: 70, lifeDir }, meta: { seed: 4242, vgen: 11, type: 'default' },
    env: { day: 0, ticks: 2500, timeOfDay: 2500, E: { sunDir: [0.4, 0.6, -0.69], night: 0, rain: 0, windDir: [1, 0], wind: 1 } },
    player: { pos: [0.5, 81, 60], yaw: 0, vel: [0, 0, 0] }, cam: { x: 0.5, y: 82.62, z: 60, yaw: 0, pitch: -0.06, fov: 70 * DEG },
    renderer: { W: 960, H: 540 },
    world: { getBlock, topAt: (x, z) => (Math.floor(x) === VX + 6 && z >= VZ - 6 && z <= VZ + 6 ? 82 : 80) },
    particles: { spawn() { return 0; }, spark() { }, splash() { }, glow() { } },
    audio: { ctx: null, tone() { }, play() { }, loop() { } },
    villages: { known: new Map([['v1', { plan }]]), festivalNear: () => null, F: { rockets: [] }, festState() { return this.F; } },
    entities: { beginVox: () => ({ u: {} }), drawModel() { }, lightAt: () => ({ sky: 1, bl: [0, 0, 0] }), sunShade: () => 0, mobs: [], bolts: [] },
    starships: { design(seed, arch, pal, cb) { const d = fake(arch || 'interceptor'); if (cb) cb(d); return d; } },
    ui: { chatLine() { } }, trails: null, padLife: null, wild: null,
  };
  g.traffic = new V.Traffic(g); g.traffic.t = 2.5;
  g.lifeDirector = new LD.Actor(g);
  return g;
}
// the walk (4.3 m/s between the stops, a look round at each): the hangar's deck, the village's plaza and its street, the
// wild, the isles' shore, the hills, the wild again — [x, z, minutes there]
const STOPS = [[0.5, 60, 6], [VX + 0.5, VZ + 9, 6], [VX + 40, VZ + 30, 4], [-900, -1100, 5], [330, -40, 7], [0.5, -300, 6], [500, -900, 6], [0.5, 60, 60]];
const ROUTE = (() => { const out = []; let t = 0; for (let i = 0; i < STOPS.length; i++) { const [x, z, m] = STOPS[i]; out.push({ t0: t, t1: t + m * 60, x0: x, z0: z, x1: x, z1: z }); t += m * 60; const n = STOPS[i + 1]; if (n) { const d = Math.hypot(n[0] - x, n[1] - z); out.push({ t0: t, t1: t + d / 4.3, x0: x, z0: z, x1: n[0], z1: n[1] }); t += d / 4.3; } } return out; })();
const posAt = (t) => { const L = ROUTE.find(q => t >= q.t0 && t < q.t1) || ROUTE[ROUTE.length - 1], u = L.t1 > L.t0 ? Math.min(1, (t - L.t0) / (L.t1 - L.t0)) : 0; return [L.x0 + (L.x1 - L.x0) * u, L.z0 + (L.z1 - L.z0) * u, L.x1 !== L.x0 || L.z1 !== L.z0 ? Math.atan2(-(L.x1 - L.x0), -(L.z1 - L.z0)) : null]; };
function run(g, minutes, o) {
  o = o || {};
  const A = g.lifeDirector, T = g.traffic, dt = 0.1, N = Math.round(minutes * 60 / dt);
  L.reset(null); L.bind(g); L.on = true; L.sampling = true;
  const starts = [], farMin = new Map(), near = [], fc = [];
  const s0 = A.start.bind(A);
  A.start = (kind, op) => { const ev = s0(kind, op); if (ev) { starts.push({ t: A.time, kind, ev, place: A.st.place, hour: A.st.hour, cands: A.ctx ? LD.candidates(A.ctx).length : 0 }); if (o.onStart) o.onStart(ev, g); } return ev; };
  let cover = 0, coverN = 0, fcAt = -1;
  for (let i = 0; i < N; i++) {
    const p = g.player.pos, q = posAt(i * dt);
    if (!o.stay) { g.player.vel[0] = (q[0] - p[0]) / dt; g.player.vel[2] = (q[1] - p[2]) / dt; p[0] = q[0]; p[2] = q[1]; }
    // (walking: looking along the way, swaying a little; standing: looking round)
    const yaw = o.yaw !== undefined ? o.yaw : q[2] !== null && !o.stay ? q[2] + Math.sin(i * dt * 0.3) * 0.4 : (i * dt * 0.06) % (2 * Math.PI);
    g.player.yaw = yaw; g.cam.yaw = yaw; g.cam.x = p[0]; g.cam.y = p[1] + 1.62; g.cam.z = p[2];
    const tod = (2500 + i * dt * 20) % 24000; g.env.ticks = tod; g.env.timeOfDay = tod; g.env.day = Math.floor((2500 + i * dt * 20) / 24000);
    g.env.E.night = tod > 13800 && tod < 22500 ? 1 : 0; const sa = (tod / 24000) * 2 * Math.PI; g.env.E.sunDir = [Math.cos(sa) * 0.5, Math.max(-0.9, Math.sin(sa + 0.3)), -0.6];
    g.time += dt;
    // Funke's forecast, a moment before the next slot fires
    const nk = (A.lastK === null ? 0 : A.lastK) + 1, ts = LD.slotTime(A.seed, nk);
    if (A.lastK !== null && fcAt !== nk && ts - A.clock < 0.15 && ts - A.clock > 0) { fcAt = nk; fc.push({ k: nk, f: A.forecast(nk) }); }
    T.update(dt); A.update(dt); L.frame(g, dt);
    for (const f of fc) if (f.played === undefined && A.st.slot === f.k) f.played = A.st.pick;
    for (const s of T.ships) { if (s.wing || !(s.t >= 0)) continue; const d = Math.hypot(s.pos[0] - p[0], s.pos[1] - p[1] - 1.62, s.pos[2] - p[2]); if (s.far) farMin.set(s, Math.min(farMin.get(s) || 1e9, d)); else if (!s.near && !s.tag) near.push(d); }
    if (i % 10 === 0) { coverN++; if (T.ships.some(s => !s.dead && s.t >= 0 && Math.hypot(s.pos[0] - p[0], s.pos[2] - p[2]) < 550 && (s.alpha === undefined || s.alpha > 0.5))) cover++; }
  }
  return { starts, farMin: [...farMin.values()], nearMin: near.length ? Math.min(...near) : Infinity, fc, cover: cover / Math.max(1, coverN), events: L.events(0), samples: L.samples(), dur: minutes * 60 };
}

// ---------------------------------------------------------------- an hour on Balanced, the director on
const g = makeGame('balanced', true), H = run(g, 60);
const S = H.starts;
console.log(`    an hour: ${S.length} acts started (${Object.entries(S.reduce((m, s) => (m[s.kind] = (m[s.kind] || 0) + 1, m), {})).map(([k, n]) => k + ' ' + n).join(', ')}); filled ${g.lifeDirector.st.filled}`);
{
  let twice = [];
  for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) { if (S[j].t - S[i].t >= 300) break; const again = (LD.ACTS[S[i].kind].again || 60); if (S[j].kind === S[i].kind && S[j].t - S[i].t < again) twice.push(`${S[i].kind} ${S[i].t.toFixed(0)}→${S[j].t.toFixed(0)}`); }
  check(S.length >= 120 && !twice.length, `no act twice within 60 s (${S.length} acts${twice.length ? ': ' + twice.slice(0, 4).join(', ') : ''})`);
  const fly = S.filter(s => LD.FLY[s.kind]);
  let flyClose = 0; for (let i = 1; i < fly.length; i++) if (fly[i].t - fly[i - 1].t < 60) flyClose++;
  check(fly.length > 0 && fly.length <= S.length / 3 + 1e-9 && !flyClose, `the fly-bys ${fly.length} of ${S.length} acts (${(fly.length / S.length * 100).toFixed(0)} % ≤ ⅓), none within 60 s of another (${flyClose})`);
  let minGap = Infinity; for (let i = 1; i < S.length; i++) minGap = Math.min(minGap, S[i].t - S[i - 1].t);
  check(minGap >= LD.ROT.pace - 0.11, `no two starts within the pace: the closest ${minGap.toFixed(1)} s apart (≥ ${LD.ROT.pace})`);
  // the stretches without a start or a weighted event seen ≥ half: in the towns and on the deck by day (many acts) the
  // longest ≤ 32 s (the idle fill at 20 s); everywhere the p90 ≤ 32 s (at dawn in the wild the director has little)
  const marks = S.map(s => s.t).concat(H.events.filter(e => e.w >= 2 && SS.seen(e) >= 0.5).map(e => e.t - (g.time - g.lifeDirector.time))).sort((a, b) => a - b);
  const gaps = [];
  for (let i = 1; i < marks.length; i++) { const s = S.filter(q => q.t <= marks[i - 1]).slice(-1)[0]; gaps.push({ d: marks[i] - marks[i - 1], a: marks[i - 1], place: s ? s.place : '', hour: s ? s.hour : '' }); }
  const rich = gaps.filter(q => ['plaza', 'street', 'hangar'].includes(q.place) && ['morning', 'noon', 'afternoon'].includes(q.hour));
  const lr = rich.reduce((m, q) => (q.d > m.d ? q : m), { d: 0 }), la = gaps.reduce((m, q) => (q.d > m.d ? q : m), { d: 0 });
  const p90 = SS.p90(gaps.map(q => q.d));
  check(rich.length > 20 && lr.d <= 32, `in the towns and on the deck by day the longest stretch without a start or a sight is ${lr.d.toFixed(1)} s (≤ 32: the idle fill at 20 s; ${rich.length} stretches)`);
  check(p90 <= 32, `everywhere the p90 of those stretches ${p90.toFixed(1)} s (≤ 32); the longest ${la.d.toFixed(0)} s at ${la.a.toFixed(0)} s (${la.place}, ${la.hour})`);
}
{
  const fm = H.farMin, lo = fm.length ? Math.min(...fm) : 0, under = fm.filter(d => d < 250).length;
  check(fm.length >= 20 && under <= fm.length * 0.05 && lo >= 120, `the background traffic passes far while the director is on: ${fm.length} flights, ${under} of them within 250 m (≤ 5 %: the player walked toward them), the nearest ${lo.toFixed(0)} m (≥ 120: never a noticeable pass)`);
  check(H.cover >= 0.9, `a craft is still in the sky: within 550 m ${(H.cover * 100).toFixed(1)} % of the hour`);
  const tr = H.events.filter(e => e.src === 'traffic');
  const amb = tr.filter(e => e.sub === 'flyby' && e.w < 2).length;
  check(amb <= Math.max(1, H.farMin.length * 0.05), `the traffic's events are the director's passes (${tr.length}: ${[...new Set(tr.map(e => e.sub))].join(', ')}); a background flight the player walked toward logged as an ambient pass ${amb} time(s) (≤ 5 % of them)`);
}
{
  const m = SS.analyze({ events: H.events, samples: H.samples, t0: 0, t1: H.dur + 1 });
  const kinds = [...new Set(H.events.map(e => e.kind + ':' + e.sub))].length;
  console.log(`    the hour's log: ${H.events.length} events, ${kinds} kind:sub; repeat ${m.repeat.name} ${m.repeat.share.toFixed(2)}; variety ${m.variety.n} (${m.variety.kinds.join(', ')}); spam ${m.spam.n} (${m.spam.per10.toFixed(2)} / 10 min); weighted seen ${m.weighted.perMin.toFixed(2)} / min; longest gap ${m.gaps.longest.d.toFixed(0)} s`);
  check(m.repeat.share <= 0.40, `the most repeated event ${m.repeat.name} is ${(m.repeat.share * 100).toFixed(0)} % of the hour's events (≤ 40)`);
  check(m.variety.n >= 4 && m.variety.kinds.join() === 'ambient,sky,social,travel' && m.subVariety >= 10, `the director's four kinds all seen in the best ten minutes (${m.variety.kinds.join(', ')}; the sessions add the codex, the wow moments, the Baustelle), ${m.subVariety} different acts seen`);
  check(m.spam.per10 <= 2, `spam ${m.spam.per10.toFixed(2)} per 10 minutes (≤ 2)`);
}
{
  const fc = H.fc.filter(f => f.played !== undefined), same = fc.filter(f => f.f === f.played).length;
  check(fc.length >= 50 && same / fc.length >= 0.9, `Funke's forecast of the next slot is what plays: ${same} of ${fc.length}`);
}
// the switch off: the traffic as before (some passes within 250 m); Very Low with the director: coverage
{
  const g0 = makeGame('balanced', false), H0 = run(g0, 10);
  check(H0.starts.length === 0 && H0.nearMin < 250, `lifeDir off: no act, the traffic passes as before (the nearest ${H0.nearMin.toFixed(0)} m)`);
  const gp = makeGame('potato', true), HP = run(gp, 20);
  const kinds = [...new Set(HP.starts.map(s => s.kind))];
  check(kinds.every(k => LD.ACTS[k].tier === 0) && HP.cover >= 0.75, `Very Low: only its acts (${kinds.join(', ')}), a craft in the sky ${(HP.cover * 100).toFixed(1)} % of the time`);
}
// t-wild's heron: in view the idle fill sends it up, behind the eye it stays
{
  for (const [label, hx, hz, want] of [['in view', 8, 60 - 26, true], ['behind', 8, 60 + 26, false]]) {
    const gw = makeGame('high', true), heron = { state: 'stand', t: 0, pos: [hx, 81, hz] };
    gw.wild = { on: true, herons: [heron], rays: [], murm: null };
    const HW = run(gw, 1.5, { stay: true, yaw: 0 });
    const got = HW.starts.some(s => s.kind === 'heron');
    check(got === want && (want ? heron.state === 'crouch' : heron.state === 'stand'), `a heron ${label}: ${got ? 'sent up' : 'left standing'} (acts ${HW.starts.map(s => s.kind).join(', ')})`);
  }
}
// the staging: the balloon 45–80 m out; the close pass and the low pass in front of the eye
{
  const gb = makeGame('high', true), A = gb.lifeDirector; A.auto = false;
  gb.player.pos = [1500, 81, 1500]; gb.cam.x = 1500; gb.cam.z = 1500; A.update(0.1);
  const d = []; for (let k = 0; k < 20; k++) { const ev = A.start('balloon', { k: 1000 + k }); if (ev) d.push(Math.hypot(ev.pos[0] - 1500, ev.pos[2] - 1500)); A.events.length = 0; }
  check(d.length === 20 && Math.min(...d) >= 45 && Math.max(...d) <= 80, `the balloon stands ${Math.min(...d).toFixed(0)}–${Math.max(...d).toFixed(0)} m out (45–80)`);
  const T = gb.traffic; let front = 0, n = 0;
  for (const kind of ['flyby', 'flyover']) for (let k = 0; k < 16; k++) {
    T.ships.length = 0; A.events.length = 0; A.acts.length = 0;
    const ev = A.start(kind, { k: 2000 + k }); if (!ev) continue;
    const lead = T.ships.find(s => s.tag === ev.tag && !s.wing); if (!lead) continue;
    // the path's middle relative to the eye: in front (along the view) and inside the view's height
    const mx = (lead.A[0] + lead.B[0]) / 2 - 1500, mz = (lead.A[2] + lead.B[2]) / 2 - 1500, f = A.fwd, along = mx * f[0] + mz * f[1], up = lead.C[1] - (81 + 1.62);
    n++; if (along > 30 && Math.atan2(up, along) < 32 * DEG) front++;
  }
  check(n === 32 && front === n, `the close pass and the low pass cross in front of the eye, inside the view (${front} of ${n})`);
}
// the session run of 22 Oct (v0.49 + f-flow, run 2): 6 of the walk's 7 acts in its 121-s gap and 3 of the builder's 3
// passes were started out of the view — behind the eye, above the frame, under a wall. An act starts only where the log
// will see it (its stage in the view now, ≥ 0.5 % of the screen: eventlog.js's inView, sessionstats' seen ≥ 0.5); a pass
// only when its nearest point is in the view now, and it comes when the director said (the craft's speed fitted)
{
  const gs = makeGame('high', true), A = gs.lifeDirector; A.auto = false;
  const at = (x, z, yaw, pitch) => { gs.player.pos = [x, 81, z]; gs.player.yaw = yaw; Object.assign(gs.cam, { x, y: 82.62, z, yaw, pitch: pitch || 0 }); A.update(0.1); };
  L.reset(null); L.bind(gs); L.on = true;
  // the village's chimneys (VX + 12, VZ + 12 and VX − 10, VZ + 14) seen from 10 m south of the plaza: facing them, behind
  at(VX + 0.5, VZ - 10, Math.PI); const fwd = A.start('chimneys', { k: 3001 }); A.events.length = 0; A.acts.length = 0;
  at(VX + 0.5, VZ - 10, 0); const back = A.start('chimneys', { k: 3002 }); A.events.length = 0; A.acts.length = 0;
  check(!!fwd && !back, `an act plays only where it is seen: the chimneys' smoke facing them ${fwd ? 'starts' : 'does not start'}, with them behind the eye ${back ? 'starts' : 'does not start'}`);
  // a pass with the eye looking down at its feet (a Baustelle): not now; looking ahead: yes
  at(1500.5, 1500.5, 0, -1.2); const down = A.start('flyby', { k: 3003 }); A.events.length = 0; A.acts.length = 0; gs.traffic.ships.length = 0;
  at(1500.5, 1500.5, 0, 0); const ahead = A.start('flyby', { k: 3004 }); A.events.length = 0; A.acts.length = 0; gs.traffic.ships.length = 0;
  check(!down && !!ahead, `a close pass waits for a view of the sky: looking down ${down ? 'starts' : 'does not start'}, looking ahead ${ahead ? 'starts' : 'does not start'}`);
  // on time: 24 passes (all kinds of craft): the lead's nearest point to the eye within 3 s of the director's moment
  const T = gs.traffic, late = [];
  for (let k = 0; k < 24; k++) {
    T.ships.length = 0; A.events.length = 0; A.acts.length = 0; at(1500.5, 1500.5, k * 0.7, 0);
    const kind = k % 3 === 2 ? 'flyover' : 'flyby', ev = A.start(kind, { k: 4000 + k }); if (!ev) { late.push(kind + ' did not start'); continue; }
    const lead = T.ships.find(s => s.tag === ev.tag && !s.wing); if (!lead) { late.push(kind + ' no craft'); continue; }
    let best = 1e9, bt = 0; const t0 = T.time;
    for (let i = 0; i < 600 && !lead.dead && lead.t < 1; i++) { T.update(0.1); const d = Math.hypot(lead.pos[0] - 1500.5, lead.pos[2] - 1500.5); if (d < best) { best = d; bt = T.time; } }
    const want = t0 + ev.eta; if (!(Math.abs(bt - want) <= 3)) late.push(`${kind} ${lead.arch} ${(bt - want).toFixed(1)} s`);
  }
  check(!late.length, `the passes come on time: the nearest point within 3 s of the director's moment in 24 of 24 (${late.slice(0, 4).join(', ') || 'all'})`);
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

// The Regisseur des Lebens (docs/superpowers/plans/2026-10-09-t-life.md §3.3–3.4, src/main/lifedirector.js):
//  · the slots: 20–40 s apart; the choice a pure function of (seed, slot, place, hour, weather, festival, tier); never the
//    same act twice in a row; a town plaza through a day sees ≥ 10 different acts and few quiet slots;
//  · every act's trigger rule (its places, its hours, the weather, a festival, what it needs near) and its cost tier;
//    Very Low (tier 0) runs only birds, lanterns and chimneys; ≥ 12 acts;
//  · the hours (§3.4): dawn the convoy · morning carts, pigeons, the balloon · noon the bells · afternoon kids, the musician,
//    the dog · dusk the lantern lighter, chimneys, music · night meteors;
//  · in a game (a stand-in world: a plaza with lamps, a fountain, a wall, a pond, chimneys): every act starts where it
//    should, runs and is drawn without an error and ends within its time; the lantern lighter lights the lamps one by
//    one; on Very Low the director spends nothing on acts above its tier; the switch off spends nothing.
//   bash test/wt_run.sh life_director.js 300
const V = require('./load_shared.js');
global.window = global.window || {};
global.performance = global.performance || { now: () => Date.now() };
for (const f of ['lifekit', 'lifedirector']) require(__dirname + '/../src/main/' + f + '.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const LD = V.LifeDirector;
check(!!LD && !!LD.pick && !!LD.Actor, 'the Regisseur exists (VR.LifeDirector: pick, Actor)');

// ---------------------------------------------------------------- the acts: how many, their tiers
const names = LD.NAMES;
check(names.length >= 12, `at least twelve acts (${names.length}: ${names.join(', ')})`);
check(names.every(n => { const A = LD.ACTS[n]; return A.tier >= 0 && A.tier <= 3 && A.dur > 0 && A.places.length && A.hours.length && LD.ACT[n] && LD.ACT[n].start && LD.ACT[n].update; }), 'every act has a cost tier, a duration, its places and hours, and its actor');

// ---------------------------------------------------------------- the slots
{
  let minGap = 1e9, maxGap = 0;
  for (const seed of [1, -77, 4242]) for (let k = 0; k < 3000; k++) { const g = LD.slotTime(seed, k + 1) - LD.slotTime(seed, k); minGap = Math.min(minGap, g); maxGap = Math.max(maxGap, g); }
  check(minGap >= 20 && maxGap <= 40, `the slots come 20–40 s apart (${minGap.toFixed(1)} – ${maxGap.toFixed(1)})`);
  let bad = 0; for (let t = 0; t < 20000; t += 3.7) { const k = LD.slotAt(4242, t); if (!(LD.slotTime(4242, k) <= t && LD.slotTime(4242, k + 1) > t)) bad++; }
  check(!bad, `slotAt finds the latest slot at any time (${bad} wrong)`);
}

// ---------------------------------------------------------------- the choice: pure, never twice in a row
const ALLHAS = { lamps: true, chimneys: true, fountain: true, water: true };
const ctxOf = (place, hour, o) => Object.assign({ place, hour, wet: false, fest: false, tier: 2, has: ALLHAS }, o || {});
{
  let repeats = 0, impure = 0, total = 0, quiet = 0;
  for (const place of LD.PLACES) for (const hour of LD.HOURS) for (const tier of [0, 1, 2]) {
    const ctx = ctxOf(place, hour, { tier });
    let prev = undefined;
    for (let k = 0; k < 400; k++) {
      const a = LD.pick(4242, k, ctx), b = LD.pick(4242, k, Object.assign({}, ctx, { has: Object.assign({}, ALLHAS) }));
      if (a !== b) impure++;
      if (a && a === prev) repeats++;
      if (!a) quiet++;
      prev = a; total++;
    }
  }
  check(!impure, `the choice is a pure function of (seed, slot, place, hour, …): ${impure} differences on a second call`);
  check(!repeats, `never the same act twice in a row (${repeats} repeats in ${total} slots)`);
  const s1 = [], s2 = []; for (let k = 0; k < 40; k++) { s1.push(LD.pick(1, k, ctxOf('plaza', 'afternoon'))); s2.push(LD.pick(2, k, ctxOf('plaza', 'afternoon'))); }
  check(s1.join() !== s2.join(), 'another world (seed) has another sequence');
}
// a town plaza through a day (tier 2): many acts, few quiet slots
{
  const seen = new Set(); let quiet = 0, n = 0;
  for (let k = 0; k < 2880; k++) { const tod = (k * 30 * 20) % 24000, ctx = ctxOf('plaza', LD.hourOf(tod)); const a = LD.pick(4242, k, ctx); if (a) seen.add(a); else quiet++; n++; }
  check(seen.size >= 10 && quiet / n < 0.2, `a plaza through a day sees ${seen.size} different acts, ${(quiet / n * 100).toFixed(1)} % quiet slots`);
}

// ---------------------------------------------------------------- every act's trigger rule
{
  const otherPlace = (A) => LD.PLACES.find(p => !A.places.includes(p));
  const otherHour = (A) => LD.HOURS.find(x => !A.hours.includes(x));
  let ok = 0;
  for (const n of names) {
    const A = LD.ACTS[n], base = ctxOf(A.places[0], A.hours[0], { tier: A.tier, fest: !!A.fest });
    const yes = LD.allowed(n, base);
    const noPlace = otherPlace(A) ? !LD.allowed(n, Object.assign({}, base, { place: otherPlace(A) })) : true;
    const noHour = otherHour(A) ? !LD.allowed(n, Object.assign({}, base, { hour: otherHour(A) })) : true;
    const noTier = A.tier > 0 ? !LD.allowed(n, Object.assign({}, base, { tier: A.tier - 1 })) : true;
    const noWet = A.wx === 'dry' ? !LD.allowed(n, Object.assign({}, base, { wet: true, place: A.places.find(p => p !== 'hall') || A.places[0] })) : LD.allowed(n, Object.assign({}, base, { wet: true }));
    const noNeed = A.need ? !LD.allowed(n, Object.assign({}, base, { has: Object.assign({}, ALLHAS, { [A.need]: false }) })) : true;
    const noFest = A.fest ? !LD.allowed(n, Object.assign({}, base, { fest: false })) : true;
    const good = yes && noPlace && noHour && noTier && noWet && noNeed && noFest;
    if (good) ok++; else console.log('    rule', n, { yes, noPlace, noHour, noTier, noWet, noNeed, noFest });
  }
  check(ok === names.length, `every act keeps its trigger rule: its places, hours, weather, festival, what it needs, its tier (${ok} of ${names.length})`);
  // the rules as the plan says
  const has = (place, hour, n, o) => LD.allowed(n, ctxOf(place, hour, o));
  check(has('plaza', 'dusk', 'lanterns') && !has('plaza', 'noon', 'lanterns') && has('hall', 'dusk', 'lanterns') && !has('plaza', 'dusk', 'lanterns', { has: { lamps: false } }), 'the lantern lighter: towns at dusk, where lamps stand');
  check(has('wild', 'night', 'meteor') && !has('wild', 'noon', 'meteor') && !has('hall', 'night', 'meteor') && !has('wild', 'night', 'meteor', { wet: true }), 'meteors: at night, outdoors, when it is dry');
  check(has('hills', 'morning', 'balloon') && !has('hills', 'night', 'balloon') && !has('hills', 'morning', 'balloon', { wet: true }), 'the balloon: over the hills by day, when it is dry');
  check(has('plaza', 'dusk', 'fireworks', { fest: true }) && !has('plaza', 'dusk', 'fireworks'), 'fireworks: only on a festival evening');
  check(has('water', 'morning', 'fisher') && !has('water', 'morning', 'fisher', { has: { water: false } }) && !has('plaza', 'morning', 'fisher'), "the fisherman: at the water's edge");
  check(has('plaza', 'noon', 'dog') && !has('street', 'noon', 'dog') && !has('plaza', 'noon', 'dog', { has: { fountain: false } }), 'the dog: at a plaza with its fountain');
  check(has('hall', 'noon', 'kids', { wet: true }) && !has('plaza', 'noon', 'kids', { wet: true }), "under the Weißstadt's vault the rain does not matter");
}

// ---------------------------------------------------------------- the hours (§3.4) and the tiers
{
  const C = (place, hour, tier) => LD.candidates(ctxOf(place, hour, { tier: tier === undefined ? 2 : tier }));
  const inH = (hour, list) => list.every(n => LD.ACTS[n].hours.includes(hour));
  check(C('wild', 'dawn').includes('convoy') && C('plaza', 'dawn').includes('chimneys'), 'dawn: the sunrise convoy, the first chimney smoke');
  check(inH('morning', ['cart', 'pigeons', 'balloon']) && C('street', 'morning').includes('cart') && C('plaza', 'morning').includes('pigeons'), 'morning: carts along the street, pigeons on the plaza, the balloon');
  check(C('plaza', 'noon').includes('bells'), 'noon: the bells');
  check(['kids', 'musician', 'dog', 'pigeons'].every(n => C('plaza', 'afternoon').includes(n)), 'afternoon: the plaza fills — kids, the musician, the dog, pigeons');
  check(['lanterns', 'chimneys', 'musician'].every(n => C('plaza', 'dusk').includes(n)), 'dusk: the lantern lighter, chimneys, music');
  check(C('wild', 'night').includes('meteor') && C('wild', 'night').includes('flyover'), 'night: meteors, a lit low pass');
  let off = 0; for (const p of LD.PLACES) for (const hr of LD.HOURS) for (const n of C(p, hr, 0)) if (!['birds', 'lanterns', 'chimneys'].includes(n)) off++;
  check(!off, `Very Low runs only birds, lanterns and chimneys (${off} others)`);
  let empty = []; for (const p of LD.PLACES) for (const hr of LD.HOURS) if (!C(p, hr, 2).length) empty.push(p + '@' + hr);
  check(empty.length <= 2, `on Balanced nearly every place and hour has an act (${empty.length} empty: ${empty.join(' ')})`);
  check(LD.hourOf(0) === 'dawn' && LD.hourOf(3000) === 'morning' && LD.hourOf(6000) === 'noon' && LD.hourOf(9000) === 'afternoon' && LD.hourOf(12600) === 'dusk' && LD.hourOf(18000) === 'night' && LD.hourOf(23000) === 'dawn', 'the hours: dawn 22500–1500, morning, noon 5000–7000, afternoon, dusk 11000–13800, night');
  const info = { heart: true, villages: [{ x: 0, z: -140, rad: 120, style: 'tech', plaza: { x: -8, z: -60, r: 4 } }, { x: -944, z: -296, rad: 150, style: 'hall', plaza: { x: -944, z: -296, r: 9 } }] };
  check(LD.placeOf([-8, 82, -62], info) === 'plaza' && LD.placeOf([30, 82, -150], info) === 'street' && LD.placeOf([-950, 74, -300], info) === 'hall' && LD.placeOf([-42, 89, 26], info) === 'hangar' && LD.placeOf([30, 120, -300], info) === 'hills' && LD.placeOf([330, 160, 140], info) === 'isles' && LD.placeOf([2000, 70, 2000], info) === 'wild' && LD.placeOf([2000, 70, 2000], { water: true }) === 'water', 'the places: plaza, street, the hall city, the Gate Temple, the Pod Hills, the Sky Isles, the water, the wild');
}

// ---------------------------------------------------------------- in a game: every act starts, runs, is drawn and ends
{
  const R = V.R, st = (n) => R.byName[n].defaultState;
  const STONE = st('stone'), WATER = st('water'), LAMP = st('vx_lamppost');
  // the stand-in world: ground 80 (stand at 81); a wall x 6, z −6 … 6 up to 82 (stand 83 on it); a pond x ≤ −14 (top 80);
  // lamp posts round the plaza; chimneys on the houses
  const lamps = [[4, 0], [-4, 0], [0, 6], [8, 8], [-8, 8], [10, -6]];
  const getBlock = (x, y, z) => {
    if (x <= -14 && y === 80) return WATER;
    if (y <= 80) return STONE;
    if (x === 6 && z >= -6 && z <= 6 && y <= 82) return STONE;
    for (const [lx, lz] of lamps) if (x === lx && z === lz && (y === 81 || y === 82)) return LAMP;
    return 0;
  };
  V.Folk = V.Folk || {}; V.Folk.look = V.Folk.look || ((seed, role) => ({ role })); V.Folk.model = () => ({ def: {} });
  V.getVoxModel = V.getVoxModel || (() => ({ def: { radius: 1 }, parts: {} }));
  V.Companions = V.Companions || { poseOf: () => ({}) };
  const calls = { part: 0, model: 0, tone: 0, flights: 0 };
  const mk = (preset, pos, yaw, tod, o) => {
    const plan = { x: 0, z: 2, rad: 60, style: 'meadow', plaza: { x: 0, y: 81, z: 2, r: 4 }, lamps: [], chimneys: [[12, 86, 12], [-10, 86, 14]], bell: [2, 81, 2] };
    const g = Object.assign({ state: 'play', dim: 'overworld', settings: { preset }, meta: { seed: 4242, vgen: 9, type: 'default' }, time: 0,
      env: { day: 1, ticks: tod, timeOfDay: tod, E: { sunDir: [0.4, 0.6, -0.69], night: tod > 13800 && tod < 22500 ? 1 : 0, rain: 0, windDir: [1, 0], wind: 1 } },
      player: { pos: pos.slice(), yaw }, cam: { x: pos[0], y: pos[1] + 1.62, z: pos[2], yaw },
      world: { getBlock, topAt: (x, z) => (x <= -14 ? 80 : x === 6 && z >= -6 && z <= 6 ? 82 : 80) },
      particles: { spawn() { calls.part++; return 0; }, spark() { calls.part++; }, splash() { calls.part++; }, glow() { calls.part++; } },
      audio: { ctx: { currentTime: 0 }, tone() { calls.tone++; } },
      traffic: { ships: [], spawnFlight(opts) { calls.flights++; this.ships.push({ tag: opts.over && opts.over.tag }); } },
      villages: { known: new Map([['v', { plan }]]), festivalNear: () => (o && o.fest ? { plan, fest: true } : null), F: { rockets: [] }, festState() { return this.F; } },
      entities: { beginVox: () => ({ u: {} }), drawModel() { calls.model++; }, lightAt: () => ({ sky: 1, bl: [0, 0, 0] }), sunShade: () => 0 } }, o || {});
    return g;
  };
  const planes = new Float32Array(24); for (let i = 0; i < 6; i++) planes[i * 4 + 3] = 1;
  const rr = { planes, gl: {}, cam: { x: 0, y: 82.6, z: 14 } };
  // the scene of each act: the eye's place, its look (yaw), the hour
  const SC = {
    birds: [[0, 81, 14], 0, 6000], lanterns: [[0, 81, 14], 0, 12600], chimneys: [[0, 81, 14], 0, 12600], flyover: [[0, 81, 14], 0, 6000],
    convoy: [[0, 81, 14], 0, 23000], cat: [[0, 81, 0.5], -Math.PI / 2, 9000], pigeons: [[0, 81, 14], 0, 6000], cart: [[0, 81, 14], 0, 4000],
    meteor: [[0, 81, 14], 0, 18000], balloon: [[0, 81, 14], 0, 4000], bells: [[0, 81, 14], 0, 6000], fireworks: [[0, 81, 14], 0, 13000],
    kids: [[0, 81, 20], 0, 9000], musician: [[0, 81, 14], 0, 9000], dog: [[0, 81, 14], 0, 9000], skyray: [[0, 81, 14], 0, 9000], fisher: [[-10, 81, 0], Math.PI / 2, 9000],
  };
  const res = [];
  for (const n of names) {
    const sc = SC[n]; if (!sc) { res.push(n + ':no scene'); continue; }
    for (const k in calls) calls[k] = 0;
    const g = mk('high', sc[0], sc[1], sc[2], { fest: n === 'fireworks' }), A = new LD.Actor(g); A.auto = false;
    let ok = true, ended = false, steps = 0, lit = 0;
    try {
      A.update(0.05);
      if (!A.force(n)) { res.push(n + ':no start'); continue; }
      for (let i = 0; i < 4000 && A.events.length; i++) { g.time += 0.05; A.update(0.05); A.draw(rr, {}, 'opaque', g.cam); steps++; lit = Math.max(lit, A.stats().lit); }
      ended = !A.events.length;
    } catch (e) { ok = false; console.log(n, e.stack); }
    const dur = LD.ACTS[n].dur;
    if (!ok || !ended || steps * 0.05 > dur + 12) res.push(n + ':' + (ok ? 'ran ' + (steps * 0.05).toFixed(0) + ' s' : 'error'));
    if (n === 'lanterns' && lit < 3) res.push('lanterns: lit ' + lit);
    const drawn = LD.ACT[n].draw ? calls.model > 0 : true, seen = calls.part + calls.model + calls.flights + g.villages.F.rockets.length > 0;
    if (!drawn || !seen) res.push(n + ': nothing shown');
  }
  check(!res.length, `every act starts in its scene, runs, shows and ends within its time (${names.length - res.length} of ${names.length}${res.length ? ': ' + res.join(' · ') : ''})`);
  // the slots in a game: an hour at the plaza in the afternoon starts acts every 20–40 s
  for (const k in calls) calls[k] = 0;
  const g = mk('high', [0, 81, 14], 0, 9000), A = new LD.Actor(g);
  for (let i = 0; i < 20 * 600; i++) { g.time += 0.05; A.update(0.05); if (i % 6 === 0) A.draw(rr, {}, 'opaque', g.cam); }
  const S = A.stats();
  check(S.started >= 12 && Object.keys(S.startedKinds).length >= 4, `ten minutes at the plaza in the afternoon: ${S.started} acts started (${JSON.stringify(S.startedKinds)})`);
  // Very Low: only its acts; the switch off: nothing
  for (const k in calls) calls[k] = 0;
  const g0 = mk('potato', [0, 81, 14], 0, 12600), A0 = new LD.Actor(g0);
  for (let i = 0; i < 20 * 300; i++) A0.update(0.05);
  check(Object.keys(A0.stats().startedKinds).every(n => LD.ACTS[n].tier === 0) && A0.stats().started > 0, `Very Low at dusk: only birds, lanterns, chimneys (${JSON.stringify(A0.stats().startedKinds)})`);
  for (const k in calls) calls[k] = 0;
  const g1 = mk('high', [0, 81, 14], 0, 9000); g1.settings.lifeDir = false; const A1 = new LD.Actor(g1);
  for (let i = 0; i < 20 * 120; i++) { A1.update(0.05); A1.draw(rr, {}, 'opaque', g1.cam); }
  check(A1.stats().started === 0 && calls.part === 0 && calls.model === 0, 'lifeDir off: no act, nothing spent');

  // a street with café tables (the Weißstadt's main street, run 1 of test/life.mjs: the pigeons found no spot): tables
  // and chairs stand in a checkerboard across the view 6–13 m ahead; the pigeons and the kids find level ground past
  // them or beside them, never on a table, within 24 m
  {
    const T = (x, z) => z >= 1 && z <= 8 && Math.abs(x) <= 6 && ((x + z) & 1) === 0;
    const W2 = { getBlock: (x, y, z) => (y <= 80 ? STONE : y === 81 && T(x, z) ? STONE : 0), topAt: (x, z) => (T(x, z) ? 81 : 80) };
    const out = [];
    for (const n of ['pigeons', 'kids']) for (const seedK of [0, 1, 2, 3]) {
      const g = mk('high', [0.5, 81, 14.5], 0, 9000, { world: W2 }), A = new LD.Actor(g); A.auto = false; A.update(0.05);
      const ev = A.start(n, { k: 100 + seedK });
      if (!ev) { out.push(n + seedK + ': no spot'); continue; }
      const spots = n === 'pigeons' ? ev.b.map(b => [b.x, b.z]) : ev.k2.map(k => [k.home[0], k.home[2]]);
      for (const [x, z] of spots) { if (T(Math.floor(x), Math.floor(z))) out.push(n + seedK + ': on a table'); if (Math.hypot(x - 0.5, z - 14.5) > 24) out.push(n + seedK + ': too far'); }
    }
    check(!out.length, `among café tables the pigeons and the kids find level ground (8 of 8 starts${out.length ? ': ' + out.join(' · ') : ''})`);
  }
  // the tier drops (⚙ Very Low chosen while an act runs): the acts above it end at once; the lantern lighter goes, his
  // lamps light on by themselves
  {
    const g = mk('high', [0, 81, 14], 0, 12600), A = new LD.Actor(g); A.auto = false; A.update(0.05);
    A.force('balloon'); A.force('lanterns'); A.update(0.05);
    const before = A.events.map(e => e.kind).sort().join(), fig0 = !!(A.events.find(e => e.kind === 'lanterns') || {}).fig;
    g.settings.preset = 'potato'; A.update(0.05);
    const L = A.events.find(e => e.kind === 'lanterns');
    for (let i = 0; i < 400 && L && L.lit < L.route.length; i++) A.update(0.05);
    check(before === 'balloon,lanterns' && fig0 && !A.events.some(e => e.kind === 'balloon') && L && !L.fig && L.lit === L.route.length, `Very Low chosen mid-act: the balloon ends, the lamplighter goes and the lamps light by themselves (${before} → ${A.events.map(e => e.kind).join()}, lit ${L && L.lit} of ${L && L.route.length})`);
  }
  // the place or the hour changes between two slots (run 2 of test/life.mjs: "cat" at the plaza in the morning, then
  // "cat" again at dusk — each slot's neighbours had been picked for its own context): never the same act twice in a row
  {
    const g = mk('high', [0, 81, 14], 0, 9000), A = new LD.Actor(g); A.auto = false; A.update(0.05);
    const cA = Object.assign(A.context(), { hour: 'morning' }), cB = Object.assign(A.context(), { hour: 'dusk' });
    let found = 0, twice = 0;
    for (let k = 1; k < 4000 && found < 12; k++) {
      if (!LD.pick(A.seed, k - 1, cA) || LD.pick(A.seed, k - 1, cA) !== LD.pick(A.seed, k, cB)) continue;
      found++; A.history.length = 0;
      A.ctx = cA; A.slot(k - 1); const a = A.st.pick;
      A.ctx = cB; A.slot(k); if (A.st.pick && A.st.pick === a) twice++;
      A.events.length = 0;
    }
    check(found > 0 && twice === 0, `the context changes between two slots: never the same act twice in a row (${twice} of ${found} such pairs)`);
  }
  // t-polish · the cart is the streets' regular: its own clock (28–40 s apart, pure); in a town by day the first one comes
  // within 40 s of arriving — in the generated Weißstadt's street at noon (seed 53, t-town's P1: the street toward the
  // plaza) and on Nova Haven's avenue (t-beauty's street_3) — and it is in the view at once and stays a while (t-life's
  // picture: started, but out of the frame)
  {
    let minG = 1e9, maxG = 0;
    for (const seed of [1, -77, 4242]) for (let m = 0; m < 3000; m++) { const d = LD.cartTime(seed, m + 1) - LD.cartTime(seed, m); minG = Math.min(minG, d); maxG = Math.max(maxG, d); }
    let bad = 0; for (let t = 0; t < 20000; t += 3.3) { const m = LD.cartAt(4242, t); if (!(LD.cartTime(4242, m) <= t && LD.cartTime(4242, m + 1) > t)) bad++; }
    check(minG >= 27.9 && maxG <= 40 && !bad && LD.cartRegular(ctxOf('hall', 'noon')) && LD.cartRegular(ctxOf('street', 'morning')) && !LD.cartRegular(ctxOf('street', 'dusk')) && !LD.cartRegular(ctxOf('hills', 'noon')) && !LD.cartRegular(ctxOf('street', 'noon', { tier: 0 })),
      `the cart's own clock: ${minG.toFixed(1)} – ${maxG.toFixed(1)} s apart (cartAt right at every time: ${bad} wrong); a regular of the streets, plazas and hall cities by day, not at dusk, not on the hills, not on Very Low`);
    const VG = V.VillageGen, R2 = V.R;
    const og = new V.OverworldGen(53, { worldType: 'default', vgen: 10 });
    const cache = new Map();
    const colOf = (cx, cz) => { const k = cx + ',' + cz; let c = cache.get(k); if (!c) { c = og.generate(cx, cz); cache.set(k, c); } return c; };
    const getB = (x, y, z) => { x = Math.floor(x); y = Math.floor(y); z = Math.floor(z); if (y < 0) return 1; const c = colOf(x >> 4, z >> 4); if (y >= c.blocks.length >> 8) return 0; return c.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)]; };
    const topB = (x, z) => { for (let y = 200; y > 0; y--) { const s = getB(x, y, z); if (s && (R2.T.flags[s] & (V.F.SOLID | V.F.FLUID))) return y; } return 0; };
    // the two places' plans (the villages the game would know there)
    let hall = null, nova = null;
    for (let j = -3; j <= 1 && !(hall && nova); j++) for (let i = -3; i <= 1; i++) { const s = VG.site(og, i, j); if (!s) continue; if (!hall && s.style === 'hall' && i === -2 && j === -1) hall = VG.plan(og, s); if (!nova && s.name === 'Nova Haven') nova = VG.plan(og, s); }
    const SCENES = [];
    if (hall) { const H = hall.hall; SCENES.push({ name: 'the Weißstadt\'s street', plan: hall, feet: [H.cx - 24.5, H.F + 1, H.cz - 0.5], at: [H.cx + 40, H.F + 9, H.cz - 0.5] }); }
    if (nova) SCENES.push({ name: 'Nova Haven\'s avenue', plan: nova, feet: [1.5, topB(1, -63) + 1, -62.5], at: [1, 83, -100] });
    const out = [];
    for (const sc of SCENES) {
      const P = sc.plan, eyeY = sc.feet[1] + 1.62, dx = sc.at[0] - sc.feet[0], dz = sc.at[2] - sc.feet[2], yaw = Math.atan2(-dx, -dz);
      const known = new Map([[P.id, { plan: Object.assign({}, P, { rad: P.rad || (P.style === 'hall' ? 150 : 75) }) }]]);
      const g = mk('high', sc.feet, yaw, 6000, { world: { getBlock: getB, topAt: topB }, villages: { known, festivalNear: () => null, F: { rockets: [] }, festState() { return this.F; } } });
      g.settings.fov = 66;
      const A = new LD.Actor(g);
      // the director runs from the moment the eye arrives; the first cart within 40 s, then where it is
      let t = 0, ev = null, t0 = null, firstSeen = null, seen = 0, nearest = 1e9;
      const tanH = A.tanH, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      for (let i = 0; i < 20 * 60; i++) {
        t += 0.05; g.time = t; A.update(0.05);
        if (!ev) { ev = A.events.find(e => e.kind === 'cart') || null; if (ev) t0 = t; continue; }
        if (!A.events.includes(ev) || t - t0 > 12) break;
        const ex = ev.pos[0] - sc.feet[0], ez = ev.pos[2] - sc.feet[2], fwd = ex * fx + ez * fz, lat = Math.abs(ex * -fz + ez * fx);
        if (fwd > 1 && lat < fwd * tanH * 0.95 && Math.hypot(ex, ez) < 48) { seen += 0.05; if (firstSeen === null) firstSeen = t - t0; nearest = Math.min(nearest, Math.hypot(ex, ez)); }
      }
      const ok = ev && t0 <= 40 && firstSeen !== null && firstSeen <= 3 && seen >= 4;
      if (!ok) out.push(sc.name);
      console.log(`    ${sc.name}: the place ${A.stats().place}, a cart ${ev ? 'started ' + t0.toFixed(1) + ' s after the arrival (' + (ev.run.length) + ' points, ' + ev.path.L.toFixed(0) + ' m)' : 'never'}; in the view ${firstSeen === null ? 'never' : firstSeen.toFixed(1) + ' s after its start, for ' + seen.toFixed(1) + ' s, nearest ' + nearest.toFixed(0) + ' m'}`);
    }
    check(SCENES.length === 2 && !out.length, `the cart within 40 s in the street at noon and in the view at once, for seconds (${SCENES.length - out.length} of ${SCENES.length} places${out.length ? ': not at ' + out.join(', ') : ''})`);
  }
  // the eye goes far away (a flight, a teleport): an act left 200 blocks behind ends (nothing is spent on it any more)
  {
    const g = mk('high', [0, 81, 14], 0, 12600), A = new LD.Actor(g); A.auto = false; A.update(0.05);
    A.force('lanterns'); A.force('chimneys'); A.update(0.05);
    const n0 = A.events.length;
    g.player.pos[0] += 260; g.cam.x += 260; A.update(0.05);
    check(n0 === 2 && A.events.length === 0, `an act 200 blocks behind the eye ends (${n0} → ${A.events.length})`);
  }
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

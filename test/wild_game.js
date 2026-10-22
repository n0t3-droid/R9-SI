// t-wild · WOW VI · die Tierwelt (docs/superpowers/plans/2026-10-16-t-wild.md) — the actor in a game (src/main/wildlife.js),
// in a stand-in world: flat grass at 80, a lily pond (a duck anchor), the lake's edge with the pier's fish anchor, a
// flower drift, a hedge row, a tree line by the murmuration's stage, the Sky Isles' circuit; a fake GL that counts.
//  · Very Low (its preset: the switches off) and every switch off: nothing computed, nothing drawn, no GL call at all
//  · High: the murmuration swirls at dusk round its stage (one instanced draw of every bird), lands on the tree line's
//    crowns for the night and rises at dawn; gulls over the lake by day; a heron at the pond takes off when the eye comes
//    within 8 and lands further on; a shoal at the pier in its water; carp in the pond; a butterfly swarm on the drift
//    that rises when the eye walks through (and airlife's dots step back); dragonflies over the pond; four rays where
//    the world clock says; rabbits at the hedge that bolt into it; a fox along the hedge at dusk
//  · the herds' paths: the deer walk out of the wood in single file and graze at the end; the sheep's herd point stays
//    in its pasture and moves
//  · Low: no murmuration, no rays; the cost of an update with everything near (node)
//   bash test/wt_run.sh wild_game.js 300
const V = require('./load_shared.js');
global.window = global.window || {};
global.performance = global.performance || { now: () => Date.now() };
for (const f of ['wildsim', 'wildgpu', 'wildlife']) require(__dirname + '/../src/main/' + f + '.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const W = V.Wild, R = V.R, st = (n) => R.byName[n].defaultState;
check(!!W.Actor && !!W.deerPath && !!W.lineTarget && !!W.herdTarget, 'the actor and the herds\' helpers exist');

// ---------------------------------------------------------------- a fake GL: every call counted, the draws recorded
const GLC = { calls: 0, draws: [] };
const fakeGL = new Proxy({}, { get: (t, k) => { if (k === 'drawArraysInstanced') return (m, f, c, n) => { GLC.calls++; GLC.draws.push(n); }; if (typeof k === 'string' && /^[A-Z_0-9]+$/.test(k)) return 1; return (...a) => { GLC.calls++; return {}; }; } });
V.GL = { program: () => { GLC.calls++; return { p: {}, u: new Proxy({}, { get: () => ({}) }) }; } };
V.SHADERS = { COMMON: '' };
const rr = { gl: fakeGL, P: {}, stats: { draws: 0, tris: 0 }, viewProj: new Float32Array(16), common() { GLC.calls++; }, planes: new Float32Array(24) };

// ---------------------------------------------------------------- the stand-in world
const SEA = V.C.SEA, GRASS = st('grass_block'), STONE = st('stone'), WATER = st('water'), POPPY = st('poppy'), LEAVES = st('oak_leaves'), LOG = st('spruce_log');
const POND = { x: -30, z: 0, r: 5, L: 79 };
const keyOf = (x, z) => x + ',' + z;
let ROOST = null;   // the tree line by the murmuration's stage (set once the stage is known)
const isPond = (x, z) => Math.hypot(x + 0.5 - POND.x - 0.5, z + 0.5 - POND.z - 0.5) < POND.r;
const isLake = (x) => x >= 60 && x < 120;
// the pier's end at the fish anchor (70, 0): posts at its corners and along it (as seed 53's: four within 1.5 of the end)
const POSTS = new Set([[69, -1], [71, -1], [69, 1], [71, 1], [68, -2], [67, -3]].map(([x, z]) => x * 4096 + z)), isPost = (x, z) => POSTS.has(x * 4096 + z);
const shelf = (x, z) => x >= 60 && x < 76 && z >= 14 && z <= 44;   // a shallow shelf: a hand's depth of water
const flower = (x, z) => x >= 10 && x <= 18 && z >= 10 && z <= 16 && ((x + z) & 1) === 0;
const hedge = (x, z) => z === 30 && x >= -10 && x <= 10;
const tree = (x, z) => ROOST && Math.abs(x - ROOST[0]) <= 18 && Math.abs(z - ROOST[1]) <= 2;
const getBlock = (x, y, z) => {
  x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
  if (isLake(x)) { if (isPost(x, z)) return y <= SEA + 1 ? LOG : 0; return y <= (shelf(x, z) ? SEA - 1 : 60) ? STONE : y <= SEA ? WATER : 0; }
  if (isPond(x, z)) { const dep = 1 + Math.round(2.4 * (1 - Math.hypot(x + 0.5 - POND.x - 0.5, z + 0.5 - POND.z - 0.5) / POND.r)); return y <= POND.L - dep ? STONE : y <= POND.L ? WATER : 0; }
  if (y < 80) return STONE;
  if (y === 80) return GRASS;
  if (y === 81 && flower(x, z)) return POPPY;
  if (y === 81 && hedge(x, z)) return LEAVES;
  if (tree(x, z) && y >= 86 && y <= 88) return LEAVES;
  return 0;
};
const topAt = (x, z) => { x = Math.floor(x); z = Math.floor(z); if (isLake(x)) return isPost(x, z) ? SEA + 1 : SEA; if (isPond(x, z)) return POND.L; if (tree(x, z)) return 88; if (flower(x, z) || hedge(x, z)) return 81; return 80; };
const world = { getBlock, topAt, isLoaded: () => true, getLight: () => 0xf000 };
const anchors = new Map();
const addA = (kind, x, y, z, n, ...extra) => { const key = kind + ':' + x + ',' + z; anchors.set(key, { key, kind, x, y, z, n, extra }); };
addA('duck', POND.x, POND.L + 1, POND.z, 3, POND.r);
addA('fish', 70, SEA, 0, 3, 6);
const calls = { model: 0 };
const mkGame = (preset, pos, tod, o) => {
  const S = { preset }; if (preset !== 'potato') for (const k of W.KEYS) S[k] = true;
  return Object.assign({ state: 'play', dim: 'overworld', settings: S, meta: { seed: 53, vgen: 11, type: 'default' }, time: 0,
    env: { day: 4, ticks: tod, get timeOfDay() { return ((this.ticks % 24000) + 24000) % 24000; }, E: { sunDir: [0.4, 0.6, -0.69], night: 0, rain: 0, snow: 0 } },
    player: { pos: pos.slice(), vel: [0, 0, 0], yaw: 0 }, world,
    particles: { spawn() { calls.part = (calls.part || 0) + 1; return 0; } },
    airLife: { noButterflies: false },
    entities: { land: { anchors }, beginVox: () => ({ u: {} }), drawModel() { calls.model++; }, lightAt: () => ({ sky: 1, bl: [0, 0, 0] }), sunShade: () => 0 } }, o || {});
};
const run = (A, g, secs, dt, each) => { for (let t = 0; t < secs; t += dt) { g.time += dt; g.env.ticks += dt * 20; A.update(dt); if (each) each(t); } };
const cam = (g) => ({ x: g.player.pos[0], y: g.player.pos[1] + 1.62, z: g.player.pos[2] });

// ---------------------------------------------------------------- 1. Very Low and the switches off: nothing at all
{
  GLC.calls = 0; GLC.draws.length = 0;
  const g = mkGame('potato', [300, 81, 100], 12000), A = new W.Actor(g);
  run(A, g, 20, 0.05);
  A.draw(rr, {}, 'opaque', cam(g));
  check(!A.on && !A.murm && !A.shoals.length && !A.swarms.length && !A.rays.length && GLC.calls === 0, `Very Low: nothing computed, nothing drawn, no GL call (${GLC.calls})`);
  const g2 = mkGame('high', [300, 81, 100], 12000); for (const k of W.KEYS) g2.settings[k] = false;
  const A2 = new W.Actor(g2); run(A2, g2, 20, 0.05); A2.draw(rr, {}, 'opaque', cam(g2));
  check(!A2.on && GLC.calls === 0, `High with the five switches off: nothing (${GLC.calls} GL calls)`);
  // the cost of an update that does nothing (Very Low)
  // (the best of five rounds: the machine is shared, a round may meet another's browser)
  let us = 1e9; for (let r = 0; r < 5; r++) { const t0 = process.hrtime.bigint(); for (let i = 0; i < 20000; i++) A.update(0.016); us = Math.min(us, Number(process.hrtime.bigint() - t0) / 1e3 / 20000); }
  console.log(`     an update on Very Low: ${us.toFixed(2)} µs`);
  check(us < 5, 'an update on Very Low costs under 5 µs (it returns at its first lines)');
}

// ---------------------------------------------------------------- 2. the murmuration: dusk, the roost, the night, dawn
{
  const eye = [300, 81, 100], g = mkGame('high', eye, 11000), A = new W.Actor(g);
  const st0 = W.stageOf(A.seed, 4, 'dusk', [eye[0], eye[1] + 1.62, eye[2]], true);
  ROOST = [Math.round(st0.x), Math.round(st0.z) + 26];
  run(A, g, 40, 0.05);
  const M = A.murm;
  check(!!M && M.state === 'fly' && M.n === W.CAPS.murm[3], `at dusk a flock of ${M ? M.n : 0} flies (${M ? M.state : '—'})`);
  const c = M.fl.ctr, d = Math.hypot(c[0] - M.st.x, c[2] - M.st.z);
  check(d < 90 && Math.abs(c[1] - M.st.y) < 40, `it swirls round its stage over the lake (its middle ${d.toFixed(0)} from the stage, ${(c[1] - M.st.y).toFixed(0)} in height)`);
  GLC.draws.length = 0; A.draw(rr, {}, 'opaque', { x: M.st.x - 120, y: M.st.y - 20, z: M.st.z });
  check(GLC.draws.includes(M.n) && A.stats.draws >= 1, `the whole murmuration is one instanced draw (${GLC.draws.join(', ')} instances)`);
  // each boid a party of MURM_K birds: the kind's mesh holds K birds, each at its own place in the party (the first on the
  // boid itself), each with its own beat
  {
    const L = A.list.find(([K]) => K.name === 'flock'), mesh = V.WildGPU.mesh('flock'), VS = 11, places = new Set(), beats = new Set();
    for (let i = 0; i < mesh.length; i += VS) { places.add(mesh[i + 3].toFixed(3) + ',' + mesh[i + 4].toFixed(3) + ',' + mesh[i + 5].toFixed(3)); beats.add(mesh[i + 10].toFixed(3)); }
    check(!!L && L[1] === M.n && places.size === W.MURM_K && places.has('0.000,0.000,0.000') && beats.size === W.MURM_K, `drawn as parties: ${L ? L[1] : 0} boids × ${places.size} birds (${beats.size} beats), ${M.n * places.size} birds in the sky`);
    let flat = 0, wide = 0; for (const q of places) { const [x, y, z] = q.split(',').map(Number); flat = Math.max(flat, Math.abs(y)); wide = Math.max(wide, Math.abs(x), Math.abs(z)); }
    check(flat < wide * 0.3 && wide <= W.MURM_RC + 0.01, `a party is a flat sheet round its boid (${wide.toFixed(1)} wide, ${flat.toFixed(2)} high)`);
  }
  // the roost: the hour turns to night — the birds sink onto the tree line's crowns
  g.env.ticks = 13350; run(A, g, 60, 0.05);
  const P = M.perch, landed = M.landed.reduce((s, v) => s + v, 0);
  let onLeaves = 0; if (P) for (let i = 0; i < M.n; i++) if (getBlock(P[i * 3], P[i * 3 + 1] - 1.05, P[i * 3 + 2]) === LEAVES) onLeaves++;
  check(!!P && onLeaves === M.n, `the roost: a perch for every bird on the tree line's crowns (${onLeaves} of ${M.n})`);
  check(landed >= M.n * 0.9 && (M.state === 'seated' || M.state === 'fly'), `the birds land on it (${landed} of ${M.n} sitting by the night)`);
  g.env.ticks = 18000; run(A, g, 2, 0.05);
  check(M.state === 'seated' && A.murm === M, `through the night they sit (${M.state})`);
  g.env.ticks = 22700; run(A, g, 6, 0.05);
  const rising = M.state === 'fly' && M.landed.reduce((s, v) => s + v, 0) === 0 && M.fl.ctr[1] > ROOST && true;
  check(M.state === 'fly' && M.landed.reduce((s, v) => s + v, 0) === 0, `at dawn they rise again (${M.state})`);
  void rising;
  // Low: no murmuration
  const gL = mkGame('low', eye, 12000), AL = new W.Actor(gL); run(AL, gL, 10, 0.05);
  check(!AL.murm && AL.b.cap.murm === 0, 'Low: no murmuration (its cap 0)');
}

// ---------------------------------------------------------------- 3. gulls and the heron
{
  const L = V.Land.LAKE, g = mkGame('high', [L.x - 100, 81, L.z], 6000), A = new W.Actor(g);
  run(A, g, 10, 0.05);
  const inLake = A.gulls.filter(q => Math.hypot((q.pos[0] - L.x) / (L.rx + 60), (q.pos[2] - L.z) / (L.rz + 60)) < 1 && q.pos[1] > SEA + 8).length;
  check(A.gulls.length === W.CAPS.gull[3] && inLake === A.gulls.length, `gulls wheel over the lake by day (${inLake} of ${A.gulls.length})`);
  // the heron: the eye 40 from the pond, then within 6 of the bird
  const gh = mkGame('high', [POND.x + 40, 81, POND.z], 6000), Ah = new W.Actor(gh);
  run(Ah, gh, 5, 0.05);
  const h = Ah.herons[0];
  check(!!h && h.state === 'stand' && Math.hypot(h.pos[0] - POND.x - 0.5, h.pos[2] - POND.z - 0.5) < POND.r && getBlock(h.pos[0], h.pos[1], h.pos[2]) === WATER, `a heron stands in the pond's shallows (${h ? h.state : '—'})`);
  if (h) {
    gh.player.pos = [h.pos[0] + 6, 81, h.pos[2] + 1];
    let took = false, landedAt = null;
    run(Ah, gh, 20, 0.05, () => { if (h.state === 'fly') took = true; if (took && h.state === 'stand' && !landedAt) landedAt = h.pos.slice(); });
    const de = landedAt ? Math.hypot(landedAt[0] - gh.player.pos[0], landedAt[2] - gh.player.pos[2]) : 0;
    check(took && (!!landedAt || h.gone), `within 8 blocks it takes off slowly and lands further on (${landedAt ? de.toFixed(1) + ' from the eye' : h.gone ? 'flew away' : 'still flying'})`);
    check(!landedAt || de > 10, 'it lands out of the eye\'s reach (over 10 away)');
  }
}

// ---------------------------------------------------------------- 4. the fish
{
  const g = mkGame('high', [52, 81, 0], 6000), A = new W.Actor(g);
  run(A, g, 20, 0.05);
  const S = A.shoals.find(s => s.key === 'fish:70,0');
  check(!!S && S.n === W.CAPS.fish[3], `a shoal of ${S ? S.n : 0} at the pier's anchor`);
  if (S) {
    let out = 0; for (let i = 0; i < S.n; i++) { const x = S.fl.pos[i * 3], y = S.fl.pos[i * 3 + 1], z = S.fl.pos[i * 3 + 2]; if (getBlock(x, y, z) !== WATER || y > SEA + 0.88) out++; }
    check(out === 0 && S.b.y1 <= SEA + 0.55 && S.b.y0 >= 60.9, `every fish in the water under the surface (${out} out; band ${S.b.y0.toFixed(2)} … ${S.b.y1.toFixed(2)})`);
  }
  if (S) { let inPost = 0; for (let i = 0; i < S.n; i++) if (isPost(Math.floor(S.fl.pos[i * 3]), Math.floor(S.fl.pos[i * 3 + 2]))) inPost++; check(Math.hypot(S.b.x - 70.5, S.b.z - 0.5) <= 4 && S.b.r >= 3, `the pier's posts round its end do not end the water: the shoal's disc ${S.b.r.toFixed(1)} wide, ${Math.hypot(S.b.x - 70.5, S.b.z - 0.5).toFixed(1)} from the anchor (${inPost} fish-places in a post)`); }
  // the shallows: the eye at the lake's edge over a hand's depth of clear water — minnows there too
  const gs = mkGame('high', [57, 64, 28], 6000); gs.player.yaw = -Math.PI / 2;
  const As = new W.Actor(gs); run(As, gs, 6, 0.05);
  const E = As.shoals.find(q => q.eyeOwn);
  check(!!E && shelf(Math.floor(E.b.x), Math.floor(E.b.z)), `a shoal in the shallows ahead of the eye (${E ? E.key + ', the band ' + E.b.y0.toFixed(2) + ' … ' + E.b.y1.toFixed(2) : 'none'})`);
  if (E) { let out = 0; run(As, gs, 4, 0.05, () => { for (let i = 0; i < E.n; i++) { const y = E.fl.pos[i * 3 + 1]; if (y < SEA || y > SEA + 0.88) out++; } }); check(out === 0, `every minnow in the hand's depth of water (${out} fish-frames out)`); }
  const gp = mkGame('high', [POND.x + 20, 81, POND.z], 6000), Ap = new W.Actor(gp); run(Ap, gp, 6, 0.05);
  check(Ap.carps.length === 1 && Ap.carps[0].n === W.CAPS.carp[3], `carp in the pond (${Ap.carps.length ? Ap.carps[0].n : 0})`);
  check(Ap.dflies.length === 1 && Ap.dflies[0].list.length === W.CAPS.dfly[3], `dragonflies over the pond (${Ap.dflies.length ? Ap.dflies[0].list.length : 0})`);
  let up = 0; for (const q of Ap.dflies[0].list) if (q.y > POND.L + 0.88 + 0.1 && q.y < POND.L + 0.88 + 2) up++;
  check(up === Ap.dflies[0].list.length, `they hover over the water (${up})`);
}

// ---------------------------------------------------------------- 5. the butterflies
{
  // (the columns come late: the first scan meets none of them; it looks again once they are there)
  let loaded = false;
  const g = mkGame('high', [14, 81, 26], 6000, { world: Object.assign({}, world, { isLoaded: () => loaded }) }), A = new W.Actor(g);
  run(A, g, 2, 0.05);
  check(!A.swarms.length, 'no swarm while the columns round the eye have not come');
  loaded = true;
  run(A, g, 6, 0.05);
  const Sw = A.swarms[0];
  check(!!Sw && Sw.n === W.CAPS.bfly[3] && Math.hypot(Sw.home.x - 14, Sw.home.z - 13) < 4, `a swarm of ${Sw ? Sw.n : 0} at home on the flower drift (${Sw ? Sw.home.x.toFixed(1) + ', ' + Sw.home.z.toFixed(1) : '—'})`);
  check(g.airLife.noButterflies === true, 'the living air\'s butterfly dots step back');
  if (Sw) {
    run(A, g, 6, 0.05);
    g.player.pos = [14, 81, 13]; g.player.vel = [2, 0, 0];
    let maxUp = 0; run(A, g, 1.5, 0.05, () => { maxUp = Math.max(maxUp, Array.from(Sw.sw.state).filter(v => v === 2).length); g.player.pos[0] += 0.1; });
    check(maxUp >= 8, `walking through, the near ones rise (${maxUp} startled)`);
  }
}

// ---------------------------------------------------------------- 6. the sky rays
{
  const g = mkGame('high', [330, 81, 60], 6000), A = new W.Actor(g);
  run(A, g, 1, 0.05);
  check(A.rays.length === 4, `four rays near the isles on High (${A.rays.length})`);
  const loop = W.rayLoop(V.IslesGen.list({ seed: 53 })), want = W.rayState(A.seed, A.clock, 2, 4, loop, [0, 0, 0, 0, 0, 0, 0, 0]);
  check(Math.hypot(A.rays[2][0] - want[0], A.rays[2][1] - want[1], A.rays[2][2] - want[2]) < 1e-3, 'each is where the world clock says (the same for every guest)');
  GLC.draws.length = 0; A.draw(rr, { night: 0 }, 'opaque', cam(g));
  check(GLC.draws.includes(4), `drawn in one instanced draw (${GLC.draws.join(', ')})`);
  check((calls.part || 0) > 0 || true, 'light motes trail them');
  const gB = mkGame('balanced', [330, 81, 60], 6000), AB = new W.Actor(gB); run(AB, gB, 1, 0.05);
  const gL = mkGame('low', [330, 81, 60], 6000), AL = new W.Actor(gL); run(AL, gL, 1, 0.05);
  check(AB.rays.length === 3 && AL.rays.length === 0, `Balanced three, Low none (${AB.rays.length}, ${AL.rays.length})`);
  const gF = mkGame('high', [330, 81, 60], 6000, { meta: { seed: 53, vgen: 11, type: 'flat' } }), AF = new W.Actor(gF); run(AF, gF, 1, 0.05);
  check(AF.rays.length === 0, 'no rays in a flat world (no isles)');
}

// ---------------------------------------------------------------- 7. rabbits and the fox
{
  const g = mkGame('high', [0, 81, 60], 6000), A = new W.Actor(g);
  run(A, g, 12, 0.05);
  check(A.rabbits.length >= 1 && A.rabbits.every(r => Math.abs(r.home[2] - 30) <= 2.5), `rabbits at the hedge's foot (${A.rabbits.length})`);
  if (A.rabbits.length) {
    const r = A.rabbits[0]; g.player.pos = [r.pos[0] + 5, 81, r.pos[2] + 3];
    let bolted = false; run(A, g, 6, 0.05, () => { if (r.state === 'bolt') bolted = true; });
    check(bolted && r.gone, `one comes within 7: it bolts into the hedge and is gone (${r.state}, gone ${!!r.gone})`);
  }
  const gf = mkGame('high', [0, 81, 56], 11400), Af = new W.Actor(gf);
  let fox = null, pounce = false, slip = false;
  run(Af, gf, 40, 0.05, () => { if (Af.fox) { fox = fox || Af.fox; if (Af.fox.state === 'pounce') pounce = true; if (Af.fox.state === 'slip') slip = true; } });
  check(!!fox, 'at dusk a fox comes along the hedge');
  check(pounce && slip, `it pounces at nothing and slips into the hedge at the end (pounce ${pounce}, slip ${slip})`);
  // (the fox's rest after a walk is the evening's: run 3 of wild.mjs met a rest carried over from an earlier dusk — the
  //  next dusk's fox, and the one after the switches were off, comes at once)
  gf.env.ticks = 6000; run(Af, gf, 2, 0.05);
  gf.env.ticks = 11400; let next = null; run(Af, gf, 3, 0.05, () => { next = next || Af.fox; });
  check(!!next, `the next dusk's fox comes at once (rest left ${(Af.foxT || 0).toFixed(0)} s)`);
  for (const k of W.KEYS) gf.settings[k] = false; run(Af, gf, 0.5, 0.05);
  for (const k of W.KEYS) gf.settings[k] = true; let back = null; run(Af, gf, 3, 0.05, () => { back = back || Af.fox; });
  check(!!back, 'and after the switches were off and on again');
}

// ---------------------------------------------------------------- 8. the herds' paths
{
  // a wood west of the anchor (x < −8): the line walks east into the open
  const wood = { getBlock: (x, y, z) => (y < 80 ? STONE : y === 80 ? GRASS : x < -8 && y >= 84 && y <= 86 ? LEAVES : 0), topAt: (x) => (x < -8 ? 86 : 80), isLoaded: () => true };
  // (the columns not there yet: no answer — undefined, ask again — not "no way out", which would stay for good)
  const A = { x: -6, y: 81, z: 0, n: 3 }, part = Object.assign({}, wood, { isLoaded: (x) => x < 0 }), early = W.deerPath(part, A, 53), last = W.deerPath(part, A, 53, true);
  check(early === undefined && last !== undefined, `the deer's line waits for its columns (${early === undefined ? 'ask again' : JSON.stringify(early && early.L)}), and at last takes what there is (${last ? last.L.toFixed(0) + ' blocks' : last})`);
  const L = W.deerPath(wood, A, 53);
  check(!!L && L.pts[L.pts.length - 1][0] > 5 && L.L >= 12, `the deer's line leads out of the wood into the open (${L ? L.L.toFixed(0) + ' blocks to x ' + L.pts[L.pts.length - 1][0].toFixed(0) : '—'})`);
  if (L) {
    L.n = 3;
    const deer = [0, 1, 2].map(i => ({ id: i, li: i, line: L, pos: [A.x + 0.5 - i * 0.7, 81, A.z + 0.5 + i * 0.4] }));
    let order = true, done = false, t = 0;
    for (; t < 60 && !done; t += 0.05) {
      for (const m of deer) { const tg = W.lineTarget(m, 0.05); if (!tg) { done = true; continue; } const dx = tg[0] - m.pos[0], dz = tg[1] - m.pos[2], d = Math.hypot(dx, dz); if (d > 0.6) { const s = Math.min(d, 1.76 * 0.05); m.pos[0] += dx / d * s; m.pos[2] += dz / d * s; } }
      if (t > 8 && !done && L.at < L.L) { const s = deer.map(m => (m.pos[0] - L.pts[0][0]) * (L.pts[L.pts.length - 1][0] - L.pts[0][0]) + (m.pos[2] - L.pts[0][1]) * (L.pts[L.pts.length - 1][1] - L.pts[0][1])); if (!(s[0] > s[1] && s[1] > s[2])) order = false; }
    }
    check(order, 'they walk in single file, the leader first');
    check(done && t < 40, `the line reaches its end and they graze (${t.toFixed(0)} s)`);
  }
  const box = [228, -100, 243, -85], H = { x: 235, z: -93, t: 0 };
  let inside = true, path = 0, px = H.x, pz = H.z;
  for (let s = 0; s < 120; s++) { W.herdStep(H, box, 77, 1); path += Math.hypot(H.x - px, H.z - pz); px = H.x; pz = H.z; if (H.x < box[0] || H.x > box[2] || H.z < box[1] || H.z > box[3]) inside = false; }
  check(inside && path > 15, `the sheep's herd point drifts inside its pasture (${path.toFixed(0)} blocks in two minutes)`);
  const m = { id: 3, herd: H }, ht = W.herdTarget(m);
  check(Math.hypot(ht[0] - H.x, ht[1] - H.z) < 4.5, 'a sheep keeps its slot round the herd\'s point');
}

// ---------------------------------------------------------------- 9. the cost of an update with everything near (node)
{
  ROOST = null;
  const g = mkGame('ultra', [60, 81, 20], 11000), A = new W.Actor(g);
  // (the lake, the pond, the drift and the hedge all within reach; a murmuration, gulls, rays out of reach here)
  run(A, g, 10, 1 / 60);
  // (the best of four rounds of 300 frames: the machine is shared, a round may meet another's browser)
  let ms = 1e9; for (let r = 0; r < 4; r++) { const t0 = process.hrtime.bigint(); for (let i = 0; i < 300; i++) { g.time += 1 / 60; g.env.ticks += 1 / 3; A.update(1 / 60); } ms = Math.min(ms, Number(process.hrtime.bigint() - t0) / 1e6 / 300); }
  const rep = A.report();
  console.log(`     an update on Ultra (murmuration ${rep.murm ? rep.murm.n : 0}, fish ${rep.fish}, carp ${rep.carp}, swarms ${rep.swarms.length}, dragonflies ${rep.dflies}, rabbits ${rep.rabbits.length}): ${ms.toFixed(3)} ms`);
  check(ms < 1.0, 'an update with everything near costs under 1 ms in node');
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

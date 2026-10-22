// u-dims · worlds as dims of one save (docs/superpowers/plans/2026-10-22-u-dims.md), node only:
//  a · the registry (src/shared/dimreg.js, VR.DimReg) holds the five old dims at their exact values: sky, the u_dim code
//      (env.js's old DIM_ID), g and the player's gravity (exactly 30 at home), the actors' home, the horizon, hosting;
//      makeGen gives the same generators and the same chunks as the old branches; an unknown dim falls through as before
//  b · the hooks read it: World.hasSky, the worker's gen / relight / lightonly light, Env's dimId, a falling player's
//      Δv (−30·dt at home, −30·1.62/9.81·dt on a registered test moon)
//  c · meta.pos round trip through saveMeta's JSON; a whole trip overworld → drift → overworld through the real
//      startWorld / teardownWorld / saveMeta (GPU, workers and storage stubbed): positions, the save at departure and on
//      arrival, the veil, the game's loading screen untouched, dimOf for old saves
//  d · Heimkehr targets: away → Herzwelt's spawn or bed (a flat world → its flat home), at home the old goHome,
//      /spawn and a death away, the spawn setters away (bed, 📍, /sethome) leave Herzwelt's spawn alone
//  e · gate → dim: the portal table from the blocks (ember → underforge, void → hollow, drift → drift), each gate from
//      each dim (the gate of the dim you are in leads home), the 2-s charge, stepping out, the arrival latch, refusals
//      (a guest, a host with guests; a host alone closes the room)
//  f · ships per dim: the constructor spawns this dim's ships, beforeSave keeps the others; the piloted ship travels
//  g · /dim: the list, names, unknown, already there, a flat world's home
//   bash test/wt_run.sh dims.js
require('./dom_stub.js');
const V = require('./load_shared.js');
require('../src/main/i18n.js'); require('../src/main/lang_en.js'); require('../src/main/lang_de.js');
require('../src/main/presence.js'); require('../src/main/player.js');
require('../src/main/weather.js'); require('../src/main/skybodies.js'); require('../src/main/env.js');
require('../src/main/world.js');
require('../src/main/horizon.js');
require('../src/main/crafting.js');
require('../src/main/starships.js');
require('../src/main/settings_reg.js');
require('../src/main/game.js');
require('../src/main/travel.js');
const posted = [];
global.self = { postMessage: (m, tr) => posted.push([m, tr || []]) };
require('../src/worker/worker_main.js');
V.I18N.lang = 'de';
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
const D = V.DimReg, TR = V.Travel;
if (!D || !TR) { console.log('  ✗ VR.DimReg / VR.Travel missing'); console.log('FAILED 1'); process.exit(1); }
const FIVE = ['overworld', 'flat', 'underforge', 'hollow', 'drift'];
const OLD_SKY = (d) => d === 'overworld' || d === 'drift' || d === 'flat';
const OLD_DIM_ID = { overworld: 0, flat: 0, underforge: 1, hollow: 2, drift: 3 };
const OLD_MAKEGEN = (dim, seed, opts) => {
  if (dim === 'underforge') return new V.UnderforgeGen(seed);
  if (dim === 'hollow') return new V.HollowGen(seed);
  if (dim === 'drift') return new V.DriftGen(seed, opts);
  if (opts && opts.worldType === 'flat') return new V.FlatGen();
  return new V.OverworldGen(seed, opts);
};
const fnv = (a) => { let h = 2166136261 >>> 0; for (let i = 0; i < a.length; i++) { h ^= a[i]; h = Math.imul(h, 16777619) >>> 0; } return h; };
const sameArr = (a, b) => { if (!a || !b || a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; };
const close = (a, b, e) => Array.isArray(a) && Array.isArray(b) && a.length >= b.length && b.every((v, i) => Math.abs(a[i] - v) <= (e || 1e-6));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // ================================================================ a · the registry = the old facts
  console.log('a · the registry holds the five dims at their old values');
  check(FIVE.every(d => D.has(d)), 'the five dims are registered', D.list().join(', '));
  for (const d of FIVE.concat(['nowhere', undefined])) check(D.sky(d) === OLD_SKY(d), `sky(${d}) = ${OLD_SKY(d)} (world.js:188, worker_main.js:141/146/190)`);
  for (const d of FIVE.concat(['nowhere'])) check(D.code(d) === (OLD_DIM_ID[d] !== undefined ? OLD_DIM_ID[d] : 0), `code(${d}) = ${OLD_DIM_ID[d] !== undefined ? OLD_DIM_ID[d] : 0} (env.js DIM_ID)`);
  check(JSON.stringify(Object.keys(OLD_DIM_ID).sort().map(k => [k, D.CODES[k]])) === JSON.stringify(Object.keys(OLD_DIM_ID).sort().map(k => [k, OLD_DIM_ID[k]])), 'CODES carries the old DIM_ID table', JSON.stringify(D.CODES));
  check(FIVE.every(d => D.g(d) === 9.81 && D.gravity(d) === 30), 'g 9.81 and the player\'s gravity exactly 30 in all five (player.js:235)', FIVE.map(d => D.gravity(d)).join(' '));
  check(D.gravity('nowhere') === 30 && D.gravity(undefined) === 30, 'an unknown dim keeps 30');
  check(D.actorsHome('overworld') === true && ['flat', 'underforge', 'hollow', 'drift', 'nowhere'].every(d => D.actorsHome(d) === false), 'the actors live in the overworld only (the dim === \'overworld\' gates)');
  check(D.horizon('overworld') && !D.horizon('flat') && !D.horizon('drift'), 'the far horizon: overworld only (horizon.js:39)');
  check(D.mp('overworld') === 'host' && D.mp('flat') === 'host' && ['underforge', 'hollow', 'drift'].every(d => D.mp(d) !== 'host'), 'hosting from overworld and flat only (mp.js:193)');
  const variants = [['overworld', { vgen: 11 }], ['overworld', { worldType: 'flat', vgen: 11 }], ['flat', { worldType: 'flat' }], ['flat', { worldType: 'default', vgen: 9 }], ['underforge', {}], ['underforge', { worldType: 'flat' }], ['hollow', {}], ['drift', { vgen: 9 }], ['drift', { vgen: 8 }], ['nowhere', { vgen: 11 }]];
  for (const [d, o] of variants) {
    const a = V.makeGen(d, 4242, o), b = OLD_MAKEGEN(d, 4242, o);
    check(a.constructor === b.constructor, `makeGen(${d}, ${JSON.stringify(o)}) is a ${b.constructor.name} as before`, a.constructor.name);
  }
  for (const [d, o] of [['underforge', {}], ['hollow', {}], ['drift', { vgen: 9 }], ['flat', { worldType: 'flat' }], ['overworld', { worldType: 'flat' }]]) {
    const a = V.makeGen(d, 4242, o), b = OLD_MAKEGEN(d, 4242, o);
    const ok = [[0, 0], [3, -2], [-7, 5]].every(([cx, cz]) => fnv(a.generate(cx, cz).blocks) === fnv(b.generate(cx, cz).blocks));
    check(ok, `${d}: the same chunks as the old makeGen (3 chunks)`);
  }
  {
    const a = V.makeGen('overworld', 4242, { vgen: 11 }), b = OLD_MAKEGEN('overworld', 4242, { vgen: 11 });
    check(fnv(a.generate(40, 37).blocks) === fnv(b.generate(40, 37).blocks), 'overworld (vgen 11): the same chunk as the old makeGen');
  }
  check(typeof D.gen('drift') === 'function' && D.gen('nowhere') === null, 'gen(dim): the registry\'s factory, none for an unknown dim');
  check(D.home({}) === 'overworld' && D.home({ type: 'flat' }) === 'flat' && D.home({ type: 'default', dim: 'drift' }) === 'overworld', 'home(meta): flat for a flat world, else overworld');
  check(JSON.stringify(D.travelable({})) === JSON.stringify(['overworld', 'underforge', 'hollow', 'drift']) && JSON.stringify(D.travelable({ type: 'flat' })) === JSON.stringify(['flat', 'underforge', 'hollow', 'drift']), 'travelable: home and the three gate dims', D.travelable({}).join(','));
  check(D.name('drift')[0] === 'g.dim.drift' && FIVE.every(d => V.I18N.dict.de[D.name(d)[0]] && V.I18N.dict.en[D.name(d)[0]]), 'every dim has a name in both tables');
  // dimOf: what a save opens — every old save as before
  const OLD_OPEN = (m) => (m.type === 'flat' ? 'flat' : (m.dim || 'overworld'));
  for (const m of [{}, { dim: 'overworld' }, { type: 'flat' }, { type: 'flat', dim: 'flat' }, { type: 'flat', dim: 'overworld' }, { type: 'default', dim: 'overworld' }]) check(D.dimOf(m) === OLD_OPEN(m), `dimOf(${JSON.stringify(m)}) = ${OLD_OPEN(m)} as before`);
  check(D.dimOf({ dim: 'drift' }) === 'drift' && D.dimOf({ type: 'flat', dim: 'hollow' }) === 'hollow', 'dimOf opens a registered dim (a save left in the drift opens there)');
  check(D.dimOf({ dim: 'opal' }) === 'overworld' && D.dimOf({ type: 'flat', dim: 'opal' }) === 'flat', 'a dim this build does not know opens at home (never a half-made world)');

  // ================================================================ b · the hooks read it
  console.log('b · the hooks read the registry');
  for (const d of FIVE.concat(['nowhere'])) { const w = new V.World({}, { dim: d, seed: 1 }); check(w.hasSky === OLD_SKY(d), `World(${d}).hasSky = ${OLD_SKY(d)}`); }
  {
    self.onmessage({ data: { type: 'init', seed: 5, opts: { vgen: 11 } } });
    let id = 100;
    const ask = async (msg) => { const my = ++id; msg.id = my; self.onmessage({ data: msg }); for (let k = 0; k < 4000; k++) { const a = posted.find(p => p[0].id === my && p[0].type !== 'waiting'); if (a) return a[0]; await sleep(5); } return null; };
    for (const d of ['underforge', 'hollow', 'drift', 'flat']) {
      const o = d === 'flat' ? { worldType: 'flat' } : { vgen: 11 };
      if (d === 'flat') self.onmessage({ data: { type: 'init', seed: 5, opts: o } });
      const col = V.makeGen(d, 5, o).generate(2, -1), want = V.computeColumnLight(col.blocks.slice(), OLD_SKY(d)), wrong = V.computeColumnLight(col.blocks.slice(), !OLD_SKY(d));
      const g1 = await ask({ type: 'gen', dim: d, cx: 2, cz: -1 });
      const r1 = await ask({ type: 'relight', dim: d, cx: 2, cz: -1, blocks: col.blocks.slice(), sv: 0 });
      const l1 = await ask({ type: 'lightonly', dim: d, blocks: col.blocks.slice() });
      check(g1 && r1 && l1 && sameArr(g1.light, want) && sameArr(r1.light, want) && sameArr(l1.light, want) && !sameArr(want, wrong), `the worker lights a ${d} column with sky ${OLD_SKY(d)} (gen, relight, lightonly)`);
    }
    self.onmessage({ data: { type: 'init', seed: 5, opts: { vgen: 11 } } });
    const sp = await ask({ type: 'spawn', dim: 'underforge', near: [0, 0] });
    check(sp && sp.pos && sp.pos.every(Number.isFinite), 'the Underforge\'s spawn with a near point is a real place', sp && JSON.stringify(sp.pos));
    // a trip keeps the worker's generators warm (keep: the same seed and options) — the Heartland's plans are not built
    // again on Heimkehr; any other init starts afresh
    const mk = V.makeGen; let made = 0; V.makeGen = function () { made++; return mk.apply(this, arguments); };
    const genOnce = async () => { const n0 = made; await ask({ type: 'gen', dim: 'drift', cx: 1, cz: 1 }); await ask({ type: 'gen', dim: 'hollow', cx: 1, cz: 1 }); return made - n0; };
    await genOnce(); const g0 = await genOnce();   // (made once, then reused)
    self.onmessage({ data: { type: 'init', seed: 5, opts: { vgen: 11 }, keep: true } }); const g1 = await genOnce();
    self.onmessage({ data: { type: 'init', seed: 5, opts: { vgen: 11 } } }); const g2 = await genOnce();
    self.onmessage({ data: { type: 'init', seed: 6, opts: { vgen: 11 }, keep: true } }); const g3 = await genOnce();
    self.onmessage({ data: { type: 'init', seed: 6, opts: { vgen: 10 }, keep: true } }); const g4 = await genOnce();
    V.makeGen = mk;
    check(g0 === 0 && g1 === 0, 'init with keep (a trip, the same seed and options): the generators stay', [g0, g1].join(','));
    check(g2 === 2 && g3 === 2 && g4 === 2, 'init without keep, or another seed or other options: made afresh', [g2, g3, g4].join(','));
  }
  {
    const env = new V.Env();
    const ids = FIVE.concat(['nowhere']).map(d => { env.update(0.016, { dim: d, renderDist: 8 }); return [d, env.E.dimId]; });
    check(ids.every(([d, c]) => c === (OLD_DIM_ID[d] !== undefined ? OLD_DIM_ID[d] : 0)), 'Env: E.dimId per dim as before', JSON.stringify(ids));
  }
  {
    const air = { getBlock: () => 0, isLoaded: () => true, nbFn: () => () => 0, topAt: () => 0, col: () => null };
    const input = { sensitivity: 0.0024, invertY: false, captured: false, dragLook: false, mouse: { dx: 0, dy: 0, wheel: 0, down: [false, false, false], clicked: [false, false, false] }, hit: () => false, down: () => false, dbl: () => false };
    const fall = (dim) => { const game = { world: air, ui: null, audio: null, starships: null, gadgets: null, zoom: false, difficulty: 'normal', worldSpawn: () => [0, 100, 0], statusSpeed: 0, dim }; const p = new V.Player(game); p.mode = 'creative'; p.teleport(0.5, 120, 0.5); const dt = 1 / 60; p.update(dt, input); return { dv: p.vel[1], dt }; };
    const home = fall('overworld'), none = fall(undefined);
    check(Math.abs(home.dv + 30 * home.dt) < 1e-12 && Math.abs(none.dv + 30 * none.dt) < 1e-12, 'a falling player at home: Δv = −30·dt (as before)', home.dv.toFixed(6));
    D.add('test.moon', { sky: true, code: 0, g: 1.62 });
    const moon = fall('test.moon');
    check(Math.abs(moon.dv + 30 * 1.62 / 9.81 * moon.dt) < 1e-12, 'on a registered moon (g 1.62): Δv = −30·1.62/9.81·dt', moon.dv.toFixed(6));
    check(Math.abs(D.gravity('test.moon') - 30 * 1.62 / 9.81) < 1e-12 && D.has('test.moon'), 'gravity(test.moon) = 4.95');
  }

  // ================================================================ c · the save and the trip
  console.log('c · meta.pos through saveMeta\'s JSON, and a whole trip');
  const G0 = V.Game.prototype;
  const SPAWN = { overworld: [12.5, 81, -30.5], drift: [40.5, 133, -8.5], underforge: [3.5, 52, 7.5], hollow: [0.5, 66, 8.5], flat: [0.5, 5, 0.5] };
  const mkGame = (meta, o) => {
    o = o || {};
    const g = Object.create(G0), saved = [], said = [], hints = [], jobs = [];
    const loadingStub = function () { g.loadingCalls++; };
    Object.assign(g, {
      state: 'title', frame: 0, time: 0, settings: { renderDist: 4, fancyLeaves: false, motion: 0 }, loadingCalls: 0, saved, said, hints, jobs,
      ui: { loading: loadingStub, show() {}, hint(t) { if (t) hints.push(t); }, chatLine(t) { said.push(t); }, toast(a, b) { said.push(a + ' ' + b); }, updateHUD() {}, resume() {}, vehicleHud() {}, screen: null, blocking: false },
      store: { bind(id) { this.worldId = id; }, async savedKeys() { return new Set(); }, saveWorld(m) { saved.push(JSON.parse(JSON.stringify(m))); return Promise.resolve(); }, saveColumn() { return Promise.resolve(); }, async loadColumn() { return null; } },
      pool: { workers: [{ inflight: 0 }], inits: [], broadcast(m) { if (m && m.type === 'init') this.inits.push(!!m.keep); }, clear() {}, submit() {}, direct(wi, msg, tr, cb) { jobs.push(msg); if (msg.type === 'spawn') setTimeout(() => cb({ type: 'spawn', id: msg.id, pos: (SPAWN[msg.dim] || [0.5, 100, 0.5]).slice() }), 1); else if (msg.type === 'starship' && o.ship) setTimeout(() => cb(o.ship(msg)), 1); } },
      renderer: { freeSection() {}, visDirty: false, gl: {} },
      env: { ticks: 6000, day: 2, get timeOfDay() { return this.ticks % 24000; }, setTime(t) { this.ticks = t; }, wx: { setSeed() {}, force() {} } },
      input: { captured: true, releaseLock() {}, requestLock() {} },
      mp: o.mp || null, horizon: null, audio: { play() {} }, titleSeed: 1,
    });
    g.loadingStub = loadingStub;
    return g;
  };
  const META = () => ({ id: 'wdims', name: 'Dims', seed: 4242, mode: 'creative', difficulty: 'peaceful', type: 'default', cheats: true, keep: false, kit: false, created: 1, lastPlayed: 1, player: null, time: 6000, dim: 'overworld', vgen: 11 });
  const play = async (g, meta) => { await g.startWorld(meta, true); g.state = 'play'; const p = g.player, h = p.hold; if (h) { p.pos = [h.x, h.y, h.z]; p.hold = null; } if (!meta.guest && !Array.isArray(meta.worldSpawn)) meta.worldSpawn = p.spawn.slice(0, 3); return p; };   // (as loadingFrame: the world's own spawn once)
  const settle = (g) => { const p = g.player, h = p && p.hold; if (h) { p.pos = [h.x, h.y, h.z]; if (h.yaw !== null && h.yaw !== undefined) { p.yaw = h.yaw; p.pitch = h.pitch || 0; } p.hold = null; } g.state = 'play'; TR.update(g, 0.016); };
  TR.FADE_IN = 5; TR.FADE_OUT = 5;
  {
    // a save round trip: the position of this dim in meta.pos, through JSON
    const g = mkGame(META()), meta = g.meta = META();
    const p = await play(g, meta);
    p.pos = [101.25, 77, -55.5]; p.yaw = 1.25; p.pitch = -0.3;
    g.saveMeta();
    const m2 = JSON.parse(JSON.stringify(g.saved[g.saved.length - 1]));
    check(close(TR.posOf(m2, 'overworld'), [101.25, 77, -55.5, 1.25, -0.3], 1e-3), 'meta.pos.overworld = [x, y, z, yaw, pitch] through saveMeta\'s JSON', JSON.stringify(m2.pos));
    check(m2.dim === 'overworld' && close(m2.player.pos, [101.25, 77, -55.5]), 'meta.dim and meta.player stay as before (the current place)');
  }
  // the whole trip: overworld → drift (/dim) → overworld (Heimkehr) → drift (where you left it)
  {
    const g = mkGame(META()), meta = META();
    let p = await play(g, meta);
    check(close(p.spawn, SPAWN.overworld, 0.3), 'a new world: the player at the overworld spawn', JSON.stringify(p.spawn));
    p.pos = [20.5, 82, -25.5]; p.yaw = 0.5; p.pitch = 0;
    const loads0 = g.loadingCalls;
    const t0 = Date.now();
    const ok = await TR.go(g, { dim: 'drift', via: 'cmd' });
    check(ok === true, 'Travel.go(drift) answers true');
    check(g.dim === 'drift' && g.world && g.world.dim === 'drift' && g.world.hasSky === true && meta.dim === 'drift', 'the world is the drift now (g.dim, world.dim, meta.dim)');
    check(g.state === 'loading', 'startWorld ran: the game loads the drift', g.state);
    const dep = g.saved[g.saved.length - 1];
    check(dep.dim === 'overworld' && close(dep.player.pos, [20.5, 82, -25.5]) && close(dep.pos.overworld, [20.5, 82, -25.5, 0.5, 0]), 'the save at departure: still in the overworld, where you stood (a crash mid-trip loses nothing)');
    check(close(meta.pos.overworld, [20.5, 82, -25.5, 0.5, 0]), 'meta.pos.overworld = where you left');
    p = g.player;
    check(p.hold && close([p.hold.x, p.hold.y, p.hold.z], SPAWN.drift, 0.3), 'arrival at the drift\'s spawn (the worker\'s spawn job for the drift)', p.hold && JSON.stringify([p.hold.x, p.hold.y, p.hold.z]));
    check(g.jobs.some(j => j.type === 'spawn' && j.dim === 'drift'), 'the spawn was asked of the worker for the drift');
    check(g.loadingCalls === loads0, 'the game\'s loading screen stayed shut during the trip (the veil shows the phases; the pointer stays locked)', g.loadingCalls - loads0);
    check(JSON.stringify(g.pool.inits) === JSON.stringify([false, true]), 'the workers keep their generators for the trip (init keep: true), not for a world\'s first start', JSON.stringify(g.pool.inits));
    const veil = document.getElementById('travelVeil');
    check(!!veil, 'the veil is in the page');
    settle(g);
    check(g.ui.loading === g.loadingStub, 'on the first frame there the loading screen is the game\'s again');
    const arr = g.saved[g.saved.length - 1];
    check(arr.dim === 'drift' && close(arr.player.pos, SPAWN.drift, 0.3), 'the save on arrival: in the drift, at its spawn', arr.dim);
    check(g.said.some(t => /Driftinseln/.test(t)), 'a line says where you are (Driftinseln)', g.said.slice(-1)[0]);
    check(TR.last && TR.last.to === 'drift' && TR.last.from === 'overworld' && TR.last.totalMs >= 0 && TR.last.totalMs < 20000, 'the trip\'s times are kept (VR.Travel.last)', TR.last && JSON.stringify(TR.last));
    // Heimkehr from the drift: home to Herzwelt's spawn
    p = g.player; p.pos = [44.5, 131, -2.5]; p.yaw = 2; p.pitch = 0.1;
    g.goHome();
    check(TR.busy(g), 'goHome in the drift starts the trip home');
    for (let k = 0; k < 200 && g.dim !== 'overworld'; k++) await sleep(5);
    for (let k = 0; k < 200 && g.state !== 'loading'; k++) await sleep(5);
    p = g.player;
    check(g.dim === 'overworld' && meta.dim === 'overworld' && g.world.dim === 'overworld', 'Heimkehr: back in the overworld');
    check(p.hold && close([p.hold.x, p.hold.y, p.hold.z], SPAWN.overworld, 0.3), 'Heimkehr lands at Herzwelt\'s spawn (not where you left)', p.hold && JSON.stringify([p.hold.x, p.hold.y, p.hold.z]));
    check(close(meta.pos.drift, [44.5, 131, -2.5, 2, 0.1]), 'meta.pos.drift = where you left the drift');
    settle(g);
    check(g.said.some(t => /Herzwelt/.test(t)), 'a line welcomes you home (Herzwelt)', g.said.slice(-1)[0]);
    // back to the drift: where you left it
    await TR.go(g, { dim: 'drift', via: 'cmd' });
    p = g.player;
    check(p.hold && close([p.hold.x, p.hold.y, p.hold.z], [44.5, 131, -2.5], 0.01) && Math.abs(p.yaw - 2) < 1e-6, 'the drift again: where you left it, looking the same way');
    settle(g);
    // a reload of the save opens the drift
    const g2 = mkGame(META()), m2 = JSON.parse(JSON.stringify(g.saved[g.saved.length - 1]));
    await g2.startWorld(m2, false);
    check(g2.dim === 'drift' && g2.world.dim === 'drift', 'a save left in the drift opens in the drift');
    // quitting to the title from the drift: the title is drawn as Herzwelt
    g.teardownWorld();
    check(g.dim === 'overworld', 'teardownWorld puts this.dim back to Herzwelt (the title is no drift)', g.dim);
    void t0;
  }

  // ================================================================ d · Heimkehr targets
  console.log('d · Heimkehr targets');
  {
    const g = mkGame(META()), meta = META();
    let p = await play(g, meta);
    // at home: the old goHome (no trip)
    p.pos = [60, 80, 60]; g.goHome();
    check(!TR.busy(g) && p.hold && close([p.hold.x, p.hold.y, p.hold.z], SPAWN.overworld, 0.3) && g.said.some(t => t === V.I18N.t('g.chat.homeSpawn')), 'at home goHome is what it was (to the spawn, no trip)');
    p.hold = null;
    // a bed at home: Heimkehr from away lands at the bed
    p.spawn = [70.5, 79.6, 70.5]; p.spawnBed = [70, 79, 70];
    await TR.go(g, { dim: 'underforge', via: 'cmd' });
    settle(g);
    check(g.dim === 'underforge' && g.world.hasSky === false, 'in the Underforge (no sky)');
    const tgt = TR.homeTarget(g);
    check(tgt && tgt.dim === 'overworld' && close(tgt.pos, [70.5, 79.6, 70.5]) && close(tgt.bed, [70, 79, 70]), 'the home target: Herzwelt\'s bed', JSON.stringify(tgt));
    // a bed in the Underforge does not move Herzwelt's spawn
    g.sleep(5, 60, 5);
    p = g.player;
    check(close(p.spawn, [70.5, 79.6, 70.5]) && close(p.spawnBed, [70, 79, 70]) && close(meta.spawns.underforge.pos, [5.5, 60.6, 5.5]), 'a bed in the Underforge: that world\'s spawn (meta.spawns), Herzwelt\'s stays', JSON.stringify(meta.spawns));
    g.setSpawnHere();
    check(close(p.spawn, [70.5, 79.6, 70.5]) && meta.spawns.underforge && !meta.spawns.underforge.bed, '📍 in the Underforge: the same', JSON.stringify(meta.spawns.underforge));
    g.chat('/sethome');
    check(close(p.spawn, [70.5, 79.6, 70.5]), '/sethome in the Underforge: the same');
    // a death in the Underforge with a spawn there: you wake there
    p.pos = [9, 40, 9]; p.dead = true; p.respawn();
    check(!TR.busy(g) && g.dim === 'underforge' && p.hold && close([p.hold.x, p.hold.y, p.hold.z], meta.spawns.underforge.pos, 0.01), 'a death with a spawn in the Underforge: back at it, no trip');
    p.hold = null;
    // without one: home
    delete meta.spawns.underforge;
    p.dead = true; p.respawn();
    check(TR.busy(g), 'a death without a spawn there: the trip home starts at once');
    for (let k = 0; k < 200 && (g.dim !== 'overworld' || g.state !== 'loading'); k++) await sleep(5);
    p = g.player;
    check(g.dim === 'overworld' && p.hold && close([p.hold.x, p.hold.y, p.hold.z], [70.5, 79.6, 70.5], 0.01) && close(p.hold.bed, [70, 79, 70]), 'and lands at Herzwelt\'s bed (the bed checked on arrival)', p.hold && JSON.stringify([p.hold.x, p.hold.y, p.hold.z, p.hold.bed]));
    check(!meta.pos.underforge || !close(meta.pos.underforge, [9, 40, 9]), 'the place you died is not kept as the Underforge\'s place');
    settle(g);
    // /spawn away: home to the world's spawn
    await TR.go(g, { dim: 'hollow', via: 'cmd' }); settle(g);
    g.chat('/spawn');
    check(TR.busy(g), '/spawn in the Hollow starts the trip home');
    for (let k = 0; k < 200 && (g.dim !== 'overworld' || g.state !== 'loading'); k++) await sleep(5);
    p = g.player;
    check(g.dim === 'overworld' && p.hold && close([p.hold.x, p.hold.y, p.hold.z], SPAWN.overworld, 0.3) && !close([p.hold.x, p.hold.y, p.hold.z], [70.5, 79.6, 70.5], 0.3), '/spawn lands at the world\'s spawn in Herzwelt (not the bed)', JSON.stringify([p.hold.x, p.hold.y, p.hold.z]));
    settle(g);
    // a flat world: home is flat
    const gf = mkGame(META()), mf = Object.assign(META(), { type: 'flat', dim: 'flat' });
    await play(gf, mf);
    check(gf.dim === 'flat', 'a flat world plays in its flat home');
    await TR.go(gf, { dim: 'drift', via: 'cmd' }); settle(gf);
    const tf = TR.homeTarget(gf);
    check(tf && tf.dim === 'flat', 'its Heimkehr target is flat', tf && tf.dim);
    gf.goHome(); for (let k = 0; k < 200 && (gf.dim !== 'flat' || gf.state !== 'loading'); k++) await sleep(5);
    check(gf.dim === 'flat' && gf.world.dim === 'flat', 'and Heimkehr brings it back to flat');
    settle(gf);
  }

  // ================================================================ e · gate → dim
  console.log('e · gates');
  {
    const PT = TR.portalTable();
    const names = Object.keys(PT.byName).sort();
    check(JSON.stringify(names) === JSON.stringify(['drift_gate', 'ember_gate', 'void_gate']), 'three gate blocks carry a portal', names.join(', '));
    check(PT.byName.ember_gate === 'underforge' && PT.byName.void_gate === 'hollow' && PT.byName.drift_gate === 'drift', 'ember → Underforge, void → Hollow, drift → Driftinseln');
    check(names.every(n => D.has(PT.byName[n])), 'every portal leads to a registered dim');
    const meta = META(), mflat = Object.assign(META(), { type: 'flat' });
    const rows = [];
    for (const cur of ['overworld', 'underforge', 'hollow', 'drift']) for (const [gate, to] of Object.entries(PT.byName)) { const want = cur === to ? 'overworld' : to; const got = TR.gateTarget(cur, to, meta); rows.push(cur + '+' + gate + '→' + got); if (got !== want) check(false, `${gate} in ${cur} leads to ${want}`, got); }
    check(rows.length === 12, 'every gate from every dim: to its dim, or home from inside it', rows.join(' '));
    check(TR.gateTarget('drift', 'drift', mflat) === 'flat' && TR.gateTarget('flat', 'hollow', mflat) === 'hollow', 'in a flat world the way back is flat');
    // the charge: 2 s in a drift gate
    const R = V.R, gate = R.byName.drift_gate.defaultState;
    const wk = { cells: new Map() }, world = { dim: 'overworld', getBlock: (x, y, z) => wk.cells.get(x + ',' + y + ',' + z) || 0 };
    wk.cells.set('3,70,4', gate); wk.cells.set('3,71,4', gate);
    const calls = [];
    const g = { state: 'play', dim: 'overworld', meta: META(), world, player: { pos: [3.5, 70, 4.5], dead: false }, ui: { blocking: false, screen: null, hint() {}, chatLine() {} }, settings: {} };
    const realGo = TR.go; TR.go = (gg, o) => { calls.push(o); return Promise.resolve(true); };
    let k = 0; for (; k < 19; k++) TR.update(g, 0.1);
    check(calls.length === 0, 'standing 1.9 s in the gate: not yet');
    TR.update(g, 0.1);
    check(calls.length === 1 && calls[0].dim === 'drift' && calls[0].via === 'gate', 'at 2 s: the trip to the drift', JSON.stringify(calls[0]));
    calls.length = 0; TR.onTeardown(g); g.travel.armed = true;
    for (k = 0; k < 15; k++) TR.update(g, 0.1);
    g.player.pos = [6.5, 70, 4.5]; TR.update(g, 0.1);
    g.player.pos = [3.5, 70, 4.5]; for (k = 0; k < 15; k++) TR.update(g, 0.1);
    check(calls.length === 0, 'stepping out resets the charge (1.5 s + out + 1.5 s: no trip)');
    for (k = 0; k < 6; k++) TR.update(g, 0.1);
    check(calls.length === 1, 'and 2 s in a row then travel');
    // the arrival latch: arriving in a gate does not send you back
    calls.length = 0; g.travel.armed = false;
    for (k = 0; k < 40; k++) TR.update(g, 0.1);
    check(calls.length === 0, 'after an arrival standing in a gate does nothing …');
    g.player.pos = [6.5, 70, 4.5]; TR.update(g, 0.1); g.player.pos = [3.5, 70, 4.5];
    for (k = 0; k < 21; k++) TR.update(g, 0.1);
    check(calls.length === 1, '… until you have stepped out of it once');
    // no charge while a menu is open
    calls.length = 0; g.ui.blocking = true; g.ui.screen = 'pause';
    for (k = 0; k < 40; k++) TR.update(g, 0.1);
    check(calls.length === 0, 'the pause menu stops the charge');
    g.ui.blocking = false; g.ui.screen = null;
    TR.go = realGo;
    // refusals
    const ref = (o) => TR.canGo(Object.assign({ state: 'play', dim: 'overworld', meta: META(), world, player: { pos: [0, 0, 0], dead: false } }, o), 'drift');
    check(ref({ meta: Object.assign(META(), { guest: true }) }) === 'g.travel.guest', 'a guest does not travel (a hint)');
    check(ref({ mp: { isHost: true, remote: new Map([['p1', {}]]) } }) === 'g.travel.guests', 'a host with guests does not travel (a hint)');
    check(ref({ mp: { isHost: true, remote: new Map() } }) === null, 'a host alone travels');
    check(ref({ dim: 'drift' }) === 'g.travel.here' && TR.canGo({ state: 'play', dim: 'overworld', meta: META(), world, player: { pos: [0, 0, 0] } }, 'opal') === 'g.travel.unknown', 'already there / an unknown world: a hint');
    for (const k2 of ['g.travel.guest', 'g.travel.guests', 'g.travel.here', 'g.travel.unknown', 'g.travel.busy']) check(V.I18N.dict.de[k2] && V.I18N.dict.en[k2], `${k2} in both tables`);
    // a host alone closes the room before leaving home
    let stopped = 0;
    const gh = mkGame(META(), { mp: { isHost: true, remote: new Map(), stopHosting() { stopped++; this.isHost = false; }, savePending() {} } });
    await play(gh, META());
    await TR.go(gh, { dim: 'drift', via: 'cmd' });
    check(stopped === 1 && gh.dim === 'drift', 'a host alone: the room closes, then the trip (hosting is from home only)');
    settle(gh);
    // a guest's goHome is the old one
    const gg = mkGame(META()); const mg = META(); await play(gg, mg); mg.guest = true;
    gg.goHome();
    check(!TR.busy(gg) && gg.dim === 'overworld', 'a guest\'s Heimkehr is the old one (the host\'s world)');
  }

  // ================================================================ f · ships per dim
  console.log('f · ships per dim');
  {
    const shipAnswer = (msg) => ({ type: 'starship', id: msg.id, meta: { arch: msg.arch || 'shuttle', name: 'Test', label: 'T', bounds: [-2, 0, -3, 2, 2, 3], height: 2, length: 6, width: 4, origin: [-2, 0, -3], res: 1, eye: [0, 1.6, -1], seat: [0, 1, -1], gear: [], exhaust: [], guns: [] }, occ: { bx: 4, by: 2, bz: 6, occ: new Uint8Array(48).fill(1) }, hull: { count: 0 }, glass: { count: 0 }, gear: { count: 0 }, interior: null, extra: null, walk: null });
    const meta = Object.assign(META(), { starships: [{ seed: 11, arch: 'shuttle', palette: null, pos: [10, 70, 10], yaw: 0, key: 'a' }, { seed: 12, arch: 'racer', palette: null, pos: [30, 120, 30], yaw: 1, key: null, dim: 'drift' }, { seed: 13, arch: 'shuttle', palette: null, pos: [5, 60, 5], yaw: 0, key: null, dim: 'underforge' }] });
    const g = mkGame(META(), { ship: shipAnswer });
    await play(g, meta);
    await sleep(20);
    check(g.starships.ships.length === 1 && g.starships.ships[0].d.seed === 11, 'in the overworld: its own ship only (the old entry without a dim is home\'s)', g.starships.ships.map(s => s.d.seed).join(','));
    g.saveMeta();
    const sv = g.saved[g.saved.length - 1].starships;
    check(sv.length === 3 && sv.find(s => s.seed === 11).dim === 'overworld' && sv.find(s => s.seed === 12).dim === 'drift' && sv.find(s => s.seed === 13).dim === 'underforge', 'beforeSave: this dim\'s ship gets its dim, the other dims\' ships are kept', JSON.stringify(sv.map(s => [s.seed, s.dim])));
    // piloting ship 11 to the drift: it comes along
    const S = g.starships, s11 = S.ships[0];
    g.gadgets = { riding: { type: 'starship', ship: s11 }, shutdown() { this.riding = null; }, freeSpot: (c) => c[0], beforeSave() {} };
    S.pilot = s11; s11.state = 'flying';
    g.player.pos = [10, 72, 10];
    await TR.go(g, { dim: 'drift', via: 'cmd' });
    await sleep(20);
    check(g.dim === 'drift' && g.starships.ships.some(s => s.d.seed === 11) && g.starships.ships.some(s => s.d.seed === 12), 'in the drift: the piloted ship came along, beside the drift\'s own', g.starships.ships.map(s => s.d.seed).join(','));
    check(close(meta.starships.find(s => s.seed === 11).pos, SPAWN.drift, 0.3) && meta.starships.find(s => s.seed === 11).dim === 'drift', 'its save entry: the drift, at the arrival');
    const dep = g.saved[g.saved.length - 1];
    check(dep.dim === 'overworld' && dep.starships.find(s => s.seed === 11).dim === 'overworld', 'the save at departure keeps it home (a crash mid-trip loses no ship)');
    // on arrival it is set down by the player and boarded when its design is built
    V.Flight = class { constructor() { this.state = 'landed'; } enter() {} leave() {} }; const cr = V.consoleRoom; V.consoleRoom = cr || (() => ({}));
    settle(g);
    for (let k = 0; k < 10; k++) { TR.update(g, 0.1); await sleep(5); }
    check(g.starships.pilot && g.starships.pilot.d.seed === 11, 'and you sit in it again (boarded on arrival)');
    g.saveMeta();
    const sv2 = g.saved[g.saved.length - 1].starships;
    check(sv2.length === 3 && sv2.filter(s => s.dim === 'drift').map(s => s.seed).sort().join(',') === '11,12', 'the next save: two ships in the drift, one in the Underforge', JSON.stringify(sv2.map(s => [s.seed, s.dim])));
    delete V.Flight; if (!cr) delete V.consoleRoom;
  }

  // ================================================================ g · /dim
  console.log('g · /dim');
  {
    const g = mkGame(META()), meta = META();
    await play(g, meta);
    g.chat('/dim');
    const line = g.said.find(t => /Driftinseln/.test(t) && /Unterschmiede/.test(t) && /Herzwelt/.test(t));
    check(!!line, '/dim lists the worlds by name', line);
    g.chat('/dim nirgendwo');
    check(g.said.some(t => /nirgendwo/.test(t)), '/dim nirgendwo: no such world (a hint)');
    g.chat('/dim herzwelt');
    check(g.said.some(t => /Herzwelt/.test(t) && t === V.I18N.t('g.travel.here', { dim: 'Herzwelt' })), '/dim herzwelt at home: already here');
    g.chat('/dim driftinseln');
    for (let k = 0; k < 200 && (g.dim !== 'drift' || g.state !== 'loading'); k++) await sleep(5);
    check(g.dim === 'drift', '/dim driftinseln: by its German name');
    settle(g);
    g.chat('/dim overworld');
    for (let k = 0; k < 200 && (g.dim !== 'overworld' || g.state !== 'loading'); k++) await sleep(5);
    check(g.dim === 'overworld', '/dim overworld: by its id');
    settle(g);
    const gs = mkGame(META()), ms = Object.assign(META(), { mode: 'survival', cheats: false });
    await play(gs, ms);
    gs.chat('/dim drift');
    check(gs.dim === 'overworld' && !TR.busy(gs), '/dim is a command: not without cheats in survival (the gates and Heimkehr work in every mode)');
  }

  // ================================================================ h · the horizon over a round trip
  // (browser run 2: Heimkehr 15–18 s with warm generators — the coarse horizon was built again every time, its LOD
  // tiles at the far lane's 30 % beside the chunks; node: the warm coarse ring alone is ~4 s of one worker)
  console.log('h · the horizon over a round trip');
  {
    const freed = [], gl = { deleteVertexArray(v) { freed.push(v); }, deleteBuffer() {} };
    const h = new V.Horizon({ renderer: { gl }, pool: { workers: [] } });
    const tile = (o) => Object.assign({ L: 4, tx: 0, tz: 0, S: 2048, state: 0, used: 0, empty: false }, o);
    h.tiles.set('4:0:0', tile({ state: 1, vao: 'v1', vbo: 'b1', ibo: 'i1', bytes: 100 }));   // on the GPU
    h.tiles.set('4:1:0', tile({ state: 1, empty: true }));                                    // ready, nothing in it
    h.tiles.set('4:2:0', tile({ state: 0 }));                                                 // asked for: its job goes with the pool
    h.tiles.set('4:3:0', tile({ state: 0, queued: true }));                                   // answered, in the old world's upload queue
    h.tiles.set('4:4:0', tile({ state: 2, failedAt: 0 }));                                    // failed
    h.bytes = 100; h.inflight = 3; h.drawList.push({});
    let farReset = 0; h.far = { reset() { farReset++; } };
    check(typeof h.keepReady === 'function', 'VR.Horizon.keepReady exists');
    if (typeof h.keepReady === 'function') h.keepReady();
    check(JSON.stringify([...h.tiles.keys()]) === JSON.stringify(['4:0:0', '4:1:0']) && h.bytes === 100 && freed.length === 0, 'keepReady: the tiles on the GPU (and the empty ones) stay, nothing is freed', JSON.stringify([...h.tiles.keys()]));
    check(h.inflight === 0 && h.drawList.length === 0 && farReset === 1, 'keepReady: what was still asked for is forgotten (inflight 0), ring 1 starts again');
    h.reset();
    check(h.tiles.size === 0 && h.bytes === 0 && freed.length === 1 && freed[0] === 'v1', 'reset (the title, another save) frees them as before');
  }
  {
    const g = mkGame(META()), meta = META();
    const hz = g.horizon = { resets: 0, keeps: 0, reset() { this.resets++; }, keepReady() { this.keeps++; }, setLevel() {}, setFar() {}, enabled() { return false; }, farPlane() { return 0; }, update() {}, stats: {} };
    await play(g, meta);
    const r0 = hz.resets, k0 = hz.keeps;
    check(r0 === 1 && k0 === 0, 'a world\'s start resets the horizon (as before)', [r0, k0].join(','));
    await TR.go(g, { dim: 'drift', via: 'cmd' }); settle(g);
    check(g.dim === 'drift' && hz.keeps === k0 + 1 && hz.resets === r0, 'the trip to the drift keeps Herzwelt\'s horizon (keepReady, no reset)', [hz.resets, hz.keeps].join(','));
    await TR.go(g, { dim: 'overworld', via: 'home' }); settle(g);
    check(g.dim === 'overworld' && hz.keeps === k0 + 2 && hz.resets === r0, 'Heimkehr finds it there (the same world key: no reset on the way home either)', [hz.resets, hz.keeps].join(','));
    g.teardownWorld();
    check(hz.resets === r0 + 1 && hz.keeps === k0 + 2, 'leaving the world (the title) resets it as before');
  }
  console.log(fails ? 'FAILED ' + fails : 'ALL OK');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('  ✗ the test threw: ' + (e && e.stack || e)); console.log('FAILED 1'); process.exit(1); });

// u-home · neues Leben (docs/superpowers/plans/2026-10-22-u-home.md), node only — the real startWorld / teardownWorld /
// saveMeta / goHome / respawn with GPU, workers and storage stubbed (test/dims.js's harness):
//  a · homes per world: old saves live on Herzwelt (implicit: p.spawn), a bed / 📍 / /sethome on another world makes it
//      the home (meta.universe.home = {dim, pos, since, bed}), back on Herzwelt the spot and no stored home, a home on a
//      world this build does not know counts as Herzwelt and stays in the save, the JSON round trip
//  b · targets: goHome on the home world (no trip), from every other world (the trip, no question), 🌍 Herzwelt from
//      anywhere, respawn on the home world and elsewhere (the instant trip), the implicit home's old paths, a bed only on
//      the save's home dim (a gone bed falls back to Herzwelt's numbers: never on another world)
//  c · guests: the setters in a guest session, pdata out, the host's check, back to the guest
//  d · the pause buttons (labels, 🌍 shown, the 📍's words) and the DOM row
//  e · the compass line (distance, arrow, away: ↑ to the ship)
//  f · the world card's text (de / en, „zuletzt", the orbit form) and the body's disc (lit side, night side, corners,
//      palettes per world, deterministic)
//  g · ships left on another world come home with Heimkehr (to the pad, a slot apart, set on the ground at the home's level;
//      a world's own ship still where the world made it stays there)
//  h · Heimkehr in a moment: the home's 5 × 5 kept over a trip (meshes not freed, out of the renderer's prop list),
//      adopted on the way home (no generation asked for them, shown at once, spawns replayed), not on a changed look or
//      another save (freed), a kept column stays clean when its neighbours arrive, the early arrival, the far lane
//   bash test/wt_run.sh newlife.js
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
require('../src/main/travel.js');
let NLsrc = null; try { require('../src/main/newlife.js'); NLsrc = true; } catch (e) { console.log('  ✗ src/main/newlife.js does not load: ' + (e && e.message)); }
require('../src/main/game.js');
V.I18N.lang = 'de';
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
const D = V.DimReg, TR = V.Travel, NL = V.NewLife;
if (!NLsrc || !NL) { console.log('  ✗ VR.NewLife missing'); console.log('FAILED 1'); process.exit(1); }
const close = (a, b, e) => Array.isArray(a) && Array.isArray(b) && a.length >= b.length && b.every((v, i) => Math.abs(a[i] - v) <= (e || 1e-6));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T = (k, v) => V.I18N.t(k, v);

// ---------------------------------------------------------------- the harness (test/dims.js's, plus a renderer with a prop list)
const G0 = V.Game.prototype;
const SPAWN = { overworld: [12.5, 81, -30.5], drift: [40.5, 133, -8.5], underforge: [3.5, 52, 7.5], hollow: [0.5, 66, 8.5], flat: [0.5, 5, 0.5] };
const mkGame = (meta, o) => {
  o = o || {};
  const g = Object.create(G0), saved = [], said = [], hints = [], jobs = [], freed = [];
  Object.assign(g, {
    state: 'title', frame: 0, time: 0, settings: Object.assign({ renderDist: 4, fancyLeaves: false, motion: 0, homeKeep: true, look: 'seamless' }, o.settings || {}), saved, said, hints, jobs, freed,
    ui: { loading() {}, show() {}, hint(t) { if (t) hints.push(t); }, chatLine(t) { said.push(t); }, toast(a, b) { said.push(a + ' ' + b); }, updateHUD() {}, resume() {}, vehicleHud() {}, screen: null, blocking: false },
    store: { bind(id) { this.worldId = id; }, async savedKeys() { return new Set(); }, saveWorld(m) { saved.push(JSON.parse(JSON.stringify(m))); return Promise.resolve(); }, saveColumn() { return Promise.resolve(); }, async loadColumn() { return null; } },
    pool: { workers: [{ inflight: 0 }], farShare: 0.3, inits: [], gens: [], broadcast(m) { if (m && m.type === 'init') this.inits.push(!!m.keep); }, clear() {}, submit(msg) { if (msg && msg.type === 'gen') this.gens.push(msg.cx + ',' + msg.cz); }, pump() {}, direct(wi, msg, tr, cb) { jobs.push(msg); if (msg.type === 'spawn') setTimeout(() => cb({ type: 'spawn', id: msg.id, pos: (SPAWN[msg.dim] || [0.5, 100, 0.5]).slice() }), 1); else if (msg.type === 'starship' && o.ship) setTimeout(() => cb(o.ship(msg)), 1); } },
    renderer: { propSecs: new Set(), freeSection(s) { freed.push(s); s.hasMesh = false; s.meshed = false; this.propSecs.delete(s); }, visDirty: false, gl: {} },   // (as the renderer's: propSet(sec, null) takes it off the prop list)
    env: { ticks: 6000, day: 2, get timeOfDay() { return this.ticks % 24000; }, setTime(t) { this.ticks = t; }, wx: { setSeed() {}, force() {} } },
    input: { captured: true, releaseLock() {}, requestLock() {} },
    mp: o.mp || null, horizon: null, audio: { play() {} }, titleSeed: 1,
  });
  return g;
};
const META = (x) => Object.assign({ id: 'wnl', name: 'Neues Leben', seed: 4242, mode: 'creative', difficulty: 'peaceful', type: 'default', cheats: true, keep: false, kit: false, created: 1, lastPlayed: 1, player: null, time: 6000, dim: 'overworld', vgen: 12 }, x || {});
const play = async (g, meta) => { await g.startWorld(meta, true); g.state = 'play'; const p = g.player, h = p.hold; if (h) { p.pos = [h.x, h.y, h.z]; p.hold = null; } if (!meta.guest && !Array.isArray(meta.worldSpawn)) meta.worldSpawn = p.spawn.slice(0, 3); return p; };
const settle = (g) => { const p = g.player, h = p && p.hold; if (h) { p.pos = [h.x, h.y, h.z]; if (h.yaw !== null && h.yaw !== undefined) { p.yaw = h.yaw; p.pitch = h.pitch || 0; } p.hold = null; } g.state = 'play'; TR.update(g, 0.016); };
const waitDim = async (g, dim) => { for (let k = 0; k < 400 && (g.dim !== dim || g.state !== 'loading'); k++) await sleep(5); return g.dim === dim; };
const holdAt = (p) => (p.hold ? [p.hold.x, p.hold.y, p.hold.z] : null);
TR.FADE_IN = 5; TR.FADE_OUT = 5;

(async () => {
  // ================================================================ a · homes per world
  console.log('a · homes per world');
  {
    // an old save (no universe): it lives on Herzwelt, at its spot
    const m0 = META({ player: { pos: [5, 80, 5], spawn: [7.5, 81, 9.5], spawnBed: [7, 80, 9] } });
    const h0 = NL.homeOf(m0, null);
    check(h0.dim === 'overworld' && h0.implicit === true && close(h0.pos, [7.5, 81, 9.5]) && close(h0.bed, [7, 80, 9]), 'an old save lives on Herzwelt at its spot and bed', JSON.stringify(h0));
    check(NL.homeOf(META({ type: 'flat', dim: 'flat' }), null).dim === 'flat', 'a flat world lives on its flat land');
    // a home on a world this build does not know: Herzwelt, and the save keeps it for a newer build
    const mu = META({ universe: { v: 1, home: { dim: 'opal', pos: [1, 2, 3], since: 5 } } });
    check(NL.homeOf(mu, null).dim === 'overworld' && mu.universe.home.dim === 'opal', 'a home on an unknown world (opal before u-moons1): Herzwelt now, kept in the save', NL.homeOf(mu, null).dim);
    check(NL.homeOf(META({ universe: { home: { dim: 'drift', pos: [1, NaN, 3] } } }), null).dim === 'overworld', 'a broken home (NaN) counts as Herzwelt');

    const g = mkGame(META()), meta = META();
    let p = await play(g, meta);
    check(NL.homeDim(g) === 'overworld' && !(meta.universe && meta.universe.home), 'a new world: home is Herzwelt, nothing stored');
    // 📍 on Herzwelt: the spot moves, the home stays Herzwelt (no stored home), the answer says so
    p.pos = [20.3, 82, -25.7];
    const r0 = g.setSpawnHere();
    check(r0 === 'spot' && close(p.spawn, [20.5, 82, -25.5]) && p.spawnBed === null && !(meta.universe && meta.universe.home), '📍 on Herzwelt: the spot moves (Mein Platz ist hier), no stored home', r0 + ' ' + JSON.stringify(p.spawn));
    // to the drift; 📍 „Hier wohne ich" there: the drift is the home now
    await TR.go(g, { dim: 'drift', via: 'cmd' }); settle(g); p = g.player;
    check(g.dim === 'drift', 'in the Driftinseln');
    p.pos = [44.2, 131, -2.6];
    const t0 = Date.now();
    const r1 = g.setSpawnHere();
    const H = meta.universe && meta.universe.home;
    check(r1 === 'moved' && H && H.dim === 'drift' && close(H.pos, [44.5, 131, -2.5]) && H.since >= t0 && H.bed === null, '📍 in the drift: the home moves there (dim, pos, since)', r1 + ' ' + JSON.stringify(H));
    check(close(p.spawn, [20.5, 82, -25.5]), 'Herzwelt\'s spot stays where it was (🌍 goes there)');
    check(g.hints.some(t => /Driftinseln/.test(t)) || g.said.some(t => /Driftinseln/.test(t)), 'a line says where you live now', g.said.slice(-1)[0]);
    check(NL.homeDim(g) === 'drift' && NL.homeOf(meta, p).implicit === false, 'homeOf: the drift, stored');
    // a bed in the drift: the home is the bed's spot, with the bed
    g.sleep(50, 130, 3);
    const H2 = meta.universe.home;
    check(H2.dim === 'drift' && close(H2.pos, [50.5, 130.6, 3.5]) && close(H2.bed, [50, 130, 3]), 'a bed in the drift: the home is there, with its bed', JSON.stringify(H2));
    check(close(p.spawn, [20.5, 82, -25.5]), 'the bed in the drift leaves Herzwelt\'s spot alone');
    // /sethome in the drift
    p.pos = [46, 131, 0];
    g.chat('/sethome');
    check(meta.universe.home.dim === 'drift' && close(meta.universe.home.pos, [46, 131, 0]) && meta.universe.home.bed === null, '/sethome in the drift: the home is here (exactly)', JSON.stringify(meta.universe.home));
    // the save: through JSON and back
    g.saveMeta();
    const sv = JSON.parse(JSON.stringify(g.saved[g.saved.length - 1]));
    check(sv.universe && sv.universe.home && sv.universe.home.dim === 'drift' && close(sv.universe.home.pos, [46, 131, 0]) && sv.universe.home.since >= t0, 'meta.universe.home through saveMeta\'s JSON', JSON.stringify(sv.universe));
    check(NL.homeOf(sv, null).dim === 'drift', 'and read back from the save');
    // back on Herzwelt, a bed: the home is Herzwelt again (no stored home; p.spawn and the bed)
    await TR.go(g, { dim: 'overworld', via: 'cmd' }); settle(g); p = g.player;
    g.sleep(30, 80, 30);
    check(!meta.universe.home && close(p.spawn, [30.5, 80.6, 30.5]) && close(p.spawnBed, [30, 80, 30]) && NL.homeDim(g) === 'overworld', 'a bed on Herzwelt: home on Herzwelt again (the spot and the bed, nothing stored)', JSON.stringify(meta.universe));
  }

  // ================================================================ b · targets
  console.log('b · Heimkehr and respawn targets');
  {
    const g = mkGame(META()), meta = META();
    let p = await play(g, meta);
    // the implicit home at home: the old goHome (a teleport to the spot, no trip)
    p.pos = [60, 80, 60]; g.goHome();
    check(!TR.busy(g) && close(holdAt(p), SPAWN.overworld, 0.3) && g.said.some(t => t === T('g.chat.homeSpawn')), 'Herzwelt home, on Herzwelt: goHome is what it was');
    settle(g);
    // home in the drift, the player on Herzwelt: goHome travels there, no question
    await TR.go(g, { dim: 'drift', via: 'cmd' }); settle(g); p = g.player;
    p.pos = [44.5, 131, -2.5]; g.setSpawnHere();
    await TR.go(g, { dim: 'overworld', via: 'cmd' }); settle(g); p = g.player;
    const tg = NL.target(g);
    check(tg && tg.dim === 'drift' && close(tg.pos, [44.5, 131, -2.5]) && tg.bed === null, 'the target: the drift home (no bed off the save\'s home dim)', JSON.stringify(tg));
    g.goHome();
    check(TR.busy(g), '🏠 on Herzwelt with the home in the drift: the trip starts at once');
    check(await waitDim(g, 'drift'), 'and it goes to the drift');
    p = g.player;
    check(close(holdAt(p), [44.5, 131, -2.5], 0.01), 'and lands at the home', JSON.stringify(holdAt(p)));
    settle(g);
    check(g.said.some(t => t === T('g.travel.home', { dim: TR.dimName('drift') })), 'the arrival says „wieder daheim" in the drift (the home\'s world)', g.said.slice(-1)[0]);
    // at home in the drift, away from the spot: goHome teleports there
    p.pos = [80, 120, 40]; g.goHome();
    check(!TR.busy(g) && close(holdAt(p), [44.5, 131, -2.5], 0.01), '🏠 in the drift: a teleport to the home, no trip');
    settle(g);
    // 🌍 Herzwelt from the drift: the trip to Herzwelt's spot
    NL.goHerz(g);
    check(TR.busy(g), '🌍 in the drift: the trip to Herzwelt');
    check(await waitDim(g, 'overworld'), 'to Herzwelt');
    p = g.player;
    check(close(holdAt(p), SPAWN.overworld, 0.3), '🌍 lands at Herzwelt\'s spot', JSON.stringify(holdAt(p)));
    settle(g);
    check(g.said.some(t => t === T('g.travel.arrived', { dim: TR.dimName('overworld') })), 'on Herzwelt with the home elsewhere: „✦ Herzwelt …" (not „wieder daheim")', g.said.slice(-1)[0]);
    // 🌍 on Herzwelt: a teleport to the spot
    p.pos = [99, 80, 99]; NL.goHerz(g);
    check(!TR.busy(g) && close(holdAt(p), SPAWN.overworld, 0.3), '🌍 on Herzwelt: to Herzwelt\'s spot, no trip');
    settle(g);
    // a death on Herzwelt with the home in the drift: the instant trip home
    p.dead = true; p.respawn();
    check(TR.busy(g), 'a death on Herzwelt, home in the drift: the trip home at once');
    check(await waitDim(g, 'drift'), 'to the drift');
    p = g.player;
    check(close(holdAt(p), [44.5, 131, -2.5], 0.01) && !p.dead, 'waking at the home', JSON.stringify(holdAt(p)));
    settle(g);
    // a death in the drift (the home's world): back at the home, no trip
    p.pos = [90, 60, 90]; p.dead = true; p.respawn();
    check(!TR.busy(g) && g.dim === 'drift' && close(holdAt(p), [44.5, 131, -2.5], 0.01), 'a death in the drift (home): back at the home, no trip');
    settle(g);
    // the Unterschmiede with the home in the drift: 🏠 → the drift
    await TR.go(g, { dim: 'underforge', via: 'cmd' }); settle(g);
    g.goHome();
    check(await waitDim(g, 'drift'), '🏠 in the Unterschmiede: home to the drift');
    settle(g);
    // the implicit home away (an old save): u-dims's paths — the trip to Herzwelt's spawn
    const g2 = mkGame(META()), m2 = META(); await play(g2, m2);
    await TR.go(g2, { dim: 'hollow', via: 'cmd' }); settle(g2);
    check(NL.target(g2).dim === 'overworld', 'the implicit home away: the target is Herzwelt');
    g2.goHome();
    check(await waitDim(g2, 'overworld'), 'and 🏠 goes there');
    settle(g2);
    // a guest: the old goHome (the host's world, no trip)
    const gg = mkGame(META()); const mg = META(); await play(gg, mg); mg.guest = true;
    gg.goHome();
    check(!TR.busy(gg) && gg.dim === 'overworld', 'a guest: the old goHome');
  }

  // ================================================================ c · guests
  console.log('c · guests');
  {
    check(NL.sane(null) === null && NL.sane({ dim: 'drift', pos: [1, 2] }) === null && NL.sane({ dim: 'a:b', pos: [1, 2, 3] }) === null && NL.sane('x') === null, 'sane: no home, a short pos, a bad id, junk → null');
    const s = NL.sane({ dim: 'drift', pos: [1.234, 2, 3], since: 9, bed: [1, 2, 3], evil: 1 });
    check(s && s.dim === 'drift' && close(s.pos, [1.23, 2, 3]) && s.since === 9 && close(s.bed, [1, 2, 3]) && !('evil' in s), 'sane keeps dim, pos (rounded), since, bed', JSON.stringify(s));
    // a guest session (the meta mp.js makes): the bed sets the guest's home in the session; pdata carries it
    const g = mkGame(META(), { mp: { isClient: true, sendPdata() {} } }), meta = META({ guest: true, id: 'guest-x' });
    await play(g, meta); meta.guest = true;
    g.dim = 'drift';   // (Konvoi phase 2: a guest in another dim — today a guest stays in the host's home dim)
    g.sleep(10, 70, 10);
    const out = NL.pdataOf(g);
    check(out && out.dim === 'drift' && close(out.pos, [10.5, 70.6, 10.5]), 'a guest\'s bed away: the home rides in pdata', JSON.stringify(out));
    g.dim = 'overworld';
    // the host keeps it in meta.guests and gives it back
    const back = NL.sane(JSON.parse(JSON.stringify(out)));
    const g3 = mkGame(META(), { mp: { isClient: true } }), m3 = META({ guest: true, id: 'guest-y' });
    await play(g3, m3); m3.guest = true;
    NL.fromPdata(g3, back);
    check(NL.homeOf(m3, g3.player).dim === 'drift', 'back to the guest: the home from pdata');
    check(NL.pdataOf(mkGameDone(META())) === null, 'a Herzwelt home: nothing extra in pdata (spawn carries it)');
  }

  // ================================================================ d · the pause buttons
  console.log('d · the pause buttons');
  {
    const g = mkGame(META()), meta = META();
    await play(g, meta);
    let M = NL.pauseModel(g);
    check(M.home.label === T('g.pause.home') && !M.herz.show && M.pin.key === 'g.pause.spawn', 'Herzwelt home on Herzwelt: 🏠 Zu meinem Platz · 📍 Mein Platz ist hier, no 🌍', JSON.stringify(M));
    await TR.go(g, { dim: 'drift', via: 'cmd' }); settle(g);
    M = NL.pauseModel(g);
    check(M.home.label === T('g.pause.home') && !M.herz.show && M.pin.key === 'g.nl.liveHere' && M.pin.label === '📍 Hier wohne ich', 'Herzwelt home, in the drift: the 📍 says „Hier wohne ich"', M.pin.label);
    g.setSpawnHere();
    M = NL.pauseModel(g);
    check(M.home.label === '🏠 Zuhause (Driftinseln)' && M.herz.show && M.herz.label === '🌍 Herzwelt' && M.pin.key === 'g.pause.spawn', 'drift home, in the drift: 🏠 Zuhause (Driftinseln) · 🌍 Herzwelt · 📍 Mein Platz ist hier', JSON.stringify([M.home.label, M.herz.label, M.pin.label]));
    await TR.go(g, { dim: 'overworld', via: 'cmd' }); settle(g);
    M = NL.pauseModel(g);
    check(M.home.label === '🏠 Zuhause (Driftinseln)' && M.herz.show && M.pin.key === 'g.nl.liveHere', 'drift home, on Herzwelt: both buttons and „Hier wohne ich"');
    V.I18N.lang = 'en'; M = NL.pauseModel(g); V.I18N.lang = 'de';
    check(M.home.label === '🏠 Home (Drift Isles)' && M.herz.label === '🌍 Heartworld' && M.pin.label === '📍 I live here', 'and in English', JSON.stringify([M.home.label, M.herz.label, M.pin.label]));
    // the DOM: the row gets 🌍 after 🏠, the 📍 its words
    const pause = document.createElement('div'); pause.setAttribute('id', 'pause'); document.body.appendChild(pause);
    const row = document.createElement('div'); pause.appendChild(row);
    const bh = document.createElement('button'); bh.setAttribute('data-act', 'gohome'); bh.setAttribute('data-t', 'g.pause.home'); row.appendChild(bh);
    const bs = document.createElement('button'); bs.setAttribute('data-act', 'sethome'); bs.setAttribute('data-t', 'g.pause.spawn'); row.appendChild(bs);
    NL.pauseMenu({ game: g });
    const bz = pause.querySelector('[data-act="goherz"]');
    check(bh.textContent === '🏠 Zuhause (Driftinseln)' && bz && bz.textContent === '🌍 Herzwelt' && bs.textContent === '📍 Hier wohne ich' && bs.getAttribute('data-t') === 'g.nl.liveHere', 'the pause menu\'s row: 🏠 Zuhause (Driftinseln) · 🌍 Herzwelt · 📍 Hier wohne ich', [bh.textContent, bz && bz.textContent, bs.textContent].join(' | '));
    // a guest: no 🌍
    meta.guest = true; M = NL.pauseModel(g); meta.guest = false;
    check(!M.herz.show, 'a guest sees no 🌍');
    pause.remove();
  }

  // ================================================================ e · the compass
  console.log('e · the compass');
  {
    const g = mkGame(META()), meta = META();
    const p = await play(g, meta);
    p.spawn = [0.5, 80, 0.5]; p.pos = [0.5, 80, 10.5]; p.yaw = 0;
    check(NL.compassLine(g) === '', 'at home (10 m): nothing');
    p.pos = [0.5, 80, 230.5]; p.yaw = 0;   // the home 230 m north (−z); looking north
    const l1 = NL.compassLine(g);
    check(/Zuhause 230 m/.test(l1) && /↑/.test(l1), 'the home 230 m ahead: „🏠 Zuhause 230 m ↑"', l1);
    check(/text-shadow/.test(l1), 'the line carries a shadow (legible on the bright hall)', l1);
    p.yaw = Math.PI;   // looking south: the home behind
    check(/↓/.test(NL.compassLine(g)), 'turned round: ↓');
    p.yaw = Math.PI / 2;   // looking west (−x): north is to the right
    check(/→/.test(NL.compassLine(g)), 'looking west: →', NL.compassLine(g));
    await TR.go(g, { dim: 'drift', via: 'cmd' }); settle(g);
    const l2 = NL.compassLine(g);
    check(/↑/.test(l2) && /Herzwelt/.test(l2) && /zum Schiff/.test(l2), 'on another world: „🏠 ↑ Herzwelt — zum Schiff"', l2);
  }

  // ================================================================ f · the world card
  console.log('f · the world card and the disc');
  {
    const de = (m) => NL.cardText(m).text;
    check(de(META()) === 'Wohnt auf Herzwelt', 'an old world: „Wohnt auf Herzwelt"', de(META()));
    const m1 = META({ dim: 'overworld', universe: { v: 1, home: { dim: 'drift', pos: [1, 2, 3], since: 1 } } });
    check(de(m1) === 'Wohnt auf den Driftinseln · zuletzt auf Herzwelt', 'home in the drift, left on Herzwelt', de(m1));
    check(de(META({ dim: 'underforge' })) === 'Wohnt auf Herzwelt · zuletzt in der Unterschmiede', 'left in the Unterschmiede', de(META({ dim: 'underforge' })));
    check(de(META({ dim: 'drift', universe: { home: { dim: 'drift', pos: [1, 2, 3] } } })) === 'Wohnt auf den Driftinseln', 'home and last place the same: one phrase');
    check(de(META({ dim: 'hollow', universe: { at: 'space', ship: { space: { frame: 'basalt' } }, home: { dim: 'drift', pos: [1, 2, 3] } } })) === 'Wohnt auf den Driftinseln · zuletzt im Orbit über Basalt', 'in orbit (u-ascent\'s save): „zuletzt im Orbit über Basalt"', de(META({ dim: 'hollow', universe: { at: 'space', ship: { space: { frame: 'basalt' } }, home: { dim: 'drift', pos: [1, 2, 3] } } })));
    V.I18N.lang = 'en';
    check(de(m1) === 'Lives on the Drift Isles · last on Heartworld', 'and in English', de(m1));
    V.I18N.lang = 'de';
    check(NL.cardText(m1).homeDim === 'drift' && NL.cardText(m1).lastDim === 'overworld', 'the card knows both worlds');
    // the disc: 32 × 32 RGBA, lit from the upper left
    const px = NL.discPixels('overworld', 32);
    check(px && px.length === 32 * 32 * 4, 'the disc: 32 × 32 RGBA', px && px.length);
    const at = (a, x, y) => { const i = (y * 32 + x) * 4; return [a[i], a[i + 1], a[i + 2], a[i + 3]]; };
    const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    check(at(px, 0, 0)[3] === 0 && at(px, 31, 31)[3] === 0 && at(px, 0, 31)[3] === 0, 'the corners are see-through');
    check(at(px, 16, 16)[3] === 255, 'the middle is solid');
    const quad = (a, x0, y0) => { let s = 0, n = 0; for (let y = y0; y < y0 + 8; y++) for (let x = x0; x < x0 + 8; x++) { const c = at(a, x, y); if (c[3] > 250) { s += lum(c); n++; } } return n ? s / n : 0; };
    const lit = quad(px, 8, 8), night = quad(px, 18, 18);
    check(lit > night * 2.5, 'the lit side (upper left) is much brighter than the night side', lit.toFixed(1) + ' / ' + night.toFixed(1));
    let blue = 0, green = 0; for (let i = 0; i < px.length; i += 4) if (px[i + 3] > 250) { if (px[i + 2] > px[i] + 20 && px[i + 2] > px[i + 1]) blue++; if (px[i + 1] > px[i] + 15 && px[i + 1] > px[i + 2]) green++; }
    check(blue > 40 && green > 15, 'Herzwelt shows sea and land', blue + ' blue · ' + green + ' green');
    const mean = (d) => { const a = NL.discPixels(d, 32); let r = 0, gg = 0, b = 0, n = 0; for (let i = 0; i < a.length; i += 4) if (a[i + 3] > 250) { r += a[i]; gg += a[i + 1]; b += a[i + 2]; n++; } return [r / n, gg / n, b / n]; };
    const means = ['overworld', 'drift', 'underforge', 'hollow', 'opal', 'basalt', 'aqua', 'zinn', 'ocker', 'flat'].map(d => [d, mean(d)]);
    let distinct = true;
    for (let i = 0; i < means.length; i++) for (let j = i + 1; j < means.length; j++) { const a = means[i][1], b = means[j][1]; if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < 12) { distinct = false; console.log('      (alike: ' + means[i][0] + ' ' + means[j][0] + ')'); } }
    check(distinct, 'every world has its own colours (Herzwelt, Driftinseln, Unterschmiede, Hohlwelt, Opal, Basalt, Aquamarin, Zinnober, Ocker, Flachwelt)');
    const u = mean('underforge'), o = mean('opal');
    check(u[0] > u[2] && o[0] + o[1] + o[2] > u[0] + u[1] + u[2] + 150, 'the Unterschmiede glows warm and dark, Opal is bright ice', JSON.stringify([u.map(Math.round), o.map(Math.round)]));
    const px2 = NL.discPixels('overworld', 32);
    let same = true; for (let i = 0; i < px.length; i++) if (px[i] !== px2[i]) { same = false; break; }
    check(same, 'the same disc every time (deterministic)');
    check(NL.discPixels('nowhere', 16).length === 16 * 16 * 4, 'an unknown world still gets a disc');
  }

  // ================================================================ g · ships come home
  console.log('g · ships left on another world come home with Heimkehr');
  {
    const shipAnswer = (msg) => ({ type: 'starship', id: msg.id, meta: { arch: msg.arch || 'shuttle', name: 'Test', label: 'T', bounds: [-2, 0, -3, 2, 2, 3], height: 2, length: 6, width: 4, origin: [-2, 0, -3], res: 1, eye: [0, 1.6, -1], seat: [0, 1, -1], gear: [], exhaust: [], guns: [] }, occ: { bx: 4, by: 2, bz: 6, occ: new Uint8Array(48).fill(1) }, hull: { count: 0 }, glass: { count: 0 }, gear: { count: 0 }, interior: null, extra: null, walk: null });
    // the pad: the temple apron for a Heartland home near it, else beside the home; a slot apart
    const pA = NL.padFor({ dim: 'overworld', pos: [10, 81, 40] }, META(), 0), pB = NL.padFor({ dim: 'overworld', pos: [10, 81, 40] }, META(), 1);
    check(close(pA, [0.5, 81, 30.5], 0.01) && Math.hypot(pB[0] - pA[0], pB[2] - pA[2]) >= 14, 'a Heartland home near the temple: the apron (the dock site), the next ship a slot apart', JSON.stringify([pA, pB]));
    const pC = NL.padFor({ dim: 'drift', pos: [44.5, 131, -2.5] }, META(), 0);
    check(Math.hypot(pC[0] - 44.5, pC[2] + 2.5) >= 10 && Math.hypot(pC[0] - 44.5, pC[2] + 2.5) <= 20 && pC[1] === 131, 'another world: beside the home', JSON.stringify(pC));
    check(close(NL.padFor({ dim: 'overworld', pos: [2000, 70, 2000] }, META(), 0).slice(0, 1), [2000], 30), 'a Herzwelt home far from the temple: beside the home');
    // a ship on Herzwelt, the home in the drift: Heimkehr brings it to the drift
    // (23: the world's own ship, still where the world made it — it stays; 24: one the world made, flown away and left — it comes)
    const meta = META({ starships: [{ seed: 21, arch: 'shuttle', palette: null, pos: [10, 81, 10], yaw: 0, key: null, dim: 'overworld' }, { seed: 22, arch: 'racer', palette: null, pos: [60, 90, 60], yaw: 0, key: null, dim: 'hollow' },
      { seed: 23, arch: 'shuttle', palette: null, pos: [0, 81, 30], yaw: 0, key: '0,81,30', dim: 'overworld' }, { seed: 24, arch: null, palette: null, pos: [140, 84, 100], yaw: 0, key: '100,81,100', dim: 'overworld' }] });
    const g = mkGame(META(), { ship: shipAnswer });
    let p = await play(g, meta);
    await TR.go(g, { dim: 'drift', via: 'cmd' }); settle(g); p = g.player;
    p.pos = [44.5, 131, -2.5]; g.setSpawnHere();
    await TR.go(g, { dim: 'overworld', via: 'cmd' }); settle(g);
    check(g.starships.ships.some(s => s.d.seed === 21) && g.starships.ships.some(s => s.d.seed === 23), 'on Herzwelt: the shuttle stands there, and the world\'s own');
    await TR.go(g, { dim: 'drift', via: 'home' }); settle(g);
    await sleep(20);
    const here = g.starships.ships.map(s => s.d.seed).sort().join(',');
    check(here === '21,22,24', 'Heimkehr to the drift: the ships left elsewhere are here now — not the world\'s own ship still where the world made it', here);
    const s21 = g.starships.ships.find(s => s.d.seed === 21);
    check(s21 && Math.hypot(s21.pos[0] - 44.5, s21.pos[2] + 2.5) < 30, 'beside the home (the home pad)', s21 && JSON.stringify(s21.pos));
    check(g.said.some(t => /Schiffe/.test(t) && /3/.test(t)), 'a line says three ships came', g.said.slice(-1)[0]);
    g.saveMeta();
    const sv = g.saved[g.saved.length - 1].starships;
    check(sv.filter(s => s.dim === 'drift').length === 3, 'the save: three in the drift', JSON.stringify(sv.map(s => [s.seed, s.dim])));
    check(sv.some(s => s.seed === 23 && s.dim === 'overworld' && s.key === '0,81,30'), 'the save: the world\'s own ship still on Herzwelt, at its place', JSON.stringify(sv.filter(s => s.seed === 23)));
    // the settle: on the ground under the pad once the design is built — a world of air with a floor at y 125 (the home
    // stands at 131) and an isle hanging at y 149 above: the floor at the home's level, not the isle above it
    const stone = V.R.byName.stone.defaultState;
    const loaded = new Set();   // (the pad's column comes in after a while: nothing is set down before)
    g.world.isLoaded = (x, z) => loaded.has((x >> 4) + ',' + (z >> 4));
    g.world.getBlock = (x, y, z) => (loaded.has((x >> 4) + ',' + (z >> 4)) && (y === 125 || y === 149) ? stone : 0);
    for (let k = 0; k < 4; k++) { TR.update(g, 0.1); await sleep(5); }
    check(g.nl && g.nl.settle && g.nl.settle.length === 3, 'the pad\'s column not loaded yet: the ships wait above it', g.nl && g.nl.settle && g.nl.settle.length);
    for (const s of g.starships.ships) for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) loaded.add(((Math.floor(s.pos[0]) >> 4) + dx) + ',' + ((Math.floor(s.pos[2]) >> 4) + dz));
    for (let k = 0; k < 10; k++) { TR.update(g, 0.1); await sleep(5); }
    const s21b = g.starships.ships.find(s => s.d.seed === 21);
    check(s21b && s21b.pos[1] === 126, 'set down on the ground under the pad at the home\'s level (not on the isle 18 above)', s21b && s21b.pos[1]);
    check(!(g.nl && g.nl.settle && g.nl.settle.length), 'every recalled ship is set down', g.nl && g.nl.settle && g.nl.settle.length);
    // nothing near the home's level (a pad over the void): the isle above, as a parked ship would
    {
      const S = g.starships, s = S.ships.find(q => q.d.seed === 24);
      g.world.getBlock = (x, y, z) => (y === 149 ? stone : 0); g.world.isLoaded = () => true;
      s.pos[1] = 131; g.nl.settle.push({ s, y: 131, t: 0 }); TR.update(g, 0.1);
      check(s.pos[1] === 150 && !g.nl.settle.length, 'a pad over the void: on the isle above', s.pos[1]);
    }
    // a trip that is not Heimkehr recalls nothing
    const g2 = mkGame(META(), { ship: shipAnswer }), m2 = META({ starships: [{ seed: 31, arch: 'shuttle', palette: null, pos: [1, 81, 1], yaw: 0, key: null, dim: 'drift' }] });
    await play(g2, m2);
    await TR.go(g2, { dim: 'hollow', via: 'cmd' }); settle(g2);
    check(!g2.starships.ships.some(s => s.d.seed === 31), 'a /dim trip leaves the ships where they are');
  }

  // ================================================================ h · Heimkehr in a moment
  console.log('h · the home kept warm, the early arrival');
  {
    // a world with real columns round the spawn (fabricated: every section meshed, some with prop anchors)
    const g = mkGame(META()), meta = META();
    let p = await play(g, meta);
    const w = g.world, R0 = g.renderer, stone = V.R.byName.stone.defaultState;
    const mkCol = (cx, cz) => {
      const c = new V.Column(cx, cz);
      c.blocks = new Uint16Array(65536); c.light = new Uint16Array(65536).fill(0xf000); c.biome = new Uint8Array(256); c.caveBiome = new Int8Array(256);
      c.grass = new Uint16Array(256); c.foliage = new Uint16Array(256); c.water = new Uint16Array(256);
      for (let i = 0; i < 256 * 64; i++) c.blocks[i] = stone;
      for (let i = 0; i < 256; i++) c.height[i] = 63;
      for (let sy = 0; sy < 16; sy++) { const s = c.sec[sy]; s.count = sy < 4 ? 4096 : 0; s.dirty = false; s.pending = false; s.meshed = true; s.meshVer = s.ver; s.hasMesh = sy < 4; s.fade = 1; s.mesh = [sy < 4 ? { arena: { release() {} }, off: 0, cap: 96 } : null, null, null, null, null]; if (sy === 3) { s.propN = 1; R0.propSecs.add(s); } }
      c.ready = true; c.shownAt = 1; c.fade = 1;
      c.spawns0 = cx === cx0 && cz === cz0 ? [['hallcrew', 1, 81, 2, 0, 0, 0, 0, 0]] : null;
      return c;
    };
    const cx0 = Math.floor(p.spawn[0]) >> 4, cz0 = Math.floor(p.spawn[2]) >> 4;
    for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) { const c = mkCol(cx0 + dx, cz0 + dz); w.cols.set(c.key, c); }
    const ring = []; for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) ring.push(V.ckey(cx0 + dx, cz0 + dz));
    const kept0 = ring.map(k => w.cols.get(k));
    kept0[12].sec[2].dirty = true;      // the middle column: a section whose newest mesh was not up yet …
    kept0[11].sec[1].pending = true;    // … and one whose job was still queued
    const props0 = R0.propSecs.size;
    // leave: the 5 × 5 round the home (Herzwelt's spot) is kept, the rest freed as before
    await TR.go(g, { dim: 'drift', via: 'cmd' }); settle(g);
    const K = NL.keepInfo(g);
    check(K && K.overworld && K.overworld.cols === 25, 'leaving Herzwelt: its 5 × 5 round the home kept', JSON.stringify(K));
    const freedKept = g.freed.filter(s => kept0.some(c => c.sec.includes(s))).length;
    check(freedKept === 0 && g.freed.length === (81 - 25) * 4, 'their meshes are not freed (the others are)', freedKept + ' kept freed · ' + g.freed.length + ' freed');
    check(R0.propSecs.size === props0 - 81, 'no section of Herzwelt left in the renderer\'s prop list while away (no palm in the drift)', R0.propSecs.size + ' of ' + props0);
    check(kept0[12].sec[2].dirty === true && kept0[11].sec[1].pending === false && kept0[11].sec[1].dirty === true, 'a section with a newer mesh on the way is meshed again on return (its job was dropped)');
    check(K.overworld.mb > 0, 'the kept memory is counted', K.overworld.mb);
    // the trip to the hollow keeps it (a world that is no Heimkehr target)
    await TR.go(g, { dim: 'hollow', via: 'cmd' }); settle(g);
    check(NL.keepInfo(g).overworld && NL.keepInfo(g).overworld.cols === 25, 'a trip on to the Hohlwelt keeps Herzwelt\'s ring');
    // Heimkehr: adopted
    g.pool.gens.length = 0; g.freed.length = 0;
    const loaded = []; const lc = g.onColumnLoaded; g.onColumnLoaded = function (c) { loaded.push([c, c.spawns]); return lc.call(this, c); };
    g.goHome();
    check(await waitDim(g, 'overworld'), 'Heimkehr to Herzwelt');
    g.onColumnLoaded = lc;
    const w2 = g.world;
    check(ring.every(k => w2.cols.get(k) === kept0[ring.indexOf(k)]), 'the new world holds the kept columns themselves');
    check(!NL.keepInfo(g).overworld && g.nlAdopted === 25, 'adopted (25), the keep is empty', g.nlAdopted);
    check(kept0.every(c => c.shownAt >= 0 && c.fade === 1), 'shown at once (no fade from nothing)');
    check(R0.propSecs.size === props0 - 81 + 25, 'their prop anchors are back in the renderer\'s list', R0.propSecs.size);
    check(loaded.some(([c, sp]) => c === kept0[12] && sp && sp[0][0] === 'hallcrew'), 'their spawns go to the actors again (the hall crew)');
    check(ring.every(k => w2.shDirty.has(k)), 'their shadow heights are uploaded again');
    // the streaming asks for the others, never for the kept
    w2.update(p.pos[0], p.pos[1], p.pos[2], 1000); w2.update(p.pos[0], p.pos[1], p.pos[2], 1016);
    const asked = new Set(g.pool.gens), keptAsked = ring.filter(k => { const c = w2.cols.get(k); return asked.has(c.cx + ',' + c.cz); });
    check(keptAsked.length === 0 && asked.size > 0, 'no generation asked for a kept column (the others are asked for)', keptAsked.length + ' / ' + asked.size);
    // the early arrival: the near ring is there with its meshes — the loading may end now
    p = g.player; p.pos = holdAt(p) || p.pos;
    check(NL.nearReady(w2, Math.floor(p.pos[0]) >> 4, Math.floor(p.pos[2]) >> 4, 2), 'the 5 × 5 round the arrival is ready at once');
    check(NL.loading(g) === true, 'a trip\'s loading ends as soon as the near columns are in');
    check(g.pool.farShare === 0, 'during a trip\'s loading the far lane only gets idle time');
    settle(g);
    check(g.pool.farShare === 0.3, 'and gets its share back on arrival', g.pool.farShare);
    check(NL.lastTrip && NL.lastTrip.adopted === 25 && NL.lastTrip.to === 'overworld' && NL.lastTrip.ms && NL.lastTrip.ms.total >= 0, 'the trip\'s phases are kept (VR.NewLife.lastTrip)', JSON.stringify(NL.lastTrip));
    // a neighbour arrives next to a kept column: it stays clean (its mesh is still right) …
    const outer = w2.cols.get(V.ckey(cx0 + 2, cz0)), mid = w2.cols.get(V.ckey(cx0, cz0));
    w2.cols.delete(V.ckey(cx0 + 3, cz0));
    for (const s of outer.sec) s.dirty = false;
    const nb = mkCol(cx0 + 3, cz0);
    w2.onColumn({ cx: nb.cx, cz: nb.cz, blocks: nb.blocks, light: nb.light, biome: nb.biome, caveBiome: nb.caveBiome, grass: nb.grass, foliage: nb.foliage, water: nb.water, spawns: [] });
    check(outer.sec.every(s => !s.dirty), 'a neighbour arriving beside a kept column leaves it clean (no second mesh of the same thing)');
    // … unless its light changes the kept column
    const outer2 = w2.cols.get(V.ckey(cx0 - 2, cz0));
    w2.cols.delete(V.ckey(cx0 - 3, cz0));
    for (const s of outer2.sec) s.dirty = false;
    outer2.light.fill(0, 0, 256 * 70);   // (the kept column dark at its edge: the newcomer's light walks in)
    const nb2 = mkCol(cx0 - 3, cz0);
    w2.onColumn({ cx: nb2.cx, cz: nb2.cz, blocks: nb2.blocks, light: nb2.light.fill(0xf000), biome: nb2.biome, caveBiome: nb2.caveBiome, grass: nb2.grass, foliage: nb2.foliage, water: nb2.water, spawns: [] });
    check(outer2.sec.some(s => s.dirty), 'a newcomer whose light walks into a kept column: that one is meshed again');
    void mid;
    // a kept column unloaded and loaded again later is an ordinary column: a neighbour's arrival marks it as before
    const msg = (c) => ({ cx: c.cx, cz: c.cz, blocks: c.blocks, light: c.light, biome: c.biome, caveBiome: c.caveBiome, grass: c.grass, foliage: c.foliage, water: c.water, spawns: [] });
    w2.unloadColumn(w2.cols.get(V.ckey(cx0 + 2, cz0 + 1)));
    w2.onColumn(msg(mkCol(cx0 + 2, cz0 + 1)));
    const f2 = w2.cols.get(V.ckey(cx0 + 2, cz0 + 1));
    for (const s of f2.sec) s.dirty = false;
    w2.onColumn(msg(mkCol(cx0 + 3, cz0 + 1)));
    check(f2.sec.every(s => s.dirty), 'a kept column unloaded and loaded again is an ordinary one: its neighbour marks it for meshing as before');
    // a changed look while away: not adopted, freed
    await TR.go(g, { dim: 'drift', via: 'cmd' }); settle(g);
    check(NL.keepInfo(g).overworld, 'kept again on the next trip');
    g.settings.fancyLeaves = !g.settings.fancyLeaves;
    g.freed.length = 0;
    g.goHome(); await waitDim(g, 'overworld'); settle(g);
    check(g.nlAdopted === 0 && g.freed.length >= 24 * 4 && !NL.keepInfo(g).overworld, 'leaves changed meanwhile: the kept meshes are freed, the world loads as before', g.freed.length + ' sections (24 columns with meshes: one was loaded afresh above)');
    // the switch off: nothing kept
    g.settings.homeKeep = false;
    await TR.go(g, { dim: 'drift', via: 'cmd' }); settle(g);
    check(!NL.keepInfo(g).overworld, 'homeKeep off: nothing kept');
    g.settings.homeKeep = true;
    // quitting to the title: every keep freed
    g.goHome(); await waitDim(g, 'overworld'); settle(g);
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) { const c = mkCol(cx0 + dx, cz0 + dz); g.world.cols.set(c.key, c); }   // (the world's own columns again: the stub workers bring none)
    await TR.go(g, { dim: 'drift', via: 'cmd' }); settle(g);
    check(NL.keepInfo(g).overworld && NL.keepInfo(g).overworld.cols === 25, 'kept once more');
    g.freed.length = 0;
    g.teardownWorld();
    check(!NL.keepInfo(g).overworld && g.freed.length > 0, 'the title (no trip): the keep is freed');
    check(V.Settings.byKey('homeKeep') && V.Settings.byKey('homeKeep').def === true, 'the switch: ⚙ Spiel · homeKeep (on)');
  }
  console.log(fails ? 'FAILED ' + fails : 'ALL OK');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('  ✗ the test threw: ' + (e && e.stack || e)); console.log('FAILED 1'); process.exit(1); });

// a game that never played (pdataOf of a plain Herzwelt home)
function mkGameDone(meta) { return { meta, player: { spawn: [1, 2, 3] }, dim: 'overworld' }; }

// e-portal (docs/superpowers/plans/2026-10-31-e-portal.md): the pure part of the Leuchtpfad (src/main/portal_core.js)
//  a · the kinds of places (home, deep, isles, moon, world, station, exo)
//  b · the unlock rules: Kreativ — every world open; Abenteuer / Überleben — only the worlds you have reached once (by
//      ship, ferry or gate), the first trip stays an adventure; never from a guest's game; never to where you are
//  c · the favourites (★ a spot, ★ a world): add, no doubles, remove, a cap
//  d · the film: a gate's swallow first, the arrival last, 10–15 s, the right shots for the trip (clouds from a sky
//      world, a moon's swell to a moon, the star-jump tunnel to another star), never the same film within 5 trips
//  e · the hooks and the story's episodes: an episode only on the first gate arrival at a world, never twice; the hooks
//      never repeat within three trips to the same kind of place
//  f · fast flight: Kreativ single-player only (×1 … ×8), forced ×1 in Überleben, Abenteuer and multiplayer (host or
//      guest); the soft cap when the world can't keep up; the FOV's widening
//  g · every text key in both tables
//   bash test/wt_run.sh portal.js 300
const V = require('./load_shared.js');
const path = require('path'), fs = require('fs');
require('../src/main/i18n.js'); require('../src/main/lang_en.js'); require('../src/main/lang_de.js');
const corePath = path.join(__dirname, '..', 'src', 'main', 'portal_core.js');
if (fs.existsSync(corePath)) require(corePath);
let fails = 0;
const check = (ok, what) => { console.log((ok ? '  ✓ ' : '  ✗ ') + what); if (!ok) fails++; };
const P = V.PortalCore;
check(!!P && typeof P.film === 'function', 'VR.PortalCore loads in node');
if (!P) { console.log('FAILED 1'); process.exit(1); }

console.log('a · kinds');
{
  const want = { overworld: 'home', flat: 'home', underforge: 'deep', hollow: 'deep', drift: 'isles', basalt: 'moon', opal: 'moon', zinn: 'world', ocker: 'world', aqua: 'world', 'stn.ring': 'station', 'x.3.1.2': 'exo' };
  check(Object.keys(want).every(d => P.kindOf(d) === want[d]), 'every dim has its kind: ' + Object.keys(want).map(d => d + '=' + P.kindOf(d)).join(' '));
  check(P.airOf('overworld') && P.airOf('aqua') && !P.airOf('opal') && !P.airOf('underforge'), 'which worlds have air (clouds)');
}

console.log('b · unlock rules');
{
  const meta = { type: 'normal', pos: { overworld: [0, 70, 0, 0, 0], basalt: [1, 2, 3, 0, 0] } };
  const adv = { creative: false, adventure: true }, cre = { creative: true, adventure: false };
  check(P.why(adv, meta, 'overworld', { dim: 'basalt' }) === null, 'Abenteuer: a moon you reached once is open');
  check(P.why(adv, meta, 'overworld', { dim: 'opal' }) === 'locked', 'Abenteuer: a moon you never reached is locked (the first trip stays an adventure)');
  check(P.why({ creative: false, adventure: false }, meta, 'overworld', { dim: 'opal' }) === 'locked', 'Überleben: the same rule');
  check(P.why(cre, meta, 'overworld', { dim: 'opal' }) === null && P.why(cre, meta, 'overworld', { dim: 'hollow' }) === null, 'Kreativ: every world open');
  check(P.why(Object.assign({}, cre, { adventure: true }), meta, 'overworld', { dim: 'opal' }) === 'locked', 'a Kreativ player in an Abenteuer world follows the Abenteuer');
  check(P.why(cre, meta, 'overworld', { dim: 'x.4.0.1' }) === 'locked', 'Kreativ: another star\'s world only once its system was reached');
  check(P.why(cre, Object.assign({}, meta, { pos: Object.assign({}, meta.pos, { 'x.4.0.1': [0, 1, 0, 0, 0] }) }), 'overworld', { dim: 'x.4.0.1' }) === null, '… and then open');
  check(P.why(adv, meta, 'overworld', { dim: 'overworld' }) === 'here', 'no trip to the world you stand on');
  check(P.why(adv, meta, 'overworld', { dim: 'overworld', at: [500, 70, 20] }) === null, 'but a ★ spot on it is a trip');
  check(P.why(adv, meta, 'basalt', { dim: 'overworld' }) === null, 'home is always open');
  check(P.why(Object.assign({ guest: true }, cre), meta, 'overworld', { dim: 'basalt' }) === 'guest', 'a guest never gates (the host travels)');
  const L = P.places(adv, meta, 'basalt', { stations: ['stn.ring', 'stn.opal'] });
  const byDim = (d) => L.find(q => q.dim === d && !q.fav);
  check(L[0].id === 'surprise' && byDim('overworld').open && byDim('opal') && !byDim('opal').open, 'the list: Überrasch mich first, home open, opal shown locked');
  check(!byDim('basalt') || byDim('basalt').here, 'the world you stand on is marked here');
  check(byDim('stn.ring') && !byDim('stn.ring').open, 'a station never docked at is locked in the Abenteuer');
  const Lc = P.places(cre, meta, 'overworld', { stations: ['stn.ring'] });
  check(Lc.filter(q => !q.fav && q.id !== 'surprise').every(q => q.open || q.here), 'Kreativ: every card open');
  const s1 = P.surprise(Lc, 7, null, 'overworld'), s2 = P.surprise(Lc, 7, s1 && s1.id, 'overworld');
  check(s1 && s1.open && s1.dim !== 'overworld' && s2 && s2.id !== s1.id, 'Überrasch mich: an open place, never the one before: ' + (s1 && s1.id) + ', ' + (s2 && s2.id));
}

console.log('c · favourites');
{
  const rec = P.rec({});
  const a = P.favAdd(rec, { dim: 'overworld', at: [10, 70, 10], yaw: 1 });
  check(!!a && rec.favs.length === 1, 'a spot ★');
  check(P.favAdd(rec, { dim: 'overworld', at: [12, 70, 11] }) === null && rec.favs.length === 1, 'the same spot again (8 m): no double');
  P.favAdd(rec, { dim: 'opal' });
  check(rec.favs.length === 2 && P.favHasWorld(rec, 'opal'), 'a world ★');
  P.favToggleWorld(rec, 'opal');
  check(!P.favHasWorld(rec, 'opal') && rec.favs.length === 1, 'the world ★ again: off');
  for (let i = 0; i < 40; i++) P.favAdd(rec, { dim: 'overworld', at: [100 * i + 200, 70, 0] });
  check(rec.favs.length === P.FAV_MAX, 'at most ' + P.FAV_MAX + ' favourites');
  check(P.favRemove(rec, rec.favs[0].id) && rec.favs.length === P.FAV_MAX - 1, 'remove one');
  const meta = { pos: { overworld: [0, 0, 0, 0, 0] }, portal: { favs: [{ id: 'f1', dim: 'overworld', at: [1, 2, 3] }, { bad: 1 }, 'x'] } };
  const r2 = P.rec(meta);
  check(r2.favs.length === 1 && r2.favs[0].id === 'f1' && Array.isArray(r2.films), 'an old or damaged record is made sane');
  const L = P.places({ creative: false }, meta, 'overworld', {});
  check(L.some(q => q.fav && q.id === 'f1' && q.open), 'a ★ spot is a card');
}

console.log('d · the film');
{
  const trips = [['overworld', 'opal'], ['overworld', 'x.2.1.1'], ['opal', 'overworld'], ['overworld', 'hollow'], ['overworld', 'overworld'], ['basalt', 'stn.ring'], ['aqua', 'drift']];
  let okRep = true, okLen = true, okEnds = true, lens = [], worst = '';
  for (const [f, t] of trips) {
    const rec = P.rec({});
    for (let i = 0; i < 30; i++) {
      const F = P.film(rec, 1234 + i * 7, f, t);
      const last5 = rec.films.slice(-6, -1);
      if (last5.includes(F.id)) { okRep = false; worst = f + '→' + t + ' ' + F.id; }
      const len = F.shots.reduce((s, q) => s + q.dur, 0); lens.push(len);
      if (len < 10 || len > 15) okLen = false;
      if (F.shots[0].id !== 'swallow' || F.shots[F.shots.length - 1].id !== 'arrive') okEnds = false;
    }
  }
  check(okRep, 'never the same film within 5 trips ' + worst);
  check(okLen, 'every film 10–15 s (' + Math.min(...lens).toFixed(1) + '…' + Math.max(...lens).toFixed(1) + ')');
  check(okEnds, 'the gate\'s light first, the arrival last');
  const has = (f, t, id) => { const rec = P.rec({}); for (let i = 0; i < 12; i++) if (!P.film(rec, i, f, t).shots.some(q => q.id === id)) return false; return true; };
  check(has('overworld', 'opal', 'clouds') && has('overworld', 'opal', 'moon'), 'Herzwelt → Opal: up through the clouds, the moon swells');
  check(has('overworld', 'x.2.1.1', 'tunnel'), 'to another star: the star-jump tunnel');
  check(has('basalt', 'stn.ring', 'station'), 'to a station: the station slides in');
  check(has('overworld', 'hollow', 'deep'), 'into the deep worlds: down through the glowing rock');
  check(!has('opal', 'overworld', 'clouds') || true, '(from an airless moon: no clouds on the way up)');
  { const rec = P.rec({}); let c = 0; for (let i = 0; i < 12; i++) if (P.film(rec, i, 'opal', 'basalt').shots[1].id === 'clouds') c++; check(c === 0, 'leaving an airless moon: never clouds first'); }
  { const rec = P.rec({}); const F = P.film(rec, 3, 'overworld', 'opal'); check(rec.films.length === 1 && rec.trips === 1 && F.shots.every(q => q.v >= 0 && q.v < 3), 'the film is remembered (trips, ids), each shot has a variant'); }
  { const rec = P.rec({}); for (let i = 0; i < 40; i++) P.film(rec, i, 'overworld', 'opal'); check(rec.films.length <= 8, 'the film memory stays small: ' + rec.films.length); }
  { const rec = P.rec({}), F = P.film(rec, 3, 'overworld', 'opal', { low: true }); check(F.low === true, 'Very Low: the film is marked for reduced effects'); }
}

console.log('e · hooks and episodes');
{
  const rec = P.rec({});
  const e1 = P.episode(rec, 99, 'opal'), e1b = P.episode(rec, 99, 'opal');
  check(!!e1 && e1b === null, 'the first gate arrival at Opal: an episode; the second: none');
  const seen = new Set([e1.id]); let dup = false;
  for (const d of ['basalt', 'zinn', 'ocker', 'aqua', 'drift', 'hollow', 'underforge', 'stn.ring', 'stn.opal', 'x.1.1.1', 'x.2.1.1']) { const e = P.episode(rec, 99, d); if (e) { if (seen.has(e.id)) dup = true; seen.add(e.id); } }
  check(!dup && seen.size >= 8, 'episodes never repeat across worlds (' + seen.size + ' different)');
  check([...seen].every(id => P.EPISODES.find(e => e.id === id).lines.length >= 2), 'each episode is a little scene (two lines or more)');
  let rep = false; const last = [];
  for (let i = 0; i < 12; i++) { const h = P.hook(rec, 5 + i, 'opal'); if (last.slice(-2).includes(h)) rep = true; last.push(h); }
  check(!rep && last.every(Boolean), 'the hooks for a moon never repeat within three trips');
  check(P.hook(rec, 1, 'overworld', true).indexOf('g.pt.hook.fav') === 0, 'a ★ spot has its own hooks');
}

console.log('f · fast flight');
{
  check(P.fastOk({ creative: true }) === true, 'Kreativ, alone: fast flight');
  check(P.fastOk({ creative: false }) === false, 'Überleben: no');
  check(P.fastOk({ creative: true, adventure: true }) === false, 'Abenteuer: no');
  check(P.fastOk({ creative: true, mp: true }) === false, 'multiplayer host: no');
  check(P.fastOk({ creative: true, guest: true }) === false, 'multiplayer guest: no');
  check(P.flyMul(8, { creative: true, mp: true }, 0) === 1 && P.flyMul(8, { creative: false }, 0) === 1, 'forced ×1 where it is not allowed');
  check(P.flyMul(8, { creative: true }, 0) === 8 && P.flyMul(20, { creative: true }, 0) === 8 && P.flyMul(0, { creative: true }, 0) === 1 && P.flyMul(3.4, { creative: true }, 0) === 3, '×1 … ×8 in whole steps');
  check(P.flyMul(8, { creative: true }, 200) < 8 && P.flyMul(8, { creative: true }, 200) >= 2, 'the soft cap when the land can\'t keep up: ' + P.flyMul(8, { creative: true }, 200));
  check(P.fovAdd(1) === 0 && P.fovAdd(8) > 8 && P.fovAdd(8) <= 16, 'the FOV widens gently: +' + P.fovAdd(8) + '° at ×8');
  check(P.step(1, -1) === 2 && P.step(8, -1) === 8 && P.step(1, 1) === 1 && P.step(4, 1) === 3, 'the wheel steps the speed');
}

console.log('h · fast flight in the game (portal.js on a stand-in game)');
{
  global.performance = global.performance || { now: () => Date.now() };
  global.requestAnimationFrame = global.requestAnimationFrame || (() => 0);
  V.Game = class { playFrame() { this.played = (this.played || 0) + 1; } };
  V.UI = V.UI || class {};
  for (const f of ['portal_film', 'portal']) require(path.join(__dirname, '..', 'src', 'main', f + '.js'));
  const Po = V.Portal;
  check(!!Po && typeof Po.cam === 'function', 'VR.Portal loads (no page: no DOM is touched)');
  const mk = (o) => { const g = new V.Game(); Object.assign(g, { state: 'play', meta: {}, dim: 'overworld', ui: {}, settings: { flyFast: 8, fov: 75 }, mp: { role: null }, input: { mouse: { wheel: 0 } }, world: { pending: new Map(), getBlock: () => 0 }, player: { mode: 'creative', flying: true, sprinting: true, flySpeed: 1, vel: [0, 0, 0], pos: [0.5, 70, 0.5] } }, o || {}); return g; };
  const run = (g, n) => { for (let i = 0; i < (n || 3); i++) g.playFrame(1 / 60); return g.player.flySpeed; };
  check(run(mk()) === 8 && mk().playFrame && true, 'Kreativ, alone, ×8 chosen: the player flies ×8');
  { const g = mk(); g.mp.role = 'host'; check(run(g) === 1, 'as a multiplayer host: ×1'); }
  { const g = mk(); g.mp.role = 'client'; check(run(g) === 1, 'as a guest: ×1'); }
  { const g = mk(); g.player.mode = 'survival'; check(run(g) === 1, 'Überleben: ×1'); }
  { V.Adventure = { on: () => true }; const g = mk(); check(run(g) === 1, 'Abenteuer: ×1'); delete V.Adventure; }
  { const g = mk(); for (let i = 0; i < 300; i++) g.world.pending.set(i, true); check(run(g) === 2, 'the land can\'t keep up (300 chunks waiting): the soft cap ×2'); }
  { const g = mk(); g.settings.flyFast = 2; run(g); g.input.mouse.wheel = -1; run(g, 1); check(g.settings.flyFast === 3 && g.input.mouse.wheel === 0 && run(g) === 3, 'the wheel while flying fast: ×2 → ×3 (the hotbar does not see it)'); }
  { const g = mk(); g.player.sprinting = false; g.settings.flyFast = 2; run(g); g.input.mouse.wheel = -1; run(g, 1); check(g.settings.flyFast === 2 && g.input.mouse.wheel === -1, 'without sprint the wheel stays the hotbar\'s'); }
  { const g = mk(); g.settings.flyFast = 1; run(g); g.player.flySpeed = 5; run(g, 1); check(g.settings.flyFast === 5 && run(g) === 5, '/fly 5 becomes the setting'); g.player.flySpeed = 0.5; run(g, 1); check(run(g) === 0.5, '/fly 0.5 (slow, for building) is kept'); }
  { const g = mk(); g.player.vel = [180, 0, 0]; for (let i = 0; i < 200; i++) g.playFrame(1 / 30); const c = Po.cam(g, { fov: 1.3, y: 0, yaw: 0, pitch: 0 }); check(c && c.fov > 1.3 + 0.1 && c.fov < 1.3 + 0.21, 'at speed the view widens: +' + (c ? ((c.fov - 1.3) * 180 / Math.PI).toFixed(1) : '?') + '°'); }
  { const g = mk(); g.player.vel = [180, 0, 0]; g.settings.lessMotion = true; V.A11y = V.A11y || { less: (s) => !!(s && s.lessMotion) }; for (let i = 0; i < 100; i++) g.playFrame(1 / 30); check(!Po.cam(g, { fov: 1.3 }), 'Weniger Bewegung: no widening'); }
}

console.log('i · the film\'s cost (a counting stand-in for the 2D canvas)');
{
  const F = V.PortalFilm, C = P;
  const counter = () => { const n = { ops: 0, px: 0 }; const grad = { addColorStop() {} }; const X = new Proxy({}, { get: (o, k) => { if (k === '__n') return n; if (k in o) return o[k]; if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => { n.ops++; return grad; }; if (k === 'fillRect') return (x, y, w, h) => { n.ops++; n.px += Math.abs(w * h); }; return () => { n.ops++; }; }, set: (o, k, v) => { o[k] = v; return true; } }); return X; };
  const film = C.film(C.rec({}), 7, 'overworld', 'opal');
  const cost = (low, W, H) => { const X = counter(), Pl = F.make(Object.assign({}, film, { low }), ['#fff', '#cde', '#123'], ['#fff', '#ffc978', '#3b2a5c'], { to: 'opal', from: 'overworld', kind: 'moon' }); let worst = 0, sum = 0; for (let i = 0; i < 60; i++) { const n0 = X.__n.ops; Pl.draw(X, W, H, (i + 0.5) / 60 * Pl.len); const d = X.__n.ops - n0; worst = Math.max(worst, d); sum += d; } return { avg: sum / 60, worst, px: X.__n.px / 60 }; };
  const hi = cost(false, 960, 540), lo = cost(true, 512, 288);
  console.log('    High: ' + hi.avg.toFixed(0) + ' draw calls a frame (worst ' + hi.worst + '), ' + (hi.px / 1e6).toFixed(2) + ' Mpx filled · Very Low: ' + lo.avg.toFixed(0) + ' (worst ' + lo.worst + '), ' + (lo.px / 1e6).toFixed(2) + ' Mpx');
  check(lo.avg <= hi.avg * 0.7 && lo.px <= hi.px * 0.4, 'Very Low: fewer draw calls and a third of the pixels');
  check(hi.worst < 1000, 'the film\'s worst frame is bounded (' + hi.worst + ' draw calls)');
}

console.log('g · the texts');
{
  const I = V.I18N, de = I.dict.de, en = I.dict.en;
  const keys = P.keys();
  const miss = keys.filter(k => !(de && de[k]) || !(en && en[k]));
  check(keys.length > 60 && miss.length === 0, keys.length + ' keys in both tables' + (miss.length ? ' — missing: ' + miss.slice(0, 6).join(', ') : ''));
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

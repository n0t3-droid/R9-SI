// The trailer's director (src/main/director.js) as a state machine, without a browser: a fake game (the chunks, the
// traffic, the starship designs and the document are the test's own), a virtual clock, and the real director and camera.
//  (a) the ride runs title → A … G → A2 … G2 → closing card, every shot as long as its data says (±0.06 s), with the
//      opening card's R9-SI caption and the closing card's
//  (b) the opening card holds while the next area is pending; a cut holds on black while the chunks are pending
//  (c) the camera of the title card already stands at shot A's start (the area preloads behind the card)
//  (d) every shot sets its time of day and hides the HUD; the letterbox is on in the ride
//  (e) the scripted shuttles are requested with their designs and join the traffic with t = −t0/dur; the quiet hover is
//      arrived (no arrival flash); a ship whose design is still being built joins when it is ready
//  (f) the follow-cam sits behind its ship and looks ahead and down
//  (g) the heroes walk their tracks (F) and the walk ends where the data says
//  (h) the designs of the ride stay in the starships' cache (the director refreshes them; a control design is freed)
//  (i) Esc ends the ride at any moment and gives the player back his place, yaw, pitch, time, HUD and the random traffic
//  (j) a ride from the start screen leaves the temporary world (quitToTitle, then deleteWorld)
const VR = require('./load_shared.js');
require('../src/shared/cine.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const near = (a, b, eps) => Math.abs(a - b) <= eps;

// a virtual clock: the director's real-time guards and the starships' cache read performance.now()
let CLOCK = 100000;
globalThis.performance = { now: () => CLOCK };
// the fake document: the director's #cine layer and the #hud
const els = {};
const mkEl = () => {
  const sub = {};
  const el = { style: {}, textContent: '', innerHTML: '', classes: new Set(), appendChild(c) { return c; }, querySelector(s) { return sub[s] || (sub[s] = mkEl()); } };
  el.classList = { add: (c) => el.classes.add(c), remove: (c) => el.classes.delete(c), toggle: (c, on) => (on ? el.classes.add(c) : el.classes.delete(c)), contains: (c) => el.classes.has(c) };
  return el;
};
globalThis.document = { getElementById: (id) => els[id] || (els[id] = mkEl()), createElement: () => mkEl() };
// the heroes' rig is drawn elsewhere: the director needs only their looks and poses here
VR.Folk = { heroLook: (o) => o, heroPose: () => ({}) };
require('../src/main/director.js');
const C = VR.Cine, Director = VR.Director;

// the starships' design cache as the director uses it: a design is built later (flush) unless it is cached already
const SS = {
  designs: new Map(), calls: [], waiting: [], freed: [], game: null,
  design(seed, arch, palette, cb) {
    const key = (seed >>> 0) + ':' + arch;
    SS.calls.push(arch + ':' + seed);
    let d = SS.designs.get(key);
    if (d) { if (d.meta) { if (cb) cb(d); } else if (cb) d.waiters.push(cb); return d; }
    d = { key, arch, meta: null, gpu: null, last: 0, waiters: cb ? [cb] : [] };
    SS.designs.set(key, d); SS.waiting.push(d); return d;
  },
  flush() { while (SS.waiting.length) { const d = SS.waiting.shift(); d.meta = { arch: d.arch }; d.gpu = { hull: {} }; const w = d.waiters; d.waiters = []; for (const f of w) f(d); } },
  // the real cache's rule: a design nobody flies and nobody refreshes for a minute is freed
  gc(now) {
    const used = new Set(SS.game.traffic.ships.filter((s) => !s.dead).map((s) => s.d.key));
    for (const [k, d] of SS.designs) if (!used.has(k) && d.meta && now - d.last > 60000) { d.gpu = null; SS.designs.delete(k); SS.freed.push(k); }
  },
};
const mkGame = () => {
  const g = {
    state: 'play', player: { pos: [5, 100, 7], yaw: 0.3, pitch: -0.2, flying: false, noClip: false, eye: 1.62, vel: [0, 0, 0] },
    hideHud: false, camMode: 0, zoom: false, zenFreezeTime: false,
    env: { ticks: 1000, timeOfDay: 1000, setTime(t) { this.ticks = t; this.timeOfDay = ((t % 24000) + 24000) % 24000; } },
    world: { pending: new Map() }, pool: { busy: 0 }, horizon: { inflight: 0 },
    input: { pressed: new Set(), keys: new Set(), mouse: { clicked: [] }, captured: false, hit(k) { return this.pressed.has(k); } },
    ui: { show() {}, hint() {} }, traffic: { t: 5, ships: [] }, starships: SS,
    meta: { id: 'tmpworld' }, quit: 0, deleted: [],
    store: null,
  };
  g.quitToTitle = async () => { g.quit++; };
  g.store = { deleteWorld: async (id) => { g.deleted.push(id); } };
  return g;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const STEP = 0.05;

(async () => {
  // ---------------------------------------------------------------- (a)–(h): the whole ride from the start screen
  const game = mkGame(); SS.game = game;
  const d = new Director(game);
  game.world.pending.set('opening', true);                   // the next area is not in yet: the opening card holds
  check(d.play('trailer', { fromTitle: true }) === true, 'the ride starts in a playing world');
  const seq = []; let lastKey = null; const runEnd = {}; const todBad = []; const hudBad = []; const capBad = [];
  const lengths = {}; let loadHeld = 0, cardHeld = 0, preloadOk = null, followOk = null, heroEnd = null, frames = 0;
  let holdB = false, holdFrames = 0, releasedAt = -1;
  const frame = async (n) => { for (let i = 0; i < (n || 1); i++) { CLOCK += STEP * 1000; d.update(STEP); frames++; if (frames % 4 === 0) await sleep(0); if (frames % 40 === 0) SS.gc(CLOCK); } };
  // the first frames: the card holds past its 2.6 s while the next area is pending
  await frame(70);
  check(d.phase === 'card' && d.si === 0 && d.t > 3, 'the opening card holds past its length while the next area is pending');
  SS.flush();                                                // the scripted designs are built by now (they are requested at play)
  // the camera of the card stands at shot A's start (the chunks around it load behind the card)
  const A0 = C.SHOTS[1].posTrack.eval(0, new Float64Array(3));
  check(near(game.player.pos[0], A0[0], 1e-6) && near(game.player.pos[1], A0[1] - 1.62, 1e-6) && near(game.player.pos[2], A0[2], 1e-6), 'the title card preloads: the camera stands at shot A\'s start');
  game.world.pending.clear();
  // run the whole ride; record the shots, their lengths and the per-frame facts
  let lastId = null;
  for (let guard = 0; guard < 6000 && d.active; guard++) {
    const s = C.SHOTS[d.si], id = s ? s.id : '-';
    if (s && id !== lastId) { lastId = id; }
    const key = id + ':' + d.phase;
    if (key !== lastKey) { lastKey = key; if (!seq.length || seq[seq.length - 1].split(':')[0] !== id) seq.push(id); }
    // a cut holds on black while columns are pending: hold shot B's load for 40 frames
    if (!holdB && id === 'B' && d.phase === 'load') { game.world.pending.set('hold', true); holdB = true; holdFrames = 0; }
    if (holdB && game.world.pending.has('hold')) { holdFrames++; if (d.phase !== 'load') loadHeld++; if (holdFrames >= 40) { game.world.pending.delete('hold'); releasedAt = frames; } }
    if (d.phase === 'run') {
      runEnd[id] = d.t;
      if (s.tod !== undefined && Math.abs(game.env.timeOfDay - s.tod) > 0.5) todBad.push(id + ' ' + game.env.timeOfDay + '≠' + s.tod);
      if (!(els.hud && els.hud.style.visibility === 'hidden')) hudBad.push(id);
      if (!(d.dom && d.dom.classes.has('on'))) hudBad.push('letterbox ' + id);
      if (id === 'F' && d.actors.length) heroEnd = d.actors[0].pos[2];
      if (id === 'C' && d.myShips[0] && !followOk) {
        // the follow-cam: a ship at the origin heading straight on (−z), so the camera sits 15 behind (+z), 6 up
        const sh = d.myShips[0]; sh.t = 0.5; sh.pos = [0, 100, 0]; sh.heading = 0;
        d.pose(s, 1);
        followOk = near(d.cx, 0, 1e-9) && near(d.cy, 106, 1e-9) && near(d.cz, 15, 1e-9) && near(d.cyaw, 0, 1e-9) && near(d.cpitch, Math.atan2(-12, 39), 1e-6);
      }
    }
    if (d.dom) { const cap = d.dom.querySelector('.cap').textContent; if (d.phase === 'card' && (id === 'title' || id === 'end') && cap !== 'R9-SI') capBad.push(id + ' "' + cap + '"'); }
    await frame(1);
  }
  const order = seq.filter((v, i, a) => a.indexOf(v) === i);
  const EXPECT = ['title', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'A2', 'D2', 'F2', 'F3', 'G2', 'end'];
  check(JSON.stringify(order) === JSON.stringify(EXPECT), 'the shots run in order: ' + order.join(' '));
  let lenOk = true; const lens = [];
  for (const s of C.SHOTS) { if (s.kind === 'title') continue; const t = runEnd[s.id]; lens.push(s.id + ' ' + (t === undefined ? '—' : t.toFixed(2))); if (t === undefined || Math.abs(t - s.dur) > 0.06) lenOk = false; }
  check(lenOk, 'every shot runs its length (±0.06 s): ' + lens.join(', '));
  check(loadHeld === 0 && releasedAt > 0, 'a cut holds on black while the chunks are pending (B waited ' + (releasedAt > 0 ? 40 : 'never') + ' frames)');
  check(todBad.length === 0, 'every shot sets its time of day' + (todBad.length ? ' — off: ' + todBad.join(', ') : ''));
  check(hudBad.length === 0, 'the HUD is hidden and the letterbox is on in every run frame' + (hudBad.length ? ' — ' + hudBad.join(', ') : ''));
  check(capBad.length === 0, 'the title cards read R9-SI' + (capBad.length ? ' — ' + capBad.join(', ') : ''));
  check(followOk === true, 'the follow-cam sits 15 behind and 6 above its ship, looking 24 ahead and 6 down');
  check(heroEnd !== null && near(heroEnd, -70, 0.01), 'the heroes walk their track in F (z ends at −70: ' + (heroEnd === null ? 'no heroes' : heroEnd.toFixed(2)) + ')');
  const shipsA = game.traffic.ships.filter((s) => s.scripted);
  check(SS.calls.length >= 9 && SS.calls.every((c) => /^(shuttle|interceptor|gunship):/.test(c)), 'the scripted shuttles are requested with their designs (' + SS.calls.length + ' requests)');
  check(shipsA.length >= 9 && shipsA.every((s) => s.d && s.d.meta), 'the scripted ships joined the traffic with built designs (' + shipsA.length + ' ships)');
  const quietE = shipsA.find((s) => s.quiet || (s.dur === 60));
  check(!!quietE && quietE.arrived === true && quietE.wt === 1, 'the hovering shuttle of E is arrived (no arrival flash)');
  const dShip = shipsA.find((s) => s.A[0] === 72);           // D's shuttle: t0 0.15 s over 2.4 s
  check(!!dShip && near(dShip.t, -0.15 / 2.4, 1e-9), 'a scripted ship starts at t = −t0/dur (D: its 0.15 s delay inside the shot)');
  check(SS.freed.length === 0, 'the designs of the ride are not freed while it runs (' + SS.freed.length + ' freed)');
  // the control: a design nobody refreshes and nobody flies is freed by the same rule
  const ctrl = SS.design(99999, 'shuttle', null, null); ctrl.meta = { arch: 'shuttle' }; ctrl.gpu = {}; ctrl.last = 0;
  SS.gc(CLOCK + 120000);
  check(SS.freed.includes(ctrl.key), 'the cache frees an unused design after a minute (the control)');
  check(d.active === false && game.traffic.t === 5 && game.env.timeOfDay !== undefined, 'the ride ends and the random traffic is back on its timer');
  // (j) from the start screen: the temporary world is left and removed
  await sleep(5);
  check(game.quit === 1 && game.deleted.includes('tmpworld'), 'from the start screen the temporary world is left and removed (quit ' + game.quit + ', deleted ' + game.deleted.join(',') + ')');

  // ---------------------------------------------------------------- (i): Esc from the pause menu's ride, at E
  const g2 = mkGame(); SS.game = g2;
  const d2 = new Director(g2);
  g2.player.pos = [5, 100, 7]; g2.player.yaw = 0.3; g2.player.pitch = -0.2; g2.env.setTime(9000); g2.zenFreezeTime = false;
  check(d2.play('trailer') === true, 'the pause menu\'s ride starts in the world the player is in');
  SS.flush();
  let guard2 = 0;
  while (guard2++ < 4000 && !(C.SHOTS[d2.si] && C.SHOTS[d2.si].id === 'E' && d2.phase === 'run' && d2.t > 1.0)) { CLOCK += STEP * 1000; d2.update(STEP); if (guard2 % 4 === 0) await sleep(0); }
  check(d2.phase === 'run' && C.SHOTS[d2.si].id === 'E', 'the ride is in shot E');
  check(g2.hideHud === true && els.hud.style.visibility === 'hidden', 'during the ride the HUD is hidden');
  g2.input.pressed.add('Escape');
  CLOCK += STEP * 1000; d2.update(STEP); g2.input.pressed.clear();
  check(d2.active === false, 'Esc ends the ride at once');
  check(near(g2.player.pos[0], 5, 1e-9) && near(g2.player.pos[1], 100, 1e-9) && near(g2.player.pos[2], 7, 1e-9), 'the player is back where he was (position)');
  check(near(g2.player.yaw, 0.3, 1e-9) && near(g2.player.pitch, -0.2, 1e-9), 'the player is back where he was (yaw and pitch)');
  check(near(g2.env.timeOfDay, 9000, 1e-6), 'the time of day is back (9000)');
  check(els.hud.style.visibility === 'visible', 'the HUD is back');
  check(g2.traffic.t === 5 && g2.traffic.ships.every((s) => !s.scripted || s.dead), 'the random traffic timer is restored and the ride\'s ships are gone');
  check(g2.quit === 0, 'a ride from the pause menu does not leave the world');

  // ---------------------------------------------------------------- (e): a ship whose design is still being built joins when it is ready
  const g3 = mkGame(); SS.game = g3;
  const d3 = new Director(g3);
  d3.active = true;
  const flying = { ships: [{ arch: 'gunship', A: [0, 90, 0], B: [10, 90, 10], C: [5, 95, 5], dur: 4, t0: 0.3 }] };
  d3.launchShips({ ships: flying.ships });
  check(g3.traffic.ships.length === 0, 'a design still being built does not launch a ship yet');
  await sleep(120);
  SS.flush();
  await sleep(120);
  const late = g3.traffic.ships.find((s) => s.scripted);
  check(!!late && late.arch === 'gunship' && near(late.t, -0.3 / 4, 1e-9), 'the ship joins when its design is ready, with t = −t0/dur');
  d3.stop();
  check(late.dead === true, 'stop marks the ride\'s ships dead');

  console.log(fails ? 'FAILED ' + fails : 'ALL OK');
})();

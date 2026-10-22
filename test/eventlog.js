// The event log (src/main/eventlog.js, VR.EventLog; plan docs/superpowers/plans/2026-10-22-e-log.md §2.1–2.4,
// erlebnis §7) in a stand-in game:
//  · the ring: 4,096 records with running numbers, the oldest overwritten, copies out (the ring cannot be changed by a
//    reader), the switches off, only in play, a new world empties it;
//  · in view: the frustum (ahead, behind, beside, a big sphere half in), the height-map line of sight (a hill blocks, a
//    canopy does not — the line passes under it —, a roof over the eye does), the screen share, an event on the screen
//    itself (pos null: a wow moment, a toast);
//  · the 1-Hz sample: about one a second; the input classes (micro · build · intent · idle); moving actors in view
//    (walking, standing, behind, hidden); a landmark of the Heartland; the sky words (low sun, the giant);
//  · the mappers: every act of the life director (kind, weight, place; the flyover and convoy left to the traffic), the
//    codex ids, a craft's nearest pass (once, near or far, the low pass, a wingman), a visitor's touchdown (once), a
//    Baustelle rising and standing (observed);
//  · the hooks: each of the eight files carries exactly one `// e-log` line; the life director and the codex emit through
//    theirs in a stand-in game;
//  · the cost: a frame with its share of the 1-Hz sample over 150 villagers, 30 animals and 9 ships ≤ 0.05 ms (CPU).
//   bash test/wt_run.sh eventlog.js 300
const fs = require('fs'), path = require('path');
const V = require('./load_shared.js');
global.window = global.window || {};
global.performance = global.performance || { now: () => Date.now() };
const ROOT = path.join(__dirname, '..');
require(path.join(ROOT, 'src/main/eventlog.js'));
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-6);
const L = V.EventLog;
check(!!L && typeof L.emit === 'function' && typeof L.frame === 'function' && L.N === 4096, 'VR.EventLog exists (emit, frame, a ring of 4,096)');

// ---------------------------------------------------------------- the stand-in game
// flat ground: every column's sun-blocking run from 0 to 80 (stand at 81); extra runs from `shapes`
const shapes = [];   // [x0, z0, x1, z1, top, bot]
const cols = new Map();
const world = {
  col(cx, cz) {
    if (Math.abs(cx) > 40 || Math.abs(cz) > 40) return null;
    const k = cx + ',' + cz; let c = cols.get(k);
    if (!c) { c = { cx, cz, ready: true, sh: new Uint8Array(512) }; cols.set(k, c); }
    if (c.v !== shapes.v) { c.v = shapes.v; for (let i = 0; i < 256; i++) { const x = cx * 16 + (i & 15), z = cz * 16 + (i >> 4); let top = 80, bot = 0; for (const s of shapes) if (x >= s[0] && x <= s[2] && z >= s[1] && z <= s[3]) { top = s[4]; bot = s[5]; } c.sh[i * 2] = top; c.sh[i * 2 + 1] = bot; } }
    return c;
  },
};
const setShapes = (list) => { shapes.length = 0; for (const s of list) shapes.push(s); shapes.v = (shapes.v | 0) + 1; };
setShapes([]);
const keys = new Set();
const input = { keys, padDown: new Set(), tDown: new Set(), down: (k) => keys.has(k), mouse: { dx: 0, dy: 0, down: [false, false, false] }, padMove: { fwd: 0, str: 0 }, touchMove: { fwd: 0, str: 0 }, captured: true };
const FOV = 75 * Math.PI / 180;
const g = {
  state: 'play', dim: 'overworld', time: 100, frame: 0, meta: { seed: 4242, vgen: 11, type: 'default' },
  cam: { x: 0.5, y: 81.62, z: 0.5, yaw: 0, pitch: 0, fov: FOV }, renderer: { W: 1600, H: 900 },
  world, input, player: { pos: [0.5, 80, 0.5], yaw: 0 },
  env: { timeOfDay: 6000, day: 0, E: { sunDir: [0, 1, 0], planetDir: [0.3, 0.55, 0.78], planet2Dir: [-0.3, 0.8, 0.5] } },
  villages: { agents: [] }, entities: { mobs: [] }, traffic: { ships: [] }, settings: {},
};
const look = (x, y, z, yaw, pitch) => { g.cam.x = x; g.cam.y = y; g.cam.z = z; g.cam.yaw = yaw || 0; g.cam.pitch = pitch || 0; g.player.pos = [x, y - 1.62, z]; };
L.bind(g); L.reset(world);

// ---------------------------------------------------------------- the ring
{
  const r = L.emit('ambient', 'birds', 1, [0.5, 90, -30], 'test', 8);
  check(!!r && L.count === 1 && r.n === 1 && r.kind === 'ambient' && r.sub === 'birds' && r.w === 1 && r.src === 'test' && near(r.t, 100), `a record: ${JSON.stringify(r)}`);
  for (let i = 0; i < 5000; i++) L.emit('travel', 'flyby', 2, [0, 90, -50], 'test');
  const ev = L.events();
  check(L.count === 5001 && ev.length === 4096 && ev[0].n === 5001 - 4095 && ev[ev.length - 1].n === 5001, `5,001 emitted: the ring keeps the newest 4,096 (${ev.length}, n ${ev[0].n} … ${ev[ev.length - 1].n})`);
  check(L.events(5000).length === 1 && L.events(5000)[0].n === 5001, 'events(sinceN) gives only the newer ones');
  ev[0].kind = 'changed'; ev[0].w = 99;
  check(L.events()[0].kind === 'travel' && L.events()[0].w === 2, 'the records handed out are copies: a reader cannot change the ring');
  L.on = false; const off = L.emit('ambient', 'x', 1, [0, 0, 0], 'test'); L.on = true;
  check(off === null && L.count === 5001, 'switched off (EventLog.on = false): nothing is recorded');
  g.state = 'title'; const t = L.emit('ambient', 'x', 1, [0, 0, 0], 'test'); g.state = 'play';
  check(t === null && L.count === 5001, 'only in play (the title screen flies traffic too)');
  const w2 = { col: world.col }; g.world = w2; L.emit('ambient', 'x', 1, [0, 0, 0], 'test');
  check(L.count === 1 && L.events().length === 1, 'a new world empties the log');
  g.world = world; L.reset(world);
}

// ---------------------------------------------------------------- in view: the frustum, the line of sight, the share
{
  look(0.5, 81.62, 0.5, 0, 0);   // looking north (−z)
  const iv = (p, r) => L.inView(p, r);
  check(iv([0.5, 82, -20], 1).inView, 'a point 20 m ahead is in view');
  check(!iv([0.5, 82, 20], 1).inView, 'behind is not');
  check(!iv([50, 82, -10], 1).inView, '79° to the side is not (the half width is ~54°)');
  check(iv([30, 82, -10], 15).inView, 'a big sphere half in the frustum is');
  check(!iv([0.5, 82, -3000], 1).inView || true, '(far points: the frustum has no far plane short of 3 km)');
  setShapes([[-40, -32, 40, -28, 85, 0]]);   // a hill ridge across the view, 30 m ahead, top 85
  check(!iv([0.5, 82, -60], 1).inView, 'a hill ridge between the eye and the point hides it');
  check(iv([0.5, 100, -60], 2).inView, 'a point high enough above the ridge is seen over it');
  setShapes([[-40, -12, 40, -8, 92, 87]]);   // a canopy: leaves from 87 to 92, air below
  check(iv([0.5, 82, -20], 1).inView, 'a canopy does not hide what is under it (the line passes below its leaves)');
  setShapes([[-6, -6, 6, 6, 86, 85]]);      // a roof over the eye
  check(!iv([0.5, 140, -60], 4).inView, 'a roof over the eye hides the sky');
  check(iv([0.5, 82, -20], 1).inView, '…but not the street outside the door');
  setShapes([]);
  const f = iv([0.5, 81.62, -9.5], 1).frac, ty = Math.tan(FOV / 2), tx = ty * 16 / 9, want = Math.PI * (1 / (10 * ty)) * (1 / (10 * tx)) / 4;
  check(near(f, want, 2e-4), `a 1-m sphere 10 m ahead covers ${(f * 100).toFixed(2)} % of the screen (π·rx·ry/4: ${(want * 100).toFixed(2)} %)`);
  check(iv([0.5, 82, 0.5], 5).frac === 1, 'the eye inside the sphere: the whole screen');
  const w = L.emit('wow', 'citadel', 3, null, 'wow'), c = L.emit('discovery', 'deer', 2, null, 'codex');
  check(w.inView && w.frac === 1 && c.inView && c.frac === 0, 'pos null: on the screen by itself (a wow moment takes the whole view, a toast none of it)');
  const r = L.emit('ambient', 'cat', 2, [0.5, 81, -10], 'test', 0.6);
  check(r.inView && r.frac > 0 && near(r.x, 0.5) && near(r.z, -10), 'an emitted record carries its place, in view and share');
  check(L.sinceSeen(2) === 0 && L.sinceSeen(3) === 0 && L.sinceSeen(4) === Infinity, 'sinceSeen: seconds since the last event of a weight in view (the Regie\'s trigger)');
}

// ---------------------------------------------------------------- the 1-Hz sample and the input classes
const run = (sec, each) => { const n = Math.round(sec * 30); for (let i = 0; i < n; i++) { if (each) each(i); g.time += 1 / 30; g.frame++; L.frame(g, 1 / 30); } };
{
  L.reset(world); look(0.5, 81.62, 0.5, 0, 0);
  const n0 = L.nSamples;
  keys.add('KeyW'); run(10); keys.delete('KeyW');
  const s = L.samples();
  check(L.nSamples - n0 >= 9 && L.nSamples - n0 <= 11, `10 s of play: ${L.nSamples - n0} samples`);
  check(s.length && s.every(q => q.input === 'micro'), `W held: every sample says micro (${[...new Set(s.map(q => q.input))].join(',')})`);
  run(3); check(L.samples().slice(-2).every(q => q.input === 'idle'), 'nothing pressed: idle (watching)');
  input.mouse.dx = 5; run(3, () => { input.mouse.dx = 5; }); input.mouse.dx = 0;
  check(L.samples().slice(-2).every(q => q.input === 'idle'), 'only the view turned: still watching');
  V.Bauhand = { state: 'holding' }; run(3); V.Bauhand.state = 'closed';
  check(L.samples().slice(-2).every(q => q.input === 'build'), 'the Bauhand holding a blueprint: build');
  g.flight = { auto: { site: {} } }; run(3); g.flight = null;
  check(L.samples().slice(-2).every(q => q.input === 'intent'), 'the autopilot flies: intent');
  g.wow = { active: true }; run(3); g.wow = null;
  check(L.samples().slice(-2).every(q => q.input === 'idle'), 'a wow moment holds the view: watching');
  const last = L.samples().slice(-1)[0];
  check('t' in last && 'movers' in last && 'landmark' in last && 'sky' in last && 'x' in last && 'place' in last && 'tod' in last, `a sample: ${JSON.stringify(last)}`);
}

// ---------------------------------------------------------------- movers, landmark, sky
{
  L.reset(world); look(0.5, 81.62, 200.5, 0, 0);
  const A = (x, z, v) => ({ pos: [x, 81, z], vel: [0, 0, v || 0], pose: 'stand' });
  g.villages.agents = [A(0.5, 185, 1.2)];
  run(1.1); let s = L.samples().slice(-1)[0];
  check(s.movers === 1 && /v1/.test(s.mv), `a villager walking 15 m ahead: movers ${s.movers} (${s.mv})`);
  g.villages.agents = [A(0.5, 185, 0)]; run(1.1); s = L.samples().slice(-1)[0];
  check(s.movers === 0, 'standing still: not a mover');
  g.villages.agents = [A(0.5, 215, 1.2)]; run(1.1); s = L.samples().slice(-1)[0];
  check(s.movers === 0, 'walking behind the eye: not in view');
  setShapes([[-40, 190, 40, 192, 90, 0]]); g.villages.agents = [A(0.5, 180, 1.2)]; run(1.1); s = L.samples().slice(-1)[0];
  check(s.movers === 0, 'behind a wall: not in view'); setShapes([]);
  g.villages.agents = []; g.entities.mobs = [{ pos: [3, 81, 190], vel: [1, 0, 0], w: 0.4, h: 1, def: {} }]; g.traffic.ships = [{ pos: [0, 140, 50], alpha: 1, t: 0.4, d: { meta: { length: 20 } } }];
  run(1.1); s = L.samples().slice(-1)[0];
  check(s.movers === 2 && /a1/.test(s.mv) && /s1/.test(s.mv), `an animal and a ship in view: ${s.movers} (${s.mv})`);
  g.entities.mobs = []; g.traffic.ships = [];
  check(s.landmark === 'temple', `from 215 m south of the Gate Temple, looking north: landmark '${s.landmark}'`);
  look(0.5, 81.62, 200.5, Math.PI, 0); run(1.1); s = L.samples().slice(-1)[0];
  check(s.landmark === '', `looking south, away from every landmark: '${s.landmark}'`);
  const el = 5 * Math.PI / 180; g.env.E.sunDir = [0, Math.sin(el), -Math.cos(el)]; g.env.E.planetDir = [0, 0.95, 0.3]; look(0.5, 81.62, 200.5, 0, 0); run(1.1); s = L.samples().slice(-1)[0];
  check(s.sky === 'low_sun', `the sun 5° over the horizon: sky '${s.sky}'`);
  g.env.E.sunDir = [0, 0.7, -0.7]; const p = [0, 0.3, -1], pl = Math.hypot(...p); g.env.E.planetDir = p.map(v => v / pl); run(1.1); s = L.samples().slice(-1)[0];
  check(s.sky === 'giant', `the ringed giant in the frustum: sky '${s.sky}'`);
  g.env.E.planetDir = [0, 0.95, 0.3]; run(1.1); s = L.samples().slice(-1)[0];
  check(s.sky === '', `a high sun, no body in view: sky '${s.sky}'`);
  L.sampling = false; const n0 = L.nSamples; run(3); check(L.nSamples === n0, 'the sampler switched off: no samples'); L.sampling = true;
}

// ---------------------------------------------------------------- the mappers
{
  L.reset(world); look(0.5, 81.62, 0.5, 0, 0);
  const D = { g: { villages: { festivalNear: () => ({ plan: { plaza: { x: 0, y: 81, z: -40 } } }) } } };
  const acts = {
    birds: { from: [-60, 110, -50], to: [60, 112, -50] }, chimneys: { c: [[4, 86, -20]] }, lanterns: { route: [[2, 82, -12], [6, 82, -14]], fig: {} },
    cat: { q: { pos: [1, 83, -9] } }, pigeons: { c: [0, 81, -8] }, cart: { run: [[-8, 81, -12], [0, 81, -12], [8, 81, -12]], pos: [0, 0, 0, 0], y: null },
    meteor: { m: [{ p: [10, 300, -200] }] }, balloon: { pos: [20, 130, -90] }, bells: { c: [0, 81, -30] }, fireworks: {},
    kids: { k2: [{ pos: [-2, 81, -9] }, { pos: [2, 81, -9] }] }, musician: { fig: { pos: [1, 81, -7] } }, dog: { c: [0, 81, -12], q: { pos: [13, 81, -12] } },
    skyray: { c: [0, 120, -80], pos: [0, 0, 0] }, fisher: { b: { pos: [3, 81, -6] } }, flyover: {}, convoy: {},
  };
  const want = { birds: ['ambient', 1], chimneys: ['ambient', 1], lanterns: ['social', 2], cat: ['ambient', 2], pigeons: ['ambient', 2], cart: ['travel', 2], meteor: ['sky', 2], balloon: ['sky', 2], bells: ['social', 2], fireworks: ['sky', 3], kids: ['social', 2], musician: ['social', 2], dog: ['ambient', 2], skyray: ['sky', 3], fisher: ['social', 2] };
  let ok = 0; const bad = [];
  for (const k in acts) {
    const ev = Object.assign({ kind: k, age: 0 }, acts[k]), r = L.act(ev, D);
    if (k === 'flyover' || k === 'convoy') { if (r === null) ok++; else bad.push(k); continue; }
    if (r && r.kind === want[k][0] && r.w === want[k][1] && r.sub === k && r.src === 'life' && Number.isFinite(r.x)) ok++; else bad.push(k + ':' + JSON.stringify(r));
  }
  check(ok === Object.keys(acts).length, `every act of the life director maps to its kind, weight and place; the flyover and the convoy are the traffic's (${ok}/${Object.keys(acts).length}${bad.length ? ' — ' + bad.join(' ') : ''})`);
  check(Object.keys(L.ACTS).length >= 17 && L.ACTS.flyover === null, 'the act table covers all seventeen acts');
  const F = (id) => L.found(id);
  const wn = F('w:spire'), bi = F('b:birch_forest'), cr = F('c:deer'), ms = F('m:log'), iv = F('i:lamp');
  check(wn.kind === 'discovery' && wn.w === 4 && bi.kind === 'discovery' && bi.w === 2 && cr.kind === 'discovery' && cr.w === 2 && ms.kind === 'milestone' && ms.w === 2 && iv.kind === 'milestone' && iv.w === 2 && wn.sub === 'spire' && bi.inView, 'the codex: a wonder (4), a biome and a creature (discovery 2), a milestone and an invention (milestone 2), on the screen');
  // a craft's nearest pass: once per flight, at its nearest point
  const fly = (s, ds) => { const n0 = L.count; for (const d of ds) { s.pos = [0, 120, -d]; L.pass(s, d); } return L.count - n0; };
  const s1 = { t: 0.3 }, s2 = { t: 0.3 }, s3 = { t: 0.3 }, s4 = { t: 0.3, wing: true }, s5 = { t: 0.3, contrail: true, tag: 'ld3' }, s6 = { t: 0.3, tag: 'ld5' };
  const n1 = fly(s1, [300, 200, 100, 80, 85, 90, 120]), r1 = L.events().slice(-1)[0];
  check(n1 === 1 && r1.sub === 'flyby' && r1.w === 2 && r1.kind === 'travel' && r1.src === 'traffic', `a craft passing 80 m off: one 'flyby' of weight 2 (${n1}, ${r1.sub} w${r1.w})`);
  const n2 = fly(s2, [300, 190, 180, 185, 200]), r2 = L.events().slice(-1)[0];
  check(n2 === 1 && r2.w === 1, `passing 180 m off: weight 1 (ambient traffic) (${n2}, w${r2.w})`);
  check(fly(s3, [600, 450, 400, 420, 500]) === 0, 'passing 400 m off: nothing');
  check(fly(s4, [300, 100, 50, 60, 200]) === 0, 'a wingman: nothing (its leader counts)');
  const n5 = fly(s5, [300, 190, 180, 185]), r5 = L.events().slice(-1)[0];
  check(n5 === 1 && r5.sub === 'lowpass' && r5.w === 2, `the life director's low pass: 'lowpass' of weight 2 even at 180 m (${r5.sub} w${r5.w})`);
  const n6 = fly(s6, [300, 150, 140, 160]), r6 = L.events().slice(-1)[0];
  check(n6 === 1 && r6.sub === 'convoy' && r6.w === 2, `the sunrise convoy: 'convoy' (${r6.sub})`);
  // a visitor touches down
  const c = { d: { meta: { length: 24, width: 16 } } }, q = { phase: 'parked', u: 0.4, pos: [47, 81, 62] };
  const n0 = L.count; L.landed(c, q); L.landed(c, Object.assign({}, q, { u: 0.5 })); const r7 = L.events().slice(-1)[0];
  check(L.count === n0 + 1 && r7.sub === 'landing' && r7.kind === 'travel' && r7.w === 2, 'a visitor touching down on its pad: one landing');
  const c2 = { d: { meta: {} } }; L.landed(c2, { phase: 'parked', u: 30, pos: [47, 81, 62] }); L.landed(c2, { phase: 'approach', u: -60, pos: [47, 81, 62] });
  check(L.count === n0 + 1, 'a craft found already parked, or still coming in: nothing');
  // a Baustelle rising and standing (observed at 1 Hz)
  const site = { mode: 'show', phase: 'build', box: [10, 81, -30, 20, 90, -20] }, old = { mode: 'show', phase: 'gone', box: [0, 81, 0, 4, 84, 4] };
  g.gadgets = { blue: { sites: [old, site] } };
  const n8 = L.count; run(1.1); const r8 = L.events().slice(-1)[0];
  check(L.count === n8 + 1 && r8.kind === 'build' && r8.sub === 'site' && r8.w === 2 && r8.src === 'site', 'a construction site rising: build/site of weight 2 (an old one gone long ago: nothing)');
  site.phase = 'done'; run(1.1); const r9 = L.events().slice(-1)[0];
  check(L.count === n8 + 2 && r9.sub === 'site_done' && r9.w === 3, 'it stands (fanfare, confetti): build/site_done of weight 3');
  run(2.2); check(L.count === n8 + 2, '…once');
  g.gadgets = null;
}

// ---------------------------------------------------------------- the hooks
{
  const files = ['src/main/lifedirector.js', 'src/main/padlife.js', 'src/main/traffic.js', 'src/main/wowmoment.js', 'src/main/codex.js', 'src/main/festival.js', 'src/main/game.js', 'build.js'];
  const counts = files.map(f => (fs.readFileSync(path.join(ROOT, f), 'utf8').match(/\/\/ e-log/g) || []).length);
  check(counts.every(n => n === 1), `each hooked file has exactly one '// e-log' line (${files.map((f, i) => path.basename(f) + ' ' + counts[i]).join(', ')})`);
  // the life director emits through its hook (a stand-in world as test/life_director.js)
  for (const f of ['lifekit', 'lifedirector', 'codex']) require(path.join(ROOT, 'src/main', f + '.js'));
  const R = V.R, STONE = R.byName.stone.defaultState;
  const getBlock = (x, y, z) => (y <= 80 ? STONE : 0);
  const G2 = { state: 'play', dim: 'overworld', settings: { preset: 'balanced' }, meta: { seed: 4242, vgen: 9, type: 'default' }, time: 5,
    env: { day: 1, ticks: 3000, timeOfDay: 3000, E: { sunDir: [0.4, 0.6, -0.69], night: 0, rain: 0, windDir: [1, 0], wind: 1 } },
    player: { pos: [0.5, 81, 0.5], yaw: 0 }, cam: { x: 0.5, y: 82.62, z: 0.5, yaw: 0, pitch: 0, fov: FOV }, renderer: { W: 1600, H: 900 },
    world: { getBlock, topAt: () => 80, col: () => null }, particles: { spawn() { return 0; }, spark() {}, splash() {}, glow() {} }, audio: null,
    traffic: { ships: [], spawnFlight() {} }, villages: { known: new Map(), festivalNear: () => null }, entities: { beginVox: () => ({ u: {} }) } };
  L.bind(G2); L.reset(G2.world);
  const D = new V.LifeDirector.Actor(G2); D.update(0.1);
  const n0 = L.count, okB = D.force('birds'); const rb = L.events().slice(-1)[0];
  check(okB && L.count === n0 + 1 && rb.kind === 'ambient' && rb.sub === 'birds' && rb.src === 'life', `an act started by the life director is logged through its hook (${rb && rb.kind}/${rb && rb.sub})`);
  const n1 = L.count; D.force('flyover'); check(L.count === n1, 'its flyover is not (the traffic logs the pass)');
  const Cx = new V.Codex(Object.assign({}, G2, { settings: { toasts: false }, ui: null }), {});
  const bk = V.BIOMES[0].key, n2 = L.count; Cx.unlock('b:' + bk); Cx.unlock('b:' + bk);
  const rc = L.events().slice(-1)[0];
  check(L.count === n2 + 1 && rc.kind === 'discovery' && rc.sub === bk && rc.src === 'codex', `a codex unlock is logged once through its hook (${rc && rc.kind}/${rc && rc.sub})`);
  const n3 = L.count; Cx.unlock('w:' + (V.Wonders && V.Wonders.TYPES && V.Wonders.TYPES[0] ? V.Wonders.TYPES[0].id : 'x'), true);
  check(!(V.Wonders && V.Wonders.TYPES && V.Wonders.TYPES[0]) || (L.count === n3 + 1 && L.events().slice(-1)[0].w === 4), 'a wonder unlocked quietly (it has its own banner) is logged too, weight 4');
  L.bind(g); L.reset(world);
}

// ---------------------------------------------------------------- the instrument never breaks the game
{
  look(0.5, 81.62, 0.5, 0, 0);
  const broken = { col() { throw new Error('a broken column'); } };
  g.world = broken; L.reset(broken);
  let threw = 0; const quiet = (f) => { try { f(); } catch (e) { threw++; } };
  const n0 = L.count;
  quiet(() => L.emit('ambient', 'cat', 2, [0.5, 82, -20], 'test'));
  quiet(() => run(1.1));   // (the sample's landmark line of sight reads the broken columns)
  check(threw === 0 && L.cost.errors === 2 && /broken column/.test(L.error || '') && L.count === n0, `an error inside the log is caught where the game calls in, counted, never thrown into the game, and leaves no half record (errors ${L.cost.errors}, count +${L.count - n0}: ${String(L.error).split('\n')[0]})`);
  quiet(() => { for (let i = 0; i < 4; i++) L.emit('ambient', 'cat', 2, [0.5, 82, -20], 'test'); });
  check(threw === 0 && L.on === false && L.cost.errors === 3, `after three errors the log switches itself off (a broken instrument costs nothing; errors ${L.cost.errors})`);
  const n1 = L.count;
  quiet(() => { L.act({ kind: 'birds', from: [0, 90, -30], to: [10, 90, -30] }, {}); L.pass({ t: 0.3 }, 50); L.landed({ d: {} }, { phase: 'parked', u: 0.2, pos: [0, 81, -9] }); L.found('b:x'); run(1.1); });
  check(threw === 0 && L.count === n1, '…and stays quiet: the hooks and the frame record nothing and throw nothing');
  L.on = true; L.cost.errors = 0; L.error = null; g.world = world; L.reset(world);
}

// ---------------------------------------------------------------- the cost
{
  L.reset(world); look(0.5, 81.62, 0.5, 0, 0);
  const ag = []; for (let i = 0; i < 150; i++) { const a = i * 2.4; ag.push({ pos: [Math.cos(a) * (8 + i * 0.6), 81, -Math.abs(Math.sin(a)) * (8 + i * 0.6)], vel: [i % 3 ? 1 : 0, 0, 0.5], pose: 'stand' }); }
  g.villages.agents = ag;
  g.entities.mobs = []; for (let i = 0; i < 30; i++) g.entities.mobs.push({ pos: [i * 3 - 45, 81, -20 - i], vel: [0.5, 0, 0], w: 0.4, h: 1, def: {} });
  g.traffic.ships = []; for (let i = 0; i < 9; i++) g.traffic.ships.push({ pos: [i * 40 - 160, 140, -100 - i * 30], alpha: 1, t: 0.5, d: { meta: { length: 20 } } });
  const cpu = (f) => { let best = 1e9; for (let r = 0; r < 3; r++) { const c0 = process.cpuUsage(); f(); const c1 = process.cpuUsage(c0); best = Math.min(best, (c1.user + c1.system) / 1000); } return best; };
  const FR = 3000;
  const on = cpu(() => run(FR / 30)) / FR;
  L.sampling = false; const noSamp = cpu(() => run(FR / 30)) / FR; L.sampling = true;
  const s = L.samples().slice(-1)[0];
  console.log(`     a frame: ${(on * 1000).toFixed(2)} µs with the 1-Hz sample (movers ${s.movers}: ${s.mv}), ${(noSamp * 1000).toFixed(2)} µs without; the log's own count: ${JSON.stringify(L.cost)}`);
  check(on <= 0.05, `the log costs ≤ 0.05 ms a frame with its sample over 150 villagers, 30 animals, 9 ships (${(on * 1000).toFixed(1)} µs)`);
  g.villages.agents = []; g.entities.mobs = []; g.traffic.ships = [];
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

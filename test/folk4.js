// u-folk4 · villagers who are fun and warm — without a browser (plan docs/superpowers/plans/2026-11-05-u-folk4.md):
//   a · the moment picker (VR.Folk4.pick): hours, needs, cooldowns, the gap, the dance once an evening, rain, variety,
//       the same choice for the same inputs
//   b · the greeting memory (F4.meet / F4.tier / F4.lineKey): counted after a gap, first → again → friend, a bad save
//   c · the beat (no fail), the hair tones, the texts in both tables
//   d · the villages' simulation (Herzwelt's Nova Haven): tag near the player, a picnic on open ground facing each other,
//       an elder feeding the animals, the dusk dance with a fiddler and a slot left open, V joins, greetings remember
// Run: bash test/wt_run.sh folk4.js 300
require('./dom_stub.js');
const V = require('./load_shared.js');
globalThis.VR = V;
for (const f of ['i18n', 'lang_en', 'lang_de']) require(__dirname + '/../src/main/' + f + '.js');
require('../src/shared/smoothvox.js'); require('../src/shared/folksmooth.js');
for (const f of ['voxmodels', 'villagers', 'folkmodel', 'villages', 'folklife', 'festival', 'folkjoy', 'worldlife', 'folk3', 'gossip', 'folk4']) require('../src/main/' + f + '.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const F4 = V.Folk4;
check(!!F4 && typeof F4.pick === 'function', 'VR.Folk4 exists');
if (!F4 || !F4.pick) { console.log('FAILED ' + (fails || 1)); process.exit(1); }

// ---------------------------------------------------------------- a · the picker
console.log('a · the moment picker');
const ctx = (o) => Object.assign({ t: 1000, tod: 4000, rain: 0, kids: 4, adults: 6, elders: 1, animals: 2, seed: 7, place: 3, night: 0 }, o);
{
  const m = F4.newMem();
  const k = F4.pick(ctx(), m);
  check(F4.KINDS.indexOf(k) >= 0 && k !== 'dance', `a day moment is chosen by day (${k})`);
  check(F4.pick(ctx({ tod: 11200 }), F4.newMem()) === 'dance', 'at dusk the dance comes first');
  check(F4.pick(ctx({ tod: 16000 }), F4.newMem()) === null, 'nothing at night');
  check(F4.pick(ctx({ rain: 0.6 }), F4.newMem()) === null, 'nothing in the rain');
  check(F4.pick(ctx({ kids: 0, adults: 0, elders: 0 }), F4.newMem()) === null, 'nothing without people');
  check(F4.pick(ctx({ kids: 0, adults: 2, elders: 0, animals: 0 }), F4.newMem()) === 'picnic', 'two grown-ups only → a picnic');
  check(F4.pick(ctx({ kids: 0, adults: 0, elders: 1, animals: 3 }), F4.newMem()) === 'feed', 'an elder and animals → feeding');
  check(F4.pick(ctx({ kids: 0, adults: 0, elders: 1, animals: 0 }), F4.newMem()) === null, 'no animals → no feeding');
  check(F4.pick(ctx({ tod: 11200, adults: 2, kids: 0, elders: 0 }), F4.newMem()) !== 'dance', 'a dance needs three grown-ups');
  // the gap and the variety
  F4.note(m, k, 1000, ctx());
  check(F4.pick(ctx({ t: 1020 }), m) === null, `≥ ${F4.GAP} s between two moments`);
  const k2 = F4.pick(ctx({ t: 1000 + F4.GAP + 1 }), m);
  check(k2 && k2 !== k, `the next is another kind (${k} → ${k2})`);
  // the cooldown of a kind
  const only = ctx({ kids: 0, adults: 2, elders: 0, animals: 0 }), m2 = F4.newMem();
  F4.note(m2, 'picnic', 0, only);
  check(F4.pick(Object.assign({}, only, { t: F4.GAP + 5 }), m2) === null, 'a kind cools down');
  check(F4.pick(Object.assign({}, only, { t: F4.COOL.picnic + 1 }), m2) === 'picnic', 'and comes again after its cooldown');
  // the dance once an evening per place
  const m3 = F4.newMem(), dz = ctx({ tod: 11200, night: 5 });
  F4.note(m3, 'dance', 0, dz);
  check(F4.pick(Object.assign({}, dz, { t: 900, kids: 0, elders: 0, animals: 0 }), m3) === null, 'one dance an evening in a village');
  check(F4.pick(Object.assign({}, dz, { t: 900, place: 4, kids: 0, elders: 0, animals: 0 }), m3) === 'dance', 'another village may dance');
  check(F4.pick(Object.assign({}, dz, { t: 900, night: 6, kids: 0, elders: 0, animals: 0 }), m3) === 'dance', 'and the next evening again');
  // determinism, and every day kind reachable
  const seen = {};
  for (let s = 0; s < 200; s++) { const a = F4.pick(ctx({ seed: s, place: s * 3 }), F4.newMem()), b = F4.pick(ctx({ seed: s, place: s * 3 }), F4.newMem()); if (a !== b) seen.bad = 1; seen[a] = (seen[a] | 0) + 1; }
  check(!seen.bad, 'the same inputs choose the same');
  check(['tag', 'hide', 'picnic', 'feed'].every(x => seen[x] > 10), `every day moment comes (${JSON.stringify(seen)})`);
}

// ---------------------------------------------------------------- b · the greeting memory
console.log('b · the greeting memory');
{
  const rec = F4.fresh();
  let r = F4.meet(rec, 'o/7', 1000);
  check(r.counted && r.n === 1 && r.tier === 'first', 'the first meeting: first');
  r = F4.meet(rec, 'o/7', 1000 + 200);
  check(!r.counted && r.n === 1, 'within the gap it is the same meeting');
  r = F4.meet(rec, 'o/7', 1000 + F4.MEET_GAP + 1);
  check(r.counted && r.n === 2 && r.tier === 'again', 'the second: again');
  r = F4.meet(rec, 'o/7', 1000 + 2 * F4.MEET_GAP + 2);
  check(r.n === 3 && r.tier === 'friend', 'the third: friend');
  check(F4.meet(rec, 'o/8', 0).tier === 'first', 'each person their own count');
  for (let i = 0; i < F4.MAXP + 40; i++) F4.meet(rec, 'x/' + i, 5000 + i);
  check(Object.keys(rec.meet).length <= F4.MAXP, `≤ ${F4.MAXP} people remembered`);
  const L = F4.load({ v: 1, meet: { 'a/1': [3, 100], 'b/2': 'junk', 'c/3': [-4, 'x'] } });
  check(L.meet['a/1'][0] === 3 && !L.meet['b/2'] && !L.meet['c/3'], 'a bad save is cleaned');
  check(F4.load(null).v === F4.V && F4.load({ v: 99 }).meet, 'an old or missing save starts fresh');
  // the lines
  const keys = new Set();
  for (const tier of ['first', 'again', 'friend']) for (const kid of [false, true]) for (const named of [false, true]) for (let s = 0; s < 40; s++) for (const tod of [1000, 5000, 11000]) keys.add(F4.lineKey(tier, s, tod, kid, named));
  check(keys.size >= 30, `varied lines (${keys.size} keys)`);
  const Dc = V.I18N.dict, miss = [...keys].concat(F4.TEXT_KEYS).filter(k => !(Dc.de && Dc.de[k]) || !(Dc.en && Dc.en[k]));
  check(!miss.length, `every line in both tables (${miss.slice(0, 6).join(', ') || 'all'})`);
  const fr = F4.lineKey('friend', 3, 5000, false, true);
  check(/\{name\}/.test(Dc.de[fr]) && /\{name\}/.test(Dc.en[fr]), 'the friend line says your name');
  const first = F4.lineKey('first', 3, 5000, false, false);
  check(/\{me\}/.test(Dc.de[first]), 'the first meeting: they say their own name');
}

// ---------------------------------------------------------------- c · the beat, the hair
console.log('c · the beat, the hair');
{
  const b = 60 / F4.BPM;
  check(F4.step(10 * b) === 'beat' && F4.step(10 * b + 0.05) === 'beat', 'on the beat: a beat');
  check(F4.step(10.5 * b) === 'step', 'off the beat: still a step (no fail)');
  let n = 0; const tones = new Set();
  for (let s = 0; s < 1000; s++) { const c = F4.hairFor(s * 7919); if (c !== null) { n++; tones.add(c); } }
  check(n > 200 && n < 500 && tones.size === F4.HAIR.length, `a share get the new hair tones (${n} of 1000, ${tones.size} tones)`);
}

// ---------------------------------------------------------------- d · the villages' simulation
console.log('d · Nova Haven');
const VG = V.VillageGen, Vs = V.Villages, R = V.R, Fl = V.F;
function worldOf(gen) {
  const cols = new Map();
  const col = (cx, cz) => { const k = cx * 65536 + cz; let c = cols.get(k); if (!c) { const ch = gen.generate(cx, cz); c = { b: ch.blocks, h: ch.height }; cols.set(k, c); } return c; };
  return {
    getBlock(x, y, z) { if (y < 0 || y > 255) return 0; const c = col(x >> 4, z >> 4); return c.b[(y << 8) | ((z & 15) << 4) | (x & 15)]; },
    isLoaded() { return true; },
    nbFn() { return this._nb || (this._nb = (x, y, z, d) => this.getBlock(x + V.HF_DX[d], y, z + V.HF_DZ[d])); },
    topAt(x, z) { const c = col(x >> 4, z >> 4); if (c.h) return c.h[((z & 15) << 4) | (x & 15)]; for (let y = 200; y > 0; y--) if (this.getBlock(x, y, z)) return y; return 64; },
    setBlock() {}, getLight() { return 0xf000; },
  };
}
{
  let rs = 11; const r0 = Math.random; Math.random = () => { rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0; return rs / 4294967296; };
  const gen = new V.OverworldGen(4242, { worldType: 'default', vgen: 14 });
  const site = VG.site(gen, 0, -1), plan = VG.plan(gen, site), sum = VG.summary(plan), world = worldOf(gen);
  const pz = sum.plaza, C = [pz.x + 0.5, pz.y, pz.z + 0.5];
  const player = { pos: [C[0] + 4.5, pz.y, C[2] + 4.5], vel: [0, 0, 0], onGround: true, flying: false, mode: 'creative', yaw: 0, pitch: 0,
    eyePos() { return [this.pos[0], this.pos[1] + 1.62, this.pos[2]]; }, lookDir() { return [0, 0, -1]; }, inv: { add() { return true; } } };
  const mobs = [];
  const g = { world, player, env: { timeOfDay: 4000, day: 3, rain: 0 }, settings: { preset: 'balanced', toasts: false, playerName: 'Mira' }, meta: {}, entities: { mobs },
    particles: new Proxy({}, { get: () => () => {} }), audio: { play() {}, tone() {} }, ui: { chatLine() {}, toast() {} }, codex: null, pool: { direct() {} }, mp: null, folkBase: 100, state: 'play' };
  V.game = g;
  const mgr = Object.create(Vs.prototype);
  Object.assign(mgr, { g, meta: g.meta, known: new Map(), pending: new Set(), agents: [], sites: [], siteT: 1e9, siteAt: [player.pos[0], player.pos[2]], doors: new Map(), selfEdit: false, pathBudget: 0, time: 0, bubs: [] });
  mgr.meta.villages = mgr.meta.villages || {}; mgr.st = mgr.meta.villages; mgr.updateBubbles = () => {}; mgr.chirp = () => {}; mgr.talkText = () => {};
  mgr.joyTier = () => 2;
  g.villages = mgr;
  mgr.addVillage(sum);
  const dt = 1 / 30, run = (s) => { for (let f = 0; f < s * 30; f++) mgr.update(dt); };
  F4.auto = false;   // (the test starts each moment itself; the clock is checked at the end)
  run(8);
  const vil = mgr.agents[0] && mgr.agents[0].vil;
  check(!!vil, `the village lives (${mgr.agents.length} people)`);
  const sol = (x, y, z) => { const s = world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)); return !!(s && (R.T.flags[s] & Fl.SOLID)); };
  const openAt = (p) => !sol(p[0], p[1] + 0.1, p[2]) && !sol(p[0], p[1] + 1.2, p[2]);
  const dP = (a) => Math.hypot(a.pos[0] - player.pos[0], a.pos[2] - player.pos[2]);
  if (vil) {
    // tag near the player
    const M1 = F4.begin(mgr, vil, 'tag');
    check(!!M1 && M1.members.length >= 2, `tag: begun with ${M1 ? M1.members.length : 0} children`);
    if (M1) {
      run(6);
      const A = vil._f4area;
      check(A && Math.hypot(A.cx - player.pos[0], A.cz - player.pos[2]) <= 16, `tag: the yard near you (${A ? Math.hypot(A.cx - player.pos[0], A.cz - player.pos[2]).toFixed(1) : '-'} m)`);
      check(vil.game && vil.game.type === 'tag' && M1.members.every(k => k.act && k.act.type === 'play'), `tag: the children play tag (${vil.game && vil.game.type}; ${M1.members.map(k => k.act && k.act.type).join(',')})`);
      run(4);
      const near = M1.members.filter(k => dP(k) < 22).length;
      check(near >= 2, `tag: they run about near you (${near} within 22 m)`);
      F4.end(mgr, M1);
      check(!vil._f4area && M1.members.every(k => !k._f4), 'tag: ended cleanly');
    }
    // a picnic
    const M2 = F4.begin(mgr, vil, 'picnic');
    check(!!M2 && M2.members.length === 2 && !!M2.spot, 'picnic: two neighbours and a spot');
    if (M2) {
      run(25);
      const [a, b] = M2.members;
      check(a.pose === 'sitground' && b.pose === 'sitground', `picnic: both sit on the blanket (${a.pose}, ${b.pose}; ${M2.members.map(o => Math.hypot(o.pos[0] - M2.spot[0], o.pos[2] - M2.spot[2]).toFixed(1) + ' m ' + (o.act && o.act.type)).join(', ')})`);
      check(openAt(M2.spot) && sol(M2.spot[0], M2.spot[1] - 0.2, M2.spot[2]), 'picnic: the blanket on open ground');
      const face = (x, y) => { const t = Math.atan2(-(y.pos[0] - x.pos[0]), -(y.pos[2] - x.pos[2])); return Math.abs(Math.atan2(Math.sin(t - x.yaw), Math.cos(t - x.yaw))) < 0.6; };
      check(face(a, b) && face(b, a), 'picnic: facing each other');
      check(Math.hypot(M2.spot[0] - player.pos[0], M2.spot[2] - player.pos[2]) < 14, 'picnic: where you walk');
      F4.end(mgr, M2);
      check(a.pose !== 'sitground' && !a._f4, 'picnic: up again after');
    }
    // feeding the animals
    for (let i = 0; i < 3; i++) mobs.push({ kind: 'chicken', pos: [player.pos[0] + 6 + i, pz.y, player.pos[2] - 3 + i], vel: [0, 0, 0], yaw: 0, def: { name: 'chicken' }, dead: false });
    const d0 = mobs.map(m => m.pos.slice());
    const M3 = F4.begin(mgr, vil, 'feed');
    check(!!M3 && M3.members.length === 1, `feed: someone goes to feed them (${M3 ? (M3.members[0].elder ? 'an elder' : 'a grown-up') : 'none'})`);
    if (M3) {
      run(20);
      const f = M3.members[0];
      check(f.pose === 'crouch', `feed: crouching, scattering grain (${f.pose})`);
      const closer = mobs.filter(m => Math.hypot(m.pos[0] - f.pos[0], m.pos[2] - f.pos[2]) < 2.6).length;
      check(closer >= 2, `feed: the animals came (${closer} of 3 within 2.6 m)`);
      F4.end(mgr, M3);
    }
    mobs.length = 0; void d0;
    // the dusk dance
    g.env.timeOfDay = 11000; run(3);
    { const c4 = F4.ctxOf(mgr); console.log('    · dusk: ' + JSON.stringify({ kids: c4 && c4.kids, adults: c4 && c4.adults, elders: c4 && c4.elders, joy: !!(mgr.joy && mgr.joy.dance), acts: vil.agents.map(a => (a.act && a.act.type) + (a._f4 ? '*' : '')).join(' ') })); }
    const M4 = F4.begin(mgr, vil, 'dance');
    check(!!M4 && !!M4.fiddler, 'dance: begun with a fiddler');
    if (M4) {
      const D = mgr.joy && mgr.joy.dance;
      check(D && D.f4 && D.n === D.members.length + 1, `dance: a slot left open for you (${D ? D.members.length : 0} + 1)`);
      run(22);
      const n = D ? D.members.filter(a => a.dance && a.ringDance).length : 0;
      check(n >= Math.min(3, D ? D.members.length : 3), `dance: ${n} of ${D ? D.members.length : 0} in the ring`);
      const fd = M4.fiddler, rr = D ? Math.hypot(fd.pos[0] - D.c[0], fd.pos[2] - D.c[2]) : 0;
      check(D && rr > D.r + 0.4 && rr < D.r + 3, `dance: the fiddler at the ring's edge (${rr.toFixed(1)} m, ring ${D ? D.r.toFixed(1) : '-'})`);
      check(fd.f4fiddle && openAt(fd.pos), 'dance: the fiddler plays on open ground');
      check(V.Dusk === undefined || (V.Dusk.lure && Math.hypot(V.Dusk.lure[0] - D.c[0], V.Dusk.lure[2] - D.c[2]) < 0.1), 'dance: the Flausellichter are drawn to it');
      // join
      check(F4.join(mgr), 'dance: V joins');
      run(2);
      const sl = F4.slotPos(mgr);
      check(sl && Math.hypot(player.pos[0] - sl[0], player.pos[2] - sl[1]) < 0.6, 'dance: you stand in the open slot');
      const b = 60 / F4.BPM, onb = Math.ceil(F4.clock(mgr) / b) * b;
      check(F4.press(mgr, onb) === 'beat' && F4.press(mgr, onb + b / 2) === 'step', 'dance: V on the beat a beat, off it a step');
      F4.end(mgr, M4);
      check(!mgr.joy.dance && !F4.joined(mgr) && !(V.Dusk && V.Dusk.lure), 'dance: ended cleanly');
    }
    // greetings remember you
    g.env.timeOfDay = 3000; run(2);
    const a = vil.agents.find(o => !o.kid && o.pose !== 'sleep');
    const said = [];
    const sayW = a.say.bind(a); a.say = (t, d) => { said.push(t); return sayW(t, d); };
    for (let i = 0; i < 3; i++) {
      a.greeted = false; mgr._f4words = -1e9; a.bubble = null; F4.lastWords = -1e9;
      V.Gossip.hello(mgr, a);
      g.env.timeOfDay += F4.MEET_GAP + 10;
    }
    console.log('    · ' + said.join(' | '));
    check(said.length === 3, `three greetings (${said.length})`);
    check(said[0] && said[0].indexOf(a.p.name) >= 0, 'the first: they say their name');
    check(said[2] && said[2].indexOf('Mira') >= 0, 'the third: they say yours');
    check(a.waveT > 0 && F4.squinting(mgr, a), 'a wave and a happy squint');
    check(g.meta.folk4 && g.meta.folk4.meet && Object.keys(g.meta.folk4.meet).length >= 1, 'remembered in the save (meta.folk4)');
    // the clock (no Regie here): a moment starts on its own within two minutes
    F4.auto = true; F4.mem = null; g.env.timeOfDay = 4200;
    for (const o of vil.agents) o._f4 = null;
    let got = null; for (let f = 0; f < 120 * 30 && !got; f++) { mgr.update(dt); if (F4.active(mgr)) got = F4.active(mgr).kind; }
    check(!!got, `the clock starts a moment by itself (${got})`);
  }
  Math.random = r0;
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

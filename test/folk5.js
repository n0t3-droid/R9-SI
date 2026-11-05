// f-folk5 · polish u-folk4's villagers, and the Laternenzug — without a browser (docs/superpowers/plans/2026-11-05-f-folk5.md):
//   a · pure: the keep-off rim, the onlookers' ring, the lantern picker (window, some evenings, once a night, rain,
//       children, the gap, after the dance), the song (our own: pentatonic, gentle), the texts in both tables
//   b · Nova Haven (Herzwelt's village, folk4.js's simulation): the dance ring kept clear of pets, animals and walkers,
//       onlookers on its rim facing it; a friend's big greeting (comes nearer, the big wave or the lean, a heart), the
//       voxel squint; moments back to back (each begins right after the last, no stale marks, a stray folkjoy dance
//       cleared); the lantern procession (a line of children on a loop, singing, the Flausellichter following, ends clean)
// Run: bash test/wt_run.sh folk5.js 300
require('./dom_stub.js');
const V = require('./load_shared.js');
globalThis.VR = V;
for (const f of ['i18n', 'lang_en', 'lang_de']) require(__dirname + '/../src/main/' + f + '.js');
require('../src/shared/smoothvox.js'); require('../src/shared/folksmooth.js');
for (const f of ['voxmodels', 'villagers', 'folkmodel', 'villages', 'folklife', 'festival', 'folkjoy', 'worldlife', 'folk3', 'gossip', 'dusk', 'folk4', 'folk5']) require('../src/main/' + f + '.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const F4 = V.Folk4, F5 = V.Folk5;
check(!!F5 && typeof F5.keepOff === 'function', 'VR.Folk5 exists');
if (!F5 || !F5.keepOff) { console.log('FAILED ' + (fails || 1)); process.exit(1); }

// ---------------------------------------------------------------- a · pure
console.log('a · pure');
{
  const o = [0, 0];
  check(F5.keepOff(1, 0, 0, 0, 3, o) && Math.abs(Math.hypot(o[0], o[1]) - 3) < 1e-6 && o[0] > 0, 'inside the circle: set onto its rim, on its own side');
  check(!F5.keepOff(4, 0, 0, 0, 3, o), 'outside: left alone');
  check(F5.keepOff(0, 0, 0, 0, 3, o) && Math.abs(Math.hypot(o[0], o[1]) - 3) < 1e-6, 'at the very middle: still out to the rim');
  const S = F5.ringSpots(10, 20, 4, 5, 0);
  check(S.length === 5 && S.every(s => Math.abs(Math.hypot(s[0] - 10, s[1] - 20) - 4) < 1e-6), 'five onlooker spots on the ring');
  const ang = S.map(s => Math.atan2(s[1] - 20, s[0] - 10)), gapOk = ang.every(a => Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) > 0.7);
  check(gapOk, `the side toward the player stays open (${ang.map(a => a.toFixed(2)).join(' ')})`);
  let mind = 9; for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) mind = Math.min(mind, Math.hypot(S[i][0] - S[j][0], S[i][1] - S[j][1]));
  check(mind > 1.2, `spread loosely (${mind.toFixed(2)} m apart at least)`);
  // the lantern picker
  const c = (x) => Object.assign({ t: 1000, tod: 12100, rain: 0, kids: 4, adults: 3, elders: 1, animals: 0, seed: 7, place: 3, night: 10 }, x);
  let on = 0, nights = 0;
  for (let s = 0; s < 200; s++) { nights++; if (F5.evening(s, s * 3 + 1, 17)) on++; }
  check(on > 60 && on < 140, `some evenings, not every one (${on} of ${nights})`);
  let cc = null; for (let n = 0; n < 50 && !cc; n++) if (F5.evening(7, n, 3)) cc = c({ night: n });
  check(!!cc && F5.lantOk(cc, F4.newMem()), 'a lantern evening late at dusk with children: the procession');
  check(!F5.lantOk(Object.assign({}, cc, { tod: 6000 }), F4.newMem()), 'not by day');
  check(!F5.lantOk(Object.assign({}, cc, { tod: 16000 }), F4.newMem()), 'not deep in the night');
  check(!F5.lantOk(Object.assign({}, cc, { rain: 0.6 }), F4.newMem()), 'not in the rain');
  check(!F5.lantOk(Object.assign({}, cc, { kids: 2 }), F4.newMem()), 'three children at least');
  let off = null; for (let n = 0; n < 50 && !off; n++) if (!F5.evening(7, n, 3)) off = c({ night: n });
  check(!F5.lantOk(off, F4.newMem()), 'not on every evening');
  const m = F4.newMem(); F4.note(m, 'lantern', 1000, cc);
  check(!F5.lantOk(Object.assign({}, cc, { t: 3000 }), m), 'once a night in a village');
  const m2 = F4.newMem(); F4.note(m2, 'tag', 990, cc);
  check(!F5.lantOk(cc, m2), 'the gap after another moment');
  const early = Object.assign({}, cc, { tod: 11700 });
  check(!F5.lantOk(early, F4.newMem()), 'early dusk belongs to the dance');
  const m3 = F4.newMem(); F4.note(m3, 'dance', 0, early);
  check(F5.lantOk(early, m3), '… after that evening\'s dance the procession may come');
  check(F4.pick(cc, F4.newMem()) === 'lantern', 'folk4\'s picker offers it');
  // the song
  const PENTA = new Set([0, 2, 4, 7, 9]);
  const notes = F5.SONG.map(n => n[0]), beats = F5.SONG.reduce((s, n) => s + n[1], 0);
  check(notes.every(n => PENTA.has(((n - F5.KEY) % 12 + 12) % 12)), 'the song keeps to a pentatonic scale (our own tune)');
  check(Math.max(...notes) - Math.min(...notes) <= 12 && Math.min(...notes) >= 60, `a child's range (${Math.min(...notes)}–${Math.max(...notes)})`);
  check(beats % 4 === 0 && beats >= 16, `whole bars (${beats} beats)`);
  check(F5.SONG.every((n, i) => !i || Math.abs(n[0] - F5.SONG[i - 1][0]) <= 5), 'gentle steps, no leaps');
  const Dc = V.I18N.dict, miss = F5.TEXT_KEYS.filter(k => !(Dc.de && Dc.de[k]) || !(Dc.en && Dc.en[k]));
  check(F5.TEXT_KEYS.length >= 8 && !miss.length, `every line in both tables (${miss.slice(0, 5).join(', ') || F5.TEXT_KEYS.length + ' keys'})`);
}

// ---------------------------------------------------------------- b · Nova Haven
console.log('b · Nova Haven');
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
  let tones = 0;
  const g = { world, player, env: { timeOfDay: 4000, day: 3, rain: 0 }, settings: { preset: 'balanced', toasts: false, playerName: 'Mira' }, meta: {}, entities: { mobs },
    particles: new Proxy({}, { get: () => () => {} }), audio: { play() {}, tone() { tones++; } }, ui: { chatLine() {}, toast() {} }, codex: null, pool: { direct() {} }, mp: null, folkBase: 100, state: 'play' };
  V.game = g;
  const mgr = Object.create(Vs.prototype);
  Object.assign(mgr, { g, meta: g.meta, known: new Map(), pending: new Set(), agents: [], sites: [], siteT: 1e9, siteAt: [player.pos[0], player.pos[2]], doors: new Map(), selfEdit: false, pathBudget: 0, time: 0, bubs: [] });
  mgr.meta.villages = mgr.meta.villages || {}; mgr.st = mgr.meta.villages; mgr.updateBubbles = () => {}; mgr.chirp = () => {}; mgr.talkText = () => {};
  mgr.joyTier = () => 2;
  g.villages = mgr;
  mgr.addVillage(sum);
  const dt = 1 / 30, run = (s) => { for (let f = 0; f < s * 30; f++) mgr.update(dt); };
  F4.auto = false;
  run(8);
  const vil = mgr.agents[0] && mgr.agents[0].vil;
  check(!!vil, `the village lives (${mgr.agents.length} people)`);
  const dXZ = (a, c) => Math.hypot(a.pos[0] - c[0], a.pos[2] - c[2]);
  const stale = () => vil.agents.filter(a => a._f4 || (a.act && (a.act.type === 'f4' || a.act.type === 'f5look'))).length;
  if (vil) {
    // (a festival day keeps the people at the festival: a day without one)
    for (let d = 3; d < 40 && mgr.festivalDay && mgr.festivalDay(vil); d++) g.env.day = d + 1;
    console.log('    · day ' + g.env.day + (mgr.festivalDay && mgr.festivalDay(vil) ? ' (a festival)' : ''));
    // ---- the dance ring kept clear, onlookers on its rim
    g.env.timeOfDay = 11000; run(2);
    const M = F4.begin(mgr, vil, 'dance');
    check(!!M, 'dance: begun');
    if (M) {
      const D = M.D;
      // a pet, an animal and a passer-by right in the middle
      const J = mgr.joyState();
      const pet = { kind: 'f', pos: [D.c[0] + 0.3, D.c[1], D.c[2]], yaw: 0, walk: 0, walkAmt: 0, id: 99, pet: { state: 'follow', wig: 0 }, owner: vil.agents.find(a => !M.members.includes(a)) || vil.agents[0], vil, still: 0, seenT: -1e9 };
      J.pets.push(pet);
      mobs.push({ kind: 'sheep', pos: [D.c[0] - 0.4, D.c[1], D.c[2] + 0.2], vel: [0, 0, 0], yaw: 0, def: { name: 'sheep' }, dead: false });
      // (the simulation's people are spread over the village: three passers-by brought near, where the player stands)
      const far3 = vil.agents.filter(o => !o.kid && !M.members.includes(o) && dXZ(o, D.c) > 16).slice(0, 3);
      far3.forEach((o, i) => { o.pos = [player.pos[0] + [1, 0, -1][i], player.pos[1], player.pos[2] + [0, 1, 0][i]]; o.vel = [0, 0, 0]; o.path = null; o.act = { type: 'stroll', t: 0 }; });
      run(14);
      const Z = F5.zone(mgr);
      check(!!Z && Z.R > D.r, `dance: a keep-off circle round the ring (${Z ? Z.R.toFixed(1) : '-'} m, ring ${D.r.toFixed(1)})`);
      const inside = (o) => Z && dXZ(o, Z.c) < Z.R - 0.15;
      check(!inside(pet), `dance: the pet keeps out of the ring (${dXZ(pet, D.c).toFixed(1)} m)`);
      check(!inside(mobs[0]), `dance: the animal keeps out (${dXZ(mobs[0], D.c).toFixed(1)} m)`);
      const nr = D.members.filter(a => a.dance && a.ringDance).length;
      check(nr >= Math.min(3, D.members.length), `dance: the dancers still dance their ring (${nr} of ${D.members.length}; folk5.mjs run 1: the keep-off rim pushed them out)`);
      const walkers = vil.agents.filter(a => !M.members.includes(a) && inside(a));
      check(walkers.length === 0, `dance: no passer-by inside the ring (${walkers.length})`);
      const L = F5.lookers(mgr);
      if (process.env.DBG) console.log('DBG all', vil.agents.map(o => (o.kid ? 'k' : 'a') + ':' + (o.act && o.act.type) + (o.act && o.act.done ? '!' : '') + '/' + o.pose + '/' + dXZ(o, D.c).toFixed(0) + (o._f4 ? '/M' : '') + (o._f5 ? '/L' : '') + (o.dance ? '/d' : '')).join(' '));
      console.log(`    · onlookers: ${L.length} — ${L.map(a => dXZ(a, D.c).toFixed(1) + ' m').join(', ')}`);
      check(L.length >= 2, `dance: onlookers gather (${L.length})`);
      const face = (a) => { const t = Math.atan2(-(D.c[0] - a.pos[0]), -(D.c[2] - a.pos[2])); return Math.abs(Math.atan2(Math.sin(t - a.yaw), Math.cos(t - a.yaw))) < 0.7; };
      const onRim = L.filter(a => dXZ(a, D.c) > Z.R - 0.1 && dXZ(a, D.c) < Z.R + 3.2);
      check(L.length && onRim.length >= L.length - 1, `dance: on a loose ring outside it (${onRim.length} of ${L.length})`);
      check(L.length && L.filter(face).length >= L.length - 1, `dance: facing the dance (${L.filter(face).length} of ${L.length})`);
      run(4);
      check(F5.stats.claps > 0, `dance: they clap and sway (${F5.stats.claps} claps)`);
      F4.end(mgr, M);
      check(F5.lookers(mgr).length === 0 && stale() === 0, `dance: ended — onlookers released, no marks left (${stale()})`);
      J.pets.splice(J.pets.indexOf(pet), 1); mobs.length = 0;
    }
    // ---- a friend's big greeting
    g.env.timeOfDay = 3000; run(2);
    const a = vil.agents.find(o => !o.kid && o.pose !== 'sleep' && !o._f4);
    {
      const rec = F4.rec(g), pid = 'overworld/' + a.p.id; rec.meet[pid] = [2, (g.env.day * 24000 + g.env.timeOfDay) - 5000];
      a.act = { type: 'stand', t: 0 }; a.path = null; a.steer = null; a.vel[0] = a.vel[2] = 0;
      player.pos[0] = a.pos[0] + 3.6; player.pos[2] = a.pos[2]; player.pos[1] = a.pos[1];
      a.greeted = false; a.bubble = null; mgr._f4words = -1e9;
      const d0 = dXZ(a, player.pos);
      V.Gossip.hello(mgr, a);
      check(F5.friendOf(mgr, a), 'friend: the third meeting starts a friend\'s greeting');
      const clips = new Set(); let minD = d0;
      for (let f = 0; f < 6 * 30; f++) { mgr.update(dt); if (a.joyClip) clips.add(a.joyClip); minD = Math.min(minD, dXZ(a, player.pos)); }
      check(minD < d0 - 1 && minD > 1.2, `friend: comes a few steps toward you (${d0.toFixed(1)} → ${minD.toFixed(1)} m)`);
      check(clips.has('cheer') || clips.has('hug'), `friend: a big two-arm wave or a hug-like lean (${[...clips].join(',')})`);
      check(F5.stats.hearts > 0, 'friend: a little heart');
      check(!F5.friendOf(mgr, a) && !(a.act && a.act.type === 'f5hi'), 'friend: back to the day after');
      // the squint on the voxel people (Very Low): the lids part shown, lowered half an eye
      a.f4sq = mgr.time + 2; a.blinkOn = false;
      const pose = { head: [0, 0, 0] }, opts = { hide: { lids: true } };
      F5.squintVox(mgr, a, pose, opts, false);
      check(opts.hide.lids === false && pose.lids && pose.lids[4] < 0 && pose.lids[4] > -1, `squint: the voxel lids half over the eyes (${pose.lids && pose.lids.join(',')})`);
      a.f4sq = 0; const p2 = { head: [0, 0, 0] }, o2 = { hide: { lids: true } }; F5.squintVox(mgr, a, p2, o2, false);
      check(o2.hide.lids === true && !p2.lids, 'squint: none without a greeting');
    }
    // ---- moments back to back
    player.pos[0] = C[0] + 4.5; player.pos[2] = C[2] + 4.5; player.pos[1] = pz.y; g.env.timeOfDay = 4500; run(2);
    const seq = ['tag', 'picnic', 'greet', 'feed', 'dance', 'stray', 'dance', 'lantern'];
    const got = [];
    for (const k of seq) {
      if (k === 'greet') { const o = vil.agents.find(x => !x.kid && !x._f4); o.greeted = false; mgr._f4words = -1e9; V.Gossip.hello(mgr, o); run(1); got.push('greet'); continue; }
      if (k === 'stray') {   // a folkjoy dance of its own (an invitation) still there — test begin() clears it
        const ms = vil.agents.filter(x => !x.kid && !x._f4).slice(0, 3);
        const Dj = mgr.joyState().dance = { t: 0, len: 30, c: [player.pos[0], player.pos[1], player.pos[2]], phase: 0, n: ms.length, members: ms };
        ms.forEach((o, i) => mgr.joyBegin(o, 'dancer', { idx: i, len: 31 })); void Dj; run(1);
        check(F4.begin(mgr, vil, 'dance') === null, 'back to back: a stray dance blocks a new one …');
        F4.clear(mgr); run(0.2);
        got.push('stray'); continue;
      }
      if (k === 'feed') mobs.push({ kind: 'chicken', pos: [player.pos[0] + 5, pz.y, player.pos[2] - 2], vel: [0, 0, 0], yaw: 0, def: { name: 'chicken' }, dead: false });
      if (k === 'dance') g.env.timeOfDay = 11000;
      if (k === 'lantern') { g.env.timeOfDay = 12100; for (const o of vil.agents) if (o.kid && o.pose === 'sleep') o.pose = 'stand'; }
      F4.clear(mgr);
      if (process.env.DBG) console.log('DBG ' + k, vil.agents.map(o => (o.kid ? 'k' : 'a') + ':' + (o.act && o.act.type) + (o.act && o.act.done ? '!' : '') + '/' + o.pose + '/' + dXZ(o, player.pos).toFixed(0) + (o._f4 ? '/M' : '') + (o.dance ? '/d' : '')).join(' '));
      const Mk = F4.begin(mgr, vil, k);
      got.push(Mk ? k : '✗' + k);
      if (!Mk) continue;
      run(k === 'dance' ? 3 : 2);
      check(F4.active(mgr) === Mk, `back to back: ${k} holds`);
      F4.end(mgr, Mk);
      const st = stale();
      check(!F4.active(mgr) && st === 0 && !(mgr.joy && mgr.joy.dance) && !vil._f4area, `back to back: ${k} ended cleanly (marks ${st})`);
      mobs.length = 0;
    }
    console.log('    · ' + got.join(' → '));
    check(got.every(x => x[0] !== '✗'), 'back to back: every moment began right after the last');
    // F4.end also releases a member dropped from the list, F4.clear a stale mark
    g.env.timeOfDay = 4000; run(1);
    const Mt = F4.begin(mgr, vil, 'picnic');
    if (Mt) { const lost = Mt.members.pop(); F4.end(mgr, Mt); check(!lost._f4 && !(lost.act && lost.act.type === 'f4'), 'F4.end releases a member dropped from its list'); }
    const o9 = vil.agents.find(x => !x._f4); o9._f4 = { kind: 'old', members: [o9] }; o9.act = { type: 'f4', role: 'pic' };
    F4.clear(mgr); check(!o9._f4 && !(o9.act && o9.act.type === 'f4'), 'F4.clear releases a stale mark');
    // ---- the lantern procession
    g.env.timeOfDay = 12100; run(1);
    for (const o of vil.agents) if (o.kid && o.pose === 'sleep') o.pose = 'stand';
    player.pos[0] = C[0] + 4.5; player.pos[2] = C[2] + 4.5;
    F4.clear(mgr); tones = 0;
    if (process.env.DBG) { const pp = player.pos; console.log('DBG kids', vil.agents.filter(o => o.kid).map(o => (o.act && o.act.type) + '/' + o.pose + '/' + Math.hypot(o.pos[0] - pp[0], o.pos[2] - pp[2]).toFixed(0) + '/' + o._f4 + '/' + o.drawn).join(' ')); const pzz = vil.plan.plaza; for (const r of [9, 7, 11, 6]) console.log('DBG route', r, F5.route(world, [pzz.x + 0.5, pzz.y, pzz.z + 0.5], r, pp).length); }
    // (folk5.mjs run 2: the children were in folkjoy's moments — a story by the fire, trailing the player — at dusk)
    const kk = vil.agents.filter(o => o.kid);
    if (kk[0]) { mgr.joyBegin(kk[0], 'story', { role: 'listen', S: { kids: [kk[0]] }, seat: [kk[0].pos[0], kk[0].pos[2]], len: 80 }); kk[0].pose = 'sitground'; }
    if (kk[1]) mgr.joyBegin(kk[1], 'follow', { len: 40 });
    const ML = F4.begin(mgr, vil, 'lantern');
    check(!!ML && kk.slice(0, 2).every(k => ML.members.includes(k)), 'lantern: children come from a story by the fire or from trailing you');
    check(!!ML && ML.members.length >= 3, `lantern: ${ML ? ML.members.length : 0} children with lanterns`);
    if (ML) {
      check(ML.route && ML.route.length >= 6, `lantern: a loop through the village (${ML.route ? ML.route.length : 0} points)`);
      const lead = ML.members[0], p0 = lead.pos.slice(); let walked = 0, lp = p0.slice(), lineOk = 0, lineN = 0, lureOk = 0;
      for (let f = 0; f < 30 * 30; f++) {
        mgr.update(dt);
        walked += Math.hypot(lead.pos[0] - lp[0], lead.pos[2] - lp[2]); lp = lead.pos.slice();
        if (f % 30 === 29 && f > 150) {
          lineN++; let ok = true;
          for (let i = 1; i < ML.members.length; i++) if (Math.hypot(ML.members[i].pos[0] - ML.members[i - 1].pos[0], ML.members[i].pos[2] - ML.members[i - 1].pos[2]) > 3.5) ok = false;
          if (ok) lineOk++;
          const Lu = V.Dusk && V.Dusk.lure; if (Lu && Math.hypot(Lu[0] - lead.pos[0], Lu[2] - lead.pos[2]) < 4) lureOk++;
        }
      }
      check(walked > 10 && walked < 45, `lantern: the line walks its loop at a procession's pace (${walked.toFixed(1)} m in 30 s)`);
      check(lineOk >= lineN * 0.7, `lantern: in a line, each close behind the one before (${lineOk} of ${lineN} checks)`);
      check(F5.stats.notes > 8 && tones > 8, `lantern: they sing softly (${F5.stats.notes} notes)`);
      check(lureOk >= lineN * 0.7, `lantern: the Flausellichter follow (${lureOk} of ${lineN})`);
      check(ML.members.every(k => k.f5lant), 'lantern: each child holds a lantern');
      F4.end(mgr, ML);
      check(stale() === 0 && !(V.Dusk && V.Dusk.lure) && ML.members.every(k => !k.f5lant), 'lantern: ended cleanly, the lure let go');
    }
    // the frame's cost with the procession and idle
    F4.clear(mgr); const ML2 = F4.begin(mgr, vil, 'lantern'); run(3);
    const cost = () => { const t0 = process.hrtime.bigint(); for (let i = 0; i < 3000; i++) F5.frame(mgr, dt); return Number(process.hrtime.bigint() - t0) / 1e6 / 3000; };
    const busy = cost(); F4.clear(mgr); const idle = cost();
    console.log(`    · Folk5's frame: ${busy.toFixed(4)} ms with a procession, ${idle.toFixed(4)} ms idle`);
    check(!!ML2 && busy < 0.05 && idle < 0.005, 'Folk5\'s frame is cheap');
  }
  Math.random = r0;
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

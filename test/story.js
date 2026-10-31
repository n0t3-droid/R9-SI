// Das Buch „Funke und die Leuchtfeuer" (a-story; plan docs/superpowers/plans/2026-10-29-a-story.md §3, spec
// docs/superpowers/specs/2026-10-22-abenteuer-design.md §9, §15). The pure part, src/shared/story.js:
//   1. the book: twelve chapters (title, where, logline), chapters 1–4 three beats each in order, every beat in the A§9
//      format, its scene ≤ 30 s, every line and name in both tables (German first, different from the English)
//   2. when: every reason on its own (calm < 20 s, building, a fight, a menu, the Studio, a landing, a scene, a guest, the
//      Abenteuer, the place, the hour, near, freed, high, orbit, the dim, the eclipse), the open beat in order
//   3. never during building or a fight: 3,000 random contexts — no beat is ready while building or fighting, and every
//      ready beat has calm ≥ 20 s
//   4. Später: three reminders 5 min apart, then silent (waiting in the journal); ▶ there still plays it
//   5. the record: load sanitises (unknown ids, junk values, a postponed beat due again after a load), an old world
//      without meta.story gets a fresh one, a round trip through JSON
//   6. the timeline: the lines inside the scene, in order, ≥ 2.6 s each where they fit; shotAt walks the shots
//   7. a session's chapter 1 walk-through: the beats come one after another as their conditions come true
//   8. the player (src/main/story.js, regie.js) on a stand-in game: no offer while building or before 20 s of calm; the
//      offer through the Regie, Funke's line, the card; untaken → Später, the reminder after 5 min; [V] plays, the player
//      held, no skip in the first second, the camera fixed, the subtitles; skip → seen, the task, saved, the journal page;
//      the next beat 5 min later; a scene ends by itself ≤ 30 s; storyOffer off; a guest
//   bash test/wt_run.sh story.js 300
const fs = require('fs'), path = require('path');
global.VR = {};
const SRC = path.join(__dirname, '../src/');
for (const f of ['main/i18n', 'main/lang_en', 'main/lang_de']) require(SRC + f + '.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
if (!fs.existsSync(SRC + 'shared/story.js')) { console.log('  ✗ src/shared/story.js missing'); console.log('FAILED 1'); process.exit(1); }
require(SRC + 'shared/story.js');
const S = VR.Story, I = VR.I18N;
const tab = (l) => (I.dict && I.dict[l]) || null;

console.log('1 · the book');
check(S.CHAPTERS.length === 12, 'twelve chapters (' + S.CHAPTERS.length + ')');
for (let c = 1; c <= 8; c++) { const bs = S.ofChapter(c); check(bs.length === 3 && bs.every((b, i) => b.n === i + 1), `chapter ${c}: three beats in order`); }
check(S.BEATS.every(b => b.when && b.scene && b.scene.shots.length && b.scene.lines.length && b.task && b.reward && b.reward.xp > 0), 'every beat: when, scene (shots, lines), task, reward');
check(S.BEATS.every(b => S.sceneLen(b) <= S.SCENE_MAX && S.sceneLen(b) >= 8), 'every scene 8–30 s (' + S.BEATS.map(b => S.sceneLen(b)).join(' ') + ')');
check(S.BEATS.every((b, i) => i === 0 ? b.when.after === null : b.when.after === S.BEATS[i - 1].id), 'every beat follows the one before');
check(S.BEATS.every(b => b.scene.lines.every(l => S.WHO.includes(l.who))), 'every speaker is one of the six');
const keys = S.keys();
const dT = tab('de'), eT = tab('en');
const tr = (l, k) => { const t = l === 'de' ? dT : eT; if (t) return t[k]; const l0 = I.lang; I.setLang ? I.setLang(l) : (I.lang = l); const s = I.t(k); I.setLang ? I.setLang(l0) : (I.lang = l0); return s === k ? undefined : s; };
const missDe = keys.filter(k => !tr('de', k)), missEn = keys.filter(k => !tr('en', k));
check(!missDe.length, keys.length + ' keys in the German table' + (missDe.length ? ': missing ' + missDe.slice(0, 6).join(', ') : ''));
check(!missEn.length, 'and in the English one' + (missEn.length ? ': missing ' + missEn.slice(0, 6).join(', ') : ''));
const same = keys.filter(k => /\.b\d\.\d$/.test(k) && tr('de', k) === tr('en', k));
check(!same.length, 'every German line is German (not the English) ' + (same.length ? same.join(', ') : ''));
check(keys.every(k => !/\bEcho\b/.test(tr('de', k) || '') || /c1[012]|choice\.how|who\.echo/.test(k)), 'Echo is named only from chapter 10 on (a-story4)');

console.log('2 · when');
const calm = (o) => Object.assign({ calm: 30, place: 'hangar', hour: 'noon', played: 60, adv: true, dim: 'overworld', near: { outpost: 9999 }, freed: 0, high: 0, orbit: false, eclipse: 0 }, o || {});
const rec0 = S.fresh(), b1 = S.byId('c1.b1');
check(S.why(b1, calm(), rec0) === null, 'c1.b1 is offered in the Hangar Hall after 20 s of calm');
const reasons = [['calm', { calm: 19.9, adv: false }], ['calm', { calm: 7.9, adv: true }], ['building', { building: true }], ['fight', { fighting: true }], ['menu', { menu: true }], ['studio', { studio: true }], ['landing', { landing: true }], ['scene', { scene: true }], ['guest', { guest: true }], ['place', { place: 'plaza', played: 100 }], ['dim', { dim: 'basalt' }]];
for (const [r, o] of reasons) check(S.why(b1, calm(o), rec0) === r, `c1.b1 not offered: ${r}`);
check(S.why(b1, calm({ place: 'plaza', played: 260 }), rec0) === null, 'c1.b1 anywhere after 4 minutes in a world without a Hangar Hall');
check(S.why(b1, calm({ adv: false }), rec0) === null, 'chapter 1 begins in a builder world too (an offer only)');
check(S.why(b1, calm({ adv: true, calm: 8.1 }), rec0) === null && S.why(b1, calm({ adv: false, calm: 8.1 }), rec0) === 'calm', 'a-regie: an adventurer\'s calm before the offer is ' + S.CALM_ADV + ' s, a builder\'s 20');
const r1 = S.fresh(); S.mark(r1, 'c1.b1');
const b2 = S.byId('c1.b2');
check(S.why(b2, calm({ place: 'hills' }), rec0) === 'after' && S.why(b2, calm({ place: 'hills' }), r1) === null, 'c1.b2 after c1.b1, out on the hills');
check(S.why(b2, calm({ place: 'hills', hour: 'night' }), r1) === null, 'c1.b2 by night too (the session: night fell before its 5 minutes were up)');
S.mark(r1, 'c1.b2');
const b3 = S.byId('c1.b3');
check(S.why(b3, calm({ adv: false, near: { outpost: 300 } }), r1) === 'adv', 'chapter 1 · beat 3 on only in an Abenteuer world');
check(S.why(b3, calm({ near: { outpost: 800 } }), r1) === 'near' && S.why(b3, calm({ near: { outpost: 600 } }), r1) === null, 'c1.b3 within 700 m of an outpost');
S.mark(r1, 'c1.b3'); S.mark(r1, 'c2.b1');
check(S.why(S.byId('c2.b2'), calm(), r1) === 'freed' && S.why(S.byId('c2.b2'), calm({ freed: 1 }), r1) === null, 'c2.b2 once a place is freed');
S.mark(r1, 'c2.b2'); S.mark(r1, 'c2.b3');
check(S.why(S.byId('c3.b1'), calm({ high: 300 }), r1) === 'high' && S.why(S.byId('c3.b1'), calm({ high: 900 }), r1) === null, 'c3.b1 above 600 m');
S.mark(r1, 'c3.b1');
check(S.why(S.byId('c3.b2'), calm({ high: 5000 }), r1) === 'orbit' && S.why(S.byId('c3.b2'), calm({ orbit: true }), r1) === null, 'c3.b2 in orbit');
S.mark(r1, 'c3.b2');
check(S.why(S.byId('c3.b3'), calm({ dim: 'basalt' }), r1) === null, 'c3.b3 also on a moon (it was postponed till there)');
S.mark(r1, 'c3.b3');
check(S.why(S.byId('c4.b1'), calm(), r1) === 'dim' && S.why(S.byId('c4.b1'), calm({ dim: 'basalt' }), r1) === null, 'c4.b1 on Basalt or Opal');
S.mark(r1, 'c4.b1');
check(S.why(S.byId('c4.b2'), calm({ dim: 'basalt' }), r1) === 'dim' && S.why(S.byId('c4.b2'), calm({ dim: 'opal' }), r1) === null, 'c4.b2 on Opal (the Eiswächter)');
S.mark(r1, 'c4.b2');
check(S.why(S.byId('c4.b3'), calm({ dim: 'opal', eclipse: 0.3 }), r1) === 'eclipse' && S.why(S.byId('c4.b3'), calm({ dim: 'opal', eclipse: 0.8 }), r1) === null, 'c4.b3 in the eclipse');
S.mark(r1, 'c4.b3');
check(S.open(r1) && S.open(r1).id === 'c5.b1' && S.chapter(r1) === 5, 'all twelve beats of 1–4 seen: chapter 5 is open (a-story3)');
check(S.why(S.byId('c1.b1'), calm(), r1) === 'done', 'a seen beat is never offered again');

console.log('3 · never during building or a fight');
let x = 0x2545F491; const rnd = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
const PL = ['hangar', 'plaza', 'street', 'hall', 'hills', 'isles', 'water', 'wild'], HR = ['dawn', 'morning', 'noon', 'afternoon', 'dusk', 'night'], DM = ['overworld', 'overworld', 'basalt', 'opal'];
let bad = 0, readyN = 0, calmBad = 0;
for (let i = 0; i < 3000; i++) {
  const rec = S.fresh(), k = Math.floor(rnd() * 12); for (let j = 0; j < k; j++) S.mark(rec, S.BEATS[j].id);
  const c = { calm: rnd() * 60, building: rnd() < 0.3, fighting: rnd() < 0.3, menu: rnd() < 0.1, landing: rnd() < 0.1, place: PL[Math.floor(rnd() * 8)], hour: HR[Math.floor(rnd() * 6)], played: rnd() * 600, adv: rnd() < 0.7, dim: DM[Math.floor(rnd() * 4)], near: { outpost: rnd() * 1000 }, freed: Math.floor(rnd() * 2), high: rnd() * 2000, orbit: rnd() < 0.2, eclipse: rnd() };
  for (const b of S.BEATS) { if (S.ready(b, c, rec)) { readyN++; if (c.building || c.fighting || c.menu || c.landing) bad++; if (c.calm < (c.adv ? S.CALM_ADV : 20)) calmBad++; } }
}
check(readyN > 50 && bad === 0 && calmBad === 0, `3,000 contexts: ${readyN} ready, ${bad} while building / fighting / in a menu / landing, ${calmBad} before 20 s of calm`);

console.log('4 · Später');
const r4 = S.fresh();
check(S.next(r4, calm(), 0) === b1, 'offered at t 0');
S.later(r4, 'c1.b1', 0);
check(S.next(r4, calm(), 299) === null && S.next(r4, calm(), 300) === b1, 'Später: again after 5 min');
S.later(r4, 'c1.b1', 300); S.later(r4, 'c1.b1', 600);
check(S.next(r4, calm(), 900) === b1 && !S.silent(r4, 'c1.b1'), 'the third reminder at 15 min');
S.later(r4, 'c1.b1', 900);
check(S.silent(r4, 'c1.b1') && S.next(r4, calm(), 99999) === null, 'after three reminders: silent');
check(S.waiting(r4)[0] === b1, '… it waits in the journal (▶ Ansehen)');
S.mark(r4, 'c1.b1', 'skip');
check(S.isDone(r4, 'c1.b1') && !r4.later['c1.b1'] && S.open(r4) === b2, 'skipped counts as seen (the lines in the journal), the next beat opens');

console.log('5 · the record');
check(JSON.stringify(S.load(undefined)) === JSON.stringify(S.fresh()), 'an old world without meta.story: a fresh record');
const junk = S.load({ v: 9, beats: { 'c1.b1': 'done', 'c9.b9': 'done', 'c1.b2': 'nope', 'c1.b3': 'skip' }, later: { 'c2.b1': { n: 2, at: 99999 }, 'c1.b1': { n: 1 }, 'zz': { n: 1 }, 'c2.b2': { n: 77 } } });
check(junk.beats['c1.b1'] === 'done' && !junk.beats['c9.b9'] && !junk.beats['c1.b2'] && junk.beats['c1.b3'] === 'skip', 'load keeps the known beats and values only');
check(junk.later['c2.b1'] && junk.later['c2.b1'].n === 2 && junk.later['c2.b1'].at === 0 && !junk.later['c1.b1'] && !junk.later.zz && junk.later['c2.b2'].silent, 'a postponed beat is due again after a load, its count kept; a seen one is dropped; past the reminders silent');
const rt = S.load(JSON.parse(JSON.stringify(junk)));
check(JSON.stringify(rt) === JSON.stringify(junk), 'a round trip through JSON');
check(S.chapter(S.fresh()) === 1 && S.chapter(junk) === 1, 'the chapter of the first unseen beat');

console.log('6 · the timeline');
let tlOk = true, tlMin = 99;
for (const b of S.BEATS) {
  const texts = b.scene.lines.map(l => tr('de', l.key)), tl = S.timeline(b, texts);
  for (let i = 0; i < tl.lines.length; i++) { const q = tl.lines[i]; tlMin = Math.min(tlMin, q.t1 - q.t0); if (q.t1 > tl.len + 1e-6 || q.t0 < 0 || (i && q.t0 < tl.lines[i - 1].t1)) tlOk = false; }
}
check(tlOk && tlMin >= 2.2, `every line inside its scene, in order (the shortest ${tlMin.toFixed(1)} s)`);
const sh = S.shotAt(b1, 0), sh2 = S.shotAt(b1, 5.5), sh3 = S.shotAt(b1, 99);
check(sh.i === 0 && sh2.i === 1 && Math.abs(sh2.u - 0.1) < 1e-6 && sh3.i === 2 && sh3.u === 1, 'shotAt walks the shots');

console.log('7 · chapter 1 walked through');
const r7 = S.fresh(); let t = 0; const got = [];
const steps = [calm({ place: 'hall', calm: 5 }), calm({ place: 'hangar' }), calm({ place: 'hangar' }), calm({ place: 'hills', building: true }), calm({ place: 'hills', hour: 'dusk' }), calm({ place: 'wild', near: { outpost: 650 } }), calm({ place: 'wild', near: { outpost: 100 } })];
for (const c of steps) { t += 400; const b = S.next(r7, c, t); if (b) { got.push(b.id); S.mark(r7, b.id); } }
check(got.join(' ') === 'c1.b1 c1.b2 c1.b3 c2.b1', 'the beats as their places come: ' + got.join(' '));

console.log('8 · the player on a stand-in game (src/main/story.js, regie.js)');
require('./dom_stub.js');
{ const ce = document.createElement; document.createElement = (t) => { const e = ce(t); e.style = e.style || {}; return e; }; if (!window.addEventListener) window.addEventListener = () => {}; }
global.setTimeout = (f) => 0;   // (the overlay's fades: not needed here)
global.performance = global.performance || { now: () => Date.now() };
require(SRC + 'main/regie.js'); require(SRC + 'main/story.js');
const SP = VR.StoryPlay;
I.lang = 'de';
check(!!SP && typeof S.watch === 'function' && typeof S.offer === 'function', 'VR.StoryPlay and VR.Story.offer / watch (ctx.js row 3)');
{
  const said = [];
  const g = { state: 'play', world: {}, time: 0, dim: 'overworld', settings: { storyOffer: true }, meta: { seed: 4242 }, ui: { screen: null },
    player: { pos: [0, 70, 0], yaw: 0, spawn: [0, 70, 0], eyePos() { return [0, 71.6, 0]; } },
    funke: { on: () => true, show: (t) => said.push(t), budget: { quiet: () => false }, buildFocus: () => g.__build === true, startWay: () => { g.__way = true; } },
    lifeDirector: { ctx: { place: 'hangar', hour: 'noon' } }, saveMeta: () => { g.__saved = (g.__saved | 0) + 1; } };
  VR.game = g;
  const run = (sec) => { for (let i = 0; i < sec * 20; i++) { g.time += 0.05; SP.frame(g, 0.05); } };
  g.__build = true; run(40);
  check(!SP.debug.state().offer && SP.debug.state().why === 'building', 'building: no offer (why: ' + SP.debug.state().why + ')');
  g.__build = false; run(12);
  check(!SP.debug.state().offer, 'not before 20 s of calm');
  run(14);
  const st = SP.debug.state();
  check(st.offer === 'c1.b1' && said.some(t => /Signal/.test(t)) && S.offer(g) && S.offer(g).id === 'c1.b1', 'after 20 s of calm the Regie takes the beat: Funke says the signal (' + said[said.length - 1] + ')');
  check(st.regie && st.regie.st.story === 1, 'the offer came through the Regie (' + JSON.stringify(st.regie && st.regie.st) + ')');
  const cardEl = document.getElementById('storycard');
  check(cardEl && cardEl.style.display === 'flex', 'the card shows (🎬 Ansehen · Später)');
  run(26);
  check(!SP.debug.state().offer && SP.debug.state().later['c1.b1'] && SP.debug.state().later['c1.b1'].n === 1, 'untaken for 25 s: Später (again in 5 min)');
  run(200);
  check(!SP.debug.state().offer, 'quiet during the 5 minutes');
  const until = (id, max) => { const t0 = g.time; while (SP.debug.state().offer !== id && g.time - t0 < max) run(0.5); return g.time; };
  const tLater = 77, tR = until('c1.b1', 150);
  check(SP.debug.state().offer === 'c1.b1' && said.some(t => /noch da/.test(t)), `after 5 min the reminder (at ${tR.toFixed(0)} s)`);
  check(S.watch(g) && SP.holds(g) && SP.debug.state().scene.id === 'c1.b1', '[V]: the scene plays, the player is held');
  check(VR.Regie.stats(g).scene === true, 'the Regie knows a scene plays (nothing else starts)');
  const box = document.getElementById('storybox');
  run(0.5);
  const sk0 = g.story.skip();
  check(!sk0 && SP.holds(g), 'no skip in the first second');
  run(2);
  const cam = SP.cam(g, { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, fov: 1.2, far: 200 });
  check(cam && cam.fixed && Number.isFinite(cam.x + cam.y + cam.z + cam.yaw + cam.pitch + cam.fov), 'the camera of the scene: a fixed shot (' + (cam && [cam.x, cam.y, cam.z].map(v => v.toFixed(1)).join(', ')) + ')');
  check(box && /Mensch|geschlafen|Leuchtfeuer/.test(box.querySelector('.sub').textContent), 'the subtitle shows Funke\'s line');
  check(g.story.skip() && !SP.holds(g) && SP.debug.state().beats['c1.b1'] === 'skip', 'any key after 1 s skips: the beat counts as seen (skip)');
  check(said.some(t => /Ausblick/.test(t)) && g.__saved > 0, 'then the task: Funke\'s line, and the record saved');
  check(/Funke und die Leuchtfeuer/.test(SP.journalHTML()) && /geschlafen/.test(SP.journalHTML()), 'the journal\'s chapter page has the book and the lines seen');
  g.lifeDirector.ctx.place = 'hills'; run(40);
  check(!SP.debug.state().offer, 'the next beat waits 5 min after the last (the Regie)');
  const t2 = until('c1.b2', 330);
  check(SP.debug.state().offer === 'c1.b2', `c1.b2 offered out on the hills after the 5 min (at ${t2.toFixed(0)} s)`);
  S.watch(g); let n = 0; while (SP.holds(g) && n++ < 40 * 20) run(0.05);
  check(!SP.holds(g) && SP.debug.state().beats['c1.b2'] === 'done' && n * 0.05 <= 31, `a scene ends by itself (${(n * 0.05).toFixed(1)} s ≤ 30 s)`);
  g.settings.storyOffer = false; run(400);
  check(!SP.debug.state().offer, '⚙ storyOffer off: nothing offered');
  g.meta.guest = true; g.settings.storyOffer = true; run(400);
  check(!SP.debug.state().offer && !S.watch(g), 'a guest: no offer, no scene');
}

// ---------------------------------------------------------------- a-story2 (plan docs/superpowers/plans/2026-10-30-a-story2.md)
console.log('9 · the speakers\' faces (src/main/story_art.js, VR.Portrait)');
check(Array.isArray(S.MOODS) && ['neutral', 'happy', 'surprised', 'worried'].every(m => S.MOODS.includes(m)), 'four moods: neutral, happy, surprised, worried');
check(S.BEATS.every(b => b.scene.lines.every(l => S.MOODS.includes(l.mood))), 'every line has a mood');
const moodsUsed = new Set(); for (const b of S.BEATS) for (const l of b.scene.lines) moodsUsed.add(l.mood);
check(moodsUsed.size === 4, 'the book uses all four moods (' + [...moodsUsed].join(', ') + ')');
if (!fs.existsSync(SRC + 'main/story_art.js')) check(false, 'src/main/story_art.js missing');
else {
  if (!VR.M) VR.M = { hash3: (x, y, z, s) => (((x * 73856093) ^ (y * 19349663) ^ (z * 83492791) ^ (s * 2654435761)) >>> 0) };
  require(SRC + 'main/voxmodels.js'); require(SRC + 'main/story_art.js');
  const Po = VR.Portrait;
  check(!!Po && typeof Po.ops === 'function' && typeof Po.paint === 'function', 'VR.Portrait.ops / paint');
  const N = Po.N || 24; let inGrid = true, okCol = true, moodDiff = true, blinkDiff = true, mouthDiff = true;
  const key = (o) => JSON.stringify(o);
  const pal = {};
  for (const w of S.WHO) {
    const seen = new Set();
    for (const m of S.MOODS) {
      const o = Po.ops(w, m, false, false);
      for (const r of o) { if (r[0] < 0 || r[1] < 0 || r[2] <= 0 || r[3] <= 0 || r[0] + r[2] > N || r[1] + r[3] > N) inGrid = false; if (!/^#[0-9a-f]{6}$/i.test(r[4])) okCol = false; }
      seen.add(key(o));
      if (key(Po.ops(w, m, true, false)) === key(o)) blinkDiff = false;
      if (key(Po.ops(w, m, false, true)) === key(o)) mouthDiff = false;
    }
    if (seen.size !== S.MOODS.length) moodDiff = false;
    pal[w] = new Set(Po.ops(w, 'neutral', false, false).map(r => r[4].toLowerCase()));
  }
  check(inGrid && okCol, `every speaker × mood: rects inside the ${N} × ${N} grid, colours #rrggbb`);
  check(moodDiff, 'each speaker\'s four moods are four different faces');
  check(blinkDiff && mouthDiff, 'a blink and an open mouth change every face (the animation)');
  let palOk = true; const ws = S.WHO; for (let i = 0; i < ws.length; i++) for (let j = i + 1; j < ws.length; j++) { const a = pal[ws[i]], b = pal[ws[j]]; let sh = 0; for (const c of a) if (b.has(c)) sh++; if (sh > 0.6 * Math.min(a.size, b.size)) palOk = false; }
  check(palOk, 'six faces, six palettes (no two share most colours)');
  check(S.WHO.every(w => Po.ops(w, 'neutral', false, false).length >= 20), 'each face is drawn of ≥ 20 rects (' + S.WHO.map(w => Po.ops(w, 'neutral', false, false).length).join(' ') + ')');
  // the animation: blink every 2.4–4.2 s for ~0.13 s, the mouth while the line is spoken (its first 75 %)
  let bl = 0, mo = 0, moLate = 0;
  for (let t = 0; t < 20; t += 0.02) { const a = Po.anim('lumi', t, 4); if (a.blink) bl++; if (a.mouth && t < 3) mo++; if (a.mouth && t > 3.1 && t < 4) moLate++; }
  check(bl > 0 && bl * 0.02 < 1.6 && mo > 20 && moLate === 0, `the animation: blink ${(bl * 0.02).toFixed(2)} s of 20, mouth open ${(mo * 0.02).toFixed(1)} s while speaking, ${moLate} after`);
  // the painter on a stand-in canvas
  const calls = []; const cv = { width: 0, height: 0, getContext: () => ({ fillStyle: '', clearRect() { calls.push('clear'); }, fillRect(x, y, w, h) { calls.push([x, y, w, h, this.fillStyle]); } }) };
  Po.paint(cv, Po.ops('funke', 'happy', false, true));
  check(cv.width === N && calls[0] === 'clear' && calls.length > 25, 'paint: a ' + N + ' × ' + N + ' canvas, cleared, one fillRect a rect');

  console.log('11 · the Eiswächter\'s own model');
  const M = VR.VOXMODELS, def = M && M.story_warden ? M.story_warden() : null;
  check(!!def && def.parts.whole && def.parts.optic && def.layout.optic, 'story_warden: the body whole, the eye a part of its own');
  if (def) {
    const g = def.parts.whole.grid; let n = 0, blue = 0, ymax = 0;
    for (let y = 0; y < g.sy; y++) for (let z = 0; z < g.sz; z++) for (let x = 0; x < g.sx; x++) { const c = g.c[g.i(x, y, z)]; if (!c) continue; n++; ymax = Math.max(ymax, y); const r = (c >> 16) & 255, gg = (c >> 8) & 255, b = c & 255; if (b > r + 20 && b >= gg) blue++; }
    check(g.sy >= 36 && g.sy > 2.2 * g.sx * 0.5, `tall: ${g.sx} × ${g.sy} × ${g.sz} voxels`);
    check(n > 1500 && blue / n > 0.6, `crystalline ice colours: ${(100 * blue / n).toFixed(0)} % of ${n} voxels blue`);
    check(Math.abs(def.h - g.sy / 16) < 0.3, 'its height h = ' + def.h + ' blocks');
    const fd = M.story_icewin ? M.story_icewin() : null;
    check(!!fd && fd.parts.win && fd.parts.veil, 'the ice window: the clear disc and its veil (cracks)');
  }
}

console.log('10 · the deeds between the beats');
const KINDS = ['look', 'scan', 'touch', 'photo', 'feat'];
check(S.BEATS.every(b => b.act && KINDS.includes(b.act.kind) && (b.act.target || b.act.kind === 'feat')), 'every beat of chapters 1–4 has one deed (look · scan · touch · photo)');
const kindsUsed = new Set(S.BEATS.map(b => b.act.kind));
check(kindsUsed.size === 5, 'all five kinds are used (' + [...kindsUsed].join(', ') + ')');
const actKeys = S.BEATS.map(b => 'story.act.' + b.id).concat(['story.act.done', 'story.ctx.scan', 'story.ctx.touch', 'story.act.scanning']);
check(actKeys.every(k => tr('de', k) && tr('en', k) && tr('de', k) !== tr('en', k)), 'every deed\'s words in both tables (German first)');
check(S.byId('c4.b3').act.kind === 'photo' && S.byId('c2.b1').act.kind === 'touch' && S.byId('c1.b2').act.kind === 'scan', 'photograph the eclipse, touch the beacon, scan with Funke');
const lk = S.byId('c1.b1').act, sn = S.byId('c1.b2').act, tc = S.byId('c2.b1').act, ph = S.byId('c4.b3').act;
check(S.actCheck(lk, { ang: 5, dist: 100 }) === 'ok' && S.actCheck(lk, { ang: 40, dist: 100 }) === 'ang' && S.actCheck(lk, { ang: 5, dist: 9999 }) === 'far' && S.actCheck(lk, { dist: 100 }) === 'none', 'look: in the cone and in reach, else why');
check(S.actCheck(sn, { ang: 8, dist: 300 }) === 'armed' && S.actCheck(sn, { ang: 8, dist: 300, press: true }) === 'ok' && S.actCheck(sn, { ang: 60, dist: 300, press: true }) === 'ang', 'scan: armed when aimed, done with [V]');
check(S.actCheck(tc, { dist: 2.5 }) === 'armed' && S.actCheck(tc, { dist: 9 }) === 'far' && S.actCheck(tc, { dist: 2.5, press: true }) === 'ok', 'touch: armed within reach, done with [V]');
check(S.actCheck(ph, { dim: 'opal', eclipse: 0.8 }) === 'armed' && S.actCheck(ph, { dim: 'opal', eclipse: 0.8, photo: true }) === 'ok' && S.actCheck(ph, { dim: 'opal', eclipse: 0.1, photo: true }) === 'eclipse' && S.actCheck(ph, { dim: 'overworld', eclipse: 0.9, photo: true }) === 'dim', 'photo: the eclipse, a picture taken, on a moon');
const sky = S.byId('c2.b3').act;
check(S.actCheck(sky, { pitch: 50, press: true }) === 'ok' && S.actCheck(sky, { pitch: 5, press: true }) === 'pitch', 'scan the sky: the view up ≥ ' + sky.pitch + '°');
const st = {}; let doneAt = -1;
for (let i = 0; i < 100; i++) { const tt = i * 0.25, a = { ang: tt < 1 || (tt > 1.5 && tt < 2) ? 40 : 4, dist: 50 }; if (S.actStep(st, lk, a, 0.25)) { doneAt = tt; break; } }
check(doneAt > 3 && doneAt < 4.5, `look holds ${lk.hold} s unbroken (looking away resets): done at ${doneAt} s`);
const ra = S.fresh();
check(S.openAct(ra) === null, 'no deed before a beat is seen');
S.mark(ra, 'c1.b1');
check(S.openAct(ra) && S.openAct(ra).id === 'c1.b1', 'after c1.b1: its deed is open');
S.mark(ra, 'c1.b2');
check(S.openAct(ra).id === 'c1.b2', 'the open deed is the last seen beat\'s');
S.markAct(ra, 'c1.b2');
check(S.openAct(ra) === null && S.actDone(ra, 'c1.b2') && !S.actDone(ra, 'c1.b1'), 'done: recorded; an older deed is not forced');
const rl = S.load(JSON.parse(JSON.stringify(Object.assign({}, ra, { acts: Object.assign({ 'c9.b9': 1, 'c2.b2': 'x' }, ra.acts) }))));
check(rl.acts['c1.b2'] === 1 && !rl.acts['c9.b9'] && !rl.acts['c2.b2'] && JSON.stringify(S.load(JSON.parse(JSON.stringify(rl)))) === JSON.stringify(rl), 'the record keeps the deeds (sanitised, a round trip)');
check(S.next(ra, calm({ place: 'hills', adv: true, near: { outpost: 300 } }), 0) && S.next(ra, calm({ place: 'hills', adv: true, near: { outpost: 300 } }), 0).id === 'c1.b3', 'a deed never holds the story back');


console.log('12 · the deeds and the faces in the player (a stand-in game)');
{
  const said = [];
  const g = { state: 'play', world: {}, time: 0, dim: 'overworld', settings: { storyOffer: true }, meta: { seed: 7, story: { v: 1, beats: { 'c1.b1': 'done' }, later: {} } }, ui: { screen: null },
    player: { pos: [0, 70, 0], yaw: 0, pitch: 0, spawn: [0, 70, 0], onGround: true, eyePos() { return [0, 71.6, 0]; } },
    cam: { x: 0, y: 71.6, z: 0, yaw: Math.PI / 2, pitch: 0 },
    wow: { list: new Map([['v', { x: 0, y: 75, z: -200 }]]) },
    funke: { on: () => true, show: (t) => said.push(t), budget: { quiet: () => false }, buildFocus: () => false, startWay: () => {} },
    lifeDirector: { ctx: { place: 'hills', hour: 'noon' } }, saveMeta: () => {} };
  VR.game = g;
  const run = (sec) => { for (let i = 0; i < sec * 20; i++) { g.time += 0.05; SP.frame(g, 0.05); } };
  run(3);
  check(!SP.of(g).rec.acts['c1.b1'], 'the vista to the side: the look is not done (' + SP.of(g).actSt.last + ')');
  g.cam.yaw = 0; g.cam.pitch = Math.atan2(75 + 1 - 71.6, 200.5); run(1.0);
  check(!SP.of(g).rec.acts['c1.b1'], 'looking at it: not yet after 1 s');
  run(1.0);
  check(SP.of(g).rec.acts['c1.b1'] === 1 && said.some(t => /Tagebuch/.test(t)), 'held 1.5 s: the deed is done, Funke says so, it is in the record');
  check(/✓/.test(SP.journalHTML()), 'the journal shows it ✓');
  // c1.b2's deed: scan the outpost with Funke ([V] through ctx row 3)
  VR.Liberate = { sites: () => new Map([['o', { x: 300, y: 70, z: 0, st: 'wild', beacon: [300, 72, 0] }]]) };
  S.mark(SP.of(g).rec, 'c1.b2'); g.cam.yaw = 0; g.cam.pitch = 0; run(1);
  check(!SP.armedAct(g) && /☐/.test(SP.journalHTML()), 'the outpost behind the view: not armed; the journal shows ☐');
  g.cam.yaw = -Math.PI / 2; run(1);
  const ar = SP.armedAct(g);
  check(!!(ar && ar.storyAct === 'scan'), 'aimed at the outpost: the deed is armed — row 3 says „Scannen" (' + (ar && ar.storyAct) + ')');
  check(S.watch(g) && SP.of(g).rec.acts['c1.b2'] === 1 && said.some(t => /Scanne/.test(t)), '[V]: Funke scans, the deed is done');
  // the faces in a scene
  SP.debug.play('c2.b2'); run(1.5);
  const sc = SP.of(g).scene;
  check(sc && sc.por && sc.por.who === 'funke' && sc.por.mood === 'happy', 'a scene: the subtitle has the speaker\'s face (' + (sc && sc.por && sc.por.who + ' · ' + sc.por.mood) + ')');
  const p0 = SP.stats.porPaints || 0; run(2);
  const p1 = SP.stats.porPaints || 0;
  check(p1 > p0 && p1 - p0 < 2 * 20, `the face moves (${p1 - p0} repaints in 2 s — only when the blink or the mouth changes, ≤ 20 a second)`);
  while (SP.holds(g)) run(0.5);
  g.settings.storyOffer = false; S.mark(SP.of(g).rec, 'c2.b2'); g.cam.pitch = 0.9; run(1);
  check(!SP.armedAct(g), '⚙ storyOffer off: no deed armed');
}

// ---------------------------------------------------------------- a-story3 (plan docs/superpowers/plans/2026-10-31-a-story3.md)
console.log('13 · a-story3: chapters 5–8 written in full');
{
  check(S.CHAPTERS.every(c => c.written), 'all twelve chapters written (a-story4)');
  const nb = S.BEATS.filter(b => b.ch >= 5 && b.ch <= 8);
  check(nb.length === 12 && nb.every(b => S.sceneLen(b) <= 25 && S.sceneLen(b) >= 10), 'twelve new beats, every scene 10–25 s (' + nb.map(b => S.sceneLen(b)).join(' ') + ')');
  check(nb.every(b => b.when.adv === true), 'chapters 5–8 play in Abenteuer worlds');
  for (const w of ['solgani', 'ariveli', 'selkatun', 'anselm']) check(S.WHO.includes(w) && nb.some(b => S.linesOf(b, { choices: { c6: 'lumi' } }).concat(S.linesOf(b, { choices: { c6: 'wellari' } })).some(l => l.who === w)), 'a new speaker: ' + w);
  check(nb.every(b => b.scene.lines.length >= 3 && b.scene.lines.length <= 5), 'three to five lines a scene');
  check(nb.filter(b => b.scene.fx || b.scene.shots.some(q => q.fx)).length >= 6 && nb.filter(b => b.scene.shots.some(q => q.swell)).length >= 4, 'the film\'s own pictures (fx) and the score\'s swells');
  const vary = nb.filter(b => b.vary === 'c6');
  check(vary.length >= 3 && vary.every(b => Object.keys(b.scene.alt).join() === 'wellari,lumi'), 'the choice changes the lines of ' + vary.map(b => b.id).join(', '));
  const la = S.linesOf(S.byId('c7.b2'), { choices: { c6: 'lumi' } }), lw = S.linesOf(S.byId('c7.b2'), { choices: { c6: 'wellari' } });
  check(la.some(l => l.who === 'lumi') && !lw.some(l => l.who === 'lumi') && la.every(l => /\.lumi\.\d$/.test(l.key)), 'at the Ringstation Lumi is there only when she came along');
  const ck = S.keys();
  const miss = ck.filter(k => !tr('de', k) || !tr('en', k)), sameDE = ck.filter(k => /story\.(c[5-8]\.b|choice)/.test(k) && tr('de', k) === tr('en', k));
  check(!miss.length && ck.length > 140, ck.length + ' keys (variants and the choice included) in both tables' + (miss.length ? ': missing ' + miss.slice(0, 8).join(', ') : ''));
  check(!sameDE.length, 'every new German line is German' + (sameDE.length ? ': ' + sameDE.slice(0, 5).join(', ') : ''));
  check(nb.every(b => tr('de', 'story.act.' + b.id) && tr('en', 'story.act.' + b.id) && tr('de', 'story.task.' + b.task.kind)), 'every new deed and task in the tables');
  const longL = ck.filter(k => /story\.c[5-8]\./.test(k) && /\.\d$/.test(k) && (tr('de', k) || '').length > 120);
  check(!longL.length, 'every new line short enough to read (≤ 120 characters) ' + longL.join(', '));


  if (VR.StoryFx) {
    const Fx = VR.StoryFx, used = new Set(); for (const b of S.BEATS) for (const q of b.scene.shots) if (q.fx) used.add(q.fx);
    check([...used].every(k => Fx.KINDS.includes(k)), 'every fx a scene asks for is drawn (' + [...used].join(' ') + ')');
    let n = 0, err = '';
    const grad = { addColorStop() {} };
    const mc = new Proxy({}, { get: (o, k) => (k in o ? o[k] : (k === 'createRadialGradient' || k === 'createLinearGradient') ? () => grad : () => { n++; }), set: (o, k, v) => { o[k] = v; return true; } });
    for (const k of Fx.KINDS) for (const low of [false, true]) for (const t of [0, 3.3, 8]) { try { Fx.draw(mc, k, t, (t / 8) % 1, 640, 360, { low }); } catch (e) { err = k + ': ' + e.message; } }
    check(!err && n > 200, 'the fx draw on a 2-D canvas, full and Very Low (' + (err || n + ' calls') + ')');
    let nl = 0, nh = 0; const cnt = (low) => { const c0 = n; for (const k of Fx.KINDS) Fx.draw(mc, k, 2, 0.5, 640, 360, { low }); return n - c0; };
    nh = cnt(false); nl = cnt(true);
    check(nl < nh, `Very Low draws fewer (${nl} < ${nh} calls a frame of all kinds)`);
  }
  console.log('14 · a-story3: a scripted run through every beat of 5–8, both choices');
  const ctxFor = (b) => {
    const w = b.when, c = calm({ adv: true, calm: 30 });
    if (w.dim) c.dim = w.dim[0].replace('*', w.dim[0] === 'x.*' ? '7.2.aqua' : 'ring');
    if (w.near) for (const k of Object.keys(w.near)) c.near[k] = w.near[k] - 5;
    if (w.suns) c.suns = w.suns;
    return c;
  };
  for (const opt of ['wellari', 'lumi']) {
    const r = S.fresh(); for (const b of S.BEATS) if (b.ch <= 4) S.mark(r, b.id);
    let walked = 0, bldBad = 0, path = [];
    for (let i = 0; i < 40; i++) {
      const b = S.open(r); if (!b || b.ch > 8) break;
      const c = ctxFor(b);
      if (S.choicePending(r)) {
        check(S.why(b, c, r) === 'choice' && S.next(r, c, 0) === null, b.id + ' waits for the choice');
        check(S.choiceReady(r, Object.assign({}, c, { building: true })) === null && S.choiceReady(r, Object.assign({}, c, { calm: 3 })) === null && S.choiceReady(r, c) === 'c6', 'the choice card: only on a calm screen, never while building');
        check(!S.choose(r, 'c6', 'nobody') && S.choose(r, 'c6', opt) && !S.choose(r, 'c6', opt === 'lumi' ? 'wellari' : 'lumi') && r.choices.c6 === opt, 'chosen: ' + opt + ' (once; another option or a second choice refused)');
      }
      if (S.ready(b, Object.assign({}, c, { building: true }), r) || S.ready(b, Object.assign({}, c, { fighting: true }), r)) bldBad++;
      if (!S.ready(b, c, r)) { check(false, b.id + ' not reachable: ' + S.why(b, c, r)); break; }
      path.push(b.id); S.mark(r, b.id); walked++;
    }
    check(walked >= 12 && path[0] === 'c5.b1' && path[11] === 'c8.b3' && !bldBad && S.chapter(r) === 9, `${opt}: all twelve beats reached in order (${path.length}), none while building or fighting, chapter 9 next`);
    const back = S.load(JSON.parse(JSON.stringify(r)));
    check(back.choices.c6 === opt && S.linesOf(S.byId('c8.b2'), back).every(l => l.key.indexOf('.' + opt + '.') > 0), 'the choice persists through a save (' + opt + ') and picks chapter 8\'s helper');
  }
  check(S.why(S.byId('c5.b1'), calm({ dim: 'overworld' }), (() => { const r = S.fresh(); for (const b of S.BEATS) if (b.ch <= 4) S.mark(r, b.id); return r; })()) === 'dim', 'chapter 5 waits for Zinnober');
  const r7 = S.fresh(); for (const b of S.BEATS) if (b.id !== 'c7.b2') S.mark(r7, b.id); else break; r7.choices.c6 = 'lumi';
  check(S.why(S.byId('c7.b2'), calm({ dim: 'overworld' }), r7) === 'dim' && S.why(S.byId('c7.b2'), calm({ dim: 'stn.ring' }), r7) === null && S.why(S.byId('c7.b2'), calm({ dim: 'stn.basalt' }), r7) === null, 'c7.b2 at a station (stn.*)');
  S.mark(r7, 'c7.b2');
  check(S.why(S.byId('c7.b3'), calm({ dim: 'stn.ring' }), r7) === 'dim' && S.why(S.byId('c7.b3'), calm({ dim: 'x.3.1.ocker' }), r7) === null, 'c7.b3 at another star (x.*)');
  S.mark(r7, 'c7.b3');
  check(S.why(S.byId('c8.b1'), calm({ dim: 'x.3.1.ocker', suns: 1 }), r7) === 'suns' && S.why(S.byId('c8.b1'), calm({ dim: 'x.3.1.ocker', suns: 2 }), r7) === null, 'chapter 8 under two suns (a close double star)');
  check(S.why(S.byId('c8.b1'), calm({ dim: 'x.3.1.ocker', suns: 2, sunUp: false }), r7) === 'sun' && S.why(S.byId('c8.b1'), calm({ dim: 'x.3.1.ocker', suns: 2, sunUp: true }), r7) === null, 'two suns are seen by day: c8.b1 waits for the morning');
  const junk = S.load({ v: 1, beats: {}, choices: { c6: 'pirates', c9: 'lumi', x: 1 } });
  check(JSON.stringify(junk.choices) === '{}' && JSON.stringify(S.load({ v: 1, beats: {} }).choices) === '{}', 'the record sanitises the choices (an old world: none)');
  // never during building: 3,000 random contexts on 5–8 (and the choice card)
  let bad3 = 0, rd3 = 0, cbad = 0;
  const DM3 = ['zinn', 'aqua', 'stn.ring', 'x.4.2.aqua', 'overworld'];
  for (let i = 0; i < 3000; i++) {
    const rec = S.fresh(), k = 12 + Math.floor(rnd() * 12); for (let j = 0; j < k; j++) S.mark(rec, S.BEATS[j].id);
    if (rnd() < 0.5) rec.choices.c6 = rnd() < 0.5 ? 'lumi' : 'wellari';
    const c = { calm: rnd() * 60, building: rnd() < 0.3, fighting: rnd() < 0.3, menu: rnd() < 0.1, landing: rnd() < 0.1, adv: true, dim: DM3[Math.floor(rnd() * 5)], near: { village: rnd() * 200, outpost: 999 }, suns: 1 + (rnd() < 0.5 ? 1 : 0) };
    for (const b of S.BEATS) if (b.ch >= 5 && b.ch <= 8 && S.ready(b, c, rec)) { rd3++; if (c.building || c.fighting || c.menu || c.landing || c.calm < S.CALM_ADV) bad3++; }
    if (S.choiceReady(rec, c) && (c.building || c.fighting || c.menu || c.landing || c.calm < S.CALM_ADV)) cbad++;
  }
  check(rd3 > 50 && !bad3 && !cbad, `3,000 contexts on 5–8: ${rd3} ready, ${bad3} beats and ${cbad} choice cards while busy`);
}

console.log('15 · a-story3: the player — the choice card, the variant lines, the gate that turns aside');
{
  const said = [], saves = [];
  const done = {}; for (const b of S.BEATS) { done[b.id] = 'done'; if (b.id === 'c6.b3') break; }
  const g = { state: 'play', world: {}, time: 0, dim: 'aqua', settings: { storyOffer: true }, meta: { seed: 9, story: { v: 1, beats: done, later: {} } }, ui: { screen: null },
    player: { pos: [0, 70, 0], yaw: 0, pitch: 0, spawn: [0, 70, 0], onGround: true, eyePos() { return [0, 71.6, 0]; } },
    cam: { x: 0, y: 71.6, z: 0, yaw: 0, pitch: 0 }, wow: { list: new Map() },
    funke: { on: () => true, show: (t) => said.push(t), budget: { quiet: () => false }, buildFocus: () => g._build, startWay: () => {} },
    lifeDirector: { ctx: { place: 'water', hour: 'noon' } }, saveMeta: () => saves.push(1) };
  VR.game = g; VR.Adventure = { on: () => true };
  const run = (sec) => { for (let i = 0; i < sec * 20; i++) { g.time += 0.05; SP.frame(g, 0.05); } };
  run(0.1); const pl = SP.of(g);
  g._build = true; run(30);
  check(!pl.choiceUp, 'building: no choice card (' + pl.lastWhy + ')');
  g._build = false; run(12);
  check(!!pl.choiceUp && pl.choiceUp.id === 'c6', 'calm again: the choice card is up (' + pl.lastWhy + ')');
  g._build = true; run(1);
  check(!pl.choiceUp, 'building begins: the card steps back');
  g._build = false; run(12);
  check(!!pl.choiceUp && SP.choose(g, 'lumi') && pl.rec.choices.c6 === 'lumi' && !pl.choiceUp && saves.length && said.some(t => /Lumi/.test(t)), 'chosen: Lumi comes along — saved, Funke says so');
  check(g.meta.story.choices.c6 === 'lumi', 'the choice is in the world\'s record');
  SP.debug.play('c7.b2'); run(0.5);
  const sc = pl.scene;
  check(sc && sc.lines.some(l => l.who === 'lumi') && sc.texts.length === sc.lines.length && sc.lines[0].key.indexOf('.lumi.') > 0, 'c7.b2 with Lumi: her lines play (' + (sc && sc.lines.map(l => l.who).join(' ')) + ')');
  while (SP.holds(g)) run(0.5);
  // the gate that turns aside: with c7.b2 open, a trip through a Leuchtpfad gate to a world ends at the Ringstation
  const r = pl.rec; r.beats['c7.b1'] = 'done'; delete r.beats['c7.b2']; delete r.beats['c7.b3'];
  for (const k of Object.keys(r.beats)) if (/^c[78]\./.test(k) && k !== 'c7.b1') delete r.beats[k];
  check(S.open(r).id === 'c7.b2', 'c7.b2 open');
  const t1 = SP.gateTurn(g, { dim: 'zinn', id: 'zinn' }), t2 = SP.gateTurn(g, { dim: 'stn.ring' }), t3 = SP.gateTurn(g, { dim: 'x.3.1.aqua' });
  check(t1 && t1.dim === 'stn.ring' && !t2 && !t3, 'a gate trip to Zinnober turns aside to the Ringstation (not one to a station or another star)');
  r.beats['c7.b2'] = 'done';
  check(!SP.gateTurn(g, { dim: 'zinn' }), 'once seen: the gates go where you aim again');
  g.ui.screen = 'journal';
  check(/Lumi/.test(SP.journalHTML()), 'the journal names the choice');
}

require(path.join(__dirname, '../test/story4_part.js'))(S, SP, tr, calm, check, rnd);
require(path.join(__dirname, '../test/story5_part.js'))(S, SP, tr, calm, check, rnd);   // a-story5
require(path.join(__dirname, '../test/story6_part.js'))(S, SP, tr, calm, check, rnd);   // u-stations2
require(path.join(__dirname, '../test/story7_part.js'))(S, SP, tr, calm, check, rnd);   // f-polish4

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

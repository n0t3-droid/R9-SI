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
for (let c = 1; c <= 4; c++) { const bs = S.ofChapter(c); check(bs.length === 3 && bs.every((b, i) => b.n === i + 1), `chapter ${c}: three beats in order`); }
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
check(keys.every(k => !/\bEcho\b/.test(tr('de', k) || '') || /c11/.test(k)), 'Echo is named only in chapter 11');

console.log('2 · when');
const calm = (o) => Object.assign({ calm: 30, place: 'hangar', hour: 'noon', played: 60, adv: true, dim: 'overworld', near: { outpost: 9999 }, freed: 0, high: 0, orbit: false, eclipse: 0 }, o || {});
const rec0 = S.fresh(), b1 = S.byId('c1.b1');
check(S.why(b1, calm(), rec0) === null, 'c1.b1 is offered in the Hangar Hall after 20 s of calm');
const reasons = [['calm', { calm: 19.9 }], ['building', { building: true }], ['fight', { fighting: true }], ['menu', { menu: true }], ['studio', { studio: true }], ['landing', { landing: true }], ['scene', { scene: true }], ['guest', { guest: true }], ['place', { place: 'plaza', played: 100 }], ['dim', { dim: 'basalt' }]];
for (const [r, o] of reasons) check(S.why(b1, calm(o), rec0) === r, `c1.b1 not offered: ${r}`);
check(S.why(b1, calm({ place: 'plaza', played: 260 }), rec0) === null, 'c1.b1 anywhere after 4 minutes in a world without a Hangar Hall');
check(S.why(b1, calm({ adv: false }), rec0) === null, 'chapter 1 begins in a builder world too (an offer only)');
const r1 = S.fresh(); S.mark(r1, 'c1.b1');
const b2 = S.byId('c1.b2');
check(S.why(b2, calm({ place: 'hills' }), rec0) === 'after' && S.why(b2, calm({ place: 'hills' }), r1) === null, 'c1.b2 after c1.b1, out on the hills');
check(S.why(b2, calm({ place: 'hills', hour: 'night' }), r1) === 'hour', 'c1.b2 waits for the day (its vista)');
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
check(S.open(r1) === null && S.chapter(r1) === 5 && S.next(r1, calm(), 0) === null, 'all twelve beats seen: chapter 5 waits (nothing more offered)');
check(S.why(S.byId('c1.b1'), calm(), r1) === 'done', 'a seen beat is never offered again');

console.log('3 · never during building or a fight');
let x = 0x2545F491; const rnd = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
const PL = ['hangar', 'plaza', 'street', 'hall', 'hills', 'isles', 'water', 'wild'], HR = ['dawn', 'morning', 'noon', 'afternoon', 'dusk', 'night'], DM = ['overworld', 'overworld', 'basalt', 'opal'];
let bad = 0, readyN = 0, calmBad = 0;
for (let i = 0; i < 3000; i++) {
  const rec = S.fresh(), k = Math.floor(rnd() * 12); for (let j = 0; j < k; j++) S.mark(rec, S.BEATS[j].id);
  const c = { calm: rnd() * 60, building: rnd() < 0.3, fighting: rnd() < 0.3, menu: rnd() < 0.1, landing: rnd() < 0.1, place: PL[Math.floor(rnd() * 8)], hour: HR[Math.floor(rnd() * 6)], played: rnd() * 600, adv: rnd() < 0.7, dim: DM[Math.floor(rnd() * 4)], near: { outpost: rnd() * 1000 }, freed: Math.floor(rnd() * 2), high: rnd() * 2000, orbit: rnd() < 0.2, eclipse: rnd() };
  for (const b of S.BEATS) { if (S.ready(b, c, rec)) { readyN++; if (c.building || c.fighting || c.menu || c.landing) bad++; if (c.calm < 20) calmBad++; } }
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
const steps = [calm({ place: 'hall', calm: 5 }), calm({ place: 'hangar' }), calm({ place: 'hangar' }), calm({ place: 'hills', hour: 'night' }), calm({ place: 'hills', hour: 'dusk' }), calm({ place: 'wild', near: { outpost: 650 } }), calm({ place: 'wild', near: { outpost: 100 } })];
for (const c of steps) { t += 400; const b = S.next(r7, c, t); if (b) { got.push(b.id); S.mark(r7, b.id); } }
check(got.join(' ') === 'c1.b1 c1.b2 c1.b3 c2.b1', 'the beats as their places come: ' + got.join(' '));

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

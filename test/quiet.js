// f-quiet · the calm screen without a browser (plan docs/superpowers/plans/2026-10-31-f-quiet.md):
//   a · the notice manager: two lines at most, 3.6 s each, priorities by the ⚙ Hinweise level, the same text merged
//       (×2) or dropped within 30 s, Wenig's rate limit (one normal notice per 6 s, the rest waits ≤ 12 s), a must-see
//       one takes the place of a lower one, the hold of a cinematic scene (low ones dropped, the rest after it), history
//   b · the toast's priority (discoveries low, a quest done must-see), the hint's (right after a key: must-see)
//   c · the look detector (standing, turning round a view) and Funke's unprompted lines by level: one per 3 min,
//       none while building, looking round, in a cinematic, or at Aus
//   d · the 🧭 hints: Normal always, Wenig in a world's first 5 min only, Aus never
//   e · the Aktion prompt: no standing „[V] Funke fragen" (V still asks Funke), every prompt gone after 2 s
//   f · the setting (Normal / Wenig default / Aus) in the registry; the texts in both tables
// Run: bash test/wt_run.sh quiet.js 300
require('./dom_stub.js');
const V = require('./load_shared.js');
globalThis.VR = V;
for (const f of ['i18n', 'lang_en', 'lang_de']) require(__dirname + '/../src/main/' + f + '.js');
require('../src/main/settings_reg.js');
require('../src/main/funke.js');
require('../src/main/ctx.js');
require('../src/main/quiet.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const Q = VR.Quiet;
check(!!Q && typeof Q.Notes === 'function', 'VR.Quiet.Notes exists');
if (!Q || !Q.Notes) { console.log('FAILED ' + (fails || 1)); process.exit(1); }

console.log('a · the notice manager');
{
  const N = new Q.Notes({ level: 'normal' });
  check(Q.LIFE >= 3 && Q.LIFE <= 4 && Q.MAX_VIS === 2, `a line lives ${Q.LIFE} s (3–4), at most ${Q.MAX_VIS} at once`);
  check(N.push({ text: 'A', prio: 2 }, 0) === 'shown' && N.visible(0).length === 1, 'a notice shows');
  check(N.push({ text: 'A', prio: 2 }, 1) === 'merged' && N.visible(1)[0].count === 2, 'the same text while it shows: merged (×2)');
  N.push({ text: 'B', prio: 2 }, 2.5);
  check(N.push({ text: 'C', prio: 1 }, 2.6) === 'queued' && N.visible(2.6).length === 2, 'a third waits: never more than two lines');
  N.tick(5.2);
  check(N.visible(5.2).map(e => e.text).join() === 'B,C', 'A gone after its time, C moves up: ' + N.visible(5.2).map(e => e.text).join());
  N.tick(20);
  check(N.visible(20).length === 0, 'all gone after their time');
  check(N.push({ text: 'A', prio: 2 }, 22) === 'dropped', 'the same text again within 30 s: dropped');
  check(N.push({ text: 'A', prio: 2 }, 40) === 'shown', '… and after 30 s it may come again');
  // a key replaces its own line in place (the hint line, a status that updates)
  const K = new Q.Notes({ level: 'normal' });
  K.push({ text: 'Lädt 10 %', prio: 2, key: 'hint' }, 0);
  check(K.push({ text: 'Lädt 50 %', prio: 2, key: 'hint' }, 1) === 'merged' && K.visible(1).length === 1 && K.visible(1)[0].text === 'Lädt 50 %', 'a keyed line is replaced in place');
  K.remove('hint', 1.5);
  check(K.visible(1.5).length === 0, 'remove(key) takes it away');
  // levels
  const lv = (level, prio) => new Q.Notes({ level }).push({ text: 'x' + prio, prio }, 0);
  check(lv('normal', 1) === 'shown' && lv('few', 1) === 'dropped' && lv('few', 2) === 'shown' && lv('off', 2) === 'dropped' && lv('off', 3) === 'shown', 'levels: Normal 1+, Wenig 2+, Aus only 3 (must-see)');
  check(Q.DEF === 'few' && Q.LEVELS.join() === 'normal,few,off', 'the default is Wenig');
  // Wenig's rate limit
  const W = new Q.Notes({ level: 'few' });
  const r = [W.push({ text: 'q1', prio: 2 }, 0), W.push({ text: 'q2', prio: 2 }, 1), W.push({ text: 'q3', prio: 2 }, 2), W.push({ text: 'q4', prio: 2 }, 3)];
  check(r.join() === 'shown,queued,queued,dropped', 'Wenig: one new normal notice per ' + Q.GAP_FEW + ' s, two may wait, more drop: ' + r.join());
  W.tick(6.1);
  check(W.visible(6.1).map(e => e.text).join() === 'q2', 'the waiting one shows after the gap: ' + W.visible(6.1).map(e => e.text).join());
  W.tick(30);
  check(W.visible(30).length === 0 && W.stats.expired >= 1, 'a waiting one older than ' + Q.WAIT + ' s is let go (' + W.stats.expired + ')');
  check(W.push({ text: 'must', prio: 3 }, 30.5) === 'shown' && W.push({ text: 'must2', prio: 3 }, 30.6) === 'shown', 'must-see notices are never rate-limited');
  W.push({ text: 'must3', prio: 3 }, 30.7);
  check(W.visible(30.7).map(e => e.text).join() === 'must2,must3', 'a third must-see takes the oldest place');
  // the hold (a cinematic scene)
  const H = new Q.Notes({ level: 'normal' });
  H.push({ text: 'vor', prio: 2 }, 0);
  H.hold(true, 1);
  check(H.visible(1).length === 0, 'held: nothing shows');
  check(H.push({ text: 'low', prio: 1 }, 2) === 'dropped' && H.push({ text: 'norm', prio: 2 }, 3) === 'queued', 'held: a low notice drops, a normal one waits');
  H.hold(false, 8); H.tick(8);
  check(H.visible(8).map(e => e.text).join() === 'norm', 'after the scene the waiting one shows: ' + H.visible(8).map(e => e.text).join());
  check(H.history.length === 3 && H.history[0].text === 'vor', 'every notice (shown or not) is in the history (' + H.history.length + ')');
  const big = new Q.Notes({ level: 'normal' }); for (let i = 0; i < 80; i++) big.push({ text: 'n' + i, prio: 3 }, i * 10);
  check(big.history.length === Q.HIST, 'the history keeps the last ' + Q.HIST);
}

console.log('b · priorities of the old channels');
{
  const T = (k, v) => VR.I18N.t(k, v);
  check(Q.toastPrio(T('g.codex.toastFound'), 'Wüste') === 1, 'a discovery card („Entdeckt") is low');
  check(Q.toastPrio(T('g.q.toast.done'), 'x') === 3, 'a quest done is must-see');
  check(Q.toastPrio(T('g.vil.welcome', { v: 'Lindenau' }), '') === 2, 'a village welcome is normal');
  check(Q.toastPrio('🌱 ' + T('g.fe.grows', { name: 'A', what: 'x' }), '') === 1, 'a settlement grows: low');
  check(Q.toastPrio('Irgendwas', '') === 2, 'anything else: normal');
  check(Q.hintPrio(10, 9.5) === 3 && Q.hintPrio(10, 5) === 2, 'a hint right after a key is the answer (must-see), else normal');
}

console.log('c · looking round a view; Funke');
{
  const L = new Q.Look();
  let looking = false;
  for (let i = 0; i < 16; i++) looking = L.step(i * 0.25, 0.1, i * 0.12);
  check(looking, 'standing and turning ≥ 0.5 rad in 4 s: looking round');
  const L2 = new Q.Look(); let lw = false;
  for (let i = 0; i < 16; i++) lw = L2.step(i * 0.25, 4, i * 0.12) || lw;
  check(!lw, 'walking and turning: not looking round');
  check(Q.FUNKE_GAP === 180, 'Funke: one unprompted line per 3 min (' + Q.FUNKE_GAP + ' s)');
  const may = (o) => Q.funkeMay(Object.assign({ level: 'few', looking: false, held: false, building: false }, o));
  check(may({}) && may({ level: 'normal' }) && !may({ level: 'off' }), 'Aus mutes Funke\'s unprompted lines');
  check(!may({ looking: true }) && !may({ held: true }) && !may({ building: true }), 'not while looking round, in a cinematic or building');
  const F = VR.Funke;
  check(F.GAP === 180, 'VR.Funke.GAP is 180 s');
  const B = new F.Budget(); const said = [];
  for (let t = 0; t < 3600; t++) if (B.can(t, false)) { said.push(t); B.said(t); }
  check(said.length <= 21 && said.length >= 15, 'an hour of offers: ' + said.length + ' unprompted lines (≤ 20 + the first)');
}

console.log('d · the 🧭 hints');
{
  check(Q.hintOk('normal', 2000) && Q.hintOk('few', 60) && !Q.hintOk('few', Q.FIRST + 1) && !Q.hintOk('off', 10), 'Normal always, Wenig in the first ' + Q.FIRST + ' s of a world, Aus never');
  check(Q.stripOk('normal', 9999, 0) && !Q.stripOk('few', 60, 2) && Q.stripOk('few', 60, Q.STUCK) && !Q.stripOk('few', Q.FIRST + 1, 60) && !Q.stripOk('off', 1, 60), 'the key strip: Normal always, Wenig only in the first minutes when the player seems stuck (' + Q.STUCK + ' s idle), Aus never');
  check(Q.HINT_HIDE >= 8 && Q.HINT_HIDE <= 15, 'Wenig: a hint steps back after ' + Q.HINT_HIDE + ' s');
}

console.log('e · the Aktion prompt');
{
  const C = VR.Ctx;
  const res = C.resolve({ funke: true });
  check(res.act === 'funke', 'nothing in reach: V still asks Funke');
  check(C.text(res, 'KeyV') === '', 'but no „[V] Funke fragen" prompt (' + JSON.stringify(C.text(res, 'KeyV')) + ')');
  check(/Mit Mara reden/.test(C.text(C.resolve({ near: { kind: 'villager', name: 'Mara', dist: 2, ang: 0 } }), 'KeyV')), 'a villager in reach: „[V] Mit Mara reden"');
  check(C.PROMPT_T === 2, 'a prompt shows ' + C.PROMPT_T + ' s, then steps back');
}

console.log('f · the setting and the texts');
{
  const it = VR.Settings.byKey('notices');
  check(!!it && it.t === 'choice' && it.def === 'few' && it.opts.map(o => o[0]).join() === 'normal,few,off', '⚙ Spiel · Hinweise: Normal / Wenig (default) / Aus');
  const de = VR.I18N.dict.de, en = VR.I18N.dict.en;
  const keys = ['g.set.notices', 'g.set.notices.tip', 'g.set.notices.normal', 'g.set.notices.few', 'g.set.notices.off', 'g.set.notices.normal.tip', 'g.set.notices.few.tip', 'g.set.notices.off.tip', 'g.quiet.recent', 'g.quiet.none'];
  const miss = keys.filter(k => typeof de[k] !== 'string' || typeof en[k] !== 'string');
  check(!miss.length, 'the texts in both tables' + (miss.length ? ': missing ' + miss.join(', ') : ''));
  check(de['g.set.notices'] === 'Hinweise', 'German: „Hinweise"');
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

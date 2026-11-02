// f-quiet2 · the calm screen for real, the endings shown (plan docs/superpowers/plans/2026-11-02-f-quiet2.md):
//   a · duplicates: the same gist from any source within DUP s drops at Wenig; per-key cooldowns; must-see only 4 s;
//       Normal keeps f-quiet's 30 s; a 10-minute stream of every source shows ≤ 2 duplicates (it showed 6 before)
//   b · the way pointers: shown for a new goal and after a long idle, gone after a few seconds
//   c · speech bubbles: at most two text bubbles, the looked-at / talking / nearest first, the rest small icons
//   d · a codex find whose toast the level drops counts weight 1 (not on the screen)
//   e · VR.TaleEnd: the five templates' scenes (≤ 8 s, a touch, a gift), the phases, the skip, the partner
//   f · the texts in both tables
// Run: bash test/wt_run.sh quiet2.js 300
require('./dom_stub.js');
const V = require('./load_shared.js');
globalThis.VR = V;
for (const f of ['i18n', 'lang_en', 'lang_de']) require(__dirname + '/../src/main/' + f + '.js');
require('../src/main/settings_reg.js');
require('../src/main/funke.js');
require('../src/main/ctx.js');
require('../src/main/quiet.js');
require('../src/main/tale_end.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const Q = VR.Quiet, TE = VR.TaleEnd;
check(!!Q && typeof Q.gist === 'function' && !!Q.COOLS && Q.DUP >= 60, 'VR.Quiet.gist, COOLS, DUP (' + (Q && Q.DUP) + ' s)');
check(!!TE && !!TE.PLAN, 'VR.TaleEnd.PLAN exists');
if (!Q || !Q.gist || !TE || !TE.PLAN) { console.log('FAILED ' + (fails || 1)); process.exit(1); }

console.log('a · duplicates');
{
  check(Q.gist('✨ Mara erzählt: 3 Äpfel!') === Q.gist('Mara erzählt — 12 Äpfel'), 'the gist ignores digits, emoji and punctuation: „' + Q.gist('✨ Mara erzählt: 3 Äpfel!') + '"');
  const N = new Q.Notes({ level: 'few' });
  check(N.push({ text: '🗞 Mara hat von dir gehört', prio: 2, key: 'gs:visit' }, 0) === 'shown', 'a gossip line shows');
  N.tick(10);
  check(N.push({ text: 'Mara hat von dir gehört.', prio: 2 }, 20) === 'dropped' && N.history[N.history.length - 1].r === 'dup', 'the same gist from another source (a toast) 20 s later: dropped (dup)');
  check(N.push({ text: '🗞 Jon hat von dir gehört', prio: 2, key: 'gs:visit' }, 40) === 'dropped' && N.history[N.history.length - 1].r === 'cool', 'the same key with another text within its cooldown (' + Q.COOLS['gs:visit'] + ' s): dropped (cool)');
  N.tick(250);
  check(N.push({ text: '🗞 Jon hat von dir gehört', prio: 2, key: 'gs:visit' }, 250) === 'shown', '… after the cooldown (and the gist\'s ' + Q.DUP + ' s) it shows');
  check(N.push({ text: 'Zu weit weg', prio: 3, key: 'hint' }, 260) !== 'dropped', 'a must-see answer shows');
  N.tick(266);
  check(N.push({ text: 'Zu weit weg', prio: 3, key: 'hint' }, 266) !== 'dropped', 'a must-see answer again 6 s later shows again (only 4 s)');
  const M = new Q.Notes({ level: 'normal' });
  M.push({ text: 'A b c', prio: 2 }, 0); M.tick(40);
  check(M.push({ text: 'A b c', prio: 2 }, 40) === 'shown', 'Normal keeps f-quiet\'s 30 s (the player asked for every message)');
  // the 10-minute stream: what reached the channel in the v0.57 session (wander toasts, gossip, tales, fairy, story, hints)
  const S = new Q.Notes({ level: 'few' }), shown = [];
  const ev = [];
  for (let t = 15; t < 600; t += 70) ev.push([t, '🌿 Ein Fuchs schleicht vorbei', 2, null]);          // the wander director's toast
  for (let t = 40; t < 600; t += 95) ev.push([t, '🗞 Mara hat von dir gehört', 2, 'gs:visit']);       // gossip
  for (let t = 60; t < 600; t += 150) ev.push([t, '🗞 Mara hat von dir gehört', 2, 'gs:up']);        // gossip's level-up, same words
  for (let t = 90; t < 600; t += 110) ev.push([t, '✿ Die Feen kichern im Moos', 2, 'fairy']);         // fairy
  for (let t = 100; t < 600; t += 200) ev.push([t, '🎉 Das Fest beginnt', 2, 'story-fest']);          // the story
  for (let t = 120; t < 600; t += 130) ev.push([t, 'Ein Kind winkt dir', 2, 'tl:say']);               // the tales
  for (let t = 130; t < 600; t += 60) ev.push([t, '🧭 Drücke V zum Reden', 2, 'hint']);               // a hint, not right after a key
  ev.sort((a, b) => a[0] - b[0]);
  const old = new Q.Notes({ level: 'few' }); old.legacy = true; const oldShown = [];
  for (const [t, text, prio, key] of ev) {
    S.tick(t); if (S.push({ text, prio, key }, t) === 'shown') shown.push([t, Q.gist(text)]);
    old.tick(t); if (old.push({ text, prio, key }, t) === 'shown') oldShown.push([t, Q.gist(text)]);
    for (let k = 1; k < 5; k++) { S.tick(t + k); old.tick(t + k); }
  }
  const dups = (L) => { const seen = new Set(); let n = 0; for (const [, g] of L) { if (seen.has(g)) n++; seen.add(g); } return n; };
  check(dups(shown) <= 2, `10 minutes of every source: ${dups(shown)} duplicates shown (≤ 2; f-quiet's rules alone: ${dups(oldShown)}), ${shown.length} lines in all`);
  check(dups(oldShown) > 2, 'the same stream under f-quiet\'s rules (legacy) shows more duplicates: ' + dups(oldShown));
}

console.log('b · the way pointers');
{
  const P = new Q.Pointer();
  const on = (t, goal, idle, lv) => P.step(t, goal, idle === undefined ? 0 : idle, lv || 'few');
  check(on(0, 'w1') === true, 'a new goal: shown');
  check(on(Q.PT_SHOW - 0.5, 'w1') === true && on(Q.PT_SHOW + 0.5, 'w1') === false, `gone after ${Q.PT_SHOW} s at Wenig`);
  check(on(60, 'w1', 5) === false && on(120, 'w1', 30) === false, 'stays gone while the player plays (5 min of walking: no pill)');
  check(on(130, 'w2', 0) === true, 'another goal: shown again');
  check(on(140, 'w2', 0) === false, '… and gone');
  check(on(200, 'w2', Q.PT_IDLE + 1) === true, `after ${Q.PT_IDLE} s without a key: shown (the player may be lost)`);
  check(on(200 + Q.PT_SHOW + 1, 'w2', Q.PT_IDLE + Q.PT_SHOW + 2) === false, '… once per idle stretch');
  check(on(300, '', 0) === false, 'no goal: nothing');
  const N = new Q.Pointer(); N.step(0, 'a', 0, 'normal');
  check(N.step(15, 'a', 0, 'normal') === true && N.step(Q.PT_SHOW_N + 1, 'a', 0, 'normal') === false, `Normal: ${Q.PT_SHOW_N} s`);
}

console.log('c · speech bubbles');
{
  const mk = (n, d, o) => [d * d, Object.assign({ name: n, bubble: { text: 'Hallo ' + n, t: 3 } }, o || {}), false];
  const list = [mk('a', 3), mk('b', 5), mk('c', 7), mk('d', 9, { bubble: { text: '♪', t: 2, icon: true } }), mk('e', 11)];
  list.push([12 * 12, { name: 'f', bubble: { text: 'Sieh mal!', t: 3 } }, true]);
  const talk = list[2][1];
  const out = Q.bubbleCap(list.slice(), talk);
  const text = out.filter(it => !it[3] && it[1].bubble && !it[1].bubble.icon);
  check(text.length === 2, 'two text bubbles at most: ' + text.map(it => it[1].name).join());
  check(out[0][1].name === 'f' && out[1][1].name === 'c', 'the one you look at first, then the one talking with you: ' + out.slice(0, 2).map(it => it[1].name).join());
  check(out.filter(it => it[3]).length === 3 && out.find(it => it[1].name === 'a')[3] === true, 'the others as small icons (3), even the nearest');
  check(out.find(it => it[1].name === 'd')[3] !== true, 'an icon bubble stays an icon (not demoted)');
  const two = Q.bubbleCap([mk('x', 2), mk('y', 4)], null);
  check(two.every(it => !it[3]) && two[0][1].name === 'x', 'two near: both stay, nearest first');
}

console.log('d · a dropped codex toast');
{
  check(Q.foundW('b:forest', 2, 'few') === 1 && Q.foundW('b:forest', 2, 'normal') === 2, 'a biome find at Wenig: weight 1 (its toast is not shown), at Normal 2');
  check(Q.foundW('w:arch', 4, 'few') === 4, 'a wonder keeps its banner\'s weight');
}

console.log('e · VR.TaleEnd');
{
  const K = ['lost', 'ingr', 'home', 'letter', 'beacon'];
  check(K.every(k => TE.PLAN[k]) && K.every(k => TE.PLAN[k].touch === 'hug' || TE.PLAN[k].touch === 'hands'), 'the five templates: a hug or hands held: ' + K.map(k => k + ' ' + (TE.PLAN[k] && TE.PLAN[k].touch)).join(', '));
  check(TE.PLAN.lost.with === 'kid' && TE.PLAN.lost.touch === 'hug', 'the lost child runs into the friend\'s arms');
  check(TE.DUR <= 8 && TE.DUR >= 6, `a scene lasts ${TE.DUR} s (≤ 8)`);
  const ph = (t) => TE.phase(t).ph;
  check(ph(0.2) === 'come' && ph(TE.T.touch + 0.1) === 'touch' && ph(TE.T.gift + 0.1) === 'gift' && ph(TE.T.back + 0.1) === 'back' && ph(TE.DUR + 0.1) === 'end', 'the phases: come → touch → gift → back → end');
  check(TE.phase(0).k === 0 && TE.phase(1.2).k === 1 && TE.phase(TE.DUR - 0.01).k < 0.1, 'the camera eases in and back (k ' + TE.phase(0).k + ' · ' + TE.phase(1.2).k + ' · ' + TE.phase(TE.DUR - 0.01).k.toFixed(2) + ')');
  check(TE.skip(2) >= TE.T.back && TE.DUR - TE.skip(2) <= 1, 'any key: the camera goes back now (≤ 1 s left)');
  check(TE.skip(TE.DUR - 0.2) === TE.DUR - 0.2, 'a skip in the last moment changes nothing');
  // the partner: the child for the lost child; else the friend's family, then a neighbour, then none (the friend comes to you)
  const gv = { p: { fam: 1, id: 'g' }, pos: [0, 60, 0], vil: 'v' }, kid = { p: { fam: 2, id: 'k' }, pos: [9, 60, 0], tlKid: true, vil: 'v' };
  const ag = [gv, { p: { fam: 3, id: 'n' }, pos: [6, 60, 0], vil: 'v' }, { p: { fam: 1, id: 'm' }, pos: [14, 60, 0], vil: 'v' }, { p: { fam: 1, id: 's' }, pos: [3, 60, 0], vil: 'v', pose: 'sleep' }];
  check(TE.partner('lost', gv, ag, kid) === kid, 'lost: the child');
  check(TE.partner('ingr', gv, ag, kid).p.id === 'm', 'ingr: the friend\'s family (awake) before a nearer neighbour');
  check(TE.partner('beacon', gv, ag.filter(a => a.p.id !== 'm'), null).p.id === 'n', 'beacon without family: a neighbour');
  check(TE.partner('letter', gv, [gv], null) === null, 'nobody near: the friend comes to you');
  // the meeting point: between them, the friend walks most of the way
  const m = TE.meet([0, 0], [10, 0]);
  check(Math.abs(m.friend[0] - 9) < 0.01 && Math.abs(m.mid[0] - 9.5) < 0.01, 'the friend walks up to 1 m before the partner: ' + JSON.stringify(m));
}

console.log('f · the texts');
{
  const de = VR.I18N.dict.de, en = VR.I18N.dict.en;
  const keys = TE.KEYS.slice();
  const miss = keys.filter(k => typeof de[k] !== 'string' || typeof en[k] !== 'string');
  check(!miss.length, 'every new text in both tables (' + keys.length + ')' + (miss.length ? ': missing ' + miss.join(', ') : ''));
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

// One question for a new world (f-names; plan docs/superpowers/plans/2026-10-23-f-names.md §2; review
// docs/reviews/v0.49.md R50-05: the create form stacked three overlapping choices — Zen-Bauen „keine Monster" lit beside
// a lit „Normal", and choosing Abenteuer silently set the difficulty to Normal). Checks:
//   1. the rules (VR.Adv.form / formView / formWorld / formPick, src/shared/adventure.js) over every combination —
//      Einfach / Profi × Kindersicher × foes there or not × every pick sequence of up to four steps from the fresh form:
//      the shown difficulty is the one the world gets (its difficulty, or its band under „mit Begegnungen"); a hidden
//      row means a peaceful world without encounters (or Einfach's default band under „mit Begegnungen"); Zen-Bauen is
//      never offered or given beside „mit Begegnungen"; Kindersicher gets only the first two cards and never encounters;
//      the fresh form is Frei bauen, Zen, peaceful; a band never leaks into a free world's difficulty
//   2. the pause card's card (VR.Adv.wayOf): off → free, Begegnungen aus → gentle, else → enc; Kindersicher → gentle
//   3. the texts: every key in both tables; each card ≤ 12 words (title + line) in German and English; the question
//   4. the glue in a stub page (VR.Adventure): the three cards after the name, two under Kindersicher; Zen hidden under
//      „mit Begegnungen"; the lit buttons are the world's; ✓ Welt erstellen → the record the world gets; 🎒 Meins' tile
//      makes a gentle Abenteuer; the pause card's switch per card (Begegnungen aus for „sanft")
//   bash test/wt_run.sh create_form.js 300
const DOM = require('./dom_stub.js');
require('./load_shared.js');
require('../src/shared/adventure.js');
require('../src/main/i18n.js');
require('../src/main/lang_en.js');
require('../src/main/lang_de.js');
require('../src/main/settings_reg.js');
require('../src/main/klang.js');
let fails = 0;
const later = [];
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const Adv = VR.Adv;
const has = (k) => Adv && typeof Adv[k] === 'function';
if (!has('form') || !has('formView') || !has('formWorld') || !has('formPick') || !has('wayOf')) {
  console.log('  ✗ VR.Adv.form / formView / formWorld / formPick / wayOf missing (src/shared/adventure.js)');
  console.log('FAILED 1'); process.exit(1);
}

// ---------------------------------------------------------------- 1 · the rules, every combination
console.log('1 · the rules over every combination');
const ACTS = [['way', 'free'], ['way', 'gentle'], ['way', 'enc'], ['mode', 'survival'], ['mode', 'creative'], ['mode', 'zen'], ['diff', 'peaceful'], ['diff', 'easy'], ['diff', 'normal'], ['diff', 'hard']];
const bad = {};   // invariant → first counter-example
const flag = (k, st, seq) => { if (!bad[k]) bad[k] = JSON.stringify({ st, seq: seq.map(a => a.join(':')).join(' → ') }); };
let states = 0;
const visit = (st, seq) => {
  states++;
  const v = Adv.formView(st), w = Adv.formWorld(st);
  const enc = v.way === 'enc';
  // what is offered
  if (v.ways.join() !== (st.kids ? 'free,gentle' : 'free,gentle,enc') || v.ways.indexOf(v.way) < 0) flag('the cards: three, Kindersicher two, one lit', st, seq);
  if (!st.pro && (v.modes.length || v.diffs.length)) flag('Einfach shows no Spielart and no difficulty', st, seq);
  if (st.pro && v.modes.join() !== (enc ? 'survival,creative' : 'survival,creative,zen')) flag('Profi offers the three Spielarten, Zen not beside „mit Begegnungen"', st, seq);
  if (st.pro && v.modes.indexOf(v.mode) < 0) flag('the lit Spielart is one of those offered', st, seq);
  if (v.mode !== w.mode) flag('the lit Spielart is the one the world gets', st, seq);
  if (enc && w.mode === 'zen') flag('never Zen-Bauen („keine Monster, kein Schaden") with Begegnungen', st, seq);
  // the difficulty row: where it decides something, and what is shown is what the world gets
  const want = !st.pro || st.kids ? '' : v.way === 'free' ? (v.mode === 'zen' ? '' : 'peaceful,easy,normal,hard') : enc ? 'easy,normal,hard' : '';
  if (v.diffs.join() !== want) flag('the difficulty row only in Profi, not under Zen, not under „sanft", not Kindersicher; „mit Begegnungen": Leicht · Normal · Schwer', st, seq);
  if (v.diffs.length) {
    if (v.diffs.indexOf(v.diff) < 0) flag('a shown row has one lit option of its own', st, seq);
    if (v.way === 'free' && (w.difficulty !== v.diff || w.adventure)) flag('Frei bauen: the shown difficulty is the world\'s, no Abenteuer', st, seq);
    if (enc && (!w.adventure || w.adventure.band !== v.diff || w.adventure.enc !== 'normal' || w.difficulty !== 'peaceful')) flag('mit Begegnungen: the shown difficulty is the band, encounters on, the world itself peaceful (A§1)', st, seq);
  } else {
    if (v.diff !== null) flag('a hidden row has nothing lit', st, seq);
    if (w.difficulty !== 'peaceful') flag('a hidden row means a peaceful world', st, seq);
    if (w.adventure && w.adventure.enc !== 'off' && !(enc && !st.pro)) flag('a hidden row means no encounters (except Einfach\'s „mit Begegnungen" with its default band)', st, seq);
    if (enc && !st.pro && (w.adventure.band !== 'normal' || w.adventure.enc !== 'normal')) flag('Einfach\'s „mit Begegnungen": band Normal, encounters on', st, seq);
  }
  // the three ways
  if (v.way === 'free' && w.adventure) flag('Frei bauen writes no Abenteuer into the world', st, seq);
  if (v.way === 'gentle' && (!w.adventure || !w.adventure.on || w.adventure.enc !== 'off' || w.difficulty !== 'peaceful')) flag('sanft: an Abenteuer without encounters in a peaceful world', st, seq);
  if (enc && (!w.adventure || !w.adventure.on)) flag('mit Begegnungen: an Abenteuer', st, seq);
  if (st.kids && (w.difficulty !== 'peaceful' || (w.adventure && w.adventure.enc !== 'off'))) flag('Kindersicher: peaceful, never encounters', st, seq);
  // the note: a later update when no foes exist yet; Kindersicher says why there are two cards
  if (enc && !st.foes && v.note !== 'encLater') flag('mit Begegnungen without foes yet: the honest note', st, seq);
  if (st.kids && v.note !== 'kids') flag('Kindersicher: its note', st, seq);
  if (!enc && !st.kids && v.note) flag('no note otherwise', st, seq);
};
const walk = (st, seq, depth) => { visit(st, seq); if (depth === 0) return; for (const a of ACTS) walk(Adv.formPick(st, a[0], a[1]), seq.concat([a]), depth - 1); };
for (const pro of [false, true]) for (const kids of [false, true]) for (const foes of [false, true]) walk(Adv.form({ pro, kids, foes }), [], 4);
const keys = Object.keys(bad);
check(states > 80000, states + ' states visited (2 × 2 × 2 starts, every sequence of up to four picks)');
check(!keys.length, 'every invariant holds in every state' + (keys.length ? ':\n      ' + keys.map(k => k + ' — e.g. ' + bad[k]).join('\n      ') : ''));
{
  const f = Adv.form({ pro: true }), v = Adv.formView(f), w = Adv.formWorld(f);
  check(v.way === 'free' && v.mode === 'zen' && !v.diffs.length && w.mode === 'zen' && w.difficulty === 'peaceful' && w.adventure === null, 'the fresh form (Profi): 🏗 Frei bauen, Zen-Bauen, no difficulty row — a peaceful world (' + JSON.stringify(w) + ')');
  const e = Adv.formWorld(Adv.form({ pro: false }));
  check(e.mode === 'zen' && e.difficulty === 'peaceful' && e.adventure === null, 'Einfach\'s fresh form: the same peaceful Zen world as ▶ Losspielen');
  // the review's case: Zen lit and Abenteuer chosen — no „Normal" beside „keine Monster" any more
  const g = Adv.formPick(f, 'way', 'gentle'), gv = Adv.formView(g);
  check(gv.mode === 'zen' && !gv.diffs.length && Adv.formWorld(g).adventure.enc === 'off', 'Zen + 🧭 sanft: no difficulty row at all, no encounters (the review\'s „Zen-Bauen" + „Normal" cannot happen)');
  const x = Adv.formPick(f, 'way', 'enc'), xv = Adv.formView(x);
  check(xv.mode === 'survival' && xv.modes.indexOf('zen') < 0 && xv.diff === 'normal', 'Zen + ⚔ mit Begegnungen: Spielart moves to Überleben (Zen not offered), the band Normal lit');
  const back = Adv.formPick(x, 'way', 'free');
  check(Adv.formView(back).mode === 'zen', '… and back to 🏗 Frei bauen: Zen again (the move is undone, nothing silent stays)');
  const kept = Adv.formPick(Adv.formPick(x, 'mode', 'creative'), 'way', 'free');
  check(Adv.formView(kept).mode === 'creative', 'a Spielart the player picked under „mit Begegnungen" stays when the card changes');
  // no leak: a free world's difficulty and the encounters' band are kept apart
  let s = Adv.formPick(Adv.formPick(f, 'mode', 'survival'), 'diff', 'easy');
  s = Adv.formPick(Adv.formPick(s, 'way', 'enc'), 'diff', 'hard');
  const sw = Adv.formWorld(s);
  s = Adv.formPick(s, 'way', 'free');
  check(sw.adventure.band === 'hard' && Adv.formWorld(s).difficulty === 'easy' && Adv.formView(s).diff === 'easy', 'Überleben/Leicht → ⚔ Schwer → 🏗 back: the free world is Leicht again, never Schwer (no band leaks into the difficulty)');
  check(Adv.formView(Adv.formPick(Adv.formPick(Adv.form({ pro: true }), 'mode', 'survival'), 'way', 'free')).diff === 'peaceful', 'Überleben with 🏗 Frei bauen: the row appears with Friedlich lit (peaceful stays the default)');
  const kx = Adv.formPick(Adv.form({ pro: true, kids: true }), 'way', 'enc');
  check(Adv.formView(kx).way === 'free' && Adv.formWorld(kx).adventure === null, 'Kindersicher: „mit Begegnungen" cannot be picked');
  const kg = Adv.formPick(Adv.formPick(Adv.form({ pro: true, kids: true }), 'way', 'gentle'), 'mode', 'survival');
  check(!Adv.formView(kg).diffs.length && Adv.formWorld(kg).adventure.enc === 'off', 'Kindersicher, sanft, Überleben: no difficulty row, no encounters');
  const ks = Adv.formPick(Adv.formPick(Adv.formPick(Adv.form({ pro: true, kids: true }), 'mode', 'survival'), 'diff', 'hard'), 'way', 'free');
  check(Adv.formWorld(ks).difficulty === 'peaceful', 'Kindersicher, Frei bauen, Überleben: a pick of „Schwer" does not reach the world (no row, peaceful)');
  const ein = Adv.formPick(Adv.form({ pro: false }), 'way', 'enc'), ew = Adv.formWorld(ein);
  check(ew.mode === 'survival' && ew.adventure.band === 'normal' && ew.adventure.enc === 'normal' && ew.difficulty === 'peaceful', 'Einfach, ⚔ mit Begegnungen: Überleben (hearts count), band Normal, the world itself peaceful');
  check(Adv.formPick(f, 'way', 'nonsense') === f || Adv.formView(Adv.formPick(f, 'way', 'nonsense')).way === 'free', 'an unknown pick changes nothing');
}

// ---------------------------------------------------------------- 2 · the pause card's card
console.log('2 · the pause card asks the same question');
{
  const r = (on, enc) => Object.assign(Adv.fresh({ on }), { enc });
  check(Adv.wayOf(null, false) === 'free' && Adv.wayOf(r(false, 'normal'), false) === 'free', 'no record or switched off: 🏗 Frei bauen');
  check(Adv.wayOf(r(true, 'off'), false) === 'gentle' && Adv.wayOf(r(true, 'normal'), false) === 'enc' && Adv.wayOf(r(true, 'rare'), false) === 'enc', 'Begegnungen aus: 🧭 sanft; normal or selten: ⚔ mit Begegnungen');
  check(Adv.wayOf(r(true, 'normal'), true) === 'gentle', 'Kindersicher: always 🧭 sanft');
}

// ---------------------------------------------------------------- 3 · the texts
console.log('3 · the texts: one question, three cards, ≤ 12 words each');
const de = VR.I18N.dict.de, en = VR.I18N.dict.en;
const KEYS = ['g.adv.how', 'g.adv.c.free', 'g.adv.c.freeS', 'g.adv.c.gentle', 'g.adv.c.gentleS', 'g.adv.c.enc', 'g.adv.c.encS', 'g.adv.c.encLater', 'g.adv.encKids', 'g.adv.encNote', 'g.adv.band', 'g.adv.enc'];
{
  const miss = KEYS.filter(k => !(k in de) || !(k in en));
  check(!miss.length, 'every key in both tables' + (miss.length ? ': ' + miss.join(', ') : ''));
  const words = (s) => String(s || '').split(/\s+/).filter(t => /[\p{L}\p{N}]/u.test(t)).length;
  const counts = [];
  for (const c of ['free', 'gentle', 'enc']) for (const [lang, d] of [['de', de], ['en', en]]) counts.push([c + ' ' + lang, words(d['g.adv.c.' + c]) + words(d['g.adv.c.' + c + 'S']), d['g.adv.c.' + c] + ' — ' + d['g.adv.c.' + c + 'S']]);
  check(counts.every(([, n]) => n > 0 && n <= 12), 'each card ≤ 12 words: ' + counts.map(([k, n]) => k + ' ' + n).join(' · '));
  for (const [k, n, s] of counts) console.log('      ' + k + ' (' + n + '): ' + s);
  check(de['g.adv.how'] === 'Wie willst du spielen?' && en['g.adv.how'] === 'How do you want to play?', 'the question: „' + de['g.adv.how'] + '" / "' + en['g.adv.how'] + '"');
  check(/Frei bauen/.test(de['g.adv.c.free']) && /sanft/.test(de['g.adv.c.gentle']) && /Begegnungen/.test(de['g.adv.c.enc']) && /Heliataler/.test(de['g.adv.c.gentleS']) && /Heliataler/.test(en['g.adv.c.gentleS']), 'the cards say Frei bauen · Abenteuer, sanft · Abenteuer mit Begegnungen, and the Heliataler');
  const old = ['g.adv.way', 'g.adv.way.free', 'g.adv.way.freeS', 'g.adv.way.adv', 'g.adv.way.advS', 'g.adv.wayNote', 'g.adv.enc.off'].filter(k => k in de || k in en);
  check(!old.length, 'the old row\'s keys are gone (Spielweg · Abenteuer, the note about Friedlich, Begegnungen „aus")' + (old.length ? ': ' + old.join(', ') : ''));
}

// ---------------------------------------------------------------- 4 · the glue in a stub page
console.log('4 · the glue: the create form, 🎒 Meins, the pause card (stub page)');
const mk = (tag, cls, id) => { const e = DOM.mkEl(tag); e.style = {}; if (cls) e.className = cls; if (id) e.setAttribute('id', id); return e; };
const segOf = (id, vals) => { const s = mk('div', 'seg', id); for (const v of vals) { const b = mk('button'); b.dataset = { v }; b.setAttribute('data-v', v); s.appendChild(b); } return s; };
const field = (inner, cls) => { const f = mk('div', 'field' + (cls ? ' ' + cls : '')); f.appendChild(mk('label')); f.appendChild(inner); return f; };
// the create form as start.js builds it (the name, Spielart, Schwierigkeit — Zen and Friedlich lit)
const scr = mk('div', 'screen', 'create'), panel = mk('div', 'panel box'); scr.appendChild(panel); DOM.body.appendChild(scr);
const name = mk('input', null, 'cw_name'); panel.appendChild(field(name));
const mode = segOf('cw_mode', ['survival', 'creative', 'zen']), diff = segOf('cw_diff', ['peaceful', 'easy', 'normal', 'hard']);
panel.appendChild(field(mode, 'pro')); panel.appendChild(field(diff, 'pro'));
mode.children[2].classList.add('on'); diff.children[0].classList.add('on');
const hud = mk('div', null, 'hud'); DOM.body.appendChild(hud);
VR.UIPrefs = { pro: true, get() { return { pro: this.pro }; } };
const mkGame = (meta) => ({ state: 'title', meta, settings: { advHud: true, kids: false }, difficulty: meta && meta.difficulty, player: null, env: { day: 0 }, ui: { screen: 'create', toasts: 0, toast() { this.toasts++; }, hint() {} }, audio: { tone() {}, count() {} }, particles: { glow() {}, spark() {}, spawn() {} }, saved: 0, saveMeta() { this.saved++; return Promise.resolve(); } });
VR.game = mkGame(null);
require('../src/main/adventure.js');
const A = VR.Adventure;
const lit = (seg) => { const b = seg.children.find(x => x.classList.contains('on')); return b ? b.getAttribute('data-v') : null; };
const shown = (e) => !!e && e.style.display !== 'none' && !e.hidden;
const fieldOf = (e) => { let a = e; while (a && !(a.classList && a.classList.contains('field'))) a = a.parent; return a; };
{
  check(typeof A.createRow === 'function' && typeof A.formPick === 'function', 'VR.Adventure.createRow and formPick are there');
  A.createRow();
  const way = panel.querySelector('#cw_way');
  const cards = way ? way.children.filter(shown).map(b => b.getAttribute('data-v')) : [];
  check(!!way && cards.join() === 'free,gentle,enc' && lit(way) === 'free', 'the three cards, 🏗 Frei bauen lit (' + cards.join(', ') + ')');
  check(way && /Frei bauen/.test(way.children[0].textContent || way.children[0].innerHTML) && fieldOf(way) && /Wie willst du spielen/.test(fieldOf(way).textContent + fieldOf(way).innerHTML), 'with the question „Wie willst du spielen?"');
  check(panel.children.indexOf(fieldOf(way)) === 1 || panel.children.indexOf(fieldOf(way)) === panel.children.length - 1, 'right after the name (or at the end where the page cannot insert)');
  check(lit(mode) === 'zen' && !shown(fieldOf(diff)) && shown(fieldOf(mode)), 'Profi: Spielart shown (Zen lit), no difficulty row under Zen');
  A.formPick('mode', 'survival');
  check(lit(mode) === 'survival' && shown(fieldOf(diff)) && lit(diff) === 'peaceful' && diff.children.every(shown), 'Überleben: the row appears — Friedlich · Leicht · Normal · Schwer, Friedlich lit');
  A.formPick('diff', 'easy');
  A.formPick('way', 'enc');
  check(lit(way) === 'enc' && !shown(mode.children[2]) && shown(fieldOf(diff)) && !shown(diff.children[0]) && lit(diff) === 'normal', '⚔ mit Begegnungen: Zen hidden, the row Leicht · Normal · Schwer with Normal lit (' + lit(diff) + ')');
  A.formPick('diff', 'hard');
  A.beforeCreate();
  const P = A.pendingCreate;
  check(P && P.band === 'hard' && P.enc === 'normal' && lit(diff) === 'peaceful' && lit(mode) === 'survival', '✓ Welt erstellen: the world gets band Schwer with encounters, its own difficulty peaceful (what ui.js reads: ' + lit(mode) + ', ' + lit(diff) + ')');
  A.createRow();
  check(lit(way) === 'free' && lit(mode) === 'zen' && !shown(fieldOf(diff)), 'the form opens fresh every time: Frei bauen, Zen, peaceful');
  A.formPick('way', 'gentle'); A.beforeCreate();
  check(A.pendingCreate && A.pendingCreate.enc === 'off' && lit(diff) === 'peaceful' && !shown(fieldOf(diff)), '🧭 sanft: an Abenteuer without encounters, no difficulty row');
  A.createRow(); A.formPick('mode', 'creative'); A.formPick('diff', 'normal'); A.beforeCreate();
  check(A.pendingCreate === null && lit(diff) === 'normal' && lit(mode) === 'creative', '🏗 Frei bauen, Kreativ, Normal: no Abenteuer, the world gets Normal as shown');
  VR.UIPrefs.pro = false; A.createRow();
  check(!shown(fieldOf(mode)) && !shown(fieldOf(diff)) && panel.querySelector('#cw_way').children.filter(shown).length === 3, 'Einfach: only the three cards (no Spielart, no difficulty)');
  A.formPick('way', 'enc'); A.beforeCreate();
  check(lit(mode) === 'survival' && A.pendingCreate.band === 'normal' && A.pendingCreate.enc === 'normal', 'Einfach ⚔ mit Begegnungen: Überleben, band Normal');
  VR.UIPrefs.pro = true; VR.game.settings.kids = true; A.createRow();
  const kc = panel.querySelector('#cw_way').children.filter(shown).map(b => b.getAttribute('data-v'));
  check(kc.join() === 'free,gentle', '🧸 Kindersicher: only 🏗 Frei bauen and 🧭 sanft (' + kc.join(', ') + ')');
  A.formPick('way', 'enc'); A.formPick('mode', 'survival'); A.formPick('diff', 'hard'); A.beforeCreate();
  check(lit(panel.querySelector('#cw_way')) === 'free' && lit(diff) === 'peaceful' && A.pendingCreate === null, 'Kindersicher: „mit Begegnungen" cannot be picked and „Schwer" does not reach the world');
  VR.game.settings.kids = false;
  // 🎒 Meins: „⚔ Abenteuer-Welt beginnen" makes a gentle Abenteuer
  const made = [], tg = mkGame({ id: 'title' }); tg.createWorld = (o) => { made.push(o); }; VR.game = tg;
  VR.Start = { meinsFrom: 'title', meinsChip: 'all', worldsCache: [] };
  later.push(A.newWorld().then((ok) => {
    const o = made[0], P2 = A.pendingCreate;
    check(ok && o && o.mode === 'zen' && o.difficulty === 'peaceful' && P2 && P2.enc === 'off', '🎒 Meins\' tile: a peaceful Zen world with a gentle Abenteuer — no encounters when foes arrive (' + JSON.stringify(P2) + ')');
    A.pendingCreate = null;
  }));
}
// the pause card: the same three cards; „sanft" switches the encounters off, „mit Begegnungen" on
{
  const meta = { id: 'w9', name: 'Karte', difficulty: 'normal', mode: 'survival', created: Date.now() - 1e7 };
  const g = mkGame(meta); g.state = 'play'; g.player = { pos: [0, 70, 0], spawn: [0, 70, 0], mode: 'survival' };
  VR.game = g; A.bind();
  const box = mk('div', 'panel'), card = mk('div', 'screen', 'adventure'); card.appendChild(box); DOM.body.appendChild(card);
  const ui = { screen: 'adventure', show() {}, pause() {} };
  A.act('adv:way', { dataset: { v: 'gentle' } }, ui);
  check(A.asking === 'gentle' && !A.on(), 'a world that never had it asks once (🧭 sanft)');
  A.act('adv:yes', {}, ui);
  check(A.on() && meta.adventure.enc === 'off' && Adv.wayOf(meta.adventure, false) === 'gentle' && meta.difficulty === 'peaceful', 'yes: 🧭 sanft — on, Begegnungen aus, the world peaceful (its old Normal kept for later)');
  A.act('adv:way', { dataset: { v: 'enc' } }, ui);
  check(A.on() && meta.adventure.enc === 'normal' && Adv.wayOf(meta.adventure, false) === 'enc', '⚔ mit Begegnungen: Begegnungen normal');
  A.act('adv:enc', { dataset: { v: 'rare' } }, ui); A.act('adv:way', { dataset: { v: 'gentle' } }, ui); A.act('adv:way', { dataset: { v: 'enc' } }, ui);
  check(meta.adventure.enc === 'rare', 'back to „mit Begegnungen": the player\'s „selten" is remembered… (' + meta.adventure.enc + ')');
  A.act('adv:way', { dataset: { v: 'free' } }, ui);
  check(!A.on() && meta.difficulty === 'normal', '🏗 Frei bauen: off, the world\'s old difficulty back');
  g.settings.kids = true; A.act('adv:way', { dataset: { v: 'enc' } }, ui);
  check(!A.on() || meta.adventure.enc === 'off', 'Kindersicher: „mit Begegnungen" is refused');
}

Promise.all(later).catch((e) => { fails++; console.log('  ✗ ' + (e && e.stack || e)); }).then(() => {
  console.log(fails ? 'FAILED ' + fails : 'ALL OK');
  process.exit(fails ? 1 : 0);
});

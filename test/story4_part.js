// a-story4 · test/story.js sections 16–17 (plan docs/superpowers/plans/2026-10-31-a-story4.md): chapters 9–12, the
// set piece (the way you answer Echo), the finale, the epilogue's star book. Required by test/story.js.
module.exports = function (S, SP, tr, calm, check, rnd) {
  console.log('16 · a-story4: chapters 9–12 written in full');
  const nb = S.BEATS.filter(b => b.ch >= 9);
  check(nb.length === 12 && [9, 10, 11, 12].every(c => S.ofChapter(c).length === 3), 'twelve new beats, three a chapter (' + nb.length + ')');
  check(nb.every(b => S.sceneLen(b) <= 25 && S.sceneLen(b) >= 12), 'every scene 12–25 s (' + nb.map(b => S.sceneLen(b)).join(' ') + ')');
  check(nb.every(b => b.when.adv === true), 'chapters 9–12 play in Abenteuer worlds');
  for (const w of ['dumarin', 'ylosenis', 'flimmi', 'echo']) check(S.WHO.includes(w), 'a new speaker: ' + w);
  const all = (b) => { const o = []; if (b.scene.alt) for (const k of Object.keys(b.scene.alt)) o.push(...b.scene.alt[k]); else o.push(...b.scene.lines); return o; };
  const ch11 = S.ofChapter(11).concat(S.ofChapter(12)).flatMap(all).map(l => l.who);
  check(['solgani', 'ariveli', 'selkatun', 'dumarin', 'ylosenis'].every(w => ch11.includes(w)) && ch11.includes('lumi'), 'all five peoples\' speakers and the helper (Lumi) come together in 11–12');
  check(nb.every(b => all(b).length >= 3 && all(b).length <= 5 * 4), 'three to five lines a scene');
  check(nb.every(b => b.scene.shots.some(q => q.fx)) && nb.filter(b => b.scene.shots.some(q => q.swell)).length >= 8, 'every new scene has the film\'s own pictures; ≥ 8 swells');
  const ck = S.keys();
  const miss = ck.filter(k => !tr('de', k) || !tr('en', k)), sameDE = ck.filter(k => /story\.(c(9|1[012])\.b|choice\.how)/.test(k) && /\.\d$|\.j$|\.after$/.test(k) && tr('de', k) === tr('en', k));
  check(!miss.length, ck.length + ' keys in both tables' + (miss.length ? ': missing ' + miss.slice(0, 8).join(', ') : ''));
  check(!sameDE.length, 'every new German line is German' + (sameDE.length ? ': ' + sameDE.slice(0, 5).join(', ') : ''));
  check(nb.every(b => tr('de', 'story.act.' + b.id) && tr('en', 'story.act.' + b.id) && tr('de', 'story.task.' + b.task.kind) && tr('en', 'story.task.' + b.task.kind)), 'every new deed and task in the tables');
  const longL = ck.filter(k => /story\.c(9|1[012])\./.test(k) && /\.\d$/.test(k) && (tr('de', k) || '').length > 125);
  check(!longL.length, 'every new line short enough to read (≤ 125 characters) ' + longL.join(', '));
  check(S.byId('c8.b3').task.kind === 'nebula' && !/Fortsetzung/.test(tr('de', 'story.task.nebula')), 'chapter 8 now points on into the nebula (no „Fortsetzung folgt")');
  // the rules: the nebula, the red sun, the deed
  const upTo = (id) => { const r = S.fresh(); for (const b of S.BEATS) { if (b.id === id) break; S.mark(r, b.id); } r.choices.c6 = 'lumi'; return r; };
  const r9 = upTo('c9.b1');
  check(S.why(S.byId('c9.b1'), calm({ dim: 'x.5.2.aqua' }), r9) === 'neb' && S.why(S.byId('c9.b1'), calm({ dim: 'x.5.2.aqua', neb: true }), r9) === null, 'chapter 9 waits for a world inside a nebula');
  const r10 = upTo('c10.b1');
  check(S.why(S.byId('c10.b1'), calm({ dim: 'x.5.2.ocker' }), r10) === 'red' && S.why(S.byId('c10.b1'), calm({ dim: 'x.5.2.ocker', red: true }), r10) === null, 'chapter 10 waits for a red dwarf\'s world');
  check(S.why(S.byId('c10.b1'), calm({ dim: 'x.5.2.ocker', red: true, sunUp: false }), r10) === null, 'chapter 10 does not wait for a sunrise (a locked world\'s night side never has one)');
  const r11 = upTo('c11.b1');
  check(S.why(S.byId('c11.b1'), calm({ dim: 'stn.ring' }), r11) === null && S.why(S.byId('c11.b1'), calm({ dim: 'overworld' }), r11) === 'dim', 'chapter 11 at the Ringstation');
  // the set piece: four ways to answer Echo
  check(JSON.stringify(S.WAYS) === '["build","fly","free","calm"]', 'four ways: build · fly · free · calm');
  const b0 = { placed: 3, span: 0, freed: 2, calms: 1, high: 20, orbit: false };
  check(S.featWay(b0, b0) === null, 'nothing done: no way');
  check(S.featWay(b0, Object.assign({}, b0, { placed: 27, span: 6 })) === 'build', 'a builder: 24 blocks placed, 6 m tall → build');
  check(S.featWay(b0, Object.assign({}, b0, { placed: 27, span: 2 })) === null && S.featWay(b0, Object.assign({}, b0, { placed: 20, span: 9 })) === null, 'a flat floor or too few blocks is not yet a beacon');
  check(S.featWay(b0, Object.assign({}, b0, { high: 175 })) === 'fly' && S.featWay(b0, Object.assign({}, b0, { orbit: true })) === 'fly' && S.featWay(b0, Object.assign({}, b0, { high: 120 })) === null, 'a flier: 150 m higher (or orbit) → fly');
  check(S.featWay(b0, Object.assign({}, b0, { freed: 3 })) === 'free' && S.featWay(b0, Object.assign({}, b0, { calms: 2 })) === 'calm', 'a beacon freed → free; a machine calmed → calm');
  const act = S.byId('c11.b2').act;
  check(act && act.kind === 'feat' && S.actCheck(act, {}) === 'armed' && S.actCheck(act, { feat: 'build' }) === 'ok' && S.actCheck(act, { feat: 'nope' }) === 'armed', 'c11.b2\'s deed is the set piece (kind feat)');
  const rw = upTo('c11.b3');
  check(S.why(S.byId('c11.b3'), calm({ dim: 'stn.ring' }), rw) === 'deed', 'Echo wakes only after the answer (c11.b3 waits for the deed)');
  check(S.answer(rw, 'build') && rw.choices.how === 'build' && S.actDone(rw, 'c11.b2') && !S.answer(rw, 'fly'), 'the answer kept once: the way and the deed');
  check(S.why(S.byId('c11.b3'), calm({ dim: 'overworld' }), rw) === null, 'then Echo wakes wherever you are (the answer was seen)');
  for (const w of S.WAYS) { const r = upTo('c11.b3'); S.answer(r, w); const ls = S.linesOf(S.byId('c11.b3'), r); check(ls.length >= 4 && ls.every(l => l.key.indexOf('.' + w + '.') > 0) && ls.some(l => l.who === 'echo'), 'c11.b3 speaks of your way: ' + w + ' (' + ls.map(l => l.who).join(' ') + ')'); }
  check(new Set(S.WAYS.map(w => tr('de', 'story.c11.b3.' + w + '.1'))).size === 4, 'four different first lines for the four ways');
  check(S.choicePending((() => { const r = upTo('c12.b1'); delete r.choices.how; return r; })()) === null, 'the way is no card: never pending');
  // chapter 12: home, at dusk or night
  const r12 = upTo('c12.b2'); r12.choices.how = 'fly';
  check(S.why(S.byId('c12.b2'), calm({ dim: 'overworld', hour: 'noon' }), r12) === 'hour' && S.why(S.byId('c12.b2'), calm({ dim: 'overworld', hour: 'night' }), r12) === null && S.why(S.byId('c12.b2'), calm({ dim: 'aqua', hour: 'night' }), r12) === 'dim', 'the finale at home under the night sky');
  console.log('17 · a-story4: all twelve chapters walked, both choices, every way');
  const ctxFor = (b) => {
    const w = b.when, c = calm({ adv: true, calm: 30 });
    if (w.dim) c.dim = w.dim[0].replace('*', w.dim[0] === 'x.*' ? '7.2.aqua' : 'ring');
    if (w.near) for (const k of Object.keys(w.near)) c.near[k] = w.near[k] - 5;
    if (w.suns) c.suns = w.suns; if (w.neb) c.neb = true; if (w.red) c.red = true; if (w.hours) c.hour = w.hours[0];
    return c;
  };
  let k = 0;
  for (const opt of ['wellari', 'lumi']) for (const way of S.WAYS) {
    if (opt === 'wellari' && k++ % 2) continue;
    const r = S.fresh(); let path = [], bad = 0; for (const b of S.BEATS) if (b.ch <= 8) S.mark(r, b.id); r.choices.c6 = opt; S.visit(r, 'zinn'); S.visit(r, 'aqua');
    for (let i = 0; i < 60; i++) {
      const b = S.open(r); if (!b) break;
      if (S.choicePending(r)) S.choose(r, 'c6', opt);
      const c = ctxFor(b);
      if (b.when.deed) S.answer(r, way);
      if (S.ready(b, Object.assign({}, c, { building: true }), r) || S.ready(b, Object.assign({}, c, { fighting: true }), r)) bad++;
      if (!S.ready(b, c, r)) { check(false, opt + '/' + way + ': ' + b.id + ' not reachable: ' + S.why(b, c, r)); break; }
      path.push(b.id); S.mark(r, b.id); S.visit(r, c.dim);
    }
    check(path.length === 12 && path[0] === 'c9.b1' && path[11] === 'c12.b3' && !bad && S.chapter(r) === 13, `${opt} · ${way}: all twelve beats of 9–12 in order, none while building or fighting, the book ends (chapter ${S.chapter(r)})`);
    const back = S.load(JSON.parse(JSON.stringify(r)));
    check(back.choices.c6 === opt && back.choices.how === way && S.linesOf(S.byId('c12.b1'), back).every(l => l.key.indexOf('.' + opt + '.') > 0) && Object.keys(back.places).length >= 5, 'kept through a save: the helper, the way, the places (' + Object.keys(back.places).join(' ') + ')');
    check(S.free(back), 'the epilogue: free play is open');
  }
  const junk = S.load({ v: 1, beats: {}, choices: { how: 'dig' }, places: { 'x.1.1.aqua': 1, '<b>': 1, overworld: 'yes' } });
  check(!junk.choices.how && JSON.stringify(junk.places) === '{"x.1.1.aqua":1}', 'the record sanitises the way and the places');
  // never during building: 3,000 random contexts on 9–12
  let bad3 = 0, rd3 = 0;
  const DM = ['x.4.2.aqua', 'stn.ring', 'overworld', 'zinn'];
  for (let i = 0; i < 3000; i++) {
    const rec = S.fresh(), n = 24 + Math.floor(rnd() * 12); for (let j = 0; j < n; j++) S.mark(rec, S.BEATS[j].id);
    rec.choices.c6 = rnd() < 0.5 ? 'lumi' : 'wellari'; if (rnd() < 0.5) S.answer(rec, S.WAYS[Math.floor(rnd() * 4)]);
    const c = { calm: rnd() * 60, building: rnd() < 0.3, fighting: rnd() < 0.3, menu: rnd() < 0.1, landing: rnd() < 0.1, adv: true, dim: DM[Math.floor(rnd() * 4)], neb: rnd() < 0.5, red: rnd() < 0.5, hour: rnd() < 0.5 ? 'night' : 'noon', near: { village: rnd() * 200, outpost: 999 } };
    for (const b of S.BEATS) if (b.ch >= 9 && S.ready(b, c, rec)) { rd3++; if (c.building || c.fighting || c.menu || c.landing || c.calm < S.CALM_ADV) bad3++; }
  }
  check(rd3 > 50 && !bad3, `3,000 contexts on 9–12: ${rd3} ready, ${bad3} while busy`);
  // the fx and the faces
  if (VR.StoryFx) {
    const Fx = VR.StoryFx, used = new Set(); for (const b of nb) for (const q of b.scene.shots) if (q.fx) used.add(q.fx);
    check([...used].every(x => Fx.KINDS.includes(x)) && used.size >= 6, 'the new fx are drawn (' + [...used].join(' ') + ')');
  }
  if (VR.Portrait) for (const w of ['dumarin', 'ylosenis', 'flimmi', 'echo']) { const o = VR.Portrait.ops(w, 'happy', false, true), o2 = VR.Portrait.ops('funke', 'happy', false, true); check(o.length > 25 && JSON.stringify(o) !== JSON.stringify(o2) && VR.Portrait.WHO.includes(w), 'a face of its own: ' + w + ' (' + o.length + ' rects)'); }
  // the player: the set piece watched (a stand-in game), the journal's star book
  if (SP && SP.featNow) {
    const g = { player: { pos: [0, 70, 0] }, dim: 'stn.ring' };
    const base = SP.featNow(g);
    for (let i = 0; i < 26; i++) SP.notePlaced(3, 64 + (i % 7), 4);
    const now = SP.featNow(g, base);
    check(now.placed - base.placed === 26 && now.span >= 6 && S.featWay(base, now) === 'build', 'the placements counted for the set piece (' + (now.placed - base.placed) + ' blocks, ' + now.span + ' m)');
  }
};

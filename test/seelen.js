// r-seelen · villagers with memory — without a browser (plan docs/superpowers/plans/2026-11-07-r-seelen.md):
//   a · the memory stream: the ring's cap, the same thing again raises the old one, the weakest is forgotten
//   b · retrieval: recency + importance + relevance, the order for the same inputs
//   c · reflection: beliefs from memories, the same for the same inputs, ≤ 3, fading, the grudge gone when made up
//   d · the day's plan: valid (contiguous, 4–6 slots, known acts, a partner where one is needed) for many villagers
//   e · the quarrel: spat → cold → bench → gift → done with beats, and with the timeouts while you are away
//   f · relationships: seeded family / work / neighbour, shared moments, friends, the quarrel's kind
//   g · the player: meetings counted after a gap, gifts, help, hurts → the feeling
//   h · save / load: the round trip, the caps, a bad save
//   i · speech: every g.se template in both languages fills every slot; the lines for each memory, belief, gossip;
//       a memory line wins over a plain one; no 'undefined', no '{'
// Run: bash test/wt_run.sh seelen.js 300
require('./dom_stub.js');
const V = require('./load_shared.js');
globalThis.VR = V;
for (const f of ['i18n', 'lang_en', 'lang_de']) require(__dirname + '/../src/main/' + f + '.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const S = V.Seelen;
check(!!S && typeof S.note === 'function', 'VR.Seelen exists');
if (!S || !S.note) { console.log('FAILED ' + (fails || 1)); process.exit(1); }
const DAY = 1440;

console.log('a · the memory stream');
{
  const m = S.newMind();
  for (let i = 0; i < 100; i++) S.note(m, i % 3 ? 'seen' : 'chronik', i * 120, { a: 'e' + i });
  check(m.m.length === S.MEM, `the ring holds ${S.MEM} (${m.m.length})`);
  S.note(m, 'helped', 100 * 120, {});
  check(m.m.some(e => e.k === 'helped'), 'a strong new memory gets in');
  const m2 = S.newMind();
  S.note(m2, 'storm', 1000, {}); S.note(m2, 'storm', 1030, {});
  check(m2.m.length === 1 && m2.m[0].i === 6 && m2.m[0].t === 1030, 'the same thing within an hour raises the old memory (imp 5 → 6)');
  S.note(m2, 'storm', 1200, {});
  check(m2.m.length === 2, 'two hours later it is a new memory');
  check(S.note(m2, 'nonsense', 1, {}) === null, 'an unknown kind is ignored');
  // the weakest goes: fill with old 'seen', add many — the gift stays
  const m3 = S.newMind(); S.note(m3, 'gift', 0, { a: 'bread' });
  for (let i = 1; i < 80; i++) S.note(m3, 'seen', i * 100, { a: 'x' + i });
  check(m3.m.some(e => e.k === 'gift'), 'an important old memory outlives many small new ones');
}

console.log('b · retrieval');
{
  const m = S.newMind(), now = 10 * DAY;
  S.note(m, 'seen', now - 60, {});
  S.note(m, 'storm', now - 2 * DAY, {});
  S.note(m, 'gift', now - 3 * DAY, { a: 'honey_bottle' });
  S.note(m, 'wunder', now - 5 * DAY, { a: 'whale' });
  const top = S.retrieve(m, now, null, 4);
  check(top.length === 4, 'four memories back');
  const sGift = S.score(m.m[2], now, null), sSeen = S.score(m.m[0], now, null);
  check(sGift > 0 && sSeen > 0 && Math.abs(sSeen - (S.rec(now - 60, now) + 0.2)) < 1e-9, 'score = recency + importance/10 (no query)');
  const pl = S.retrieve(m, now, { tags: S.TAGS.pl }, 1)[0];
  check(pl.k === 'gift', 'a query about the player brings the gift first (' + pl.k + ')');
  const st = S.retrieve(m, now, { tags: S.TAGS.storm }, 1)[0];
  check(st.k === 'storm', 'a query about storms brings the storm');
  const only = S.retrieve(m, now, { only: S.TAGS.pl }, 9);
  check(only.every(e => S.KINDS[e.k][1] & S.TAGS.pl) && only.length === 2, 'only: filters to the player memories');
  check(JSON.stringify(S.retrieve(m, now, { tags: 4 }, 4)) === JSON.stringify(S.retrieve(m, now, { tags: 4 }, 4)), 'the same order for the same inputs');
  check(S.rec(0, 60) < 1 && S.rec(0, 60) > 0.99 && S.rec(0, DAY) > 0.85 && S.rec(0, DAY) < 0.9, 'recency 0.995 per game hour (' + S.rec(0, DAY).toFixed(3) + ' a day)');
}

console.log('c · reflection');
const mk = (list) => { const m = S.newMind(); for (const [k, t, o] of list) S.note(m, k, t, o || {}); return m; };
{
  const now = 5 * DAY;
  const L = [['storm', now - 300], ['storm', now - 900], ['gift', now - 200, { a: 'bread' }], ['talk', now - 100], ['build', now - 500, { a: 'bakery' }], ['moment', now - 400, { a: 'dance', w: '2:0' }]];
  const a = mk(L), b = mk(L);
  const ra = S.reflect(a, now, 5), rb = S.reflect(b, now, 5);
  check(JSON.stringify(ra) === JSON.stringify(rb), 'the same memories → the same beliefs');
  check(ra.length >= 1 && ra.length <= S.MAXB, `1–${S.MAXB} beliefs (${ra.map(x => x.b + ':' + x.s).join(', ')})`);
  check(ra.some(x => x.b === 'fearStorm'), 'two storms → afraid of storms');
  check(ra.some(x => x.b === 'likesWanderer'), 'a gift and a talk → likes the wanderer');
  const solo = mk([['storm', now - 60], ['storm', now - 500], ['storm', now - 1000]]);
  S.reflect(solo, now, 5);
  const s0 = S.has(solo, 'fearStorm').s;
  solo.m = [];
  S.reflect(solo, now + DAY, 6);
  const s1 = S.has(solo, 'fearStorm');
  check(s1 && Math.abs(s1.s - Math.round(s0 * S.FADE * 100) / 100) < 0.011, `a night without storms: the fear fades (${s0} → ${s1 && s1.s})`);
  for (let d = 0; d < 12; d++) S.reflect(solo, now + (d + 2) * DAY, 7 + d);
  check(!S.has(solo, 'fearStorm'), 'after many quiet nights it is forgotten');
  const proud = mk([['build', now - 100, { a: 'bakery' }], ['build', now - 900, { a: 'bakery' }]]);
  S.reflect(proud, now, 5);
  check(S.has(proud, 'proud') && S.has(proud, 'proud').a === 'bakery', 'a new bakery → proud of the bakery');
  const q = mk([['quarrel', now - 300, { w: '3:1', a: 2 }], ['quarrel', now - 1000, { w: '3:1', a: 2 }]]);
  S.reflect(q, now, 5);
  check(S.has(q, 'upset') && S.has(q, 'upset').w === '3:1', 'a quarrel → upset with them');
  S.note(q, 'made_up', now + 200, { w: '3:1' });
  S.reflect(q, now + DAY, 6);
  check(!S.has(q, 'upset') && S.has(q, 'fond'), 'made up: the grudge gone, fondness instead');
  const w = mk([['hurt', now - 100], ['hurt', now - 300]]);
  S.reflect(w, now, 5);
  check(S.has(w, 'waryWanderer') && !S.has(w, 'likesWanderer'), 'hurt twice → wary of the wanderer');
}

console.log('d · the plan');
{
  let bad = 0, meets = 0, adm = 0, sky = 0, first = '';
  for (let i = 0; i < 300; i++) {
    const m = S.newMind();
    if (i % 3 === 0) S.note(m, 'build', 100, { a: 'well' });
    if (i % 5 === 0) S.note(m, 'wunder', 100, { a: 'whale' });
    if (i % 2) S.note(m, 'chronik', 100, { a: 'e1' });
    S.note(m, 'build', 300, {}); S.note(m, 'wunder', 400, { a: 'whale' });
    S.reflect(m, 1000, 1);
    const q = i % 7 === 0 ? { a: 'me', b: 'x', ph: S.Q[i % 4], d: 0 } : null;
    const P = S.plan({ seed: i * 31, day: i % 9, kid: i % 11 === 0, elder: i % 13 === 0, role: ['farmer', 'baker', 'gardener'][i % 3], mind: m, friends: i % 4 ? [{ w: 'f' + i, v: 0.6 }] : [], q, me: 'me', whale: i % 2 === 0 });
    const why = S.planValid(P); if (why) { bad++; if (!first) first = why; }
    for (const s of P) { if (s.a === 'meet') meets++; if (s.a === 'admire') adm++; if (s.a === 'skywatch') sky++; }
  }
  check(!bad, 'every plan is valid (300 villagers)' + (first ? ': ' + first : ''));
  check(meets > 50 && adm > 50 && sky > 10, `friends meet (${meets}), the proud admire (${adm}), the awed watch the sky (${sky})`);
  const P = S.plan({ seed: 1, day: 2, mind: S.newMind(), friends: [], me: 'a' });
  check(P.every(s => s.a === null), 'without reasons the village schedule decides every slot (a: null)');
  check(S.slotAt(P, 6000).f === 5600 && S.slotAt(P, 20000) === null, 'slotAt finds the slot of the hour');
  const Pq = S.plan({ seed: 1, day: 2, mind: S.newMind(), friends: [{ w: 'b', v: 0.7 }], me: 'a', q: { a: 'a', b: 'b', ph: 'spat', d: 2 } });
  check(Pq[4].a === 'spat' && Pq[4].w === 'b' && !Pq.some(s => s.a === 'meet' && s.w === 'b'), 'a quarrel: the evening is the spat, no meeting with the one quarrelled with');
  check(S.planValid([{ f: 900, u: 13000, a: null }]) === 'count' && S.planValid(P.map((s, i) => (i === 2 ? Object.assign({}, s, { a: 'meet', w: '' }) : s))).indexOf('who') === 0, 'planValid catches a short plan and a meeting without a partner');
}

console.log('e · the quarrel');
{
  const q = S.qNew('1:0', '2:0', 10, 99);
  check(q.ph === 'spat' && q.tp >= 0 && q.tp < S.TOPICS && (q.g === q.a || q.g === q.b), 'a new quarrel begins with the spat, a topic, a giver');
  S.qStep(q, { day: 10, tod: 11000 }); check(q.ph === 'spat', 'no beat yet: still the spat');
  S.qStep(q, { day: 10, tod: 11200, beat: true }); check(q.ph === 'cold', 'the spat played → cold (turned backs)');
  S.qStep(q, { day: 10, tod: 12000 }); check(q.ph === 'cold', 'the same evening: still cold');
  S.qStep(q, { day: 11, tod: 3000 }); check(q.ph === 'cold', 'the next morning: still cold');
  S.qStep(q, { day: 11, tod: 10700 }); check(q.ph === 'bench', 'the next dusk → the shared bench');
  S.qStep(q, { day: 11, tod: 11000, beat: true }); check(q.ph === 'gift', 'the bench → the gift');
  S.qStep(q, { day: 11, tod: 11500, beat: true }); check(q.ph === 'done', 'the gift → reconciled within two days');
  const q2 = S.qNew('a', 'b', 3, 7); S.qCatch(q2, 9, 2000);
  check(q2.ph === 'done', 'away for days: the timeouts reconcile them anyway');
  const q3 = S.qNew('a', 'b', 3, 7); S.qCatch(q3, 4, 11000);
  check(q3.ph === 'bench', 'away one day: by the next dusk they reach the bench (' + q3.ph + ')');
  // picking: a village's adults, not family
  const ppl = []; for (let h = 0; h < 6; h++) for (let k = 0; k < 2; k++) ppl.push({ id: h + ':' + k, fam: h, home: h, role: k ? 'farmer' : ['baker', 'smith', 'mayor', 'builder', 'ranger', 'healer'][h], age: 'adult' });
  const G = S.newGraph(ppl);
  let picked = 0, okPair = true;
  for (let d = 0; d < 40; d++) { const p = S.qPick(G, ppl, d, 1234); if (p) { picked++; const A = ppl.find(x => x.id === p.a), B = ppl.find(x => x.id === p.b); if (!A || !B || A.fam === B.fam) okPair = false; } }
  check(picked >= 4 && picked <= 20 && okPair, `about one village-day in four starts a quarrel, never within a family (${picked}/40)`);
}

console.log('f · relationships');
{
  const ppl = [{ id: '0:0', fam: 0, home: 0, role: 'farmer', age: 'adult' }, { id: '0:1', fam: 0, home: 0, role: 'baker', age: 'adult' }, { id: '1:0', fam: 1, home: 1, role: 'smith', age: 'adult' }, { id: '2:0', fam: 2, home: 5, role: 'farmer', age: 'adult' }, { id: '3:0', fam: 3, home: 9, role: 'mayor', age: 'adult' }];
  const G = S.newGraph(ppl);
  check(S.relKind(G, '0:0', '0:1') === 'family' && S.relV(G, '0:0', '0:1') === 0.6, 'one family: family, 0.6');
  check(S.relKind(G, '0:0', '2:0') === 'work', 'the same job: work');
  check(S.relKind(G, '0:1', '1:0') === 'neighbour', 'the next house: neighbour');
  check(S.relKind(G, '2:0', '3:0') === '', 'strangers: none');
  S.share(G, '2:0', '3:0', 'dance'); S.share(G, '2:0', '3:0', 'picnic'); S.share(G, '2:0', '3:0', 'lantern'); S.share(G, '2:0', '3:0', 'fgift');
  check(S.relKind(G, '2:0', '3:0') === 'friend' && S.relV(G, '3:0', '2:0') >= 0.5, 'a dance, a picnic, a lantern walk and a gift: friends (' + S.relV(G, '2:0', '3:0') + ')');
  const fr = S.friendsOf(G, '2:0', 3, ppl.map(p => p.id));
  check(fr.length >= 1 && fr[0].w === '3:0', 'friendsOf finds the new friend first (family left out)');
  const q = S.qNew('0:0', '2:0', 1, 1);
  check(S.relKind(G, '0:0', '2:0', q) === 'quarrel', 'an open quarrel shows as quarrel');
  S.share(G, '0:0', '2:0', 'quarrel'); S.share(G, '0:0', '2:0', 'made_up');
  check(S.relV(G, '0:0', '2:0') > 0.3, 'a quarrel and its reconciliation: closer than before (' + S.relV(G, '0:0', '2:0') + ')');
  for (let k = 0; k < 30; k++) S.share(G, '0:0', '1:0', 'fgift');
  check(S.relV(G, '0:0', '1:0') === 1, 'capped at 1');
}

console.log('g · the player');
{
  const m = S.newMind();
  check(S.plMeet(m, 100) && m.pl.n === 1, 'the first meeting counts');
  check(!S.plMeet(m, 150) && m.pl.n === 1, '50 minutes later: the same meeting');
  check(S.plMeet(m, 300) && m.pl.n === 2, 'later: a second meeting');
  check(S.feel(m.pl) === 'known', 'two meetings: knows you (' + S.feel(m.pl) + ')');
  S.plAdd(m, 'g', 400); S.plAdd(m, 'g', 500);
  check(S.feel(m.pl) === 'likes', 'two gifts: likes you (' + S.feel(m.pl) + ')');
  S.plAdd(m, 'h', 600); S.plAdd(m, 'd', 700);
  check(S.feelRank(S.feel(m.pl)) >= 4, 'help and a dance: a friend (' + S.feel(m.pl) + ')');
  const w = S.newMind(); S.plMeet(w, 1); S.plAdd(w, 'x', 2);
  check(S.feel(w.pl) === 'wary', 'hit once: wary');
  check(S.feel(null) === 'stranger', 'never met: a stranger');
}

console.log('h · save / load');
{
  const st = { p: {}, r: {}, q: {} };
  for (let i = 0; i < 220; i++) {
    const m = S.newMind();
    for (let k = 0; k < 30; k++) S.note(m, Object.keys(S.KINDS)[k % 16], i * 10 + k * 200, { a: 'a' + k, w: k % 2 ? i + ':' + k : '' });
    S.reflect(m, i * 10 + 6000, 4); if (i % 2) { S.plMeet(m, i); S.plAdd(m, 'g', i); m.pl.lw = 'Danke nochmal für den Honig!'; }
    st.p['overworld/v' + (i % 9) + ':' + i + ':0'] = m;
  }
  for (let v = 0; v < 40; v++) { const d = st.r['v' + v] = {}; for (let k = 0; k < 70; k++) d[k + ':0|' + (k + 1) + ':0'] = ((k % 7) - 3) / 10; }
  st.q.v1 = S.qNew('1:0', '2:0', 4, 3); S.qStep(st.q.v1, { day: 4, beat: true });
  const o = S.save(st), js = JSON.stringify(o);
  check(Object.keys(o.p).length === S.MAXP, `capped at ${S.MAXP} people (${Object.keys(o.p).length})`);
  check(Object.values(o.p).every(p => p.m.length <= S.SAVE_MEM), `≤ ${S.SAVE_MEM} memories each in the save`);
  check(Object.keys(o.r).length <= S.MAXV && Object.values(o.r).every(d => Object.keys(d).length <= S.MAXR), 'the graphs capped');
  check(js.length < 60000, `compact: ${(js.length / 1024).toFixed(1)} KB`);
  const back = S.load(JSON.parse(js));
  const id = Object.keys(o.p)[0], m0 = st.p[id], m1 = back.p[id];
  check(!!m1 && m1.b.length === m0.b.length && m1.b.every((b, k) => b.b === m0.b[k].b && Math.abs(b.s - m0.b[k].s) < 0.006), 'the beliefs survive the round trip');
  check(m1.m.length === Math.min(S.SAVE_MEM, m0.m.filter(e => e.k !== 'seen').length) && m1.m.every(e => S.KINDS[e.k] && e.i >= 1 && e.i <= 10), 'the strongest memories survive');
  const hasPl = Object.keys(o.p).find(k => st.p[k].pl);
  check(back.p[hasPl].pl.g === st.p[hasPl].pl.g && back.p[hasPl].pl.lw === 'Danke nochmal für den Honig!', 'the player relation and the last words survive');
  check(back.q.v1 && back.q.v1.ph === 'cold' && back.q.v1.a === '1:0' && back.q.v1.tp === st.q.v1.tp, 'the quarrel survives');
  check(JSON.stringify(S.save(back)) === JSON.stringify(S.save(S.load(S.save(back)))), 'save ∘ load is stable');
  const bad = S.load({ v: 1, p: { x: 5, y: { m: [[99, 1, 1], 'z', [1, 2, 3]], b: [[42, 1]], pl: 'no' } }, r: { v: { 'a|b': 'q', c: 3 } }, q: { v: [1, 2, 99] } });
  check(bad.p.y && bad.p.y.m.length === 1 && bad.p.y.b.length === 0 && !bad.p.y.pl && !bad.q.v && Object.keys(bad.r.v).length === 0, 'a broken save is cleaned');
  check(Object.keys(S.load(null).p).length === 0 && Object.keys(S.load({ v: 9 }).p).length === 0, 'none or a newer version → fresh');
}

console.log('i · speech');
{
  const I = V.I18N, de = I.dict.de, en = I.dict.en;
  const keys = Object.keys(de).filter(k => k.indexOf('g.se.') === 0);
  const lists = keys.filter(k => Array.isArray(de[k]));
  let nLines = 0; for (const k of lists) nLines += de[k].length;
  check(nLines >= 60, `≥ 60 new lines (${nLines} German templates in ${lists.length} lists)`);
  const FULL = { name: 'Mira', me: 'Ole', item: 'den Honig', who: 'Lena', who2: 'Jan', thing: 'unsere neue Bäckerei', wunder: 'den Himmelswal Ombra', ev: 'Ein Gewitter zog vorüber.', what: 'Picknick', topic: 'die Farbe des Gartenzauns', when: 'gestern', n: 3 };
  let unfilled = [];
  for (const L of [de, en]) for (const k of keys) { const arr = Array.isArray(L[k]) ? L[k] : [L[k]]; for (const t of arr) { const s = S.fill(t, FULL); if (/\{|undefined/.test(s)) unfilled.push(k + ': ' + s); } }
  check(!unfilled.length, 'every g.se template fills every slot (both languages)' + (unfilled.length ? ': ' + unfilled.slice(0, 3).join(' · ') : ''));
  const now = 20 * DAY;
  const ctxFor = (lang, mind, extra) => {
    I.set(lang);
    const T = (k, v) => I.t(k, v);
    return Object.assign({
      mind, now, name: 'Mira', me: 'Ole', meId: '9:0',
      who: (id) => ({ '1:0': 'Lena', '2:0': 'Jan', '3:0': 'Ida' }[id] || 'Tom'),
      item: (id) => (de['g.se.it.' + id] ? T('g.se.it.' + id) : T('g.se.it.any', { n: id })),
      wunder: (k) => T('g.se.wu.' + k, { n: 'Ombra' }), thing: (b) => T('g.se.b.' + (b || 'home')), ev: () => 'Ein Gewitter zog vorüber.',
      moment: (k) => T('g.se.mo.' + k), topic: (n) => I.list('g.se.topic')[n % 8],
      when: (min) => (min < 180 ? T('g.se.when.now') : min < 600 ? T('g.se.when.today') : min < 2400 ? T('g.se.when.yesterday') : T('g.se.when.days', { n: Math.round(min / DAY) })),
    }, extra || {});
  };
  const L = (k) => I.list(k);
  const bad = [];
  const okText = (r, what) => { if (!r || !r.text || /undefined|\{|\}|NaN/.test(r.text)) bad.push(what + ': ' + (r ? r.text : 'null')); return r; };
  const one = { gift: { a: 'honey_bottle' }, helped: {}, danced: {}, hurt: {}, storm: {}, wunder: { a: 'whale' }, build: { a: 'bakery' }, chronik: { a: 'e3' }, moment: { a: 'picnic', w: '1:0' }, hug: { w: '2:0' }, fgift: { a: 'poppy', w: '3:0' }, quarrel: { a: 3, w: '1:0' }, made_up: { w: '1:0' }, danger: {} };
  let memWins = 0, memKinds = 0;
  for (const lang of ['de', 'en']) for (const k of Object.keys(one)) for (let seed = 0; seed < 6; seed++) {
    const m = mk([[k, now - 700, one[k]]]);
    const c = ctxFor(lang, m);
    const g = okText(S.greet(c, L, seed), lang + ' greet ' + k);
    if (S.KINDS[k][1] & S.TAGS.pl && k !== 'talk') { memKinds++; if (g && g.key === 'g.se.gr.' + k) memWins++; }
    if (!(S.KINDS[k][1] & S.TAGS.pl)) { const s = okText(S.small(c, L, seed), lang + ' small ' + k); if (s && s.key !== 'g.se.st.' + k) bad.push('small talk not about the memory ' + k); }
    okText(S.bye(c, L, seed), lang + ' bye ' + k);
  }
  check(memWins === memKinds, `a memory of the player always shapes the greeting (${memWins}/${memKinds})`);
  {
    const m = mk([['gift', now - 300, { a: 'honey_bottle' }]]);
    const r = S.greet(ctxFor('de', m), L, 0);
    check(r.text === 'Danke nochmal für den Honig, Mira!', 'the honey remembered: „' + r.text + '“');
  }
  for (const lang of ['de', 'en']) for (const b of S.BELIEFS) for (let seed = 0; seed < 4; seed++) {
    const m = S.newMind(); m.b = [{ b, s: 0.6, a: b === 'proud' ? 'well' : b === 'awed' ? 'tree' : '', w: b === 'fond' || b === 'upset' ? '2:0' : '', d: 1 }];
    okText(S.feelLine(ctxFor(lang, m), L, seed), lang + ' feel ' + b);
    const f = { w: '3:0', mind: m };
    if (b !== 'fond' && b !== 'upset') okText(S.gossip(ctxFor(lang, S.newMind(), { friends: [f] }), L, seed), lang + ' gossip ' + b);
    okText(S.chat(ctxFor(lang, m, { friends: [f] }), L, seed), lang + ' chat ' + b);
  }
  for (const lang of ['de', 'en']) {
    okText(S.gossip(ctxFor(lang, S.newMind(), { q: { a: '1:0', b: '2:0', ph: 'cold', tp: 4 } }), L, 1), lang + ' gossip quarrel');
    for (const f of S.FEEL) { const m = S.newMind(); m.pl = S.newPl(); okText(S.greet(ctxFor(lang, m, {}), L, 2), lang + ' greet feel'); void f; }
    for (const k of ['q.spat', 'q.cold', 'q.bench', 'q.gift', 'q.thanks', 'meet', 'hurry', 'show', 'come', 'sky']) for (let seed = 0; seed < 4; seed++) okText(S.beat(k, ctxFor(lang, S.newMind()), L, seed, { who: 'Lena', thing: I.t('g.se.b.well'), wunder: I.t('g.se.wu.whale', { n: 'Ombra' }) }), lang + ' beat ' + k);
    const sm = mk([['storm', now - 60, { i: 7 }]]); S.reflect(sm, now, 20);
    const by = S.bye(ctxFor(lang, sm, { stormNear: true }), L, 0);
    if (by.key !== 'g.se.by.storm') bad.push('a storm-fearing villager says goodbye for the storm');
  }
  check(!bad.length, 'every line filled, nothing undefined, small talk about the memory' + (bad.length ? ': ' + bad.slice(0, 4).join(' · ') : ''));
  I.set('de');
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

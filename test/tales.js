// a-quest — the Geschichten: adventures that grow out of friendship and news (src/main/tales_core.js, the glue
// src/main/tales.js; plan docs/superpowers/plans/2026-11-02-a-quest.md). Pure game rules, no language model:
//  1. the generator: the same seed, counter, giver and world → the same tale (determinism); another seed → others
//  2. every template (with each of its twists and ways) is completable for a builder, an adventurer and an explorer,
//     in 3–8 minutes by the estimate; builders build, the others find
//  3. no repeats: never the same template twice in a row while another fits, no template + twist within TC.NOREP
//  4. the news weighs: a freed outpost makes the beacon likelier, a fairy place the lost child
//  5. the save mid-quest: round trip, the progress kept, the tale goes on the same; an old / damaged / newer record
//  6. the deadline (the festival at dusk) and the gentle late ending; the rewards, the page, the lit beacon
//  7. every key in both language tables (German first), the placeholders the same
//   bash test/wt_run.sh tales.js 300
const VR = global.VR = {};
global.self = global;
for (const f of ['i18n', 'lang_en', 'lang_de']) require(__dirname + '/../src/main/' + f + '.js');
require(__dirname + '/../src/main/tales_core.js');
const TC = VR.TalesCore, D = TC.DAY;
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
// a world: the giver's village at (800, 0), villages around, fairy places near the middle, hills, the temple's gate
function world(seed, o) {
  o = o || {};
  const r = (k) => TC.h(seed, k) / 4294967296;
  const gx = 800 + Math.round(r('gx') * 80), gz = Math.round(r('gz') * 80);
  return {
    seed, n: o.n || 0, t: o.t === undefined ? 2 * D + 3000 : o.t, dim: 'overworld', role: o.role || 'explorer',
    giver: { pid: 'overworld/p' + (seed % 7), name: 'Lene', sur: 'Brandt', vid: 'v1', vn: 'Birkenau', x: gx, z: gz, kids: o.nokid ? [] : [{ pid: 'overworld/k1', name: 'Mira' }, { pid: 'overworld/k2', name: 'Jo' }] },
    villages: [{ id: 'v1', name: 'Birkenau', x: gx, z: gz }, { id: 'v2', name: 'Sonnfurt', x: gx + 420, z: gz + 200 + Math.round(r('v2') * 100) }, { id: 'v3', name: 'Kleewiese', x: gx - 300, z: gz + 520 }, { id: 'v9', name: 'Fernau', x: gx + 3000, z: 0 }],
    fairy: o.nofairy ? [] : [{ id: 'f1', kind: 'shroom', name: 'Leuchtpilzwald', x: 260 + Math.round(r('f') * 60), z: 120 }],
    hills: [{ x: gx + 160, z: gz - 150, y: 120 }],
    gate: o.nogate ? null : { x: 380, z: -200, name: 'Tempel' },
    home: o.home === undefined ? { x: gx + 40, z: gz + 60 } : o.home,
    news: o.news || [], toName: 'Ottilie',
  };
}

console.log('1 · the generator is a pure function of its inputs');
{
  const a = TC.make(world(11, { n: 3 }), TC.fresh()), b = TC.make(world(11, { n: 3 }), TC.fresh());
  check(!!a && JSON.stringify(a) === JSON.stringify(b), `the same seed, counter and giver → the same tale (${a && a.t}:${a && a.v}, ${a && a.steps.length} steps)`);
  const seen = new Set(); for (let s = 1; s <= 40; s++) { const q = TC.make(world(s), TC.fresh()); if (q) seen.add(q.t + ':' + q.v); }
  check(seen.size >= 9, `forty seeds → ${seen.size} different template + twist pairs`);
  const all = new Set(); for (let s = 1; s <= 60; s++) { const q = TC.make(world(s), TC.fresh()); if (q) all.add(q.t); }
  check(all.size === TC.list().length, `every template is drawn (${[...all].sort().join(', ')})`);
  check(TC.make(world(5, { nokid: true, nofairy: true }), TC.fresh()).t !== 'lost', 'no child, no fairy place → never the lost child');
  const q = TC.make(world(7, { nogate: true }), TC.fresh()), L = TC.options(world(7, { nogate: true })).find(o => o.t === 'letter');
  check(L && L.way.id === 'hills', 'no Lichtbrücke in reach → the letter goes over the hills to a far village');
  check(TC.options(world(7)).find(o => o.t === 'letter').way.id === 'bridge', 'the gate in reach → the letter crosses the Lichtbrücke');
  check(!!q && q.st === 'offer' && q.i === 0 && q.giver.name === 'Lene', 'a tale starts as an offer by the friend');
}

// the solver: plays one tale as a role would, event by event
function play(tale, role, cap) {
  const ev = []; let guard = 0, twist = false, done = false;
  const pos = (p) => ({ k: 'pos', x: p[0] + 0.5, z: p[1] - 0.5, dim: tale.dim0 });
  while (!done && guard++ < (cap || 60)) {
    const s = TC.cur(tale); if (!s) break;
    let b = s;
    if (s.k === 'any') b = s.of.find(q => q.roles.indexOf(role) >= 0);
    let E = [];
    if (b.k === 'go') E = [pos(b.p)];
    else if (b.k === 'marks') E = [pos(b.pts[b.m])];
    else if (b.k === 'place') E = [{ k: 'placed', x: b.p[0] + 1, y: 70, z: b.p[1], cats: [b.cat], dim: tale.dim0 }];
    else if (b.k === 'build') { const c = b.cats[b.c % b.cats.length]; E = [{ k: 'placed', x: b.p[0] + 1, y: 70, z: b.p[1] + 1, cats: [c], dim: tale.dim0 }]; }
    else if (b.k === 'talk') E = [{ k: 'meet', x: b.p[0] + 2, z: b.p[1], dim: tale.dim0 }];
    else if (b.k === 'meet') E = [{ k: 'meet', x: 0, z: 0, dim: 'moon_basalt' }];
    else if (b.k === 'cross') E = [{ k: 'dim', dim: b.back ? tale.dim0 : 'moon_basalt' }];
    for (const e of E) { ev.push(e); for (const o of TC.feed(tale, e)) { if (o.k === 'twist') twist = true; if (o.k === 'done') done = true; } }
  }
  return { done, twist, n: ev.length, ev };
}
console.log('2 · every template, every twist, every way: completable for each role, 3–8 minutes');
{
  let combos = 0, okAll = true, okTw = true, minS = 1e9, maxS = 0, bad = [];
  const builderBuilt = { n: 0 }, finderFound = { n: 0 };
  for (const tn of TC.list()) {
    const T0 = TC.TPL[tn];
    for (const gate of [true, false]) for (const v of Object.keys(T0.twists)) for (const role of TC.ROLES) {
      let tale = null;
      for (let s = 1; s < 400 && !tale; s++) { const w = world(s, { nogate: !gate }); const o = TC.options(w).find(x => x.t === tn); if (!o) continue; const q = TC.make(w, { hist: TC.list().filter(x => x !== tn).map(x => ({ t: x, v: '' })).concat([{ t: 'x', v: '' }]) }); if (q && q.t === tn && q.v === v) tale = q; }
      if (!tale) { // (a twist the hash did not draw in 400 seeds: build it from a forced history)
        const w = world(3, { nogate: !gate }), hist = []; for (const x of TC.list()) if (x !== tn) for (const vv of Object.keys(TC.TPL[x].twists)) hist.push({ t: x, v: vv });
        for (const vv of Object.keys(T0.twists)) if (vv !== v) hist.push({ t: tn, v: vv });
        tale = TC.make(w, { hist: hist.slice(-TC.NOREP) });
        if (!tale || tale.t !== tn || tale.v !== v) { bad.push(`${tn}:${v}`); continue; }
      }
      combos++;
      TC.accept({ n: 0 }, tale, tale.t0, role);
      const est = TC.estimate(tale, role);
      const R = play(tale, role);
      if (!R.done) { okAll = false; bad.push(`${tn}/${tale.way}/${v}/${role}`); }
      if (tale.twAt >= 0 && !R.twist) okTw = false;
      if (est < 180 || est > 480) bad.push(`${tn}/${tale.way}/${v}/${role}: ${Math.round(est)} s`);
      minS = Math.min(minS, est); maxS = Math.max(maxS, est);
      if (role === 'builder' && R.ev.some(e => e.k === 'placed')) builderBuilt.n++;
      if (role !== 'builder' && tale.steps.some(s => s.k === 'any' && s.of[s.by] && s.of[s.by].k === 'marks')) finderFound.n++;
    }
  }
  check(okAll && !bad.length, `${combos} plays (templates × ways × twists × roles) all end well` + (bad.length ? ': ' + bad.slice(0, 6).join(' · ') : ''));
  check(okTw, 'each reaches its twist on the way');
  check(minS >= 180 && maxS <= 480, `the estimate stays within 3–8 minutes (${(minS / 60).toFixed(1)}–${(maxS / 60).toFixed(1)} min)`);
  check(builderBuilt.n >= 18 && finderFound.n >= 36, `builders build (${builderBuilt.n} plays placed blocks), adventurers and explorers find (${finderFound.n})`);
  // a step is not done by the wrong thing: a stone where a light belongs, a block far from the plot
  const w = world(2); let t = null; for (let s = 1; s < 200 && !t; s++) { const q = TC.make(world(s), { hist: [{ t: 'lost', v: '' }] }); if (q && q.t === 'beacon') t = q; }
  TC.accept({ n: 0 }, t, 0, 'builder'); TC.feed(t, { k: 'pos', x: t.steps[0].p[0], z: t.steps[0].p[1], dim: 'overworld' }); TC.feed(t, { k: 'pos', x: t.steps[1].pts[0][0], z: t.steps[1].pts[0][1], dim: 'overworld' });
  const s1 = TC.cur(t), p = s1.of[0].p;
  TC.feed(t, { k: 'placed', x: p[0], y: 1, z: p[1], cats: ['stone'], dim: 'overworld' }); TC.feed(t, { k: 'placed', x: p[0] + 40, y: 1, z: p[1], cats: ['light'], dim: 'overworld' });
  check(s1.of[0].c === 0 && !s1.done, 'a stone is not a light, a light 40 m away is not at the beacon');
  for (let i = 0; i < 3; i++) TC.feed(t, { k: 'placed', x: p[0] + 2, y: 1, z: p[1] - i, cats: ['light'], dim: 'overworld' });
  check(s1.done && s1.by === 0, 'three lights by the beacon wake it (the builder way)');
  void w;
}

console.log('3 · no repeats');
{
  const rec = TC.fresh(); let twice = 0, rep = 0; const seq = [];
  for (let n = 0; n < 40; n++) {
    const q = TC.make(world(77, { n }), rec); if (!q) continue;
    const last = rec.hist[rec.hist.length - 1]; if (last && last.t === q.t) twice++;
    if (rec.hist.slice(-TC.NOREP).some(h => h.t === q.t && h.v === q.v)) rep++;
    seq.push(q.t[0] + q.v[0]);
    rec.hist.push({ t: q.t, v: q.v, d: n }); rec.hist = rec.hist.slice(-TC.HIST);
  }
  check(twice === 0, 'forty tales in a row: never the same template twice in a row');
  check(rep === 0, `no template + twist within the last ${TC.NOREP} (${seq.join(' ')})`);
  // with only one template possible it still offers one (no dead end)
  const one = TC.make(Object.assign(world(9, { nokid: true, nogate: true }), { villages: [], hills: [], home: null }), { hist: [{ t: 'home', v: 'seed' }] });
  check(one && one.t === 'home', 'only one template fits → it is offered again (with another twist: ' + (one && one.v) + ')');
}

console.log('4 · the news weighs');
{
  const count = (news) => { const c = {}; for (let s = 1; s <= 300; s++) { const q = TC.make(world(s, { news }), TC.fresh()); if (q) c[q.t] = (c[q.t] || 0) + 1; } return c; };
  const base = count([]), freed = count([{ k: 'freed', pl: 'Nordwacht', score: 9 }]), fairy = count([{ k: 'fairy', pl: 'Leuchtpilzwald', score: 7 }]);
  check(freed.beacon > base.beacon * 1.5, `a freed outpost → the sleepy beacon more often (${base.beacon} → ${freed.beacon} of 300)`);
  check(fairy.lost > base.lost * 1.5, `a fairy place found → the lost child more often (${base.lost} → ${fairy.lost})`);
  const q = TC.make(world(4, { news: [{ k: 'freed', pl: 'Nordwacht', score: 9 }] }), TC.fresh());
  check(q.news && q.news.k === 'freed' && q.news.pl === 'Nordwacht', 'the offer remembers the news it grew out of');
}

console.log('5 · the save mid-quest');
{
  let q = null; for (let s = 1; s < 300 && !q; s++) { const x = TC.make(world(s), { hist: [{ t: 'beacon', v: '' }] }); if (x && x.t === 'lost') q = x; }
  const rec = TC.fresh(); TC.accept(rec, q, 2 * D, 'explorer');
  TC.feed(q, { k: 'pos', x: q.steps[0].p[0], z: q.steps[0].p[1], dim: 'overworld' });
  const tr = TC.cur(q).of[0]; TC.feed(q, { k: 'pos', x: tr.pts[0][0], z: tr.pts[0][1], dim: 'overworld' });
  const saved = JSON.stringify(TC.save(rec)), back = TC.load(JSON.parse(saved));
  check(back.cur && back.cur.i === 1 && TC.cur(back.cur).of[0].m === 1, `saved at step ${q.i + 1} of ${q.steps.length}, one footprint found → loaded the same`);
  const A = play(q, 'explorer'), B = play(back.cur, 'explorer');
  check(A.done && B.done && JSON.stringify(A.ev) === JSON.stringify(B.ev), 'the loaded tale goes on exactly like the one never saved');
  check(TC.load(null).n === 0 && TC.load({ v: 1, cur: { t: 'nope', steps: [] }, hist: 'x' }).cur === null, 'an old save (none) and a damaged one → a fresh, sane record');
  const newer = { v: 9, odd: 1 }; check(TC.load(newer) === newer, 'a newer save\'s record stays untouched');
  check(TC.load({ v: 1, cur: Object.assign({}, back.cur, { steps: [{ k: 'go', p: ['x', 1] }] }) }).cur === null, 'a tale with a broken step is dropped, never half-played');
}

console.log('6 · the deadline, the ending, the rewards');
{
  let q = null; for (let s = 1; s < 300 && !q; s++) { const x = TC.make(world(s, { t: 3 * D + 2000 }), { hist: [{ t: 'lost', v: '' }] }); if (x && x.t === 'ingr') q = x; }
  check(q.due === 3 * D + TC.DUSK, 'offered in the morning: the festival is this evening at dusk');
  check(TC.dueAt(3 * D + 11000) === 4 * D + TC.DUSK, 'offered just before dusk: the festival of tomorrow (never a rush)');
  const rec = TC.fresh(); TC.accept(rec, q, q.t0, 'adventurer'); play(q, 'adventurer');
  const late = TC.finish(rec, q.due + 500);
  check(late && late.late && /\.late$/.test(late.key), 'too late → the gentle late ending (' + late.key + ')');
  check(rec.cur === null && rec.pages.length === 1 && rec.pages[0].t === 'ingr' && rec.cool > q.due, 'the Wanderbuch page, the tale done, a short rest before the next offer');
  let b = null; for (let s = 1; s < 300 && !b; s++) { const x = TC.make(world(s), { hist: [{ t: 'lost', v: '' }] }); if (x && x.t === 'beacon') b = x; }
  const r2 = TC.fresh(); TC.accept(r2, b, 0, 'builder'); play(b, 'builder'); const res = TC.finish(r2, 1000);
  check(res && res.lit && r2.lit.length === 1 && res.fr >= 3 && res.items.length && res.verse, 'the beacon stays lit, friendship, an item, a song verse');
  check(TC.canOffer(r2, r2.cool - 1) === false && TC.canOffer(r2, r2.cool) === true, 'one offer at a time, never right after the last');
  const r3 = TC.fresh(); TC.decline(r3, 5000); check(!TC.canOffer(r3, 5000 + D * 0.5) && TC.canOffer(r3, 5000 + D), '„Ein andermal" → nobody asks again for most of a day');
  check(TC.catsOf('oak_planks').indexOf('wood') >= 0 && TC.catsOf('torch', { emit: 1 })[0] === 'light' && TC.catsOf('poppy').indexOf('flower') >= 0 && TC.catsOf('oak_door', { door: 1 }).indexOf('door') >= 0, 'the kinds of blocks: wood, light, flower, door');
}

console.log('7 · the words');
{
  const I = VR.I18N, en = I.dict.en || {}, de = I.dict.de || {}, K = TC.keys();
  const miss = K.filter(k => !(k in de) || !(k in en));
  check(!miss.length, `${K.length} keys in both tables` + (miss.length ? ': missing ' + miss.slice(0, 10).join(', ') + (miss.length > 10 ? ' … ' + miss.length : '') : ''));
  const ph = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join();
  const diff = K.filter(k => k in de && k in en && ph(de[k]) !== ph(en[k]));
  check(!diff.length, 'the same placeholders in both' + (diff.length ? ': ' + diff.slice(0, 6).join(', ') : ''));
  const longDe = K.filter(k => k in de && /\.s\./.test(k) && String(de[k]).length > 120);
  check(!longDe.length, 'the HUD lines are short (≤ 120 characters)' + (longDe.length ? ': ' + longDe.join(', ') : ''));
}
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);

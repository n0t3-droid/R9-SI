// o-wander — the Wanderregisseur's pure core (docs/superpowers/plans/2026-10-31-o-wander.md, src/main/wander.js):
//  · the slots 20–40 s apart; slotAt finds the latest; the pick a pure function of (seed, slot, ctx, recent);
//  · never one of the last five; the family of the last one avoided when another fits; ≥ 16 moments, each with a tier,
//    a duration, its terrain and hours; every hour and terrain has a tier-0 moment (Very Low is never empty); Very Low
//    picks tier 0 only; a walk of 200 slots through changing terrain sees ≥ 12 kinds and no quiet slot;
//  · the Wanderbuch's record (meta.wander): first finds, the counts, an odd record reads as new; the soft progress;
//  · the rewards (a sticker always; Abenteuer XP and Heliataler, else a snack, a recipe or a block);
//  · the next place (unvisited, in front preferred), the Wegballon's point (ahead, then over the place), the signpost's
//    lines (the nearest places, metres, the compass);
//  · every key the module names is in both language tables.
//   bash test/wt_run.sh wander.js 300
const V = require('./load_shared.js');
for (const f of ['i18n', 'lang_en', 'lang_de']) require(__dirname + '/../src/main/' + f + '.js');
global.window = global.window || {};
global.performance = global.performance || { now: () => Date.now() };
for (const f of ['lifekit', 'lifedirector', 'wander']) require(__dirname + '/../src/main/' + f + '.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const W = V.Wander;
check(!!W && !!W.pick && !!W.Actor && !!W.book, 'the Wanderregisseur exists (VR.Wander: pick, Actor, book)');

// ---------------------------------------------------------------- the moments
const N = W.NAMES;
check(N.length >= 16, `at least sixteen moments (${N.length}: ${N.join(', ')})`);
check(N.every(n => { const K = W.KINDS[n]; return K.tier >= 0 && K.tier <= 2 && K.dur > 0 && K.fam && K.at.length && K.hours.length && K.w > 0; }), 'every moment has a tier, a duration, a family, its terrain, its hours and a weight');
for (const hour of W.HOURS) for (const at of ['way', 'open', 'wood', 'hill']) {
  const c = W.candidates({ at, hour, wet: false, bow: false, tier: 0 });
  if (c.length < 3) check(false, `tier 0 has ≥ 3 moments at ${at} / ${hour} (${c.join(', ')})`);
}
check(true, 'every hour and terrain has at least three Very Low moments');

// ---------------------------------------------------------------- the slots
{
  let minGap = 1e9, maxGap = 0;
  for (const seed of [1, -77, 4242]) for (let k = 0; k < 3000; k++) { const g = W.slotTime(seed, k + 1) - W.slotTime(seed, k); minGap = Math.min(minGap, g); maxGap = Math.max(maxGap, g); }
  check(minGap >= 20 && maxGap <= 40, `the slots come 20–40 s apart (${minGap.toFixed(1)} – ${maxGap.toFixed(1)})`);
  let bad = 0; for (let t = 0; t < 20000; t += 3.7) { const k = W.slotAt(4242, t); if (!(W.slotTime(4242, k) <= t && W.slotTime(4242, k + 1) > t)) bad++; }
  check(!bad, `slotAt finds the latest slot at any time (${bad} wrong)`);
}

// ---------------------------------------------------------------- the walk: rhythm, no repeats, determinism
const TERR = ['way', 'open', 'way', 'wood', 'hill', 'open', 'near', 'way', 'water', 'village'];
const ctxAt = (k, tier) => ({ at: TERR[(k * 7 >> 3) % TERR.length], hour: W.HOURS[Math.floor(k / 20) % W.HOURS.length], wet: k % 37 > 33, bow: k % 37 === 35, tier: tier === undefined ? 2 : tier });
const walk = (seed, n, tier) => W.simulate(seed, n, (k) => ctxAt(k, tier));
{
  const a = walk(4242, 200), b = walk(4242, 200), c = walk(77, 200);
  check(JSON.stringify(a) === JSON.stringify(b), 'the same seed walks the same moments (deterministic)');
  check(JSON.stringify(a) !== JSON.stringify(c), 'another seed walks other moments');
  let rep = 0, quiet = 0, famRep = 0;
  for (let i = 0; i < a.length; i++) {
    if (!a[i]) { quiet++; continue; }
    for (let j = Math.max(0, i - W.REPEAT); j < i; j++) if (a[j] === a[i]) rep++;
    if (i && a[i - 1] && W.KINDS[a[i - 1]].fam === W.KINDS[a[i]].fam && W.candidates(ctxAt(i + 1)).some(n => W.KINDS[n].fam !== W.KINDS[a[i]].fam && !a.slice(Math.max(0, i - W.REPEAT), i).includes(n))) famRep++;
  }
  check(!rep, `no moment again within ${W.REPEAT} slots (${rep} repeats)`);
  check(!famRep, `no family twice in a row while another fits (${famRep})`);
  check(quiet === 0, `no quiet slot in 200 (${quiet})`);
  const kinds = new Set(a.filter(Boolean));
  check(kinds.size >= 12, `a long walk sees ≥ 12 kinds (${kinds.size})`);
  const vl = walk(4242, 200, 0);
  check(vl.every(n => !n || W.KINDS[n].tier === 0), 'Very Low picks tier-0 moments only');
  check(vl.filter(Boolean).length >= 190, `Very Low is rarely quiet (${vl.filter(Boolean).length} / 200)`);
  check(a.includes('rainbow') || !a.some((_, k) => ctxAt(k).bow), 'the rainbow is noticed when there is one');
  // order: the pick first, all allowed, no repeats in it
  const ctx = ctxAt(3), o = W.order(4242, 3, ctx, []);
  check(o[0] === W.pick(4242, 3, ctx, []) && new Set(o).size === o.length && o.every(n => W.allowed(n, ctx)), 'the order starts with the pick and lists each allowed moment once');
  check(W.pick(4242, 9, { at: 'open', hour: 'noon', wet: true, bow: false, tier: 2 }, []) !== 'kites', 'no kites in the rain');
}

// ---------------------------------------------------------------- the Wanderbuch
{
  const meta = {};
  check(W.note(meta, 'places', 'temple') === true && W.note(meta, 'places', 'temple') === false, 'a place is new once');
  W.note(meta, 'stickers', 'picnic'); W.note(meta, 'people', 'Mira'); W.note(meta, 'creatures', 'fox');
  const P = W.progress(meta);
  check(P.places.n === 1 && P.stickers.n === 1 && P.people.n === 1 && P.creatures.n === 1 && P.stickers.of >= 16, 'the progress counts each page (the stickers of ' + P.stickers.of + ')');
  check(P.places.f > 0 && P.places.f < 1, 'the progress is soft (a fraction, never a demand)');
  const odd = { wander: 'nonsense' }; W.book(odd);
  check(odd.wander && typeof odd.wander === 'object' && W.progress(odd).places.n === 0, 'an odd record reads as new');
  const odd2 = { wander: { places: 7, stickers: ['x'] } }; W.book(odd2);
  check(W.progress(odd2).places.n === 0 && W.progress(odd2).stickers.n === 0, 'odd pages read as empty');
}

// ---------------------------------------------------------------- the rewards
{
  let ok = true;
  for (const n of N) for (const adv of [true, false]) { const r = W.reward(n, adv); if (!r || r.sticker !== n) ok = false; if (adv && !(r.xp > 0 || r.taler > 0)) ok = false; if (!adv && r.item && !(V.R.byName[r.item[0]] || (V.ITEMS && V.ITEMS[r.item[0]]))) { ok = false; console.log('    unknown item', r.item[0]); } }
  check(ok, 'every moment gives a sticker; in Abenteuer XP or Heliataler; elsewhere a real item when it gives one');
}

// ---------------------------------------------------------------- the next place, the beacon, the sign
{
  const places = [{ id: 'a', x: 100, z: 0, name: 'A' }, { id: 'b', x: -100, z: 0, name: 'B' }, { id: 'c', x: 0, z: 400, name: 'C' }];
  const yawE = Math.atan2(-1, 0);   // facing +x (the models face −z: yawOf(1, 0))
  const n1 = W.nextPlace(places, [0, 70, 0], yawE, {});
  check(n1 && n1.id === 'a', 'the next place: the near one in front (' + (n1 && n1.id) + ')');
  const n2 = W.nextPlace(places, [0, 70, 0], yawE, { a: 1 });
  check(n2 && n2.id === 'b', 'a visited place is skipped (' + (n2 && n2.id) + ')');
  const n3 = W.nextPlace(places, [0, 70, 0], yawE, { a: 1, b: 1, c: 1 });
  check(n3 && n3.id !== undefined, 'all visited: still a place to walk to');
  const b1 = W.beacon([0, 70, 0], { x: 0, z: 400 }, 0);
  const d1 = Math.hypot(b1[0], b1[2]);
  check(d1 >= 55 && d1 <= 95 && b1[2] > 0, `the Wegballon floats 55–95 m ahead toward a far place (${d1.toFixed(0)} m)`);
  const b2 = W.beacon([0, 70, 380], { x: 0, z: 400 }, 0);
  check(Math.hypot(b2[0], b2[2] - 400) < 6, 'near the place it stands over it');
  check(b1[1] > 12 && b1[1] < 40, `it floats up in the air (${b1[1].toFixed(1)} m)`);
  const L = W.signLines(places, [0, 70, 0], 2);
  check(L.length === 2 && L[0].d <= L[1].d && L[0].dir && /^(n|ne|e|se|s|sw|w|nw)$/.test(L[0].dir), 'the signpost: the two nearest places, metres and the compass');
}

// ---------------------------------------------------------------- the words
{
  const I = V.I18N, de = I && I.dict && I.dict.de, en = I && I.dict && I.dict.en;
  const keys = W.keys(); let miss = [];
  if (de && en) for (const k of keys) if (!(k in de) || !(k in en)) miss.push(k);
  check(de && en && !miss.length, `every key of the module is in both tables (${keys.length} keys${miss.length ? '; missing ' + miss.slice(0, 6).join(', ') : ''})`);
}

console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);

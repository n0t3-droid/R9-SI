// Der Weg des Abenteurers (a-rpg; plan docs/superpowers/plans/2026-10-30-a-rpg.md). Every rule a check:
//   1. the time-to-level curve: an adventurer's hour (BAL.hour, the first ten minutes' finds) through VR.Adv.award with
//      Anfängerglück — level 1 within 6 min, 5 within 40, 10 within 1–2.5 h, 20 within 4–10 h, no gap over 30 min below 10
//   2. the Heliataler against the shop: the first upgrade within 25 min, every upgrade within 15–60 h; the daily
//      tribute of five outposts at most half of an active hour; a claim at most every ten minutes
//   3. gear: the same seed the same find, the rarities by source (a boss: splendid or radiant), Glück moves finds up,
//      perks by rarity within their ranges, the worn sums capped, Schutz never below a half-heart; the bag (12, the
//      weakest salvaged), equip / unequip / salvage; garbage loads sane
//   4. the conquest: regions of 1024 blocks, their share and the world's, the boss locked → ready → won, the Kernfeuer
//      amid the freed beacons; the tribute ×1.5 in a region freed whole, ×2 healed
//   5. Der Turmgänger: every attack telegraphed ≥ 0.6 s (all bands), three phases in order, the shield holds every hit
//      until its drones are down, weak points only open after an attack; a scripted Normal fight lasts 2–5 min; the
//      calm version always solvable (nine calm rings), 'won' once
//   6. the loot burst's coins, the fanfare longer for the rarer find; the texts in both tables
//   bash test/wt_run.sh rpg.js 300
const fs = require('fs'), path = require('path');
const V = require('./load_shared.js');
const SRC = path.join(__dirname, '../src/');
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
if (!fs.existsSync(SRC + 'shared/rpg.js')) { console.log('  ✗ src/shared/rpg.js missing'); console.log('FAILED 1'); process.exit(1); }
require(SRC + 'shared/rpg.js');
const R = V.RPG, Adv = V.Adv, B = R.BAL;

// ---------------------------------------------------------------- 1 · the curve
console.log('1 · the time-to-level curve (an adventurer\'s hour, Anfängerglück)');
const lvAt = {}, talAt = {};
{
  const H = B.hour, rec = Adv.fresh({ on: true }), me = rec.me, sess = Adv.session();
  const aw = (k, c, t) => { const r = Adv.award(me, k, c, t, sess); if (r) R.boost(Adv, me, r); return r; };
  const due = (per, min) => Math.floor(min * per) - Math.floor((min - 1) * per);
  let n = 0;
  for (let min = 1; min <= 600; min++) {
    const t = min * 60000;
    for (let i = 0; i < due(H.foes / 60, min); i++) aw('foe', { kind: ['driller', 'sentry', 'drone'][n++ % 3] }, t);
    for (const s of ['S', 'M', 'L']) for (let i = 0; i < due(H.quests[s] / 60, min); i++) aw('quest', { size: s }, t);
    for (let i = 0; i < due(H.freed / 60, min); i++) aw('freed', { id: 'o' + n++ }, t);
    for (let i = 0; i < due(H.chests / 60, min); i++) aw('chest', { id: 'c' + n++, taler: 60 }, t);
    for (const k of ['biome', 'wow']) for (let i = 0; i < due(H[k] / 60, min); i++) aw(k, { id: k + n++ }, t);
    if (min <= 10) for (const k in B.opening) for (let i = 0; i < due(B.opening[k] / 10, min); i++) aw(k, { id: k + n++ }, t);
    aw('distance', { m: H.distanceKm * 1000 / 60 }, t);
    for (let i = 0; i < Math.round(H.place / 6); i++) aw('place', { x: n++, y: 1, z: 2 }, t);
    for (let l = 0; l <= me.level; l++) if (!lvAt[l]) lvAt[l] = min;
    if (min % 60 === 0) talAt[min / 60] = me.taler;
  }
  console.log('    levels at minute: ' + [1, 2, 3, 5, 10, 15, 20].map(l => 'L' + l + ' ' + lvAt[l]).join(' · '));
  check(lvAt[1] <= 6, 'level 1 within 6 min (' + lvAt[1] + ')');
  check(lvAt[5] <= 40, 'level 5 within 40 min (' + lvAt[5] + ')');
  check(lvAt[10] >= 60 && lvAt[10] <= 150, 'level 10 within 1–2.5 h (' + lvAt[10] + ' min)');
  check(lvAt[20] >= 240 && lvAt[20] <= 600, 'level 20 within 4–10 h (' + lvAt[20] + ' min)');
  let gap = 0; for (let l = 1; l <= 10; l++) gap = Math.max(gap, lvAt[l] - lvAt[l - 1]);
  check(gap <= 30, 'below level 10 never more than 30 min between two levels (' + gap + ')');
  check(R.boostOf(0) === 2 && R.boostOf(4) === 2 && R.boostOf(5) === 1.5 && R.boostOf(10) === 1, 'Anfängerglück ×2 below 5, ×1.5 below 10, then ×1');
}

// ---------------------------------------------------------------- 2 · income against prices
console.log('2 · the Heliataler against the shop');
{
  const perH = talAt[10] / 10;
  let all = 0, first = Infinity; for (const k in Adv.PRICES) for (const p of Adv.PRICES[k]) { all += p; first = Math.min(first, p); }
  const firstMin = first / (talAt[1] / 60);
  console.log('    ' + Math.round(perH) + ' Taler an hour · the cheapest upgrade ' + first + ' · all ' + all);
  check(firstMin <= 25, 'the first upgrade within 25 min (' + firstMin.toFixed(1) + ')');
  check(all / perH >= 15 && all / perH <= 60, 'every upgrade within 15–60 h (' + (all / perH).toFixed(1) + ' h)');
  const st = R.fresh(), five = [0, 1, 2, 3, 4].map(i => ({ id: 's' + i, x: i * 300, z: 0, tier: 4, free: true }));
  const q = R.tribute(st, five, 10);
  check(q.per * 3 <= perH * 0.5, 'the tribute of five outposts (' + q.per + ' a day, 3 days an hour) at most half an active hour');
  check(q.days === 1 && R.claim(st, five, 10, 1e6) === q.per, 'the first claim: one day');
  check(R.claim(st, five, 12, 1e6 + 60000) === 0, 'a second claim within ten minutes: nothing');
  check(R.claim(st, five, 19, 1e6 + 700000) === q.per * 3, 'later: up to three days kept');
}

// ---------------------------------------------------------------- 3 · gear
console.log('3 · gear');
{
  const a = R.roll('o:12_34', 'outpost', 7, 0), b = R.roll('o:12_34', 'outpost', 7, 0);
  check(JSON.stringify(a) === JSON.stringify(b), 'the same seed, the same find');
  const dist = (src, luck) => { const c = [0, 0, 0, 0, 0]; for (let i = 0; i < 4000; i++) c[R.roll(src + i, src, 10, luck).r]++; return c; };
  const ch = dist('chest', 0), op = dist('outpost', 0), bo = dist('boss', 0), lk = dist('chest', 40);
  console.log('    chest ' + ch.join('/') + ' · outpost ' + op.join('/') + ' · boss ' + bo.join('/') + ' · chest with Glück 40 ' + lk.join('/'));
  check(ch[0] > ch[2] && ch[4] === 0, 'a chest: mostly plain, never radiant');
  check(op[2] + op[3] + op[4] > 1600, 'an outpost: rare or better in four of ten');
  check(bo[0] + bo[1] + bo[2] === 0 && bo[4] > 1200, 'the boss: splendid or radiant, radiant in a third');
  check(lk[0] < ch[0] - 400, 'Glück moves finds up');
  let okP = true, okR = true;
  for (let i = 0; i < 3000; i++) {
    const it = R.roll('x' + i, 'outpost', i % 51, 0);
    if (it.p.length !== 1 + B.rarPerks[it.r] || it.p[0][0] !== B.base[it.s].k) okP = false;
    for (const [k, v] of it.p.slice(1)) { const rg = B.perkRange[k]; if (v < rg[0] || v > Math.round(rg[1] * 2)) okR = false; }
    if (new Set(it.p.map(q => q[0])).size !== it.p.length) okP = false;
  }
  check(okP, 'the base by slot, then 0 · 1 · 1 · 2 · 3 different perks by rarity');
  check(okR, 'every perk within its range');
  const st = R.fresh(); for (const s of B.SLOTS) st.eq[s] = { id: s, s, r: 4, v: 0, lv: 50, p: [['kraft', 90], ['schutz', 90], ['glueck', 90], ['ruhe', 90]] };
  const S = R.stats(st);
  check(S.kraft === B.cap.kraft && S.schutz === B.cap.schutz && S.glueck === B.cap.glueck && S.ruhe === B.cap.ruhe, 'the worn sums capped (Kraft ' + S.kraft + ' %, Schutz ' + S.schutz + ' %)');
  check(R.harm(1, st) === 1 && R.harm(4, st) === 2 && R.harm(0, st) === 0, 'Schutz: never below a half-heart for a hit');
  const g = R.fresh(); let salv = 0;
  for (let i = 0; i < 14; i++) { const r = R.give(g, R.roll('bag' + i, 'chest', 3, 0)); salv += r.taler || 0; }
  check(g.bag.length === 12 && salv > 0 && g.n === 14, 'the bag holds twelve, the weakest salvaged for Taler (' + salv + ')');
  check(!R.give(g, R.roll('bag3', 'chest', 3, 0)).ok, 'a find given once');
  const it0 = g.bag[0]; check(R.equip(g, 0) && g.eq[it0.s] === it0 && g.bag.length === 11, 'equip: from the bag onto the character');
  check(R.unequip(g, it0.s) && !g.eq[it0.s] && g.bag.length === 12, 'unequip: back into the bag');
  check(R.salvage(g, 0) > 0 && g.bag.length === 11, 'salvage: Taler for a find');
  const L = R.load({ eq: { tool: { s: 'head', r: 9 }, head: { s: 'head', r: 9, p: [['nope', 3], ['kraft', 1e9]] } }, bag: [1, null, { s: 'feet' }], n: -5, tri: 'x', won: { a: 1, ['x'.repeat(60)]: 1 } });
  check(!L.eq.tool && L.eq.head && L.eq.head.r === 4 && L.eq.head.p.length === 1 && L.eq.head.p[0][1] === 200 && L.bag.length === 1 && L.n === 0 && L.tri === -1 && L.won.a && Object.keys(L.won).length === 1, 'garbage loads sane');
  check(JSON.stringify(R.load(JSON.parse(JSON.stringify(g)))) === JSON.stringify(R.load(g)), 'saved and loaded: the same');
}

// ---------------------------------------------------------------- 4 · the conquest
console.log('4 · the conquest');
{
  const st = R.fresh();
  const sites = [{ id: 'a', x: 100, z: 100, tier: 3, free: true }, { id: 'b', x: 500, z: 300, tier: 3, free: false }, { id: 'c', x: 900, z: 700, tier: 3, free: false }, { id: 'd', x: 1500, z: 100, tier: 4, free: true }];
  let C = R.conquest(sites, st);
  const r0 = C.regions.find(g => g.id === '0_0'), r1 = C.regions.find(g => g.id === '1_0');
  check(C.regions.length === 2 && r0.known === 3 && r1.known === 1, 'regions of 1024 blocks');
  check(r0.boss === 'locked' && r1.boss === 'none', 'the boss: locked with one freed of three, none in a region of one');
  check(r0.pct === 20 && C.pct === Math.round(100 * 2 / 6), 'the shares: region ' + r0.pct + ' %, world ' + C.pct + ' %');
  sites[1].free = true; C = R.conquest(sites, st);
  const r0b = C.regions.find(g => g.id === '0_0');
  check(r0b.boss === 'ready' && r0b.core[0] === 300 && r0b.core[1] === 200, 'two freed: the boss ready, the Kernfeuer amid them (' + r0b.core + ')');
  const t1 = R.tribute(st, sites, 5).per;
  sites[2].free = true; const t2 = R.tribute(st, sites, 5).per;
  st.won['0_0'] = 1; C = R.conquest(sites, st); const t3 = R.tribute(st, sites, 5).per;
  check(C.regions.find(g => g.id === '0_0').boss === 'won' && C.pct === 100, 'everything freed and the boss won: 100 %');
  check(t1 === Math.round(20 + 15 * 1.5) && t2 === Math.round(30 * 1.5 + 15 * 1.5) && t3 === Math.round(60 + 15 * 1.5), 'the tribute: ' + t1 + ' → ' + t2 + ' (freed whole ×1.5) → ' + t3 + ' (healed ×2; the lone outpost\'s region is freed whole)');
  check(R.conquest([], st).pct === 0, 'no outpost known: 0 %');
}

// ---------------------------------------------------------------- 5 · the boss
console.log('5 · Der Turmgänger');
{
  let minTele = 9;
  for (const band of ['easy', 'normal', 'hard']) for (const a of Object.keys(B.boss.tele)) minTele = Math.min(minTele, R.teleOf(a, band));
  check(minTele >= 0.6, 'every attack telegraphed ≥ 0.6 s (the shortest ' + minTele + ' s)');
  // a scripted Normal fight: the calm beam (7, ~4 hits a second at 60 % uptime), 70 % of the hits on an open weak point,
  // the player near half the time; each drone powered down 6 s after the last
  const fight = (band, seed) => {
    const rnd = R.rng('fight' + seed), b = new R.Boss(band, false, rnd), log = [];
    let t = 0, adds = 0, addT = 0, hitT = 0, shieldHits = 0, teleMin = 9, teleT = 0, closedWeak = 0;
    while (b.st !== 'won' && t < 900) {
      const dt = 0.05; t += dt;
      if (adds > 0) { addT += dt; if (addT >= 6) { adds--; addT = 0; } }
      const ev = b.step(dt, { dist: (t % 20) < 10 ? 5 : 14, adds });
      for (const e of ev) { log.push(e); if (e.startsWith('adds:')) adds = +e.slice(5); if (e.startsWith('tele:')) teleT = t; if (e.startsWith('strike:')) teleMin = Math.min(teleMin, t - teleT); }
      hitT += dt;
      if (hitT >= 0.25) { hitT = 0; if (rnd() < 0.6) { const weak = rnd() < 0.7; const wasOpen = b.open, sh = b.shield; const d = b.hit(7, weak ? 'weak' : 'body'); if (sh && d) shieldHits++; if (weak && !wasOpen && d > 7 * B.boss.body + 1e-9) closedWeak++; } }
    }
    return { t, log, shieldHits, teleMin: teleMin + 1e-9, closedWeak };
  };
  const f = fight('normal', 1), f2 = fight('normal', 2), fe = fight('easy', 3), fh = fight('hard', 4);
  console.log('    Normal ' + (f.t / 60).toFixed(1) + ' / ' + (f2.t / 60).toFixed(1) + ' min · Leicht ' + (fe.t / 60).toFixed(1) + ' · Schwer ' + (fh.t / 60).toFixed(1));
  check(f.t >= 120 && f.t <= 300 && f2.t >= 120 && f2.t <= 300, 'a scripted Normal fight lasts 2–5 min');
  check(fe.t < f.t && fh.t > f.t && fh.t <= 420, 'Leicht shorter, Schwer longer (≤ 7 min)');
  const order = f.log.filter(e => /^(fight|phase|shield|adds|won)/.test(e));
  check(order[0] === 'fight' && order.indexOf('phase2') < order.indexOf('phase3') && order.indexOf('shield:on') > order.indexOf('phase2') && order.indexOf('shield:off') < order.indexOf('phase3') && order[order.length - 1] === 'won' && order.filter(e => e === 'won').length === 1, 'the phases in order: fight → 2 (shield, drones) → shield off → 3 → won, once');
  check(f.shieldHits === 0, 'the shield holds every hit');
  check(f.closedWeak === 0, 'the weak points count double only when open');
  check(f.teleMin >= 0.6, 'the scripted fight: every strike ≥ 0.6 s after its warning (' + f.teleMin.toFixed(2) + ' s)');
  check(f.log.some(e => e === 'tele:stomp') && f.log.some(e => e === 'tele:fan') && f.log.some(e => e === 'tele:slam'), 'all three attacks: stomp, slam, fan');
  // the shield falls after its time even with drones up (no stuck fight)
  const b2 = new R.Boss('normal', false, R.rng('s')); b2.st = 'stagger'; b2.t = 0; let off = false, tt = 0;
  b2.step(B.boss.stagger + 0.01, { adds: 3 });
  while (tt < 60 && !off) { tt += 0.1; off = b2.step(0.1, { adds: 3, dist: 20 }).indexOf('shield:off') >= 0; }
  check(off && tt <= B.boss.shieldMax.normal + 0.2, 'the shield falls after ' + B.boss.shieldMax.normal + ' s even with its drones up (' + tt.toFixed(1) + ')');
  // the calm version
  let solved = 0;
  for (let s = 0; s < 50; s++) {
    const c = new R.Boss('normal', true, R.rng('c' + s)); let n = 0, atk = 0, t = 0;
    while (c.st !== 'won' && t < 200) { t += 0.1; for (const e of c.step(0.1, { dist: 3 })) if (e.startsWith('tele')) atk++; if (c.st === 'idle' && (Math.floor(t * 10) % 25 === 0)) { if (c.calmHit(true)) n++; } }
    if (c.st === 'won' && n === 9 && atk === 0 && c.hit(99, 'weak') === 0) solved++;
  }
  check(solved === 50, 'the calm version: no attack, nine calm rings, always solvable (' + solved + ' / 50)');
  check(!new R.Boss('normal', true).calmHit(false), 'a missed calm ring takes nothing');
}

// ---------------------------------------------------------------- 6 · the loot feel, the texts
console.log('6 · the loot burst, the fanfare, the texts');
{
  check(R.coins(0) === 0 && R.coins(15) >= 5 && R.coins(800) <= 28 && R.coins(300) > R.coins(40), 'coins: 5 … 28, more for more');
  check(R.fanfare(4).length > R.fanfare(0).length && R.fanfare(0).length >= 3, 'the fanfare longer for the rarer find');
  const main = SRC + 'main/rpg.js';
  if (fs.existsSync(main)) {
    const txt = fs.readFileSync(main, 'utf8') + (fs.existsSync(SRC + 'main/rpg_boss.js') ? fs.readFileSync(SRC + 'main/rpg_boss.js', 'utf8') : '');
    const keys = new Set((txt.match(/'g\.rpg\.[a-zA-Z0-9_.]+'/g) || []).map(s => s.slice(1, -1)).filter(k => !k.endsWith('.')));
    for (const s of B.SLOTS) { keys.add('g.rpg.slot.' + s); for (const v of B.variants[s]) keys.add('g.rpg.it.' + v); }
    for (const r of B.RAR) keys.add('g.rpg.rar.' + r);
    for (const k of B.PERKS) { keys.add('g.rpg.pk.' + k); keys.add('g.rpg.sum.' + k); }
    for (const a of Object.keys(B.boss.tele)) keys.add('g.rpg.boss.warn.' + a);
    const de = fs.readFileSync(SRC + 'main/lang_de.js', 'utf8'), en = fs.readFileSync(SRC + 'main/lang_en.js', 'utf8');
    const has = (src, k) => src.indexOf("'" + k + "'") >= 0 || src.indexOf('"' + k + '"') >= 0;
    const miss = [...keys].filter(k => !has(de, k) || !has(en, k));
    check(keys.size >= 20 && !miss.length, keys.size + ' texts in both tables' + (miss.length ? ' — missing: ' + miss.slice(0, 6).join(', ') : ''));
  } else check(false, 'src/main/rpg.js missing');
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

// Das Abenteuer — the progression core (a-core; plan docs/superpowers/plans/2026-10-22-a-core.md, spec
// docs/superpowers/specs/2026-10-22-abenteuer-design.md §2–§4, §12, §15). Every rule a check:
//   1. the curve: need(L) = 60 + 30 L, the totals 600 / 1,950 / 6,900 / 14,850 / 39,750 at 5 / 10 / 20 / 30 / 50, the
//      level of every XP at the boundaries, the cap and the stars beyond it
//   2. every award row of A§2: its XP, its Heliataler, its limit (once, per id, per window, per 25 blocks, per km)
//   3. the farming guards: positions counted per session, ×0.5 for every five of a kind within ten minutes, a zone
//      provoked again within two minutes, the windows kept in the save
//   4. the five stats: 0–10, one point per level, respec, their effects
//   5. the Heliataler: earn, pay, the price table of A§4, buying step by step, too few, never real money
//   6. Spannung (A§12): the bands, an encounter, two faints, a band down only when asked
//   7. the save: a JSON round trip, garbage and old records loaded sane, a world without meta.adventure stays without one
//   8. the level-up chime: the day's pentatonic scale, rising, short
//   9. VR.Adventure in a stub page: binding, the switch per world (difficulty kept and restored), Kindersicher, the
//      create path, the hooks' routing (codex, placing, flying), the level-up waiting for a free view, the HUD written on
//      a change only
//  10. award() ≤ 0.01 ms (the rules and the glue)
//  11. every text key the Abenteuer uses is in both tables, German first
//  12. no class name of the Abenteuer is styled by a bare global rule of src/ui/*.css it did not ask for
//   bash test/wt_run.sh adventure.js 300
const DOM = require('./dom_stub.js');
require('./load_shared.js');
require('../src/shared/adventure.js');
require('../src/main/i18n.js');
require('../src/main/lang_en.js');
require('../src/main/lang_de.js');
require('../src/main/settings_reg.js');
require('../src/main/klang.js');
let fails = 0;
const later = [];   // (checks that finish after a promise)
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const near = (a, b, e) => Math.abs(a - b) <= (e === undefined ? 1e-9 : e);
const Adv = VR.Adv;
if (!Adv) { console.log('  ✗ VR.Adv missing (src/shared/adventure.js)'); console.log('FAILED 1'); process.exit(1); }
const MIN = 60000, H = 3600000;
const me0 = () => Adv.fresh().me;

// ---------------------------------------------------------------- 1 · the curve
console.log('1 · the curve');
check(Adv.need(0) === 60 && Adv.need(1) === 90 && Adv.need(9) === 330 && Adv.need(49) === 1530, 'need(L) = 60 + 30 L (60, 90, 330 … 1,530)');
const TOT = { 5: 600, 10: 1950, 20: 6900, 30: 14850, 50: 39750 };
check(Object.keys(TOT).every(L => Adv.total(+L) === TOT[L]), 'the totals: level 5 after 600 XP, 10 after 1,950, 20 after 6,900, 30 after 14,850, 50 after 39,750');
{
  let ok = true, sum = 0;
  for (let L = 0; L < 50; L++) { if (Adv.total(L) !== sum) ok = false; sum += Adv.need(L); }
  check(ok && sum === 39750, 'total(L) is the sum of need(0 … L−1) for every level');
  let ok2 = true;
  for (let L = 1; L <= 50; L++) { const t = Adv.total(L); if (Adv.levelOf(t).level !== L || Adv.levelOf(t - 1).level !== L - 1) ok2 = false; }
  check(ok2, 'levelOf: exactly at a total the level is reached, one XP short it is not (every level 1–50)');
}
check(Adv.levelOf(0).level === 0 && Adv.levelOf(59).level === 0 && Adv.levelOf(60).level === 1, 'a new adventurer is level 0; the first level comes at 60 XP');
check(Adv.levelOf(1830).level === 9, 'A§15\'s example: 1,830 XP is level 9');
{
  const a = Adv.levelOf(1830);
  check(a.into === 1830 - 1620 && a.need === 330 && near(a.frac, 210 / 330), 'the progress into the level: 210 of 330 at 1,830 XP');
}
check(Adv.levelOf(39750).level === 50 && Adv.levelOf(1e8).level === 50, 'level 50 is the cap');
check(Adv.levelOf(39750).stars === 0 && Adv.levelOf(41749).stars === 0 && Adv.levelOf(41750).stars === 1 && Adv.levelOf(39750 + 2000 * 7).stars === 7, 'beyond 50 every 2,000 XP is a star');
check(Adv.levelOf(-5).level === 0 && Adv.levelOf(NaN).level === 0, 'nonsense XP is level 0');

// ---------------------------------------------------------------- 2 · the award rows
console.log('2 · every award row and its limit');
const S = () => Adv.session();
const give = (me, kind, ctx, now, sess) => Adv.award(me, kind, ctx, now === undefined ? 1e12 : now, sess || null);
{
  const me = me0(), s = S();
  let xp = 0;
  for (let i = 0; i < 24; i++) xp += give(me, 'place', { x: i, y: 70, z: 0 }, 1e12, s).xp;
  check(xp === 0, 'place: 24 new positions give nothing yet');
  check(give(me, 'place', { x: 24, y: 70, z: 0 }, 1e12, s).xp === 1, 'place: the 25th gives 1 XP (1 per 25)');
  for (let i = 25; i < 25 * 60; i++) xp += give(me, 'place', { x: i, y: 70, z: 0 }, 1e12 + i, s).xp;
  check(me.xp === 40, 'place: 1,500 blocks within ten minutes give 40 XP, the limit (' + me.xp + ')');
  for (let i = 0; i < 25; i++) give(me, 'place', { x: 5000 + i, y: 70, z: 0 }, 1e12 + 9 * MIN, s);
  check(me.xp === 40, 'place: nothing more while the window lasts');
  for (let i = 0; i < 25; i++) give(me, 'place', { x: 6000 + i, y: 70, z: 0 }, 1e12 + 11 * MIN, s);
  check(me.xp === 41, 'place: a new window after ten minutes');
}
{
  const me = me0();
  check(give(me, 'home', { id: 'v1:3,70,4' }).xp === 60 && give(me, 'home', { id: 'v1:3,70,4' }).xp === 0 && give(me, 'home', { id: 'v1:9,70,4' }).xp === 60, 'home: 60 per house a family moved into, once per house');
}
{
  const me = me0(); let n = 0;
  for (let i = 0; i < 5; i++) n += give(me, 'blueprint', {}, 1e12 + i * MIN).xp;
  check(n === 75, 'blueprint: 25 each, three per hour (' + n + ')');
  check(give(me, 'blueprint', {}, 1e12 + H + MIN).xp === 25, 'blueprint: the next hour gives again');
}
{
  const me = me0();
  check(give(me, 'biome', { id: 'plains' }).xp === 15 && give(me, 'biome', { id: 'plains' }).xp === 0 && give(me, 'biome', { id: 'forest' }).xp === 15, 'biome: 15 for a new biome, once each');
  check(give(me, 'wow', { id: 'v12' }).xp === 20 && give(me, 'wow', { id: 'v12' }).xp === 0, 'wow: 20 once per vista');
  check(give(me, 'wonder', { id: 'w:3:4' }).xp === 80 && give(me, 'wonder', { id: 'w:3:4' }).xp === 0, 'wonder: 80 once each');
  check(give(me, 'flight').xp === 50 && give(me, 'flight').xp === 0, 'first flight: 50, once');
  check(give(me, 'orbit').xp === 100 && give(me, 'orbit').xp === 0, 'first orbit: 100, once');
  const l = give(me, 'landing', { id: 'opal' });
  check(l.xp === 150 && l.taler === 100 && give(me, 'landing', { id: 'opal' }).xp === 0 && give(me, 'landing', { id: 'basalt' }).xp === 150, 'first landing on a world: 150 XP and 100 Taler, once per world');
  const y = give(me, 'system', { id: 'sys:7' });
  check(y.xp === 200 && y.taler === 150 && give(me, 'system', { id: 'sys:7' }).xp === 0, 'a new star system: 200 XP and 150 Taler, once each');
}
{
  const me = me0(), s = S();
  let n = 0;
  for (let k = 0; k < 9; k++) n += give(me, 'distance', { m: 100 }, 1e12, s).xp;
  check(n === 0, 'distance: 900 m flown give nothing yet');
  check(give(me, 'distance', { m: 100 }, 1e12, s).xp === 5, 'distance: 5 per km');
  for (let k = 0; k < 40; k++) n += give(me, 'distance', { m: 1000 }, 1e12 + k * 1000, s).xp;
  check(me.xp === 60, 'distance: 60 XP within ten minutes at most (' + me.xp + ')');
  check(give(me, 'distance', { m: 1e7 }, 1e12 + 11 * MIN, s).xp === 60, 'distance: a teleport-sized jump is held to the window too');
}
{
  const me = me0();
  const a = give(me, 'quest', { size: 'S' }), b = give(me, 'quest', { size: 'M' }), c = give(me, 'quest', { size: 'L' }), d = give(me, 'quest', { size: 'X' });
  check(a.xp === 20 && b.xp === 50 && c.xp === 120 && a.taler === 15 && b.taler === 40 && c.taler === 100, 'quests S · M · L: 20 · 50 · 120 XP and 15 · 40 · 100 Taler');
  check(d.xp === 20 && give(me, 'quest', { size: 'S' }).xp === 20, 'an unknown size is S; quests have no limit');
}
{
  const me = me0();
  check(give(me, 'foe', { kind: 'driller' }).xp === Adv.FOE_XP.driller && give(me, 'foe', { kind: 'drone' }).xp === Adv.FOE_XP.drone, 'a foe powered down: its own XP (driller ' + Adv.FOE_XP.driller + ', drone ' + Adv.FOE_XP.drone + ')');
  check(Object.values(Adv.FOE_XP).every(v => v >= 8 && v <= 30), 'every foe kind gives 8–30');
  check(give(me, 'foe', { kind: 'nobody', xp: 99 }).xp === 30 && give(me, 'foe', { kind: 'nobody2', xp: 1 }).xp === 8, 'a foe\'s XP is held to 8–30');
}
{
  const me = me0();
  const f = give(me, 'freed', { id: 'outpost:c1' }), b = give(me, 'boss', { id: 'koloss' });
  check(f.xp === 250 && f.taler === 300 && give(me, 'freed', { id: 'outpost:c1' }).xp === 0, 'an outpost freed: 250 XP and 300 Taler, once each');
  check(b.xp === 600 && b.taler === 800 && give(me, 'boss', { id: 'koloss' }).xp === 0, 'a boss freed: 600 XP and 800 Taler, once each');
  check(give(me, 'beat', { id: 'c1.b1', xp: 30 }).xp === 30 && give(me, 'beat', { id: 'c1.b1', xp: 30 }).xp === 0 && give(me, 'beat', { id: 'c2.b1', xp: 999 }).xp === 150 && give(me, 'beat', { id: 'c2.b2', xp: 1 }).xp === 30, 'a story beat: 30–150, once each');
}
{
  const me = me0(); let n = 0;
  for (let i = 0; i < 8; i++) n += give(me, 'photo', {}, 1e12 + i * MIN).xp;
  check(n === 50, 'a photo of a wow moment: 10 each, five per hour (' + n + ')');
  check(give(me, 'invention', { id: 'lamp' }).xp === 10 && give(me, 'invention', { id: 'lamp' }).xp === 0, 'an invention: 10, once each');
  const c = give(me, 'chest', { id: 'ruin:4', taler: 70 });
  check(c.taler === 70 && c.xp === 0 && give(me, 'chest', { id: 'ruin:4', taler: 70 }).taler === 0 && give(me, 'chest', { id: 'ruin:5', taler: 999 }).taler === 150 && give(me, 'chest', { id: 'ruin:6', taler: 1 }).taler === 20, 'a chest: 20–150 Taler, once each');
  check(give(me, 'milestone', { id: 'village' }).xp === 10 && give(me, 'milestone', { id: 'village' }).xp === 0, 'a codex milestone (a-core): 10, once each');
  check(give(me, 'creature', { id: 'moss_boar' }).xp === 5 && give(me, 'creature', { id: 'moss_boar' }).xp === 0, 'a creature met (a-core): 5, once each');
  const sv = give(me, 'survival', { n: 20 });
  check(sv && sv.xp === 0 && sv.taler === 0, 'the survival XP (creatures, raids) gives no Abenteuer XP: fights without harm (A§0.3)');
  check(give(me, 'no-such-kind', {}) === null, 'an unknown kind is refused');
}
{
  // every row of A§2 is in the table
  const rows = ['place', 'home', 'blueprint', 'biome', 'wow', 'wonder', 'flight', 'orbit', 'landing', 'system', 'distance', 'quest', 'foe', 'freed', 'boss', 'beat', 'photo', 'invention'];
  check(rows.every(k => Adv.AWARDS[k]), 'the table has every row of A§2 (' + rows.length + ')');
}
// a level-up through an award
{
  const me = me0();
  const r = give(me, 'boss', { id: 'b1' });   // 600 XP: level 5
  check(r.level === 5 && r.up === 5 && me.level === 5, 'an award of 600 XP: five levels at once (' + r.up + ')');
  check(r.gift === 50 && me.taler === 800 + 50, 'level 5 is a gift level: 50 Taler on top (10 × L)');
  const r2 = give(me, 'creature', { id: 'moss_cat' });
  check(r2.xp === 5 && r2.up === 0 && r2.gift === 0, 'no level-up: no gift');
  const r5 = give(me, 'freed', { id: 'f1' });
  check(r5.up === 1 && r5.level === 6 && r5.gift === 0, 'level 6 is no gift level');
  const me2 = me0(); me2.xp = 39740; me2.level = Adv.levelOf(39740).level;
  const r3 = give(me2, 'quest', { size: 'S' });
  check(r3.level === 50 && r3.up === 1 && r3.gift === 500, 'level 50: the last level, a gift of 500');
  const me3 = me0(); me3.xp = 39750 + 1990; me3.level = 50;
  const r4 = give(me3, 'quest', { size: 'S' });
  check(r4.starUp === 1 && r4.stars === 1 && r4.up === 0, 'beyond the cap: a star instead of a level');
}

// ---------------------------------------------------------------- 3 · the farming guards
console.log('3 · the farming guards');
{
  const me = me0(), s = S();
  for (let i = 0; i < 25; i++) give(me, 'place', { x: i, y: 64, z: 9 }, 1e12, s);
  const x1 = me.xp;
  for (let r = 0; r < 4; r++) for (let i = 0; i < 25; i++) give(me, 'place', { x: i, y: 64, z: 9 }, 1e12 + r, s);
  check(x1 === 1 && me.xp === 1, 'breaking and placing again on the same 25 positions gives nothing more in a session');
  const s2 = S();
  for (let i = 0; i < 25; i++) give(me, 'place', { x: i, y: 64, z: 9 }, 1e12 + 1000, s2);
  check(me.xp === 2, 'a new session counts the positions afresh');
  check(Adv.posKey(-1, 64, -1) !== Adv.posKey(1, 64, 1) && Adv.posKey(-1, 64, 3) !== Adv.posKey(-1, 65, 3) && Adv.posKey(5, 4000, -7) === Adv.posKey(5, 4000, -7), 'positions are packed without clashes (negative x, z; heights to 4,095)');
  check(Number.isSafeInteger(Adv.posKey(-524288, 4095, 524287)), 'a packed position is an exact integer (52 bits)');
}
{
  const me = me0(); const got = [];
  for (let i = 0; i < 16; i++) got.push(give(me, 'foe', { kind: 'sentry' }, 1e12 + i * 1000).xp);
  const b = Adv.FOE_XP.sentry;
  check(got.slice(0, 5).every(v => v === b) && got.slice(5, 10).every(v => v === Math.round(b / 2)) && got.slice(10, 15).every(v => v === Math.round(b / 4)), '×0.5 for every five of a kind within ten minutes (' + got.join(' ') + ')');
  check(give(me, 'foe', { kind: 'drone' }, 1e12 + 20000).xp === Adv.FOE_XP.drone, 'another kind is not halved');
  check(give(me, 'foe', { kind: 'sentry' }, 1e12 + 11 * MIN).xp === b, 'after ten minutes the kind gives its full XP again');
}
{
  const me = me0(), s = S();
  check(Adv.provoke(s, 'ruin:7', 1e12) === false, 'a zone provoked for the first time');
  check(give(me, 'foe', { kind: 'wisp', zone: 'ruin:7' }, 1e12 + 1000, s).xp === Adv.FOE_XP.wisp, 'its foes give XP');
  check(Adv.provoke(s, 'ruin:7', 1e12 + 90000) === true, 'the same zone provoked again within two minutes');
  const r = give(me, 'foe', { kind: 'wisp', zone: 'ruin:7' }, 1e12 + 91000, s);
  check(r.xp === 0 && r.why === 'zone', 'its foes give nothing (no farming by walking in and out)');
  check(Adv.provoke(s, 'ruin:7', 1e12 + 91000 + 3 * MIN) === false && give(me, 'foe', { kind: 'driller', zone: 'ruin:7' }, 1e12 + 92000 + 3 * MIN, s).xp > 0, 'after a pause of more than two minutes the zone counts again');
}
{
  const me = me0();
  for (let i = 0; i < 3; i++) give(me, 'blueprint', {}, 1e12);
  const back = Adv.load(JSON.parse(JSON.stringify(Object.assign(Adv.fresh(), { me }))));
  check(give(back.me, 'blueprint', {}, 1e12 + MIN).xp === 0, 'the windows are kept in the save: a reload does not reset a limit');
}

// ---------------------------------------------------------------- 4 · stats
console.log('4 · the five stats');
{
  check(Adv.STATS.join(',') === 'aus,ene,spu,ges,pil' && Adv.PT_MAX === 10, 'five stats (Ausdauer, Energie, Spürsinn, Geschick, Pilot), 0–10 each');
  const me = me0();
  check(Adv.points(me) === 0 && !Adv.addPoint(me, 'aus'), 'level 0: no point to give');
  me.xp = Adv.total(12); me.level = 12;
  check(Adv.points(me) === 12, 'one point per level (level 12: 12)');
  let n = 0; for (let i = 0; i < 15; i++) if (Adv.addPoint(me, 'aus')) n++;
  check(n === 10 && me.pts.aus === 10 && Adv.points(me) === 2, 'a stat stops at 10');
  check(Adv.addPoint(me, 'pil') && Adv.addPoint(me, 'pil') && !Adv.addPoint(me, 'pil') && Adv.points(me) === 0, 'points stop when none are left');
  check(!Adv.addPoint(me, 'magic'), 'an unknown stat is refused');
  check(Adv.respec(me) === 12 && Adv.points(me) === 12 && Adv.STATS.every(k => me.pts[k] === 0), 'respec gives every point back');
  const top = me0(); top.xp = Adv.total(50) + 99999; top.level = 50;
  for (const k of Adv.STATS) for (let i = 0; i < 10; i++) Adv.addPoint(top, k);
  check(Adv.points(top) === 0 && Adv.STATS.every(k => top.pts[k] === 10), 'level 50 (and its stars): exactly every stat at 10');
  const e0 = Adv.effects({}), e5 = Adv.effects({ aus: 5, ene: 5, spu: 5, ges: 5, pil: 5 }), e10 = Adv.effects({ aus: 10, ene: 10, spu: 10, ges: 10, pil: 10 });
  check(e0.hp === 20 && e5.hp === 24 && e10.hp === 30 && e10.hearts === 15, 'Ausdauer: +1 heart per 2 points (20 → 30 HP)');
  check(near(e0.energy, 1) && near(e10.energy, 1.8) && near(e10.boost, 1.6), 'Energie: +8 % energy, +6 % boost bar per point');
  check(e0.scan === 32 && e10.scan === 112 && !Adv.effects({ spu: 4 }).chests && e5.chests, 'Spürsinn: scan radius 32 + 8 per point; at 5 the map shows hidden chests');
  check(near(e10.speed, 1.5) && Adv.effects({ ges: 4 }).hints === 0 && e5.hints === 1 && e10.hints === 2, 'Geschick: +5 % speed per point, a hint at 5 and at 10');
  check(near(e10.boostTime, 1.8) && near(e10.turn, 1.3), 'Pilot: +8 % boost time, +3 % turn rate per point');
  const ew = Adv.effects({ aus: 99, ene: -4, spu: 'x' });
  check(ew.hp === 30 && near(ew.energy, 1) && ew.scan === 32, 'effects of nonsense points are bounded (0–10)');
}

// ---------------------------------------------------------------- 5 · Heliataler
console.log('5 · the Heliataler and the prices');
{
  const me = me0();
  check(Adv.earn(me, 120) === 120 && me.taler === 120, 'earn');
  check(Adv.pay(me, 100) && me.taler === 20, 'pay');
  check(!Adv.pay(me, 21) && me.taler === 20, 'too few Taler: refused, nothing taken');
  check(!Adv.pay(me, -5) && Adv.earn(me, -5) === 0 && me.taler === 20 && Adv.earn(me, 2.7) === 2 && me.taler === 22, 'no negative amounts; whole Taler only');
  Adv.earn(me, 5e9);
  check(me.taler === Adv.TALER_MAX, 'the wallet holds at most ' + Adv.TALER_MAX);
  const P = Adv.PRICES;
  check(P.engine.join() === '600,1500,3500' && P.shield.join() === '500,1200,3000' && P.jump.join() === '1000,2500,5000', 'Triebwerk 600 · 1,500 · 3,500 · Schild 500 · 1,200 · 3,000 · Sprungkern 1,000 · 2,500 · 5,000');
  check(P.suitHeat[0] === 800 && P.suitCold[0] === 600 && P.suitPressure[0] === 600 && P.suitRad[0] === 1200, 'Anzug-Module: heat 800 · cold 600 · pressure 600 · radiation 1,200');
  check(P.boots[0] === 400 && P.anchor[0] === 300 && P.scanner[0] === 400 && P.repair[0] === 900 && P.camera[0] === 200, 'Sprungstiefel 400 · Ankerstiefel+ 300 · Funke: scanner+ 400 · repair beam 900 · camera+ 200');
  check(Adv.bpPrice(10) === 50 && Adv.bpPrice(400) === 400 && Adv.bpPrice(9999) === 400 && Adv.bpPrice(120) === 120, 'blueprints 50–400');
  const w = me0(); Adv.earn(w, 2200);
  check(Adv.price(w, 'engine') === 600, 'the next step\'s price');
  const b1 = Adv.buy(w, 'engine'), b2 = Adv.buy(w, 'engine'), b3 = Adv.buy(w, 'engine');
  check(b1.ok && b1.step === 1 && b2.ok && b2.step === 2 && !b3.ok && b3.why === 'poor' && b3.price === 3500 && w.owned.engine === 2 && w.taler === 100, 'buying step by step (600, 1,500); too few Taler for the third: refused, nothing taken (' + JSON.stringify([b1, b2, b3]) + ')');
  Adv.earn(w, 10000); check(Adv.buy(w, 'engine').ok && Adv.price(w, 'engine') === null && Adv.buy(w, 'engine').why === 'max', 'the last step bought: no more steps');
  check(Adv.buy(w, 'gold-plated-everything').why === 'unknown', 'an unknown item is refused');
  const u0 = Adv.upgrade(me0()), u = Adv.upgrade(w);
  check(near(u0.cruise, 1) && near(u.cruise, 1.45) && u0.shieldSec === 10 && u0.jumpLy === 30, 'the upgrades\' effects: cruise +15 % a step (×1.45 at three), shield 10 s, jump 30 ly without');
  const w2 = me0(); Adv.earn(w2, 99999); for (let i = 0; i < 3; i++) { Adv.buy(w2, 'shield'); Adv.buy(w2, 'jump'); }
  const u2 = Adv.upgrade(w2);
  check(u2.shieldSec === 3 && u2.jumpLy === 60, 'Schild 10 → … → 3 s, Sprungkern 30 → 60 ly');
  check(Adv.sellPrice('iron_ingot') === 2 && Adv.sellPrice('gold_ingot') === 6 && Adv.sellPrice('crystal_shard_violet') === 8 && Adv.sellPrice('ice_core') === 5 && Adv.sellPrice('asteroid_metal') === 12 && Adv.sellPrice('dirt') === 0, 'selling: iron 2, gold 6, crystal 8, ice core 5, asteroid metal 12');
  check(!/€|\bEUR\b|\bUSD\b|\$\s*\d|\bpurchase\b|\bcheckout\b|\bpayment\b/i.test(require('fs').readFileSync(__dirname + '/../src/shared/adventure.js', 'utf8').replace(/\/\/.*$/gm, '')), 'no real money anywhere in the rules (no currency, no purchase)');
}

// ---------------------------------------------------------------- 6 · Spannung
console.log('6 · Spannung');
{
  check(Adv.BANDS.easy.join() === '0.1,0.5' && Adv.BANDS.normal.join() === '0.3,0.7' && Adv.BANDS.hard.join() === '0.5,0.9', 'the bands: Leicht 0.1–0.5 · Normal 0.3–0.7 · Schwer 0.5–0.9');
  const r = Adv.fresh();
  check(near(r.tension, 0.4), 'a new world starts at 0.4');
  const a = Adv.encounter(r, { lost: 0, max: 20, dur: 30, expected: 40 });
  check(near(a.p, 1) && near(r.tension, 0.46), 'a clean win: p = 1, s + 0.06');
  const m = Adv.encounter(r, { lost: 10, max: 20, dur: 40, expected: 40 });
  check(near(m.p, 0.5) && near(r.tension, 0.445), 'half the hearts lost in the expected time: p = 0.5, s − 0.015');
  const b = Adv.encounter(r, { lost: 20, max: 20, dur: 60, expected: 40 });
  check(near(b.p, -0.5) && near(r.tension, 0.3), 'all hearts lost in a long fight: p = −0.5, s − 0.165 — held at the band\'s floor (Normal 0.3)');
  for (let i = 0; i < 20; i++) Adv.encounter(r, { lost: 20, max: 20, dur: 60, expected: 40 });
  check(near(r.tension, 0.3), 'never below the band (Normal: 0.3)');
  for (let i = 0; i < 40; i++) Adv.encounter(r, { lost: 0, max: 20, dur: 10, expected: 40 });
  check(near(r.tension, 0.7), 'never above the band (Normal: 0.7)');
  Adv.setBand(r, 'easy'); check(r.band === 'easy' && near(r.tension, 0.5), 'a band change keeps s inside the new band');
  Adv.setBand(r, 'hard'); check(r.band === 'hard' && near(r.tension, 0.5), 'Schwer lifts it to 0.5');
  check(!Adv.setBand(r, 'brutal') && r.band === 'hard', 'an unknown band is refused');
  check(near(Adv.scale(0), 0.6) && near(Adv.scale(1), 1.4) && near(Adv.scale(0.4), 0.92), 'count, bolt speed and aggression scale with 0.6 + 0.8 s');
  check(Adv.hints(0.15) > Adv.hints(0.45) && Adv.hints(0.45) >= Adv.hints(0.8) && Adv.hints(0.8) === 0, 'Funke\'s hints grow as s falls');
  const f = Adv.fresh(); Adv.setBand(f, 'hard'); f.tension = 0.8;
  const f1 = Adv.faint(f, 1e12);
  check(!f1.offer && near(f.tension, 0.8), 'one faint: nothing changes');
  const f2 = Adv.faint(f, 1e12 + 9 * MIN);
  check(f2.offer && near(f.tension, 0.6) && f.band === 'hard', 'two faints within ten minutes: s − 0.2 and an offer — the band stays until the player says yes');
  const f3 = Adv.faint(f, 1e12 + 30 * MIN);
  check(!f3.offer, 'a faint long after: no offer');
  check(Adv.easier(f) === 'normal' && Adv.easier(f) === 'easy' && Adv.easier(f) === null && f.band === 'easy', '„Soll ich es leichter machen?" — yes: one band down each time, never below Leicht');
  check(Adv.encOf({ enc: 'normal' }, true) === 'off' && Adv.encOf({ enc: 'rare' }, false) === 'rare', 'Kindersicher: Begegnungen always aus');
}

// ---------------------------------------------------------------- 7 · the save
console.log('7 · the save and old worlds');
{
  const r = Adv.fresh({ on: true, since: 12 });
  Adv.award(r.me, 'boss', { id: 'koloss' }, 1e12, null); Adv.addPoint(r.me, 'ene'); Adv.earn(r.me, 9); Adv.buy(r.me, 'camera');
  r.freed['outpost:c1'] = { day: 14, as: 'trade' }; r.beats['c2.b3'] = 'done'; r.chapter = 3;
  const txt = JSON.stringify(r), back = Adv.load(JSON.parse(txt));
  check(JSON.stringify(back) === txt, 'a JSON round trip keeps every field (' + txt.length + ' bytes)');
  check(back.v === 1 && back.on === true && back.since === 12 && back.me.level === 5 && back.me.pts.ene === 1 && back.me.owned.camera === 1, 'version, switch, day, level, points, owned');
  const spec = { v: 1, on: true, band: 'normal', enc: 'normal', since: 12, tension: 0.4, freed: { 'outpost:c1': { day: 14, as: 'trade' } }, bosses: { koloss: 'freed' }, chapter: 3, beats: { 'c2.b3': 'done' }, me: { xp: 1830, level: 9, stars: 0, pts: { aus: 2, ene: 3, spu: 1, ges: 1, pil: 1 }, taler: 412, owned: { engine: 1, suitHeat: 1 }, quests: { 'v12:p3': { kind: 'fetch', id: 'wheat', n: 12, done: false } } } };
  const s = Adv.load(spec);
  check(s.me.level === 9 && s.me.taler === 412 && s.me.pts.ene === 3 && s.bosses.koloss === 'freed' && s.me.quests['v12:p3'].n === 12 && s.me.owned.engine === 1, 'A§15\'s record loads as written');
  const g = Adv.load({ on: 'yes', band: 'brutal', enc: 7, tension: 'x', since: -4, me: { xp: 'lots', level: 99, pts: { aus: 50, ene: -3 }, taler: -10, owned: { engine: 99, nonsense: 3 }, once: 5, lim: { place: ['a', 2] } } });
  check(g.on === false && g.band === 'normal' && g.enc === 'normal' && near(g.tension, 0.4) && g.since === 0, 'garbage: the switch off, the band and the encounters normal, s 0.4');
  check(g.me.xp === 0 && g.me.level === 0 && Adv.STATS.every(k => g.me.pts[k] === 0) && g.me.taler === 0 && g.me.owned.engine === 3 && !('nonsense' in g.me.owned) && typeof g.me.once === 'object' && !g.me.lim.place, 'garbage: no XP, no points beyond the level, no negative Taler, owned steps bounded, unknown items dropped');
  const lv = Adv.load({ on: true, me: { xp: 600, level: 40, pts: { aus: 10, ene: 10 } } });
  check(lv.me.level === 5 && Adv.points(lv.me) === 5 && Adv.STATS.every(k => lv.me.pts[k] === 0), 'the level comes from the XP; more points than levels: given back to spend again');
  for (const raw of [undefined, null, 0, 'adventure', [], [1, 2]]) { const x = Adv.load(raw); if (!(x && x.on === false && x.me && x.me.xp === 0)) { check(false, 'load(' + JSON.stringify(raw) + ')'); } }
  check(true, 'load(undefined · null · 0 · a string · an array) gives a fresh record, switched off');
  const big = Adv.fresh(); big.me.xp = 2e9; check(Adv.load(big).me.xp === 1e9, 'the XP is held to a billion');
}

// ---------------------------------------------------------------- 8 · the chime
console.log('8 · the level-up chime');
{
  const K = VR.Klang;
  const day = 7, plan = K.musicPlan(day), notes = Adv.chime(plan, 3, K.degreeMidi);
  const inScale = (m) => plan.scale.includes((((m - plan.root) % 12) + 12) % 12);
  check(notes.length >= 9 && notes.every(n => inScale(n.midi)), 'every note in the day\'s pentatonic scale (' + notes.length + ' notes)');
  const bells = notes.filter(n => n.kind === 'bell').sort((a, b) => a.t - b.t);
  let up = true; for (let i = 1; i < 6; i++) if (!(bells[i].midi > bells[i - 1].midi)) up = false;
  check(up, 'the bells rise');
  const end = Math.max(...notes.map(n => n.t + n.dur));
  check(end <= 2.2 && notes.every(n => n.gain > 0 && n.gain <= 0.1), 'short (' + end.toFixed(2) + ' s) and soft (every gain ≤ 0.1)');
  check(Adv.chime(plan, 5, K.degreeMidi).length > notes.length, 'a gift level adds a sparkle');
  const n2 = Adv.chime(plan, 3);
  check(n2.length === notes.length && n2.every((n, i) => n.midi === notes[i].midi), 'without klang.js the same notes (its own degree table)');
}

// ---------------------------------------------------------------- 9 · VR.Adventure (the glue, in a stub page)
console.log('9 · VR.Adventure in the game (stub page)');
const hud = DOM.mkEl('div'); hud.setAttribute('id', 'hud'); DOM.body.appendChild(hud);
const app = DOM.mkEl('div'); app.setAttribute('id', 'app'); DOM.body.appendChild(app);
const mkGame = (meta) => ({
  state: 'play', meta, settings: { advHud: true }, difficulty: meta.difficulty,
  player: { pos: [0, 70, 0], spawn: [0.5, 70, 0.5], mode: 'creative', eye: 1.62, lookDir: () => [0, 0, -1], eyePos() { return [this.pos[0], this.pos[1] + 1.62, this.pos[2]]; } },
  env: { day: 3 }, ui: { screen: null, blocking: false, typing: false, toasts: 0, toast() { this.toasts++; }, hint() {} },
  audio: { n: 0, counts: {}, ctx: { currentTime: 0 }, vol: { sfx: 1, music: 1 }, tone() { this.n++; }, count(k) { this.counts[k] = (this.counts[k] || 0) + 1; } },
  particles: { n: 0, glow() { this.n++; }, spark() { this.n++; }, spawn() { this.n++; } },
  saved: 0, saveMeta() { this.saved++; return Promise.resolve(); },
});
require('../src/main/adventure.js');
const A = VR.Adventure;
if (!A) { console.log('  ✗ VR.Adventure missing (src/main/adventure.js)'); console.log('FAILED ' + (fails + 1)); process.exit(1); }
{
  check(VR.Settings.byKey('advHud') && VR.Settings.byKey('advHud').def === true && VR.Settings.byKey('advHud').g === 'play', '⚙ Spiel → advHud (on)');
  check(VR.Settings.byKey('storyOffer') && VR.Settings.byKey('storyOffer').def === true, '⚙ Spiel → storyOffer (on)');
  const meta = { id: 'w1', name: 'Bauwelt', difficulty: 'normal', mode: 'survival', created: Date.now() - 1e7 };
  const g = VR.game = mkGame(meta);
  A.bind();
  check(!A.on() && A.rec === null && A.award('biome', { id: 'plains' }) === null, 'a builder\'s world: no Abenteuer, award() does nothing');
  check(!('adventure' in meta) && g.saved === 0, 'and nothing is written into it');
  check(A.setOn(true) && A.on() && meta.adventure && meta.adventure.on === true && meta.adventure.since === 3, 'switched on: the record in the world\'s meta (since day 3)');
  check(meta.difficulty === 'peaceful' && g.difficulty === 'peaceful' && meta.adventure.prevDiff === 'normal', 'the old mobs and raids stay out: the world is peaceful, its old difficulty kept');
  check(g.saved >= 1, 'the switch is saved at once');
  const r = A.award('biome', { id: 'plains' });
  check(r && r.xp === 15 && meta.adventure.me.xp === 15, 'award(): 15 XP for a new biome, in the world\'s record');
  check(A.setOn(false) && !A.on() && meta.difficulty === 'normal' && g.difficulty === 'normal', 'switched off: the old difficulty is back');
  check(meta.adventure.me.xp === 15 && A.award('biome', { id: 'forest' }) === null, 'off: the levels stay, nothing new is counted');
  A.setOn(true);
  check(A.on() && meta.adventure.me.xp === 15 && meta.difficulty === 'peaceful', 'on again: the same record, nothing lost');
  check(A.setBand('hard') && meta.adventure.band === 'hard' && near(meta.adventure.tension, 0.5), 'the band (Schwer) with Spannung inside it');
  check(A.setEnc('rare') && meta.adventure.enc === 'rare' && A.enc() === 'rare', 'Begegnungen: selten');
  g.settings.kids = true;
  check(A.enc() === 'off' && !A.setEnc('normal') && A.enc() === 'off', 'Kindersicher: Begegnungen fixed to aus');
  g.settings.kids = false;
  check(A.enc() === 'rare', 'without Kindersicher the world\'s own choice again');
  // codex routing (codex.js: one line in event, one in unlock)
  const x0 = meta.adventure.me.xp;
  A.codexUnlock('m:village'); A.codexUnlock('c:moss_boar'); A.codexUnlock('b:forest'); A.codexUnlock('w:arch');
  check(meta.adventure.me.xp - x0 === 10 + 5 + 15, 'codex unlocks: a milestone 10, a creature 5, a biome 15 (a wonder counts at its heart, not here)');
  const x1 = meta.adventure.me.xp;
  for (let i = 0; i < 5; i++) A.codexEvent('blueprint');
  A.codexEvent('ship'); A.codexEvent('ship'); A.codexEvent('raid');
  check(meta.adventure.me.xp - x1 === 75 + 50, 'codex events: blueprints 3 per hour, the first flight once, a raid nothing');
  // placing (g.onBlockPlaced, chained)
  const x2 = meta.adventure.me.xp;
  check(typeof g.onBlockPlaced === 'function', 'the placing hook is installed (g.onBlockPlaced, player.js afterPlace)');
  for (let i = 0; i < 50; i++) g.onBlockPlaced(100 + i, 70, 5, 1, g.player);
  for (let i = 0; i < 50; i++) g.onBlockPlaced(100 + i, 70, 5, 1, g.player);
  check(meta.adventure.me.xp - x2 === 2 && A.lastBuildAt > 0, '50 new blocks: 2 XP; the same 50 again: nothing; the last build time kept (Bauruhe)');
  // flying (the 2-Hz tick): a ship's kilometre
  const x3 = meta.adventure.me.xp;
  g.flight = {}; for (let i = 0; i <= 25; i++) { g.player.pos = [i * 40, 120, 0]; A.tick(); }
  g.flight = null; for (let i = 0; i <= 25; i++) { g.player.pos = [1000 + i * 40, 120, 0]; A.tick(); }
  check(meta.adventure.me.xp - x3 === 5, 'a kilometre flown by ship: 5 XP; walking or creative flight: nothing');
  g.flight = {}; g.player.pos = [0, 120, 0]; A.tick(); g.player.pos = [90000, 120, 0]; A.tick(); g.flight = null;
  check(meta.adventure.me.xp - x3 === 5, 'a teleport is not a flight');
  // the survival XP (crafting.js:266) listens and gives nothing
  const x4 = meta.adventure.me.xp; A.award('survival', { n: 20 });
  check(meta.adventure.me.xp === x4, 'the survival XP: nothing (A§0.3)');
  // 💡 an invention (inventions.js tells its listeners): 10 XP once each — only in play
  const x5 = meta.adventure.me.xp;
  A.onInvention({ type: 'found', k: 'lamp' }); A.onInvention({ type: 'found', k: 'lamp' }); A.onInvention({ type: 'sync' });
  check(meta.adventure.me.xp - x5 === 10, 'an invention found: 10 XP, once (' + (meta.adventure.me.xp - x5) + ')');
  g.state = 'title'; const x6 = meta.adventure.me.xp; A.onInvention({ type: 'found', k: 'kite' }); A.award('biome', { id: 'from-the-title' });
  check(meta.adventure.me.xp === x6, 'nothing counts while the world is not being played (the start screen, the Studio)');
  g.state = 'play';
  // the HUD: written on a change only
  A.renderHud(true);
  const w0 = A.stats.hudWrites;
  for (let i = 0; i < 100; i++) A.renderHud();
  check(A.stats.hudWrites === w0, 'the HUD: 100 refreshes without a change write nothing (' + (A.stats.hudWrites - w0) + ')');
  A.award('wow', { id: 'v1' }); A.renderHud();
  check(A.stats.hudWrites === w0 + 1, 'an award changes the numbers: one write');
  check(DOM.body.querySelector('#advhud') && hud.querySelector('#advhud'), 'the ring sits inside #hud (it hides with the HUD)');
  g.settings.advHud = false; A.renderHud();
  check(hud.querySelector('#advhud').style.display === 'none', '⚙ advHud off: the ring hides');
  g.settings.advHud = true; A.renderHud();
  // the level-up waits for a free view
  g.ui.screen = 'pause';
  const lv0 = meta.adventure.me.level, n0 = g.audio.n, p0 = g.particles.n, ups0 = A.stats.ups;
  check(ups0 >= 1, 'the first levels came on their own while playing (' + ups0 + ' level-ups so far, level ' + lv0 + ')');
  A.award('boss', { id: 'koloss' });
  check(meta.adventure.me.level > lv0 && A.queued() && A.stats.ups === ups0, 'a level-up under the pause menu waits');
  A.flushUp(); check(A.queued() && A.stats.ups === ups0, 'still waiting while the menu is open');
  g.ui.screen = null; g.wow = { active: true }; A.flushUp(); check(A.queued(), 'and while a wow moment holds the view');
  g.wow = null; A.flushUp();
  check(!A.queued() && A.stats.ups === ups0 + 1, 'the view is free: the level-up comes (one banner for ' + (meta.adventure.me.level - lv0) + ' levels)');
  check(g.audio.n > n0 && g.particles.n > p0, 'with its chime and its burst (' + (g.audio.n - n0) + ' notes, ' + (g.particles.n - p0) + ' motes)');
  const ban = DOM.body.querySelector('#advup');
  check(!!ban && /\d/.test(ban.textContent), 'the banner shows the new level (' + (ban ? ban.textContent.replace(/\s+/g, ' ').slice(0, 80) : '—') + ')');
  // stats through the glue: points, respec at home only
  const pts = A.points();
  check(pts === meta.adventure.me.level && A.addPoint('spu') && A.points() === pts - 1, 'a point given (Spürsinn)');
  g.player.pos = [400, 70, 400];
  check(!A.atHome() && !A.respec() && meta.adventure.me.pts.spu === 1, 'respec away from home: refused');
  g.player.pos = [3, 70, -2];
  check(A.atHome() && A.respec() && meta.adventure.me.pts.spu === 0 && A.points() === pts, 'respec at home: free');
  // a guest never has the Abenteuer
  const gm = { id: 'guest-x', guest: true, difficulty: 'normal' };
  VR.game = mkGame(gm); A.bind();
  check(!A.on() && !A.setOn(true) && !('adventure' in gm), 'a multiplayer guest: no Abenteuer (the host\'s comes with u-mp)');
  // a world created with „⚔ Abenteuer mit Begegnungen" (the create form): its record when it starts
  const nm = { id: 'w2', name: 'Neu', difficulty: 'peaceful', mode: 'zen', created: Date.now() + 5 };
  A.pendingCreate = { at: Date.now() };
  VR.game = mkGame(nm); A.bind();
  check(A.on() && nm.adventure && nm.adventure.on && A.pendingCreate === null, 'created with ⚔ Abenteuer: the new world starts as an Abenteuer world');
  { const gg = VR.game; gg.ui.screen = 'loading'; A.tick(); const t0 = gg.ui.toasts; gg.ui.screen = null; A.tick(); A.tick(); check(t0 === 0 && gg.ui.toasts === 1, 'it says hello once, when the world is there (' + gg.ui.toasts + ' toast)'); }
  const om = { id: 'w3', name: 'Alt', difficulty: 'easy', mode: 'survival', created: Date.now() - 1e7 };
  A.pendingCreate = { at: Date.now() - 60000 };
  VR.game = mkGame(om); A.bind();
  check(!A.on() && !('adventure' in om), 'an old world opened later is not touched by a stale create choice');
  // a saved Abenteuer world opens with its record (through JSON, as IndexedDB keeps it)
  const sm = JSON.parse(JSON.stringify(meta));
  VR.game = mkGame(sm); A.bind();
  check(A.on() && sm.adventure.me.xp === meta.adventure.me.xp && sm.adventure.me.level === meta.adventure.me.level, 'a saved Abenteuer world opens where it was (level ' + sm.adventure.me.level + ')');
  // 🎒 Meins on the start screen: the tile „⚔ Abenteuer-Welt beginnen" (A§1) — a new world that starts as an Abenteuer
  const meins = DOM.mkEl('div'); meins.setAttribute('id', 'meins'); const mbody = DOM.mkEl('div'); mbody.className = 'mbody'; meins.appendChild(mbody); DOM.body.appendChild(meins);
  VR.Start = { meinsFrom: 'title', meinsChip: 'all', worldsCache: [{ name: 'Abenteuer-Welt' }, { name: 'Meine Welt' }] };
  A.meinsTile();
  const tile = mbody.querySelector('.advtile');
  check(!!tile && tile.getAttribute('data-act') === 'adv:newworld' && /Abenteuer-Welt beginnen/.test(tile.textContent), '🎒 Meins: the tile „⚔ Abenteuer-Welt beginnen" (' + (tile ? tile.textContent : '—') + ')');
  A.meinsTile(); check(mbody.querySelectorAll('.advtile').length === 1, 'one tile, however often the page is drawn');
  VR.Start.meinsFrom = 'pause'; mbody.children.length = 0; A.meinsTile();
  check(!mbody.querySelector('.advtile'), 'not from the pause menu (in a world the card switches it on)');
  VR.Start.meinsFrom = 'title'; VR.Start.meinsChip = 'house'; A.meinsTile();
  check(!mbody.querySelector('.advtile'), 'not on the houses\' chip');
  VR.Start.meinsChip = 'all';
  const made = [], tg = mkGame({ id: 'title' }); tg.state = 'title'; tg.createWorld = (o) => { made.push(o); }; VR.game = tg;
  later.push(A.newWorld().then((ok) => {
    const o = made[0], P = A.pendingCreate;
    check(ok && o && o.name === 'Abenteuer-Welt 2' && o.difficulty === 'peaceful' && o.mode === 'zen' && P && P.band === 'normal' && P.enc === 'off', 'the tile makes „Abenteuer-Welt 2" (peaceful, Zen like ▶ Losspielen) and marks it for a gentle Abenteuer — no encounters (f-names, R50-05; ' + JSON.stringify([o, P]) + ')');
    A.pendingCreate = null; VR.game = g; A.bind();
  }));
  VR.game = g; A.bind();
}

// ---------------------------------------------------------------- 10 · the cost of award()
console.log('10 · award() ≤ 0.01 ms');
{
  const me = me0(), s = S();
  const N = 200000; let t0 = process.hrtime.bigint();
  for (let i = 0; i < N; i++) Adv.award(me, i & 1 ? 'place' : 'biome', { id: 'b', x: i, y: 70, z: i >> 8 }, 1e12 + i, s);
  const pure = Number(process.hrtime.bigint() - t0) / 1e6 / N;
  check(pure <= 0.01, 'VR.Adv.award: ' + (pure * 1000).toFixed(2) + ' µs a call');
  const g = VR.game, x0 = g.meta.adventure.me.xp; let k = 0;
  t0 = process.hrtime.bigint();
  for (let i = 0; i < 100000; i++) A.award(i & 3 ? 'place' : 'creature', { x: 9000 + i, y: 70, z: 77, id: 'c' + (i & 7) }) && k++;
  const glue = Number(process.hrtime.bigint() - t0) / 1e6 / 100000;
  check(glue <= 0.01, 'VR.Adventure.award: ' + (glue * 1000).toFixed(2) + ' µs a call (the HUD waits for the next frame)');
  check(g.meta.adventure.me.xp > x0, 'and it counted');
}

// ---------------------------------------------------------------- 11 · the texts
console.log('11 · the texts, German first');
{
  const de = VR.I18N.dict.de, en = VR.I18N.dict.en, keys = A.KEYS || [];
  const miss = keys.filter(k => !(k in de) || !(k in en));
  check(keys.length >= 40 && !miss.length, 'every key the Abenteuer uses is in both tables (' + keys.length + ')' + (miss.length ? ': missing ' + miss.slice(0, 12).join(', ') : ''));
  const same = keys.filter(k => k in de && k in en && String(de[k]).split(/\s+/).length >= 3 && de[k] === en[k]);
  check(!same.length, 'the German texts are German' + (same.length ? ': ' + same.join(', ') : ''));
  check(de['g.adv.confirm'] === 'Maschinen und Schatten tauchen auf — in den Außenposten, in Ruinen und nachts. Dein Zuhause und die Dörfer bleiben sicher.', 'the switch-on question as A§1 writes it');
  VR.I18N.lang = 'de'; const lvDe = VR.I18N.t('g.adv.up.title', { n: 5 }); VR.I18N.lang = 'en'; const lvEn = VR.I18N.t('g.adv.up.title', { n: 5 }); VR.I18N.lang = 'de';
  check(/Stufe 5/.test(lvDe) && /Level 5/.test(lvEn), 'the banner: „' + lvDe + '" / "' + lvEn + '"');
}

// ---------------------------------------------------------------- 12 · the classes meet no global rule by accident
// (browser run 2: the card's XP bar took the loading screen's `.bar { width: min(520px, 80vw) }` and pushed the bar and
// „Werte verteilen →" out of the card. A class of the Abenteuer that a bare global rule in src/ui/*.css styles must be
// one of the UI kit's on purpose.)
console.log('12 · no class of the Abenteuer meets a global rule by accident');
{
  const fs = require('fs'), path = require('path'), ui = path.join(__dirname, '../src/ui'), glob = new Map();
  for (const f of fs.readdirSync(ui).filter(f => f.endsWith('.css'))) {
    const css = fs.readFileSync(path.join(ui, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''), re = /([^{}]+)\{[^{}]*\}/g; let m;
    while ((m = re.exec(css))) for (const s0 of m[1].split(',')) { const k = /^\.([A-Za-z][\w-]*)(?::{1,2}[\w-]+(?:\([^)]*\))?)*(?:\s|>|\+|~|$)/.exec(s0.trim()); if (k && !glob.has(k[1])) glob.set(k[1], f + ': ' + s0.trim()); }
  }
  const src = fs.readFileSync(path.join(__dirname, '../src/main/adventure.js'), 'utf8'), used = new Set();
  const add = (s) => { for (const t of s.replace(/\$\{[^}]*\}/g, ' ').split(/\s+/)) if (/^[A-Za-z][\w-]*$/.test(t)) used.add(t); };
  for (const re of [/class="([^"]*)"/g, /mk\('[a-z0-9]+',\s*'([^']*)'/g, /className\s*=\s*'([^']*)'/g, /classList\.(?:add|toggle|remove)\('([^']*)'/g]) { let m; while ((m = re.exec(src))) add(m[1]); }
  const KIT = new Set(['btn', 'panel', 'box', 'screen', 'field', 'note', 'seg', 'row', 'gap', 'small', 'primary', 'on']);   // the game's own kit, used on purpose
  const clash = [...used].filter(c => glob.has(c) && !KIT.has(c)).map(c => c + ' (' + glob.get(c) + ')');
  check(glob.size > 20 && used.size > 30, 'read ' + glob.size + ' global class rules and ' + used.size + ' classes of the Abenteuer');
  check(!clash.length, 'no class of the Abenteuer is styled by a global rule it did not ask for' + (clash.length ? ': ' + clash.join(', ') : ''));
  check(/class="advbar"/.test(src) && /\.advsum \.advbar \{/.test(src), 'the card\'s XP bar is its own (.advbar)');
}

Promise.all(later).catch((e) => { fails++; console.log('  ✗ ' + (e && e.stack || e)); }).then(() => {
  console.log(fails ? 'FAILED ' + fails : 'ALL OK');
  process.exit(fails ? 1 : 0);
});

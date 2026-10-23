// Machines and shadows (a-foes; plan docs/superpowers/plans/2026-10-23-a-foes.md, spec
// docs/superpowers/specs/2026-10-22-abenteuer-design.md §5, §12, §14). Every rule a check:
//   1. the kinds: Bohrläufer, Wächter, Kranarm, Schattendrohne, Schattenwesen — models of our own, hit points, every
//      attack telegraphed ≥ 0.6 s at every band and Spannung, a weak point (the wisp: light)
//   2. at most two attack at once: twelve foes round a moving player for two minutes (the token pool), a token given
//      back when a foe powers down in its telegraph, attacks really happen, every strike after a full telegraph
//   3. the encounter rules: contested zones only, ruins at night only, never within 48 blocks of a village, the home or
//      a freed site, Bauruhe 20 s, Begegnungen aus and Kindersicher never; group sizes by band and Spannung; swarms 3–6
//   4. the power-down: parts (plates, a gear, shards), items that exist, a few Taler; a wisp gives motes, never items
//   5. Spannung: a clean fight raises it, a bad one lowers it, kept in the band; the bolts by band (6 · 8 · 11 m/s at the
//      band's middle) and faster with Spannung; two faints in ten minutes → the offer to make it easier
//   6. the Ohnmacht: waking at the last freed beacon, else at home; Schwer leaves 5 % of the Taler behind
//   7. the foe topic: 24 foes in ≤ 1 KB, the round trip; the host's check of a guest's hit (range, sight, rate)
//   8. the AI in a stub world: a Bohrläufer notices, telegraphs, charges and recovers — a sidestep after its warning
//      avoids the hit; a Wächter's bolt; a Schattenwesen dissolves by a lamp and keeps away from a held light;
//      Begegnungen aus: the strays never attack; switched off: every foe gone within 10 s
//   9. a foe's step ≤ 20 µs
//  10. every text key the foes use is in both tables, German first
//   bash test/wt_run.sh foes.js 300
const fs = require('fs'), path = require('path');
require('./dom_stub.js');
const V = require('./load_shared.js');
const SRC = path.join(__dirname, '../src/main/');
for (const f of ['i18n', 'lang_en', 'lang_de', 'voxmodels']) require(SRC + f + '.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
for (const f of ['foemodels', 'foes']) {
  if (!fs.existsSync(SRC + f + '.js')) { console.log('  ✗ src/main/' + f + '.js missing'); console.log('FAILED 1'); process.exit(1); }
  require(SRC + f + '.js');
}
const F = V.Foes, Adv = V.Adv;
if (!F || !F.KINDS || !F.step) { console.log('  ✗ VR.Foes (its pure core) missing'); console.log('FAILED 1'); process.exit(1); }
const KINDS = ['driller', 'sentry', 'crane', 'drone', 'wisp'];
// a seeded random
const rng = (seed) => { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };

// ---------------------------------------------------------------- 1 · the kinds
console.log('1 · the kinds');
check(KINDS.every(k => F.KINDS[k]) && Object.keys(F.KINDS).length === 5, 'five kinds: ' + Object.keys(F.KINDS).join(', '));
for (const k of KINDS) {
  const K = F.KINDS[k], mob = V.MOBS['foe_' + k];
  check(!!mob && mob.foe === true && !mob.hostile && mob.foeKind === k, k + ': a mob kind foe_' + k + ' (foe, never hostile: an Abenteuer world is peaceful)');
  const M = V.VOXMODELS[K.model] && V.VOXMODELS[K.model]();
  const pn = M ? (M.order || Object.keys(M.parts)) : [];   // (the articulated parts; 'whole' is the machine in one mesh for Very Low)
  check(!!M && pn.length >= 1 && pn.length <= 8 && (!M.parts.whole || pn.indexOf('whole') < 0), k + ': its own voxel model ' + K.model + ' (' + pn.join(' ') + (M && M.parts.whole ? ' + whole' : '') + ')');
  check(K.fam === 'shadow' || !!(M && M.parts.optic), k + ': an optic of its own (tinted red-violet → green, flares in the telegraph)');
  check(K.hp > 0 && K.att && K.att.tele >= F.MIN_TELE, k + ': ' + K.hp + ' half-hearts, attack ' + K.att.kind + ' telegraphed ' + K.att.tele + ' s');
  let minT = Infinity;
  for (const band of ['easy', 'normal', 'hard']) for (let s = 0; s <= 1.0001; s += 0.05) minT = Math.min(minT, F.teleOf(k, band, s));
  check(minT >= 0.6, k + ': the telegraph never shorter than 0.6 s at any band and Spannung (shortest ' + minT.toFixed(2) + ' s)');
  check(K.fam === 'shadow' ? K.weak === 'light' : typeof K.weak === 'string' && K.weak.length > 0, k + ': weak point ' + K.weak);
}
check(F.KINDS.driller.hp === 16 && F.KINDS.sentry.hp === 24 && F.KINDS.crane.hp === 20 && F.KINDS.drone.hp === 6 && F.KINDS.wisp.hp === 8, 'A§5\'s hearts: 8 · 12 · 10 · 3 · 4 (×2 half-hearts)');
check(F.MAX_ATT === 2, 'at most two attack at once (MAX_ATT ' + F.MAX_ATT + ')');
{
  // the weak point doubles: a hit from behind on a Bohrläufer, a hit at the Wächter's shield
  const m = { pos: [0, 0, 0], yaw: 0, foe: F.make('driller', 1, [0, 0, 0]) };
  const back = F.hitFactor(m, [0, 1, 6]), front = F.hitFactor(m, [0, 1, -6]);   // models face -z: front at -z
  const s = { pos: [0, 0, 0], yaw: 0, foe: F.make('sentry', 2, [0, 0, 0]) };
  const sf = F.hitFactor(s, [0, 1, -6]), ss = F.hitFactor(s, [6, 1, 0]);
  check(back === 2 && front === 1, 'Bohrläufer: the core vent on its back takes double (back ×' + back + ', front ×' + front + ')');
  check(sf < 0.5 && ss === 2, 'Wächter: the shield holds from the front (×' + sf + '), the core from the side takes double (×' + ss + ')');
}

// ---------------------------------------------------------------- the stub world
function world(o) {
  o = o || {};
  const W = {
    t: 0, enc: o.enc || 'normal', band: o.band || 'normal', s: o.s === undefined ? 0.5 : o.s, night: o.night === undefined ? 1 : o.night,
    rnd: rng(o.seed || 7), tokens: new F.Tokens(F.MAX_ATT),
    player: { pos: (o.pos || [0, 64, 0]).slice(), dead: false, light: o.held || 0 },
    ground: () => 63, light: o.light || (() => 0), solid: () => false,
    out: { hits: [], bolts: [], events: [] },
  };
  W.players = [W.player];
  return W;
}
function mob(k, id, pos, W) {
  const m = { id, kind: 'foe_' + k, pos: pos.slice(), vel: [0, 0, 0], yaw: 0, def: V.MOBS['foe_' + k], foe: F.make(k, id, pos) };
  if (W) m.foe.zone = { kind: 'outpost', x: pos[0], z: pos[2], r: 40 };
  return m;
}
// one step of the world: the AI, then a plain integration (the game's physics moves walkers; here the stub does)
function stepAll(list, dt, W) {
  W.t += dt;
  for (const m of list) { if (m.foe.gone) continue; F.step(m, dt, W); m.pos[0] += m.vel[0] * dt; m.pos[2] += m.vel[2] * dt; if (F.KINDS[m.foe.k].fly) m.pos[1] += m.vel[1] * dt; }
}

// ---------------------------------------------------------------- 2 · at most two attack at once
console.log('2 · at most two attack at once');
{
  const W = world({ seed: 11 });
  const mix = ['driller', 'driller', 'driller', 'sentry', 'sentry', 'crane', 'drone', 'drone', 'drone', 'drone', 'wisp', 'wisp'];
  const list = mix.map((k, i) => { const a = i / mix.length * Math.PI * 2, r = 9 + (i % 3) * 3; return mob(k, i + 1, [Math.cos(a) * r, k === 'drone' ? 68 : 64, Math.sin(a) * r], W); });
  let worstTok = 0, worstAtt = 0, teles = 0, strikes = 0, early = 0;
  const teleAt = {};
  W.out.events.length = 0;
  for (let i = 0; i < 120 * 30; i++) {
    const a = i / 30 * 0.25; W.player.pos[0] = Math.cos(a) * 4; W.player.pos[2] = Math.sin(a) * 4;
    W.out.events.length = 0;
    stepAll(list, 1 / 30, W);
    let tok = 0, att = 0;
    for (const m of list) { if (m.foe.tok) tok++; if (m.foe.st === 'tele' || m.foe.st === 'strike') att++; }
    worstTok = Math.max(worstTok, tok, W.tokens.count); worstAtt = Math.max(worstAtt, att);
    for (const e of W.out.events) {
      if (e.k === 'tele') { teles++; teleAt[e.id] = W.t; }
      if (e.k === 'strike') { strikes++; if (!(e.id in teleAt) || W.t - teleAt[e.id] < 0.6 - 1e-6) early++; }
    }
    W.out.hits.length = 0; W.out.bolts.length = 0;
  }
  check(worstTok <= 2 && worstAtt <= 2, 'twelve foes, two minutes: never more than two hold a token (' + worstTok + ') or telegraph/strike (' + worstAtt + ')');
  check(teles >= 12 && strikes >= 10, 'they do attack: ' + teles + ' telegraphs, ' + strikes + ' strikes');
  check(early === 0, 'every strike after a full telegraph of ≥ 0.6 s (' + early + ' early)');
  // a foe hurt down in its telegraph gives its token back
  const W2 = world({ seed: 3 }), d = mob('driller', 50, [0, 64, -5], W2);
  for (let i = 0; i < 30 * 12 && d.foe.st !== 'tele'; i++) stepAll([d], 1 / 30, W2);
  check(d.foe.st === 'tele' && d.foe.tok && W2.tokens.count === 1, 'a Bohrläufer in its telegraph holds a token');
  F.hurt(d, 99, [0, 65, 2], W2);
  check(d.foe.st === 'down' && !d.foe.tok && W2.tokens.count === 0, 'powered down in its telegraph: the token is back (' + W2.tokens.count + ' held), state ' + d.foe.st);
  let gone = false; for (let i = 0; i < 30 * 4; i++) { stepAll([d], 1 / 30, W2); if (d.foe.gone) { gone = true; break; } }
  check(gone && W2.out.events.some(e => e.k === 'gone' && e.id === 50), 'the power-down ends in ≤ 4 s (kneel, steam, parts) and the foe is gone');
}

// ---------------------------------------------------------------- 3 · the encounter rules
console.log('3 · the encounter rules');
{
  const zone = { kind: 'outpost', x: 1000, z: 1000, r: 40 };
  const base = { enc: 'normal', kids: false, villages: [], homes: [], freed: [], lastBuild: -1e9, now: 1e6, zones: [zone], night: false };
  const at = (x, z, o) => F.spawnOk([x, 70, z], Object.assign({}, base, o || {}));
  check(at(1010, 1000).ok, 'in an unfreed outpost\'s zone: yes');
  check(!at(1100, 1000).ok && at(1100, 1000).why === 'zone', 'outside every contested zone: no (' + at(1100, 1000).why + ')');
  check(!at(1010, 1000, { villages: [{ x: 1010 + 47.9, z: 1000 }] }).ok && at(1010, 1000, { villages: [{ x: 1010 + 47.9, z: 1000 }] }).why === 'village', 'a village 47.9 blocks away: no');
  check(at(1010, 1000, { villages: [{ x: 1010 + 48.1, z: 1000 }] }).ok, 'a village 48.1 blocks away: yes');
  check(!at(1010, 1000, { homes: [[1010, 70, 1030]] }).ok && at(1010, 1000, { homes: [[1010, 70, 1030]] }).why === 'home', 'the player\'s home 30 blocks away: no');
  check(!at(1010, 1000, { freed: [[1040, 1000]] }).ok && at(1010, 1000, { freed: [[1040, 1000]] }).why === 'freed', 'a freed site 30 blocks away: no');
  check(!at(1010, 1000, { lastBuild: 1e6 - 19000 }).ok && at(1010, 1000, { lastBuild: 1e6 - 19000 }).why === 'bauruhe', 'a block placed 19 s ago (Bauruhe): no');
  check(at(1010, 1000, { lastBuild: 1e6 - 21000 }).ok, 'a block placed 21 s ago: yes');
  check(!at(1010, 1000, { enc: 'off' }).ok && !at(1010, 1000, { kids: true }).ok, 'Begegnungen aus, Kindersicher: never');
  const ruin = { kind: 'ruin', x: 2000, z: 2000, r: 32 };
  check(!F.spawnOk([2005, 70, 2005], Object.assign({}, base, { zones: [ruin], night: false }), 'wisp').ok, 'a ruin by day: no shadows');
  check(F.spawnOk([2005, 70, 2005], Object.assign({}, base, { zones: [ruin], night: true }), 'wisp').ok, 'a ruin at night: shadows');
  check(!F.spawnOk([2005, 70, 2005], Object.assign({}, base, { zones: [ruin], night: true }), 'driller').ok, 'a ruin at night: no machines (they belong to the outposts)');
  // a random sweep: no accepted point is within 48 of any village, home or freed site
  const r = rng(5); let bad = 0, okN = 0;
  for (let i = 0; i < 4000; i++) {
    const vs = [{ x: 1000 + (r() - 0.5) * 160, z: 1000 + (r() - 0.5) * 160 }], hs = [[1000 + (r() - 0.5) * 160, 70, 1000 + (r() - 0.5) * 160]], fr = [[1000 + (r() - 0.5) * 160, 1000 + (r() - 0.5) * 160]];
    const x = 1000 + (r() - 0.5) * 80, z = 1000 + (r() - 0.5) * 80;
    const q = F.spawnOk([x, 70, z], Object.assign({}, base, { villages: vs, homes: hs, freed: fr }));
    if (!q.ok) continue; okN++;
    if (Math.hypot(vs[0].x - x, vs[0].z - z) < 48 || Math.hypot(hs[0][0] - x, hs[0][2] - z) < 48 || Math.hypot(fr[0][0] - x, fr[0][1] - z) < 48) bad++;
  }
  check(bad === 0 && okN > 100, 'four thousand random places: never a spawn within 48 blocks of a village, home or freed site (' + okN + ' allowed, ' + bad + ' wrong)');
  const sizes = (band, s) => { const rr = rng(9); let lo = 99, hi = 0; for (let i = 0; i < 400; i++) { const n = F.groupSize(band, s, rr); lo = Math.min(lo, n); hi = Math.max(hi, n); } return [lo, hi]; };
  const e = sizes('easy', 0.3), n = sizes('normal', 0.5), h = sizes('hard', 0.7);
  check(e[0] === 1 && e[1] === 2 && n[0] === 2 && n[1] === 4 && h[0] === 3 && h[1] === 6, 'group sizes at the band\'s middle: Leicht ' + e.join('–') + ', Normal ' + n.join('–') + ', Schwer ' + h.join('–'));
  const lowS = sizes('normal', 0.3), highS = sizes('normal', 0.7);
  check(lowS[1] <= n[1] && highS[1] >= n[1] && highS[0] >= 1, 'Spannung scales the count (Normal at 0.3: ' + lowS.join('–') + ', at 0.7: ' + highS.join('–') + ')');
  const sw = (band) => { const rr = rng(3); let lo = 99, hi = 0; for (let i = 0; i < 400; i++) { const k = F.swarmSize(band, Adv.BANDS[band][0] + 0.2, rr); lo = Math.min(lo, k); hi = Math.max(hi, k); } return [lo, hi]; };
  check(['easy', 'normal', 'hard'].every(b => { const q = sw(b); return q[0] >= 3 && q[1] <= 6; }), 'drone swarms of 3–6 (' + ['easy', 'normal', 'hard'].map(b => sw(b).join('–')).join(' · ') + ')');
  check(F.REST.normal >= 120 && F.REST.rare > F.REST.normal, 'a zone rests after an encounter (' + F.REST.normal + ' s, selten ' + F.REST.rare + ' s): 2–4 encounters per 10 min at most');
}

// ---------------------------------------------------------------- 4 · the power-down
console.log('4 · the power-down');
{
  const r = rng(21);
  for (const k of KINDS) {
    const d = F.drops(k, r);
    if (k === 'wisp') { check(d.items.length === 0 && d.motes > 0 && !d.taler && d.parts.length === 0, 'Schattenwesen: firefly motes (' + d.motes + '), never items, never parts — healed, not hurt'); continue; }
    const ok = d.items.every(([id, n]) => !!V.itemDef(id) && n > 0);
    check(ok && d.parts.length >= 1, k + ': parts ' + d.parts.join(' ') + ' · items ' + d.items.map(x => x[1] + '×' + x[0]).join(' ') + ' · ' + d.taler + ' Taler');
  }
  const dd = F.drops('drone', r);
  check(dd.motes > 0 && dd.parts.indexOf('shard') >= 0, 'Schattendrohne: the smoke tears into light motes, the shell breaks into shards');
  const de = V.I18N.dict.de || {}, en = V.I18N.dict.en || {};
  const words = Object.keys(de).filter(k => /^g\.(foe|lib)\./.test(k)).map(k => String(de[k]) + ' ' + String(en[k])).join(' ');
  check(words.length > 200 && !/\b(blood|blut|kill|töte|tot|tod|stirb|stirbt|corpse|leiche|dead|death)\b/i.test(words), 'no blood, no death, no killing in the foes\' words (' + words.length + ' characters read)');
}

// ---------------------------------------------------------------- 5 · Spannung
console.log('5 · Spannung');
{
  const rec = Adv.fresh({ on: true, band: 'normal' });
  const s0 = rec.tension;
  F.after(rec, { lost: 0, max: 20, dur: 20, n: 3 });
  const s1 = rec.tension;
  F.after(rec, { lost: 18, max: 20, dur: 90, n: 3 });
  const s2 = rec.tension;
  check(s1 > s0 && s2 < s1, 'a clean quick fight raises Spannung (' + s0.toFixed(3) + ' → ' + s1.toFixed(3) + '), a hard one lowers it (→ ' + s2.toFixed(3) + ')');
  for (let i = 0; i < 40; i++) F.after(rec, { lost: 0, max: 20, dur: 5, n: 1 });
  check(rec.tension <= Adv.BANDS.normal[1] + 1e-9, 'kept in the band (Normal ≤ ' + Adv.BANDS.normal[1] + ': ' + rec.tension.toFixed(3) + ')');
  check(F.expected(3) === 39 && F.expected(1) === 23, 'a fight is expected to last 15 + 8·n s (n 3: ' + F.expected(3) + ' s)');
  const b = (band) => F.boltSpeed(band, (Adv.BANDS[band][0] + Adv.BANDS[band][1]) / 2);
  check(Math.abs(b('easy') - 6) < 1e-9 && Math.abs(b('normal') - 8) < 1e-9 && Math.abs(b('hard') - 11) < 1e-9, 'bolts at the band\'s middle: Leicht ' + b('easy') + ' · Normal ' + b('normal') + ' · Schwer ' + b('hard') + ' m/s');
  check(F.boltSpeed('normal', 0.7) > F.boltSpeed('normal', 0.3) && F.boltSpeed('normal', 0.7) < 12, 'faster with Spannung, never a dart (Normal 0.3: ' + F.boltSpeed('normal', 0.3).toFixed(2) + ', 0.7: ' + F.boltSpeed('normal', 0.7).toFixed(2) + ' m/s)');
  check(F.coolScale(0.8) < F.coolScale(0.2), 'aggression with Spannung: shorter pauses between attacks (' + F.coolScale(0.2).toFixed(2) + ' → ' + F.coolScale(0.8).toFixed(2) + ')');
  const r2 = Adv.fresh({ on: true, band: 'normal' }), t0 = 5e6;
  const a = F.faint(r2, t0), c = F.faint(r2, t0 + 9 * 60000);
  check(!a.offer && c.offer, 'two faints within ten minutes: the offer to make it easier (asked, never silent)');
}

// ---------------------------------------------------------------- 6 · the Ohnmacht
console.log('6 · the Ohnmacht');
{
  const w1 = F.wake({ freed: [{ id: 'a', pos: [100, 70, 100], t: 5 }, { id: 'b', pos: [400, 72, -50], t: 9 }], home: [0, 80, 0] });
  check(w1.why === 'beacon' && w1.pos[0] === 400, 'waking at the last freed beacon (' + w1.why + ' ' + w1.pos.join(',') + ')');
  const w2 = F.wake({ freed: [], home: [0, 80, 0] });
  check(w2.why === 'home' && w2.pos[1] === 80, 'no freed beacon yet: at home');
  check(F.lostTaler('hard', 1000) === 50 && F.lostTaler('normal', 1000) === 0 && F.lostTaler('easy', 1000) === 0, 'Schwer: 5 % of the carried Taler stay behind as a pickup (1000 → ' + F.lostTaler('hard', 1000) + '), else nothing');
  check(F.dmgFor(2, 'survival', 20) === 2 && F.dmgFor(2, 'survival', 30) < 2 && F.dmgFor(2, 'creative', 30) === 2, 'Ausdauer in survival: a hit takes a smaller bite of the 20 hearts (' + F.dmgFor(2, 'survival', 30).toFixed(2) + ' at 30 max)');
}

// ---------------------------------------------------------------- 7 · the foe topic
console.log('7 · the foe topic');
{
  const list = [];
  for (let i = 0; i < 24; i++) { const k = KINDS[i % 5]; const m = mob(k, 1000 + i, [500 + (i % 7) * 9.3, 70 + (i % 3) * 2.17, -300 + i * 2.6]); m.yaw = i * 0.7; m.foe.st = ['patrol', 'tele', 'strike', 'recover', 'down'][i % 5]; m.foe.hp = Math.max(1, F.KINDS[k].hp - i % 4); list.push(m); }
  const msg = F.message(list, [520, 70, -280], { bolts: [{ pos: [521, 71, -281], vel: [3, 0, -7], k: 'drone' }], events: [[1001, 'down']] });
  const bytes = JSON.stringify(msg).length;
  check(bytes <= 1024, 'a foe message with 24 foes, a bolt and an event: ' + bytes + ' bytes (≤ 1 KB)');
  const back = F.unpack(JSON.parse(JSON.stringify(msg)));
  let worst = 0, same = back.foes.length === 24;
  for (let i = 0; i < 24 && same; i++) {
    const a = list[i], b = back.foes[i];
    same = same && b.id === a.id && b.k === a.foe.k && b.st === a.foe.st;
    worst = Math.max(worst, Math.abs(b.pos[0] - a.pos[0]), Math.abs(b.pos[1] - a.pos[1]), Math.abs(b.pos[2] - a.pos[2]));
  }
  check(same && worst <= 1 / 16 + 1e-9, 'the round trip keeps id, kind, state and the place to 1/16 block (worst ' + worst.toFixed(4) + ')');
  check(back.bolts.length === 1 && Math.abs(back.bolts[0].pos[2] + 281) < 0.07 && back.events.length === 1, 'bolts and events ride along');
  const far = mob('driller', 9, [0, 64, 0]); far.pos = [5000, 64, 0];
  check(F.message([far].concat(list), [520, 70, -280]).n === 24, 'beyond 64 blocks of the players: not sent; at most 24');
  // the host's check of a guest's hit
  const B = F.bucket();
  const hit = (o) => F.checkHit(Object.assign({ foe: [10, 65, 0], shooter: [0, 64, 0], origin: [0.3, 65.5, 0], kind: 'pulse', dmg: 7, now: 1000, bucket: B, solid: () => false }, o));
  check(hit().ok, 'a pulse from 10 m with a clear sight: counts');
  check(!hit({ foe: [60, 65, 0] }).ok && hit({ foe: [60, 65, 0] }).why === 'range', 'from 60 m: refused (range)');
  check(!hit({ kind: 'melee', foe: [8, 65, 0] }).ok, 'a punch from 8 m: refused');
  check(!hit({ origin: [9, 65, 0] }).ok && hit({ origin: [9, 65, 0] }).why === 'origin', 'a shot from where the guest is not: refused');
  check(!hit({ solid: (x, y, z) => x === 5 }).ok && hit({ solid: (x, y, z) => x === 5 }).why === 'sight', 'a wall between: refused (sight)');
  const B2 = F.bucket(); let n = 0; for (let i = 0; i < 20; i++) if (hit({ bucket: B2, now: 2000 + i * 10 }).ok) n++;
  check(n <= 7 && n >= 5, 'twenty hits in 0.2 s: only the rate\'s worth count (' + n + ')');
  check(!hit({ dmg: 500 }).ok, 'an impossible damage: refused');
}

// ---------------------------------------------------------------- 8 · the AI in a stub world
console.log('8 · the AI in a stub world');
{
  // a Bohrläufer: notices, telegraphs (the optic flares), charges, recovers
  const W = world({ seed: 4 }), d = mob('driller', 1, [0, 64, -9], W);
  const seen = new Set(); let flareMax = 0, charged = 0, startZ = null;
  for (let i = 0; i < 30 * 15; i++) {
    stepAll([d], 1 / 30, W); seen.add(d.foe.st); flareMax = Math.max(flareMax, d.foe.flare || 0);
    if (d.foe.st === 'strike' && startZ === null) startZ = d.pos[2];
    if (d.foe.st === 'recover' && startZ !== null && !charged) charged = Math.abs(d.pos[2] - startZ);
  }
  check(['patrol', 'notice', 'approach', 'tele', 'strike', 'recover'].every(s => seen.has(s)) || ['notice', 'approach', 'tele', 'strike', 'recover'].every(s => seen.has(s)), 'Bohrläufer: notices, approaches, telegraphs, charges, recovers (' + [...seen].join(' → ') + ')');
  check(flareMax >= 0.95, 'its optic flares in the telegraph (' + flareMax.toFixed(2) + ')');
  check(charged >= 3, 'the charge runs ' + charged.toFixed(1) + ' blocks along the line it locked');
  // the hit when standing still, none after a sidestep during the warning
  const tryCharge = (dodge) => {
    const W2 = world({ seed: 4 }), m = mob('driller', 2, [0, 64, -6], W2);
    let hits = 0;
    for (let i = 0; i < 30 * 12; i++) {
      if (dodge && m.foe.st === 'tele' && m.foe.t > 0.3) W2.player.pos[0] = 2.6;
      stepAll([m], 1 / 30, W2);
      hits += W2.out.hits.length; W2.out.hits.length = 0;
      if (m.foe.st === 'recover') break;
    }
    return hits;
  };
  const still = tryCharge(false), side = tryCharge(true);
  check(still >= 1 && side === 0, 'standing still the charge hits (' + still + '), a sidestep after the warning avoids it (' + side + ')');
  // a Wächter: one slow bolt after its telegraph
  const W3 = world({ seed: 8 }), s = mob('sentry', 3, [0, 64, -12], W3);
  let bolt = null, teleT = null;
  for (let i = 0; i < 30 * 12 && !bolt; i++) { stepAll([s], 1 / 30, W3); if (s.foe.st === 'tele' && teleT === null) teleT = W3.t; if (W3.out.bolts.length) bolt = W3.out.bolts[0]; }
  const sp = bolt ? Math.hypot(bolt.vel[0], bolt.vel[1], bolt.vel[2]) : 0;
  check(!!bolt && Math.abs(sp - F.boltSpeed('normal', 0.5)) < 0.01 && W3.t - teleT >= 0.6 - 1e-6, 'Wächter: one bolt at ' + sp.toFixed(1) + ' m/s, ' + (bolt ? (W3.t - teleT).toFixed(2) : '?') + ' s after its warning began');
  // a Schattenwesen: a lamp dissolves it into motes; a held light keeps it away
  const W4 = world({ seed: 2, light: (x, y, z) => (Math.hypot(x - 3, z - 0) < 4 ? 12 : 0) }), w = mob('wisp', 4, [3, 65, 0], W4);
  let wGone = false; for (let i = 0; i < 30 * 8; i++) { stepAll([w], 1 / 30, W4); if (w.foe.gone) { wGone = true; break; } }
  check(wGone && W4.out.events.some(e => e.k === 'gone' && e.id === 4), 'a Schattenwesen by a lamp dissolves into motes within 8 s');
  const W5 = world({ seed: 2, held: 12 }), w2 = mob('wisp', 5, [0, 65, -10], W5);
  let closest = 99; for (let i = 0; i < 30 * 20; i++) { stepAll([w2], 1 / 30, W5); closest = Math.min(closest, Math.hypot(w2.pos[0] - W5.player.pos[0], w2.pos[2] - W5.player.pos[2])); }
  check(closest >= 4.5, 'a held light keeps a Schattenwesen at ≥ 4.5 m (closest ' + closest.toFixed(1) + ' m)');
  const W6 = world({ seed: 2, night: 0 }), w3 = mob('wisp', 6, [0, 65, -10], W6);
  let dawn = false; for (let i = 0; i < 30 * 8; i++) { stepAll([w3], 1 / 30, W6); if (w3.foe.gone) { dawn = true; break; } }
  check(dawn, 'by day a Schattenwesen fades away');
  // Begegnungen aus: the strays never attack
  const W7 = world({ seed: 5, enc: 'off' }), list7 = [mob('driller', 7, [0, 64, -5], W7), mob('sentry', 8, [4, 64, -6], W7), mob('crane', 9, [-4, 70, -6], W7)];
  let att7 = 0; for (let i = 0; i < 30 * 60; i++) { W7.out.events.length = 0; stepAll(list7, 1 / 30, W7); att7 += W7.out.events.filter(e => e.k === 'tele').length; }
  check(att7 === 0 && W7.tokens.count === 0, 'Begegnungen aus: in a minute beside three strays not one attack (' + att7 + ')');
  // switched off: every foe powers down and leaves within 10 s
  const W8 = world({ seed: 6 }), list8 = KINDS.map((k, i) => mob(k, 20 + i, [i * 3, 65, -8], W8));
  for (let i = 0; i < 30 * 5; i++) stepAll(list8, 1 / 30, W8);
  F.leaveAll(list8, W8);
  let all = false; for (let i = 0; i < 30 * 10; i++) { stepAll(list8, 1 / 30, W8); if (list8.every(m => m.foe.gone)) { all = true; break; } }
  check(all && W8.tokens.count === 0, 'switched off: every foe powers down and leaves within 10 s, no token held');
  // calmed: a stray kneels, its optic turns green, it never attacks again
  const W9 = world({ seed: 9 }), c = mob('driller', 30, [0, 64, -5], W9);
  F.calm(c, W9);
  let att9 = 0; for (let i = 0; i < 30 * 30; i++) { W9.out.events.length = 0; stepAll([c], 1 / 30, W9); att9 += W9.out.events.filter(e => e.k === 'tele').length; }
  check(c.foe.st === 'calm' && att9 === 0 && F.optic(c)[1] > F.optic(c)[0], 'calmed: it kneels, its optic green (' + F.optic(c).map(v => v.toFixed(2)).join(',') + '), no attack in 30 s');
  // listening ([V] Beruhigen, the timing ring open): it holds still, faces the player, never attacks — and moves again after
  const W10 = world({ seed: 10 }), h = mob('sentry', 32, [0, 64, -3.2], W10);
  h.foe.st = 'approach'; h.foe.t = 0; h.foe.cool = 0; h.foe.listen = true; h.yaw = 2;
  const h0 = h.pos.slice(); let att10 = 0;
  for (let i = 0; i < 30 * 4; i++) { W10.out.events.length = 0; stepAll([h], 1 / 30, W10); att10 += W10.out.events.filter(e => e.k === 'tele').length; }
  const moved10 = Math.hypot(h.pos[0] - h0[0], h.pos[2] - h0[2]), face10 = Math.abs(Math.atan2(Math.sin(h.yaw - Math.atan2(-(W10.player.pos[0] - h.pos[0]), -(W10.player.pos[2] - h.pos[2]))), Math.cos(h.yaw - Math.atan2(-(W10.player.pos[0] - h.pos[0]), -(W10.player.pos[2] - h.pos[2])))));
  const tok10 = W10.tokens.count;
  h.foe.listen = false;
  for (let i = 0; i < 30 * 3; i++) stepAll([h], 1 / 30, W10);
  const after10 = Math.hypot(h.pos[0] - h0[0], h.pos[2] - h0[2]);
  check(moved10 < 0.05 && att10 === 0 && tok10 === 0 && face10 < 0.3 && after10 > 1, 'listening to [V]: a Wächter 3.2 m off holds still for 4 s (' + moved10.toFixed(2) + ' m), faces the player (' + face10.toFixed(2) + ' rad), no attack (' + att10 + '); after it steps back again (' + after10.toFixed(1) + ' m)');
  const red = F.optic(mob('driller', 31, [0, 64, 0]));
  check(red[0] > red[1] && red[2] > red[1], 'disturbed: the optic glows red-violet (' + red.map(v => v.toFixed(2)).join(',') + ')');
}

// ---------------------------------------------------------------- 9 · a foe's step
console.log('9 · a foe\'s step');
{
  const W = world({ seed: 13 }), list = [];
  for (let i = 0; i < 12; i++) list.push(mob(KINDS[i % 5], 100 + i, [Math.cos(i) * 10, 65, Math.sin(i) * 10], W));
  for (let i = 0; i < 300; i++) stepAll(list, 1 / 30, W);
  let best = Infinity;
  for (let r = 0; r < 5; r++) {
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < 600; i++) { W.out.events.length = 0; W.out.hits.length = 0; W.out.bolts.length = 0; stepAll(list, 1 / 30, W); }
    const us = Number(process.hrtime.bigint() - t0) / 1000 / (600 * 12);
    best = Math.min(best, us);
  }
  check(best <= 20, 'a foe\'s step ' + best.toFixed(2) + ' µs (≤ 20; twelve foes ' + (best * 12 / 1000).toFixed(3) + ' ms a frame)');
}
{
  // a foe's draw: the GL calls for twelve (four Bohrläufer, four Wächter, four drones — the browser's cost scene) at
  // 10–25 m. On Very Low (the animation off there) a machine at rest is one mesh, its optic and its core; a part sets
  // its tint and flash only when they change. Browser run 3 measured F.draw at 0.97 ms for 63 draws on Very Low
  // (SwiftShader), the calls being the cost — before: every part five calls, every foe six more.
  const calls = { draw: 0, all: 0 }, gpu = V.VoxGPU.upload;
  V.VoxGPU.upload = (gl, mesh) => ({ vao: {}, count: mesh.count });
  const glc = { TRIANGLES: 4 };
  for (const k of ['uniform1f', 'uniform3f', 'uniformMatrix4fv', 'bindVertexArray', 'drawArrays']) glc[k] = () => { calls.all++; if (k === 'drawArrays') calls.draw++; };
  const r = { gl: glc, frame: 0 }, prog = { u: { u_tint: 1, u_flash: 2, u_model: 3, u_sky: 4, u_blockLight: 5, u_sunShadow: 6, u_noFog: 7 } };
  const En = { lightAt: () => ({ sky: 1, bl: [0, 0, 0] }), sunShade: () => 0, game: { settings: { anim: true } } }, cam = { x: 0, y: 66, z: 0 };
  const twelve = ['driller', 'driller', 'driller', 'driller', 'sentry', 'sentry', 'sentry', 'sentry', 'drone', 'drone', 'drone', 'drone'].map((k, i) => { const a = i / 12 * Math.PI * 2, d = 10 + (i % 4) * 5, mm = mob(k, 300 + i, [Math.sin(a) * d, 64, Math.cos(a) * d]); mm.foe.st = 'approach'; return mm; });
  const frame = () => { calls.draw = 0; calls.all = 0; for (const mm of twelve) F.draw(En, r, prog, mm, cam, 0); return { draw: calls.draw, all: calls.all }; };
  const full = frame(), before = twelve.length * 6 + full.draw * 5;
  En.game.settings.anim = false; const lite = frame();
  twelve[0].foe.st = 'tele'; twelve[0].foe.t = 0.4; twelve[0].foe.flare = 0.5; const warn = frame();
  const whole = V.getVoxModel(glc, 'foe_driller').parts.whole, sum = ['leg_fl', 'leg_fr', 'leg_bl', 'leg_br', 'body', 'drill'].reduce((a, n) => a + V.getVoxModel(glc, 'foe_driller').parts[n].count, 0);
  V.VoxGPU.upload = gpu;
  check(full.draw === 76 && full.all < before, 'twelve foes, every part: ' + full.draw + ' draws in ' + full.all + ' GL calls (before ' + before + ')');
  check(lite.draw === 32 && lite.all <= before * 0.45, 'on Very Low at rest: ' + lite.draw + ' draws in ' + lite.all + ' GL calls (' + Math.round(100 - lite.all / before * 100) + ' % fewer than before)');
  check(warn.draw === lite.draw - 3 + 8, 'a Bohrläufer in its warning keeps every part on Very Low (' + (warn.draw - lite.draw + 3) + ' draws): the warning reads');
  check(!!whole && Math.abs(whole.count - sum) <= sum * 0.1, 'the Bohrläufer whole: ' + (whole ? whole.count : 0) + ' vertices, about its six parts\' ' + sum + ' (the faces between them gone, the shade where they meet added)');
}

// ---------------------------------------------------------------- 10 · the words
console.log('10 · the words');
{
  const de = V.I18N.dict.de || {}, en = V.I18N.dict.en || {};
  const keys = F.KEYS || [];
  const has = (tab, k) => Object.prototype.hasOwnProperty.call(tab, k);
  const miss = keys.filter(k => !(has(de, k) && has(en, k)));
  check(keys.length >= 20 && miss.length === 0, keys.length + ' keys of the foes in both tables' + (miss.length ? ' — missing: ' + miss.slice(0, 8).join(', ') : ''));
  const src = fs.readFileSync(SRC + 'foes.js', 'utf8') + fs.readFileSync(SRC + 'foemodels.js', 'utf8');
  check(!/Sterntaler|Heliataler/.test(src), 'no currency word written in the code (the coin\'s name comes from the tables: g.adv.taler)');
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

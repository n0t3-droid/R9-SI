// 🐾 Begleiter (companion animals): the rules of the three species, with no game in them (src/shared/pets.js).
//  (a) the species: three kinds with German names, a treat that is a real item, at least eight names each
//  (b) names: a name is cleaned (no control characters, no < >, at most 16 characters) and falls back
//  (c) following: a companion more than 24 blocks away appears next to its player; one that gets no closer for
//      3.5 s appears next to its player too; close ones stand still; the path search is asked for in between
//  (d) sitting: a sitting companion never moves on its own, however far its player goes; sit ↔ follow by a right-click
//  (e) night: a following companion that has been idle walks to its bed (or spawn) and curls up; at morning, or
//      when its player is 24 blocks away, it gets up and follows
//  (f) thinking: how often a companion thinks grows with the distance to its player (0.2 s near, 1 s far)
//  (g) moods (the 🐾 chip): asleep, waiting, sleepy, coming, happy
//  (h) the save format: a round trip keeps kind, name, state and place; bad records are dropped, never thrown;
//      at most three companions per player
//   bash test/wt_run.sh pets_logic.js
const VR = require('./load_shared.js');
require('../src/shared/pets.js');
const P = VR.Pets;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-9);

// ---------------------------------------------------------------- (a) species
check(!!P && typeof P.decide === 'function', 'VR.Pets loads in node');
const KINDS = ['glimmer_fox', 'moss_cat', 'crystal_pup'];
check(KINDS.every(k => P.isKind(k)) && Object.keys(P.KINDS).length === 3, 'three species: ' + Object.keys(P.KINDS).join(', '));
check(P.KINDS.glimmer_fox.name === 'Glimmerfuchs' && P.KINDS.moss_cat.name === 'Mooskätzchen' && P.KINDS.crystal_pup.name === 'Kristallwelpe', 'the German names: Glimmerfuchs, Mooskätzchen, Kristallwelpe');
check(!P.isKind('zombie') && !P.isKind('__proto__') && !P.isKind(undefined), 'anything else is not a companion');
const treats = KINDS.map(k => P.KINDS[k].treat);
check(treats.every(t => typeof t === 'string' && !!VR.itemDef(t)), 'each treat is a real item: ' + treats.join(', '));
check(KINDS.every(k => P.KINDS[k].names.length >= 8 && P.KINDS[k].names.every(n => typeof n === 'string' && n.length <= 16)), 'every species has at least eight short names');
check(new Set(treats).size === 3, 'every species has its own treat');
check(P.pickName('moss_cat', 3) === P.pickName('moss_cat', 3) && P.KINDS.moss_cat.names.includes(P.pickName('moss_cat', 3)), 'pickName is deterministic and comes from the list');

// ---------------------------------------------------------------- (b) names
check(P.sanitizeName('  Flöckchen<b>\u0007 ', 'X') === 'Flöckchenb' && !/[<>\u0000-\u001f]/.test(P.sanitizeName('a<b>\u0001c', 'X')), 'angle brackets and control characters are removed');
check(P.sanitizeName('x'.repeat(40), 'X').length === 16, 'a name is at most 16 characters');
check(P.sanitizeName('   ', 'Funke') === 'Funke' && P.sanitizeName(null, 'Funke') === 'Funke' && P.sanitizeName(42, 'Funke') === '42', 'an empty or missing name falls back (numbers are text)');
check(P.NAME_MAX === 16 && P.MAX === 3 && P.TELEPORT === 24, 'the limits: names 16, three companions, teleport at 24 blocks');

// ---------------------------------------------------------------- helpers: a companion record and its player
const mk = (kind, x, z, state) => ({ kind, name: 'Funke', state: state || 'follow', pos: [x, 0, z], yaw: 0, seed: 1, idle: 0, clock: 0, progD: Infinity, progT: 0 });
const day = (pl) => ({ player: pl || [0, 0, 0], night: false, home: null });
const night = (home, pl) => ({ player: pl || [0, 0, 0], night: true, home: home || null });

// ---------------------------------------------------------------- (c) following
{
  const pet = mk('glimmer_fox', 30, 0);
  check(P.decide(pet, day(), 0.25) === 'teleport', 'a companion 30 blocks away teleports next to its player');
  check(pet.state === 'follow', '…and stays a follower');
  const near10 = mk('glimmer_fox', 10, 0);
  check(P.decide(near10, day(), 0.25) === 'path', 'one 10 blocks away is asked for a path');
  const close = mk('moss_cat', 1.5, 0);
  check(P.decide(close, day(), 0.25) === 'none', 'one 1.5 blocks away stands still');
  // stuck: 8 blocks away and no closer for seconds; it teleports, but not before 3.5 s of no progress
  const stuck = mk('crystal_pup', 8, 0);
  let first = -1, t = 0;
  for (let i = 0; i < 40; i++) { t += 0.25; if (P.decide(stuck, day(), 0.25) === 'teleport') { first = t; break; } }
  check(first >= 3.5 && first <= 5, 'stuck for 3.5 s it teleports (after ' + first + ' s)');
  // progress resets the stuck timer: it keeps coming closer, so no teleport
  const coming = mk('crystal_pup', 12, 0);
  let tele = false; for (let i = 0; i < 20; i++) { coming.pos[0] -= 0.4; if (P.decide(coming, day(), 0.25) === 'teleport') tele = true; }
  check(!tele, 'a companion that keeps coming closer is never teleported');
}

// ---------------------------------------------------------------- (d) sitting
{
  const sit = mk('moss_cat', 40, 0, 'sit');
  let moved = false; for (let i = 0; i < 80; i++) { if (P.decide(sit, day(), 0.25) !== 'none') moved = true; }
  check(!moved && sit.state === 'sit', 'a sitting companion stays where it is, 40 blocks from its player');
  const tg = mk('moss_cat', 3, 0);
  check(P.toggle(tg) === 'sit' && tg.state === 'sit' && P.toggle(tg) === 'follow' && tg.state === 'follow', 'a right-click toggles sit and follow');
  const sl = mk('moss_cat', 3, 0, 'sleep');
  check(P.toggle(sl) === 'follow' && sl.state === 'follow', 'a right-click wakes a sleeper and it follows');
  const c1 = mk('crystal_pup', 40, 0, 'sit');
  check(P.call(c1) === true && c1.state === 'follow', 'Pfeifen stands a sitter up: it follows');
  const c2 = mk('crystal_pup', 4, 0, 'follow');
  check(P.call(c2) === false && c2.state === 'follow', 'Pfeifen does nothing to one already following');
  const c3 = mk('crystal_pup', 4, 0, 'sleep');
  check(P.call(c3) === true && c3.state === 'follow', 'Pfeifen wakes a sleeper');
}

// ---------------------------------------------------------------- (e) night and the bed
{
  const home = [10, 0, 0];
  const p = mk('glimmer_fox', 2, 0);
  p.idle = 2;
  check(P.decide(p, night(home), 0.25) !== 'bed', 'at night but not idle long: no walk to bed yet');
  p.idle = 7;
  check(P.decide(p, night(home, [9, 0, 2]), 0.25) === 'bed', 'idle at night with its player near the bed: it walks to the bed');
  const far = mk('glimmer_fox', 2, 0); far.idle = 7;
  check(P.decide(far, night(home, [30, 0, 0]), 0.25) !== 'bed', '…but not when its player is far from the bed');
  p.pos[0] = 9.5; p.pos[2] = 0.2;
  check(P.decide(p, night(home), 0.25) === 'none' && p.state === 'sleep', 'at the bed it curls up asleep');
  const q = mk('glimmer_fox', 9.5, 0, 'sleep');
  check(P.decide(q, day(), 0.25) === 'none' && q.state === 'follow', 'at morning a sleeper gets up and follows');
  const r = mk('moss_cat', 9.5, 0, 'sleep');
  check(P.decide(r, night(home, [40, 0, 0]), 0.25) === 'teleport' && r.state === 'follow', 'a sleeper whose player is 24+ blocks away wakes and teleports');
  const s = mk('moss_cat', 9.5, 0, 'sleep');
  check(P.decide(s, night(home), 0.25) === 'none' && s.state === 'sleep', 'a sleeper stays asleep through the night');
  const noHome = mk('moss_cat', 3, 0); noHome.idle = 20;
  check(P.decide(noHome, night(null), 0.25) !== 'bed', 'without a bed or spawn point there is no night walk');
}

// ---------------------------------------------------------------- (f) thinking
{
  const a = P.thinkEvery(3 * 3), b = P.thinkEvery(20 * 20), c = P.thinkEvery(60 * 60);
  check(a === 0.2 && b === 0.4 && c === 1.0, 'thinks every 0.2 s near, 0.4 s mid-range, 1 s far (' + [a, b, c] + ')');
  check(a <= b && b <= c && c <= 1.0, 'the farther, the less often it thinks');
}

// ---------------------------------------------------------------- (g) moods
{
  check(P.mood(mk('moss_cat', 2, 0, 'sleep'), day()) === 'asleep', 'a sleeper is asleep');
  check(P.mood(mk('moss_cat', 2, 0, 'sit'), day()) === 'waiting', 'a sitter is waiting');
  check(P.mood(mk('moss_cat', 2, 0), night(null)) === 'sleepy', 'a follower at night is sleepy');
  check(P.mood(mk('moss_cat', 15, 0), day()) === 'coming', 'a follower 15 blocks away is coming');
  check(P.mood(mk('moss_cat', 2, 0), day()) === 'happy', 'a follower close by in the day is happy');
}

// ---------------------------------------------------------------- (h) the save format
{
  const pets = [
    { kind: 'glimmer_fox', name: 'Funke', state: 'sit', pos: [10.123, 64, -3.456], yaw: 1.23456, seed: 7 },
    { kind: 'moss_cat', name: 'Moosi', state: 'sleep', pos: [1, 2, 3], yaw: 0, seed: 2 },
  ];
  const out = P.serialize(pets);
  const json = JSON.stringify(out);
  check(json.length < 400, 'two companions take ' + json.length + ' bytes');
  const back = P.deserialize(JSON.parse(json));
  check(back.length === 2 && back[0].kind === 'glimmer_fox' && back[0].name === 'Funke' && back[0].state === 'sit', 'a round trip keeps kind, name and state');
  check(near(back[0].pos[0], 10.1, 0.051) && near(back[0].pos[2], -3.5, 0.051) && near(back[0].yaw, 1.23, 0.006), 'the place survives (to 0.1 blocks, yaw to 0.01)');
  check(back[1].state === 'sleep' && back[1].pos.length === 3 && Array.isArray(back[1].pos), 'a sleeper stays asleep, its place is a 3-array');
  check(P.deserialize(undefined).length === 0 && P.deserialize('x').length === 0 && P.deserialize({}).length === 0, 'no list, no companions');
  const bad = P.deserialize([
    { kind: 'zombie', name: 'Z', state: 'follow', pos: [0, 0, 0] },
    { kind: 'moss_cat', name: 'Ok', state: 'follow', pos: [NaN, 0, 0] },
    { kind: 'moss_cat', name: 'A'.repeat(40), state: 'dance', pos: [0, 0, 0] },
    { kind: 'crystal_pup', name: 'Wild', state: 'wild', pos: [1, 1, 1] },
    { kind: 'glimmer_fox', name: 'Huge', state: 'follow', pos: [1e9, 0, 0] },
    null, 'junk', { kind: 'glimmer_fox', name: '<b>Pip\u0002</b>', state: 'follow', pos: [0, 0, 0] },
  ]);
  const names = bad.map(x => x.name);
  check(bad.length === 3, 'bad records are dropped, the rest kept (' + names.join(' | ') + ')');
  check(bad[0].name.length === 16 && bad[0].state === 'follow', 'a long name is cut, an unknown state becomes follow');
  check(bad[1].state === 'follow' && bad[1].kind === 'crystal_pup' && bad[1].name === 'Wild', 'the old wild state becomes follow');
  check(bad[2].name === 'bPip/b', 'brackets and control characters are removed from a saved name (' + bad[2].name + ')');
  const five = [0, 1, 2, 3, 4].map(i => ({ kind: 'moss_cat', name: 'M' + i, state: 'follow', pos: [i, 0, 0] }));
  check(P.deserialize(five).length === 3 && P.serialize(five.map(x => Object.assign({}, x, { pos: x.pos }))).length === 3, 'at most three companions per player, both ways');
  check(P.deserialize(five)[0].pos.length === 3 && P.deserialize(five)[0].idle === 0, 'a loaded companion starts idle with no path');
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

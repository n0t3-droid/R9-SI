// Named quests (a-quests; plan docs/superpowers/plans/2026-10-22-a-quests.md, spec
// docs/superpowers/specs/2026-10-22-abenteuer-design.md §8). Every rule a check:
//   1. the generator: every kind of A§8, the same quest from the same (seed, village, villager, day) — in any order of the
//      places —, another day another quest, the givers of a day, every quest leads somewhere (a place, a plaza, the sky)
//   2. every kind completable through its own event: the items handed over, the kit placed, the lost thing picked up and
//      brought back, walked there together, a photo in frame at the hour (refused out of frame, too far, at another
//      hour), the outpost freed (stub), arrived on the moon (stub), repaired by standing there, the right answer
//   3. the records: ≤ 5 open, one per giver, the log, finishing twice gives nothing, a saved record survives JSON
//   4. the stubs (Befreien, Reisen) are generated and completable but never offered until their fronts switch them on
//   5. the riddles: three answers each, one right, each fact with its REFERENCE.md section, the order shuffled per quest
//   6. generation ≤ 0.2 ms
//   7. the glue in a stub page: an Abenteuer world only, the talk (offer, accept, the riddle, hand-in), rewards by size
//      through VR.Adventure (XP, Sterntaler) and the village's love (hearts), the givers' marks, the journal, J
//   8. every text key the quests use is in both tables, German first
//   bash test/wt_run.sh quests.js 300
const DOM = require('./dom_stub.js');
require('./load_shared.js');
require('../src/shared/adventure.js');
require('../src/main/i18n.js');
require('../src/main/lang_en.js');
require('../src/main/lang_de.js');
require('../src/main/settings_reg.js');
require('../src/main/binds.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const fs = require('fs'), path = require('path');
if (!fs.existsSync(path.join(__dirname, '../src/main/quests.js'))) { console.log('  ✗ src/main/quests.js missing'); console.log('FAILED 1'); process.exit(1); }
require('../src/main/quests.js');
const Q = VR.Quests, Adv = VR.Adv;
if (!Q || !Q.make) { console.log('  ✗ VR.Quests missing'); console.log('FAILED 1'); process.exit(1); }
const J = (o) => JSON.stringify(o);

// ---------------------------------------------------------------- the fixture: a village in the Heartland
const village = { x: 120, y: 80, z: -60, name: 'Lindenau', plaza: [118, 80, -58] };
const placesIn = {
  heart: true,
  vistas: [
    { id: 'v3', x: 200, y: 82, z: -20, lm: 'lighthouse', aim: [420, 120, 60] },
    { id: 'v7', x: 60, y: 84, z: -150, lm: 'citadel', aim: [-420, 249, 380] },
    { id: 'v9', x: 150, y: 81, z: -90, lm: 'isles', aim: [330, 170, 140] },
    { id: 'v12', x: 260, y: 83, z: -200, lm: 'mill_f2', aim: [300, 90, -260] },
  ],
  wonders: [{ key: 'w1', type: 'pyramide', x: 400, y: 70, z: -300, name: 'Sonnenpyramide' }],
  villages: [{ id: '3_4', name: 'Birkenhain', x: 500, y: 75, z: 100 }, { id: '1_2', name: 'Lindenau', x: 120, y: 80, z: -60 }],
  vid: '1_2',
};
const places = Q.places(placesIn);
const base = { seed: 4242, vid: '1_2', pid: '1_2:3:0', day: 5, role: 'farmer', age: 'adult', name: 'Mira Oakhart', village, places };
const make = (o) => Q.make(Object.assign({}, base, o || {}));

// ---------------------------------------------------------------- 1 · the generator
console.log('1 · the generator');
check(Array.isArray(Q.KINDS) && J(Q.KINDS) === J(['fetch', 'build', 'find', 'escort', 'photo', 'free', 'travel', 'repair', 'riddle']), 'the nine kinds of A§8 (' + (Q.KINDS || []).join(', ') + ')');
check(places.length >= 9 && places.every((p, i) => i === 0 || places[i - 1].id < p.id), 'the places: the fixed landmarks, the vistas, a wonder, the other village — sorted by id (' + places.map(p => p.id).join(' ') + ')');
check(!places.some(p => p.id === 'vil:1_2'), 'the giver\'s own village is not a destination');
check(places.some(p => p.id === 'lm:lake' && p.lm === 'lake') && places.some(p => p.id === 'lm:citadel'), 'the lake under the isles and the citadel are places');
{
  const a = make(), b = make();
  check(a && J(a) === J(b), 'the same (seed, village, villager, day): the same quest (' + (a && a.k) + ' ' + (a && a.id) + ')');
  const c = Q.make(Object.assign({}, base, { places: places.slice().reverse() }));
  check(J(a) === J(c), 'the order of the places list changes nothing');
  let differ = 0, kinds = new Set();
  for (let d = 0; d < 40; d++) { const q = make({ day: d }); if (q && q.id !== a.id) differ++; if (q) kinds.add(q.k); }
  check(differ >= 39 && kinds.size >= 4, 'another day, another quest (' + differ + ' of 40 differ; kinds over 40 days: ' + [...kinds].join(', ') + ')');
  const other = make({ pid: '1_2:4:1' });
  check(other && other.id !== a.id, 'another villager, another quest');
}
// every kind on its own (forced), each with somewhere to go
const byKind = {};
for (const k of Q.KINDS) {
  const q = make({ kinds: [k], avail: { free: true, travel: true }, places: k === 'free' ? Q.places(Object.assign({}, placesIn, { outposts: [{ id: 'o1', x: -300, y: 70, z: 500 }] })) : places });
  byKind[k] = q;
  check(q && q.k === k && q.s === Q.SIZE[k] || (k === 'find' && q && /^[SM]$/.test(q.s)), 'kind ' + k + ': generated, size ' + (q && q.s));
}
check(J(Q.SIZE) === J({ fetch: 'S', build: 'M', find: 'S', escort: 'M', photo: 'S', free: 'L', travel: 'L', repair: 'M', riddle: 'S' }), 'the sizes of A§8 (find M when far)');
{
  const f = byKind.fetch.q, b = byKind.build.q, fi = byKind.find.q, e = byKind.escort.q, p = byKind.photo.q, r = byKind.repair.q;
  check(!!VR.itemDef(f.item) && f.n > 0, 'Bringen: an item that exists, a count (' + f.n + ' × ' + f.item + ')');
  check(!!VR.R.byName[b.block] && b.n > 0 && b.at && b.at.r > 0, 'Bauen: a block of our own to place, the kit, where (' + b.n + ' × ' + b.block + ' at ' + b.what + ')');
  const dF = Math.hypot(fi.at.x - village.x, fi.at.z - village.z);
  check(fi.thing && fi.at && dF >= 60 && dF <= 600 && fi.spot && Number.isFinite(fi.spot[0]), 'Suchen: a lost thing (' + fi.thing + ') at a place 60–600 blocks away (' + Math.round(dF) + ', ' + fi.at.id + ')');
  const dE = Math.hypot(e.to.x - village.x, e.to.z - village.z);
  check(e.to && dE >= 40 && dE <= 170, 'Begleiten: a walk of 40–170 blocks from the village (' + Math.round(dE) + ' to ' + e.to.id + ')');
  check(p.at && p.hour && Q.HOURS[p.hour] && p.maxD > 0, 'Fotografieren: a landmark at its hour (' + p.at.id + ' · ' + p.hour + ')');
  check(r.what && r.at, 'Reparieren: something broken somewhere (' + r.what + ' at ' + (r.at.id || 'plaza') + ')');
  check(byKind.riddle.q.rid && byKind.riddle.q.order.length === 3, 'Rätsel: a riddle with three answers (' + byKind.riddle.q.rid + ')');
  check(byKind.free.q.at && /^out:/.test(byKind.free.q.at.id), 'Befreien (stub): the nearest outpost');
  check(['opal', 'basalt'].includes(byKind.travel.q.dim), 'Reisen (stub): a moon (' + byKind.travel.q.dim + ')');
}
// the photo targets' hours and the lake at the murmuration hour
{
  let lake = null, citadel = null;
  for (let d = 0; d < 300 && (!lake || !citadel); d++) {
    const q = make({ day: d, kinds: ['photo'], role: 'pilot' });
    if (q && q.q.at.lm === 'lake') lake = q; if (q && q.q.at.lm === 'citadel') citadel = q;
  }
  check(lake && lake.q.hour === 'murm', 'the lake is photographed when the swarms fly (' + (lake && lake.q.hour) + ')');
  check(citadel && ['golden', 'night'].includes(citadel.q.hour), 'the citadel at the golden hour or at night (' + (citadel && citadel.q.hour) + ')');
  check(Q.inHour('murm', 11000) && !Q.inHour('murm', 6000) && Q.inHour('night', 18000) && Q.inHour('dawn', 23500) && Q.inHour('dawn', 500) && !Q.inHour('dawn', 6000), 'the hours: the swarms at dusk, the night, the dawn across midnight');
  check(Q.untilHour('golden', 6000) === 4000 && Q.untilHour('golden', 11000) === 0 && Q.untilHour('dawn', 20000) === 2500, 'the time until an hour opens (ticks)');
}
// the givers of a day
{
  const people = []; for (let h = 0; h < 8; h++) for (let k = 0; k < 3; k++) people.push({ id: '1_2:' + h + ':' + k, age: k === 2 ? 'child' : 'adult', role: k === 2 ? 'child' : 'farmer' });
  const g1 = Q.givers(4242, '1_2', 5, people), g2 = Q.givers(4242, '1_2', 5, people.slice().reverse()), g3 = Q.givers(4242, '1_2', 6, people);
  check(g1.length >= 2 && g1.length <= 4 && J(g1) === J(g2), 'the givers of a day: 2–4 of the village, the same whatever the order (' + g1.join(', ') + ')');
  check(J(g1) !== J(g3), 'the next day other givers');
  check(Q.givers(4242, '1_2', 5, people.slice(0, 1)).length === 1, 'a village of one: one giver');
}
// every quest leads somewhere: a place, the plaza or the sky (the riddle's „see it")
{
  let ok = 0, n = 0;
  for (let d = 0; d < 60; d++) for (const role of ['farmer', 'scholar', 'child', 'elder', 'builder', 'pilot']) {
    const q = make({ day: d, role, pid: '1_2:' + d + ':' + role.length }); if (!q) continue; n++;
    if (Q.where(q)) ok++;
  }
  check(n > 300 && ok === n, 'every generated quest names where it leads (' + ok + ' of ' + n + ')');
}

// ---------------------------------------------------------------- 2 · every kind completable
console.log('2 · every kind completable');
const freshRec = () => Adv.fresh({ on: true });
const now = 1e12;
const inv = (o) => ({ c: Object.assign({}, o), count(id) { return this.c[id] | 0; }, remove(id, n) { if ((this.c[id] | 0) < n) return false; this.c[id] -= n; return true; }, add(id, n) { this.c[id] = (this.c[id] | 0) + n; return n; } });
{
  // Bringen
  const rec = freshRec(), q = byKind.fetch;
  check(Q.accept(rec, q, now).ok && Q.get(rec, q.pid).st === 'open', 'Bringen accepted: open');
  const short = Q.handIn(rec, q.pid, inv({ [q.q.item]: q.q.n - 1 }));
  check(!short.ok && short.why === 'short' && short.have === q.q.n - 1, 'one short: refused, how many said (' + J(short) + ')');
  const I = inv({ [q.q.item]: q.q.n + 3 }), ok = Q.handIn(rec, q.pid, I);
  check(ok.ok && I.count(q.q.item) === 3 && Q.get(rec, q.pid).st === 'ready', 'enough: taken (3 left), ready');
  const f = Q.finish(rec, q.pid, now);
  check(f.ok && f.size === 'S' && f.hearts === 1 && !Q.get(rec, q.pid) && Q.log(rec).length === 1, 'finished: size S, one heart, in the log');
  check(!Q.finish(rec, q.pid, now).ok, 'finishing twice gives nothing');
}
{
  // Bauen
  const rec = freshRec(), q = byKind.build, b = q.q;
  Q.accept(rec, q, now);
  let r = Q.placed(rec, b.at.x + 100, b.at.y, b.at.z, b.block);
  check(!r.length && Q.get(rec, q.pid).n === 0, 'a block far away does not count');
  r = Q.placed(rec, b.at.x + 1, b.at.y, b.at.z, 'oak_planks');
  check(!r.length, 'another block does not count');
  for (let i = 0; i < b.n; i++) r = Q.placed(rec, b.at.x + (i % 3), b.at.y + 1, b.at.z + (i / 3 | 0), b.block);
  check(Q.get(rec, q.pid).st === 'ready' && r.length === 1 && r[0].ready, 'the kit placed there: ready (' + b.n + ' × ' + b.block + ')');
  check(Q.finish(rec, q.pid, now).size === 'M', 'Bauen is a medium quest');
}
{
  // Suchen: picked up at the spot, then brought back
  const rec = freshRec(), q = byKind.find, s = q.q.spot;
  Q.accept(rec, q, now);
  check(!Q.near(rec, [s[0] + 30, 80, s[1]], 0.5).length && !Q.get(rec, q.pid).q.got, 'far from the spot: nothing');
  const ev = Q.near(rec, [s[0] + 1, 80, s[1] + 1], 0.5);
  check(ev.length === 1 && ev[0].ev === 'found' && Q.get(rec, q.pid).q.got && Q.get(rec, q.pid).st === 'ready', 'at the spot: found (' + q.q.thing + ') — ready to bring back');
  check(Q.finish(rec, q.pid, now).ok, 'brought back: finished');
}
{
  // Begleiten
  const rec = freshRec(), q = byKind.escort, to = q.q.to;
  Q.accept(rec, q, now);
  check(Q.escortStep(rec, q.pid, [village.x, 80, village.z], [village.x + 2, 80, village.z]) === 'go', 'together: they walk');
  check(Q.escortStep(rec, q.pid, [village.x, 80, village.z], [village.x + 40, 80, village.z]) === 'wait', 'the player far behind: the villager waits');
  check(Q.escortStep(rec, q.pid, [to.x + 1, 80, to.z], [to.x + 3, 80, to.z + 2]) === 'arrived' && Q.get(rec, q.pid).st === 'ready', 'there together: arrived, ready');
}
{
  // Fotografieren
  const rec = freshRec(), q = byKind.photo, at = q.q.at, aim = [at.x, at.top || at.y, at.z];
  Q.accept(rec, q, now);
  const camAt = (dist, off) => { const ang = Math.atan2(aim[0] - village.x, aim[2] - village.z), x = aim[0] - Math.sin(ang) * dist, z = aim[2] - Math.cos(ang) * dist, y = aim[1] - 10; const dx = aim[0] - x, dy = aim[1] - y, dz = aim[2] - z, h = Math.hypot(dx, dz); return { x, y, z, yaw: Math.atan2(-dx, -dz) + (off || 0), pitch: Math.atan2(dy, h) }; };
  const inH = (Q.HOURS[q.q.hour][0] + 50) % 24000, outH = (Q.HOURS[q.q.hour][1] + 3000) % 24000;
  let r = Q.photo(rec, camAt(Math.min(200, q.q.maxD * 0.5), 0.9), inH);
  check(r.length === 1 && !r[0].ok && r[0].why === 'frame' && Q.get(rec, q.pid).st === 'open', 'the landmark not in the picture: no');
  r = Q.photo(rec, camAt(q.q.maxD * 1.6, 0), inH);
  check(r.length === 1 && !r[0].ok && r[0].why === 'far', 'too far away: no');
  r = Q.photo(rec, camAt(Math.min(200, q.q.maxD * 0.5), 0), outH);
  check(r.length === 1 && !r[0].ok && r[0].why === 'hour', 'in the picture at another hour: no — the hour is said');
  r = Q.photo(rec, camAt(Math.min(200, q.q.maxD * 0.5), 0.1), inH);
  check(r.length === 1 && r[0].ok && Q.get(rec, q.pid).st === 'ready', 'in the picture, near, at its hour: the photo is ready to show (' + at.id + ')');
}
{
  // Befreien (stub) and Reisen (stub)
  const rec = freshRec();
  const tq = Object.assign({}, byKind.travel, { pid: '1_2:8:0' });
  check(Q.accept(rec, byKind.free, now).ok && Q.accept(rec, tq, now).ok, 'both accepted (two givers)');
  byKind.travel = tq;
  check(!Q.event(rec, 'freed', { id: 'o9' }).length && Q.get(rec, byKind.free.pid).st === 'open', 'another outpost freed: nothing');
  check(Q.event(rec, 'freed', { id: byKind.free.q.at.id }).length === 1 && Q.get(rec, byKind.free.pid).st === 'ready', 'Befreien: its outpost freed (a-foes\' event) — ready');
  check(Q.event(rec, 'arrive', { dim: byKind.travel.q.dim }).length === 1 && Q.get(rec, byKind.travel.pid).st === 'ready', 'Reisen: arrived on ' + byKind.travel.q.dim + ' (u-cruise\'s event) — ready');
  check(Q.finish(rec, byKind.free.pid, now).size === 'L' && Q.finish(rec, byKind.travel.pid, now).size === 'L', 'both are large quests');
}
{
  // Reparieren: standing there, longer with no skill, shorter with Geschick 5
  const rec = freshRec(), q = byKind.repair, a = q.q.at;
  Q.accept(rec, q, now);
  let t = 0, done = null;
  for (let i = 0; i < 20 && !done; i++) { const ev = Q.near(rec, [a.x + 1, a.y, a.z + 1], 0.5, 0); t += 0.5; if (ev.some(e => e.ev === 'repaired')) done = t; }
  check(done === 3, 'Reparieren: 3 s at the spot (' + done + ' s)');
  const rec2 = freshRec(); Q.accept(rec2, q, now);
  Q.near(rec2, [a.x + 1, a.y, a.z + 1], 1.5, 5); Q.near(rec2, [a.x + 40, a.y, a.z], 5, 5);
  check(Q.get(rec2, q.pid).q.prog > 0 && Q.get(rec2, q.pid).st === 'open', 'walking away keeps the progress (never reset)');
  let t2 = 1.5, done2 = null;
  for (let i = 0; i < 20 && !done2; i++) { const ev = Q.near(rec2, [a.x, a.y, a.z], 0.3, 5); t2 += 0.3; if (ev.some(e => e.ev === 'repaired')) done2 = t2; }
  check(done2 && done2 <= 2.5, '🛠 Geschick 5: 2.4 s (' + (done2 && done2.toFixed(1)) + ' s)');
}
{
  // Rätsel: a wrong answer greys, the right one finishes
  const rec = freshRec(), q = byKind.riddle;
  Q.accept(rec, q, now);
  const right = q.q.order.indexOf(0), wrong = (right + 1) % 3;
  const w = Q.answer(rec, q.pid, wrong);
  check(!w.right && Q.get(rec, q.pid).q.tried.includes(wrong) && Q.get(rec, q.pid).st === 'open', 'a wrong answer: greyed, never punished, try again');
  const r = Q.answer(rec, q.pid, right);
  check(r.right && Q.get(rec, q.pid).st === 'ready', 'the right answer: ready');
}

// ---------------------------------------------------------------- 3 · the records
console.log('3 · the records');
{
  const rec = freshRec();
  let n = 0;
  for (let i = 0; i < 7; i++) { const q = make({ pid: '1_2:' + i + ':0' }); if (Q.accept(rec, q, now).ok) n++; }
  const r6 = Q.accept(rec, make({ pid: '1_2:9:0' }), now);
  check(n === 5 && !r6.ok && r6.why === 'full' && Q.open(rec).length === 5, 'at most five open (the sixth: „Dein Tagebuch ist voll")');
  const again = Q.accept(rec, make({ pid: '1_2:0:0', day: 6 }), now);
  check(!again.ok && again.why === 'have', 'one quest per giver at a time');
  const q0 = Q.get(rec, '1_2:0:0');
  check(Q.drop(rec, '1_2:0:0') && !Q.get(rec, '1_2:0:0') && Q.open(rec).length === 4, 'given up: gone (the giver asks again another day)');
  check(Q.offer(rec, Object.assign({}, base, { pid: '1_2:0:0', day: q0.d })) === null, 'given up today: no new offer from that giver today');
  const saved = JSON.parse(JSON.stringify(Adv.load(JSON.parse(JSON.stringify(rec)))));
  check(Q.open(saved).length === 4 && J(Q.get(saved, '1_2:1:0')) === J(Q.get(rec, '1_2:1:0')), 'the records survive the save (Adv.load keeps me.quests)');
  check(Q.sanitize({ me: { quests: { x: 5, y: { k: 'nope' }, '1_2:1:0': Q.get(rec, '1_2:1:0') } } }) === 1, 'sanitize: garbage records go, good ones stay');
  // done today: no second offer from the same giver; tomorrow again
  const rec2 = freshRec(), qd = make({ pid: '1_2:5:0', kinds: ['riddle'] });
  Q.accept(rec2, qd, now); Q.answer(rec2, qd.pid, qd.q.order.indexOf(0)); Q.finish(rec2, qd.pid, now);
  check(Q.offer(rec2, Object.assign({}, base, { pid: '1_2:5:0' })) === null && Q.offer(rec2, Object.assign({}, base, { pid: '1_2:5:0', day: base.day + 1 })) !== null, 'done today: nothing more today, a new quest tomorrow');
  for (let i = 0; i < 40; i++) { const qq = make({ pid: 'x:' + i + ':0', kinds: ['riddle'] }); Q.accept(rec2, qq, now); Q.answer(rec2, qq.pid, qq.q.order.indexOf(0)); Q.finish(rec2, qq.pid, now); }
  check(Q.log(rec2).length === 30, 'the log keeps the last 30');
}

// ---------------------------------------------------------------- 4 · the stubs wait for their fronts
console.log('4 · the stubs');
{
  let free = 0, travel = 0, any = 0;
  const pl = Q.places(Object.assign({}, placesIn, { outposts: [{ id: 'o1', x: -300, y: 70, z: 500 }] }));
  for (let d = 0; d < 200; d++) for (const role of ['ranger', 'pilot', 'operator']) { const q = make({ day: d, role, places: pl }); if (!q) continue; any++; if (q.k === 'free') free++; if (q.k === 'travel') travel++; }
  check(any > 500 && free === 0 && travel === 0, 'without a-foes and u-cruise: never offered (' + any + ' quests of rangers and pilots)');
  let f2 = 0, t2 = 0;
  for (let d = 0; d < 200; d++) for (const role of ['ranger', 'pilot']) { const q = make({ day: d, role, places: pl, avail: { free: true, travel: true } }); if (q && q.k === 'free') f2++; if (q && q.k === 'travel') t2++; }
  check(f2 > 10 && t2 > 10, 'switched on, they come (' + f2 + ' Befreien, ' + t2 + ' Reisen)');
  check(Q.avail().free === false && Q.avail().travel === false, 'in this build: VR.Liberate missing, Q.TRAVEL_ON off');
}

// ---------------------------------------------------------------- 5 · the riddles
console.log('5 · the riddles');
{
  const R = Q.RIDDLES, de = VR.I18N.dict.de, en = VR.I18N.dict.en;
  check(Array.isArray(R) && R.length >= 12, 'at least twelve riddles (' + (R && R.length) + ')');
  const ref = fs.readFileSync(path.join(__dirname, '../docs/universe/REFERENCE.md'), 'utf8');
  let bad = [];
  for (const r of R) {
    const keys = ['q', 'a0', 'a1', 'a2', 'why'].map(k => 'g.q.rid.' + r.id + '.' + k).concat(r.see ? ['g.q.rid.' + r.id + '.see'] : []);
    if (!keys.every(k => de[k] && en[k])) bad.push(r.id + ' keys');
    const sec = /^R§(\d+(?:\.\d+)?)$/.exec(r.ref || '');
    if (!sec || ref.indexOf('## ' + sec[1].split('.')[0] + '.') < 0) bad.push(r.id + ' ref ' + r.ref);
    if (new Set([de['g.q.rid.' + r.id + '.a0'], de['g.q.rid.' + r.id + '.a1'], de['g.q.rid.' + r.id + '.a2']]).size !== 3) bad.push(r.id + ' answers');
  }
  check(!bad.length, 'each: a question, three different answers (a0 the right one in the tables), why, its REFERENCE.md section' + (bad.length ? ': ' + bad.join(', ') : ''));
  const orders = new Set(); let rights = [0, 0, 0];
  for (let d = 0; d < 90; d++) { const q = make({ day: d, kinds: ['riddle'] }); orders.add(q.q.order.join('')); rights[q.q.order.indexOf(0)]++; }
  check(orders.size >= 5 && rights.every(n => n >= 15), 'the right answer is not always in the same place (' + rights.join(' / ') + ')');
  check(/blau/i.test(de['g.q.rid.dust_sunset.q'] + de['g.q.rid.dust_sunset.a0']) && /Ocker/.test(de['g.q.rid.dust_sunset.q']), 'the blue sunset on a dust world (Ocker, R§2.3)');
  check(/dünn|Meter/i.test(de['g.q.rid.ring_thin.a0']), 'why the ring is thin (R§4.2)');
}

// ---------------------------------------------------------------- 6 · generation time
console.log('6 · generation time');
{
  // (the best of three rounds: a busy machine — other tests, browsers — must not fail a bound the code keeps)
  const n = 4000, best = (fn) => { let b = Infinity; for (let r = 0; r < 3; r++) { const t0 = process.hrtime.bigint(); fn(); b = Math.min(b, Number(process.hrtime.bigint() - t0) / 1e6 / n); } return b; };
  const ms = best(() => { for (let i = 0; i < n; i++) make({ day: i, pid: '1_2:' + (i % 9) + ':0', role: ['farmer', 'scholar', 'child', 'pilot'][i & 3] }); });
  check(ms <= 0.2, 'Q.make: ' + (ms * 1000).toFixed(1) + ' µs a quest (≤ 0.2 ms)');
  const people = []; for (let h = 0; h < 30; h++) people.push({ id: '1_2:' + h + ':0', age: 'adult', role: 'farmer' });
  const gm = best(() => { for (let i = 0; i < n; i++) Q.givers(4242, '1_2', i, people); });
  check(gm <= 0.2, 'Q.givers for a village of 30: ' + (gm * 1000).toFixed(1) + ' µs (≤ 0.2 ms; once a day per village, cached)');
}

// ---------------------------------------------------------------- 7 · the glue in a stub page
console.log('7 · the glue (stub page)');
for (const id of ['hud', 'app', 'ui', 'minimap', 'compass']) { const e = DOM.mkEl('div'); e.setAttribute('id', id); DOM.body.appendChild(e); }
const talk = DOM.mkEl('div'); talk.setAttribute('id', 'talk'); DOM.body.appendChild(talk);
for (const id of ['tk_text', 'tk_opts', 'tk_name', 'tk_role', 'tk_rep']) { const e = DOM.mkEl('div'); e.setAttribute('id', id); talk.appendChild(e); }
const mkGame = (meta) => ({
  state: 'play', meta, settings: { advHud: true }, difficulty: meta.difficulty, dim: 'overworld', seed: 4242,
  player: { pos: [village.x, 80, village.z], spawn: [0.5, 70, 0.5], mode: 'survival', eye: 1.62, inv: Object.assign(inv({}), { held: null }), lookDir: () => [0, 0, -1], eyePos() { return [this.pos[0], this.pos[1] + 1.62, this.pos[2]]; } },
  env: { day: 5, timeOfDay: 6000 }, ui: { screen: null, blocking: false, typing: false, toasts: [], toast(a, b) { this.toasts.push(a + ' ' + b); }, hint() {}, show(id) { this.screen = id; }, resume() { this.screen = null; } },
  audio: { n: 0, ctx: null, play() { this.n++; }, tone() { this.n++; } },
  particles: { n: 0, glow() { this.n++; }, spark() { this.n++; }, spawn() { this.n++; } },
  saved: 0, saveMeta() { this.saved++; return Promise.resolve(); },
});
require('../src/main/adventure.js');
const A = VR.Adventure;
{
  const meta = { id: 'w1', name: 'Q', difficulty: 'peaceful', mode: 'survival', seed: 4242, created: Date.now() - 1e7 };
  const g = VR.game = mkGame(meta);
  A.bind();
  check(!Q.on(), 'a builder\'s world: no quests (Q.on() false)');
  const st = { rep: 0, met: [], quests: {} };
  const vil = { id: '1_2', name: 'Lindenau', plan: { id: '1_2', x: village.x, y: village.y, z: village.z, plaza: { x: village.plaza[0], y: village.plaza[1], z: village.plaza[2] }, seed: 99 }, st, people: [], fams: [{ surname: 'Oakhart', members: [] }], agents: [] };
  const mkA = (h, k, role, age, nm) => { const p = { id: '1_2:' + h + ':' + k, name: nm, role, age, fam: 0, seed: 1000 + h * 7 + k }; vil.people.push(p); vil.fams[0].members.push(p); const a = { vil, p, pos: [village.x + h, 80, village.z + k], h: 1.75, kid: age === 'child', elder: age === 'elder', get name() { return p.name + ' Oakhart'; }, get role() { return p.role; }, say(t) { this.said = t; } }; vil.agents.push(a); return a; };
  const people = [mkA(0, 0, 'farmer', 'adult', 'Mira'), mkA(0, 1, 'scholar', 'adult', 'Oren'), mkA(1, 0, 'child', 'child', 'Pip'), mkA(1, 1, 'elder', 'elder', 'Rosa'), mkA(2, 0, 'baker', 'adult', 'Juno'), mkA(2, 1, 'smith', 'adult', 'Kael')];
  const mgr = { g, agents: vil.agents, known: new Map([['1_2', vil]]), sites: [], talking: null, talkText(s) { DOM.body.querySelector('#tk_text').textContent = s; this.last = s; }, talkOptions() { this.opts = (this.opts || 0) + 1; }, hearts() { this.hearts_ = (this.hearts_ || 0) + 1; }, renderRep() {}, chirp() {} };
  g.villages = mgr;
  // the classic request stays in a builder's world
  check(Q.talk(mgr, people[0]) === null, 'a builder\'s world: villages.js keeps its own request (Q.talk gives null)');
  A.setOn(true);
  check(Q.on(), 'an Abenteuer world: quests on');
  Q.placesNow = places;   // (the glue's places: the test gives them, the game asks the worker for the vistas)
  const givers = Q.giversOf(vil, g.env.day);
  check(givers.length >= 2, 'the givers of the day in Lindenau: ' + givers.map(pid => vil.people.find(p => p.id === pid).name).join(', '));
  Q.mark(mgr);
  const marked = vil.agents.filter(a => a.qMark === 1);
  check(marked.length === givers.length && marked.every(a => givers.includes(a.p.id)), 'the givers carry the ✦ (gold: an offer)');
  const giver = marked[0], nonGiver = vil.agents.find(a => !a.qMark);
  // talk to a non-giver: points to a giver
  const t0 = Q.talk(mgr, nonGiver);
  check(typeof t0 === 'string' && t0.indexOf(giver.p.name) >= 0 || givers.some(pid => t0.indexOf(vil.people.find(p => p.id === pid).name) >= 0), 'someone without a quest points to a giver: „' + t0 + '"');
  // talk to the giver: the offer and its buttons
  const t1 = Q.talk(mgr, giver);
  const opts = DOM.body.querySelector('#tk_opts');
  check(typeof t1 === 'string' && t1.length > 10 && opts.children.length >= 2, 'the giver offers a quest: „' + t1 + '" (' + opts.children.length + ' buttons)');
  const acceptBtn = opts.children.find(b => b.dataset && b.dataset.q === 'accept');
  check(!!acceptBtn, 'a button to accept (✓)');
  acceptBtn.click();
  const recQ = Q.get(A.rec, giver.p.id);
  check(recQ && recQ.st === 'open' && g.saved > 0, 'accepted: in the Tagebuch, saved (' + (recQ && recQ.k) + ')');
  check(giver.qMark !== 1 || (Q.mark(mgr), giver.qMark !== 1), 'an accepted quest takes the ✦ away');
  // a riddle through the talk: force one on the scholar
  const sch = people.find(a => !Q.get(A.rec, a.p.id) && a.p.role !== 'child');
  const rq = Q.make(Object.assign({}, base, { pid: sch.p.id, role: sch.p.role, kinds: ['riddle'], name: sch.p.name + ' Oakhart', day: g.env.day }));
  check(Q.accept(A.rec, rq, Date.now()).ok, 'a riddle for ' + sch.p.name + ' accepted');
  Q.talk(mgr, sch);
  const ans = opts.children.filter(b => b.dataset && b.dataset.q === 'answer');
  check(ans.length === 3, 'the riddle in the talk: three answers as buttons');
  const xp0 = A.rec.me.xp, tal0 = A.rec.me.taler, rep0 = st.rep;
  const right = ans.find(b => +b.dataset.i === rq.q.order.indexOf(0)), wrongB = ans.find(b => b !== right);
  wrongB.click();
  check(Q.get(A.rec, sch.p.id) && A.rec.me.xp === xp0, 'a wrong answer: nothing lost, the quest stays');
  const right2 = DOM.body.querySelector('#tk_opts').children.find(b => b.dataset && b.dataset.q === 'answer' && +b.dataset.i === rq.q.order.indexOf(0));
  right2.click();
  check(!Q.get(A.rec, sch.p.id) && A.rec.me.xp - xp0 === 20 && A.rec.me.taler - tal0 === 15 && st.rep - rep0 === 2, 'the right answer: 20 XP, 15 Sterntaler, the village\'s love +2 (one heart) — a small quest (' + (A.rec.me.xp - xp0) + ' XP, ' + (A.rec.me.taler - tal0) + ' Taler)');
  check(/Ocker|Sonne|Ring|Komet|Licht|Mond|Stern|Station|Uranus|Titan|Bennu|Polarlicht|Enceladus|Phobos/.test(mgr.last || ''), 'the answer explains the fact: „' + String(mgr.last).slice(0, 90) + ' …"');
  // a medium quest through the glue: a build, placed through VR.Adventure.placed
  const smith = people.find(a => !Q.get(A.rec, a.p.id) && a !== sch && a.p.role !== 'child');
  const bq = Q.make(Object.assign({}, base, { pid: smith.p.id, role: smith.p.role, kinds: ['build'], day: g.env.day }));
  const blockId = VR.R.byName[bq.q.block].defaultState;
  g.world = { getBlock: () => blockId };
  Q.accept(A.rec, bq, Date.now());
  Q.kit(g, bq);
  check(g.player.inv.count(bq.q.block) === bq.q.n, 'Bauen: the kit is given when accepting (' + bq.q.n + ' × ' + bq.q.block + ')');
  const xp1 = A.rec.me.xp, tal1 = A.rec.me.taler, rep1 = st.rep;
  for (let i = 0; i < bq.q.n; i++) A.placed(bq.q.at.x + i, bq.q.at.y, bq.q.at.z);
  check(!Q.get(A.rec, smith.p.id) && A.rec.me.xp - xp1 >= 50 && A.rec.me.taler - tal1 >= 40 && st.rep - rep1 === 4, 'placed: done on the spot — 50 XP, 40 Sterntaler, two hearts (' + (A.rec.me.xp - xp1) + ' XP incl. placing)');
  check(g.ui.toasts.some(t => /✦/.test(t)), 'a toast says so: ' + g.ui.toasts.slice(-1)[0]);
  // a large quest's reward
  const freeA = people.find(a => !Q.get(A.rec, a.p.id) && a !== sch && a !== smith);
  const lq = Q.make(Object.assign({}, base, { pid: freeA.p.id, kinds: ['free'], avail: { free: true }, places: Q.places(Object.assign({}, placesIn, { outposts: [{ id: 'o1', x: -300, y: 70, z: 500 }] })), day: g.env.day }));
  Q.accept(A.rec, lq, Date.now());
  const xp2 = A.rec.me.xp, tal2 = A.rec.me.taler;
  Q.emit('freed', { id: lq.q.at.id });
  Q.talk(mgr, freeA);
  check(A.rec.me.xp - xp2 === 120 && A.rec.me.taler - tal2 === 100, 'a large quest: 120 XP, 100 Sterntaler (handed in at the giver)');
  // the journal on J
  const J0 = Q.journal();
  check(J0 && g.ui.screen === 'journal' && DOM.body.querySelector('#journal'), 'J opens the Tagebuch (#journal)');
  const jq = DOM.body.querySelector('#journal .panel');
  check(jq && /Tagebuch/.test(jq.innerHTML) && /Mira|Lindenau/.test(jq.innerHTML), 'it lists the open quest with its giver and village');
  check(VR.Binds.byName('KeyJ') === 'journal', 'binds.js: J is the Tagebuch\'s key (journal)');
  Q.closeJournal();
  check(g.ui.screen === null, 'opened in the game: closing it goes back to the game');
  g.ui.pause = function () { this.screen = 'pause'; };
  g.ui.screen = 'pause'; Q.journal(); Q.closeJournal();
  check(g.ui.screen === 'pause', 'opened from the pause menu: Esc steps back to the pause menu');
  g.ui.screen = null;
  // the world's places for a village (the game's path, not the test's): the vistas from a worker, the villages within 600
  {
    Q.placesNow = null;
    const meta0 = g.meta.vgen, pool0 = g.pool, sa0 = mgr.siteAt, si0 = mgr.sites, w0 = Q.VISTA_WAIT;
    g.meta.vgen = 11; let asked = 0;
    g.pool = { direct() { asked++; } };   // a worker that never answers
    mgr.siteAt = [village.x + 120, village.z]; mgr.sites = [{ id: 'near', x: village.x + 500, y: 70, z: village.z, name: 'Nahdorf' }, { id: 'far', x: village.x + 800, y: 70, z: village.z, name: 'Ferndorf' }];
    check(Q.placesFor(vil) === null && asked === 1, 'the vistas asked from a worker once: no places (no offers) until the answer');
    Q.VISTA_WAIT = 0;
    const pl1 = Q.placesFor(vil);
    check(Array.isArray(pl1) && pl1.length > 0 && !pl1.some(p => p.kind === 'vista'), 'a worker that never answers: after Q.VISTA_WAIT the places go without the vistas (' + (pl1 ? pl1.length : 0) + ')');
    const ids = (pl1 || []).filter(p => p.kind === 'village').map(p => p.id);
    check(ids.indexOf('vil:near') >= 0 && ids.indexOf('vil:far') < 0, 'the villages within 600 only (the same list from anywhere within 300 of the village): ' + ids.join(', '));
    mgr.siteAt = [village.x + 500, village.z];
    check(Q.placesFor(vil) === null, 'asked far from the village (500): no places — the list might miss a village');
    g.meta.vgen = meta0; g.pool = pool0; mgr.siteAt = sa0; mgr.sites = si0; Q.VISTA_WAIT = w0; Q.placesNow = places;
  }
  // the marks do nothing in a builder's world
  A.setOn(false); Q.mark(mgr);
  check(vil.agents.every(a => !a.qMark), 'the Abenteuer off: no ✦');
  check(Q.talk(mgr, giver) === null, 'and the classic request again');
}

// ---------------------------------------------------------------- 8 · the texts
console.log('8 · the texts');
{
  const de = VR.I18N.dict.de, en = VR.I18N.dict.en, keys = Q.keys();
  const miss = keys.filter(k => !(k in de) || !(k in en));
  check(keys.length > 80 && !miss.length, 'every key the quests use is in both tables (' + keys.length + ')' + (miss.length ? ': missing ' + miss.slice(0, 12).join(', ') : ''));
  const src = fs.readFileSync(path.join(__dirname, '../src/main/quests.js'), 'utf8');
  check(!/€|\bEUR\b|\bUSD\b|\$\s*\d/.test(src.replace(/\/\/.*$/gm, '')), 'no real money in the quests');
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

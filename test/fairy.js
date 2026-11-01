// a-fairy (docs/superpowers/plans/2026-10-31-a-fairy.md): the enchanted places and the folk's adventures — the pure part.
//   1. the places: a pure function of (seed, world, the first standing point); 2–5 a world, apart, on the ring
//   2. their hours: the mushroom wood at dusk and night, the circle's dance on clear nights, the bridge at sunrise
//   3. the adventures' states: lanterns (found or built), lost (arrive), bridge (the melody), riddle, hat (three catches)
//   4. the save: meta.fairy read back as written; an odd record reads as new; rewards once per place
//   bash test/wt_run.sh fairy.js 300
require('./load_shared.js');
require('../src/main/i18n.js');
require('../src/main/lang_en.js');
require('../src/main/lang_de.js');
require('../src/main/fairy.js');
const F = VR.Fairy;
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };

// ---------------------------------------------------------------- 1. the places
check(!!F && typeof F.sites === 'function', 'VR.Fairy.sites exists');
const dims = ['overworld', 'flat', 'drift', 'hollow', 'underforge', 'basalt', 'opal', 'zinn', 'ocker', 'aqua', 'star.7.2'];
let allOk = true, sameOk = true, apartOk = true, ringOk = true;
for (const d of dims) {
  const a = F.sites(12345, d, [10, -20]), b = F.sites(12345, d, [10, -20]);
  if (JSON.stringify(a) !== JSON.stringify(b)) sameOk = false;
  const n = a.length, min = d === 'overworld' ? 5 : 2;
  if (n < min || n > 5) { allOk = false; console.log('    ', d, n); }
  for (let i = 0; i < n; i++) {
    const r = Math.hypot(a[i].x - 10, a[i].z + 20);
    if (r < 70 || r > 240) ringOk = false;
    for (let j = 0; j < i; j++) if (Math.hypot(a[i].x - a[j].x, a[i].z - a[j].z) < 60) apartOk = false;
    if (a[i].id !== d + ':' + a[i].kind) allOk = false;
  }
}
check(sameOk, 'the same seed, world and point give the same places');
check(allOk, 'Herzwelt has all five places, every other world 2–5, ids world:kind');
check(ringOk, 'every place 70–240 m from the first standing point (found by walking)');
check(apartOk, 'the places stand ≥ 60 m apart');
const o1 = F.sites(1, 'overworld', [0, 0]), o2 = F.sites(2, 'overworld', [0, 0]);
check(JSON.stringify(o1.map(s => [s.x, s.z])) !== JSON.stringify(o2.map(s => [s.x, s.z])), 'another seed: other spots');
check(F.sites(1, 'overworld', [0, 0]).map(s => s.kind).sort().join() === 'circle,garden,shroom,spring,tree', 'Herzwelt: wood, spring, tree, circle, garden');
check(F.sites(9, 'underforge', [0, 0]).every(s => s.kind !== 'circle' && s.kind !== 'garden'), 'a world without sky has no stone circle nor sky garden');
// the lanterns: three spots round the tree, 16–40 m out, the same each time
const tree = o1.find(s => s.kind === 'tree'), L1 = F.lanternSpots(1, tree), L2 = F.lanternSpots(1, tree);
check(L1.length === 3 && JSON.stringify(L1) === JSON.stringify(L2) && L1.every(p => { const r = Math.hypot(p[0] - tree.x, p[1] - tree.z); return r >= 16 && r <= 40; }), 'three lost lanterns 16–40 m round the tree, deterministic');
// the wood's mushrooms: deterministic, within 16 m
const sh = o1.find(s => s.kind === 'shroom'), M1 = F.shrooms(1, sh);
check(M1.length >= 10 && M1.every(m => Math.hypot(m.x - sh.x, m.z - sh.z) <= 16 && m.h >= 1.4 && m.h <= 8.5) && JSON.stringify(M1) === JSON.stringify(F.shrooms(1, sh)), 'the wood: ' + M1.length + ' mushrooms, 1.4–8.5 m, within 16 m');

// ---------------------------------------------------------------- 2. the hours (timeOfDay: 0 sunrise · 6000 noon · 12000 sunset · 18000 midnight)
check(F.best('shroom', 12500, true) > 0.8 && F.best('shroom', 6000, true) < 0.3, 'the wood glows at dusk, not at noon');
check(F.best('circle', 18000, true) > 0.8 && F.best('circle', 18000, false) < 0.2 && F.best('circle', 6000, true) < 0.2, 'the circle dances on clear nights only');
check(F.best('garden', 23600, true) > 0.8 && F.best('garden', 300, true) > 0.8 && F.best('garden', 9000, true) < 0.2, 'the cloud bridge at sunrise');
check(F.best('spring', 6000, true) > 0.5 && F.best('tree', 6000, true) > 0.5, 'spring and tree are lovely by day');

// ---------------------------------------------------------------- 3. the adventures
check(F.ADV.tree === 'lanterns' && F.ADV.shroom === 'lost' && F.ADV.garden === 'bridge' && F.ADV.circle === 'riddle' && F.ADV.spring === 'hat', 'one adventure a place');
{ // lanterns: found one by one
  const rec = F.load({}).rec, id = 'overworld:tree';
  const q = F.Q.start(rec, id, 'lanterns', 1);
  check(q && q.s === 1 && rec.q[id] === q, 'lanterns: started');
  check(F.Q.lantern(q, 0) === 'got' && F.Q.lantern(q, 0) === 'had' && F.Q.lantern(q, 2) === 'got', 'lanterns: one by one, none twice');
  check(q.s === 1 && F.Q.lantern(q, 1) === 'all' && q.s === 2, 'lanterns: the third — back to Tüpfel');
  const r = F.Q.finish(rec, id, 'lanterns', 1);
  check(r && q.s === 3 && rec.done.includes(id) && r.coins > 0 && r.page === 'lanterns' && r.set.length > 0, 'lanterns: done, a page, coins, the building set');
  check(F.Q.finish(rec, id, 'lanterns', 1) === null, 'lanterns: the reward once');
  check(F.Q.start(rec, id, 'lanterns', 1) === null, 'a done adventure does not start again');
}
{ // lanterns: the builder's way
  const rec = F.load({}).rec, q = F.Q.start(rec, 'flat:tree', 'lanterns', 1);
  check(F.Q.built(q, 2) === false && q.s === 1 && F.Q.built(q, 3) === true && q.s === 2, 'lanterns: or three lights built by the door');
}
{ // lost: arrives home
  const rec = F.load({}).rec, q = F.Q.start(rec, 'overworld:shroom', 'lost', 1);
  check(q.s === 1 && F.Q.arrive(q) === true && q.s === 2, 'lost: Flöckchen home');
}
{ // bridge: the melody
  const mel = F.Q.melody(7, 'overworld:garden');
  check(mel.length === 4 && mel.every(i => i >= 0 && i < 5) && JSON.stringify(mel) === JSON.stringify(F.Q.melody(7, 'overworld:garden')), 'bridge: a melody of four notes on five stones, deterministic');
  const rec = F.load({}).rec, q = F.Q.start(rec, 'overworld:garden', 'bridge', 7);
  const wrong = (mel[0] + 1) % 5;
  check(F.Q.note(q, mel[0], mel) === 'ok' && F.Q.note(q, wrong === mel[1] ? (wrong + 1) % 5 : wrong, mel) === 'wrong' && q.n === 0, 'bridge: a wrong note starts the tune again');
  let last = ''; for (const i of mel) last = F.Q.note(q, i, mel);
  check(last === 'done' && q.s === 2, 'bridge: the four notes wake it');
}
{ // riddle: three, the right answer moves on, a wrong one stays
  const rec = F.load({}).rec, q = F.Q.start(rec, 'overworld:circle', 'riddle', 3);
  const R = F.Q.riddles(3, 'overworld:circle');
  check(R.length === 3 && R.every(r => r.order.length === 3 && r.order.slice().sort().join() === '0,1,2') && new Set(R.map(r => r.rid)).size === 3, 'riddle: three different riddles, three answers each');
  const right = (k) => R[k].order.indexOf(0), wrong = (k) => (right(k) + 1) % 3;
  check(F.Q.answer(q, wrong(0), R) === 'wrong' && q.n === 0 && F.Q.answer(q, right(0), R) === 'right' && q.n === 1, 'riddle: a wrong answer stays, the right one moves on');
  F.Q.answer(q, right(1), R);
  check(F.Q.answer(q, right(2), R) === 'done' && q.s === 2, 'riddle: three solved');
  const keys = []; for (let i = 0; i < F.RIDDLES; i++) keys.push('g.fairy.rid.' + i + '.q', 'g.fairy.rid.' + i + '.a0', 'g.fairy.rid.' + i + '.a1', 'g.fairy.rid.' + i + '.a2');
  const D = VR.I18N.dict;
  check(F.RIDDLES >= 6 && keys.every(k => D.de[k] && D.en[k]), 'riddle: every riddle in both tables (' + F.RIDDLES + ')');
}
{ // hat: three catches
  const rec = F.load({}).rec, q = F.Q.start(rec, 'overworld:spring', 'hat', 1);
  check(F.Q.tag(q) === 'hop' && F.Q.tag(q) === 'hop' && F.Q.tag(q) === 'done' && q.s === 2, 'hat: caught the third time');
}

// ---------------------------------------------------------------- 4. the save
{
  const meta = {};
  const st = F.load(meta), rec = st.rec;
  rec.o.overworld = [12, -40]; rec.seen['overworld:tree'] = 1; rec.buddy = true;
  F.Q.start(rec, 'overworld:tree', 'lanterns', 1); F.Q.lantern(rec.q['overworld:tree'], 1);
  const back = F.load(JSON.parse(JSON.stringify(meta))).rec;
  check(JSON.stringify(back) === JSON.stringify(rec), 'meta.fairy read back as written');
  check(meta.fairy === rec, 'the record lives in meta.fairy');
  const odd = F.load({ fairy: { v: 1, o: 'x', q: { a: 5, 'overworld:tree': { k: 'nope', s: 9 } }, done: 7, seen: null, pages: [1, 'riddle'] } }).rec;
  check(odd.o && typeof odd.o === 'object' && !Object.keys(odd.q).length && Array.isArray(odd.done) && odd.pages.join() === 'riddle', 'odd parts read as new (the good ones kept)');
  check(F.load({ fairy: 'broken' }).rec.v === 1, 'a broken record reads as new');
  const old = { seed: 5, dim: 'overworld' }; F.load(old);
  check(old.fairy && old.seed === 5 && old.dim === 'overworld', 'an old world: only meta.fairy is added');
}
// the texts: German first, English too
{
  const names = ['g.fairy.place.shroom', 'g.fairy.place.spring', 'g.fairy.place.tree', 'g.fairy.place.circle', 'g.fairy.place.garden'];
  const D = VR.I18N.dict, de = names.map(k => D.de[k]), en = names.map(k => D.en[k]);
  check(de.every((s, i) => s && s !== names[i]) && en.every((s, i) => s && s !== names[i] && s !== de[i]), 'the places\' names: ' + de.join(', ') + ' / ' + en.join(', '));
}
{ // o-wander2: the twist, the seed's walk, the companion light beside you, the tree's berth from towns
  const rec = F.load({}).rec, id = 'overworld:tree', q = F.Q.start(rec, id, 'lanterns', 1);
  check(F.Q.twist(q) === 'idle', 'the twist waits for the main task');
  F.Q.lantern(q, 0); F.Q.lantern(q, 1); F.Q.lantern(q, 2);
  check(F.Q.twist(q) === 'twist' && q.tw === 1 && F.Q.twist(q) === 'still', 'back at the giver: one more thing (the twist)');
  check(F.Q.fetch(q) === 'hop' && F.Q.fetch(q) === 'hop' && F.Q.fetch(q) === 'got' && q.tw === 2 && F.Q.twist(q) === 'ready', 'the glow seed flits ahead twice, the third time caught');
  const r2 = F.load({ fairy: { v: 1, q: { [id]: q } } }).rec;
  check(r2.q[id].tw === 2 && r2.q[id].h === 3, 'the twist survives the save');
  check(F.Q.finish(rec, id, 'lanterns') && q.s === 3, 'home again: done');
  const site = { id, x: 100, z: -50 }; let lo = 1e9, hi = 0, away = true;
  for (let sd = 1; sd < 60; sd++) { const p = F.twistSpot(sd, site), d = Math.hypot(p[0] - 100, p[1] + 50); lo = Math.min(lo, d); hi = Math.max(hi, d); const n = F.hopSpot(sd, id, 0, p, [p[0] - 3, 0, p[1]]); if (!(n[0] > p[0] + 5)) away = false; }
  check(lo >= 110 && hi <= 140, `the seed 110–140 m from the place (${lo.toFixed(0)}–${hi.toFixed(0)}): out, two hops and back ≥ 270 m — with the main task ≥ 2 minutes on foot`);
  check(away, 'each hop away from you');
  const eye = [0, 70, 0]; let minD = 1e9, minA = 1e9;
  for (let k = 0; k < 16; k++) { const yaw = k / 16 * Math.PI * 2, b = F.budPos(eye, yaw), dx = b[0], dy = b[1] - 70, dz = b[2], d = Math.hypot(dx, dy, dz), f = [-Math.sin(yaw), 0, -Math.cos(yaw)], cos = (dx * f[0] + dz * f[2]) / d; minD = Math.min(minD, d); minA = Math.min(minA, Math.acos(cos) * 180 / Math.PI); }
  check(minD >= 1.5 && minA >= 30, `the companion light ${minD.toFixed(2)} m from the eye, ${minA.toFixed(0)}° off the view's centre (≥ 1.5 m, ≥ 30°)`);
  const town = [{ x: 0, z: 0, r: 60 }];
  check(F.clearOf(150, 0, town, F.EXTRA.tree) === true && F.clearOf(120, 0, town, F.EXTRA.tree) === false && F.clearOf(120, 0, town) === true, 'the Slumber Tree keeps 80 m beyond a town\'s footprint (others 40 m)');
  check(Math.abs(F.clearance(150, 0, town) - 90) < 1e-9, 'the clearance: metres beyond the nearest footprint');
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exitCode = fails ? 1 : 0;

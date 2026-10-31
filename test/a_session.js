// a-session's game changes for the adventurer's first minutes (plan docs/superpowers/plans/2026-10-31-a-session.md §2.4):
//  a · Funke's way, hands free: a disturbed outpost is a trip by intent ([V] at its beacon) that walks (Intent.meansFor
//      with walk: a target that asks for a walk is walked up to WALK_FAR, a ship or not); liberate.js's L.siteTarget;
//  b · the outposts are landmarks of the Abenteuer (EventLog.addLandmarks; liberate.js L.siteLandmarks: a disturbed
//      beacon's flicker 14 m, the called one's beam on the horizon, a freed one's 60 m beam);
//  c · the fight is seen: a machine's power-down (milestone, 3) and a calmed stray (social, 3) go into the event log;
//      the freeing's camera is a wow (weight 1); the hooks are in place;
//  d · the Regie's own fill on the way: Funke's scan (a discovery when it finds something) on offer in an Abenteuer
//      world after RULES.scan s, not while a foe is near, not twice within RULES.scanEvery s (RegieActs.offers).
//   bash test/wt_run.sh a_session.js 300
const fs = require('fs'), path = require('path');
const V = require('./load_shared.js');
global.window = global.window || {};
if (!global.window.addEventListener) global.window.addEventListener = () => {};
global.performance = global.performance || { now: () => Date.now() };
const ROOT = path.join(__dirname, '..'), SRC = path.join(ROOT, 'src/main');
for (const f of ['i18n', 'lang_en', 'lang_de', 'eventlog', 'intent', 'regie', 'regie_acts', 'liberate']) { try { require(path.join(SRC, f + '.js')); } catch (e) { console.log('  (load ' + f + ': ' + e.message + ')'); } }
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const I = V.Intent, L = V.Liberate, EL = V.EventLog, RA = V.RegieActs;
// a
check(I.meansFor({ dist: 240, inShip: false, sameWorld: true, ship: true, walk: true }).means === 'walk', 'a target that asks for a walk 240 m away is walked, a ship at hand or not');
check(I.meansFor({ dist: 240, inShip: false, sameWorld: true, ship: true }).means === 'call', '… any other one 240 m away still calls a ship');
check(I.meansFor({ dist: 1800, inShip: false, sameWorld: true, ship: true, walk: true }).means === 'call', '… beyond WALK_FAR the walk gives way to the ship');
const site = { id: 'o1', x: 100, y: 70, z: -50, beacon: [102, 72, -48], known: true, st: 'stoer' };
const tg = typeof L.siteTarget === 'function' ? L.siteTarget(site) : null;
check(!!tg && tg.walk === true && tg.id === 'out:o1' && tg.r >= 30 && tg.pos[1] > 72 && tg.top > tg.base, 'L.siteTarget: a disturbed outpost as a trip target (walk, its beacon, a 30-m+ radius: the walk stops before its guards): ' + JSON.stringify(tg));
check(typeof L.siteTarget === 'function' && L.siteTarget(Object.assign({}, site, { st: 'frei' })) === null && L.siteTarget(Object.assign({}, site, { known: false, beacon: null })) === null, '… not a freed one (that is a pad target already), not one without its beacon');
// b
check(typeof EL.addLandmarks === 'function', 'EventLog.addLandmarks exists');
if (typeof L.siteLandmarks === 'function') {
  const out = [];
  L.siteLandmarks([site, Object.assign({}, site, { id: 'o2', st: 'frei', beacon: [300, 80, 0] }), { id: 'o3', known: false }], null, out);
  check(out.length === 2 && out[0].id === 'outpost' && out[0].top - out[0].base >= 14 && out[1].top - out[1].base >= 50, 'L.siteLandmarks: the known beacons — a disturbed one ≥ 14 m of flicker, a freed one ≥ 50 m of beam: ' + JSON.stringify(out));
  const out2 = []; L.siteLandmarks([site], site, out2, [site.x + 400, 0, site.z]);
  check(out2.length === 1 && out2[0].top - out2[0].base >= 140, 'the called one far away: its tall beam on the horizon (' + (out2[0] && out2[0].top - out2[0].base) + ' m)');
  const out3 = [{ stale: 1 }]; L.siteLandmarks([], null, out3);
  check(out3.length === 0, 'the list is reused (cleared, no new array a sample)');
} else check(false, 'L.siteLandmarks exists');
// c · the hooks
const foes = fs.readFileSync(path.join(SRC, 'foes.js'), 'utf8'), lib = fs.readFileSync(path.join(SRC, 'liberate.js'), 'utf8');
check(/emit\('milestone', 'powerdown', 3/.test(foes) && /emit\('social', 'calmed', 3/.test(foes), 'foes.js: the power-down (milestone, 3) and the calmed stray (social, 3) go into the event log');
check(/emit\('wow', 'freed', 1/.test(lib), 'liberate.js: the freeing\'s camera is a wow (weight 1)');
// d · the Regie's fill
if (RA && RA.offers) {
  const st = { adv: true, enc: 'normal', t0: 0, called: 10, strayed: 0, encounters: 1, site: null, scan: true, foeNear: false, scanT: -1e9 };
  const has = (t, o) => RA.offers(Object.assign({}, st, o || {}), t).some(q => q.act === 'scan');
  check(!has(RA.RULES.scan - 1) && has(RA.RULES.scan + 1), `Funke's scan on offer after ${RA.RULES.scan} s in an Abenteuer world`);
  check(!has(200, { foeNear: true }) && !has(200, { scanT: 200 - RA.RULES.scanEvery + 5 }) && has(200, { scanT: 200 - RA.RULES.scanEvery - 5 }), `… not with a foe near, not twice within ${RA.RULES.scanEvery} s`);
  check(!has(200, { adv: false }) && !has(200, { guest: true }), '… only in an Abenteuer world, never for a guest');
  const o = RA.offers(st, 200).find(q => q.act === 'scan');
  check(!!o && o.weight === 2 && o.kind === 'discovery' && !o.first, 'its offer: weight 2, a discovery, taken in a gap (not first)');
}
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);

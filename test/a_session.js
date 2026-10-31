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
for (const f of ['i18n', 'lang_en', 'lang_de', 'eventlog', 'intent', 'regie', 'regie_acts', 'foes', 'liberate', 'input']) { try { require(path.join(SRC, f + '.js')); } catch (e) { console.log('  (load ' + f + ': ' + e.message + ')'); } }
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
check(typeof L.siteTarget === 'function' && L.siteTarget(Object.assign({}, site, { st: 'frei' })) === null, '… not a freed one (that is a pad target already)');
{ const far = typeof L.siteTarget === 'function' ? L.siteTarget(Object.assign({}, site, { known: false, beacon: null })) : null; check(!!far && far.pos[0] === 100.5 && far.pos[1] > 70 && far.walk, '… one far off, its beacon not loaded yet: its middle (' + JSON.stringify(far && far.pos) + ')'); }
// b
check(typeof EL.addLandmarks === 'function', 'EventLog.addLandmarks exists');
if (typeof L.siteLandmarks === 'function') {
  const out = [];
  L.siteLandmarks([site, Object.assign({}, site, { id: 'o2', st: 'frei', beacon: [300, 80, 0] }), { id: 'o3', known: false }], null, out);
  check(out.length === 2 && out[0].id === 'outpost' && out[0].top - out[0].base >= 14 && out[1].top - out[1].base >= 50, 'L.siteLandmarks: the known beacons — a disturbed one ≥ 14 m of flicker, a freed one ≥ 50 m of beam: ' + JSON.stringify(out));
  const out2 = []; L.siteLandmarks([site], site, out2, [site.x + 400, 0, site.z]);
  check(out2.length === 1 && out2[0].top - out2[0].base >= 140, 'the called one far away: its tall beam on the horizon (' + (out2[0] && out2[0].top - out2[0].base) + ' m)');
  const farSite = { id: 'o4', x: 500, y: 75, z: 0, known: false, st: 'stoer' }, out4 = []; L.siteLandmarks([farSite], farSite, out4, [100, 0, 0]);
  check(out4.length === 1 && out4[0].x === 500.5 && out4[0].top - out4[0].base >= 140, 'the called one before its beacon is loaded: its beam from its middle (' + JSON.stringify(out4[0]) + ')');
  const out5 = []; L.siteLandmarks([farSite], farSite, out5, [100, 0, 0], true);
  check(out5.length === 1 && out5[0].top - out5[0].base < 20, '… on Very Low (no far beam drawn) only its short flicker');
  check(out[0].r <= 2, 'standing at the beacon its beam still counts (r ' + out[0].r + ' ≤ 2)');
  const out3 = [{ stale: 1 }]; L.siteLandmarks([], null, out3);
  check(out3.length === 0, 'the list is reused (cleared, no new array a sample)');
} else check(false, 'L.siteLandmarks exists');
// c · the hooks
const foes = fs.readFileSync(path.join(SRC, 'foes.js'), 'utf8'), lib = fs.readFileSync(path.join(SRC, 'liberate.js'), 'utf8');
check(/emit\('milestone', 'powerdown', 3/.test(foes) && /emit\('social', 'calmed', w,/.test(foes), 'foes.js: the power-down (milestone, 3) and the calmed stray (social, 3) go into the event log');
check(/emit\('wow', 'freed', 1/.test(lib), 'liberate.js: the freeing\'s camera is a wow (weight 1)');
check(/VR\.Funke\.foeOf\(g\)\) return;/.test(fs.readFileSync(path.join(SRC, 'regie_acts.js'), 'utf8')), 'regie_acts.js: the outpost\'s first sight is not told in the middle of its fight');
// c2 · one moment, one weight: a codex toast within 2 s of a weighted moment rides it (weight 1); the guards calmed one
// after another — the first weighs 3, the others of the run (10 s) 1
{
  const g = { state: 'play', time: 100, world: {}, player: { pos: [0, 64, 0] } }; V.game = g; EL.on = true;
  const w = (r) => r ? r.w : -1;
  const a1 = EL.emit('travel', 'takeoff', 2, null, 'intent');
  const a2 = EL.found('m:ship');
  g.time = 110; const a3 = EL.found('b:sky_meadow');
  g.time = 110.5; const a4 = EL.found('m:torch');
  g.time = 111; const a5 = EL.found('w:falls');
  check(w(a1) === 2 && w(a2) === 1 && w(a3) === 2 && w(a4) === 1 && w(a5) === 4, `codex: the ship's milestone at the takeoff ${w(a2)} (1), alone ${w(a3)} (2), a second at once ${w(a4)} (1), a wonder's banner ${w(a5)} (4)`);
  if (V.Foes && V.Foes.calmMob) {
    const Fo = V.Foes, seen = []; const em = EL.emit; EL.emit = (k, sub, ww) => { if (sub === 'calmed') seen.push(ww); return null; };
    const sav = Fo.calm; Fo.calm = () => true; const mk = () => ({ pos: [3, 64, 3], foe: { k: 'sentry', st: 'patrol' } });
    g.time = 200; Fo.calmMob(g, mk()); g.time = 203; Fo.calmMob(g, mk()); g.time = 230; Fo.calmMob(g, mk());
    Fo.calm = sav; EL.emit = em;
    check(seen.join(',') === '3,1,3', 'calmed: a run of two (3 s apart) weighs 3, 1; one 27 s later 3 again (' + seen.join(',') + ')');
  } else console.log('  (foes.js not loaded: the calm run checked by its hook only)');
  check(/F\.CALM_RUN = 10/.test(foes) && /F\.calmT = t/.test(foes), 'foes.js: the calm run (10 s)');
}
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
// e · a-story5 (R55-16): the adventurer's melee at the outpost. The reach and the hit box at the eye's height are
// fine (the ray from 1.62 m at the walker's aim enters every stray's box within entities.js's 4.2 m); the click was
// the fault — headless Chromium has no pointer lock, the game falls back to drag-look, where a click counts on its
// release (Input.clickAction), and the walker set only mouse.clicked: 0 hits in 2 min. A real player's click is a
// press and a release; the walker now clicks like one.
{
  const PH = V.PHYS;
  for (const k of ['driller', 'sentry', 'drone', 'wisp']) {
    const K = V.Foes && V.Foes.KINDS[k]; if (!K || !PH || !PH.rayBox) { check(false, 'Foes.KINDS / PH.rayBox loaded'); break; }
    let worst = 0;
    for (const d of [2.4, 3.0, 3.6]) {
      const fy = K.fly ? 3 : 0, eye = [0, 1.62, 0], c = [0, fy + K.h * 0.55, -d], v = [c[0] - eye[0], c[1] - eye[1], c[2] - eye[2]], l = Math.hypot(v[0], v[1], v[2]);
      const r = PH.rayBox(eye[0], eye[1], eye[2], v[0] / l, v[1] / l, v[2] / l, [-K.w, 0, -K.w, K.w, K.h, K.w], c[0], fy, c[2]);
      worst = Math.max(worst, r ? r[0] : 99);
    }
    check(worst < 4.2, `${k}: the walker's aim from the eye (1.62 m) at 2.4–3.6 m enters its box within the 4.2 m reach (worst ${worst.toFixed(2)} m)`);
  }
  const ca = V.Input && V.Input.prototype.clickAction;
  const inp = (rel) => ({ dragLook: true, dragStart: null, mouse: { clicked: [true, false, false], releasedBtn: [rel, false, false] } });
  check(!!ca && !ca.call(inp(false), 0) && ca.call(inp(true), 0), 'drag-look (no pointer lock, as headless): a click counts on its release — mouse.clicked alone is no click (the R55-16 walker)');
  const ses = fs.readFileSync(path.join(ROOT, 'test', 'session.mjs'), 'utf8'), fight = ses.slice(ses.indexOf("if (A.ph === 'fight')"), ses.indexOf('// calm: close, face it'));
  check(/releasedBtn\[0\] = true/.test(fight) && /clicked\[0\] = true/.test(fight), "session.mjs's walker clicks like a player in the fight: a press and a release");
}
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);

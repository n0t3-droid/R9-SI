// f-first2 · the v0.53 review's top five without a browser (plan docs/superpowers/plans/2026-10-30-f-first2.md):
//   a · the held block ≤ 3 % of a 16:9 frame (before > 4 %), still seen (≥ 1 %), lower than before; hidden in cinematic scenes
//   b · open ground: a spawn in a walled nook facing a bench moves to the nearest place whose way ahead is free (one-block
//       steps taken), an open spawn stays
//   c · the Abenteuer start: the starter bag (no stack of 64, the sword first), the pointer's text
//   d · the trips' ends: the swarm's 800 m off a rock on its sunlit side, the nose on it; the ring's entry on the day side
//   e · ⚙ Einfach: three sliders; Helligkeit 100 % costs nothing (no filter); the texts in both tables
// Run: bash test/wt_run.sh first2.js 300
require('./dom_stub.js');
const V = require('./load_shared.js');
globalThis.VR = V;
for (const f of ['bodytex', 'i18n', 'lang_en', 'lang_de']) require(__dirname + '/../src/' + (f === 'bodytex' ? 'shared/' : 'main/') + f + '.js');
require('../src/main/cruise.js');
require('../src/main/fields.js');
require('../src/main/fields2.js');
require('../src/main/first2.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const F = V.First2, F2 = V.Fields2, C = V.Cruise, S = V.Universe.home;
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a) => { const l = len(a); return [a[0] / l, a[1] / l, a[2] / l]; };
const pc = (x) => (x * 100).toFixed(2) + ' %';
if (!F || !F.handCover) { console.log('  ✗ VR.First2 missing\nFAILED 1'); process.exit(1); }

console.log('a · the held block');
{
  const old = F.handCover(F.HAND_OLD, 16 / 9), now = F.handCover(F.HAND, 16 / 9), now43 = F.handCover(F.HAND, 4 / 3);
  check(old > 0.04, 'before: the block covered ' + pc(old) + ' of the frame (> 4 %: the review\'s pink cube)');
  check(now <= 0.03 && now43 <= 0.03, 'now: ' + pc(now) + ' at 16:9, ' + pc(now43) + ' at 4:3 (≤ 3 %)');
  check(now >= 0.01, 'still seen: ' + pc(now) + ' (≥ 1 %)');
  const fy = F.fistRest()[1];
  check(fy + F.HAND.off[1] < fy + F.HAND_OLD.off[1], 'lower in the corner than before');
  const g = { player: {}, ui: {} };
  check(!F.cine(g), 'walking: the hand shows');
  check(F.cine({ photo: true }) && F.cine({ photoCam: { on: true } }), 'photo mode hides it');
  check(F.cine({ arrival: { holds: () => true } }) && !F.cine({ arrival: { holds: () => false } }), 'the arrival\'s veil hides it, its end shows it');
  V.Liberate = { mcam: {} }; check(F.cine(g), 'the freeing moment hides it'); V.Liberate = { moment: { t: 1 } }; check(F.cine(g), '…the moment itself too'); V.Liberate = null;
  V.RPGBoss = { cur: { b: { st: 'intro' } } }; check(F.cine(g), 'the boss\'s entrance hides it'); V.RPGBoss.cur.b.st = 'fight'; check(!F.cine(g), 'the fight shows it'); V.RPGBoss = null;
  check(F.cine({ director: { active: true } }) && F.cine({ wow: { active: true } }), 'the director\'s and the wow moment\'s cameras hide it');
}

console.log('b · open ground');
{
  // a meadow at y 64 (ground blocks y ≤ 63); the nook: a 2-high parapet round x, z ∈ [−3, 3], a 2-high bench at z −2
  const set = new Set(), k = (x, y, z) => x + ',' + y + ',' + z;
  const put = (x, y, z) => set.add(k(x, y, z));
  const solid = (x, y, z) => y <= 63 || set.has(k(x, y, z));
  for (let i = -3; i <= 3; i++) for (const y of [64, 65]) { put(i, y, -3); put(i, y, 3); put(-3, y, i); put(3, y, i); }
  for (let x = -1; x <= 1; x++) { put(x, 64, -2); put(x, 65, -2); }
  const yaw = 0;   // forward −z: the bench, then the parapet
  check(F.wayLen(solid, 0.5, 0.5, 64, yaw) < 2, 'the nook: the way ahead ends at the bench (' + F.wayLen(solid, 0.5, 0.5, 64, yaw) + ' m)');
  const r = F.openGround(solid, [0.5, 64, 0.5], yaw);
  check(!!r && r.way >= F.WAY, 'moved to open ground: ' + JSON.stringify(r));
  check(!!r && r.r <= F.SEARCH && r.pos[1] === 64 && !solid(Math.floor(r.pos[0]), r.pos[1], Math.floor(r.pos[2])) && solid(Math.floor(r.pos[0]), r.pos[1] - 1, Math.floor(r.pos[2])), 'it stands on the meadow (not on the bench or the parapet), within ' + F.SEARCH + ' m');
  // one-block steps on the way: taken (auto step-up), a 2-block wall is not
  const set2 = new Set(); const solid2 = (x, y, z) => y <= 63 || set2.has(k(x, y, z));
  for (let x = -2; x <= 2; x++) { set2.add(k(x, 64, -3)); set2.add(k(x, 64, -4)); }
  check(F.wayLen(solid2, 0.5, 0.5, 64, 0) >= F.WAY, 'a one-block step (+ the step back down) on the way: walked over (' + F.wayLen(solid2, 0.5, 0.5, 64, 0) + ' m)');
  const set3 = new Set(); const solid3 = (x, y, z) => y <= 63 || set3.has(k(x, y, z));
  for (let x = -2; x <= 2; x++) { set3.add(k(x, 64, -4)); set3.add(k(x, 65, -4)); }
  check(F.wayLen(solid3, 0.5, 0.5, 64, 0) === 3, 'a two-block wall stops the way (' + F.wayLen(solid3, 0.5, 0.5, 64, 0) + ' m)');
  check(F.openGround((x, y) => y <= 63, [0.5, 64, 0.5], 1.3) === null, 'an open spawn stays where it is');
  // the real vista spur (gen_vista.js, seed 4242): ONE block of wall (stone_brick_wall, 1.5 high to collide) — no step
  const wall1 = (x, y, z) => y <= 63 || (y === 64 && z === -6 && Math.abs(x) <= 3) || (y === 64 && Math.abs(x) === 3 && z <= 0 && z >= -6);
  const tall1 = (x, y, z) => y === 64 && ((z === -6 && Math.abs(x) <= 3) || (Math.abs(x) === 3 && z <= 0 && z >= -6));
  const sT = F.solidTall(wall1, tall1);
  check(F.wayLen(wall1, 0.5, 0.5, 64, 0) === F.WAY && F.wayLen(sT, 0.5, 0.5, 64, 0) === 5, 'a one-block wall (1.5 high) is no step: the way ends at it (' + F.wayLen(sT, 0.5, 0.5, 64, 0) + ' m; read as a step: ' + F.wayLen(wall1, 0.5, 0.5, 64, 0) + ')');
  const r2 = F.openGround(sT, [0.5, 64, 0.5], 0);
  check(!!r2 && F.wayLen(sT, r2.pos[0], r2.pos[2], r2.pos[1], r2.yaw === undefined ? 0 : r2.yaw) >= F.WAY, 'the spur: a place with ' + F.WAY + ' m of free way found (' + JSON.stringify(r2) + ')');
  // a ridge 11 wide (cliffs ahead and behind): nothing ahead within reach → the nearest place with a free way, turned to it (along the ridge)
  const cliff = (x, y, z) => (z > -6 && z < 6 ? y <= 63 : y <= 40);
  const r3 = F.openGround(cliff, [0.5, 64, 0.5], 0);
  check(!!r3 && Number.isFinite(r3.yaw) && Math.abs(Math.abs(r3.yaw) - Math.PI / 2) < 1e-9 && F.wayLen(cliff, r3.pos[0], r3.pos[2], r3.pos[1], r3.yaw) >= F.WAY, 'a cliff ahead: turned 90° along the ridge (' + (r3 ? JSON.stringify(r3) : 'none') + ')');
}

  // settle on a game: a new world (no player record when it opened) still moves after an autosave wrote one
  { const R = V.R, st = R.byName.stone.defaultState, wl = R.byName.stone_brick_wall.defaultState;
    const w = { getBlock: (x, y, z) => (y <= 63 ? st : (y === 64 && (z === -6 && Math.abs(x) <= 3 || Math.abs(x) === 3 && z <= 0 && z >= -6)) ? wl : 0) };
    const pl = { pos: [0.5, 64, 0.5], yaw: 0, teleport(x, y, z) { this.pos = [x, y, z]; } };
    const g = { meta: { player: { pos: [0, 0, 0] } }, f2new: true, world: w, player: pl };
    const r = F.settle(g), g2 = { meta: { player: {} }, f2new: false, world: w, player: { pos: [0.5, 64, 0.5], yaw: 0, teleport() { throw 1; } } };
    check(!!r && pl.pos[0] !== 0.5 && F.settle(g2) === null, 'settle: a new world moves even with an autosaved player record (' + JSON.stringify(pl.pos) + '); a reopened world stays'); }
console.log('c · the Abenteuer start');
{
  const known = (id) => !!((V.R && V.R.byName && V.R.byName[id]) || (V.ITEMS && V.ITEMS[id]));
  const all = F.ADV_KIT.concat(F.ADV_EXTRA), miss = all.filter(([id]) => !known(id));
  check(!miss.length, 'the starter bag\'s things exist (' + all.length + ')' + (miss.length ? ': missing ' + miss.map(m => m[0]).join(', ') : ''));
  check(all.every(([, n]) => n < 64) && /sword/.test(F.ADV_KIT[0][0]), 'no creative stack of 64; the sword first (' + F.ADV_KIT.map(([id, n]) => id + '×' + n).join(' ') + ')');
  V.I18N.lang = 'de';
  const t = F.pointText([0, 64, 0], 0, [0, 64, -240]), t2 = F.pointText([0, 64, 0], 0, [240, 64, 0]);
  check(/Außenposten 240 m ↑$/.test(t) && /→$/.test(t2), 'the pointer: „' + t + '" · „' + t2 + '"');
}

console.log('d · the trips\' ends');
{
  const t = 0, c = C.fly('herz', 'swarm', t, { max: 900 });
  const sw = S.state(c.end.t).b.swarm, h = S.pos('helia', c.end.t, new Float64Array(3));
  const rel = [c.end.r[0] + sw.r[0], c.end.r[1] + sw.r[1], c.end.r[2] + sw.r[2]];
  const rocks = V.Rubble.swarm().bodies.map(b => { const q = F2.rockPos(b.k, c.end.t); return { k: b.k, D: b.D, q: [q[0] - h[0], q[1] - h[1], q[2] - h[2]] }; });
  const e = F.swarmEnd(rel, rocks), rk = rocks.find(b => b.k === e.k), off = [e.r[0] - rk.q[0], e.r[1] - rk.q[1], e.r[2] - rk.q[2]];
  const gap = len(off) - rk.D / 2, lit = dot(unit(off), unit(rk.q.map(x => -x))), aim = dot(e.nose, unit(off.map(x => -x)));
  let before = Infinity; for (const b of rocks) before = Math.min(before, len([b.q[0] - rel[0], b.q[1] - rel[1], b.q[2] - rel[2]]) - b.D / 2);
  check(Math.abs(gap - F.SWARM_GAP) < 1, 'the swarm: the trip ends ' + gap.toFixed(0) + ' m off rock ' + e.k + ' (D ' + rk.D.toFixed(0) + ' m; before: the nearest ' + (before / 1000).toFixed(1) + ' km away)');
  check(lit > 0.7 && aim > 0.999, 'on its sunlit side (cos ' + lit.toFixed(2) + '), the nose on it (cos ' + aim.toFixed(4) + ')');
  // the ring's entry: its end on the day side, out of the giant's shadow
  const st = S.state(t), A = S.body('amarant'), q = st.b.amarant.r, n = F2.axis(), side = unit([n[1], -n[0], 0]);
  const toDisc = unit([-side[0], -side[1], -side[2]]);
  const cr = C.create([q[0] + side[0] * 8 * A.R, q[1] + side[1] * 8 * A.R, q[2] + side[2] * 8 * A.R], Array.from(st.b.amarant.v), 'herz', 'amarant', t, toDisc.map(x => -x));
  cr.goal = 'ring'; let n2 = 0; while (cr.phase !== 'done' && n2++ < 9000) C.step(cr, 1 / 30);
  const er = cr.end && cr.end.r, qa = S.pos('amarant', cr.end.t, new Float64Array(3)), hs = S.state(cr.end.t).b.helia.r;
  const sd = unit([hs[0] - qa[0], hs[1] - qa[1], hs[2] - qa[2]]), cs = dot(unit(er), sd), hh = dot(er, n), rho = Math.sqrt(dot(er, er) - hh * hh) / A.R;
  check(cr.phase === 'done' && cs > 0.3 && Math.abs(rho - 1.70) < 0.002 && Math.abs(hh) < 1, 'the ring: the entry ends on the day side (' + (Math.acos(cs) * 180 / Math.PI).toFixed(0) + '° from the subsolar point), in the sheet at ' + rho.toFixed(3) + ' R');
}

console.log('e · ⚙ Einfach, the texts');
{
  check(F.SIMPLE.length === 3 && F.GFX.length === 5 && F.gfxIndex('potato') === 0 && F.gfxIndex('ultra') === 4 && F.gfxIndex('ultraLite') === 3, 'Einfach: three sliders (Grafik 5 steps, Helligkeit, UI-Größe)');
  check(F.brightCss(1) === '' && F.brightCss(undefined) === '' && F.brightCss(1.2) === 'brightness(1.20)', 'Helligkeit 100 %: no filter (Very Low unchanged); 120 %: a CSS filter');
  const D = V.I18N.dict; let missing = 0; for (const kk of F.KEYS) if (!(D.de && D.de[kk]) || !(D.en && D.en[kk])) missing++;
  check(missing === 0, 'every f-first2 text in both tables (' + F.KEYS.length + ')');
}

console.log('f · W on a slow machine: the player keeps the wall clock (≤ 1 s a frame) and a tap between two frames counts');
{
  check(F.catchSteps && F.catchSteps(0.016, 0.016).length === 0 && F.catchSteps(0.1, 0.1).length === 0, 'a fast frame: no extra step (Very Low unchanged)');
  const s6 = F.catchSteps(6, 0.1), sum = s6.reduce((a, b) => a + b, 0.1);
  check(s6.length === 9 && Math.abs(sum - F.CATCH_MAX) < 1e-9 && s6.every((x) => x <= 0.1 + 1e-9), 'a 6-s frame: ' + s6.length + ' extra steps, ' + sum.toFixed(2) + ' s of walking (before 0.10)');
  check(F.catchSteps(30, 0.1).length === 0, 'a stall over ' + F.CATCH_GAP + ' s (a pause, a load) is not walked');
  // a fake player and input: the extra steps see no mouse look, no click, no key press twice
  const inp = { keys: new Set(), pressed: new Set(['KeyW']), doubleTap: new Set(), mouse: { dx: 30, dy: 4, wheel: 0, clicked: [true, false, false] } };
  const seen = [];
  const pl = { game: { f2gap: 0.35 }, update(dt, I) { seen.push({ dt, w: I.keys.has('KeyW'), dx: I.mouse.dx, hit: I.pressed.size, clk: I.mouse.clicked[0] }); } };
  F.stepPlayer(pl, pl.update, 0.1, inp);
  const ex = seen.slice(1);
  check(seen.length === 4 && seen[0].dx === 30 && seen[0].hit === 1 && seen[0].clk, 'the frame\'s own step reads the mouse, the press and the click (' + seen.length + ' steps)');
  check(ex.every((e) => e.dx === 0 && e.hit === 0 && !e.clk && e.w), 'the extra steps: no look, no press, no click — W still held');
  check(inp.mouse.dx === 30 && inp.pressed.has('KeyW') && inp.mouse.clicked[0] && !inp.keys.has('KeyW'), 'the input given back as it was (W tapped and let go between the frames: not held after)');
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');

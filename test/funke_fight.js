// Funke in a fight (a-session; plan docs/superpowers/plans/2026-10-31-a-session.md §2.2, f-hud's self-review 2): while
// a machine is engaged near the player, Funke keeps to the shoulder away from it — out of the view — and its bubble
// keeps out of the machine's screen box. The pure parts of src/main/funke.js:
//  a · F.fightSide: the foe right of the view → Funke's side is the left (−1), and the other way round;
//  b · F.fightAnchor: the place on that shoulder, a little behind the eye — outside a 90° view cone, ≥ 0.6 m from the eye;
//  c · F.bubbleAway: a bubble over the machine's box moves off it (above, below or beside it), stays on the screen; one
//      that does not touch the box stays where it was;
//  d · F.engaged: which foe counts (engaged within 22 m, or any awake one within 12 m ahead; never a calmed, downed or
//      leaving one, nor a Helfer).
//   bash test/wt_run.sh funke_fight.js 300
const path = require('path');
const V = require('./load_shared.js');
global.window = global.window || {};
if (!global.window.addEventListener) global.window.addEventListener = () => {};
global.performance = global.performance || { now: () => Date.now() };
const SRC = path.join(__dirname, '..', 'src/main');
for (const f of ['i18n', 'lang_en', 'lang_de', 'eventlog', 'funke']) require(path.join(SRC, f + '.js'));
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const F = V.Funke;
check(typeof F.fightSide === 'function' && typeof F.fightAnchor === 'function' && typeof F.bubbleAway === 'function' && typeof F.engaged === 'function', 'F.fightSide, F.fightAnchor, F.bubbleAway, F.engaged exist');
if (typeof F.fightSide === 'function') {
  // a · yaw 0 looks along −z; right is +x
  const P = [0, 64, 0];
  check(F.fightSide(P, 0, [3, 64, -6]) === -1, 'a foe ahead to the right → Funke on the left shoulder');
  check(F.fightSide(P, 0, [-3, 64, -6]) === 1, 'a foe ahead to the left → Funke on the right shoulder');
  check(F.fightSide(P, Math.PI / 2, [-6, 64, -3]) === -1, 'turned a quarter (looking along −x): a foe toward −z is on the right → left shoulder');
  // b · the anchor out of the view
  let worst = 1, near = 9;
  for (let k = 0; k < 16; k++) {
    const yaw = k * Math.PI / 8, A = [0, 0, 0];
    for (const side of [-1, 1]) {
      F.fightAnchor(P, yaw, side, 0, A);
      const e = [P[0], P[1] + 1.62, P[2]], dx = A[0] - e[0], dy = A[1] - e[1], dz = A[2] - e[2], d = Math.hypot(dx, dy, dz);
      const fwd = (dx * -Math.sin(yaw) + dz * -Math.cos(yaw)) / d;
      worst = Math.min(worst, 1 - fwd); near = Math.min(near, d);
      const right = dx * Math.cos(yaw) + dz * -Math.sin(yaw);
      if (Math.sign(right) !== side) worst = -1;
    }
  }
  check(worst >= 1 - Math.cos(Math.PI / 4) && near >= 0.6, `the fight anchor: on the asked side, outside a 90° view cone (cos to the view ≤ ${(1 - worst).toFixed(2)}), ${near.toFixed(2)} m from the eye (≥ 0.6)`);
  // c · the bubble off the machine
  const W = 1280, H = 720, box = [560, 250, 720, 520];
  const ov = (x, y, w, h, b) => Math.max(0, Math.min(x + w, b[2]) - Math.max(x, b[0])) * Math.max(0, Math.min(y + h, b[3]) - Math.max(y, b[1]));
  let bad = 0, n = 0;
  for (let x = 10; x < W - 250; x += 60) for (let y = 10; y < H - 150; y += 40) {
    const r = F.bubbleAway(x, y, 240, 54, W, H, box); n++;
    if (ov(r[0], r[1], 240, 54, box) > 0 || r[0] < 0 || r[1] < 0 || r[0] + 240 > W || r[1] + 54 > H) bad++;
    if (ov(x, y, 240, 54, box) === 0 && (r[0] !== x || r[1] !== y)) bad++;
  }
  check(bad === 0, `the bubble at ${n} places: none over the machine's box after F.bubbleAway, all on the screen, the clear ones unmoved (${bad} bad)`);
  const big = F.bubbleAway(600, 300, 240, 54, W, H, [0, 0, W, H]);
  check(Array.isArray(big) && big.length === 2, 'a machine filling the screen: the bubble keeps its place (nothing to move to): ' + JSON.stringify(big));
  // d · which foe counts
  const mob = (k, st, x, z, o) => ({ pos: [x, 64, z], foe: Object.assign({ k, st, gone: false }, o || {}) });
  const list = [mob('sentry', 'patrol', 0, -30), mob('driller', 'calm', 0, -3), mob('sentry', 'down', 0, -4), mob('driller', 'approach', 6, -15), mob('crane', 'patrol', 0, 6), mob('sentry', 'patrol', 1, -9, { helper: true })];
  const e = F.engaged(list, P, 0);
  check(e === list[3], 'engaged: the approaching driller 16 m away (not the calmed, downed one, the Helfer, nor the patrol 30 m off or behind): ' + (e ? e.foe.k + '/' + e.foe.st : 'none'));
  check(F.engaged([mob('sentry', 'patrol', 0, -10)], P, 0) !== null && F.engaged([mob('sentry', 'patrol', 0, 10)], P, 0) === null, 'an awake one 10 m ahead counts, one 10 m behind does not');
  check(F.engaged([mob('drone', 'strike', 0, -30)], P, 0) === null, 'nothing beyond 22 m');
}
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);

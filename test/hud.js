// f-hud · the adventurer's first ten minutes without a browser (plan docs/superpowers/plans/2026-10-31-f-hud.md):
//   a · a new world starts with the HUD up: F1's hidden HUD and a story scene's body.storyon do not carry over
//   b · Funke is never drawn in the camera's face (≤ NEAR m) nor in a camera of a cinematic (wow, director)
//   c · the spawn's settle move happens under the arrival's white, not after it
//   d · the hit feedback: the shake (off by default, bounded, gone after its time; untouched camera when off),
//       the clank's pitch varies, the machine's recoil and push (none for the fixed crane), the sparks' count by preset
//   e · Funke's „what now" after each step (machines left, the outpost freed → the next one, none left)
//   f · the texts in both tables
// Run: bash test/wt_run.sh hud.js 300
require('./dom_stub.js');
const V = require('./load_shared.js');
globalThis.VR = V;
for (const f of ['i18n', 'lang_en', 'lang_de']) require(__dirname + '/../src/main/' + f + '.js');
require('../src/main/settings_reg.js');
require('../src/main/first.js');
require('../src/main/funke.js');
require('../src/main/first2.js');
require('../src/main/hitfeel.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const H = V.HitFeel, F2 = V.First2, FK = V.Funke;
if (!H || !H.fresh) { console.log('  ✗ VR.HitFeel missing\nFAILED 1'); process.exit(1); }

console.log('a · a new world: the HUD up');
{
  const hud = { style: { visibility: 'hidden', opacity: '0' } }, cls = new Set(['storyon']);
  const doc = { getElementById: (id) => (id === 'hud' ? hud : null), body: { classList: { remove: (c) => cls.delete(c), contains: (c) => cls.has(c) } } };
  const g = { hideHud: true };
  H.fresh(g, doc);
  check(g.hideHud === false, 'F1\'s hidden HUD of the last world is let go (hideHud ' + g.hideHud + ')');
  check(hud.style.visibility === 'visible', 'the HUD element visible again');
  check(!cls.has('storyon'), 'a story scene\'s body.storyon is gone');
}

console.log('b · Funke not in the face');
{
  check(FK && FK.camNear && FK.camNear(0.3, 0, 0.2) && !FK.camNear(0.78, -0.1, 0.3) && !FK.camNear(1.4, 0, 0.6), 'closer than ' + (FK && FK.NEAR) + ' m to the camera: not drawn; at the shoulder (0.85 m) and peeking (1.5 m): drawn');
  check(FK && FK.camHidden && FK.camHidden({ wow: { active: {} } }) && FK.camHidden({ director: { active: true } }) && FK.camHidden({ arrival: { holds: () => false, phase: 'moment' } }) && !FK.camHidden({}), 'a wow moment\'s, the director\'s camera and the arrival\'s moment: Funke out of the picture; walking: in');
}

console.log('c · the settle under the veil');
{
  const A = (phase, v) => ({ phase, veilNow: () => v, holds: () => phase !== 'moment' && phase !== 'done' });
  check(F2.underVeil({ arrival: A('full', 1) }), 'the white full: under the veil');
  check(F2.underVeil({ arrival: A('veil', 0.9) }), 'the veil still thick (0.9): under the veil');
  check(!F2.underVeil({ arrival: A('veil', 0.2) }), 'the veil thin (0.2): not');
  check(F2.underVeil({ arrival: A('moment', 0), wow: { active: {}, t: 2 } }) === true, 'the wow moment holds the composition (the eyes not shown): under it');
  check(!F2.underVeil({}), 'no arrival: not');
}

console.log('d · the hit feedback');
{
  const it = V.Settings.byKey('hitShake');
  check(it && it.def === false && it.t === 'switch', 'the switch „Bildschirmwackeln" exists, default off');
  let mx = 0; for (let t = 0; t <= H.SHAKE_T; t += 0.01) { const o = H.shakeAt(t, 1, 7); mx = Math.max(mx, Math.abs(o.x), Math.abs(o.y), Math.abs(o.r) / 4); }
  const end = H.shakeAt(H.SHAKE_T + 0.01, 1, 7);
  check(mx > 0.005 && mx <= H.SHAKE_M + 1e-9, 'the shake: small (max ' + mx.toFixed(3) + ' m ≤ ' + H.SHAKE_M + ')');
  check(end.x === 0 && end.y === 0 && end.r === 0, 'gone after ' + H.SHAKE_T + ' s');
  const cam = { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, roll: 0 }, g = { settings: { hitShake: false }, hf: { shake: 0.1, amp: 1 } };
  H.cam(g, cam, 0.016); check(cam.x === 1 && cam.y === 2 && cam.roll === 0, 'off: the camera untouched');
  g.settings.hitShake = true; g.hf.shake = 0.1; H.cam(g, cam, 0.016); check(cam.x !== 1 || cam.y !== 2, 'on: the camera jolts');
  const fx = { x: 1, y: 2, z: 3, roll: 0, fixed: true }; g.hf.shake = 0.1; H.cam(g, fx, 0.016); check(fx.x === 1 && fx.y === 2, 'a cinematic camera (fixed) never shakes');
  const ps = []; for (let i = 0; i < 12; i++) ps.push(H.pitch(i));
  check(ps.every(p => p >= 0.8 && p <= 1.25) && ps.every((p, i) => !i || p !== ps[i - 1]) && new Set(ps.map(p => p.toFixed(3))).size >= 5, 'the clank\'s pitch varies: ' + ps.slice(0, 6).map(p => p.toFixed(2)).join(' · '));
  check(H.recoil(0) === 0 && H.recoil(0.25) === 0 && H.recoil(0.18) > 0.05 && H.recoil(0.18) <= 0.22, 'the machine\'s recoil: a tilt back (' + H.recoil(0.18).toFixed(3) + ' rad) that settles');
  const kd = H.knock([0, 0, 0], [3, 0, 4], 'driller'), kc = H.knock([0, 0, 0], [3, 0, 4], 'crane');
  check(Math.hypot(kd[0], kd[2]) > 1 && Math.hypot(kd[0], kd[2]) <= 3.01 && kd[0] < 0 && kd[2] < 0, 'the push: away from the player (' + kd.map(v => v.toFixed(2)).join(', ') + ')');
  check(kc[0] === 0 && kc[2] === 0, 'the crane (fixed on its tower): no push');
  check(H.sparkN('potato', false) === 0 && H.sparkN('balanced', false) >= 8 && H.sparkN('high', true) > H.sparkN('high', false), 'the hit sparks: none extra on Very Low, ' + H.sparkN('balanced', false) + ' on Balanced, more on a core hit');
}

console.log('e · Funke: what now');
{
  const a = H.nextLine({ left: 2 }), b = H.nextLine({ left: 1 }), c = H.nextLine({ freed: true, next: { d: 412, arrow: '↗' } }), d = H.nextLine({ freed: true, next: null }), e = H.nextLine({ left: 0 });
  check(a && a.key === 'g.hf.left' && a.vars.n === 2, 'a machine calm, two left: „noch 2"');
  check(b && b.key === 'g.hf.left1', 'one left: „nur noch eine"');
  check(e === null, 'none left: the outpost\'s own line (the beacon) — nothing extra');
  check(c && c.key === 'g.hf.next' && c.vars.d === 410 && c.vars.arrow === '↗', 'freed: the next outpost\'s way (' + JSON.stringify(c && c.vars) + ')');
  check(d && d.key === 'g.hf.none', 'freed, none left near: look round or build a home');
}

console.log('f · the texts');
{
  const keys = ['g.set.hitShake', 'g.set.hitShake.tip', 'g.hf.left', 'g.hf.left1', 'g.hf.next', 'g.hf.none', 'g.hf.hidden'];
  const de = V.I18N.tables ? V.I18N.tables.de : null;
  let ok = 0; for (const k of keys) { V.I18N.set('de'); const t1 = V.I18N.t(k, { n: 2, d: 5, arrow: '↗', key: 'F1' }); V.I18N.set('en'); const t2 = V.I18N.t(k, { n: 2, d: 5, arrow: '↗', key: 'F1' }); if (t1 !== k && t2 !== k && t1 !== t2) ok++; else console.log('    missing: ' + k); }
  void de; V.I18N.set('de');
  check(ok === keys.length, ok + '/' + keys.length + ' texts in German and English');
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');

// u-stations2 · test/story.js section 19 (plan docs/superpowers/plans/2026-10-31-u-stations2.md): Echo's hall shows the
// five peoples — a close shot circling Echo (c11.b1, c11.b2), the arc turned until it is free, the peoples on its far side
// facing the camera and near it; ch. 9: the air's sun disc and glare dimmed while the nebula fills the sky.
module.exports = function (S, SP, tr, calm, check) {
  console.log('19 · u-stations2: Echo in the round, the nebula without the glare');
  const sh = (id) => S.byId(id).scene.shots;
  check(sh('c11.b1').some(q => q.cam === 'circle' && q.target === 'echo' && q.fx === 'echo') && sh('c11.b2').some(q => q.cam === 'circle' && q.target === 'echo'), 'c11.b1 and c11.b2: a close shot circling Echo (no wide shot from 15–20 m)');
  check(typeof SP.circleA0 === 'function' && SP.CIRCLE_R >= 4 && SP.CIRCLE_R <= 7, `the circle at ${SP.CIRCLE_R} m from Echo`);
  const E0 = [0.5, 64.1, -1], eye = [0.5, 65.6, 6.5];
  const mk = (free) => ({ b: S.byId('c11.b1'), t: 7, eye0: eye, yaw0: 0, fwd: [0, 0, -1], tg: { echo: E0 }, ground: () => 64, free });
  // a table in the way on the player's side: the arc turns away from it
  const block = (C) => !(Math.abs(C[0] - 0.5) < 2.2 && C[2] > 3 && C[2] < 5.5 && C[1] < 66.5);
  const sc = mk(block), a0 = SP.circleA0(sc, E0), arc = [-0.45, 0, 0.45].map(k => SP.circleAt(E0, a0 + k));
  check(arc.every(block) && Math.abs(a0 - Math.atan2(eye[0] - E0[0], eye[2] - E0[2])) > 0.2, `… the arc turned off the blocked side (${(a0 * 57.3).toFixed(0)}°), all of it free`);
  const Lk0 = VR.LifeKit; VR.LifeKit = { folk: (s, r, a, st) => ({ seed: s, style: st }), yawOf: (dx, dz) => Math.atan2(-dx, -dz) };
  const pe = SP.peoples(sc); VR.LifeKit = Lk0;
  const C = SP.circleAt(E0, a0), dc = pe.map(q => Math.hypot(q.pos[0] - C[0], q.pos[2] - C[2])), far = pe.filter(q => Math.hypot(q.pos[0] - C[0], q.pos[2] - C[2]) > Math.hypot(E0[0] - C[0], E0[2] - C[2])).length;
  const facing = pe.every(q => { const fx = -Math.sin(q.yaw), fz = -Math.cos(q.yaw); return fx * (E0[0] - q.pos[0]) + fz * (E0[2] - q.pos[2]) > 0; });
  check(pe.length === 5 && far >= 4 && facing && Math.max(...dc) < 10.5, `the five peoples beyond Echo from the camera (${far}/5), facing it, near (${dc.map(v => v.toFixed(1)).join(' ')} m)`);
  // in the camera's view: every one of them within the shot's 50° (horizontal ≈ 80° at 16:9) — none outside the frame
  const look = [E0[0] - C[0], E0[2] - C[2]], la = Math.atan2(look[1], look[0]);
  const off = pe.map(q => { let d = Math.atan2(q.pos[2] - C[2], q.pos[0] - C[0]) - la; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d) * 57.3; });
  check(off.every(v => v < 36), `… all five in the frame (${off.map(v => v.toFixed(0)).join(' ')}° off its middle)`);
  // ch. 9: the sun's disc and glare in the air dimmed
  const U = { airK: [1, 2, 1, 0.75], air3: [0.4, 0.6, 1.2, 1.4, 1.0, 0.6, 2.0, 1.4, 0.8], airB: [1.2, 0.9, 0.5], sunK: [3, 2, 0.5, 2] }, k0 = U.sunK.slice();
  SP.tintAir(U, 0.9);
  check(U.sunK[0] < k0[0] * 0.6 && U.sunK[1] < k0[1] * 0.35 && U.sunK[2] === k0[2], `ch. 9: Helia's disc ×${(U.sunK[0] / k0[0]).toFixed(2)}, its glare in the air ×${(U.sunK[1] / k0[1]).toFixed(2)} — Flimmi reads`);
};

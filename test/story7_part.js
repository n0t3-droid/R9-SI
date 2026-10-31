// f-polish4 · test/story.js section 20 (plan docs/superpowers/plans/2026-10-31-f-polish4.md): ch. 9's contrast — the
// nebula's walls dim round Flimmi, a dark dust lane behind it, Flimmi the brightest light, the air's stops darker; Very
// Low draws no more lights than before. Required by test/story.js.
module.exports = function (S, SP, tr, calm, check) {
  console.log('20 · f-polish4: ch. 9 — Flimmi the brightest thing in the frame');
  const e = [0, 71.6, 0], fwd = [0, 0, -1], F0 = [0, 131.6, -60];
  const mk = (id, t, low) => ({ g: { settings: { preset: low ? 'potato' : 'high', storyLights: true }, time: t }, sc: { b: S.byId(id), t, eye0: e, yaw0: 0, fwd, tg: { sky: F0, echo: [0, 70.1, -10], lit: [30, 70, -40], vista: [0, 75, -90] }, ground: () => 70 } });
  const L = (id, t, low) => { const o = mk(id, t, low); return SP.glowList(o.g, o.sc); };
  const fl = Math.hypot(F0[0] - e[0], F0[1] - e[1], F0[2] - e[2]), FD = [(F0[0] - e[0]) / fl, (F0[1] - e[1]) / fl, (F0[2] - e[2]) / fl];
  const ang = (q) => { const d = [q.p[0] - e[0], q.p[1] - e[1], q.p[2] - e[2]], l = Math.hypot(d[0], d[1], d[2]); return Math.acos(Math.max(-1, Math.min(1, (d[0] * FD[0] + d[1] * FD[1] + d[2] * FD[2]) / l))) * 180 / Math.PI; };
  const b2 = L('c9.b2', 9), b1 = L('c9.b1', 9);
  const w2 = b2.filter(q => q.kind === 1), w1 = b1.filter(q => q.kind === 1);
  const near = w2.map((q, i) => [ang(q), q.a / w1[i].a]).filter(x => x[0] < 12);
  check(w2.length === w1.length && near.every(x => x[1] <= 0.35) && w2.every((q, i) => q.a <= w1[i].a + 1e-9), `the walls within 12° of Flimmi dim to ≤ 0.35 (${near.map(x => x[0].toFixed(0) + '°×' + x[1].toFixed(2)).join(' ') || 'none that near'}), none brighter`);
  const lane = b2.filter(q => q.kind === 2 && ang(q) < 1);
  check(lane.length === 1 && Math.hypot(lane[0].p[0] - e[0], lane[0].p[1] - e[1], lane[0].p[2] - e[2]) > fl * 3, 'a dark dust lane right behind Flimmi, far beyond it');
  const at = b2.filter(q => q.kind === 0 && Math.hypot(q.p[0] - F0[0], q.p[1] - F0[1], q.p[2] - F0[2]) < 0.01), core = Math.max(...at.map(q => q.a));
  const other = Math.max(...b2.filter(q => q.kind === 0 && !at.includes(q)).map(q => q.a));
  check(at.length === 3 && core >= 2.5 && core > 2 * other, `Flimmi's core the brightest light (${core.toFixed(2)} vs the next ${other.toFixed(2)})`);
  const lo = L('c9.b2', 9, true);
  check(lo.length <= 19, 'Very Low: no more lights than before in c9.b2 (' + lo.length + ' ≤ 19)');
  // the air's stops: darker than a-story5's (the horizon at most ×0.3 of the day's air)
  const U = { airK: [1, 2, 1, 0.75], air3: [0.4, 0.6, 1.2, 1.4, 1.0, 0.6, 2.0, 1.4, 0.8], airB: [1.2, 0.9, 0.5] }, lum = (v, o) => 0.2126 * v[o] + 0.7152 * v[o + 1] + 0.0722 * v[o + 2];
  const l0 = lum(U.air3, 3); SP.tintAir(U, 0.9);
  check(lum(U.air3, 3) / l0 <= 0.3 && U.air3[3] > 2 * U.air3[4], `the air's horizon stop a deep rose dusk (×${(lum(U.air3, 3) / l0).toFixed(2)} of the day's, ${U.air3.slice(3, 6).map(v => v.toFixed(2))})`);
};

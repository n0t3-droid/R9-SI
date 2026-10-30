// ============================================================================
// 🏛 Schaufenster (a-builder; plan docs/superpowers/plans/2026-10-30-a-builder.md §2.4): the photo mode (F8) for builds.
// O circles the build you look at — the camera finds the first block along the view (≤ 96 m), keeps its distance and
// height and goes round it slowly (a round in ~35 s), always looking at it: W / S nearer and farther, Space / Shift up and
// down, A / D turn the way round and its speed; O again or any glide ends it. G sets the golden hour (the low warm sun;
// the time is given back when the mode ends, as before). The picture is the photo mode's own PNG (F2, Enter, a click).
// A circle started is a moment in the event log (build/showcase, weight 2).
// VR.Showcase (pure): GOLDEN · SPEED · orbitCam(c, r, a, h) → {x, y, z, yaw, pitch}; the game: start(g, {centre,
// golden}) · stop(g) (the scripted sessions use them).
// ============================================================================
(function (VR) {
  'use strict';
  const tx = (k, v, de, en) => (VR.I18N && VR.I18N.tx ? VR.I18N.tx(k, v, de, en) : de);
  const SC = VR.Showcase = {};
  SC.GOLDEN = 11450;   // ticks: the sun ~8° over the horizon before sunset (12000)
  SC.SPEED = 0.18;     // radians a second
  SC.orbitCam = function (c, r, a, h) {
    const x = c[0] + Math.sin(a) * r, y = c[1] + h, z = c[2] + Math.cos(a) * r;
    const dx = c[0] - x, dy = c[1] - y, dz = c[2] - z;
    return { x, y, z, yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
  };
  const PM = VR.PhotoMode;
  if (!PM || !PM.Photo || typeof document === 'undefined') return;
  const P = PM.Photo.prototype, R = VR.R, F = VR.F;
  const solid = (w, x, y, z) => { const s = w.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)); return !!(s && (R.T.flags[s] & F.SOLID)); };
  SC.startOrbit = function (pc, centre) {
    const g = pc.g, s = pc.s, w = g.world; if (!s || !w) return false;
    let c = centre;
    if (!c) {
      const cp = Math.cos(s.pitch), f = [-Math.sin(s.yaw) * cp, Math.sin(s.pitch), -Math.cos(s.yaw) * cp];
      for (let t = 1; t <= 96 && !c; t += 0.5) if (solid(w, s.x + f[0] * t, s.y + f[1] * t, s.z + f[2] * t)) c = [s.x + f[0] * t, s.y + f[1] * t, s.z + f[2] * t];
      if (!c) c = [s.x + f[0] * 16, s.y + f[1] * 16, s.z + f[2] * 16];
    }
    const r = Math.max(6, Math.min(120, Math.hypot(s.x - c[0], s.z - c[2])));
    pc.orbit = { c: c.slice(), r, a: Math.atan2(s.x - c[0], s.z - c[2]), h: Math.max(1.5, Math.min(60, s.y - c[1])), w: SC.SPEED };
    PM.note(tx('g.show.orbit', null, '🔄 Rundflug — W / S näher · weiter · Leertaste / Umschalt Höhe · A / D Richtung · G goldene Stunde · O aus', '🔄 Orbit — W / S nearer · farther · Space / Shift height · A / D direction · G golden hour · O off'), 4500);
    if (VR.EventLog && VR.EventLog.emit) VR.EventLog.emit('build', 'showcase', 2, c, 'showcase', Math.max(3, r * 0.3));
    return true;
  };
  SC.golden = function (pc) {
    if (!pc.timeOk) { PM.note(tx('g.show.noTime', null, '🌅 Die Uhrzeit gehört hier der ganzen Runde', '🌅 The time of day belongs to everyone here'), 2500); return false; }
    pc.held = SC.GOLDEN; pc.g.env.setTime(pc.held);
    PM.note(tx('g.show.golden', null, '🌅 Goldene Stunde — [ ] verschiebt die Zeit', '🌅 Golden hour — [ ] moves the time'), 2500);
    return true;
  };
  const oUpdate = P.update, oLeave = P.leave, oEnter = P.enter;
  P.enter = function () {
    oEnter.call(this);
    if (this.on) { const n = document.getElementById('photonote'); if (n && n.textContent) PM.note(n.textContent + tx('g.show.more', null, ' · O: Rundflug · G: goldene Stunde', ' · O: orbit · G: golden hour'), 6000); }
  };
  P.leave = function () { this.orbit = null; oLeave.call(this); };
  P.update = function (dt, I) {
    const typing = this.g.ui && this.g.ui.typing;
    if (this.on && this.s && !this.first && !typing) {
      if (I.hit('KeyO')) { if (this.orbit) { this.orbit = null; PM.note(null); } else SC.startOrbit(this); }
      if (I.hit('KeyG')) SC.golden(this);
    }
    oUpdate.call(this, dt, I);
    const o = this.orbit, s = this.s; if (!this.on || !o || !s) return;
    const dn = (c) => !typing && I.down(c);
    o.r = Math.max(4, Math.min(120, o.r + ((dn('KeyS') ? 1 : 0) - (dn('KeyW') ? 1 : 0)) * 8 * dt));
    o.h = Math.max(0.5, Math.min(80, o.h + ((dn('Space') ? 1 : 0) - (dn('ShiftLeft') ? 1 : 0)) * 5 * dt));
    o.w = Math.max(-0.6, Math.min(0.6, o.w + ((dn('KeyD') ? 1 : 0) - (dn('KeyA') ? 1 : 0)) * 0.4 * dt));
    o.a += o.w * dt;
    let q = SC.orbitCam(o.c, o.r, o.a, o.h);
    for (let k = 0; k < 24 && solid(this.g.world, q.x, q.y, q.z); k++) { o.h += 0.5; q = SC.orbitCam(o.c, o.r, o.a, o.h); }   // (never inside a wall: up over it)
    s.x = q.x; s.y = q.y; s.z = q.z; s.yaw = q.yaw; s.pitch = q.pitch; s.vel[0] = s.vel[1] = s.vel[2] = 0;
  };
  // the scripted sessions: the photo mode, the circle round a centre, the golden hour
  SC.start = function (g, o) {
    o = o || {};
    if (!g.photoCam || !g.photoCam.on) g.photoMode(true);
    const pc = g.photoCam; if (!pc || !pc.on) return false;
    pc.first = false;
    SC.startOrbit(pc, o.centre || null);
    if (o.golden) SC.golden(pc);
    return true;
  };
  SC.stop = (g) => { if (g.photoCam && g.photoCam.on) g.photoMode(false); };
})(VR);

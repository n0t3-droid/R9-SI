// ============================================================================
// t-light2 · the GL side of the light (plan docs/superpowers/plans/2026-10-15-t-light2.md; the pure part: light2.js).
// Methods on VR.Renderer.prototype, each called from one line in renderer.js — the frame's values (l2Frame), the
// uniforms (l2Uniforms, from common()), the contact shadows (l2Ssao, after the opaque passes), the volumetric light
// (l2Vol, in post), the composite's grade and flare (l2Post). With every switch off none of them does anything, and the
// renderer draws as before.
// ============================================================================
(function (VR) {
  'use strict';
  const L2 = VR.Light2, GL = VR.GL, S = VR.SHADERS;
  if (!L2 || !VR.Renderer) return;
  const R = VR.Renderer.prototype;
  // the switches' state as one string (renderer.applyQ rebuilds the programs when it changes: their defines)
  L2.key = (q) => L2.SW.map(k => (q && q[k]) ? (q[k] === true ? 1 : q[k]) : 0).join('');
  // the time of day from the sun's direction (env.js: the sun's azimuth is the day's angle + 0.4)
  const ticksOf = (sun) => { let th = Math.atan2(sun[2], sun[0]) - 0.4; th = ((th % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); return th / (Math.PI * 2) * 24000; };
  L2.ticksOf = ticksOf;

  // ---------------------------------------------------------------- the frame (render() calls it first)
  // the per-frame values from the env; with the light model on, the moon a cool key light; with the grade on, the glow by
  // the hour (the bloom's threshold and strength)
  R.l2Frame = function (F, E) {
    const q = this.q;
    this.l2Active = L2.on(q) && E && E.dimId === 0;
    if (!this.l2Active) return;
    this.l2 = L2.frame(E, q, ticksOf(E.sunDir), this.l2);
    // the moon a cool key light (the shaders' u_moonColor, set again in l2Uniforms: E itself is not changed — a frame drawn
    // twice from the same E stays the same)
    const k = L2.K.moon, m = E.moonColor || [0, 0, 0];
    this.l2.moon = q.l2Light ? [m[0] * k * 0.92, m[1] * k * 0.98, m[2] * k * 1.08] : null;
  };

  // ---------------------------------------------------------------- the uniforms (common() calls it for every program)
  R.l2Uniforms = function (p, E) {
    const u = p.u, gl = this.gl, l = this.l2;
    if (!l || !this.l2Active) {
      // (a program with the defines but the light off this frame — another dimension: the plain values)
      if (u.u_l2Sky && E && E.ambSky) { gl.uniform3f(u.u_l2Sky, E.ambSky[0], E.ambSky[1], E.ambSky[2]); gl.uniform3f(u.u_l2Ground, E.ambSky[0] * 0.6, E.ambSky[1] * 0.6, E.ambSky[2] * 0.6); }
      if (u.u_l2Pool) gl.uniform4f(u.u_l2Pool, L2.K.poolHot, L2.K.poolK, L2.K.poolTail, L2.K.poolHue);
      if (u.u_l2K) gl.uniform4f(u.u_l2K, 0, 0.94, L2.K.wrapLeaf, L2.K.wrapSkin);
      if (u.u_l2AoK) gl.uniform4f(u.u_l2AoK, 0, 0.05, 0.4, 0);
      return;
    }
    if (u.u_l2Sky) { gl.uniform3f(u.u_l2Sky, l.sky[0], l.sky[1], l.sky[2]); gl.uniform3f(u.u_l2Ground, l.ground[0], l.ground[1], l.ground[2]); }
    if (u.u_l2K) gl.uniform4f(u.u_l2K, l.k[0], l.k[1], l.k[2], l.k[3]);
    if (u.u_l2Az) gl.uniform2f(u.u_l2Az, l.az[0], l.az[1]);
    if (u.u_l2Pool) gl.uniform4f(u.u_l2Pool, l.pool[0], l.pool[1], l.pool[2], l.pool[3]);
    if (l.moon && u.u_moonColor) gl.uniform3f(u.u_moonColor, l.moon[0], l.moon[1], l.moon[2]);
  };
})(VR);

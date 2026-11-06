// ============================================================================
// q-art2 · Bildregie II, the GL side (plan docs/superpowers/plans/2026-11-06-q-art2.md; the pure part: qart2.js).
// Wraps renderer methods additively: buildPrograms (Q2.use: the switches, the preset, fancy leaves and Laubkronen the
// defines see; the key), applyQ (a switch changed: the programs again), common (Schwebeinseln: the isles near the eye
// as uniforms — the overworld generator's island lattice, the same pure functions as the workers, every 30 frames) and
// drawSections (Fernkronen: the shadow pass's camera block). With every switch off nothing changes.
// ============================================================================
(function (VR) {
  'use strict';
  const Q2 = VR.QArt2;
  if (!Q2 || !VR.Renderer) return;
  const R = VR.Renderer.prototype;
  const opts = (r) => { const g = VR.game, s = g && g.settings; return { fancy: !(s && s.fancyLeaves === false), leaf: !!(r.q && r.q.qLeaf), preset: (s && s.preset) || 'high' }; };
  const keyOf = (r, o) => Q2.key(r.q, o.preset, o.fancy);
  const bp0 = R.buildPrograms;
  R.buildPrograms = function () { const o = opts(this); Q2.use(this.q, o); this.q2Key = keyOf(this, o); return bp0.apply(this, arguments); };
  const aq0 = R.applyQ;
  R.applyQ = function (full) {
    const res = aq0.call(this, full);
    const o = opts(this); Q2.use(this.q, o);
    if (keyOf(this, o) !== this.q2Key) this.buildPrograms();
    return res;
  };

  // ---- Schwebeinseln: the generator (main thread, lazily, the save's seed and generator version) and the isles near
  Q2.gen = function (g) {
    const m = g && g.meta;
    if (!m || (g.dim && g.dim !== 'overworld') || !VR.makeGen) return null;
    const k = (m.seed >>> 0) + '|' + (m.vgen || 1) + '|' + m.type;
    if (Q2._gk !== k) {
      Q2._gk = k; Q2._g = null;
      try { Q2._g = VR.makeGen('overworld', m.seed >>> 0, { worldType: m.type === 'flat' ? 'flat' : m.type, vgen: m.vgen || 1 }); } catch (e) { Q2._g = null; }
    }
    return Q2._g;
  };
  const P = Q2.pack([], [0, 0, 0]);
  let list = [], at = -1e9;
  const cm0 = R.common;
  R.common = function (p, E) {
    const r = cm0.apply(this, arguments);
    const u = p && p.u;
    if (u && u.u_qIsleA) {
      const gl = this.gl, c = this.cam, ci = this.camInt || [0, 0, 0];
      if (c && (this.frameNo - at > 30 || this.frameNo < at)) { at = this.frameNo; list = Q2.islesNear(Q2.gen(VR.game), [c.x, c.y, c.z]); }
      Q2.pack(list, ci, P);
      gl.uniform4fv(u.u_qIsleA, P.A); if (u.u_qIsleB) gl.uniform4fv(u.u_qIsleB, P.B); if (u.u_qIsleN) gl.uniform1i(u.u_qIsleN, P.n);
    }
    return r;
  };
  // ---- Fernkronen: the shadow pass's origins are relative to the camera (drawSections' originsFrom)
  const ds0 = R.drawSections;
  R.drawSections = function (lst, layer, prog, from) {
    if (prog && prog.u && prog.u.u_qCamI && from) {
      const gl = this.gl, ix = Math.floor(from[0]), iy = Math.floor(from[1]), iz = Math.floor(from[2]);
      gl.uniform3i(prog.u.u_qCamI, ix, iy, iz);
      if (prog.u.u_qCamF) gl.uniform3f(prog.u.u_qCamF, from[0] - ix, from[1] - iy, from[2] - iz);
    }
    return ds0.apply(this, arguments);
  };
})(VR);

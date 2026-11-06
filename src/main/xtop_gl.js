// ============================================================================
// x-top · Spitzenbild, the GL side (plan docs/superpowers/plans/2026-11-06-x-top.md; the pure part: xtop.js).
// Wraps renderer methods additively: buildPrograms (the key), applyQ (a switch changed: the programs again), l2Ssao
// (Tiefe's reach and strength swapped in around the contact shadows' pass) and l2Post (Filmkamera's uniforms on the
// composite). With every switch off none of them does anything: the renderer draws as before.
// ============================================================================
(function (VR) {
  'use strict';
  const X = VR.XTop, L2 = VR.Light2;
  if (!X || !VR.Renderer) return;
  const R = VR.Renderer.prototype;

  const bp0 = R.buildPrograms;
  R.buildPrograms = function () { X.use(this.q); this.xKey = X.key(this.q); return bp0.apply(this, arguments); };
  const aq0 = R.applyQ;
  R.applyQ = function (full) {
    const r = aq0.call(this, full);
    if (X.key(this.q) !== this.xKey) this.buildPrograms();   // (the switches are program defines)
    return r;
  };

  // Tiefe: light2's AO numbers for the level, made once per level
  if (L2 && R.l2Ssao) {
    const ss0 = R.l2Ssao, made = [null, null, null];
    R.l2Ssao = function (F, E) {
      const lv = Math.max(0, Math.min(2, this.q.xDepth | 0)), K0 = L2.AO;
      if (!lv) return ss0.call(this, F, E);
      const K = made[lv] && made[lv].src === K0 ? made[lv].ao : (made[lv] = { src: K0, ao: X.aoFor(K0, lv) }).ao;
      L2.AO = K;
      try { return ss0.call(this, F, E); } finally { L2.AO = K0; }
    };
  }

  // Tiefe: the people's contact shadow (folkgpu.js loads after this file: wrapped once, at the first post pass)
  const wrapFolk = function (rd) {
    const FG = VR.FolkGPU; if (!FG || !FG.shadow || FG.shadow.xTop) return;
    const sh0 = FG.shadow;
    FG.shadow = function (pos, cam, r, k) {
      const q = rd.q, lv = q ? Math.max(0, Math.min(2, q.xDepth | 0)) : 0;
      if (!lv || !(r < 0)) return sh0.call(this, pos, cam, r, k);
      const c = X.contact(r, k, lv); return sh0.call(this, pos, cam, c[0], c[1]);
    };
    FG.shadow.xTop = true;
  };

  // Filmkamera: the last drawn frame's view-projection and eye, the director's clock
  const l2Post0 = R.l2Post;
  R.l2Post = function (p, E, pass, F) {
    if (l2Post0) l2Post0.call(this, p, E, pass, F);
    if (!(VR.FolkGPU && VR.FolkGPU.shadow && VR.FolkGPU.shadow.xTop)) wrapFolk(this);
    if (pass !== 'composite') return;
    const u = p.u;
    if (u.u_xRange) { const R = X.RANGE; this.gl.uniform4f(u.u_xRange, R.a, R.k, R.t * X.dayK(E && E.sunDir ? E.sunDir[1] : 1), 0); }   // Tonumfang
    if (!u.u_xBlur) return;
    const gl = this.gl, B = this.xB || (this.xB = { vp: new Float32Array(16), eye: [0, 0, 0], t: -1, si: -1, ok: false });
    const d = VR.game && VR.game.director, cam = F && F.cam;
    let k = 0;
    if (this.q.xBlur && d && d.active && cam && this.vpNJ && this.lvOn) {
      const cut = !B.ok || d.si !== B.si || !!F.underwater;
      k = X.shutterK(d.t - B.t, cut);
      if (k > 0) gl.uniformMatrix4fv(u.u_xPrevVP, false, B.vp);
      gl.uniform4f(u.u_xBlur, cam.x - B.eye[0], cam.y - B.eye[1], cam.z - B.eye[2], k);
      B.vp.set(this.vpNJ); B.eye[0] = cam.x; B.eye[1] = cam.y; B.eye[2] = cam.z; B.t = d.t; B.si = d.si; B.ok = true;
    } else { gl.uniform4f(u.u_xBlur, 0, 0, 0, 0); B.ok = false; }
  };
})(VR);

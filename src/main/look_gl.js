// ============================================================================
// v-look · Filmblick, the GL side (plan docs/superpowers/plans/2026-11-01-v-look.md; the pure part: look.js).
// Wraps two renderer methods additively: post (the soft copy at ¼ × ¼ first, only with Weite Ferne or Lichtsaum on) and
// l2Post (the composite's uniforms). With every switch off neither does anything: the renderer draws as before.
// ============================================================================
(function (VR) {
  'use strict';
  const L = VR.Look, GL = VR.GL, S = VR.SHADERS;
  if (!L || !VR.Renderer) return;
  const R = VR.Renderer.prototype;

  // the soft copy's target: ¼ × ¼ of the scene, half floats (the HDR kept: the wrap adds the sky's light)
  R.lvTarget = function () {
    const gl = this.gl, w = Math.max(1, (this.w + 3) >> 2), h = Math.max(1, (this.h + 3) >> 2);
    const T = this.lvT || (this.lvT = { w: 0, h: 0, ok: false });
    if (T.w === w && T.h === h) return T.ok ? T : null;
    if (T.fb) gl.deleteFramebuffer(T.fb);
    if (T.t) gl.deleteTexture(T.t);
    T.fb = T.t = null; T.w = w; T.h = h; T.ok = false;
    if (!this.hdr) return null;
    gl.activeTexture(gl.TEXTURE0);
    T.t = GL.tex2D(w, h, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, { filter: gl.LINEAR });
    T.fb = GL.fbo([T.t]);
    T.ok = !!T.fb;
    return T.ok ? T : null;
  };
  // a switch changed: only the composite again (its defines are the switches; every other program stays)
  R.lvRebuild = function () {
    L.use(this.q); this.lvKey = L.key(this.q);
    if (!this.P || !this.P.composite) { this.buildPrograms(); return; }
    const G = GL, was = G.deferred; G.deferred = true;
    try { this.P.composite = GL.program(S.FS_VS, S.COMPOSITE_FS, 'composite'); } finally { G.deferred = was; }
  };
  // the frame's state: on (the switches, the main world, a scene depth), the soft copy made
  R.lvPre = function (F, E) {
    const q = this.q;
    this.lvOn = !!(L.on(q) && E && E.dimId === 0 && this.sceneDepth && this.hdr);
    this.lvSoftOn = false;
    if (!this.lvOn) return;
    this.lv = L.frame(E, this.lv);
    if (!L.needSoft(q) || F.underwater) return;
    const T = this.lvTarget(); if (!T) return;
    const gl = this.gl, P = this.lvP || (this.lvP = {});
    const p = P.soft || (P.soft = GL.program(S.FS_VS, L.SOFT_FS, 'lvSoft'));
    if (!p || !p.p) return;
    gl.useProgram(p.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.fb); gl.viewport(0, 0, T.w, T.h);
    this.tex(0, this.sceneCol, p.u.u_src);
    gl.uniform2f(p.u.u_texel, 1 / this.w, 1 / this.h);
    this.fsMark('lvSoft', T.w, T.h, T.w * T.h * 9 * 8, T.w * T.h * 8);
    this.fs(p);
    this.lvSoftOn = true;
  };
  const post0 = R.post;
  R.post = function (F, E) {
    if (L.on(this.q)) { const gl = this.gl; gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND); this.lvPre(F, E); }
    else this.lvOn = this.lvSoftOn = false;
    return post0.call(this, F, E);
  };
  // the composite's uniforms (renderer.post calls l2Post with the composite bound)
  const l2Post0 = R.l2Post;
  R.l2Post = function (p, E, pass, F) {
    if (l2Post0) l2Post0.call(this, p, E, pass, F);
    if (pass !== 'composite') return;
    const u = p.u; if (!u.u_lvHaze) return;
    const gl = this.gl, l = this.lv, on = !!(this.lvOn && l);
    // (off this frame — another world, no depth: every part's strength 0, the samplers on textures of their own)
    gl.uniform4f(u.u_lvHaze, on ? l.haze[0] : 200, on ? l.haze[1] : 0, on ? l.haze[2] : 0, on ? l.haze[3] : 0);
    if (on) { gl.uniform3fv(u.u_lvWarm, l.warm); gl.uniform3fv(u.u_lvCool, l.cool); }
    gl.uniform4f(u.u_lvPal, on ? l.pal[0] : 0, on ? l.pal[1] : 0, on ? l.pal[2] : 0, on ? l.pal[3] : 0);
    const so = on && this.lvSoftOn;
    gl.uniform4f(u.u_lvSoft, on ? l.soft[0] : 1e4, on ? l.soft[1] : 2e4, so ? l.soft[2] : 0, so ? l.soft[3] : 0);
    gl.uniform3f(u.u_lvSun, E.sunDir[0], E.sunDir[1], E.sunDir[2]);
    gl.uniform2f(u.u_lvNF, 0.06, (F && F.cam && F.cam.far) || 1200);
    if (u.u_lvInvVP && this.invVPNJ) gl.uniformMatrix4fv(u.u_lvInvVP, false, this.invVPNJ);
    gl.uniform2f(u.u_lvTexel, 1 / this.w, 1 / this.h);
    this.tex(6, this.sceneDepth, u.u_lvDepth);
    if (u.u_lvSoftTex) this.tex(7, so ? this.lvT.t : this.sceneCol, u.u_lvSoftTex);
    gl.activeTexture(gl.TEXTURE0);
  };
})(VR);

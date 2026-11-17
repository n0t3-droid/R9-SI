// ============================================================================
// Bildwarp · between two expensive frames a cheap one. When a PC draws a whole frame in 30–60 ms, every second (or
// second and third) frame is the LAST picture turned to the newest look — one full-screen texture read (≈ 1 ms)
// instead of the world. Looking round then moves at the monitor's rate and the mouse answers a frame earlier; the world
// itself (water, figures) still moves at the rate the PC can draw. The idea of VR headsets' timewarp and of Reflex 2's
// frame warp, done here with what every WebGL 2 PC has.
//   · the scene is drawn camera-relative (renderer.setupCamera: the view is a pure turn), so a turn maps the new view's
//     pixels into the old picture exactly: M = VP_old · VP_new⁻¹ (the direction of each pixel, depth does not matter)
//   · a step does not warp (moved > 0.35 blocks since the picture: a whole frame), nor another field of view, a menu,
//     the photo mode or a recording; the pixels the turn brings in from outside the old picture take its edge
//   · the plan (W.decide): a whole frame under 22 ms → every frame whole (nothing changes on a fast PC); 22–45 ms →
//     whole | warp; over 45 ms → whole | warp | warp. Smart Quality measures only the whole frames.
// Switch ⚙ Bild · Qualität „Bildwarp" (on). The picture is copied once a whole frame only while warps are planned.
// ============================================================================
(function (VR) {
  'use strict';
  const W = VR.Warp = {};
  const M4 = VR.mat4;
  W.MOVE = 0.35; W.T1 = 22; W.T2 = 45;
  if (VR.Settings && VR.Settings.add) VR.Settings.add({ key: 'warp', g: 'img', sec: 'quality', t: 'switch', lab: 'g.set.warp', tip: 'g.set.warp.tip', cost: 'low', def: true });
  W.on = (s) => !s || s.warp !== false;
  // the camera's turn and projection (as renderer.setupCamera, without the jitter)
  W.vp = function (cam, aspect, out) {
    const P = M4.create(), V = M4.create();
    M4.perspective(P, cam.fov, aspect, 0.06, cam.far || 1200);
    const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    M4.lookAt(V, 0, 0, 0, -sy * cp, sp, -cy * cp, 0, 1, 0);
    if (cam.roll) { const Rz = M4.create(); M4.rotZ(Rz, M4.create(), cam.roll); M4.mul(V, Rz, V); }
    return M4.mul(out || M4.create(), P, V);
  };
  // new clip → old clip
  W.mat = function (vpOld, vpNew, out) { const inv = M4.create(); M4.invert(inv, vpNew); return M4.mul(out || M4.create(), vpOld, inv); };
  W.state = () => ({ warps: 0 });
  W.decide = function (st, o) {
    if (!o.on || o.blocked || !o.have || !o.fovSame || !(o.moved <= W.MOVE)) return 'f';
    const n = o.fullMs > W.T2 ? 2 : o.fullMs > W.T1 ? 1 : 0;
    return st.warps < n ? 'w' : 'f';
  };
  W.done = function (st, k) { if (k === 'w') st.warps++; else st.warps = 0; };
  W.blocked = function (g) { return !g || g.state !== 'play' || !!(g.ui && (g.ui.screen || g.ui.blocking)) || !!g.photo || !!g.studioOpen || !!(VR.PhotoFx && VR.PhotoFx.rec); };

  const RP = VR.Renderer && VR.Renderer.prototype;
  if (!RP || !VR.GL) return;
  const FS = `
uniform sampler2D u_src;
uniform mat4 u_M;
in vec2 v_uv;
out vec4 o;
void main() {
  vec4 p = u_M * vec4(v_uv * 2.0 - 1.0, 1.0, 1.0);
  vec2 uv = p.w > 0.0 ? p.xy / p.w * 0.5 + 0.5 : v_uv;
  o = texture(u_src, clamp(uv, vec2(0.0), vec2(1.0)));
}`;
  RP.warpCapture = function () {
    const gl = this.gl, w = this.W, h = this.H;
    if (!this.warpFB || this.warpW !== w || this.warpH !== h) {
      if (this.warpTex) { gl.deleteTexture(this.warpTex); gl.deleteFramebuffer(this.warpFB); }
      this.warpTex = VR.GL.tex2D(w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, { filter: gl.LINEAR });
      this.warpFB = VR.GL.fbo([this.warpTex]); this.warpW = w; this.warpH = h;
      if (!this.warpFB) return false;
    }
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.warpFB);
    gl.blitFramebuffer(0, 0, w, h, 0, 0, w, h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return true;
  };
  RP.warpDraw = function (cam) {
    const gl = this.gl;
    if (!this.P.warp) this.P.warp = VR.GL.program(VR.SHADERS.FS_VS, FS, 'warp');
    const p = this.P.warp;
    this.warpNew = W.vp(cam, this.W / this.H, this.warpNew);
    this.warpM = W.mat(this.warpVP, this.warpNew, this.warpM);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.W, this.H);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    gl.useProgram(p.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.warpTex);
    gl.uniform1i(p.u.u_src, 0);
    gl.uniformMatrix4fv(p.u.u_M, false, this.warpM);
    this.fs(p);
    W.stats.warps++;
  };
  W.stats = { warps: 0, whole: 0 };
  const r0 = RP.render;
  RP.render = function (F) {
    if (!F || !F.warpOk) { this.lastWasWarp = false; return r0.apply(this, arguments); }
    const now = performance.now(), g = VR.game, S = g && g.settings, st = this.warpSt || (this.warpSt = W.state());
    if (this.warpPrevFull !== undefined) { const ms = now - this.warpPrevFull; this.warpFullMs = this.warpFullMs === undefined ? ms : this.warpFullMs * 0.8 + ms * 0.2; this.warpPrevFull = undefined; }
    const c = F.cam, last = this.warpCam, on = W.on(S);
    const k = W.decide(st, {
      on, blocked: W.blocked(g), fullMs: this.warpFullMs || 0,
      have: !!(this.warpOk && last && this.warpW === this.W && this.warpH === this.H && this.gl.canvas.width === this.W && this.gl.canvas.height === this.H),
      fovSame: !!(last && Math.abs(last.fov - c.fov) < 1e-4 && (last.roll || 0) === (c.roll || 0)),
      moved: last ? Math.hypot(c.x - last.x, c.y - last.y, c.z - last.z) : 9,
    });
    W.done(st, k);
    this.lastWasWarp = k === 'w';
    if (k === 'w') { this.warpDraw(c); return; }
    this.warpPrevFull = now; W.stats.whole++;
    const r = r0.apply(this, arguments);
    // the picture for the warps after it: only while warps are planned (a fast PC copies nothing)
    this.warpOk = false;
    if (on && (this.warpFullMs || 0) > W.T1 && this.vpNJ) {
      this.warpOk = this.warpCapture();
      this.warpVP = this.warpVP || M4.create(); this.warpVP.set(this.vpNJ);
      this.warpCam = { x: c.x, y: c.y, z: c.z, fov: c.fov, roll: c.roll || 0 };
    } else this.warpCam = null;
    return r;
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

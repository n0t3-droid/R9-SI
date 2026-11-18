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
  W.MOVE = 1.0; W.T1 = 22; W.T2 = 45;   // (v0.55.63: steps are corrected by the depth — two iterations; beyond a block: a whole frame)
  if (VR.Settings && VR.Settings.add) VR.Settings.add({ key: 'warp', g: 'img', sec: 'quality', t: 'switch', lab: 'g.set.warp', tip: 'g.set.warp.tip', cost: 'low', def: true });
  W.stepOn = true;   // (the step's correction; a test turns it off to compare)
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
    const L = W.limits(o.vsync || 0), n = o.fullMs > L[1] ? 2 : o.fullMs > L[0] ? 1 : 0;
    return st.warps < n ? 'w' : 'f';
  };
  // v0.55.64 · the thresholds by the screen's own frame v (a 144 Hz monitor shows warps from 10 ms whole frames on):
  // one warp when a whole frame takes over 1.35 v, two over 2.7 v (60 Hz: 22.5 / 45 ms, as before); v unknown: 60 Hz
  W.limits = (v) => { v = v > 3 && v < 40 ? v : 1000 / 60; return [Math.max(7, v * 1.35), v * 2.7]; };
  // the screen's frame from the intervals between drawn frames: it follows short intervals at once, long ones barely
  W.vsyncStep = (v, iv) => { if (!(iv > 2 && iv < 100)) return v; if (v === undefined) return iv < 15.5 ? iv : undefined; return iv < v ? v * 0.6 + iv * 0.4 : Math.min(1000 / 60, v * 0.998 + iv * 0.002); };   // (unknown → 60 Hz; a slow frame never teaches it: only a short interval does — the title screen's, a warp's)
  // v0.55.64 · Smart Quality's whole-frame target with the warps on (game.js smartQuality): 38 instead of 55 — whole | warp
  // shows 76 a second, so the picture keeps its sharpness and its effects where it gave them up for 55 before
  W.SQ = 38;
  W.sqTarget = (s) => (W.on(s) ? W.SQ : 55);
  W.done = function (st, k) { if (k === 'w') st.warps++; else st.warps = 0; };
  W.blocked = function (g) { return !g || g.state !== 'play' || !!(g.ui && (g.ui.screen || g.ui.blocking)) || !!g.photo || !!g.studioOpen || !!(VR.PhotoFx && VR.PhotoFx.rec); };

  const RP = VR.Renderer && VR.Renderer.prototype;
  if (!RP || !VR.GL) return;
  // the turn maps a pixel into the old picture; a step moves near things more than far ones: two iterations with the old
  // picture's depth (the point seen there, put into the new view: how far off from this pixel → move the lookup back)
  const FS = `
uniform sampler2D u_src;
uniform highp sampler2D u_depth;
uniform mat4 u_M;        // new clip → old clip (the turn)
uniform mat4 u_invOld;   // old clip → old camera-relative world
uniform mat4 u_vpNew;    // new camera-relative world → new clip
uniform vec3 u_dpos;     // the new eye − the old eye
uniform float u_step;    // 1: correct the step
in vec2 v_uv;
out vec4 o;
void main() {
  vec4 p = u_M * vec4(v_uv * 2.0 - 1.0, 1.0, 1.0);
  vec2 uv = p.w > 0.0 ? p.xy / p.w * 0.5 + 0.5 : v_uv;
  if (u_step > 0.5) {
    for (int i = 0; i < 2; i++) {
      float z = texture(u_depth, clamp(uv, vec2(0.0), vec2(1.0))).r;
      if (z >= 0.99999) break;   // the sky: as far as the turn says
      vec4 w = u_invOld * vec4(uv * 2.0 - 1.0, z * 2.0 - 1.0, 1.0);
      vec4 c = u_vpNew * vec4(w.xyz / w.w - u_dpos, 1.0);
      if (c.w <= 0.0) break;
      uv -= (c.xy / c.w - (v_uv * 2.0 - 1.0)) * 0.5;
    }
  }
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
    const dp = this.warpCam ? [cam.x - this.warpCam.x, cam.y - this.warpCam.y, cam.z - this.warpCam.z] : [0, 0, 0];
    const step = W.stepOn && this.warpInvOld && this.sceneDepth && Math.hypot(dp[0], dp[1], dp[2]) > 0.002 ? 1 : 0;
    gl.uniform1f(p.u.u_step, step);
    if (step) {
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.sceneDepth); gl.uniform1i(p.u.u_depth, 1);
      gl.uniformMatrix4fv(p.u.u_invOld, false, this.warpInvOld); gl.uniformMatrix4fv(p.u.u_vpNew, false, this.warpNew);
      gl.uniform3f(p.u.u_dpos, dp[0], dp[1], dp[2]);
      gl.activeTexture(gl.TEXTURE0);
    }
    this.fs(p);
    W.stats.warps++;
  };
  W.stats = { warps: 0, whole: 0 };
  const r0 = RP.render;
  RP.render = function (F) {
    if (!F || !F.warpOk) { this.lastWasWarp = false; return r0.apply(this, arguments); }
    const now0 = performance.now(); if (this.warpLastCall !== undefined) this.warpVsync = W.vsyncStep(this.warpVsync, now0 - this.warpLastCall); this.warpLastCall = now0;
    const now = now0, g = VR.game, S = g && g.settings, st = this.warpSt || (this.warpSt = W.state());
    if (this.warpPrevFull !== undefined) { const ms = now - this.warpPrevFull; this.warpFullMs = this.warpFullMs === undefined ? ms : this.warpFullMs * 0.8 + ms * 0.2; this.warpPrevFull = undefined; }
    const c = F.cam, last = this.warpCam, on = W.on(S);
    const k = W.decide(st, {
      on, blocked: W.blocked(g), fullMs: this.warpFullMs || 0, vsync: this.warpVsync,
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
    if (on && (this.warpFullMs || 0) > W.limits(this.warpVsync)[0] && this.vpNJ) {
      this.warpOk = this.warpCapture();
      this.warpVP = this.warpVP || M4.create(); this.warpVP.set(this.vpNJ);
      this.warpInvOld = this.warpInvOld || M4.create(); M4.invert(this.warpInvOld, this.vpNJ);
      this.warpCam = { x: c.x, y: c.y, z: c.z, fov: c.fov, roll: c.roll || 0 };
    } else this.warpCam = null;
    return r;
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

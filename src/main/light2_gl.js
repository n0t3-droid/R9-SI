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
    this.l2MainVP = this.viewProj;   // (the main view's matrix: the mirror and the far cache swap in their own — no contact shadows there)
    if (!this.l2Active) return;
    this.l2 = L2.frame(E, q, ticksOf(E.sunDir), this.l2);
    // the eye's sky light (indoors: the dust in a sunbeam), eased over ~20 frames so a door does not pop it
    const w = F.world, c = F.cam;
    let es = 1;
    if (w && w.getLight && c) es = (w.getLight(Math.floor(c.x), Math.floor(c.y), Math.floor(c.z)) >>> 12) / 15;
    // (t-polish2: a jump — a teleport, a respawn, a cut — sets the eased values at once instead of easing from the place
    // before: 6 blocks or more since the last frame)
    const at = this.l2At || (this.l2At = [NaN, NaN, NaN]), jump = !c || !(Math.abs(c.x - at[0]) + Math.abs(c.y - at[1]) + Math.abs(c.z - at[2]) < 6);
    if (c) { at[0] = c.x; at[1] = c.y; at[2] = c.z; }
    this.l2EyeSky = this.l2EyeSky === undefined || jump ? es : this.l2EyeSky + (es - this.l2EyeSky) * 0.1;
    // t-polish2 · the room's air (L2.ROOM): indoors, the lamps' colour round the eye (seven cells, every fourth frame),
    // eased like the eye's sky light; outdoors its density falls to 0
    if (q.l2Air) {
      const R = L2.ROOM, room = this.l2Room || (this.l2Room = [0, 0, 0, 0]), tgt = this.l2RoomT || (this.l2RoomT = [0, 0, 0]);
      const ind = L2.roomIndoor(this.l2EyeSky);
      if (ind > 0.001 && w && w.getLight && c && ((this.frameNo & 3) === 0 || jump)) {
        const S = this.l2RoomS || (this.l2RoomS = R.pts.map(() => [0, 0, 0]));
        const cx = Math.floor(c.x), cy = Math.floor(c.y), cz = Math.floor(c.z);
        R.pts.forEach((p, i) => { const l = w.getLight(cx + p[0], cy + p[1], cz + p[2]) | 0; S[i][0] = (l >> 8) & 15; S[i][1] = (l >> 4) & 15; S[i][2] = l & 15; });
        L2.roomColor(S, tgt);
      }
      for (let i = 0; i < 3; i++) room[i] = jump ? tgt[i] : room[i] + (tgt[i] - room[i]) * 0.1;
      room[3] = R.rho * ind;
    } else if (this.l2Room) this.l2Room[3] = 0;
    // the moon a cool key light, teal like the night's shade (the lit things' u_moonColor, set again in l2Uniforms: E
    // itself is not changed — a frame drawn twice from the same E stays the same)
    const k = L2.K.moon, m = E.moonColor || [0, 0, 0];
    this.l2.moon = q.l2Light ? [m[0] * k * 0.8, m[1] * k * 1.04, m[2] * k * 1.0] : null;
  };

  // ---------------------------------------------------------------- the uniforms (common() calls it for every program)
  const q2 = (r) => !!(r.q && r.q.l2Light);
  R.l2Uniforms = function (p, E) {
    const u = p.u, gl = this.gl, l = this.l2;
    if (u.u_l2AoK) this.l2AoUniforms(u);
    if (!l || !this.l2Active) {
      // (a program with the defines but the light off this frame — another dimension: the plain values)
      if (u.u_l2Sky && E && E.ambSky) { gl.uniform3f(u.u_l2Sky, E.ambSky[0], E.ambSky[1], E.ambSky[2]); gl.uniform3f(u.u_l2Ground, E.ambSky[0] * 0.6, E.ambSky[1] * 0.6, E.ambSky[2] * 0.6); }
      if (u.u_l2Glow) gl.uniform3f(u.u_l2Glow, 0, 0, 0);
      if (u.u_l2Pool) gl.uniform4f(u.u_l2Pool, L2.K.poolHot, L2.K.poolK, L2.K.poolTail, L2.K.poolHue);
      if (u.u_l2K) gl.uniform4f(u.u_l2K, 0, 0.94, L2.K.wrapLeaf, L2.K.wrapSkin);
      if (u.u_l2Fog) { gl.uniform4f(u.u_l2Fog, 0, 0.06, 62, 64); gl.uniform4f(u.u_l2Fog2, 0, 0, 0, 0); gl.uniform3f(u.u_l2FogCol, 0, 0, 0); if (u.u_l2Air) gl.uniform4f(u.u_l2Air, 0, 0, 0, 0); }
      if (u.u_l2Room) gl.uniform4f(u.u_l2Room, 0, 0, 0, 0);   // (t-polish2: no room air)
      return;
    }
    if (u.u_l2Sky) { gl.uniform3f(u.u_l2Sky, l.sky[0], l.sky[1], l.sky[2]); gl.uniform3f(u.u_l2Ground, l.ground[0], l.ground[1], l.ground[2]); }
    if (u.u_l2Glow) gl.uniform3f(u.u_l2Glow, l.glow[0], l.glow[1], l.glow[2]);
    if (u.u_l2K) gl.uniform4f(u.u_l2K, l.k[0], l.k[1], l.k[2], l.k[3]);
    if (u.u_l2Az) gl.uniform2f(u.u_l2Az, l.az[0], l.az[1]);
    if (u.u_l2Pool) gl.uniform4f(u.u_l2Pool, l.pool[0], l.pool[1], l.pool[2], l.pool[3]);
    if (l.moon && u.u_moonColor && u.u_l2Sky) gl.uniform3f(u.u_moonColor, l.moon[0], l.moon[1], l.moon[2]);   // (the lit things only: the sky's moon stays the sky's)
    if (q2(this) && u.u_sunColor && u.u_l2Sky && E && E.sunColor) { const t = l.sunTint, c = E.sunColor; gl.uniform3f(u.u_sunColor, c[0] * t[0], c[1] * t[1], c[2] * t[2]); }   // (the sun by the hour on the lit things)
    if (u.u_l2Fog) {
      // the air: the height fog from this eye (the far cache's own eye in its strips), the aerial perspective, the mist
      const a = l.air, c = this.cam, m = l.mist, ey = c ? c.y : 64;
      gl.uniform4f(u.u_l2Fog, a.rho * L2.fogEye(ey, a.base), a.k, a.base, ey);   // (no valley haze far under the sea level)
      gl.uniform4f(u.u_l2Fog2, 1 / a.apDist, a.apMax, a.sunK, 0);
      gl.uniform3f(u.u_l2FogCol, m[0], m[1], m[2]);
      if (u.u_l2Air) { const A = L2.AIRGOLD; gl.uniform4f(u.u_l2Air, A.away[0], A.away[1], A.away[2], l.airK || 0); gl.uniform3f(u.u_l2Air2, A.side[0], A.side[1], A.side[2]); }   // (f-sky5: the golden far air)
      if (u.u_l2Room) { const r = this.l2Room; gl.uniform4f(u.u_l2Room, r ? r[0] : 0, r ? r[1] : 0, r ? r[2] : 0, r ? r[3] : 0); }   // (t-polish2: the room's air)
    }
  };

  // ---------------------------------------------------------------- step 2 · the contact shadows
  // render() calls l2Ssao after the opaque passes: from the scene's depth, at half resolution, the scalable ambient
  // obscurance (light2.js AO_FS: 4 / 8 / 12 taps on a spiral turned by blue noise), then a depth-aware blur each way.
  // The terrain, the palms and the furniture read it in the NEXT frame where each fragment was then (u_l2AoVP, u_l2AoDelta)
  // and only where the depth there matches its own — so it darkens the sky's light (and half the lamps'), never the sun.
  // The targets: RG16F (the obscurance, the linear depth), RGBA16F where RG16F cannot be drawn into, else none.
  R.l2AoTargets = function () {
    const gl = this.gl, w = Math.max(1, (this.w + 1) >> 1), h = Math.max(1, (this.h + 1) >> 1);
    const A = this.l2A || (this.l2A = { w: 0, h: 0, ok: false });
    if (A.w === w && A.h === h) return A.ok ? A : null;
    const drop = () => { for (const k of ['fb0', 'fb1']) if (A[k]) gl.deleteFramebuffer(A[k]); for (const k of ['t0', 't1']) if (A[k]) gl.deleteTexture(A[k]); A.fb0 = A.fb1 = A.t0 = A.t1 = null; };
    drop();
    A.w = w; A.h = h; A.ok = false;
    if (!GL.ext || !(GL.ext.cbf || GL.ext.cbhf)) return null;
    for (const f of [[gl.RG16F, gl.RG, gl.HALF_FLOAT], [gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT]]) {
      A.t0 = GL.tex2D(w, h, f[0], f[1], f[2], { filter: gl.LINEAR }); A.t1 = GL.tex2D(w, h, f[0], f[1], f[2], { filter: gl.LINEAR });
      A.fb0 = GL.fbo([A.t0]); A.fb1 = A.fb0 ? GL.fbo([A.t1]) : null;
      if (A.fb0 && A.fb1) { A.ok = true; break; }
      drop();
    }
    return A.ok ? A : null;
  };
  R.l2Ssao = function (F, E) {
    const q = this.q, lv = Math.min(3, q.l2Ssao | 0), gl = this.gl, K = L2.AO;
    if (!lv || !this.l2Active || !this.sceneDepth) return;
    // under the governor's first rung (shadowEvery 2) every other frame keeps the last one's (the reprojection holds)
    if ((q.shadowEvery | 0) > 1 && (this.frameNo & 1) && this.l2AoAt === this.frameNo - 1) return;
    gl.activeTexture(gl.TEXTURE0);
    const A = this.l2AoTargets();
    if (!A) return;
    this.gpuPass('ssao');
    if (!this.l2Blue) this.l2Blue = GL.tex2D(64, 64, gl.R8, gl.RED, gl.UNSIGNED_BYTE, { data: L2.blueNoise(64, 7), filter: gl.NEAREST, wrap: gl.REPEAT });
    const n = L2.TAPS[lv], P = this.l2P || (this.l2P = {});
    const pa = P['ao' + n] || (P['ao' + n] = GL.program(S.FS_VS, L2.AO_FS, 'l2ao', L2.passDefines(n)));
    const pb = P.blur || (P.blur = GL.program(S.FS_VS, L2.BLUR_FS, 'l2blur'));
    const blend = gl.isEnabled(gl.BLEND);
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, A.fb0); gl.viewport(0, 0, A.w, A.h);
    gl.useProgram(pa.p);
    this.tex(0, this.sceneDepth, pa.u.u_depth); this.tex(1, this.l2Blue, pa.u.u_blue);
    const pr = this.proj;   // (as drawn: the jitter in [8], [9])
    gl.uniform4f(pa.u.u_proj, 1 / pr[0], 1 / pr[5], pr[8], pr[9]);
    gl.uniform2f(pa.u.u_nf, 0.06, F.cam.far || 1200);
    gl.uniform2f(pa.u.u_texel, 1 / this.w, 1 / this.h);
    gl.uniform4f(pa.u.u_ao, K.radius[lv], K.strength[lv], K.bias, pr[5] * this.h * 0.5);
    gl.uniform1f(pa.u.u_phase, this.jit ? (this.frameNo * 0.6180339887) % 1 : 0);   // (the noise turns only where TSR gathers the turns)
    const px = A.w * A.h;
    this.fsMark('l2ao', A.w, A.h, px * 4 * (n + 5), px * 4, px * (n + 5));
    this.fs(pa);
    gl.useProgram(pb.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, A.fb1); this.tex(0, A.t0, pb.u.u_src); gl.uniform2f(pb.u.u_dir, 1 / A.w, 0);
    this.fsMark('l2blur', A.w, A.h, px * 4 * 7, px * 4, px * 7); this.fs(pb);
    gl.bindFramebuffer(gl.FRAMEBUFFER, A.fb0); this.tex(0, A.t1, pb.u.u_src); gl.uniform2f(pb.u.u_dir, 0, 1 / A.h);
    this.fsMark('l2blur', A.w, A.h, px * 4 * 7, px * 4, px * 7); this.fs(pb);
    // where it was drawn from (the next frame reads it there)
    (this.l2AoVP || (this.l2AoVP = new Float32Array(16))).set(this.viewProj);
    this.l2AoEye = [F.cam.x, F.cam.y, F.cam.z]; this.l2AoAt = this.frameNo; this.l2AoSize = this.w * 65536 + this.h;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFB); gl.viewport(0, 0, this.w, this.h);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.enable(gl.CULL_FACE); if (blend) gl.enable(gl.BLEND);
    gl.activeTexture(gl.TEXTURE0);
  };
  // ---------------------------------------------------------------- step 3 · the light in the air
  // render() calls l2Vol before the hand clears the depth: a quarter-res march through the shadow map (light2.js VOL_FS)
  // into an RGBA16F target (the light, the linear depth); the composite adds it, upsampled by depth (L2VOL). Where it runs
  // the screen-space god rays do not (renderer.post: l2VolOn). It needs the shadow map of this frame and the light up.
  R.l2VolTarget = function () {
    const gl = this.gl, w = Math.max(1, (this.w + 3) >> 2), h = Math.max(1, (this.h + 3) >> 2);
    const V = this.l2V || (this.l2V = { w: 0, h: 0, ok: false });
    if (V.w === w && V.h === h) return V.ok ? V : null;
    if (V.fb) gl.deleteFramebuffer(V.fb);
    if (V.t) gl.deleteTexture(V.t);
    V.fb = V.t = null; V.w = w; V.h = h; V.ok = false;
    if (!this.hdr) return null;
    gl.activeTexture(gl.TEXTURE0);
    V.t = GL.tex2D(w, h, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, { filter: gl.NEAREST });
    V.fb = GL.fbo([V.t]);
    V.ok = !!V.fb;
    return V.ok ? V : null;
  };
  R.l2Vol = function (F, E) {
    this.l2VolOn = false;
    const q = this.q, gl = this.gl, l = this.l2, K = L2.VOL;
    if (!q.l2Vol || !this.l2Active || !l || F.underwater || !q.shadows || !this.shadowValid || !this.shadowTex || !this.sceneDepth) return;
    const sunUp = E.sunDir[1] > 0.02, L = sunUp ? E.sunDir : E.moonDir;
    if (L[1] < 0.06) return;
    const c = sunUp ? E.sunColor : (l.moon || E.moonColor), k = L2.volK(sunUp, E.rain, this.l2EyeSky);
    if ((c[0] + c[1] + c[2]) * k < 0.01) return;
    const V = this.l2VolTarget();
    if (!V) return;
    this.gpuPass('vol');
    if (!this.l2Blue) this.l2Blue = GL.tex2D(64, 64, gl.R8, gl.RED, gl.UNSIGNED_BYTE, { data: L2.blueNoise(64, 7), filter: gl.NEAREST, wrap: gl.REPEAT });
    const P = this.l2P || (this.l2P = {});
    const p = P.vol || (P.vol = GL.program(S.FS_VS, L2.VOL_FS, 'l2vol'));
    const st = [gl.isEnabled(gl.DEPTH_TEST), gl.isEnabled(gl.CULL_FACE), gl.isEnabled(gl.BLEND)];
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND); gl.depthMask(false);
    gl.bindFramebuffer(gl.FRAMEBUFFER, V.fb); gl.viewport(0, 0, V.w, V.h);
    gl.useProgram(p.p);
    this.tex(0, this.sceneDepth, p.u.u_depth);
    this.tex(1, this.shadowRead || this.shadowTex, p.u.u_shadowMap);
    this.tex(2, this.l2Blue, p.u.u_blue);
    gl.uniformMatrix4fv(p.u.u_invVP, false, this.invViewProj);
    gl.uniformMatrix4fv(p.u.u_shadowMat, false, this.shadowMat);
    this.shadowOffUni(p.u);
    gl.uniform2f(p.u.u_nf, 0.06, F.cam.far || 1200);
    const air = l.air;
    gl.uniform4f(p.u.u_vol, K.steps, Math.min(K.reach, (q.shadowDist || 64) * 0.95), air.rho * k, L2.volG(sunUp));
    gl.uniform4f(p.u.u_volH, F.cam.y, air.k * K.kScale, air.base, 0.0008);
    gl.uniform3f(p.u.u_volCol, c[0], c[1], c[2]);
    gl.uniform3f(p.u.u_volL, L[0], L[1], L[2]);
    if (p.u.u_volSky) gl.uniform1f(p.u.u_volSky, K.sky);
    if (p.u.u_volShaft) gl.uniform1f(p.u.u_volShaft, K.shaft);
    if (p.u.u_volF) gl.uniform2f(p.u.u_volF, 1 / K.fade, L2.volCover(sunUp));
    gl.uniform1f(p.u.u_phase, this.jit ? (this.frameNo * 0.6180339887) % 1 : 0);
    const px = V.w * V.h;
    this.fsMark('l2vol', V.w, V.h, px * 4 * (K.steps + 2), px * 8, px * (K.steps + 2));
    this.fs(p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFB); gl.viewport(0, 0, this.w, this.h);
    gl.depthMask(true);
    if (st[0]) gl.enable(gl.DEPTH_TEST);
    if (st[1]) gl.enable(gl.CULL_FACE);
    if (st[2]) gl.enable(gl.BLEND);
    gl.activeTexture(gl.TEXTURE0);
    this.l2VolOn = true;
  };

  // ---------------------------------------------------------------- step 6 · the lighthouses' beams
  // render() calls l2Beams after the translucent pass: for each lighthouse lamp within reach (the land's anchors,
  // landlife.js), two cones sweeping round, additive, depth-tested, no depth write (light2.js BEAM). With the light model,
  // at night and late dusk.
  R.l2Beams = function (F, E) {
    const q = this.q, l = this.l2, B = L2.BEAM;
    if (!q.l2Light || !this.l2Active || !l || F.underwater) return;
    const k = L2.beamK(E.night);
    if (k <= 0.001) return;
    const G = VR.game, land = G && G.entities && G.entities.land, c = F.cam;
    if (!land || !land.fx || !land.fx.size || !c) return;
    const list = this.l2BeamList || (this.l2BeamList = []);
    list.length = 0;
    for (const M of land.fx.values()) {
      if (M.kind !== 'lighthouse') continue;
      const dx = M.x + 0.5 - c.x, dz = M.z + 0.5 - c.z;
      if (dx * dx + dz * dz < B.reach * B.reach) list.push(M);
    }
    if (!list.length) return;
    this.gpuPass('beams');
    const gl = this.gl, P = this.l2P || (this.l2P = {});
    const p = P.beam || (P.beam = GL.program(L2.BEAM_VS, L2.BEAM_FS, 'l2beam'));
    if (!this.l2BeamVao) {
      const m = L2.beamMesh(), vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, m.v, gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(p.p, 'a_pos'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 12, 0);
      const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, m.i, gl.STATIC_DRAW);
      gl.bindVertexArray(null);
      this.l2BeamVao = vao; this.l2BeamN = m.i.length;
    }
    const st = [gl.isEnabled(gl.BLEND), gl.isEnabled(gl.CULL_FACE), gl.isEnabled(gl.DEPTH_TEST)];
    gl.useProgram(p.p);
    gl.uniformMatrix4fv(p.u.u_viewProj, false, this.viewProj);
    gl.uniform3f(p.u.u_shape, B.len, B.r0, B.r1);
    gl.uniform3f(p.u.u_col, B.col[0] * k, B.col[1] * k, B.col[2] * k);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.disable(gl.CULL_FACE); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(false);
    gl.bindVertexArray(this.l2BeamVao);
    const t = E.time || 0, ct = Math.cos(B.tilt), stt = Math.sin(B.tilt);
    for (const M of list) {
      gl.uniform3f(p.u.u_origin, M.x + 0.5 - c.x, M.y + 0.5 - c.y, M.z + 0.5 - c.z);
      for (let i = 0; i < 2; i++) {
        const a = L2.beamAngle(t, i);
        gl.uniform3f(p.u.u_axis, Math.cos(a) * ct, stt, Math.sin(a) * ct);
        gl.drawElements(gl.TRIANGLES, this.l2BeamN, gl.UNSIGNED_SHORT, 0);
        this.stats.draws++;
      }
    }
    gl.bindVertexArray(null);
    gl.depthMask(true); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    if (!st[0]) gl.disable(gl.BLEND);
    if (st[1]) gl.enable(gl.CULL_FACE);
    if (!st[2]) gl.disable(gl.DEPTH_TEST);
  };

  // ---------------------------------------------------------------- the post passes (renderer.post calls l2Post)
  // 'bloom': the glow's threshold by the hour; 'composite': the grade (the curve, the split toning, the vignette, the
  // mid-tones' saturation) in place of the old contrast and vignette, the glow's strength by the hour, the sun's flare,
  // the volumetric light's texture. With the light off this frame the grade is the identity.
  const ID_CURVE = [0, 1, 0, 1];
  R.l2Post = function (p, E, pass, F) {
    const gl = this.gl, u = p.u, l = this.l2, q = this.q, on = !!(l && this.l2Active);
    if (pass === 'bloom') { if (on && q.l2Grade && u.u_threshold) gl.uniform1f(u.u_threshold, l.grade.bThr); return; }
    if (pass !== 'composite') return;
    if (u.u_l2Curve) {
      const g = on && q.l2Grade ? l.grade : null, photo = !!(F && F.photo);
      const cv = g ? [g.toe, Math.log(g.mid) / Math.log(0.5), g.s, g.sh] : ID_CURVE;
      gl.uniform4f(u.u_l2Curve, cv[0], cv[1], cv[2], cv[3]);
      gl.uniform3f(u.u_l2Dark, g ? g.dark[0] : 0, g ? g.dark[1] : 0, g ? g.dark[2] : 0);
      gl.uniform3f(u.u_l2Light, g ? g.light[0] : 0, g ? g.light[1] : 0, g ? g.light[2] : 0);
      // the sun's flare: its place, its gate (in front, on the screen, up, no rain), its strength
      let sx = 0, sy = 0, gate = 0;
      if (g && !photo && E.sunDir[1] > -0.02 && !(F && F.underwater)) {
        const m = this.viewProj, Ld = E.sunDir;
        const cx = m[0] * Ld[0] + m[4] * Ld[1] + m[8] * Ld[2], cy = m[1] * Ld[0] + m[5] * Ld[1] + m[9] * Ld[2], cw = m[3] * Ld[0] + m[7] * Ld[1] + m[11] * Ld[2];
        if (cw > 0) {
          sx = (cx / cw) * 0.5 + 0.5; sy = (cy / cw) * 0.5 + 0.5;
          const edge = Math.max(Math.abs(sx - 0.5), Math.abs(sy - 0.5));
          const sc = E.sunColor, sl = 0.2126 * sc[0] + 0.7152 * sc[1] + 0.0722 * sc[2];
          gate = edge < 0.5 ? Math.min(1, (0.5 - edge) * 8) * Math.min(1, sl / 1.6) * (1 - Math.min(1, (E.rain || 0) * 1.5)) : 0;
        }
      }
      const aspect = this.W / Math.max(1, this.H);
      gl.uniform4f(u.u_l2Vig, g && !photo ? g.vig : 0, aspect, g ? g.sat : 1, L2.FLARE.k);
      gl.uniform4f(u.u_l2Sun, sx, sy, gate, L2.FLARE.disc);
      if (gate > 0 && u.u_l2Ghost) {
        const G = L2.ghosts(sx, sy), a = this.l2GhostA || (this.l2GhostA = new Float32Array(20)), b = this.l2GhostB || (this.l2GhostB = new Float32Array(15));
        const sc = E.sunColor;
        for (let i = 0; i < 5; i++) { a[i * 4] = G[i][0]; a[i * 4 + 1] = G[i][1]; a[i * 4 + 2] = G[i][2]; a[i * 4 + 3] = 0; b[i * 3] = G[i][3] * sc[0]; b[i * 3 + 1] = G[i][4] * sc[1]; b[i * 3 + 2] = G[i][5] * sc[2]; }
        gl.uniform4fv(u.u_l2Ghost, a); gl.uniform3fv(u.u_l2GhostC, b);
      }
      if (g) {
        // the old contrast and vignette give way to the grade's (a photo keeps its own vignette)
        if (u.u_contrast) gl.uniform1f(u.u_contrast, 0);
        if (!photo && u.u_vignette) gl.uniform1f(u.u_vignette, 0);
        if (u.u_bloomStrength && q.bloom && this.hdr) gl.uniform1f(u.u_bloomStrength, g.bStr);
      }
    }
    if (u.u_l2VolOn) {
      const V = this.l2V, vol = !!(this.l2VolOn && V && V.ok);
      gl.uniform1f(u.u_l2VolOn, vol ? 1 : 0);
      if (vol) {
        this.tex(3, V.t, u.u_l2Vol); this.tex(4, this.sceneDepth, u.u_l2Depth);
        gl.uniform2f(u.u_l2VolSize, V.w, V.h);
        gl.uniform2f(u.u_l2nf, 0.06, (F && F.cam && F.cam.far) || 1200);
      } else if (u.u_l2Vol) {
        // (the samplers keep a texture of their own: the scene's colour and depth on units 3 and 4, not read)
        this.tex(3, this.sceneCol, u.u_l2Vol); this.tex(4, this.sceneDepth, u.u_l2Depth);
      }
    }
  };

  // the reading programs' uniforms: last frame's result on unit 12 (a blank texel while there is none: the sampler always
  // has a texture), read only in the main view and only when it is from the frame before
  R.l2AoUniforms = function (u) {
    const gl = this.gl, A = this.l2A, c = this.cam, e = this.l2AoEye;
    const ok = !!(this.l2Active && A && A.ok && this.viewProj === this.l2MainVP && this.l2AoAt >= this.frameNo - 2 && this.l2AoAt < this.frameNo && this.l2AoSize === this.w * 65536 + this.h && c && e);
    gl.uniform4f(u.u_l2AoK, ok ? 1 : 0, L2.AO.tol, L2.AO.block, 0);
    if (ok) {
      if (u.u_l2AoVP) gl.uniformMatrix4fv(u.u_l2AoVP, false, this.l2AoVP);
      if (u.u_l2AoDelta) gl.uniform3f(u.u_l2AoDelta, c.x - e[0], c.y - e[1], c.z - e[2]);
    }
    if (u.u_l2Ao) {
      gl.activeTexture(gl.TEXTURE12);
      if (!this.l2Blank) this.l2Blank = GL.tex2D(1, 1, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, { data: new Uint8Array([255, 255, 255, 255]), filter: gl.NEAREST });
      gl.bindTexture(gl.TEXTURE_2D, ok ? A.t0 : this.l2Blank); gl.uniform1i(u.u_l2Ao, 12);
      gl.activeTexture(gl.TEXTURE0);
    }
  };
})(VR);

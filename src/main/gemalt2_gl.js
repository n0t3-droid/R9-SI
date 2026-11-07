// ============================================================================
// r-gemalt 2 · Gemaltes Licht, the GL side (the pure part: gemalt2.js). Additive wraps of the renderer: common() sets the
// warm/cool key and the strengths on every program that has them (u_gmK), applyQ rebuilds the programs when a switch
// changes, and gmTuft (one line in render(), after the props) draws the brush-stroke grass: one instanced draw of crossed
// cards whose blades are painted in the fragment shader (no texture), placed on the grass columns round the eye.
// With every switch off nothing changes and nothing is drawn.
// ============================================================================
(function (VR) {
  'use strict';
  const G2 = VR.Gemalt2, GL = VR.GL;
  if (!G2 || !VR.Renderer) return;
  const R = VR.Renderer.prototype;
  const S = () => VR.game && VR.game.settings;
  // ---------------------------------------------------------------- the uniforms (every program; cheap without u_gmK)
  const pal = { lit: [1, 1, 1], shade: [1, 1, 1] };
  let palF = -1;
  const c0 = R.common;
  R.common = function (p, E) {
    const r = c0.apply(this, arguments);
    const u = p && p.u;
    if (u && u.u_gmK) {
      const gl = this.gl;
      if (palF !== this.frameNo && E && E.sunDir) { palF = this.frameNo; G2.palette(E.sunDir[1], pal); }
      // (only the overworld's sky: another dimension keeps its own light — the key white, the air off)
      const ow = !E || !E.dimId, K = G2.K;
      gl.uniform3f(u.u_gmLit, pal.lit[0], pal.lit[1], pal.lit[2]);
      if (u.u_gmShade) gl.uniform3f(u.u_gmShade, pal.shade[0], pal.shade[1], pal.shade[2]);
      gl.uniform4f(u.u_gmK, ow ? K.paint : 0, ow ? K.rim : 0, ow ? K.air : 0, K.stroke);
    }
    return r;
  };
  // ---------------------------------------------------------------- a switch changed: the programs again
  const aq0 = R.applyQ;
  R.applyQ = function (full) {
    const res = aq0.call(this, full);
    const k = G2.key(S());
    if (this.gm2Key !== undefined && k !== this.gm2Key && this.P) {
      this.buildPrograms();
      for (const n in this.P) if (n.startsWith('far_')) delete this.P[n];
    }
    this.gm2Key = k;
    if (this.gmT && !G2.on(S(), 'gTuft')) this.gmT.n = 0;
    return res;
  };

  // ---------------------------------------------------------------- the brush-stroke grass
  const VS = `
layout(location=0) in vec4 a_i0;   // the clump's foot (relative to the batch's origin), its turn
layout(location=1) in vec4 a_i1;   // its colour (the ground's green), its size
layout(location=2) in vec4 a_i2;   // the sky light there, its tone, the sway's phase
uniform mat4 u_viewProj;
uniform vec3 u_off;                // the batch's origin − the eye
uniform float u_time;
uniform float u_wind;
uniform vec2 u_windDir;
uniform vec4 u_feet[${G2.TRAMPLE.n}];   // the trampled marks: x, z (relative to the eye), strength
#ifdef SHADOWS
uniform mat4 u_shadowMat;
out vec4 v_shadow;
#endif
out vec2 v_uv;
out vec3 v_col;
out vec3 v_rel;
out float v_sky;
out float v_tone;
out float v_seed;
void main() {
  int vid = gl_VertexID % 6, q = gl_VertexID / 6;
  vec2 c = vec2(vid == 1 || vid == 2 || vid == 4 ? 1.0 : 0.0, vid == 2 || vid == 4 || vid == 5 ? 1.0 : 0.0);
  float a = a_i0.w + float(q) * 1.5708;
  vec2 dir = vec2(cos(a), sin(a));
  float W = 0.62 * a_i1.w, H = 0.5 * a_i1.w;
  vec3 foot = a_i0.xyz + u_off;
  // trampled: the blades lie down away from the foot
  float tr = 0.0; vec2 away = vec2(0.0);
  for (int i = 0; i < ${G2.TRAMPLE.n}; i++) { vec4 f = u_feet[i]; if (f.z <= 0.0) continue; vec2 d = foot.xz - f.xy; float k = f.z * (1.0 - smoothstep(${G2.TRAMPLE.r0.toFixed(3)}, ${G2.TRAMPLE.r1.toFixed(3)}, length(d))); if (k > tr) { tr = k; away = normalize(d + vec2(1e-3, 0.0)); } }
  float h = c.y * H * (1.0 - 0.8 * tr);
  vec3 p = foot + vec3(dir.x * (c.x - 0.5) * W, h, dir.y * (c.x - 0.5) * W);
  // the wind: the tips sway (the root stays), the trampled ones lean flat
  float sw = (0.05 + 0.1 * u_wind) * sin(u_time * 1.9 + a_i2.z) + 0.06 * u_wind;
  p.xz += (u_windDir * sw * (1.0 - tr) + away * tr * 0.45) * c.y * c.y * H * 2.0;
  v_uv = c; v_col = pow(a_i1.rgb, vec3(2.2)); v_rel = p; v_sky = a_i2.x; v_tone = a_i2.y; v_seed = a_i2.z + float(q) * 3.1;
#ifdef SHADOWS
  v_shadow = u_shadowMat * vec4(p, 1.0);
#endif
  gl_Position = u_viewProj * vec4(p, 1.0);
}`;
  const FS = `
uniform ivec3 u_camInt;
uniform vec3 u_gmLit;
uniform vec3 u_gmShade;
uniform vec4 u_gmK;
#ifdef SHADOWS
uniform highp sampler2DShadow u_shadowMap;
uniform float u_shadowTexel;
uniform vec2 u_shadowOff;
in vec4 v_shadow;
#endif
__COMMON__
in vec2 v_uv;
in vec3 v_col;
in vec3 v_rel;
in float v_sky;
in float v_tone;
in float v_seed;
layout(location=0) out vec4 o_col;
float gmH(float n) { return fract(sin(n * 12.9898 + v_seed * 78.233) * 43758.5453); }
void main() {
  // five painted blades on the card: each a tapered stroke, bent, of its own height — dark at the root, light at the tip
  float t = -1.0;
  for (int k = 0; k < 5; k++) {
    float fk = float(k), hk = 0.5 + 0.5 * gmH(fk), bk = (gmH(fk + 7.0) - 0.5) * 0.5;
    float x = 0.14 + 0.18 * fk + (gmH(fk + 3.0) - 0.5) * 0.1 + bk * v_uv.y * v_uv.y;
    float y = v_uv.y / hk, w = 0.1 * (1.0 - y * 0.85);
    if (y < 1.0 && abs(v_uv.x - x) < w) t = max(t, y);
  }
  if (t < 0.0) discard;
  float tone = floor(t * 3.99) / 3.0;   // four tones, a painter's steps
  vec3 alb = v_col * mix(0.5, 1.22, tone) * mix(0.9, 1.08, v_tone);   // (linear like the ground: the tips one painter's step lighter than the lawn)
  alb = mix(alb, alb * vec3(1.12, 1.06, 0.78), tone * 0.15 * v_tone);   // the tips a touch sun-bleached
  float skyL = v_sky * v_sky * (3.0 - 2.0 * v_sky);
  float sunUp = smoothstep(-0.12, 0.12, u_sunDir.y);
  vec3 L = sunUp > 0.001 ? u_sunDir : u_moonDir;
  vec3 lc = sunUp > 0.001 ? u_sunColor * sunUp : u_moonColor;
  float outdoors = smoothstep(0.55, 0.95, v_sky);
#ifdef SHADOWS
  vec3 sc = v_shadow.xyz / v_shadow.w * 0.5 + 0.5;
  float sh = 1.0;
  if (outdoors > 0.0 && sc.x > 0.001 && sc.x < 0.999 && sc.y > 0.001 && sc.y < 0.999 && sc.z < 1.0) sh = texture(u_shadowMap, vec3(fract(sc.xy + u_shadowOff), sc.z - 0.0008));
#else
  float sh = 1.0;
#endif
  float ndl = clamp(0.3 + 0.55 * L.y, 0.0, 1.0) * mix(0.55, 0.95, t);   // the grass takes the light softly, the roots in the clump's shade
  vec3 col = alb * (u_ambSky * skyL * mix(vec3(1.0), u_gmShade, u_gmK.x) * mix(0.75, 1.05, t) + lc * mix(vec3(1.0), u_gmLit, u_gmK.x) * ndl * sh * outdoors);
  col = applyFog(col, v_rel, length(v_rel));
  o_col = vec4(col, 1.0);
}`;
  R.gmTuftProgram = function () {
    const T = this.gmT || (this.gmT = { n: 0, prog: undefined, key: '' });
    const key = (this.q.shadows ? 'S' : '') + (this.q.lite ? 'L' : '');
    if (T.prog !== undefined && T.key === key) return T.prog;
    T.key = key;
    try { T.prog = GL.program(VS, FS.replace('__COMMON__', VR.SHADERS.COMMON), 'gmTuft', this.q.shadows ? ['SHADOWS'] : []); } catch (e) { console.error(e); T.prog = null; }
    return T.prog;
  };
  // the batch round the eye: rebuilt when the eye has moved a metre, or every 45 frames (new and changed sections)
  const tmp = [];
  // what may stand over a clump's column: air, the short and tall grasses, ferns (not flowers, not crops)
  let UP = null;
  const upOk = () => {
    const RR = VR.R; if (UP && UP.length === RR.stateCount) return UP;
    UP = new Uint8Array(RR.stateCount); UP[0] = 1;
    for (let st = 1; st < RR.stateCount; st++) { const t = RR.types[RR.T.type[st]]; if (t && /^(short_grass|tall_grass|short_dry_grass|tall_dry_grass|fern)$/.test(t.name)) UP[st] = 1; }
    return UP;
  };
  R.gmTuftBuild = function (T, w, cx, cz, Rr) {
    const SN = VR.SoftNat, TB = SN && SN.tables(), G = VR.Gemalt, st = S(), soft = G && st && st.gSoft && (!VR.LOOK || VR.LOOK.ground !== false);
    if (!TB) return;
    const max = G2.TUFT.max, A = T.data || (T.data = new Float32Array(max * 12));
    const X0 = Math.floor(cx), Z0 = Math.floor(cz), r = Math.ceil(Rr);
    T.ox = X0; T.oz = Z0; T.oy = 0;
    let n = 0;
    for (let dz = -r; dz <= r && n < max; dz++) for (let dx = -r; dx <= r && n < max; dx++) {
      const x = X0 + dx, z = Z0 + dz, d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz);
      if (d > Rr) continue;
      const c = w.col(x >> 4, z >> 4); if (!c || !c.height) continue;
      const ti = ((z & 15) << 4) | (x & 15), top = c.height[ti], b = w.getBlock(x, top, z);
      if (TB.mat[b] !== 1 || !upOk()[w.getBlock(x, top + 1, z)]) continue;   // (grass under open air or its own short grass: the flowers keep their models)
      G2.clumps(x, z, d, Rr, tmp); if (!tmp.length) continue;
      const t = c.grass ? c.grass[ti] : 0x4d6a;
      const cr = ((t >> 11) & 31) / 31 * 0.52, cg = ((t >> 5) & 63) / 63 * 0.54, cb = (t & 31) / 31 * 0.4;
      const sky = (w.getLight(x, top + 1, z) >>> 12) / 15;
      for (const k of tmp) {
        if (n >= max) break;
        const px = x + k.ox, pz = z + k.oz;
        let y = top + 1;
        if (soft) { const h = G.hAt(w, px, pz, top + 1); if (h === h) y = h; }
        const o = n * 12;
        A[o] = px - X0; A[o + 1] = y; A[o + 2] = pz - Z0; A[o + 3] = k.rot;
        A[o + 4] = cr; A[o + 5] = cg; A[o + 6] = cb; A[o + 7] = k.s;
        A[o + 8] = sky; A[o + 9] = k.tone; A[o + 10] = G2.hash(x, z, 99) * 6.2832; A[o + 11] = 0;
        n++;
      }
    }
    T.n = n;
    const gl = this.gl;
    if (!T.vao) {
      T.vao = gl.createVertexArray(); T.buf = gl.createBuffer();
      gl.bindVertexArray(T.vao); gl.bindBuffer(gl.ARRAY_BUFFER, T.buf);
      gl.bufferData(gl.ARRAY_BUFFER, max * 48, gl.DYNAMIC_DRAW);
      for (let i = 0; i < 3; i++) { gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, 4, gl.FLOAT, false, 48, i * 16); gl.vertexAttribDivisor(i, 1); }
      gl.bindVertexArray(null);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, T.buf);
    if (n) gl.bufferSubData(gl.ARRAY_BUFFER, 0, A, 0, n * 12);
  };
  // the feet: every walking body drawn on the ground (gemalt.js G.lift asks for each) and the player leave marks
  const marks = [];
  G2.marks = marks;
  const G = VR.Gemalt;
  if (G && G.lift && !G._g2feet) {
    G._g2feet = 1; const l0 = G.lift;
    G.lift = function (world, x, y, z) {
      const d = l0.apply(this, arguments), g = VR.game, c = g && g.renderer && g.renderer.cam;
      // (only bodies on the grass round the eye: a crowd far off would push the near marks out of the ring)
      if (g && g.settings && g.settings.gTuft && c && Math.abs(x - c.x) < 20 && Math.abs(z - c.z) < 20) G2.step(marks, x, z, performance.now() / 1000);
      return d;
    };
  }
  const feet = new Float32Array(G2.TRAMPLE.n * 4);
  R.gmTuft = function (E, camPos) {
    const st = S(), g = VR.game;
    if (!G2.on(st, 'gTuft') || !g || !g.world || (E && E.dimId)) return;
    const Rr = G2.tuftR(st._pr || st.preset); if (!Rr) return;
    const p = this.gmTuftProgram(); if (!p) return;
    const T = this.gmT, w = g.world;
    if (T.ox === undefined || Math.abs(camPos[0] - T.cx) > 1 || Math.abs(camPos[2] - T.cz) > 1 || this.frameNo - T.f > (T.n ? 45 : 10) || T.w !== w) {
      T.cx = camPos[0]; T.cz = camPos[2]; T.f = this.frameNo; T.w = w;
      this.gmTuftBuild(T, w, camPos[0], camPos[2], Rr);
    }
    if (!T.n) return;
    const gl = this.gl, u = p.u, now = performance.now() / 1000;
    if (g.player && g.player.pos && !g.player.flying) G2.step(marks, g.player.pos[0], g.player.pos[2], now);
    feet.fill(0);
    for (let i = 0; i < marks.length; i++) { const m = marks[i]; feet[i * 4] = m[0] - camPos[0]; feet[i * 4 + 1] = m[1] - camPos[2]; feet[i * 4 + 2] = G2.markK(now - m[2]); }
    gl.useProgram(p.p);
    this.common(p, E);
    gl.uniformMatrix4fv(u.u_viewProj, false, this.viewProj);
    gl.uniform3f(u.u_off, T.ox - camPos[0], -camPos[1], T.oz - camPos[2]);
    if (u.u_wind) gl.uniform1f(u.u_wind, E.wind || 0);
    if (u.u_windDir) { const wd = E.windDir || [1, 0]; gl.uniform2f(u.u_windDir, wd[0], wd[1]); }
    if (u.u_feet) gl.uniform4fv(u.u_feet, feet);
    if (u.u_shadowMat) {
      gl.uniformMatrix4fv(u.u_shadowMat, false, this.shadowMat);
      if (u.u_shadowTexel) gl.uniform1f(u.u_shadowTexel, 1 / (this.shadowSize || 1024));
      this.shadowOffUni(u);
      if (u.u_shadowMap && this.shadowTex) { gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.shadowRead || this.shadowTex); gl.uniform1i(u.u_shadowMap, 3); }
    }
    const cull = gl.isEnabled(gl.CULL_FACE);
    gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(T.vao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 12, T.n);
    gl.bindVertexArray(null);
    if (cull) gl.enable(gl.CULL_FACE);
    this.stats.gmTuft = T.n;
  };
})(VR);

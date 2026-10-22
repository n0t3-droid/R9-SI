// ============================================================================
// Trails: glowing engine plumes and long smoke contrails behind ships, as in
// the trailer. Each trail is a short history of an engine's positions drawn as
// a camera-facing ribbon — one draw call for all glows (additive, feeds the
// bloom) and one for all smoke (soft, lit by the sky, fogged). Emitters just
// call emit(key, x, y, z, opts) every frame; trails nobody feeds fade away.
// f-flow (R50-04, docs/superpowers/plans/2026-10-23-f-flow.md §2.4): smoke is smoke, not a white rod — v0.49 drew a
// segment of nearly one age (the tail cut by the point cap, the head cut where the ship left the traffic's 260-m range)
// as a constant-width strip with two hard ends. Now every point keeps the trail's arc length in metres (its emitter's
// odometer); the ribbon widens with age (Trails.width: ×(1 + grow), grow 2 → ×3 over its life) and thins (Trails.env:
// (1 − age) / (1 + grow·age), the smoke spreading as it widens and dying); it is soft at both ends — 0 at the newest
// point rising over a few widths (the condensation gap; a trail whose ship flew on ends soft) and 0 at the oldest kept
// point over its last 15 % (a trail its point cap cut ends soft) —; and it breaks into puffs in the fragment shader: a
// 1-D value noise of the arc length (7-m and 2.5-m octaves; the puffs stay where they formed) thins it into gaps and a
// lumpy edge as it ages. The points sit in a ring per trail and build() fills the buffers from one scratch: no arrays a
// frame. The glow ribbons draw as before (their seed in a_info.w).
// ============================================================================
(function (VR) {
  'use strict';
  const S = VR.SHADERS;
  S.TRAIL_VS = `
layout(location=0) in vec3 a_pos;
layout(location=1) in vec4 a_info;   // age 0..1, side -1..1, intensity, seed (glow) | arc length in metres (smoke)
layout(location=2) in vec3 a_col;
uniform mat4 u_viewProj;
out vec4 v_info;
out vec3 v_col;
out vec3 v_rel;
void main() { v_info = a_info; v_col = a_col; v_rel = a_pos; gl_Position = u_viewProj * vec4(a_pos, 1.0); }`;
  S.TRAIL_FS = `
uniform float u_smoke;
${S.COMMON}
in vec4 v_info;
in vec3 v_col;
in vec3 v_rel;
out vec4 o;
void main() {
  float age = clamp(v_info.x, 0.0, 1.0), side = v_info.y, k = v_info.z;
  float edge = 1.0 - side * side;
  if (u_smoke > 0.5) {
    // smoke (f-flow): the envelope (thinning with age, soft at both ends) comes in k; the puffs from the arc length in
    // metres — continuous behind the engine, breaking up as it ages: gaps between the puffs and a lumpy edge
    float s = v_info.w;
    float n = vnoise(vec2(s * 0.14, 0.37)) * 0.65 + vnoise(vec2(s * 0.4, 5.1)) * 0.35;
    float brk = smoothstep(0.04, 0.5, age);
    float hw = mix(1.0, 0.5 + 0.5 * n, brk);
    float e = clamp(1.0 - side * side / (hw * hw), 0.0, 1.0);
    float puff = mix(1.0, smoothstep(0.22, 0.72, n), brk);
    float a = min(1.0, pow(e, 0.8) * puff * k * 0.85);
    vec3 c = v_col * (u_ambSky * 1.25 + u_sunColor * 0.22 * (1.0 - u_night)) + u_sunset * 0.25;
    float dist = length(v_rel);
    c = applyFog(c, v_rel, dist);
    o = vec4(c, a);
  } else {
    // hot plume: white-hot core fading to the engine colour, sparkling
    float core = pow(edge, 3.0) * pow(1.0 - age, 3.0);
    float glow = pow(edge, 1.3) * pow(1.0 - age, 1.6);
    float spark = step(0.93, fract(sin(floor(age * 40.0) * 12.9898 + v_info.w * 78.233) * 43758.5453)) * edge * (1.0 - age);
    vec3 c = v_col * glow * 1.7 + mix(v_col, vec3(1.0, 0.97, 0.92), 0.55) * core * 1.3 + v_col * spark * 2.5;
    o = vec4(c * k, 1.0);
  }
}`;

  const PN = 6;                                   // a point: x, y, z, time, intensity, arc length (m)
  const DEF_COL = [1, 0.6, 0.3];
  const sm = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

  class Trails {
    constructor(game) {
      this.g = game;
      this.map = new Map();
      this.time = 0;
      this.cap = 12000;             // vertices per kind
      this.buf = { g: new Float32Array(this.cap * 10), s: new Float32Array(this.cap * 10) };
      this.n = { g: 0, s: 0 };
      this.scratch = new Float64Array(512 * PN);   // one trail's points in order, for build() (grows once for a longer one)
      this.dead = [];                               // keys to drop (reused)
      this.eng = new Map();                         // engine(): the keys and options of each engine (reused a frame)
      this.engT = 0;
      this._cam = null;
      this._life = (t, key) => {
        const life = t.o.life || 1, P = t.pts;
        while (t.n && this.time - P[t.i0 * PN + 3] > life) { t.i0 = (t.i0 + 1) % t.max; t.n--; }
        if (!t.n && this.time - t.seen > 0.2) this.dead.push(key);
      };
      this._one = (t) => this.ribbon(t);
      this._engGone = (e, key) => { if (this.time - e.seen > 2 && !this.map.has(e.kg) && !this.map.has(e.ks)) this.dead.push(key); };
    }
    // o: { kind: 'glow'|'smoke', col, width, life (s), step (m between points), k (intensity), grow, max (points) }
    emit(key, x, y, z, o) {
      let t = this.map.get(key);
      const max = Math.max(2, o.max || 90);
      if (!t) { t = { pts: new Float64Array(max * PN), max, i0: 0, n: 0, head: [x, y, z], o, seed: Math.random() * 100, off: Math.random() * 500, seen: 0, headK: 1 }; this.map.set(key, t); }
      else if (t.max !== max) this.resize(t, max);
      t.o = o; t.seen = this.time; t.head[0] = x; t.head[1] = y; t.head[2] = z; t.headK = o.k === undefined ? 1 : o.k;
      const step = o.step || 0.6, P = t.pts;
      let s = 0;
      if (t.n) {
        const j = ((t.i0 + t.n - 1) % t.max) * PN, dx = x - P[j], dy = y - P[j + 1], dz = z - P[j + 2], d2 = dx * dx + dy * dy + dz * dz;
        if (d2 <= step * step) return;
        s = P[j + 5] + Math.sqrt(d2);
      }
      if (t.n === t.max) { t.i0 = (t.i0 + 1) % t.max; t.n--; }   // (the cap: the oldest point goes)
      const j = ((t.i0 + t.n) % t.max) * PN;
      P[j] = x; P[j + 1] = y; P[j + 2] = z; P[j + 3] = this.time; P[j + 4] = t.headK; P[j + 5] = s;
      t.n++;
    }
    // (a trail whose options ask for another number of points: its newest ones kept)
    resize(t, max) {
      const P = new Float64Array(max * PN), keep = Math.min(t.n, max);
      for (let i = 0; i < keep; i++) { const a = ((t.i0 + t.n - keep + i) % t.max) * PN; for (let q = 0; q < PN; q++) P[i * PN + q] = t.pts[a + q]; }
      t.pts = P; t.max = max; t.i0 = 0; t.n = keep;
    }
    update(dt) {
      this.time += dt;
      const D = this.dead; D.length = 0;
      this.map.forEach(this._life);
      for (let i = 0; i < D.length; i++) this.map.delete(D[i]);
      if ((this.engT -= dt) <= 0) { this.engT = 2; D.length = 0; this.eng.forEach(this._engGone); for (let i = 0; i < D.length; i++) this.eng.delete(D[i]); }
    }
    clear() { this.map.clear(); this.eng.clear(); }
    // ribbons, camera-facing, written as triangles into the per-kind buffers
    build(cam) {
      this.n.g = 0; this.n.s = 0;
      this._cam = cam;
      this.map.forEach(this._one);
    }
    ribbon(t) {
      const o = t.o, life = o.life || 1, kind = o.kind === 'smoke' ? 's' : 'g', smoke = kind === 's';
      const time = this.time, cam = this._cam, cx = cam.x, cy = cam.y, cz = cam.z;
      // the points in order (the oldest first) and the head while it is fed
      const fresh = time - t.seen < 0.1, n0 = t.n, n = n0 + (fresh ? 1 : 0);
      if (n < 2) return;
      let Q = this.scratch;
      if (Q.length < n * PN) Q = this.scratch = new Float64Array(n * PN * 2);
      const P = t.pts;
      for (let i = 0; i < n0; i++) { const a = ((t.i0 + i) % t.max) * PN, b = i * PN; for (let q = 0; q < PN; q++) Q[b + q] = P[a + q]; }
      if (fresh) {
        const b = n0 * PN, l = b - PN, H = t.head;
        Q[b] = H[0]; Q[b + 1] = H[1]; Q[b + 2] = H[2]; Q[b + 3] = time; Q[b + 4] = t.headK;
        Q[b + 5] = Q[l + 5] + Math.hypot(H[0] - Q[l], H[1] - Q[l + 1], H[2] - Q[l + 2]);
      }
      const buf = this.buf[kind];
      const col = o.col || DEF_COL, c0 = col[0], c1 = col[1], c2 = col[2], w0 = o.width || 0.5, grow = o.grow || 0;
      // smoke's soft ends: from the newest point over a few widths, from the oldest over the last 15 % of its length
      const sTail = Q[5], sHead = Q[(n - 1) * PN + 5], span = Math.max(1e-6, sHead - sTail);
      const tailL = Math.min(30, Math.max(2, span * 0.15)), headL = Math.min(12, Math.max(2, w0 * 3));
      let pLx = 0, pLy = 0, pLz = 0, pRx = 0, pRy = 0, pRz = 0, pA = 0, pK = 0, pW = 0;
      for (let i = 0; i < n; i++) {
        const b = i * PN, px = Q[b], py = Q[b + 1], pz = Q[b + 2];
        const a = Math.min(1, (time - Q[b + 3]) / life);
        const q0 = (i > 0 ? i - 1 : 0) * PN, q1 = (i < n - 1 ? i + 1 : n - 1) * PN;
        const tx = Q[q1] - Q[q0], ty = Q[q1 + 1] - Q[q0 + 1], tz = Q[q1 + 2] - Q[q0 + 2];
        const vx = cx - px, vy = cy - py, vz = cz - pz;
        let sx = ty * vz - tz * vy, sy = tz * vx - tx * vz, sz = tx * vy - ty * vx;
        const sl = Math.hypot(sx, sy, sz) || 1, w = Trails.width(w0, grow, a) * 0.5;
        sx = sx / sl * w; sy = sy / sl * w; sz = sz / sl * w;
        const Lx = px - cx - sx, Ly = py - cy - sy, Lz = pz - cz - sz, Rx = px - cx + sx, Ry = py - cy + sy, Rz = pz - cz + sz;
        let k = Q[b + 4], wv = t.seed;
        if (smoke) { const s = Q[b + 5]; k *= Trails.env(a, grow) * sm((s - sTail) / tailL) * sm((sHead - s) / headL); wv = s + t.off; }
        if (i > 0) {
          if (this.n[kind] + 6 > this.cap) break;
          let f = this.n[kind] * 10;
          f = put(buf, f, pLx, pLy, pLz, pA, -1, pK, pW, c0, c1, c2); f = put(buf, f, pRx, pRy, pRz, pA, 1, pK, pW, c0, c1, c2); f = put(buf, f, Rx, Ry, Rz, a, 1, k, wv, c0, c1, c2);
          f = put(buf, f, pLx, pLy, pLz, pA, -1, pK, pW, c0, c1, c2); f = put(buf, f, Rx, Ry, Rz, a, 1, k, wv, c0, c1, c2); put(buf, f, Lx, Ly, Lz, a, -1, k, wv, c0, c1, c2);
          this.n[kind] += 6;
        }
        pLx = Lx; pLy = Ly; pLz = Lz; pRx = Rx; pRy = Ry; pRz = Rz; pA = a; pK = k; pW = wv;
      }
    }
    draw(r, E) {
      if (!this.map.size) return;
      const gl = r.gl;
      if (!this.prog) {
        this.prog = VR.GL.program(S.TRAIL_VS, S.TRAIL_FS, 'trail');
        this.vbo = gl.createBuffer(); this.vao = gl.createVertexArray();
        gl.bindVertexArray(this.vao); gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        gl.bufferData(gl.ARRAY_BUFFER, this.cap * 40, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 40, 0);
        gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 40, 12);
        gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 40, 28);
        gl.bindVertexArray(null);
      }
      this.build(r.cam);
      const p = this.prog;
      gl.useProgram(p.p); r.common(p, E);
      gl.uniformMatrix4fv(p.u.u_viewProj, false, r.viewProj);
      gl.bindVertexArray(this.vao); gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
      gl.enable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.CULL_FACE); gl.enable(gl.BLEND);
      if (this.n.s) {
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.buf.s, 0, this.n.s * 10);
        gl.uniform1f(p.u.u_smoke, 1); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.drawArrays(gl.TRIANGLES, 0, this.n.s); r.stats.draws++;
      }
      if (this.n.g) {
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.buf.g, 0, this.n.g * 10);
        gl.uniform1f(p.u.u_smoke, 0); gl.blendFunc(gl.ONE, gl.ONE);
        gl.drawArrays(gl.TRIANGLES, 0, this.n.g); r.stats.draws++;
      }
      gl.disable(gl.BLEND); gl.depthMask(true); gl.enable(gl.CULL_FACE);
      gl.bindVertexArray(null);
    }
    // one call per engine: a hot plume and (when fast) a contrail. o: thrust, size, col, minor, minSmoke, smokeCol,
    // smokeLife (s), smokeK, smokeStep (m), smokeMax (points) — f-flow: the options records are the engine's own, kept
    engine(key, pos, speed, o) {
      o = o || {};
      const lowFx = this.g.settings && (this.g.settings.preset === 'low' || this.g.settings.preset === 'potato');
      const thrust = o.thrust === undefined ? 1 : o.thrust;
      let e = this.eng.get(key);
      if (!e) { e = { kg: key + ':g', ks: key + ':s', og: { kind: 'glow', col: null, width: 0, life: 0, step: 0.3, k: 0, max: 40 }, os: { kind: 'smoke', col: null, width: 0, grow: 2, life: 0, step: 0, k: 0, max: 0 }, seen: 0 }; this.eng.set(key, e); }
      e.seen = this.time;
      const G = e.og, size = o.size || 0.8;
      G.col = o.col || ENGINE_COL; G.width = size * (0.9 + thrust * 0.45); G.life = 0.12 + Math.min(0.25, speed / 300) + thrust * 0.08; G.k = 0.3 + thrust * 0.5;
      this.emit(e.kg, pos[0], pos[1], pos[2], G);
      const minS = o.minSmoke || 10;
      if (speed > minS && !(lowFx && o.minor)) {
        const Sm = e.os;
        Sm.col = o.smokeCol || SMOKE_COL; Sm.width = size * 1.7; Sm.grow = 2;
        Sm.life = lowFx ? 2.2 : (o.smokeLife || 4.5);
        Sm.step = lowFx ? 1.6 : (o.smokeStep || 1.1); Sm.k = Math.min(1, (speed - minS) / 30) * (o.smokeK || 1); Sm.max = lowFx ? 40 : (o.smokeMax || 160);
        this.emit(e.ks, pos[0], pos[1], pos[2], Sm);
      }
    }
  }
  const ENGINE_COL = [0.45, 0.7, 1.0], SMOKE_COL = [0.92, 0.93, 0.95];
  // one vertex: pos3, age, side, intensity, w (seed | arc length), col3
  function put(buf, f, x, y, z, age, side, k, w, c0, c1, c2) { buf[f] = x; buf[f + 1] = y; buf[f + 2] = z; buf[f + 3] = age; buf[f + 4] = side; buf[f + 5] = k; buf[f + 6] = w; buf[f + 7] = c0; buf[f + 8] = c1; buf[f + 9] = c2; return f + 10; }
  // the ribbon's width at an age (0..1 of its life): ×(1 + grow) at the end — grow 2: ×3
  Trails.width = (w0, grow, age) => w0 * (1 + (grow || 0) * age);
  // the smoke's envelope at an age: it spreads as it widens (1 / (1 + grow·age)) and dies (1 − age)
  Trails.env = (age, grow) => (1 - age) / (1 + (grow || 0) * age);
  VR.Trails = Trails;
})(VR);

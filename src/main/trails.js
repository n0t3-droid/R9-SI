// ============================================================================
// Trails: glowing engine plumes and long smoke contrails behind ships, as in
// the trailer. Each trail is a short history of an engine's positions drawn as
// a camera-facing ribbon — one draw call for all glows (additive, feeds the
// bloom) and one for all smoke (soft, lit by the sky, fogged). Emitters just
// call emit(key, x, y, z, opts) every frame; trails nobody feeds fade away.
// ============================================================================
(function (VR) {
  'use strict';
  const S = VR.SHADERS;
  S.TRAIL_VS = `
layout(location=0) in vec3 a_pos;
layout(location=1) in vec4 a_info;   // age 0..1, side -1..1, intensity, seed
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
    // puffy contrail: breaks up along its length, fades as it ages, lit by the sky
    float n = vnoise(vec2(v_info.w * 3.0 + age * 23.0, side * 1.7)) * 0.6 + vnoise(vec2(age * 61.0 + v_info.w, side * 4.0)) * 0.4;
    float a = pow(1.0 - age, 1.3) * pow(edge, 0.8) * (0.55 + n * 0.7) * k * 0.8;
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

  class Trails {
    constructor(game) {
      this.g = game;
      this.map = new Map();
      this.time = 0;
      this.cap = 12000;             // vertices per kind
      this.buf = { g: new Float32Array(this.cap * 10), s: new Float32Array(this.cap * 10) };
      this.n = { g: 0, s: 0 };
    }
    // o: { kind: 'glow'|'smoke', col, width, life (s), step (m between points), k (intensity), grow }
    emit(key, x, y, z, o) {
      let t = this.map.get(key);
      if (!t) { t = { pts: [], head: [x, y, z], o, seed: Math.random() * 100, seen: 0 }; this.map.set(key, t); }
      t.o = o; t.seen = this.time; t.head[0] = x; t.head[1] = y; t.head[2] = z; t.headK = o.k === undefined ? 1 : o.k;
      const P = t.pts, L = P.length ? P[P.length - 1] : null;
      const step = o.step || 0.6;
      if (!L || (x - L[0]) ** 2 + (y - L[1]) ** 2 + (z - L[2]) ** 2 > step * step) {
        P.push([x, y, z, this.time, t.headK]);
        const max = o.max || 90;
        if (P.length > max) P.splice(0, P.length - max);
      }
    }
    update(dt) {
      this.time += dt;
      for (const [key, t] of this.map) {
        const life = t.o.life || 1, P = t.pts;
        let cut = 0; while (cut < P.length && this.time - P[cut][3] > life) cut++;
        if (cut) P.splice(0, cut);
        if (!P.length && this.time - t.seen > 0.2) this.map.delete(key);
      }
    }
    clear() { this.map.clear(); }
    // ribbons, camera-facing, written as triangles into the per-kind buffers
    build(cam) {
      this.n.g = 0; this.n.s = 0;
      const cx = cam.x, cy = cam.y, cz = cam.z, time = this.time;
      for (const t of this.map.values()) {
        const o = t.o, life = o.life || 1, P = t.pts;
        const kind = o.kind === 'smoke' ? 's' : 'g';
        const seq = P.slice();
        const fresh = this.time - t.seen < 0.1;
        if (fresh) seq.push([t.head[0], t.head[1], t.head[2], time, t.headK]);
        if (seq.length < 2) continue;
        const buf = this.buf[kind];
        const col = o.col || [1, 0.6, 0.3], w0 = o.width || 0.5, grow = o.grow || 0;
        let prevL = null, prevR = null, prevA = 0, prevK = 0;
        for (let i = 0; i < seq.length; i++) {
          const p = seq[i];
          const a = Math.min(1, (time - p[3]) / life);
          const q0 = seq[Math.max(0, i - 1)], q1 = seq[Math.min(seq.length - 1, i + 1)];
          let tx = q1[0] - q0[0], ty = q1[1] - q0[1], tz = q1[2] - q0[2];
          const vx = cx - p[0], vy = cy - p[1], vz = cz - p[2];
          let sx = ty * vz - tz * vy, sy = tz * vx - tx * vz, sz = tx * vy - ty * vx;
          const sl = Math.hypot(sx, sy, sz) || 1;
          const w = w0 * (1 + grow * a) * 0.5;
          sx = sx / sl * w; sy = sy / sl * w; sz = sz / sl * w;
          const L = [p[0] - cx - sx, p[1] - cy - sy, p[2] - cz - sz], Rr = [p[0] - cx + sx, p[1] - cy + sy, p[2] - cz + sz];
          if (prevL) {
            if (this.n[kind] + 6 > this.cap) break;
            let off = this.n[kind] * 10;
            const V = (P3, age, side, k) => { buf[off] = P3[0]; buf[off + 1] = P3[1]; buf[off + 2] = P3[2]; buf[off + 3] = age; buf[off + 4] = side; buf[off + 5] = k; buf[off + 6] = t.seed; buf[off + 7] = col[0]; buf[off + 8] = col[1]; buf[off + 9] = col[2]; off += 10; };
            const k1 = p[4], k0 = prevK;
            V(prevL, prevA, -1, k0); V(prevR, prevA, 1, k0); V(Rr, a, 1, k1);
            V(prevL, prevA, -1, k0); V(Rr, a, 1, k1); V(L, a, -1, k1);
            this.n[kind] += 6;
          }
          prevL = L; prevR = Rr; prevA = a; prevK = p[4];
        }
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
    // one call per engine: a hot plume and (when fast) a contrail
    engine(key, pos, speed, o) {
      o = o || {};
      const lowFx = this.g.settings && (this.g.settings.preset === 'low' || this.g.settings.preset === 'potato');
      const thrust = o.thrust === undefined ? 1 : o.thrust;
      this.emit(key + ':g', pos[0], pos[1], pos[2], { kind: 'glow', col: o.col || [0.45, 0.7, 1.0], width: (o.size || 0.8) * (0.9 + thrust * 0.45), life: 0.12 + Math.min(0.25, speed / 300) + thrust * 0.08, step: 0.3, k: 0.3 + thrust * 0.5, max: 40 });
      if (speed > (o.minSmoke || 10) && !(lowFx && o.minor)) this.emit(key + ':s', pos[0], pos[1], pos[2], { kind: 'smoke', col: o.smokeCol || [0.92, 0.93, 0.95], width: (o.size || 0.8) * 1.7, grow: 2.6, life: lowFx ? 2.2 : (o.smokeLife || 4.5), step: lowFx ? 1.6 : 1.1, k: Math.min(1, (speed - (o.minSmoke || 10)) / 30) * (o.smokeK || 1), max: lowFx ? 40 : 160 });
    }
  }
  VR.Trails = Trails;
})(VR);

// ============================================================================
// a-story5 · the story's soft lights in the world (story.js draws them while a scene plays, never outside one)
//   kind 0 · a glow: a soft round sprite (Echo's light, Flimmi, a newborn star, a lantern's halo)
//   kind 1 · a nebula wall: a huge soft sheet far out (hundreds of metres), its edge broken by our own value noise,
//            its core one colour, its rim another (Hα pink · violet · a teal rim round a hot young star)
//   kind 2 · a dust lane: the same sheet darkening what is behind it (multiplied, not added)
// Each one is a quad in the world (its broad side to where the camera stands — it keeps its place as the view turns,
// parallax as the camera moves); far ones are pushed just inside the far plane (never cut by it) and stay behind
// every solid thing on screen (the depth test). One small program, compiled at the first scene that needs it; one
// draw a light. Additive, no depth write, no fog. Very Low: story.js hands fewer lights; the switch: Einstellungen →
// Grafik → „Lichter der Geschichte" (storyLights).
// ============================================================================
(function (VR) {
  'use strict';
  const G = VR.StoryGlow = { stats: { draws: 0, ms: 0 } };
  const VS = `
layout(location=0) in vec2 a_c;
uniform mat4 u_vp;
uniform vec3 u_pos;
uniform vec3 u_ax;
uniform vec3 u_ay;
uniform float u_far;
out vec2 v_c;
void main() {
  v_c = a_c;
  gl_Position = u_vp * vec4(u_pos + u_ax * a_c.x + u_ay * a_c.y, 1.0);
  if (u_far > 0.5) gl_Position.z = min(gl_Position.z, gl_Position.w * 0.99999);
}`;
  const FS = `
in vec2 v_c;
uniform vec3 u_col;
uniform vec3 u_col2;
uniform float u_a;
uniform float u_kind;
uniform float u_seed;
out vec4 o;
float h2(vec2 p) { p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), f.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }
void main() {
  float r = length(v_c);
  if (u_kind < 0.5) {   // a glow
    float k = exp(-r * r * 4.5) * 0.75 + exp(-r * r * 42.0) * 0.9;
    k *= 1.0 - smoothstep(0.75, 1.0, r);
    o = vec4(u_col * k * u_a, 1.0);
    return;
  }
  vec2 q = v_c * 1.6 + vec2(u_seed * 7.13, u_seed * 3.71);
  float n = fbm(q + 0.6 * vec2(fbm(q * 0.7 + 3.1), fbm(q * 0.7 + 8.4)));   // (folded once: wisps, not blobs)
  float shape = 1.0 - smoothstep(0.3, 1.0, r + (n - 0.5) * 0.75);
  float fil = smoothstep(0.32, 0.8, n);
  if (u_kind < 1.5) {   // a wall of light: the rim's colour at the frayed edge, the core's inside
    vec3 c = mix(u_col2, u_col, smoothstep(0.15, 0.75, shape));
    float k = shape * (0.35 + 0.9 * fil) * u_a;
    o = vec4(c * k, 1.0);
  } else {              // dust: dark, frayed, multiplied over what is behind
    float k = shape * fil * u_a;
    o = vec4(vec3(k), 1.0);
  }
}`;
  let PR = null, VAO = null, failed = false;
  function prog(gl) {
    if (PR || failed) return PR;
    try {
      PR = VR.GL.program(VS, FS, 'story_glow', []);
      VAO = gl.createVertexArray(); gl.bindVertexArray(VAO);
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);
    } catch (e) { failed = true; PR = null; console.warn('story_glow', e && e.message); }
    return PR;
  }
  G.ok = () => !failed;
  // the quad's two axes: broad side to the camera, its own turn (rot) in that plane; out: [ax, ay] (6 numbers)
  const AX = new Float32Array(6);
  G.axes = function (rel, sx, sy, rot, out) {
    out = out || AX;
    let nx = -rel[0], ny = -rel[1], nz = -rel[2]; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    let rx = nz, rz = -nx; const rl = Math.hypot(rx, rz); if (rl < 1e-4) { rx = 1; rz = 0; } else { rx /= rl; rz /= rl; }
    const ux = ny * rz - nz * 0, uy = nz * rx - nx * rz, uz = nx * 0 - ny * rx;   // up = n × right
    const c = Math.cos(rot || 0), s = Math.sin(rot || 0);
    out[0] = (rx * c + ux * s) * sx; out[1] = (0 * c + uy * s) * sx; out[2] = (rz * c + uz * s) * sx;
    out[3] = (-rx * s + ux * c) * sy; out[4] = (-0 * s + uy * c) * sy; out[5] = (-rz * s + uz * c) * sy;
    return out;
  };
  // list: [{ p: [x, y, z] (world), s: [half width, half height], rot, col: [r, g, b], col2, a, kind (0 | 1 | 2), far, seed }]
  G.draw = function (r, cam, list) {
    if (!list || !list.length) return 0;
    const gl = r.gl, P = prog(gl); if (!P) return 0;
    const t0 = performance.now(), u = P.u;
    gl.useProgram(P.p); gl.uniformMatrix4fv(u.u_vp, false, r.viewProj);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.CULL_FACE); gl.enable(gl.BLEND);
    gl.bindVertexArray(VAO);
    const rel = [0, 0, 0]; let n = 0, mode = -1;
    for (const q of list) {
      if (!(q.a > 0.002)) continue;
      const m = q.kind === 2 ? 1 : 0;
      if (m !== mode) { mode = m; if (m) gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_COLOR); else gl.blendFunc(gl.ONE, gl.ONE); }
      rel[0] = q.p[0] - cam.x; rel[1] = q.p[1] - cam.y; rel[2] = q.p[2] - cam.z;
      const A = G.axes(rel, q.s[0], q.s[1], q.rot || 0);
      gl.uniform3f(u.u_pos, rel[0], rel[1], rel[2]); gl.uniform3f(u.u_ax, A[0], A[1], A[2]); gl.uniform3f(u.u_ay, A[3], A[4], A[5]);
      gl.uniform1f(u.u_far, q.far ? 1 : 0); gl.uniform1f(u.u_kind, q.kind || 0); gl.uniform1f(u.u_seed, q.seed || 0); gl.uniform1f(u.u_a, q.a);
      const c2 = q.col2 || q.col; gl.uniform3f(u.u_col, q.col[0], q.col[1], q.col[2]); gl.uniform3f(u.u_col2, c2[0], c2[1], c2[2]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); n++;
    }
    gl.bindVertexArray(null);
    gl.depthMask(true); gl.enable(gl.CULL_FACE); gl.disable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    G.stats.draws += n; G.stats.ms += performance.now() - t0;
    return n;
  };
})(VR);

// ============================================================================
// a-story6 · ch. 9's nebula from inside (plan docs/superpowers/plans/2026-10-31-a-story6.md) — the story's emotional
// peak: Flimmi, a star being born. While a ch.-9 scene plays, story.js hands the whole frame to this file:
//   the backdrop  one full-screen pass over every sky pixel (it never covers the land: drawn at the far plane behind
//                 the depth): deep indigo space, glowing gas (magenta and violet, gold and orange in the cavity the
//                 newborn star has blown round itself, teal at the edges), dark dust lanes rim-lit where they face it,
//                 radial light shafts from the star broken by the dust, newborn stars twinkling. In 9.1 the star is still
//                 hidden in its cocoon of dust (a dark globule with a golden rim, light leaking round it).
//   the layers   quads in the world (their broad side to the camera, so they keep their place and shift against each
//                 other as the camera moves — parallax): pillars of dust 260–560 m out rising from the land toward the
//                 star (dark bodies, a rim of gold-magenta on the side facing it), dark clouds 80–190 m out framing the
//                 picture, shafts of light from the star in front of the pillars, Flimmi itself (a white-hot core with a
//                 face, a warm body, a corona with slow streamers, a gentle breathing pulse, a turning twinkle) and the
//                 small motes circling it.
// Our own shapes and colours (value noise, no picture of a real nebula). Two small programs, compiled at the first
// scene that needs them; nothing drawn or compiled outside ch. 9's scenes. Quality: 0 Very Low (fewer octaves, no warp,
// 3 pillars, 2 clouds, no 3-D shafts) · 1 Low/Balanced · 2 High and up. The switch: storyLights (Grafik).
// ============================================================================
(function (VR) {
  'use strict';
  const SN = VR.StoryNeb = { stats: { draws: 0, ms: 0, frames: 0 }, off: false };
  const BG_VS = `
layout(location=0) in vec2 a_c;
out vec2 v_ndc;
void main() { v_ndc = a_c; gl_Position = vec4(a_c, 0.999999, 1.0); }`;
  const NOISE = `
float h3(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
float vn(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = h3(i), b = h3(i + vec3(1.0, 0.0, 0.0)), c = h3(i + vec3(0.0, 1.0, 0.0)), d = h3(i + vec3(1.0, 1.0, 0.0));
  float e = h3(i + vec3(0.0, 0.0, 1.0)), g = h3(i + vec3(1.0, 0.0, 1.0)), k = h3(i + vec3(0.0, 1.0, 1.0)), l = h3(i + vec3(1.0, 1.0, 1.0));
  return mix(mix(mix(a, b, f.x), mix(c, d, f.x), f.y), mix(mix(e, g, f.x), mix(k, l, f.x), f.y), f.z); }
float fbm(vec3 p, int n) { float s = 0.0, a = 0.5, t = 0.0; for (int i = 0; i < 6; i++) { if (i >= n) break; s += a * vn(p); t += a; p = p * 2.03 + vec3(1.7, 9.2, 3.3); a *= 0.5; } return s / t; }
`;
  const BG_FS = `
in vec2 v_ndc;
uniform mat4 u_ivp;
uniform vec3 u_fd;
uniform vec4 u_k;      // x the ease (0…1), y the cocoon (1: the star hidden in its globule), z time (s), w quality 0…2
uniform vec3 u_seed3;
out vec4 o;
` + NOISE + `
void main() {
  vec4 w4 = u_ivp * vec4(v_ndc, 1.0, 1.0);
  vec3 D = normalize(w4.xyz / w4.w), F = u_fd;
  int Q = int(u_k.w + 0.5);
  float th = acos(clamp(dot(D, F), -1.0, 1.0));
  vec3 X = normalize(cross(vec3(0.0, 1.0, 0.0), F)), Y = cross(F, X);
  float phi = atan(dot(D, Y), dot(D, X));
  vec3 P = D + u_seed3;
  vec3 wv = Q > 0 ? vec3(fbm(P * 1.3 + vec3(3.1, 0.0, 0.0), 2), fbm(P * 1.3 + vec3(0.0, 8.4, 0.0), 2), fbm(P * 1.3 + vec3(0.0, 0.0, 5.7), 2)) : vec3(0.5);
  float g = fbm(P * 1.5 + wv * 0.9, Q > 1 ? 5 : Q > 0 ? 4 : 3);
  float g2 = fbm(P * 1.1 + vec3(11.0, 2.0, 5.0), 2);
  float du = fbm(P * 2.0 + wv * 0.7 + vec3(7.0, 1.0, 4.0), Q > 1 ? 5 : Q > 0 ? 4 : 3);
  float hv = smoothstep(0.3, 0.7, vn(P * 1.2 + vec3(2.0, 7.0, 1.0)));
  float cav = exp(-th / 0.2), rose = exp(-th / 0.45);
  // the gas: magenta and violet, gold in the star's cavity, teal at the edges
  const vec3 MAG = vec3(0.85, 0.06, 0.30), GOLD = vec3(1.0, 0.55, 0.18), TEAL = vec3(0.04, 0.50, 0.62), VIO = vec3(0.30, 0.08, 0.55);
  vec3 mv = mix(MAG, VIO * 1.6, hv);
  vec3 ce = mix(mv, GOLD, smoothstep(0.05, 0.8, cav));
  float outer = smoothstep(0.35, 0.9, th) * smoothstep(0.42, 0.62, g2);
  ce = mix(ce, TEAL, outer);
  float gas = 0.12 + 0.88 * pow(smoothstep(0.25, 0.85, g), 2.0);
  vec3 col = vec3(0.012, 0.010, 0.035) + vec3(0.0, 0.02, 0.025) * smoothstep(0.3, -0.1, D.y);
  col += ce * gas * (0.05 + 0.45 * rose + 1.8 * cav + 0.5 * exp(-abs(D.y - 0.22) / 0.16));   // (a glowing wall behind the pillars)
  // the dust: dark lanes (thicker toward the land), rim-lit at their edge, thinned in the cavity
  float dk = clamp(smoothstep(0.42, 0.66, du) * (1.0 - 0.7 * cav) + 0.8 * smoothstep(0.02, -0.15, D.y), 0.0, 1.0);
  float rim = (smoothstep(0.45, 0.48, du) - smoothstep(0.48, 0.53, du)) * (0.03 + 0.35 * rose + 3.0 * cav);
  col = col * (1.0 - 0.94 * dk) + vec3(0.012, 0.03, 0.04) * dk + mix(MAG, GOLD, smoothstep(0.0, 0.6, cav)) * rim * 0.6;
  // the shafts from the star, broken by the dust
  float sh = pow(vn(vec3(cos(phi) * 9.0, sin(phi) * 9.0, 0.3 + u_k.z * 0.02)), 4.0) * exp(-th / 0.4) * smoothstep(0.03, 0.12, th) * 0.6;
  col += GOLD * sh * (1.0 - 0.6 * dk) * (Q > 0 ? 1.0 : 0.7);
  // newborn stars, twinkling (fewer behind the dust)
  vec3 cell = floor(D * 260.0); float hs = h3(cell + 0.5);
  if (hs > 0.998) col += vec3(1.0, 0.94, 1.0) * (1.0 - dk) * (0.9 + 0.6 * sin(u_k.z * (1.5 + 3.0 * h3(cell + 3.1)) + hs * 60.0));
  // the cocoon (9.1): a dark globule hiding the star, its rim golden, the light leaking round it
  if (u_k.y > 0.0) {
    float tn = th + (vn(D * 40.0) - 0.5) * 0.02;
    float glob = 1.0 - smoothstep(0.07, 0.1, tn);
    float gr = smoothstep(0.05, 0.088, tn) * glob;
    col = mix(col, vec3(0.02, 0.012, 0.03) + GOLD * gr * 2.4, glob * u_k.y) + GOLD * exp(-th / 0.12) * 0.35 * u_k.y;
  } else col += vec3(1.0, 0.7, 0.4) * exp(-th / 0.03) * 0.6;   // (the star's own glow in the gas round it)
  o = vec4(col * u_k.x, u_k.x);
}`;
  const L_VS = `
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
  const L_FS = `
in vec2 v_c;
uniform vec3 u_col;    // the light's colour (a rim, a shaft, a glow)
uniform vec3 u_col2;   // the body's colour (dust)
uniform vec4 u_p;      // x alpha, y kind (3 pillar · 4 cloud · 5 Flimmi · 6 a soft glow · 7 a shaft), z seed, w time
uniform vec2 u_ld;     // toward the light, in the quad's own axes
uniform float u_face;  // Flimmi's face (0…1) and its blink
out vec4 o;
float h2(vec2 p) { p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
float vn2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), f.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), f.x), f.y); }
float fb2(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vn2(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s / 0.9375; }
float pillar(vec2 c, float sd) {
  float n = fb2(vec2(c.y * 2.2 + sd, sd * 1.7)), n2 = fb2(c * vec2(5.0, 3.0) + sd * 3.1);
  float bend = 0.16 * sin(c.y * 1.6 + sd * 2.0);
  float wd = (0.36 - 0.07 * (c.y + 1.0)) * (0.75 + 0.5 * n);
  float ax = abs(c.x - bend) / wd;
  float s = 1.0 - smoothstep(0.8, 1.0, ax + (n2 - 0.5) * 0.55);
  float tipY = 0.72 + 0.12 * (n - 0.5) - 0.35 * pow(clamp(ax, 0.0, 1.0), 2.0);
  s *= 1.0 - smoothstep(tipY - 0.06, tipY + 0.04, c.y + (n2 - 0.5) * 0.12);
  return s * smoothstep(-1.0, -0.55, c.y);
}
float cloud(vec2 c, float sd) {
  vec2 q = c * 1.4 + sd * vec2(7.13, 3.71);
  float n = fb2(q + 0.6 * vec2(fb2(q * 0.7 + 3.1), fb2(q * 0.7 + 8.4)));
  return 1.0 - smoothstep(0.6, 0.78, length(c) + (n - 0.5) * 0.9);
}
void main() {
  float k = u_p.y, a = u_p.x, sd = u_p.z, t = u_p.w, r = length(v_c);
  if (k < 4.5) {   // dust: a pillar or a cloud — a dark body, its rim lit where it faces the light
    bool pl = k < 3.5;
    float s = pl ? pillar(v_c, sd) : cloud(v_c, sd);
    if (s < 0.004) discard;
    float s2 = pl ? pillar(v_c + u_ld * 0.07, sd) : cloud(v_c + u_ld * 0.07, sd);
    float rim = s * (1.0 - s2) * (pl ? 0.12 + 0.88 * smoothstep(0.0, 0.65, v_c.y) : 0.05);
    vec3 body = u_col2 * (0.7 + 0.6 * vn2(v_c * 6.0 + sd)) + u_col * 0.05 * smoothstep(0.0, 1.0, dot(v_c, u_ld));
    o = vec4((body * s + u_col * rim * 2.2) * a, s * a);
    return;
  }
  if (k < 5.5) {   // Flimmi
    float pu = 1.0 + 0.06 * sin(t * 2.1), rr = r / pu, an = atan(v_c.y, v_c.x);
    vec3 c = vec3(1.0, 0.97, 0.9) * exp(-rr * rr * 90.0) * 7.0 + vec3(1.0, 0.78, 0.40) * exp(-rr * 9.0) * 2.0 + vec3(1.0, 0.50, 0.22) * exp(-rr * 3.2) * 0.45;
    float st = vn2(vec2(cos(an), sin(an)) * 2.5 + vec2(t * 0.15, rr * 2.0 - t * 0.4));
    c += vec3(1.0, 0.6, 0.3) * pow(st, 3.0) * exp(-rr * 2.6) * 1.4 * smoothstep(0.08, 0.2, rr);   // (the corona's slow streamers)
    float ca = cos(t * 0.1), sa = sin(t * 0.1); vec2 q = mat2(ca, -sa, sa, ca) * v_c;
    c += vec3(1.0, 0.9, 0.7) * (exp(-abs(q.x) * 90.0) * exp(-abs(q.y) * 3.5) + exp(-abs(q.y) * 90.0) * exp(-abs(q.x) * 3.5)) * 1.2;   // (a gentle twinkle, turning)
    c *= 1.0 - smoothstep(0.85, 1.0, r);
    // the face: two eyes that blink now and then, a small smile
    float bl = 0.08 + 0.92 * smoothstep(0.0, 0.04, abs(fract(t * 0.27 + 0.3) - 0.5) - 0.02);
    vec2 e1 = (v_c - vec2(-0.052, 0.018)) * vec2(1.0, 1.0 / bl), e2 = (v_c - vec2(0.052, 0.018)) * vec2(1.0, 1.0 / bl);
    float eye = max(1.0 - smoothstep(0.017, 0.025, length(e1 * vec2(1.25, 0.8))), 1.0 - smoothstep(0.017, 0.025, length(e2 * vec2(1.25, 0.8))));
    float mo = (1.0 - smoothstep(0.004, 0.008, abs(length(v_c - vec2(0.0, 0.03)) - 0.058))) * step(v_c.y, -0.012) * step(abs(v_c.x), 0.034);
    float fa = max(eye, mo * 0.85) * u_face;
    o = vec4(c * a * (1.0 - fa) + vec3(0.32, 0.12, 0.03) * fa, fa);
    return;
  }
  if (k < 6.5) {   // a soft glow (the motes round Flimmi)
    float g = exp(-r * r * 6.0) * 0.6 + exp(-r * r * 60.0) * 1.2;
    o = vec4(u_col * g * a * (1.0 - smoothstep(0.7, 1.0, r)), 0.0);
    return;
  }
  // a shaft of light: narrow across, from the star (y = −1) fading outward
  float g = exp(-v_c.x * v_c.x * 14.0) * smoothstep(-1.0, -0.8, v_c.y) * (1.0 - smoothstep(-0.3, 1.0, v_c.y)) * (0.75 + 0.25 * sin(t * 0.7 + sd * 3.0));
  o = vec4(u_col * g * a, 0.0);
}`;
  let BG = null, LP = null, VAO = null, failed = false;
  function progs(gl) {
    if (failed) return false;
    if (BG && LP) return true;
    try {
      BG = VR.GL.program(BG_VS, BG_FS, 'story_neb_bg', []);
      LP = VR.GL.program(L_VS, L_FS, 'story_neb_layer', []);
      VAO = gl.createVertexArray(); gl.bindVertexArray(VAO);
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);
    } catch (e) { failed = true; BG = LP = null; console.warn('story_neb', e && e.message); }
    return !failed;
  }
  SN.ok = () => !failed;
  SN.compiled = () => !!(BG && LP);

  // ---------------------------------------------------------------- the pure part (test/story8_part.js)
  const r6 = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
  const smooth = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  const nrm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  SN.quality = (preset) => (preset === 'potato' ? 0 : preset === 'high' || preset === 'ultra' ? 2 : 1);
  // the quad's own axes as story_glow.js makes them (broad side to the camera), its turn chosen so its +y points along
  // `tan` (a direction in the world), and the light's direction `toL` in those axes → { rot, ld: [x, y] }
  const frame = (rel) => {
    const n = nrm([-rel[0], -rel[1], -rel[2]]);
    let rx = n[2], rz = -n[0]; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
    return { R: [rx, 0, rz], U: [n[1] * rz, n[2] * rx - n[0] * rz, -n[1] * rx] };
  };
  SN.ldFor = function (rel, rot, toL) {
    const { R, U } = frame(rel), c = Math.cos(rot), s = Math.sin(rot);
    const AX = [R[0] * c + U[0] * s, R[1] * c + U[1] * s, R[2] * c + U[2] * s], AY = [-R[0] * s + U[0] * c, -R[1] * s + U[1] * c, -R[2] * s + U[2] * c];
    let lx = toL ? dot(toL, AX) : 0, ly = toL ? dot(toL, AY) : 1; const ll = Math.hypot(lx, ly) || 1;
    return [lx / ll, ly / ll];
  };
  SN.aim = function (rel, tan, toL) {
    const { R, U } = frame(rel), rot = Math.atan2(-dot(tan, R), dot(tan, U));
    return { rot, ld: SN.ldFor(rel, rot, toL), R, U };
  };
  // the layers of a ch.-9 scene: e the eye (scene's start), y0 its yaw, F0 where Flimmi shines (sc.tg.sky), t the scene's
  // time, id the beat, q the quality → [{ p, s: [hx, hy], rot, kind, a, col, col2, ld, seed, far, face }]
  SN.layers = function (e, y0, F0, t, id, q) {
    const out = [], FD = nrm([F0[0] - e[0], F0[1] - e[1], F0[2] - e[2]]), k = smooth(t / 1.2);
    const faz = Math.atan2(-FD[0], -FD[2]), fel = Math.asin(Math.max(-1, Math.min(1, FD[1])));
    const dirA = (az, el) => [-Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)];
    const shine = id !== 'c9.b1';   // (9.1: the star still in its cocoon)
    const GOLDR = [1.7, 0.75, 0.28], MAGR = [1.5, 0.28, 0.55];
    // the pillars: from the land up toward the star, on both sides of it
    const nP = q === 0 ? 3 : 5;
    for (let i = 0; i < nP; i++) {
      // (base below the horizon, its tip partway up toward the star and leaning to it: massive, a third as wide as tall)
      const side = i % 2 ? 1 : -1, D = 300 + 260 * r6(i, 2), azB = faz + side * (0.3 + 0.45 * r6(i, 1)), azT = faz + side * (0.16 + 0.24 * r6(i, 1));
      const B = dirA(azB, -0.12), T = dirA(azT, fel * (0.62 + 0.2 * r6(i, 3)));
      const P0 = [e[0] + B[0] * D, e[1] + B[1] * D, e[2] + B[2] * D], P1 = [e[0] + T[0] * D, e[1] + T[1] * D, e[2] + T[2] * D];
      const C = [(P0[0] + P1[0]) / 2, (P0[1] + P1[1]) / 2, (P0[2] + P1[2]) / 2], ax0 = nrm([P1[0] - P0[0], P1[1] - P0[1], P1[2] - P0[2]]);
      const H = Math.hypot(P1[0] - P0[0], P1[1] - P0[1], P1[2] - P0[2]) / 2 * 1.12, Wd = H * (0.62 + 0.25 * r6(i, 4));
      const rel = [C[0] - e[0], C[1] - e[1], C[2] - e[2]], am = SN.aim(rel, ax0, ax0);
      out.push({ p: C, s: [Wd, H], rot: am.rot, ld: am.ld, kind: 3, a: k, col: i < 2 ? GOLDR : MAGR, col2: [0.016, 0.014, 0.04], seed: 1.3 + i * 2.71, far: true });
    }
    // the near clouds: dark masses framing the picture (never over the star: ≥ 22° from it)
    const nC = q === 0 ? 2 : 4;
    for (let i = 0; i < nC; i++) {
      const side = i % 2 ? 1 : -1, az = faz + side * (i < 2 ? 0.22 + 0.3 * r6(i, 7) : 0.75 + 0.3 * r6(i, 7)), el = i < 2 ? 0.02 + 0.1 * r6(i, 8) : fel + 0.25 + 0.1 * r6(i, 8), D = 80 + 110 * r6(i, 9);
      const d = dirA(az, el), C = [e[0] + d[0] * D, e[1] + d[1] * D, e[2] + d[2] * D], rel = [C[0] - e[0], C[1] - e[1], C[2] - e[2]];
      const toF = nrm([FD[0] - d[0], FD[1] - d[1], FD[2] - d[2]]), rot = (r6(i, 12) - 0.5) * 0.5, sx = D * (0.55 + 0.3 * r6(i, 10));
      out.push({ p: C, s: [sx, sx * (0.45 + 0.25 * r6(i, 11))], rot, ld: SN.ldFor(rel, rot, toF), kind: 4, a: 0.92 * k, col: MAGR.map(v => v * 0.7), col2: [0.012, 0.03, 0.038], seed: 5.1 + i * 1.93, far: true });
    }
    // the shafts in front of the pillars (High and Balanced): from the star outward between them
    if (q > 0 && shine) {
      const nS = q > 1 ? 6 : 4, Fr = [F0[0] - e[0], F0[1] - e[1], F0[2] - e[2]], fd = Math.hypot(Fr[0], Fr[1], Fr[2]);
      for (let i = 0; i < nS; i++) {
        const ang = (i / nS) * Math.PI * 2 + 0.4 + 0.3 * r6(i, 14), L = fd * (0.9 + 0.7 * r6(i, 15));
        const { R, U } = frame(Fr);   // (the star's own screen axes: the shafts fan out in that plane)
        const dd = [R[0] * Math.cos(ang) + U[0] * Math.sin(ang), R[1] * Math.cos(ang) + U[1] * Math.sin(ang), R[2] * Math.cos(ang) + U[2] * Math.sin(ang)];
        const C = [F0[0] + dd[0] * L, F0[1] + dd[1] * L, F0[2] + dd[2] * L], rel = [C[0] - e[0], C[1] - e[1], C[2] - e[2]], am = SN.aim(rel, dd, null);
        out.push({ p: C, s: [fd * (0.16 + 0.1 * r6(i, 16)), L], rot: am.rot, ld: [0, 1], kind: 7, a: 0.07 * k * (0.6 + 0.4 * r6(i, 17)), col: [1.0, 0.62, 0.3], seed: i * 1.1, far: false });
      }
    }
    if (shine) {
      // Flimmi: its body, a face, the motes circling it
      const fd = Math.hypot(F0[0] - e[0], F0[1] - e[1], F0[2] - e[2]), R = fd * 0.3;
      for (let i = 0; i < (q === 0 ? 3 : 5); i++) {
        const a = t * (0.5 + 0.2 * r6(i, 18)) + i * 2.4, rr = R * (0.55 + 0.25 * r6(i, 19));
        out.push({ p: [F0[0] + Math.cos(a) * rr, F0[1] + Math.sin(a * 0.7 + i) * rr * 0.35, F0[2] + Math.sin(a) * rr], s: [R * 0.08, R * 0.08], kind: 6, a: k * (0.7 + 0.3 * Math.sin(t * 3 + i)), col: [1.0, 0.8, 0.45], seed: i, far: false });
      }
      out.push({ p: F0, s: [R, R], kind: 5, a: k * (0.9 + 0.1 * Math.sin(t * 7) * Math.sin(t * 2.3)), col: [1, 1, 1], seed: 0, far: false, face: smooth((t - 0.6) / 1.0) });
    }
    return out;
  };

  // ---------------------------------------------------------------- the GL part
  const CAM = [0, 0, 0];
  // r the renderer, cam its camera, o { e, y0, F0, t, id, q, seed }
  SN.draw = function (r, cam, o) {
    const gl = r.gl; if (!progs(gl) || !r.invVPNJ) return 0;
    const t0 = performance.now(); let n = 0;
    CAM[0] = cam.x; CAM[1] = cam.y; CAM[2] = cam.z;
    const FD = nrm([o.F0[0] - cam.x, o.F0[1] - cam.y, o.F0[2] - cam.z]);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.CULL_FACE); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(VAO);
    // the backdrop over every sky pixel
    { const u = BG.u; gl.useProgram(BG.p); gl.uniformMatrix4fv(u.u_ivp, false, r.invVPNJ); gl.uniform3f(u.u_fd, FD[0], FD[1], FD[2]);
      gl.uniform4f(u.u_k, smooth(o.t / 1.2), o.id === 'c9.b1' ? 1 : 0, o.t, o.q); gl.uniform3f(u.u_seed3, o.seed || 0.37, 1.91, 4.2);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); n++; }
    // the layers
    const L = SN.layers(o.e, o.y0, o.F0, o.t, o.id, o.q), u = LP.u, rel = [0, 0, 0], G = VR.StoryGlow;
    gl.useProgram(LP.p); gl.uniformMatrix4fv(u.u_vp, false, r.viewProj);
    for (const q of L) {
      if (!(q.a > 0.002)) continue;
      rel[0] = q.p[0] - cam.x; rel[1] = q.p[1] - cam.y; rel[2] = q.p[2] - cam.z;
      const A = G.axes(rel, q.s[0], q.s[1], q.rot || 0);
      gl.uniform3f(u.u_pos, rel[0], rel[1], rel[2]); gl.uniform3f(u.u_ax, A[0], A[1], A[2]); gl.uniform3f(u.u_ay, A[3], A[4], A[5]);
      gl.uniform1f(u.u_far, q.far ? 1 : 0); gl.uniform4f(u.u_p, q.a, q.kind, q.seed || 0, o.t);
      const ld = q.ld || [0, 1]; gl.uniform2f(u.u_ld, ld[0], ld[1]); gl.uniform1f(u.u_face, q.face || 0);
      const c = q.col || [1, 1, 1], c2 = q.col2 || c; gl.uniform3f(u.u_col, c[0], c[1], c[2]); gl.uniform3f(u.u_col2, c2[0], c2[1], c2[2]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); n++;
    }
    gl.bindVertexArray(null);
    gl.depthMask(true); gl.enable(gl.CULL_FACE); gl.disable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    SN.stats.draws += n; SN.stats.ms += performance.now() - t0; SN.stats.frames++;
    return n;
  };
})(VR);

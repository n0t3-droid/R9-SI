// ============================================================================
// Water waves (shared, F7 · Wasser): three Gerstner-like octaves that the surface shader evaluates per pixel, the
// same functions on the CPU (the bob of a swimming player, the tests), and the matrices of the planar reflection
// (a mirror about the water plane and Lengyel's oblique near plane, which clips whatever lies under the water).
// Everything here is our own table and our own formulas: a sum of sines with a crest-sharpening normal term.
// ============================================================================
(function (VR) {
  'use strict';
  const TAU = Math.PI * 2;
  // the octaves: wavelength in blocks, height in blocks at full body strength, crest sharpness 0..1, and the turn of
  // the wave's direction from the wind (radians). The long swell follows the wind, the short chop turns off it.
  const OCT = [
    { lam: 9.0, amp: 0.10, sharp: 0.35, turn: 0.0 },
    { lam: 4.2, amp: 0.045, sharp: 0.45, turn: 0.62 },
    { lam: 1.9, amp: 0.016, sharp: 0.30, turn: -0.9 },
  ];
  const G = 2.2;        // phase speed c = sqrt(G / k): the swell moves about 1.4 blocks a second
  const QK = 0.2;       // crest sharpening: Q·k·A at full body strength, per octave, scaled by sharp
  const SHORE = 0.5, DEEP = 6.0;   // shoaling: waves flatten between 0.5 blocks of water (shore) and 6 blocks (open)
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const oct = OCT.map((o) => {
    const k = TAU / o.lam;
    return { k, w: Math.sqrt(G * k), A: o.amp, q: o.sharp * QK, c: Math.cos(o.turn), s: Math.sin(o.turn) };
  });

  // body strength 0..1 from the depth of the water below the surface (a pond stays calm, the sea rolls); the body
  // size is read from the depth: a shallow pond is shallow all over, the open sea is deep
  const bodyK = (depth) => { const x = clamp((depth - SHORE) / (DEEP - SHORE), 0, 1); return x * x * (3 - 2 * x); };
  // the air: calm weather 1, a storm (wind 3) about 1.8; bounded
  const stormK = (wind) => clamp(0.6 + 0.4 * (wind === undefined ? 1 : wind), 0.6, 2.2);
  // the amplitude factor of a pixel: body strength times storm
  const ampK = (depth, wind) => bodyK(depth) * stormK(wind);
  // the largest height the surface can reach at this factor
  const maxAmplitude = (ak) => { let s = 0; for (const o of OCT) s += o.amp * ak; return s; };

  // the surface at (x, z) and time t, with the wind heading (wx, wz) as a unit vector. Returns the height, the
  // height's gradient (gx, gz) and the normal (nx, ny, nz), which is unit length and points up.
  function sample(x, z, t, wx, wz, ak) {
    let h = 0, gx = 0, gz = 0, sy = 0;
    for (let i = 0; i < oct.length; i++) {
      const o = oct[i];
      const dx = wx * o.c - wz * o.s, dz = wx * o.s + wz * o.c;
      const th = o.k * (dx * x + dz * z) - o.w * t;
      const sn = Math.sin(th), cs = Math.cos(th);
      const A = o.A * ak;
      h += A * sn;
      gx += A * o.k * dx * cs;
      gz += A * o.k * dz * cs;
      sy += o.q * ak * sn;
    }
    const nx = -gx, ny = 1 - sy, nz = -gz;
    const l = Math.hypot(nx, ny, nz);
    return { h, gx, gz, nx: nx / l, ny: ny / l, nz: nz / l };
  }

  // the same functions as GLSL, generated from the same table (the surface shader includes this text)
  function glsl() {
    const f = (v) => v.toFixed(5);
    const arr = (name, type, vals) => `const ${type} ${name}[3] = ${type}[3](${vals.join(', ')});`;
    return `
// --- water waves (generated from src/shared/water_wave.js: the same table on the CPU and in the shader)
${arr('WV_K', 'float', oct.map((o) => f(o.k)))}
${arr('WV_W', 'float', oct.map((o) => f(o.w)))}
${arr('WV_A', 'float', oct.map((o) => f(o.A)))}
${arr('WV_Q', 'float', oct.map((o) => f(o.q)))}
const vec2 WV_T[3] = vec2[3](${oct.map((o) => `vec2(${f(o.c)}, ${f(o.s)})`).join(', ')});
float waterBody(float d) { float x = clamp((d - ${f(SHORE)}) / ${f(DEEP - SHORE)}, 0.0, 1.0); return x * x * (3.0 - 2.0 * x); }
float stormK(float w) { return clamp(0.6 + 0.4 * w, 0.6, 2.2); }
// the normal of the surface at p (the wind heading in 'wind', the amplitude factor 'ak'); h receives the height
vec3 gerstnerN(vec2 p, float t, vec2 wind, float ak, out float h) {
  float gx = 0.0, gz = 0.0, sy = 0.0;
  h = 0.0;
  for (int i = 0; i < 3; i++) {
    vec2 d = vec2(wind.x * WV_T[i].x - wind.y * WV_T[i].y, wind.x * WV_T[i].y + wind.y * WV_T[i].x);
    float th = WV_K[i] * dot(d, p) - WV_W[i] * t;
    float sn = sin(th), cs = cos(th);
    float A = WV_A[i] * ak;
    h += A * sn;
    gx += A * WV_K[i] * d.x * cs;
    gz += A * WV_K[i] * d.y * cs;
    sy += WV_Q[i] * ak * sn;
  }
  return normalize(vec3(-gx, 1.0 - sy, -gz));
}
`;
  }

  // ---- the planar reflection (column-major 4×4 matrices, as VR.mat4 keeps them)
  // the mirror about the plane y = d (camera-relative): (x, y, z) → (x, 2d − y, z)
  function mirrorY(out, d) {
    out.set([1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1, 0, 0, 2 * d, 0, 1]);
    return out;
  }
  // the reflection plane as a clip plane in view space: c·v > 0 is the side that is kept (above the water, which is
  // the side the mirrored camera sees). V is the view matrix (rotation only, camera at the origin).
  function planeInView(out, V, d) {
    out[0] = -V[4]; out[1] = -V[5]; out[2] = -V[6]; out[3] = d;
    return out;
  }
  // Lengyel's oblique view frustum: the near plane of the projection P becomes the clip plane c (view space), so
  // nothing on the far side of it is rasterised. Only the third row of P changes.
  function obliqueProj(out, P, c, mat4) {
    const M4 = mat4 || VR.mat4;
    const inv = M4.invert(M4.create(), P);
    const sx = c[0] < 0 ? -1 : 1, sy = c[1] < 0 ? -1 : 1;
    const q = [0, 0, 0, 0];
    const v = [sx, sy, 1, 1];
    for (let r = 0; r < 4; r++) q[r] = inv[r] * v[0] + inv[4 + r] * v[1] + inv[8 + r] * v[2] + inv[12 + r] * v[3];
    const cq = c[0] * q[0] + c[1] * q[1] + c[2] * q[2] + c[3] * q[3];
    const s = 2 / cq;
    out.set(P);
    for (let col = 0; col < 4; col++) out[col * 4 + 2] = c[col] * s - P[col * 4 + 3];
    return out;
  }

  const WaterWave = VR.WaterWave = { OCT, G, QK, SHORE, DEEP, bodyK, stormK, ampK, maxAmplitude, sample, glsl, mirrorY, planeInView, obliqueProj };

})(VR);

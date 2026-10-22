// ============================================================================
// u-space0 · the space scene's own GLSL (VR.SpaceShaders; shaders.js stays t-sky3's). Six programs, all drawn into the
// renderer's HDR scene buffer in linear light (a white Lambert surface lit head-on = 1), painter's order, premultiplied
// alpha (ONE, ONE_MINUS_SRC_ALPHA); the composite's exposure, tone curve and saturation make the picture.
//   bg     the full-screen background: one star grid on a cube (two from tier 2), the galaxy band, Helia's disc
//   herz   Herzwelt: the ground from the globe texture and the patch round the nadir, clouds and their shadows, the
//          sunglint, the air (Rayleigh + Mie + ozone of REFERENCE §2.1 at Earth's optical depths — U§3: the limb is
//          1.6 % R as on Earth), the limb from the Chapman tangent column, the night lights, the airglow, Amarant's light
//   giant  Amarant: the oblate ellipsoid, the bands with their zonal flow, limb darkening, the ring's shadow, a hazy rim
//   ring   the annulus in Amarant's equator plane: single scattering of a slab (lit face / unlit face), the planet's
//          shadow, Amarant's light on it, hidden where the planet stands in front
//   moon   the moons: Lommel–Seeliger for the airless, Lambert and a thin limb for those with air, the parent's light on
//          the night side, Zinnober's glowing lava, Aquamarin's glint
//   glare  Helia's glow over everything, scaled by how much of the disc is free (on Very Low it is the whole bloom)
// The quads: the vertex shader puts a square round the body's centre direction at unit distance, `u_half` = the tangent
// of its half-angle (0: the full-screen triangle, for the body under the camera). The ray–sphere test runs in the
// impostor frame (u, v, centre) where |q| = d·√(u² + v²) keeps a body 10⁵ radii away round (spacescene.js SS.math).
// ============================================================================
(function (VR) {
  'use strict';
  const SH = VR.SpaceShaders = {};

  const COMMON = `
const float PI = 3.14159265;
const float TAU2 = 6.2831853;
float hash13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
vec3 hash33(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
float vnoise3(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = hash13(i), b = hash13(i + vec3(1.0, 0.0, 0.0)), c = hash13(i + vec3(0.0, 1.0, 0.0)), d = hash13(i + vec3(1.0, 1.0, 0.0));
  float e = hash13(i + vec3(0.0, 0.0, 1.0)), g = hash13(i + vec3(1.0, 0.0, 1.0)), h = hash13(i + vec3(0.0, 1.0, 1.0)), k = hash13(i + vec3(1.0, 1.0, 1.0));
  return mix(mix(mix(a, b, f.x), mix(c, d, f.x), f.y), mix(mix(e, g, f.x), mix(h, k, f.x), f.y), f.z);
}
// an equirect texture read with the gradients of the side of the seam it is not on (no mip line at λ = ±π)
vec4 texEq(sampler2D t, vec2 uv) {
  vec2 dx = dFdx(uv), dy = dFdy(uv);
  vec2 u2 = vec2(fract(uv.x + 0.5), uv.y);
  vec2 dx2 = dFdx(u2), dy2 = dFdy(u2);
  if (dot(dx2, dx2) + dot(dy2, dy2) < dot(dx, dx) + dot(dy, dy)) { dx = dx2; dy = dy2; }
  return textureGrad(t, uv, dx, dy);
}
// the unit normal (body frame, y the axis) → equirect uv (λ east-positive from the prime meridian, θ from the north pole)
vec2 eqUV(vec3 N) { return vec2(atan(-N.z, N.x) / TAU2 + 0.5, acos(clamp(N.y, -1.0, 1.0)) / PI); }
// a noise octave below the texel, faded out where its cells get smaller than a pixel (no shimmer)
float detailN(vec3 N, float k) { float fw = length(fwidth(N)) * k; return (vnoise3(N * k) - 0.5) * (1.0 - smoothstep(0.3, 0.9, fw)); }
`;

  // the air of a world with Earth's optical depths (REFERENCE §2.1), lengths in planet radii (U§3: the same columns)
  const AIR = `
const float HR = 0.001256;            // Rayleigh scale height 8 km / 6371 km
const float HM = 0.000188;            // Mie 1.2 km
const float ATOP = 0.0157;            // the air's top, 100 km (1.6 % R)
const vec3 TAU_R = vec3(0.056, 0.136, 0.266);   // Rayleigh + ozone, zenith (extinction)
const vec3 SCAT_R = vec3(0.82, 0.79, 0.996);    // the scattered part of it (ozone absorbs)
const float TAU_M = 0.005;            // aerosol (Mie) zenith extinction, single-scattering albedo 0.9
const float KT_R = 70.7;              // the tangent column over the zenith column, √(2π/H)
const float KT_M = 182.8;
const vec3 AG_COL = vec3(0.32, 1.0, 0.5);   // the airglow's green (O 557.7 nm)
float phaseR(float c) { return 0.75 * (1.0 + c * c); }
float phaseM(float c) { const float g = 0.76; float d = 1.0 + g * g - 2.0 * g * c; return (1.0 - g * g) / (d * sqrt(d)); }
float airmass(float mu) { mu = max(mu, 0.0); return 1.0 / (mu + 0.025 * exp(-11.0 * mu)); }
// the sunlight reaching altitude h with the sun's zenith cosine mu there: the dipped horizon, the planet's shadow
vec3 sunTrans(float h, float mu) {
  float m = mu + sqrt(max(2.0 * h, 0.0));
  float lit = smoothstep(-0.005, 0.005, m);
  float am = airmass(m);
  return exp(-(TAU_R * exp(-h / HR) + TAU_M * exp(-h / HM)) * am) * lit;
}
`;

  // ---------------------------------------------------------------- vertex shaders
  const QUAD_VS = `
uniform mat4 u_viewProj;
uniform mat4 u_invViewProj;
uniform vec3 u_cdir;
uniform vec3 u_bu;
uniform vec3 u_bv;
uniform float u_half;
out vec3 v_dir;
void main() {
  int id = gl_VertexID;
  if (u_half <= 0.0) {
    vec2 p = vec2(float((id << 1) & 2), float(id & 2)) * 2.0 - 1.0;
    vec4 w = u_invViewProj * vec4(p, 1.0, 1.0);
    v_dir = w.xyz / w.w;
    gl_Position = vec4(p, 0.5, 1.0);
    return;
  }
  const vec2 C[6] = vec2[6](vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(1.0, 1.0), vec2(-1.0, -1.0), vec2(1.0, 1.0), vec2(-1.0, 1.0));
  vec2 c = C[id];
  vec3 pos = u_cdir + (u_bu * c.x + u_bv * c.y) * u_half;
  v_dir = pos;
  gl_Position = u_viewProj * vec4(pos, 1.0);
}`;
  // the ring's square in Amarant's equator plane (corner = centre ± a ± b, all scaled to about unit distance)
  const RING_VS = `
uniform mat4 u_viewProj;
uniform vec3 u_rc;
uniform vec3 u_ra;
uniform vec3 u_rb;
out vec3 v_dir;
void main() {
  const vec2 C[6] = vec2[6](vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(1.0, 1.0), vec2(-1.0, -1.0), vec2(1.0, 1.0), vec2(-1.0, 1.0));
  vec2 c = C[gl_VertexID];
  vec3 pos = u_rc + u_ra * c.x + u_rb * c.y;
  v_dir = pos;
  gl_Position = u_viewProj * vec4(pos, 1.0);
}`;

  // ---------------------------------------------------------------- the background
  const BG_FS = `
${COMMON}
uniform vec3 u_sunDir;     // Helia (session frame)
uniform vec3 u_sunCol;
uniform vec4 u_sun;        // angular radius, disc radiance, -, -
uniform vec4 u_stars;      // brightness k (the eye's adaptation), pixels per radian, tier, -
uniform vec3 u_galN;       // the galaxy's plane normal (session frame)
uniform vec3 u_galC;       // the way to its centre
uniform float u_galK;      // the band's brightness
in vec3 v_dir;
out vec4 o;
// one grid of stars on the faces of a cube: a star a cell (most cells), its place, brightness and colour from a hash
vec3 starGrid(vec3 D, float N, float seed, float dens, float bright) {
  vec3 a = abs(D); vec2 uv; float face;
  if (a.x >= a.y && a.x >= a.z) { uv = D.yz / a.x; face = D.x > 0.0 ? 0.0 : 1.0; }
  else if (a.y >= a.z) { uv = D.xz / a.y; face = D.y > 0.0 ? 2.0 : 3.0; }
  else { uv = D.xy / a.z; face = D.z > 0.0 ? 4.0 : 5.0; }
  vec2 g = (uv * 0.5 + 0.5) * N, cell = floor(g), f = fract(g);
  vec3 h = hash33(vec3(cell, face * 17.0 + seed));
  float dn = dens * (0.3 + 1.2 * vnoise3(D * 3.1 + seed));   // (clumps and voids, not an even sieve)
  if (h.z > dn) return vec3(0.0);
  vec2 sp = 0.06 + 0.88 * h.xy;
  float px = length(f - sp) * (1.5708 / N) * u_stars.y;      // the distance in pixels
  // the brightness: N(> b) ∝ b^−1.5 (stars spread evenly in space) — most of them a faint dust, one in a hundred clear,
  // one in a thousand bright
  float b = bright * min(0.002 * pow(max(hash13(vec3(cell, face + seed * 3.0)), 1e-4), -0.6667), 2.5);
  float t = hash13(vec3(cell.yx, face + 9.0 + seed));
  vec3 col = t < 0.12 ? vec3(1.0, 0.66, 0.36) : t < 0.34 ? vec3(1.0, 0.86, 0.72) : t < 0.66 ? vec3(1.0, 0.95, 0.9) : t < 0.88 ? vec3(0.88, 0.9, 1.0) : vec3(0.68, 0.76, 1.0);
  return col * b * exp(-px * px * 1.6 / (1.0 + 1.5 * b));
}
void main() {
  vec3 D = normalize(v_dir);
  vec3 col = starGrid(D, 150.0, 1.0, 0.55, 1.0);
  if (u_stars.z > 1.5) col += starGrid(D, 420.0, 7.0, 0.6, 0.4);
  // the galaxy's band: a great circle, clumpy star clouds, a dust rift along its middle toward the centre, the warm core
  float b = dot(D, u_galN);
  float along = dot(normalize(D - u_galN * b), u_galC);
  float core = exp(-(1.0 - along) * 3.0);
  float wide = exp(-b * b / 0.05), thin = exp(-b * b / (0.0045 + 0.012 * core));
  float n1 = vnoise3(D * 7.0), n2 = vnoise3(D * 19.0 + 4.0);
  float clouds = 0.45 + 0.9 * n1 * n1 + 0.35 * n2;
  float rift = 1.0 - 0.75 * exp(-b * b / 0.0009) * smoothstep(0.2, 0.9, along) * smoothstep(0.35, 0.7, n2 + 0.2);
  float gal = (thin * clouds * (0.55 + 1.6 * core) + wide * 0.18) * rift;
  vec3 gcol = mix(vec3(0.72, 0.78, 1.0), vec3(1.0, 0.84, 0.66), core) + vec3(0.25, -0.05, 0.12) * smoothstep(0.72, 0.9, n2) * thin;
  col += gcol * gal * u_galK;
  // Helia's disc, limb-darkened (its glow is the glare pass, drawn last)
  float s = length(cross(D, u_sunDir));
  if (dot(D, u_sunDir) > 0.0 && s < u_sun.x) { float ld = sqrt(1.0 - (s / u_sun.x) * (s / u_sun.x)); col += u_sunCol * u_sun.y * (0.42 + 0.58 * ld); }
  col *= u_stars.x;
  o = vec4(col, 1.0);
}`;

  // ---------------------------------------------------------------- Herzwelt
  const HERZ_FS = `
${COMMON}
${AIR}
uniform vec3 u_cdir;
uniform vec3 u_bu;
uniform vec3 u_bv;
uniform float u_d;          // the distance to the centre, radii
uniform mat3 u_toBody;      // session → body frame
uniform vec3 u_sunB;        // the way to Helia (body frame)
uniform vec3 u_sunCol;
uniform vec3 u_parB;        // the way to Amarant (body frame), its light on the night side
uniform vec3 u_parCol;
uniform sampler2D u_texA;   // the globe: albedo (sRGB; a water texel holds its shore's sand) + water
uniform sampler2D u_texB;   //            lights, clouds, the height code, ice
uniform sampler2D u_patA;   // the patch round the nadir
uniform sampler2D u_patB;
uniform vec4 u_patch;       // x0, z0 (the plane, m), 1 / its size (m), on
uniform vec4 u_chart;       // the pole Px, Pz, the Heartland's azimuth φH, R (m)
uniform vec4 u_air;         // the clouds' drift (rad), time, tier, airglow
uniform vec4 u_look;        // night lights, haze, limb, clouds
uniform vec2 u_px;          // the patch's metres a texel, the cloud height (m)
in vec3 v_dir;
out vec4 o;
float ggx(float nh, float r) { float a = r * r, d = nh * nh * (a * a - 1.0) + 1.0; return a * a / (PI * d * d); }
// the height code (bodytex.js) → metres over the sea: 3 a metre below it, h / (h + 48) above (the coast where it is 128)
float hOf(float code) { float c = code - 128.0; return c < 0.0 ? c / 3.0 : 48.0 * c / max(127.0 - c, 2.5); }
void main() {
  vec3 D = normalize(v_dir);
  vec3 Di = vec3(dot(D, u_bu), dot(D, u_bv), dot(D, u_cdir));
  float s2 = Di.x * Di.x + Di.y * Di.y, q = u_d * sqrt(s2);
  vec3 L = u_sunB, Db = u_toBody * D;
  vec3 col = vec3(0.0); float alpha = 0.0;
  if (q < 1.0 && Di.z > 0.0) {
    float sq = sqrt(1.0 - q * q);
    vec3 Ni = vec3(u_d * Di.z * Di.x, u_d * Di.z * Di.y, -u_d * s2) - Di * sq;
    vec3 N = normalize(u_toBody * (Ni.x * u_bu + Ni.y * u_bv + Ni.z * u_cdir));
    // the ground: the globe, and the patch where it lies (the plane by the chart: azimuthal equidistant about the pole)
    vec3 Nc = vec3(N.x * cos(u_air.x) - N.z * sin(u_air.x), N.y, N.x * sin(u_air.x) + N.z * cos(u_air.x));   // (the clouds drift east)
    vec2 guv = eqUV(N);
    vec4 A = texEq(u_texA, guv), Bt = texEq(u_texB, guv);
    float cl = texEq(u_texB, eqUV(Nc)).g;
    float th = acos(clamp(N.y, -1.0, 1.0)), lam = atan(-N.z, N.x), ph = u_chart.z - lam;
    vec2 xz = vec2(0.0), puv = vec2(0.0), grad = vec2(0.0);
    float pw = 0.0;
    if (u_patch.w > 0.5) {
      xz = u_chart.xy + u_chart.w * th * vec2(cos(ph), sin(ph));
      // the texels' squares broken into the land's own curves: the lookup bent by a smooth noise of the plane (±0.6 texel)
      vec2 wq = xz / (u_px.x * 2.3);
      vec2 xw = xz + (vec2(vnoise3(vec3(wq, 1.7)), vnoise3(vec3(wq.yx, 5.3))) - 0.5) * u_px.x * 1.25;
      puv = (xw - u_patch.xy) * u_patch.z;
      vec2 e = min(puv, 1.0 - puv);
      pw = smoothstep(0.0, 0.05, min(e.x, e.y));
      if (pw > 0.0) {
        // the colours bent further (±1.1 texel, from tier 1): the biomes' patches lose their squares; the coast and the
        // relief keep the mild bend
        vec2 pua = puv;
        if (u_air.z > 0.5) { vec2 wq2 = xz / (u_px.x * 5.0); pua = (xw + (vec2(vnoise3(vec3(wq2, 3.1)), vnoise3(vec3(wq2.yx, 8.7))) - 0.5) * u_px.x * 2.2 - u_patch.xy) * u_patch.z; }
        vec4 pa = texture(u_patA, pua), pb = texture(u_patB, puv);
        // the relief: the height's slope on the plane over ~280 m (the hills' shapes, not the 50-m roughness) from four
        // taps of a coarser mip level (metres a metre)
        float lod = log2(280.0 / u_px.x), du = 280.0 * u_patch.z;
        grad = vec2(hOf(textureLod(u_patB, puv + vec2(du, 0.0), lod).b * 255.0) - hOf(textureLod(u_patB, puv - vec2(du, 0.0), lod).b * 255.0),
                    hOf(textureLod(u_patB, puv + vec2(0.0, du), lod).b * 255.0) - hOf(textureLod(u_patB, puv - vec2(0.0, du), lod).b * 255.0)) / 560.0 * pw;
        A = mix(A, pa, pw); Bt = mix(Bt, pb, pw); cl = mix(cl, pb.g, pw);
      }
    }
    vec3 alb = A.rgb;
    float hc = Bt.b * 255.0, lights = Bt.r;
    // ice: the texels' flag with a frayed edge (the noise only where the flag is between its texels)
    float ice = Bt.a;
    if (ice > 0.01 && ice < 0.99) ice = smoothstep(0.3, 0.7, ice + (vnoise3(N * 1400.0) - 0.5) * 0.5);
    // the coast where the height code crosses the sea (between the texels: round shores), the sea's depth in metres
    float water = 1.0 - smoothstep(126.5, 129.5, hc), depth = max(0.0, (128.0 - hc) / 3.0);
    // the land seen from orbit: a fifth of the biomes' game colour given up to its grey (the patchwork reads as land),
    // its grain below the texel (fields, woods, rock) from tier 1
    alb = mix(vec3(dot(alb, vec3(0.2126, 0.7152, 0.0722))), alb, 0.8);
    if (u_air.z > 0.5) alb *= 1.0 + detailN(N, 700.0) * 0.34 + detailN(N, 2600.0) * 0.22;
    // the relief's normal: the plane's slope turned onto the sphere (south along the chart's radius, east across it; ×2.2)
    vec3 Nl = N;
    if (pw > 0.0) {
      vec3 nN = vec3(-cos(th) * cos(lam), sin(th), cos(th) * sin(lam)), eN = vec3(-sin(lam), 0.0, -cos(lam));
      float dS = dot(grad, vec2(cos(ph), sin(ph))), dE = dot(grad, vec2(sin(ph), -cos(ph))) * th / max(sin(th), 1e-4);
      Nl = normalize(N + (dS * nN - dE * eN) * 2.2);
    }
    // finer clouds from tier 2: the texture's cells broken up and their edges frayed
    if (u_air.z > 1.5) { float dn = vnoise3(N * 2600.0 + u_air.y * 0.002) * 0.6 + vnoise3(N * 7100.0) * 0.4; cl = clamp(cl + (dn - 0.5) * 0.35 * smoothstep(0.02, 0.4, cl) * (1.0 - cl), 0.0, 1.0); }
    float mus = dot(N, L), muv = max(dot(N, -Db), 0.0), musl = dot(Nl, L);
    // the clouds' relief from tier 1: the field ~400 m toward Helia — thicker there, this side lies in its shade; thinner,
    // this is the lit edge
    float puff = 0.0;
    if (u_air.z > 0.5 && cl > 0.02) {
      vec3 Lt = L - N * mus;
      float cS = texEq(u_texB, eqUV(normalize(N + Lt * 0.004))).g;
      if (pw > 0.0) { vec2 toP = normalize(u_chart.xy - xz), eastP = vec2(-toP.y, toP.x); vec3 nN = vec3(-cos(th) * cos(lam), sin(th), cos(th) * sin(lam)), eN = vec3(-sin(lam), 0.0, -cos(lam)); cS = mix(cS, texture(u_patB, puv + (toP * dot(Lt, nN) + eastP * dot(Lt, eN)) * 400.0 * u_patch.z).g, pw); }
      puff = clamp((cl - cS) * 3.0, -0.6, 0.6);
    }
    cl = smoothstep(0.08, 0.95, cl) * u_look.w;
    // the peaks keep the sun a little past the terminator (their height dips the horizon)
    vec3 Ts = sunTrans(max(hOf(hc), 0.0) / u_chart.w, mus);
    float day = smoothstep(-0.02, 0.07, mus);
    vec3 Ed = u_sunCol * max(musl, 0.0) * Ts;
    vec3 sky = vec3(0.05, 0.09, 0.17) * u_sunCol * smoothstep(-0.15, 0.3, mus) * sunTrans(HR, mus);
    vec3 twi = vec3(0.07, 0.05, 0.06) * smoothstep(-0.3, 0.02, mus) * (1.0 - day);
    // the clouds' shadow on the ground: the cloud field toward Helia (the patch: the clouds ~200 m up)
    float csh = 1.0;
    if (pw > 0.0 && mus > 0.02) {
      vec3 Lt = L - N * mus;
      vec3 Ln = normalize(vec3(-cos(th) * cos(lam), sin(th), cos(th) * sin(lam))), Le = vec3(-sin(lam), 0.0, -cos(lam));
      float off = u_px.y * sqrt(max(1.0 - mus * mus, 0.0)) / mus;
      // the sun's way on the plane: north toward the pole, east across it
      vec2 toP = normalize(u_chart.xy - xz), eastP = vec2(-toP.y, toP.x);
      vec2 dpl = (toP * dot(Lt, Ln) + eastP * dot(Lt, Le)) / max(length(Lt), 1e-5) * min(off, 2500.0);
      csh = 1.0 - 0.62 * smoothstep(0.1, 0.9, texture(u_patB, (xz + dpl - u_patch.xy) * u_patch.z).g) * pw;
    }
    vec3 ground = alb * (Ed * csh + sky + twi), albG = alb;   // (albG: the ground's albedo for the night's light — the sea's own)
    // water: turquoise over the shallows, deep blue to navy with depth, ice white; the sky in it by Fresnel, the
    // sunglint (GGX on a wind-roughened sea)
    if (water > 0.001) {
      vec3 seaC = mix(vec3(0.030, 0.30, 0.33), vec3(0.010, 0.10, 0.24), smoothstep(0.7, 5.0, depth));
      seaC = mix(seaC, vec3(0.004, 0.022, 0.08), smoothstep(6.0, 22.0, depth));
      if (ice > 0.0) seaC = mix(seaC, vec3(0.62, 0.74, 0.86) * (1.0 + detailN(N, 1900.0) * 0.5 + detailN(N, 520.0) * 0.4), ice);   // (the floes' cracks and ridges)
      vec3 H = normalize(L - Db);
      float F = 0.02 + 0.98 * pow(1.0 - muv, 5.0);
      float spec = ggx(max(dot(N, H), 0.0), 0.22) * F * 0.25 / max(muv, 0.05) * (1.0 - ice);
      vec3 sea = seaC * (u_sunCol * max(mus, 0.0) * Ts * csh + sky) + F * vec3(0.16, 0.26, 0.48) * u_sunCol * day * (1.0 - ice) + Ts * u_sunCol * spec * max(mus, 0.0) * csh;
      ground = mix(ground, sea, water);
      albG = mix(alb, seaC, water);
    }
    // the clouds: lit from above, the sunset tinting them, a little light from the sky
    vec3 cloudCol = vec3(0.92) * (u_sunCol * (max(mus, 0.0) * 0.85 * (1.0 + puff) + 0.12 * day) * sunTrans(0.002, mus) + sky * 2.5) + twi * 0.6;
    // the view's way through the air: the ground dims and the veil thickens toward the limb
    vec3 tv = (TAU_R + TAU_M) * airmass(muv);
    vec3 Tv = exp(-tv), Tvc = exp(-tv * 0.4);
    float cv = dot(Db, L);
    vec3 haze = (1.0 - exp(-TAU_R * airmass(muv))) * SCAT_R * phaseR(cv) * sunTrans(HR, mus) + (1.0 - exp(-TAU_M * airmass(muv))) * 0.9 * phaseM(cv) * sunTrans(HM, mus);
    haze *= u_sunCol * u_look.y * 0.3;   // (the phase's 1/4π against a Lambert surface's 1/π, a little more for the light scattered twice)
    col = mix(ground * Tv, cloudCol * Tvc, cl) + haze;
    // the night: the villages' lights (points within the texel), Amarant's light, the airglow seen from above
    float night = 1.0 - smoothstep(-0.1, 0.04, mus);
    if (lights > 0.004 && night > 0.0) {
      // ~25-m cells, lit by the texel's strength: dense in a village's core, sparse at its edge and on the farmland;
      // their mean where the cells get smaller than a pixel
      vec3 gc = N * 4000.0;
      float fw = length(fwidth(gc)), hp = hash13(floor(gc)), hq = hash13(floor(gc) + 7.0);
      float dens = 0.08 + 0.6 * smoothstep(0.15, 0.85, lights);
      float pts = mix(step(1.0 - dens, hp) * (0.5 + hq), dens, smoothstep(0.35, 1.2, fw));
      vec3 lc = mix(vec3(1.0, 0.55, 0.2), vec3(1.0, 0.86, 0.62), step(0.72, hq));
      col += lc * (lights * pts * 1.6 + lights * lights * 0.1) * u_look.x * night * Tv * (1.0 - 0.85 * cl);
    }
    col += albG * u_parCol * max(dot(N, u_parB), 0.0) * (1.0 - day) * (1.0 - cl * 0.3) * Tv + vec3(0.9) * cl * u_parCol * max(dot(N, u_parB), 0.0) * (1.0 - day);
    col += AG_COL * u_air.w * 0.06 * night;
    alpha = 1.0;
  } else if (Di.z > 0.0) {
    // the limb: the ray passes the planet at h radii up; the tangent column (white low down, blue above, black at the top)
    float h = q - 1.0;
    if (h < ATOP * 1.1) {
      vec3 Pt = (u_d * Di.z * Di.x) * u_bu + (u_d * Di.z * Di.y) * u_bv + (-u_d * s2) * u_cdir;
      vec3 Ptb = normalize(u_toBody * Pt);
      float mus = dot(Ptb, L), c = dot(Db, L);
      vec3 tR = TAU_R * KT_R * exp(-h / HR);
      float tM = TAU_M * KT_M * exp(-h / HM);
      vec3 tt = tR + tM;
      vec3 Ts = sunTrans(h + HR * 0.6, mus);
      vec3 sc = (1.0 - exp(-tt)) * (tR * SCAT_R * phaseR(c) + tM * 0.9 * phaseM(c)) / max(tt, vec3(1e-6));
      col = sc * Ts * u_sunCol * u_look.z * 0.42;
      // the airglow: a thin shell at the 94-km equivalent seen edge-on, on the night side
      float ag = exp(-pow((h - 0.0147) / 0.0005, 2.0)) * (1.0 - smoothstep(-0.16, 0.02, mus));
      col += AG_COL * u_air.w * ag * 0.45;
      alpha = clamp(1.0 - exp(-dot(tt, vec3(0.2, 0.3, 0.5))), 0.0, 1.0);
    }
  }
  o = vec4(col, alpha);
}`;

  // ---------------------------------------------------------------- Amarant
  const GIANT_FS = `
${COMMON}
uniform mat3 u_toBody;
uniform vec3 u_camB;        // the camera in Amarant's frame, equatorial radii
uniform float u_flat;       // polar / equatorial
uniform vec3 u_sunB;
uniform vec3 u_sunCol;
uniform sampler2D u_bands;
uniform sampler2D u_ring;
uniform vec4 u_flow;        // time (s), flow speed, tier, the ring's shadow on
uniform vec4 u_ringK;       // r0, r1
in vec3 v_dir;
out vec4 o;
float ringTau(float r) { if (r < u_ringK.x || r > u_ringK.y) return 0.0; return texture(u_ring, vec2((r - u_ringK.x) / (u_ringK.y - u_ringK.x), 0.5)).a * 3.0; }
void main() {
  vec3 D = normalize(v_dir), Db = u_toBody * D, L = u_sunB;
  vec3 ob = vec3(u_camB.x, u_camB.y / u_flat, u_camB.z), d0 = vec3(Db.x, Db.y / u_flat, Db.z);
  vec3 d = normalize(d0);
  float b = dot(ob, d), c = dot(ob, ob) - 1.0, hh = b * b - c;
  if (hh < 0.0 || -b - sqrt(max(hh, 0.0)) < 0.0) {
    // the hazy rim above the cloud tops, lit from Helia's side
    float rc = sqrt(max(dot(ob, ob) - b * b, 0.0)) - 1.0;
    if (b < 0.0 && rc < 0.03) { vec3 pc = ob + d * (-b); vec3 Nc = normalize(vec3(pc.x, pc.y / u_flat, pc.z)); float lit = smoothstep(-0.15, 0.3, dot(Nc, L)); float k = exp(-rc / 0.006) * lit; o = vec4(vec3(0.55, 0.52, 0.75) * u_sunCol * k * 0.5, k * 0.6); return; }
    discard;
  }
  float ts = -b - sqrt(hh);
  vec3 p = ob + d * ts;
  vec3 N = normalize(vec3(p.x, p.y / u_flat, p.z)), P = vec3(p.x, p.y * u_flat, p.z);
  float lat = asin(clamp(N.y, -1.0, 1.0)), lam = atan(-P.z, P.x);
  // the zonal flow: every band its own speed, the shear where they meet (a storm rolls along its band)
  float band = clamp(2.6 * sin(lat * 9.3 + 0.35), -1.0, 1.0);
  vec2 uv = vec2((lam + u_flow.x * u_flow.y * band) / TAU2 + 0.5, 0.5 - lat / PI);
  vec3 alb = texEq(u_bands, uv).rgb;
  if (u_flow.z > 1.5) alb *= 1.0 + (vnoise3(vec3(P.x * 22.0, P.y * 160.0, P.z * 22.0)) - 0.5) * 0.12;
  float mus = dot(N, L), muv = max(dot(N, -Db), 0.0);
  // limb darkening (Minnaert k 1.05), a soft terminator in the deep haze
  float lit = pow(max(mus, 0.0), 1.05) * pow(max(muv, 0.02), 0.05) * smoothstep(-0.04, 0.04, mus) + 0.012 * smoothstep(-0.2, 0.02, mus) * (1.0 - smoothstep(0.02, 0.1, mus));
  // the ring's shadow: the way to Helia through the ring plane, the slant path through the sheet
  float tr = 1.0;
  if (u_flow.w > 0.5 && abs(L.y) > 1e-4) { float t = -P.y / L.y; if (t > 0.0) { vec2 X = P.xz + L.xz * t; tr = exp(-ringTau(length(X)) / abs(L.y)); } }
  vec3 col = alb * u_sunCol * lit * tr;
  // a blue-violet haze toward the limb on the day side
  col += vec3(0.08, 0.08, 0.16) * u_sunCol * pow(1.0 - muv, 3.0) * smoothstep(-0.1, 0.3, mus) * tr;
  o = vec4(col, 1.0);
}`;

  // ---------------------------------------------------------------- the ring
  const RING_FS = `
${COMMON}
uniform mat3 u_toBody;
uniform vec3 u_camB;
uniform float u_flat;
uniform vec3 u_sunB;
uniform vec3 u_sunCol;
uniform vec3 u_plCol;       // Amarant's light on the ring (its day side's glow), linear
uniform sampler2D u_ring;
uniform vec4 u_ringK;       // r0, r1, the sun's angular radius, tier
in vec3 v_dir;
out vec4 o;
void main() {
  vec3 D = normalize(v_dir), Db = u_toBody * D, L = u_sunB;
  if (abs(Db.y) < 1e-7) discard;
  float t = -u_camB.y / Db.y;
  if (t <= 0.0) discard;
  vec3 P = u_camB + Db * t;
  float r = length(P.xz);
  if (r < u_ringK.x || r > u_ringK.y) discard;
  // the planet in front of the ring here: its pixel is the planet's own
  vec3 ob = vec3(u_camB.x, u_camB.y / u_flat, u_camB.z), d0 = vec3(Db.x, Db.y / u_flat, Db.z);
  float kd = length(d0); vec3 d = d0 / kd;
  float b = dot(ob, d), c = dot(ob, ob) - 1.0, hh = b * b - c;
  if (hh > 0.0) { float tp = (-b - sqrt(hh)) / kd; if (tp > 0.0 && tp < t) discard; }
  vec4 R = texture(u_ring, vec2((r - u_ringK.x) / (u_ringK.y - u_ringK.x), 0.5));
  float tau = R.a * 3.0;
  if (u_ringK.w > 1.5) tau *= 1.0 + (hash13(vec3(floor(r * 6000.0), 1.0, 3.0)) - 0.5) * 0.25;   // the finest ringlets (High)
  vec3 alb = R.rgb;
  float muv = max(abs(Db.y), 0.004), mu0 = max(abs(L.y), 0.004);
  // the planet's shadow: the way to Helia against the ellipsoid, soft by Helia's disc
  vec3 pp = vec3(P.x, P.y / u_flat, P.z), lp = normalize(vec3(L.x, L.y / u_flat, L.z));
  float tc = -dot(pp, lp), sh = 1.0;
  if (tc > 0.0) { float dm = length(pp + lp * tc), w = max(1e-4, u_ringK.z * tc); sh = smoothstep(1.0 - w, 1.0 + w, dm); }
  float cph = dot(L, -Db);   // the phase: 1 with Helia behind the camera
  float opp = 1.0 + 0.9 * exp(-(1.0 - cph) * 18.0);
  float dusty = 1.0 - smoothstep(0.3, 0.9, tau);   // the thin parts scatter forward (the C ring and the gaps glow backlit)
  float fwd = 1.0 + dusty * 3.0 * exp(-(1.0 + cph) * 6.0);
  vec3 I;
  bool litSide = u_camB.y * L.y > 0.0;
  if (litSide) I = alb * 0.75 * (mu0 / (mu0 + muv)) * (1.0 - exp(-tau * (1.0 / mu0 + 1.0 / muv))) * opp;
  else { float e0 = exp(-tau / mu0), ev = exp(-tau / muv); float trn = abs(mu0 - muv) < 1e-3 ? (tau / mu0) * e0 : mu0 / (mu0 - muv) * (e0 - ev); I = alb * 0.75 * trn * fwd; }
  I *= u_sunCol * sh;
  I += alb * u_plCol * (1.0 - exp(-tau)) * 0.35;
  float a = 1.0 - exp(-tau / muv);
  o = vec4(I, a);
}`;

  // ---------------------------------------------------------------- a moon
  const MOON_FS = `
${COMMON}
uniform vec3 u_cdir;
uniform vec3 u_bu;
uniform vec3 u_bv;
uniform float u_d;
uniform mat3 u_toBody;
uniform vec3 u_sunB;
uniform vec3 u_sunCol;
uniform vec3 u_parB;
uniform vec3 u_parCol;
uniform sampler2D u_tex;
uniform vec4 u_mk;          // model (0 airless · 1 air), the air's limb strength, lava glow, water glint
uniform vec3 u_airCol;      // the limb's colour
uniform vec2 u_grain;       // tier, the grain's wavenumber (radii per 200 m)
in vec3 v_dir;
out vec4 o;
void main() {
  vec3 D = normalize(v_dir);
  vec3 Di = vec3(dot(D, u_bu), dot(D, u_bv), dot(D, u_cdir));
  float s2 = Di.x * Di.x + Di.y * Di.y, q = u_d * sqrt(s2);
  vec3 L = u_sunB, Db = u_toBody * D;
  if (q >= 1.0 || Di.z <= 0.0) {
    // a thin limb where the moon has air
    float h = q - 1.0;
    if (u_mk.x > 0.5 && Di.z > 0.0 && h < 0.02) {
      vec3 Pt = (u_d * Di.z * Di.x) * u_bu + (u_d * Di.z * Di.y) * u_bv + (-u_d * s2) * u_cdir;
      float mus = dot(normalize(u_toBody * Pt), L);
      float k = exp(-h / 0.0035) * u_mk.y * smoothstep(-0.12, 0.25, mus);
      o = vec4(u_airCol * u_sunCol * k, clamp(k * 0.8, 0.0, 1.0));
      return;
    }
    discard;
  }
  float sq = sqrt(1.0 - q * q);
  vec3 Ni = vec3(u_d * Di.z * Di.x, u_d * Di.z * Di.y, -u_d * s2) - Di * sq;
  vec3 N = normalize(u_toBody * (Ni.x * u_bu + Ni.y * u_bv + Ni.z * u_cdir));
  vec4 T = texEq(u_tex, eqUV(N));
  vec3 alb = T.rgb;
  // the ground's grain below the texel when the camera is near (from tier 1): rock and dust in two octaves
  if (u_grain.x > 0.5) alb *= 1.0 + detailN(N, u_grain.y) * 0.45 + detailN(N, u_grain.y * 3.7) * 0.3 + detailN(N, u_grain.y * 0.27) * 0.3;
  float mus = dot(N, L), muv = max(dot(N, -Db), 0.0);
  float lit;
  if (u_mk.x < 0.5) { float m0 = max(mus, 0.0); lit = mix(2.0 * m0 / (m0 + muv + 1e-3), m0, 0.5); }   // Lommel–Seeliger half and half with Lambert
  else lit = max(mus, 0.0) * smoothstep(-0.05, 0.08, mus) + 0.03 * smoothstep(-0.2, 0.05, mus);
  vec3 col = alb * u_sunCol * lit;
  // the parent's light on the night side (Amarant over Zinnober's night is a lamp — U§4.4)
  col += alb * u_parCol * max(dot(N, u_parB), 0.0) * (1.0 - smoothstep(-0.05, 0.1, mus) * 0.7);
  // Zinnober's lava lakes glow (alpha < 1 where the texture says so), Aquamarin's seas glint
  if (u_mk.z > 0.0) col += vec3(1.0, 0.36, 0.08) * (1.0 - T.a) * u_mk.z * (0.35 + 0.65 * (1.0 - smoothstep(-0.1, 0.1, mus)));
  if (u_mk.w > 0.0 && T.a > 0.5 && mus > 0.0) { vec3 H = normalize(L - Db); float nh = max(dot(N, H), 0.0); col += u_sunCol * pow(nh, 160.0) * u_mk.w * (0.02 + 0.98 * pow(1.0 - muv, 5.0)) * 40.0 * T.a; }
  // with air: the veil toward the limb
  if (u_mk.x > 0.5) col += u_airCol * u_sunCol * u_mk.y * 0.25 * pow(1.0 - muv, 3.0) * smoothstep(-0.1, 0.3, mus);
  o = vec4(col, 1.0);
}`;

  // ---------------------------------------------------------------- Helia's glare
  const GLARE_FS = `
${COMMON}
uniform vec3 u_sunDir;
uniform vec3 u_sunCol;
uniform vec4 u_gl;          // visible part, angular radius, strength, the bloom's share (High draws less here)
in vec3 v_dir;
out vec4 o;
void main() {
  vec3 D = normalize(v_dir);
  float c = dot(D, u_sunDir);
  if (c <= 0.0) discard;
  float a = length(cross(D, u_sunDir));
  float r = u_gl.y;
  float core = 1.0 / (1.0 + pow(a / (r * 1.6), 2.0)) * (1.0 - smoothstep(0.2, 0.43, a));
  // (the glow fades to nothing before the quad's edge, 26° out — no frame round Helia)
  float halo = (0.10 * exp(-a / 0.035) + 0.022 * exp(-a / 0.14) + 0.006 * exp(-a / 0.45)) * (1.0 - smoothstep(0.2, 0.43, a));
  // six faint rays (the eye's own star, not a telescope's spikes)
  vec3 ax = normalize(cross(u_sunDir, abs(u_sunDir.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0))), ay = cross(ax, u_sunDir);
  float ang = atan(dot(D, ax), dot(D, ay));
  float rays = pow(abs(cos(ang * 3.0)), 40.0) * exp(-a / 0.06) * 0.06 * (1.0 - smoothstep(0.2, 0.43, a));
  vec3 col = u_sunCol * u_gl.x * u_gl.z * (core * 0.5 * (1.0 - u_gl.w) + halo + rays);
  o = vec4(col, 0.0);
}`;

  const FULL_VS = QUAD_VS;   // (the background is the quad shader with u_half 0: the full-screen triangle)
  SH.programs = () => ({
    bg: { vs: FULL_VS, fs: BG_FS }, herz: { vs: QUAD_VS, fs: HERZ_FS }, giant: { vs: QUAD_VS, fs: GIANT_FS },
    ring: { vs: RING_VS, fs: RING_FS }, moon: { vs: QUAD_VS, fs: MOON_FS }, glare: { vs: QUAD_VS, fs: GLARE_FS },
  });
})(VR);

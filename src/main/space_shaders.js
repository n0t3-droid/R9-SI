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
// u-orbitlod · the aurora (REFERENCE §3): the oval round the pole (colatitude ~11.5°, ±2°), on the night side.
// u-orbit2 (R52-10: a spike crown): curtains, not rays from the pole — the oval's envelope holds three ribbons (arcs a
// few hundred metres thin, a little apart), each folded at three scales and lit only along part of its length; fine
// rays along each ribbon. auroraEnv is the envelope alone (the red tops: diffuse). Returns the footprint's strength at
// a body-frame direction
float auroraEnv(vec3 Nb, float t, out float th, out float lam, out float c0) {
  th = acos(clamp(abs(Nb.y), 0.0, 1.0)); lam = atan(-Nb.z, Nb.x);
  c0 = 0.2 + 0.012 * sin(lam * 3.0 + t * 0.0021) + 0.008 * sin(lam * 7.0 - t * 0.0013);
  return exp(-pow((th - c0) / 0.05, 2.0)) * (0.55 + 0.45 * vnoise3(vec3(lam * 2.0, t * 0.0007, 9.0)));
}
float auroraAt(vec3 Nb, float t) {
  float th, lam, c0;
  float env = auroraEnv(Nb, t, th, lam, c0);
  if (env < 0.01) return 0.0;
  float a = 0.0;
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float fold = 0.0055 * sin(lam * (17.0 + 6.0 * fk) + t * 0.003 + fk * 2.1) + 0.005 * (vnoise3(vec3(lam * 38.0 + fk * 9.0, t * 0.002, fk)) - 0.5) + 0.0022 * sin(lam * 63.0 - t * 0.006 + fk);
    float d = (th - c0 - (fk - 1.0) * 0.02 - fold) / (0.0018 + 0.0008 * fk);
    float act = smoothstep(0.32, 0.72, vnoise3(vec3(lam * 5.0 + fk * 5.0, t * 0.0009, 2.0 + fk)));
    a += exp(-d * d) * act * (k == 1 ? 1.0 : 0.65);
  }
  return env * a * (0.55 + 0.45 * vnoise3(vec3(lam * 320.0, t * 0.02, 0.5)));
}
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
uniform float u_zFar;       // u-orbitlod: 1 = at the far plane (the planet tiles drawn first keep their ground: early depth)
out vec3 v_dir;
void main() {
  int id = gl_VertexID;
  if (u_half <= 0.0) {
    vec2 p = vec2(float((id << 1) & 2), float(id & 2)) * 2.0 - 1.0;
    vec4 w = u_invViewProj * vec4(p, 1.0, 1.0);
    v_dir = w.xyz / w.w;
    gl_Position = vec4(p, u_zFar > 0.5 ? 0.999999 : 0.5, 1.0);
    return;
  }
  const vec2 C[6] = vec2[6](vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(1.0, 1.0), vec2(-1.0, -1.0), vec2(1.0, 1.0), vec2(-1.0, 1.0));
  vec2 c = C[id];
  vec3 pos = u_cdir + (u_bu * c.x + u_bv * c.y) * u_half;
  v_dir = pos;
  gl_Position = u_viewProj * vec4(pos, 1.0);
  if (u_zFar > 0.5) gl_Position.z = gl_Position.w * 0.999999;
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
#ifdef PTILE
in vec3 v_nb;               // u-orbitlod: a planet tile's point — its own sphere normal (body frame), the mesh's normal
in vec3 v_nl;
in float v_fade;
#endif
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
#ifdef PTILE
  bool hitG = true;
#else
  bool hitG = q < 1.0 && Di.z > 0.0;
#endif
  if (hitG) {
#ifdef PTILE
    vec3 N = normalize(v_nb);
#else
    float sq = sqrt(1.0 - q * q);
    vec3 Ni = vec3(u_d * Di.z * Di.x, u_d * Di.z * Di.y, -u_d * s2) - Di * sq;
    vec3 N = normalize(u_toBody * (Ni.x * u_bu + Ni.y * u_bv + Ni.z * u_cdir));
#endif
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
    alb = mix(vec3(dot(alb, vec3(0.2126, 0.7152, 0.0722))), alb, AIRZ > 0.5 ? 1.05 : 1.14);   // (u-orbitlod: 0.9 — bodytex's one albedo is muted already; u-orbit2: Very Low, without the grain below the texel, keeps its biomes' colour a step fuller — a constant there, no cost)
    // u-orbit3: the land's contrast as orbital photographs show it — the dark woods and fields darker, the bright dry
    // land and the rock a little brighter (R52-10's pale beige carpet), the snow not past white
    float lA = dot(alb, vec3(0.2126, 0.7152, 0.0722));
    alb *= min(0.45 + 1.7 * lA, 1.15);
    if (u_air.z > 0.5) alb *= 1.0 + detailN(N, 700.0) * 0.34 + detailN(N, 2600.0) * 0.22;
    if (u_air.z > 1.5) alb *= 1.0 + detailN(N, 8000.0) * 0.24;   // u-orbit3: High, the near tiles' ground under the 50-m texels (~12-m fields and copses; faded out where a cell is under a pixel)
    // the relief's normal: the plane's slope turned onto the sphere (south along the chart's radius, east across it; ×2.2)
#ifdef PTILE
    vec3 Nl = normalize(v_nl); bool reliefP = false;   // (the mesh's own relief)
#else
    vec3 Nl = N; bool reliefP = pw > 0.0;
#endif
    if (reliefP) {
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
    cl = smoothstep(0.26, 0.8, cl) * u_look.w;   // (u-orbit3: 0.08–0.95 → 0.26–0.8 — the thin veil over the land gone, the systems with edges)
    // the peaks keep the sun a little past the terminator (their height dips the horizon)
    vec3 Ts = sunTrans(max(hOf(hc), 0.0) / u_chart.w, mus);
    float day = smoothstep(-0.02, 0.07, mus);
    vec3 Ed = u_sunCol * max(musl, 0.0) * Ts;
    vec3 sky = vec3(0.05, 0.09, 0.17) * u_sunCol * smoothstep(-0.15, 0.3, mus) * sunTrans(HR, mus);
    // u-orbitlod: the terminator a graded band (~18° of twilight, ~31 km here): warm at the line, deep blue beyond
    vec3 twi = mix(vec3(0.018, 0.028, 0.07), vec3(0.13, 0.075, 0.05), smoothstep(-0.16, 0.0, mus)) * smoothstep(-0.31, 0.0, mus) * (1.0 - day);
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
      vec3 seaC = mix(vec3(0.034, 0.15, 0.17), vec3(0.010, 0.058, 0.135), smoothstep(0.7, 5.0, depth));   // (u-orbitlod: muted as orbital photographs show water — dark teal shallows, navy depths)
      seaC = mix(seaC, vec3(0.004, 0.022, 0.08), smoothstep(6.0, 22.0, depth));
      if (ice > 0.0) seaC = mix(seaC, vec3(0.62, 0.74, 0.86) * (1.0 + detailN(N, 1900.0) * 0.5 + detailN(N, 520.0) * 0.4), ice);   // (the floes' cracks and ridges)
      vec3 H = normalize(L - Db);
      float F = 0.02 + 0.98 * pow(1.0 - muv, 5.0);
      // u-orbitlod · the sunglint: a mirror core (calm water) in a broad sheen whose roughness the wind varies (lanes)
      // (branches, not ?: — a select may evaluate both sides: Very Low keeps v0.50's one lobe and nothing more)
      float glint;
      if (u_air.z > 0.5) { float wind = 0.26 + 0.16 * vnoise3(N * 420.0 + vec3(0.0, u_air.y * 0.0004, 0.0)); glint = ggx(max(dot(N, H), 0.0), 0.09) * 0.6 + ggx(max(dot(N, H), 0.0), wind) * 2.6; }
      else glint = ggx(max(dot(N, H), 0.0), 0.22);
      float spec = glint * F * 0.25 / max(muv, 0.05) * (1.0 - ice);
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
    // u-orbit3: a layer's single scattering seen from above grows with the path through it, μs / (μs + μv) of the
    // column's: near the nadir under a low sun almost none, toward the limb (μv → 0) all of it — R52-10's milky veil;
    // and the eye's: the veil is seen against the ground only where it is long (the airmass past 1, exponential)
    float msh = max(mus, 0.0) + 0.02, amv = airmass(muv);
    haze *= u_sunCol * u_look.y * 0.25 * msh / (msh + muv) * (0.06 + 0.94 * (1.0 - exp(-(amv - 1.0) * 0.12)));   // (u-orbit2: 0.3 → 0.19; u-orbit3: 0.25 with the path's share)   // (the phase's 1/4π against a Lambert surface's 1/π, a little more for the light scattered twice)
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
    col += albG * u_parCol * max(dot(N, u_parB), 0.0) * (1.0 - day) * (1.0 - cl * 0.3) * Tv + vec3(0.6) * cl * u_parCol * max(dot(N, u_parB), 0.0) * (1.0 - day);
    col += AG_COL * u_air.w * 0.02 * night;   // (u-orbit3: 0.06 → 0.02 — the night ground read a green-grey floor at the eye's 3.7×; a faint sheen, the towns pop)
    // u-orbitlod: the aurora's oval seen from above (night side): green curtains over the land, a pink lower fringe
    if (u_air.z > 0.5 && mus < 0.0) { float au = auroraAt(N, u_air.y) * (1.0 - smoothstep(-0.12, 0.0, mus)); col += (vec3(0.12, 1.0, 0.42) * 0.3 + vec3(0.5, 0.1, 0.3) * 0.05) * au * u_look.z * Tv; }   // (from Low)
    alpha = 1.0;
  } else if (Di.z > 0.0) {
    // the limb: the ray passes the planet at h radii up; the tangent column (white low down, blue above, black at the top)
    float h = q - 1.0;
    if (h < ATOP * (u_air.z > 0.5 ? 3.4 : 1.1)) {   // (u-orbitlod: the aurora's heights from Low; Very Low the old rim)
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
      col += AG_COL * u_air.w * ag * 0.11;   // (u-orbitlod: thin and faint — ~1/10 of starlight; v0.50 ×0.45)
      // u-orbitlod · the sunset's layers in the limb (REFERENCE §3): along the terminator the troposphere glows orange to
      // yellow with dark cloud layers in it, a white-pink stratosphere above, then the blue fading to black
      float tz = smoothstep(-0.12, -0.01, mus) * (1.0 - smoothstep(0.04, 0.18, mus));
      if (tz > 0.0 && h < 0.012 && u_air.z > 0.5) {
        float cb = smoothstep(0.5, 0.72, vnoise3(Ptb * 700.0 + vec3(0.0, h * 2600.0, 0.0))) * (1.0 - smoothstep(0.0009, 0.0016, h));
        vec3 tro = vec3(1.0, 0.36, 0.07) * exp(-h / 0.0006) + vec3(1.0, 0.72, 0.3) * exp(-h / 0.0014) * 0.45;
        vec3 strat = vec3(0.92, 0.78, 0.82) * exp(-pow((h - 0.0042) / 0.0022, 2.0)) * 0.22;
        col += (tro * (1.0 - 0.75 * cb) + strat) * tz * u_sunCol * u_look.z * (0.5 + 1.5 * smoothstep(-0.2, 0.7, c));
      }
      // u-orbitlod · the aurora over the limb (night side): green curtains 100–200 km up (their lower edge crisp, a pink
      // fringe below it), red tops fading out above 200 km
      // u-orbit2: the curtains seen edge-on — the view's way crosses the curtains' shells (100–190 km) on both sides of
      // its lowest point; the ribbons' footprint there, weighted by the green's height profile (brightest at the crisp
      // lower edge, fading up), so the folds hang as curtains along the limb; the red tops a diffuse glow of the envelope
      float nite = u_air.z > 0.5 ? 1.0 - smoothstep(-0.14, -0.02, mus) : 0.0;
      if (nite > 0.0 && h < 0.04) {
        float th0, lam0, c00;
        float env = auroraEnv(Ptb, u_air.y, th0, lam0, c00);
        if (env > 0.01) {
          // (the footprint at the lowest point and a little before and behind it along the view: the sample heights move
          // with the pixel's, so the curtains run up continuously — run 3's fixed shells drew stacked stripes)
          vec3 Pt0 = Ptb * (1.0 + h);
          float sx = sqrt(max((1.0 + h + 0.006) * (1.0 + h + 0.006) - (1.0 + h) * (1.0 + h), 0.0));
          float gacc = auroraAt(Ptb, u_air.y) + 0.7 * (auroraAt(normalize(Pt0 - Db * sx), u_air.y) + auroraAt(normalize(Pt0 + Db * sx), u_air.y));
          float green = smoothstep(0.0144, 0.0154, h) * exp(-max(h - 0.0154, 0.0) / 0.009);
          float red = smoothstep(0.024, 0.033, h) * exp(-max(h - 0.033, 0.0) / 0.012);
          float pink = exp(-pow((h - 0.0149) / 0.0006, 2.0));
          col += (vec3(0.15, 1.0, 0.45) * gacc * green * 0.75 + vec3(0.9, 0.12, 0.2) * red * env * 0.12 + vec3(0.9, 0.3, 0.6) * pink * gacc * 0.12) * nite * u_look.z;
        }
      }
      alpha = clamp(1.0 - exp(-dot(tt, vec3(0.2, 0.3, 0.5))), 0.0, 1.0);
    }
  }
#ifdef PTILE
  if (v_fade < 0.5) discard;   // (the climb: the horizon tiles' inner part is theirs)
  o = vec4(col, 1.0);
#else
  o = vec4(col, alpha);
#endif
}`;
  // u-orbitlod · a planet tile (planetlod.js): its body-frame vertices put round the camera in the view's axes (the map's
  // east, up, south at the eye: u_toBody's transpose), its own depth (logarithmic to 64 km: the pass clears it after),
  // its fade (the reach's outer fifth; in the climb the horizon tiles' inner part)
  const PTILE_VS = `
uniform mat4 u_viewProj;
uniform mat3 u_toBody;
uniform vec3 u_camB;        // the camera in the body frame (m)
uniform vec4 u_tfade;       // the climb's inner cut from, to (m, 0: none); the reach's fade from, to (m)
layout(location=0) in vec3 a_pos;
layout(location=1) in vec3 a_nrm;
out vec3 v_dir;
out vec3 v_nb;
out vec3 v_nl;
out float v_fade;
void main() {
  vec3 rm = (a_pos - u_camB) * u_toBody;
  v_dir = rm; v_nb = a_pos; v_nl = a_nrm;
  float dh = length(rm.xz);
  v_fade = (1.0 - smoothstep(u_tfade.z, u_tfade.w, dh)) * (u_tfade.y > 0.0 ? smoothstep(u_tfade.x, u_tfade.y, dh) : 1.0);
  gl_Position = u_viewProj * vec4(rm, 1.0);
  float w = max(gl_Position.w, 1e-3);
  gl_Position.z = (log2(1.0 + w) / log2(1.0 + 64000.0) * 2.0 - 1.0) * gl_Position.w;
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
  // the airless ground's relief when the camera is near (from tier 1): hills and hollows of ~400 m from a noise's slope —
  // under a low Helia they throw the light about (the sphere's own terminator stays where it is)
  float musR = mus;
  if (u_grain.x > 0.5 && u_mk.x < 0.5) {
    float k = u_grain.y * 0.5, fade = 1.0 - smoothstep(0.3, 0.9, length(fwidth(N)) * k);
    if (fade > 0.0) {
      vec3 p = N * k; const float e = 0.3;
      float h0 = vnoise3(p);
      vec3 gr = vec3(vnoise3(p + vec3(e, 0.0, 0.0)) - h0, vnoise3(p + vec3(0.0, e, 0.0)) - h0, vnoise3(p + vec3(0.0, 0.0, e)) - h0) / e;
      gr -= N * dot(gr, N);
      musR = max(dot(normalize(N - gr * 0.12 * fade), L), mus * 0.3) * smoothstep(-0.02, 0.04, mus);   // (gentle: a few degrees of slope, the shade never black)
    }
  }
  float lit;
  if (u_mk.x < 0.5) { float m0 = max(musR, 0.0); lit = mix(2.0 * m0 / (m0 + muv + 1e-3), m0, 0.5); }   // Lommel–Seeliger half and half with Lambert
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

  // ================================================================ u-moons1 · the sky over an airless body
  // shaders.js takes two pieces into its COMMON (two marked lines; this file loads before it — build.js): bodySkyPre()
  // before its skyColor renames that one skyColorHome, bodySky() after it brings the uniforms, the functions and a new
  // skyColor that draws a body's sky when u_dim is 5 — all of it inside #ifdef BODYSKY, a define only the sky program
  // gets and only while a body's sky is shown (bodysky.js: the define hook, the programs rebuilt on the trip). So every
  // program of Herzwelt, Very Low's included, is the text it was (test/vl_programs.js compares them preprocessed).
  // In the local frame (x map east, y up, z map south): black by day and by night; the stars (they stand in the sky's own
  // frame while the moon turns: u_bsInert) and the galaxy's band, dimmed by the eye's adaptation; Helia's small disc and
  // its glare; the other worlds as lit discs; Amarant at its true size and phase — the oblate ellipsoid, bodytex.js's
  // zones and belts with their wander, streaks and the great storm, the zonal flow, limb darkening, the ring's shadow, a
  // hazy limb that lights up against Helia (the eclipse) — and the ring (τ(r) as bodytex.js's, the lit or unlit face,
  // the planet's shadow, glowing backlit); the geysers' plumes as columns of ice that scatter forward; the far ground
  // below the true horizon (its dip from the eye's height and the moon's radius) where the world's columns end.
  const lin = (c) => c.map(v => Math.pow(v / 255, 2.2));
  const f3 = (a) => a.map(v => (+v).toFixed(5)).join(', ');
  const nrm = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return a.map(v => v / l); };
  // bodytex.js's palette (Amarant's zones and belts north → south, the ring's particles), here in linear light
  const ZONE = [238, 226, 204], ZONE2 = [232, 210, 200], ZONE3 = [244, 236, 220], BELT = [172, 132, 200], BELT2 = [148, 108, 184], BELT3 = [196, 156, 182], BELT4 = [126, 98, 170], POLE = [122, 118, 166];
  const BANDS = [[66, POLE], [58, BELT4], [51, ZONE2], [45, BELT3], [38, ZONE], [32, BELT], [24, ZONE2], [9, BELT2], [-7, ZONE3], [-20, BELT], [-27, ZONE], [-33, BELT2], [-40, ZONE2], [-46, BELT3], [-53, ZONE], [-61, BELT4], [-90, POLE]];
  const GN = nrm([0.42, 0.5, -0.76]), gc0 = [0.8, -0.35, 0.2], gd = gc0[0] * GN[0] + gc0[1] * GN[1] + gc0[2] * GN[2], GC = nrm([gc0[0] - GN[0] * gd, gc0[1] - GN[1] * gd, gc0[2] - GN[2] * gd]);   // (spacescene.js's galaxy)
  const BODY_SKY = `
#ifdef BODYSKY
#undef skyColor
// ---- u-moons1 · the sky over an airless body (space_shaders.js SH.bodySky; the uniforms from bodysky.js)
uniform vec4 u_bsSun;      // Helia: unit direction, angular radius (rad)
uniform vec4 u_bsSunK;     // x the disc's radiance, y the glare (the free part of the disc above the horizon), z the stars (the eye's adaptation), w tier (0 Very Low … 3 High)
uniform vec3 u_bsSunCol;   // Helia's light (linear)
uniform mat3 u_bsInert;    // local → the sky's own frame (the stars and the galaxy stand in it while the moon turns)
uniform vec4 u_bsPar;      // Amarant: unit direction to its centre, its distance in equatorial radii
uniform vec4 u_bsPole;     // its pole — the ring's normal (unit), w: polar over equatorial radius
uniform vec4 u_bsParX;     // its prime meridian (unit, across the pole), w: the bands' flow time (s)
uniform vec4 u_bsParK;     // x the cosine of the ring's reach from its centre, y the ring's shadow on it (0 | 1), z its night side's glow, w Helia's angular radius there
uniform vec4 u_bsB[5];     // the other worlds: unit direction, angular radius (0: none)
uniform vec4 u_bsBc[5];    // their colour in Helia's light (linear), w: their air's limb
uniform vec4 u_bsGround;   // the far ground: its colour (linear, lit), w: the horizon's dip (the sine of its angle, ≥ 0)
uniform vec4 u_bsJ[4];     // the plumes: the vent from the eye (blocks), w: the column's top over it now (0: none)
uniform vec4 u_bsJs;       // their strengths (1 while the vent fires, fading as the ice falls back)
uniform vec4 u_bsJk;       // x the plumes' brightness, y the horizon's distance (blocks), z the moon's radius (blocks), w the eye over the ground
uniform vec3 u_bsEye;      // u-orbit2: the eye (blocks) — the far ground's texture stands on the ground
uniform vec2 u_bsLum;      // x Amarant's and its ring's brightness, y the other worlds' — the eye's exposure undone for them, so they read
// ---- u-moons2: the skies with air (atmo_lut.js via bodysky.js), Herzwelt over Aquamarin, the plumes' shapes
uniform vec4 u_bsAirK;     // x air (0 | 1), y the sky's scale (Helia × the LUT's units × the eye's), z 0 three stops (Very Low) | 1 the LUT, w the haze below the horizon
uniform sampler2D u_bsAir; // the sky-view LUT (φ from Helia's azimuth, √-mapped; Hillaire's elevation), rgb radiance
uniform vec4 u_bsAirS;     // its size (W, H), the stars' and the worlds' dimming by day (0 … 1), 0
uniform vec3 u_bsAirT;     // the air's zenith optical depth (rgb): the view's transmittance exp(−τ / μ)
uniform vec3 u_bsAir3[3];  // Very Low: the zenith, the horizon away from Helia, the horizon under Helia (scaled)
uniform vec4 u_bsHz;       // Herzwelt: its unit direction, its angular radius (0: not in this sky)
uniform vec4 u_bsHzX;      // its spin (radians), its clouds' drift, 0, 0
uniform vec4 u_bsJu;       // the plumes' shape: x 0 ice jets (Opal) · 1 umbrellas (Zinnober) · 2 dust devils (Ocker), y the devils' width (m), z the time (s), w 0
// ---- end u-moons2
                           //   the same by day and by night (the bands stay bands; a stated licence: an eye adapted to the dark ground would see a white disc)
const float BS_D2R = 0.0174532925;
const vec4 BS_BANDS[17] = vec4[17](${BANDS.map(([e, c]) => `vec4(${(+e).toFixed(1)}, ${f3(lin(c))})`).join(', ')});
const vec3 BS_GN = vec3(${f3(GN)}), BS_GC = vec3(${f3(GC)});
// the stars: two grids of cells (the clear ones, the faint dust — Very Low the first), one star in a lucky cell, put on the
// sphere; N(> b) ∝ b^−1.5; no air, so they burn steady
vec3 bsStars(vec3 D) {
  vec3 col = vec3(0.0);
  for (int k = 0; k < 2; k++) {
    if (k == 1 && u_bsSunK.w < 0.5) break;
    float N = k == 0 ? 230.0 : 520.0, dens = k == 0 ? 0.0085 : 0.011;
    vec3 sp = D * N, g = floor(sp);
    float s = hash13(g + float(k) * 71.3);
    if (s < 1.0 - dens) continue;
    vec3 c = normalize(g + 0.5 + (vec3(hash13(g + 1.7), hash13(g + 2.3), hash13(g + 3.1)) - 0.5) * 0.7) * N;
    float r2 = dot(sp - c, sp - c);
    float b = min(0.035 * pow(max((1.0 - s) / dens, 0.002), -0.6667), 4.0) * (k == 0 ? 1.0 : 0.4);
    float t = hash13(g + 9.0);
    vec3 tint = t < 0.12 ? vec3(1.0, 0.68, 0.42) : t < 0.36 ? vec3(1.0, 0.88, 0.74) : t < 0.8 ? vec3(0.96, 0.96, 1.0) : vec3(0.74, 0.8, 1.0);
    col += tint * b * exp(-r2 * 7.0);
  }
  return col;
}
// the galaxy's band: a great circle, star clouds, a dust rift toward the warm core (spacescene.js BG_FS, cheaper)
vec3 bsGalaxy(vec3 D) {
  float b = dot(D, BS_GN), wide = exp(-b * b / 0.05);
  if (wide < 0.01) return vec3(0.0);
  float along = dot(normalize(D - BS_GN * b), BS_GC), core = exp(-(1.0 - along) * 3.0);
  float thin = exp(-b * b / (0.0045 + 0.012 * core));
  float n1 = vnoise3(D * 7.0), n2 = u_bsSunK.w > 0.5 ? vnoise3(D * 19.0 + 4.0) : 0.5;
  float clouds = 0.45 + 0.9 * n1 * n1 + 0.35 * n2;
  float rift = 1.0 - 0.75 * exp(-b * b / 0.0009) * smoothstep(0.2, 0.9, along) * smoothstep(0.35, 0.7, n2 + 0.2);
  return mix(vec3(0.72, 0.78, 1.0), vec3(1.0, 0.84, 0.66), core) * (thin * clouds * (0.55 + 1.6 * core) + wide * 0.18) * rift * 0.03;
}
// Helia's disc, limb-darkened (the worlds in front cover it) and its glare (over everything: the eye's own)
vec3 bsSunDisc(vec3 D) {
  if (dot(D, u_bsSun.xyz) < 0.999) return vec3(0.0);
  float q = length(cross(D, u_bsSun.xyz)) / u_bsSun.w;
  if (q >= 1.25) return vec3(0.0);
  return u_bsSunCol * u_bsSunK.x * (0.42 + 0.58 * sqrt(max(0.0, 1.0 - q * q))) * (1.0 - smoothstep(0.92, 1.25, q));
}
vec3 bsGlare(vec3 D) {
  if (u_bsSunK.y <= 0.0 || dot(D, u_bsSun.xyz) <= 0.0) return vec3(0.0);
  float a = length(cross(D, u_bsSun.xyz)), fade = 1.0 - smoothstep(0.2, 0.43, a), z = a / (u_bsSun.w * 1.6);
  float core = fade / (1.0 + z * z);
  float halo = (0.08 * exp(-a / 0.03) + 0.008 * exp(-a / 0.12) + 0.0015 * exp(-a / 0.45)) * fade;   // (no air: only the eye's own scatter)
  return u_bsSunCol * u_bsSunK.y * (core * 0.5 + halo);
}
// the other worlds: small spheres lit by Helia (the parallax of the light is nothing at these distances), a thin limb
// where they have air
vec3 bsBodies(vec3 D, vec3 col, float px) {
  for (int k = 0; k < 5; k++) {
    vec4 B = u_bsB[k];
    if (B.w <= 0.0) continue;
    float c = dot(D, B.xyz);
    if (c <= 0.0) continue;
    float q = length(cross(D, B.xyz)) / B.w;
    if (q > 1.08) continue;
    vec3 o = (D - B.xyz * c) / B.w;
    float qq = min(q, 1.0);
    vec3 N = o - B.xyz * sqrt(max(0.0, 1.0 - qq * qq));
    vec3 bc = u_bsBc[k].rgb * (max(dot(N, u_bsSun.xyz), 0.0) + 0.003) * u_bsLum.y;
    col = mix(col, bc, 1.0 - smoothstep(1.0 - 1.5 * px / B.w, 1.0, q));
    if (u_bsBc[k].w > 0.0) col += vec3(0.35, 0.55, 1.0) * u_bsSunCol * u_bsBc[k].w * 0.06 * exp(-abs(q - 1.0) / 0.025) * smoothstep(-0.2, 0.4, dot(o, u_bsSun.xyz) / max(q, 1e-3));
  }
  return col;
}
// the ring's optical depth normal to its plane and its particles' colour, r in Amarant's equatorial radii (bodytex.js)
float bsRingTau(float r) {
  if (r < 1.24 || r > 2.27) return 0.0;
  if (r < 1.53) {
    float pl = smoothstep(1.355, 1.36, r) * (1.0 - smoothstep(1.38, 1.385, r)) + smoothstep(1.41, 1.415, r) * (1.0 - smoothstep(1.432, 1.437, r)) + smoothstep(1.465, 1.47, r) * (1.0 - smoothstep(1.485, 1.49, r));
    return 0.07 + 0.05 * smoothstep(1.24, 1.5, r) + 0.2 * pl + 0.15 * smoothstep(1.5, 1.53, r);
  }
  if (r < 1.95) return 0.75 + 0.55 * smoothstep(1.53, 1.62, r) + 0.75 * smoothstep(1.6, 1.68, r) * (1.0 - smoothstep(1.84, 1.9, r)) + 0.25 * sin(r * 61.0) * smoothstep(1.6, 1.66, r) * (1.0 - smoothstep(1.86, 1.9, r));
  if (r < 2.028) { float g = (r - 1.99) / 0.006; return 0.04 + 0.06 * exp(-g * g); }
  if (abs(r - 2.214) < 0.00265) return 0.0;
  return 0.95 - 0.4 * smoothstep(2.03, 2.26, r) + 0.06 * sin(r * 140.0) * (1.0 - smoothstep(2.2, 2.26, r));
}
vec3 bsRingCol(float r) {
  if (r < 1.53) return mix(vec3(${f3(lin([150, 138, 128]))}), vec3(${f3(lin([238, 226, 206]))}), smoothstep(1.48, 1.56, r));
  if (r < 1.95) return vec3(${f3(lin([238, 226, 206]))});
  if (r < 2.028) return vec3(${f3(lin([118, 110, 104]))});
  return vec3(${f3(lin([222, 212, 196]))});
}
// Amarant's zones and belts by latitude (degrees), soft edges 1.1° each side (bodytex.js bandAt)
vec3 bsBand(float lat) {
  float prevEdge = 90.0;
  for (int i = 0; i < 17; i++) {
    vec4 e = BS_BANDS[i];
    if (lat >= e.x || i == 16) {
      vec3 c = e.yzw;
      if (i > 0) c = mix(c, BS_BANDS[max(i - 1, 0)].yzw, smoothstep(prevEdge - 1.1, prevEdge + 1.1, lat) * 0.5);
      if (i < 16) c = mix(c, BS_BANDS[min(i + 1, 16)].yzw, (1.0 - smoothstep(e.x - 1.1, e.x + 1.1, lat)) * 0.5);
      return c;
    }
    prevEdge = e.x;
  }
  return BS_BANDS[16].yzw;
}
// Amarant and its ring over what is behind them: the ray in the giant's frame (equatorial radii) against the ellipsoid
// (stretched along the pole into the unit sphere) and the ring's plane, the nearer in front
vec3 bsAmarant(vec3 D, vec3 col, float px) {
  vec3 C = u_bsPar.xyz;
  if (dot(D, C) < u_bsParK.x) return col;
  vec3 P = u_bsPole.xyz, L = u_bsSun.xyz;
  float f = u_bsPole.w, k1 = 1.0 / f - 1.0, dist = u_bsPar.w;
  vec3 O = -C * dist;
  vec3 Os = O + P * (dot(O, P) * k1), Ds = D + P * (dot(D, P) * k1);
  float a = dot(Ds, Ds), b = dot(Os, Ds), c = dot(Os, Os) - 1.0, h = b * b - a * c;
  float rc = sqrt(max(c + 1.0 - b * b / a, 0.0));                    // the ray's closest approach (stretched radii)
  float cover = b < 0.0 ? clamp(0.5 - (rc - 1.0) / (dist * px * 1.2), 0.0, 1.0) : 0.0;   // the limb's pixel coverage (in front of the eye only)
  float tP = cover > 0.0 ? (-b - sqrt(max(h, 0.0))) / a : -1.0;
  float dp = dot(D, P), tR = abs(dp) > 1e-7 ? -dot(O, P) / dp : -1.0;
  vec3 X = O + D * tR;
  float rR = length(X);
  bool ring = tR > 0.0 && rR > 1.24 && rR < 2.27;
  float lp = dot(L, P);
  if (tP > 0.0) {
    vec3 Ph = O + D * tP;
    vec3 N = normalize(Ph + P * (dot(Ph, P) * (1.0 / (f * f) - 1.0)));
    float sl = clamp(dot(N, P), -1.0, 1.0), lat = asin(sl) / BS_D2R, cphi = sqrt(max(0.0, 1.0 - sl * sl));
    vec3 E1 = u_bsParX.xyz, E2 = cross(P, E1);
    float band = clamp(2.6 * sin(lat * BS_D2R * 9.3 + 0.35), -1.0, 1.0);
    float lam = atan(dot(N, E2), dot(N, E1)) + u_bsParX.w * 2.2e-5 * band;   // (the zonal flow: every band its own speed)
    vec3 q3 = vec3(cphi * cos(lam), sl, cphi * sin(lam));
    float turb = (vnoise3(vec3(q3.x * 2.6, q3.y * 26.0, q3.z * 2.6)) - 0.5) * 3.0;
    if (u_bsSunK.w > 0.5) turb += (vnoise3(vec3(q3.x * 7.0, q3.y * 70.0, q3.z * 7.0) + 5.0) - 0.5) * 1.2;
    vec3 alb = bsBand(lat + turb);
    alb *= 1.0 + (vnoise3(vec3(q3.x * 5.0 + 11.0, q3.y * 90.0, q3.z * 5.0)) - 0.5) * (alb.b > alb.g + 0.08 ? 0.22 : 0.11);
    // the great storm (−23.5°, λ 1.1, 7.5° × 4.2° half-sizes): a teal eye in a pale collar, a darker ring round it
    float dl = (mod(lam - 1.1 + 3.14159265, 6.2831853) - 3.14159265) / BS_D2R * cphi, dq = lat + 23.5;
    float sq = sqrt(dl * dl / 56.25 + dq * dq / 17.64);
    if (sq < 1.35) {
      alb = mix(alb, vec3(${f3(lin([112, 92, 156]))}), (1.0 - smoothstep(1.05, 1.35, sq)) * 0.55);
      alb = mix(alb, vec3(${f3(lin([228, 238, 236]))}), 1.0 - smoothstep(0.8, 1.08, sq));
      alb = mix(alb, vec3(${f3(lin([64, 178, 186]))}), 1.0 - smoothstep(0.25, 0.78, sq));
    }
    // the light: limb darkening (Minnaert 1.05), a soft terminator in the deep haze; the ring's shadow across the bands
    float mus = dot(N, L), muv = max(dot(N, -D), 0.0);
    float lit = pow(max(mus, 0.0), 1.05) * pow(max(muv, 0.02), 0.05) * smoothstep(-0.04, 0.04, mus) + 0.012 * smoothstep(-0.2, 0.02, mus) * (1.0 - smoothstep(0.02, 0.1, mus));
    float tr = 1.0;
    if (u_bsParK.y > 0.5 && abs(lp) > 1e-4) { float tl = -dot(Ph, P) / lp; if (tl > 0.0) tr = exp(-bsRingTau(length(Ph + L * tl)) / abs(lp)); }
    vec3 pc = alb * u_bsSunCol * lit * tr + vec3(0.08, 0.08, 0.16) * u_bsSunCol * pow(1.0 - muv, 3.0) * smoothstep(-0.1, 0.3, mus) * tr;
    pc += alb * u_bsParK.z * (1.0 - smoothstep(-0.1, 0.1, mus));   // the night side in the ring's light
    col = mix(col, pc * u_bsLum.x, cover);
  }
  if (rc > 1.0 && rc < 1.04) {
    // over the limb: the haze above the cloud tops on Helia's side; against the light a thin bright rim (the eclipse)
    vec3 Pc = Os - Ds * (b / a), Nc = normalize(Pc + P * (dot(Pc, P) * (f - 1.0)));
    float hh = rc - 1.0, side = smoothstep(-0.15, 0.3, dot(Nc, L));
    float fwd = exp(-(1.0 - dot(D, L)) * 12.0);
    col += vec3(0.55, 0.52, 0.75) * u_bsSunCol * (exp(-hh / 0.006) * side * 0.25 + exp(-hh / 0.0035) * fwd * 2.5) * (1.0 - cover) * u_bsLum.x;
  }
  if (ring && (tP <= 0.0 || tR < tP)) {
    float tau = bsRingTau(rR);
    if (u_bsSunK.w > 1.5) tau *= 1.0 + (hash13(vec3(floor(rR * 6000.0), 1.0, 3.0)) - 0.5) * 0.25;   // (the finest ringlets)
    vec3 alb = bsRingCol(rR);
    float muv = max(abs(dp), 0.004), mu0 = max(abs(lp), 0.004);
    vec3 Ls = normalize(L + P * (lp * k1));
    float tc = -dot(X, Ls), sh = 1.0;
    if (tc > 0.0) { float dm = length(X + Ls * tc), w = max(1e-4, u_bsParK.w * tc); sh = smoothstep(1.0 - w, 1.0 + w, dm); }
    float cph = dot(L, -D), opp = 1.0 + 0.9 * exp(-(1.0 - cph) * 18.0);
    float dusty = 1.0 - smoothstep(0.3, 0.9, tau), fwd = 1.0 + dusty * 3.0 * exp(-(1.0 + cph) * 6.0);
    vec3 I;
    if (dot(O, P) * lp > 0.0) I = alb * 0.75 * (mu0 / (mu0 + muv)) * (1.0 - exp(-tau * (1.0 / mu0 + 1.0 / muv))) * opp;
    else { float e0 = exp(-tau / mu0), ev = exp(-tau / muv); float trn = abs(mu0 - muv) < 1e-3 ? (tau / mu0) * e0 : mu0 / (mu0 - muv) * (e0 - ev); I = alb * 0.75 * trn * fwd; }
    I = I * u_bsSunCol * sh + alb * u_bsSunCol * 0.012 * (1.0 - exp(-tau));   // (+ Amarant's own light on it)
    float al = 1.0 - exp(-tau / muv);
    col = col * (1.0 - al) + I * u_bsLum.x;
  }
  return col;
}
// the geysers' plumes: jets of ice over their vents, narrow at the vent and spreading as they rise (±2.6°); the way of
// the view through each (its closest approach to the column's axis). The ice thins as it spreads, so a jet is brightest
// at its foot and fades upward into a faint veil (run 1's columns, as bright at the top as wide, read as searchlights);
// the stripe's many small jets side by side as filaments (High: a noise across the column); bright against Helia (ice
// scatters forward), lit where Helia stands over the horizon at the jet's height (the tops keep the light after the
// ground's sunset) and dark while Amarant hides Helia (u_bsJk.x carries the free part of Helia's disc)
vec3 bsPlumes(vec3 D, vec3 col) {
  float pl = 0.0;
  for (int j = 0; j < 4; j++) {
    vec4 J = u_bsJ[j];
    float js = j == 0 ? u_bsJs.x : j == 1 ? u_bsJs.y : j == 2 ? u_bsJs.z : u_bsJs.w;
    if (J.w <= 0.0 || js <= 0.0) continue;
    vec3 V = J.xyz;
    float den = max(1.0 - D.y * D.y, 1e-4), dv = dot(D, V);
    float s = (dv - D.y * V.y) / den, hh = (D.y * dv - V.y) / den;
    if (s <= 0.0 || hh < 0.0 || hh > J.w * 1.08) continue;
    if (D.y < -u_bsGround.w && s > u_bsJk.y) continue;      // (behind the curve of the ground)
    vec3 q = D * s - V - vec3(0.0, hh, 0.0);
    float w = 2.5 + hh * 0.035, r2 = dot(q, q) / (w * w);
    if (r2 > 6.0) continue;
    float fil = 1.0;
    if (u_bsSunK.w > 0.5) { float lat = (q.z * D.x - q.x * D.z) / (w * sqrt(den)) + 0.35 * sin(hh * 0.004 + float(j) * 2.1); fil = 0.1 + 1.8 * vnoise3(vec3(lat * 2.4 + float(j) * 13.0, hh * 0.006, float(j) * 3.7)); }
    float fall = (exp(-hh / 320.0) + 0.08 * exp(-hh / (0.5 * J.w))) * (1.0 - smoothstep(0.78 * J.w, 1.08 * J.w, hh));
    float lit = smoothstep(-0.003, 0.003, u_bsSun.y + sqrt(2.0 * max(hh + V.y + u_bsJk.w, 0.0) / u_bsJk.z));
    pl += exp(-r2) * fil * fall * 0.45 * lit * js;
  }
  if (pl <= 0.0) return col;
  float ph = 0.25 + 2.2 * exp(-(1.0 - dot(D, u_bsSun.xyz)) * 5.0);
  return col + vec3(0.86, 0.93, 1.0) * u_bsSunCol * ph * pl * u_bsJk.x;
}
// u-orbit2 (R52-09: a uniform grey band): the far ground beyond the world's columns — where the view meets the ground
// (a plane at the eye's height over it), the regolith's or the ice's patches at four scales (30 m to 3 km), each faded
// out as its cells get smaller than the pixel's footprint there. From Low up (Very Low: the flat colour)
vec3 bsFarGround(vec3 D, float px) {
  vec3 g = u_bsGround.rgb;
  if (u_bsSunK.w < 0.5) return g;
  float dn = max(-D.y, 2e-4), t = u_bsJk.w / dn, fp = t * px / dn;
  vec2 q = u_bsEye.xz + D.xz * t;
  float v = 0.0, sc = 30.0, amp = 0.5;
  for (int i = 0; i < 4; i++) {
    float fade = 1.0 - smoothstep(0.25 * sc, sc, fp);
    if (fade > 0.0) v += (vnoise3(vec3(q / sc, float(i) * 3.7)) - 0.5) * amp * fade;
    sc *= 4.6; amp *= 0.8;
  }
  return g * (1.0 + v * 0.75);
}
// ---- u-moons2 · the air: the in-scattered light from the sky-view LUT (High … Low) or three stops (Very Low), and the
// view's transmittance (the stars, Helia's disc, the worlds behind the air)
vec3 bsAirSky(vec3 D) {
  if (u_bsAirK.z < 0.5) {
    float el = max(D.y, 0.0), k = sqrt(el);
    vec2 hs = normalize(u_bsSun.xz + vec2(1e-5, 0.0)), hd = normalize(D.xz + vec2(1e-5, 0.0));
    float wS = pow(max(dot(hs, hd), 0.0), 12.0) * exp(-max(0.0, el - 0.087) * 8.0);
    return (u_bsAir3[1] + (u_bsAir3[0] - u_bsAir3[1]) * k + (u_bsAir3[2] - u_bsAir3[1]) * wS) * (D.y < 0.0 ? 1.0 - 0.5 * min(1.0, -D.y * 4.0) : 1.0);
  }
  vec2 hs = normalize(u_bsSun.xz + vec2(1e-5, 0.0)), hd = normalize(D.xz + vec2(1e-5, 0.0));
  float ph = acos(clamp(dot(hs, hd), -1.0, 1.0)), u = sqrt(ph / 3.14159265);
  // (below the horizon the far land's air: the horizon's own texel row — a ray from the eye into the near ground is short
  // and dark, which drew a black band along the horizon)
  float el = asin(clamp(D.y, 0.0, 1.0)), l = sqrt(el / 1.5707963);
  vec2 uv = vec2((u * (u_bsAirS.x - 1.0) + 0.5) / u_bsAirS.x, max(0.5 + 0.5 * l, 0.5 + 0.5 / u_bsAirS.y));
  return texture(u_bsAir, uv).rgb * u_bsAirK.y;
}
vec3 bsAirTrans(vec3 D) { return exp(-u_bsAirT / max(D.y + 0.035, 0.035)); }
// Herzwelt over Aquamarin: oceans, continents, clouds and the polar ice (our own noise, not its map), lit by Helia
// with a soft terminator, its air a blue rim brightest against the light; the night side dark (no lights: no one there)
vec3 bsHerz(vec3 D, vec3 col, float px) {
  if (u_bsHz.w <= 0.0) return col;
  vec3 C = u_bsHz.xyz; float c = dot(D, C);
  if (c <= 0.0) return col;
  float q = length(cross(D, C)) / u_bsHz.w;
  if (q > 1.06) return col;
  vec3 o = (D - C * c) / u_bsHz.w; float qq = min(q, 1.0);
  vec3 N = o - C * sqrt(max(0.0, 1.0 - qq * qq));
  float mus = dot(N, u_bsSun.xyz);
  // its own frame: spun about the local up (its pole stands near the zenith's plane: a stated simplification)
  float cs = cos(u_bsHzX.x), sn = sin(u_bsHzX.x);
  vec3 P = vec3(cs * N.x - sn * N.z, N.y, sn * N.x + cs * N.z);
  float land = vnoise3(P * 2.2 + 3.1) * 0.6 + vnoise3(P * 5.5 + 7.0) * 0.28 + vnoise3(P * 13.0 + 1.0) * 0.12;
  float lat = abs(N.y);
  vec3 alb = land > 0.57 ? mix(vec3(0.07, 0.1, 0.04), vec3(0.26, 0.2, 0.12), smoothstep(0.6, 0.78, land)) : mix(vec3(0.004, 0.018, 0.05), vec3(0.01, 0.05, 0.08), smoothstep(0.5, 0.57, land));
  alb = mix(alb, vec3(0.75), smoothstep(0.84, 0.92, lat));
  // the clouds: bands of weather by latitude, streaks along them, a finer grain (thin over the deserts)
  float cl = vnoise3(vec3(P.x * 5.0, P.y * 11.0, P.z * 5.0) + vec3(u_bsHzX.y, 0.0, 0.0)) * 0.55 + vnoise3(P * 17.0 + 2.0) * 0.3 + 0.15 * sin(N.y * 9.0);
  alb = mix(alb, vec3(0.8), smoothstep(0.5, 0.72, cl) * 0.85);
  float lit = smoothstep(-0.06, 0.12, mus) * (0.35 + 0.65 * max(mus, 0.0));
  vec3 hc = alb * u_bsSunCol * lit * u_bsLum.y * 2.2;
  hc += vec3(0.25, 0.45, 1.0) * u_bsSunCol * 0.18 * pow(qq, 6.0) * smoothstep(-0.2, 0.3, mus) * u_bsLum.y;
  col = mix(col, hc, 1.0 - smoothstep(1.0 - 1.5 * px / u_bsHz.w, 1.0, q));
  // the air's rim beyond the limb
  if (q > 1.0) col += vec3(0.3, 0.5, 1.0) * u_bsSunCol * 0.1 * exp(-(q - 1.0) / 0.012) * smoothstep(-0.3, 0.4, dot(o / max(q, 1e-3), u_bsSun.xyz)) * u_bsLum.y;
  return col;
}
// Zinnober's umbrella plumes: sulfur-dioxide grains on ballistic arcs from the vent fill a paraboloid y = H − r²/4H
// (R = 2H at the ground: Pele's ring); the grains crowd at its envelope, so the plume reads as a thin shell — the view
// meets it analytically (no marching, no noise) and a shell seen edge-on is brighter (the path through it ∝ 1/cos);
// a faint core column over the vent; bluish-white in Helia's light (fine grains), strongest forward; lit where Helia
// stands over the horizon at the canopy's height
vec3 bsUmbrella(vec3 D, vec3 col) {
  float acc = 0.0;
  for (int j = 0; j < 4; j++) {
    vec4 J = u_bsJ[j];
    float js = j == 0 ? u_bsJs.x : j == 1 ? u_bsJs.y : j == 2 ? u_bsJs.z : u_bsJs.w;
    if (J.w <= 0.0 || js <= 0.0) continue;
    float H = J.w;
    vec3 V = J.xyz;
    float a = dot(D.xz, D.xz), b = dot(D.xz, V.xz), c = dot(V.xz, V.xz);
    float qa = a, qb = 4.0 * H * D.y - 2.0 * b, qc = c - 4.0 * H * V.y - 4.0 * H * H;
    float disc = qb * qb - 4.0 * qa * qc;
    float lit = smoothstep(-0.01, 0.01, u_bsSun.y + sqrt(2.0 * max(0.8 * H + V.y + u_bsJk.w, 0.0) / u_bsJk.z));
    if (disc > 0.0 && qa > 1e-6) {
      float sq = sqrt(disc);
      for (int k = 0; k < 2; k++) {
        float t = (-qb + (k == 0 ? -sq : sq)) / (2.0 * qa);
        if (t <= 0.0) continue;
        vec3 p = D * t - V;
        if (p.y < 0.0 || p.y > H) continue;
        if (D.y < -u_bsGround.w && t > u_bsJk.y) continue;
        vec3 n = normalize(vec3(p.x / (2.0 * H), 1.0, p.z / (2.0 * H)));
        float r = length(p.xz) / (2.0 * H);
        float edge = min(6.0, 1.0 / max(abs(dot(D, n)), 0.02));
        acc += 0.07 * edge * (0.45 + 0.8 * r) * (1.0 - smoothstep(0.85, 1.0, r)) * js * lit;
      }
    }
    // the core column: the gas rising over the vent (its closest approach to the axis)
    float den = max(1.0 - D.y * D.y, 1e-4), dv = dot(D, V), s = (dv - D.y * V.y) / den, hh = (D.y * dv - V.y) / den;
    if (s > 0.0 && hh > 0.0 && hh < H) { vec3 q = D * s - V - vec3(0.0, hh, 0.0); float w = 40.0 + hh * 0.03; acc += 0.25 * exp(-dot(q, q) / (w * w)) * (1.0 - hh / H) * js * lit; }
  }
  if (acc <= 0.0) return col;
  float ph = 0.45 + 1.6 * exp(-(1.0 - dot(D, u_bsSun.xyz)) * 4.0);
  return col + vec3(0.72, 0.84, 1.0) * u_bsSunCol * ph * (1.0 - exp(-acc)) * u_bsJk.x * 0.45;
}
// Ocker's dust devils: a narrow twisting column (u_bsJu.y wide at the foot, widening upward), dense at the foot,
// thinning upward; the dust's colour lit by Helia and the sky, blended over the view (it hides what is behind)
vec3 bsDevils(vec3 D, vec3 col) {
  for (int j = 0; j < 4; j++) {
    vec4 J = u_bsJ[j];
    float js = j == 0 ? u_bsJs.x : j == 1 ? u_bsJs.y : j == 2 ? u_bsJs.z : u_bsJs.w;
    if (J.w <= 0.0 || js <= 0.0) continue;
    vec3 V = J.xyz;
    float den = max(1.0 - D.y * D.y, 1e-4), dv = dot(D, V);
    float s = (dv - D.y * V.y) / den, hh = (D.y * dv - V.y) / den;
    if (s <= 0.0 || hh < 0.0 || hh > J.w) continue;
    float wob = 0.35 * u_bsJu.y * (1.0 + hh / 120.0);
    vec3 axis = vec3(sin(hh * 0.012 + u_bsJu.z * 0.7 + float(j)) * wob, hh, cos(hh * 0.009 + u_bsJu.z * 0.5 + float(j) * 2.0) * wob);
    vec3 q = D * s - V - axis;
    float w = u_bsJu.y * 0.5 * (1.0 + hh / 160.0), r2 = dot(q, q) / (w * w);
    if (r2 > 4.0) continue;
    float dens = exp(-r2 * 1.2) * exp(-hh / (0.35 * J.w)) * (1.0 - smoothstep(0.75 * J.w, J.w, hh)) * js;
    float fil = 0.7 + 0.6 * vnoise3(vec3(hh * 0.025 - u_bsJu.z * 1.5, sqrt(r2) * 1.3, float(j) * 3.1));
    float al = clamp(dens * fil * 1.0, 0.0, 0.9);
    // (the dust's own colour — redder and darker than the bright air behind it — lit more on Helia's side)
    vec3 dust = u_bsGround.rgb * vec3(0.9, 0.68, 0.5) * (0.75 + 0.35 * max(dot(normalize(vec3(q.x, 0.0, q.z) + 1e-4), u_bsSun.xyz), 0.0));
    col = mix(col, dust, al);
  }
  return col;
}
// ---- end u-moons2
vec3 bodySky(vec3 dir, bool withSun) {
  vec3 D = normalize(dir);
  float px = max(length(fwidth(D)), 1e-5);
  vec3 F = u_bsInert * D;
  vec3 col = (bsStars(F) + bsGalaxy(F)) * u_bsSunK.z * (u_bsAirK.x > 0.5 ? 1.0 - u_bsAirS.z : 1.0);
  if (withSun) col += bsSunDisc(D);
  col = bsBodies(D, col, px);
  col = bsAmarant(D, col, px);
  col = bsHerz(D, col, px);                                   // (u-moons2: Herzwelt over Aquamarin)
  if (u_bsAirK.x > 0.5) col = col * bsAirTrans(D) + bsAirSky(D);   // (u-moons2: the air in front of it all)
  col = u_bsJu.x > 1.5 ? bsDevils(D, col) : u_bsJu.x > 0.5 ? bsUmbrella(D, col) : bsPlumes(D, col);
  // the far ground below the true horizon (where the world's columns end): its lit colour, a one-pixel edge
  float gk = 1.0 - smoothstep(-u_bsGround.w - px, -u_bsGround.w + px, D.y);
  if (gk > 0.0) col = mix(col, u_bsAirK.x > 0.5 ? mix(bsFarGround(D, px), bsAirSky(D), u_bsAirK.w) : bsFarGround(D, px), gk);
  if (withSun) col += bsGlare(D) * (u_bsAirK.x > 0.5 ? bsAirTrans(u_bsSun.xyz) : vec3(1.0));
  return col;
}
vec3 skyColor(vec3 dir, bool withSun) { return u_dim == 5 ? bodySky(dir, withSun) : skyColorHome(dir, withSun); }
#endif
`;
  SH.bodySkyPre = () => '#ifdef BODYSKY\n#define skyColor skyColorHome\n#endif\n';
  SH.bodySky = () => BODY_SKY;

  const FULL_VS = QUAD_VS;   // (the background is the quad shader with u_half 0: the full-screen triangle)
  // f-rules (review v0.51 R52-02): the planet program's tier as AIRZ — the uniform from Low up, the constant 0.0 in
  // Very Low's own program herz_vl, so u-orbitlod's Low-and-up looks compile away there (v0.50's cost; test/orbit_vl.js)
  const HERZ_SRC = HERZ_FS.replace(/u_air\.z/g, 'AIRZ');
  SH.progFor = (d) => (d.prog === 'herz' && d.u && d.u.u_air && !(d.u.u_air[2] > 0.5) ? 'herz_vl' : d.prog);
  SH.programs = () => ({
    bg: { vs: FULL_VS, fs: BG_FS }, herz: { vs: QUAD_VS, fs: '#define AIRZ u_air.z\n' + HERZ_SRC }, giant: { vs: QUAD_VS, fs: GIANT_FS },
    herz_vl: { vs: QUAD_VS, fs: '#define AIRZ 0.0\n' + HERZ_SRC },   // f-rules: Very Low's Herzwelt
    ring: { vs: RING_VS, fs: RING_FS }, moon: { vs: QUAD_VS, fs: MOON_FS }, glare: { vs: QUAD_VS, fs: GLARE_FS },
    ptile: { vs: PTILE_VS, fs: '#define PTILE\n#define AIRZ u_air.z\n' + HERZ_SRC },   // u-orbitlod: the planet tiles (planetlod_gl.js)
  });
})(VR);

// ============================================================================
// GLSL sources
// ============================================================================
(function (VR) {
  'use strict';
  const S = VR.SHADERS = {};
  // Phase B1 „🎨 Aussehen": the recolour half every block shader shares with the Studio (src/shared/looks.js)
  const LOOK = (VR.Looks && VR.Looks.GLSL) || 'uniform highp sampler2D u_avgLum;\nbool lookOn(uint w5) { return false; }\nvec3 lookRecolor(vec3 alb, float layer, vec3 col) { return alb; }\n';

  // ------------------------------------------------------------ common sky/fog
  S.COMMON = `
uniform vec3 u_sunDir;
uniform vec3 u_moonDir;
uniform vec3 u_sunColor;
uniform vec3 u_moonColor;
uniform vec3 u_ambSky;
uniform vec3 u_skyZenith;
uniform vec3 u_skyHorizon;
uniform vec3 u_skyMid;       // t-sky: the sky's middle stop (env.js VR.Sky): the blue between the horizon's white-cyan and space
uniform vec4 u_skyStops;     // t-sky: x 1/h1 (the horizon gives way to the middle by dir.y h1); y h2a, z 1/(h2b - h2a) (the middle to the zenith from h2a to h2b); w the sun's halo — reciprocals from renderer.js, no division per pixel
uniform vec4 u_skySpace;     // t-sky: space (stars, nebula) shows through the day sky from dir.y x (none) over 1/y (all), z of it at the top; w: the nebula's brightness by day
uniform vec4 u_skyDay;       // t-sky2 (env.js VR.Sky): x, y the white-cyan haze band over the horizon — its strength and tightness (the band is (1 − y·dir.y)^16); z the day palette's weight (1 by day, 0 at dusk and night: the space by day and the nebula's day look follow it)
// t-sky: smoothstep from an edge and the reciprocal of the width (the renderer passes 1 / width: a multiply, not a division)
float sstepR(float e0, float rw, float x) { float t = clamp((x - e0) * rw, 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
uniform vec3 u_sunset;
uniform vec3 u_fogColor;
uniform vec4 u_fog;          // start, end, density, underwater
uniform float u_nebula;      // the cosmic veil's strength (the trailer's grade, env.js VR.Grade.nebula)
uniform float u_sunDisc;     // the sun's disc in HDR (VR.Grade.sunDisc): bright enough to read, not to flood the bloom
uniform float u_gridK;       // Klassisch: how far the block edges darken (VR.Grade.gridK)
uniform float u_rain;
uniform float u_time;
uniform float u_night;
uniform int u_dim;           // 0 overworld 1 underforge 2 hollow 3 drift
uniform vec3 u_blockLightTint;
uniform vec3 u_planetDir;
uniform vec3 u_planet2Dir;
uniform vec3 u_ringNormal;
uniform float u_skyMagic;    // how strongly the cosmic sky shows by day
uniform vec4 u_giant;        // gas giant: direction (xyz), angular radius (w) — skybodies.js
uniform vec4 u_blue;         // blue-green planet: direction, radius
uniform vec4 u_moon0;        // four grey moons: direction, radius
uniform vec4 u_moon1;
uniform vec4 u_moon2;
uniform vec4 u_moon3;
uniform float u_cirrus;      // high cirrus streaks: 1 on balanced and above, 0 on Very Low (the sky pass only)
uniform float u_animOn;      // Animierte Anzeigen (settings.anim): 1 animates the holo displays, the portal veil and the hall's light pulses
uniform float u_pulseA;      // texture layers of the Hangar Hall's pulsing wall strips (-1 when not loaded)
uniform float u_pulseB;
#ifdef MOTION
uniform vec2 u_cirrusDrift;  // t-motion: the cirrus' drift in its noise's space (renderer.js: the clouds' drift far up, a fifth of the cumulus' speed)
#endif
#ifdef CLOUDSH
// t-motion · the cloud shadows (clouds.js shadowMask, renderer.js): the cumulus' footprints, 128² over 1024 blocks in cloud
// space, 1 clear … 0 under a cloud's heart. u_cloudShadowM: xy the mask's origin in world blocks (the drift taken off), z 1 /
// its size, w the strength (the sun up, the sky not overcast). cloudShadow(world position): the point's way to the sun
// meets the cloud layer at y 210 — t-light2 multiplies it into its sun term
uniform sampler2D u_cloudShadow;
uniform vec4 u_cloudShadowM;
float cloudShadow(vec3 wp) {
  vec2 p = wp.xz + u_sunDir.xz * ((210.0 - wp.y) / max(u_sunDir.y, 0.12));
  float m = texture(u_cloudShadow, (p - u_cloudShadowM.xy) * u_cloudShadowM.z).r;
  return 1.0 - u_cloudShadowM.w * (1.0 - m);
}
#endif
#ifdef WXDRAMA
uniform vec4 u_storm;        // t-motion · Wetter-Drama: the storm's side (x, z: unit, where it comes from), its front 0..1, the rainbow 0..1
uniform vec4 u_bolt;         // t-motion: the bolt's heading (x, z: unit), its shape seed, its flash 0..1
#endif

// connected glass (w5 bit 14): one 32-texel tile per face, clamped inside it (an edge texel never wraps onto the frame
// of the opposite edge); bits 5, 6, 7, 15 say the face's top, right, bottom, left edge joins the same glass — the
// frame there (at most 2 texels wide) is mirrored away, so a wall of glass shows one frame around its outside only
vec2 ctmUV(vec2 uv, uint w5) {
  vec2 f = clamp(uv, vec2(0.5 / 32.0), vec2(1.0 - 0.5 / 32.0));
  uint m = ((w5 >> 5u) & 7u) | ((w5 >> 12u) & 8u);
  const float W = 2.0 / 32.0;
  if ((m & 1u) != 0u && f.y < W) f.y = 2.0 * W - f.y;
  if ((m & 4u) != 0u && f.y > 1.0 - W) f.y = 2.0 * (1.0 - W) - f.y;
  if ((m & 8u) != 0u && f.x < W) f.x = 2.0 * W - f.x;
  if ((m & 2u) != 0u && f.x > 1.0 - W) f.x = 2.0 * (1.0 - W) - f.x;
  return f;
}
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p3){ p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
// 4x4 ordered dither in [0, 15/16] (McGuire's closed form): the chunks' fade-in and the far tiles' cut use the same thresholds
float bayer2(vec2 a){ a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer4(vec2 a){ return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash12(i), hash12(i+vec2(1,0)), f.x), mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), f.x), f.y); }
float vnoise3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  float a = mix(mix(hash13(i), hash13(i+vec3(1,0,0)), f.x), mix(hash13(i+vec3(0,1,0)), hash13(i+vec3(1,1,0)), f.x), f.y);
  float b = mix(mix(hash13(i+vec3(0,0,1)), hash13(i+vec3(1,0,1)), f.x), mix(hash13(i+vec3(0,1,1)), hash13(i+vec3(1,1,1)), f.x), f.y);
  return mix(a, b, f.z); }
float fbm3(vec3 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += vnoise3(p) * a; p = p * 2.03 + 17.1; a *= 0.5; } return v / 0.9375; }
float fbm3L(vec3 p){ return vnoise3(p) * 0.6667 + vnoise3(p * 2.03 + 17.1) * 0.3333; }   // two octaves, the same scale as fbm3 (Very Low)

// ---- cosmic sky: nebula band, ringed gas giant, second planet, meteors ----
// t-sky2 · the nebula's structure (our own noise and numbers). The gas: the value-noise fbm, in the band a little drawn out
// along it, off the band swirled by two low fields (the clouds flow instead of lying on a grid). The dust: soft dark
// clouds as before, and where the gas is dense a ridged term (1 − |2n − 1|) whose crests are thin dark lanes and whose
// shoulders are lit edges (in a domain drawn out across the band, so the lanes run along it). The hue field adds an
// orange-gold zone and a cyan zone to the old violet-blue, pink and cyan. dayK (the day palette's weight, u_skyDay.z):
// by day the veil's clouds cover every view's top off the band, the band breaks into clouds with dark sky between, the
// lanes and rims are full and the colours a little softer (the frames' day nebula: C* up to ~42); at dusk and at night
// (dayK 0) t-sky's band and thin wisps, the lanes and rims faint. Noise calls: High 13 (was 16: the dust's four octaves
// became two, n3 the low hue field); Very Low (LITE) 3 (was 4: two octaves of gas, one of colour, the hue zones from them; no
// dust as before, no lanes, no swirl).
vec3 nebula(vec3 dir, float dayK) {
  vec3 G = normalize(vec3(0.32, 0.62, -0.72));
  float b = dot(dir, G);
  float band = exp(-b * b * 7.0);
  vec3 p = dir * 2.6;
#ifdef LITE
  // Very Low: no swirl, the hue zones from the gas itself (three noise calls, one fewer than before); the domain turned
  // once (a fixed rotation, nine multiply-adds), so the value noise's lattice does not lie along the sky's axes — the
  // clouds drift diagonally instead of standing as soft rectangles
  vec3 q = mat3(0.8432, 0.4503, -0.2936, -0.2936, 0.8432, 0.4503, 0.4503, -0.2936, 0.8432) * (p + G * (b * 0.9));
  float n1 = fbm3L(q + vec3(0.0, u_time * 0.0015, 0.0));
  float n2 = vnoise3(q * 2.1 + 11.0);
  float hz = n1 * 0.7 + n2 * 0.3;
#else
  float hz = vnoise3(p * 0.55 + 31.0);
  float wz = fbm3L(p * 0.9 + 7.0);
  // the gas's domain: in the band as before (a little drawn out along it); off the band swirled by two low fields, so the
  // veil's clouds flow instead of lying on a grid
  vec3 q = p + (vec3(0.9, -0.5, 0.7) * (hz - 0.5) * 1.2 + vec3(-0.6, 0.3, 0.9) * (wz - 0.5) * 1.6) * (1.0 - band) + G * (b * 0.9);
  float n1 = fbm3(q + vec3(0.0, u_time * 0.0015, 0.0));
  float n2 = fbm3(q * 2.1 + 11.0);
  float nd = fbm3L(q * 1.85 - 1.5 + G * (b * 4.8));   // the dust's domain: drawn out across the band, so its lanes run along it
#endif
  // the dust: soft dark clouds (as before), and where the gas is dense thin dark lanes — the ridged term's crests — with
  // lit edges beside them
#ifdef LITE
  float soft = 0.0, lane = 0.0, rim = 0.0;   // (Very Low: no dust, as before; one octave's crests would be drawn curves)
#else
  float soft = smoothstep(0.42, 0.78, nd);
  float ridge = 1.0 - abs(2.0 * nd - 1.0);
  float dense = smoothstep(0.5, 0.7, n1);
  // (t-sky2, continued: the lanes a little wider and softer, the rims fainter — the thin dark crests read as ink lines,
  // the frames' dust is soft dark gas)
  float lane = smoothstep(0.84, 0.99, ridge) * dense;
  float rim = smoothstep(0.66, 0.86, ridge) * (1.0 - smoothstep(0.84, 0.99, ridge)) * dense;
#endif
  vec3 col = mix(vec3(0.22, 0.06, 0.46), vec3(0.10, 0.36, 1.0), smoothstep(0.3, 0.7, n1));
  col = mix(col, vec3(1.0, 0.30, 0.68), smoothstep(0.48, 0.78, n2) * 0.9);
  col = mix(col, vec3(1.0, 0.62, 0.3), smoothstep(0.23, 0.15, hz) * (0.35 + 0.4 * dayK));
  col = mix(col, vec3(0.15, 0.95, 1.0), smoothstep(0.62, 0.8, hz) * 0.55);
  // bright pink cores, as in the trailer (by day softer: the frames' day nebula is moderately saturated, C* up to ~42)
  col += vec3(1.0, 0.55, 0.85) * smoothstep(0.72, 0.9, n2 * 0.6 + n1 * 0.5) * (0.9 - 0.4 * dayK);
  col = mix(col, vec3(dot(col, vec3(0.3, 0.5, 0.2))), 0.22 * dayK);
  vec3 coreDir = normalize(vec3(0.62, 0.42, -0.66));
  float cd = max(0.0, dot(dir, coreDir));
  float c2 = cd * cd, c4 = c2 * c2, c8 = c4 * c4, c16 = c8 * c8;   // (cd^60 and cd^12 as products: no pow per pixel)
  float core = (c16 * c16 * c16 * c8 * c4 * 2.2 + c8 * c4 * 0.5) * (1.0 - 0.4 * dayK);   // (by day a smaller glare: the planets stay clear)
  col += vec3(1.0, 0.78, 0.6) * core;
  // off the band: at night t-sky's thin wisps; by day (dayK) the veil's clouds over every view's top, sharp-edged so the
  // dark sky shows between them; by day the band too breaks into clouds (the frames' tops: vivid clouds, dark gaps)
#ifdef LITE
  float wisp = 0.0;
#else
  float wisp = smoothstep(0.55, 0.85, n2) * smoothstep(0.15, 0.7, dir.y) * 0.3;
#endif
#ifdef LITE
  float cloud = smoothstep(0.4, 0.78, n1 * 0.8 + n2 * 0.3) * (0.4 + n1) * smoothstep(0.1, 0.5, dir.y) * 0.8;   // (two octaves: a softer edge, no round blobs)
#else
  float cloud = smoothstep(0.5, 0.66, n1 * 0.8 + n2 * 0.3) * (0.4 + n1) * smoothstep(0.1, 0.5, dir.y) * 0.8;
#endif
#ifdef LITE
  float clump = mix(1.0, smoothstep(0.36, 0.74, n1 * 0.8 + n2 * 0.3), dayK * 0.9);
#else
  float clump = mix(1.0, smoothstep(0.44, 0.66, n1 * 0.8 + n2 * 0.3), dayK * 0.9);
#endif
  float dusty = (1.0 - 0.65 * soft) * (1.0 - (0.2 + 0.35 * dayK) * lane) * (1.0 + (0.2 + 0.25 * dayK) * rim);   // (the lanes and rims faint at night: the night keeps its soft look)
  float dens = band * (0.35 + 1.35 * n1 * n1) * clump * dusty + (1.0 - band) * mix(wisp, cloud * dusty, dayK) + core * 0.6;
  // sparkling star clusters inside the band
  vec3 g = floor(dir * 520.0);
  float s = hash13(g);
  dens += step(0.9975, s) * band * 3.0;
  vec3 res = col * dens;
#ifndef LITE
  // t-polish · the filaments (t1_05): fine bright threads and knots over the clouds — a ridged fbm of two octaves of the
  // value noise in the gas's own domain drawn out along the band (squeezed across it ×10) and bent by the gas, so the
  // threads follow the flow and curl with the clouds; thin crests (the ridge to the 6th), the second octave (a 2-D noise
  // of the same domain, half the cost) breaking the first's threads and brightening where both crest (the knots); only
  // where the gas is dense (the clouds carry them), the gas's own colour lifted. Strength u_skyDay.w (env.js VR.Sky.fil,
  // at dusk and at night 0.3 of it); one 3-D and one 2-D noise call where the mask is on, none on Very Low (not in its
  // shader). (A cell network — the ridges of isotropic noise — and straight parallel streaks were the two ways it went wrong)
  float fm = smoothstep(0.1, 0.36, dens) * smoothstep(0.4, 0.62, n2) * u_skyDay.w;
  if (fm > 0.0) {   // (the noise only where the gas can carry a thread)
    vec3 qf = q * 4.0 + G * (b * 40.0) + vec3(n1 - 0.5, n2 - 0.5, hz - 0.5) * 3.6;
    float r1 = 1.0 - abs(2.0 * vnoise3(qf) - 1.0), r2 = 1.0 - abs(2.0 * vnoise(vec2(dot(qf, vec3(0.8, 0.0, 0.6)), dot(qf, vec3(-0.36, 0.8, 0.48))) * 2.17 + 5.3) - 1.0);
    r1 *= r1; r1 *= r1 * r1; r2 *= r2; r2 *= r2;
    float fil = smoothstep(0.2, 0.8, r1 * (0.35 + 0.65 * r2) + r1 * r2 * 1.1) * fm;
    res += (col * 1.4 + vec3(0.08)) * fil * (0.55 + 0.25 * dayK);
  }
#endif
  return res;
}
// t-sky2 · the planets' light: from the sun's side, the part along the line of sight damped (× 0.3), so a planet seen
// away from the sun is not a flat full disc but shows a lit side and a soft terminator, and one seen toward it is not a
// black disc (the trailer's planets: lit from one side, the night side dark, t1_05). t-sky2, continued: the light leans
// toward the viewer (− C · 0.25, and a sun behind the planet is turned round), so every view shows the trailer's lit
// gibbous disc with a dark crescent on the side away from the sun — a planet near the sun was a black disc with a rim
vec3 bodyLight(vec3 C, vec3 L) { float lc = dot(L, C); return normalize(L - C * (max(lc, 0.0) * 1.15 + min(lc, 0.0) * 0.7 + 0.25)); }
// the ring's density at a radius (in planet radii), shared by the ring and its shadow on the body (t-sky2, continued: a
// broad sheet of four or five soft bands, as the trailer's ring — the thin bright lines read as wire hoops)
float ringDens(float rr) {
  float ring = (0.78 + 0.22 * sin(rr * 24.0 + 0.8)) * (0.8 + 0.2 * sin(rr * 9.0 + 2.0));
  return ring * smoothstep(1.3, 1.4, rr) * smoothstep(2.45, 2.3, rr) * (1.0 - smoothstep(1.83, 1.86, rr) * smoothstep(1.92, 1.89, rr));
}
vec4 gasGiant(vec3 dir, vec3 C, float R, vec3 L) {
  float cz = dot(dir, C);
  if (1.0 - cz > R * R * 3.6) return vec4(0.0);   // (t-sky2: past ~2.7 radii nothing of it — its ring ends at 2.45 — so the rest of the sky skips it; was a 60° cone)
  vec3 up = abs(C.y) < 0.95 ? vec3(0, 1, 0) : vec3(1, 0, 0);
  vec3 X = normalize(cross(up, C)), Y = cross(C, X);
  vec2 q = vec2(dot(dir, X), dot(dir, Y)) / R;
  float r2 = dot(q, q);
  vec3 RN = u_ringNormal;
  float den = dot(C, RN);
  vec3 Lb = bodyLight(C, L);   // (only the ~2.7 radii round the giant get here)
  vec4 res = vec4(0.0);
  // planet body
  float ts = 1e9;
  if (r2 < 1.0) {
    float zz = sqrt(1.0 - r2);
    ts = -zz;
    vec3 N = normalize(X * q.x + Y * q.y - C * zz);
    float lat = dot(N, RN);
    float w = fbm3(N * 3.0 + vec3(u_time * 0.004, 0.0, 0.0));
    float bands = sin(lat * 22.0 + w * 5.0) * 0.5 + 0.5;
    vec3 c1 = vec3(0.80, 0.62, 0.95), c2 = vec3(0.46, 0.24, 0.66), c3 = vec3(1.0, 0.86, 0.95);
    vec3 alb = mix(c2, c1, bands);
    alb = mix(alb, c3, smoothstep(0.62, 0.9, fbm3(N * 7.0 + 4.0)) * 0.5);
    float storm = exp(-pow(length(N - normalize(RN * -0.3 + X * 0.6 + C * -0.5)) * 5.0, 2.0));
    alb = mix(alb, vec3(0.25, 0.85, 0.9), storm * 0.8);
    // t-sky2: a soft terminator (wrapped), the ring's shadow on the body (the ray to the light crosses the ring plane
    // inside the ring), the limb darkened
    float diff = smoothstep(-0.25, 0.55, dot(N, Lb));
#ifdef LITE
    float shade = 1.0;   // (Very Low: no ring shadow)
#else
    // (the shadow's light a little flatter to the ring plane than the sun's, so the band falls on the body in most views)
    vec3 Ls = normalize(Lb - RN * (dot(Lb, RN) * 0.6));
    float ld = dot(Ls, RN), sr = abs(ld) > 0.01 ? -dot(N, RN) / ld : -1.0;
    float shade = sr > 0.0 && sr < 6.0 ? 1.0 - 0.75 * ringDens(length(N + Ls * sr)) : 1.0;
#endif
    float rim = pow(1.0 - zz, 3.0);
    vec3 col = alb * (diff * shade * 1.3 + 0.12) * (0.6 + 0.4 * sqrt(zz)) + vec3(0.4, 0.6, 1.0) * rim * 0.45 * diff;   // 0.12: the night side keeps a trace of its bands
    float edge = smoothstep(1.0, 0.96, sqrt(r2));
    res = vec4(col, edge);
  }
#ifndef LITE
  else if (r2 < 1.44) {
    // the soft limb: a thin lilac glow round the lit side (within 1.2 radii; not on Very Low)
    float r = sqrt(r2);
    vec2 lq = vec2(dot(Lb, X), dot(Lb, Y));
    float side = smoothstep(-0.3, 0.6, dot(q / r, lq));
    res = vec4(vec3(0.6, 0.45, 0.85) * exp(-(r - 1.0) * 26.0) * 0.35 * side, 0.0);
  }
#endif
  // rings
  if (abs(den) > 0.02) {
    float t = -(q.x * dot(X, RN) + q.y * dot(Y, RN)) / den;
    vec3 P = X * q.x + Y * q.y + C * t;
    float rr = length(P);
    if (rr > 1.3 && rr < 2.45 && (t < ts || r2 >= 1.0)) {
      float ring = ringDens(rr);
      float s0 = -dot(P, Lb);
      float sh = 1.0;
      if (s0 > 0.0 && length(P + Lb * s0) < 1.0) sh = 0.12;
      // (t-sky2, continued: the trailer's ring colours — lilac inside, cyan in the middle, peach outside)
      vec3 rc = mix(mix(vec3(0.95, 0.64, 0.95), vec3(0.48, 0.9, 0.98), smoothstep(1.5, 1.8, rr)), vec3(1.0, 0.74, 0.54), smoothstep(1.95, 2.3, rr));
      vec3 rcol = rc * (0.25 + 1.1 * max(0.15, abs(dot(RN, L)))) * sh;
      float a = ring * 0.85;
      res.rgb = mix(res.rgb, rcol, a);
      res.a = max(res.a, a);
    }
  }
  return res;
}
vec4 rockyPlanet(vec3 dir, vec3 C, float R, vec3 L) {
  float cz = dot(dir, C);
  if (1.0 - cz > R * R * 0.9) return vec4(0.0);   // (t-sky2: past ~1.34 radii nothing of it; was a 60° cone)
  vec3 up = abs(C.y) < 0.95 ? vec3(0, 1, 0) : vec3(1, 0, 0);
  vec3 X = normalize(cross(up, C)), Y = cross(C, X);
  vec2 q = vec2(dot(dir, X), dot(dir, Y)) / R;
  float r2 = dot(q, q);
  if (r2 >= 1.69) return vec4(0.0);   // (t-sky2: past 1.3 radii the glow is nil: the rest of the cone skips it)
  vec3 Lb = bodyLight(C, L);
  // t-sky2: the atmosphere's glow brighter on the lit side (the soft limb)
#ifdef LITE
  if (r2 >= 1.0) { float glow = exp(-(sqrt(r2) - 1.0) * 14.0) * 0.25; return vec4(vec3(0.4, 0.7, 1.0) * glow, 0.0); }
#else
  if (r2 >= 1.0) { float r = sqrt(r2); float side = 0.35 + 0.65 * smoothstep(-0.3, 0.6, dot(q / r, vec2(dot(Lb, X), dot(Lb, Y)))); float glow = exp(-(r - 1.0) * 14.0) * 0.25 * side; return vec4(vec3(0.4, 0.7, 1.0) * glow, 0.0); }
#endif
  float zz = sqrt(1.0 - r2);
  vec3 N = normalize(X * q.x + Y * q.y - C * zz);
  float n = fbm3(N * 4.0 + 7.0);
  vec3 alb = mix(vec3(0.2, 0.35, 0.75), vec3(0.3, 0.6, 0.45), smoothstep(0.45, 0.6, n));
  alb = mix(alb, vec3(0.95), smoothstep(0.62, 0.75, fbm3(N * 6.0 - 2.0)) * 0.7);
  float diff = smoothstep(-0.2, 0.5, dot(N, Lb));   // t-sky2: a soft terminator
  vec3 col = alb * (diff * 1.25 + 0.03) * (0.65 + 0.35 * sqrt(zz)) + vec3(0.4, 0.7, 1.0) * pow(1.0 - zz, 2.5) * 0.5 * (0.25 + 0.75 * diff);
  return vec4(col, smoothstep(1.0, 0.96, sqrt(r2)));
}
// small grey cratered moons (lit by the sun, faint earthshine on the dark side)
vec4 moonlet(vec3 dir, vec3 C, float R, vec3 L, float seed) {
  float cz = dot(dir, C);
  if (1.0 - cz > R * R * 0.6) return vec4(0.0);   // (t-sky2: past ~1.1 radii nothing of it; was a 25° cone)
  vec3 up = abs(C.y) < 0.95 ? vec3(0, 1, 0) : vec3(1, 0, 0);
  vec3 X = normalize(cross(up, C)), Y = cross(C, X);
  vec2 q = vec2(dot(dir, X), dot(dir, Y)) / R;
  float r2 = dot(q, q);
  if (r2 >= 1.0) return vec4(0.0);
  float zz = sqrt(1.0 - r2);
  vec3 N = normalize(X * q.x + Y * q.y - C * zz);
  float cr = vnoise(q * 3.0 + seed) * 0.6 + vnoise(q * 7.0 - seed) * 0.4;
  vec3 alb = vec3(0.72, 0.70, 0.74) * (0.75 + cr * 0.4);
  float diff = smoothstep(-0.15, 0.45, dot(N, bodyLight(C, L)));   // t-sky2: the planets' light, a soft terminator
  return vec4(alb * (diff * 1.3 + 0.06), smoothstep(1.0, 0.9, sqrt(r2)));
}
vec3 meteors(vec3 dir) {
  vec3 acc = vec3(0.0);
  for (int k = 0; k < 3; k++) {
    float slot = floor(u_time / 5.3 + float(k) * 0.37);
    float ph = fract(u_time / 5.3 + float(k) * 0.37);
    float h1 = hash12(vec2(slot, float(k) * 7.1)), h2 = hash12(vec2(slot * 1.7, 3.3 + float(k)));
    if (hash12(vec2(slot, 9.9 + float(k))) > 0.45 || ph > 0.25) continue;
    vec3 start = normalize(vec3(cos(h1 * 6.283), 0.45 + h2 * 0.5, sin(h1 * 6.283)));
    vec3 dirm = normalize(cross(start, vec3(0.3, 1.0, 0.2)));
    float prog = ph / 0.25;
    vec3 head = normalize(start + dirm * prog * 0.5);
    vec3 tail = normalize(start + dirm * max(0.0, prog - 0.25) * 0.5);
    vec3 ab = head - tail;
    float t = clamp(dot(dir - tail, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
    float d = length(dir - (tail + ab * t));
    acc += vec3(0.8, 0.9, 1.0) * exp(-d * 900.0) * t * (1.0 - prog) * 3.0;
  }
  return acc;
}

vec3 skyColor(vec3 dir, bool withSun) {
  if (u_dim == 1) return u_fogColor;
  if (u_dim == 2) {
    vec3 c = vec3(0.012, 0.006, 0.03);
    c += nebula(dir, 0.0) * 0.8;
    return c;
  }
  float h = max(dir.y, 0.0);
  // t-sky: the trailer's sky in three stops (env.js VR.Sky) — by day white-cyan at the horizon, the blue middle, navy
  // space at the zenith; at dusk lavender, violet, navy — over a thin, luminous haze band at the horizon
  vec3 col = mix(u_skyHorizon, u_skyMid, sstepR(0.0, u_skyStops.x, h));
  // (t-sky2: by day the zenith stop is the dark ground of space; with 'Kosmischer Himmel am Tag' turned down it stays a
  // day navy, lifted toward the middle blue)
  col = mix(col, u_skyZenith + u_skyMid * (0.4 * (1.0 - min(1.0, u_skyMagic * 1.25)) * u_skyDay.z), sstepR(u_skyStops.y, u_skyStops.z, h));
  float dayK = 1.0 - u_night;
  float qh = 1.0 - h, qh2 = qh * qh, qh4 = qh2 * qh2, qh8 = qh4 * qh4;   // (1 - h)^n as squarings: the bands without a pow
  // the haze band over the horizon (t-sky2: its strength and tightness from VR.Sky.haze, fitted to the frames' haze)
  float zh = 1.0 - min(1.0, h * u_skyDay.y), zh2 = zh * zh, zh4 = zh2 * zh2, zh8 = zh4 * zh4;
  col = mix(col, u_skyHorizon * vec3(1.16, 1.1, 1.02) + vec3(0.035, 0.04, 0.03) * dayK, zh8 * zh8 * u_skyDay.x * dayK);
  float toSun = max(dot(dir, u_sunDir), 0.0);
  float horizonBand = qh4 * qh;
  float ts2 = toSun * toSun, ts4 = ts2 * ts2, ts8 = ts4 * ts4, ts16 = ts8 * ts8;   // (the sun's powers as products: no pow per pixel)
  float t7 = ts4 * ts2 * toSun;
  col += u_sunset * (t7 * 1.3 + horizonBand * 0.45) * (0.3 + 0.7 * toSun);
  // t-sky2: by day a glow round the sun over the dark ground of space (the sky near the sun is bright, not navy; within
  // ~25°, so the space beyond stays dark)
  col += u_sunColor * (t7 * t7) * 0.07 * u_skyDay.z * (1.0 - u_rain);
  // t-sky2 · the day aureole: round the sun (within ~60°, under ~50° of elevation) the dark ground of space lifts to a
  // light blue, so the space that fades toward the sun leaves a lilac-blue halo, not a muddy dark ring; the high sky
  // above the sun stays the navy space (as the trailer's dusk keeps its top dark over the sun)
  float aurK = smoothstep(0.5, 0.98, toSun) * (1.0 - smoothstep(0.52, 0.8, h));
  col = max(col, u_skyMid * (2.0 * aurK * aurK * u_skyDay.z * (1.0 - u_rain)));
  col += u_sunColor * (ts16 * ts16 * ts16 * ts8 * ts4) * u_skyStops.w * (1.0 - u_rain);   // the sun's halo, toSun^60 (t-sky: u_skyStops.w, tighter by day)
  if (dir.y < 0.0) col = mix(col, u_skyHorizon * 0.55, clamp(-dir.y * 2.5, 0.0, 1.0));
  if (withSun) {
    float clear = 1.0 - u_rain;
    // cosmic layer: the nebula owns the night; by day it shows above the blue band, and the ringed giant and its moons
    // keep hanging in the daylight sky. t-sky2: the 'Kosmischer Himmel am Tag' setting at its default (0.8) shows space
    // fully by day (the trailer's day: deep navy space with dense stars and the nebula over the top of every view)
    float magicDay = min(1.0, u_skyMagic * (1.0 + 0.25 * u_skyDay.z)) * (1.0 - u_night);
    float horizonFade = smoothstep(-0.12, 0.08, dir.y);
    // t-sky: space shows through the day sky by height — none over the clean, bright horizon, all of it above the blue
    // band (u_skySpace: t-sky2 from dir.y 0.18 to 0.42) — and all of it at night; the stars and the nebula follow it
    float cosmic = clamp(u_night + magicDay * sstepR(u_skySpace.x, u_skySpace.y, dir.y) * u_skySpace.z, 0.0, 1.0) * clear * horizonFade;
    cosmic *= 1.0 - 0.6 * smoothstep(0.45, 0.92, toSun) * u_skyDay.z;   // t-sky2: by day space fades toward the sun (its light washes the sky within ~60° of it)
    float planetsK = clamp(u_night + magicDay * 0.85, 0.0, 1.0) * clear * horizonFade;
    if (planetsK > 0.01) {
      // the nebula: by day its veil covers the top (1), at night the band carries it (0.3); its brightness by day
      // u_skySpace.w (t-sky2: fitted to the frames' chroma), at night 0.9; u_nebula: the grade's knob (t-look)
      // (t-polish: on High and Balanced only where space shows — by day below the blue band cosmic is 0 and the nebula's
      // thirteen noise calls were spent for nothing; Very Low's three cost less than the branch on SwiftShader)
#ifdef LITE
      col += nebula(dir, u_skyDay.z) * cosmic * mix(u_skySpace.w, 0.9, u_night) * u_nebula;
#else
      if (cosmic > 0.0) col += nebula(dir, u_skyDay.z) * cosmic * mix(u_skySpace.w, 0.9, u_night) * u_nebula;
#endif
      vec4 gg = gasGiant(dir, u_planetDir, u_giant.w, u_sunDir);
      col = mix(col, gg.rgb * (0.75 + 0.25 * u_night) + col * 0.15 * (1.0 - u_night), gg.a * mix(0.85, 1.0, u_night) * clear);
      // the big blue-green cratered planet hangs high in the sky (trailer shot B)
      vec4 rp = rockyPlanet(dir, u_planet2Dir, u_blue.w, u_sunDir);
      col += rp.rgb * (1.0 - rp.a) * planetsK * 0.6;
      col = mix(col, rp.rgb * (0.7 + 0.3 * u_night) + col * 0.2, rp.a * mix(0.85, 1.0, u_night) * clear);
      // the giant's moons ride along with it; a fourth drifts near the blue planet (skybodies.js: places and radii)
      vec4 mn = moonlet(dir, u_moon0.xyz, u_moon0.w, u_sunDir, 0.0);
      col = mix(col, mn.rgb * (0.45 + 0.55 * u_night) + col * 0.1, mn.a * planetsK * clear);
      mn = moonlet(dir, u_moon1.xyz, u_moon1.w, u_sunDir, 7.3);
      col = mix(col, mn.rgb * (0.45 + 0.55 * u_night) + col * 0.1, mn.a * planetsK * clear);
      mn = moonlet(dir, u_moon2.xyz, u_moon2.w, u_sunDir, 14.6);
      col = mix(col, mn.rgb * (0.45 + 0.55 * u_night) + col * 0.1, mn.a * planetsK * clear);
      mn = moonlet(dir, u_moon3.xyz, u_moon3.w, u_sunDir, 21.9);
      col = mix(col, mn.rgb * (0.45 + 0.55 * u_night) + col * 0.1, mn.a * planetsK * clear);
    }
    // the sun (t-sky2: a soft glow, as the trailer's — a Gaussian core of about 1.1° where the hard disc was, in a warm
    // halo of about 3.5° that is not clipped to a flat disc; only near the sun, the rest of the sky skips it)
    float sd = dot(dir, u_sunDir);
    if (sd > 0.985) {
      float e = 1.0 - sd, sl = dot(u_sunColor, vec3(0.3, 0.59, 0.11));
      vec3 sc = u_sunColor * (max(sl, 0.9) / max(sl, 1e-3));   // the disc stays bright down to the horizon (its light on the land dims, not the disc)
      col += sc * (u_sunDisc * exp(-e * 7000.0) + vec3(1.1, 0.85, 0.55) * exp(-e * 500.0)) * clear;
    }
    float md = dot(dir, u_moonDir);
    if (md > 0.9992) {
      vec3 up = abs(u_moonDir.y) < 0.99 ? vec3(0,1,0) : vec3(1,0,0);
      vec3 mx = normalize(cross(up, u_moonDir)), my = cross(u_moonDir, mx);
      vec2 mp = vec2(dot(dir, mx), dot(dir, my)) / 0.04;
      float phase = fract(u_time / 1200.0 / 8.0);
      float lit = smoothstep(-0.1, 0.1, mp.x * cos(phase * 6.2831) + 0.35 * sin(phase * 6.2831));
      float crater = 0.78 + 0.22 * vnoise(mp * 4.0 + 10.0);
      col += vec3(0.85, 0.9, 1.0) * 3.2 * crater * mix(0.06, 1.0, lit) * clear * smoothstep(1.0, 0.95, length(mp));
    }
    if (u_night > 0.0) {   // the moon's glow, md^400 as products (t-sky2: by day the whole sky skips it — it was multiplied by 0)
      float m2 = max(md, 0.0); m2 *= m2; float m4 = m2 * m2, m8 = m4 * m4, m16 = m8 * m8, m32 = m16 * m16, m128 = m32 * m32; m128 *= m128;
      col += vec3(0.6, 0.7, 1.0) * (m128 * m128 * m128 * m16) * 0.4 * clear * u_night;
    }
    // high cirrus (t-clouds): u_cirrus is 0 on Very Low (t-sky2: and the code is not in its shader). t-sky2: a few thin high wisps (the trailer's) instead of the wide
    // pale streaks — a noise drawn out 14:1 along the wind, cut thin, in a few patches (a slow mask: about a fifth of the
    // sky), at up to half alpha, so the nebula and the stars show through them
#ifndef LITE
    if (u_cirrus > 0.0 && dir.y > 0.1) {
      vec2 q = dir.xz / (dir.y + 0.1);
#ifdef MOTION
      float a = vnoise(vec2(q.x * 0.35 + q.y * 0.2, q.y * 5.0 + 3.0) + u_cirrusDrift);   // (t-motion: the cirrus drift slowly with the wind, far above the cumulus)
#else
      float a = vnoise(vec2(q.x * 0.35 + q.y * 0.2, q.y * 5.0 + 3.0) + vec2(u_time * 0.0025, 0.0));
#endif
      float b = vnoise(vec2(q.x * 0.6 - 7.0, q.y * 13.0 - 1.0));
      float st = smoothstep(0.74, 0.9, a * 0.7 + b * 0.38) * smoothstep(0.55, 0.72, vnoise(q * 0.22 + 17.0));
      st *= smoothstep(0.14, 0.28, dir.y) * (1.0 - smoothstep(0.55, 0.8, dir.y));   // (none right over the horizon: the haze band stays clean)
      vec3 cir = vec3(0.82, 0.86, 1.0) * (0.25 + 0.6 * (1.0 - u_night)) + u_sunColor * 0.05 + u_sunset * 0.3 * toSun;
      col = mix(col, cir, st * u_cirrus * 0.5 * (1.0 - u_rain) * (1.0 - u_night * 0.8));
    }
#endif
    // stars: the bright ones (240 cells a radian) and, t-sky2, a field of small faint ones (400 a radian: the trailer's
    // dense stars); by day they belong to the space above the blue band (cosmic) and are a little larger, so they read
    // through the daylight
    float starK = max(u_night, cosmic);
    if (starK > 0.02 && dir.y > -0.1) {
      vec3 sd3 = dir;
#ifndef LITE
      float ang = u_time * 0.0003;   // (the stars turn slowly; on Very Low they stand, like the nebula: no sine per pixel)
      sd3.xz = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * sd3.xz;
#endif
      vec3 sp = sd3 * 240.0;
      vec3 g = floor(sp);
      float s = hash13(g);
      if (s > 0.9955) {
        vec3 cpos = g + 0.5 + (vec3(hash13(g + 1.7), hash13(g + 2.3), hash13(g + 3.1)) - 0.5) * 0.6;
        float d = length(sp - cpos);
        float tw = 0.55 + 0.45 * sin(u_time * 3.0 + s * 100.0);
        vec3 sc = mix(vec3(0.75, 0.85, 1.0), vec3(1.0, 0.85, 0.7), hash13(g + 3.0));
        float br = smoothstep(0.9955, 1.0, s);
        col += sc * starK * clear * tw * (3.0 + br * 14.0) * exp(-d * d * mix(9.0, 28.0, u_night));   // t-sky: by day a little larger, so they read through the daylight
      }
#ifndef LITE
      vec3 sp2 = sd3 * 400.0;   // (not on Very Low: its sky pass stays as cheap as before)
      vec3 g2 = floor(sp2);
      float s2 = hash13(g2 + 41.0);
      if (s2 > 0.993) {
        vec3 c2 = g2 + 0.5 + (vec3(hash13(g2 + 5.3), hash13(g2 + 6.1), hash13(g2 + 7.7)) - 0.5) * 0.5;
        float d2 = length(sp2 - c2);
        col += mix(vec3(0.8, 0.88, 1.0), vec3(1.0, 0.9, 0.8), fract(s2 * 337.0)) * starK * clear * (0.9 + 2.6 * smoothstep(0.993, 1.0, s2)) * exp(-d2 * d2 * mix(5.0, 14.0, u_night));
      }
#endif
      if (u_night > 0.5) col += meteors(dir) * u_night * clear;   // t-sky: the meteors' loop only once the night is deep (by day and at dusk it drew nothing or a faint trace)
      if (u_dim == 3) {
        float a = vnoise(vec2(dir.x * 3.0 + u_time * 0.02, dir.z * 1.5)) * smoothstep(0.1, 0.5, dir.y) * smoothstep(0.95, 0.4, dir.y);
        float band = pow(max(0.0, sin(dir.x * 6.0 + dir.z * 3.0 + vnoise(dir.xz * 2.0 + u_time * 0.03) * 4.0)), 8.0);
        col += vec3(0.1, 0.9, 0.5) * a * band * u_night * 0.8 + vec3(0.5, 0.2, 0.9) * a * band * band * u_night * 0.4;
      }
    }
#ifdef WXDRAMA
    // t-motion · Wetter-Drama (weather.js, env.js E.storm / E.bolt): the storm's front darkens the sky from its side, a dark
    // wall of cloud low over the horizon there; the bolt, a jagged stroke from the cloud base down behind the hills, and its
    // flash lighting the sky round it (the land in front stands dark: the hills as silhouettes); the rainbow after the rain
    // at 42° round the antisolar point — red outside, violet inside — with the secondary faint at 51° (reversed) and
    // Alexander's dark band between (motion.js rainbowAt: the same numbers, test/motion_weather.js)
    if (u_storm.z > 0.001) {
      vec2 hd = normalize(dir.xz + vec2(1e-5, 0.0));
      float side = smoothstep(-0.35, 0.95, dot(hd, u_storm.xy));
      float wall = side * (1.0 - smoothstep(0.0, 0.45, max(dir.y, 0.0)));
      // (a deep slate, never black: at most 0.7 darker, the colour drained toward a cool grey — motion.js STORM)
      float lum = dot(col, vec3(0.3, 0.59, 0.11));
      col = mix(col, vec3(lum) * vec3(0.78, 0.86, 1.0), u_storm.z * 0.55) * (1.0 - u_storm.z * (0.22 + 0.3 * side + 0.18 * wall));
    }
    if (u_bolt.w > 0.001) {
      vec2 hd = normalize(dir.xz + vec2(1e-5, 0.0));
      float across = hd.x * u_bolt.y - hd.y * u_bolt.x, along = dot(hd, u_bolt.xy), e = dir.y, sd0 = u_bolt.z;
      float jag = 0.018 * sin(e * 41.0 + sd0) + 0.009 * sin(e * 97.0 + sd0 * 1.7) + 0.004 * sin(e * 213.0 + sd0 * 2.3) + (e - 0.02) * 0.08 * sin(sd0 * 0.37);
      float d = abs(across - jag), front = step(0.0, along);
      float span = smoothstep(-0.03, 0.0, e) * (1.0 - smoothstep(0.30, 0.34, e)) * front;
      float db = abs(across - jag - (0.19 - e) * 0.35 - 0.006 * sin(e * 150.0 + sd0));
      float br = exp(-db * db / 0.000006) * step(0.06, e) * step(e, 0.19) * front;
      float fl = u_bolt.w;
      col += vec3(0.85, 0.88, 1.0) * (exp(-d * d / 0.00001) * span * 10.0 + br * 5.0 + exp(-d * d / 0.0014) * span * 1.4) * fl;   // (a white-hot core about two pixels wide, its glow a degree round it)
      col += vec3(0.55, 0.55, 0.78) * fl * (0.25 + 1.4 * exp(-(1.0 - along) * 6.0)) * (1.0 - smoothstep(0.0, 0.6, max(e, 0.0)));
    }
    if (u_storm.w > 0.001) {
      float th = degrees(acos(clamp(dot(dir, -u_sunDir), -1.0, 1.0)));
      float p1 = (th - 40.6) / 1.8, p2 = (53.0 - th) / 2.9;
      float b1 = smoothstep(0.0, 0.18, p1) * (1.0 - smoothstep(0.82, 1.0, p1)), b2 = smoothstep(0.0, 0.18, p2) * (1.0 - smoothstep(0.82, 1.0, p2)) * 0.38;
      vec3 h1 = clamp(abs(mod((1.0 - clamp(p1, 0.0, 1.0)) * 0.78 * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
      vec3 h2 = clamp(abs(mod((1.0 - clamp(p2, 0.0, 1.0)) * 0.78 * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
      float inside = 1.0 - smoothstep(38.0, 40.8, th), alex = smoothstep(42.2, 43.5, th) * (1.0 - smoothstep(49.0, 50.2, th));
      float k = u_storm.w * smoothstep(-0.02, 0.06, dir.y);
      col = col * (1.0 - 0.1 * alex * k) + (h1 * b1 + h2 * b2) * 0.32 * k * (0.4 + col) + vec3(0.04) * inside * k;
    }
#endif
  }
  return col;
}
#ifdef HSHADOW
// ---- heightmap sun shadows: every loaded column's sun-blocking layer [bottom, top] lives in a
// 1024² toroidal texture (texel = world x,z & 1023). A ray marches from the surface toward the sun;
// passing through a layer = shadow, passing close by = soft penumbra (wider the farther the occluder).
// Costs a few texel fetches per sunlit pixel and no extra geometry pass — shadows for every PC.
uniform highp sampler2D u_hmap;
uniform vec4 u_hsh;   // x: how far rays march, y: highest top loaded, z: softness, w: unused
float hShadow(vec3 lp, vec3 n, vec3 L) {
  if (L.y < 0.02) return 1.0;
  vec3 p = lp + n * 0.07;
  float hs = length(L.xz);
  float dt = clamp(min(1.0 / max(hs, 1e-3), 0.75 / L.y), 0.3, 1.0);
  float t = dt * 0.5, res = 1.0;
  float yTop = u_hsh.y + 1.0 - float(u_camInt.y);
  for (int i = 0; i < 48; i++) {
    vec3 q = p + L * t;
    if (q.y > yTop || t > u_hsh.x) break;
    vec2 h = texelFetch(u_hmap, (ivec2(floor(q.xz)) + u_camInt.xz) & 1023, 0).rg * 255.0;
    if (h.x > 0.5) {
      float y = q.y + float(u_camInt.y);
      float top = h.x + 1.0, bot = h.y;
      float hw = L.y * dt * 0.5;
      if (y - hw < top && y + hw > bot) return 0.0;
      res = min(res, (y >= top ? y - top : bot - y) * u_hsh.z / t);
    }
    t += dt; dt = min(dt * 1.07, 4.0);
  }
  return clamp(res, 0.0, 1.0);
}
#endif
// the colour of the air in a direction: the sky's gradient with a warm, soft glow toward the sun —
// calmer than the sky itself, so haze tints the land instead of washing it out when looking sunward
vec3 hazeColor(vec3 dir) {
  float h = max(dir.y, 0.0);
  vec3 col = mix(u_skyHorizon, u_skyMid, sstepR(0.0, u_skyStops.x, h));   // t-sky: the haze follows the sky's lower stops
  float toSun = max(dot(dir, u_sunDir), 0.0);
  float t2 = toSun * toSun, t4 = t2 * t2, t8 = t4 * t4, t16 = t8 * t8, qh = 1.0 - h, qh2 = qh * qh;   // powers as products (the haze runs on every fogged pixel)
  col += u_sunset * (t4 * t2 * 0.55 + qh2 * qh2 * qh2 * 0.18) + u_sunColor * t16 * t16 * 0.1 * (1.0 - u_rain);
  if (dir.y < 0.0) col = mix(col, u_skyHorizon * 0.6, clamp(-dir.y * 2.0, 0.0, 1.0));
  return col;
}
${(VR.Light2 && VR.Light2.glslCommon) ? VR.Light2.glslCommon() : ''}
vec3 applyFog(vec3 col, vec3 rel, float dist) {
#ifdef AIR2
  return l2Fog(col, rel, dist);   // t-light2: the air — the same haze, with the valleys' height fog and aerial perspective
#else
  vec3 dir = rel / max(dist, 0.001);
  vec3 fc = u_dim == 1 || u_dim == 2 ? u_fogColor : mix(hazeColor(dir), u_fogColor, 0.35);
  float hd = max(length(rel.xz), abs(rel.y) * 0.35);
  float f = smoothstep(u_fog.x, u_fog.y, hd);
  f = max(f, (1.0 - exp(-dist * u_fog.z)) * 0.85);
  if (u_fog.w > 0.5) { f = 1.0 - exp(-dist * 0.07); fc = u_fogColor; }
  return mix(col, fc, clamp(f, 0.0, 1.0));
#endif
}
`;

  // ------------------------------------------------------------ terrain
  S.TERRAIN_VS = `
#ifdef MULTIDRAW
#extension GL_ANGLE_multi_draw : require
#endif
layout(location=0) in vec3 a_pos;
layout(location=1) in uint a_w3;
layout(location=2) in uint a_uvp;
layout(location=3) in uint a_w5;
layout(location=4) in uint a_light;
layout(location=5) in uint a_tint;
uniform mat4 u_viewProj;
uniform vec3 u_camFrac;
uniform ivec3 u_camInt;
uniform float u_time;
uniform float u_wind;
uniform vec2 u_windDir;                  // the wind's direction in x and z (weather.js, F3 · Da-Sein)
uniform float u_gust;                    // 0..1: a gust swells the sway by up to half
#ifdef MULTIDRAW
layout(std140) uniform Origins { vec4 u_origins[512]; };
#else
uniform vec3 u_origin;
#endif
#ifdef FADE
#ifndef MULTIDRAW
uniform float u_fade;
#endif
#endif
#ifdef SHADOWS
uniform mat4 u_shadowMat;
out vec4 v_shadow;
#endif
#ifdef MODEL
uniform mat4 u_model;
uniform mat3 u_normalMat;
#endif
out vec3 v_rel;
out vec2 v_uv;
flat out uint v_w3;
flat out uint v_w5;
out float v_sky;
out vec3 v_block;
out float v_ao;
out vec3 v_tint;
out vec3 v_localPos;
#ifdef FADE
flat out float v_fade;
#endif
${(VR.Light2 && VR.Light2.glslVS) ? VR.Light2.glslVS() : ''}
#ifdef ZINV
invariant gl_Position;   // F10 · zPre: the cut-out layer's depth prepass and its colour pass place every fragment alike
#endif
#ifdef MOTION
out float v_sheen;       // t-motion: how much a passing gust brightens this grass or leaf face (wind.js windSheen)
flat out float v_ground; // t-motion: a green block's top — the wind's strength (its gust bands are drawn per pixel), 0 otherwise
${VR.Wind ? VR.Wind.glsl() : ''}
#endif
void main() {
#ifdef FADE
#ifdef MULTIDRAW
  v_fade = u_origins[gl_DrawID].w;
#else
  v_fade = u_fade;
#endif
#endif
#ifdef MULTIDRAW
  vec3 org = u_origins[gl_DrawID].xyz;
#else
  vec3 org = u_origin;
#endif
  vec3 local = a_pos / 2048.0 - 4.0;
#ifdef MODEL
  vec3 rel = (u_model * vec4(org + local, 1.0)).xyz;
#else
  vec3 rel = org + local;
#endif
  vec3 wp = rel + u_camFrac;           // world pos relative to integer camera cell
  bool ctmFace = ((a_w5 >> 14u) & 1u) == 1u;   // connected glass: bits 5-7 are its frame mask, not sway
  uint sway = ctmFace ? 0u : (a_w5 >> 5u) & 3u;
  uint leaf = ctmFace ? 0u : (a_w5 >> 7u) & 1u;
#ifdef MOTION
  // t-motion · wind in everything (wind.js): the gust bands travel over the land; a plant leans into them (base stiff,
  // tip free), leaves rustle harder in them, grass and leaves brighten as they bend (the waves read from afar); a hung
  // thing (the leaf bit with a sway level: a lantern, a sign, laundry, an awning's valance) swings as one piece about
  // its hook, the level its depth under it
  v_sheen = 0.0; v_ground = 0.0;
  bool green = !ctmFace && float((a_tint >> 5u) & 63u) / 63.0 > float((a_tint >> 11u) & 31u) / 31.0 * 1.08 && float((a_tint >> 5u) & 63u) / 63.0 > float(a_tint & 31u) / 31.0 * 1.08;
  // (a green block's top: the meadow's waves on the ground, drawn per pixel by TERRAIN_FS — a merged face spans many blocks)
  if (green && sway == 0u && leaf == 0u && (a_w5 & 7u) == 2u) v_ground = min(u_wind, 1.25);
  else if (sway > 0u || leaf > 0u || green) {
    vec3 ap = wp + vec3(u_camInt);
    vec2 wq = vec2(-u_windDir.y, u_windDir.x);
    float G = windGust(ap.x, ap.z, u_time, u_windDir.x, u_windDir.y, u_gust);
    if (green) v_sheen = windSheen(G) * min(u_wind, 1.5);
    if (sway > 0u && leaf > 0u) {
      float lv = float(sway);
      rel.xz += u_windDir * windHangAlong(ap.x, ap.y, ap.z, u_time, u_wind, G, lv) + wq * windHangAcross(ap.x, ap.y, ap.z, u_time, u_wind, G, lv);
      rel.y += windHangUp(ap.x, ap.y, ap.z, u_time, u_wind, G, lv);
    } else if (sway > 0u || leaf > 0u) {
      float t = u_time * 1.6;
      float ph = ap.x * 0.37 + ap.z * 0.29;
      float amp = (sway > 0u ? float(sway) / 3.0 * 0.11 : 0.025) * u_wind * (1.0 + 0.5 * u_gust);
      float along = sin(t + ph) * amp + sin(t * 2.3 + ph * 1.7) * amp * 0.35;
      float across = cos(t * 0.9 + ph * 1.3) * amp * 0.8;
      rel.xz += u_windDir * along + wq * across;
      if (leaf > 0u) rel.y += sin(t * 1.7 + ph * 2.1) * 0.015 * u_wind + sin(u_time * 5.3 + ph * 3.1) * 0.012 * u_wind * G;
      if (sway > 0u) { float ln = windLeanAlong(float(sway), u_wind, G); rel.xz += u_windDir * ln; rel.y -= ln * 0.1 * float(sway); }
    }
  }
#else
  if (sway > 0u || leaf > 0u) {
    vec3 ap = wp + vec3(u_camInt);
    float t = u_time * 1.6;
    float ph = ap.x * 0.37 + ap.z * 0.29;
    float amp = (sway > 0u ? float(sway) / 3.0 * 0.11 : 0.025) * u_wind * (1.0 + 0.5 * u_gust);
    float along = sin(t + ph) * amp + sin(t * 2.3 + ph * 1.7) * amp * 0.35;   // with the wind
    float across = cos(t * 0.9 + ph * 1.3) * amp * 0.8;                       // across it (presence.js windOffset mirrors this)
    rel.xz += u_windDir * along + vec2(-u_windDir.y, u_windDir.x) * across;
    if (leaf > 0u) rel.y += sin(t * 1.7 + ph * 2.1) * 0.015 * u_wind;
  }
#endif
  uint kind = (a_w5 >> 8u) & 7u;
  uint face = a_w5 & 7u;
  if (kind == 1u && face == 2u) {
    vec3 ap = wp + vec3(u_camInt);
    rel.y += (sin(ap.x * 0.8 + u_time * 1.4) * 0.5 + sin(ap.z * 0.7 + u_time * 1.1) * 0.5) * 0.035 - 0.04;
  }
  v_rel = rel;
  v_localPos = wp;
  v_uv = vec2(float(a_uvp & 255u), float(a_uvp >> 8u)) / 16.0;
  v_w3 = a_w3; v_w5 = a_w5;
  v_sky = float(a_light >> 12u) / 15.0;
  v_block = vec3(float((a_light >> 8u) & 15u), float((a_light >> 4u) & 15u), float(a_light & 15u)) / 15.0;
  v_ao = float((a_w5 >> 3u) & 3u);
  v_tint = pow(vec3(float((a_tint >> 11u) & 31u) / 31.0, float((a_tint >> 5u) & 63u) / 63.0, float(a_tint & 31u) / 31.0), vec3(2.2));
#ifdef SHADOWS
  vec3 n = face == 0u ? vec3(1,0,0) : face == 1u ? vec3(-1,0,0) : face == 2u ? vec3(0,1,0) : face == 3u ? vec3(0,-1,0) : face == 4u ? vec3(0,0,1) : vec3(0,0,-1);
#ifdef MODEL
  n = u_normalMat * n;
#endif
  v_shadow = u_shadowMat * vec4(rel + n * 0.04, 1.0);
#endif
  gl_Position = u_viewProj * vec4(rel, 1.0);
#if defined(L2AO) && !defined(MODEL)
  v_l2AoClip = u_l2AoVP * vec4(rel + u_l2AoDelta, 1.0);   // t-light2: where this was in the last frame's view (its contact shadows)
#endif
}`;

  S.TERRAIN_FS = `
uniform float u_mipScale;
uniform float u_wet;
uniform float u_matTier;     // F2: the material detail tier (0 Very Low … 3 High)
uniform float u_puddle;      // F2: the puddles' fill (env.js: they gather in the rain, dry over minutes)
uniform sampler2D u_fam;     // F2: the material family of every layer, one row (0 none, 1 stone, 2 wood, 3 fabric, 4 metal, 5 plaster)
uniform sampler2DArray u_albedo;
uniform sampler2DArray u_material;
uniform sampler2D u_noise;
#ifdef SHADOWS
uniform highp sampler2DShadow u_shadowMap;
uniform float u_shadowTexel;
uniform vec2 u_shadowOff;    // F9 · Schatten-Takt: the toroidal map's offset (0 = the plain map as before)
in vec4 v_shadow;
#endif
uniform ivec3 u_camInt;
uniform vec3 u_camFrac;
uniform float u_emissiveBoost;
uniform float u_normalStrength;
uniform float u_holoLayer;
uniform float u_blockVar;     // Klassisch: w3 bit 15 marks natural blocks for their own shade, the normal map turns with the tile (Nahtlos: macro mottling)
#ifdef TEXHI
uniform sampler2DArray u_albedoHi;     // t-material · hero textures (tex_hi.js): the most-seen materials at 64 × 64 …
uniform sampler2DArray u_materialHi;
uniform sampler2D u_hiMap;             // … and per layer its hero + 1 (0: none), one row
#endif
#ifdef MODEL
uniform mat3 u_normalMat;
uniform float u_clipNear;
#endif
${'__COMMON__'}
${LOOK}
in vec3 v_rel;
in vec2 v_uv;
flat in uint v_w3;
flat in uint v_w5;
in float v_sky;
in vec3 v_block;
in float v_ao;
in vec3 v_tint;
in vec3 v_localPos;
#ifdef FADE
flat in float v_fade;
#endif
#ifdef MOTION
in float v_sheen;   // t-motion: a passing gust brightens grass and leaves (TERRAIN_VS, wind.js)
flat in float v_ground;   // t-motion: a green block's top (TERRAIN_VS): the wind's strength — its gust bands are drawn here, per pixel
uniform float u_snowCover;   // t-motion: a snow day's cover on the open ground (env.js: it builds in ~3 min of snow, melts in ~10)
uniform vec2 u_windDir;      // (t-motion: the same uniforms as TERRAIN_VS: the ground's gust bands)
uniform float u_gust;
${VR.Wind ? VR.Wind.glsl() : ''}
#endif
layout(location=0) out vec4 o_col;
const vec3 NORMALS[6] = vec3[6](vec3(1,0,0), vec3(-1,0,0), vec3(0,1,0), vec3(0,-1,0), vec3(0,0,1), vec3(0,0,-1));
const vec3 TANG[6] = vec3[6](vec3(0,0,-1), vec3(0,0,1), vec3(1,0,0), vec3(1,0,0), vec3(1,0,0), vec3(-1,0,0));
const vec3 BITN[6] = vec3[6](vec3(0,-1,0), vec3(0,-1,0), vec3(0,0,1), vec3(0,0,-1), vec3(0,-1,0), vec3(0,-1,0));
// F2 · materials. The family's micro pattern at dp (the face's tangent coordinates in blocks × 4: four cells to a block):
// x = the height (0…1), y = a pit (plaster). From the tileable noise texture, no new texture; fibres stretch along x.
vec2 famPattern(vec2 dp, int fam) {
  if (fam == 2) return vec2(texture(u_noise, vec2(dp.x * 0.03, dp.y * 0.5)).r, 0.0);
  if (fam == 4) return vec2(texture(u_noise, vec2(dp.x * 0.02, dp.y * 0.6)).r, 0.0);
  if (fam == 3) return vec2(0.5 + 0.5 * sin(dp.x * 12.566) * sin(dp.y * 12.566), 0.0);
  if (fam == 5) return vec2(texture(u_noise, dp * 0.125).r, step(0.86, texture(u_noise, dp * 0.5).a));
  return vec2(texture(u_noise, dp * 0.125).r * 0.65 + texture(u_noise, dp * 0.25 + vec2(0.37, 0.61)).g * 0.35, 0.0);
}
// F2 · the sky seen in a reflection: a cheap environment term from the horizon and zenith colours (F1's sky LUT replaces it);
// t-sky: the upper colour is the sky's blue middle, not the navy space above it (that would turn every polished top face black)
vec3 matEnv(vec3 R) {
  return mix(u_skyHorizon * 0.5, mix(u_skyHorizon, u_skyMid, smoothstep(0.0, 0.8, R.y)), smoothstep(-0.05, 0.6, R.y));
}
// sun visibility: the shadow map near the camera, heightmap rays beyond it (or everywhere on Low)
float shadowAt(vec3 N, vec3 L) {
  float s = 1.0, cover = 0.0;
#ifdef SHADOWS
  vec3 sc = v_shadow.xyz / v_shadow.w * 0.5 + 0.5;
  if (!(sc.x <= 0.001 || sc.x >= 0.999 || sc.y <= 0.001 || sc.y >= 0.999 || sc.z >= 1.0)) {
    float t = u_shadowTexel;
    float bias = 0.0006;
    vec2 su = fract(sc.xy + u_shadowOff);   // (F9: the toroidal map; sc.xy itself when the offset is 0)
    s = texture(u_shadowMap, vec3(su + vec2(-0.6, -0.6) * t, sc.z - bias));
    s += texture(u_shadowMap, vec3(su + vec2(0.6, -0.6) * t, sc.z - bias));
    s += texture(u_shadowMap, vec3(su + vec2(-0.6, 0.6) * t, sc.z - bias));
    s += texture(u_shadowMap, vec3(su + vec2(0.6, 0.6) * t, sc.z - bias));
    s *= 0.25;
    vec2 edge = smoothstep(vec2(0.0), vec2(0.08), sc.xy) * smoothstep(vec2(0.0), vec2(0.08), 1.0 - sc.xy);
    cover = edge.x * edge.y;
  }
#endif
#ifdef HSHADOW
  if (cover < 0.999) s = mix(hShadow(v_localPos, N, L), s, cover);
#else
  s = mix(1.0, s, cover);
#endif
  return s;
}
#ifdef PBR
// t-material · PBR-lite (plan 2026-10-15-t-material.md, step 1). The material table (tex_pbr.js): per layer r metal, g a
// clear coat (polish, lacquer, gloss tiles, painted hulls), b a scale on the painter's roughness (128 = ×1), a flags.
uniform sampler2D u_pbr;
// t-polish2 · rain under roofs: the rain's height map round the camera (game.js, wet.js fillMap: each column's top
// rain-stopping block — solid, glass, fluid, leaves — R8) on unit 9. Glass passes the sky light, so the sky light cannot tell
// a street under a glass vault from one in the open; a face gets the rain where the air cell in front of it lies above its
// column's top (wet.js faceOpen). u_rainMap: xy the map's origin (world x, z of texel 0), z 1 when it holds this frame's
// columns (0: the sky light alone decides, as before), w its size
uniform sampler2D u_rainTop;
uniform vec4 u_rainMap;
float rainOpen(vec3 wq, vec3 N) {
  if (u_rainMap.z < 0.5) return 1.0;
  vec3 c = floor(wq + N * 0.5);
  vec2 t = c.xz - u_rainMap.xy;
  if (t.x < 0.0 || t.y < 0.0 || t.x >= u_rainMap.w || t.y >= u_rainMap.w) return 1.0;
  return step(texelFetch(u_rainTop, ivec2(t), 0).r * 255.0 + 0.5, c.y);
}
#ifdef SSR
// t-material · the screen-space mirror (step 2, High): the terrain's second target — the shaded normal (octahedral, y up),
// how much of the fragment is mirror (its Fresnel weight) and the mirror's roughness; renderer.js ssrPass reads it
layout(location=1) out vec4 o_ssr;
float g_ssrW = 0.0, g_ssrR = 1.0;
vec3 g_ssrN = vec3(0.0, 1.0, 0.0);   // the normal the mirror is marched with (the coat's, smooth, where a coat dominates)
vec2 octEnc(vec3 n) { n /= abs(n.x) + abs(n.y) + abs(n.z); return n.y >= 0.0 ? n.xz : (1.0 - abs(n.zx)) * vec2(n.x >= 0.0 ? 1.0 : -1.0, n.z >= 0.0 ? 1.0 : -1.0); }
#endif
float pow5(float x) { float x2 = x * x; return x2 * x2 * x; }
// rain rings on a puddle: the slope where drops land (one hashed spot per cell, each ring grows and fades; TRANS_FS's ringN)
vec2 pudRing(vec2 p, float t) {
  vec2 g = floor(p), acc = vec2(0.0);
  for (int j = -1; j <= 0; j++) for (int i = -1; i <= 0; i++) {
    vec2 cell = g + vec2(float(i), float(j));
    float h1 = hash12(cell), h2 = hash12(cell + vec2(17.3, 5.1)), age = fract(t * 0.7 + h1 * 7.0), rad = age * 0.42;
    vec2 dv = p - (cell + vec2(h1, h2));
    float dd = length(dv), e = dd - rad;
    acc += dv / max(dd, 1e-3) * (cos(e * 42.0) * exp(-e * e * 110.0) * (1.0 - age));
  }
  return acc * 0.3;
}
// the sky seen in a reflection: the sky's gradient (matEnv) and the low sun's warm glow toward it; a rough surface sees it
// blurred toward the mean of the sky
vec3 pbrSky(vec3 R, float r) {
  vec3 s = matEnv(R);
  float ts = max(dot(R, u_sunDir), 0.0), t2 = ts * ts, t4 = t2 * t2, t8 = t4 * t4;
  s += u_sunset * (t8 * 0.8) + u_sunColor * (t8 * t8 * t4 * 0.3 * (1.0 - r));
  return mix(s, u_ambSky * 0.85 + u_skyHorizon * 0.15, r * r);
}
// the environment a surface reflects: the sky where the sky light reaches it, the block lights' colour where it does not
// (a glossy hall floor shines in the colour of its lamps)
vec3 pbrEnv(vec3 R, float r, float so, vec3 blockL) { return pbrSky(R, r) * so + blockL * (0.55 - 0.35 * so); }
// GGX (Trowbridge-Reitz) with Schlick's Fresnel and a Kelemen visibility; the lobe capped (no fireflies under the jitter)
vec3 pbrSun(vec3 n, vec3 V, vec3 L, float r, vec3 F0) {
  vec3 H = normalize(L + V);
  float nh = max(dot(n, H), 0.0), vh = max(dot(V, H), 0.0), a = r * r, a2 = a * a, d = nh * nh * (a2 - 1.0) + 1.0;
  float D = min(a2 / (3.14159 * d * d), 48.0);
  return D * (F0 + (1.0 - F0) * pow5(1.0 - vh)) * (0.25 / max(vh * vh, 0.06));
}
// the gloss of one fragment: col is its lit colour (diffuse, ambient, block light), lsun the sun's light reaching it
// (shadow and the open sky applied), so the sky's specular occlusion. Matte things (rough, no coat, no metal) return col.
vec3 pbrShade(vec3 col, vec3 alb, vec3 n, vec3 Ng, vec3 V, vec3 L, vec3 lsun, float ndl, float rough, float layer, float so, vec3 blockL, float wetK, float pud) {
  vec4 pb = texelFetch(u_pbr, ivec2(int(layer), 0), 0);
  float metal = pb.r, coat = max(pb.g, max(wetK * 0.75, pud));   // (the rain's film is a coat of water)
  float r = clamp(rough * pb.b * 1.9922, 0.045, 1.0);
  if (r > 0.8 && coat < 0.004 && metal < 0.004) return col;
  float nv = clamp(dot(n, V), 1e-3, 1.0), fv = pow5(1.0 - nv);
  vec3 R = reflect(-V, n);
  vec3 F0 = mix(vec3(0.04), alb, metal);
  vec3 Fr = (F0 + (max(vec3(1.0 - r), F0) - F0) * fv) * (1.0 - smoothstep(0.7, 0.92, r));   // Schlick with roughness
  // the base: a metal keeps little of its diffuse; the reflection takes its share of the rest
  vec3 c = col * (1.0 - 0.8 * metal) * (1.0 - Fr * (1.0 - metal)) + pbrEnv(R, r, so, blockL) * Fr;
  if (ndl > 0.0 && r < 0.92) c += lsun * ndl * pbrSun(n, V, L, max(r, 0.08), F0);
  // the clear coat: a second, sharp interface over it (the polish, the lacquer, the water of a puddle)
#ifdef SSR
  // (run 5: the hangar's floor still shimmered as a static — the mirror's weight and its ray followed the texture's relief
  //  texel by texel, and at a grazing angle the relief swings the Fresnel from a tenth to a half. The world it mirrors is
  //  weighed and marched along the smooth surface; the relief stays in the sky's reflection above)
  { vec3 ns = normalize(mix(n, Ng, 0.88)); float fs = pow5(1.0 - clamp(dot(ns, V), 1e-3, 1.0));
    g_ssrW = dot((F0 + (max(vec3(1.0 - r), F0) - F0) * fs) * (1.0 - smoothstep(0.7, 0.92, r)), vec3(0.3, 0.59, 0.11)); g_ssrR = r; g_ssrN = ns; }
#endif
  if (coat > 0.004) {
    // (run 3: the coat mirrored along the texture's relief — the hangar's polished floor showed the walls as a mottled
    // smear. A coat is a smooth film over the relief: its mirror follows the surface, the relief shows a hair through;
    // a puddle's water is flat itself, so its own rain rings ripple what it mirrors)
    vec3 nc = normalize(mix(n, Ng, 0.88 * (1.0 - pud)));
    float nvc = clamp(dot(nc, V), 1e-3, 1.0), fvc = pow5(1.0 - nvc);
    // the coat's own roughness from the table (the flags' upper four bits: a sharp polish 0.08, a honed stone softer);
    // water is sharp. (run 4: the puddles after the rain hardly showed — water mirrors a few percent where one looks down
    // at it, over pale tiles. A puddle mirrors at least about half of what it faces, as the eye remembers one)
    float rc = mix(0.08 + float(uint(pb.a * 255.0 + 0.5) >> 4u) * 0.03, 0.04, pud);
    float Fc = max((0.04 + 0.96 * fvc) * coat, pud * 0.48);
    c = c * (1.0 - Fc) + pbrEnv(reflect(-V, nc), rc, so, blockL) * Fc;
    if (ndl > 0.0) c += lsun * ndl * pbrSun(nc, V, L, rc, vec3(0.04)) * coat;
#ifdef SSR
    g_ssrW = g_ssrW * (1.0 - Fc) + Fc; g_ssrR = mix(r, rc, min(1.0, coat * 2.0));
    if (Fc > g_ssrW * 0.5) g_ssrN = nc;
#endif
  }
  return c;
}
#endif
void main() {
#ifdef MODEL
  if (u_clipNear > 0.0 && length(v_rel) < u_clipNear) discard;
#endif
#ifdef FADE
  if (v_fade < 1.0 && bayer4(gl_FragCoord.xy) >= v_fade) discard;
#endif
  uint face = v_w5 & 7u;
  uint kind = (v_w5 >> 8u) & 7u;
  bool noshade = ((v_w5 >> 11u) & 1u) == 1u;
  bool emissiveFace = ((v_w5 >> 12u) & 1u) == 1u;
  float layer = float(v_w3 & 4095u);
  uint rot = (v_w3 >> 12u) & 3u;
  vec2 uv = v_uv;
  vec2 fu = ((v_w5 >> 14u) & 1u) == 1u ? ctmUV(uv, v_w5) : fract(uv);
  vec2 cell = floor(uv);
  vec3 cellF = floor(v_localPos - NORMALS[face] * 0.02) + vec3(u_camInt);
  if (((v_w3 >> 14u) & 1u) == 1u) {
#ifdef MODEL
    float h = 0.0;
#else
    float h = hash13(cellF);
#endif
    rot = (rot + uint(h * 4.0)) & 3u;
  }
  if (rot == 1u) fu = vec2(fu.y, 1.0 - fu.x); else if (rot == 2u) fu = vec2(1.0 - fu.x, 1.0 - fu.y); else if (rot == 3u) fu = vec2(1.0 - fu.y, fu.x);
  if (kind == 5u) layer += mod(floor(u_time * 12.0 + cellF.x * 3.0 + cellF.z * 7.0), 8.0);
  // R9 Super Resolution renders below screen size: pick the texture detail of the full-size image
  float mipK = u_mipScale > 0.0 ? u_mipScale : 1.0;
  vec2 dx = dFdx(uv) * mipK, dy = dFdy(uv) * mipK;
  if (rot == 1u || rot == 3u) { dx = dx.yx; dy = dy.yx; }
  // Klassisch: crisp texels up close, as in the original game — the sample snaps to its texel's centre and only the
  // half pixel on either side of a texel edge blends across it (with anisotropic filtering many GPUs magnify linearly,
  // which smeared the chunky pixels and the block outline into soft bands); texels smaller than a pixel pass as they are
  if (u_blockVar > 0.5) {
    vec2 tx = fu * 32.0, seam = floor(tx + 0.5), tw = max((abs(dx) + abs(dy)) * 32.0, vec2(1e-3));
    fu = (seam + clamp((tx - seam) / tw, -0.5, 0.5)) / 32.0;
  }
#ifdef TEXHI
  // t-material · hero textures: a layer with a 64 × 64 version is read from it (the same gradients: its own mips pick the
  // detail by distance); never in the Klassisch look, which keeps its 16-texel ground
  int hiK = int(texelFetch(u_hiMap, ivec2(int(layer), 0), 0).r * 255.0 + 0.5);
  bool hiOn = hiK > 0 && u_blockVar < 0.5;
  vec4 alb = hiOn ? textureGrad(u_albedoHi, vec3(fu, float(hiK - 1)), dx, dy) : textureGrad(u_albedo, vec3(fu, layer), dx, dy);
#else
  vec4 alb = textureGrad(u_albedo, vec3(fu, layer), dx, dy);
#endif
#ifdef CUTOUT
  if (alb.a < 0.5) discard;
#ifdef ZPRE
  o_col = vec4(1.0 / 255.0, 0.0, 0.0, 1.0); return;   // F10 · zPre: the depth only (the colour writes are off; a test counts with it)
#endif
#endif
#ifdef TEXHI
  vec4 mat = hiOn ? textureGrad(u_materialHi, vec3(fu, float(hiK - 1)), dx, dy) : textureGrad(u_material, vec3(fu, layer), dx, dy);
#else
  vec4 mat = textureGrad(u_material, vec3(fu, layer), dx, dy);
#endif
  vec3 tint = v_tint;
  // a recoloured block (B1): the texture's detail in its own colour, the whole face (the tint mask of a grass side too)
  if (lookOn(v_w5)) alb.rgb = lookRecolor(alb.rgb, layer, tint);
  else {
#ifdef CUTOUT
  alb.rgb *= tint;
#else
  alb.rgb = mix(alb.rgb, alb.rgb * tint, alb.a);
#endif
  }
#ifdef MOTION
  // t-motion · the wind's waves over the meadow: grass and leaves bent by a gust show their paler side; on a green block's
  // top the bands run over the ground itself, per pixel (wind.js windGroundSheen: brighter and a touch yellower under a
  // gust, a little darker in the lull, the meadow's mean unchanged)
  float sheen = v_sheen;
  if (v_ground > 0.0) {
    vec3 gp = v_localPos + vec3(u_camInt);
    sheen = windGroundSheen(windGust(gp.x, gp.z, u_time, u_windDir.x, u_windDir.y, u_gust), u_gust) * v_ground;
  }
  alb.rgb *= 1.0 + sheen;
  alb.rgb = mix(alb.rgb, alb.rgb * vec3(1.06, 1.04, 0.86), clamp(sheen * 1.5, 0.0, 0.4));
  if (u_snowCover > 0.001 && (face == 2u || ((v_w5 >> 13u) & 1u) == 1u)) {   // a snow day: the flakes settle on the open tops
    vec2 sp = v_localPos.xz + vec2(u_camInt.xz);
    float patchy = smoothstep(0.25, 0.75, texture(u_noise, sp / 23.0).r * 0.7 + texture(u_noise, sp / 5.0).g * 0.3 + u_snowCover * 0.6 - 0.2);
    alb.rgb = mix(alb.rgb, vec3(0.9, 0.92, 0.97), u_snowCover * patchy * smoothstep(0.86, 1.0, v_sky));
  }
#endif
  if (((v_w3 >> 15u) & 1u) == 1u) {
#ifdef MODEL
    bool own = false;   // a ship's blocks move with it: no world cell to hash
#else
    bool own = u_blockVar > 0.5;
#endif
    // Klassisch v2: every natural block its own shade (±5 %), all its faces alike — a field of one material is
    // many blocks, never one surface
    if (own) alb.rgb *= 0.95 + 0.1 * hash13(cellF + vec3(3.7, 1.3, 7.1));
#ifndef LITE
    else {
      vec2 wp = v_localPos.xz + vec2(u_camInt.xz);
      float m = texture(u_noise, wp / 96.0).r * 0.7 + texture(u_noise, wp / 23.0).g * 0.3;
      alb.rgb *= 0.9 + m * 0.2;
    }
#endif
  }
  // normal (smooth ground slopes: the true surface normal from the position derivatives)
  vec3 N = NORMALS[face];
  if (((v_w5 >> 13u) & 1u) == 1u) { vec3 gn = normalize(cross(dFdx(v_rel), dFdy(v_rel))); if (gn.y < 0.0) gn = -gn; N = gn; }
#ifdef MODEL
  N = u_normalMat * N;
#endif
  // F2 · the material layer (tier ≥ 1): the family's micro detail (albedo, roughness, at tier 2 a bump) at four cells per
  // block, faded out by 12 blocks from the eye and damped on the outermost texel line (the outline stays on top); the wet
  // top faces (roughness drops, a thin sky layer) and the puddles in the hollows of a low-frequency field
  int fam = 0;
  float dAlb = 0.0, dRough = 0.0, wetK = 0.0, pud = 0.0;
  vec3 bumpW = vec3(0.0);
  if (u_matTier > 0.5) {
    fam = int(texelFetch(u_fam, ivec2(int(layer), 0), 0).r * 255.0 + 0.5);
    vec3 wpM = v_localPos + vec3(u_camInt);
    float up = smoothstep(0.55, 0.92, N.y);
    wetK = u_wet * up;
    if (u_puddle > 0.001 && up > 0.001) {
      float low = texture(u_noise, wpM.xz * 0.012).r * 0.65 + texture(u_noise, wpM.xz * 0.05).g * 0.35;
      pud = u_puddle * up * (1.0 - smoothstep(0.38, 0.44, low));   // the hollows only: about a sixth of a flat ground in a full rain
    }
    float edgeD = min(min(fu.x, 1.0 - fu.x), min(fu.y, 1.0 - fu.y));
    float fade = (1.0 - smoothstep(8.0, 12.0, length(v_rel))) * mix(0.1, 1.0, smoothstep(0.0, 0.045, edgeD));
    if (fam > 0 && fade > 0.001) {
      vec2 dp = (face <= 1u ? wpM.zy : (face <= 3u ? wpM.xz : wpM.xy)) * 4.0;
      vec2 pat = famPattern(dp, fam);
      float h = pat.x - 0.5;
      if (fam == 1) { dAlb = h * 0.2; dRough = h * 0.12; }
      else if (fam == 2) { dAlb = h * 0.26; dRough = h * 0.2; }
      else if (fam == 3) { dAlb = h * 0.14; }
      else if (fam == 4) { dAlb = h * 0.12; dRough = h * 0.14; }
      else { dAlb = h * 0.12 - pat.y * 0.08; dRough = h * 0.08 + pat.y * 0.1; }
      dAlb *= fade; dRough *= fade;
      if (u_matTier > 1.5) {
        float e = 0.25;
        vec2 g = vec2(famPattern(dp + vec2(e, 0.0), fam).x - pat.x, famPattern(dp + vec2(0.0, e), fam).x - pat.x) / e;
        g *= fade * 0.06;
        bumpW = face <= 1u ? vec3(0.0, g.y, g.x) : (face <= 3u ? vec3(g.x, 0.0, g.y) : vec3(g.x, g.y, 0.0));
      }
    }
  }
#ifdef PBR
  // t-material · the wet world (wet.js: u_wet stays after the rain and dries over ten minutes, u_puddle the puddles' fill):
  // only where the rain reaches (the open sky), the walls less and in streaks where the water runs down, the puddles in the
  // hollows of a low-frequency field whose edge falls with the fill — they shrink from their rims as they dry
  vec3 wq = v_localPos + vec3(u_camInt);
  if (u_wet > 0.001 || u_puddle > 0.001) {
    float open = smoothstep(0.86, 0.99, v_sky) * rainOpen(wq, N), upW = smoothstep(0.55, 0.92, N.y);   // (t-polish2: and under no roof — glass passes the sky light, not the rain)
    float streak = upW > 0.5 ? 1.0 : smoothstep(0.3, 0.72, texture(u_noise, vec2((wq.x + wq.z) * 0.37, wq.y * 0.05 - u_time * 0.002)).g);
    wetK = u_wet * open * mix(0.55 * streak, 1.0, upW);
    pud = 0.0;
    if (u_puddle > 0.001 && upW > 0.5) {
      float low = texture(u_noise, wq.xz * 0.012).r * 0.65 + texture(u_noise, wq.xz * 0.05).g * 0.35, edge = 0.31 + 0.13 * u_puddle;
      pud = open * upW * (1.0 - smoothstep(edge - 0.035, edge, low)) * smoothstep(0.0, 0.12, u_puddle);
    }
  }
#endif
  vec2 nxy = mat.rg * 2.0 - 1.0;
  // Klassisch: the normal map turns with the tile, so a turned grass top is lit as its texels lie and every block's
  // edges catch the low sun alike (unturned, the edges of neighbouring blocks lit up at random and pairs of blocks
  // read as one); Nahtlos keeps its normals as they were
  if (u_blockVar > 0.5) { if (rot == 1u) nxy = vec2(-nxy.y, nxy.x); else if (rot == 2u) nxy = -nxy; else if (rot == 3u) nxy = vec2(nxy.y, -nxy.x); }
  nxy *= u_normalStrength;
  vec3 T = TANG[face], Bt = BITN[face];
#ifdef MODEL
  T = u_normalMat * T; Bt = u_normalMat * Bt;
#endif
  // (F2: the baked normal map now models the light on every tier, Very Low included: one normalize, no extra fetch)
  vec3 n = normalize(N * sqrt(max(0.0, 1.0 - dot(nxy, nxy))) + T * nxy.x + Bt * nxy.y);
  if (u_matTier > 1.5) n = normalize(n - (bumpW - dot(bumpW, n) * n));
  if (noshade) n = vec3(0.0, 1.0, 0.0);
#ifdef PBR
  // (t-material) a puddle is flat water: the texture's relief drowns in it, the rain draws its rings on it
  if (pud > 0.01) { n = normalize(mix(n, N, pud)); if (u_rain > 0.02) { vec2 rg = pudRing(wq.xz * 1.6, u_time) * (u_rain * pud); n = normalize(vec3(n.x + rg.x, n.y, n.z + rg.y)); } }
#endif
  float rough = clamp(mat.b + dRough, 0.02, 1.0);
  if (fam == 3) rough = 0.97;                             // fabric: matte, no highlight
  rough = mix(rough, 0.25 * rough + 0.03, wetK * 0.85);   // wet: smoother
  rough = mix(rough, 0.03, pud);                          // a puddle is a mirror
  alb.rgb *= (1.0 + dAlb) * (1.0 - 0.55 * pud);
  float emis = mat.a;
  // lighting
  float sky = v_sky;
  float skyL = sky * sky * (3.0 - 2.0 * sky);
  vec3 bl = v_block;
  vec3 blockL = pow(bl, vec3(1.7)) * 1.35 * u_blockLightTint;
#ifdef LIGHT2
  blockL = l2Pool(bl);   // t-light2: the lamps' light in pools (light2.js)
#endif
  float ao = 1.0 - v_ao * 0.2;
  float faceShade = face == 2u ? 1.0 : face == 3u ? 0.55 : (face <= 1u ? 0.78 : 0.88);
  if (noshade) faceShade = 0.92;
  vec3 V = normalize(-v_rel);
  float sunUp = smoothstep(-0.12, 0.12, u_sunDir.y);
  vec3 L = sunUp > 0.001 ? u_sunDir : u_moonDir;
  vec3 lc = sunUp > 0.001 ? u_sunColor * sunUp : u_moonColor;
  float ndl = noshade ? 0.65 : max(dot(n, L), 0.0);
#ifdef LIGHT2
  // t-light2: leaves, grass and flowers take the light softly round their edges (a wrap)
  if (!noshade && ((v_w5 >> 14u) & 1u) == 0u && ((v_w5 >> 5u) & 7u) != 0u) ndl = l2Wrap(dot(n, L), u_l2K.z) * step(-0.2, dot(N, L));
#endif
  float outdoors = smoothstep(0.55, 0.95, sky);
  float sh = (ndl > 0.0 && outdoors > 0.0 && dot(N, L) > -0.2) ? shadowAt(N, L) : 1.0;
#ifdef CLOUDSH
  sh *= cloudShadow(v_localPos + vec3(u_camInt));   // t-motion: cloud shadow (t-light2 multiplies it into its sun term)
#endif
  vec3 direct = lc * ndl * sh * outdoors;
  vec3 amb = u_ambSky * skyL * mix(0.62, 1.0, faceShade);
#ifdef LIGHT2
  // t-light2: the sky's light from above, the ground's bounce from below (the shade cool, its underside warm)
  amb = (noshade ? u_l2Sky * 0.92 : l2Hemi(n) * (face <= 1u ? u_l2K.y : 1.0)) * skyL;
#endif
#ifdef L2AO
  { float l2a = l2Ao(); amb *= l2a; blockL *= mix(1.0, l2a, u_l2AoK.z); }   // t-light2: the contact shadows — the sky's light and some of the lamps', never the sun
#endif
  vec3 lighting = (amb + direct) * ao + blockL * ao * mix(0.8, 1.0, faceShade) + vec3(0.012, 0.012, 0.016);
  // wet ground: the top faces darken a little in the rain (u_wet is 0 when dry or when wetGround is off)
#ifdef PBR
  // (t-material) wet things darken by how much water they soak: soil, sand, stone, wood a lot; polish, tiles, metal hardly
  // (run 2: the plaza's tiles hardly changed in the rain — a film of water dims every surface a little, and a puddle's
  // water over the ground a lot, so the mirror stands out on a darker ground)
  { float pr = clamp((mat.b - 0.45) / 0.45, 0.0, 1.0); pr = pr * pr * (3.0 - 2.0 * pr) * (1.0 - texelFetch(u_pbr, ivec2(int(layer), 0), 0).g);
    alb.rgb *= (1.0 - wetK * (0.42 * pr + 0.12 * (1.0 - pr))) * (1.0 - 0.34 * pud); }
#else
  if (face == 2u) alb.rgb *= 1.0 - 0.14 * u_wet;
#endif
  vec3 col = alb.rgb * lighting;
#if defined(PBR)
  // t-material: the gloss of the material (pbrShade above) in place of the one sun highlight
  if (!noshade) col = pbrShade(col, alb.rgb, n, N, V, L, lc * (sh * outdoors), ndl, rough, layer, skyL * ao, blockL, wetK, pud);
#elif !defined(LITE)
  // specular highlights (sun glints on smooth surfaces)
  if (rough < 0.75 && ndl > 0.0) {
    vec3 H = normalize(L + V);
    float sp = pow(max(dot(n, H), 0.0), mix(160.0, 12.0, rough)) * (1.0 - rough) * 1.6;
    col += lc * sp * sh * outdoors * (1.0 + u_rain * 1.5);
  }
#endif
#ifndef PBR
  if (u_matTier > 0.5) {
    // F2 · the response: metal reflects the sky tinted by its colour, wet surfaces and puddles mirror it at grazing angles
    // (outdoors only), varnished wood takes a soft sheen (tier 3)
    vec3 envC = matEnv(reflect(-V, n));
    float fresW = 0.04 + 0.96 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
    if (fam == 4) col = mix(col, alb.rgb * envC * (0.3 + 0.7 * v_sky) * 1.25, 0.8);
    col = mix(col, envC, outdoors * clamp(wetK * (0.1 + 0.9 * fresW) + pud * (0.6 + 0.4 * fresW), 0.0, 0.9));
    if (fam == 2 && u_matTier > 2.5 && ndl > 0.0) { vec3 Hs = normalize(L + V); col += lc * pow(max(dot(n, Hs), 0.0), 22.0) * 0.1 * sh * outdoors; }
  }
#endif
  if (emis > 0.02 || emissiveFace) {
    float e = emissiveFace ? max(emis, 0.85) : emis;
    col = mix(col, alb.rgb * (1.4 + u_emissiveBoost), e);
  }
#ifdef PBR
  // t-polish2 · a glowing pane carries the sky (t1_24, t3_05): the fine VX pieces' glowing voxels (the table's flag 8 —
  // Villa Nova's turquoise glass, its amber frames and lines) mirror the sky by Fresnel over their glow, by the sky light:
  // straight on the glow, toward the facade's edge the sky (the emissive mix above had left them one flat colour)
  if (emissiveFace && (uint(texelFetch(u_pbr, ivec2(int(layer), 0), 0).a * 255.0 + 0.5) & 8u) != 0u) {
    float fg = (0.04 + 0.96 * pow5(1.0 - clamp(dot(N, V), 1e-3, 1.0))) * skyL * 0.85;
    col = mix(col, pbrSky(reflect(-V, N), 0.06), fg);
  }
#endif
#ifdef MOTION
  // t-motion · the light lines run: a bright packet travels along every upward light (motion.js FLOW, the same numbers)
  if (emissiveFace && face == 2u && kind == 0u && u_animOn > 0.5) {
    vec3 fp = v_localPos + vec3(u_camInt);
    float fq = (fract((fp.x + fp.z) * 0.0625 - u_time * 0.5) - 0.5) * 12.0;
    col *= 0.9 + 0.6 * exp(-fq * fq);
  }
#endif
  if (u_holoLayer > 0.5 && abs(layer - u_holoLayer) < 0.5) {
    // holograms: rolling scanlines, a bright sweep and a faint flicker
    vec3 hp = v_localPos + vec3(u_camInt);
    float scan = 0.7 + 0.3 * sin(hp.y * 50.0 - u_time * 5.0);
    float sweep = smoothstep(0.88, 1.0, fract(hp.y * 0.35 - u_time * 0.4));
    float flick = 0.93 + 0.07 * sin(u_time * 31.0 + hash13(floor(hp * 4.0)) * 40.0);
    col *= scan * flick + sweep * 0.9;
    if (u_animOn > 0.5) {
      // Animierte Anzeigen: a radar per 3 × 3 m panel (a sweep that turns, range rings, a crosshair, blips) and
      // scrolling readout bars on the rest of the screen, all in the panel's own plane so it reads as one display
      vec2 pl = face <= 1u ? hp.zy : (face <= 3u ? hp.xz : hp.xy);
      vec2 cc = (floor(pl / 3.0) + 0.5) * 3.0, d = pl - cc;
      float rr = length(d), ang = atan(d.y, d.x);
      float hc = hash12(floor(pl / 3.0));
      float da = mod(ang - (u_time * (0.5 + hc) + hc * 6.28) + 3.14159, 6.28318) - 3.14159;
      float inR = step(rr, 1.25);
      float wedge = clamp(1.0 - abs(da) / 0.8, 0.0, 1.0) * inR;
      float rings = ((1.0 - smoothstep(0.0, 0.05, abs(rr - 0.45))) + (1.0 - smoothstep(0.0, 0.05, abs(rr - 0.9)))) * inR;
      float cross = ((1.0 - smoothstep(0.0, 0.03, abs(d.x))) + (1.0 - smoothstep(0.0, 0.03, abs(d.y)))) * inR * 0.5;
      float blip = step(0.97, hash12(floor(pl * 3.0) + floor(u_time * 1.5))) * step(rr, 1.1);
      float rowF = pl.y * 6.0, row = floor(rowF);
      float bar = step(0.55, hash12(vec2(row, floor(pl.x * 3.0 + u_time * 2.0 * (0.6 + fract(row * 0.37)))))) * step(0.3, fract(rowF)) * (1.0 - step(0.75, fract(rowF)));
      vec3 ink = vec3(0.35, 0.95, 1.0);
#ifdef MOTION
      // t-motion: every 9 s a panel switches between the radar, a map (a grid, contour lines, a marker pinging along its
      // route) and the readouts (a trace and level bars); a bright scan line wipes down it in 0.6 s, the new picture
      // above the line, the old one below (each panel on its own phase: motion.js HOLO, the same numbers)
      float cyc = u_time / 9.0 + hc * 2.7, cf = fract(cyc) * 9.0, wy = 1.5 - cf * 5.0;
      float mode = mod(floor(cyc) - (d.y > wy ? 0.0 : 1.0), 3.0);
      float wipe = (1.0 - smoothstep(0.0, 0.07, abs(d.y - wy))) * step(cf, 0.62);
      vec3 hol;
      if (mode < 0.5) hol = ink * (wedge * 0.85 + rings * 0.55 + cross + blip * 1.4) + ink * bar * (1.0 - inR) * 0.75;
      else if (mode < 1.5) {
        vec2 gq = abs(fract(d * 2.0 + 0.5) - 0.5);
        float grid = 1.0 - smoothstep(0.0, 0.035, min(gq.x, gq.y));
        float hf = fract(vnoise(d * 1.1 + hc * 17.0) * 6.0);
        float cont = 1.0 - smoothstep(0.0, 0.09, min(hf, 1.0 - hf));
        vec2 mp = vec2(sin(u_time * 0.37 + hc * 6.0), sin(u_time * 0.23 + hc * 3.0)) * 1.05;
        float md = length(d - mp), pr = fract(u_time * 0.8);
        float mark = 1.0 - smoothstep(0.05, 0.12, md);
        float ping = (1.0 - smoothstep(0.0, 0.035, abs(md - pr * 0.7))) * (1.0 - pr);
        hol = ink * (grid * 0.3 + cont * 0.5 + mark * 1.6 + ping * 0.9);
      } else {
        float ty = 0.75 + 0.45 * sin(d.x * 3.1 + u_time * 2.3 + hc * 9.0) * (0.6 + 0.4 * sin(d.x * 7.3 - u_time * 1.1));
        float trace = (1.0 - smoothstep(0.0, 0.05, abs(d.y - ty))) * step(0.0, d.y);
        float bf = (d.x + 1.5) * 3.0, bi = floor(bf);
        float lvl = 0.55 + 0.4 * sin(u_time * (1.0 + hash12(vec2(bi, 3.0)) * 2.0) + bi * 1.7 + hc * 5.0);
        float bars = step(-1.35, d.y) * step(d.y, -1.35 + lvl * 1.15) * step(0.18, fract(bf)) * step(fract(bf), 0.82);
        float axis = (1.0 - smoothstep(0.0, 0.03, abs(d.y))) * 0.4;
        hol = ink * (trace * 1.3 + bars * 0.7 + axis);
      }
      col = col * 0.42 + hol + ink * wipe * 1.6;
#else
      col = col * 0.42 + ink * (wedge * 0.85 + rings * 0.55 + cross + blip * 1.4) + ink * bar * (1.0 - inR) * 0.75;
#endif
    }
  }
  if (u_animOn > 0.5 && u_pulseA > -0.5 && (abs(layer - u_pulseA) < 0.5 || abs(layer - u_pulseB) < 0.5)) {
    // the Hangar Hall's wall strips: a light that runs along the wall (the same phase wherever the walls meet)
    vec3 pp = v_localPos + vec3(u_camInt);
    col *= 0.8 + 0.2 * (0.5 + 0.5 * sin(u_time * 2.2 - pp.z * 0.8 - pp.x * 0.4));
  }
  if (kind == 3u) { // portal swirl
    vec2 p = vec2(v_localPos.x + v_localPos.z, v_localPos.y);
    float sw = vnoise(p * 3.0 + vec2(u_time * 0.8, -u_time * 0.6)) * vnoise(p * 1.5 - u_time * 0.3);
    col = alb.rgb * (1.2 + sw * 2.5);
  } else if (kind == 4u) { // stars (void gate)
    vec2 sp = gl_FragCoord.xy / 90.0;
    float st = step(0.985, hash12(floor(sp * 8.0 + u_time * 0.5))) + step(0.99, hash12(floor(sp * 14.0 - u_time * 0.3)));
    col = vec3(0.02, 0.03, 0.06) + vec3(0.4, 0.6, 1.0) * st * 3.0 + vec3(0.1, 0.25, 0.3) * vnoise(sp * 3.0 + u_time * 0.1);
  } else if (kind == 2u) { // lava
    vec2 p = v_localPos.xz + vec2(u_camInt.xz);
    float n1 = vnoise(p * 1.7 + vec2(u_time * 0.25, u_time * 0.18));
    float n2 = vnoise(p * 4.0 - vec2(u_time * 0.4, -u_time * 0.2));
    col = alb.rgb * (1.6 + n1 * 1.2 + n2 * 0.6) * vec3(1.0, 0.85, 0.7);
  }
  float dist = length(v_rel);
  col = applyFog(col, v_rel, dist);
  o_col = vec4(col, 1.0);
#ifdef SSR
  // (no mirror on what glows or burns; it fades with the distance as the fog takes the floor)
  o_ssr = vec4(octEnc(g_ssrN) * 0.5 + 0.5, (emis > 0.02 || emissiveFace || kind == 2u || kind == 3u || kind == 4u) ? 0.0 : g_ssrW * (1.0 - smoothstep(48.0, 80.0, dist)), g_ssrR);
#endif
}`;

  // ------------------------------------------------------------ smooth props (t-smooth, props.js): instanced palms
  // One vertex shader for the full palm, the far cross and the shadow pass. Instance: origin (camera-relative), yaw ·
  // scale, lean, wind phase, frond mask · sky and block light. The mask hides the fronds a palm does not carry (a
  // collapsed vertex draws nothing); the wind is the terrain's wind (u_wind, u_windDir) with the same gusts.
  S.PROP_VS = `
layout(location=0) in vec3 a_pos;
layout(location=1) in vec3 a_nrm;
layout(location=2) in vec2 a_uv;
layout(location=3) in vec3 a_col;
layout(location=4) in float a_bend;
layout(location=5) in float a_sway;
layout(location=6) in float a_frond;
layout(location=7) in vec4 a_inst0;
layout(location=8) in vec4 a_inst1;
layout(location=9) in vec4 a_inst2;
uniform mat4 u_viewProj;
uniform float u_time;
uniform float u_wind;
uniform vec2 u_windDir;
#ifdef SHADOWS
uniform mat4 u_shadowMat;
out vec4 v_shadow;
#endif
#ifdef MOTION
uniform float u_gust;
uniform vec3 u_camPos;   // t-motion: the camera's world position (the palm's place in the gust bands)
${VR.Wind ? VR.Wind.glsl() : ''}
#endif
out vec2 v_uv;
out vec3 v_col;
out vec3 v_n;
out vec3 v_rel;
out float v_sky;
out vec3 v_block;
${(VR.Light2 && VR.Light2.glslVS) ? VR.Light2.glslVS() : ''}
void main() {
  float on = mod(floor(a_inst1.w / exp2(a_frond)), 2.0) >= 1.0 ? 1.0 : 0.0;
  float sc = a_inst1.x, ph = a_inst1.z;
  vec3 p = a_pos * sc;
  p.x += a_inst1.y * a_bend;                       // the lean: the top stays, the trunk bends with its depth
  float c = cos(a_inst0.w), s = sin(a_inst0.w);
  vec3 q = vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z);
  vec3 nq = vec3(c * a_nrm.x - s * a_nrm.z, a_nrm.y, s * a_nrm.x + c * a_nrm.z);
#ifdef MOTION
  // t-motion · the fronds bend from the crown (props.js weights: t², base stiff, tip free), each flaps with its own phase,
  // the gust bands sweep through the crown and droop it (wind.js windFrond*)
  vec3 wpos = a_inst0.xyz + u_camPos;
  float G = windGust(wpos.x, wpos.z, u_time, u_windDir.x, u_windDir.y, u_gust);
  float amp = windFrondAmp(a_sway, sc, u_wind, G);
  q.xz += u_windDir * windFrondAlong(amp, a_frond, ph, u_time) + vec2(-u_windDir.y, u_windDir.x) * windFrondAcross(amp, a_frond, ph, u_time, p.y);
  q.y += windFrondUp(amp, a_frond, ph, u_time, G);
#else
  float gust = 0.6 + 0.4 * sin(u_time * 0.31 + ph * 0.23);
  float amp = u_wind * a_sway * sc * 0.16 * gust;
  float w1 = 0.65 + 0.35 * sin(u_time * 1.7 + ph);
  float w2 = 0.3 * sin(u_time * 2.6 + ph * 1.3 + p.y * 0.7);
  q.xz += u_windDir * (amp * w1) + vec2(-u_windDir.y, u_windDir.x) * (amp * w2);
#endif
  vec3 rel = q * on + a_inst0.xyz;
  v_uv = a_uv; v_col = a_col; v_n = nq; v_rel = rel; v_sky = a_inst2.x; v_block = a_inst2.yzw;
#ifdef SHADOWS
  v_shadow = u_shadowMat * vec4(rel + nq * 0.04, 1.0);
#endif
  gl_Position = u_viewProj * vec4(rel, 1.0);
#if defined(L2AO) && !defined(MODEL)
  v_l2AoClip = u_l2AoVP * vec4(rel + u_l2AoDelta, 1.0);   // t-light2: where this was in the last frame's view (its contact shadows)
#endif
}`;
  S.PROP_FS = `
uniform sampler2D u_tex;
uniform ivec3 u_camInt;      // (declared for the common block's heightmap shadow; the props do not march it)
#ifdef SHADOWS
uniform highp sampler2DShadow u_shadowMap;
uniform float u_shadowTexel;
uniform vec2 u_shadowOff;    // F9 · Schatten-Takt (0: the plain map)
in vec4 v_shadow;
#endif
${'__COMMON__'}
in vec2 v_uv;
in vec3 v_col;
in vec3 v_n;
in vec3 v_rel;
in float v_sky;
in vec3 v_block;
layout(location=0) out vec4 o_col;
#ifdef SHADOWS
// the sun's visibility from the shadow map: the terrain's four taps (no heightmap rays for the palms)
float propSun() {
  vec3 sc = v_shadow.xyz / v_shadow.w * 0.5 + 0.5;
  if (sc.x <= 0.001 || sc.x >= 0.999 || sc.y <= 0.001 || sc.y >= 0.999 || sc.z >= 1.0) return 1.0;
  float t = u_shadowTexel, b = 0.0006;
  vec2 su = fract(sc.xy + u_shadowOff);   // (F9: the toroidal map)
  float s = texture(u_shadowMap, vec3(su + vec2(-0.6, -0.6) * t, sc.z - b));
  s += texture(u_shadowMap, vec3(su + vec2(0.6, -0.6) * t, sc.z - b));
  s += texture(u_shadowMap, vec3(su + vec2(-0.6, 0.6) * t, sc.z - b));
  s += texture(u_shadowMap, vec3(su + vec2(0.6, 0.6) * t, sc.z - b));
  return s * 0.25;
}
#endif
void main() {
  bool solid = v_uv.x > 1.5;                       // the trunk, the bulb, the nuts: no atlas lookup
  vec4 t = solid ? vec4(1.0) : texture(u_tex, v_uv);
  if (t.a < 0.5) discard;                          // the cutout: leaflets and gaps
  vec3 alb = t.rgb * v_col;
  if (solid && v_uv.x < 2.5 && v_uv.y > 0.6) { float rg = fract(v_uv.y); alb *= 0.84 + 0.16 * smoothstep(0.04, 0.3, rg) * (1.0 - smoothstep(0.72, 0.97, rg)); }   // the bark rings
  vec3 N = gl_FrontFacing ? normalize(v_n) : -normalize(v_n);   // two-sided: a frond is lit from both faces
  float skyL = v_sky * v_sky * (3.0 - 2.0 * v_sky);
  vec3 blockL = pow(v_block, vec3(1.7)) * 1.35 * u_blockLightTint;
#ifdef LIGHT2
  blockL = l2Pool(v_block);   // t-light2: the lamps' pools
#endif
  float sunUp = smoothstep(-0.12, 0.12, u_sunDir.y);
  vec3 L = sunUp > 0.001 ? u_sunDir : u_moonDir;
  vec3 lc = sunUp > 0.001 ? u_sunColor * sunUp : u_moonColor;
  float ndl = clamp((dot(N, L) + 0.35) / 1.35, 0.0, 1.0);   // foliage: a soft wrap-around light
  float outdoors = smoothstep(0.55, 0.95, v_sky);
#ifdef SHADOWS
  float sh = outdoors > 0.0 ? propSun() : 1.0;
#else
  float sh = 1.0;
#endif
  vec3 lighting = u_ambSky * skyL * 0.92 + lc * ndl * sh * outdoors + blockL * 0.9 + vec3(0.012, 0.012, 0.016);
#ifdef LIGHT2
  if (!solid) ndl = l2Wrap(dot(N, L), u_l2K.z);   // t-light2: the fronds' wrap, as the terrain's leaves
  lighting = l2Hemi(N) * skyL * 0.95 + lc * ndl * sh * outdoors + blockL * 0.9 + vec3(0.012, 0.012, 0.016);
#endif
#ifdef L2AO
  // t-light2: the contact shadows take from the sky's light only (the palm's foot in the ground, the fronds' overlap)
#ifdef LIGHT2
  lighting -= l2Hemi(N) * skyL * 0.95 * (1.0 - l2Ao());
#else
  lighting -= u_ambSky * skyL * 0.92 * (1.0 - l2Ao());
#endif
#endif
  // a frond lets the light through: lit from behind it glows a warmer green (the trunk does not)
  if (!solid) lighting += lc * max(dot(-N, L), 0.0) * 0.45 * sh * outdoors * vec3(1.0, 1.05, 0.7);
  vec3 col = alb * lighting;
  col = applyFog(col, v_rel, length(v_rel));
  o_col = vec4(col, 1.0);
}`;
  // the shadow pass: the same vertices, the cutout only
  S.PROP_SHADOW_FS = `
uniform sampler2D u_tex;
in vec2 v_uv;
layout(location=0) out vec4 o_col;
void main() {
  if (texture(u_tex, v_uv).a < 0.5) discard;
  o_col = vec4(1.0);
}`;

  // ------------------------------------------------------------ smooth furniture (t-smooth, props.js): instanced pieces
  // Vertex: pos, normal, uv (the furniture atlas), colour, material, tint slot, ambient occlusion. Instance: the centre
  // (camera-relative) and the turn · the first colour (linear) and the second (an sRGB number) · sky and block light.
  S.FURN_VS = `
layout(location=0) in vec3 a_pos;
layout(location=1) in vec3 a_nrm;
layout(location=2) in vec2 a_uv;
layout(location=3) in vec3 a_col;
layout(location=4) in float a_mat;
layout(location=5) in float a_tint;
layout(location=6) in float a_ao;
layout(location=7) in vec4 a_inst0;
layout(location=8) in vec4 a_inst1;
layout(location=9) in vec4 a_inst2;
uniform mat4 u_viewProj;
#ifdef SHADOWS
uniform mat4 u_shadowMat;
out vec4 v_shadow;
#endif
#ifdef MOTION
// t-motion · the smooth pieces that hang swing as one about their hook, as the terrain's hung pieces do (wind.js hang):
// u_hang (renderer.js hangOf, one a slot) x 1 a lantern under its hook at y = u_hang.y, its lever u_hang.z long; x 2 an
// awning's cloth, its wall at z = u_hang.y (the piece's own frame), u_hang.z deep; 0 a piece that stands still
uniform vec4 u_hang;
uniform float u_time;
uniform float u_wind;
uniform vec2 u_windDir;
uniform float u_gust;
uniform vec3 u_camPos;
${VR.Wind ? VR.Wind.glsl() : ''}
#endif
out vec2 v_uv;
out vec3 v_col;
out vec3 v_n;
out vec3 v_rel;
out vec3 v_lp;
flat out float v_mat;
out float v_ao;
out float v_sky;
out vec3 v_block;
${(VR.Light2 && VR.Light2.glslVS) ? VR.Light2.glslVS() : ''}
void main() {
  float c = cos(a_inst0.w), s = sin(a_inst0.w);
  vec3 q = vec3(c * a_pos.x - s * a_pos.z, a_pos.y, s * a_pos.x + c * a_pos.z);
#ifdef MOTION
  if (u_hang.x > 0.5) {
    float lv = 3.0 * clamp(((u_hang.x < 1.5 ? u_hang.y - a_pos.y : u_hang.y - a_pos.z)) / u_hang.z, 0.0, 1.0);
    vec3 ap = a_inst0.xyz + u_camPos;   // (the piece's place: one phase for the whole piece)
    float G = windGust(ap.x, ap.z, u_time, u_windDir.x, u_windDir.y, u_gust);
    q.xz += u_windDir * windHangAlong(ap.x, ap.y, ap.z, u_time, u_wind, G, lv) + vec2(-u_windDir.y, u_windDir.x) * windHangAcross(ap.x, ap.y, ap.z, u_time, u_wind, G, lv);
    q.y += windHangUp(ap.x, ap.y, ap.z, u_time, u_wind, G, lv);
  }
#endif
  vec3 nq = vec3(c * a_nrm.x - s * a_nrm.z, a_nrm.y, s * a_nrm.x + c * a_nrm.z);
  vec3 rel = q + a_inst0.xyz;
  vec3 col = a_col;
  if (a_tint > 0.5 && a_tint < 1.5) col *= a_inst1.rgb;
  else if (a_tint > 1.5) { float t = a_inst1.w; vec3 b = vec3(floor(t / 65536.0), mod(floor(t / 256.0), 256.0), mod(t, 256.0)) / 255.0; col *= pow(b, vec3(2.2)); }
  v_uv = a_uv; v_col = col; v_n = nq; v_rel = rel; v_lp = a_pos; v_mat = a_mat; v_ao = a_ao; v_sky = a_inst2.x; v_block = a_inst2.yzw;
#ifdef SHADOWS
  v_shadow = u_shadowMat * vec4(rel + nq * 0.03, 1.0);
#endif
  gl_Position = u_viewProj * vec4(rel, 1.0);
#if defined(L2AO) && !defined(MODEL)
  v_l2AoClip = u_l2AoVP * vec4(rel + u_l2AoDelta, 1.0);   // t-light2: where this was in the last frame's view (its contact shadows)
#endif
}`;
  // the materials (props.js PR.MAT): 0 fabric, 1 wood, 2 metal, 3 glass, 4 light, 5 matte, 6 gloss, 7 leaf, 8 marble,
  // 9 leather, 10 a lamp shade (lit from inside), 11 the contact shadow. The terrain's light (the sky as a hemisphere, the
  // sun through the shadow map outdoors, the block light of the lamps from above), F2's response (metal mirrors its
  // surroundings tinted by its colour, smooth surfaces take a fresnel rim, fabric is matte with a soft sheen at grazing
  // angles), the surface detail of wood grain, weave and marble veins faded with distance, the same fog.
  S.FURN_FS = `
uniform sampler2D u_tex;
uniform ivec3 u_camInt;      // (declared for the common block's heightmap shadow; the pieces do not march it)
uniform float u_emissiveBoost;
uniform float u_blockVar;    // the Klassisch look (VR.LOOK.vary, t-smooth2): the pieces answer like the blocks — the surface detail on the blocks' 16-texel grid, a duller sheen; their shape never changes
#ifdef SHADOWS
uniform highp sampler2DShadow u_shadowMap;
uniform float u_shadowTexel;
uniform vec2 u_shadowOff;    // F9 · Schatten-Takt (0: the plain map)
in vec4 v_shadow;
#endif
${'__COMMON__'}
in vec2 v_uv;
in vec3 v_col;
in vec3 v_n;
in vec3 v_rel;
in vec3 v_lp;
flat in float v_mat;
in float v_ao;
in float v_sky;
in vec3 v_block;
layout(location=0) out vec4 o_col;
#ifdef SHADOWS
float furnSun() {
  vec3 sc = v_shadow.xyz / v_shadow.w * 0.5 + 0.5;
  if (sc.x <= 0.001 || sc.x >= 0.999 || sc.y <= 0.001 || sc.y >= 0.999 || sc.z >= 1.0) return 1.0;
  float t = u_shadowTexel, b = 0.0006;
  vec2 su = fract(sc.xy + u_shadowOff);   // (F9: the toroidal map)
  float s = texture(u_shadowMap, vec3(su + vec2(-0.6, -0.6) * t, sc.z - b));
  s += texture(u_shadowMap, vec3(su + vec2(0.6, -0.6) * t, sc.z - b));
  s += texture(u_shadowMap, vec3(su + vec2(-0.6, 0.6) * t, sc.z - b));
  s += texture(u_shadowMap, vec3(su + vec2(0.6, 0.6) * t, sc.z - b));
  return s * 0.25;
}
#endif
vec3 furnEnv(vec3 R) { return mix(u_skyHorizon * 0.5, mix(u_skyHorizon, u_skyMid, smoothstep(0.0, 0.8, R.y)), smoothstep(-0.05, 0.6, R.y)); }
void main() {
  int m = int(v_mat + 0.5);
  float dist = length(v_rel);
  if (m == 11) {
    // the contact shadow: a soft patch under the piece, fading at its edges and with distance
    vec2 q = abs(v_uv - 0.5) * 2.0;
    float e = length(max(q - 0.5, 0.0)) / 0.5;
    o_col = vec4(0.0, 0.0, 0.0, (1.0 - smoothstep(0.0, 1.0, e)) * 0.42 * (1.0 - smoothstep(16.0, 26.0, dist)));
    return;
  }
  vec4 t = texture(u_tex, v_uv);
  if (m == 7 && t.a < 0.5) discard;
  vec3 alb = v_col * t.rgb;
  if (m == 4) {
    // the lights: a bulb, the inside of a shade, a screen
    o_col = vec4(applyFog(alb * (1.7 + u_emissiveBoost), v_rel, dist), 1.0);
    return;
  }
  vec3 N = normalize(v_n);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(-v_rel);
  float fade = 1.0 - smoothstep(6.0, 14.0, dist);
  vec3 lp = v_lp * 16.0;
  bool klassisch = u_blockVar > 0.5;
  if (klassisch) lp = floor(lp) + 0.5;           // Klassisch: grain, weave and veins in block texels
  float rough = 0.8, metal = 0.0, sheen = 0.0;
  if (m == 0) { rough = 0.96; sheen = 0.5; alb *= 1.0 + fade * 0.07 * (vnoise(lp.xy * 1.9 + lp.zz * 1.3) - 0.5); }
  else if (m == 1) { rough = 0.42; float g = vnoise(vec2(lp.x * 0.11 + lp.z * 0.03, (lp.y + lp.z) * 2.6)) * 0.7 + vnoise(vec2(lp.x * 0.5, (lp.y - lp.z) * 7.0)) * 0.3; alb *= 1.0 + fade * 0.22 * (g - 0.5); }
  else if (m == 2) { rough = 0.3; metal = 1.0; }
  else if (m == 3) { rough = 0.05; }
  else if (m == 5) { rough = 0.82; }
  else if (m == 6) { rough = 0.16; }
  else if (m == 7) { rough = 0.62; sheen = 0.2; }
  else if (m == 8) { rough = 0.2; float vn = vnoise(lp.xz * 0.32 + vec2(lp.y * 0.21)); alb *= 1.0 - fade * 0.12 * (smoothstep(0.46, 0.5, vn) - smoothstep(0.5, 0.54, vn)); }
  else if (m == 9) { rough = 0.48; }
  else if (m == 10) { rough = 0.95; sheen = 0.3; }
  else if (m == 12) { rough = 0.03; metal = 1.0; }
  if (klassisch && m != 12) { rough = max(rough, 0.34); sheen *= 0.6; }   // Klassisch: the blocks' matter, less gloss
  float skyL = v_sky * v_sky * (3.0 - 2.0 * v_sky);
  vec3 blockL = pow(v_block, vec3(1.7)) * 1.35 * u_blockLightTint;
#ifdef LIGHT2
  blockL = l2Pool(v_block);   // t-light2: the lamps' pools
#endif
  float sunUp = smoothstep(-0.12, 0.12, u_sunDir.y);
  vec3 L = sunUp > 0.001 ? u_sunDir : u_moonDir;
  vec3 lc = sunUp > 0.001 ? u_sunColor * sunUp : u_moonColor;
  float wrap = (m == 0 || m == 7 || m == 10) ? 0.3 : 0.0;
  float ndl = clamp((dot(N, L) + wrap) / (1.0 + wrap), 0.0, 1.0);
  float outdoors = smoothstep(0.55, 0.95, v_sky);
#ifdef SHADOWS
  float sh = outdoors > 0.0 && ndl > 0.0 ? furnSun() : 1.0;
#else
  float sh = 1.0;
#endif
  float up = 0.5 + 0.5 * N.y;
  if (m == 12) {
    // a mirror (t-smooth2, MAT.mirror): the room seen in it — indoors a bright ceiling, the walls in the room's light, a
    // darker floor and a soft line where the far wall meets it; outdoors the sky — with the sun's glint
    vec3 Rm = reflect(-V, N);
    vec3 roomL = blockL * 0.9 + u_ambSky * skyL * 0.75 + vec3(0.04);
    vec3 room = roomL * (Rm.y > 0.0 ? mix(0.95, 1.3, smoothstep(0.05, 0.8, Rm.y)) : mix(0.8, 0.5, smoothstep(0.0, 0.6, -Rm.y)));
    room *= 1.0 - 0.25 * (1.0 - smoothstep(0.0, 0.06, abs(Rm.y + 0.02)));
    vec3 envM = mix(room, furnEnv(Rm) * (0.35 + 0.65 * v_sky), outdoors);
    vec3 cm = alb * envM * 1.1 * v_ao + lc * pow(max(dot(N, normalize(L + V)), 0.0), 400.0) * sh * outdoors;
    o_col = vec4(applyFog(cm, v_rel, dist), 1.0);
    return;
  }
  vec3 amb = u_ambSky * skyL * mix(0.45, 1.0, up);
#ifdef LIGHT2
  amb = l2Hemi(N) * skyL;   // t-light2: the sky from above, the ground's bounce from below
#endif
#ifdef L2AO
  amb *= l2Ao();   // t-light2: the contact shadows (under the table, in the sofa's corner)
#endif
  vec3 blk = blockL * mix(0.5, 1.0, up);
  vec3 col = alb * ((amb + lc * ndl * sh * outdoors) * v_ao + blk * v_ao + vec3(0.012, 0.012, 0.016)) * (1.0 - metal * 0.85);
#ifndef LITE
  // highlights: the sun's (outdoors) and the room light's (from above, in the lamps' colour)
  float shin = mix(180.0, 10.0, rough), ks = (1.0 - rough) * 1.4;
  vec3 spc = mix(vec3(1.0), alb, metal);
  vec3 Hs = normalize(L + V);
  col += lc * pow(max(dot(N, Hs), 0.0), shin) * ks * sh * outdoors * spc;
  vec3 Hb = normalize(normalize(vec3(0.3, 1.0, 0.2)) + V);
  col += blockL * pow(max(dot(N, Hb), 0.0), shin) * ks * 0.8 * spc * v_ao;
#endif
  // reflections: outdoors the sky, indoors the room's light
  vec3 env = mix(blockL * 0.7 + u_ambSky * skyL * 0.5 + vec3(0.02), furnEnv(reflect(-V, N)) * (0.3 + 0.7 * v_sky), outdoors);
  float nv = max(dot(N, V), 0.0), fres = 0.04 + 0.96 * pow(1.0 - nv, 5.0);
  if (metal > 0.5) col += alb * env * (1.0 - rough * 0.6) * 1.1 * v_ao;
  else col += env * fres * (1.0 - rough) * 0.6 * v_ao;
  col += alb * sheen * pow(1.0 - nv, 3.0) * (amb + blk + lc * sh * outdoors * 0.3) * 0.6;
  if (m == 10) col += alb * vec3(1.0, 0.86, 0.62) * (0.55 + 0.25 * u_emissiveBoost);   // a shade glows through
  float alpha = 1.0;
  if (m == 3) { alpha = clamp(0.16 + 0.7 * fres, 0.0, 0.9); col = col * 0.5 + env * fres; }
  o_col = vec4(applyFog(col, v_rel, dist), alpha);
}`;
  // the shadow pass: the same vertices, the leaves cut out
  S.FURN_SHADOW_FS = `
uniform sampler2D u_tex;
in vec2 v_uv;
flat in float v_mat;
layout(location=0) out vec4 o_col;
void main() {
  if (int(v_mat + 0.5) == 7 && texture(u_tex, v_uv).a < 0.5) discard;
  o_col = vec4(1.0);
}`;

  // ------------------------------------------------------------ translucent (water / glass / ice)
  S.TRANS_FS = `
uniform sampler2DArray u_albedo;
uniform sampler2DArray u_material;
uniform sampler2D u_sceneColor;
uniform sampler2D u_sceneDepth;
uniform sampler2D u_noise;
uniform vec2 u_screen;
uniform vec2 u_nearFar;
uniform ivec3 u_camInt;
uniform vec3 u_camFrac;
uniform vec3 u_waterFogColor;
uniform float u_underwater;
uniform float u_blockVar;     // Klassisch: still water reads per block (chunky ripples, a faint seam), glass texels crisp
uniform sampler2D u_reflTex;  // F7: the planar reflection of the water (renderer.js), valid when u_reflOn > 0.5
uniform float u_reflOn;
uniform highp sampler2D u_reflDepth;  // F9 · Spiegelung leicht: the mirror's depth and size (texels) for its edge-aware upsample
uniform vec2 u_reflSize;
uniform float u_reflUp;               // 1: the mirror is a quarter size and read edge-aware (0: one bilinear tap as before)
uniform float u_waterTier;    // 0 Very Low (sky-LUT reflection only, no caustics), 1 and 2: caustics on the floor
uniform vec2 u_windDir;       // the wind's heading (weather.js), the swell runs with it
uniform float u_stormK;       // the storm factor of the waves (water_wave.js)
#ifdef PBR
uniform sampler2D u_pbr;      // t-material: the material table (tex_pbr.js; a: 1 a window pane, 2 glass, 4 glows only when tinted)
uniform float u_glassRefr;    // t-material: 1 when the scene copy holds this frame's opaque world (pbr 2): window panes filter it
#endif
${(VR.WaterWave ? VR.WaterWave.glsl() : '')}
#ifndef LITE
${(VR.WaterFx ? VR.WaterFx.glsl() : '')}
#endif
#ifdef MODEL
uniform mat3 u_normalMat;
uniform float u_clipNear;
#endif
#ifdef SHADOWS
uniform highp sampler2DShadow u_shadowMap;
uniform float u_shadowTexel;
uniform vec2 u_shadowOff;    // F9 · Schatten-Takt (0: the plain map)
in vec4 v_shadow;
#endif
${'__COMMON__'}
${LOOK}
in vec3 v_rel;
in vec2 v_uv;
flat in uint v_w3;
flat in uint v_w5;
in float v_sky;
in vec3 v_block;
in float v_ao;
in vec3 v_tint;
in vec3 v_localPos;
#ifdef FADE
flat in float v_fade;
#endif
layout(location=0) out vec4 o_col;
const vec3 NORMALS[6] = vec3[6](vec3(1,0,0), vec3(-1,0,0), vec3(0,1,0), vec3(0,-1,0), vec3(0,0,1), vec3(0,0,-1));
float linDepth(float d) { float z = d * 2.0 - 1.0; return 2.0 * u_nearFar.x * u_nearFar.y / (u_nearFar.y + u_nearFar.x - z * (u_nearFar.y - u_nearFar.x)); }
// F9 · the quarter-size mirror read edge-aware: of its four texels round the point, the ones on the nearest surface keep
// their bilinear weight and the ones behind it (more than 8 % deeper) drop out, so a roof's edge against the sky stays a
// line instead of a smear; one bilinear tap when u_reflUp is 0
vec3 reflSample(vec2 uv) {
  if (u_reflUp < 0.5) return texture(u_reflTex, uv).rgb;
  vec2 t = uv * u_reflSize - 0.5, f = fract(t), b = (floor(t) + 0.5) / u_reflSize, e = 1.0 / u_reflSize;
  vec2 o1 = b + vec2(e.x, 0.0), o2 = b + vec2(0.0, e.y), o3 = b + e;
  vec4 d = vec4(linDepth(texture(u_reflDepth, b).r), linDepth(texture(u_reflDepth, o1).r), linDepth(texture(u_reflDepth, o2).r), linDepth(texture(u_reflDepth, o3).r));
  float dn = min(min(d.x, d.y), min(d.z, d.w));
  vec4 w = vec4((1.0 - f.x) * (1.0 - f.y), f.x * (1.0 - f.y), (1.0 - f.x) * f.y, f.x * f.y);
  w *= step(d, vec4(dn * 1.08 + 0.05)) + 1e-4;
  vec3 c = texture(u_reflTex, b).rgb * w.x + texture(u_reflTex, o1).rgb * w.y + texture(u_reflTex, o2).rgb * w.z + texture(u_reflTex, o3).rgb * w.w;
  return c / (w.x + w.y + w.z + w.w);
}
float shadowAt(vec3 N, vec3 L) {
#ifdef SHADOWS
  vec3 sc = v_shadow.xyz / v_shadow.w * 0.5 + 0.5;
  if (!(sc.x <= 0.0 || sc.x >= 1.0 || sc.y <= 0.0 || sc.y >= 1.0 || sc.z >= 1.0)) return texture(u_shadowMap, vec3(fract(sc.xy + u_shadowOff), sc.z - 0.0008));
#endif
#ifdef HSHADOW
  return hShadow(v_localPos, N, L);
#else
  return 1.0;
#endif
}
// F2 · the sky seen in a reflection (the same cheap term as the terrain's matEnv)
vec3 matEnv(vec3 R) {
  return mix(u_skyHorizon * 0.5, mix(u_skyHorizon, u_skyMid, smoothstep(0.0, 0.8, R.y)), smoothstep(-0.05, 0.6, R.y));
}
vec3 waveNormal(vec2 p) {
  float t = u_time;
  vec2 a = p * 0.9 + vec2(t * 0.35, t * 0.22);
  vec2 b = p * 2.3 + vec2(-t * 0.5, t * 0.41);
  float e = 0.08;
  float h0 = texture(u_noise, a / 16.0).b * 0.6 + texture(u_noise, b / 16.0).b * 0.4;
  float hx = texture(u_noise, (a + vec2(e, 0.0)) / 16.0).b * 0.6 + texture(u_noise, (b + vec2(e, 0.0)) / 16.0).b * 0.4;
  float hz = texture(u_noise, (a + vec2(0.0, e)) / 16.0).b * 0.6 + texture(u_noise, (b + vec2(0.0, e)) / 16.0).b * 0.4;
  return normalize(vec3((h0 - hx) * 1.6, 1.0, (h0 - hz) * 1.6));
}
// the flow of a river (the mesher's slope rule, w3 bits 12-13): down the slope in one of four directions
vec2 flowDir(uint w3) {
  uint r = (w3 >> 12u) & 3u;
  return r == 0u ? vec2(0.0, -1.0) : r == 1u ? vec2(1.0, 0.0) : r == 2u ? vec2(0.0, 1.0) : vec2(-1.0, 0.0);
}
// rain rings: the slope of the surface where drops land (one hashed spot per block, each ring grows and fades)
vec2 ringN(vec2 p, float t) {
  vec2 g = floor(p), acc = vec2(0.0);
  for (int j = -1; j <= 0; j++) for (int i = -1; i <= 0; i++) {
    vec2 cell = g + vec2(float(i), float(j));
    float h1 = hash12(cell), h2 = hash12(cell + vec2(17.3, 5.1));
    float age = fract(t * 0.6 + h1 * 7.0);
    float rad = age * 0.45;
    vec2 dv = p - (cell + vec2(h1, h2));
    float dd = length(dv), e = dd - rad;
    acc += dv / max(dd, 1e-3) * (cos(e * 40.0) * exp(-e * e * 90.0) * (1.0 - age));
  }
  return acc * 0.25;
}
// caustics: the light network that the surface throws onto a shallow floor (warped sines, bright where the
// fold lines cross; our own construction)
float causticAt(vec2 p, float t) {
  vec2 q = p * 0.7;
  float c = 0.0;
  for (int i = 0; i < 3; i++) {
    q += 0.55 * vec2(sin(q.y * 1.4 + t * 0.6 + float(i)), sin(q.x * 1.2 - t * 0.5 + float(i) * 1.9));
    c += 1.0 - abs(sin(q.x * 2.2) * sin(q.y * 2.2));
  }
  return pow(c / 3.0, 5.0);
}
void main() {
#ifdef MODEL
  if (u_clipNear > 0.0 && length(v_rel) < u_clipNear) discard;
#endif
#ifdef FADE
  if (v_fade < 1.0 && bayer4(gl_FragCoord.xy) >= v_fade) discard;
#endif
  uint face = v_w5 & 7u;
  uint kind = (v_w5 >> 8u) & 7u;
  float layer = float(v_w3 & 4095u);
  vec2 fu = fract(v_uv);
  vec3 V = normalize(-v_rel);
  float dist = length(v_rel);
  vec2 suv = gl_FragCoord.xy / u_screen;
  float sunUp = smoothstep(-0.12, 0.12, u_sunDir.y);
  vec3 L = sunUp > 0.001 ? u_sunDir : u_moonDir;
  vec3 lc = sunUp > 0.001 ? u_sunColor * sunUp : u_moonColor;
  float skyL = v_sky * v_sky;
  vec3 blockL = pow(v_block, vec3(1.7)) * 1.35 * u_blockLightTint;
  if (kind == 3u) {
    // ---------------- portal veil (t3_04): a hot orange-white rim on the frame, blue-white energy crackling a few
    // blocks in from it, and a clear middle that shows what lies beyond (the hall, the palm city). The mesher hands each
    // corner its distance to the veil's rim in v_uv.x (mesher.js emitVeilQuad); the swirl and the filaments drift in
    // world space, so neighbouring veil blocks join. Animierte Anzeigen off (Very Low): no noise, one texture read
    vec3 wp = v_localPos + vec3(u_camInt);
    vec2 pp = face <= 1u ? wp.zy : (face <= 3u ? wp.xz : wp.xy);
    float rd = v_uv.x;
    float swirl, fil = 0.0, wob = 0.0;
    if (u_animOn > 0.5) {
      float s1 = vnoise(pp * 0.8 + vec2(u_time * 0.35, -u_time * 0.27));
      float s2 = vnoise(pp * 2.1 - vec2(u_time * 0.8, u_time * 0.55));
      swirl = s1 * 0.6 + s2 * 0.4;
      wob = (s1 - 0.5) * 1.6;
      // lightning: the thin iso-lines of a warped, fast noise (two layers, so the strands cross and flicker)
      float w = vnoise(pp * 0.7 + vec2(u_time * 0.6, u_time * 0.4)) * 2.0;
      float n1 = vnoise(pp * 1.5 + vec2(w, -u_time * 1.3)), n2 = vnoise(pp * 2.6 + vec2(u_time * 1.7, w));
      fil = (1.0 - smoothstep(0.0, 0.05, abs(n1 - 0.5))) + (1.0 - smoothstep(0.0, 0.035, abs(n2 - 0.5))) * 0.6;
    } else {
      swirl = clamp((texture(u_albedo, vec3(fract(pp * 0.25), layer)).a - 0.3) / 0.3, 0.0, 1.0);
    }
    // the energy hugs the rim (about 2 blocks, its edge wavering) so the middle stays clear, as in t3_04
    float rim = 1.0 - smoothstep(0.0, 0.75, rd);
    float band = 1.0 - smoothstep(0.3, 1.9 + wob * 0.6, rd);
    float e = clamp(band * (0.2 + 0.8 * swirl) * 0.8 + fil * band, 0.0, 1.0);
#ifdef MOTION
    // t-motion: rings run out from the veil's middle to its rim (rd falls toward the rim, so the crests of
    // sin(rd·3.2 + t·2.2) move outward at 0.7 blocks a second), bright where the veil is clear, and its energy breathes
    // (motion.js VEIL, the same numbers)
    if (u_animOn > 0.5) e = clamp((e + smoothstep(0.55, 1.0, sin(rd * 3.2 + u_time * 2.2)) * smoothstep(0.9, 2.4, rd) * 0.3) * (0.9 + 0.1 * sin(u_time * 1.7)), 0.0, 1.0);
#endif
    vec3 hot = mix(vec3(1.0, 0.62, 0.28), vec3(1.0, 0.92, 0.8), 1.0 - smoothstep(0.0, 0.3, rd)) * 2.8;
    vec3 vcol = mix(vec3(0.12, 0.38, 1.0) * 0.9, vec3(0.5, 0.82, 1.0) * 2.4, e);
    vcol = mix(vcol, hot, rim);
    float va = clamp(0.04 + 0.06 * swirl + e * 0.75 + rim * 0.92, 0.0, 0.97);
    vcol = applyFog(vcol, v_rel, dist);
    o_col = vec4(vcol, va);
    return;
  }
  if (kind == 1u || kind == 6u) {
    // ---------------- water ----------------
    // every water surface exists twice (one copy per side, for looking up from below); only the copy
    // facing the camera may shade — the other one z-fights and would mirror the sky at fresnel = 1
    if (dot(NORMALS[face], V) < 0.0) discard;
    vec3 wp = v_localPos + vec3(u_camInt);
    vec3 wcol = v_tint;
    float sceneD = texture(u_sceneDepth, suv).r;
    float thick = max(0.0, linDepth(sceneD) - linDepth(gl_FragCoord.z));
    // the surface: three Gerstner octaves (water_wave.js, the same functions the bob uses on the CPU). The body of
    // water sets the size (a pond is calm, the sea rolls, the shore flattens), the air the storm; a river runs with
    // its flow. Klassisch quantises the ripples to 16 px per block, like the ground's texels
    vec3 n = NORMALS[face];
    float ak = waterBody(thick) * u_stormK;
    vec2 wq = u_blockVar > 0.5 ? (floor(wp.xz * 16.0) + 0.5) / 16.0 : wp.xz;
#ifndef LITE
    float whN = 0.0;   // (t-material: the height over its amplitude, −1…1 — the crests' foam)
#endif
    if (face == 2u) {
      float wh = 0.0;
      n = gerstnerN(wq, u_time, kind == 6u ? flowDir(v_w3) : u_windDir, kind == 6u ? ak * 0.6 : ak, wh);
#ifndef LITE
      whN = wh / max((WV_A[0] + WV_A[1] + WV_A[2]) * (kind == 6u ? ak * 0.6 : ak), 1e-4);
#endif
    } else if (kind == 6u) {
      // a falling sheet (waterfall): streaks run down the face
      vec3 tg = (face == 0u || face == 1u) ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
      float streak = sin(dot(wp, tg) * 9.0 + sin(wp.y * 2.0) * 1.3 - u_time * 1.5);
      n = normalize(NORMALS[face] + tg * streak * 0.14);
    }
    if (face == 2u && u_rain > 0.02 && u_waterTier > 0.5) { vec2 g = ringN(wp.xz, u_time) * u_rain; n = normalize(vec3(n.x + g.x, n.y, n.z + g.y)); }
    vec2 off = n.xz * 0.035 * clamp(thick * 0.3, 0.0, 1.0) * (1.0 - u_underwater * 0.6);
    vec3 refr = texture(u_sceneColor, clamp(suv + off, 0.001, 0.999)).rgb;
    float sd2 = texture(u_sceneDepth, clamp(suv + off, 0.001, 0.999)).r;
    if (sd2 < gl_FragCoord.z) refr = texture(u_sceneColor, suv).rgb;
    float absorb = 1.0 - exp(-thick * 0.5);
    // designed water body: deep navy with drifting patches of brighter ocean blue and a whisper of green;
    // ripples facing the light catch it. The biome tint only nudges it (swamps stay murky)
    float pN = texture(u_noise, wp.xz / 38.0 + vec2(u_time * 0.004, -u_time * 0.003)).r;
    float bandN = texture(u_noise, wp.xz / 11.0 + vec2(-u_time * 0.012, u_time * 0.009)).g;
    float brightK = smoothstep(0.4, 0.7, pN * 0.72 + bandN * 0.28);
    float depthK = clamp(thick / 14.0, 0.0, 1.0);
    vec3 navy = vec3(0.010, 0.040, 0.140), ocean = vec3(0.060, 0.300, 0.660), sea = vec3(0.030, 0.200, 0.190);
    // (softer patches than before: the blotches read as clouds on the water, the sky reflection should carry the look)
    vec3 body = mix(ocean, navy, clamp(0.42 + depthK * 0.4 - brightK * 0.4, 0.0, 1.0));
    body = mix(body, sea, 0.12 + bandN * 0.08);
    float ripple = clamp(0.5 + dot(n.xz, normalize(L.xz + vec2(1e-4))) * 2.6, 0.0, 1.0);
    body *= 0.84 + ripple * 0.32;
    body = mix(body, wcol * vec3(0.55, 0.75, 0.9), 0.16);
    // a falling sheet is aerated: lighter, with bands of brighter water running down it
    if (kind == 6u) body = mix(body, vec3(0.34, 0.6, 0.95) * (0.82 + 0.36 * sin(wp.y * 7.0 + sin(wp.x * 3.0 + wp.z * 2.0) * 1.7 - u_time * 3.0)), 0.5);
    // Klassisch: a faint seam where two blocks of the surface meet, in the water's own colour (the reflection stays
    // whole), fading out where a block is only a few pixels wide
    float seamK = 0.0, pxW = max(fwidth(wp.x), fwidth(wp.z));
    if (u_blockVar > 0.5 && face == 2u) {
      vec2 g = fract(wp.xz), e = min(g, 1.0 - g);
      seamK = (1.0 - smoothstep(0.08, 0.25, pxW)) * (1.0 - smoothstep(0.03, 0.03 + pxW, min(e.x, e.y)));
    }
    vec3 deep = body * (u_ambSky * skyL * 0.74 + blockL * 0.45 + lc * 0.095 * v_sky) + body * 0.012;
    // the biome's water colour sets what the water keeps of the light (clear lagoon turquoise, murky swamp green,
    // the cold sea's deep blue): its hue, brightest channel 1, mixed into the absorption
    vec3 bioN = wcol / max(max(wcol.r, max(wcol.g, wcol.b)), 1e-3);
    vec3 absCol = mix(vec3(0.26, 0.6, 0.92) + vec3(0.0, 0.04, 0.0) * bandN, bioN * vec3(0.62, 0.9, 1.0), 0.75);
    vec3 under = mix(refr * mix(vec3(1.0), absCol, 0.72), deep, clamp(absorb, 0.0, 0.96));
#ifndef LITE
    // t-material · the trailer's water (water_fx.js; tier ≥ 1, never Very Low): the colour follows the depth — the floor seen
    // through the path of water loses its red first (turquoise over the bright sand), the water's own colour turns from
    // turquoise to deep blue, and the designed deep body takes over past a few blocks
    float pathL = thick * dist / max(linDepth(gl_FragCoord.z), 0.06), vdep = pathL * max(V.y, 0.0);
    if (u_waterTier > 0.5 && face == 2u) {
      vec3 Tr = exp(-WFX_ABS * pathL);
      vec3 litW = u_ambSky * skyL * 0.85 + blockL * 0.45 + lc * 0.14 * v_sky + 0.012;
      vec3 own = mix(wfxTint(pathL) * litW, deep, smoothstep(3.5, 12.0, pathL));
      under = mix(under, refr * Tr + own * (1.0 - dot(Tr, vec3(0.2, 0.5, 0.3))), 0.85);
    }
#endif
    // caustics (tier >= 1): the sun's light network on the floor seen through shallow water
    if (u_waterTier > 0.5 && face == 2u && thick < 6.0 && sunUp > 0.001) {
      vec3 D = -V;
      vec2 fl = wp.xz + D.xz / max(-D.y, 0.25) * thick * 0.75;
#ifndef LITE
      under += u_sunColor * sunUp * wfxCaustic(fl, u_time, u_waterTier > 1.5 ? 3 : 2) * 0.26 * exp(-thick * 0.3) * (1.0 - u_rain);   // (t-material: two octaves on tier 1)
#else
      under += u_sunColor * sunUp * causticAt(fl, u_time) * 0.22 * exp(-thick * 0.3) * (1.0 - u_rain);
#endif
    }
    vec3 R = reflect(-V, n);
    R.y = abs(R.y);
#ifndef LITE
    // (t-material: on tier 2 the sky the water mirrors is the whole sky — at night its stars and the nebula — where the
    // planar mirror does not reach)
    vec3 refl = skyColor(R, u_waterTier > 1.5 && u_reflOn < 0.5) * mix(0.25, 1.0, skyL);
#else
    vec3 refl = skyColor(R, false) * mix(0.25, 1.0, skyL);
#endif
    refl = mix(refl, refl * vec3(0.62, 0.84, 1.0) + body * 0.25, 0.4);
    if (u_reflOn > 0.5) {
      // the planar reflection (renderer.js): the mirrored near world and sky, shifted by the slope of the surface
      vec3 pr = reflSample(clamp(suv + n.xz * vec2(0.22, 0.4), 0.001, 0.999));
      refl = pr * vec3(0.86, 0.94, 1.0) + body * 0.1;
    }
    float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
#ifndef LITE
    // (t-material, run 2: the clear water's bright floor took the mirror's contrast — the lake held the floating islands
    // only faintly. Tier ≥ 1 lets the far water mirror fully, as real water does: clear at the feet, a mirror further out)
    fres = u_waterTier > 0.5 ? min(fres, 0.82) : min(fres * 0.85, 0.66);
#else
    fres = min(fres * 0.85, 0.66);
#endif
    if (u_underwater > 0.5) { fres = face == 3u ? 0.0 : fres * 0.3; }
    vec3 col = mix(under * (1.0 - 0.22 * seamK), refl, clamp(fres, 0.0, 1.0));
    // sun sparkle: a GGX lobe whose width follows the slope (steep water glitters wider and dimmer), plus a sheen
    vec3 H = normalize(L + V);
    float nh = max(dot(n, H), 0.0);
    float a = 0.02 + 0.09 * clamp(length(n.xz) * 2.0, 0.0, 1.0), a2 = a * a;
    float dd = nh * nh * (a2 - 1.0) + 1.0;
    float sp = (a2 / (3.14159 * dd * dd)) * (0.02 + 0.98 * pow(1.0 - max(dot(H, V), 0.0), 5.0)) * 0.035 + pow(nh, 60.0) * 0.12;
    col += lc * sp * (sp > 0.004 ? shadowAt(NORMALS[face], L) : 1.0) * smoothstep(0.6, 1.0, v_sky) * (1.0 - u_rain);
#ifndef LITE
    // t-material: the sun's glitter — tiny facets of the chop that flash into the eye for a moment each
    if (u_waterTier > 0.5 && face == 2u && sunUp > 0.001) {
      vec2 gc = floor(wp.xz * 7.0);
      float gh = hash12(gc + floor(u_time * 6.0 + hash12(gc + 9.1) * 6.0));
      vec3 gnm = normalize(n + vec3(gh - 0.5, 0.0, hash12(gc + 3.7) - 0.5) * 0.35);
      col += lc * pow(max(dot(reflect(-V, gnm), L), 0.0), 900.0) * step(0.8, gh) * 7.0 * smoothstep(0.6, 1.0, v_sky) * (1.0 - u_rain);
    }
#endif
    // shore foam
    // (a broken, drifting line from the noise where the water is a few tenths of a block deep, not a regular stripe)
    // (thin: a step between two water levels also measures as shallow, so the foam must stay a whisper there)
    float foamN = texture(u_noise, wp.xz / 5.0 + vec2(u_time * 0.02, -u_time * 0.015)).r;
#ifndef LITE
    if (u_waterTier > 0.5) {
      // t-material: foam on the banks (a noise mask by the depth under the surface) and on the crests of a rough water
      float fn2 = texture(u_noise, wp.xz / 1.7 - vec2(u_time * 0.05, u_time * 0.03)).g;
      // (run 2: far off the bank's foam averaged into a milky band across the lake — it fades by 60 blocks, where its
      // flecks are smaller than a pixel)
      float fm = max(wfxShore(vdep, foamN * 0.65 + fn2 * 0.35), wfxCrest(whN, ak, fn2)) * (1.0 - smoothstep(22.0, 60.0, dist));
      col = mix(col, vec3(0.92, 0.96, 1.0) * (u_ambSky * skyL + blockL + lc * 0.45 * v_sky + 0.02), clamp(fm, 0.0, 1.0) * 0.75 * float(face == 2u));
    } else {
#endif
    float foam = (1.0 - smoothstep(0.0, 0.2, thick)) * smoothstep(0.45, 0.7, foamN);
    col = mix(col, vec3(0.9) * (u_ambSky * skyL + blockL + lc * 0.3), clamp(foam, 0.0, 1.0) * 0.28 * float(face == 2u));
#ifndef LITE
    }
#endif
    col = applyFog(col, v_rel, dist);
    // the depth-fade edge: where the water is a few centimetres deep it lets the shore through, so no edge cuts
    o_col = vec4(col, face == 2u ? mix(0.55, 1.0, smoothstep(0.03, 0.7, thick)) : (kind == 6u ? 0.8 : 1.0));
    return;
  }
  if (kind == 7u) {
    // ---------------- aether: flowing liquid energy ----------------
    vec3 wp = v_localPos + vec3(u_camInt);
    vec2 fp = (face == 2u || face == 3u) ? wp.xz : vec2(wp.x + wp.z, wp.y);
    float n1 = texture(u_noise, fp / 22.0 + vec2(u_time * 0.035, u_time * 0.02)).r;
    float n2 = texture(u_noise, fp / 7.0 - vec2(u_time * 0.09, -u_time * 0.05)).g;
    float veins = pow(1.0 - abs(n1 * 2.0 - 1.0), 6.0) * 1.6 + pow(1.0 - abs(n2 * 2.0 - 1.0), 10.0);
    vec3 nrm = face == 2u || face == 3u ? waveNormal(wp.xz * 0.7) : NORMALS[face];
    vec2 off = nrm.xz * 0.02;
    vec3 refr = texture(u_sceneColor, clamp(suv + off, 0.001, 0.999)).rgb;
    float sceneD = texture(u_sceneDepth, suv).r;
    float thick = max(0.0, linDepth(sceneD) - linDepth(gl_FragCoord.z));
    vec3 base = vec3(0.12, 0.75, 1.0);
    vec3 glow = base * (1.6 + veins * 3.2) + vec3(0.7, 0.95, 1.0) * veins * veins * 1.5;
    vec3 col = mix(refr * vec3(0.4, 0.9, 1.1), glow, clamp(0.55 + thick * 0.25, 0.0, 0.93));
    vec3 R = reflect(-V, nrm); R.y = abs(R.y);
    float fres = 0.02 + 0.98 * pow(1.0 - max(dot(nrm, V), 0.0), 5.0);
    col = mix(col, skyColor(R, false) * 0.8 + glow * 0.3, fres * 0.35);
    // cyan-white foam where the aether meets its banks (the water's shore foam, TRAILER §2.2)
    float foamA = (1.0 - smoothstep(0.0, 0.5, thick)) * (0.55 + 0.45 * sin(wp.x * 3.1 + wp.z * 2.3 + u_time * 2.4));
    col = mix(col, vec3(0.8, 1.0, 1.0) * (1.2 + veins * 0.6), clamp(foamA, 0.0, 1.0) * 0.7 * float(face == 2u));
    col = applyFog(col, v_rel, dist);
    o_col = vec4(col, 1.0);
    return;
  }
  // ---------------- glass / ice / slime / honey ----------------
  // gradients of the continuous uv: fract() jumps at every block edge and would pick the 1×1 mip there (a seam line)
  // connected-frame glass (flag bit 14) is one tile per face: clamp inside it, so an edge pixel never wraps onto the frame of the opposite edge
  if (((v_w5 >> 14u) & 1u) == 1u) fu = ctmUV(v_uv, v_w5);
  vec2 gdx = dFdx(v_uv), gdy = dFdy(v_uv);
  // Klassisch: crisp texels up close, as on the opaque blocks (each glass block's frame drawn sharp)
  if (u_blockVar > 0.5) {
    vec2 tx = fu * 32.0, seam = floor(tx + 0.5), tw = max((abs(gdx) + abs(gdy)) * 32.0, vec2(1e-3));
    fu = (seam + clamp((tx - seam) / tw, -0.5, 0.5)) / 32.0;
  }
  vec4 alb = textureGrad(u_albedo, vec3(fu, layer), gdx, gdy);
  if (lookOn(v_w5)) alb.rgb = lookRecolor(alb.rgb, layer, v_tint); else alb.rgb *= v_tint;
  vec3 n = NORMALS[face];
#ifdef MODEL
  n = u_normalMat * n;
#endif
  float faceShade = face == 2u ? 1.0 : face == 3u ? 0.55 : (face <= 1u ? 0.78 : 0.88);
  float ndl = max(dot(n, L), 0.0);
  vec3 lighting = u_ambSky * skyL * mix(0.62, 1.0, faceShade) + lc * ndl * smoothstep(0.55, 0.95, v_sky) * (ndl > 0.0 ? shadowAt(NORMALS[face], L) : 1.0) + blockL + 0.012;
  vec3 col = alb.rgb * lighting;
#ifdef PBR
  // t-material · glass (plan step 4): smooth, so the sky and the sun mirror in it sharply by Fresnel (the block lights' colour
  // where the sky does not reach); each pane a hair off true, so the reflections break from pane to pane; a window pane (the
  // table's flag) filters what lies behind it by its tint where the scene copy holds the world (High: u_glassRefr) and glows
  // warm from inside at night, room by room — some rooms dark, a white pane (a railing) never
  vec4 pbg = texelFetch(u_pbr, ivec2(int(layer), 0), 0);
  uint gfl = uint(pbg.a * 255.0 + 0.5);
  vec3 wpg = v_localPos + vec3(u_camInt), cellG = floor(wpg - n * 0.02);
  vec3 gn = normalize(n + (vec3(hash13(cellG), hash13(cellG + 3.1), hash13(cellG + 7.7)) - 0.5) * 0.035);
  float nvG = clamp(dot(gn, V), 1e-3, 1.0), FG = 0.04 + 0.96 * pow(1.0 - nvG, 5.0), soG = smoothstep(0.3, 0.95, v_sky);
  vec3 envG = skyColor(reflect(-V, gn), false) * soG + blockL * (0.5 - 0.3 * soG);
  vec3 sunG = ndl > 0.0 ? lc * pow(max(dot(gn, normalize(L + V)), 0.0), 600.0) * 8.0 * smoothstep(0.55, 0.95, v_sky) * shadowAt(NORMALS[face], L) : vec3(0.0);
  float ta = alb.a, paneK = 1.0 - ta;
  vec3 tintG = mix(vec3(1.0), alb.rgb / max(max(alb.r, max(alb.g, alb.b)), 1e-3), 0.75);
  float glowK = 0.0; vec3 glowC = vec3(0.0);
  if ((gfl & 1u) != 0u && u_night > 0.01) {
    vec3 room = floor(wpg / vec3(3.0, 2.0, 3.0));
    float tinted = (gfl & 4u) != 0u ? smoothstep(0.06, 0.2, 1.0 - min(tintG.r, min(tintG.g, tintG.b))) : 1.0;
    glowK = step(hash13(room + 17.0), 0.7) * (0.55 + 0.75 * hash13(room + 5.0)) * tinted * u_night;
    glowC = mix(vec3(1.0, 0.70, 0.40), vec3(1.0, 0.86, 0.64), hash13(room + 9.0)) * mix(vec3(1.0), tintG, 0.3) * 1.4;
  }
  float aG; vec3 cG;
  if (u_glassRefr > 0.5 && (gfl & 1u) != 0u && paneK > 0.5) {
    vec3 behind = texture(u_sceneColor, clamp(suv + (gn.xz - n.xz) * 0.5, 0.001, 0.999)).rgb;
    vec3 pane = mix(behind * tintG, glowC, glowK * 0.85) * (1.0 - FG) + envG * FG + sunG;
    cG = mix(col + envG * FG + sunG, pane, paneK); aG = 1.0;
  } else {
    aG = clamp(ta + paneK * (FG + glowK * 0.8), 0.0, 1.0);
    cG = (col * ta + envG * FG * (1.0 - 0.5 * ta) + sunG + glowC * glowK * paneK * (1.0 - FG)) / max(aG, 0.06);
  }
  o_col = vec4(applyFog(cG, v_rel, dist), aG);
#else
  vec3 H = normalize(L + V);
  col += lc * pow(max(dot(n, H), 0.0), 120.0) * 1.5 * smoothstep(0.55, 0.95, v_sky);
  float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
  col += skyColor(reflect(-V, n), false) * fres * 0.35 * skyL;
  // F2: the rim: a glass edge seen at a grazing angle catches the sky (the fresnel's edge, cheap)
  col += matEnv(reflect(-V, n)) * pow(1.0 - max(dot(n, V), 0.0), 3.0) * 0.3 * skyL;
  col = applyFog(col, v_rel, dist);
  o_col = vec4(col, clamp(alb.a + fres * 0.3, 0.0, 1.0));
#endif
}`;

  // ------------------------------------------------------------ shadow depth
  S.SHADOW_VS = `
#ifdef MULTIDRAW
#extension GL_ANGLE_multi_draw : require
#endif
layout(location=0) in vec3 a_pos;
layout(location=1) in uint a_w3;
layout(location=2) in uint a_uvp;
layout(location=3) in uint a_w5;
uniform mat4 u_viewProj;
#ifdef MULTIDRAW
layout(std140) uniform Origins { vec4 u_origins[512]; };
#else
uniform vec3 u_origin;
#endif
#ifdef FADE
#ifndef MULTIDRAW
uniform float u_fade;
#endif
#endif
out vec2 v_uv;
flat out uint v_w3;
flat out uint v_w5;
#ifdef FADE
flat out float v_fade;
#endif
void main() {
#ifdef FADE
#ifdef MULTIDRAW
  v_fade = u_origins[gl_DrawID].w;
#else
  v_fade = u_fade;
#endif
#endif
#ifdef MULTIDRAW
  vec3 org = u_origins[gl_DrawID].xyz;
#else
  vec3 org = u_origin;
#endif
  vec3 rel = org + a_pos / 2048.0 - 4.0;
  v_uv = vec2(float(a_uvp & 255u), float(a_uvp >> 8u)) / 16.0; v_w3 = a_w3; v_w5 = a_w5;
  gl_Position = u_viewProj * vec4(rel, 1.0);
}`;
  S.SHADOW_FS = `
uniform sampler2DArray u_albedo;
in vec2 v_uv;
flat in uint v_w3;
flat in uint v_w5;
out vec4 o;
// connected glass (w5 bit 14): one 32-texel tile per face, clamped inside it (an edge texel never wraps onto the frame
// of the opposite edge); bits 5, 6, 7, 15 say the face's top, right, bottom, left edge joins the same glass — the
// frame there (at most 2 texels wide) is mirrored away, so a wall of glass shows one frame around its outside only
vec2 ctmUV(vec2 uv, uint w5) {
  vec2 f = clamp(uv, vec2(0.5 / 32.0), vec2(1.0 - 0.5 / 32.0));
  uint m = ((w5 >> 5u) & 7u) | ((w5 >> 12u) & 8u);
  const float W = 2.0 / 32.0;
  if ((m & 1u) != 0u && f.y < W) f.y = 2.0 * W - f.y;
  if ((m & 4u) != 0u && f.y > 1.0 - W) f.y = 2.0 * (1.0 - W) - f.y;
  if ((m & 8u) != 0u && f.x < W) f.x = 2.0 * W - f.x;
  if ((m & 2u) != 0u && f.x > 1.0 - W) f.x = 2.0 * (1.0 - W) - f.x;
  return f;
}
void main() {
#ifdef CUTOUT
  vec2 fu = ((v_w5 >> 14u) & 1u) == 1u ? ctmUV(v_uv, v_w5) : fract(v_uv);
  if (textureGrad(u_albedo, vec3(fu, float(v_w3 & 4095u)), dFdx(v_uv), dFdy(v_uv)).a < 0.5) discard;
#endif
  o = vec4(1.0);
}`;

  // ------------------------------------------------------------ fullscreen
  S.FS_VS = `
out vec2 v_uv;
void main() { vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); v_uv = p; gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;

  S.SKY_FS = `
uniform mat4 u_invViewProj;
uniform float u_skyProbe;    // test hook (test/horizon.mjs): 1 paints the sky magenta, so a hole below the horizon shows
uniform vec3 u_skyOff;     // the mirror camera's offset in the planar reflection (renderer.js), zero otherwise
${'__COMMON__'}
in vec2 v_uv;
out vec4 o;
void main() {
  vec4 p = u_invViewProj * vec4(v_uv * 2.0 - 1.0, 1.0, 1.0);
  vec3 dir = normalize(p.xyz / p.w - u_skyOff);
  vec3 col = skyColor(dir, true);
  if (u_fog.w > 0.5) col = u_fogColor;
  if (u_skyProbe > 0.5) col = vec3(1.0, 0.0, 1.0);
  o = vec4(col, 1.0);
}`;

  // ------------------------------------------------------------ clouds (instanced boxes)
  S.CLOUD_VS = `
layout(location=0) in vec3 a_corner;   // unit cube corner
layout(location=1) in vec3 a_normal;
layout(location=2) in vec4 a_inst;     // x,z cell, run length, thickness scale
uniform mat4 u_viewProj;
uniform vec3 u_cloudOrigin;             // relative to camera
uniform vec3 u_cell;                    // cell size xyz
uniform vec4 u_cloudHigh;               // t-sky2 (as the puffs', clouds.js HIGH): x from, y 1/(to − from) of a run's elevation sine, z how far a high run fades
out vec3 v_rel;
out vec3 v_n;
out float v_h;
out float v_fade;
void main() {
  float yo = floor(a_inst.w / 8.0), th = a_inst.w - yo * 8.0;
  vec3 p = vec3(a_inst.x, yo, a_inst.y) * u_cell + a_corner * u_cell * vec3(a_inst.z, th, 1.0);
  vec3 rel = u_cloudOrigin + p;
  v_rel = rel; v_n = a_normal;
  v_h = a_corner.y;
  // t-sky2: by day in clear weather the runs high in the view fade out (the trailer's sky overhead is the nebula, the
  // cumulus sit low and far); a run faded to nothing is not drawn at all (its corners collapse outside the view)
  vec3 c = u_cloudOrigin + vec3(a_inst.x + a_inst.z * 0.5, yo, a_inst.y + 0.5) * u_cell;
  float hi = clamp((c.y / max(length(c), 1.0) - u_cloudHigh.x) * u_cloudHigh.y, 0.0, 1.0);
  v_fade = 1.0 - u_cloudHigh.z * hi * hi * (3.0 - 2.0 * hi);
  gl_Position = v_fade < 0.01 ? vec4(0.0, 0.0, 2.0, 1.0) : u_viewProj * vec4(rel, 1.0);
}`;
  S.CLOUD_FS = `
${'__COMMON__'}
uniform float u_cloudAlpha;
uniform float u_cloudR;
in vec3 v_rel;
in vec3 v_n;
in float v_h;
in float v_fade;
out vec4 o;
void main() {
  float sunUp = smoothstep(-0.15, 0.15, u_sunDir.y);
  vec3 L = sunUp > 0.001 ? u_sunDir : u_moonDir;
  vec3 lc = sunUp > 0.001 ? u_sunColor * sunUp : u_moonColor;
  float ndl = max(dot(v_n, L), 0.0);
  vec3 base = mix(vec3(0.97, 0.98, 1.0), vec3(0.42, 0.44, 0.48), u_rain);
  float shade = v_n.y > 0.5 ? 1.0 : v_n.y < -0.5 ? 0.58 : mix(0.66, 0.9, v_h);
  vec3 col = base * (u_ambSky * 1.05 * shade + lc * ndl * 0.6) + u_sunset * 0.35 * shade;
  // silver lining toward the sun
  float dist = length(v_rel);
  vec3 V = v_rel / dist;
  col += lc * pow(max(dot(V, L), 0.0), 8.0) * 0.35 * (1.0 - v_h * 0.5);
  float fade = 1.0 - smoothstep(u_cloudR * 0.55, u_cloudR * 0.97, length(v_rel.xz));
  col = mix(col, skyColor(V, false), clamp(dist / (u_cloudR * 1.7), 0.0, 1.0) * 0.55);
  o = vec4(col, u_cloudAlpha * fade * v_fade);
}`;

  // ------------------------------------------------------------ puffs (t-clouds): cumulus, fog banks, anchors as billboards
  // a sprite is a camera-facing quad with the cloud texture (clouds.js atlas): R = density, G/B = the outward normal, so the
  // sunward rim is lit and the base stays darker. Drawn far to near, depth tested but not written.
  S.PUFF_VS = `
layout(location=0) in vec2 a_corner;   // -1..1: the quad
layout(location=1) in vec4 a_c;        // centre x, y, z (relative to the origin uniform), radius
layout(location=2) in vec4 a_p;        // alpha, squash (vertical), atlas variant, -
uniform mat4 u_viewProj;
uniform vec3 u_origin;                 // −camera (and −wind for the drifting cumulus)
uniform vec3 u_camRight;
uniform vec3 u_camUp;
uniform vec4 u_cloudHigh;              // t-sky2: x from, y 1/(to − from) (the centre's elevation sine), z how far a high puff fades (clouds.js HIGH)
out vec2 v_uv;
out float v_alpha;
out float v_var;
out float v_dist;
out float v_near;
#ifdef WXDRAMA
out vec3 v_dir;    // t-motion: the sprite's heading from the eye (the bolt's flash lights the clouds round its heading most)
#endif
void main() {
  vec3 rel = u_origin + a_c.xyz;
#ifdef WXDRAMA
  v_dir = rel / max(length(rel), 1.0);
#endif
  vec3 p = rel + (u_camRight * a_corner.x + u_camUp * a_corner.y * a_p.y) * a_c.w;
  float hi = clamp((rel.y / max(length(rel), 1.0) - u_cloudHigh.x) * u_cloudHigh.y, 0.0, 1.0);
  v_uv = a_corner * 0.5 + 0.5; v_alpha = a_p.x * (1.0 - u_cloudHigh.z * hi * hi * (3.0 - 2.0 * hi)); v_var = a_p.z; v_dist = length(rel.xz);
  // a sprite the camera is inside (the citadel's anchors) or almost touches fades out: no white wall in front of the lens
  v_near = smoothstep(2.0, 24.0, length(rel) - a_c.w);
  gl_Position = u_viewProj * vec4(p, 1.0);
}`;
  S.PUFF_FS = `
${'__COMMON__'}
uniform sampler2D u_cloudTex;
uniform vec2 u_sunScreen;   // the sun's direction in the camera's plane (unit length; 0 at night)
uniform float u_sunK;       // 0..1 while the sun is up
uniform float u_fogK;       // 1 for the fog banks (greyer, hazier), 0 for the cumulus
uniform float u_cloudR;     // the window's radius: the sprites fade out toward it
in vec2 v_uv;
in float v_alpha;
in float v_var;
in float v_dist;
in float v_near;
#ifdef WXDRAMA
in vec3 v_dir;
#endif
out vec4 o;
void main() {
  // the sample stays inside its own quarter of the atlas (half a texel in from the edge): no seam from the neighbour
  vec2 at = vec2(mod(v_var, 2.0), floor(v_var * 0.5)) * 0.5 + clamp(v_uv, vec2(0.5 / 128.0), vec2(1.0 - 0.5 / 128.0)) * 0.5;
  vec4 t = texture(u_cloudTex, at);
  if (u_fogK > 0.5) {
    // the mist: a soft silhouette (the atlas's lobes have crisp edges; five taps soften them for the fog banks)
    vec2 e = vec2(0.02, 0.02);
    t = t * 0.4 + 0.15 * (texture(u_cloudTex, at + vec2(e.x, 0.0)) + texture(u_cloudTex, at - vec2(e.x, 0.0)) +
                          texture(u_cloudTex, at + vec2(0.0, e.y)) + texture(u_cloudTex, at - vec2(0.0, e.y)));
  }
  float d = t.r;
  if (d < 0.02) discard;
  vec2 n = t.gb * 2.0 - 1.0;
  float lit = clamp(0.5 + 0.6 * dot(n, u_sunScreen) * u_sunK, 0.0, 1.0) * mix(0.72, 1.0, v_uv.y);
  vec3 ambC = u_ambSky * 1.15 + u_moonColor * 0.5 * (1.0 - u_sunK);
  // sunlit tops white (a little warm at dusk), the shade a blue-lilac grey; by night both are the moon's light
  vec3 litC = mix(ambC * 1.3, vec3(1.0, 0.95, 0.9) * 1.2, u_sunK);
  vec3 shadeC = mix(u_ambSky * 0.8 + vec3(0.02, 0.03, 0.05), vec3(0.5, 0.48, 0.62), u_sunK);
  vec3 col = mix(shadeC, litC, lit) + u_sunset * 0.18 * (1.0 - lit);
  col = mix(col, vec3(dot(col, vec3(0.3, 0.59, 0.11))), u_rain * 0.6);
  col = mix(col, u_skyHorizon * 1.1 + ambC * 0.5, u_fogK * 0.45);
#ifdef WXDRAMA
  // t-motion · Wetter-Drama: a storm's clouds (the front, or the rain) hang dark and heavy — a slate grey, their bases
  // darker, dim at night — and the bolt's flash lights them from within, most round its heading and on their bases
  // (motion.js STORM; the third browser run's storm clouds stood white against the dark sky)
  float sk = clamp(max(u_storm.z, u_rain), 0.0, 1.0) * (1.0 - u_fogK);
  col = mix(col, vec3(0.16, 0.18, 0.22) * (0.55 + 0.6 * lit) * (0.15 + 0.85 * u_sunK) + u_ambSky * 0.12, sk * 0.82);
  if (u_bolt.w > 0.001 && u_fogK < 0.5) {   // (the cumulus only: the final browser run's flash lit a fog sprite's hard-edged quad)
    vec2 bh = normalize(v_dir.xz + vec2(1e-5, 0.0));
    col += vec3(0.7, 0.72, 0.95) * u_bolt.w * (0.35 + 0.65 * smoothstep(0.2, 0.97, dot(bh, u_bolt.xy))) * (0.6 + 0.8 * (1.0 - v_uv.y));
  }
#endif
  float fade = 1.0 - smoothstep(u_cloudR * 0.5, u_cloudR * 0.98, v_dist);
  col = mix(col, u_skyHorizon, smoothstep(260.0, 600.0, v_dist) * 0.5);
  float solid = mix(smoothstep(0.1, 0.55, d), d, u_fogK);   // cumulus: the edge is soft, the body solid; fog banks: soft mist
  o = vec4(col, solid * v_alpha * fade * v_near);
}`;

  // ------------------------------------------------------------ far-terrain horizon (LOD tiles)
  S.LOD_VS = `
layout(location=0) in vec3 a_pos;
layout(location=1) in uvec2 a_info;
layout(location=2) in vec4 a_col;
uniform mat4 u_viewProj;
uniform vec3 u_tileOrigin;
out vec3 v_rel;
out vec3 v_col;
out float v_shade;
flat out uint v_face;
flat out uint v_kind;
flat out uint v_aux;
void main() {
  vec3 rel = u_tileOrigin + a_pos / 8.0;
  v_rel = rel;
  v_col = pow(a_col.rgb, vec3(2.2));
  v_shade = a_col.a;
  v_face = a_info.x & 7u; v_kind = (a_info.x >> 3u) & 7u; v_aux = a_info.y;
  gl_Position = u_viewProj * vec4(rel, 1.0);
}`;
  S.LOD_FS = `
uniform sampler2D u_mask;
#if defined(FAR1) || defined(FORM)
uniform sampler2D u_mask1;    // F-Far: the forms' fades per column (ring 1), the same 136 x 136 columns as u_mask
uniform float u_g1;           // FAR1: 1 = the horizon tiles step aside for ring 1 too (0 in the water's mirror: no ring 1 there)
#endif
uniform sampler2D u_noise;
uniform vec3 u_camFrac;
uniform ivec3 u_camInt;
uniform float u_emissiveBoost;
uniform float u_lodNear;
uniform float u_blockVar;     // Klassisch: per-block shades and the block grid instead of the macro mottling
${'__COMMON__'}
in vec3 v_rel;
in vec3 v_col;
in float v_shade;
flat in uint v_face;
flat in uint v_kind;
flat in uint v_aux;
out vec4 o;
const vec3 NORMALS[6] = vec3[6](vec3(1,0,0), vec3(-1,0,0), vec3(0,1,0), vec3(0,-1,0), vec3(0,0,1), vec3(0,0,-1));
vec3 waveN(vec2 p) {
  float t = u_time;
  vec2 a = p * 0.9 + vec2(t * 0.35, t * 0.22);
  vec2 b = p * 2.3 + vec2(-t * 0.5, t * 0.41);
  float e = 0.08;
  float h0 = texture(u_noise, a / 16.0).b * 0.6 + texture(u_noise, b / 16.0).b * 0.4;
  float hx = texture(u_noise, (a + vec2(e, 0.0)) / 16.0).b * 0.6 + texture(u_noise, (b + vec2(e, 0.0)) / 16.0).b * 0.4;
  float hz = texture(u_noise, (a + vec2(0.0, e)) / 16.0).b * 0.6 + texture(u_noise, (b + vec2(0.0, e)) / 16.0).b * 0.4;
  return normalize(vec3((h0 - hx) * 1.6, 1.0, (h0 - hz) * 1.6));
}
void main() {
  // real chunks are drawn here: the far terrain steps aside
  vec2 cl = v_rel.xz + u_camFrac.xz + vec2(u_camInt.xz & 15);
#if defined(FAR1) || defined(FORM)
  // F-Far · three rings: per column R = the chunk's fade (ring 0), G = the form's (ring 1). Ring 1 draws where
  // min(bilinear R, nearest R) <= t < G, ring 2 where t >= max(cover R, cover G) (t = the 4x4 dither threshold): every t
  // is drawn by one ring at least, a settled column by exactly one (VR.Far.draws, test/far_rings.js)
  int mn = textureSize(u_mask, 0).x, mh = mn / 2;
  ivec2 ch = ivec2(floor(cl / 16.0)) + mh;
  float nR = 0.0, bR = 0.0, nG = 0.0, bG = 0.0;
  if (ch.x >= 0 && ch.y >= 0 && ch.x < mn && ch.y < mn) {
    vec2 muv = (cl / 16.0 + float(mh)) / float(mn);
    nR = texelFetch(u_mask, ch, 0).r; bR = textureLod(u_mask, muv, 0.0).r;
    nG = texelFetch(u_mask1, ch, 0).r; bG = textureLod(u_mask1, muv, 0.0).r;
  }
  float th = bayer4(gl_FragCoord.xy), cR = min(bR, nR);
#ifdef FORM
  if (th < cR || th >= nG) discard;
  // t-polish2 · a night light (a glowing box with aux bit 7: the citadel's beam, CitadelGen.lodBoxes): drawn at night only,
  // dithered by its strength (aux bits 0–6, fainter up the beam) and the night's weight
  if (v_kind == 4u && v_aux >= 128u && th >= float(v_aux & 127u) / 127.0 * (1.0 - smoothstep(-0.06, 0.1, u_sunDir.y))) discard;
#else
  if (th < max(cR, min(bG, nG) * u_g1)) discard;
  if (dot(v_rel, v_rel) < u_lodNear * u_lodNear) discard;
#endif
#else
  ivec2 ch = ivec2(floor(cl / 16.0)) + 32;
  // the mask carries each chunk column's fade (0..1, 300 ms in): the tile is cut where the chunk keeps the pixel, and the
  // soft edge (bilinear) makes the cut fade over a chunk; min() with the nearest fade keeps the cut under the chunk's own
  // threshold, so a pixel is always drawn by one of the two (no holes)
  float cover = 0.0;
  if (ch.x >= 0 && ch.y >= 0 && ch.x < 64 && ch.y < 64) cover = min(texelFetch(u_mask, ch, 0).r, textureLod(u_mask, (cl / 16.0 + 32.0) / 64.0, 0.0).r);
  if (cover > 0.0 && bayer4(gl_FragCoord.xy) < cover) discard;
  // never right in front of the eyes: coarse cells only stand in at a distance
  if (dot(v_rel, v_rel) < u_lodNear * u_lodNear) discard;
#endif
  vec2 wp = v_rel.xz + u_camFrac.xz + vec2(u_camInt.xz);
#ifdef FORM
  // ring 1's height field (face 6) takes its normal from the geometry: a slope toward the sun is lit, one away shaded
  vec3 N = v_face == 6u ? normalize(cross(dFdx(v_rel), dFdy(v_rel))) : NORMALS[min(v_face, 5u)];
  if (v_face == 6u && N.y < 0.0) N = -N;
#else
  vec3 N = NORMALS[v_face];
#endif
  float dist = length(v_rel);
  vec3 V = -v_rel / max(dist, 1e-3);
  float sunUp = smoothstep(-0.12, 0.12, u_sunDir.y);
  vec3 L = sunUp > 0.001 ? u_sunDir : u_moonDir;
  vec3 lc = sunUp > 0.001 ? u_sunColor * sunUp : u_moonColor;
  vec3 col;
  if (v_kind == 1u) {
    float depth = float(v_aux & 63u);
    uint ti = v_aux >> 6u;
    vec3 n = v_face == 2u ? waveN(wp) : N;
    float depthK = clamp(depth / 14.0, 0.0, 1.0);
    float pN = texture(u_noise, wp / 38.0 + vec2(u_time * 0.004, -u_time * 0.003)).r;
    float bandN = texture(u_noise, wp / 11.0 + vec2(-u_time * 0.012, u_time * 0.009)).g;
    float brightK = smoothstep(0.4, 0.7, pN * 0.72 + bandN * 0.28);
    vec3 navy = vec3(0.010, 0.040, 0.140), ocean = vec3(0.060, 0.300, 0.660), sea = vec3(0.030, 0.200, 0.190);
    vec3 body = mix(ocean, navy, clamp(0.42 + depthK * 0.4 - brightK * 0.62, 0.0, 1.0));
    body = mix(body, sea, 0.12 + bandN * 0.08);
    if (ti == 1u) body = mix(body, vec3(0.05, 0.45, 0.55), 0.45); else if (ti == 2u) body = mix(body, vec3(0.03, 0.08, 0.32), 0.4); else if (ti == 3u) body = mix(body, vec3(0.08, 0.12, 0.06), 0.55);
    float ripple = clamp(0.5 + dot(n.xz, normalize(L.xz + vec2(1e-4))) * 2.6, 0.0, 1.0);
    body *= 0.84 + ripple * 0.32;
    vec3 deep = body * (u_ambSky * 0.74 + lc * 0.095) + body * 0.012;
    float absorb = 1.0 - exp(-depth * 0.5);
    vec3 floorC = v_col * (u_ambSky * 0.9 + lc * 0.35) * vec3(0.3, 0.62, 0.9);
    vec3 under = mix(floorC, deep, clamp(absorb, 0.0, 0.96));
    vec3 R = reflect(-V, n); R.y = abs(R.y);
    vec3 refl = skyColor(R, false);
    refl = mix(refl, refl * vec3(0.62, 0.84, 1.0) + body * 0.25, 0.4);
    float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
    fres = min(fres * 0.85, 0.66);
    col = v_face == 2u ? mix(under, refl, fres) : deep;
    vec3 H = normalize(L + V);
    if (v_face == 2u) col += lc * (pow(max(dot(n, H), 0.0), 700.0) * 30.0 + pow(max(dot(n, H), 0.0), 60.0) * 0.4) * (1.0 - u_rain);
  } else {
    vec3 alb = v_col;
    vec3 wp3 = vec3(wp.x, v_rel.y + u_camFrac.y + float(u_camInt.y), wp.y) - N * 0.02;
    vec3 bp = floor(wp3);
    if (u_blockVar > 0.5) {
      // Klassisch v2: no mottling — every block its own shade, and the block grid as far as a pixel can still show
      // it (a line a texel wide, softened over one pixel); where a block shrinks under ~4 pixels the lines fade out
      // into the per-block shades, and the inside is lifted by what the lines take, so the far land keeps the
      // brightness of the near blocks (whose mips keep their mean too)
      alb *= 0.92 + hash13(bp) * 0.16;
      vec3 fr = wp3 - bp;
#ifdef FORM
      vec2 g = v_face <= 1u ? fr.zy : (v_face <= 3u || v_face == 6u) ? fr.xz : fr.xy;
#else
      vec2 g = v_face <= 1u ? fr.zy : v_face <= 3u ? fr.xz : fr.xy;
#endif
      vec2 e = min(g, 1.0 - g);
      float px = max(length(fwidth(wp3)), 1e-3);
      float k = u_gridK * (1.0 - smoothstep(0.12, 0.3, px));
      float cover = min(1.0, 4.0 * (0.03 + 0.5 * px));
      alb *= (1.0 - k * (1.0 - smoothstep(0.03, 0.03 + px, min(e.x, e.y)))) / (1.0 - k * cover);
    } else {
      float m = texture(u_noise, wp / 96.0).r * 0.7 + texture(u_noise, wp / 23.0).g * 0.3;
      alb *= 0.9 + m * 0.2;
      // per-block speckle so the big cells read as many small blocks
      alb *= 0.93 + hash13(bp) * 0.14;
    }
    float faceShade = v_face == 2u ? 1.0 : v_face == 3u ? 0.55 : (v_face <= 1u ? 0.78 : 0.88);
#ifdef FORM
    if (v_face == 6u) faceShade = mix(0.8, 1.0, clamp(N.y, 0.0, 1.0));
#endif
    float ndl = max(dot(N, L), 0.0);
    vec3 amb = u_ambSky * mix(0.62, 1.0, faceShade);
#ifdef LIGHT2
    amb = l2Hemi(N) * (v_face <= 1u ? u_l2K.y : 1.0);   // t-light2: the near terrain's hemisphere
#endif
    col = alb * (amb + lc * ndl * 0.92) * (0.3 + 0.7 * v_shade) + alb * 0.012;
    if (v_kind == 2u) col = alb * (1.5 + vnoise(wp * 0.3 + u_time * 0.2) * 1.2) * vec3(1.0, 0.8, 0.6);
    else if (v_kind == 3u) col = vec3(0.12, 0.75, 1.0) * (1.4 + vnoise(wp * 0.2 + u_time * 0.1) * 1.6);
    else if (v_kind == 4u) col = alb * (1.3 + u_emissiveBoost) * (0.85 + 0.15 * sin(u_time * 1.3 + wp.x * 0.1 + wp.y * 0.07));
    else if (v_kind == 6u) { vec3 H = normalize(L + V); col += lc * pow(max(dot(N, H), 0.0), 40.0) * 0.18; }
    else if (v_kind == 7u) {
      // windows: glass by day, warm lamplight from inside at dusk and night (most homes are lit)
      float night = 1.0 - smoothstep(-0.06, 0.16, u_sunDir.y);
      float lit = step(0.28, hash13(bp * 1.37 + 5.1));
      vec3 H = normalize(L + V);
      col += lc * pow(max(dot(N, H), 0.0), 60.0) * 0.35 * sunUp;
      col = mix(col, vec3(1.0, 0.66, 0.32) * (1.1 + u_emissiveBoost * 0.6) * (0.8 + 0.4 * hash13(bp + 2.3)), night * lit);
    }
  }
#ifdef LIGHT2
  // t-polish2 · the far lights at night (gap 2): the glowing kinds and the lit windows shine ×(1 + NIGHT·night) — over the
  // bloom's night threshold, so they glow — and pierce the haze: a light keeps exp(−d / PIERCE) of itself through the
  // fog instead of fading into its colour (Low and up; Very Low's program is as before)
  float lk = 0.0;
  if (v_kind == 4u) lk = 1.0;
  else if (v_kind == 7u) lk = step(0.28, hash13(floor(vec3(wp.x, v_rel.y + u_camFrac.y + float(u_camInt.y), wp.y) - N * 0.02) * 1.37 + 5.1));
  lk *= 1.0 - smoothstep(-0.06, 0.16, u_sunDir.y);
  col *= 1.0 + ${(VR.Light2 && VR.Light2.FARLIT ? VR.Light2.FARLIT.night : 1.6).toFixed(2)} * lk;
  vec3 lit0 = col;
  col = applyFog(col, v_rel, dist);
  col = mix(col, lit0, lk * exp(-dist / ${(VR.Light2 && VR.Light2.FARLIT ? VR.Light2.FARLIT.pierce : 1600).toFixed(1)}));
#else
  col = applyFog(col, v_rel, dist);
#endif
  o = vec4(col, 1.0);
}`;

  // ------------------------------------------------------------ micro-voxel models (creatures, turrets, ships' props)
  // INST (the Baustelle's scaffold and crane mast, baustelle.js): one mesh drawn many times — per instance an offset
  // (xyz) and w = quarter turns about y + 4 × (the stretch along x × 256; 0 = none)
  S.VOX_VS = `
layout(location=0) in vec3 a_pos;
layout(location=1) in vec3 a_normal;
layout(location=2) in vec4 a_color;
#ifdef INST
layout(location=3) in vec4 a_inst;
#endif
uniform mat4 u_viewProj;
#ifdef BONES
// t-folk (folkgpu.js): a villager's smooth body in one draw — each vertex names its part (the pad byte after the normal),
// the rig's matrices come as an array
layout(location=3) in float a_bone;
uniform mat4 u_bones[16];
#else
uniform mat4 u_model;
#endif
out vec3 v_n;
out vec4 v_color;
out vec3 v_rel;
void main() {
#ifdef BONES
  mat4 u_model = u_bones[int(a_bone + 0.5)];
#endif
  vec3 p = a_pos, nn = a_normal;
#ifdef INST
  float sx = floor(a_inst.w / 4.0 + 0.001) / 256.0;
  if (sx > 0.0) p.x *= sx;
  int r = int(mod(a_inst.w, 4.0) + 0.5);
  if (r == 1) { p = vec3(p.z, p.y, -p.x); nn = vec3(nn.z, nn.y, -nn.x); }
  else if (r == 2) { p = vec3(-p.x, p.y, -p.z); nn = vec3(-nn.x, nn.y, -nn.z); }
  else if (r == 3) { p = vec3(-p.z, p.y, p.x); nn = vec3(-nn.z, nn.y, nn.x); }
  p += a_inst.xyz;
#endif
  vec4 wp = u_model * vec4(p, 1.0);
  v_rel = wp.xyz;
  v_n = normalize(mat3(u_model) * nn);
  v_color = vec4(pow(a_color.rgb, vec3(2.2)), a_color.a);
  gl_Position = u_viewProj * wp;
}`;
  S.VOX_FS = `
uniform float u_sky;
uniform vec3 u_blockLight;
uniform float u_flash;
uniform vec3 u_tint;
uniform float u_alpha;
uniform float u_noFog;
uniform float u_clipNear;   // first-person pilot: hide the hull right around the head
uniform float u_sunShadow;  // 0 = in the sun, 1 = shaded by terrain (heightmap ray from the CPU)
${'__COMMON__'}
in vec3 v_n;
in vec4 v_color;
in vec3 v_rel;
out vec4 o;
void main() {
  if (u_clipNear > 0.0 && length(v_rel) < u_clipNear) discard;
  vec3 alb = v_color.rgb * u_tint;
  vec3 n = normalize(v_n);
  float sunUp = smoothstep(-0.12, 0.12, u_sunDir.y);
  vec3 L = sunUp > 0.001 ? u_sunDir : u_moonDir;
  vec3 lc = sunUp > 0.001 ? u_sunColor * sunUp : u_moonColor;
  float sk = u_sky * u_sky;
  float outdoor = smoothstep(0.5, 0.95, u_sky);
  // soft wrap lighting + sky/ground hemisphere + a gentle rim: voxel characters read as soft, not plastic
  float wrapL = max((dot(n, L) + 0.3) / 1.3, 0.0);
  vec3 hemi = mix(u_ambSky * vec3(0.62, 0.56, 0.5), u_ambSky * 1.06, n.y * 0.5 + 0.5);
  vec3 light = hemi * sk + lc * wrapL * outdoor * 0.9 * (1.0 - u_sunShadow) + pow(u_blockLight, vec3(1.7)) * 1.35 * u_blockLightTint + 0.03;
#ifdef LIGHT2
  // t-light2: the hemisphere, the skin's softer wrap, the lamps' pools
  hemi = l2Hemi(n) * 1.04; wrapL = l2Wrap(dot(n, L), u_l2K.w);
  light = hemi * sk + lc * wrapL * outdoor * 0.9 * (1.0 - u_sunShadow) + l2Pool(u_blockLight) + 0.03;
#endif
  vec3 col = alb * light;
  vec3 V = normalize(-v_rel);
  float rim = pow(1.0 - max(dot(n, V), 0.0), 3.0);
  col += (u_skyHorizon * 0.5 + lc * 0.08) * rim * 0.22 * sk * alb;
  col += lc * pow(max(dot(n, normalize(L + V)), 0.0), 28.0) * 0.05 * outdoor;
  col = mix(col, alb * 2.2, v_color.a);
  col = mix(col, vec3(1.0, 0.2, 0.15), u_flash * 0.6);
  if (u_noFog < 0.5) col = applyFog(col, v_rel, length(v_rel));
  o = vec4(col, u_alpha);
}`;

  // ------------------------------------------------------------ decal overlay (block cracks, selection glow)
  S.DECAL_VS = `
layout(location=0) in vec3 a_pos;
layout(location=1) in vec2 a_uv;
uniform mat4 u_viewProj;
uniform vec3 u_offset;
out vec2 v_uv;
void main() { v_uv = a_uv; gl_Position = u_viewProj * vec4(a_pos + u_offset, 1.0); }`;
  S.DECAL_FS = `
uniform sampler2DArray u_albedo;
uniform float u_layer;
uniform vec4 u_color;
in vec2 v_uv;
out vec4 o;
void main() {
  vec4 a = texture(u_albedo, vec3(v_uv, u_layer));
  if (a.a < 0.1) discard;
  o = vec4(a.rgb * u_color.rgb, a.a * u_color.a);
}`;

  // ------------------------------------------------------------ post processing
  S.BLOOM_PRE_FS = `
uniform sampler2D u_src;
uniform vec2 u_texel;
uniform float u_threshold;
in vec2 v_uv;
out vec4 o;
void main() {
  vec3 c = texture(u_src, v_uv + u_texel * vec2(-1,-1)).rgb + texture(u_src, v_uv + u_texel * vec2(1,-1)).rgb + texture(u_src, v_uv + u_texel * vec2(-1,1)).rgb + texture(u_src, v_uv + u_texel * vec2(1,1)).rgb;
  c *= 0.25;
  float br = max(max(c.r, c.g), c.b);
  float k = max(br - u_threshold, 0.0) / max(br, 0.0001);
  o = vec4(min(c * k, vec3(40.0)), 1.0);
}`;
  S.DOWN_FS = `
uniform sampler2D u_src;
uniform vec2 u_texel;
in vec2 v_uv;
out vec4 o;
void main() {
  vec3 c = texture(u_src, v_uv).rgb * 4.0;
  c += texture(u_src, v_uv + u_texel * vec2(-1,-1)).rgb + texture(u_src, v_uv + u_texel * vec2(1,-1)).rgb;
  c += texture(u_src, v_uv + u_texel * vec2(-1,1)).rgb + texture(u_src, v_uv + u_texel * vec2(1,1)).rgb;
  o = vec4(c / 8.0, 1.0);
}`;
  S.UP_FS = `
uniform sampler2D u_src;
uniform vec2 u_texel;
uniform float u_radius;
in vec2 v_uv;
out vec4 o;
void main() {
  vec2 t = u_texel * u_radius;
  vec3 c = texture(u_src, v_uv + vec2(-t.x, 0)).rgb + texture(u_src, v_uv + vec2(t.x, 0)).rgb + texture(u_src, v_uv + vec2(0, -t.y)).rgb + texture(u_src, v_uv + vec2(0, t.y)).rgb;
  c = c * 2.0 + texture(u_src, v_uv + vec2(-t.x, -t.y)).rgb + texture(u_src, v_uv + vec2(t.x, -t.y)).rgb + texture(u_src, v_uv + vec2(-t.x, t.y)).rgb + texture(u_src, v_uv + vec2(t.x, t.y)).rgb;
  c += texture(u_src, v_uv).rgb * 4.0;
  o = vec4(c / 16.0, 1.0);
}`;
  S.RAYS_FS = `
uniform sampler2D u_depth;
uniform sampler2D u_color;
uniform vec2 u_sunScreen;
uniform float u_raysStrength;
in vec2 v_uv;
out vec4 o;
void main() {
  vec2 d = (u_sunScreen - v_uv) / 28.0;
  vec2 p = v_uv;
  vec3 acc = vec3(0.0);
  float w = 1.0;
  for (int i = 0; i < 28; i++) {
    p += d;
    if (p.x < 0.0 || p.y < 0.0 || p.x > 1.0 || p.y > 1.0) break;
#ifdef MASK
    acc += texture(u_color, p).rgb * w;   // (F10 · postLite: u_color is the ¼-res sky mask, RAYS_MASK_FS)
#else
    float sky = step(0.99999, texture(u_depth, p).r);
    acc += texture(u_color, p).rgb * sky * w;
#endif
    w *= 0.955;
  }
  o = vec4(acc / 28.0 * u_raysStrength, 1.0);
}`;
  // F10 · postLite: the god rays' source at ¼ × ¼ — per texel the sky's colour over its 4 × 4 full-res pixels (four bilinear
  // colour taps, four depth taps; 0 where the depth is not the sky). RAYS_FS with MASK then marches over this small texture
  // (it stays in the cache) instead of reading 28 colour and 28 depth texels of the full-res targets for every pixel.
  S.RAYS_MASK_FS = `
uniform sampler2D u_depth;
uniform sampler2D u_color;
uniform vec2 u_texel;       // the full-res texel
in vec2 v_uv;
out vec4 o;
void main() {
  vec3 acc = vec3(0.0);
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    vec2 p = v_uv + (vec2(float(i), float(j)) * 2.0 - 1.0) * u_texel;
    acc += texture(u_color, p).rgb * step(0.99999, texture(u_depth, p).r);
  }
  o = vec4(acc * 0.25, 1.0);
}`;
  S.COMPOSITE_FS = `
uniform sampler2D u_scene;
uniform sampler2D u_bloom;
uniform sampler2D u_rays;
uniform float u_exposure;
uniform float u_bloomStrength;
uniform float u_useRays;
uniform float u_vignette;
uniform float u_saturation;
uniform float u_contrast;   // the trailer's contrast: a soft S-curve (0 = off; env.js VR.Grade.contrast)
uniform vec3 u_grade;
uniform float u_underwaterFx;
uniform float u_time;
uniform float u_damage;
uniform float u_portal;
uniform vec2 u_screen;
uniform vec2 u_sceneTexel;
uniform float u_sharpen;
uniform float u_vivid;      // 0 = filmic (brights fade to white), 1 = hue-preserving (glows stay coloured)
uniform float u_shafts;     // F7: underwater light shafts (tier 2), 0 above the water
uniform float u_crossing;   // F7: the surface passing the eye (1 at the moment, fading): a ripple across the picture
uniform mat4 u_invVP;       // F7: pixel → view ray, so the shafts stay fixed in the world
uniform vec3 u_shaftCol;
${(VR.Light2 && VR.Light2.glslComposite) ? VR.Light2.glslComposite() : ''}
in vec2 v_uv;
out vec4 o;
// HDR → 0..1 for the sharpening weights (keeps bright lights from ringing)
vec3 casIn(vec2 uv) { vec3 c = texture(u_scene, uv).rgb; return c / (1.0 + c); }
vec3 aces(vec3 x) { const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14; return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0); }
float acesL(float x) { const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14; return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0); }
// the trailer look: filmic per-channel curve blended with a hue-preserving one, so sunsets stay orange,
// crystals stay cyan and lava stays red instead of washing out to white
vec3 tonemap(vec3 x) {
  vec3 f = aces(x);
  if (u_vivid <= 0.0) return f;
  float l = dot(x, vec3(0.2126, 0.7152, 0.0722));
  vec3 h = x * (acesL(l) / max(l, 1e-5));
  float m = max(h.r, max(h.g, h.b));
  if (m > 1.0) h = mix(h / m, vec3(1.0), clamp((m - 1.0) * 0.35, 0.0, 1.0)); // very bright: fade toward white gently
  return mix(f, clamp(h, 0.0, 1.0), u_vivid);
}
void main() {
  vec2 uv = v_uv;
  if (u_underwaterFx > 0.0) uv += vec2(sin(uv.y * 28.0 + u_time * 2.2), cos(uv.x * 22.0 + u_time * 1.7)) * 0.0022 * u_underwaterFx;
  if (u_crossing > 0.0) uv += vec2(sin(uv.y * 36.0 + u_time * 11.0), cos(uv.x * 28.0 - u_time * 9.0)) * 0.006 * u_crossing;
  if (u_portal > 0.0) { vec2 c = uv - 0.5; float a = u_portal * 1.5 * (1.0 - length(c)); uv = 0.5 + mat2(cos(a), -sin(a), sin(a), cos(a)) * c; }
  vec3 c;
  if (u_sharpen > 0.0) {
    // contrast-adaptive sharpening: restores crispness lost to upscaling (and to FXAA) without halos
    vec2 t = u_sceneTexel;
    vec3 a = casIn(uv + vec2(0.0, -t.y)), b = casIn(uv + vec2(-t.x, 0.0)), m = casIn(uv), d = casIn(uv + vec2(t.x, 0.0)), e = casIn(uv + vec2(0.0, t.y));
    vec3 mn = min(m, min(min(a, b), min(d, e))), mx = max(m, max(max(a, b), max(d, e)));
    vec3 amp = sqrt(clamp(min(mn, 1.0 - mx) / max(mx, vec3(1e-4)), 0.0, 1.0));
    vec3 w = -amp / mix(8.0, 4.6, u_sharpen);
    vec3 r = clamp((m + (a + b + d + e) * w) / (1.0 + 4.0 * w), 0.0, 0.996);
    c = r / (1.0 - r);
  } else c = texture(u_scene, uv).rgb;
  c += texture(u_bloom, uv).rgb * u_bloomStrength;
  if (u_useRays > 0.5) c += texture(u_rays, uv).rgb;
#ifdef L2VOL
  if (u_l2VolOn > 0.5) c += l2VolAt(uv);   // t-light2: the light in the air (the volumetric light, upsampled by depth)
#endif
#ifdef GRADE2
  c += l2Flare(v_uv);   // t-light2: the sun's flare
#endif
  if (u_shafts > 0.0) {
    // light shafts: columns of light from the surface, where the view ray points up toward it, drifting slowly
    vec4 wr = u_invVP * vec4(v_uv * 2.0 - 1.0, 1.0, 1.0);
    vec3 rd = normalize(wr.xyz / wr.w);
    vec2 P = rd.xz / max(0.2, -rd.y) * 4.0;
    float s1 = 0.5 + 0.5 * sin(P.x * 2.3 + 0.9 * sin(P.y * 1.7 + u_time * 0.3));
    float s2 = 0.5 + 0.5 * sin(P.y * 2.9 - u_time * 0.25 + 1.4 * sin(P.x * 1.3));
    c += u_shaftCol * pow(s1 * s2, 3.0) * smoothstep(-0.2, 0.5, rd.y) * u_shafts * 0.25;
  }
  c *= u_exposure;
  c = tonemap(c * u_grade);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, u_saturation);
  // contrast (t-look): a soft S-curve through the mid-tones — the shadows go a little deeper, the lights a little
  // higher, the ends stay where they are. Clamped first, so no negative value reaches the gamma below
  c = clamp(c, 0.0, 1.0);
  c = mix(c, c * c * (3.0 - 2.0 * c), u_contrast);
  vec2 vc = v_uv - 0.5;
  c *= 1.0 - dot(vc, vc) * u_vignette;
  if (u_damage > 0.0) c = mix(c, vec3(0.7, 0.05, 0.05), u_damage * (0.3 + 0.7 * smoothstep(0.2, 0.75, length(vc))) * 0.55);
  if (u_portal > 0.0) c = mix(c, vec3(0.9, 0.45, 0.15), u_portal * 0.35);
  c = pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2));
#ifdef GRADE2
  c = l2Grade(c, v_uv);   // t-light2: the grade by the hour (display space: the curve, the split toning, the vignette)
#endif
  // dither
  c += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  o = vec4(c, 1.0);
}`;
  // R9 Super Resolution: temporal upscaling. The scene is rendered at a lower resolution with a
  // different sub-pixel offset every frame; this pass reprojects last frame's full-resolution result
  // with the depth buffer, keeps what still agrees with the new samples (colour-box clipping) and
  // blends in the new jittered samples, so detail builds up over a few frames to (near) full sharpness.
  S.TSR_FS = `
uniform sampler2D u_cur;
uniform sampler2D u_depth;
uniform sampler2D u_hist;
uniform mat4 u_invVP;
uniform mat4 u_prevVP;
uniform vec3 u_camDelta;
uniform vec2 u_jit;
uniform vec2 u_lowTexel;
uniform vec2 u_outTexel;
uniform float u_reset;
uniform float u_camSpeed;
in vec2 v_uv;
out vec4 o;
vec3 tm(vec3 c) { return c / (1.0 + max(c.r, max(c.g, c.b))); }
vec3 itm(vec3 c) { return c / max(1.0 - max(c.r, max(c.g, c.b)), 1e-3); }
vec3 toY(vec3 c) { return vec3(dot(c, vec3(0.25, 0.5, 0.25)), dot(c, vec3(0.5, 0.0, -0.5)), dot(c, vec3(-0.25, 0.5, -0.25))); }
vec3 fromY(vec3 y) { return vec3(y.x + y.y - y.z, y.x + y.z, y.x - y.y - y.z); }
// Catmull-Rom history fetch (5 bilinear taps): keeps the accumulated image from going soft
vec3 histCR(vec2 uv) {
  vec2 size = 1.0 / u_outTexel, p = uv * size, tc = floor(p - 0.5) + 0.5, f = p - tc;
  vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f)), w1 = 1.0 + f * f * (-2.5 + 1.5 * f), w2 = f * (0.5 + f * (2.0 - 1.5 * f)), w3 = f * f * (-0.5 + 0.5 * f);
  vec2 w12 = w1 + w2, t12 = (tc + w2 / w12) * u_outTexel, t0 = (tc - 1.0) * u_outTexel, t3 = (tc + 2.0) * u_outTexel;
  vec3 r = texture(u_hist, vec2(t12.x, t0.y)).rgb * (w12.x * w0.y) + texture(u_hist, vec2(t0.x, t12.y)).rgb * (w0.x * w12.y)
         + texture(u_hist, t12).rgb * (w12.x * w12.y) + texture(u_hist, vec2(t3.x, t12.y)).rgb * (w3.x * w12.y) + texture(u_hist, vec2(t12.x, t3.y)).rgb * (w12.x * w3.y);
  float ws = w12.x * w0.y + w0.x * w12.y + w12.x * w12.y + w3.x * w12.y + w12.x * w3.y;
  return max(r / ws, 0.0);
}
void main() {
  vec2 uv = v_uv;
  vec2 cuv = uv + u_jit;                                   // where this frame's image shows the content of uv
  vec2 q = cuv / u_lowTexel - 0.5;                           // in low-res pixel units (sample centres at integers)
  vec2 i0 = floor(q + 0.5);
  // reconstruct the new frame at this pixel from the nine nearest samples, each weighted by how close
  // the point it shows is to the pixel centre (a smooth kernel, so no sample grid ever shows through)
  vec3 sum = vec3(0.0), m1 = vec3(0.0), m2 = vec3(0.0);
  float wsum = 0.0, dmin = 1.0;
  vec2 kpx = u_lowTexel / u_outTexel;                         // low-res pixel size in output pixels
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 sp = i0 + vec2(float(i), float(j));
    vec2 suv = (sp + 0.5) * u_lowTexel;
    vec3 c = toY(tm(texture(u_cur, suv).rgb));
    vec2 d = (sp - q) * kpx;                                  // sample → pixel distance, output pixels
    float w = exp(-4.0 * dot(d, d));                        // narrow: a sample only speaks for the pixel it really landed on
    sum += c * w; wsum += w;
    m1 += c; m2 += c * c;
    if (abs(i) + abs(j) <= 1) dmin = min(dmin, texture(u_depth, suv).r);
  }
  vec3 cur = sum / max(wsum, 1e-4);
  m1 /= 9.0; m2 /= 9.0;
  vec3 sig = sqrt(max(m2 - m1 * m1, 0.0));
  // where was this point last frame? (nearest depth around the pixel so edges don't smear)
  vec4 wp = u_invVP * vec4(uv * 2.0 - 1.0, dmin * 2.0 - 1.0, 1.0);
  wp.xyz /= wp.w;
  vec4 pc = u_prevVP * vec4(wp.xyz + u_camDelta, 1.0);
  vec2 puv = pc.xy / max(pc.w, 1e-5) * 0.5 + 0.5;
  bool valid = pc.w > 0.0 && puv.x > 0.0 && puv.y > 0.0 && puv.x < 1.0 && puv.y < 1.0 && u_reset < 0.5;
  vec3 res;
  if (!valid) res = toY(tm(texture(u_cur, cuv).rgb));        // nothing to build on: plain smooth upscale
  else {
    float motion = clamp(length((puv - uv) / u_outTexel) / 10.0, 0.0, 1.0);
    vec3 hist = toY(tm(histCR(puv)));
    float gam = mix(1.0, 0.7, motion);                       // tight clamp: nothing trails behind moving things
    hist = clamp(hist, m1 - sig * gam, m1 + sig * gam);
    // blend in the new frame as far as it really covers this pixel
    float conf = clamp(wsum / 0.9, 0.0, 1.0);
    float a = mix(0.12, 0.3, max(motion, u_camSpeed)) * conf + 0.02;
    res = mix(hist, cur, a);
  }
  o = vec4(itm(fromY(res)), 1.0);
}`;
  S.FXAA_FS = `
uniform sampler2D u_src;
uniform vec2 u_texel;
in vec2 v_uv;
out vec4 o;
void main() {
  vec3 rgbNW = texture(u_src, v_uv + vec2(-1.0, -1.0) * u_texel).rgb, rgbNE = texture(u_src, v_uv + vec2(1.0, -1.0) * u_texel).rgb;
  vec3 rgbSW = texture(u_src, v_uv + vec2(-1.0, 1.0) * u_texel).rgb, rgbSE = texture(u_src, v_uv + vec2(1.0, 1.0) * u_texel).rgb;
  vec3 rgbM = texture(u_src, v_uv).rgb;
  vec3 luma = vec3(0.299, 0.587, 0.114);
  float lNW = dot(rgbNW, luma), lNE = dot(rgbNE, luma), lSW = dot(rgbSW, luma), lSE = dot(rgbSE, luma), lM = dot(rgbM, luma);
  float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE))), lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
  if (lMax - lMin < max(0.05, lMax * 0.16)) { o = vec4(rgbM, 1.0); return; }
  vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), ((lNW + lSW) - (lNE + lSE)));
  float dirReduce = max((lNW + lNE + lSW + lSE) * 0.03125, 1.0 / 128.0);
  float rcp = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
  dir = clamp(dir * rcp, -8.0, 8.0) * u_texel;
  vec3 a = 0.5 * (texture(u_src, v_uv + dir * (1.0 / 3.0 - 0.5)).rgb + texture(u_src, v_uv + dir * (2.0 / 3.0 - 0.5)).rgb);
  vec3 b = a * 0.5 + 0.25 * (texture(u_src, v_uv + dir * -0.5).rgb + texture(u_src, v_uv + dir * 0.5).rgb);
  float lB = dot(b, luma);
  o = vec4((lB < lMin || lB > lMax) ? a : b, 1.0);
}`;
  S.COPY_FS = `
uniform sampler2D u_src;
in vec2 v_uv;
out vec4 o;
void main() { o = texture(u_src, v_uv); }`;

  // ------------------------------------------------------------ t-material · the screen-space mirror (High and up)
  // Half size: for a glossy pixel (the terrain's second target says how much of it is mirror) the reflected ray marches
  // through the depth buffer in 14 growing steps (a jittered start, ~70 blocks at most), a hit is refined by three halvings
  // and read from the scene's colour; the confidence fades at the screen's edge, for rough mirrors and for rays back toward
  // the eye. Out: the hit premultiplied by its confidence (a miss: 0, the sky's reflection of the gloss pass stays).
  S.SSR_FS = `
uniform highp sampler2D u_depth;
uniform sampler2D u_mat;
uniform sampler2D u_color;
uniform mat4 u_vp;
uniform mat4 u_invVP;
uniform vec2 u_nearFar;
in vec2 v_uv;
out vec4 o;
float lin(float d) { float z = d * 2.0 - 1.0; return 2.0 * u_nearFar.x * u_nearFar.y / (u_nearFar.y + u_nearFar.x - z * (u_nearFar.y - u_nearFar.x)); }
vec3 octDec(vec2 e) { vec3 n = vec3(e.x, 1.0 - abs(e.x) - abs(e.y), e.y); if (n.y < 0.0) n.xz = (1.0 - abs(n.zx)) * vec2(n.x >= 0.0 ? 1.0 : -1.0, n.z >= 0.0 ? 1.0 : -1.0); return normalize(n); }
void main() {
  o = vec4(0.0);
  vec4 m = texture(u_mat, v_uv);
  if (m.b < 0.01) return;
  float d = texture(u_depth, v_uv).r;
  if (d >= 0.99999) return;
  vec4 wp = u_invVP * vec4(v_uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  vec3 P = wp.xyz / wp.w, N = octDec(m.rg * 2.0 - 1.0), V = normalize(-P);
  // (run 2: per-pixel jitter and a rough-scattered ray left a sparse spray of hits — single bright texels on the plaza and
  // the hangar floor. Every ray is now the mirror ray, the same each frame; a crossing is refined first and only then
  // judged: a surface the ray reaches is a hit, one it passes behind (a pole, a railing) a miss. The apply pass blurs by
  // the roughness instead)
  float rough = m.a;
  vec3 R = reflect(-V, N);
  if (dot(R, N) < 0.02) return;
  vec3 Q = P + N * 0.04;
  float t = 0.12, st = 0.12, prevT = 0.0;
  vec2 huv = vec2(-1.0);
  for (int i = 0; i < 16; i++) {
    vec4 c = u_vp * vec4(Q + R * t, 1.0);
    if (c.w < 0.07) break;
    vec2 uv = c.xy / c.w * 0.5 + 0.5;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) break;
    if (c.w - lin(texture(u_depth, uv).r) > 0.0) {
      float a = prevT, b = t;
      for (int k = 0; k < 5; k++) { float mt = (a + b) * 0.5; vec4 cm = u_vp * vec4(Q + R * mt, 1.0); if (cm.w - lin(texture(u_depth, cm.xy / cm.w * 0.5 + 0.5).r) > 0.0) b = mt; else a = mt; }
      vec4 cb = u_vp * vec4(Q + R * b, 1.0); vec2 buv = cb.xy / cb.w * 0.5 + 0.5;
      // (run 5: a floor of mini-voxel tiles met its own raised marks and joints first, a hair above it at a grazing
      //  angle — a static of its own colours. A plane does not see itself: a crossing less than a tenth of a block over
      //  the surface is passed and the march goes on)
      if (b * dot(R, N) > 0.1) {
        if (cb.w - lin(texture(u_depth, buv).r) < 0.1 + b * 0.025) huv = buv;
        break;
      }
    }
    prevT = t; st *= 1.33; t += st;
  }
  if (huv.x < 0.0) return;
  vec2 e = min(huv, 1.0 - huv);
  float conf = smoothstep(0.0, 0.07, e.x) * smoothstep(0.0, 0.07, e.y) * (1.0 - smoothstep(0.55, 0.9, rough)) * (1.0 - smoothstep(0.35, 0.8, dot(R, V)));
  o = vec4(texture(u_color, huv).rgb * conf, conf);
}`;
  // the apply: full size, over the scene's colour (blended SRC_ALPHA, ONE_MINUS_SRC_ALPHA) — the hit replaces the share of
  // the pixel that is mirror (the full-size weight keeps the glossy area's edges sharp; the half-size hit is premultiplied)
  S.SSR_APPLY_FS = `
uniform sampler2D u_mat;
uniform sampler2D u_ssr;
in vec2 v_uv;
out vec4 o;
void main() {
  vec4 m = texture(u_mat, v_uv);
  if (m.b < 0.003) discard;
  // the hits, gathered over a footprint that grows with the roughness (a polished floor sharp, a honed one soft), drawn
  // out up and down the screen as a glossy floor smears what it mirrors toward the eye (run 4: the hangar's floor mirrored
  // the holo walls' fine data as a mottle; streaked, it reads as gloss); a texel's hit counts by its own weight, so a lone
  // hit spreads thin instead of standing out
  vec2 px = 1.0 / vec2(textureSize(u_ssr, 0)), r = px * (1.0 + m.a * 6.0);
  vec4 s = texture(u_ssr, v_uv) * 2.0
         + texture(u_ssr, v_uv + vec2(0.0, r.y)) + texture(u_ssr, v_uv - vec2(0.0, r.y))
         + (texture(u_ssr, v_uv + vec2(0.0, r.y * 2.6)) + texture(u_ssr, v_uv - vec2(0.0, r.y * 2.6))) * 0.7
         + (texture(u_ssr, v_uv + vec2(r.x * 0.8, 0.0)) + texture(u_ssr, v_uv - vec2(r.x * 0.8, 0.0))) * 0.6;
  s /= 6.6;
  // (run 4: the plaza still showed a spray of lone hits — the flowers and the lamps by the kerb, thin things the rays
  // reach only now and then. A mirror shows where most of its neighbourhood agrees: sparse hits fade out, a wall, a
  // ship or a line of light comes through whole)
  float a = m.b * s.a * smoothstep(0.25, 0.65, s.a);
  if (a < 0.003) discard;
  o = vec4(s.rgb / max(s.a, 1e-3), a);
}`;

  // F9 · Fern-Cache (renderer.js farFrame): the cached sky and far world, reprojected into this frame. The cache was drawn
  // from an eye a little off this one (≤ 1.5 m, ≤ 6°) with a wider view; a pixel finds its cached texel by the rotation,
  // then a few fixed-point steps with the cached depth follow the parallax of the move. It writes the colour and the depth
  // this frame's camera sees there; the near world is drawn live over it with the depth test.
  S.FAR_COMP_FS = `
uniform sampler2D u_fcCol;
uniform highp sampler2D u_fcDepth;
uniform mat4 u_invVP;       // this frame (camera-relative)
uniform mat4 u_curVP;
uniform mat4 u_fcVP;        // the cache (relative to its own eye)
uniform mat4 u_fcInvVP;
uniform vec3 u_delta;       // this eye − the cache's eye
uniform vec2 u_scale;       // the cache's view over the screen's (its overscan)
in vec2 v_uv;
out vec4 o;
void main() {
  vec4 pf = u_invVP * vec4(v_uv * 2.0 - 1.0, 1.0, 1.0);
  vec3 farP = pf.xyz / pf.w;                         // this pixel's ray at the far plane (now-relative)
  vec4 c0 = u_fcVP * vec4(farP + u_delta, 1.0);      // seen from the cache's eye
  vec2 uv = c0.xy / c0.w * 0.5 + 0.5;
  for (int i = 0; i < 3; i++) {
    float d = texture(u_fcDepth, uv).r;
    if (d >= 1.0) break;                              // the sky: its direction is all that counts
    vec4 xc = u_fcInvVP * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
    vec4 cn = u_curVP * vec4(xc.xyz / xc.w - u_delta, 1.0);
    uv += (v_uv - (cn.xy / cn.w * 0.5 + 0.5)) / u_scale;   // a step toward this pixel, in the cache's wider texels
  }
  float d = texture(u_fcDepth, uv).r;
  o = texture(u_fcCol, uv);
  if (d >= 1.0) { gl_FragDepth = 1.0; return; }
  vec4 xc = u_fcInvVP * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  vec4 cn = u_curVP * vec4(xc.xyz / xc.w - u_delta, 1.0);
  gl_FragDepth = clamp(cn.z / cn.w * 0.5 + 0.5, 0.0, 1.0);
}`;

  // ------------------------------------------------------------ simple lit mesh (entities, items, hand, falling blocks)
  S.MESH_VS = `
layout(location=0) in vec3 a_pos;
layout(location=1) in vec3 a_uvl;     // u, v, layer
layout(location=2) in vec3 a_normal;
layout(location=3) in vec4 a_color;   // tint rgb + shade
uniform mat4 u_viewProj;
uniform mat4 u_model;
out vec3 v_uvl;
out vec3 v_n;
out vec4 v_color;
out vec3 v_rel;
void main() {
  vec4 wp = u_model * vec4(a_pos, 1.0);
  v_rel = wp.xyz;
  v_uvl = a_uvl;
  v_n = normalize(mat3(u_model) * a_normal);
  v_color = vec4(pow(a_color.rgb, vec3(2.2)), a_color.a);
  gl_Position = u_viewProj * wp;
}`;
  S.MESH_FS = `
uniform sampler2DArray u_albedo;
uniform float u_sky;
uniform vec3 u_blockLight;
uniform float u_flash;
uniform float u_noFog;
${'__COMMON__'}
${LOOK}
in vec3 v_uvl;
in vec3 v_n;
in vec4 v_color;
in vec3 v_rel;
out vec4 o;
void main() {
  vec4 a = texture(u_albedo, v_uvl);
  // negative shade = opaque block texture whose alpha is the tint mask (grass sides); positive = alpha-tested;
  // |shade| 3 = a recoloured block (B1): the texture's detail in the colour (v_color)
  bool opq = v_color.a < 0.0;
  if (!opq && a.a < 0.5) discard;
  if (abs(v_color.a) > 2.5) a.rgb = lookRecolor(a.rgb, v_uvl.z, v_color.rgb);
  else if (opq) a.rgb = mix(a.rgb, a.rgb * v_color.rgb, a.a); else a.rgb *= v_color.rgb;
  float sunUp = smoothstep(-0.12, 0.12, u_sunDir.y);
  vec3 L = sunUp > 0.001 ? u_sunDir : u_moonDir;
  vec3 lc = sunUp > 0.001 ? u_sunColor * sunUp : u_moonColor;
  float ndl = max(dot(normalize(v_n), L), 0.0);
  float sk = u_sky * u_sky;
  float shade = 0.7 + 0.3 * max(v_n.y, 0.0) - 0.15 * max(-v_n.y, 0.0);
  vec3 light = u_ambSky * sk * shade + lc * ndl * smoothstep(0.55, 0.95, u_sky) * 0.9 + pow(u_blockLight, vec3(1.7)) * 1.35 * u_blockLightTint + 0.02;
#ifdef LIGHT2
  light = l2Hemi(normalize(v_n)) * sk + lc * ndl * smoothstep(0.55, 0.95, u_sky) * 0.9 + l2Pool(u_blockLight) + 0.02;   // t-light2
#endif
  float shK = abs(v_color.a);
  vec3 col = a.rgb * light * min(shK, 1.0);
  if (shK > 1.5 && shK < 2.5) col = a.rgb * (1.3 + u_night * 0.6); // emissive voxel faces (|shade| = 2)
  col = mix(col, vec3(1.0, 0.25, 0.2), u_flash * 0.55);
  if (u_noFog < 0.5) col = applyFog(col, v_rel, length(v_rel));
  o = vec4(col, 1.0);
}`;

  // ------------------------------------------------------------ particles
  S.PART_VS = `
layout(location=0) in vec2 a_corner;
layout(location=1) in vec4 a_posSize;   // rel pos xyz, size
layout(location=2) in vec4 a_uvRect;    // u0 v0 u1 v1 within layer
layout(location=3) in vec4 a_colLayer;  // rgb light-mult, layer
layout(location=4) in vec2 a_extra;     // emissive, alpha
uniform mat4 u_viewProj;
uniform vec3 u_right;
uniform vec3 u_up;
out vec3 v_uvl;
out vec3 v_col;
out vec2 v_extra;
out vec3 v_rel;
void main() {
  vec3 p = a_posSize.xyz + (u_right * a_corner.x + u_up * a_corner.y) * a_posSize.w;
  v_rel = p;
  vec2 uv = mix(a_uvRect.xy, a_uvRect.zw, a_corner * 0.5 + 0.5);
  v_uvl = vec3(uv, a_colLayer.w);
  v_col = a_colLayer.rgb;
  v_extra = a_extra;
  gl_Position = u_viewProj * vec4(p, 1.0);
}`;
  S.PART_FS = `
uniform sampler2DArray u_albedo;
${'__COMMON__'}
in vec3 v_uvl;
in vec3 v_col;
in vec2 v_extra;
in vec3 v_rel;
out vec4 o;
void main() {
  vec4 a;
  if (v_uvl.z < 0.0) { float d = length(fract(v_uvl.xy) - 0.5) * 2.0; a = vec4(1.0, 1.0, 1.0, 1.0 - smoothstep(0.3, 1.0, d)); }
  else a = texture(u_albedo, v_uvl);
  if (a.a < 0.05) discard;
  vec3 col = a.rgb * v_col;
  col *= 1.0 + v_extra.x * 3.0;
  col = applyFog(col, v_rel, length(v_rel));
  o = vec4(col, a.a * v_extra.y);
}`;

  // ------------------------------------------------------------ lines (block outline) / weather
  S.LINE_VS = `
layout(location=0) in vec3 a_pos;
uniform mat4 u_viewProj;
uniform vec3 u_offset;
void main() { gl_Position = u_viewProj * vec4(a_pos + u_offset, 1.0); }`;
  S.LINE_FS = `
uniform vec4 u_color;
out vec4 o;
void main() { o = u_color; }`;

  S.RAIN_VS = `
layout(location=0) in vec3 a_seed;      // x,z in [0,1), phase
layout(location=1) in vec2 a_corner;
uniform mat4 u_viewProj;
uniform vec3 u_camFrac;
uniform vec3 u_camPos;                   // absolute camera (mod range)
uniform float u_time;
uniform float u_snow;
uniform sampler2D u_heights;             // 128x128 top heights around camera
uniform vec2 u_heightOrigin;             // world xz of heights texel 0
uniform vec3 u_right;
#ifdef WXDRAMA
uniform vec3 u_rainWind;                 // t-motion: the wind's heading (x, z) and strength — the rain blows sideways in sheets
#endif
out float v_a;
out vec2 v_c;
out float v_snow;
void main() {
  float R = 24.0;
  vec2 xz = (a_seed.xy - 0.5) * 2.0 * R;
  vec2 wxz = floor(u_camPos.xz) + xz;
  float fallSpeed = mix(14.0, 1.6, u_snow);
  float H = 36.0;
  float yy = mod(-u_time * fallSpeed * (0.8 + a_seed.z * 0.4) + a_seed.z * 97.0, H) - H * 0.4;
  vec3 wp = vec3(wxz.x + 0.5, u_camPos.y + yy, wxz.y + 0.5);
  if (u_snow > 0.5) { wp.x += sin(u_time * 1.3 + a_seed.z * 20.0) * 0.6; wp.z += cos(u_time * 1.1 + a_seed.z * 17.0) * 0.6; }
#ifdef WXDRAMA
  // t-motion: the drops drift downwind as they fall (the slope grows with the wind: about 30° in a storm), the streak
  // leans along their path, and denser sheets of rain sweep downwind across the view
  float slope = u_snow > 0.5 ? 0.0 : u_rainWind.z * 0.19;
  vec2 drift = -u_rainWind.xy * slope * yy;   // (none at the eye's height: above it upwind, below it downwind — the field stays round the eye)
  wp.xz += drift;
  vec2 hu = (wxz + drift - u_heightOrigin + 0.5) / 128.0;
#else
  vec2 hu = (wxz - u_heightOrigin + 0.5) / 128.0;
#endif
  float top = texture(u_heights, hu).r * 255.0;
  v_a = step(top + 1.0, wp.y) * (1.0 - smoothstep(R * 0.6, R, length(xz)));
#ifdef WXDRAMA
  if (u_snow < 0.5) {
    vec2 pq = vec2(-u_rainWind.y, u_rainWind.x);
    float band = 0.5 + 0.5 * sin(dot(wp.xz, u_rainWind.xy) * 0.11 - u_time * (1.5 + u_rainWind.z) + 2.0 * sin(dot(wp.xz, pq) * 0.05));
    v_a *= 0.45 + 0.55 * smoothstep(0.3, 0.85, band);
  }
#endif
  vec3 rel = wp - u_camPos;
  vec2 size = u_snow > 0.5 ? vec2(0.07, 0.07) : vec2(0.02, 0.45);
#ifdef WXDRAMA
  vec3 upv = normalize(vec3(-u_rainWind.x * slope, 1.0, -u_rainWind.y * slope));
  vec3 p = rel + u_right * a_corner.x * size.x + upv * a_corner.y * size.y;
#else
  vec3 p = rel + u_right * a_corner.x * size.x + vec3(0.0, 1.0, 0.0) * a_corner.y * size.y;
#endif
  v_c = a_corner;
  v_snow = u_snow;
  gl_Position = u_viewProj * vec4(p, 1.0);
}`;
  S.RAIN_FS = `
uniform vec3 u_ambSky;
in float v_a;
in vec2 v_c;
in float v_snow;
out vec4 o;
void main() {
  if (v_a < 0.01) discard;
  float a = v_snow > 0.5 ? (1.0 - smoothstep(0.4, 1.0, length(v_c))) : (1.0 - abs(v_c.x)) * 0.55;
  vec3 c = v_snow > 0.5 ? vec3(0.95) : vec3(0.65, 0.72, 0.85);
  o = vec4(c * (u_ambSky * 0.8 + 0.15), a * v_a);
}`;

  // resolve common
  for (const k in S) if (typeof S[k] === 'string') S[k] = S[k].replace("${'__COMMON__'}", S.COMMON).replace('__COMMON__', S.COMMON);
})(VR);

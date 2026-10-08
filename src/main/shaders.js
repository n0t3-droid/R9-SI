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
vec3 nebula(vec3 dir) {
  vec3 G = normalize(vec3(0.32, 0.62, -0.72));
  float b = dot(dir, G);
  float band = exp(-b * b * 7.0);
  vec3 p = dir * 2.6;
#ifdef LITE
  float n1 = fbm3L(p + vec3(0.0, u_time * 0.0015, 0.0));
  float n2 = fbm3L(p * 2.1 + 11.0);
  float dust = 0.0;
#else
  float n1 = fbm3(p + vec3(0.0, u_time * 0.0015, 0.0));
  float n2 = fbm3(p * 2.1 + 11.0);
  float dust = smoothstep(0.42, 0.78, fbm3(p * 3.7 - 3.0));
#endif
  vec3 col = mix(vec3(0.22, 0.06, 0.46), vec3(0.10, 0.36, 1.0), smoothstep(0.3, 0.7, n1));
  col = mix(col, vec3(1.0, 0.30, 0.68), smoothstep(0.48, 0.78, n2) * 0.9);
  // cyan gas lobes and bright pink cores, as in the trailer
#ifdef LITE
  float n3 = n1 * 0.6 + n2 * 0.4;
#else
  float n3 = fbm3(p * 1.6 - 5.0);
#endif
  col = mix(col, vec3(0.15, 0.95, 1.0), smoothstep(0.6, 0.85, n3) * 0.55);
  col += vec3(1.0, 0.55, 0.85) * smoothstep(0.72, 0.9, n2 * 0.6 + n1 * 0.5) * 0.9;
  vec3 coreDir = normalize(vec3(0.62, 0.42, -0.66));
  float cd = max(0.0, dot(dir, coreDir));
  float core = pow(cd, 60.0) * 2.2 + pow(cd, 12.0) * 0.5;
  col += vec3(1.0, 0.78, 0.6) * core;
  float dens = band * (0.35 + 1.35 * n1 * n1) * (1.0 - dust * 0.7) + core * 0.6;
  // sparkling star clusters inside the band
  vec3 g = floor(dir * 520.0);
  float s = hash13(g);
  dens += step(0.9975, s) * band * 3.0;
  return col * dens;
}
vec4 gasGiant(vec3 dir, vec3 C, float R, vec3 L) {
  float cz = dot(dir, C);
  if (cz < 0.5) return vec4(0.0);
  vec3 up = abs(C.y) < 0.95 ? vec3(0, 1, 0) : vec3(1, 0, 0);
  vec3 X = normalize(cross(up, C)), Y = cross(C, X);
  vec2 q = vec2(dot(dir, X), dot(dir, Y)) / R;
  float r2 = dot(q, q);
  vec3 RN = u_ringNormal;
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
    float diff = max(dot(N, L), 0.0);
    float rim = pow(1.0 - zz, 3.0);
    vec3 col = alb * (diff * 1.25 + 0.3) + vec3(0.4, 0.6, 1.0) * rim * 0.35 * (0.3 + diff);   // 0.3: the shade side keeps its bands
    float edge = smoothstep(1.0, 0.985, sqrt(r2));
    res = vec4(col, edge);
  }
  // rings
  float den = dot(C, RN);
  if (abs(den) > 0.02) {
    float t = -(q.x * dot(X, RN) + q.y * dot(Y, RN)) / den;
    vec3 P = X * q.x + Y * q.y + C * t;
    float rr = length(P);
    if (rr > 1.3 && rr < 2.45 && (t < ts || r2 >= 1.0)) {
      float ring = 0.55 + 0.45 * sin(rr * 38.0) * sin(rr * 11.0 + 1.3);
      ring *= smoothstep(1.3, 1.4, rr) * smoothstep(2.45, 2.3, rr) * (1.0 - smoothstep(1.83, 1.86, rr) * smoothstep(1.92, 1.89, rr));
      float s0 = -dot(P, L);
      float sh = 1.0;
      if (s0 > 0.0 && length(P + L * s0) < 1.0) sh = 0.12;
      vec3 rc = mix(vec3(0.95, 0.80, 0.92), vec3(0.62, 0.74, 0.98), smoothstep(1.6, 2.2, rr));
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
  if (cz < 0.5) return vec4(0.0);
  vec3 up = abs(C.y) < 0.95 ? vec3(0, 1, 0) : vec3(1, 0, 0);
  vec3 X = normalize(cross(up, C)), Y = cross(C, X);
  vec2 q = vec2(dot(dir, X), dot(dir, Y)) / R;
  float r2 = dot(q, q);
  if (r2 >= 1.0) { float glow = exp(-(sqrt(r2) - 1.0) * 14.0) * 0.25; return vec4(vec3(0.4, 0.7, 1.0) * glow, 0.0); }
  float zz = sqrt(1.0 - r2);
  vec3 N = normalize(X * q.x + Y * q.y - C * zz);
  float n = fbm3(N * 4.0 + 7.0);
  vec3 alb = mix(vec3(0.2, 0.35, 0.75), vec3(0.3, 0.6, 0.45), smoothstep(0.45, 0.6, n));
  alb = mix(alb, vec3(0.95), smoothstep(0.62, 0.75, fbm3(N * 6.0 - 2.0)) * 0.7);
  float diff = max(dot(N, L), 0.0);
  vec3 col = alb * (diff * 1.2 + 0.03) + vec3(0.4, 0.7, 1.0) * pow(1.0 - zz, 2.5) * 0.5;
  return vec4(col, smoothstep(1.0, 0.97, sqrt(r2)));
}
// small grey cratered moons (lit by the sun, faint earthshine on the dark side)
vec4 moonlet(vec3 dir, vec3 C, float R, vec3 L, float seed) {
  float cz = dot(dir, C);
  if (cz < 0.9) return vec4(0.0);
  vec3 up = abs(C.y) < 0.95 ? vec3(0, 1, 0) : vec3(1, 0, 0);
  vec3 X = normalize(cross(up, C)), Y = cross(C, X);
  vec2 q = vec2(dot(dir, X), dot(dir, Y)) / R;
  float r2 = dot(q, q);
  if (r2 >= 1.0) return vec4(0.0);
  float zz = sqrt(1.0 - r2);
  vec3 N = normalize(X * q.x + Y * q.y - C * zz);
  float cr = vnoise(q * 3.0 + seed) * 0.6 + vnoise(q * 7.0 - seed) * 0.4;
  vec3 alb = vec3(0.72, 0.70, 0.74) * (0.75 + cr * 0.4);
  float diff = max(dot(N, L), 0.0);
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
    c += nebula(dir) * 0.8;
    return c;
  }
  float h = max(dir.y, 0.0);
  // Rayleigh-style gradient: the blue deepens quickly above a thin, luminous haze band
  vec3 col = mix(u_skyHorizon, u_skyZenith, pow(h, 0.42));
  float dayK = 1.0 - u_night;
  col = mix(col, u_skyHorizon * vec3(1.16, 1.1, 1.02) + vec3(0.035, 0.04, 0.03) * dayK, pow(1.0 - h, 16.0) * 0.6 * dayK);
  col += vec3(0.0, 0.012, 0.03) * pow(max(1.0 - abs(dir.y - 0.35), 0.0), 6.0) * dayK;   // (max: pow of a negative base is NaN below the horizon)
  float toSun = max(dot(dir, u_sunDir), 0.0);
  float horizonBand = pow(1.0 - h, 5.0);
  col += u_sunset * (pow(toSun, 7.0) * 1.3 + horizonBand * 0.45) * (0.3 + 0.7 * toSun);
  col += u_sunColor * pow(toSun, 60.0) * 0.45 * (1.0 - u_rain);
  if (dir.y < 0.0) col = mix(col, u_skyHorizon * 0.55, clamp(-dir.y * 2.5, 0.0, 1.0));
  if (withSun) {
    float clear = 1.0 - u_rain;
    // cosmic layer: the nebula owns the night; by day only a faint veil stays in the blue,
    // while the ringed giant and its moon keep hanging in the daylight sky
    float magicDay = u_skyMagic * (1.0 - u_night);
    float horizonFade = smoothstep(-0.12, 0.08, dir.y);
    // golden hour: the nebula fades in early, high in the sky, while the sun still lights the land
    float golden = (1.0 - smoothstep(0.02, 0.4, u_sunDir.y)) * step(-0.05, u_sunDir.y);
    // TRAILER.md §2.1: the nebula veil stays at ~45 % by day (stronger high up and through the long golden hours)
    float cosmic = clamp(u_night + magicDay * (0.4 + 0.25 * smoothstep(0.2, 0.9, dir.y) + golden * 0.5 * smoothstep(0.05, 0.5, dir.y)), 0.0, 1.0) * clear * horizonFade;
    float planetsK = clamp(u_night + magicDay * 0.7, 0.0, 1.0) * clear * horizonFade;
    if (planetsK > 0.01) {
      // the blue deepens to violet where the nebula shows, so its colours read by day as in the trailer
      col = mix(col, col * vec3(0.6, 0.48, 0.9) + vec3(0.02, 0.0, 0.05), cosmic * (1.0 - u_night) * 0.7);
      col += nebula(dir) * cosmic * mix(1.3, 0.9, u_night) * u_nebula;   // by day the veil reads as the trailer's magenta and cyan; u_nebula: the grade's knob (t-look)
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
    float sd = dot(dir, u_sunDir);
    col += u_sunColor * u_sunDisc * smoothstep(0.99945, 0.99972, sd) * clear;
    col += u_sunColor * pow(max(sd, 0.0), 900.0) * 3.0 * clear;
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
    col += vec3(0.6, 0.7, 1.0) * pow(max(md, 0.0), 400.0) * 0.4 * clear * u_night;
    // high cirrus (t-clouds): thin streaks across the day sky, lit like the day; u_cirrus is 0 on Very Low
    if (u_cirrus > 0.0 && dir.y > 0.12) {
      vec2 q = dir.xz / (dir.y + 0.1);
      float a = vnoise(vec2(q.x * 0.55 + q.y * 0.3, q.y * 4.2 + 3.0) + vec2(u_time * 0.0025, 0.0));
      float b = vnoise(vec2(q.x * 0.4 - 7.0, q.y * 9.0 - 1.0));
      float st = smoothstep(0.6, 0.92, a * 0.66 + b * 0.5) * smoothstep(0.12, 0.34, dir.y) * (1.0 - smoothstep(0.62, 0.92, dir.y));
      vec3 cir = vec3(0.82, 0.86, 1.0) * (0.25 + 0.6 * (1.0 - u_night)) + u_sunColor * 0.05 + u_sunset * 0.3 * toSun;
      col = mix(col, cir, st * u_cirrus * 0.12 * (1.0 - u_rain) * (1.0 - u_night * 0.8));
    }
    // stars
    float starK = max(u_night, cosmic * 0.45);
    if (starK > 0.02 && dir.y > -0.1) {
      vec3 sd3 = dir;
      float ang = u_time * 0.0003;
      sd3.xz = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * sd3.xz;
      vec3 sp = sd3 * 240.0;
      vec3 g = floor(sp);
      float s = hash13(g);
      if (s > 0.9955) {
        vec3 cpos = g + 0.5 + (vec3(hash13(g + 1.7), hash13(g + 2.3), hash13(g + 3.1)) - 0.5) * 0.6;
        float d = length(sp - cpos);
        float tw = 0.55 + 0.45 * sin(u_time * 3.0 + s * 100.0);
        vec3 sc = mix(vec3(0.75, 0.85, 1.0), vec3(1.0, 0.85, 0.7), hash13(g + 3.0));
        float br = smoothstep(0.9955, 1.0, s);
        col += sc * starK * clear * tw * (3.0 + br * 14.0) * exp(-d * d * 28.0);
      }
      col += meteors(dir) * u_night * clear;
      if (u_dim == 3) {
        float a = vnoise(vec2(dir.x * 3.0 + u_time * 0.02, dir.z * 1.5)) * smoothstep(0.1, 0.5, dir.y) * smoothstep(0.95, 0.4, dir.y);
        float band = pow(max(0.0, sin(dir.x * 6.0 + dir.z * 3.0 + vnoise(dir.xz * 2.0 + u_time * 0.03) * 4.0)), 8.0);
        col += vec3(0.1, 0.9, 0.5) * a * band * u_night * 0.8 + vec3(0.5, 0.2, 0.9) * a * band * band * u_night * 0.4;
      }
    }
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
  vec3 col = mix(u_skyHorizon, u_skyZenith, pow(h, 0.55));
  float toSun = max(dot(dir, u_sunDir), 0.0);
  col += u_sunset * (pow(toSun, 6.0) * 0.55 + pow(1.0 - h, 6.0) * 0.18) + u_sunColor * pow(toSun, 32.0) * 0.1 * (1.0 - u_rain);
  if (dir.y < 0.0) col = mix(col, u_skyHorizon * 0.6, clamp(-dir.y * 2.0, 0.0, 1.0));
  return col;
}
vec3 applyFog(vec3 col, vec3 rel, float dist) {
  vec3 dir = rel / max(dist, 0.001);
  vec3 fc = u_dim == 1 || u_dim == 2 ? u_fogColor : mix(hazeColor(dir), u_fogColor, 0.35);
  float hd = max(length(rel.xz), abs(rel.y) * 0.35);
  float f = smoothstep(u_fog.x, u_fog.y, hd);
  f = max(f, (1.0 - exp(-dist * u_fog.z)) * 0.85);
  if (u_fog.w > 0.5) { f = 1.0 - exp(-dist * 0.07); fc = u_fogColor; }
  return mix(col, fc, clamp(f, 0.0, 1.0));
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
in vec4 v_shadow;
#endif
uniform ivec3 u_camInt;
uniform vec3 u_camFrac;
uniform float u_emissiveBoost;
uniform float u_normalStrength;
uniform float u_holoLayer;
uniform float u_blockVar;     // Klassisch: w3 bit 15 marks natural blocks for their own shade, the normal map turns with the tile (Nahtlos: macro mottling)
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
// F2 · the sky seen in a reflection: a cheap environment term from the horizon and zenith colours (F1's sky LUT replaces it)
vec3 matEnv(vec3 R) {
  return mix(u_skyHorizon * 0.5, mix(u_skyHorizon, u_skyZenith, smoothstep(0.0, 0.8, R.y)), smoothstep(-0.05, 0.6, R.y));
}
// sun visibility: the shadow map near the camera, heightmap rays beyond it (or everywhere on Low)
float shadowAt(vec3 N, vec3 L) {
  float s = 1.0, cover = 0.0;
#ifdef SHADOWS
  vec3 sc = v_shadow.xyz / v_shadow.w * 0.5 + 0.5;
  if (!(sc.x <= 0.001 || sc.x >= 0.999 || sc.y <= 0.001 || sc.y >= 0.999 || sc.z >= 1.0)) {
    float t = u_shadowTexel;
    float bias = 0.0006;
    s = texture(u_shadowMap, vec3(sc.xy + vec2(-0.6, -0.6) * t, sc.z - bias));
    s += texture(u_shadowMap, vec3(sc.xy + vec2(0.6, -0.6) * t, sc.z - bias));
    s += texture(u_shadowMap, vec3(sc.xy + vec2(-0.6, 0.6) * t, sc.z - bias));
    s += texture(u_shadowMap, vec3(sc.xy + vec2(0.6, 0.6) * t, sc.z - bias));
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
  vec4 alb = textureGrad(u_albedo, vec3(fu, layer), dx, dy);
#ifdef CUTOUT
  if (alb.a < 0.5) discard;
#endif
  vec4 mat = textureGrad(u_material, vec3(fu, layer), dx, dy);
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
  float ao = 1.0 - v_ao * 0.2;
  float faceShade = face == 2u ? 1.0 : face == 3u ? 0.55 : (face <= 1u ? 0.78 : 0.88);
  if (noshade) faceShade = 0.92;
  vec3 V = normalize(-v_rel);
  float sunUp = smoothstep(-0.12, 0.12, u_sunDir.y);
  vec3 L = sunUp > 0.001 ? u_sunDir : u_moonDir;
  vec3 lc = sunUp > 0.001 ? u_sunColor * sunUp : u_moonColor;
  float ndl = noshade ? 0.65 : max(dot(n, L), 0.0);
  float outdoors = smoothstep(0.55, 0.95, sky);
  float sh = (ndl > 0.0 && outdoors > 0.0 && dot(N, L) > -0.2) ? shadowAt(N, L) : 1.0;
  vec3 direct = lc * ndl * sh * outdoors;
  vec3 amb = u_ambSky * skyL * mix(0.62, 1.0, faceShade);
  vec3 lighting = (amb + direct) * ao + blockL * ao * mix(0.8, 1.0, faceShade) + vec3(0.012, 0.012, 0.016);
  // wet ground: the top faces darken a little in the rain (u_wet is 0 when dry or when wetGround is off)
  if (face == 2u) alb.rgb *= 1.0 - 0.14 * u_wet;
  vec3 col = alb.rgb * lighting;
#ifndef LITE
  // specular highlights (sun glints on smooth surfaces)
  if (rough < 0.75 && ndl > 0.0) {
    vec3 H = normalize(L + V);
    float sp = pow(max(dot(n, H), 0.0), mix(160.0, 12.0, rough)) * (1.0 - rough) * 1.6;
    col += lc * sp * sh * outdoors * (1.0 + u_rain * 1.5);
  }
#endif
  if (u_matTier > 0.5) {
    // F2 · the response: metal reflects the sky tinted by its colour, wet surfaces and puddles mirror it at grazing angles
    // (outdoors only), varnished wood takes a soft sheen (tier 3)
    vec3 envC = matEnv(reflect(-V, n));
    float fresW = 0.04 + 0.96 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
    if (fam == 4) col = mix(col, alb.rgb * envC * (0.3 + 0.7 * v_sky) * 1.25, 0.8);
    col = mix(col, envC, outdoors * clamp(wetK * (0.1 + 0.9 * fresW) + pud * (0.6 + 0.4 * fresW), 0.0, 0.9));
    if (fam == 2 && u_matTier > 2.5 && ndl > 0.0) { vec3 Hs = normalize(L + V); col += lc * pow(max(dot(n, Hs), 0.0), 22.0) * 0.1 * sh * outdoors; }
  }
  if (emis > 0.02 || emissiveFace) {
    float e = emissiveFace ? max(emis, 0.85) : emis;
    col = mix(col, alb.rgb * (1.4 + u_emissiveBoost), e);
  }
  if (u_holoLayer > 0.5 && abs(layer - u_holoLayer) < 0.5) {
    // holograms: rolling scanlines, a bright sweep and a faint flicker
    vec3 hp = v_localPos + vec3(u_camInt);
    float scan = 0.7 + 0.3 * sin(hp.y * 50.0 - u_time * 5.0);
    float sweep = smoothstep(0.88, 1.0, fract(hp.y * 0.35 - u_time * 0.4));
    float flick = 0.93 + 0.07 * sin(u_time * 31.0 + hash13(floor(hp * 4.0)) * 40.0);
    col *= scan * flick + sweep * 0.9;
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
uniform float u_waterTier;    // 0 Very Low (sky-LUT reflection only, no caustics), 1 and 2: caustics on the floor
uniform vec2 u_windDir;       // the wind's heading (weather.js), the swell runs with it
uniform float u_stormK;       // the storm factor of the waves (water_wave.js)
${(VR.WaterWave ? VR.WaterWave.glsl() : '')}
#ifdef MODEL
uniform mat3 u_normalMat;
uniform float u_clipNear;
#endif
#ifdef SHADOWS
uniform highp sampler2DShadow u_shadowMap;
uniform float u_shadowTexel;
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
float shadowAt(vec3 N, vec3 L) {
#ifdef SHADOWS
  vec3 sc = v_shadow.xyz / v_shadow.w * 0.5 + 0.5;
  if (!(sc.x <= 0.0 || sc.x >= 1.0 || sc.y <= 0.0 || sc.y >= 1.0 || sc.z >= 1.0)) return texture(u_shadowMap, vec3(sc.xy, sc.z - 0.0008));
#endif
#ifdef HSHADOW
  return hShadow(v_localPos, N, L);
#else
  return 1.0;
#endif
}
// F2 · the sky seen in a reflection (the same cheap term as the terrain's matEnv)
vec3 matEnv(vec3 R) {
  return mix(u_skyHorizon * 0.5, mix(u_skyHorizon, u_skyZenith, smoothstep(0.0, 0.8, R.y)), smoothstep(-0.05, 0.6, R.y));
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
    if (face == 2u) {
      float wh = 0.0;
      n = gerstnerN(wq, u_time, kind == 6u ? flowDir(v_w3) : u_windDir, kind == 6u ? ak * 0.6 : ak, wh);
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
    // caustics (tier >= 1): the sun's light network on the floor seen through shallow water
    if (u_waterTier > 0.5 && face == 2u && thick < 6.0 && sunUp > 0.001) {
      vec3 D = -V;
      vec2 fl = wp.xz + D.xz / max(-D.y, 0.25) * thick * 0.75;
      under += u_sunColor * sunUp * causticAt(fl, u_time) * 0.22 * exp(-thick * 0.3) * (1.0 - u_rain);
    }
    vec3 R = reflect(-V, n);
    R.y = abs(R.y);
    vec3 refl = skyColor(R, false) * mix(0.25, 1.0, skyL);
    refl = mix(refl, refl * vec3(0.62, 0.84, 1.0) + body * 0.25, 0.4);
    if (u_reflOn > 0.5) {
      // the planar reflection (renderer.js): the mirrored near world and sky, shifted by the slope of the surface
      vec3 pr = texture(u_reflTex, clamp(suv + n.xz * vec2(0.22, 0.4), 0.001, 0.999)).rgb;
      refl = pr * vec3(0.86, 0.94, 1.0) + body * 0.1;
    }
    float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
    fres = min(fres * 0.85, 0.66);
    if (u_underwater > 0.5) { fres = face == 3u ? 0.0 : fres * 0.3; }
    vec3 col = mix(under * (1.0 - 0.22 * seamK), refl, clamp(fres, 0.0, 1.0));
    // sun sparkle: a GGX lobe whose width follows the slope (steep water glitters wider and dimmer), plus a sheen
    vec3 H = normalize(L + V);
    float nh = max(dot(n, H), 0.0);
    float a = 0.02 + 0.09 * clamp(length(n.xz) * 2.0, 0.0, 1.0), a2 = a * a;
    float dd = nh * nh * (a2 - 1.0) + 1.0;
    float sp = (a2 / (3.14159 * dd * dd)) * (0.02 + 0.98 * pow(1.0 - max(dot(H, V), 0.0), 5.0)) * 0.035 + pow(nh, 60.0) * 0.12;
    col += lc * sp * (sp > 0.004 ? shadowAt(NORMALS[face], L) : 1.0) * smoothstep(0.6, 1.0, v_sky) * (1.0 - u_rain);
    // shore foam
    // (a broken, drifting line from the noise where the water is a few tenths of a block deep, not a regular stripe)
    // (thin: a step between two water levels also measures as shallow, so the foam must stay a whisper there)
    float foamN = texture(u_noise, wp.xz / 5.0 + vec2(u_time * 0.02, -u_time * 0.015)).r;
    float foam = (1.0 - smoothstep(0.0, 0.2, thick)) * smoothstep(0.45, 0.7, foamN);
    col = mix(col, vec3(0.9) * (u_ambSky * skyL + blockL + lc * 0.3), clamp(foam, 0.0, 1.0) * 0.28 * float(face == 2u));
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
  vec3 H = normalize(L + V);
  col += lc * pow(max(dot(n, H), 0.0), 120.0) * 1.5 * smoothstep(0.55, 0.95, v_sky);
  float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
  col += skyColor(reflect(-V, n), false) * fres * 0.35 * skyL;
  // F2: the rim: a glass edge seen at a grazing angle catches the sky (the fresnel's edge, cheap)
  col += matEnv(reflect(-V, n)) * pow(1.0 - max(dot(n, V), 0.0), 3.0) * 0.3 * skyL;
  col = applyFog(col, v_rel, dist);
  o_col = vec4(col, clamp(alb.a + fres * 0.3, 0.0, 1.0));
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
out vec3 v_rel;
out vec3 v_n;
out float v_h;
void main() {
  float yo = floor(a_inst.w / 8.0), th = a_inst.w - yo * 8.0;
  vec3 p = vec3(a_inst.x, yo, a_inst.y) * u_cell + a_corner * u_cell * vec3(a_inst.z, th, 1.0);
  vec3 rel = u_cloudOrigin + p;
  v_rel = rel; v_n = a_normal;
  v_h = a_corner.y;
  gl_Position = u_viewProj * vec4(rel, 1.0);
}`;
  S.CLOUD_FS = `
${'__COMMON__'}
uniform float u_cloudAlpha;
uniform float u_cloudR;
in vec3 v_rel;
in vec3 v_n;
in float v_h;
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
  o = vec4(col, u_cloudAlpha * fade);
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
out vec2 v_uv;
out float v_alpha;
out float v_var;
out float v_dist;
out float v_near;
void main() {
  vec3 rel = u_origin + a_c.xyz;
  vec3 p = rel + (u_camRight * a_corner.x + u_camUp * a_corner.y * a_p.y) * a_c.w;
  v_uv = a_corner * 0.5 + 0.5; v_alpha = a_p.x; v_var = a_p.z; v_dist = length(rel.xz);
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
  ivec2 ch = ivec2(floor(cl / 16.0)) + 32;
  // the mask carries each chunk column's fade (0..1, 300 ms in): the tile is cut where the chunk keeps the pixel, and the
  // soft edge (bilinear) makes the cut fade over a chunk; min() with the nearest fade keeps the cut under the chunk's own
  // threshold, so a pixel is always drawn by one of the two (no holes)
  float cover = 0.0;
  if (ch.x >= 0 && ch.y >= 0 && ch.x < 64 && ch.y < 64) cover = min(texelFetch(u_mask, ch, 0).r, textureLod(u_mask, (cl / 16.0 + 32.0) / 64.0, 0.0).r);
  if (cover > 0.0 && bayer4(gl_FragCoord.xy) < cover) discard;
  // never right in front of the eyes: coarse cells only stand in at a distance
  if (dot(v_rel, v_rel) < u_lodNear * u_lodNear) discard;
  vec2 wp = v_rel.xz + u_camFrac.xz + vec2(u_camInt.xz);
  vec3 N = NORMALS[v_face];
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
      vec2 g = v_face <= 1u ? fr.zy : v_face <= 3u ? fr.xz : fr.xy;
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
    float ndl = max(dot(N, L), 0.0);
    vec3 amb = u_ambSky * mix(0.62, 1.0, faceShade);
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
  col = applyFog(col, v_rel, dist);
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
uniform mat4 u_model;
out vec3 v_n;
out vec4 v_color;
out vec3 v_rel;
void main() {
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
    float sky = step(0.99999, texture(u_depth, p).r);
    acc += texture(u_color, p).rgb * sky * w;
    w *= 0.955;
  }
  o = vec4(acc / 28.0 * u_raysStrength, 1.0);
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
  vec2 hu = (wxz - u_heightOrigin + 0.5) / 128.0;
  float top = texture(u_heights, hu).r * 255.0;
  v_a = step(top + 1.0, wp.y) * (1.0 - smoothstep(R * 0.6, R, length(xz)));
  vec3 rel = wp - u_camPos;
  vec2 size = u_snow > 0.5 ? vec2(0.07, 0.07) : vec2(0.02, 0.45);
  vec3 p = rel + u_right * a_corner.x * size.x + vec3(0.0, 1.0, 0.0) * a_corner.y * size.y;
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

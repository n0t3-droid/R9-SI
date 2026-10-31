// ============================================================================
// u-stars · VR.StarJump — the Sternensprung and the other systems (docs/superpowers/plans/2026-10-30-u-stars.md;
// universe spec §8.3–§8.4, §11–§12; REFERENCE §6–§7).
//   · pure part (node: test/galaxy.js): the jump's phases (spin-up 2.5 s, transit 3–5 s, arrival 2.5 s → 8–12 s),
//     β 0 → 0.99, aberration cos θ' = (cos θ + β)/(1 + β cos θ), Doppler D = 1/(γ(1 − β cos θ'))
//   · the game (a page): the scene of another system in ONE full-screen pass — the star grid (aberrated and Doppler-
//     shifted while jumping: the stars bunch ahead and turn blue, behind they thin out and redden), the galaxy's band
//     (turning once in the transit), the nebula from inside (Hα pink-red, [O III] teal by the hot star, dust lanes,
//     ionised rims, newborn stars; `nebulaTrue` shows how faint it really is), the star(s) at their true colour and size,
//     the planets and moons as analytic spheres lit by one or two stars, each casting a shadow from each (binaries: two
//     shadows), red-dwarf flares. Arrival in orbit round the most interesting body; V lands (VR.Travel to its dim: an
//     existing world kind under this star's light), O the star map, 🏠 Heimkehr jumps home from anywhere.
//   · the landed world: VR.Universe.localSky / VR.BodySky.compute wrapped for the x.* dims — the kind's own sky with
//     this star's colour, size and the R§7 sky tint, no Helia family overhead.
// Cost: nothing unless a jump or another system is on screen; then one full-screen pass (Very Low: one star grid, the
// nebula in 2 octaves, 3 for the worlds; High: two grids, 5 octaves). No allocation per frame in the draw.
// ============================================================================
(function (VR) {
  'use strict';
  const SJ = VR.StarJump = {};
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const sstep = (u) => { u = clamp(u, 0, 1); return u * u * u * (u * (u * 6 - 15) + 10); };

  // ---------------------------------------------------------------- the jump (U§8.4)
  SJ.SPIN = 2.5; SJ.ARRIVE = 2.5; SJ.BETA = 0.99;
  // the transit 3–5 s by the distance (5 ly → 3 s, 60 ly and the home jump → 5 s)
  SJ.plan = (ly) => {
    const k = clamp(Math.log(Math.max(ly, 1) / 5) / Math.log(12), 0, 1), transit = 3 + 2 * k;
    return { ly, spin: SJ.SPIN, transit, arrive: SJ.ARRIVE, dur: SJ.SPIN + transit + SJ.ARRIVE };
  };
  // the state s seconds in: phase, β, the way travelled (0–1), the band's turn (rad), the arrival's progress
  SJ.at = (J, s, o) => {
    o = o || {};
    if (s < J.spin) { o.phase = 'spin'; o.u = s / J.spin; o.beta = SJ.BETA * sstep(o.u); o.travelled = 0; o.band = 0; }
    else if (s < J.spin + J.transit) { o.phase = 'transit'; o.u = (s - J.spin) / J.transit; o.beta = SJ.BETA; o.travelled = sstep(o.u); o.band = 2 * Math.PI * sstep(o.u); }
    else { o.phase = 'arrive'; o.u = Math.min(1, (s - J.spin - J.transit) / J.arrive); o.beta = SJ.BETA * (1 - sstep(o.u)); o.travelled = 1; o.band = 2 * Math.PI; }
    o.done = s >= J.dur;
    return o;
  };
  // where a star at cos θ (rest frame, from the way of travel) is seen at β · the inverse (what the shader samples)
  SJ.aberr = (c, b) => (c + b) / (1 + b * c);
  SJ.unaberr = (c, b) => (c - b) / (1 - b * c);
  // the Doppler factor of light seen at cos θ' (observer frame): √((1+β)/(1−β)) dead ahead
  SJ.doppler = (c, b) => 1 / ((1 / Math.sqrt(1 - b * b)) * (1 - b * c));
  SJ.colorT = (T, D) => T * D;
  // ---- u-stars2: the bunching must read — the stars ahead brightened by D³ (the beamed flux; u-stars capped D² at 6)
  // with a soft cap at 48, the galaxy's band and the nebula dimmed as β rises, a short tunnel of streaks only at the
  // transit's peak (the shader mirrors these three)
  SJ.boost = (D) => { const d3 = D * D * D; return d3 / (1 + d3 / 48); };
  SJ.bandK = (b) => 1 - 0.85 * sstep(b / SJ.BETA);
  SJ.tunnel = (j) => (j && j.phase === 'transit' ? Math.exp(-Math.pow((j.u - 0.5) / 0.14, 2)) * (j.u > 0.15 && j.u < 0.85 ? 1 : 0) : 0);
  // ---- u-stars2 end

  // ---------------------------------------------------------------- vectors (doubles)
  const v3 = (x, y, z) => [x || 0, y || 0, z || 0];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const len = (a) => Math.hypot(a[0], a[1], a[2]);
  const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const rotY = (a, ang) => { const c = Math.cos(ang), s = Math.sin(ang); return [a[0] * c + a[2] * s, a[1], -a[0] * s + a[2] * c]; };
  SJ.v = { sub, add, mul, dot, len, norm, rotY };
  const L64 = 64, AU = 1.495978707e11, MU_SUN = 1.32712440018e20, R_SUN = 6.957e8, LY = 9.4607e15;
  const KIND = { cratered: 1, ice: 2, volcanic: 3, dust: 4, ocean: 5, giant: 6, icegiant: 7, lava: 8, hot: 9 };
  SJ.KIND = KIND;

  // ---------------------------------------------------------------- a system's bodies at a moment (game metres)
  // the stars round their barycentre (a close pair), the planets round it, the moons round their planets; circular
  // orbits in the system's plane (x, z), the periods real ÷ 8 (U§3)
  SJ.place = (def, t) => {
    const out = {}, bs = def.bodies, s0 = bs[0], s1 = bs.find(b => b.kind === 'star' && b.parent);
    const close = !!(def.star2 && def.star2.close);
    const M1 = s0.mu, M2 = s1 ? s1.mu : 0;
    out[s0.id] = v3(); if (s1) out[s1.id] = v3();
    if (s1) {
      const a = s1.orbit.a / L64, n = 8 * Math.sqrt((M1 + M2) / Math.pow(s1.orbit.a, 3)), th = s1.orbit.M0 * Math.PI / 180 + n * t;
      const dir = [Math.cos(th), 0, Math.sin(th)];
      out[s0.id] = mul(dir, -a * M2 / (M1 + M2)); out[s1.id] = mul(dir, a * M1 / (M1 + M2));
    }
    const muC = close ? M1 + M2 : M1, cen = close ? v3() : out[s0.id];
    for (const b of bs) {
      if (b.kind === 'star' || !b.orbit) continue;
      const par = b.parent === s0.id ? null : b.parent;
      const muP = par ? (bs.find(x => x.id === par).g * Math.pow(bs.find(x => x.id === par).R, 2)) : muC;
      const a = b.orbit.a, n = 8 * Math.sqrt(muP / (a * a * a)), th = b.orbit.M0 * Math.PI / 180 + n * t + (b.phase || 0), inc = (b.orbit.i || 0) * Math.PI / 180;
      const p = [a / L64 * Math.cos(th), a / L64 * Math.sin(th) * Math.sin(inc), a / L64 * Math.sin(th) * Math.cos(inc)];
      out[b.id] = add(par ? out[par] || v3() : cen, p);
    }
    return out;
  };
  // where the camera parks on arrival: 5 R from the most interesting body, the star 100° round from the camera's side
  // (a gibbous world), a little above its orbit's plane; the view between the world and its star
  SJ.arrival = (def, t, o) => {
    o = o || {};
    const G = VR.Galaxy, f = o.focus ? def.bodies.find(b => b.id === o.focus) : G.showpiece(def);
    const P = SJ.place(def, t), pF = P[f.id], R = f.R / L64, sDir = norm(sub(P[def.bodies[0].id], pF));
    let off = rotY(sDir, (o.phaseDeg || 100) * Math.PI / 180); off = norm([off[0], 0.22, off[2]]);
    const dist = (o.dist || 5) * R, cam = add(pF, mul(off, dist));
    const toF = norm(sub(pF, cam)), toS = norm(sub(P[def.bodies[0].id], cam));
    const look = norm(add(mul(toF, 0.55), mul(toS, 0.45)));
    return { focus: f, cam, look, toStar: toS, rel: mul(off, dist) };
  };
  SJ.yawPitch = (d) => ({ yaw: Math.atan2(-d[0], -d[2]), pitch: Math.asin(clamp(d[1], -1, 1)) });
  SJ.fwd = (yaw, pitch) => [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];

  // ================================================================ the game (a page)
  if (typeof window === 'undefined' || !VR.Game) return;
  SJ.page = true;
  const Game = VR.Game, G = () => VR.Galaxy;
  const T = (k, v) => (VR.I18N ? VR.I18N.t(k, v) : k);
  const lang = () => { const L = VR.I18N && VR.I18N.lang; return (typeof L === 'function' ? L() : L) === 'en' ? 'en' : 'de'; };
  SJ.nameOf = (n) => (n && typeof n === 'object' ? n[lang()] || n.de : n || '');

  // the switches (Bild · Anzeige): the nebula's true faintness; the jump as a fade (Weniger Bewegung)
  if (VR.Settings && VR.Settings.add) {
    VR.Settings.add({ key: 'nebulaTrue', g: 'img', sec: 'show', t: 'switch', lab: 'g.set.nebulaTrue', tip: 'g.set.nebulaTrue.tip', cost: 'free', def: false });
    VR.Settings.add({ key: 'jumpFade', g: 'img', sec: 'show', t: 'switch', lab: 'g.set.jumpFade', tip: 'g.set.jumpFade.tip', cost: 'free', def: false });
  }
  SJ.tier = (g) => (VR.SpaceScene && VR.SpaceScene.tier ? VR.SpaceScene.tier(g) : 2);
  SJ.hood = (g) => G().build(((g && g.meta && g.meta.seed) >>> 0) || 0x5eed);
  const visited = (g) => { const m = g.meta; if (!m.stars) m.stars = { v: [] }; if (!Array.isArray(m.stars.v)) m.stars.v = []; return m.stars.v; };
  SJ.visited = visited;
  // where the jump may start: from another system, or from Helia's space ≥ 2 R from every body (U§8.4)
  SJ.canJump = (g) => {
    if (!g || g.state !== 'play') return 'g.stars.notNow';
    if (g.meta && g.meta.guest) return 'g.stars.guest';
    const S = g.stars;
    if (S && S.on) return S.J ? 'g.stars.busy' : null;
    const SF = VR.SpaceFlight;
    if (!SF || !SF.inSpace || !SF.inSpace(g)) return 'g.stars.fromSpace';
    const a = VR.Ascent && VR.Ascent.ascOf ? VR.Ascent.ascOf(g.flight) : null, st = a && a.st;
    if (a && a.jump) return 'g.stars.busy';
    if (st && st.frame && st.frame !== 'helia' && VR.Universe) { const b = VR.Universe.home.body(st.frame); if (b && len(st.r) < 2 * b.R) return 'g.stars.tooClose'; }
    return null;
  };
  SJ.range = (g) => (g && g.meta && g.meta.stars && g.meta.stars.range) || G().RANGE;
  SJ.here = (g) => (g && g.stars && g.stars.on ? g.stars.sys : 0);

  // ---------------------------------------------------------------- the shader (one full-screen pass)
  const VS = `
uniform mat4 u_invViewProj;
out vec3 v_dir;
void main() {
  int id = gl_VertexID;
  vec2 p = vec2(float((id << 1) & 2), float(id & 2)) * 2.0 - 1.0;
  vec4 w = u_invViewProj * vec4(p, 1.0, 1.0);
  v_dir = w.xyz / w.w;
  gl_Position = vec4(p, 0.5, 1.0);
}`;
  const FS = `
const float PI = 3.14159265;
float hash13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
vec3 hash33(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
float vnoise3(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = hash13(i), b = hash13(i + vec3(1.0, 0.0, 0.0)), c = hash13(i + vec3(0.0, 1.0, 0.0)), d = hash13(i + vec3(1.0, 1.0, 0.0));
  float e = hash13(i + vec3(0.0, 0.0, 1.0)), g = hash13(i + vec3(1.0, 0.0, 1.0)), h = hash13(i + vec3(0.0, 1.0, 1.0)), k = hash13(i + vec3(1.0, 1.0, 1.0));
  return mix(mix(mix(a, b, f.x), mix(c, d, f.x), f.y), mix(mix(e, g, f.x), mix(h, k, f.x), f.y), f.z);
}
uniform vec4 u_view;      // tier, pixels per radian, time (s), stars' brightness
uniform vec4 u_jump;      // β, γ, the band's turn (rad), black (the fade)
uniform vec3 u_V;         // the way of travel
uniform vec3 u_galN;
uniform vec3 u_galC;
uniform vec4 u_neb;       // on, brightness (telescope 1 · true colour ~0.05), seed, saturation
uniform vec3 u_nebHot;    // the hot star's way (the [O III] core, the rims face it)
uniform vec4 u_S[2];      // the stars: centre (units, from the eye), radius (units; 0 = none)
uniform vec4 u_Sc[2];     // their colour (linear, luminance 1), their light at the worlds (flux, the focus = 1)
uniform vec4 u_Sd[2];     // the disc's radiance, the flare, the glare's strength, -
uniform int u_n;
uniform vec4 u_P[12];     // the worlds: centre (units), radius
uniform vec4 u_C[12];     // kind, seed, flags (1 air, 2 eye, 4 point-only), spin angle
uniform vec4 u_pt[2];     // the jump's two point stars: way, angular radius (0 = none)
uniform vec4 u_ptc[2];    // their colour (linear), T (K)
uniform vec4 u_flood;     // the arrival's light: colour, strength
uniform vec4 u_sky;       // the sky's tint at the limbs (R§7), -
uniform vec4 u_tun;       // u-stars2: the tunnel of streaks (strength, time s), the band's dimming (1 … 0.15), -
in vec3 v_dir;
out vec4 o;
const float TS[9] = float[9](2300.0, 3000.0, 4400.0, 5300.0, 5800.0, 6500.0, 7200.0, 10000.0, 40000.0);
const vec3 CS[9] = vec3[9](vec3(1.0, 0.205, 0.018), vec3(1.0, 0.366, 0.068), vec3(1.0, 0.434, 0.184), vec3(1.0, 0.730, 0.527), vec3(1.0, 0.846, 0.791), vec3(0.723, 0.730, 1.0), vec3(0.479, 0.565, 1.0), vec3(0.191, 0.319, 1.0), vec3(0.104, 0.198, 1.0));
// a star's colour by temperature (the stellar-model column, R§6.1, linear); below 2,300 K deep red fading out
vec3 tcol(float T) {
  if (T <= TS[0]) return CS[0] * smoothstep(700.0, 2300.0, T);
  if (T >= TS[8]) return CS[8];
  vec3 c = CS[8];
  for (int i = 0; i < 8; i++) { if (T < TS[i + 1]) { float k = log(T / TS[i]) / log(TS[i + 1] / TS[i]); c = mix(CS[i], CS[i + 1], k); break; } }
  return c;
}
// one grid of stars on a cube's faces; pxr pixels per radian (÷ the Doppler factor: the sky ahead shrinks), dop shifts
vec3 starGrid(vec3 D, float N, float seed, float dens, float bright, float pxr, float dop) {
  vec3 a = abs(D); vec2 uv; float face;
  if (a.x >= a.y && a.x >= a.z) { uv = D.yz / a.x; face = D.x > 0.0 ? 0.0 : 1.0; }
  else if (a.y >= a.z) { uv = D.xz / a.y; face = D.y > 0.0 ? 2.0 : 3.0; }
  else { uv = D.xy / a.z; face = D.z > 0.0 ? 4.0 : 5.0; }
  vec2 g = (uv * 0.5 + 0.5) * N, cell = floor(g), f = fract(g);
  vec3 h = hash33(vec3(cell, face * 17.0 + seed));
  float dn = dens * (0.3 + 1.2 * vnoise3(D * 3.1 + seed));
  if (h.z > dn) return vec3(0.0);
  vec2 sp = 0.06 + 0.88 * h.xy;
  float px = length(f - sp) * (1.5708 / N) * pxr;
  float b = bright * min(0.002 * pow(max(hash13(vec3(cell, face + seed * 3.0)), 1e-4), -0.6667), 2.5);
  float t = hash13(vec3(cell.yx, face + 9.0 + seed));
  float T = t < 0.12 ? 3100.0 : t < 0.34 ? 4500.0 : t < 0.66 ? 5600.0 : t < 0.88 ? 7500.0 : 14000.0;
  vec3 col = tcol(T * dop) / max(0.35, dot(tcol(T), vec3(0.2126, 0.7152, 0.0722)));
  float d3 = dop * dop * dop; b *= d3 / (1.0 + d3 / 48.0);   // (u-stars2: D³ with a soft cap at 48 — SJ.boost; u-stars: D² ≤ 6)
  return col * b * exp(-px * px * 1.6 / (1.0 + 1.5 * b));
}
float fbm(vec3 p, int oct) { float s = 0.0, a = 0.5; for (int i = 0; i < 6; i++) { if (i >= oct) break; s += a * vnoise3(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s / (1.0 - pow(0.5, float(oct))); }
// the nebula from inside (R§6.4): walls of Hα, [O III] teal near the hot star, dust lanes, ionised rims, newborn stars
vec3 nebula(vec3 D, int oct, float pxr) {
  float sd = u_neb.z;
  float n = fbm(D * 1.7 + sd, oct), m = fbm(D * 3.3 + sd * 1.7 + 5.0, oct);
  float walls = smoothstep(0.46, 0.78, n);
  float hot = max(dot(D, u_nebHot), 0.0);
  float core = pow(hot, 2.5) * smoothstep(0.35, 0.7, m) * (0.4 + walls);
  float lane = smoothstep(0.5, 0.64, m);
  float rim = smoothstep(0.44, 0.5, m) * (1.0 - smoothstep(0.5, 0.56, m)) * (0.35 + 0.65 * hot) * walls;
  vec3 ha = vec3(1.0, 0.12, 0.26), o3 = vec3(0.06, 0.8, 0.7);
  vec3 c = ha * (0.012 + 0.2 * walls * walls + 0.03 * n * n) + o3 * core * 0.55 + vec3(1.0, 0.5, 0.45) * rim * 0.5;
  c *= 1.0 - 0.94 * lane * (1.0 - 0.5 * core);
  // newborn stars: red points in the dense gas
  c += starGrid(D, 90.0, 41.0 + sd, 0.35 * walls, 0.6, pxr, 0.55) * walls;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return mix(vec3(l), c, u_neb.w) * u_neb.y;
}
vec3 rotY(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(v.x * c + v.z * s, v.y, -v.x * s + v.z * c); }
// the albedo of a world at its body-frame normal Nb (linear), its own light
vec3 surf(float kind, vec3 Nb, vec3 N, float seed, int oct, vec3 Ls, float tm, out vec3 em) {
  em = vec3(0.0);
  vec3 q = Nb * 2.0 + seed;
  float n = fbm(q, oct);
  if (kind < 1.5) {           // cratered (basalt-like): maria, highlands, craters
    float maria = smoothstep(0.5, 0.6, fbm(Nb * 1.2 + seed * 1.3, max(oct - 1, 2)));
    vec3 c = mix(vec3(0.3, 0.285, 0.27), vec3(0.085, 0.082, 0.08), maria) * (0.75 + 0.5 * n);
    float cr = vnoise3(Nb * 16.0 + seed); c *= 0.8 + 0.35 * smoothstep(0.55, 0.75, cr) - 0.2 * smoothstep(0.75, 0.9, cr);
    return c;
  }
  if (kind < 2.5) {           // ice (opal-like): bright, with reddish lineae
    float li = 1.0 - smoothstep(0.0, 0.03, abs(vnoise3(Nb * 4.0 + seed) - 0.5));
    return mix(vec3(0.74, 0.79, 0.86) * (0.85 + 0.25 * n), vec3(0.48, 0.32, 0.24), li * 0.6);
  }
  if (kind < 3.5) {           // volcanic (sulfur): yellow-orange, dark paterae with red rings, lava glowing
    float v = vnoise3(Nb * 7.0 + seed);
    vec3 c = mix(vec3(0.62, 0.48, 0.12), vec3(0.78, 0.7, 0.32), n);
    c = mix(c, vec3(0.55, 0.16, 0.05), smoothstep(0.62, 0.68, v) * (1.0 - smoothstep(0.7, 0.74, v)));
    float pat = smoothstep(0.72, 0.76, v);
    c = mix(c, vec3(0.05, 0.04, 0.035), pat);
    em = vec3(1.0, 0.3, 0.04) * pat * 0.6;
    return c;
  }
  if (kind < 4.5) {           // dust (ochre): rust plains, dark albedo marks, polar caps
    vec3 c = mix(vec3(0.5, 0.24, 0.11), vec3(0.24, 0.12, 0.07), smoothstep(0.48, 0.62, fbm(Nb * 1.6 + seed, oct)));
    c *= 0.85 + 0.3 * n;
    return mix(c, vec3(0.85, 0.85, 0.88), smoothstep(0.84, 0.9, abs(Nb.y) + 0.06 * n));
  }
  if (kind < 5.5) {           // ocean: seas, islands, clouds; an eye world freezes on its night side
    float land = smoothstep(0.58, 0.62, fbm(Nb * 1.8 + seed, oct));
    vec3 c = mix(vec3(0.015, 0.06, 0.14), mix(vec3(0.16, 0.22, 0.09), vec3(0.42, 0.36, 0.22), smoothstep(0.6, 0.8, n)), land);
    c = mix(c, vec3(0.8, 0.84, 0.9), smoothstep(0.9, 0.95, abs(Nb.y)));
    float cl = smoothstep(0.5, 0.78, fbm(rotY(Nb, tm * 0.004) * 3.0 + seed * 2.0, oct));
    return mix(c, vec3(0.86), cl * 0.85);
  }
  if (kind < 6.5) {           // gas giant: belts and zones, turbulence, a storm
    float lat = Nb.y, turb = fbm(vec3(Nb.x * 2.0, Nb.y * 9.0, Nb.z * 2.0) + seed, oct);
    float bands = sin(lat * 17.0 + turb * 3.2 + seed) * 0.5 + 0.5;
    vec3 a = mix(vec3(0.82, 0.72, 0.56), vec3(0.88, 0.84, 0.74), fract(seed * 0.37));
    vec3 c = mix(a, vec3(0.5, 0.33, 0.2), bands * 0.8);
    float st = length(vec2(atan(Nb.z, Nb.x) - seed, (lat + 0.35) * 4.0));
    return mix(c, vec3(0.7, 0.32, 0.18), (1.0 - smoothstep(0.15, 0.3, st)) * 0.8);
  }
  if (kind < 7.5) {           // ice giant: pale cyan, faint bands
    float turb = fbm(vec3(Nb.x, Nb.y * 6.0, Nb.z) + seed, oct);
    return mix(vec3(0.5, 0.72, 0.78), vec3(0.4, 0.6, 0.76), sin(Nb.y * 9.0 + turb * 2.0) * 0.5 + 0.5);
  }
  if (kind < 8.5) {           // lava world: dark crust, glowing cracks, a magma sea under its star
    float cr = 1.0 - smoothstep(0.0, 0.05, abs(vnoise3(Nb * 5.0 + seed) - 0.5));
    float sea = smoothstep(0.35, 0.85, dot(N, Ls));
    em = vec3(1.0, 0.32, 0.05) * (cr * 1.6 + sea * 1.2 * (0.6 + 0.4 * n));
    return vec3(0.05, 0.045, 0.04) * (0.8 + 0.4 * n);
  }
  // hot giant: dark, its night side glowing red
  float turb = fbm(vec3(Nb.x, Nb.y * 7.0, Nb.z) + seed, oct);
  em = vec3(0.7, 0.16, 0.05) * (0.25 + 0.3 * turb) * smoothstep(0.2, -0.4, dot(N, Ls));
  return mix(vec3(0.16, 0.1, 0.08), vec3(0.3, 0.2, 0.14), sin(Nb.y * 12.0 + turb * 3.0) * 0.5 + 0.5);
}
// the light of star k reaching P: the other worlds' shadows (soft by the star's size)
float shadowK(vec3 P, int k, int self) {
  vec3 Sv = u_S[k].xyz - P; float Ld = length(Sv); vec3 Ls = Sv / Ld; float sAng = u_S[k].w / Ld;
  float sh = 1.0;
  for (int j = 0; j < 12; j++) {
    if (j >= u_n) break;
    if (j == self) continue;
    vec3 C = u_P[j].xyz - P; float t = dot(C, Ls);
    if (t <= 0.0 || t > Ld) continue;
    float r = u_P[j].w, dp = length(C - Ls * t), w = max(t * sAng, r * 0.02);
    sh *= smoothstep(r - w, r + w, dp);
  }
  return sh;
}
void main() {
  vec3 D = normalize(v_dir);
  int tier = int(u_view.x + 0.5);
  float pxr = u_view.y, beta = u_jump.x, gam = u_jump.y;
  // ---- the sky behind (aberration: the rest-frame way the light came from; Doppler: its colour and strength)
  float c1 = dot(D, u_V);
  float c0 = (c1 - beta) / (1.0 - beta * c1);
  vec3 pp = D - u_V * c1; float lp = length(pp);
  vec3 Dr = lp > 1e-6 ? u_V * c0 + pp / lp * sqrt(max(0.0, 1.0 - c0 * c0)) : D;
  float dop = 1.0 / (gam * (1.0 - beta * c1));
  // the band turns once round the ship in the transit
  if (u_jump.z != 0.0) { float ca = cos(u_jump.z), sa = sin(u_jump.z); Dr = Dr * ca + cross(u_V, Dr) * sa + u_V * dot(u_V, Dr) * (1.0 - ca); }
  vec3 col = starGrid(Dr, 150.0, 1.0, 0.55, 1.0, pxr / dop, dop);
  if (tier >= 2) col += starGrid(Dr, 420.0, 7.0, 0.6, 0.4, pxr / dop, dop);
  float b = dot(Dr, u_galN);
  float along = dot(normalize(Dr - u_galN * b), u_galC);
  float core = exp(-(1.0 - along) * 3.0);
  float thin = exp(-b * b / (0.0045 + 0.012 * core)), wide = exp(-b * b / 0.05);
  float n1 = vnoise3(Dr * 7.0), n2 = vnoise3(Dr * 19.0 + 4.0);
  float rift = 1.0 - 0.75 * exp(-b * b / 0.0009) * smoothstep(0.2, 0.9, along) * smoothstep(0.35, 0.7, n2 + 0.2);
  float gal = (thin * (0.45 + 0.9 * n1 * n1 + 0.35 * n2) * (0.55 + 1.6 * core) + wide * 0.18) * rift;
  vec3 gcol = mix(vec3(0.72, 0.78, 1.0), vec3(1.0, 0.84, 0.66), core);
  vec3 dt = tcol(5200.0 * dop) / tcol(5200.0);
  col += gcol * dt * gal * 0.03 * clamp(dop * dop, 0.0, 6.0) * u_tun.z;   // (u-stars2: dimmed as β rises — SJ.bandK)
  if (u_neb.x > 0.5) col += nebula(Dr, tier >= 2 ? 5 : 2, pxr / dop) * clamp(dop * dop, 0.0, 6.0) * dt * u_tun.z;
  col *= u_view.w;
  // ---- u-stars2: the tunnel at the transit's peak — thin streaks round the way ahead, rushing outward, blue-white
  if (u_tun.x > 0.001) {
    vec3 ax = abs(u_V.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 e1 = normalize(cross(u_V, ax)), e2 = cross(u_V, e1);
    float th = acos(clamp(c1, -1.0, 1.0)), az = atan(dot(D, e2), dot(D, e1)) * 57.29578 / 1.5, bin = floor(az), h = hash13(vec3(bin, 3.0, 7.0));
    if (h > 0.8 && th > 0.03 && th < 1.1) {   // (run 1: 55 % of the bins at full strength read as a wall of white lines — now a sparse few, faint)
      float px = abs(fract(az) - 0.5) * 1.5 * 0.0174533 * sin(th) * pxr;
      float s = fract(log(th) * 1.2 - u_tun.y * (0.9 + 0.8 * h) + h * 7.0);
      float seg = smoothstep(0.0, 0.05, s) * (1.0 - smoothstep(0.12, 0.3, s));
      float fall = smoothstep(0.03, 0.12, th) * (1.0 - smoothstep(0.5, 1.1, th));
      col += mix(vec3(0.45, 0.6, 1.0), vec3(0.85, 0.9, 1.0), fract(h * 7.0)) * u_tun.x * seg * fall * exp(-px * px * 3.0) * (0.3 + 0.7 * fract(h * 13.0));
    }
  }
  // ---- the jump's point stars (the one left behind, the one ahead growing from a point)
  for (int k = 0; k < 2; k++) {
    if (u_pt[k].w <= 0.0) continue;
    float ck = dot(D, u_pt[k].xyz), dk = 1.0 / (gam * (1.0 - beta * ck));
    float ang = sqrt(max(0.0, 2.0 - 2.0 * ck)), r = u_pt[k].w;
    vec3 sc = tcol(u_ptc[k].w * dk) / max(0.3, dot(tcol(u_ptc[k].w), vec3(0.2126, 0.7152, 0.0722)));
    float px = ang * pxr;
    col += sc * clamp(dk * dk, 0.0, 8.0) * (exp(-px * px * 0.5) * 3.0 + (ang < r ? 30.0 : 0.0) + 0.6 * exp(-max(ang - r, 0.0) / (r * 2.0 + 0.004)));
  }
  // ---- the worlds: the nearest hit
  int hit = -1; float tHit = 1e30; vec3 halo = vec3(0.0);
  for (int j = 0; j < 12; j++) {
    if (j >= u_n) break;
    vec3 C = u_P[j].xyz; float r = u_P[j].w, tc = dot(D, C);
    if (tc <= 0.0) continue;
    vec3 cx = cross(D, C); float d2 = dot(cx, cx), r2 = r * r;
    if (d2 < r2) { float th = tc - sqrt(r2 - d2); if (th < tHit) { tHit = th; hit = j; } }
  }
  // ---- the stars: discs and glare (hidden behind a nearer world)
  vec3 glare = vec3(0.0);
  for (int k = 0; k < 2; k++) {
    float r = u_S[k].w; if (r <= 0.0) continue;
    vec3 C = u_S[k].xyz; float dC = length(C); vec3 Cn = C / dC;
    float ck = dot(D, Cn), ang = asin(min(1.0, r / dC)), a = acos(clamp(ck, -1.0, 1.0));
    float vis = 1.0;
    for (int j = 0; j < 12; j++) { if (j >= u_n) break; vec3 P = u_P[j].xyz; float tj = dot(P, Cn); if (tj <= 0.0 || tj > dC) continue; float dp = length(P - Cn * tj); vis *= smoothstep(u_P[j].w - tj * ang, u_P[j].w + tj * ang, dp); }
    float fl = 1.0 + u_Sd[k].y;
    vec3 sc = u_Sc[k].rgb;
    if (a < ang && (hit < 0 || tHit > dC)) { float x = a / ang, ld = sqrt(max(0.0, 1.0 - x * x)); col = sc * u_Sd[k].x * fl * (0.4 + 0.6 * ld); }
    float g = u_Sd[k].z * fl * vis * (0.9 * exp(-max(a - ang, 0.0) / (ang * 1.6 + 0.002)) + 0.05 * exp(-a / 0.18) + 0.004 / (1.0 + a * a * 30.0));
    glare += sc * g;
  }
  if (hit >= 0) {
    vec3 C = u_P[hit].xyz; float r = u_P[hit].w;
    vec3 P = D * tHit, N = normalize(P - C);
    vec4 kc = u_C[hit];
    vec3 Nb = rotY(N, kc.w);
    int oct = tier >= 2 ? 5 : 3;
    vec3 L0 = normalize(u_S[0].xyz - P);
    vec3 em; vec3 alb = surf(kc.x, Nb, N, kc.y, oct, L0, u_view.z, em);
    vec3 light = vec3(0.004);
    float flags = kc.z;
    bool air = mod(flags, 2.0) > 0.5, eye = mod(floor(flags / 2.0), 2.0) > 0.5;
    for (int k = 0; k < 2; k++) {
      if (u_S[k].w <= 0.0) continue;
      vec3 Ls = normalize(u_S[k].xyz - P);
      float nl = dot(N, Ls);
      float wrap = air ? smoothstep(-0.08, 0.25, nl) * max(nl, 0.0) + 0.04 * smoothstep(-0.2, 0.1, nl) : max(nl, 0.0);
      if (wrap <= 0.0) continue;
      light += u_Sc[k].rgb * u_Sc[k].w * (1.0 + u_Sd[k].y * 0.6) * wrap * shadowK(P, k, hit);
    }
    if (eye) alb = mix(alb, vec3(0.8, 0.84, 0.9), smoothstep(-0.05, -0.35, dot(N, L0)));
    vec3 c = alb * light + em;
    // the ocean's glint
    if (kc.x > 4.5 && kc.x < 5.5) { vec3 H = normalize(L0 - D); c += u_Sc[0].rgb * u_Sc[0].w * pow(max(dot(N, H), 0.0), 60.0) * 0.4 * shadowK(P, 0, hit); }
    // the air's limb: the sky's colour where the light grazes
    if (air) { float mu = max(dot(N, -D), 0.0); float lim = pow(1.0 - mu, 3.0); c += u_sky.rgb * lim * 0.6 * dot(light, vec3(0.33)); }
    col = c;
  } else {
    // the air's halo round a world
    for (int j = 0; j < 12; j++) {
      if (j >= u_n) break;
      if (mod(u_C[j].z, 2.0) < 0.5) continue;
      vec3 C = u_P[j].xyz; float r = u_P[j].w, tc = dot(D, C); if (tc <= 0.0) continue;
      float dp = length(cross(D, C)), h = (dp - r) / (r * 0.035);
      if (h > 0.0 && h < 1.0) { vec3 Np = normalize(D * tc - C); float lit = max(dot(Np, normalize(u_S[0].xyz - C)) + 0.2, 0.0); col += u_sky.rgb * (1.0 - h) * (1.0 - h) * lit * 0.5 * u_Sc[0].w; }
    }
    // far worlds as points of light
    for (int j = 0; j < 12; j++) {
      if (j >= u_n) break;
      vec3 C = u_P[j].xyz; float dC = length(C), r = u_P[j].w; if (r / dC * pxr > 1.2 || dot(D, C) <= 0.0) continue;
      float a = length(cross(D, C / dC)) * pxr;
      col += vec3(0.9, 0.88, 0.85) * exp(-a * a * 1.2) * clamp(r / dC * pxr * 3.0, 0.08, 1.0) * 0.9 * u_Sc[0].w;
    }
  }
  col += glare;
  col = mix(col, u_flood.rgb, u_flood.w);
  col *= 1.0 - u_jump.w;
  o = vec4(col, 1.0);
}`;
  SJ.FS = FS; SJ.VS = VS;
  let PROG = null;
  const program = () => {
    if (PROG !== null) return PROG;
    try { PROG = VR.GL.program(VS, FS, 'starjump', []); } catch (e) { console.error('starjump shader failed: ' + (e && e.message)); PROG = false; SJ.err = String(e && e.message || e); }
    return PROG;
  };
  // the uniforms of one frame, kept (no allocation in the draw)
  const UF = {
    view: new Float32Array(4), jump: new Float32Array(4), V: new Float32Array(3), galN: new Float32Array(3), galC: new Float32Array(3),
    neb: new Float32Array(4), nebHot: new Float32Array(3), S: new Float32Array(8), Sc: new Float32Array(8), Sd: new Float32Array(8),
    n: 0, P: new Float32Array(48), C: new Float32Array(48), pt: new Float32Array(8), ptc: new Float32Array(8), flood: new Float32Array(4), sky: new Float32Array(4),
    tun: new Float32Array([0, 0, 1, 0]),   // u-stars2
  };
  SJ.UF = UF;
  // the galaxy's plane (the same sky as Helia's, spacescene.js: our own)
  { const n = norm([0.42, 0.5, -0.76]), c0 = [0.8, -0.35, 0.2], d = dot(c0, n), c = norm(sub(c0, mul(n, d))); UF.galN.set(n); UF.galC.set(c); }
  SJ.draw = function (r) {
    const p = program(); if (!p) return;
    const gl = r.gl, u = p.u;
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
    gl.bindVertexArray(r.emptyVAO);
    gl.useProgram(p.p);
    if (u.u_invViewProj) gl.uniformMatrix4fv(u.u_invViewProj, false, r.invViewProj);
    const f4 = (k, a) => { if (u[k]) gl.uniform4fv(u[k], a); }, f3 = (k, a) => { if (u[k]) gl.uniform3fv(u[k], a); };
    f4('u_view', UF.view); f4('u_jump', UF.jump); f3('u_V', UF.V); f3('u_galN', UF.galN); f3('u_galC', UF.galC);
    f4('u_neb', UF.neb); f3('u_nebHot', UF.nebHot); f4('u_S', UF.S); f4('u_Sc', UF.Sc); f4('u_Sd', UF.Sd);
    if (u.u_n) gl.uniform1i(u.u_n, UF.n);
    f4('u_P', UF.P); f4('u_C', UF.C); f4('u_pt', UF.pt); f4('u_ptc', UF.ptc); f4('u_flood', UF.flood); f4('u_sky', UF.sky); f4('u_tun', UF.tun);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    r.stats.draws++; r.stats.tris += 1;
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
  };

  // ---------------------------------------------------------------- the scene's state
  // g.stars = { on, sys, def, N, focus, camRel, yaw, pitch, J, js, to, toDef, arr, flare, t0 }
  const lumOf = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const colOf = (hex) => { const c = G().lin(hex), l = lumOf(c) || 1; return [c[0] / l, c[1] / l, c[2] / l]; };
  SJ.worldT = (g) => (VR.Universe ? VR.Universe.worldSeconds(g.env.day | 0, g.env.ticks) : 0);
  function hud(g, on) { const h = document.getElementById('hud'); if (h) h.style.visibility = on ? 'visible' : 'hidden'; }
  let hudEl = null;
  function hudLine(g, text) {
    if (!hudEl) { hudEl = document.createElement('div'); hudEl.id = 'starHud'; hudEl.style.cssText = 'position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:30;color:#e8f2ff;font:600 15px/1.35 system-ui,sans-serif;text-shadow:0 1px 3px #000c;background:#0a1020a8;border:1px solid #9cc4ff40;border-radius:10px;padding:8px 14px;pointer-events:none;text-align:center;max-width:80vw;white-space:pre-line'; document.body.appendChild(hudEl); }
    hudEl.style.display = text && !(g && g.hideHud) ? '' : 'none';
    if (text && hudEl.textContent !== text) hudEl.textContent = text;
  }
  SJ.hudLine = hudLine;
  // into a system (the arrival, or straight in: /stern, the tests)
  SJ.enter = function (g, idx, o) {
    o = o || {};
    const N = SJ.hood(g), def = G().system(N, idx);
    if (!def || idx === 0) return false;
    const t = SJ.worldT(g), arr = SJ.arrival(def, t, o);
    const S = g.stars || (g.stars = {});
    Object.assign(S, { on: true, sys: idx, def, N, focus: arr.focus, camRel: arr.rel, t0: t, J: null, toDef: null, flare: 0, flareT: 20 + 30 * Math.random(), flareSaid: !!S.flareSaid });
    const yp = SJ.yawPitch(arr.look); S.yaw = yp.yaw; S.pitch = yp.pitch;
    const v = visited(g); if (!v.includes(idx)) v.push(idx);
    g.meta.stars.at = idx;
    hud(g, false);
    if (g.renderer) g.renderer.tsrReset = true;
    if (!o.quiet && g.ui && g.ui.chatLine) g.ui.chatLine(T('g.stars.arrive', { name: def.name.de === def.name.en ? def.name.de : SJ.nameOf(def.name), type: def.star.type, body: SJ.nameOf(arr.focus.name) }), '#9affd8');
    return true;
  };
  SJ.leave = function (g) {
    const S = g.stars; if (!S) return;
    S.on = false; S.J = null;
    hudLine(g, '');
    hud(g, !g.hideHud);
    if (g.renderer) g.renderer.tsrReset = true;
  };
  // the jump to a system (or home: idx 0)
  SJ.jump = function (g, idx, o) {
    o = o || {};
    const why = o.force ? null : SJ.canJump(g);
    if (why) { if (g.ui && g.ui.chatLine) g.ui.chatLine(T(why), '#ffcf8a'); return false; }
    const N = SJ.hood(g), from = SJ.here(g), A = N.list[from], B = N.list[idx];
    if (!B || idx === from) return false;
    const ly = Math.hypot(A.p[0] - B.p[0], A.p[1] - B.p[1], A.p[2] - B.p[2]);
    if (idx !== 0 && !o.force && ly > SJ.range(g)) { if (g.ui && g.ui.chatLine) g.ui.chatLine(T('g.stars.range', { ly: Math.round(ly), max: SJ.range(g) }), '#ffcf8a'); return false; }
    const S = g.stars || (g.stars = { on: false, sys: 0 });
    const t = SJ.worldT(g);
    // the start: in another system its own view; from Helia's space the ship's camera's way
    let yaw = S.yaw || 0, pitch = S.pitch || 0;
    if (!S.on) { const c = g.cam || {}; yaw = c.yaw || 0; pitch = c.pitch || 0; S.def = null; S.sys = 0; S.N = N; }
    // the way: toward where the target star will stand at the arrival (no cut when we get there)
    const toDef = idx === 0 ? null : G().system(N, idx), arr = toDef ? SJ.arrival(toDef, t) : null;
    const V = arr ? arr.toStar : SJ.fwd(yaw, pitch);
    Object.assign(S, { on: true, J: SJ.plan(ly), js: 0, to: idx, toDef, arr, V, yaw0: yaw, pitch0: pitch, yaw, pitch, fromCol: A.color, fromT: A.T, toCol: B.color, toT: B.T, toR: B.R, ly, home: idx === 0, fade: !!(g.settings.jumpFade || g.settings.reduceMotion || g.settings.lessMotion) });
    hud(g, false);
    if (g.audio && g.audio.play) g.audio.play('boost');
    if (g.ui && g.ui.chatLine) g.ui.chatLine(T(idx === 0 ? 'g.stars.homeGo' : 'g.stars.jumpGo', { name: B.name, ly: ly.toFixed(1) }), '#9affd8');
    SJ.last = { from, to: idx, ly, plan: S.J, t0: performance.now() };
    return true;
  };
  // the end of a jump: into the system, or home (Helia's space → the home jump to the apron; elsewhere Heimkehr)
  function arrived(g) {
    const S = g.stars, to = S.to;
    if (SJ.last) SJ.last.wall = (performance.now() - SJ.last.t0) / 1000;
    S.J = null;
    if (to === 0) {
      SJ.leave(g); S.sys = 0; if (g.meta.stars) g.meta.stars.at = 0;
      g.ui.chatLine(T('g.stars.homeArrive'), '#9affd8');
      const SF = VR.SpaceFlight;
      if (SF && SF.inSpace && SF.inSpace(g) && SF.homeJump) SF.homeJump(g.flight);
      else if (VR.Travel && VR.Travel.away(g)) VR.Travel.goHome(g);
      else if (VR.Travel && g.player) { const tg = VR.Travel.homeTarget(g); if (tg && tg.pos) g.player.safeTeleport(tg.pos[0], tg.pos[1], tg.pos[2], { bed: tg.bed || null }); }
      return;
    }
    SJ.enter(g, to, { quiet: false });
  }
  // V: Landen — the focus world's dim (an existing world kind with this star's light)
  SJ.land = function (g) {
    const S = g.stars; if (!S || !S.on || S.J) return false;
    const f = S.focus;
    if (!f || !f.landable || !f.dim) { g.ui.chatLine(T('g.stars.noLand', { name: SJ.nameOf(f && f.name) }), '#ffcf8a'); return false; }
    if (!VR.Travel || !VR.DimReg.has(f.dim)) return false;
    const D = VR.DimReg.get(f.dim); D.name = ['g.dim.exo.' + S.sys, SJ.nameOf(f.name), SJ.nameOf(f.name)];
    const why = VR.Travel.canGo(g, f.dim);
    if (why) { g.ui.chatLine(T(why), '#ffcf8a'); return false; }
    SJ.leave(g);
    g.ui.chatLine(T('g.stars.landGo', { name: SJ.nameOf(f.name) }), '#9affd8');
    VR.Travel.go(g, { dim: f.dim, via: 'cmd' });
    return true;
  };
  // Tab: the next world of the system as the focus (the camera moves into its orbit)
  SJ.nextFocus = function (g, step) {
    const S = g.stars; if (!S || !S.on || S.J || !S.def) return;
    const pl = S.def.bodies.filter(b => b.planet), i = pl.indexOf(S.focus), f = pl[(i + (step || 1) + pl.length) % pl.length];
    const arr = SJ.arrival(S.def, SJ.worldT(g), { focus: f.id });
    S.focus = f; S.camRel = arr.rel; const yp = SJ.yawPitch(arr.look); S.yaw = yp.yaw; S.pitch = yp.pitch;
  };

  // ---------------------------------------------------------------- the frame
  const ES = {};
  const scratchPos = {};
  SJ.setup = function (g, dt) {
    const S = g.stars, r = g.renderer, tier = SJ.tier(g), t = SJ.worldT(g);
    const pxr = (r ? r.H : 720) / ((g.settings.fov || 75) * Math.PI / 180);
    UF.view[0] = tier; UF.view[1] = pxr; UF.view[2] = g.time || 0; UF.view[3] = 1;
    UF.jump[0] = 0; UF.jump[1] = 1; UF.jump[2] = 0; UF.jump[3] = 0;
    UF.pt[3] = 0; UF.pt[7] = 0; UF.flood[3] = 0; UF.tun[0] = 0; UF.tun[2] = 1;   // (u-stars2)
    let sysK = 1, def = S.def;
    if (S.J) {
      S.js += dt;
      const j = SJ.at(S.J, S.js, S.jst || (S.jst = {}));
      // the nose comes round to the way in the first 1.4 s
      const k = sstep(S.js / 1.4), yp = SJ.yawPitch(S.V);
      let dy = yp.yaw - S.yaw0; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      if (!S.mouseTook) { S.yaw = S.yaw0 + dy * k; S.pitch = S.pitch0 + (yp.pitch - S.pitch0) * k; }
      const bv = S.fade ? 0 : j.beta;
      UF.jump[0] = bv; UF.jump[1] = 1 / Math.sqrt(1 - bv * bv); UF.jump[2] = S.fade ? 0 : j.band;
      UF.V.set(S.V);
      UF.tun[0] = S.fade ? 0 : SJ.tunnel(j) * 0.8; UF.tun[1] = S.js; UF.tun[2] = S.fade ? 1 : SJ.bandK(bv);   // u-stars2: the tunnel only at the peak, the band dimmed
      if (S.fade) UF.jump[3] = j.phase === 'transit' ? 1 : j.phase === 'spin' ? sstep((j.u - 0.4) / 0.6) : 1 - sstep(j.u / 0.7);
      // the system left fades in the spin-up; the target's comes in with the arrival
      if (j.phase === 'arrive' && S.toDef && S.def !== S.toDef) { S.def = S.toDef; S.sys = S.to; S.focus = S.arr.focus; S.camRel = S.arr.rel; }
      def = S.def;
      sysK = j.phase === 'spin' ? 1 - sstep(j.u / 0.8) : j.phase === 'transit' ? 0 : sstep((j.u - 0.1) / 0.7);
      if (S.home && j.phase === 'arrive') sysK = 0;
      // the star left behind, the star ahead (it grows from a point: the way left in light years, then the arrival's)
      const dArr = S.arr ? len(sub(SJ.place(S.toDef, t)[S.toDef.bodies[0].id], S.arr.cam ? add(SJ.place(S.toDef, t)[S.arr.focus.id], S.arr.rel) : v3())) : 1e12;
      const dNow = j.phase === 'arrive' ? dArr : Math.exp(Math.log(S.ly * LY / L64) + (Math.log(Math.max(dArr, 1)) - Math.log(S.ly * LY / L64)) * j.travelled);
      UF.pt[0] = S.V[0]; UF.pt[1] = S.V[1]; UF.pt[2] = S.V[2]; UF.pt[3] = j.phase === 'arrive' && !S.home ? 0 : Math.max(1e-5, (S.toR * R_SUN / L64) / dNow);
      UF.ptc[0] = 1; UF.ptc[1] = 1; UF.ptc[2] = 1; UF.ptc[3] = S.toT;
      UF.pt[4] = -S.V[0]; UF.pt[5] = -S.V[1]; UF.pt[6] = -S.V[2]; UF.pt[7] = j.phase === 'spin' && j.u < 0.15 ? 0 : 1e-5 * (1 - j.travelled * 0.9);
      UF.ptc[7] = S.fromT;
      // the new star's colour floods the cockpit as we arrive (and a soft flash masks the first frame from Helia)
      const fc = colOf(j.phase === 'arrive' ? S.toCol : S.fromCol);
      const fk = j.phase === 'arrive' ? 0.35 * Math.exp(-Math.pow((j.u - 0.55) / 0.25, 2)) : S.sys === 0 && j.phase === 'spin' ? 0.5 * (1 - sstep(S.js / 0.6)) : 0;
      UF.flood[0] = fc[0] * 0.8; UF.flood[1] = fc[1] * 0.8; UF.flood[2] = fc[2] * 0.8; UF.flood[3] = S.fade ? 0 : fk;
      if (j.done) { arrived(g); if (!g.stars.on) return null; def = S.def; sysK = 1; }
    } else UF.V.set([0, 0, -1]);
    // the nebula: inside one of the four
    const sysRec = S.N && S.N.list[S.sys], inNeb = !!(sysRec && sysRec.neb >= 0 && def);
    UF.neb[0] = inNeb ? 1 : 0;
    if (inNeb) {
      const nb = S.N.nebs[sysRec.neb], tr = !!g.settings.nebulaTrue;
      UF.neb[1] = (tr ? 0.05 : 1) * sysK; UF.neb[2] = (nb.seed % 997) / 37; UF.neb[3] = tr ? 0.5 : 0.85;
    }
    // the system's bodies round the camera (units: the focus' radius)
    UF.S[3] = 0; UF.S[7] = 0; UF.n = 0; UF.sky[0] = UF.sky[1] = UF.sky[2] = 0;
    if (def && sysK > 0.001) {
      const P = SJ.place(def, t), f = S.focus, Rf = f.R / L64, cam = add(P[f.id], S.camRel), U = 1 / Rf;
      scratchPos.cam = cam;
      const stars = def.bodies.filter(b => b.kind === 'star');
      const s0 = stars[0], d0 = len(sub(P[s0.id], P[f.id]));
      const L0 = def.star.L, L1 = def.star2 ? def.star2.L : 0;
      stars.forEach((s, k) => {
        const rel = sub(P[s.id], cam), c = colOf(s.color), Lk = k ? L1 : L0, dk = len(sub(P[s.id], P[f.id]));
        UF.S[k * 4] = rel[0] * U; UF.S[k * 4 + 1] = rel[1] * U; UF.S[k * 4 + 2] = rel[2] * U; UF.S[k * 4 + 3] = s.R / L64 * U;
        UF.Sc[k * 4] = c[0]; UF.Sc[k * 4 + 1] = c[1]; UF.Sc[k * 4 + 2] = c[2];
        UF.Sc[k * 4 + 3] = clamp((Lk / L0) * Math.pow(d0 / dk, 2), 0, 4) * 1.15 * sysK;
        UF.Sd[k * 4] = 60 * sysK; UF.Sd[k * 4 + 1] = k === 0 ? S.flare || 0 : 0; UF.Sd[k * 4 + 2] = clamp(0.6 * Math.sqrt(Lk / L0), 0.05, 1) * sysK;
      });
      if (inNeb) { const h = norm(sub(P[s0.id], cam)); UF.nebHot.set(norm([h[0] + 0.6, h[1] + 0.5, h[2] - 0.3])); }
      let n = 0;
      // u-stars2: the focus and its moons first — a system of 8 planets and their moons has more than 12 bodies, and
      // u-stars' list order dropped the focus' moon (binary_two_shadows.png showed no shadow)
      if (S._ordF !== f || S._ordD !== def) { S._ordF = f; S._ordD = def; S._ord = def.bodies.filter(b => b === f || b.parent === f.id).concat(def.bodies.filter(b => b !== f && b.parent !== f.id)); }
      for (const b of S._ord) {
        if (b.kind === 'star' || n >= 12) continue;
        const rel = sub(P[b.id], cam), R = b.R / L64;
        UF.P[n * 4] = rel[0] * U; UF.P[n * 4 + 1] = rel[1] * U; UF.P[n * 4 + 2] = rel[2] * U; UF.P[n * 4 + 3] = R * U;
        const kind = b.cls === 'lava' ? KIND.lava : b.cls === 'hot' ? KIND.hot : KIND[b.kind] || 1;
        const air = b.base === 'aqua' || b.base === 'ocker' || b.kind === 'giant' || b.kind === 'icegiant' || b.cls === 'hot';
        const spin = b.spin && b.spin.T ? (2 * Math.PI * t / b.spin.T) % (2 * Math.PI) : 0;
        UF.C[n * 4] = kind; UF.C[n * 4 + 1] = (G().hash(S.sys, n, 3, 9) % 1000) / 61; UF.C[n * 4 + 2] = (air ? 1 : 0) + (b.cls === 'eye' ? 2 : 0); UF.C[n * 4 + 3] = spin;
        n++;
      }
      UF.n = n;
      const sky = G().skyTint(def.star.T); UF.sky[0] = Math.pow(sky[0], 2.2); UF.sky[1] = Math.pow(sky[1], 2.2); UF.sky[2] = Math.pow(sky[2], 2.2);
      // a red dwarf's flares (R§6.3): sudden, brief, harmless — spectacle
      if (def.star.T < 3900 && !S.J) {
        S.flareT -= dt;
        if (S.flareT <= 0) { S.flareT = 25 + 45 * Math.random(); S.flareA = 2.5 + 2 * Math.random(); S.flareS = 0; if (!S.flareSaid && g.ui) { S.flareSaid = true; g.ui.chatLine(T('g.stars.flare'), '#ffb38a'); } }
        if (S.flareS !== undefined) { S.flareS += dt; S.flare = S.flareA * Math.min(1, S.flareS / 0.25) * Math.exp(-Math.max(0, S.flareS - 0.25) / 1.6); if (S.flareS > 12) { S.flare = 0; S.flareS = undefined; } }
      }
    }
    return true;
  };
  SJ.frame = function (g, dt) {
    const S = g.stars, r = g.renderer, i = g.input, ui = g.ui;
    g.time += dt;
    if (!ui.typing) {
      if (i.hit('Escape')) { if (VR.StarMap && VR.StarMap.isOpen()) VR.StarMap.close(g); else if (ui.screen) ui.resume(); else ui.pause(); }
      else if (!ui.screen) {
        if (i.hit('KeyT') || i.hit('Enter')) ui.openChat(''); else if (i.hit('Slash')) ui.openChat('/');
        if (i.hit('F2') && g.screenshot) g.screenshot();
        if (i.hit('KeyO') && VR.StarMap) VR.StarMap.open(g);
        if (i.hit('KeyV') && !S.J) SJ.land(g);
        if (i.hit('Tab') && !S.J) SJ.nextFocus(g, 1);
        if (i.hit('KeyH') && !S.J) SJ.jump(g, 0);
      }
    }
    if (!ui.screen && !ui.typing && i.mouse) { const k = i.sensitivity || 0.0022; if (i.mouse.dx || i.mouse.dy) S.mouseTook = !!S.J; S.yaw -= i.mouse.dx * k; S.pitch = clamp(S.pitch - i.mouse.dy * k * (i.invertY ? -1 : 1), -1.5, 1.5); }
    g.envFor([0, 64, 0], dt, { freezeTime: g.zenFreezeTime, freezeWeather: g.zenFreezeWeather });
    if (g.pool) g.pool.pump();
    if (!SJ.setup(g, dt)) return;
    const Ssc = VR.SpaceScene && VR.SpaceScene.env;
    if (Ssc) Object.assign(ES, Ssc);
    ES.fog = [1e7, 2e7, 0, 0]; ES.fogColor = [0, 0, 0]; ES.exposure = 1.8; ES.bloomStrength = 0.07; ES.bloomThreshold = 1.4; ES.time = g.env.anim || g.time;
    const cam = S.cam || (S.cam = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, fov: 1.3, far: 100 });
    cam.yaw = S.yaw; cam.pitch = S.pitch; cam.fov = (g.settings.fov || 75) * Math.PI / 180;
    g.cam = cam;
    r.render({ cam, world: null, env: ES, noSky: true, drawOpaque: SJ.draw });
    // the line at the top: where we are, what the keys do
    if ((S.hudT = (S.hudT || 0) - dt) <= 0) {
      S.hudT = 0.25;
      if (S.J) hudLine(g, T(S.home ? 'g.stars.hudHome' : 'g.stars.hudJump', { name: S.N.list[S.to].name, ly: S.ly.toFixed(1), s: Math.max(0, S.J.dur - S.js).toFixed(0) }));
      else if (S.def) hudLine(g, T('g.stars.hud', { name: SJ.nameOf(S.def.name), type: S.def.star.type, body: SJ.nameOf(S.focus.name), cls: T('g.stars.cls.' + S.focus.cls), land: S.focus.landable ? T('g.stars.hudLand') : '' }));
    }
    if (g.audio && g.audio.updateMusic) g.audio.updateMusic(dt, { night: 1, cave: false, danger: false, space: true, festival: false, enabled: true, day: g.env.day, mobs: null, agents: null });
    S.frames = (S.frames || 0) + 1;
  };
  // the play frame: the star map first (it stops the 3-D frame), then the scene of another system or the jump
  const origPlay = Game.prototype.playFrame;
  Game.prototype.playFrame = function (dt) {
    if (VR.StarMap && VR.StarMap.isOpen() && VR.StarMap.frame(this, dt)) return;
    if (this.stars && this.stars.on) return SJ.frame(this, dt);
    return origPlay.call(this, dt);
  };
  const origTear = Game.prototype.teardownWorld;
  Game.prototype.teardownWorld = function () { if (this.stars && this.stars.on) SJ.leave(this); if (VR.StarMap && VR.StarMap.isOpen()) VR.StarMap.close(this, true); return origTear.apply(this, arguments); };
  // Heimkehr (🏠, /home) from another system: the jump home first
  const origHome = Game.prototype.goHome;
  Game.prototype.goHome = function () {
    if (this.stars && this.stars.on) { if (!this.stars.J) SJ.jump(this, 0, { force: true }); return; }
    return origHome.apply(this, arguments);
  };
  // /sterne opens the map; /stern <name | number> jumps (in range; with cheats straight from anywhere)
  const origChat = Game.prototype.chat;
  Game.prototype.chat = function (text) {
    const m = /^\/(sterne|starmap|stern|star)\b\s*(.*)$/i.exec(String(text || ''));
    if (!m) return origChat.apply(this, arguments);
    const w = m[2].trim();
    if (/^(sterne|starmap)$/i.test(m[1]) || !w) { if (VR.StarMap) VR.StarMap.open(this); return; }
    const N = SJ.hood(this), idx = /^\d+$/.test(w) ? +w : (N.list.find(s => s.name.toLowerCase() === w.toLowerCase()) || {}).idx;
    if (!(idx >= 0) || !N.list[idx]) { this.ui.chatLine(T('g.stars.unknown', { name: w }), '#ff8a8a'); return; }
    const cheat = this.meta && (this.meta.cheats || (this.player && this.player.mode === 'creative'));
    if (cheat && SJ.canJump(this)) { if (idx) { SJ.enter(this, idx); } return; }
    SJ.jump(this, idx);
  };

  // ---------------------------------------------------------------- the landed world under another star
  // the kind's own sky (bodysky.js) with this star's colour and size, its sky tint (R§7), no Helia family overhead
  const D = () => VR.DimReg;
  const exoOf = (dim) => { const d = D() && D().get(dim); return d && d.exo ? d.exo : null; };
  SJ.exoStar = function (dim) {
    const e = exoOf(dim); if (!e) return null;
    const g = VR.game, N = SJ.hood(g), def = G().system(N, e.sys); if (!def) return null;
    const pl = def.bodies.find(b => b.id === def.id + 'p' + e.p);
    return { def, pl, e };
  };
  if (VR.Universe) {
    const base = VR.Universe.localSky;
    VR.Universe.localSky = function (dim, pos, t, out) { const e = exoOf(dim); return base.call(this, e ? e.kind : dim, pos, t, out); };
  }
  const wrapBS = () => {
    const BS = VR.BodySky; if (!BS || BS.starsWrapped) return;
    BS.starsWrapped = true;
    const base = BS.compute;
    BS.compute = function (dim, eye, tt, o) {
      const r = base.call(this, dim, eye, tt, o);
      const x = r && SJ.exoStar(dim);
      if (!x) return r;
      const star = x.def.star, tint = colOf(star.color), Hs = colOf('#dddeff'), k = [0, 1, 2].map(i => Math.pow(tint[i] / Hs[i], 0.6));   // (the eye adapts part of the way, R§7)
      const g = VR.game, S = g && g.stars, fl = S && S.flareLand ? S.flareLand : 0;
      const m = (a) => a ? a.map((v, i) => v * k[i % 3] * (1 + fl)) : a;
      r.light.sunColor = m(r.light.sunColor); r.light.ambSky = m(r.light.ambSky); r.light.far = m(r.light.far);
      r.light.moonColor = [0, 0, 0];
      r.sky.sunCol = [tint[0] * 0.95, tint[1] * 0.95, tint[2] * 0.95];
      const a = x.pl ? x.pl.orbit.a : AU, ang = Math.min(0.3, star.R * R_SUN / a);
      r.sky.sun = [r.sky.sun[0], r.sky.sun[1], r.sky.sun[2], ang];
      r.sky.par = [0, -1, 0, 1e9]; r.sky.hz = [0, 1, 0, 0];
      if (r.sky.B) r.sky.B.fill(0); if (r.sky.Bc) r.sky.Bc.fill(0);
      const st = G().skyTint(star.T), sh = G().skyTint(6550), sk = st.map((v, i) => Math.pow(v / sh[i], 2.2));
      if (r.sky.air3) r.sky.air3 = r.sky.air3.map((v, i) => v * sk[i % 3] * k[i % 3]);
      if (r.sky.airB) r.sky.airB = r.sky.airB.map((v, i) => v * sk[i % 3] * k[i % 3]);
      if (r.sky.airK) r.sky.airK = [r.sky.airK[0], r.sky.airK[1], 0, r.sky.airK[3]];   // (the three stops, tinted, not Helia's LUT)
      r.exo = { sys: x.e.sys, T: star.T, ang };
      return r;
    };
  };
  wrapBS();
  SJ.wrapBS = wrapBS;
  // red dwarf flares on the ground too (the light jumps, a chat line the first time)
  const origEnvFor = Game.prototype.envFor;
  Game.prototype.envFor = function () {
    const E = origEnvFor.apply(this, arguments);
    const x = this.dim && this.dim[0] === 'x' ? SJ.exoStar(this.dim) : null;
    if (x && x.def.star.T < 3900) {
      const S = this.stars || (this.stars = { on: false, sys: 0 }), dt = arguments[1] || 0.016;
      S.flareLT = (S.flareLT === undefined ? 30 : S.flareLT) - dt;
      if (S.flareLT <= 0) { S.flareLT = 40 + 60 * Math.random(); S.flareLS = 0; S.flareLA = 0.8 + 0.6 * Math.random(); if (!S.flareSaid && this.ui) { S.flareSaid = true; this.ui.chatLine(T('g.stars.flare'), '#ffb38a'); } }
      if (S.flareLS !== undefined) { S.flareLS += dt; S.flareLand = S.flareLA * Math.min(1, S.flareLS / 0.3) * Math.exp(-Math.max(0, S.flareLS - 0.3) / 2.5); if (S.flareLS > 15) { S.flareLand = 0; S.flareLS = undefined; } }
    }
    return E;
  };

  // ---------------------------------------------------------------- what the tests read
  SJ.debug = {
    state: (g) => { const S = g.stars || {}; return { on: !!S.on, sys: S.sys, name: S.def ? S.def.name.de : null, focus: S.focus ? S.focus.id : null, jumping: !!S.J, js: S.js, dur: S.J ? S.J.dur : null, err: SJ.err || null, n: UF.n, last: SJ.last || null }; },
    // a moon of the focus between it and its stars (the binary's two shadows on the lit side)
    alignMoon: (g, deg) => {
      const S = g.stars; if (!S || !S.def) return false;
      const moon = S.def.bodies.find(b => b.parent === S.focus.id); if (!moon) return false;
      const t = SJ.worldT(g); moon.phase = 0;
      const P = SJ.place(S.def, t), pF = P[S.focus.id], sDir = norm(sub(P[S.def.bodies[0].id], pF)), mDir = norm(sub(P[moon.id], pF));
      // u-stars2: the moon between its star and a lit point the camera sees (the shadow falls on the visible, lit disc —
      // u-stars' fixed angle put it off the disc); deg turns that point a little round the disc
      const R = S.focus.R / L64, am = moon.orbit.a / L64, cDir = norm(S.camRel);
      const Qd = rotY(norm(add(mul(sDir, 0.55), mul(cDir, 0.45))), (deg || 0) * Math.PI / 180), Q = mul(Qd, R * 1.02), qs = dot(Q, sDir);
      const sk = -qs + Math.sqrt(Math.max(0, qs * qs - dot(Q, Q) + am * am));
      const want = norm(add(Q, mul(sDir, sk)));
      moon.phase = Math.atan2(want[2], want[0]) - Math.atan2(mDir[2], mDir[0]);
      return moon.id;
    },
    look: (g, toward, k) => { const S = g.stars; const P = SJ.place(S.def, SJ.worldT(g)), cam = add(P[S.focus.id], S.camRel); const d = toward === 'star' ? norm(sub(P[S.def.bodies[0].id], cam)) : toward === 'focus' ? norm(sub(P[S.focus.id], cam)) : null; if (!d) return; const f = SJ.fwd(S.yaw, S.pitch), m = norm(add(mul(f, 1 - (k || 1)), mul(d, k || 1))); const yp = SJ.yawPitch(m); S.yaw = yp.yaw; S.pitch = yp.pitch; },
  };
})(VR);

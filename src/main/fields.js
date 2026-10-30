// ============================================================================
// u-fields · VR.Fields — Amarant's ring as the honest dense field, the giant's cloud tops, the Trümmerschwarm and the
// small bodies' anchor boots (plan docs/superpowers/plans/2026-10-30-u-fields.md; U§4.3, §5.7, §7.1–§7.3, §11;
// REFERENCE §1.6–§1.7, §4.2).
//   · pure part (node: test/fields.js) above the line: the chunks by tier, the density law, the sizes, the shell they
//     fill, the swarm (gen_rubble.js), the boots, the cloud tops' floor, the codex line
//   · the GL part below it: the ring's ice chunks (GPU-hashed instances — no per-frame buffers), the 10-m sheet as a lit
//     slab, the cloud-top decks, the swarm's bodies; drawn from the space scene's draw list (spacescene.js hooks)
//   · the game's glue: /raum ring · cassini · ringschatten · wolken · schwarm, the boots (B, the suit switch), drifting
//     off and Funke's tow back, the rubble world's light (Helia at 3.4 AU turning with the body's spin)
// ============================================================================
(function (VR) {
  'use strict';
  const F = VR.Fields = {};
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const D2R = Math.PI / 180, TAU = Math.PI * 2;

  // ---------------------------------------------------------------- the ring (U§7.1, R§4.2)
  F.COUNT = [300, 1000, 3000, 10000];                  // chunks drawn by spaceDetail tier (Very Low … High)
  F.count = (tier) => F.COUNT[clamp(tier | 0, 0, 3)];
  F.H = 10;                                            // the sheet's thickness, m
  F.DMIN = 0.3; F.DMAX = 4; F.Q = 3;                   // chunk diameters 0.3–4 m, n(D) ∝ D^−q
  // a diameter from u ∈ [0, 1) on the power law q (inverse CDF)
  F.sizeAt = (u) => { const a = Math.pow(F.DMIN, 1 - F.Q), b = Math.pow(F.DMAX, 1 - F.Q); return Math.pow(a + u * (b - a), 1 / (1 - F.Q)); };
  // the mean cross-section π⟨r²⟩ of the law (numerically, once)
  let SIG = 0;
  F.sigma = () => { if (SIG) return SIG; let s = 0; const N = 4000; for (let k = 0; k < N; k++) { const d = F.sizeAt((k + 0.5) / N); s += Math.PI * d * d / 4; } return (SIG = s / N); };
  // the density law: τ = n·σ̄·H → chunks per m³
  F.density = (tau) => Math.max(0, tau) / (F.sigma() * F.H);
  // the spacing of equal chunks of diameter d at optical depth τ (U§7.1: τ 1, 1 m → 2.0 m)
  F.spacingFor = (tau, d) => Math.pow(tau / (Math.PI * d * d / 4 * F.H), -1 / 3);
  // the shell the tier's chunks fill round the eye (a disc of the sheet; 15–40 m, U§7.1)
  F.radius = (tier, tau) => clamp(Math.sqrt(F.count(tier) / (Math.PI * F.H * Math.max(1e-3, F.density(tau)))), 15, 40);
  F.tauAt = (rR) => (VR.BodyTex && VR.BodyTex.ringTau ? VR.BodyTex.ringTau(rR) : 0);
  F.ALBEDO = 0.04;                                     // the rubble bodies (R§1.7)

  // ---------------------------------------------------------------- the swarm (U§7.2)
  F.COMPRESSION = 1e5;
  F.swarm = () => VR.Rubble.swarm();

  // ---------------------------------------------------------------- the anchor boots (U§4.3)
  F.BOOTS = 0.35;                                      // m/s²
  F.JUMP_V = 9.1;                                      // the genre's jump (player.js)
  F.bootsGame = () => 30 * F.BOOTS / 9.81;
  F.jumpHeight = (g) => F.JUMP_V * F.JUMP_V / (2 * g);
  F.airTime = (g) => 2 * F.JUMP_V / g;
  // boots off: the body's own pull as a share of the dim's (boots') gravity
  F.offShare = (dim) => { const d = VR.DimReg && VR.DimReg.get(dim); return d && d.gReal ? d.gReal / d.g : 1; };

  // ---------------------------------------------------------------- the cloud tops (U§5.7)
  F.FLOOR = 1000;                                      // m over the cloud tops: below it the autopilot pulls up
  F.pullUp = (alt) => alt < F.FLOOR;
  F.FLY_V = 5744;                                      // the low orbit over the cloud tops, m/s (U§3)
  F.FLY_H = 15000;                                     // the flyover's height in the upper haze

  F.KEYS = ['g.fields.codex', 'g.fields.boots.on', 'g.fields.boots.off', 'g.fields.drift', 'g.fields.tow', 'g.fields.hello', 'g.fields.hello.m', 'g.fields.ring', 'g.fields.pull',
    'g.space.place.ring', 'g.space.place.cassini', 'g.space.place.ringschatten', 'g.space.place.wolken', 'g.space.place.schwarm', 'g.set.fields', 'g.set.fields.tip'];

  // ================================================================ GL and the game (the page only)
  if (typeof window === 'undefined') return;
  const V = () => VR.SpaceScene.v3;
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const len = (a) => Math.hypot(a[0], a[1], a[2]);
  const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const perp = (v, n) => norm(sub(v, mul(n, dot(v, n))));
  const sstep = (a, b, x) => { let t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
  F.on = () => { const g = VR.game, st = g && g.settings; return !(st && st.fields === false); };
  F.stats = { chunks: 0, steps: 0, decks: 0, rocks: 0, where: null };

  // ---------------------------------------------------------------- shaders
  const HASH = `
uvec3 pcg3(uvec3 v) { v = v * 1664525u + 1013904223u; v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y; v ^= v >> 16u; v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y; return v; }
vec3 h3(vec3 c) { return vec3(pcg3(uvec3(ivec3(floor(c)) + 16777216))) * (1.0 / 4294967295.0); }
float hash13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vn2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y); }
float vn3(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), f.x), mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x), f.y), mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x), mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
`;
  // an icosahedron, 20 faces as 60 vertices (gl_VertexID), each vertex its corner index for a shared displacement
  const ICO = `
const float IA = 0.5257311, IB = 0.8506508;
const vec3 IV[12] = vec3[12](vec3(-IA, IB, 0), vec3(IA, IB, 0), vec3(-IA, -IB, 0), vec3(IA, -IB, 0), vec3(0, -IA, IB), vec3(0, IA, IB), vec3(0, -IA, -IB), vec3(0, IA, -IB), vec3(IB, 0, -IA), vec3(IB, 0, IA), vec3(-IB, 0, -IA), vec3(-IB, 0, IA));
const int IF[60] = int[60](0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11, 1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8, 3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9, 4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1);
mat3 rotAxis(vec3 k, float a) { float c = cos(a), s = sin(a), t = 1.0 - c; return mat3(t * k.x * k.x + c, t * k.x * k.y + s * k.z, t * k.x * k.z - s * k.y, t * k.x * k.y - s * k.z, t * k.y * k.y + c, t * k.y * k.z + s * k.x, t * k.x * k.z + s * k.y, t * k.y * k.z - s * k.x, t * k.z * k.z + c); }
`;
  // the ring's ice chunks (and the swarm's drifting gravel): one cell of a lattice an instance, the lattice in the ring's
  // co-orbiting frame (radial, along the orbit, normal), the camera's cell and its place in it from the CPU in doubles
  const CHUNK_VS = `
uniform mat4 u_viewProj;
uniform vec3 u_er, u_et, u_en;     // the lattice's axes (scene)
uniform vec4 u_cell;               // cell size, horizontal cells S, normal cells NW, presence p
uniform vec3 u_camCell;            // the camera's cell index (u, v), the slab's first normal cell
uniform vec3 u_camIn;              // the camera's place: u, v in its cell, its height over the sheet's middle (m)
uniform vec4 u_size;               // diameter min, max, power q, the shell radius
uniform vec4 u_sheet;              // half thickness (0: no sheet, the lattice round the camera), sun normal comp, τ/H, time
uniform vec3 u_sunDir;
${HASH}
${ICO}
out vec3 v_p;
out vec3 v_alb;
out float v_sunT;
out float v_glow;
void main() {
  int i = gl_InstanceID, S = int(u_cell.y), NW = int(u_cell.z);
  int iw = i % NW, t = i / NW, iu = t % S - S / 2, iv = t / S - S / 2;
  float c = u_cell.x;
  vec3 cid = vec3(u_camCell.x + float(iu), u_camCell.y + float(iv), u_camCell.z + float(iw));
  vec3 h = h3(cid + vec3(0.0, 0.0, 977.0)), k = h3(cid + vec3(13.0, 7.0, 3.0));
  gl_Position = vec4(0.0, 0.0, -2.0, 1.0);
  if (h.x > u_cell.w) return;
  // the size on the power law (inverse CDF)
  float q1 = 1.0 - u_size.z, a = pow(u_size.x, q1), b = pow(u_size.y, q1);
  float d = pow(a + h.y * (b - a), 1.0 / q1);
  vec3 rel = vec3((float(iu) + h.z) * c - u_camIn.x, (float(iv) + k.x) * c - u_camIn.y, 0.0);
  float w;
  if (u_sheet.x > 0.0) { w = clamp(-u_sheet.x + (cid.z + k.y) * c, -u_sheet.x + d * 0.3, u_sheet.x - d * 0.3); rel.z = w - u_camIn.z; }
  else { rel.z = (float(iw - NW / 2) + k.y) * c - u_camIn.z; w = 0.0; }
  float dist = length(rel);
  float sc = d * 0.5 * smoothstep(u_size.w, u_size.w * 0.78, u_sheet.x > 0.0 ? length(rel.xy) : dist);
  if (sc <= 0.0) return;
  // the shield: a chunk that comes within 3 m is pushed off its bubble (and lights it a moment)
  v_glow = 0.0;
  if (dist < 3.2 && u_sheet.x > 0.0) { v_glow = 1.0 - dist / 3.2; rel *= 3.2 / max(dist, 0.05); }
  int vi = IF[gl_VertexID];
  vec3 cn = IV[vi];
  float bump = 0.72 + 0.5 * hash13(vec3(cid.xy * 0.37 + float(vi), cid.z + 5.0 * k.z));
  vec3 ax = normalize(k * 2.0 - 1.0 + vec3(0.001));
  vec3 lv = rotAxis(ax, u_sheet.w * (0.05 + 0.4 * k.z) + h.z * 6.283) * (cn * bump * vec3(1.0, 0.75 + 0.4 * k.x, 0.8 + 0.3 * k.y));
  vec3 P = u_er * rel.x + u_et * rel.y + u_en * rel.z + lv * sc;
  v_p = P;
  v_alb = vec3(0.66, 0.64, 0.61) * (0.6 + 0.55 * h.z) + vec3(0.05, 0.02, -0.03) * k.x;
  // Helia's light inside the sheet: through the ice between the chunk and the lit face
  float Ln = u_sheet.y;
  v_sunT = u_sheet.x > 0.0 ? exp(-u_sheet.z * max(0.0, (sign(Ln) * u_sheet.x - w) / max(abs(Ln), 0.05))) : 1.0;
  gl_Position = u_viewProj * vec4(P, 1.0);
}`;
  const CHUNK_FS = `
uniform vec3 u_sunDir, u_sunCol, u_plDir, u_plCol, u_tint;
in vec3 v_p;
in vec3 v_alb;
in float v_sunT;
in float v_glow;
out vec4 o;
void main() {
  vec3 N = normalize(cross(dFdx(v_p), dFdy(v_p)));
  if (dot(N, v_p) > 0.0) N = -N;
  vec3 V = normalize(-v_p), L = u_sunDir;
  vec3 alb = v_alb * u_tint;
  float dl = max(dot(N, L), 0.0);
  float sp = pow(max(dot(reflect(-V, N), L), 0.0), 24.0) * 0.35;
  vec3 col = alb * u_sunCol * (dl * v_sunT + 0.03) + u_sunCol * sp * v_sunT + alb * u_plCol * max(dot(N, u_plDir) * 0.7 + 0.3, 0.0);
  col += vec3(0.35, 0.6, 1.0) * v_glow * v_glow * 0.12;
  o = vec4(col, 1.0);
}`;
  const FULL_VS = `
uniform mat4 u_invViewProj;
out vec3 v_dir;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)) * 2.0 - 1.0;
  vec4 w = u_invViewProj * vec4(p, 1.0, 1.0);
  v_dir = w.xyz / w.w;
  gl_Position = vec4(p, 0.999, 1.0);
}`;
  // the 10-m sheet beyond the chunks: a short march through the slab, τ from the ring's own texture (the gaps' walls
  // stand where the texture has them), Helia's light through the ice above, glints of single chunks far off
  const SLAB_FS = `
uniform vec3 u_er, u_et, u_en;
uniform vec4 u_cam;          // height over the middle, radius (m), the march's start (m), steps
uniform vec4 u_ringK;        // r0, r1 (m), half thickness, -
uniform vec3 u_sunDir, u_sunCol, u_plCol;
uniform vec4 u_pl;           // the planet's centre (scene, m) and radius
uniform vec2 u_arc;          // the camera's place along the orbit and its radius mod 64 m (the grain's frame)
uniform sampler2D u_ring;
${HASH}
in vec3 v_dir;
out vec4 o;
void main() {
  vec3 D = normalize(v_dir);
  float dn = dot(D, u_en), dr = dot(D, u_er), dt = dot(D, u_et), H = u_ringK.z, h = u_cam.x;
  float ta, tb;
  if (abs(dn) < 1e-5) { if (abs(h) >= H) discard; ta = 0.0; tb = 1e6; }
  else { float t1 = (-H - h) / dn, t2 = (H - h) / dn; ta = max(min(t1, t2), 0.0); tb = max(t1, t2); }
  ta = max(ta, u_cam.z); tb = min(tb, ta + 4000000.0);
  if (tb <= ta) discard;
  { vec3 c = u_pl.xyz; float b = dot(c, D), hh = b * b - dot(c, c) + u_pl.w * u_pl.w; if (hh > 0.0 && b - sqrt(hh) > 0.0 && b - sqrt(hh) < ta) discard; }
  float Ln = dot(u_sunDir, u_en), cph = dot(D, u_sunDir);
  float phase = 0.55 + 0.9 * exp(-(1.0 - cph) * 6.0) + 0.5 * exp(-(1.0 + cph) * 10.0);
  int N = int(u_cam.w);
  float Tr = 1.0; vec3 acc = vec3(0.0);
  float q = pow(tb / max(ta, 1.0), 1.0 / float(N));
  float t0 = ta;
  for (int k = 0; k < 16; k++) {
    if (k >= N) break;
    float t1 = k == N - 1 ? tb : t0 * q;
    if (ta < 1.0) t1 = ta + (tb - ta) * float(k + 1) / float(N);
    float tm = 0.5 * (t0 + t1), seg = t1 - t0;
    float rr = length(vec2(u_cam.y + dr * tm, dt * tm));
    vec4 R = texture(u_ring, vec2((rr - u_ringK.x) / (u_ringK.y - u_ringK.x), 0.5));
    float ext = (rr < u_ringK.x || rr > u_ringK.y) ? 0.0 : R.a * 3.0 / (2.0 * H);
    float w = h + dn * tm;
    float sunT = exp(-ext * max(0.0, (sign(Ln) * H - w) / max(abs(Ln), 0.03)));
    float a = exp(-ext * seg);
    vec3 alb = mix(vec3(0.9, 0.88, 0.84), R.rgb * 1.6, 0.5);
    vec3 Sc = alb * (u_sunCol * (sunT * phase * 0.7 + 0.08) + u_plCol * 0.5);
    acc += Tr * (1.0 - a) * Sc; Tr *= a;
    t0 = t1;
    if (Tr < 0.01) break;
  }
  // the sheet's face seen from outside it: chunks as a grain (cells of 1.6 m, lit on Helia's side), fading with distance
  if (abs(h) > H) {
    float te = (sign(h) * H - h) / dn;
    vec2 q = vec2(u_cam.y + dr * te, u_arc.x + dt * te) / 1.6;
    vec2 ci = floor(q), f = fract(q);
    vec3 hc = h3(vec3(ci, 3.0));
    float dd = length(f - 0.2 - 0.6 * hc.xy) / (0.28 + 0.22 * hc.z);
    float px = length(fwidth(q));
    float grain = mix(1.0, (dd < 1.0 ? 0.7 + 0.8 * sqrt(1.0 - dd * dd) : 0.25), 1.0 - smoothstep(0.15, 0.6, px));
    acc *= grain;
  }
  // single chunks far off catching Helia (stable with the view: a hash on the direction)
  float gl = step(0.9985, hash13(floor(D * 1400.0))) * (1.0 - Tr) * 2.5;
  acc += u_sunCol * gl * (0.4 + 0.6 * max(Ln * sign(h + 1e-3), 0.0));
  o = vec4(acc, 1.0 - Tr);
}`;
  // Amarant's cloud tops from a few km over them: the planet's own texture (its bands, the great storm) under km-scale
  // structure on two decks — the bright ammonia tops (gaps in them) over a darker, deeper deck, parallax between them;
  // vortices; the ring's shadow; lightning deep down on the night side; the haze toward the horizon
  const CLOUD_FS = `
uniform vec3 u_up, u_east, u_north;
uniform vec4 u_geo;          // camera altitude over the tops (m), local radius (m), deck depth (m), tier
uniform vec4 u_off;          // the camera's ground coordinates (m, east, north; mod 2^22), time, night lightning k
uniform mat3 u_toBody;
uniform vec3 u_camB;         // the camera in the body frame (radii)
uniform vec3 u_sunB, u_sunDir, u_sunCol;
uniform vec4 u_ringK;        // r0, r1 (radii), -, -
uniform sampler2D u_bands, u_ring;
${HASH}
in vec3 v_dir;
out vec4 o;
const float PI = 3.14159265;
vec2 eqUV(vec3 N) { return vec2(atan(-N.z, N.x) / 6.2831853 + 0.5, acos(clamp(N.y, -1.0, 1.0)) / PI); }
float fbm(vec2 p, int n) { float v = 0.0, a = 0.5; for (int i = 0; i < 6; i++) { if (i >= n) break; v += a * vn2(p); p = p * 2.03 + vec2(17.1, 3.7); a *= 0.5; } return v; }
// a deck's structure at ground point p (m): zonal streaks, curls, vortices of 15–40 km in 140-km cells
float deck(vec2 p, float t, int n, float seed) {
  vec2 cell = floor(p / 140000.0), f = p - (cell + 0.5) * 140000.0;
  vec3 hv = h3(vec3(cell, seed));
  vec2 c = (hv.xy - 0.5) * 80000.0; float rv = 15000.0 + 25000.0 * hv.z;
  vec2 d = f - c; float r2 = dot(d, d) / (rv * rv);
  float sw = (hv.z > 0.5 ? 1.0 : -1.0) * 5.0 * exp(-r2) * step(0.35, hv.x);
  float cs = cos(sw), sn = sin(sw);
  vec2 q = c + vec2(cs * d.x - sn * d.y, sn * d.x + cs * d.y) + (cell + 0.5) * 140000.0;
  vec2 s = vec2(q.x * 0.35 + t * 40.0, q.y) / 9000.0;
  vec2 wv = vec2(fbm(s * 0.5 + seed, 3), fbm(s * 0.5 + seed + 9.3, 3));
  return fbm(s + wv * 2.2, n);
}
void main() {
  vec3 D = normalize(v_dir);
  float mu = dot(D, u_up), alt = u_geo.x, Rl = u_geo.y;
  float Rc = Rl + alt;
  float c0 = alt * (2.0 * Rl + alt), dsc0 = Rc * Rc * mu * mu - c0;
  vec3 bandC = texture(u_bands, eqUV(normalize(u_camB))).rgb;
  float litC = smoothstep(-0.1, 0.25, dot(u_up, u_sunDir));
  if (mu >= 0.0 || dsc0 < 0.0) {
    // above the deck's horizon: the upper haze the flight is in — bright on the horizon, gone 25° up (it covers the
    // giant's own limb shell, made for a view from afar)
    if (mu > 0.45) discard;
    float ht = mu < 0.0 ? Rc * sqrt(1.0 - mu * mu) - Rl : alt + Rc * mu * 0.0;
    float g = exp(-max(ht, 0.0) / 7000.0) * (mu < 0.0 ? 1.0 : exp(-mu * 9.0));
    vec3 hc = bandC * vec3(0.95, 0.92, 1.05) * u_sunCol * (0.08 + 0.95 * litC) * g * 1.2 + vec3(0.03, 0.035, 0.06) * g * (1.0 - litC);
    o = vec4(hc, 1.0);
    return;
  }
  float tA = c0 / (-Rc * mu + sqrt(dsc0));
  float dB = alt + u_geo.z, RB = Rl - u_geo.z, cB = dB * (2.0 * RB + dB), dscB = Rc * Rc * mu * mu - cB;
  float tB = dscB > 0.0 ? cB / (-Rc * mu + sqrt(dscB)) : tA * 1.2;
  vec3 PA = D * tA, PB = D * tB;
  vec2 gA = vec2(dot(PA, u_east), dot(PA, u_north)) + u_off.xy, gB = vec2(dot(PB, u_east), dot(PB, u_north)) + u_off.xy;
  vec3 NA = normalize(u_camB + u_toBody * PA / Rl);
  vec3 band = texture(u_bands, eqUV(NA)).rgb;
  int n = u_geo.w > 1.5 ? 6 : u_geo.w > 0.5 ? 5 : 4;
  float t = u_off.z;
  float fA = deck(gA, t, n, 1.0);
  float fB = deck(gB * 1.3, t * 0.6, n - 1, 5.0);
  // the light: the sphere's normal at the hit, the ring's shadow on the tops
  vec3 upA = normalize(u_up + PA / Rl);
  float mus = dot(upA, u_sunDir);
  float lit = smoothstep(-0.08, 0.25, mus) * (0.35 + 0.65 * max(mus, 0.0));
  vec3 Pb = u_camB + u_toBody * PA / Rl, L = u_sunB;
  float rsh = 1.0;
  if (abs(L.y) > 1e-4) { float tr = -Pb.y / L.y; if (tr > 0.0) { float rr = length((Pb + L * tr).xz); if (rr > u_ringK.x && rr < u_ringK.y) rsh = exp(-texture(u_ring, vec2((rr - u_ringK.x) / (u_ringK.y - u_ringK.x), 0.5)).a * 3.0 / max(abs(L.y), 0.05)); rsh = mix(1.0, rsh, 0.85); } }
  // relief: the deck's slope toward Helia (Balanced and up)
  float rel = 0.0;
  if (u_geo.w > 1.5) { vec2 sh = vec2(dot(u_sunDir, u_east), dot(u_sunDir, u_north)) * 700.0; rel = (deck(gA + sh, t, n - 2, 1.0) - fA) * 3.0; }
  vec3 topC = band * (0.62 + 0.75 * fA) * vec3(1.06, 1.0, 1.02);
  float cover = smoothstep(0.34, 0.56, fA);
  vec3 deepC = band * vec3(0.62, 0.52, 0.66) * (0.35 + 0.6 * fB);
  // the top deck's shadow on the deep one (Low and up)
  float shB = 1.0;
  if (u_geo.w > 0.5) { vec2 sh = vec2(dot(u_sunDir, u_east), dot(u_sunDir, u_north)) / max(mus, 0.12) * u_geo.z; shB = 1.0 - 0.6 * smoothstep(0.34, 0.56, deck(gB + sh, t, 3, 1.0)); }
  vec3 col = mix(deepC * shB, topC * (1.0 + rel), cover) * u_sunCol * lit * rsh * 1.45;
  // lightning deep down on the night side: a cell flashes now and then, the glow spread by the deck above
  if (u_off.w > 0.0) {
    vec2 lc = floor(gB / 22000.0); float ph = u_off.z * 0.9 + hash12(lc) * 7.0, fl = floor(ph);
    float on = step(0.93, hash12(lc + fl * 1.37)), fr = fract(ph);
    vec2 cc = (lc + 0.2 + 0.6 * vec2(hash12(lc + 3.1 + fl), hash12(lc + 5.7 + fl))) * 22000.0;
    float dd = length(gB - cc) / 7000.0;
    float flash = on * exp(-fr * 6.0) * (0.6 + 0.4 * sin(fr * 60.0)) * exp(-dd * dd) * u_off.w;
    col += vec3(0.75, 0.82, 1.0) * flash * (1.0 - 0.6 * cover) * 2.2;
  }
  // the haze toward the horizon (the upper haze the flight is in), lit like the tops
  float hz = 1.0 - exp(-tA / 260000.0);
  vec3 hazeC = bandC * vec3(0.95, 0.92, 1.05) * 1.2 * u_sunCol * (0.08 + 0.95 * litC) * exp(-alt / 7000.0) * 2.0 + vec3(0.02, 0.025, 0.04) * (1.0 - lit);
  col = mix(col, hazeC, hz * 0.85);
  o = vec4(col, 1.0);
}`;
  // the swarm's bodies: an icosphere (level 2) bent into the body's shape (top, binary, potato), rough, near-black;
  // drawn far → near (the CPU sorts 60 of them), back faces culled
  const ROCK_VS = `
uniform mat4 u_viewProj;
uniform vec3 u_camRel;           // the camera relative to the swarm's centre (m, scene axes)
uniform float u_k;               // the scale that keeps the far bodies inside the depth range
uniform float u_time;
in vec3 a_pos;                   // the icosphere's unit vertex
in vec4 a_body;                  // centre (m, from the swarm's centre), D
in vec4 a_shape;                 // shape (0 top · 1 binary · 2 potato), seed, spin (rad/s), metal
${HASH}
out vec3 v_p;
out vec3 v_n0;
out float v_metal;
mat3 rotAxis(vec3 k, float a) { float c = cos(a), s = sin(a), t = 1.0 - c; return mat3(t * k.x * k.x + c, t * k.x * k.y + s * k.z, t * k.x * k.z - s * k.y, t * k.x * k.y - s * k.z, t * k.y * k.y + c, t * k.y * k.z + s * k.x, t * k.x * k.z + s * k.y, t * k.y * k.z - s * k.x, t * k.z * k.z + c); }
void main() {
  vec3 u = a_pos, h = h3(vec3(a_shape.y, 3.0, 1.0));
  float sh = a_shape.x;
  vec3 p = u;
  if (sh < 0.5) { float ridge = exp(-u.y * u.y * 40.0) * 0.12; p = u * vec3(1.0, 0.82, 1.0) * (1.0 - 0.18 * abs(u.y)) + vec3(u.x, 0.0, u.z) * ridge; }
  else if (sh < 1.5) { p = vec3(u.x * 1.55, u.y * 0.85, u.z * 0.85); float neck = exp(-pow((u.x - 0.15) * 3.0, 2.0)); p.yz *= 1.0 - 0.38 * neck; p.x += u.x > 0.15 ? 0.1 : -0.05; p *= u.x > 0.15 ? 0.82 : 1.0; }
  else p = u * vec3(1.0, 0.62 + 0.25 * h.x, 0.72 + 0.2 * h.y);
  float sd = a_shape.y;
  p *= 1.0 + 0.16 * (vn3(u * 2.2 + sd) - 0.5) + 0.07 * (vn3(u * 6.0 + sd * 1.7) - 0.5) + 0.03 * (vn3(u * 15.0 + sd) - 0.5);
  vec3 ax = normalize(h * 2.0 - 1.0 + vec3(0.001));
  mat3 R = rotAxis(ax, u_time * a_shape.z + h.z * 6.283);
  vec3 P = (a_body.xyz - u_camRel + R * p * a_body.w * 0.5) * u_k;
  v_p = P; v_n0 = R * u; v_metal = a_shape.w;
  gl_Position = u_viewProj * vec4(P, 1.0);
}`;
  const ROCK_FS = `
uniform vec3 u_sunDir, u_sunCol;
uniform float u_alb;
in vec3 v_p;
in vec3 v_n0;
in float v_metal;
out vec4 o;
float hash13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vn(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), f.x), mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x), f.y), mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x), mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
void main() {
  vec3 N = normalize(cross(dFdx(v_p), dFdy(v_p)));
  if (dot(N, v_p) > 0.0) N = -N;
  vec3 V = normalize(-v_p);
  float m0 = max(dot(N, u_sunDir), 0.0), m = max(dot(N, V), 0.02);
  float ls = m0 / (m0 + m) * 2.0;                              // Lommel–Seeliger: dark dust has no limb darkening
  float spots = 0.7 + 0.35 * vn(v_n0 * 7.0) + 0.25 * vn(v_n0 * 23.0);
  vec3 alb = vec3(u_alb) * vec3(1.08, 1.0, 0.92) * spots;
  if (v_metal > 0.5) alb = mix(alb, vec3(0.16, 0.15, 0.14), 0.6);
  vec3 col = alb * u_sunCol * ls * 1.6 + alb * 0.02;
  if (v_metal > 0.5) col += u_sunCol * pow(max(dot(reflect(-V, N), u_sunDir), 0.0), 30.0) * 0.25;
  o = vec4(col, 1.0);
}`;

  const PR = {};
  function prog(name, vs, fs) {
    if (PR[name] !== undefined) return PR[name];
    try { PR[name] = VR.GL.program(vs, fs, 'fields.' + name, []); } catch (e) { console.error('fields shader ' + name + ' failed: ' + (e && e.message)); PR[name] = null; }
    return PR[name];
  }
  F.progs = () => Object.keys(PR).filter(k => PR[k]);
  F.failed = () => Object.keys(PR).filter(k => !PR[k]);
  function setU(gl, p, k, v) {
    const loc = p.u[k]; if (loc === undefined || loc === null) return;
    if (typeof v === 'number') gl.uniform1f(loc, v);
    else if (v.length === 3) gl.uniform3f(loc, v[0], v[1], v[2]);
    else if (v.length === 4) gl.uniform4f(loc, v[0], v[1], v[2], v[3]);
    else if (v.length === 9) gl.uniformMatrix3fv(loc, false, v);
    else if (v.length === 16) gl.uniformMatrix4fv(loc, false, v);
  }
  const texOf = (key) => { const SS = VR.SpaceScene, ST = SS.state, map = SS.texMap || {}; return ST && ST.tex[map[key]]; };

  // ---------------------------------------------------------------- the frame: which fields are near (SS.frameSetup's hook)
  const SWC = [0, 0, 0];
  F.swarmCentre = function (eph) {
    const U = VR.Universe; if (!U || !U.home || !U.home.by.swarm) return null;
    const p = U.home.pos('swarm', eph.t, F._sp || (F._sp = new Float64Array(3))), hp = eph.bodies.helia.p;
    SWC[0] = hp[0] + p[1]; SWC[1] = hp[1] + p[2]; SWC[2] = hp[2] + p[0];   // (universe (x, y, z) → scene (y, z, x), spacescene.js fromUniverse)
    return SWC;
  };
  F.frame = function (fr, eph, S, o) {
    F.stats.chunks = 0; F.stats.steps = 0; F.stats.decks = 0; F.stats.rocks = 0; F.stats.where = null;
    if (!F.on()) return;
    const SS = VR.SpaceScene, BD = SS.BODIES, bs = eph.bodies, cam = fr.pos, ax = fr.axes, tier = o.tier | 0;
    const toS = (v) => [dot(v, ax[0]), dot(v, ax[1]), dot(v, ax[2])];
    const A = bs.amarant, RA = BD.amarant.R, n = A.axis, rel = sub(cam, A.p), h = dot(rel, n), inpl = sub(rel, mul(n, h)), rho = len(inpl), rR = rho / RA;
    const RING = VR.BodyTex.RING, sunW = norm(sub(bs.helia.p, cam)), sunS = toS(sunW);
    // the planet's shadow here (a point test: the fields are metres to kilometres wide)
    const dA = len(rel), shadow = (() => { const tc = -dot(rel, sunW); if (tc <= 0) return 1; const dm = len(add(rel, mul(sunW, tc))); return sstep(RA * (1 - 0.004), RA * (1 + 0.004), dm); })();
    // Amarant's light on things near it: its lit part toward the camera, its size
    const toA = norm(mul(rel, -1)), angA = Math.asin(Math.min(1, RA / dA)), phA = (1 + dot(norm(sub(bs.helia.p, A.p)), mul(toA, -1))) / 2;
    const plCol = mul(SS.SUN, 0.45 * phA * Math.min(1, angA * angA * 3));
    // ---- the ring: the sheet within 1.5 km, the chunks within 60 m
    if (rR > RING.r0 - 0.02 && rR < RING.r1 + 0.02 && Math.abs(h) < 60000) {
      const tau = F.tauAt(rR), er = norm(inpl), en = n, et = cross(en, er);
      const sunCol = mul(SS.SUN, shadow);
      const e1s = perp([1, 0, 0], en), e2s = cross(en, e1s), ths = Math.atan2(dot(inpl, e2s), dot(inpl, e1s)), Oms = Math.sqrt(BD.amarant.mu / (rho * rho * rho));
      let phs = (ths - Oms * eph.t) % TAU; if (phs < -Math.PI) phs += TAU; if (phs > Math.PI) phs -= TAU;
      if (Math.abs(h) > 60) { const ri = fr.draws.findIndex(d => d.prog === 'ring'); if (ri >= 0) fr.draws.splice(ri, 1); }   // (the annulus is a plane through the eye this near: the sheet takes over)
      fr.draws.push({ prog: 'fields_slab', fn: drawSlab, k: { er: toS(er), et: toS(et), en: toS(en), cam: [h, rho, Math.abs(h) < 60 ? F.radius(tier, tau) * 0.92 : 0, [6, 8, 10, 12][Math.min(3, tier)]], ringK: [RING.r0 * RA, RING.r1 * RA, F.H / 2, 0], sun: sunS, sunCol, plCol, pl: toS(sub(A.p, cam)).concat([RA * 0.97]), arc: [(phs * rho) % 4096, 0] } });
      F.stats.steps = [6, 8, 10, 12][Math.min(3, tier)];
      if (Math.abs(h) < 60 && tau > 0.005) {
        // the lattice co-orbits: along the orbit the arc length minus the local Kepler motion (the chunks hang round a
        // ship in the same orbit, stream past one that is not)
        const e1 = perp([1, 0, 0], en), e2 = cross(en, e1), th = Math.atan2(dot(inpl, e2), dot(inpl, e1));
        const Om = Math.sqrt(BD.amarant.mu / (rho * rho * rho));
        let ph = (th - Om * eph.t) % TAU; if (ph < -Math.PI) ph += TAU; if (ph > Math.PI) ph -= TAU;
        const vArc = ph * rho;
        const N = F.count(tier), R = F.radius(tier, tau), nd = F.density(tau);
        const c = Math.pow(Math.PI * R * R * F.H / N, 1 / 3), NW = Math.max(1, Math.ceil(F.H / c)), Sg = Math.max(2, Math.floor(Math.sqrt(N / NW)));
        const p = Math.min(1, nd * c * c * c);
        const iu = Math.floor(rho / c), iv = Math.floor(vArc / c);
        fr.draws.push({ prog: 'fields_chunks', fn: drawChunks, n: Sg * Sg * NW, k: { er: toS(er), et: toS(et), en: toS(en), cell: [c, Sg, NW, p], camCell: [((iu % 1048576) + 1048576) % 1048576, ((iv % 1048576) + 1048576) % 1048576, 0], camIn: [rho - iu * c, vArc - iv * c, h], size: [F.DMIN, F.DMAX, F.Q, R], sheet: [F.H / 2, dot(sunW, en), tau / F.H, eph.t % 10000], sun: sunS, sunCol, plDir: toS(toA), plCol, tint: [1, 1, 1] } });
        F.stats.chunks = Sg * Sg * NW; F.stats.where = 'ring'; F.stats.tau = +tau.toFixed(2); F.stats.cell = +c.toFixed(2);
      }
    }
    // ---- the cloud tops: within 80 km of them
    const latS = dot(norm(rel), n), Rl = RA * BD.amarant.Rp / RA / Math.sqrt(1 - (1 - Math.pow(BD.amarant.Rp / RA, 2)) * (1 - latS * latS));
    const altC = dA - Rl;
    if (altC < 80000 && altC > -2000) {
      const up = norm(rel), east = perp(cross(n, up), up), north = cross(up, east);
      const F3 = SS.frame(A), m3 = (() => { const r0 = toS(F3[0]), r1 = toS(F3[1]), r2 = toS(F3[2]); return [r0[0], r1[0], r2[0], r0[1], r1[1], r2[1], r0[2], r1[2], r2[2]]; })();
      const camB = mul(SS.toBody(F3, rel), 1 / RA), sunB = SS.toBody(F3, norm(sub(bs.helia.p, A.p)));
      // the camera's ground coordinates (m): its longitude and latitude on the giant (mod 2²²)
      const lon = Math.atan2(-camB[2], camB[0]), lat = Math.asin(Math.max(-1, Math.min(1, camB[1] / len(camB))));
      const W = 4194304, gx = ((lon * Rl * Math.cos(lat)) % W + W) % W, gy = ((lat * Rl) % W + W) % W;
      const night = 1 - sstep(-0.1, 0.05, dot(up, sunW));
      const at = fr.draws.findIndex(d => d.prog === 'ring');
      const dr = { prog: 'fields_clouds', fn: drawClouds, k: { up: toS(up), east: toS(east), north: toS(north), geo: [Math.max(10, altC), Rl, 6000, tier], off: [gx, gy, eph.t % 4000, night], toBody: m3, camB, sunB, sun: sunS, sunCol: mul(SS.SUN, 1.0), ringK: [RING.r0, RING.r1, 0, 0] } };
      if (at >= 0) fr.draws.splice(at, 0, dr); else fr.draws.push(dr);
      F.stats.decks = tier > 0 ? 2 : 1; F.stats.where = F.stats.where || 'clouds'; F.stats.alt = Math.round(altC);
      fr.cloudAlt = altC;
    }
    // ---- the swarm: within 60 km of its centre
    const SC = F.swarmCentre(eph);
    if (SC) {
      const cr = sub(cam, SC), dS = len(cr);
      if (dS < 60000) {
        const sw = F.swarm().bodies, cs = toS(cr), list = [];
        for (const b of sw) { const bp = toS(b.pS || (b.pS = b.p)); list.push({ b, d: Math.hypot(bp[0] - cs[0], bp[1] - cs[1], bp[2] - cs[2]) }); }
        list.sort((a, b2) => b2.d - a.d);
        const gg = VR.game, far = (gg && gg.space && gg.space.cam && gg.space.cam.far) || (gg && gg.cam && gg.cam.far) || 100;
        fr.draws.push({ prog: 'fields_rocks', fn: drawRocks, list, k: { camRel: cs, axes: ax, k: Math.min(1, 0.85 * far / (dS + 30000)), sun: sunS, sunCol: mul(SS.SUN, 0.62) } });
        // the gravel and dust drifting between: a lattice round the camera, no sheet
        fr.draws.push({ prog: 'fields_chunks', fn: drawChunks, n: 12 * 12 * 6, k: { er: toS([1, 0, 0]), et: toS([0, 0, 1]), en: toS([0, 1, 0]), cell: [7, 12, 6, 0.35], camCell: [Math.floor(cam[0] / 7) % 1048576, Math.floor(cam[2] / 7) % 1048576, Math.floor(cam[1] / 7) % 1048576 - 3], camIn: [cam[0] - Math.floor(cam[0] / 7) * 7, cam[2] - Math.floor(cam[2] / 7) * 7, cam[1] - Math.floor(cam[1] / 7) * 7 + 3 * 7 - 3 * 7], size: [0.04, 0.5, 2.6, 38], sheet: [0, 0, 0, eph.t % 10000], sun: sunS, sunCol: mul(SS.SUN, 0.62), plDir: [0, 1, 0], plCol: [0, 0, 0], tint: [0.12, 0.11, 0.1] } });
        F.stats.rocks = sw.length; F.stats.where = 'swarm'; F.stats.swarmD = Math.round(dS);
      }
    }
  };

  // ---------------------------------------------------------------- the draws (called from the space scene's draw loops)
  function begin(gl, p, r) { gl.useProgram(p.p); setU(gl, p, 'u_viewProj', r.viewProj); setU(gl, p, 'u_invViewProj', r.invViewProj); }
  function drawChunks(r, d) {
    const gl = r.gl, p = prog('chunks', CHUNK_VS, CHUNK_FS); if (!p) return;
    const k = d.k;
    begin(gl, p, r);
    setU(gl, p, 'u_er', k.er); setU(gl, p, 'u_et', k.et); setU(gl, p, 'u_en', k.en); setU(gl, p, 'u_cell', k.cell); setU(gl, p, 'u_camCell', k.camCell); setU(gl, p, 'u_camIn', k.camIn);
    setU(gl, p, 'u_size', k.size); setU(gl, p, 'u_sheet', k.sheet); setU(gl, p, 'u_sunDir', k.sun); setU(gl, p, 'u_sunCol', k.sunCol); setU(gl, p, 'u_plDir', k.plDir); setU(gl, p, 'u_plCol', k.plCol); setU(gl, p, 'u_tint', k.tint);
    gl.disable(gl.BLEND); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true); gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(r.emptyVAO);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 60, d.n);
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
    r.stats.draws++; r.stats.tris += 20 * d.n;
  }
  function drawSlab(r, d) {
    const gl = r.gl, p = prog('slab', FULL_VS, SLAB_FS); if (!p) return;
    const k = d.k, t = texOf('ring'); if (!t) return;
    begin(gl, p, r);
    setU(gl, p, 'u_er', k.er); setU(gl, p, 'u_et', k.et); setU(gl, p, 'u_en', k.en); setU(gl, p, 'u_cam', k.cam); setU(gl, p, 'u_ringK', k.ringK);
    setU(gl, p, 'u_sunDir', k.sun); setU(gl, p, 'u_sunCol', k.sunCol); setU(gl, p, 'u_plCol', k.plCol); setU(gl, p, 'u_pl', k.pl); if (p.u.u_arc) gl.uniform2f(p.u.u_arc, k.arc[0], k.arc[1]);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(p.u.u_ring, 0);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.DEPTH_TEST);
    gl.bindVertexArray(r.emptyVAO); gl.drawArrays(gl.TRIANGLES, 0, 3);
    r.stats.draws++; r.stats.tris++;
  }
  function drawClouds(r, d) {
    const gl = r.gl, p = prog('clouds', FULL_VS, CLOUD_FS); if (!p) return;
    const k = d.k, tb = texOf('amarant'), tr = texOf('ring'); if (!tb) return;
    begin(gl, p, r);
    for (const n of ['up', 'east', 'north']) setU(gl, p, 'u_' + n, k[n]);
    setU(gl, p, 'u_geo', k.geo); setU(gl, p, 'u_off', k.off); setU(gl, p, 'u_toBody', k.toBody); setU(gl, p, 'u_camB', k.camB); setU(gl, p, 'u_sunB', k.sunB); setU(gl, p, 'u_sunDir', k.sun); setU(gl, p, 'u_sunCol', k.sunCol); setU(gl, p, 'u_ringK', k.ringK);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tb); gl.uniform1i(p.u.u_bands, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tr || tb); gl.uniform1i(p.u.u_ring, 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.DEPTH_TEST);
    gl.bindVertexArray(r.emptyVAO); gl.drawArrays(gl.TRIANGLES, 0, 3);
    r.stats.draws++; r.stats.tris++;
  }
  // the icosphere (level 2) and the swarm's instance buffer, made once
  const RK = { vao: null, n: 0, inst: null, order: null };
  function icosphere() {
    const t = (1 + Math.sqrt(5)) / 2;
    let V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(norm);
    let Fc = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    for (let l = 0; l < 2; l++) {
      const mid = {}, F2 = [];
      const m = (a, b) => { const key = a < b ? a + '_' + b : b + '_' + a; if (mid[key] === undefined) { mid[key] = V.length; V.push(norm(add(V[a], V[b]))); } return mid[key]; };
      for (const [a, b, c] of Fc) { const ab = m(a, b), bc = m(b, c), ca = m(c, a); F2.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
      Fc = F2;
    }
    const out = new Float32Array(Fc.length * 9);
    Fc.forEach((f, i) => { for (let j = 0; j < 3; j++) out.set(V[f[j]], i * 9 + j * 3); });
    return out;
  }
  function rockVAO(gl, p) {
    if (RK.vao) return RK.vao;
    const geo = icosphere(); RK.n = geo.length / 3;
    const sw = F.swarm().bodies;
    RK.inst = new Float32Array(sw.length * 8);
    sw.forEach((b, i) => RK.inst.set([b.p[0], b.p[1], b.p[2], b.D, b.shape === 'top' ? 0 : b.shape === 'binary' ? 1 : 2, (b.seed % 1000) / 10, TAU / (b.spinH * 3600 / 8), b.metal ? 1 : 0], i * 8));
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, geo, gl.STATIC_DRAW);
    const lp = gl.getAttribLocation(p.p, 'a_pos'); gl.enableVertexAttribArray(lp); gl.vertexAttribPointer(lp, 3, gl.FLOAT, false, 12, 0);
    RK.ib = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, RK.ib); gl.bufferData(gl.ARRAY_BUFFER, RK.inst.byteLength, gl.DYNAMIC_DRAW);
    const lb = gl.getAttribLocation(p.p, 'a_body'), ls = gl.getAttribLocation(p.p, 'a_shape');
    gl.enableVertexAttribArray(lb); gl.vertexAttribPointer(lb, 4, gl.FLOAT, false, 32, 0); gl.vertexAttribDivisor(lb, 1);
    gl.enableVertexAttribArray(ls); gl.vertexAttribPointer(ls, 4, gl.FLOAT, false, 32, 16); gl.vertexAttribDivisor(ls, 1);
    gl.bindVertexArray(null); gl.bindBuffer(gl.ARRAY_BUFFER, null);
    RK.order = new Float32Array(RK.inst.length);
    return (RK.vao = vao);
  }
  function drawRocks(r, d) {
    const gl = r.gl, p = prog('rocks', ROCK_VS, ROCK_FS); if (!p) return;
    const k = d.k, vao = rockVAO(gl, p), sw = F.swarm().bodies;
    // the bodies far → near (the instance buffer re-ordered: 60 × 8 floats a frame); the swarm's own axes are the scene's
    // ecliptic axes, the camera's rotation is in u_viewProj — so the offsets go through the frame's axes
    const ax = k.axes;
    d.list.forEach((e, i) => { const j = sw.indexOf(e.b), b = e.b, ps = [dot(b.p, ax[0]), dot(b.p, ax[1]), dot(b.p, ax[2])]; RK.order.set(RK.inst.subarray(j * 8, j * 8 + 8), i * 8); RK.order[i * 8] = ps[0]; RK.order[i * 8 + 1] = ps[1]; RK.order[i * 8 + 2] = ps[2]; });
    gl.bindBuffer(gl.ARRAY_BUFFER, RK.ib); gl.bufferSubData(gl.ARRAY_BUFFER, 0, RK.order); gl.bindBuffer(gl.ARRAY_BUFFER, null);
    begin(gl, p, r);
    setU(gl, p, 'u_camRel', k.camRel); setU(gl, p, 'u_k', k.k); setU(gl, p, 'u_time', (performance.now() / 1000) % 100000); setU(gl, p, 'u_sunDir', k.sun); setU(gl, p, 'u_sunCol', k.sunCol); setU(gl, p, 'u_alb', 0.05);
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.frontFace(gl.CCW);
    gl.bindVertexArray(vao); gl.drawArraysInstanced(gl.TRIANGLES, 0, RK.n, sw.length);
    gl.bindVertexArray(r.emptyVAO); gl.disable(gl.CULL_FACE);
    r.stats.draws++; r.stats.tris += RK.n / 3 * sw.length;
  }

  // ---------------------------------------------------------------- the /raum places (SS.view's hook)
  const PL = { ring: 'ring', ringe: 'ring', cassini: 'cassini', ringschatten: 'ringschatten', ringshadow: 'ringschatten', wolken: 'wolken', clouds: 'wolken', schwarm: 'schwarm', swarm: 'schwarm' };
  F.PLACES = Object.keys(PL);
  // the views are made fresh every frame (the ring's chunks co-orbit, the flyover moves at 5.7 km/s): t the world seconds,
  // since the seconds the view has been open
  F.view = function (name, eph, opt) {
    opt = opt || {};
    const SS = VR.SpaceScene, BD = SS.BODIES, bs = eph.bodies, A = bs.amarant, RA = BD.amarant.R, n = A.axis, sun = norm(sub(bs.helia.p, A.p));
    const since = opt.since || 0;
    const e1 = perp([1, 0, 0], n), e2 = cross(n, e1);
    // the inertial ring-plane basis at angle th; a Kepler orbit at radius rho (m) — the place at time t
    const onRing = (rho, th0) => { const Om = Math.sqrt(BD.amarant.mu / (rho * rho * rho)), th = th0 + Om * eph.t; const er = add(mul(e1, Math.cos(th)), mul(e2, Math.sin(th))); return { er, et: cross(n, er), p: add(A.p, mul(er, rho)) }; };
    // the place on the ring where Helia stands at azimuth `az` from the planet's direction (a lit, open view)
    const sunTh = Math.atan2(dot(sun, e2), dot(sun, e1));
    if (name === 'ring') {
      // in the B ring, 1.5 m over the sheet's middle (in the ice), drifting 0.4 m/s along the orbit and slowly down through
      // it: the giant above, Helia low over the sheet
      const rho = 1.70 * RA, o = onRing(rho, sunTh + 1.55 - 0.4 * since / rho);
      const h = opt.h !== undefined ? opt.h : 7 - Math.min(14, since * 0.25);
      const pos = add(o.p, mul(n, h));
      const toA = norm(sub(A.p, pos)), fwd = norm(add(add(mul(o.et, -0.3), mul(toA, 0.8)), mul(n, 0.3)));
      return { name, pos, fwd, up: perp(n, fwd), fov: 70 * D2R, nadir: null, body: null, ref: 'amarant' };
    }
    if (name === 'cassini') {
      // 9 km over the B ring's outer edge, looking out along the orbit across the Cassini Division to the A ring
      const RB = VR.BodyTex.RING, rho = (RB.bA - 0.01) * RA, o = onRing(rho, sunTh + 2.2);
      const pos = add(o.p, mul(n, 9000));
      const fwd = norm(add(add(mul(o.er, 0.9), mul(o.et, 0.35)), mul(n, -0.07)));
      return { name, pos, fwd, up: perp(n, fwd), fov: 62 * D2R, nadir: null, body: null, ref: 'amarant' };
    }
    if (name === 'ringschatten') {
      // 3.3 radii out, 22° over the ring's lit face, Helia 40° to the side: the ring's dark bands across the bright globe
      const s = Math.sign(dot(sun, n)) || 1, sp = perp(sun, n), side = cross(n, sp);
      const dir = norm(add(add(mul(sp, Math.cos(0.75)), mul(side, Math.sin(0.75))), mul(n, s * Math.tan(22 * D2R))));
      const pos = add(A.p, mul(dir, 3.3 * RA)), fwd = norm(sub(add(A.p, mul(n, -s * 0.25 * RA)), pos));
      return { name, pos, fwd, up: perp(n, fwd), fov: 48 * D2R, nadir: null, body: null, ref: 'amarant' };
    }
    if (name === 'wolken') {
      // 15 km over the cloud tops in the southern belt, flying east at 5.7 km/s with Helia low ahead: the ring overhead
      const lat = -14 * D2R, Rp = BD.amarant.Rp, Rl = RA * Rp / Math.sqrt(Rp * Rp * Math.cos(lat) ** 2 + RA * RA * Math.sin(lat) ** 2);
      const lon0 = (opt.lon0 !== undefined ? opt.lon0 : sunTh - 1.25 + (F.wolkenDL || 0)), lon = lon0 + F.FLY_V * since / (Rl * Math.cos(lat));
      const eq = add(mul(e1, Math.cos(lon)), mul(e2, Math.sin(lon))), up = norm(add(mul(eq, Math.cos(lat)), mul(n, Math.sin(lat))));
      const pos = add(A.p, mul(up, Rl + F.FLY_H)), east = norm(cross(n, up));
      const fwd = norm(add(mul(east, Math.cos(8 * D2R)), mul(up, -Math.sin(8 * D2R))));
      return { name, pos, fwd, up: perp(up, fwd), fov: 72 * D2R, nadir: null, body: null, ref: 'amarant' };
    }
    if (name === 'schwarm') {
      // inside the swarm, 1.4 km off its big spinning top (TS-01), Helia over the shoulder; a slow drift
      const SC = F.swarmCentre(eph); if (!SC) return null;
      const b = F.swarm().bodies[0], bp = add(SC, b.p), s = norm(sub(bs.helia.p, bp));
      const side = perp(cross(s, [0, 1, 0]), s);
      const off = norm(add(add(mul(s, 0.25), mul(side, 0.95)), [0, 0.2, 0]));
      const pos = add(bp, mul(off, 950 - since * 3));
      const fwd = norm(add(sub(bp, pos), mul(side, -420)));
      return { name, pos, fwd, up: perp([0, 1, 0], fwd), fov: 64 * D2R, nadir: null, body: null, ref: 'amarant', swarm: true };
    }
    return null;
  };

  // ---------------------------------------------------------------- the switch
  if (VR.Settings && VR.Settings.add) VR.Settings.add({ key: 'fields', g: 'img', sec: 'show', t: 'switch', lab: 'g.set.fields', tip: 'g.set.fields.tip', cost: 'mid', def: true });

  // ---------------------------------------------------------------- the game
  const G = VR.Game; if (!G) return;
  const T = (k, v, fb) => (VR.I18N ? VR.I18N.t(k, v, fb) : (fb !== undefined ? fb : k));
  // /raum ring · cassini · ringschatten · wolken · schwarm: our places through u-space0's view (made fresh each frame)
  const origRaum = G.prototype.raumCommand;
  G.prototype.raumCommand = function (arg) {
    const w = String(arg || '').toLowerCase(), name = PL[w];
    if (!name) return origRaum.call(this, arg);
    const SS = VR.SpaceScene;
    if (this.space) SS.close(this);
    SS.open(this, name);
    if (this.space) this.space.fieldsT0 = performance.now();
    if (name === 'schwarm' && this.ui) this.ui.chatLine(T('g.fields.codex'), '#cfe6ff');
  };
  const SSm = VR.SpaceScene;
  if (SSm && SSm.step) {
    const origStep = SSm.step;
    SSm.step = function (g, dt) {
      const S = g.space;
      if (S && PL[S.name]) {
        const since = S.fieldsT0 ? (performance.now() - S.fieldsT0) / 1000 * (F.timeK || 1) : 0;
        SSm.ephemeris(SSm.worldTime(g.env.day, g.env.ticks), S.eph);
        const v = F.view(S.name, S.eph, { since, h: F.fixH });
        if (v) S.anc = SSm.anchor(v, S.eph);
      }
      return origStep.call(this, g, dt);
    };
  }

  // ---------------------------------------------------------------- a rubble world: the boots, drifting, the tow back
  F.isRock = (dim) => { const d = VR.DimReg && VR.DimReg.get(dim); return !!(d && d.rock); };
  const RS = F.rock = { dim: null, boots: true, spawn: null, said: false, driftSaid: false, jumpTop: 0, jumpY0: null, lastJump: 0 };
  F.setBoots = function (g, on) {
    const p = g.player; RS.boots = !!on;
    if (p) p.grav = on ? F.bootsGame() : VR.DimReg.gravity(g.dim) * F.offShare(g.dim);
    if (g.ui && g.ui.hint) g.ui.hint(T(on ? 'g.fields.boots.on' : 'g.fields.boots.off'), 3200);
    if (g.audio && g.audio.play) g.audio.play('click');
  };
  F.tick = function (g, dt) {
    const p = g.player; if (!p || !p.pos) return;
    if (!F.isRock(g.dim)) { RS.dim = null; return; }
    if (RS.dim !== g.dim || RS.p !== p) {
      RS.dim = g.dim; RS.p = p; RS.boots = true; RS.said = false; RS.driftSaid = false; RS.jumpTop = 0;
      const gen = new VR.RubbleGen(0, g.dim); RS.spawn = gen.findSpawn(); RS.D = gen.D;
      p.grav = F.bootsGame();
    }
    if (!RS.said && g.ui && g.ui.toast && g.world && g.world.cols && g.world.cols.size > 4) {
      RS.said = true;
      const nm = VR.Travel ? VR.Travel.dimName(g.dim) : g.dim;
      g.ui.toast(T('g.moon.hello', { name: nm }), g.dim === 'rock.m' ? T('g.fields.hello.m') : T('g.fields.hello', { name: nm, d: Math.round(RS.D) }));
      if (g.dim !== 'rock.m' && g.ui.chatLine) g.ui.chatLine(T('g.fields.codex'), '#cfe6ff');
    }
    const i = g.input, ui = g.ui;
    if (i && ui && !ui.typing && !ui.screen && i.hit && i.hit('KeyB')) F.setBoots(g, !RS.boots);
    // the jump's top (the test reads it: 39 ± 2 m with the boots)
    if (p.onGround) { RS.jumpY0 = p.pos[1]; RS.cur = 0; }
    else if (RS.jumpY0 !== null) { RS.cur = Math.max(RS.cur || 0, p.pos[1] - RS.jumpY0); RS.jumpTop = Math.max(RS.jumpTop, RS.cur); }
    // drifting off: a word when the player floats away, Funke's tow from 400 m (or below the body)
    const sp = RS.spawn, away = sp ? Math.hypot(p.pos[0] - sp[0], p.pos[1] - sp[1], p.pos[2] - sp[2]) : 0;
    if (!RS.boots && !p.onGround && away > 60 && !RS.driftSaid) { RS.driftSaid = true; if (ui && ui.hint) ui.hint(T('g.fields.drift'), 4200); }
    if (sp && (away > 400 || p.pos[1] < -24)) {
      p.teleport(sp[0], sp[1] + 1, sp[2]); RS.driftSaid = false;
      if (!RS.boots) F.setBoots(g, true);
      if (ui && ui.hint) ui.hint(T('g.fields.tow'), 3600);
    }
  };
  const origPlay = G.prototype.playFrame;
  G.prototype.playFrame = function (dt) { if (this.dim && this.dim.charCodeAt(0) === 114 && !this.space) F.tick(this, dt); return origPlay.call(this, dt); };   // ('r': only the rock dims pay)
  // the light of a rubble world (bodysky.js has no body for it): an airless body's sky made for Basalt (or Opal for the
  // ring's moonlet, Amarant overhead), then Helia turned by the body's own spin, the other worlds put away, black all round
  const BSm = VR.BodySky;
  if (BSm && BSm.env) {
    const origEnv = BSm.env, oo = {};
    BSm.env = function (E, env, o, dt) {
      const d = VR.DimReg.get(o && o.dim);
      if (!d || !d.rock) return origEnv.call(this, E, env, o, dt);
      for (const k in oo) delete oo[k];
      Object.assign(oo, o); oo.dim = d.ring ? 'opal' : 'basalt';
      const r = origEnv.call(this, E, env, oo, dt);
      F.rockSky(E, env, d);
      return r;
    };
  }
  F.rockSky = function (E, env, d) {
    const U = VR.Universe, t = U ? U.worldSeconds(env.day | 0, env.ticks) : 0, b = VR.Rubble.bodyOf(d.id) || { spinH: 6, seed: 1 };
    const P = Math.max(600, b.spinH * 3600 / 8), H = TAU * t / P + (b.seed % 628) / 100;
    const sd = norm([Math.cos(H), 0.28 + 0.85 * Math.sin(H), 0.4]);
    if (F.sunFix) { sd[0] = F.sunFix[0]; sd[1] = F.sunFix[1]; sd[2] = F.sunFix[2]; }
    const SUN = VR.SpaceScene ? VR.SpaceScene.SUN : [0.95, 0.96, 1];
    const lightK = sstep(-0.03, 0.03, sd[1]), up = sstep(-0.12, 0.12, sd[1]), k = (d.ring ? 1 : 1.1) * lightK / Math.max(up, 0.05);
    if (!d.ring) {
      E.sunDir = lightK > 0.002 ? sd : [0, -1, 0]; E.sunColor = SUN.map(v => v * k);
      E.night = 1 - lightK;
      E.ambSky = SUN.map(v => v * (lightK * 0.012 + 0.0035));
      E.moonColor = [0, 0, 0];
    }
    if (!d.ring && E.exposure) E.exposure *= 1.25;
    E.zenith = [0, 0, 0]; E.horizon = [0, 0, 0]; E.skyMid = [0, 0, 0]; E.fogColor = [0, 0, 0];
    const S = E.bodySky;
    if (S) {
      if (!d.ring) { S.sun = [sd[0], sd[1], sd[2], S.sun[3] * 0.56]; S.par = [S.par[0], S.par[1], S.par[2], 1e9]; if (S.B) S.B.fill(0); }
      S.ground = [0, 0, 0, 1];
    }
  };
  // /dim brocken 1 … 60 · /dim spaltmond · /dim rock.12 — the small bodies (not in /dim's list: 61 of them)
  if (VR.Travel && VR.Travel.command) {
    const origCmd = VR.Travel.command;
    VR.Travel.command = function (g, a) {
      const w = String((a || []).join(' ')).trim().toLowerCase();
      let id = null;
      const m = /^(?:brocken|rock|ts-?)\s*0*(\d+)$/.exec(w);
      if (m && +m[1] >= 1 && +m[1] <= 60) id = 'rock.' + (+m[1] - 1);
      else if (/^rock\.(\d+|m)$/.test(w) && VR.DimReg.has(w)) id = w;
      else if (w === 'spaltmond' || w === 'gap moon' || w === 'gapmoon') id = 'rock.m';
      if (id) { VR.Travel.go(g, { dim: id, via: 'cmd' }); return true; }
      return origCmd.apply(this, arguments);
    };
  }
})(VR);

// ============================================================================
// r-gemalt 2 · Gemaltes Licht — the painted film look on top of Weiche Natur (plan
// docs/superpowers/plans/2026-11-07-r-gemalt2.md; vision principle 1: „Das Licht ist ein Gemälde: warmes Licht, farbige
// Schatten, Kantenlicht, Luft in der Ferne“). The pure part (no GL): the switches, the light ramp, the warm/cool key by
// the hour, the aerial bands, the brush-stroke grass' placement and the trampling — each with the GLSL text made from
// the same numbers (test/gemalt2.js compares them). The GL side: gemalt2_gl.js.
//   gPaint  Gemaltes Licht (cost low, one define GM_PAINT in the terrain and far-tile programs): the light on the sculpted
//           ground in three soft bands (lit / half / shade), warm light and cool blue-violet shade by the hour on
//           everything (the built things too: one palette), a rim of light on the silhouettes against the sky, the
//           distance in soft bands of cooler, paler air.
//   gTuft   Pinselgras (cost medium, its own small program and the define GM_STROKE): the lawns painted in strokes (dark
//           root → light tip, colour patches), and within ~18 m painted grass clumps on the grass that sway in the wind
//           and lie flat for a moment where a foot stepped.
//   gWater  Gemaltes Wasser (cost low, the define GM_WATER in the water's program): soft foam lines along the shore, the
//           shallows a painted turquoise band.
// Pinselgras and Gemaltes Wasser: Balanced and up (the default). Gemaltes Licht: a look to switch on (off by default:
// realism first). Very Low and Low never (no define, no program).
// ============================================================================
(function (VR) {
  'use strict';
  const G2 = VR.Gemalt2 = VR.Gemalt2 || {};
  G2.SW = ['gPaint', 'gTuft', 'gWater'];
  const OFF = { gPaint: false, gTuft: false, gWater: false }, ON = { gPaint: true, gTuft: true, gWater: true };
  // (2026-11-15, the owner: realism first — the painted light is a look you choose, not the default; the grass and the
  // water stay on from Balanced up)
  const NAT = { gPaint: false, gTuft: true, gWater: true };
  const TIERS = { potato: OFF, low: OFF, balanced: NAT, high: NAT, ultra: NAT, ultraLite: NAT };
  G2.defaults = (preset) => Object.assign({}, TIERS[preset] || OFF);
  G2.off = () => Object.assign({}, OFF);
  G2.ROWS = [
    { key: 'gPaint', g: 'img', sec: 'objects', t: 'switch', lab: 'g.set.gPaint', tip: 'g.set.gPaint.tip', cost: 'low', def: false },
    { key: 'gTuft', g: 'img', sec: 'objects', t: 'switch', lab: 'g.set.gTuft', tip: 'g.set.gTuft.tip', cost: 'medium', def: false },
    { key: 'gWater', g: 'img', sec: 'objects', t: 'switch', lab: 'g.set.gWater', tip: 'g.set.gWater.tip', cost: 'low', def: false },
  ];
  const lite = (s) => !s || s.lite || s.preset === 'potato' || s.preset === 'low';
  G2.on = (s, k) => !!(s && s[k]) && !lite(s);
  G2.key = (s) => G2.SW.map(k => G2.on(s, k) ? 1 : 0).join('');

  // ---------------------------------------------------------------- the light ramp: three soft bands
  // x: how much of the sun reaches the point (n·l × the shadow), 0…1 → shade 0 · half HALF · lit 1, each step W wide
  G2.RAMP = { t1: 0.14, t2: 0.5, w: 0.08, half: 0.52 };
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  G2.ss = ss;
  G2.ramp = (x) => { const R = G2.RAMP; return R.half * ss(R.t1 - R.w, R.t1 + R.w, x) + (1 - R.half) * ss(R.t2 - R.w, R.t2 + R.w, x); };
  const f4 = (v) => (+v).toFixed(4);
  G2.glslRamp = () => { const R = G2.RAMP; return 'float gmRamp(float x) { return ' + f4(R.half) + ' * smoothstep(' + f4(R.t1 - R.w) + ', ' + f4(R.t1 + R.w) + ', x) + ' + f4(1 - R.half) + ' * smoothstep(' + f4(R.t2 - R.w) + ', ' + f4(R.t2 + R.w) + ', x); }\n'; };

  // ---------------------------------------------------------------- the air: distance in soft bands
  // 0 at D0 metres, 1 at D1, in BANDS steps whose edges are EDGE of a band wide (a painter's planes of distance)
  G2.AIR = { d0: 26, d1: 230, bands: 3, edge: 0.5 };
  G2.air = (d) => { const A = G2.AIR, t = Math.min(1, Math.max(0, (d - A.d0) / (A.d1 - A.d0))) * A.bands, f = Math.floor(t), r = t - f; return Math.min(1, (f + ss(0.5 - A.edge / 2, 0.5 + A.edge / 2, r)) / A.bands); };
  G2.glslAir = () => { const A = G2.AIR; return 'float gmAir(float d) { float t = clamp((d - ' + f4(A.d0) + ') / ' + f4(A.d1 - A.d0) + ', 0.0, 1.0) * ' + f4(A.bands) + '; float f = floor(t); return min(1.0, (f + smoothstep(' + f4(0.5 - A.edge / 2) + ', ' + f4(0.5 + A.edge / 2) + ', t - f)) / ' + f4(A.bands) + '); }\n'; };

  // ---------------------------------------------------------------- the warm / cool key by the hour
  // knots by the sun's height (sunDir.y): the light's colour and the shade's, each brought to luma 1 (the picture's
  // brightness stays; only the temperature moves). Night: moonlit blue both; dusk: rose light, violet shade; the golden
  // hour: amber light, blue-violet shade; noon: a whisper warm and cool
  G2.KEY = [
    [-0.2, [0.86, 0.95, 1.16], [0.84, 0.92, 1.16]],
    [0.0, [1.3, 0.88, 0.76], [0.82, 0.78, 1.26]],
    [0.12, [1.28, 1.0, 0.68], [0.74, 0.84, 1.3]],
    [0.35, [1.16, 1.0, 0.8], [0.8, 0.9, 1.24]],
    [0.75, [1.1, 1.0, 0.86], [0.84, 0.93, 1.2]],
  ];
  const luma = (c) => c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
  G2.luma = luma;
  G2.palette = (sunY, out) => {
    const K = G2.KEY, o = out || { lit: [1, 1, 1], shade: [1, 1, 1] };
    let i = 0; while (i < K.length - 2 && sunY > K[i + 1][0]) i++;
    const a = K[i], b = K[i + 1], t = Math.min(1, Math.max(0, (sunY - a[0]) / (b[0] - a[0])));
    for (const [k, j] of [['lit', 1], ['shade', 2]]) {
      const c = o[k]; for (let n = 0; n < 3; n++) c[n] = a[j][n] + (b[j][n] - a[j][n]) * t;
      const l = luma(c); for (let n = 0; n < 3; n++) c[n] /= l;
    }
    return o;
  };
  // strengths (u_gmK): x the paint (bands + key), y the rim, z the air, w the lawn strokes
  G2.K = { paint: 0.9, rim: 0.5, air: 0.75, stroke: 1.0 };   // (run 2: the air and the rim a step stronger — the far land read alike at 320 px)

  // ---------------------------------------------------------------- the GLSL (terrain and far tiles; both under GM_PAINT)
  G2.glslTerrain = () => '#if defined(GM_PAINT) || defined(GM_STROKE)\n// r-gemalt 2 · Gemaltes Licht (gemalt2.js)\nuniform vec3 u_gmLit;\nuniform vec3 u_gmShade;\nuniform vec4 u_gmK;\n#endif\n#ifdef GM_PAINT\n' + G2.glslRamp() + G2.glslAir() +
    // the air: cooler, paler with each band — the colour toward its own grey in the shade's tint, lifted toward the haze
    'vec3 gmAirCol(vec3 c, float d, vec3 haze) { float a = gmAir(d) * u_gmK.z; float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); vec3 g = mix(vec3(l), c, 0.5) * u_gmShade; return mix(c, mix(g, haze, 0.3), a); }\n' +
    // the rim: a painted edge of light on the silhouettes (the normal turned from the eye), strongest against the light
    'float gmRim(vec3 n, vec3 V, vec3 L, float d) { float f = 1.0 - max(dot(n, V), 0.0); f = f * f * f; return f * (0.25 + 0.75 * max(dot(-V, L), 0.0)) * smoothstep(-0.2, 0.25, dot(n, L) + 0.15) * (1.0 - smoothstep(60.0, 140.0, d)); }\n' +
    '#endif\n' + G2.glslStroke();
  // the lawn's strokes (GM_STROKE): on a green sculpted top, short strokes in rows that turn slowly over the meadow, each
  // dark at its root and light at its tip in four tones; patches of warmer and cooler green over metres; gone by 40 m
  G2.STROKE = { len: 0.55, rows: 3.2, tones: 4, far: 40 };
  G2.glslStroke = () => { const S = G2.STROKE; return '#ifdef GM_STROKE\nvec3 gmStroke(vec3 c, vec3 wp, float dist) {\n' +
    '  float k = 1.0 - smoothstep(' + f4(S.far * 0.5) + ', ' + f4(S.far) + ', dist); if (k <= 0.0) return c;\n' +
    '  float ang = texture(u_noise, wp.xz / 47.0 + vec2(0.29, 0.83)).r * 3.0 + 0.6;\n' +
    '  vec2 cs = vec2(cos(ang), sin(ang)); vec2 s = vec2(cs.x * wp.x + cs.y * wp.z, -cs.y * wp.x + cs.x * wp.z) * vec2(1.0 / ' + f4(S.len) + ', ' + f4(S.rows) + ');\n' +
    '  float row = floor(s.y); s.x += texture(u_noise, vec2(row * 0.137, 0.41)).r * 7.0;\n' +
    '  float t = fract(s.x), id = floor(s.x);\n' +
    '  float across = abs(fract(s.y) - 0.5) * 2.0, w = 1.0 - smoothstep(0.55 - 0.4 * t, 0.95 - 0.4 * t, across);\n' +
    '  float tone = floor(t * ' + f4(S.tones) + ') / ' + f4(S.tones - 1) + ';\n' +
    '  float hv = texture(u_noise, vec2(id * 0.071, row * 0.113)).g;\n' +
    '  vec3 sc = c * mix(0.72, 1.24, tone) * mix(vec3(1.0, 1.0, 1.0), mix(vec3(1.1, 1.04, 0.78), vec3(0.86, 1.0, 1.12), hv), 0.6);\n' +
    '  vec3 r = mix(c * 0.9, sc, w);\n' +
    '  return mix(c, r, k * u_gmK.w);\n}\n#endif\n'; };
  G2.glslWater = () => '#ifdef GM_WATER\n// r-gemalt 2 · Gemaltes Wasser (gemalt2.js): foam lines that run toward the bank, the shallows a painted turquoise\n' +
    'vec3 gmWater(vec3 col, vec3 wp, float vdep, float dist, vec3 litC) {\n' +
    '  float far = 1.0 - smoothstep(30.0, 70.0, dist);\n' +
    '  vec3 shal = vec3(0.32, 0.78, 0.74) * litC;\n' +
    '  col = mix(col, shal, (1.0 - smoothstep(0.05, 1.8, vdep)) * 0.5 * far);\n' +
    '  float br = texture(u_noise, wp.xz / 6.5 + vec2(u_time * 0.01, 0.0)).r;\n' +
    '  float ph = vdep * 1.7 + u_time * 0.18 + br * 0.6;\n' +
    '  float ln = 1.0 - smoothstep(0.12, 0.24, abs(fract(ph) - 0.5));\n' +
    '  float m = ln * (1.0 - smoothstep(0.4, 2.2, vdep)) * smoothstep(0.3, 0.5, br) * far;\n' +
    '  float edge = (1.0 - smoothstep(0.0, 0.22, vdep)) * smoothstep(0.25, 0.5, br) * far;\n' +
    '  return mix(col, vec3(0.95, 0.97, 1.0) * litC, clamp(max(m * 0.85, edge * 0.9), 0.0, 1.0));\n}\n#endif\n';

  // ---------------------------------------------------------------- the brush-stroke grass: placement
  // per grass column up to PER clumps at hashed spots; the farther from the eye, the fewer stay (a clump keeps its place:
  // it stays while its own hash is below the density there and shrinks into the threshold, so nothing pops)
  G2.TUFT = { per: 3, near: 6, R: { balanced: 13, high: 18, ultra: 18, ultraLite: 15 }, max: 4096 };
  G2.tuftR = (preset) => G2.TUFT.R[preset] !== undefined ? G2.TUFT.R[preset] : (preset === 'potato' || preset === 'low' ? 0 : G2.TUFT.R.balanced);   // ('custom' — a switch moved: Balanced's)
  const hash = (x, z, i) => { let h = (Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(z | 0, 0x165667b1) ^ Math.imul(i + 1, 0x9e3779b1)) >>> 0; h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0; h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  G2.hash = hash;
  G2.density = (d, R) => d <= G2.TUFT.near ? 1 : d >= R ? 0 : 1 - (d - G2.TUFT.near) / (R - G2.TUFT.near);
  // the clumps of column (x, z) seen from distance d: [{ox, oz, rot, s, tone}] (s: the size, 0 → gone)
  G2.clumps = (x, z, d, R, out) => {
    const o = out || []; o.length = 0;
    const dn = G2.density(d, R);
    for (let i = 0; i < G2.TUFT.per; i++) {
      const h = hash(x, z, i * 5);
      if (h >= dn) continue;
      const s = Math.min(1, (dn - h) / 0.12);   // (shrinks into the threshold)
      o.push({ ox: hash(x, z, i * 5 + 1), oz: hash(x, z, i * 5 + 2),   // (the whole column: a bare border line read as the block grid)
       rot: hash(x, z, i * 5 + 3) * Math.PI, s: s * (0.75 + 0.5 * hash(x, z, i * 5 + 4)), tone: hash(z, x, i) });
    }
    return o;
  };
  // trampled: the marks a foot left (x, z, time); a mark lies flat for HOLD seconds, then the grass rises over RISE
  G2.TRAMPLE = { r0: 0.3, r1: 0.75, hold: 0.6, rise: 1.6, n: 16, step: 0.35 };
  G2.markK = (age) => { const T = G2.TRAMPLE; return age <= T.hold ? 1 : age >= T.hold + T.rise ? 0 : 1 - (age - T.hold) / T.rise; };
  G2.trampleAt = (x, z, marks, now) => { const T = G2.TRAMPLE; let f = 0; for (const m of marks) { const d = Math.hypot(x - m[0], z - m[1]); f = Math.max(f, G2.markK(now - m[2]) * (1 - ss(T.r0, T.r1, d))); } return f; };
  // a foot at (x, z): a new mark, or the near one refreshed (marks: a ring of N)
  G2.step = (marks, x, z, now) => {
    const T = G2.TRAMPLE;
    for (const m of marks) if (Math.abs(m[0] - x) < T.step && Math.abs(m[1] - z) < T.step) { m[2] = now; return marks; }
    if (marks.length < T.n) marks.push([x, z, now]);
    else { let o = 0; for (let i = 1; i < marks.length; i++) if (marks[i][2] < marks[o][2]) o = i; marks[o][0] = x; marks[o][1] = z; marks[o][2] = now; }
    return marks;
  };

  // ---------------------------------------------------------------- joined to q-art3's switches (as gemalt.js)
  const Q3 = VR.QArt3;
  if (Q3 && !Q3._gemalt2) {
    Q3._gemalt2 = 1;
    for (const k of G2.SW) if (!Q3.SW.includes(k)) Q3.SW.push(k);
    const d0 = Q3.defaults, o0 = Q3.off;
    Q3.defaults = (p) => Object.assign(d0(p), G2.defaults(p));
    Q3.off = () => Object.assign(o0(), G2.off());
    Q3.ROWS = Q3.ROWS.concat(G2.ROWS);
  }
  // the defines by program: GM_PAINT in the terrain's and the far tiles' programs, GM_STROKE in the terrain's, GM_WATER in
  // the water's (trans)
  G2.defs = (name, s) => {
    const d = [];
    if ((name === 'terrain' || name === 'lod' || name === 'lodFar' || name === 'form') && G2.on(s, 'gPaint')) d.push('GM_PAINT');
    if (name === 'terrain' && G2.on(s, 'gTuft')) d.push('GM_STROKE');
    if (name === 'trans' && G2.on(s, 'gWater')) d.push('GM_WATER');
    return d;
  };
  if (VR.GL) { const prev = VR.GL.defineHook || null; VR.GL.defineHook = (name, defines) => { let d = prev ? prev(name, defines) : (defines || []); for (const k of G2.defs(name, VR.game && VR.game.settings)) if (!d.includes(k)) d = d.concat([k]); return d; }; }
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

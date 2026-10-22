// ============================================================================
// u-space0 · the bodies' textures for the space scene (docs/superpowers/plans/2026-10-22-u-space0.md §2.1).
// Pure: the worker runs it (worker_main.js 'bodytex'), node tests too. Every texture is a set of rows of RGBA8, made in
// row jobs of ≤ 0.8 s so the pool's workers share a big one.
//   herz     Herzwelt, equirect (λ −π..π across, θ 0..π down): A = albedo (sRGB) + water, B = lights · clouds · the
//            height code · ice — one sample of the world's own generator a texel through the chart (the far look: mipmaps average the
//            km-sized mosaic of seas, forests and snowfields the overworld really is)
//   patch    the plane round a nadir (the camera's ground point), square, `step` metres a texel: the same channels at
//            100 m (Very Low) / 50 m (High) — the true mosaic under the camera, the villages' lights from the village
//            cells' own spots
//   amarant  the giant's zones (cream) and belts (lilac-violet — the trailer's licence, U§12), streaky edges, white ovals,
//            the great storm, the polar polygon jet
//   ring     2048 radial texels from 1.24 to 2.27 R: the particles' colour (sRGB) and τ/3 in alpha (REFERENCE §4.2)
//   aqua · zinn · opal · basalt · ocker   the moons from palette noise on the sphere (seamless 3-D noise; their worlds
//            and generators come with wave 4–5 — U§6.3)
// Herzwelt's chart (U§4.5) is here too: azimuthal equidistant about the north pole, the Heartland (0, 0) 41.8 km from it,
// true north 22.9° east of the map's north, λ 0 through the Heartland and growing to the east. (u-orbit's
// VR.Universe.chart takes its place at the merge: same convention.)
// ============================================================================
(function (VR) {
  'use strict';
  const BT = VR.BodyTex = {};
  const D2R = Math.PI / 180, TAU = Math.PI * 2;
  const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const ss = (a, b, x) => { let t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
  const wrapPi = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
  const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  // ---------------------------------------------------------------- the chart
  const C = BT.CHART = { R: 99550, pole: 41800, alpha: 22.9 * D2R };
  C.Px = C.pole * Math.sin(C.alpha); C.Pz = -C.pole * Math.cos(C.alpha);
  C.thetaH = C.pole / C.R;                       // the Heartland's colatitude (24.06°: 65.94° N)
  C.phiH = Math.atan2(-C.Pz, -C.Px);             // the Heartland's azimuth about the pole on the plane
  BT.toPlane = (th, lam) => { const rho = C.R * th, phi = C.phiH - lam; return [C.Px + rho * Math.cos(phi), C.Pz + rho * Math.sin(phi)]; };
  BT.toSphere = (x, z) => { const dx = x - C.Px, dz = z - C.Pz; return [Math.hypot(dx, dz) / C.R, wrapPi(C.phiH - Math.atan2(dz, dx))]; };
  // the unit normal of (θ, λ) in Herzwelt's body frame (y north; λ east-positive: at λ 0 east is −z)
  BT.normal = (th, lam, out) => { const o = out || [0, 0, 0], s = Math.sin(th); o[0] = s * Math.cos(lam); o[1] = Math.cos(th); o[2] = -s * Math.sin(lam); return o; };
  // how far the map's north is turned from true north at (x, z): the angle from map north (−z) to the pole's direction
  BT.northTurn = (x, z) => Math.atan2(C.Px - x, -(C.Pz - z));
  // the height code of the B texture: h metres over the sea → 0..255, 128 the shore; 3 a metre below the sea (to 42 m
  // deep), h / (h + 48) above it (the peaks of 160 m still apart) — space_shaders.js hOf() is the inverse
  BT.hcode = (h) => clamp(Math.round(h < 0 ? 128 + h * 3 : 128 + 127 * h / (h + 48)), 0, 255);
  BT.hdecode = (code) => { const c = code - 128; return c < 0 ? c / 3 : 48 * c / Math.max(127 - c, 2.5); };

  // ---------------------------------------------------------------- the ring (REFERENCE §4.2 scaled to Amarant)
  // Saturn's main rings span 1.24–2.27 of its radius exactly as Amarant's do (U§2.1); the Cassini gap 73 km, the 5-km gap
  const RING = BT.RING = { r0: 1.24, r1: 2.27, cB: 1.53, bA: 1.95, cassini: [1.95, 2.028], gap5: 2.214, gapW: 0.0053 };
  // the optical depth τ(r) (normal to the ring), r in equatorial radii — the profile without the fine ringlets
  BT.ringTau = function (r) {
    if (r < RING.r0 || r > RING.r1) return 0;
    if (r < RING.cB) {   // C: translucent, a few plateaus
      const pl = ss(1.355, 1.36, r) * (1 - ss(1.38, 1.385, r)) + ss(1.41, 1.415, r) * (1 - ss(1.432, 1.437, r)) + ss(1.465, 1.47, r) * (1 - ss(1.485, 1.49, r));
      return 0.07 + 0.05 * ss(1.24, 1.5, r) + 0.2 * pl + 0.15 * ss(1.5, 1.53, r);
    }
    if (r < RING.bA) {   // B: opaque, the core densest, a sharp outer edge
      const inner = 0.75 + 0.55 * ss(1.53, 1.62, r);
      const core = 0.75 * ss(1.6, 1.68, r) * (1 - ss(1.84, 1.9, r));
      return inner + core + 0.25 * Math.sin(r * 61) * ss(1.6, 1.66, r) * (1 - ss(1.86, 1.9, r));
    }
    if (r < RING.cassini[1]) return 0.04 + 0.06 * Math.exp(-(((r - 1.99) / 0.006) ** 2));   // the Cassini gap, a faint ringlet
    if (Math.abs(r - RING.gap5) < RING.gapW / 2) return 0;   // the 5-km gap (a moonlet's, U§7.1)
    return 0.95 - 0.4 * ss(2.03, 2.26, r) + 0.06 * Math.sin(r * 140) * (1 - ss(2.2, 2.26, r));   // A: falling outward
  };

  // ---------------------------------------------------------------- sizes and jobs
  const T = (tier) => clamp(tier | 0, 0, 3);
  // [w, h] of a texture by the spaceDetail tier (0 Very Low … 3 High); patch: [texels a side, metres a texel]
  BT.size = function (kind, tier) {
    const t = T(tier);
    if (kind === 'herz' || kind === 'amarant') return t >= 2 ? [1024, 512] : [512, 256];
    if (kind === 'patch') return t >= 2 ? [1024, 50] : [512, 100];
    if (kind === 'ring') return [2048, 1];
    return t >= 2 ? [512, 256] : [256, 128];   // a moon
  };
  BT.MOONS = ['aqua', 'zinn', 'opal', 'basalt', 'ocker'];
  BT.TWO = { herz: 1, patch: 1 };   // the bodies with a second texture (B)
  // the row jobs of one texture: ~131k texels a job for Herzwelt's globe (≈ 0.5 s), 65k for the patch (its villages and
  // finer clouds: ≈ 0.45 s), more for the cheap ones
  BT.jobs = function (body, tier, extra) {
    const kind = BT.MOONS.includes(body) ? 'moon' : body, sz = BT.size(kind, tier);
    const w = sz[0], h = body === 'patch' ? sz[0] : sz[1];
    const per = body === 'herz' ? 131072 : body === 'patch' ? 65536 : body === 'ring' ? 1 << 20 : 98304;
    const rows = Math.max(1, Math.floor(per / w)), out = [];
    for (let y0 = 0; y0 < h; y0 += rows) out.push(Object.assign({ type: 'bodytex', body, w, h, y0, y1: Math.min(h, y0 + rows) }, body === 'patch' ? { step: sz[1] } : null, extra || null));
    return out;
  };
  // the GPU bytes of the space layer's textures at a tier (two patches kept, mipmaps ⅓ more)
  BT.gpuBytes = function (tier) {
    const b = (w, h, n) => w * h * 4 * n * 4 / 3;
    const H = BT.size('herz', tier), P = BT.size('patch', tier), A = BT.size('amarant', tier), Mo = BT.size('moon', tier);
    return b(H[0], H[1], 2) + b(P[0], P[0], 4) + b(A[0], A[1], 1) + b(Mo[0], Mo[1], BT.MOONS.length) + 2048 * 4;
  };

  // ---------------------------------------------------------------- the job
  BT.job = function (m, getGen) {
    const t0 = now();
    const w = m.w | 0, h = m.h | 0, y0 = clamp(m.y0 | 0, 0, h), y1 = clamp(m.y1 === undefined ? h : m.y1 | 0, y0, h), rows = y1 - y0;
    const a = new Uint8Array(w * rows * 4), b = BT.TWO[m.body] ? new Uint8Array(w * rows * 4) : null;
    const seed = (m.seed === undefined ? 0x5eed : m.seed) >>> 0;
    if (m.body === 'herz' || m.body === 'patch') {
      const g = getGen ? getGen('overworld') : null;
      if (g && g.computeClimate) (m.body === 'herz' ? herz : patch)(g, m, w, h, y0, y1, a, b);
    } else if (m.body === 'amarant') amarant(seed, w, h, y0, y1, a);
    else if (m.body === 'ring') ring(seed, w, a);
    else if (MOON[m.body]) moon(m.body, seed, w, h, y0, y1, a);
    return { type: 'bodytex', id: m.id, body: m.body, key: m.key, w, h, y0, y1, a, b, ms: +(now() - t0).toFixed(1), transfer: b ? [a.buffer, b.buffer] : [a.buffer] };
  };

  // ---------------------------------------------------------------- Herzwelt's surface from the generator
  const BAD = /ocean|river|beach|shore|swamp|mangrove|mushroom|peaks|ice_spikes|deep_dark|frozen_river|stony/;   // (gen_village.js: no village there)
  const CANON = { c: 0, e: 0, w: 0, t: 0, h: 0, H: 70, A: 3, river: 0, mountain: 0, ember: 0, canyon: 0, prism: 0, hz1: 1, hz2: 0, hz3: 0, heart: 0 };
  const COAST = [214, 204, 166], ICE = [206, 220, 236];   // (a water texel's albedo is the beach the coast blends into; the sea itself is the shader's, by depth)
  // the sampler: a cell's colour by its biome (lod.js LOD.look once a biome, the canopy blended in — the far horizon's
  // colours), the water by depth, snow by height; the clouds a field of our own on the sphere
  function sampler(g) {
    const LOD = VR.LOD, BI = VR.BIOMES, SEA = VR.C.SEA;
    const P = LOD && LOD.palette ? LOD.palette() : null, lk = {}, cache = new Map();
    const land = (bi, cl, X, Z, y) => {
      let c = cache.get(bi);
      if (!c) {
        const B = BI[bi] || BI[0];
        let t = [110, 140, 80], kd = 0;
        // (one canonical cell a biome — the same colour whichever texel or row job meets the biome first)
        if (P && B) { LOD.look(g, P, B, B.key, CANON, 0, 0, SEA + 8, 0, 64, lk); t = lk.t; kd = lk.kd; const tr = LOD.util.TREES[B.key]; if (tr && kd !== 6) t = LOD.util.mixc(t, LOD.util.leafCol(tr[1], B), Math.min(1, tr[0] * 1.1)); }
        c = { t: [t[0], t[1], t[2]], kd, temp: B ? B.temp : 0.5, frozen: !!(B && B.frozen), live: !!(B && !B.ocean && !BAD.test(B.key)) };
        cache.set(bi, c);
      }
      return c;
    };
    const snow = [212, 222, 234];   // (the snowfields a shade bluer and darker than the clouds over them)
    // o: [r, g, b (sRGB albedo), water 0/1, ice 0/1, liveable 0/1, the height code]. The height code (BT.hcode) is
    // continuous: the shader finds the coast where it crosses 128 between the texels — round shores, not squares —,
    // colours the sea by its depth and shades the land's relief
    return function (X, Z, o) {
      const cl = g.computeClimate(X, Z), y = Math.round(cl.H), bi = g.biomeFor(cl, y), c = land(bi, cl, X, Z, y);
      const cold = (c.temp - Math.max(0, y - 90) * 0.0025) < 0.15;
      if (y < SEA) {
        const ice = cold || c.frozen;
        const t = ice ? ICE : COAST;   // (ICE the same shade as the snow)
        o[0] = t[0]; o[1] = t[1]; o[2] = t[2]; o[3] = 1; o[4] = ice ? 1 : 0; o[5] = 0;
      } else {
        const t = cold || c.kd === 6 ? snow : c.t;
        o[0] = t[0]; o[1] = t[1]; o[2] = t[2]; o[3] = 0; o[4] = 0;
        o[5] = c.live && y > SEA + 2 && y <= 150 && cl.river < 0.3 && !(cl.ember > 0.45) ? 1 : 0;
      }
      o[6] = BT.hcode(cl.H - SEA);
      return o;
    };
  }
  // the clouds: a warped fbm on the unit sphere (Herzwelt's body frame), the same octaves for the globe and the patch
  // (the patch adds finer ones), ~30 % covered — fields of ~10 km (Earth's fronts at 1/64), broken into cells down to a
  // few hundred metres (the patch: tens)
  function clouds(seed) {
    const S = new VR.Simplex((seed ^ 0xc10d5) >>> 0), Wx = new VR.Simplex((seed ^ 0x77a1) >>> 0), Wy = new VR.Simplex((seed ^ 0x3b29) >>> 0);
    return function (x, y, z, oct) {
      const wx = Wx.n3(x * 1.7, y * 1.7, z * 1.7) * 0.22, wy = Wy.n3(x * 1.7 + 5, y * 1.7, z * 1.7) * 0.22;
      const px = x + wx, py = y + wy, pz = z - wx * 0.6;
      let v = 0, amp = 1, f = 9.5, norm = 0;
      for (let o = 0; o < oct; o++) { v += S.n3(px * f, py * f, pz * f) * amp; norm += amp; amp *= o < 2 ? 0.7 : 0.55; f *= 2.07; }
      v /= norm;
      return ss(0.0, 0.3, v + 0.06 * Math.cos(y * 9.0));   // (a hint of latitude belts)
    };
  }
  const putA = (a, i, o) => { a[i] = clamp(o[0], 0, 255); a[i + 1] = clamp(o[1], 0, 255); a[i + 2] = clamp(o[2], 0, 255); a[i + 3] = o[3] * 255; };
  // the Heartland's own lights (gen_heart.js: the city, the temple's plaza, the citadel, the station, the isles):
  // [x, z, radius m, strength]
  const HEART_LIGHTS = [[0, -140, 190, 255], [0, -10, 110, 235], [-420, 380, 90, 190], [-380, -150, 70, 170], [330, 140, 90, 140], [0, -320, 160, 150]];
  function heartLight(x, z, step) {
    let v = 0;
    for (const L of HEART_LIGHTS) { const d = Math.hypot(x - L[0], z - L[1]); const r = L[2] + step * 0.7; if (d < r) v = Math.max(v, L[3] * (1 - 0.5 * (d / r) * (d / r))); }
    return v;
  }
  function herz(g, m, w, h, y0, y1, a, b) {
    const S = sampler(g), CL = clouds(g.seed), o = [0, 0, 0, 0, 0, 0, 0], N = [0, 0, 0], M = VR.M;
    for (let j = y0; j < y1; j++) {
      const th = (j + 0.5) / h * Math.PI;
      for (let i = 0; i < w; i++) {
        const lam = (i + 0.5) / w * TAU - Math.PI;
        const p = BT.toPlane(th, lam);
        S(Math.round(p[0]), Math.round(p[1]), o);
        const k = ((j - y0) * w + i) * 4;
        putA(a, k, o);
        BT.normal(th, lam, N);
        // the lights, statistically (a village a 640² cell, ~35 % of the cells; a texel ~1.2 km): one liveable texel in
        // eight lit, the rest dark — points from far, not a glow — far views only
        const hsh = M.hashf2(i, j, g.seed ^ 0x11657);
        let L = o[5] ? (hsh < 0.12 ? 60 + hsh * 1150 : 0) : 0;
        if (Math.hypot(p[0], p[1]) < 1500) L = 255;
        b[k] = L; b[k + 1] = CL(N[0], N[1], N[2], 5) * 255; b[k + 2] = o[6]; b[k + 3] = o[4] * 255;
      }
    }
  }
  // the village cells' own spots (gen_village.js VG.siteSteps replayed: the same RNG, the cheap tests from the climate —
  // the real search also asks for flat ground, which a calm climate stands in for)
  const FLAT = [[14, 0], [-14, 0], [0, 14], [0, -14], [24, 18], [-24, -18]];
  function villages(g, x0, z0, x1, z1) {
    const VG = VR.VillageGen, M = VR.M, BI = VR.BIOMES, SEA = VR.C.SEA, out = [];
    if (!VG || !VG.par || !(g.singleBiome < 0)) return out;
    const { CELL, M: MG, RAD } = VG.par(g);
    const R1 = VR.Heart && VR.Heart.on && VR.Heart.on(g) ? VR.Heart.R1 : -1;
    for (let j = Math.floor((z0 - 300) / CELL); j <= Math.floor((z1 + 300) / CELL); j++) for (let i = Math.floor((x0 - 300) / CELL); i <= Math.floor((x1 + 300) / CELL); i++) {
      if (g.vgen >= 2 && Math.abs(i) <= 1 && Math.abs(j) <= 1 && i === 0 && j === 0) continue;   // the home city: the Heartland's own lights
      const rng = new VR.RNG(M.hash2(i, j, g.seed + 90210));
      if (!rng.chance(0.8)) continue;
      for (let k = 0; k < 10; k++) {
        const x = i * CELL + MG + rng.int(CELL - 2 * MG), z = j * CELL + MG + rng.int(CELL - 2 * MG);
        if (R1 > 0 && Math.hypot(x, z) < R1) continue;
        const cl = g.computeClimate(x, z), hh = Math.round(cl.H);
        if (hh <= SEA + 2 || hh > 150) continue;
        const bk = BI[g.biomeFor(cl, hh)];
        if (!bk || bk.ocean || BAD.test(bk.key)) continue;
        if ((cl.canyon || 0) > 0.18 || (cl.ember || 0) > 0.45 || cl.river > 0.3 || cl.A > 8 || cl.mountain > 0.35) continue;
        // the search wants dry, gentle ground round the spot: six climate heights stand in for its 24 terrain samples
        // (scratch measure on 169 cells: 88 % of these lights are real villages, 72 % of the villages lit)
        let mx = hh, mn = hh, wet = 0;
        for (const o of FLAT) { const c2 = g.computeClimate(x + o[0], z + o[1]); if (c2.H > mx) mx = c2.H; if (c2.H < mn) mn = c2.H; if (c2.H <= SEA + 1) wet++; }
        if (mx - mn > 8 || wet > 1) continue;
        // [x, z, radius, strength, the lit share of the radius (the village's own size, 0.55–1.1)]
        out.push([x, z, g.vgen >= 9 ? 100 : RAD, 150 + ((M.hash2(i, j, 7) >>> 0) % 90), 0.55 + 0.55 * M.hashf2(i, j, 0x51e)]);
        break;
      }
    }
    return out;
  }
  function patch(g, m, w, h, y0, y1, a, b) {
    const S = sampler(g), CL = clouds(g.seed), o = [0, 0, 0, 0, 0, 0, 0], N = [0, 0, 0], M = VR.M;
    const step = m.step || 100, cx = m.cx || 0, cz = m.cz || 0, half = w * step / 2;
    const X0 = cx - half, Z0 = cz - half;
    const V = villages(g, X0, Z0 + y0 * step, X0 + w * step, Z0 + y1 * step);
    for (let j = y0; j < y1; j++) {
      const z = Z0 + (j + 0.5) * step;
      const VR_ = V.filter(v => Math.abs(z - v[1]) < v[2] * v[4] + step * 0.4);   // (the villages this row meets)
      for (let i = 0; i < w; i++) {
        const x = X0 + (i + 0.5) * step;
        S(Math.round(x), Math.round(z), o);
        const k = ((j - y0) * w + i) * 4;
        putA(a, k, o);
        const sp = BT.toSphere(x, z); BT.normal(sp[0], sp[1], N);
        let L = 0;
        for (const v of VR_) { const dx = x - v[0], dz = z - v[1], r = v[2] * v[4] + step * 0.4; if (dx * dx + dz * dz < r * r) { const q = 1 - (dx * dx + dz * dz) / (r * r); L = Math.max(L, v[3] * q * Math.sqrt(q) * (0.55 + 0.45 * M.hashf2(Math.floor(x / step), Math.floor(z / step), 0x5e7))); } }
        if (Math.abs(x) < 1400 && Math.abs(z) < 1400) L = Math.max(L, heartLight(x, z, step));
        // the farmsteads and roads between: a faint scatter on liveable land
        if (!L && o[5] && M.hashf2(Math.floor(x / 160), Math.floor(z / 160), g.seed ^ 0x7a3) < 0.07) L = 30;
        b[k] = L; b[k + 1] = CL(N[0], N[1], N[2], 9) * 255; b[k + 2] = o[6]; b[k + 3] = o[4] * 255;
      }
    }
  }

  // ---------------------------------------------------------------- Amarant: zones and belts
  const ZONE = [238, 226, 204], ZONE2 = [232, 210, 200], ZONE3 = [244, 236, 220], BELT = [172, 132, 200], BELT2 = [148, 108, 184], BELT3 = [196, 156, 182], BELT4 = [126, 98, 170], POLE = [122, 118, 166], JET = [92, 80, 150];
  // north → south: [latitude of the band's southern edge, colour] (the first band runs from the pole)
  const BANDS = [[66, POLE], [58, BELT4], [51, ZONE2], [45, BELT3], [38, ZONE], [32, BELT], [24, ZONE2], [9, BELT2], [-7, ZONE3], [-20, BELT], [-27, ZONE], [-33, BELT2], [-40, ZONE2], [-46, BELT3], [-53, ZONE], [-61, BELT4], [-90, POLE]];
  function bandAt(lat) {
    let prevEdge = 90, prev = BANDS[0][1];
    for (let i = 0; i < BANDS.length; i++) {
      const [edge, col] = BANDS[i];
      if (lat >= edge) {
        // soft edges, 1.1° each side
        const up = i > 0 ? ss(prevEdge - 1.1, prevEdge + 1.1, lat) : 0, dn = i < BANDS.length - 1 ? 1 - ss(edge - 1.1, edge + 1.1, lat) : 0;
        let c = col;
        if (up > 0) c = mix3(c, BANDS[i - 1][1], up * 0.5);
        if (dn > 0 && i + 1 < BANDS.length) c = mix3(c, BANDS[i + 1][1], dn * 0.5);
        return c;
      }
      prevEdge = edge; prev = col;
    }
    return prev;
  }
  function amarant(seed, w, h, y0, y1, a) {
    const S = new VR.Simplex((seed ^ 0xa3a2) >>> 0), S2 = new VR.Simplex((seed ^ 0x51c7) >>> 0), M = VR.M;
    const rng = new VR.RNG((seed ^ 0x0a1a) >>> 0), ovals = [];
    for (let k = 0; k < 16; k++) ovals.push([rng.pick([-36.5, -30, -43, 27, 35, -23.5, 41]), rng.next() * TAU, 1.4 + rng.next() * 1.8]);
    const storm = [-23.5, 1.1, 7.5, 4.2];   // the great storm: latitude, longitude (rad), half-sizes in degrees (lon, lat)
    for (let j = y0; j < y1; j++) {
      const lat = 90 - (j + 0.5) / h * 180, cphi = Math.cos(lat * D2R), sphi = Math.sin(lat * D2R);
      for (let i = 0; i < w; i++) {
        const lam = (i + 0.5) / w * TAU - Math.PI;
        const px = cphi * Math.cos(lam), pz = cphi * Math.sin(lam);
        // the band edges wander: noise drawn out along the longitude (the sphere point squeezed across the bands)
        const turb = S.n3(px * 2.6, sphi * 26, pz * 2.6) * 1.5 + S2.n3(px * 7, sphi * 70, pz * 7) * 0.6;
        const latE = lat + turb;
        let c = bandAt(latE);
        // streaks inside the bands, stronger in the belts
        const st = S.n3(px * 5 + 11, sphi * 90, pz * 5) * 0.5 + S2.n3(px * 13, sphi * 160, pz * 13) * 0.25;
        const belt = c[2] > c[1] + 25 ? 1 : 0.5;
        const k1 = 1 + st * 0.11 * belt;
        c = [c[0] * k1, c[1] * k1, c[2] * k1];
        // festoons: blue-violet plumes from the northern equatorial belt into the bright zone
        if (lat < 9 && lat > -4) { const f = S2.n3(px * 9, sphi * 22, pz * 9); if (f > 0.42) c = mix3(c, BELT4, ss(0.42, 0.6, f) * ss(-4, 7, lat) * 0.7); }
        // white ovals along the belts' edges
        for (const ov of ovals) { const dl = wrapPi(lam - ov[1]) / D2R * cphi, dp = lat - ov[0]; const q = (dl * dl) / (ov[2] * ov[2] * 2.2) + (dp * dp) / (ov[2] * ov[2] * 0.5); if (q < 1) c = mix3(c, [248, 244, 238], (1 - q) * 0.85); }
        // the great storm: a teal eye in a pale collar, a darker ring round it, the inside swirled
        { const dl = wrapPi(lam - storm[1]) / D2R * cphi, dp = lat - storm[0]; const q = Math.sqrt((dl * dl) / (storm[2] * storm[2]) + (dp * dp) / (storm[3] * storm[3]));
          if (q < 1.35) { const sw = S.n3(dl * 0.35, dp * 0.35, 3.3) * 0.18; const qq = q + sw; c = mix3(c, [112, 92, 156], ss(1.35, 1.05, qq) * 0.55); c = mix3(c, [228, 238, 236], ss(1.08, 0.8, qq)); c = mix3(c, [64, 178, 186], ss(0.78, 0.25, qq)); } }
        // the polar polygon jet (seven sides) round the north pole, a dark vortex at the south pole
        if (lat > 64) {
          const sec = TAU / 7, ang = ((lam % sec) + sec) % sec - sec / 2, r0 = 14.5 * Math.cos(Math.PI / 7) / Math.cos(ang);
          const edge = 90 - r0, dj = Math.abs(lat - edge);
          if (dj < 1.6) c = mix3(c, JET, (1 - dj / 1.6) * 0.75);
          if (lat > edge) c = mix3(c, [108, 104, 156], 0.5);
        }
        if (lat < -72) c = mix3(c, [86, 76, 132], ss(-72, -86, lat) * 0.7);
        const n = (M.hashf2(i, j, seed) - 0.5) * 5;
        const k = ((j - y0) * w + i) * 4;
        a[k] = clamp(c[0] + n, 0, 255); a[k + 1] = clamp(c[1] + n, 0, 255); a[k + 2] = clamp(c[2] + n, 0, 255); a[k + 3] = 255;
      }
    }
  }

  // ---------------------------------------------------------------- the ring's profile
  function ring(seed, w, a) {
    const S = new VR.Simplex((seed ^ 0x919) >>> 0);
    const Cc = [150, 138, 128], Bc = [238, 226, 206], Gc = [118, 110, 104], Ac = [222, 212, 196];
    for (let i = 0; i < w; i++) {
      const r = RING.r0 + (i + 0.5) / w * (RING.r1 - RING.r0);
      const base = BT.ringTau(r);
      // ringlets: the fine radial structure (±18 % in B, waves in A, a little in C)
      const fine = 1 + (r < RING.cB ? 0.1 : r < RING.bA ? 0.18 : 0.12) * S.n2(r * 900, 0.5) + 0.06 * S.n2(r * 3100, 3.5);
      const tau = Math.min(3, Math.max(0, base * fine));
      let c = r < RING.cB ? mix3(Cc, Bc, ss(1.48, 1.56, r)) : r < RING.bA ? Bc : r < RING.cassini[1] ? Gc : Ac;
      if (r >= RING.bA && r < RING.cassini[1]) c = Gc;
      const k = 1 + 0.05 * S.n2(r * 400, 7.5);
      a[i * 4] = clamp(c[0] * k, 0, 255); a[i * 4 + 1] = clamp(c[1] * k, 0, 255); a[i * 4 + 2] = clamp(c[2] * k, 0, 255); a[i * 4 + 3] = Math.round(tau / 3 * 255);
    }
  }

  // ---------------------------------------------------------------- the moons from palette noise
  // each: f(p = unit normal, S = noise set, lat) → [r, g, b, alpha] (alpha: 255 rock · water glint · lava glow by kind)
  function noiseSet(seed) { const o = []; for (let k = 0; k < 4; k++) o.push(new VR.Simplex((seed + k * 7919) >>> 0)); return o; }
  const fbm = (s, x, y, z, oct, f) => { let v = 0, amp = 1, n = 0; for (let o = 0; o < oct; o++) { v += s.n3(x * f, y * f, z * f) * amp; n += amp; amp *= 0.5; f *= 2.02; } return v / n; };
  // craters: cells on the sphere, one crater a cell with a chance; returns [rim, floor, rays] at the point
  function craters(p, scale, seed, chance) {
    const M = VR.M, x = p[0] * scale, y = p[1] * scale, z = p[2] * scale;
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    let rim = 0, flr = 0, ray = 0;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const cx = ix + dx, cy = iy + dy, cz = iz + dz, h = M.hashf3(cx, cy, cz, seed);
      if (h > chance) continue;
      const ox = cx + M.hashf3(cx, cy, cz, seed + 1), oy = cy + M.hashf3(cx, cy, cz, seed + 2), oz = cz + M.hashf3(cx, cy, cz, seed + 3);
      const r = 0.12 + 0.38 * Math.pow(M.hashf3(cx, cy, cz, seed + 4), 2.2);
      const d = Math.hypot(x - ox, y - oy, z - oz) / r;
      if (d < 1.25) { rim = Math.max(rim, Math.exp(-(((d - 1) * 6) ** 2))); if (d < 1) flr = Math.max(flr, 1 - d * d); }
      if (h < chance * 0.08 && d < 4) ray = Math.max(ray, (1 - d / 4) * 0.5 * (0.5 + 0.5 * Math.sin(Math.atan2(y - oy, x - ox) * 9 + cz)));
    }
    return [rim, flr, ray];
  }
  const MOON = {
    aqua(p, S, lat, seed) {
      const n = fbm(S[0], p[0], p[1], p[2], 5, 2.2), arc = 1 - Math.abs(fbm(S[1], p[0], p[1], p[2], 3, 1.6));
      const isl = n * 0.55 + arc * 0.5 - 0.62;   // archipelagos along arcs
      const cr = craters(p, 7, seed ^ 0x47, 0.22);
      const atoll = ss(0.45, 0.7, cr[0]) * ss(-0.32, -0.2, n);
      let c = [18, 78, 112];
      c = mix3(c, [44, 150, 156], ss(-0.14, 0.0, isl));                              // the shallows
      c = mix3(c, [70, 196, 186], ss(0.32, 0.5, cr[1]) * ss(-0.36, -0.24, n) * 0.75);   // the lagoons
      const g = fbm(S[2], p[0], p[1], p[2], 3, 9);
      const landK = Math.max(ss(-0.006, 0.006, isl), atoll);
      const lc = mix3([214, 204, 160], mix3([72, 132, 74], [150, 140, 96], ss(-0.2, 0.4, g)), ss(0.006, 0.022, isl));
      c = mix3(c, lc, landK);
      const al = 1 - landK;
      const cl = ss(0.25, 0.55, fbm(S[3], p[0] * 1.3, p[1] * 3.2, p[2] * 1.3, 4, 2.0));   // squall bands
      c = mix3(c, [236, 240, 244], cl * 0.75);
      return [c[0], c[1], c[2], al ? 255 - cl * 200 : 0];
    },
    zinn(p, S, lat, seed) {
      const n = fbm(S[0], p[0], p[1], p[2], 5, 2.4), m = fbm(S[1], p[0], p[1], p[2], 4, 4.1);
      let c = mix3([220, 192, 78], [232, 150, 58], ss(-0.1, 0.35, n));
      c = mix3(c, [238, 236, 214], ss(0.2, 0.5, m) * 0.7);    // SO₂ frost
      c = mix3(c, [176, 70, 44], ss(0.3, 0.55, -m) * 0.6);     // red sulfur
      if (Math.abs(lat) > 58) c = mix3(c, [150, 112, 72], ss(58, 75, Math.abs(lat)) * 0.6);
      const cr = craters(p, 6, seed ^ 0x2e, 0.3);
      let glow = 0;
      c = mix3(c, [44, 32, 28], ss(0.38, 0.52, cr[1]) * 0.85); glow = ss(0.75, 0.95, cr[1]);       // calderas, lava lakes
      if (cr[0] > 0.2) c = mix3(c, [190, 64, 40], cr[0] * 0.6);                                     // red plume rings
      return [c[0], c[1], c[2], 255 - glow * 255];
    },
    opal(p, S, lat, seed) {
      const n = fbm(S[0], p[0], p[1], p[2], 4, 3);
      let c = mix3([226, 232, 238], [246, 248, 250], ss(-0.3, 0.4, n));
      let line = 0;
      for (let k = 1; k <= 3; k++) { const f = fbm(S[k], p[0], p[1], p[2], 3, 1.4 + k * 0.7); line = Math.max(line, 1 - ss(0.0, 0.025 + k * 0.006, Math.abs(f))); }
      c = mix3(c, [158, 102, 82], line * 0.75);                                                    // the lineae
      if (lat < -60) { const sb = Math.sin((p[0] * 0.8 + p[2] * 0.6) * 42 + n * 4); c = mix3(c, [118, 146, 182], ss(0.82, 0.97, sb) * ss(-60, -70, lat) * 0.85); }   // the tiger stripes
      const cr = craters(p, 9, seed ^ 0x0b, 0.06);
      if (cr[0] > 0.3) c = mix3(c, [196, 214, 232], cr[0] * 0.5);
      return [c[0], c[1], c[2], 255];
    },
    basalt(p, S, lat, seed) {
      const n = fbm(S[0], p[0], p[1], p[2], 5, 1.7);
      let c = mix3([92, 92, 96], [178, 174, 168], ss(-0.08, 0.12, n));     // maria and highlands
      const cr = craters(p, 10, seed ^ 0x8a, 0.45), cr2 = craters(p, 26, seed ^ 0x8b, 0.5);
      c = mix3(c, [206, 202, 194], Math.max(cr[0], cr2[0] * 0.6) * 0.55);
      c = mix3(c, [120, 118, 116], cr[1] * 0.25);
      c = mix3(c, [222, 220, 214], Math.max(cr[2], cr2[2]) * 0.8);          // young craters' rays
      const g = (fbm(S[1], p[0], p[1], p[2], 3, 30) * 14);
      return [c[0] + g, c[1] + g, c[2] + g, 255];
    },
    ocker(p, S, lat, seed) {
      const n = fbm(S[0], p[0], p[1], p[2], 5, 2.1), m = fbm(S[1], p[0], p[1], p[2], 3, 1.2);
      let c = mix3([196, 112, 62], [222, 160, 104], ss(-0.15, 0.3, n));
      c = mix3(c, [112, 66, 46], ss(0.12, 0.38, m) * 0.75);                                         // dark albedo lands
      const can = (1 - ss(0.018, 0.034, Math.abs(p[1] + 0.1 * Math.sin(Math.atan2(p[2], p[0]) * 2)))) * ss(0.15, 0.3, p[0]);   // the canyon
      c = mix3(c, [92, 54, 40], can * 0.8);
      const vd = Math.hypot(p[0] - 0.52, p[1] - 0.3, p[2] - 0.8); c = mix3(c, mix3([120, 70, 50], [210, 150, 110], ss(0.03, 0.05, vd)), (1 - ss(0.1, 0.13, vd)) * 0.6);   // the shield volcano
      const cr = craters(p, 12, seed ^ 0x0c, 0.25); c = mix3(c, [150, 92, 60], cr[0] * 0.35);
      if (Math.abs(lat) > 74) c = mix3(c, [242, 238, 232], ss(74, 80, Math.abs(lat)));               // the frost caps
      return [c[0], c[1], c[2], 255];
    },
  };
  const MOON_SEED = { aqua: 0xa9a, zinn: 0x217, opal: 0x0a1, basalt: 0xba5, ocker: 0x0c4 };
  function moon(body, seed, w, h, y0, y1, a) {
    const sd = (seed ^ MOON_SEED[body]) >>> 0, S = noiseSet(sd), f = MOON[body], p = [0, 0, 0];
    for (let j = y0; j < y1; j++) {
      const th = (j + 0.5) / h * Math.PI, lat = 90 - th / D2R;
      for (let i = 0; i < w; i++) {
        BT.normal(th, (i + 0.5) / w * TAU - Math.PI, p);
        const c = f(p, S, lat, sd), k = ((j - y0) * w + i) * 4;
        a[k] = clamp(c[0], 0, 255); a[k + 1] = clamp(c[1], 0, 255); a[k + 2] = clamp(c[2], 0, 255); a[k + 3] = clamp(c[3], 0, 255);
      }
    }
  }
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

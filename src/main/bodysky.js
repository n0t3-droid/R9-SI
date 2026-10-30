// ============================================================================
// u-moons1 · VR.BodySky — the sky and the light over Basalt and Opal (docs/superpowers/plans/2026-10-22-u-moons1.md §2.3;
// U§4.4, §6.3; R§5.1, §5.6). From VR.Universe.localSky at the eye and the world clock, every frame:
//   · the light on the ground: Helia white and sharp — no air, so it goes out the moment its disc sinks under the true
//     horizon (the terrain shader's soft sunUp is undone for it) and dims with the part of the disc a world covers (Opal's
//     daily eclipse behind Amarant); Amarant's light on the night side, from its lit part and its size in the sky (× 4 so
//     the night stays readable, U§12 — a lamp over Opal, U§4.4); the ground's own bounce as the shadows' light (Basalt's
//     dark dust a little, Opal's ice a lot); no rain, no wind, no clouds, no god rays; the far land fades into the colour
//     of the far ground, not into an air; the eye's exposure per world, by day and by night
//   · the sky program's uniforms (space_shaders.js SH.bodySky): Helia's disc and glare, the stars' frame (they stand in
//     the sky while the moon turns), Amarant (its direction, distance, pole, prime meridian, flattening), the ring, the
//     other worlds, the far ground's colour and the horizon's dip, the geysers' plumes (bodylife.js puts them in BS.plumes)
// The sky program gets BODYSKY only while a body's sky is shown: the define hook below; the programs are rebuilt once when
// that changes (the trip's veil hides it). env.js calls BS.env (one line), the renderer's common() is wrapped for the
// u_bs* uniforms — no renderer.js edit.
// ============================================================================
(function (VR) {
  'use strict';
  const BS = VR.BodySky = { want: false, eye: [0, 73.6, 0], groundY: null, plumes: [], cur: null, expo: 0, t: 0 };
  const D2R = Math.PI / 180;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const ss = (a, b, x) => { let t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
  const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  // Helia's light (F5, a white with a breath of blue; the home sun's noon is [2.9, 2.72, 2.4]) and its disc's radiance
  const SUN = [2.85, 2.9, 3.05], DISC = 60, STAR = 0.006;   // (u-orbit2: STAR the starlight's floor on the ground)
  // the worlds seen from the moons: their albedo colour (linear), their air's limb
  const LOOK = { herz: [0.3, 0.38, 0.52, 1], aqua: [0.2, 0.33, 0.5, 0.6], zinn: [0.55, 0.46, 0.22, 0], opal: [0.86, 0.88, 0.92, 0], basalt: [0.12, 0.12, 0.12, 0], ocker: [0.5, 0.3, 0.17, 0.3] };
  // per body: the ground's albedo for the far ground and the bounce (Basalt by its two grounds), the exposure by day and by
  // night (Basalt by day: the maria mid-grey and the highlands, 3.5× brighter, still short of white — run 1 at 1.35 burnt
  // them out; at night the eye opens; Opal's ice is bright), the plumes' brightness
  const KIND = {
    basalt: { alb: { basalt_mare: 0.075, basalt_highlands: 0.26, basalt_crater: 0.2 }, alb0: 0.1, tint: [1.0, 0.98, 0.95], bounce: 0.32, floor: 0.06, expoDay: 0.9, expoNight: 3.6, plume: 0 },
    opal: { alb: {}, alb0: 0.72, tint: [0.96, 0.98, 1.02], bounce: 0.38, floor: 0.05, expoDay: 0.5, expoNight: 1.7, plume: 1 },
    // u-moons2: Zinnober (sulfur bright, its lava lakes the night's own light, Amarant at 37° its lamp), Ocker and
    // Aquamarin with air (airK: the LUT's radiance → the scene's, the eye's exposure per world: Ocker's dusty sky is ~4×
    // as bright as a clear one), shape: the plumes' (1 umbrellas, 2 dust devils)
    zinn: { alb: { zinn_patera: 0.12, zinn_lava: 0.1 }, alb0: 0.55, tint: [1.0, 0.98, 0.9], bounce: 0.34, floor: 0.06, expoDay: 0.62, expoNight: 2.4, plume: 1, shape: 1 },
    ocker: { alb: {}, alb0: 0.25, tint: [1.0, 0.95, 0.9], bounce: 0.3, floor: 0.05, expoDay: 0.85, expoNight: 3.2, plume: 1, shape: 2, airK: 9, ambK: 2.6 },
    aqua: { alb: { aqua_sea: 0.06, aqua_lagoon: 0.12 }, alb0: 0.12, tint: [1.0, 1.0, 1.0], bounce: 0.25, floor: 0.05, expoDay: 0.8, expoNight: 2.6, plume: 0, shape: 0, airK: 24, ambK: 3.2 },
  };
  BS.KIND = KIND; BS.SUN = SUN;

  // ---------------------------------------------------------------- the frames
  // the body's chart frame at (x, z) and its spin at t: system → local (M, row-major) and local → the scene's fixed frame
  // (spacescene.js: scene (x, y, z) = universe (y, z, x)) for the stars
  function frames(U, id, x, z, t, out) {
    const home = U.home, st = home.cached(t), B = st.b[id].B, F = home.chart(id).frame(x, z, out.F || (out.F = new Float64Array(9)));
    const M = out.M || (out.M = new Float64Array(9));
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) M[i * 3 + j] = F[i * 3] * B[j * 3] + F[i * 3 + 1] * B[j * 3 + 1] + F[i * 3 + 2] * B[j * 3 + 2];
    // local → system = Mᵀ; the scene's axes are the system's (y, z, x): row r of the result is system row P(r) of Mᵀ
    const I = out.inert || (out.inert = new Float32Array(9)), P = [1, 2, 0];
    // (column-major for uniformMatrix3fv: I[c * 3 + r] = A[r][c], A[r][c] = Mᵀ[P(r)][c] = M[c][P(r)])
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) I[c * 3 + r] = M[c * 3 + P[r]];
    out.st = st;
    return out;
  }
  const toLocal = (M, v) => [M[0] * v[0] + M[1] * v[1] + M[2] * v[2], M[3] * v[0] + M[4] * v[1] + M[5] * v[2], M[6] * v[0] + M[7] * v[1] + M[8] * v[2]];

  // ---------------------------------------------------------------- the sky and the light at a place and a moment
  // dim: a body's dim; eye [x, y, z] (blocks); t world seconds; o: {tier, groundY, biome (key), plumes [{x, y, z, top}]}
  // → { light: the env's fields, sky: the uniforms } — pure (node: test/bodies.js i)
  BS.compute = function (dim, eye, t, o) {
    o = o || {};
    const U = VR.Universe, D = VR.DimReg && VR.DimReg.get(dim), id = D && D.body;
    if (!U || !id) return null;
    const prof = VR.Bodies.profile(id), K = KIND[id] || KIND.basalt;
    const sky = BS._sky = U.localSky(dim, eye, t, BS._sky || undefined);
    const fr = frames(U, id, eye[0], eye[2], t, BS._fr || (BS._fr = {}));
    const R = prof.R, groundY = Number.isFinite(o.groundY) ? o.groundY : prof.level;
    const he = Math.max(1, eye[1] - groundY), dip = Math.sqrt(2 * he / R), hDist = Math.sqrt(2 * R * he);
    // Helia: its part over the true horizon, its part no world covers
    const sd = sky.sun.dir, sAng = sky.sun.ang, sEl = Math.asin(Math.max(-1, Math.min(1, sd[1])));
    // u-moons2: a world with air — its LUTs (atmo_lut.js; the game hands them in, a test gets them made), Helia's light
    // through the air, the air's own light; the horizon softened over the air's refraction-free ±1.5°
    const air = prof.air && VR.AtmoLUT ? (o.air || BS.airFor(id, Math.max(1, eye[1] - groundY), sEl)) : null;
    const above = air ? ss(-dip - 0.026, -dip + sAng, sEl) : ss(-dip - sAng, -dip + sAng, sEl), free = 1 - (sky.eclipse || 0), lightK = above * free;
    // Amarant
    // (u-moons2: over Aquamarin the parent is Herzwelt; Amarant is drawn as the giant with its own direction)
    const p = sky.parent, pG = id === 'aqua' && sky._byId && sky._byId.amarant ? sky._byId.amarant : p, pd = pG.dir, A = U.home.by.amarant;
    const pAng = pG.ang, distR = 1 / Math.sin(Math.max(pAng, 1e-6)), pEl = Math.asin(Math.max(-1, Math.min(1, p.dir[1])));
    const pAbove = ss(-dip - p.ang, -dip + p.ang, pEl);
    // its light on the night side: its lit part × its solid angle (π·ang²) × its albedo 0.5 / π, × 4 (readable nights)
    const parK = 0.5 * (p.phase || 0) * p.ang * p.ang * 4 * pAbove * (id === 'aqua' ? 0.6 : 1);   // (Herzwelt's albedo 0.3)
    // u-orbit2 (R52-09: Basalt's night near black): the other worlds' shine — each lit part × its solid angle × its
    // albedo, × 4 as Amarant's — and the starlight with the galaxy's band (a floor: no moonless night is quite black)
    let othK = 0;
    for (const b of sky.bodies) {
      const L = LOOK[b.id]; if (!L || b.id === 'helia' || b.id === p.id) continue;
      const lit = 0.5 * (1 - (b.dir[0] * sd[0] + b.dir[1] * sd[1] + b.dir[2] * sd[2])), bEl = Math.asin(Math.max(-1, Math.min(1, b.dir[1])));
      othK += (0.2126 * L[0] + 0.7152 * L[1] + 0.0722 * L[2]) * lit * b.ang * b.ang * 4 * ss(-dip - b.ang, -dip + b.ang, bEl);
    }
    const parLight = SUN.map(v => v * (parK + othK));
    // the ground's albedo here (Basalt: the mare's dark dust or the highlands' bright), its far colour in this light
    const alb = (o.biome && K.alb[o.biome] !== undefined ? K.alb[o.biome] : K.alb0);
    const sunT = air ? air.sunT : [1, 1, 1];
    const sunLight = SUN.map((v, i) => v * lightK * sunT[i] * (VR.Grade ? VR.Grade.sunK : 1));
    const sinEl = Math.max(0, sd[1]);
    // (u-moons2: the air's light from the three stops — the sky's irradiance π·L̄ — over the ground's bounce)
    const skyL = air ? air.stops.zen.map((z, i) => (0.45 * z + 0.4 * air.stops.hor[i] + 0.15 * air.stops.sunHor[i]) * SUN[i] * Math.PI * K.ambK * free) : [0, 0, 0];
    const amb = sunLight.map((v, i) => (v * alb * K.bounce + parLight[i] * 0.35 + K.floor * 0.02 + STAR + skyL[i]) * K.tint[i]);
    const far = air ? air.stops.hor.map((h, i) => h * SUN[i] * K.airK * free + alb * parLight[i] * 0.3) : sunLight.map((v, i) => alb * (v * (0.18 + 0.6 * sinEl) + parLight[i] * 0.6 + amb[i]) * K.tint[i]);
    const night = 1 - ss(0, 1, lightK);
    // the terrain's direct light: the shader fades the sun over ±7° (its sunUp, made for an air) — here the light is the
    // disc's own part, so the colour is divided by that fade (it is ≥ 0.4 wherever the disc still shows); at night the
    // sun's direction points down, so the shader takes Amarant's light (u_moonDir) and the shadows Amarant's
    const sunUpShader = ss(-0.12, 0.12, sd[1]);
    const lit = lightK > 0.002;
    const sunColor = lit ? sunLight.map(v => v / Math.max(sunUpShader, 0.05)) : [0, 0, 0];
    const light = {
      sunDir: lit ? [sd[0], sd[1], sd[2]] : [0, -1, 0], sunColor,
      moonDir: [p.dir[0], p.dir[1], p.dir[2]], moonColor: parLight,
      ambSky: amb, night, far, lightK, free, above, eclipse: sky.eclipse || 0, sunEl: sEl, parEl: pEl, parPhase: p.phase || 0, dip, hDist,
    };
    // the other worlds: the five largest in the sky (not Helia, not the parent)
    const others = [];
    for (const b of sky.bodies) if (b.id !== 'helia' && b.id !== p.id && b.id !== pG.id && b.id !== 'amarant' && LOOK[b.id] && b.ang > 4e-4) others.push(b);
    others.sort((a, b) => b.ang - a.ang);
    const Bv = new Float32Array(20), Bc = new Float32Array(20);
    for (let k = 0; k < Math.min(5, others.length); k++) {
      const b = others[k], L = LOOK[b.id];
      Bv.set([b.dir[0], b.dir[1], b.dir[2], b.ang], k * 4);
      Bc.set([L[0] * SUN[0], L[1] * SUN[1], L[2] * SUN[2], L[3]], k * 4);
    }
    // Amarant's prime meridian in the local frame (its spin turns the great storm across the disc), ⊥ its pole
    const BA = fr.st.b.amarant ? fr.st.b.amarant.B : null, pole = pG.pole;
    let ex = BA ? toLocal(fr.M, [BA[0], BA[3], BA[6]]) : [1, 0, 0];
    const pdx = ex[0] * pole[0] + ex[1] * pole[1] + ex[2] * pole[2]; ex = [ex[0] - pole[0] * pdx, ex[1] - pole[1] * pdx, ex[2] - pole[2] * pdx];
    const el = Math.hypot(ex[0], ex[1], ex[2]) || 1; ex = [ex[0] / el, ex[1] / el, ex[2] / el];
    const reach = Math.asin(Math.min(1, 2.32 / distR));
    // the plumes, relative to the eye
    const J = new Float32Array(16), Js = [0, 0, 0, 0];
    const pl = (o.plumes || []).slice(0, 4);
    pl.forEach((q, k) => { J.set([q.x - eye[0], q.y - eye[1], q.z - eye[2], q.top], k * 4); Js[k] = q.k === undefined ? 1 : q.k; });
    const tier = o.tier === undefined ? 2 : o.tier;
    const skyU = {
      sun: [sd[0], sd[1], sd[2], sAng],
      sunK: [DISC, free * above, 0.3 + 0.7 * night, tier],
      sunCol: SUN,
      inert: fr.inert,
      par: [pd[0], pd[1], pd[2], distR],
      pole: [pole[0], pole[1], pole[2], A.Rp / A.R],
      parX: [ex[0], ex[1], ex[2], t % 300000],
      parK: [Math.cos(reach), 1, 0.004, sAng],
      B: Bv, Bc,
      ground: [far[0], far[1], far[2], dip],
      J, Js, Jk: [K.plume ? free : 0, hDist, R, he],   // (the plumes dark while Amarant hides Helia)
      lum: [0, 0],
      eye: [eye[0] % 40000, eye[1], eye[2] % 40000],   // u-orbit2: the far ground's texture (bsFarGround)
      // u-moons2: the air (airK [on, scale, LUT | stops, haze]), Herzwelt (hz, hzX), the plumes' shape (ju)
      airK: [air ? 1 : 0, air ? K.airK : 0, tier > 0 ? 1 : 0, 0.75], airS: [air ? air.C.W : 1, air ? air.C.H : 1, 0, 0], airT: air ? air.tauZ : [0, 0, 0],
      air3: air ? [].concat(...['zen', 'hor', 'sunHor'].map(k => air.stops[k].map((v, i) => v * SUN[i] * K.airK))) : null, airC: air ? air.C : null,
      hz: id === 'aqua' ? [p.dir[0], p.dir[1], p.dir[2], p.ang] : [0, 1, 0, 0], hzX: [(t / 1200) * 2 * Math.PI % (2 * Math.PI), t * 0.002 % 100, 0, 0],
      ju: [K.shape || 0, 26, t % 1000, 0],
    };
    // (u-orbit2: on the darkest nights the eye opens further — up to 1.7× — as it does under the stars alone)
    const nl = 0.2126 * amb[0] + 0.7152 * amb[1] + 0.0722 * amb[2] + 0.7 * (parK + othK) * SUN[1] * Math.max(0, pd[1]);
    const xN = K.expoNight * clamp(0.05 / Math.max(nl, 0.004), 1, 1.7);
    const expo = lit ? K.expoDay + (xN - K.expoDay) * night : xN, exE = o.expo > 0 ? o.expo : expo;
    // Amarant and the worlds at the brightness they have at the day's exposure, whatever the eye's (their bands read)
    skyU.lum[0] = Math.min(1, Math.max(0.1, 1.7 / (SUN[1] * exE))); skyU.lum[1] = Math.min(1, Math.max(0.1, 2.4 / (SUN[1] * exE)));
    if (air) skyU.airS[2] = Math.min(1, (0.2126 * skyU.air3[0] + 0.7152 * skyU.air3[1] + 0.0722 * skyU.air3[2]) * exE * 6);   // (u-moons2: the stars fade as the air brightens)
    return { id, light, sky: skyU, expo, raw: sky, alb };
  };

  // ---------------------------------------------------------------- u-moons2 · the air's LUTs (atmo_lut.js)
  // per world one context: Low frozen (rebuilt when Helia moved ≥ 1.5°: a world hour on these worlds is 3–9°), Balanced
  // 48 × 24 and High 96 × 50 refreshed a slice a frame inside a 0.6 ms budget; Very Low: no texture — the three stops
  // only, refitted when Helia moved 0.25°. Ocker's dust τ (BS.dustTau, the weather of bodylife2.js) staged into the LUTs
  // when it moved ≥ 0.15. → {C, stops, sunT, tauZ}
  BS.dustTau = 0.6;
  BS.airState = null;
  const airOf = (id) => (id === 'ocker' ? VR.AtmoLUT.ocker(Math.round(BS.dustTau / 0.15) * 0.15) : VR.AtmoLUT.AIRS[id]);
  BS.airFor = function (id, h, sEl, tier) {
    const A = VR.AtmoLUT, D2 = Math.PI / 180;
    tier = tier === undefined ? 2 : tier;
    const W = tier >= 3 ? 96 : 48, H = tier >= 3 ? 50 : 24;
    let st = BS.airState;
    const hA = A.airH(h);
    if (!st || st.id !== id || st.W !== W) {
      const C = A.context(airOf(id), { W, H });
      st = BS.airState = { id, W, C, el: sEl, elS: sEl, h: hA, stops: null, sunT: [1, 1, 1], tauZ: [0, 0, 0], fresh: tier === 0 };
      if (tier > 0) A.update(C, hA, sEl);   // (the first frame on a world: the whole sky at once, under the trip's veil)
    }
    const C = st.C, air = airOf(id);
    if (air.key !== C.air.key) { if (tier > 0) A.stageAir(C, air); else A.setAir(C, air); st.stops = null; }
    if (tier === 1) { if (Math.abs(sEl - st.el) >= 1.5 * D2 || C.next) { if (!C.next) st.el = sEl; A.update(C, hA, st.el, C.H, 0.6); } }
    else if (tier >= 2) { if (C.row === 0) st.el = sEl; A.update(C, hA, st.el, C.H, 0.6); }
    if (!st.stops || Math.abs(sEl - st.elS) >= 0.25 * D2 || Math.abs(hA - st.h) > 30) {
      st.elS = sEl; st.h = hA;
      st.stops = A.fit3(C, hA, sEl);
      A.sunTrans(C, hA, sEl, st.sunT);
      const tz = A.trans(C, C.air.R + Math.max(1, hA), 1, [0, 0, 0]); st.tauZ = tz.map(v => -Math.log(Math.max(v, 1e-6)));
    }
    return st;
  };
  // the LUT's texture (RGBA16F, unit 5 — free in the sky program) re-sent when a slice made it newer
  BS.airTex = function (gl, C) {
    let T = BS._tex;
    if (!T || T.gl !== gl) { T = BS._tex = { gl, tex: gl.createTexture(), stamp: -1, W: 0, H: 0, buf: null }; }
    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D, T.tex);
    const key = C.stamp * 1000 + C.row;
    if (T.stamp !== key || T.W !== C.W) {
      T.buf = VR.AtmoLUT.toHalf(C, T.buf && T.buf.length === C.sky.length ? T.buf : null);
      if (T.W !== C.W || T.H !== C.H) { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, C.W, C.H, 0, gl.RGBA, gl.HALF_FLOAT, T.buf); T.W = C.W; T.H = C.H; gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); }
      else gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, C.W, C.H, gl.RGBA, gl.HALF_FLOAT, T.buf);
      T.stamp = key;
    }
    gl.activeTexture(gl.TEXTURE0);
  };
  // ---- end u-moons2

  // ---------------------------------------------------------------- the env (env.js calls this at the end of update)
  BS.env = function (E, env, o, dt) {
    const D = VR.DimReg && VR.DimReg.get(o && o.dim), id = D && D.body;
    if (!id) { BS.want = false; BS.cur = null; E.bodySky = null; return E; }
    BS.want = true;
    const U = VR.Universe, t = U.worldSeconds(env.day | 0, env.ticks);
    BS.t = t;
    const prof = VR.Bodies.profile(id), tierN = BS.tier === undefined ? 2 : BS.tier;
    // (u-moons2: the air's LUTs advanced a slice — Helia's elevation from the sky of this moment)
    let airS = null;
    if (prof && prof.air && VR.AtmoLUT) { const ls = U.localSky(o.dim, BS.eye, t, BS._sky0 || undefined); BS._sky0 = ls; airS = BS.airFor(id, Math.max(1, BS.eye[1] - (Number.isFinite(BS.groundY) ? BS.groundY : prof.level)), Math.asin(Math.max(-1, Math.min(1, ls.sun.dir[1]))), tierN); }
    const r = BS.compute(o.dim, BS.eye, t, { tier: tierN, groundY: BS.groundY, biome: o.biome && o.biome.key, plumes: BS.plumes, expo: BS.expo, air: airS });
    if (!r) { BS.want = false; return E; }
    BS.cur = r;
    const L = r.light;
    E.sunDir = L.sunDir; E.sunColor = L.sunColor; E.moonDir = L.moonDir; E.moonColor = L.moonColor; E.ambSky = L.ambSky;
    E.night = L.night;
    // no air: the sky stops are the far ground's colour (the haze that fades the far land is that ground, not a sky)
    const fc = L.far;
    E.zenith = fc; E.horizon = fc; E.skyMid = fc; E.fogColor = fc; E.sunset = [0, 0, 0];
    E.skyStops = [0.25, 0.1, 1.0, 0.45]; E.skyDay = [0, 1, 0, 0];
    const rd = (o.renderDist || 8) * 16;
    E.fog = [rd * 0.9, rd * 0.995, 0, 0];   // (u-orbit2: no air, no haze over the near land — only the last columns' edge)
    // u-moons2: with air — the stops are the sky's (the water mirrors them, the far land fades into the horizon's light);
    // the haze by the air's ground extinction at real constants, and a dust front's wall on Ocker (BS.front 0 … 1)
    if (r.sky.air3) {
      const a3 = r.sky.air3, zen = a3.slice(0, 3), hor = a3.slice(3, 6), sh = a3.slice(6, 9);
      E.zenith = zen; E.horizon = hor; E.skyMid = zen.map((v, i) => 0.5 * (v + hor[i])); E.fogColor = hor.map((v, i) => 0.75 * v + 0.25 * sh[i]);
      const front = BS.front || 0, tau = id === 'ocker' ? BS.dustTau : 0;
      const vis = id === 'ocker' ? Math.min(rd * 1.6, 2600 / (0.4 + tau * 1.2) / (1 + front * 14)) : rd * 1.5;
      E.fog = [Math.min(rd * 0.5, vis * 0.15), Math.min(rd * 0.995, vis), 0, 0];
    }
    if (o.underwater) { E.fog = [0, 1, 0, 1]; }
    E.rain = 0; E.snow = 0; E.wet = 0; E.puddle = 0; E.wind = 0; E.gust = 0; E.cloudCover = 0; E.cloudDrift = null; E.rays = 0; E.nebula = 0; E.snowCover = 0;
    if (E.storm) { E.storm[2] = 0; E.storm[3] = 0; } if (E.bolt) E.bolt[3] = 0;
    if (id === 'aqua') E.wind = 2.6;   // u-moons2: Aquamarin's swell taller than home's (the water's storm factor)
    E.emissiveBoost = 0.45 + L.night * 1.1;
    E.grade = [1, 1, 1];
    E.bloomThreshold = 1.25; E.bloomStrength = 0.08;
    // the eye adapts in a few seconds (slower into the dark)
    const target = r.expo * (o.exposureMul || 1);
    BS.expo = BS.expo > 0 ? BS.expo + (target - BS.expo) * (1 - Math.exp(-(dt || 0.016) * (target > BS.expo ? 0.7 : 1.6))) : target;
    E.exposure = BS.expo;
    E.bodySky = r.sky;
    return E;
  };

  // ---------------------------------------------------------------- GL (the game's page)
  BS.uniforms = function (gl, u, S) {
    const v4 = (n, a) => { if (u[n]) gl.uniform4f(u[n], a[0], a[1], a[2], a[3]); };
    v4('u_bsSun', S.sun); v4('u_bsSunK', S.sunK);
    if (u.u_bsSunCol) gl.uniform3f(u.u_bsSunCol, S.sunCol[0], S.sunCol[1], S.sunCol[2]);
    if (u.u_bsInert) gl.uniformMatrix3fv(u.u_bsInert, false, S.inert);
    v4('u_bsPar', S.par); v4('u_bsPole', S.pole); v4('u_bsParX', S.parX); v4('u_bsParK', S.parK);
    if (u.u_bsB) gl.uniform4fv(u.u_bsB, S.B);
    if (u.u_bsBc) gl.uniform4fv(u.u_bsBc, S.Bc);
    v4('u_bsGround', S.ground);
    // u-moons2: the air, Herzwelt, the plumes' shape
    if (S.airK) { v4('u_bsAirK', S.airK); v4('u_bsAirS', S.airS); if (u.u_bsAirT) gl.uniform3f(u.u_bsAirT, S.airT[0], S.airT[1], S.airT[2]); v4('u_bsHz', S.hz); v4('u_bsHzX', S.hzX); v4('u_bsJu', S.ju); }
    if (S.air3 && u.u_bsAir3) gl.uniform3fv(u.u_bsAir3, S.air3);
    if (u.u_bsAir) { gl.uniform1i(u.u_bsAir, 5); if (S.airC && S.airK[2] > 0.5) BS.airTex(gl, S.airC); }
    if (u.u_bsJ) gl.uniform4fv(u.u_bsJ, S.J);
    v4('u_bsJs', S.Js);
    v4('u_bsJk', S.Jk);
    if (u.u_bsLum) gl.uniform2f(u.u_bsLum, S.lum[0], S.lum[1]);
    if (u.u_bsEye && S.eye) gl.uniform3f(u.u_bsEye, S.eye[0], S.eye[1], S.eye[2]);
  };
  // the sky program alone gets BODYSKY, and only while a body's sky is shown (light2.js's and sky3.js's hooks first).
  // u-orbit2: the terrain's programs get BODYGROUND (+ BG_<body>) on a body from Low up — the ground's albedo patches
  // (shaders.js TERRAIN_FS); Herzwelt's programs and Very Low's stay the text they were
  BS.groundKey = '';
  if (VR.GL && !VR.GL.__bodySky) {
    const prev = VR.GL.defineHook || null;
    VR.GL.defineHook = (name, defines) => {
      const d = prev ? prev(name, defines) : (defines || []);
      if (name === 'sky' && BS.want) return d.concat(['BODYSKY']);
      if ((name === 'terrain' || name === 'terrainCut') && BS.groundKey) return d.concat(['BODYGROUND', 'BG_' + BS.groundKey.toUpperCase()]);
      return d;
    };
    VR.GL.__bodySky = true;
  }
  const Rn = VR.Renderer;
  if (Rn && !Rn.prototype.__bodySky) {
    // the programs rebuilt once when the body's sky comes or goes (on the trip, under its veil)
    const render0 = Rn.prototype.render;
    Rn.prototype.render = function (F) {
      const gk = BS.want && this.q && !this.q.lite && BS.cur && BS.cur.id ? BS.cur.id : '';
      if (BS.want !== !!this.bsBuilt || gk !== BS.groundKey) { this.bsBuilt = BS.want; BS.groundKey = gk; this.buildPrograms(); }
      BS.tier = this.q ? (this.q.lite ? 0 : Math.max(1, Math.min(3, (this.q.matTier | 0) || 2))) : 2;
      return render0.call(this, F);
    };
    // the sky program's u_bs* uniforms after the common ones
    const common0 = Rn.prototype.common;
    Rn.prototype.common = function (p, E) { common0.call(this, p, E); if (p.u.u_bsSun && E.bodySky) BS.uniforms(this.gl, p.u, E.bodySky); };
    Rn.prototype.__bodySky = true;
  }
})(VR);

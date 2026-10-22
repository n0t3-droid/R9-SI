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
  const ss = (a, b, x) => { let t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
  const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  // Helia's light (F5, a white with a breath of blue; the home sun's noon is [2.9, 2.72, 2.4]) and its disc's radiance
  const SUN = [2.85, 2.9, 3.05], DISC = 60;
  // the worlds seen from the moons: their albedo colour (linear), their air's limb
  const LOOK = { herz: [0.3, 0.38, 0.52, 1], aqua: [0.2, 0.33, 0.5, 0.6], zinn: [0.55, 0.46, 0.22, 0], opal: [0.86, 0.88, 0.92, 0], basalt: [0.12, 0.12, 0.12, 0], ocker: [0.5, 0.3, 0.17, 0.3] };
  // per body: the ground's albedo for the far ground and the bounce (Basalt by its two grounds), the exposure by day and by
  // night (Basalt by day: the maria mid-grey and the highlands, 3.5× brighter, still short of white — run 1 at 1.35 burnt
  // them out; at night the eye opens; Opal's ice is bright), the plumes' brightness
  const KIND = {
    basalt: { alb: { basalt_mare: 0.075, basalt_highlands: 0.26, basalt_crater: 0.2 }, alb0: 0.1, tint: [1.0, 0.98, 0.95], bounce: 0.32, floor: 0.06, expoDay: 0.9, expoNight: 3.6, plume: 0 },
    opal: { alb: {}, alb0: 0.72, tint: [0.96, 0.98, 1.02], bounce: 0.38, floor: 0.05, expoDay: 0.62, expoNight: 1.7, plume: 1 },
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
    const above = ss(-dip - sAng, -dip + sAng, sEl), free = 1 - (sky.eclipse || 0), lightK = above * free;
    // Amarant
    const p = sky.parent, pd = p.dir, A = U.home.by[p.id] || U.home.by.amarant;
    const pAng = p.ang, distR = 1 / Math.sin(Math.max(pAng, 1e-6)), pEl = Math.asin(Math.max(-1, Math.min(1, pd[1])));
    const pAbove = ss(-dip - pAng, -dip + pAng, pEl);
    // its light on the night side: its lit part × its solid angle (π·ang²) × its albedo 0.5 / π, × 4 (readable nights)
    const parK = 0.5 * (p.phase || 0) * pAng * pAng * 4 * pAbove;
    const parLight = SUN.map(v => v * parK);
    // the ground's albedo here (Basalt: the mare's dark dust or the highlands' bright), its far colour in this light
    const alb = (o.biome && K.alb[o.biome] !== undefined ? K.alb[o.biome] : K.alb0);
    const sunLight = SUN.map((v, i) => v * lightK * (VR.Grade ? VR.Grade.sunK : 1));
    const sinEl = Math.max(0, sd[1]);
    const amb = sunLight.map((v, i) => (v * alb * K.bounce + parLight[i] * 0.35 + K.floor * 0.02) * K.tint[i]);
    const far = sunLight.map((v, i) => alb * (v * (0.18 + 0.6 * sinEl) + parLight[i] * 0.6 + amb[i]) * K.tint[i]);
    const night = 1 - ss(0, 1, lightK);
    // the terrain's direct light: the shader fades the sun over ±7° (its sunUp, made for an air) — here the light is the
    // disc's own part, so the colour is divided by that fade (it is ≥ 0.4 wherever the disc still shows); at night the
    // sun's direction points down, so the shader takes Amarant's light (u_moonDir) and the shadows Amarant's
    const sunUpShader = ss(-0.12, 0.12, sd[1]);
    const lit = lightK > 0.002;
    const sunColor = lit ? sunLight.map(v => v / Math.max(sunUpShader, 0.05)) : [0, 0, 0];
    const light = {
      sunDir: lit ? [sd[0], sd[1], sd[2]] : [0, -1, 0], sunColor,
      moonDir: [pd[0], pd[1], pd[2]], moonColor: parLight,
      ambSky: amb, night, far, lightK, free, above, eclipse: sky.eclipse || 0, sunEl: sEl, parEl: pEl, parPhase: p.phase || 0, dip, hDist,
    };
    // the other worlds: the five largest in the sky (not Helia, not the parent)
    const others = [];
    for (const b of sky.bodies) if (b.id !== 'helia' && b.id !== p.id && b.id !== 'amarant' && LOOK[b.id] && b.ang > 4e-4) others.push(b);
    others.sort((a, b) => b.ang - a.ang);
    const Bv = new Float32Array(20), Bc = new Float32Array(20);
    for (let k = 0; k < Math.min(5, others.length); k++) {
      const b = others[k], L = LOOK[b.id];
      Bv.set([b.dir[0], b.dir[1], b.dir[2], b.ang], k * 4);
      Bc.set([L[0] * SUN[0], L[1] * SUN[1], L[2] * SUN[2], L[3]], k * 4);
    }
    // Amarant's prime meridian in the local frame (its spin turns the great storm across the disc), ⊥ its pole
    const BA = fr.st.b.amarant ? fr.st.b.amarant.B : null, pole = p.pole;
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
    };
    const expo = lit ? K.expoDay + (K.expoNight - K.expoDay) * night : K.expoNight, exE = o.expo > 0 ? o.expo : expo;
    // Amarant and the worlds at the brightness they have at the day's exposure, whatever the eye's (their bands read)
    skyU.lum[0] = Math.min(1, Math.max(0.1, 1.7 / (SUN[1] * exE))); skyU.lum[1] = Math.min(1, Math.max(0.1, 2.4 / (SUN[1] * exE)));
    return { id, light, sky: skyU, expo, raw: sky };
  };

  // ---------------------------------------------------------------- the env (env.js calls this at the end of update)
  BS.env = function (E, env, o, dt) {
    const D = VR.DimReg && VR.DimReg.get(o && o.dim), id = D && D.body;
    if (!id) { BS.want = false; BS.cur = null; E.bodySky = null; return E; }
    BS.want = true;
    const U = VR.Universe, t = U.worldSeconds(env.day | 0, env.ticks);
    BS.t = t;
    const r = BS.compute(o.dim, BS.eye, t, { tier: BS.tier === undefined ? 2 : BS.tier, groundY: BS.groundY, biome: o.biome && o.biome.key, plumes: BS.plumes, expo: BS.expo });
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
    E.fog = [rd * 0.78, rd * 0.99, 0, 0];
    if (o.underwater) { E.fog = [0, 1, 0, 1]; }
    E.rain = 0; E.snow = 0; E.wet = 0; E.puddle = 0; E.wind = 0; E.gust = 0; E.cloudCover = 0; E.cloudDrift = null; E.rays = 0; E.nebula = 0; E.snowCover = 0;
    if (E.storm) { E.storm[2] = 0; E.storm[3] = 0; } if (E.bolt) E.bolt[3] = 0;
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
    if (u.u_bsJ) gl.uniform4fv(u.u_bsJ, S.J);
    v4('u_bsJs', S.Js);
    v4('u_bsJk', S.Jk);
    if (u.u_bsLum) gl.uniform2f(u.u_bsLum, S.lum[0], S.lum[1]);
  };
  // the sky program alone gets BODYSKY, and only while a body's sky is shown (light2.js's and sky3.js's hooks first)
  if (VR.GL && !VR.GL.__bodySky) {
    const prev = VR.GL.defineHook || null;
    VR.GL.defineHook = (name, defines) => { const d = prev ? prev(name, defines) : (defines || []); return name === 'sky' && BS.want ? d.concat(['BODYSKY']) : d; };
    VR.GL.__bodySky = true;
  }
  const Rn = VR.Renderer;
  if (Rn && !Rn.prototype.__bodySky) {
    // the programs rebuilt once when the body's sky comes or goes (on the trip, under its veil)
    const render0 = Rn.prototype.render;
    Rn.prototype.render = function (F) {
      if (BS.want !== !!this.bsBuilt) { this.bsBuilt = BS.want; this.buildPrograms(); }
      BS.tier = this.q ? (this.q.lite ? 0 : Math.max(1, Math.min(3, (this.q.matTier | 0) || 2))) : 2;
      return render0.call(this, F);
    };
    // the sky program's u_bs* uniforms after the common ones
    const common0 = Rn.prototype.common;
    Rn.prototype.common = function (p, E) { common0.call(this, p, E); if (p.u.u_bsSun && E.bodySky) BS.uniforms(this.gl, p.u, E.bodySky); };
    Rn.prototype.__bodySky = true;
  }
})(VR);

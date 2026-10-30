// ============================================================================
// u-moons2 · VR.AtmoLUT — the skies of the worlds with air, from per-world constants (docs/superpowers/plans/
// 2026-10-30-u-moons2.md §1; U§4.4, §11; R§2.1, §2.3). Pure JS: node tests it (test/atmo_lut.js), the game runs the same
// code (bodysky.js uploads the sky-view LUT as a small texture, space_shaders.js reads it).
//
// Hillaire's production technique (EGSR 2020) with three wavelengths (680 / 550 / 440 nm), on the CPU:
//   · transmittance LUT T(r, μ) — 64 × 16, the optical depth to the top of the air (0 where the ray meets the ground)
//   · multiple scattering LUT Ψ_ms(r, μ_s) — 16 × 8: second order from 16 directions, isotropic, the infinite series
//     summed as L₂ / (1 − f_ms); the ground's albedo bounces too
//   · sky-view LUT L(φ, θ) at the eye — Low / Balanced 48 × 24, High 96 × 50: φ the azimuth from Helia (0 … π, the sky
//     is symmetric about the sun's vertical; √ mapping so the forward lobe gets the texels), θ Hillaire's non-linear
//     elevation (the horizon gets the texels); 12 steps a ray
// Built progressively: a slice of rows per call (update), so no frame pays for the whole; frozen per world hour on Low
// (the caller asks only when Helia moved > 1.5° or the dust changed), per frame from Balanced. Very Low: fit3() — three
// stops (the zenith, the horizon away from Helia, the horizon under Helia) from the same model, drawn without a fetch.
//
// The airs (U§4.4): Herzwelt = R§2.1's constants; Aquamarin 0.5 bar at g 2.01 — 2.4× Earth's column (p/g), the scale
// heights 9.81/2.01 × Earth's (the same temperature), half the density at the ground: a whiter horizon, deep red
// sunsets; Ocker = Mars (R§2.3): Rayleigh at 0.6 % of the column (6 mbar of CO₂ at 3.72), the dust as the sky — τ 0.3
// clear … 4.5 storm, H 11.6 km, single-scattering albedo coloured (iron oxides absorb the blue: butterscotch), the phase a
// Henyey–Greenstein per wavelength whose blue lobe is the narrowest and strongest (1.5 µm grains: the diffraction peak
// narrows with λ/r) — so near Helia at sunset the sky turns blue and the red spreads over the rest (R§2.3).
// Lengths in metres, real: the air's scale heights are real ones (the ground's lower 300 m at real constants; above
// that the eye's height counts ×64, the 1/64 world, U§3).
// ============================================================================
(function (VR) {
  'use strict';
  const PI = Math.PI;
  const TW = 64, TH = 16, MW = 16, MH = 8, STEPS = 12;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

  // ---------------------------------------------------------------- the airs
  // {id, R (m), top (m), bR[3] (m⁻¹ at the ground), HR, bMs[3], bMa[3], HM, gM[3], oz[3]|null, ozC, ozW, alb[3]}
  const EARTH_R = [5.802e-6, 13.558e-6, 33.1e-6], EARTH_MS = 3.996e-6, EARTH_MA = 0.444e-6, EARTH_OZ = [0.65e-6, 1.881e-6, 0.085e-6];
  function make(o) { const a = Object.assign({ oz: null, ozC: 25000, ozW: 15000, alb: [0.3, 0.3, 0.3], gM: [0.8, 0.8, 0.8], tau: 0 }, o); a.key = keyOf(a); return a; }
  function keyOf(a) { return [a.id, a.tau.toFixed(3), a.bR.map(v => v.toExponential(3)).join(','), a.bMs.map(v => v.toExponential(3)).join(',')].join('|'); }
  const AIRS = {};
  AIRS.herz = make({ id: 'herz', R: 6360e3, top: 6460e3, bR: EARTH_R, HR: 8000, bMs: [EARTH_MS, EARTH_MS, EARTH_MS], bMa: [EARTH_MA, EARTH_MA, EARTH_MA], HM: 1200, gM: [0.8, 0.8, 0.8], oz: EARTH_OZ, alb: [0.3, 0.3, 0.3] });
  // Aquamarin: H × 4.88 (g 9.81 → 2.01), ground density × 0.5 (0.5 bar) → τ × 2.44; no ozone layer (a young air); the
  // sea's albedo 0.08
  {
    const kH = 9.81 / 2.01, kD = 0.5;
    AIRS.aqua = make({ id: 'aqua', R: 2400e3, top: 2400e3 + 8 * 8000 * kH, bR: EARTH_R.map(v => v * kD), HR: 8000 * kH, bMs: [1, 1, 1].map(() => EARTH_MS * kD * 1.3), bMa: [1, 1, 1].map(() => EARTH_MA * kD * 1.3), HM: 1200 * kH, gM: [0.76, 0.76, 0.76], alb: [0.08, 0.1, 0.12] });
  }
  // Ocker: the dust's τ (the weather) → its extinction at the ground τ / H; ω (0.97, 0.91, 0.62), g (0.62, 0.67, 0.77)
  const OCK = { HD: 11600, w: [0.97, 0.91, 0.62], g: [0.62, 0.67, 0.77], R: 3390e3 };
  function ocker(tau) {
    tau = clamp(tau === undefined ? 0.6 : tau, 0.05, 6);
    const e = tau / OCK.HD;
    return make({ id: 'ocker', tau, R: OCK.R, top: OCK.R + 8 * OCK.HD, bR: EARTH_R.map(v => v * 0.0062 * 1.0), HR: 11000, bMs: OCK.w.map(w => e * w), bMa: OCK.w.map(w => e * (1 - w)), HM: OCK.HD, gM: OCK.g, alb: [0.32, 0.2, 0.12] });
  }
  AIRS.ocker = ocker(0.6);
  // the eye's height in the air's metres: the lower 300 m real, above them the 1/64 world's (U§3)
  const airH = (hGame) => (hGame <= 300 ? Math.max(0, hGame) : 300 + (hGame - 300) * 64);

  // ---------------------------------------------------------------- the medium
  // the scattering and extinction at height h (m): out {sR[3], sM[3], ext[3]}
  function medium(a, h, o) {
    const dR = Math.exp(-h / a.HR), dM = Math.exp(-h / a.HM);
    const dO = a.oz ? Math.max(0, 1 - Math.abs(h - a.ozC) / a.ozW) : 0;
    for (let i = 0; i < 3; i++) {
      o.sR[i] = a.bR[i] * dR; o.sM[i] = a.bMs[i] * dM;
      o.ext[i] = o.sR[i] + o.sM[i] + a.bMa[i] * dM + (a.oz ? a.oz[i] * dO : 0);
    }
    return o;
  }
  const newMed = () => ({ sR: [0, 0, 0], sM: [0, 0, 0], ext: [0, 0, 0] });
  // the distance along a ray from radius r, zenith cosine mu, to a sphere of radius Rs (−1: none ahead)
  function rayToSphere(r, mu, Rs) {
    const b = r * mu, c = r * r - Rs * Rs, d = b * b - c;
    if (d < 0) return -1;
    const s = Math.sqrt(d), t1 = -b - s, t2 = -b + s;
    return t1 > 0 ? t1 : t2 > 0 ? t2 : -1;
  }
  const phaseR = (c) => 3 / (16 * PI) * (1 + c * c);
  const phaseHG = (c, g) => { const g2 = g * g, d = 1 + g2 - 2 * g * c; return (1 - g2) / (4 * PI * d * Math.sqrt(d)); };

  // ---------------------------------------------------------------- the transmittance LUT
  // (x: μ uniform in [−1, 1]; y: √ of the height over the air's depth) — 0 when the ray meets the ground
  const _od = [0, 0, 0];
  function buildT(a, T, j0, j1) {
    T = T || new Float32Array(TW * TH * 3); const m = newMed();
    for (let j = j0 || 0; j < (j1 === undefined ? TH : j1); j++) for (let i = 0; i < TW; i++) {
      const v = j / (TH - 1), h = v * v * (a.top - a.R), r = a.R + h, mu = -1 + 2 * i / (TW - 1);
      const k = (j * TW + i) * 3;
      const tg = rayToSphere(r, mu, a.R);
      if (tg > 0 && mu < 0) { T[k] = T[k + 1] = T[k + 2] = 0; continue; }
      const L = rayToSphere(r, mu, a.top);
      const od = _od; od[0] = od[1] = od[2] = 0;
      if (L > 0) {
        const n = 28, dt = L / n;
        for (let s = 0; s < n; s++) {
          const t = (s + 0.5) * dt, rr = Math.sqrt(r * r + t * t + 2 * r * t * mu);
          medium(a, rr - a.R, m);
          od[0] += m.ext[0] * dt; od[1] += m.ext[1] * dt; od[2] += m.ext[2] * dt;
        }
      }
      T[k] = Math.exp(-od[0]); T[k + 1] = Math.exp(-od[1]); T[k + 2] = Math.exp(-od[2]);
    }
    return T;
  }
  // a bilinear fetch from a 3-channel LUT (u, v in [0, 1])
  function fetch3(L, W, H, u, v, o) {
    const x = clamp(u, 0, 1) * (W - 1), y = clamp(v, 0, 1) * (H - 1);
    const i = Math.min(W - 2, Math.floor(x)), j = Math.min(H - 2, Math.floor(y)), fx = x - i, fy = y - j;
    const k00 = (j * W + i) * 3, k10 = k00 + 3, k01 = k00 + W * 3, k11 = k01 + 3;
    for (let c = 0; c < 3; c++) o[c] = (L[k00 + c] * (1 - fx) + L[k10 + c] * fx) * (1 - fy) + (L[k01 + c] * (1 - fx) + L[k11 + c] * fx) * fy;
    return o;
  }
  // the transmittance from radius r along μ to the top
  function trans(C, r, mu, o) {
    const a = C.air, h = clamp(r - a.R, 0, a.top - a.R);
    // (the horizon: a ray just above it is all air — the LUT's μ grid is coarse there; a ray below it meets the ground)
    const muH = -Math.sqrt(Math.max(0, 1 - (a.R / Math.max(r, a.R + 1)) * (a.R / Math.max(r, a.R + 1))));
    if (mu < muH - 0.004) { o[0] = o[1] = o[2] = 0; return o; }
    return fetch3(C.T, TW, TH, (Math.max(mu, muH + 0.004) + 1) / 2, Math.sqrt(h / (a.top - a.R)), o);
  }

  // ---------------------------------------------------------------- the multiple scattering LUT
  // (16 directions on a Fibonacci sphere, and the build's scratch: no allocation per texel)
  const DIRS16 = [], _sunMS = [0, 0, 0], _L2 = [0, 0, 0], _F = [0, 0, 0], _Tv = [0, 0, 0];
  for (let k = 0; k < 16; k++) { const z = 1 - 2 * (k + 0.5) / 16, s = Math.sqrt(1 - z * z), ph = k * PI * (3 - Math.sqrt(5)); DIRS16.push([s * Math.cos(ph), z, s * Math.sin(ph)]); }
  function buildMS(C, MS, j0, j1, i0, i1) {
    const a = C.air, m = newMed(), tS = [0, 0, 0], tE = [0, 0, 0];
    MS = MS || new Float32Array(MW * MH * 3);
    const ND = 16, dirs = DIRS16, sun = _sunMS, L2 = _L2, F = _F, Tv = _Tv;
    for (let j = j0 || 0; j < (j1 === undefined ? MH : j1); j++) for (let i = i0 || 0; i < (i1 === undefined ? MW : i1); i++) {
      const h = Math.max(2, (j / (MH - 1)) * (a.top - a.R)), r = a.R + h, mus = -1 + 2 * i / (MW - 1);
      sun[0] = Math.sqrt(Math.max(0, 1 - mus * mus)); sun[1] = mus; sun[2] = 0;
      L2[0] = L2[1] = L2[2] = 0; F[0] = F[1] = F[2] = 0;
      for (const d of dirs) {
        const mu = d[1];
        const tg = rayToSphere(r, mu, a.R), ground = tg > 0;
        const len = ground ? tg : rayToSphere(r, mu, a.top);
        if (len <= 0) continue;
        const n = 14, dt = len / n; Tv[0] = Tv[1] = Tv[2] = 1;
        for (let s = 0; s < n; s++) {
          const t = (s + 0.5) * dt, px = d[0] * t, py = r + d[1] * t, pz = d[2] * t, rr = Math.sqrt(px * px + py * py + pz * pz);
          medium(a, rr - a.R, m);
          const muS = (px * sun[0] + py * sun[1] + pz * sun[2]) / rr;
          trans(C, rr, muS, tS);
          for (let c = 0; c < 3; c++) {
            const sc = m.sR[c] + m.sM[c], st = Math.exp(-m.ext[c] * dt), integ = (1 - st) / Math.max(m.ext[c], 1e-12);
            L2[c] += Tv[c] * sc * tS[c] / (4 * PI) * integ;     // (isotropic phase for the second order, Hillaire §5.5)
            F[c] += Tv[c] * sc * integ;
            Tv[c] *= st;
          }
        }
        if (ground) {   // the ground's bounce
          const gx = d[0] * len, gy = r + d[1] * len, gz = d[2] * len, gr = Math.sqrt(gx * gx + gy * gy + gz * gz);
          const muG = (gx * sun[0] + gy * sun[1] + gz * sun[2]) / gr;
          trans(C, gr, muG, tE);
          for (let c = 0; c < 3; c++) L2[c] += Tv[c] * tE[c] * Math.max(0, muG) * a.alb[c] / PI;
        }
      }
      const k = (j * MW + i) * 3;
      for (let c = 0; c < 3; c++) {
        const l2 = L2[c] / ND * 4 * PI / (4 * PI), fms = F[c] / ND / (4 * PI) * 4 * PI / (4 * PI);   // (the sphere's mean, then × 1/4π phase)
        MS[k + c] = l2 / Math.max(1e-6, 1 - Math.min(0.95, fms));
      }
    }
    return MS;
  }
  function msAt(C, r, mus, o) { const a = C.air; return fetch3(C.MS, MW, MH, (mus + 1) / 2, clamp((r - a.R) / (a.top - a.R), 0, 1), o); }

  // ---------------------------------------------------------------- one ray's light (the sky-view texel, and the reference)
  // eye at height h (m), the view direction (x east, y up, z south — unit), the sun's (unit) → radiance per unit of the
  // sun's irradiance (rgb), and the view's transmittance in tv (to the top or the ground)
  const _m = newMed(), _t = [0, 0, 0], _ms = [0, 0, 0];
  // (the hot loop: the medium, the two LUT fetches and the three channels inlined — no call, no array per step)
  function ray(C, h, d, sun, out, tv, steps) {
    const a = C.air, r = a.R + Math.max(h, 1), mu = d[1];
    const tg = rayToSphere(r, mu, a.R), len = tg > 0 ? tg : rayToSphere(r, mu, a.top);
    out[0] = out[1] = out[2] = 0;
    if (tv) { tv[0] = tv[1] = tv[2] = 1; }
    if (len <= 0) return out;
    const n = steps || STEPS, cosT = d[0] * sun[0] + d[1] * sun[1] + d[2] * sun[2];
    const pR = phaseR(cosT), pM0 = phaseHG(cosT, a.gM[0]), pM1 = phaseHG(cosT, a.gM[1]), pM2 = phaseHG(cosT, a.gM[2]);
    const T = C.T, MS = C.MS, depth = a.top - a.R, R2 = a.R * a.R;
    const bR0 = a.bR[0], bR1 = a.bR[1], bR2 = a.bR[2], bS0 = a.bMs[0], bS1 = a.bMs[1], bS2 = a.bMs[2], bA0 = a.bMa[0], bA1 = a.bMa[1], bA2 = a.bMa[2];
    const oz = a.oz, HR = a.HR, HM = a.HM;
    let T0 = 1, T1 = 1, T2 = 1, prev = 0, o0 = 0, o1 = 0, o2 = 0;
    for (let s = 0; s < n; s++) {
      // (steps denser near the eye: t ∝ ((s + 0.3) / n)²)
      const q = (s + 0.3) / n, t = len * q * q, dt = t - prev; prev = t;
      const px = d[0] * t, py = r + d[1] * t, pz = d[2] * t, rr2 = px * px + py * py + pz * pz, rr = Math.sqrt(rr2), hh = rr - a.R;
      const dR = Math.exp(-hh / HR), dM = Math.exp(-hh / HM), dO = oz ? Math.max(0, 1 - Math.abs(hh - a.ozC) / a.ozW) : 0;
      const sR0 = bR0 * dR, sR1 = bR1 * dR, sR2 = bR2 * dR, sM0 = bS0 * dM, sM1 = bS1 * dM, sM2 = bS2 * dM;
      const e0 = Math.max(sR0 + sM0 + bA0 * dM + (oz ? oz[0] * dO : 0), 1e-12), e1 = Math.max(sR1 + sM1 + bA1 * dM + (oz ? oz[1] * dO : 0), 1e-12), e2 = Math.max(sR2 + sM2 + bA2 * dM + (oz ? oz[2] * dO : 0), 1e-12);
      const muS = (px * sun[0] + py * sun[1] + pz * sun[2]) / rr;
      // the transmittance toward Helia (0 under the horizon there) — trans() inlined
      let t0 = 0, t1 = 0, t2 = 0;
      const muH = -Math.sqrt(Math.max(0, 1 - R2 / Math.max(rr2, R2 + 1)));
      if (muS >= muH - 0.004) {
        const x = (Math.max(muS, muH + 0.004) + 1) * 0.5 * (TW - 1), y = Math.sqrt(clamp(hh / depth, 0, 1)) * (TH - 1);
        const i = Math.min(TW - 2, x | 0), j = Math.min(TH - 2, y | 0), fx = x - i, fy = y - j, k = (j * TW + i) * 3, kU = k + TW * 3;
        const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
        t0 = T[k] * w00 + T[k + 3] * w10 + T[kU] * w01 + T[kU + 3] * w11;
        t1 = T[k + 1] * w00 + T[k + 4] * w10 + T[kU + 1] * w01 + T[kU + 4] * w11;
        t2 = T[k + 2] * w00 + T[k + 5] * w10 + T[kU + 2] * w01 + T[kU + 5] * w11;
      }
      // Ψ_ms
      const x = (clamp(muS, -1, 1) + 1) * 0.5 * (MW - 1), y = clamp(hh / depth, 0, 1) * (MH - 1);
      const i = Math.min(MW - 2, x | 0), j = Math.min(MH - 2, y | 0), fx = x - i, fy = y - j, k = (j * MW + i) * 3, kU = k + MW * 3;
      const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
      const m0 = MS[k] * w00 + MS[k + 3] * w10 + MS[kU] * w01 + MS[kU + 3] * w11;
      const m1 = MS[k + 1] * w00 + MS[k + 4] * w10 + MS[kU + 1] * w01 + MS[kU + 4] * w11;
      const m2 = MS[k + 2] * w00 + MS[k + 5] * w10 + MS[kU + 2] * w01 + MS[kU + 5] * w11;
      const S0 = t0 * (sR0 * pR + sM0 * pM0) + m0 * (sR0 + sM0), S1 = t1 * (sR1 * pR + sM1 * pM1) + m1 * (sR1 + sM1), S2 = t2 * (sR2 * pR + sM2 * pM2) + m2 * (sR2 + sM2);
      const st0 = Math.exp(-e0 * dt), st1 = Math.exp(-e1 * dt), st2 = Math.exp(-e2 * dt);
      o0 += T0 * S0 * (1 - st0) / e0; o1 += T1 * S1 * (1 - st1) / e1; o2 += T2 * S2 * (1 - st2) / e2;
      T0 *= st0; T1 *= st1; T2 *= st2;
    }
    out[0] = o0; out[1] = o1; out[2] = o2;
    if (tv) { tv[0] = T0; tv[1] = T1; tv[2] = T2; }
    return out;
  }

  // ---------------------------------------------------------------- the context: the LUTs of one air
  // opts {W, H}: the sky-view size. ctx.sky: Float32Array W·H·4 (rgb radiance, a: unused 1)
  function context(air, opts) {
    const W = (opts && opts.W) || 48, H = (opts && opts.H) || 24;
    const C = { air, W, H, T: null, MS: null, sky: new Float32Array(W * H * 4), row: 0, done: false, h: 0, sun: [0, 1, 0], sunEl: PI / 2, stamp: 0, builds: 0 };
    C.T = buildT(air); C.MS = buildMS(C);
    return C;
  }
  // a new air for the same context (the dust's τ changed): the two small LUTs again, the sky-view from the top
  // (at once — the tests, the first frame on a world)
  function setAir(C, air) { if (C.air.key === air.key) return C; C.air = air; C.T = buildT(air); C.MS = buildMS(C); C.row = 0; C.done = false; C.next = null; return C; }
  // staged: the new air's T and Ψ_ms built a few rows a frame inside update's budget, then swapped in (a storm's τ
  // ramps over minutes: no frame pays the ~50 ms of a whole rebuild)
  function stageAir(C, air) { if (C.air.key === air.key || (C.next && C.next.air.key === air.key)) return C; C.next = { air, T: new Float32Array(TW * TH * 3), MS: new Float32Array(MW * MH * 3), jT: 0, jM: 0 }; return C; }
  function stepNext(C, until) {
    const N = C.next, now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
    while (N.jT < TH) { buildT(N.air, N.T, N.jT, N.jT + 1); N.jT++; if (now() > until) return false; }
    const tmp = { air: N.air, T: N.T, MS: N.MS };
    while (N.jM < MH * MW) { const j = (N.jM / MW) | 0, i = N.jM % MW; buildMS(tmp, N.MS, j, j + 1, i, i + 1); N.jM++; if (now() > until) return false; }
    C.air = N.air; C.T = N.T; C.MS = N.MS; C.next = null; C.row = 0;
    return true;
  }
  // the sky-view's (u, v) ↔ a direction: φ from the sun's azimuth (u = √(φ/π)), θ the elevation (v non-linear)
  function dirOf(u, v, sunEl, o) {
    const ph = u * u * PI, l = (v - 0.5) * 2, el = Math.sign(l) * l * l * PI / 2;
    const ce = Math.cos(el);
    // (the local frame with the sun's azimuth along +x: sun = (cos sunEl, sin sunEl, 0))
    o[0] = ce * Math.cos(ph); o[1] = Math.sin(el); o[2] = ce * Math.sin(ph);
    return o;
  }
  // build rows [row … row + n) of the sky-view at the eye's height h (m) for the sun's elevation sunEl; → true when the
  // whole texture is fresh
  const _d = [0, 0, 0], _o = [0, 0, 0];
  // budget (ms, optional): stop after the row that passes it (the frame's cap; nRows the most rows)
  function update(C, h, sunEl, nRows, budget) {
    const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()), until = budget > 0 ? now() + budget : Infinity;
    if (C.next && !stepNext(C, until)) return false;
    if (C.row === 0) { C.h = h; C.sunEl = sunEl; C.sun = [Math.cos(sunEl), Math.sin(sunEl), 0]; }
    const W = C.W, H = C.H, end = Math.min(H, C.row + (nRows || H));
    for (let j = C.row; j < end; j++) for (let i = 0; i < W; i++) {
      dirOf(i / (W - 1), (j + 0.5) / H, C.sunEl, _d);
      ray(C, C.h, _d, C.sun, _o, null);
      const k = (j * W + i) * 4;
      C.sky[k] = _o[0]; C.sky[k + 1] = _o[1]; C.sky[k + 2] = _o[2]; C.sky[k + 3] = 1;
      if (i === W - 1 && now() > until) { C.row = j + 1; if (C.row >= H) break; return false; }
    }
    C.row = end;
    if (C.row >= H) { C.row = 0; C.done = true; C.builds++; C.stamp++; return true; }
    return false;
  }
  // the sky-view at a direction (the CPU's fetch: the ambient, the fog, the tests); d unit with the sun's azimuth anywhere
  function sample(C, d, sunDir, o) {
    const hs = Math.hypot(sunDir[0], sunDir[2]) || 1, hd = Math.hypot(d[0], d[2]) || 1;
    const cph = clamp((d[0] * sunDir[0] + d[2] * sunDir[2]) / (hs * hd), -1, 1), ph = Math.acos(cph);
    const el = Math.asin(clamp(d[1], -1, 1)), l = Math.sign(el) * Math.sqrt(Math.abs(el) / (PI / 2));
    const u = Math.sqrt(ph / PI), v = 0.5 + 0.5 * l;
    const W = C.W, H = C.H, x = clamp(u, 0, 1) * (W - 1), y = clamp(v * H - 0.5, 0, H - 1);
    const i = Math.min(W - 2, Math.floor(x)), j = Math.min(H - 2, Math.floor(y)), fx = x - i, fy = y - j, S = C.sky;
    for (let c = 0; c < 3; c++) {
      const k00 = (j * W + i) * 4 + c, k10 = k00 + 4, k01 = k00 + W * 4, k11 = k01 + 4;
      o[c] = (S[k00] * (1 - fx) + S[k10] * fx) * (1 - fy) + (S[k01] * (1 - fx) + S[k11] * fx) * fy;
    }
    return o;
  }
  // Helia's light at the eye: the transmittance toward it (its disc's colour)
  function sunTrans(C, h, sunEl, o) { return trans(C, C.air.R + Math.max(h, 1), Math.sin(sunEl), o); }
  // Very Low: three stops from the same model — the zenith, the horizon (5° up) away from Helia, the horizon under Helia
  function fit3(C, h, sunEl) {
    const sun = [Math.cos(sunEl), Math.sin(sunEl), 0], o = { zen: [0, 0, 0], hor: [0, 0, 0], sunHor: [0, 0, 0] };
    const e5 = 5 * PI / 180;
    ray(C, h, [0, 1, 0], sun, o.zen, null, 16);
    ray(C, h, [-Math.cos(e5), Math.sin(e5), 0].map((v, i) => (i === 2 ? 0 : v)), sun, o.hor, null, 16);
    // (away from Helia: the azimuth opposite; at 90° from it the average of both sides)
    const side = [0, 0, 0]; ray(C, h, [0, Math.sin(e5), Math.cos(e5)], sun, side, null, 16);
    for (let c = 0; c < 3; c++) o.hor[c] = 0.5 * (o.hor[c] + side[c]);
    ray(C, h, [Math.cos(e5), Math.sin(e5), 0], sun, o.sunHor, null, 16);
    return o;
  }
  // the 3-stop sky at a direction (the shader's own formula, for the test): el from the horizon, cph the cosine to the
  // sun's azimuth
  function stops3(s, d, sunDir, o) {
    const el = Math.max(0, d[1]), hs = Math.hypot(sunDir[0], sunDir[2]) || 1, hd = Math.hypot(d[0], d[2]) || 1;
    const cph = (d[0] * sunDir[0] + d[2] * sunDir[2]) / (hs * hd), wS = Math.pow(Math.max(0, cph), 3) * (1 - Math.sqrt(el));
    const k = Math.sqrt(el);
    for (let c = 0; c < 3; c++) o[c] = s.hor[c] + (s.zen[c] - s.hor[c]) * k + (s.sunHor[c] - s.hor[c]) * wS;
    return o;
  }

  // ---------------------------------------------------------------- colour (the tests' CIE L*a*b*, D65)
  function lab(rgb) {
    // (linear sRGB → XYZ → L*a*b*); normalised by the brightest channel so only the hue and saturation speak
    const m = Math.max(rgb[0], rgb[1], rgb[2], 1e-9), r = rgb[0] / m, g = rgb[1] / m, b = rgb[2] / m;
    const X = 0.4124 * r + 0.3576 * g + 0.1805 * b, Y = 0.2126 * r + 0.7152 * g + 0.0722 * b, Z = 0.0193 * r + 0.1192 * g + 0.9505 * b;
    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const fx = f(X / 0.95047), fy = f(Y), fz = f(Z / 1.08883);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }
  // half floats for the texture (RGBA16F)
  const _f = new Float32Array(1), _u = new Uint32Array(_f.buffer);
  function half(v) {
    _f[0] = v; const x = _u[0], s = (x >>> 16) & 0x8000, e = ((x >>> 23) & 0xff) - 112, m = x & 0x7fffff;
    if (e <= 0) return s; if (e >= 31) return s | 0x7bff;
    return s | (e << 10) | (m >>> 13);
  }
  function toHalf(C, out) { const S = C.sky, o = out || new Uint16Array(S.length); for (let i = 0; i < S.length; i++) o[i] = half(S[i]); return o; }

  VR.AtmoLUT = { AIRS, ocker, make, airH, context, setAir, stageAir, update, sample, sunTrans, fit3, stops3, ray, trans, dirOf, lab, toHalf, half, phaseHG, TW, TH, MW, MH, STEPS };
})(typeof VR !== 'undefined' ? VR : (globalThis.VR = globalThis.VR || {}));

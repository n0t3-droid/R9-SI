// ============================================================================
// Atmosphere (F1 · Licht & Luft): the daylight sky as a closed-form model. The luminance follows the Perez
// distribution (Perez et al. 1993) with the turbidity fits of Preetham, Shirley & Smits (1999); the colour is CIE xyY
// converted to linear sRGB. A twilight term paints the colour order of dusk and dawn (orange at the sun side of the
// horizon, magenta above it, blue higher up), a night base is dark blue. The same function is evaluated per pixel on
// the higher tiers and baked into a 64×32 lookup table on Very Low (rebuilt when the sun, the turbidity or the tint
// moves). Pure functions: test/atmos.js checks them in node. Game HDR units: 1.0 ≈ a white surface in noon sun.
// The sky depends only on two angles: the view's zenith angle θ (cos θ = dir.y) and the angle γ to the sun, so the
// table is indexed by those two (the sun's azimuth does not matter). Table mapping (also in the shaders):
//   u = sqrt(γ / π)            (fine near the sun)
//   v = 1 − sqrt(1 − 2θ / π)   (fine near the horizon)
// ============================================================================
(function (VR) {
  'use strict';
  const PI = Math.PI;
  const LUT_W = 64, LUT_H = 32;
  const SKY_SCALE = 0.085;   // Perez luminance (kcd/m²) → game HDR: a clear noon zenith lands near 0.35
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  // Perez coefficients A..E as linear functions of the turbidity T (Preetham et al. 1999, their Table 1)
  const LUM = (T) => [0.1787 * T - 1.4630, -0.3554 * T + 0.4275, -0.0227 * T + 5.3251, 0.1206 * T - 2.5771, -0.0670 * T + 0.3703];
  const CHX = (T) => [-0.0193 * T - 0.2592, -0.0665 * T + 0.0008, -0.0004 * T + 0.2125, -0.0641 * T - 0.8989, -0.0033 * T + 0.0452];
  const CHY = (T) => [-0.0167 * T - 0.2608, -0.0950 * T + 0.0092, -0.0079 * T + 0.2102, -0.0441 * T - 1.6537, -0.0109 * T + 0.0529];
  // zenith chromaticity: rows for T², T, 1 — each row holds the coefficients of θs³, θs², θs, 1 (Preetham, Table 2)
  const MX = [[0.00166, -0.00375, 0.00209, 0], [-0.02903, 0.06377, -0.03202, 0.00394], [0.11693, -0.21196, 0.06052, 0.25886]];
  const MY = [[0.00275, -0.00610, 0.00317, 0], [-0.04214, 0.08970, -0.04153, 0.00516], [0.15346, -0.26756, 0.06670, 0.26688]];
  const zenithChroma = (M, T, th) => {
    const p = [th * th * th, th * th, th, 1];
    const row = (r) => r[0] * p[0] + r[1] * p[1] + r[2] * p[2] + r[3] * p[3];
    return T * T * row(M[0]) + T * row(M[1]) + row(M[2]);
  };
  // zenith luminance in kcd/m² (Preetham's χ fit); clamped at 0 where the fit runs past the sun's grazing angle
  const zenithLum = (T, th) => {
    const chi = (4 / 9 - T / 120) * (PI - 2 * th);
    return Math.max(0, (4.0453 * T - 4.9710) * Math.tan(chi) - 0.2155 * T + 2.4192);
  };
  // the Perez shape F(θ, γ) = (1 + A e^{B/cosθ}) (1 + C e^{Dγ} + E cos²γ)
  const perez = (c, ct, g, cg) => (1 + c[0] * Math.exp(c[1] / ct)) * (1 + c[2] * Math.exp(c[3] * g) + c[4] * cg * cg);

  // the sun's direction at a time of day (0 = sunrise, 0.25 = noon, 0.5 = sunset, 0.75 = midnight): the eternal-dusk
  // path of env.js — the sun never rises above ~25°
  function sunDir(tod) {
    const th = tod * 2 * PI, el = Math.sin(th) * 0.42, az = th + 0.4;
    const x = Math.cos(az) * Math.cos(el), y = Math.sin(el), z = Math.sin(az) * Math.cos(el);
    const l = Math.hypot(x, y, z) || 1;
    return [x / l, y / l, z / l];
  }

  // everything that depends only on the sun, the turbidity and the tint: computed once per sky state
  // opt: { T (2..10, default 2.5), tint [r,g,b] (default 1), scale }
  function prepare(sun, opt) {
    opt = opt || {};
    const T = clamp(opt.T === undefined ? 2.5 : opt.T, 1.5, 10);
    const se = clamp(sun[1], -1, 1);
    // the zenith angle of the sun, held just short of the horizon line the fits are made for
    const th = Math.min(Math.acos(se), PI / 2 - 0.01);
    const cY = LUM(T), cX = CHX(T), cC = CHY(T);
    const cs = Math.cos(th);
    const s = {
      T, sun: [sun[0], sun[1], sun[2]], th,
      cY, cX, cC,
      Yz: zenithLum(T, th),
      xz: zenithChroma(MX, T, th), yz: zenithChroma(MY, T, th),
      // the normalisers: the view at the zenith looking at the sun (γ = θs)
      FY0: perez(cY, 1, th, cs), FX0: perez(cX, 1, th, cs), FC0: perez(cC, 1, th, cs),
      // how much of each part is on: the day shape fades out at dusk, the twilight colours hang on the sun's set,
      // the night base takes over once the sun is ~17° under the horizon
      dayK: smooth(-0.09, 0.07, se),
      twiK: smooth(-0.32, -0.02, se) * (1 - smooth(0.06, 0.22, se)),
      nightK: smooth(-0.06, -0.30, se),
      tint: opt.tint || [1, 1, 1],
      scale: opt.scale === undefined ? SKY_SCALE : opt.scale,
    };
    return s;
  }

  // the sky's linear RGB radiance toward a direction: cT = cos of the view's zenith angle (the direction's y), cG = cos of
  // the angle to the sun. Below the horizon (cT < 0) it returns the horizon colour (the ground is drawn elsewhere).
  function radiance(s, cT, cG) {
    const ct = Math.max(cT, 0.01);
    const cg = clamp(cG, -1, 1), g = Math.acos(cg);
    let r = 0, gr = 0, b = 0;
    if (s.dayK > 0) {
      const Y = s.Yz * perez(s.cY, ct, g, cg) / s.FY0 * s.scale;
      const x = s.xz * perez(s.cX, ct, g, cg) / s.FX0;
      const y = Math.max(0.01, s.yz * perez(s.cC, ct, g, cg) / s.FC0);
      const X = x / y * Y, Z = (1 - x - y) / y * Y;
      r = (3.2406 * X - 1.5372 * Y - 0.4986 * Z) * s.dayK * s.tint[0];
      gr = (-0.9689 * X + 1.8758 * Y + 0.0415 * Z) * s.dayK * s.tint[1];
      b = (0.0557 * X - 0.2040 * Y + 1.0570 * Z) * s.dayK * s.tint[2];
    }
    if (s.twiK > 0) {
      // the colour order of dusk and dawn: orange low on the sun side, rose and magenta above it, violet higher still
      const h = Math.max(cT, 0), band = Math.exp(-h / 0.11), upper = Math.exp(-h / 0.32);
      const side = smooth(-0.2, 0.95, cg);
      const low = mix3([0.80, 0.30, 0.52], [1.00, 0.42, 0.14], side);
      const high = mix3([0.30, 0.22, 0.52], [0.62, 0.30, 0.50], side);
      const k = 0.9 * s.twiK;
      r += (low[0] * band + high[0] * upper * 0.55) * k;
      gr += (low[1] * band + high[1] * upper * 0.55) * k;
      b += (low[2] * band + high[2] * upper * 0.55) * k;
    }
    if (s.nightK > 0) {
      // the night base: dark blue, a little lighter at the horizon
      const n = mix3([0.030, 0.040, 0.085], [0.010, 0.016, 0.042], Math.sqrt(Math.max(cT, 0)));
      r += n[0] * s.nightK; gr += n[1] * s.nightK; b += n[2] * s.nightK;
    }
    return [Math.max(0, r), Math.max(0, gr), Math.max(0, b)];
  }

  // the lookup-table coordinates of a direction (cT, cG), as in the shaders
  function lutUV(cT, cG) {
    const g = Math.acos(clamp(cG, -1, 1)), t = Math.acos(clamp(cT, 0, 1));
    return [Math.sqrt(g / PI), 1 - Math.sqrt(Math.max(0, 1 - 2 * t / PI))];
  }
  // the table: LUT_W × LUT_H RGBA floats, texel centres at (i + 0.5) / W, (j + 0.5) / H
  function buildLUT(s) {
    const out = new Float32Array(LUT_W * LUT_H * 4);
    for (let j = 0; j < LUT_H; j++) {
      const v = (j + 0.5) / LUT_H, th = (PI / 2) * (2 * v - v * v), cT = Math.cos(th);
      for (let i = 0; i < LUT_W; i++) {
        const u = (i + 0.5) / LUT_W, g = PI * u * u;
        const c = radiance(s, cT, Math.cos(g));
        const k = (j * LUT_W + i) * 4;
        out[k] = c[0]; out[k + 1] = c[1]; out[k + 2] = c[2]; out[k + 3] = 1;
      }
    }
    return out;
  }
  // bilinear lookup in such a table (what the GPU does with a linear-filtered texture)
  function sampleLUT(lut, cT, cG) {
    const uv = lutUV(cT, cG);
    const fx = clamp(uv[0] * LUT_W - 0.5, 0, LUT_W - 1), fy = clamp(uv[1] * LUT_H - 0.5, 0, LUT_H - 1);
    const i0 = Math.floor(fx), j0 = Math.floor(fy), i1 = Math.min(LUT_W - 1, i0 + 1), j1 = Math.min(LUT_H - 1, j0 + 1);
    const ax = fx - i0, ay = fy - j0;
    const out = [0, 0, 0];
    for (let c = 0; c < 3; c++) {
      const a = lut[(j0 * LUT_W + i0) * 4 + c], b = lut[(j0 * LUT_W + i1) * 4 + c];
      const d = lut[(j1 * LUT_W + i0) * 4 + c], e = lut[(j1 * LUT_W + i1) * 4 + c];
      out[c] = (a + (b - a) * ax) * (1 - ay) + (d + (e - d) * ax) * ay;
    }
    return out;
  }

  // the exposure eases toward its target: a first-order approach, faster up (eyes adapt to the dark quickly) than
  // down (the bright sky is not so urgent); dt in seconds; it never overshoots
  function easeExposure(cur, target, dt, tauUp, tauDown) {
    const tau = target > cur ? tauUp : tauDown;
    return cur + (target - cur) * (1 - Math.exp(-Math.max(0, dt) / tau));
  }
  // the exposure a scene wants from its log-average luminance: the key (0.18 by default) pulled to the middle grey;
  // partial adaptation (power < 1) keeps the picture recognisable, and the range keeps a cave and a noon from
  // turning into a silhouette or a white sheet
  function exposureTarget(logLum, key, lo, hi, power) {
    const k = key === undefined ? 0.18 : key, p = power === undefined ? 0.5 : power;
    return clamp(Math.pow(k / Math.exp(clamp(logLum, -12, 6)), p), lo, hi);
  }

  // the state packed for the shaders (the same numbers as radiance(), with the normalisers folded in):
  //   per: the five Perez coefficients of Y, x and y (15 floats); k: kY, kx, ky (scale and normalisers) and dayK;
  //   k2: twiK, nightK; tint: rgb
  function glParams(s) {
    const per = new Float32Array(15);
    per.set(s.cY, 0); per.set(s.cX, 5); per.set(s.cC, 10);
    return {
      per,
      k: [s.Yz * s.scale / s.FY0, s.xz / s.FX0, s.yz / s.FC0, s.dayK],
      k2: [s.twiK, s.nightK],
      tint: s.tint,
    };
  }

  VR.Atmos = { SKY_SCALE, LUT_W, LUT_H, sunDir, prepare, radiance, lutUV, buildLUT, sampleLUT, easeExposure, exposureTarget, zenithLum, zenithChroma, glParams };
})(VR);

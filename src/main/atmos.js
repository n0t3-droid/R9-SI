// ============================================================================
// Atmosphere (F1 · Licht & Luft): the daylight sky as a closed-form model. The luminance follows the Perez
// distribution (Perez et al. 1993) with the turbidity fits of Preetham, Shirley & Smits (1999); the colour is CIE xyY
// (our own chroma fit, see below) converted to linear sRGB. A twilight term paints the colour order of dusk and dawn
// (orange at the sun side of the horizon, magenta above it, a violet-blue zenith), a night base is dark blue. The same
// function is evaluated per pixel on the higher tiers and baked into a 64×32 lookup table on Very Low (rebuilt when
// the sun, the turbidity or the tint moves). On top of it, in every tier and outside the table (it follows the sun's
// colour and the weather from frame to frame): the warm glow around the sun and the warm band along the horizon (the
// "eternal dusk" of TRAILER.md §2.1, the terms v0.41 drew), and the weather (rain greys the sky, overcast and storms
// dim it, by v0.41's palette factors). air() is that sum — the shaders' atmoAir(); test/atmos.js and
// test/atmos_look.js check it in node. Game HDR units: 1.0 ≈ a white surface in noon sun.
// The sky depends only on two angles: the view's zenith angle θ (cos θ = dir.y) and the angle γ to the sun, so the
// table is indexed by those two (the sun's azimuth does not matter). Table mapping (also in the shaders):
//   u = sqrt(γ / π)            (fine near the sun)
//   v = 1 − sqrt(1 − 2θ / π)   (fine near the horizon)
// ============================================================================
(function (VR) {
  'use strict';
  const PI = Math.PI;
  const LUT_W = 64, LUT_H = 32;
  const SKY_SCALE = 0.06;    // Perez luminance (kcd/m²) → game HDR: a clear noon zenith lands near 0.2 (v0.41 palette)
  // the look's numbers (the shaders get them as uniforms, so test/f1_look.mjs can try variants at run time):
  //   scale: luminance to HDR; horizonA: the horizon's brightening (× the Perez A term: more = a deeper zenith against
  //   the same horizon once the scale is lowered); broad, band, sharp: the glow's wide warm lobe around the sun, its
  //   warm band along the horizon, its tight bright lobe (v0.41's 1.3, 0.45, 0.45)
  //   horXY: the horizon's chromaticity (a pale blue)
  //   chP: the power of cos θ along which the chroma goes from the horizon's to the zenith's (small: blue down low)
  // (tuned on the six weather scenes against v0.41 and the trailer: a deeper zenith, the blue held up high, a warm
  // peach-pink band along the horizon — TRAILER.md §2.1 "horizon peach/pink → mid violet-blue → zenith deep blue")
  //   sideC: the chroma's sun-side C for x and y by day (the sky within ~25° of the sun is whiter and warmer: forward
  //   scattering on the haze; a low sun raises them to 0.55 and 0.35)
  //   palette (0..1): how far the sky follows env.js's day palette (E.skyPal: the zenith's and the horizon's colour)
  //   instead of these numbers — its chroma at both ends, its zenith luminance and its horizon-to-zenith ratio, on
  //   the Perez shape, with the glow and the weather on top. 0 here; a grade that sets its look in the palette (the
  //   trailer grade of v0.42, env.js VR.Grade) sets 1 and keeps its colours
  const K = { scale: 0.05, horizonA: 0.9, broad: 1.3, band: 0.8, sharp: 0.45, horXY: [0.285, 0.28], chP: 0.7, sideC: [0.25, 0.2], palette: 0 };
  const xyY = (c) => {
    const X = 0.4124 * c[0] + 0.3576 * c[1] + 0.1805 * c[2], Y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], Z = 0.0193 * c[0] + 0.1192 * c[1] + 0.9505 * c[2];
    const S = X + Y + Z || 1;
    return [X / S, Y / S, Y];
  };
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  // Perez coefficients A..E as linear functions of the turbidity T (Preetham et al. 1999, their Table 1).
  // Three of them are ours: C, the sun's aureole, is damped to 15 % and falls off faster (AUREOLE_FALL): the published
  // glow turned the sky on the sun's side white in blue (28 % of the clear noon sky clipped) — the warm glow around the
  // sun is glow() instead; B, the horizon brightening, is lowered by HORIZON_DIM (the published fit puts the horizon
  // at 1.19 × v0.41's luminance with its blue above 1, so the band clipped in blue).
  const SUN_GLOW = 0.15, HORIZON_DIM = 0.14, AUREOLE_FALL = 0.8;
  // Chromaticity (our own fit): the published Preetham chroma whitens the sky from ~30° down (x 0.32 at the horizon
  // against 0.24 overhead), so the picture went pale. Here the chroma runs from the zenith's deep blue to the horizon's
  // pale blue along (cos θ)^0.42 — the blue holds down to a few degrees above the horizon, then pales (the gradient of
  // v0.41's palette, which the trailer's sky also has) — times a Perez sun-side term (C e^{Dγ}: a little warmer toward
  // the sun). Turbidity whitens both ends toward the white point (by a quarter of the way at most, in a storm). While
  // the sun is low the zenith turns violet-blue (XY_TWI, the palette's dusk zenith), never orange: the warm colours of
  // dawn and dusk sit low on the sun's side (the twilight term), the zenith stays blue as in the real sky.
  // The sun-side term warms the sky near a low sun (its light comes the long way through the air): C grows and the
  // lobe narrows (D) as the sun nears the horizon line — orange-yellow beside the rising sun, neutral 30° away.
  const CH_P = 0.42;
  const XY_ZEN = [0.212, 0.198], XY_TWI = [0.228, 0.186], XY_WHITE = [0.3127, 0.3290];
  const ONE3 = [1, 1, 1];
  const whiten = (xy, T) => { const h = clamp((T - 2) / 8, 0, 1) * 0.25; return [xy[0] + (XY_WHITE[0] - xy[0]) * h, xy[1] + (XY_WHITE[1] - xy[1]) * h]; };
  // the zenith's chromaticity: deep blue by day, violet-blue while the sun is within ~20° of the horizon line
  const zenithXY = (T, se) => {
    const w = 1 - smooth(0.02, 0.35, se);
    return whiten([XY_ZEN[0] + (XY_TWI[0] - XY_ZEN[0]) * w, XY_ZEN[1] + (XY_TWI[1] - XY_ZEN[1]) * w], T);
  };
  const horizonXY = (T) => whiten(K.horXY, T);

  // zenith luminance in kcd/m² (Preetham's χ fit); clamped at 0 where the fit runs past the sun's grazing angle
  const zenithLum = (T, th) => {
    const chi = (4 / 9 - T / 120) * (PI - 2 * th);
    return Math.max(0, (4.0453 * T - 4.9710) * Math.tan(chi) - 0.2155 * T + 2.4192);
  };
  // the Perez shape F(θ, γ) = (1 + A e^{B/cosθ}) (1 + C e^{Dγ} + E cos²γ)
  const perez = (c, ct, g, cg) => (1 + c[0] * Math.exp(c[1] / ct)) * (1 + c[2] * Math.exp(c[3] * g) + c[4] * cg * cg);
  // the chroma's shape: the horizon value plus the zenith's difference along (cos θ)^p, times the sun-side term
  const chroma = (h, dz, side, w, g) => (h + dz * w) * (1 + side[0] * Math.exp(side[1] * g));

  // the sun's direction at a time of day (0 = sunrise, 0.25 = noon, 0.5 = sunset, 0.75 = midnight): the eternal-dusk
  // path of env.js — the sun never rises above ~25°
  function sunDir(tod) {
    const th = tod * 2 * PI, el = Math.sin(th) * 0.42, az = th + 0.4;
    const x = Math.cos(az) * Math.cos(el), y = Math.sin(el), z = Math.sin(az) * Math.cos(el);
    const l = Math.hypot(x, y, z) || 1;
    return [x / l, y / l, z / l];
  }

  // everything that depends only on the sun, the turbidity, the overcast and the tint: computed once per sky state
  // opt: { T (2..10, default 2.5), overcast (0..1: the rain's cloud deck hides the sun, so the sky loses its bright
  // side: the sun-side terms C and E of the luminance fade), tint [r,g,b] (default 1), scale }
  function prepare(sun, opt, out) {
    opt = opt || {};
    // out: a state to fill again (the renderer's, every frame: no allocation)
    const s = out || { sun: [0, 0, 0], cY: [0, 0, 0, 0, 0], sx: [0, 0], sy: [0, 0] };
    const T = clamp(opt.T === undefined ? 2.5 : opt.T, 1.5, 10);
    const se = clamp(sun[1], -1, 1);
    // the zenith angle of the sun, held just short of the horizon line the fits are made for
    const th = Math.min(Math.acos(se), PI / 2 - 0.01);
    const oc = 1 - 0.85 * clamp(opt.overcast || 0, 0, 1);
    const cY = s.cY;
    cY[0] = (0.1787 * T - 1.4630) * K.horizonA; cY[1] = -0.3554 * T + 0.4275 - HORIZON_DIM; cY[2] = (-0.0227 * T + 5.3251) * SUN_GLOW * oc;
    cY[3] = 0.1206 * T - 2.5771 - AUREOLE_FALL; cY[4] = (-0.0670 * T + 0.3703) * oc;
    // the palette (K.palette > 0, opt.pal = [zenith rgb, horizon rgb]): its horizon-to-zenith luminance ratio R sets
    // the brightening A from 1 / (1 + A e^B) = R, its ends set the chroma and the zenith luminance (below)
    const pk = opt.pal ? clamp(K.palette, 0, 1) : 0;
    const pz = pk > 0 ? xyY(opt.pal[0]) : null, ph = pk > 0 ? xyY(opt.pal[1]) : null;
    if (pk > 0) {
      const R = clamp(ph[2] / Math.max(pz[2], 1e-4), 1.05, 8);
      cY[0] += (clamp((1 / R - 1) / Math.exp(cY[1]), -4, -0.05) - cY[0]) * pk;
    }
    const cs = Math.cos(th);
    // the zenith's chromaticity (deep blue by day, violet-blue while the sun is low) and the horizon's, whitened by T
    const wz = 1 - smooth(0.02, 0.35, se), hw = clamp((T - 2) / 8, 0, 1) * 0.25;
    const zx = XY_ZEN[0] + (XY_TWI[0] - XY_ZEN[0]) * wz, zy = XY_ZEN[1] + (XY_TWI[1] - XY_ZEN[1]) * wz;
    const low = wz;
    s.sx[0] = K.sideC[0] + (0.55 - K.sideC[0]) * low; s.sx[1] = -2.5 - 0.5 * low; s.sy[0] = K.sideC[1] + (0.35 - K.sideC[1]) * low; s.sy[1] = -2.7 - 0.5 * low;
    s.T = T; s.sun[0] = sun[0]; s.sun[1] = sun[1]; s.sun[2] = sun[2]; s.th = th;
    s.Yz = zenithLum(T, th);
    s.xz = zx + (XY_WHITE[0] - zx) * hw; s.yz = zy + (XY_WHITE[1] - zy) * hw;
    s.xh = K.horXY[0] + (XY_WHITE[0] - K.horXY[0]) * hw; s.yh = K.horXY[1] + (XY_WHITE[1] - K.horXY[1]) * hw;
    // the normalisers: the view at the zenith looking at the sun (γ = θs)
    s.FY0 = perez(cY, 1, th, cs); s.SX0 = 1 + s.sx[0] * Math.exp(s.sx[1] * th); s.SY0 = 1 + s.sy[0] * Math.exp(s.sy[1] * th);
    // how much of each part is on: the day shape fades out at dusk, the twilight colours hang on the sun's set,
    // the night base takes over once the sun is ~17° under the horizon
    s.dayK = smooth(-0.09, 0.07, se);
    s.twiK = smooth(-0.32, -0.02, se) * (1 - smooth(0.06, 0.22, se));
    s.nightK = smooth(-0.06, -0.30, se);
    s.tint = opt.tint || ONE3;
    s.chP = K.chP;
    s.scale = opt.scale === undefined ? K.scale : opt.scale;
    if (pk > 0) {
      s.xz += (pz[0] - s.xz) * pk; s.yz += (pz[1] - s.yz) * pk; s.xh += (ph[0] - s.xh) * pk; s.yh += (ph[1] - s.yh) * pk;
      s.scale += (pz[2] / Math.max(s.Yz, 1e-3) - s.scale) * pk;
    }
    return s;
  }

  // the twilight colours (dusk and dawn): orange low on the sun side, rose and magenta above it, a violet-blue zenith
  const TW_ZEN = [0.060, 0.050, 0.200];
  // the sky's linear RGB radiance toward a direction: cT = cos of the view's zenith angle (the direction's y), cG = cos of
  // the angle to the sun. Below the horizon (cT < 0) it returns the horizon colour (the ground is drawn elsewhere).
  function radiance(s, cT, cG) {
    const ct = Math.max(cT, 0.01);
    const cg = clamp(cG, -1, 1), g = Math.acos(cg);
    let r = 0, gr = 0, b = 0;
    if (s.dayK > 0) {
      const w = Math.pow(ct, s.chP);
      const Y = s.Yz * perez(s.cY, ct, g, cg) / s.FY0 * s.scale;
      const x = chroma(s.xh, s.xz - s.xh, s.sx, w, g) / s.SX0;
      const y = Math.max(0.01, chroma(s.yh, s.yz - s.yh, s.sy, w, g) / s.SY0);
      const X = x / y * Y, Z = (1 - x - y) / y * Y;
      r = (3.2406 * X - 1.5372 * Y - 0.4986 * Z) * s.dayK * s.tint[0];
      gr = (-0.9689 * X + 1.8758 * Y + 0.0415 * Z) * s.dayK * s.tint[1];
      b = (0.0557 * X - 0.2040 * Y + 1.0570 * Z) * s.dayK * s.tint[2];
    }
    if (s.twiK > 0) {
      // the colour order of dusk and dawn: orange low on the sun side, rose and magenta above it, violet-blue higher up
      const h = Math.max(cT, 0), band = Math.exp(-h / 0.11), upper = Math.exp(-h / 0.32);
      const side = smooth(-0.2, 0.95, cg);
      const low = mix3([0.80, 0.30, 0.52], [1.00, 0.42, 0.14], side);
      const high = mix3([0.30, 0.22, 0.52], [0.62, 0.30, 0.50], side);
      const k = 0.9 * s.twiK, zk = (1 - upper) * s.twiK;
      r += (low[0] * band + high[0] * upper * 0.55) * k + TW_ZEN[0] * zk;
      gr += (low[1] * band + high[1] * upper * 0.55) * k + TW_ZEN[1] * zk;
      b += (low[2] * band + high[2] * upper * 0.55) * k + TW_ZEN[2] * zk;
    }
    if (s.nightK > 0) {
      // the night base: dark blue, a little lighter at the horizon
      const n = mix3([0.030, 0.040, 0.085], [0.010, 0.016, 0.042], Math.sqrt(Math.max(cT, 0)));
      r += n[0] * s.nightK; gr += n[1] * s.nightK; b += n[2] * s.nightK;
    }
    return [Math.max(0, r), Math.max(0, gr), Math.max(0, b)];
  }

  // the warm light around the sun (forward scattering on the haze) and the warm band along the horizon, in the sun's
  // colour and the low sun's (sunset) colour — v0.41's terms, the eternal dusk's glow; cT, cG as in radiance()
  function glow(cT, cG, P) {
    const toSun = Math.max(cG, 0), h = Math.max(cT, 0);
    const a = (Math.pow(toSun, 7) * K.broad + Math.pow(1 - h, 5) * K.band) * (0.3 + 0.7 * toSun);
    const c = Math.pow(toSun, 60) * K.sharp * (1 - P.rain);
    return [P.sunset[0] * a + P.sunColor[0] * c, P.sunset[1] * a + P.sunColor[1] * c, P.sunset[2] * a + P.sunColor[2] * c];
  }
  // the weather on the sky (env.js skyWx = [grey, dim]): rain greys it, overcast and storms dim it, and the rain's
  // horizon keeps a lighter band (the showers' far edge — v0.41's rain sky had it: the far land stands out against it)
  function weather(c, P, cT) {
    const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    const k = P.dim * (1 + 0.45 * P.grey * Math.pow(1 - clamp(cT === undefined ? 1 : cT, 0, 1), 16));
    return [(c[0] + (l - c[0]) * P.grey) * k, (c[1] + (l - c[1]) * P.grey) * k, (c[2] + (l - c[2]) * P.grey) * k];
  }
  // what the sky pass and the aerial perspective see toward a direction: the radiance (formula or table), the glow
  // (glowK: 1 for the sky, HAZE_GLOW for the haze over the land — calmer, so looking sunward does not wash the land
  // out), then the weather. P = airParams(E).
  function air(s, cT, cG, P, glowK) {
    const c = radiance(s, cT, cG), gl = glow(cT, cG, P), k = glowK === undefined ? 1 : glowK;
    return weather([c[0] + gl[0] * k, c[1] + gl[1] * k, c[2] + gl[2] * k], P, cT);
  }
  // the frame's parameters of air() from the environment (env.js E)
  function airParams(E) {
    const wx = E.skyWx || [0, 1];
    return { sunColor: E.sunColor || [0, 0, 0], sunset: E.sunset || [0, 0, 0], rain: E.rain || 0, grey: wx[0], dim: wx[1] };
  }
  // the weather's factors for the sky from the eased weather visuals (weather.js v: rain, dark): v0.41's palette greyed
  // the zenith by 75 % and the horizon by 70 % of the rain, and dimmed them by (1 − 0.45/0.4 · rain)(1 − 0.5/0.4 · dark)
  function skyWeather(rain, dark) {
    return [0.72 * rain, (1 - 0.42 * rain) * (1 - 0.45 * dark)];
  }
  // the haze's share of the sun-side glow, and the share of the fog colour (biome fog, the rain's grey) in the haze
  // HAZE_K: the far land's air is a little darker than the sky at the horizon (its path is kilometres, the horizon
  // sky's a hundred), so a far ridge stays a readable silhouette instead of a bright band
  const HAZE_GLOW = 0.45, FOG_MIX = 0.35, HAZE_K = 0.93;
  // the colour the far land turns toward (applyFog): the air toward the view (horizontal at most) with a calmer glow,
  // and 35 % of the fog colour's hue at the air's own luminance — the biome's fog and the rain's grey tint the haze as
  // in v0.41, but the haze is never brighter than the sky it fades into (no white veil)
  // (cT may be negative: looking down, the haze darkens toward 60 % as v0.41's did; cG is taken at the horizontal)
  function haze(s, cT, cG, P, fogColor) {
    const c0 = air(s, Math.max(cT, 0), cG, P, HAZE_GLOW), c = [c0[0] * HAZE_K, c0[1] * HAZE_K, c0[2] * HAZE_K];
    const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    const fl = Math.max(1e-3, 0.2126 * fogColor[0] + 0.7152 * fogColor[1] + 0.0722 * fogColor[2]), k = l / fl;
    const down = cT < 0 ? 1 - 0.4 * clamp(-cT * 2, 0, 1) : 1;
    return [(c[0] + (fogColor[0] * k - c[0]) * FOG_MIX) * down, (c[1] + (fogColor[1] * k - c[1]) * FOG_MIX) * down, (c[2] + (fogColor[2] * k - c[2]) * FOG_MIX) * down];
  }

  // the lookup-table coordinates of a direction (cT, cG), as in the shaders
  function lutUV(cT, cG) {
    const g = Math.acos(clamp(cG, -1, 1)), t = Math.acos(clamp(cT, 0, 1));
    return [Math.sqrt(g / PI), 1 - Math.sqrt(Math.max(0, 1 - 2 * t / PI))];
  }
  // the table: LUT_W × LUT_H RGBA floats, texel centres at (i + 0.5) / W, (j + 0.5) / H
  function buildLUT(s, out) {
    out = out || new Float32Array(LUT_W * LUT_H * 4);
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
  // the exposure a scene wants from its log-average luminance (the scene × env.js's exposure, so the two adaptations do
  // not stack): inside a dead zone around the key (1.6 stops below, 1 above) nothing changes — the weather keeps its own
  // brightness (an overcast day is darker than a clear one, a snowfield brighter); outside it the exposure follows a
  // part (power) of the difference, kept within ±0.5 stops. night (0..1) lowers the key: the night stays dark.
  function exposureTarget(logLum, night, o) {
    const E = Object.assign({}, EXPOSURE, o || {});
    const key = E.key * (1 + (E.nightKey - 1) * clamp(night || 0, 0, 1));
    const lum = Math.exp(clamp(logLum, -12, 6)), lo = key * Math.pow(2, -E.deadDark), hi = key * Math.pow(2, E.deadBright);
    const t = lum < lo ? Math.pow(lo / lum, E.power) : lum > hi ? Math.pow(hi / lum, E.power) : 1;
    return clamp(t, E.lo, E.hi);
  }
  // the GPU exposure's constants (renderer.js updateExposure, shaders.js EXPOSE_FS): the key is the log-average
  // luminance of a clear noon scene (exposed by env.js) that wants exposure 1; deadDark/deadBright: the dead zone in
  // stops below and above it (a storm at noon is about 1.2 stops under the clear day and keeps its gloom); power: the
  // part of the difference beyond it; lo/hi: ±0.5 stops around 1; nightKey: the key's share at night; tauUp/tauDown:
  // seconds to ease toward a brighter or a darker target
  const EXPOSURE = { key: 0.4, deadDark: 1.6, deadBright: 1, power: 0.5, lo: Math.SQRT1_2, hi: Math.SQRT2, nightKey: 0.25, tauUp: 2.0, tauDown: 3.0 };

  // the state packed for the shaders (the same numbers as radiance(), with the normalisers folded in):
  //   per: the Perez coefficients of Y (5), then for x and y each: the horizon value, the zenith's difference, the
  //   sun-side C and D, and (x) the chroma gradient's power, (y) a spare (15 floats); k: kY (scale and normaliser), 1/SX0, 1/SY0, dayK; k2: twiK, nightK; tint
  function glParams(s, out) {
    const o = out || { per: new Float32Array(15), k: [0, 0, 0, 0], k2: [0, 0], tint: [1, 1, 1] };
    o.per.set(s.cY, 0);
    o.per[5] = s.xh; o.per[6] = s.xz - s.xh; o.per[7] = s.sx[0]; o.per[8] = s.sx[1]; o.per[9] = s.chP;
    o.per[10] = s.yh; o.per[11] = s.yz - s.yh; o.per[12] = s.sy[0]; o.per[13] = s.sy[1]; o.per[14] = 0;
    o.k[0] = s.Yz * s.scale / s.FY0; o.k[1] = 1 / s.SX0; o.k[2] = 1 / s.SY0; o.k[3] = s.dayK;
    o.k2[0] = s.twiK; o.k2[1] = s.nightK;
    o.tint = s.tint;
    return o;
  }

  VR.Atmos = { SKY_SCALE, K, LUT_W, LUT_H, CH_P, TW_ZEN, EXPOSURE, HAZE_GLOW, FOG_MIX, HAZE_K, sunDir, prepare, radiance, glow, weather, air, haze, airParams, skyWeather, lutUV, buildLUT, sampleLUT, easeExposure, exposureTarget, zenithLum, zenithXY, horizonXY, glParams };
})(VR);

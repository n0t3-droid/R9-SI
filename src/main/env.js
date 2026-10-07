// ============================================================================
// Environment: day/night cycle, sky palette, weather, fog, exposure & grading
// ============================================================================
(function (VR) {
  'use strict';
  const M = VR.M;
  const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const hex3 = (h, k) => [((h >> 16) & 255) / 255 * (k || 1), ((h >> 8) & 255) / 255 * (k || 1), (h & 255) / 255 * (k || 1)];
  const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const DIM_ID = { overworld: 0, flat: 0, underforge: 1, hollow: 2, drift: 3 };
  // a clear sky, when weather.js is not there (tests that load Env alone)
  const CLEAR = { rain: 0, snow: 0, cloud: 0.2, overcast: 0, sunMul: 1, expMul: 1, fog: 0, fogMul: 1, fogEnd: 0, fogLayer: [72, 0], wind: 1, windDir: [1, 0], wet: 0, rainbow: 0, storm: 0 };

  class Env {
    constructor() {
      this.ticks = 1000;          // 0 = sunrise, 6000 noon, 12000 sunset, 18000 midnight
      this.day = 0;
      this.anim = 0;              // seconds for shader animation
      this.rain = 0;              // precipitation at the eye (rain or snow), smoothed by VR.Weather — sim, villagers, sound read it
      this.exposure = 1; this.eyeLight = 1;
      this.flash = 0; this.boltT = 9; this.boltK = 0; this.boltDir = [1, 0]; this.boltTop = 0.35;
      this.cloudX = 0;            // the clouds' drift (wind-driven; at wind 1 the same as before: 0.9 blocks a second)
      this.E = {
        sunDir: [0, 1, 0], moonDir: [0, -1, 0], sunColor: [1, 1, 1], moonColor: [0.2, 0.2, 0.3], ambSky: [0.5, 0.5, 0.6],
        zenith: [0.2, 0.4, 0.9], horizon: [0.6, 0.7, 1], sunset: [0, 0, 0], fogColor: [0.6, 0.7, 0.9], fog: [100, 160, 0, 0],
        rain: 0, time: 0, night: 0, dimId: 0, blockTint: [1, 0.86, 0.68], planetDir: [0, 1, 0], planet2Dir: [0, 1, 0], ringNormal: norm([0.25, 0.92, 0.3]),
        wind: 1, emissiveBoost: 0.5, exposure: 1, grade: [1, 1, 1], saturation: 1.12, bloomThreshold: 1.0, bloomStrength: 0.07, cloudCover: 0.35,
        // A1 Atmosphäre: [wet, overcast, rainbow, moon phase] · fog layer [camera y (renderer), top, density, milky sky] ·
        // lightning bolt [x, y, z, k] · village glow [x, y, z, k] · wind on rain and snow [x, z] blocks a second
        wx: [0, 0, 0, 0], fogH: [0, 0, 0, 0], bolt: [0, 0, 0, 0], glow: [0, 0, 0, 0], windV: [0, 0], cloudX: 0,
      };
    }
    get timeOfDay() { return ((this.ticks % 24000) + 24000) % 24000; }
    setTime(t) { this.ticks = t; }
    update(dt, o) {
      // o: {dim, biome, eyeSky(0..1), underwater, waterColor, renderDist, horizon, freezeTime, exposureMul,
      //     wx (VR.Weather sample; none = a clear sky), sky ('dusk' Ewige Dämmerung | 'real' Echter Tag), wet (the wet
      //     look & rainbow switch, default on), glow ([x, z, strength] toward the nearest village, or null)}
      const E = this.E;
      this.anim += dt;
      if (!o.freezeTime) this.ticks += dt * 20;
      if (this.ticks >= 24000) { this.ticks -= 24000; this.day++; }
      // the weather (VR.Weather decides and smooths; a missing sample is today's clear sky)
      const S = o.wx || (VR.Weather && VR.Weather.CLEAR) || CLEAR;
      this.rain = Math.max(S.rain, S.snow);
      this.cloudX += dt * 0.9 * S.wind;
      const dim = o.dim || 'overworld';
      E.dimId = DIM_ID[dim] !== undefined ? DIM_ID[dim] : 0;
      E.time = this.anim;
      const tod = this.timeOfDay / 24000;
      const th = tod * Math.PI * 2;
      // "eternal dusk" (TRAILER.md §2.1): the sun circles low — it rises in the east, peaks at only ~32° in
      // the south and sets in the west, so the day is one long golden hour with long shadows and the
      // cosmic sky stays visible; at night the moon takes the same low path on the other side.
      // „Echter Tag" (the world's Himmel option): the sun climbs to 70°, the golden light keeps to ±1.5 h of sunrise
      // and sunset, a blue hour comes before sunrise and after sunset, and the nights are 40 % darker
      const real = o.sky === 'real';
      const el = Math.sin(th) * (real ? 1.2217 : 0.42), az = th + 0.4;
      const sun = norm([Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)]);
      E.sunDir = sun; E.moonDir = [-sun[0], -sun[1], -sun[2]];
      const sy = sun[1];
      const day = M.smoothstep(-0.18, 0.22, sy);
      const night = 1 - M.smoothstep(-0.28, 0.02, sy);
      E.night = night;
      const horizonness = real ? Math.max(0, 1 - Math.abs(sy) * 2.25) * (sy > -0.2 ? 1 : 0)
        : Math.max(0, 1 - Math.abs(sy) * 2.0) * (sy > -0.25 ? 1 : 0); // wide: the low sun keeps the golden palette most of the day
      const rain = this.rain;
      const cov = Math.max(rain, S.overcast);   // how grey the sky is: rain, snow or a closed cloud deck
      const dark = real ? 0.6 : 1;               // the night's brightness
      const B = o.biome;
      const bsky = B ? hex3(B.sky) : [0.48, 0.64, 1];
      // palettes (linear-ish HDR)
      // Earth-like day sky: deep azure overhead fading to a luminous cyan-blue at the horizon
      const dayZen = mix3([0.045, 0.17, 0.68], mix3(bsky, [0.07, 0.22, 0.74], 0.62), 0.22);
      const dayHor = mix3([0.40, 0.63, 0.98], bsky, 0.12);
      const nightZen = [0.006 * dark, 0.01 * dark, 0.03 * dark], nightHor = [0.03 * dark, 0.045 * dark, 0.1 * dark];
      let zen = mix3(nightZen, dayZen, day), hor = mix3(nightHor, dayHor, day);
      const sunset = [1.25 * horizonness, 0.46 * horizonness, 0.16 * horizonness];
      // golden hour: the glow sits low around the sun, the sky above deepens to violet (the trailer's dusk)
      hor = mix3(hor, [0.98, 0.52, 0.36], horizonness * 0.55);
      zen = mix3(zen, [0.13, 0.08, 0.38], horizonness * 0.55);
      // the blue hour (Echter Tag): the sun 2–12° below the horizon, the sky a deep clear blue
      const blue = real ? M.smoothstep(0.02, -0.05, sy) * (1 - M.smoothstep(-0.14, -0.24, sy)) : 0;
      if (blue > 0) { zen = mix3(zen, [0.035, 0.07, 0.24], blue * 0.85); hor = mix3(hor, [0.13, 0.19, 0.40], blue * 0.7); }
      // rain and clouds desaturate
      const gray = (c, k) => { const l = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11; return mix3(c, [l, l, l], k); };
      zen = gray(zen, cov * 0.75); hor = gray(hor, cov * 0.7);
      zen = zen.map(v => v * (1 - cov * 0.45)); hor = hor.map(v => v * (1 - cov * 0.4));
      E.zenith = zen; E.horizon = hor; E.sunset = sunset.map(v => v * (1 - cov * 0.8));
      const sunI = M.smoothstep(-0.05, 0.3, sy);
      const warm = 1 - M.smoothstep(0.05, 0.6, sy);
      E.sunColor = mix3([2.9, 2.72, 2.4], [2.7, 1.3, 0.48], warm).map(v => v * sunI * S.sunMul);
      E.moonColor = [0.14 * (1 - cov * 0.6) * dark, 0.18 * (1 - cov * 0.6) * dark, 0.3 * (1 - cov * 0.5) * dark];
      E.ambSky = mix3([0.06 * dark, 0.075 * dark, 0.15 * dark], mix3([0.36, 0.44, 0.66], [0.46, 0.36, 0.52], horizonness * 0.6), day).map(v => v * (1 - cov * 0.35) + cov * 0.08);
      if (blue > 0) E.ambSky = mix3(E.ambSky, [0.07, 0.1, 0.22], blue * 0.5);
      E.fogColor = mix3(hor, [0.5, 0.55, 0.62], cov * 0.4);
      // fog is a pale veil by day, dark at night
      if (S.fog > 0) E.fogColor = mix3(E.fogColor, mix3(hor, [0.74, 0.77, 0.82].map(v => v * (0.08 + 0.92 * day)), 0.65), S.fog * 0.6);
      E.blockTint = [1.0, 0.84, 0.64];
      E.emissiveBoost = 0.45 + night * 1.1;
      E.wind = S.wind;
      E.cloudCover = S.cloud;
      E.cloudX = this.cloudX;
      E.windV = [S.windDir[0] * Math.max(0, S.wind - 0.6) * 2.2, S.windDir[1] * Math.max(0, S.wind - 0.6) * 2.2];
      // the moon waxes and wanes over 8 days (a full moon on the first night)
      E.wx = [o.wet === false ? 0 : S.wet, cov, o.wet === false ? 0 : S.rainbow, (((this.day || 0) + tod + 4) % 8) / 8];
      // the village glow: a warm dome over the town at night, brighter under clouds
      // (o.glow: [x, z, strength, all-around share]; inside the village the glow is everywhere)
      E.glow = o.glow && dim === 'overworld' ? [o.glow[0], o.glow[3] || 0, o.glow[1], o.glow[2] * M.smoothstep(0.3, 0.9, night) * (1 + cov * 0.5)] : [0, 0, 0, 0];
      // celestial bodies ride the same sky rotation
      // the planets never set (TRAILER.md §2.1): the ringed giant circles at ~33° elevation, the blue
      // planet higher up on the other side; both drift slowly around the sky with the day
      const pa = th * 0.5 + 0.55;
      E.planetDir = norm([Math.cos(pa) * 0.84, 0.55, Math.sin(pa) * 0.84]);
      {
        // keep the rings seen at a slant (never face-on): ring normal ~70° away from the line of sight, tilted diagonally
        const P = E.planetDir, upd = P[1];
        let Y = norm([-P[0] * upd, 1 - P[1] * upd, -P[2] * upd]);
        const X = norm([Y[1] * P[2] - Y[2] * P[1], Y[2] * P[0] - Y[0] * P[2], Y[0] * P[1] - Y[1] * P[0]]);
        const c = Math.cos(0.45), sn = Math.sin(0.45);
        const Np = [Y[0] * c + X[0] * sn, Y[1] * c + X[1] * sn, Y[2] * c + X[2] * sn];
        E.ringNormal = norm([Np[0] * 0.94 - P[0] * 0.34, Np[1] * 0.94 - P[1] * 0.34, Np[2] * 0.94 - P[2] * 0.34]);
      }
      const pb = th * 0.5 + 0.55 + 2.4;
      E.planet2Dir = norm([Math.cos(pb) * 0.62, 0.78, Math.sin(pb) * 0.62]);
      // dimension overrides
      const rd = (o.renderDist || 8) * 16;
      let fogStart = rd * 0.62, fogEnd = rd * 1.0, dens = 0.0002 + rain * 0.0035;
      // with the far-terrain horizon the land runs on: fog becomes aerial haze far out
      if (o.horizon > 0 && dim === 'overworld') { fogStart = Math.max(rd * 0.9, o.horizon * 0.4); fogEnd = o.horizon * 0.97; dens = 0.00042 + rain * 0.0032; }
      if (dim === 'underforge') {
        const fc = B && B.fog ? hex3(B.fog, 1) : [0.23, 0.06, 0.04];
        E.fogColor = fc.map(v => v * 1.2); E.zenith = E.fogColor; E.horizon = E.fogColor; E.sunset = [0, 0, 0];
        E.sunColor = [0, 0, 0]; E.moonColor = [0, 0, 0]; E.ambSky = [0.34, 0.2, 0.16]; E.night = 0;
        fogStart = 8; fogEnd = Math.min(rd, 120); dens = 0.006; E.emissiveBoost = 1.2;
      } else if (dim === 'hollow') {
        E.fogColor = [0.03, 0.02, 0.06]; E.ambSky = [0.22, 0.18, 0.3]; E.sunColor = [0, 0, 0]; E.moonColor = [0.25, 0.2, 0.35]; E.night = 1;
        E.moonDir = norm([0.3, 1, 0.2]); E.sunDir = [0, -1, 0]; E.emissiveBoost = 1.3;
      } else if (dim === 'drift') {
        E.ambSky = E.ambSky.map((v, i) => v * 1.1 + [0.02, 0.04, 0.06][i]);
        E.horizon = mix3(E.horizon, [0.85, 0.82, 1.0], 0.3 * day);
        E.fogColor = mix3(E.fogColor, [0.82, 0.86, 1.0], 0.4 * day);
      }
      if (B && B.fog && dim === 'overworld') { const bf = hex3(B.fog); E.fogColor = mix3(E.fogColor, bf.map(v => v * (0.3 + day * 0.7)), 0.5); dens += 0.0017; }
      // Nebel: denser, and closer — at dawn in the valley down to 48 blocks (never less)
      let skyFog = 0;
      if (dim === 'overworld' || dim === 'drift') {
        dens *= S.fogMul;
        if (S.fogEnd > 0 && S.fog > 0.01) {
          const fe = Math.max(48, S.fogEnd);
          if (fe < fogEnd) { fogEnd = fogEnd + (fe - fogEnd) * S.fog; fogStart = fogStart + (fogEnd * 0.08 - fogStart) * S.fog; }
          skyFog = S.fog * M.clamp(1 - (S.fogEnd - 48) / 172, 0, 1);
        }
      }
      E.fogH = [0, S.fogLayer[0], dim === 'overworld' && !o.underwater ? S.fogLayer[1] : 0, skyFog];
      // underwater
      if (o.underwater) {
        const wc = o.waterColor || [0.1, 0.3, 0.5];
        E.fogColor = wc.map(v => v * (0.15 + 0.6 * day) + 0.01);
        E.fog = [0, 1, 0, 1];
      } else E.fog = [fogStart, fogEnd, dens, 0];
      E.rain = rain;
      // lightning: the bolt shows for a moment (with a second stroke), the flash lights land and sky
      if (this.boltT < 0.5) {
        const t0 = this.boltT; this.boltT += dt;
        if (t0 < 0.13 && this.boltT >= 0.13) this.flash = Math.max(this.flash, this.boltK * 0.7);
        const t = this.boltT, vis = t < 0.07 ? 1 : t < 0.13 ? 0.3 : t < 0.22 ? 0.9 : Math.max(0, 1 - (t - 0.22) / 0.2);
        E.bolt = [this.boltDir[0], this.boltTop, this.boltDir[1], vis * this.boltK];
      } else E.bolt = [0, 0, 0, 0];
      // lightning flash
      if (this.flash > 0) { this.flash -= dt * 3; const f = Math.max(0, this.flash); E.ambSky = E.ambSky.map(v => v + f * 1.8); E.zenith = E.zenith.map(v => v + f * 0.6); }
      // eye adaptation
      const target = 1 + (1 - (o.eyeSky === undefined ? 1 : o.eyeSky)) * 0.9 + night * 0.35;
      this.exposure += (target - this.exposure) * Math.min(1, dt * 1.5);
      E.exposure = this.exposure * (o.exposureMul || 1) * 0.94 * S.expMul;
      E.grade = mix3([1.02, 1.0, 0.97], [0.92, 0.97, 1.08], night);
      E.saturation = 1.17 - cov * 0.2;
      E.vivid = 0.6;
      E.bloomThreshold = 0.95; E.bloomStrength = 0.075 + night * 0.04;
      return E;
    }
    // a strike: k = brightness (0..1, by distance), dir = [x, z] toward it (the bolt is drawn there; none: flash only),
    // top = how high the bolt reaches on the sky (tan of the cloud base's elevation from here)
    lightning(k, dir, top) {
      const b = k === undefined ? 1 : k;
      this.flash = Math.max(this.flash, b);
      if (dir) { this.boltDir = [dir[0], dir[1]]; this.boltT = 0; this.boltK = b; this.boltTop = top || 0.35; }
    }
  }
  VR.Env = Env;
})(VR);

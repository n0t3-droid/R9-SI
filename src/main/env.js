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
  // the picture's grade (t-look, the trailer's numbers: test/look_stats.js). VR.Grade holds the knobs the look is tuned
  // with; the defaults are the trailer look, and the look test sets them one at a time to measure each (see
  // test/trailer_look.mjs). expo: exposure of the day · sat: saturation · contrast: S-curve · vignette · fogDens: the
  // haze per block over the far land · skyK: the day sky's brightness · nebula: the cosmic veil · sunDisc: the sun's
  // disc in HDR · bloomThr / bloomStr: the glow (emissives, never the sky) · rays: the god rays · gridK: the Klassisch
  // block edges · sunWarm: the orange of the low sun (its light on the lawns) · sunsetK: the golden-hour glow of the
  // horizon and the warm cast of the sky (renderer.js / shaders.js)
  const GRADE = VR.Grade = Object.assign({ palette: 1, expo: 0.75, sat: 1.12, contrast: 0.3, vignette: 0.3, fogDens: 0.00016, skyK: 1, nebula: 0.55, sunDisc: 8, sunK: 1, bloomThr: 1.15, bloomStr: 0.1, rays: 0.3, gridK: 0.12, sunWarm: 0.5, sunsetK: 0.3 }, VR.Grade || {});

  class Env {
    constructor() {
      this.ticks = 1000;          // 0 = sunrise, 6000 noon, 12000 sunset, 18000 midnight
      this.day = 0;
      this.anim = 0;              // seconds for shader animation
      this.rain = 0; this.snow = 0; this.thunder = 0;
      this.puddle = 0;            // F2: the puddles' fill, 0..1 — they gather in the rain and dry over minutes
      this.wx = new VR.Weather();     // weather.js: the sky's state from the world's schedule, its eased visuals and the bolts
      this.exposure = 1; this.eyeLight = 1;
      this.E = {
        sunDir: [0, 1, 0], moonDir: [0, -1, 0], sunColor: [1, 1, 1], moonColor: [0.2, 0.2, 0.3], ambSky: [0.5, 0.5, 0.6],
        zenith: [0.2, 0.4, 0.9], horizon: [0.6, 0.7, 1], sunset: [0, 0, 0], fogColor: [0.6, 0.7, 0.9], fog: [100, 160, 0, 0],
        rain: 0, snow: 0, wet: 0, puddle: 0, time: 0, night: 0, dimId: 0, blockTint: [1, 0.86, 0.68], planetDir: [0, 1, 0], planet2Dir: [0, 1, 0], ringNormal: norm([0.25, 0.92, 0.3]),
        wind: 1, emissiveBoost: 0.5, exposure: 1, grade: [1, 1, 1], saturation: 1.12, bloomThreshold: 1.0, bloomStrength: 0.07, cloudCover: 0.35,
        contrast: 0, vignette: 0.55, nebula: 1, sunDisc: 16, rays: 0.55, gridK: 0.12,
      };
    }
    get timeOfDay() { return ((this.ticks % 24000) + 24000) % 24000; }
    setTime(t) { this.ticks = t; }
    // legacy readers: rainTarget is 1 while it rains or storms. Writers (sleep, the zen freeze) asking for "no rain"
    // clear the sky until the next slot; the weather itself comes from weather.js (see /wetter)
    get rainTarget() { return this.wx.kind === 'regen' || this.wx.kind === 'gewitter' ? 1 : 0; }
    set rainTarget(v) { if (!(v > 0)) this.wx.clearNow(); }
    update(dt, o) {
      // o: {dim, biome, eyeSky(0..1), underwater, waterColor, renderDist, freezeTime, freezeWeather, lowK, wetOn}
      const E = this.E;
      this.anim += dt;
      if (!o.freezeTime) this.ticks += dt * 20;
      if (this.ticks >= 24000) { this.ticks -= 24000; this.day++; }
      // weather (weather.js): the schedule of the world, eased into the visuals below
      this.wx.update(dt, { ticks: this.ticks, day: this.day, biome: o.biome, dim: o.dim || 'overworld', lowK: o.lowK, freeze: !!o.freezeWeather });
      const W = this.wx.v;
      this.rain = W.rain; this.snow = W.snow; this.thunder = this.wx.kind === 'gewitter' ? 1 : 0;
      const dim = o.dim || 'overworld';
      E.dimId = DIM_ID[dim] !== undefined ? DIM_ID[dim] : 0;
      E.time = this.anim;
      const tod = this.timeOfDay / 24000;
      const th = tod * Math.PI * 2;
      // "eternal dusk" (TRAILER.md §2.1): the sun circles low — it rises in the east, peaks at only ~32° in
      // the south and sets in the west, so the day is one long golden hour with long shadows and the
      // cosmic sky stays visible; at night the moon takes the same low path on the other side
      const el = Math.sin(th) * 0.42, az = th + 0.4;
      const sun = norm([Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)]);
      E.sunDir = sun; E.moonDir = [-sun[0], -sun[1], -sun[2]];
      const sy = sun[1];
      const day = M.smoothstep(-0.18, 0.22, sy);
      const night = 1 - M.smoothstep(-0.28, 0.02, sy);
      E.night = night;
      const horizonness = Math.max(0, 1 - Math.abs(sy) * 2.0) * (sy > -0.25 ? 1 : 0); // wide: the low sun keeps the golden palette most of the day
      const rain = this.rain;
      const B = o.biome;
      const bsky = B ? hex3(B.sky) : [0.48, 0.64, 1];
      // palettes (linear-ish HDR)
      // Earth-like day sky: deep azure overhead fading to a luminous cyan-blue at the horizon
      // the trailer's day sky (t-look): deep violet-blue overhead, a lilac haze at the horizon (solved against the
      // composite's tone curve so that the displayed sky is ~(46,50,150) overhead and ~(170,140,210) at the horizon)
      const oldPal = GRADE.palette === 0;   // VR.Grade.palette 0: the sky of v0.41 (the look test's 'before')
      const dayZen = (oldPal ? mix3([0.045, 0.17, 0.68], mix3(bsky, [0.07, 0.22, 0.74], 0.62), 0.22) : mix3([0.12, 0.09, 0.34], mix3(bsky, [0.12, 0.09, 0.40], 0.62), 0.22)).map(v => v * GRADE.skyK);
      const dayHor = (oldPal ? mix3([0.40, 0.63, 0.98], bsky, 0.12) : mix3([0.453, 0.337, 0.668], bsky, 0.12)).map(v => v * GRADE.skyK);
      const nightZen = [0.006, 0.01, 0.03], nightHor = [0.03, 0.045, 0.1];
      let zen = mix3(nightZen, dayZen, day), hor = mix3(nightHor, dayHor, day);
      const sunset = [1.25, 0.46, 0.16].map(v => v * horizonness * GRADE.sunsetK);
      // golden hour: the glow sits low around the sun, the sky above deepens to violet (the trailer's dusk)
      hor = mix3(hor, [0.98, 0.52, 0.36], horizonness * 0.55 * GRADE.sunsetK);
      zen = mix3(zen, [0.13, 0.08, 0.38], horizonness * 0.55);
      // rain desaturates
      const gray = (c, k) => { const l = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11; return mix3(c, [l, l, l], k); };
      // the state of the sky (weather.js): overcast and storms darken the sky, dim the sun, add cloud and wind
      zen = gray(zen, rain * 0.75); hor = gray(hor, rain * 0.7);
      zen = zen.map(v => v * (1 - rain * 0.45) * (1 - W.dark * 0.5)); hor = hor.map(v => v * (1 - rain * 0.4) * (1 - W.dark * 0.4));
      E.zenith = zen; E.horizon = hor; E.sunset = sunset.map(v => v * (1 - rain * 0.8));
      const sunI = M.smoothstep(-0.05, 0.3, sy);
      const warm = (1 - M.smoothstep(0.05, 0.6, sy)) * GRADE.sunWarm;
      E.sunColor = mix3([2.9, 2.72, 2.4], [2.7, 1.3, 0.48], warm).map(v => v * sunI * (1 - rain * 0.7) * W.sun * GRADE.sunK);
      E.moonColor = [0.14 * (1 - rain * 0.6), 0.18 * (1 - rain * 0.6), 0.3 * (1 - rain * 0.5)];
      E.ambSky = mix3([0.06, 0.075, 0.15], mix3([0.36, 0.44, 0.66], [0.46, 0.36, 0.52], horizonness * 0.6), day).map(v => v * (1 - rain * 0.35) * (1 - W.dark * 0.3) + rain * 0.08);
      // the haze over the far land: a dark violet veil (the trailer's far mountains), not the bright horizon
      E.fogColor = mix3(oldPal ? hor : mix3(hor, [0.25, 0.22, 0.46], 0.6), [0.5, 0.55, 0.62], rain * 0.4);
      E.blockTint = [1.0, 0.84, 0.64];
      E.emissiveBoost = 0.45 + night * 1.1;
      E.wind = W.wind;
      E.windDir = W.windDir;      // the wind's heading (weather.js): the water's swell runs with it
      E.cloudCover = W.cloud;
      // celestial bodies ride the same sky rotation
      // the planets never set (TRAILER.md §2.1): the ringed giant circles at ~33° elevation, the blue
      // planet higher up on the other side; both drift slowly around the sky with the day
      // the bodies (skybodies.js): the giant with its ring, the blue planet and the moons, with their angular radii
      const SB = VR.SkyBodies.at(th);
      E.planetDir = SB.giant; E.ringNormal = SB.ring; E.planet2Dir = SB.blue; E.bodies = SB;
      // dimension overrides
      const rd = (o.renderDist || 8) * 16;
      let fogStart = rd * 0.62, fogEnd = rd * 1.0, dens = 0.0002 + rain * 0.0035;
      // with the far-terrain horizon the land runs on: fog becomes aerial haze far out
      if (o.horizon > 0 && dim === 'overworld') { fogStart = Math.max(rd * 0.9, o.horizon * 0.4); fogEnd = o.horizon * 0.97; dens = GRADE.fogDens + rain * 0.0032; }
      // Nebel (weather.js): three times the density, and the fog stands closer (it ends at 48 blocks at most in the thick of it)
      if (W.fog > 0.001) { const f = W.fog; dens *= 1 + 2 * f; fogEnd += (Math.max(48, fogEnd * 0.5) - fogEnd) * f; fogStart += (fogEnd * 0.3 - fogStart) * f; }
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
      // underwater
      if (o.underwater) {
        const wc = o.waterColor || [0.1, 0.3, 0.5];
        E.fogColor = wc.map(v => v * (0.15 + 0.6 * day) + 0.01);
        E.fog = [0, 1, 0, 1];
      } else E.fog = [fogStart, fogEnd, dens, 0];
      E.rain = rain; E.snow = this.snow;
      // wet ground: the ground darkens a little while it rains (the terrain shader's u_wet; off on Very Low)
      E.wet = o.wetOn ? rain : 0;
      // puddles (F2): they fill within ~30 s of rain and dry with a 4-minute time constant after it stops
      const pt = rain > 0.02 ? rain : 0;
      this.puddle += (pt - this.puddle) * (1 - Math.exp(-dt / (pt > this.puddle ? 30 : 240)));
      E.puddle = o.wetOn ? this.puddle : 0;
      // lightning: the bolt lights the sky (weather.js decides when; the thunder follows by sound)
      const fl = this.wx.flash;
      if (fl > 0.001) { E.ambSky = E.ambSky.map(v => v + fl * 1.8); E.zenith = E.zenith.map(v => v + fl * 0.6); }
      // eye adaptation
      const target = 1 + (1 - (o.eyeSky === undefined ? 1 : o.eyeSky)) * 0.9 + night * 0.35;
      this.exposure += (target - this.exposure) * Math.min(1, dt * 1.5);
      // the day's exposure is the grade's (expo); the night keeps the v0.41 level (0.94), which already matches the frames
      E.exposure = this.exposure * (o.exposureMul || 1) * (GRADE.expo + (0.94 - GRADE.expo) * night) * Math.pow(2, W.exp);
      E.grade = mix3([1.02, 1.0, 0.97], [0.92, 0.97, 1.08], night);
      E.saturation = GRADE.sat - rain * 0.2;
      E.vivid = 0.6;
      E.bloomThreshold = GRADE.bloomThr; E.bloomStrength = GRADE.bloomStr + night * 0.04;
      E.contrast = GRADE.contrast; E.vignette = GRADE.vignette; E.nebula = GRADE.nebula; E.sunDisc = GRADE.sunDisc;
      E.rays = GRADE.rays; E.gridK = GRADE.gridK;
      return E;
    }
    lightning() { this.wx.strike(); }
  }
  VR.Env = Env;
})(VR);

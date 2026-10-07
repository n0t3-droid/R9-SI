// ============================================================================
// Weather (A1 „Atmosphäre"): Klar · Bewölkt · Nebel · Regen · Gewitter · Schnee.
// The kind is a pure function of the world seed, the absolute time and the climate
// under the player — host and guests compute the same sky without a message. Time is
// cut into windows of one day (shifted by a seed phase); a window into slots of 5–20
// minutes; every slot draws one value u, read through the local climate's weights
// (biomes.js `wx`), so one shower is rain on the plains, snow on the peaks and a few
// clouds over the desert.
// ============================================================================
(function (VR) {
  'use strict';
  const M = VR.M;
  const KINDS = ['clear', 'cloudy', 'fog', 'rain', 'storm', 'snow'];
  // per climate, in KINDS order (percent): the spec's dry 85/10/5, temperate 45/25/10/15/5, wet 30/25/10/25/10; cold snows
  const WEIGHTS = { dry: [85, 10, 5, 0, 0, 0], temperate: [45, 25, 10, 15, 5, 0], wet: [30, 25, 10, 25, 10, 0], cold: [40, 25, 10, 0, 0, 25] };
  const DAY = 24000, MIN = 6000, MAXL = 24000;

  class Weather {
    constructor(seed) {
      this.seed = seed >>> 0;
    }
    static climate(biome) {
      if (!biome) return 'temperate';
      const wx = biome.wx || (biome.forge || biome.hollow ? 'none' : biome.temp < 0.15 ? 'cold' : biome.down <= 0 ? 'dry' : biome.down >= 0.85 ? 'wet' : 'temperate');
      return wx === 'none' ? null : wx;
    }
    static absTicks(env) { return (env.day || 0) * DAY + (env.ticks || 0); }
    // the slot holding absolute tick T: { k window, j slot in it, start, end, u }
    static slotAt(seed, T) {
      const s = seed >>> 0;
      const phase = M.hash2(s, 0x51, 0x7a3) % DAY;
      const k = Math.floor((T - phase) / DAY);
      const w1 = (k + 1) * DAY + phase;
      let st = k * DAY + phase, j = 0;
      for (;;) {
        let end = st + MIN + Math.floor(M.hashf2(k, j, s ^ 0x5eed) * (MAXL - MIN + 1));
        if (end >= w1 || w1 - end < MIN) end = w1;   // the last slot runs to the window's end (a short remainder joins it)
        if (T < end) return { k, j, start: st, end, u: M.hashf2(k * 64 + j, 0x77, s ^ 0xa1) };
        st = end; j++;
      }
    }
    static kindFor(u, climate) {
      const w = WEIGHTS[climate]; if (!w) return 'clear';
      let acc = 0, last = 'clear';
      for (let i = 0; i < KINDS.length; i++) { if (!w[i]) continue; acc += w[i] / 100; last = KINDS[i]; if (u < acc) return last; }
      return last;
    }
    kindAt(T, climate) {
      if (climate === null || T < DAY) return 'clear';   // a new world starts fair: the whole first day
      return Weather.kindFor(Weather.slotAt(this.seed, T).u, climate);
    }
  }
  Weather.KINDS = KINDS;
  Weather.WEIGHTS = WEIGHTS;
  VR.Weather = Weather;
})(VR);

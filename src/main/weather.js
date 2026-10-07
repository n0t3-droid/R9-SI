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
  // what each kind does to the sky (the sample Env reads); clear = today's sky (cloud cover 0.2, full sun)
  const TARGET = {
    clear: { rain: 0, snow: 0, cloud: 0.2, overcast: 0, sunMul: 1, expMul: 1, fog: 0, wind: 1, storm: 0 },
    cloudy: { rain: 0, snow: 0, cloud: 0.8, overcast: 0.55, sunMul: 0.6, expMul: 1, fog: 0, wind: 1.4, storm: 0 },
    fog: { rain: 0, snow: 0, cloud: 0.5, overcast: 0.4, sunMul: 0.75, expMul: 1, fog: 1, wind: 0.6, storm: 0 },
    rain: { rain: 1, snow: 0, cloud: 0.85, overcast: 0.85, sunMul: 0.3, expMul: 1, fog: 0, wind: 2, storm: 0 },
    storm: { rain: 1, snow: 0, cloud: 1, overcast: 1, sunMul: 0.2, expMul: 0.7, fog: 0, wind: 3, storm: 1 },
    snow: { rain: 0, snow: 1, cloud: 0.85, overcast: 0.75, sunMul: 0.45, expMul: 1, fog: 0.3, wind: 1.5, storm: 0 },
  };
  // seconds to get ~63 % of the way to a new kind's value: the sky turns in half a minute, the ground dries in minutes
  const TAU = { rain: 12, snow: 12, cloud: 20, overcast: 20, sunMul: 20, expMul: 15, fog: 25, wind: 10, storm: 8 };
  const FOG_TOP = 63 + 9;   // the valley fog's top (sea level + 9)
  const sstep = (a, b, x) => M.smoothstep(a, b, x);

  class Weather {
    constructor(seed) {
      this.seed = seed >>> 0;
      this.mode = 'normal';          // 'normal' · 'calm' (Ruhig: clear or cloudy) · 'off' (always clear)
      this.forced = null;            // /wetter: { kind, until (absolute ticks) }
      this.rand = Math.random;
      this.cur = Object.assign({ wet: 0, wdx: 1, wdz: 0 }, TARGET.clear);
      this.tg = null; this.strike = null; this.strikeT = 0; this.inStorm = false; this.slot = null;
      this.snowing = false;
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
    slotFor(T) { const s = this.slot; return s && T >= s.start && T < s.end ? s : (this.slot = Weather.slotAt(this.seed, T)); }
    kindAt(T, climate) {
      if (this.mode === 'off') return 'clear';
      const f = this.forced;
      let k;
      if (f && T < f.until) k = f.kind;
      else if (climate === null || T < DAY) k = 'clear';   // a new world starts fair: the whole first day
      else k = Weather.kindFor(this.slotFor(T).u, climate);
      if (this.mode === 'calm' && k !== 'clear' && k !== 'cloudy') k = 'cloudy';
      return k;
    }
    // /wetter <kind> (null or 'auto': back to the schedule); lasts dur ticks, then the schedule takes over again
    force(kind, T, dur) {
      if (kind === null || kind === undefined || kind === 'auto') { this.forced = null; return true; }
      if (KINDS.indexOf(kind) < 0) return false;
      this.forced = { kind, until: T + (dur || 12000) };
      return true;
    }
    // ctx: { T absolute ticks, biome, y (eye), tod, sunUp 0..1, nearWater, freeze (Zen lock) } → the smoothed sample
    update(dt, ctx) {
      const T = ctx.T, cl = Weather.climate(ctx.biome), c = this.cur;
      const kind = ctx.freeze ? 'clear' : this.kindAt(T, cl);
      const tg = Object.assign({}, TARGET[kind]);
      // what falls is snow where it is cold: a cold climate, a cold biome or high up (the old rule of game.js)
      const b = ctx.biome, y = ctx.y === undefined ? 64 : ctx.y;
      const cold = cl === 'cold' || !!(b && (b.temp - Math.max(0, y - 90) * 0.0025) < 0.15);
      if (cold && tg.rain > 0) { tg.snow = Math.max(tg.snow, tg.rain); tg.rain = 0; }
      this.tg = tg;
      const k = (tau) => 1 - Math.exp(-dt / tau);
      for (const key in TAU) { c[key] += (tg[key] - c[key]) * k(TAU[key]); if (Math.abs(c[key] - tg[key]) < 1e-3) c[key] = tg[key]; }
      // the ground gets wet in about two minutes of rain and dries in a few minutes after it
      c.wet += ((c.rain > 0.2 && this.mode !== 'off' ? 1 : 0) - c.wet) * k(c.rain > 0.2 ? 40 : 100);
      if (c.wet < 1e-3) c.wet = 0;
      // wind blows from one direction per slot
      const slot = T >= DAY ? this.slotFor(T) : null, wa = slot ? M.hashf2(slot.k * 64 + slot.j, 0x99, this.seed) * Math.PI * 2 : 0.6;
      c.wdx += (Math.cos(wa) - c.wdx) * k(20); c.wdz += (Math.sin(wa) - c.wdz) * k(20);
      const wl = Math.hypot(c.wdx, c.wdz) || 1;
      // fog: thick at dawn (22000–2500 ticks) in the valleys and over water, thinning by mid-morning; a layer lies below
      const tod = ctx.tod === undefined ? 6000 : ctx.tod;
      const dawn = tod >= 21000 ? sstep(21000, 22000, tod) : tod <= 4000 ? 1 - sstep(2500, 4000, tod) : 0;
      const low = Math.max(1 - sstep(FOG_TOP + 4, FOG_TOP + 16, y), ctx.nearWater ? 1 : 0);
      const dv = dawn * low;
      const fogMul = 1 + c.fog * (0.6 + 1.4 * dv);
      const fogEnd = c.fog > 0.01 ? Math.round(48 + (220 - 48) * (1 - dv)) : 0;
      // the rainbow: the sun out, the ground wet, the rain gone
      const sun = ctx.sunUp === undefined ? 1 : ctx.sunUp;
      const rainbow = this.mode === 'off' ? 0 : 0.35 * sun * sstep(0.3, 0.6, c.wet) * (1 - sstep(0.05, 0.2, c.rain)) * (1 - c.overcast);
      // lightning: a strike every 8–25 s while the storm is up; thunder by the speed of sound (0.5–4 s)
      if (c.storm > 0.6 && this.mode !== 'off') {
        if (!this.inStorm) { this.inStorm = true; this.strikeT = 3 + this.rand() * 5; }
        this.strikeT -= dt;
        if (this.strikeT <= 0) {
          this.strikeT = 8 + this.rand() * 17;
          const dist = 172 + this.rand() * 1200, a = this.rand() * Math.PI * 2;
          this.strike = { dir: [Math.cos(a), Math.sin(a)], dist, delay: dist / 343, flash: M.clamp(1.2 - dist / 1400, 0.25, 1), gain: M.clamp(1.1 - dist / 1500, 0.15, 1) };
        }
      } else this.inStorm = false;
      this.snowing = c.snow > 0.5;
      const f = this.forced;
      return {
        kind, climate: cl, rain: c.rain, snow: c.snow, cloud: c.cloud, overcast: c.overcast, sunMul: c.sunMul, expMul: c.expMul,
        fog: c.fog, fogMul, fogEnd, fogLayer: [FOG_TOP, c.fog * (0.012 + 0.04 * dawn)], wind: c.wind, windDir: [c.wdx / wl, c.wdz / wl],
        wet: c.wet, rainbow, storm: c.storm, next: f && T < f.until ? f.until - T : slot ? slot.end - T : DAY - T,
      };
    }
    // jump to the current kind at once (joining a world, screenshots)
    snap() { if (this.tg) for (const key in TAU) this.cur[key] = this.tg[key]; }
    takeStrike() { const s = this.strike; this.strike = null; return s; }
    toNet() { const f = this.forced; return f ? { wx: f.kind, ws: Math.round(f.until) } : { wx: '', ws: 0 }; }
    fromNet(o) {
      if (!o || o.wx === undefined) return;   // an older host says nothing about the weather
      if (o.wx && KINDS.indexOf(o.wx) >= 0 && +o.ws > 0) this.forced = { kind: o.wx, until: +o.ws };
      else this.forced = null;
    }
  }
  Weather.KINDS = KINDS;
  Weather.WEIGHTS = WEIGHTS;
  Weather.TARGET = TARGET;
  // the sample of a clear sky — what Env gets when no weather runs (the title, „Aus"): exactly today's sky
  Weather.CLEAR = Object.freeze({ kind: 'clear', climate: 'temperate', rain: 0, snow: 0, cloud: 0.2, overcast: 0, sunMul: 1, expMul: 1, fog: 0, fogMul: 1, fogEnd: 0, fogLayer: [FOG_TOP, 0], wind: 1, windDir: [1, 0], wet: 0, rainbow: 0, storm: 0, next: 0 });
  VR.Weather = Weather;
})(VR);

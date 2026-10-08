// ============================================================================
// Weather (A1 Atmosphäre): klar · bewölkt · Nebel · Regen · Gewitter · Schnee. The schedule is a pure function of the
// world seed, the day and the climate, so the host and every guest agree without talking. The visuals ease toward
// the state (about 20 s); bolts come every 8–25 s in a storm and the thunder follows 0.5–4 s later.
// ============================================================================
(function (VR) {
  'use strict';
  const DAY = 24000;                                       // ticks; 20 ticks a second, so a day is 20 minutes
  const KINDS = ['klar', 'bewoelkt', 'nebel', 'regen', 'gewitter', 'schnee'];
  // what each state looks like: the targets the visuals ease toward. rain/snow: precipitation · fog: haze (Nebel is
  // ×3 density and nearer, see env.js) · cloud: cover · sun: sunlight · dark: sky darkening · exp: exposure in stops ·
  // wind: plant sway and the wind sound
  const VIS = {
    klar:     { rain: 0, snow: 0, fog: 0,   cloud: 0.2,  sun: 1,    dark: 0,    exp: 0,     wind: 1 },
    bewoelkt: { rain: 0, snow: 0, fog: 0,   cloud: 0.8,  sun: 0.6,  dark: 0.12, exp: -0.05, wind: 1.1 },
    nebel:    { rain: 0, snow: 0, fog: 1,   cloud: 0.35, sun: 0.7,  dark: 0.1,  exp: 0,     wind: 0.7 },
    regen:    { rain: 1, snow: 0, fog: 0.2, cloud: 0.85, sun: 0.7,  dark: 0.3,  exp: -0.1,  wind: 2.6 },
    gewitter: { rain: 1, snow: 0, fog: 0.3, cloud: 1,    sun: 0.5,  dark: 0.5,  exp: -0.3,  wind: 3 },
    schnee:   { rain: 0, snow: 1, fog: 0.2, cloud: 0.7,  sun: 0.85, dark: 0.15, exp: 0,     wind: 1.2 },
  };
  const CODE = { none: 0, dry: 1, temperate: 2, wet: 3, cold: 4 };
  // the sky of each climate, drawn per slot. Nebel is not in here: it comes with the dawn (see kindAt)
  const WEIGHTS = {
    dry:       { klar: 85, bewoelkt: 15 },
    temperate: { klar: 45, bewoelkt: 25, regen: 15, gewitter: 5 },
    wet:       { klar: 30, bewoelkt: 25, regen: 25, gewitter: 10 },
    cold:      { klar: 35, bewoelkt: 25, schnee: 40 },
    none:      { klar: 1 },
  };
  const FAIR = { klar: 60, bewoelkt: 40 };                 // the first day: no rain, no snow, no storm, no fog
  // the chance that a morning brings Nebel, by climate (the dawn window 22 000–3 000 ticks, on clear or cloudy skies)
  const FOG_DAY = { none: 0, dry: 0.08, temperate: 0.3, wet: 0.35, cold: 0.2 };
  const TAU = 6;                                           // seconds: the visuals reach ~95 % of a new state in ~18 s

  const mix32 = (h) => { h = Math.imul(h ^ (h >>> 16), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); return (h ^ (h >>> 16)) >>> 0; };
  // a number in [0, 1) from the seed and three small integers: the same on every machine
  function hash01(seed, a, b, c) {
    let h = mix32((seed ^ 0x2545f491) >>> 0);
    h = mix32((h ^ Math.imul((a | 0) + 0x9e37, 0x27d4eb2d)) >>> 0);
    h = mix32((h ^ Math.imul((b | 0) + 0x85eb, 0x165667b1)) >>> 0);
    h = mix32((h ^ Math.imul((c | 0) + 0xc2b2, 0x9e3779b1)) >>> 0);
    return h / 4294967296;
  }
  // a small seeded generator (mulberry32) for the bolts: a storm looks the same on every visit to the same world
  function makeRng(seed) {
    let s = (seed ^ 0x6d2b79f5) >>> 0;
    return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // ---- climate: from the biome (src/shared/biomes.js); caves, the Underforge and the Hollow have no sky
  function climateOf(b, dim) {
    if (dim === 'underforge' || dim === 'hollow') return 'none';
    if (!b) return 'temperate';
    if (b.cave || b.forge || b.hollow) return 'none';
    if (b.precip === 'snow' || b.temp < 0.15) return 'cold';
    if (b.precip === 'none' || b.down <= 0) return 'dry';
    return b.down >= 0.75 ? 'wet' : 'temperate';
  }

  // ---- the slots: 5–20 real minutes each (6 000–23 999 ticks), laid out from tick 0 of day 0 by the seed alone
  const slotCache = new Map();
  const slotLen = (seed, k) => 6000 + Math.floor(hash01(seed, k, 0x51, 0) * 18000);
  function slotAt(seed, A) {
    let c = slotCache.get(seed);
    if (!c) { if (slotCache.size > 8) slotCache.clear(); c = { starts: [0] }; slotCache.set(seed, c); }
    const st = c.starts;
    if (A < 0) A = 0;
    while (st[st.length - 1] <= A) st.push(st[st.length - 1] + slotLen(seed, st.length - 1));
    let lo = 0, hi = st.length - 2;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (st[m] <= A) lo = m; else hi = m - 1; }
    return { k: lo, start: st[lo], end: st[lo + 1] };
  }
  // the kind a slot brings in a climate: drawn from the seed, the slot, the day it starts and the climate
  function slotKind(seed, s, climate) {
    const day = Math.floor(s.start / DAY);
    const W = day === 0 ? FAIR : (WEIGHTS[climate] || WEIGHTS.temperate);
    let sum = 0; for (const k in W) sum += W[k];
    let u = hash01(seed, s.k, day, CODE[climate] || 0) * sum;
    for (const k in W) { u -= W[k]; if (u < 0) return k; }
    return 'klar';
  }
  // does this sunrise bring Nebel? (the first two mornings are fair)
  function fogDay(seed, sunrise, climate) {
    return sunrise >= 2 && hash01(seed, sunrise, 0x7f, CODE[climate] || 0) < (FOG_DAY[climate] || 0);
  }
  // the scheduled kind at an absolute tick A (day × 24 000 + time of day), for a climate and a mode:
  // 'normal' · 'calm' (Ruhig: clear and cloudy only) · 'off' (Aus: always clear)
  function kindAt(seed, A, climate, mode) {
    if (seed == null || !climate || climate === 'none' || mode === 'off') return 'klar';
    let k = slotKind(seed, slotAt(seed, A), climate);
    if (mode === 'calm' && k !== 'klar' && k !== 'bewoelkt') k = 'bewoelkt';
    const tod = ((A % DAY) + DAY) % DAY;
    if (mode !== 'calm' && (k === 'klar' || k === 'bewoelkt') && (tod >= 22000 || tod < 3000) && fogDay(seed, Math.round(A / DAY), climate)) k = 'nebel';
    return k;
  }

  // ---- the words of /wetter (German and English; /weather keeps its old words)
  const WORDS = {
    klar: 'klar', clear: 'klar', sonnig: 'klar', sonne: 'klar', sun: 'klar', sunny: 'klar',
    'bewölkt': 'bewoelkt', bewolkt: 'bewoelkt', bewoelkt: 'bewoelkt', wolkig: 'bewoelkt', cloudy: 'bewoelkt', clouds: 'bewoelkt',
    nebel: 'nebel', fog: 'nebel', mist: 'nebel',
    regen: 'regen', rain: 'regen', rainy: 'regen',
    gewitter: 'gewitter', storm: 'gewitter', thunder: 'gewitter', thunderstorm: 'gewitter',
    schnee: 'schnee', snow: 'schnee',
    auto: 'auto', normal: 'auto', zeit: 'auto', plan: 'auto', schedule: 'auto',
  };
  // an English or German word (any case, NFC): an own key only, so "constructor" or "toString" are refused
  function parse(word) { const w = String(word || '').trim().normalize('NFC').toLowerCase(); return Object.prototype.hasOwnProperty.call(WORDS, w) ? WORDS[w] : null; }
  // the names of the states: the tables hold them (g.wx.*); the German and English texts are written here too
  const LABEL = {
    klar: ['g.wx.klar', 'klar', 'clear'], bewoelkt: ['g.wx.bewoelkt', 'bewölkt', 'cloudy'], nebel: ['g.wx.nebel', 'Nebel', 'fog'],
    regen: ['g.wx.regen', 'Regen', 'rain'], gewitter: ['g.wx.gewitter', 'Gewitter', 'thunderstorm'], schnee: ['g.wx.schnee', 'Schnee', 'snow'],
  };
  function label(kind) {
    const L = LABEL[kind]; if (!L) return String(kind);
    return VR.I18N && VR.I18N.tx ? VR.I18N.tx(L[0], null, L[1], L[2]) : L[1];
  }
  // the flash of a bolt: a sharp first stroke and a second, weaker flicker a tenth of a second later
  function flashAt(t) {
    if (t < 0) return 0;
    let f = Math.exp(-3.2 * t);
    if (t > 0.1 && t < 0.6) f += 0.45 * Math.exp(-8 * (t - 0.1));
    return Math.min(1, f);
  }
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  // the wind's direction in radians (F3 · Da-Sein): the seed picks the base, and over the world's day it turns slowly
  // (under a tenth of a turn in an hour of game time) — the same wind for every visitor of the same world
  function windAngle(seed, A) {
    const s = seed == null ? 0 : seed;
    const base = hash01(s, 0x3d, 0, 0) * Math.PI * 2;
    return base + 0.5 * Math.sin(A / DAY * Math.PI * 2 + hash01(s, 0x3e, 0, 0) * Math.PI * 2) + 0.25 * Math.sin(A / DAY * 3 * Math.PI * 2);   // (three turns a day: periodic over the day, so the heading never jumps at midnight)
  }
  // gusts: every 10 s of the session's clock a seeded slot may hold one gust (60 % of them); it starts within the first
  // 6 s of its slot, swells over 3 s (sin² envelope, 0 → 1 → 0) and is gone before the next slot begins
  function gustAt(seed, clock) {
    const s = seed == null ? 0 : seed, k = Math.floor(clock / 10);
    if (!(clock >= 0) || hash01(s, k, 0x6a, 0) >= 0.6) return 0;
    const d = clock - (k * 10 + hash01(s, k, 0x6b, 0) * 6);
    return d > 0 && d < 3 ? Math.pow(Math.sin(Math.PI * d / 3), 2) : 0;
  }
  const windDirVec = (a) => [Math.cos(a), Math.sin(a)];

  class Weather {
    // o.onThunder(delay): called delay seconds after each bolt (the sound follows the light)
    constructor(o) {
      this.onThunder = (o && o.onThunder) || null;
      this.seed = null; this.mode = 'normal';
      this.forced = null;          // a state the player or the host asked for (/wetter, multiplayer); null = the schedule
      this.oneShot = false; this.oneShotSlot = null; this.frozen = null;
      this.kind = 'klar'; this.slot = -1; this.slotEnd = 0; this.clock = 0; this.ticks = 0;
      this.inStorm = false; this.bolt = 0; this.strikes = 0; this.sinceStrike = 1e9; this.flash = 0; this.thunders = [];
      this.rng = makeRng(0);
      this.v = { rain: 0, snow: 0, fog: 0, cloud: VIS.klar.cloud, sun: 1, dark: 0, exp: 0, wind: 1 };
      this.windAngle = 0; this.windDir = [1, 0];     // the heading of the wind (radians, unit vector): the water's swell runs with it
      this.windAng = 0; this.gust = 0;   // the wind's direction (radians) and the gust now (0..1): plant sway (env.js)
    }
    // the world's seed (null: no world, e.g. the title screen): new seed, no forced state, no bolts pending
    setSeed(seed) {
      this.seed = seed == null ? null : (seed >>> 0);
      this.forced = null; this.oneShot = false; this.oneShotSlot = null; this.frozen = null;
      this.rng = makeRng(this.seed == null ? 0 : this.seed);
      this.inStorm = false; this.bolt = 0; this.thunders = []; this.sinceStrike = 1e9;
    }
    setMode(m) { this.mode = m === 'calm' || m === 'off' ? m : 'normal'; }
    force(kind) { this.forced = KINDS.includes(kind) ? kind : null; }
    // the switch wins over a command: Aus is always clear, Ruhig is at most cloudy
    clamp(kind) { return this.mode === 'off' ? 'klar' : this.mode === 'calm' && kind !== 'klar' && kind !== 'bewoelkt' ? 'bewoelkt' : kind; }
    // "klar bis zum nächsten Wetter": the sky clears now and stays so until the next slot starts
    clearNow() { this.oneShot = true; this.oneShotSlot = this.slot >= 0 ? this.slot : null; }
    // c: {ticks, day, biome, dim, lowK (0..1: in a valley or near water), freeze}
    update(dt, c) {
      dt = Math.min(Math.max(+dt || 0, 0), 1);             // a stalled frame must not jump the weather
      this.clock += dt;
      const day = c.day | 0, ticks = c.ticks || 0;
      const A = day * DAY + (((ticks % DAY) + DAY) % DAY);
      this.ticks = A;
      const climate = climateOf(c.biome, c.dim);
      let slotK = -1, sEnd = 0;
      if (this.seed != null) { const s = slotAt(this.seed, A); slotK = s.k; sEnd = s.end; }
      this.slot = slotK; this.slotEnd = sEnd;
      if (this.oneShot) { if (this.oneShotSlot === null) this.oneShotSlot = slotK; if (slotK !== this.oneShotSlot) this.oneShot = false; }
      let kind;
      if (this.forced) kind = this.clamp(this.forced);
      else if (c.freeze) { if (this.frozen === null) this.frozen = this.kind; kind = this.frozen; }
      else { this.frozen = null; kind = this.oneShot ? 'klar' : kindAt(this.seed, A, climate, this.mode); }
      this.kind = kind;
      // the visuals ease toward the state; Nebel lies thicker in valleys and near water
      const V = VIS[kind] || VIS.klar;
      const loc = this.forced ? 1 : 0.55 + 0.45 * clamp01(+c.lowK || 0);
      const T = { rain: V.rain, snow: V.snow, fog: kind === 'nebel' ? loc : V.fog, cloud: V.cloud, sun: V.sun, dark: V.dark, exp: V.exp, wind: V.wind };
      const a = 1 - Math.exp(-dt / TAU);
      for (const k in T) this.v[k] += (T[k] - this.v[k]) * a;
      // the wind: its direction turns slowly over the world's day, and gusts come and go (F3 · Da-Sein)
      this.windAng = this.windAngle = windAngle(this.seed, A); this.windDir = windDirVec(this.windAngle); this.gust = gustAt(this.seed, this.clock);
      // lightning: in a storm a bolt every 8–25 s; the thunder comes 0.5–4 s later
      this.sinceStrike += dt;
      if (kind === 'gewitter') {
        if (!this.inStorm) { this.inStorm = true; this.bolt = 3 + this.rng() * 5; }
        this.bolt -= dt;
        if (this.bolt <= 0) { this.strike(); this.bolt = 8 + this.rng() * 17; }
      } else this.inStorm = false;
      this.flash = flashAt(this.sinceStrike);
      if (this.thunders.length) {
        const due = this.thunders.filter(e => this.clock >= e.at);
        if (due.length) {
          this.thunders = this.thunders.filter(e => this.clock < e.at);
          if (this.onThunder) for (const e of due) this.onThunder(e.delay);
        }
      }
      return this;
    }
    strike() {
      this.strikes++; this.sinceStrike = 0;
      const delay = 0.5 + this.rng() * 3.5;
      this.thunders.push({ at: this.clock + delay, delay });
    }
    info() { return label(this.kind) + (this.forced ? (VR.I18N && VR.I18N.tx ? VR.I18N.tx('g.wx.cmd', null, ' (Befehl)', ' (command)') : ' (Befehl)') : ''); }
  }

  VR.WX = { KINDS, VIS, WEIGHTS, FOG_DAY, DAY, climateOf, slotAt, slotLen, kindAt, fogDay, hash01, parse, label, flashAt, windAngle, gustAt, windDirVec };
  VR.Weather = Weather;
})(VR);

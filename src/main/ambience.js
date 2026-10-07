// ============================================================================
// Ambience (A1 Atmosphäre): the sound of the place and the weather — wind, rain and thunder, birds by day among the
// trees, crickets at night in warm places, water near water. All of it is synthesized when the audio starts (no audio
// files). The layers ride one bus; indoors (sky light under 4) and under water the bus is muffled: lowpass 800 Hz and
// −9 dB. Ten layer nodes and the bus make twelve persistent Web Audio nodes; a thunder adds three for a few seconds.
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R, F = VR.F;
  const RATE = 22050;                  // the loops are synthesized at this rate; the audio graph resamples them
  const EVERY = 0.5;                   // seconds between samples of the place (the world is read about twice a second)
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

  // ---- synthesis: plain sample arrays, seeded, so every visit sounds the same
  function rng(seed) { let s = (seed ^ 0x6d2b79f5) >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const white = (n, r) => { const x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = r() * 2 - 1; return x; };
  // one-pole filters, in place: lowpass and highpass at a cutoff in Hz
  function lowpass(x, fc) { const a = 1 - Math.exp(-2 * Math.PI * fc / RATE); let y = 0; for (let i = 0; i < x.length; i++) { y += a * (x[i] - y); x[i] = y; } return x; }
  function highpass(x, fc) { const lo = lowpass(x.slice(), fc); for (let i = 0; i < x.length; i++) x[i] -= lo[i]; return x; }
  function normalize(x, peak) { let m = 0; for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i])); if (m > 0) for (let i = 0; i < x.length; i++) x[i] *= peak / m; return x; }

  // wind: a band of air from 90 to 900 Hz, swelling in gusts that close exactly on the loop
  function genWind(r) {
    const n = RATE * 4, x = highpass(lowpass(white(n, r), 900), 90);
    for (let i = 0; i < n; i++) { const p = i / n; x[i] *= 0.55 + 0.25 * Math.sin(2 * Math.PI * p) + 0.2 * Math.sin(2 * Math.PI * 3 * p + 1.3); }
    return normalize(x, 0.9);
  }
  // rain: hissing noise above 1.5 kHz with drops (short clicks, a few hundred a second)
  function genRain(r) {
    const n = RATE * 3, x = highpass(white(n, r), 1500);
    const rate = 300 / RATE;
    for (let i = 0; i < n; i++) if (r() < rate) { const a = 0.3 + 0.5 * r(); for (let k = 0; k < 40 && i + k < n; k++) x[i + k] += a * Math.exp(-k / 6) * (r() * 2 - 1) * 0.6; }
    return normalize(x, 0.8);
  }
  // water: a band from 300 to 900 Hz, with slow swells
  function genWater(r) {
    const n = RATE * 4, x = highpass(lowpass(white(n, r), 900), 300);
    for (let i = 0; i < n; i++) { const p = i / n; x[i] *= 0.6 + 0.25 * Math.sin(2 * Math.PI * 2 * p) + 0.15 * Math.sin(2 * Math.PI * 5 * p + 0.7); }
    return normalize(x, 0.8);
  }
  // birds: FM chirps and short notes, each panned to its own place in the stereo field (two channels, one loop)
  function genBirds(r) {
    const T = 8, n = RATE * T, L = new Float32Array(n), Rc = new Float32Array(n);
    for (let v = 0; v < 14; v++) {
      const t0 = r() * (T - 0.6), notes = 1 + Math.floor(r() * 4), pan = r();
      const f0 = 2100 + r() * 2200, glide = (r() < 0.5 ? -1 : 1) * (300 + r() * 1100), len = 0.07 + r() * 0.12, amp = 0.12 + r() * 0.12, vib = 30 + r() * 40;
      for (let k = 0; k < notes; k++) {
        const s0 = Math.floor((t0 + k * (len + 0.04 + r() * 0.06)) * RATE), sl = Math.floor(len * RATE);
        let ph = 0;
        for (let i = 0; i < sl; i++) {
          const p = i / sl, f = f0 + glide * p + 80 * Math.sin(2 * Math.PI * vib * i / RATE);
          ph += 2 * Math.PI * f / RATE;
          const env = Math.min(1, p * 40) * Math.pow(1 - p, 1.5), s = Math.sin(ph) * env * amp, j = (s0 + i) % n;
          L[j] += s * (1 - pan); Rc[j] += s * pan;
        }
      }
    }
    let m = 0; for (let i = 0; i < n; i++) m = Math.max(m, Math.abs(L[i]), Math.abs(Rc[i]));
    if (m > 0) for (let i = 0; i < n; i++) { L[i] *= 0.8 / m; Rc[i] *= 0.8 / m; }
    return [L, Rc];
  }
  // crickets: four bursts of pulses (35 Hz) ringing a 4.2 kHz carrier, a little different each time, in a 3 s loop
  function genCrickets(r) {
    const T = 3, n = RATE * T, x = new Float32Array(n);
    for (let b = 0; b < 4; b++) {
      const t0 = b * 0.72 + r() * 0.06, dur = 0.42 + r() * 0.12;
      for (let i = Math.floor(t0 * RATE); i < Math.floor((t0 + dur) * RATE) && i < n; i++) {
        const t = i / RATE - t0, ph = (t * 35) % 1;
        const env = ph < 0.35 ? Math.sin(Math.PI * ph / 0.35) : 0;
        x[i] += env * Math.sin(2 * Math.PI * 4200 * t) * 0.6;
      }
    }
    return normalize(x, 0.7);
  }

  // the leaves of the registry (for "near trees"), built once: one flag per block state
  let LEAF = null;
  const isLeaf = (s) => { if (!LEAF) { LEAF = new Uint8Array(R.stateCount); for (let k = 0; k < R.stateCount; k++) { const t = R.types[R.T.type[k]]; LEAF[k] = t && /leaves|leaf/.test(t.name) ? 1 : 0; } } return LEAF[s] === 1; };

  class Ambience {
    constructor(audio) {
      this.audio = audio; this.ctx = null; this.L = null;
      this.opt = { nature: true, weather: true };          // Natur-Klänge (birds, crickets, water, wind) · Wetter (rain, thunder)
      this.timer = 0; this.S = { lowK: 0, water: 0, trees: 0, valley: 0, indoors: false };
      this.thunders = 0;
    }
    get lowK() { return this.S.lowK; }
    setOptions(o) { if (o) Object.assign(this.opt, o); }
    // builds the synthesized loops and the graph once for an audio context
    init(ctx) {
      if (this.ctx === ctx || !ctx || !this.audio || !this.audio.amb) return;
      this.ctx = ctx;
      const mkBuf = (chans) => { const b = ctx.createBuffer(chans.length, chans[0].length, RATE); chans.forEach((d, c) => b.getChannelData(c).set(d)); return b; };
      const r = rng(0x5eed1);
      this.noise = mkBuf([normalize(white(RATE * 2, r), 1)]);
      // the bus: everything outside goes through the muffle (indoors, under water) and into the ambient volume
      this.muffle = ctx.createBiquadFilter(); this.muffle.type = 'lowpass'; this.muffle.frequency.value = 20000; this.muffle.Q.value = 0.5;
      this.busGain = ctx.createGain(); this.busGain.gain.value = 1;
      this.muffle.connect(this.busGain); this.busGain.connect(this.audio.amb);
      const birds = genBirds(r);
      const bufs = { wind: mkBuf([genWind(r)]), rain: mkBuf([genRain(r)]), water: mkBuf([genWater(r)]), birds: mkBuf(birds), crickets: mkBuf([genCrickets(r)]) };
      this.L = {};
      for (const k of Object.keys(bufs)) {
        const src = ctx.createBufferSource(); src.buffer = bufs[k]; src.loop = true;
        const g = ctx.createGain(); g.gain.value = 0;
        src.connect(g); g.connect(this.muffle); src.start(0);
        this.L[k] = { src, g };
      }
    }
    // o: {w (world), eye [x,y,z], E (the environment), biome, speed, underwater}. Samples the place twice a second.
    update(dt, o) {
      const a = this.audio;
      if (!a || !a.ctx || !o) return;
      if (!this.ctx) this.init(a.ctx);
      if (!this.L) return;
      this.timer -= dt;
      if (this.timer > 0) return;
      this.timer = EVERY;
      if (this.opt.nature || this.opt.weather) this.sample(o);   // both switches off: nothing to read, the gains just fall silent
      this.mix(o);
    }
    sample(o) {
      const w = o.w, e = o.eye, S = this.S;
      if (!w || !e) return;
      const x = Math.floor(e[0]), y = Math.floor(e[1]), z = Math.floor(e[2]);
      S.indoors = (w.getLight(x, y, z) >>> 12) < 4 || !!o.underwater;
      // water and leaves in a 25 × 25 block square (a grid every 4 blocks around the ear)
      let water = 0, trees = 0;
      for (let dz = -12; dz <= 12; dz += 4) for (let dx = -12; dx <= 12; dx += 4) {
        const X = x + dx, Z = z + dz;
        for (let yy = y - 3; yy <= y + 1; yy++) { const st = w.getBlock(X, yy, Z); if (st && (R.T.flags[st] & F.WATER)) { water++; break; } }
        for (let yy = y - 1; yy <= y + 5; yy += 2) { const st = w.getBlock(X, yy, Z); if (st && isLeaf(st)) { trees++; break; } }
      }
      // the lay of the land: lower than the ground around (8 points 20 blocks out) is a valley
      const top = w.topAt(x, z), ring = [[20, 0], [-20, 0], [0, 20], [0, -20], [14, 14], [-14, 14], [14, -14], [-14, -14]];
      let sum = 0; for (const [dx, dz] of ring) sum += w.topAt(x + dx, z + dz);
      S.water = water; S.trees = trees;
      S.valley = clamp01((sum / ring.length - top) / 10);
      S.lowK = Math.max(S.valley, water > 0 ? 1 : 0);   // Nebel lies in valleys and near water (weather.js)
    }
    mix(o) {
      const c = this.ctx, t = c.currentTime, S = this.S, E = o.E || {}, L = this.L, opt = this.opt, b = o.biome || {};
      const rain = clamp01(E.rain || 0), snow = clamp01(E.snow || 0), night = clamp01(E.night || 0), day = 1 - night;
      const windK = clamp01(((E.wind || 1) - 0.6) / 2.4);             // 0 in clear weather, 1 in a storm
      const high = clamp01(((o.eye ? o.eye[1] : 66) - 80) / 140);     // the wind is stronger up high
      const speed = clamp01((o.speed || 0) / 40);                      // and when flying fast
      const dryAir = rain < 0.2 && snow < 0.2;
      const warm = (b.temp === undefined ? 0.6 : b.temp) >= 0.45 && b.precip !== 'snow';
      const nat = opt.nature, wx = opt.weather;
      const g = {
        wind: nat ? (0.06 + 0.16 * windK + 0.12 * high + 0.1 * speed) * (1 - 0.5 * snow) : 0,
        water: nat ? clamp01(S.water / 8) * 0.35 : 0,
        birds: nat && dryAir ? day * clamp01(S.trees / 5) * 0.45 : 0,
        crickets: nat && night > 0.4 && warm && dryAir ? night * clamp01(0.3 + S.trees / 6) * 0.3 : 0,
        rain: wx && !(b.down <= 0) ? rain * 0.5 : 0,                     // no rain sound in a desert
      };
      for (const k in g) L[k].g.gain.setTargetAtTime(g[k], t, 0.4);
      const muffled = S.indoors;
      this.muffle.frequency.setTargetAtTime(muffled ? 800 : 20000, t, 0.3);
      this.busGain.gain.setTargetAtTime(muffled ? 0.355 : 1, t, 0.3);   // −9 dB indoors
    }
    // one line for the F3 overlay: the layer levels and what the place reads as
    info() {
      const S = this.S, g = (k) => (this.L && this.L[k] ? this.L[k].g.gain.value.toFixed(2) : '–');
      return `wind ${g('wind')} rain ${g('rain')} birds ${g('birds')} crickets ${g('crickets')} water ${g('water')} · trees ${S.trees} water ${S.water} valley ${S.valley.toFixed(2)}${S.indoors ? ' · indoors' : ''}`;
    }
    // a bolt's thunder, delay seconds after the flash: far away it is quieter and duller
    thunder(delay) {
      const c = this.ctx;
      if (!c || !this.noise || !this.opt.weather) return;
      const t = c.currentTime, far = (clamp01(((+delay || 2) - 0.5) / 3.5));
      const src = c.createBufferSource(); src.buffer = this.noise;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900 - 600 * far; f.Q.value = 0.7;
      const g = c.createGain(), peak = 1.1 * (1 - 0.65 * far);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + 0.06); g.gain.exponentialRampToValueAtTime(0.001, t + 3.2 + far);
      src.connect(f); f.connect(g); g.connect(this.muffle);
      src.start(t, Math.random() * 1.5, 4.6);
      this.thunders++;
    }
  }
  VR.Ambience = Ambience;
})(VR);

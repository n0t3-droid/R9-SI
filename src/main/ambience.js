// ============================================================================
// Ambience (A1 „Atmosphäre"): the world's soundscape, synthesized — zero bytes of
// recordings. Wind by altitude and weather, rain and thunder, water near the shore,
// the murmur of a village, birds by day, crickets on warm nights. A context is sampled
// every 0.5 s; each layer is a filtered share of one noise loop or one oscillator with
// scheduled automation (chirps, phrases, gusts), all through one low-pass that closes
// to 800 Hz (and −9 dB) indoors. Layers start only while the graph stays within 12
// live nodes (higher priority first) and free their nodes after fading out.
// ============================================================================
(function (VR) {
  'use strict';
  const M = VR.M;
  const MAX = 12, SHARED = 2, PLAN = 0.5, INDOOR = 0.355;   // −9 dB
  const COST = { thunder: 2, rain: 2, wind: 2, water: 2, crickets: 2, birds: 3, town: 2 };
  const PRIORITY = ['thunder', 'rain', 'wind', 'water', 'crickets', 'birds', 'town'];
  const SWITCH = { thunder: 'rain' };                        // „Regen & Donner" is one switch
  const FILT = { wind: ['bandpass', 400, 0.8], rain: ['highpass', 1200, 0.2], water: ['bandpass', 700, 0.9], town: ['bandpass', 450, 0.9], thunder: ['lowpass', 300, 0.7] };
  const hold = (p, t) => { if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t); else { p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); } };

  class Ambience {
    constructor(audio, o) {
      this.audio = audio; this.rand = (o && o.rand) || Math.random;
      this.enabled = true;
      this.on = { wind: true, rain: true, birds: true, crickets: true, water: true, town: true };
      this.L = {}; this.sh = null; this.live = 0;
      this.planT = 0; this.levels = {}; this.muffled = false;
      this.pending = []; this.thunderEnd = 0;
      this.birdNext = 0; this.birdBusy = 0; this.cricketNext = 0;
    }
    alive() { return this.live; }
    setEnabled(on) { this.enabled = !!on; if (!on) this.releaseAll(); }
    setLayers(o) { Object.assign(this.on, o || {}); this.planT = 0; }
    // a lightning strike: the roll starts `delay` seconds from now, louder and sharper when near
    thunder(delay, gain, dist) {
      const ac = this.audio && this.audio.ctx;
      if (!ac || !this.enabled || this.on.rain === false) return false;
      this.pending.push({ at: ac.currentTime + Math.max(0, delay), gain: M.clamp(gain, 0, 1), dist: dist || 600 });
      this.planT = 0;
      return true;
    }
    // what each layer should be now (before the node budget): the context → target gains
    levelsFor(c) {
      const out = c.underwater ? 0 : c.cave ? 0.15 : 1, mu = c.indoors || c.cave ? INDOOR : 1;
      const day = 1 - (c.night || 0), wet = Math.max(c.rain || 0, c.snow || 0), wind = c.wind === undefined ? 1 : c.wind;
      const L = {
        wind: M.clamp(0.03 + Math.max(0, (c.y - 80) / 100) * 0.25 + Math.max(0, wind - 1) * 0.1 + (c.speed || 0) / 40, 0, 0.55),
        rain: (c.rain || 0) * (0.35 + 0.1 * (c.storm || 0)),
        water: (c.water || 0) * 0.22,
        town: (c.village || 0) * (0.05 + 0.09 * day),
        birds: (c.birdK || 0) * M.smoothstep(0.3, 0.8, day) * (1 - M.smoothstep(0.05, 0.2, wet)) * (wind > 2.6 ? 0.3 : 1) * 0.12,
        crickets: M.smoothstep(0.5, 0.9, c.night || 0) * M.smoothstep(0.3, 0.6, c.temp === undefined ? 0.8 : c.temp) * (1 - M.smoothstep(0.02, 0.1, wet)) * ((c.birdK || 0) > 0 ? 1 : 0) * 0.05,
      };
      for (const k in L) L[k] *= out * mu;
      return L;
    }
    update(dt, ctx) {
      const ac = this.audio && this.audio.ctx;
      if (!ac) return;
      if (!this.enabled) { if (this.live) this.releaseAll(); return; }
      this.planT -= dt;
      if (this.planT > 0) return;
      this.planT = PLAN;
      this.plan(ac, typeof ctx === 'function' ? ctx() : ctx);
    }
    plan(ac, c) {
      if (!c) return;
      const now = ac.currentTime, lv = this.levelsFor(c), want = {};
      this.pending = this.pending.filter(p => p.at > now - 2);   // a roll that could not start in time is dropped
      for (const k of PRIORITY) {
        const sw = this.on[SWITCH[k] || k] !== false;
        want[k] = !sw ? 0 : k === 'thunder' ? (this.pending.length || now < this.thunderEnd + 0.3 ? 1 : 0) : lv[k];
        this.levels[k] = want[k];
      }
      // the node budget: the most important layers first; a layer that does not fit waits (or pushes out a lesser one)
      for (const k of PRIORITY) {
        if (want[k] <= 0.002 || this.L[k]) continue;
        const need = COST[k] + (this.sh ? 0 : SHARED);
        if (this.live + need > MAX) this.evict(k, need);
        if (this.live + need <= MAX) this.alloc(ac, k);
      }
      for (const k of Object.keys(this.L)) {
        const L = this.L[k];
        if (want[k] <= 0.002) {
          if (!L.fading) { L.fading = true; hold(L.gain.gain, now); L.gain.gain.setTargetAtTime(0, now, 0.15); }
          L.quiet += PLAN;
          if (L.quiet >= 1.5) this.free(k);
          continue;
        }
        L.quiet = 0; L.fading = false;
        this.drive(ac, k, L, want[k], c, now);
      }
      if (!Object.keys(this.L).length) { if (this.sh) this.freeShared(); }
      else {
        this.muffled = !!(c.indoors || c.cave);
        this.sh.bus.frequency.setTargetAtTime(this.muffled ? 800 : 20000, now, 0.25);
      }
    }
    // ---------------------------------------------------------------- the graph
    mk(L, n) { this.live++; L.nodes.push(n); return n; }
    ensureShared(ac) {
      if (this.sh) return this.sh;
      const noise = ac.createBufferSource(); noise.buffer = this.audio.noise; noise.loop = true;
      const bus = ac.createBiquadFilter(); bus.type = 'lowpass'; bus.frequency.value = 20000; bus.Q.value = 0.5;
      bus.connect(this.audio.amb); noise.start();
      this.live += SHARED;
      return (this.sh = { noise, bus });
    }
    alloc(ac, k) {
      const sh = this.ensureShared(ac), L = { nodes: [], quiet: 0, fading: false, t: 0 };
      if (k === 'birds' || k === 'crickets') {
        const o = this.mk(L, ac.createOscillator()); o.type = 'sine'; o.frequency.value = k === 'birds' ? 3000 : 4200;
        const g = this.mk(L, ac.createGain()); g.gain.value = 0;
        o.connect(g);
        if (k === 'birds' && ac.createStereoPanner) { const p = this.mk(L, ac.createStereoPanner()); g.connect(p); p.connect(sh.bus); L.pan = p; } else g.connect(sh.bus);
        o.start(); L.osc = o; L.gain = g;
        if (k === 'birds') { this.birdNext = 0; this.birdBusy = 0; } else this.cricketNext = 0;
      } else {
        const cfg = FILT[k], f = this.mk(L, ac.createBiquadFilter()); f.type = cfg[0]; f.frequency.value = cfg[1]; f.Q.value = cfg[2];
        const g = this.mk(L, ac.createGain()); g.gain.value = 0;
        sh.noise.connect(f); f.connect(g); g.connect(sh.bus);
        L.filter = f; L.gain = g;
      }
      this.L[k] = L;
    }
    free(k) {
      const L = this.L[k]; if (!L) return;
      if (L.filter && this.sh) { try { this.sh.noise.disconnect(L.filter); } catch (e) { /* already cut */ } }
      for (const n of L.nodes) { if (n.stop) { try { n.stop(); } catch (e) { /* never started */ } } n.disconnect(); this.live--; }
      delete this.L[k];
    }
    freeShared() {
      const sh = this.sh; if (!sh) return;
      try { sh.noise.stop(); } catch (e) { /* */ }
      sh.noise.disconnect(); sh.bus.disconnect(); this.live -= SHARED; this.sh = null;
    }
    evict(k, need) {
      for (let i = PRIORITY.length - 1; i > PRIORITY.indexOf(k) && this.live + need > MAX; i--) if (this.L[PRIORITY[i]]) this.free(PRIORITY[i]);
    }
    releaseAll() { for (const k of Object.keys(this.L)) this.free(k); this.freeShared(); this.pending.length = 0; this.levels = {}; this.muffled = false; }
    // ---------------------------------------------------------------- each layer's movement for the next half second
    ramps(p, L, now, values) {
      let t = Math.max(now, L.t);
      const step = PLAN / values.length;
      for (const v of values) { t += step; p.linearRampToValueAtTime(v, t); }
      L.t = t;
    }
    drive(ac, k, L, level, c, now) {
      const r = this.rand;
      if (k === 'wind') { L.filter.frequency.setTargetAtTime(250 + 450 * r(), now, 0.8); L.gain.gain.setTargetAtTime(level * (0.65 + 0.7 * r()), now, 0.5); }
      else if (k === 'rain') { L.filter.frequency.setTargetAtTime(1100 + 300 * r(), now, 1); L.gain.gain.setTargetAtTime(level, now, 0.8); }
      else if (k === 'water') this.ramps(L.gain.gain, L, now, [0, 1, 2, 3].map(() => level * (0.45 + 0.55 * r())));
      else if (k === 'town') this.ramps(L.gain.gain, L, now, [0, 1, 2, 3, 4].map(() => level * (0.35 + 0.65 * r())));
      else if (k === 'birds') this.birds(L, level, c, now);
      else if (k === 'crickets') this.crickets(L, level, c, now);
      else if (k === 'thunder') this.rolls(L, now);
    }
    // birds: phrases of whistles, trills, „fee-bee" calls, warbles and chirps, each from another spot in the stereo field
    birds(L, level, c, now) {
      if (now < this.birdNext) return;
      const r = this.rand, tod = c.tod === undefined ? 6000 : c.tod;
      const chorus = tod >= 22500 || tod < 2000 ? 0.5 : 1;   // the dawn chorus: twice as busy
      this.birdNext = now + (0.4 + r() * 2.2) * chorus / Math.max(0.3, Math.min(1, c.birdK || 0.3));
      const t0 = Math.max(now + 0.05, this.birdBusy + 0.08);
      if (t0 > now + PLAN + 0.6) return;
      const f = L.osc.frequency, g = L.gain.gain, amp = level * (0.45 + 0.55 * r());
      if (L.pan) L.pan.pan.setValueAtTime((r() * 2 - 1) * 0.8, t0);
      let t = t0;
      const note = (fa, fb, dur, a) => {
        f.setValueAtTime(fa, t); f.exponentialRampToValueAtTime(fb, t + dur);
        g.setValueAtTime(0, t); g.linearRampToValueAtTime(a, t + Math.min(0.012, dur * 0.25)); g.linearRampToValueAtTime(0, t + dur);
        t += dur;
      };
      const gap = (d) => { t += d; };
      switch (Math.floor(r() * 5)) {
        case 0: { const n = 1 + Math.floor(r() * 3), lo = 2200 + r() * 1200; for (let i = 0; i < n; i++) { const up = r() < 0.6; note(up ? lo : lo + 900, up ? lo + 900 : lo, 0.12 + r() * 0.13, amp); gap(0.06 + r() * 0.1); } break; }
        case 1: { const n = 6 + Math.floor(r() * 9), fc = 3500 + r() * 1000; for (let i = 0; i < n; i++) note(fc + (i & 1 ? 300 : -300), fc + (i & 1 ? -200 : 200), 0.045 + r() * 0.015, amp * 0.8); break; }
        case 2: { const hi = 3800 + r() * 300; note(hi, hi - 80, 0.28, amp); gap(0.05); note(hi - 600, hi - 650, 0.3, amp * 0.9); break; }
        case 3: { // warble: frequency modulation as a curve (8–12 Hz vibrato around 3 kHz)
          const n = 48, dur = 0.45 + r() * 0.3, fm = 8 + r() * 4, fc = 2700 + r() * 800, curve = new Float32Array(n);
          for (let i = 0; i < n; i++) curve[i] = fc + Math.sin(i / n * dur * fm * Math.PI * 2) * 420 + (i / n) * 200;
          t += 0.005; f.setValueCurveAtTime(curve, t, dur);
          g.setValueAtTime(0, t); g.linearRampToValueAtTime(amp, t + 0.03); g.linearRampToValueAtTime(amp * 0.8, t + dur - 0.05); g.linearRampToValueAtTime(0, t + dur);
          t += dur + 0.005; break;
        }
        default: { const n = 3 + Math.floor(r() * 3); for (let i = 0; i < n; i++) { note(2500 + r() * 400, 4400 + r() * 500, 0.06, amp); gap(0.05 + r() * 0.08); } }
      }
      this.birdBusy = t;
    }
    // crickets: a 4.2 kHz chirp of three pulses at 35 Hz, repeated faster the warmer the night (Dolbear's law)
    crickets(L, level, c, now) {
      const r = this.rand, f = L.osc.frequency, g = L.gain.gain;
      const period = 0.62 - 0.22 * M.clamp(((c.temp === undefined ? 0.8 : c.temp) - 0.5) / 1.5, 0, 1);
      let t = Math.max(this.cricketNext, now + 0.02);
      while (t < now + PLAN + 0.1) {
        f.setValueAtTime(4100 + r() * 300, t);
        const a = level * (0.6 + 0.4 * r());
        for (let p = 0; p < 3; p++) { const tp = t + p / 35; g.setValueAtTime(0, tp); g.linearRampToValueAtTime(a, tp + 0.003); g.setValueAtTime(a, tp + 0.011); g.linearRampToValueAtTime(0, tp + 0.015); }
        t += period * (0.85 + 0.3 * r());
      }
      this.cricketNext = t;
    }
    // thunder: a crack when near, then a rolling rumble of 3–7 s, low-passed by the distance — scheduled on the audio
    // clock as soon as the flash is seen, so a stalled frame never shifts it
    rolls(L, now) {
      const r = this.rand, due = this.pending.sort((a, b) => a.at - b.at);
      if (!due.length) return;
      this.pending = [];
      for (const p of due) {
        const g = L.gain.gain, f = L.filter.frequency, near = M.clamp(1 - (p.dist - 172) / 1200, 0, 1);
        const t0 = Math.max(p.at, now + 0.02), peak = 0.25 + 0.75 * p.gain, crack = near > 0.6;
        hold(g, t0); hold(f, t0);
        f.setValueAtTime(crack ? 1400 : 500, t0); f.exponentialRampToValueAtTime(90 + 200 * near, t0 + 0.4 + (1 - near) * 0.6);
        g.setValueAtTime(0, t0); g.linearRampToValueAtTime(peak * (crack ? 1 : 0.6), t0 + (crack ? 0.04 : 0.35));
        const t1 = t0 + (crack ? 0.04 : 0.35), len = 3 + 3 * (1 - near) + r() * 1.5;
        for (let i = 1; i <= 12; i++) g.linearRampToValueAtTime(peak * Math.exp(-3 * i / 12) * (0.55 + 0.45 * r()), t1 + len * i / 12);
        g.linearRampToValueAtTime(0, t1 + len + 0.3);
        this.thunderEnd = Math.max(this.thunderEnd, t1 + len + 0.3);
      }
    }
  }
  // ---------------------------------------------------------------- the game side: what is around the listener
  // biome → how many birds (forests sing, open land a little, deserts and peaks hardly)
  Ambience.birdK = function (b) {
    if (!b || b.ocean || b.cave || b.forge || b.hollow) return 0;
    const k = b.key, cold = b.temp < 0.15 ? 0.4 : 1;
    if (/forest|taiga|jungle|grove|cherry|birch|pale_garden|dappled|swamp|mangrove/.test(k)) return cold;
    if (/plains|meadow|savanna|river|beach|windswept|mushroom|shore|drift|prism/.test(k)) return 0.55 * cold;
    return 0.12 * cold;
  };
  // sampled every 0.5 s (a few dozen block lookups): hour, biome, weather, altitude, cave / indoors, water, village
  Ambience.context = function (g, S, o) {
    const p = g.player, w = g.world, E = g.env && g.env.E;
    if (!p || !w) return null;
    const eye = p.eyePos(), x = Math.floor(eye[0]), y = Math.floor(eye[1]), z = Math.floor(eye[2]);
    const b = VR.BIOMES[w.biomeAt(x, z)], sky = w.getLight(x, y, z) >>> 12, top = w.topAt(x, z);
    const cave = sky < 4 && y < 60, indoors = sky < 4 && !cave && top > y + 1;
    // water within 12 blocks: a 5×5 grid of surface samples
    let wd = 99;
    const WATER = VR.F.WATER, flags = VR.R.T.flags;
    for (let dz = -12; dz <= 12; dz += 6) for (let dx = -12; dx <= 12; dx += 6) {
      const tx = x + dx, tz = z + dz, ty = w.topAt(tx, tz);
      if (ty && (flags[w.getBlock(tx, ty, tz)] & WATER) && Math.abs(ty - y) < 14) wd = Math.min(wd, Math.hypot(dx, dz));
    }
    let village = 0;
    if (g.villages && g.villages.nearestSite) { const n = g.villages.nearestSite(eye[0], eye[2]); if (n) village = M.clamp(1 - (n.dist - 40) / 100, 0, 1); }
    const v = p.vel || [0, 0, 0];
    return {
      tod: g.env.timeOfDay, night: E ? E.night : 0, birdK: Ambience.birdK(b), temp: b ? b.temp : 0.8,
      rain: S ? S.rain : 0, snow: S ? S.snow : 0, storm: S ? S.storm : 0, wind: S ? S.wind : 1,
      y: eye[1], speed: p.flying ? Math.hypot(v[0], v[2]) : 0, indoors, cave, underwater: !!(o && o.underwater),
      water: wd <= 12 ? 1 - wd / 14 : 0, village,
    };
  };
  Ambience.MAX = MAX;
  VR.Ambience = Ambience;
})(VR);

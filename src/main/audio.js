// ============================================================================
// Procedural audio: material-based SFX, ambience loops, adaptive generative music
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R;
  const PROFILE = {
    stone: { f: 1400, q: 1.2, d: 0.09, g: 0.5, thump: 110 }, deep: { f: 1000, q: 1.3, d: 0.1, g: 0.55, thump: 90 }, dripstone: { f: 1200, q: 1.4, d: 0.1, g: 0.5, thump: 100 },
    wood: { f: 650, q: 2.5, d: 0.08, g: 0.6, thump: 180, knock: 1 }, planks: { f: 700, q: 2.5, d: 0.08, g: 0.6, thump: 200, knock: 1 },
    grass: { f: 3200, q: 0.6, d: 0.12, g: 0.35, hp: 1 }, plant: { f: 3600, q: 0.6, d: 0.1, g: 0.3, hp: 1 }, leaves: { f: 3000, q: 0.5, d: 0.12, g: 0.3, hp: 1 },
    gravel: { f: 1800, q: 0.7, d: 0.14, g: 0.5, crackle: 1 }, sand: { f: 2600, q: 0.5, d: 0.14, g: 0.35, crackle: 1 }, soul: { f: 900, q: 0.8, d: 0.2, g: 0.4 },
    snow: { f: 1600, q: 0.4, d: 0.16, g: 0.3 }, wool: { f: 500, q: 0.5, d: 0.1, g: 0.35 }, glass: { f: 4200, q: 6, d: 0.2, g: 0.35, ping: 1 },
    metal: { f: 2400, q: 8, d: 0.25, g: 0.35, clang: 1 }, amethyst: { f: 3000, q: 10, d: 0.5, g: 0.3, ping: 1, chime: 1 }, ember: { f: 900, q: 1, d: 0.1, g: 0.5, thump: 90 },
    water: { f: 900, q: 0.8, d: 0.2, g: 0.3 }, coral: { f: 1500, q: 1, d: 0.1, g: 0.4 }, slime: { f: 400, q: 3, d: 0.15, g: 0.5 }, honey: { f: 350, q: 2, d: 0.2, g: 0.45 },
    lantern: { f: 2600, q: 7, d: 0.2, g: 0.3, clang: 1 }, anvil: { f: 1800, q: 9, d: 0.5, g: 0.4, clang: 1 }, scaffold: { f: 800, q: 2, d: 0.08, g: 0.5, knock: 1 },
  };
  class Audio {
    constructor() { this.ctx = null; this.enabled = true; this.vol = { master: 0.8, sfx: 0.9, music: 0.45, ambient: 0.6 }; this.loops = {}; this.music = { next: 0, bar: 0, chord: 0, mood: 'day', intensity: 0 }; }
    init() {
      if (this.ctx || !this.enabled) return;
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.enabled = false; return; }
      const c = this.ctx;
      this.master = c.createGain(); this.master.gain.value = this.vol.master;
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
      this.master.connect(comp); comp.connect(c.destination);
      this.sfx = c.createGain(); this.sfx.gain.value = this.vol.sfx; this.sfx.connect(this.master);
      this.mus = c.createGain(); this.mus.gain.value = this.vol.music; this.mus.connect(this.master);
      this.amb = c.createGain(); this.amb.gain.value = this.vol.ambient; this.amb.connect(this.master);
      // reverb
      this.rev = c.createConvolver();
      const len = c.sampleRate * 2.8, ir = c.createBuffer(2, len, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
      this.rev.buffer = ir;
      this.revGain = c.createGain(); this.revGain.gain.value = 0.35; this.rev.connect(this.revGain); this.revGain.connect(this.master);
      this.musRev = c.createGain(); this.musRev.gain.value = 0.6; this.musRev.connect(this.rev);
      this.mus.connect(this.musRev);
      // noise buffer
      const nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), nd = nb.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      this.noise = nb;
      if (c.state === 'suspended') c.resume();
    }
    resume() { if (!this.ctx) this.init(); else if (this.ctx.state === 'suspended') this.ctx.resume(); }
    setVolumes(v) { Object.assign(this.vol, v); if (!this.ctx) return; this.master.gain.value = this.vol.master; this.sfx.gain.value = this.vol.sfx; this.mus.gain.value = this.vol.music; this.amb.gain.value = this.vol.ambient; }
    profileOf(state) { const t = R.types[R.T.type[state]]; const snd = t && t.o.sound; return PROFILE[snd] || (t && /log|planks|wood/.test(t.name) ? PROFILE.wood : PROFILE.stone); }
    noiseHit(p, gain, dur, pitchMul, pan) {
      const c = this.ctx; if (!c) return;
      const t = c.currentTime;
      const src = c.createBufferSource(); src.buffer = this.noise; src.playbackRate.value = 0.8 + Math.random() * 0.4;
      const f = c.createBiquadFilter(); f.type = p.hp ? 'highpass' : 'bandpass'; f.frequency.value = p.f * (pitchMul || 1) * (0.85 + Math.random() * 0.3); f.Q.value = p.q;
      const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain * p.g, t + 0.004); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(f); f.connect(g);
      let out = g;
      if (pan && c.createStereoPanner) { const pn = c.createStereoPanner(); pn.pan.value = pan; g.connect(pn); out = pn; }
      out.connect(this.sfx);
      src.start(t, Math.random() * 1.5, dur + 0.05);
      if (p.thump) this.tone(p.thump * (pitchMul || 1), gain * 0.5, dur * 0.8, 'sine');
      if (p.knock) this.tone(p.f * 0.35, gain * 0.35, 0.06, 'triangle');
      if (p.ping) this.tone(p.f * (0.9 + Math.random() * 0.3), gain * 0.25, p.d * 2, 'sine', true);
      if (p.clang) { for (const k of [1, 2.76, 5.4]) this.tone(p.f * 0.4 * k, gain * 0.12, p.d * 1.5, 'sine', true); }
      if (p.chime) { for (const k of [1, 1.5, 2.0]) this.tone(p.f * 0.5 * k, gain * 0.1, 0.9, 'sine', true); }
      if (p.crackle) for (let i = 0; i < 3; i++) setTimeout(() => this.tone(2000 + Math.random() * 2000, gain * 0.05, 0.02, 'square'), i * 25);
    }
    tone(freq, gain, dur, type, rev, when, dest) {
      const c = this.ctx; if (!c) return;
      const t = (when || c.currentTime);
      const o = c.createOscillator(); o.type = type || 'sine'; o.frequency.value = freq;
      const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(g); g.connect(dest || this.sfx); if (rev) g.connect(this.rev);
      o.start(t); o.stop(t + dur + 0.05);
      return o;
    }
    step(state) { if (!this.ctx || !state) return; this.noiseHit(this.profileOf(state), 0.35, this.profileOf(state).d, 1); }
    dig(state, broken) { if (!this.ctx || !state) return; const p = this.profileOf(state); this.noiseHit(p, broken ? 0.9 : 0.45, p.d * (broken ? 1.8 : 1), broken ? 0.8 : 1); }
    place(state) { if (!this.ctx || !state) return; const p = this.profileOf(state); this.noiseHit(p, 0.8, p.d * 1.4, 0.9); }
    play(name, opts) {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime;
      switch (name) {
        case 'click': this.tone(880, 0.12, 0.05, 'square'); break;
        case 'pop': this.tone(600 + Math.random() * 300, 0.18, 0.08, 'sine'); this.tone(1200, 0.08, 0.05, 'sine'); break;
        case 'hurt': this.tone(220, 0.35, 0.18, 'sawtooth'); this.noiseHit(PROFILE.wool, 0.8, 0.15, 1); break;
        case 'eat': for (let i = 0; i < 3; i++) setTimeout(() => this.noiseHit(PROFILE.gravel, 0.4, 0.06, 1.3), i * 110); break;
        case 'levelup': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 0.4, 'triangle', true, t + i * 0.08)); break;
        case 'achievement': [659, 784, 988, 1319].forEach((f, i) => this.tone(f, 0.16, 0.7, 'sine', true, t + i * 0.09)); break;
        case 'explode': {
          const src = c.createBufferSource(); src.buffer = this.noise;
          const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(1800, t); f.frequency.exponentialRampToValueAtTime(80, t + 1.6);
          const g = c.createGain(); g.gain.setValueAtTime(1.4 * (opts && opts.vol || 1), t); g.gain.exponentialRampToValueAtTime(0.001, t + 2.0);
          src.connect(f); f.connect(g); g.connect(this.sfx); g.connect(this.rev); src.start(t, 0, 2.1);
          this.tone(55, 0.9, 0.9, 'sine'); break;
        }
        case 'laser': { const o = this.tone(1800, 0.2, 0.18, 'sawtooth', true); if (o) o.frequency.exponentialRampToValueAtTime(220, t + 0.18); break; }
        case 'zap': { const o = this.tone(3200, 0.12, 0.08, 'square'); if (o) o.frequency.exponentialRampToValueAtTime(600, t + 0.08); break; }
        case 'thunder': { const src = c.createBufferSource(); src.buffer = this.noise; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400; const g = c.createGain(); g.gain.setValueAtTime(0.0, t); g.gain.linearRampToValueAtTime(1.2, t + 0.05); g.gain.exponentialRampToValueAtTime(0.001, t + 4); src.connect(f); f.connect(g); g.connect(this.sfx); g.connect(this.rev); src.start(t, 0, 4); break; }
        case 'splash': this.noiseHit(PROFILE.water, 1.2, 0.5, 0.8); break;
        case 'door': this.noiseHit(PROFILE.wood, 0.7, 0.12, 0.7); this.tone(150, 0.25, 0.12, 'triangle'); break;
        case 'chest': this.noiseHit(PROFILE.wood, 0.6, 0.2, 0.6); break;
        case 'portal': [220, 277, 330, 440].forEach((f, i) => this.tone(f, 0.12, 2.5, 'sine', true, t + i * 0.15)); break;
        case 'break_tool': this.noiseHit(PROFILE.metal, 1, 0.3, 1); break;
        case 'warp': { const o = this.tone(80, 0.4, 2.2, 'sawtooth', true); if (o) o.frequency.exponentialRampToValueAtTime(1600, t + 2); break; }
        case 'meteor': { const src = c.createBufferSource(); src.buffer = this.noise; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(3000, t); f.frequency.exponentialRampToValueAtTime(200, t + 2.5); const g = c.createGain(); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 2.6); src.connect(f); f.connect(g); g.connect(this.sfx); src.start(t, 0, 2.7); break; }
        case 'toast': this.tone(988, 0.1, 0.25, 'sine', true); this.tone(1319, 0.08, 0.35, 'sine', true, t + 0.08); break;
        // ---- ships (flight.js / cockpit.js)
        case 'thump': { const v = (opts && opts.vol) || 0.6; this.tone(62, 0.7 * v, 0.32, 'sine'); this.tone(118, 0.25 * v, 0.12, 'triangle'); this.noiseHit({ f: 260, q: 0.9, g: 0.9 }, v, 0.16, 1); break; }
        case 'boost': {
          const src = c.createBufferSource(); src.buffer = this.noise;
          const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.4; f.frequency.setValueAtTime(260, t); f.frequency.exponentialRampToValueAtTime(2400, t + 0.45);
          const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.55, t + 0.06); g.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
          src.connect(f); f.connect(g); g.connect(this.sfx); g.connect(this.rev); src.start(t, Math.random(), 1.2);
          const o = this.tone(48, 0.5, 0.9, 'sawtooth'); if (o) o.frequency.exponentialRampToValueAtTime(96, t + 0.6); break;
        }
        case 'servo': { const v = (opts && opts.vol) || 1; const o = this.tone(170, 0.07 * v, 0.75, 'sawtooth'); if (o) { o.frequency.setValueAtTime(170, t); o.frequency.linearRampToValueAtTime(320, t + 0.6); } this.tone(1900, 0.015 * v, 0.6, 'sine'); break; }
        case 'clunk': { const v = (opts && opts.vol) || 1; this.tone(95, 0.45 * v, 0.14, 'triangle'); this.noiseHit({ f: 900, q: 2, g: 0.6, knock: 1 }, 0.6 * v, 0.06, 1); break; }
        case 'switch': { const v = (opts && opts.vol) || 1; this.noiseHit({ f: 3600, q: 3, g: 0.6 }, 0.55 * v, 0.025, 1); this.tone(2400, 0.05 * v, 0.02, 'square'); break; }
        case 'button': { const v = (opts && opts.vol) || 1; this.noiseHit({ f: 1500, q: 2.5, g: 0.6 }, 0.5 * v, 0.03, 1); this.tone(880, 0.06 * v, 0.06, 'sine'); break; }
        case 'lever': { const v = (opts && opts.vol) || 1; const src = c.createBufferSource(); src.buffer = this.noise; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 1.2; const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.18 * v, t + 0.05); g.gain.exponentialRampToValueAtTime(0.001, t + 0.28); src.connect(f); f.connect(g); g.connect(this.sfx); src.start(t, Math.random(), 0.3); this.tone(140, 0.2 * v, 0.1, 'triangle', false, t + 0.22); break; }
        case 'deny': this.tone(220, 0.12, 0.12, 'square'); this.tone(165, 0.12, 0.16, 'square', false, t + 0.12); break;
        case 'spool': { const o = this.tone(90, 0.12, 3.2, 'sawtooth', true); if (o) o.frequency.exponentialRampToValueAtTime(520, t + 3); const o2 = this.tone(400, 0.03, 3.2, 'sine'); if (o2) o2.frequency.exponentialRampToValueAtTime(2200, t + 3); break; }
      }
    }
    // turbine whine of a ship's engines: two oscillators through a band-pass, the pitch follows the spool (0…1.45)
    turbine(level, spool) {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime;
      let L = this.turb;
      if (!L) {
        if (level <= 0.001) return;
        const g = c.createGain(); g.gain.value = 0;
        const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2.5; f.frequency.value = 900;
        const o1 = c.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 260;
        const o2 = c.createOscillator(); o2.type = 'triangle'; o2.frequency.value = 523;
        const g2 = c.createGain(); g2.gain.value = 0.7;
        o1.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(this.sfx);
        o1.start(); o2.start();
        L = this.turb = { g, f, o1, o2 };
      }
      const sp = Math.max(0, spool || 0), f0 = 240 + sp * 760;
      L.g.gain.setTargetAtTime(Math.max(0, level), t, 0.2);
      L.o1.frequency.setTargetAtTime(f0, t, 0.3); L.o2.frequency.setTargetAtTime(f0 * 2.013, t, 0.3);
      L.f.frequency.setTargetAtTime(f0 * 1.7, t, 0.3);
    }
    // continuous loops: name → {gain, filter}; level 0..1
    loop(name, level, pitch) {
      if (!this.ctx) return;
      const c = this.ctx;
      let L = this.loops[name];
      if (!L) {
        if (level <= 0.001) return;
        const src = c.createBufferSource(); src.buffer = this.noise; src.loop = true;
        const f = c.createBiquadFilter();
        const g = c.createGain(); g.gain.value = 0;
        const cfg = { rain: ['highpass', 1200, 0.2], wind: ['bandpass', 400, 0.8], jet: ['bandpass', 900, 1.2], engine: ['lowpass', 300, 4], flyby: ['lowpass', 420, 2.5], water: ['bandpass', 600, 0.6], fire: ['bandpass', 1500, 0.5], cave: ['lowpass', 180, 1] }[name] || ['lowpass', 500, 1];
        f.type = cfg[0]; f.frequency.value = cfg[1]; f.Q.value = cfg[2];
        src.connect(f); f.connect(g); g.connect(name === 'jet' || name === 'engine' || name === 'flyby' ? this.sfx : this.amb);
        src.start();
        let osc = null;
        if (name === 'engine' || name === 'jet' || name === 'flyby') { osc = c.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 55; const og = c.createGain(); og.gain.value = 0.25; osc.connect(og); og.connect(f); osc.start(); }
        L = this.loops[name] = { src, f, g, osc, base: cfg[1] };
      }
      L.g.gain.setTargetAtTime(level, c.currentTime, 0.25);
      if (pitch && L.osc) L.osc.frequency.setTargetAtTime(40 + pitch * 90, c.currentTime, 0.1);
      if (pitch) L.f.frequency.setTargetAtTime(L.base * (0.7 + pitch * 0.9), c.currentTime, 0.1);
    }
    // ---------------- adaptive generative music ----------------
    updateMusic(dt, s) {
      // s: {night, cave, danger, biome, space, enabled}
      if (!this.ctx || this.vol.music <= 0 || s.enabled === false) return;
      const c = this.ctx, now = c.currentTime;
      const M = this.music;
      M.intensity += ((s.danger ? 1 : 0) - M.intensity) * Math.min(1, dt * 0.5);
      if (now + 0.2 < M.next) return;
      const mood = s.danger ? 'danger' : s.festival ? 'festival' : s.cave ? 'cave' : s.space ? 'space' : s.night > 0.5 ? 'night' : 'day';
      M.mood = mood;
      if (mood === 'festival') { this.festivalBar(now); return; }
      const root = { day: 62, night: 57, cave: 50, danger: 52, space: 55 }[mood];
      const scale = { day: [0, 2, 4, 6, 7, 9, 11], night: [0, 2, 3, 5, 7, 8, 10], cave: [0, 1, 3, 5, 7, 8, 10], danger: [0, 1, 3, 5, 6, 8, 10], space: [0, 2, 4, 7, 9, 11, 14] }[mood];
      const prog = { day: [0, 3, 5, 4], night: [0, 5, 3, 6], cave: [0, 1, 0, 6], danger: [0, 1, 0, 1], space: [0, 4, 2, 5] }[mood];
      const beat = mood === 'danger' ? 0.34 : 0.62;
      const barLen = beat * 8;
      const t0 = Math.max(now + 0.05, M.next);
      const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
      const deg = (d) => root + scale[((d % 7) + 7) % 7] + Math.floor(d / 7) * 12;
      const ch = prog[M.bar % prog.length];
      // pad chord
      const pad = [ch, ch + 2, ch + 4].map(deg);
      for (const n of pad) this.padNote(midi(n - 12), barLen * 1.1, t0, mood === 'cave' ? 0.035 : 0.05);
      if (mood !== 'danger') this.padNote(midi(deg(ch) - 24), barLen, t0, 0.06);
      // arpeggio / melody
      const density = mood === 'day' ? 0.55 : mood === 'space' ? 0.6 : mood === 'night' ? 0.35 : mood === 'cave' ? 0.2 : 0.8;
      for (let i = 0; i < 8; i++) {
        if (Math.random() > density) continue;
        const d = ch + [0, 2, 4, 7, 4, 2, 5, 9][i] + (Math.random() < 0.2 ? 1 : 0);
        this.pluck(midi(deg(d) + 12), t0 + i * beat, mood === 'space' ? 1.6 : 0.9, mood === 'danger' ? 0.05 : 0.06, mood === 'space' ? 'sine' : 'triangle');
      }
      if (mood === 'danger') for (let i = 0; i < 8; i++) this.kick(t0 + i * beat, i % 4 === 0 ? 0.35 : 0.18);
      if (Math.random() < 0.3 && mood !== 'danger') this.pluck(midi(deg(ch + 7) + 24), t0 + beat * (2 + Math.floor(Math.random() * 4)), 2.5, 0.03, 'sine');
      M.bar++;
      M.next = t0 + barLen;
    }
    // a jaunty village band: fiddle-ish melody, plucked bass, drum & claps (I–V–vi–IV in D major)
    festivalBar(now) {
      const M = this.music, beat = 0.27, barLen = beat * 8, t0 = Math.max(now + 0.05, M.next);
      const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
      const root = 62, scale = [0, 2, 4, 5, 7, 9, 11];
      const deg = (d) => root + scale[((d % 7) + 7) % 7] + Math.floor(d / 7) * 12;
      const prog = [0, 4, 5, 3], ch = prog[M.bar % 4];
      const TUNES = [[0, 2, 4, 2, 4, 5, 4, 2], [4, 4, 5, 7, 5, 4, 2, 0], [2, 4, 2, 0, -1, 0, 2, 4], [7, 5, 4, 2, 4, 2, 0, -1]];
      const tune = TUNES[(M.bar >> 1) % 4];
      for (let i = 0; i < 8; i++) {
        if (i % 2 === 1 && Math.random() < 0.18) continue;
        this.pluck(midi(deg(ch + tune[i]) + 12), t0 + i * beat, 0.32, 0.055, i % 4 === 0 ? 'sawtooth' : 'triangle');
      }
      for (let i = 0; i < 8; i += 2) this.pluck(midi(deg(ch + (i % 4 ? 4 : 0)) - 12), t0 + i * beat, 0.4, 0.09, 'triangle');
      this.padNote(midi(deg(ch) - 12), barLen, t0, 0.028);
      for (let i = 0; i < 8; i++) {
        if (i % 4 === 0) this.kick(t0 + i * beat, 0.28);
        if (i % 4 === 2) this.clap(t0 + i * beat);
      }
      M.bar++;
      M.next = t0 + barLen;
    }
    clap(t) {
      const c = this.ctx, src = c.createBufferSource(); src.buffer = this.noise;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 0.8;
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.12, t + 0.004); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      src.connect(f); f.connect(g); g.connect(this.mus); src.start(t, Math.random() * 0.5, 0.15);
    }
    padNote(f, dur, t, gain) {
      const c = this.ctx;
      const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + dur * 0.3); g.gain.linearRampToValueAtTime(0.0001, t + dur);
      const flt = c.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 900; flt.Q.value = 0.5;
      for (const det of [-6, 6]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; o.connect(flt); o.start(t); o.stop(t + dur + 0.1); }
      flt.connect(g); g.connect(this.mus);
    }
    pluck(f, t, dur, gain, type) { this.tone(f, gain, dur, type || 'triangle', false, t, this.mus); }
    kick(t, gain) { const c = this.ctx; const o = c.createOscillator(); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15); const g = c.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25); o.connect(g); g.connect(this.mus); o.start(t); o.stop(t + 0.3); }
  }
  VR.Audio = Audio;
})(VR);

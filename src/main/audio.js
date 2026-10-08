// ============================================================================
// Procedural audio (F4 · Klang): footsteps, placing, breaking and crackle by material family (klang.js); the UI voices;
// positional voices (pan and distance, occlusion by the light field); one room reverb for indoors and caves; the
// lowpass under water; the ambience loops (ambience.js); and the generative pentatonic music, seeded by the day.
// Everything is synthesized when the audio starts. No files, no requests.
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R, K = VR.Klang;
  const MAX_VOICES = 24;          // world voices alive at once: the next one is dropped
  const HEAR = 48;                // a positional voice beyond this many blocks is silent (no nodes)
  const ROOM_SEND = 0.55, CAVE_SEND = 0.8;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

  // the room's impulse, synthesized: a noise tail that darkens as it decays, with a few early reflections. The room is
  // 1.3 s; a cave is 2.6 s and darker. Made once; seeded, so every start sounds the same.
  function impulse(c, secs, t60, cave, pre, seed) {
    const sr = c.sampleRate, n = Math.floor(sr * secs), buf = c.createBuffer(2, n, sr);
    const p0 = Math.floor(pre * sr), decay = Math.pow(10, -3 / (t60 * sr));
    const taps = cave ? [[0.021, 0.5], [0.048, 0.36], [0.083, 0.24], [0.127, 0.16]] : [[0.007, 0.5], [0.013, 0.4], [0.019, 0.32], [0.027, 0.26], [0.035, 0.18], [0.046, 0.12]];
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let s = (seed + ch * 7919) >>> 0, y = 0, env = 1;
      for (let i = p0; i < n; i++) {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        const x = s / 2147483648 - 1, a = cave ? 0.22 - 0.1 * (i / n) : 0.6 - 0.35 * (i / n);
        y += a * (x - y);
        d[i] = y * env; env *= decay;
      }
      for (const [tt, g] of taps) { const i = Math.floor(tt * sr) + (ch ? 37 : 0); if (i < n) d[i] += ch ? -0.8 * g : g; }
    }
    return buf;
  }

  class Audio {
    constructor() {
      this.ctx = null; this.enabled = true;
      this.vol = { master: 0.8, sfx: 0.9, music: 0.45, ambient: 0.6 };
      this.loops = {};
      this.music = { next: 0, bar: 0, chord: 0, mood: 'day', intensity: 0, scan: 0, hostile: false, village: false, duckT: 1, planDay: -1, plan: null, rng: null };
      this.L = { x: 0, y: 0, z: 0, yaw: 0, sky: 15, underwater: false, w: null };
      this.cave = false; this.irAt = 0; this.roomT = -1; this.muT = -1;
      this.live = [];                       // the end times of the world voices alive
      this.counts = {};                     // how many of each sound were played (the tests and the F3 overlay read it)
      this.noteLog = new Int16Array(512); this.noteCount = 0;   // the MIDI notes the music scheduled
    }
    // builds the graph once for a context: an external one (the tests) or the browser's
    init(ext) {
      if (this.ctx || (!this.enabled && !ext)) return;
      if (ext) this.ctx = ext;
      else { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.enabled = false; return; } }
      const c = this.ctx;
      this.master = c.createGain(); this.master.gain.value = this.vol.master;
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
      this.master.connect(comp); comp.connect(c.destination);
      // the world's sound: dry (sfx) through a lowpass that muffles it under water, and wet (the room) into the convolver
      this.sfx = c.createGain(); this.sfx.gain.value = this.vol.sfx;
      this.sfxMuffle = c.createBiquadFilter(); this.sfxMuffle.type = 'lowpass'; this.sfxMuffle.frequency.value = 20000; this.sfxMuffle.Q.value = 0.5;
      this.sfx.connect(this.sfxMuffle); this.sfxMuffle.connect(this.master);
      this.worldIn = c.createGain(); this.worldIn.connect(this.sfx);
      this.room = c.createGain(); this.room.gain.value = 0;                 // the room send: 0 outdoors, on indoors and in caves
      this.worldIn.connect(this.room);
      this.amb = c.createGain(); this.amb.gain.value = this.vol.ambient; this.amb.connect(this.master);
      this.mus = c.createGain(); this.mus.gain.value = this.vol.music; this.mus.connect(this.master);
      this.musDuck = c.createGain(); this.musDuck.gain.value = 1; this.musDuck.connect(this.mus);   // a hostile mob ducks it
      // one convolver at a time: the room's impulse, or the cave's while the send is muted (swapped in listen)
      this.irRoom = impulse(c, 1.3, 0.9, false, 0.004, 0x51ed1);
      this.irCave = impulse(c, 2.6, 2.4, true, 0.03, 0xca7e);
      this.revGain = c.createGain(); this.revGain.gain.value = 0.35; this.revGain.connect(this.master);
      this.musRev = c.createGain(); this.musRev.gain.value = 0.6; this.mus.connect(this.musRev);
      this.rev = null; this.setRev(this.irRoom);
      // noise buffer (the source of every hit, step and crackle)
      const nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), nd = nb.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      this.noise = nb;
      if (c.state === 'suspended') c.resume();
    }
    resume() { if (!this.ctx) this.init(); else if (this.ctx.state === 'suspended') this.ctx.resume(); }
    setVolumes(v) { Object.assign(this.vol, v); if (!this.ctx) return; this.master.gain.value = this.vol.master; this.sfx.gain.value = this.vol.sfx; this.mus.gain.value = this.vol.music; this.amb.gain.value = this.vol.ambient; }
    count(name) { this.counts[name] = (this.counts[name] | 0) + 1; }
    prune() { const live = this.live, now = this.ctx ? this.ctx.currentTime : 0; let k = 0; for (let i = 0; i < live.length; i++) if (live[i] > now) live[k++] = live[i]; live.length = k; return k; }
    stats() { return { voices: this.prune(), counts: this.counts, notes: this.noteCount }; }
    // the state the tests and the overlay read: the targets the ear has set (the audio params follow them over a few
    // tenths of a second of audio time, so these read at once, also before the audio clock has moved)
    state() { return { indoors: this.L.sky < 4 || this.L.underwater, cave: !!this.cave, underwater: this.L.underwater, muffle: this.muT < 0 ? 20000 : this.muT, room: this.roomT < 0 ? 0 : this.roomT, duck: this.music.duckT }; }

    // the room's convolver. A ConvolverNode takes its buffer once, so the cave's impulse is played by a new node; the old
    // one is cut off (listen mutes the room send for 90 ms before the swap, so its tail has gone by then)
    setRev(buf) {
      const c = this.ctx;
      if (this.rev) { this.room.disconnect(); this.musRev.disconnect(); this.rev.disconnect(); }
      this.rev = c.createConvolver(); this.rev.buffer = buf;
      this.room.connect(this.rev); this.musRev.connect(this.rev); this.rev.connect(this.revGain);
    }

    // ---------------- the listener: where the ear is, which way it faces, and the place's flags (per frame, numbers only)
    listen(eye, yaw, w, underwater) {
      if (!this.ctx || !eye) return;
      const L = this.L, c = this.ctx, t = c.currentTime;
      L.x = eye[0]; L.y = eye[1]; L.z = eye[2]; L.yaw = +yaw || 0; L.w = w || null; L.underwater = !!underwater;
      L.sky = w ? (w.getLight(Math.floor(eye[0]), Math.floor(eye[1]), Math.floor(eye[2])) >>> 12) : 15;
      const indoors = L.sky < 4 || L.underwater, cave = indoors && eye[1] < 60;
      // the room: when the cave changes, the send is muted, the impulse is swapped 90 ms later, then the send returns
      if (cave !== this.cave) { this.cave = cave; this.room.gain.setTargetAtTime(0, t, 0.02); this.irAt = t + 0.09; this.roomT = -1; }
      if (this.irAt && t >= this.irAt) { this.setRev(this.cave ? this.irCave : this.irRoom); this.irAt = 0; }
      if (!this.irAt) {                                   // automation is sent only when a target changes (Very Low: no per-frame cost)
        const want = this.cave ? CAVE_SEND : indoors ? ROOM_SEND : 0;
        if (want !== this.roomT) { this.roomT = want; this.room.gain.setTargetAtTime(want, t, 0.25); }
      }
      const mu = L.underwater ? 900 : 20000;
      if (mu !== this.muT) { this.muT = mu; this.sfxMuffle.frequency.setTargetAtTime(mu, t, 0.2); }
    }
    // where a sound is heard from: the pan (90 % of the side), the distance gain (half at 6 blocks, silent past HEAR)
    // and the occlusion (a source darker than the ear sits behind a wall: 0 open … 1 shut)
    spatial(at) {
      const L = this.L, dx = at[0] - L.x, dy = at[1] - L.y, dz = at[2] - L.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d > HEAR) return null;
      const rx = Math.cos(L.yaw), rz = -Math.sin(L.yaw), hl = Math.sqrt(dx * dx + dz * dz) || 1;
      const pan = clamp((dx * rx + dz * rz) / hl, -1, 1) * 0.9;
      let occ = 0;
      if (L.w) occ = clamp((L.sky - ((L.w.getLight(Math.floor(at[0]), Math.floor(at[1]), Math.floor(at[2])) >>> 12))) / 10, 0, 1);
      return { pan, gain: 1 / (1 + d / 6), occ };
    }
    // a slot for a world voice until it ends; past MAX_VOICES the new one is dropped
    slot(end) { if (this.prune() >= MAX_VOICES) return false; this.live.push(end); return true; }
    // the input of a world voice: the world bus, or at a place: gain → occlusion lowpass → StereoPanner → the bus.
    // null when the place is beyond earshot or the voices are full (then nothing is built)
    inlet(at, end) {
      if (!at) return this.slot(end) ? this.worldIn : null;
      const sp = this.spatial(at);
      if (!sp || !this.slot(end)) return null;
      const c = this.ctx;
      const vg = c.createGain(); vg.gain.value = sp.gain;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 20000 * (1 - sp.occ) + 1200 * sp.occ; lp.Q.value = 0.7;
      const pn = c.createStereoPanner(); pn.pan.value = sp.pan;
      vg.connect(lp); lp.connect(pn); pn.connect(this.worldIn);
      return vg;
    }

    // ---------------- a recipe (klang.js) played into dest at time t; returns the time it ends
    // k: the voice's level; pitch: ±6 % variation; band: the timbre (heel or toe); mode: 'hit' | 'step' | 'crackle' | 'break'
    recipe(R0, k, pitch, band, t, dest, mode) {
      const c = this.ctx, crackle = mode === 'crackle';
      let end = t;
      if (R0.dur) {
        const dur = R0.dur, peak = R0.g * k;
        const src = c.createBufferSource(); src.buffer = this.noise; src.playbackRate.value = 0.9 + Math.random() * 0.2;
        const f = c.createBiquadFilter();
        f.type = R0.kind === 'hp' ? 'highpass' : R0.kind === 'lp' ? 'lowpass' : 'bandpass';
        f.frequency.value = clamp(R0.f * pitch * band, 40, 16000); f.Q.value = R0.q;
        const g = c.createGain();
        const n = crackle ? 4 : (R0.clicks | 0);
        if (n) {                                     // micro-clicks: the crackle of breaking progress, the gravel's grains
          const step = crackle ? 0.03 : dur / n, tail = crackle ? 0.012 : step * 0.8;
          g.gain.setValueAtTime(0.0001, t);
          for (let i = 0; i < n; i++) { const u = t + i * step; g.gain.setValueAtTime(peak, u); g.gain.exponentialRampToValueAtTime(0.0008, u + tail); }
        } else {
          g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
        }
        src.connect(f); f.connect(g); g.connect(dest);
        const span = crackle ? 0.13 : dur;
        src.start(t, Math.random() * 1.2, span + 0.01); src.stop(t + span + 0.01);
        end = Math.max(end, t + span);
      }
      if (R0.body && !crackle) {
        const [f0, f1, d, bg] = R0.body;
        const o = c.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(f0 * pitch, t); o.frequency.exponentialRampToValueAtTime(f1 * pitch, t + d);
        const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(bg * k, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0008, t + d);
        o.connect(g); g.connect(dest); o.start(t); o.stop(t + d + 0.01);
        end = Math.max(end, t + d);
      }
      if (R0.ring && !crackle) for (const [hz, rg, rd] of R0.ring) {
        const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = hz * pitch;
        const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(rg * k, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0008, t + rd);
        o.connect(g); g.connect(dest); o.start(t); o.stop(t + rd + 0.01);
        end = Math.max(end, t + rd);
      }
      if (mode === 'break') {                        // the last hit pops, with a pitch rise
        const o = c.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(320 * pitch, t); o.frequency.exponentialRampToValueAtTime(980 * pitch, t + 0.07);
        const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.18 * k, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.09);
        o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.1);
        end = Math.max(end, t + 0.09);
      }
      return end;
    }
    // a family's voice ('hit' or 'step') for a block family, at a place (at) or at the player's own body
    famVoice(fam, which, k, at, mode) {
      if (!this.ctx) return null;
      const t = this.ctx.currentTime, end = t + 0.3;
      const dest = this.inlet(at, end);
      if (!dest) return null;
      const R0 = K.RECIPES[fam][which];
      return this.recipe(R0, k, K.pitchFactor(Math.random()), K.timbre(Math.random()) ? 1.12 : 0.9, t, dest, mode);
    }
    familyOf(state) { const t = R.types[R.T.type[state]]; return t ? K.familyOf(t.name, t.o && t.o.sound) : 'stone'; }
    // footsteps: o = {speed, crouch, sprint}. The player's own steps, so no place (they are heard from the body)
    step(state, o) {
      if (!this.ctx || !state) return;
      const fam = this.familyOf(state), sp = o || {};
      this.count('step:' + fam);
      this.famVoice(fam, 'step', 0.6 * K.stepGain(sp.speed, sp.crouch, sp.sprint), null, 'step');
    }
    // place (hit), breaking progress (crackle), the last hit (break, with the pop). at: optional position
    place(state, at) { this.blockSound(state, 'hit', 0.7, at); }
    dig(state, broken, at) { if (broken) this.blockSound(state, 'break', 0.95, at); else this.blockSound(state, 'crackle', 0.35, at); }
    blockSound(state, kind, k, at) {
      if (!this.ctx || !state) return;
      const fam = this.familyOf(state);
      this.count(kind + ':' + fam);
      this.famVoice(fam, 'hit', k, at || null, kind === 'crackle' ? 'crackle' : kind === 'break' ? 'break' : 'hit');
    }

    // the UI voices: never positional, never in the room, never longer than 60 ms, at −18 dBFS
    uiTone(f, peak, dur, type, t, dest, bend) {
      const c = this.ctx, o = c.createOscillator(); o.type = type; o.frequency.value = f;
      if (bend) o.frequency.exponentialRampToValueAtTime(bend, t + dur);
      const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.004);
    }
    ui(name, t) {
      const U = K.UI[name], p = U.peak, out = this.sfx;
      if (name === 'click') this.uiTone(1560, p, U.dur, 'sine', t, out);
      else if (name === 'pling') { this.uiTone(1760, p, U.dur, 'sine', t, out); this.uiTone(2637, p * 0.4, 0.05, 'sine', t, out); }
      else if (name === 'bonk') this.uiTone(196, p, U.dur, 'triangle', t, out, 150);
      else if (name === 'rustle') {
        const c = this.ctx, src = c.createBufferSource(); src.buffer = this.noise;
        const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3800; f.Q.value = 0.9;
        const g = c.createGain(); g.gain.setValueAtTime(0, t);
        for (const u of [0, 0.012, 0.026, 0.041]) { g.gain.setValueAtTime(0.0001, t + u); g.gain.linearRampToValueAtTime(p * 0.8, t + u + 0.002); g.gain.exponentialRampToValueAtTime(0.0008, t + u + 0.012); }
        src.connect(f); f.connect(g); g.connect(out); src.start(t, Math.random() * 0.5, U.dur); src.stop(t + U.dur + 0.004);
      }
    }
    // a sound with a place: opts.at = [x, y, z] (a mob, a villager, a door, a machine) is positional; without it, the body
    play(name, opts) {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime, o = opts || {}, at = o.at || null;
      this.count(name);
      if (K.UI[name]) { this.ui(name, t); return; }
      switch (name) {
        case 'pop': this.uiTone(600 + Math.random() * 300, 0.18, 0.08, 'sine', t, this.sfx); this.uiTone(1200, 0.08, 0.05, 'sine', t, this.sfx); break;
        case 'hurt': { const dest = this.inlet(at, t + 0.3); if (!dest) break; this.recipe(K.RECIPES.carpet.hit, 0.8, K.pitchFactor(Math.random()), 1, t, dest, 'hit'); this.tone(220, 0.35 * (o.vol || 1), 0.18, 'sawtooth', false, t, dest); break; }
        case 'eat': { const dest = this.inlet(at, t + 0.5); if (!dest) break; for (let i = 0; i < 3; i++) this.recipe(K.RECIPES.gravel.hit, 0.4, 1.3, 1, t + i * 0.11, dest, 'hit'); break; }
        case 'levelup': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 0.4, 'triangle', true, t + i * 0.08)); break;
        case 'achievement': [659, 784, 988, 1319].forEach((f, i) => this.tone(f, 0.16, 0.7, 'sine', true, t + i * 0.09)); break;
        case 'explode': {
          const src = c.createBufferSource(); src.buffer = this.noise;
          const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(1800, t); f.frequency.exponentialRampToValueAtTime(80, t + 1.6);
          const g = c.createGain(); g.gain.setValueAtTime(1.4 * (o.vol || 1), t); g.gain.exponentialRampToValueAtTime(0.001, t + 2.0);
          src.connect(f); f.connect(g); g.connect(this.sfx); g.connect(this.rev); src.start(t, 0, 2.1);
          this.tone(55, 0.9, 0.9, 'sine'); break;
        }
        case 'laser': { const oo = this.tone(1800, 0.2, 0.18, 'sawtooth', true); if (oo) oo.frequency.exponentialRampToValueAtTime(220, t + 0.18); break; }
        case 'zap': { const dest = at ? this.inlet(at, t + 0.1) : this.sfx; if (!dest) break; const oo = this.tone(3200, 0.12, 0.08, 'square', false, t, dest); if (oo) oo.frequency.exponentialRampToValueAtTime(600, t + 0.08); break; }
        case 'thunder': { const src = c.createBufferSource(); src.buffer = this.noise; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400; const g = c.createGain(); g.gain.setValueAtTime(0.0, t); g.gain.linearRampToValueAtTime(1.2, t + 0.05); g.gain.exponentialRampToValueAtTime(0.001, t + 4); src.connect(f); f.connect(g); g.connect(this.sfx); g.connect(this.rev); src.start(t, 0, 4); break; }
        case 'splash': { const dest = this.inlet(at, t + 0.6); if (dest) this.recipe(K.RECIPES.water.hit, 1.2, K.pitchFactor(Math.random()), 0.8, t, dest, 'hit'); break; }
        case 'door': {
          // a wooden thock and a creak, at the door when it has a place
          const dest = this.inlet(at, t + 0.4); if (!dest) break;
          this.recipe(K.RECIPES.wood.hit, 0.7, K.pitchFactor(Math.random()), 0.9, t, dest, 'hit');
          this.tone(150, 0.25, 0.12, 'triangle', false, t, dest);
          break;
        }
        case 'chest': { const dest = this.inlet(at, t + 0.3); if (dest) this.recipe(K.RECIPES.wood.hit, 0.6, K.pitchFactor(Math.random()), 0.8, t, dest, 'hit'); break; }
        case 'portal': [220, 277, 330, 440].forEach((f, i) => this.tone(f, 0.12, 2.5, 'sine', true, t + i * 0.15)); break;
        case 'break_tool': this.recipe(K.RECIPES.metal.hit, 1, 1, 1, t, this.sfx, 'hit'); break;
        case 'warp': { const oo = this.tone(80, 0.4, 2.2, 'sawtooth', true); if (oo) oo.frequency.exponentialRampToValueAtTime(1600, t + 2); break; }
        case 'meteor': { const src = c.createBufferSource(); src.buffer = this.noise; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(3000, t); f.frequency.exponentialRampToValueAtTime(200, t + 2.5); const g = c.createGain(); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 2.6); src.connect(f); f.connect(g); g.connect(this.sfx); src.start(t, 0, 2.7); break; }
        case 'toast': this.tone(988, 0.1, 0.25, 'sine', true); this.tone(1319, 0.08, 0.35, 'sine', true, t + 0.08); break;
        // ✨ a wonder rises: a slow, soft rising chime (a pentatonic arpeggio, bells with a long tail)
        case 'wonder': [523, 659, 784, 988, 1175, 1319, 1568].forEach((f, i) => { this.tone(f, 0.07, 2.4, 'sine', true, t + i * 0.32); this.tone(f * 2.01, 0.02, 1.6, 'sine', true, t + i * 0.32 + 0.01); }); break;
        // ✨ a wonder found: a bright little fanfare (a rising triad, then the chord held)
        case 'fanfare': [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.42]].forEach(([f, d]) => { this.tone(f, 0.16, d < 0.4 ? 0.3 : 1.6, 'triangle', true, t + d); this.tone(f * 0.5, 0.06, d < 0.4 ? 0.3 : 1.6, 'sawtooth', false, t + d); }); [1047, 1319, 1568].forEach((f) => this.tone(f, 0.08, 1.8, 'sine', true, t + 0.42)); break;
      }
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
    // a tone (oscillator and envelope). dest: the node to feed (default the sfx bus); rev: a send into the convolver
    tone(freq, gain, dur, type, rev, when, dest) {
      const c = this.ctx; if (!c) return;
      const t = (when || c.currentTime);
      const o = c.createOscillator(); o.type = type || 'sine'; o.frequency.value = freq;
      const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(g); g.connect(dest || this.sfx); if (rev) g.connect(this.rev);
      o.start(t); o.stop(t + dur + 0.05);
      return o;
    }

    // ---------------- adaptive generative music: pentatonic, seeded by the day, ducked by a hostile mob
    // s: {night, cave, danger, space, festival, enabled, day, mobs (the entities' list), agents (the villagers)}
    hostileNear(mobs) {
      if (!mobs) return false;
      const L = this.L;
      for (let i = 0; i < mobs.length; i++) {
        const m = mobs[i];
        if (!m || m.dead || !m.def || !m.def.hostile) continue;
        const dx = m.pos[0] - L.x, dy = m.pos[1] - L.y, dz = m.pos[2] - L.z;
        if (dx * dx + dy * dy + dz * dz < 24 * 24) return true;
      }
      return false;
    }
    villageNear(agents) {
      if (!agents) return false;
      const L = this.L;
      for (let i = 0; i < agents.length; i++) {
        const a = agents[i];
        if (!a || !a.pos) continue;
        const dx = a.pos[0] - L.x, dz = a.pos[2] - L.z;
        if (dx * dx + dz * dz < 30 * 30) return true;
      }
      return false;
    }
    updateMusic(dt, s) {
      if (!this.ctx || this.vol.music <= 0 || s.enabled === false) return;
      const c = this.ctx, now = c.currentTime, M = this.music;
      // four times a second: is a hostile mob near (the music ducks), is a villager near (the tick)
      M.scan -= dt;
      if (M.scan <= 0) { M.scan = 0.25; M.hostile = this.hostileNear(s.mobs); M.village = this.villageNear(s.agents); }
      const duck = (M.hostile || s.danger) ? 0.25 : 1;
      if (duck !== M.duckT) { M.duckT = duck; this.musDuck.gain.setTargetAtTime(duck, now, duck < 1 ? 0.6 : 2.5); }
      if (now + 0.2 < M.next) return;
      const mood = s.danger ? 'danger' : s.festival ? 'festival' : s.cave ? 'cave' : s.space ? 'space' : s.night > 0.5 ? 'night' : 'day';
      M.mood = mood;
      if (mood === 'festival') { this.festivalBar(now); return; }
      const day = s.day | 0;
      if (M.planDay !== day) { M.planDay = day; M.plan = K.musicPlan(day); M.rng = K.rng(K.seedOf(day) ^ 0x51ed); }
      const plan = M.plan, r = M.rng, beat = mood === 'night' ? 0.7 : mood === 'danger' ? 0.45 : 0.56;
      const barLen = beat * 4, t0 = Math.max(now + 0.05, M.next);
      const density = { day: 0.6, night: 0.4, cave: 0.25, space: 0.5, danger: 0.3 }[mood] || 0.5;
      const ch = plan.prog[M.bar % plan.prog.length];                 // this bar's chord degree
      // pad: the chord (three pentatonic degrees), soft and an octave down
      for (const d of [ch, ch + 2, ch + 4]) this.calmNote(K.degreeMidi(plan, d) - 12, 'pad', barLen * 1.05, t0, mood === 'cave' ? 0.03 : 0.045);
      // bass: the root on the first and third beats
      this.calmNote(K.degreeMidi(plan, ch) - 24, 'bass', beat * 2, t0, 0.07);
      this.calmNote(K.degreeMidi(plan, ch) - 24, 'bass', beat * 2, t0 + beat * 2, 0.05);
      // pluck: the motif, four slots a bar, varied by the day's seed (never the same twice)
      for (let i = 0; i < 4; i++) {
        if (r() > density) continue;
        let d = plan.motif[(M.bar * 2 + i) % plan.motif.length];
        if (r() < 0.2) d += 1;
        this.calmNote(K.degreeMidi(plan, d) + 12, 'pluck', beat * 1.6, t0 + i * beat, 0.05);
      }
      // a village: a soft tick on every beat, the gentle rhythm of the street
      if (M.village) for (let i = 0; i < 4; i++) { this.tick(t0 + i * beat, 0.035); this.count('tick'); }
      M.bar++;
      M.next = t0 + barLen;
    }
    // one scheduled note of the calm layer: logged (for the tests), then played into the ducked music bus
    calmNote(midi, kind, dur, t, gain) {
      const i = this.noteCount & 511;
      this.noteLog[i] = midi; this.noteCount++;
      const f = 440 * Math.pow(2, (midi - 69) / 12);
      if (kind === 'pad') this.padNote(f, dur, t, gain);
      else if (kind === 'bass') this.tone(f, gain, dur, 'sine', false, t, this.musDuck);
      else this.tone(f, gain, dur, 'triangle', false, t, this.musDuck);
    }
    // a village tick: a band of noise a few milliseconds long, in the ducked music bus
    tick(t, gain) {
      const c = this.ctx, src = c.createBufferSource(); src.buffer = this.noise;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 6000; f.Q.value = 1.2;
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.02);
      src.connect(f); f.connect(g); g.connect(this.musDuck); src.start(t, Math.random() * 0.5, 0.03); src.stop(t + 0.03);
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
      src.connect(f); f.connect(g); g.connect(this.musDuck); src.start(t, Math.random() * 0.5, 0.15);
    }
    padNote(f, dur, t, gain) {
      const c = this.ctx;
      const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + dur * 0.3); g.gain.linearRampToValueAtTime(0.0001, t + dur);
      const flt = c.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 900; flt.Q.value = 0.5;
      for (const det of [-6, 6]) { const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = det; o.connect(flt); o.start(t); o.stop(t + dur + 0.1); }
      flt.connect(g); g.connect(this.musDuck);
    }
    pluck(f, t, dur, gain, type) { this.tone(f, gain, dur, type || 'triangle', false, t, this.musDuck); }
    kick(t, gain) { const c = this.ctx; const o = c.createOscillator(); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15); const g = c.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25); o.connect(g); g.connect(this.musDuck); o.start(t); o.stop(t + 0.3); }
  }
  VR.Audio = Audio;
})(VR);

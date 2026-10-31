// ============================================================================
// e-music · VR.ScoreSynth — the score's little synth: every instrument is oscillators, noise and filters (no samples).
//   pad      two detuned triangles through a soft lowpass, a slow swell in and out           (Very Low: one triangle)
//   strings  two detuned saws through a lowpass that opens a little, a bowed attack           (Very Low: one saw)
//   pluck    a triangle through a lowpass that closes fast (the pluck), a short ring
//   bell     a sine and its inharmonic partial (×2.76, the bell's tierce-ish colour), a long ring
//   bass     a sine with a little triangle on top
//   lead     a saw and a square an octave down through a brassy filter swell              (Very Low: the saw)
//   kick / hat / clap   a falling sine; a high-passed noise tick; a band of noise
//   e-music2: glass (a sine and a high pure partial), glasspad (two sines an octave apart), reed (a square through a
//   nasal band), drop (a sine falling into its pitch) — the colours of the moons, Ocker and Aquamarin (score.js)
// note() works on any BaseAudioContext (the game's, or an OfflineAudioContext in test/music.mjs) and returns how many
// oscillators and sources it started (the budget counts them).
// ============================================================================
(function (VR) {
  'use strict';
  const NOISE = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function noise(c) {
    let b = NOISE && NOISE.get(c); if (b) return b;
    b = c.createBuffer(1, Math.floor(c.sampleRate * 0.5), c.sampleRate); const d = b.getChannelData(0);
    let s = 0x2f6b1d; for (let i = 0; i < d.length; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; d[i] = s / 2147483648 - 1; }   // seeded: every start the same
    if (NOISE) NOISE.set(c, b); return b;
  }
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function env(g, t, a, peak, rel, end) {   // attack a, hold to end - rel, release (exponential)
    const p = g.gain; p.setValueAtTime(0.0001, t); p.linearRampToValueAtTime(peak, t + a);
    if (end - rel > t + a) p.setValueAtTime(peak, end - rel);
    p.exponentialRampToValueAtTime(0.0001, end);
  }
  function osc(c, type, f, t, end, det) { const o = c.createOscillator(); o.type = type; o.frequency.value = f; if (det) o.detune.value = det; o.start(t); o.stop(end + 0.05); return o; }
  // one note. ev: {midi, dur, inst, gain, tail?, tone?}; t: the start on the context's clock; dest: the cue's bus;
  // o: {lowEnd, rev, tier, lfo, chorus, room}. e-music2: tail — a long release after the note (the endings ring); tone —
  // the pads' and strings' filter × (a colour: Ocker's dusty dark); tier 3 (High): the cue's shared vibrato LFO (lfo, a
  // node in cents) on strings / pads / lead / reed, the chorus send, a warm third layer on pads and strings; tier ≥ 2
  // (Balanced+): the formant lead, the room send. Very Low (tier 0 / lowEnd) as before: one oscillator per voice.
  function note(c, dest, ev, t, o) {
    o = o || {};
    const tier = o.tier !== undefined ? o.tier : o.lowEnd ? 0 : 1, lo = !!o.lowEnd || tier === 0, hi = tier >= 3 && !lo;
    const d = Math.max(0.05, ev.dur), G = ev.gain, f = ev.midi ? hz(ev.midi) : 0, tl = ev.tail || 0, tone = ev.tone || 1;
    const g = c.createGain(); g.connect(dest);
    const lush = ev.inst === 'bell' || ev.inst === 'pad' || ev.inst === 'strings' || ev.inst === 'glass' || ev.inst === 'glasspad';
    if (o.rev && !lo && lush) g.connect(o.rev);
    if (o.room && tier >= 2 && !lo && (lush || ev.inst === 'pluck' || ev.inst === 'reed' || ev.inst === 'drop' || ev.inst === 'lead')) g.connect(o.room);
    if (o.chorus && hi && (ev.inst === 'pad' || ev.inst === 'strings' || ev.inst === 'glasspad')) g.connect(o.chorus);
    const vib = (x) => { if (hi && o.lfo) o.lfo.connect(x.detune); return x; };
    let n = 0, end;
    switch (ev.inst) {
      case 'pad': case 'glasspad': {
        const glass = ev.inst === 'glasspad';
        const rel = tl || Math.min(0.9, d * 0.3); end = t + d + (tl ? tl : rel * 0.8); env(g, t, Math.min(0.5, d * 0.25), G, rel, end);   // (it releases over the next chord's swell: no dip at the bar line)
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.min(glass ? 6000 : 2400, (glass ? f * 6 : f * 3 + 300) * tone); lp.Q.value = 0.5; lp.connect(g);
        for (const det of lo ? [0] : glass ? [-4, 1204] : [-7, 7]) { vib(osc(c, glass ? 'sine' : 'triangle', f, t, end, det)).connect(lp); n++; }
        if (hi && !glass) { const g3 = c.createGain(); g3.gain.value = 0.3; g3.connect(lp); vib(osc(c, 'sawtooth', f, t, end, -3)).connect(g3); n++; }   // the warm third: a soft saw
        break;
      }
      case 'strings': {
        const rel = tl || Math.min(0.6, d * 0.35); end = t + d + (tl ? tl : rel * 0.7); env(g, t, Math.min(0.18, d * 0.35), G, rel, end);
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.7;
        lp.frequency.setValueAtTime(f * 2.2 * tone, t); lp.frequency.linearRampToValueAtTime(Math.min(5000, f * 4 * tone), t + Math.min(0.4, d)); lp.connect(g);
        for (const det of lo ? [0] : [-9, 8]) { vib(osc(c, 'sawtooth', f, t, end, det)).connect(lp); n++; }
        if (hi) { const g3 = c.createGain(); g3.gain.value = 0.3; g3.connect(lp); vib(osc(c, 'triangle', f / 2, t, end, 2)).connect(g3); n++; }   // the warm third: the body an octave down
        break;
      }
      case 'pluck': case 'drop': {
        const drop = ev.inst === 'drop';
        end = t + (tl ? d + tl : Math.min(drop ? 0.5 : 1.6, d + (drop ? 0.1 : 0.35))); env(g, t, 0.006, G, tl ? end - t - 0.006 : Math.min(drop ? 0.45 : 1.4, d + 0.3), end);
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = drop ? 4 : 1.2;
        lp.frequency.setValueAtTime(Math.min(9000, f * 7), t); lp.frequency.exponentialRampToValueAtTime(Math.max(200, f * (drop ? 2.2 : 1.4)), t + (drop ? 0.12 : 0.22)); lp.connect(g);
        const x = osc(c, drop ? 'sine' : 'triangle', f, t, end); if (drop) { x.frequency.setValueAtTime(f * 1.5, t); x.frequency.exponentialRampToValueAtTime(f, t + 0.04); }   // a drop: the pitch falls into the note
        x.connect(lp); n++;
        break;
      }
      case 'bell': case 'glass': {
        const glass = ev.inst === 'glass';
        end = t + (tl ? Math.max(d + tl, 1.2) : Math.max(1.2, d * 1.6)); env(g, t, glass ? 0.002 : 0.004, G, tl ? end - t - 0.01 : Math.max(1.1, d * 1.5), end);
        osc(c, 'sine', f, t, end).connect(g); n++;
        const g2 = c.createGain(); g2.gain.setValueAtTime(glass ? 0.22 : 0.35, t); g2.gain.exponentialRampToValueAtTime(0.01, t + (glass ? 0.35 : 0.6)); g2.connect(g);
        osc(c, 'sine', f * (glass ? 4.07 : 2.76), t, Math.min(end, t + 0.7)).connect(g2); n++;   // glass: a high, pure partial
        break;
      }
      case 'bass': {
        end = t + d + (tl || 0.08); env(g, t, 0.012, G, tl || Math.min(0.25, d * 0.5), end);
        osc(c, 'sine', f, t, end).connect(g); n++;
        if (!lo) { const g2 = c.createGain(); g2.gain.value = 0.25; g2.connect(g); osc(c, 'triangle', f * 2, t, end).connect(g2); n++; }
        break;
      }
      case 'lead': {
        end = t + d + (tl || 0.1); env(g, t, 0.03, G, tl || Math.min(0.3, d * 0.4), end);
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.4;
        lp.frequency.setValueAtTime(f * 1.5, t); lp.frequency.linearRampToValueAtTime(f * 5, t + 0.07); lp.frequency.exponentialRampToValueAtTime(f * 2.4, t + Math.max(0.1, d));
        let out = lp;
        if (tier >= 2 && !lo) {   // the formants: two vocal bands (an open 'ah'), so the lead sings rather than buzzes
          const f1 = c.createBiquadFilter(); f1.type = 'peaking'; f1.frequency.value = 780; f1.Q.value = 2.2; f1.gain.value = 7;
          const f2 = c.createBiquadFilter(); f2.type = 'peaking'; f2.frequency.value = 1220; f2.Q.value = 2.6; f2.gain.value = 5;
          lp.connect(f1); f1.connect(f2); out = f2;
        }
        out.connect(g);
        vib(osc(c, 'sawtooth', f, t, end, 4)).connect(lp); n++;
        if (!lo) { const g2 = c.createGain(); g2.gain.value = 0.35; g2.connect(lp); osc(c, 'square', f / 2, t, end).connect(g2); n++; }
        break;
      }
      case 'reed': {   // e-music2 · Ocker's and the dry lands' dusty reed: a square through a nasal band, a breath of attack
        end = t + d + (tl || 0.12); env(g, t, 0.05, G, tl || Math.min(0.35, d * 0.4), end);
        const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = Math.min(3000, f * 3); bp.Q.value = 1.1;
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.min(2600, f * 5); lp.Q.value = 0.6;
        bp.connect(lp); lp.connect(g);
        vib(osc(c, 'square', f, t, end, -3)).connect(bp); n++;
        break;
      }
      case 'kick': {
        end = t + 0.32; const o2 = osc(c, 'sine', 110, t, end); o2.frequency.setValueAtTime(110, t); o2.frequency.exponentialRampToValueAtTime(42, t + 0.16); o2.connect(g); n++;
        g.gain.setValueAtTime(G, t); g.gain.exponentialRampToValueAtTime(0.0005, end);
        break;
      }
      case 'hat': case 'clap': {
        const hat = ev.inst === 'hat'; end = t + (hat ? 0.05 : 0.14);
        const s = c.createBufferSource(); s.buffer = noise(c);
        const fl = c.createBiquadFilter(); fl.type = hat ? 'highpass' : 'bandpass'; fl.frequency.value = hat ? 7000 : 1500; fl.Q.value = hat ? 0.7 : 0.8;
        s.connect(fl); fl.connect(g); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(G, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0005, end);
        s.start(t, ((t * 7) % 0.3 + 0.3) % 0.3, end - t + 0.02); n++;
        break;
      }
      default: end = t;
    }
    return { n, end };
  }
  // the cost of a note in voices (the budget's unit) without building it (tier 3: the warm third on pads and strings)
  const VOICES = { pad: 2, strings: 2, pluck: 1, bell: 2, bass: 2, lead: 2, kick: 1, hat: 1, clap: 1, glass: 2, glasspad: 2, reed: 1, drop: 1 };
  const voicesOf = (inst, lowEnd, tier) => (lowEnd && (inst === 'pad' || inst === 'strings' || inst === 'bass' || inst === 'lead' || inst === 'glasspad') ? 1 : tier >= 3 && (inst === 'pad' || inst === 'strings') ? 3 : VOICES[inst] || 1);
  VR.ScoreSynth = { note, noise, hz, VOICES, voicesOf };
})(VR);

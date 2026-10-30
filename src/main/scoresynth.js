// ============================================================================
// e-music · VR.ScoreSynth — the score's little synth: every instrument is oscillators, noise and filters (no samples).
//   pad      two detuned triangles through a soft lowpass, a slow swell in and out           (Very Low: one triangle)
//   strings  two detuned saws through a lowpass that opens a little, a bowed attack           (Very Low: one saw)
//   pluck    a triangle through a lowpass that closes fast (the pluck), a short ring
//   bell     a sine and its inharmonic partial (×2.76, the bell's tierce-ish colour), a long ring
//   bass     a sine with a little triangle on top
//   lead     a saw and a square an octave down through a brassy filter swell              (Very Low: the saw)
//   kick / hat / clap   a falling sine; a high-passed noise tick; a band of noise
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
  // one note. ev: {midi, dur, inst, gain}; t: the start on the context's clock; dest: the cue's bus; o: {lowEnd, rev}
  function note(c, dest, ev, t, o) {
    o = o || {};
    const lo = !!o.lowEnd, d = Math.max(0.05, ev.dur), G = ev.gain, f = ev.midi ? hz(ev.midi) : 0;
    const g = c.createGain(); g.connect(dest); if (o.rev && !lo && (ev.inst === 'bell' || ev.inst === 'pad' || ev.inst === 'strings')) g.connect(o.rev);
    let n = 0, end;
    switch (ev.inst) {
      case 'pad': {
        end = t + d + 0.4; env(g, t, Math.min(0.6, d * 0.3), G, Math.min(1.2, d * 0.4), end);
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.min(2400, f * 3 + 300); lp.Q.value = 0.5; lp.connect(g);
        for (const det of lo ? [0] : [-7, 7]) { osc(c, 'triangle', f, t, end, det).connect(lp); n++; }
        break;
      }
      case 'strings': {
        end = t + d + 0.25; env(g, t, Math.min(0.18, d * 0.35), G, Math.min(0.5, d * 0.4), end);
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.7;
        lp.frequency.setValueAtTime(f * 2.2, t); lp.frequency.linearRampToValueAtTime(Math.min(5000, f * 4), t + Math.min(0.4, d)); lp.connect(g);
        for (const det of lo ? [0] : [-9, 8]) { osc(c, 'sawtooth', f, t, end, det).connect(lp); n++; }
        break;
      }
      case 'pluck': {
        end = t + Math.min(1.6, d + 0.35); env(g, t, 0.006, G, Math.min(1.4, d + 0.3), end);
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.2;
        lp.frequency.setValueAtTime(Math.min(9000, f * 7), t); lp.frequency.exponentialRampToValueAtTime(Math.max(200, f * 1.4), t + 0.22); lp.connect(g);
        osc(c, 'triangle', f, t, end).connect(lp); n++;
        break;
      }
      case 'bell': {
        end = t + Math.max(1.2, d * 1.6); env(g, t, 0.004, G, Math.max(1.1, d * 1.5), end);
        osc(c, 'sine', f, t, end).connect(g); n++;
        const g2 = c.createGain(); g2.gain.setValueAtTime(0.35, t); g2.gain.exponentialRampToValueAtTime(0.01, t + 0.6); g2.connect(g);
        osc(c, 'sine', f * 2.76, t, Math.min(end, t + 0.7)).connect(g2); n++;
        break;
      }
      case 'bass': {
        end = t + d + 0.08; env(g, t, 0.012, G, Math.min(0.25, d * 0.5), end);
        osc(c, 'sine', f, t, end).connect(g); n++;
        if (!lo) { const g2 = c.createGain(); g2.gain.value = 0.25; g2.connect(g); osc(c, 'triangle', f * 2, t, end).connect(g2); n++; }
        break;
      }
      case 'lead': {
        end = t + d + 0.1; env(g, t, 0.03, G, Math.min(0.3, d * 0.4), end);
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.4;
        lp.frequency.setValueAtTime(f * 1.5, t); lp.frequency.linearRampToValueAtTime(f * 5, t + 0.07); lp.frequency.exponentialRampToValueAtTime(f * 2.4, t + Math.max(0.1, d)); lp.connect(g);
        osc(c, 'sawtooth', f, t, end, 4).connect(lp); n++;
        if (!lo) { const g2 = c.createGain(); g2.gain.value = 0.35; g2.connect(lp); osc(c, 'square', f / 2, t, end).connect(g2); n++; }
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
  // the cost of a note in voices (the budget's unit) without building it
  const VOICES = { pad: 2, strings: 2, pluck: 1, bell: 2, bass: 2, lead: 2, kick: 1, hat: 1, clap: 1 };
  const voicesOf = (inst, lowEnd) => (lowEnd && (inst === 'pad' || inst === 'strings' || inst === 'bass' || inst === 'lead') ? 1 : VOICES[inst] || 1);
  VR.ScoreSynth = { note, noise, hz, VOICES, voicesOf };
})(VR);

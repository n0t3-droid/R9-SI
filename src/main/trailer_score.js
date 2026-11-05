// ============================================================================
// 🎵 f-film2 · VR.TrailerScore — the 'welt' trailer's music (docs/superpowers/plans/2026-11-05-f-film2.md): the game's own
// score (score.js's themes, played by scoresynth.js through audio.js's music chain) arranged on the film's clock. No
// sample, no other music: Heimat's tune, the Staunen sting and Heimat's outro, re-timed.
//   open    0 → the isles' reveal: Heimat's first seven bars at its quiet level (pad, bass, the plucked tune)
//   reveal  the Staunen sting, slowed to a majestic swell (strings, the bell climb through two octaves, the held top),
//           then Heimat's climax (bars 5–8) at level 1 — the strings and the bells join
//   outro   Heimat's outro: IV → I, the tonic landing just after the title appears, ringing out to the black
// parts(shots) → [{name, at, evs}] (the notes' t from the part's start); events(shots) → every note on the film's clock;
// envelope(shots) → the music bus's [t, gain] points (from silence, the swell at the reveal, back to silence).
// Offline (test/trailer_video.mjs): renderOffline(shots) — an OfflineAudioContext in the page, audio.js's chain, 16-bit
// stereo PCM. Live (trailer_welt.js): each part starts when its shot really starts (loading between the shots takes
// real time in a game), the score's director held while the film plays.
// Cost 🟢: nothing unless the trailer plays; Very Low plays it with audio.js's own low-end voices.
// ============================================================================
(function (VR) {
  'use strict';
  const TS = VR.TrailerScore = VR.TrailerScore || {};
  TS.ROOT = 62;                        // D major: warm, bright, in the strings' and the bell's best range
  TS.PLAN = { root: TS.ROOT, mode: 'major' };
  const BEAT = 60 / 84;                // Heimat's beat
  // the film's marks: the reveal (the isles shot), the title, the end
  TS.marks = function (shots) {
    let t = 0, reveal = -1, title = -1;
    for (const s of shots) { if (s.name === 'inseln' && reveal < 0) reveal = t; if (s.name === 'titel' && title < 0) title = t; t += s.dur; }
    const total = t;
    if (reveal < 0) reveal = total * 0.42;
    if (title < 0) title = Math.max(reveal + 8, total - 5);
    return { reveal, title, total };
  };
  // a theme's events re-timed: those of bars [b0, b1) (the plain form A: bars 0–7, then the outro's bar 8), moved to
  // start at 0 and scaled by k
  function take(id, o, b0, b1, k) {
    const SC = VR.Score, B = 60 / (SC.THEMES[id].bpm), all = SC.events(id, Object.assign({ plan: TS.PLAN, seed: 0 }, o));
    const L = all.filter((e) => e.t / B >= b0 * 4 - 1e-6 && e.t / B < b1 * 4 - 1e-6), t0 = b0 * 4 * B;
    return L.map((e) => Object.assign({}, e, { t: (e.t - t0) * k, dur: e.dur * k, tail: e.tail }));
  }
  TS.parts = function (shots) {
    const M = TS.marks(shots), SC = VR.Score; if (!SC) return [];
    const k = M.reveal / (7 * 4 * BEAT), beat = BEAT * k;                      // Heimat's tempo: seven bars to the reveal
    const outAt = M.title + 0.45 - 2 * beat;                                    // the outro's I lands 0.45 s into the title
    const climax = 4 * 4 * beat;                                               // Heimat's bars 5–8 before the outro
    const climAt = outAt - climax, stingLen = Math.max(4, climAt - M.reveal);
    const kW = stingLen / (3 * 4 * 60 / SC.THEMES.wonder.bpm);                  // the sting stretched to fill the gap
    const open = take('home', { lv: 0, variant: 'day' }, 0, 7, k).map((e) => (e.t + e.dur > M.reveal + 0.4 ? Object.assign(e, { dur: Math.max(0.1, M.reveal + 0.4 - e.t) }) : e)).map((e) => Object.assign(e, { gain: e.gain * 0.9 }));
    const sting = take('wonder', { lv: 1 }, 0, 3, kW).map((e) => Object.assign(e, { gain: e.gain * 1.8 }));
    // (the swell: the sting's string chords doubled by Heimat's warm pad)
    for (const e of sting.slice()) if (e.layer === 'str') sting.push(Object.assign({}, e, { inst: 'pad', layer: 'swell', gain: e.gain * 0.9 }));
    const clim = take('home', { lv: 1, variant: 'day' }, 4, 8, k).map((e) => Object.assign(e, { t: e.t + (climAt - M.reveal), gain: e.gain * 1.1 }));
    const out = take('home', { lv: 1, variant: 'day' }, 8, 9, k).map((e) => Object.assign(e, { tail: Math.max(e.tail || 0, 3.2) }));
    // nothing new after the title's first moment: the outro's last chord rings (tail) into the black
    const lastB = Math.max(...out.map((e) => e.t));
    for (const e of out) if (e.t >= lastB - 1e-6) { e.dur = Math.max(e.dur, M.total - 2.0 - outAt - e.t); e.tail = Math.max(e.tail || 0, 2.4); }   // (held under the title, then the release into the black)
    return [{ name: 'open', at: 0, evs: open }, { name: 'reveal', at: M.reveal, evs: sting.concat(clim).sort((a, b) => a.t - b.t) }, { name: 'outro', at: outAt, evs: out }];
  };
  TS.events = function (shots) {
    const M = TS.marks(shots), out = [];
    for (const p of TS.parts(shots)) for (const e of p.evs) { const t = p.at + e.t; if (t >= 0 && t < M.total) out.push(Object.assign({}, e, { t, dur: Math.max(0.05, Math.min(e.dur, M.total - t)) })); }
    return out.sort((a, b) => a.t - b.t);
  };
  TS.envelope = function (shots) {
    const M = TS.marks(shots);
    return [[0, 0.0001], [1.2, 0.78], [Math.max(1.3, M.reveal - 1.5), 0.78], [Math.max(1.4, M.reveal - 0.1), 0.62], [M.reveal + 1.6, 1], [M.total - 1.4, 1], [M.total, 0.0001]];   // (a breath in before the reveal, the swell)
  };
  // the notes on an audio.js Audio (live or offline): a run of its own (its bus with the envelope from `at`), handed to
  // audio.js's pump. env: [[t, g]…] from the run's start, or null (the bus at 1)
  TS.run = function (a, evs, at, env, o) {
    const c = a.ctx, bus = c.createGain();
    if (env) { bus.gain.setValueAtTime(env[0][1], at); for (let i = 1; i < env.length; i++) bus.gain.linearRampToValueAtTime(env[i][1], at + env[i][0]); } else bus.gain.value = 1;
    bus.connect(a.musTalk || a.mus || a.master);
    let wet = null, lfo = null;
    if (a.roomIn) { wet = c.createGain(); wet.gain.value = 1; wet.connect(a.roomIn); }
    if (a.tier >= 3 && !a.lowEnd) { const os = c.createOscillator(); os.type = 'sine'; os.frequency.value = 5.1; lfo = c.createGain(); lfo.gain.value = 7; os.connect(lfo); os.start(at); os.stop(at + (o && o.len || 60) + 6); }
    return { id: 'trailer', evs, i: 0, t0: at, stopAt: at + (o && o.len || 60), bus, wet, lfo, cho: a.choIn || null, trailer: true };
  };
  // the whole film's music rendered offline in the page: { sr, len, peak, notes, b64 } — 16-bit stereo, normalised to
  // −1.5 dBFS (the AAC encoder's headroom)
  TS.renderOffline = async function (shots, o) {
    o = o || {};
    const M = TS.marks(shots), SR = o.sr || 44100, len = Math.ceil(M.total * SR);
    const c = new OfflineAudioContext(2, len, SR);
    const a = new VR.Audio(); a.init(c); a.setVolumes({ master: 1, music: 1 }); if (a.setTier) a.setTier(o.tier === undefined ? 3 : o.tier);
    if (a.roomOut) a.roomOut.gain.value = 0.2;
    a.musCap = () => 64;   // (offline: every voice — no live budget to keep)
    const evs = TS.events(shots), r = TS.run(a, evs, 0, TS.envelope(shots), { len: M.total + 1 });
    a.pump(r, 0, Infinity);
    const buf = await c.startRendering(), L = buf.getChannelData(0), R = buf.getChannelData(1);
    let peak = 0; for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
    const k = peak > 0 ? Math.pow(10, -1.5 / 20) / peak : 1, i16 = new Int16Array(L.length * 2);
    for (let i = 0; i < L.length; i++) { i16[2 * i] = Math.round(Math.max(-1, Math.min(1, L[i] * k)) * 32767); i16[2 * i + 1] = Math.round(Math.max(-1, Math.min(1, R[i] * k)) * 32767); }
    let s = ''; const u8 = new Uint8Array(i16.buffer); for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return { sr: SR, len: L.length, peak, gainK: k, notes: a.noteCount, evs: evs.length, b64: btoa(s) };
  };
  // live: the part that belongs to this shot starts now (the open with the first shot, the reveal with the isles, the
  // outro just before the title appears) — the director held, the cue before faded out
  TS.live = null;
  TS.onShot = function (g, shots, si) {
    try {
      const a = g && g.audio; if (!a || !a.ctx || !a.score || !(a.vol && a.vol.music > 0) || !VR.Score) return false;
      const M = TS.marks(shots), P = TS.parts(shots), now = a.ctx.currentTime;
      let t = 0; for (let i = 0; i < si; i++) t += shots[i].dur;
      const s = shots[si], name = si === 0 ? 'open' : s && s.name === 'inseln' ? 'reveal' : s && s.name === 'titel' ? 'outro' : null;
      if (!name) return false;
      const p = P.find((q) => q.name === name); if (!p) return false;
      const lead = name === 'outro' ? Math.max(0, t - p.at) : 0;   // (the outro starts a beat before the title: late by that much here)
      a.score.event('hold', now, now + M.total + 6);
      if (a.run) { a.run.bus.gain.setTargetAtTime(0.0001, now, 0.25); if (a.run.wet) a.run.wet.gain.setTargetAtTime(0.0001, now, 0.4); a.run.stopAt = Math.min(a.run.stopAt, now + 0.05); }
      const at = now + 0.05, evs = p.evs.map((e) => Object.assign({}, e, { t: Math.max(0, e.t - lead) })), end = Math.max(...evs.map((e) => e.t + e.dur + (e.tail || 0)));
      const env = name === 'open' ? [[0, 0.0001], [1.2, 0.78]] : name === 'reveal' ? [[0, 0.78], [1.4, 1]] : null;
      a.run = TS.run(a, evs, at, env, { len: end + 0.5 }); TS.live = a.run;
      return true;
    } catch (e) { return false; }   // (the music never breaks the film)
  };
  TS.stopLive = function (g) {
    const a = g && g.audio, r = TS.live; TS.live = null; if (!a || !a.ctx || !r) return;
    try { const now = a.ctx.currentTime; r.bus.gain.setTargetAtTime(0.0001, now, 0.4); if (r.wet) r.wet.gain.setTargetAtTime(0.0001, now, 0.5); r.stopAt = Math.min(r.stopAt, now + 0.05); if (a.score) a.score.event('hold', now, now + 1.5); } catch (e) { /* */ }
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

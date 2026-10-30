// ============================================================================
// e-music · VR.Score — the adaptive score, the pure part (docs/superpowers/plans/2026-10-30-e-music.md). No AudioContext
// in here: scoresynth.js plays the events, audio.js runs the director on the audio clock, test/score.js checks it all.
//   · THEMES: our own compositions as note data — Heimat (Heartland, home: warm, strings and plucks), Weite (space:
//     lydian bells over a slow pad), Aufbruch (adventure: dorian ostinato, a brassy lead, drums at level 1+), Staunen
//     (the wonder sting: a lydian bell climb to a held top), Funke's little leitmotif (a skipping pluck figure). Written
//     in scale degrees and transposed into the day's key (VR.Klang.musicPlan), so every day sounds a little different
//     and the swell (klang.js swellPlan) and the calm wander layer sit in the same key.
//   · the note grammar: bars split by '|' (only checked), tokens '<degree>[:<beats>]', 'r[:<beats>]' a rest, degrees
//     of a chord joined by '.', default length one beat. Degree 0 is the key's root; 7 is its octave.
//   · Director: which cue plays when — by context (time of day, cave, building calm, danger, outposts, the boss's
//     phases, flight regimes, story scenes, the freeing moment), with quiet stretches between cues (rest = a share of
//     the cue's length, longer at night, while building, with 'Ruhige Musik'), stings that interrupt with a fade, never
//     two cues at once, and the duck under dialogue. Seeded by the day: the same day plays the same score.
// ============================================================================
(function (VR) {
  'use strict';
  const MODES = {
    major: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10],
  };
  // the layers: kind 'line' (a written line), 'chord' (the bar's triad held), 'bass' (the chord's root on a pattern),
  // 'arp' (the triad broken in eighths), 'osti' (a chord-relative ostinato in eighths), 'drum' (a pattern of eight slots per
  // bar: x a hit, . nothing). lv: the lowest intensity level that plays the layer; pri: 3 the tune … 1 ornament (the
  // first dropped when the voices are full); act: the action bus (not ducked by a lone hostile mob)
  const THEMES = {
    // Heimat — the warm main theme: a rising sixth, a step back, the long sigh; I IV I vi | I vi IV-V I
    home: {
      bpm: 84, mode: 'major', minorMode: 'dorian', len: 8,
      chords: '0:4 | 3:4 | 0:4 | 5:4 | 0:4 | 5:4 | 3:2 4:2 | 0:4',
      layers: [
        { id: 'pad', kind: 'chord', inst: 'pad', oct: -12, gain: 0.05, lv: 0, pri: 2 },
        { id: 'bass', kind: 'bass', inst: 'bass', oct: -24, gain: 0.08, lv: 0, pri: 2, pat: [0, 2], plen: 2 },
        { id: 'mel', kind: 'line', inst: 'pluck', oct: 0, gain: 0.075, lv: 0, pri: 3,
          notes: '2 4 7:2 | 6 5:.5 4:.5 5:2 | 4 2 3 4 | 2:3 r | 2 4 7:1.5 8:.5 | 9:2 8 7 | 5 7 6 4 | 7:4' },
        { id: 'str', kind: 'line', inst: 'strings', oct: -12, gain: 0.04, lv: 1, pri: 2,
          notes: '4:4 | 5:2 7:2 | 4:2 7:2 | 7:4 | 4:4 | 5:2 4:2 | 3:2 1:2 | 2:4' },
        { id: 'bell', kind: 'line', inst: 'bell', oct: 12, gain: 0.03, lv: 1, pri: 1,
          notes: 'r:3 4 | r:4 | r:3 2 | r:4 | r:3 4 | r:4 | r:4 | 0:4' },
      ],
    },
    // Weite — the space theme: slow, lydian (the raised fourth: I and II major side by side), bells over a pad
    space: {
      bpm: 58, mode: 'lydian', len: 8,
      chords: '0:4 | 1:4 | 0:4 | 1:4 | 5:4 | 1:4 | 4:4 | 0:4',
      layers: [
        { id: 'pad', kind: 'chord', inst: 'pad', oct: -12, gain: 0.05, lv: 0, pri: 2 },
        { id: 'mel', kind: 'line', inst: 'bell', oct: 0, gain: 0.06, lv: 0, pri: 3,
          notes: '0 4 9:2 | 8 5 3:2 | 0 4 9 11 | 10:4 | 5 9 12:2 | 10:2 8:2 | 6 4 1:2 | 4:4' },
        { id: 'bass', kind: 'bass', inst: 'bass', oct: -24, gain: 0.06, lv: 1, pri: 2, pat: [0], plen: 4 },
        { id: 'arp', kind: 'arp', inst: 'pluck', oct: 12, gain: 0.018, lv: 1, pri: 1 },
      ],
    },
    // Aufbruch — the adventure motif: a dorian call (root, fifth held, the climb to the octave), a driving ostinato
    adventure: {
      bpm: 116, mode: 'dorian', len: 8,
      chords: '0:4 | 3:4 | 6:4 | 0:4 | 0:4 | 3:4 | 6:2 4:2 | 0:4',
      layers: [
        { id: 'osti', kind: 'osti', inst: 'strings', oct: -12, gain: 0.045, lv: 0, pri: 2, pat: [0, 0, 4, 0, 2, 0, 4, 2] },
        { id: 'mel', kind: 'line', inst: 'lead', oct: 0, gain: 0.06, lv: 0, pri: 3,
          notes: '0:1.5 4:.5 4:2 | 3 4 5 7 | 6:1.5 5:.5 4:2 | 2 3 4:2 | 7:1.5 6:.5 5 4 | 5 6 7:2 | 10 8 6 4 | 4:4' },
        { id: 'bass', kind: 'bass', inst: 'bass', oct: -24, gain: 0.08, lv: 0, pri: 2, pat: [0, 1.5, 2, 3.5], plen: 0.5 },
        { id: 'kick', kind: 'drum', inst: 'kick', gain: 0.22, lv: 1, pri: 2, hits: 'x...x.x.' },
        { id: 'hat', kind: 'drum', inst: 'hat', gain: 0.05, lv: 1, pri: 1, hits: '.x.x.x.x' },
        { id: 'clap', kind: 'drum', inst: 'clap', gain: 0.07, lv: 2, pri: 1, hits: '..x...x.' },
        { id: 'pad', kind: 'chord', inst: 'pad', oct: -12, gain: 0.035, lv: 2, pri: 1 },
      ],
    },
    // Staunen — the wonder sting: vi → II → I in lydian, a bell climb through two octaves, the top held
    wonder: {
      bpm: 88, mode: 'lydian', len: 3, sting: true,
      chords: '5:4 | 1:4 | 0:4',
      layers: [
        { id: 'str', kind: 'chord', inst: 'strings', oct: -12, gain: 0.04, lv: 0, pri: 2 },
        { id: 'mel', kind: 'line', inst: 'bell', oct: 0, gain: 0.06, lv: 0, pri: 3,
          notes: '0:.5 2:.5 4:.5 7:.5 9:.5 11:.5 12:.5 14:.5 | 13:2 10:2 | 14:4' },
        { id: 'bass', kind: 'bass', inst: 'bass', oct: -24, gain: 0.06, lv: 0, pri: 2, pat: [0], plen: 4 },
      ],
    },
    // Funke — the companion's leitmotif: a skip up, a turn, a hop to the octave (bright plucks and one bell)
    funke: {
      bpm: 132, mode: 'major', len: 2, sting: true,
      chords: '0:4 | 0:4',
      layers: [
        { id: 'mel', kind: 'line', inst: 'pluck', oct: 12, gain: 0.06, lv: 0, pri: 3, notes: '4:.5 7:.5 9:.5 8:.5 7 11 | 9:.5 11:.5 14:2 r' },
        { id: 'bell', kind: 'line', inst: 'bell', oct: 12, gain: 0.03, lv: 0, pri: 1, notes: 'r:4 | r 14:3' },
        { id: 'pad', kind: 'chord', inst: 'pad', oct: -12, gain: 0.03, lv: 0, pri: 1 },
      ],
    },
  };
  // the variants: a theme told another way (tempo factor, the level, instruments swapped, the gain)
  const VARIANTS = {
    day: {},
    night: { bpm: 0.8, lv: 0, inst: { mel: 'bell' }, gain: 0.8 },
    build: { bpm: 0.92, lv: 0, gain: 0.7 },
    story: { bpm: 0.9, lv: 1, inst: { mel: 'strings' }, gain: 0.9 },
    bright: { lv: 1, gain: 1 },
    cave: { bpm: 0.75, lv: 0, gain: 0.6 },
    tense: { bpm: 0.92, lv: 0, gain: 0.75 },
    fight: { lv: 1 },
    boss: { lv: 1 },
    boss2: { lv: 2 },
    boss3: { lv: 2, bpm: 1.1 },
    map: { lv: 0, gain: 0.8 },
    cruise: { lv: 1 },
  };

  // ---- the note grammar
  function parseLine(s) {
    const out = []; let beat = 0, bars = [0];
    for (const bar of String(s).split('|')) {
      let b0 = beat;
      for (const tok of bar.trim().split(/\s+/)) {
        if (!tok) continue;
        const [d, l] = tok.split(':'); const len = l === undefined ? 1 : +l;
        if (!(len > 0)) throw new Error('bad length in ' + tok);
        if (d !== 'r') out.push({ b: beat, len, degs: d.split('.').map(Number) });
        beat += len;
      }
      bars.push(beat - b0);
    }
    return { notes: out, beats: beat, barBeats: bars.slice(1) };
  }
  // the MIDI note of a scale degree over a root in a mode (degrees may be negative or above an octave)
  function degMidi(root, mode, d) { const s = MODES[mode] || MODES.major, n = s.length, k = ((d % n) + n) % n; return root + s[k] + 12 * Math.floor(d / n); }
  // the key of a day: the theme's root in G3 … F♯4 from the day's plan, the home theme in dorian on a minor day
  function keyOf(id, plan) {
    const th = THEMES[id], r = plan ? plan.root : 60;
    const root = 55 + ((((r - 55) % 12) + 12) % 12);
    const mode = th && th.minorMode && plan && plan.mode === 'minor' ? th.minorMode : th ? th.mode : 'major';
    return { root, mode };
  }
  const beatLen = (id, variant) => 60 / (THEMES[id].bpm * ((VARIANTS[variant] && VARIANTS[variant].bpm) || 1));
  // a cue's length in seconds (the wander layer: 8 bars of the day's plan at its own beat)
  function cueLen(id, variant) {
    if (id === 'wander') return 8 * 4 * WANDER_BEAT[variant === 'night' ? 'night' : variant === 'cave' ? 'cave' : 'day'];
    const th = THEMES[id]; return th ? th.len * 4 * beatLen(id, variant) : 0;
  }
  const WANDER_BEAT = { day: 0.56, night: 0.7, cave: 0.8 };

  // the events of a cue: {t (s from the cue's start), dur, midi (0 for a drum), inst, gain, pri, act, layer}. lv: the
  // intensity (0 … 2); plan: the day's plan (the key); calm: 'Ruhige Musik' (no drums, the level capped at 1)
  function events(id, o) {
    o = o || {};
    if (id === 'wander') return wanderEvents(o.plan || (VR.Klang && VR.Klang.musicPlan(0)), o.variant, o.seed);
    const th = THEMES[id]; if (!th) return [];
    const V = VARIANTS[o.variant] || {}, B = beatLen(id, o.variant), key = keyOf(id, o.plan);
    let lv = o.lv !== undefined ? o.lv : V.lv !== undefined ? V.lv : 0; if (o.calm) lv = Math.min(lv, 1);
    const G = (V.gain || 1) * (o.calm ? 0.8 : 1), out = [];
    const ch = parseLine(th.chords).notes;   // the chords: a degree with its span
    const chordAt = (b) => { for (const c of ch) if (b >= c.b - 1e-6 && b < c.b + c.len - 1e-6) return c; return ch[ch.length - 1]; };
    const total = th.len * 4;
    for (const L of th.layers) {
      if (L.lv > lv) continue;
      if (o.calm && L.kind === 'drum') continue;
      if (o.lowEnd && L.pri < 2 && L.kind !== 'line') continue;   // Very Low: no ornament layers
      const inst = (V.inst && V.inst[L.id]) || L.inst, gain = L.gain * G, act = id === 'adventure';
      const push = (b, len, midi, g2) => out.push({ t: b * B, dur: len * B, midi, inst, gain: g2 === undefined ? gain : g2, pri: L.pri, act, layer: L.id });
      if (L.kind === 'line') for (const n of parseLine(L.notes).notes) for (const d of n.degs) push(n.b, n.len, degMidi(key.root, key.mode, d) + (L.oct || 0));
      else if (L.kind === 'chord') for (const c of ch) for (const d of [0, 2, 4]) push(c.b, c.len * 1.04, degMidi(key.root, key.mode, c.degs[0] + d) + (L.oct || 0), gain * (d ? 0.8 : 1));
      else if (L.kind === 'bass') for (let b = 0; b < total; b += 4) for (const p of L.pat) { const c = chordAt(b + p); push(b + p, L.plen, degMidi(key.root, key.mode, c.degs[0]) + (L.oct || 0)); }
      else if (L.kind === 'arp') for (let b = 0; b < total; b += 0.5) { const c = chordAt(b), k = Math.round(b * 2) % 4; push(b, 0.9, degMidi(key.root, key.mode, c.degs[0] + [0, 2, 4, 2][k]) + (L.oct || 0)); }
      else if (L.kind === 'osti') for (let b = 0; b < total; b += 0.5) { const c = chordAt(b), k = Math.round(b * 2) % 8; push(b, 0.45, degMidi(key.root, key.mode, c.degs[0] + L.pat[k]) + (L.oct || 0)); }
      else if (L.kind === 'drum') for (let b = 0; b < total; b += 0.5) { const k = Math.round(b * 2) % 8; if (L.hits[k] === 'x') push(b, 0.4, 0); }
    }
    out.sort((a, b) => a.t - b.t || b.pri - a.pri);
    return out;
  }
  // the wander layer: the old calm generative music (eight bars of the day's pentatonic plan: pad, bass, a motif in
  // plucks, varied by the seed), so the days between the themes never repeat
  function wanderEvents(plan, variant, seed) {
    const K = VR.Klang, r = K.rng((seed >>> 0) || (K.seedOf(plan.day) ^ 0x51ed)), out = [];
    const beat = WANDER_BEAT[variant === 'night' ? 'night' : variant === 'cave' ? 'cave' : 'day'], bar = beat * 4;
    const density = variant === 'cave' ? 0.25 : variant === 'night' ? 0.4 : 0.6, padG = variant === 'cave' ? 0.03 : 0.045;
    for (let k = 0; k < 8; k++) {
      const t0 = k * bar, ch = plan.prog[k % plan.prog.length];
      for (const d of [ch, ch + 2, ch + 4]) out.push({ t: t0, dur: bar * 1.05, midi: K.degreeMidi(plan, d) - 12, inst: 'pad', gain: padG, pri: 2, act: false, layer: 'pad' });
      out.push({ t: t0, dur: beat * 2, midi: K.degreeMidi(plan, ch) - 24, inst: 'bass', gain: 0.07, pri: 2, act: false, layer: 'bass' });
      out.push({ t: t0 + beat * 2, dur: beat * 2, midi: K.degreeMidi(plan, ch) - 24, inst: 'bass', gain: 0.05, pri: 2, act: false, layer: 'bass' });
      for (let i = 0; i < 4; i++) {
        if (r() > density) continue;
        let d = plan.motif[(k * 2 + i) % plan.motif.length]; if (r() < 0.2) d += 1;
        out.push({ t: t0 + i * beat, dur: beat * 1.6, midi: K.degreeMidi(plan, d) + 12, inst: variant === 'night' ? 'bell' : 'pluck', gain: 0.05, pri: 3, act: false, layer: 'mel' });
      }
    }
    return out;
  }
  // the pitch classes a cue may use (the tests: every note in its key)
  function scaleOf(id, plan) {
    if (id === 'wander') return new Set(VR.Klang.SCALE[plan.mode].map(s => (plan.root + s) % 12));
    const k = keyOf(id, plan); return new Set(MODES[k.mode].map(s => (k.root + s) % 12));
  }

  // ---------------------------------------------------------------- the director
  // c (the context, numbers and flags): night 0…1, cave, building, danger (a raid or a machine on you), outpost (near
  // an unfreed one), boss (0, or the phase 1 … 3), space ('map' | 'cruise' | 'orbit' | ''), story, dialogue, hostile (a
  // lone hostile mob near: the calm layers duck), festival (audio.js plays the village band itself)
  const FADE = 2.0, STING_FADE = 1.2;
  const REST = { day: 0.75, night: 1.0, build: 1.2, cave: 1.5, space: 1.0, story: 0.5, wander: 0.8 };
  const GAP = { wonder: 60, funke: 180 };   // a sting at most once in this many seconds
  class Director {
    constructor(o) {
      o = o || {};
      this.seed = (o.seed >>> 0) || 1; this.r = VR.Klang.rng(this.seed); this.calm = !!o.calm;
      this.cue = null;           // {id, variant, lv, t0, t1, fading, sting}
      this.restUntil = 0; this.queue = []; this.lastSting = {}; this.rot = 0; this.after = null; this.loops = 0;
      this.duckT = 1; this.log = [];   // the cues played: {id, variant, lv, t0, t1} (the tests; the overlay; kept short)
    }
    reseed(seed) { this.seed = seed >>> 0 || 1; this.r = VR.Klang.rng(this.seed); }
    // the cue the context wants: {id, variant, lv, urgent}
    want(c) {
      const calm = this.calm;
      if (c.boss > 0) return { id: 'adventure', variant: c.boss >= 3 ? 'boss3' : c.boss === 2 ? 'boss2' : 'boss', lv: calm ? 1 : c.boss >= 2 ? 2 : 1, urgent: true };
      if (c.danger) return { id: 'adventure', variant: 'fight', lv: 1, urgent: true };
      if (c.festival) return { id: 'festival', urgent: false };
      if (c.space) return { id: 'space', variant: c.space === 'map' ? 'map' : 'cruise', lv: c.space === 'map' ? 0 : 1, urgent: true };
      if (c.outpost) return { id: 'adventure', variant: 'tense', lv: 0, urgent: false };
      if (c.story) return { id: 'home', variant: 'story', lv: 1, urgent: false };
      if (c.cave) return { id: 'wander', variant: 'cave', urgent: false };
      const v = c.building ? 'build' : c.night > 0.5 ? 'night' : 'day';
      // the day's rotation: the theme, then the wander layer twice (the theme stays special)
      const id = this.rot % 3 === 0 ? 'home' : 'wander';
      return { id, variant: v, lv: v === 'day' && id === 'home' ? 1 : 0, urgent: false };
    }
    restFor(cue, c) {
      const len = cue.t1 - cue.t0;
      if (cue.id === 'adventure' && (c.danger || c.boss > 0)) return ++this.loops % 3 === 0 ? 4 : 0.5;   // the fight: looped, a breath now and then
      this.loops = 0;
      const k = c.space ? REST.space : c.cave ? REST.cave : c.story ? REST.story : c.building ? REST.build : c.night > 0.5 ? REST.night : cue.id === 'wander' ? REST.wander : REST.day;
      const jit = 0.8 + 0.4 * this.r();
      return Math.max(cue.sting ? 6 : 12, len * k * jit) * (this.calm ? 1.7 : 1);
    }
    // a moment: 'wonder' (a vista, a discovery, a first visit), 'funke' (the companion arrives), 'freeing' (an outpost
    // freed: the swell is heard, then the home theme bright), 'hold' (a swell plays: the director waits until `until`)
    event(name, now, until) {
      if (name === 'hold' || name === 'freeing') {
        this.restUntil = Math.max(this.restUntil, until || now + 4);
        if (this.cue && !this.cue.fading) this.fade(now, STING_FADE);
        if (name === 'freeing') this.after = { id: 'home', variant: 'bright', lv: 1 };
        return true;
      }
      if (!THEMES[name] || !THEMES[name].sting) return false;
      if (now - (this.lastSting[name] === undefined ? -1e9 : this.lastSting[name]) < GAP[name]) return false;
      if (this.calm && name === 'funke') return false;
      if (this.cue && this.cue.id === 'adventure' && !this.cue.fading) return false;   // no sting in a fight
      this.lastSting[name] = now;
      this.queue.length = 0; this.queue.push(name);
      if (this.cue && !this.cue.fading && !this.cue.sting) this.fade(now, STING_FADE);
      return true;
    }
    fade(now, len) {
      const cu = this.cue; cu.fading = true; cu.t1 = Math.min(cu.t1, now + len);
      const lg = this.log[this.log.length - 1]; if (lg && lg.t0 === cu.t0) lg.t1 = cu.t1;   // the log holds when it really ended
      this.out = { type: 'fade', at: now, len };
    }
    // one look (four times a second is plenty): returns null or an action {type: 'start', id, variant, lv, at, dur} |
    // {type: 'fade', at, len}; and sets duckT (the music's level under dialogue / a hostile mob)
    step(now, c) {
      const a = this.decide(now, c);
      this.duckT = c.dialogue ? 0.35 : c.hostile && !(this.cue && this.cue.id === 'adventure') ? 0.25 : 1;
      return a;
    }
    decide(now, c) {
      this.out = null;
      const cu = this.cue;
      if (cu) {
        if (now >= cu.t1) {   // the cue has ended: a rest (quiet) unless a sting or the fight goes on
          this.cue = null;
          if (!cu.fading) this.rot++;
          const rest = cu.fading ? (this.queue.length ? 0 : 1.5) : this.restFor(cu, c);
          this.restUntil = Math.max(this.restUntil, now + rest);
        } else {
          const w = this.want(c);
          if (!cu.fading && !cu.sting && w.urgent && w.id === cu.id && ((w.lv | 0) > cu.lv || (/^boss/.test(cu.variant) && w.variant !== cu.variant))) { this.fade(now, 1.0); return this.out; }   // the fight grows (a boss phase): out, and in again higher
          if (!cu.fading && !cu.sting && w.id !== cu.id && (w.urgent || cu.id === 'adventure' || (cu.id === 'space' && !c.space))) { this.fade(now, cu.id === 'adventure' ? 3 : FADE); if (w.urgent) this.restUntil = 0; }
          return this.out;
        }
      }
      if (this.queue.length) return this.start(now, { id: this.queue.shift(), variant: 'day', lv: 0, sting: true });
      const w = this.want(c);
      if (w.id === 'festival') return null;
      const last = this.log.length ? this.log[this.log.length - 1].id : '';
      if (now < this.restUntil && !(w.urgent && last !== w.id)) return null;   // an urgent change (a fight, the boss) cuts a rest short
      if (this.after) { const a = this.after; this.after = null; return this.start(now, a); }
      return this.start(now, w);
    }
    start(now, w) {
      const t0 = now + 0.05, dur = cueLen(w.id, w.variant);
      this.cue = { id: w.id, variant: w.variant, lv: this.calm ? Math.min(1, w.lv | 0) : w.lv | 0, t0, t1: t0 + dur, fading: false, sting: !!w.sting };
      this.log.push({ id: w.id, variant: w.variant, t0, t1: t0 + dur }); if (this.log.length > 64) this.log.shift();
      return (this.out = { type: 'start', id: w.id, variant: w.variant, lv: this.cue.lv, at: t0, dur, sting: !!w.sting });
    }
  }
  // the context of now, read from the game (four times a second; never throws): the boss's phase, a machine on you,
  // an unfreed outpost near, the flight regime and the star map, a story scene, dialogue, the Bauhand
  function gather(g, s, out) {
    out = out || {};
    out.night = +s.night || 0; out.cave = !!s.cave; out.festival = !!s.festival; out.danger = !!s.danger;
    out.space = s.space ? 'cruise' : ''; out.boss = 0; out.outpost = false; out.story = false; out.dialogue = false; out.building = false;
    if (!g) return out;
    try {
      const BS = VR.RPGBoss; const bc = BS && BS.cur;
      if (bc && bc.b && !bc.won && bc.rise > 0) out.boss = bc.b.ph | 0 || 1;
      const mobs = g.entities && g.entities.mobs, p = g.player && g.player.pos;
      if (mobs && p) for (let i = 0; i < mobs.length; i++) {
        const m = mobs[i], f = m && m.foe; if (!f || f.gone) continue;
        if (f.st === 'notice' || f.st === 'approach' || f.st === 'tele' || f.st === 'strike' || f.st === 'recover') {
          const dx = m.pos[0] - p[0], dz = m.pos[2] - p[2]; if (dx * dx + dz * dz < 40 * 40) { out.danger = true; break; }
        }
      }
      const Li = VR.Liberate; if (Li && Li.ringSite && !Li.moment) out.outpost = true;
      const SM = VR.StarMap; if (SM && SM.isOpen && SM.isOpen()) out.space = 'map';
      const fl = g.flight; if (fl && (fl.regime === 'space' || fl.regime === 'climb')) out.space = out.space || (fl.asc && fl.asc.cruise ? 'cruise' : 'orbit');
      if (g.story && g.story.scene) out.story = true;
      out.dialogue = !!(g.funke && g.funke.line) || !!(g.villages && g.villages.talking && g.ui && g.ui.screen === 'talk');
      const BH = VR.Bauhand; if ((BH && BH.state && BH.state !== 'closed') || (g.baustelle && g.baustelle.active)) out.building = true;
    } catch (e) { /* the music never breaks the game */ }
    return out;
  }

  VR.Score = { MODES, THEMES, VARIANTS, parseLine, degMidi, keyOf, cueLen, events, wanderEvents, scaleOf, Director, gather, FADE, REST, GAP };
})(VR);

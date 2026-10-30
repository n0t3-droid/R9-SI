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
      bpm: 84, mode: 'major', minorMode: 'dorian', len: 8, arc: [0.72, 0.78, 0.86, 0.8, 0.9, 1, 1, 0.84],
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
      // e-music2 · the B-section: to the relative minor and back up (vi IV I V), the tune leaning from above
      B: { chords: '5:4 | 3:4 | 0:4 | 4:4 | 5:4 | 3:4 | 1:2 4:2 | 4:4', lines: {
        mel: '7:1.5 6:.5 5 4 | 5:2 3:2 | 4 5 7 9 | 8:3 r | 9:1.5 8:.5 7 5 | 6:2 4:2 | 3 4 5 6 | 4:4',
        str: '2:4 | 0:4 | 2:2 4:2 | 1:4 | 2:4 | 0:2 1:2 | 3:2 1:2 | 1:4',
        bell: 'r:3 9 | r:4 | r:3 7 | r:4 | r:3 9 | r:4 | r:4 | 4:4' } },
      alt: { bass: [{ pat: [0, 3], plen: 1 }, { pat: [0, 1.5, 2, 3.5], plen: 1 }] },
    },
    // Weite — the space theme: slow, lydian (the raised fourth: I and II major side by side), bells over a pad
    space: {
      bpm: 58, mode: 'lydian', len: 8, arc: [0.7, 0.75, 0.82, 0.8, 0.95, 1, 0.9, 0.78],
      chords: '0:4 | 1:4 | 0:4 | 1:4 | 5:4 | 1:4 | 4:4 | 0:4',
      layers: [
        { id: 'pad', kind: 'chord', inst: 'pad', oct: -12, gain: 0.05, lv: 0, pri: 2 },
        { id: 'mel', kind: 'line', inst: 'bell', oct: 0, gain: 0.06, lv: 0, pri: 3,
          notes: '0 4 9:2 | 8 5 3:2 | 0 4 9 11 | 10:4 | 5 9 12:2 | 10:2 8:2 | 6 4 1:2 | 4:4' },
        { id: 'bass', kind: 'bass', inst: 'bass', oct: -24, gain: 0.06, lv: 1, pri: 2, pat: [0], plen: 4 },
        { id: 'arp', kind: 'arp', inst: 'pluck', oct: 12, gain: 0.018, lv: 1, pri: 1 },
      ],
      // e-music2 · the B-section: the sixth and the ninth, a slow climb that hangs on the fifth
      B: { chords: '5:4 | 1:4 | 2:4 | 1:4 | 5:4 | 4:4 | 1:4 | 1:4', lines: {
        mel: '9:2 7 5 | 8:2 6:2 | 4 6 7 9 | 8:4 | 12:2 11 9 | 10:2 8:2 | 7 8 9 11 | 8:4' } },
      alt: { arp: [[0, 4, 2, 4], [0, 2, 4, 7]] },
    },
    // Aufbruch — the adventure motif: a dorian call (root, fifth held, the climb to the octave), a driving ostinato
    adventure: {
      bpm: 116, mode: 'dorian', len: 8, arc: [0.85, 0.88, 0.92, 0.9, 0.95, 1, 1, 0.95],
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
      // e-music2 · the B-section: the call answered from the third, a run down and the climb to the fifth
      B: { chords: '2:4 | 6:4 | 3:4 | 0:4 | 2:4 | 6:4 | 3:2 4:2 | 4:4', lines: {
        mel: '7:2 9 7 | 6:1.5 4:.5 3:2 | 3 4 5 6 | 7:3 r | 9:1.5 8:.5 7 6 | 6 7 8:2 | 10 9 8 7 | 8:4' } },
      alt: { bass: [{ pat: [0, 1, 2, 3], plen: 0.5 }, { pat: [0, 0.5, 2, 2.5, 3.5], plen: 0.4 }], osti: [[0, 4, 2, 4, 0, 4, 2, 7], [0, 2, 4, 2, 0, 2, 4, 6]] },
    },
    // Staunen — the wonder sting: vi → II → I in lydian, a bell climb through two octaves, the top held
    wonder: {
      bpm: 88, mode: 'lydian', len: 3, sting: true, arc: [0.6, 0.85, 1],
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
        { id: 'mel', kind: 'line', inst: 'pluck', oct: 12, gain: 0.085, lv: 0, pri: 3, notes: '4:.5 7:.5 9:.5 8:.5 7 11 | 9:.5 11:.5 14:2 r' },
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
  // e-music2 · the outro: one written bar that closes the cue (a cadence into the tonic), its last chord ringing `tail`
  // seconds (the cue's length includes the bar; the tail rings into the rest). Stings keep their length: their last
  // notes get STING_TAIL.
  const OUTRO = {
    home: { chords: '3:2 0:2', lines: { mel: '5 4 7:2', str: '5:2 4:2', bell: 'r:2 7:2' }, tail: 3.2 },
    space: { chords: '1:2 0:2', lines: { mel: '9 8 7:2' }, tail: 3.8 },
    adventure: { chords: '6:2 0:2', lines: { mel: '6 5:.5 4:.5 7:2' }, tail: 2.8 },
  };
  const STING_TAIL = 2.8, WANDER_TAIL = 3.2;
  // e-music2 · the forms: A (the theme), B (its second half), told in a seeded order; no seed: the plain A
  const FORMS = { home: ['A', 'AB', 'BA', 'AB', 'B'], space: ['A', 'AB', 'BA', 'B'], adventure: ['A', 'B', 'AB', 'BA'] };
  function formOf(id, seed) {
    const th = THEMES[id], F = FORMS[id];
    if (!seed || !th || !th.B || !F) return 'A';
    return F[Math.floor(VR.Klang.rng(((seed >>> 0) ^ 0xf0f0a5) >>> 0)() * F.length)];
  }
  // e-music2 · the colours: the instrumentation of a place. inst: a voice swapped for another; melOct: the tune moved;
  // tone: the pads' and strings' filter (× their cutoff); drops: a watery arp layer at this gain; dry: no room (no air);
  // bassG / drumG: those layers' level. An exo world: the mode from its star's temperature (STAR_MODE).
  const COLOURS = {
    moon: { inst: { pluck: 'glass', strings: 'glasspad', pad: 'glasspad', lead: 'glass', bell: 'glass', reed: 'glass' }, bassG: 0.5, drumG: 0.45, dry: true },
    ocker: { inst: { pluck: 'reed', lead: 'reed', bell: 'reed' }, melOct: -12, tone: 0.55, drumG: 0.8 },
    aqua: { inst: { pluck: 'drop' }, drops: 0.022 },
    shore: { drops: 0.014 },
    dry: { inst: { pluck: 'reed' }, tone: 0.7 },
    snow: { inst: { pluck: 'glass' }, tone: 0.85 },
  };
  const STAR_MODE = (T) => (T < 3900 ? 'aeolian' : T < 5200 ? 'dorian' : T < 6000 ? 'mixolydian' : 'lydian');
  // the colour of a place: {body (a moon's / planet's id), starT (an exo world's star), biome (VR.BIOMES entry)}
  function colourOf(p) {
    p = p || {};
    if (p.starT > 0) return 'exo:' + Math.round(p.starT);
    if (p.body === 'basalt' || p.body === 'opal' || p.body === 'zinn') return 'moon';
    if (p.body === 'ocker') return 'ocker';
    if (p.body === 'aqua') return 'aqua';
    if (p.body) return 'moon';
    const b = p.biome; if (!b) return '';
    if (b.ocean || /beach|shore/.test(b.key || '')) return 'shore';
    if (b.temp >= 1.5 && b.down <= 0.05) return 'dry';
    if (b.temp < 0.15) return 'snow';
    return '';
  }
  const colourDef = (col) => (col && COLOURS[col]) || (col && col.startsWith('exo:') ? { mode: STAR_MODE(+col.slice(4)) } : null);

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
  // the key of a day: the theme's root in G3 … F♯4 from the day's plan, the home theme in dorian on a minor day; an exo
  // world's star picks the mode (e-music2)
  function keyOf(id, plan, colour) {
    const th = THEMES[id], r = plan ? plan.root : 60;
    const root = 55 + ((((r - 55) % 12) + 12) % 12);
    let mode = th && th.minorMode && plan && plan.mode === 'minor' ? th.minorMode : th ? th.mode : 'major';
    const cd = colourDef(colour); if (cd && cd.mode) mode = cd.mode;
    return { root, mode };
  }
  const beatLen = (id, variant) => 60 / (THEMES[id].bpm * ((VARIANTS[variant] && VARIANTS[variant].bpm) || 1));
  // a cue's length in seconds (the wander layer: 8 bars of the day's plan at its own beat)
  // (e-music2: the form's sections and the outro bar; the wander layer's eight bars and its held last bar)
  function cueLen(id, variant, seed) {
    if (id === 'wander') return 9 * 4 * WANDER_BEAT[variant === 'night' ? 'night' : variant === 'cave' ? 'cave' : 'day'];
    const th = THEMES[id]; if (!th) return 0;
    return (formOf(id, seed).length * th.len + (OUTRO[id] ? 1 : 0)) * 4 * beatLen(id, variant);
  }
  const WANDER_BEAT = { day: 0.56, night: 0.7, cave: 0.8 };

  // e-music2 · the seeded variation of one section's tune (notes: parseLine's, beats from the section's start): the second
  // half inverted around its first note (the cadence kept), a note an octave away, passing notes between thirds, an
  // upper neighbour on a long note. Degrees only: every note stays in the key.
  function vary(notes, r, beats) {
    const n = notes.map(x => ({ b: x.b, len: x.len, degs: x.degs.slice() }));
    if (r() < 0.35) {
      const half = n.filter(x => x.b >= beats / 2 - 1e-6);
      if (half.length > 2) { const p = half[0].degs[0]; for (const x of half.slice(1, -1)) x.degs = x.degs.map(d => { let y = 2 * p - d; while (y > 12) y -= 7; while (y < -2) y += 7; return y; }); }
    }
    for (let i = 1; i < n.length - 1; i++) if (r() < 0.08) n[i].degs = n[i].degs.map(d => d >= 5 ? d - 7 : d + 7);
    const out = [], pe = 0.3 + 0.4 * r();
    for (let i = 0; i < n.length; i++) {
      const x = n[i], nx = n[i + 1];
      if (nx && x.degs.length === 1 && nx.degs.length === 1 && x.len >= 1 && Math.abs(nx.degs[0] - x.degs[0]) === 2 && Math.abs(x.b + x.len - nx.b) < 1e-6 && r() < pe) {
        out.push({ b: x.b, len: x.len - 0.5, degs: x.degs }, { b: x.b + x.len - 0.5, len: 0.5, degs: [(x.degs[0] + nx.degs[0]) / 2] });
      } else if (nx && x.degs.length === 1 && x.len >= 2 && r() < 0.25) {
        out.push({ b: x.b, len: x.len - 0.5, degs: x.degs }, { b: x.b + x.len - 0.5, len: 0.5, degs: [x.degs[0] + 1] });
      } else out.push(x);
    }
    return out;
  }
  // re-harmonisation: a chord (not the first or the last) swapped for a third-related one that shares two of its notes,
  // never a diminished triad of the mode
  const SUBS = { 0: [5, 2], 1: [3], 2: [0, 4], 3: [1, 5], 4: [2, 6], 5: [3, 0], 6: [4] };
  const DIM = { major: 6, dorian: 5, lydian: 3, aeolian: 1, mixolydian: 2 };
  function reharm(ch, r, mode) {
    return ch.map((c, i) => {
      if (i === 0 || i === ch.length - 1 || r() > 0.22) return c;
      const opts = (SUBS[c.degs[0]] || []).filter(d => d !== DIM[mode]); if (!opts.length) return c;
      return { b: c.b, len: c.len, degs: [opts[Math.floor(r() * opts.length)]] };
    });
  }

  // the events of a cue: {t (s from the cue's start), dur, midi (0 for a drum), inst, gain, pri, act, layer, tail?}. lv:
  // the intensity (0 … 2); plan: the day's plan (the key); calm: 'Ruhige Musik' (no drums, the level capped at 1);
  // seed (e-music2): the form and the variation (none: the plain theme); colour: the place's instrumentation
  function events(id, o) {
    o = o || {};
    if (id === 'wander') return wanderEvents(o.plan || (VR.Klang && VR.Klang.musicPlan(0)), o.variant, o.seed, o.colour);
    const th = THEMES[id]; if (!th) return [];
    const V = VARIANTS[o.variant] || {}, B = beatLen(id, o.variant), key = keyOf(id, o.plan, o.colour), seed = o.seed >>> 0;
    const col = colourDef(o.colour) || {}, CI = col.inst || {};
    let lv = o.lv !== undefined ? o.lv : V.lv !== undefined ? V.lv : 0; if (o.calm) lv = Math.min(lv, 1);
    const G = (V.gain || 1) * (o.calm ? 0.8 : 1), out = [];
    const form = th.sting ? 'A' : formOf(id, seed), secBeats = th.len * 4, OU = th.sting ? null : OUTRO[id];
    const layers = th.layers.slice();
    if (col.drops && !th.sting) layers.push({ id: 'drops', kind: 'arp', inst: 'drop', oct: 12, gain: col.drops, lv: 0, pri: 1, drops: true });
    const midiOf = (d, L) => degMidi(key.root, key.mode, d) + (L.oct || 0) + (L.id === 'mel' && col.melOct ? col.melOct : 0);
    const emit = (L, off, sec, chords, r, outro) => {
      if (L.lv > lv) return;
      if (o.calm && L.kind === 'drum') return;
      if (o.lowEnd && L.pri < 2 && L.kind !== 'line') return;   // Very Low: no ornament layers
      const vi = (V.inst && V.inst[L.id]) || L.inst, inst = CI[vi] || vi, act = id === 'adventure';
      const lg = L.gain * G * (L.kind === 'bass' && col.bassG ? col.bassG : 1) * (L.kind === 'drum' && col.drumG ? col.drumG : 1);
      const push = (b, len, midi, g2) => out.push({ t: (off + b) * B, dur: len * B, midi, inst, gain: g2 === undefined ? lg : g2, pri: L.pri, act, layer: L.id, sec: outro ? 'O' : sec });
      const total = outro ? 4 : secBeats, alt = th.alt && th.alt[L.id];
      const chordAt = (b) => { for (const c of chords) if (b >= c.b - 1e-6 && b < c.b + c.len - 1e-6) return c; return chords[chords.length - 1]; };
      if (L.kind === 'line') {
        const txt = outro ? OU.lines[L.id] : sec === 'B' ? th.B.lines[L.id] : L.notes; if (!txt) return;
        let notes = parseLine(txt).notes; if (r && L.id === 'mel' && !outro) notes = vary(notes, r, secBeats);
        for (const n of notes) for (const d of n.degs) push(n.b, n.len, midiOf(d, L));
      } else if (L.kind === 'chord') for (const c of chords) for (const d of [0, 2, 4]) push(c.b, c.len * 1.04, midiOf(c.degs[0] + d, L), lg * (d ? 0.8 : 1));
      else if (L.kind === 'bass') {
        if (outro) { for (const c of chords) push(c.b, c.len, midiOf(c.degs[0], L)); return; }
        const pp = alt && r && r() < 0.5 ? alt[Math.floor(r() * alt.length)] : { pat: L.pat, plen: L.plen };
        for (let b = 0; b < total; b += 4) for (const p of pp.pat) { const c = chordAt(b + p); push(b + p, pp.plen, midiOf(c.degs[0], L)); }
      } else if (L.kind === 'arp' || L.kind === 'osti') {
        const osti = L.kind === 'osti', pat = alt && r && r() < 0.5 ? alt[Math.floor(r() * alt.length)] : osti ? L.pat : L.drops ? [0, 2, 4, 7, 4, 2] : [0, 2, 4, 2];
        const step = L.drops ? 0.75 : 0.5, lim = outro ? 2 : total;
        for (let b = 0, k = 0; b < lim - 1e-6; b += step, k++) { const c = chordAt(b); push(b, osti ? 0.45 : L.drops ? 1.2 : 0.9, midiOf(c.degs[0] + pat[k % pat.length], L)); }
      } else if (L.kind === 'drum') {
        if (outro) { if (L.inst === 'kick') push(0, 0.4, 0); return; }
        for (let b = 0; b < total; b += 0.5) { const k = Math.round(b * 2) % 8; if (L.hits[k] === 'x') push(b, 0.4, 0); }
      }
    };
    for (let si = 0; si < form.length; si++) {
      const sec = form[si], r = seed ? VR.Klang.rng(((seed ^ Math.imul(si + 1, 0x9e3779b1)) >>> 0) || 1) : null;
      let chords = parseLine(sec === 'B' ? th.B.chords : th.chords).notes; if (r) chords = reharm(chords, r, key.mode);
      for (const L of layers) emit(L, si * secBeats, sec, chords, r, false);
    }
    const body = form.length * secBeats;
    if (OU) { const och = parseLine(OU.chords).notes; for (const L of layers) emit(L, body, 'O', och, null, true); }
    // the phrase breathes (arc: a gain per bar; the outro a little softer), and the ending rings: the notes of the last
    // chord that reach the end get a long release (tail)
    const end = (body + (OU ? 4 : 0)) * B, lastCh = OU ? parseLine(OU.chords).notes.pop() : parseLine(th.chords).notes.pop();
    const lastAt = (OU ? body + lastCh.b : lastCh.b) * B, tail = OU ? OU.tail : STING_TAIL;
    for (const e of out) {
      if (th.arc) e.gain *= e.sec === 'O' ? th.arc[th.arc.length - 1] * 0.9 : th.arc[Math.min(th.arc.length - 1, Math.floor((e.t / B - 0) / 4 + 1e-6) % th.len)];
      if (e.midi && e.t >= lastAt - 1e-6 && (e.t + e.dur >= end - B * 1.01 || e.layer === 'pad' || e.layer === 'bass' || e.layer === 'str')) { e.dur = Math.max(e.dur, end - e.t); e.tail = tail; }
      if (col.tone && (e.inst === 'pad' || e.inst === 'strings' || e.inst === 'glasspad')) e.tone = col.tone;
      delete e.sec;
    }
    out.sort((a, b) => a.t - b.t || b.pri - a.pri);
    return out;
  }
  // the wander layer: the old calm generative music (eight bars of the day's pentatonic plan: pad, bass, a motif in
  // plucks, varied by the seed), so the days between the themes never repeat
  function wanderEvents(plan, variant, seed, colour) {
    const K = VR.Klang, r = K.rng((seed >>> 0) || (K.seedOf(plan.day) ^ 0x51ed)), out = [];
    const CI = (colourDef(colour) || {}).inst || {};
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
    // e-music2 · the last bar: the home chord held, the root below and the tune's root above, ringing out (tail)
    const t9 = 8 * bar, c0 = plan.prog[0];
    for (const d of [c0, c0 + 2, c0 + 4]) out.push({ t: t9, dur: bar, midi: K.degreeMidi(plan, d) - 12, inst: 'pad', gain: padG * 0.9, pri: 2, act: false, layer: 'pad', tail: WANDER_TAIL });
    out.push({ t: t9, dur: bar, midi: K.degreeMidi(plan, c0) - 24, inst: 'bass', gain: 0.06, pri: 2, act: false, layer: 'bass', tail: WANDER_TAIL });
    out.push({ t: t9, dur: bar, midi: K.degreeMidi(plan, 0) + 12, inst: variant === 'night' ? 'bell' : 'pluck', gain: 0.045, pri: 3, act: false, layer: 'mel', tail: WANDER_TAIL });
    for (const e of out) if (CI[e.inst]) e.inst = CI[e.inst];
    return out;
  }
  // the pitch classes a cue may use (the tests: every note in its key)
  function scaleOf(id, plan, colour) {
    if (id === 'wander') return new Set(VR.Klang.SCALE[plan.mode].map(s => (plan.root + s) % 12));
    const k = keyOf(id, plan, colour); return new Set(MODES[k.mode].map(s => (k.root + s) % 12));
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
      this.nCue = 0; this.colour = '';   // e-music2: every cue's seed (the director's and the cue's number), the place's colour
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
      this.colour = c.colour || '';
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
      const seed = ((Math.imul(this.seed, 0x9e3779b1) ^ Math.imul(++this.nCue, 0x85ebca6b)) >>> 0) || 1, colour = this.colour;
      const t0 = now + 0.05, dur = cueLen(w.id, w.variant, seed), lv = this.calm ? Math.min(1, w.lv | 0) : w.lv | 0;
      this.cue = { id: w.id, variant: w.variant, lv, t0, t1: t0 + dur, fading: false, sting: !!w.sting };
      this.log.push({ id: w.id, variant: w.variant, lv, seed, colour, t0, t1: t0 + dur }); if (this.log.length > 64) this.log.shift();
      return (this.out = { type: 'start', id: w.id, variant: w.variant, lv, at: t0, dur, sting: !!w.sting, seed, colour });
    }
  }
  // the context of now, read from the game (four times a second; never throws): the boss's phase, a machine on you,
  // an unfreed outpost near, the flight regime and the star map, a story scene, dialogue, the Bauhand
  function gather(g, s, out) {
    out = out || {};
    out.night = +s.night || 0; out.cave = !!s.cave; out.festival = !!s.festival; out.danger = !!s.danger;
    out.space = s.space ? 'cruise' : ''; out.colour = ''; out.boss = 0; out.outpost = false; out.story = false; out.dialogue = false; out.building = false;
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
      // e-music2 · the place's colour: a moon or planet (its body), an exo world (its star), at home the biome
      const D = VR.DimReg && g.dim && VR.DimReg.get(g.dim), st = g.stars;
      const w = g.world, bi = !D || !D.body ? (w && w.biomeAt && p && VR.BIOMES ? VR.BIOMES[w.biomeAt(Math.floor(p[0]), Math.floor(p[2]))] : null) : null;
      out.colour = colourOf({ body: D && D.body, starT: st && st.on && st.def && st.def.star ? st.def.star.T : 0, biome: bi });
      const BH = VR.Bauhand; if ((BH && BH.state && BH.state !== 'closed') || (g.baustelle && g.baustelle.active)) out.building = true;
    } catch (e) { /* the music never breaks the game */ }
    return out;
  }

  VR.Score = { MODES, THEMES, VARIANTS, OUTRO, COLOURS, FORMS, parseLine, degMidi, keyOf, cueLen, formOf, colourOf, vary, events, wanderEvents, scaleOf, Director, gather, FADE, REST, GAP };
})(VR);

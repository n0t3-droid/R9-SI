// ============================================================================
// e-score2 · the place-aware score (docs/superpowers/plans/2026-11-01-e-score2.md). The owner: never boring, beauty,
// fairy-tale, a cartoon film's feeling. Extends VR.Score (score.js) and VR.ScoreSynth (scoresynth.js); pure (node runs it).
//   · the themes of places — all our own compositions, written as scale degrees (score.js's grammar; 'meter' 3: a waltz):
//       meadow   Wiesenlied     the home meadow: a lilting 3/4 pastoral, a flute over a harp, birds on a celesta
//       lullaby  Wiegenlied     night at home: a 3/4 cradle song on a music box over a slow harp
//       harbour  Palmenhafen    bright and bustling: mallets, a plucked ostinato, a shaker and a light drum
//       fairy    Feenschimmer   the fairy places: a celesta and a music box in lydian, a soft pad
//       waltz    Mondsteinwalzer the Mondsteinkreis: a dreamy dorian waltz, a music box, a choir, oom-pah-pah on a harp
//       p_aqua   Gezeitenlied   the Wellari: watery bells and drops, mixolydian
//       p_ocker  Sandsternweise the Dunelin: warm frame drums, a reed and strings, phrygian
//       p_zinn   Funkelweise    the Glimari: ember brass, sparks on a celesta, major
//       p_basalt Steinglut-Gesang the Regoli: deep hums and stone chimes, aeolian
//       p_opal   Eisblütenlied  the Isveli: glassy pads and glass bells, lydian
//       bridge   Lichtbrücke    a soaring choir pad under bells, lydian
//       ladder   Himmelsleiter  a harp arpeggio rising two octaves a bar, a flute climbing
//       d_*      the festivals' dances: Blütenreigen (spring 3/4), Drachenwind (summer reel), Laubtafel (autumn 3/4),
//                Lichterbaum (winter, gentle 3/4); the peoples' festivals dance their own theme faster (variant pdance)
//       stingers glimpse (a wander moment), friend (a fairy place, a Flausel), welcome (a family moves in), freed (the
//                outpost freed, after the swell)
//   · SEASONS: the arrangement's colour (spring a celesta, summer fuller, autumn a harp and warm, winter glass)
//   · the selection: Director.prototype.want wrapped (a journey, a festival, the base rules, a storm, the place, home)
//   · gather wrapped: the place context of now (Palmenhafen, the fairy places, a people's world, the season, the weather,
//     the golden hour, the Himmelsleiter / a Lichtbrücke, today's festival) — four times a second, never throws
//   · the voices: celesta, musicbox, mallet, harp, flute, choir, brass, hum, tom, shaker (VR.ScoreSynth.note wrapped);
//     Very Low (lowEnd): one oscillator each
// ============================================================================
(function (VR) {
  'use strict';
  const S = VR.Score, SY = VR.ScoreSynth;
  if (!S || !SY) return;
  S.MODES.phrygian = [0, 1, 3, 5, 7, 8, 10];
  Object.assign(S.VARIANTS, {
    dance: { lv: 2 }, pdance: { bpm: 1.3, lv: 2 }, dusk: { bpm: 0.9, gain: 0.85 }, rain: { bpm: 0.9, lv: 0, gain: 0.75 }, snow: { bpm: 0.85, lv: 0, gain: 0.8 },
  });
  // the seasons (VR.Seasons: 0 spring … 3 winter): inst — voices swapped (not in an own theme); lv — a level more; tone — the
  // pads' and strings' filter
  S.SEASONS = [
    { inst: { bell: 'celesta' }, tone: 1.15 },
    { lv: 1, tone: 1.05 },
    { inst: { pluck: 'harp', bell: 'musicbox' }, tone: 0.8 },
    { inst: { pluck: 'celesta', bell: 'glass', strings: 'glasspad' }, tone: 0.7 },
  ];
  // the places' colours of the wander layer and the home themes there
  S.COLOURS.fairy = { inst: { pluck: 'celesta', bell: 'musicbox' } };
  S.COLOURS.harbour = { inst: { pluck: 'mallet' } };
  const L = (id, kind, inst, oct, gain, lv, pri, x) => Object.assign({ id, kind, inst, oct, gain, lv, pri }, x);
  const T = {
    // Wiesenlied — I IV I V vi IV V I in 3/4; the flute's long-short lilt, the harp breaking each chord up and down
    meadow: {
      bpm: 92, meter: 3, mode: 'major', len: 8, arc: [0.75, 0.8, 0.88, 0.82, 0.9, 1, 0.95, 0.85],
      chords: '0:3 | 3:3 | 0:3 | 4:3 | 5:3 | 3:3 | 4:3 | 0:3',
      layers: [
        L('mel', 'line', 'flute', 0, 0.06, 0, 3, { notes: '4:2 5 | 7:2 5 | 4 2 4 | 1:3 | 2:2 4 | 5:1.5 4:.5 3 | 2 1 2 | 0:3' }),
        L('harp', 'arp', 'harp', -12, 0.03, 0, 2, { pat: [0, 2, 4, 7, 4, 2], step: 0.5, nlen: 1.4 }),
        L('bass', 'bass', 'bass', -24, 0.06, 0, 2, { pat: [0], plen: 3 }),
        L('pad', 'chord', 'pad', -12, 0.03, 1, 1),
        L('bird', 'line', 'celesta', 12, 0.025, 1, 1, { notes: 'r:2 9:.5 11:.5 | r:3 | r:3 | r:2 8 | r:2 9:.5 11:.5 | r:3 | r:3 | r:2 7' }),
      ],
      B: { chords: '5:3 | 3:3 | 0:3 | 4:3 | 5:3 | 1:3 | 4:3 | 4:3', lines: { mel: '7:2 9 | 7:2 5 | 7 5 4 | 4:3 | 5:2 7 | 8:1.5 7:.5 5 | 4 3 1 | 1:3' } },
      alt: { bass: [{ pat: [0, 2], plen: 1 }] },
    },
    // Wiegenlied — a cradle song in 3/4, the music box over a harp that rocks on each beat
    lullaby: {
      bpm: 66, meter: 3, mode: 'major', len: 8, own: true, arc: [0.8, 0.85, 0.9, 0.85, 0.85, 0.95, 0.9, 0.8],
      chords: '0:3 | 3:3 | 0:3 | 4:3 | 0:3 | 3:3 | 4:3 | 0:3',
      layers: [
        L('mel', 'line', 'musicbox', 12, 0.05, 0, 3, { notes: '4:2 2 | 5:2 3 | 4 2 0 | 1:3 | 4:2 2 | 5 7 5 | 4 1 2 | 0:3' }),
        L('harp', 'arp', 'harp', -12, 0.025, 0, 2, { pat: [0, 4, 7], step: 1, nlen: 2.4 }),
        L('pad', 'chord', 'pad', -12, 0.028, 0, 2),
        L('bass', 'bass', 'bass', -24, 0.04, 1, 2, { pat: [0], plen: 3 }),
      ],
    },
    // Palmenhafen — bright and bustling: I V vi IV, the mallets skipping in eighths, a plucked ostinato, the shaker
    harbour: {
      bpm: 112, mode: 'major', len: 8, own: true, arc: [0.85, 0.88, 0.95, 0.9, 0.9, 1, 1, 0.9],
      chords: '0:4 | 4:4 | 5:4 | 3:4 | 0:4 | 4:4 | 3:2 4:2 | 0:4',
      layers: [
        L('mel', 'line', 'mallet', 0, 0.07, 0, 3, { notes: '0:.5 2:.5 4 4:.5 5:.5 4 | 6:.5 4:.5 1 4:2 | 5:.5 7:.5 9 7:.5 5:.5 4 | 3 5 7:2 | 0:.5 2:.5 4 4:.5 5:.5 7 | 8:.5 6:.5 4 1:2 | 3:.5 5:.5 7 4:.5 6:.5 8 | 7:3 r' }),
        L('osti', 'osti', 'pluck', -12, 0.032, 0, 2, { pat: [0, 4, 2, 4, 0, 4, 2, 4] }),
        L('bass', 'bass', 'bass', -24, 0.065, 0, 2, { pat: [0, 1.5, 2, 3], plen: 0.5 }),
        L('shaker', 'drum', 'shaker', 0, 0.03, 1, 1, { hits: '.x.x.x.x' }),
        L('tom', 'drum', 'tom', 0, 0.07, 1, 2, { hits: 'x...x.x.' }),
        L('pad', 'chord', 'pad', -12, 0.026, 1, 1),
      ],
      B: { chords: '3:4 | 4:4 | 2:4 | 5:4 | 3:4 | 4:4 | 1:2 4:2 | 4:4', lines: { mel: '7:1.5 8:.5 7 5 | 4:1.5 6:.5 8:2 | 9:.5 7:.5 6 4 2 | 5:3 r | 7:1.5 8:.5 9 7 | 8 6 4 6 | 5 3 8 6 | 4:4' } },
      alt: { osti: [[0, 2, 4, 7, 4, 2, 0, 2]] },
    },
    // Feenschimmer — a celesta's shimmer in lydian (the raised fourth: I and II side by side), a music box turning
    fairy: {
      bpm: 76, mode: 'lydian', len: 8, own: true, arc: [0.75, 0.8, 0.9, 0.85, 0.9, 1, 0.9, 0.8],
      chords: '0:4 | 1:4 | 0:4 | 1:4 | 5:4 | 2:4 | 1:4 | 0:4',
      layers: [
        L('mel', 'line', 'celesta', 12, 0.055, 0, 3, { notes: '4:.5 3:.5 4:.5 7:.5 6:2 | 5:.5 3:.5 1:.5 3:.5 5:2 | 4:.5 6:.5 7:.5 9:.5 11:2 | 10:3 r | 9:.5 7:.5 5:.5 4:.5 2:2 | 4:.5 6:.5 9:.5 8:.5 6:2 | 5 3 1 3 | 0:3 r' }),
        L('box', 'osti', 'musicbox', 0, 0.022, 1, 2, { pat: [0, 4, 7, 9, 7, 4, 2, 4] }),
        L('pad', 'chord', 'pad', -12, 0.034, 0, 2),
        L('bass', 'bass', 'bass', -24, 0.045, 1, 2, { pat: [0], plen: 4 }),
        L('spark', 'line', 'celesta', 12, 0.02, 1, 1, { notes: 'r:3 9:.5 11:.5 | r:4 | r:3 11 | r:4 | r:3 9:.5 11:.5 | r:4 | r:4 | r:2 7:2' }),
      ],
      B: { chords: '5:4 | 1:4 | 6:4 | 2:4 | 5:4 | 1:4 | 1:4 | 1:4', lines: { mel: '9:2 7:.5 5:.5 4 | 5:2 3:2 | 6:.5 8:.5 10:.5 8:.5 6:2 | 4:3 r | 7:.5 9:.5 11:.5 9:.5 7:2 | 8:.5 6:.5 5:.5 3:.5 1:2 | 3 5 8 10 | 8:4' } },
    },
    // Mondsteinwalzer — a dreamy dorian waltz (i IV VII III), the music box above, a choir humming 'oo', oom-pah-pah
    waltz: {
      bpm: 132, meter: 3, mode: 'dorian', len: 8, own: true, arc: [0.75, 0.8, 0.85, 0.8, 0.9, 1, 0.95, 0.8],
      chords: '0:3 | 3:3 | 6:3 | 2:3 | 0:3 | 3:3 | 4:3 | 0:3',
      layers: [
        L('mel', 'line', 'musicbox', 12, 0.095, 0, 3, { notes: '4:2 2 | 3:2 5 | 6:2 4 | 2:3 | 4:1.5 5:.5 7 | 7:2 5 | 6 4 1 | 0:3' }),
        L('bass', 'bass', 'bass', -24, 0.095, 0, 2, { pat: [0], plen: 1 }),
        L('comp', 'comp', 'harp', -12, 0.05, 0, 2, { beats: [1, 2], nlen: 0.7 }),   // (a-story8: 0.016 → 0.05 — the oom-pah-pah heard; the whole waltz ×1.9: it rendered at −31 LUFS, the others −20 … −24)
        L('oo', 'line', 'choir', 0, 0.045, 0, 2, { notes: '2:3 | 3:3 | 1:3 | 2:3 | 4:3 | 5:3 | 4:2 6 | 4:3' }),   // a-story8: the choir's slow 'oo' counter-line on the chords' tones
        L('choir', 'chord', 'choir', -12, 0.035, 1, 1),
      ],
      B: { chords: '2:3 | 6:3 | 3:3 | 0:3 | 2:3 | 6:3 | 3:3 | 4:3', lines: { mel: '6:2 4 | 8:2 6 | 5:2 3 | 4:3 | 9:2 6 | 8:2 6 | 7 5 3 | 4:3', oo: '4:3 | 3:3 | 5:3 | 4:3 | 6:3 | 6:3 | 5:3 | 4:3' } },
    },
    // Gezeitenlied — the Wellari: bells like water on stone, drops falling into their pitch, mixolydian (♭VII)
    p_aqua: {
      bpm: 80, mode: 'mixolydian', len: 8, own: true, arc: [0.8, 0.85, 0.9, 0.85, 0.9, 1, 0.95, 0.85],
      chords: '0:4 | 6:4 | 3:4 | 0:4 | 0:4 | 6:4 | 4:2 3:2 | 0:4',
      layers: [
        L('mel', 'line', 'bell', 0, 0.06, 0, 3, { notes: '0 2 4:2 | 6 4 3:2 | 3 5 7:2 | 4:3 r | 7 9 7 4 | 6:2 8:2 | 6 4 3 5 | 4:3 r' }),
        L('drops', 'arp', 'drop', 12, 0.02, 0, 1, { pat: [0, 2, 4, 7, 4, 2], step: 0.75, nlen: 1.2 }),
        L('pad', 'chord', 'pad', -12, 0.034, 0, 2),
        L('bass', 'bass', 'bass', -24, 0.055, 1, 2, { pat: [0, 2.5], plen: 1.5 }),
        L('tom', 'drum', 'tom', 0, 0.07, 2, 2, { hits: 'x..x..x.' }),
        L('shaker', 'drum', 'shaker', 0, 0.028, 2, 1, { hits: '.x.x.x.x' }),
        L('tide', 'arp', 'harp', -12, 0.018, 1, 1, { pat: [0, 2, 4, 7, 9, 11, 9, 7], step: 0.5, nlen: 1.6 }),   // a-story8: the Wellari's signature — the tide rising and falling
      ],
      B: { chords: '3:4 | 0:4 | 6:4 | 4:4 | 3:4 | 0:4 | 6:2 4:2 | 4:4', lines: { mel: '5 7 8:2 | 7 4 2:2 | 6 8 10:2 | 8:3 r | 5 7 5 3 | 4:2 2:2 | 1 3 4 6 | 4:3 r' } },
    },
    // Sandsternweise — the Dunelin: warm frame drums under a reed, strings holding the chords, phrygian (♭II)
    p_ocker: {
      bpm: 96, mode: 'phrygian', len: 8, own: true, arc: [0.8, 0.85, 0.9, 0.85, 0.9, 1, 1, 0.85],
      chords: '0:4 | 1:4 | 0:4 | 6:4 | 0:4 | 1:4 | 6:2 1:2 | 0:4',
      layers: [
        L('mel', 'line', 'reed', 0, 0.055, 0, 3, { notes: '0 1 2:2 | 3 2 1:2 | 2 4 3 2 | 1:3 r | 4:1.5 3:.5 2 1 | 3:1.5 2:.5 1 3 | 2 1 -1:.5 0:.5 1 | 0:4' }),
        L('str', 'chord', 'strings', -12, 0.03, 0, 2),
        L('bass', 'bass', 'bass', -24, 0.065, 0, 2, { pat: [0, 1.5], plen: 1 }),
        L('tom', 'drum', 'tom', 0, 0.07, 0, 2, { hits: 'x..x.x..' }),
        L('shaker', 'drum', 'shaker', 0, 0.025, 1, 1, { hits: '..x...x.' }),
        L('tom2', 'drum', 'tom', 0, 0.045, 2, 1, { hits: '.x...x.x' }),
        L('turn', 'line', 'flute', 12, 0.02, 1, 1, { notes: 'r:3 2:.25 1:.25 0:.25 1:.25 | r:4 | r:3 4:.25 3:.25 2:.25 1:.25 | r:4 | r:3 2:.25 1:.25 0:.25 1:.25 | r:4 | r:3 1:.25 0:.25 -1:.25 0:.25 | r:4' }),   // a-story8: the Dunelin's signature — a quick reed turn at the end of a bar, like wind round a dune
      ],
      B: { chords: '6:4 | 0:4 | 1:4 | 0:4 | 6:4 | 0:4 | 1:2 6:2 | 0:4', lines: { mel: '6:2 4 3 | 4:1.5 3:.5 1:2 | 1 2 3 4 | 2:3 r | 6 7 6 4 | 3:2 2:2 | 1 3 2 1 | 0:4' } },
    },
    // Funkelweise — the Glimari: a warm brass call like embers glowing up, sparks on a celesta
    p_zinn: {
      bpm: 90, mode: 'major', len: 8, own: true, arc: [0.8, 0.85, 0.9, 0.85, 0.9, 1, 0.95, 0.9],
      chords: '0:4 | 3:4 | 4:4 | 0:4 | 5:4 | 3:4 | 1:2 4:2 | 0:4',
      layers: [
        L('mel', 'line', 'brass', 0, 0.055, 0, 3, { notes: '0:1.5 4:.5 4:2 | 5 3 0:2 | 1:1.5 4:.5 6:2 | 4:3 r | 5:1.5 7:.5 9:2 | 7 5 3:2 | 3 1 4 6 | 7:3 r' }),
        L('spark', 'line', 'celesta', 12, 0.022, 1, 1, { notes: 'r:3 7 | r:4 | r:3 8 | r:4 | r:3 9 | r:4 | r:4 | r:2 7:2' }),
        L('pad', 'chord', 'pad', -12, 0.034, 0, 2),
        L('bass', 'bass', 'bass', -24, 0.06, 0, 2, { pat: [0, 2], plen: 2 }),
        L('tom', 'drum', 'tom', 0, 0.06, 2, 2, { hits: 'x...x.x.' }),
        L('shaker', 'drum', 'shaker', 0, 0.025, 2, 1, { hits: '.x.x.x.x' }),
        L('call', 'line', 'brass', -12, 0.026, 1, 2, { notes: '0:.5 3:.5 4:1 r:2 | r:4 | r:4 | r:4 | 0:.5 3:.5 4:1 r:2 | r:4 | r:4 | r:2 4:.5 7:1.5' }),   // a-story8: the Glimari's signature — an ember call, a fourth leaping up to the fifth
      ],
      B: { chords: '5:4 | 1:4 | 4:4 | 0:4 | 5:4 | 1:4 | 3:2 4:2 | 4:4', lines: { mel: '9:1.5 7:.5 5:2 | 8 6 3:2 | 4:1.5 6:.5 8:2 | 7:3 r | 5:1.5 7:.5 9:2 | 8 6 5:2 | 3 5 7 8 | 6:3 r' } },
    },
    // Steinglut-Gesang — the Regoli: deep hums like a choir in a crater, slow stone chimes, aeolian
    p_basalt: {
      bpm: 60, mode: 'aeolian', len: 8, own: true, arc: [0.8, 0.85, 0.9, 0.85, 0.9, 1, 0.95, 0.85],
      chords: '0:4 | 5:4 | 3:4 | 4:4 | 0:4 | 5:4 | 6:2 4:2 | 0:4',
      layers: [
        L('hum', 'chord', 'hum', -12, 0.045, 0, 2),
        L('mel', 'line', 'bell', 0, 0.055, 0, 3, { notes: '0:2 2:2 | 2:3 r | 3:2 2 0 | 1:3 r | 0:2 4:2 | 2:2 0:2 | -1:2 1:2 | 0:4' }),
        L('bass', 'bass', 'hum', -24, 0.055, 0, 2, { pat: [0], plen: 4 }),
        L('tom', 'drum', 'tom', 0, 0.055, 1, 2, { hits: 'x.......' }),
        L('tom2', 'drum', 'tom', 0, 0.05, 2, 1, { hits: '....x.x.' }),
        L('drone', 'line', 'hum', -12, 0.028, 0, 1, { notes: '4:4 | 4:4 | 4:4 | 4:4 | 4:4 | 4:4 | 4:4 | 4:4' }),   // a-story8: the Regoli's signature — a deep drone held on the fifth through every chord
      ],
      B: { chords: '3:4 | 4:4 | 0:4 | 5:4 | 3:4 | 4:4 | 5:2 6:2 | 4:4', lines: { mel: '3:2 4:2 | 4:3 r | 5:2 4 2 | 0:3 r | 3:2 5:2 | 4:2 2:2 | 2:2 3:2 | 1:4' } },
    },
    // Eisblütenlied — the Isveli: glass pads like frost, glass bells climbing in lydian, a celesta's flakes
    p_opal: {
      bpm: 64, mode: 'lydian', len: 8, own: true, arc: [0.8, 0.85, 0.9, 0.85, 0.9, 1, 0.95, 0.85],
      chords: '0:4 | 1:4 | 6:4 | 2:4 | 0:4 | 1:4 | 5:2 1:2 | 0:4',
      layers: [
        L('pad', 'chord', 'glasspad', -12, 0.042, 0, 2),
        L('mel', 'line', 'glass', 12, 0.05, 0, 3, { notes: '4:2 6 7 | 8:2 5:2 | 6 8 10 8 | 9:3 r | 7:2 9 11 | 12:2 8:2 | 7 5 8:2 | 7:4' }),
        L('flake', 'arp', 'celesta', 12, 0.016, 1, 1, { pat: [0, 4, 2, 7], step: 1, nlen: 1.5 }),
        L('bass', 'bass', 'bass', -24, 0.045, 1, 2, { pat: [0], plen: 4 }),
        L('shaker', 'drum', 'shaker', 0, 0.028, 2, 1, { hits: 'x.x.x.x.' }),
        L('tom', 'drum', 'tom', 0, 0.05, 2, 2, { hits: '...x...x' }),
        L('trill', 'line', 'celesta', 12, 0.018, 1, 1, { notes: 'r:2 11:.25 12:.25 11:.25 12:.25 14 | r:4 | r:4 | r:4 | r:2 11:.25 12:.25 11:.25 12:.25 14 | r:4 | r:4 | r:2 9:.25 10:.25 9:.25 10:.25 11' }),   // a-story8: the Isveli's signature — a frost trill under a glassy top note
      ],
      B: { chords: '5:4 | 1:4 | 2:4 | 6:4 | 5:4 | 1:4 | 3:2 1:2 | 0:4', lines: { mel: '9:2 8 7 | 8:2 5:2 | 6 7 9 11 | 10:3 r | 9:2 11 12 | 11:2 8:2 | 7 8 6:2 | 7:4' } },
    },
    // Lichtbrücke — a choir pad that soars (lydian I II vi II), bells above it, a high voice climbing to the ninth
    bridge: {
      bpm: 60, mode: 'lydian', len: 8, own: true, arc: [0.75, 0.8, 0.88, 0.85, 0.92, 1, 0.95, 0.85],
      chords: '0:4 | 1:4 | 5:4 | 1:4 | 0:4 | 2:4 | 1:4 | 0:4',
      layers: [
        L('choir', 'chord', 'choir', 0, 0.034, 0, 2),
        L('mel', 'line', 'bell', 12, 0.045, 0, 3, { notes: '0 4 7:2 | 8 5 3:2 | 2 5 7 9 | 8:4 | 7 9 11:2 | 9:2 6:2 | 5 3 8:2 | 7:4' }),
        L('hi', 'line', 'choir', 12, 0.022, 1, 2, { notes: '4:4 | 5:4 | 7:4 | 8:4 | 9:4 | 6:2 9:2 | 8:4 | 7:4' }),
        L('spark', 'arp', 'celesta', 12, 0.012, 1, 1, { pat: [0, 2, 4, 7, 4, 2], step: 0.5, nlen: 1 }),
        L('bass', 'bass', 'hum', -24, 0.04, 1, 2, { pat: [0], plen: 4 }),
      ],
    },
    // Himmelsleiter — the harp's arpeggio rising two octaves every bar, a flute climbing above, the pad opening
    ladder: {
      bpm: 100, mode: 'major', len: 8, own: true, arc: [0.75, 0.8, 0.85, 0.88, 0.9, 0.95, 1, 0.95],
      chords: '0:4 | 4:4 | 5:4 | 3:4 | 0:4 | 4:4 | 3:2 4:2 | 0:4',
      layers: [
        L('arp', 'arp', 'harp', -12, 0.026, 0, 2, { pat: [0, 2, 4, 7, 9, 11, 14, 16], step: 0.5, nlen: 1.5 }),
        L('mel', 'line', 'flute', 0, 0.05, 0, 3, { notes: '0:2 2:2 | 4:4 | 5:2 7:2 | 10:4 | 7:2 9:2 | 11:4 | 10:2 11:2 | 7:4' }),
        L('pad', 'chord', 'pad', -12, 0.03, 1, 1),
        L('bass', 'bass', 'bass', -24, 0.05, 0, 2, { pat: [0, 2], plen: 2 }),
      ],
    },
    // the festivals' dances (four bars a phrase; the forms AB, ABA, BA, ABAB)
    d_bluete: {   // Blütenreigen — a spring round in 3/4, a flute over a harp, a light drum
      bpm: 150, meter: 3, mode: 'major', len: 4, own: true,
      chords: '0:3 | 3:3 | 4:3 | 0:3',
      layers: [
        L('mel', 'line', 'flute', 12, 0.05, 0, 3, { notes: '4 5 7 | 5:2 3 | 1 2 4 | 2:2 0' }),
        L('comp', 'comp', 'harp', -12, 0.016, 0, 2, { beats: [1, 2], nlen: 0.5 }),
        L('bass', 'bass', 'bass', -24, 0.06, 0, 2, { pat: [0], plen: 1 }),
        L('tom', 'drum', 'tom', 0, 0.06, 1, 2, { hits: 'x.....' }),
        L('shaker', 'drum', 'shaker', 0, 0.025, 1, 1, { hits: '..x.x.' }),
      ],
      B: { chords: '5:3 | 3:3 | 4:3 | 0:3', lines: { mel: '7 9 7 | 5:2 7 | 6 4 1 | 0:3' } },
    },
    d_drachen: {   // Drachenwind — a summer reel, mallets in eighths, the kick, the shaker, a clap
      bpm: 132, mode: 'major', len: 4, own: true,
      chords: '0:4 | 4:4 | 5:2 3:2 | 4:2 0:2',
      layers: [
        L('mel', 'line', 'mallet', 12, 0.06, 0, 3, { notes: '0:.5 2:.5 4:.5 2:.5 4:.5 5:.5 7 | 6:.5 4:.5 6:.5 8:.5 6 4 | 7:.5 5:.5 2:.5 0:.5 3:.5 5:.5 7 | 6:.5 4:.5 1:.5 4:.5 2 0' }),
        L('osti', 'osti', 'pluck', -12, 0.03, 0, 2, { pat: [0, 4, 2, 4, 0, 4, 2, 4] }),
        L('bass', 'bass', 'bass', -24, 0.065, 0, 2, { pat: [0, 2], plen: 0.5 }),
        L('kick', 'drum', 'kick', 0, 0.14, 1, 2, { hits: 'x...x...' }),
        L('shaker', 'drum', 'shaker', 0, 0.03, 1, 1, { hits: '.x.x.x.x' }),
        L('clap', 'drum', 'clap', 0, 0.05, 2, 1, { hits: '..x...x.' }),
      ],
      B: { chords: '3:4 | 0:4 | 1:2 4:2 | 0:4', lines: { mel: '5:.5 7:.5 5:.5 3:.5 0 3 | 4:.5 2:.5 4:.5 7:.5 4 2 | 1:.5 3:.5 5:.5 3:.5 4:.5 6:.5 8 | 7:3 r' } },
    },
    d_tafel: {   // Laubtafel — an autumn dance in 3/4 for the long tables: a reed, strings struck, a frame drum
      bpm: 138, meter: 3, mode: 'major', len: 4, own: true,
      chords: '0:3 | 4:3 | 4:3 | 0:3',
      layers: [
        L('mel', 'line', 'reed', 0, 0.05, 0, 3, { notes: '2 4 2 | 1 6:2 | 1 4 6 | 7:2 r' }),
        L('comp', 'comp', 'harp', -12, 0.018, 0, 2, { beats: [1, 2], nlen: 0.5 }),
        L('bass', 'bass', 'bass', -24, 0.07, 0, 2, { pat: [0], plen: 1 }),
        L('tom', 'drum', 'tom', 0, 0.07, 1, 2, { hits: 'x.....' }),
        L('shaker', 'drum', 'shaker', 0, 0.025, 1, 1, { hits: '..x.x.' }),
      ],
      B: { chords: '3:3 | 0:3 | 4:3 | 0:3', lines: { mel: '3 5 7 | 4 2:2 | 1 4 6 | 0:2 r' } },
    },
    d_lichter: {   // Lichterbaum — a gentle winter dance in 3/4 round the lantern tree: a celesta, a music box, no drums
      bpm: 108, meter: 3, mode: 'major', len: 4, own: true,
      chords: '0:3 | 5:3 | 4:3 | 0:3',
      layers: [
        L('mel', 'line', 'celesta', 12, 0.05, 0, 3, { notes: '4:2 7 | 9:2 7 | 6 4 1 | 2:2 r' }),
        L('comp', 'comp', 'musicbox', 0, 0.014, 0, 2, { beats: [1, 2], nlen: 0.6 }),
        L('bass', 'bass', 'bass', -24, 0.055, 0, 2, { pat: [0], plen: 3 }),
        L('bell', 'line', 'bell', 12, 0.02, 1, 1, { notes: 'r:2 7 | r:3 | r:3 | r:2 7' }),
      ],
      B: { chords: '3:3 | 0:3 | 4:3 | 0:3', lines: { mel: '5:2 3 | 4:2 2 | 1 4 6 | 7:2 r', bell: 'r:2 5 | r:3 | r:3 | r:2 7' } },
    },
    // the stingers
    glimpse: {   // a wander moment: a celesta flickering up from II to I in lydian
      bpm: 96, mode: 'lydian', len: 2, sting: true, own: true,
      chords: '1:4 | 0:4',
      layers: [
        L('mel', 'line', 'celesta', 12, 0.05, 0, 3, { notes: '3:.5 5:.5 8:.5 10:.5 12:2 | 11:.5 9:.5 7:3' }),
        L('pad', 'chord', 'pad', -12, 0.026, 0, 2),
      ],
    },
    friend: {   // a fairy place found, a Flausel greeted: a cheeky hop on a music box
      bpm: 140, mode: 'major', len: 2, sting: true, own: true,
      chords: '0:4 | 4:2 0:2',
      layers: [
        L('mel', 'line', 'musicbox', 12, 0.06, 0, 3, { notes: '4:.5 2:.5 4:.5 7:.5 r 9:.5 r:.5 | 8:.5 6:.5 4 7:2' }),
        L('bass', 'bass', 'harp', -12, 0.035, 0, 2, { pat: [0, 2], plen: 1 }),
      ],
    },
    welcome: {   // a family moves in: a warm cadence, a flute, strings, a bell
      bpm: 92, mode: 'major', len: 2, sting: true, own: true,
      chords: '0:2 3:2 | 4:2 0:2',
      layers: [
        L('mel', 'line', 'flute', 0, 0.055, 0, 3, { notes: '4 5 7:2 | 6 8 7:2' }),
        L('str', 'chord', 'strings', -12, 0.03, 0, 2),
        L('bell', 'line', 'bell', 0, 0.025, 0, 1, { notes: 'r:2 12:2 | r:2 14:2' }),
      ],
    },
    freed: {   // the outpost freed: vi IV I, brass rising over a choir
      bpm: 84, mode: 'major', len: 3, sting: true, own: true,
      chords: '5:4 | 3:4 | 0:4',
      layers: [
        L('mel', 'line', 'brass', 0, 0.055, 0, 3, { notes: '0:.5 2:.5 4:.5 5:.5 7:2 | 10:1.5 9:.5 7:2 | 7:4' }),
        L('choir', 'chord', 'choir', -12, 0.03, 0, 2),
        L('bass', 'bass', 'bass', -24, 0.055, 0, 2, { pat: [0], plen: 4 }),
      ],
    },
  };
  Object.assign(S.THEMES, T);
  for (const id of ['meadow', 'harbour', 'fairy', 'waltz']) S.FORMS[id] = ['A', 'AB', 'BA', 'AB'];
  for (const id of ['p_aqua', 'p_ocker', 'p_zinn', 'p_basalt', 'p_opal']) S.FORMS[id] = ['AB', 'A', 'BA', 'AB'];   // a-story8: the peoples' themes with their B-sections
  for (const id of ['d_bluete', 'd_drachen', 'd_tafel', 'd_lichter']) S.FORMS[id] = ['AB', 'ABA', 'BA', 'ABAB'];
  Object.assign(S.GAP, { glimpse: 45, friend: 90, welcome: 60, freed: 20 });

  // ---------------------------------------------------------------- the dance of a festival
  const SEASON_DANCE = ['d_bluete', 'd_drachen', 'd_tafel', 'd_lichter'];
  const PEOPLE_FEST = { gezeiten: 'aqua', sandstern: 'ocker', funkel: 'zinn', steinglut: 'basalt', eisbluete: 'opal' };
  S.danceOf = function (festId, season) {
    if (festId && T['d_' + festId]) return { id: 'd_' + festId, variant: 'dance' };
    if (festId && PEOPLE_FEST[festId]) return { id: 'p_' + PEOPLE_FEST[festId], variant: 'pdance' };
    return { id: SEASON_DANCE[season >= 0 ? season & 3 : 1], variant: 'dance' };
  };
  S.PEOPLES = { aqua: 'Wellari', ocker: 'Dunelin', zinn: 'Glimari', basalt: 'Regoli', opal: 'Isveli' };

  // ---------------------------------------------------------------- the selection
  const P = S.Director.prototype, want0 = P.want;
  const ROT_DAY = ['home', 'wander', 'meadow', 'wander'], ROT_NIGHT = ['lullaby', 'wander', 'home'];
  const ROT = { harbour: ['harbour', 'wander'], fairy: ['fairy', 'wander'], circle: ['waltz', 'wander'] };
  P.want = function (c) {
    if (!c.aware || c.boss > 0 || c.danger) return want0.call(this, c);
    if (c.journey) return { id: c.journey === 'lift' ? 'ladder' : 'bridge', variant: 'day', lv: 1, urgent: true, pk: 'j:' + c.journey };
    if (c.festival) { const d = S.danceOf(c.festId, c.season); return { id: d.id, variant: d.variant, lv: this.calm ? 1 : 2, urgent: false, pk: 'fest' }; }
    const w = want0.call(this, c);
    if ((w.id !== 'home' && w.id !== 'wander') || c.story || c.cave) return w;
    if (c.storm) return { id: 'none', pk: 'storm' };
    const night = c.night > 0.5, v = c.building ? 'build' : night ? 'night' : c.dusk ? 'dusk' : c.snowing ? 'snow' : c.rain ? 'rain' : 'day';
    const rot = ROT[c.place] || (c.people && T['p_' + c.people] ? ['p_' + c.people, 'wander'] : night ? ROT_NIGHT : ROT_DAY);
    const pk = c.place || (c.people ? 'p:' + c.people : 'home');
    const id = this.lastPk !== undefined && this.lastPk !== pk ? rot[0] : rot[this.rot % rot.length];   // a new place opens with its theme
    return { id, variant: v, lv: v === 'day' && id !== 'wander' ? 1 : 0, urgent: false, pk };
  };

  // ---------------------------------------------------------------- the place context (four times a second)
  const HARBOUR = [0, -140, 95];   // Palmenhafen in the Heartland (intent.js / eventlog.js HEART: 'nova')
  const PEOPLE = { aqua: 1, ocker: 1, zinn: 1, basalt: 1, opal: 1 };
  const gather0 = S.gather;
  S.gather = function (g, s, out) {
    out = gather0(g, s, out);
    out.aware = true; out.place = ''; out.people = ''; out.season = -1; out.rain = false; out.snowing = false; out.storm = false; out.dusk = false; out.journey = ''; out.festId = '';
    if (!g) return out;
    try {
      const p = g.player && g.player.pos, E = g.env, dim = g.dim || 'overworld', m = g.meta;
      if (E) {
        const tod = +E.timeOfDay || 0; out.dusk = tod > 10800 && tod < 13200;
        out.storm = (E.thunder | 0) > 0; out.rain = (+E.rain || 0) > 0.3; out.snowing = (+E.snow || 0) > 0.3;
      }
      const SS = VR.Seasons; if (SS && SS.cur && (!SS.on || SS.on(g))) out.season = SS.cur.idx | 0;
      if (p && dim === 'overworld' && m && (m.vgen | 0) >= 3 && m.type !== 'flat') {
        const dx = p[0] - HARBOUR[0], dz = p[2] - HARBOUR[1]; if (dx * dx + dz * dz < HARBOUR[2] * HARBOUR[2]) out.place = 'harbour';
      }
      const FS = VR.Fairy && VR.Fairy.state;
      if (!out.place && FS && FS.near && FS.nearD < 55) out.place = FS.near.kind === 'circle' ? 'circle' : 'fairy';
      if (out.place === 'fairy' || out.place === 'circle') out.colour = 'fairy'; else if (out.place === 'harbour') out.colour = 'harbour';
      const D = VR.DimReg && VR.DimReg.get && VR.DimReg.get(dim); if (D && PEOPLE[D.body]) out.people = D.body;
      const JY = VR.Journey; if (JY && JY.stats) { const k = JY.stats().kind; if (k === 'lift' || k === 'bridge') out.journey = k; }
      if (out.festival) {
        const V = g.villages, vil = V && V.festivalNear ? V.festivalNear() : null, ss = vil && V.ssToday ? V.ssToday(vil) : null;
        out.festId = ss && ss.phase === 'fest' ? ss.id || '' : '';
      }
    } catch (e) { /* the music never breaks the game */ }
    return out;
  };

  // ---------------------------------------------------------------- the voices
  const hz = SY.hz;
  function env(g, t, a, peak, end) { const p = g.gain; p.setValueAtTime(0.0001, t); p.linearRampToValueAtTime(peak, t + a); p.exponentialRampToValueAtTime(0.0001, end); }
  function envHold(g, t, a, peak, rel, end) { const p = g.gain; p.setValueAtTime(0.0001, t); p.linearRampToValueAtTime(peak, t + a); if (end - rel > t + a) p.setValueAtTime(peak, end - rel); p.exponentialRampToValueAtTime(0.0001, end); }
  function osc(c, type, f, t, end, det) { const o = c.createOscillator(); o.type = type; o.frequency.value = f; if (det) o.detune.value = det; o.start(t); o.stop(end + 0.05); return o; }
  function partial(c, dest, f, t, end, amp, dec) { const g = c.createGain(); g.gain.setValueAtTime(amp, t); g.gain.exponentialRampToValueAtTime(0.001, t + dec); g.connect(dest); osc(c, 'sine', f, t, Math.min(end, t + dec + 0.05)).connect(g); }
  const LUSH = { celesta: 1, musicbox: 1, harp: 1, choir: 1, hum: 1, flute: 1 };
  const EXTRA = {
    // celesta: a sine and its fourth partial, struck and dying away
    celesta(c, g, ev, t, d, G, tl, lo) { const end = t + Math.max(1.0, d * 1.2) + tl; env(g, t, 0.003, G, end); osc(c, 'sine', ev.f, t, end).connect(g); if (lo) return { n: 1, end }; partial(c, g, ev.f * 4, t, end, 0.25, 0.25); return { n: 2, end }; },
    // music box: a sine and a high inharmonic tine that rings for a moment
    musicbox(c, g, ev, t, d, G, tl, lo) { const end = t + 1.6 + tl; env(g, t, 0.002, G, end); osc(c, 'sine', ev.f, t, end).connect(g); if (lo) return { n: 1, end }; partial(c, g, ev.f * 5.93, t, end, 0.3, 0.14); return { n: 2, end }; },
    // mallet: a wooden bar — a sine and its (nearly) fourth partial, short
    mallet(c, g, ev, t, d, G, tl, lo) { const end = t + Math.min(0.9, d + 0.4) + tl; env(g, t, 0.003, G, end); osc(c, 'sine', ev.f, t, end).connect(g); if (lo) return { n: 1, end }; partial(c, g, ev.f * 3.99, t, end, 0.3, 0.08); return { n: 2, end }; },
    // harp: a triangle through a lowpass that closes slowly (the string's brightness fades), a long ring
    harp(c, g, ev, t, d, G, tl, lo, hi) {
      const end = t + Math.max(1.4, d) + tl; env(g, t, 0.004, G, end);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.8; lp.frequency.setValueAtTime(Math.min(9000, ev.f * 6 * ev.tn), t); lp.frequency.exponentialRampToValueAtTime(Math.max(300, ev.f * 2 * ev.tn), t + 0.6); lp.connect(g);
      osc(c, 'triangle', ev.f, t, end).connect(lp); if (!hi) return { n: 1, end };
      partial(c, g, ev.f * 2, t, end, 0.15, 0.5); return { n: 2, end };
    },
    // flute: a sine with a little triangle, a soft attack (the shared vibrato on High)
    flute(c, g, ev, t, d, G, tl, lo, hi, vib) { const end = t + d + (tl || 0.15); envHold(g, t, 0.07, G, tl || Math.min(0.3, d * 0.4), end); vib(osc(c, 'sine', ev.f, t, end, 3)).connect(g); if (lo) return { n: 1, end }; const g2 = c.createGain(); g2.gain.value = 0.2; g2.connect(g); osc(c, 'triangle', ev.f, t, end).connect(g2); return { n: 2, end }; },
    // choir: two detuned saws through two vowel bands ('ah' and its second formant), a slow swell
    choir(c, g, ev, t, d, G, tl, lo, hi, vib) {
      const rel = tl || Math.min(1.2, d * 0.4), end = t + d + (tl || rel * 0.8); envHold(g, t, Math.min(0.6, d * 0.3), G, rel, end);
      if (lo) { const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.min(3000, ev.f * 3); lp.connect(g); osc(c, 'triangle', ev.f, t, end).connect(lp); return { n: 1, end }; }
      const mix = c.createGain(); mix.gain.value = 1; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.min(4000, 2600 * ev.tn); lp.connect(g);
      const f1 = c.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 660; f1.Q.value = 2.5; const f2 = c.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1100; f2.Q.value = 3.5;
      const g2 = c.createGain(); g2.gain.value = 0.6; mix.connect(f1); mix.connect(f2); f1.connect(lp); f2.connect(g2); g2.connect(lp);
      let n = 0; for (const det of hi ? [-11, 0, 10] : [-9, 9]) { vib(osc(c, 'sawtooth', ev.f, t, end, det)).connect(mix); n++; }
      return { n, end };
    },
    // brass: two saws through a lowpass that blooms open and settles (the ember brass of the Glimari)
    brass(c, g, ev, t, d, G, tl, lo, hi, vib) {
      const end = t + d + (tl || 0.12); envHold(g, t, 0.06, G, tl || Math.min(0.3, d * 0.4), end);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.8; lp.frequency.setValueAtTime(ev.f * 1.2, t); lp.frequency.linearRampToValueAtTime(Math.min(6000, ev.f * 4), t + 0.12); lp.frequency.exponentialRampToValueAtTime(Math.min(4000, ev.f * 2.6), t + Math.max(0.2, d)); lp.connect(g);
      vib(osc(c, 'sawtooth', ev.f, t, end, -4)).connect(lp); if (lo) return { n: 1, end }; vib(osc(c, 'sawtooth', ev.f, t, end, 6)).connect(lp); return { n: 2, end };
    },
    // hum: a deep voice — a sine and a sine a hair apart (they beat slowly), a slow swell
    hum(c, g, ev, t, d, G, tl, lo, hi) {
      const rel = tl || Math.min(1.5, d * 0.5), end = t + d + (tl || rel * 0.8); envHold(g, t, Math.min(0.5, d * 0.3), G, rel, end);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.min(1200, ev.f * 5); lp.Q.value = 0.7; lp.connect(g);
      osc(c, 'sine', ev.f, t, end).connect(lp); if (lo) return { n: 1, end }; osc(c, 'triangle', ev.f, t, end, 4).connect(lp); return { n: 2, end };
    },
    // tom: a frame drum — a sine falling in pitch and a short band of noise (the hand on the skin)
    tom(c, g, ev, t, d, G, tl, lo) {
      const end = t + 0.45; g.gain.setValueAtTime(G, t); g.gain.exponentialRampToValueAtTime(0.0005, end);
      const o = osc(c, 'sine', 160, t, end); o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(82, t + 0.2); o.connect(g);
      if (lo) return { n: 1, end };
      const s = c.createBufferSource(); s.buffer = SY.noise(c); const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 1;
      const g2 = c.createGain(); g2.gain.setValueAtTime(0.5, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.06); s.connect(bp); bp.connect(g2); g2.connect(g); s.start(t, ((t * 5) % 0.3 + 0.3) % 0.3, 0.08);
      return { n: 2, end };
    },
    // shaker: a soft band of high noise, a short swish
    shaker(c, g, ev, t, d, G) {
      const end = t + 0.09; const s = c.createBufferSource(); s.buffer = SY.noise(c);
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 5200; bp.Q.value = 0.9; s.connect(bp); bp.connect(g);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(G, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0005, end); s.start(t, ((t * 3) % 0.3 + 0.3) % 0.3, 0.11);
      return { n: 1, end };
    },
  };
  const note0 = SY.note;
  SY.note = function (c, dest, ev, t, o) {
    const fn = EXTRA[ev.inst]; if (!fn) return note0(c, dest, ev, t, o);
    o = o || {};
    const tier = o.tier !== undefined ? o.tier : o.lowEnd ? 0 : 1, lo = !!o.lowEnd || tier === 0, hi = tier >= 3 && !lo;
    const g = c.createGain(); g.connect(dest);
    if (o.rev && !lo && LUSH[ev.inst]) g.connect(o.rev);
    if (o.room && tier >= 2 && !lo && ev.inst !== 'tom' && ev.inst !== 'shaker') g.connect(o.room);
    if (o.chorus && hi && (ev.inst === 'choir' || ev.inst === 'hum')) g.connect(o.chorus);
    const vib = (x) => { if (hi && o.lfo) o.lfo.connect(x.detune); return x; };
    const e2 = { f: ev.midi ? hz(ev.midi) : 0, tn: ev.tone || 1 };
    return fn(c, g, e2, t, Math.max(0.05, ev.dur), ev.gain, ev.tail || 0, lo, hi, vib);
  };
  Object.assign(SY.VOICES, { celesta: 2, musicbox: 2, mallet: 2, harp: 1, flute: 2, choir: 2, brass: 2, hum: 2, tom: 2, shaker: 1 });
  const voices0 = SY.voicesOf, ONE = { celesta: 1, musicbox: 1, mallet: 1, harp: 1, flute: 1, choir: 1, brass: 1, hum: 1, tom: 1, shaker: 1 };
  SY.voicesOf = function (inst, lowEnd, tier) {
    if (!EXTRA[inst]) return voices0(inst, lowEnd, tier);
    if (lowEnd || tier === 0) return ONE[inst];
    if (tier >= 3) return inst === 'choir' ? 3 : inst === 'harp' ? 2 : SY.VOICES[inst];
    return inst === 'harp' ? 1 : SY.VOICES[inst];
  };
})(VR);

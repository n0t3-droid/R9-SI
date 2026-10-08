// ============================================================================
// Klang (F4): the pure parts of the synthesized sound. Material families and their recipes (footsteps, place and
// break), the mapping from a block to its family (the name first, then the sound key), the bounded variations, the UI
// voices (≤ 60 ms, −18 dB) and the seeded pentatonic plan of the music. No AudioContext in here: audio.js plays these
// recipes, and test/klang.js checks them.
// ============================================================================
(function (VR) {
  'use strict';
  // the families: every block has exactly one (familyOf); each has a footstep recipe and a place/break recipe
  const FAMILIES = ['grass', 'dirt', 'stone', 'wood', 'sand', 'snow', 'gravel', 'metal', 'carpet', 'water', 'glass'];
  // a recipe: a noise burst through a band ('bp' band-pass, 'hp' high-pass, 'lp' low-pass) at f Hz with width q, lasting
  // dur seconds at peak g; body [from Hz, to Hz, seconds, gain] is a sine thump that falls; ring [[Hz, gain, seconds], …]
  // are tonal partials that ring out; clicks is the number of micro-clicks (the crackle of breaking progress)
  const RECIPES = {
    grass: { step: { kind: 'bp', f: 2400, q: 0.7, dur: 0.12, g: 0.22 }, hit: { kind: 'bp', f: 2600, q: 0.7, dur: 0.07, g: 0.22 } },
    dirt: { step: { kind: 'lp', f: 700, q: 0.7, dur: 0.14, g: 0.5, body: [120, 70, 0.14, 0.5] }, hit: { kind: 'lp', f: 520, q: 0.8, dur: 0.14, g: 0.6, body: [110, 60, 0.16, 0.5] } },
    stone: { step: { kind: 'bp', f: 1900, q: 1.6, dur: 0.08, g: 0.45, body: [260, 180, 0.06, 0.18] }, hit: { kind: 'bp', f: 2400, q: 1.5, dur: 0.06, g: 0.5, body: [330, 210, 0.05, 0.2] } },
    wood: { step: { kind: 'bp', f: 900, q: 2.2, dur: 0.09, g: 0.5, body: [210, 130, 0.09, 0.35] }, hit: { kind: 'bp', f: 700, q: 2.5, dur: 0.09, g: 0.6, body: [200, 120, 0.12, 0.45] } },
    sand: { step: { kind: 'hp', f: 3000, q: 0.5, dur: 0.12, g: 0.3 }, hit: { kind: 'hp', f: 4200, q: 0.5, dur: 0.12, g: 0.26 } },
    snow: { step: { kind: 'bp', f: 2400, q: 0.5, dur: 0.14, g: 0.2 }, hit: { kind: 'bp', f: 1200, q: 0.6, dur: 0.08, g: 0.22 } },
    gravel: { step: { kind: 'bp', f: 1700, q: 0.8, dur: 0.09, g: 0.5, clicks: 3 }, hit: { kind: 'bp', f: 1600, q: 0.8, dur: 0.09, g: 0.5, clicks: 4 } },
    metal: { step: { kind: 'bp', f: 3000, q: 3, dur: 0.06, g: 0.3, ring: [[2100, 0.12, 0.35], [4300, 0.06, 0.25]] }, hit: { kind: 'bp', f: 4000, q: 4, dur: 0.02, g: 0.2, ring: [[1046, 0.22, 0.9], [2760, 0.11, 0.6]] } },
    carpet: { step: { kind: 'lp', f: 600, q: 0.5, dur: 0.1, g: 0.3 }, hit: { kind: 'lp', f: 800, q: 0.6, dur: 0.07, g: 0.25 } },
    water: { step: { kind: 'bp', f: 900, q: 0.8, dur: 0.2, g: 0.35, body: [380, 200, 0.18, 0.25] }, hit: { kind: 'bp', f: 700, q: 0.9, dur: 0.22, g: 0.35, body: [380, 200, 0.18, 0.3] } },
    glass: { step: { kind: 'bp', f: 4200, q: 6, dur: 0.2, g: 0.3, ring: [[3800, 0.12, 0.35], [5200, 0.07, 0.25]] }, hit: { kind: 'hp', f: 5200, q: 2, dur: 0.04, g: 0.2, ring: [[3800, 0.2, 0.4], [5800, 0.12, 0.3]] } },
  };
  // the place and break voice of each family: thock (wood), clack (stone), tink (glass), thud (dirt), ding (metal) …
  const HIT = { grass: 'pat', dirt: 'thud', stone: 'clack', wood: 'thock', sand: 'shh', snow: 'pff', gravel: 'crunch', metal: 'ding', carpet: 'pff', water: 'plop', glass: 'tink' };

  // the mapping: a block's name first (dirt's sound is 'gravel' in the registry, wool is carpet, not snow), then its
  // sound key; an unknown block is stone, never nothing
  const NAME_RULES = [
    [/^(dirt|coarse_dirt|rooted_dirt|podzol|farmland|dirt_path|mud|packed_mud|mud_bricks|clay)/, 'dirt'],
    [/^(grass_block|moss|mycelium)/, 'grass'],
    [/snow/, 'snow'],
    [/sandstone/, 'stone'],
    [/sand/, 'sand'],
    [/gravel/, 'gravel'],
    [/wool|carpet|cobweb/, 'carpet'],
    [/glass|amethyst/, 'glass'],
    [/^water$/, 'water'],
  ];
  const SOUND = {
    wood: 'wood', planks: 'wood', bamboo: 'wood', scaffold: 'wood', ladder: 'wood', resin: 'wood', chest: 'wood', lectern: 'wood',
    metal: 'metal', anvil: 'metal', chain: 'metal', lantern: 'metal', lodestone: 'metal', copper: 'metal',
    stone: 'stone', deep: 'stone', dripstone: 'stone', basalt: 'stone', calcite: 'stone', echo: 'stone', bone: 'stone', pot: 'stone', candle: 'stone', ember: 'stone', lava: 'stone', coral: 'stone',
    glass: 'glass', amethyst: 'glass', froglight: 'glass',
    wool: 'carpet', cobweb: 'carpet', sponge: 'carpet', honey: 'carpet', slime: 'carpet', egg: 'carpet',
    grass: 'grass', plant: 'grass', leaves: 'grass', moss: 'grass', vine: 'grass', crop: 'grass', roots: 'grass', nylium: 'grass', wart: 'grass',
    mud: 'dirt', gravel: 'gravel', sand: 'sand', soul: 'sand', snow: 'snow', water: 'water',
  };
  function familyOf(name, sound) {
    const n = name === undefined || name === null ? '' : String(name), s = sound === undefined || sound === null ? '' : String(sound);
    for (const [re, fam] of NAME_RULES) if (re.test(n)) return fam;
    return SOUND[s] || 'stone';
  }

  // the bounded variation: a footstep or a hit never sounds the same twice. The pitch moves by at most ±6 % (r in [0, 1));
  // the timbre is one of two (heel or toe); a step is louder when sprinting, softer and darker when crouching, and
  // grows a little with the speed (the tempo itself is the distance walked: audio.js steps every 2.2 blocks)
  const pitchFactor = (r) => 1 + (r * 2 - 1) * 0.06;
  const timbre = (r) => (r < 0.5 ? 0 : 1);
  function stepGain(speed, crouch, sprint) {
    const base = Math.min(1.3, Math.max(0.7, 0.7 + (+speed || 0) / 10));
    return base * (crouch ? 0.4 : 1) * (sprint && !crouch ? 1.25 : 1);
  }

  // the UI voices: tiny, never longer than 60 ms, peaking at −18 dBFS (10^(−18/20))
  const DB18 = Math.pow(10, -18 / 20);
  const UI = {
    click: { dur: 0.03, peak: DB18 },
    pling: { dur: 0.06, peak: DB18 },
    bonk: { dur: 0.06, peak: DB18 },
    rustle: { dur: 0.06, peak: DB18 },
  };

  // the music: pentatonic only, so no two notes of a day can clash. A day's plan comes from its own seed: the mode
  // (major or minor), the transposition, four chord degrees and a motif over seven degrees
  const SCALE = { major: [0, 2, 4, 7, 9], minor: [0, 3, 5, 7, 10] };
  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function seedOf(day) {
    let h = Math.imul((day | 0) + 0x9e3779b9, 0x85ebca6b) ^ 0x2545f491;
    h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return h >>> 0;
  }
  function musicPlan(day) {
    const r = rng(seedOf(day));
    const mode = r() < 0.6 ? 'major' : 'minor';
    const root = 57 + Math.floor(r() * 12);                 // A3 … G♯4: a transposition per day
    const prog = [], motif = [];
    for (let i = 0; i < 4; i++) prog.push(Math.floor(r() * 5));   // chord degrees 0…4 of the pentatonic scale
    for (let i = 0; i < 8; i++) motif.push(Math.floor(r() * 7));  // motif degrees 0…6 (one octave and a bit)
    return { day: day | 0, mode, scale: SCALE[mode], root, prog, motif };
  }
  // the MIDI note of a pentatonic degree d (may be negative or above five) over a plan's root
  function degreeMidi(plan, d) { const s = plan.scale, k = ((d % 5) + 5) % 5; return plan.root + s[k] + 12 * Math.floor(d / 5); }

  VR.Klang = { FAMILIES, RECIPES, HIT, NAME_RULES, SOUND, familyOf, pitchFactor, timbre, stepGain, UI, DB18, SCALE, rng, seedOf, musicPlan, degreeMidi };
})(VR);

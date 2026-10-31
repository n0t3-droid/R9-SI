// ============================================================================
// Das Buch „Funke und die Leuchtfeuer" (a-story; plan docs/superpowers/plans/2026-10-29-a-story.md, spec
// docs/superpowers/specs/2026-10-22-abenteuer-design.md §9). Pure: the chapters, the beats, the rules that say when a
// beat may be offered, the record of what was seen and the postpone machine. No DOM, no game — test/story.js.
//   Premise (ours): long ago the Leuchtfeuer linked the towns of Herzwelt with its moons and the stars. Then the Stille
//   came: the beacons went dark, the worker machines lost their way. In the Hangar Hall a small drone wakes up — Funke —
//   and with the player relights the network, beacon by beacon, world by world, until they find where the Stille comes
//   from: Echo, the network's old mind, alone at the edge of a black hole. The ending heals, it does not destroy.
//   Twelve chapters; 1–4 written in full (three beats each), 5–12 as titles and loglines. Every word is in the language
//   tables (lang_de.js first, lang_en.js): story.c<ch>.title · .where · .log, story.c<ch>.b<n>.<k> (the lines),
//   story.who.<speaker>.
//   A beat (A§9): { id, ch, n, when: {after, place, anyAfter, hours, adv, near, freed, high, orbit, dim, eclipse,
//   calm}, scene: {shots: [{cam, target, dur}], lines: [{who, key}], music}, task: {kind, target}, reward: {xp} }.
//   when holds — Story.why(beat, ctx) → null; else the first reason ('done', 'after', 'calm', 'building', 'fight',
//   'menu', 'studio', 'landing', 'scene', 'guest', 'adv', 'place', 'hour', 'near', 'freed', 'high', 'orbit', 'dim',
//   'eclipse'). ctx: {calm (s without building or a fight), building, fighting, menu, studio, landing, scene, guest,
//   place (the life director's place), hour, played (s in this world), adv (an Abenteuer world), near: {outpost: m},
//   freed (places freed), high (m over the sea, or in a ship), orbit, dim, eclipse (0…1)}.
//   The record (meta.story): {v: 1, beats: {id: 'done' | 'skip'}, later: {id: {n, at, silent}}} — Story.load sanitises,
//   an old world gets a fresh one. Später: Story.later → again in 5 min, three reminders, then silent in the journal.
// ============================================================================
(function (VR) {
  'use strict';
  const S = VR.Story = VR.Story || {};
  S.CALM = 20;          // s of calm before a beat is offered
  S.CALM_ADV = 8;       // a-regie (R52-06): an adventurer's calm before the offer — the story is what they came for
  S.SCENE_MAX = 30;     // s a scene lasts at most
  S.SKIP_AFTER = 1;     // s before a scene may be skipped
  S.REMIND = 300;       // s between two reminders after „Später"
  S.REMINDS = 3;        // reminders at most, then the beat waits silently in the journal
  S.CARD = 25;          // s the offer's card stays (untaken: Später)
  S.WHO = ['funke', 'ilka', 'oskar', 'selma', 'jonte', 'lumi', 'solgani', 'ariveli', 'selkatun', 'anselm', 'dumarin', 'ylosenis', 'flimmi', 'echo'];   // (a-story4: the Dunelin, the Nivari, the star being born, the network's old voice)   // (a-story3: the Glutani, the Wellari, the Regoli, Lumi's grandfather)
  S.MOODS = ['neutral', 'happy', 'surprised', 'worried'];   // a-story2: the portraits' faces (story_art.js)
  S.NOT = ['building', 'fight', 'menu', 'studio', 'landing', 'scene', 'guest'];

  // ---------------------------------------------------------------- the twelve chapters (words: story.c<n>.*)
  S.CHAPTERS = [];
  for (let n = 1; n <= 12; n++) S.CHAPTERS.push({ n, title: 'story.c' + n + '.title', where: 'story.c' + n + '.where', log: 'story.c' + n + '.log', written: true });   // (a-story3: 5–8 written; a-story4: 9–12)

  // ---------------------------------------------------------------- the beats of chapters 1–4
  const L = (ch, n, who) => who.map((w, i) => { const q = w.split(':'); return { who: q[0], key: 'story.c' + ch + '.b' + n + '.' + (i + 1), mood: q[1] || 'neutral' }; });   // a-story2: 'who:mood' (the portrait's face)
  const B = (ch, n, o) => Object.assign({ id: 'c' + ch + '.b' + n, ch, n }, o, { scene: Object.assign({ music: 'warm' }, o.scene, { lines: L(ch, n, o.who) }), who: undefined });
  // a-story3: a beat whose lines depend on a choice (vary: the choice's id; alt: {option: ['who:mood', …]}; keys
  // story.c<ch>.b<n>.<option>.<i>); scene.lines are the first option's (the journal, the keys), linesOf picks
  const LA = (ch, n, opt, who) => who.map((w, i) => { const q = w.split(':'); return { who: q[0], key: 'story.c' + ch + '.b' + n + '.' + opt + '.' + (i + 1), mood: q[1] || 'neutral' }; });
  const BV = (ch, n, o) => { const alt = {}; for (const k of Object.keys(o.alt)) alt[k] = LA(ch, n, k, o.alt[k]); const b = B(ch, n, Object.assign({}, o, { who: [] })); b.scene.alt = alt; b.scene.lines = alt[Object.keys(alt)[0]]; delete b.alt; return b; };
  S.BEATS = [
    // 1 · Funke — the drone flickers awake on a console; the first vista at the golden hour
    B(1, 1, { when: { after: null, place: ['hangar'], anyAfter: 240, adv: false },
      scene: { shots: [{ cam: 'close', target: 'funke', dur: 5 }, { cam: 'shoulder', target: 'funke', dur: 5 }, { cam: 'wide', target: 'player', dur: 5 }], music: 'warm' },
      who: ['funke:surprised', 'funke:worried', 'ilka:happy', 'funke:happy'], task: { kind: 'follow', target: 'vista' }, reward: { xp: 30 }, act: { kind: 'look', target: 'vista', max: 450, cone: 14, hold: 1.5 } }),
    B(1, 2, { when: { after: 'c1.b1', place: ['plaza', 'street', 'hills', 'isles', 'water', 'wild'], adv: false },   // (by day the land, by night its dark hills: the lines fit both)
      scene: { shots: [{ cam: 'wide', target: 'vista', dur: 6 }, { cam: 'orbit', target: 'player', dur: 6 }, { cam: 'shoulder', target: 'vista', dur: 5 }], music: 'wide' },
      who: ['funke', 'ilka:worried', 'funke:happy'], task: { kind: 'go', target: 'outpost' }, reward: { xp: 40 }, act: { kind: 'scan', target: 'outpost', max: 800, cone: 20 } }),
    B(1, 3, { when: { after: 'c1.b2', adv: true, near: { outpost: 700 } },
      scene: { shots: [{ cam: 'shoulder', target: 'outpost', dur: 6 }, { cam: 'wide', target: 'outpost', dur: 6 }], music: 'tense' },
      who: ['oskar', 'oskar:worried', 'funke'], task: { kind: 'go', target: 'outpost' }, reward: { xp: 40 }, act: { kind: 'look', target: 'beacon', max: 200, cone: 12, hold: 1.5 } }),
    // 2 · Das stille Leuchtfeuer — the first beacon turns cyan, a light ring sweeps the canyon
    B(2, 1, { when: { after: 'c1.b3', adv: true, near: { outpost: 140 } },
      scene: { shots: [{ cam: 'close', target: 'beacon', dur: 5 }, { cam: 'orbit', target: 'beacon', dur: 6 }, { cam: 'shoulder', target: 'beacon', dur: 4 }], music: 'tense' },
      who: ['funke:worried', 'funke', 'funke'], task: { kind: 'free', target: 'outpost' }, reward: { xp: 50 }, act: { kind: 'touch', target: 'beacon', max: 4.5 } }),
    B(2, 2, { when: { after: 'c2.b1', adv: true, freed: 1 },
      scene: { shots: [{ cam: 'wide', target: 'beacon', dur: 6 }, { cam: 'orbit', target: 'beacon', dur: 6 }, { cam: 'close', target: 'funke', dur: 4 }], music: 'rise' },
      who: ['funke:happy', 'oskar:surprised', 'oskar:happy', 'funke:happy'], task: { kind: 'go', target: 'home' }, reward: { xp: 80 }, act: { kind: 'look', target: 'beam', max: 1200, cone: 14, hold: 1.5 } }),
    B(2, 3, { when: { after: 'c2.b2', adv: true },
      scene: { shots: [{ cam: 'close', target: 'funke', dur: 5 }, { cam: 'up', target: 'sky', dur: 6 }], music: 'warm' },
      who: ['selma:happy', 'selma', 'funke:surprised'], task: { kind: 'climb', target: 'sky' }, reward: { xp: 40 }, act: { kind: 'scan', target: 'sky', pitch: 35 } }),
    // 3 · Über den Wolken — the world curves away; the station's beacon blinks red over the limb
    B(3, 1, { when: { after: 'c2.b3', adv: true, high: 600 },
      scene: { shots: [{ cam: 'limb', target: 'horizon', dur: 7 }, { cam: 'shoulder', target: 'horizon', dur: 5 }], music: 'wide' },
      who: ['jonte', 'funke:surprised', 'jonte:happy'], task: { kind: 'climb', target: 'orbit' }, reward: { xp: 60 }, act: { kind: 'look', target: 'horizon', high: 400, level: 10, hold: 2 } }),
    B(3, 2, { when: { after: 'c3.b1', adv: true, orbit: true },
      scene: { shots: [{ cam: 'limb', target: 'station', dur: 8 }, { cam: 'close', target: 'station', dur: 6 }], music: 'wide' },
      who: ['funke:surprised', 'funke:worried', 'jonte:happy'], task: { kind: 'go', target: 'station' }, reward: { xp: 100 }, act: { kind: 'photo', target: 'sky', pitch: 15 } }),
    B(3, 3, { when: { after: 'c3.b2', adv: true, dim: ['overworld', 'basalt', 'opal'] },
      scene: { shots: [{ cam: 'up', target: 'amarant', dur: 7 }, { cam: 'close', target: 'funke', dur: 5 }], music: 'warm' },
      who: ['jonte', 'jonte:worried', 'funke:happy'], task: { kind: 'travel', target: 'basalt' }, reward: { xp: 60 }, act: { kind: 'touch', target: 'ground', dim: ['basalt'], ground: true } }),
    // 4 · Die Monde von Amarant — geysers fire round the Eiswächter; Amarant swallows the sun
    B(4, 1, { when: { after: 'c3.b3', adv: true, dim: ['basalt', 'opal'] },
      scene: { shots: [{ cam: 'wide', target: 'player', dur: 6 }, { cam: 'up', target: 'amarant', dur: 6 }], music: 'wide' },
      who: ['funke:worried', 'funke', 'lumi:happy'], task: { kind: 'travel', target: 'opal' }, reward: { xp: 80 }, act: { kind: 'scan', target: 'ice', dim: ['opal'], below: -30 } }),
    B(4, 2, { when: { after: 'c4.b1', adv: true, dim: ['opal'] },
      scene: { shots: [{ cam: 'ice', target: 'warden', dur: 7 }, { cam: 'eye', target: 'warden', dur: 5 }, { cam: 'shoulder', target: 'warden', dur: 4 }], music: 'tense' },
      who: ['funke:worried', 'funke:surprised', 'lumi:surprised', 'funke:happy'], task: { kind: 'wait', target: 'eclipse' }, reward: { xp: 100 }, act: { kind: 'look', target: 'amarant', dim: ['basalt', 'opal'], cone: 16, hold: 2 } }),
    B(4, 3, { when: { after: 'c4.b2', adv: true, dim: ['basalt', 'opal'], eclipse: 0.5 },
      scene: { shots: [{ cam: 'up', target: 'amarant', dur: 8 }, { cam: 'wide', target: 'player', dur: 6 }], music: 'rise' },
      who: ['funke:surprised', 'lumi:surprised', 'lumi:happy', 'funke:happy'], task: { kind: 'next', target: 'c5' }, reward: { xp: 150 }, act: { kind: 'photo', target: 'eclipse', dim: ['basalt', 'opal'], eclipse: 0.5 } }),
    // ================================================================ a-story3 · chapters 5–8 (plan 2026-10-31-a-story3.md)
    // 5 · Feuer und Glas — Zinnober: the Glutani's glass beacon was never broken. It sings. It calls someone.
    B(5, 1, { when: { after: 'c4.b3', adv: true, dim: ['zinn'] },
      scene: { shots: [{ cam: 'wide', target: 'player', dur: 6, fx: 'embers' }, { cam: 'up', target: 'amarant', dur: 6, fx: 'embers', swell: true }, { cam: 'close', target: 'funke', dur: 6 }], music: 'wide' },
      who: ['funke:surprised', 'solgani:happy', 'solgani', 'funke:worried', 'solgani:happy'], task: { kind: 'go', target: 'village' }, reward: { xp: 90 }, act: { kind: 'look', target: 'village', dim: ['zinn'], max: 400, cone: 16, hold: 1.5 } }),
    B(5, 2, { when: { after: 'c5.b1', adv: true, dim: ['zinn'], near: { village: 90 } },
      scene: { shots: [{ cam: 'close', target: 'funke', dur: 6, fx: 'song' }, { cam: 'wide', target: 'village', dur: 7, fx: 'song', swell: true }, { cam: 'shoulder', target: 'village', dur: 6 }], music: 'rise' },
      who: ['funke:surprised', 'solgani', 'funke:surprised', 'solgani:worried'], task: { kind: 'listen', target: 'village' }, reward: { xp: 110 }, act: { kind: 'scan', target: 'village', dim: ['zinn'], max: 200, cone: 22 } }),
    B(5, 3, { when: { after: 'c5.b2', adv: true, dim: ['zinn'] },
      scene: { shots: [{ cam: 'close', target: 'funke', dur: 7, fx: 'hum' }, { cam: 'wide', target: 'player', dur: 6 }, { cam: 'up', target: 'amarant', dur: 6, swell: true }], music: 'tense' },
      who: ['funke:worried', 'solgani:surprised', 'funke:worried', 'solgani'], task: { kind: 'travel', target: 'aqua' }, reward: { xp: 120 }, act: { kind: 'look', target: 'amarant', dim: ['zinn'], cone: 18, hold: 2 } }),
    // 6 · Das Atoll — Aquamarin: Opa Anselm's notes — Funke is a beacon's spark. And a choice.
    B(6, 1, { when: { after: 'c5.b3', adv: true, dim: ['aqua'] },
      scene: { shots: [{ cam: 'wide', target: 'vista', dur: 6, fx: 'spray' }, { cam: 'shoulder', target: 'player', dur: 5 }, { cam: 'close', target: 'funke', dur: 6 }], music: 'wide' },
      who: ['lumi:happy', 'ariveli:happy', 'lumi:surprised', 'funke:happy'], task: { kind: 'dive', target: 'sea' }, reward: { xp: 90 }, act: { kind: 'scan', target: 'sea', dim: ['aqua'], below: -25 } }),
    B(6, 2, { when: { after: 'c6.b1', adv: true, dim: ['aqua'] },
      scene: { shots: [{ cam: 'close', target: 'funke', dur: 7, fx: 'notes' }, { cam: 'wide', target: 'player', dur: 6, fx: 'notes' }, { cam: 'close', target: 'funke', dur: 7, swell: true }], music: 'warm' },
      who: ['lumi:surprised', 'lumi', 'funke:surprised', 'ariveli:worried'], task: { kind: 'go', target: 'village' }, reward: { xp: 130 }, act: { kind: 'photo', target: 'sky', dim: ['aqua'], level: 25 } }),
    B(6, 3, { when: { after: 'c6.b2', adv: true, dim: ['aqua'] }, choice: 'c6',
      scene: { shots: [{ cam: 'wide', target: 'vista', dur: 6 }, { cam: 'shoulder', target: 'player', dur: 6 }, { cam: 'close', target: 'funke', dur: 6, swell: true }], music: 'tense' },
      who: ['ariveli', 'lumi:happy', 'funke:worried'], task: { kind: 'choose', target: 'c6' }, reward: { xp: 120 }, act: { kind: 'look', target: 'vista', dim: ['aqua'], max: 600, cone: 20, hold: 1.5 } }),
    // 7 · Der Sprung — the gate turns aside; the Ringstation's window; the beacons are an arrow; the first star jump
    BV(7, 1, { when: { after: 'c6.b3', adv: true, choice: 'c6', dim: ['overworld', 'aqua', 'zinn', 'ocker', 'basalt', 'opal'] }, vary: 'c6',
      scene: { shots: [{ cam: 'close', target: 'funke', dur: 6, fx: 'hum' }, { cam: 'wide', target: 'player', dur: 6 }], music: 'rise' },
      alt: { wellari: ['funke:surprised', 'ariveli:happy', 'funke:happy'], lumi: ['lumi:surprised', 'funke:surprised', 'lumi:happy'] }, task: { kind: 'gate', target: 'gate' }, reward: { xp: 100 }, act: { kind: 'scan', target: 'sky', pitch: 25 } }),
    BV(7, 2, { when: { after: 'c7.b1', adv: true, dim: ['stn.*'] }, vary: 'c6',
      scene: { shots: [{ cam: 'shoulder', target: 'player', dur: 5 }, { cam: 'window', target: 'window', dur: 9, fx: 'beacons', swell: true }, { cam: 'close', target: 'funke', dur: 7 }], music: 'wide' },
      alt: { wellari: ['funke:surprised', 'anselm:happy', 'funke:surprised', 'anselm'], lumi: ['funke:surprised', 'lumi:surprised', 'anselm:happy', 'anselm'] }, task: { kind: 'jump', target: 'star' }, reward: { xp: 160 }, act: { kind: 'photo', target: 'window', dim: ['stn.*'] } }),
    B(7, 3, { when: { after: 'c7.b2', adv: true, dim: ['x.*'], sun: true },
      scene: { shots: [{ cam: 'wide', target: 'player', dur: 6 }, { cam: 'up', target: 'sky', dur: 7, fx: 'blink2', swell: true }, { cam: 'close', target: 'funke', dur: 6 }], music: 'wide' },
      who: ['funke:surprised', 'anselm', 'funke:worried', 'funke:happy'], task: { kind: 'jump', target: 'binary' }, reward: { xp: 150 }, act: { kind: 'scan', target: 'sky', dim: ['x.*'], pitch: 25 } }),
    // 8 · Zwei Sonnen — the Regoli who stayed to wait; the answer, given by the helper you chose; the beam to the nebula
    B(8, 1, { when: { after: 'c7.b3', adv: true, dim: ['x.*'], suns: 2, sun: true },
      scene: { shots: [{ cam: 'wide', target: 'player', dur: 7, fx: 'twin' }, { cam: 'up', target: 'sky', dur: 6, swell: true }, { cam: 'close', target: 'funke', dur: 5 }], music: 'wide' },
      who: ['funke:surprised', 'selkatun:happy', 'selkatun'], task: { kind: 'go', target: 'village' }, reward: { xp: 120 }, act: { kind: 'look', target: 'village', dim: ['x.*'], max: 400, cone: 18, hold: 1.5 } }),
    BV(8, 2, { when: { after: 'c8.b1', adv: true, dim: ['x.*'], suns: 2, sun: true }, vary: 'c6',
      scene: { shots: [{ cam: 'close', target: 'funke', dur: 6, fx: 'song' }, { cam: 'orbit', target: 'player', dur: 6, fx: 'song', swell: true }, { cam: 'wide', target: 'vista', dur: 6, fx: 'twin' }], music: 'rise' },
      alt: { wellari: ['funke', 'ariveli:happy', 'funke:surprised', 'selkatun:surprised'], lumi: ['lumi', 'lumi:happy', 'funke:surprised', 'selkatun:surprised'] }, task: { kind: 'wait', target: 'sunset' }, reward: { xp: 180 }, act: { kind: 'photo', target: 'sky', dim: ['x.*'], pitch: 3 } }),
    B(8, 3, { when: { after: 'c8.b2', adv: true, dim: ['x.*'], suns: 2 },
      scene: { shots: [{ cam: 'up', target: 'sky', dur: 7, fx: 'beam', swell: true }, { cam: 'close', target: 'funke', dur: 6 }, { cam: 'wide', target: 'player', dur: 6, fx: 'beam' }], music: 'tense' },
      who: ['selkatun:worried', 'funke:worried', 'funke:happy'], task: { kind: 'nebula', target: 'c9' }, reward: { xp: 200 }, act: { kind: 'scan', target: 'sky', dim: ['x.*'], pitch: 20 } }),
    // ================================================================ a-story4 · chapters 9–12 (plan 2026-10-31-a-story4.md)
    // 9 · Im Nebel — inside the nebula it is not dark: a star is being born, and it has always answered
    BV(9, 1, { when: { after: 'c8.b3', adv: true, dim: ['x.*'], neb: true }, vary: 'c6',
      scene: { shots: [{ cam: 'wide', target: 'player', dur: 7, fx: 'nebin' }, { cam: 'up', target: 'sky', dur: 7, fx: 'nebin', swell: true }, { cam: 'close', target: 'funke', dur: 6, fx: 'nebin' }], music: 'wide' },
      alt: { wellari: ['funke:surprised', 'ariveli:happy', 'funke:worried'], lumi: ['funke:surprised', 'lumi:surprised', 'funke:worried'] }, task: { kind: 'listen', target: 'sky' }, reward: { xp: 150 }, act: { kind: 'photo', target: 'sky', dim: ['x.*'], pitch: 15 } }),
    B(9, 2, { when: { after: 'c9.b1', adv: true, dim: ['x.*'], neb: true },
      scene: { shots: [{ cam: 'close', target: 'funke', dur: 8, fx: 'flimmi' }, { cam: 'up', target: 'sky', dur: 9, fx: 'flimmi', swell: true }, { cam: 'close', target: 'funke', dur: 7, fx: 'hum' }], music: 'warm' },
      who: ['flimmi:surprised', 'funke:surprised', 'flimmi:happy', 'flimmi:worried', 'funke:happy'], task: { kind: 'listen', target: 'sky' }, reward: { xp: 220 }, act: { kind: 'scan', target: 'sky', dim: ['x.*'], pitch: 25 } }),
    B(9, 3, { when: { after: 'c9.b2', adv: true, dim: ['x.*'], neb: true },
      scene: { shots: [{ cam: 'wide', target: 'player', dur: 6, fx: 'nebin' }, { cam: 'close', target: 'funke', dur: 6, fx: 'flimmi' }, { cam: 'up', target: 'sky', dur: 7, fx: 'beam', swell: true }], music: 'rise' },
      who: ['flimmi', 'funke:worried', 'flimmi:happy', 'funke:happy'], task: { kind: 'redsun', target: 'c10' }, reward: { xp: 180 }, act: { kind: 'look', target: 'vista', dim: ['x.*'], max: 600, cone: 22, hold: 1.5 } }),
    // 10 · Die geduldige Sonne — a red dwarf, older than all; two peoples and a sleeping beacon; the beam points home
    B(10, 1, { when: { after: 'c9.b3', adv: true, dim: ['x.*'], red: true },
      scene: { shots: [{ cam: 'wide', target: 'player', dur: 7, fx: 'redsun' }, { cam: 'close', target: 'funke', dur: 6 }, { cam: 'wide', target: 'village', dur: 8, fx: 'redsun', swell: true }], music: 'wide' },
      who: ['funke:surprised', 'dumarin:happy', 'dumarin'], task: { kind: 'go', target: 'village' }, reward: { xp: 150 }, act: { kind: 'look', target: 'village', dim: ['x.*'], max: 400, cone: 18, hold: 1.5 } }),
    B(10, 2, { when: { after: 'c10.b1', adv: true, dim: ['x.*'], red: true },
      scene: { shots: [{ cam: 'close', target: 'funke', dur: 6, fx: 'hum' }, { cam: 'orbit', target: 'player', dur: 7, fx: 'song', swell: true }, { cam: 'wide', target: 'vista', dur: 6, fx: 'redsun' }], music: 'warm' },
      who: ['ylosenis:happy', 'ylosenis', 'funke:surprised', 'dumarin:happy'], task: { kind: 'listen', target: 'village' }, reward: { xp: 180 }, act: { kind: 'scan', target: 'village', dim: ['x.*'], max: 250, cone: 22 } }),
    B(10, 3, { when: { after: 'c10.b2', adv: true, dim: ['x.*'], red: true },
      scene: { shots: [{ cam: 'skyline', target: 'lit', dur: 7, fx: 'beam', swell: true }, { cam: 'close', target: 'funke', dur: 6 }, { cam: 'wide', target: 'player', dur: 7, fx: 'beam' }], music: 'tense' },   // (a-story5: the skyline from the Dunelin village, the 3-D beam over its beacon)
      who: ['funke:happy', 'dumarin:worried', 'ylosenis:worried', 'funke:worried'], task: { kind: 'station', target: 'station' }, reward: { xp: 220 }, act: { kind: 'photo', target: 'sky', dim: ['x.*'], pitch: 10 } }),
    // 11 · Echo — five peoples in the Ringstation's heart; the answer Echo can see, given your own way
    B(11, 1, { when: { after: 'c10.b3', adv: true, dim: ['stn.*'] },
      scene: { shots: [{ cam: 'shoulder', target: 'player', dur: 5 }, { cam: 'wide', target: 'player', dur: 9, fx: 'echo', swell: true }, { cam: 'close', target: 'funke', dur: 7, fx: 'echo' }], music: 'wide' },
      who: ['anselm:happy', 'solgani:happy', 'dumarin:happy', 'ylosenis:happy', 'funke:worried'], task: { kind: 'listen', target: 'station' }, reward: { xp: 200 }, act: { kind: 'look', target: 'window', dim: ['stn.*'], cone: 25, hold: 1.5 } }),
    BV(11, 2, { when: { after: 'c11.b1', adv: true, dim: ['stn.*'] }, vary: 'c6', choice: 'how',
      scene: { shots: [{ cam: 'close', target: 'funke', dur: 6, fx: 'echo' }, { cam: 'wide', target: 'player', dur: 7, fx: 'echo', swell: true }, { cam: 'shoulder', target: 'player', dur: 6 }], music: 'tense' },
      alt: { wellari: ['anselm', 'funke', 'selkatun', 'ariveli:happy'], lumi: ['anselm', 'funke', 'selkatun', 'lumi:happy'] }, task: { kind: 'feat', target: 'echo' }, reward: { xp: 200 }, act: { kind: 'feat' } }),
    BV(11, 3, { when: { after: 'c11.b2', adv: true, deed: 'c11.b2', dim: ['overworld', 'aqua', 'zinn', 'ocker', 'basalt', 'opal', 'stn.*', 'x.*'] }, vary: 'how',
      scene: { shots: [{ cam: 'close', target: 'funke', dur: 6, fx: 'wake' }, { cam: 'skyline', target: 'answer', dur: 8, fx: 'wake', swell: true }, { cam: 'close', target: 'funke', dur: 7, fx: 'hum' }], music: 'rise' },
      alt: { build: ['funke:surprised', 'echo:surprised', 'echo', 'funke:happy', 'echo:happy'], fly: ['funke:surprised', 'echo:surprised', 'echo', 'funke:happy', 'echo:happy'], free: ['funke:surprised', 'echo:surprised', 'echo', 'funke:happy', 'echo:happy'], calm: ['funke:surprised', 'echo:surprised', 'echo', 'funke:happy', 'echo:happy'] }, task: { kind: 'home', target: 'home' }, reward: { xp: 300 }, act: { kind: 'scan', target: 'sky', pitch: 15 } }),
    // 12 · Heimkehr — everyone on the square; at night every freed beacon lights at once; free play and a new signal
    BV(12, 1, { when: { after: 'c11.b3', adv: true, dim: ['overworld'] }, vary: 'c6',
      scene: { shots: [{ cam: 'skyline', target: 'temple', dur: 6 }, { cam: 'orbit', target: 'player', dur: 7, fx: 'gather', swell: true }, { cam: 'close', target: 'funke', dur: 6 }], music: 'warm' },
      alt: { wellari: ['ilka:happy', 'oskar:happy', 'ariveli:happy', 'funke:happy'], lumi: ['ilka:happy', 'oskar:happy', 'lumi:happy', 'funke:happy'] }, task: { kind: 'night', target: 'night' }, reward: { xp: 200 }, act: { kind: 'look', target: 'vista', max: 600, cone: 22, hold: 1.5 } }),
    B(12, 2, { when: { after: 'c12.b1', adv: true, dim: ['overworld'], hours: ['dusk', 'night'] },
      scene: { shots: [{ cam: 'up', target: 'sky', dur: 8, fx: 'finale', swell: true }, { cam: 'skyline', target: 'vista', dur: 9, fx: 'finale' }, { cam: 'close', target: 'funke', dur: 6, fx: 'finale', swell: true }], music: 'rise' },
      who: ['echo:happy', 'funke:surprised', 'selma:surprised', 'flimmi:happy', 'funke:happy'], task: { kind: 'play', target: 'free' }, reward: { xp: 500 }, act: { kind: 'photo', target: 'sky', pitch: 20 } }),
    B(12, 3, { when: { after: 'c12.b2', adv: true, dim: ['overworld'] },
      scene: { shots: [{ cam: 'close', target: 'funke', dur: 6 }, { cam: 'skyline', target: 'vista', dur: 6, fx: 'gather' }, { cam: 'up', target: 'sky', dur: 8, fx: 'blink3', swell: true }], music: 'wide' },
      who: ['jonte:happy', 'anselm:happy', 'funke:happy', 'funke:surprised'], task: { kind: 'play', target: 'free' }, reward: { xp: 300 }, act: { kind: 'scan', target: 'sky', pitch: 30 } }),
  ];
  for (const b of S.BEATS) delete b.who;
  // a-story3 · the choices: one at the end of a beat (b.choice), made once, kept in the record (rec.choices)
  S.CHOICES = { c6: { at: 'c6.b3', opts: ['wellari', 'lumi'] }, how: { at: null, opts: ['build', 'fly', 'free', 'calm'], deed: 'c11.b2' } };   // (a-story4: how — no card: the way you answered Echo, made by the deed itself)
  S.WAYS = S.CHOICES.how.opts;
  S.byId = (id) => S.BEATS.find(b => b.id === id) || null;
  S.ofChapter = (ch) => S.BEATS.filter(b => b.ch === ch);
  S.sceneLen = (b) => b.scene.shots.reduce((s, q) => s + q.dur, 0);
  S.keys = function () {
    const out = [];
    for (const c of S.CHAPTERS) out.push(c.title, c.where, c.log);
    for (const b of S.BEATS) { if (b.scene.alt) { for (const k of Object.keys(b.scene.alt)) for (const l of b.scene.alt[k]) out.push(l.key); } else for (const l of b.scene.lines) out.push(l.key); }
    for (const w of S.WHO) out.push('story.who.' + w);
    for (const id of Object.keys(S.CHOICES)) { out.push('story.choice.' + id + '.q'); for (const o of S.CHOICES[id].opts) out.push('story.choice.' + id + '.' + o, 'story.choice.' + id + '.' + o + '.d', 'story.choice.' + id + '.' + o + '.after', 'story.choice.' + id + '.' + o + '.j'); }
    return out;
  };

  // ---------------------------------------------------------------- the record (meta.story)
  S.fresh = () => ({ v: 1, beats: {}, later: {}, acts: {}, choices: {}, places: {} });   // (a-story4: places — the dims a beat was seen in: the epilogue's star book)   // (a-story3: choices — {id: option})   // (a-story2: acts — the deeds done, {id: 1})
  S.load = function (m) {
    const r = S.fresh();
    if (!m || typeof m !== 'object') return r;
    const bs = m.beats && typeof m.beats === 'object' ? m.beats : {};
    for (const id of Object.keys(bs)) if (S.byId(id) && (bs[id] === 'done' || bs[id] === 'skip')) r.beats[id] = bs[id];
    const lt = m.later && typeof m.later === 'object' ? m.later : {};
    // (the play clock starts at 0 in every session: a postponed beat is due again after a load, its count kept)
    for (const id of Object.keys(lt)) { const q = lt[id]; if (!S.byId(id) || !q || r.beats[id]) continue; const n = Math.max(0, Math.min(S.REMINDS + 1, q.n | 0)); r.later[id] = { n, at: 0, silent: n > S.REMINDS }; }
    const ac = m.acts && typeof m.acts === 'object' ? m.acts : {};
    for (const id of Object.keys(ac)) if (S.byId(id) && ac[id] === 1) r.acts[id] = 1;
    const chs = m.choices && typeof m.choices === 'object' ? m.choices : {};
    for (const id of Object.keys(chs)) if (S.CHOICES[id] && S.CHOICES[id].opts.indexOf(chs[id]) >= 0) r.choices[id] = chs[id];
    const pls = m.places && typeof m.places === 'object' ? m.places : {};
    for (const d of Object.keys(pls)) if (pls[d] === 1 && S.placeOk(d)) r.places[d] = 1;
    return r;
  };
  S.isDone = (rec, id) => !!(rec && rec.beats && rec.beats[id]);
  S.mark = function (rec, id, how) { if (!S.byId(id)) return false; rec.beats[id] = how === 'skip' ? 'skip' : 'done'; delete rec.later[id]; return true; };
  // the chapter the player is in: the chapter of the first beat not seen (13 when the written ones are all seen)
  S.chapter = function (rec) { for (const b of S.BEATS) if (!S.isDone(rec, b.id)) return b.ch; const c = S.CHAPTERS.find(q => !q.written); return c ? c.n : 13; };
  S.seen = (rec) => S.BEATS.filter(b => S.isDone(rec, b.id));

  // ---------------------------------------------------------------- when (pure)
  S.why = function (b, ctx, rec) {
    if (!b) return 'none';
    const w = b.when || {}; ctx = ctx || {};
    if (rec && S.isDone(rec, b.id)) return 'done';
    if (w.after && !(rec && S.isDone(rec, w.after))) return 'after';
    if (w.choice && !(rec && rec.choices && rec.choices[w.choice])) return 'choice';
    if (ctx.guest) return 'guest';
    if (ctx.studio) return 'studio';
    if (ctx.menu) return 'menu';
    if (ctx.building) return 'building';
    if (ctx.fighting) return 'fight';
    if (ctx.landing) return 'landing';
    if (ctx.scene) return 'scene';
    if (!((ctx.calm || 0) >= (w.calm || (ctx.adv ? S.CALM_ADV : S.CALM)))) return 'calm';
    if (w.adv && !ctx.adv) return 'adv';
    if (w.dim && !S.dimIn(w.dim, ctx.dim || 'overworld')) return 'dim';
    if (!w.dim && ctx.dim && ctx.dim !== 'overworld' && !ctx.orbit) return 'dim';   // (a beat without dims plays on Herzwelt or above it)
    if (w.place && w.place.indexOf(ctx.place) < 0 && !(w.anyAfter && (ctx.played || 0) >= w.anyAfter)) return 'place';
    if (w.hours && ctx.hour && w.hours.indexOf(ctx.hour) < 0) return 'hour';
    if (w.near) for (const k of Object.keys(w.near)) { const d = ctx.near && ctx.near[k]; if (!(d <= w.near[k])) return 'near'; }
    if (w.freed && !((ctx.freed || 0) >= w.freed)) return 'freed';
    if (w.high && !((ctx.high || 0) >= w.high) && !ctx.orbit) return 'high';
    if (w.orbit && !ctx.orbit) return 'orbit';
    if (w.eclipse && !((ctx.eclipse || 0) >= w.eclipse)) return 'eclipse';
    if (w.suns && !((ctx.suns || 1) >= w.suns)) return 'suns';
    if (w.sun && ctx.sunUp === false) return 'sun';
    if (w.neb && !ctx.neb) return 'neb';   // a-story4: a world of a system inside a nebula
    if (w.red && !ctx.red) return 'red';   // a-story4: a world of a red dwarf
    if (w.deed && !(rec && S.actDone(rec, w.deed))) return 'deed';   // a-story4: the deed of that beat done (the set piece)   // a-story3: a beat under a strange sun plays by day (unknown: no rule)
    return null;
  };
  // a-story3: a dim list may hold patterns — 'stn.*' (a station), 'x.*' (a world of another star)
  S.dimIn = function (list, dim) { for (const d of list) { if (d === dim) return true; if (d.charCodeAt(d.length - 1) === 42 && String(dim).slice(0, d.length - 1) === d.slice(0, -1)) return true; } return false; };
  // the screen is calm for an offer (the same guards as why: never while building, fighting, in a menu …)
  S.busy = function (ctx, need) {
    ctx = ctx || {};
    for (const k of ['guest', 'studio', 'menu', 'building', 'fighting', 'landing', 'scene']) if (ctx[k]) return k === 'fighting' ? 'fight' : k;
    if (!((ctx.calm || 0) >= (need || (ctx.adv ? S.CALM_ADV : S.CALM)))) return 'calm';
    return null;
  };
  // ---- a-story3 · the choice (pure)
  S.choicePending = function (rec) { for (const id of Object.keys(S.CHOICES)) { const c = S.CHOICES[id]; if (c.at && S.isDone(rec, c.at) && !(rec.choices && rec.choices[id])) return id; } return null; };
  S.choiceReady = (rec, ctx) => { const id = S.choicePending(rec); return id && !S.busy(ctx) ? id : null; };
  S.choose = function (rec, id, opt) {
    const c = S.CHOICES[id]; if (!c || c.opts.indexOf(opt) < 0 || !rec) return false;
    rec.choices = rec.choices || {}; if (rec.choices[id]) return false;
    rec.choices[id] = opt; return true;
  };
  S.linesOf = function (b, rec) { if (!b) return []; const alt = b.scene.alt, o = b.vary && rec && rec.choices ? rec.choices[b.vary] : null; return alt && o && alt[o] ? alt[o] : b.scene.lines; };
  S.ready = (b, ctx, rec) => S.why(b, ctx, rec) === null;
  // the beat the story waits on: the first beat not seen whose `after` is seen (one at a time, in order)
  S.open = function (rec) { for (const b of S.BEATS) { if (S.isDone(rec, b.id)) continue; if (!b.when.after || S.isDone(rec, b.when.after)) return b; return null; } return null; };
  // the beat to offer now (or null): the open one, when it holds and it is not postponed
  S.next = function (rec, ctx, t) { const b = S.open(rec); if (!b) return null; if (!S.due(rec, b.id, t)) return null; return S.ready(b, ctx, rec) ? b : null; };

  // ---------------------------------------------------------------- Später (pure)
  S.later = function (rec, id, t) {
    const q = rec.later[id] || (rec.later[id] = { n: 0, at: 0, silent: false });
    q.n++; q.at = (+t || 0) + S.REMIND; q.silent = q.n > S.REMINDS;
    return q;
  };
  S.due = function (rec, id, t) { const q = rec && rec.later && rec.later[id]; if (!q) return true; return !q.silent && (+t || 0) >= q.at; };
  S.silent = (rec, id) => !!(rec && rec.later && rec.later[id] && rec.later[id].silent);
  // the beats waiting in the journal: postponed past their reminders, or the open one (▶ Ansehen there plays it)
  S.waiting = function (rec) { const b = S.open(rec); return b ? [b] : []; };

  // ---------------------------------------------------------------- the scene's timing (pure)
  // a line shows for 1.4 s + 0.055 s a character (2.6 … 7 s); the lines spread over the shots, never past the scene
  S.lineDur = (text) => Math.max(2.6, Math.min(7, 1.4 + 0.055 * String(text || '').length));
  S.timeline = function (b, texts) {
    const len = Math.min(S.SCENE_MAX, S.sceneLen(b)), out = [];
    let t = 0.6;
    const ds = (texts || b.scene.lines).map((l, i) => S.lineDur(texts ? texts[i] : ''));
    const total = ds.reduce((a, c) => a + c, 0), k = total + 0.6 * ds.length > len - 0.6 ? (len - 0.6 - 0.3 * ds.length) / total : 1;
    for (let i = 0; i < ds.length; i++) { const d = ds[i] * k; out.push({ i, t0: t, t1: t + d }); t += d + (k < 1 ? 0.3 : 0.6); }
    return { len, lines: out };
  };
  S.shotAt = function (b, t) { let s = 0; for (let i = 0; i < b.scene.shots.length; i++) { const q = b.scene.shots[i]; if (t < s + q.dur || i === b.scene.shots.length - 1) return { i, shot: q, u: Math.max(0, Math.min(1, (t - s) / q.dur)) }; s += q.dur; } return null; };

  // ---------------------------------------------------------------- a-story2 · the deeds between the beats (pure)
  // One small deed a beat (b.act): look (hold the view on it), scan (Funke scans it: [V] while aimed), touch ([V] within
  // reach), photo (a picture taken while it holds). Never needed for the next beat — the journal records them (☐ / ✓).
  // a: {ang (° from the view to the target), dist (m), pitch (° up), high (m over the sea), orbit, dim, eclipse, ground
  // (on the ground), press ([V] now), photo (a picture now)} → 'ok' | 'armed' (waits for V / the picture) | the reason.
  S.ACT_KINDS = ['look', 'scan', 'touch', 'photo', 'feat'];
  S.actCheck = function (act, a) {
    if (!act) return 'none';
    a = a || {};
    if (act.dim && !S.dimIn(act.dim, a.dim || 'overworld')) return 'dim';
    if (act.high && !((a.high || 0) >= act.high) && !a.orbit) return 'high';
    if (act.eclipse && !((a.eclipse || 0) >= act.eclipse)) return 'eclipse';
    if (act.ground && !a.ground) return 'ground';
    if (act.cone && !Number.isFinite(a.ang)) return 'none';
    if (act.max && !(a.dist <= act.max)) return 'far';
    if (act.cone && !(a.ang <= act.cone)) return 'ang';
    if (act.pitch !== undefined && !(a.pitch >= act.pitch)) return 'pitch';
    if (act.below !== undefined && !(a.pitch <= act.below)) return 'pitch';
    if (act.level !== undefined && !(Math.abs(a.pitch) <= act.level)) return 'pitch';
    if (act.kind === 'feat') return S.WAYS.indexOf(a.feat) >= 0 ? 'ok' : 'armed';   // a-story4: one of the four ways seen
    if (act.kind === 'look') return 'ok';
    if (act.kind === 'photo') return a.photo ? 'ok' : 'armed';
    return a.press ? 'ok' : 'armed';
  };
  // one step of the deed's watch: a look holds act.hold s unbroken; the others are done the moment they check 'ok'
  S.actStep = function (st, act, a, dt) {
    const r = S.actCheck(act, a); st.last = r;
    if (act.kind !== 'look') return r === 'ok';
    st.hold = r === 'ok' ? (st.hold || 0) + (dt || 0) : 0;
    return st.hold >= (act.hold || 1) - 1e-9;
  };
  S.actDone = (rec, id) => !!(rec && rec.acts && rec.acts[id]);
  S.markAct = function (rec, id) { if (!S.byId(id)) return false; (rec.acts || (rec.acts = {}))[id] = 1; return true; };
  // the deed open now: the last seen beat's, while not done (an older one missed stays ☐ in the journal)
  S.openAct = function (rec) { for (let i = S.BEATS.length - 1; i >= 0; i--) { const b = S.BEATS[i]; if (!S.isDone(rec, b.id)) continue; return b.act && !S.actDone(rec, b.id) ? b : null; } return null; };

  // ---------------------------------------------------------------- a-story4 · the set piece and the epilogue (pure)
  // The answer Echo can see, your own way: b0 the watch's start, n now — {placed (blocks placed, a count), span (m: the
  // height of the blocks placed since b0), freed (beacons), calms (machines calmed), high (m over the sea), orbit}
  S.BUILD_N = 24; S.BUILD_SPAN = 5; S.FLY_UP = 150;
  S.featWay = function (b0, n) {
    if (!b0 || !n) return null;
    if ((n.placed - b0.placed) >= S.BUILD_N && (n.span || 0) >= S.BUILD_SPAN) return 'build';
    if ((n.freed || 0) > (b0.freed || 0)) return 'free';
    if ((n.calms || 0) > (b0.calms || 0)) return 'calm';
    if ((n.orbit && !b0.orbit) || (n.high || 0) - (b0.high || 0) >= S.FLY_UP) return 'fly';
    return null;
  };
  // the answer given: the way kept (once) and the deed of c11.b2 marked
  S.answer = function (rec, way) {
    const c = S.CHOICES.how; if (!rec || S.WAYS.indexOf(way) < 0) return false;
    rec.choices = rec.choices || {}; if (rec.choices.how) return false;
    rec.choices.how = way; S.markAct(rec, c.deed); return true;
  };
  S.placeOk = (d) => /^(overworld|aqua|zinn|ocker|basalt|opal|stn\.[a-z0-9_]+|x\.\d+\.\d+\.[a-z]+)$/.test(String(d));
  S.visit = function (rec, dim) { if (!rec || !S.placeOk(dim)) return false; rec.places = rec.places || {}; if (rec.places[dim]) return false; rec.places[dim] = 1; return true; };
  S.free = (rec) => S.isDone(rec, 'c12.b3');   // the epilogue: the book read, free play with the star book

  if (typeof module !== 'undefined' && module.exports) module.exports = S;
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

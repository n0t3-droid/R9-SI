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
  S.WHO = ['funke', 'ilka', 'oskar', 'selma', 'jonte', 'lumi'];
  S.NOT = ['building', 'fight', 'menu', 'studio', 'landing', 'scene', 'guest'];

  // ---------------------------------------------------------------- the twelve chapters (words: story.c<n>.*)
  S.CHAPTERS = [];
  for (let n = 1; n <= 12; n++) S.CHAPTERS.push({ n, title: 'story.c' + n + '.title', where: 'story.c' + n + '.where', log: 'story.c' + n + '.log', written: n <= 4 });

  // ---------------------------------------------------------------- the beats of chapters 1–4
  const L = (ch, n, who) => who.map((w, i) => ({ who: w, key: 'story.c' + ch + '.b' + n + '.' + (i + 1) }));
  const B = (ch, n, o) => Object.assign({ id: 'c' + ch + '.b' + n, ch, n }, o, { scene: Object.assign({ music: 'warm' }, o.scene, { lines: L(ch, n, o.who) }), who: undefined });
  S.BEATS = [
    // 1 · Funke — the drone flickers awake on a console; the first vista at the golden hour
    B(1, 1, { when: { after: null, place: ['hangar'], anyAfter: 240, adv: false },
      scene: { shots: [{ cam: 'close', target: 'funke', dur: 5 }, { cam: 'shoulder', target: 'funke', dur: 5 }, { cam: 'wide', target: 'player', dur: 5 }], music: 'warm' },
      who: ['funke', 'funke', 'ilka', 'funke'], task: { kind: 'follow', target: 'vista' }, reward: { xp: 30 } }),
    B(1, 2, { when: { after: 'c1.b1', place: ['plaza', 'street', 'hills', 'isles', 'water', 'wild'], adv: false },   // (by day the land, by night its dark hills: the lines fit both)
      scene: { shots: [{ cam: 'wide', target: 'vista', dur: 6 }, { cam: 'orbit', target: 'player', dur: 6 }, { cam: 'shoulder', target: 'vista', dur: 5 }], music: 'wide' },
      who: ['funke', 'ilka', 'funke'], task: { kind: 'go', target: 'outpost' }, reward: { xp: 40 } }),
    B(1, 3, { when: { after: 'c1.b2', adv: true, near: { outpost: 700 } },
      scene: { shots: [{ cam: 'shoulder', target: 'outpost', dur: 6 }, { cam: 'wide', target: 'outpost', dur: 6 }], music: 'tense' },
      who: ['oskar', 'oskar', 'funke'], task: { kind: 'go', target: 'outpost' }, reward: { xp: 40 } }),
    // 2 · Das stille Leuchtfeuer — the first beacon turns cyan, a light ring sweeps the canyon
    B(2, 1, { when: { after: 'c1.b3', adv: true, near: { outpost: 140 } },
      scene: { shots: [{ cam: 'close', target: 'beacon', dur: 5 }, { cam: 'orbit', target: 'beacon', dur: 6 }, { cam: 'shoulder', target: 'beacon', dur: 4 }], music: 'tense' },
      who: ['funke', 'funke', 'funke'], task: { kind: 'free', target: 'outpost' }, reward: { xp: 50 } }),
    B(2, 2, { when: { after: 'c2.b1', adv: true, freed: 1 },
      scene: { shots: [{ cam: 'wide', target: 'beacon', dur: 6 }, { cam: 'orbit', target: 'beacon', dur: 6 }, { cam: 'close', target: 'funke', dur: 4 }], music: 'rise' },
      who: ['funke', 'oskar', 'oskar', 'funke'], task: { kind: 'go', target: 'home' }, reward: { xp: 80 } }),
    B(2, 3, { when: { after: 'c2.b2', adv: true },
      scene: { shots: [{ cam: 'close', target: 'funke', dur: 5 }, { cam: 'up', target: 'sky', dur: 6 }], music: 'warm' },
      who: ['selma', 'selma', 'funke'], task: { kind: 'climb', target: 'sky' }, reward: { xp: 40 } }),
    // 3 · Über den Wolken — the world curves away; the station's beacon blinks red over the limb
    B(3, 1, { when: { after: 'c2.b3', adv: true, high: 600 },
      scene: { shots: [{ cam: 'limb', target: 'horizon', dur: 7 }, { cam: 'shoulder', target: 'horizon', dur: 5 }], music: 'wide' },
      who: ['jonte', 'funke', 'jonte'], task: { kind: 'climb', target: 'orbit' }, reward: { xp: 60 } }),
    B(3, 2, { when: { after: 'c3.b1', adv: true, orbit: true },
      scene: { shots: [{ cam: 'limb', target: 'station', dur: 8 }, { cam: 'close', target: 'station', dur: 6 }], music: 'wide' },
      who: ['funke', 'funke', 'jonte'], task: { kind: 'go', target: 'station' }, reward: { xp: 100 } }),
    B(3, 3, { when: { after: 'c3.b2', adv: true, dim: ['overworld', 'basalt', 'opal'] },
      scene: { shots: [{ cam: 'up', target: 'amarant', dur: 7 }, { cam: 'close', target: 'funke', dur: 5 }], music: 'warm' },
      who: ['jonte', 'jonte', 'funke'], task: { kind: 'travel', target: 'basalt' }, reward: { xp: 60 } }),
    // 4 · Die Monde von Amarant — geysers fire round the Eiswächter; Amarant swallows the sun
    B(4, 1, { when: { after: 'c3.b3', adv: true, dim: ['basalt', 'opal'] },
      scene: { shots: [{ cam: 'wide', target: 'player', dur: 6 }, { cam: 'up', target: 'amarant', dur: 6 }], music: 'wide' },
      who: ['funke', 'funke', 'lumi'], task: { kind: 'travel', target: 'opal' }, reward: { xp: 80 } }),
    B(4, 2, { when: { after: 'c4.b1', adv: true, dim: ['opal'] },
      scene: { shots: [{ cam: 'ice', target: 'warden', dur: 7 }, { cam: 'eye', target: 'warden', dur: 5 }, { cam: 'shoulder', target: 'warden', dur: 4 }], music: 'tense' },
      who: ['funke', 'funke', 'lumi', 'funke'], task: { kind: 'wait', target: 'eclipse' }, reward: { xp: 100 } }),
    B(4, 3, { when: { after: 'c4.b2', adv: true, dim: ['basalt', 'opal'], eclipse: 0.5 },
      scene: { shots: [{ cam: 'up', target: 'amarant', dur: 8 }, { cam: 'wide', target: 'player', dur: 6 }], music: 'rise' },
      who: ['funke', 'lumi', 'lumi', 'funke'], task: { kind: 'next', target: 'c5' }, reward: { xp: 150 } }),
  ];
  for (const b of S.BEATS) delete b.who;
  S.byId = (id) => S.BEATS.find(b => b.id === id) || null;
  S.ofChapter = (ch) => S.BEATS.filter(b => b.ch === ch);
  S.sceneLen = (b) => b.scene.shots.reduce((s, q) => s + q.dur, 0);
  S.keys = function () {
    const out = [];
    for (const c of S.CHAPTERS) out.push(c.title, c.where, c.log);
    for (const b of S.BEATS) for (const l of b.scene.lines) out.push(l.key);
    for (const w of S.WHO) out.push('story.who.' + w);
    return out;
  };

  // ---------------------------------------------------------------- the record (meta.story)
  S.fresh = () => ({ v: 1, beats: {}, later: {} });
  S.load = function (m) {
    const r = S.fresh();
    if (!m || typeof m !== 'object') return r;
    const bs = m.beats && typeof m.beats === 'object' ? m.beats : {};
    for (const id of Object.keys(bs)) if (S.byId(id) && (bs[id] === 'done' || bs[id] === 'skip')) r.beats[id] = bs[id];
    const lt = m.later && typeof m.later === 'object' ? m.later : {};
    // (the play clock starts at 0 in every session: a postponed beat is due again after a load, its count kept)
    for (const id of Object.keys(lt)) { const q = lt[id]; if (!S.byId(id) || !q || r.beats[id]) continue; const n = Math.max(0, Math.min(S.REMINDS + 1, q.n | 0)); r.later[id] = { n, at: 0, silent: n > S.REMINDS }; }
    return r;
  };
  S.isDone = (rec, id) => !!(rec && rec.beats && rec.beats[id]);
  S.mark = function (rec, id, how) { if (!S.byId(id)) return false; rec.beats[id] = how === 'skip' ? 'skip' : 'done'; delete rec.later[id]; return true; };
  // the chapter the player is in: the chapter of the first beat not seen (13 when the written ones are all seen)
  S.chapter = function (rec) { for (const b of S.BEATS) if (!S.isDone(rec, b.id)) return b.ch; return 5; };
  S.seen = (rec) => S.BEATS.filter(b => S.isDone(rec, b.id));

  // ---------------------------------------------------------------- when (pure)
  S.why = function (b, ctx, rec) {
    if (!b) return 'none';
    const w = b.when || {}; ctx = ctx || {};
    if (rec && S.isDone(rec, b.id)) return 'done';
    if (w.after && !(rec && S.isDone(rec, w.after))) return 'after';
    if (ctx.guest) return 'guest';
    if (ctx.studio) return 'studio';
    if (ctx.menu) return 'menu';
    if (ctx.building) return 'building';
    if (ctx.fighting) return 'fight';
    if (ctx.landing) return 'landing';
    if (ctx.scene) return 'scene';
    if (!((ctx.calm || 0) >= (w.calm || (ctx.adv ? S.CALM_ADV : S.CALM)))) return 'calm';
    if (w.adv && !ctx.adv) return 'adv';
    if (w.dim && w.dim.indexOf(ctx.dim || 'overworld') < 0) return 'dim';
    if (!w.dim && ctx.dim && ctx.dim !== 'overworld' && !ctx.orbit) return 'dim';   // (a beat without dims plays on Herzwelt or above it)
    if (w.place && w.place.indexOf(ctx.place) < 0 && !(w.anyAfter && (ctx.played || 0) >= w.anyAfter)) return 'place';
    if (w.hours && ctx.hour && w.hours.indexOf(ctx.hour) < 0) return 'hour';
    if (w.near) for (const k of Object.keys(w.near)) { const d = ctx.near && ctx.near[k]; if (!(d <= w.near[k])) return 'near'; }
    if (w.freed && !((ctx.freed || 0) >= w.freed)) return 'freed';
    if (w.high && !((ctx.high || 0) >= w.high) && !ctx.orbit) return 'high';
    if (w.orbit && !ctx.orbit) return 'orbit';
    if (w.eclipse && !((ctx.eclipse || 0) >= w.eclipse)) return 'eclipse';
    return null;
  };
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
    const ds = b.scene.lines.map((l, i) => S.lineDur(texts ? texts[i] : ''));
    const total = ds.reduce((a, c) => a + c, 0), k = total + 0.6 * ds.length > len - 0.6 ? (len - 0.6 - 0.3 * ds.length) / total : 1;
    for (let i = 0; i < ds.length; i++) { const d = ds[i] * k; out.push({ i, t0: t, t1: t + d }); t += d + (k < 1 ? 0.3 : 0.6); }
    return { len, lines: out };
  };
  S.shotAt = function (b, t) { let s = 0; for (let i = 0; i < b.scene.shots.length; i++) { const q = b.scene.shots[i]; if (t < s + q.dur || i === b.scene.shots.length - 1) return { i, shot: q, u: Math.max(0, Math.min(1, (t - s) / q.dur)) }; s += q.dur; } return null; };

  if (typeof module !== 'undefined' && module.exports) module.exports = S;
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

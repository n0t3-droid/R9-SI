// ============================================================================
// a-story8 · Arc 2's music (plan docs/superpowers/plans/2026-11-01-a-story8.md) — after score2.js and audio.js:
//   · the story cues: Wiegelind's motif — three notes on one pitch (her three blinks, „Ich bin da"), then a lullaby
//     fall — in a scene's mood: st_warm (a music box over a pad, 3/4), st_wide (a celesta over the choir, lydian),
//     st_rise (bells climbing over strings), st_tense (a celesta over deep hums, aeolian). All our own.
//     audio.storyCue(id, mood): the mood's cue on the running music's beat (story_arc2.js calls it as a scene begins)
//   · while an Arc-2 scene plays the director takes the arc's theme: the Wiegenlied by night at home, the Mondstein
//     waltz at her place (c15.b3, c16.b2), the people's theme on a far world (else the Feenschimmer), on the
//     Dreilichterfest (c16.b1) the season's dance. S.storyCtx(g) reads the scene (pure; gather wraps it in).
// Cost: one property read in the gather (four times a second); the cues are 3 bars long.
// ============================================================================
(function (VR) {
  'use strict';
  const S = VR.Score; if (!S || !S.THEMES || S._story8) return;
  S._story8 = true;
  const L = (id, kind, inst, oct, gain, lv, pri, x) => Object.assign({ id, kind, inst, oct, gain, lv, pri }, x);
  Object.assign(S.THEMES, {
    st_warm: {   // the music box: blink blink blink — and down to sleep (3/4)
      bpm: 72, meter: 3, mode: 'major', len: 3, sting: true, own: true,
      chords: '0:3 | 3:3 | 0:3',
      layers: [
        L('mel', 'line', 'musicbox', 12, 0.055, 0, 3, { notes: '4:.5 r:.5 4:.5 r:.5 4 | 5 3 1 | 0:3' }),
        L('pad', 'chord', 'pad', -12, 0.026, 0, 2),
        L('harp', 'arp', 'harp', -12, 0.02, 0, 1, { pat: [0, 4, 7], step: 1, nlen: 2 }),
      ],
    },
    st_wide: {   // the sky: a celesta's three blinks over the choir, opening to the raised fourth (lydian)
      bpm: 66, mode: 'lydian', len: 3, sting: true, own: true,
      chords: '0:4 | 1:4 | 0:4',
      layers: [
        L('mel', 'line', 'celesta', 12, 0.05, 0, 3, { notes: '4:.5 r:.5 4:.5 r:.5 4:2 | 6 5 3 1 | 0:4' }),
        L('choir', 'chord', 'choir', -12, 0.028, 0, 2),
        L('bass', 'bass', 'hum', -24, 0.035, 0, 1, { pat: [0], plen: 4 }),
      ],
    },
    st_rise: {   // the answer: bells blink, then climb over strings to the high tonic
      bpm: 80, mode: 'major', len: 3, sting: true, own: true,
      chords: '5:4 | 3:2 4:2 | 0:4',
      layers: [
        L('mel', 'line', 'bell', 12, 0.05, 0, 3, { notes: '2:.5 r:.5 2:.5 r:.5 2:2 | 3 4 5 6 | 7:4' }),
        L('str', 'chord', 'strings', -12, 0.03, 0, 2),
        L('bass', 'bass', 'bass', -24, 0.045, 0, 1, { pat: [0], plen: 2 }),
      ],
    },
    st_tense: {   // the worry: the blinks low and slow over deep hums, a question left open (aeolian, on V)
      bpm: 60, mode: 'aeolian', len: 3, sting: true, own: true,
      chords: '0:4 | 5:4 | 4:4',
      layers: [
        L('mel', 'line', 'celesta', 12, 0.045, 0, 3, { notes: '4:.5 r:.5 4:.5 r:.5 4:2 | 2 0 -1:2 | 1:4' }),
        L('hum', 'chord', 'hum', -12, 0.04, 0, 2),
      ],
    },
  });
  Object.assign(S.GAP, { st_warm: 15, st_wide: 15, st_rise: 15, st_tense: 15 });
  S.STORY_MOODS = { warm: 'st_warm', wide: 'st_wide', rise: 'st_rise', tense: 'st_tense' };

  // ---------------------------------------------------------------- the arc's theme in a scene
  S.storyCtx = function (g) {
    const sc = g && g.story && g.story.scene, b = sc && sc.b;
    return b && b.ch >= 13 ? { story2: b.id, story2ch: b.ch } : { story2: '', story2ch: 0 };
  };
  S.storyTheme = function (c) {
    const id = c.story2;
    if (id === 'c16.b1') { const d = S.danceOf ? S.danceOf(c.festId || '', c.season) : null; return d ? { id: d.id, variant: d.variant } : { id: 'waltz', variant: 'dance' }; }
    if (id === 'c15.b3' || id === 'c16.b2') return { id: 'waltz', variant: 'story' };
    if (c.story2ch === 14) return { id: c.people && S.THEMES['p_' + c.people] ? 'p_' + c.people : 'fairy', variant: 'story' };
    return { id: 'lullaby', variant: 'story' };
  };
  const D = S.Director && S.Director.prototype, want0 = D && D.want;
  if (D) D.want = function (c) {
    if (c && c.story && c.story2 && c.aware && !(c.boss > 0) && !c.danger && !c.journey) { const t = S.storyTheme(c); return { id: t.id, variant: t.variant, lv: 1, urgent: false, pk: 'story:' + t.id }; }
    return want0.call(this, c);
  };
  const gather0 = S.gather;
  S.gather = function (g, s, out) {
    out = gather0(g, s, out);
    try { const x = S.storyCtx(g); out.story2 = x.story2; out.story2ch = x.story2ch; } catch (e) { out.story2 = ''; out.story2ch = 0; }
    return out;
  };

  // ---------------------------------------------------------------- audio.storyCue
  const A = VR.Audio;
  if (A && A.prototype && !A.prototype.storyCue) {
    A.prototype.storyCue = function (id, mood) {
      if (!this.ctx || !this.score || this.vol.music <= 0) return false;
      const name = S.STORY_MOODS[mood] || 'st_warm', now = this.ctx.currentTime;
      return this.score.event(name, now, now + 4.2);
    };
  }
})(VR);

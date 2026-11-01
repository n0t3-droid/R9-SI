// ============================================================================
// e-score2 · the discoveries' stingers (docs/superpowers/plans/2026-11-01-e-score2.md): a short tune that lands on the
// running music's beat (score.js Director.quant) — a wander moment begins (glimpse), a fairy place is found (friend; a
// Flausel greeting: fairy.js talk), a family moves in (welcome); the outpost freed plays 'freed' after its swell
// (liberate.js → audio.cue('freeing')). Each at most once in a while (VR.Score.GAP). Loaded last: it wraps what exists.
// ============================================================================
(function (VR) {
  'use strict';
  const cue = (g, name) => { try { const a = g && g.audio; if (a && a.cue) a.cue(name); } catch (e) { /* the music never breaks the game */ } };
  const W = VR.Wander;
  if (W && W.Actor && W.Actor.prototype.start) {
    const start0 = W.Actor.prototype.start;
    W.Actor.prototype.start = function (kind, k, force) { const m = start0.call(this, kind, k, force); if (m && !force) cue(this.g, 'glimpse'); return m; };
  }
  if (W) {
    const found0 = W.found;
    W.found = function (src, id) { if (src === 'fairy') cue(VR.game, 'friend'); return found0 ? found0.apply(this, arguments) : undefined; };
  }
  const MI = VR.MoveIn;
  if (MI && MI.startArrival) {
    const arr0 = MI.startArrival;
    MI.startArrival = function (V, h) { const r = arr0.apply(this, arguments); cue((V && V.g) || VR.game, 'welcome'); return r; };
  }
})(VR);

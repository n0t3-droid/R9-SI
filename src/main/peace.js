// ============================================================================
// Friedlich (t-life, docs/superpowers/plans/2026-10-09-t-life.md §3.2): the owner wants a world without combat. A new
// world is peaceful unless the player picks another difficulty in the create form; in a peaceful world (or in Zen)
// nothing fights — no raid (gadgets.js), no defence wing and no dogfight (traffic.js), no hostile mob (entities.js
// removes the ones left from before), and a shot of the player's own is harmless light. The raid code stays, behind the
// difficulty (Leicht / Normal / Schwer).
// ============================================================================
(function (VR) {
  'use strict';
  VR.Peace = {
    DEFAULT: 'peaceful',
    // is this game at peace? (the world's difficulty, or the Zen mode)
    on(g) { return !!g && (g.difficulty === 'peaceful' || !!(g.player && g.player.mode === 'zen')); },
  };
})(VR);

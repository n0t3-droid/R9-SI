// ============================================================================
// r-gemalt · Weiche Natur, the GL side (the pure part: gemalt.js). Wraps renderer methods additively: buildPrograms
// (remembers whether the terrain program has GEMALT) and applyQ (the switch changed: the programs again). With the
// switch off nothing changes.
// ============================================================================
(function (VR) {
  'use strict';
  const G = VR.Gemalt;
  if (!G || !VR.Renderer) return;
  const R = VR.Renderer.prototype;
  const on = () => G.shaderOn(VR.game && VR.game.settings);
  const bp0 = R.buildPrograms;
  R.buildPrograms = function () { this.gmOn = on(); return bp0.apply(this, arguments); };
  const aq0 = R.applyQ;
  R.applyQ = function (full) {
    const res = aq0.call(this, full);
    if (this.gmOn !== undefined && on() !== this.gmOn) {
      this.buildPrograms();
      const P = this.P; if (P) for (const k in P) if (k.startsWith('far_')) delete P[k];   // (the far programs: made again on their next use)
    }
    // the far tiles follow the switch (and the look — Game.applyLook wrapped once): made again soft or as columns
    if (!G._lookHook && VR.Game && VR.Game.prototype.applyLook) {
      G._lookHook = 1; const al0 = VR.Game.prototype.applyLook;
      VR.Game.prototype.applyLook = function () { const r = al0.apply(this, arguments); const rr = this.renderer, fo2 = G.farOn(this); if (rr && rr.gmFar !== undefined && fo2 !== rr.gmFar && this.horizon && this.horizon.reset) { this.horizon.reset(); rr.gmFar = fo2; } return r; };
    }
    const g = VR.game, h = g && g.horizon, fo = G.farOn(g);
    if (h && h.reset && this.gmFar !== undefined && fo !== this.gmFar) h.reset();
    this.gmFar = fo;
    return res;
  };
})(VR);

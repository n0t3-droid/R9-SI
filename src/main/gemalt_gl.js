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
    if (this.gmOn !== undefined && on() !== this.gmOn) this.buildPrograms();
    return res;
  };
})(VR);

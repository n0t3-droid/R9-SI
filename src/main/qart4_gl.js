// ============================================================================
// q-art4 · Runde Inseln, the GL side (the pure part: qart4.js). Wraps the renderer additively: buildPrograms (the switches
// the define hook sees: Runde Inseln, the round crowns' softer top) and applyQ (the switch changed: the programs again; game.js tells the horizon, which asks for its
// tiles again with or without the isles' forms). With the switch off nothing changes.
// ============================================================================
(function (VR) {
  'use strict';
  const Q4 = VR.QArt4;
  if (!Q4 || !VR.Renderer) return;
  const R = VR.Renderer.prototype;
  const bp0 = R.buildPrograms;
  R.buildPrograms = function () { const q = this.q || {}; Q4.q = { qIsleForm: !!q.qIsleForm, qRoundTop: !!q.qRoundTop }; this.q4Key = Q4.key(q); return bp0.apply(this, arguments); };
  const aq0 = R.applyQ;
  R.applyQ = function (full) {
    const res = aq0.call(this, full);
    if (Q4.key(this.q) !== this.q4Key && this.P) this.buildPrograms();
    return res;
  };
})(VR);

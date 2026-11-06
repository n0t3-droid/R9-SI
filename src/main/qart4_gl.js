// ============================================================================
// q-art4 · Runde Inseln, the GL side (the pure part: qart4.js). Wraps the renderer additively: buildPrograms (the switch
// the define hook sees) and applyQ (the switch changed: the programs again; game.js tells the horizon, which asks for its
// tiles again with or without the isles' forms). With the switch off nothing changes.
// ============================================================================
(function (VR) {
  'use strict';
  const Q4 = VR.QArt4;
  if (!Q4 || !VR.Renderer) return;
  const R = VR.Renderer.prototype;
  const on = (r) => !!(r.q && r.q.qIsleForm);
  const bp0 = R.buildPrograms;
  R.buildPrograms = function () { Q4.q = { qIsleForm: on(this) }; this.q4Key = on(this); return bp0.apply(this, arguments); };
  const aq0 = R.applyQ;
  R.applyQ = function (full) {
    const res = aq0.call(this, full);
    if (on(this) !== this.q4Key && this.P) this.buildPrograms();
    return res;
  };
})(VR);

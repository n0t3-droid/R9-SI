// ============================================================================
// q-art · Bildregie, the GL side (plan docs/superpowers/plans/2026-11-06-q-art.md; the pure part: qart.js).
// Wraps renderer methods additively: buildPrograms (QA.use: the switches and the fancy leaves the defines see; the key)
// and applyQ (a switch changed: the programs again). With every switch off nothing changes: the same programs as before.
// ============================================================================
(function (VR) {
  'use strict';
  const QA = VR.QArt;
  if (!QA || !VR.Renderer) return;
  const R = VR.Renderer.prototype;
  const fancyNow = () => { const g = VR.game; return !(g && g.settings && g.settings.fancyLeaves === false); };
  const bp0 = R.buildPrograms;
  R.buildPrograms = function () { const f = fancyNow(); QA.use(this.q, f); this.qaKey = QA.key(this.q, f); return bp0.apply(this, arguments); };
  const aq0 = R.applyQ;
  R.applyQ = function (full) {
    const r = aq0.call(this, full);
    QA.use(this.q);   // (Farbdrehbuch: env.js reads QA.q each frame)
    if (QA.key(this.q, fancyNow()) !== this.qaKey) this.buildPrograms();   // (Laubkronen, Platzbelag: program defines)
    return r;
  };
})(VR);

// ============================================================================
// q-art3 · Bildregie III — shape, not shader nuance (plan docs/superpowers/plans/2026-11-06-q-art3.md)
//   qRound  Runde Kronen: the leaf blocks' render mesh as a rounded blob (src/shared/mesher.js VR.RoundCrown) — the
//           crown's corners and edges round in, the faces between leaves go. The mesh job asks for it with
//           fancyLeaves: 2 (game.js leafMode); fewer vertices than the fancy cubes. Never on Very Low and Low.
// Pure: the switch by preset, its row, the job's leaf mode.
// ============================================================================
(function (VR) {
  'use strict';
  const Q3 = VR.QArt3 = VR.QArt3 || {};
  Q3.SW = ['qRound'];
  const OFF = { qRound: false }, ON = { qRound: true };
  const TIERS = { potato: OFF, low: OFF, balanced: ON, high: ON, ultra: ON, ultraLite: ON };
  Q3.defaults = (preset) => Object.assign({}, TIERS[preset] || OFF);
  Q3.off = () => Object.assign({}, OFF);
  Q3.ROWS = [
    { key: 'qRound', g: 'img', sec: 'objects', t: 'switch', lab: 'g.set.qRound', tip: 'g.set.qRound.tip', cost: 'low', def: false },
  ];
  // the mesh job's fancyLeaves: 2 = round crowns (only with the fancy leaves), else the setting as it was
  Q3.leafMode = (s) => (s && s.fancyLeaves && s.qRound ? 2 : !!(s && s.fancyLeaves));
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

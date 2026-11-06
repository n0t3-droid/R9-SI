// ============================================================================
// q-art3 · Bildregie III — shape, not shader nuance (plan docs/superpowers/plans/2026-11-06-q-art3.md)
//   qRound  Runde Kronen: the leaf blocks' render mesh as a rounded blob (src/shared/mesher.js VR.RoundCrown) — the
//           crown's corners and edges round in, the faces between leaves go. The mesh job asks for it with
//           fancyLeaves: 2 (game.js leafMode); fewer vertices than the fancy cubes. Never on Very Low and Low.
//   qHill   Runde Hänge: in Nahtlos the natural ground's edges, terraces, cliffs and the isles' undersides from the same blob
//           (the ground counts as inside; a face whose corners all stay on the grid — flat ground — goes the greedy way as
//           before, so the vertex count grows only on the edges). Plants sit on the blob. Collision stays the physics'
//           height field (a foot may float or sink up to ~½ block at an edge). Klassisch: nothing (no smooth ground).
// Pure: the switches by preset, their rows, the job's leaf mode.
// ============================================================================
(function (VR) {
  'use strict';
  const Q3 = VR.QArt3 = VR.QArt3 || {};
  Q3.SW = ['qRound', 'qHill'];
  const OFF = { qRound: false, qHill: false }, ON = { qRound: true, qHill: true };
  const TIERS = { potato: OFF, low: OFF, balanced: ON, high: ON, ultra: ON, ultraLite: ON };
  Q3.defaults = (preset) => Object.assign({}, TIERS[preset] || OFF);
  Q3.off = () => Object.assign({}, OFF);
  Q3.ROWS = [
    { key: 'qRound', g: 'img', sec: 'objects', t: 'switch', lab: 'g.set.qRound', tip: 'g.set.qRound.tip', cost: 'low', def: false },
    { key: 'qHill', g: 'img', sec: 'objects', t: 'switch', lab: 'g.set.qHill', tip: 'g.set.qHill.tip', cost: 'low', def: false },
  ];
  // the mesh job's fancyLeaves (mesher.js): the setting as it was (true / false), or a number — bit 1 (2) round crowns (only
  // with the fancy leaves), bit 2 (4) round hills, bit 3 (8) the leaves not fancy
  Q3.leafMode = (s) => {
    const fancy = !!(s && s.fancyLeaves), m = (fancy && s.qRound ? 2 : 0) | (s && s.qHill ? 4 : 0);
    return m ? m | (fancy ? 0 : 8) : fancy;
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

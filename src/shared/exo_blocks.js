// ============================================================================
// u-stars2 · the blocks of the worlds of other stars (plan docs/superpowers/plans/2026-10-30-u-stars2.md; exoworld.js
// places them — the signature landscapes of xgen 2). Our own, fiction on real chemistry:
//   exo_crystal  Frostprisma — pale blue-white crystal spires under a hot star (silicate and ice prisms that glow faintly
//                in the hard ultraviolet's afterglow)
//   exo_moss     Violettmoos — the ground cover of a red dwarf's world: plants that use its red and near-infrared light
//                look dark violet (they keep less of the light than ours reflect)
//   exo_frond    Violettwedel — its fronds (a cross plant)
//   exo_glass    Dünenglas — sand fused to dark green-brown glass grains by a hot star's heat, heaped into dunes
// Registered LATE — one VR.BL.late push after every older pack (fields_blocks.js's glowspar is the block before them):
// build.js puts this file right before blocks4 after fields_blocks (CONTRIBUTING.md rule 1, test/id_snapshot.js).
// ============================================================================
(function (VR) {
  'use strict';
  if (!VR.BL || (VR.R && VR.R.T)) return;
  VR.BL.late = VR.BL.late || [];
  VR.BL.late.push(function () {
    const R = VR.R, T = R.tex, def0 = VR.BL.def || R.def, G = VR.BL.G || {}, MD = VR.MODEL;
    if (!def0 || R.byName.exo_crystal || !R.byName.glowspar) return;
    def0('exo_crystal', { display: 'Frost Prism', cat: 'nature', group: G.ORE, tex: () => T('exo_crystal'), hard: 1.5, blast: 1.5, tool: 'pick', sound: 'amethyst', light: [5, 7, 9], flags: VR.F.RANDROT });
    def0('exo_moss', { display: 'Violet Moss', cat: 'nature', group: G.SOIL, tex: () => T('exo_moss'), hard: 0.6, blast: 0.6, tool: 'shovel', sound: 'grass', flags: VR.F.RANDROT });
    const fr = () => T('exo_frond');
    def0('exo_frond', { display: 'Violet Frond', cat: 'nature', group: G.PLANT, shape: 'model', layer: 'cutout', hard: 0, blast: 0, sound: 'plant', solid: false, tex: fr, model: () => MD.cross(fr(), { flags: VR.FFLAG.WAVE }), flags: VR.F.PLANT, jitter: true });
    def0('exo_glass', { display: 'Dune Glass', cat: 'nature', group: G.SOIL, tex: () => T('exo_glass'), hard: 0.6, blast: 0.6, tool: 'shovel', sound: 'sand', smooth: true, flags: VR.F.RANDROT });
  });
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

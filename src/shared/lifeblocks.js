// ============================================================================
// a-life (docs/superpowers/plans/2026-10-30-a-life.md §1.2): the two pieces the moons' settlements need that no block had
//   ferry_dock  the dock post beside a settlement's ferry pads — a dark plinth, a white post, a cyan lamp, a small route
//               board; [V] there opens the ferries' panel (src/main/ferries.js)
//   grow_lamp   the greenhouses' lamp bar under the glass — warm pink-white, so a settlement shows its greenhouses at night
// Placed at runtime by the settlements only (the generator and every world stay as they are). Registered LATE, after
// every older pack (fields_blocks.js' glowspar), so every saved world keeps its state ids (AGENTS.md rule 1,
// test/id_snapshot.js). Faces from textures that exist already.
// ============================================================================
(function (VR) {
  'use strict';
  VR.BL = VR.BL || {};
  VR.BL.late = VR.BL.late || [];
  VR.BL.late.push(function () {
    const R = VR.R, T = R.tex, MD = VR.MODEL, F = VR.F, def = VR.BL.def || R.def, G = VR.BL.G || {};
    if (!MD || !def || R.byName.ferry_dock) return;
    const EMIT = (VR.FFLAG && VR.FFLAG.EMIT) || 4;
    const dock = () => MD.cat(
      MD.box([2, 0, 2, 14, 2, 14], { top: T('hull:dark'), side: T('hazard'), bottom: T('hull:dark') }),
      MD.box([6.5, 2, 6.5, 9.5, 22, 9.5], { side: T('hull:white'), top: T('hull:gray'), bottom: T('hull:gray') }),
      MD.box([3, 13, 7, 13, 19, 9], { side: T('hull:gray'), top: T('hull:dark'), bottom: T('hull:dark') }),
      MD.withFlags(MD.box([3.5, 14, 6.6, 12.5, 18.5, 7], T('neon:cyan'), { cull: false }), EMIT),
      MD.withFlags(MD.box([5.5, 22, 5.5, 10.5, 25, 10.5], T('neon:cyan'), { cull: false }), EMIT));
    def('ferry_dock', { display: 'Fähranleger', cat: 'func', group: G.STAR || null, shape: 'model', layer: 'cutout', tex: T('hull:white'),
      model: dock, light: [3, 7, 8], solid: true, opaque: false, hard: 6, blast: 30, tool: 'pick', sound: 'metal', flags: F.INTERACT, kind: 'ferry_dock' });
    const lamp = () => MD.cat(
      MD.box([1, 13, 6, 15, 15, 10], { side: T('hull:gray'), top: T('hull:gray'), bottom: T('hull:dark') }),
      MD.withFlags(MD.box([1.5, 12, 6.5, 14.5, 13, 9.5], T('neon:magenta'), { cull: false }), EMIT),
      MD.box([7.5, 15, 7.5, 8.5, 16, 8.5], T('hull:dark')));
    def('grow_lamp', { display: 'Pflanzenlicht', cat: 'func', group: G.STAR || null, shape: 'model', layer: 'cutout', tex: T('hull:gray'),
      model: lamp, light: [12, 7, 11], solid: false, opaque: false, hard: 1, blast: 2, tool: 'pick', sound: 'glass', kind: 'grow_lamp' });
  });
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

// ============================================================================
// u-stations (docs/superpowers/plans/2026-10-31-u-stations.md): the two pieces the stations need that no block had
//   stn_gravplate  the artificial-gravity deck plate — dark hull with a faint cyan grid in its top, under the berths and
//                  the hall's middle (the plates are what holds you to the floor up there)
//   stn_clamp      the docking clamp at a berth's corners — a grey foot, two yellow-black jaws, an amber lamp
// Placed only by the station generator (src/shared/forge_station.js, the stn.* dims): every older world stays as it is.
// Registered LATE, after every older pack (a-life's grow_lamp), so every saved world keeps its state ids (CONTRIBUTING.md
// rule 1, test/id_snapshot.js). Faces from textures that exist already.
// ============================================================================
(function (VR) {
  'use strict';
  VR.BL = VR.BL || {};
  VR.BL.late = VR.BL.late || [];
  VR.BL.late.push(function () {
    const R = VR.R, T = R.tex, MD = VR.MODEL, F = VR.F, def = VR.BL.def || R.def, G = VR.BL.G || {};
    if (!MD || !def || R.byName.stn_gravplate) return;
    const EMIT = (VR.FFLAG && VR.FFLAG.EMIT) || 4;
    const plate = () => MD.cat(
      MD.box([0, 0, 0, 16, 15.6, 16], { top: T('hull:dark'), side: T('hull:gray'), bottom: T('hull:dark') }),
      MD.withFlags(MD.box([0.5, 15.6, 7.6, 15.5, 15.9, 8.4], T('neon:cyan'), { cull: false }), EMIT),
      MD.withFlags(MD.box([7.6, 15.6, 0.5, 8.4, 15.9, 15.5], T('neon:cyan'), { cull: false }), EMIT));
    def('stn_gravplate', { display: 'Schwerkraftplatte', cat: 'build', group: G.STAR || null, shape: 'model', layer: 'cutout', tex: T('hull:dark'),
      model: plate, light: [1, 4, 5], solid: true, opaque: false, hard: 5, blast: 30, tool: 'pick', sound: 'metal', kind: 'stn_gravplate' });
    const clamp = () => MD.cat(
      MD.box([2, 0, 2, 14, 3, 14], { top: T('hull:gray'), side: T('hull:dark'), bottom: T('hull:dark') }),
      MD.box([3, 3, 6, 6, 11, 10], { side: T('hazard'), top: T('hull:dark'), bottom: T('hull:dark') }),
      MD.box([10, 3, 6, 13, 11, 10], { side: T('hazard'), top: T('hull:dark'), bottom: T('hull:dark') }),
      MD.box([6, 3, 7, 10, 6, 9], { side: T('hull:white'), top: T('hull:gray'), bottom: T('hull:gray') }),
      MD.withFlags(MD.box([6.5, 6, 7.2, 9.5, 8, 8.8], T('neon:amber'), { cull: false }), EMIT));
    def('stn_clamp', { display: 'Andockklammer', cat: 'func', group: G.STAR || null, shape: 'model', layer: 'cutout', tex: T('hull:gray'),
      model: clamp, light: [12, 8, 3], solid: true, opaque: false, hard: 6, blast: 30, tool: 'pick', sound: 'metal', kind: 'stn_clamp' });
  });
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

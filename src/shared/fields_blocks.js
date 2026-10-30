// ============================================================================
// u-fields · the block of the rubble bodies (plan docs/superpowers/plans/2026-10-30-u-fields.md; U§6.3, §7.3; R§1.7):
//   carbon_rubble  the near-black, brownish-grey rubble of a primitive (carbonaceous) small body — albedo ~0.04, every
//                  grain size from powder to fist-sized clasts in one block
// Registered LATE — one VR.BL.late push after every older pack (bodies2.js's ocker_dust is the block before it): build.js
// puts this file right before blocks4 after bodies2 (AGENTS.md rule 1, test/id_snapshot.js).
// ============================================================================
(function (VR) {
  'use strict';
  if (!VR.BL || (VR.R && VR.R.T)) return;
  VR.BL.late = VR.BL.late || [];
  VR.BL.late.push(function () {
    const R = VR.R, T = R.tex, def0 = VR.BL.def || R.def, G = VR.BL.G || {};
    if (!def0 || R.byName.carbon_rubble || !R.byName.ocker_dust) return;
    def0('carbon_rubble', { display: 'Carbon Rubble', cat: 'nature', group: G.SOIL, tex: () => T('carbon_rubble'), hard: 0.7, blast: 0.8, tool: 'shovel', sound: 'gravel', smooth: true, flags: VR.F.RANDROT });
  });
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

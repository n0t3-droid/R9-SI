// ============================================================================
// u-moons2 · the two blocks of Zinnober (plan docs/superpowers/plans/2026-10-30-u-moons2.md §1; U§6.3; R§5.5):
//   sulfur_red  the red sulfur of Io's plains and of the rings round its plumes (short-chain sulfur, S₃/S₄, quenched
//               from the vents: red when fresh, fading to orange and yellow as it relaxes)
//   so2_frost   the white sulfur-dioxide frost the plumes snow down and the cold plains keep
//   ocker_dust  (u-moons3) Ocker's plains: butterscotch dust — iron oxide on fine basalt grains, browner than red sand
// Registered LATE — one VR.BL.late push after every older pack (bodies.js, foeblocks.js, voxhangar.js): build.js puts
// this file right before blocks4, so both come after the last block a save knows (AGENTS.md rule 1, test/id_snapshot.js).
// ============================================================================
(function (VR) {
  'use strict';
  if (!VR.BL || (VR.R && VR.R.T)) return;
  VR.BL.late = VR.BL.late || [];
  VR.BL.late.push(function () {
    const R = VR.R, T = R.tex, def0 = VR.BL.def || R.def, G = VR.BL.G || {};
    if (!def0 || R.byName.sulfur_red) return;
    def0('sulfur_red', { display: 'Red Sulfur', cat: 'nature', group: G.ROCK, tex: () => T('sulfur_red'), hard: 1.2, blast: 2, tool: 'pick', sound: 'stone', flags: VR.F.RANDROT });
    def0('so2_frost', { display: 'Sulfur Dioxide Frost', cat: 'nature', group: G.SOIL, tex: () => T('so2_frost'), hard: 0.4, blast: 0.4, tool: 'shovel', sound: 'snow', smooth: true, flags: VR.F.RANDROT });
    // u-moons3: Ocker's own dust (appended after Zinnober's two): butterscotch, finer and browner than red sand
    def0('ocker_dust', { display: 'Ochre Dust', cat: 'nature', group: G.SOIL, tex: () => T('ocker_dust'), hard: 0.5, blast: 0.5, tool: 'shovel', sound: 'sand', smooth: true, flags: VR.F.RANDROT });
  });
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

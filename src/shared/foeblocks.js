// ============================================================================
// The Leuchtfeuer (a-foes; plan docs/superpowers/plans/2026-10-23-a-foes.md §2.3, spec abenteuer §6): the beacon of
// the old network that linked the towns of Herzwelt — a dark plinth, a grey pillar and a crystal lamp. Disturbed
// (frei 0) it glows red-violet with a soft glow at its foot; freed (frei 1) it is cyan (a-foes2: [5, 1, 6] / [3, 7, 8] — at
// 13–15 it painted a 13-block ellipse of the ground lilac or cyan). It is placed at
// runtime on the pads of the outposts in Abenteuer worlds only (liberate.js) — the generator and every builder's world
// stay as they are. Registered LATE, after every older block (and after the moons' blocks of u-moons1), so every saved
// world keeps its state ids (AGENTS.md rule 1, test/id_snapshot.js). Its faces use textures that exist already.
// ============================================================================
(function (VR) {
  'use strict';
  VR.BL = VR.BL || {};
  VR.BL.late = VR.BL.late || [];
  VR.BL.late.push(function () {
    const R = VR.R, T = R.tex, MD = VR.MODEL, F = VR.F, def = VR.BL.def || R.def, G = VR.BL.G || {};
    if (!MD || !def || R.byName.leuchtfeuer) return;
    const EMIT = (VR.FFLAG && VR.FFLAG.EMIT) || 4;
    const lit = (frei) => MD.withFlags(MD.box([4.5, 11, 4.5, 11.5, 16, 11.5], T(frei ? 'neon:cyan' : 'neon:magenta'), { cull: false }), EMIT);
    const model = (p) => MD.cat(
      MD.box([1, 0, 1, 15, 3, 15], { top: T('hull:dark'), side: T('hazard'), bottom: T('hull:dark') }),
      MD.box([3, 3, 3, 13, 5, 13], T('hull:gray')),
      MD.box([5.5, 5, 5.5, 10.5, 11, 10.5], { side: T('hull:white'), top: T('hull:gray'), bottom: T('hull:gray') }),
      MD.box([4, 10.5, 4, 12, 11, 12], T('hull:dark'), { cull: false }),
      lit(!!p.frei));
    def('leuchtfeuer', { display: 'Leuchtfeuer', cat: 'func', group: G.STAR || null, props: [['frei', 2]], shape: 'model', layer: 'cutout', tex: T('hull:gray'),
      model, light: (p) => (p.frei ? [3, 7, 8] : [5, 1, 6]), solid: true, opaque: false, hard: 40, blast: 1200, tool: 'pick', sound: 'metal', flags: F.UNBREAK | F.INTERACT, kind: 'leuchtfeuer', noItem: true });
  });
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

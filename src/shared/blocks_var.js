// ============================================================================
// Variant slots (Phase B1 „⧉ Als Variante"): 256 block types var_0 … var_255 of
// 64 states each. They are the LAST block types of the registry — the last late
// set, after the Modern Living pack — so every older block keeps its state ids and
// the slots keep theirs (test/id_snapshot.json pins them; a later block set goes
// after them, the slots never move). An empty slot is a grey cube „Fehlende
// Variante" (an existing texture: no new GPU layer, not an item). VR.Looks fills a
// slot with an edited copy of a block (looks.js), the same way on every thread.
// ============================================================================
(function (VR) {
  'use strict';
  if (!VR.BL) return;
  VR.BL.late = VR.BL.late || [];
  VR.BL.late.push(function () {
    const R = VR.R, def = VR.BL.def, grey = R.tex('concrete:light_gray');
    // (the pages give the name in the player's language once theirs is loaded: VR.Looks.relabel)
    for (let k = 0; k < 256; k++) def('var_' + k, { display: 'Fehlende Variante', cat: null, group: null, props: [['v', 64]], tex: grey, hard: 1, blast: 3, sound: 'stone', tool: 'pick', noItem: true, varSlot: k });
  });
})(VR);

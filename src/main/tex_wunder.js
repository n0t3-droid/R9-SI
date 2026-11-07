// ============================================================================
// r-wunder · the Wundertiere's items (plan docs/superpowers/plans/2026-11-07-r-wunder.md): the flute (a slender wooden
// flute with three finger holes and a blue cord) and the lantern seed (a warm glowing seed in a pale paper husk),
// painted with the item primitives from tex_items.js (16×16 logical pixels, outlined). Our own.
// ============================================================================
(function (VR) {
  'use strict';
  const T = VR.TEXITEM; if (!T) return;
  const { px, poly, circ, lineP, outline, sprite, shade, lighten, C } = T;
  const S = VR.ITEM_SPRITES;
  S.wunder_flute = () => {
    const img = sprite(), wood = C(0xc8925a), dark = C(0x7a4e2a);
    // the body: a diagonal rod from the lower left to the upper right, lit along its upper edge
    for (let i = 0; i <= 11; i++) { px(img, 2 + i, 13 - i, i % 4 === 0 ? shade(wood, 0.85) : wood); px(img, 3 + i, 13 - i, lighten(wood, 0.25)); px(img, 2 + i, 14 - i, shade(wood, 0.7)); }
    px(img, 13, 2, dark); px(img, 14, 2, dark); px(img, 1, 14, dark);
    for (const k of [4, 6, 8]) px(img, 2 + k, 13 - k, dark);   // three finger holes
    lineP(img, 4, 12, 3, 15, C(0x3a7ad8)); px(img, 2, 15, C(0x9ad8ff));   // the cord
    outline(img);
    return img;
  };
  S.lantern_seed = () => {
    const img = sprite(), husk = C(0xf2e2b8);
    poly(img, [[8, 2], [12, 6], [12, 11], [8, 15], [4, 11], [4, 6]], (x, y) => (x === 4 || x === 11 ? shade(husk, 0.8) : (y % 3 === 0 ? shade(husk, 0.92) : husk)));
    circ(img, 8, 9, 2.6, (x, y, d) => (d < 0.5 ? C(0xfff4c0) : C(0xffb54a)), 1);   // the glowing seed inside
    lineP(img, 8, 0, 8, 2, C(0x6a8a3a));   // its stem
    outline(img);
    return img;
  };
})(VR);

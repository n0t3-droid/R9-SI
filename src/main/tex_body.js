// ============================================================================
// u-moons1 · the textures of the bodies' three blocks (src/shared/bodies.js): procedural, our own.
//   regolith       the highlands' bright dust (Basalt, R§5.1): light warm grey powder, darker pebbles, a few bright
//                  glass beads (impact glass), fine and even — fresh ejecta and the rays on dark ground too
//   regolith_dark  the maria's dust: dark grey-brown basalt powder (more iron and titanium, R§5.1), the same grain
//   tholin_ice     Opal's lineae: reddish-brown organic-rich ice (R§5.6, §5.8), streaked along a direction, glinting
// The palettes sit near the orbit's colours of the same ground (bodytex.js: maria 92, highlands 178, lineae 158/102/82),
// a little darker: the textures are drawn in the sun of an airless sky, without the orbit's average.
// ============================================================================
(function (VR) {
  'use strict';
  const TX = VR.TX, REC = VR.TEXREC, C = TX.C, hh = TX.hash, N = TX.N || 32;
  if (!REC) return;
  const K = TX.chunky;
  REC.regolith = () => {
    const img = TX.natural([0x77746e, 0x8e8a83, 0xa29e96, 0xb3afa7], { period: 6, oct: 3, speck: 0.07, speckDark: true, speck2: 0.025, seed: 9101, contrast: 0.9, rough: 0.97 });
    img.forEach((x, y, i) => { if (hh(x, y, 9102) < 0.012) { img.set(x, y, C(0xd8d6cf)); img.ro[i] = 0.35; } });   // glass beads
    return K(img);
  };
  REC.regolith_dark = () => {
    const img = TX.natural([0x3b3a3a, 0x494745, 0x575450, 0x63605a], { period: 6, oct: 3, speck: 0.08, speckDark: true, speck2: 0.02, seed: 9111, contrast: 0.95, rough: 0.97 });
    img.forEach((x, y, i) => { if (hh(x, y, 9112) < 0.01) { img.set(x, y, C(0x8a877f)); img.ro[i] = 0.4; } });
    return K(img);
  };
  REC.tholin_ice = () => {
    const img = TX.natural([0x6e4234, 0x86553f, 0x9c6a50, 0xae7e62], { period: 4, oct: 3, stretchY: 0.35, seed: 9121, contrast: 1.1, rough: 0.25 });
    TX.cracks(img, 5, 9122, C(0xc9a28a));
    img.forEach((x, y, i) => { if (hh(x, y, 9123) < 0.015) img.em[i] = 0.18; });   // a glint of ice
    return K(img);
  };
  // ---- u-moons2: Zinnober's two (bodies2.js) — red sulfur, grainy and crusted; SO₂ frost, white with a faint blue-grey
  REC.sulfur_red = () => {
    const img = TX.natural([0x8a2a18, 0xa63a20, 0xbc4a26, 0xcf6232], { period: 5, oct: 3, speck: 0.06, speckDark: true, seed: 9131, contrast: 1.0, rough: 0.9 });
    img.forEach((x, y, i) => { if (hh(x, y, 9132) < 0.02) img.set(x, y, C(0xd9852f)); });   // flecks relaxing to orange
    return K(img);
  };
  REC.so2_frost = () => {
    const img = TX.natural([0xc9cbc6, 0xd8dad4, 0xe6e7e0, 0xf2f2ea], { period: 5, oct: 3, speck: 0.03, seed: 9141, contrast: 0.8, rough: 0.7 });
    img.forEach((x, y, i) => { if (hh(x, y, 9142) < 0.015) { img.set(x, y, C(0xe8d27a)); } });   // a few sulfur grains in the frost
    return K(img);
  };
  // ---- end u-moons2
  void N;
})(VR);

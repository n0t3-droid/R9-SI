// ============================================================================
// u-stars2 · the textures of the exo blocks (src/shared/exo_blocks.js): procedural, our own.
//   exo_crystal  pale blue-white prisms on a dark blue-grey matrix, glowing along their edges
//   exo_moss     dark violet moss: tufts, a few magenta tips, near-black hollows
//   exo_frond    violet fronds (a blade sprite)
//   exo_glass    dark green-brown glass grains with bright glints
// ============================================================================
(function (VR) {
  'use strict';
  const TX = VR.TX, REC = VR.TEXREC, C = TX && TX.C, hh = TX && TX.hash, N = (TX && TX.N) || 32;
  if (!REC || !TX) return;
  const K = TX.chunky;
  REC.exo_crystal = () => {
    const img = TX.natural([0x2a3346, 0x323d55, 0x3b4862, 0x46546f], { period: 4, oct: 2, speck: 0.05, speckDark: true, seed: 9301, contrast: 1.0, rough: 0.85 });
    const P = []; for (let k = 0; k < 6; k++) P.push({ x: hh(k, 1, 9304) * N, y: hh(k, 2, 9304) * N, a: 1.2 + (hh(k, 3, 9304) - 0.5) * 0.9, L: N * (0.3 + 0.3 * hh(k, 4, 9304)), w: N * (0.07 + 0.06 * hh(k, 5, 9304)) });
    img.forEach((x, y, i) => {
      for (const p of P) {
        let dx = x + 0.5 - p.x, dy = y + 0.5 - p.y; dx -= Math.round(dx / N) * N; dy -= Math.round(dy / N) * N;
        const u = dx * Math.cos(p.a) + dy * Math.sin(p.a), v = -dx * Math.sin(p.a) + dy * Math.cos(p.a);
        if (Math.abs(u) > p.L || Math.abs(v) > p.w * (1 - 0.7 * Math.max(0, Math.abs(u) / p.L - 0.6) / 0.4)) continue;
        const e = v / p.w, t = 0.5 + 0.5 * u / p.L;
        img.set(x, y, C(e > 0.5 ? 0xf4fbff : e < -0.5 ? 0x5a78b8 : t > 0.55 ? 0xc6dcff : 0x95b4ee)); img.ro[i] = 0.12; img.em[i] = e > 0.5 ? 0.8 : 0.3 + 0.25 * t;
        break;
      }
    });
    return K(img);
  };
  REC.exo_moss = () => {
    const img = TX.natural([0x2a1236, 0x3b1a4c, 0x4f2462, 0x652f78], { period: 3, oct: 3, speck: 0.08, speckDark: true, seed: 9311, contrast: 1.05, rough: 0.97 });
    img.forEach((x, y, i) => { const h = hh(x, y, 9312); if (h < 0.035) img.set(x, y, C(h < 0.012 ? 0xc04aa8 : 0x8a3c9c)); });   // tips catching the light
    return K(img);
  };
  REC.exo_frond = () => TX.blades([0x24102e, 0x3e1a50, 0x5a2670, 0x7a368e, 0xa452b0], { count: 12, minH: 12, varH: 16, seed: 9321, thick: true, lean: 0.8 });
  REC.exo_glass = () => {
    const img = TX.natural([0x1c2018, 0x283022, 0x343c2a, 0x45452e], { period: 4, oct: 3, speck: 0.07, speckDark: true, seed: 9331, contrast: 0.95, rough: 0.35 });
    img.forEach((x, y, i) => { const h = hh(x, y, 9332); if (h < 0.03) { img.set(x, y, C(h < 0.01 ? 0xe8f0d8 : 0x7a8a5a)); img.ro[i] = 0.08; } });   // glints of the fused grains
    return K(img);
  };
  void N;
})(VR);

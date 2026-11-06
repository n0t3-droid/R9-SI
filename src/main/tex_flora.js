// ============================================================================
// v-flora · the textures of the blooming flora (src/shared/flora_blocks.js): procedural, our own.
//   bloom_snow / bloom_lilac / bloom_gold / bloom_rose   blossom leaves: a cloud of petals, a few green leaves peeking
//        through, a bright eye now and then (cartoon-clear colour fields, not noise)
//   candle_flower_*  a tall violet-blue spike of florets over a leafy stem · umbel_flower_*  white flat umbels ·
//   bell_tower_flower_*  pink bells hanging round a stem · glowbell  pale blue bells that glow · clover  round leaflets
//   in threes with white and pink heads
// ============================================================================
(function (VR) {
  'use strict';
  const TX = VR.TX, REC = VR.TEXREC, C = TX && TX.C, hh = TX && TX.hash, N = (TX && TX.N) || 32;
  if (!REC || !TX) return;
  const K = TX.chunky;
  const BLOOM = {
    bloom_snow: [[0xc8ccd8, 0xe4e8f0, 0xf6f8fc, 0xffffff], 0xffe680, 2311],
    bloom_lilac: [[0x6a3aa0, 0x9058c8, 0xb07ee0, 0xd2aaf4], 0xf6e8ff, 2312],
    bloom_gold: [[0xb07a08, 0xe0a818, 0xf6cc30, 0xffe878], 0xfff6c0, 2313],
    bloom_rose: [[0xb02a62, 0xe0508a, 0xf47aa8, 0xffb0cc], 0xfff0f6, 2314],
  };
  for (const k of Object.keys(BLOOM)) REC[k] = () => {
    const [pal, eye, s] = BLOOM[k];
    const img = TX.leaves(pal, { seed: s, cells: 6, holes: 0.22 });
    // a few green leaves through the petals, and the petals' bright eyes
    img.forEach((x, y, i) => {
      if (img.c[i * 4 + 3] < 0.5) return;
      const h = hh(x, y, s + 3);
      if (h < 0.03) img.set(x, y, C(h < 0.015 ? 0x3d7a2a : 0x5a9a3a), 1);
      else if (h > 0.975) img.set(x, y, C(eye), 1);
    });
    return K(img);
  };
  const stem = (img, x, y0, y1, col) => { for (let y = y0; y <= y1; y++) { TX.dot(img, x, y, col, 0.6); TX.dot(img, x + 1, y, TX.scale(col, 0.8), 0.6); } };
  const leaf = (img, x, y, dir, col, len) => { for (let i = 0; i < len; i++) { TX.dot(img, x + dir * i, y - (i >> 1), TX.scale(col, 0.9 + i * 0.04)); TX.dot(img, x + dir * i, y - (i >> 1) + 1, TX.scale(col, 0.72)); } };
  const GREEN = 0x3e8a2c, LEAFC = 0x52a03a;
  const bottom = (seed, florets) => () => {
    const img = TX.sprite();
    stem(img, 15, 0, 31, C(GREEN));
    leaf(img, 17, 27, 1, C(LEAFC), 9); leaf(img, 14, 23, -1, C(LEAFC), 9); leaf(img, 17, 16, 1, C(LEAFC), 7); leaf(img, 14, 10, -1, C(LEAFC), 6);
    if (florets) florets(img, true);
    TX.outline(img, 0.72);
    return img;
  };
  // Kerzenblume: florets in whorls up a spike, darker at the foot, paler at the tip
  REC.candle_flower_bottom = bottom(2321);
  REC.candle_flower_top = () => {
    const img = TX.sprite();
    stem(img, 15, 8, 31, C(GREEN)); leaf(img, 17, 29, 1, C(LEAFC), 6);
    for (let y = 3, k = 0; y < 27; y += 3, k++) {
      const t = (y - 3) / 24, w = 1.4 + 2.8 * t, col = TX.mix(C(0xd8ccff), C(0x5440d0), t), o = (k & 1) ? 0.8 : -0.8;
      for (const s of [-1, 1]) TX.disc(img, 15.5 + s * w + o, y + 1, 1.25, () => TX.scale(col, 0.92 + hh(y, s, 7) * 0.2));
      if (k & 1) TX.disc(img, 15.5 + o * 0.5, y, 1.1, () => TX.scale(col, 1.12));
    }
    TX.outline(img, 0.7);
    return img;
  };
  // Schirmblume: two white flat umbels of tiny florets on rays
  REC.umbel_flower_bottom = bottom(2322);
  REC.umbel_flower_top = () => {
    const img = TX.sprite();
    stem(img, 15, 10, 31, C(GREEN)); leaf(img, 17, 24, 1, C(LEAFC), 7);
    for (const [cx, cy, r] of [[15.5, 8, 8.5], [24, 16, 4.5]]) {
      for (let k = 0; k < 7; k++) { const x = cx - r + (2 * r) * k / 6; TX.line(img, Math.round(cx), Math.round(cy + 4), Math.round(x), Math.round(cy), (px, py) => TX.dot(img, px, py, C(0x4a8a30))); }
      for (let k = 0; k < r * 3; k++) TX.disc(img, cx + (hh(k, 1, 2322 + r) - 0.5) * 2 * r, cy - 1 + (hh(k, 2, 2322) - 0.5) * 3, 1.3, () => C(hh(k, 3, 9) < 0.2 ? 0xfff2c8 : 0xffffff));
    }
    TX.outline(img, 0.74);
    return img;
  };
  // Glockenturm: pink bells hanging in pairs round the upper stem, the youngest buds at the tip
  REC.bell_tower_flower_bottom = bottom(2323);
  REC.bell_tower_flower_top = () => {
    const img = TX.sprite();
    stem(img, 15, 3, 31, C(GREEN)); leaf(img, 17, 29, 1, C(LEAFC), 6);
    for (let k = 0; k < 6; k++) {
      const y = 6 + k * 4, s = k & 1 ? 1 : -1, x = 15.5 + s * 3.5, col = TX.mix(C(0xffb8d8), C(0xe0408a), k / 6);
      TX.line(img, 15, y - 1, Math.round(x), y, (px, py) => TX.dot(img, px, py, C(GREEN)));
      for (let dy = 0; dy < 4; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.abs(dx) <= 1 + (dy >> 1)) TX.dot(img, Math.round(x + dx), y + dy, TX.scale(col, 0.85 + dy * 0.06));
    }
    TX.disc(img, 15.5, 3, 1.4, () => C(0xffd0e4));
    TX.outline(img, 0.7);
    return img;
  };
  // Glimmglocke: three pale blue bells on arching stems; their mouths glow (emissive)
  REC.glowbell = () => {
    const img = TX.sprite();
    stem(img, 15, 12, 31, C(0x3a7a4a)); leaf(img, 17, 27, 1, C(0x4a9a5a), 7); leaf(img, 14, 24, -1, C(0x4a9a5a), 6);
    for (const [x, y] of [[9, 12], [22, 10], [15, 6]]) {
      TX.line(img, 15, 14, x, y - 2, (px, py) => TX.dot(img, px, py, C(0x3a7a4a)));
      for (let dy = 0; dy < 5; dy++) for (let dx = -3; dx <= 3; dx++) if (Math.abs(dx) <= 1 + (dy >> 1)) {
        const px = x + dx, py = y + dy - 2; if (px < 0 || py < 0 || px >= N || py >= N) continue;
        TX.dot(img, px, py, dy >= 3 ? C(0xe8fbff) : TX.mix(C(0x9adcff), C(0x5ab0f0), dy / 4));
        img.em[py * N + px] = dy >= 3 ? 1 : 0.6;
      }
    }
    TX.outline(img, 0.78);
    return img;
  };
  // Klee: round leaflets in threes, a few white and pink heads
  REC.clover = () => {
    const img = TX.sprite();
    for (let k = 0; k < 9; k++) {
      const cx = 3 + hh(k, 1, 2331) * 26, cy = 3 + hh(k, 2, 2331) * 26;
      for (let j = 0; j < 3; j++) { const a = j * 2.094 + k; TX.disc(img, cx + Math.cos(a) * 1.7, cy + Math.sin(a) * 1.7, 1.6, (d) => TX.scale(C(0x4ea83a), 0.85 + (1 - d) * 0.3)); }
    }
    for (let k = 0; k < 4; k++) TX.disc(img, 4 + hh(k, 5, 2332) * 24, 4 + hh(k, 6, 2332) * 24, 1.9, (d, x, y) => C((k & 1) ? 0xffffff : 0xf8b0d0));
    return img;
  };
})(VR);

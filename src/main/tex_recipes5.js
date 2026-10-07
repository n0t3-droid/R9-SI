// ============================================================================
// Texture recipes part 5 — Designer Home set (from the user's reference photos
// of a modern mono-pitch house, a two-storey villa and a neoclassical mansion):
// white/cream stucco, stacked ledgestone, charcoal roofing, wood slats, black-
// framed glass, a glass-strip garage door, driveway concrete, pavers, marble,
// herringbone oak, subway and dark tiles, travertine, decking, pool tiles.
// ============================================================================
(function (VR) {
  'use strict';
  const TX = VR.TX, N = TX.N, C = TX.C, REC = VR.TEXREC, hh = TX.hash;
  const smooth = (img, ro) => { img.forEach((x, y, i) => { img.h[i] = img.h[i] * 0.3 + 0.55; img.ro[i] = ro; }); img.noBevel = true; return img; };
  const seamless = (img) => { img.noBevel = true; return img; };
  const transpose = (img) => { const o = new TX.Img(); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const c = img.get(y, x); o.set(x, y, c, c[3]); o.h[y * N + x] = img.h[x * N + y]; o.ro[y * N + x] = img.ro[x * N + y]; o.em[y * N + x] = img.em[x * N + y]; } return o; };

  // ---- walls ----
  REC.stucco_white = () => smooth(TX.natural([0xdedcd6, 0xe8e6e0, 0xf1efe9, 0xf8f6f1], { period: 3, oct: 3, seed: 5101, contrast: 0.55, shades: 5 }), 0.9);
  REC.stucco_cream = () => smooth(TX.natural([0xe4dac6, 0xece4d2, 0xf3ecdc, 0xf8f3e7], { period: 3, oct: 3, seed: 5102, contrast: 0.55, shades: 5 }), 0.9);
  REC.stucco_grey = () => smooth(TX.natural([0x9a9c9e, 0xa8aaac, 0xb4b6b8, 0xbec0c2], { period: 3, oct: 3, seed: 5103, contrast: 0.5, shades: 5 }), 0.9);
  // stacked ledgestone: shallow irregular courses of warm grey stone with dark shadow joints
  REC.stacked_stone = () => {
    const img = new TX.Img(); img.noBevel = true;
    const P = TX.pal([0x8a8478, 0xa29c90, 0xb8b2a6, 0xcbc6bb, 0xd8d3c8], 6);
    const courses = [0, 5, 9, 15, 19, 24, 28, 32];
    for (let y = 0; y < N; y++) {
      let ci = 0; while (ci < courses.length - 1 && y >= courses[ci + 1]) ci++;
      const y0 = courses[ci], y1 = courses[ci + 1] - 1;
      const off = Math.floor(hh(ci, 0, 5104) * 20);
      let x = 0, seg = 0;
      while (x < N) {
        const len = 6 + Math.floor(hh(ci, seg + 1, 5105) * 9);
        const tone = hh(ci, seg + 7, 5106);
        for (let k = 0; k < len && x + k < N; k++) {
          const px = (x + k + off) % N;
          const edge = y === y0 || k === 0;
          const f = Math.max(0, Math.min(0.999, tone * 0.7 + TX.fbm(px, y, 3, 2, 5107) * 0.3 + (y === y1 ? 0.08 : 0)));
          img.set(px, y, edge ? C(0x3e3a34) : TX.ramp(P, f), 1);
          img.h[y * N + px] = edge ? 0.2 : 0.55 + f * 0.25; img.ro[y * N + px] = 0.9;
        }
        x += len; seg++;
      }
    }
    return img;
  };
  // charcoal roofing: dark standing-seam panels
  REC.roof_charcoal = () => {
    const img = seamless(TX.natural([0x23262a, 0x2c3035, 0x353a40, 0x3e434a], { period: 4, oct: 2, seed: 5110, contrast: 0.6, shades: 5, rough: 0.55 }));
    for (let y = 0; y < N; y++) for (const x of [0, 1, 16, 17]) { img.mul(x, y, x === 1 || x === 17 ? 1.25 : 0.7); img.H(x, y, x === 1 || x === 17 ? 0.75 : 0.35); }
    return img;
  };
  REC.roof_charcoal_top = () => seamless(TX.natural([0x23262a, 0x2c3035, 0x353a40, 0x3e434a], { period: 4, oct: 2, seed: 5111, contrast: 0.6, shades: 5, rough: 0.55 }));
  // vertical wood slats (warm walnut) on a dark backing
  REC.wood_slat = () => {
    const img = seamless(transpose(TX.planks([0x6a4226, 0x84542e, 0x9a6436, 0xb0763e, 0xc08a4c], { boards: 8, seed: 5112, seams: false })));
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if ((x & 3) === 3) { img.set(x, y, C(0x1e1a16), 1); img.H(x, y, 0.1); }
    return img;
  };
  REC.wood_slat_end = () => { const img = TX.planks([0x6a4226, 0x84542e, 0x9a6436, 0xb0763e], { boards: 4, seed: 5113 }); return img; };
  // garage door: dark grey panel with a frosted glass strip
  REC.garage_door = () => {
    const img = seamless(TX.natural([0x35383d, 0x3d4046, 0x44484e, 0x4b4f55], { period: 5, oct: 2, seed: 5114, contrast: 0.45, shades: 5, rough: 0.5 }));
    for (let y = 11; y <= 20; y++) for (let x = 0; x < N; x++) {
      const inner = y >= 13 && y <= 18;
      const c = inner ? TX.mix(C(0xc4d0d8), C(0xe6eef2), TX.fbm(x, y, 6, 2, 5115) * 0.6) : C(0x1e2024);
      img.set(x, y, c, 1); img.h[y * N + x] = inner ? 0.62 : 0.3; img.ro[y * N + x] = inner ? 0.12 : 0.5;
    }
    for (let x = 0; x < N; x++) { img.mul(x, 0, 0.55); img.H(x, 0, 0.25); img.mul(x, N - 1, 1.1); }
    return img;
  };
  REC.black_metal = () => smooth(TX.natural([0x1c1e22, 0x24262a, 0x2b2d31, 0x323438], { period: 4, oct: 2, seed: 5116, contrast: 0.5, shades: 5 }), 0.45);
  REC.charcoal_panel = () => {
    const img = smooth(TX.natural([0x2a2d32, 0x33373d, 0x3c4046, 0x44484e], { period: 5, oct: 2, seed: 5117, contrast: 0.5, shades: 5 }), 0.6);
    for (let y = 0; y < N; y++) for (const x of [0, 16]) { img.mul(x, y, 0.65); img.H(x, y, 0.3); }
    return img;
  };
  REC.white_trim = () => { const img = TX.polished([0xe6e6e2, 0xeeeeea, 0xf5f5f1, 0xfbfbf8], { seed: 5118, border: 0 }); for (let x = 0; x < N; x++) { img.mul(x, 10, 0.86); img.H(x, 10, 0.35); img.mul(x, 11, 1.08); img.mul(x, 21, 0.86); img.H(x, 21, 0.35); img.mul(x, 22, 1.08); } return smooth(img, 0.7); };
  REC.white_trim_top = () => smooth(TX.polished([0xe6e6e2, 0xeeeeea, 0xf5f5f1, 0xfbfbf8], { seed: 5119, border: 0 }), 0.7);

  // ---- ground ----
  REC.concrete_smooth = () => seamless(TX.natural([0xb2b0aa, 0xbebcb6, 0xc8c6c0, 0xd0cec8], { period: 6, oct: 3, seed: 5120, contrast: 0.5, shades: 6, speck: 0.01, speckDark: true, rough: 0.9 }));
  REC.paver_grey = () => TX.tiles([0x8c8a86, 0x9e9c98, 0xaeaca8, 0xbab8b4], 0x66645f, 2, { seed: 5121, shades: 6 });
  REC.granite_paver = () => TX.tiles([0x66625e, 0x76726e, 0x86827e, 0x94908c], 0x46443f, 4, { seed: 5122, shades: 6 });
  REC.deck_wood = () => seamless(TX.planks([0x6a5a4c, 0x7a6a5a, 0x8a7a68, 0x968674], { boards: 4, seed: 5123 }));
  REC.pool_tile = () => { const img = TX.tiles([0x74c2e6, 0x86d0f0, 0x98dcf8, 0xa8e6ff], 0xe0f2fc, 4, { seed: 5124, shades: 5 }); return smooth(img, 0.15); };
  REC.lawn_edge = () => TX.natural([0x4e8a3a, 0x5a9a42, 0x66a84a, 0x72b452], { period: 3, oct: 3, seed: 5125, contrast: 0.7, shades: 6 });

  // ---- interior floors & tiles ----
  const veins = (img, col, freq, width, seed) => { img.forEach((x, y, i) => { const v = Math.abs(Math.sin(x * freq + y * 0.07 + TX.fbm(x, y, 5, 3, seed) * 7)); if (v < width) { img.set(x, y, TX.mix(img.get(x, y), C(col), 0.7 - v / width * 0.5), 1); } }); return img; };
  REC.marble_white = () => smooth(veins(TX.natural([0xd9d9dd, 0xe6e6ea, 0xf0f0f3, 0xf8f8fa], { period: 5, oct: 3, seed: 5130, contrast: 0.45, shades: 5 }), 0xa8aab2, 0.22, 0.07, 5131), 0.12);
  REC.marble_dark = () => smooth(veins(TX.natural([0x1c1e22, 0x272a2f, 0x31343a, 0x3c4046], { period: 5, oct: 3, seed: 5132, contrast: 0.5, shades: 5 }), 0x9a9ca4, 0.2, 0.05, 5133), 0.12);
  REC.travertine = () => smooth(TX.natural([0xd6c9b0, 0xe0d5be, 0xe9dfca, 0xf1e9d8], { period: 4, oct: 3, seed: 5134, contrast: 0.6, shades: 6, bands: 0.5, bandWarp: 4 }), 0.4);
  REC.oak_herringbone = () => {
    const img = new TX.Img(); img.noBevel = true;
    const P = TX.pal([0x9a6a3c, 0xae7a46, 0xbe8a52, 0xcc985e, 0xd8a86c], 6);
    img.forEach((x, y, i) => {
      // 8×4 blocks laid diagonally: tile index from the 45° lattice
      const u = x + y, v = x - y + 64;
      const tu = Math.floor(u / 8), tv = Math.floor(v / 8);
      const along = ((tu + tv) & 1) === 0;
      const lu = u - tu * 8, lv = v - tv * 8;
      const seam = lu === 0 || lv === 0;
      const grain = TX.fbm(along ? x * 0.3 : x * 2.5, along ? y * 2.5 : y * 0.3, 6, 2, 5135 + tu * 3 + tv);
      const f = Math.max(0, Math.min(0.999, 0.35 + hh(tu, tv, 5136) * 0.35 + (grain - 0.4) * 0.5));
      img.set(x, y, seam ? C(0x5a3a20) : TX.ramp(P, f), 1);
      img.h[i] = seam ? 0.3 : 0.6 + grain * 0.1; img.ro[i] = 0.35;
    });
    return img;
  };
  REC.subway_tile = () => { const img = TX.bricks([0xeaeae6, 0xf2f2ee, 0xf8f8f5, 0xffffff], 0xbdbdb8, { rows: 4, per: 2, seed: 5137, shades: 4 }); return smooth(img, 0.1); };
  REC.dark_tile = () => { const img = TX.tiles([0x36383c, 0x404246, 0x4a4c50, 0x525458], 0x26282c, 2, { seed: 5138, shades: 5 }); return smooth(img, 0.25); };
  REC.terrazzo = () => { const img = TX.natural([0xe4e2dc, 0xecebe6, 0xf3f2ee, 0xf8f7f4], { period: 6, oct: 2, seed: 5139, contrast: 0.4, shades: 4 }); img.forEach((x, y, i) => { const r = hh(x, y, 5140); if (r < 0.06) { img.set(x, y, C([0x8a8a90, 0xb8a080, 0x6a7a90, 0xc8b8a0, 0x4a4a50][Math.floor(hh(x, y, 5141) * 5)]), 1); } }); return smooth(img, 0.15); };
  REC.carpet_cream = () => seamless(TX.wool ? TX.wool(0xe8e0d0, { seed: 5142 }) : TX.natural([0xd8d0c0, 0xe2dacc, 0xe8e0d0, 0xeee8da], { period: 2, oct: 2, seed: 5142, contrast: 0.7 }));

  // ---- modern interior materials ----
  REC.porcelain_tile = () => { const img = TX.tiles([0xc9c8c4, 0xd3d2ce, 0xdcdbd7, 0xe4e3df], 0xb0afab, 2, { seed: 5150, shades: 5 }); return smooth(img, 0.18); };
  REC.oak_wide = () => seamless(TX.planks([0xb08a5c, 0xbc9768, 0xc8a374, 0xd2ae80, 0xdcb98c], { boards: 3, seed: 5151 }));
  REC.micro_cement = () => smooth(TX.natural([0xa8a49c, 0xb4b0a8, 0xbfbbb3, 0xc8c4bc], { period: 5, oct: 3, seed: 5152, contrast: 0.45, shades: 5 }), 0.7);
  REC.walnut_panel = () => { const img = seamless(TX.planks([0x4a3020, 0x5c3c28, 0x6e4830, 0x7e5438], { boards: 4, seed: 5153 })); return smooth(img, 0.35); };
  // ---- villa facades (Stadtvillen & the classic villas): white clinker, warm mediterranean stucco, sand stucco, bossed stone base
  REC.white_clinker = () => { const img = TX.bricks([0xe2e0da, 0xebe9e3, 0xf2f0ea, 0xf8f6f1], 0xbfbdb6, { rows: 8, per: 2, seed: 5160, shades: 5 }); img.forEach((x, y, i) => { img.ro[i] = 0.8; }); return img; };
  REC.stucco_ochre = () => smooth(TX.natural([0xd9b27a, 0xe2bd86, 0xe9c794, 0xf0d2a4], { period: 3, oct: 3, seed: 5161, contrast: 0.55, shades: 5 }), 0.9);
  REC.stucco_sand = () => smooth(TX.natural([0xd8cdb4, 0xe1d7c0, 0xe9e0cc, 0xf0e8d8], { period: 3, oct: 3, seed: 5162, contrast: 0.5, shades: 5 }), 0.9);
  REC.bossed_stone = () => { const img = TX.bricks([0xcfcac0, 0xdad5cb, 0xe3ded4, 0xebe7de], 0x8e8a80, { rows: 2, per: 2, seed: 5163, shades: 6, mortarW: 1 }); img.forEach((x, y, i) => { const lx = x % 16, ly = y % 16; const e = Math.min(lx, 15 - lx, ly, 15 - ly); img.h[i] = e < 2 ? 0.25 : 0.7 + TX.fbm(x, y, 3, 2, 5164) * 0.3; img.ro[i] = 0.85; }); return img; };
  REC.slate_roof = () => { const img = TX.tiles([0x3a3e45, 0x444951, 0x4e535c, 0x585e68], 0x2a2d33, 4, { seed: 5165, shades: 6 }); return smooth(img, 0.6); };
  REC.black_kitchen = () => smooth(TX.natural([0x1a1c1f, 0x212326, 0x27292c, 0x2c2e31], { period: 4, oct: 2, seed: 5154, contrast: 0.4, shades: 4 }), 0.3);
  // ---- glass ----
  REC.window_black = () => seamless(TX.glass(0x1a1c1e, 0x9cc4dc, { alpha: 0.26, frameA: 1, streakA: 0.55 }));
  REC.window_white = () => seamless(TX.glass(0xf0f0ea, 0x9cc4dc, { alpha: 0.26, frameA: 1, streakA: 0.55 }));
  REC.window_warm = () => { const img = TX.glass(0x1a1c1e, 0xffd08a, { alpha: 0.62, frameA: 1, streakA: 0.75 }); img.forEach((x, y, i) => { if (x > 0 && y > 0 && x < N - 1 && y < N - 1) img.em[i] = 0.55; }); return img; };
  REC.glass_rail = () => TX.glass(0x2a2c30, 0xd8ecf4, { alpha: 0.18, frameA: 1, streakA: 0.5 });
  REC.frosted_glass = () => { const img = new TX.Img(); img.forEach((x, y, i) => { img.set(x, y, TX.mix(C(0xdce8ee), C(0xf4f8fa), TX.fbm(x, y, 3, 2, 5143)), 0.7); img.ro[i] = 0.3; }); return img; };
})(VR);

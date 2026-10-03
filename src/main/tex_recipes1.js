// ============================================================================
// Texture recipes part 1: stone, soil, bricks, wood, leaves, ores, metals, colors
// ============================================================================
(function (VR) {
  'use strict';
  const TX = VR.TX, N = TX.N, C = TX.C;
  const REC = VR.TEXREC = {};      // exact names
  const PRE = VR.TEXPRE = {};      // prefix handlers: prefix → fn(parts)
  const hh = TX.hash;

  // ---------------- palettes ----------------
  const PAL = VR.PAL = {
    stone: [0x4a4c50, 0x66696d, 0x7f8286, 0x9a9da0],
    deep: [0x25252c, 0x36363f, 0x494a53, 0x5c5d67],
    granite: [0x6e4034, 0x915847, 0xad705b, 0xc48d78],
    diorite: [0x8a8a88, 0xb0b0ad, 0xd3d3cf, 0xededea],
    andesite: [0x5f6061, 0x7b7c7d, 0x929394, 0xa7a8a9],
    tuff: [0x474840, 0x5d5f55, 0x75776b, 0x8a8c7f],
    calcite: [0xc4c4bd, 0xd9d9d2, 0xeaeae4, 0xf7f7f2],
    drip: [0x5f4b3c, 0x7c6553, 0x98806b, 0xb09880],
    sand: [0xc8b582, 0xd9c895, 0xe6d7a8, 0xf0e4bd],
    redsand: [0x9c4718, 0xb85a24, 0xcb6f33, 0xda8747],
    sandstone: [0xbfa672, 0xd4bd86, 0xe2cd98, 0xeddcad],
    redsandstone: [0x8f4417, 0xa9571f, 0xc06b2c, 0xd0813d],
    cinnabar: [0x6a1a18, 0x93241f, 0xb73a2a, 0xd45c3f],
    sulfur: [0x8d7c18, 0xb9a828, 0xd9c942, 0xefe278],
    tide: [0x2a6159, 0x3a7f74, 0x54a091, 0x78bdae],
    abyss: [0x15302d, 0x1f463f, 0x2a5c53, 0x357065],
    ember: [0x3f1011, 0x5f1819, 0x7e2420, 0x9b3629],
    scoria: [0x19161b, 0x252128, 0x332d37, 0x413a46],
    basalt: [0x2f2f35, 0x404047, 0x52525a, 0x64646c],
    voidstone: [0xa9a57c, 0xc4c093, 0xd6d2a6, 0xe5e1b9],
    lilac: [0x7c4d86, 0x9868a2, 0xb283bb, 0xc79dcf],
    quartz: [0xcfc8bd, 0xe1dbd1, 0xefeae2, 0xfaf7f1],
    obsidian: [0x0b0814, 0x170f29, 0x251a40, 0x352758],
    bedrock: [0x1f1f1f, 0x3d3d3d, 0x5c5c5c, 0x7c7c7c],
    dirt: [0x553823, 0x714e34, 0x8a6546, 0x9f7a58],
    gravel: [0x57534f, 0x736e69, 0x8c8781, 0xa39e97],
    clay: [0x8a90a0, 0x9ca2b2, 0xaeb4c2, 0xbfc4d0],
    mud: [0x352e2b, 0x453d39, 0x554b46, 0x625752],
    packedmud: [0x735340, 0x886450, 0x9b7660, 0xab876f],
    gloomsand: [0x3a2b20, 0x4f3c2c, 0x64503d, 0x76614c],
    gloomsoil: [0x362820, 0x46362b, 0x564536, 0x655341],
    snow: [0xd6e0ea, 0xe6eef6, 0xf2f7fc, 0xfbfdff],
    terracotta: [0x87543e, 0x9a644c, 0xab755b, 0xb98569],
    moss: [0x3a5a22, 0x4f7a2d, 0x66963c, 0x7eae4d],
    palemoss: [0x8a9186, 0xa2a99c, 0xb9beb1, 0xcdd1c5],
    echo: [0x071a22, 0x0b2a35, 0x114050, 0x1a5a6c],
    bone: [0xcfc8b0, 0xe0dac4, 0xece7d5],
    hay: [0x8a6a14, 0xb08c20, 0xcfae34, 0xe2c85a],
  };
  const WOOD = VR.WOODPAL = {
    oak: { planks: [0x5a4224, 0x86673a, 0xa98652, 0xc4a169], bark: [0x33241a, 0x4e3a27, 0x6a5037, 0x7e6245], ring: [0x86673a, 0xae8b56, 0xcfae72], stripped: [0x9c7a45, 0xb89660, 0xcfae76] },
    spruce: { planks: [0x3a2816, 0x573d24, 0x735534, 0x886842], bark: [0x24180e, 0x37271a, 0x4b3625, 0x5c4531], ring: [0x573d24, 0x77583a, 0x94744f], stripped: [0x6e5133, 0x86663f, 0x9c7b52] },
    birch: { planks: [0xa38e58, 0xc0ab76, 0xd4c290, 0xe2d4a8], bark: [0xc9c5b9, 0xdedad0, 0xefece4, 0xfaf8f2], ring: [0xc0ab76, 0xd6c492, 0xe6d9ad], stripped: [0xc7b27e, 0xd9c894, 0xe8d9ad], marks: 0x2a2a28 },
    jungle: { planks: [0x734a30, 0x9a6645, 0xb6825a, 0xc99a70], bark: [0x39290f, 0x51401c, 0x685627, 0x7a6832], ring: [0x9a6645, 0xba865f, 0xd29e76], stripped: [0xae7f55, 0xc4966a, 0xd6ab80] },
    acacia: { planks: [0x843a1c, 0xab552b, 0xc76c3b, 0xd98552], bark: [0x46423d, 0x625d56, 0x7d766d, 0x958d83], ring: [0xab552b, 0xcc7243, 0xe08c5a], stripped: [0xb05a2e, 0xc66f3f, 0xd88652] },
    dark_oak: { planks: [0x2a1b0e, 0x402c18, 0x563d23, 0x68502f], bark: [0x211709, 0x342514, 0x46341f, 0x563f27], ring: [0x402c18, 0x5c4225, 0x755633], stripped: [0x4f3a24, 0x644b30, 0x785d3d] },
    mangrove: { planks: [0x662622, 0x86362f, 0xa0483d, 0xb35a4c], bark: [0x35251e, 0x4f3a30, 0x644c40, 0x765c4e], ring: [0x86362f, 0xa6493e, 0xbf5d4f], stripped: [0x87342c, 0x9e433a, 0xb3554a] },
    cherry: { planks: [0xc08480, 0xdaa39c, 0xebc0b8, 0xf6d6cf], bark: [0x341f24, 0x4d2b33, 0x663943, 0x7a4852], ring: [0xdaa39c, 0xecbdb5, 0xf8d3cc], stripped: [0xd89c95, 0xe6b2aa, 0xf2c8c0] },
    pale_oak: { planks: [0xc2b7ab, 0xd7cec4, 0xe7e0d8, 0xf2ede7], bark: [0x524b45, 0x6d6660, 0x857f79, 0x9b958f], ring: [0xd7cec4, 0xe6dfd7, 0xf2ece6], stripped: [0xd0c6bb, 0xe0d8cf, 0xece6df] },
    poplar: { planks: [0xb09a72, 0xc8b48a, 0xdac8a2, 0xe7d8b8], bark: [0x66615a, 0x857f76, 0xa39c91, 0xbbb4a8], ring: [0xc8b48a, 0xdac9a2, 0xe8dbba], stripped: [0xcab68f, 0xdac8a4, 0xe8d9b9], marks: 0x3b3833 },
    bamboo: { planks: [0xaf9b40, 0xcab556, 0xdcca6e, 0xebdb8e] },
    crimson: { planks: [0x541d31, 0x742a41, 0x903b53, 0xa84f66], bark: [0x40101d, 0x60182c, 0x82223b, 0x9a2e49], ring: [0x742a41, 0x943f56, 0xae566c], stripped: [0x8e2d45, 0xa33b54, 0xb84d66], glow: 0xff6a3a },
    teal: { planks: [0x1b554f, 0x28716b, 0x378c84, 0x4aa59b], bark: [0x251b36, 0x35284b, 0x463662, 0x584677], ring: [0x28716b, 0x3a8d85, 0x52a79e], stripped: [0x2c7d76, 0x3a9189, 0x4da59d], glow: 0x3affd0 },
  };

  // ---------------- basic rock & soil ----------------
  REC.stone = () => TX.natural(PAL.stone, { period: 4, oct: 3, speck: 0.03, seed: 1, cracks: 0 });
  REC.cobblestone = () => {
    const img = new TX.Img(), P = TX.pal(PAL.stone, 6);
    img.forEach((x, y, i) => {
      const c = TX.cells(x, y, 5, 41);
      const edge = c[1] - c[0];
      const shade = hh(c[2], 1, 41) * 0.5 + 0.3;
      let f = shade + (TX.fbm(x, y, 8, 2, 42) - 0.5) * 0.35 + (1 - c[0]) * 0.15;
      let h = 0.55 + (1 - c[0]) * 0.4;
      if (edge < 0.14) { f = 0.05; h = 0.1; }
      img.set(x, y, TX.ramp(P, Math.max(0, Math.min(0.999, f))), 1); img.h[i] = h; img.ro[i] = 0.88;
    });
    return img;
  };
  REC.mossy_cobblestone = () => { const img = REC.cobblestone(); TX.moss(img, 0.42, 71); return img; };
  REC.smooth_stone = () => { const img = TX.natural(PAL.stone, { period: 2, oct: 2, contrast: 0.6, seed: 3, bias: 0.12 }); TX.bevel(img, 0, 0, N - 1, N - 1, 0.12, 0.2); return img; };
  REC.smooth_stone_slab_side = () => { const img = REC.smooth_stone(); for (let x = 0; x < N; x++) { img.mul(x, 15, 0.7); img.mul(x, 16, 1.1); img.H(x, 15, 0.2); } return img; };
  REC.stone_bricks = () => TX.bricks(PAL.stone, 0x3d3f42, { rows: 4, per: 2, seed: 5 });
  REC.cracked_stone_bricks = () => TX.bricks(PAL.stone, 0x3d3f42, { rows: 4, per: 2, seed: 5, cracks: 6 });
  REC.mossy_stone_bricks = () => TX.bricks(PAL.stone, 0x3d3f42, { rows: 4, per: 2, seed: 5, moss: 0.38 });
  REC.chiseled_stone_bricks = () => TX.chiseled(REC.smooth_stone(), 'ring');
  REC.granite = () => TX.natural(PAL.granite, { period: 4, oct: 3, speck: 0.08, speck2: 0.03, seed: 7, contrast: 1.4 });
  REC.polished_granite = () => TX.polished(PAL.granite, { seed: 7 });
  REC.diorite = () => TX.natural(PAL.diorite, { period: 4, oct: 3, speck: 0.12, speckDark: true, seed: 9, contrast: 1.2 });
  REC.polished_diorite = () => TX.polished(PAL.diorite, { seed: 9 });
  REC.andesite = () => TX.natural(PAL.andesite, { period: 5, oct: 3, speck: 0.1, speck2: 0.04, seed: 11, contrast: 1.3 });
  REC.polished_andesite = () => TX.polished(PAL.andesite, { seed: 11 });
  REC.deepstone = () => TX.natural(PAL.deep, { period: 4, oct: 3, bands: 0.9, bandWarp: 4, seed: 13, speck: 0.03 });
  REC.deepstone_top = () => { const img = TX.natural(PAL.deep, { period: 4, oct: 3, seed: 14, cells: 3, cellEdge: 0.05 }); return img; };
  REC.cobbled_deepstone = () => { const img = REC.cobblestone(); const P = TX.pal(PAL.deep, 6); img.forEach((x, y, i) => { img.set(x, y, TX.ramp(P, Math.min(0.999, TX.lum(img.get(x, y)) * 1.5))); }); return img; };
  REC.polished_deepstone = () => TX.polished(PAL.deep, { seed: 15 });
  REC.chiseled_deepstone = () => TX.chiseled(TX.polished(PAL.deep, { seed: 16 }), 'face');
  REC.deepstone_bricks = () => TX.bricks(PAL.deep, 0x16161b, { rows: 4, per: 2, seed: 17 });
  REC.cracked_deepstone_bricks = () => TX.bricks(PAL.deep, 0x16161b, { rows: 4, per: 2, seed: 17, cracks: 7 });
  REC.deepstone_tiles = () => TX.tiles(PAL.deep, 0x131318, 4, { seed: 18 });
  REC.cracked_deepstone_tiles = () => TX.tiles(PAL.deep, 0x131318, 4, { seed: 18, cracks: 7 });
  REC.tuff = () => TX.natural(PAL.tuff, { period: 4, oct: 3, speck: 0.06, speck2: 0.05, seed: 19 });
  REC.polished_tuff = () => TX.polished(PAL.tuff, { seed: 19 });
  REC.chiseled_tuff = () => TX.chiseled(TX.polished(PAL.tuff, { seed: 20 }), 'layers');
  REC.chiseled_tuff_top = () => TX.chiseled(TX.polished(PAL.tuff, { seed: 20 }), 'diamond');
  REC.tuff_bricks = () => TX.bricks(PAL.tuff, 0x303129, { rows: 4, per: 2, seed: 21, offset: false });
  REC.chiseled_tuff_bricks = () => TX.chiseled(TX.bricks(PAL.tuff, 0x303129, { rows: 2, per: 1, seed: 22 }), 'bars');
  REC.chiseled_tuff_bricks_top = () => TX.chiseled(TX.polished(PAL.tuff, { seed: 22 }), 'ring');
  REC.calcite = () => TX.natural(PAL.calcite, { period: 3, oct: 3, speck: 0.04, speckDark: true, seed: 23, contrast: 1.1 });
  REC.dripstone_block = () => TX.natural(PAL.drip, { period: 4, oct: 3, bands: 1.6, bandWarp: 3, seed: 25 });
  REC.bedrock = () => TX.natural(PAL.bedrock, { period: 6, oct: 2, contrast: 2.2, seed: 27, cells: 5, cellEdge: 0.08 });
  REC.obsidian = () => { const img = TX.natural(PAL.obsidian, { period: 3, oct: 3, contrast: 1.8, seed: 29, rough: 0.15 }); img.forEach((x, y, i) => { if (hh(x, y, 5) < 0.02) img.set(x, y, C(0x6a4aa8)); }); return img; };
  REC.weeping_obsidian = () => { const img = REC.obsidian(); img.forEach((x, y, i) => { const f = TX.fbm(x, y, 4, 2, 33); if (f > 0.62) { img.set(x, y, TX.mix(C(0x7a2ae0), C(0xc07aff), (f - 0.62) * 3)); img.em[i] = (f - 0.62) * 2.2; } }); return img; };
  REC.glowing_obsidian = () => { const img = REC.obsidian(); img.forEach((x, y, i) => { const f = TX.fbm(x, y, 4, 2, 34); img.set(x, y, TX.mix(C(0x5a0e08), C(0xff5a1a), Math.max(0, f - 0.3) * 1.6)); img.em[i] = Math.max(0, f - 0.4) * 1.8; }); return img; };
  REC.gravel = () => {
    const img = new TX.Img(), P = TX.pal(PAL.gravel, 6);
    img.forEach((x, y, i) => {
      const c = TX.cells(x, y, 8, 51); const shade = hh(c[2], 1, 51);
      let f = shade * 0.7 + (1 - c[0]) * 0.3 + (hh(x, y, 52) - 0.5) * 0.1;
      if (c[1] - c[0] < 0.1) f *= 0.4;
      img.set(x, y, TX.ramp(P, Math.max(0, Math.min(0.999, f))), 1); img.h[i] = 0.3 + (1 - c[0]) * 0.6; img.ro[i] = 0.9;
    });
    return img;
  };
  REC.dirt = () => TX.natural(PAL.dirt, { period: 4, oct: 3, speck: 0.07, speckDark: true, speck2: 0.03, seed: 53, rough: 0.95 });
  REC.coarse_dirt = () => { const img = REC.dirt(); const g = REC.gravel(); img.forEach((x, y, i) => { if (TX.fbm(x, y, 8, 2, 55) > 0.58) { img.set(x, y, TX.mix(g.get(x, y), C(0x6f5a48), 0.4)); img.h[i] = g.h[i]; } }); return img; };
  REC.rooted_dirt = () => { const img = REC.dirt(); for (let k = 0; k < 7; k++) { let x = hh(k, 1, 57) * N, y = 0; const col = C(0x9c7b54); for (let t = 0; t < 40; t++) { TX.dot(img, Math.floor(x), Math.floor(y), col, 0.8); y += 0.8; x += Math.sin(t * 0.5 + k) * 0.7; } } return img; };
  REC.mud = () => TX.natural(PAL.mud, { period: 3, oct: 3, seed: 59, rough: 0.35, speck: 0.03 });
  REC.packed_mud = () => { const img = TX.natural(PAL.packedmud, { period: 4, oct: 3, seed: 61, speck: 0.08, speckDark: true }); for (let k = 0; k < 18; k++) { const x = Math.floor(hh(k, 1, 62) * N), y = Math.floor(hh(k, 2, 62) * N); for (let t = 0; t < 4; t++) TX.dot(img, x + t, y + (t >> 1), C(0xc9a26a), 0.6); } return img; };
  REC.mud_bricks = () => TX.bricks(PAL.packedmud, 0x5a4232, { rows: 4, per: 2, seed: 63, speck: 0.05 });
  REC.clay = () => TX.natural(PAL.clay, { period: 3, oct: 2, seed: 65, contrast: 0.9, speck: 0.04, speckDark: true });
  REC.sand = () => TX.natural(PAL.sand, { period: 6, oct: 2, speck: 0.15, speck2: 0.05, seed: 67, contrast: 1.0, rough: 0.95 });
  REC.red_sand = () => TX.natural(PAL.redsand, { period: 6, oct: 2, speck: 0.15, speck2: 0.05, seed: 69, contrast: 1.0 });
  REC.buried_sand = () => { const img = REC.sand(); TX.cracks(img, 3, 71, C(0x9c8a5c)); for (const [x, y] of [[12, 14], [13, 14], [18, 19]]) TX.dot(img, x, y, C(0xd8b84a)); return img; };
  REC.buried_gravel = () => { const img = REC.gravel(); TX.cracks(img, 3, 73, C(0x4a4642)); return img; };
  REC.gloom_sand = () => { const img = TX.natural(PAL.gloomsand, { period: 5, oct: 3, seed: 75, contrast: 1.4 }); for (let k = 0; k < 4; k++) { const cx = 4 + hh(k, 1, 76) * 24, cy = 4 + hh(k, 2, 76) * 24; TX.disc(img, cx, cy, 2.6, (d) => TX.scale(C(0x2a1d14), 0.7 + d * 0.3)); for (let t = 0; t < 3; t++) img.H(Math.floor(cx) + t - 1, Math.floor(cy), 0.1); } return img; };
  REC.gloom_soil = () => TX.natural(PAL.gloomsoil, { period: 4, oct: 3, seed: 77, speck: 0.06 });
  REC.snow = () => { const img = TX.natural(PAL.snow, { period: 4, oct: 2, contrast: 0.7, seed: 79, speck: 0.03, rough: 0.6 }); img.forEach((x, y, i) => { if (hh(x, y, 80) < 0.015) img.em[i] = 0.25; }); return img; };
  REC.powder_snow = () => { const img = TX.natural([0xd3e2f0, 0xe5eef8, 0xf5f9fe], { period: 8, oct: 2, contrast: 0.9, seed: 81, rough: 0.9 }); img.forEach((x, y, i) => img.alpha(x, y, 0.92)); return img; };
  REC.ice = () => { const img = TX.natural([0x6e97d6, 0x88acdf, 0xa5c2ea], { period: 3, oct: 2, contrast: 0.8, seed: 83, rough: 0.08 }); TX.cracks(img, 4, 84, C(0xd8e8ff)); img.forEach((x, y, i) => img.alpha(x, y, 0.62)); TX.bevel(img, 0, 0, N - 1, N - 1, 0.1, 0.1); return img; };
  REC.packed_ice = () => { const img = TX.natural([0x7ea3de, 0x98b8e8, 0xb2cbf0], { period: 3, oct: 2, contrast: 1.0, seed: 85, rough: 0.12 }); TX.cracks(img, 6, 86, C(0xe2eeff)); return img; };
  REC.blue_ice = () => { const img = TX.natural([0x4a7fd6, 0x6495e2, 0x7eabee], { period: 3, oct: 2, contrast: 1.0, seed: 87, rough: 0.05 }); TX.cracks(img, 5, 88, C(0xbcd8ff)); return img; };
  REC.magma = () => {
    const img = new TX.Img(), P = TX.pal([0x2c0d07, 0x4a1409, 0x681e0c], 4), G = TX.pal([0xb0300a, 0xff6a1a, 0xffc04a], 4);
    img.forEach((x, y, i) => {
      const c = TX.cells(x, y, 5, 91); const crack = c[1] - c[0];
      if (crack < 0.18) { const t = 1 - crack / 0.18; img.set(x, y, TX.ramp(G, t * 0.99), 1); img.em[i] = 0.4 + t * 0.6; img.h[i] = 0.2; }
      else { img.set(x, y, TX.ramp(P, Math.min(0.999, TX.fbm(x, y, 8, 2, 92))), 1); img.h[i] = 0.7; }
      img.ro[i] = 0.7;
    });
    return img;
  };
  REC.bone_block_side = () => { const img = TX.natural(PAL.bone, { period: 2, oct: 2, contrast: 0.6, seed: 93, stretchY: 0.2 }); for (let x = 0; x < N; x += 8) for (let y = 0; y < N; y++) img.mul(x, y, 0.85); return img; };
  REC.bone_block_top = () => { const img = REC.bone_block_side(); for (const [cx, cy] of [[8, 8], [24, 8], [8, 24], [24, 24]]) TX.disc(img, cx, cy, 3, (d) => TX.scale(C(0xa8a08a), 0.8 + d * 0.2)); return img; };

  // ---------------- surface stones ----------------
  const sandstoneSide = (pal, s) => { const img = TX.natural(pal, { period: 4, oct: 3, bands: 1.2, bandWarp: 2, seed: s, contrast: 1.0 }); for (let x = 0; x < N; x++) { img.mul(x, 0, 1.12); img.mul(x, N - 1, 0.78); } return img; };
  REC.sandstone = () => sandstoneSide(PAL.sandstone, 101);
  REC.sandstone_top = () => TX.natural(PAL.sandstone, { period: 4, oct: 2, contrast: 0.7, seed: 102, bias: 0.1 });
  REC.sandstone_bottom = () => TX.natural(PAL.sandstone, { period: 4, oct: 3, contrast: 1.1, seed: 103, speck: 0.05 });
  REC.chiseled_sandstone = () => TX.chiseled(REC.sandstone_top(), 'sun');
  REC.cut_sandstone = () => { const img = REC.sandstone_top(); for (let x = 0; x < N; x++) { img.mul(x, 10, 0.8); img.mul(x, 21, 0.8); } TX.bevel(img, 0, 0, N - 1, N - 1, 0.1, 0.2); return img; };
  REC.red_sandstone = () => sandstoneSide(PAL.redsandstone, 104);
  REC.red_sandstone_top = () => TX.natural(PAL.redsandstone, { period: 4, oct: 2, contrast: 0.7, seed: 105, bias: 0.1 });
  REC.red_sandstone_bottom = () => TX.natural(PAL.redsandstone, { period: 4, oct: 3, contrast: 1.1, seed: 106, speck: 0.05 });
  REC.chiseled_red_sandstone = () => TX.chiseled(REC.red_sandstone_top(), 'rune');
  REC.cut_red_sandstone = () => { const img = REC.red_sandstone_top(); for (let x = 0; x < N; x++) { img.mul(x, 10, 0.8); img.mul(x, 21, 0.8); } TX.bevel(img, 0, 0, N - 1, N - 1, 0.1, 0.2); return img; };
  REC.bricks = () => TX.bricks([0x6e2e22, 0x8f3e2d, 0xa9523b, 0xbf6a4f], 0xa9a097, { rows: 4, per: 2, seed: 107 });
  REC.resin_bricks = () => TX.bricks([0x9a3f0a, 0xc45a12, 0xe07a1e, 0xf09a3a], 0x5a2a0a, { rows: 4, per: 2, seed: 108, rough: 0.4 });
  REC.chiseled_resin_bricks = () => TX.chiseled(TX.polished([0xb04c0e, 0xd8701a, 0xf0923a], { seed: 109 }), 'ring');
  REC.resin_block = () => { const img = TX.natural([0xa84a0c, 0xd26a16, 0xf08a2a, 0xffb24a], { period: 3, oct: 2, seed: 110, rough: 0.2 }); img.forEach((x, y, i) => { img.em[i] = 0.08; }); return img; };
  for (const m of ['cinnabar', 'sulfur']) {
    const pal = PAL[m], s = m === 'cinnabar' ? 111 : 121, mort = m === 'cinnabar' ? 0x3f0d0c : 0x5a4f10;
    REC[m] = () => TX.natural(pal, { period: 4, oct: 3, speck: 0.07, speck2: 0.04, seed: s, contrast: 1.4, cells: m === 'sulfur' ? 6 : 0, rough: m === 'sulfur' ? 0.6 : 0.75 });
    REC['polished_' + m] = () => TX.polished(pal, { seed: s + 1 });
    REC['chiseled_' + m] = () => TX.chiseled(TX.polished(pal, { seed: s + 2 }), m === 'cinnabar' ? 'diamond' : 'sun');
    REC[m + '_bricks'] = () => TX.bricks(pal, mort, { rows: 4, per: 2, seed: s + 3 });
  }
  REC.fuming_sulfur = () => { const img = REC.sulfur(); img.forEach((x, y, i) => { const f = TX.fbm(x, y, 4, 2, 131); if (f > 0.6) { img.set(x, y, TX.mix(C(0x9adf3a), C(0xe6ff8a), (f - 0.6) * 2.5)); img.em[i] = (f - 0.6) * 0.8; } }); return img; };
  REC.tidestone = () => { const img = TX.natural(PAL.tide, { period: 4, oct: 3, seed: 141, cells: 4, cellEdge: 0.07, contrast: 1.3, rough: 0.4 }); return img; };
  REC.tidestone_bricks = () => TX.bricks(PAL.tide, 0x1c3f3a, { rows: 4, per: 2, seed: 142, offset: false, rough: 0.4 });
  REC.abyssal_tidestone = () => { const img = TX.tiles(PAL.abyss, 0x0d1f1c, 4, { seed: 143, rough: 0.35 }); for (let k = 0; k < 16; k++) TX.dot(img, 4 + (k % 4) * 8, 4 + (k >> 2) * 8, C(0x5ac8b0)); return img; };
  REC.tide_lantern = () => { const img = new TX.Img(); const P = TX.pal([0x8ad8d0, 0xc8f4ee, 0xf2fffd], 4); img.forEach((x, y, i) => { const c = TX.cells(x, y, 3, 145); const f = 1 - c[0] * 0.6; img.set(x, y, TX.ramp(P, Math.min(0.999, f)), 1); img.em[i] = 0.55 + f * 0.45; img.ro[i] = 0.1; img.h[i] = f; }); TX.bevel(img, 0, 0, N - 1, N - 1, 0.25, 0.3); return img; };
  // ---------------- underforge / hollow ----------------
  REC.emberrock = () => TX.natural(PAL.ember, { period: 5, oct: 3, speck: 0.12, speck2: 0.06, seed: 151, contrast: 1.6, cells: 6, cellEdge: 0.04 });
  REC.ember_bricks = () => TX.bricks(PAL.ember.map(v => v), 0x14060a, { rows: 4, per: 2, seed: 152 });
  REC.cracked_ember_bricks = () => TX.bricks(PAL.ember, 0x14060a, { rows: 4, per: 2, seed: 152, cracks: 6 });
  REC.chiseled_ember_bricks = () => TX.chiseled(TX.bricks(PAL.ember, 0x14060a, { rows: 2, per: 1, seed: 153 }), 'face');
  REC.red_ember_bricks = () => TX.bricks([0x480a0c, 0x6c1214, 0x8e1c1c, 0xa82a26], 0x1a0404, { rows: 4, per: 2, seed: 154 });
  REC.scoria = () => TX.natural(PAL.scoria, { period: 4, oct: 3, speck: 0.08, seed: 155, contrast: 1.6 });
  REC.scoria_top = () => TX.natural(PAL.scoria, { period: 4, oct: 3, seed: 156, cells: 5, cellEdge: 0.05 });
  REC.polished_scoria = () => TX.polished(PAL.scoria, { seed: 157 });
  REC.chiseled_polished_scoria = () => TX.chiseled(REC.polished_scoria(), 'face');
  REC.polished_scoria_bricks = () => TX.bricks(PAL.scoria, 0x0d0b0e, { rows: 4, per: 2, seed: 158 });
  REC.cracked_polished_scoria_bricks = () => TX.bricks(PAL.scoria, 0x0d0b0e, { rows: 4, per: 2, seed: 158, cracks: 6 });
  REC.gilded_scoria = () => { const img = REC.scoria(); img.forEach((x, y, i) => { const f = TX.fbm(x, y, 4, 3, 159); if (f > 0.63) { img.set(x, y, TX.mix(C(0xc98a14), C(0xffe06a), (f - 0.63) * 3)); img.ro[i] = 0.25; img.h[i] = 0.8; } }); return img; };
  REC.basalt = () => TX.natural(PAL.basalt, { period: 4, oct: 3, stretchY: 0.15, seed: 161, contrast: 1.4 });
  REC.basalt_top = () => { const img = TX.natural(PAL.basalt, { period: 4, oct: 2, seed: 162 }); TX.bevel(img, 1, 1, N - 2, N - 2, 0.1, 0.1); return img; };
  REC.polished_basalt = () => { const img = TX.natural(PAL.basalt, { period: 2, oct: 2, stretchY: 0.1, seed: 163, contrast: 0.9 }); for (let x = 0; x < N; x += 8) for (let y = 0; y < N; y++) img.mul(x, y, 0.8); return img; };
  REC.polished_basalt_top = () => { const img = TX.polished(PAL.basalt, { seed: 164 }); TX.disc(img, 15.5, 15.5, 6, (d) => TX.ramp(TX.pal(PAL.basalt, 4), 0.3 + d * 0.5)); return img; };
  REC.smooth_basalt = () => TX.natural(PAL.basalt, { period: 3, oct: 2, seed: 165, contrast: 0.8, rough: 0.6 });
  REC.voidstone = () => { const img = TX.natural(PAL.voidstone, { period: 4, oct: 3, seed: 171, contrast: 1.2 }); for (let k = 0; k < 10; k++) TX.disc(img, hh(k, 1, 172) * 32, hh(k, 2, 172) * 32, 1.5, (d) => TX.scale(C(0xa9a57c), 0.8 + d * 0.2)); return img; };
  REC.voidstone_bricks = () => TX.bricks(PAL.voidstone, 0x6e6a4c, { rows: 4, per: 2, seed: 173 });
  REC.lilacite_block = () => TX.tiles(PAL.lilac, 0x5a3a63, 2, { seed: 175, mortarW: 1 });
  REC.lilacite_pillar = () => { const img = TX.natural(PAL.lilac, { period: 2, oct: 2, stretchY: 0.1, seed: 176, contrast: 0.8 }); for (let x = 0; x < N; x += 6) for (let y = 0; y < N; y++) img.mul(x, y, 0.8); return img; };
  REC.lilacite_pillar_top = () => { const img = TX.polished(PAL.lilac, { seed: 177, inner: true }); return img; };
  REC.starborn_egg = () => { const img = TX.natural([0x0c0612, 0x1a0c26, 0x2c1640], { period: 4, oct: 3, seed: 179, rough: 0.2 }); img.forEach((x, y, i) => { if (hh(x, y, 180) < 0.06) { img.set(x, y, C(0x9a5cf0)); img.em[i] = 0.6; } }); return img; };
  // ---------------- quartz ----------------
  REC.quartz_block = () => { const img = TX.natural(PAL.quartz, { period: 3, oct: 2, seed: 181, contrast: 0.6, rough: 0.35 }); TX.bevel(img, 0, 0, N - 1, N - 1, 0.08, 0.12); return img; };
  REC.quartz_block_top = () => REC.quartz_block();
  REC.quartz_block_bottom = () => TX.polished(PAL.quartz, { seed: 182, border: 0 });
  REC.quartz_bricks = () => TX.bricks(PAL.quartz, 0xb8b0a4, { rows: 4, per: 2, seed: 183, rough: 0.35 });
  REC.chiseled_quartz_block = () => TX.chiseled(REC.quartz_block(), 'bars', { dark: 0.8 });
  REC.chiseled_quartz_block_top = () => TX.chiseled(REC.quartz_block(), 'ring', { dark: 0.8 });
  REC.quartz_pillar = () => { const img = TX.natural(PAL.quartz, { period: 2, oct: 2, stretchY: 0.1, seed: 184, contrast: 0.6, rough: 0.35 }); for (const x of [0, 1, 30, 31]) for (let y = 0; y < N; y++) img.mul(x, y, 0.88); return img; };
  REC.quartz_pillar_top = () => TX.polished(PAL.quartz, { seed: 185, inner: true });
  REC.reinforced_deepstone = () => { const img = TX.bricks(PAL.deep, 0x101014, { rows: 2, per: 2, seed: 186 }); for (let y = 0; y < N; y++) for (const x of [0, 1, 30, 31]) img.set(x, y, C(0x7a7a70)); for (let x = 0; x < N; x++) for (const y of [0, 31]) img.set(x, y, C(0x8a8a80)); return img; };
  REC.reinforced_deepstone_top = () => { const img = REC.polished_deepstone(); TX.chiseled(img, 'ring'); for (let y = 0; y < N; y++) for (const x of [0, 31]) img.set(x, y, C(0x7a7a70)); return img; };
  REC.relic_ore = () => { const img = TX.natural([0x2a1d1a, 0x3d2a24, 0x52392f, 0x6a4a3c], { period: 3, oct: 3, stretchY: 0.25, seed: 187, contrast: 1.5 }); img.forEach((x, y, i) => { if (Math.abs(Math.sin(x * 0.9 + TX.fbm(x, y, 4, 2, 188) * 5)) < 0.12) img.set(x, y, C(0x8a6a4a)); }); return img; };
  REC.relic_ore_top = () => { const img = REC.relic_ore(); TX.disc(img, 15.5, 15.5, 7, (d) => TX.scale(C(0x5a4034), 0.7 + d * 0.4)); return img; };

  // ---------------- wood ----------------
  PRE.planks = (w) => { const P = WOOD[w]; const img = TX.planks(P.planks, { seed: 200 + w.length * 7, nails: w === 'bamboo' ? false : true }); if (w === 'bamboo') { for (let y = 0; y < N; y++) for (let x = 0; x < N; x += 8) img.mul(x, y, 0.8); } if (P.glow) img.forEach((x, y, i) => { if (hh(x, y, 9) < 0.01) { img.set(x, y, C(P.glow)); img.em[i] = 0.6; } }); return img; };
  PRE.log = (w) => { const P = WOOD[w]; const img = TX.bark(P.bark, { seed: 300 + w.length * 11, marks: P.marks ? 0.12 : 0 }); if (P.marks) img.forEach((x, y) => { if (hh(Math.floor(x / 4), Math.floor(y / 2), 311 + w.length) < 0.18) img.set(x, y, C(P.marks)); }); if (P.glow) img.forEach((x, y, i) => { if (TX.fbm(x, y, 8, 2, 317) > 0.7) { img.set(x, y, TX.mix(C(P.glow), [1, 1, 1], 0.2)); img.em[i] = 0.7; } }); return img; };
  PRE.log_top = (w) => { const P = WOOD[w]; return TX.logTop(P.ring, P.bark, { seed: 400 + w.length * 13 }); };
  PRE.stripped_log = (w) => { const P = WOOD[w]; return TX.bark(P.stripped, { seed: 500 + w.length * 17 }); };
  PRE.stripped_log_top = (w) => { const P = WOOD[w]; return TX.logTop(P.ring, P.stripped, { seed: 600 + w.length * 19 }); };
  PRE.door_bottom = (w) => { const P = WOOD[w] || WOOD.oak; const img = TX.planks(P.planks, { boards: 8, seed: 700 + w.length }); TX.bevel(img, 0, 0, N - 1, N - 1, 0.25, 0.35); TX.bevel(img, 4, 2, 27, 27, -0.15, -0.1); for (const [x, y] of [[25, 2], [26, 2], [25, 3], [26, 3]]) img.set(x, y, C(0x3a3a3a)); return img; };
  PRE.door_top = (w) => {
    const P = WOOD[w] || WOOD.oak; const img = TX.planks(P.planks, { boards: 8, seed: 701 + w.length }); TX.bevel(img, 0, 0, N - 1, N - 1, 0.25, 0.35);
    // window panes
    const glassy = w !== 'dark_oak' && w !== 'crimson';
    for (let y = 5; y < 26; y++) for (let x = 5; x < 27; x++) { if (x === 15 || x === 16 || y === 15 || y === 16) continue; if (glassy) { img.alpha(x, y, 0); } else img.mul(x, y, 0.75); }
    return img;
  };
  PRE.trapdoor = (w) => {
    const P = WOOD[w] || WOOD.oak; const img = TX.planks(P.planks, { boards: 4, seed: 710 + w.length }); TX.bevel(img, 0, 0, N - 1, N - 1, 0.25, 0.35);
    for (let y = 5; y < 27; y += 7) for (let x = 5; x < 27; x++) if (!(x % 7 === 5)) img.alpha(x, y + 1, 0), img.alpha(x, y + 2, 0);
    return img;
  };
  REC.bamboo_block = () => { const img = new TX.Img(), P = TX.pal([0x3e5a18, 0x5a7c26, 0x7a9c38, 0x9ab84e], 5); img.forEach((x, y, i) => { const stalk = Math.floor(x / 8), lx = x % 8; let f = 0.4 + Math.sin(lx / 8 * Math.PI) * 0.4 + (hh(stalk, 1, 7) - 0.5) * 0.2; if ((y + stalk * 9) % 16 === 0) f -= 0.35; if (lx === 0) f -= 0.3; img.set(x, y, TX.ramp(P, Math.max(0, Math.min(0.999, f))), 1); img.h[i] = 0.3 + Math.sin(lx / 8 * Math.PI) * 0.6; img.ro[i] = 0.5; }); return img; };
  REC.bamboo_block_top = () => { const img = new TX.Img(); img.forEach((x, y, i) => { const cx = (x % 8) - 3.5, cy = (y % 8) - 3.5; const d = Math.hypot(cx, cy); img.set(x, y, d < 2.5 ? C(0xd8c878) : d < 3.6 ? C(0x6a8a2c) : C(0x3a5418), 1); img.h[i] = d < 3.6 ? 0.7 : 0.2; }); return img; };
  REC.stripped_bamboo_block = () => { const img = REC.bamboo_block(); const P = TX.pal([0x9c8a30, 0xbca640, 0xd6c25a], 4); img.forEach((x, y) => img.set(x, y, TX.ramp(P, Math.min(0.999, TX.lum(img.get(x, y)) * 1.6)))); return img; };
  REC.stripped_bamboo_block_top = () => REC.bamboo_block_top();
  REC.bamboo_mosaic = () => { const img = TX.planks(WOOD.bamboo.planks, { boards: 4, seed: 720, seams: false }); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { if ((x % 16 === 0) || (y % 8 === 0)) img.mul(x, y, 0.7); } return img; };

  // ---------------- leaves ----------------
  const GRAYLEAF = [0x333333, 0x5a5a5a, 0x858585, 0xb0b0b0, 0xd0d0d0];
  PRE.leaves = (k) => {
    const map = {
      oak: [GRAYLEAF, {}], jungle: [GRAYLEAF, { cells: 9 }], acacia: [GRAYLEAF, { cells: 6 }], dark_oak: [GRAYLEAF, { cells: 8, holes: 0.2 }], mangrove: [GRAYLEAF, { cells: 7 }],
      spruce: [GRAYLEAF, { cells: 10, holes: 0.25 }], birch: [GRAYLEAF, { cells: 6 }],
      cherry: [[0xb04a7a, 0xe07aa8, 0xf6a8c8, 0xffd0e4], { cells: 6, flowers: 0.04, flowerCol: 0xffffff }],
      pale_oak: [[0x5f665c, 0x7c8479, 0x9ba196, 0xb9beb2], { cells: 7 }],
      yellow_poplar: [[0x9a6a08, 0xcc9818, 0xe8c030, 0xf7e27a], { cells: 6 }],
      orange_poplar: [[0x983808, 0xc8561a, 0xe67a2c, 0xf6a24a], { cells: 6 }],
      red_poplar: [[0x6e1210, 0x9c231a, 0xc2372a, 0xde5a40], { cells: 6 }],
      azalea: [[0x3d5a1c, 0x587a28, 0x76983a, 0x92b24e], { cells: 7 }],
      flowering_azalea: [[0x3d5a1c, 0x587a28, 0x76983a, 0x92b24e], { cells: 7, flowers: 0.08, flowerCol: 0xd66ad8 }],
    };
    const m = map[k] || map.oak;
    return TX.leaves(m[0], Object.assign({ seed: 800 + k.length * 3 }, m[1]));
  };

  // ---------------- ores ----------------
  const MIN = {
    coal: [[0x111111, 0x2a2a2a, 0x3c3c3c], { size: 2.4, count: 7, rough: 0.6 }],
    copper: [[0x7a3a1c, 0xc2632e, 0xe89a5a, 0x7ec8a0], { size: 2.2, count: 6 }],
    iron: [[0x8a6a52, 0xc8a48a, 0xe8cbb4], { size: 2.2, count: 6 }],
    gold: [[0xa87a10, 0xf0c830, 0xfff08a], { size: 2.0, count: 6, rough: 0.2 }],
    lapis: [[0x1a2e8a, 0x2c50c8, 0x5a86ee], { size: 1.9, count: 8 }],
    voltite: [[0x6a0a08, 0xd01e10, 0xff5a3a], { size: 1.8, count: 8, glow: 0.35 }],
    diamond: [[0x1a8a8a, 0x4ae0dc, 0xb8fffa], { size: 2.0, count: 6, shape: 'crystal', rough: 0.08, glow: 0.12 }],
    emerald: [[0x0a6a2a, 0x1ac050, 0x7aff9a], { size: 2.2, count: 4, shape: 'crystal', rough: 0.1, glow: 0.1 }],
    quartz: [[0xc8c0b4, 0xf0eae0, 0xffffff], { size: 1.8, count: 8, shape: 'crystal' }],
  };
  PRE.ore = (m, host) => {
    const base = host === 'deepstone' ? REC.deepstone() : host === 'emberrock' ? REC.emberrock() : REC.stone();
    const mm = MIN[m];
    return TX.ore(base, mm[0], Object.assign({ seed: 900 + m.length * 5 + host.length }, mm[1]));
  };
  // storage blocks
  PRE.block = (m) => {
    switch (m) {
      case 'iron': return TX.metal([0x8e8e8e, 0xbcbcbc, 0xdcdcdc, 0xf4f4f4], { plates: true, rivets: true, rough: 0.35 });
      case 'gold': return TX.metal([0xa87a10, 0xe0b020, 0xf8d848, 0xfff2a0], { plates: true, rough: 0.18 });
      case 'duskite': return TX.metal([0x1e1a22, 0x322c38, 0x48404f, 0x5e5566], { plates: true, rivets: true, rough: 0.3, brushed: true });
      case 'diamond': return TX.gem([0x2aa8a8, 0x4ad8d4, 0x8af0ec, 0xd0fffc], { cells: 4 });
      case 'emerald': return TX.gem([0x0e7a34, 0x1aa84a, 0x3ad06a, 0x8af0a8], { cells: 3 });
      case 'amethyst': { const img = TX.gem([0x4a2a7a, 0x6a3fa8, 0x9a6ad8, 0xc8a8f8], { cells: 5, glow: 0.08 }); return img; }
      case 'lapis': { const img = TX.natural([0x1a2e7a, 0x2440a8, 0x3a5ad0, 0x6a8aee], { period: 4, oct: 3, seed: 950, speck: 0.05, speck2: 0.05 }); TX.bevel(img, 0, 0, N - 1, N - 1, 0.2, 0.25); return img; }
      case 'coal': { const img = TX.natural([0x0c0c0e, 0x18181c, 0x24242a, 0x33333a], { period: 4, oct: 3, seed: 951, cells: 5, cellEdge: 0.06, rough: 0.5 }); TX.bevel(img, 0, 0, N - 1, N - 1, 0.25, 0.25); return img; }
      case 'voltite': { const img = new TX.Img(); const P = TX.pal([0x5a0606, 0xa81410, 0xe8301e, 0xff7a5a], 5); img.forEach((x, y, i) => { const c = TX.cells(x, y, 4, 952); const f = 1 - c[0]; img.set(x, y, TX.ramp(P, Math.min(0.999, f)), 1); img.em[i] = 0.25 + f * 0.35; img.h[i] = f; img.ro[i] = 0.3; if (c[1] - c[0] < 0.08) img.mul(x, y, 0.5); }); TX.bevel(img, 0, 0, N - 1, N - 1, 0.25, 0.25); return img; }
    }
  };
  PRE.raw_block = (m) => {
    const pals = { copper: [0x7a3a1c, 0xa8542a, 0xd07a44, 0xe89a62], iron: [0x7a5a44, 0xa07c62, 0xc29e82, 0xd8b89c], gold: [0x9a6e10, 0xc8981e, 0xe8c040, 0xf8dc70] };
    const img = TX.natural(pals[m], { period: 4, oct: 3, seed: 960 + m.length, cells: 5, cellEdge: 0.07, contrast: 1.5, rough: 0.5 });
    return img;
  };
  // copper variants: copper:<variant>:<stage>
  const COPPER_PALS = [[0x8a3e22, 0xc0643a, 0xe08858, 0xf2aa7a], [0x8a5a3a, 0xa87a5a, 0x9a9a74, 0x8ab08a], [0x4a7a5a, 0x5a9a78, 0x6ab090, 0x88c8a8], [0x2e6a58, 0x3a8a70, 0x4aa888, 0x62c0a0]];
  VR.COPPER_PALS = COPPER_PALS;
  PRE.copper = (variant, stage) => {
    stage = +stage; const pal = COPPER_PALS[stage];
    const base = () => { const img = TX.metal(pal, { rough: 0.3 + stage * 0.15 }); if (stage > 0) img.forEach((x, y, i) => { const f = TX.fbm(x, y, 4, 3, 970 + stage); if (f > 0.7 - stage * 0.12) img.set(x, y, TX.ramp(TX.pal(COPPER_PALS[Math.min(3, stage + 1)], 4), Math.min(0.999, f))); }); return img; };
    switch (variant) {
      case 'block': return base();
      case 'cut': { const img = base(); for (let i = 0; i < N; i++) { img.mul(i, 15, 0.7); img.mul(i, 16, 1.15); img.mul(15, i, 0.7); img.mul(16, i, 1.15); } return img; }
      case 'chiseled': return TX.chiseled(base(), 'ring', { dark: 0.7 });
      case 'grate': { const img = base(); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const gx = x % 8, gy = y % 8; if (gx >= 2 && gx <= 5 && gy >= 2 && gy <= 5) img.alpha(x, y, 0); } return img; }
      case 'bulb': case 'bulb_on': { const on = variant === 'bulb_on'; const img = base(); for (let y = 6; y < 26; y++) for (let x = 6; x < 26; x++) { const d = Math.hypot(x - 15.5, y - 15.5); if (d < 9) { const g = on ? TX.mix(C(0xfff0c0), C(0xffb040), d / 9) : TX.mix(C(0x6a5a44), C(0x3a3028), d / 9); img.set(x, y, g); if (on) img.em[y * N + x] = [1, 0.8, 0.55, 0.3][stage] * (1 - d / 12); } } return img; }
      case 'bars': { const img = TX.sprite(); const P = TX.pal(pal, 4); for (let y = 0; y < N; y++) for (const x of [2, 3, 12, 13, 18, 19, 28, 29]) TX.dot(img, x, y, TX.ramp(P, x % 2 ? 0.7 : 0.4), 0.8); for (let x = 0; x < N; x++) for (const y of [2, 3, 28, 29]) TX.dot(img, x, y, TX.ramp(P, 0.6), 0.8); return img; }
      case 'chain': { const img = TX.sprite(); const P = TX.pal(pal, 4); for (let y = 0; y < N; y++) { const link = Math.floor(y / 6) % 2; if (link) { TX.dot(img, 2, y, TX.ramp(P, 0.8)); TX.dot(img, 3, y, TX.ramp(P, 0.5)); } else { TX.dot(img, 7, y, TX.ramp(P, 0.8)); TX.dot(img, 8, y, TX.ramp(P, 0.5)); } if (y % 6 === 0) for (let x = 1; x < 11; x++) TX.dot(img, x, y, TX.ramp(P, 0.6)); } return img; }
      case 'lantern': return lanternTex(COPPER_PALS[stage], [0x9aff6a, 0x5ae05a, 0x2a9a3a]);
      case 'chest_side': case 'chest_top': case 'chest_front': { const img = base(); TX.bevel(img, 0, 0, N - 1, N - 1, 0.25, 0.3); if (variant !== 'chest_top') for (let x = 0; x < N; x++) img.mul(x, 10, 0.55); if (variant === 'chest_front') for (let y = 8; y < 16; y++) for (let x = 13; x < 19; x++) img.set(x, y, C(0xd8d8d0)); return img; }
      case 'door_top': case 'door_bottom': { const img = base(); TX.bevel(img, 0, 0, N - 1, N - 1, 0.25, 0.35); TX.bevel(img, 4, 4, 27, 27, -0.12, -0.1); if (variant === 'door_top') for (let y = 6; y < 26; y++) for (let x = 6; x < 26; x++) if ((x + y) % 6 < 2) img.alpha(x, y, 0); return img; }
      case 'trapdoor': { const img = base(); TX.bevel(img, 0, 0, N - 1, N - 1, 0.25, 0.35); for (let y = 6; y < 26; y++) for (let x = 6; x < 26; x++) if (x % 6 < 2 && y % 6 < 2) img.alpha(x, y, 0); return img; }
      case 'rod': { const img = TX.sprite(); const P = TX.pal(pal, 4); for (let y = 0; y < 30; y++) for (let x = 0; x < 4; x++) TX.dot(img, x, y, TX.ramp(P, 0.3 + x * 0.2)); for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) TX.dot(img, x, y, TX.ramp(P, 0.5)); return img; }
    }
    return base();
  };
  function lanternTex(metalPal, flamePal) {
    const img = TX.sprite();
    const M = TX.pal(metalPal, 4), Fl = TX.pal(flamePal, 3);
    // body side region (0..12, 4..18) in 32px == uv [0,2,6,9]*2
    for (let y = 4; y < 18; y++) for (let x = 0; x < 12; x++) {
      const frame = x < 2 || x > 9 || y < 6 || y > 15;
      if (frame) TX.dot(img, x, y, TX.ramp(M, (x + y) % 3 / 3 + 0.2)); else { TX.dot(img, x, y, TX.ramp(Fl, Math.min(0.999, 1 - Math.hypot(x - 6, y - 11) / 7))); img.em[y * N + x] = 0.9; }
    }
    // body top/bottom (0..12, 18..30)
    for (let y = 18; y < 30; y++) for (let x = 0; x < 12; x++) TX.dot(img, x, y, TX.ramp(M, 0.35 + ((x ^ y) & 1) * 0.2));
    // cap (2..10, 0..4) and cap top (2..10, 20..28 reuses)
    for (let y = 0; y < 4; y++) for (let x = 2; x < 10; x++) TX.dot(img, x, y, TX.ramp(M, 0.6));
    // chain (22..28, 2..14)
    for (let y = 2; y < 14; y++) { TX.dot(img, 23, y, TX.ramp(M, 0.7)); TX.dot(img, 24, y, TX.ramp(M, 0.4)); if (y % 4 === 0) { TX.dot(img, 22, y, TX.ramp(M, 0.5)); TX.dot(img, 25, y, TX.ramp(M, 0.5)); } }
    // handle (22..28, 20..24)
    for (let x = 22; x < 28; x++) TX.dot(img, x, 21, TX.ramp(M, 0.6));
    return img;
  }
  VR.lanternTex = lanternTex;
  REC.lantern = () => lanternTex([0x2a2a30, 0x44444c, 0x62626c, 0x80808a], [0xfff2b0, 0xffb04a, 0xe0601a]);
  REC.spirit_lantern = () => lanternTex([0x2a2a30, 0x44444c, 0x62626c, 0x80808a], [0xd8ffff, 0x5ae0f0, 0x1a8ab0]);

  // ---------------- colors ----------------
  const CH = (c) => VR.COLOR_HEX[c];
  PRE.wool = (c) => TX.wool(CH(c), { seed: 1000 + c.length });
  PRE.concrete = (c) => TX.flat(CH(c), { seed: 1100 + c.length, noise: 0.06, rough: 0.7 });
  PRE.concrete_powder = (c) => { const img = TX.flat(CH(c), { seed: 1200 + c.length, noise: 0.1, grain: 0.22, rough: 0.95 }); return img; };
  PRE.terracotta = (c) => { const base = TX.mix(C(CH(c)), C(0x9a644c), 0.45); const img = TX.flat(TX.scale(base, 0.92), { seed: 1300 + c.length, noise: 0.12, grain: 0.06, rough: 0.9 }); return img; };
  REC.terracotta = () => TX.natural(PAL.terracotta, { period: 4, oct: 2, seed: 1301, contrast: 0.7 });
  PRE.glazed = (c) => {
    const img = new TX.Img(), base = C(CH(c)), dark = TX.scale(base, 0.5), light = TX.mix(base, [1, 1, 1], 0.55), accent = TX.mix(base, C(0xf2d060), 0.4);
    const s = 1400 + VR.COLORS.indexOf(c) * 7;
    const style = VR.COLORS.indexOf(c) % 4;
    img.forEach((x, y, i) => {
      const u = x - 15.5, v = y - 15.5, a = Math.atan2(v, u), d = Math.hypot(u, v);
      let col = base;
      if (style === 0) { const w = Math.sin(a * 3 + d * 0.35); col = w > 0.4 ? light : w < -0.5 ? dark : base; if (d < 4) col = accent; }
      else if (style === 1) { const k = (Math.abs(u) + Math.abs(v)); col = (Math.floor(k / 4) % 2) ? light : base; if (Math.abs(u - v) < 1.5 || Math.abs(u + v) < 1.5) col = dark; }
      else if (style === 2) { const q = ((x >> 3) + (y >> 3)) % 2; col = q ? base : light; if (Math.hypot((x % 16) - 7.5, (y % 16) - 7.5) < 3.5) col = accent; if (x % 8 === 0 || y % 8 === 0) col = dark; }
      else { const sp = Math.sin(d * 0.9 - a * 2); col = sp > 0.3 ? light : sp < -0.6 ? dark : base; if (x < 2 || y < 2) col = dark; }
      img.set(x, y, TX.scale(col, 0.95 + hh(x, y, s) * 0.08), 1); img.h[i] = 0.6; img.ro[i] = 0.2;
    });
    TX.bevel(img, 0, 0, N - 1, N - 1, 0.1, 0.1);
    return img;
  };
  PRE.stained_glass = (c) => { const img = TX.glass(TX.scale(C(CH(c)), 0.75), TX.mix(C(CH(c)), [1, 1, 1], 0.15), { alpha: 0.42, frameA: 0.95, streakA: 0.6 }); return img; };
  PRE.stained_glass_pane_top = (c) => { const img = new TX.Img(); img.forEach((x, y) => img.set(x, y, TX.scale(C(CH(c)), 0.75), 0.9)); return img; };
  REC.glass = () => TX.glass(0xd8e8ec, 0xffffff, { alpha: 0, streakA: 1 });
  REC.glass_pane_top = () => { const img = new TX.Img(); img.forEach((x, y) => img.set(x, y, C(0xd8e8ec), 1)); return img; };
  REC.tinted_glass = () => TX.glass(0x2a2030, 0x3a2e44, { alpha: 0.7, frameA: 1, streakA: 0.85 });
  REC.hardened_glass = () => { const img = TX.glass(0xb8c8d0, 0xffffff, { alpha: 0, double: true, streakA: 1 }); for (let k = 3; k < N - 3; k += 7) for (let t = 3; t < N - 3; t++) { img.set(k, t, C(0xc8d8e0), 1); } return img; };
  PRE.candle = (c) => {
    const img = TX.sprite(); const base = c === 'plain' ? C(0xe8dcc0) : C(CH(c));
    // body strips x 0..8 (4 faces 2px wide each in 16-space → 4px in 32) rows 12..32
    for (let y = 8; y < 32; y++) for (let x = 0; x < 16; x++) TX.dot(img, x, y, TX.scale(base, 0.8 + ((x >> 2) % 2) * 0.12 + (y < 12 ? 0.15 : 0)));
    for (let y = 12; y < 16; y++) for (let x = 0; x < 4; x++) TX.dot(img, x, y, TX.scale(base, 1.1));
    // wick (lit & unlit) at x 26..30
    for (let y = 0; y < 4; y++) { TX.dot(img, 26, y, C(0xfff0a0)); TX.dot(img, 27, y, C(0xffb040)); img.em[y * N + 26] = 1; img.em[y * N + 27] = 1; TX.dot(img, 28, y, C(0x2a2a2a)); TX.dot(img, 29, y, C(0x2a2a2a)); }
    return img;
  };
  PRE.bed_side = (c) => { const img = TX.planks(WOOD.oak.planks, { boards: 2, seed: 1500 }); for (let y = 0; y < 12; y++) for (let x = 0; x < N; x++) img.set(x, y, TX.scale(C(CH(c)), 0.85 + ((x + y) % 4 === 0 ? 0.1 : 0))); return img; };
  PRE.bed_foot = (c) => { const img = TX.wool(CH(c), { seed: 1501 }); return img; };
  PRE.bed_head = (c) => { const img = TX.wool(CH(c), { seed: 1502 }); for (let y = 3; y < 13; y++) for (let x = 3; x < 29; x++) img.set(x, y, TX.mix(C(0xf4f4ee), C(CH(c)), 0.05 + hh(x, y, 3) * 0.05)); TX.bevel(img, 3, 3, 28, 12, 0.08, -0.1); return img; };
  REC.straw_bed_top = () => { const img = TX.natural(PAL.hay, { period: 8, oct: 2, stretchY: 3, seed: 1503 }); return img; };
  PRE.crate_side = (c) => { const base = c === 'plain' ? C(0x8a6a9a) : C(CH(c)); const img = TX.metal([TX.scale(base, 0.55), TX.scale(base, 0.8), base, TX.mix(base, [1, 1, 1], 0.25)], { rough: 0.5 }); for (let x = 0; x < N; x++) { img.mul(x, 11, 0.6); img.mul(x, 12, 1.2); } return img; };
  PRE.crate_top = (c) => { const img = PRE.crate_side(c); TX.bevel(img, 6, 6, 25, 25, 0.15, 0.1); return img; };
  PRE.crate_bottom = (c) => PRE.crate_side(c);
})(VR);

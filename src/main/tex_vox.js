// ============================================================================
// Textures for the Voxel Architecture kit: one bevelled "voxel tile" that the
// mesher repeats once per mini-voxel (colour comes from the vertex tint), a
// glossy variant, translucent pane glass, and flat colour swatches used for
// particles, the minimap and item fallbacks.
// ============================================================================
(function (VR) {
  'use strict';
  const TX = VR.TX, N = TX.N, REC = VR.TEXREC, PRE = VR.TEXPRE;
  function tile(rough, base) {
    const img = new TX.Img();
    img.forEach((x, y, i) => {
      const e = Math.min(x, y, N - 1 - x, N - 1 - y);
      // soft pillow bevel: bright face, darker rim, highlight on the upper-left edge
      let k = base;
      if (e === 0) k *= 0.9; else if (e === 1) k *= 0.975;
      if ((x === 1 || y === 1) && e === 1) k = base * 1.02;
      img.set(x, y, [k, k, k], 1);
      img.h[i] = e >= 2 ? 0.56 : 0.46 + e * 0.05;
      img.ro[i] = rough;
    });
    return img;
  }
  REC.vx_tile = () => tile(0.86, 0.97);
  REC.vx_tile_gloss = () => tile(0.28, 0.98);
  // smooth surfaces for the fine VX32 models (lacquer, enamel, plastics): no bevel grid, a whisper of grain
  function smooth(rough) {
    const img = new TX.Img();
    img.forEach((x, y, i) => { const k = 0.985 + (TX.fbm(x, y, 4, 2, 811) - 0.5) * 0.02; img.set(x, y, [k, k, k], 1); img.h[i] = 0.5; img.ro[i] = rough; });
    img.noBevel = true;
    return img;
  }
  REC.vx_smooth = () => smooth(0.8);
  REC.vx_smooth_gloss = () => smooth(0.22);
  // holo voxels: smooth and bright (the terrain shader adds scanlines and flicker)
  REC.vx_holo = () => { const img = tile(0.9, 1.0); img.forEach((x, y, i) => { const e = Math.min(x, y, N - 1 - x, N - 1 - y); img.set(x, y, e === 0 ? [0.8, 0.8, 0.8] : [1, 1, 1], 1); }); return img; };
  REC.vx_glass = () => {
    const img = new TX.Img();
    img.forEach((x, y, i) => {
      const streak = ((x + y) % 11 === 0) || ((x + y) % 11 === 1 && x > 4);
      img.set(x, y, [1, 1, 1], streak ? 0.42 : 0.24);
      img.ro[i] = 0.06;
    });
    return img;
  };
  // ---- VX32 model materials: greyscale surface tiles the vertex tint colours, one repeat per quarter block.
  // Every tile is seamless (noBevel) and brings its own relief (height → normal map) and roughness.
  const TAU = Math.PI * 2;
  const seamless = (img) => { img.noBevel = true; return img; };
  // upholstery: a plain weave of 2-px threads (over/under alternating every thread), softened by a cloth-scale mottle
  REC.vx_mat_fabric = () => {
    const img = new TX.Img();
    img.forEach((x, y, i) => {
      const tx = x >> 1, ty = y >> 1, over = ((tx + ty) & 1) === 0;                 // which thread lies on top here
      const along = over ? (y & 1) : (x & 1);                                       // across the top thread: edge / crown
      const bump = along ? 0.6 : 0.52;
      const mottle = (TX.fbm(x, y, 4, 2, 71) - 0.5) * 0.07;
      const k = 0.94 + (over ? 0.035 : -0.025) + (along ? 0.012 : -0.012) + mottle;
      img.set(x, y, [k, k, k], 1);
      img.h[i] = bump + mottle * 0.5;
      img.ro[i] = 0.96;
    });
    return seamless(img);
  };
  // leather: pebbled grain from worley cells, raised pebbles with grooves between, a soft sheen
  REC.vx_mat_leather = () => {
    const img = new TX.Img();
    img.forEach((x, y, i) => {
      const [d1, d2, id] = TX.cells(x, y, 7, 101);
      const groove = Math.max(0, 1 - (d2 - d1) * 4);                                // 1 at the cell borders
      const pebble = 0.9 + TX.hash(id, 3, 101) * 0.08;
      const fine = (TX.fbm(x, y, 16, 1, 103) - 0.5) * 0.04;
      const k = pebble - groove * 0.09 + fine;
      img.set(x, y, [k, k, k], 1);
      img.h[i] = 0.62 - groove * 0.22 - d1 * 0.1 + fine;
      img.ro[i] = 0.5 + groove * 0.2;
    });
    return seamless(img);
  };
  // wood: grain bands running along x (warped so they are not straight), fine pores, satin finish
  REC.vx_mat_wood = () => {
    const img = new TX.Img();
    img.forEach((x, y, i) => {
      const warp = (TX.fbm(x, y, 2, 2, 201) - 0.5) * 6 + Math.sin(x * TAU / N) * 1.2;
      const g = y + warp;
      const bands = Math.sin(g * TAU / N * 2) * 0.5 + Math.sin(g * TAU / N * 5 + 1.3) * 0.3 + Math.sin(g * TAU / N * 11 + 0.4) * 0.2;
      const pores = (TX.fbm(x, y * 3, 4, 2, 203) - 0.5) * 0.08;
      const k = 0.93 + bands * 0.055 + pores;
      img.set(x, y, [k, k, k], 1);
      img.h[i] = 0.5 + bands * 0.06 + pores * 0.4;
      img.ro[i] = 0.55 - bands * 0.05;
    });
    return seamless(img);
  };
  // marble: polished stone with two families of thin veins and a cloudy base
  REC.vx_mat_marble = () => {
    const img = new TX.Img();
    img.forEach((x, y, i) => {
      const w1 = TX.fbm(x, y, 2, 3, 301) * 7, w2 = TX.fbm(x, y, 2, 3, 307) * 5;
      const v1 = Math.abs(Math.sin((x * 1 + y * 2) * TAU / N + w1)), v2 = Math.abs(Math.sin((x * 2 - y * 1) * TAU / N + w2));
      const vein = Math.max(0, 1 - v1 * 4.5) * 0.2 + Math.max(0, 1 - v2 * 7) * 0.1;
      const cloud = (TX.fbm(x, y, 4, 3, 311) - 0.5) * 0.06;
      const k = 0.99 + cloud - vein;
      img.set(x, y, [k, k, k], 1);
      img.h[i] = 0.5 - vein * 0.08;
      img.ro[i] = 0.18 + vein * 0.2;
    });
    return seamless(img);
  };
  // brushed stainless: long fine streaks along x, low roughness
  REC.vx_mat_metal = () => {
    const img = new TX.Img();
    img.forEach((x, y, i) => {
      const streak = (TX.fbm(x, y * 4, 2, 2, 401) - 0.5) * 0.09 + (TX.hash(0, y, 403) - 0.5) * 0.03;
      const k = 0.95 + streak;
      img.set(x, y, [k, k, k], 1);
      img.h[i] = 0.5 + streak * 0.4;
      img.ro[i] = 0.3;
    });
    return seamless(img);
  };
  // foliage: a midrib with side veins, mottled leaf surface
  REC.vx_mat_plant = () => {
    const img = new TX.Img();
    img.forEach((x, y, i) => {
      const mid = Math.max(0, 1 - Math.abs(x - 16) * 0.9);
      const side = Math.max(0, 1 - Math.abs(((y * 1.3 + Math.abs(x - 16) * 0.8) % 6) - 3) * 0.8) * (1 - mid) * 0.5;
      const mottle = (TX.fbm(x, y, 4, 3, 501) - 0.5) * 0.12;
      const k = 0.92 + mid * 0.12 + side * 0.08 + mottle;
      img.set(x, y, [k, k, k], 1);
      img.h[i] = 0.5 + mid * 0.1 + side * 0.06 + mottle * 0.3;
      img.ro[i] = 0.7;
    });
    return seamless(img);
  };
  // honed stone / concrete: soft mottling, grains and a few pits
  REC.vx_mat_stone = () => {
    const img = new TX.Img();
    img.forEach((x, y, i) => {
      const f = TX.fbm(x, y, 4, 3, 601) - 0.5;
      const grain = (TX.hash(x, y, 603) - 0.5) * 0.05;
      const pit = TX.hash(x, y, 607) > 0.97 ? -0.1 : 0;
      const k = 0.95 + f * 0.1 + grain + pit;
      img.set(x, y, [k, k, k], 1);
      img.h[i] = 0.5 + f * 0.12 + grain * 0.6 + pit;
      img.ro[i] = 0.85;
    });
    return seamless(img);
  };
  // flat swatch with a tiny bevel: 'vxcol:rrggbb'
  PRE.vxcol = (hex) => {
    const c = parseInt(hex, 16) || 0;
    const r = ((c >> 16) & 255) / 255, g = ((c >> 8) & 255) / 255, b = (c & 255) / 255;
    const img = new TX.Img();
    img.forEach((x, y, i) => {
      const cell = ((x >> 3) + (y >> 3)) & 1;
      const e = Math.min(x & 7, y & 7, 7 - (x & 7), 7 - (y & 7));
      const k = (e === 0 ? 0.84 : 1) * (cell ? 0.96 : 1.02);
      img.set(x, y, [r * k, g * k, b * k], 1);
      img.h[i] = e === 0 ? 0.35 : 0.6;
    });
    return img;
  };
})(VR);

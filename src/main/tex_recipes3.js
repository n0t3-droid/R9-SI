// ============================================================================
// Texture recipes part 3: workstations, storage, volt machines, rails, misc
// ============================================================================
(function (VR) {
  'use strict';
  const TX = VR.TX, N = TX.N, C = TX.C, REC = VR.TEXREC, PRE = VR.TEXPRE, PAL = VR.PAL, WOOD = VR.WOODPAL, hh = TX.hash;
  const cl = (v) => v < 0 ? 0 : v > 0.999 ? 0.999 : v;
  const K = (c) => typeof c === 'number' ? C(c) : c;
  // ---------------- helpers ----------------
  function rect(img, x0, y0, x1, y1, c, o) {
    o = o || {};
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (x < 0 || y < 0 || x >= N || y >= N) continue;
      const cc = typeof c === 'function' ? c(x, y) : K(c);
      if (!cc) continue;
      img.set(x, y, cc, o.a === undefined ? 1 : o.a);
      const i = y * N + x;
      if (o.h !== undefined) img.h[i] = o.h;
      if (o.ro !== undefined) img.ro[i] = o.ro;
      if (o.em !== undefined) img.em[i] = o.em;
    }
  }
  function frameRect(img, x0, y0, x1, y1, c, o) { rect(img, x0, y0, x1, y0, c, o); rect(img, x0, y1, x1, y1, c, o); rect(img, x0, y0, x0, y1, c, o); rect(img, x1, y0, x1, y1, c, o); }
  const noiseCol = (pal, s, per, k) => { const P = TX.pal(pal, 7); return (x, y) => TX.ramp(P, cl(TX.fbm(x, y, per || 8, 2, s) * (k || 0.8) + hh(x, y, s + 1) * (1 - (k || 0.8)))); };
  const clearRect = (img, x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) img.alpha(x, y, 0); };
  const PLANK = (w, o) => TX.planks(WOOD[w].planks, Object.assign({ seed: 5000 + w.length * 3 }, o || {}));
  const VPLANK = (w, o) => { // vertical boards
    const src = PLANK(w, o), img = new TX.Img();
    img.forEach((x, y, i) => { const j = x * N + y; img.c.set(src.c.subarray(j * 4, j * 4 + 4), i * 4); img.h[i] = src.h[j]; img.ro[i] = src.ro[j]; });
    return img;
  };
  const IRON = [0x3c3f45, 0x5a5e66, 0x7c818a, 0xa3a8b0, 0xc9cdd3];
  const DARKIRON = [0x16171a, 0x24262a, 0x34363c, 0x484b52, 0x5e626a];
  const GOLDM = [0x8a5a10, 0xc08a1c, 0xe8b834, 0xfad862, 0xfff0b0];
  const BRASS = [0x6a4a1a, 0x9a7028, 0xc89a3a, 0xe8c262, 0xfae6a0];
  const ironImg = (pal, o) => TX.metal(pal || IRON, Object.assign({ rough: 0.4, brushed: true }, o || {}));
  const stoneImg = (s, pal) => { const img = TX.natural(pal || PAL.stone, { period: 4, oct: 2, contrast: 0.75, seed: s, speck: 0.02, rough: 0.82 }); return img; };
  const machineStone = (s, pal) => { const img = stoneImg(s, pal); TX.bevel(img, 0, 0, N - 1, N - 1, 0.16, 0.28); return img; };
  const rivet = (img, x, y, c) => { img.set(x, y, TX.mix(K(c || 0xb8bcc4), [1, 1, 1], 0.3)); img.set(x + 1, y + 1, TX.scale(K(c || 0xb8bcc4), 0.45)); img.set(x + 1, y, K(c || 0xb8bcc4)); img.set(x, y + 1, K(c || 0xb8bcc4)); img.H(x, y, 0.95); img.H(x + 1, y, 0.9); img.H(x, y + 1, 0.9); };
  const glowRect = (img, x0, y0, x1, y1, pal, s, em) => {
    const P = TX.pal(pal, 6);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const f = cl(TX.fbm(x, y, 8, 2, s) * 0.7 + (1 - Math.abs((x - (x0 + x1) / 2) / ((x1 - x0) / 2 + 1))) * 0.3 + (y - y0) / (y1 - y0 + 1) * 0.25);
      img.set(x, y, TX.ramp(P, f), 1); img.em[y * N + x] = (em || 1) * (0.55 + f * 0.45); img.ro[y * N + x] = 0.5; img.h[y * N + x] = 0.35;
    }
  };

  // ============================ WORKSTATIONS ============================
  // crafting table
  const tableBand = (img, w, rows) => {
    const P = TX.pal(WOOD[w].planks.map(c => TX.scale(C(c), 0.82)), 6);
    for (let y = 0; y < rows; y++) for (let x = 0; x < N; x++) {
      const f = cl(0.45 + (TX.fbm(x * 0.3, y * 3, 8, 2, 5100) - 0.5) * 0.6 + (y === 0 ? 0.2 : y === rows - 1 ? -0.25 : 0));
      img.set(x, y, TX.ramp(P, f), 1); img.H(x, y, y === rows - 1 ? 0.3 : 0.8);
    }
  };
  const legs = (img, w) => { const P = WOOD[w].planks; for (let y = 0; y < N; y++) for (const x of [0, 1, 2, 29, 30, 31]) { img.set(x, y, TX.scale(C(P[1]), x === 2 || x === 29 ? 0.7 : 0.9)); img.H(x, y, 0.85); } };
  REC.crafting_table_top = () => {
    const img = PLANK('oak', { boards: 4 });
    TX.bevel(img, 0, 0, N - 1, N - 1, 0.25, 0.35);
    frameRect(img, 1, 1, 30, 30, (x, y) => TX.scale(C(0x5a4224), 0.9 + hh(x, y, 1) * 0.15), { h: 0.9 });
    for (const g of [11, 20]) { rect(img, g, 3, g, 28, (x, y) => TX.scale(C(0x3e2c16), 0.9 + hh(x, y, 2) * 0.2), { h: 0.2 }); rect(img, 3, g, 28, g, (x, y) => TX.scale(C(0x3e2c16), 0.9 + hh(x, y, 3) * 0.2), { h: 0.2 }); }
    for (const [x, y] of [[2, 2], [28, 2], [2, 28], [28, 28]]) rivet(img, x, y, 0x9aa0a8);
    return img;
  };
  const hammer = (img, x, y) => { rect(img, x + 3, y + 3, x + 4, y + 17, (a, b) => TX.scale(C(0xb89060), 0.85 + (a - x - 3) * 0.15), { h: 0.85 }); rect(img, x, y, x + 7, y + 3, (a, b) => TX.scale(C(0x8a8f98), 0.8 + (b - y) * 0.08), { h: 0.95, ro: 0.35 }); rect(img, x, y + 3, x + 7, y + 3, 0x4a4e56, { h: 0.6 }); };
  const saw = (img, x, y) => { for (let k = 0; k < 12; k++) rect(img, x + k, y + 2, x + k, y + 12 - Math.floor(k / 3), (a, b) => b === y + 12 - Math.floor(k / 3) && k % 2 ? C(0x5a5e66) : TX.scale(C(0xb8bec8), 0.9 + (a - x) * 0.01), { h: 0.9, ro: 0.25 }); rect(img, x + 10, y, x + 14, y + 5, 0x8a5a2a, { h: 0.95 }); rect(img, x + 11, y + 2, x + 13, y + 3, 0x3a2410, { h: 0.5 }); };
  const tongs = (img, x, y) => { TX.line(img, x, y, x + 6, y + 16, (a, b) => { img.set(a, b, C(0x6a6e76)); img.H(a, b, 0.9); }); TX.line(img, x + 6, y, x, y + 16, (a, b) => { img.set(a, b, C(0x8a8e96)); img.H(a, b, 0.9); }); };
  REC.crafting_table_side = () => { const img = PLANK('oak', { boards: 4 }); tableBand(img, 'oak', 6); legs(img, 'oak'); hammer(img, 6, 9); saw(img, 16, 10); return img; };
  REC.crafting_table_front = () => { const img = PLANK('oak', { boards: 4 }); tableBand(img, 'oak', 6); legs(img, 'oak'); tongs(img, 7, 10); hammer(img, 18, 9); rect(img, 5, 26, 26, 27, 0xd8c8a0, { h: 0.8 }); for (let x = 6; x < 26; x += 3) img.set(x, 26, C(0x3a2a1a)); return img; };

  // furnaces (stone machine family)
  const furnaceSide = (pal, s) => { const img = TX.polished(pal, { seed: s }); for (let x = 0; x < N; x++) { img.mul(x, 15, 0.7); img.mul(x, 16, 1.12); img.H(x, 15, 0.2); } return img; };
  const furnaceTop = (pal, s) => { const img = TX.polished(pal, { seed: s }); TX.bevel(img, 4, 4, 27, 27, -0.12, -0.1); for (let gy = 0; gy < 3; gy++) for (let gx = 0; gx < 3; gx++) rect(img, 8 + gx * 6, 8 + gy * 6, 11 + gx * 6, 11 + gy * 6, (x, y) => TX.scale(K(0x1a1a1e), 0.9 + (y % 6) * 0.05), { h: 0.1 }); return img; };
  const mouth = (img, x0, y0, x1, y1, lit, fireCols) => {
    frameRect(img, x0 - 1, y0 - 1, x1 + 1, y1 + 1, (x, y) => TX.scale(C(0x3a3c42), 0.9 + hh(x, y, 4) * 0.2), { h: 0.9, ro: 0.4 });
    if (lit) glowRect(img, x0, y0, x1, y1, fireCols || [0x6a1004, 0xc83a08, 0xff7a1a, 0xffc040, 0xfff0a0], 5200, 1);
    else rect(img, x0, y0, x1, y1, (x, y) => TX.scale(C(0x0e0e10), 0.8 + (y - y0) * 0.03), { h: 0.05 });
    // grate bars
    for (let x = x0 + 2; x < x1; x += 4) rect(img, x, y0, x, y1, lit ? 0x2a1a14 : 0x2e3034, { h: 0.6, em: 0 });
  };
  const SMOOTH = [0x55575c, 0x6f7176, 0x8a8c91, 0xa3a5aa];
  REC.furnace_side = () => furnaceSide(SMOOTH, 5210);
  REC.furnace_top = () => furnaceTop(SMOOTH, 5211);
  const furnaceFront = (lit) => { const img = furnaceSide(SMOOTH, 5212); mouth(img, 8, 17, 23, 27, lit); rect(img, 9, 6, 22, 9, (x, y) => TX.scale(C(0x1a1a1e), 1), { h: 0.1 }); for (let x = 10; x < 22; x += 3) rect(img, x, 6, x, 9, 0x3a3c42, { h: 0.7 }); return img; };
  REC.furnace_front = () => furnaceFront(false);
  REC.furnace_front_on = () => furnaceFront(true);
  const BLAST = [0x2c2d31, 0x3e4046, 0x55575e, 0x6c6f76];
  REC.blast_furnace_side = () => { const img = furnaceSide(BLAST, 5220); for (const y of [4, 5, 26, 27]) for (let x = 0; x < N; x++) { img.set(x, y, TX.scale(C(0x8a8e96), y % 2 ? 0.7 : 1)); img.ro[y * N + x] = 0.35; } for (const x of [4, 27]) for (const y of [4, 26]) rivet(img, x, y); return img; };
  REC.blast_furnace_top = () => { const img = furnaceTop(BLAST, 5221); frameRect(img, 2, 2, 29, 29, 0x7a7e86, { h: 0.9, ro: 0.3 }); return img; };
  const blastFront = (lit) => { const img = REC.blast_furnace_side(); mouth(img, 7, 12, 24, 24, lit, [0x6a1004, 0xd84a08, 0xff9a2a, 0xffe060, 0xffffc0]); for (let y = 12; y <= 24; y += 4) rect(img, 7, y, 24, y, lit ? 0x3a1a10 : 0x2e3034, { h: 0.6, em: 0 }); return img; };
  REC.blast_furnace_front = () => blastFront(false);
  REC.blast_furnace_front_on = () => blastFront(true);
  REC.smoker_side = () => { const img = PLANK('spruce', { boards: 4 }); TX.bevel(img, 0, 0, N - 1, N - 1, 0.2, 0.3); for (const y of [2, 3, 28, 29]) for (let x = 0; x < N; x++) img.set(x, y, TX.scale(C(0x5a5e66), y % 2 ? 0.75 : 1)); return img; };
  REC.smoker_top = () => { const img = furnaceTop(BLAST, 5230); TX.disc(img, 15.5, 15.5, 5, (d) => TX.scale(C(0x1a1a1e), 0.8 + d * 0.3)); return img; };
  REC.smoker_bottom = () => machineStone(5231, SMOOTH);
  const smokerFront = (lit) => { const img = REC.smoker_side(); rect(img, 4, 6, 27, 27, (x, y) => TX.scale(C(0x3a3c42), 0.9 + hh(x, y, 7) * 0.15), { h: 0.85, ro: 0.4 }); mouth(img, 8, 10, 23, 20, lit); for (let x = 6; x < 26; x += 4) { rect(img, x, 23, x + 2, 25, (a, b) => TX.scale(C(0x4a3420), 0.9 + (a - x) * 0.1), { h: 0.8 }); } return img; };
  REC.smoker_front = () => smokerFront(false);
  REC.smoker_front_on = () => smokerFront(true);

  // chests
  const chestWood = (w, s) => {
    const P = TX.pal(WOOD[w].planks, 7), img = new TX.Img();
    img.forEach((x, y, i) => { const g = TX.fbm(x * 0.3, y * 2, 8, 2, s) * 0.6 + TX.vnoise(x, y, 16, s + 1) * 0.2; const b = Math.floor(y / 7); const f = cl(0.4 + g * 0.5 + (hh(b, 0, s) - 0.5) * 0.2 - (y % 7 === 0 ? 0.25 : 0)); img.set(x, y, TX.ramp(P, f), 1); img.h[i] = y % 7 === 0 ? 0.35 : 0.7; img.ro[i] = 0.75; });
    return img;
  };
  const chestTrim = (img, col, seamY) => {
    frameRect(img, 2, 4, 29, 31, col, { h: 0.95, ro: 0.3 }); frameRect(img, 3, 5, 28, 30, (x, y) => TX.scale(K(col), 0.55), { h: 0.5 });
    if (seamY) { rect(img, 2, seamY, 29, seamY, (x, y) => TX.scale(K(col), 0.4), { h: 0.1 }); rect(img, 2, seamY + 1, 29, seamY + 1, col, { h: 0.9, ro: 0.3 }); }
  };
  REC.chest_side = () => { const img = chestWood('oak', 5300); chestTrim(img, 0x8a7a5a, 13); return img; };
  REC.chest_front = () => REC.chest_side();
  REC.chest_top = () => { const img = chestWood('oak', 5301); frameRect(img, 2, 2, 29, 29, 0x8a7a5a, { h: 0.95, ro: 0.3 }); frameRect(img, 3, 3, 28, 28, (x, y) => TX.scale(C(0x8a7a5a), 0.55), { h: 0.5 }); for (const [x, y] of [[4, 4], [26, 4], [4, 26], [26, 26]]) rivet(img, x, y, 0xc8b88a); return img; };
  const latch = (base, acc) => { const img = TX.sprite(); rect(img, 0, 0, 7, 11, (x, y) => TX.scale(K(base), 0.8 + (y < 2 ? 0.3 : 0) + hh(x, y, 9) * 0.12), { h: 0.9, ro: 0.25 }); if (acc) rect(img, 3, 4, 4, 7, acc, { h: 0.4, em: 0.4 }); else rect(img, 3, 5, 4, 7, 0x2a2a2a, { h: 0.3 }); return img; };
  REC.chest_latch = () => latch(0xd8c070);
  REC.trapped_chest_front = () => { const img = REC.chest_side(); for (let x = 3; x < 29; x++) { img.set(x, 12, C(0xc82a1a)); img.em[12 * N + x] = 0.35; } return img; };
  REC.trapped_chest_latch = () => latch(0xd8c070, 0xe8301a);
  const voidWood = (s) => { const img = TX.natural(PAL.obsidian, { period: 4, oct: 3, seed: s, contrast: 1.2, rough: 0.3 }); return img; };
  REC.void_chest_side = () => { const img = voidWood(5310); chestTrim(img, 0x2a8a7a, 13); for (let x = 3; x < 29; x++) img.em[13 * N + x] = 0.8; rect(img, 3, 13, 28, 13, 0x3affd0, { em: 0.9 }); return img; };
  REC.void_chest_front = () => REC.void_chest_side();
  REC.void_chest_top = () => { const img = voidWood(5311); frameRect(img, 2, 2, 29, 29, 0x2a8a7a, { h: 0.95, ro: 0.2 }); TX.disc(img, 15.5, 15.5, 5, (d) => TX.mix(C(0x9affe8), C(0x0a4a4a), d)); for (let i = 0; i < N * N; i++) if (img.c[i * 4 + 1] > 0.5 && img.c[i * 4] < 0.7) img.em[i] = 0.7; return img; };
  REC.void_chest_latch = () => { const img = latch(0x1a5a54, 0x6affe0); return img; };

  // barrel
  REC.barrel_side = () => { const img = VPLANK('spruce', { boards: 5, nails: false }); for (const y of [4, 5, 26, 27]) for (let x = 0; x < N; x++) { img.set(x, y, TX.scale(C(0x6a6e76), y % 2 ? 0.7 : 1.05)); img.H(x, y, 0.9); img.ro[y * N + x] = 0.35; } return img; };
  const barrelLid = (open) => {
    const img = PLANK('spruce', { boards: 5, nails: false });
    img.forEach((x, y, i) => { const d = Math.max(Math.abs(x - 15.5), Math.abs(y - 15.5)); if (d > 13.5) { img.set(x, y, TX.scale(C(0x5a5e66), d > 14.5 ? 0.7 : 1)); img.h[i] = 0.9; img.ro[i] = 0.35; } else if (open && d < 12.5) { img.set(x, y, TX.scale(C(0x1a120a), 0.8 + (15.5 - d) * 0.02)); img.h[i] = 0.05; } });
    if (!open) rect(img, 12, 14, 19, 17, 0x3a2410, { h: 0.3 });
    return img;
  };
  REC.barrel_top = () => barrelLid(false);
  REC.barrel_top_open = () => barrelLid(true);
  REC.barrel_bottom = () => { const img = barrelLid(false); rect(img, 12, 14, 19, 17, (x, y) => img.get(x, y - 4), {}); return img; };

  // anvil
  REC.anvil = () => ironImg(DARKIRON, { rough: 0.45 });
  PRE.anvil_top = (d) => {
    d = +d;
    const img = ironImg(DARKIRON, { rough: 0.4 });
    for (let y = 0; y < N; y++) for (let x = 10; x < 22; x++) { img.blend(x, y, C(0x6a6e78), 0.6); img.ro[y * N + x] = 0.25; if (x === 10 || x === 21) img.mul(x, y, 0.6); }
    if (d > 0) TX.cracks(img, d * 5, 5400 + d, C(0x0a0a0c));
    if (d > 1) for (let k = 0; k < 6; k++) { const x = 8 + Math.floor(hh(k, 1, 5401) * 16), y = Math.floor(hh(k, 2, 5401) * 30); rect(img, x, y, x + 1, y + 1, 0x101012, { h: 0.1 }); }
    return img;
  };

  // runic (enchanting) table
  REC.runic_table_bottom = () => REC.obsidian();
  REC.runic_table_side = () => {
    const img = REC.obsidian();
    rect(img, 0, 8, 31, 14, (x, y) => TX.scale(C(0x8a1a2a), 0.75 + TX.fbm(x, y, 8, 2, 5500) * 0.4 + (y === 8 ? 0.2 : 0)), { h: 0.7, ro: 0.95 });
    rect(img, 0, 14, 31, 14, 0xd8a83a, { h: 0.9, ro: 0.3 });
    for (let k = 0; k < 6; k++) { const x = 2 + k * 5; if (k % 2) rect(img, x + 1, 11, x + 2, 12, 0xe8c050, { h: 0.9 }); else img.set(x + 2, 11, C(0xe8c050)); }
    // glowing runes on obsidian
    const glyphs = [[[0, 0], [0, 4], [2, 2]], [[0, 0], [2, 0], [1, 2], [1, 4]], [[0, 2], [2, 0], [2, 4]], [[0, 0], [2, 4], [0, 4]]];
    for (let k = 0; k < 4; k++) { const gx = 3 + k * 7, gy = 20 + (k % 2) * 3; const g = glyphs[k]; for (let a = 0; a < g.length - 1; a++) TX.line(img, gx + g[a][0], gy + g[a][1], gx + g[a + 1][0], gy + g[a + 1][1], (x, y) => { img.set(x, y, C(0xb07aff)); img.em[y * N + x] = 1; }); }
    return img;
  };
  REC.runic_table_top = () => {
    const img = new TX.Img();
    img.forEach((x, y, i) => { const f = TX.fbm(x, y, 8, 2, 5510); img.set(x, y, TX.scale(C(0x7a1626), 0.75 + f * 0.4), 1); img.h[i] = 0.6 + f * 0.1; img.ro[i] = 0.95; });
    frameRect(img, 0, 0, 31, 31, 0xd8a83a, { h: 0.9, ro: 0.3 }); frameRect(img, 2, 2, 29, 29, 0xb8882a, { h: 0.8, ro: 0.3 });
    for (let a = 0; a < 64; a++) { const t = a / 64 * Math.PI * 2; const x = Math.round(15.5 + Math.cos(t) * 9), y = Math.round(15.5 + Math.sin(t) * 9); img.set(x, y, C(0xf0c860)); img.em[y * N + x] = 0.5; }
    for (let k = 0; k < 8; k++) { const t = k / 8 * Math.PI * 2; const x = Math.round(15.5 + Math.cos(t) * 6), y = Math.round(15.5 + Math.sin(t) * 6); img.set(x, y, C(0xc890ff)); img.em[y * N + x] = 1; }
    for (const [x, y] of [[4, 4], [26, 4], [4, 26], [26, 26]]) { rect(img, x, y, x + 1, y + 1, 0xf0c860, { em: 0.4 }); }
    return img;
  };
  REC.runic_book = () => {
    const img = new TX.Img();
    img.forEach((x, y, i) => { const f = TX.fbm(x, y, 8, 2, 5520); img.set(x, y, TX.scale(C(0x5a2a6a), 0.7 + f * 0.5), 1); img.ro[i] = 0.7; });
    rect(img, 0, 0, 31, 7, (x, y) => TX.scale(C(0xf2ead0), 0.85 + (y % 2) * 0.1), { h: 0.6, em: 0.35 });
    for (let a = 0; a < 40; a++) { const t = a / 40 * Math.PI * 2; const x = Math.round(15.5 + Math.cos(t) * 4), y = Math.round(18.5 + Math.sin(t) * 4); img.set(x, y, C(0xd8b0ff)); img.em[y * N + x] = 1; }
    rect(img, 15, 17, 16, 20, 0xf0e0ff, { em: 1 });
    return img;
  };

  // brewing stand
  REC.brewing_stand = () => { const img = TX.sprite(); rect(img, 14, 4, 17, 31, (x, y) => TX.ramp(TX.pal(BRASS, 5), cl(0.3 + (x - 14) * 0.18 - (x === 17 ? 0.35 : 0) + hh(x, y, 1) * 0.08)), { h: 0.9, ro: 0.3 }); rect(img, 14, 0, 17, 3, (x, y) => TX.scale(C(0xffd870), 1 - (y * 0.08)), { h: 1, ro: 0.2, em: 0.3 }); return img; };
  REC.brewing_base = () => { const img = TX.natural(PAL.deep, { period: 4, oct: 2, seed: 5530, contrast: 1, rough: 0.85 }); TX.bevel(img, 0, 0, N - 1, N - 1, 0.18, 0.2); return img; };
  REC.brewing_stand_bottles = () => {
    const img = TX.sprite(), B = TX.pal(BRASS, 5);
    TX.line(img, 16, 6, 4, 13, (x, y) => { img.set(x, y, TX.ramp(B, 0.7), 1); img.set(x, y + 1, TX.ramp(B, 0.35), 1); });
    TX.line(img, 16, 6, 28, 13, (x, y) => { img.set(x, y, TX.ramp(B, 0.7), 1); img.set(x, y + 1, TX.ramp(B, 0.35), 1); });
    const bottle = (cx, liq) => {
      rect(img, cx - 1, 14, cx + 1, 17, 0xc8d8e0, { h: 0.9, ro: 0.05 });
      TX.disc(img, cx + 0.5, 24, 5, (d, x, y) => y > 22 ? TX.mix(K(liq), [1, 1, 1], d * 0.2) : TX.mix(C(0xd8eef8), C(0x9ab8c8), d));
      for (let y = 19; y < 30; y++) for (let x = cx - 5; x <= cx + 5; x++) if (img.ga(x, y) > 0.5 && y > 22) img.em[y * N + x] = 0.35;
      rect(img, cx - 1, 13, cx + 1, 13, 0x8a5a2a, {});
    };
    bottle(4, 0xe83a8a); bottle(27, 0x3ac8ff);
    return img;
  };

  // cartography / fletching / smithing / loom
  REC.cartography_table_top = () => {
    const img = PLANK('dark_oak', { boards: 4 }); TX.bevel(img, 0, 0, N - 1, N - 1, 0.25, 0.3);
    const P = TX.pal([0xb89a6a, 0xd8c498, 0xece0bc, 0xf8f0da], 6);
    rect(img, 3, 3, 28, 28, (x, y) => { const f = TX.fbm(x, y, 4, 3, 5600); const land = f > 0.52; const c = land ? TX.mix(TX.ramp(P, cl(f)), C(0x8ab070), 0.35) : TX.mix(TX.ramp(P, cl(f)), C(0x6aa0c8), 0.45); return (Math.abs(f - 0.52) < 0.012) ? C(0x4a3a2a) : c; }, { h: 0.75, ro: 0.95 });
    frameRect(img, 3, 3, 28, 28, 0x9a7a4a, { h: 0.7 });
    // compass rose
    for (let k = -3; k <= 3; k++) { img.set(22 + k, 8, C(0x7a1a1a)); img.set(22, 8 + k, C(0x7a1a1a)); }
    return img;
  };
  REC.cartography_table_side = () => { const img = PLANK('dark_oak', { boards: 4 }); tableBand(img, 'dark_oak', 5); legs(img, 'dark_oak'); rect(img, 6, 9, 25, 22, (x, y) => TX.scale(C(0xe8dcb8), 0.85 + TX.fbm(x, y, 8, 2, 5601) * 0.2), { h: 0.8, ro: 0.95 }); TX.line(img, 8, 18, 14, 12, (x, y) => img.set(x, y, C(0x6a4a2a))); TX.line(img, 14, 12, 22, 16, (x, y) => img.set(x, y, C(0x6a4a2a))); return img; };
  REC.cartography_table_side2 = () => { const img = PLANK('dark_oak', { boards: 4 }); tableBand(img, 'dark_oak', 5); legs(img, 'dark_oak'); for (let k = 0; k < 3; k++) rect(img, 7 + k * 7, 10, 10 + k * 7, 26, (x, y) => TX.scale(C(0xe8dcb8), 0.75 + (x - 7 - k * 7) * 0.08), { h: 0.85 }); return img; };
  REC.fletching_table_top = () => { const img = PLANK('birch', { boards: 4 }); TX.bevel(img, 0, 0, N - 1, N - 1, 0.25, 0.3); rect(img, 5, 5, 26, 26, (x, y) => ((x + y) % 6 === 0 ? C(0xc8c0a8) : C(0xf2eee2)), { h: 0.75, ro: 0.95 }); TX.line(img, 8, 23, 23, 8, (x, y) => { img.set(x, y, C(0x6a4a2a)); }); rect(img, 21, 7, 24, 10, 0x9aa0a8, {}); for (let k = 0; k < 4; k++) { img.set(8 + k, 21 + k, C(0xe84a3a)); img.set(10 + k, 23 + k, C(0xe84a3a)); } return img; };
  REC.fletching_table_side = () => { const img = PLANK('birch', { boards: 4 }); tableBand(img, 'birch', 5); legs(img, 'birch'); for (let k = 0; k < 3; k++) { const x = 8 + k * 7; rect(img, x, 10, x, 26, 0x8a6a4a, {}); for (let y = 11; y < 19; y++) { img.set(x - 1 - ((y - 11) >> 2), y, C(k === 1 ? 0xf0f0f0 : 0xe8d8a0)); img.set(x + 1 + ((y - 11) >> 2), y, C(k === 1 ? 0xd8d8d8 : 0xd0c080)); } } return img; };
  REC.fletching_table_front = () => { const img = PLANK('birch', { boards: 4 }); tableBand(img, 'birch', 5); legs(img, 'birch'); TX.disc(img, 16, 18, 7, (d) => d > 0.72 ? C(0xe84a3a) : d > 0.42 ? C(0xf2eee2) : C(0xe84a3a)); return img; };
  REC.smithing_table_top = () => { const img = ironImg(DARKIRON, { rough: 0.4 }); rect(img, 4, 4, 27, 27, (x, y) => TX.scale(C(0x4a4d55), 0.85 + TX.vnoise(x * 4, y * 0.3, 16, 5610) * 0.25), { ro: 0.3, h: 0.7 }); for (const [x, y] of [[2, 2], [28, 2], [2, 28], [28, 28]]) rivet(img, x, y); return img; };
  REC.smithing_table_bottom = () => PLANK('dark_oak', { boards: 4 });
  REC.smithing_table_side = () => { const img = PLANK('dark_oak', { boards: 4 }); rect(img, 0, 0, 31, 7, (x, y) => TX.scale(C(0x3a3c42), 0.8 + (y === 0 ? 0.4 : 0) + hh(x, y, 3) * 0.1), { h: 0.9, ro: 0.35 }); legs(img, 'dark_oak'); return img; };
  REC.smithing_table_front = () => { const img = REC.smithing_table_side(); hammer(img, 6, 11); tongs(img, 20, 11); return img; };
  REC.loom_front = () => { const img = PLANK('oak', { boards: 4 }); TX.bevel(img, 0, 0, N - 1, N - 1, 0.2, 0.3); rect(img, 4, 6, 27, 25, (x, y) => x % 2 ? C(0xe8e0d0) : C(0xc8c0b0), { h: 0.6, ro: 1 }); rect(img, 4, 16, 27, 25, (x, y) => ((x + y) % 4 < 2) ? C(0x3a6ab8) : C(0xd84a4a), { h: 0.7, ro: 1 }); rect(img, 3, 5, 28, 5, 0x5a4224, { h: 0.9 }); rect(img, 3, 26, 28, 26, 0x5a4224, { h: 0.9 }); return img; };
  REC.loom_side = () => { const img = PLANK('oak', { boards: 4 }); TX.bevel(img, 0, 0, N - 1, N - 1, 0.2, 0.3); TX.disc(img, 15.5, 15.5, 6, (d) => d > 0.6 ? C(0x7a5a3a) : TX.scale(C(0xe8e0d0), 0.8 + (1 - d) * 0.3)); return img; };
  REC.loom_top = () => { const img = PLANK('oak', { boards: 4 }); for (const y of [4, 5, 6, 25, 26, 27]) rect(img, 0, y, 31, y, (x) => TX.scale(C(0x8a6a4a), y % 3 === 0 ? 1.1 : 0.85), { h: 0.9 }); for (let x = 2; x < 30; x += 2) rect(img, x, 7, x, 24, 0xe8e0d0, { h: 0.6 }); return img; };
  REC.loom_bottom = () => PLANK('oak', { boards: 4 });

  // grindstone / stonecutter / lectern / bell
  REC.grindstone_side = () => { const img = TX.natural(PAL.andesite, { period: 8, oct: 2, seed: 5700, speck: 0.15, speck2: 0.08, contrast: 1.3 }); for (let x = 0; x < N; x++) { img.mul(x, 0, 0.7); img.mul(x, 31, 0.7); } return img; };
  REC.grindstone_round = () => { const img = TX.sprite(); const base = REC.grindstone_side(); TX.disc(img, 16, 12, 11.5, (d, x, y) => { const c = base.get(x, y); return d > 0.88 ? TX.scale(c, 0.7) : d < 0.22 ? C(0x5a4224) : d < 0.3 ? C(0x2a2a2a) : TX.scale(c, 0.95 + Math.sin(d * 18) * 0.04); }); for (let i = 0; i < N * N; i++) if (img.c[i * 4 + 3] < 0.5) { img.c[i * 4] = 0.4; img.c[i * 4 + 1] = 0.4; img.c[i * 4 + 2] = 0.4; img.c[i * 4 + 3] = 1; } return img; };
  REC.grindstone_pivot = () => { const img = PLANK('dark_oak', { boards: 8 }); return img; };
  REC.stonecutter_side = () => { const img = machineStone(5710, SMOOTH); for (const y of [14, 15]) for (let x = 0; x < N; x++) img.set(x, y, TX.scale(C(0x7a7e86), y === 14 ? 1.1 : 0.7)); for (let y = 18; y < N; y++) for (let x = 0; x < N; x++) if ((x + 2) % 10 < 1) img.mul(x, y, 0.8); return img; };
  REC.stonecutter_top = () => { const img = machineStone(5711, SMOOTH); rect(img, 2, 14, 29, 17, (x, y) => TX.scale(C(0x141416), 1), { h: 0.05 }); frameRect(img, 1, 13, 30, 18, 0x7a7e86, { h: 0.9, ro: 0.35 }); return img; };
  REC.stonecutter_bottom = () => machineStone(5712, SMOOTH);
  REC.stonecutter_saw = () => {
    const img = TX.sprite();
    for (let y = 0; y < 16; y++) for (let x = 2; x < 30; x++) {
      const d = Math.hypot(x + 0.5 - 16, y + 0.5 - 15), a = Math.atan2(y + 0.5 - 15, x + 0.5 - 16);
      const tooth = (Math.sin(a * 16) > 0.2) ? 1.2 : 0;
      if (d < 12 + tooth) { const c = d < 3 ? C(0x3a3c42) : TX.scale(C(0xc8ccd4), 0.75 + Math.sin(d * 1.3 + a * 2) * 0.08 + (d > 11 ? 0.2 : 0)); img.set(x, y, c, 1); img.ro[y * N + x] = 0.2; img.h[y * N + x] = 0.8; }
    }
    return img;
  };
  REC.lectern_base = () => { const img = PLANK('oak', { boards: 4 }); TX.bevel(img, 0, 0, N - 1, N - 1, 0.25, 0.3); return img; };
  REC.lectern_sides = () => { const img = VPLANK('oak', { boards: 4 }); TX.bevel(img, 0, 0, N - 1, N - 1, 0.2, 0.3); TX.bevel(img, 5, 4, 26, 27, -0.12, -0.1); return img; };
  REC.lectern_top = () => { const img = PLANK('oak', { boards: 4 }); TX.bevel(img, 0, 0, N - 1, N - 1, 0.2, 0.3); rect(img, 0, 27, 31, 30, (x, y) => TX.scale(C(0x6a4a24), y === 27 ? 1.2 : 0.85), { h: 0.95 }); return img; };
  REC.bell_body = () => { const img = TX.metal(GOLDM, { rough: 0.22 }); for (let x = 0; x < N; x++) for (const y of [6, 7, 22, 23]) img.mul(x, y, y % 2 ? 1.2 : 0.75); return img; };
  REC.bell_frame = () => PLANK('dark_oak', { boards: 8 });

  // bookshelves
  const BOOKC = [0x8a2a2a, 0x2a4a8a, 0x2a6a3a, 0x7a5a2a, 0x5a2a6a, 0xa8782a, 0x2a6a6a, 0x6a1a1a, 0x3a3a5a];
  const books = (img, x0, y0, x1, y1, s) => {
    let x = x0, k = 0;
    while (x <= x1) {
      const w = 2 + Math.floor(hh(k, 1, s) * 3), top = y0 + Math.floor(hh(k, 2, s) * 4), col = C(BOOKC[Math.floor(hh(k, 3, s) * BOOKC.length)]);
      for (let xx = x; xx < Math.min(x + w, x1 + 1); xx++) for (let y = y0; y <= y1; y++) {
        if (y < top) { img.set(xx, y, C(0x1e140a)); img.H(xx, y, 0.1); continue; }
        const edge = xx === x ? 1.25 : xx === x + w - 1 ? 0.65 : 1;
        let c = TX.scale(col, edge * (0.85 + hh(xx, y, s + 5) * 0.15));
        if (y === top + 2 || y === y1 - 2) c = TX.mix(c, C(0xe8c870), 0.6);
        img.set(xx, y, c); img.H(xx, y, 0.75); img.ro[y * N + xx] = 0.8;
      }
      x += w; k++;
    }
  };
  REC.bookshelf = () => { const img = PLANK('oak', { boards: 4 }); books(img, 2, 2, 29, 13, 5800); books(img, 2, 18, 29, 29, 5801); for (const y of [14, 15, 16, 17]) rect(img, 0, y, 31, y, (x) => TX.scale(C(0xa98652), y === 14 ? 1.15 : y === 17 ? 0.7 : 1), { h: 0.9 }); frameRect(img, 0, 0, 31, 31, 0x86673a, { h: 0.95 }); frameRect(img, 1, 1, 30, 30, 0x5a4224, { h: 0.4 }); return img; };
  REC.chiseled_bookshelf_side = () => { const img = VPLANK('oak', { boards: 4 }); TX.bevel(img, 0, 0, N - 1, N - 1, 0.2, 0.3); return img; };
  REC.chiseled_bookshelf_top = () => { const img = PLANK('oak', { boards: 4 }); TX.bevel(img, 0, 0, N - 1, N - 1, 0.2, 0.3); return img; };
  PRE.chiseled_bookshelf = (n) => {
    n = +n;
    const img = PLANK('oak', { boards: 4 });
    frameRect(img, 0, 0, 31, 31, 0xa98652, { h: 0.95 });
    const slots = [[2, 2, 10, 14], [12, 2, 20, 14], [22, 2, 30, 14], [2, 17, 10, 29], [12, 17, 20, 29], [22, 17, 30, 29]];
    slots.forEach(([x0, y0, x1, y1], k) => {
      if (k < n) { rect(img, x0, y0, x1, y1, 0x1e140a, { h: 0.1 }); books(img, x0, y0, x1, y1, 5810 + k); }
      else rect(img, x0, y0, x1, y1, (x, y) => TX.scale(C(0x2a1c0e), 0.7 + (y - y0) * 0.03), { h: 0.1 });
    });
    return img;
  };

  // cake
  const SPONGE = [0x8a5a2a, 0xb07a3a, 0xd09a52, 0xe0b068];
  REC.cake_top = () => { const img = TX.natural([0xe8e2da, 0xf4f0ea, 0xfcfaf6], { period: 4, oct: 2, seed: 5900, contrast: 0.6, rough: 0.4 }); for (let k = 0; k < 7; k++) { const x = 6 + Math.floor(hh(k, 1, 5901) * 20), y = 6 + Math.floor(hh(k, 2, 5901) * 20); rect(img, x, y, x + 1, y + 1, (a, b) => a === x && b === y ? C(0xff6a6a) : C(0xd01a2a), { h: 0.95, ro: 0.2 }); } TX.bevel(img, 2, 2, 29, 29, 0.06, 0.1); return img; };
  REC.cake_side = () => {
    const img = TX.sprite();
    rect(img, 0, 16, 31, 31, noiseCol(SPONGE, 5902, 8), { h: 0.6, ro: 0.9 });
    rect(img, 0, 23, 31, 24, (x, y) => TX.scale(C(0xf2e8e0), 0.9 + hh(x, y, 1) * 0.1), { h: 0.7, ro: 0.5 });
    for (let x = 0; x < N; x++) { const drip = 16 + 3 + Math.floor(hh(x >> 1, 0, 5903) * 3); rect(img, x, 16, x, drip, (a, b) => TX.scale(C(0xf6f2ee), b === drip ? 0.9 : 1), { h: 0.8, ro: 0.4 }); }
    for (let x = 0; x < N; x++) img.mul(x, 31, 0.8);
    return img;
  };
  REC.cake_inner = () => { const img = TX.sprite(); rect(img, 0, 16, 31, 31, noiseCol([0xc08a4a, 0xd8a868, 0xe8c080], 5904, 8), { h: 0.5, ro: 0.95 }); rect(img, 0, 16, 31, 18, 0xf6f2ee, { h: 0.8 }); rect(img, 0, 23, 31, 24, 0xf2e8e0, { h: 0.7 }); rect(img, 0, 24, 31, 24, 0xd83a4a, {}); return img; };
  REC.cake_bottom = () => TX.natural(SPONGE, { period: 4, oct: 2, seed: 5905, contrast: 0.8 });

  // campfire logs
  const campLog = (lit, glow) => {
    const P = TX.pal(WOOD.oak.bark, 7), img = new TX.Img();
    img.forEach((x, y, i) => {
      const g = TX.fbm(x * 0.35, y * 3, 4, 3, 5950), groove = Math.abs(Math.sin((y + TX.fbm(x, y, 4, 2, 5951) * 5) * 0.9));
      let f = cl(g * 0.7 + groove * 0.3); f = cl((f - 0.45) * 1.8 + 0.5);
      img.set(x, y, TX.ramp(P, f), 1); img.h[i] = f; img.ro[i] = 0.9;
      if (lit && groove < 0.25 && TX.fbm(x, y, 8, 2, 5952) > 0.45) { const e = TX.fbm(x * 2, y, 8, 2, 5953); img.set(x, y, TX.mix(C(glow[0]), C(glow[1]), e), 1); img.em[i] = 0.7 + e * 0.3; }
    });
    // log ends ring (right side columns)
    return img;
  };
  REC.campfire_log = () => campLog(false);
  REC.campfire_log_lit = () => campLog(true, [0xd8400a, 0xffd060]);
  REC.spirit_campfire_log_lit = () => campLog(true, [0x0a7ab0, 0x9af8ff]);

  // cauldron / composter / pots
  const CAUL = [0x1c1d21, 0x2a2c31, 0x3a3d44, 0x4c5058, 0x60646c];
  REC.cauldron_side = () => { const img = ironImg(CAUL, { rough: 0.5, brushed: false }); for (let x = 0; x < N; x++) for (const y of [3, 4]) img.mul(x, y, y === 3 ? 1.3 : 0.7); for (const x of [3, 28]) for (const y of [8, 22]) rivet(img, x, y, 0x6a6e76); return img; };
  REC.cauldron_inner = () => { const img = ironImg(CAUL.map(c => TX.scale(C(c), 0.7)), { rough: 0.6, brushed: false }); return img; };
  REC.cauldron_top = () => { const img = ironImg(CAUL, { rough: 0.4 }); frameRect(img, 0, 0, 31, 31, 0x6a6e76, { h: 0.95 }); frameRect(img, 4, 4, 27, 27, 0x121316, { h: 0.2 }); return img; };
  REC.cauldron_bottom = () => { const img = ironImg(CAUL, { rough: 0.5 }); for (let y = 6; y < 26; y += 5) for (let x = 6; x < 26; x += 5) rect(img, x, y, x + 1, y + 1, 0x0a0a0c, { h: 0.1 }); return img; };
  REC.composter_side = () => { const img = VPLANK('oak', { boards: 5, nails: false }); for (let y = 0; y < N; y++) for (const x of [6, 12, 19, 25]) { img.mul(x, y, 0.55); img.H(x, y, 0.2); } for (const y of [2, 3, 28, 29]) rect(img, 0, y, 31, y, (x) => TX.scale(C(0x6a4a24), y % 2 ? 0.8 : 1.1), { h: 0.95 }); return img; };
  REC.composter_top = () => { const img = PLANK('oak', { boards: 4 }); frameRect(img, 0, 0, 31, 31, 0x5a4224, { h: 0.95 }); return img; };
  REC.composter_bottom = () => { const img = PLANK('oak', { boards: 4 }); img.forEach((x, y) => img.mul(x, y, 0.75)); return img; };
  REC.composter_compost = () => { const img = TX.natural([0x2a1c10, 0x3e2a18, 0x543a22, 0x6a4a2a], { period: 8, oct: 3, seed: 6000, speck: 0.08, contrast: 1.4, rough: 0.98 }); for (let k = 0; k < 18; k++) { const x = Math.floor(hh(k, 1, 6001) * 31), y = Math.floor(hh(k, 2, 6001) * 31); img.set(x, y, C(k % 3 ? 0x4a6a2a : 0x8a6a3a)); img.set(x + 1, y, C(k % 3 ? 0x3a5a1a : 0x7a5a2a)); } return img; };
  REC.composter_ready = () => { const img = REC.composter_compost(); for (let k = 0; k < 40; k++) { const x = Math.floor(hh(k, 1, 6002) * 31), y = Math.floor(hh(k, 2, 6002) * 31); img.set(x, y, C(0xf0ece0)); img.em[y * N + x] = 0.1; } return img; };
  const TERRA = [0x7a3a1c, 0x9a4e28, 0xb86434, 0xcc7a46];
  REC.painted_pot_side = () => {
    const img = TX.natural(TERRA, { period: 4, oct: 2, seed: 6010, contrast: 0.8, rough: 0.9 });
    const ink = C(0x2a140a);
    // original motif: stacked waves + sun discs
    for (let x = 0; x < N; x++) { const y1 = Math.round(8 + Math.sin(x / N * Math.PI * 4) * 2), y2 = Math.round(22 + Math.sin(x / N * Math.PI * 4 + Math.PI) * 2); img.set(x, y1, ink); img.set(x, y1 + 1, ink); img.set(x, y2, ink); img.set(x, y2 + 1, ink); }
    for (const cx of [8, 24]) TX.disc(img, cx, 15.5, 2.6, () => ink);
    for (let x = 0; x < N; x++) { img.mul(x, 0, 1.15); img.mul(x, 31, 0.75); }
    return img;
  };
  REC.painted_pot_top = () => { const img = TX.natural(TERRA, { period: 4, oct: 2, seed: 6011, contrast: 0.8, rough: 0.9 }); TX.disc(img, 15.5, 15.5, 6, (d) => TX.scale(C(0x2a140a), 0.6 + d * 0.5)); return img; };
  REC.painted_pot_rim = () => { const img = TX.natural(TERRA.map(c => TX.scale(C(c), 1.1)), { period: 4, oct: 2, seed: 6012, contrast: 0.8 }); for (let x = 0; x < N; x++) img.mul(x, 31, 0.7); return img; };
  REC.painted_pot_rim_top = () => { const img = REC.painted_pot_rim(); TX.disc(img, 15.5, 15.5, 7, (d) => TX.scale(C(0x1a0c06), 0.6 + d * 0.4)); return img; };
  REC.flower_pot = () => { const img = TX.natural(TERRA, { period: 4, oct: 2, seed: 6020, contrast: 0.8, rough: 0.9 }); rect(img, 12, 12, 19, 19, noiseCol([0x2a1a0e, 0x3e2a18, 0x543a22], 6021, 8), { h: 0.3 }); for (let x = 0; x < N; x++) { img.mul(x, 20, 1.2); img.mul(x, 21, 1.1); img.mul(x, 22, 0.7); } return img; };

  // music, ladders, misc utility
  REC.jukebox_side = () => { const img = PLANK('jungle', { boards: 4 }); TX.bevel(img, 0, 0, N - 1, N - 1, 0.25, 0.3); TX.bevel(img, 3, 3, 28, 28, -0.12, -0.1); for (let a = 0; a < 16; a++) { const t = a / 16 * Math.PI * 2; img.set(Math.round(15.5 + Math.cos(t) * 5), Math.round(15.5 + Math.sin(t) * 5), C(0xd8b060)); } return img; };
  REC.jukebox_top = () => { const img = REC.jukebox_side(); rect(img, 6, 14, 25, 17, 0x100a06, { h: 0.05 }); frameRect(img, 5, 13, 26, 18, 0x9aa0a8, { h: 0.9, ro: 0.3 }); return img; };
  REC.note_block = () => { const img = PLANK('jungle', { boards: 4 }); TX.bevel(img, 0, 0, N - 1, N - 1, 0.25, 0.3); for (let y = 7; y < 26; y += 3) for (let x = 7; x < 26; x += 3) if (Math.hypot(x - 16, y - 16) < 10) rect(img, x, y, x + 1, y + 1, 0x140c06, { h: 0.1 }); return img; };
  REC.ladder = () => {
    const img = TX.sprite(), P = TX.pal(WOOD.oak.planks, 6);
    for (let y = 0; y < N; y++) for (const x0 of [3, 26]) for (let x = x0; x < x0 + 3; x++) { img.set(x, y, TX.ramp(P, cl(0.3 + (x - x0) * 0.2 + hh(x, y, 1) * 0.1)), 1); img.H(x, y, 0.8); }
    for (const y0 of [3, 11, 19, 27]) for (let y = y0; y < y0 + 2; y++) for (let x = 5; x < 27; x++) { img.set(x, y, TX.ramp(P, cl(y === y0 ? 0.75 : 0.45 + hh(x, y, 2) * 0.1)), 1); img.H(x, y, 0.9); }
    for (const y0 of [3, 11, 19, 27]) for (const x of [4, 27]) img.set(x, y0, C(0x9aa0a8));
    return img;
  };
  REC.lodestone_side = () => { const img = TX.bricks(PAL.andesite, 0x3a3a3c, { rows: 2, per: 1, seed: 6100 }); for (const y of [5, 6, 25, 26]) rect(img, 0, y, 31, y, (x) => TX.scale(C(0x6a6e76), y % 2 ? 0.75 : 1.1), { h: 0.9, ro: 0.3 }); return img; };
  REC.lodestone_top = () => { const img = TX.polished(PAL.andesite, { seed: 6101 }); TX.disc(img, 15.5, 15.5, 7, (d) => d > 0.7 ? C(0x5a5e66) : TX.scale(C(0x3a3c42), 0.8 + d * 0.3)); rect(img, 11, 14, 20, 17, (x) => x < 16 ? C(0xc82a2a) : C(0x3a6ac8), { h: 0.9, ro: 0.3 }); return img; };
  REC.monster_cage = () => { const img = TX.sprite(); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const bx = x % 8 < 2, by = y % 8 < 2; if (bx || by) { img.set(x, y, TX.scale(C(0x2a2e36), (bx && by) ? 1.4 : (x % 8 === 0 || y % 8 === 0) ? 1.15 : 0.8), 1); img.ro[y * N + x] = 0.4; img.H(x, y, 0.8); } } return img; };
  REC.void_frame_side = () => { const img = REC.voidstone(); for (let x = 0; x < N; x++) for (const y of [6, 7]) { img.set(x, y, TX.scale(C(0x2a7a6a), y === 6 ? 1.2 : 0.8)); } for (let x = 0; x < N; x++) for (let y = 0; y < 6; y++) img.blend(x, y, C(0x3a5a4a), 0.5); return img; };
  REC.void_frame_top = () => { const img = REC.voidstone(); img.forEach((x, y) => img.blend(x, y, C(0x2a5a4a), 0.55)); TX.disc(img, 15.5, 15.5, 8, (d) => d > 0.75 ? C(0x3af0c0) : TX.scale(C(0x0a1a18), 0.8 + d * 0.3)); for (let i = 0; i < N * N; i++) if (img.c[i * 4 + 1] > 0.8) img.em[i] = 0.8; return img; };
  REC.void_frame_eye = () => { const img = new TX.Img(); img.forEach((x, y, i) => { const d = Math.hypot(x - 15.5, y - 15.5) / 16; img.set(x, y, TX.mix(C(0xc8fff0), C(0x1a8a70), Math.min(1, d * 1.5)), 1); img.em[i] = 1 - d * 0.5; img.ro[i] = 0.05; if (Math.abs(x - 15.5) < 1.5 && Math.abs(y - 15.5) < 5) { img.set(x, y, C(0x051a14)); img.em[i] = 0; } }); return img; };
  const BAMB = [0x6a7a1a, 0x9aa82a, 0xc8c84a, 0xe8e070];
  REC.scaffolding_side = () => { const img = TX.sprite(), P = TX.pal(BAMB, 5); const bar = (x, y, v) => { img.set(x, y, TX.ramp(P, cl(v)), 1); img.H(x, y, 0.8); }; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { if (x < 3 || x > 28) bar(x, y, 0.3 + (x % 29 === 0 ? 0.4 : 0.2) + (y % 8 === 0 ? -0.2 : 0)); else if (y < 3 || y > 28) bar(x, y, 0.6 - (y % 29 === 0 ? 0 : 0.2)); else if (Math.abs(x - y) < 1.5) bar(x, y, 0.5); } return img; };
  REC.scaffolding_top = () => { const img = REC.scaffolding_side(); const P = TX.pal(BAMB, 5); for (let y = 3; y < 29; y++) if (y % 6 < 4) for (let x = 3; x < 29; x++) { img.set(x, y, TX.ramp(P, cl(0.5 + (y % 6 === 0 ? 0.25 : 0) - (y % 6 === 3 ? 0.2 : 0) + hh(x, y, 5) * 0.1)), 1); img.H(x, y, 0.7); } return img; };
  REC.scaffolding_bottom = () => { const img = REC.scaffolding_side(); clearRect(img, 3, 3, 28, 28); return img; };
  REC.shelf_back = () => { const img = VPLANK('oak', { boards: 4 }); img.forEach((x, y) => img.mul(x, y, 0.82)); return img; };
  REC.sponge = () => { const img = TX.natural([0x8a7a1a, 0xc0b030, 0xd8c848, 0xe8dc6a], { period: 4, oct: 2, seed: 6200, contrast: 1, rough: 0.95 }); img.forEach((x, y, i) => { const c = TX.cells(x, y, 6, 6201); if (c[0] < 0.22) { img.mul(x, y, 0.45); img.h[i] = 0.1; } }); return img; };
  REC.wet_sponge = () => { const img = TX.natural([0x5a5a1a, 0x8a882a, 0xa8a43a, 0xbcb850], { period: 4, oct: 2, seed: 6202, contrast: 1, rough: 0.35 }); img.forEach((x, y, i) => { const c = TX.cells(x, y, 6, 6201); if (c[0] < 0.25) { img.mul(x, y, 0.4); img.h[i] = 0.1; } }); return img; };

  // explosives (original bundle design: sticks + hazard strap)
  const stick = (img, x0, w, pal, s) => { const P = TX.pal(pal, 5); for (let x = x0; x < x0 + w; x++) for (let y = 0; y < N; y++) { img.set(x, y, TX.ramp(P, cl(0.25 + (x - x0) / w * 0.6 - (x === x0 + w - 1 ? 0.3 : 0) + hh(x, y, s) * 0.08)), 1); img.H(x, y, 0.5 + Math.sin((x - x0 + 0.5) / w * Math.PI) * 0.4); img.ro[y * N + x] = 0.7; } };
  const hazard = (img, y0, y1, a, b) => { for (let y = y0; y <= y1; y++) for (let x = 0; x < N; x++) { img.set(x, y, ((x + y) % 8 < 4) ? K(a) : K(b), 1); img.H(x, y, y === y0 || y === y1 ? 0.6 : 0.9); img.ro[y * N + x] = 0.45; } };
  REC.tnt_side = () => { const img = new TX.Img(); for (let k = 0; k < 4; k++) stick(img, k * 8, 8, [0x6a0e0a, 0xa8201a, 0xd83a2a, 0xf06a50], 6300 + k); hazard(img, 12, 19, 0xf0c020, 0x1a1a1a); for (let x = 0; x < N; x++) { img.mul(x, 11, 0.6); img.mul(x, 20, 0.6); } return img; };
  const stickEnds = (fuse) => { const img = new TX.Img(); img.forEach((x, y, i) => { img.set(x, y, C(0x1a0a08), 1); img.h[i] = 0.1; }); for (let gy = 0; gy < 4; gy++) for (let gx = 0; gx < 4; gx++) TX.disc(img, gx * 8 + 4, gy * 8 + 4, 3.6, (d) => d > 0.7 ? C(0xa8201a) : TX.mix(C(0xe8dcc0), C(0xb8a888), d)); if (fuse) { rect(img, 15, 13, 16, 18, 0x5a4a3a, { h: 1 }); rect(img, 15, 12, 16, 12, 0xd8d0c0, { h: 1 }); } return img; };
  REC.tnt_top = () => stickEnds(true);
  REC.tnt_bottom = () => stickEnds(false);
  REC.depth_charge_side = () => { const img = TX.metal([0x0e3a44, 0x1a5a66, 0x2a7a86, 0x3a9aa6], { rough: 0.3 }); hazard(img, 12, 19, 0xf0c020, 0x1a1a1a); for (const y of [3, 28]) for (let x = 2; x < 30; x += 4) rivet(img, x, y); return img; };
  REC.depth_charge_top = () => { const img = TX.metal([0x0e3a44, 0x1a5a66, 0x2a7a86, 0x3a9aa6], { rough: 0.3 }); TX.disc(img, 15.5, 15.5, 5, (d) => d > 0.6 ? C(0xf0c020) : C(0x2a2a2a)); rect(img, 14, 14, 17, 17, 0xe83a1a, { em: 0.6 }); return img; };

  // ============================ VOLT (logic) ============================
  REC.lever = () => { const img = TX.sprite(); rect(img, 14, 12, 17, 31, (x, y) => TX.scale(C(0x7a5a34), 0.8 + (x - 14) * 0.1), { h: 0.85 }); rect(img, 14, 12, 17, 16, (x, y) => TX.scale(C(0x9aa0a8), 0.9 + (y === 12 ? 0.3 : 0) - (x === 17 ? 0.25 : 0)), { h: 0.95, ro: 0.3 }); return img; };
  // wires are grayscale (tinted by power in the mesher)
  REC.wire_dot = () => { const img = TX.sprite(); img.forEach((x, y, i) => { const d = Math.hypot(x - 15.5, y - 15.5) + (TX.fbm(x, y, 8, 2, 6400) - 0.5) * 5; if (d < 6.5) { const v = 0.75 + hh(x, y, 6401) * 0.25; img.set(x, y, [v, v, v], 1); img.h[i] = 0.55; img.ro[i] = 0.6; } }); return img; };
  REC.wire_line = () => { const img = TX.sprite(); img.forEach((x, y, i) => { const d = Math.abs(x - 15.5) + (TX.fbm(x, y, 8, 2, 6402) - 0.5) * 3; if (d < 3.6) { const v = 0.75 + hh(x, y, 6403) * 0.25; img.set(x, y, [v, v, v], 1); img.h[i] = 0.55; img.ro[i] = 0.6; } }); return img; };
  REC.wire_line_overlay = () => { const img = TX.sprite(); img.forEach((x, y, i) => { if (Math.abs(x - 15.5) < 1.2) { img.set(x, y, [1, 1, 1], 1); } }); return img; };
  const voltLamp = (on) => {
    const img = new TX.Img();
    img.forEach((x, y, i) => {
      const c = TX.cells(x, y, 4, 6410), f = 1 - c[0];
      if (on) { img.set(x, y, TX.mix(C(0xd87a2a), C(0xfff2c0), cl(f * 1.2)), 1); img.em[i] = 0.7 + f * 0.3; }
      else { img.set(x, y, TX.mix(C(0x2a120a), C(0x6a3a1a), cl(f)), 1); }
      if (c[1] - c[0] < 0.1) { img.set(x, y, on ? C(0xffc870) : C(0x1a0c06)); img.h[i] = 0.3; if (on) img.em[i] = 1; }
      img.ro[i] = 0.25;
    });
    frameRect(img, 0, 0, 31, 31, 0x5a3a24, { h: 0.95, em: 0, ro: 0.8 }); frameRect(img, 1, 1, 30, 30, 0x3a2414, { h: 0.7, em: 0, ro: 0.8 });
    for (const [x, y] of [[0, 0], [30, 0], [0, 30], [30, 30]]) rect(img, x, y, x + 1, y + 1, 0x9aa0a8, { em: 0 });
    return img;
  };
  REC.volt_lamp = () => voltLamp(false);
  REC.volt_lamp_on = () => voltLamp(true);
  const slabTop = (s) => { const img = REC.smooth_stone ? REC.smooth_stone() : TX.polished(SMOOTH, { seed: s }); for (let y = 28; y < N; y++) for (let x = 0; x < N; x++) img.mul(x, y, y === 28 ? 1.15 : 0.82); return img; };
  const trace = (img, pts, on) => { for (let k = 0; k < pts.length - 1; k++) TX.line(img, pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], (x, y) => { for (const [dx, dy] of [[0, 0], [1, 0]]) { img.set(x + dx, y + dy, on ? C(0xff4a2a) : C(0x5a1a12)); img.H(x + dx, y + dy, 0.55); if (on) img.em[(y + dy) * N + x + dx] = 1; } }); };
  const repeaterTex = (on) => { const img = slabTop(6420); trace(img, [[15, 3], [15, 26]], on); for (const y of [3, 4]) rect(img, 13, y, 18, y, on ? 0xff6a4a : 0x5a1a12, { em: on ? 1 : 0 }); rect(img, 12, 26, 19, 26, on ? 0xff6a4a : 0x5a1a12, { em: on ? 1 : 0 }); for (let y = 14; y < 26; y += 2) img.set(21, y, C(0x9a9ca2)); return img; };
  REC.repeater = () => repeaterTex(false);
  REC.repeater_on = () => repeaterTex(true);
  const comparatorTex = (on) => { const img = slabTop(6421); trace(img, [[9, 24], [9, 14], [15, 8], [15, 3]], on); trace(img, [[21, 24], [21, 14], [16, 8]], on); rect(img, 12, 16, 19, 20, (x, y) => on ? C(0xffd060) : C(0x3a3a2a), { h: 0.4, em: on ? 0.8 : 0 }); return img; };
  REC.comparator = () => comparatorTex(false);
  REC.comparator_on = () => comparatorTex(true);
  const obsBase = (s) => { const img = machineStone(s, [0x3a3c40, 0x4c4e53, 0x5e6066, 0x707278]); return img; };
  REC.observer_side = () => { const img = obsBase(6430); for (let x = 3; x < 29; x++) for (const y of [8, 23]) { img.set(x, y, C(0x2a2c30)); img.H(x, y, 0.2); } TX.line(img, 8, 15, 23, 15, (x, y) => { img.set(x, y, C(0x9a3a2a)); }); TX.line(img, 19, 11, 23, 15, (x, y) => img.set(x, y, C(0x9a3a2a))); TX.line(img, 19, 19, 23, 15, (x, y) => img.set(x, y, C(0x9a3a2a))); return img; };
  REC.observer_top = () => { const img = obsBase(6431); for (let y = 3; y < 29; y++) for (const x of [8, 23]) { img.set(x, y, C(0x2a2c30)); img.H(x, y, 0.2); } TX.line(img, 15, 8, 15, 23, (x, y) => img.set(x, y, C(0x9a3a2a))); return img; };
  REC.observer_front = () => { const img = obsBase(6432); rect(img, 4, 8, 27, 23, (x, y) => TX.scale(C(0x1a1b1e), 0.9 + ((x + y) % 2) * 0.1), { h: 0.2 }); TX.disc(img, 15.5, 15.5, 6.5, (d) => d > 0.8 ? C(0x9aa0a8) : d > 0.45 ? TX.mix(C(0x1a4a6a), C(0x3a9ad0), 1 - d) : C(0x050a10)); rect(img, 13, 13, 14, 14, 0xe0f4ff, { em: 0.6 }); return img; };
  const obsBack = (on) => { const img = obsBase(6433); frameRect(img, 6, 6, 25, 25, 0x2a2c30, { h: 0.2 }); TX.disc(img, 15.5, 15.5, 4, (d) => on ? TX.mix(C(0xffd0c0), C(0xe82a1a), d) : TX.mix(C(0x5a2a22), C(0x2a100c), d)); if (on) for (let i = 0; i < N * N; i++) if (img.c[i * 4] > 0.8 && img.c[i * 4 + 1] < 0.85) img.em[i] = 1; return img; };
  REC.observer_back = () => obsBack(false);
  REC.observer_back_on = () => obsBack(true);
  // pistons
  const pistonFace = (sticky) => { const img = PLANK('oak', { boards: 4 }); frameRect(img, 0, 0, 31, 31, 0x8a8e96, { h: 0.95, ro: 0.3 }); frameRect(img, 1, 1, 30, 30, 0x6a6e76, { h: 0.85, ro: 0.3 }); for (const [x, y] of [[2, 2], [28, 2], [2, 28], [28, 28]]) rivet(img, x, y); if (sticky) { rect(img, 6, 6, 25, 25, (x, y) => TX.mix(C(0x5ac84a), C(0x9af07a), TX.fbm(x, y, 8, 2, 6440)), { h: 0.9, ro: 0.1 }); } return img; };
  REC.piston_top = () => pistonFace(false);
  REC.piston_top_sticky = () => pistonFace(true);
  REC.piston_side = () => { const img = TX.natural(PAL.stone, { period: 4, oct: 2, seed: 6441, contrast: 0.9 }); const top = PLANK('oak', { boards: 1 }); for (let y = 0; y < 8; y++) for (let x = 0; x < N; x++) { img.set(x, y, top.get(x, y * 4)); img.H(x, y, 0.8); } for (const y of [8, 9]) rect(img, 0, y, 31, y, y === 8 ? 0x8a8e96 : 0x4a4e56, { h: 0.9, ro: 0.3 }); TX.bevel(img, 0, 10, 31, 31, 0.12, 0.2); return img; };
  REC.piston_bottom = () => { const img = machineStone(6442); rect(img, 8, 8, 23, 23, (x, y) => TX.scale(C(0x6a6e76), 0.85 + hh(x, y, 1) * 0.1), { h: 0.85, ro: 0.35 }); return img; };
  REC.piston_inner = () => { const img = machineStone(6443); rect(img, 12, 12, 19, 19, (x, y) => TX.scale(C(0x9a7a4a), 0.9 + hh(x, y, 2) * 0.1), { h: 0.9 }); frameRect(img, 11, 11, 20, 20, 0x2a2a2a, { h: 0.1 }); return img; };
  // dispenser / dropper
  const nozzle = (big) => { const img = furnaceSide(SMOOTH, big ? 6450 : 6451); if (big) { TX.disc(img, 15.5, 15.5, 7, (d) => d > 0.72 ? C(0x7a7e86) : TX.scale(C(0x0a0a0c), 0.6 + d * 0.5)); } else { rect(img, 10, 10, 21, 21, 0x7a7e86, { h: 0.9, ro: 0.3 }); rect(img, 12, 12, 19, 19, (x, y) => TX.scale(C(0x0a0a0c), 0.7 + (y - 12) * 0.04), { h: 0.05 }); } return img; };
  REC.dispenser_front = () => { const img = nozzle(true); rect(img, 9, 25, 22, 26, 0x2a2a2e, { h: 0.2 }); return img; };
  REC.dispenser_front_vertical = () => { const img = furnaceTop(SMOOTH, 6452); TX.disc(img, 15.5, 15.5, 7, (d) => d > 0.72 ? C(0x7a7e86) : TX.scale(C(0x0a0a0c), 0.6 + d * 0.5)); return img; };
  REC.dropper_front = () => nozzle(false);
  REC.dropper_front_vertical = () => { const img = furnaceTop(SMOOTH, 6453); rect(img, 10, 10, 21, 21, 0x7a7e86, { h: 0.9 }); rect(img, 12, 12, 19, 19, 0x0a0a0c, { h: 0.05 }); return img; };
  // hopper
  REC.hopper_outside = () => { const img = ironImg(CAUL, { rough: 0.45 }); for (let y = 0; y < N; y++) for (const x of [7, 8, 23, 24]) img.mul(x, y, x % 2 ? 0.75 : 1.15); return img; };
  REC.hopper_inside = () => ironImg(CAUL.map(c => TX.scale(C(c), 0.6)), { rough: 0.6 });
  REC.hopper_top = () => { const img = ironImg(CAUL, { rough: 0.4 }); rect(img, 4, 4, 27, 27, 0x0a0a0c, { h: 0.05 }); for (let x = 6; x < 27; x += 5) rect(img, x, 4, x + 1, 27, 0x4c5058, { h: 0.7 }); frameRect(img, 3, 3, 28, 28, 0x6a6e76, { h: 0.9 }); return img; };
  // target, daylight detector
  const STRAW = [0xa8904a, 0xc8b060, 0xdcc87a, 0xece0a0];
  const targetTex = (s) => { const img = TX.natural(STRAW, { period: 8, oct: 2, seed: s, stretchY: 0.25, contrast: 1.2, rough: 0.95 }); TX.disc(img, 15.5, 15.5, 13, (d, x, y) => { const b = img.get(x, y); return d > 0.8 ? TX.mix(b, C(0xd02a2a), 0.85) : d > 0.6 ? TX.mix(b, C(0xf2eee0), 0.8) : d > 0.36 ? TX.mix(b, C(0xd02a2a), 0.85) : d > 0.18 ? TX.mix(b, C(0xf2eee0), 0.8) : C(0xd02a2a); }); return img; };
  REC.target_side = () => targetTex(6460);
  REC.target_top = () => targetTex(6461);
  REC.daylight_detector_side = () => { const img = PLANK('oak', { boards: 8 }); for (let x = 0; x < N; x++) img.mul(x, 20, 1.2); return img; };
  const solar = (inv) => { const img = TX.polished(PAL.quartz, { seed: 6470 }); for (let gy = 0; gy < 2; gy++) for (let gx = 0; gx < 3; gx++) { const x0 = 3 + gx * 9, y0 = 4 + gy * 13; rect(img, x0, y0, x0 + 7, y0 + 10, (x, y) => { const f = ((x - x0) + (y - y0)) / 18; return inv ? TX.mix(C(0x3a1a5a), C(0x7a4ab0), f) : TX.mix(C(0x1a3a7a), C(0x5aa0e8), f); }, { h: 0.6, ro: 0.08 }); for (let y = y0; y <= y0 + 10; y += 3) rect(img, x0, y, x0 + 7, y, inv ? 0x2a0a4a : 0x0a2a5a, {}); } return img; };
  REC.daylight_detector_top = () => solar(false);
  REC.daylight_detector_inverted_top = () => solar(true);
  // iron door / trapdoor
  const IRONP = [0x7a7e86, 0x9a9ea6, 0xb8bcc4, 0xd4d8de, 0xeceef2];
  REC.iron_door_bottom = () => { const img = ironImg(IRONP, { rough: 0.3 }); TX.bevel(img, 4, 2, 27, 29, 0.12, 0.15); for (const y of [4, 27]) for (const x of [6, 24]) rivet(img, x, y); rect(img, 4, 14, 27, 15, (x, y) => TX.scale(C(0x6a6e76), y === 14 ? 1.2 : 0.7), { h: 0.9 }); return img; };
  REC.iron_door_top = () => { const img = ironImg(IRONP, { rough: 0.3 }); TX.bevel(img, 4, 2, 27, 29, 0.12, 0.15); clearRect(img, 7, 6, 14, 20); clearRect(img, 17, 6, 24, 20); frameRect(img, 6, 5, 15, 21, 0x6a6e76, { h: 0.9 }); frameRect(img, 16, 5, 25, 21, 0x6a6e76, { h: 0.9 }); return img; };
  REC.iron_trapdoor = () => { const img = ironImg(IRONP, { rough: 0.3 }); for (let gy = 0; gy < 3; gy++) for (let gx = 0; gx < 2; gx++) { const x0 = 5 + gx * 12, y0 = 4 + gy * 9; clearRect(img, x0, y0, x0 + 9, y0 + 5); } TX.bevel(img, 0, 0, N - 1, N - 1, 0.2, 0.3); return img; };
  // slime & honey
  REC.slime_block = () => { const img = new TX.Img(); img.forEach((x, y, i) => { const inner = x >= 6 && x <= 25 && y >= 6 && y <= 25; const edge = x === 6 || x === 25 || y === 6 || y === 25; const f = TX.fbm(x, y, 4, 2, 6480); img.set(x, y, edge ? C(0x3a9a3a) : inner ? TX.mix(C(0x6ad05a), C(0x9af07a), f) : TX.mix(C(0x7ae06a), C(0xb0ff9a), f), inner || edge ? 0.85 : 0.6); img.ro[i] = 0.08; img.h[i] = inner ? 0.7 : 0.5; }); TX.bevel(img, 0, 0, N - 1, N - 1, 0.1, 0.2); return img; };
  const honey = (top) => { const img = new TX.Img(); img.forEach((x, y, i) => { const c = TX.cells(x, y, 4, 6490); const f = TX.fbm(x, y, 4, 2, 6491); const inner = x >= 3 && x <= 28 && y >= 3 && y <= 28; img.set(x, y, TX.mix(C(0xd8801a), C(0xffc84a), cl(f * 0.6 + (1 - c[0]) * 0.4)), inner ? 0.82 : 0.95); if (!inner) img.mul(x, y, 0.8); img.ro[i] = 0.06; img.h[i] = inner ? 0.6 + (1 - c[0]) * 0.2 : 0.4; }); if (top) TX.bevel(img, 3, 3, 28, 28, 0.08, 0.1); return img; };
  REC.honey_block_top = () => honey(true);
  REC.honey_block_side = () => honey(false);
  // rails
  const railBase = (railPal, center) => {
    const img = TX.sprite(), W = TX.pal(WOOD.oak.planks.map(c => TX.scale(C(c), 0.8)), 5), R = TX.pal(railPal, 5);
    for (const y0 of [1, 9, 17, 25]) for (let y = y0; y < y0 + 4; y++) for (let x = 2; x < 30; x++) { img.set(x, y, TX.ramp(W, cl(0.35 + (y === y0 ? 0.3 : y === y0 + 3 ? -0.25 : 0) + hh(x, y, 7) * 0.12)), 1); img.H(x, y, 0.5); }
    if (center) center(img);
    for (let y = 0; y < N; y++) for (const x0 of [4, 25]) for (let x = x0; x < x0 + 3; x++) { img.set(x, y, TX.ramp(R, cl(0.25 + (x - x0) * 0.3)), 1); img.H(x, y, 0.95); img.ro[y * N + x] = 0.3; img.em[y * N + x] = 0; }
    return img;
  };
  REC.rail = () => railBase(IRON);
  REC.rail_corner = () => {
    const img = TX.sprite(), W = TX.pal(WOOD.oak.planks.map(c => TX.scale(C(c), 0.8)), 5), R = TX.pal(IRON, 5);
    for (let k = 0; k < 5; k++) { const a = (k + 0.5) / 5 * Math.PI / 2; for (let r = 2; r < 31; r++) for (let w = -1.5; w <= 1.5; w += 0.5) { const x = Math.round(32 - Math.cos(a) * r - Math.sin(a) * w), y = Math.round(32 - Math.sin(a) * r + Math.cos(a) * w); if (x >= 0 && y >= 0 && x < N && y < N) { img.set(x, y, TX.ramp(W, cl(0.4 + hh(x, y, 3) * 0.2)), 1); img.H(x, y, 0.5); } } }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const d = Math.hypot(32 - x - 0.5, 32 - y - 0.5); for (const r0 of [26, 5]) if (d >= r0 - 0.5 && d < r0 + 2.5) { img.set(x, y, TX.ramp(R, cl((d - r0 + 0.5) / 3 * 0.8 + 0.1)), 1); img.H(x, y, 0.95); img.ro[y * N + x] = 0.3; } }
    return img;
  };
  const railCenter = (off, on, style) => (img) => {
    for (let y = 0; y < N; y++) for (let x = 12; x < 20; x++) {
      if (style === 'plate' && (y < 8 || y > 23)) continue;
      if (style === 'stripes' && y % 8 >= 4) continue;
      const c = on ? K(on) : K(off);
      img.set(x, y, TX.scale(c, 0.85 + hh(x, y, 11) * 0.15 + (x === 12 ? 0.15 : x === 19 ? -0.2 : 0)), 1); img.H(x, y, 0.6);
      if (on) img.em[y * N + x] = 0.9;
    }
  };
  REC.powered_rail = () => railBase(GOLDM, railCenter(0x4a1a12, 0, 'line'));
  REC.powered_rail_on = () => railBase(GOLDM, railCenter(0x4a1a12, 0xff3a1a, 'line'));
  REC.detector_rail = () => railBase(IRON, railCenter(0x6a6e76, 0, 'plate'));
  REC.detector_rail_on = () => { const img = railBase(IRON, railCenter(0x6a6e76, 0, 'plate')); rect(img, 14, 14, 17, 17, 0xff3a1a, { em: 1 }); return img; };
  REC.activator_rail = () => railBase(IRON, railCenter(0x5a1a12, 0, 'stripes'));
  REC.activator_rail_on = () => railBase(IRON, railCenter(0x5a1a12, 0xff5a2a, 'stripes'));
  REC.tripwire_hook = () => ironImg(IRON, { rough: 0.3 });

  // ============================ CREATIVE / LAB ============================
  REC.barrier = () => { const img = TX.sprite(); TX.disc(img, 15.5, 15.5, 13, (d) => d > 0.78 ? C(0xe82a2a) : null); TX.line(img, 7, 7, 24, 24, (x, y) => { rect(img, x, y, x + 2, y + 2, 0xe82a2a, {}); }); for (let i = 0; i < N * N; i++) if (img.c[i * 4 + 3] > 0.5) img.em[i] = 0.6; return img; };
  REC.light_block = () => { const img = TX.sprite(); TX.disc(img, 15.5, 12, 8, (d) => TX.mix(C(0xffffe0), C(0xffd040), d)); rect(img, 12, 20, 19, 26, (x, y) => y % 2 ? C(0x9aa0a8) : C(0x6a6e76), {}); for (let i = 0; i < N * N; i++) if (img.c[i * 4 + 3] > 0.5 && img.c[i * 4 + 2] < 0.9 && img.c[i * 4] > 0.9) img.em[i] = 1; return img; };
  REC.border_block = () => { const img = TX.sprite(); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { if ((x + y) % 8 < 2 || x < 1 || y < 1 || x > 30 || y > 30) { img.set(x, y, C(0x3af0ff), 1); img.em[y * N + x] = 1; } } return img; };
  REC.heat_block = () => { const img = ironImg(DARKIRON, { rough: 0.4 }); for (let y = 4; y < 28; y += 6) rect(img, 4, y, 27, y + 1, (x) => TX.mix(C(0xff6a1a), C(0xffd060), hh(x, y, 3)), { em: 1, h: 0.4, ro: 0.5 }); for (let x = 4; x < 28; x += 23) rect(img, x, 4, x + 1, 27, 0xff8a2a, { em: 1 }); return img; };
  PRE.logic_block = (mode) => {
    const col = { impulse: [0x8a4a1a, 0xc87a3a, 0xf0a860], repeat: [0x4a2a8a, 0x7a4ac8, 0xb08af0], chain: [0x1a6a4a, 0x3aa87a, 0x7ae0b0] }[mode];
    const img = TX.metal(col, { rough: 0.35, rivets: true });
    rect(img, 7, 7, 24, 24, (x, y) => TX.scale(C(0x0a0e14), 0.9 + ((y % 2) * 0.1)), { h: 0.3, ro: 0.1 });
    // arrow glyph (points up)
    const glow = C(col[2]);
    for (let y = 10; y < 22; y++) rect(img, 15, y, 16, y, glow, { em: 1 });
    for (let k = 0; k < 5; k++) { img.set(15 - k, 10 + k, glow); img.set(16 + k, 10 + k, glow); img.em[(10 + k) * N + 15 - k] = 1; img.em[(10 + k) * N + 16 + k] = 1; }
    if (mode === 'repeat') for (let k = 0; k < 6; k++) { img.set(10 + k, 22, glow); img.em[22 * N + 10 + k] = 1; }
    // circuit traces
    for (const [x0, y0, x1, y1] of [[2, 16, 6, 16], [25, 16, 29, 16], [16, 2, 16, 6], [16, 25, 16, 29]]) TX.line(img, x0, y0, x1, y1, (x, y) => { img.set(x, y, TX.mix(glow, [1, 1, 1], 0.2)); img.em[y * N + x] = 0.6; });
    return img;
  };
})(VR);

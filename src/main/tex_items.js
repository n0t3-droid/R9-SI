// ============================================================================
// Item sprite recipes (32x32, chunky pixel-art from vector primitives) +
// block-break crack stages. Registered via R.tex in shared/items.js.
// ============================================================================
(function (VR) {
  'use strict';
  const TX = VR.TX, N = TX.N, C = TX.C, REC = VR.TEXREC, PRE = VR.TEXPRE, hh = TX.hash;
  const K = (c) => typeof c === 'number' ? C(c) : c;
  const cl = (v) => v < 0 ? 0 : v > 1 ? 1 : v;
  // ---------------- primitives (operate on a 16x16 logical grid, 2x2 texels each) ----------------
  function px(img, x, y, c, em) { if (x < 0 || y < 0 || x > 15 || y > 15) return; const cc = K(c); for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) { img.set(x * 2 + dx, y * 2 + dy, cc, 1); img.H(x * 2 + dx, y * 2 + dy, 0.7); if (em) img.em[(y * 2 + dy) * N + x * 2 + dx] = em; } }
  function poly(img, pts, colFn, em) {
    // fill polygon on 16-grid (pixel centers)
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const X = x + 0.5, Y = y + 0.5; let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if (((yi > Y) !== (yj > Y)) && (X < (xj - xi) * (Y - yi) / (yj - yi) + xi)) inside = !inside;
      }
      if (inside) { const c = typeof colFn === 'function' ? colFn(x, y) : colFn; if (c) px(img, x, y, c, em); }
    }
  }
  function circ(img, cx, cy, r, colFn, em) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy); if (d <= r) { const c = typeof colFn === 'function' ? colFn(x, y, d / r) : colFn; if (c) px(img, x, y, c, em); } } }
  function lineP(img, x0, y0, x1, y1, colFn, em) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2 + 1;
    for (let i = 0; i <= n; i++) { const t = i / n; const x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t); const c = typeof colFn === 'function' ? colFn(t, x, y) : colFn; if (c) px(img, x, y, c, em); }
  }
  const shade = (c, k) => TX.scale(K(c), k);
  const lighten = (c, k) => TX.mix(K(c), [1, 1, 1], k);
  function outline(img) { TX.outline(img, 0.45); }
  const sprite = () => TX.sprite();
  const ramp3 = (c) => (x, y) => shade(c, 0.78 + ((15 - y) + x) / 30 * 0.45);

  // ---------------- material generators ----------------
  const ingot = (c) => { const img = sprite(); poly(img, [[2, 10], [5, 6], [14, 6], [12, 10], [2, 10], [2, 13], [12, 13], [14, 9], [14, 6]], (x, y) => y < 7 ? lighten(c, 0.35) : y > 10 ? shade(c, 0.7) : K(c)); outline(img); for (let i = 0; i < N * N; i++) img.ro[i] = 0.25; return img; };
  const gem = (c) => { const img = sprite(); poly(img, [[8, 2], [14, 7], [8, 14], [2, 7]], (x, y) => (x < 8 ? (y < 7 ? lighten(c, 0.5) : K(c)) : (y < 7 ? K(c) : shade(c, 0.6)))); px(img, 6, 5, [1, 1, 1]); outline(img); for (let i = 0; i < N * N; i++) img.ro[i] = 0.1; return img; };
  const raw = (c) => { const img = sprite(); circ(img, 8, 9, 5.5, (x, y, d) => (hh(x, y, 3) < 0.25 ? shade(c, 0.55) : d < 0.5 ? lighten(c, 0.2) : K(c))); outline(img); return img; };
  const dust = (c, glow) => { const img = sprite(); for (let k = 0; k < 26; k++) { const a = hh(k, 1, 7) * 6.28, r = Math.sqrt(hh(k, 2, 7)) * 5.5; px(img, Math.round(8 + Math.cos(a) * r), Math.round(10 + Math.sin(a) * r * 0.55), k % 3 ? K(c) : lighten(c, 0.4), glow); } return img; };
  const shard = (c, glow) => { const img = sprite(); poly(img, [[7, 1], [11, 6], [9, 15], [5, 13], [4, 6]], (x, y) => x < 7 ? lighten(c, 0.4) : K(c), glow); outline(img); return img; };
  const nugget = (c) => { const img = sprite(); circ(img, 8, 10, 3.5, (x, y, d) => d < 0.5 ? lighten(c, 0.35) : K(c)); circ(img, 11, 7, 2, K(c)); outline(img); return img; };
  const ball = (c, glow) => { const img = sprite(); circ(img, 8, 8.5, 5.5, (x, y, d) => (x + y < 13 && d < 0.6) ? lighten(c, 0.45) : d > 0.8 ? shade(c, 0.75) : K(c), glow); outline(img); return img; };
  const stickImg = (c) => { const img = sprite(); lineP(img, 3, 13, 12, 3, (t) => t < 0.5 ? shade(c || 0x7a5a30, 0.9) : K(c || 0x9a7040)); lineP(img, 4, 13, 13, 3, shade(c || 0x6a4a24, 0.7)); outline(img); return img; };

  // ---------------- tools ----------------
  const HANDLE = 0x7a5a30;
  function tool(type, mat) {
    const T = VR.TOOL_TIERS[mat], c = T ? T.color : 0xaaaaaa;
    const img = sprite();
    const head = (x, y) => (x + y) % 5 === 0 ? lighten(c, 0.35) : K(c);
    if (type === 'sword') {
      lineP(img, 3, 12, 13, 2, (t) => t < 0.2 ? null : lighten(c, 0.2 + t * 0.2)); lineP(img, 4, 12, 14, 2, (t) => t < 0.2 ? null : shade(c, 0.8));
      lineP(img, 2, 10, 6, 14, shade(0x5a4a3a, 1)); lineP(img, 1, 14, 3, 12, HANDLE); px(img, 1, 14, shade(HANDLE, 0.7));
    } else {
      lineP(img, 2, 14, 11, 5, HANDLE); lineP(img, 3, 14, 12, 5, shade(HANDLE, 0.72));
      if (type === 'pickaxe') { lineP(img, 5, 3, 9, 1, head); lineP(img, 9, 1, 13, 3, head); lineP(img, 13, 3, 14, 7, head); lineP(img, 10, 2, 13, 5, head); px(img, 4, 4, shade(c, 0.7)); px(img, 14, 8, shade(c, 0.7)); }
      else if (type === 'axe') { poly(img, [[8, 2], [13, 1], [15, 6], [12, 9], [10, 6]], head); }
      else if (type === 'shovel') { poly(img, [[10, 2], [14, 2], [14, 6], [11, 8], [9, 6]], head); }
      else if (type === 'hoe') { lineP(img, 8, 3, 13, 3, head); lineP(img, 8, 4, 10, 4, head); }
    }
    outline(img);
    for (let i = 0; i < N * N; i++) img.ro[i] = mat === 'golden' || mat === 'iron' ? 0.25 : 0.6;
    if (mat === 'diamond' || mat === 'duskite') for (let i = 0; i < N * N; i++) if (img.c[i * 4 + 3] > 0.5 && img.c[i * 4 + 2] > 0.5) img.em[i] = mat === 'duskite' ? 0 : 0.1;
    return img;
  }
  PRE.tool = (type, mat) => tool(type, mat);
  function armor(slot, mat) {
    const img = sprite(); const c = { leather: 0x9a5a2a, copper: 0xd8804a, iron: 0xd8d8d8, golden: 0xf0d040, diamond: 0x5af0e0, duskite: 0x5a3a7a }[mat];
    const f = ramp3(c);
    if (slot === 'helmet') { poly(img, [[3, 11], [3, 5], [5, 3], [11, 3], [13, 5], [13, 11], [11, 11], [11, 7], [5, 7], [5, 11]], f); }
    else if (slot === 'chestplate') { poly(img, [[2, 4], [5, 2], [7, 4], [9, 4], [11, 2], [14, 4], [13, 7], [12, 7], [12, 14], [4, 14], [4, 7], [3, 7]], f); }
    else if (slot === 'leggings') { poly(img, [[4, 2], [12, 2], [12, 14], [9, 14], [8, 7], [7, 14], [4, 14]], f); }
    else { poly(img, [[2, 7], [6, 7], [6, 12], [7, 13], [7, 14], [2, 14]], f); poly(img, [[9, 7], [13, 7], [13, 12], [14, 13], [14, 14], [9, 14]], f); }
    outline(img);
    return img;
  }
  PRE.armor = (slot, mat) => armor(slot, mat);

  // ---------------- food ----------------
  const FOOD = {
    apple: () => { const img = sprite(); circ(img, 8, 9.5, 5.2, (x, y, d) => (x < 7 && y < 8) ? C(0xff7a6a) : d > 0.8 ? C(0x9a1010) : C(0xd8201a)); lineP(img, 8, 2, 9, 4, C(0x5a3a1a)); px(img, 10, 3, C(0x3a9a2a)); px(img, 11, 3, C(0x3a9a2a)); outline(img); return img; },
    golden_apple: () => { const img = FOOD.apple(); for (let i = 0; i < N * N; i++) if (img.c[i * 4 + 3] > 0.5 && img.c[i * 4] > img.c[i * 4 + 2] * 1.5) { const l = TX.lum([img.c[i * 4], img.c[i * 4 + 1], img.c[i * 4 + 2]]); img.c[i * 4] = 0.8 + l * 0.4; img.c[i * 4 + 1] = 0.6 + l * 0.5; img.c[i * 4 + 2] = 0.1 + l * 0.2; img.em[i] = 0.25; } return img; },
    bread: () => { const img = sprite(); poly(img, [[2, 10], [4, 6], [8, 5], [12, 6], [14, 10], [13, 12], [3, 12]], (x, y) => y < 8 ? C(0xd8a050) : C(0xb07830)); for (const x of [5, 8, 11]) px(img, x, 7, C(0xf0d090)); outline(img); return img; },
    carrot: () => { const img = sprite(); poly(img, [[4, 13], [11, 4], [13, 6], [5, 14]], (x, y) => (x + y) % 4 ? C(0xf08a1a) : C(0xc86a0a)); lineP(img, 12, 4, 14, 1, C(0x3aa02a)); lineP(img, 12, 5, 15, 3, C(0x2a8a1a)); outline(img); return img; },
    potato: () => raw(0xc8a060), baked_potato: () => { const img = raw(0xd8a040); px(img, 8, 7, C(0xf8e0a0)); px(img, 9, 8, C(0xf8e0a0)); return img; },
    beetroot: () => { const img = sprite(); circ(img, 8, 10, 4.5, (x, y, d) => d > 0.8 ? C(0x6a0a1a) : C(0xa01a3a)); lineP(img, 8, 5, 7, 2, C(0x3a8a2a)); lineP(img, 9, 5, 11, 2, C(0x3a8a2a)); outline(img); return img; },
    melon_slice: () => { const img = sprite(); poly(img, [[2, 12], [8, 3], [14, 12]], (x, y) => y > 10 ? C(0x3a8a2a) : y > 9 ? C(0xe8f0a0) : ((x * 3 + y) % 7 === 0 ? C(0x1a1a1a) : C(0xe83a3a))); outline(img); return img; },
    sweet_berries: () => { const img = sprite(); for (const [x, y] of [[6, 8], [9, 7], [8, 11], [11, 10], [5, 11]]) circ(img, x, y, 2.2, (xx, yy, d) => d < 0.4 ? C(0xff7a8a) : C(0xc81a3a)); lineP(img, 8, 3, 8, 6, C(0x3a6a2a)); outline(img); return img; },
    glow_berries: () => { const img = sprite(); for (const [x, y] of [[6, 9], [10, 8], [8, 12]]) circ(img, x, y, 2.4, (xx, yy, d) => d < 0.4 ? C(0xfff0a0) : C(0xf0a020), 0.8); lineP(img, 8, 2, 8, 6, C(0x3a6a2a)); outline(img); return img; },
    starfruit: () => { const img = sprite(); const pts = []; for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2 - Math.PI / 2, r = k % 2 ? 2.8 : 6.2; pts.push([8 + Math.cos(a) * r, 8.5 + Math.sin(a) * r]); } poly(img, pts, (x, y) => (x + y) % 3 ? C(0xf8e04a) : C(0xfff8b0), 0.35); outline(img); return img; },
    dried_kelp: () => { const img = sprite(); poly(img, [[5, 2], [11, 2], [10, 14], [6, 14]], (x, y) => y % 3 ? C(0x3a4a1a) : C(0x2a3a12)); outline(img); return img; },
    cookie: () => { const img = sprite(); circ(img, 8, 8, 5.5, (x, y) => hh(x, y, 4) < 0.18 ? C(0x3a1a0a) : C(0xc88a3a)); outline(img); return img; },
    pumpkin_pie: () => { const img = sprite(); poly(img, [[2, 12], [3, 7], [13, 7], [14, 12]], (x, y) => y < 9 ? C(0xe8902a) : C(0xc8a060)); outline(img); return img; },
    mushroom_stew: () => { const img = sprite(); poly(img, [[2, 8], [14, 8], [12, 13], [4, 13]], (x, y) => y < 9 ? C(0xc89a6a) : C(0x7a5a3a)); for (const x of [5, 8, 11]) px(img, x, 8, C(0xd84a3a)); outline(img); return img; },
    honey_bottle: () => { const img = sprite(); poly(img, [[6, 2], [10, 2], [10, 5], [13, 8], [13, 14], [3, 14], [3, 8], [6, 5]], (x, y) => y < 5 ? C(0xc8e0f0) : y < 8 ? C(0xe0f0ff) : C(0xf0a020)); outline(img); return img; },
    space_ration: () => { const img = sprite(); poly(img, [[3, 4], [13, 4], [13, 13], [3, 13]], (x, y) => y < 6 ? C(0xe86a1a) : (x > 5 && x < 11 && y > 7 && y < 11) ? C(0x3ac8ff) : C(0xd8dce4)); outline(img); return img; },
  };
  const meat = (raw0, c1, c2) => () => { const img = sprite(); poly(img, [[2, 8], [5, 4], [11, 3], [14, 6], [13, 11], [8, 13], [4, 12]], (x, y) => (x + y) % 5 === 0 ? K(c2) : K(c1)); if (!raw0) px(img, 6, 6, lighten(c1, 0.3)); lineP(img, 12, 11, 14, 14, C(0xf0e8d0)); outline(img); return img; };
  const fish = (c1, c2) => () => { const img = sprite(); poly(img, [[2, 8], [6, 5], [11, 5], [14, 8], [11, 11], [6, 11]], (x, y) => y < 8 ? K(c1) : K(c2)); poly(img, [[11, 8], [15, 5], [15, 11]], K(c2)); px(img, 5, 7, C(0x101010)); outline(img); return img; };
  Object.assign(FOOD, {
    raw_beef: meat(true, 0xd84a4a, 0xf0a0a0), steak: meat(false, 0x8a4a2a, 0x6a3a1a), raw_porkchop: meat(true, 0xf0909a, 0xf8c8c8), cooked_porkchop: meat(false, 0xc88a5a, 0xa06a3a),
    raw_chicken: meat(true, 0xf0c8b0, 0xf8e0d0), cooked_chicken: meat(false, 0xc8883a, 0xa06a2a), raw_mutton: meat(true, 0xc84a4a, 0xf0e0e0), cooked_mutton: meat(false, 0x9a5a3a, 0x7a3a2a),
    raw_cod: fish(0x9a8a6a, 0xd8c8a8), cooked_cod: fish(0xd8b88a, 0xf0e0c0), raw_salmon: fish(0xd84a3a, 0x9a5a5a), cooked_salmon: fish(0xd87a4a, 0xf0b090),
  });

  // ---------------- misc items ----------------
  const MISC = {
    stick: () => stickImg(), coal: () => raw(0x2a2a2e), charcoal: () => raw(0x3a2e24), raw_iron: () => raw(0xd8b89a), raw_gold: () => raw(0xf0c83a), raw_copper: () => raw(0xd8805a),
    iron_ingot: () => ingot(0xd8d8dc), gold_ingot: () => ingot(0xf8d040), copper_ingot: () => ingot(0xe0804a), duskite_ingot: () => ingot(0x6a4a8a), relic_scrap: () => raw(0x6a4a3a),
    iron_nugget: () => nugget(0xd8d8dc), gold_nugget: () => nugget(0xf8d040), diamond: () => gem(0x5af0e0), emerald: () => gem(0x3ae07a), lapis_lazuli: () => gem(0x2a4ad0),
    voltite_dust: () => dust(0xff3a1a, 0.6), quartz: () => gem(0xf0ece4), amethyst_shard: () => shard(0xb080f0, 0.2), flint: () => raw(0x3a3a40),
    string: () => { const img = sprite(); lineP(img, 3, 13, 6, 4, C(0xf0f0f0)); lineP(img, 6, 4, 10, 12, C(0xe0e0e0)); lineP(img, 10, 12, 13, 3, C(0xf0f0f0)); return img; },
    feather: () => { const img = sprite(); poly(img, [[3, 13], [10, 2], [13, 4], [6, 13]], (x, y) => (x + y) % 3 ? C(0xf4f4f4) : C(0xd8d8d8)); lineP(img, 3, 13, 11, 3, C(0xa8a8a8)); outline(img); return img; },
    leather: () => { const img = sprite(); poly(img, [[3, 3], [13, 3], [14, 8], [12, 13], [4, 13], [2, 8]], (x, y) => (x * y) % 7 === 0 ? C(0x7a4a1a) : C(0x9a5a2a)); outline(img); return img; },
    bone: () => { const img = sprite(); lineP(img, 4, 12, 12, 4, C(0xf0ecd8)); circ(img, 3.5, 12.5, 1.8, C(0xf0ecd8)); circ(img, 12.5, 3.5, 1.8, C(0xf0ecd8)); outline(img); return img; },
    bone_meal: () => dust(0xf8f8f0), gunpowder: () => dust(0x6a6a6a), sugar: () => dust(0xffffff), clay_ball: () => ball(0xa8b0c0), slime_ball: () => ball(0x6ad84a), snowball: () => ball(0xf8fcff),
    brick: () => { const img = sprite(); poly(img, [[2, 6], [14, 6], [14, 11], [2, 11]], (x, y) => y === 6 ? C(0xd8745a) : C(0xb0543a)); outline(img); return img; },
    paper: () => { const img = sprite(); poly(img, [[3, 2], [12, 2], [13, 14], [4, 14]], (x, y) => y % 3 === 0 && x > 4 && x < 11 ? C(0xc8c0b0) : C(0xf4f0e6)); outline(img); return img; },
    book: () => { const img = sprite(); poly(img, [[3, 3], [12, 2], [13, 13], [4, 14]], (x, y) => x < 5 ? C(0x5a2a1a) : C(0x8a3a2a)); lineP(img, 5, 13, 12, 12, C(0xf0e8d0)); outline(img); return img; },
    wheat: () => { const img = sprite(); for (let k = 0; k < 3; k++) { lineP(img, 5 + k * 3, 14, 6 + k * 2, 3, C(0xc8a03a)); for (let y = 3; y < 8; y++) px(img, 6 + k * 2 + (y % 2), y, C(0xe8c860)); } outline(img); return img; },
    wheat_seeds: () => dust(0x6aa03a), beetroot_seeds: () => dust(0xa07a4a), pumpkin_seeds: () => dust(0xe8e0b0), melon_seeds: () => dust(0x2a2a1a),
    honeycomb: () => { const img = sprite(); for (const [x, y] of [[5, 6], [10, 6], [7.5, 10], [12.5, 10], [3, 10]]) circ(img, x, y, 2.3, (xx, yy, d) => d < 0.5 ? C(0xf8c030) : C(0xd8901a)); outline(img); return img; },
    tide_crystals: () => shard(0x8af0e0, 0.4), sunstone_dust: () => dust(0xffe07a, 0.8),
    aether_cell: () => { const img = sprite(); poly(img, [[5, 2], [11, 2], [11, 14], [5, 14]], (x, y) => (y < 4 || y > 12) ? C(0x6a6e76) : C(0x5ad8ff), 0); for (let y = 4; y <= 12; y++) for (let x = 6; x <= 10; x++) { img.em[(y * 2) * N + x * 2] = 0.9; } outline(img); return img; },
    star_core: () => ball(0xfff0b0, 1), glow_ink: () => ball(0x5af0d0, 0.8), ink_sac: () => ball(0x2a2a3a),
    egg: () => { const img = sprite(); circ(img, 8, 9, 5, (x, y, d) => d < 0.5 && x < 8 ? C(0xfaf4e8) : C(0xe8dcc0)); outline(img); return img; },
    arrow: () => { const img = sprite(); lineP(img, 3, 13, 12, 4, C(0x8a6a3a)); poly(img, [[11, 3], [14, 2], [13, 5]], C(0x9aa0a8)); lineP(img, 2, 12, 4, 14, C(0xf0f0f0)); outline(img); return img; },
    nether_star_shard: () => { const img = sprite(); const pts = []; for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2, r = k % 2 ? 2.5 : 6.5; pts.push([8 + Math.cos(a) * r, 8 + Math.sin(a) * r]); } poly(img, pts, (x, y) => TX.mix(C(0xffffff), C(0xc8a0ff), Math.hypot(x - 8, y - 8) / 7), 0.9); return img; },
    shears: () => { const img = sprite(); lineP(img, 4, 12, 12, 4, C(0xd8d8dc)); lineP(img, 4, 4, 12, 12, C(0xb8b8bc)); circ(img, 3.5, 12.5, 1.8, C(0x9a3a2a)); circ(img, 3.5, 3.5, 1.8, C(0x9a3a2a)); outline(img); return img; },
    flint_and_steel: () => { const img = sprite(); poly(img, [[3, 9], [8, 9], [8, 14], [3, 14]], C(0x3a3a40)); lineP(img, 8, 4, 13, 9, C(0xc8c8cc)); lineP(img, 13, 9, 11, 12, C(0xc8c8cc)); outline(img); return img; },
    bow: () => { const img = sprite(); for (let a = 0; a <= 20; a++) { const t = -1.1 + a / 20 * 2.2; px(img, Math.round(4 + Math.cos(t) * 8), Math.round(8 + Math.sin(t) * 7), C(0x8a5a2a)); } lineP(img, 7, 1, 7, 15, C(0xe8e8e8)); outline(img); return img; },
    compass: () => { const img = sprite(); circ(img, 8, 8, 6, (x, y, d) => d > 0.8 ? C(0x7a7e86) : C(0xe8e4d8)); lineP(img, 8, 8, 8, 4, C(0xd81a1a)); lineP(img, 8, 9, 8, 12, C(0x2a2a3a)); outline(img); return img; },
    clock: () => { const img = sprite(); circ(img, 8, 8, 6, (x, y, d) => d > 0.8 ? C(0xd8a830) : (y < 8 ? C(0x5ab0f0) : C(0x3a4a1a))); lineP(img, 8, 8, 8, 4, C(0x1a1a1a)); outline(img); return img; },
    spyglass: () => { const img = sprite(); lineP(img, 3, 13, 12, 4, C(0xd8804a)); lineP(img, 4, 13, 13, 4, C(0xa05a2a)); circ(img, 12.5, 3.5, 1.8, C(0x9ad8ff)); outline(img); return img; },
    bucket: () => bucket(null), water_bucket: () => bucket(0x3a7aff), lava_bucket: () => bucket(0xff6a1a), aether_bucket: () => bucket(0x5af0ff),
    laser_blaster: () => { const img = sprite(); poly(img, [[2, 6], [12, 6], [14, 7], [14, 9], [9, 9], [8, 13], [5, 13], [5, 9], [2, 9]], (x, y) => y < 7 ? C(0xe8ecf0) : x > 9 ? C(0x3a4250) : C(0xc8ccd4)); lineP(img, 11, 7, 14, 7, C(0x3af0ff), 1); px(img, 4, 7, C(0xff3a6a), 1); outline(img); return img; },
    mining_laser: () => { const img = sprite(); poly(img, [[2, 6], [10, 5], [10, 11], [2, 10]], (x, y) => y < 7 ? C(0xf0b030) : C(0x3a3e46)); poly(img, [[10, 7], [15, 8], [10, 9]], C(0xff5a2a), 1); lineP(img, 4, 10, 6, 14, C(0x2a2e36)); outline(img); return img; },
    builder_wand: () => { const img = sprite(); lineP(img, 3, 13, 11, 5, C(0xe8ecf0)); lineP(img, 4, 13, 12, 5, C(0x9aa0a8)); circ(img, 12.5, 3.5, 2.5, (x, y, d) => TX.mix(C(0xffffff), C(0x3af0c8), d), 1); outline(img); return img; },
    jetpack: () => { const img = sprite(); poly(img, [[4, 2], [12, 2], [13, 11], [3, 11]], (x, y) => x === 8 ? C(0x3a3e46) : C(0xd8dce4)); poly(img, [[3, 11], [6, 11], [6, 14], [3, 14]], C(0x5a5e66)); poly(img, [[10, 11], [13, 11], [13, 14], [10, 14]], C(0x5a5e66)); px(img, 4, 15, C(0xff8a2a), 1); px(img, 11, 15, C(0xff8a2a), 1); px(img, 8, 5, C(0x3af0ff), 1); outline(img); return img; },
    hoverbike: () => { const img = sprite(); poly(img, [[1, 9], [5, 6], [11, 6], [15, 8], [14, 11], [2, 11]], (x, y) => y < 8 ? C(0xf05a1a) : C(0x2a2e36)); lineP(img, 2, 12, 14, 12, C(0x3af0ff), 1); poly(img, [[6, 4], [9, 4], [10, 6], [5, 6]], C(0x9ad8ff)); outline(img); return img; },
    shuttle_beacon: () => { const img = sprite(); poly(img, [[8, 1], [12, 8], [10, 14], [6, 14], [4, 8]], (x, y) => y > 11 ? C(0xff6a1a) : x < 8 ? C(0xf4f6f8) : C(0xc8ccd4)); px(img, 8, 6, C(0x3a8aff), 1); outline(img); return img; },
    photo_drone: () => { const img = sprite(); poly(img, [[5, 6], [11, 6], [11, 11], [5, 11]], C(0x2a2e36)); circ(img, 8, 8.5, 1.8, C(0x5af0ff), 0.8); for (const [x, y] of [[2, 4], [13, 4]]) lineP(img, x, y, x + 1, y, C(0xd8dce4)); lineP(img, 3, 5, 5, 6, C(0x9aa0a8)); lineP(img, 13, 5, 11, 6, C(0x9aa0a8)); outline(img); return img; },
    waypoint_marker: () => { const img = sprite(); circ(img, 8, 6, 4.5, (x, y, d) => d < 0.45 ? C(0xffffff) : C(0x3af0c8), 0.6); poly(img, [[5, 8], [11, 8], [8, 15]], C(0x3af0c8), 0.6); outline(img); return img; },
    energy_cell: () => { const img = sprite(); poly(img, [[5, 3], [11, 3], [11, 14], [5, 14]], (x, y) => y < 5 ? C(0x9aa0a8) : y > 12 ? C(0x5a5e66) : C(0xf0c030)); px(img, 8, 8, C(0xffffff), 1); outline(img); return img; },
    scanner: () => { const img = sprite(); poly(img, [[3, 2], [13, 2], [13, 14], [3, 14]], C(0x3a3e46)); poly(img, [[5, 4], [11, 4], [11, 10], [5, 10]], (x, y) => (x + y) % 3 ? C(0x1a5a3a) : C(0x3af07a), 0.7); outline(img); return img; },
  };
  function bucket(fill) { const img = sprite(); poly(img, [[3, 5], [13, 5], [12, 14], [4, 14]], (x, y) => x < 6 ? C(0xe8e8ec) : C(0xb8b8c0)); if (fill) poly(img, [[4, 5], [12, 5], [12, 7], [4, 7]], K(fill), fill === 0xff6a1a || fill === 0x5af0ff ? 1 : 0); lineP(img, 3, 5, 8, 1, C(0x8a8a90)); lineP(img, 8, 1, 13, 5, C(0x8a8a90)); outline(img); return img; }
  for (const c of ['violet', 'azure', 'verdant', 'rose', 'amber']) MISC['crystal_shard_' + c] = () => shard({ violet: 0xb05aff, azure: 0x3ab8ff, verdant: 0x3aff7a, rose: 0xff5ab8, amber: 0xffb02a }[c], 0.6);

  // spawn eggs
  const EGG_COL = { glimmer_deer: [0xd8c8a0, 0x5ad8ff], moss_boar: [0x5a7a2a, 0x3a2a1a], sky_ray: [0x3a6ad8, 0xf0f0ff], crystal_crab: [0xb05aff, 0x2a1a4a], ember_husk: [0x6a2a1a, 0xff8a2a], void_stalker: [0x1a1a2a, 0xb03aff], shard_wisp: [0xe0f8ff, 0x3af0c8], bloom_sheep: [0xf4f0f0, 0xff8ac8], hover_drone: [0xd8dce4, 0xff6a1a], glimmer_fox: [0xe8862a, 0x5affff], moss_cat: [0x6a8a3a, 0xf2e6c8], crystal_pup: [0xd8f2ff, 0x7ad8ff] };
  PRE.egg = (m) => { const [a, b] = EGG_COL[m] || [0xaaaaaa, 0x555555]; const img = sprite(); circ(img, 8, 9, 5.5, (x, y, d) => hh(x >> 1, y >> 1, m.length) < 0.3 ? K(b) : d < 0.5 && x < 8 ? lighten(a, 0.25) : K(a)); outline(img); return img; };

  // shared with other sprite recipe files (tex_groceries.js)
  VR.TEXITEM = { px, poly, circ, lineP, outline, sprite, shade, lighten, K, C, hh, ramp3, ball, raw, dust, N, TX };
  VR.ITEM_SPRITES = Object.create(null); // id → () => img, filled by other files
  // blueprints: a blue sheet with the house drawn in white lines (one silhouette per house family)
  function blueprint(shape) {
    const img = sprite(), W = C(0xeaf4ff), Wd = C(0xb8d4f4);
    poly(img, [[1, 3], [14, 2], [15, 13.5], [2, 14.5]], (x, y) => ((x + 1) % 4 === 0 || (y + 2) % 4 === 0) ? C(0x3576c8) : C(0x2862b4));
    lineP(img, 1, 3, 2, 14, C(0x6a9ee0)); lineP(img, 14, 2, 15, 13, C(0x1d4f96));
    const L = (a, b, c, d, col) => lineP(img, a, b, c, d, col || W);
    const box = (x0, y0, x1, y1) => { L(x0, y0, x1, y0); L(x1, y0, x1, y1); L(x1, y1, x0, y1); L(x0, y1, x0, y0); };
    if (shape === 'bungalow') { box(3, 9, 12, 12); L(2, 9, 7, 6); L(8, 6, 13, 9); px(img, 7, 11, Wd); px(img, 5, 10, Wd); px(img, 10, 10, Wd); }
    else if (shape === 'portico') { box(4, 8, 11, 12); L(5, 7, 7, 5); L(8, 5, 10, 7); L(5, 7, 10, 7); L(6, 8, 6, 12, Wd); L(9, 8, 9, 12, Wd); box(2, 6, 3, 12); box(12, 6, 13, 12); }
    else if (shape === 'colonnade') { box(3, 7, 12, 12); L(2, 7, 7, 4); L(8, 4, 13, 7); for (const x of [4, 6, 9, 11]) L(x, 8, x, 12, Wd); }
    else if (shape === 'tower') { box(3, 8, 9, 12); L(2, 8, 5, 6); L(6, 6, 10, 8); box(10, 6, 12, 12); L(10, 5, 11, 3); L(11, 3, 12, 5); px(img, 11, 8, Wd); px(img, 5, 10, Wd); }
    else if (shape === 'palace') { box(2, 8, 13, 12); L(2, 8, 7, 6); L(8, 6, 13, 8); circ(img, 7.5, 5.5, 1.6, W); for (const x of [4, 6, 9, 11]) px(img, x, 10, Wd); }
    else if (shape === 'compact') { box(5, 7, 10, 12); L(4, 7, 7, 4); L(8, 4, 11, 7); px(img, 7, 11, Wd); px(img, 6, 9, Wd); px(img, 9, 9, Wd); }
    else { box(4, 7, 11, 12); L(3, 7, 7, 4); L(8, 4, 12, 7); box(12, 9, 14, 12); px(img, 7, 11, Wd); px(img, 6, 9, Wd); px(img, 9, 9, Wd); }
    outline(img);
    return img;
  }
  PRE.item = (id, a, b) => {
    if (id === 'blueprint') return blueprint(a);
    if (id === 'tool') return tool(a, b);
    if (id === 'armor') return armor(a, b);
    if (id === 'egg' && a) return PRE.egg(a);
    const f = MISC[id] || FOOD[id] || VR.ITEM_SPRITES[id];
    if (f) return f();
    return null;
  };

  // ---------------- crack stages (grayscale, alpha = crack) ----------------
  for (let st = 0; st < 10; st++) {
    REC['destroy#' + st] = () => {
      const img = TX.sprite();
      const n = 3 + st * 3;
      for (let k = 0; k < n; k++) {
        let x = 16 + (hh(k, 1, 777) - 0.5) * 6, y = 16 + (hh(k, 2, 777) - 0.5) * 6, a = hh(k, 3, 777) * 6.28;
        const len = 4 + (st + 1) * 1.6 * hh(k, 4, 777);
        for (let t = 0; t < len; t++) {
          const ix = Math.floor(x), iy = Math.floor(y);
          if (ix >= 0 && iy >= 0 && ix < N && iy < N) img.set(ix, iy, [0.12, 0.12, 0.12], 1);
          a += (hh(k, t, 778) - 0.5) * 0.9; x += Math.cos(a); y += Math.sin(a);
        }
      }
      return img;
    };
  }
  // particle sprites
  REC.particle_spark = () => { const img = TX.sprite(); TX.disc(img, 15.5, 15.5, 7, (d) => TX.mix([1, 1, 1], [1, 0.8, 0.4], d)); for (let i = 0; i < N * N; i++) img.em[i] = 1; return img; };
})(VR);

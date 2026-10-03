// ============================================================================
// Block definitions part 6 — Modern building set (v0.30):
//   · Vollton — clean solid colours in 40 tones, matte and gloss, with slabs and
//     stairs (one neutral texture per finish, the colour is the block tint)
//   · Panorama glass — windows with connected frames: neighbouring panes of the
//     same kind merge into one big glass surface framed only at its outside edge
//     (16 frame variants per style, chosen by the mesher from the neighbours)
//   · Modern doors — 9 designs (glass, pivot, slats, flush, glass strip, loft …)
//     built from real 3D parts (frames, glass, bar handles, levers) that swing
//     open and shut like every door in the game
// Registered late (after the "cut" twins in blocks4.js) so saved worlds keep
// every existing state id.
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R, T = R.tex, MD = VR.MODEL, F = VR.F;
  const { def, G } = VR.BL;
  const { FACING4, HALF } = VR.PROPS;
  VR.BL.late = VR.BL.late || [];

  // ---------------------------------------------------------------- Vollton palette
  // [id, display, colour] — neutrals, earth, reds, oranges & yellows, greens, blues, violets
  const VOLLTON = VR.VOLLTON = [
    ['white', 'Pure White', 0xF4F4F1], ['cream', 'Cream White', 0xEFE8D8], ['light_grey', 'Light Grey', 0xC8CBCE], ['stone_grey', 'Stone Grey', 0x9A9EA3],
    ['mid_grey', 'Mid Grey', 0x6E7378], ['anthracite', 'Anthracite', 0x3A3F45], ['graphite', 'Graphite', 0x27292D], ['black', 'Deep Black', 0x141518],
    ['sand', 'Sand', 0xD9C8A4], ['beige', 'Beige', 0xC6AE88], ['taupe', 'Taupe', 0x8C8074], ['caramel', 'Caramel', 0xAA7548],
    ['terracotta', 'Terracotta', 0xB95E3E], ['chocolate', 'Chocolate', 0x5A3A29],
    ['signal_red', 'Signal Red', 0xC8292B], ['carmine', 'Carmine', 0x8C1C27], ['coral', 'Coral', 0xF06B5A], ['dusty_rose', 'Dusty Rose', 0xD8A2A0],
    ['pink', 'Pink', 0xEA5D9E], ['magenta', 'Magenta', 0xB0287C],
    ['orange', 'Orange', 0xF07E1E], ['apricot', 'Apricot', 0xF6B27C], ['mustard', 'Mustard', 0xD3A12B], ['lemon', 'Lemon Yellow', 0xF3D53C],
    ['mint', 'Mint', 0xA6DCC3], ['sage', 'Sage', 0x9BAF98], ['olive', 'Olive', 0x6C7343], ['forest', 'Forest Green', 0x2E5A3A],
    ['emerald', 'Emerald', 0x14996A], ['lime', 'Lime', 0x9CCB3A],
    ['ice_blue', 'Ice Blue', 0xC6E3F0], ['sky', 'Sky Blue', 0x6EB3E4], ['pigeon', 'Pigeon Blue', 0x7C93A9], ['cobalt', 'Cobalt Blue', 0x2B5DB4],
    ['navy', 'Navy', 0x1F2E50], ['petrol', 'Petrol', 0x1D5E6F], ['turquoise', 'Turquoise', 0x2CB7B1],
    ['lavender', 'Lavender', 0xB7A5DA], ['violet', 'Violet', 0x6D3EA4], ['plum', 'Plum', 0x5A2849],
  ];

  // ---------------------------------------------------------------- panorama glass styles (connected frames)
  // the mesher picks variant base + mask (bit 0 top, 1 right, 2 bottom, 3 left edge of the face joins the same block)
  const PANORAMA = VR.PANORAMA = [
    ['black', 'Panorama Glass · Black Frame'], ['white', 'Panorama Glass · White Frame'], ['anthracite', 'Panorama Glass · Anthracite'],
    ['bronze', 'Panorama Glass · Bronze'], ['grid', 'Curtain Wall · Black Mullions'], ['frosted', 'Frosted Glass · Alu Frame'],
    ['tinted', 'Smoked Glass · Black Frame'],
  ];

  // ---------------------------------------------------------------- modern doors
  // parts in the closed door's frame: thickness x ∈ [0, 2], width z ∈ [0, 16] (hinge at z = 0, free edge at 16),
  // height y ∈ [0, 32] over both halves. [x0, y0, z0, x1, y1, z1, material, glass?]
  const TK = 2;                                     // leaf thickness (1/16 block)
  // a long bar handle on both faces near the free edge (y0..y1), standoffs at a and b
  const bar = (y0, y1, m, z) => {
    z = z === undefined ? 12.5 : z; const out = [];
    for (const side of [-1, 1]) {
      const xo = side < 0 ? -1.75 : TK + 1.25, so0 = side < 0 ? -1.25 : TK, so1 = side < 0 ? 0 : TK + 1.25;
      out.push([xo, y0, z - 0.5, xo + 0.5, y1, z + 0.5, m]);
      for (const yy of [y0 + 1.5, y1 - 2]) out.push([so0, yy, z - 0.25, so1, yy + 0.5, z + 0.25, m]);
    }
    return out;
  };
  // a lever handle on both faces at door-handle height (~1 m): rosette, neck, grip pointing to the hinge
  const lever = (m, z) => {
    z = z === undefined ? 13.5 : z; const out = [];
    for (const side of [-1, 1]) {
      const r0 = side < 0 ? -0.4 : TK, r1 = side < 0 ? 0 : TK + 0.4, n0 = side < 0 ? -1.4 : TK, n1 = side < 0 ? 0 : TK + 1.4, g0 = side < 0 ? -1.6 : TK + 1, g1 = side < 0 ? -1 : TK + 1.6;
      out.push([r0, 15.2, z - 0.8, r1, 16.8, z + 0.8, m]);
      out.push([n0, 15.7, z - 0.3, n1, 16.3, z + 0.3, m]);
      out.push([g0, 15.7, z - 4.2, g1, 16.3, z + 0.3, m]);
    }
    return out;
  };
  const frame = (w, m) => [[0, 0, 0, TK, 32, w, m], [0, 0, 16 - w, TK, 32, 16, m], [0, 0, w, TK, w, 16 - w, m], [0, 32 - w, w, TK, 32, 16 - w, m]];
  const glass = (w, m) => [[0.7, w, w, TK - 0.7, 32 - w, 16 - w, m, 1]];
  const DOORS = VR.MODERN_DOORS = [
    { id: 'door_glass_black', display: 'Glass Door · Black Frame', tex: 'mod_black', sound: 'glass', parts: () => [...frame(1.5, 'mod_black'), ...glass(1.5, 'mod_glass'), ...bar(6, 26, 'mod_steel')] },
    { id: 'door_glass_white', display: 'Glass Door · White Frame', tex: 'mod_white', sound: 'glass', parts: () => [...frame(1.5, 'mod_white'), ...glass(1.5, 'mod_glass'), ...lever('mod_steel')] },
    { id: 'door_pivot_anthracite', display: 'Pivot Door · Anthracite', tex: 'mod_anthracite', sound: 'metal', parts: () => {
      // four flush panels with shadow grooves, a recessed core behind the grooves, a long stainless bar
      const P = [];
      const cuts = [0, 7.85, 8.15, 15.85, 16.15, 23.85, 24.15, 32];
      for (let k = 0; k < cuts.length; k += 2) P.push([0, cuts[k], 0, TK, cuts[k + 1], 16, 'mod_anthracite']);
      P.push([0.45, 0, 0.3, TK - 0.45, 32, 15.7, 'mod_black']);
      return P.concat(bar(3, 29, 'mod_steel', 12.75));
    } },
    { id: 'door_slat_walnut', display: 'Walnut Slat Door', tex: 'mod_slat', sound: 'wood', parts: () => [[0, 0, 0, TK, 32, 16, 'mod_slat'], ...bar(3, 29, 'mod_black', 13)] },
    { id: 'door_flush_white', display: 'Flush Door · White', tex: 'mod_white', sound: 'wood', parts: () => [[0, 0, 0, TK, 32, 16, 'mod_white'], ...lever('mod_black')] },
    { id: 'door_flush_oak', display: 'Flush Door · Oak', tex: 'mod_oak', sound: 'wood', parts: () => [[0, 0, 0, TK, 32, 16, 'mod_oak'], ...lever('mod_black')] },
    { id: 'door_strip_anthracite', display: 'Front Door · Glass Strip', tex: 'mod_anthracite', sound: 'metal', parts: () => [
      [0, 0, 0, TK, 32, 2.5, 'mod_anthracite'], [0, 0, 4.5, TK, 32, 16, 'mod_anthracite'], [0, 0, 2.5, TK, 3, 4.5, 'mod_anthracite'], [0, 29, 2.5, TK, 32, 4.5, 'mod_anthracite'],
      [0.7, 3, 2.5, TK - 0.7, 29, 4.5, 'mod_glass_frosted', 1], ...bar(5, 27, 'mod_steel', 12.75)] },
    { id: 'door_frosted_steel', display: 'Frosted Glass Door · Steel', tex: 'mod_steel', sound: 'glass', parts: () => [...frame(1.25, 'mod_steel'), ...glass(1.25, 'mod_glass_frosted'), ...lever('mod_steel')] },
    { id: 'door_loft_black', display: 'Loft Door · Black Steel Grid', tex: 'mod_black', sound: 'metal', parts: () => {
      const P = [...frame(1.25, 'mod_black'), ...glass(1.25, 'mod_glass')];
      for (const y of [8, 16, 24]) P.push([0.2, y - 0.3, 1.25, TK - 0.2, y + 0.3, 14.75, 'mod_black']);
      P.push([0.2, 1.25, 7.7, TK - 0.2, 30.75, 8.3, 'mod_black']);
      return P.concat(lever('mod_black'));
    } },
  ];
  // rotate faces by q quarter-turns around the vertical axis through (px, pz) (1/16 units)
  function turnY(faces, q, px, pz) {
    q = ((q % 4) + 4) % 4; if (!q) return faces;
    let dx = px / 16 - 0.5, dz = pz / 16 - 0.5;
    const ex = dx, ez = dz;
    for (let k = 0; k < q; k++) { const t = dx; dx = -dz; dz = t; }
    return MD.translate(MD.rotY(faces, q), (ex - dx) * 16, 0, (ez - dz) * 16);
  }
  // one half of a modern door for a state (facing, half, open, hinge)
  function doorFaces(d, p) {
    const lo = p.half ? 16 : 0, hi = lo + 16, out = [];
    for (const b of d.parts()) {
      const y0 = Math.max(lo, b[1]), y1 = Math.min(hi, b[4]); if (y1 - y0 < 1e-3) continue;
      let z0 = b[2], z1 = b[5];
      if (p.hinge) { const a = 16 - z1; z1 = 16 - z0; z0 = a; }   // right-hinged: the door mirrored across its width
      let f = MD.box([b[0], y0 - lo, z0, b[3], y1 - lo, z1], T(b[6]), { cull: false });
      if (b[7]) f = f.map(x => Object.assign({}, x, { layer: 2 }));
      for (const x of f) out.push(x);
    }
    let faces = out;
    if (p.open) faces = p.hinge ? turnY(faces, 1, TK / 2, 16 - TK / 2) : turnY(faces, 3, TK / 2, TK / 2);
    return MD.rotY(faces, p.facing - 1);
  }
  VR.modernDoorFaces = doorFaces;

  VR.BL.late.push(function () {
    // ---- panorama glass + modern doors (the "Modern & Vollton" creative tab)
    G.MODERN = 'Modern · Glass & Doors';
    VR.GROUP_ORDER.push(G.MODERN);
    const ctmFirst = (style) => {
      const first = T('ctm:' + style + ':0');
      for (let m = 1; m < 16; m++) if (T('ctm:' + style + ':' + m) !== first + m) throw new Error('connected glass layers must be consecutive');
      return first;
    };
    for (const [style, disp] of PANORAMA) {
      const first = ctmFirst(style);
      def('panorama_' + style, { display: disp, cat: 'modern', group: G.MODERN, sound: 'glass', hard: 0.6, blast: 1, layer: 'trans', opaque: false, filter: 0, flags: F.SELFCULL, tex: first, ctm: first });
    }
    for (const d of DOORS) {
      def(d.id, { display: d.display, cat: 'modern', group: G.MODERN, props: [FACING4, HALF, ['open', 2], ['hinge', ['left', 'right']]], shape: 'model', layer: 'cutout', kind: 'door', flags: F.INTERACT,
        model: (p) => doorFaces(d, p), tex: T(d.tex), itemTex: T('door_icon:' + d.id), hard: 3, blast: 4, tool: d.sound === 'wood' ? 'axe' : 'pick', sound: d.sound, modernDoor: true });
    }
    // ---- Vollton
    G.VOLLTON = 'Vollton · Solid Colours';
    VR.GROUP_ORDER.push(G.VOLLTON);
    const matte = T('vollton_matte'), gloss = T('vollton_gloss');
    const base = { cat: 'modern', group: G.VOLLTON, tool: 'pick', sound: 'stone', hard: 1.2, blast: 6 };
    for (const [id, disp, col] of VOLLTON) {
      const n = 'vollton_' + id;
      def(n, Object.assign({ display: disp + ' · Vollton', tex: matte, tint: col, vollton: col }, base));
      def(n + '_gloss', Object.assign({ display: disp + ' · Vollton Gloss', tex: gloss, tint: col, vollton: col }, base));
      VR.FAM.slab(n + '_slab', matte, Object.assign({ display: disp + ' Slab · Vollton', tint: col, parent: n, vollton: col }, base));
      VR.FAM.stairs(n + '_stairs', matte, Object.assign({ display: disp + ' Stairs · Vollton', tint: col, parent: n, vollton: col }, base));
    }
  });
})(VR);

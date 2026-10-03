// ============================================================================
// Voxel City extras for the trailer's Palm City & Gate Temple gardens: box
// hedges that join into long trimmed rows, round bushes, white pod-house caps
// on stems and tube-house segments for the Pod Hills, and glowing street
// light-lines that run along road edges. Mini-voxel (VX) pieces like voxtech.
// ============================================================================
(function (VR) {
  'use strict';
  const VX = VR.VX;
  if (!VX || !VX._) return;
  const { G, put, box, rotateGrid, PAINT_FN, sh, hh } = VX._;
  const { EMIS, GLOSS } = VX;
  const { OTHER } = VX.CLS;
  const KIND = VX.KIND;
  const same = (ns, sp) => { const o = VX._.specOf(ns); return !!(o && o.kind === sp.kind && o.family === sp.family); };
  const flat4 = (c, sp, s, nbS) => (same(nbS[0], sp) ? 1 : 0) | (same(nbS[1], sp) ? 2 : 0) | (same(nbS[4], sp) ? 4 : 0) | (same(nbS[5], sp) ? 8 : 0);
  VX.ctxHook.hedge = flat4;
  VX.ctxHook.tube = (c, sp, s, nbS) => { const alongX = (c.facing & 1) === 1; return (same(nbS[alongX ? 0 : 4], sp) ? 1 : 0) | (same(nbS[alongX ? 1 : 5], sp) ? 2 : 0); };
  VX.ctxHook.podstem = (c, sp, s, nbS) => (same(nbS[2], sp) ? 1 : 0) | (same(nbS[3], sp) ? 2 : 0);

  // BOX HEDGE: a trimmed leafy block, 6 high, that grows to the block edge toward linked neighbours
  PAINT_FN.hedge = function (s, c) {
    G.fill(0);
    const m = c.x & 15, px = m & 1, nx = (m >> 1) & 1, pz = (m >> 2) & 1, nz = (m >> 3) & 1;
    const g1 = s.col, g2 = sh(g1, 1.22), g3 = sh(g1, 0.78);
    const x0 = nx ? 0 : 1, x1 = px ? 7 : 6, z0 = nz ? 0 : 1, z1 = pz ? 7 : 6;
    for (let y = 0; y <= 5; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      if (y === 5 && ((x === x0 && !nx) || (x === x1 && !px) || (z === z0 && !nz) || (z === z1 && !pz))) continue; // rounded top edge
      const q = hh(x + c.px * 8, y, z + c.pz * 8, 41) & 7;
      put(x, y, z, q === 0 ? g2 : q === 1 ? g3 : g1);
    }
  };
  // ROUND BUSH: a ball of leaves, a little flattened, with lighter tips
  PAINT_FN.bush = function (s, c) {
    G.fill(0);
    const g1 = s.col, g2 = sh(g1, 1.25), g3 = sh(g1, 0.8);
    const r = 3.6 + (c.h & 1) * 0.3;
    for (let y = 0; y < 8; y++) for (let z = 0; z < 8; z++) for (let x = 0; x < 8; x++) {
      const d = Math.hypot((x + 0.5 - 4), (y + 0.5 - 3.2) * 1.15, (z + 0.5 - 4));
      if (d > r) continue;
      const q = hh(x + c.px * 8, y + c.h, z + c.pz * 8, 43) & 7;
      put(x, y, z, d > r - 1 && q < 2 ? g2 : q === 2 ? g3 : g1);
    }
  };
  // POD STEM: a slim white column carrying a dome cap; a door dot glows at its foot
  PAINT_FN.podstem = function (s, c) {
    G.fill(0);
    const m = c.x & 3, below = (m >> 1) & 1;
    box(2, 0, 2, 5, 7, 5, (x, y, z) => ((x === 2 || x === 5) && (z === 2 || z === 5)) ? sh(s.col, 0.9) : s.col, GLOSS);
    if (!below) { box(1, 0, 1, 6, 1, 6, sh(s.col, 0.85), GLOSS); put(3, 2, 1, s.glow, EMIS); put(4, 2, 1, s.glow, EMIS); put(3, 3, 1, s.glow, EMIS); put(4, 3, 1, s.glow, EMIS); }
  };
  // TUBE HOUSE: a half-cylinder segment lying along its axis; ends close where no neighbour continues it
  PAINT_FN.tube = function (s, c) {
    G.fill(0);
    const m = c.x & 3, plus = m & 1, minus = (m >> 1) & 1;
    for (let z = 0; z < 8; z++) for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const d = Math.hypot(x + 0.5 - 4, y + 0.5);
      if (d > 4.2) continue;
      const shell = d > 3.0;
      const endCap = (z === 0 && !minus) || (z === 7 && !plus);
      if (!shell && !endCap && y > 0) continue;
      let col = s.col, f = GLOSS;
      if (endCap && d < 2.2 && y >= 1 && y <= 3) { col = s.glow; f = EMIS; }              // a glowing doorway in the end wall
      else if (shell && y >= 2 && y <= 3 && (z === 2 || z === 5)) { col = s.glow; f = EMIS; } // porthole windows
      else if (y === 0) col = sh(s.col, 0.8);
      put(x, y, z, col, f);
    }
    rotateGrid(c.facing);
  };

  Object.assign(KIND, { hedge: { cls: OTHER }, bush: { cls: OTHER }, podstem: { cls: OTHER }, tube: { cls: OTHER } });
  Object.assign(VX.boxHook, {
    hedge: () => [[0, 0, 0, 1, 0.75, 1]],
    bush: () => [[0.1, 0, 0.1, 0.9, 0.85, 0.9]],
    podstem: () => [[0.25, 0, 0.25, 0.75, 1, 0.75]],
    tube: () => [[0, 0, 0, 1, 1, 1]],
  });
  Object.assign(VX.iconHook, { hedge: (c) => { c.x = 0; }, tube: (c) => { c.facing = 0; c.x = 0; }, podstem: (c) => { c.x = 0; } });

  VX.defineExtra.push(function (K) {
    const { add, FACING4 } = K;
    const G_ = K.G, grp = { group: G_.TECH || G_.ARCH, cat: 'vtech' };
    const A = (name, display, sp, o) => add(name, display, sp, Object.assign({}, grp, o || {}));
    A('vx_hedge', 'Box Hedge', { kind: 'hedge', col: 0x2f7a2a }, { filter: 0, sound: 'grass', hard: 0.4 });
    A('vx_hedge_light', 'Light Box Hedge', { kind: 'hedge', family: 'light', col: 0x4aa838 }, { filter: 0, sound: 'grass', hard: 0.4 });
    A('vx_bush', 'Round Bush', { kind: 'bush', col: 0x2f8a34 }, { filter: 0, sound: 'grass', hard: 0.4 });
    A('vx_bush_light', 'Light Round Bush', { kind: 'bush', family: 'light', col: 0x4ab046 }, { filter: 0, sound: 'grass', hard: 0.4 });
    A('vx_pod_stem', 'Pod House Stem', { kind: 'podstem', col: 0xF2F4F8, glow: 0x5AFFB0 }, { filter: 0, light: [2, 6, 4], sound: 'metal', hard: 2 });
    A('vx_tube_house', 'Tube House', { kind: 'tube', col: 0xF2F4F8, glow: 0x9AF4FF }, { props: [FACING4], filter: 0, light: [2, 6, 7], sound: 'metal', hard: 2 });
  });
})(VR);

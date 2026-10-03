// ============================================================================
// Voxel Tech: the builder's kit from the trailer — hangars, control rooms and
// the tropical tech city — as context-aware 8×8×8 mini-voxel pieces (VX).
// Every piece fills one block and snaps to the grid like any block, and most
// of them notice their neighbours: screens and glass walls merge into one big
// pane, consoles and sofas join into long rows, plaza light-lines connect into
// glowing paths (with curves at corners), ceiling hex lights link up with light
// bars, a 3×3 of pad blocks draws one landing ring, frame blocks around an
// opening chamfer into an octagonal portal, two-by-two dome blocks become one
// dome. Holo parts shimmer (scanlines) in the terrain shader.
// ============================================================================
(function (VR) {
  'use strict';
  const VX = VR.VX;
  if (!VX || !VX._) return;
  const { G, I, put, del, get, box, rotateGrid, PAINT_FN, exposed, NX, NZ, OPP, F4D, C, sh, mix, hh, PAT, setP } = VX._;
  const { EMIS, GLASS, GLOSS, HOLO, PRESENT } = VX;
  const { AIR, SOLID, WALL, WIN, ROOF, FLOOR, DOOR, OTHER } = VX.CLS;
  const KIND = VX.KIND;

  // ---------------------------------------------------------------- palette (trailer)
  const T = VX.TECH = {
    white: 0xE9EDF2, white2: 0xD2D9E1, whiteD: 0x9AA4B0,
    gray: 0x8C96A4, grayD: 0x5A6472, grayDD: 0x3A424E,
    dark: 0x2C323C, darkD: 0x1E232B,
    cyan: 0x3AF0FF, cyanL: 0x9AFBFF, cyanD: 0x1A8AA8,
    amber: 0xFF9A2A, orange: 0xFF7A1A, red: 0xFF4A4A, green: 0x5AFF7A, yellow: 0xFFE04A, blue: 0x4A8AFF, magenta: 0xFF5AD8,
    holo: 0x5AD8FF, holoBg: 0x0E3A58,
  };
  const BTN = [T.red, T.yellow, T.green, T.cyan, T.blue, T.magenta, T.orange, 0xFFFFFF];
  // local (north-facing) axes → world face directions for a facing q
  const LXP = [0, 4, 1, 5], LXM = [1, 5, 0, 4], LZP = [4, 1, 5, 0];

  // ---------------------------------------------------------------- wall patterns
  // big two-by-two panels with carved seams; optional light strip + accent plate
  PAT.techpanel = (s, u, v, c, d) => {
    const along = (d === 0 || d === 1) ? c.pz : c.px;
    const U = along * 8 + u, V = c.py * 8 + v;
    if (s.strip !== undefined && (V === s.strip || (s.strip2 !== undefined && V === s.strip2))) { setP(s.glow || T.cyan, T.darkD, EMIS, 0); return; }
    if (s.bandV !== undefined && v >= s.bandV && v <= s.bandV + 1) { setP(v === s.bandV ? s.band : sh(s.band, 1.15), T.darkD, s.bandGlow ? EMIS : GLOSS, 0); return; }
    if (U === 0 || V === 0) { setP(-1, s.col2, 0, 0); return; }
    let k = 1;
    if (U === 1 || V === 15) k = 1.045; else if (U === 15 || V === 1) k = 0.93;
    let col = sh(s.col, k), f = s.gloss ? GLOSS : 0;
    if (s.accent && V >= 12 && V <= 13 && U >= 3 && U <= 6) { col = s.accent; f = s.accentGlow ? EMIS : 0; }
    if (s.vent && V >= 3 && V <= 6 && U >= 9 && U <= 13) col = (V & 1) ? s.col2 : sh(s.col, 0.85);
    setP(col, sh(s.col, 0.78), f, 0);
  };
  // hexagon relief (voronoi of a hex lattice, ~6 voxels across)
  const HEXW = 6, HEXH = 5.2;
  function hexCell(X, Y) {
    const j0 = Math.round(Y / HEXH);
    let best = 1e9, second = 1e9, bi = 0, bj = 0;
    for (let j = j0 - 1; j <= j0 + 1; j++) {
      const off = (j & 1) * HEXW / 2, i0 = Math.round((X - off) / HEXW);
      for (let i = i0 - 1; i <= i0 + 1; i++) {
        const cx = i * HEXW + off, cy = j * HEXH, dd = (X - cx) ** 2 + (Y - cy) ** 2;
        if (dd < best) { second = best; best = dd; bi = i; bj = j; } else if (dd < second) second = dd;
      }
    }
    return { edge: Math.sqrt(second) - Math.sqrt(best) < 0.95, i: bi, j: bj };
  }
  VX.hexCell = hexCell;
  PAT.hexpanel = (s, u, v, c, d) => {
    const along = (d === 0 || d === 1) ? c.pz : c.px;
    const hc = hexCell(along * 8 + u + 0.5, c.py * 8 + v + 0.5);
    if (hc.edge) { setP(-1, s.col2, 0, s.seamGlow ? EMIS : 0); return; }
    const hsh = hh(hc.i, hc.j, 3, 71);
    if (s.glowCells && (hsh & 15) === 0) { setP(s.glow || T.cyan, T.darkD, EMIS, 0); return; }
    setP(sh(s.col, 0.95 + (hsh & 3) * 0.03), sh(s.col, 0.75), s.gloss ? GLOSS : 0, 0);
  };

  // ---------------------------------------------------------------- floor patterns
  const glossK = (k) => k;
  VX.floorPat.plaza = (s, c, x, z) => {
    const X = c.px * 8 + x, Z = c.pz * 8 + z;
    if (X === 0 || Z === 0) return [s.col2, GLOSS];
    return [sh(s.col, 0.985 + (hh(c.px, c.pz, c.h, 91) & 1) * 0.025), GLOSS];
  };
  VX.floorPat.deck = (s, c, x, z) => {
    if (x === 0 || z === 0) return [s.col2, GLOSS];
    if ((x === 1 || z === 1)) return [sh(s.col, 1.06), GLOSS];
    return [sh(s.col, 0.98 + (c.h & 1) * 0.03), GLOSS];
  };
  VX.floorPat.hex = (s, c, x, z) => {
    const hc = hexCell((c.px * 8 + x + 0.5) * 0.5, (c.pz * 8 + z + 0.5) * 0.5); // big hexes: calm under foot
    if (hc.edge) return [s.col2, (s.seamGlow && (hh(hc.i, hc.j, 0, 5) & 3) === 0) ? EMIS : GLOSS];
    return [sh(s.col, 0.96 + (hh(hc.i, hc.j, 1, 9) & 3) * 0.025), GLOSS];
  };
  // glowing path line that follows its neighbours; perpendicular pairs curve round the corner
  VX.floorPat.line = (s, c, x, z) => {
    const base = VX.floorPat.plaza(s, c, x, z);
    const m = c.x & 15; // +x, -x, +z, -z
    const px = m & 1, nx = (m >> 1) & 1, pz = (m >> 2) & 1, nz = (m >> 3) & 1;
    const n = px + nx + pz + nz;
    const onLineX = z >= 3 && z <= 4, onLineZ = x >= 3 && x <= 4;
    let glow = false;
    if (n === 2 && (px + nx) === 1 && (pz + nz) === 1) {
      // quarter arc around the corner between the two connected sides
      const cx = px ? 8 : 0, cz = pz ? 8 : 0;
      const r = Math.hypot(x + 0.5 - cx, z + 0.5 - cz);
      glow = r >= 3.2 && r <= 4.9;
    } else if (n === 0) {
      const r = Math.hypot(x - 3.5, z - 3.5); glow = r >= 1.6 && r <= 2.9;
    } else {
      if (onLineX && ((px && x >= 3) || (nx && x <= 4))) glow = true;
      if (onLineZ && ((pz && z >= 3) || (nz && z <= 4))) glow = true;
      if (onLineX && onLineZ) glow = true;
    }
    return glow ? [s.glow || T.cyan, EMIS] : base;
  };
  // landing pad: one octagonal ring over the whole pad (3×3 and up), hex plating inside
  VX.floorPat.pad = (s, c, x, z) => {
    const m = c.x & 15;
    const ox = !(m & 2) ? 0 : !(m & 1) ? 16 : 8, oz = !(m & 8) ? 0 : !(m & 4) ? 16 : 8;
    const X = ox + x + 0.5 - 12, Z = oz + z + 0.5 - 12;
    const oct = Math.max(Math.abs(X), Math.abs(Z), (Math.abs(X) + Math.abs(Z)) * 0.74);
    if (oct >= 8.6 && oct <= 10.2) return [s.glow || T.cyan, EMIS];
    if (oct >= 3.0 && oct <= 3.9) return [s.glow2 || T.amber, EMIS];
    if (oct > 11.2) return [(((x + z) >> 1) & 1) ? T.yellow : T.dark, 0]; // hazard rim
    const hc = hexCell(ox + x + 0.5, oz + z + 0.5);
    return [hc.edge ? s.col2 : sh(s.col, 0.97 + (hh(hc.i, hc.j, 2, 3) & 1) * 0.04), GLOSS];
  };

  // ---------------------------------------------------------------- neighbour context
  const same = (ns, sp) => { const o = VX._.specOf(ns); return !!(o && o.kind === sp.kind && o.family === sp.family && o.pat === sp.pat); };
  const flat4 = (c, sp, s, nbS) => (same(nbS[0], sp) ? 1 : 0) | (same(nbS[1], sp) ? 2 : 0) | (same(nbS[4], sp) ? 4 : 0) | (same(nbS[5], sp) ? 8 : 0);
  // in the plane of a facing piece: local +x, -x, up, down (+ what is in front)
  const plane4 = (c, sp, s, nbS) => { const q = c.facing & 3; return (same(nbS[LXP[q]], sp) ? 1 : 0) | (same(nbS[LXM[q]], sp) ? 2 : 0) | (same(nbS[2], sp) ? 4 : 0) | (same(nbS[3], sp) ? 8 : 0); };
  VX.ctxHook.floor = (c, sp, s, nbS) => (sp.pat === 'line' || sp.pat === 'pad') ? flat4(c, sp, s, nbS) : 0;
  VX.ctxHook.holo = plane4;
  VX.ctxHook.glasswall = (c, sp, s, nbS) => {
    // plane: facing parity 0 → along x, 1 → along z
    const alongX = (c.facing & 1) === 0;
    return (same(nbS[alongX ? 0 : 4], sp) ? 1 : 0) | (same(nbS[alongX ? 1 : 5], sp) ? 2 : 0) | (same(nbS[2], sp) ? 4 : 0) | (same(nbS[3], sp) ? 8 : 0);
  };
  VX.ctxHook.tconsole = (c, sp, s, nbS) => { const q = c.facing & 3; return (same(nbS[LXP[q]], sp) ? 1 : 0) | (same(nbS[LXM[q]], sp) ? 2 : 0); };
  VX.ctxHook.sofa = VX.ctxHook.tconsole;
  VX.ctxHook.hexlight = (c, sp, s, nbS) => flat4(c, sp, s, nbS);
  VX.ctxHook.trail = (c, sp, s, nbS) => {
    const con = (d) => { const ns = nbS[d], cl = VX._.clsOf(ns), o = VX._.specOf(ns); return same(ns, sp) || cl === SOLID || cl === WALL || cl === WIN || cl === DOOR || (o && (o.kind === 'fence' || o.kind === 'lamppost')) ? 1 : 0; };
    return con(5) | (con(0) << 1) | (con(4) << 2) | (con(1) << 3);
  };
  VX.ctxHook.oframe = (c, sp, s, nbS) => {
    const alongX = (c.facing & 1) === 0;
    const r = alongX ? 0 : 4, l = alongX ? 1 : 5;
    const cls = (d) => { const cl = VX._.clsOf(nbS[d]); return cl === AIR || cl === OTHER || cl === DOOR ? 1 : 0; };
    return (same(nbS[r], sp) ? 1 : 0) | (same(nbS[l], sp) ? 2 : 0) | (same(nbS[2], sp) ? 4 : 0) | (same(nbS[3], sp) ? 8 : 0) | (cls(r) << 4) | (cls(l) << 5) | (cls(2) << 6) | (cls(3) << 7);
  };
  VX.ctxHook.dome = (c, sp, s, nbS) => flat4(c, sp, s, nbS);
  VX.ctxHook.palmcrown = (c, sp, s, nbS) => { let m = 0; for (const [k, d] of [[0, 0], [1, 1], [2, 4], [3, 5]]) { const o = VX._.specOf(nbS[d]); if (o && o.kind === 'palmfrond') m |= 1 << k; } return m; };
  VX.ctxHook.palmtrunk = (c, sp, s, nbS) => { const up = VX._.specOf(nbS[2]); return (up && (up.kind === 'palmtrunk' || up.kind === 'palmcrown') ? 1 : 0) | (same(nbS[3], sp) ? 2 : 0); };

  // ---------------------------------------------------------------- painters
  // HOLO SCREEN: translucent pane on a wall (wall behind at local +z), glowing UI; neighbours merge into one screen
  PAINT_FN.holo = function (s, c) {
    G.fill(0);
    const m = c.x, R_ = m & 1, L_ = (m >> 1) & 1, U_ = (m >> 2) & 1, D_ = (m >> 3) & 1;
    const glow = s.glow || T.holo, frame = s.frame || T.dark;
    // pane
    for (let v = 0; v < 8; v++) for (let u = 0; u < 8; u++) put(u, v, 6, s.bg || T.holoBg, GLASS);
    // frame where the screen ends
    for (let v = 0; v < 8; v++) for (let u = 0; u < 8; u++) {
      const edge = (!L_ && u === 0) || (!R_ && u === 7) || (!D_ && v === 0) || (!U_ && v === 7);
      if (edge) { put(u, v, 6, frame, GLOSS); put(u, v, 7, frame); put(u, v, 5, frame, GLOSS); }
    }
    // glowing rim just inside the frame
    for (let v = 0; v < 8; v++) for (let u = 0; u < 8; u++) {
      const rim = (!L_ && u === 1 && v > 0 && v < 7) || (!R_ && u === 6 && v > 0 && v < 7) || (!D_ && v === 1 && u > 0 && u < 7) || (!U_ && v === 6 && u > 0 && u < 7);
      if (rim && !get(u, v, 5)) put(u, v, 5, glow, EMIS | HOLO);
    }
    // content: one widget per block, picked from the block's place in the screen and its position hash
    const lo = (!L_ ? 2 : 0), hi = (!R_ ? 5 : 7), bo = (!D_ ? 2 : 0), to = (!U_ ? 5 : 7);
    const P = (u, v, col) => { if (u >= lo && u <= hi && v >= bo && v <= to && !(get(u, v, 5) & PRESENT)) put(u, v, 5, col || glow, EMIS | HOLO); };
    const widget = !L_ ? 0 : (hh(c.px + c.h * 2, c.py, c.pz, 55) % 5);
    const cu = (lo + hi) / 2, cv = (bo + to) / 2;
    if (widget === 0) { // radar: ring, crosshair, blip
      for (let v = 0; v < 8; v++) for (let u = 0; u < 8; u++) { const r = Math.hypot(u - cu, v - cv); if (Math.abs(r - 2.2) < 0.55) P(u, v); }
      P(Math.round(cu), Math.round(cv)); P(Math.round(cu) + 1, Math.round(cv) + 1, T.amber);
    } else if (widget === 1) { // bar chart
      for (let u = lo; u <= hi; u++) { const h = 1 + (hh(u, c.h, c.py, 7) % (to - bo + 1)); for (let v = bo; v < bo + h && v <= to; v++) P(u, v, (u & 1) ? glow : T.cyanL); }
    } else if (widget === 2) { // text lines
      for (let v = to; v >= bo; v -= 2) { const len = 2 + (hh(v, c.h, c.px, 3) % (hi - lo)); for (let u = lo; u <= Math.min(hi, lo + len); u++) P(u, v); }
    } else if (widget === 3) { // waveform
      for (let u = lo; u <= hi; u++) P(u, Math.round(cv + Math.sin(u * 1.3 + c.h) * 1.6));
    } else { // map grid with a marker
      for (let v = bo; v <= to; v++) for (let u = lo; u <= hi; u++) if (((u - lo) % 3 === 0) || ((v - bo) % 3 === 0)) P(u, v, T.cyanD);
      P(lo + 2, bo + 1, T.amber);
    }
    rotateGrid(c.facing);
  };

  // CONSOLE DESK: operator stands in front (local -z); joins into long desks; lit buttons, a small screen
  PAINT_FN.tconsole = function (s, c) {
    G.fill(0);
    const R_ = c.x & 1, L_ = (c.x >> 1) & 1;
    const body = s.col, top = s.top || T.dark, trim = s.trim || T.whiteD;
    // cabinet
    box(0, 0, 3, 7, 3, 7, (x, y, z) => (y === 3 ? trim : ((x + y) & 1 ? body : sh(body, 0.96))));
    box(0, 0, 2, 7, 0, 2, sh(body, 0.8)); // kick plate
    // sloped deck: z 0..4 rising toward the back
    for (let z = 0; z <= 7; z++) { const y = 4 + (z >= 5 ? 1 : 0) + (z >= 7 ? 1 : 0); for (let x = 0; x < 8; x++) { put(x, y, z, top, GLOSS); if (z < 3) put(x, 3, z, sh(body, 0.9)); } }
    // side panels where the desk ends
    if (!L_) box(0, 0, 0, 0, 5, 7, sh(body, 0.94));
    if (!R_) box(7, 0, 0, 7, 5, 7, sh(body, 0.94));
    // buttons on the deck (rows of colours), small screen at the back
    for (let z = 1; z <= 3; z++) for (let x = 1; x <= 6; x++) {
      const q = hh(x + c.px * 8, z, c.pz * 8 + c.h, 17);
      if ((q & 3) === 0) continue;
      put(x, 5, z, BTN[(q >> 3) & 7], EMIS);
    }
    for (let x = 1; x <= 6; x++) { put(x, 6, 6, s.screen || T.holo, EMIS | HOLO); put(x, 7, 6, (x & 1) ? T.cyanD : (s.screen || T.holo), EMIS | HOLO); }
    box(0, 6, 7, 7, 7, 7, top);
    rotateGrid(c.facing);
  };

  // HEX LIGHT: hexagonal light panel on the ceiling (hanging) or the floor; neighbours link with light bars
  PAINT_FN.hexlight = function (s, c) {
    G.fill(0);
    const y = c.head ? 7 : 0, y2 = c.head ? 6 : 1;
    const glow = s.glow || 0xE8FFFF, frame = s.frame || T.grayD;
    for (let z = 0; z < 8; z++) for (let x = 0; x < 8; x++) {
      const X = x - 3.5, Z = z - 3.5;
      const hx = Math.max(Math.abs(X) * 0.866 + Math.abs(Z) * 0.5, Math.abs(Z));
      if (hx <= 2.4) { put(x, y, z, frame); put(x, y2, z, glow, EMIS); }
      else if (hx <= 3.4) { put(x, y, z, frame, GLOSS); put(x, y2, z, (hx <= 2.9) ? glow : frame, (hx <= 2.9) ? EMIS : GLOSS); }
    }
    // light bars toward linked neighbours
    const m = c.x;
    const bar = (x0, z0, x1, z1) => { box(x0, y, z0, x1, y, z1, frame); box(x0, y2, z0, x1, y2, z1, glow, EMIS); };
    if (m & 1) bar(6, 3, 7, 4); if (m & 2) bar(0, 3, 1, 4); if (m & 4) bar(3, 6, 4, 7); if (m & 8) bar(3, 0, 4, 1);
  };

  // GLASS WALL: framed glass pane in the block's plane; neighbours merge into one big glazing
  PAINT_FN.glasswall = function (s, c) {
    G.fill(0);
    const alongX = (c.facing & 1) === 0; // pane along x (faces ±z) or along z
    const m = c.x, R_ = m & 1, L_ = (m >> 1) & 1, U_ = (m >> 2) & 1, D_ = (m >> 3) & 1;
    const frame = s.frame || T.white, glass = s.glassCol || 0xB8E8FF;
    const P = (u, v, dp, col, f) => { if (alongX) put(u, v, dp, col, f); else put(dp, v, u, col, f); };
    for (let v = 0; v < 8; v++) for (let u = 0; u < 8; u++) {
      const edge = (!L_ && u === 0) || (!R_ && u === 7) || (!D_ && v === 0) || (!U_ && v === 7);
      const mull = s.mullion && (u === 7 && R_) && ((c.px + c.pz) & 1); // a slim mullion every other block
      if (edge || mull) for (let dp = 2; dp <= 5; dp++) P(u, v, dp, (dp === 2 || dp === 5) && s.glowEdge ? s.glowEdge : frame, (dp === 2 || dp === 5) && s.glowEdge ? EMIS : GLOSS);
      else { P(u, v, 3, glass, GLASS); P(u, v, 4, glass, GLASS); }
    }
    if (!D_ && s.sill) for (let u = 0; u < 8; u++) for (let dp = 1; dp <= 6; dp++) P(u, 0, dp, s.sill, GLOSS);
  };

  // TECH RAILING: glass panels with a glowing top rail between posts
  PAINT_FN.trail = function (s, c) {
    G.fill(0);
    const post = s.col, glow = s.glow || T.cyan;
    box(3, 0, 3, 4, 7, 4, post, GLOSS); put(3, 7, 3, glow, EMIS); put(4, 7, 4, glow, EMIS); put(3, 7, 4, glow, EMIS); put(4, 7, 3, glow, EMIS);
    for (let k = 0; k < 4; k++) {
      if (!((c.x >> k) & 1)) continue;
      const d = [5, 0, 4, 1][k];
      for (let t = 0; t < 3; t++) {
        const [x0, z0] = d === 5 ? [3, t] : d === 4 ? [3, 7 - t] : d === 0 ? [7 - t, 3] : [t, 3];
        const along = d === 0 || d === 1;
        const X1 = along ? x0 : x0 + 1, Z1 = along ? z0 + 1 : z0;
        box(x0, 7, z0, X1, 7, Z1, glow, EMIS);
        box(x0, 6, z0, X1, 6, Z1, post, GLOSS);
        box(x0, 1, z0, X1, 5, Z1, s.glass || 0xB8E8FF, GLASS);
        box(x0, 0, z0, X1, 0, Z1, post);
      }
    }
  };

  // OCTAGON FRAME: portal / hangar-door ring; corner blocks chamfer toward the opening, glowing inner edge
  PAINT_FN.oframe = function (s, c) {
    G.fill(0);
    const alongX = (c.facing & 1) === 0;
    const m = c.x, R_ = m & 1, L_ = (m >> 1) & 1, U_ = (m >> 2) & 1, D_ = (m >> 3) & 1;
    const oR = (m >> 4) & 1, oL = (m >> 5) & 1, oU = (m >> 6) & 1, oD = (m >> 7) & 1;
    const P = (u, v, dp, col, f) => { if (alongX) put(u, v, dp, col, f); else put(dp, v, u, col, f); };
    // which corner opens onto the hole: the frame runs on two perpendicular sides, the opening is diagonal
    let cut = -1; // 0: lower-right, 1: lower-left, 2: upper-right, 3: upper-left
    if (R_ && D_ && !L_ && !U_) cut = 0; else if (L_ && D_ && !R_ && !U_) cut = 1; else if (R_ && U_ && !L_ && !D_) cut = 2; else if (L_ && U_ && !R_ && !D_) cut = 3;
    const inCut = (u, v) => cut === 0 ? (u - v) > 0.5 : cut === 1 ? ((7 - u) - v) > 0.5 : cut === 2 ? (u - (7 - v)) > 0.5 : cut === 3 ? ((7 - u) - (7 - v)) > 0.5 : false;
    const onCut = (u, v) => cut === 0 ? (u - v) === 0 || (u - v) === 1 : cut === 1 ? ((7 - u) - v) === 0 || ((7 - u) - v) === 1 : cut === 2 ? (u - (7 - v)) === 0 || (u - (7 - v)) === 1 : cut === 3 ? ((7 - u) - (7 - v)) === 0 || ((7 - u) - (7 - v)) === 1 : false;
    for (let v = 0; v < 8; v++) for (let u = 0; u < 8; u++) {
      if (inCut(u, v)) continue;
      const glowEdge = onCut(u, v) || (cut < 0 && ((oD && v === 0 && !D_) || (oU && v === 7 && !U_) || (oR && u === 7 && !R_) || (oL && u === 0 && !L_)));
      for (let dp = 0; dp < 8; dp++) {
        const face = dp === 0 || dp === 7;
        let col = s.col, f = GLOSS;
        if (glowEdge && (dp === 1 || dp === 6)) { col = s.glow || T.cyan; f = EMIS; }
        else if (face) { const U = (alongX ? c.px : c.pz) * 8 + u, V = c.py * 8 + v; col = (U % 8 === 0 || V % 8 === 0) ? s.col2 : sh(s.col, ((U + V) & 1) ? 1 : 0.97); }
        else col = sh(s.col, 0.85);
        P(u, v, dp, col, f);
      }
    }
  };

  // FURNITURE ------------------------------------------------------------------------------
  PAINT_FN.stool = function (s, c) {
    G.fill(0);
    box(3, 0, 3, 4, 3, 4, T.grayD, GLOSS);
    for (let z = 0; z < 8; z++) for (let x = 0; x < 8; x++) { const r = Math.hypot(x - 3.5, z - 3.5); if (r <= 2.2) put(x, 0, z, T.grayDD); if (r <= 3.2) { put(x, 4, z, s.col, GLOSS); if (r <= 2.6) put(x, 5, z, s.cushion || s.col); } }
  };
  PAINT_FN.sofa = function (s, c) {
    G.fill(0);
    const R_ = c.x & 1, L_ = (c.x >> 1) & 1, col = s.col, dk = sh(col, 0.82);
    box(0, 0, 1, 7, 0, 7, T.grayDD);                   // plinth
    box(0, 1, 1, 7, 2, 7, dk);                         // base
    box(0, 3, 1, 7, 3, 5, (x) => ((x === 0 && !L_) || (x === 7 && !R_)) ? dk : ((x & 3) === 0 && x > 0 ? sh(col, 0.9) : col)); // seat cushions
    box(0, 3, 6, 7, 6, 7, (x, y) => y === 6 ? sh(col, 1.06) : ((x & 3) === 0 && x > 0 ? sh(col, 0.9) : col));                 // backrest
    if (!L_) box(0, 3, 1, 1, 5, 7, (x, y) => y === 5 ? sh(col, 1.08) : dk);
    if (!R_) box(6, 3, 1, 7, 5, 7, (x, y) => y === 5 ? sh(col, 1.08) : dk);
    if (s.pillow && (c.h & 1)) box(L_ ? 2 : 2, 4, 5, L_ ? 3 : 3, 5, 5, s.pillow);
    rotateGrid(c.facing);
  };
  PAINT_FN.tdesk = function (s, c) {
    G.fill(0);
    box(0, 5, 0, 7, 5, 7, s.col, GLOSS); box(0, 4, 0, 7, 4, 0, sh(s.col, 0.9));
    box(0, 0, 1, 0, 4, 6, T.grayD); box(7, 0, 1, 7, 4, 6, T.grayD);
    box(1, 1, 6, 6, 3, 6, sh(s.col, 0.9));
    // a slim monitor and a lamp dot
    box(2, 6, 6, 5, 7, 6, T.dark); box(2, 6, 5, 5, 7, 5, T.holo, EMIS | HOLO); put(3, 6, 7, T.grayD);
    if (c.h & 1) put(6, 6, 2, T.amber, EMIS);
    rotateGrid(c.facing);
  };
  PAINT_FN.locker = function (s, c) {
    G.fill(0);
    box(0, 0, 2, 7, 7, 7, (x, y, z) => (x === 0 || x === 7 || y === 0 || y === 7) ? sh(s.col, 0.85) : (x === 3 || x === 4 ? T.grayD : s.col));
    for (const x0 of [1, 5]) { for (let y = 5; y <= 6; y++) for (let x = x0; x <= x0 + 1; x++) put(x, y, 1, (y & 1) ? T.grayD : sh(s.col, 0.8)); put(x0 === 1 ? 2 : 5, 3, 1, T.grayDD); }
    put(1, 1, 1, (c.h & 1) ? T.green : T.red, EMIS);
    rotateGrid(c.facing);
  };
  PAINT_FN.tplanter = function (s, c) {
    G.fill(0);
    box(0, 0, 0, 7, 2, 7, (x, y, z) => (x === 0 || x === 7 || z === 0 || z === 7) ? (y === 2 ? sh(s.col, 1.05) : s.col) : C.soil, GLOSS);
    if (s.glow) for (let x = 1; x < 7; x++) { put(x, 1, 0, s.glow, EMIS); put(x, 1, 7, s.glow, EMIS); }
    // big tropical leaves: a few arching blades from the centre
    const g1 = 0x2E8A3A, g2 = 0x4EB84A, g3 = 0x7AD85A;
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + (c.h & 3) * 0.4, len = 3 + (hh(k, c.h, c.px, 5) & 1);
      for (let t = 0; t <= len * 2; t++) {
        const r = t * 0.5, y = 3 + Math.round(Math.sin((t / (len * 2)) * Math.PI) * 3.2 + (1 - t / (len * 2)) * 0.5);
        const x = Math.round(3.5 + Math.cos(a) * r), z = Math.round(3.5 + Math.sin(a) * r);
        if (x < 0 || x > 7 || z < 0 || z > 7 || y > 7) continue;
        put(x, y, z, t > len ? g3 : (t & 1 ? g1 : g2));
      }
    }
    box(3, 3, 3, 4, 4, 4, g1);
  };
  PAINT_FN.holotable = function (s, c) {
    G.fill(0);
    for (let z = 0; z < 8; z++) for (let x = 0; x < 8; x++) {
      const r = Math.hypot(x - 3.5, z - 3.5);
      if (r <= 3.9) put(x, 3, z, r > 3.1 ? (s.glow || T.cyan) : T.dark, r > 3.1 ? EMIS : GLOSS);
      if (r <= 1.6) { put(x, 2, z, T.grayD); put(x, 1, z, T.grayD); }
      if (r <= 2.7) put(x, 0, z, T.grayDD);
    }
    // the hologram: a little ringed planet floating above
    for (let y = 4; y < 8; y++) for (let z = 1; z < 7; z++) for (let x = 1; x < 7; x++) {
      const d = Math.hypot(x - 3.5, (y - 5.5) * 1.1, z - 3.5);
      if (d <= 1.6) put(x, y, z, (y + x) & 1 ? T.holo : T.cyanL, EMIS | HOLO);
      else if (y === 5 && Math.abs(Math.hypot(x - 3.5, z - 3.5) - 2.5) < 0.5) put(x, y, z, T.amber, EMIS | HOLO);
    }
  };

  // NATURE -----------------------------------------------------------------------------
  const PALM = { bark: 0x8A6A44, ring: 0x6A4E30, light: 0xA88A5E, l1: 0x2E8A34, l2: 0x4AB046, l3: 0x74D25A, nut: 0x6A4A2A };
  PAINT_FN.palmtrunk = function (s, c) {
    G.fill(0);
    const top = c.x & 1;
    const lean = ((hh(c.px, 0, c.pz, 9) & 1) ? 1 : 0);
    if (s.royal || s.shaft) {
      // royal palm: a smooth, slightly tapered grey trunk with faint leaf-scar rings; the crownshaft is glossy green
      const base = s.shaft ? 0x5E8A4A : 0x9A9A92, dark = s.shaft ? 0x4A7038 : 0x7E7E76, lite = s.shaft ? 0x76A05E : 0xB4B4AC;
      for (let y = 0; y < 8; y++) { const ring = !s.shaft && ((y + c.py * 8) % 5) === 0; box(2, y, 2, 5, y, 5, (x, yy, z) => ((x === 2 || x === 5) && (z === 2 || z === 5)) ? null : ring ? dark : ((x + z) & 1 ? base : lite), s.shaft ? GLOSS : 0); }
      if (!top && !(c.x & 2) && !s.shaft) { box(1, 0, 1, 6, 0, 6, (x, y, z) => ((x === 1 || x === 6) && (z === 1 || z === 6)) ? null : dark); }
      return;
    }
    for (let y = 0; y < 8; y++) {
      const ring = ((y + c.py * 8) % 3) === 0;
      const x0 = 3 + (y >= 4 ? lean : 0) - (ring ? 1 : 0), x1 = 4 + (y >= 4 ? lean : 0) + (ring ? 1 : 0);
      box(x0, y, ring ? 2 : 3, x1, y, ring ? 5 : 4, (x, yy, z) => ring ? ((x + z) & 1 ? PALM.ring : PALM.bark) : ((x + z + yy) & 1 ? PALM.bark : PALM.light));
    }
    if (!top && !(c.x & 2)) { box(2, 0, 2, 5, 0, 5, PALM.ring); } // flared base
  };
  PAINT_FN.palmcrown = function (s, c) {
    G.fill(0);
    box(3, 0, 3, 4, 3, 4, PALM.bark);
    for (const [x, z] of [[2, 3], [5, 4], [3, 5], [4, 2]]) box(x, 2, z, x, 3, z, PALM.nut);
    // fronds radiating from the top: up, then arching down to the block edge
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]];
    for (let k = 0; k < dirs.length; k++) {
      const [dx, dz] = dirs[k];
      const linked = k < 4 && ((c.x >> [0, 1, 2, 3][k]) & 1); // a frond block continues it: stay high at the edge
      for (let t = 0; t <= 8; t++) {
        const r = t * 0.5, x = Math.round(3.5 + dx * r), z = Math.round(3.5 + dz * r);
        const y = linked ? 6 + Math.round(Math.sin(t / 8 * Math.PI) * 1) : 4 + Math.round(Math.sin((t / 8) * Math.PI) * 3 - t * 0.2);
        if (x < 0 || x > 7 || z < 0 || z > 7 || y < 0 || y > 7) continue;
        put(x, y, z, t > 5 ? PALM.l3 : (t & 1 ? PALM.l1 : PALM.l2));
        // leaflets
        const px = Math.round(x - dz), pz = Math.round(z + dx), qx = Math.round(x + dz), qz = Math.round(z - dx);
        if (t > 1 && y > 0) { if (px >= 0 && px < 8 && pz >= 0 && pz < 8) put(px, y - 1, pz, PALM.l1); if (qx >= 0 && qx < 8 && qz >= 0 && qz < 8) put(qx, y - 1, qz, PALM.l2); }
      }
    }
    box(3, 4, 3, 4, 6, 4, PALM.l1);
  };
  // one long frond: from the crown side (local +z, high) out to the tip (local -z), drooping
  PAINT_FN.palmfrond = function (s, c) {
    G.fill(0);
    for (let t = 0; t < 16; t++) {
      const z = 7 - Math.floor(t / 2), p = t / 15;
      const y = Math.round(6.4 - p * p * 6.2);
      const w = Math.max(0, Math.round((1 - p) * 3.2 + 0.4));
      put(3, y, z, PALM.l1); put(4, y, z, PALM.l1);
      for (let k = 1; k <= w; k++) {
        const yy = Math.max(0, y - Math.round(k * 0.6));
        put(3 - k, yy, z, (k + t) & 1 ? PALM.l2 : PALM.l3); put(4 + k, yy, z, (k + t) & 1 ? PALM.l3 : PALM.l2);
      }
    }
    rotateGrid(c.facing);
  };
  PAINT_FN.fern = function (s, c) {
    G.fill(0);
    const g1 = s.col || 0x3E9A3A, g2 = sh(g1, 1.25), g3 = sh(g1, 0.8);
    const n = 6 + (c.h & 1);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + c.h * 0.7;
      for (let t = 0; t <= 9; t++) {
        const r = t * 0.42, y = Math.round(Math.sin((t / 9) * Math.PI * 0.85) * 4.2 + 0.2);
        const x = Math.round(3.5 + Math.cos(a) * r), z = Math.round(3.5 + Math.sin(a) * r);
        if (x < 0 || x > 7 || z < 0 || z > 7) continue;
        put(x, y, z, t > 6 ? g2 : (t & 1 ? g1 : g3));
        if (t > 2 && t < 8) { const sx = Math.round(x - Math.sin(a)), sz = Math.round(z + Math.cos(a)); if (sx >= 0 && sx < 8 && sz >= 0 && sz < 8) put(sx, Math.max(0, y - 1), sz, g1); }
      }
    }
    box(3, 0, 3, 4, 1, 4, g3);
  };

  // DOME: a lone block is a small dome; two-by-two blocks make one big dome (mushroom-tower caps)
  PAINT_FN.dome = function (s, c) {
    G.fill(0);
    const m = c.x & 15, px = m & 1, nx = (m >> 1) & 1, pz = (m >> 2) & 1, nz = (m >> 3) & 1;
    const big = (px || nx) && (pz || nz);
    const cx = big ? (px ? 8 : 0) : 4, cz = big ? (pz ? 8 : 0) : 4, R0 = big ? 8.2 : 4.1;
    for (let y = 0; y < 8; y++) for (let z = 0; z < 8; z++) for (let x = 0; x < 8; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5, z + 0.5 - cz);
      if (d > R0) continue;
      const shell = d > R0 - 1.4;
      if (!shell && y > 0) continue;
      let col = s.col, f = GLOSS;
      const ang = Math.atan2(z + 0.5 - cz, x + 0.5 - cx);
      if (s.windows && shell && y >= (big ? 2 : 1) && y <= (big ? 3 : 1) && ((Math.round(ang * (big ? 6 : 3)) & 1) === 0)) { col = s.windows; f = EMIS; }
      if (y === 0) col = sh(s.col, 0.85);
      if (s.band && y === (big ? 1 : 0) && shell) col = s.band;
      put(x, y, z, col, f);
    }
    if (!big || (!px && !pz)) { /* the dome's top light sits at the centre */ }
    if (big && s.beacon) { const bx = px ? 7 : 0, bz = pz ? 7 : 0; put(bx, 7, bz, s.beacon, EMIS); }
  };

  // ---------------------------------------------------------------- kinds
  Object.assign(KIND, {
    holo: { cls: OTHER }, tconsole: { cls: OTHER }, hexlight: { cls: OTHER }, glasswall: { cls: OTHER }, trail: { cls: OTHER },
    oframe: { cls: WALL }, stool: { cls: OTHER }, sofa: { cls: OTHER }, tdesk: { cls: OTHER }, locker: { cls: OTHER }, tplanter: { cls: OTHER },
    holotable: { cls: OTHER }, palmtrunk: { cls: OTHER }, palmcrown: { cls: OTHER }, palmfrond: { cls: AIR }, fern: { cls: AIR }, dome: { cls: OTHER },
  });

  // ---------------------------------------------------------------- collision / selection
  const rotB = VX._.rotB;
  Object.assign(VX.boxHook, {
    holo: (s, sel, t, f) => [rotB([0, 0, 0.625, 1, 1, 1], f)],
    tconsole: () => [[0, 0, 0, 1, 0.8125, 1]],
    hexlight: (s, sel, t) => { const hang = t.has('head') && t.get(s, 'head'); return sel ? [hang ? [0.05, 0.75, 0.05, 0.95, 1, 0.95] : [0.05, 0, 0.05, 0.95, 0.25, 0.95]] : []; },
    glasswall: (s, sel, t, f) => [(f & 1) === 0 ? [0, 0, 0.25, 1, 1, 0.75] : [0.25, 0, 0, 0.75, 1, 1]],
    trail: (s, sel) => sel ? [[0.3, 0, 0.3, 0.7, 1, 0.7]] : [[0.3, 0, 0.3, 0.7, 1.5, 0.7]],
    stool: () => [[0.1, 0, 0.1, 0.9, 0.75, 0.9]],
    sofa: () => [[0, 0, 0.1, 1, 0.5, 1]],
    tdesk: () => [[0, 0, 0, 1, 0.75, 1]],
    locker: (s, sel, t, f) => [rotB([0, 0, 0.125, 1, 1, 1], f)],
    tplanter: () => [[0, 0, 0, 1, 0.4, 1]],
    holotable: () => [[0.05, 0, 0.05, 0.95, 0.5, 0.95]],
    palmtrunk: () => [[0.3, 0, 0.3, 0.7, 1, 0.7]],
    palmcrown: () => [[0.3, 0, 0.3, 0.7, 0.5, 0.7]],
    palmfrond: (s, sel) => sel ? [[0.1, 0, 0.1, 0.9, 0.9, 0.9]] : [],
    fern: (s, sel) => sel ? [[0.1, 0, 0.1, 0.9, 0.6, 0.9]] : [],
    dome: () => [[0, 0, 0, 1, 1, 1]],
  });
  Object.assign(VX.iconHook, {
    holo: (c) => { c.facing = 2; c.x = 0; }, tconsole: (c) => { c.facing = 2; }, sofa: (c) => { c.facing = 2; }, tdesk: (c) => { c.facing = 2; }, locker: (c) => { c.facing = 2; },
    glasswall: (c) => { c.facing = 0; c.x = 0; }, oframe: (c) => { c.facing = 0; c.x = 1 | 8 | 0x40; }, palmfrond: (c) => { c.facing = 1; }, hexlight: (c) => { c.head = 0; c.x = 0; },
    trail: (c) => { c.x = 0b0101; }, dome: (c) => { c.x = 0; }, palmtrunk: (c) => { c.x = 0; },
  });

  // ---------------------------------------------------------------- the blocks
  VX.defineExtra.push(function (K) {
    const { add, wall, FACING4 } = K;
    const G_ = K.G, grp = { group: G_.TECH || G_.ARCH, cat: 'vtech' };
    const A = (name, display, sp, o) => add(name, display, sp, Object.assign({}, grp, o || {}));
    const W = (name, display, sp, o) => wall(name, display, Object.assign({ bothSides: true, band: false, corner: 0 }, sp), Object.assign({ sound: 'metal', hard: 2.5 }, grp, o || {}));
    const FL = (name, display, sp, o) => add(name, display, Object.assign({ kind: 'floor', side: 0xB8C0CA, sidePat: 'techpanel', sideSpec: { col: 0xC8CFD8, col2: 0x7A848F } }, sp), Object.assign({ opaque: true, filter: 15, sound: 'metal', hard: 2 }, grp, o || {}));
    const HANG = ['head', 2];
    // walls
    W('vx_tech_white', 'White Tech Panel Wall', { pat: 'techpanel', col: T.white, col2: T.whiteD, gloss: true, plinth: 0xB8C0CA });
    W('vx_tech_white_strip', 'White Tech Wall · Light Strip', { pat: 'techpanel', col: T.white, col2: T.whiteD, gloss: true, strip: 10, glow: T.cyan }, { light: [2, 9, 11] });
    W('vx_tech_trim', 'White Tech Wall · Orange Trim', { pat: 'techpanel', col: T.white, col2: T.whiteD, gloss: true, strip: 1, glow: T.orange, accent: T.amber, accentGlow: false });
    W('vx_tech_band', 'White Tech Wall · Orange Band', { pat: 'techpanel', col: T.white, col2: T.whiteD, gloss: true, bandV: 3, band: T.orange, bandGlow: true });
    W('vx_tech_gray', 'Hangar Panel Wall', { pat: 'techpanel', col: T.gray, col2: T.grayDD, gloss: true, accent: T.orange, vent: true });
    W('vx_tech_dark_strip', 'Dark Hangar Wall · Light Strip', { pat: 'techpanel', col: 0x46505E, col2: T.darkD, gloss: true, strip: 11, strip2: 3, glow: T.cyan }, { light: [2, 9, 12] });
    W('vx_tech_hex', 'Hex Panel Wall', { pat: 'hexpanel', col: 0x7C8898, col2: T.darkD, gloss: true, glowCells: true, glow: T.cyan }, { light: [1, 5, 7] });
    W('vx_tech_hex_white', 'White Hex Wall', { pat: 'hexpanel', col: T.white, col2: T.whiteD, gloss: true });
    // floors
    FL('vx_floor_plaza', 'Plaza Tiles', { pat: 'plaza', col: 0xD6DBE2, col2: 0xAAB2BC });
    FL('vx_floor_plaza_line', 'Plaza Light-Line', { pat: 'line', col: 0xD6DBE2, col2: 0xAAB2BC, glow: T.cyan }, { light: [0, 3, 4] });
    FL('vx_floor_plaza_line_amber', 'Plaza Light-Line · Amber', { pat: 'line', family: 'amber', col: 0xD6DBE2, col2: 0xAAB2BC, glow: T.amber }, { light: [4, 2, 0] });
    FL('vx_floor_deck', 'Hangar Deck', { pat: 'deck', col: 0xAEB7C2, col2: 0x6E7884 });
    FL('vx_floor_hex', 'Hex Deck', { pat: 'hex', col: 0xA4AEBB, col2: 0x6A7482, seamGlow: true }, { light: [0, 3, 4] });
    FL('vx_floor_pad', 'Landing Pad Ring', { pat: 'pad', col: 0x5A6472, col2: 0x2E3440, glow: T.cyan, glow2: T.amber }, { light: [3, 8, 11] });
    // screens, consoles, lights
    A('vx_holo_screen', 'Holo Screen', { kind: 'holo', col: T.holo }, { props: [FACING4], kind: 'wallmount', filter: 0, light: [2, 8, 12], sound: 'glass', hard: 1 });
    A('vx_holo_screen_amber', 'Amber Holo Screen', { kind: 'holo', family: 'amber', col: T.amber, glow: 0xFFB04A, bg: 0x3A2208 }, { props: [FACING4], kind: 'wallmount', filter: 0, light: [11, 6, 1], sound: 'glass', hard: 1 });
    A('vx_console', 'Control Console', { kind: 'tconsole', col: 0xC8D0DA, top: 0x2E3440, screen: T.holo }, { props: [FACING4], filter: 0, light: [3, 6, 8], sound: 'metal', hard: 2 });
    A('vx_console_dark', 'Dark Control Console', { kind: 'tconsole', family: 'dark', col: 0x4A5462, top: 0x1E232B, trim: T.cyanD, screen: 0x7AFFB0 }, { props: [FACING4], filter: 0, light: [3, 7, 6], sound: 'metal', hard: 2 });
    A('vx_hex_light', 'Hex Ceiling Light', { kind: 'hexlight', col: 0xE8FFFF }, { props: [HANG], defaultIndex: 1, kind: 'hanglight', filter: 0, solid: false, light: [13, 15, 15], sound: 'glass', hard: 0.5 });
    A('vx_hex_light_cyan', 'Cyan Hex Light', { kind: 'hexlight', family: 'cyan', col: T.cyan, glow: T.cyan }, { props: [HANG], defaultIndex: 1, kind: 'hanglight', filter: 0, solid: false, light: [4, 13, 15], sound: 'glass', hard: 0.5 });
    // glass & frames
    A('vx_glass_wall', 'Tech Glass Wall', { kind: 'glasswall', col: 0xB8E8FF, frame: T.white, mullion: true }, { props: [FACING4], filter: 0, sound: 'glass', hard: 1 });
    A('vx_glass_wall_dark', 'Glowing Glass Wall', { kind: 'glasswall', family: 'dark', col: 0x8AD8FF, frame: T.dark, glowEdge: T.cyan, glassCol: 0x8AD8FF }, { props: [FACING4], filter: 0, light: [1, 5, 7], sound: 'glass', hard: 1 });
    A('vx_tech_railing', 'Glass Railing', { kind: 'trail', col: T.white, glow: T.cyan }, { filter: 0, light: [1, 6, 8], sound: 'metal', hard: 1 });
    A('vx_portal_frame', 'Octagon Portal Frame', { kind: 'oframe', col: 0x6E7A8A, col2: 0x3A424E, glow: T.cyan }, { props: [FACING4], opaque: false, filter: 15, light: [2, 8, 11], sound: 'metal', hard: 3 });
    A('vx_portal_frame_white', 'White Portal Frame', { kind: 'oframe', family: 'white', col: T.white, col2: T.whiteD, glow: T.orange }, { props: [FACING4], opaque: false, filter: 15, light: [9, 5, 1], sound: 'metal', hard: 3 });
    // furniture
    A('vx_stool', 'Tech Stool', { kind: 'stool', col: T.white, cushion: 0x3A6AD8 }, { filter: 0, sound: 'metal', hard: 1 });
    A('vx_stool_orange', 'Orange Stool', { kind: 'stool', col: T.white, cushion: T.orange }, { filter: 0, sound: 'metal', hard: 1 });
    A('vx_sofa_white', 'White Lounge Sofa', { kind: 'sofa', col: 0xECEEF2, pillow: T.orange }, { props: [FACING4], filter: 0, sound: 'wool', hard: 0.6 });
    A('vx_sofa_blue', 'Blue Lounge Sofa', { kind: 'sofa', family: 'blue', col: 0x3A5AB8, pillow: T.cyan }, { props: [FACING4], filter: 0, sound: 'wool', hard: 0.6 });
    A('vx_sofa_orange', 'Orange Lounge Sofa', { kind: 'sofa', family: 'orange', col: 0xE8782A, pillow: 0xF2F0EA }, { props: [FACING4], filter: 0, sound: 'wool', hard: 0.6 });
    A('vx_tech_desk', 'Tech Desk', { kind: 'tdesk', col: 0xF2F4F8 }, { props: [FACING4], filter: 0, light: [2, 6, 8], sound: 'metal', hard: 1 });
    A('vx_locker', 'Suit Locker', { kind: 'locker', col: 0xB4BEC8 }, { props: [FACING4], filter: 0, sound: 'metal', hard: 2 });
    A('vx_tech_planter', 'Tropical Planter', { kind: 'tplanter', col: 0xF0F2F6, glow: T.cyan }, { filter: 0, light: [1, 5, 7], sound: 'grass', hard: 0.5 });
    A('vx_holo_table', 'Holo Table', { kind: 'holotable', col: T.dark, glow: T.cyan }, { filter: 0, light: [3, 10, 14], sound: 'metal', hard: 1.5 });
    // city windows & street lamps (windows take on the tech wall around them)
    const WIN_ = (name, display, sp, o) => add(name, display, Object.assign({ kind: 'window', col: 0x9AF4FF }, sp), Object.assign({ props: [FACING4], filter: 0, layer: 'opaque', sound: 'glass', hard: 1 }, grp, o || {}));
    WIN_('vx_window_tech', 'Glowing City Window', { frame: T.amber, glassCol: 0x9AF4FF, glow: T.cyan, sill: T.white, frameFlags: GLOSS }, { light: [2, 8, 11] });
    WIN_('vx_window_tech_dark', 'Dark-Frame City Window', { frame: T.grayDD, glassCol: 0x8AE8FF, glow: 0x5AD8FF, sill: T.gray, frameFlags: GLOSS }, { light: [2, 7, 10] });
    A('vx_lamppost_tech', 'Tech Street Lamp', { kind: 'lamppost', col: 0xE0E6EE, post: 0xE0E6EE, glow: T.cyan }, { props: [['head', 2]], defaultIndex: 1, light: (p) => p.head ? [6, 13, 15] : null, filter: 0, sound: 'metal' });
    // nature & domes
    A('vx_palm_trunk', 'Palm Trunk', { kind: 'palmtrunk', col: PALM.bark }, { filter: 0, sound: 'wood', hard: 1 });
    A('vx_royal_trunk', 'Royal Palm Trunk', { kind: 'palmtrunk', col: 0x9A9A92, royal: true }, { filter: 0, sound: 'wood', hard: 1 });
    A('vx_palm_shaft', 'Palm Crownshaft', { kind: 'palmtrunk', col: 0x5E8A4A, shaft: true }, { filter: 0, sound: 'wood', hard: 1 });
    A('vx_palm_crown', 'Palm Crown', { kind: 'palmcrown', col: PALM.l2 }, { filter: 0, sound: 'grass', hard: 0.3 });
    A('vx_palm_frond', 'Palm Frond', { kind: 'palmfrond', col: PALM.l2 }, { props: [FACING4], kind: 'wallmount', filter: 0, solid: false, sound: 'grass', hard: 0.2 });
    A('vx_fern', 'Tropical Fern', { kind: 'fern', col: 0x3E9A3A }, { filter: 0, solid: false, sound: 'grass', hard: 0.1 });
    A('vx_fern_lush', 'Lush Fern', { kind: 'fern', family: 'lush', col: 0x5AB84A }, { filter: 0, solid: false, sound: 'grass', hard: 0.1 });
    A('vx_dome_white', 'White Dome', { kind: 'dome', col: 0xF2F4F8, windows: T.cyan, band: 0xC8D0DA }, { filter: 0, light: [1, 5, 7], sound: 'metal', hard: 2 });
    A('vx_dome_glass', 'Glass-Ring Dome', { kind: 'dome', family: 'glass', col: 0xE0E6EE, windows: 0xFFD27A, band: T.orange, beacon: T.red }, { filter: 0, light: [8, 6, 3], sound: 'metal', hard: 2 });
  });
  void glossK; void mix; void exposed; void NX; void NZ; void OPP; void F4D; void del; void I; void ROOF; void FLOOR; void SOLID; void WIN;
})(VR);

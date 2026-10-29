// ============================================================================
// t-hangar · the Hangar Hall's and the Gate Temple's own pieces (vgen 14, TRAILER.md §4; docs/trailer/frames
// t1_10–t1_19 as the composition, our own design):
//  · vx_hangar_navy / vx_hangar_navy_amber — the hall's navy panel walls (big panels with carved seams and a cyan,
//    or amber, light strip), vx_floor_hangar / vx_floor_hangar_line — its blue-grey tile deck and the cyan light
//    line that runs round the pad in concentric octagons.
//  · vm_hangar_screen (5 × 4 × 1, VX16) — a wall screen in a navy frame with cut corners and a glowing cyan rim:
//    one large round radar (three rings, a crosshair, a sweep, two blips) and a column of readouts beside it;
//    vm_hangar_screen_b — the same frame with a gauge ring and bars; readable from across the hall.
//  · vm_hangar_console (2 × 1 × 1, VX16) — a console desk: a light grey body with a cyan kick light, a sloped dark
//    top with rows of coloured keys and a small glowing screen at the back.
//  · temple_stone_dark (+ smooth, band, pilaster, light bar, slit) and amber_window_tall — the Gate Temple's dark
//    blue-grey stone and its tall warm windows; gate_glow (ring 0–3) — the portal's energy field, concentric octagon
//    bands from a white-gold core to a deep orange rim: a plain translucent emissive block (no shader of its own,
//    the same on every preset), not solid (ships and people pass through).
// Registered LATE (one VR.BL.late push after every older pack), so every older block keeps its state ids; the VX
// pieces use VX colours that exist already (no new 'vxcol:' texture name).
// ============================================================================
(function (VR) {
  'use strict';
  const VX = VR.VX, VM = VR.VM;
  if (!VX || !VX._ || !VM || !VR.BL) return;
  const H = VR.Hangar = VR.Hangar || {};
  const C = H.COL = {
    navy: 0x2D3C5A, navyD: 0x1A2436, navyL: 0x3E5274, frame: 0x223048, rim: 0x3AF0FF, rimL: 0xC8FFFF,
    bg: 0x123E78, bgL: 0x1C5296, cyan: 0x3AF0FF, cyanL: 0x9AFBFF, cyanD: 0x1A8AA8, amber: 0xFF9A2A, red: 0xFF4A4A,
    grey: 0xC8D0DA, greyD: 0x8C96A4, top: 0x2E3440, keyR: 0xFF4A4A, keyY: 0xFFE04A, keyG: 0x5AFF7A, keyB: 0x4A8AFF,
  };
  const NAMES = H.NAMES = [];
  const def = (name, display, o) => { VM.define(name, display, Object.assign({ res: 16, sound: 'glass', hard: 1, cat: 'vtech', cats: ['vtech'] }, o, { late: true, lazy: true })); NAMES.push(name); return name; };

  // ---------------------------------------------------------------- the screen frame (W × 4 blocks, model units)
  // the model's front is −z: the face plane sits at z 11–13, the frame stands out to z 10, the back plate at 13–16
  // against the wall. Corners cut at 45° (an octagonal frame), the cyan rim 1.5 units inside it.
  const frame = (b, M, W) => {
    const w = W * 16, h = 64, cut = 9;
    const fr = M.gloss(C.frame), back = M.matte(C.navyD), rim = M.light(C.rim), bg = M.light(C.bg);
    const inOct = (x, y, inset) => { const X = Math.min(x - inset, w - inset - x), Y = Math.min(y - inset, h - inset - y); return X >= 0 && Y >= 0 && X + Y >= cut - inset * 0.41; };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const cx = x + 0.5, cy = y + 0.5;
      if (!inOct(cx, cy, 0)) continue;
      b.set(x, y, 13, back); b.set(x, y, 14, back); b.set(x, y, 15, back);
      if (!inOct(cx, cy, 3)) { b.set(x, y, 11, fr); b.set(x, y, 12, fr); b.set(x, y, 10, fr); continue; }   // the frame
      if (!inOct(cx, cy, 4.5)) { b.set(x, y, 12, rim); b.set(x, y, 11, rim); continue; }                    // the glowing rim
      b.set(x, y, 12, bg);                                                                                  // the screen
    }
    return { w, h, put: (x, y, m) => { if (x >= 0 && y >= 0 && x < w && y < h) b.set(x | 0, y | 0, 12, m); } };
  };
  // a ring on the face (centre cx, cy, radius r, width t), optionally only between two angles
  const ring = (P, cx, cy, r, t, m, a0, a1) => {
    for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
      if (Math.abs(d - r) > t / 2) continue;
      if (a0 !== undefined) { const a = (Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2); if (a < a0 || a > a1) continue; }
      P(x, y, m);
    }
  };
  const disc = (P, cx, cy, r, m) => { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) P(x, y, m); };
  const rect = (P, x0, y0, x1, y1, m) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) P(x, y, m); };

  def('vm_hangar_screen', 'Hangar Screen · Radar', {
    size: [5, 4, 1], col: 0x253350, light: [2, 8, 12],
    build(b, M) {
      const F = frame(b, M, 5), P = F.put, cy = M.light(C.cyan), cl = M.light(C.cyanL), cd = M.light(C.cyanD), am = M.light(C.amber), rd = M.light(C.red), bl = M.light(C.bgL);
      // the radar: three rings, a crosshair with ticks, a sweep wedge and two blips (left two thirds)
      const X = 30, Y = 32;
      disc(P, X, Y, 22, bl);
      ring(P, X, Y, 22, 2.2, cy); ring(P, X, Y, 15, 1.4, cl); ring(P, X, Y, 8, 1.4, cy); disc(P, X, Y, 2.2, cl);
      for (let k = -21; k <= 21; k++) { if (Math.abs(k) > 3) { P(X + k, Y, cd); P(X, Y + k, cd); } }
      for (const [dx, dy] of [[26, 0], [-26, 0], [0, 26], [0, -26]]) rect(P, X + dx - (dx ? 1 : 1), Y + dy - (dy ? 1 : 1), X + dx + 1, Y + dy + 1, cy);
      ring(P, X, Y, 18.5, 5, cd, 0.35, 1.25);                     // the sweep
      disc(P, X + 9, Y + 11, 1.8, am); disc(P, X - 12, Y - 6, 1.6, rd);
      // the readouts: a header bar, five text lines, a small level gauge
      rect(P, 56, 50, 72, 53, cy);
      for (let k = 0; k < 5; k++) rect(P, 56, 43 - k * 5, 56 + [14, 10, 12, 8, 13][k], 45 - k * 5, k === 2 ? am : cl);
      ring(P, 64, 12, 6, 1.6, cy); ring(P, 64, 12, 6, 1.8, am, 4.2, 6.2); disc(P, 64, 12, 1.4, cl);
    },
  });
  def('vm_hangar_screen_b', 'Hangar Screen · Gauges', {
    size: [5, 4, 1], col: 0x253350, light: [2, 8, 12],
    build(b, M) {
      const F = frame(b, M, 5), P = F.put, cy = M.light(C.cyan), cl = M.light(C.cyanL), cd = M.light(C.cyanD), am = M.light(C.amber), bl = M.light(C.bgL);
      // a gauge ring with an amber arc and a needle (right), bars and a wave on the left
      const X = 52, Y = 32;
      disc(P, X, Y, 18, bl);
      ring(P, X, Y, 18, 2.2, cy); ring(P, X, Y, 12.5, 1.4, cd); ring(P, X, Y, 15, 2.4, am, 3.6, 5.6);
      for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; rect(P, X + Math.cos(a) * 9.5 - 0.5, Y + Math.sin(a) * 9.5 - 0.5, X + Math.cos(a) * 9.5 + 1, Y + Math.sin(a) * 9.5 + 1, cl); }
      for (let t = 0; t < 8; t += 0.5) P(X + Math.cos(0.9) * t, Y + Math.sin(0.9) * t, am);
      disc(P, X, Y, 2.4, cl);
      for (let k = 0; k < 5; k++) rect(P, 9 + k * 5, 10, 12 + k * 5, 10 + [16, 24, 12, 28, 20][k], k === 3 ? am : cy);
      for (let x = 9; x < 34; x++) P(x, 48 + Math.round(Math.sin(x * 0.55) * 3), cl);
      rect(P, 9, 55, 30, 57, cd);
    },
  });
  def('vm_hangar_console', 'Hangar Console', {
    size: [2, 1, 1], col: 0xC8D0DA, light: [3, 6, 8], sound: 'metal', hard: 2,
    build(b, M) {
      const body = M.gloss(C.grey), dark = M.gloss(C.top), trim = M.gloss(C.greyD), kick = M.light(C.cyan), scr = M.light(C.bgL), scrL = M.light(C.cyan);
      // the body (front −z: the operator's side), a recessed kick plinth with a light line
      b.box(1, 2, 2, 31, 9, 15, body);
      b.box(2, 0, 3, 30, 2, 14, trim); b.box(2, 0.5, 2.5, 30, 1.5, 3, kick);
      // the top: a dark slope rising toward the back in three steps, a lip in front
      b.box(0, 9, 1, 32, 10, 15, trim);
      b.box(1, 10, 1, 31, 11, 6, dark); b.box(1, 10, 6, 31, 12, 11, dark); b.box(1, 10, 11, 31, 13, 15, dark);
      // the keys: rows of coloured caps on the two front steps
      const KEYS = [C.keyR, C.keyY, C.keyG, C.cyan, C.keyB, C.amber];
      let k = 0;
      for (const [y, z0] of [[11, 2], [12, 7]]) for (let x = 3; x + 3 <= 30; x += 4) { const c = KEYS[(k++ * 7 + (y === 12 ? 3 : 0)) % KEYS.length]; b.box(x, y, z0, x + 3, y + 0.5, z0 + 3, M.light(c)); }
      // the screen at the back
      b.box(4, 13, 11.5, 28, 13.5, 14.5, scr);
      for (let x = 6; x < 26; x += 3) b.box(x, 13.4, 12.5 + (x % 2), x + 2, 13.6, 13.5 + (x % 2), scrL);
    },
  });

  // ---------------------------------------------------------------- registration: after every older block
  VR.BL.late = VR.BL.late || [];
  VR.BL.late.push(() => {
    const K = VM._K; if (!K) return;
    const G_ = K.G, R = VR.R, T = R.tex, F = VR.F, def2 = VR.BL.def, T_ = VX.TECH;
    const grp = { group: G_.TECH || G_.ARCH, cat: 'vtech' };
    // walls and floors (colours of VX pieces that exist already: navy 2d3c5a, deck 4a5462)
    K.wall('vx_hangar_navy', 'Navy Hangar Wall · Light Strip', { bothSides: true, band: false, corner: 0, pat: 'techpanel', col: C.navy, col2: C.navyD, gloss: true, strip: 12, glow: T_.cyan }, Object.assign({ sound: 'metal', hard: 2.5, light: [2, 7, 10] }, grp));
    K.wall('vx_hangar_navy_amber', 'Navy Hangar Wall · Amber Strip', { bothSides: true, band: false, corner: 0, pat: 'techpanel', col: C.navy, col2: C.navyD, gloss: true, strip: 12, glow: T_.amber }, Object.assign({ sound: 'metal', hard: 2.5, light: [9, 5, 1] }, grp));
    const FL = (name, display, sp, o) => K.add(name, display, Object.assign({ kind: 'floor', side: 0x4A5462, sidePat: 'techpanel', sideSpec: { col: 0x4A5462, col2: 0x2E3440 } }, sp), Object.assign({ opaque: true, filter: 15, sound: 'metal', hard: 2 }, grp, o || {}));
    FL('vx_floor_hangar', 'Hangar Tile Deck', { pat: 'plaza', col: 0x8D9AB2, col2: 0x5A6472 });   // (t1_13's floor is a light blue-grey: L 52 b −28)
    FL('vx_floor_hangar_line', 'Hangar Light-Line', { pat: 'line', family: 'hangar', col: 0x8D9AB2, col2: 0x5A6472, glow: T_.cyan }, { light: [0, 7, 9] });
    VM.registerLate(NAMES);
    // the Gate Temple's dark stone (texture recipes in src/main/tex_recipes4.js). The faces are named lazily — in
    // R.finalize, at these (the last) types — so the new texture names come after every older one and no older block's
    // texture layer moves (test/mesh_same.js)
    const stone = { cat: 'build', group: G_.HEART, tool: 'pick', needTool: true, sound: 'stone', hard: 2, blast: 8 };
    const sm = () => T('temple_stone_dark_smooth'), side = (n) => () => { const s = sm(); return { top: s, bottom: s, side: T(n) }; };
    def2('temple_stone_dark', Object.assign({ display: 'Dark Temple Stone', tex: () => T('temple_stone_dark') }, stone));
    def2('temple_stone_dark_smooth', Object.assign({ display: 'Smooth Dark Temple Stone', tex: sm }, stone));
    def2('temple_stone_dark_band', Object.assign({ display: 'Carved Dark Temple Band', tex: side('temple_stone_dark_band') }, stone));
    def2('temple_pilaster_dark', Object.assign({ display: 'Dark Temple Pilaster', props: [VR.PROPS.AXIS], tex: (p, s) => VR.axisTex(T('temple_pilaster_dark'), sm())(p, s) }, stone));
    def2('temple_light_bar_dark', Object.assign({ display: 'Orange Light Bar · Dark Stone', tex: side('temple_light_bar_dark'), light: [11, 5, 1], flags: F.EMISSIVE }, stone, { hard: 1 }));
    def2('temple_slit_dark', Object.assign({ display: 'Cyan Light Slit · Dark Stone', tex: side('temple_slit_dark'), light: [3, 9, 11], flags: F.EMISSIVE }, stone, { hard: 1 }));
    def2('amber_window_tall', Object.assign({ display: 'Tall Amber Window', tex: () => T('amber_window_tall'), light: [12, 7, 2], flags: F.EMISSIVE }, stone, { hard: 1, sound: 'glass' }));
    // the gate's energy field: four rings, each its own colour (the generator lays them as concentric octagons)
    def2('gate_glow', Object.assign({ display: 'Gate Glow', props: [['ring', 4]], tex: (p) => T('gate_glow_' + (p.ring | 0)), layer: 'trans', opaque: false, filter: 0, light: [10, 6, 2], flags: F.SELFCULL | F.EMISSIVE, solid: false }, stone, { hard: 50, blast: 500, sound: 'glass' }));
  });
})(VR);

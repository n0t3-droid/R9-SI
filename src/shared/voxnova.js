// ============================================================================
// Villa Nova pieces (the trailer's house, docs/trailer/frames t1_26 · t3_05 ·
// t2_23 outside, t1_29 · t3_10 · t1_30 inside): what no older block could do.
//  · vx_nova_window — a fine (16³) VX piece that joins its neighbours in both
//    looks: any rectangle of these blocks in one wall plane is ONE window with
//    ONE thick glowing orange frame at its outer edge, a dark reveal and glowing
//    turquoise glass (lighter at the top, a faint course line every half block).
//    The frame also closes against whatever is not a nova window (a door), so the
//    glazed screen round the entrance door is the same block.
//  · vm_nova_tread — a VX16 stair piece, two blocks wide and three high: two glass
//    treads (a rise of half a block each) with glowing cyan front edges, and on
//    both sides a stepped glass cheek with a steel cap; stacked one up and one
//    along per piece the treads make the floating stair and the cheeks join into
//    two glass stringers.
//  · vm_nova_pad — a VX32 3 × 1 × 3 white plinth with rounded corners, a recessed
//    glowing blue top with a cyan ring emblem and a cyan light line at its foot.
// All three are registered LATE (VR.BL.late, after the plants), so every older block
// keeps its state ids; their colours are VX colours that exist already, so no new
// texture name is registered (test/id_snapshot.js, test/mesh_same.js).
// ============================================================================
(function (VR) {
  'use strict';
  const VX = VR.VX, VM = VR.VM;
  if (!VX || !VX._ || !VM || !VR.BL) return;
  const { PAINT_FN } = VX._;
  const { EMIS, GLOSS, PRESENT } = VX;
  const N = VR.Nova = VR.Nova || {};
  const pack = (c, f) => ((c & 0xffffff) | PRESENT | (f || 0)) >>> 0;
  // the palette (TRAILER.md §2.2 city: frames #FF9A2A, glass #9AF4FF, glow cyan #3AF0FF)
  const COL = N.COL = {
    frameHi: 0xFFA43A, frame: 0xFF8A22, frameLo: 0xE8701A, reveal: 0x2C323B,
    glass: 0x46D2E4, glassHi: 0x86ECF6, glassLo: 0x2FB4C8, glassLine: 0x3AC2D4,
    cyan: 0x5AF0FF, white: 0xF4F5F7, blue: 0x1F5FD0, steel: 0x9AA4B0,
  };
  N.FRAME = 3;   // the frame's width in 1/16 block

  // ---------------------------------------------------------------- the joined window (kind 'novawin', 16³)
  // context: bit 0 the same window continues along +u (the plane's +x or +z), 1 along −u, 2 up, 3 down
  let selfType = null;
  const sameWin = (ns, c) => {
    if (!ns) return false;
    const R = VR.R, t = R.types[R.T.type[ns]];
    if (!t || t !== selfType) return false;
    return ((t.get(ns, 'facing') ^ c.facing) & 1) === 0;   // the same wall plane (a bay's corner is two windows)
  };
  VX.ctxHook.novawin = (c, sp, s, nbS) => {
    if (!selfType) selfType = VR.R.byName.vx_nova_window || null;
    const alongX = (c.facing & 1) === 0;
    return (sameWin(nbS[alongX ? 0 : 4], c) ? 1 : 0) | (sameWin(nbS[alongX ? 1 : 5], c) ? 2 : 0) | (sameWin(nbS[2], c) ? 4 : 0) | (sameWin(nbS[3], c) ? 8 : 0);
  };
  // what a cell of the 16 × 16 face shows: 0 frame (by ring k), 1 reveal, 2 glass — and the colour of the glass by row
  N.winCell = function (u, v, m) {
    const R_ = m & 1, L_ = (m >> 1) & 1, U_ = (m >> 2) & 1, D_ = (m >> 3) & 1, FW = N.FRAME;
    const e = Math.min(L_ ? 99 : u, R_ ? 99 : 15 - u, D_ ? 99 : v, U_ ? 99 : 15 - v);
    if (e < FW) return { kind: 'frame', ring: e };
    if (e === FW) return { kind: 'reveal' };
    let col = COL.glass;
    if (!U_ && v >= 10) col = COL.glassHi;            // the top of the window catches the light
    else if (!D_ && v <= 4) col = COL.glassLo;
    else if ((v & 7) === 0) col = COL.glassLine;      // a faint course line every half block
    return { kind: 'glass', col };
  };
  PAINT_FN.novawin = function (s, c) {
    const G = VX.gridFor(16), I16 = VX.I16;
    G.fill(0);
    const alongX = (c.facing & 1) === 0, m = c.x | 0;
    const put = (u, v, dp, col, fl) => { G[alongX ? I16(u, v, dp) : I16(dp, v, u)] = pack(col, fl); };
    for (let v = 0; v < 16; v++) for (let u = 0; u < 16; u++) {
      const w = N.winCell(u, v, m);
      if (w.kind === 'frame') { const col = w.ring === 0 ? COL.frameHi : w.ring === 1 ? COL.frame : COL.frameLo; for (let dp = 0; dp < 16; dp++) put(u, v, dp, col, EMIS); }
      else if (w.kind === 'reveal') { for (let dp = 1; dp < 15; dp++) put(u, v, dp, COL.reveal, GLOSS); }
      else for (let dp = 6; dp < 10; dp++) put(u, v, dp, w.col, EMIS);
    }
  };
  VX.KIND.novawin = { cls: VX.CLS.WIN };
  VX.boxHook.novawin = () => [[0, 0, 0, 1, 1, 1]];
  VX.iconHook.novawin = (c) => { c.facing = 0; c.x = 0; };

  // ---------------------------------------------------------------- the slab edge (kind 'novaband', 16³)
  // smooth light stone with a joint along its top; glow 'cyan': a cyan light line round its open sides; 'under': an
  // orange line along the foot of its open sides and an orange strip under it along them (the underglow of an
  // overhang); 'both': the two together. The open sides are the ones whose neighbour is air or a thin piece.
  const BAND_GLOW = N.BAND_GLOW = ['none', 'cyan', 'under', 'both'];
  let bandType = null;
  VX.ctxHook.novaband = (c, sp, s, nbS) => {
    if (!bandType) bandType = VR.R.byName.vx_nova_band || null;
    const R = VR.R, t = R.types[R.T.type[s]], g = t && t.has('glow') ? t.get(s, 'glow') : 0;
    const AIR = VX.CLS.AIR, OTHER = VX.CLS.OTHER;
    let open = 0;
    for (let d = 0; d < 6; d++) { const cl = c.nc[d]; if (cl === AIR || cl === OTHER) open |= 1 << d; }
    return g | (open << 2);
  };
  N.bandCol = { stone: 0xDCE0E4, joint: 0xB4BAC2, cyan: COL.cyan, orange: 0xFF8A22 };
  PAINT_FN.novaband = function (s, c) {
    const G = VX.gridFor(16), I16 = VX.I16, B = N.bandCol;
    const x = c.x | 0, g = x & 3, open = x >> 2, cyan = g === 1 || g === 3, under = g === 2 || g === 3;
    for (let y = 0; y < 16; y++) for (let z = 0; z < 16; z++) for (let xx = 0; xx < 16; xx++) G[I16(xx, y, z)] = pack(y === 15 ? B.joint : B.stone, 0);
    // the side faces: +x (d 0), −x (1), +z (4), −z (5) — a line two voxels high on the outermost voxel layer
    const side = (d, y0, y1, col) => {
      if (!((open >> d) & 1)) return;
      for (let y = y0; y <= y1; y++) for (let a = 0; a < 16; a++) {
        const i = d === 0 ? I16(15, y, a) : d === 1 ? I16(0, y, a) : d === 4 ? I16(a, y, 15) : I16(a, y, 0);
        G[i] = pack(col, EMIS);
      }
    };
    for (const d of [0, 1, 4, 5]) { if (cyan) side(d, 4, 5, B.cyan); if (under) side(d, 0, 1, B.orange); }
    // the underglow: the bottom layer within four voxels of an open side
    if (under && ((open >> 3) & 1)) for (let z = 0; z < 16; z++) for (let xx = 0; xx < 16; xx++) {
      const near = (((open >> 0) & 1) && xx >= 12) || (((open >> 1) & 1) && xx <= 3) || (((open >> 4) & 1) && z >= 12) || (((open >> 5) & 1) && z <= 3);
      if (near) G[I16(xx, 0, z)] = pack(B.orange, EMIS);
    }
  };
  VX.KIND.novaband = { cls: VX.CLS.WALL };
  VX.boxHook.novaband = () => [[0, 0, 0, 1, 1, 1]];
  VX.iconHook.novaband = (c) => { c.x = 1 | (0b110011 << 2); };

  // ---------------------------------------------------------------- the floating glass stair (2 × 3 × 1, VX16)
  // model units: 16 per block (res 16: one voxel per unit); facing 0 = the front (−z) is the low end, the treads rise
  // toward +z. The lowest row holds the two treads; the two rows over it hold the glass cheeks: on both sides a pane
  // from half a block under the nosing line to a block over it, in steps of two units (eight a block — a staircase of
  // glass, cheap to mesh: a smooth slant costs ten times the quads), capped with a steel line. Stacked one up and one
  // along, the cheeks of the pieces join into one glass stringer (a pane wholly inside the piece's own cells).
  const NAMES = N.NAMES = [];
  const def = (name, display, o) => { VM.define(name, display, Object.assign({ res: 32, sound: 'glass', hard: 1, cat: 'vtech', cats: ['vtech'] }, o, { late: true, lazy: true })); NAMES.push(name); return name; };
  N.CHEEK = { step: 2, below: 8, above: 16, cap: 2 };   // the cheek against the nosing line y = z + 8 (model units)
  def('vm_nova_tread', 'Glass Stair Tread', {
    // (only the tread row glows: parts 0 and 1)
    size: [2, 3, 1], res: 16, col: 0xBFE6FF, light: (p) => (p.part < 2 ? [2, 7, 9] : null),
    build(b, M) {
      const glass = M.glass(0xCFF6FA), pane = M.glass(0xB4ECF4), led = M.light(COL.cyan), cap = M.metal(0xC8D0D8), C = N.CHEEK;
      for (const [y0, z0] of [[7, 0], [15, 8]]) {
        b.box(1, y0, z0, 31, y0 + 1, z0 + 8, glass);                    // the glass tread, half a block deep
        b.box(1, y0, z0, 31, y0 + 1, z0 + 1, led);                      // its glowing front edge
      }
      for (const [x0, x1] of [[0, 1], [31, 32]]) for (let z = 0; z < 16; z += C.step) {
        const y0 = z + 8 - C.below, y1 = z + 8 + C.above;
        b.box(x0, y0, z, x1, y1 - C.cap, z + C.step, pane);             // the glass cheek
        b.box(x0, y1 - C.cap, z, x1, y1, z + C.step, cap);              // its steel cap
      }
    },
  });

  // ---------------------------------------------------------------- the pad with the ring (3 × 1 × 3, VX32)
  def('vm_nova_pad', 'Light Pad', {
    size: [3, 1, 3], col: 0xF0F2F6, light: [3, 8, 12], sound: 'stone', hard: 1.5,
    build(b, M) {
      const white = M.gloss(COL.white), cyan = M.light(COL.cyan), blue = M.light(COL.blue), deep = M.light(0x163E96);
      b.pbox(2.5, 0, 2.5, 45.5, 1.5, 45.5, 5, cyan);                      // the light line at the foot
      b.pbox(1, 1.5, 1, 47, 11, 47, 6, white);                            // the white plinth, rounded corners
      b.pbox(5, 8.5, 5, 43, 11, 43, 3, 0);                                // the recess in its top
      b.pbox(5, 8.5, 5, 43, 9, 43, 3, deep);                              // the glowing screen, darker at the rim
      b.pbox(7, 8.5, 7, 41, 9.2, 41, 3, blue);
      for (const [r, w] of [[13, 1.4], [8.5, 1.1]]) b.tube('y', 24, 24, r, w, 9.2, 9.7, cyan);   // the ring emblem
      b.cyl('y', 24, 24, 2.4, 9.2, 9.7, cyan);
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; b.rod(24 + Math.cos(a) * 3.5, 9.45, 24 + Math.sin(a) * 3.5, 24 + Math.cos(a) * 7, 9.45, 24 + Math.sin(a) * 7, 0.45, cyan); }
    },
  });

  // ---------------------------------------------------------------- registration: after every older block
  VR.BL.late = VR.BL.late || [];
  VR.BL.late.push(() => {
    const K = VM._K; if (!K) return;
    const G_ = K.G;
    // (the window's colour is vx_window_tech's: its texture name exists already)
    K.add('vx_nova_window', 'Nova Window · Orange Frame', { kind: 'novawin', res: 16, col: 0x9AF4FF }, { props: [K.FACING4], filter: 0, light: [7, 6, 4], sound: 'glass', hard: 1, group: G_.TECH || G_.ARCH, cat: 'vtech' });
    // (the band's colour is vx_tech_white's: its texture name exists already)
    K.add('vx_nova_band', 'Nova Slab Edge · Light Line', { kind: 'novaband', res: 16, col: 0xE9EDF2 }, { props: [['glow', BAND_GLOW]], filter: 15, opaque: true, light: (p) => (p.glow === 1 ? [1, 5, 6] : p.glow ? [7, 4, 1] : null), sound: 'stone', hard: 2, group: G_.TECH || G_.ARCH, cat: 'vtech' });
    VM.registerLate(NAMES);
  });
})(VR);

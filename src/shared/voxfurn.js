// ============================================================================
// The designer furniture pack — VX32 models (voxmodel.js) for the villas:
// modular sofas, armchairs, tables, media walls, dining sets, kitchens, beds,
// wardrobes, desks, baths, lamps and plants at real proportions. Every model
// is a few lines of primitives in textured materials (fabric weave, leather
// grain, wood grain, marble veins, brushed steel) — the builder resolves them
// on a 32-voxel grid, so half units give real detail: piping seams, drawer
// grooves, tapered legs, taps, handles, folds and leaves.
// Front = −z (facing 0). Units: 16 = one block (half units allowed).
// ============================================================================
(function (VR) {
  'use strict';
  const VM = VR.VM;
  if (!VM) return;
  const M = VM.M, def = VM.define, sh = VR.VX.sh;
  // palettes
  const FAB = { charcoal: 0x3A3D44, cream: 0xECE6D8, taupe: 0xA89482, sage: 0x8FA38E, navy: 0x2F3F60, mustard: 0xD2A84A, white: 0xEEEEEA, rose: 0xC9A3A0, olive: 0x7E8560 };
  const WOOD = { walnut: 0x5C3D26, oak: 0xB89262, ash: 0xD9C6A5, black: 0x1A1A1C, smoked: 0x3E2E24 };
  const COL = { black: 0x1C1E22, chrome: 0xD8DEE4, brass: 0xC9A24A, white: 0xF2F2EE, marble: 0xEAEAEC, marbleD: 0x25272B, steel: 0xB8BEC6, warm: 0xFFD27A, screen: 0x1A2A44, leaf: 0x3E8A4A, leafL: 0x5AAE5A, soil: 0x4A3626, terracotta: 0xB0633C, concrete: 0xB4B0A6, water: 0x7AC8F0, glassT: 0xC8E6F6, paper: 0xF4F0E8 };
  const pillowCols = [FAB.mustard, FAB.sage, FAB.navy, FAB.rose, FAB.olive];
  VM.PAL = { FAB, WOOD, COL };

  // ------------------------------------------------------------------ small shared details
  // a slim steel leg (round, slightly tapered) at (cx, cz) from the floor to y1
  const steelLeg = (b, cx, cz, y1, col) => b.lathe(cx, cz, [[0, 0.8], [y1, 0.6]], M.metal(col || COL.black));
  // a diamond-shaped throw pillow leaning on a back cushion at x (centre), on top of y, against z
  const throwPillow = (b, cx, y, z, w, col) => b.extrude([[cx - w / 2, y], [cx, y + w / 2 + 0.5], [cx + w / 2, y], [cx, y - 0.5]], 'z', z, z + 2.5, M.fabric(col));
  // a folded throw blanket draped over an arm: three soft layers in a contrasting cloth
  const throwBlanket = (b, x0, x1, y, z0, z1, col) => { b.rbox(x0, y, z0, x1, y + 1, z1, 0.5, M.fabric(col)); b.rbox(x0 + 0.5, y + 1, z0 + 1, x1 - 0.5, y + 2, z1 - 2, 0.5, M.fabric(sh(col, 0.92))); b.rbox(x0 + 1, y + 2, z0 + 2, x1 - 1, y + 2.5, z1 - 4, 0.5, M.fabric(col)); };
  // a vase (lathe) with a few branches (rods) and leaf clusters
  const vaseBranches = (b, cx, cz, y0, h, col) => { b.lathe(cx, cz, [[y0, 1.2], [y0 + 1, 2], [y0 + h * 0.6, 1.5], [y0 + h, 1.1]], M.gloss(col), 0.5); for (let k = 0; k < 3; k++) { const a = k * 2.1, dx = Math.cos(a) * 2.5, dz = Math.sin(a) * 2; b.rod(cx, y0 + h - 1, cz, cx + dx, y0 + h + 4 + k, cz + dz, 0.35, M.plant(0x4E7A38)); b.ellipsoid(cx + dx, y0 + h + 4 + k, cz + dz, 1.4, 0.9, 1.1, M.plant(k & 1 ? COL.leaf : COL.leafL)); } };
  // a stack of books: n volumes of alternating colours with paper edges
  const books = (b, x, y, z, n, w, d) => { for (let k = 0; k < n; k++) { const c = [0x2F55C8, 0xC0443A, 0xE8B83A, 0x3E8A4A, 0x2A2D33, 0x8A5AC8][k % 6]; const h = 1 + (k % 2) * 0.5; b.box(x, y, z, x + w, y + h, z + d, M.matte(c)); b.box(x + 0.5, y + 0.25, z + 0.5, x + w - 0.5, y + h - 0.25, z + d - 0.5, M.matte(COL.paper)); b.box(x, y, z, x + 0.5, y + h, z + d, M.matte(c)); y += h; } };

  // ------------------------------------------------------------------ seating
  // a straight three-seater: slim steel legs, upholstered base with a piped top seam, three deep seat cushions,
  // three back cushions, two throw pillows and a folded blanket over one arm
  function sofa3(name, display, col, pillow) {
    def(name, display, { size: [3, 1, 1], sound: 'wool', hard: 0.6, seat: true, build: (b) => {
      const f = M.fabric(col), fd = M.fabric(sh(col, 0.92));
      for (const [x, z] of [[2.5, 2.5], [45.5, 2.5], [2.5, 13.5], [45.5, 13.5], [24, 2.5], [24, 13.5]]) steelLeg(b, x, z, 2.5);
      b.cushion(0, 2.5, 0, 48, 7, 16, 1, fd, true);                                          // base
      b.cushion(0, 6, 0, 3.5, 11.5, 16, 1, fd, true); b.cushion(44.5, 6, 0, 48, 11.5, 16, 1, fd, true);   // arms
      b.cushion(0, 6, 11.5, 48, 14, 16, 1.2, fd, true);                                     // back frame
      for (let k = 0; k < 3; k++) {
        const x0 = 3.5 + k * 13.8, x1 = x0 + 13.3;
        b.cushion(x0, 7, 1, x1, 10.5, 12, 1.2, f, true);                                     // seat cushion
        b.cushion(x0, 9.5, 9.5, x1, 15.5, 14.5, 1.2, f, true);                               // back cushion
      }
      throwPillow(b, 10, 10.5, 7.5, 6, pillow); throwPillow(b, 38, 10.5, 7.5, 6, sh(pillow, 1.1));
      throwBlanket(b, 44.5, 48, 11.5, 2, 15, sh(pillow, 0.85));
    } });
  }
  // the L: a chaise return that sits at the end of a three-seater (two blocks long, open on one side)
  function chaise(name, display, col, pillow) {
    def(name, display, { size: [1, 1, 2], sound: 'wool', hard: 0.6, seat: true, build: (b) => {
      const f = M.fabric(col), fd = M.fabric(sh(col, 0.92));
      for (const [x, z] of [[2.5, 2.5], [13.5, 2.5], [2.5, 29.5], [13.5, 29.5], [2.5, 16], [13.5, 16]]) steelLeg(b, x, z, 2.5);
      b.cushion(0, 2.5, 0, 16, 7, 32, 1, fd, true);
      b.cushion(12.5, 6, 0, 16, 11.5, 32, 1, fd, true);                                      // outer arm along the long side
      b.cushion(0, 6, 27.5, 16, 14, 32, 1.2, fd, true);                                      // back at the far end
      b.cushion(1, 7, 1, 12.5, 10.5, 27.5, 1.2, f, true); b.cushion(1, 9.5, 25, 12.5, 15.5, 30.5, 1.2, f, true);
      throwPillow(b, 6.5, 10.5, 23, 6, pillow);
    } });
  }
  // a lounge armchair: a curved upholstered shell (the back wraps around), a round seat cushion, a brushed-steel star base
  function armchair(name, display, col) {
    def(name, display, { size: [1, 1, 1], sound: 'wool', hard: 0.6, seat: true, build: (b) => {
      const f = M.fabric(col), fd = M.fabric(sh(col, 0.92)), st = M.metal(COL.steel);
      b.cyl('y', 8, 8, 1, 0, 4, st); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; b.rod(8, 0.5, 8, 8 + Math.cos(a) * 6, 0.5, 8 + Math.sin(a) * 6, 0.6, st); }
      b.cyl('y', 8, 8, 6.5, 4, 5.5, fd);                                                     // seat shell
      b.tube('y', 8, 8, 6.8, 2.2, 5.5, 15, fd); b.cut(0, 5.5, 0, 16, 16, 8.5);               // the wrap-around back: a tube, open at the front
      b.cut(0, 5.5, 0, 3.2, 10.5, 16); b.cut(12.8, 5.5, 0, 16, 10.5, 16);                    // low arms at the sides
      b.cushion(2.5, 5.5, 2.5, 13.5, 8.5, 13.5, 1.2, f, true); b.cushion(3, 8, 10, 13, 13, 12.5, 1, f, true);
    } });
  }
  for (const [k, c] of Object.entries({ charcoal: FAB.charcoal, cream: FAB.cream, taupe: FAB.taupe, sage: FAB.sage, navy: FAB.navy })) {
    sofa3('vm_sofa_' + k, 'Three-seater · ' + k, c, pillowCols[Object.keys(FAB).indexOf(k) % pillowCols.length]);
    chaise('vm_chaise_' + k, 'Chaise · ' + k, c, pillowCols[(Object.keys(FAB).indexOf(k) + 2) % pillowCols.length]);
    armchair('vm_armchair_' + k, 'Armchair · ' + k, c);
  }

  // ------------------------------------------------------------------ tables
  // a chamfered slab top: a thin lighter edge below the main slab reads as a bevel
  const slabTop = (b, x0, z0, x1, z1, y, t, r, mat, matEdge) => { b.pbox(x0, y + t * 0.4, z0, x1, y + t, z1, r, mat); b.pbox(x0 + 0.5, y, z0 + 0.5, x1 - 0.5, y + t * 0.4, z1 - 0.5, Math.max(0.5, r - 0.5), matEdge || mat); };
  def('vm_coffee_table', 'Coffee Table · walnut & marble', { size: [2, 1, 1], sound: 'stone', hard: 0.8, build: (b) => {
    const w = M.wood(WOOD.walnut);
    slabTop(b, 0.5, 0.5, 31.5, 15.5, 6, 1.5, 3, M.marble(COL.marble), M.marble(sh(COL.marble, 0.9)));
    b.box(3, 0.5, 3, 5.5, 6, 13, w); b.box(26.5, 0.5, 3, 29, 6, 13, w); b.box(5.5, 1, 7, 26.5, 2.5, 9, w);       // two walnut slabs and a stretcher
    b.rbox(11, 7.5, 5, 21, 8.5, 11, 1, M.metal(COL.brass)); b.box(11.5, 8.5, 5.5, 20.5, 9, 10.5, M.matte(0xE8E2D4));      // a brass tray
    b.lathe(14, 8, [[9, 1.6], [12, 1.6], [12.5, 1.2]], M.gloss(COL.paper)); b.cyl('y', 14, 8, 0.3, 12.5, 13.5, M.light(0xFFE2A0));   // a candle
    books(b, 22, 7.5, 5, 3, 6, 8); vaseBranches(b, 6, 11, 7.5, 4, 0x2F7A6A);
  } });
  def('vm_coffee_table_glass', 'Coffee Table · glass', { size: [2, 1, 1], sound: 'glass', hard: 0.8, build: (b) => {
    b.pbox(0.5, 7.5, 0.5, 31.5, 8.5, 15.5, 2, M.glass(0xD6ECF4));
    for (const [x, z] of [[3.5, 3.5], [28.5, 3.5], [3.5, 12.5], [28.5, 12.5]]) b.box(x - 1, 0, z - 1, x + 1, 7.5, z + 1, M.metal(COL.black));
    b.box(2.5, 2, 2.5, 29.5, 3, 13.5, M.wood(WOOD.smoked));                                  // a smoked-oak magazine shelf
    b.rbox(9, 8.5, 5, 16, 12, 11, 2, M.gloss(0xC9A24A)); books(b, 19, 8.5, 5.5, 2, 7, 6); b.box(4, 3, 4, 12, 3.5, 11, M.matte(COL.paper));
  } });
  def('vm_side_table', 'Side Table', { res: 16, size: [1, 1, 1], sound: 'wood', hard: 0.6, build: (b) => {
    b.cyl('y', 8, 8, 6, 8.5, 10, M.wood(WOOD.walnut)); b.tube('y', 8, 8, 6, 0.5, 8, 8.5, M.metal(COL.black));
    b.cyl('y', 8, 8, 1, 0.5, 8, M.metal(COL.black)); b.cyl('y', 8, 8, 4.5, 0, 0.5, M.metal(COL.black));
    b.lathe(8, 8, [[10, 2], [12, 3.2], [14.5, 1.6], [15.5, 2]], M.gloss(0x2F7A6A), 0.5);
  } });
  // dining tables: a 3-block slab, place settings (plates, glasses) and a centrepiece
  const placeSetting = (b, cx, cz, y) => { b.cyl('y', cx, cz, 2.6, y, y + 0.5, M.gloss(COL.white)); b.cyl('y', cx, cz, 2, y + 0.5, y + 0.6, M.gloss(0xE4E6E8)); b.tube('y', cx + 4, cz - 2, 1, 0.3, y, y + 3, M.glass(0xDCEFF8)); b.box(cx - 3.8, y, cz - 2.5, cx - 3.3, y + 0.3, cz + 2.5, M.chrome()); b.box(cx + 3.3, y, cz - 2.5, cx + 3.8, y + 0.3, cz + 2.5, M.chrome()); };
  def('vm_dining_table', 'Dining Table · walnut', { size: [3, 1, 1], sound: 'wood', hard: 1, build: (b) => {
    slabTop(b, 0, 1, 48, 15, 11, 2, 2.5, M.wood(WOOD.walnut), M.wood(sh(WOOD.walnut, 0.85)));
    const m = M.metal(COL.black);
    for (const x of [4, 44]) { b.beam(x - 3, 0, x, 11, 3, 5, 1.5, m); b.beam(x + 3, 0, x, 11, 3, 5, 1.5, m); b.beam(x - 3, 0, x, 11, 11, 13, 1.5, m); b.beam(x + 3, 0, x, 11, 11, 13, 1.5, m); b.box(x - 3.5, 0, 3, x + 3.5, 1, 13, m); }   // A-frame legs
    b.box(4, 9.5, 7, 44, 10.5, 9, m);
    placeSetting(b, 10, 8, 13); placeSetting(b, 38, 8, 13); vaseBranches(b, 24, 8, 13, 3.5, 0xE8E2D4);
  } });
  def('vm_dining_table_oak', 'Dining Table · oak', { size: [3, 1, 1], sound: 'wood', hard: 1, build: (b) => {
    slabTop(b, 0, 1, 48, 15, 11, 2, 2.5, M.wood(WOOD.oak), M.wood(sh(WOOD.oak, 0.88)));
    b.roundLegs(0, 1, 48, 15, 4, 1.4, 1, 0, 11, M.wood(sh(WOOD.oak, 0.95)));
    b.box(4, 9, 7.5, 44, 10.5, 8.5, M.wood(sh(WOOD.oak, 0.95)));
    placeSetting(b, 12, 8, 13); placeSetting(b, 36, 8, 13); b.lathe(24, 8, [[13, 2.5], [15, 1.6], [16, 2]], M.gloss(0x2A2D33), 0.5); b.sphere(24, 17, 8, 3, M.plant(COL.leaf));
  } });
  // chairs: a slim steel frame with a shaped leather shell / an oak chair with a spindle back
  def('vm_dining_chair', 'Dining Chair · black', { size: [1, 1, 1], sound: 'wood', hard: 0.5, seat: true, build: (b) => {
    const m = M.metal(COL.black), le = M.leather(0x2A2C30);
    for (const [x, z] of [[3, 3], [13, 3], [3, 13], [13, 13]]) steelLeg(b, x, z, 7.5);
    b.rod(3, 4, 3, 3, 4, 13, 0.4, m); b.rod(13, 4, 3, 13, 4, 13, 0.4, m);
    b.cushion(2, 7.5, 2, 14, 9.5, 14, 1.8, le, true);
    b.rod(3, 9.5, 12.5, 3.5, 16, 13.5, 0.5, m); b.rod(13, 9.5, 12.5, 12.5, 16, 13.5, 0.5, m);
    b.cushion(2, 11.5, 12.5, 14, 16, 14.5, 1.5, le, true);
  } });
  def('vm_dining_chair_oak', 'Dining Chair · oak & linen', { size: [1, 1, 1], sound: 'wood', hard: 0.5, seat: true, build: (b) => {
    const w = M.wood(WOOD.oak), f = M.fabric(FAB.cream);
    b.roundLegs(2, 2, 14, 14, 1.2, 1, 0.8, 0, 8, w);
    b.rod(3.2, 4, 3.2, 3.2, 4, 12.8, 0.4, w); b.rod(12.8, 4, 3.2, 12.8, 4, 12.8, 0.4, w);
    b.pbox(2, 8, 2, 14, 9, 14, 1.5, w); b.cushion(2.5, 9, 2.5, 13.5, 10.5, 13.5, 1.2, f, true);
    b.lathe(3.2, 13, [[9, 0.7], [16, 0.6]], w); b.lathe(12.8, 13, [[9, 0.7], [16, 0.6]], w);
    for (const x of [5.5, 8, 10.5]) b.lathe(x, 13, [[9, 0.45], [15, 0.45]], w);               // spindles
    b.pbox(2.5, 15, 12.2, 13.5, 16, 13.8, 0.6, w);
  } });
  def('vm_stool', 'Bar Stool', { res: 16, size: [1, 1, 1], sound: 'metal', hard: 0.5, seat: true, build: (b) => {
    b.lathe(8, 8, [[0, 5], [0.8, 4.5], [1.2, 1.5]], M.metal(COL.black)); b.cyl('y', 8, 8, 1, 1, 12, M.metal(COL.black)); b.tube('y', 8, 8, 4.5, 0.5, 5, 5.5, M.metal(COL.black));
    b.cushion(2.5, 12, 2.5, 13.5, 15, 13.5, 2.2, M.leather(0x9A5A32), true);
  } });
  def('vm_desk', 'Desk · oak', { size: [2, 1, 1], sound: 'wood', hard: 1, build: (b) => {
    slabTop(b, 0, 1, 32, 15, 11, 1.5, 1.5, M.wood(WOOD.oak), M.wood(sh(WOOD.oak, 0.88)));
    const m = M.metal(COL.black), dr = M.wood(WOOD.smoked);
    b.box(2, 0, 2, 3, 11, 3, m); b.box(2, 0, 13, 3, 11, 14, m); b.box(2, 0, 2, 3, 1, 14, m); b.box(2, 10, 2, 3, 11, 14, m);
    b.box(20, 0.5, 2, 31, 11, 14, M.wood(WOOD.oak)); for (const y of [1.5, 5, 8.5]) { b.box(20.5, y, 1.5, 30.5, y + 3, 2, dr); b.box(23.5, y + 1.3, 1, 27.5, y + 1.8, 1.5, m); }   // three drawers with bar pulls
    b.box(7, 13, 9.5, 19, 20, 10, M.gloss(COL.black)); b.box(7.5, 13.5, 9.4, 18.5, 19.5, 9.5, M.light(0x7AB8E8)); b.box(12, 12.5, 8, 14, 13, 11.5, M.metal(COL.steel)); b.box(11, 12.5, 11, 15, 13, 12, M.metal(COL.steel));   // a monitor
    b.rbox(6, 12.5, 4, 15.5, 13.2, 7.5, 0.4, M.gloss(0x2A2D33)); b.rbox(17.5, 12.5, 5, 20, 13.3, 7, 0.6, M.gloss(0x2A2D33));   // keyboard, mouse
    b.lathe(4.5, 13, [[12.5, 1.2], [15, 1.1]], M.gloss(0x2F7A6A)); b.rod(4.5, 15, 13, 4.5, 17.5, 13, 0.2, M.matte(0xD2A84A));   // a pen cup
  } });
  def('vm_office_chair', 'Office Chair', { res: 16, size: [1, 1, 1], sound: 'metal', hard: 0.6, seat: true, build: (b) => {
    const m = M.metal(COL.black), f = M.fabric(0x2E3136);
    for (let k = 0; k < 5; k++) { const a = k * Math.PI * 2 / 5; b.rod(8, 0.6, 8, 8 + Math.cos(a) * 6, 0.6, 8 + Math.sin(a) * 6, 0.7, m); b.cyl('y', 8 + Math.cos(a) * 6, 8 + Math.sin(a) * 6, 0.8, 0, 1, M.gloss(0x111214)); }
    b.cyl('y', 8, 8, 1.2, 1, 8, M.chrome()); b.box(5, 7, 5, 11, 8, 11, m);
    b.cushion(2, 8, 2, 14, 10.5, 14, 1.8, f, true);
    b.box(7, 9, 13, 9, 11.5, 14.5, m); b.rbox(2.5, 10.5, 12.5, 13.5, 17, 14.5, 1.5, M.fabric(0x3A3F48)); b.box(3, 12, 12.2, 13, 15.5, 12.6, M.fabric(0x2E3136));   // mesh back
    b.rod(2.5, 10.5, 8, 2.5, 12.5, 8, 0.5, m); b.rbox(1.5, 12.5, 4, 3.5, 13.5, 11, 0.5, M.gloss(0x111214)); b.rod(13.5, 10.5, 8, 13.5, 12.5, 8, 0.5, m); b.rbox(12.5, 12.5, 4, 14.5, 13.5, 11, 0.5, M.gloss(0x111214));   // armrests
  } });

  // ------------------------------------------------------------------ media & storage
  // a drawer front: a slightly proud panel with a shadow gap around it and a bar pull or a finger groove
  const drawerFront = (b, x0, y0, x1, y1, z, mat, pull, pullMat) => { b.box(x0 + 0.5, y0 + 0.5, z - 0.5, x1 - 0.5, y1 - 0.5, z, mat); if (pull === 'bar') { const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; b.rod(cx - 3, cy, z - 0.5, cx + 3, cy, z - 0.5, 0.35, pullMat || M.metal(COL.black)); b.box(cx - 3, cy - 0.3, z - 1, cx - 2.5, cy + 0.3, z - 0.5, pullMat || M.metal(COL.black)); b.box(cx + 2.5, cy - 0.3, z - 1, cx + 3, cy + 0.3, z - 0.5, pullMat || M.metal(COL.black)); } else if (pull === 'groove') b.cut(x0 + 2, y1 - 1.5, z - 0.5, x1 - 2, y1 - 0.5, z); };
  def('vm_lowboard', 'TV Lowboard · walnut', { size: [3, 1, 1], sound: 'wood', hard: 1, build: (b) => {
    const w = M.wood(WOOD.walnut), wd = M.wood(sh(WOOD.walnut, 0.9));
    b.box(0, 2, 2.5, 48, 9, 16, w); b.box(0.5, 2.5, 2, 47.5, 8.5, 2.5, M.matte(0x2A2420));
    for (let k = 0; k < 3; k++) drawerFront(b, k * 16, 2, k * 16 + 16, 9, 2, wd, 'groove');
    for (const x of [3, 45]) b.lathe(x, 9, [[0, 0.9], [2, 0.7]], M.metal(COL.black)); b.box(2.5, 1.5, 5, 45.5, 2, 13, M.metal(COL.black));
    b.lathe(6, 9, [[9, 2], [11, 2.8], [13.5, 1.6]], M.gloss(0xE8E2D4), 0.5); b.rod(6, 13, 9, 7, 17, 9, 0.3, M.plant(0x4E7A38)); b.ellipsoid(7, 17.5, 9, 1.6, 1, 1.2, M.plant(COL.leaf));   // vase
    b.rbox(34, 9, 6, 44, 10, 10, 0.5, M.gloss(0x2A2D33)); b.box(35, 10, 7, 43, 10.5, 9, M.gloss(0x111214)); b.box(36, 10.2, 6.2, 42, 10.6, 6.6, M.light(0x3AC8FF));   // a sound bar / console
    books(b, 16, 9, 6, 2, 8, 6);
  } });
  def('vm_tv', 'Wall TV 65"', { size: [2, 1, 1], sound: 'glass', hard: 0.8, light: [3, 5, 8], build: (b) => {
    b.box(1, 1.5, 14.5, 31, 15, 16, M.gloss(0x111214)); b.box(1.5, 2, 14, 30.5, 14.5, 14.5, M.light(COL.screen));
    b.box(12, 0, 15, 20, 0.5, 16, M.metal(COL.black)); b.rod(16, 0.5, 15.5, 16, 1.5, 15.5, 0.6, M.metal(COL.black));
    // a landscape on screen: sky gradient, mountains, lake
    for (let y = 2; y < 14.5; y += 0.5) b.box(1.5, y, 14, 30.5, y + 0.5, 14.5, M.light(y < 7 ? 0x2E6FB0 : y < 10 ? 0x3F8FD0 : 0x8AC8F0));
    b.extrude([[3, 7], [9, 11.5], [13, 8.5], [17, 12.5], [22, 9], [27, 11], [30, 8], [30, 7]], 'z', 13.9, 14.3, M.light(0x3A5A4A));
    b.box(1.5, 2, 13.9, 30.5, 5.5, 14.3, M.light(0x4A9ACF)); b.cyl('z', 24, 12, 1.2, 13.9, 14.3, M.light(0xFFE4A0));
  } });
  def('vm_bookshelf', 'Bookcase · oak', { size: [1, 2, 1], sound: 'wood', hard: 1, build: (b) => {
    const w = M.wood(WOOD.oak);
    b.box(0, 0, 11.5, 1, 32, 16, w); b.box(15, 0, 11.5, 16, 32, 16, w); b.box(0, 0, 15.5, 16, 32, 16, M.wood(sh(WOOD.oak, 0.9)));
    for (let y = 0; y < 32; y += 8) b.box(0, y, 11.5, 16, y + 0.8, 16, w);
    const cols = [0x2F55C8, 0xC0443A, 0xE8B83A, 0x3E8A4A, 0xF2F2EE, 0x7A4A32, 0x2A2D33, 0x8A5AC8, 0x2F7A6A, 0xD2A84A];
    for (let y = 0.8; y < 32; y += 8) { let x = 1.2; let k = Math.round(y); while (x < 14.2) { const w2 = 0.8 + (k % 3) * 0.4, h = 4.5 + (k % 4) * 0.7, lean = k % 7 === 3; if (lean) { b.extrude([[x, y], [x + w2 + 1.5, y], [x + w2 + 2.5, y + h], [x + 1, y + h]], 'z', 12.5, 15.5, M.matte(cols[k % cols.length])); x += w2 + 2.5; } else { b.box(x, y, 12.5, x + w2, y + h, 15.5, M.matte(cols[k % cols.length])); b.box(x + 0.2, y + 0.3, 12.8, x + w2 - 0.2, y + h - 0.3, 15.3, M.matte(COL.paper)); b.box(x, y, 12.5, x + w2, y + h, 13, M.matte(cols[k % cols.length])); x += w2; } k++; if (k % 5 === 0) x += 1.5; } }
    b.cut(9, 24.8, 12, 14.5, 31, 15.5); b.lathe(11.5, 13.5, [[24.8, 1.8], [27.5, 2.2]], M.gloss(0xE8E2D4)); b.ellipsoid(11.5, 28.5, 13.5, 2.2, 1.2, 1.8, M.plant(COL.leafL));
    b.cut(1.2, 8.8, 12, 6, 15, 15.5); b.rbox(1.5, 8.8, 12.5, 5.5, 11.5, 15.5, 0.5, M.matte(0x8A8E96)); b.box(2, 11.5, 13, 5, 11.8, 15, M.matte(0x6A7078));   // a storage box
  } });
  def('vm_wall_shelf', 'Floating Shelf', { res: 16, size: [1, 1, 1], sound: 'wood', hard: 0.4, light: [3, 2, 1], build: (b) => {
    b.box(0, 6, 11, 16, 7, 16, M.wood(WOOD.walnut));
    books(b, 1, 7, 12, 4, 3, 3.5); b.extrude([[4.5, 7], [6.5, 7], [7.5, 11.5], [5.5, 11.5]], 'z', 12, 15.5, M.matte(0xC0443A));
    b.lathe(10, 13.5, [[7, 1.5], [9, 2.3], [11.5, 1.2], [12.5, 1.6]], M.gloss(COL.white), 0.5); b.ellipsoid(10, 13.2, 13.5, 2.2, 1.4, 2, M.plant(COL.leafL));
    b.lathe(14, 13.5, [[7, 1.2], [8.5, 1.2], [9, 0.8]], M.gloss(COL.paper)); b.cyl('y', 14, 13.5, 0.3, 9, 10, M.light(COL.warm));
  } });
  def('vm_wardrobe', 'Wardrobe · sliding doors', { size: [2, 2, 1], sound: 'wood', hard: 1, build: (b) => {
    b.box(0, 0.5, 4, 32, 32, 16, M.matte(0xF2F2EE)); b.box(0.5, 0, 4.5, 31.5, 0.5, 16, M.matte(0x2A2D33));
    b.box(0.5, 0.5, 3, 16.5, 31.5, 4, M.gloss(0xECEAE4)); b.box(15.5, 0.5, 2, 31.5, 31.5, 3, M.gloss(0xC8DCE8));          // two sliding panels: lacquer and mirror glass
    b.box(15.5, 0.5, 2, 16, 31.5, 3, M.metal(COL.black)); b.box(31, 0.5, 2, 31.5, 31.5, 3, M.metal(COL.black)); b.box(0.5, 0.5, 3, 1, 31.5, 4, M.metal(COL.black)); b.box(16, 0.5, 3, 16.5, 31.5, 4, M.metal(COL.black));
    b.box(0, 31.5, 2, 32, 32, 16, M.metal(COL.black)); b.box(0, 0.5, 2, 32, 1, 4, M.metal(COL.black));                       // track rails
    b.rod(14.5, 10, 2.8, 14.5, 22, 2.8, 0.35, M.metal(COL.black)); b.rod(17.5, 10, 1.8, 17.5, 22, 1.8, 0.35, M.metal(COL.black));
  } });
  def('vm_wardrobe_walnut', 'Wardrobe · walnut', { size: [2, 2, 1], sound: 'wood', hard: 1, build: (b) => {
    b.box(0, 0.5, 4, 32, 32, 16, M.wood(WOOD.walnut)); b.box(0.5, 0, 4.5, 31.5, 0.5, 16, M.matte(0x2A2420));
    for (let k = 0; k < 4; k++) { const x0 = k * 8; b.box(x0 + 0.4, 1, 3, x0 + 7.6, 31.5, 4, M.wood(sh(WOOD.walnut, 0.95 + (k & 1) * 0.06))); const hx = k < 2 ? x0 + 6.6 : x0 + 1.4; b.rod(hx, 12, 2.4, hx, 20, 2.4, 0.3, M.metal(COL.brass)); b.box(hx - 0.3, 12, 2.4, hx + 0.3, 12.6, 3, M.metal(COL.brass)); b.box(hx - 0.3, 19.4, 2.4, hx + 0.3, 20, 3, M.metal(COL.brass)); }
    b.box(0, 31.5, 3, 32, 32, 16, M.wood(sh(WOOD.walnut, 0.85)));
  } });
  def('vm_nightstand', 'Nightstand & Lamp', { size: [1, 1, 1], sound: 'wood', hard: 0.6, light: [8, 6, 3], build: (b) => {
    const w = M.wood(WOOD.walnut);
    b.box(1, 2, 2.5, 15, 9, 15, w); b.box(1.5, 2.5, 2, 14.5, 8.5, 2.5, M.matte(0x2A2420));
    drawerFront(b, 1, 2, 15, 5.5, 2, M.wood(WOOD.smoked), 'bar', M.metal(COL.brass)); drawerFront(b, 1, 5.5, 15, 9, 2, M.wood(WOOD.smoked), 'bar', M.metal(COL.brass));
    for (const [x, z] of [[2.5, 4], [13.5, 4], [2.5, 13.5], [13.5, 13.5]]) b.lathe(x, z, [[0, 0.8], [2, 0.6]], M.metal(COL.black));
    b.lathe(8, 9, [[9, 2.6], [9.6, 2.2], [10, 0.8]], M.metal(COL.brass)); b.cyl('y', 8, 9, 0.5, 10, 13, M.metal(COL.brass));
    b.tube('y', 8, 9, 4.2, 0.5, 12, 16, M.fabric(0xF2E0C0)); b.cyl('y', 8, 9, 1.5, 13, 14.5, M.light(COL.warm));             // drum shade with the bulb inside
    books(b, 2, 9, 11, 2, 4, 3);
  } });
  def('vm_console', 'Console Table', { size: [2, 1, 1], sound: 'wood', hard: 0.6, build: (b) => {
    slabTop(b, 0, 9, 32, 16, 11, 1.5, 1, M.wood(WOOD.walnut), M.wood(sh(WOOD.walnut, 0.88)));
    const m = M.metal(COL.black); b.box(1, 0, 10, 2, 11, 15, m); b.box(30, 0, 10, 31, 11, 15, m); b.box(1, 0, 10, 31, 1, 11, m); b.box(1, 0, 14, 31, 1, 15, m);
    b.lathe(8, 12.5, [[12.5, 2], [14.5, 3], [17, 1.6], [18, 2.2]], M.gloss(0xE8E2D4), 0.5); b.rod(8, 17, 12.5, 9, 21, 12, 0.3, M.plant(0x4E7A38)); b.ellipsoid(9, 21.5, 12, 1.5, 0.9, 1.2, M.plant(COL.leaf));
    b.box(19, 12.5, 11, 28, 13.2, 14, M.gloss(0x2A2D33)); b.box(20, 13.2, 11.5, 27, 14, 13.5, M.gloss(COL.paper)); b.extrude([[13, 12.5], [17, 12.5], [16.5, 18], [13.5, 18]], 'z', 14.5, 15.2, M.gloss(0x2A2D33)); b.box(13.8, 13.2, 14.6, 16.2, 17.3, 15.1, M.gloss(0xD8C8A0));   // tray, a framed photo
  } });
  def('vm_coat_rack', 'Coat Rack & Bench', { res: 16, size: [1, 2, 1], sound: 'wood', hard: 0.6, build: (b) => {
    b.box(0, 7, 14.5, 16, 32, 16, M.wood(WOOD.walnut));
    for (const x of [3, 8, 13]) { b.rod(x, 25, 14.5, x, 25, 12.5, 0.45, M.metal(COL.brass)); b.sphere(x, 25, 12.5, 0.7, M.metal(COL.brass)); }
    b.extrude([[1, 10], [6.5, 10], [6, 24.5], [1.5, 24.5]], 'z', 11.5, 14.2, M.fabric(FAB.navy)); b.extrude([[6.5, 13], [11.5, 13], [11, 24.5], [7, 24.5]], 'z', 11.8, 14.2, M.fabric(0xC0443A)); b.rbox(11.5, 16, 12.5, 15.5, 22, 14.2, 1, M.leather(0x6A4A30));   // coats and a bag
    b.box(0, 5, 8, 16, 7, 16, M.wood(WOOD.oak)); b.box(1, 0, 9, 2, 5, 15, M.metal(COL.black)); b.box(14, 0, 9, 15, 5, 15, M.metal(COL.black));
    b.rbox(3, 0.5, 9, 7, 3.5, 14, 1, M.gloss(0x2A2D33)); b.rbox(9, 0.5, 9, 13, 3.5, 14, 1, M.gloss(0xE8E6E0)); b.box(3.5, 3.5, 9.5, 6.5, 4, 13.5, M.matte(0x8A8E96));   // shoes
  } });

  // ------------------------------------------------------------------ kitchen
  // base cabinets: carcass on a recessed plinth, a worktop with a slim overhang and a chamfer, handle-less fronts with a dark grip rail
  const counterTop = (b, x0, x1, mat) => { b.pbox(x0, 13, -0.5, x1, 15, 16, 0.5, mat || M.marble(COL.marble)); b.box(x0, 13, -0.5, x1, 13.5, 0, M.marble(sh(COL.marble, 0.85))); };
  const carcass = (b, x0, x1, col) => { b.box(x0, 1.5, 2, x1, 13, 16, M.matte(col)); b.box(x0 + 0.5, 0, 3.5, x1 - 0.5, 1.5, 16, M.matte(0x2A2D33)); };
  const front = (b, x0, y0, x1, y1, col, grip) => { b.box(x0 + 0.3, y0 + 0.3, 1, x1 - 0.3, y1 - 0.3, 2, M.gloss(sh(col, 1.03))); if (grip) b.box(x0 + 0.3, y1 - 1.3, 1, x1 - 0.3, y1 - 0.3, 2, M.matte(0x2A2D33)); };
  function kitchen(prefix, display, col, top) {
    const topMat = top || M.marble(COL.marble);
    def(prefix + '_cabinet', display + ' · drawers', { size: [1, 1, 1], sound: 'wood', hard: 1, build: (b) => { carcass(b, 0, 16, col); front(b, 0, 1.5, 16, 5.5, col, true); front(b, 0, 5.5, 16, 9.5, col, true); front(b, 0, 9.5, 16, 13, col, true); counterTop(b, 0, 16, topMat); b.rbox(2, 15, 3, 8, 15.8, 9, 0.5, M.wood(WOOD.oak)); b.lathe(12, 10, [[15, 1.4], [18, 1.2]], M.metal(COL.steel)); b.rod(12, 18, 10, 11, 21, 9.5, 0.25, M.wood(WOOD.ash)); } });
    def(prefix + '_sink', display + ' · sink', { size: [1, 1, 1], sound: 'metal', hard: 1, build: (b) => {
      carcass(b, 0, 16, col); front(b, 0, 1.5, 16, 13, col, true); counterTop(b, 0, 16, topMat);
      b.box(2.5, 11, 3.5, 13.5, 15, 12.5, M.metal(COL.steel)); b.cut(3, 11.5, 4, 13, 15, 12); b.cyl('y', 8, 8, 0.8, 11.5, 11.6, M.metal(0x6A7078));   // an undermount basin with its drain
      b.cyl('y', 8, 13.5, 0.9, 15, 20, M.chrome()); b.rod(8, 19.5, 13.5, 8, 19.5, 8, 0.6, M.chrome()); b.rod(8, 19.5, 8, 8, 18, 8, 0.5, M.chrome()); b.rod(9.3, 15.5, 13.5, 10.8, 17, 13.5, 0.35, M.chrome());   // mixer tap
      b.rbox(13, 15, 9, 15.5, 16.5, 12, 0.5, M.gloss(0xE8E2D4)); b.lathe(1.8, 12, [[15, 0.8], [17.5, 0.7]], M.gloss(0x2F7A6A));   // soap and a bottle
    } });
    def(prefix + '_hob', display + ' · hob', { size: [1, 1, 1], sound: 'metal', hard: 1, build: (b) => {
      carcass(b, 0, 16, col); front(b, 0, 1.5, 16, 7, col, true); front(b, 0, 7, 16, 13, col, true); counterTop(b, 0, 16, topMat);
      b.pbox(1.5, 14.8, 2.5, 14.5, 15.3, 13.5, 0.8, M.gloss(0x15161A));
      for (const [x, z, r] of [[4.8, 5.5, 2.2], [11.2, 5.5, 1.6], [4.8, 10.8, 1.6], [11.2, 10.8, 2.2]]) { b.tube('y', x, z, r, 0.4, 15.3, 15.4, M.gloss(0x3A3D44)); b.cyl('y', x, z, 0.4, 15.3, 15.4, M.gloss(0x3A3D44)); }
      b.box(3.5, 15.3, 12.4, 12.5, 15.5, 12.9, M.gloss(0x2E3136)); b.box(5, 15.4, 12.5, 6, 15.6, 12.8, M.light(0xFF4A2A));
      b.lathe(11.2, 10.8, [[15.4, 2.6], [18, 2.8]], M.metal(COL.steel), 0.4); b.rod(13.5, 17.5, 10.8, 16, 18, 10.8, 0.4, M.metal(COL.black));   // a pan on the hob
    } });
    def(prefix + '_oven', display + ' · oven', { size: [1, 1, 1], sound: 'metal', hard: 1, build: (b) => {
      carcass(b, 0, 16, col); front(b, 0, 1.5, 16, 3.5, col, false);
      b.box(0.5, 3.5, 1, 15.5, 13, 2, M.gloss(0x1C1E22)); b.box(1.5, 4.5, 1, 14.5, 10.5, 1.8, M.glass(0x4A5A66)); b.box(2, 5, 2, 14, 10, 2.5, M.light(0x3A2A18));
      b.rod(2, 11.8, 0.6, 14, 11.8, 0.6, 0.4, M.metal(COL.steel)); b.box(2, 11.5, 0.6, 2.6, 12.1, 1, M.metal(COL.steel)); b.box(13.4, 11.5, 0.6, 14, 12.1, 1, M.metal(COL.steel));
      for (const x of [4, 7, 10]) b.cyl('z', x, 12.4, 0.5, 0.6, 1, M.metal(COL.steel)); b.box(11.5, 12.1, 0.9, 14, 12.7, 1, M.light(0x3AC8FF));
      counterTop(b, 0, 16, topMat);
    } });
    def(prefix + '_tall', display + ' · tall unit', { size: [1, 2, 1], sound: 'wood', hard: 1, build: (b) => {
      b.box(0, 1.5, 2, 16, 32, 16, M.matte(col)); b.box(0.5, 0, 3.5, 15.5, 1.5, 16, M.matte(0x2A2D33));
      front(b, 0, 1.5, 16, 12.5, col, true);
      b.box(0.5, 12.5, 1, 15.5, 22.5, 2, M.gloss(0x1C1E22)); b.box(1.5, 13.5, 1, 14.5, 19.5, 1.8, M.glass(0x4A5A66)); b.box(2, 14, 2, 14, 19, 2.5, M.light(0x3A2A18)); b.rod(2, 21.3, 0.6, 14, 21.3, 0.6, 0.4, M.metal(COL.steel)); b.box(11.5, 20.3, 0.9, 14, 20.9, 1, M.light(0x3AC8FF));   // built-in oven
      front(b, 0, 22.5, 16, 32, col, false); b.rod(13.5, 25, 0.7, 13.5, 30, 0.7, 0.3, M.metal(COL.black)); b.box(13.2, 25, 0.7, 13.8, 25.5, 1, M.metal(COL.black)); b.box(13.2, 29.5, 0.7, 13.8, 30, 1, M.metal(COL.black));
    } });
    def(prefix + '_upper', display + ' · wall cabinet', { size: [1, 1, 1], sound: 'wood', hard: 0.8, light: [4, 3, 1], build: (b) => {
      b.box(0, 4, 8, 16, 16, 16, M.matte(col)); b.box(0.3, 4.3, 7, 15.7, 15.7, 8, M.gloss(sh(col, 1.03))); b.box(0.3, 4.3, 7, 15.7, 5.3, 8, M.matte(0x2A2D33));
      b.box(0.5, 3.5, 9, 15.5, 4, 15, M.light(COL.warm));
    } });
  }
  kitchen('vm_kitchen_white', 'Kitchen · white', 0xF2F2EE);
  kitchen('vm_kitchen_black', 'Kitchen · black', 0x25272B, M.marble(COL.marble));
  kitchen('vm_kitchen_oak', 'Kitchen · oak', 0xC8A878, M.marble(COL.marble));
  def('vm_island', 'Kitchen Island · marble', { size: [2, 1, 1], sound: 'stone', hard: 1.2, build: (b) => {
    b.box(1, 1.5, 3, 31, 13, 13, M.matte(0x25272B)); b.box(1.5, 0, 3.5, 30.5, 1.5, 12.5, M.matte(0x111214));
    b.pbox(0, 13, 0, 32, 15, 16, 1.5, M.marble(COL.marble)); b.box(0, 13, 0, 32, 13.5, 0.5, M.marble(sh(COL.marble, 0.85))); b.box(0, 13, 15.5, 32, 13.5, 16, M.marble(sh(COL.marble, 0.85)));
    for (const x0 of [1.5, 16.5]) { b.box(x0, 2, 13, x0 + 14, 12.5, 14, M.gloss(0x2E3136)); b.box(x0, 7, 13.2, x0 + 14, 7.4, 14, M.matte(0x111214)); b.rod(x0 + 3, 10.5, 13.8, x0 + 11, 10.5, 13.8, 0.3, M.metal(COL.brass)); b.rod(x0 + 3, 5, 13.8, x0 + 11, 5, 13.8, 0.3, M.metal(COL.brass)); }
    b.lathe(26, 8, [[15, 2.6], [17, 1.8], [19.5, 2.4]], M.gloss(0x2F7A6A), 0.5); b.rod(26, 19, 8, 25, 23, 8.5, 0.3, M.plant(0x4E7A38)); b.ellipsoid(25, 23.5, 8.5, 1.8, 1, 1.4, M.plant(COL.leafL));
    b.rbox(5, 15, 5, 13, 15.8, 11, 0.5, M.wood(WOOD.oak)); b.sphere(7, 16.4, 7, 0.9, M.gloss(0xC8442A)); b.sphere(9.5, 16.4, 8.5, 0.9, M.gloss(0xC8442A)); b.ellipsoid(11, 16.3, 6.5, 1, 0.7, 0.8, M.gloss(0xE8B83A));   // a board with fruit
    b.lathe(18, 4, [[15, 1], [18, 0.9], [19.5, 0.5]], M.glass(0xDCEFF8), 0.3); b.lathe(20.5, 4, [[15, 1], [18, 0.9], [19.5, 0.5]], M.glass(0xDCEFF8), 0.3);
  } });
  def('vm_fridge', 'Fridge · steel', { size: [1, 2, 1], sound: 'metal', hard: 1.5, build: (b) => {
    b.rbox(1, 0, 2, 15, 32, 16, 1.2, M.metal(COL.steel)); b.box(1.5, 20, 1.5, 14.5, 20.6, 3, M.matte(0x6A7078)); b.box(1.5, 0, 1.5, 14.5, 32, 2, M.metal(sh(COL.steel, 0.95)));
    b.rod(12.5, 22, 1, 12.5, 30, 1, 0.4, M.metal(COL.black)); b.box(12.2, 22, 1, 12.8, 22.6, 1.6, M.metal(COL.black)); b.box(12.2, 29.4, 1, 12.8, 30, 1.6, M.metal(COL.black));
    b.rod(12.5, 4, 1, 12.5, 18, 1, 0.4, M.metal(COL.black)); b.box(12.2, 4, 1, 12.8, 4.6, 1.6, M.metal(COL.black)); b.box(12.2, 17.4, 1, 12.8, 18, 1.6, M.metal(COL.black));
    b.box(3.5, 23, 1, 8.5, 27, 1.6, M.gloss(0x1C1E22)); b.box(4, 24.5, 1, 8, 26, 1.5, M.light(0x4AC8FF));   // the water dispenser panel
  } });
  def('vm_washer', 'Washing Machine', { res: 16, size: [1, 1, 1], sound: 'metal', hard: 1, build: (b) => {
    b.rbox(1, 0, 2, 15, 15, 16, 1, M.gloss(COL.white)); b.tube('z', 8, 7, 5, 0.8, 1, 2, M.chrome()); b.cyl('z', 8, 7, 4.2, 1.2, 2.5, M.glass(0x3A4E66)); b.tube('z', 8, 7, 3.5, 0.3, 2.5, 3, M.metal(0x6A7078));
    b.box(2, 12.5, 1, 14, 14, 2, M.gloss(0x2A2D33)); b.box(3, 13, 0.8, 5.5, 13.5, 1, M.light(0x2FD070)); b.cyl('z', 12, 13.2, 0.9, 0.3, 1, M.chrome()); b.box(6.5, 12.8, 0.9, 10.5, 13.7, 1, M.matte(0x111214));
  } });

  // ------------------------------------------------------------------ bedroom
  // a double bed: a slim platform frame, a tall channel-tufted headboard, mattress with piping, a duvet folded back
  // at the foot with a crease, a throw across the end, four pillows and a bolster
  function bed(name, display, col, frame) {
    def(name, display, { size: [2, 1, 2], sound: 'wool', hard: 0.6, bed: true, build: (b) => {
      const fr = M.wood(frame), mat = M.fabric(0xF2F2EE), duv = M.fabric(col), duvD = M.fabric(sh(col, 0.9)), pil = M.fabric(0xFAFAF6), head = M.fabric(sh(col, 0.8));
      b.box(0, 2, 0, 32, 5.5, 32, fr); b.box(0.5, 1.5, 0.5, 31.5, 2, 31.5, M.wood(sh(frame, 0.8)));
      for (const [x, z] of [[2, 2], [30, 2], [2, 30], [30, 30]]) b.lathe(x, z, [[0, 1.1], [1.5, 0.9]], M.wood(sh(frame, 0.85)));
      b.cushion(0, 5.5, 28, 32, 19, 32, 1, head, true); for (let x = 4; x < 32; x += 4) b.cut(x - 0.25, 6.5, 27.9, x + 0.25, 18, 28.5);          // channel-tufted headboard
      b.cushion(1, 5.5, 1, 31, 9.5, 28.5, 1, mat, true);                                                                                // mattress with piping
      b.cushion(0.5, 9, 0, 31.5, 12.5, 21, 1.5, duv, true); b.cushion(1, 11, 1, 31, 13.5, 7, 1, duvD, true);                             // duvet, folded back at the foot
      for (let x = 2; x < 31; x += 1) if ((x >> 1) & 1) b.recolor(x, 11.9, 2, x + 1, 12.5, 20, duvD);                                     // soft creases across the duvet
      b.cushion(2, 13, 2.5, 30, 14.2, 6.5, 0.6, M.fabric(sh(pillowCols[2], 1.05)), true);                                                   // a throw across the foot
      b.cushion(2.5, 9.5, 22, 15.5, 13.5, 28, 1.2, pil, true); b.cushion(16.5, 9.5, 22, 29.5, 13.5, 28, 1.2, pil, true);
      b.cushion(4, 12.5, 24, 14, 16, 27.5, 1.2, M.fabric(FAB.mustard), true); b.cushion(18, 12.5, 24, 28, 16, 27.5, 1.2, M.fabric(FAB.mustard), true);
      b.cyl('x', 13.5, 23.5, 1.6, 10, 22, M.fabric(sh(col, 1.1)));                                                                           // a bolster in front
    } });
  }
  bed('vm_bed_grey', 'Double Bed · grey', 0x8A8E96, WOOD.walnut); bed('vm_bed_navy', 'Double Bed · navy', FAB.navy, WOOD.oak); bed('vm_bed_sage', 'Double Bed · sage', FAB.sage, WOOD.oak); bed('vm_bed_white', 'Double Bed · white', 0xE6E2DA, WOOD.walnut); bed('vm_bed_rose', 'Double Bed · rose', FAB.rose, WOOD.ash);
  def('vm_bed_single', 'Single Bed', { size: [1, 1, 2], sound: 'wool', hard: 0.6, bed: true, build: (b) => {
    const fr = M.wood(WOOD.oak);
    b.box(0, 2, 0, 16, 5, 32, fr); for (const [x, z] of [[1.5, 1.5], [14.5, 1.5], [1.5, 30.5], [14.5, 30.5]]) b.lathe(x, z, [[0, 1], [2, 0.8]], fr);
    b.box(0, 5, 29.5, 16, 15, 32, fr); for (const x of [2, 5, 8, 11, 14]) b.cut(x - 0.3, 6, 29.4, x + 0.3, 14, 30);                                   // slatted headboard
    b.cushion(1, 5, 1, 15, 8.5, 29.5, 1.2, M.fabric(0xF2F2EE), true); b.cushion(0.5, 8, 0, 15.5, 11.5, 22, 2, M.fabric(0x4F7FB8), true); b.cushion(1, 10, 1, 15, 12, 6, 1.2, M.fabric(0x4473AE), true);
    b.cushion(2.5, 8.5, 23, 13.5, 12, 29, 1.8, M.fabric(0xFAFAF6), true); b.cushion(4, 11, 24.5, 12, 13.5, 28, 1.2, M.fabric(FAB.mustard), true);
  } });
  def('vm_bench', 'Bed Bench', { size: [2, 1, 1], sound: 'wool', hard: 0.5, seat: true, build: (b) => { for (const [x, z] of [[2.5, 4.5], [29.5, 4.5], [2.5, 11.5], [29.5, 11.5]]) steelLeg(b, x, z, 6); b.rod(2.5, 1.5, 4.5, 2.5, 1.5, 11.5, 0.4, M.metal(COL.black)); b.rod(29.5, 1.5, 4.5, 29.5, 1.5, 11.5, 0.4, M.metal(COL.black)); b.cushion(0, 6, 3, 32, 9.5, 13, 1.5, M.fabric(FAB.taupe), true); b.rbox(20, 9.5, 4, 30, 10.5, 12, 0.5, M.fabric(FAB.cream)); } });
  def('vm_mirror', 'Floor Mirror', { size: [1, 2, 1], sound: 'glass', hard: 0.5, build: (b) => { b.box(2, 0, 12, 14, 28, 13.5, M.metal(COL.black)); b.box(2.6, 0.6, 11.6, 13.4, 27.4, 12.2, M.gloss(0xC8DCE8)); b.extrude([[2, 0], [14, 0], [14, 1], [13, 1], [12.4, 3], [3.6, 3], [3, 1], [2, 1]], 'z', 9.5, 14, M.metal(COL.black)); } });
  def('vm_curtain', 'Curtain · linen', { size: [1, 2, 1], sound: 'wool', hard: 0.2, build: (b) => {
    b.rod(0, 31.4, 12.5, 16, 31.4, 12.5, 0.35, M.metal(COL.black));
    for (let x = 0; x < 16; x += 0.5) { const fold = 11.5 + Math.sin(x * 1.25) * 1.3; b.box(x, 0.5, fold, x + 0.5, 31, fold + 1.5, M.fabric(sh(0xE8E2D4, 0.92 + Math.cos(x * 1.25) * 0.07))); }   // soft wave folds
    for (let x = 0.5; x < 16; x += 2.5) { b.tube('x', 31.4, 12.5, 0.8, 0.3, x, x + 0.5, M.metal(COL.black)); }                                   // curtain rings
  } });

  // ------------------------------------------------------------------ bath
  def('vm_bathtub', 'Freestanding Tub', { size: [2, 1, 1], sound: 'stone', hard: 1.2, build: (b) => {
    const w = M.gloss(COL.white);
    b.pbox(0.5, 0, 1, 31.5, 10, 15, 6, w); b.pbox(2.5, 3.5, 3, 29.5, 10, 13, 5, 0); b.pbox(2.5, 3.5, 3, 29.5, 8.2, 13, 5, M.gloss(COL.water));   // the shell, hollowed, with water
    b.pbox(0, 9.2, 0.5, 32, 10, 15.5, 6.5, w); b.pbox(2.5, 9.2, 3, 29.5, 10, 13, 5, 0);                                                            // a rolled rim lip
    b.cyl('y', 8, 8, 1, 3.5, 3.6, M.chrome());                                                                                                     // drain
    b.cyl('y', 30, 8, 0.6, 0, 14, M.chrome()); b.rod(30, 14, 8, 27, 14, 8, 0.6, M.chrome()); b.rod(27, 14, 8, 26.5, 12, 8, 0.5, M.chrome()); b.rod(30, 11, 8, 30, 11, 6.5, 0.4, M.chrome()); b.sphere(30, 11, 6.2, 0.7, M.chrome());   // floor-standing tap
    b.rbox(3, 10, 1.5, 9, 11.8, 5, 0.8, M.fabric(0xF4F0E8)); b.rbox(3.5, 11.8, 2, 8.5, 12.8, 4.5, 0.6, M.fabric(0xE8E2D4));                        // folded towels on the rim
    b.lathe(14, 2.2, [[10, 0.9], [12.5, 0.8], [13.2, 0.5]], M.gloss(0x2F7A6A)); b.lathe(16.5, 2.2, [[10, 0.7], [11.8, 0.7]], M.gloss(COL.paper)); b.cyl('y', 16.5, 2.2, 0.25, 11.8, 12.6, M.light(0xFFE2A0));   // bottle and a candle
  } });
  def('vm_vanity', 'Vanity & Mirror', { size: [1, 2, 1], sound: 'stone', hard: 1, light: [6, 5, 4], build: (b) => {
    const w = M.wood(WOOD.oak);
    b.box(0, 4, 6, 16, 12, 16, w); drawerFront(b, 0, 4, 16, 8, 6, M.wood(WOOD.smoked), 'groove'); drawerFront(b, 0, 8, 16, 12, 6, M.wood(WOOD.smoked), 'groove');
    b.pbox(0, 12, 4, 16, 13.5, 16, 0.8, M.marble(COL.marble)); b.box(0, 12, 4, 16, 12.4, 4.5, M.marble(sh(COL.marble, 0.85)));
    b.lathe(8, 10, [[13.5, 4.2], [14.5, 5], [17, 5.2]], M.gloss(COL.white)); b.lathe(8, 10, [[14.5, 3.6], [17.1, 4.4]], M.gloss(0xDDE8EE), 0.01); b.cut(3.8, 14.8, 5.8, 12.2, 17.2, 14.2); b.lathe(8, 10, [[14.5, 4.4], [17, 4.6]], M.gloss(COL.white), 0.6);   // a countertop bowl basin
    b.cyl('y', 8, 10, 0.6, 14.5, 14.6, M.chrome()); b.cyl('y', 8, 15, 0.6, 13.5, 20, M.chrome()); b.rod(8, 19.5, 15, 8, 19.5, 11, 0.5, M.chrome()); b.rod(8, 19.5, 11, 8, 18.5, 11, 0.4, M.chrome());   // tall mixer
    b.lathe(2.5, 12, [[13.5, 0.8], [16, 0.7], [16.5, 0.4]], M.gloss(0x2F7A6A)); b.lathe(13.5, 12, [[13.5, 0.8], [15.5, 0.8]], M.gloss(COL.paper)); b.rod(13.5, 15.5, 12, 13.8, 17.5, 11.8, 0.2, M.matte(0x4A3626));   // soap, a cup with a brush
    b.box(1.5, 19.5, 15.2, 14.5, 30.5, 16, M.gloss(0xC8DCE8)); b.tube('z', 8, 25, 7.2, 0.4, 15, 15.3, M.light(COL.warm));                           // a round LED mirror: square glass behind a lit ring
    b.cut(1.5, 19.5, 15, 14.5, 30.5, 15.3); b.cyl('z', 8, 25, 6.8, 15.2, 15.6, M.gloss(0xC8DCE8)); b.tube('z', 8, 25, 7.3, 0.5, 15.1, 15.5, M.light(COL.warm));
    b.rbox(0.5, 13.5, 13, 3, 14, 15.5, 0.4, M.fabric(0xF4F0E8));
  } });
  def('vm_toilet', 'Wall-hung Toilet', { res: 16, size: [1, 1, 1], sound: 'stone', hard: 1, build: (b) => {
    b.box(1, 0, 12, 15, 16, 16, M.matte(0xE8E6E0)); b.rbox(5.5, 11, 11.6, 10.5, 13.5, 12, 0.4, M.chrome()); b.box(6.2, 11.6, 11.5, 7.8, 12.9, 11.7, M.metal(0x9A9EA4)); b.box(8.2, 11.6, 11.5, 9.8, 12.9, 11.7, M.metal(0x9A9EA4));   // cistern wall with the flush plate
    const w = M.gloss(COL.white);
    b.ellipsoid(8, 8.5, 7.2, 5, 4.5, 5.4, w); b.pbox(3, 7.5, 2, 13, 10, 12, 4.5, w); b.cut(0, 0, 0, 16, 4.5, 16);                     // the bowl body (wall-hung: cut flat underneath)
    b.pbox(4.3, 8.3, 3.3, 11.7, 10, 10.7, 3.5, 0); b.pbox(4.3, 8.3, 3.3, 11.7, 8.9, 10.7, 3.5, M.gloss(0xDDE8EE));                  // the inside with water
    b.pbox(3, 10, 2, 13, 10.8, 12, 4.5, w); b.pbox(4.3, 10, 3.3, 11.7, 10.8, 10.7, 3.5, 0);                                         // seat ring
    b.pbox(3.3, 10.8, 10, 12.7, 11.4, 12, 1, w);                                                                                    // lid hinge
    b.lathe(14.5, 3.5, [[0, 0.6], [11, 0.5]], M.chrome()); b.lathe(14.5, 3.5, [[11, 1.6], [12.5, 1.9]], M.gloss(COL.white)); b.rod(14.5, 12.5, 3.5, 14.5, 13.5, 3.5, 0.4, M.matte(0x4A3626));   // brush holder
  } });
  def('vm_shower', 'Walk-in Shower', { size: [1, 2, 1], sound: 'glass', hard: 1, build: (b) => {
    b.box(0, 0, 0, 16, 1, 16, M.stone(0x8A8E96)); for (let x = 1; x < 15; x += 0.5) b.recolor(x, 0.9, 1, x + 0.25, 1, 15, M.stone(0x7A7E86));   // a tiled tray with drain grooves
    b.box(0, 1, 15, 16, 32, 16, M.matte(0x3A3F48)); b.box(15, 1, 0, 16, 32, 16, M.matte(0x3A3F48));
    b.box(0, 1, 0, 0.6, 30, 15, M.glass(0xD6ECF4)); b.box(0, 1, 0, 0.8, 1.8, 15, M.metal(COL.black)); b.box(0, 29.2, 0, 0.8, 30, 15, M.metal(COL.black)); b.box(0, 1, 0, 0.8, 30, 0.6, M.metal(COL.black));   // framed glass panel
    b.rod(8, 28, 15, 8, 28, 7, 0.5, M.chrome()); b.cyl('y', 8, 7, 4, 27.4, 28, M.chrome()); b.cyl('y', 8, 7, 3.6, 27.2, 27.4, M.metal(0x9A9EA4));   // rain head
    b.rod(11.5, 14, 15, 11.5, 14, 13, 0.5, M.chrome()); b.sphere(11.5, 14, 13, 0.9, M.chrome()); b.rod(12.5, 18, 14.3, 12.5, 24, 14.3, 0.35, M.chrome()); b.rod(12.5, 24, 14.3, 12.5, 22, 13, 0.4, M.chrome());   // mixer and hand shower
    b.box(1, 11, 14, 7, 11.6, 15, M.marble(COL.marble)); b.lathe(3, 14.4, [[11.6, 0.6], [13.5, 0.55]], M.gloss(0x2F7A6A)); b.lathe(5, 14.4, [[11.6, 0.6], [13, 0.55]], M.gloss(COL.paper));   // shelf with bottles
    b.cyl('y', 8, 8, 2, 0.9, 1.05, M.metal(0x6A7078));
  } });

  // ------------------------------------------------------------------ lighting & plants
  def('vm_arc_lamp', 'Arc Floor Lamp', { res: 16, size: [2, 2, 1], sound: 'metal', hard: 0.5, light: [12, 10, 6], build: (b) => {
    b.lathe(6, 8, [[0, 5.5], [1.5, 5.2], [2, 3.5]], M.marble(COL.marbleD));
    const arm = M.metal(COL.brass);
    let px = 6, py = 2;
    for (let t = 1; t <= 28; t++) { const a = (t / 28) * Math.PI / 2; const x = 6 + 22 * (1 - Math.cos(a)), y = 2 + 27 * Math.sin(a); b.rod(px, py, 8, x, y, 8, 0.6, arm); px = x; py = y; }   // a quarter-circle arm
    b.rod(28, 29, 8, 28, 27.5, 8, 0.4, arm);
    b.lathe(28, 8, [[21, 1.4], [23.5, 5.8], [27, 5.4], [28, 1.6]], M.gloss(0x1C1E22), 0.6); b.cyl('y', 28, 8, 4.4, 21.5, 23.5, M.light(COL.warm));   // the dome shade with its glow
  } });
  def('vm_pendant', 'Pendant · brass', { res: 16, size: [1, 1, 1], sound: 'metal', hard: 0.4, light: [12, 9, 5], build: (b) => { b.cyl('y', 8, 8, 1.6, 15.2, 16, M.metal(COL.black)); b.rod(8, 7, 8, 8, 15.2, 8, 0.25, M.metal(COL.black)); b.lathe(8, 8, [[2, 2.2], [3.5, 5], [6, 6.2], [7.5, 5.8]], M.metal(COL.brass), 0.5); b.lathe(8, 8, [[2.5, 1.9], [3.5, 4.3], [5.8, 5.4]], M.light(COL.warm), 0.5); b.sphere(8, 4.5, 8, 1.4, M.light(0xFFF2D0)); } });
  def('vm_chandelier', 'Chandelier · rings', { res: 16, size: [1, 1, 1], sound: 'metal', hard: 0.4, light: [14, 11, 6], build: (b) => { b.cyl('y', 8, 8, 1.6, 15.2, 16, M.metal(COL.black)); b.rod(8, 5.5, 8, 8, 15.2, 8, 0.25, M.metal(COL.black)); b.tube('y', 8, 8, 7, 0.9, 4, 5.2, M.light(COL.warm)); b.tube('y', 8, 8, 4.6, 0.9, 7, 8.2, M.light(COL.warm)); b.tube('y', 8, 8, 2.4, 0.8, 1, 2.2, M.light(COL.warm)); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; b.rod(8, 8.2, 8, 8 + Math.cos(a) * 7, 5.2, 8 + Math.sin(a) * 7, 0.2, M.metal(COL.black)); } } });
  def('vm_table_lamp', 'Table Lamp', { res: 16, size: [1, 1, 1], sound: 'metal', hard: 0.3, light: [9, 7, 4], build: (b) => { b.lathe(8, 8, [[0, 3.2], [0.8, 2.8], [1.5, 1.2], [3, 1.6], [6, 1], [7.5, 0.5]], M.metal(COL.brass)); b.tube('y', 8, 8, 5.2, 0.5, 7, 13.5, M.fabric(0xF2E0C0)); b.cyl('y', 8, 8, 1.4, 8, 10, M.light(COL.warm)); b.tube('y', 8, 8, 5.4, 0.3, 13.5, 13.8, M.metal(COL.brass)); } });
  // a monstera: stems in a lathe pot, big split leaves (ellipsoids with notches cut from the edge)
  def('vm_monstera', 'Monstera', { res: 16, size: [1, 2, 1], sound: 'grass', hard: 0.3, build: (b) => {
    b.lathe(8, 8, [[0, 4.2], [1, 4.6], [7.5, 5.6], [8.2, 5.2]], M.gloss(0xE8E6E0), 0.6); b.cyl('y', 8, 8, 4.8, 7, 7.6, M.matte(COL.soil));
    const lf = M.plant(COL.leaf), lf2 = M.plant(COL.leafL), st = M.plant(0x4E7A38);
    for (let k = 0; k < 7; k++) {
      const a = k * 1.9 + 0.4, r = 4 + (k % 3) * 1.6, y = 11 + k * 2.7, cx = 8 + Math.cos(a) * r, cz = 8 + Math.sin(a) * r;
      b.rod(8, 7.5, 8, cx, y, cz, 0.45, st);
      b.ellipsoid(cx, y, cz, 5, 0.6, 4, k & 1 ? lf : lf2);
      for (let n = 0; n < 5; n++) { const na = n * 1.25 - 0.3; b.ellipsoid(cx + Math.cos(na) * 4.8, y, cz + Math.sin(na) * 3.9, 1.6, 1.5, 1.1, 0); }   // the split notches
      b.ellipsoid(cx, y + 0.1, cz, 0.5, 0.5, 3.6, M.plant(0x6EB85A));   // mid-rib
    }
  } });
  def('vm_olive', 'Olive Tree', { res: 16, size: [1, 2, 1], sound: 'grass', hard: 0.3, build: (b) => {
    b.lathe(8, 8, [[0, 5], [3, 5.6], [8, 6], [9, 5.6]], M.concrete(COL.concrete), 0.8); b.cyl('y', 8, 8, 5.2, 7.5, 8.2, M.matte(COL.soil));
    const bark = M.wood(0x6A5A48);
    b.lathe(8, 8, [[8, 1.6], [16, 1.2], [20, 0.9]], bark); b.rod(8, 18, 8, 4, 25, 6, 0.7, bark); b.rod(8, 18, 8, 12, 26, 10, 0.7, bark); b.rod(8, 19, 8, 7, 27, 12, 0.6, bark); b.rod(4, 25, 6, 2, 29, 5, 0.45, bark); b.rod(12, 26, 10, 13.5, 30, 12, 0.45, bark);
    for (let k = 0; k < 12; k++) { const a = k * 2.3, r = 2.5 + (k % 4); b.ellipsoid(8 + Math.cos(a) * r, 25 + (k % 3) * 2.2, 8 + Math.sin(a) * r, 3.2, 2, 3, M.plant(k & 1 ? 0x8AA07A : 0x6E8A62)); }
  } });
  def('vm_fireplace', 'Fireplace · stone', { size: [2, 2, 1], sound: 'stone', hard: 1.5, light: [14, 9, 3], build: (b) => {
    b.box(0, 0, 6, 32, 32, 16, M.stone(0x9A948A)); for (let y = 0; y < 32; y += 3) for (let x = ((y / 3 | 0) & 1) * 3.5; x < 32; x += 7) b.box(x + 0.3, y + 0.3, 5, Math.min(32, x + 6.7), y + 2.7, 6, M.stone(y % 2 ? 0xA8A298 : 0x9E988E));   // ashlar stone face
    b.cut(4, 1, 2, 28, 13, 16); b.box(4, 0, 6, 28, 1, 16, M.gloss(0x1C1E22)); b.box(4, 1, 15, 28, 13, 16, M.gloss(0x1C1E22)); b.box(4, 13, 6, 28, 14, 16, M.gloss(0x1C1E22)); b.box(4, 1, 6, 4.6, 13, 16, M.gloss(0x1C1E22)); b.box(27.4, 1, 6, 28, 13, 16, M.gloss(0x1C1E22));
    b.rod(8, 2, 9, 24, 2.5, 13, 1.1, M.wood(0x4A3A2A)); b.rod(9, 3, 13, 23, 3.5, 9, 1, M.wood(0x3E2E24));   // logs
    b.extrude([[10, 3], [22, 3], [20, 7], [17, 6], [16, 9.5], [14, 6.5], [12, 7.5]], 'z', 9, 13, M.light(0xFF7A20)); b.extrude([[13, 3.5], [19, 3.5], [18, 6], [16, 8], [14, 6]], 'z', 10, 12, M.light(0xFFC040));   // flames
    b.box(0, 14, 2, 32, 16, 16, M.wood(WOOD.walnut)); b.box(0, 14, 2, 32, 14.5, 2.5, M.wood(sh(WOOD.walnut, 0.85)));   // mantel shelf
    b.lathe(6, 9, [[16, 1.6], [18, 2.4], [20.5, 1.2], [21.5, 1.6]], M.gloss(0xE8E2D4), 0.5); b.rod(6, 21, 9, 7, 25, 9, 0.3, M.plant(0x4E7A38)); b.ellipsoid(7, 25.5, 9, 1.6, 0.9, 1.3, M.plant(COL.leaf));
    b.box(19, 16, 7.5, 29, 24, 8.2, M.gloss(0x2A2D33)); b.box(19.6, 16.6, 7.4, 28.4, 23.4, 7.5, M.gloss(0xC9A24A)); b.extrude([[20, 17], [28, 17], [28, 20], [25, 19], [23, 21], [20, 19.5]], 'z', 7.3, 7.5, M.gloss(0x3A5A4A));   // framed picture
    for (const x of [12, 14.5]) { b.lathe(x, 9, [[16, 1], [18.5, 0.9]], M.gloss(COL.paper)); b.cyl('y', x, 9, 0.25, 18.5, 19.3, M.light(0xFFE2A0)); }
  } });
  def('vm_piano', 'Grand Piano', { size: [2, 1, 2], sound: 'wood', hard: 1.2, build: (b) => {
    const bk = M.gloss(0x111214), bk2 = M.gloss(0x1E2024);
    const body = [[0, 0], [32, 0], [32, 12], [26, 20], [16, 30], [4, 30], [0, 20]];
    b.extrude(body, 'y', 9.5, 14, bk); b.extrude(body.map(([x, z]) => [x + (x < 16 ? 0.6 : -0.6), z + (z < 15 ? 0.6 : -0.6)]), 'y', 14, 15, bk2);
    for (const [x, z] of [[3, 3], [29, 3], [9, 26]]) b.lathe(x, z, [[0, 1.4], [9.5, 1]], bk); b.cyl('y', 3, 3, 1.8, 0, 0.6, bk);
    b.box(2.5, 9.5, 0, 29.5, 10, 3.5, bk); b.box(3, 10, 0.3, 29, 11, 3, M.gloss(COL.white)); for (let x = 3.7; x < 29; x += 1.9) if (((x - 3.7) / 1.9 | 0) % 7 !== 2 && ((x - 3.7) / 1.9 | 0) % 7 !== 5) b.box(x, 11, 0.5, x + 0.9, 11.7, 2.2, bk);   // keyboard
    b.box(2.5, 11.7, 3.5, 29.5, 15, 4.5, bk); b.box(9, 15, 5, 23, 15.3, 16, bk); b.extrude([[9, 15.3], [23, 15.3], [23, 23], [9, 23]], 'z', 9, 9.4, bk); b.box(11, 16.5, 8.9, 21, 21.5, 9.1, M.matte(COL.paper));   // fallboard, music stand with sheet music
    b.cushion(11, 5, 9, 21, 7, 13.5, 0.8, M.leather(0x2A2C30), true); b.box(11.5, 1, 9.5, 20.5, 5, 13, bk); b.box(12, 0, 10, 20, 1, 12.5, bk);   // bench
    for (const x of [13, 16, 19]) b.rod(x, 0.6, 29.5, x, 2.2, 28.5, 0.3, M.metal(COL.brass));   // pedals
  } });

  // ------------------------------------------------------------------ outdoor
  def('vm_lounger', 'Sun Lounger', { res: 16, size: [1, 1, 2], sound: 'wood', hard: 0.6, seat: true, build: (b) => {
    const m = M.metal(0x2A2D33), teak = M.wood(0xD8C8A8);
    for (const [x, z] of [[1.5, 2.5], [14.5, 2.5], [1.5, 28.5], [14.5, 28.5]]) b.lathe(x, z, [[0, 0.8], [3, 0.7]], m); b.rod(1.5, 2.5, 2.5, 1.5, 2.5, 28.5, 0.5, m); b.rod(14.5, 2.5, 2.5, 14.5, 2.5, 28.5, 0.5, m);
    for (let z = 1; z < 20; z += 1.6) b.box(0.5, 3, z, 15.5, 3.8, z + 1, teak);
    for (let t = 0; t < 12; t += 1.6) b.box(0.5, 3 + t * 0.75, 20 + t, 15.5, 3.8 + t * 0.75, 21 + t, teak);
    b.cushion(1.5, 3.8, 2.5, 14.5, 5.3, 19.5, 0.8, M.fabric(0x3F6AC0), true); for (let t = 0; t < 11; t += 1.6) b.cushion(1.5, 4.5 + t * 0.75, 20 + t, 14.5, 6 + t * 0.75, 21.6 + t, 0.6, M.fabric(0x3F6AC0)); b.cushion(3, 7.5, 25, 13, 10, 30, 1.5, M.fabric(0xF4F0E8), true);
  } });
  def('vm_garden_table', 'Garden Table · teak', { size: [2, 1, 1], sound: 'wood', hard: 1, build: (b) => { const t = M.wood(0xA8865A); for (let z = 0.5; z < 15.5; z += 2.5) b.box(0, 11.5, z, 32, 13, z + 2, t); b.box(0, 11, 0.5, 32, 11.5, 15.5, M.wood(0x8E7048)); for (const [x, z] of [[2, 2], [30, 2], [2, 14], [30, 14]]) b.box(x - 1, 0, z - 1, x + 1, 11, z + 1, t); b.box(1, 7, 1.5, 31, 8, 2.5, t); b.box(1, 7, 13.5, 31, 8, 14.5, t); b.lathe(16, 8, [[13, 2.2], [14, 2.5], [16, 1.8]], M.concrete(0x6E7076), 0.5); b.sphere(16, 17, 8, 2.4, M.plant(0x7E9A62)); } });
  def('vm_garden_chair', 'Garden Chair', { res: 16, size: [1, 1, 1], sound: 'metal', hard: 0.5, seat: true, build: (b) => { const m = M.metal(0x2A2D33), t = M.wood(0xA8865A); for (const [x, z] of [[2.5, 2.5], [13.5, 2.5], [2.5, 13.5], [13.5, 13.5]]) b.lathe(x, z, [[0, 0.7], [8, 0.6]], m); b.rod(2.5, 8, 2.5, 2.5, 8, 13.5, 0.5, m); b.rod(13.5, 8, 2.5, 13.5, 8, 13.5, 0.5, m); for (let z = 2.5; z < 13.5; z += 1.6) b.box(1.5, 8, z, 14.5, 8.7, z + 1, t); b.rod(2.5, 8, 13, 2.5, 16, 13.5, 0.5, m); b.rod(13.5, 8, 13, 13.5, 16, 13.5, 0.5, m); for (let y = 9.5; y < 16; y += 1.6) b.box(1.5, y, 12.6, 14.5, y + 1, 13.4, t); b.cushion(2, 8.7, 2.5, 14, 10, 12.5, 0.8, M.fabric(0xF4F0E8), true); } });
  def('vm_bbq', 'Gas BBQ', { res: 16, size: [2, 1, 1], sound: 'metal', hard: 1, light: [6, 3, 1], build: (b) => {
    b.box(2, 1, 3, 30, 10, 13, M.metal(0x2A2D33)); b.box(2.5, 3, 2.5, 15, 9, 3, M.metal(0x34373E)); b.box(15.5, 3, 2.5, 29.5, 9, 3, M.metal(0x34373E)); b.rod(5, 7.5, 2.3, 12, 7.5, 2.3, 0.3, M.chrome()); b.rod(18, 7.5, 2.3, 26, 7.5, 2.3, 0.3, M.chrome());   // doors
    for (const [x, z] of [[4, 4], [28, 4], [4, 12], [28, 12]]) b.cyl('y', x, z, 1, 0, 1, M.gloss(0x111214));
    b.box(1, 10, 2, 31, 12, 14, M.metal(COL.steel)); b.box(2.5, 12, 3, 29.5, 15, 13, M.metal(COL.steel)); b.cut(3.5, 12.5, 4, 28.5, 15, 12);   // body and open lid
    b.box(3.5, 12, 4, 28.5, 12.6, 12, M.light(0xFF6A2A)); for (let x = 4; x < 28.5; x += 1.4) b.box(x, 12.6, 4, x + 0.6, 13, 12, M.metal(0x3A3D44));
    b.pbox(2.5, 15, 10, 29.5, 20, 13.5, 1, M.metal(COL.steel)); b.rod(4, 20, 11.5, 28, 20, 11.5, 0.5, M.metal(COL.black)); b.box(12, 16.5, 9.8, 20, 18.5, 10, M.gloss(0x111214));   // raised lid with handle
    b.rod(2, 11, 1.2, 30, 11, 1.2, 0.5, M.chrome()); for (const x of [4.5, 8.5, 12.5]) { b.cyl('z', x, 10.6, 0.9, 1.2, 2, M.metal(COL.black)); b.box(x - 0.2, 10.6, 1, x + 0.2, 11.4, 1.2, M.metal(COL.black)); }   // towel rail and knobs
    b.rbox(8, 13, 6, 12, 13.8, 10, 0.4, M.gloss(0xC8442A)); b.rbox(16, 13, 6, 20, 13.8, 10, 0.4, M.gloss(0xC8442A)); b.rbox(22, 13, 5, 26, 13.6, 9, 0.5, M.gloss(0xE8B83A));   // food on the grill
  } });
  def('vm_planter', 'Planter · boxwood', { res: 16, size: [1, 1, 1], sound: 'stone', hard: 0.6, build: (b) => { b.pbox(2, 0, 2, 14, 7, 14, 1.5, M.concrete(0x6E7076)); b.pbox(2.6, 6.4, 2.6, 13.4, 7, 13.4, 1, 0); b.box(3, 6, 3, 13, 6.6, 13, M.matte(COL.soil)); b.sphere(8, 10.5, 8, 4.6, M.plant(0x3E7A3A)); for (let k = 0; k < 10; k++) { const a = k * 2.4, e = k * 1.3; b.sphere(8 + Math.cos(a) * 3.6, 10.5 + Math.sin(e) * 2.8, 8 + Math.sin(a) * 3.6, 1.6, M.plant(k & 1 ? 0x4A8A44 : 0x3A7238)); } } });

  // ------------------------------------------------------------------ accents: lamps, art, sideboards, kitchen extras, kids, outdoor
  def('vm_floor_lamp', 'Tripod Floor Lamp', { res: 16, size: [1, 2, 1], sound: 'wood', hard: 0.4, light: [10, 8, 5], build: (b) => {
    const w = M.wood(WOOD.walnut);
    for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3 + 0.5; b.rod(8 + Math.cos(a) * 5.5, 0, 8 + Math.sin(a) * 5.5, 8, 18, 8, 0.6, w); }
    b.cyl('y', 8, 8, 1.2, 17, 20, M.metal(COL.brass)); b.tube('y', 8, 8, 6.5, 0.5, 20, 30, M.fabric(0xF2E0C0)); b.cyl('y', 8, 8, 1.6, 22, 25, M.light(COL.warm)); b.tube('y', 8, 8, 6.7, 0.3, 30, 30.4, M.metal(COL.brass));
  } });
  def('vm_sideboard', 'Sideboard · oak', { size: [3, 1, 1], sound: 'wood', hard: 1, build: (b) => {
    const w = M.wood(WOOD.oak), wd = M.wood(sh(WOOD.oak, 0.9));
    b.box(0, 2, 2.5, 48, 12, 16, w); b.box(0.5, 2.5, 2, 47.5, 11.5, 2.5, M.matte(0x2A2420));
    for (let k = 0; k < 4; k++) { b.box(k * 12 + 0.4, 2.5, 1.5, k * 12 + 11.6, 11.5, 2.5, wd); for (let y = 3.5; y < 11; y += 1.1) b.recolor(k * 12 + 0.4, y, 1.5, k * 12 + 11.6, y + 0.35, 2.5, M.wood(sh(WOOD.oak, 0.8))); }   // slatted doors
    for (const x of [3, 45]) b.lathe(x, 9, [[0, 0.9], [2, 0.7]], M.metal(COL.black)); b.box(2.5, 1.5, 5, 45.5, 2, 13, M.metal(COL.black));
    b.lathe(8, 9, [[12, 2.2], [14, 3], [17.5, 2], [18.5, 2.6]], M.gloss(0x2F7A6A), 0.5); b.rod(8, 18, 9, 7, 23, 9.5, 0.3, M.plant(0x4E7A38)); b.ellipsoid(7, 23.5, 9.5, 1.8, 1, 1.4, M.plant(COL.leafL));
    b.box(20, 12, 7, 32, 12.6, 11, M.gloss(COL.paper)); b.rbox(21, 12.6, 8, 24, 13.6, 10, 0.4, M.gloss(0xC8442A)); b.rbox(25, 12.6, 8, 28, 13.6, 10, 0.4, M.gloss(0xE8B83A)); b.rbox(29, 12.6, 8, 31.5, 13.6, 10, 0.4, M.gloss(0x8AA07A));   // a bowl of fruit on a tray
    b.box(37, 12, 9, 46, 19, 10, M.gloss(0x2A2D33)); b.box(37.6, 12.6, 8.9, 45.4, 18.4, 9, M.gloss(0xD8C8A0)); b.extrude([[38, 13], [45, 13], [45, 16], [42, 15], [40, 17], [38, 15.5]], 'z', 8.8, 9, M.gloss(0x3A5A4A));   // a leaning framed print
    books(b, 12, 12, 7, 2, 6, 7);
  } });
  def('vm_dresser', 'Dresser · walnut', { size: [2, 1, 1], sound: 'wood', hard: 1, build: (b) => {
    const w = M.wood(WOOD.walnut);
    b.box(0, 2, 2.5, 32, 12, 16, w); b.box(0.5, 2.5, 2, 31.5, 11.5, 2.5, M.matte(0x2A2420));
    for (let k = 0; k < 3; k++) for (const x0 of [0, 16]) drawerFront(b, x0, 2 + k * 3.33, x0 + 16, 2 + (k + 1) * 3.33, 2, M.wood(WOOD.smoked), 'bar', M.metal(COL.brass));
    for (const [x, z] of [[2.5, 4], [29.5, 4], [2.5, 14], [29.5, 14]]) b.lathe(x, z, [[0, 0.9], [2, 0.7]], M.metal(COL.black));
    b.box(21, 12, 9.5, 31, 13, 10.5, M.metal(COL.brass)); b.box(21.5, 13, 9.7, 30.5, 26, 10.3, M.gloss(0xC8DCE8)); b.box(21, 12, 9.5, 31, 26.5, 9.7, M.metal(COL.brass)); b.cut(21.5, 12.5, 9.5, 30.5, 26, 9.7);   // a framed mirror leaning on the wall
    b.lathe(5, 9, [[12, 1.4], [13.5, 2], [16, 1.2], [16.6, 1.5]], M.gloss(0xE8E2D4), 0.5); b.rod(5, 16.5, 9, 6, 20, 9.5, 0.3, M.plant(0x4E7A38)); b.ellipsoid(6, 20.5, 9.5, 1.4, 0.8, 1.1, M.plant(COL.leaf));
    b.rbox(10, 12, 6, 16, 12.8, 11, 0.4, M.leather(0x6A4A30)); b.lathe(13, 8.5, [[12.8, 0.8], [14.5, 0.7], [15, 0.4]], M.glass(0xE8D8A0)); b.lathe(10.8, 8.2, [[12.8, 0.6], [14, 0.6]], M.gloss(0x2A2D33));   // a leather tray with perfume bottles
  } });
  // wall art: a frame with a canvas; three motifs. Hangs on the +z wall at eye height
  function art(name, display, paint) {
    def(name, display, { size: [1, 1, 1], sound: 'wood', hard: 0.3, build: (b) => { b.box(1, 2, 15, 15, 14, 16, M.wood(WOOD.black)); b.box(1.6, 2.6, 14.6, 14.4, 13.4, 15, M.matte(COL.paper)); paint(b); } });
  }
  art('vm_art_abstract', 'Art · abstract', (b) => { b.box(2.5, 3.5, 14.4, 13.5, 12.5, 14.6, M.matte(0xE8E2D4)); b.extrude([[3, 4], [9, 4], [8, 9], [4, 11]], 'z', 14.2, 14.6, M.matte(0x2F3F60)); b.cyl('z', 10, 9, 2.6, 14.2, 14.6, M.matte(0xD2A84A)); b.box(4, 5.5, 14.1, 12.5, 6.2, 14.6, M.matte(0xC0443A)); });
  art('vm_art_landscape', 'Art · landscape', (b) => { for (let y = 3.5; y < 12.5; y += 0.5) b.box(2.5, y, 14.4, 13.5, y + 0.5, 14.6, M.matte(y < 7 ? 0x6A9AC8 : 0xB8D4E8)); b.extrude([[2.5, 3.5], [13.5, 3.5], [13.5, 6], [11, 8.5], [8, 6.5], [5.5, 9], [2.5, 7]], 'z', 14.2, 14.6, M.matte(0x4A6A4A)); b.box(2.5, 3.5, 14.2, 13.5, 5, 14.6, M.matte(0x3A5A8A)); b.cyl('z', 11, 10.5, 1, 14.2, 14.6, M.matte(0xFFE4A0)); });
  art('vm_art_photo', 'Art · photo trio', (b) => { b.cut(0, 0, 14, 16, 16, 16); for (let k = 0; k < 3; k++) { const x0 = 1 + k * 5; b.box(x0, 5, 15, x0 + 4, 11, 16, M.metal(COL.black)); b.box(x0 + 0.4, 5.4, 14.7, x0 + 3.6, 10.6, 15, M.matte(COL.paper)); b.box(x0 + 0.8, 5.8, 14.6, x0 + 3.2, 10.2, 14.7, M.matte([0x6A7078, 0x9A8A6A, 0x4A5A6A][k])); } });
  def('vm_mirror_round', 'Round Mirror', { res: 16, size: [1, 1, 1], sound: 'glass', hard: 0.3, build: (b) => { b.tube('z', 8, 8, 6.5, 0.6, 15.2, 16, M.metal(COL.brass)); b.cyl('z', 8, 8, 6, 15.4, 15.8, M.gloss(0xC8DCE8)); } });
  def('vm_sculpture', 'Sculpture · bronze', { res: 16, size: [1, 2, 1], sound: 'stone', hard: 1, build: (b) => {
    b.box(4, 0, 4, 12, 16, 12, M.marble(COL.marble)); b.box(3.5, 15.5, 3.5, 12.5, 16, 12.5, M.marble(sh(COL.marble, 0.9)));
    const br = M.metal(0x8A6A3A);
    b.lathe(8, 8, [[16, 2.2], [17, 1.2], [20, 1.6], [24, 2.8], [27, 1.4], [29.5, 2.2], [31, 0.8]], br); b.ellipsoid(8, 24, 8, 3.8, 2.2, 2.4, br); b.cut(6.5, 23, 5, 9.5, 25, 11);
  } });
  def('vm_towel_rail', 'Heated Towel Rail', { size: [1, 1, 1], sound: 'metal', hard: 0.5, build: (b) => { const c = M.chrome(); b.rod(3, 1, 15.2, 3, 15, 15.2, 0.4, c); b.rod(13, 1, 15.2, 13, 15, 15.2, 0.4, c); for (let y = 2; y < 15; y += 1.6) b.rod(3, y, 15.2, 13, y, 15.2, 0.3, c); b.rbox(4, 7, 14.2, 12, 13.5, 15, 0.5, M.fabric(0xF4F0E8)); b.rbox(4.5, 3, 14.2, 11.5, 7, 15, 0.5, M.fabric(0x8FA38E)); } });
  def('vm_laundry_basket', 'Laundry Basket', { res: 16, size: [1, 1, 1], sound: 'wood', hard: 0.3, build: (b) => { b.lathe(8, 8, [[0, 4.5], [1, 4.8], [10, 5.2], [11, 5]], M.wood(0xC8A878), 0.6); for (let y = 1; y < 11; y += 1.2) b.recolor(2, y, 2, 14, y + 0.4, 14, M.wood(0xB08C5C)); b.cyl('y', 8, 8, 4.6, 10, 10.6, M.fabric(0xF4F0E8)); b.cushion(5, 10.6, 5, 11, 12, 11, 1, M.fabric(0x4F7FB8), false); } });
  def('vm_bar_cart', 'Bar Cart', { res: 16, size: [1, 1, 1], sound: 'metal', hard: 0.5, build: (b) => {
    const br = M.metal(COL.brass);
    for (const [x, z] of [[2.5, 2.5], [13.5, 2.5], [2.5, 13.5], [13.5, 13.5]]) { b.rod(x, 1, z, x, 14.5, z, 0.5, br); b.sphere(x, 0.9, z, 0.9, M.gloss(0x111214)); }
    for (const y of [5, 13]) { b.box(2, y, 2, 14, y + 0.5, 14, M.glass(0xDCEFF8)); b.box(2, y, 2, 14, y + 1.2, 2.6, br); b.box(2, y, 13.4, 14, y + 1.2, 14, br); b.box(2, y, 2, 2.6, y + 1.2, 14, br); b.box(13.4, y, 2, 14, y + 1.2, 14, br); }   // two glass trays with a brass rim
    for (const [x, z, c, h] of [[5, 5.5, 0x6A3A1A, 7], [8, 5.5, 0x2A6A3A, 8], [11, 5.5, 0xC8A24A, 6.5], [4.5, 10.5, 0x2A2D33, 7.5]]) { b.lathe(x, z, [[13.5, 1.1], [13.5 + h * 0.6, 1.1], [13.5 + h * 0.75, 0.5], [13.5 + h, 0.5]], M.glass(c), 0.3); b.cyl('y', x, z, 0.5, 13.5 + h, 14.5 + h, M.metal(COL.black)); }
    for (const [x, z] of [[8.5, 10.5], [11.5, 10.5]]) b.lathe(x, z, [[13.5, 1.2], [16, 1.1], [16.5, 1.3]], M.glass(0xE8F4FA), 0.25);
    b.lathe(8, 8, [[5.5, 2.2], [8.5, 2.4]], M.metal(COL.steel), 0.4); b.lathe(4, 4, [[5.5, 0.9], [11, 0.9]], M.glass(0x2A4A2A), 0.3); b.lathe(12, 11, [[5.5, 1], [10, 0.9], [10.8, 0.5]], M.glass(0x8A2A2A), 0.3);   // ice bucket and bottles below
  } });
  def('vm_dining_bench', 'Dining Bench · oak', { size: [3, 1, 1], sound: 'wood', hard: 0.6, seat: true, build: (b) => { const w = M.wood(WOOD.oak); b.pbox(0, 8, 4, 48, 9.5, 12, 1, w); b.box(3, 0, 5, 5.5, 8, 11, w); b.box(42.5, 0, 5, 45, 8, 11, w); b.box(5.5, 1.5, 7.5, 42.5, 2.5, 8.5, w); b.cushion(1, 9.5, 4.5, 47, 11, 11.5, 0.8, M.fabric(FAB.cream), true); } });
  def('vm_range_hood', 'Range Hood · steel', { size: [1, 1, 1], sound: 'metal', hard: 0.8, light: [5, 4, 3], build: (b) => { b.box(0.5, 6, 2, 15.5, 8, 16, M.metal(COL.steel)); b.box(1, 5.5, 2.5, 15, 6, 15.5, M.metal(0x9A9EA4)); b.box(4, 8, 8, 12, 16, 16, M.metal(COL.steel)); b.box(5, 5.6, 4, 7, 6, 6, M.light(COL.warm)); b.box(9, 5.6, 4, 11, 6, 6, M.light(COL.warm)); b.box(2, 6.2, 1.8, 14, 7.6, 2, M.gloss(0x1C1E22)); } });
  def('vm_dishwasher', 'Dishwasher', { size: [1, 1, 1], sound: 'metal', hard: 1, build: (b) => { carcass(b, 0, 16, 0xF2F2EE); b.box(0.5, 1.5, 1, 15.5, 13, 2, M.metal(COL.steel)); b.rod(2, 11.8, 0.6, 14, 11.8, 0.6, 0.4, M.metal(COL.steel)); b.box(2, 11.5, 0.6, 2.6, 12.1, 1, M.metal(COL.steel)); b.box(13.4, 11.5, 0.6, 14, 12.1, 1, M.metal(COL.steel)); b.box(1, 12.3, 0.9, 15, 12.8, 1, M.gloss(0x1C1E22)); counterTop(b, 0, 16, M.marble(COL.marble)); } });
  def('vm_kitchen_shelf', 'Kitchen Shelf & Jars', { size: [1, 1, 1], sound: 'wood', hard: 0.4, build: (b) => {
    b.box(0, 6, 11, 16, 7, 16, M.wood(WOOD.oak)); b.box(0, 12, 11, 16, 13, 16, M.wood(WOOD.oak)); for (const x of [1, 15]) { b.box(x - 0.5, 7, 15.2, x + 0.5, 12, 16, M.metal(COL.black)); b.box(x - 0.5, 5.5, 15.2, x + 0.5, 6, 16, M.metal(COL.black)); }
    for (const [x, c, h] of [[3, 0xD2A84A, 4], [6.5, 0xC8A878, 4.5], [10, 0x6A3A1A, 3.5], [13.5, 0xF4F0E8, 4]]) { b.lathe(x, 13.5, [[7, 1.4], [7 + h, 1.4], [7.4 + h, 1]], M.glass(c), 0.35); b.cyl('y', x, 13.5, 1.1, 7.4 + h, 8 + h, M.wood(WOOD.ash)); }
    b.lathe(3, 13.5, [[13, 1.6], [15.5, 1.3]], M.gloss(COL.white)); b.lathe(6.5, 13.5, [[13, 1.6], [15.5, 1.3]], M.gloss(COL.white)); b.box(9, 13, 12, 15, 15.8, 15, M.wood(WOOD.walnut)); for (let x = 9.5; x < 15; x += 1.4) b.recolor(x, 13, 12, x + 0.5, 15.8, 15, M.wood(sh(WOOD.walnut, 0.8)));   // mugs and a knife block
  } });
  def('vm_toy_box', 'Toy Box', { size: [1, 1, 1], sound: 'wood', hard: 0.5, build: (b) => { b.box(1, 0.5, 2, 15, 8, 14, M.matte(0xF2F2EE)); b.box(1.5, 0, 2.5, 14.5, 0.5, 13.5, M.matte(0xE2DED4)); b.box(0.5, 8, 1.5, 15.5, 9, 14.5, M.wood(WOOD.ash)); b.box(2, 2, 1.8, 14, 6.5, 2, M.matte(0x8FC8E8)); b.box(5, 3, 1.6, 11, 5.5, 1.8, M.matte(0xF2C84A)); b.sphere(4, 10.5, 8, 1.8, M.gloss(0xC0443A)); b.box(7, 9, 5, 11, 11.5, 9, M.matte(0x3F63A8)); b.box(11.5, 9, 6, 14, 10.5, 8.5, M.matte(0x3E8A4A)); b.cushion(6, 9, 10, 12, 12, 13, 1.2, M.fabric(0xC8A878), false); } });
  def('vm_bunk_bed', 'Bunk Bed', { size: [1, 2, 2], sound: 'wood', hard: 0.8, bed: true, build: (b) => {
    const w = M.wood(WOOD.ash);
    for (const [x, z] of [[1, 1], [15, 1], [1, 31], [15, 31]]) b.box(x - 1, 0, z - 1, x + 1, 30, z + 1, w);
    for (const y of [3, 18]) { b.box(0, y, 0, 16, y + 2, 32, w); b.cushion(1, y + 2, 1, 15, y + 5, 31, 1, M.fabric(0xF2F2EE), true); b.cushion(0.5, y + 4.5, 0, 15.5, y + 7.5, 21, 1.8, M.fabric(y > 10 ? 0x4F7FB8 : 0xE8B83A), true); b.cushion(2.5, y + 5, 23, 13.5, y + 8, 30, 1.5, M.fabric(0xFAFAF6), true); }
    b.box(0, 20, 0, 16, 23, 1, w); for (let x = 2; x < 14; x += 3) b.box(x, 23, 0, x + 1, 25, 1, w); b.box(0, 25, 0, 16, 26, 1, w);   // guard rail
    for (let y = 2; y < 18; y += 3) b.box(14, y, 12, 16, y + 1, 16, w); b.box(14, 0, 11, 15, 20, 12, w); b.box(14, 0, 16, 15, 20, 17, w);   // ladder
  } });
  def('vm_parasol', 'Cantilever Parasol', { res: 16, size: [3, 2, 3], sound: 'wool', hard: 0.5, build: (b) => {
    const m = M.metal(0x3A3D44), cloth = M.fabric(0xE8E2D4);
    b.box(36, 0, 36, 46, 1.5, 46, M.concrete(0x6E7076)); b.cyl('y', 41, 41, 1, 1.5, 28, m); b.rod(41, 28, 41, 24, 31, 24, 0.9, m);
    b.lathe(24, 24, [[26, 23], [28, 20], [30, 12], [31.5, 2]], cloth); b.lathe(24, 24, [[24.6, 23], [26.6, 20], [28.6, 12], [30.1, 2]], 0); b.cyl('y', 24, 24, 1.2, 25, 31.8, m);   // a thin cloth shell
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; b.rod(24, 31, 24, 24 + Math.cos(a) * 21, 26.5, 24 + Math.sin(a) * 21, 0.4, m); }   // ribs
  } });
  def('vm_fire_pit', 'Fire Pit', { res: 16, size: [2, 1, 2], sound: 'stone', hard: 1, light: [14, 8, 2], build: (b) => {
    b.lathe(16, 16, [[0, 11], [2, 11.5], [7, 12.5], [8, 12]], M.concrete(0x5A5C62), 1.2); b.cyl('y', 16, 16, 10.6, 5, 6, M.stone(0x2A2D33));
    for (let k = 0; k < 14; k++) { const a = k * 2.4, r = 2 + (k % 5) * 1.6; b.sphere(16 + Math.cos(a) * r, 6.3, 16 + Math.sin(a) * r, 0.9, M.gloss(0x1A1A1C)); }
    b.lathe(16, 16, [[6, 6], [8.5, 4.5], [11, 2.2], [13, 0.6]], M.light(0xFF7A20)); b.lathe(16, 16, [[6.5, 3.5], [9, 2], [10.5, 0.5]], M.light(0xFFC040));
  } });
  def('vm_outdoor_sofa', 'Outdoor Sofa · rattan', { res: 16, size: [2, 1, 1], sound: 'wood', hard: 0.6, seat: true, build: (b) => {
    const r = M.wood(0x8A7050), rd = M.wood(0x7A6040);
    b.box(0, 1.5, 0, 32, 7, 16, r); for (let y = 2; y < 7; y += 1) b.recolor(0, y, 0, 32, y + 0.4, 16, rd); for (let x = 0; x < 32; x += 1.5) b.recolor(x, 1.5, 0, x + 0.5, 7, 16, rd);   // woven base
    b.box(0, 7, 12, 32, 13, 16, r); for (let y = 7.5; y < 13; y += 1) b.recolor(0, y, 12, 32, y + 0.4, 16, rd); b.box(0, 7, 0, 2.5, 10, 16, r); b.box(29.5, 7, 0, 32, 10, 16, r);
    b.cushion(2.5, 7, 0.5, 29.5, 9.5, 12, 1.2, M.fabric(0xE8E2D4), true); b.cushion(2.5, 9, 10, 29.5, 15, 13, 1.5, M.fabric(0xE8E2D4), true); throwPillow(b, 8, 10, 9, 5, 0x2F7A6A); throwPillow(b, 24, 10, 9, 5, 0xD2A84A);
  } });
})(VR);

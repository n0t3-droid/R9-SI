// ============================================================================
// Voxel plants (TRAILER.md §2.2, the trailer's vegetation): the one palm crown that every town and garden shares
// (t-city adopts it through VR.Plants.palm), two round trees in two sizes with dense leaf balls, grass tufts and
// flower clusters for the lawns, a round bush with blossoms and a rice-terrace crop block. All are VM models
// (VX32 pieces, voxmodel.js), registered LATE (VR.BL.late) so every older block keeps its id. The fronds, leaves
// and blossoms carry the sway bits of the mesher (w5 bits 5–6): the wind moves the crown and the leaves, the trunk
// stays put. A model's far box is its averaged colour (voxarch lodFromQuads), so the distance costs one box a part.
// ============================================================================
(function (VR) {
  'use strict';
  const VM = VR.VM, VX = VR.VX;
  if (!VM || !VX || !VR.BL) return;
  const P = VR.Plants = VR.Plants || {};
  const NAMES = P.NAMES = [];
  const PLANT = P.COL = {
    bark: 0x6A4A2A, ringBark: 0x4E3520, nut: 0x5E4026, crownShaft: 0x5E8A4A,
    leafD: 0x25702A, leaf1: 0x2F8A34, leaf2: 0x4AB046, leaf3: 0x74D25A,
    blade1: 0x5FD13A, blade2: 0x3F9A2A, stem: 0x3F9A2A,
    pink: 0xF08FB0, white: 0xFFFFFF, violet: 0xB070FF, yellow: 0xF6D23A, red: 0xE8403A,
    dirt: 0x5A4028, rice1: 0x6DCB3C, rice2: 0xB6E35A,
  };
  // the sway of a piece: every part from row `swayFrom` up moves with level `sway` (0 still … 3 the crown's full
  // sway), set per model as partSway. One level per column: parts that move by different amounts would open seams.
  const def = (name, display, o) => {
    VM.define(name, display, Object.assign({ res: 16, sound: 'grass', hard: 0.4, cat: 'vplants', cats: ['vplants'], sway: 0, swayFrom: 0 }, o, { late: true }));
    NAMES.push(name);
    return name;
  };
  // the part sway of a compiled model, from its rule: called from VR.BL.late after the models are compiled
  P.partSway = function (model, o) {
    const level = o.sway || 0, from = o.swayFrom | 0;
    model.partSway = model.parts.map(p => (level && p.py >= from) ? level : 0);
    return model.partSway;
  };

  // ---------------------------------------------------------------- the palm crown: 7×2×7 blocks, ten drooping fronds
  // The trunk (vx_palm_trunk, ringed) stands below; the crown's floor is the trunk's top. Fronds leave the crown's
  // centre at a shallow angle, run out 4.5 blocks and droop to the crown's lower edge; each has two rows of leaflets
  // hanging off it; three coconuts hang under the crown; the crownshaft is a green bulb on the trunk.
  def('vm_palm_crown', 'Palm Crown', {
    res: 8, size: [7, 2, 7], sway: 3, swayFrom: 0, sound: 'grass', hard: 0.3,
    build(b, M) {
      const cx = 56, cy = 22, cz = 56;
      b.ellipsoid(cx, 6, cz, 4.5, 4.2, 4.5, M.plant(PLANT.crownShaft));
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2 + (k & 1) * 0.16, dx = Math.cos(a), dz = Math.sin(a);
        let px = cx + dx * 6, py = cy + 4, pz = cz + dz * 6;
        for (let s = 1; s <= 9; s++) {
          const u = s / 9, r = 6 + 44 * u;
          const nx = cx + dx * r, ny = 26 - 8 * u - 15 * u * u, nz = cz + dz * r;
          const thick = 2.6 - 1.5 * u;
          b.rod(px, py, pz, nx, ny, nz, thick, M.plant((s & 1) ? PLANT.leaf1 : PLANT.leaf2));
          if (s === 3 || s === 5 || s === 7 || s === 9) {
            // two rows of leaflets: swept back and out to each side, hanging under the frond
            for (const side of [-1, 1]) {
              const lx = Math.cos(a + side * 0.9), lz = Math.sin(a + side * 0.9), L = 13 - 5 * u;
              b.rod(nx, ny, nz, nx + lx * L * 0.7, ny - L * 0.55, nz + lz * L * 0.7, 1.1, M.plant(s === 9 ? PLANT.leaf3 : PLANT.leaf2));
            }
          }
          px = nx; py = ny; pz = nz;
        }
      }
      for (const [x, y, z] of [[52, 19, 54], [60, 18, 58], [56, 16, 62]]) b.sphere(x, y, z, 3.4, M.matte(PLANT.nut));
    },
  });

  // ---------------------------------------------------------------- round trees: a straight trunk, dense leaf balls
  const treeBuild = (W, H, big) => (b, M) => {
    const cx = W * 8, cz = W * 8, top = H * 16 * 0.62;
    b.rod(cx, 0, cz, cx, top, cz, big ? 4.2 : 2.8, M.wood(PLANT.bark));
    for (let y = 6; y < top; y += 9) b.rod(cx, y, cz, cx, y + 1, cz, (big ? 4.2 : 2.8) + 0.7, M.matte(PLANT.ringBark));
    const R = big ? 1 : 0.62, ccy = top + 2 + 6 * R;
    b.ellipsoid(cx, ccy, cz, 18 * R + 4, 13 * R + 4, 18 * R + 4, M.plant(PLANT.leaf1));
    const balls = big ? [[-22, -4, 14, 9], [20, 2, 10, 8], [-10, 16, -18, 10], [18, 14, -14, 9], [0, 28, 0, 11], [-14, 18, 20, 7], [16, 22, 18, 7]]
      : [[-9, -2, 6, 6], [8, 2, -6, 6], [-4, 8, -8, 6], [6, 10, 6, 5]];
    balls.forEach(([dx, dy, dz, r], i) => { b.ellipsoid(cx + dx * R, ccy + dy * R, cz + dz * R, r * R + 2, (r * 0.8) * R + 2, r * R + 2, M.plant(i & 1 ? PLANT.leaf2 : PLANT.leaf1)); });
    b.ellipsoid(cx, ccy - 8 * R, cz, 15 * R + 2, 4 * R + 2, 15 * R + 2, M.plant(PLANT.leafD));
  };
  def('vm_tree_round_s', 'Round Tree Small', { res: 8, size: [3, 4, 3], sway: 2, swayFrom: 1, sound: 'grass', hard: 0.5, build: treeBuild(3, 4, false) });
  def('vm_tree_round_l', 'Round Tree Large', { res: 8, size: [5, 6, 5], sway: 2, swayFrom: 1, sound: 'grass', hard: 0.5, build: treeBuild(5, 6, true) });

  // ---------------------------------------------------------------- lawn pieces, one block each
  def('vm_tuft_grass', 'Grass Tuft', {
    size: [1, 1, 1], sway: 2, swayFrom: 0, sound: 'grass', hard: 0.1,
    build(b, M) {
      for (let k = 0; k < 6; k++) {
        const a = k * 2.1 + 0.5, r = 2.4 + (k % 3) * 1.4, x = 8 + Math.cos(a) * r, z = 8 + Math.sin(a) * r;
        b.rod(8 + Math.cos(a) * 0.6, 0, 8 + Math.sin(a) * 0.6, x + Math.cos(a) * 1.2, 12 + (k % 3) * 2, z + Math.sin(a) * 1.2, 0.6, M.plant(k & 1 ? PLANT.blade1 : PLANT.blade2));
      }
    },
  });
  def('vm_flower_cluster', 'Flower Cluster', {
    size: [1, 1, 1], sway: 2, swayFrom: 0, sound: 'grass', hard: 0.1,
    build(b, M) {
      const heads = [PLANT.pink, PLANT.white, PLANT.violet, PLANT.yellow, PLANT.red];
      for (let k = 0; k < 5; k++) {
        const a = k * 1.25 + 0.4, x = 8 + Math.cos(a) * 3.4, z = 8 + Math.sin(a) * 3.4, h = 8 + (k % 2) * 3;
        b.rod(x, 0, z, x, h, z, 0.7, M.plant(PLANT.stem));
        b.sphere(x, h + 1.4, z, 2.3, M.matte(heads[k]));
      }
    },
  });
  def('vm_bush_blossom', 'Blossom Bush', {
    size: [1, 1, 1], sway: 1, swayFrom: 0, sound: 'grass', hard: 0.4,
    build(b, M) {
      b.ellipsoid(8, 6.5, 8, 7.4, 5.8, 7.4, M.plant(PLANT.leaf1));
      const dots = [[3, 9, 5], [11, 10, 4], [6, 12, 10], [12, 7, 11], [4, 5, 12], [9, 4, 3], [13, 11, 8], [7, 9, 13]];
      dots.forEach(([x, y, z], i) => b.sphere(x, y, z, 1.4, M.matte(i % 3 === 0 ? PLANT.white : i % 3 === 1 ? PLANT.pink : PLANT.violet)));
    },
  });
  // a rice-terrace crop block: dark soil, then rows of green along x that read as stripes from afar
  def('vm_crop_rows', 'Rice Row Crop', {
    size: [1, 1, 1], sway: 1, swayFrom: 0, sound: 'grass', hard: 0.5,
    build(b, M) {
      b.box(0, 0, 0, 16, 4, 16, M.matte(PLANT.dirt));
      for (let r = 0; r < 4; r++) {
        const z0 = 1 + r * 4;
        b.box(0, 4, z0, 16, 8, z0 + 2, M.plant(PLANT.rice1));
        b.box(0, 8, z0, 16, 9, z0 + 2, M.plant(PLANT.rice2));
      }
    },
  });

  // registration after every older block (VR.BL.late runs in blocks4.js): each model's part sway is set once compiled
  VR.BL.late = VR.BL.late || [];
  VR.BL.late.push(() => {
    VM.registerLate(NAMES);
    for (const d of VM.DEFS) if (NAMES.includes(d.name) && VM.MODELS[d.name]) P.partSway(VM.MODELS[d.name], d.o);
  });

  // ---------------------------------------------------------------- placement helpers (every put takes a block state)
  // a model's parts, as (dx, dy, dz, state) for an origin: the generator places each part as one block
  P.parts = function (name, x0, y0, z0, facing) {
    const m = VM.MODELS[name]; if (!m) return [];
    const out = [];
    for (const p of m.parts) out.push([x0 + p.px, y0 + p.py, z0 + p.pz, VR.R.S(name, { part: 'p' + p.px + p.py + p.pz, facing: facing | 0 })]);
    return out;
  };
  // a palm: the ringed trunk of `h` blocks at (x, y, z) and the shared crown on its top (the crown spans 7×7 blocks)
  P.palm = function (put, x, y, z, h) {
    const R = VR.R;
    for (let k = 0; k < h; k++) put(x, y + k, z, R.S('vx_palm_trunk'));
    for (const [px, py, pz, s] of P.parts('vm_palm_crown', x - 3, y + h, z - 3, 0)) put(px, py, pz, s);
  };
  // the palm's footprint in blocks, for a lot's yard test: the crown's 7×7 (the trunk is one block)
  P.palmFoot = (x, z) => [x - 3, z - 3, x + 3, z + 3];
  P.on = (g) => !!(g && g.vgen >= 7);
})(VR);

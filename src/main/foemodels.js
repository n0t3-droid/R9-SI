// ============================================================================
// The foes' voxel models (a-foes; plan docs/superpowers/plans/2026-10-23-a-foes.md §2.2, spec abenteuer §5) — all our
// own designs, built with the voxel grid of voxmodels.js (1 voxel = 1/16 block, the models face −z) and added to
// VR.VOXMODELS (getVoxModel builds and caches them on first use):
//   foe_driller   Bohrläufer — a four-legged drill walker of the old beacon network: weathered white-orange plating,
//                 grey joints, a round optic, the drill in front; its disturbed core glows through the vents on its back
//   foe_sentry    Wächter — a two-legged sentry with a broad shield plate on a hinge; the core shows at its back
//   foe_crane     Kranarm — a crane turret on the outpost's tower: a turning base with the core in its joint, a boom, a
//                 claw with the optic
//   foe_drone     Schattendrohne — a small white shell with one eye and a dark ring; the smoke round it is particles
//   foe_wisp      Schattenwesen — a shapeless dark shadow with two soft eyes; the mist is particles (never an animal,
//                 never a person)
//   foe_plate · foe_gear · foe_shard · foe_bolt · foe_pile — what a machine sheds when it powers down, the slow glowing
//                 bolt, the little pile of Taler left behind on Schwer
// Parts that change colour are parts of their own, white and emissive: the optic and the core are tinted at draw time
// (red-violet when disturbed, the telegraph's flare brighter, green when calmed, cyan in a Helfer's core).
// ============================================================================
(function (VR) {
  'use strict';
  const M = VR.VOXMODELS, Grid = VR.VoxGrid;
  if (!M || !Grid) return;
  const part = (sx, sy, sz, pivot, build) => { const g = new Grid(sx, sy, sz, pivot[0], pivot[1], pivot[2]); build(g); return { grid: g, pivot: [0, 0, 0] }; };
  // the palette: weathered white and orange plating, grey joints, rust; the optic and the core are white (tinted)
  const WH = 0xe6dfd2, WH2 = 0xd4cbbb, OR = 0xe2702c, OR2 = 0xb4521c, GR = 0x5b616a, GR2 = 0x3a3f47, DK = 0x24272d, RU = 0x95603c, LENS = 0xf6f2ff;
  const weather = (base, x, y, z) => { const h = ((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) >>> 0; return h % 23 === 0 ? RU : h % 7 === 0 ? WH2 : base; };

  // ---------------------------------------------------------------- Bohrläufer
  M.foe_driller = () => ({
    h: 1.15, w: 0.55, gait: 'quad', parts: {
      body: part(14, 10, 20, [7, 4, 10], (g) => {
        g.ell(7, 5, 10, 6.6, 4.6, 9.6, (x, y, z) => (y <= 2 ? GR2 : y === 4 && (z & 3) !== 0 ? OR : y < 4 ? OR2 : weather(WH, x, y, z)), { shade: 0.08 });
        // vents on the back (the core shows through them) and a dark seam round the hull
        for (let x = 4; x <= 9; x++) for (let z = 13; z <= 17; z++) if ((x & 1) === 0) g.set(x, 9, z, DK);
        g.box(5, 8, 1, 8, 9, 2, GR);   // the optic's brow
      }),
      drill: part(7, 7, 11, [3, 3, 10], (g) => {
        for (let z = 0; z <= 10; z++) { const r = 0.6 + z * 0.28; for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) { const d = Math.hypot(x - 3, y - 3); if (d <= r) g.set(x, y, z, ((z + Math.round(Math.atan2(y - 3, x - 3) * 1.6)) & 1) ? 0x9aa1aa : 0x6b727b); } }
      }),
      optic: part(5, 5, 2, [2, 2, 1], (g) => { g.ell(2, 2, 1, 2.4, 2.4, 1.2, DK); g.ell(2, 2, 0.5, 1.7, 1.7, 0.8, LENS, { emis: 1 }); }),
      core: part(6, 3, 6, [3, 1, 3], (g) => { g.ell(3, 1, 3, 2.6, 1.3, 2.6, LENS, { emis: 1 }); }),
      leg_fl: part(3, 9, 3, [1, 8, 1], (g) => { g.box(0, 5, 0, 2, 8, 2, GR); g.box(0, 1, 0, 2, 4, 2, (x, y, z) => (y === 3 ? OR : WH)); g.box(0, 0, 0, 2, 0, 2, DK); }),
      leg_fr: part(3, 9, 3, [1, 8, 1], (g) => { g.box(0, 5, 0, 2, 8, 2, GR); g.box(0, 1, 0, 2, 4, 2, (x, y, z) => (y === 3 ? OR : WH)); g.box(0, 0, 0, 2, 0, 2, DK); }),
      leg_bl: part(3, 9, 3, [1, 8, 1], (g) => { g.box(0, 5, 0, 2, 8, 2, GR); g.box(0, 1, 0, 2, 4, 2, (x, y, z) => (y === 3 ? OR : WH)); g.box(0, 0, 0, 2, 0, 2, DK); }),
      leg_br: part(3, 9, 3, [1, 8, 1], (g) => { g.box(0, 5, 0, 2, 8, 2, GR); g.box(0, 1, 0, 2, 4, 2, (x, y, z) => (y === 3 ? OR : WH)); g.box(0, 0, 0, 2, 0, 2, DK); }),
    },
    layout: { body: [0, 9, 0], drill: [0, 9, -10], optic: [0, 13, -9], core: [0, 13.5, 6], leg_fl: [-6, 9, -6], leg_fr: [6, 9, -6], leg_bl: [-6, 9, 6], leg_br: [6, 9, 6] },
  });

  // ---------------------------------------------------------------- Wächter
  M.foe_sentry = () => ({
    h: 1.9, w: 0.45, gait: 'biped', parts: {
      leg_l: part(4, 13, 5, [2, 12, 2], (g) => { g.box(0, 7, 0, 3, 12, 3, GR); g.box(0, 1, 0, 3, 6, 3, (x, y, z) => (y === 5 ? OR : weather(WH, x, y, z))); g.box(0, 0, -1, 3, 0, 4, DK); }),
      leg_r: part(4, 13, 5, [2, 12, 2], (g) => { g.box(0, 7, 0, 3, 12, 3, GR); g.box(0, 1, 0, 3, 6, 3, (x, y, z) => (y === 5 ? OR : weather(WH, x, y, z))); g.box(0, 0, -1, 3, 0, 4, DK); }),
      body: part(13, 13, 9, [6, 0, 4], (g) => {
        g.box(1, 0, 1, 11, 2, 7, GR2);
        g.ell(6, 7, 4, 6.2, 6.4, 4.2, (x, y, z) => (y === 9 ? OR : y < 4 ? OR2 : weather(WH, x, y, z)), { shade: 0.08 });
        for (let x = 3; x <= 9; x += 2) for (let y = 4; y <= 9; y++) g.set(x, y, 8, DK);   // the back's vents
      }),
      head: part(8, 7, 8, [4, 0, 4], (g) => { g.ell(4, 3, 4, 3.8, 3.4, 3.8, (x, y, z) => (y >= 5 ? OR : weather(WH, x, y, z)), { shade: 0.06 }); g.box(1, 2, 0, 6, 4, 0, DK); }),
      optic: part(3, 3, 1, [1, 1, 0], (g) => { g.box(0, 0, 0, 2, 2, 0, LENS, { emis: 1 }); }),
      core: part(5, 5, 2, [2, 2, 0], (g) => { g.ell(2, 2, 0.5, 2.3, 2.3, 1, LENS, { emis: 1 }); }),
      arm: part(3, 10, 3, [1, 9, 1], (g) => { g.box(0, 0, 0, 2, 9, 2, GR); g.box(0, 3, 0, 2, 4, 2, OR); }),
      shield: part(14, 17, 2, [13, 8, 1], (g) => {
        g.box(0, 0, 0, 13, 16, 1, (x, y, z) => { const edge = x === 0 || x === 13 || y === 0 || y === 16; return edge ? GR : (y === 8 || x === 6 || x === 7) ? OR : weather(WH, x, y, z); }, { shade: 0.05 });
      }),
    },
    layout: { leg_l: [-3, 13, 0], leg_r: [3, 13, 0], body: [0, 13, 0], head: [0, 26, -1], optic: [0, 29, -5], core: [0, 20, 4.5], arm: [-7, 24, -2], shield: [6, 18, -7] },
  });

  // ---------------------------------------------------------------- Kranarm
  M.foe_crane = () => ({
    h: 1.4, w: 0.6, gait: 'turret', parts: {
      base: part(14, 8, 14, [7, 0, 7], (g) => {
        g.box(0, 0, 0, 13, 2, 13, (x, y, z) => ((x + z) % 6 === 0 ? OR : GR2));
        g.ell(7, 5, 7, 5.6, 3.4, 5.6, (x, y, z) => (y === 5 ? OR : weather(WH, x, y, z)), { shade: 0.07 });
      }),
      core: part(8, 3, 8, [4, 1, 4], (g) => { for (let x = 0; x < 8; x++) for (let z = 0; z < 8; z++) { const d = Math.hypot(x - 3.5, z - 3.5); if (d >= 2.4 && d <= 3.8) g.set(x, 1, z, LENS, 1); } }),
      arm: part(5, 5, 24, [2, 2, 22], (g) => {
        g.box(0, 0, 0, 4, 4, 22, (x, y, z) => (z % 5 === 0 ? GR2 : (y === 4 ? OR : weather(WH, x, y, z))));
        for (let z = 2; z < 22; z += 5) g.box(1, 1, z, 3, 3, z + 2, DK);   // the lattice's openings
      }),
      head: part(9, 8, 8, [4, 6, 4], (g) => {
        g.box(1, 3, 1, 7, 7, 7, (x, y, z) => (y === 7 ? OR : weather(WH, x, y, z)));
        g.box(0, 0, 2, 1, 3, 5, GR); g.box(7, 0, 2, 8, 3, 5, GR);   // the claw's two fingers
      }),
      optic: part(4, 4, 1, [2, 2, 0], (g) => { g.ell(1.5, 1.5, 0.5, 1.9, 1.9, 0.9, LENS, { emis: 1 }); }),
    },
    layout: { base: [0, 0, 0], core: [0, 8, 0], arm: [0, 10, 0], head: [0, 9, -22], optic: [0, 12, -26.5] },
  });

  // ---------------------------------------------------------------- Schattendrohne
  M.foe_drone = () => ({
    h: 0.6, w: 0.35, gait: 'hover', fly: true, parts: {
      shell: part(11, 8, 11, [5, 4, 5], (g) => {
        g.ell(5, 4, 5, 5.2, 3.8, 5.2, (x, y, z) => (y === 4 ? 0x9ea4b0 : y < 3 ? 0xc9ccd6 : 0xf2f3f7), { shade: 0.05 });
        for (let x = 3; x <= 7; x++) g.set(x, 7, 5, 0x7a6a9a);   // a violet seam on top
      }),
      optic: part(4, 4, 1, [2, 2, 0], (g) => { g.ell(1.5, 1.5, 0.5, 1.9, 1.9, 0.9, LENS, { emis: 1 }); }),
      ring: part(15, 1, 15, [7, 0, 7], (g) => { for (let x = 0; x < 15; x++) for (let z = 0; z < 15; z++) { const d = Math.hypot(x - 7, z - 7); if (d >= 6.2 && d <= 7.2 && ((Math.atan2(z - 7, x - 7) * 4 / Math.PI + 8) % 2) < 1.4) g.set(x, 0, z, 0x2a1f44); } }),
    },
    layout: { shell: [0, 4, 0], optic: [0, 4.5, -5.6], ring: [0, 4, 0] },
  });

  // ---------------------------------------------------------------- Schattenwesen
  M.foe_wisp = () => ({
    h: 1.2, w: 0.4, gait: 'float', fly: true, parts: {
      body: part(12, 18, 10, [6, 0, 5], (g) => {
        // a soft, shapeless shadow: a tall blob that thins out at its foot (the mist round it is particles)
        for (let y = 0; y < 18; y++) for (let z = 0; z < 10; z++) for (let x = 0; x < 12; x++) {
          const t = y / 17, rx = 2.2 + 3.6 * Math.sin(Math.PI * Math.min(1, t * 1.15)), rz = rx * 0.75;
          const d = ((x - 5.5) / rx) ** 2 + ((z - 4.5) / rz) ** 2, n = ((x * 7 + y * 13 + z * 5) % 9) / 9;
          if (d <= 1 - n * 0.25 && !(y < 5 && ((x + z + y) % 3 === 0))) g.set(x, y, z, y > 13 ? 0x1c1838 : 0x110e24);
        }
      }),
      optic: part(9, 3, 1, [4, 1, 0], (g) => { g.ell(1.5, 1, 0.5, 1.6, 1.3, 0.8, 0xe8fbff, { emis: 1 }); g.ell(7, 1, 0.5, 1.6, 1.3, 0.8, 0xe8fbff, { emis: 1 }); }),
    },
    layout: { body: [0, 0, 0], optic: [0, 13, -4.6] },
  });

  // ---------------------------------------------------------------- what is shed, the bolt, the Taler
  M.foe_plate = () => ({ parts: { p: part(6, 1, 5, [3, 0, 2], (g) => { g.box(0, 0, 0, 5, 0, 4, (x, y, z) => (z === 2 ? OR : weather(WH, x, y, z))); }) }, layout: { p: [0, 0, 0] } });
  M.foe_gear = () => ({ parts: { p: part(7, 2, 7, [3, 1, 3], (g) => { for (let x = 0; x < 7; x++) for (let z = 0; z < 7; z++) { const d = Math.hypot(x - 3, z - 3), a = Math.atan2(z - 3, x - 3); if (d >= 1.2 && (d <= 2.6 || (d <= 3.4 && (Math.round(a * 8 / Math.PI) & 1)))) g.box(x, 0, z, x, 1, z, d > 2.6 ? GR : 0x8a9099); } }) }, layout: { p: [0, 0, 0] } });
  M.foe_shard = () => ({ parts: { p: part(4, 2, 3, [2, 1, 1], (g) => { g.box(0, 0, 0, 3, 1, 2, (x, y, z) => (x === 3 && y === 1 && z === 2 ? null : (x + z) % 3 === 0 ? 0xc9ccd6 : 0xf2f3f7)); }) }, layout: { p: [0, 0, 0] } });
  M.foe_bolt = () => ({ parts: { p: part(5, 5, 5, [2, 2, 2], (g) => { g.ell(2, 2, 2, 2.5, 2.5, 2.5, LENS, { emis: 1 }); }) }, layout: { p: [0, 0, 0] } });
  M.foe_pile = () => ({
    parts: { p: part(7, 4, 7, [3, 0, 3], (g) => { for (let y = 0; y < 4; y++) for (let x = 0; x < 7; x++) for (let z = 0; z < 7; z++) { const d = Math.hypot(x - 3, z - 3); if (d <= 3.2 - y * 0.8) g.set(x, y, z, (x + z + y) % 3 === 0 ? 0xffe9a0 : 0xf5bf3a, 1); } }) },
    layout: { p: [0, 0, 0] },
  });
  VR.FoeModels = { KINDS: ['foe_driller', 'foe_sentry', 'foe_crane', 'foe_drone', 'foe_wisp'], BITS: ['foe_plate', 'foe_gear', 'foe_shard', 'foe_bolt', 'foe_pile'] };
})(VR);

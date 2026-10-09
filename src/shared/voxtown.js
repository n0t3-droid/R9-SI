// ============================================================================
// The Weißstadt kit (the hall city, gen_hallcity.js; the owner's reference pictures in docs/refs/weissstadt — design
// references only, nothing copied): the pieces no older block serves, as VM models (voxmodel.js, VX16) and one VX
// block, all registered LATE (VR.BL.late, after the Nova pieces) so every older block keeps its state ids. Their block
// colours are colours that have a texture already (no new texture name: test/mesh_same.js keeps its streams).
//  · vm_town_window_{blue,gold,rose} — a wall cell three blocks high of white stone with a round-headed opening:
//    clear glass below a wood transom and mullion, stained glass in the head (rays and a ring, gold lead lines).
//  · vm_town_lamp — the street lamp of the pictures: a black iron base, a slim pole with rings, a four-sided glass
//    lantern head with a warm flame, a pointed cap; four blocks tall, the head glows.
//  · vm_town_awning_{amber,teal} — a striped fabric awning three blocks wide that leans out two blocks from the wall,
//    a scalloped valance, iron rods.
//  · vm_town_sign_{bread,cup,flower,book} — a dark green board in a gold frame with a gold pictogram (no words: the
//    shop's own name is the game's text, I18N), on two iron brackets against the wall.
//  · vm_town_stall_{amber,teal} — a market stall: a wooden counter with crates of produce, posts, a back shelf with
//    jars, a striped canopy with a scalloped edge.
//  · vm_town_fountain — three stone tiers on a column, water in every bowl and falling from rim to rim, a jet on top
//    (it stands in a round basin the generator lays out of blocks).
//  · vx_town_band — the gold trim band: a block of white stone with a gold course along its sides.
// No crystals (the owner: "ich mag die nicht, ob groß oder klein"): where the pictures have crystals the town has
// lanterns, gold and glass.
// Front = −z (facing 0): the street side of a window, an awning, a sign; the wall is at +z.
// ============================================================================
(function (VR) {
  'use strict';
  const VM = VR.VM, VX = VR.VX;
  if (!VM || !VX || !VX._ || !VR.BL) return;
  const T = VR.Town = VR.Town || {};
  const NAMES = T.NAMES = [];
  const COL = T.COL = {
    stone: 0xF2EEE6, stoneD: 0xE2DACB, stoneL: 0xFAF8F2, gold: 0xD8B048, goldL: 0xF0D27A, goldD: 0xB08A3A,
    iron: 0x22262C, ironL: 0x3A3F48, wood: 0x8A5E36, woodL: 0xB08A5A, woodD: 0x5A3F2A,
    glass: 0xD6ECF4, warm: 0xFFE8C0, flame: 0xFFD27A, water: 0x8AD8FF, waterL: 0xC8F0FF,
    green: 0x2E5843, greenD: 0x1F3E30, cream: 0xF2E8D2, amber: 0xC8744A, teal: 0x2F8C8A, white: 0xF4F2EC,
  };
  // the stained glass of the window heads: [ray A, ray B, the ring]
  const STAIN = T.STAIN = { blue: [0x3F6AC0, 0x8AB4E8, 0xE8B83A], gold: [0xE0A83A, 0xF4D27A, 0x3F6AC0], rose: [0xC0485A, 0xF08FA0, 0xE8B83A] };
  // (the block colour of every piece is one with a texture already: f2eee6, 22262c, e8d8b0, 2f8c8a, 2e5843, b08a5a, d8b048)
  const def = (name, display, o) => { VM.define(name, display, Object.assign({ res: 16, sound: 'stone', hard: 1, cat: 'arch', cats: ['arch'] }, o, { late: true, lazy: true })); NAMES.push(name); return name; };

  // ---------------------------------------------------------------- the arched window with a stained-glass head (1 × 3 × 1)
  // the opening x 3 … 13, from 4 up to the head's springing at 36, a half circle of radius 5 over it (top 41); the
  // glass in the wall's middle plane (z 7 … 9), reveals on both sides, a stone sill outside
  T.WIN = { x0: 3, x1: 13, y0: 4, spring: 36, r: 5, transom: 28 };
  for (const key of ['blue', 'gold', 'rose']) {
    const [ca, cb, ring] = STAIN[key];
    def('vm_town_window_' + key, 'Arched Window · Stained Glass · ' + key[0].toUpperCase() + key.slice(1), {
      size: [1, 3, 1], col: 0xF2EEE6, sound: 'glass', hard: 1,
      build(b, M) {
        const W = T.WIN, stone = M.stone(COL.stone), sill = M.stone(COL.stoneD), lead = M.metal(COL.goldD), frame = M.wood(COL.woodD);
        const glass = M.glass(COL.glass), A = M.light(ca), B = M.light(cb), R = M.light(ring);
        b.box(0, 0, 0, 16, 48, 16, stone);
        b.cut(W.x0, W.y0, 0, W.x1, W.spring, 16); b.cyl('z', 8, W.spring, W.r, 0, 16, 0);
        b.box(W.x0 - 1, W.y0 - 1.5, 0, W.x1 + 1, W.y0, 3, sill);                                   // the sill, outside
        b.box(W.x0, W.y0, 7, W.x1, W.spring, 9, glass); b.cyl('z', 8, W.spring, W.r, 7, 9, glass);  // the glass
        // the head: rays from the centre of the half circle, alternating colours, a ring of the third colour, gold lead
        for (let y = W.transom; y < W.spring + W.r + 1; y++) for (let x = W.x0; x < W.x1; x++) {
          const dx = x + 0.5 - 8, dy = y + 0.5 - W.spring, d = Math.hypot(dx, dy);
          if (dy > 0 && d > W.r) continue;
          let m;
          if (dy <= 0) m = (((x - W.x0) >> 1) & 1) ? A : B;                                         // the band under the springing: stripes
          else { const a = Math.atan2(dy, dx), k = Math.floor(a / (Math.PI / 5)); m = d < 1.8 ? R : d > W.r - 1.2 ? R : (k & 1) ? A : B; }
          for (let z = 7; z < 9; z++) b.set(x, y, z, m);
        }
        b.box(W.x0, W.transom - 1, 6.5, W.x1, W.transom, 9.5, frame);                              // the transom
        b.box(7.5, W.y0, 6.5, 8.5, W.spring + W.r, 9.5, lead);                                      // the mullion (gold lead up the head)
        b.box(W.x0, W.spring, 6.5, W.x1, W.spring + 0.6, 9.5, lead);                                // the springing line
      },
    });
  }

  // ---------------------------------------------------------------- the street lamp (1 × 4 × 1): the head is the top block
  def('vm_town_lamp', 'Town Lamp', {
    size: [1, 4, 1], col: 0x22262C, sound: 'metal', hard: 1.5, light: (p) => (p.part === 3 ? [14, 11, 7] : null),
    build(b, M) {
      const ir = M.metal(COL.iron), irL = M.metal(COL.ironL), glass = M.glass(COL.warm), flame = M.light(COL.flame);
      b.pbox(4, 0, 4, 12, 1.5, 12, 1, ir); b.pbox(5, 1.5, 5, 11, 5, 11, 1, ir); b.lathe(8, 8, [[5, 3], [8, 1.6]], ir);   // the foot
      b.cyl('y', 8, 8, 1.15, 8, 50, ir);                                                                                   // the pole
      for (const y of [14, 30, 44]) b.cyl('y', 8, 8, 1.7, y, y + 1, irL);                                                   // rings
      b.lathe(8, 8, [[48, 1.2], [51, 3.2], [52, 3.6]], ir);                                                                 // the collar
      b.box(4, 52, 4, 12, 53, 12, ir);                                                                                      // the head's floor
      b.box(4.6, 53, 4.6, 11.4, 60, 11.4, glass);                                                                           // the glass
      for (const [x, z] of [[4, 4], [11, 4], [4, 11], [11, 11]]) b.box(x, 53, z, x + 1, 60, z + 1, ir);                     // the corner posts
      b.sphere(8, 56, 8, 1.6, flame);
      for (let k = 0; k < 3; k++) b.box(3.5 + k, 60 + k, 3.5 + k, 12.5 - k, 61 + k, 12.5 - k, ir);                         // the cap
      b.cyl('y', 8, 8, 0.7, 63, 64, irL);
    },
  });

  // ---------------------------------------------------------------- the striped awning (3 × 1 × 2): the wall at +z
  for (const [key, c1, c2, bc] of [['amber', COL.cream, COL.amber, 0xE8D8B0], ['teal', COL.white, COL.teal, 0x2F8C8A]]) {
    def('vm_town_awning_' + key, 'Striped Awning · ' + key[0].toUpperCase() + key.slice(1), {
      size: [3, 1, 2], col: bc, sound: 'wool', hard: 0.4,
      build(b, M) {
        const A = M.fabric(c1), B = M.fabric(c2), ir = M.metal(COL.iron);
        const stripe = (x) => (Math.floor(x / 6) & 1) ? B : A;
        for (let z = 2; z < 32; z++) { const y = Math.round(6 + 9 * (z - 2) / 29); for (let x = 0; x < 48; x++) { b.set(x, y, z, stripe(x)); b.set(x, y + 1, z, stripe(x)); } }
        for (let x = 0; x < 48; x++) {                                                                     // the scalloped valance
          const s = x % 8, depth = 2 + Math.round(2 * Math.sin(Math.PI * (s + 0.5) / 8));
          for (let y = 7 - depth; y < 7; y++) for (let z = 1; z < 3; z++) b.set(x, y, z, stripe(x));
        }
        b.box(0, 15, 30, 48, 16, 32, ir);                                                                  // the wall plate
        for (const x of [4, 44]) b.rod(x, 1, 31, x, 5, 4, 0.5, ir);                                      // the struts under it
      },
    });
  }

  // ---------------------------------------------------------------- the shop sign (2 × 1 × 1): a board against the wall
  const ICON = T.ICON = {
    bread: ['..XXXXX..', '.X.X.X.X.', 'XXXXXXXXX', 'XXXXXXXXX', '.XXXXXXX.'],
    cup: ['.X.X.....', '..X.X....', 'XXXXXXX..', 'XXXXXX.X.', 'XXXXXXX..', '.XXXXX...', 'XXXXXXX..'],
    flower: ['...X...', '.XX.XX.', '..XXX..', '.XX.XX.', '...X...', '...X.X.', '...XX..'],
    book: ['XXX.XXX', 'X.X.X.X', 'X.X.X.X', 'X.X.X.X', 'XXXXXXX'],
  };
  for (const key of Object.keys(ICON)) {
    def('vm_town_sign_' + key, 'Shop Sign · ' + key[0].toUpperCase() + key.slice(1), {
      size: [2, 1, 1], col: 0x2E5843, sound: 'wood', hard: 0.6,
      build(b, M) {
        const board = M.gloss(COL.green), edge = M.gloss(COL.greenD), gold = M.metal(COL.gold), goldL = M.metal(COL.goldL), ir = M.metal(COL.iron);
        b.box(1, 3, 12.5, 31, 13, 15, board);                                         // the board
        b.box(1, 3, 12, 31, 3.8, 15, gold); b.box(1, 12.2, 12, 31, 13, 15, gold);   // the gold frame
        b.box(1, 3, 12, 1.8, 13, 15, gold); b.box(30.2, 3, 12, 31, 13, 15, gold);
        b.box(2.4, 4.4, 12.2, 29.6, 11.6, 12.5, edge);                               // a dark inner field
        const rows = ICON[key], h = rows.length, w = rows[0].length, x0 = 16 - w / 2, y0 = 8 + h / 2;
        for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) if (rows[r][c] === 'X') b.box(x0 + c, y0 - r - 1, 11, x0 + c + 1, y0 - r, 12, goldL);
        for (const x of [5, 25]) { b.sphere(x, 8, 11.9, 0.9, gold); b.box(x - 3, 7.6, 11, x + 3, 8.4, 12, gold); }   // ornaments
        for (const x of [6, 26]) b.box(x - 0.5, 13, 14, x + 0.5, 15.5, 16, ir);       // the brackets
      },
    });
  }

  // ---------------------------------------------------------------- the market stall (3 × 3 × 2): the counter at the front (−z)
  const PRODUCE = [0xD8402E, 0x6AB04A, 0xF09A2A, 0xF0D040, 0x8A4AA8, 0xE86A8A];
  for (const [key, c1, c2, bc] of [['amber', COL.cream, COL.amber, 0xB08A5A], ['teal', COL.white, COL.teal, 0x2F8C8A]]) {
    def('vm_town_stall_' + key, 'Market Stall · ' + key[0].toUpperCase() + key.slice(1), {
      size: [3, 3, 2], col: bc, sound: 'wood', hard: 1,
      build(b, M) {
        const wood = M.wood(COL.wood), woodL = M.wood(COL.woodL), woodD = M.wood(COL.woodD), A = M.fabric(c1), B = M.fabric(c2);
        b.box(1, 0, 1, 47, 13, 15, wood); b.box(0, 13, 0, 48, 15, 16, woodL);                         // the counter and its top
        for (let x = 3; x < 46; x += 6) b.box(x, 1, 0.6, x + 1, 12, 1, woodD);                         // its planks
        for (let k = 0; k < 4; k++) {                                                                   // crates of produce
          const x0 = 3 + k * 11; b.box(x0, 15, 3, x0 + 9, 19, 13, woodD);
          const c = M.matte(PRODUCE[(k * 2 + (key === 'teal' ? 1 : 0)) % PRODUCE.length]);
          for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) b.sphere(x0 + 1.5 + i * 1.3, 19.4, 4.5 + j * 3, 1.3, c);
        }
        for (const x of [1, 45]) { b.box(x, 0, 1, x + 2, 40, 3, woodD); b.box(x, 0, 28, x + 2, 44, 30, woodD); }   // the posts
        b.box(1, 22, 26, 47, 23.5, 30, woodL); b.box(18, 0, 18, 30, 12, 30, wood);                     // the back shelf and a crate
        for (let k = 0; k < 8; k++) b.cyl('y', 5 + k * 5.4, 28, 1.6, 23.5, 27, M.glass([0xE8B83A, 0xD8402E, 0x6AB04A][k % 3]));   // jars
        const stripe = (x) => (Math.floor(x / 6) & 1) ? B : A;
        for (let z = 0; z < 32; z++) { const y = Math.round(36 + 8 * z / 31); for (let x = 0; x < 48; x++) b.set(x, y, z, stripe(x)); }
        for (let x = 0; x < 48; x++) { const s = x % 8, depth = 1 + Math.round(2 * Math.sin(Math.PI * (s + 0.5) / 8)); for (let y = 36 - depth; y < 36; y++) b.set(x, y, 0, stripe(x)); }
      },
    });
  }

  // ---------------------------------------------------------------- the fountain (3 × 4 × 3): three tiers in the middle of a basin
  // (the top two layers hold the column, the upper bowl and the jet in the middle block only)
  const skip = []; for (const y of [2, 3]) for (let x = 0; x < 3; x++) for (let z = 0; z < 3; z++) if (x !== 1 || z !== 1) skip.push([x, y, z]);
  def('vm_town_fountain', 'Town Fountain', {
    size: [3, 4, 3], col: 0xF2EEE6, sound: 'stone', hard: 2, skip,
    build(b, M) {
      const st = M.stone(COL.stone), stD = M.stone(COL.stoneD), w = M.glass(COL.water), wl = M.glass(COL.waterL);
      b.lathe(24, 24, [[0, 9], [2, 7], [5, 5], [7, 21], [11, 22], [12, 22]], st, 0);                 // the lower bowl
      b.lathe(24, 24, [[8, 20.5], [11, 20.5]], 0); b.cyl('y', 24, 24, 20.5, 8, 10, w);               // its water
      b.cyl('y', 24, 24, 3, 9, 30, stD); b.lathe(24, 24, [[18, 3.2], [20, 4.4], [21, 3.2]], st);      // the column, a ring
      b.lathe(24, 24, [[24, 4], [27, 13], [30, 14], [31, 14]], st); b.lathe(24, 24, [[28, 12.5], [31, 12.5]], 0); b.cyl('y', 24, 24, 12.5, 28, 29, w);   // the middle bowl
      b.tube('y', 24, 24, 14.3, 0.5, 11, 28, wl);                                                     // its water falling into the lower bowl
      b.cyl('y', 24, 24, 2.2, 29, 44, stD);
      b.lathe(24, 24, [[39, 3], [42, 7], [44, 7.5]], st); b.cyl('y', 24, 24, 6, 43, 44, w);           // the upper bowl
      b.tube('y', 24, 24, 7.8, 0.4, 30, 43, wl);
      b.sphere(24, 46, 24, 2.2, st); b.cyl('y', 24, 24, 0.8, 47, 58, wl); b.sphere(24, 58, 24, 1.6, wl);   // the finial and the jet
    },
  });

  // ---------------------------------------------------------------- the gold band (VX 16³, a full block)
  T.bandCol = { stone: COL.stone, joint: COL.stoneD, gold: COL.gold, goldL: COL.goldL };
  VX._.PAINT_FN.townband = function (s, c) {
    const G = VX.gridFor(16), I16 = VX.I16, B = T.bandCol, pack = (col, f) => ((col & 0xffffff) | VX.PRESENT | (f || 0)) >>> 0;
    for (let y = 0; y < 16; y++) for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const out = x === 0 || x === 15 || z === 0 || z === 15;
      const col = y === 15 || y === 0 ? B.joint : out && (y === 7 || y === 8) ? (y === 8 ? B.goldL : B.gold) : out && (y === 6 || y === 9) ? B.joint : B.stone;
      G[I16(x, y, z)] = pack(col, out && (y === 7 || y === 8) ? VX.GLOSS : 0);
    }
  };
  VX.KIND.townband = { cls: VX.CLS.WALL, opaque: true };
  VX.boxHook.townband = () => [[0, 0, 0, 1, 1, 1]];

  // ---------------------------------------------------------------- registration: after every older block
  VR.BL.late = VR.BL.late || [];
  VR.BL.late.push(() => {
    const K = VM._K; if (!K) return;
    VM.registerLate(NAMES);
    const G_ = K.G;
    // (the colour is vx_town's stone, f2eee6: its texture name exists already)
    K.add('vx_town_band', 'Gold Band · White Stone', { kind: 'townband', res: 16, col: 0xF2EEE6 }, { filter: 15, opaque: true, sound: 'stone', hard: 2, group: G_.ARCH || G_.BUILD, cat: 'arch' });
  });
})(VR);

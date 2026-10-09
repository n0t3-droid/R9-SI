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

  // ---------------------------------------------------------------- round 2 (t-town2): the arched window of the references
  // vm_town_arch3 — three wide, three high, one deep (a wall cell): a round-headed opening in white stone with a lighter
  // archivolt ring and a keystone, a wood-brown frame with a mullion, a transom and two glazing bars in the head, warm
  // glass deep in the reveal, a stone sill. The block colour is the town window's (its texture exists).
  // (registered after the gold band — a second late call below — so every piece of round 1 keeps its id)
  const NAMES2 = T.NAMES2 = [];
  const def2 = (name, display, o) => { VM.define(name, display, Object.assign({ res: 16, sound: 'stone', hard: 1, cat: 'arch', cats: ['arch'] }, o, { late: true, lazy: true })); NAMES2.push(name); return name; };
  T.ARCH = { x0: 9, x1: 39, y0: 5, spring: 29, r: 15, z0: 6 };
  def2('vm_town_arch3', 'Arched Window · Wood · Three Wide', {
    size: [3, 3, 1], col: 0xF2EEE6, sound: 'glass', hard: 1,
    build(b, M) {
      const A = T.ARCH, cx = 24, stone = M.stone(COL.stone), ring = M.stone(COL.stoneL), key = M.stone(COL.stoneD), sill = M.stone(COL.stoneD);
      const wood = M.wood(COL.woodD), woodL = M.wood(COL.wood), glass = M.glass(COL.warm);
      b.box(0, 0, 0, 48, 48, 16, stone);
      // the archivolt: a lighter ring round the head, proud of the wall by one voxel inside the cell (the wall face recessed)
      b.cut(0, 0, 0, 48, 48, 1);
      b.cyl('z', cx, A.spring, A.r + 3, 0, 1, ring); b.cut(0, 0, 0, 48, A.spring, 1);
      b.box(cx - 3, A.spring + A.r - 1, 0, cx + 3, 48, 1, key); b.box(cx - 2.5, A.spring + A.r - 1, 0.3, cx + 2.5, 47.5, 0.6, key);   // the keystone
      // the opening and its reveal (a rectangle under the springing, the half circle over it)
      b.cut(A.x0, A.y0, 0, A.x1, A.spring, 16); b.cyl('z', cx, A.spring, A.r, 0, 16, 0);
      // the frame in the reveal: jambs, the head's rim, a mullion, a transom, the head's two bars
      const zf0 = A.z0, zf1 = A.z0 + 3;
      b.box(A.x0, A.y0, zf0, A.x0 + 1.5, A.spring, zf1, wood); b.box(A.x1 - 1.5, A.y0, zf0, A.x1, A.spring, zf1, wood);
      b.tube('z', cx, A.spring, A.r, 1.5, zf0, zf1, wood);
      b.box(A.x0, A.y0, zf0, A.x1, A.y0 + 1.5, zf1, wood);
      b.box(cx - 0.75, A.y0, zf0, cx + 0.75, A.spring + A.r, zf1, woodL);
      b.box(A.x0, A.spring - 1, zf0, A.x1, A.spring + 0.5, zf1, wood);
      b.box(A.x0, 17, zf0 + 0.5, A.x1, 18, zf1 - 0.5, woodL);
      for (const s of [-1, 1]) b.rod(cx, A.spring, zf0 + 1.5, cx + s * A.r * 0.72, A.spring + A.r * 0.69, zf0 + 1.5, 0.45, woodL);
      // the warm glass, the sill (a ledge on the outer face under the opening)
      b.box(A.x0 + 1.5, A.y0 + 1.5, zf0 + 1.2, A.x1 - 1.5, A.spring - 1, zf0 + 1.8, glass); b.cyl('z', cx, A.spring, A.r - 1.5, zf0 + 1.2, zf0 + 1.8, glass);
      b.box(A.x0 - 2, A.y0 - 2.5, 0, A.x1 + 2, A.y0, 6, sill); b.box(A.x0 - 1, A.y0 - 3.5, 0, A.x1 + 1, A.y0 - 2.5, 3, sill);
    },
  });

  // ---------------------------------------------------------------- round 2: the shop signs with words
  // vm_town_word_<key> — a dark green board four blocks wide in a gold frame with the shop's word in raised gold letters
  // of our own 3 × 5 pixel font (umlauts and é too). The word is the language's (src/main/lang_de.js / lang_en.js,
  // town.sign.<key>): the main thread reads it through VR.I18N; a worker gets the table with the world's init message
  // (T.setWords) — without one it follows the browser's language. The block is the same in every language (a saved
  // world and a multiplayer guest keep their blocks); only its look follows the table.
  const WORD_DEF = T.WORD_DEF = {
    baker: ['Bäckerei', 'Bakery'], sweets: ['Konditorei', 'Sweets'], tea: ['Teestube', 'Tea Room'], cheese: ['Käse', 'Cheese'],
    flowers: ['Blumen', 'Flowers'], tailor: ['Schneider', 'Tailor'], pharmacy: ['Apotheke', 'Pharmacy'], lanterns: ['Laternen', 'Lanterns'],
    books: ['Buchladen', 'Books'], workshop: ['Werkstatt', 'Workshop'], maps: ['Karten', 'Maps'], cafe: ['Café', 'Café'],
  };
  T.WORDS = Object.keys(WORD_DEF);
  // the font: rows top to bottom; a glyph of 7 rows carries its umlaut or accent over the line
  const FONT = T.FONT = {
    A: ['.X.', 'X.X', 'XXX', 'X.X', 'X.X'], B: ['XX.', 'X.X', 'XX.', 'X.X', 'XX.'], C: ['.XX', 'X..', 'X..', 'X..', '.XX'], D: ['XX.', 'X.X', 'X.X', 'X.X', 'XX.'],
    E: ['XXX', 'X..', 'XX.', 'X..', 'XXX'], F: ['XXX', 'X..', 'XX.', 'X..', 'X..'], G: ['.XX', 'X..', 'X.X', 'X.X', '.XX'], H: ['X.X', 'X.X', 'XXX', 'X.X', 'X.X'],
    I: ['XXX', '.X.', '.X.', '.X.', 'XXX'], J: ['..X', '..X', '..X', 'X.X', '.X.'], K: ['X.X', 'X.X', 'XX.', 'X.X', 'X.X'], L: ['X..', 'X..', 'X..', 'X..', 'XXX'],
    M: ['X...X', 'XX.XX', 'X.X.X', 'X...X', 'X...X'], N: ['X..X', 'XX.X', 'X.XX', 'X..X', 'X..X'], O: ['.X.', 'X.X', 'X.X', 'X.X', '.X.'], P: ['XX.', 'X.X', 'XX.', 'X..', 'X..'],
    Q: ['.X.', 'X.X', 'X.X', 'XX.', '.XX'], R: ['XX.', 'X.X', 'XX.', 'X.X', 'X.X'], S: ['.XX', 'X..', '.X.', '..X', 'XX.'], T: ['XXX', '.X.', '.X.', '.X.', '.X.'],
    U: ['X.X', 'X.X', 'X.X', 'X.X', 'XXX'], V: ['X.X', 'X.X', 'X.X', 'X.X', '.X.'], W: ['X...X', 'X...X', 'X.X.X', 'XX.XX', 'X...X'], X: ['X.X', 'X.X', '.X.', 'X.X', 'X.X'],
    Y: ['X.X', 'X.X', '.X.', '.X.', '.X.'], Z: ['XXX', '..X', '.X.', 'X..', 'XXX'],
    'Ä': ['X.X', '...', '.X.', 'X.X', 'XXX', 'X.X', 'X.X'], 'Ö': ['X.X', '...', '.X.', 'X.X', 'X.X', 'X.X', '.X.'], 'Ü': ['X.X', '...', 'X.X', 'X.X', 'X.X', 'X.X', 'XXX'],
    'É': ['..X', '...', 'XXX', 'X..', 'XX.', 'X..', 'XXX'], '&': ['.X.', 'X.X', '.X.', 'X.X', '.XX'], '-': ['...', '...', 'XXX', '...', '...'], '.': ['.', '.', '.', '.', 'X'], "'": ['X', 'X', '.', '.', '.'],
  };
  // the word of a key in this thread's language: the table a worker was given, else VR.I18N (main thread), else the
  // browser's language
  T._words = null;
  T.word = function (k) {
    if (T._words && typeof T._words[k] === 'string') return T._words[k];
    const d = WORD_DEF[k]; if (!d) return String(k);
    const I = VR.I18N;
    if (I && I.tx && I.dict && (I.dict.de || I.dict.en)) return I.tx('town.sign.' + k, null, d[0], d[1]);
    const nav = (typeof navigator !== 'undefined' && navigator && navigator.language) ? String(navigator.language).slice(0, 2).toLowerCase() : 'en';
    return nav === 'de' ? d[0] : d[1];
  };
  // the main thread's table (sent to the workers with the world's init)
  T.table = function () { const o = {}; for (const k of T.WORDS) o[k] = T.word(k); return o; };
  // a new table: the word signs built before are built again from it (their pieces and boxes forgotten)
  T.setWords = function (tab) {
    const next = tab && typeof tab === 'object' ? Object.assign({}, tab) : null;
    if (JSON.stringify(T._words) === JSON.stringify(next)) return false;
    T._words = next;
    for (const k of T.WORDS) {
      const name = 'vm_town_word_' + k, m = VM.MODELS[name];
      if (!m || !m.compiled || !m.src) continue;
      const fresh = VM.lazyModel(name, m.src); VM.MODELS[name] = fresh;
      const t = VR.R && VR.R.byName && VR.R.byName[name];
      if (t && t.o && t.o.vx) { t.o.vx.model = fresh; if (VX.refreshStates) VX.refreshStates(t.base, t.nstates); }
    }
    return true;
  };
  // the word laid out in the font: [x, y] pixels (y up from the baseline), its width
  T.layout = function (word) {
    const px = []; let x = 0;
    for (const ch of String(word).toUpperCase()) {
      if (ch === ' ') { x += 2; continue; }
      const g = FONT[ch]; if (!g) { x += 2; continue; }
      const h = g.length;
      for (let r = 0; r < h; r++) for (let c = 0; c < g[r].length; c++) if (g[r][c] === 'X') px.push([x + c, h - 1 - r]);
      x += g[0].length + 1;
    }
    return { px, w: Math.max(0, x - 1) };
  };
  for (const k of T.WORDS) {
    def2('vm_town_word_' + k, 'Shop Sign · ' + WORD_DEF[k][1], {
      size: [4, 1, 1], col: 0x2E5843, sound: 'wood', hard: 0.6,
      build(b, M) {
        const board = M.gloss(COL.green), edge = M.gloss(COL.greenD), gold = M.metal(COL.gold), goldL = M.metal(COL.goldL), ir = M.metal(COL.iron);
        b.box(1, 2, 12.5, 63, 14, 15, board);                                          // the board
        b.box(1, 2, 12, 63, 2.8, 15, gold); b.box(1, 13.2, 12, 63, 14, 15, gold);      // the gold frame
        b.box(1, 2, 12, 1.8, 14, 15, gold); b.box(62.2, 2, 12, 63, 14, 15, gold);
        b.box(2.4, 3.4, 12.2, 61.6, 12.6, 12.5, edge);                                  // a dark inner field
        for (const x of [4, 60]) b.sphere(x, 8, 11.9, 0.9, gold);                       // studs at the ends
        for (const x of [8, 56]) b.box(x - 0.5, 14, 14, x + 0.5, 15.5, 16, ir);         // the brackets
        // the word, centred, its letters one voxel proud (rows 5 … 9, an umlaut's dots at 11); seen from the front (−z)
        // +x runs to the viewer's left, so the word is laid out mirrored
        const L = T.layout(T.word(k)), x0 = Math.round(32 - L.w / 2);
        for (const [x, y] of L.px) { const xm = x0 + (L.w - 1 - x); b.box(xm, 5 + y, 11, xm + 1, 6 + y, 12, goldL); }
      },
    });
  }

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
  // round 2 (t-town2): the arched window and the word signs, after the gold band
  VR.BL.late.push(() => { if (VM._K) VM.registerLate(NAMES2); });
})(VR);

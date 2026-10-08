// ============================================================================
// Material families (F2 · Texturen & Materialien). Every texture layer belongs to one family — none, stone, wood,
// fabric, metal or plaster — by its name. Shared by the forge (worker: tex_build.js gives the layers without a normal
// relief their family's micro relief) and the main thread (the terrain shader's family row, u_fam: the detail layer,
// the metal, fabric and varnish response). Pure JS, no DOM.
// ============================================================================
(function (VR) {
  'use strict';
  const MAT = VR.MAT = { NONE: 0, STONE: 1, WOOD: 2, FABRIC: 3, METAL: 4, PLASTER: 5 };

  // the rules, in order: the first that matches the name decides. Light, glass, plants, ground and the like have no
  // family (they keep their look); ores are stone under the ore, before the metal words
  const RULES = [
    [/glass|pane|neon|lamp|lantern|torch|glow|light|lumi|lava|fire|ice|snow|water|leaf|leaves|cobweb|grass|dirt|\bsand(?!stone)|mud|moss|podzol|mycel|coral|sponge|honey|cheese|melon|pumpkin|mushroom|kelp|fern|flower|sugar|vine|root|lilac|crystal|amethyst|budding|echo|gloom|lily|hanging|dead_bush|magma|portal|veil|forcefield|hologram|screen|beacon|wire|sprout|crop|bush|plant|shroom|skyroot|soil|ember_gate|drift_gate|border_block|vein|sea_|glazed/, MAT.NONE],
    [/_ore\b|^ore\b|ore:|ore_/, MAT.STONE],
    [/metal|copper|iron|gold|steel|chrome|brass|hull|cargo|tech|piston|dispenser|dropper|observer|vent|reactor|depth_charge|launch_beacon|landing_pad|garage|logic_block|lodestone|hazard|elevator/, MAT.METAL],
    [/plank|log|wood|bark|stripped|crate|barrel|bookshelf|beehive|bee_nest|crafting_table|loom|fletching|cartography|smithing|jukebox|note_block|walnut|herringbone|bamboo|pale_heart|hay|slat|deck|chest|table|oak|birch|spruce|jungle|acacia|mangrove|cherry|crimson_stem|warped|poplar|teal_stem/, MAT.WOOD],
    [/wool|carpet|rug|cloth|linen|fabric|banner|canvas|cushion|felt|tent|curtain/, MAT.FABRIC],
    [/stucco|plaster|render|concrete|cement|vollton|marble|travertine|terrazzo|quartz|trim|cream|clay|porcelain|kitchen|paint|gypsum|white_clinker/, MAT.PLASTER],
    [/stone|cobble|andesite|diorite|granite|tuff|basalt|deepstone|calcite|sandstone|scoria|obsidian|gravel|brick|slate|flagstone|paver|asphalt|dripstone|voidstone|umber|ochre|duskrock|aether|emberrock|cinnabar|tidestone|bedrock|furnace|smoker|blast|spire|temple|relic|tile|pillar|chisel|bossed|roof|block$|sulfur|cut_|smooth_|polished|buried|cracked|mossy|sunstone/, MAT.STONE],
  ];

  // the family of a texture layer by its name ('#frame' and ':variant' parts count the same)
  VR.matFamily = function (name) {
    const s = String(name || '').toLowerCase();
    for (const [re, id] of RULES) if (re.test(s)) return id;
    return MAT.NONE;
  };
  // one byte per layer (the family), in the order of the names
  VR.matFamilies = function (names) {
    const out = new Uint8Array(names.length);
    for (let l = 0; l < names.length; l++) out[l] = VR.matFamily(names[l]);
    return out;
  };

  // tileable value noise with cx × cy cells over the 32-texel tile (cx ≠ cy stretches the features: fibres, brushing)
  function anoise(x, y, cx, cy, s, N) {
    const fx = x / N * cx, fy = y / N * cy, ix = Math.floor(fx), iy = Math.floor(fy);
    let tx = fx - ix, ty = fy - iy; tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
    const mx = (v) => ((v % cx) + cx) % cx, my = (v) => ((v % cy) + cy) % cy, H = VR.TX.hash;
    const a = H(mx(ix), my(iy), s), b = H(mx(ix + 1), my(iy), s), c = H(mx(ix), my(iy + 1), s), d = H(mx(ix + 1), my(iy + 1), s);
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  }

  // the family's micro relief, added to the height field of a cube texture that has too little of its own. Only the
  // height changes (the normal map follows); the albedo, the roughness and the glow are not touched, so the Klassisch
  // outline and the colours stay as they are. The recipe keeps its own relief where it has some (bricks' mortar,
  // plank seams, tile grout, leaf clumps, log rings): tex_build.js asks matNormalRms first.
  // the rms of the normal's xy over the interior texels 4…27 of one layer's material array (as written: the chunky
  // natural recipes' cell normals included). A layer below MIN_NORMAL_RMS gets its family's relief.
  VR.MAT_MIN_RMS = 0.07;
  VR.matNormalRms = function (mat) {
    const N = VR.TX.N; let s2 = 0, n = 0;
    for (let y = 4; y < N - 4; y++) for (let x = 4; x < N - 4; x++) {
      const o = (y * N + x) * 4, nx = mat[o] / 127.5 - 1, ny = mat[o + 1] / 127.5 - 1;
      s2 += nx * nx + ny * ny; n++;
    }
    return Math.sqrt(s2 / n);
  };
  // adds the family's relief to the height field (the caller re-encodes the normal map); gain scales it (a chunky
  // natural block's cell normals are gentler than a plain face's, so its relief is tried again with a bigger gain)
  VR.matRelief = function (img, fam, seed, gain) {
    const TX = VR.TX, N = TX.N, h = img.h, s = seed * 7 + 3, g = gain || 1;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let d;
      switch (fam) {
        case MAT.STONE:   d = (TX.fbm(x, y, 4, 3, s) - 0.5) * 0.26 + (TX.hash(x, y, s + 1) - 0.5) * 0.08; break;   // grain, speckle
        case MAT.WOOD:    d = (anoise(x, y, 2, 8, s, N) - 0.5) * 0.24 + (TX.hash(x, y, s + 2) - 0.5) * 0.04; break; // fibres along x
        case MAT.FABRIC:  d = (((x >> 1) + (y >> 1)) & 1 ? Math.sin(y * 1.5) : Math.sin(x * 1.5)) * 0.1; break;   // weave
        case MAT.METAL:   d = (anoise(x, y, 2, 16, s, N) - 0.5) * 0.2; break;                                      // brushed streaks
        case MAT.PLASTER: d = (TX.fbm(x, y, 4, 2, s) - 0.5) * 0.14 - (TX.hash(x, y, s + 5) < 0.06 ? 0.12 : 0); break; // mottle, pits
        default:          d = (TX.fbm(x, y, 8, 2, s) - 0.5) * 0.12;                                                // faint grain
      }
      h[y * N + x] += d * g;
    }
    return true;
  };
})(VR);

// ============================================================================
// t-material · the PBR-lite material table. Every texture layer gets, by its name: how metallic it is, how much of a
// clear coat lies over it (a thin, sharp lacquer: polished stone, gloss tiles and the smooth lacquer of the mini-voxel
// pieces, painted hulls, varnished wood) and a scale on the painter's roughness (the painter's per-texel roughness stays
// the detail; tex_core.js writes it into the material texture's blue channel). Matte things (plants, the ground, cloth)
// get nothing and a little more roughness: the shader skips their gloss altogether. Window panes carry a flag: they glow
// warm from inside at night (TRANS_FS). One RGBA8 row for the terrain programs (u_pbr, one texel a layer): r metal,
// g coat, b the roughness scale (128 = ×1, 255 ≈ ×2), a flags. Pure JS (the main thread and the node tests).
// ============================================================================
(function (VR) {
  'use strict';
  const PBR = VR.PBR = { WIN: 1, GLASS: 2 };
  // the rules, in order: the first whose pattern matches the name decides; a rule's fields default to metal 0, coat 0,
  // rk 1 (the roughness scale), flags 0
  const RULES = [
    // items, icons, particles: never drawn on a block face as a material
    [/^item:|^door_icon:|^particle|^icon/, {}],
    // the ground, plants and cloth: matte (their gloss is skipped; the rain still wets them — wet.js)
    [/leaves|leaf|grass|fern|flower|sapling|vine|moss|mycel|podzol|dirt|soil|mud|\bsand\b|^sand$|gravel|clay|snow|wool|carpet|rug|cloth|fabric|felt|hay|straw|wheat|crop|bush|hedge|lichen|mushroom|kelp|coral|sponge|vx_mat_plant|vx_mat_fabric/, { rk: 1.35 }],
    // window panes: glass that glows from inside at night (the VX windows' glass voxels too; a white pane does not)
    [/^ctm:|^window_(black|white)|^mod_glass|^spire_window|^vx_glass$|^stained_glass:/, { coat: 1, flags: 1 | 2 }],
    // other glass: smooth, no glow (railings, plain glass's frame, frosted, ice)
    [/glass|^ice$|packed_ice|blue_ice/, { coat: 1, flags: 2 }],
    // ores sit in rock (before the metal words)
    [/^ore:/, {}],
    // metals: polished blocks and the VX furniture's brushed steel; bars, chains, grates and raw lumps stay rougher
    [/^block:(gold|iron)$|^copper:(block|cut|chiseled):0|vx_mat_metal|mod_steel|chrome|steel|brass/, { metal: 1, rk: 0.85 }],
    [/^copper:(block|cut|chiseled):[1-3]|^copper:grate|iron_door|iron_trapdoor|black_metal|metal_grate|^raw_block:/, { metal: 0.85 }],
    [/iron_bars|iron_chain|^copper:(bars|chain)/, { metal: 0.6 }],
    // the ships' hulls: painted metal under a lacquer
    [/^hull/, { metal: 0.15, coat: 0.75, rk: 0.85 }],
    // the landing pad and the hangar's deck: a sealed, glossy floor
    [/landing_pad|hazard_stripes|deck_plate/, { coat: 0.45 }],
    // polished stone: marble, travertine, quartz, porcelain, terrazzo, the polished cuts
    [/marble|travertine|quartz|porcelain|terrazzo|^polished_|calcite|micro_cement|concrete_smooth/, { coat: 0.6 }],
    // gloss tiles and the mini-voxel pieces' lacquer (the plaza's paving, the white tech walls, the hall's panels, the
    // Vollton gloss of the villas)
    [/vx_tile_gloss|vx_smooth_gloss|vollton_gloss|tech_panel|vx_holo/, { coat: 0.55 }],
    // varnished wood: parquet, the furniture's wood and leather
    [/herringbone|oak_wide|parquet|vx_mat_wood|vx_mat_leather/, { coat: 0.45 }],
    [/vx_mat_marble/, { coat: 0.65 }],
    // fired and sealed: glazed terracotta, roof tiles and slate, concrete (a little; the rain does the rest)
    [/glazed|roof|slate|^concrete:/, { coat: 0.15 }],
  ];
  PBR.RULES = RULES;
  // the material of one texture layer ('#frame' parts count the same)
  PBR.of = function (name) {
    const s = String(name || '').toLowerCase().split('#')[0];
    for (const [re, o] of RULES) if (re.test(s)) return { metal: o.metal || 0, coat: o.coat || 0, rk: o.rk || 1, flags: o.flags || 0 };
    return { metal: 0, coat: 0, rk: 1, flags: 0 };
  };
  // the row for the shader: four bytes a layer, in the order of the names
  PBR.row = function (names) {
    const out = new Uint8Array(((names.length + 3) & ~3) * 4);
    for (let l = 0; l < names.length; l++) {
      const m = PBR.of(names[l]), o = l * 4;
      out[o] = Math.round(m.metal * 255); out[o + 1] = Math.round(m.coat * 255);
      out[o + 2] = Math.max(0, Math.min(255, Math.round(m.rk * 128))); out[o + 3] = m.flags;
    }
    return out;
  };
  // the programs' defines for a quality record: none on the lite look (Very Low), PBR from tier 1, the screen mirror's
  // target (SSR) from tier 2. The renderer asks this for the terrain programs (renderer.js buildPrograms)
  PBR.defines = function (q) {
    if (!q || q.lite) return [];
    const t = q.pbr | 0;
    return t >= 2 ? ['PBR', 'SSR'] : t >= 1 ? ['PBR'] : [];
  };
})(VR);

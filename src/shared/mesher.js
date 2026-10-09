// ============================================================================
// Section mesher (worker). Input: 20^3 padded blocks+light (16 + 2 on every side), 20^2 tints.
// Output: 3 vertex streams (opaque, cutout, translucent) of 8 x u16 per vertex:
//  w0..2 pos (section-local, (p+4)*2048), w3 layer|rot<<12|randrot<<14|macro<<15,
//  w4 u|v<<8 (1/16 units), w5 face|ao<<3|sway<<5|leaf<<7|kind<<8|noshade<<11|emit<<12|uw<<13|ctm<<14|look<<15,
//  w6 light (sky<<12|r<<8|g<<4|b), w7 tint rgb565 (a recoloured face, w5 bit 15: the block's own colour, T.rc)
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R, F = VR.F, SH = VR.SHAPE, FF = VR.FFLAG, MD = VR.MODEL;
  // the section comes padded by PAD blocks on every side: light, AO and the smooth height field (whose pit/bump
  // rule looks two columns out) see the same neighbourhood from both sides of a section border
  const PAD = VR.MESH_PAD = 2, PS = VR.MESH_PS = 16 + PAD * 2, PSS = PS * PS;
  const P = (x, y, z) => (y + PAD) * PSS + (z + PAD) * PS + (x + PAD);
  const DOFF = [1, -1, PSS, -PSS, PS, -PS];
  const FLUID_SIDES = [0, 1, 4, 5];   // the side faces of a fluid block (mesher order: +x, -x, +z, -z)
  const KIND = VR.VKIND = { NONE: 0, WATER: 1, LAVA: 2, PORTAL: 3, STARS: 4, ANIM: 5, WATERFLOW: 6, AETHER: 7 };
  const ENC = (p) => Math.round((p + 4) * 2048);

  // Precompute AO neighbor offsets for cube faces (vertex order TL,BL,BR,TR of facePos)
  const AOOFF = [];
  const AXOFF = [[1, -1], [PSS, -PSS], [PS, -PS]]; // x,y,z axis +/- offsets
  const DAXIS = [0, 0, 1, 1, 2, 2];
  for (let d = 0; d < 6; d++) {
    const pos = MD.facePos(d, [0, 0, 0, 16, 16, 16]);
    const arr = [];
    for (let k = 0; k < 4; k++) {
      const c = [pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]];
      const offs = [];
      for (let a = 0; a < 3; a++) { if (a === DAXIS[d]) continue; offs.push(c[a] > 0 ? AXOFF[a][0] : AXOFF[a][1]); }
      arr.push(offs);
    }
    AOOFF.push(arr);
  }
  // connected textures: for each face, the neighbour directions across its texture's top, right, bottom and left edge
  const CTM_NB = [[2, 5, 3, 4], [2, 4, 3, 5], [5, 0, 4, 1], [4, 0, 5, 1], [2, 0, 3, 1], [2, 1, 3, 0]];
  const STEM_COLORS = [0x00ff00, 0x20f700, 0x40ef00, 0x60e700, 0x80df00, 0xa0d700, 0xc0cf00, 0xe0c700];
  const TINT_FIXED = { 4: 0x80A755, 5: 0x619961, 6: 0xB38A55 };
  const hex565 = (h) => VR.rgb565((h >> 16) & 255, (h >> 8) & 255, h & 255);
  const AETHER_TINT = VR.rgb565(90, 240, 255);

  // ---- smooth props (job.smoothProps; src/main/props.js draws them). The blocks whose type has `prop` get no voxel
  // geometry when the job asks for smooth props, and each prop instance is one anchor of six ints: world x, y, z, kind,
  // facing, light. Type options (read from the registry once per size): `prop` names the prop a block belongs to,
  // `propAnchor` ('all', or a part name) marks the block that anchors it (the palm crown's bottom centre part), and
  // `propStem` names the prop a trunk top draws alone when no prop of its kind stands above it (player-built trunks).
  // The kinds are numbers: a new prop kind is one entry here and one model in props.js.
  const PROP_KIND = VR.PROP_KIND = { palm: 1, palm_trunk: 2 };
  // smooth furniture: the furniture pack's pieces (voxfurn.js) that a smooth model of props.js draws — the ten kinds the
  // villas show most (sofas and their chaise, armchairs, dining tables and chairs, beds, the tripod and the arc lamp,
  // the pendant, the kitchen units and the island, the bookcase, the planters, the TV lowboard and the wall TV) and the
  // coffee tables and nightstands beside them. A type's kind is PROP_FURN0 + its index in this list (the list lives
  // only in a running game: nothing of it is saved); its anchor is the model's part 0 (the cell VM.put places first),
  // its facing the model's turn. No block definition changes.
  const FCOL = ['charcoal', 'cream', 'taupe', 'sage', 'navy'], KCOL = ['white', 'black', 'oak'], KUNIT = ['cabinet', 'sink', 'hob', 'oven', 'tall', 'upper'];
  const PROP_FURN0 = VR.PROP_FURN0 = 16;
  const PROP_FURN = VR.PROP_FURN = [].concat(
    FCOL.map(c => 'vm_sofa_' + c), FCOL.map(c => 'vm_chaise_' + c), FCOL.map(c => 'vm_armchair_' + c),
    ['vm_dining_table_oak', 'vm_dining_table', 'vm_dining_chair_oak', 'vm_dining_chair'],
    ['grey', 'navy', 'sage', 'white', 'rose'].map(c => 'vm_bed_' + c),
    ['vm_floor_lamp', 'vm_arc_lamp', 'vm_pendant'],
    [].concat(...KCOL.map(c => KUNIT.map(u => 'vm_kitchen_' + c + '_' + u))), ['vm_island'],
    ['vm_bookshelf', 'vm_planter', 'vm_monstera', 'vm_olive', 'vm_lowboard', 'vm_tv', 'vm_coffee_table_glass', 'vm_coffee_table', 'vm_nightstand'],
    // the villages' and the towns' own pieces (voxarch.js, voxtech.js, voxhome.js): the beds (foot and head), the table,
    // the chair, the modular sofas (a row joins: a sofa's arms stand only at the row's ends)
    ['red', 'blue', 'green', 'yellow', 'purple', 'pink', 'white', 'teal'].map(c => 'vx_bed_' + c), ['vx_table', 'vx_chair'],
    ['white', 'charcoal', 'cream', 'taupe', 'blue', 'orange'].map(c => 'vx_sofa_' + c),
    // the villas' smaller pieces (the chandelier, the table lamp and its side table, the console, the bar cart, the bar
    // stool) and the rugs (voxarch.js: a rug block joins its neighbours into one rug)
    ['vm_chandelier', 'vm_table_lamp', 'vm_side_table', 'vm_console', 'vm_bar_cart', 'vm_stool'], ['red', 'blue', 'green', 'sand'].map(c => 'vx_rug_' + c),
    // round II (t-smooth2, props2.js; appended — the kinds above keep their numbers): curtains, fridges, the dishwasher,
    // range hoods, art, mirrors, desks, wardrobes, the villages' lights, the corner sofas, the mansions' pieces
    // (gen_modern.js), the villas' remaining pieces and the garden's
    ['vm_curtain', 'vx_curtain', 'vx_curtain_grey', 'vm_fridge', 'vx_fridge', 'vm_kitchen_fridge_french', 'vm_dishwasher', 'vm_range_hood', 'vm_kitchen_hood_island',
      'vx_art_warm', 'vx_art_cool', 'vx_art_gold', 'vm_art_abstract', 'vm_art_landscape', 'vm_art_photo', 'vm_mirror', 'vm_mirror_round', 'vx_mirror',
      'vm_desk', 'vx_tech_desk', 'vx_school_desk', 'vm_wardrobe', 'vm_wardrobe_walnut', 'vx_wardrobe', 'vx_wardrobe_walnut',
      'vx_chandelier', 'vx_lantern', 'vx_lantern_crystal', 'vx_pendant', 'vx_pendant_brass', 'vx_sconce', 'vx_floorlamp'],
    ['charcoal', 'cream', 'taupe', 'white'].map(c => 'vx_sofa_corner_' + c),
    ['vx_nightstand', 'vx_bookshelf', 'vx_bookshelf_walnut', 'vx_tall_plant', 'vx_tall_plant_black', 'vx_vanity', 'vx_upper_cabinet', 'vx_toilet',
      'vx_kitchen_island', 'vx_kitchen_island_dark', 'vx_kitchen_sink', 'vx_kitchen_hob', 'vx_coffee_table', 'vx_coffee_table_marble', 'vx_bathtub', 'vx_bench',
      'vx_dining_table', 'vx_dining_table_white', 'vx_dining_chair', 'vx_dining_chair_teal', 'vx_tv_wall', 'vx_stool', 'vx_stool_orange', 'vx_urn', 'vx_urn_white', 'vx_tech_planter', 'vx_potplant'],
    ['vm_sideboard', 'vm_dresser', 'vm_bench', 'vm_dining_bench', 'vm_wall_shelf', 'vm_kitchen_shelf', 'vm_office_chair', 'vm_vanity', 'vm_toilet', 'vm_bathtub', 'vm_shower', 'vm_bed_single', 'vm_bunk_bed',
      'vm_fireplace', 'vm_piano', 'vm_lounger', 'vm_coat_rack', 'vm_laundry_basket', 'vm_towel_rail', 'vm_toy_box', 'vm_washer', 'vm_sculpture', 'vm_plant_palm_concrete', 'vm_plant_palm_terracotta',
      'vm_garden_chair', 'vm_garden_table', 'vm_outdoor_sofa', 'vm_fire_pit', 'vm_parasol']);
  // the sofas that join their neighbours in a row (voxtech.js ctxHook.sofa: the same kind and family): the group number;
  // groups from 16 join on all four sides along the world's axes (the rugs: any rug joins any rug, as voxarch.js does).
  // Round II: a corner sofa joins the rows of its colours (an L: the rows lose their arm where the corner stands), the
  // counters of a modern kitchen join each other (one worktop), the long dining tables (legs only at the ends), the wall
  // cabinets, the tubs and the TV walls their own kind (voxhome.js rowJoin)
  const PROP_JOIN = { vx_sofa_white: 1, vx_sofa_charcoal: 1, vx_sofa_cream: 1, vx_sofa_taupe: 1, vx_sofa_blue: 2, vx_sofa_orange: 3, vx_rug_red: 16, vx_rug_blue: 16, vx_rug_green: 16, vx_rug_sand: 16,
    vx_sofa_corner_white: 1, vx_sofa_corner_charcoal: 1, vx_sofa_corner_cream: 1, vx_sofa_corner_taupe: 1, vx_kitchen_island: 4, vx_kitchen_island_dark: 4, vx_kitchen_sink: 4, vx_kitchen_hob: 4,
    vx_dining_table: 5, vx_dining_table_white: 6, vx_upper_cabinet: 7, vx_bathtub: 8, vx_tv_wall: 9 };
  const LXP = [0, 4, 1, 5], LXM = [1, 5, 0, 4];   // the neighbour (DOFF index) on a piece's local +x and −x for its facing
  // the pieces that stand on one another (gen_villa_rooms.js puts the table lamp in the cell over its side table): 1 looks
  // for a 2 over it, 2 for a 1 under it (bit 2 of the anchor's facing: the lamp stands on the table's top, the table's
  // vase makes room); 4 hangs when something is above it (the villages' lanterns: bit 2, the chain to the ceiling)
  const PROP_STACK = { vm_side_table: 1, vm_table_lamp: 2, vx_lantern: 4, vx_lantern_crystal: 4 };
  // the prop groups (job.smoothProps is a mask of them; true is the plants alone): 1 the plants (palms), 2 the furniture
  const PROP_GROUP = VR.PROP_GROUP = { plants: 1, furniture: 2 };
  let PROPT = null;
  function propTables() {
    const n = R.stateCount + 1, kind = new Uint8Array(n), anchor = new Uint8Array(n), stem = new Uint8Array(n), facing = new Uint8Array(n), group = new Uint8Array(n), join = new Uint8Array(n), stack = new Uint8Array(n);
    const furn = new Map(PROP_FURN.map((nm, i) => [nm, i]));
    for (const t of R.types) {
      const o = t.o || {}, fi = furn.get(t.name);
      if (!o.prop && !o.propStem && fi === undefined) continue;
      for (let s = t.base; s < t.base + t.nstates; s++) {
        facing[s] = t.has('facing') ? t.get(s, 'facing') & 3 : 0;
        if (fi !== undefined) { kind[s] = PROP_FURN0 + fi; group[s] = PROP_GROUP.furniture; anchor[s] = !t.has('part') || t.get(s, 'part') === 0 ? 1 : 0; join[s] = PROP_JOIN[t.name] || 0; stack[s] = PROP_STACK[t.name] || 0; continue; }
        kind[s] = PROP_KIND[o.prop] || 0;
        stem[s] = PROP_KIND[o.propStem] || 0;
        group[s] = PROP_GROUP.plants;
        anchor[s] = (o.propAnchor === 'all' || (o.propAnchor && t.has('part') && t.getV(s, 'part') === o.propAnchor)) ? 1 : 0;
      }
    }
    PROPT = { kind, anchor, stem, facing, group, join, stack };
  }

  class Buf {
    constructor(n) { this.a = new Uint16Array(n * 8); this.n = 0; }
    ensure(k) { if ((this.n + k) * 8 > this.a.length) { const b = new Uint16Array(Math.max(this.a.length * 2, (this.n + k) * 8 + 4096)); b.set(this.a); this.a = b; } }
    v(x, y, z, w3, u, v, w5, light, tint) {
      const a = this.a, o = this.n * 8;
      a[o] = ENC(x); a[o + 1] = ENC(y); a[o + 2] = ENC(z); a[o + 3] = w3;
      a[o + 4] = (u & 255) | ((v & 255) << 8); a[o + 5] = w5; a[o + 6] = light; a[o + 7] = tint;
      this.n++;
    }
    out() { return this.a.slice(0, this.n * 8); }
  }

  // Panorama glass (the only glass whose frames join, v0.31): per block type its frame family (0 = none) — the frame
  // variants sit in 16 texture layers from o.ctm. Every other glass keeps its own frame per block (v0.33.2: the
  // joined-up window glass, plain / stained glass and panes of v0.33 are single blocks again). Built on first use.
  let CTMK = null, CTML = null, VEILT = null;
  function ctmTables() {
    const n = R.types.length; CTMK = new Int32Array(n); CTML = new Uint8Array(n); VEILT = new Uint8Array(n);
    for (const t of R.types) if (t.o.ctm) { CTMK[t.id] = 0x10000 | t.o.ctm; CTML[t.id] = 1; }
    // the portal veil (a texture with meta.veil): drawn by the translucent shader's veil branch (KIND.PORTAL, emitVeilQuad)
    for (const t of R.types) { const m = R.texMeta[R.T.tex[t.defaultState * 6] & 0xfff]; if (m && m.veil) VEILT[t.id] = 1; }
  }
  // a look or a variant changed the tables (looks.js): the parts built from them are made again
  VR.meshCacheClear = function () { partCache.clear(); CTMK = null; CTML = null; };

  // Stairs/fence/wall/pane part caches per type
  const partCache = new Map();
  // the section's vertex buffers, reused from section to section (out() copies what a section wrote; a section is meshed
  // in one synchronous call), and the visibility flood's arrays
  const BUF_POOL = [];
  function takeBuf(i, cap) { let b = BUF_POOL[i]; if (!b) b = BUF_POOL[i] = new Buf(cap); b.n = 0; return b; }
  const FLOOD_SEEN = new Uint8Array(4096), FLOOD_STACK = new Int32Array(4096);
  const VEIL_CELL = new Int32Array(3);   // emitVeilQuad's scratch cell
  function stairsModels(t, state) {
    let e = partCache.get('s' + t.id + ':' + state);
    if (e) return e;
    // use the face textures from the state (tex table)
    const T = R.T, tex6 = {};
    for (let f = 0; f < 6; f++) tex6[f] = T.tex[state * 6 + f] & 0xfff;
    e = VR.stairsFaces(tex6);
    partCache.set('s' + t.id + ':' + state, e);
    return e;
  }
  function connParts(kind, state) {
    const key = kind + state;
    let e = partCache.get(key);
    if (e) return e;
    const T = R.T; const tx = T.tex[state * 6] & 0xfff;
    const t = R.types[T.type[state]];
    if (kind === 'f') e = VR.fenceParts(tx);
    else if (kind === 'w') e = VR.wallParts(tx);
    else e = VR.paneParts(tx, t.o.paneEdge !== undefined ? t.o.paneEdge : tx);
    partCache.set(key, e);
    return e;
  }

  VR.meshSection = function (job) {
    const T = R.T, TF = T.flags, TSH = T.shape, TL = T.layer, TTEX = T.tex, TTINT = T.tint, TTYPE = T.type, TRC = T.rc;
    if (!CTMK) ctmTables();
    const B = job.blocks, L = job.light, GR = job.grass, FO = job.foliage, WA = job.water;
    const fancy = job.fancyLeaves !== false, smooth = job.smooth !== false;
    // the block look (registry.js): Klassisch draws every panorama glass block with its full frame and no world-space
    // mottling; smooth ground follows the F.SMOOTH flags VR.setLook sets. w3 bit 15 is the macro mottling in Nahtlos —
    // in Klassisch (which never mottles) it marks the faces of natural blocks (random rotation, mottled rock, the
    // nature tab's cubes: R.natural) and leaves for the shader's per-block shade, so neighbouring blocks of one
    // material never read as one surface (Klassisch v2)
    const LK = VR.LOOK, ctmJoin = !LK || LK.ctm, macroOn = !LK || LK.macro, varyOn = !!(LK && LK.vary && !macroOn);
    const NAT = R.natural;
    // smooth props: the prop blocks of the groups job.smoothProps asks for give no voxel geometry; their anchors are
    // collected in propOut (job.smoothProps only: a mask of PROP_GROUP, true = the plants)
    const propMask = job.smoothProps === true ? PROP_GROUP.plants : (job.smoothProps | 0), propOn = propMask !== 0;
    if (propOn && (!PROPT || PROPT.kind.length !== R.stateCount + 1)) propTables();
    const propOut = propOn ? [] : null;
    // the rug under the furniture (t-smooth2): a piece of furniture standing on a rug's floor with rug (or another such
    // piece) on both sides of it along x or along z — looking past the pieces next to it — has the rug drawn under it, and
    // the rugs round it join it: no bordered hole where the generator gave the rug's cells to the furniture. Only when the
    // job asks for the furniture (Very Low meshes the voxel rugs as before)
    const RUGG = 16, furnOn = propOn && (propMask & PROP_GROUP.furniture) !== 0;
    const inPad = (x, z) => x >= -PAD && x < 16 + PAD && z >= -PAD && z < 16 + PAD;
    const isRug = (i) => PROPT.join[B[i]] === RUGG;
    const isPiece = (i) => (PROPT.group[B[i]] & PROP_GROUP.furniture) !== 0 && PROPT.join[B[i]] !== RUGG;
    // rug on both sides along an axis (0: x, 1: z), past up to two pieces each way (the first pass)
    const rugBoth = (x, y, z, ax) => { for (let sg = -1; sg <= 1; sg += 2) { let hit = false; for (let k = 1; k <= 3; k++) { const xx = ax ? x : x + k * sg, zz = ax ? z + k * sg : z; if (!inPad(xx, zz)) break; const i = P(xx, y, zz); if (isRug(i)) { hit = true; break; } if (!isPiece(i)) break; } if (!hit) return false; } return true; };
    const under1 = (x, y, z) => inPad(x, z) && isPiece(P(x, y, z)) && (rugBoth(x, y, z, 0) || rugBoth(x, y, z, 1));
    const rugOr1 = (x, y, z) => inPad(x, z) && (isRug(P(x, y, z)) || under1(x, y, z));
    // the second pass: a piece between rug or first-pass pieces on both sides along an axis (a reading corner's middle)
    const underRug = (x, y, z) => inPad(x, z) && isPiece(P(x, y, z)) && (under1(x, y, z) || (rugOr1(x + 1, y, z) && rugOr1(x - 1, y, z)) || (rugOr1(x, y, z + 1) && rugOr1(x, y, z - 1)));
    const rugOrUnder = (x, y, z) => inPad(x, z) && (isRug(P(x, y, z)) || underRug(x, y, z));
    // a rug's four sides (bits 2–5: +x, −x, +z, −z), the pieces it runs under counted as rug
    const rugSides = (x, y, z) => (rugOrUnder(x + 1, y, z) ? 4 : 0) | (rugOrUnder(x - 1, y, z) ? 8 : 0) | (rugOrUnder(x, y, z + 1) ? 16 : 0) | (rugOrUnder(x, y, z - 1) ? 32 : 0);
    // the rug a piece stands on: the first rug beside it, or past the pieces beside it
    const rugNear = (x, y, z) => { for (let d = 0; d < 4; d++) { const dx = d === 0 ? 1 : d === 1 ? -1 : 0, dz = d === 2 ? 1 : d === 3 ? -1 : 0; for (let k = 1; k <= 3; k++) { const xx = x + dx * k, zz = z + dz * k; if (!inPad(xx, zz)) break; const i = P(xx, y, zz); if (isRug(i)) return B[i]; if (!isPiece(i)) break; } } return 0; };
    const bufs = [takeBuf(0, 4096), takeBuf(1, 1024), takeBuf(2, 1024)];
    // world sections keep their mini-voxel pieces apart from the plain terrain: a detailed buffer drawn up close
    // and a far buffer of averaged boxes (ships and previews merge everything into the opaque stream as before)
    const vxSplit = !!job.vxLod;
    if (vxSplit) { bufs.push(takeBuf(3, 2048), takeBuf(4, 512)); }
    const sy = job.sy;
    const occl = (i) => (TF[B[i]] & (F.OPAQUE | F.LEAVES)) !== 0 && !((TF[B[i]] & F.LEAVES) && !fancy && false);
    const opaqueAt = (i) => (TF[B[i]] & F.OPAQUE) !== 0;
    const tintAt = (code, x, z, state) => {
      if (!code) return 0xffff;
      const ti = (z + PAD) * PS + (x + PAD);
      if (code === 1) return GR[ti]; if (code === 2) return FO[ti]; if (code === 3) return WA[ti];
      if (code === 7) { const t = R.types[TTYPE[state]]; const age = t.has('age') ? t.get(state, 'age') : 7; return hex565(STEM_COLORS[Math.min(7, age)]); }
      if (code < 8) return hex565(TINT_FIXED[code]);
      return hex565(R.tintColors[code - 8]);
    };
    // per-vertex smooth light & ao for cube face d at pad index bi
    const cornerLight = new Uint16Array(4), cornerAO = new Uint8Array(4);
    function faceCorners(bi, d) {
      const qi = bi + DOFF[d];
      const base = L[qi];
      if (!smooth) { for (let k = 0; k < 4; k++) { cornerLight[k] = base; cornerAO[k] = 0; } return; }
      const offs = AOOFF[d];
      for (let k = 0; k < 4; k++) {
        const s1 = qi + offs[k][0], s2 = qi + offs[k][1], c = s1 + offs[k][1];
        const o1 = occl(s1), o2 = occl(s2), oc = occl(c);
        cornerAO[k] = (o1 && o2) ? 3 : ((o1 ? 1 : 0) + (o2 ? 1 : 0) + (oc ? 1 : 0));
        let ss = base >>> 12, rr = (base >> 8) & 15, gg = (base >> 4) & 15, bb = base & 15, n = 1;
        if (!o1) { const l = L[s1]; ss += l >>> 12; rr += (l >> 8) & 15; gg += (l >> 4) & 15; bb += l & 15; n++; }
        if (!o2) { const l = L[s2]; ss += l >>> 12; rr += (l >> 8) & 15; gg += (l >> 4) & 15; bb += l & 15; n++; }
        if (!oc && !(o1 && o2)) { const l = L[c]; ss += l >>> 12; rr += (l >> 8) & 15; gg += (l >> 4) & 15; bb += l & 15; n++; }
        const inv = 1 / n;
        cornerLight[k] = (Math.round(ss * inv) << 12) | (Math.round(rr * inv) << 8) | (Math.round(gg * inv) << 4) | Math.round(bb * inv);
      }
    }
    const bright = (k) => { const l = cornerLight[k]; return Math.max(l >>> 12, (l >> 8) & 15, (l >> 4) & 15, l & 15) * 4 - cornerAO[k] * 3; };
    // the four corners of face d of the box (x0,y0,z0)-(x1,y1,z1) in block units, order TL, BL, BR, TR (the same
    // corners MD.facePos gives for the box in 1/16 units) — written into one scratch array: the emit helpers below run
    // for every face of a section and never allocate (cutting the garbage of a mesh job by half)
    const FP = new Float64Array(12);
    function facePosInto(d, x0, y0, z0, x1, y1, z1) {
      switch (d) {
        case 2: FP[0] = x0; FP[1] = y1; FP[2] = z0; FP[3] = x0; FP[4] = y1; FP[5] = z1; FP[6] = x1; FP[7] = y1; FP[8] = z1; FP[9] = x1; FP[10] = y1; FP[11] = z0; break;
        case 3: FP[0] = x0; FP[1] = y0; FP[2] = z1; FP[3] = x0; FP[4] = y0; FP[5] = z0; FP[6] = x1; FP[7] = y0; FP[8] = z0; FP[9] = x1; FP[10] = y0; FP[11] = z1; break;
        case 4: FP[0] = x0; FP[1] = y1; FP[2] = z1; FP[3] = x0; FP[4] = y0; FP[5] = z1; FP[6] = x1; FP[7] = y0; FP[8] = z1; FP[9] = x1; FP[10] = y1; FP[11] = z1; break;
        case 5: FP[0] = x1; FP[1] = y1; FP[2] = z0; FP[3] = x1; FP[4] = y0; FP[5] = z0; FP[6] = x0; FP[7] = y0; FP[8] = z0; FP[9] = x0; FP[10] = y1; FP[11] = z0; break;
        case 0: FP[0] = x1; FP[1] = y1; FP[2] = z1; FP[3] = x1; FP[4] = y0; FP[5] = z1; FP[6] = x1; FP[7] = y0; FP[8] = z0; FP[9] = x1; FP[10] = y1; FP[11] = z0; break;
        default: FP[0] = x0; FP[1] = y1; FP[2] = z0; FP[3] = x0; FP[4] = y0; FP[5] = z0; FP[6] = x0; FP[7] = y0; FP[8] = z1; FP[9] = x0; FP[10] = y1; FP[11] = z1; break;
      }
    }
    // emit a cube face (single block or merged box, corners in block units) --------------------------------
    // lights / aos: four values per corner (the faceCorners scratch arrays, read before the next face), or null
    function emitCubeQuad(buf, d, x0, y0, z0, x1, y1, z1, w, h, w3, w5base, lights, aos, tint) {
      facePosInto(d, x0, y0, z0, x1, y1, z1);
      const uw = w * 16, vh = h * 16;
      let start = 0;
      if (aos && (bright(0) + bright(2) < bright(1) + bright(3))) start = 1;
      buf.ensure(4);
      for (let kk = 0; kk < 4; kk++) {
        const k = (kk + start) & 3;
        buf.v(FP[k * 3], FP[k * 3 + 1], FP[k * 3 + 2], w3, k >= 2 ? uw : 0, (k === 1 || k === 2) ? vh : 0, w5base | ((aos ? aos[k] : 0) << 3), lights ? lights[k] : 0, tint);
      }
    }
    // the portal veil (KIND.PORTAL): each corner's u carries its distance to the veil's rim in 1/16 blocks — the nearest
    // cell in the face's plane that is not the veil (the frame, the floor, open air), within 8 blocks and the padded
    // section (a cell beyond it counts as veil, so a gate cut by a chunk edge keeps the rim of its other half). The
    // translucent shader lays the hot rim, the energy band and the clear middle on that distance (shaders.js TRANS_FS)
    function emitVeilQuad(buf, d, x, y, z, w3, w5, lights, tint, vt) {
      facePosInto(d, x, y, z, x + 1, y + 1, z + 1);
      const ax = DAXIS[d], a1 = ax === 0 ? 1 : 0, a2 = ax === 2 ? 1 : 2;
      const cell = VEIL_CELL; cell[0] = x; cell[1] = y; cell[2] = z;
      const p0 = cell[a1], q0 = cell[a2], lo = -PAD, hi = 15 + PAD;
      let m0 = 8, m1 = 8, m2 = 8, m3 = 8;
      for (let i = Math.max(lo, p0 - 8); i <= Math.min(hi, p0 + 8); i++) for (let j = Math.max(lo, q0 - 8); j <= Math.min(hi, q0 + 8); j++) {
        cell[a1] = i; cell[a2] = j;
        if (TTYPE[B[P(cell[0], cell[1], cell[2])]] === vt) continue;
        for (let k = 0; k < 4; k++) {
          const cp = FP[k * 3 + a1], cq = FP[k * 3 + a2];
          const dx = Math.max(i - cp, 0, cp - i - 1), dy = Math.max(j - cq, 0, cq - j - 1), dd = Math.sqrt(dx * dx + dy * dy);
          if (k === 0) { if (dd < m0) m0 = dd; } else if (k === 1) { if (dd < m1) m1 = dd; } else if (k === 2) { if (dd < m2) m2 = dd; } else if (dd < m3) m3 = dd;
        }
      }
      buf.ensure(4);
      for (let k = 0; k < 4; k++) {
        const dist = k === 0 ? m0 : k === 1 ? m1 : k === 2 ? m2 : m3;
        buf.v(FP[k * 3], FP[k * 3 + 1], FP[k * 3 + 2], w3, Math.min(255, Math.round(dist * 16)), (k === 1 || k === 2) ? 16 : 0, w5, lights ? lights[k] : 0, tint);
      }
    }
    // ---- R9 Smooth Ground: the natural surface as a height field (see physics.js P.smoothCorners) ----
    const PH = VR.PHYS;
    const blockAt = (x, y, z) => (x < -PAD || x > 15 + PAD || y < -PAD || y > 15 + PAD || z < -PAD || z > 15 + PAD) ? -1 : B[P(x, y, z)];
    const smC = [0, 0, 0, 0], shapeOf = (b) => TSH[b];
    let smKey = -1, smSloped = false;
    // corner heights of the smooth block at (x, y, z) (cached for the block being meshed); false when its top is flat
    const smoothAt = (x, y, z) => {
      const key = P(x, y, z);
      if (key === smKey) return smSloped;
      smKey = key; smSloped = PH ? PH.smoothCorners(blockAt, x, y, z, smC) : false;
      return smSloped;
    };
    // a cube face whose top vertices follow the corner heights (the sloped top itself, or a side under a sloped top)
    function emitSlopeQuad(buf, d, x, y, z, w3, w5base, lights, aos, tint) {
      const x1 = x + 1, y1 = y + 1, z1 = z + 1;
      facePosInto(d, x, y, z, x1, y1, z1);
      let start = 0;
      // the top splits along the diagonal whose ends are closer in height (the crease follows the terrain)
      if (d === 2) start = Math.abs(smC[0] - smC[2]) <= Math.abs(smC[1] - smC[3]) ? 0 : 1;
      else if (aos && (bright(0) + bright(2) < bright(1) + bright(3))) start = 1;
      buf.ensure(4);
      for (let kk = 0; kk < 4; kk++) {
        const k = (kk + start) & 3;
        let py = FP[k * 3 + 1];
        if (py === y1) py = smC[(FP[k * 3] === x1 ? (FP[k * 3 + 2] === z1 ? 2 : 3) : (FP[k * 3 + 2] === z1 ? 1 : 0))];
        buf.v(FP[k * 3], py, FP[k * 3 + 2], w3, k >= 2 ? 16 : 0, (k === 1 || k === 2) ? 16 : 0, w5base | ((aos ? aos[k] : 0) << 3), lights ? lights[k] : 0, tint);
      }
    }
    const texW3 = (texv, flags, d, state) => {
      const layer = texv & 0xfff, rot = (texv >> 12) & 3;
      let w3 = layer | (rot << 12);
      if (flags & F.RANDROT) { const top = TTEX[state * 6 + 2] & 0xfff; if (d >= 2 && d <= 3 || layer === top) w3 |= 1 << 14; }
      if ((flags & F.MACRO) && macroOn) w3 |= 1 << 15;
      else if (varyOn && ((flags & (F.RANDROT | F.MACRO | F.LEAVES)) || (NAT && NAT[state]))) w3 |= 1 << 15;
      return w3;
    };

    // ---- visibility graph flood fill ----
    let visMask = 0;
    {
      const seen = FLOOD_SEEN.fill(0), stack = FLOOD_STACK;
      let anyOpaque = false;
      for (let i = 0; i < 4096; i++) { const x = i & 15, z = (i >> 4) & 15, y = i >> 8; if (opaqueAt(P(x, y, z))) { seen[i] = 1; anyOpaque = true; } }
      if (!anyOpaque) visMask = 0x7fff;
      else for (let s = 0; s < 4096; s++) {
        if (seen[s]) continue;
        let sp = 0; stack[sp++] = s; seen[s] = 1; let faces = 0;
        while (sp) {
          const i = stack[--sp]; const x = i & 15, z = (i >> 4) & 15, y = i >> 8;
          if (x === 15) faces |= 1; if (x === 0) faces |= 2; if (y === 15) faces |= 4; if (y === 0) faces |= 8; if (z === 15) faces |= 16; if (z === 0) faces |= 32;
          if (x < 15 && !seen[i + 1]) { seen[i + 1] = 1; stack[sp++] = i + 1; }
          if (x > 0 && !seen[i - 1]) { seen[i - 1] = 1; stack[sp++] = i - 1; }
          if (z < 15 && !seen[i + 16]) { seen[i + 16] = 1; stack[sp++] = i + 16; }
          if (z > 0 && !seen[i - 16]) { seen[i - 16] = 1; stack[sp++] = i - 16; }
          if (y < 15 && !seen[i + 256]) { seen[i + 256] = 1; stack[sp++] = i + 256; }
          if (y > 0 && !seen[i - 256]) { seen[i - 256] = 1; stack[sp++] = i - 256; }
        }
        for (let a = 0; a < 6; a++) if (faces & (1 << a)) for (let b = a + 1; b < 6; b++) if (faces & (1 << b)) visMask |= 1 << VR.visPair(a, b);
      }
    }

    // ---- greedy opaque cubes ----
    const mstate = new Uint16Array(256), mlight = new Uint16Array(256), mtint = new Uint16Array(256), mflag = new Uint8Array(256), mergedLight = new Uint16Array(4);
    for (let d = 0; d < 6; d++) {
      const ax = DAXIS[d]; // slice axis
      for (let s = 0; s < 16; s++) {
        mflag.fill(0);
        for (let v = 0; v < 16; v++) for (let u = 0; u < 16; u++) {
          let x, y, z;
          if (ax === 0) { x = s; z = u; y = v; } else if (ax === 1) { y = s; x = u; z = v; } else { z = s; x = u; y = v; }
          const bi = P(x, y, z), b = B[bi];
          if (!b) continue;
          const fl = TF[b];
          if (TSH[b] !== SH.CUBE || TL[b] !== 0 || !(fl & F.OPAQUE)) continue;
          const ni = bi + DOFF[d], nb = B[ni];
          if (TF[nb] & F.OPAQUE) continue;
          const mi = v * 16 + u;
          // smooth ground: a sloped top is its own quad, sides under it follow its corners, sides toward a smooth
          // column one step lower vanish under the joined surface
          if ((fl & F.SMOOTH) && d !== 3 && !(TF[B[bi + PSS]] & F.OPAQUE) && smoothAt(x, y, z)) {
            if (d !== 2) {
              // the side toward a smooth column one step lower vanishes only where both corners of that edge really
              // came down to meet it (a corner held up by a hard column next to it still needs the face below)
              const nx = x + (d === 0 ? 1 : d === 1 ? -1 : 0), nz = z + (d === 4 ? 1 : d === 5 ? -1 : 0);
              const ca = smC[d === 0 ? 2 : d === 1 ? 0 : d === 4 ? 1 : 0], cb = smC[d === 0 ? 3 : d === 1 ? 1 : d === 4 ? 2 : 3];
              if (ca < y + 1 - 1e-6 && cb < y + 1 - 1e-6 && PH.surfaceTop(blockAt, nx, y, nz) === y) continue;
            }
            faceCorners(bi, d);
            emitSlopeQuad(bufs[0], d, x, y, z, texW3(TTEX[b * 6 + d], fl, d, b), d | ((fl & F.EMISSIVE) ? 1 << 12 : 0) | (d === 2 ? 1 << 13 : 0) | (TRC[b] ? 32768 : 0), cornerLight, cornerAO, TRC[b] || tintAt(TTINT[b], x, z, b));
            continue;
          }
          faceCorners(bi, d);
          let texv = TTEX[b * 6 + d];
          const t = R.types[TTYPE[b]];
          // special cases
          if (d !== 2 && d !== 3 && t.o.soil && (t.name === 'grass_block' || t.name === 'mycelium' || t.name === 'podzol')) {
            const ab = B[bi + PSS]; const at = R.types[TTYPE[ab]];
            if (ab && at && (at.name === 'snow' || at.name === 'snow_block' || at.name === 'powder_snow')) texv = R.texIndex['grass_snow_side'];
          }
          if (t.o.mushInside !== undefined && t.o.fungusCap) { const nt = R.types[TTYPE[nb]]; if (nt && nt.o.mushInside !== undefined) texv = t.o.mushInside; }
          const rcb = TRC[b], tint = rcb || tintAt(TTINT[b], x, z, b);
          const uniform = cornerLight[0] === cornerLight[1] && cornerLight[1] === cornerLight[2] && cornerLight[2] === cornerLight[3] && !cornerAO[0] && !cornerAO[1] && !cornerAO[2] && !cornerAO[3];
          const w5 = d | ((fl & F.EMISSIVE) ? 1 << 12 : 0) | (rcb ? 32768 : 0);
          if (uniform && texv === TTEX[b * 6 + d]) { mflag[mi] = 1; mstate[mi] = b; mlight[mi] = cornerLight[0]; mtint[mi] = tint; }
          else emitCubeQuad(bufs[0], d, x, y, z, x + 1, y + 1, z + 1, 1, 1, texW3(texv, fl, d, b), w5, cornerLight, cornerAO, tint);
        }
        // merge
        for (let v = 0; v < 16; v++) for (let u = 0; u < 16;) {
          const mi = v * 16 + u;
          if (mflag[mi] !== 1) { u++; continue; }
          const st0 = mstate[mi], li0 = mlight[mi], ti0 = mtint[mi];
          let w = 1;
          while (u + w < 16 && w < 15) { const mj = mi + w; if (mflag[mj] !== 1 || mstate[mj] !== st0 || mlight[mj] !== li0 || mtint[mj] !== ti0) break; w++; }
          let h = 1;
          outer: while (v + h < 16 && h < 15) {
            for (let k = 0; k < w; k++) { const mj = (v + h) * 16 + u + k; if (mflag[mj] !== 1 || mstate[mj] !== st0 || mlight[mj] !== li0 || mtint[mj] !== ti0) break outer; }
            h++;
          }
          for (let hh = 0; hh < h; hh++) for (let k = 0; k < w; k++) mflag[(v + hh) * 16 + u + k] = 2;
          const fl = TF[st0];
          mergedLight[0] = li0; mergedLight[1] = li0; mergedLight[2] = li0; mergedLight[3] = li0;
          const w3 = texW3(TTEX[st0 * 6 + d], fl, d, st0), w5 = d | ((fl & F.EMISSIVE) ? 1 << 12 : 0) | (TRC[st0] ? 32768 : 0);
          if (ax === 0) emitCubeQuad(bufs[0], d, s, v, u, s + 1, v + h, u + w, w, h, w3, w5, mergedLight, null, ti0);
          else if (ax === 1) emitCubeQuad(bufs[0], d, u, s, v, u + w, s + 1, v + h, w, h, w3, w5, mergedLight, null, ti0);
          else emitCubeQuad(bufs[0], d, u, v, s, u + w, v + h, s + 1, w, h, w3, w5, mergedLight, null, ti0);
          u += w;
        }
      }
    }

    // ---- everything else ----
    // (declared before the loop: the helpers below run inside it)
    const connGroup = (s) => { const t = R.types[TTYPE[s]]; return t ? (t.o.conn || 0) : 0; };
    const HD = [5, 0, 4, 1]; // facing idx (n,e,s,w) → face dir
    const nbState = (bi, d) => B[bi + DOFF[d]];
    const vxM = VR.VX ? { B, L, bufs: vxSplit ? [bufs[3], bufs[1], bufs[2]] : bufs, far: vxSplit ? bufs[4] : null, detail: !(vxSplit && job.vxDetail === false), DOFF, layerTile: R.texIndex['vx_tile'] | 0, layerGloss: R.texIndex['vx_tile_gloss'] | 0, layerGlass: R.texIndex['vx_glass'] | 0, layerHolo: R.texIndex['vx_holo'] | 0, layerSmooth: R.texIndex['vx_smooth'] | 0, layerSmoothGloss: R.texIndex['vx_smooth_gloss'] | 0, layerMat: [0].concat(['fabric', 'leather', 'wood', 'marble', 'metal', 'plant', 'stone'].map(m => R.texIndex['vx_mat_' + m] | 0)), ox: job.ox | 0, oy: (job.sy | 0) * 16, oz: job.oz | 0 } : null;
    for (let y = 0; y < 16; y++) for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const bi = P(x, y, z), b = B[bi];
      if (!b) continue;
      const shape = TSH[b], fl = TF[b], layer = TL[b];
      if (shape === SH.NONE) continue;
      if (propOn && (PROPT.group[b] & propMask)) {
        // a prop block: its geometry is the smooth prop's. The anchor goes to the list: the block that anchors the prop
        // (its bottom face is the trunk's top), or the air above a trunk top that no prop of its kind covers
        if (PROPT.anchor[b]) {
          // a sofa in a row: bit 2 a neighbour of its group on its local +x, bit 3 on its local −x (its arms go there); a
          // rug: bits 2–5 a rug on +x, −x, +z, −z; a table lamp on its side table, the table under it: bit 2
          let f = PROPT.facing[b];
          const jg = PROPT.join[b], sk = PROPT.stack[b];
          if (jg === RUGG) f |= rugSides(x, y, z);
          else if (jg >= 16) f |= (PROPT.join[B[bi + DOFF[0]]] === jg ? 4 : 0) | (PROPT.join[B[bi + DOFF[1]]] === jg ? 8 : 0) | (PROPT.join[B[bi + DOFF[4]]] === jg ? 16 : 0) | (PROPT.join[B[bi + DOFF[5]]] === jg ? 32 : 0);
          else if (jg) f |= (PROPT.join[B[bi + DOFF[LXP[f]]]] === jg ? 4 : 0) | (PROPT.join[B[bi + DOFF[LXM[f]]]] === jg ? 8 : 0);
          if (sk === 4) { const up = B[bi + DOFF[2]]; if (up && !(TF[up] & F.FLUID)) f |= 4; }
          else if (sk && PROPT.stack[B[bi + DOFF[sk === 1 ? 2 : 3]]] === 3 - sk) f |= 4;
          propOut.push(job.ox + x, sy * 16 + y, job.oz + z, PROPT.kind[b], f, L[bi]);
        }
        else if (PROPT.stem[b] && PROPT.kind[B[bi + DOFF[2]]] !== PROPT.kind[b]) propOut.push(job.ox + x, sy * 16 + y + 1, job.oz + z, PROPT.stem[b], 0, L[bi + DOFF[2]]);
        // the rug runs on under a piece standing on it (any cell of the piece at the rug's level)
        if (furnOn && PROPT.join[b] !== RUGG && (PROPT.group[b] & PROP_GROUP.furniture) && underRug(x, y, z)) { const rs = rugNear(x, y, z); if (rs) propOut.push(job.ox + x, sy * 16 + y, job.oz + z, PROPT.kind[rs], rugSides(x, y, z), L[bi]); }
        continue;
      }
      if (shape === SH.CUBE) {
        if (layer === 0 && (fl & F.OPAQUE)) continue; // done by greedy
        // non-opaque cube (glass, leaves, ice, slime, lava-like)
        const t = R.types[TTYPE[b]];
        const ctm = t && t.o.ctm, fam = CTMK[TTYPE[b]] | 0, cmode = fam ? CTML[TTYPE[b]] : 0;
        // the same glass: no face and no frame between them (window glass and panorama glass of one style count as one)
        const same = (nb) => nb === b || TTYPE[nb] === TTYPE[b] || (fam !== 0 && (CTMK[TTYPE[nb]] | 0) === fam && TSH[nb] === SH.CUBE);
        // which edges of face d join the same glass (bit 0 top, 1 right, 2 bottom, 3 left)
        const joinMask = (d) => { const E = CTM_NB[d]; let m = 0; for (let k = 0; k < 4; k++) if (same(B[bi + DOFF[E[k]]])) m |= 1 << k; return m; };
        const veil = VEILT[TTYPE[b]] === 1;
        // (v0.33.2: no more "pane in the middle of the wall" for glass set in a wall — a neighbour that changed made the
        // pane jump to the block's surface, and it looked like glass popping up next to a block you broke. Glass is
        // drawn as the block it is, flush like every other block.)
        for (let d = 0; d < 6; d++) {
          const nb = nbState(bi, d);
          if (TF[nb] & F.OPAQUE) continue;
          if (same(nb)) {
            if (fl & F.SELFCULL) continue;
            if ((fl & F.LEAVES) && !fancy) continue;
          }
          if ((fl & F.LEAVES) && (TF[nb] & F.LEAVES) && !fancy) continue;
          if (layer === 2 && (TF[nb] & F.TRANS) && same(nb)) continue;
          faceCorners(bi, d);
          // a recoloured block (never connected glass: there bit 15 belongs to the frame mask)
          const rcb = cmode === 1 ? 0 : TRC[b];
          const tint = rcb || tintAt(TTINT[b], x, z, b);
          let w5 = d | ((fl & F.EMISSIVE) ? 1 << 12 : 0) | (rcb ? 32768 : 0);
          if (fl & F.WAVELEAF) w5 |= 1 << 7;
          let texv = TTEX[b * 6 + d];
          // panorama glass: the frame variant from the same glass around this face (top, right, bottom, left);
          // Klassisch: variant 0, the full frame on every block
          if (cmode === 1) { texv = ctm + (ctmJoin ? joinMask(d) : 0); w5 |= 1 << 14; }
          if (veil) { emitVeilQuad(bufs[layer], d, x, y, z, texW3(texv, fl, d, b), w5 | (KIND.PORTAL << 8), cornerLight, tint, TTYPE[b]); continue; }
          emitCubeQuad(bufs[layer], d, x, y, z, x + 1, y + 1, z + 1, 1, 1, texW3(texv, fl, d, b), w5, cornerLight, cornerAO, tint);
        }
        continue;
      }
      if (shape === SH.VOXEL) { if (vxM) VR.VX.meshBlock(vxM, x, y, z, bi, b); continue; }
      if (shape === SH.FLUID) { meshFluid(x, y, z, bi, b); continue; }
      let faces = null;
      const t = R.types[TTYPE[b]];
      // one odd block must never take the whole section (a hole in the ground) down with it
      try { switch (shape) {
        case SH.MODEL: faces = R.models[b]; break;
        case SH.STAIRS: faces = stairsFor(bi, b, t); break;
        case SH.FENCE: faces = connFor(bi, b, 'f'); break;
        case SH.WALL: faces = wallFor(bi, b); break;
        case SH.PANE: faces = connFor(bi, b, 'p'); break;
        case SH.WIRE: meshWire(x, y, z, bi, b); continue;
        case SH.CHORUS: faces = chorusFor(bi, b); break;
        case SH.DRIP: faces = dripFor(bi, b, t); break;
        case SH.CROSS: faces = R.models[b]; break;
      } } catch (e) { if (!VR._meshBlockErr) { VR._meshBlockErr = 1; console.warn('mesh block', R.types[TTYPE[b]] && R.types[TTYPE[b]].name, e); } continue; }
      if (!faces) continue;
      emitModel(faces, x, y, z, bi, b, t, layer, fl);
    }

    function emitModel(faces, x, y, z, bi, b, t, layer, fl) {
      const tintCode = TTINT[b];
      const rcb = TRC[b], blockTint = rcb || tintAt(tintCode, x, z, b);
      const own = L[bi];
      // plant offset jitter for small plants
      let ox = 0, oz = 0, oy = 0;
      if (t.o.jitter) {
        const h = M_hash(x + job.ox, z + job.oz);
        ox = ((h & 15) / 15 - 0.5) * 0.35; oz = (((h >> 4) & 15) / 15 - 0.5) * 0.35;
      }
      // plants on smooth ground sit on the sloped surface (its height under the plant's centre)
      if (PH && (shapeOf(b) === SH.CROSS || shapeOf(b) === SH.TALLCROSS || shapeOf(b) === SH.CROP) && y > 0) {
        const bb = B[bi - PSS];
        if ((TF[bb] & F.SMOOTH) && smoothAt(x, y - 1, z)) { const fx = 0.5 + ox, fz = 0.5 + oz; oy = smC[0] * (1 - fx) * (1 - fz) + smC[1] * (1 - fx) * fz + smC[2] * fx * fz + smC[3] * fx * (1 - fz) - y; }
      }
      let rotLily = 0;
      if (t.o.randomRot) rotLily = M_hash(x + job.ox, z + job.oz) & 3;
      const pane = TSH[b] === SH.PANE;
      for (let fi = 0; fi < faces.length; fi++) {
        let f = faces[fi];
        if (rotLily) f = MD.rotY([f], rotLily)[0];
        if (f.cull >= 0) {
          const nb = B[bi + DOFF[f.cull]];
          if (TF[nb] & F.OPAQUE) continue;
          const nt = TTYPE[nb];
          if (nt === TTYPE[b] && (fl & F.SELFCULL)) continue;
          // a pane's ends and edges against the same pane or flush against a full block (glass too) are hidden
          if (pane && (nt === TTYPE[b] || ((TF[nb] & F.FULL) && (TF[nb] & F.SOLID)))) continue;
        }
        const fflags = f.flags || 0;
        let light;
        if (f.cull >= 0) light = L[bi + DOFF[f.cull]]; else light = own;
        const lay = f.layer !== undefined ? f.layer : layer;
        const buf = bufs[lay];
        let kind = 0;
        if (fflags & FF.WATER) kind = KIND.WATER; else if (fflags & FF.LAVA) kind = KIND.LAVA; else if (fflags & FF.PORTAL) kind = KIND.PORTAL; else if (fflags & FF.STARS) kind = KIND.STARS;
        const texv = f.tex;
        const meta = R.texMeta[texv & 0xfff];
        if (meta && meta.anim) kind = KIND.ANIM;
        if (meta && meta.veil) kind = KIND.PORTAL;   // the portal veil: its own swirl in the translucent shader (shaders.js TRANS_FS)
        let w5base = (f.dir & 7) | (kind << 8) | ((fflags & FF.EMIT) || (fl & F.EMISSIVE) ? 1 << 12 : 0) | (!f.shade ? 1 << 11 : 0);
        if ((fflags & FF.WAVELEAF) || (fl & F.WAVELEAF)) w5base |= 1 << 7;
        // a recoloured block: every plain face in its colour (water, lava, portal and star faces keep theirs)
        const look = rcb && (kind === 0 || kind === KIND.ANIM);
        if (look) w5base |= 32768;
        const tint = look ? rcb : f.tint ? (f.tint >= 8 && f.tint < 256 ? tintAt(f.tint, x, z, b) : (f.tint > 255 ? hex565(f.tint) : tintAt(f.tint, x, z, b))) : (rcb ? tintAt(tintCode, x, z, b) : blockTint);
        const w3 = (texv & 0xffff) | ((fl & F.MACRO) && macroOn ? 1 << 15 : 0);
        const p = f.p, uv = f.uv;
        buf.ensure(f.double ? 8 : 4);
        const tall = t.o.tall && t.has('half') && t.get(b, 'half') === 1;
        for (let k = 0; k < 4; k++) {
          let sway = 0;
          if (fflags & FF.WAVE) { const py = p[k * 3 + 1]; sway = tall ? (py > 0.5 ? 3 : 2) : (py > 0.3 ? (t.o.tall ? 2 : 3) : 0); }
          buf.v(x + p[k * 3] + ox, y + p[k * 3 + 1] + oy, z + p[k * 3 + 2] + oz, w3, uv[k * 2], uv[k * 2 + 1], w5base | (sway << 5), light, tint);
        }
        if (f.double) {
          for (let kk = 0; kk < 4; kk++) {
            const k = 3 - kk;
            let sway = 0;
            if (fflags & FF.WAVE) { const py = p[k * 3 + 1]; sway = tall ? (py > 0.5 ? 3 : 2) : (py > 0.3 ? (t.o.tall ? 2 : 3) : 0); }
            buf.v(x + p[k * 3] + ox, y + p[k * 3 + 1] + oy, z + p[k * 3 + 2] + oz, w3, uv[k * 2], uv[k * 2 + 1], (w5base & ~7) | VR.OPP[f.dir & 7] | (sway << 5), light, tint);
          }
        }
      }
    }
    function M_hash(x, z) { let h = x * 374761393 + z * 668265263; h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; }

    // ---------------- stairs shape ----------------
    function stairsFor(bi, b, t) {
      const facing = t.get(b, 'facing'), half = t.get(b, 'half');
      const models = stairsModels(t, b);
      const isStairs = (s) => TSH[s] === SH.STAIRS;
      const fdx = VR.HF_DX, fdz = VR.HF_DZ;
      const front = B[bi + fdx[facing] + fdz[facing] * PS];
      let shape = 0;
      if (isStairs(front)) {
        const ft = R.types[TTYPE[front]]; const ff = ft.get(front, 'facing'), fh = ft.get(front, 'half');
        if (fh === half && (ff & 1) !== (facing & 1)) {
          const side = B[bi - fdx[ff] - fdz[ff] * PS];
          const sameSide = isStairs(side) && R.types[TTYPE[side]].get(side, 'facing') === facing && R.types[TTYPE[side]].get(side, 'half') === half;
          if (!sameSide) shape = ff === (facing + 3) % 4 ? 3 : 4;
        }
      }
      if (!shape) {
        const back = B[bi - fdx[facing] - fdz[facing] * PS];
        if (isStairs(back)) {
          const bt = R.types[TTYPE[back]]; const bf = bt.get(back, 'facing'), bh = bt.get(back, 'half');
          if (bh === half && (bf & 1) !== (facing & 1)) {
            const side = B[bi + fdx[bf] + fdz[bf] * PS];
            const sameSide = isStairs(side) && R.types[TTYPE[side]].get(side, 'facing') === facing && R.types[TTYPE[side]].get(side, 'half') === half;
            if (!sameSide) shape = bf === (facing + 3) % 4 ? 1 : 2;
          }
        }
      }
      return models[(facing * 2 + half) * 5 + shape];
    }
    // ---------------- connections ----------------
    function connects(bi, d, my, kind) {
      const n = B[bi + DOFF[d]];
      if (!n) return false;
      if (TF[n] & F.OPAQUE) return true;
      const g = connGroup(n);
      if (kind === 'f') return g === my || (g === 1 && my === 1 && false) || (my === 1 && R.types[TTYPE[n]].o.kind === 'gate');
      if (kind === 'w') return g === 3 || g === 4 || R.types[TTYPE[n]].o.kind === 'gate';
      return R.paneJoin(n);
    }
    function connFor(bi, b, kind) {
      const parts = connParts(kind, b);
      const my = connGroup(b);
      if (kind === 'p') {
        // a pane: no faces inside the glass — the post's side under an arm and the arm's inner end go (they showed as
        // little frame ticks along a run of panes). One face list per joined-sides mask, cached.
        let m = 0; for (let i = 0; i < 4; i++) if (connects(bi, HD[i], my, kind)) m |= 1 << i;
        const key = 'P' + b + ':' + m;
        let f = partCache.get(key);
        if (!f) {
          f = parts.post.filter(fc => { for (let i = 0; i < 4; i++) if ((m >> i & 1) && fc.dir === HD[i]) return false; return true; });
          for (let i = 0; i < 4; i++) if (m >> i & 1) f = f.concat(parts.arms[i].filter(fc => fc.dir !== VR.OPP[HD[i]]));
          partCache.set(key, f);
        }
        return f;
      }
      let f = parts.post.slice();
      for (let i = 0; i < 4; i++) if (connects(bi, HD[i], my, kind)) f = f.concat(parts.arms[i]);
      return f;
    }
    function wallFor(bi, b) {
      const parts = connParts('w', b);
      const c = [0, 1, 2, 3].map(i => connects(bi, HD[i], 3, 'w'));
      const above = B[bi + PSS];
      const aboveTall = above && ((TF[above] & F.OPAQUE) || connGroup(above) === 3);
      const straight = (c[0] && c[2] && !c[1] && !c[3]) || (c[1] && c[3] && !c[0] && !c[2]);
      let f = [];
      const post = !straight || (above && (TF[above] & F.SOLID) && connGroup(above) === 3);
      if (post) f = f.concat(parts.post);
      for (let i = 0; i < 4; i++) if (c[i]) f = f.concat(post ? (aboveTall ? parts.tall[i] : parts.low[i]) : (aboveTall ? parts.tallC[i] : parts.lowC[i]));
      return f;
    }
    function chorusFor(bi, b) {
      const tx = TTEX[b * 6] & 0xfff;
      let f = MD.box([4, 4, 4, 12, 12, 12], tx, { cull: false });
      const arms = [[12, 4, 4, 16, 12, 12], [0, 4, 4, 4, 12, 12], [4, 12, 4, 12, 16, 12], [4, 0, 4, 12, 4, 12], [4, 4, 12, 12, 12, 16], [4, 4, 0, 12, 12, 4]];
      for (let d = 0; d < 6; d++) {
        const n = B[bi + DOFF[d]];
        const g = connGroup(n);
        if (g === 6 || (d === 3 && R.types[TTYPE[n]] && R.types[TTYPE[n]].name === 'voidstone')) f = f.concat(MD.box(arms[d], tx));
      }
      return f;
    }
    function dripFor(bi, b, t) {
      const dir = t.get(b, 'dir'); // 0 up (stalagmite), 1 down
      const step = dir === 0 ? PSS : -PSS;
      const same = (s) => TTYPE[s] === TTYPE[b];
      const n1 = B[bi + step], n2 = B[bi + step * 2];
      let th;
      if (!same(n1)) th = 'tip';
      else if (R.types[TTYPE[n1]].get(n1, 'dir') !== dir) th = 'tip_merge';
      else if (!same(n2)) th = 'frustum';
      else { const back = B[bi - step]; th = same(back) ? 'middle' : 'base'; }
      const tex = R.texIndex['drip:' + t.o.dripFam + ':' + th];
      let f = MD.cross(tex, { inset: th === 'base' ? 2 : th === 'middle' ? 3 : 4 });
      if (dir === 1) f = MD.flipY(f);
      return f;
    }
    // ---------------- volt wire ----------------
    function meshWire(x, y, z, bi, b) {
      const power = R.types[TTYPE[b]].get(b, 'power');
      const c = [0, 1, 2, 3].map(i => wireConn(bi, i));
      const cnt = c.filter(v => v).length;
      const dot = R.texIndex['wire_dot'], line = R.texIndex['wire_line'];
      const r = Math.round(80 + power * 11.6), g = Math.round(power > 12 ? (power - 12) * 30 : 0), bl = 0;
      const tint = VR.rgb565(Math.min(255, r), g, bl);
      const light = L[bi];
      const buf = bufs[1];
      const w5 = 2 | (1 << 11) | (power > 0 ? 1 << 12 : 0);
      const flat = (x0, z0, x1, z1, tex, rot) => {
        const yy = y + 0.015;
        buf.ensure(4);
        const uvs = [[x0 * 16, z0 * 16], [x0 * 16, z1 * 16], [x1 * 16, z1 * 16], [x1 * 16, z0 * 16]];
        const pts = [[x0, z0], [x0, z1], [x1, z1], [x1, z0]];
        for (let k = 0; k < 4; k++) buf.v(x + pts[k][0], yy, z + pts[k][1], tex | (rot << 12), uvs[k][0], uvs[k][1], w5, light, tint);
      };
      if (cnt === 0) flat(0, 0, 1, 1, dot, 0);
      else {
        const ns = c[0] || c[2], ew = c[1] || c[3];
        if (ns && !ew && cnt <= 2) flat(0, 0, 1, 1, line, 0);
        else if (ew && !ns && cnt <= 2) flat(0, 0, 1, 1, line, 1);
        else {
          flat(0.3125, 0.3125, 0.6875, 0.6875, dot, 0);
          if (c[0]) flat(0.3125, 0, 0.6875, 0.3125, line, 0);
          if (c[2]) flat(0.3125, 0.6875, 0.6875, 1, line, 0);
          if (c[1]) flat(0.6875, 0.3125, 1, 0.6875, line, 1);
          if (c[3]) flat(0, 0.3125, 0.3125, 0.6875, line, 1);
        }
      }
      // up-steps
      for (let i = 0; i < 4; i++) {
        const d = HD[i];
        const up = B[bi + DOFF[d] + PSS];
        if (TTYPE[up] === TTYPE[b] && !(TF[B[bi + PSS]] & F.OPAQUE)) {
          const pts = MD.facePos(d, [0, 0, 0, 16, 16, 16]);
          // quad on the neighbor's face, slightly inset
          const e = 0.015;
          buf.ensure(4);
          const uvs = [0, 0, 0, 16, 16, 16, 16, 0];
          for (let k = 0; k < 4; k++) {
            const px = pts[k * 3] / 16 - VR.DX[d] * e, py = pts[k * 3 + 1] / 16, pz = pts[k * 3 + 2] / 16 - VR.DZ[d] * e;
            buf.v(x + px, y + py, z + pz, line, uvs[k * 2], uvs[k * 2 + 1], VR.OPP[d] | (1 << 11), light, tint);
          }
        }
      }
    }
    function wireConn(bi, i) {
      const d = HD[i];
      const n = B[bi + DOFF[d]];
      const nt = R.types[TTYPE[n]];
      if (nt) {
        if (nt.o.kind === 'wire') return true;
        const k = nt.o.kind;
        if (k === 'lever' || k === 'button' || k === 'vtorch' || k === 'plate' || k === 'target' || k === 'daylight' || k === 'observer' || (TF[n] & F.POWERSRC)) return true;
        if (k === 'repeater' || k === 'comparator') { const f = nt.get(n, 'facing'); return (f & 1) === (i & 1); }
      }
      if (!(TF[n] & F.OPAQUE)) { const dn = B[bi + DOFF[d] - PSS]; if (R.types[TTYPE[dn]] && R.types[TTYPE[dn]].o.kind === 'wire') return true; }
      const up = B[bi + DOFF[d] + PSS];
      if (R.types[TTYPE[up]] && R.types[TTYPE[up]].o.kind === 'wire' && !(TF[B[bi + PSS]] & F.OPAQUE)) return true;
      return false;
    }
    // ---------------- fluids ----------------
    function fluidInfo(s, type) {
      if (TTYPE[s] !== type) return -1;
      const lv = R.types[type].get(s, 'level');
      return lv;
    }
    // a fluid block with the same fluid (or something opaque) on all six sides shows no face: the body of a lake or an
    // ocean is left here before any work is done (it is most of the fluid blocks of a section)
    function fluidHidden(bi, type, isLava) {
      const above = B[bi + PSS];
      if (!(TTYPE[above] === type || (!isLava && (TF[above] & F.WATER)) || (TF[above] & F.OPAQUE))) return false;
      const below = B[bi - PSS];
      if (!(TTYPE[below] === type || (TF[below] & F.OPAQUE) || (!isLava && (TF[below] & F.WATER)))) return false;
      for (let k = 0; k < 4; k++) {
        const nb = B[bi + DOFF[FLUID_SIDES[k]]];
        if (!((TF[nb] & F.OPAQUE) || TTYPE[nb] === type || (!isLava && (TF[nb] & F.WATER) && (TF[nb] & F.FLUID)))) return false;
      }
      return true;
    }
    function meshFluid(x, y, z, bi, b) {
      const type = TTYPE[b], t = R.types[type];
      const isLava = (TF[b] & F.LAVA) !== 0;
      if (fluidHidden(bi, type, isLava)) return;
      const lvl = t.get(b, 'level');
      const aboveSame = TTYPE[B[bi + PSS]] === type || (!isLava && (TF[B[bi + PSS]] & F.WATER));
      const heightOf = (s) => {
        const tt = TTYPE[s];
        if (tt !== type && !(!isLava && (TF[s] & F.WATER) && (TF[s] & F.FLUID))) return -1;
        const lv = R.types[tt].get(s, 'level');
        if (lv === 0) return 0.875;
        if (lv >= 8) return 1;
        return (8 - lv) / 9;
      };
      const cornerH = (dx, dz) => {
        // average heights of the 4 blocks around corner (dx,dz ∈ {0,1})
        let sum = 0, n = 0;
        for (let ox = dx - 1; ox <= dx; ox++) for (let oz = dz - 1; oz <= dz; oz++) {
          const ni = bi + ox + oz * PS;
          const s = B[ni];
          const above = B[ni + PSS];
          if ((TTYPE[s] === type || (!isLava && (TF[s] & F.WATER) && (TF[s] & F.FLUID))) && (TTYPE[above] === type || (!isLava && (TF[above] & F.WATER) && (TF[above] & F.FLUID)))) return 1;
          const h = heightOf(s);
          if (h >= 0) { const w = h >= 0.875 ? 3 : 1; sum += h * w; n += w; }
          else if (!(TF[s] & F.SOLID)) { n += 1; }
        }
        return n ? sum / n : 0.875;
      };
      const h00 = aboveSame ? 1 : cornerH(0, 0), h10 = aboveSame ? 1 : cornerH(1, 0), h01 = aboveSame ? 1 : cornerH(0, 1), h11 = aboveSame ? 1 : cornerH(1, 1);
      const buf = bufs[isLava ? 0 : 2];
      const isAether = !!t.o.aether;
      const tint = isLava ? 0xffff : isAether ? AETHER_TINT : tintAt(3, x, z, b);
      const tex = TTEX[b * 6 + 2] & 0xfff;
      const kindBase = isLava ? KIND.LAVA : isAether ? KIND.AETHER : KIND.WATER;
      // flow direction from height gradient
      const fx = (h10 + h11) - (h00 + h01), fz = (h01 + h11) - (h00 + h10);
      const flowing = lvl !== 0 && !aboveSame && (Math.abs(fx) + Math.abs(fz) > 0.01);
      let rot = 0;
      if (flowing) { const a = Math.atan2(-fz, -fx); rot = ((Math.round(a / (Math.PI / 2)) % 4) + 4 + 1) % 4; }
      const w3 = tex | (rot << 12);
      const kind = isAether ? KIND.AETHER : flowing ? KIND.WATERFLOW : kindBase;
      const emitW5 = isLava || isAether ? 1 << 12 : 0;
      const kindV = isLava ? KIND.LAVA : kind;
      // top
      const above = B[bi + PSS];
      if (!aboveSame && !(TF[above] & F.OPAQUE)) {
        const l = L[bi + PSS] > L[bi] ? L[bi + PSS] : L[bi];
        buf.ensure(8);
        const pts = [[0, h00, 0], [0, h01, 1], [1, h11, 1], [1, h10, 0]];
        const uvs = [[0, 0], [0, 16], [16, 16], [16, 0]];
        for (let k = 0; k < 4; k++) buf.v(x + pts[k][0], y + pts[k][1] - 0.001, z + pts[k][2], w3, uvs[k][0], uvs[k][1], 2 | (kindV << 8) | emitW5, l, tint);
        if (!isLava) for (let kk = 0; kk < 4; kk++) { const k = 3 - kk; buf.v(x + pts[k][0], y + pts[k][1] - 0.001, z + pts[k][2], w3, uvs[k][0], uvs[k][1], 3 | (kindV << 8), l, tint); }
      }
      // bottom
      const below = B[bi - PSS];
      if (TTYPE[below] !== type && !(TF[below] & F.OPAQUE) && !(!isLava && (TF[below] & F.WATER))) {
        buf.ensure(4);
        const pts = [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]];
        for (let k = 0; k < 4; k++) buf.v(x + pts[k][0], y, z + pts[k][2], tex, pts[k][0] * 16, pts[k][2] * 16, 3 | (kindBase << 8) | emitW5, L[bi - PSS], tint);
      }
      // sides: order TL,BL,BR,TR matching facePos
      const sides = [
        [0, [1, h11, 1], [1, 0, 1], [1, 0, 0], [1, h10, 0]],
        [1, [0, h00, 0], [0, 0, 0], [0, 0, 1], [0, h01, 1]],
        [4, [0, h01, 1], [0, 0, 1], [1, 0, 1], [1, h11, 1]],
        [5, [1, h10, 0], [1, 0, 0], [0, 0, 0], [0, h00, 0]],
      ];
      for (const [d, a, bb, c, e] of sides) {
        const ni = bi + DOFF[d], nb = B[ni];
        if (TF[nb] & F.OPAQUE) continue;
        if (TTYPE[nb] === type || (!isLava && (TF[nb] & F.WATER) && (TF[nb] & F.FLUID))) continue;
        buf.ensure(8);
        const l = L[ni];
        const pts = [a, bb, c, e];
        for (let k = 0; k < 4; k++) buf.v(x + pts[k][0], y + pts[k][1], z + pts[k][2], tex | (1 << 12), k === 0 || k === 1 ? 0 : 16, (1 - pts[k][1]) * 16, d | ((isAether ? KIND.AETHER : KIND.WATERFLOW) << 8) | emitW5, l, tint);
        if (!isLava) for (let kk = 0; kk < 4; kk++) { const k = 3 - kk; buf.v(x + pts[k][0], y + pts[k][1], z + pts[k][2], tex | (1 << 12), k === 0 || k === 1 ? 0 : 16, (1 - pts[k][1]) * 16, VR.OPP[d] | ((isAether ? KIND.AETHER : KIND.WATERFLOW) << 8) | emitW5, l, tint); }
      }
    }

    const res = { opaque: bufs[0].out(), cutout: bufs[1].out(), trans: bufs[2].out(), vis: visMask };
    if (vxSplit) { res.vx = bufs[3].out(); res.vxFar = bufs[4].out(); }
    if (propOut) res.props = Int32Array.from(propOut);   // six ints per prop instance (see propTables)
    return res;
  };
  // pair index for faces a<b (6 faces → 15 pairs)
  const PAIR = [];
  { let k = 0; for (let a = 0; a < 6; a++) { PAIR[a] = []; for (let b = 0; b < 6; b++) PAIR[a][b] = -1; } for (let a = 0; a < 6; a++) for (let b = a + 1; b < 6; b++) { PAIR[a][b] = k; PAIR[b][a] = k; k++; } }
  VR.visPair = (a, b) => PAIR[a][b];
})(VR);

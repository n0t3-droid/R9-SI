// ============================================================================
// Villa Nova — THE house of the trailer (docs/trailer/frames t1_26 · t3_05 ·
// t2_23 · t1_24 outside, t1_29 · t1_30 · t3_10 · t2_28 inside), the catalogue
// family 'trailer' (gen_plan.js, skin 'nova'). Built block by block, at real
// scale, on a 25 × 31 lot (u across the street front, v into the lot; the street on the v = 0 side):
//  · three stepped storeys of grey stone: a ground floor 21 × 15 with a two-block
//    slab that cantilevers two blocks over the front, a first floor set back three
//    blocks at the front and two at the sides (the ground floor's roof is a
//    terrace), a top floor set back again with a roof garden round it; a white
//    fascia with a cyan light line on every slab edge, an orange light line under
//    every overhang edge, white balusters on every terrace and on the roof, a white
//    dome and planters on top;
//  · box bays standing out of the facades, each with ONE big window: turquoise glass
//    glowing in a thick orange frame (vx_nova_window, voxnova.js), orange light lines
//    at the foot of every box, glass bands between the boxes; the entrance a tall
//    glass door inside a glazed screen of the same frame;
//  · inside, the white hall: a white gloss floor, a white ceiling with spots and a
//    cove ring of cyan light, the glass wall to the back garden with mullions, the
//    light pad with a cyan ring on the floor round it and white benches, two floating
//    glass stairs (vm_nova_tread) along the side walls rising from the glass toward
//    the front into the first floor, a glass partition between the foyer and the
//    hall; upstairs a gallery with a bed, sofas and plants, a studio on the top;
//  · the garden: lawn, hedges, a curved path from the street to the door with cyan
//    light lines on both edges (the line blocks curve round their corners), round
//    blossom bushes and round trees, planters, flowers and ferns along the house,
//    palms with the shared crown (vm_palm_crown), a paved strip and loungers in
//    front of the glass wall.
// PLAN.buildNova is a generator like PLAN.buildSteps (it yields between phases);
// the info record is the villa builder's (plan, beds, seats, door, roofTop …).
//
// THE FAMILY (vgen 8, Palm City Nova Haven — t1_22 · t1_24 · t2_23 · t3_06): one language — grey stone storeys
// stepping back, slab edges with the cyan line and the orange underglow, box bays each with one big turquoise window
// in a thick orange frame, glass bands with lintels, white balusters, a roof garden with the big round tree — in five
// compositions (PLAN.NOVA_FAMILY), each also mirrored (o.novaMirror):
//   classic   the house above (the catalogue's, built exactly as before)
//   long      the wide two-storey villa: a long glass band across the ground floor, the roof garden on the first floor
//   tower     three tiers stacked at one side, each storey a box with its big window, the tree on the second tier
//   corner    L-shaped: a wing standing forward with a box bay wrapping its corner, the tree on the wing's roof
//   bungalow  one storey with a glass front, a pavilion box on the roof, the roof garden beside it
// o.comp picks the composition (the city, gen_city.js); the info record of every composition also carries the house
// rectangle, the bays, the slab edges and the path's start at the street (the city joins its light lines to it).
// ============================================================================
(function (VR) {
  'use strict';
  const VG = VR.VillageGen;
  if (!VG || !VG.plan2) return;
  const PLAN = VG.plan2;
  // the geometry, the plan and the skin are in gen_plan.js (PLAN.NOVA, PLAN.templates.trailer, SKINS.nova)
  const buildClassic = function* (L, lot, o) {
    const P = L.P, F = lot.F, rng = o.rng || new VR.RNG(7);
    const S = (PLAN.SKINS && PLAN.SKINS.nova) || {};
    const M = Object.assign({
      wall: 'vollton_stone_grey', bay: 'vollton_light_grey', plinth: 'vollton_mid_grey', fascia: 'vx_nova_band', ceiling: 'vollton_white',
      floor: 'vollton_white_gloss', inner: 'vollton_white', terrace: 'vx_floor_plaza', rail: 'vx_balustrade', win: 'vx_nova_window', glass: 'panorama_white',
      mullion: 'vx_beam_white', base: 'vx_led_strip', door: 'door_glass_white', path: 'vx_floor_plaza', line: 'vx_floor_plaza_line',
      hedge: 'vx_hedge', partition: 'vx_nova_glass', sheet: 'vx_nova_glass', spot: 'vx_spot', glassRail: 'vx_tech_railing',
    }, S);
    const NOVA = PLAN.NOVA, { G, U, T, OVER } = NOVA, VM = VR.VM, W = lot.w, D = lot.d;
    const put = (u, y, v, name, pr) => P(u, F + y, v, name, pr);
    const box = (u0, y0, v0, u1, y1, v1, name, pr) => { for (let y = y0; y <= y1; y++) for (let v = v0; v <= v1; v++) for (let u = u0; u <= u1; u++) put(u, y, v, name, pr); };
    const model = (u, y, v, name, f) => { if (VM && VM.MODELS[name]) VM.put((uu, yy, vv, n, pr) => P(uu, yy, vv, n, pr), u, F + y, v, name, f || 0); };
    // a model placed by the corner of its footprint (the smallest u and v it covers), whatever its facing
    const modelAt = (u, y, v, name, f) => {
      const m = VM && VM.MODELS[name]; if (!m) return;
      const fp = VM.footprint(m, f || 0); let du = 0, dv = 0;
      for (const c of fp) { du = Math.min(du, c[0]); dv = Math.min(dv, c[2]); }
      model(u - du, y, v - dv, name, f);
    };
    const info = { beds: [], seats: [], work: [], door: null, outside: null, inside: null, chimney: null, table: null, lights: [], roofTop: F + 22, skin: 'nova', family: 'trailer', cars: [], desks: [] };

    // ---- the ground under the lot: lawn at the yard level (F − 1), the house on a stone footing
    const yard = -1;
    for (let v = 0; v < D; v++) for (let u = 0; u < W; u++) {
      const gy = o.ground ? o.ground(u, v) - F : yard, inG = u >= G.u0 && u <= G.u1 && v >= G.v0 && v <= G.v1;
      for (let y = Math.min(gy, yard) - 2; y < yard; y++) put(u, y, v, inG ? 'concrete_smooth' : 'dirt');
      put(u, yard, v, inG ? 'concrete_smooth' : 'grass_block');
      for (let y = yard + 1; y <= 24; y++) put(u, y, v, null);
    }
    yield;

    // ---- the storeys: floor, walls (a plinth course at the ground), the inside air
    const storey = (R, isG) => {
      const y0 = R.y, yTop = R.y + R.clear;
      for (let v = R.v0; v <= R.v1; v++) for (let u = R.u0; u <= R.u1; u++) {
        const ring = u === R.u0 || u === R.u1 || v === R.v0 || v === R.v1;
        if (isG) put(u, y0, v, ring ? M.plinth : M.floor);
        for (let y = y0 + 1; y <= yTop; y++) put(u, y, v, ring ? M.wall : null);
      }
    };
    storey(G, true); storey(U, false); storey(T, false);
    // the ground floor's walls are two thick: grey stone outside, a white lining inside (the white hall); the back is glass
    for (let y = 1; y <= G.clear; y++) {
      for (let v = G.v0 + 1; v <= G.v1 - 1; v++) { put(G.u0 + 1, y, v, M.inner); put(G.u1 - 1, y, v, M.inner); }
      for (let u = G.u0 + 1; u <= G.u1 - 1; u++) put(u, y, G.v0 + 1, M.inner);
    }
    // ---- the slab zones: two blocks thick, the storey's footprint plus its overhang; a light fascia ring (vx_nova_band)
    //      with a cyan line in its lower row and an orange glow under its edge; inside: the ceiling (lower row) and the
    //      floor of the storey above (upper row)
    const slabRect = (R, ov) => [R.u0 - ov[1], R.v0 - ov[0], R.u1 + ov[1], R.v1 + ov[2]];
    const slab = (R, ov, above) => {
      const [a0, b0, a1, b1] = slabRect(R, ov), y = R.slab;
      for (let v = b0; v <= b1; v++) for (let u = a0; u <= a1; u++) {
        const ring = u === a0 || u === a1 || v === b0 || v === b1;
        // the fascia: the lower row with the cyan line and the orange underglow, the upper row plain
        if (ring) { put(u, y, v, M.fascia, { glow: 3 }); put(u, y + 1, v, M.fascia, { glow: 0 }); continue; }
        const inAbove = above && u > above.u0 && u < above.u1 && v > above.v0 && v < above.v1;
        const wallAbove = above && (u === above.u0 || u === above.u1 || v === above.v0 || v === above.v1) && u >= above.u0 && u <= above.u1 && v >= above.v0 && v <= above.v1;
        put(u, y, v, M.ceiling);
        put(u, y + 1, v, inAbove ? M.floor : wallAbove ? M.plinth : M.terrace);
      }
      return [a0, b0, a1, b1];
    };
    const gS = slab(G, OVER.G, U), uS = slab(U, OVER.U, T), tS = slab(T, OVER.T, null);
    yield;

    // ---- terraces: balusters on every slab edge that has open sky above it; the top floor's roof is the roof terrace
    const railRing = (rect, y, skip) => {
      const [a0, b0, a1, b1] = rect;
      for (let v = b0; v <= b1; v++) for (let u = a0; u <= a1; u++) {
        if (!(u === a0 || u === a1 || v === b0 || v === b1)) continue;
        if (skip && skip(u, v)) continue;
        put(u, y, v, M.rail);
      }
    };
    const inside = (R, u, v) => u >= R.u0 && u <= R.u1 && v >= R.v0 && v <= R.v1;
    // (no balusters where the storey above stands, nor on the ledge behind its flush back wall)
    railRing(gS, G.slab + 2, (u, v) => inside(U, u, v) || (v > U.v1 && u >= U.u0 && u <= U.u1));   // the ground floor's terrace
    railRing(uS, U.slab + 2, (u, v) => inside(T, u, v) || (v > T.v1 && u >= T.u0 && u <= T.u1));   // the roof garden round the top floor
    railRing(tS, T.slab + 2, null);                                     // the roof
    yield;

    // ---- the facades. win(): a rectangle of nova windows in the wall plane of side s (0 front −v, 1 +u, 2 back +v, 3 −u)
    const FACE = [0, 1, 2, 3];
    const win = (s, a0, a1, y0, y1, fixed) => { for (let a = a0; a <= a1; a++) for (let y = y0; y <= y1; y++) put((s & 1) ? fixed : a, y, (s & 1) ? a : fixed, M.win, { facing: FACE[s] }); };
    // a lintel: a nova band with its orange line right above a window (the line runs along the band's foot)
    const lintel = (s, a0, a1, y, fixed) => { for (let a = a0; a <= a1; a++) put((s & 1) ? fixed : a, y, (s & 1) ? a : fixed, M.fascia, { glow: 2 }); };
    // a box bay on side s over [a0, a1], pushed out o.depth blocks (one by default) from y0 to y1, one window [w0, w1] ×
    // [wy0, wy1] in its face with a lintel over it. A box standing on the ground gets an orange line at its foot (the cell
    // in front, the line on the box's face at the top of the plinth course); a hanging box (o.hang) has a nova band as its
    // lowest row, whose underside glows orange (t2_23: the upper boxes hang over the terrace below). Behind the window the
    // box's inner layers and the wall open into the room.
    const bay = (R, s, a0, a1, y0, y1, w0, w1, wy0, wy1, o2) => {
      o2 = o2 || {};
      const dep = o2.depth || 1, outK = (k) => (s === 0 ? R.v0 - k : s === 2 ? R.v1 + k : s === 1 ? R.u1 + k : R.u0 - k);
      const out = outK(dep), fr = s === 0 ? out - 1 : s === 2 ? out + 1 : s === 1 ? out + 1 : out - 1;
      for (let k = 1; k <= dep; k++) for (let a = a0; a <= a1; a++) {
        const o = outK(k), u = (s & 1) ? o : a, v = (s & 1) ? a : o;
        if (R === G && !o2.hang) put(u, 0, v, M.plinth);
        for (let y = y0; y <= y1; y++) put(u, y, v, M.bay);
        if (o2.hang) put(u, y0, v, M.fascia, { glow: 2 });
        else if (k === dep) { const fu = (s & 1) ? fr : a, fv = (s & 1) ? a : fr; put(fu, y0, fv, M.base, { facing: (s + 2) & 3 }); }
      }
      if (w1 >= w0) {
        win(s, w0, w1, wy0, wy1, out);
        if (wy1 < y1) lintel(s, w0, w1, wy1 + 1, out);
        // the box's inner layers and the wall behind the window open into the room (and the ground floor's white lining)
        for (let a = w0; a <= w1; a++) for (let y = wy0; y <= wy1; y++) {
          for (let k = 1; k < dep; k++) { const o = outK(k); put((s & 1) ? o : a, y, (s & 1) ? a : o, null); }
          for (let k = 0; k <= (R === G ? 1 : 0); k++) {
            const u = (s & 1) ? (s === 1 ? R.u1 - k : R.u0 + k) : a, v = (s & 1) ? a : (s === 0 ? R.v0 + k : R.v1 - k);
            put(u, y, v, null);
          }
        }
      }
    };
    const EU = NOVA.ENTRY;
    // ground floor, front (v 6): two boxes with 3 × 3 windows, the entrance box between them, glass bands in the recesses
    bay(G, 0, 3, 7, 1, 5, 4, 6, 2, 4);
    bay(G, 0, 17, 21, 1, 5, 18, 20, 2, 4);
    bay(G, 0, EU - 2, EU + 2, 1, 5, 0, -1, 0, -1);
    for (const [a0, a1] of [[8, 9], [15, 16]]) { win(0, a0, a1, 3, 3, G.v0); lintel(0, a0, a1, 4, G.v0); }
    // the entrance: a tall glass door in a glazed screen in the box's face (side lights and a transom: one orange frame
    // round all of it), a lintel over it, a vestibule through the wall behind
    const EV = G.v0 - 1;
    win(0, EU - 1, EU - 1, 1, 4, EV); win(0, EU + 1, EU + 1, 1, 4, EV); win(0, EU, EU, 3, 4, EV); lintel(0, EU - 1, EU + 1, 5, EV);
    put(EU, 1, EV, M.door, { facing: 0, half: 0, hinge: 0, open: 0 }); put(EU, 2, EV, M.door, { facing: 0, half: 1, hinge: 0, open: 0 });
    put(EU, 0, EV - 1, M.plinth + '_stairs', { facing: 2, half: 0 }); put(EU, 1, EV - 1, null);
    for (let v = G.v0; v <= G.v0 + 1; v++) for (let u = EU - 1; u <= EU + 1; u++) for (let y = 1; y <= 4; y++) put(u, y, v, null);
    info.door = [EU, F + 1, EV]; info.outside = [EU, F, EV - 3]; info.inside = [EU, F + 1, G.v0 + 2];
    // ground floor, sides: a tall window with a lintel and a box bay with a 3 × 3 window each (t1_24: every box has its
    // window); back: the glass wall (below)
    for (const s of [1, 3]) {
      const fixed = s === 1 ? G.u1 : G.u0, lin = s === 1 ? G.u1 - 1 : G.u0 + 1;
      win(s, 8, 9, 2, 4, fixed); lintel(s, 8, 9, 5, fixed);
      for (let v = 8; v <= 9; v++) for (let y = 2; y <= 4; y++) put(lin, y, v, null);
      bay(G, s, 12, 16, 1, 5, 13, 15, 2, 4);
    }
    // first floor, front (v 9): two boxes standing two blocks out over the terrace, hanging free of it with the orange
    // glow under them (t2_23), each with a 3 × 2 window; a glass door to the terrace between them
    bay(U, 0, 5, 9, U.y + 2, U.y + 4, 6, 8, U.y + 3, U.y + 4, { hang: true, depth: 2 });
    bay(U, 0, 15, 19, U.y + 2, U.y + 4, 16, 18, U.y + 3, U.y + 4, { hang: true, depth: 2 });
    put(EU, U.y + 1, U.v0, M.door, { facing: 0, half: 0, hinge: 0, open: 0 }); put(EU, U.y + 2, U.v0, M.door, { facing: 0, half: 1, hinge: 0, open: 0 });
    win(0, EU - 1, EU - 1, U.y + 1, U.y + 3, U.v0); win(0, EU + 1, EU + 1, U.y + 1, U.y + 3, U.v0); win(0, EU, EU, U.y + 3, U.y + 3, U.v0); lintel(0, EU - 1, EU + 1, U.y + 4, U.v0);
    // first floor, sides and back: on the right a box standing out over the terrace like the front ones (the composition
    // is not symmetric: the top box sits at the left, t1_24)
    win(3, 11, 12, U.y + 2, U.y + 3, U.u0); lintel(3, 11, 12, U.y + 4, U.u0); win(3, 17, 18, U.y + 2, U.y + 3, U.u0); lintel(3, 17, 18, U.y + 4, U.u0);
    win(1, 10, 11, U.y + 2, U.y + 3, U.u1); lintel(1, 10, 11, U.y + 4, U.u1);
    bay(U, 1, 13, 17, U.y + 2, U.y + 4, 14, 16, U.y + 3, U.y + 4, { hang: true, depth: 2 });
    win(2, 7, 9, U.y + 2, U.y + 3, U.v1); win(2, 15, 17, U.y + 2, U.y + 3, U.v1); win(2, 11, 13, U.y + 3, U.y + 3, U.v1);
    for (const [a0, a1] of [[7, 9], [11, 13], [15, 17]]) lintel(2, a0, a1, U.y + 4, U.v1);
    // top floor — the box at the left (t1_24): one glazed front in one orange frame with the door to the roof terrace in
    // it, a big window to the roof garden on the right, windows on the left and the back
    win(0, T.u0 + 1, T.u1 - 1, T.y + 1, T.y + 3, T.v0); lintel(0, T.u0 + 1, T.u1 - 1, T.y + 4, T.v0);
    put(T.u0 + 5, T.y + 1, T.v0, M.door, { facing: 0, half: 0, hinge: 0, open: 0 }); put(T.u0 + 5, T.y + 2, T.v0, M.door, { facing: 0, half: 1, hinge: 0, open: 0 });
    win(1, 15, 18, T.y + 1, T.y + 3, T.u1); lintel(1, 15, 18, T.y + 4, T.u1);
    win(3, 15, 17, T.y + 2, T.y + 3, T.u0); lintel(3, 15, 17, T.y + 4, T.u0);
    win(2, T.u0 + 2, T.u1 - 2, T.y + 2, T.y + 3, T.v1); lintel(2, T.u0 + 2, T.u1 - 2, T.y + 4, T.v1);
    yield;

    // ---- the glass wall to the back garden (the hall): one clear sheet floor to ceiling (vx_nova_glass joins in both looks)
    //      with a slim mullion every five blocks, the garden door in the middle (between the high ends of the stairs,
    //      where the way under them is free)
    for (let u = G.u0 + 2; u <= G.u1 - 2; u++) for (let y = 1; y <= G.clear; y++) put(u, y, G.v1, M.sheet, { facing: 0, post: (u - 2) % 5 === 0 ? 1 : 0 });
    for (let y = 1; y <= G.clear; y++) { put(G.u0 + 1, y, G.v1, M.wall); put(G.u1 - 1, y, G.v1, M.wall); }
    put(EU, 1, G.v1, M.door, { facing: 2, half: 0, hinge: 1, open: 0 }); put(EU, 2, G.v1, M.door, { facing: 2, half: 1, hinge: 1, open: 0 });
    yield;

    // ---- the hall: the cove ring in the ceiling, spots, the partition, the pad, benches, plants
    const PV = NOVA.PARTITION, SV0 = NOVA.STAIR_V;
    const cu0 = 9, cu1 = 15, cv0 = 13, cv1 = 16;                       // the cove over the pad: a recess one block up into the slab
    for (let v = cv0 - 1; v <= cv1 + 1; v++) for (let u = cu0 - 1; u <= cu1 + 1; u++) {
      const inner = u >= cu0 && u <= cu1 && v >= cv0 && v <= cv1;
      put(u, G.slab, v, inner ? null : M.fascia, inner ? undefined : { glow: 1 });
    }
    // spots in a grid under the ceiling (not over the stairs, not in the cove)
    const stairCell = (u, v) => v >= SV0 && v <= SV0 + 1;
    for (let v = G.v0 + 2; v <= G.v1 - 1; v += 3) for (let u = EU - 6; u <= EU + 6; u += 3) {
      if (stairCell(u, v) || (u >= cu0 - 1 && u <= cu1 + 1 && v >= cv0 - 1 && v <= cv1 + 1) || v === PV) continue;
      put(u, G.clear, v, M.spot); info.lights.push([u, F + G.clear, v]);
    }
    // a lowered soffit along a side wall of the hall with a cyan line round its open edges (t1_29: on the right as one
    // looks at the glass wall, the −u side)
    for (let v = PV + 1; v <= cv1; v++) for (let u = G.u0 + 2; u <= G.u0 + 3; u++) put(u, G.clear, v, M.fascia, { glow: 1 });
    // the partition between the foyer and the hall: clear glass sheets (t3_10) with a mullion in the middle of each, the
    //      middle open
    for (let u = G.u0 + 2; u <= G.u1 - 2; u++) { if (Math.abs(u - EU) <= 1) continue; for (let y = 1; y <= G.clear; y++) put(u, y, PV, M.partition, { facing: 0, post: Math.abs(u - EU) === 5 ? 1 : 0 }); }
    // the pad with a ring of cyan light on the floor round it, white benches beside it
    const [pu, pv] = NOVA.PAD;
    for (let v = pv - 1; v <= pv + 3; v++) for (let u = pu - 1; u <= pu + 3; u++) if (u === pu - 1 || u === pu + 3 || v === pv - 1 || v === pv + 3) put(u, 0, v, M.line);
    model(pu, 1, pv, 'vm_nova_pad', 0); info.table = [pu + 1, F + 1, pv + 1];
    for (const u of [pu - 3, pu + 5]) for (let v = pv; v <= pv + 2; v++) { put(u, 1, v, 'vollton_white_slab', { type: 'bottom' }); info.seats.push([u, F + 1, v, u < pu ? 1 : 3]); }
    // plants: potted palms in the hall's front corners, tropical planters in the foyer
    model(G.u0 + 2, 1, PV + 1, 'vm_plant_palm_concrete', 0); model(G.u1 - 2, 1, PV + 1, 'vm_plant_palm_concrete', 0);
    for (const u of [EU - 3, EU + 3]) put(u, 1, G.v0 + 2, 'vx_tech_planter');
    put(G.u0 + 2, 1, G.v0 + 2, 'vx_tech_planter'); put(G.u1 - 2, 1, G.v0 + 2, 'vx_tech_planter');
    yield;

    // ---- the floating glass stairs: two blocks deep in front of the glass wall (v 18–19), one block up and one along per
    //      piece, from the side walls (y 1) up toward the middle (y 7, the first floor's floor) — the V of the trailer's
    //      hall seen against the garden; the ceiling and the first floor open over them, glass railings round the openings
    for (const st of NOVA.STAIRS) {
      const uk = (k) => st.u + st.du * (k - 1);
      for (let k = 1; k <= U.y; k++) {
        const u = uk(k);
        // head room: two cells over every tread (the piece's own glass cheeks stand in them)
        for (let h = 1; h <= 2; h++) for (let dv = 0; dv <= 1; dv++) if (k + h <= U.y) put(u, k + h, SV0 + dv, null);
        modelAt(u, k, SV0, 'vm_nova_tread', st.du > 0 ? 3 : 1);
      }
      // upstairs: a glass railing along the opening's front and across its low end
      for (let k = U.y - 3; k <= U.y - 1; k++) put(uk(k), U.y + 1, SV0 - 1, M.glassRail);
      for (let dv = 0; dv <= 1; dv++) put(uk(U.y - 3), U.y + 1, SV0 + dv, M.glassRail);
    }
    yield;

    // ---- the stair to the top floor: the same glass treads, two wide, rising toward the back from the gallery's front
    //      (u 15–16, v 12 at the first floor) to the studio (v 17, the top floor's floor); the slab opens above it
    const SU = NOVA.STAIR2.u, SV = NOVA.STAIR2.v;
    for (let k = 1; k <= 6; k++) {
      const v = SV + k - 1, y = U.y + k;
      for (let h = 1; h <= 2; h++) for (let du = 0; du <= 1; du++) if (y + h <= T.y) put(SU + du, y + h, v, null);
      model(SU, y, v, 'vm_nova_tread', 0);
    }
    for (let v = SV + 3; v <= SV + 4; v++) put(SU - 1, T.y + 1, v, M.glassRail);
    for (let du = 0; du <= 1; du++) put(SU + du, T.y + 1, SV + 2, M.glassRail);
    yield;

    // ---- the first floor: a gallery round the stair heads (the landing between them at the back), a bed on the left,
    //      sofas at the front, plants and spots
    model(U.u0 + 1, U.y + 1, 13, 'vm_bed_white', 0); info.beds.push([U.u0 + 2, F + U.y + 1, 14, 0]);
    for (const [u, v] of [[U.u0 + 1, U.v0 + 1], [U.u1 - 1, U.v0 + 1], [U.u1 - 1, U.v1 - 1]]) put(u, U.y + 1, v, 'vx_tech_planter');
    // (the sofas keep the way from the terrace door to the foot of the top stair free)
    for (const u of [6, 7, 8, 9, 15, 16, 17, 18]) { put(u, U.y + 1, 11, 'vx_sofa_white', { facing: 2 }); info.seats.push([u, F + U.y + 1, 11, 2]); }
    model(U.u0 + 1, U.y + 1, U.v1 - 1, 'vm_plant_palm_concrete', 0);
    for (const [u, v] of [[7, 12], [7, 16], [16, 13], [16, 17], [18, 15]]) put(u, U.y + U.clear, v, M.spot);
    // the top floor: a studio with a lounge looking out through the glazed front
    for (let u = T.u0 + 1; u <= T.u0 + 4; u++) { put(u, T.y + 1, 18, 'vx_sofa_white', { facing: 0 }); info.seats.push([u, F + T.y + 1, 18, 0]); }
    put(T.u0 + 1, T.y + 1, 14, 'vx_tech_planter'); put(T.u0 + 1, T.y + 1, 19, 'vx_tech_planter');
    for (const [u, v] of [[T.u0 + 3, 15], [T.u0 + 3, 18]]) put(u, T.y + T.clear, v, M.spot);
    yield;

    // ---- the roof garden beside the top box (t2_23, t1_24: the big round bush on the roof): lawn on the first floor's
    //      roof right of the top box, the large round tree rising to the top box's roof, blossom bushes, loungers on the
    //      terrace in front of the top box, a small round tree at its corner; planters and the dome on the top box's roof
    const ry = U.slab + 2, gu0 = T.u1 + 2, gu1 = U.u1, gv0 = U.v0 + 2, gv1 = U.v1 - 1;
    for (let v = gv0; v <= gv1; v++) for (let u = gu0; u <= gu1; u++) put(u, U.slab + 1, v, 'grass_block');
    modelAt(gu0, ry, gv0 + 2, 'vm_tree_round_l', 0);
    for (const [u, v] of [[gu1, gv0], [gu1, gv1], [gu0, gv1]]) model(u, ry, v, 'vm_bush_blossom', 0);
    model(uS[0] + 1, ry, uS[1] + 1, 'vm_tree_round_s', 0);
    for (const u of [T.u0 + 3, T.u0 + 5]) model(u, ry, uS[1] + 2, 'vm_lounger', 0);
    put(T.u1, ry, uS[1] + 1, 'vx_tech_planter');
    for (let k = 0; k < 2; k++) for (let j = 0; j < 2; j++) put(T.u0 + 3 + k, T.slab + 2, 16 + j, 'vx_dome_white');
    put(T.u0 + 1, T.slab + 2, T.v0 + 1, 'vx_tech_planter'); put(T.u1 - 1, T.slab + 2, T.v1 - 1, 'vx_tech_planter');
    // the ground floor's terrace: planters at its corners, blossom bushes, loungers
    const ty = G.slab + 2;
    put(gS[0] + 1, ty, gS[1] + 1, 'vx_tech_planter'); put(gS[2] - 1, ty, gS[1] + 1, 'vx_tech_planter');
    model(gS[0] + 3, ty, gS[1] + 1, 'vm_bush_blossom', 0); model(gS[2] - 3, ty, gS[1] + 1, 'vm_bush_blossom', 0);
    model(10, ty, gS[1] + 1, 'vm_lounger', 0); model(14, ty, gS[1] + 1, 'vm_lounger', 0);
    info.roofTop = F + T.slab + 4;
    yield;

    // ---- the garden
    // the house's footprint at the ground (the walls, the box bays standing out of them): no lawn there
    const houseAt = (u, v) => (u >= G.u0 && u <= G.u1 && v >= G.v0 && v <= G.v1) || (v === G.v0 - 1 && ((u >= 3 && u <= 7) || (u >= 17 && u <= 21) || Math.abs(u - EU) <= 2)) || ((u === G.u0 - 1 || u === G.u1 + 1) && v >= 12 && v <= 16);
    const paved = new Set(); const isPath = (u, v) => paved.has(u + ',' + v);
    const lawnAt = (u, v) => u >= 0 && u < W && v >= 0 && v < D && !isPath(u, v) && !houseAt(u, v);
    // a band of paving along a quadratic curve (a → b → c), the cells within r of the centre line
    const band = (a, b, c, r) => {
      for (let t = 0; t <= 1.0001; t += 0.01) {
        const q = 1 - t, cu = q * q * a[0] + 2 * q * t * b[0] + t * t * c[0], cv = q * q * a[1] + 2 * q * t * b[1] + t * t * c[1];
        for (let v = Math.floor(cv - r - 1); v <= Math.ceil(cv + r + 1); v++) for (let u = Math.floor(cu - r - 1); u <= Math.ceil(cu + r + 1); u++) if (v >= 0 && v < D && u >= 0 && u < W && Math.hypot(u + 0.5 - cu, v + 0.5 - cv) <= r) paved.add(u + ',' + v);
      }
    };
    const disc = (cu, cv, r) => { for (let v = Math.floor(cv - r); v <= Math.ceil(cv + r); v++) for (let u = Math.floor(cu - r); u <= Math.ceil(cu + r); u++) if (Math.hypot(u + 0.5 - cu, v + 0.5 - cv) <= r) paved.add(u + ',' + v); };
    // the light lines: a paved cell that touches the lawn across a side is a line cell; where two line cells meet only at
    // a corner, the paved cell in that corner joins them (the line piece joins across sides only — run 1 showed dashes and
    // dots), so every edge is one unbroken chain of straights and quarter arcs
    const lines = () => {
      const line = new Set(), key = (u, v) => u + ',' + v;
      for (const k of paved) { const [u, v] = k.split(',').map(Number); if (lawnAt(u + 1, v) || lawnAt(u - 1, v) || lawnAt(u, v + 1) || lawnAt(u, v - 1)) line.add(k); }
      for (let pass = 0; pass < 3; pass++) {
        let added = 0;
        for (const k of [...line]) {
          const [u, v] = k.split(',').map(Number);
          for (const [du, dv] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
            if (!line.has(key(u + du, v + dv)) || line.has(key(u + du, v)) || line.has(key(u, v + dv))) continue;
            const c = isPath(u + du, v) ? key(u + du, v) : isPath(u, v + dv) ? key(u, v + dv) : null;
            if (c) { line.add(c); added++; }
          }
        }
        if (!added) break;
      }
      return line;
    };
    // the front: the curved path from the street (u 5–8) to the paved apron in front of the entrance, four wide
    band([6.5, -1], [6.5, 4], [EU + 0.5, 3], 2.05);
    for (let v = G.v0 - 3; v <= G.v0 - 1; v++) for (let u = EU - 3; u <= EU + 3; u++) if (!houseAt(u, v)) paved.add(u + ',' + v);
    // the back (t1_29 through the glass): a paved terrace two rows deep along the glass wall, the path from the garden
    // door straight back to a round patio with a palm in the middle
    for (let v = G.v1 + 1; v <= G.v1 + 2; v++) for (let u = G.u0; u <= G.u1; u++) paved.add(u + ',' + v);
    const PAT = [EU + 0.5, G.v1 + 7.5];
    band([EU + 0.5, G.v1 + 2], [EU + 0.5, G.v1 + 4], PAT, 1.55); disc(PAT[0], PAT[1], 2.3);
    const lineSet = lines();
    for (const k of paved) { const [u, v] = k.split(',').map(Number); put(u, yard, v, lineSet.has(k) ? M.line : M.path); }
    // the lawns: grass tufts here and there, flower clusters along the paths' edges (every third lawn cell beside a line);
    // everything placed later (hedges, beds, mounds, trees) takes its cell over
    const hsh = (u, v) => { let h = Math.imul(u * 374761393 + v * 668265263, 1274126177); h ^= h >>> 15; return (h >>> 0) % 6; };
    for (let v = 1; v < D - 1; v++) for (let u = 1; u < W - 1; u++) {
      if (!lawnAt(u, v)) continue;
      const byLine = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([du, dv]) => lineSet.has((u + du) + ',' + (v + dv)));
      if (byLine && (u + 2 * v) % 3 === 0) model(u, 0, v, 'vm_flower_cluster', 0);
      else if (!byLine && hsh(u, v) === 0) model(u, 0, v, 'vm_tuft_grass', 0);
    }
    // hedges: along the street (with the path's gap), along both sides and the back
    for (let u = 0; u < W; u++) if (!isPath(u, 0)) put(u, 0, 0, M.hedge);
    for (let v = 1; v < D; v++) { put(0, 0, v, M.hedge); put(W - 1, 0, v, M.hedge); }
    for (let u = 1; u < W - 1; u++) put(u, 0, D - 1, M.hedge);
    // clipped light-green balls by the entrance (t1_26), a round tree on the lawn, flowers and ferns along the facade
    for (const u of [EU - 5, EU + 5]) put(u, 0, G.v0 - 3, 'vx_bush_light');
    model(17, 0, 1, 'vm_tree_round_s', 0);
    for (let u = G.u0; u <= G.u1; u++) {
      if (isPath(u, G.v0 - 2) || isPath(u, G.v0 - 1)) continue;
      const inBay = (u >= 3 && u <= 7) || (u >= 17 && u <= 21);
      const v = inBay ? G.v0 - 2 : G.v0 - 1;
      if (u & 1) model(u, 0, v, 'vm_flower_cluster', 0); else put(u, 0, v, 'vx_fern_lush');
    }
    // planters flanking the door
    for (const u of [EU - 3, EU + 3]) put(u, 0, G.v0 - 2, 'vx_tech_planter');
    // palms: the shared crown on a ringed trunk (VR.Plants.palm), the trunk from the ground at y0
    // (the crown's 7 × 7 by its corner, so it stands centred on the trunk: its part 0 is not the corner of its grid)
    const palm = (u, v, h, y0) => { y0 = y0 | 0; for (let k = 0; k < h; k++) put(u, y0 + k, v, 'vx_palm_trunk'); modelAt(u - 3, y0 + h, v - 3, 'vm_palm_crown', 0); };
    // (the front palms' crowns stay inside the lot: 7 × 7 round the trunk, above the terrace's balusters)
    palm(3, 3, 12); palm(21, 3, 11);
    // the back garden: two green mounds left and right (the hills behind the glass in t1_29), a palm on each, the palm in
    // the patio in a planter, round trees and blossom bushes, loungers on the lawn
    // (green all over: the body is moss, and grass only on a top whose four sides are covered — a grass block's side
    //  is dirt, and on the steps' edges it read as brown cliffs)
    // vgen 9 (t-beauty): a smooth hill — the dome's steps at most one block between neighbours (the cells relaxed from
    // the rim inward) and grass on every top, so the Nahtlos look draws one soft green slope; vgen 8's steps of two to
    // four read from the garden as dark stepped boxes of moss
    const soft = !!(o && o.vgen >= 9);
    // (soft: the cells the garden's bushes, flowers and round trees take over afterwards stay out of the hill — a bush set
    //  into a mound's flank left a step of two beside it)
    const keepOut = new Set();
    if (soft) { for (const [u, v] of [[7, G.v1 + 4], [17, G.v1 + 4], [9, G.v1 + 9], [15, G.v1 + 9], [10, G.v1 + 4], [14, G.v1 + 4]]) keepOut.add(u + ',' + v); for (const u of [9, 15]) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) keepOut.add((u + a) + ',' + (G.v1 + 6 + b)); }
    const mound = (cu, cv, ru, rv, h) => {
      const top = {}, at = (u, v) => top[u + ',' + v] | 0;
      for (let v = Math.floor(cv - rv); v <= Math.ceil(cv + rv); v++) for (let u = Math.floor(cu - ru); u <= Math.ceil(cu + ru); u++) {
        if (u < 1 || u >= W - 1 || v <= G.v1 + 2 || v >= D - 1 || isPath(u, v) || keepOut.has(u + ',' + v)) continue;
        const d = Math.hypot((u + 0.5 - cu) / ru, (v + 0.5 - cv) / rv); if (d >= 1) continue;
        const hh = Math.round(h * Math.sqrt(1 - d * d)); if (hh >= 1) top[u + ',' + v] = hh;
      }
      if (soft) for (let pass = 0; pass < 8; pass++) {
        let changed = false;
        for (const k in top) { const [u, v] = k.split(',').map(Number); const lo = Math.min(at(u + 1, v), at(u - 1, v), at(u, v + 1), at(u, v - 1)); if (top[k] > lo + 1) { top[k] = lo + 1; changed = true; } }
        if (!changed) break;
      }
      for (const k in top) {
        const [u, v] = k.split(',').map(Number), hh = top[k];
        for (let y = 0; y < hh - 1; y++) put(u, y, v, 'moss_block');
        const covered = at(u + 1, v) >= hh && at(u - 1, v) >= hh && at(u, v + 1) >= hh && at(u, v - 1) >= hh;
        put(u, hh - 1, v, soft || covered ? 'grass_block' : 'moss_block');
      }
      return at;
    };
    const mL = mound(4.2, G.v1 + 6.5, 4.8, 4.0, 4.6), mR = mound(20.8, G.v1 + 6.5, 4.8, 4.0, 4.6);
    palm(4, G.v1 + 6, 10, mL(4, G.v1 + 6)); palm(20, G.v1 + 7, 11, mR(20, G.v1 + 7));
    for (const u of [9, 15]) model(u, 0, G.v1 + 6, 'vm_tree_round_s', 0);
    const qu = Math.floor(PAT[0]), qv = Math.floor(PAT[1]);
    put(qu, 0, qv, 'vx_tech_planter'); palm(qu, qv, 10, 1);
    for (const [u, v] of [[7, G.v1 + 4], [17, G.v1 + 4]]) model(u, 0, v, 'vm_bush_blossom', 0);
    for (const [u, v] of [[9, G.v1 + 9], [15, G.v1 + 9], [10, G.v1 + 4], [14, G.v1 + 4]]) model(u, 0, v, 'vm_flower_cluster', 0);
    for (const u of [9, 15]) model(u, 0, G.v1 + 3, 'vm_lounger', 0);
    yield;

    // ---- the plan record (house-local rooms for the villa tests and the Studio's room list)
    const H = PLAN.templates.trailer(o);
    H.u0 = G.u0; H.v0 = G.v0; H.u1 = H.u0 + H.w - 1; H.v1 = H.v0 + H.d - 1; H.mirrored = false;
    for (const fl of H.floors) for (const r of fl.rooms) { r.doors = r.doors || []; r.windows = r.windows || []; }
    H.floors[0].rooms[0].doors.push({ u: EU - G.u0, v: PV - G.v0 - 1, side: 2 }); H.floors[0].rooms[1].doors.push({ u: EU - G.u0, v: PV - G.v0 + 1, side: 0 });
    info.plan = H;
    return info;
  };
  PLAN.buildNovaClassic = buildClassic;

  // ================================================================ THE FAMILY
  // A composition: the storeys G (ground), U (first), T (top) as rectangles (G may carry extra rectangles, ext: the
  // L of the corner villa), each slab's overhang [front, sides, back], the entry, the hall (the partition row, the
  // pad, the floating stairs from the hall to the first floor, the stair to the top box), the facades (a function of
  // the builder's operations), the furniture upstairs, the roof garden and the garden. Lot-local, the street at v 0.
  const FAM = PLAN.NOVA_FAMILY = {};
  const NOVA = PLAN.NOVA;
  FAM.classic = { name: 'classic', classic: true, G: NOVA.G, U: NOVA.U, T: NOVA.T, OVER: NOVA.OVER, EU: NOVA.ENTRY, PS: 6.5 };
  FAM.long = {
    name: 'long', EU: 12, PS: 6.5,
    G: { u0: 2, v0: 7, u1: 22, v1: 18, y: 0, clear: 5, slab: 6 },
    U: { u0: 4, v0: 10, u1: 20, v1: 18, y: 7, clear: 4, slab: 12 },
    T: null, OVER: { G: [2, 1, 1], U: [1, 1, 1] },
    hall: { PV: 11, PAD: [11, 13], STAIRS: [{ u: 4, du: 1 }, { u: 20, du: -1 }], STAIR_V: 16 },
    facade(f, G, U) {
      f.entry(G, 12);
      // the long glass band across the ground floor, both sides of the entry box, the hall seen through it
      f.band(0, 3, 9, 2, 4, G.v0); f.band(0, 15, 21, 2, 4, G.v0);
      f.bay(G, 1, 10, 14, 1, 5, 11, 13, 2, 4); f.bay(G, 3, 10, 14, 1, 5, 11, 13, 2, 4);
      // the first floor: a box hanging over the terrace at the left, a glass band at the right, the terrace door between
      f.bay(U, 0, 5, 9, U.y + 2, U.y + 4, 6, 8, U.y + 3, U.y + 4, { hang: true, depth: 2 });
      f.terraceDoor(U, 12);
      f.band(0, 14, 19, U.y + 2, U.y + 3, U.v0, true);
      f.band(3, 12, 16, U.y + 2, U.y + 3, U.u0, true); f.band(1, 12, 16, U.y + 2, U.y + 3, U.u1, true);
      f.band(2, 6, 9, U.y + 2, U.y + 3, U.v1, true); f.band(2, 15, 18, U.y + 2, U.y + 3, U.v1, true);
    },
    upper: { bed: [5, 12], sofas: { v: 11, us: [7, 8, 9, 15, 16, 17], f: 2 }, planters: [[19, 11], [19, 14]] },
    roof: { on: 'U', rect: [5, 11, 19, 17], tree: [6, 12], bushes: [[18, 11], [18, 17], [12, 17]], loungers: [[13, 11], [15, 11]], dome: null },
    garden: { palms: [[21, 3, 11]], patio: true },
  };
  FAM.tower = {
    name: 'tower', EU: 12, PS: 6.5,
    G: { u0: 4, v0: 7, u1: 20, v1: 20, y: 0, clear: 5, slab: 6 },
    U: { u0: 4, v0: 10, u1: 18, v1: 20, y: 7, clear: 5, slab: 13 },
    T: { u0: 4, v0: 13, u1: 12, v1: 20, y: 14, clear: 5, slab: 20 },
    OVER: { G: [2, 1, 1], U: [1, 1, 1], T: [1, 1, 1] },
    hall: { PV: 11, PAD: [14, 14], STAIRS: [{ u: 6, du: 1 }], STAIR_V: 18, STAIR2: { u: 6, v: 12 } },
    facade(f, G, U, T) {
      f.entry(G, 12);
      f.bay(G, 0, 5, 8, 1, 5, 6, 7, 2, 4); f.bay(G, 0, 16, 19, 1, 5, 17, 18, 2, 4);
      f.bay(G, 1, 11, 15, 1, 5, 12, 14, 2, 4); f.band(3, 11, 15, 2, 4, G.u0);
      // the first floor: a box over the terrace, the terrace door, a box hanging out on the right over the low roof
      f.bay(U, 0, 5, 10, U.y + 2, U.y + 4, 6, 9, U.y + 3, U.y + 4, { hang: true, depth: 2 });
      f.terraceDoor(U, 14);
      f.bay(U, 1, 13, 17, U.y + 2, U.y + 4, 14, 16, U.y + 3, U.y + 4, { hang: true, depth: 2 });
      f.band(3, 12, 17, U.y + 2, U.y + 3, U.u0, true); f.band(2, 6, 9, U.y + 2, U.y + 3, U.v1, true); f.band(2, 13, 16, U.y + 2, U.y + 3, U.v1, true);
      // the top box: one glazed front in one orange frame with its door, windows round it
      f.band(0, T.u0 + 1, T.u1 - 1, T.y + 1, T.y + 3, T.v0, true); f.door(0, T.u0 + 4, T.y + 1, T.v0);
      f.band(1, 15, 18, T.y + 1, T.y + 3, T.u1, true); f.band(3, 15, 17, T.y + 2, T.y + 3, T.u0, true); f.band(2, T.u0 + 2, T.u1 - 2, T.y + 2, T.y + 3, T.v1, true);
    },
    upper: { bed: [14, 15], sofas: { v: 11, us: [9, 10, 16, 17], f: 2 }, planters: [[17, 19]], top: { sofas: { v: 19, us: [8, 9, 10, 11], f: 0 }, planters: [[5, 19], [11, 14]] } },
    roof: { on: 'U', rect: [14, 12, 18, 19], tree: [14, 13], bushes: [[18, 12], [18, 19]], loungers: [], dome: [7, 16] },
    garden: { palms: [[21, 3, 12]], patio: true },
  };
  FAM.corner = {
    name: 'corner', EU: 16, PS: 18.5,
    G: { u0: 2, v0: 11, u1: 22, v1: 21, y: 0, clear: 5, slab: 6, ext: [[2, 6, 10, 10]] },
    U: { u0: 12, v0: 13, u1: 21, v1: 21, y: 7, clear: 4, slab: 12 },
    T: { u0: 14, v0: 16, u1: 20, v1: 21, y: 13, clear: 4, slab: 18 },
    OVER: { G: [2, 1, 1], U: [1, 1, 1], T: [1, 1, 1] },
    hall: { PV: null, PAD: [6, 15], STAIRS: [{ u: 20, du: -1 }], STAIR_V: 19, STAIR2: { u: 17, v: 15 } },
    facade(f, G, U, T) {
      const WING = { u0: 2, v0: 6, u1: 10, v1: 10, isG: true };
      f.entry(G, 16);
      // the box bay wrapping the wing's front-left corner: two blocks out at the front, one at the side, a window on each face
      f.bay(WING, 0, 1, 6, 1, 5, 2, 4, 2, 4, { depth: 2 }); f.bay(WING, 3, 4, 9, 1, 5, 6, 8, 2, 4, { depth: 1 });
      f.band(1, 7, 9, 2, 4, WING.u1);                     // the wing's side to the entry court
      f.bay(G, 0, 19, 22, 1, 5, 20, 21, 2, 4);
      f.bay(G, 3, 14, 18, 1, 5, 15, 17, 2, 4); f.bay(G, 1, 13, 17, 1, 5, 14, 16, 2, 4);
      f.bay(U, 0, 13, 17, U.y + 2, U.y + 4, 14, 16, U.y + 3, U.y + 4, { hang: true, depth: 2 });
      f.terraceDoor(U, 19);
      f.band(3, 15, 19, U.y + 2, U.y + 3, U.u0, true); f.band(2, 13, 15, U.y + 2, U.y + 3, U.v1, true);
      f.band(0, T.u0 + 1, T.u1 - 1, T.y + 1, T.y + 3, T.v0, true); f.door(0, T.u0 + 1, T.y + 1, T.v0);
      f.band(1, 17, 20, T.y + 2, T.y + 3, T.u1, true);
    },
    upper: { bed: [13, 15], sofas: { v: 14, us: [15, 16], f: 0 }, planters: [[20, 14]], top: { sofas: { v: 20, us: [15, 16], f: 0 }, planters: [[19, 17]] } },
    roof: { on: 'G', rect: [3, 7, 10, 19], tree: [4, 7], bushes: [[9, 7], [3, 18], [10, 18]], loungers: [[5, 14], [7, 14]], dome: [17, 18] },
    garden: { palms: [[3, 3, 11]], patio: false },
  };
  FAM.bungalow = {
    name: 'bungalow', EU: 9, PS: 6.5,
    G: { u0: 2, v0: 8, u1: 22, v1: 20, y: 0, clear: 5, slab: 6 },
    U: { u0: 15, v0: 13, u1: 21, v1: 20, y: 7, clear: 4, slab: 12 },
    T: null, OVER: { G: [2, 1, 1], U: [1, 1, 1] },
    hall: { PV: null, PAD: [5, 12], STAIRS: [{ u: 10, du: 1 }], STAIR_V: 17 },
    facade(f, G, U) {
      // the glass front: one band of turquoise glass in its orange frame across the whole front, the door set in it
      f.glassFront(G, 3, 21, 9);
      f.bay(G, 1, 11, 15, 1, 5, 12, 14, 2, 4); f.bay(G, 3, 11, 15, 1, 5, 12, 14, 2, 4);
      // the pavilion on the roof: glazed to the roof garden, its door in the glass
      f.band(0, U.u0 + 1, U.u1 - 1, U.y + 1, U.y + 3, U.v0, true); f.door(0, U.u0 + 2, U.y + 1, U.v0);
      f.band(3, 15, 18, U.y + 2, U.y + 3, U.u0, true); f.band(2, 16, 20, U.y + 2, U.y + 3, U.v1, true);
    },
    upper: { bed: [18, 15], sofas: { v: 19, us: [17, 18], f: 0 }, planters: [[20, 14]] },
    roof: { on: 'G', rect: [3, 9, 13, 19], tree: [6, 12], bushes: [[3, 9], [13, 9], [3, 19]], loungers: [[9, 9], [11, 9]], dome: [18, 16] },
    garden: { palms: [[21, 3, 11]], patio: true },
  };
  PLAN.NOVA_COMPS = Object.keys(FAM);

  // ---------------------------------------------------------------- the builder of a composition
  const buildComp = function* (L, lot, o, C) {
    const P = L.P, F = lot.F;
    const S = (PLAN.SKINS && PLAN.SKINS.nova) || {};
    const M = Object.assign({
      wall: 'vollton_stone_grey', bay: 'vollton_light_grey', plinth: 'vollton_mid_grey', fascia: 'vx_nova_band', ceiling: 'vollton_white',
      floor: 'vollton_white_gloss', inner: 'vollton_white', terrace: 'vx_floor_plaza', rail: 'vx_balustrade', win: 'vx_nova_window', glass: 'panorama_white',
      mullion: 'vx_beam_white', base: 'vx_led_strip', door: 'door_glass_white', path: 'vx_floor_plaza', line: 'vx_floor_plaza_line',
      hedge: 'vx_hedge', partition: 'vx_nova_glass', sheet: 'vx_nova_glass', spot: 'vx_spot', glassRail: 'vx_tech_railing',
    }, S);
    const VM = VR.VM, W = lot.w, D = lot.d, G = Object.assign({ isG: true }, C.G), U = C.U ? Object.assign({}, C.U) : null, T = C.T ? Object.assign({}, C.T) : null;
    const OVER = C.OVER, EU = C.EU, HALL = C.hall;
    const put = (u, y, v, name, pr) => P(u, F + y, v, name, pr);
    const model = (u, y, v, name, f) => { if (VM && VM.MODELS[name]) VM.put((uu, yy, vv, n, pr) => P(uu, yy, vv, n, pr), u, F + y, v, name, f || 0); };
    const modelAt = (u, y, v, name, f) => {
      const m = VM && VM.MODELS[name]; if (!m) return;
      const fp = VM.footprint(m, f || 0); let du = 0, dv = 0;
      for (const c of fp) { du = Math.min(du, c[0]); dv = Math.min(dv, c[2]); }
      model(u - du, y, v - dv, name, f);
    };
    // rectangles: a storey's main rectangle and its extra ones; a cell's ring = inside with a side outside
    const rectsOf = (R) => [[R.u0, R.v0, R.u1, R.v1]].concat(R.ext || []);
    const inRs = (rs, u, v) => { for (const r of rs) if (u >= r[0] && u <= r[2] && v >= r[1] && v <= r[3]) return true; return false; };
    const bbox = (rs) => { let a0 = 1e9, b0 = 1e9, a1 = -1e9, b1 = -1e9; for (const r of rs) { a0 = Math.min(a0, r[0]); b0 = Math.min(b0, r[1]); a1 = Math.max(a1, r[2]); b1 = Math.max(b1, r[3]); } return [a0, b0, a1, b1]; };
    const ringOf = (rs, u, v) => inRs(rs, u, v) && (!inRs(rs, u + 1, v) || !inRs(rs, u - 1, v) || !inRs(rs, u, v + 1) || !inRs(rs, u, v - 1));
    const GR = rectsOf(G), UR = U ? rectsOf(U) : null, TR = T ? rectsOf(T) : null;
    const TOP = T || U || G;
    const info = { beds: [], seats: [], work: [], door: null, outside: null, inside: null, chimney: null, table: null, lights: [], roofTop: F + 22, skin: 'nova', family: 'trailer', cars: [], desks: [], comp: C.name, bays: [], slabs: [], house: bbox(GR) };
    const foot = new Set();   // the cells the house stands on at the ground (walls, bays on the ground, the entry box)
    for (let v = info.house[1]; v <= info.house[3]; v++) for (let u = info.house[0]; u <= info.house[2]; u++) if (inRs(GR, u, v)) foot.add(u + ',' + v);

    // ---- the ground under the lot: lawn at the yard level (F − 1), the house on a stone footing
    const yard = -1;
    for (let v = 0; v < D; v++) for (let u = 0; u < W; u++) {
      const gy = o.ground ? o.ground(u, v) - F : yard, inG = inRs(GR, u, v);
      for (let y = Math.min(gy, yard) - 2; y < yard; y++) put(u, y, v, inG ? 'concrete_smooth' : 'dirt');
      put(u, yard, v, inG ? 'concrete_smooth' : 'grass_block');
      for (let y = yard + 1; y <= 26; y++) put(u, y, v, null);
    }
    yield;

    // ---- the storeys: floor, walls (a plinth course at the ground), the inside air
    const storey = (R, rs, isG) => {
      const [a0, b0, a1, b1] = bbox(rs), y0 = R.y, yTop = R.y + R.clear;
      for (let v = b0; v <= b1; v++) for (let u = a0; u <= a1; u++) {
        if (!inRs(rs, u, v)) continue;
        const ring = ringOf(rs, u, v);
        if (isG) put(u, y0, v, ring ? M.plinth : M.floor);
        for (let y = y0 + 1; y <= yTop; y++) put(u, y, v, ring ? M.wall : null);
      }
    };
    storey(G, GR, true); if (U) storey(U, UR, false); if (T) storey(T, TR, false);
    // the ground floor's walls are two thick: grey stone outside, a white lining inside; the back is glass
    {
      const [a0, b0, a1, b1] = bbox(GR);
      for (let v = b0; v <= b1; v++) for (let u = a0; u <= a1; u++) {
        if (!inRs(GR, u, v) || ringOf(GR, u, v)) continue;
        let lin = false;
        for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = u + du, b = v + dv; if (ringOf(GR, a, b) && !(b === G.v1 && a > G.u0 && a < G.u1)) lin = true; }
        if (lin) for (let y = 1; y <= G.clear; y++) put(u, y, v, M.inner);
      }
    }
    // ---- the slab zones: two blocks thick, the storey's footprint plus its overhang; the fascia ring (vx_nova_band) with
    //      the cyan line in its lower row and the orange glow under its edge; inside: the ceiling and the floor above
    const zoneOf = (R, ov) => rectsOf(R).map(r => [r[0] - ov[1], r[1] - ov[0], r[2] + ov[1], r[3] + ov[2]]);
    const slab = (R, ov, above, ars) => {
      const zs = zoneOf(R, ov), [a0, b0, a1, b1] = bbox(zs), y = R.slab, ring = [];
      for (let v = b0; v <= b1; v++) for (let u = a0; u <= a1; u++) {
        if (!inRs(zs, u, v)) continue;
        if (ringOf(zs, u, v)) { put(u, y, v, M.fascia, { glow: 3 }); put(u, y + 1, v, M.fascia, { glow: 0 }); ring.push([u, v]); continue; }
        const inA = above && inRs(ars, u, v) && !ringOf(ars, u, v), wallA = above && ringOf(ars, u, v);
        put(u, y, v, M.ceiling);
        put(u, y + 1, v, inA ? M.floor : wallA ? M.plinth : M.terrace);
      }
      info.slabs.push({ y, cells: ring });
      return zs;
    };
    const gS = slab(G, OVER.G, U, UR), uS = U ? slab(U, OVER.U, T, TR) : null, tS = T ? slab(T, OVER.T, null, null) : null;
    yield;

    // ---- terraces: balusters on every slab edge with open sky above; none where the storey above stands, nor behind
    //      its flush back wall
    const railRing = (zs, y, R, rs) => {
      const [a0, b0, a1, b1] = bbox(zs), rb = rs ? bbox(rs) : null;
      for (let v = b0; v <= b1; v++) for (let u = a0; u <= a1; u++) {
        if (!ringOf(zs, u, v)) continue;
        if (rs && (inRs(rs, u, v) || (v > rb[3] && u >= rb[0] && u <= rb[2]))) continue;
        put(u, y, v, M.rail);
      }
    };
    railRing(gS, G.slab + 2, U, UR); if (U) railRing(uS, U.slab + 2, T, TR); if (T) railRing(tS, T.slab + 2, null, null);
    yield;

    // ---- the facades: the operations a composition calls (s: 0 front −v, 1 +u, 2 back +v, 3 −u; fixed: the wall plane)
    const FACE = [0, 1, 2, 3];
    // (the openings of every side, for vgen 9's blank-wall pass below: "side|along|row" of a window, a door or a bay)
    const opened = new Set(), mark = (s, a, y) => opened.add(s + '|' + a + '|' + y);
    const win = (s, a0, a1, y0, y1, fixed) => { for (let a = a0; a <= a1; a++) for (let y = y0; y <= y1; y++) { put((s & 1) ? fixed : a, y, (s & 1) ? a : fixed, M.win, { facing: FACE[s] }); mark(s, a, y); } };
    const lintel = (s, a0, a1, y, fixed) => { for (let a = a0; a <= a1; a++) put((s & 1) ? fixed : a, y, (s & 1) ? a : fixed, M.fascia, { glow: 2 }); };
    // the cells behind a window open into the room (the ground floor's white lining too)
    const openBehind = (s, a0, a1, y0, y1, fixed, deep) => { const inw = s === 0 ? 1 : s === 2 ? -1 : s === 1 ? -1 : 1; for (let a = a0; a <= a1; a++) for (let y = y0; y <= y1; y++) for (let k = 1; k <= deep; k++) put((s & 1) ? fixed + inw * k : a, y, (s & 1) ? a : fixed + inw * k, null); };
    const bay = (R, s, a0, a1, y0, y1, w0, w1, wy0, wy1, o2) => {
      o2 = o2 || {};
      const dep = o2.depth || 1, outK = (k) => (s === 0 ? R.v0 - k : s === 2 ? R.v1 + k : s === 1 ? R.u1 + k : R.u0 - k);
      const out = outK(dep), fr = s === 0 ? out - 1 : s === 2 ? out + 1 : s === 1 ? out + 1 : out - 1;
      for (let k = 1; k <= dep; k++) for (let a = a0; a <= a1; a++) {
        const oo = outK(k), u = (s & 1) ? oo : a, v = (s & 1) ? a : oo;
        if (R.isG && !o2.hang) { put(u, 0, v, M.plinth); foot.add(u + ',' + v); }
        for (let y = y0; y <= y1; y++) { put(u, y, v, M.bay); mark(s, a, y); }
        if (o2.hang) put(u, y0, v, M.fascia, { glow: 2 });
        else if (k === dep) { const fu = (s & 1) ? fr : a, fv = (s & 1) ? a : fr; put(fu, y0, fv, M.base, { facing: (s + 2) & 3 }); }
      }
      if (w1 >= w0) {
        win(s, w0, w1, wy0, wy1, out);
        if (wy1 < y1) lintel(s, w0, w1, wy1 + 1, out);
        for (let a = w0; a <= w1; a++) for (let y = wy0; y <= wy1; y++) {
          for (let k = 1; k < dep; k++) { const oo = outK(k); put((s & 1) ? oo : a, y, (s & 1) ? a : oo, null); }
          for (let k = 0; k <= (R.isG ? 1 : 0); k++) {
            const u = (s & 1) ? (s === 1 ? R.u1 - k : R.u0 + k) : a, v = (s & 1) ? a : (s === 0 ? R.v0 + k : R.v1 - k);
            put(u, y, v, null);
          }
        }
        info.bays.push({ side: s, a0: w0, a1: w1, out, y0: wy0, y1: wy1 });
      }
    };
    const door = (s, u, y, v, hinge) => { put(u, y, v, M.door, { facing: s, half: 0, hinge: hinge | 0, open: 0 }); put(u, y + 1, v, M.door, { facing: s, half: 1, hinge: hinge | 0, open: 0 }); mark(s, (s & 1) ? v : u, y); mark(s, (s & 1) ? v : u, y + 1); };
    const F_ = {
      bay, win, lintel, door,
      // a window band in the wall plane with its lintel; upper storeys' walls are one thick, the ground floor's two
      band(s, a0, a1, y0, y1, fixed, upper) { win(s, a0, a1, y0, y1, fixed); lintel(s, a0, a1, y1 + 1, fixed); if (!upper) openBehind(s, a0, a1, y0, y1, fixed, 1); },
      // the entry: a box standing out of the front with a tall glass door in a glazed screen (side lights, a transom:
      // one orange frame round all of it), a lintel over it, a step and a vestibule through the wall behind
      entry(R, eu) {
        bay(R, 0, eu - 2, eu + 2, 1, 5, 0, -1, 0, -1);
        const EV = R.v0 - 1;
        win(0, eu - 1, eu - 1, 1, 4, EV); win(0, eu + 1, eu + 1, 1, 4, EV); win(0, eu, eu, 3, 4, EV); lintel(0, eu - 1, eu + 1, 5, EV);
        door(0, eu, 1, EV);
        put(eu, 0, EV - 1, M.plinth + '_stairs', { facing: 2, half: 0 }); put(eu, 1, EV - 1, null);
        for (let v = R.v0; v <= R.v0 + 1; v++) for (let u = eu - 1; u <= eu + 1; u++) for (let y = 1; y <= 4; y++) put(u, y, v, null);
        info.door = [eu, F + 1, EV]; info.outside = [eu, F, EV - 3]; info.inside = [eu, F + 1, R.v0 + 2]; info.entryV = EV;
        info.bays.push({ side: 0, a0: eu - 1, a1: eu + 1, out: EV, y0: 1, y1: 4 });   // the glazed screen is the entry box's window
      },
      // the bungalow's glass front: the whole front glazed floor to lintel, the door set into the glass
      glassFront(R, a0, a1, eu) {
        win(0, a0, a1, 1, 4, R.v0); lintel(0, a0, a1, 5, R.v0); openBehind(0, a0, a1, 1, 4, R.v0, 1);
        door(0, eu, 1, R.v0);
        put(eu, 0, R.v0 - 1, M.plinth + '_stairs', { facing: 2, half: 0 }); put(eu, 1, R.v0 - 1, null);
        info.door = [eu, F + 1, R.v0]; info.outside = [eu, F, R.v0 - 3]; info.inside = [eu, F + 1, R.v0 + 2]; info.entryV = R.v0;
      },
      // a glass door to a terrace with side lights and a lintel (the classic's first floor)
      terraceDoor(R, u) { door(0, u, R.y + 1, R.v0); win(0, u - 1, u - 1, R.y + 1, R.y + 3, R.v0); win(0, u + 1, u + 1, R.y + 1, R.y + 3, R.v0); win(0, u, u, R.y + 3, R.y + 3, R.v0); lintel(0, u - 1, u + 1, R.y + 4, R.v0); },
    };
    C.facade(F_, G, U, T);
    yield;

    // ---- the glass wall to the back garden (the hall): one clear sheet floor to ceiling with a slim mullion every five
    //      blocks, the garden door in the middle
    for (let u = G.u0 + 2; u <= G.u1 - 2; u++) for (let y = 1; y <= G.clear; y++) { put(u, y, G.v1, M.sheet, { facing: 0, post: (u - 2) % 5 === 0 ? 1 : 0 }); mark(2, u, y); }
    for (let y = 1; y <= G.clear; y++) { put(G.u0 + 1, y, G.v1, M.wall); put(G.u1 - 1, y, G.v1, M.wall); }
    door(2, EU, 1, G.v1, 1);
    // ---- vgen 9 (t-beauty): no blank wall. Along every side of every storey, a run of plain wall longer than four
    //      blocks at the window rows gets a window band of two or three in its middle with its lintel, again until none
    //      is left (vgen 8: the corner villa showed its neighbour a nine-block grey first floor and a top box blank at the
    //      back and one side, the bungalow's pavilion a blank side, the long villa's first floor and the tower house's
    //      ground floor runs of five); the family as vgen 8 built it keeps every wall
    if (o && o.vgen >= 9) {
      for (const [R, rs, isG] of [[G, GR, true], [U, UR, false], [T, TR, false]]) {
        if (!R) continue;
        const rows = isG ? [2, 3, 4] : [R.y + 2, R.y + 3];
        for (const s of FACE) {
          const fixed = s === 0 ? R.v0 : s === 2 ? R.v1 : s === 1 ? R.u1 : R.u0, lo = (s & 1) ? R.v0 : R.u0, hi = (s & 1) ? R.v1 : R.u1;
          // (a run counts the corner blocks too — a side six blocks long with no window reads blank — but a window never
          //  takes a corner)
          const blank = (a) => { const u = (s & 1) ? fixed : a, v = (s & 1) ? a : fixed; if (a < lo || a > hi || !ringOf(rs, u, v)) return false; for (const y of rows) if (opened.has(s + '|' + a + '|' + y)) return false; return true; };
          for (let guard = 0; guard < 4; guard++) {
            let best = null;
            for (let a = lo, run = 0; a <= hi; a++) { if (blank(a)) { run++; if (run > 4 && (!best || run > best[1])) best = [a - run + 1, run]; } else run = 0; }
            if (!best) break;
            const w = best[1] >= 7 ? 3 : 2, a0 = Math.max(lo + 1, Math.min(hi - w, best[0] + ((best[1] - w) >> 1)));
            F_.band(s, a0, a0 + w - 1, rows[0], rows[rows.length - 1], fixed, !isG);
          }
        }
      }
    }
    yield;

    // ---- the hall: the cove over the pad, spots, the partition, the pad with its ring of light, benches, plants
    const PV = HALL.PV, SV0 = HALL.STAIR_V, [pu, pv] = HALL.PAD;
    const interiorG = (u, v) => inRs(GR, u, v) && !ringOf(GR, u, v);
    const cu0 = pu - 2, cu1 = pu + 4, cv0 = pv - 1, cv1 = pv + 2;
    for (let v = cv0 - 1; v <= cv1 + 1; v++) for (let u = cu0 - 1; u <= cu1 + 1; u++) {
      if (!interiorG(u, v)) continue;
      const inner = u >= cu0 && u <= cu1 && v >= cv0 && v <= cv1;
      put(u, G.slab, v, inner ? null : M.fascia, inner ? undefined : { glow: 1 });
    }
    const stairCell = (u, v) => v >= SV0 && v <= SV0 + 1;
    for (let v = G.v0 + 2; v <= G.v1 - 1; v += 3) for (let u = EU - 6; u <= EU + 6; u += 3) {
      if (!interiorG(u, v) || stairCell(u, v) || (u >= cu0 - 1 && u <= cu1 + 1 && v >= cv0 - 1 && v <= cv1 + 1) || v === PV) continue;
      put(u, G.clear, v, M.spot); info.lights.push([u, F + G.clear, v]);
    }
    if (PV) for (let u = G.u0 + 2; u <= G.u1 - 2; u++) { if (Math.abs(u - EU) <= 1) continue; for (let y = 1; y <= G.clear; y++) put(u, y, PV, M.partition, { facing: 0, post: Math.abs(u - EU) === 5 ? 1 : 0 }); }
    for (let v = pv - 1; v <= pv + 3; v++) for (let u = pu - 1; u <= pu + 3; u++) if (u === pu - 1 || u === pu + 3 || v === pv - 1 || v === pv + 3) put(u, 0, v, M.line);
    model(pu, 1, pv, 'vm_nova_pad', 0); info.table = [pu + 1, F + 1, pv + 1];
    for (const u of [pu - 3, pu + 5]) { if (!interiorG(u, pv) || !interiorG(u, pv + 2)) continue; for (let v = pv; v <= pv + 2; v++) { put(u, 1, v, 'vollton_white_slab', { type: 'bottom' }); info.seats.push([u, F + 1, v, u < pu ? 1 : 3]); } }
    for (const [u, v] of [[G.u0 + 2, (PV || G.v0 + 2) + 1], [G.u1 - 2, (PV || G.v0 + 2) + 1]]) if (interiorG(u, v) && !stairCell(u, v)) model(u, 1, v, 'vm_plant_palm_concrete', 0);
    yield;

    // ---- the floating glass stairs: two blocks deep in front of the glass wall, one block up and one along per piece,
    //      from a side wall up to the first floor; the slab opens over them, glass railings round the opening upstairs
    if (U) for (const st of HALL.STAIRS) {
      const uk = (k) => st.u + st.du * (k - 1);
      for (let k = 1; k <= U.y; k++) {
        const u = uk(k);
        for (let h = 1; h <= 2; h++) for (let dv = 0; dv <= 1; dv++) if (k + h <= U.y) put(u, k + h, SV0 + dv, null);
        modelAt(u, k, SV0, 'vm_nova_tread', st.du > 0 ? 3 : 1);
      }
      for (let k = U.y - 3; k <= U.y - 1; k++) put(uk(k), U.y + 1, SV0 - 1, M.glassRail);
      for (let dv = 0; dv <= 1; dv++) put(uk(U.y - 3), U.y + 1, SV0 + dv, M.glassRail);
    }
    // ---- the stair to the top box: the same treads, two wide, rising toward the back; the slab opens above it
    if (U && T && HALL.STAIR2) {
      const SU = HALL.STAIR2.u, SV = HALL.STAIR2.v, n = T.y - U.y;
      for (let k = 1; k <= n; k++) {
        const v = SV + k - 1, y = U.y + k;
        for (let h = 1; h <= 2; h++) for (let du = 0; du <= 1; du++) if (y + h <= T.y) put(SU + du, y + h, v, null);
        model(SU, y, v, 'vm_nova_tread', 0);
      }
      for (let v = SV + 3; v <= SV + 4; v++) put(SU - 1, T.y + 1, v, M.glassRail);
      for (let du = 0; du <= 1; du++) put(SU + du, T.y + 1, SV + 2, M.glassRail);
    }
    yield;

    // ---- upstairs: a bed, sofas toward the windows, plants and spots; the top box a lounge
    const up = C.upper || {};
    if (U) {
      if (up.bed) { model(up.bed[0], U.y + 1, up.bed[1], 'vm_bed_white', 0); info.beds.push([up.bed[0] + 1, F + U.y + 1, up.bed[1] + 1, 0]); }
      if (up.sofas) for (const u of up.sofas.us) { put(u, U.y + 1, up.sofas.v, 'vx_sofa_white', { facing: up.sofas.f }); info.seats.push([u, F + U.y + 1, up.sofas.v, up.sofas.f]); }
      for (const [u, v] of up.planters || []) put(u, U.y + 1, v, 'vx_tech_planter');
      for (let v = U.v0 + 2; v < U.v1; v += 4) for (let u = U.u0 + 3; u < U.u1; u += 5) put(u, U.y + U.clear, v, M.spot);
    }
    if (T && up.top) {
      if (up.top.sofas) for (const u of up.top.sofas.us) { put(u, T.y + 1, up.top.sofas.v, 'vx_sofa_white', { facing: up.top.sofas.f }); info.seats.push([u, F + T.y + 1, up.top.sofas.v, up.top.sofas.f]); }
      for (const [u, v] of up.top.planters || []) put(u, T.y + 1, v, 'vx_tech_planter');
      put((T.u0 + T.u1) >> 1, T.y + T.clear, (T.v0 + T.v1) >> 1, M.spot);
    }
    if (!info.beds.length) { model(G.u1 - 3, 1, G.v1 - 4, 'vm_bed_white', 0); info.beds.push([G.u1 - 2, F + 1, G.v1 - 3, 0]); }
    yield;

    // ---- the roof garden: lawn on a roof terrace, the big round tree, blossom bushes, loungers; planters and the dome
    //      on the top roof
    const RF = C.roof, RS = RF.on === 'G' ? G : U, ry = RS.slab + 2, [gu0, gv0, gu1, gv1] = RF.rect;
    for (let v = gv0; v <= gv1; v++) for (let u = gu0; u <= gu1; u++) put(u, RS.slab + 1, v, 'grass_block');
    modelAt(RF.tree[0], ry, RF.tree[1], 'vm_tree_round_l', 0);
    for (const [u, v] of RF.bushes || []) model(u, ry, v, 'vm_bush_blossom', 0);
    for (const [u, v] of RF.loungers || []) model(u, ry, v, 'vm_lounger', 0);
    if (RF.dome) for (let k = 0; k < 2; k++) for (let j = 0; j < 2; j++) put(RF.dome[0] + k, TOP.slab + 2, RF.dome[1] + j, 'vx_dome_white');
    put(TOP.u0 + 1, TOP.slab + 2, TOP.v0 + 1, 'vx_tech_planter'); put(TOP.u1 - 1, TOP.slab + 2, TOP.v1 - 1, 'vx_tech_planter');
    info.roofTop = F + TOP.slab + 4;
    yield;

    // ---- the garden: the curved path from the street to the door with cyan lines on both edges, the paved apron, the
    //      back terrace and patio, lawn with tufts and flowers, hedges, clipped balls by the entrance, flowers along the
    //      facade, planters, palms, round trees and blossom bushes
    const houseAt = (u, v) => foot.has(u + ',' + v);
    const paved = new Set(); const isPath = (u, v) => paved.has(u + ',' + v);
    const lawnAt = (u, v) => u >= 0 && u < W && v >= 0 && v < D && !isPath(u, v) && !houseAt(u, v);
    const band = (a, b, c, r) => {
      for (let t = 0; t <= 1.0001; t += 0.01) {
        const q = 1 - t, cu = q * q * a[0] + 2 * q * t * b[0] + t * t * c[0], cv = q * q * a[1] + 2 * q * t * b[1] + t * t * c[1];
        for (let v = Math.floor(cv - r - 1); v <= Math.ceil(cv + r + 1); v++) for (let u = Math.floor(cu - r - 1); u <= Math.ceil(cu + r + 1); u++) if (v >= 0 && v < D && u >= 0 && u < W && !houseAt(u, v) && Math.hypot(u + 0.5 - cu, v + 0.5 - cv) <= r) paved.add(u + ',' + v);
      }
    };
    const disc = (cu, cv, r) => { for (let v = Math.floor(cv - r); v <= Math.ceil(cv + r); v++) for (let u = Math.floor(cu - r); u <= Math.ceil(cu + r); u++) if (v >= 0 && v < D - 1 && Math.hypot(u + 0.5 - cu, v + 0.5 - cv) <= r && !houseAt(u, v)) paved.add(u + ',' + v); };
    const lines = () => {
      const line = new Set(), key = (u, v) => u + ',' + v;
      for (const k of paved) { const [u, v] = k.split(',').map(Number); if (lawnAt(u + 1, v) || lawnAt(u - 1, v) || lawnAt(u, v + 1) || lawnAt(u, v - 1)) line.add(k); }
      for (let pass = 0; pass < 3; pass++) {
        let added = 0;
        for (const k of [...line]) {
          const [u, v] = k.split(',').map(Number);
          for (const [du, dv] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
            if (!line.has(key(u + du, v + dv)) || line.has(key(u + du, v)) || line.has(key(u, v + dv))) continue;
            const c = isPath(u + du, v) ? key(u + du, v) : isPath(u, v + dv) ? key(u, v + dv) : null;
            if (c) { line.add(c); added++; }
          }
        }
        if (!added) break;
      }
      return line;
    };
    const EV = info.entryV, PS = o.pathU !== undefined ? o.pathU : C.PS;   // (the city asks the hero lot for a straight path on its axis)
    // the front: the path from the street (PS ± 2) to the apron in front of the door, four rows deep
    band([PS, -1], [PS, EV - 2], [EU + 0.5, EV - 3], 2.05);
    for (let v = EV - 3; v <= EV - 1; v++) for (let u = EU - 3; u <= EU + 3; u++) if (!houseAt(u, v)) paved.add(u + ',' + v);
    // the back: a paved terrace two rows deep along the glass wall, the path from the garden door to a round patio
    for (let v = G.v1 + 1; v <= G.v1 + 2; v++) for (let u = G.u0; u <= G.u1; u++) paved.add(u + ',' + v);
    const PAT = [EU + 0.5, G.v1 + 7.5], patio = C.garden.patio && G.v1 + 10 <= D - 1;
    if (patio) { band([EU + 0.5, G.v1 + 2], [EU + 0.5, G.v1 + 4], PAT, 1.55); disc(PAT[0], PAT[1], 2.3); }
    const lineSet = lines();
    for (const k of paved) { const [u, v] = k.split(',').map(Number); put(u, yard, v, lineSet.has(k) ? M.line : M.path); }
    { let u0 = 99, u1 = -1; for (let u = 0; u < W; u++) if (isPath(u, 0)) { u0 = Math.min(u0, u); u1 = Math.max(u1, u); } info.pathStart = [u0, u1]; }
    const hsh = (u, v) => { let h = Math.imul(u * 374761393 + v * 668265263, 1274126177); h ^= h >>> 15; return (h >>> 0) % 6; };
    for (let v = 1; v < D - 1; v++) for (let u = 1; u < W - 1; u++) {
      if (!lawnAt(u, v)) continue;
      const byLine = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([du, dv]) => lineSet.has((u + du) + ',' + (v + dv)));
      if (byLine && (u + 2 * v) % 3 === 0) model(u, 0, v, 'vm_flower_cluster', 0);
      else if (!byLine && hsh(u, v) === 0) model(u, 0, v, 'vm_tuft_grass', 0);
    }
    for (let u = 0; u < W; u++) if (!isPath(u, 0) && !houseAt(u, 0)) put(u, 0, 0, M.hedge);
    for (let v = 1; v < D; v++) { if (!houseAt(0, v)) put(0, 0, v, M.hedge); if (!houseAt(W - 1, v)) put(W - 1, 0, v, M.hedge); }
    for (let u = 1; u < W - 1; u++) put(u, 0, D - 1, M.hedge);
    for (const u of [EU - 5, EU + 5]) if (lawnAt(u, EV - 3)) put(u, 0, EV - 3, 'vx_bush_light');
    const fv = info.house[1];
    for (let u = G.u0; u <= G.u1; u++) {
      for (const v of [fv - 1, fv - 2, G.v0 - 1, G.v0 - 2]) { if (!lawnAt(u, v) || (v !== fv - 1 && v !== G.v0 - 1 && lawnAt(u, v + 1))) continue; if (u & 1) model(u, 0, v, 'vm_flower_cluster', 0); else put(u, 0, v, 'vx_fern_lush'); break; }
    }
    for (const u of [EU - 3, EU + 3]) if (lawnAt(u, EV - 2)) put(u, 0, EV - 2, 'vx_tech_planter');
    // (the crown's 7 × 7 by its corner, so it stands centred on the trunk: its part 0 is not the corner of its grid)
    const palm = (u, v, h, y0) => { y0 = y0 | 0; for (let k = 0; k < h; k++) put(u, y0 + k, v, 'vx_palm_trunk'); modelAt(u - 3, y0 + h, v - 3, 'vm_palm_crown', 0); };
    for (const [u, v, h] of C.garden.palms || []) if (lawnAt(u, v)) palm(u, v, h);
    // the back garden: the patio palm in its planter, round trees, blossom bushes and flowers, loungers on the lawn
    if (patio) { const qu = Math.floor(PAT[0]), qv = Math.floor(PAT[1]); put(qu, 0, qv, 'vx_tech_planter'); palm(qu, qv, 10, 1); }
    for (const u of [G.u0 + 2, G.u1 - 2]) if (lawnAt(u, G.v1 + 6)) model(u, 0, G.v1 + 6, 'vm_tree_round_s', 0);
    for (const [u, v] of [[EU - 5, G.v1 + 4], [EU + 5, G.v1 + 4]]) if (lawnAt(u, v)) model(u, 0, v, 'vm_bush_blossom', 0);
    for (const u of [EU - 3, EU + 3]) if (lawnAt(u, G.v1 + 3) && lawnAt(u, G.v1 + 4)) model(u, 0, G.v1 + 3, 'vm_lounger', 0);
    yield;

    // ---- the plan record (house-local rooms for the Studio's room list): one open storey per level
    const hb = info.house, H = { family: 'trailer', comp: C.name, w: hb[2] - hb[0] + 1, d: hb[3] - hb[1] + 1, storeys: T ? 3 : U ? 2 : 1, sh: 6, floors: [], stairs: null, entry: { u: EU - hb[0], n: 1 }, features: {}, special: true };
    const room = (type, R, id) => ({ type, u0: R.u0 + 1 - hb[0], v0: R.v0 + 1 - hb[1], u1: R.u1 - 1 - hb[0], v1: R.v1 - 1 - hb[1], id, doors: [], windows: [] });
    H.floors.push({ y: 0, rect: [0, 0, H.w - 1, H.d - 1], rooms: [room('open', G, 'open')] });
    if (U) H.floors.push({ y: U.y, rect: [U.u0 - hb[0], U.v0 - hb[1], U.u1 - hb[0], U.v1 - hb[1]], rooms: [room('gallery', U, 'gallery')] });
    if (T) H.floors.push({ y: T.y, rect: [T.u0 - hb[0], T.v0 - hb[1], T.u1 - hb[0], T.v1 - hb[1]], rooms: [room('studio', T, 'studio')] });
    H.u0 = hb[0]; H.v0 = hb[1]; H.u1 = hb[2]; H.v1 = hb[3]; H.mirrored = false;
    info.plan = H;
    return info;
  };

  // ---------------------------------------------------------------- the classic's record for the city and the tests
  // (the classic builder above stays as it was; its house, bays, slab edges and path start are read from PLAN.NOVA)
  const classicExtras = (info) => {
    const { G, U, T, OVER, ENTRY } = NOVA, EU = ENTRY;
    info.comp = 'classic'; info.house = [G.u0, G.v0, G.u1, G.v1]; info.entryV = G.v0 - 1;
    info.bays = [
      { side: 0, a0: 4, a1: 6, out: G.v0 - 1, y0: 2, y1: 4 }, { side: 0, a0: 18, a1: 20, out: G.v0 - 1, y0: 2, y1: 4 }, { side: 0, a0: EU - 1, a1: EU + 1, out: G.v0 - 1, y0: 1, y1: 4 },
      { side: 1, a0: 13, a1: 15, out: G.u1 + 1, y0: 2, y1: 4 }, { side: 3, a0: 13, a1: 15, out: G.u0 - 1, y0: 2, y1: 4 },
      { side: 0, a0: 6, a1: 8, out: U.v0 - 2, y0: U.y + 3, y1: U.y + 4 }, { side: 0, a0: 16, a1: 18, out: U.v0 - 2, y0: U.y + 3, y1: U.y + 4 }, { side: 1, a0: 14, a1: 16, out: U.u1 + 2, y0: U.y + 3, y1: U.y + 4 },
    ];
    const ringOfRect = (r) => { const out = []; for (let v = r[1]; v <= r[3]; v++) for (let u = r[0]; u <= r[2]; u++) if (u === r[0] || u === r[2] || v === r[1] || v === r[3]) out.push([u, v]); return out; };
    info.slabs = [[G, OVER.G], [U, OVER.U], [T, OVER.T]].map(([R, ov]) => ({ y: R.slab, cells: ringOfRect([R.u0 - ov[1], R.v0 - ov[0], R.u1 + ov[1], R.v1 + ov[2]]) }));
    return info;
  };

  // ---------------------------------------------------------------- the mirror image (u → W − 1 − u)
  // Blocks move to the mirrored cell with their facing turned (1 ↔ 3) and a door's hinge swapped; a model keeps its
  // own parts together: every part goes to the place it has in the model laid down at the mirrored footprint with the
  // mirrored facing (a model is turned, not flipped — the trees, bushes, palms and pads are symmetric anyway).
  const mirrorLot = (L, W) => {
    const P0 = L.P, VM = VR.VM, fpc = new Map();
    const fpOf = (name, m, f) => { const k = name + '|' + f; let e = fpc.get(k); if (!e) { const fp = VM.footprint(m, f); let u0 = 1e9, u1 = -1e9, v0 = 1e9; for (const c of fp) { u0 = Math.min(u0, c[0]); u1 = Math.max(u1, c[0]); v0 = Math.min(v0, c[2]); } e = { fp, u0, u1, v0 }; fpc.set(k, e); } return e; };
    const P = (u, y, v, name, props) => {
      const m = typeof name === 'string' && props && props.part !== undefined && VM ? VM.MODELS[name] : null;
      if (m && typeof props.part === 'number') {
        const f = props.facing | 0, fm = (f & 1) ? (f ^ 2) : f, i = props.part;
        const A = fpOf(name, m, f), B = fpOf(name, m, fm), c = A.fp[i];
        const au = u - c[0], av = v - c[2], ay = y - c[1];
        const bu = (W - 1 - (au + A.u1)) - B.u0, bv = (av + A.v0) - B.v0, d = B.fp[i];
        return P0(bu + d[0], ay + d[1], bv + d[2], name, Object.assign({}, props, { facing: fm }));
      }
      let pr = props;
      if (pr && (pr.facing === 1 || pr.facing === 3 || pr.hinge !== undefined)) { pr = Object.assign({}, pr); if (pr.facing === 1 || pr.facing === 3) pr.facing ^= 2; if (pr.hinge !== undefined) pr.hinge ^= 1; }
      return P0(W - 1 - u, y, v, name, pr);
    };
    return Object.assign({}, L, { P });
  };
  const mirrorInfo = (info, W) => {
    const mu = (p) => { if (p) p[0] = W - 1 - p[0]; return p; };
    const mf = (p) => { if (p) { p[0] = W - 1 - p[0]; if (p[3] === 1 || p[3] === 3) p[3] ^= 2; } return p; };
    mu(info.door); mu(info.outside); mu(info.inside); mu(info.table); info.lights.forEach(mu); info.beds.forEach(mf); info.seats.forEach(mf);
    if (info.house) info.house = [W - 1 - info.house[2], info.house[1], W - 1 - info.house[0], info.house[3]];
    if (info.pathStart) info.pathStart = [W - 1 - info.pathStart[1], W - 1 - info.pathStart[0]];
    if (info.bays) for (const b of info.bays) { if (b.side & 1) { b.side ^= 2; b.out = W - 1 - b.out; } else { const a0 = b.a0; b.a0 = W - 1 - b.a1; b.a1 = W - 1 - a0; } }
    if (info.slabs) for (const s of info.slabs) s.cells = s.cells.map(([u, v]) => [W - 1 - u, v]);
    if (info.plan) info.plan.mirrored = true;
    info.mirror = true;
    return info;
  };

  // ---------------------------------------------------------------- the house of the catalogue entry: any composition
  // o.comp (default the classic) and o.novaMirror; the classic without either is built exactly as before
  PLAN.buildNova = function* (L, lot, o) {
    const C = FAM[(o && o.comp) || 'classic'] || FAM.classic, mirror = !!(o && o.novaMirror);
    const Lm = mirror ? mirrorLot(L, lot.w) : L;
    let info;
    if (C.classic) {
      // (the classic's path at the street, read from what it lays at the yard level of the street row)
      const street = new Map(), P1 = Lm.P;
      const Lc = Object.assign({}, Lm, { P(u, y, v, name, pr) { if (v === 0 && y === lot.F - 1) street.set(u, name); return P1(u, y, v, name, pr); } });
      info = classicExtras(yield* buildClassic(Lc, lot, o));
      let u0 = 99, u1 = -1; for (const [u, n] of street) if (typeof n === 'string' && /^vx_floor_plaza/.test(n)) { u0 = Math.min(u0, u); u1 = Math.max(u1, u); }
      info.pathStart = [u0, u1];
    } else info = yield* buildComp(Lm, lot, o, C);
    if (info && !info.mirror) info.mirror = false;
    return mirror ? mirrorInfo(info, lot.w) : info;
  };
})(VR);

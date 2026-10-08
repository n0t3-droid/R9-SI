// ============================================================================
// Villa Nova — THE house of the trailer (docs/trailer/frames t1_26 · t3_05 ·
// t2_23 · t1_24 outside, t1_29 · t1_30 · t3_10 · t2_28 inside), the catalogue
// family 'trailer' (gen_plan.js, skin 'nova'). Built block by block, at real
// scale, on a 25 × 25 lot (u across the street front, v into the lot):
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
// ============================================================================
(function (VR) {
  'use strict';
  const VG = VR.VillageGen;
  if (!VG || !VG.plan2) return;
  const PLAN = VG.plan2;
  // the geometry, the plan and the skin are in gen_plan.js (PLAN.NOVA, PLAN.templates.trailer, SKINS.nova)
  PLAN.buildNova = function* (L, lot, o) {
    const P = L.P, F = lot.F, rng = o.rng || new VR.RNG(7);
    const S = (PLAN.SKINS && PLAN.SKINS.nova) || {};
    const M = Object.assign({
      wall: 'vollton_stone_grey', bay: 'vollton_light_grey', plinth: 'vollton_mid_grey', fascia: 'vx_nova_band', ceiling: 'vollton_white',
      floor: 'vollton_white_gloss', inner: 'vollton_white', terrace: 'vx_floor_plaza', rail: 'vx_balustrade', win: 'vx_nova_window', glass: 'panorama_white',
      mullion: 'vx_beam_white', base: 'vx_led_strip', door: 'door_glass_white', path: 'vx_floor_plaza', line: 'vx_floor_plaza_line',
      hedge: 'vx_hedge', partition: 'vx_glass_wall', spot: 'vx_spot', glassRail: 'vx_tech_railing',
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
    // a box bay on side s over [a0, a1], pushed out one block from y0 to y1, one window [w0, w1] × [wy0, wy1] in its face
    // with a lintel over it. A box standing on the ground gets an orange line at its foot (the cell in front, the line on
    // the box's face at the top of the plinth course); a hanging box (o.hang) has a nova band as its lowest row, whose
    // underside glows orange. The wall behind the window opens into the room.
    const bay = (R, s, a0, a1, y0, y1, w0, w1, wy0, wy1, o2) => {
      o2 = o2 || {};
      const out = s === 0 ? R.v0 - 1 : s === 2 ? R.v1 + 1 : s === 1 ? R.u1 + 1 : R.u0 - 1;
      const fr = s === 0 ? out - 1 : s === 2 ? out + 1 : s === 1 ? out + 1 : out - 1;
      for (let a = a0; a <= a1; a++) {
        const u = (s & 1) ? out : a, v = (s & 1) ? a : out;
        if (R === G && !o2.hang) put(u, 0, v, M.plinth);
        for (let y = y0; y <= y1; y++) put(u, y, v, M.bay);
        if (o2.hang) put(u, y0, v, M.fascia, { glow: 2 });
        else { const fu = (s & 1) ? fr : a, fv = (s & 1) ? a : fr; put(fu, y0, fv, M.base, { facing: (s + 2) & 3 }); }
      }
      if (w1 >= w0) {
        win(s, w0, w1, wy0, wy1, out);
        if (wy1 < y1) lintel(s, w0, w1, wy1 + 1, out);
        // the wall behind the window opens into the room (and the ground floor's white lining)
        for (let a = w0; a <= w1; a++) for (let y = wy0; y <= wy1; y++) for (let k = 0; k <= (R === G ? 1 : 0); k++) {
          const u = (s & 1) ? (s === 1 ? R.u1 - k : R.u0 + k) : a, v = (s & 1) ? a : (s === 0 ? R.v0 + k : R.v1 - k);
          put(u, y, v, null);
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
    // ground floor, sides: a tall window and a band each, with lintels; back: the glass wall (below)
    for (const s of [1, 3]) {
      const fixed = s === 1 ? G.u1 : G.u0, lin = s === 1 ? G.u1 - 1 : G.u0 + 1;
      win(s, 8, 9, 2, 4, fixed); lintel(s, 8, 9, 5, fixed); win(s, 13, 15, 4, 4, fixed); lintel(s, 13, 15, 5, fixed);
      for (let v = 8; v <= 9; v++) for (let y = 2; y <= 4; y++) put(lin, y, v, null);
      for (let v = 13; v <= 15; v++) put(lin, 4, v, null);
    }
    // first floor, front (v 9): two hanging boxes with 2 × 2 windows and the orange underglow, a glass door to the terrace
    bay(U, 0, 6, 9, U.y + 2, U.y + 4, 7, 8, U.y + 3, U.y + 4, { hang: true });
    bay(U, 0, 15, 18, U.y + 2, U.y + 4, 16, 17, U.y + 3, U.y + 4, { hang: true });
    put(EU, U.y + 1, U.v0, M.door, { facing: 0, half: 0, hinge: 0, open: 0 }); put(EU, U.y + 2, U.v0, M.door, { facing: 0, half: 1, hinge: 0, open: 0 });
    win(0, EU - 1, EU - 1, U.y + 1, U.y + 3, U.v0); win(0, EU + 1, EU + 1, U.y + 1, U.y + 3, U.v0); win(0, EU, EU, U.y + 3, U.y + 3, U.v0); lintel(0, EU - 1, EU + 1, U.y + 4, U.v0);
    // first floor, sides and back
    for (const s of [1, 3]) { const fixed = s === 1 ? U.u1 : U.u0; win(s, 11, 12, U.y + 2, U.y + 3, fixed); lintel(s, 11, 12, U.y + 4, fixed); win(s, 17, 18, U.y + 2, U.y + 3, fixed); lintel(s, 17, 18, U.y + 4, fixed); }
    win(2, 7, 9, U.y + 2, U.y + 3, U.v1); win(2, 15, 17, U.y + 2, U.y + 3, U.v1); win(2, 11, 13, U.y + 3, U.y + 3, U.v1);
    for (const [a0, a1] of [[7, 9], [11, 13], [15, 17]]) lintel(2, a0, a1, U.y + 4, U.v1);
    // top floor: a band across the front, windows on the sides and the back, the door to the roof garden
    win(0, 9, 11, T.y + 2, T.y + 3, T.v0); win(0, 14, 15, T.y + 2, T.y + 3, T.v0); lintel(0, 9, 11, T.y + 4, T.v0); lintel(0, 14, 15, T.y + 4, T.v0);
    put(13, T.y + 1, T.v0, M.door, { facing: 0, half: 0, hinge: 0, open: 0 }); put(13, T.y + 2, T.v0, M.door, { facing: 0, half: 1, hinge: 0, open: 0 });
    win(0, 13, 13, T.y + 3, T.y + 3, T.v0); lintel(0, 13, 13, T.y + 4, T.v0);
    for (const s of [1, 3]) { const fixed = s === 1 ? T.u1 : T.u0; win(s, 15, 17, T.y + 2, T.y + 3, fixed); lintel(s, 15, 17, T.y + 4, fixed); }
    win(2, 10, 14, T.y + 2, T.y + 3, T.v1); lintel(2, 10, 14, T.y + 4, T.v1);
    yield;

    // ---- the glass wall to the back garden (the hall), mullions every five blocks, the garden door in the middle (between
    //      the high ends of the stairs, where the way under them is free)
    for (let u = G.u0 + 2; u <= G.u1 - 2; u++) for (let y = 1; y <= G.clear; y++) put(u, y, G.v1, (u - 2) % 5 === 0 ? M.mullion : M.glass, (u - 2) % 5 === 0 ? { axis: 0 } : undefined);
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
    // the partition between the foyer and the hall: glass with an open middle
    for (let u = G.u0 + 2; u <= G.u1 - 2; u++) { if (Math.abs(u - EU) <= 1) continue; for (let y = 1; y <= G.clear; y++) put(u, y, PV, M.partition, { facing: 0 }); }
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
    for (let u = 9; u <= 14; u++) if (u !== EU) { put(u, U.y + 1, 11, 'vx_sofa_white', { facing: 2 }); info.seats.push([u, F + U.y + 1, 11, 2]); }
    model(U.u0 + 1, U.y + 1, U.v1 - 1, 'vm_plant_palm_concrete', 0);
    for (const [u, v] of [[7, 12], [12, 13], [7, 16], [12, 17], [18, 13]]) put(u, U.y + U.clear, v, M.spot);
    // the top floor: a studio with a lounge looking out to the roof garden
    for (let u = 9; u <= 13; u++) { put(u, T.y + 1, 18, 'vx_sofa_white', { facing: 0 }); info.seats.push([u, F + T.y + 1, 18, 0]); }
    put(9, T.y + 1, 15, 'vx_tech_planter'); put(13, T.y + 1, 15, 'vx_tech_planter');
    for (const [u, v] of [[10, 16], [13, 17]]) put(u, T.y + T.clear, v, M.spot);
    yield;

    // ---- the roof gardens: lawn beds, a round tree and blossom bushes on the first floor's roof, planters, the dome
    const ry = U.slab + 2;
    for (const [u0, u1, v0, v1] of [[uS[0] + 1, T.u0 - 1, uS[1] + 1, uS[1] + 2], [T.u1 + 1, uS[2] - 1, uS[1] + 1, uS[1] + 2]]) for (let v = v0; v <= v1; v++) for (let u = u0; u <= u1; u++) put(u, U.slab + 1, v, 'grass_block');
    model(uS[0] + 1, ry, uS[1] + 1, 'vm_tree_round_s', 0);
    for (const u of [T.u1 + 2, T.u1 + 3]) model(u, ry, uS[1] + 1, 'vm_bush_blossom', 0);
    put(T.u0 - 1, ry, T.v0 + 2, 'vx_tech_planter');
    model(T.u1 + 2, ry, T.v0 + 3, 'vm_lounger', 0);
    for (let k = 0; k < 2; k++) for (let j = 0; j < 2; j++) put(11 + k, T.slab + 2, 16 + j, 'vx_dome_white');
    put(T.u0 + 1, T.slab + 2, T.v0 + 1, 'vx_tech_planter'); put(T.u1 - 1, T.slab + 2, T.v1 - 1, 'vx_tech_planter');
    // the ground floor's terrace: planters at its corners, blossom bushes, loungers
    const ty = G.slab + 2;
    put(gS[0] + 1, ty, gS[1] + 1, 'vx_tech_planter'); put(gS[2] - 1, ty, gS[1] + 1, 'vx_tech_planter');
    model(gS[0] + 3, ty, gS[1] + 1, 'vm_bush_blossom', 0); model(gS[2] - 3, ty, gS[1] + 1, 'vm_bush_blossom', 0);
    model(10, ty, gS[1] + 1, 'vm_lounger', 0); model(14, ty, gS[1] + 1, 'vm_lounger', 0);
    info.roofTop = F + T.slab + 4;
    yield;

    // ---- the garden
    const lawnFree = new Set(); const mark = (u, v) => lawnFree.add(u + ',' + v);
    // the paved apron in front of the entrance and the curved path from the street (u 6, v 0) to it, three wide, the cyan
    // line on both edges: the cells within 1.5 of the centre line are path, the path cells beside lawn are the line
    const pathCells = new Set();
    const bez = (t) => { const a = [5.5, -1], b = [5.5, 4.5], c = [EU, 2.5]; const s = 1 - t; return [s * s * a[0] + 2 * s * t * b[0] + t * t * c[0], s * s * a[1] + 2 * s * t * b[1] + t * t * c[1]]; };
    for (let t = 0; t <= 1.0001; t += 0.01) { const [cu, cv] = bez(t); for (let v = Math.floor(cv - 2); v <= Math.ceil(cv + 2); v++) for (let u = Math.floor(cu - 2); u <= Math.ceil(cu + 2); u++) if (v >= 0 && Math.hypot(u + 0.5 - cu, v + 0.5 - cv) <= 1.55) pathCells.add(u + ',' + v); }
    for (let v = G.v0 - 3; v <= G.v0 - 1; v++) for (let u = EU - 3; u <= EU + 3; u++) pathCells.add(u + ',' + v);
    const isPath = (u, v) => pathCells.has(u + ',' + v);
    // a path cell is on the edge when one of its four neighbours is lawn (not path, not the house, not the street)
    const lawnAt = (u, v) => v >= 0 && !isPath(u, v) && !(v >= G.v0 && u >= G.u0 && u <= G.u1);
    for (const k of pathCells) {
      const [u, v] = k.split(',').map(Number); if (u < 0 || u >= W || v < 0 || v >= D) continue;
      const edge = lawnAt(u + 1, v) || lawnAt(u - 1, v) || lawnAt(u, v + 1) || (v > 0 && lawnAt(u, v - 1));
      put(u, yard, v, edge ? M.line : M.path); mark(u, v);
    }
    // hedges: along the street (with the path's gap) and along both sides
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
    // palms: the shared crown on a ringed trunk (VR.Plants.palm) — two at the front corners, two in the back garden
    const palm = (u, v, h) => { for (let k = 0; k < h; k++) put(u, k, v, 'vx_palm_trunk'); model(u - 3, h, v - 3, 'vm_palm_crown', 0); };
    // (the back palms stand at the hedge: their crowns clear the first floor's back wall and overhang the lot's back edge)
    palm(3, 2, 10); palm(21, 2, 9); palm(5, D - 1, 10); palm(19, D - 1, 11);
    // the back garden: a paved strip with loungers in front of the glass wall, lawn, round bushes
    for (let u = G.u0; u <= G.u1; u++) put(u, yard, G.v1 + 1, M.path);
    for (const u of [8, 10]) model(u, 0, G.v1 + 2, 'vm_lounger', 2);
    for (const u of [14, 16]) model(u, 0, G.v1 + 2, 'vm_bush_blossom', 0);
    yield;

    // ---- the plan record (house-local rooms for the villa tests and the Studio's room list)
    const H = PLAN.templates.trailer(o);
    H.u0 = G.u0; H.v0 = G.v0; H.u1 = H.u0 + H.w - 1; H.v1 = H.v0 + H.d - 1; H.mirrored = false;
    for (const fl of H.floors) for (const r of fl.rooms) { r.doors = r.doors || []; r.windows = r.windows || []; }
    H.floors[0].rooms[0].doors.push({ u: EU - G.u0, v: PV - G.v0 - 1, side: 2 }); H.floors[0].rooms[1].doors.push({ u: EU - G.u0, v: PV - G.v0 + 1, side: 0 });
    info.plan = H;
    return info;
  };
})(VR);

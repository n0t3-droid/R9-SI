// ============================================================================
// 🏠 Modernes Haus — a cube or mono-pitch house on its own lot: hall with the
// staircase, WC and utility at the street, the open living / dining / kitchen
// across the garden side behind panorama glass (or punched windows), upstairs
// the master bedroom, children's rooms, a bath and a gallery; a terrace with
// outdoor dining and loungers, a balcony over it, a carport with a car, a pool,
// lawn, hedges, path lights and a letterbox. Every room is furnished by the
// villa catalogue's designer. Five looks: Weiß (white render + anthracite),
// Anthrazit (dark render + white frames), Holz (slatted timber), Backstein
// (white clinker) and Beton (micro-cement with bronze glass).
// ============================================================================
(function (VR) {
  'use strict';
  const Forge = VR.Forge; if (!Forge || !Forge.kit) return;
  const DIR = Forge.DIR;
  const STYLES = {
    weiss: { name: 'Weiß', wall: 'stucco_white', plinth: 'charcoal_panel', trim: 'white_trim', glass: 'window_black', pano: 'panorama_black', door: 'door_pivot_anthracite', tdoor: 'door_glass_black', idoor: 'door_flush_white', rail: 'glass_rail', post: 'black_metal', floorL: 'floor_oak_wide', floorH: 'floor_porcelain', skin: 'bauhaus', lamp: 'vx_garden_lamp' },
    anthrazit: { name: 'Anthrazit', wall: 'vollton_anthracite', plinth: 'vollton_black', trim: 'vollton_white', glass: 'panorama_white', pano: 'panorama_white', door: 'door_loft_black', tdoor: 'door_glass_white', idoor: 'door_flush_oak', rail: 'glass_rail', post: 'vollton_white', floorL: 'floor_oak', floorH: 'floor_cement', skin: 'glasnacht', lamp: 'vx_garden_lamp' },
    holz: { name: 'Holz', wall: 'wood_slat', wallPr: { axis: 0 }, plinth: 'stacked_stone', trim: 'walnut_panel', glass: 'window_black', pano: 'panorama_black', door: 'door_slat_walnut', tdoor: 'door_glass_black', idoor: 'door_flush_oak', rail: 'vx_railing_black', post: 'vx_beam_dark', floorL: 'floor_oak', floorH: 'floor_porcelain', skin: 'grey', lamp: 'vx_garden_lamp' },
    backstein: { name: 'Backstein', wall: 'white_clinker', plinth: 'concrete_smooth', trim: 'charcoal_panel', glass: 'window_black', pano: 'panorama_black', door: 'door_flush_oak', tdoor: 'door_glass_black', idoor: 'door_flush_white', rail: 'vx_railing_black', post: 'black_metal', floorL: 'floor_oak', floorH: 'floor_porcelain', skin: 'klinker', lamp: 'vx_garden_lamp' },
    beton: { name: 'Beton', wall: 'micro_cement', plinth: 'concrete_smooth', trim: 'concrete_smooth', glass: 'window_black', pano: 'panorama_bronze', door: 'door_pivot_anthracite', tdoor: 'door_glass_black', idoor: 'door_flush_white', rail: 'glass_rail', post: 'concrete_smooth', floorL: 'floor_cement', floorH: 'floor_porcelain', skin: 'bauhaus', lamp: 'vx_garden_lamp' },
  };
  const WET = { wc: 1, bath: 1, utility: 1, ensuite: 1 };
  const def = {
    id: 'house', icon: '🏠', name: 'Modernes Haus', en: 'Modern house', level: true, sh: 4,
    params: [
      { k: 'f', label: 'Etagen', min: 1, max: 3, def: 2, dim: true },
      { k: 'w', label: 'Breite', min: 9, max: 21, def: 13, dim: true },
      { k: 'd', label: 'Tiefe', min: 10, max: 17, def: 12, dim: true },
      { k: 'r', label: 'Dach', min: 0, max: 1, def: 0, names: ['Flachdach', 'Pultdach'] },
      { k: 'g', label: 'Glas', min: 0, max: 2, def: 1, names: ['Fenster', 'Panorama unten', 'Panorama überall'] },
      { k: 'c', label: 'Carport', min: 0, max: 1, def: 1 },
      { k: 'b', label: 'Balkon', min: 0, max: 1, def: 1 },
    ],
    styles: Object.keys(STYLES).map(id => ({ id, name: STYLES[id].name })),
    lot: (P) => lotOf(P.params),
    describe: (P) => [P.params.f + (P.params.f === 1 ? ' Etage' : ' Etagen'), P.params.w + ' × ' + P.params.d, P.params.r ? 'Pultdach' : 'Flachdach', P.params.g === 2 ? 'Panoramaglas' : P.params.g ? 'Glasfront' : 'Fenster'].concat(['Terrasse'], P.params.c ? ['Carport'] : [], P.params.b && P.params.f > 1 ? ['Balkon'] : [], P.params.p ? ['Pool'] : []),
  };
  def.params.push({ k: 'p', label: 'Pool', min: 0, max: 1, def: 0 });
  const SIDE = 2, FRONT = 3;
  function lotOf(p) { const gd = Math.min(25 - FRONT - p.d, p.p ? 8 : 5); return [p.w + 2 * SIDE + (p.c ? 6 : 0), FRONT + p.d + Math.max(2, gd)]; }

  function build(P, env) {
    const { f, w, d, r, g, c, b, p } = P.params, t = 1, S = STYLES[P.style] || STYLES.weiss, rng = Forge.rng(P, 'house');
    const SH = 4, BASE = 1, Y = (k) => BASE + k * SH, top = Y(f);
    const [W, D] = lotOf(P.params), gd = D - FRONT - d, HU = SIDE, HV = FRONT;
    const K = Forge.kit(W, top + 8, D, -BASE);
    const hx = (u) => HU + u, hz = (v) => HV + v;                 // house-local → grid
    const wall = (x, y, z) => K.set(x, y, z, S.wall, S.wallPr);
    // ---- the lot: lawn, the house's foundation, the front path and the driveway
    K.box(0, 0, 0, W - 1, 0, D - 1, 'grass_block');
    K.box(hx(0), 0, hz(0), hx(w - 1), 0, hz(d - 1), 'concrete_smooth');
    K.box(0, 1, 0, W - 1, top + 7, D - 1, 0);
    // ---- the plan: rooms per floor in house-local coordinates (walls fill the gaps between them)
    const big = d >= 13, eu = big ? 3 : 7;                       // the entrance column
    const floors = [], stairBox = big ? [1, 1, 2, 6] : [1, 1, 6, 2];
    const blockStair = (room) => { for (let v = stairBox[1]; v <= stairBox[3]; v++) for (let u = stairBox[0]; u <= stairBox[2]; u++) if (u >= room.u0 && u <= room.u1 && v >= room.v0 && v <= room.v1) room.doors.push({ u, v, side: 0 }); };
    const mk = (u0, v0, u1, v1, type) => ({ u0, v0, u1, v1, type, doors: [], windows: [] });
    for (let k = 0; k < f; k++) {
      const rooms = [], openings = [], doors = [];
      if (big) {
        if (k === 0) {
          const hall = mk(1, 1, 4, 6, 'foyer'); blockStair(hall); rooms.push(hall);
          if (w >= 13) { rooms.push(mk(6, 1, 7, 3, 'wc')); rooms.push(mk(6, 5, 7, 6, 'utility')); rooms.push(mk(9, 1, w - 2, 6, 'study')); doors.push([5, 2, 1], [5, 5, 1], [10, 7, 0]); }
          else { rooms.push(mk(6, 1, w - 2, 3, 'wc')); rooms.push(mk(6, 5, w - 2, 6, 'utility')); doors.push([5, 2, 1], [5, 5, 1]); }
          rooms.push(living(1, 8, w - 2, d - 2)); openings.push([3, 7, 4, 7]);
        } else {
          const hall = mk(1, 1, 4, 7, 'gallery'); blockStair(hall); rooms.push(hall);
          rooms.push(mk(5, 7, w - 2, 7, 'hall'));                 // the corridor
          rooms.push(mk(6, 1, 7, 5, 'bath')); doors.push([6, 6, 0]);
          if (w >= 13) { rooms.push(mk(9, 1, w - 2, 5, k === 1 ? 'kid' : 'study')); doors.push([10, 6, 0]); }
          const mid = Math.max(4, Math.min(w - 6, (w - 1) >> 1));
          rooms.push(mk(1, 9, mid, d - 2, k === 1 ? 'master' : 'bedroom')); doors.push([3, 8, 2]);
          if (w - 2 - (mid + 2) >= 2) { rooms.push(mk(mid + 2, 9, w - 2, d - 2, k === 1 ? 'kid' : 'guest')); doors.push([mid + 3, 8, 2]); }
        }
      } else {
        if (k === 0) {
          const hall = mk(1, 1, 8, 3, 'foyer'); blockStair(hall); rooms.push(hall);
          if (w >= 12) { rooms.push(mk(10, 1, w - 2, 3, 'wc')); doors.push([9, 2, 1]); }
          rooms.push(living(1, 5, w - 2, d - 2)); openings.push([7, 4, 8, 4]);
        } else {
          const hall = mk(1, 1, 8, 3, 'gallery'); blockStair(hall); rooms.push(hall);
          if (w >= 12) { rooms.push(mk(10, 1, w - 2, 3, 'bath')); doors.push([9, 2, 1]); }
          const mid = Math.min(6, w - 2);
          rooms.push(mk(1, 5, mid, d - 2, k === 1 ? 'master' : 'bedroom')); doors.push([3, 4, 2]);
          if (w - 2 - (mid + 2) >= 2) { rooms.push(mk(mid + 2, 5, w - 2, d - 2, k === 1 ? 'kid' : 'guest')); doors.push([8, 4, 2]); }
        }
      }
      floors.push({ y: k * SH, rect: [0, 0, w - 1, d - 1], rooms, openings, doors });
    }
    // ---- slabs, walls, partitions, doors
    const inRoom = (rooms, u, v) => rooms.find(rm => u >= rm.u0 && u <= rm.u1 && v >= rm.v0 && v <= rm.v1) || null;
    for (let k = 0; k < f; k++) {
      const fl = floors[k], y0 = Y(k);
      for (let v = 0; v < d; v++) for (let u = 0; u < w; u++) {
        const ring = u === 0 || u === w - 1 || v === 0 || v === d - 1, rm = inRoom(fl.rooms, u, v);
        K.set(hx(u), y0, hz(v), ring ? (k === 0 ? S.plinth : S.trim) : rm ? floorOf(rm.type, S) : S.floorH);
        for (let yy = y0 + 1; yy <= y0 + SH - 1; yy++) { if (ring) wall(hx(u), yy, hz(v)); else if (rm) K.air(hx(u), yy, hz(v)); else K.set(hx(u), yy, hz(v), 'stucco_white'); }
      }
      for (const [u0, v0, u1, v1] of fl.openings) K.box(hx(u0), y0 + 1, hz(v0), hx(u1), y0 + 2, hz(v1), 0);
      for (const [u, v, facing] of fl.doors) {
        K.box(hx(u), y0 + 1, hz(v), hx(u), y0 + 2, hz(v), 0); K.door(hx(u), y0 + 1, hz(v), facing, S.idoor, 0);
        const ru = u + DIR[facing][0], rv = v + DIR[facing][1], rm = inRoom(fl.rooms, ru, rv); if (rm) rm.doors.push({ u: ru, v: rv, side: (facing + 2) & 3 });
        const om = inRoom(fl.rooms, u - DIR[facing][0], v - DIR[facing][1]); if (om) om.doors.push({ u: u - DIR[facing][0], v: v - DIR[facing][1], side: facing });
      }
      for (const [u0, v0, u1, v1] of fl.openings) for (const rm of fl.rooms) for (let v = v0; v <= v1; v++) for (let u = u0; u <= u1; u++) for (const [dx, dz] of DIR) { const a = u + dx, bq = v + dz; if (a >= rm.u0 && a <= rm.u1 && bq >= rm.v0 && bq <= rm.v1) rm.doors.push({ u: a, v: bq, side: dx ? (dx > 0 ? 3 : 1) : (dz > 0 ? 0 : 2) }); }
    }
    // ---- the staircase
    const stairName = S.skin === 'classic' ? 'marble_white_stairs' : S.floorH === 'floor_cement' ? 'concrete_smooth_stairs' : 'white_concrete_stairs';
    if (big) K.stairwell(hx(1), BASE, hz(2), f, SH, stairName, 'stucco_white', S.rail, false); else K.stairwell(hx(2), BASE, hz(1), f, SH, stairName, 'stucco_white', S.rail, true);
    // ---- the facade: plinth, glazing by room and side, the entrance, terrace and balcony doors
    const glassFor = (k, side, u, v, rm) => {
      // which rows of the wall cell at house-local (u, v) are glass: [] none, [2, 3] window, [1, 2, 3] panorama, [3] frosted slit
      const wet = rm && WET[rm.type];
      if (wet) return { rows: [3], m: 'frosted_glass' };
      const pano = (g === 2 && side !== 0) || (g >= 1 && side === 2 && k === 0) || (g >= 1 && k === 0 && rm && rm.type === 'living' && side !== 0);
      if (pano) return { rows: [1, 2, 3], m: S.pano };
      const i = side === 0 || side === 2 ? u : v;
      if (rm && rm.type === 'hall') return null;
      if (i % 3 !== 0) return { rows: [2, 3], m: side === 0 && g === 2 ? S.pano : S.glass };
      return null;
    };
    for (let k = 0; k < f; k++) {
      const fl = floors[k], y0 = Y(k);
      for (let v = 0; v < d; v++) for (let u = 0; u < w; u++) {
        const ring = u === 0 || u === w - 1 || v === 0 || v === d - 1; if (!ring) continue;
        const corner = (u === 0 || u === w - 1) && (v === 0 || v === d - 1); if (corner) continue;
        const side = v === 0 ? 0 : u === w - 1 ? 1 : v === d - 1 ? 2 : 3, iv = side === 0 ? 1 : side === 2 ? -1 : 0;
        const rm = inRoom(fl.rooms, u + (side === 1 ? -1 : side === 3 ? 1 : 0), v + iv);
        const gl = glassFor(k, side, u, v, rm); if (!gl) continue;
        for (const row of gl.rows) K.set(hx(u), y0 + row, hz(v), gl.m);
        if (rm) rm.windows.push({ u: u + (side === 1 ? -1 : side === 3 ? 1 : 0), v: v + iv, side, kind: gl.rows.length === 3 ? 'tall' : 'std2' });
      }
    }
    // the entrance: a pivot door, the step, lamps, the canopy
    K.box(hx(eu), Y(0) + 1, hz(0), hx(eu), Y(0) + 3, hz(0), S.wall, S.wallPr); K.box(hx(eu), Y(0) + 1, hz(0), hx(eu), Y(0) + 2, hz(0), 0); K.door(hx(eu), Y(0) + 1, hz(0), 2, S.door, 0);
    K.set(hx(eu + 1), Y(0) + 1, hz(0), S.glass); K.set(hx(eu + 1), Y(0) + 2, hz(0), S.glass); K.set(hx(eu + 1), Y(0) + 3, hz(0), S.wall, S.wallPr);
    K.set(hx(eu), BASE, hz(-1), 'travertine_stairs', { facing: 2, half: 0 });
    K.box(hx(eu - 1), Y(0) + 3, hz(-2), hx(eu + 2), Y(0) + 3, hz(-1), S.trim); K.set(hx(eu), Y(0) + 2, hz(-1), 'vx_led_strip_warm', { facing: 2 });
    K.set(hx(eu - 1), Y(0) + 2, hz(0), 'vm_wall_lantern', { facing: 0, part: 0 }); K.set(hx(eu + 2), Y(0) + 2, hz(0), 'vm_house_sign', { facing: 0, part: 0 });
    const doors = [[hx(eu), Y(0) + 1 - BASE, hz(0)]];
    // the terrace doors in the garden wall of the living room
    const tu = Math.min(w - 4, Math.max(2, (w >> 1) - 1));
    for (let i = 0; i < 2; i++) { K.box(hx(tu + i), Y(0) + 1, hz(d - 1), hx(tu + i), Y(0) + 3, hz(d - 1), S.wall, S.wallPr); K.box(hx(tu + i), Y(0) + 1, hz(d - 1), hx(tu + i), Y(0) + 2, hz(d - 1), 0); K.door(hx(tu + i), Y(0) + 1, hz(d - 1), 0, S.tdoor, i); K.set(hx(tu + i), Y(0) + 3, hz(d - 1), S.pano); }
    K.set(hx(tu), BASE, hz(d), 'travertine_stairs', { facing: 0, half: 0 }); K.set(hx(tu + 1), BASE, hz(d), 'travertine_stairs', { facing: 0, half: 0 });
    // ---- the roof
    if (r === 0) {
      for (let v = 0; v < d; v++) for (let u = 0; u < w; u++) {
        const ring = u === 0 || u === w - 1 || v === 0 || v === d - 1;
        K.set(hx(u), top, hz(v), ring ? S.trim : 'stucco_white');
        if (ring) K.set(hx(u), top + 1, hz(v), S.trim); else K.set(hx(u), top + 1, hz(v), 'roof_charcoal_slab', { type: 0 });
      }
      for (let u = 2; u < w - 2; u += 2) K.set(hx(u), top + 1, hz(d - 3), 'vx_solar', { facing: 2 });
    } else {
      // Pultdach: three flat levels stepping up toward the street, the risers glazed as clerestory bands
      const RY = (v) => v <= Math.floor(d * 0.3) ? top + 2 : v <= Math.floor(d * 0.62) ? top + 1 : top;
      // (one block thick with a slim fascia: the overhang is a top slab, so the roof's edge reads thin like a modern one)
      for (let v = -1; v <= d; v++) for (let u = -1; u <= w; u++) { const edge = u === -1 || u === w || v === -1 || v === d, yy = RY(Math.max(0, Math.min(d - 1, v))); if (edge) K.set(hx(u), yy, hz(v), 'roof_charcoal_slab', { type: 1 }); else K.set(hx(u), yy, hz(v), 'roof_charcoal'); }
      for (let v = 0; v < d; v++) { const yy = RY(v); for (let y2 = top; y2 < yy; y2++) { wall(hx(0), y2, hz(v)); wall(hx(w - 1), y2, hz(v)); } }
      for (let u = 0; u < w; u++) for (let y2 = top; y2 < RY(0); y2++) { if (u === 0 || u === w - 1) wall(hx(u), y2, hz(0)); else K.set(hx(u), y2, hz(0), S.glass); }
      for (let v = 1; v < d; v++) if (RY(v) < RY(v - 1)) for (let u = 1; u < w - 1; u++) for (let y2 = RY(v); y2 < RY(v - 1); y2++) K.set(hx(u), y2, hz(v), S.glass);
      for (let v = 1; v < d - 1; v++) for (let u = 1; u < w - 1; u++) { if (RY(v) > top) { K.air(hx(u), top, hz(v)); K.set(hx(u), RY(v) - 1, hz(v), 'stucco_white'); for (let y2 = top + 1; y2 < RY(v) - 1; y2++) K.air(hx(u), y2, hz(v)); } else K.set(hx(u), top, hz(v), 'stucco_white'); }
    }
    // ---- the balcony over the terrace (first floor, garden side) with its door from the master bedroom
    if (b && f >= 2) {
      const y1 = Y(1), bu0 = 1, bu1 = Math.min(w - 2, 6);
      for (let v = d; v <= d + 1; v++) for (let u = bu0; u <= bu1; u++) K.set(hx(u), y1, hz(v), v === d + 1 ? S.trim : 'deck_wood');
      for (let u = bu0; u <= bu1; u++) K.set(hx(u), y1 + 1, hz(d + 1), S.rail);
      K.set(hx(bu0), y1 + 1, hz(d), S.rail); K.set(hx(bu1), y1 + 1, hz(d), S.rail);
      const du = Math.min(bu1 - 1, bu0 + 2);
      for (let i = 0; i < 2; i++) { K.box(hx(du + i), y1 + 1, hz(d - 1), hx(du + i), y1 + 2, hz(d - 1), 0); K.door(hx(du + i), y1 + 1, hz(d - 1), 0, S.tdoor, i); K.set(hx(du + i), y1 + 3, hz(d - 1), S.pano); }
      K.model('vm_garden_chair_rope', hx(bu1 - 1), y1 + 1, hz(d), 0); K.set(hx(bu0 + 1), y1 + 1, hz(d), 'vx_tech_planter');
    }
    // ---- the garden: terrace, pool, lawn, hedges, trees, lamps
    if (t) {
      const tv0 = d, tv1 = Math.min(D - HV - 2, d + 3), tu0 = 1, tu1 = Math.min(w - 2, 9);
      K.box(hx(tu0), 0, hz(tv0), hx(tu1), 0, hz(tv1), 'travertine');
      if (K.fits('vm_garden_dining_teak', hx(tu0 + 1), 1, hz(tv0 + 1), 0)) { K.model('vm_garden_dining_teak', hx(tu0 + 1), 1, hz(tv0 + 1), 0); for (let i = 0; i < 3; i++) { K.model('vm_garden_chair_rope', hx(tu0 + 1 + i), 1, hz(tv0), 2); K.model('vm_garden_chair_rope', hx(tu0 + 1 + i), 1, hz(tv0 + 3), 0); } }
      if (tu1 - tu0 >= 7) { K.model('vm_garden_lounger_teak', hx(tu1 - 2), 1, hz(tv0 + 1), 1); K.model('vm_garden_lounger_teak', hx(tu1 - 2), 1, hz(tv0 + 3), 1); K.model('vm_garden_parasol_sand', hx(tu1 - 3), 1, hz(tv0 + 1), 0); }
      K.model(rng.chance(0.5) ? 'vm_bbq' : 'vm_garden_kamado_green', hx(w - 2), 1, hz(d + 1), 3);
    }
    if (p && gd >= 7) {
      const pv0 = d + (t ? 4 : 1), pu0 = 2, pu1 = Math.min(w - 2, pu0 + 5), pv1 = pv0 + 2;
      K.box(hx(pu0), 0, hz(pv0), hx(pu1), 0, hz(pv1), 'water'); K.shell(hx(pu0 - 1), 0, hz(pv0 - 1), hx(pu1 + 1), 0, hz(pv1 + 1), 'pool_tile');
      if (K.fits('vm_garden_lounger_teak', hx(pu1 + 2), 1, hz(pv0), 3)) K.model('vm_garden_lounger_teak', hx(pu1 + 2), 1, hz(pv0), 3);
      K.model('vm_garden_poolladder_steel', hx(pu1), 1, hz(pv1 + 1), 0);
    }
    for (let v = 0; v < D; v++) { K.set(0, 1, v, 'vx_hedge'); K.set(W - 1, 1, v, 'vx_hedge'); }
    for (let u = 0; u < W; u++) { if (K.get(u, 1, D - 1) === 0) K.set(u, 1, D - 1, 'vx_hedge'); }
    K.tree(hx(w - 2), 1, hz(d + gd - 3), rng.chance(0.5) ? 'birch' : 'cherry', rng);
    K.set(hx(-1), 1, hz(d + 1), S.lamp); K.set(hx(w), 1, hz(d + 1), S.lamp);
    // ---- the front: path, letterbox, lamps, flower bed, the carport and the driveway
    K.box(hx(eu), 0, 0, hx(eu + 1), 0, hz(-1), 'paver_grey');
    for (let u = 0; u < W; u++) if (!(u >= hx(eu) && u <= hx(eu + 1)) && !(c && u >= hx(w) + 1) && K.get(u, 1, 0) === 0) K.set(u, 1, 0, 'vx_hedge');
    K.set(hx(eu - 1), 1, 0, 'vm_letterbox', { facing: 0, part: 0 });
    K.set(hx(eu - 1), 1, 1, S.lamp); K.set(hx(eu + 2), 1, 1, S.lamp);
    K.set(hx(w - 3), 1, 1, 'vx_flowerbed_roses'); K.set(hx(w - 4), 1, 1, 'vx_flowerbed_tulips'); K.set(hx(0), 1, 1, 'vx_flowerbed');
    if (c) {
      const cu0 = hx(w) + 1, cu1 = cu0 + 5, cv0 = 0, cv1 = 5;
      K.box(cu0, 0, cv0, cu1, 0, cv1, 'concrete_smooth');
      for (const [x, z] of [[cu0, cv0 + 1], [cu1, cv0 + 1], [cu0, cv1], [cu1, cv1]]) K.col(x, z, 1, 3, S.post);
      K.box(cu0 - 1, 4, cv0, cu1 + 1, 4, cv1 + 1, 'roof_charcoal'); K.box(cu0, 5, cv0, cu1, 5, cv1 + 1, 'roof_charcoal_slab', { type: 0 });
      K.car(cu0 + 2, cv0 + 1, 1, 0, rng.pick(['vx_car_black', 'vx_car_white', 'vx_car_red', 'vx_car_blue', 'vx_car_silver']));
      K.model('vm_mobility_wallbox_ev', cu1, 2, cv1 + 1, 0); K.set(cu0, 1, cv1 + 1, 'vx_crate');
    }
    // ---- interiors: every room by the villa designer, the stair cells left alone
    const H = { u0: HU, v0: HV, w, d, floors: floors.map(fl => ({ y: fl.y, rect: fl.rect, rooms: fl.rooms })), entry: { u: eu, n: 1 } };
    K.furnish(H, BASE, S.skin, rng, SH);
    K.grid.meta = { name: 'Modernes Haus', doors, floors: floors.map((fl, k) => Y(k) - BASE), sh: SH, top: (r ? top + 3 : top + 2) - BASE, lot: [W, D], anchor: [hx(eu), 0], rooms: floors.reduce((n, fl) => n + fl.rooms.length, 0) };
    return K.grid;
  }
  // the open living / dining / kitchen across the garden side, as zones of one room
  function living(u0, v0, u1, v1) {
    const rm = { u0, v0, u1, v1, type: 'living', doors: [], windows: [] }, W = u1 - u0 + 1;
    const kw = W >= 12 ? 5 : 4;
    if (W >= 15) rm.zones = [{ u0, v0, u1: u1 - kw - 4, v1, type: 'living' }, { u0: u1 - kw - 3, v0, u1: u1 - kw, v1, type: 'dining' }, { u0: u1 - kw + 1, v0, u1, v1, type: 'kitchen' }];
    else if (W >= 9) rm.zones = [{ u0, v0, u1: u1 - kw, v1, type: 'living' }, { u0: u1 - kw + 1, v0, u1, v1, type: 'kitchen' }];
    return rm;
  }
  function floorOf(type, S) { if (WET[type]) return 'floor_tile'; if (type === 'foyer' || type === 'gallery' || type === 'hall' || type === 'kitchen') return S.floorH; if (type === 'master' || type === 'kid' || type === 'guest' || type === 'bedroom') return 'floor_carpet'; return S.floorL; }
  Forge.register(def, build);
})(VR);

// ============================================================================
// 🏢 Hochhaus — a high-rise grammar: a podium over the whole lot, a slimmer
// shaft with setbacks, a crown (parapet garden, helipad or spire); the core at
// the back centre with a scissor staircase that reaches every floor and the
// roof, a glass lift shaft with ladders and doors on every storey, a service
// closet with a WC; the lobby (double height from twelve floors on) with a
// reception and a waiting group; every floor above split into units along a
// corridor — offices from the Modern Living pack or apartments furnished by
// the villa designer (living with an open kitchen, bedroom, bath). Five
// facades: Glas (curtain wall with slab bands), Beton (punched bays in
// micro-cement), Backstein (white clinker piers), Tech (panels, window bands,
// edge strips) and Sandstein (arched podium windows, cornices). Entrance with
// a canopy, forecourt with bollards, planters and lamps.
// ============================================================================
(function (VR) {
  'use strict';
  const Forge = VR.Forge; if (!Forge || !Forge.kit) return;
  const DIR = Forge.DIR;
  const STYLES = {
    glas: { name: 'Glas', wall: 'charcoal_panel', glass: 'panorama_black', spandrel: 'charcoal_panel', pier: 'black_metal', podium: 'charcoal_panel', floor: 'floor_porcelain', partition: 'stucco_white', door: 'door_glass_black', unitDoor: 'door_flush_white', curtain: true, trim: 'black_metal', lamp: 'vx_lamppost_black', skin: 'bauhaus' },
    beton: { name: 'Beton', wall: 'micro_cement', glass: 'window_black', spandrel: 'concrete_smooth', pier: 'micro_cement', podium: 'concrete_smooth', floor: 'floor_cement', partition: 'stucco_white', door: 'door_glass_black', unitDoor: 'door_flush_white', trim: 'concrete_smooth', lamp: 'vx_lamppost_black', skin: 'bauhaus', bay: 2, pitch: 3 },
    backstein: { name: 'Backstein', wall: 'white_clinker', glass: 'window_black', spandrel: 'charcoal_panel', pier: 'white_clinker', podium: 'charcoal_panel', floor: 'floor_oak', partition: 'stucco_white', door: 'door_glass_black', unitDoor: 'door_flush_oak', trim: 'charcoal_panel', lamp: 'vx_lamppost_black', skin: 'klinker', bay: 2, pitch: 3 },
    tech: { name: 'Tech', wall: 'vx_tech_white', glass: 'vx_window_tech', spandrel: 'vx_tech_band', pier: 'vx_tech_white', podium: 'vx_tech_gray', floor: 'vx_floor_plaza', partition: 'vx_tech_white', door: 'door_glass_black', unitDoor: 'door_strip_anthracite', trim: 'vx_tech_trim', lamp: 'vx_lamppost_tech', skin: 'bauhaus', band: true },
    sandstein: { name: 'Sandstein', wall: 'vx_sandstone', glass: 'window_black', spandrel: 'white_trim', pier: 'vx_sandstone', podium: 'bossed_stone', floor: 'floor_marble', partition: 'stucco_cream', door: 'door_glass_black', unitDoor: 'door_flush_oak', trim: 'white_trim', lamp: 'vx_lamppost', skin: 'classic', bay: 2, pitch: 3, arch: true },
  };
  const def = {
    id: 'tower', icon: '🏢', name: 'Hochhaus', en: 'High-rise', level: true, sh: 5,
    params: [
      { k: 'f', label: 'Stockwerke', min: 4, max: 80, def: 24, dim: true },
      { k: 'w', label: 'Breite', min: 12, max: 40, def: 20, dim: true },
      { k: 'd', label: 'Tiefe', min: 12, max: 40, def: 20, dim: true },
      { k: 'p', label: 'Sockel', min: 0, max: 3, def: 2 },
      { k: 's', label: 'Staffelungen', min: 0, max: 3, def: 1 },
      { k: 'c', label: 'Krone', min: 0, max: 3, def: 1, names: ['Flachdach', 'Dachgarten', 'Helipad', 'Spitze'] },
      { k: 'u', label: 'Nutzung', min: 0, max: 1, def: 0, names: ['Büros', 'Wohnungen'] },
    ],
    styles: Object.keys(STYLES).map(id => ({ id, name: STYLES[id].name })),
    lot: (P) => [P.params.w, P.params.d],
    describe: (P) => [P.params.f + ' Stockwerke', P.params.w + ' × ' + P.params.d, P.params.u ? 'Wohnungen' : 'Büros', ['Flachdach', 'Dachgarten', 'Helipad', 'Spitze'][P.params.c]],
  };

  function build(P, env) {
    const { f, w, d, p, s, c, u } = P.params, S = STYLES[P.style] || STYLES.glas, rng = Forge.rng(P, 'tower');
    const SH = u ? 4 : 5, apartments = !!u;
    const podium = Math.min(p, Math.max(0, f - 2));
    const double = f >= 12 && podium >= 1;                 // a double-height lobby
    const front = 2;                                         // the forecourt rows (v = 0, 1)
    const BASE = 1, Y = (k) => BASE + k * SH;               // the slab row of floor k; world F = row BASE
    const roofY = Y(f), crownH = c === 3 ? Math.max(8, Math.round(f / 3) + 6) : c === 2 ? 3 : 5;
    const K = Forge.kit(w, roofY + crownH + 6, d, -BASE);
    const minW = 10, minD = SH + 11;                       // the core, the corridor, a wall and a four-deep front unit
    const insMaxU = Math.max(0, Math.floor((w - minW) / 2)), insMaxV = Math.max(0, Math.floor((d - front - minD) / 2));
    // ---- the storey rectangles: podium over the lot, the shaft inset by two, every setback two more (as far as the lot allows)
    const setbackAt = []; for (let k = 1; k <= s; k++) setbackAt.push(podium + Math.round((f - podium) * k / (s + 1)));
    const rects = [];
    for (let k = 0; k < f; k++) {
      let ins = k >= podium && f - podium > 2 ? 2 : 0;
      for (const sb of setbackAt) if (k >= sb && sb < f - 1) ins += 2;
      const iu = Math.min(ins, insMaxU), iv = Math.min(ins, insMaxV);
      rects.push([iu, front + iv, w - 1 - iu, d - 1 - iv]);
    }
    const RT = rects[f - 1];
    // the core: stairwell (2 wide), a wall, the lift (2 × 2) with a closet behind it, a wall — 6 columns at the back centre
    const cu = (RT[0] + RT[2]) >> 1, CU0 = cu - 2, CV1 = RT[3] - 1, CV0 = CV1 - (SH + 1);
    const floorMat = (k) => (apartments ? (k & 1 ? 'floor_oak' : 'oak_herringbone') : (k === 0 ? S.floor : k & 1 ? 'carpet_cream' : 'floor_terrazzo'));
    // ---- ground: the forecourt and the footprint
    K.box(0, 0, 0, w - 1, 0, d - 1, 'paver_grey');
    for (let v = 0; v < front; v++) for (let x = 0; x < w; x++) if ((x + v) % 2 === 0 && v === 0) K.set(x, 0, v, 'granite_paver');
    // ---- slabs, walls and glazing per floor
    const glassAt = (k, i) => { if (S.curtain || S.band) return true; const ph = S.pitch || 3, bay = S.bay || 2; return (i % ph) < bay; };
    for (let k = 0; k < f; k++) {
      const [u0, v0, u1, v1] = rects[k], y0 = Y(k), below = k > 0 ? rects[k - 1] : null;
      // the slab: floor inside, the spandrel band on the edge; a setback leaves a terrace on the storey below
      for (let v = v0; v <= v1; v++) for (let x = u0; x <= u1; x++) K.set(x, y0, v, (x === u0 || x === u1 || v === v0 || v === v1) ? S.spandrel : floorMat(k));
      if (below) for (let v = below[1]; v <= below[3]; v++) for (let x = below[0]; x <= below[2]; x++) {
        if (x >= u0 && x <= u1 && v >= v0 && v <= v1) continue;
        K.set(x, y0, v, 'deck_wood');
        const edge = x === below[0] || x === below[2] || v === below[1] || v === below[3];
        if (edge) K.set(x, y0 + 1, v, 'glass_rail'); else if (((x * 7 + v * 13 + P.seed) % 11) === 0) K.set(x, y0 + 1, v, rng.chance(0.5) ? 'vx_bush' : 'vm_garden_raisedbed_corten', rng.chance(0.5) ? undefined : { facing: 0, part: 0 });
      }
      // the room: air
      K.box(u0 + 1, y0 + 1, v0 + 1, u1 - 1, y0 + SH - 1, v1 - 1, 0);
      // the walls: a sill row, glass rows, piers by rhythm; corners always solid
      let i = 0;
      const ring = []; for (let x = u0; x <= u1; x++) ring.push([x, v0]); for (let v = v0 + 1; v <= v1; v++) ring.push([u1, v]); for (let x = u1 - 1; x >= u0; x--) ring.push([x, v1]); for (let v = v1 - 1; v > v0; v--) ring.push([u0, v]);
      const isPodium = k < podium, corner = (x, v) => (x === u0 || x === u1) && (v === v0 || v === v1);
      for (const [x, v] of ring) {
        const side = v === v0 ? 0 : x === u1 ? 1 : v === v1 ? 2 : 3;
        const g = !corner(x, v) && glassAt(k, i++);
        for (let yy = y0 + 1; yy <= y0 + SH - 1; yy++) {
          const row = yy - y0;                                 // 1 = sill, 2..SH-1 = glazing rows
          let m = isPodium ? S.podium : S.wall, pr;
          if (S.curtain) { m = g ? S.glass : S.pier; }
          else if (S.band) { if (g && (row === 2 || row === 3)) { m = S.glass; pr = { facing: side }; } else if (row === SH - 1) m = S.trim; }
          else if (g && row >= 2) { if (S.arch && isPodium && row === SH - 1) { m = 'vx_window_arch'; pr = { facing: side }; } else m = S.glass; }
          if (!S.curtain && row === SH - 1 && !g && !isPodium && S.trim && (k === podium || k === f - 1)) m = S.trim;
          K.set(x, yy, v, m, pr);
        }
        if (S.curtain && isPodium) K.set(x, y0 + SH - 1, v, 'vx_led_strip', { facing: side });
      }
    }
    // the roof slab over the top storey, a parapet, the crown
    for (let v = RT[1]; v <= RT[3]; v++) for (let x = RT[0]; x <= RT[2]; x++) K.set(x, roofY, v, (x === RT[0] || x === RT[2] || v === RT[1] || v === RT[3]) ? S.spandrel : (c === 1 ? 'deck_wood' : c === 2 ? 'concrete_smooth' : 'paver_grey'));
    for (const [x, v] of ringOf(RT)) K.set(x, roofY + 1, v, c === 1 ? 'vx_hedge' : 'vx_railing_black');
    // ---- the core (every floor, up to the roof)
    const core = { CU0, CV0, CV1, cu };
    for (let k = 0; k < f; k++) {
      const y0 = Y(k);
      K.box(CU0 - 1, y0 + 1, CV0, CU0 - 1, y0 + SH - 1, CV1, S.partition);               // stair side wall
      K.box(CU0 + 2, y0 + 1, CV0, CU0 + 2, y0 + SH - 1, CV1, S.partition);               // wall between stair and lift / closet
      K.box(CU0 + 5, y0 + 1, CV0, CU0 + 5, y0 + SH - 1, CV1, S.partition);               // lift side wall
      K.box(CU0 + 3, y0 + 1, CV0 + 3, CU0 + 4, y0 + SH - 1, CV0 + 3, S.partition);       // lift back wall
      K.box(CU0 + 3, y0 + 1, CV0, CU0 + 4, y0 + SH - 1, CV0, 'glass');                   // lift front: glass with the doors
      K.door(CU0 + 3, y0 + 1, CV0, 0, S.door, 0); K.door(CU0 + 4, y0 + 1, CV0, 0, S.door, 1);
      K.box(CU0 + 3, y0, CV0 + 1, CU0 + 4, y0 + SH - 1, CV0 + 2, 0);                     // the shaft is open through every slab
      if (k === 0) K.box(CU0 + 3, y0, CV0 + 1, CU0 + 4, y0, CV0 + 2, 'light_panel');
      K.ladder(CU0 + 3, y0 + 1, y0 + SH - 1, CV0 + 2, 0); K.ladder(CU0 + 4, y0 + 1, y0 + SH - 1, CV0 + 2, 0);
      K.set(CU0 + 3, y0 + SH - 1, CV0 + 1, 'neon_white'); K.set(CU0 + 4, y0 + SH - 1, CV0 + 1, 'neon_white');
      // the closet behind the lift: WC and a server rack, its door from the far landing
      if (CV1 - (CV0 + 4) >= 1) {
        K.box(CU0 + 3, y0 + 1, CV0 + 4, CU0 + 4, y0 + SH - 1, CV1, 0);
        K.door(CU0 + 2, y0 + 1, CV1, 1, S.unitDoor, 0);
        K.model('vm_bath_wc_white', CU0 + 4, y0 + 1, CV0 + 4, 0); K.model(k & 1 ? 'vm_office_rack_server' : 'vm_office_printer_cabinet', CU0 + 3, y0 + 1, CV1, 2); K.set(CU0 + 3, y0 + SH - 1, CV0 + 5 <= CV1 ? CV0 + 5 : CV1, 'vx_spot');
      }
      // the corridor in front of the core: light
      for (let x = rects[k][0] + 2; x < rects[k][2] - 1; x += 3) K.set(x, y0 + SH - 1, CV0 - 1, 'vx_spot');
    }
    const sw = K.stairwell(CU0, BASE, CV0 + 1, f + 1, SH, S.spandrel === 'white_trim' ? 'marble_white_stairs' : 'concrete_smooth_stairs', 'concrete_smooth', 'vx_railing_black');
    for (let k = 0; k < f; k++) K.box(CU0, Y(k), CV0, CU0 + 1, Y(k), CV0, floorMat(k));   // the near landing is floor, never spandrel
    // the stair head on the roof: a small house over the stairwell with a door to the roof
    { const y0 = roofY; K.box(CU0 - 1, y0 + 1, CV0 - 1, CU0 + 2, y0 + 3, CV1 + 1, S.wall); K.box(CU0, y0 + 1, CV0, CU0 + 1, y0 + 3, CV1, 0); K.box(CU0 - 1, y0 + 4, CV0 - 1, CU0 + 2, y0 + 4, CV1 + 1, S.spandrel); K.box(CU0, y0 + 1, CV0 - 1, CU0 + 1, y0 + 2, CV0 - 1, 0); K.door(CU0, y0 + 1, CV0 - 1, 0, S.door, 0); K.door(CU0 + 1, y0 + 1, CV0 - 1, 0, S.door, 1); K.box(CU0, y0, CV0, CU0 + 1, y0, CV0, 'paver_grey'); K.set(CU0, y0 + 3, CV0 + 2, 'vx_spot'); }
    // ---- the lobby and the units
    const doors = [], floorsY = [];
    const info = { units: 0, rooms: 0 };
    for (let k = 0; k < f; k++) {
      const [u0, v0, u1, v1] = rects[k], y0 = Y(k), y = y0 + 1, IR = [u0 + 1, v0 + 1, u1 - 1, v1 - 1];
      floorsY.push(y0 - BASE);
      const WALLv = CV0 - 3;
      if (k === 0) {
        // the lobby takes the whole front, the glass entrance in the middle of the street wall
        const lob = { u0: IR[0], v0: IR[1], u1: IR[2], v1: WALLv - 1 };
        const dcu = (u0 + u1) >> 1;
        K.box(dcu - 1, y, v0, dcu, y + 1, v0, 0); K.door(dcu - 1, y, v0, 0, S.door, 0); K.door(dcu, y, v0, 0, S.door, 1);
        if (S.curtain) { K.set(dcu - 2, y, v0, S.pier); K.set(dcu + 1, y, v0, S.pier); K.set(dcu - 2, y + 1, v0, S.pier); K.set(dcu + 1, y + 1, v0, S.pier); }
        K.set(dcu - 1, y0, v0 - 1, 'concrete_smooth_stairs', { facing: 2, half: 0 }); K.set(dcu, y0, v0 - 1, 'concrete_smooth_stairs', { facing: 2, half: 0 });
        K.box(dcu - 3, y0 + 3, v0 - 2, dcu + 2, y0 + 3, v0 - 1, S.spandrel === 'white_trim' ? 'white_trim' : 'charcoal_panel');   // the canopy
        for (let x = dcu - 2; x <= dcu + 1; x++) K.set(x, y0 + 2, v0 - 1, 'vx_led_strip_warm', { facing: 2 });
        doors.push([dcu - 1, y - BASE, v0]); doors.push([dcu, y - BASE, v0]);
        K.box(lob.u0, y, lob.v0, lob.u1, y + SH - 2, lob.v1, 0);
        // the corridor wall between lobby and core zone: open in the middle (the way to the lift and the stairs)
        K.box(IR[0], y, WALLv, IR[2], y + SH - 2, WALLv, S.partition); K.box(cu - 2, y, WALLv, cu + 1, y + SH - 2, WALLv, 0);
        if (double) {
          // the lobby's void on the storey above: the slab goes where the lobby is, a railing stands at the gallery's opening
          const y1 = Y(1), r1 = rects[1], a = Math.max(r1[0] + 1, lob.u0), b = Math.min(r1[2] - 1, lob.u1), c0 = Math.max(r1[1] + 1, lob.v0), c1 = Math.min(r1[3] - 1, lob.v1);
          if (b >= a && c1 >= c0) K.box(a, y1, c0, b, y1 + SH - 1, c1, 0);
          for (let x = cu - 2; x <= cu + 1; x++) K.set(x, y1 + 1, WALLv, 'glass_rail');
        }
        K.lobby({ u0: lob.u0, v0: lob.v0, u1: lob.u1, v1: lob.v1, doors: [[dcu - 1, lob.v0], [dcu, lob.v0], [dcu - 1, lob.v0 + 1], [dcu, lob.v0 + 1], [cu - 2, lob.v1], [cu - 1, lob.v1], [cu, lob.v1], [cu + 1, lob.v1]] }, y, rng, { back: 2, h: double ? 2 * SH - 2 : SH - 2, off: 3 });
        // the units beside the core on the ground floor
        sideUnits(K, S, rng, IR, core, y, SH, k, apartments, rects[k], glassAt, info);
        continue;
      }
      // the corridor wall and the front units
      K.box(IR[0], y, WALLv, IR[2], y + SH - 2, WALLv, S.partition);
      if (!(double && k === 1)) {
        const fw = IR[2] - IR[0] + 1, nU = Math.max(1, Math.min(4, Math.floor(fw / 8))), cuts = [];
        for (let i = 1; i < nU; i++) cuts.push(IR[0] + Math.round(fw * i / nU));
        for (const x of cuts) K.box(x, y, IR[1], x, y + SH - 2, WALLv - 1, S.partition);
        for (let i = 0; i < nU; i++) {
          const U = { u0: i === 0 ? IR[0] : cuts[i - 1] + 1, v0: IR[1], u1: i === nU - 1 ? IR[2] : cuts[i] - 1, v1: WALLv - 1 };
          unit(K, S, rng, U, { side: 2, wallV: WALLv }, y, SH, k, apartments, rects[k], glassAt, info);
        }
      } else {
        // the gallery over the double-height lobby looks down through the opening in the corridor wall
        K.box(cu - 2, y, WALLv, cu + 1, y + SH - 2, WALLv, 0); for (let x = cu - 2; x <= cu + 1; x++) K.set(x, y, WALLv, 'glass_rail');
      }
      sideUnits(K, S, rng, IR, core, y, SH, k, apartments, rects[k], glassAt, info);
    }
    // ---- the crown
    const rc = (RT[0] + RT[2]) >> 1, rv = (RT[1] + RT[3]) >> 1;
    if (c === 1) {
      // the roof garden: lawn islands, hedges, loungers, a sofa group, lamps
      for (let v = rv; v <= RT[3] - 2; v++) for (let x = RT[0] + 2; x <= RT[2] - 2; x++) { if (x >= CU0 - 2 && x <= CU0 + 3 && v >= CV0 - 2) continue; if (x === rc || x === rc + 1) continue; K.set(x, roofY, v, 'grass_block'); }
      const px = RT[0] + 3, pv = RT[1] + 3;
      if (K.fits('vm_garden_lounger_teak', px, roofY + 1, pv, 1)) K.model('vm_garden_lounger_teak', px, roofY + 1, pv, 1);
      if (K.fits('vm_garden_lounger_teak', px, roofY + 1, pv + 2, 1)) K.model('vm_garden_lounger_teak', px, roofY + 1, pv + 2, 1);
      if (K.fits('vm_garden_sofa_rope', RT[2] - 4, roofY + 1, RT[1] + 2, 2)) K.model('vm_garden_sofa_rope', RT[2] - 4, roofY + 1, RT[1] + 2, 2);
      if (K.fits('vm_garden_firetable_concrete', RT[2] - 4, roofY + 1, RT[1] + 4, 0)) K.model('vm_garden_firetable_concrete', RT[2] - 4, roofY + 1, RT[1] + 4, 0);
      for (const [x, v] of [[RT[0] + 2, RT[3] - 2], [RT[2] - 2, RT[3] - 2], [RT[0] + 2, RT[1] + 2], [RT[2] - 2, RT[1] + 2]]) if (K.get(x, roofY + 1, v) === 0) K.set(x, roofY + 1, v, 'vx_garden_lamp');
      for (let x = RT[0] + 3; x <= RT[2] - 3; x += 4) if (K.get(x, roofY + 1, RT[3] - 3) === 0 && !(Math.abs(x - CU0 - 0.5) <= 3)) K.set(x, roofY + 1, RT[3] - 3, 'vx_bush');
    } else if (c === 2) {
      // the helipad: a disc of landing pad with a hazard ring, lights at the corners
      const r = Math.min(4, Math.floor(Math.min(RT[2] - RT[0], RT[3] - RT[1]) / 2) - 2), hx = rc, hv = Math.max(RT[1] + r + 1, rv - 2);
      for (let v = hv - r - 1; v <= hv + r + 1; v++) for (let x = hx - r - 1; x <= hx + r + 1; x++) { const dd = Math.hypot(x - hx, v - hv); if (dd <= r - 0.5) K.set(x, roofY, v, 'landing_pad'); else if (dd <= r + 0.8) K.set(x, roofY, v, 'hazard_stripes'); }
      for (const [x, v] of [[RT[0] + 1, RT[1] + 1], [RT[2] - 1, RT[1] + 1], [RT[0] + 1, RT[3] - 1], [RT[2] - 1, RT[3] - 1]]) K.set(x, roofY + 1, v, 'vx_lamppost_tech');
      K.set(hx, roofY + 1, hv - r - 1, 'vx_lamppost_tech'); K.set(hx, roofY + 1, hv + r + 1, 'vx_lamppost_tech');
    } else if (c === 3) {
      // the spire: a mast on a three-by-three base, a beacon on top
      K.box(rc - 1, roofY + 1, rv - 1, rc + 1, roofY + 2, rv + 1, S.spandrel); K.col(rc, rv, roofY + 3, roofY + crownH - 1, 'black_metal'); K.set(rc, roofY + crownH, rv, 'vx_lamppost_tech'); K.set(rc, roofY + Math.round(crownH / 2), rv, 'neon_white');
      for (const [x, v] of [[rc - 1, rv - 1], [rc + 1, rv + 1]]) K.set(x, roofY + 3, v, 'vx_lamppost_tech');
    } else {
      for (const [x, v] of [[RT[0] + 1, RT[1] + 1], [RT[2] - 1, RT[1] + 1], [RT[0] + 1, RT[3] - 1], [RT[2] - 1, RT[3] - 1]]) K.set(x, roofY + 1, v, 'vx_tech_planter');
    }
    // ---- the forecourt: bollards, planters, lamps, a bike rack
    const dcu = (rects[0][0] + rects[0][2]) >> 1;
    for (const x of [dcu - 4, dcu + 3]) if (x >= 0 && x < w) K.set(x, 1, 0, 'vx_bollard');
    for (const x of [1, w - 2]) K.set(x, 1, 0, S.lamp);
    K.set(dcu - 5 >= 0 ? dcu - 5 : 0, 1, 1, 'vx_tech_planter'); K.set(Math.min(w - 1, dcu + 4), 1, 1, 'vx_tech_planter');
    if (w >= 16 && K.fits('vm_mobility_bikerack_steel', w - 5, 1, 1, 0)) K.model('vm_mobility_bikerack_steel', w - 5, 1, 1, 0);
    K.grid.meta = { name: apartments ? 'Wohnturm' : 'Hochhaus', doors, floors: floorsY, sh: SH, top: roofY + crownH - BASE, lot: [w, d], anchor: [w >> 1, 0], units: info.units, rooms: info.rooms, landings: sw.landings };
    return K.grid;
  }
  const ringOf = (r) => { const out = []; for (let x = r[0]; x <= r[2]; x++) { out.push([x, r[1]]); out.push([x, r[3]]); } for (let v = r[1] + 1; v < r[3]; v++) { out.push([r[0], v]); out.push([r[2], v]); } return out; };
  // the units left and right of the core (their doors on the corridor)
  function sideUnits(K, S, rng, IR, core, y, SH, k, apartments, rect, glassAt, info) {
    const { CU0, CV0, CV1 } = core;
    const left = { u0: IR[0], v0: CV0 + 1, u1: CU0 - 2, v1: CV1 }, right = { u0: CU0 + 7, v0: CV0 + 1, u1: IR[2], v1: CV1 };
    for (const U of [left, right]) {
      if (U.u1 - U.u0 + 1 < 3) { K.box(U.u0, y, CV0, U.u1, y + SH - 2, CV1, S.partition); continue; }
      K.box(U.u0, y, CV0, U.u1, y + SH - 2, CV0, S.partition);                          // the unit's wall to the corridor
      if (U === right) K.box(CU0 + 6, y, CV0, CU0 + 6, y + SH - 2, CV1, S.partition);    // (the left unit's wall is the stair wall)
      unit(K, S, rng, U, { side: 0, wallV: CV0 }, y, SH, k, apartments, rect, glassAt, info);
    }
  }
  // one unit: its door in the corridor wall, then an office floor or an apartment (living + open kitchen, bedroom, bath)
  function unit(K, S, rng, U, dr, y, SH, k, apartments, rect, glassAt, info) {
    const w = U.u1 - U.u0 + 1, d = U.v1 - U.v0 + 1; if (w < 2 || d < 2) return;
    const cu = Math.min(U.u1, Math.max(U.u0, (U.u0 + U.u1) >> 1));
    K.box(cu, y, dr.wallV, cu, y + 1, dr.wallV, 0); K.door(cu, y, dr.wallV, dr.side === 2 ? 0 : 2, S.unitDoor, 0);
    const doorCell = dr.side === 2 ? [cu, U.v1] : [cu, U.v0];
    info.units++;
    // the exterior sides of the unit and its window cells
    const ext = [], wins = [];
    if (U.v0 === rect[1] + 1) ext.push(0); if (U.u1 === rect[2] - 1) ext.push(1); if (U.v1 === rect[3] - 1) ext.push(2); if (U.u0 === rect[0] + 1) ext.push(3);
    for (const s of ext) {
      if (s === 0 || s === 2) { const v = s === 0 ? U.v0 : U.v1, wv = s === 0 ? U.v0 - 1 : U.v1 + 1; for (let x = U.u0; x <= U.u1; x++) if (isGlassCell(K, x, y + 1, wv)) wins.push({ u: x, v, side: s, kind: S.curtain ? 'tall' : 'std2' }); }
      else { const x = s === 1 ? U.u1 : U.u0, wx = s === 1 ? U.u1 + 1 : U.u0 - 1; for (let v = U.v0; v <= U.v1; v++) if (isGlassCell(K, wx, y + 1, v)) wins.push({ u: x, v, side: s, kind: S.curtain ? 'tall' : 'std2' }); }
    }
    if (!apartments) {
      const n = K.office({ u0: U.u0, v0: U.v0, u1: U.u1, v1: U.v1, doors: [doorCell, [doorCell[0], doorCell[1] + (dr.side === 2 ? -1 : 1)]] }, y, rng, { windows: ext.length ? ext : [dr.side === 2 ? 0 : 2] });
      info.rooms++; void n; return;
    }
    // the apartment: living with an open kitchen toward the windows; bedroom and bath beside a small hall at the door
    const rooms = [], F0 = y - 1 - k * SH, fi = k;
    const deep = d >= 8 && w >= 7, towardDoor = dr.side === 2 ? 1 : -1;   // the back rooms sit at the door side
    if (deep) {
      const dl = Math.max(4, d - 4);                      // living depth
      const lv0 = dr.side === 2 ? U.v0 : U.v1 - dl + 1, lv1 = dr.side === 2 ? U.v0 + dl - 1 : U.v1;
      const wallV = dr.side === 2 ? lv1 + 1 : lv0 - 1;
      const bv0 = dr.side === 2 ? wallV + 1 : U.v0, bv1 = dr.side === 2 ? U.v1 : wallV - 1;
      K.box(U.u0, y, wallV, U.u1, y + SH - 2, wallV, S.partition);
      const hu0 = cu - 1, hu1 = cu;                        // the hall, two wide at the door
      K.box(hu0, y, wallV, hu1, y + 1, wallV, 0);           // open to the living room
      if (hu0 - 1 >= U.u0) K.box(hu0 - 1, y, bv0, hu0 - 1, y + SH - 2, bv1, S.partition);
      if (hu1 + 1 <= U.u1) K.box(hu1 + 1, y, bv0, hu1 + 1, y + SH - 2, bv1, S.partition);
      const bedU = [U.u0, hu0 - 2], bathU = [hu1 + 2, U.u1], bmid = (bv0 + bv1) >> 1;
      const living = { fi, u0: U.u0, v0: lv0, u1: U.u1, v1: lv1, type: 'living', doors: [{ u: hu0, v: dr.side === 2 ? lv1 : lv0, side: dr.side }, { u: hu1, v: dr.side === 2 ? lv1 : lv0, side: dr.side }], windows: wins.filter(wn => wn.v >= lv0 && wn.v <= lv1) };
      if (w >= 9 && dl >= 6) living.zones = [{ u0: U.u0, v0: lv0, u1: cu - 1, v1: lv1, type: 'living' }, { u0: cu, v0: lv0, u1: U.u1, v1: lv1, type: 'kitchen' }];
      rooms.push(living);
      if (bedU[1] - bedU[0] + 1 >= 3) { K.box(hu0 - 1, y, bmid, hu0 - 1, y + 1, bmid, 0); K.door(hu0 - 1, y, bmid, 3, S.unitDoor, 0); rooms.push({ fi, u0: bedU[0], v0: bv0, u1: bedU[1], v1: bv1, type: k & 1 ? 'master' : 'bedroom', doors: [{ u: bedU[1], v: bmid, side: 1 }], windows: wins.filter(wn => wn.v >= bv0 && wn.v <= bv1 && wn.u <= bedU[1]) }); }
      if (bathU[1] - bathU[0] + 1 >= 2) { K.box(hu1 + 1, y, bmid, hu1 + 1, y + 1, bmid, 0); K.door(hu1 + 1, y, bmid, 1, S.unitDoor, 0); rooms.push({ fi, u0: bathU[0], v0: bv0, u1: bathU[1], v1: bv1, type: 'bath', doors: [{ u: bathU[0], v: bmid, side: 3 }], windows: [] }); }
      K.set(cu, y + SH - 2, bmid, 'vx_spot');
    } else {
      const rm = { fi, u0: U.u0, v0: U.v0, u1: U.u1, v1: U.v1, type: w * d >= 20 ? 'living' : 'study', doors: [{ u: doorCell[0], v: doorCell[1], side: dr.side }], windows: wins };
      if (w >= 7 && d >= 5 && rm.type === 'living') rm.zones = [{ u0: U.u0, v0: U.v0, u1: cu - 1, v1: U.v1, type: 'living' }, { u0: cu, v0: U.v0, u1: U.u1, v1: U.v1, type: 'kitchen' }];
      rooms.push(rm);
    }
    const H = { u0: 0, v0: 0, w: rect[2] - rect[0] + 1, d: rect[3] - rect[1] + 1, floors: [], entry: { u: cu, n: 1 } };
    for (let i = 0; i <= fi; i++) H.floors.push({ y: i * SH, rect: [rect[0], rect[1], rect[2], rect[3]], rooms: i === fi ? rooms : [] });
    K.furnish(H, F0, S.skin, rng, SH);
    info.rooms += rooms.length;
    void towardDoor;
  }
  const isGlassCell = (K, x, y, v) => { const s = K.get(x, y, v); if (!s || s === K.KEEP) return false; const t = VR.R.types[VR.R.T.type[s]]; return !!t && /glass|window|panorama/.test(t.name); };
  Forge.register(def, build);
})(VR);

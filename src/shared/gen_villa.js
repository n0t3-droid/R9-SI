// ============================================================================
// The villa builder: turns a catalogue plan (gen_plan.js) into blocks — the
// foundation and slabs, exterior walls in the skin's material with a plinth
// and cornice bands, white partitions carved into rooms, doors and wide
// openings between rooms, windows sized by room type (floor-to-ceiling glass
// on the garden side, frosted glass in baths, clerestory bands in kitchens,
// arched or lintelled windows for the classic skins), the glass entrance with
// its canopy, straight or double stairs with a stairwell and railings,
// double-height voids, the family's signature features (Erker bays, balconies,
// the twin-column portico with a pediment, octagonal and round towers, the
// two-storey colonnade with a curved balustraded terrace, the arcaded loggia,
// quoins), the roof (22° hip in slate or terracotta, flat Bauhaus roof with a
// parapet, mansard with dormers), the attached double garage with its roof
// terrace or a carport, the driveway and the front garden, and the back garden
// with a travertine terrace, pergola, outdoor dining, BBQ, pool with loungers,
// lawn, beds, hedges, trees and path lights. Furnishing: gen_villa_rooms.js.
// ============================================================================
(function (VR) {
  'use strict';
  const VG = VR.VillageGen;
  if (!VG || !VG.plan2) return;
  const PLAN = VG.plan2, SKINS = PLAN.SKINS;
  PLAN.SH = 5;   // storey height: four blocks of room under a one-block slab (2.8 m rooms at villa scale)
  const CARS = ['vx_car_black', 'vx_car_white', 'vx_car_red', 'vx_car_blue', 'vx_car_silver'];
  const DIR = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const CIRC = { foyer: 1, hall: 1, gallery: 1 };
  const WET = { bath: 1, wc: 1, utility: 1, ensuite: 1, walkin: 1 };
  const GLASSY = { open: 1, living: 1, dining: 1, salon: 1, library: 1 };
  const SLEEP = { master: 1, kid: 1, guest: 1, bedroom: 1 };

  // mirror a plan left ↔ right so the garage can sit on either side
  function mirror(H) {
    const w = H.w, M = (u) => w - 1 - u;
    const mr = (r) => { const u0 = M(r.u1), u1 = M(r.u0); r.u0 = u0; r.u1 = u1; if (r.zones) r.zones.forEach(mr); };
    for (const fl of H.floors) { fl.rooms.forEach(mr); if (fl.rect) fl.rect = [M(fl.rect[2]), fl.rect[1], M(fl.rect[0]), fl.rect[3]]; }
    if (H.stairs) { if (H.stairs.double) { const a = M(H.stairs.u1); H.stairs.u1 = M(H.stairs.u0); H.stairs.u0 = a; } else H.stairs.u = M(H.stairs.u); }
    H.entry.u = M(H.entry.u + H.entry.n - 1);
    if (H.voidRect) H.voidRect = [M(H.voidRect[2]), H.voidRect[1], M(H.voidRect[0]), H.voidRect[3]];
    const f = H.features;
    if (f.erker) f.erker.side = f.erker.side === 3 ? 1 : 3;
    if (f.cantilever) { const a = M(f.cantilever.u1); f.cantilever.u1 = M(f.cantilever.u0); f.cantilever.u0 = a; }
    if (f.balcony) { const a = M(f.balcony.u1); f.balcony.u1 = M(f.balcony.u0); f.balcony.u0 = a; }
    if (f.portico) { const a = M(f.portico.u1); f.portico.u1 = M(f.portico.u0); f.portico.u0 = a; }
    if (f.towers) f.towers = f.towers.map(([u, v]) => [M(u), v]);
    if (f.roundTower) f.roundTower = [M(f.roundTower[0]), f.roundTower[1]];
    if (f.loggia) { const a = M(f.loggia.u1); f.loggia.u1 = M(f.loggia.u0); f.loggia.u0 = a; }
    if (f.poolHall) { const a = M(f.poolHall.u1); f.poolHall.u1 = M(f.poolHall.u0); f.poolHall.u0 = a; }
    H.mirrored = true;
    return H;
  }

  // ---------------------------------------------------------------- the low hip roof (22°): rings of half-slope pieces
  // rect [ua..ub] × [va..vb] at level y0 (the overhang included); fill = the opaque block under the slopes
  function hipRoof(P, ua, va, ub, vb, y0, kind, fill) {
    const spanU = ub - ua + 1, spanV = vb - va + 1, minSpan = Math.min(spanU, spanV), maxInset = (minSpan - 1) >> 1;
    const rows = minSpan & 1 ? 1 : 2, name = 'vx_hip_' + kind;
    for (let v = va; v <= vb; v++) for (let u = ua; u <= ub; u++) {
      const iu = Math.min(u - ua, ub - u), iv = Math.min(v - va, vb - v), inset = Math.min(iu, iv);
      const k = inset >> 1, up = inset & 1;
      for (let y = y0 + 1; y < y0 + k; y++) P(u, y, v, fill);
      if (inset === maxInset) {
        if ((maxInset & 1) === 0) { if (k > 0) P(u, y0 + k - 1, v, fill); P(u, y0 + k, v, 'roof_charcoal_slab', { type: 'bottom' }); continue; }
        if (rows === 1) { P(u, y0 + k, v, fill); continue; }
      }
      const fu = (u - ua < ub - u) ? 1 : 3, fv = (v - va < vb - v) ? 2 : 0;
      let facing = fu, part = up;
      if (iu < iv) facing = fu; else if (iv < iu) facing = fv; else part = up | ((((fv - fu) & 3) === 1 ? 1 : 2) << 1);
      P(u, y0 + k, v, name, { facing, part });
    }
    return y0 + (maxInset >> 1) + 1;
  }
  PLAN.hipRoof = hipRoof;
  // a 3 × 3 pyramid cap (45°) for towers
  function pyramid(P, cu, cv, y0, kind) {
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      if (a === 0 && b === 0) continue;
      const f = Math.abs(a) >= Math.abs(b) ? (a < 0 ? 1 : 3) : (b < 0 ? 2 : 0);
      P(cu + a, y0, cv + b, 'vx_roof_' + kind, { facing: f });
    }
    P(cu, y0, cv, 'roof_charcoal'); P(cu, y0 + 1, cv, 'vx_ridge_' + kind, { facing: 0 });
  }

  // ---------------------------------------------------------------- the builder
  // L: lot builder, lot: {w, d, F}, o: {rng, ground(u, v), beds, family?, skin?, storeys?}
  // The builder is a generator that yields between its phases, so one house is never a single long call (the planner
  // runs it in slices, see VG.planAdvance). PLAN.build runs it to the end for the callers that build a house at once.
  PLAN.buildSteps = function* (L, lot, o) {
    const cat = (o.index !== undefined && PLAN.CATALOGUE[o.index]) || (o.family && PLAN.CATALOGUE.find(c => c.make === PLAN.templates[o.family])) || PLAN.pick(lot.w, lot.d, o.rng);
    if (!cat) return null;
    // R9 Studio: a catalogue house the player re-built in the Crafter — build exactly the variant it was edited on,
    // then lay the design down (VR.Custom.applyTemplate / applyHouse at the end)
    const custom = VR.Custom && !o.noCustom ? VR.Custom.houseFor(PLAN.CATALOGUE.indexOf(cat)) : null;
    if (custom) o = Object.assign({}, o, { rng: new VR.RNG(custom.seed || 7), beds: custom.beds || 3, skin: custom.skin, mirror: !!custom.mirror, palms: false });
    // a template design owns its whole box: whatever the builder would put there is only noted (for the villagers' spots)
    const tpl = custom && VR.Custom.tplData(custom), L0 = L;
    let cap = null;
    if (tpl) {
      // the box: the lot and the template's own box (which can reach past the lot — steps, porticos, bay windows)
      const T = tpl, yLo = lot.F + T.y0, U0 = Math.min(0, T.u0), V0 = Math.min(0, T.v0), U1 = Math.max(lot.w, T.u0 + T.W), V1 = Math.max(lot.d, T.v0 + T.D), RT = VR.R.T, RB = VR.R.byName;
      cap = new Uint16Array(T.W * T.D * T.H);
      L = Object.assign({}, L0, {
        P(u, y, v, name, props) {
          if (u < U0 || v < V0 || u >= U1 || v >= V1 || y < yLo) { L0.P(u, y, v, name, props); return; }
          const tu = u - T.u0, tv = v - T.v0;
          if (tu >= 0 && tv >= 0 && tu < T.W && tv < T.D && y < yLo + T.H) cap[((y - yLo) * T.D + tv) * T.W + tu] = 1 + (typeof name === 'number' ? RT.type[name] : name && RB[name] ? RB[name].id : 0);
        },
      });
    }
    const rng = o.rng, F = lot.F, P = L.P;
    const skin = SKINS[o.skin] || SKINS[cat.skins[rng.int(cat.skins.length)]];
    const H = PLAN.scalePlan(cat.make({ rng, beds: o.beds, w: lot.w, d: lot.d, staffel: (skin.id === 'bauhaus' || skin.id === 'blacklabel' || skin.staffel) && rng.chance(0.5), cantilever: !!skin.cantilever }), PLAN.SCALE);
    const garageW = cat.garage ? PLAN.GARAGE_W : cat.carport ? PLAN.CARPORT_W : 0;
    const mirrored = o.mirror !== undefined ? !!o.mirror : rng.chance(0.5);
    if (mirrored) mirror(H);
    H.palms = !!(skin.palms || o.palms);
    // placement: the garage side gets the garage strip; the house sits at the front of the lot (portico houses two cells back)
    H.u0 = mirrored ? garageW : 0; H.v0 = cat.front || 0;
    H.u1 = H.u0 + H.w - 1; H.v1 = H.v0 + H.d - 1;
    const SH = PLAN.SH, Y1 = F + SH, w = H.w, d = H.d, W = w - 2, D = d - 2, storeys = H.storeys, top = F + storeys * SH;
    H.sh = SH; for (const fl of H.floors) fl.y = H.floors.indexOf(fl) * SH;
    if (H.stairs) H.stairs.n = SH - 1;
    const hp = (u, y, v, m, pr) => P(H.u0 + u, y, H.v0 + v, m, pr);
    const hbox = (u0, v0, y0, u1, v1, y1, m, pr) => { for (let v = v0; v <= v1; v++) for (let u = u0; u <= u1; u++) for (let y = y0; y <= y1; y++) hp(u, y, v, m, pr); };
    const VM = VR.VM, frameCol = skin.glass === 'window_white' ? 'white' : 'black';
    // a facade model (window assembly) along wall side s: its cells start at a0 along the wall (u for sides 0/2, v for 1/3) at the fixed wall coordinate
    const winAt = (name, s, a0, y, fixed) => {
      if (!VM || !VM.MODELS[name]) { for (let k = 0; k < 3; k++) hp((s & 1) ? fixed : a0 + k, y, (s & 1) ? a0 + k : fixed, skin.glass); return; }
      const cells = VM.cells(name, s), mn = Math.min(...cells.map(c => (s & 1) ? c[1] : c[0]));
      if (s & 1) VM.put(hp, fixed, y, a0 - mn, name, s); else VM.put(hp, a0 - mn, y, fixed, name, s);
    };
    const info = { beds: [], seats: [], work: [], door: null, outside: null, inside: null, chimney: null, table: null, lights: [], roofTop: top + 6, plan: H, skin: skin.id, family: H.family, cars: [], desks: [] };
    const wall = skin.wall, glass = skin.glass, yardY = F - 1;
    // modern skins: their own interior / entrance / garden doors and panorama glass instead of framed window units
    const IDOOR = skin.door || 'birch_door', PANO = skin.panorama || null;
    const gdoor = (u, y, v, facing, k) => {
      if (skin.terrace) { hp(u, y, v, skin.terrace, { facing, half: 0, hinge: k & 1, open: 0 }); hp(u, y + 1, v, skin.terrace, { facing, half: 1, hinge: k & 1, open: 0 }); }
      else { hp(u, y, v, 'vx_glass_door_black', { facing, open: 0 }); hp(u, y + 1, v, 'vx_glass_door_black', { facing, open: 0 }); }
    };
    const roomAt = [];   // per floor: Map "u,v" → room
    const findRoom = (rooms, key) => rooms.find(r => r.id === key) || rooms.find(r => r.type === key);
    // ---- ground fill under the whole lot (garden at yard level, house on a concrete foundation)
    for (let v = 0; v < lot.d; v++) for (let u = 0; u < lot.w; u++) {
      const gy = o.ground(u, v), inHouse = u >= H.u0 && u <= H.u1 && v >= H.v0 && v <= H.v1;
      if (inHouse) { for (let y = Math.min(gy, F) - 2; y < F; y++) P(u, y, v, 'concrete_smooth'); }
      else { for (let y = Math.min(gy, yardY) - 2; y < yardY; y++) P(u, y, v, 'dirt'); P(u, yardY, v, 'grass_block'); for (let y = yardY + 1; y <= F + 2; y++) P(u, y, v, null); }
    }
    hbox(-1, -3, F + 1, w, d + 2, top + 9, null);
    yield;
    // ---- per floor: slabs, walls, rooms
    for (const [fi, fl] of H.floors.entries()) {
      const y0 = F + fl.y, map = new Map(); roomAt.push(map);
      const rc = fl.rect || [0, 0, w - 1, d - 1]; fl.rect = rc;
      for (const r of fl.rooms) { r.fi = fi; r.doors = r.doors || []; r.windows = r.windows || []; r.w = r.u1 - r.u0 + 1; r.d = r.v1 - r.v0 + 1; for (let v = r.v0; v <= r.v1; v++) for (let u = r.u0; u <= r.u1; u++) map.set(u + ',' + v, r); if (r.zones) for (const z of r.zones) { z.parent = r; z.fi = fi; z.doors = r.doors; z.windows = r.windows; z.w = z.u1 - z.u0 + 1; z.d = z.v1 - z.v0 + 1; } }
      for (let v = 0; v < d; v++) for (let u = 0; u < w; u++) {
        const inRect = u >= rc[0] && u <= rc[2] && v >= rc[1] && v <= rc[3];
        if (!inRect) {
          // a staggered storey: the rest of the floor below is a roof terrace with a railing at its edges
          hp(u, y0, v, 'deck_wood');
          const edge = (u === 0 && !(mirrored && garageW >= 7)) || (u === w - 1 && !(!mirrored && garageW >= 7)) || v === 0 || v === d - 1;
          hp(u, y0 + 1, v, edge ? skin.rail : null); for (let y = y0 + 2; y <= y0 + SH - 1; y++) hp(u, y, v, null);
          continue;
        }
        const ring = u === rc[0] || u === rc[2] || v === rc[1] || v === rc[3], r = map.get(u + ',' + v);
        hp(u, y0, v, ring ? (fi === 0 ? skin.plinth : skin.band) : r ? floorOf(r, skin) : 'floor_oak');
        for (let y = y0 + 1; y <= y0 + SH - 1; y++) hp(u, y, v, ring ? wall : r ? null : 'stucco_white');
      }
      yield;
    }
    // top ceiling (white underside) inside the walls
    const TR = H.floors[H.floors.length - 1].rect;
    for (let v = TR[1] + 1; v < TR[3]; v++) for (let u = TR[0] + 1; u < TR[2]; u++) hp(u, top, v, 'floor_oak');
    // ---- openings between rooms
    for (const [fi, fl] of H.floors.entries()) {
      const y0 = F + fl.y;
      for (const r of fl.rooms) {
        for (const key of [r.to, r.to2]) {
          if (!key) continue;
          const t = findRoom(fl.rooms, key); if (!t || t === r) continue;
          const sh = PLAN.shared(r, t); if (!sh) continue;
          const cells = sh.cells, len = cells.length, side = sh.side;
          const wide = key === r.to ? (r.wide || 0) : 0;
          const n = wide ? Math.min(wide, len) : 1;
          const i0 = len >= 3 && n === 1 ? Math.max(1, Math.min(len - 2, len >> 1)) : Math.max(0, (len - n) >> 1);
          for (let k = 0; k < n; k++) {
            const [wu, wv] = cells[i0 + k];
            hp(wu, y0 + 1, wv, null); hp(wu, y0 + 2, wv, null);
            if (n > 1) for (let y = y0 + 3; y <= y0 + SH - 1; y++) hp(wu, y, wv, null);
            else { hp(wu, y0 + 1, wv, IDOOR, { facing: side, half: 0, hinge: 0, open: 0 }); hp(wu, y0 + 2, wv, IDOOR, { facing: side, half: 1, hinge: 0, open: 0 }); }
            r.doors.push({ u: wu - DIR[side][0], v: wv - DIR[side][1], side });
            t.doors.push({ u: wu + DIR[side][0], v: wv + DIR[side][1], side: (side + 2) & 3 });
          }
        }
      }
    }
    yield;
    // ---- windows on the outside walls
    for (const [fi, fl] of H.floors.entries()) {
      const y0 = F + fl.y;
      for (const r of fl.rooms) {
        const sides = [], rc = fl.rect;
        if (r.v0 === rc[1] + 1 && !(r.type === 'foyer' || r.type === 'hall')) sides.push(0);
        if (r.v1 === rc[3] - 1) sides.push(2);
        if (r.u0 === rc[0] + 1) sides.push(3);
        if (r.u1 === rc[2] - 1) sides.push(1);
        for (const s of sides) {
          const kind = winKind(r, s, fi); if (!kind) continue;
          const along = (s === 0 || s === 2) ? [r.u0, r.u1] : [r.v0, r.v1], len = along[1] - along[0] + 1;
          const runs = [];
          if (kind === 'tall') { if (len >= 3) runs.push([along[0] + 1, along[1] - 1]); else runs.push([along[0], along[1]]); }
          else {
            const wide = kind === 'frosted' ? 1 : kind === 'std3' || kind === 'high' ? Math.min(3, len) : Math.min(2, len);
            if (len >= 7 && kind !== 'frosted') { runs.push([along[0] + 1, along[0] + wide]); runs.push([along[1] - wide, along[1] - 1]); }
            else { const st = along[0] + Math.floor((len - wide) / 2); runs.push([st, st + wide - 1]); }
          }
          for (const [a0, a1] of runs) {
            // the run becomes window assemblies (VX32 models, 3/2/1 blocks wide) sitting in the wall: one frame, mullions, sill
            const fixed = (s === 0 || s === 2) ? (s === 0 ? rc[1] : rc[3]) : (s === 3 ? rc[0] : rc[2]);
            const mk = kind === 'tall' || kind === 'tall2' ? 'tall' : kind === 'high' ? 'high' : kind === 'frosted' ? 'frosted' : (skin.arches && fi === 0 ? 'arch' : 'std');
            const yb = mk === 'high' || mk === 'frosted' ? y0 + SH - 2 : y0 + 1;
            if (PANO) {
              // panorama glass straight in the wall: the frames join over the whole run (connected textures)
              const blk = mk === 'frosted' ? PANO.frosted : PANO.glass;
              const ya = mk === 'frosted' ? y0 + 2 : mk === 'high' ? y0 + SH - 2 : y0 + 1, yz = mk === 'tall' ? y0 + SH - 1 : mk === 'frosted' ? y0 + 3 : mk === 'high' ? y0 + SH - 2 : y0 + SH - 2;
              for (let a2 = a0; a2 <= a1; a2++) for (let y = ya; y <= yz; y++) hp((s & 1) ? fixed : a2, y, (s & 1) ? a2 : fixed, blk);
            } else {
              let a = a0;
              while (a <= a1) {
                const n = a1 - a + 1, wdt = mk === 'frosted' ? 1 : (n % 3 === 1 && n > 1) ? 2 : Math.min(3, n);
                winAt('vm_win_' + mk + wdt + '_' + frameCol, s, a, yb, fixed);
                a += wdt;
              }
            }
            for (let a2 = a0; a2 <= a1; a2++) {
              const u = (s === 0 || s === 2) ? a2 : fixed, v = (s === 0 || s === 2) ? fixed : a2;
              if (mk === 'std' && skin.lintels) hp(u, y0 + SH - 1, v, skin.trim);
              r.windows.push({ u: (s === 0 || s === 2) ? a2 : (s === 3 ? rc[0] + 1 : rc[2] - 1), v: (s === 0 || s === 2) ? (s === 0 ? rc[1] + 1 : rc[3] - 1) : a2, side: s, kind });
            }
          }
          // terrace doors: the open room / dining / foyer / salon / kitchen-only houses open to the garden in the middle of the glass wall
          if (s === 2 && fi === 0 && (r.type === 'open' || r.type === 'dining' || r.type === 'foyer' || r.type === 'library' || r.type === 'salon')) {
            const zone = r.zones ? (r.zones.find(z => z.type === 'dining') || r.zones[0]) : r;
            const cu = (zone.u0 + zone.u1) >> 1;
            for (const u of [cu, cu + 1]) { gdoor(u, y0 + 1, d - 1, 2, u - cu); for (let y = y0 + 3; y <= y0 + SH - 1; y++) hp(u, y, d - 1, glass); r.doors.push({ u, v: D, side: 2 }); }
            hp(cu, F, d, skin.plinth + '_stairs', { facing: 0, half: 0 }); hp(cu + 1, F, d, skin.plinth + '_stairs', { facing: 0, half: 0 });
            r.terraceDoor = [cu, D];
          }
        }
        // balconies: a glass door out of the room on the garden side (upper floor)
        if (r.balcony && fi > 0 && r.v1 === D) { const y0b = y0; const bu = r.u0 + 1; for (const u of [bu, bu + 1]) { gdoor(u, y0b + 1, d - 1, 2, u - bu); for (let y = y0b + 3; y <= y0b + SH - 1; y++) hp(u, y, d - 1, glass); r.doors.push({ u, v: D, side: 2 }); } }
        if (r.terrace && fi > 0 && garageW >= 7) { const gs = mirrored ? 3 : 1, uw = gs === 1 ? w - 1 : 0, ur = gs === 1 ? W : 1; if ((gs === 1 && r.u1 === W) || (gs === 3 && r.u0 === 1)) { const v = r.v0 + 2; gdoor(uw, y0 + 1, v, gs, 0); r.doors.push({ u: ur, v, side: gs }); r.windows = r.windows.filter(wn => !(wn.side === gs && wn.v === v)); } }
      }
      yield;
    }
    // ---- entrance: glass double door, side lights, canopy, sconces, the step
    const E = H.entry;
    for (let k = 0; k < E.n; k++) {
      if (skin.entry) { const hg = E.n === 2 ? k : 0; hp(E.u + k, F + 1, 0, skin.entry, { facing: 0, half: 0, hinge: hg, open: 0 }); hp(E.u + k, F + 2, 0, skin.entry, { facing: 0, half: 1, hinge: hg, open: 0 }); }
      else { hp(E.u + k, F + 1, 0, 'vx_glass_door_black', { facing: 0, open: 0 }); hp(E.u + k, F + 2, 0, 'vx_glass_door_black', { facing: 0, open: 0 }); }
      for (let y = F + 3; y <= F + SH - 1; y++) hp(E.u + k, y, 0, glass);
    }
    for (const u of [E.u - 1, E.u + E.n]) if (u > 0 && u < w - 1) { if (PANO) { for (let y = F + 1; y <= F + SH - 1; y++) hp(u, y, 0, PANO.glass); } else winAt('vm_win_tall1_' + frameCol, 0, u, F + 1, 0); }
    if (H.features.canopy) {
      for (let u = E.u - 1; u <= E.u + E.n; u++) { hp(u, Y1, -1, skin.canopy === 'roof_charcoal_slab' ? 'roof_charcoal_slab' : skin.canopy, skin.canopy === 'roof_charcoal_slab' ? { type: 'top' } : undefined); hp(u, Y1, -2, skin.canopy === 'roof_charcoal_slab' ? 'roof_charcoal_slab' : skin.canopy + '_slab', { type: 'top' }); hp(u, Y1 - 1, -1, 'vx_led_cove', { facing: 0 }); }
      if (skin.column === 'vx_column_classic') for (const u of [E.u - 1, E.u + E.n]) for (let y = F + 1; y <= Y1 - 1; y++) hp(u, y, -2, skin.column);
    }
    const lantern = VM && VM.MODELS.vm_wall_lantern ? 'vm_wall_lantern' : 'vx_sconce';
    hp(E.u - 1, F + 2, -1, lantern, { facing: 0 }); hp(E.u + E.n, F + 2, -1, lantern, { facing: 0 });
    if (VM && VM.MODELS.vm_house_sign) { hp(E.u + E.n, F + 3, -1, 'vm_house_sign', { facing: 0 }); if (!H.features.portico && E.u - 2 >= 0) hp(E.u - 2, F + 1, -1, 'vm_letterbox', { facing: 0 }); }
    for (let k = 0; k < E.n; k++) hp(E.u + k, F, -1, skin.plinth + '_stairs', { facing: 2, half: 0 });
    info.door = [H.u0 + E.u + (E.n >> 1), F + 1, H.v0]; info.outside = [H.u0 + E.u + (E.n >> 1), F, H.v0 - 2]; info.inside = [H.u0 + E.u + (E.n >> 1), F + 1, H.v0 + (H.stairs && H.stairs.double ? 1 : 2)];
    yield;
    // ---- stairs & voids
    const G0 = H.floors[0].rooms, U1 = H.floors[1] ? H.floors[1].rooms : [];
    if (H.stairs) {
      const S = H.stairs, runs = S.double ? [S.u0, S.u1] : [S.u];
      for (const su of runs) {
        for (let k = 0; k < S.n; k++) { hp(su, F + 1 + k, S.v0 + k, 'marble_white_stairs', { facing: 2, half: 0 }); for (let y = F + 1; y < F + 1 + k; y++) hp(su, y, S.v0 + k, 'marble_white'); hp(su, Y1, S.v0 + k, null); }
        const gal = U1.find(r => r.type === 'gallery');
        const openSide = gal && su - 1 >= gal.u0 && su - 1 <= gal.u1 && !(S.double) ? -1 : 1;
        if (!S.double) { for (let k = 0; k < S.n; k++) hp(su + openSide, Y1 + 1, S.v0 + k, skin.rail); if (S.v0 - 1 >= 1) hp(su, Y1 + 1, S.v0 - 1, skin.rail); }
        for (const r of G0) if (su >= r.u0 && su <= r.u1) for (let k = 0; k < S.n + 1; k++) r.doors.push({ u: su, v: S.v0 + k, side: 2 });
        for (const r of U1) if (su >= r.u0 && su <= r.u1) { for (let k = 0; k <= S.n; k++) r.doors.push({ u: su, v: S.v0 + k, side: 0 }); if (!S.double) { r.doors.push({ u: su + openSide, v: S.v0 + S.n, side: 0 }); for (let k = 0; k < S.n; k++) r.doors.push({ u: su + openSide, v: S.v0 + k, side: 0 }); } }
      }
      if (S.double) { for (let u = S.u0; u <= S.u1; u++) hp(u, Y1, S.v0 + S.n, 'marble_white'); }
    }
    if (H.voidRect) {
      const [a, b, c2, d2] = H.voidRect;
      for (let v = b; v <= d2; v++) for (let u = a; u <= c2; u++) hp(u, Y1, v, null);
      for (let u = a; u <= c2; u++) hp(u, Y1 + 1, d2 + 1, skin.rail === 'glass_rail' ? 'glass_rail' : 'vx_balustrade');
      for (const u of [a, c2]) for (let v = b; v <= d2; v++) { const rr = roomAt[1].get(u + ',' + v); if (rr && (rr.type === 'gallery')) hp(u, Y1 + 1, v, 'vx_balustrade'); }
      for (const r of U1) for (let u = a; u <= c2; u++) if (u >= r.u0 && u <= r.u1 && d2 + 1 >= r.v0 && d2 + 1 <= r.v1) r.doors.push({ u, v: d2 + 1, side: 0 });
      // the two-storey glass over the entrance
      for (let u = a; u <= c2; u++) for (let y = Y1 + 1; y <= top - 1; y++) hp(u, y, 0, glass);
      hp((a + c2) >> 1, top - 1, (b + d2) >> 1, 'vx_chandelier'); info.lights.push([H.u0 + ((a + c2) >> 1), top - 1, H.v0 + ((b + d2) >> 1)]);
    }
    yield;
    // ---- signature features
    const FT = H.features;
    if (FT.erker) {
      const e = FT.erker, eu = e.side === 3 ? -1 : w, wu = e.side === 3 ? 0 : w - 1;
      for (let v = e.v0; v <= e.v1; v++) { hp(eu, F, v, skin.plinth); for (let y = F + 1; y <= Y1 - 1; y++) { hp(eu, y, v, glass); hp(wu, y, v, null); } hp(eu, Y1, v, skin.trim); hp(eu, Y1 + 1, v, 'roof_charcoal_slab', { type: 'bottom' }); }
      const rr = roomAt[0].get((e.side === 3 ? 1 : W) + ',' + e.v0); if (rr) for (let v = e.v0; v <= e.v1; v++) rr.windows.push({ u: e.side === 3 ? 1 : W, v, side: e.side, kind: 'tall' });
    }
    if (FT.balcony) {
      const b = FT.balcony;
      for (let v = d; v < d + b.deep; v++) for (let u = b.u0; u <= b.u1; u++) hp(u, Y1, v, 'travertine');
      for (let u = b.u0; u <= b.u1; u++) hp(u, Y1 + 1, d + b.deep - 1, skin.rail);
      for (let v = d; v < d + b.deep - 1; v++) { hp(b.u0, Y1 + 1, v, skin.rail); hp(b.u1, Y1 + 1, v, skin.rail); }
      for (const u of [b.u0, b.u1]) for (let y = F; y <= Y1 - 1; y++) hp(u, y, d + b.deep - 1, skin.column);
      hp(b.u0 + 1, Y1 + 1, d, 'vx_lounger', { facing: 0 }); hp(b.u1 - 1, Y1 + 1, d, 'vx_tech_planter'); info.seats.push([H.u0 + b.u0 + 1, Y1 + 1, H.v0 + d, 0]);
      hp((b.u0 + b.u1) >> 1, Y1 - 1, d, 'vx_led_cove', { facing: 2 });
    }
    if (FT.portico) {
      const p = FT.portico, pu0 = p.u0, pu1 = p.u1;
      for (let v = -2; v <= -1; v++) for (let u = pu0; u <= pu1; u++) { hp(u, F, v, 'travertine'); for (let y = F + 1; y <= top - 1; y++) hp(u, y, v, null); }
      for (let u = pu0; u <= pu1; u++) hp(u, F, -3, 'travertine_stairs', { facing: 2, half: 0 });
      for (const u of [pu0, pu0 + 1, pu1 - 1, pu1]) for (let y = F + 1; y <= top - 1; y++) hp(u, y, -2, 'vx_column_classic');
      hbox(pu0 - 1, -3, top, pu1 + 1, -1, top, skin.trim);
      const cu = (pu0 + pu1) >> 1;
      for (let k = 0; k < 4; k++) { const y = top + 1 + k, half = 3 - k; for (let u = cu - half; u <= cu + half; u++) for (let v = -3; v <= -1; v++) hp(u, y, v, (u === cu - half || u === cu + half) && half > 0 ? skin.trim + '_stairs' : skin.trim, (u === cu - half || u === cu + half) && half > 0 ? { facing: u < cu ? 1 : 3, half: 0 } : undefined); }
      for (let u = pu0 + 2; u <= pu1 - 2; u++) hp(u, top - 1, -2, 'vx_spot'); hp(cu, top - 2, -1, 'vx_chandelier');
      info.outside = [H.u0 + cu, F, H.v0 - 4];
    }
    if (FT.frontBalconies) {
      for (const [a, b] of [[2, 4], [w - 5, w - 3]]) {
        for (let v = -2; v <= -1; v++) for (let u = a; u <= b; u++) hp(u, Y1, v, 'travertine');
        for (let u = a; u <= b; u++) hp(u, Y1 + 1, -2, 'vx_balustrade'); hp(a, Y1 + 1, -1, 'vx_balustrade'); hp(b, Y1 + 1, -1, 'vx_balustrade');
        for (const u of [a, b]) for (let y = F + 1; y <= Y1 - 1; y++) hp(u, y, -2, 'vx_column_classic');
        for (let u = a; u <= b; u++) hp(u, Y1 - 1, -1, 'vx_led_strip_warm', { facing: 0 });
        const rr = roomAt[1].get(((a + b) >> 1) + ',1'); if (rr) { const du = (a + b) >> 1; gdoor(du, Y1 + 1, 0, 0, 0); rr.doors.push({ u: du, v: 1, side: 0 }); rr.windows = rr.windows.filter(wn => !(wn.side === 0 && wn.u === du)); }
      }
    }
    yield;
    if (FT.towers) for (const [tu, tv] of FT.towers) {
      // octagonal corner tower through both storeys: the house corner opens into it, windows on the outward faces
      const ring = []; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (a || b) ring.push([tu + a, tv + b]);
      const inner = (u, v) => u >= 1 && u <= W && v >= 1 && v <= D;
      hbox(tu - 1, tv - 1, F + 1, tu + 1, tv + 1, top + 5, null);
      for (const [u, v] of ring) { if (inner(u, v)) continue; hp(u, F, v, skin.plinth); hp(u, Y1, v, skin.band); for (let y = F + 1; y <= top + 1; y++) if (y !== Y1) { const ly = (y - F) % SH; hp(u, y, v, (u === tu || v === tv) && y !== top + 1 && ly >= 1 && ly <= SH - 2 ? glass : wall); } }
      hp(tu, F, tv, 'floor_marble'); hp(tu, Y1, tv, 'floor_marble'); for (let y = F + 1; y <= Y1 - 1; y++) hp(tu, y, tv, null); for (let y = Y1 + 1; y <= top - 1; y++) hp(tu, y, tv, null);
      for (const [u, v] of ring) if (inner(u, v)) { hp(u, F, v, 'floor_marble'); hp(u, Y1, v, 'floor_marble'); }
      const wcell = [[tu, tv + (tv === 0 ? 1 : -1)], [tu + (tu === 0 ? 1 : -1), tv]];
      for (const [u, v] of wcell) { for (let y = F + 1; y <= Y1 - 1; y++) hp(u, y, v, null); for (let y = Y1 + 1; y <= top - 1; y++) hp(u, y, v, null); hp(u, F, v, 'floor_marble'); hp(u, Y1, v, 'floor_marble'); }
      hbox(tu - 1, tv - 1, top + 2, tu + 1, tv + 1, top + 2, skin.trim);
      pyramid(hp, tu, tv, top + 3, 'slate');
      hp(tu, Y1 - 1, tv, 'vx_pendant_brass'); hp(tu, top - 1, tv, 'vx_pendant_brass');
    }
    yield;
    if (FT.roundTower) {
      const [tu, tv] = FT.roundTower;
      const inner = (u, v) => u >= 1 && u <= W && v >= 1 && v <= D;
      hbox(tu - 1, tv - 1, F + 1, tu + 1, tv + 1, top + 6, null);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        const u = tu + a, v = tv + b;
        if (!a && !b) continue;
        if (inner(u, v)) { hp(u, F, v, 'floor_terrazzo'); hp(u, Y1, v, 'floor_terrazzo'); continue; }
        const corner = a && b;
        hp(u, F, v, skin.plinth); hp(u, Y1, v, skin.band);
        for (let y = F + 1; y <= top + 3; y++) { if (y === Y1) continue; const ly = (y - F) % SH; if (corner) hp(u, y, v, wall + '_stairs', { facing: a < 0 ? (b < 0 ? 1 : 1) : 3, half: ly === SH - 1 ? 1 : 0 }); else hp(u, y, v, (ly === 2 || ly === 1) ? ((ly === 2) ? 'vx_window_arch' : glass) : wall, (ly === 2) ? { facing: a ? (a < 0 ? 3 : 1) : (b < 0 ? 0 : 2) } : undefined); }
      }
      hp(tu, F, tv, 'floor_terrazzo'); hp(tu, Y1, tv, 'floor_terrazzo'); for (let y = F + 1; y <= Y1 - 1; y++) hp(tu, y, tv, null); for (let y = Y1 + 1; y <= top + 3; y++) if (y !== top) hp(tu, y, tv, null);
      hp(tu, top, tv, 'floor_terrazzo');
      for (const [u, v] of [[tu, tv + (tv === 0 ? 1 : -1)], [tu + (tu === 0 ? 1 : -1), tv]]) { for (let y = F + 1; y <= Y1 - 1; y++) hp(u, y, v, null); for (let y = Y1 + 1; y <= top - 1; y++) hp(u, y, v, null); hp(u, F, v, 'floor_terrazzo'); hp(u, Y1, v, 'floor_terrazzo'); }
      pyramid(hp, tu, tv, top + 4, 'terracotta');
      hp(tu, Y1 - 1, tv, 'vx_pendant_brass'); hp(tu, top - 1, tv, 'vx_pendant_brass'); hp(tu, top + 3, tv, 'vx_pendant_brass');
    }
    yield;
    if (FT.colonnade) {
      // six two-storey marble columns in front of the garden facade, a balcony between the wall and the columns, an entablature
      const cols = []; for (let u = 1; u <= w - 2; u += 3) cols.push(u);
      for (const u of cols) for (let y = F; y <= top - 1; y++) hp(u, y, d + 1, 'vx_column_classic');
      for (let u = 0; u < w; u++) { hp(u, Y1, d, 'travertine'); hp(u, Y1 + 1, d, 'vx_balustrade'); }
      hbox(-1, d, top, w, d + 1, top, skin.trim);
      for (let u = 2; u < w - 1; u += 3) hp(u, top - 1, d, 'vx_spot');
      hp(2, Y1 + 1, d, 'vx_tech_planter'); hp(w - 3, Y1 + 1, d, 'vx_tech_planter');
      const m = U1.find(r => r.balcony); if (m) { m.doors.push({ u: m.u0 + 1, v: D, side: 2 }); }
    }
    if (FT.loggia) {
      const lg = FT.loggia;
      for (let v = d; v <= d + 1; v++) for (let u = lg.u0 - 1; u <= lg.u1 + 1; u++) hp(u, Y1, v, 'travertine');
      for (let u = lg.u0 - 1; u <= lg.u1 + 1; u++) hp(u, Y1 + 1, d + 1, 'vx_balustrade'); hp(lg.u0 - 1, Y1 + 1, d, 'vx_balustrade'); hp(lg.u1 + 1, Y1 + 1, d, 'vx_balustrade');
      for (const u of [lg.u0 - 1, (lg.u0 + lg.u1) >> 1, lg.u1 + 1]) for (let y = F; y <= Y1 - 1; y++) hp(u, y, d + 1, 'vx_column_classic');
      for (let u = lg.u0; u <= lg.u1; u++) if (u !== ((lg.u0 + lg.u1) >> 1)) hp(u, Y1 - 1, d + 1, skin.wall + '_stairs', { facing: 0, half: 1 });
      hp(lg.u0 + 1, Y1 + 1, d, 'vx_lounger', { facing: 0 }); hp(lg.u1 - 1, Y1 + 1, d, 'vx_lounger', { facing: 0 }); info.seats.push([H.u0 + lg.u0 + 1, Y1 + 1, H.v0 + d, 0]);
      hp((lg.u0 + lg.u1) >> 1, Y1 - 1, d, 'vx_pendant_brass');
      const k2 = U1.find(r => r.u0 === 1 && r.v1 === D); if (k2) { const bu = k2.u0 + 1; for (const u of [bu, bu + 1]) { gdoor(u, Y1 + 1, d - 1, 2, u - bu); for (let y = Y1 + 3; y <= top - 1; y++) hp(u, y, d - 1, glass); k2.doors.push({ u, v: D, side: 2 }); } }
    }
    yield;
    if (skin.quoins || FT.quoins) for (const [u, v] of [[0, 0], [w - 1, 0], [0, d - 1], [w - 1, d - 1]]) for (let y = F + 1; y < top; y++) if ((y - F) & 1) hp(u, y, v, skin.trim);
    if (H.features.cantilever && H.floors[1]) {
      // Black Label: the upper floor pushes a glass box out over the entrance canopy
      const c = H.features.cantilever, rr = roomAt[1].get(((c.u0 + c.u1) >> 1) + ',1');
      for (let u = c.u0 - 1; u <= c.u1 + 1; u++) { hp(u, Y1, -1, skin.accent); hp(u, top, -1, skin.accent); for (let y = Y1 + 1; y <= top - 1; y++) { hp(u, y, -1, (u === c.u0 - 1 || u === c.u1 + 1) ? skin.accent : glass); hp(u, y, 0, null); } hp(u, top, 0, skin.accent); }
      if (rr) rr.windows = rr.windows.filter(wn => wn.side !== 0);
      hp(c.u0 - 1, Y1 - 1, -1, 'vx_led_cove', { facing: 0 }); hp(c.u1 + 1, Y1 - 1, -1, 'vx_led_cove', { facing: 0 });
    }
    if (skin.id === 'bauhaus') {
      // Black Label: an anthracite band around the upper floor's front and a slatted feature wall beside the entrance
      for (let u = 0; u < w; u++) hp(u, Y1 + 1, 0, roomAt[1].get(u + ',1') && u > 0 && u < w - 1 ? glass : skin.accent);
      for (let y = F + 1; y <= Y1 - 1; y++) hp(E.u + E.n + 2 < w - 1 ? E.u + E.n + 2 : E.u - 3, y, 0, 'wood_slat', { axis: 1 });
    }
    yield;
    // ---- roof
    roof(hp, H, skin, F, top, info, rng, SH, garageW ? (mirrored ? 3 : 1) : 0);
    yield;
    // ---- garage or carport, driveway, front garden
    const gs = mirrored ? -1 : 1;                              // garage side (+u or −u of the house)
    const gu0 = gs > 0 ? H.u1 + 1 : 0, gu1 = gs > 0 ? H.u1 + garageW : H.u0 - 1;   // lot coordinates
    if (cat.garage && garageW >= 7) garage(P, H, gu0, gu1, gs, F, skin, rng, info, roomAt[0], roomAt[1], FT.garageDoor, SH);
    else if (cat.carport) carport(P, H, gu0, gu1, F, skin, rng, info);
    frontGarden(P, H, lot, F, skin, rng, info, cat, gu0, gu1);
    backGarden(P, H, lot, F, skin, rng, info, cat, garageW, gs);
    yield;
    if (FT.poolHall) poolHall(hp, H, FT.poolHall, F, skin, rng, info);
    yield;
    // ---- furnish every room (and every zone of the open-plan rooms)
    const ctx = { hp, H, F, skin, info, rng, W, D, roomAt, SH };
    for (const fl of H.floors) for (const r of fl.rooms) {
      if (r.zones) for (const z of r.zones) { PLAN.furnish(ctx, z, r); yield; }
      else { PLAN.furnish(ctx, r, null); yield; }
    }
    info.roofTop = Math.max(info.roofTop, top + 7);
    yield;
    if (custom) {
      if (tpl) VR.Custom.applyTemplate(custom, L0, F, info, cap); else VR.Custom.applyHouse(custom, L, F, info);
      if (custom.top) info.roofTop = Math.max(info.roofTop, F + custom.top + 1);
      info.custom = true;
    }
    info.beds = info.beds.slice(0, 3);   // a villa houses a family of up to three, not one villager per bed
    return info;
  };
  PLAN.build = function (L, lot, o) {
    const it = PLAN.buildSteps(L, lot, o);
    for (;;) { const r = it.next(); if (r.done) return r.value; }
  };

  function floorOf(r, skin) {
    const t = r.type;
    if (WET[t]) return 'floor_tile';
    if (t === 'foyer' || t === 'gallery' || t === 'hall') return r.checker ? 'marble_white' : skin.floorH;
    if (t === 'kitchen') return skin.floorH;
    if (SLEEP[t]) return 'floor_carpet';
    if (t === 'garage') return 'floor_concrete';
    return skin.floorL;
  }
  function winKind(r, s, fi) {
    const t = r.type;
    if (t === 'garage') return null;
    if (WET[t]) return 'frosted';
    if (GLASSY[t]) return s === 0 ? 'std3' : 'tall';
    if (t === 'kitchen') return s === 2 ? 'high' : 'std2';
    if (t === 'foyer') return s === 0 ? null : 'std2';
    if (t === 'gallery') return s === 0 ? 'tall2' : 'std2';
    if (SLEEP[t]) return s === 2 ? 'tall2' : 'std2';
    if (t === 'study') return 'std3';
    return 'std2';
  }

  // ---------------------------------------------------------------- roofs
  function roof(hp, H, skin, F, top, info, rng, SH, garageSide) {
    const RC = H.floors[H.floors.length - 1].rect || [0, 0, H.w - 1, H.d - 1];
    const w = H.w, d = H.d, ua = RC[0] - 1, va = RC[1] - 1, ub = RC[2] + 1, vb = RC[3] + 1;
    const ext = H.features.colonnade ? 1 : 0;   // the roof reaches over the colonnade
    if (skin.roof === 'flat') {
      for (let v = va; v <= vb; v++) for (let u = ua; u <= ub; u++) {
        const edge = u === ua || u === ub || v === va || v === vb;
        if (edge) { hp(u, top, v, skin.trim); hp(u, top + 1, v, 'roof_charcoal_slab', { type: 'bottom' }); }
        else { hp(u, top + 1, v, 'roof_charcoal_slab', { type: 'bottom' }); if (u === RC[0] || u === RC[2] || v === RC[1] || v === RC[3]) hp(u, top, v, skin.band); }
      }
      // roof terrace: loungers, planters and a glass rail all round
      const cu = (RC[0] + RC[2]) >> 1;
      hp(cu - 2, top + 2, RC[1] + 2, 'vx_lounger', { facing: 0 }); hp(cu, top + 2, RC[1] + 2, 'vx_lounger', { facing: 0 }); hp(cu + 2, top + 2, RC[1] + 2, 'vx_tech_planter'); hp(RC[0] + 2, top + 2, RC[3] - 2, 'vx_tech_planter'); hp(RC[2] - 2, top + 2, RC[3] - 2, 'vx_bush');
      for (let u = ua; u <= ub; u++) { hp(u, top + 2, va, 'glass_rail'); hp(u, top + 2, vb, 'glass_rail'); }
      for (let v = va; v <= vb; v++) { hp(ua, top + 2, v, 'glass_rail'); hp(ub, top + 2, v, 'glass_rail'); }
      info.roofTop = top + 4;
    } else if (skin.roof === 'mono') {
      // Pultdach: three flat levels stepping up toward the street, the risers glazed as clerestory bands (the user's photo A)
      const RY = (v) => v <= Math.floor(d * 0.3) ? top + 2 : v <= Math.floor(d * 0.62) ? top + 1 : top;
      for (let v = -1; v <= d; v++) for (let u = -1; u <= w; u++) {
        const edge = u === -1 || u === w || v === -1 || v === d, y = RY(Math.max(0, Math.min(d - 1, v)));
        hp(u, y, v, edge ? skin.trim : 'roof_charcoal'); if (edge) hp(u, y + 1, v, 'roof_charcoal_slab', { type: 'bottom' }); else hp(u, y + 1, v, 'roof_charcoal_slab', { type: 'bottom' });
      }
      for (let v = 0; v < d; v++) { const y = RY(v); for (let yy = top; yy < y; yy++) { hp(0, yy, v, skin.wall); hp(w - 1, yy, v, skin.wall); } }
      for (let u = 0; u < w; u++) for (let yy = top; yy < RY(0); yy++) hp(u, yy, 0, (u === 0 || u === w - 1) ? skin.wall : skin.glass);
      for (let v = 1; v < d; v++) if (RY(v) < RY(v - 1)) for (let u = 1; u < w - 1; u++) for (let yy = RY(v); yy < RY(v - 1); yy++) hp(u, yy, v, skin.glass);   // the clerestory risers
      for (let v = 1; v < d - 1; v++) for (let u = 1; u < w - 1; u++) hp(u, top, v, RY(v) > top ? null : 'floor_oak');
      for (let v = 1; v < d - 1; v++) for (let u = 1; u < w - 1; u++) if (RY(v) > top) hp(u, RY(v) - 1, v, 'floor_oak');   // raised ceilings follow the roof steps
      info.roofTop = top + 4;
    } else if (skin.roof === 'mansard') {
      // a steep slate skirt on the cornice (two 45° courses with dormers), then the low hip cap
      for (let v = -1; v <= d; v++) for (let u = -1; u <= w; u++) {
        const iu = Math.min(u + 1, w - u), iv = Math.min(v + 1, d - v), inset = Math.min(iu, iv);
        const f = iu < iv ? (u + 1 < w - u ? 1 : 3) : (v + 1 < d - v ? 2 : 0);
        if (inset === 0) hp(u, top, v, 'vx_roof_slate', { facing: f });
        else if (inset === 1) { hp(u, top, v, skin.band); const dormer = (v === 0 || v === d - 1) && u >= 2 && u <= w - 3 && (u % 3 === 1); hp(u, top + 1, v, dormer ? skin.glass : 'vx_roof_slate', dormer ? undefined : { facing: f }); if (dormer) hp(u, top + 2, v, skin.trim + '_slab', { type: 'bottom' }); }
        else hp(u, top + 1, v, 'roof_charcoal');
      }
      const ry = hipRoof(hp, 1, 1, w - 2, d - 2, top + 2, skin.hip, 'roof_charcoal');
      hp(w >> 1, ry, 2, 'vx_chimney_stone'); hp(w >> 1, ry + 1, 2, 'vx_chimney_stone');
      for (let u = 0; u < w; u++) if (u % 2 === 0) hp(u, top + 1, -1, 'vx_balustrade');
      info.roofTop = ry + 2;
    } else {
      // 22° hip roof in slate or terracotta with a one-cell overhang (white soffit)
      const ry = hipRoof(hp, ua, va, ub, vb + ext, top, skin.hip, 'roof_charcoal');
      gutters(hp, H, F, top, ua, va, ub, vb + ext, garageSide);
      if (H.features.colonnade) { for (let u = -1; u <= w; u++) for (let v = d; v <= d + 1; v++) hp(u, top, v, skin.trim); for (let u = 0; u < w; u++) hp(u, top, d - 1, skin.band); }
      if (H.family === 'belportale' || H.features.chimney) { hp(2, ry, 2, 'vx_chimney_stone'); }
      info.roofTop = ry + 1;
    }
  }

  // half-round gutters under the eave ring (the cells below the overhang), corner outlets and downpipes down the wall corners
  function gutters(hp, H, F, top, ua, va, ub, vb, garageSide) {
    const VM = VR.VM; if (!VM || !VM.MODELS.vm_gutter) return;
    const FT = H.features; if (FT.towers || FT.roundTower) return;
    const y = top - 1, E = H.entry, p = FT.portico;
    const skipN = (u) => p && u >= p.u0 - 1 && u <= p.u1 + 1;
    for (let u = ua + 1; u <= ub - 1; u++) { if (!skipN(u)) hp(u, y, va, 'vm_gutter', { facing: 0 }); hp(u, y, vb, 'vm_gutter', { facing: 2 }); }
    for (let v = va + 1; v <= vb - 1; v++) { hp(ua, y, v, 'vm_gutter', { facing: 3 }); hp(ub, y, v, 'vm_gutter', { facing: 1 }); }
    // corners: facing picks which eaves meet; the outlet runs into the next cell along the first eave, where the downpipe drops
    const corners = [[ua, va, 0, ua + 1, va], [ub, va, 1, ub, va + 1], [ub, vb, 2, ub - 1, vb], [ua, vb, 3, ua, vb - 1]];
    for (const [cu, cv, f, du, dv] of corners) {
      hp(cu, y, cv, 'vm_gutter_corner', { facing: f });
      const atEntrance = (f === 0 && E.u - 1 <= du) || (f === 1 && E.u + E.n >= du);
      if ((f === 1 && garageSide === 1) || (f === 0 && garageSide === 3) || atEntrance) continue;
      hp(du, y, dv, 'vm_downpipe_top', { facing: f });
      for (let yy = y - 1; yy >= F; yy--) hp(du, yy, dv, 'vm_downpipe', { facing: f });
    }
  }
  // ---------------------------------------------------------------- garage, carport, driveway, gardens
  function garage(P, H, gu0, gu1, gs, F, skin, rng, info, map0, map1, doorV, SH) {
    const v0 = H.v0, v1 = H.v0 + 9, hw = gs > 0 ? H.u1 : H.u0, Y1 = F + SH;   // shares the house wall at hw; 10 deep
    const iu0 = gs > 0 ? gu0 : gu0 + 1, iu1 = gs > 0 ? gu1 - 1 : gu1;   // interior columns
    const box = (u0, v0b, y0, u1, v1b, y1, m, pr) => { for (let v = v0b; v <= v1b; v++) for (let u = u0; u <= u1; u++) for (let y = y0; y <= y1; y++) P(u, y, v, m, pr); };
    for (let v = v0; v <= v1; v++) for (let u = gu0; u <= gu1; u++) { P(u, F, v, 'floor_concrete'); for (let y = F + 1; y <= Y1 - 1; y++) P(u, y, v, (u === (gs > 0 ? gu1 : gu0) || v === v0 || v === v1) ? skin.wall : null); }
    // the door: a wide glass-strip door (two cars), piers beside it
    const du0 = iu0 + 1, du1 = iu1 - 1;
    if (du1 - du0 + 1 === 7 && VR.VM && VR.VM.MODELS.vm_garage_door7) VR.VM.put(P, du0, F + 1, v0, 'vm_garage_door7', 0);
    else for (let u = du0; u <= du1; u++) for (let y = F + 1; y <= Y1 - 1; y++) P(u, y, v0, 'garage_door');
    for (const u of [du0 - 1, du1 + 1]) for (let y = F + 1; y <= Y1 - 1; y++) P(u, y, v0, skin.plinth === 'concrete_smooth' ? 'stacked_stone' : skin.plinth);
    // roof: a deck terrace with a railing, reached from the bedroom above the house wall
    for (let v = v0 - 1; v <= v1 + 1; v++) for (let u = gu0 - (gs > 0 ? 0 : 1); u <= gu1 + (gs > 0 ? 1 : 0); u++) { const edge = v === v0 - 1 || v === v1 + 1 || u === (gs > 0 ? gu1 + 1 : gu0 - 1); P(u, Y1, v, edge ? skin.trim : 'deck_wood'); if (edge) P(u, Y1 + 1, v, skin.rail); }
    P(gs > 0 ? gu0 + 1 : gu1 - 1, Y1 + 1, v0 + 2, 'vx_tech_planter'); P(gs > 0 ? gu1 - 1 : gu0 + 1, Y1 + 1, v1 - 1, 'vx_lounger', { facing: 0 }); P(gs > 0 ? gu0 + 1 : gu1 - 1, Y1 + 1, v1 - 1, 'vx_bbq', { facing: 0 }); P(gs > 0 ? gu1 - 3 : gu0 + 3, Y1 + 1, v1 - 1, 'vx_lounger', { facing: 0 }); P((gu0 + gu1) >> 1, Y1 + 1, v0 + 4, 'vx_dining_table_white', { facing: 0 }); P((gu0 + gu1) >> 1, Y1 + 1, v0 + 3, 'vx_dining_chair', { facing: 2 }); P((gu0 + gu1) >> 1, Y1 + 1, v0 + 5, 'vx_dining_chair', { facing: 0 });
    // inside: two cars, shelves, a workbench, tool crates, a spot light; a door into the house where the plan allows
    const cu = iu0 + 1;
    if (!PLAN.NO_CARS) { carAt(P, cu, v0 + 2, F + 1, 0, rng.pick(CARS)); if (rng.chance(0.7)) carAt(P, cu + 3, v0 + 2, F + 1, 0, rng.pick(CARS)); }
    else { P(cu + 3, F + 1, v0 + 2, 'vx_crate'); P(cu + 4, F + 1, v0 + 2, 'vx_barrel'); P(cu + 3, F + 2, v0 + 2, 'vx_crate'); P(cu, F + 1, v0 + 3, 'vx_rug_sand'); }
    for (let u = iu0; u <= iu1; u++) { P(u, F + 1, v1 - 1, u === iu0 + 2 ? 'vx_tech_desk' : (u & 1) ? 'vx_crate' : 'vx_locker', { facing: 0 }); if (u % 3 === 0) P(u, F + 2, v1 - 1, 'vx_wall_shelf', { facing: 0 }); }
    P(cu + 2, Y1 - 1, v0 + 3, 'vx_spot'); P(cu + 2, Y1 - 1, v0 + 7, 'vx_spot'); P(gs > 0 ? iu1 : iu0, F + 1, v0 + 1, 'vx_wheelbarrow', { facing: 2 });
    if (doorV) { const v = doorV.v0 + 1 <= doorV.v1 ? doorV.v0 + 1 : doorV.v0; const side = gs > 0 ? 1 : 3; P(hw, F + 1, H.v0 + v, 'birch_door', { facing: side, half: 0, hinge: 0, open: 0 }); P(hw, F + 2, H.v0 + v, 'birch_door', { facing: side, half: 1, hinge: 0, open: 0 }); const rr = map0.get((gs > 0 ? H.w - 2 : 1) + ',' + v); if (rr) rr.doors.push({ u: gs > 0 ? H.w - 2 : 1, v, side }); }
    info.cars.push([cu, v0 + 2]);
    // driveway in front
    for (let v = H.v0 - 3; v < v0; v++) for (let u = du0 - 1; u <= du1 + 1; u++) P(u, F - 1, v, 'concrete_smooth');
    if (rng.chance(0.5)) carAt(P, du0 + 1, H.v0 - 3, F, 0, rng.pick(CARS));
    void box;
  }
  function carport(P, H, gu0, gu1, F, skin, rng, info) {
    const v0 = H.v0, v1 = H.v0 + 6;
    for (let v = v0; v <= v1; v++) for (let u = gu0; u <= gu1; u++) P(u, F - 1, v, 'paver_grey');
    for (const [u, v] of [[gu0, v0], [gu1, v0], [gu0, v1], [gu1, v1]]) for (let y = F; y <= F + 2; y++) P(u, y, v, 'black_metal');
    for (let v = v0; v <= v1; v++) for (let u = gu0; u <= gu1; u++) P(u, F + 3, v, 'vx_pergola', { facing: 1 });
    carAt(P, gu0 + 1, v0 + 1, F, 0, rng.pick(CARS));
    for (let v = H.v0 - 3; v < v0; v++) for (let u = gu0; u <= gu1; u++) P(u, F - 1, v, 'concrete_smooth');
  }
  PLAN.NO_CARS = true;   // the user wants no parked cars for now
  const carAt = (P, u, v, y, facing, name) => { if (PLAN.NO_CARS) return; for (let p = 0; p < 16; p++) { const px = p & 1, py = (p >> 1) & 1, pz = p >> 2; const along = (facing & 1) === 0; const du = along ? px : pz, dv = along ? pz : px; const uu = facing === 2 ? u + 1 - du : facing === 3 ? u + 3 - du : u + du; const vv = facing === 0 ? v + 3 - dv : facing === 1 ? v + 1 - dv : v + dv; P(uu, y + py, vv, name, { facing, part: 'p' + p }); } };
  PLAN.carAt = carAt;
  const tree = (P, u, v, y, rng, big) => { const f = rng.pick(['apple', 'cherry', 'plum', 'orange']); for (let k = 0; k < (big ? 3 : 2); k++) P(u, y + k, v, 'vx_fruit_trunk'); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { P(u + a, y + (big ? 3 : 2), v + b, 'vx_fruit_crown_' + f); if (Math.abs(a) + Math.abs(b) <= 1) P(u + a, y + (big ? 4 : 3), v + b, 'vx_fruit_crown_' + f); } };

  // the swimming hall: a glass pavilion behind the dining wing with a tiled pool, loungers and palms in planters
  function poolHall(hp, H, ph, F, skin, rng, info) {
    const d = H.d, u0 = ph.u0, u1 = ph.u1, v0 = d, v1 = d + ph.deep - 1, glass = skin.glass;
    for (let v = v0; v <= v1; v++) for (let u = u0; u <= u1; u++) {
      const edge = u === u0 || u === u1 || v === v1, inner = u > u0 + 1 && u < u1 - 1 && v > v0 + 1 && v < v1 - 1;
      for (let y = F - 2; y <= F + 7; y++) hp(u, y, v, null);
      hp(u, F - 1, v, 'floor_porcelain'); hp(u, F, v, inner ? 'water' : edge ? skin.plinth : 'porcelain_tile');
      if (inner) { hp(u, F - 1, v, 'water'); hp(u, F - 2, v, 'pool_tile'); } else if (u > u0 && u < u1 && v < v1 && (u === u0 + 1 || u === u1 - 1 || v === v0 + 1 || v === v1 - 1)) hp(u, F - 1, v, 'pool_tile');
      for (let y = F + 1; y <= F + 5; y++) hp(u, y, v, edge ? ((u === u0 || u === u1) && (v === v1) ? skin.trim : glass) : null);
      hp(u, F + 6, v, edge ? skin.trim : 'window_white');
    }
    for (let u = u0 + 1; u < u1; u += 3) hp(u, F + 6, v0, skin.trim);
    hp(u0 + 1, F + 1, v0 + 1, 'vx_lounger', { facing: 2 }); hp(u1 - 1, F + 1, v0 + 1, 'vx_lounger', { facing: 2 }); hp(u0 + 1, F + 1, v1 - 1, 'vx_tech_planter'); hp(u1 - 1, F + 1, v1 - 1, 'vx_tech_planter');
    for (let u = u0 + 2; u < u1 - 1; u += 3) hp(u, F + 5, (v0 + v1) >> 1, 'vx_pendant_brass');
    // the door from the dining room's garden wall into the hall
    const du = (u0 + u1) >> 1; hp(du, F + 1, d - 1, 'vx_glass_door_black', { facing: 2, open: 0 }); hp(du, F + 2, d - 1, 'vx_glass_door_black', { facing: 2, open: 0 });
    info.pool = [u0 + 2, v0 + 2, u1 - 2, v1 - 2]; info.seats.push([H.u0 + u0 + 1, F + 1, H.v0 + v0 + 1, 2]);
  }
  function frontGarden(P, H, lot, F, skin, rng, info, cat, gu0, gu1) {
    const E = H.entry, eu = H.u0 + E.u, yv = F - 1;
    // path from the pavement to the door, steps, lawn with beds along the house, a mailbox and path lights
    for (let v = H.v0 - 3; v < H.v0; v++) for (let k = 0; k < E.n; k++) P(eu + k, yv, v, 'paver_grey');
    if (cat.front) for (let v = 0; v < H.v0; v++) for (let k = -1; k <= E.n; k++) P(eu + k, yv, v, 'paver_grey');
    for (let u = H.u0; u <= H.u1; u++) {
      if (u >= eu - 1 && u <= eu + E.n) continue;
      if (H.features.portico && u >= H.u0 + H.features.portico.u0 - 1 && u <= H.u0 + H.features.portico.u1 + 1) continue;
      if (H.features.towers && (u <= H.u0 + 1 || u >= H.u1 - 1)) continue;
      P(u, F, H.v0 - 1, rng.chance(0.55) ? rng.pick(['vx_flowerbed', 'vx_flowerbed_roses', 'vx_flowerbed_tulips']) : rng.chance(0.5) ? 'vx_bush_light' : 'vx_bush');
    }
    P(eu - 2, F, H.v0 - 3, 'vx_garden_lamp'); P(eu + E.n + 1, F, H.v0 - 3, 'vx_mailbox', { facing: 0 });
    // royal palms flank the entrance on the mediterranean / coastal houses
    if (H.palms && VR.GEN && VR.GEN.palmTree) for (const [u, v] of [[eu - 3, H.v0 - 2], [eu + E.n + 2, H.v0 - 2]]) if (u >= 0 && u < lot.w && !(H.features.portico)) { for (let y = F; y <= F + 15; y++) P(u, y, v, null); VR.GEN.palmTree((x, y, z, n, pr) => P(x, y, z, n, pr), u, F, v, 8 + rng.int(3), rng); }
    for (let v = -1; v < lot.d; v++) { P(-2, F, v, 'vx_hedge_light'); P(lot.w + 1, F, v, 'vx_hedge_light'); }
    if (skin.column === 'vx_column_classic') { P(eu - 2, F, H.v0 - 1, 'vx_urn_white'); P(eu + E.n + 1, F, H.v0 - 1, 'vx_urn_white'); }
  }

  function backGarden(P, H, lot, F, skin, rng, info, cat, garageW, gs) {
    const yv = F - 1, v0 = H.v1 + 1, v1 = lot.d - 1, u0 = 0, u1 = lot.w - 1;
    if (v1 - v0 < 3) return;
    const paver = skin.id === 'bauhaus' ? 'paver_grey' : 'travertine';
    const tw0 = H.u0, tw1 = H.u1;
    // the terrace across the garden front (three deep), a step down to the lawn
    for (let v = v0; v <= Math.min(v1, v0 + 2); v++) for (let u = tw0; u <= tw1; u++) P(u, yv, v, paver);
    if (H.features.curvedTerrace) {
      const cu = (tw0 + tw1) / 2, rx = (tw1 - tw0) / 2 + 1, ry = 4.5;
      const inside = (u, v) => ((u - cu) / rx) ** 2 + ((v - v0 - 1) / ry) ** 2 <= 1;
      for (let v = v0; v <= Math.min(v1, v0 + 5); v++) for (let u = u0; u <= u1; u++) if (inside(u, v)) { P(u, yv, v, paver); const edge = !inside(u, v + 1) || !inside(u - 1, v) || !inside(u + 1, v); if (edge && v > v0 + 1) P(u, F, v, 'vx_balustrade'); }
      P(Math.round(cu), F, v0 + 3, 'vx_fountain');
    }
    // outdoor dining under a pergola on one side (teak table, four chairs, the gas BBQ beside it), loungers under a parasol on the other
    const VM = VR.VM, inLot = (u, v) => u >= 0 && u <= u1 && v >= 0 && v <= v1;
    const model = (u, v, name, f) => { if (!VM || !VM.MODELS[name]) return false; const cells = VM.cells(name, f).map(([dx, dz]) => [u + dx, v + dz]); if (!cells.every(([cu2, cv2]) => inLot(cu2, cv2))) return false; VM.put(P, u, F, v, name, f); return true; };
    const du = gs > 0 ? tw0 + 1 : tw1 - 5;
    if (tw1 - tw0 >= 9) {
      for (const [u, v] of [[du, v0], [du + 4, v0], [du, v0 + 2], [du + 4, v0 + 2]]) for (let y = F; y <= F + 2; y++) P(u, y, v, 'black_metal');
      for (let v = v0; v <= v0 + 2; v++) for (let u = du; u <= du + 4; u++) P(u, F + 3, v, 'vx_pergola', { facing: 1 });
      if (model(du + 1, v0 + 1, 'vm_garden_table', 0)) {
        for (const [u, v, f] of [[du + 1, v0, 2], [du + 2, v0, 2], [du + 1, v0 + 2, 0], [du + 2, v0 + 2, 0], [du, v0 + 1, 1], [du + 3, v0 + 1, 3]]) if (model(u, v, 'vm_garden_chair', f)) info.seats.push([u, F, v, f]);
      }
      const bu = du + 6 <= tw1 ? du + 6 : du - 1; if (!model(bu, v0, 'vm_bbq', 2)) model(bu, v0, 'vm_planter', 0);
      P(du + 2, F + 2, v0 + 1, 'vx_pendant_brass');
    }
    const lu = gs > 0 ? tw1 - 2 : tw0 + 1;
    for (const u of [lu, lu + (gs > 0 ? -1 : 1)]) if (model(u, v0, 'vm_lounger', 0)) info.seats.push([u, F, v0, 0]);
    model(gs > 0 ? tw1 : tw0, v0 + 2, 'vm_planter', 0);
    // a parasol shading the loungers: its base stands at the terrace edge, the canopy reaches back over them
    if (gs > 0) model(tw1 - 1, v0 + 2, 'vm_parasol', 0); else model(tw0 + 1, v0 + 2, 'vm_parasol', 1);
    // pool on the big lots (behind the terrace), a lawn everywhere else, beds at the terrace edge
    const pv0 = v0 + 4, pw = Math.min(8, tw1 - tw0 - 3), pd = Math.min(4, v1 - pv0);
    if (pd >= 3 && pw >= 5) {
      const pu0 = Math.round((tw0 + tw1) / 2 - pw / 2), pu1 = pu0 + pw - 1, pv1 = pv0 + pd - 1;
      for (let v = pv0; v <= pv1; v++) for (let u = pu0; u <= pu1; u++) {
        const edge = u === pu0 || u === pu1 || v === pv0 || v === pv1;
        if (edge) { P(u, yv, v, 'pool_tile'); P(u, yv - 1, v, 'pool_tile'); }
        else { P(u, yv, v, 'water'); P(u, yv - 1, v, 'water'); P(u, yv - 2, v, 'pool_tile'); }
      }
      for (let v = pv0 - 1; v <= pv1 + 1; v++) for (let u = pu0 - 1; u <= pu1 + 1; u++) if (u < pu0 || u > pu1 || v < pv0 || v > pv1) P(u, yv, v, 'deck_wood');
      model(pu0 - 1, pv0, 'vm_lounger', 0); if (pd >= 4) model(pu0 - 1, pv0 + 2, 'vm_lounger', 0); model(pu1 + 1, pv1, 'vm_planter', 0);
      if (H.palms && VR.GEN && VR.GEN.palmTree) { const pu = pu1 + 2 < lot.w ? pu1 + 2 : pu0 - 2; for (let y = F; y <= F + 15; y++) P(pu, y, pv1, null); VR.GEN.palmTree((x, y, z, n, pr) => P(x, y, z, n, pr), pu, F, pv1, 8 + rng.int(3), rng); }
      info.pool = [pu0, pv0, pu1, pv1];
    }
    // a fire pit lounge on the lawn behind (or instead of) the pool: outdoor sofa facing the fire, two chairs opposite
    const fv = info.pool ? info.pool[3] + 3 : v0 + 5;
    if (v1 - fv >= 3 && tw1 - tw0 >= 7) {
      const fu = Math.round((tw0 + tw1) / 2) - 1;
      if (model(fu, fv, 'vm_fire_pit', 0)) {
        if (model(fu + 1, fv - 1, 'vm_outdoor_sofa', 2)) { info.seats.push([fu, F, fv - 1, 2], [fu + 1, F, fv - 1, 2]); }
        for (const u of [fu, fu + 1]) if (model(u, fv + 2, 'vm_garden_chair', 0)) info.seats.push([u, F, fv + 2, 0]);
        for (let v = fv - 1; v <= fv + 2; v++) for (let u = fu - 1; u <= fu + 2; u++) P(u, yv, v, paver);
      }
    }
    // hedges along the back and the far side, trees in the corners, path lights, flower beds along the house
    for (let u = u0 - 1; u <= u1 + 1; u++) P(u, F, v1 + 1, 'vx_hedge');
    tree(P, gs > 0 ? u0 : u1, v1, F, rng, true); if (rng.chance(0.7)) tree(P, gs > 0 ? u1 : u0, v1 - 1, F, rng, false);
    for (let u = tw0; u <= tw1; u += 3) P(u, F, v0 + 3, 'vx_garden_lamp');
    for (let u = tw0 + 1; u < tw1; u += 2) if (!info.pool || u < info.pool[0] - 1 || u > info.pool[2] + 1) P(u, F, v1, rng.chance(0.5) ? 'vx_flowerbed_roses' : 'vx_bush_light');
    // the garden beside the garage / carport strip is lawn with a shed-side path
    if (garageW) { const su = gs > 0 ? H.u1 + 1 : 0; for (let v = H.v0 + 11; v <= v1; v++) for (let u = su; u < su + garageW; u++) if ((u - su) === (garageW >> 1)) P(u, yv, v, 'paver_grey'); }
  }
})(VR);

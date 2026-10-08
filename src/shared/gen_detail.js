// ============================================================================
// F6 · Architektur innen & außen — the detail layer of the generated houses and streets. Only worlds made from
// vgen 6 on use it (VR.Detail.on(g)); a world made before keeps every chunk it generated, and its houses are built
// exactly as before (gen_village.js checks the flag where it calls in here).
//  · Interiors: every village home is furnished storey by storey by a small placement grammar. A storey is a list of
//    wants, in order: a run of pieces against a wall (the first piece facing into the room), a corner, the centre
//    (a table with its chairs), a rug. A want takes the first candidate that fits: every cell inside the walls, free,
//    not on the door, not on the cell in front of it, not on the ladder. The rng breaks ties, so each house is its own
//    and the same seed gives the same house. Zones (kitchen, living, bedroom, bath, study) are recorded per piece.
//  · Outside: a lamp by the door and two planters on the doorstep.
//  · Streets (modern towns, see roadDecor): glass bus shelters at the kerb, e-bikes parked along it, metal grates
//    round the street trees, barrels by the lamp posts.
// Everything here is procedural and our own (no copied models or names); every piece is a block of the registry.
// ============================================================================
(function (VR) {
  'use strict';
  const VG = VR.VillageGen;
  if (!VG) return;
  const D = VR.Detail = {};
  D.VGEN = 6;                                              // the generator version of the new detail (new worlds)
  D.on = (g) => !!(g && g.vgen >= D.VGEN);
  const FACE = [2, 3, 0, 1];                               // a piece against wall side s faces into the room (0 front, 1 right, 2 back, 3 left)
  const DIR = [[0, -1], [1, 0], [0, 1], [-1, 0]];          // facing → (du, dv)
  const dirOf = (dx, dz) => { let b = 0, bd = -9; for (let f = 0; f < 4; f++) { const q = DIR[f][0] * dx + DIR[f][1] * dz; if (q > bd) { bd = q; b = f; } } return b; };
  const key = (u, v) => u + ',' + v;
  const BEDS = ['vx_bed_white', 'vx_bed_teal', 'vx_bed_blue', 'vx_bed_green', 'vx_bed_purple', 'vx_bed_pink', 'vx_bed_red', 'vx_bed_yellow'];
  const SOFAS = ['vx_sofa_cream', 'vx_sofa_taupe', 'vx_sofa_charcoal', 'vx_sofa_blue'];
  const RUGS = ['vx_rug_red', 'vx_rug_blue', 'vx_rug_green', 'vx_rug_sand'];

  // ------------------------------------------------------------ interiors: the placement grammar
  // C: {w, d, floors, F, du (door column), S (the style), rng, seed}; info gets furn (every piece: {u, y, v, n, z}),
  // outDetail (the lamp and the planters outside), beds, seats, table, work, lights (what the villagers and the plan use).
  D.homeInterior = function (L, info, C) {
    const P = L.P, { w, d, floors, F, du, S, rng } = C;
    const ladder = floors > 1;
    const usedBy = [new Set(), new Set()];
    const LIGHT = S.light || 'vx_lantern';
    const seatB = S.seat || 'vx_chair', shelfB = S.shelf || 'vx_bookshelf', plantB = S.plant || 'vx_potplant';
    info.furn = []; info.outDetail = []; info.beds = []; info.seats = []; info.work = info.work || []; info.lights = info.lights || [];
    const inside = (u, v) => u >= 1 && u <= w - 2 && v >= 1 && v <= d - 2;
    const blocked = (k, u, v) => (k === 0 && u === du && (v === 1 || v === 2)) || (ladder && u === 1 && v === 1);
    const free = (k, u, v) => inside(u, v) && !usedBy[k].has(key(u, v)) && !blocked(k, u, v);
    const put = (k, u, v, name, props, zone) => {
      P(u, F + 1 + 4 * k, v, name, props);
      usedBy[k].add(key(u, v));
      info.furn.push({ u, y: F + 1 + 4 * k, v, n: name, z: zone });
    };
    // the cells of a run of `len` pieces against wall s (depth `deep`; depth 1 = against the wall), first at index i
    const wallSpots = (k, s, len, deep) => {
      const out = [], n = (s & 1) ? d - 2 : w - 2;
      for (let i = 1; i + len - 1 <= n; i++) {
        const cells = []; let ok = true;
        for (let a = 0; a < len && ok; a++) for (let q = 0; q < deep; q++) {
          const al = i + a, dep = q + 1;
          const u = s === 1 ? w - 1 - dep : s === 3 ? dep : al;
          const v = s === 0 ? dep : s === 2 ? d - 1 - dep : al;
          if (!free(k, u, v)) { ok = false; break; }
          cells.push([u, v, a, q]);
        }
        if (ok) out.push({ s, i, n, len, cells });
      }
      return out;
    };
    // the candidate order for a want: 'end' = corners first, 'mid' = the middle first, otherwise any
    const rank = (sp, prefer) => {
      const endD = Math.min(sp.i - 1, sp.n - (sp.i + sp.len - 1)), midD = Math.abs((sp.i + (sp.len - 1) / 2) - (sp.n + 1) / 2);
      return (prefer === 'end' ? endD : prefer === 'mid' ? midD : 0) + rng.next() * 0.9;
    };
    // one storey: wants in order; each places its pieces at its best fitting candidate
    const storey = (k) => {
      const Y = F + 1 + 4 * k;
      const wants = [];
      const kS = [2, 1, 3][rng.int(3)];                  // the kitchen wall (the back wall first, usually)
      const col = (arr) => arr[rng.int(arr.length)];
      if (k === 0) {
        wants.push({ at: 'wall', side: kS, names: ['vx_counter', 'vx_stove'], prefer: 'end', zone: 'kitchen' });
        wants.push({ at: 'wall', side: kS, names: ['vx_fridge'], prefer: 'end', zone: 'kitchen' });
        wants.push({ at: 'table', name: 'vx_table', chair: seatB, zone: 'living' });
        wants.push({ at: 'wall', side: (kS + 2) & 3, names: [col(SOFAS), col(SOFAS)], prefer: 'mid', zone: 'living' });
        wants.push({ at: 'wall', side: (kS + 1) & 3, names: ['vx_tv_wall'], prefer: 'mid', zone: 'living' });
        wants.push({ at: 'wall', names: [shelfB], prefer: 'end', zone: 'living' });
        wants.push({ at: 'corner', name: plantB, zone: 'living' });
        wants.push({ at: 'corner', name: 'vx_floorlamp', zone: 'living' });
        if (floors === 1) {
          // a one-storey house sleeps on the ground floor: its bed is placed before the table and may stand on any wall
          wants.splice(2, 0, { at: 'wall', names: [col(BEDS)], bed: true, deep: 2, prefer: 'mid', zone: 'bedroom' });
          wants.push({ at: 'wall', names: ['vx_nightstand'], prefer: 'end', zone: 'bedroom' });
          wants.push({ at: 'wall', names: ['vx_wardrobe'], prefer: 'end', zone: 'bedroom' });
        }
        wants.push({ at: 'rug', name: col(RUGS), zone: 'living' });
      } else {
        wants.push({ at: 'wall', side: 2, names: [col(BEDS)], bed: true, deep: 2, prefer: 'mid', zone: 'bedroom' });
        wants.push({ at: 'wall', side: 2, names: ['vx_nightstand'], prefer: 'end', zone: 'bedroom' });
        wants.push({ at: 'wall', side: (kS + 1) & 3, names: ['vx_wardrobe'], prefer: 'end', zone: 'bedroom' });
        wants.push({ at: 'corner', name: 'vx_toilet', zone: 'bath' });
        wants.push({ at: 'wall', names: ['vx_vanity'], prefer: 'end', zone: 'bath' });
        wants.push({ at: 'wall', names: ['vx_bathtub'], prefer: 'end', zone: 'bath' });
        wants.push({ at: 'wall', side: 0, names: ['vx_school_desk'], prefer: 'mid', zone: 'study' });
        wants.push({ at: 'wall', names: [shelfB], prefer: 'end', zone: 'study' });
        wants.push({ at: 'corner', name: plantB, zone: 'bedroom' });
      }
      for (const wt of wants) {
        if (wt.at === 'wall') {
          const sides = wt.side !== undefined ? [wt.side] : [0, 1, 2, 3];
          let best = null, bestR = 1e9;
          const len = wt.names.length, deep = wt.deep || 1;
          for (const s of sides) for (const sp of wallSpots(k, s, len, deep)) {
            const r = rank(sp, wt.prefer);
            if (r < bestR) { bestR = r; best = sp; }
          }
          if (!best) continue;
          const f = FACE[best.s];
          for (const [u, v, a, q] of best.cells) {
            if (wt.bed) {
              const part = q === 0 ? 1 : 0;      // part 0 is the far end of the bed (the pillow end is part 0 against nothing)
              put(k, u, v, wt.names[0], { facing: f, part }, wt.zone);
              if (part === 0) info.beds.push([u, Y, v, f]);
            } else {
              const name = wt.names[a];
              const props = name === 'vx_tv_wall' || /vx_(sofa|counter|stove|fridge|bookshelf|nightstand|wardrobe|school_desk|vanity|toilet|bathtub)/.test(name) ? { facing: f } : undefined;
              put(k, u, v, name, props, wt.zone);
              if (name === 'vx_stove') info.work.push(['stove', (u === 1 || (best.s === 3)) ? u + 1 : u - 1, Y, v]);
            }
          }
        } else if (wt.at === 'corner') {
          const cs = [[1, 1], [w - 2, 1], [1, d - 2], [w - 2, d - 2]];
          const order = cs.map(c => [c, rng.next()]).sort((a, b) => a[1] - b[1]).map(x => x[0]);
          const c = order.find(([u, v]) => free(k, u, v));
          if (c) put(k, c[0], c[1], wt.name, undefined, wt.zone);
        } else if (wt.at === 'table') {
          const cu = w >> 1, cv = d >> 1;
          let tu = -1, tv = -1, bestD = 1e9;
          for (let v = 1; v <= d - 2; v++) for (let u = 1; u <= w - 2; u++) {
            if (!free(k, u, v)) continue;
            const dd = Math.abs(u - cu) + Math.abs(v - cv) + rng.next() * 0.5;
            if (dd < bestD) { bestD = dd; tu = u; tv = v; }
          }
          if (tu < 0) continue;
          put(k, tu, tv, wt.name, undefined, wt.zone);
          if (k === 0) info.table = [tu, Y, tv];
          for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            if (rng.chance(0.25) && k === 0) continue;   // a chair or two less now and then
            const cu2 = tu + dx, cv2 = tv + dz;
            if (!free(k, cu2, cv2)) continue;
            const f = dirOf(-dx, -dz);                   // the chair faces the table
            put(k, cu2, cv2, wt.chair, { facing: f }, wt.zone);
            info.seats.push([cu2, Y, cv2, f]);
          }
        } else if (wt.at === 'rug') {
          // a flat rug under the table (a floor cover: it blocks nothing, so it is not taken)
          const t = info.table && k === 0 ? info.table : null;
          const cu = t ? t[0] : w >> 1, cv = t ? t[2] : d >> 1;
          for (let v = cv - 1; v <= cv + 1; v++) for (let u = cu - 1; u <= cu + 1; u++) {
            if (!inside(u, v) || usedBy[k].has(key(u, v)) || blocked(k, u, v)) continue;
            P(u, Y, v, wt.name);
            info.furn.push({ u, y: Y, v, n: wt.name, z: wt.zone });
          }
        }
      }
      // a hanging light over the middle of the storey
      const lu = w >> 1, lv = d >> 1;
      if (free(k, lu, lv)) { P(lu, Y + 2, lv, LIGHT); info.lights.push([lu, Y + 2, lv]); }
      else { P(du, Y + 2, 2, LIGHT); info.lights.push([du, Y + 2, 2]); }
    };
    if (ladder) {
      // a ladder up the west corner: rungs from the floor to the upper slab, the upper cell in front of it stays open
      for (let y = F + 1; y <= F + 4; y++) P(1, y, 1, 'ladder', { facing: 1 });
      usedBy[0].add(key(1, 1));
    }
    storey(0);
    if (floors > 1) storey(1);
    // outside: a lamp by the door and two planters on the doorstep (the lamp's post is the style's own)
    const lampU = Math.min(w - 1, du + 2), planter = S.planter || 'vx_planter';
    P(lampU, F + 1, -1, S.lamp || 'vx_lamppost', { head: 0 }); P(lampU, F + 2, -1, S.lamp || 'vx_lamppost', { head: 1 });
    info.outDetail.push({ u: lampU, y: F + 1, v: -1, n: S.lamp || 'vx_lamppost' });
    for (const pu of [du - 1, du + 1]) if (pu >= 0 && pu <= w - 1) { P(pu, F + 1, -1, planter); info.outDetail.push({ u: pu, y: F + 1, v: -1, n: planter }); }
    // gutters under the eaves of the long sides (the villas' own gutter and downpipe models), one downpipe at the end
    // of the front run; the gutter is broken over the doorway, where the walk and the lamp are
    if (VR.VM && VR.VM.MODELS && VR.VM.MODELS.vm_gutter) {
      const ye = (C.top || F + 4) - 2, G = (u, v, f) => P(u, ye, v, 'vm_gutter', { facing: f });
      if (C.alongU) {
        for (let u = 0; u < w; u++) { if (u >= du - 1 && u <= du + 2) continue; G(u, -1, 0); G(u, d, 2); }
        P(0, ye, -1, 'vm_downpipe_top', { facing: 0 });
        for (let y = ye - 1; y >= F; y--) P(0, y, -1, 'vm_downpipe', { facing: 0 });
      } else {
        for (let v = 0; v < d; v++) { G(-1, v, 3); G(w, v, 1); }
        P(-1, ye, d - 1, 'vm_downpipe_top', { facing: 3 });
        for (let y = ye - 1; y >= F; y--) P(-1, y, d - 1, 'vm_downpipe', { facing: 3 });
      }
    }
    return info;
  };

  // ------------------------------------------------------------ streets (modern towns)
  // C: {P (world put: x, y, z, state or name), occ, oi (cell → occupancy index), ground(x, z), st(name, props),
  //     fill(x, z, y0, y1, state), AIR, rng, plan (counts go into plan.detail)}. Called per radial road with its points
  // pts [[x, z, angle]…] and heights sm; the decoration is kept to the kerb (3 cells off the centre line).
  D.roadDecor = function (C, pts, sm, S) {
    const { P, occ, oi, ground, st, fill, AIR, rng, plan } = C;
    const det = plan.detail || (plan.detail = { shelters: 0, ebikes: 0, grates: 0, bins: 0 });
    const side = (k) => (k & 1 ? -1 : 1);
    const cellsOk = (cells) => cells.every(([x, z]) => { const o = oi(x, z); return o >= 0 && occ[o] === 0; });
    const mark = (cells) => { for (const [x, z] of cells) occ[oi(x, z)] = 6; };
    // a model centred on (cx, cz) with its floor at ty: every cell of its footprint is ground up to ty (no piece floats)
    const placeModel = (name, f, cx, cz, ty) => {
      const offs = VG.modelCells ? VG.modelCells(name, f) : [[0, 0]];
      let mx = 0, mz = 0; for (const [dx, dz] of offs) { mx += dx; mz += dz; }
      mx /= offs.length; mz /= offs.length;
      const ax = Math.round(cx - mx), az = Math.round(cz - mz);
      const cells = offs.map(([dx, dz]) => [ax + dx, az + dz]);
      if (!cellsOk(cells)) return false;
      mark(cells);
      for (const [x, z] of cells) { const gy = ground(x, z); if (ty > gy) fill(x, z, gy + 1, ty, st('dirt')); }
      VR.VM.put(P, ax, ty + 1, az, name, f);
      return true;
    };
    const n = pts.length;
    // one glass bus shelter per town, a little way out from the kerb of the first road long enough: the first free spot
    // along the road (its middle first, then nearer the ends), on either side; the glass faces the road
    if (S.modern && n > 40 && !plan.shelterDone) {
      const sd0 = rng.chance(0.5) ? 1 : -1;
      for (const fr of [0.45, 0.35, 0.55, 0.25, 0.65, 0.15, 0.75]) for (const sd of [sd0, -sd0]) {
        if (plan.shelterDone) break;
        const k = Math.floor(n * fr), [px, pz, pa] = pts[k], ry = sm[k];
        const nx = -Math.sin(pa), nz = Math.cos(pa);
        const cx = px + nx * 3 * sd, cz = pz + nz * 3 * sd;
        const f = dirOf(-nx * sd, -nz * sd);
        const ty = Math.max(ground(Math.round(cx), Math.round(cz)), ry);
        if (placeModel('vm_mobility_busshelter_glass', f, cx, cz, ty)) { plan.shelterDone = true; det.shelters++; }
      }
    }
    for (let k = 4; k < n - 4; k++) {
      const [px, pz, pa] = pts[k], ry = sm[k];
      const nx = -Math.sin(pa), nz = Math.cos(pa);
      const tx = Math.cos(pa), tz = Math.sin(pa);
      // e-bikes parked along the kerb, their long side along the road
      if (k % 14 === 2) {
        const sd = side(k);
        const cx = px + nx * 3 * sd, cz = pz + nz * 3 * sd;
        const f = Math.abs(tx) > Math.abs(tz) ? 0 : 1;      // footprint along the road
        const ty = Math.max(ground(Math.round(cx), Math.round(cz)), ry);
        const offs = VG.modelCells ? VG.modelCells('vm_mobility_ebike_city', f) : [[0, 0]];
        if (offs.length && (ty - ground(Math.round(cx), Math.round(cz))) <= 2) {
          if (placeModel('vm_mobility_ebike_city', f, cx, cz, ty)) det.ebikes++;
        }
      }
      // a barrel bin by a lamp post on the kerb (every 11th point)
      if (k % 11 === 6) {
        const sd = -side(k);
        const bx = Math.round(px + nx * 2 * sd), bz = Math.round(pz + nz * 2 * sd);
        const o = oi(bx, bz);
        if (o >= 0 && (occ[o] === 0 || occ[o] === 1)) {
          const gy = ground(bx, bz), ty = Math.max(gy, ry);
          fill(bx, bz, gy + 1, ty, st('dirt'));
          P(bx, ty + 1, bz, st('vx_barrel'));
          occ[o] = 6; det.bins++;
        }
      }
    }
    return det;
  };
  // the metal grate round a street tree: the eight cells round the trunk (the trunk's own cell is dirt)
  D.treeGrate = function (C, tx, ty, tz, st, fill) {
    const { P, occ, oi, ground, plan } = C;
    const det = plan.detail || (plan.detail = { shelters: 0, ebikes: 0, grates: 0, bins: 0 });
    const g = st('metal_grate');
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      if (!a && !b) continue;
      const x = tx + a, z = tz + b, o = oi(x, z);
      if (o < 0 || occ[o] !== 0) continue;
      const gy = ground(x, z);
      fill(x, z, gy + 1, ty - 1, st('dirt'));
      P(x, ty, z, g);
      occ[o] = 6; det.grates++;
    }
  };
  VG.modelCells = (name, f) => (VR.VM && VR.VM.cells) ? VR.VM.cells(name, f) : [[0, 0]];
})(VR);

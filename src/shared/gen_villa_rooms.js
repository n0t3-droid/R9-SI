// ============================================================================
// The interior designer for the villa catalogue — now with the VX16 model pack
// (voxfurn.js): every room (and every zone of an open-plan room) is furnished
// from rules with real multi-block furniture: three-seaters with a chaise
// return facing a lowboard and wall TV over a rug and coffee table, arc lamps,
// curtains at the glass, fireplaces and grand pianos in the classic salons,
// six-seat dining tables under chandeliers with a sideboard, kitchen runs with
// sink under the window, hob, oven, tall unit, fridge and wall cabinets, an
// island with stools under pendants, double beds with nightstands and a bed
// bench, sliding wardrobes, desks with office chairs under the children's
// windows, baths with vanity + mirror, walk-in shower, freestanding tub and
// toilet, utility rooms with washers, walk-ins, studies and libraries, foyers
// with coat rack and console, galleries with benches and art, accent walls,
// LED coves, spots and plants everywhere. Lot-local frame as gen_villa.js.
// ============================================================================
(function (VR) {
  'use strict';
  const VG = VR.VillageGen;
  if (!VG || !VG.plan2) return;
  const PLAN = VG.plan2, VM = VR.VM;
  const DIR = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const FACE = [2, 3, 0, 1];                                // a piece against wall side s faces into the room
  const ART = ['vx_art_warm', 'vx_art_cool', 'vx_art_gold', 'vm_art_abstract', 'vm_art_landscape', 'vm_art_photo'];
  const RUGS = ['vx_rug_sand', 'vx_rug_blue', 'vx_rug_green'];
  const SOFA_COLS = ['charcoal', 'cream', 'taupe', 'sage', 'navy'];
  const BED_COLS = ['grey', 'navy', 'sage', 'white', 'rose'];
  const classic2 = (skin) => skin.id === 'classic' || skin.id === 'lake';

  // ctx: {hp, H, F, skin, info, rng, W, D, SH, roomAt}; r: the room or zone; parent: the open-plan room of a zone (or null)
  PLAN.furnish = function (ctx, r, parent) {
    const { hp, H, F, skin, info, rng, W, D } = ctx;
    const SH = ctx.SH || 4, y0 = F + r.fi * SH, y = y0 + 1, yc = y0 + SH - 1, used = new Set();   // yc: the ceiling row
    const key = (u, v) => u + ',' + v;
    const doors = r.doors || [], windows = (r.windows || []).filter(wn => wn.u >= r.u0 && wn.u <= r.u1 && wn.v >= r.v0 && wn.v <= r.v1);
    const isDoor = (u, v) => doors.some(dr => dr.u === u && dr.v === v);
    const isWin = (u, v) => windows.some(wn => wn.u === u && wn.v === v);
    const inRoom = (u, v) => u >= r.u0 && u <= r.u1 && v >= r.v0 && v <= r.v1;
    const free = (u, v) => inRoom(u, v) && !used.has(key(u, v)) && !isDoor(u, v);
    const take = (u, v) => used.add(key(u, v));
    const put = (u, v, name, pr) => { hp(u, y, v, name, pr); take(u, v); };
    const putUp = (u, v, name, pr) => hp(u, y + 1, v, name, pr);
    const spot = (u, v) => hp(u, yc, v, 'vx_spot');
    const seat = (u, v, f) => info.seats.push([H.u0 + u, y, H.v0 + v, f]);
    const cu = (r.u0 + r.u1) >> 1, cv = (r.v0 + r.v1) >> 1;
    // which sides are real walls (a zone's boundary to the next zone is open), and which of those are exterior
    const P0 = parent || r;
    const wallSide = [r.v0 === P0.v0, r.u1 === P0.u1, r.v1 === P0.v1, r.u0 === P0.u0];
    const rc = ctx.H.floors[r.fi].rect || [0, 0, ctx.H.w - 1, ctx.H.d - 1];
    const outer = [r.v0 === rc[1] + 1, r.u1 === rc[2] - 1, r.v1 === rc[3] - 1, r.u0 === rc[0] + 1].map((b, s) => b && wallSide[s]);
    const outerSides = [0, 1, 2, 3].filter(s => outer[s]);
    const innerSides = [0, 1, 2, 3].filter(s => wallSide[s] && !outer[s]);
    const doorOn = (s) => doors.some(dr => dr.side === s && inRoom(dr.u, dr.v));
    const wallCells = (s) => { const out = []; if (s === 0) for (let u = r.u0; u <= r.u1; u++) out.push([u, r.v0]); if (s === 2) for (let u = r.u0; u <= r.u1; u++) out.push([u, r.v1]); if (s === 3) for (let v = r.v0; v <= r.v1; v++) out.push([r.u0, v]); if (s === 1) for (let v = r.v0; v <= r.v1; v++) out.push([r.u1, v]); return out; };
    // ---- models: a multi-block piece covering a set of cells; anchored on part 0 by the footprint
    const fits = (cells) => cells.every(([u, v]) => free(u, v));
    const cellsFor = (name, f, u, v) => VM.cells(name, f).map(([dx, dz]) => [u + dx, v + dz]);
    // place model `name` facing f so that its floor cells cover `cells` (an exact match); returns true when placed
    const putModel = (name, f, cells) => {
      const off = VM.cells(name, f);
      if (off.length !== cells.length) return false;
      const au = Math.min(...cells.map(c => c[0])) - Math.min(...off.map(o => o[0])), av = Math.min(...cells.map(c => c[1])) - Math.min(...off.map(o => o[1]));
      const want = off.map(([dx, dz]) => [au + dx, av + dz]);
      if (!want.every(([u, v]) => cells.some(c => c[0] === u && c[1] === v) && free(u, v))) return false;
      VM.put(hp, au, y, av, name, f); for (const [u, v] of want) take(u, v);
      return true;
    };
    // place a model at a free anchor (u, v) facing f when every footprint cell is free; returns the cells or null
    const modelAt = (name, f, u, v) => { const cells = cellsFor(name, f, u, v); if (!fits(cells)) return null; VM.put(hp, u, y, v, name, f); for (const c of cells) take(c[0], c[1]); return cells; };
    // a model standing against wall s (back to the wall): `len` cells along the wall, `deep` rows into the room; opts as along()
    const modelAlong = (s, name, opts) => {
      opts = opts || {};
      const f = FACE[s], sz = VM.size(name, f), along_ = (s & 1) ? sz[2] : sz[0], deep = (s & 1) ? sz[0] : sz[2];
      const wall = wallCells(s), dd = DIR[f], cands = [];
      for (let i = 0; i + along_ <= wall.length; i++) {
        const cells = [];
        for (let k = 0; k < along_; k++) for (let q = 0; q < deep; q++) cells.push([wall[i + k][0] + dd[0] * q, wall[i + k][1] + dd[1] * q]);
        if (!fits(cells)) continue;
        if (opts.noWin && cells.slice(0, along_).some(([u, v]) => isWin(u, v))) continue;
        let score = -Math.abs(i + along_ / 2 - wall.length / 2);
        if (opts.win) score += cells.slice(0, along_).some(([u, v]) => isWin(u, v)) ? 10 : 0;
        if (opts.corner) score = (i === 0 || i + along_ === wall.length) ? 5 : 0;
        if (opts.at !== undefined) score = -Math.abs(i - opts.at) * 3;
        cands.push([score + rng.next() * 0.3, cells, i]);
      }
      if (!cands.length) return null;
      cands.sort((a, b) => b[0] - a[0]);
      const [, cells, i] = cands[0];
      if (!putModel(name, f, cells)) return null;
      return { cells, i, f, along: along_, deep };
    };
    // a run of `len` free cells along wall s (single-block pieces); opts: noWin, win, corner
    const along = (s, len, opts) => {
      opts = opts || {};
      const cells = wallCells(s), cands = [];
      for (let i = 0; i + len <= cells.length; i++) {
        const run = cells.slice(i, i + len);
        if (!run.every(([u, v]) => free(u, v))) continue;
        if (opts.noWin && run.some(([u, v]) => isWin(u, v))) continue;
        let score = -Math.abs(i + len / 2 - cells.length / 2);
        if (opts.win) score += run.some(([u, v]) => isWin(u, v)) ? 10 : 0;
        if (opts.corner) score = (i === 0 || i + len === cells.length) ? 5 : 0;
        cands.push([score + rng.next() * 0.3, run]);
      }
      if (!cands.length) return null;
      cands.sort((a, b) => b[0] - a[0]);
      const run = cands[0][1]; for (const [u, v] of run) take(u, v);
      return run;
    };
    const artOn = (s) => { if (!wallSide[s]) return; const c = along(s, 1, { noWin: true }); if (c) { putUp(c[0][0], c[0][1], rng.pick(ART), { facing: FACE[s] }); used.delete(key(c[0][0], c[0][1])); } };
    const curtains = () => { for (const wn of windows) { if (wn.kind !== 'tall' && wn.kind !== 'tall2') continue; for (const sg of [-1, 1]) { const u = (wn.side & 1) ? wn.u : wn.u + sg, v = (wn.side & 1) ? wn.v + sg : wn.v; if (free(u, v) && !isWin(u, v)) modelAt('vm_curtain', FACE[wn.side], u, v); } } };
    const lights = () => { const n = r.w * r.d; if (n <= 12) spot(cu, cv); else { spot(r.u0 + 1, r.v0 + 1); spot(r.u1 - 1, r.v1 - 1); if (n > 30) { spot(r.u1 - 1, r.v0 + 1); spot(r.u0 + 1, r.v1 - 1); } if (n > 60) { spot(cu, r.v0 + 1); spot(cu, r.v1 - 1); } } };
    const plantCorners = (n) => { let k = 0; for (const [u, v] of [[r.u0, r.v0], [r.u1, r.v1], [r.u1, r.v0], [r.u0, r.v1]]) { if (k >= n) break; if (free(u, v) && !isWin(u, v) && modelAt(rng.chance(0.5) ? 'vm_monstera' : 'vm_olive', 0, u, v)) k++; } };
    const pendantAt = (u, v, name) => hp(u, yc, v, name || 'vm_pendant', { facing: 0, part: 0 });
    // an accent wall: the partition behind wall side s (inner walls only) in a designer material; windows and doors stay
    const accentWall = (s, mat, y1, onlyNextTo) => {
      if (!wallSide[s] || outer[s]) return;
      const dd = DIR[s], cells = wallCells(s);
      if (onlyNextTo) { const m = cells[cells.length >> 1]; const other = ctx.roomAt[r.fi].get((m[0] + 2 * dd[0]) + ',' + (m[1] + 2 * dd[1])); if (other && !onlyNextTo[other.type]) return; }
      for (const [u, v] of cells) { if (isWin(u, v) || isDoor(u, v)) continue; const wu = u + dd[0], wv = v + dd[1]; for (let yy = y; yy <= (y1 === undefined ? yc - 1 : y1); yy++) hp(wu, yy, wv, mat); }
    };
    const SERVICE = { foyer: 1, hall: 1, gallery: 1, utility: 1, bath: 1, wc: 1, ensuite: 1, walkin: 1, kitchen: 1, garage: 1 };
    const ledCove = (s) => { if (!wallSide[s]) return; const cells = wallCells(s); for (let i = 1; i < cells.length - 1; i++) hp(cells[i][0], yc, cells[i][1], 'vx_led_cove', { facing: FACE[s] }); };
    const rugUnder = (cells, name) => { for (const [u, v] of cells) if (free(u, v)) put(u, v, name); };
    const type = r.type;
    const sofaCol = classic2(skin) ? rng.pick(['cream', 'taupe']) : rng.pick(SOFA_COLS);
    switch (type) {
      // ------------------------------------------------------------ living / salon
      case 'living': case 'salon': {
        const classic = classic2(skin);
        const fpSide = r.fireplace !== undefined && r.fireplace !== null ? (innerSides.find(s => !doorOn(s)) ?? innerSides[0]) : null;
        let tvSide = innerSides.find(s => s !== fpSide && !doorOn(s)); if (tvSide === undefined) tvSide = innerSides.find(s => s !== fpSide); if (tvSide === undefined) tvSide = 0;
        const focus = classic && fpSide !== null && fpSide !== undefined ? fpSide : tvSide;
        accentWall(focus, classic ? 'stucco_cream' : skin.id === 'bauhaus' || skin.id === 'blacklabel' ? 'micro_cement' : rng.chance(0.5) ? 'walnut_panel' : 'stacked_stone');
        ledCove(focus);
        let anchorCells = null;
        if (fpSide !== null && fpSide !== undefined) { const fp = modelAlong(fpSide, 'vm_fireplace', { noWin: true }); if (fp) { anchorCells = fp.cells; info.chimney = info.chimney || [H.u0 + fp.cells[0][0], y, H.v0 + fp.cells[0][1]]; } }
        if (!classic || !anchorCells) {
          const lb = modelAlong(focus, 'vm_lowboard', { noWin: true });
          if (lb) { anchorCells = lb.cells; const mid = lb.cells[1]; hp(mid[0], y + 1, mid[1], 'vm_tv', { facing: FACE[focus], part: 0 }); const nxt = cellsFor('vm_tv', FACE[focus], mid[0], mid[1])[1]; if (nxt) hp(nxt[0], y + 1, nxt[1], 'vm_tv', { facing: FACE[focus], part: 1 }); }
        }
        // the sofa faces the focus wall three cells in, the chaise returns at one end, a coffee table and rug between
        const dd = DIR[FACE[focus]];
        const base = anchorCells || wallCells(focus).filter(([u, v]) => inRoom(u, v)).slice(1, 4);
        const gap = Math.min(4, Math.max(3, ((focus & 1) ? r.w : r.d) - 3));
        const sofaCells = base.slice(0, 3).map(([u, v]) => [u + dd[0] * gap, v + dd[1] * gap]);
        const sofaF = focus;                                   // facing the wall it looks at
        let placedSofa = false;
        if (sofaCells.length === 3 && putModel('vm_sofa_' + sofaCol, sofaF, sofaCells)) { placedSofa = true; for (const [u, v] of sofaCells) seat(u, v, sofaF); }
        if (placedSofa) {
          // chaise at the end away from the room's door side
          const pd = DIR[(focus + 1) & 3], end = sofaCells[2], ch = [[end[0] + pd[0], end[1] + pd[1]], [end[0] + pd[0] - dd[0], end[1] + pd[1] - dd[1]]];
          const chF = focus;
          if (!putModel('vm_chaise_' + sofaCol, chF, [ch[0], ch[1]])) { const c2 = [[sofaCells[0][0] - pd[0], sofaCells[0][1] - pd[1]], [sofaCells[0][0] - pd[0] - dd[0], sofaCells[0][1] - pd[1] - dd[1]]]; if (putModel('vm_chaise_' + sofaCol, chF, c2)) for (const c of c2) seat(c[0], c[1], chF); } else for (const c of ch) seat(c[0], c[1], chF);
          // coffee table two in, rug under it, pendant above
          const tc = base.slice(0, 3).map(([u, v]) => [u + dd[0] * (gap - 2), v + dd[1] * (gap - 2)]);
          const tcells = [tc[0], tc[1]].map(c => c);
          const tf = (focus & 1) ? 1 : 0;
          if (!putModel(classic ? 'vm_coffee_table' : rng.chance(0.5) ? 'vm_coffee_table_glass' : 'vm_coffee_table', tf, [tc[1], tc[2]])) putModel('vm_coffee_table', tf, tcells);
          const rug = rng.pick(RUGS); for (let k = 1; k < gap; k++) for (const [u, v] of base.slice(0, 3)) { const ru = u + dd[0] * k, rv = v + dd[1] * k; if (free(ru, rv)) put(ru, rv, rug); }
          pendantAt(tc[1][0], tc[1][1], classic ? 'vm_chandelier' : 'vm_pendant'); info.lights.push([H.u0 + tc[1][0], yc, H.v0 + tc[1][1]]);
          // arc lamp behind the sofa's free end, a side table with a lamp at the other
          const arcU = sofaCells[0][0] - pd[0], arcV = sofaCells[0][1] - pd[1];
          if (!modelAt('vm_arc_lamp', (focus + 1) & 3, arcU, arcV)) modelAt('vm_arc_lamp', (focus + 3) & 3, arcU, arcV);
          const st = [sofaCells[0][0] - pd[0] + dd[0], sofaCells[0][1] - pd[1] + dd[1]]; if (free(st[0], st[1])) { modelAt('vm_side_table', 0, st[0], st[1]); hp(st[0], y + 1, st[1], 'vm_table_lamp', { facing: 0, part: 0 }); }
        }
        // two armchairs flank the coffee table (facing each other across it) when the room is wide enough
        if (placedSofa) {
          const pd = DIR[(focus + 1) & 3], tcRow = base.slice(0, 3).map(([u, v]) => [u + dd[0] * (gap - 2), v + dd[1] * (gap - 2)]);
          const left = [tcRow[0][0] - pd[0], tcRow[0][1] - pd[1]], right = [tcRow[2][0] + pd[0], tcRow[2][1] + pd[1]];
          if (modelAt('vm_armchair_' + sofaCol, (focus + 1) & 3, left[0], left[1])) seat(left[0], left[1], (focus + 1) & 3);
          if (modelAt('vm_armchair_' + sofaCol, (focus + 3) & 3, right[0], right[1])) seat(right[0], right[1], (focus + 3) & 3);
          const fl = [right[0] - dd[0], right[1] - dd[1]]; if (free(fl[0], fl[1])) modelAt('vm_floor_lamp', 0, fl[0], fl[1]);
        }
        // a console table behind the sofa, and in the big open zones a reading corner at the far end: two armchairs, a side table with a lamp, a floor lamp and a rug
        if (placedSofa) {
          const pd = DIR[(focus + 1) & 3];
          const behind = sofaCells.slice(0, 2).map(([u, v]) => [u + dd[0], v + dd[1]]);
          if (behind.every(([u, v]) => free(u, v))) putModel('vm_console', (focus & 1) ? 1 : 0, behind);
          if (r.w * r.d >= 80) {
            const far = ((focus & 1) ? r.w : r.d) - 3, mid = base[1];
            const c = [mid[0] + dd[0] * far, mid[1] + dd[1] * far];
            const a = [c[0] - pd[0], c[1] - pd[1]], bq = [c[0] + pd[0], c[1] + pd[1]];
            if (free(c[0], c[1]) && modelAt('vm_side_table', 0, c[0], c[1])) {
              hp(c[0], y + 1, c[1], 'vm_table_lamp', { facing: 0, part: 0 });
              if (modelAt('vm_armchair_' + sofaCol, (focus + 1) & 3, a[0], a[1])) seat(a[0], a[1], (focus + 1) & 3);
              if (modelAt('vm_armchair_' + sofaCol, (focus + 3) & 3, bq[0], bq[1])) seat(bq[0], bq[1], (focus + 3) & 3);
              const fl2 = [c[0] - dd[0], c[1] - dd[1]]; if (free(fl2[0], fl2[1])) modelAt('vm_floor_lamp', 0, fl2[0], fl2[1]);
              const rug2 = rng.pick(RUGS); for (const [u, v] of [[a[0] + dd[0], a[1] + dd[1]], [c[0] + dd[0], c[1] + dd[1]], [bq[0] + dd[0], bq[1] + dd[1]], [a[0] - dd[0], a[1] - dd[1]], [bq[0] - dd[0], bq[1] - dd[1]]]) if (free(u, v)) put(u, v, rug2);
            }
          }
        }
        // a sideboard with art and a lamp on a side wall, a bookcase, a bar cart in a corner; piano for the classic salons
        const sides2 = innerSides.filter(s => s !== focus && !doorOn(s)).concat(outerSides.filter(s => s !== focus));
        const sbSide = sides2[0];
        if (sbSide !== undefined) { const sb = modelAlong(sbSide, 'vm_sideboard', { noWin: true }); if (sb) { putUp(sb.cells[1][0], sb.cells[1][1], rng.pick(ART), { facing: FACE[sbSide] }); } }
        if (classic) { const pn = modelAlong((focus + 1) & 3, 'vm_piano', { noWin: true, corner: true }) || modelAlong((focus + 3) & 3, 'vm_piano', { noWin: true, corner: true }); void pn; }
        else { const bs = innerSides.find(s => s !== focus && s !== sbSide && !doorOn(s)); if (bs !== undefined) modelAlong(bs, 'vm_bookshelf', { noWin: true, corner: true }); }
        const ac = modelAlong((focus + 2) & 3, 'vm_armchair_' + sofaCol, { noWin: true, corner: true }); if (ac) seat(ac.cells[0][0], ac.cells[0][1], FACE[(focus + 2) & 3]);
        if (r.w * r.d >= 30) modelAlong((focus + 2) & 3, 'vm_bar_cart', { noWin: true, corner: true });
        const sh = along((focus + 2) & 3, 1, { noWin: true }); if (sh && wallSide[(focus + 2) & 3]) { hp(sh[0][0], y + 1, sh[0][1], 'vm_wall_shelf', { facing: FACE[(focus + 2) & 3], part: 0 }); used.delete(key(sh[0][0], sh[0][1])); }
        curtains(); plantCorners(r.w * r.d >= 40 ? 3 : 2);
        for (const s of [0, 1, 2, 3]) if (s !== focus) { artOn(s); if (((s & 1) ? r.d : r.w) >= 7) artOn(s); }
        lights();
        break;
      }
      // ------------------------------------------------------------ dining
      case 'dining': {
        const alongU = r.w >= r.d, f = alongU ? 0 : 1;
        const tbl = classic2(skin) ? 'vm_dining_table' : rng.chance(0.5) ? 'vm_dining_table' : 'vm_dining_table_oak';
        const chair = classic2(skin) ? 'vm_dining_chair_oak' : rng.chance(0.5) ? 'vm_dining_chair' : 'vm_dining_chair_oak';
        const u0 = alongU ? cu - 1 : cu, v0 = alongU ? cv : cv - 1;
        const cells = alongU ? [[u0, v0], [u0 + 1, v0], [u0 + 2, v0]] : [[u0, v0], [u0, v0 + 1], [u0, v0 + 2]];
        if (putModel(tbl, f, cells)) {
          info.table = info.table || [H.u0 + cells[1][0], y, H.v0 + cells[1][1]];
          const benchSide = tbl === 'vm_dining_table_oak' && rng.chance(0.6) ? 1 : 0;   // oak sets get a bench along the far side
          const far = cells.map(([u, v]) => alongU ? [u, v + 1] : [u + 1, v]);
          if (benchSide && putModel('vm_dining_bench', f, far)) for (const [bu, bv] of far) seat(bu, bv, alongU ? 0 : 3);
          for (const [u, v] of cells) { const a = alongU ? [u, v - 1, 2] : [u - 1, v, 1], b = alongU ? [u, v + 1, 0] : [u + 1, v, 3]; for (const [cu3, cv3, cf] of [a, b]) if (modelAt(chair, cf, cu3, cv3)) seat(cu3, cv3, cf); }
          // head chairs at both ends when the room allows
          const e1 = alongU ? [cells[0][0] - 1, cells[0][1], 1] : [cells[0][0], cells[0][1] - 1, 2], e2 = alongU ? [cells[2][0] + 1, cells[2][1], 3] : [cells[2][0], cells[2][1] + 1, 0];
          for (const [eu, ev, ef] of [e1, e2]) if (((alongU ? r.w : r.d) >= 7) && modelAt(chair, ef, eu, ev)) seat(eu, ev, ef);
          pendantAt(cells[1][0], cells[1][1], 'vm_chandelier'); if (r.w * r.d >= 40) { pendantAt(cells[0][0], cells[0][1], 'vm_pendant'); pendantAt(cells[2][0], cells[2][1], 'vm_pendant'); }
          rugUnder(cells.concat(cells.map(([u, v]) => alongU ? [u, v - 1] : [u - 1, v]), cells.map(([u, v]) => alongU ? [u, v + 1] : [u + 1, v])), 'vx_rug_sand');
        }
        const sbs = innerSides.find(s => !doorOn(s)) ?? innerSides[0];
        if (sbs !== undefined) { accentWall(sbs, classic2(skin) ? 'stucco_cream' : 'stucco_grey'); const sb = modelAlong(sbs, 'vm_sideboard', { noWin: true }); if (sb) putUp(sb.cells[1][0], sb.cells[1][1], rng.pick(ART), { facing: FACE[sbs] }); }
        if (r.winter) plantCorners(4); else { plantCorners(2); artOn(innerSides[1] !== undefined ? innerSides[1] : 0); artOn((sbs !== undefined ? sbs + 2 : 2) & 3); }
        if (r.w * r.d >= 30) { modelAlong((sbs !== undefined ? sbs + 2 : 0) & 3, 'vm_floor_lamp', { noWin: true, corner: true }); modelAlong((sbs !== undefined ? sbs + 1 : 1) & 3, 'vm_bar_cart', { noWin: true, corner: true }); }
        curtains();
        break;
      }
      // ------------------------------------------------------------ kitchen
      case 'kitchen': {
        const s = outerSides.includes(2) ? 2 : outerSides[0] !== undefined ? outerSides[0] : innerSides[0];
        const style = skin.id === 'bauhaus' || skin.id === 'blacklabel' ? 'black' : classic2(skin) || skin.id === 'mediterran' || skin.id === 'sand' ? 'oak' : rng.pick(['white', 'white', 'black', 'oak']);
        const K = 'vm_kitchen_' + style + '_';
        accentWall(s, style === 'black' ? 'black_kitchen' : 'subway_tile', undefined, SERVICE);
        const wall = wallCells(s).filter(([u, v]) => free(u, v)), f = FACE[s], n = wall.length;
        const sinkAt = Math.max(1, wall.findIndex(([u, v]) => isWin(u, v)));
        wall.forEach(([u, v], k) => {
          if (k === n - 1) { modelAt('vm_fridge', f, u, v); return; }
          if (k === n - 2 && n >= 6) { modelAt(K + 'tall', f, u, v); return; }
          const name = k === sinkAt ? K + 'sink' : k === sinkAt + 1 ? 'vm_dishwasher' : k === sinkAt + 2 ? K + 'hob' : k === sinkAt + 3 ? K + 'oven' : K + 'cabinet';
          modelAt(name, f, u, v);
          if (k === sinkAt + 2) hp(u, y + 2, v, 'vm_range_hood', { facing: f, part: 0 });
          else if (!isWin(u, v)) hp(u, y + 2, v, K + 'upper', { facing: f, part: 0 });
          if (name === K + 'hob') info.work.push(['stove', H.u0 + u + DIR[f][0], y, H.v0 + v + DIR[f][1]]);
        });
        if (!info.work.some(wk => wk[0] === 'stove') && wall.length) info.work.push(['stove', H.u0 + wall[1][0] + DIR[f][0], y, H.v0 + wall[1][1] + DIR[f][1]]);
        // the island two cells in, parallel to the counters, with stools on the far side and pendants above
        if (((s & 1) ? r.w : r.d) >= 5 && n >= 5) {
          const dd = DIR[f], i0 = Math.max(1, (n >> 1) - 1), a = wall[i0], b = wall[i0 + 1];
          const ic = [[a[0] + dd[0] * 2, a[1] + dd[1] * 2], [b[0] + dd[0] * 2, b[1] + dd[1] * 2]];
          if (putModel('vm_island', (s & 1) ? 1 : 0, ic)) {
            for (const [u, v] of ic) { const su = u + dd[0], sv = v + dd[1]; if (modelAt('vm_stool', (f + 2) & 3, su, sv)) seat(su, sv, s); pendantAt(u, v, 'vm_pendant'); }
          }
        }
        // an L: a second run of cabinets turns the corner onto the neighbouring wall (tall unit at its end), in the big zones a breakfast table in the middle
        const s2 = [(s + 1) & 3, (s + 3) & 3].find(x => wallSide[x] && !doorOn(x));
        if (s2 !== undefined && ((s2 & 1) ? r.d : r.w) >= 6) {
          const f2 = FACE[s2], run = wallCells(s2).filter(([u, v]) => free(u, v) && !isDoor(u, v));
          // closest cells to the main run first
          const dist = ([u, v]) => s === 0 ? v - r.v0 : s === 2 ? r.v1 - v : s === 3 ? u - r.u0 : r.u1 - u;
          run.sort((a, b) => dist(a) - dist(b));
          const n2 = Math.min(4, run.length - 1);
          for (let k = 0; k < n2; k++) { const [u, v] = run[k]; const nm = k === n2 - 1 ? K + 'tall' : k === 1 ? K + 'oven' : K + 'cabinet'; if (modelAt(nm, f2, u, v) && nm !== K + 'tall' && !isWin(u, v)) hp(u, y + 2, v, K + 'upper', { facing: f2, part: 0 }); }
        }
        if (r.w * r.d >= 60) {
          const alongU = r.w >= r.d, f3 = alongU ? 0 : 1, bu = alongU ? cu - 1 : cu, bv = alongU ? cv - 2 : cv - 1;
          const cells = alongU ? [[bu, bv], [bu + 1, bv], [bu + 2, bv]] : [[bu, bv], [bu, bv + 1], [bu, bv + 2]];
          if (cells.every(([u, v]) => free(u, v)) && putModel('vm_dining_table_oak', f3, cells)) {
            for (const [u, v] of cells) { const a = alongU ? [u, v - 1, 2] : [u - 1, v, 1], b = alongU ? [u, v + 1, 0] : [u + 1, v, 3]; for (const [cu3, cv3, cf] of [a, b]) if (modelAt('vm_dining_chair_oak', cf, cu3, cv3)) seat(cu3, cv3, cf); }
            pendantAt(cells[1][0], cells[1][1], 'vm_pendant');
          }
        }
        const ks = innerSides.find(x => x !== s && x !== s2 && !doorOn(x)) ?? s2; if (ks !== undefined) { const c = along(ks, 1, { noWin: true }); if (c) { hp(c[0][0], y + 1, c[0][1], 'vm_kitchen_shelf', { facing: FACE[ks], part: 0 }); used.delete(key(c[0][0], c[0][1])); } }
        plantCorners(1); lights();
        break;
      }
      // ------------------------------------------------------------ bedrooms
      case 'master': case 'kid': case 'guest': case 'bedroom': {
        const master = type === 'master';
        const pref = innerSides.filter(s => !doorOn(s) && ((s & 1) ? r.w >= 4 : r.d >= 4));
        const s = pref.length ? pref[0] : innerSides.length ? innerSides[0] : (r.d >= r.w ? 0 : 3);
        accentWall(s, master ? (rng.chance(0.5) ? 'walnut_panel' : 'micro_cement') : rng.pick(['stucco_grey', 'stucco_sand', 'walnut_panel']));
        const col = rng.pick(BED_COLS);
        const bunk = type === 'kid' && r.w * r.d < 30 && rng.chance(0.5);
        const bed = master || r.w * r.d >= 30 ? modelAlong(s, 'vm_bed_' + col, { noWin: true }) : modelAlong(s, bunk ? 'vm_bunk_bed' : 'vm_bed_single', { noWin: true });
        if (bed) {
          const f = FACE[s], headDir = (f + 2) & 3;          // the villagers lie with their heads toward the wall
          const row0 = bed.cells.filter((c, i) => i % bed.deep === bed.deep - 1);   // the foot row (farthest from the wall)
          for (const [u, v] of row0) info.beds.push([H.u0 + u, y, H.v0 + v, headDir]);
          const pd = DIR[(s + 1) & 3];
          const first = bed.cells[0], last = bed.cells[(bed.along - 1) * bed.deep];
          for (const [nu, nv] of [[first[0] - pd[0], first[1] - pd[1]], [last[0] + pd[0], last[1] + pd[1]]]) if (free(nu, nv) && !isWin(nu, nv)) modelAt('vm_nightstand', f, nu, nv);
          const mid = bed.cells[bed.deep * (bed.along >> 1)]; putUp(mid[0], mid[1], rng.pick(ART), { facing: f });
          if (master) { const bb = row0.map(([u, v]) => [u + DIR[f][0], v + DIR[f][1]]); if (bb.length === 2) putModel('vm_bench', (s & 1) ? 1 : 0, bb); }
          const rugCells = row0.map(([u, v]) => [u + DIR[f][0] * (master ? 2 : 1), v + DIR[f][1] * (master ? 2 : 1)]); rugUnder(rugCells, rng.pick(RUGS));
          pendantAt(mid[0] + DIR[f][0], mid[1] + DIR[f][1], master ? 'vm_chandelier' : 'vm_pendant');
        }
        // wardrobes on another wall (the master's dressing wall), a mirror, a desk for the kids under the window
        const ws = innerSides.find(x => x !== s && !doorOn(x)) ?? ((s + 1) & 3);
        const wr = rng.chance(0.5) ? 'vm_wardrobe' : 'vm_wardrobe_walnut';
        const w1 = modelAlong(ws, wr, { noWin: true }); if (master && w1) modelAlong(ws, wr, { noWin: true, at: w1.i + 2 });
        if (master || rng.chance(0.5)) modelAlong(ws, 'vm_mirror', { noWin: true, corner: true });
        if (!master) { const win = windows.find(wn => wn.kind !== 'tall2' && wn.kind !== 'tall') || windows[0]; if (win) { const dk = modelAlong(win.side, 'vm_desk', { win: true }); if (dk) { const dd2 = DIR[FACE[win.side]], ch = [dk.cells[0][0] + dd2[0], dk.cells[0][1] + dd2[1]]; if (modelAt('vm_office_chair', win.side, ch[0], ch[1])) { seat(ch[0], ch[1], win.side); info.desks.push([H.u0 + ch[0], y, H.v0 + ch[1], win.side]); } } } }
        if (type === 'kid') { modelAlong((s + 2) & 3, 'vm_bookshelf', { noWin: true, corner: true }); modelAlong((s + 2) & 3, 'vm_toy_box', { noWin: true, corner: true }); }
        const ds = innerSides.find(x => x !== s && x !== ws && !doorOn(x)) ?? ((s + 2) & 3);
        const dr = modelAlong(ds, 'vm_dresser', { noWin: true }); if (dr) { putUp(dr.cells[0][0], dr.cells[0][1], 'vm_mirror_round', { facing: FACE[ds], part: 0 }); }
        if (master) { const ac = modelAlong((s + 2) & 3, 'vm_armchair_' + sofaCol, { noWin: true, corner: true }); if (ac) { seat(ac.cells[0][0], ac.cells[0][1], FACE[(s + 2) & 3]); const au = ac.cells[0][0] + DIR[(s + 3) & 3][0], av = ac.cells[0][1] + DIR[(s + 3) & 3][1]; if (!modelAt('vm_arc_lamp', FACE[(s + 2) & 3], au, av)) modelAt('vm_floor_lamp', 0, au, av); } }
        modelAlong(ws, 'vm_laundry_basket', { noWin: true, corner: true });
        curtains(); plantCorners(1); for (const s2 of [0, 1, 2, 3]) if (s2 !== s) artOn(s2); lights();
        break;
      }
      // ------------------------------------------------------------ baths
      case 'bath': case 'ensuite': case 'wc': {
        const s = innerSides.find(x => !doorOn(x)) ?? innerSides[0] ?? 2;
        accentWall(s, type === 'wc' ? 'subway_tile' : 'dark_tile', undefined, SERVICE);
        const van = modelAlong(s, 'vm_vanity', { noWin: true });
        if (type !== 'wc' && r.w * r.d >= 20) modelAlong(s, 'vm_vanity', { noWin: true, at: van ? van.i + 1 : 0 });
        modelAlong(s, 'vm_toilet', { noWin: true, corner: true }) || modelAlong((s + 2) & 3, 'vm_toilet', { noWin: true, corner: true });
        if (type !== 'wc') {
          const sh2 = innerSides.find(x => x !== s) ?? ((s + 1) & 3);
          modelAlong(sh2, 'vm_shower', { noWin: true, corner: true }) || modelAlong((s + 1) & 3, 'vm_shower', { corner: true });
          if (r.w * r.d >= 20) { const bs = outerSides[0] !== undefined ? outerSides[0] : (s + 2) & 3; modelAlong(bs, 'vm_bathtub', {}); }
          const sh = along((s + 1) & 3, 1, { noWin: true }); if (sh && wallSide[(s + 1) & 3]) { hp(sh[0][0], y + 1, sh[0][1], 'vm_wall_shelf', { facing: FACE[(s + 1) & 3], part: 0 }); used.delete(key(sh[0][0], sh[0][1])); }
        }
        const tr = innerSides.find(x => x !== s) ?? ((s + 1) & 3); { const c = along(tr, 1, { noWin: true }); if (c) { hp(c[0][0], y, c[0][1], 'vm_towel_rail', { facing: FACE[tr], part: 0 }); } }
        if (type !== 'wc') modelAlong(s, 'vm_laundry_basket', { noWin: true, corner: true });
        if (free(cu, cv)) put(cu, cv, 'vx_rug_sand');
        if (type === 'wc') artOn((s + 2) & 3); else { plantCorners(1); artOn((s + 2) & 3); }
        spot(cu, cv); if (r.w * r.d >= 20) { spot(r.u0 + 1, r.v0 + 1); spot(r.u1 - 1, r.v1 - 1); }
        break;
      }
      // ------------------------------------------------------------ utility / walk-in
      case 'utility': {
        const s = innerSides.find(x => !doorOn(x)) ?? outerSides[0] ?? 0;
        const w1 = modelAlong(s, 'vm_washer', { noWin: true }); if (w1) modelAlong(s, 'vm_washer', { noWin: true, at: w1.i + 1 });
        modelAlong(s, 'vm_kitchen_white_tall', { noWin: true, corner: true });
        modelAlong((s + 2) & 3, 'vm_kitchen_white_sink', { win: true });
        const sh = along(s, 1, { noWin: true }); if (sh) { hp(sh[0][0], y + 1, sh[0][1], 'vm_wall_shelf', { facing: FACE[s], part: 0 }); used.delete(key(sh[0][0], sh[0][1])); }
        if (free(r.u1, r.v1)) put(r.u1, r.v1, 'vx_crate');
        spot(cu, cv);
        break;
      }
      case 'walkin': {
        const longSides = r.w >= r.d ? [0, 2] : [3, 1];
        for (const s of longSides) if (wallSide[s]) { let k = 0; while (modelAlong(s, k & 1 ? 'vm_wardrobe' : 'vm_wardrobe_walnut', { noWin: true }) && k < 4) k++; }
        const ms = innerSides.find(x => !longSides.includes(x) && !doorOn(x)); if (ms !== undefined) modelAlong(ms, 'vm_mirror', { noWin: true });
        if (free(cu, cv)) put(cu, cv, 'vx_rug_sand'); if (r.w * r.d >= 12) { const bc = [[cu, cv], [cu + 1, cv]]; putModel('vm_bench', 0, bc); }
        spot(cu, cv);
        break;
      }
      // ------------------------------------------------------------ study / library
      case 'study': {
        const win = windows[0];
        const s = win ? win.side : (innerSides[0] !== undefined ? innerSides[0] : 0);
        const dk = modelAlong(s, 'vm_desk', { win: true });
        if (dk) { const dd = DIR[FACE[s]], ch = [dk.cells[0][0] + dd[0], dk.cells[0][1] + dd[1]]; if (modelAt('vm_office_chair', s, ch[0], ch[1])) { seat(ch[0], ch[1], s); info.work.push(['desk', H.u0 + ch[0], y, H.v0 + ch[1]]); } }
        const bs = innerSides.find(x => x !== s && !doorOn(x)) ?? ((s + 2) & 3);
        accentWall(bs, 'walnut_panel');
        let k = 0; while (modelAlong(bs, 'vm_bookshelf', { noWin: true }) && k < 3) k++;
        const ac = modelAlong((s + 2) & 3, 'vm_armchair_' + sofaCol, { noWin: true, corner: true }); if (ac) { seat(ac.cells[0][0], ac.cells[0][1], FACE[(s + 2) & 3]); const au = ac.cells[0][0] + DIR[(s + 3) & 3][0], av = ac.cells[0][1] + DIR[(s + 3) & 3][1]; modelAt('vm_arc_lamp', FACE[(s + 2) & 3], au, av); }
        if (free(cu, cv)) put(cu, cv, 'vx_rug_blue');
        artOn((s + 1) & 3); plantCorners(1); lights();
        break;
      }
      case 'library': {
        for (const s of [0, 1, 2, 3]) if (wallSide[s] && !doorOn(s)) { let k = 0; while (modelAlong(s, 'vm_bookshelf', { noWin: true }) && k < 6) k++; }
        const a = [cu - 1, cv], b = [cu + 1, cv];
        if (modelAt('vm_armchair_' + sofaCol, 1, a[0], a[1])) seat(a[0], a[1], 1); if (modelAt('vm_armchair_' + sofaCol, 3, b[0], b[1])) seat(b[0], b[1], 3);
        const tc = [[cu, cv], [cu, cv + 1]]; if (!putModel('vm_coffee_table', 1, tc)) modelAt('vm_side_table', 0, cu, cv);
        modelAt('vm_arc_lamp', 0, cu, cv - 1);
        pendantAt(cu, cv, 'vm_chandelier'); info.work.push(['read', H.u0 + a[0], y, H.v0 + a[1]]);
        rugUnder([[cu - 1, cv + 1], [cu + 1, cv + 1], [cu - 1, cv - 1], [cu + 1, cv - 1]], 'vx_rug_green');
        curtains();
        break;
      }
      // ------------------------------------------------------------ home cinema / bar
      case 'cinema': {
        const s = innerSides.find(x => !doorOn(x)) ?? innerSides[0] ?? 0;
        accentWall(s, 'charcoal_panel'); ledCove(s);
        const lb = modelAlong(s, 'vm_lowboard', { noWin: true });
        if (lb) {
          const f = FACE[s], dd = DIR[f];
          for (const c of lb.cells) { hp(c[0], y + 1, c[1], 'vm_tv', { facing: f, part: lb.cells.indexOf(c) === 0 ? 0 : 1 }); }   // a wall-wide screen
          for (const gap of [3, 5]) { const row = lb.cells.map(([u, v]) => [u + dd[0] * gap, v + dd[1] * gap]); if (putModel('vm_sofa_' + (gap === 3 ? 'charcoal' : 'taupe'), s, row)) for (const c of row) seat(c[0], c[1], s); }
          for (const [u, v] of lb.cells) for (let k = 1; k < 3; k++) { const ru = u + dd[0] * k, rv = v + dd[1] * k; if (free(ru, rv)) put(ru, rv, 'vx_rug_blue'); }
        }
        modelAt('vm_arc_lamp', 0, r.u0, r.v1); plantCorners(1);
        for (let v = r.v0 + 1; v <= r.v1 - 1; v += 2) spot(cu, v);
        break;
      }
      case 'bar': {
        const s = innerSides.find(x => !doorOn(x)) ?? innerSides[0] ?? 0;
        accentWall(s, 'walnut_panel');
        const dd = DIR[FACE[s]], wall = wallCells(s);
        const sb = modelAlong(s, 'vm_lowboard', { noWin: true }); if (sb) for (const c of sb.cells) hp(c[0], y + 1, c[1], 'vm_wall_shelf', { facing: FACE[s], part: 0 });
        const i0 = Math.max(0, (wall.length >> 1) - 1), ic = [[wall[i0][0] + dd[0] * 2, wall[i0][1] + dd[1] * 2], [wall[i0 + 1][0] + dd[0] * 2, wall[i0 + 1][1] + dd[1] * 2]];
        if (putModel('vm_island', (s & 1) ? 1 : 0, ic)) for (const [u, v] of ic) { const su = u + dd[0], sv = v + dd[1]; if (modelAt('vm_stool', (FACE[s] + 2) & 3, su, sv)) seat(su, sv, s); pendantAt(u, v, 'vm_pendant'); }
        plantCorners(1); ledCove((s + 2) & 3); artOn((s + 1) & 3);
        break;
      }
      // ------------------------------------------------------------ foyer / gallery
      case 'foyer': {
        const grand = r.grand;
        const s = innerSides.find(x => !doorOn(x)) ?? innerSides[0] ?? 1;
        modelAlong(s, 'vm_coat_rack', { noWin: true, corner: true });
        accentWall((s + 2) & 3, grand ? 'marble_white' : rng.chance(0.5) ? 'walnut_panel' : 'stacked_stone');
        const cs = modelAlong((s + 2) & 3, 'vm_console', { noWin: true }); if (cs) putUp(cs.cells[0][0], cs.cells[0][1], grand ? rng.pick(ART) : 'vm_mirror_round', grand ? { facing: FACE[(s + 2) & 3] } : { facing: FACE[(s + 2) & 3], part: 0 });
        if (grand) modelAlong((s + 2) & 3, 'vm_sculpture', { noWin: true, corner: true }); else artOn(s);
        const eu = H.entry.u + (H.entry.n >> 1);
        for (let k = -1; k <= 1; k++) if (free(eu + k, r.v0)) put(eu + k, r.v0, 'vx_rug_sand');
        if (grand) {
          for (let v = r.v0 + 1; v <= r.v1 - 1; v += 3) { if (free(r.u0, v) && !isWin(r.u0, v)) put(r.u0, v, 'vx_urn_white'); if (free(r.u1, v) && !isWin(r.u1, v)) put(r.u1, v, 'vx_urn_white'); }
          pendantAt(cu, r.v1 - 2, 'vm_chandelier');
          for (let v = r.v0 + 2; v <= r.v1 - 1; v += 3) { if (!isDoor(r.u0, v)) hp(r.u0, y + 1, v, rng.pick(ART), { facing: 1 }); if (!isDoor(r.u1, v)) hp(r.u1, y + 1, v, rng.pick(ART), { facing: 3 }); }
        } else { plantCorners(1); artOn((s + 1) & 3); pendantAt(cu, r.v0 + 1, 'vm_pendant'); }
        for (let v = r.v0 + 2; v <= r.v1 - 1; v += 3) spot(cu, v);
        break;
      }
      case 'gallery': case 'hall': {
        const s = innerSides.find(x => !doorOn(x)) ?? innerSides[0];
        if (s !== undefined) { accentWall(s, 'walnut_panel'); const bc = modelAlong(s, 'vm_bench', { noWin: true }); if (bc) for (const c of bc.cells) seat(c[0], c[1], FACE[s]); }
        const bs = innerSides.find(x => x !== s && !doorOn(x)); if (bs !== undefined) { modelAlong(bs, 'vm_bookshelf', { noWin: true, corner: true }); modelAlong(bs, 'vm_sculpture', { noWin: true, corner: true }); }
        plantCorners(2);
        const longU = r.w >= r.d;
        for (let k = 1; k < (longU ? r.w : r.d) - 1; k += 3) { const a = longU ? [r.u0 + k, r.v0] : [r.u0, r.v0 + k], b = longU ? [r.u0 + k, r.v1] : [r.u1, r.v0 + k]; if (!isDoor(a[0], a[1]) && !isWin(a[0], a[1])) hp(a[0], y + 1, a[1], rng.pick(ART), { facing: longU ? 2 : 1 }); if (!isDoor(b[0], b[1]) && !isWin(b[0], b[1])) hp(b[0], y + 1, b[1], rng.pick(ART), { facing: longU ? 0 : 3 }); }
        for (let k = 1; k < (longU ? r.w : r.d) - 1; k += 2) { const c = longU ? [r.u0 + k, cv] : [cu, r.v0 + k]; if (free(c[0], c[1])) put(c[0], c[1], 'vx_rug_sand'); }
        ledCove(longU ? 0 : 3);
        for (let v = r.v0 + 1; v <= r.v1 - 1; v += 3) spot(cu, v);
        break;
      }
      default: lights();
    }
    if (r.tower) { const tu = r.u0 === 1 ? 0 : W + 1, tv = r.v0 === 1 ? 0 : D + 1; hp(tu, y, tv, 'vx_tall_plant'); }
  };
})(VR);

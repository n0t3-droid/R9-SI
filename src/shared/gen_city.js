// ============================================================================
// Palm City buildings (TRAILER.md §3.2): stepped tech towers — two to four
// storeys of white tech panels, each upper storey set back so terraces with
// glass railings and roof gardens appear, turquoise window bands in amber
// frames on every storey, orange light strips along every floor edge, a flat
// roof with bushes, planters and a small dome. Interiors keep what the
// villagers need: beds on the top floor, a table with chairs, a stove and
// counter, a ladder up the back corner. Built into the same lot frame and
// info record as the regular village houses.
// ============================================================================
(function (VR) {
  'use strict';
  const VG = VR.VillageGen;
  if (!VG) return;
  // o: {w, d, floors, F, rng, beds, ground(u,v), seed, kind}  — lot-local: u across the front, v into the lot
  VG.techTower = function (L, o) {
    const P = L.P, rng = o.rng, w = o.w, d = o.d, F = o.F, floors = Math.max(2, Math.min(4, o.floors || 3));
    const S = VG.STYLES.tech;
    const info = { beds: [], seats: [], work: [], door: null, inside: null, chimney: null, lights: [], kind: o.kind };
    const du = w >> 1;
    const wallN = rng.pick(['vx_tech_white', 'vx_tech_white', 'vx_tech_hex_white']), winN = 'vx_window_tech', band = 'vx_tech_band', trim = 'vx_tech_trim';
    // storey rectangles: u0..u1, v0..v1 — upper storeys step in from the street and from one side
    const side = rng.chance(0.5) ? 1 : -1, frontStep = rng.chance(0.75);
    const rects = [];
    for (let k = 0; k < floors; k++) {
      let u0 = 0, u1 = w - 1, v0 = 0, v1 = d - 1;
      if (k > 0) {
        const ins = Math.min(k, 2);
        if (side > 0) u1 = w - 1 - ins; else u0 = ins;
        if (frontStep) v0 = Math.min(d - 5, k * 2); else v1 = Math.max(4, d - 1 - k * 2);
      }
      rects.push([u0, u1, v0, v1]);
    }
    const inRect = (r, u, v) => u >= r[0] && u <= r[1] && v >= r[2] && v <= r[3];
    const onEdge = (r, u, v) => u === r[0] || u === r[1] || v === r[2] || v === r[3];
    // ---- foundation + ground floor
    for (let u = 0; u < w; u++) for (let v = 0; v < d; v++) {
      const gy = o.ground(u, v);
      for (let y = gy + 1; y < F; y++) P(u, y, v, S.base);
      P(u, F, v, S.floor);
    }
    // ---- storeys
    for (let k = 0; k < floors; k++) {
      const r = rects[k], y0 = F + k * 4, top = y0 + 4;
      const rBelow = k > 0 ? rects[k - 1] : null;
      for (let u = 0; u < w; u++) for (let v = 0; v < d; v++) {
        const inside = inRect(r, u, v);
        if (k > 0) {
          // the slab: floor inside, terrace (roof of the storey below) outside — with railing on its outer edge
          const below = inRect(rBelow, u, v);
          if (inside) P(u, y0, v, onEdge(r, u, v) ? band : S.floor);
          else if (below) { P(u, y0, v, S.floor); P(u, y0 + 1, v, onEdge(rBelow, u, v) ? S.fence : (((u * 3 + v * 5 + o.seed) % 7 === 0) ? (rng.chance(0.5) ? 'vx_bush' : 'vx_tech_planter') : null)); }
        }
        if (!inside) continue;
        const edge = onEdge(r, u, v);
        for (let y = y0 + 1; y <= y0 + 3; y++) {
          if (!edge) { P(u, y, v, null); continue; }
          P(u, y, v, y === y0 + 3 ? trim : wallN);
        }
      }
      // window bands on every face (not over the door), glass corners
      const wy = y0 + 2;
      for (let u = r[0] + 1; u < r[1]; u++) {
        if (!(k === 0 && Math.abs(u - du) <= 1)) P(u, wy, r[2], winN, { facing: 0 });
        P(u, wy, r[3], winN, { facing: 0 });
      }
      for (let v = r[2] + 1; v < r[3]; v++) { P(r[0], wy, v, winN, { facing: 1 }); P(r[1], wy, v, winN, { facing: 1 }); }
      // top: roof slab, railing, garden
      if (k === floors - 1) {
        for (let u = r[0]; u <= r[1]; u++) for (let v = r[2]; v <= r[3]; v++) {
          P(u, top, v, onEdge(r, u, v) ? band : S.floor);
          P(u, top + 1, v, onEdge(r, u, v) ? S.fence : null);
        }
        const cu = (r[0] + r[1]) >> 1, cv = (r[2] + r[3]) >> 1;
        if (r[1] - r[0] >= 4 && r[3] - r[2] >= 4) { for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) P(cu + a - 1, top + 1, cv + b - 1, 'vx_dome_white'); info.roofTop = top + 2; }
        else { P(cu, top + 1, cv, 'vx_dome_glass'); info.roofTop = top + 2; }
        for (const [u, v] of [[r[0] + 1, r[2] + 1], [r[1] - 1, r[2] + 1], [r[0] + 1, r[3] - 1], [r[1] - 1, r[3] - 1]]) if (rng.chance(0.75)) P(u, top + 1, v, rng.chance(0.5) ? 'vx_bush' : 'vx_tech_planter');
      }
    }
    // ---- door & step
    P(du, F + 1, 0, 'birch_door', { facing: 2, half: 0, hinge: 0, open: 0 });
    P(du, F + 2, 0, 'birch_door', { facing: 2, half: 1, hinge: 0, open: 0 });
    info.door = [du, F + 1, 0]; info.outside = [du, F + 1, -1]; info.inside = [du, F + 1, 1];
    const gyD = o.ground(du, -1);
    for (let y = gyD + 1; y <= F; y++) P(du, y, -1, y === F ? S.floor : S.base);
    P(du, F + 1, -1, null); P(du, F + 2, -1, null);
    for (const u of [du - 2, du + 2]) if (u >= 0 && u < w) P(u, F + 1, -1, rng.chance(0.5) ? 'vx_fern_lush' : 'vx_tech_planter');
    // ---- interior: ladder up the back corner through every floor, beds on the top floor, living room below
    const lu = w - 2, lv = d - 2, topR = rects[floors - 1];
    const ladU = Math.min(lu, topR[1] - 1), ladV = Math.min(lv, topR[3] - 1);
    for (let y = F + 1; y <= F + (floors - 1) * 4; y++) P(ladU, y, ladV, 'ladder', { facing: 0 });
    const used = new Set([du + ',' + 1, ladU + ',' + ladV]);
    const take = (u, v) => { const k = u + ',' + v; if (used.has(k)) return false; used.add(k); return true; };
    const by = F + (floors - 1) * 4 + 1;
    const nb = Math.min(o.beds || 2, topR[1] - topR[0] - 1);
    let placed = 0;
    for (let u = topR[0] + 1; u < topR[1] && placed < nb; u++) {
      if (u === ladU) continue;
      const col = ['vx_bed_red', 'vx_bed_blue', 'vx_bed_green', 'vx_bed_yellow', 'vx_bed_purple', 'vx_bed_pink', 'vx_bed_teal', 'vx_bed_white'][(o.seed + (placed >> 1)) % 8];
      P(u, by, topR[3] - 2, col, { facing: 2, part: 0 }); P(u, by, topR[3] - 1, col, { facing: 2, part: 1 });
      info.beds.push([u, by, topR[3] - 2, 2]);
      placed++;
    }
    P(topR[0] + 1, by, topR[2] + 1, 'vx_locker', { facing: 1 }); P(topR[1] - 1, by + 2, topR[2] + 1, S.light);
    // ground floor: kitchen at the back, table & stools in the middle, sofa by the window
    const Yg = F + 1;
    P(w - 2, Yg, d - 3, 'vx_stove', { facing: 3 }); info.work.push(['stove', w - 3, Yg, d - 3]); take(w - 2, d - 3);
    if (w >= 7) { P(w - 2, Yg, d - 4, 'vx_counter', { facing: 3 }); take(w - 2, d - 4); }
    const tu = Math.max(2, du - 1), tv = Math.max(2, (d >> 1));
    if (take(tu, tv)) {
      P(tu, Yg, tv, 'vx_table'); info.table = [tu, Yg, tv];
      for (const [cu, cv, f] of [[tu - 1, tv, 1], [tu + 1, tv, 3], [tu, tv - 1, 2], [tu, tv + 1, 0]]) { if (cu < 1 || cu > w - 2 || cv < 1 || cv > d - 2 || !take(cu, cv)) continue; P(cu, Yg, cv, 'vx_stool'); info.seats.push([cu, Yg, cv, f]); }
    }
    if (take(1, 2)) { P(1, Yg, 2, 'vx_sofa_white', { facing: 1 }); info.seats.push([1, Yg, 2, 1]); }
    if (take(1, d - 2)) P(1, Yg, d - 2, 'vx_tech_planter');
    P(du, F + 3, 2, S.light); info.lights.push([du, F + 3, 2]);
    for (let k = 1; k < floors - 1; k++) { const r = rects[k]; P((r[0] + r[1]) >> 1, F + k * 4 + 3, (r[2] + r[3]) >> 1, S.light); P(r[0] + 1, F + k * 4 + 1, r[3] - 1, 'vx_tech_desk', { facing: 2 }); P(r[1] - 1, F + k * 4 + 1, r[2] + 1, 'vx_sofa_blue', { facing: 0 }); }
    info.solar = false;
    return info;
  };
})(VR);

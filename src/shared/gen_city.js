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

  // ============================================================================
  // Nova Haven at vgen 8 (TRAILER.md shot F, frames t1_21 · t1_22 · t1_24 · t2_23 · t2_25 · t3_05 · t3_06; plan
  // docs/superpowers/plans/2026-10-08-t-city2.md): the home city as the trailer's opening street, planned as a
  // composition instead of a radial village. From the hex corridor's city end (gen_temple.js, z −49) the arrival plaza
  // opens onto the avenue, which winds north in S-bends to the foot of the terraced hills (gen_hills.js), and onto two
  // crescents that swing out to the west and the east and curl back north. Every road is 7 wide and
  // light grey with a cyan light line on both kerbs, a raised grey kerb and a planted verge (palms every 6–9 blocks,
  // lamps with cyan heads, flower beds, clipped balls); Villa Nova lots (gen_nova.js, the family, mirrored or not)
  // line every road, each with a path from the kerb to its garden: cyan lines on both edges joined to the kerb line,
  // an amber line across the mouth. The plan record is the villages' (homes, work, plaza, lamps, roads, chunks …), so
  // villagers, the far world and the spawn read it as before; plan.nova carries the design (roads with their kerbs and
  // palms, lots) for test/trailer_city.js. Called by planSteps for a home city of a vgen-8 world (a generator: it
  // yields between its phases, the worker runs it in slices).
  // ============================================================================
  const NH = VG.NOVA_HAVEN = {
    PLAZA: { x: 0.5, z: -49.5, r: 10.5 },                                  // the arrival plaza at the corridor's city end (z ≤ −50)
    // the roads' centre lines (control points of Catmull-Rom curves), in the order their lots are laid out: the crescent
    // (an arc of radius 211 whose apex touches the plaza: the road that sweeps across the view from the corridor), Palm
    // Row (the same arc 90 blocks north: the villas of both stand back to back), the avenue (a gentle S from the plaza
    // across both to the hills)
    ROADS: [
      { name: 'crescent', arc: { x: 0.5, z: -64, R: 211, x0: -112, x1: 113 } },
      { name: 'palmrow', arc: { x: 0.5, z: -154, R: 211, x0: -84, x1: 85 } },
      { name: 'avenue', ctrl: [[0.5, -59], [3.5, -80], [-2, -102], [3.5, -124], [-1, -146], [2, -163]] },
    ],
    // which sides of a road take lots (1: the left of its way, −1: the right): the crescent's north side and its far ends'
    // south side, Palm Row's south side (and its north side where the land is level), the avenue's both sides
    SIDES: { crescent: [-1, 1], palmrow: [1, -1], avenue: [1, -1] },
    HW: 3.5, Y: 80,                                                         // the roads' half width; the city's level (the corridor floor)
    // the frames' houses at the corridor's end (the lot nearest each point): t1_22's long villa with the big tree, t2_23's
    // corner villa, t1_24's tower house, t2_25's glass-fronted bungalow
    PICK: [['long', false, [-17, -87]], ['corner', false, [20, -87]], ['tower', false, [-45, -88]], ['bungalow', true, [47, -88]]],
  };
  const PATH_STARTS = new Map();   // composition (+ m for the mirror) → where its garden path meets the street row
  VG.novaHaven = function* (g, site) {
    const R = VR.R, st = VG.st, PLAN = VG.plan2, HEART = VR.Heart, AIR = 0;
    const rng = new VR.RNG((site.seed ^ 0x6e6f7661) >>> 0);
    const cx = site.x, cz = site.z, RAD = VG.siteRad(g, site), Y0 = NH.Y, HW = NH.HW;
    const SZ = RAD * 2 + 1;
    // the cells of the city: 0 lawn · 1 road · 2 plaza · 3 lot · 4 a lot's margin · 5 path · 6 a palm or lamp · 7 the temple · 8 kerb
    const occ = new Uint8Array(SZ * SZ);
    const oi = (x, z) => { const lx = x - cx + RAD, lz = z - cz + RAD; return (lx < 0 || lz < 0 || lx >= SZ || lz >= SZ) ? -1 : lz * SZ + lx; };
    const oc = (x, z) => { const o = oi(x, z); return o < 0 ? 7 : occ[o]; };
    const setO = (x, z, v) => { const o = oi(x, z); if (o >= 0) occ[o] = v; };
    const chunks = new Map();
    const bucket = (x, z) => { const k = (x >> 4) + ',' + (z >> 4); let b = chunks.get(k); if (!b) { b = { f: [], o: [] }; chunks.set(k, b); } return b; };
    const put = (x, y, z, s) => { bucket(x, z).o.push(x, y, z, s); };
    const fill = (x, z, y0, y1, s) => { if (y1 >= y0) bucket(x, z).f.push(x, z, y0, y1, s); };
    const hc = new Map();
    const ground = (x, z) => { const k = x * 65536 + z; let h = hc.get(k); if (h === undefined) { h = g.surfaceY(x, z); hc.set(k, h); } return h; };
    const K = { PAVE: st('vx_floor_plaza'), LINE: st('vx_floor_plaza_line'), AMBER: st('vx_floor_plaza_line_amber'), KERB: st('vollton_mid_grey_slab', { type: 'bottom' }), GRASS: st('grass_block'), DIRT: st('dirt'),
      LAMP0: st('vx_lamppost_tech', { head: 0 }), LAMP1: st('vx_lamppost_tech', { head: 1 }), HEDGE: st('vx_hedge'), BALL: st('vx_bush_light'), PLANTER: st('vx_tech_planter'), HOLO: st('vx_holo_table'), BENCH: (f) => st('vx_bench', { facing: f }), BELL: st('bell', { facing: 0 }) };
    const plan = { rad: RAD, id: site.id, name: site.name, style: site.style, x: cx, z: cz, y: Y0 + 1, seed: site.seed, homes: [], work: [], farms: [], lots: [], lamps: [], chimneys: [], plaza: null, roads: [], bell: null, pad: null, shops: [], pastures: [], orchards: [], windmills: [], base: null };
    const nova = plan.nova = { roads: [], lots: [], plaza: null };
    // ---- the temple and its corridor: the temple's own (z > −50); the corridor's floor counts as paving for the lines
    const TB = VR.TempleGen && VR.TempleGen.box;
    if (TB) for (let x = TB.x0 - 2; x <= TB.x1 + 2; x++) for (let z = -49; z <= TB.z1 + 2; z++) setO(x, z, 7);
    const corridor = (x, z) => z >= -49 && z <= -41 && x >= -3 && x <= 3;
    yield;

    // ---------------------------------------------------------------- the roads: centre lines sampled every block
    const resample = (dense, closed) => {
      const out = []; let acc = 0, next = 0;
      for (let i = 1; i < dense.length; i++) {
        const [x0, z0] = dense[i - 1], [x1, z1] = dense[i], d = Math.hypot(x1 - x0, z1 - z0);
        while (next <= acc + d) { const t = d > 0 ? (next - acc) / d : 0; out.push([x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, Math.atan2(z1 - z0, x1 - x0)]); next += 1; }
        acc += d;
      }
      void closed;
      return out;
    };
    const catmull = (ctrl) => {
      const dense = [], n = ctrl.length;
      for (let i = 0; i < n - 1; i++) {
        const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(n - 1, i + 2)];
        for (let k = 0; k < 40; k++) {
          const t = k / 40, t2 = t * t, t3 = t2 * t;
          const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
          dense.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
        }
      }
      dense.push(ctrl[n - 1].slice());
      return resample(dense, false);
    };
    const ellipse = (E) => { const dense = []; for (let k = 0; k <= 720; k++) { const a = Math.PI / 2 + k / 720 * Math.PI * 2; dense.push([E.x + Math.cos(a) * E.a, E.z + Math.sin(a) * E.b]); } return resample(dense, true); };
    // an arc bowing south (toward +z) with its apex at (x, z): the circle's centre lies R north of the apex
    const arc = (A) => { const dense = [], f0 = Math.asin((A.x0 - A.x) / A.R), f1 = Math.asin((A.x1 - A.x) / A.R); for (let k = 0; k <= 400; k++) { const f = f0 + (f1 - f0) * k / 400; dense.push([A.x + A.R * Math.sin(f), A.z - A.R + A.R * Math.cos(f)]); } return resample(dense, false); };
    const roads = NH.ROADS.map(R0 => ({ name: R0.name, pts: R0.arc ? arc(R0.arc) : catmull(R0.ctrl) }));
    const R0of = (rd) => NH.ROADS.find(q => q.name === rd.name);
    for (const rd of roads) { const A = R0of(rd).arc; if (A) { let best = 0; rd.pts.forEach((p, k) => { if (Math.abs(p[0] - A.x) < Math.abs(rd.pts[best][0] - A.x)) best = k; }); rd.apex = best; } }
    void ellipse;
    // the road surface: the city's level, rising with the ground toward the hills (smoothed, one block in four at most)
    for (const rd of roads) {
      const hs = rd.pts.map(p => Math.max(Y0, ground(Math.floor(p[0]), Math.floor(p[1]))));
      const sm = hs.map((h, k) => { let s2 = 0, n2 = 0; for (let q = -8; q <= 8; q++) { const v = hs[k + q]; if (v !== undefined) { s2 += v; n2++; } } return Math.max(Y0, Math.round(s2 / n2)); });
      for (let it = 0; it < 2; it++) for (let k = 1; k < sm.length; k++) if (sm[k] > sm[k - 1] + 1) sm[k] = sm[k - 1] + 1;
      rd.ys = sm;
    }
    // the raster: every cell within HW of a centre line is road; the cell remembers its road, side and place on it
    const cellRoad = new Map();   // "x,z" → [road index, w (signed offset), s (sample), y]
    roads.forEach((rd, ri) => {
      const P = rd.pts;
      for (let k = 0; k < P.length; k++) {
        const [px, pz, a] = P[k], nx = -Math.sin(a), nz = Math.cos(a);
        for (let t = 0; t < 1; t += 0.25) {
          const q = P[Math.min(P.length - 1, k + 1)], x0 = px + (q[0] - px) * t, z0 = pz + (q[1] - pz) * t;
          for (let w = -HW + 0.05; w <= HW - 0.05; w += 0.3) {
            const x = Math.floor(x0 + nx * w), z = Math.floor(z0 + nz * w), key = x + ',' + z, o = oc(x, z);
            if (o === 7) continue;
            const old = cellRoad.get(key);
            if (!old || Math.abs(w) < Math.abs(old[1])) cellRoad.set(key, [ri, w, k, rd.ys[k]]);
          }
        }
      }
    });
    for (const key of cellRoad.keys()) { const [x, z] = key.split(',').map(Number); setO(x, z, 1); }
    // the plaza: a half disc at the corridor's end
    const PZ = NH.PLAZA, plazaCells = [];
    for (let z = -50; z >= Math.floor(PZ.z - PZ.r); z--) for (let x = Math.floor(PZ.x - PZ.r); x <= Math.ceil(PZ.x + PZ.r); x++) {
      if (Math.hypot(x + 0.5 - PZ.x, z + 0.5 - PZ.z) > PZ.r || oc(x, z) === 7) continue;
      plazaCells.push([x, z]); setO(x, z, 2);
    }
    const yAt = (x, z) => { const c = cellRoad.get(x + ',' + z); return c ? c[3] : Y0; };
    yield;

    // ---------------------------------------------------------------- the lots: Villa Nova lots along every road
    const LW = PLAN.NOVA.LOT[0], LD = PLAN.NOVA.LOT[1];
    const A2R = (ax, az) => (az > 0.5 ? 0 : ax < -0.5 ? 1 : az < -0.5 ? 2 : 3);   // the rotation whose v axis (into the lot) is (ax, az)
    const lots = [];
    // a lot fits when its cells and a one-block margin are lawn, and three rows in front of it hold no road (the verge)
    const why = NH.dbg ? (w) => { NH.dbg[w] = (NH.dbg[w] || 0) + 1; return false; } : () => false;
    const fits = (ox, oz, r) => {
      // the cells first (cheap), the ground only for a lot whose cells are free
      for (let v = -3; v <= LD; v++) for (let u = -1; u <= LW; u++) {
        const q = VG.rot(r, u, v), x = ox + q[0], z = oz + q[1], o = oc(x, z);
        if (v < 0) { if (o === 1 || o === 2 || o === 3 || o === 7) return why('front' + o); continue; }
        if (o !== 0 && o !== 4) return why('cell' + o);
        if (u >= 0 && u < LW && o === 4) return why('margin');
      }
      for (const [u, v] of [[-1, -3], [LW, -3], [-1, LD], [LW, LD]]) { const q = VG.rot(r, u, v); if (Math.hypot(ox + q[0] - cx, oz + q[1] - cz) > RAD - 3) return why('radius'); }
      for (let v = 0; v < LD; v += 2) for (let u = 0; u < LW; u += 2) { const q = VG.rot(r, u, v); if (ground(ox + q[0], oz + q[1]) > Y0 + 1) return why('steep'); }   // the city's lots stand on the level land; the hill is the terraces'
      return true;
    };
    const claim = (lot) => {
      for (let v = -1; v <= LD; v++) for (let u = -1; u <= LW; u++) {
        const q = VG.rot(lot.r, u, v), x = lot.ox + q[0], z = lot.oz + q[1];
        const inner = u >= 0 && u < LW && v >= 0 && v < LD;
        if (inner) setO(x, z, 3); else if (oc(x, z) === 0) setO(x, z, 4);
      }
    };
    for (let ri = 0; ri < roads.length; ri++) {
      const rd = roads[ri], P = rd.pts;
      for (const side of (NH.SIDES[rd.name] || [1, -1])) {
        // (an arc is walked from its apex out to both ends, so the first lots on either side hug the avenue)
        const ks = [];
        if (R0of(rd).arc) { const mid = rd.apex; for (let k = mid; k < P.length - 6; k += 3) ks.push(k); for (let k = mid - 3; k >= 6; k -= 3) ks.push(k); }
        else for (let k = 6; k < P.length - 6; k += 3) ks.push(k);
        let nk = 0;
        for (const k of ks) {
          if ((++nk & 1) === 0) yield;   // (two positions a slice: each tries up to 180 lots)
          const [px, pz, a] = P[k], nx = -Math.sin(a) * side, nz = Math.cos(a) * side;
          // the axis nearest the outward normal (and the other one where the road runs diagonally); the lot's front
          // centre moves out along it, and slides along the road, until the lot fits — the nearest fit wins
          const axes = [];
          const ax = Math.abs(nx) >= Math.abs(nz) ? Math.sign(nx) : 0, az = ax ? 0 : Math.sign(nz); axes.push([ax, az]);
          if (Math.abs(Math.abs(nx) - Math.abs(nz)) < 0.35) axes.push(ax ? [0, Math.sign(nz)] : [Math.sign(nx), 0]);
          let placed = null;
          for (let t = HW + 3; t <= HW + 13 && !placed; t++) for (const [bx, bz] of axes) for (const sh of [0, -3, 3, -6, 6, -9, 9, -12, 12]) {
            if (placed) break;
            const r = A2R(bx, bz), fx = Math.round(px + bx * t + bz * sh), fz = Math.round(pz + bz * t - bx * sh), q = VG.rot(r, LW >> 1, 0), ox = fx - q[0], oz = fz - q[1];
            if (fits(ox, oz, r)) placed = { r, ox, oz, road: ri, k, side };
          }
          if (placed) { claim(placed); lots.push(placed); }
        }
      }
      yield;
    }
    // the compositions: the frames' houses at their spots (the long villa, the corner villa, the tower house …), the
    // others from the family by the seed, never the same composition twice in a row along a road, half of them mirrored
    const FAMILY = ['classic', 'long', 'tower', 'corner', 'bungalow'];
    const centreOf = (l) => { const q = VG.rot(l.r, LW >> 1, LD >> 1); return [l.ox + q[0], l.oz + q[1]]; };
    for (const [comp, mirror, at] of NH.PICK) {
      let best = null, bd = 1e9;
      for (const l of lots) { if (l.comp) continue; const c = centreOf(l), d = Math.hypot(c[0] - at[0], c[1] - at[1]); if (d < bd) { bd = d; best = l; } }
      if (best && bd < 30) { best.comp = comp; best.mirror = mirror; }
    }
    let last = null;
    for (const l of lots) {
      if (!l.comp) { let c = FAMILY[rng.int(FAMILY.length)]; if (c === last) c = FAMILY[(FAMILY.indexOf(c) + 1 + rng.int(FAMILY.length - 1)) % FAMILY.length]; l.comp = c; l.mirror = rng.chance(0.5); }
      last = l.comp;
    }
    yield;

    // ---------------------------------------------------------------- the paths from the kerb to every lot
    // the lot's path meets the street row at u0…u1 (the house's info.pathStart, known per composition and mirror):
    // straight out along −v until the road; the edge columns are light lines, the last row an amber threshold
    // (each composition's path start is read once from a build of it, kept for every later plan: one build a slice)
    const psKey = (l) => l.comp + (l.mirror ? 'm' : '') + (l.pathU || '');
    for (const l of lots) {
      const key = psKey(l); if (PATH_STARTS.has(key)) continue;
      const L0 = VG.makeLot(() => {}, 0, 0, 0);
      const info = PLAN.build(L0, { w: LW, d: LD, F: 64, r: 0, ox: 0, oz: 0, kind: 'home' }, { index: PLAN.TRAILER, comp: l.comp, novaMirror: !!l.mirror, rng: new VR.RNG(1), ground: () => 63, beds: 3, noCustom: true, pathU: l.pathU });
      PATH_STARTS.set(key, { start: info.pathStart.slice(), door: info.door.slice(), entryV: info.entryV });
      yield;
    }
    const pathCells = new Map();   // "x,z" → 'line' | 'amber' | 'pave'
    for (const l of lots) {
      const ps = PATH_STARTS.get(psKey(l)), [u0, u1] = ps.start;
      l.pathStart = ps.start; l.mouth = []; l.connector = [];
      const cols = [];
      for (let u = u0; u <= u1; u++) {
        const col = [];
        for (let v = -1; v >= -16; v--) {
          const q = VG.rot(l.r, u, v), x = l.ox + q[0], z = l.oz + q[1], o = oc(x, z);
          if (o === 1 || o === 2) break;
          if (o === 3 || o === 7) { col.length = 0; break; }
          col.push([x, z]);
        }
        cols.push(col);
      }
      cols.forEach((col, i) => {
        const edge = i === 0 || i === cols.length - 1;
        col.forEach(([x, z], j) => {
          const kind = edge ? 'line' : j === col.length - 1 ? 'amber' : 'pave';
          pathCells.set(x + ',' + z, kind); setO(x, z, 5); l.connector.push([x, z]);
          if (kind === 'amber') l.mouth.push([x, z]);
        });
      });
    }
    yield;

    // ---------------------------------------------------------------- the light lines and the kerbs
    const paved = (x, z) => { const o = oc(x, z); return o === 1 || o === 2 || corridor(x, z); };
    const lineSet = new Set();
    const roadLike = [...cellRoad.keys()].map(k => k.split(',').map(Number)).concat(plazaCells);
    for (const [x, z] of roadLike) if (!paved(x + 1, z) || !paved(x - 1, z) || !paved(x, z + 1) || !paved(x, z - 1)) lineSet.add(x + ',' + z);
    // a diagonal step of the kerb is joined through the paved cell in its corner (the line piece joins across sides)
    for (let pass = 0; pass < 3; pass++) {
      let added = 0;
      for (const k of [...lineSet]) {
        const [x, z] = k.split(',').map(Number);
        for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
          if (!lineSet.has((x + dx) + ',' + (z + dz)) || lineSet.has((x + dx) + ',' + z) || lineSet.has(x + ',' + (z + dz))) continue;
          const c = paved(x + dx, z) ? (x + dx) + ',' + z : paved(x, z + dz) ? x + ',' + (z + dz) : null;
          if (c) { lineSet.add(c); added++; }
        }
      }
      if (!added) break;
    }
    // the kerb: the lawn cells beside a lit road cell (a raised half block of grey); paths cross it flush
    const kerbSet = new Set();
    for (const k of lineSet) { const [x, z] = k.split(',').map(Number); for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = x + dx, b = z + dz; if (oc(a, b) === 0 || oc(a, b) === 4) kerbSet.add(a + ',' + b); } }
    for (const k of kerbSet) { const [x, z] = k.split(',').map(Number); setO(x, z, 8); }
    // each road's kerbs, side by side and in order (test/trailer_city.js walks them)
    roads.forEach((rd, ri) => { rd.kerb = { L: [], R: [] }; });
    for (const [key, [ri, w, s]] of cellRoad) if (lineSet.has(key) && Math.abs(w) > HW - 1.6) { const [x, z] = key.split(',').map(Number); roads[ri].kerb[w > 0 ? 'L' : 'R'].push([x, z, s]); }
    for (const rd of roads) for (const sd of ['L', 'R']) rd.kerb[sd].sort((a, b) => a[2] - b[2]);
    yield;

    // ---------------------------------------------------------------- palms and lamps along the roads
    const free = (x, z) => oc(x, z) === 0;
    const palmAt = new Set();
    for (const rd of roads) {
      rd.palms = { L: [], R: [] };
      const P = rd.pts;
      for (const [sd, sign] of [['L', 1], ['R', -1]]) {
        let run = [], kNext = 3 + rng.int(4);
        while (kNext < P.length - 2) {
          let done = false;
          for (let k = kNext; k <= Math.min(P.length - 1, kNext + 3) && !done; k++) {
            const [px, pz, a] = P[k], nx = -Math.sin(a) * sign, nz = Math.cos(a) * sign;
            const x = Math.floor(px + nx * (HW + 2.5)), z = Math.floor(pz + nz * (HW + 2.5));
            let ok = free(x, z);
            for (let dx = -1; dx <= 1 && ok; dx++) for (let dz = -1; dz <= 1; dz++) { const o = oc(x + dx, z + dz); if (o === 5 || o === 6 || o === 2) { ok = false; break; } }
            if (!ok) continue;
            const y = yAt(Math.floor(px), Math.floor(pz)), h = 8 + rng.int(5);
            setO(x, z, 6); palmAt.add(x + ',' + z);
            run.push([x, z, k, y + 1, h]);
            kNext = k + 6 + rng.int(4); done = true;
          }
          if (!done) { if (run.length) rd.palms[sd].push(run); run = []; kNext += 4; }
        }
        if (run.length) rd.palms[sd].push(run);
      }
      // lamps: every 12 blocks, sides alternating, standing in the kerb
      let n = 0;
      for (let k = 6; k < P.length - 4; k += 12) {
        const sign = (n++ & 1) ? 1 : -1, [px, pz, a] = P[k], nx = -Math.sin(a) * sign, nz = Math.cos(a) * sign;
        for (let d = HW; d <= HW + 2; d += 0.5) {
          const x = Math.floor(px + nx * d), z = Math.floor(pz + nz * d);
          if (kerbSet.has(x + ',' + z) && oc(x, z) === 8) { setO(x, z, 6); kerbSet.delete(x + ',' + z); const y = yAt(Math.floor(px), Math.floor(pz)); put(x, y + 1, z, K.LAMP0); put(x, y + 2, z, K.LAMP1); fill(x, z, y + 3, y + 6, AIR); plan.lamps.push([x, y + 2, z]); break; }
        }
      }
    }
    yield;

    // ---------------------------------------------------------------- the ground of the city and its paving
    // every cell of the city's disc (not the lots: they lay their own) is levelled to the city's level or kept higher
    // where the hill rises; roads, plaza and paths are paved, the kerbs set, the verges planted
    const levelOf = (x, z) => { const c = cellRoad.get(x + ',' + z); if (c) return c[3]; let best = null; for (let d = 1; d <= 6 && best === null; d++) for (const [dx, dz] of [[d, 0], [-d, 0], [0, d], [0, -d]]) { const cc = cellRoad.get((x + dx) + ',' + (z + dz)); if (cc) { best = cc[3]; break; } } return best === null ? Y0 : best; };
    let nCol = 0;
    for (let z = cz - RAD; z <= cz + RAD; z++) {
      if ((++nCol & 15) === 0) yield;
      for (let x = cx - RAD; x <= cx + RAD; x++) {
        const o = oc(x, z); if (o === 7 || o === 3) continue;
        if (Math.hypot(x - cx, z - cz) > RAD - 2) continue;
        const key = x + ',' + z, gy = ground(x, z);
        const isRoad = o === 1 || o === 2, isPath = o === 5, isKerb = o === 8 || kerbSet.has(key);
        const y = (isRoad || isPath || isKerb || o === 6 || o === 4) ? levelOf(x, z) : Math.max(Y0, gy);
        if (!isRoad && !isPath && !isKerb && o !== 6 && o !== 4 && gy >= Y0 + 2) continue;   // the hill: kept as it is
        if (gy < y) fill(x, z, gy + 1, y - 1, K.DIRT);
        fill(x, z, y + 1, Math.max(y + 6, gy + 2), AIR);
        if (isRoad) { put(x, y, z, lineSet.has(key) ? K.LINE : K.PAVE); continue; }
        if (isPath) { const kd = pathCells.get(key); put(x, y, z, kd === 'line' ? K.LINE : kd === 'amber' ? K.AMBER : K.PAVE); continue; }
        put(x, y, z, K.GRASS);
        if (isKerb && o === 8) put(x, y + 1, z, K.KERB);
      }
    }
    // the palms in the verges (the shared crown on a ringed trunk)
    for (const rd of roads) for (const sd of ['L', 'R']) for (const run of rd.palms[sd]) for (const [x, z, , y, h] of run) if (VR.Plants && VR.Plants.palm) VR.Plants.palm(put, x, y, z, h);
    // the verges: flower clusters along the kerb, clipped balls and blossom bushes every few blocks, tufts in the lawn
    const hsh = (x, z, s) => (Math.imul(x * 73856093 ^ z * 19349663, 0x9E3779B1) ^ s) >>> 0;
    const fcl = VR.R.byName.vm_flower_cluster ? st('vm_flower_cluster', { part: 'p000', facing: 0 }) : 0, tuft = VR.R.byName.vm_tuft_grass ? st('vm_tuft_grass', { part: 'p000', facing: 0 }) : 0, blossom = VR.R.byName.vm_bush_blossom ? st('vm_bush_blossom', { part: 'p000', facing: 0 }) : 0;
    for (let z = cz - RAD; z <= cz + RAD; z++) for (let x = cx - RAD; x <= cx + RAD; x++) {
      if (x === cx - RAD && ((z - cz) & 15) === 0) yield;
      if (oc(x, z) !== 0 || ground(x, z) >= Y0 + 2 || Math.hypot(x - cx, z - cz) > RAD - 3) continue;
      const y = Math.max(Y0, ground(x, z)) + 1;
      let byKerb = false, near = 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const o = oc(x + dx, z + dz); if (o === 8) byKerb = true; }
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) if (oc(x + dx, z + dz) === 8) near++;
      const h = hsh(x, z, site.seed) % 100;
      if (byKerb) { if (h < 34 && fcl) put(x, y, z, fcl); else if (h < 40) put(x, y, z, K.BALL); }
      else if (near && h < 7) put(x, y, z, h < 3 ? K.BALL : blossom || K.BALL);
      else if (!near && h < 3 && tuft) put(x, y, z, tuft);
    }
    yield;

    // ---------------------------------------------------------------- the plaza: paving, its cyan ring, the holo table
    // (the corridor's axis stays clear — the view from the corridor runs up the avenue between the villas; the holo
    //  table with its ring and benches stands on the east side, two palms in planters on the west)
    const PCX = -1, PCZ = -55, HX = 6, HZ = -54;
    for (const [x, z] of plazaCells) {
      const key = x + ',' + z, d = Math.hypot(x - HX, z - HZ);
      const ring = Math.abs(d - 2.6) < 0.55;
      const gy = ground(x, z);
      if (gy < Y0) fill(x, z, gy + 1, Y0 - 1, K.DIRT);
      fill(x, z, Y0 + 1, Math.max(Y0 + 8, gy + 2), AIR);
      put(x, Y0, z, lineSet.has(key) || ring ? K.LINE : K.PAVE);
    }
    put(HX, Y0 + 1, HZ, K.HOLO);
    const seats = [];
    for (const [dx, dz, f] of [[-2, 0, 1], [2, 0, 3], [0, -2, 2]]) { put(HX + dx, Y0 + 1, HZ + dz, K.BENCH(f)); seats.push([HX + dx, Y0 + 1, HZ + dz, f]); }
    for (const [x, z] of [[-7, -51], [-5, -57]]) { put(x, Y0 + 1, z, K.PLANTER); if (VR.Plants) VR.Plants.palm(put, x, Y0 + 2, z, 9); }
    for (const [x, z] of [[-9, -51], [9, -51]]) { put(x, Y0 + 1, z, K.LAMP0); put(x, Y0 + 2, z, K.LAMP1); plan.lamps.push([x, Y0 + 2, z]); }
    put(-3, Y0 + 1, -51, K.BELL); plan.bell = [-3, Y0 + 1, -51];
    plan.plaza = { x: PCX, y: Y0 + 1, z: PCZ, r: 4, seats, stalls: [] };
    nova.plaza = { x: PZ.x, z: PZ.z, r: PZ.r, y: Y0 };
    yield;

    // ---------------------------------------------------------------- the villas
    const recordInfo = (lot, info, F) => {
      const W = (p) => { if (!p) return null; const q = VG.rot(lot.r, p[0], p[2]); return [lot.ox + q[0], p[1], lot.oz + q[1]]; };
      const WF = (p) => { const w3 = W(p); w3.push((p[3] + lot.r) & 3); return w3; };
      return {
        kind: 'home', door: W(info.door), outside: W(info.outside), inside: W(info.inside), beds: info.beds.map(WF), seats: info.seats.map(WF),
        work: info.work.map(wk => [wk[0]].concat(W([wk[1], wk[2], wk[3]]))), chimney: null, table: W(info.table), lights: info.lights.map(W),
        box: (() => { const a = W([-1, F, -1]), b = W([LW, F, LD]); return [Math.min(a[0], b[0]), F, Math.min(a[2], b[2]), Math.max(a[0], b[0]), (info.roofTop || F + 5) + 1, Math.max(a[2], b[2])]; })(),
        F, r: lot.r, w: LW, d: LD, ox: lot.ox, oz: lot.oz, skin: 'nova', comp: lot.comp, mirror: !!lot.mirror,
      };
    };
    let homeSeed = site.seed;
    for (const lot of lots) {
      yield;
      const q = VG.rot(lot.r, LW >> 1, -1), F = levelOf(lot.ox + q[0], lot.oz + q[1]) + 1;
      // the lot's first clearing of a cell (air before anything else there) becomes one fill per column: the same
      // blocks, a twentieth of the ops
      const written = new Set(), clears = new Map(), lineAt = new Map();
      const lput = (x, y, z, s) => {
        const ck = (x + 4096) * 8192 + (z + 4096), k = ck * 256 + y;   // (numbers, not strings: a lot writes 30 000 cells)
        if (!s && !written.has(k)) { const c = clears.get(ck); if (!c) clears.set(ck, [y, y, x, z]); else { if (y < c[0]) c[0] = y; if (y > c[1]) c[1] = y; } return; }
        written.add(k); put(x, y, z, s);
        if (y === F - 1) lineAt.set(x + ',' + z, s === K.LINE);
      };
      const L = VG.makeLot(lput, lot.ox, lot.oz, lot.r);
      const lg = (u, v) => { const qq = VG.rot(lot.r, u, v); return ground(lot.ox + qq[0], lot.oz + qq[1]); };
      homeSeed = (homeSeed * 1103515245 + 12345) >>> 0;
      const info = yield* PLAN.buildSteps(L, { w: LW, d: LD, F, r: lot.r, ox: lot.ox, oz: lot.oz, kind: 'home' }, { index: PLAN.TRAILER, comp: lot.comp, novaMirror: !!lot.mirror, rng: new VR.RNG(homeSeed), ground: lg, beds: 3, noCustom: lot.comp !== 'classic', pathU: lot.pathU });
      for (const c of clears.values()) fill(c[2], c[3], c[0], c[1], AIR);
      if (!info) continue;
      const sm = recordInfo(lot, info, F);
      plan.homes.push(sm);
      for (const l of sm.lights) plan.lamps.push(l);
      // the line cells of the lot's own path round the apron in front of its door (the test follows the line to them)
      const ap = [];
      const dU = info.door[0], dV = info.entryV;
      for (let v = dV - 3; v <= dV - 1; v++) for (let u = dU - 4; u <= dU + 4; u++) { const qq = VG.rot(lot.r, u, v), key = (lot.ox + qq[0]) + ',' + (lot.oz + qq[1]); if (lineAt.get(key)) ap.push([lot.ox + qq[0], lot.oz + qq[1]]); }
      nova.lots.push({ comp: lot.comp, mirror: !!lot.mirror, hero: !!lot.hero, ox: lot.ox, oz: lot.oz, r: lot.r, F, door: sm.door, apron: ap, mouth: lot.mouth, connector: lot.connector });
    }
    // ---------------------------------------------------------------- the temple's hangar hall is the city's base
    const b = HEART.templeBase(g);
    plan.base = b; plan.pad = null;
    plan.work.push({ kind: 'base', door: b.back.slice(), outside: [b.back[0], b.back[1], b.back[2] - 2], inside: b.inside.slice(), beds: [], seats: [], work: b.work.map(w => w.slice()), chimney: null, table: null, lights: [], box: b.box.slice(), base: b });
    nova.roads = roads.map(rd => ({ name: rd.name, pts: rd.pts.map(p => [p[0], p[1]]), kerb: rd.kerb, palms: rd.palms }));
    // the city's cells, for the terraces behind it (gen_hills.js leaves every cell the city laid out as it is)
    nova.owns = (x, z) => { const o = oi(x, z); return o >= 0 && occ[o] !== 0; };
    plan.roads = roads.map(rd => rd.pts.filter((_, k) => k % 3 === 0).map((p, k) => [Math.floor(p[0]), rd.ys[k * 3] + 1, Math.floor(p[1])]));
    plan.palms = []; for (const rd of roads) for (const sd of ['L', 'R']) for (const run of rd.palms[sd]) for (const p of run) plan.palms.push(['street', rd.name, p[0], p[1], p[4]]);
    plan.crownDrops = [];
    plan.chunks = chunks;
    plan.center = [cx, Y0 + 1, cz];
    return plan;
  };
})(VR);

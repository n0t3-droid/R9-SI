// ============================================================================
// Weißstadt, the hall city (vgen 9; docs/superpowers/plans/2026-10-08-t-town.md): the new large settlement of the
// meadow and cherry climates. The owner's reference pictures (docs/refs/weissstadt — design references only, nothing
// copied, our own names) show a town street with shops, a fountain and cafés standing INSIDE a vast white vaulted hall;
// so this town is a hall of warm white stone, 97 × 161 blocks and 40 high, with the town inside it:
//  · the hall: a nave with two side aisles, round arches on piers (gold-trimmed), a clerestory with tall arched
//    stained-glass windows, a pointed vault with a glass band along its crown (the light engine's sky light falls
//    straight down through glass: the street is in daylight), aisle vaults with their own glass bands, tall stained
//    windows in the long walls and a giant one in the entrance end, a half-round apse with a half dome, the grand
//    staircase and a balustraded gallery, two gates in the long walls with a forecourt and a path out to the land;
//  · the town: a cobbled main street seven wide along the nave with paved fronts, a round plaza 25 across with a
//    three-tier fountain at the crossing (the cross street runs through the arcade to the two gates), café tables and
//    benches round it, twelve shop houses (two or three storeys of warm white stone, wood quoins, a gold band at every
//    storey, a storefront with striped awnings and a sign, arched stained windows, flower boxes, a balcony with a
//    balustrade, vines, a slate gable with timbering) on lots 12 × 18 with back yards, side and back lanes; in the
//    aisles two-storey loggia homes against the outer walls with balustraded galleries over the market walk, market
//    stalls at the piers, barrels and crates; street lamps every eight blocks, lanterns on the piers and under the
//    arches.
// No crystals anywhere (the owner): lanterns, gold, glass and light instead.
// The plan is built like Nova Haven's (gen_city.js): a generator that yields between its steps (VG.planAdvance runs it
// in slices in the worker, the plan cached per site), ops bucketed per chunk, the usual plan record for the game
// (homes with beds, workplaces, the plaza and its seats, lamps, strolling routes) plus the hall's frame (plan.hall) and
// the town's villager budget (plan.folkCap: one villager per 9 blocks of walkable street and plaza plus 2 per home).
// Frame: hall-local u across (|u| ≤ 48), v along the nave (−80 … 80; the plaza's centre (0, 0) is the site, the
// apse at +v); world = site + ROT[r](u, v) with r = (site.seed >>> 3) & 3. Heights are measured from the floor F.
// ============================================================================
(function (VR) {
  'use strict';
  const VG = VR.VillageGen;
  if (!VG) return;
  const M = VR.M, SEA = VR.C.SEA;
  const ROT = [(u, v) => [u, v], (u, v) => [-v, u], (u, v) => [-u, -v], (u, v) => [v, -u]];
  // ---------------------------------------------------------------- the measures (hall-local; heights above the floor)
  const H = VG.HALL = {
    HW: 48, V0: -80, V1: 51, VE: 54, AR: 27, AW: 30,           // the long walls' outer face; the entrance end; the apse's centre; the aisle end walls; the apse's inner and outer radius
    ST: 3, FR: 5, HS0: 6, HS1: 17, YD1: 21, BL0: 22, BL1: 26,  // street |u| ≤ 3, fronts 4–5, houses 6–17, yards 18–21, back lane 22–26
    P0: 27, P1: 29, A0: 30, STALL1: 31, WK0: 32, WK1: 38, LG0: 39, LG1: 45, W0: 46,   // piers / clerestory, the aisle: stalls 30–31, the walk 32–38, the loggia homes 39–45, the wall 46–48
    PR: 12, PV: 13,                                             // the plaza's radius; its clearing |v| ≤ 13
    ARC: 18, CLR: 22, SPR: 31, TOP: 40, AIS: 22, AISTOP: 26, WALLTOP: 23,
    GAL: 8, STAIR0: 42, GAL0: 50,                               // the gallery's height, the stair's first step (v), the gallery's front edge (v)
    GLASS: 22, AGL0: 32, AGL1: 41,                              // the vault's glass panels |u| ≤ 22 (the half dome's d ≤ 22), the aisle vaults' 32–41
    LOT: { w: 12, d: 18, house: 12 },                           // a shop house's lot: 12 along the street, 18 deep (front 2, house 12, yard 4)
    RAD: 112, VGEN: 9,
  };
  VG.hallOn = (g) => !!(g && g.vgen >= H.VGEN);
  VG.hallFrame = (site) => (site.seed >>> 3) & 3;
  // the nave vault's height at a distance a from the axis (and the half dome's at a distance a from the apse's centre)
  const hN = (a) => Math.round(H.SPR + (H.TOP - H.SPR) * Math.sqrt(Math.max(0, 1 - a / H.AR)));
  // the aisle vault's height at |u| = a
  const hA = (a) => Math.round(H.AIS + (H.AISTOP - H.AIS) * Math.sin(Math.PI * Math.max(0, Math.min(1, (a - 29.5) / 17))));
  H.hN = hN; H.hA = hA;
  // where a hall city fits: the footprint's land (sampled every 12 × 16 blocks) is mostly dry and a plinth or a cut can
  // level it (the site test of gen_village.js asks this for a meadow or cherry site at vgen 9)
  VG.hallFits = function (g, x, z, seed) {
    const r = (seed >>> 3) & 3;
    let wet = 0, n = 0, mn = 1e9, mx = -1e9;
    for (let u = -48; u <= 48; u += 12) for (let v = -80; v <= 80; v += 16) { const q = ROT[r](u, v), y = g.surfaceY(x + q[0], z + q[1]); n++; if (y <= SEA + 1) wet++; mn = Math.min(mn, y); mx = Math.max(mx, y); }
    return wet * 4 <= n && mx - mn <= 64;
  };
  // the code of a cell of the town (the plan's grid: what stands there; the walkable ones carry the villager budget)
  const C = VG.HALL_CODE = { OUT: 0, WALL: 1, STREET: 2, PLAZA: 3, LANE: 4, FRONT: 5, HOUSE: 6, YARD: 7, WALK: 8, STALL: 9, GALLERY: 10, FORE: 11, CROSS: 12, LOGGIA: 13, STAIR: 14, PIER: 15 };
  const WALKABLE = VG.HALL_WALKABLE = new Set([C.STREET, C.PLAZA, C.LANE, C.FRONT, C.WALK, C.GALLERY, C.FORE, C.CROSS, C.STAIR]);
  // the style record other code reads (a hall city's own rules live here; lots the builders grow on: none)
  if (VG.STYLES && !VG.STYLES.hall) VG.STYLES.hall = Object.assign({}, VG.STYLES.meadow, { walls: ['travertine', 'quartz_bricks'], roofs: ['slate'], floor: 'spruce_planks', base: 'smooth_quartz', windows: ['vm_town_window_blue'], wood: 'spruce', fence: 'vx_balustrade', lamp: 'vm_town_lamp', path: 'paver_grey', plaza: ['marble_white', 'travertine'], chimney: 'vx_chimney_stone', beam: 'vx_beam_dark', crops: false, flowers: true, hall: true, noChimney: true });

  // the prism villages of vgen 9 without crystals (the owner: no crystals anywhere): white hull and lavender plaster,
  // plain lamps and lanterns, no crystal fountain or crystal garden lamps
  if (VG.STYLES && VG.STYLES.prism && !VG.STYLES.prism_clear) VG.STYLES.prism_clear = Object.assign({}, VG.STYLES.prism, { walls: ['vx_hull_white', 'vx_plaster_lavender', 'vx_hull_white', 'vx_plaster_white'], lamp: 'vx_lamppost', crystals: false });
  // the aired-out villages' fountain (vgen 9, gen_village.js): a round basin with a stone rim and the town fountain's three tiers
  VG.townFountain = function (put, cx, py, cz, S) {
    const st = VG.st, rim = st(S && S.base === 'vx_sandstone' ? 'smooth_sandstone' : 'polished_andesite');
    for (let dz = -5; dz <= 5; dz++) for (let dx = -5; dx <= 5; dx++) {
      const d = Math.hypot(dx, dz); if (d > 4.6) continue;
      if (d > 3.6) { put(cx + dx, py + 1, cz + dz, rim); continue; }
      put(cx + dx, py + 1, cz + dz, st('water'));
    }
    const VM = VR.VM, m = VM && VM.MODELS.vm_town_fountain;
    if (m) for (const [dx, dy, dz, i] of VM.footprint(m, 0)) put(cx - 1 + dx, py + 1 + dy, cz - 1 + dz, st('vm_town_fountain', { facing: 0, part: i }));
  };

  VG.hallCity = function* (g, site) {
    const st = VG.st, AIR = 0, VM = VR.VM;
    const rng = new VR.RNG((site.seed ^ 0x68616c6c) >>> 0);
    const r = VG.hallFrame(site), cx = site.x, cz = site.z;
    const chunks = new Map();
    const bucket = (x, z) => { const k = (x >> 4) + ',' + (z >> 4); let b = chunks.get(k); if (!b) { b = { f: [], o: [] }; chunks.set(k, b); } return b; };
    const put = (x, y, z, s) => { bucket(x, z).o.push(x, y, z, s); };
    const fill = (x, z, y0, y1, s) => { if (y1 >= y0) bucket(x, z).f.push(x, z, y0, y1, s); };
    const W2 = (u, v) => { const q = ROT[r](u, v); return [cx + q[0], cz + q[1]]; };
    const L = VG.makeLot(put, cx, cz, r), P = L.P;                       // hall-local puts (facing and axis turn with the frame)
    const FL = (u, v, y0, y1, s) => { const q = ROT[r](u, v); fill(cx + q[0], cz + q[1], y0, y1, s); };
    const hc = new Map();
    const ground = (x, z) => { const k = x * 65536 + z; let h = hc.get(k); if (h === undefined) { h = g.surfaceY(x, z); hc.set(k, h); } return h; };
    const gl = (u, v) => { const q = ROT[r](u, v); return ground(cx + q[0], cz + q[1]); };
    // a model's cells fill the box that starts at (u0, v0) (its lowest u and v) for facing f, in a frame's puts
    const putModel = (Pf, name, f, u0, y, v0, extra) => {
      const m = VM && VM.MODELS[name];
      if (!m) { Pf(u0, y, v0, name, Object.assign({ facing: f }, extra || {})); return; }
      const fp = VM.footprint(m, f); let mu = 1e9, mv = 1e9;
      for (const c of fp) { if (c[0] < mu) mu = c[0]; if (c[2] < mv) mv = c[2]; }
      for (const [dx, dy, dz, i] of fp) Pf(u0 + dx - mu, y + dy, v0 + dz - mv, name, Object.assign({ facing: f, part: i }, extra || {}));
    };
    // the vines' face toward their support (lot-local direction du, dv in a frame turned rr): 1 north · 2 east · 4 south · 8 west
    const vineMask = (rr, du, dv) => { const q = ROT[rr & 3](du, dv); return q[1] < 0 ? 1 : q[0] > 0 ? 2 : q[1] > 0 ? 4 : 8; };
    const plan = { rad: H.RAD, id: site.id, name: site.name, style: 'hall', x: cx, z: cz, y: 0, seed: site.seed, homes: [], work: [], farms: [], lots: [], lamps: [], chimneys: [], plaza: null, roads: [], bell: null, pad: null, shops: [], pastures: [], orchards: [], windmills: [], base: null };
    // ---- the floor level: the median of the footprint's land, over the sea
    const hs = [];
    for (let u = -48; u <= 48; u += 8) for (let v = -80; v <= 80; v += 8) hs.push(gl(u, v));
    hs.sort((a, b) => a - b);
    const F = Math.max(SEA + 3, hs[hs.length >> 1]);
    plan.y = F + 1;
    // ---- the grid of the town (what stands on every cell) and the zones
    const GW = 2 * H.HW + 1, GV0 = -84, GV1 = 84, GN = GV1 - GV0 + 1;
    const grid = new Uint8Array(GW * GN);
    const gi = (u, v) => (u < -H.HW || u > H.HW || v < GV0 || v > GV1) ? -1 : (u + H.HW) + (v - GV0) * GW;
    const setC = (u, v, c) => { const i = gi(u, v); if (i >= 0) grid[i] = c; };
    const getC = (u, v) => { const i = gi(u, v); return i < 0 ? C.OUT : grid[i]; };
    const dApse = (u, v) => Math.hypot(u, v - H.V1);
    // the hall's region: 'in' inside, 'wall' a wall cell, null outside
    const region = (u, v) => {
      const a = Math.abs(u);
      if (a > H.HW || v < H.V0) return null;
      if (v <= H.V1 || (v <= H.VE && a >= H.A0)) {
        if (v <= H.V0 + 2 || a >= H.W0 || (v > H.V1 && a >= H.A0)) return 'wall';
        return 'in';
      }
      const d = dApse(u, v);
      if (a >= H.A0) return null;
      if (d < H.AR) return 'in';
      if (d < H.AW) return 'wall';
      return null;
    };
    // the roof's height over a cell of the hall (relative to F): the nave vault, the clerestory's top, the aisle vault, the walls' top; the half dome
    const roofH = (u, v) => {
      const a = Math.abs(u);
      if (v <= H.V1 || (v <= H.VE && a >= H.A0)) return a <= 26 ? hN(a) : a <= H.P1 ? H.SPR : a < H.W0 ? hA(a) : H.WALLTOP;
      const d = dApse(u, v);
      return d <= 26 ? hN(d) : d < H.AW ? H.SPR : -1;
    };
    yield;

    // ================================================================ the ground: a plinth under the hall and its apron, the land cut above
    const APRON = 4;
    for (let v = H.V0 - APRON; v <= 84; v++) {
      if ((v & 7) === 0) yield;
      for (let u = -H.HW - APRON; u <= H.HW + APRON; u++) {
        const reg = region(u, v);
        const near = reg || (() => { for (let du = -APRON; du <= APRON; du += 2) for (let dv = -APRON; dv <= APRON; dv += 2) if (region(u + du, v + dv)) return true; return false; })();
        if (!near) continue;
        const gy = gl(u, v);
        const [x, z] = W2(u, v);
        if (reg) {
          fill(x, z, Math.min(gy, F) - 2, F - 1, st('stone'));
          fill(x, z, F + 1, Math.max(F + H.TOP + 2, gy + 2), AIR);
          if (reg === 'wall') setC(u, v, C.WALL);
        } else {
          // the apron: level with the floor, a white plinth face where the land falls away, a retaining course where it rises
          const rim = !(() => { for (let du = -APRON + 1; du <= APRON - 1; du++) for (let dv = -APRON + 1; dv <= APRON - 1; dv++) if (Math.abs(du) + Math.abs(dv) <= APRON + 1 && region(u + du, v + dv)) return true; return false; })();
          fill(x, z, Math.min(gy, F) - 2, F - 1, st(rim && gy < F ? 'smooth_quartz' : 'dirt'));
          fill(x, z, F + 1, Math.max(F + 4, gy + 3), AIR);
          put(x, F, z, st('grass_block'));
          if (rim && gy > F) fill(x, z, F + 1, Math.min(gy, F + 6), st('quartz_bricks'));
        }
      }
    }
    yield;

    // ================================================================ the zones of the floor
    const southLots = [[-25, -14], [-37, -26], [-54, -43], [-66, -55]], northLots = [[14, 25], [26, 37]];
    const lanesV = [[-42, -38], [-71, -67], [38, 41]];
    const inLot = (v) => southLots.concat(northLots).some(([a, b]) => v >= a && v <= b);
    for (let v = H.V0 + 3; v <= 80; v++) {
      if ((v & 15) === 0) yield;
      for (let u = -H.HW; u <= H.HW; u++) {
        if (region(u, v) !== 'in') continue;
        const a = Math.abs(u);
        let c;
        if (v > H.V1 || (v >= H.GAL0 && a <= 26)) c = C.GALLERY;
        else if (a >= H.P0 && a <= H.P1) c = C.LANE;   // (the arcade loop below marks its piers)
        else if (a >= H.A0) c = Math.abs(v) <= 3 ? C.CROSS : (a <= H.STALL1 ? C.STALL : a <= H.WK1 ? C.WALK : C.LOGGIA);
        else if (v <= H.V0 + 8) c = C.FORE;
        else if (v >= H.STAIR0 && v < H.GAL0) c = a <= 5 ? C.STAIR : a <= 6 ? C.WALL : C.LANE;
        else if (Math.abs(v) <= H.PV) c = C.PLAZA;
        else if (v > 37) c = C.FORE;
        else if (a <= H.ST) c = C.STREET;
        else if (a <= H.FR) c = C.FRONT;
        else if (a >= H.BL0) c = C.LANE;
        else if (inLot(v)) c = a <= H.HS1 ? C.HOUSE : C.YARD;
        else c = C.LANE;
        setC(u, v, c);
      }
    }
    // the arcade: piers 3 thick at v = 10k + 4 … 10k + 6, the openings between them (walkable passages)
    const isPierV = (v) => { const m = ((v - 4) % 10 + 10) % 10; return m <= 2; };
    for (let v = H.V0 + 3; v <= H.V1; v++) for (const s of [-1, 1]) for (let a = H.P0; a <= H.P1; a++) setC(s * a, v, isPierV(v) && Math.abs(v) > 3 ? C.PIER : C.LANE);
    yield;
    // the floor's materials by code
    const MAT = { street: st('paver_grey'), street2: st('granite_paver'), front: st('travertine'), plaza: st('marble_white'), ring: st('travertine'), lane: st('paver_grey'), aisle: st('marble_white'), fore: st('travertine'), yard: st('travertine') };
    for (let v = H.V0 + 3; v <= 80; v++) {
      if ((v & 15) === 0) yield;
      for (let u = -H.HW; u <= H.HW; u++) {
        const c = getC(u, v); if (!c || c === C.WALL) continue;
        const [x, z] = W2(u, v), a = Math.abs(u);
        let s;
        if (c === C.STREET) s = (M.hash2(x, z, 931) & 7) === 0 ? MAT.street2 : MAT.street;
        else if (c === C.FRONT) s = MAT.front;
        else if (c === C.PLAZA) { const d = Math.hypot(u, v); s = d <= H.PR ? ((d >= 5 && d < 6) || (d >= 10 && d < 11) ? MAT.ring : MAT.plaza) : (M.hash2(x, z, 932) & 7) === 0 ? MAT.street2 : MAT.street; }
        else if (c === C.LANE || c === C.CROSS) s = (M.hash2(x, z, 933) & 7) === 0 ? MAT.street2 : MAT.lane;
        else if (c === C.YARD) s = MAT.yard;
        else if (c === C.FORE || c === C.GALLERY || c === C.STAIR) s = MAT.fore;
        else s = MAT.aisle;
        if (c === C.WALK && ((a + v) % 6 === 0)) s = MAT.ring;
        put(x, F, z, s);
      }
    }
    yield;

    // ================================================================ the walls, the piers, the arcade and the clerestory
    const STONE = st('quartz_bricks'), SMOOTH = st('smooth_quartz'), BAND = st(VR.R.byName.vx_town_band ? 'vx_town_band' : 'chiseled_quartz_block'), CHIS = st('chiseled_quartz_block');
    const GLASS = st('glass'), FROST = st('frosted_glass');
    for (let v = H.V0; v <= 80; v++) {
      if ((v & 7) === 0) yield;
      for (let u = -H.HW; u <= H.HW; u++) {
        const reg = region(u, v); if (!reg) continue;
        const a = Math.abs(u), [x, z] = W2(u, v);
        const top = F + roofH(u, v);
        if (reg === 'wall') {
          fill(x, z, F, top, STONE);
          // the outer walls' plinth course and cornice (the gold band outside)
          put(x, F + 1, z, SMOOTH);
          if (a >= H.W0 && v <= H.V1) put(x, F + H.WALLTOP, z, BAND);
          continue;
        }
        if (a >= H.P0 && a <= H.P1 && v <= H.V1) {
          // the clerestory over the arcade, the piers, the arches' spandrels
          fill(x, z, F + H.CLR, F + H.SPR, STONE);
          if (isPierV(v) && Math.abs(v) > 3) { fill(x, z, F + 1, F + H.CLR - 1, STONE); put(x, F + 1, z, SMOOTH); put(x, F + H.ARC, z, BAND); }
          else {
            // a round arch over the opening (radius 3.5 about the opening's middle, v ≡ 0 mod 10): the gold archivolt on its soffit
            const dd = Math.abs((((v + 5) % 10) + 10) % 10 - 5);
            const soffit = H.ARC + Math.floor(Math.sqrt(Math.max(0, 12.25 - dd * dd)) + 0.5);
            fill(x, z, F + soffit, F + H.CLR - 1, STONE); put(x, F + soffit, z, BAND);
          }
          continue;
        }
      }
    }
    yield;
    // ---- the roof: one closed shell over the whole hall (each cell from its lowest neighbour's height up to its own)
    // (run 2: a clear glass band read as open sky — the hall looked outdoors, the owner's very complaint. The vault is a
    //  coffered one now: frosted white glass panels between white stone ribs every 6 across and every 5 along, over the
    //  whole nave up to its springing, the half dome likewise in rings and rays, the aisle vaults' middles: from below a
    //  luminous white ceiling, and every rib lies within two cells of a panel, so the vault's underside is lit too)
    const ribV = (v) => ((v % 5) + 5) % 5 === 0;
    const inGlass = (u, v) => {
      const a = Math.abs(u);
      if (v <= H.V1) {
        if (a <= H.GLASS) return !ribV(v) && a % 6 !== 3;
        if (a >= H.AGL0 && a <= H.AGL1) return !ribV(v) && a !== 35 && v <= H.V1 - 1 && v >= H.V0 + 3;
        return false;
      }
      const d = dApse(u, v), k = Math.round(Math.atan2(v - H.V1, u) / (Math.PI / 10));
      return d <= H.GLASS && d >= 2 && Math.abs(Math.atan2(v - H.V1, u) - k * Math.PI / 10) * d > 0.7 && Math.abs(d - 12) > 0.7;
    };
    for (let v = H.V0; v <= 80; v++) {
      if ((v & 7) === 0) yield;
      for (let u = -H.HW; u <= H.HW; u++) {
        const reg = region(u, v); if (!reg) continue;
        const h = roofH(u, v); if (h < 0) continue;
        let lo = h;
        for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nr = region(u + du, v + dv); const nh = nr ? roofH(u + du, v + dv) : 0; lo = Math.min(lo, nh + 1); }
        lo = Math.max(lo, reg === 'wall' || (Math.abs(u) >= H.P0 && Math.abs(u) <= H.P1 && v <= H.V1) ? h : 1);
        const [x, z] = W2(u, v), gls = reg === 'in' && inGlass(u, v);
        for (let y = lo; y <= h; y++) put(x, F + y, z, gls ? FROST : SMOOTH);   // (a panel's whole column is glass: no stone under it stops the light)
        // the transverse ribs under the nave vault (every pier line), gold banded
        if (reg === 'in' && v <= H.V1 && Math.abs(u) <= 26 && (((v - 5) % 10) + 10) % 10 === 0) put(x, F + lo - 1, z, BAND);
        // the ring of the half dome at a third of its radius
        if (reg === 'in' && v > H.V1 && Math.abs(dApse(u, v) - 18) < 0.6) put(x, F + lo - 1, z, BAND);
      }
    }
    yield;

    // ================================================================ windows and gates
    // the stained glass of the windows' heads (glass blocks: the light passes)
    const SG = { blue: st('blue_stained_glass'), lblue: st('light_blue_stained_glass'), gold: st('yellow_stained_glass'), amber: st('orange_stained_glass'), rose: st('pink_stained_glass'), magenta: st('magenta_stained_glass'), white: st('white_stained_glass') };
    // an arched window in a wall plane: cells (t across, y up) → a function (t, y) that says glass / stained / open
    const archWin = (half, y0, yc, rad) => (t, y) => {
      if (y < y0) return null;
      if (y < yc) return Math.abs(t) <= half ? 'g' : null;
      const d = Math.hypot(t, y - yc + 0.5);
      return d <= rad + 0.25 ? (y >= yc ? 's' : 'g') : null;
    };
    // the outer long walls: a window in every bay (a mullion in the middle), the stained head over F + 12
    for (let k = -7; k <= 4; k++) {
      if (k === 0) continue;
      yield;
      const vc = 10 * k, win = archWin(2, 5, 14, 2.6);
      for (const s of [-1, 1]) for (let t = -2; t <= 2; t++) for (let y = 5; y <= 18; y++) {
        const w = win(t, y); if (!w) continue;
        for (let a = H.W0; a <= H.HW; a++) {
          const mid = a === 47;
          let b = AIR;
          if (mid) b = w === 's' ? (t === 0 ? SG.gold : Math.abs(t) === 1 ? SG.blue : SG.lblue) : (t === 0 && y < 12 ? CHIS : GLASS);
          P(s * a, F + y, vc + t, b);
        }
      }
    }
    // the clerestory: a window over every opening of the arcade, the head stained
    for (let k = -7; k <= 4; k++) {
      yield;
      const vc = 10 * k, win = archWin(2, 24, 28, 2.6);
      for (const s of [-1, 1]) for (let t = -2; t <= 2; t++) for (let y = 24; y <= 30; y++) {
        const w = win(t, y); if (!w) continue;
        for (let a = H.P0; a <= H.P1; a++) P(s * a, F + y, vc + t, a === 28 ? (w === 's' ? (t === 0 ? SG.rose : SG.gold) : GLASS) : AIR);
      }
    }
    // the gates in the long walls: an arched opening seven wide, the gold archivolt
    for (const s of [-1, 1]) for (let t = -3; t <= 3; t++) {
      const soffit = 8 + Math.floor(Math.sqrt(Math.max(0, 12.25 - t * t)) + 0.5);
      for (let a = H.W0; a <= H.HW; a++) { for (let y = 1; y < soffit; y++) P(s * a, F + y, t, AIR); P(s * a, F + soffit, t, BAND); P(s * a, F, t, MAT.fore); setC(s * a, t, C.CROSS); }
    }
    // outside (run 2: a long plain white box): buttresses three wide at every pier line of the long walls and beside the
    // entrance end's window, stepped back at two heights, a gold band at their caps; over each gate a portal of two
    // pilasters and a stepped pediment with a gold course
    for (let k = -8; k <= 4; k++) {
      const vp = 10 * k + 5; if (vp < H.V0 + 2 || vp > H.V1) continue;
      for (const s of [-1, 1]) for (let dv = -1; dv <= 1; dv++) {
        const [x, z] = W2(s * (H.HW + 1), vp + dv), [x2, z2] = W2(s * (H.HW + 2), vp + dv);
        fill(x, z, F, F + 20, STONE); put(x, F + 21, z, BAND); fill(x2, z2, F, F + 10, STONE); put(x2, F + 11, z2, BAND);
      }
    }
    for (const uc of [-27, -15, 15, 27]) for (let du = -1; du <= 1; du++) {
      const [x, z] = W2(uc + du, H.V0 - 1), [x2, z2] = W2(uc + du, H.V0 - 2);
      fill(x, z, F, F + (Math.abs(uc) === 15 ? 30 : 20), STONE); put(x, F + (Math.abs(uc) === 15 ? 31 : 21), z, BAND); fill(x2, z2, F, F + 10, STONE); put(x2, F + 11, z2, BAND);
    }
    for (const s of [-1, 1]) {
      for (let y = F + 13; y <= F + 17; y++) { const half = 6 - (y - F - 13) - (y - F - 13 >> 1); for (let t = -half; t <= half; t++) P(s * (H.HW + 1), y, t, y === F + 13 ? BAND : STONE); }
      for (let t = -5; t <= 5; t++) P(s * (H.HW + 1), F + 12, t, BAND);
    }
    yield;
    // the entrance end: a giant arched window over the nave (mullions every 4, transoms, a stained head of rays and a ring)
    for (let u = -13; u <= 13; u++) for (let y = 6; y <= 38; y++) {
      const yc = 24, d = Math.hypot(u, y - yc);
      if (y > yc && d > 13.4) continue;
      const mull = (u % 4 === 0 && Math.abs(u) <= 12) || y === 14 || (y === 22 && Math.abs(u) <= 13);
      let b;
      if (y > yc && Math.abs(d - 7) < 0.7) b = SG.magenta;
      else if (y > yc && d < 2.2) b = SG.amber;
      else if (y >= yc) { const k = Math.floor(Math.atan2(y - yc, u) / (Math.PI / 8)); b = (k & 1) ? SG.blue : SG.gold; }
      else b = mull ? SMOOTH : (y >= 18 && (Math.abs(u) === 13 || y === 21) ? SG.lblue : GLASS);
      if (mull && y < yc) b = SMOOTH;
      for (let vv = H.V0; vv <= H.V0 + 2; vv++) P(u, F + y, vv, vv === H.V0 + 1 ? b : AIR);
    }
    // the aisles' end windows (both ends) and the apse's five lancets over the gallery
    for (const vv of [[H.V0, H.V0 + 1, H.V0 + 2], [H.V1 + 1, H.V1 + 2, H.VE]]) for (const s of [-1, 1]) {
      const win = archWin(2, 6, 15, 2.6);
      for (let t = -2; t <= 2; t++) for (let y = 6; y <= 18; y++) { const w = win(t, y); if (!w) continue; for (const v of vv) P(s * (36 + t), F + y, v, v === vv[1] ? (w === 's' ? SG.gold : GLASS) : AIR); }
    }
    yield;
    for (let k = 1; k <= 5; k++) {
      const th = k * Math.PI / 6, du = Math.cos(th), dv = Math.sin(th);
      for (let w = -15; w <= 15; w++) for (let rr = H.AR; rr < H.AW; rr++) {
        const t = w / 10, uu = Math.round(du * rr - dv * t), vv = Math.round(H.V1 + dv * rr + du * t);
        if (region(uu, vv) !== 'wall') continue;
        const mid = Math.abs(dApse(uu, vv) - 28) < 0.75;
        for (let y = 12; y <= 27; y++) {
          if (y > 25 && Math.abs(t) > 1.4 - (y - 25) * 0.5) continue;
          if (Math.abs(t) > 1.5) continue;
          P(uu, F + y, vv, mid ? (y >= 22 ? (Math.abs(t) < 0.5 ? SG.rose : SG.blue) : GLASS) : AIR);
        }
      }
    }
    yield;

    // ================================================================ the apse: the gallery platform, the grand staircase, the balustrades
    for (let v = H.GAL0; v <= 80; v++) for (let u = -26; u <= 26; u++) {
      if (region(u, v) !== 'in' || getC(u, v) !== C.GALLERY) continue;
      const [x, z] = W2(u, v);
      fill(x, z, F + 1, F + H.GAL - 1, STONE);
      put(x, F + H.GAL, z, MAT.fore);
    }
    yield;
    // the niches under the gallery's front: arched doorways with doors and a lantern
    for (const uc of [-21, -15, -9, 9, 15, 21]) {
      for (let t = -1; t <= 1; t++) for (let y = 1; y <= 4; y++) { if (y === 4 && t !== 0) continue; P(uc + t, F + y, H.GAL0, AIR); }
      P(uc, F + 1, H.GAL0 + 1, 'spruce_door', { facing: 0, half: 0, hinge: 0, open: 0 }); P(uc, F + 2, H.GAL0 + 1, 'spruce_door', { facing: 0, half: 1, hinge: 0, open: 0 });
      P(uc, F + 5, H.GAL0, BAND);
      putModel(P, 'vm_wall_lantern', 0, uc + 2, F + 3, H.GAL0 - 1);
    }
    // the grand staircase: eleven wide, eight steps up to the gallery, stringers with a balustrade climbing on both sides
    for (let k = 0; k < 8; k++) {
      const v = H.STAIR0 + k;
      for (let u = -5; u <= 5; u++) {
        if (k > 0) FL(u, v, F + 1, F + k, STONE);
        P(u, F + 1 + k, v, k === 7 ? MAT.fore : 'quartz_stairs', k === 7 ? undefined : { facing: 2, half: 0 });
        setC(u, v, C.STAIR);
      }
      for (const s of [-1, 1]) { FL(s * 6, v, F + 1, F + 1 + k, STONE); P(s * 6, F + 2 + k, v, 'vx_balustrade'); setC(s * 6, v, C.WALL); }
    }
    // the gallery's front balustrade (the stair's opening left free), lamps at the stair's head, benches, plants, the bell
    for (let u = -26; u <= 26; u++) { if (Math.abs(u) <= 5) continue; if (region(u, H.GAL0) === 'in') P(u, F + H.GAL + 1, H.GAL0, 'vx_balustrade'); }
    for (const s of [-1, 1]) { putModel(P, 'vm_town_lamp', 0, s * 7, F + H.GAL + 1, H.GAL0 + 1); plan.lamps.push((() => { const [x, z] = W2(s * 7, H.GAL0 + 1); return [x, F + H.GAL + 4, z]; })()); }
    const galSeats = [];
    for (const uc of [-18, -12, 12, 18]) { P(uc, F + H.GAL + 1, H.GAL0 + 3, 'vx_bench', { facing: 0 }); const [x, z] = W2(uc, H.GAL0 + 3); galSeats.push([x, F + H.GAL + 1, z, L.facing(0)]); }
    for (const [uc, vc] of [[-22, 56], [22, 56], [-12, 68], [12, 68], [0, 74]]) if (region(uc, vc) === 'in') putModel(P, 'vm_planter', 0, uc, F + H.GAL + 1, vc);
    // lanterns round the apse on the gallery's floor by its wall: the gallery is lit at dusk
    for (let k = 0; k <= 6; k++) { const th = k * Math.PI / 6, uu = Math.round(Math.cos(th) * (H.AR - 1)), vv = Math.round(H.V1 + Math.sin(th) * (H.AR - 1)); if (region(uu, vv) === 'in') { P(uu, F + H.GAL + 1, vv, 'lantern', { hanging: 0 }); const [x, z] = W2(uu, vv); plan.lamps.push([x, F + H.GAL + 1, z]); } }
    P(0, F + H.GAL + 1, 64, 'bell', { facing: 0 });
    { const [x, z] = W2(0, 64); plan.bell = [x, F + H.GAL + 1, z]; }
    // the council (the town's hall, the mayor's place) on the gallery
    { const [x, z] = W2(0, 58), [ix, iz] = W2(0, 56), [ox, oz] = W2(0, H.GAL0 - 2); plan.work.push({ kind: 'hall', door: [ix, F + H.GAL + 1, iz], outside: [ox, F + 1, oz], inside: [ix, F + H.GAL + 1, iz], beds: [], seats: galSeats, work: [['council', x, F + H.GAL + 1, z]], chimney: null, table: null, lights: [], box: null }); }
    yield;

    // ================================================================ the shop houses
    const SHOPS = ['bakery', 'market', 'library', 'bakery', 'market', 'library', 'bakery', 'market', 'bakery', 'market', 'library'];
    const SIGN = { bakery: 'bread', cafe: 'cup', market: 'flower', library: 'book' };
    const BEDS = ['vx_bed_red', 'vx_bed_blue', 'vx_bed_green', 'vx_bed_yellow', 'vx_bed_teal', 'vx_bed_white'];
    let shopN = 0;
    const record = (rr, ox, oz, p) => { if (!p) return null; const q = ROT[rr](p[0], p[2]); return [ox + q[0], p[1], oz + q[1]]; };
    const recordF = (rr, ox, oz, p) => { const w = record(rr, ox, oz, p); w.push((p[3] + rr) & 3); return w; };
    const houses = [];
    for (const [side, lots] of [[1, southLots], [-1, southLots], [1, northLots], [-1, northLots]]) for (const [vlo, vhi] of lots) houses.push({ side, vlo, vhi });
    for (const hs0 of houses) {
      yield;
      const { side, vlo, vhi } = hs0;
      // the lot frame: u along the street, v into the lot, the front at v = 0 facing the street (facing 0)
      const kk = side > 0 ? 3 : 1, rr = (r + kk) & 3;
      const U0 = side * H.HS0, V0 = side > 0 ? vhi : vlo;
      const [ox, oz] = W2(U0, V0);
      const Lh = VG.makeLot(put, ox, oz, rr), Q = Lh.P;
      const w = H.LOT.w, d = H.LOT.house, lrng = new VR.RNG((M.hash2(ox, oz, site.seed) >>> 0) || 1);
      const floors = lrng.chance(0.55) ? 3 : 2, top = F + 5 * floors;
      const wall = lrng.chance(0.7) ? 'travertine' : 'quartz_bricks', stain = lrng.pick(['blue', 'gold', 'rose']);
      const plazaSide = Math.abs(vlo) === 14 || Math.abs(vhi) === 14 ? ((side > 0) === (vhi < 0) ? 0 : w - 1) : -1;   // the side wall that faces the plaza (lot u), -1 none
      const laneSide = (lanesV.some(([a, b]) => vlo - 1 >= a && vlo - 1 <= b || vhi + 1 >= a && vhi + 1 <= b)) ? ((side > 0) === lanesV.some(([a, b]) => vlo - 1 >= a && vlo - 1 <= b) ? w - 1 : 0) : -1;
      const kind = plazaSide >= 0 && side > 0 && vhi < 0 ? 'cafe' : SHOPS[shopN++ % SHOPS.length];
      const awning = lrng.chance(0.75) ? 'amber' : 'teal';
      // ---- the shell: walls, quoins, the gold band at every storey, floors
      for (let u = 0; u < w; u++) for (let v = 0; v < d; v++) {
        const edge = u === 0 || v === 0 || u === w - 1 || v === d - 1, quoin = (u === 0 || u === w - 1) && (v === 0 || v === d - 1);
        for (let k = 0; k < floors; k++) {
          const y0 = F + 5 * k;
          if (k > 0) Q(u, y0, v, edge ? 'vx_town_band' : (u === w - 2 && v === d - 2 ? null : 'spruce_planks'));
          for (let y = y0 + 1; y <= y0 + 4; y++) Q(u, y, v, edge ? (quoin ? 'stripped_spruce_log' : (y === F + 1 ? 'smooth_quartz' : wall)) : null);
        }
        Q(u, top, v, edge ? 'vx_town_band' : 'spruce_planks');
      }
      // ---- the storefront: the door, posts, the shop window, the fascia, two awnings, the sign, a wall lantern
      const door = 2;
      Q(door, F + 1, 0, 'spruce_door', { facing: 2, half: 0, hinge: 0, open: 0 }); Q(door, F + 2, 0, 'spruce_door', { facing: 2, half: 1, hinge: 0, open: 0 }); Q(door, F + 3, 0, 'glass_pane');
      for (const u of [3, w - 2]) for (let y = F + 1; y <= F + 4; y++) Q(u, y, 0, 'stripped_spruce_log');
      for (let u = 4; u <= w - 3; u++) { Q(u, F + 1, 0, 'spruce_planks'); Q(u, F + 2, 0, 'glass_pane'); Q(u, F + 3, 0, 'glass_pane'); Q(u, F + 4, 0, 'spruce_planks'); }
      putModel(Q, 'vm_town_awning_' + awning, 0, 4, F + 4, -2); putModel(Q, 'vm_town_awning_' + awning, 0, w - 5, F + 4, -2);
      putModel(Q, 'vm_town_sign_' + SIGN[kind], 0, (w >> 1) - 1, F + 5, -1);
      putModel(Q, 'vm_wall_lantern', 0, 1, F + 3, -1);
      putModel(Q, 'vm_planter', 0, 1, F + 1, -1);   // (a potted plant under the lantern, beside the door)
      // ---- the upper storeys' windows, flower boxes, a balcony with a balustrade and vines on three-storey houses
      const winU = [2, 4, 7, 9];
      for (let k = 1; k < floors; k++) {
        const y0 = F + 5 * k;
        for (const u of winU) { putModel(Q, 'vm_town_window_' + stain, 0, u, y0 + 1, 0); if (!(k === 2 && u >= 3 && u <= 8)) Q(u, y0, -1, 'vx_windowbox', { facing: 0 }); }
        // back windows
        for (const u of [3, 8]) putModel(Q, 'vm_town_window_' + stain, 2, u, y0 + 1, d - 1);
        if (plazaSide >= 0 || laneSide >= 0) { const su = plazaSide >= 0 ? plazaSide : laneSide; for (const v of [3, 8]) putModel(Q, 'vm_town_window_' + stain, su === 0 ? 3 : 1, su, y0 + 1, v); }
      }
      if (floors === 3) {
        for (let u = 3; u <= 8; u++) { Q(u, F + 10, -1, 'smooth_quartz_slab', { type: 'top' }); Q(u, F + 11, -1, 'vx_balustrade'); }
        const vm = vineMask(rr, 0, 1);
        for (const u of [3, 8]) for (let y = F + 7; y <= F + 9; y++) Q(u, y, -1, 'vines', { faces: vm });
      } else if (lrng.chance(0.6)) { const vm = vineMask(rr, 0, 1); for (const u of [1, w - 2]) for (let y = top - 3; y <= top - 1; y++) Q(u, y, -1, 'vines', { faces: vm }); }
      // ---- a corner house's storefront on the plaza side, with an awning
      if (plazaSide >= 0) {
        const su = plazaSide, fac = su === 0 ? 3 : 1;
        for (let v = 3; v <= 8; v++) { Q(su, F + 1, v, 'spruce_planks'); Q(su, F + 2, v, 'glass_pane'); Q(su, F + 3, v, 'glass_pane'); Q(su, F + 4, v, 'spruce_planks'); }
        putModel(Q, 'vm_town_awning_' + awning, fac, su === 0 ? -2 : w, F + 4, 3); putModel(Q, 'vm_town_awning_' + awning, fac, su === 0 ? -2 : w, F + 4, 6);
      }
      // ---- the back door to the yard, the yard's planter and a barrel
      Q(5, F + 1, d - 1, 'spruce_door', { facing: 0, half: 0, hinge: 0, open: 0 }); Q(5, F + 2, d - 1, 'spruce_door', { facing: 0, half: 1, hinge: 0, open: 0 });
      putModel(Q, 'vm_planter', 0, 1, F + 1, d + 2); Q(w - 2, F + 1, d + 3, 'vx_barrel'); if (lrng.chance(0.5)) Q(w - 3, F + 1, d + 3, 'vx_crate');
      // ---- the gable roof: the ridge runs into the lot (the gable faces the street), slate over a timbered gable
      {
        const span = w, len = d, at = (a, b) => [b, a], half = Math.ceil((span + 2) / 2);
        let roofTop = top;
        for (let i = 0; i <= half; i++) {
          const y = top - 1 + i, bf = i - 1, bb = span - i;
          if (bf >= bb) break;
          for (let a = -1; a <= len; a++) {
            const [u1, v1] = at(a, bf), [u2, v2] = at(a, bb);
            Q(u1, y, v1, 'vx_roof_slate', { facing: 1 }); Q(u2, y, v2, 'vx_roof_slate', { facing: 3 });
            if (a === 0 || a === len - 1) { for (let b = bf + 1; b < bb; b++) { const [u, v] = at(a, b); if (i >= 1) Q(u, y, v, i === 1 ? 'vx_beam_dark' : (b % 3 === 0 ? 'vx_beam_dark' : wall), i === 1 ? { axis: 1 } : (b % 3 === 0 ? { axis: 0 } : undefined)); } }
            else if (a > 0 && a < len - 1 && i >= 1) { for (let b = bf + 1; b < bb; b++) { const [u, v] = at(a, b); Q(u, y, v, null); } }
          }
          roofTop = y;
        }
        // a round window in the street gable
        Q((w >> 1) - 1, top + 2, 0, 'vx_window_round', { facing: 0 }); Q(w >> 1, top + 2, 0, 'vx_window_round', { facing: 0 });
        hs0.roofTop = roofTop;
      }
      // ---- the shop inside: shelves against the back wall, a counter, the keeper's place; the ladder in the back corner
      const SHELF = { bakery: 'vx_shop_shelf_bakery', market: 'vx_shop_shelf_flowers', library: 'vx_bookshelf', cafe: 'vx_shop_shelf_drinks' }[kind];
      for (const u of [1, 2, 3, 7, 8]) Q(u, F + 1, d - 2, SHELF, { facing: 0 });
      for (let u = 5; u <= 8; u++) Q(u, F + 1, 6, 'vx_counter', { facing: 0 });
      if (kind === 'market') { Q(1, F + 1, 3, 'vx_shop_flower_stand', { facing: 1 }); Q(w - 2, F + 1, 3, 'vx_shop_flower_stand', { facing: 3 }); }
      else if (kind === 'bakery') Q(1, F + 1, 3, 'vx_shop_bakery_case', { facing: 1 });
      else if (kind === 'cafe') { putModel(Q, 'vm_shop_table_marble', 0, 2, F + 1, 3); putModel(Q, 'vm_shop_chair_bentwood', 1, 1, F + 1, 3); }
      for (let y = F + 1; y <= top - 1; y++) Q(w - 2, y, d - 2, 'ladder', { facing: 0 });
      Q(5, F + 4, 3, 'vx_lantern');
      const shopInfo = { kind, door: [door, F + 1, 0], outside: [door, F + 1, -1], inside: [door, F + 1, 1], beds: [], seats: [], work: [[kind === 'bakery' ? 'bake' : kind === 'cafe' ? 'brew' : kind === 'library' ? 'read' : 'till', 6, F + 1, 7]], table: null, lights: [[5, F + 4, 3]] };
      // ---- the homes upstairs: one family a storey (beds along the back wall, a table, a kitchen, a wardrobe, a lantern)
      const homeInfos = [];
      for (let k = 1; k < floors; k++) {
        const Y = F + 5 * k + 1, info = { kind: 'home', door: [door, F + 1, 0], outside: [door, F + 1, -1], inside: [door, F + 1, 1], beds: [], seats: [], work: [], table: null, lights: [] };
        const nb = 2 + lrng.int(2), col = BEDS[lrng.int(BEDS.length)];
        for (let b = 0; b < nb; b++) { const u = 1 + b; Q(u, Y, d - 3, col, { facing: 2, part: 0 }); Q(u, Y, d - 2, col, { facing: 2, part: 1 }); info.beds.push([u, Y, d - 3, 2]); }
        const tu = 5, tv = 5; Q(tu, Y, tv, 'vx_table'); info.table = [tu, Y, tv];
        for (const [cu, cv, f] of [[tu - 1, tv, 1], [tu + 1, tv, 3], [tu, tv - 1, 2], [tu, tv + 1, 0]]) { Q(cu, Y, cv, 'vx_chair', { facing: f }); info.seats.push([cu, Y, cv, f]); }
        Q(w - 2, Y, 2, 'vx_stove', { facing: 3 }); Q(w - 2, Y, 3, 'vx_counter', { facing: 3 }); Q(w - 2, Y, 4, 'vx_counter', { facing: 3 });
        Q(1, Y, 2, 'vx_wardrobe', { facing: 1, part: 0 }); Q(1, Y + 1, 2, 'vx_wardrobe', { facing: 1, part: 1 });
        Q(1, Y, 5, 'vx_bookshelf', { facing: 1 }); Q(1, Y, 1, 'vx_potplant');
        for (let u = 4; u <= 6; u++) for (let v = 7; v <= 8; v++) Q(u, Y, v, 'vx_rug_' + ['red', 'blue', 'green', 'sand'][lrng.int(4)]);
        Q(tu, Y + 3, tv, 'vx_lantern'); info.lights.push([tu, Y + 3, tv]);
        homeInfos.push(info);
      }
      // ---- the records in world coordinates
      const box = (() => { const a = record(rr, ox, oz, [-1, F, -1]), b = record(rr, ox, oz, [w, F, d]); return [Math.min(a[0], b[0]), F, Math.min(a[2], b[2]), Math.max(a[0], b[0]), (hs0.roofTop || top) + 1, Math.max(a[2], b[2])]; })();
      const toWorld = (info) => ({ kind: info.kind, door: record(rr, ox, oz, info.door), outside: record(rr, ox, oz, info.outside), inside: record(rr, ox, oz, info.inside), beds: info.beds.map(p => recordF(rr, ox, oz, p)), seats: info.seats.map(p => recordF(rr, ox, oz, p)), work: info.work.map(wk => [wk[0]].concat(record(rr, ox, oz, [wk[1], wk[2], wk[3]]))), chimney: null, table: record(rr, ox, oz, info.table), lights: info.lights.map(p => record(rr, ox, oz, p)), box, F, r: rr, w, d, ox, oz, hall: true });
      for (const hi of homeInfos) { const rec = toWorld(hi); plan.homes.push(rec); for (const l of rec.lights) plan.lamps.push(l); }
      const shop = toWorld(shopInfo); shop.sign = SIGN[kind];
      plan.work.push(shop);
      plan.shops.push({ kind, sign: SIGN[kind], at: shop.outside, n: plan.shops.length });
      hs0.lot = { w, d: H.LOT.d, house: w * d, floors, homes: homeInfos.length, kind, cafe: kind === 'cafe' ? shop : null };
    }
    yield;

    // ================================================================ the loggia homes in the aisles (two storeys over a workshop, balustraded galleries)
    const loggias = [];
    for (let k = -7; k <= 4; k++) if (k !== 0) for (const s of [-1, 1]) loggias.push({ k, s });
    for (const lg of loggias) {
      yield;
      const { k, s } = lg;
      // the frame: u along the aisle (+v hall), v into the unit (toward the wall); the front at |u| = 39 faces the walk
      const kk = s > 0 ? 3 : 1, rr = (r + kk) & 3;
      const vlo = 10 * k - 4, vhi = 10 * k + 5, U0 = s * H.LG0, V0 = s > 0 ? vhi : vlo;
      const [ox, oz] = W2(U0, V0);
      const Lu = VG.makeLot(put, ox, oz, rr), Q = Lu.P;
      const w = 10, d = 7, lrng = new VR.RNG((M.hash2(ox, oz, site.seed + 77) >>> 0) || 1);
      const wall = lrng.chance(0.6) ? 'travertine' : 'quartz_bricks', stain = lrng.pick(['blue', 'gold', 'rose']);
      for (let u = 0; u < w; u++) for (let v = 0; v < d; v++) {
        const edge = u === 0 || u === w - 1 || v === 0 || v === d - 1;
        for (let kf = 0; kf < 3; kf++) {
          const y0 = F + 5 * kf;
          if (kf > 0) Q(u, y0, v, edge ? 'vx_town_band' : (u === w - 2 && v === d - 2 ? null : 'spruce_planks'));
          for (let y = y0 + 1; y <= y0 + 4; y++) {
            // (the back wall stays open behind the hall's tall window of the bay: the rooms get its light)
            const V = s > 0 ? vhi - u : vlo + u, behindWin = v === d - 1 && Math.abs(V - 10 * k) <= 2 && y >= F + 5 && y <= F + 17;
            Q(u, y, v, behindWin ? null : edge && v !== d - 1 ? ((u === 0 || u === w - 1) && v === 0 ? 'stripped_spruce_log' : wall) : edge ? wall : null);
          }
        }
        Q(u, F + 15, v, edge ? 'vx_town_band' : 'smooth_quartz');
        if (edge) Q(u, F + 16, v, 'vx_balustrade');
      }
      // potted plants and a barrel by the front (on the walk's edge), now and then
      if (lrng.chance(0.7)) putModel(Q, 'vm_planter', 0, 1, F + 1, -1); if (lrng.chance(0.5)) Q(w - 2, F + 1, -1, lrng.chance(0.5) ? 'vx_barrel' : 'vx_crate');
      // the ground floor: an arched workshop opening to the walk, crates and a counter inside
      for (let u = 3; u <= 6; u++) for (let y = F + 1; y <= F + 3; y++) Q(u, y, 0, null);
      Q(4, F + 4, 0, 'vx_town_band'); Q(5, F + 4, 0, 'vx_town_band');
      Q(2, F + 1, 3, 'vx_crate'); Q(7, F + 1, 3, 'vx_barrel'); Q(3, F + 1, 4, 'vx_counter', { facing: 0 }); Q(6, F + 1, 4, 'vx_counter', { facing: 0 });
      for (let y = F + 1; y <= F + 14; y++) Q(w - 2, y, d - 2, 'ladder', { facing: 0 });
      // the two storeys: arched windows on the front, a gallery with a balustrade over the walk, a door onto it
      const homes = [];
      for (let kf = 1; kf <= 2; kf++) {
        const y0 = F + 5 * kf, Y = y0 + 1;
        for (const u of [2, 7]) putModel(Q, 'vm_town_window_' + stain, 0, u, Y, 0);
        Q(4, Y, 0, 'spruce_door', { facing: 2, half: 0, hinge: 0, open: 0 }); Q(4, Y + 1, 0, 'spruce_door', { facing: 2, half: 1, hinge: 0, open: 0 });
        for (let u = 0; u < w; u++) { Q(u, y0, -1, 'smooth_quartz_slab', { type: 'top' }); Q(u, Y, -1, 'vx_balustrade'); }
        if (lrng.chance(0.5)) { const vm = vineMask(rr, 0, 1); for (let y = y0 - 3; y <= y0 - 1; y++) Q(lrng.chance(0.5) ? 1 : w - 2, y, -1, 'vines', { faces: vm }); }
        const info = { kind: 'home', door: [4, F + 1, 0], outside: [4, F + 1, -2], inside: [4, F + 1, 1], beds: [], seats: [], work: [], table: null, lights: [] };
        const nb = 2 + lrng.int(2), col = BEDS[lrng.int(BEDS.length)];
        for (let b = 0; b < nb; b++) { const u = 1 + b * 1; Q(u, Y, d - 3, col, { facing: 2, part: 0 }); Q(u, Y, d - 2, col, { facing: 2, part: 1 }); info.beds.push([u, Y, d - 3, 2]); }
        Q(5, Y, 2, 'vx_table'); info.table = [5, Y, 2];
        for (const [cu, cv, f] of [[4, 2, 1], [6, 2, 3], [5, 3, 0]]) { Q(cu, Y, cv, 'vx_chair', { facing: f }); info.seats.push([cu, Y, cv, f]); }
        Q(w - 2, Y, 1, 'vx_stove', { facing: 3 }); Q(w - 2, Y, 2, 'vx_counter', { facing: 3 });
        Q(5, Y + 3, 3, 'vx_lantern'); info.lights.push([5, Y + 3, 3]);
        homes.push(info);
      }
      const box = (() => { const a = (() => { const q = ROT[rr](-1, -1); return [ox + q[0], oz + q[1]]; })(), b = (() => { const q = ROT[rr](w, d); return [ox + q[0], oz + q[1]]; })(); return [Math.min(a[0], b[0]), F, Math.min(a[1], b[1]), Math.max(a[0], b[0]), F + 17, Math.max(a[1], b[1])]; })();
      for (const info of homes) {
        plan.homes.push({ kind: 'home', door: record(rr, ox, oz, info.door), outside: record(rr, ox, oz, info.outside), inside: record(rr, ox, oz, info.inside), beds: info.beds.map(p => recordF(rr, ox, oz, p)), seats: info.seats.map(p => recordF(rr, ox, oz, p)), work: [], chimney: null, table: record(rr, ox, oz, info.table), lights: info.lights.map(p => record(rr, ox, oz, p)), box, F, r: rr, w, d, ox, oz, hall: true, loggia: true });
      }
      lg.homes = homes.length;
    }
    yield;

    // ================================================================ the plaza: the fountain in its basin, café tables, benches, lamps, planters
    for (let du = -5; du <= 5; du++) for (let dv = -5; dv <= 5; dv++) {
      const d = Math.hypot(du, dv); if (d > 4.6) continue;
      if (d > 3.6) { P(du, F + 1, dv, SMOOTH); continue; }
      P(du, F, dv, MAT.plaza); P(du, F + 1, dv, 'water');
    }
    putModel(P, 'vm_town_fountain', 0, -1, F + 1, -1);
    plan.plaza = { x: cx, y: F + 1, z: cz, r: H.PR, seats: [], stalls: [] };
    // benches round the basin (facing it), lamps on the diagonals, planters between
    // (the benches stand off the street's and the cross street's axes, facing the fountain)
    for (const [du, dv, f] of [[-3, -7, 2], [3, -7, 2], [-3, 7, 0], [3, 7, 0]]) { P(du, F + 1, dv, 'vx_bench', { facing: f }); const [x, z] = W2(du, dv); plan.plaza.seats.push([x, F + 1, z, L.facing(f)]); }
    for (const [du, dv] of [[-8, -8], [8, -8], [-8, 8], [8, 8]]) { putModel(P, 'vm_town_lamp', 0, du, F + 1, dv); const [x, z] = W2(du, dv); plan.lamps.push([x, F + 4, z]); }
    for (const [du, dv] of [[-6, -3], [6, -3], [-6, 3], [6, 3]]) putModel(P, 'vm_planter', 0, du, F + 1, dv);
    // the café's tables: a ring on the plaza's diagonals and terraces in front of the corner houses
    const cafeSeats = [];
    // the café's terrace on the street in front of its house (the street's edge; five blocks stay free to walk)
    for (const h of houses) {
      if (!h.lot || h.lot.kind !== 'cafe') continue;
      for (const vt of [h.vlo + 3, h.vlo + 8]) {
        const ut = h.side * 3;
        if (getC(ut, vt) !== C.STREET) continue;
        putModel(P, 'vm_shop_table_marble', 0, ut, F + 1, vt);
        for (const [dv, f] of [[-1, 2], [1, 0]]) { putModel(P, 'vm_shop_chair_bentwood', f, ut, F + 1, vt + dv); const [x, z] = W2(ut, vt + dv); cafeSeats.push([x, F + 1, z, L.facing(f)]); }
      }
    }
    const table = (du, dv, chairs) => {
      if (getC(du, dv) !== C.PLAZA) return;
      putModel(P, 'vm_shop_table_marble', 0, du, F + 1, dv);
      for (const [cu, cv, f] of chairs) { if (getC(du + cu, dv + cv) !== C.PLAZA) continue; putModel(P, 'vm_shop_chair_bentwood', f, du + cu, F + 1, dv + cv); const [x, z] = W2(du + cu, dv + cv); cafeSeats.push([x, F + 1, z, L.facing(f)]); }
    };
    // (a chair's facing points at its table: the chair at −u faces +u = 1 …)
    const two = [[-1, 0, 1], [1, 0, 3]], twoV = [[0, -1, 2], [0, 1, 0]];
    for (const [du, dv, ch] of [[-10, -6, two], [10, -6, two], [-10, 6, two], [10, 6, two], [-5, -10, twoV], [5, -10, twoV], [-5, 10, twoV], [5, 10, twoV], [-14, -10, two], [14, -10, two], [-19, -10, two], [19, -10, two], [-14, 10, two], [14, 10, two]]) table(du, dv, ch);
    yield;

    // ================================================================ street lamps every eight blocks, lanterns on the piers and under the arches
    for (let v = -72; v <= 40; v += 8) {
      if (Math.abs(v) <= H.PV) continue;
      for (const s of [-1, 1]) { putModel(P, 'vm_town_lamp', 0, s * 4, F + 1, v); const [x, z] = W2(s * 4, v); plan.lamps.push([x, F + 4, z]); }
    }
    for (let k = -8; k <= 4; k++) {
      const vp = 10 * k + 5; if (vp < H.V0 + 3 || vp > H.V1) continue;
      for (const s of [-1, 1]) { putModel(P, 'vm_wall_lantern', s > 0 ? 3 : 1, s * 26, F + 10, vp); if (k % 2 === 0) { const vm = vineMask(r, s, 0); for (let y = F + 5; y <= F + 9; y++) P(s * 26, y, vp + 1, 'vines', { faces: vm }); } }
    }
    for (let k = -7; k <= 4; k++) for (const s of [-1, 1]) { P(s * 28, F + H.ARC + 3, 10 * k, 'lantern', { hanging: 1 }); const [x, z] = W2(s * 28, 10 * k); plan.lamps.push([x, F + H.ARC + 3, z]); }
    yield;

    // ================================================================ the market in the aisles: stalls at the piers, barrels and crates, potted plants
    const stalls = [];
    for (let k = -7; k <= 4; k++) {
      const vp = 10 * k + 5; if (Math.abs(vp) <= 6 || vp < H.V0 + 6 || vp > H.V1 - 2) continue;
      for (const s of [-1, 1]) {
        putModel(P, 'vm_town_stall_' + (((k + (s > 0 ? 1 : 0)) & 1) ? 'teal' : 'amber'), s > 0 ? 1 : 3, s > 0 ? H.A0 : -H.STALL1, F + 1, vp - 1);
        const [x, z] = W2(s * (H.STALL1 + 1), vp); stalls.push([x, F + 1, z, L.facing(s > 0 ? 1 : 3)]);
        // barrels and crates at the walk's edge by the arcade, a potted plant
        const bv = vp + 3; if (getC(s * 31, bv) === C.STALL) { P(s * 31, F + 1, bv, rng.chance(0.5) ? 'vx_barrel' : 'vx_crate'); if (rng.chance(0.5)) P(s * 31, F + 2, bv, 'vx_crate'); }
        if (getC(s * 30, vp - 3) === C.STALL) putModel(P, 'vm_planter', 0, s * 30, F + 1, vp - 3);
      }
    }
    plan.plaza.stalls = stalls;
    // the market's workplace (the stall keepers) and the café (its seats are the plaza's tables)
    { const sp = stalls[0] || [cx, F + 1, cz, 0]; plan.work.push({ kind: 'market', door: sp.slice(0, 3), outside: sp.slice(0, 3), inside: sp.slice(0, 3), beds: [], seats: [], work: [['till', sp[0], sp[1], sp[2]]], chimney: null, table: null, lights: [], box: null, stalls: stalls.map(s => s.slice()) }); }
    const cafe = plan.work.find(w0 => w0.kind === 'cafe');
    if (cafe) cafe.seats = cafeSeats.slice();
    yield;

    // ================================================================ the forecourt, the yards' details, the paths out of the gates
    for (const [du, f] of [[-8, 0], [8, 0]]) P(du, F + 1, H.V0 + 6, 'vx_bench', { facing: f });
    for (const du of [-14, -4, 4, 14]) putModel(P, 'vm_planter', 0, du, F + 1, H.V0 + 5);
    for (const s of [-1, 1]) {
      // from the gate out over the apron: a paved path seven wide, then a ramp to the land (one block up or down at a time)
      const t0 = H.HW + 1, LEN = 26;
      const endY = gl(s * (t0 + LEN), 0);
      for (let t = 0; t <= LEN; t++) for (let dv = -3; dv <= 3; dv++) {
        const u = s * (t0 + t), y = t <= 6 ? F : Math.round(F + (endY - F) * Math.min(1, (t - 6) / Math.max(1, LEN - 6)));
        const [x, z] = W2(u, dv), gy = ground(x, z);
        fill(x, z, Math.min(gy, y) - 2, y - 1, st(Math.abs(dv) === 3 ? 'smooth_quartz' : 'stone'));
        fill(x, z, y + 1, Math.max(y + 4, gy + 2), AIR);
        put(x, y, z, Math.abs(dv) === 3 ? SMOOTH : (M.hash2(x, z, 934) & 7) === 0 ? MAT.street2 : MAT.lane);
      }
      for (const dv of [-4, 4]) { putModel(P, 'vm_town_lamp', 0, s * (t0 + 4), F + 1, dv); const [x, z] = W2(s * (t0 + 4), dv); plan.lamps.push([x, F + 4, z]); }
    }
    yield;

    // ================================================================ the plan's records: strolling routes, the villager budget, the hall's frame
    const route = (pts) => pts.map(([u, v, y]) => { const [x, z] = W2(u, v); return [x, F + 1 + (y || 0), z]; });
    const line = (u0, v0, u1, v1, step) => { const out = [], n = Math.max(1, Math.round(Math.hypot(u1 - u0, v1 - v0) / (step || 3))); for (let i = 0; i <= n; i++) out.push([Math.round(u0 + (u1 - u0) * i / n), Math.round(v0 + (v1 - v0) * i / n)]); return out; };
    plan.roads.push(route(line(0, -76, 0, 40)), route(line(-24, -76, -24, 48)), route(line(24, -76, 24, 48)), route(line(-35, -76, -35, 50)), route(line(35, -76, 35, 50)), route(line(-48, 0, 48, 0)));
    let walk = 0;
    for (let i = 0; i < grid.length; i++) if (WALKABLE.has(grid[i])) walk++;
    const nHomes = plan.homes.length;
    plan.folkCap = { walk, homes: nHomes, perWalk: 9, perHome: 2, max: Math.floor(walk / 9) + 2 * nHomes };
    plan.hall = { cx, cz, r, F, HW: H.HW, V0: H.V0, V1: H.V1, houses: houses.map(h => ({ side: h.side, vlo: h.vlo, vhi: h.vhi, lot: h.lot })), loggias: loggias.map(l => ({ k: l.k, s: l.s, homes: l.homes })), grid, gv0: GV0, gw: GW };
    plan.center = [cx, F + 1, cz];
    plan.chunks = chunks;
    return plan;
  };
})(VR);

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
// Round 2, "the splendour" (docs/superpowers/plans/2026-10-08-t-town2.md; test/hallcity_ornament.js): every façade in
// relief — a plinth, pilasters at the bay edges, a cornice of upside-down stairs at every storey, the three-wide arched
// wood windows (vm_town_arch3) under stepped hoods with keystones, a balcony, flower boxes and vines; the ground floor a
// wood storefront with sills, two awnings and the shop's word sign (vm_town_word_*: the trade's word in the player's
// language); half of the three-storey houses a parapet instead of the gable; the corner houses' plaza sides alike. The
// grand staircase in four flights with three landings, parapets with balusters, a rail and newels, columns at its foot
// and head; the gallery closed, niches with lanterns in the apse wall. A market stall every 7 blocks along both aisles
// with a lantern on a bracket, barrels, a bench and a plant, oak ribs and tie beams under the aisle vaults, wooden arches
// under the nave's ribs. Outside: a portal in the entrance end, tracery, cornice bands, a plinth, pinnacles, a parapet,
// oculi and lantern turrets on the ridge.
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
    GAL: 8, STAIR0: 38, GAL0: 50, STW: 6,                       // the gallery's height, the stair's first step (v), the gallery's front edge (v), the stair's half width
    GLASS: 26, AGL0: 32, AGL1: 45,                              // the vault's glass panels |u| ≤ 26, to the springing (the half dome's d ≤ 26), the aisle vaults' 32–45 (to the wall)
    LOT: { w: 12, d: 18, house: 12 },                           // a shop house's lot: 12 along the street, 18 deep (front 2, house 12, yard 4)
    RAD: 112, VGEN: 9,
  };
  VG.hallOn = (g) => !!(g && g.vgen >= H.VGEN);
  VG.hallFrame = (site) => (site.seed >>> 3) & 3;
  // the sky over a hall city stays clear: no floating island over it (vgen 9). The light engine's sky light falls straight
  // down a column (light_local.js), so an island anywhere over the hall shut its light off below — run 3's apse and the
  // vault over the plaza were black under seed 53's islands, whose bottoms hung 2 blocks over the roof (and one floated
  // on the roof seen from outside). An island cell whose island could reach within the hall's radius of a hall city's
  // centre holds no island; the site cells it asks are the ones a chunk job computes first (VG.cellNeeds: the 3 × 3
  // around the chunk), and the answer is kept per island cell. The far views read the same cells (far.js, lod.js).
  VG.hallSkyClear = function (g, I) {
    const C = VG.cell(g), reach = H.RAD + I.r * 1.4 + 8;
    for (let j = Math.floor((I.z - reach) / C); j <= Math.floor((I.z + reach) / C); j++) for (let i = Math.floor((I.x - reach) / C); i <= Math.floor((I.x + reach) / C); i++) {
      const s = VG.site(g, i, j);
      if (s && s.style === 'hall' && (s.x - I.x) * (s.x - I.x) + (s.z - I.z) * (s.z - I.z) < reach * reach) return true;
    }
    return false;
  };
  const OGp = VR.OverworldGen && VR.OverworldGen.prototype;
  if (OGp && OGp.islandCell && !OGp.islandCell.hallSky) {
    const prevCell = OGp.islandCell;
    OGp.islandCell = function (i, j) {
      const I = prevCell.call(this, i, j);
      if (!I || !(this.vgen >= H.VGEN) || this.singleBiome >= 0) return I;
      const memo = this._hallSky || (this._hallSky = new Map()), key = (i + 1048576) * 2097152 + (j + 1048576);
      let clear = memo.get(key);
      if (clear === undefined) { if (memo.size > 4000) memo.clear(); clear = VG.hallSkyClear(this, I); memo.set(key, clear); }
      return clear ? null : I;
    };
    OGp.islandCell.hallSky = true;
  }
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
        if (v === H.GAL0 && a <= H.STW) c = C.STAIR;                       // (the stair's last step cut into the gallery's front)
        else if (v > H.V1 || (v >= H.GAL0 && a <= 26)) c = C.GALLERY;
        else if (a >= H.P0 && a <= H.P1) c = C.LANE;   // (the arcade loop below marks its piers)
        else if (a >= H.A0) c = Math.abs(v) <= 3 ? C.CROSS : (a <= H.STALL1 ? C.STALL : a <= H.WK1 ? C.WALK : C.LOGGIA);
        else if (v <= H.V0 + 8) c = C.FORE;
        else if (v >= H.STAIR0 && v < H.GAL0) c = a <= H.STW ? C.STAIR : a <= H.STW + 1 ? C.WALL : C.LANE;
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
        if (a >= H.AGL0 && a <= H.AGL1) return !ribV(v) && a !== 35 && a !== 41 && v <= H.V1 - 1 && v >= H.V0 + 3;   // (ribs at 35 and 41; to the wall: the strip over the loggias was black where a chunk border cut it off)
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
        if (reg === 'in' && v <= H.V1 && Math.abs(u) <= 26 && (((v - 5) % 10) + 10) % 10 === 0) { put(x, F + lo - 1, z, BAND); P(u, F + lo - 2, v, 'vx_beam_oak', { axis: 1 }); }   // (round 2: a wood-brown arch under the gold rib, the reference's wooden arches)
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
    // the outer long walls: a tall window in every bay (a mullion in the middle), the stained round head over F + 16
    // (round 2b: two blocks taller, and framed outside — pilaster jambs, an arched hood of stone stepping round the head
    // with a gold keystone, a sill)
    for (let k = -7; k <= 4; k++) {
      if (k === 0) continue;
      yield;
      const vc = 10 * k, win = archWin(2, 5, 16, 2.6);
      for (const s of [-1, 1]) {
        for (let t = -2; t <= 2; t++) for (let y = 5; y <= 20; y++) {
          const w = win(t, y); if (!w) continue;
          for (let a = H.W0; a <= H.HW; a++) {
            const mid = a === 47;
            let b = AIR;
            if (mid) b = w === 's' ? (t === 0 ? SG.gold : Math.abs(t) === 1 ? SG.blue : SG.lblue) : ((t === 0 && y < 16) || y === 10 ? CHIS : GLASS);   // (the tracery: a stone cross)
            P(s * a, F + y, vc + t, b);
          }
        }
        const o = s * (H.HW + 1), fo = s > 0 ? 3 : 1;
        for (const t of [-3, 3]) { for (let y = F + 5; y <= F + 15; y++) P(o, y, vc + t, 'quartz_pillar', { axis: 0 }); P(o, F + 16, vc + t, CHIS); P(o, F + 17, vc + t, SMOOTH); }
        for (const t of [-2, 2]) P(o, F + 18, vc + t, 'smooth_quartz_stairs', { facing: fo, half: 1 });
        for (const t of [-1, 1]) P(o, F + 19, vc + t, 'smooth_quartz_stairs', { facing: fo, half: 1 });
        P(o, F + 19, vc, BAND); P(o, F + 20, vc, CHIS);
        for (let t = -3; t <= 3; t++) P(o, F + 4, vc + t, 'smooth_quartz_slab', { type: 'top' });
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
      // (round 2b) a portico two blocks proud before the gate: two columns on plinths with capitals, a gold entablature, a
      // gabled pediment with a raking cornice and a finial, lanterns on the columns' outer faces
      const o = s * (H.HW + 2);
      for (const t of [-5, 5]) {
        P(o, F + 1, t, SMOOTH); for (let y = F + 2; y <= F + 11; y++) P(o, y, t, 'quartz_pillar', { axis: 0 }); P(o, F + 12, t, CHIS);
        putModel(P, 'vm_wall_lantern', s > 0 ? 1 : 3, s * (H.HW + 3), F + 7, t); const [x, z] = W2(s * (H.HW + 3), t); plan.lamps.push([x, F + 7, z]);
      }
      for (let t = -6; t <= 6; t++) P(o, F + 13, t, BAND);
      for (let i = 0; i <= 6; i++) for (let t = -(6 - i); t <= 6 - i; t++) {
        const edge = Math.abs(t) === 6 - i;
        P(o, F + 14 + i, t, edge && i < 6 ? 'smooth_quartz_stairs' : (i === 6 ? CHIS : SMOOTH), edge && i < 6 ? { facing: t < 0 ? 2 : 0, half: 0 } : undefined);
      }
      P(o, F + 21, 0, BAND); P(o, F + 22, 0, 'quartz_pillar', { axis: 0 });
    }
    yield;
    // the entrance end: a giant arched window over the nave (mullions every 4, transoms, a stained head of rays and a ring)
    for (let u = -13; u <= 13; u++) for (let y = 6; y <= 38; y++) {
      if (Math.abs(u) <= 5 && y < 12) continue;   // (the portal's place under it)
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
    // the portal in the entrance end (round 2): a seven-wide pointed arch through the wall under the giant window, a gold
    // archivolt, two orders stepping out from the wall (one and two blocks proud), a gold course over it as the window's sill
    {
      const soffit = (t) => [9, 8, 7, 6][Math.abs(t)];
      const open = new Set();
      for (let t = -3; t <= 3; t++) for (let y = 1; y < soffit(t); y++) { open.add(t + ',' + y); for (let vv = H.V0; vv <= H.V0 + 2; vv++) P(t, F + y, vv, AIR); }
      for (let t = -3; t <= 3; t++) P(t, F + soffit(t), H.V0, BAND);
      const near = (t, y, k) => { for (let dt = -k; dt <= k; dt++) for (let dy = -k; dy <= k; dy++) if (open.has((t + dt) + ',' + (y + dy))) return true; return false; };
      for (let t = -6; t <= 6; t++) for (let y = 1; y <= 11; y++) {
        if (open.has(t + ',' + y)) continue;
        if (near(t, y, 1)) P(t, F + y, H.V0 - 1, y === 1 ? SMOOTH : SMOOTH);
        else if (near(t, y, 2)) { P(t, F + y, H.V0 - 1, STONE); P(t, F + y, H.V0 - 2, y === 1 ? SMOOTH : STONE); }
      }
      for (let t = -6; t <= 6; t++) P(t, F + 12, H.V0, BAND);
      for (let t = -3; t <= 3; t++) P(t, F, H.V0 - 1, MAT.fore);
      setC(0, H.V0, C.FORE);
    }
    // the oculi: a round window over each aisle's end window, at both ends
    for (const [vv0, vv1] of [[H.V0, H.V0 + 2], [H.V1 + 1, H.VE]]) for (const s of [-1, 1]) {
      const uc = s * 36, yc = 21, mid = vv0 === H.V0 ? H.V0 + 1 : H.V1 + 2, outer = vv0 === H.V0 ? H.V0 : H.VE;
      for (let t = -3; t <= 3; t++) for (let y = yc - 3; y <= yc + 3; y++) {
        const d = Math.hypot(t, y - yc);
        if (d <= 1.7) for (let vv = vv0; vv <= vv1; vv++) P(uc + t, F + y, vv, vv === mid ? (d < 0.6 ? SG.gold : SG.white) : AIR);
        else if (d <= 2.6) P(uc + t, F + y, outer, BAND);
      }
    }
    // the cornice band outside: upside-down stairs along the long walls under the aisle roof's glass and along the
    // clerestory under the vault's; a plinth course of slabs at the walls' foot
    for (let v = H.V0; v <= H.VE; v++) for (const s of [-1, 1]) {
      P(s * (H.HW + 1), F + H.WALLTOP, v, 'smooth_quartz_stairs', { facing: s > 0 ? 3 : 1, half: 1 });
      if (v >= H.V0 + 3 && v <= H.V1) P(s * H.A0, F + H.SPR, v, 'smooth_quartz_stairs', { facing: s > 0 ? 3 : 1, half: 1 });
      if (Math.abs(v) > 3) P(s * (H.HW + 1), F + 1, v, 'smooth_quartz_slab', { type: 'bottom' });
    }
    // a balustrade along the long walls' top over the cornice, and a pinnacle on every buttress (white shaft, a capital, a
    // gold cap)
    for (let v = H.V0; v <= H.VE; v++) for (const s of [-1, 1]) P(s * H.HW, F + H.WALLTOP + 1, v, 'vx_balustrade');
    for (let k = -8; k <= 4; k++) {
      const vp = 10 * k + 5; if (vp < H.V0 + 2 || vp > H.V1) continue;
      for (const s of [-1, 1]) { for (let y = F + 22; y <= F + 24; y++) P(s * (H.HW + 1), y, vp, 'quartz_pillar', { axis: 0 }); P(s * (H.HW + 1), F + 25, vp, 'chiseled_quartz_block'); P(s * (H.HW + 1), F + 26, vp, BAND); }
    }
    // lantern turrets on the ridge every 24 blocks (round 2b: five wide, were three): a glazed lantern on four white
    // posts over a white base, a cornice, a stepped glass cap, a gold-banded dome and a finial; the base's middle and the
    // cap glass, so the sky light still falls through into the street
    const T0 = F + H.TOP;
    for (const vt of [-60, -36, -12, 12, 36]) {
      for (let du = -2; du <= 2; du++) for (let dv = -2; dv <= 2; dv++) {
        const ad = Math.abs(du), av = Math.abs(dv), corner = ad === 2 && av === 2, ring = ad === 2 || av === 2, v = vt + dv;
        P(du, T0 + 1, v, ring ? SMOOTH : GLASS);
        for (let y = T0 + 2; y <= T0 + 5; y++) P(du, y, v, corner ? 'quartz_pillar' : ring ? 'white_stained_glass' : (du === 0 && dv === 0 && y === T0 + 2 ? 'lantern' : AIR), corner ? { axis: 0 } : (du === 0 && dv === 0 && y === T0 + 2 ? { hanging: 0 } : undefined));
        P(du, T0 + 6, v, ring ? 'smooth_quartz_slab' : FROST, ring ? { type: 'bottom' } : undefined);
        if (!ring) P(du, T0 + 7, v, ad + av === 0 ? CHIS : FROST);
      }
      P(0, T0 + 8, vt, BAND); P(0, T0 + 9, vt, 'quartz_pillar', { axis: 0 }); P(0, T0 + 10, vt, 'quartz_pillar', { axis: 0 }); P(0, T0 + 11, vt, 'lantern', { hanging: 0 });
      const [x, z] = W2(0, vt); plan.lamps.push([x, T0 + 2, z]);
    }
    // the cupola over the crossing (round 2b): an octagonal glazed drum nine across on the ridge over the plaza, white
    // posts at its corners, a cornice, a dome of frosted glass in three courses, a gold eye, a lantern finial — the hall's
    // crown from outside; glass all through, so the plaza keeps its sky light
    {
      const oct = (du, dv, rr) => Math.max(Math.abs(du), Math.abs(dv)) === rr && !(Math.abs(du) === rr && Math.abs(dv) === rr);
      for (let du = -4; du <= 4; du++) for (let dv = -4; dv <= 4; dv++) {
        if (!oct(du, dv, 4)) continue;
        const post = (Math.abs(du) === 4 && Math.abs(dv) === 3) || (Math.abs(du) === 3 && Math.abs(dv) === 4);
        for (let y = F + hN(Math.abs(du)) + 1; y <= T0; y++) P(du, y, dv, SMOOTH);   // (closing the gap over the vault's flanks)
        P(du, T0 + 1, dv, SMOOTH);
        for (let y = T0 + 2; y <= T0 + 6; y++) P(du, y, dv, post ? 'quartz_pillar' : GLASS, post ? { axis: 0 } : undefined);
        P(du, T0 + 7, dv, post ? CHIS : 'smooth_quartz_slab', post ? undefined : { type: 'bottom' });
      }
      for (let k = 3; k >= 1; k--) for (let du = -k; du <= k; du++) for (let dv = -k; dv <= k; dv++) if (oct(du, dv, k) || (k === 1 && Math.max(Math.abs(du), Math.abs(dv)) === 1)) P(du, T0 + 11 - k, dv, FROST);
      P(0, T0 + 10, 0, BAND); P(0, T0 + 11, 0, CHIS); P(0, T0 + 12, 0, 'lantern', { hanging: 0 }); P(0, T0 + 13, 0, 'quartz_pillar', { axis: 0 });
      const [x, z] = W2(0, 0); plan.lamps.push([x, T0 + 12, z]);
    }
    // the aisles' end windows (both ends) and the apse's five lancets over the gallery
    for (const vv of [[H.V0, H.V0 + 1, H.V0 + 2], [H.V1 + 1, H.V1 + 2, H.VE]]) for (const s of [-1, 1]) {
      const win = archWin(2, 6, 15, 2.6);
      for (let t = -2; t <= 2; t++) for (let y = 6; y <= 18; y++) { const w = win(t, y); if (!w) continue; for (const v of vv) P(s * (36 + t), F + y, v, v === vv[1] ? (w === 's' ? SG.gold : GLASS) : AIR); }
    }
    yield;
    // (round 2b) the great window over the staircase: the apse wall straight down the nave glazed nine wide from the
    // gallery's head height to a round head — two stone mullions, a transom, a stained head of rays in a ring round a gold
    // eye: the bright end of the hall the references look into (it takes the middle lancet's place)
    {
      const yc = 24, rad = 4.6;
      for (let u = -4; u <= 4; u++) for (let v = H.V1 + 25; v <= H.V1 + 30; v++) {
        const dd = Math.hypot(u, v - H.V1); if (region(u, v) !== 'wall') continue;
        const mid = Math.abs(dd - 28) < 0.75;
        for (let y = 10; y <= 29; y++) {
          const hd = y >= yc ? Math.hypot(u, y - yc + 0.5) : 0;
          if (y >= yc && hd > rad) continue;
          let b = AIR;
          if (mid) {
            if (y < yc) b = (Math.abs(u) === 2 || y === 17) ? SMOOTH : (y >= yc - 2 ? SG.lblue : GLASS);
            else { const a = Math.atan2(y - yc + 0.5, u), kk = Math.floor(a / (Math.PI / 6)); b = hd < 1.3 ? SG.amber : hd > rad - 1.1 ? SG.rose : (kk & 1) ? SG.blue : SG.gold; }
          }
          P(u, F + y, v, b);
        }
      }
    }
    for (let k = 1; k <= 5; k++) {
      if (k === 3) continue;   // (round 2b: the great window above)
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
    // ---- the grand staircase (round 2: the reference's flights and landings): thirteen wide, four flights of two steps with
    // landings at 2, 4 and 6, the last step cut into the gallery's front; parapets of white stone stepping with it, a
    // balustrade on them under a slab rail, newels with lanterns at the landings, columns flanking its foot and its head
    const stairH = (v) => v < H.STAIR0 ? 0 : v >= H.GAL0 + 1 ? H.GAL : [1, 2, 2, 2, 3, 4, 4, 4, 5, 6, 6, 6, 7][v - H.STAIR0];
    H.stairH = stairH;
    for (let v = H.STAIR0; v <= H.GAL0; v++) {
      const h = stairH(v), step = h > stairH(v - 1);
      for (let u = -H.STW; u <= H.STW; u++) {
        if (h > 1) FL(u, v, F + 1, F + h - 1, STONE);
        P(u, F + h, v, step ? 'quartz_stairs' : (Math.abs(u) <= H.STW - 2 ? 'travertine' : 'smooth_quartz'), step ? { facing: 2, half: 0 } : undefined);   // (the landings: a warm field in a white border)
        for (let y = F + h + 1; y <= F + H.GAL + 3; y++) P(u, y, v, null);
        setC(u, v, C.STAIR);
      }
      for (const s of [-1, 1]) {
        const u = s * (H.STW + 1), newel = v === H.STAIR0 + 3 || v === H.STAIR0 + 7 || v === H.STAIR0 + 11;
        FL(u, v, F + 1, F + h, SMOOTH);
        if (newel) { P(u, F + h + 1, v, 'quartz_pillar', { axis: 0 }); P(u, F + h + 2, v, 'quartz_pillar', { axis: 0 }); P(u, F + h + 3, v, 'lantern', { hanging: 0 }); const [x, z] = W2(u, v); plan.lamps.push([x, F + h + 3, z]); }
        else { P(u, F + h + 1, v, 'vx_balustrade'); P(u, F + h + 2, v, 'smooth_quartz_slab', { type: 'bottom' }); }
        setC(u, v, C.WALL);
      }
    }
    // the columns flanking the staircase, at its foot and where it meets the gallery: white pillars up to the gallery's
    // rail, a capital, a lantern on top
    for (const s of [-1, 1]) for (const v of [H.STAIR0 + 1, H.GAL0 - 1]) {   // (the foot's pair beside the first flight: the north houses' eaves overhang the stair's first row)
      const u = s * (H.STW + 2);
      P(u, F + 1, v, SMOOTH); for (let y = F + 2; y <= F + 10; y++) P(u, y, v, 'quartz_pillar', { axis: 0 }); P(u, F + 11, v, 'chiseled_quartz_block'); P(u, F + 12, v, 'lantern', { hanging: 0 });
      const [x, z] = W2(u, v); plan.lamps.push([x, F + 12, z]);
    }
    // (round 2b) newel pedestals at the stair's foot: a plinth, a shaft and a capital ending the parapets, a lantern on
    // each — the warm light at the foot of the flight
    for (const s of [-1, 1]) {
      const u = s * (H.STW + 1), v = H.STAIR0;
      P(u, F + 1, v, SMOOTH); P(u, F + 2, v, 'quartz_pillar', { axis: 0 }); P(u, F + 3, v, 'chiseled_quartz_block'); P(u, F + 4, v, 'lantern', { hanging: 0 });
      const [x, z] = W2(u, v); plan.lamps.push([x, F + 4, z]);
    }
    // the gallery's front: pilasters between round-arched doorways four high (round 2b: were niches three high) — a wooden
    // door in a wooden tympanum at the back, a lantern hanging in the arch, a keystone over it — and a cornice of
    // upside-down stairs along the front under the gallery's balustrade
    for (const s of [-1, 1]) {
      for (const a of [14, 20]) { const u = s * a; for (let y = F + 1; y <= F + 7; y++) P(u, y, H.GAL0 - 1, 'quartz_pillar', { axis: 0 }); P(u, F + 8, H.GAL0 - 1, 'chiseled_quartz_block'); }
      for (let a = 9; a <= 26; a++) if (a !== 14 && a !== 20 && region(s * a, H.GAL0 - 1) === 'in') P(s * a, F + H.GAL, H.GAL0 - 1, 'smooth_quartz_stairs', { facing: 2, half: 1 });
      for (const a of [11, 17, 23]) {
        const uc = s * a;
        for (let t = -1; t <= 1; t++) for (let y = F + 1; y <= F + 4; y++) P(uc + t, y, H.GAL0, null);
        P(uc - 1, F + 4, H.GAL0, 'smooth_quartz_stairs', { facing: 3, half: 1 }); P(uc + 1, F + 4, H.GAL0, 'smooth_quartz_stairs', { facing: 1, half: 1 });
        P(uc, F + 5, H.GAL0 - 1, 'chiseled_quartz_block');
        for (let t = -1; t <= 1; t++) for (let y = F + 1; y <= F + 4; y++) if (t !== 0 || y >= F + 3) P(uc + t, y, H.GAL0 + 1, 'spruce_planks');
        P(uc, F + 1, H.GAL0 + 1, 'spruce_door', { facing: 0, half: 0, hinge: 0, open: 0 }); P(uc, F + 2, H.GAL0 + 1, 'spruce_door', { facing: 0, half: 1, hinge: 0, open: 0 });
        P(uc, F + 4, H.GAL0, 'lantern', { hanging: 1 }); const [x, z] = W2(uc, H.GAL0); plan.lamps.push([x, F + 4, z]);
      }
    }
    // the gallery closed: a balustrade along every edge of its floor that drops to the hall (the stair's arrival open)
    for (let v = H.GAL0; v <= 80; v++) for (let u = -26; u <= 26; u++) {
      if (getC(u, v) !== C.GALLERY || region(u, v) !== 'in') continue;
      let edge = false;
      for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const c2 = getC(u + du, v + dv), r2 = region(u + du, v + dv); if (r2 === 'in' && c2 !== C.GALLERY && c2 !== C.STAIR && c2 !== C.WALL) edge = true; }
      if (edge) P(u, F + H.GAL + 1, v, 'vx_balustrade');
    }
    // (round 2b) posts with lanterns in the gallery's balustrade over the pilaster lines; vines falling from the gallery's
    // cornice between the doorways; potted plants on the landings' outer corners
    for (const s of [-1, 1]) {
      for (const a of [14, 20, 26]) { P(s * a, F + H.GAL + 1, H.GAL0, CHIS); P(s * a, F + H.GAL + 2, H.GAL0, 'lantern', { hanging: 0 }); const [x, z] = W2(s * a, H.GAL0); plan.lamps.push([x, F + H.GAL + 2, z]); }
      const vm = vineMask(r, 0, 1);
      for (const [a, len] of [[9, 3], [13, 4], [19, 4], [25, 3]]) for (let y = F + H.GAL - 1; y >= F + H.GAL - len; y--) P(s * a, y, H.GAL0 - 1, 'vines', { faces: vm });
      for (const v of [H.STAIR0 + 2, H.STAIR0 + 6, H.STAIR0 + 10]) putModel(P, 'vm_planter', 0, s * H.STW, F + stairH(v) + 1, v);
    }
    // arched niches in the apse wall over the gallery, between the lancets, each with a lantern
    for (let k = 0; k < 6; k++) {
      const th = (k + 0.5) * Math.PI / 6, cs = Math.cos(th), sn = Math.sin(th);
      for (let t = -1; t <= 1; t++) {
        let uu = 0, vv = 0, ok = false;
        for (let rr = H.AR - 1; rr <= H.AW && !ok; rr += 0.5) { uu = Math.round(cs * rr - sn * t); vv = Math.round(H.V1 + sn * rr + cs * t); ok = region(uu, vv) === 'wall'; }
        if (!ok) continue;
        for (let y = F + H.GAL + 1; y <= F + H.GAL + 3 + (t === 0 ? 1 : 0); y++) P(uu, y, vv, null);
        P(uu, F + H.GAL + 5, vv, BAND);
        if (t === 0) { P(uu, F + H.GAL + 1, vv, 'lantern', { hanging: 0 }); const [x, z] = W2(uu, vv); plan.lamps.push([x, F + H.GAL + 1, z]); }
      }
    }
    const galSeats = [];
    for (const uc of [-18, -12, 12, 18]) { P(uc, F + H.GAL + 1, H.GAL0 + 3, 'vx_bench', { facing: 0 }); const [x, z] = W2(uc, H.GAL0 + 3); galSeats.push([x, F + H.GAL + 1, z, L.facing(0)]); }
    for (const [uc, vc] of [[-22, 56], [22, 56], [-12, 68], [12, 68], [0, 74]]) if (region(uc, vc) === 'in') putModel(P, 'vm_planter', 0, uc, F + H.GAL + 1, vc);
    P(0, F + H.GAL + 1, 64, 'bell', { facing: 0 });
    { const [x, z] = W2(0, 64); plan.bell = [x, F + H.GAL + 1, z]; }
    // the council (the town's hall, the mayor's place) on the gallery
    { const [x, z] = W2(0, 58), [ix, iz] = W2(0, 56), [ox, oz] = W2(0, H.GAL0 - 2); plan.work.push({ kind: 'hall', door: [ix, F + H.GAL + 1, iz], outside: [ox, F + 1, oz], inside: [ix, F + H.GAL + 1, iz], beds: [], seats: galSeats, work: [['council', x, F + H.GAL + 1, z]], chimney: null, table: null, lights: [], box: null }); }
    yield;

    // ================================================================ the shop houses
    const SHOPS = ['bakery', 'market', 'library', 'bakery', 'market', 'library', 'bakery', 'market', 'bakery', 'market', 'library'];
    const SIGN = { bakery: 'bread', cafe: 'cup', market: 'flower', library: 'book' };
    // the trade of a shop (round 2): its word on the sign (voxtown.js, town.sign.*) and what stands behind its glass — the
    // work kind and so the keeper's role stay (the folk and their budget do not change)
    const TRADES = { bakery: ['baker', 'sweets', 'tea', 'cheese'], market: ['flowers', 'tailor', 'pharmacy', 'lanterns'], library: ['books', 'workshop', 'maps'], cafe: ['cafe'] };
    const tradeN = { bakery: 0, market: 0, library: 0, cafe: 0 };
    // [the back wall's shelf, the goods in the shop window (on a wooden podium, behind the glass)]
    const WARES = { baker: ['vx_shop_shelf_bakery', 'vx_shop_bakery_case'], sweets: ['vx_shop_shelf_sweets', 'vx_shop_shelf_sweets'], tea: ['vx_shop_shelf_drinks', 'vx_potplant'], cheese: ['vx_shop_shelf_dairy', 'vx_shop_deli'],
      flowers: ['vx_shop_shelf_flowers', 'vx_shop_flower_stand'], tailor: ['vx_shop_shelf_home', 'vm_shop_mannequin_dress'], pharmacy: ['vx_shop_shelf_pharmacy', 'vx_shop_shelf_pharmacy'], lanterns: ['vx_shop_shelf_home', 'vx_lantern'],
      books: ['vx_bookshelf', 'vx_bookshelf'], workshop: ['vx_shop_shelf_tech', 'vx_crate'], maps: ['vx_bookshelf', 'cartography_table'], cafe: ['vx_shop_shelf_drinks', 'vx_shop_shelf_drinks'] };
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
      const trade = TRADES[kind][tradeN[kind]++ % TRADES[kind].length];
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
      // ---- the façade (round 2, the owner's "die Häuser nicht wie hier die Bilder"): relief one block proud of the wall.
      // The ground floor a wood storefront between the corner pilasters — two shop windows (riser, glass, sill) under the
      // two striped awnings, the door in the middle under the shop's word sign, lanterns on the corner pilasters; the
      // upper storeys an order of pilasters at the bay edges u 0, 4, 7, 11 with capitals, the outer bays' arched windows
      // under stepped hoods with a keystone, the middle bay a pair of the narrow stained windows (on a third storey the
      // doors of a balcony); a cornice of upside-down stairs at every storey line and under the gable.
      const orng = new VR.RNG(((M.hash2(ox, oz, site.seed + 991) >>> 0) || 1));
      const door = 5, PU = [0, 4, 7, 11];
      for (const u of [1, 2, 3, 8, 9, 10]) { Q(u, F + 1, 0, 'spruce_planks'); Q(u, F + 2, 0, 'glass_pane'); Q(u, F + 3, 0, 'glass_pane'); Q(u, F + 4, 0, 'spruce_planks'); Q(u, F + 1, -1, 'spruce_slab', { type: 'top' }); }
      for (const u of [4, 7]) for (let y = F + 1; y <= F + 4; y++) Q(u, y, 0, 'stripped_spruce_log');
      Q(door, F + 1, 0, 'spruce_door', { facing: 2, half: 0, hinge: 0, open: 0 }); Q(door, F + 2, 0, 'spruce_door', { facing: 2, half: 1, hinge: 0, open: 0 }); Q(door, F + 3, 0, 'glass_pane'); Q(door, F + 4, 0, 'spruce_planks');
      Q(6, F + 1, 0, 'spruce_planks'); Q(6, F + 2, 0, 'glass_pane'); Q(6, F + 3, 0, 'glass_pane'); Q(6, F + 4, 0, 'spruce_planks');
      putModel(Q, 'vm_town_awning_' + awning, 0, 1, F + 3, -2); putModel(Q, 'vm_town_awning_' + awning, 0, 8, F + 3, -2);
      for (const u of [0, w - 1]) { Q(u, F + 1, -1, 'smooth_quartz'); for (let y = F + 2; y <= F + 3; y++) Q(u, y, -1, 'quartz_pillar', { axis: 0 }); Q(u, F + 4, -1, 'chiseled_quartz_block'); putModel(Q, 'vm_wall_lantern', 0, u, F + 3, -2); }
      putModel(Q, 'vm_planter', 0, 6, F + 1, -1);   // (a potted plant beside the door)
      putModel(Q, 'vm_town_word_' + trade, 0, 4, F + 4, -1);   // the shop's word over the door, between the awnings
      // the storeys
      for (let k = 1; k < floors; k++) {
        const y0 = F + 5 * k;
        for (const u of PU) { for (let y = y0 + 1; y <= y0 + 3; y++) Q(u, y, -1, 'quartz_pillar', { axis: 0 }); Q(u, y0 + 4, -1, 'chiseled_quartz_block'); }
        for (const u0 of [1, 8]) {
          putModel(Q, 'vm_town_arch3', 0, u0, y0 + 1, 0);
          Q(u0, y0 + 4, -1, 'smooth_quartz_stairs', { facing: 3, half: 1 }); Q(u0 + 1, y0 + 4, -1, 'chiseled_quartz_block'); Q(u0 + 2, y0 + 4, -1, 'smooth_quartz_stairs', { facing: 1, half: 1 });
        }
        for (const u of [5, 6]) { putModel(Q, 'vm_town_window_' + stain, 0, u, y0 + 1, 0); Q(u, y0 + 4, -1, 'smooth_quartz_slab', { type: 'top' }); }
        // back windows, and the side windows toward a lane or the plaza
        for (const u of [3, 8]) putModel(Q, 'vm_town_window_' + stain, 2, u, y0 + 1, d - 1);
        if (plazaSide < 0 && laneSide >= 0) { const su = laneSide; for (const v of [3, 8]) putModel(Q, 'vm_town_window_' + stain, su === 0 ? 3 : 1, su, y0 + 1, v); }
      }
      for (let k = 1; k <= floors; k++) for (let u = 0; u < w; u++) Q(u, F + 5 * k, -1, 'smooth_quartz_stairs', { facing: 2, half: 1 });
      // a balcony before the middle bay of a third storey: its floor the cornice and a slab row, a balustrade
      if (floors === 3) for (let u = 4; u <= 7; u++) { Q(u, F + 10, -2, 'smooth_quartz_slab', { type: 'top' }); Q(u, F + 11, -2, 'vx_balustrade'); }
      // flower boxes under the arched windows and vines down the corner pilasters on every other house (the café always)
      const vinesOld = floors === 2 ? lrng.chance(0.6) : false;   // (the old draw kept: the beds upstairs stay the same)
      const flowery = (houses.indexOf(hs0) % 2 === 0) || kind === 'cafe';
      if (flowery) {
        const vm = vineMask(rr, 0, 1);
        for (let k = 1; k < floors; k++) for (const u0 of [1, 8]) {
          for (let u = u0; u <= u0 + 2; u++) Q(u, F + 5 * k + 1, -1, 'vx_windowbox', { facing: 0 });
          // a strand of vines spilling from the box's outer end over the cornice (above the awnings and the sign)
          const uo = u0 === 1 ? 1 : 10;
          for (let y = F + 5 * k + 1; y >= Math.max(F + 4, F + 5 * k - 2); y--) Q(uo, y, -2, 'vines', { faces: vm });
        }
        for (const u of [0, w - 1]) { const len = 3 + orng.int(3); for (let y = top - 1; y >= Math.max(F + 6, top - len); y--) Q(u, y, -2, 'vines', { faces: vm }); }
      }
      void vinesOld;
      // ---- a corner house's side on the plaza: a second storefront under two awnings and the word sign, and the same order
      // as the front — corner pilasters, pilasters between the upper bays, a cornice at every storey, arched windows
      if (plazaSide >= 0) {
        const su = plazaSide, fac = su === 0 ? 3 : 1, out = su === 0 ? -1 : w, inF = su === 0 ? 1 : 3;
        for (let v = 3; v <= 8; v++) { Q(su, F + 1, v, 'spruce_planks'); Q(su, F + 2, v, 'glass_pane'); Q(su, F + 3, v, 'glass_pane'); Q(su, F + 4, v, 'spruce_planks'); }
        putModel(Q, 'vm_town_awning_' + awning, fac, su === 0 ? -2 : w, F + 3, 2); putModel(Q, 'vm_town_awning_' + awning, fac, su === 0 ? -2 : w, F + 3, 6);
        putModel(Q, 'vm_town_word_' + trade, fac, out, F + 4, 4);
        for (const v of [0, d - 1]) { Q(out, F + 1, v, 'smooth_quartz'); for (let y = F + 2; y <= top - 1; y++) Q(out, y, v, 'quartz_pillar', { axis: 0 }); }
        for (let k = 1; k < floors; k++) {
          const y0 = F + 5 * k;
          for (const v of [4, 7]) { for (let y = y0 + 1; y <= y0 + 3; y++) Q(out, y, v, 'quartz_pillar', { axis: 0 }); Q(out, y0 + 4, v, 'chiseled_quartz_block'); }
          for (const v of [0, d - 1]) Q(out, y0 + 4, v, 'chiseled_quartz_block');
          for (const v0 of [1, 8]) {
            putModel(Q, 'vm_town_arch3', fac, su, y0 + 1, v0);
            Q(out, y0 + 4, v0, 'smooth_quartz_stairs', { facing: 0, half: 1 }); Q(out, y0 + 4, v0 + 1, 'chiseled_quartz_block'); Q(out, y0 + 4, v0 + 2, 'smooth_quartz_stairs', { facing: 2, half: 1 });
          }
        }
        for (let k = 1; k <= floors; k++) for (let v = 0; v < d; v++) Q(out, F + 5 * k, v, 'smooth_quartz_stairs', { facing: inF, half: 1 });
      }
      // ---- the back door to the yard, the yard's planter and a barrel
      Q(5, F + 1, d - 1, 'spruce_door', { facing: 0, half: 0, hinge: 0, open: 0 }); Q(5, F + 2, d - 1, 'spruce_door', { facing: 0, half: 1, hinge: 0, open: 0 });
      putModel(Q, 'vm_planter', 0, 1, F + 1, d + 2); Q(w - 2, F + 1, d + 3, 'vx_barrel'); if (lrng.chance(0.5)) Q(w - 3, F + 1, d + 3, 'vx_crate');
      // ---- the roof: on half of the three-storey houses a flat roof behind a balustraded parapet (posts with lanterns
      // over the pilasters) — the street's skyline varies; the others the gable roof: the ridge runs into the lot (the gable
      // faces the street), slate over a timbered gable
      const parapet = floors === 3 && orng.chance(0.5);
      if (parapet) {
        for (let u = 1; u < w - 1; u++) for (let v = 1; v < d - 1; v++) if (!(u === w - 2 && v === d - 2)) Q(u, top, v, 'smooth_quartz');   // (a white roof deck)
        for (let u = 0; u < w; u++) for (let v = 0; v < d; v++) if (u === 0 || u === w - 1 || v === d - 1) Q(u, top + 1, v, 'vx_balustrade');
        for (let u = 0; u < w; u++) Q(u, top + 1, -1, PU.includes(u) ? 'chiseled_quartz_block' : 'vx_balustrade');
        for (const u of PU) Q(u, top + 2, -1, 'lantern', { hanging: 0 });
        hs0.roofTop = top + 2;
      } else {
        const span = w, len = d, at = (a, b) => [b, a], half = Math.ceil((span + 2) / 2);
        let roofTop = top;
        for (let i = 0; i <= half; i++) {
          const y = top - 1 + i, bf = i - 1, bb = span - i;
          if (bf >= bb) break;
          for (let a = -1; a <= len; a++) {
            const [u1, v1] = at(a, bf), [u2, v2] = at(a, bb);
            if (!(a === -1 && (u1 < 0 || u1 >= w))) Q(u1, y, v1, 'vx_roof_slate', { facing: 1 });
            if (!(a === -1 && (u2 < 0 || u2 >= w))) Q(u2, y, v2, 'vx_roof_slate', { facing: 3 });   // (round 2: not over the neighbour's corner pilaster)
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
      const [SHELF, SHOW] = WARES[trade];
      for (const u of [1, 2, 3, 7, 8]) Q(u, F + 1, d - 2, SHELF, { facing: 0 });
      // the shop window: the goods on a wooden podium right behind the glass (the riser hides the podium), lit from inside
      for (const u0 of [1, 8]) {
        if (SHOW === 'vm_shop_mannequin_dress') { putModel(Q, SHOW, 0, u0 + 1, F + 1, 1); Q(u0, F + 1, 1, 'spruce_planks'); Q(u0 + 2, F + 1, 1, 'spruce_planks'); Q(u0, F + 2, 1, 'white_carpet'); Q(u0 + 2, F + 2, 1, 'red_carpet'); continue; }
        for (let u = u0; u <= u0 + 2; u++) { Q(u, F + 1, 1, 'spruce_planks'); Q(u, F + 2, 1, SHOW, /^vx_shop|vx_bookshelf/.test(SHOW) ? { facing: 0 } : undefined); }
      }
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
      const shop = toWorld(shopInfo); shop.sign = SIGN[kind]; shop.trade = trade;
      plan.work.push(shop);
      plan.shops.push({ kind, trade, sign: SIGN[kind], at: shop.outside, n: plan.shops.length });
      hs0.lot = { w, d: H.LOT.d, house: w * d, floors, homes: homeInfos.length, kind, trade, cafe: kind === 'cafe' ? shop : null };
      hs0.frame = [rr, ox, oz];
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
      // the ground floor: an arched workshop opening to the walk (its corners rounded by stair fillets, a keystone over
      // it), crates and a counter inside; a plinth course of smooth stone
      for (let u = 3; u <= 6; u++) for (let y = F + 1; y <= F + 3; y++) Q(u, y, 0, null);
      Q(3, F + 3, 0, 'smooth_quartz_stairs', { facing: 3, half: 1 }); Q(6, F + 3, 0, 'smooth_quartz_stairs', { facing: 1, half: 1 });
      Q(4, F + 4, 0, 'chiseled_quartz_block'); Q(5, F + 4, 0, 'chiseled_quartz_block');
      for (const u of [1, 2, 7, 8]) Q(u, F + 1, 0, 'smooth_quartz');
      Q(2, F + 1, 3, 'vx_crate'); Q(7, F + 1, 3, 'vx_barrel'); Q(3, F + 1, 4, 'vx_counter', { facing: 0 }); Q(6, F + 1, 4, 'vx_counter', { facing: 0 });
      // (round 2b) the workshop lit from inside (a lantern hanging from the storey's floor: the arch glows warm instead of
      // black) and a striped awning over the arch; goods stacked by the counters
      Q(4, F + 4, 2, 'lantern', { hanging: 1 }); { const q = ROT[rr](4, 2); plan.lamps.push([ox + q[0], F + 4, oz + q[1]]); }
      putModel(Q, 'vm_town_awning_' + (((k + s) & 1) ? 'teal' : 'amber'), 0, 3, F + 4, -2);
      Q(2, F + 2, 3, 'vx_veg_crate'); Q(7, F + 1, 4, 'vx_shop_basket_stack');
      for (let y = F + 1; y <= F + 14; y++) Q(w - 2, y, d - 2, 'ladder', { facing: 0 });
      // the two storeys: arched windows on the front, a gallery with a balustrade over the walk, a door onto it
      const homes = [];
      for (let kf = 1; kf <= 2; kf++) {
        const y0 = F + 5 * kf, Y = y0 + 1;
        for (const u of [2, 7]) putModel(Q, 'vm_town_window_' + stain, 0, u, Y, 0);
        Q(4, Y, 0, 'spruce_door', { facing: 2, half: 0, hinge: 0, open: 0 }); Q(4, Y + 1, 0, 'spruce_door', { facing: 2, half: 1, hinge: 0, open: 0 });
        for (let u = 1; u < w - 1; u++) { Q(u, y0, -1, 'smooth_quartz_slab', { type: 'top' }); Q(u, Y, -1, 'vx_balustrade'); }
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
      // the order of the arcade front (round 2): a column at each end of the unit, from the plinth to the crowning cornice,
      // carrying the galleries between them; the cornice of upside-down stairs under the parapet's balustrade
      for (const u of [0, w - 1]) { Q(u, F + 1, -1, 'smooth_quartz'); for (let y = F + 2; y <= F + 14; y++) Q(u, y, -1, 'quartz_pillar', { axis: 0 }); Q(u, F + 15, -1, 'chiseled_quartz_block'); }
      for (let u = 1; u < w - 1; u++) Q(u, F + 15, -1, 'smooth_quartz_stairs', { facing: 2, half: 1 });
      lg.frame = [rr, ox, oz];
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
    for (const [du, dv] of [[4, 0], [-4, 0], [0, 4], [0, -4]]) { P(du, F + 2, dv, 'vx_lantern'); const [x, z] = W2(du, dv); plan.lamps.push([x, F + 2, z]); }   // (four lanterns on the basin's rim)
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
    for (let v = -72; v <= H.STAIR0 - 4; v += 8) {   // (to the stair's foot)
      if (Math.abs(v) <= H.PV) continue;
      for (const s of [-1, 1]) { putModel(P, 'vm_town_lamp', 0, s * 4, F + 1, v); const [x, z] = W2(s * 4, v); plan.lamps.push([x, F + 4, z]); }
    }
    for (let k = -8; k <= 4; k++) {
      const vp = 10 * k + 5; if (vp < H.V0 + 3 || vp > H.V1) continue;
      for (const s of [-1, 1]) { putModel(P, 'vm_wall_lantern', s > 0 ? 3 : 1, s * 26, F + 10, vp); if (k % 2 === 0) { const vm = vineMask(r, s, 0); for (let y = F + 5; y <= F + 9; y++) P(s * 26, y, vp + 1, 'vines', { faces: vm }); } }
    }
    for (let k = -7; k <= 4; k++) for (const s of [-1, 1]) { P(s * 28, F + H.ARC + 3, 10 * k, 'lantern', { hanging: 1 }); const [x, z] = W2(s * 28, 10 * k); plan.lamps.push([x, F + H.ARC + 3, z]); }
    yield;

    // ================================================================ the market in the aisles (round 2: the reference's busy market)
    // a stall every 7 blocks along both aisles, against the arcade: the stall (a counter with produce, four posts, a striped
    // canopy with a scalloped edge), a lantern on a bracket over the walk, a barrel pair beside it, a passage two wide, a
    // potted plant and a bench; wooden ribs under the aisle vault and a tie beam every 12 blocks; lanterns on the piers
    const stalls = [];
    const hallStalls = [];
    const inCross = (v) => Math.abs(v) <= 3;
    for (const s of [-1, 1]) {
      let n = 0;
      for (let v0 = H.V0 + 3; v0 + 2 <= H.V1; v0 += 7) {
        if (inCross(v0) || inCross(v0 + 1) || inCross(v0 + 2) || v0 + 3 > H.V1) continue;
        const fa = s > 0 ? 1 : 3;
        // (round 2b: the tall stall — posts and braces carrying a pitched striped canopy over the head, a lantern hanging
        // in it over the counter; the bracket lantern over the walk went into the stall)
        putModel(P, 'vm_town_stall_tall_' + ((n++ & 1) ? 'teal' : 'amber'), fa, s > 0 ? H.A0 : -H.STALL1, F + 1, v0);
        const [lx, lz] = W2(s * H.STALL1, v0 + 1); plan.lamps.push([lx, F + 3, lz]);
        const [x, z] = W2(s * (H.STALL1 + 1), v0 + 1); stalls.push([x, F + 1, z, L.facing(fa)]);
        hallStalls.push({ s, v0 });
        const item = (dv, fn) => { const v = v0 + dv; if (v <= H.V1 && !inCross(v)) fn(v); };
        item(3, (v) => { P(s * H.A0, F + 1, v, 'vx_barrel'); P(s * H.STALL1, F + 1, v, 'vx_barrel'); if (n & 1) P(s * H.A0, F + 2, v, 'vx_crate'); });
        item(6, (v) => { putModel(P, 'vm_planter', 0, s * H.A0, F + 1, v); P(s * H.STALL1, F + 1, v, 'vx_bench', { facing: fa }); });
      }
    }
    // the shell's underside over a cell (the roof loop's lowest course): the ribs follow it
    const shellLo = (u, v) => {
      const h = roofH(u, v); let lo = h;
      for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nr = region(u + du, v + dv); const nh = nr ? roofH(u + du, v + dv) : 0; lo = Math.min(lo, nh + 1); }
      return Math.max(lo, 1);
    };
    for (const s of [-1, 1]) for (let v = -72; v <= 48; v += 12) {
      for (let a = H.A0; a <= H.LG1; a++) { const lo = shellLo(s * a, v); P(s * a, F + lo - 1, v, 'vx_beam_oak', { axis: 1 }); }
      for (let a = H.A0; a <= H.LG1; a++) if (F + 20 < F + shellLo(s * a, v) - 1) P(s * a, F + 20, v, 'vx_beam_oak', { axis: 1 });
      // lanterns hanging from the tie beam: over the walk low on chains (round 2b: they hung at the beam, out of sight under
      // the vault), over the loggias' roofs at the beam
      for (const a of [33, 37]) if (F + 20 < F + shellLo(s * a, v) - 1) { for (let y = F + 11; y <= F + 19; y++) P(s * a, y, v, 'iron_chain', { axis: 0 }); P(s * a, F + 10, v, 'lantern', { hanging: 1 }); const [x, z] = W2(s * a, v); plan.lamps.push([x, F + 10, z]); }
      if (F + 20 < F + shellLo(s * 41, v) - 1) { P(s * 41, F + 19, v, 'lantern', { hanging: 1 }); const [x, z] = W2(s * 41, v); plan.lamps.push([x, F + 19, z]); }
    }
    for (let k = -8; k <= 4; k++) {
      const vp = 10 * k + 5; if (vp < H.V0 + 3 || vp > H.V1 || inCross(vp)) continue;
      for (const s of [-1, 1]) { putModel(P, 'vm_wall_lantern', s > 0 ? 1 : 3, s * H.A0, F + 5, vp); const [x, z] = W2(s * H.A0, vp); plan.lamps.push([x, F + 5, z]); }
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
    plan.hall = { cx, cz, r, F, HW: H.HW, V0: H.V0, V1: H.V1, stalls: hallStalls, houses: houses.map(h => ({ side: h.side, vlo: h.vlo, vhi: h.vhi, lot: h.lot, frame: h.frame })), loggias: loggias.map(l => ({ k: l.k, s: l.s, homes: l.homes, frame: l.frame })), grid, gv0: GV0, gw: GW };
    plan.center = [cx, F + 1, cz];
    plan.chunks = chunks;
    return plan;
  };
})(VR);

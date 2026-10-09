// ============================================================================
// Villages: frequent, peaceful settlements built from the mini-voxel
// architecture kit. Deterministic per world seed:
//   · one candidate site per 224×224 cell on friendly, fairly flat land
//   · a paved plaza with a well / crystal fountain, radial lanes with lamps
//   · family homes (1–2 storeys, beds for every family member), workshops
//     (bakery, smithy, library, clinic, hall, hangar with a parked starship),
//     farm plots with irrigation, gardens, fences, flower boxes…
//   · biome styles: meadow cottages, taiga log houses, desert adobe, cherry,
//     savanna, snowy, and prism-realm crystal villages
// The same plan is sent to the game so villagers know their homes, beds,
// workplaces, farms and the lots they will build on next.
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R, M = VR.M, SEA = VR.C.SEA;
  const VG = VR.VillageGen = {};
  const stCache = new Map();
  const st = (name, props) => {
    const key = props ? name + JSON.stringify(props) : name;
    let s = stCache.get(key);
    if (s !== undefined) return s;
    const t = R.byName[name];
    s = t ? (props ? t.state(props) : t.defaultState) : 0;
    stCache.set(key, s);
    return s;
  };
  VG.st = st;

  // ---------------------------------------------------------------- styles
  const STYLES = VG.STYLES = {
    meadow: {
      walls: ['vx_timber_white', 'vx_timber_cream', 'vx_plaster_peach', 'vx_plaster_butter', 'vx_plaster_mint', 'vx_plaster_sky', 'vx_plaster_rose', 'vx_plaster_lavender', 'vx_timber_butter', 'vx_siding_white'],
      roofs: ['red', 'terracotta', 'blue', 'teal', 'green', 'slate', 'red', 'terracotta'], floor: 'vx_floor_oak', base: 'vx_fieldstone',
      windows: ['vx_window_shutter_green', 'vx_window_shutter_blue', 'vx_window_shutter_red', 'vx_window', 'vx_window_shutter_teal', 'vx_window_shutter_yellow'],
      wood: 'oak', fence: 'vx_fence_white', lamp: 'vx_lamppost', path: 'dirt_path', plaza: ['vx_floor_stone', 'stone_bricks', 'polished_andesite'], chimney: 'vx_chimney', beam: 'vx_beam_dark', crops: true, flowers: true,
    },
    taiga: {
      walls: ['vx_logwall', 'vx_siding_red', 'vx_darkwood', 'vx_siding_yellow', 'vx_logwall', 'vx_siding_green'],
      roofs: ['slate', 'shingle', 'green', 'red', 'slate'], floor: 'vx_floor_spruce', base: 'vx_fieldstone',
      windows: ['vx_window_wood', 'vx_window_shutter_green', 'vx_window_shutter_red', 'vx_window_wood'],
      wood: 'spruce', fence: 'vx_fence_wood', lamp: 'vx_lamppost', path: 'dirt_path', plaza: ['vx_floor_stone', 'cobblestone', 'mossy_cobblestone'], chimney: 'vx_chimney_stone', beam: 'vx_beam_dark', crops: true,
    },
    snowy: {
      walls: ['vx_logwall', 'vx_siding_red', 'vx_siding_blue', 'vx_darkwood', 'vx_stonebrick'],
      roofs: ['slate', 'blue', 'red', 'white'], floor: 'vx_floor_spruce', base: 'vx_stonebrick',
      windows: ['vx_window_wood', 'vx_window_shutter_blue', 'vx_window_shutter_red'],
      wood: 'spruce', fence: 'vx_fence_wood', lamp: 'vx_lamppost', path: 'packed_ice', pathAlt: 'snow_block', plaza: ['vx_floor_stone', 'stone_bricks'], chimney: 'vx_chimney_stone', beam: 'vx_beam_dark', crops: false, snow: true,
    },
    desert: {
      walls: ['vx_adobe', 'vx_sandstone', 'vx_adobe', 'vx_plaster_cream'],
      roofs: ['terracotta', 'gold'], flat: true, floor: 'vx_floor_tile', base: 'vx_sandstone',
      windows: ['vx_window_arch', 'vx_window_wood', 'vx_window_arch'],
      wood: 'acacia', fence: 'vx_fence_wood', lamp: 'vx_lamppost', path: 'smooth_sandstone', plaza: ['vx_floor_tile', 'cut_sandstone', 'smooth_sandstone'], chimney: 'vx_chimney', beam: 'vx_beam_oak', crops: true, cactusGarden: true,
    },
    savanna: {
      walls: ['vx_adobe', 'vx_plaster_peach', 'vx_siding_yellow', 'vx_plaster_butter'],
      roofs: ['thatch', 'terracotta', 'thatch'], floor: 'vx_floor_tile', base: 'vx_fieldstone',
      windows: ['vx_window_wood', 'vx_window_arch'],
      wood: 'acacia', fence: 'vx_fence_wood', lamp: 'vx_lamppost', path: 'dirt_path', plaza: ['vx_floor_tile', 'vx_floor_stone'], chimney: 'vx_chimney', beam: 'vx_beam_oak', crops: true,
    },
    cherry: {
      walls: ['vx_plaster_white', 'vx_plaster_rose', 'vx_timber_rose', 'vx_plaster_lavender', 'vx_timber_white'],
      roofs: ['pink', 'red', 'violet', 'pink'], floor: 'vx_floor_oak', base: 'vx_stonebrick',
      windows: ['vx_window_arch', 'vx_window', 'vx_window_shutter_teal'],
      wood: 'cherry', fence: 'vx_fence_white', lamp: 'vx_lamppost', path: 'dirt_path', plaza: ['vx_floor_marble', 'vx_floor_stone'], chimney: 'vx_chimney', beam: 'vx_beam_dark', crops: true, flowers: true,
    },
    prism: {
      walls: ['vx_crystal_wall', 'vx_hull_white', 'vx_crystal_wall', 'vx_plaster_lavender'],
      roofs: ['violet', 'white', 'teal', 'violet'], floor: 'vx_floor_marble', base: 'vx_stonebrick',
      windows: ['vx_window_round', 'vx_window_glow', 'vx_window_arch', 'vx_window_shutter_violet'],
      wood: 'birch', fence: 'vx_fence_white', lamp: 'vx_lamppost_crystal', path: 'vx_floor_marble', plaza: ['vx_floor_marble', 'vx_floor_checker'], chimney: 'vx_chimney_stone', beam: 'vx_beam_white', crops: true, crystals: true, scifi: true,
    },
    // the trailer's tropical tech city: white panel buildings with glowing cyan windows and orange trim,
    // flat roofs with domes and gardens, plaza tiles with light-lines, palms and ferns everywhere
    tech: {
      walls: ['vx_tech_white', 'vx_tech_trim', 'vx_tech_white', 'vx_tech_hex_white', 'vx_tech_white_strip'],
      roofs: ['white'], flat: true, floor: 'vx_floor_plaza', base: 'vx_tech_gray',
      windows: ['vx_window_tech', 'vx_window_tech', 'vx_window_tech_dark'],
      wood: 'birch', fence: 'vx_tech_railing', lamp: 'vx_lamppost_tech', path: 'vx_floor_plaza', pathLine: 'vx_floor_plaza_line', pathAlt: 'vx_floor_plaza',
      plaza: ['vx_floor_plaza', 'vx_floor_hex', 'vx_floor_plaza'], chimney: 'vx_chimney_stone', beam: 'vx_beam_white', crops: false, scifi: true,
      tech: true, palms: true, band: 'vx_tech_band', windowBands: true, tall: true, seat: 'vx_stool', shelf: 'vx_locker', plant: 'vx_tech_planter', light: 'vx_hex_light', noChimney: true, noRugs: true, planter: 'vx_tech_planter', bench: 'vx_sofa_white',
    },
    // rich modern towns (vgen 3): stucco & stone villas with black-framed glass, asphalt streets with pavement
    // sidewalks and street trees, a neoclassical town hall on a fountain plaza, a school, a factory, offices, a café, a park
    modern: {
      walls: ['stucco_white', 'stucco_cream'], roofs: ['slate'], flat: true, floor: 'oak_herringbone', base: 'concrete_smooth',
      windows: ['window_black'], wood: 'oak', fence: 'vx_railing_black', lamp: 'vx_lamppost_black', path: 'asphalt', pathAlt: 'asphalt', pathLine: 'asphalt_dash', sidewalk: 'paver_grey',
      plaza: ['granite_paver', 'travertine', 'granite_paver'], chimney: 'vx_chimney_stone', beam: 'vx_beam_white', crops: true, flowers: true, modern: true, noChimney: true, noRugs: true,
      seat: 'vx_dining_chair', bench: 'vx_bench', plant: 'vx_tall_plant', light: 'vx_spot', planter: 'vx_urn', trees: true,
    },
    jungle: {
      walls: ['vx_planks', 'vx_siding_green', 'vx_logwall', 'vx_siding_teal'],
      roofs: ['thatch', 'green', 'teal'], floor: 'vx_floor_oak', base: 'vx_fieldstone',
      windows: ['vx_window_wood', 'vx_window_shutter_teal'],
      wood: 'jungle', fence: 'vx_fence_wood', lamp: 'vx_lamppost', path: 'dirt_path', plaza: ['vx_floor_stone', 'mossy_cobblestone'], chimney: 'vx_chimney_stone', beam: 'vx_beam_oak', crops: true, flowers: true,
    },
  };
  VG.styleFor = function (key, cl) {
    if (/prism|crystal/.test(key)) return 'prism';
    if (/snowy|ice|frozen|grove|jagged|slopes/.test(key)) return 'snowy';
    if (/taiga|windswept/.test(key)) return 'taiga';
    if (/desert|badlands|mesa|ember/.test(key)) return 'desert';
    if (/savanna/.test(key)) return 'savanna';
    if (/cherry|pale/.test(key)) return 'cherry';
    if (/jungle|bamboo|mangrove/.test(key)) return 'jungle';
    if (cl && cl.prism > 0.3) return 'prism';
    return 'meadow';
  };

  // ---------------------------------------------------------------- rotated lot builder
  // local frame: front faces north (−z); u → east, v → south (into the lot)
  // dir r rotates clockwise: world = origin + rot(u, v)
  const ROT = [(u, v) => [u, v], (u, v) => [-v, u], (u, v) => [-u, -v], (u, v) => [v, -u]];
  VG.rot = (r, u, v) => ROT[r & 3](u, v);
  function makeLot(put, ox, oz, r) {
    const rf = (f) => (f + r) & 3;
    const L = {
      r, ox, oz,
      w: (u, v) => { const p = ROT[r](u, v); return [ox + p[0], oz + p[1]]; },
      P(u, y, v, name, props) {
        if (!name) { const p = ROT[r](u, v); put(ox + p[0], y, oz + p[1], 0); return; }
        let pr = props;
        if (pr) {
          pr = Object.assign({}, pr);
          if (pr.facing !== undefined) pr.facing = rf(pr.facing);
          if (pr.axis !== undefined && (r & 1)) pr.axis = pr.axis === 1 ? 2 : pr.axis === 2 ? 1 : pr.axis;
        }
        const p = ROT[r](u, v);
        put(ox + p[0], y, oz + p[1], typeof name === 'number' ? name : st(name, pr));
      },
      facing: rf,
    };
    return L;
  }
  VG.makeLot = makeLot;

  // ---------------------------------------------------------------- buildings
  // o: {w, d, floors, F, style, rng, kind, beds, ground(u,v)→y, walls, roof, window}
  // returns info in lot-local coords (converted by the caller)
  function building(L, o) {
    const S = STYLES[o.style] || STYLES.meadow;
    const rng = o.rng, w = o.w, d = o.d, F = o.F, floors = o.floors || 1;
    const P = L.P;
    const wallN = o.walls, winN = o.window, roofC = o.roof;
    const info = { beds: [], seats: [], work: [], door: null, inside: null, chimney: null, lights: [], kind: o.kind };
    const top = F + floors * 4;          // level right above the top wall row
    const du = w >> 1;                   // door column
    const kind = o.kind;
    const open = kind === 'smithy';
    // ---- foundation + floor
    for (let u = 0; u < w; u++) for (let v = 0; v < d; v++) {
      const gy = o.ground(u, v);
      for (let y = gy + 1; y < F; y++) P(u, y, v, S.base);
      P(u, F, v, S.floor);
    }
    const alongU = w >= d; // roof ridge runs along u
    // ---- walls per storey
    for (let k = 0; k < floors; k++) {
      const y0 = F + k * 4;
      for (let u = 0; u < w; u++) for (let v = 0; v < d; v++) {
        const edge = u === 0 || v === 0 || u === w - 1 || v === d - 1;
        for (let y = y0 + 1; y <= y0 + 3; y++) {
          if (!edge) { P(u, y, v, null); continue; }
          if (open && v === 0 && u > 0 && u < w - 1 && k === 0) { P(u, y, v, null); continue; }
          if (kind === 'barn' && v === 0 && Math.abs(u - du) <= 1 && k === 0) { P(u, y, v, null); continue; }
          if (kind === 'barn' && v === 0 && Math.abs(u - du) === 2 && k === 0) { P(u, y, v, 'vx_barn_door', { facing: 0 }); continue; }
          P(u, y, v, wallN);
        }
        if (k > 0) P(u, y0, v, edge ? (S.band || wallN) : S.floor);
      }
      // windows
      const winAt = (u, y, v, fac) => P(u, y, v, winN, { facing: fac });
      const wy = y0 + 2;
      const bands = S.windowBands; // tech: windows side by side merge into glass bands
      for (let u = 1; u < w - 1; u++) {
        if ((bands || u % 2 === (du % 2)) && !(k === 0 && Math.abs(u - du) <= 1)) { if (!open || k > 0) winAt(u, wy, 0, 0); }
        if ((bands || u % 2 === (du % 2)) && !(o.chimney && !alongU && u === ((w - 1) >> 1))) winAt(u, wy, d - 1, 0);
      }
      for (let v = 1; v < d - 1; v++) if (bands || v % 2 === 1 || d <= 4) { winAt(0, wy, v, 1); if (!(o.chimney && alongU && v === ((d - 1) >> 1))) winAt(w - 1, wy, v, 1); }
    }
    // ---- door
    if (!open && kind !== 'barn') {
      P(du, F + 1, 0, o.wood + '_door', { facing: 2, half: 0, hinge: 0, open: 0 });
      P(du, F + 2, 0, o.wood + '_door', { facing: 2, half: 1, hinge: 0, open: 0 });
    }
    info.door = [du, F + 1, 0];
    info.outside = [du, F + 1, -1];
    info.inside = [du, F + 1, 1];
    // doorstep
    const gyD = o.ground(du, -1);
    for (let y = gyD + 1; y <= F; y++) P(du, y, -1, y === F ? S.floor : S.base);
    P(du, F + 1, -1, null); P(du, F + 2, -1, null);
    // ---- roof
    const span = alongU ? d : w, len = alongU ? w : d;
    const roofBlock = 'vx_roof_' + roofC, ridgeBlock = 'vx_ridge_' + roofC;
    const at = (a, b) => alongU ? [a, b] : [b, a]; // a along ridge, b across
    // external chimney hugging the middle of a gable wall
    const chimney = o.chimney ? (alongU ? [w, (d - 1) >> 1] : [(w - 1) >> 1, d]) : null;
    const isChim = (u, v) => chimney && u === chimney[0] && v === chimney[1];
    if (S.flat && !o.pitched) {
      // flat roof with a parapet and a little terrace
      for (let a = -1; a <= len; a++) for (let b = -1; b <= span; b++) {
        const [u, v] = at(a, b);
        const inner = a >= 0 && a < len && b >= 0 && b < span;
        if (!inner) { if (u >= -1 && v >= -1) P(u, top - 1 + 1, v, null); continue; }
        P(u, top, v, S.floor);
        const edge = a === 0 || a === len - 1 || b === 0 || b === span - 1;
        if (edge) P(u, top + 1, v, S.band || wallN); else P(u, top + 1, v, null);
      }
      info.roofTop = top + 1;
      if (S.tech) {
        // roof garden: ferns and planters, a dome (2×2 when there is room) and a glowing rail on top of the parapet
        if (w >= 5 && d >= 5 && rng.chance(0.55)) { const u0 = (w >> 1) - 1, v0 = (d >> 1) - 1; for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) P(u0 + a, top + 1, v0 + b, rng.chance(0.5) ? 'vx_dome_white' : 'vx_dome_white'); info.roofTop = top + 2; }
        else P(w >> 1, top + 1, d >> 1, 'vx_dome_glass');
        for (const [u, v] of [[1, 1], [w - 2, 1], [1, d - 2], [w - 2, d - 2]]) if (rng.chance(0.7)) P(u, top + 1, v, rng.chance(0.5) ? 'vx_fern_lush' : 'vx_tech_planter');
      } else {
        if (rng.chance(0.6)) { P(1, top + 1, 1, 'vx_potplant'); P(w - 2, top + 1, 1, 'vx_potplant'); }
        if (rng.chance(0.5)) P(w - 2, top + 1, d - 2, 'vx_awning_' + rng.pick(['red', 'yellow', 'blue']), { facing: 0 });
      }
    } else {
      const half = Math.ceil((span + 2) / 2);
      for (let i = 0; i <= half; i++) {
        const y = top - 1 + i;
        const bf = i - 1, bb = span - i; // front / back slope rows (across index)
        for (let a = -1; a <= len; a++) {
          if (bf < bb) {
            const [u1, v1] = at(a, bf), [u2, v2] = at(a, bb);
            if (!isChim(u1, v1)) P(u1, y, v1, roofBlock, { facing: alongU ? 2 : 1 });
            if (!isChim(u2, v2)) P(u2, y, v2, roofBlock, { facing: alongU ? 0 : 3 });
            // clear above the slope so terrain / trees never poke through
            P(u1, y + 1, v1, null); P(u2, y + 1, v2, null);
            // gable wall between the slopes at both ends, attic space inside
            if (a === 0 || a === len - 1) { for (let b = bf + 1; b < bb; b++) { const [u, v] = at(a, b); if (i >= 1) P(u, y, v, wallN); } }
            else if (a > 0 && a < len - 1 && i >= 1) { for (let b = bf + 1; b < bb; b++) { const [u, v] = at(a, b); P(u, y, v, null); } }
          } else if (bf === bb) {
            const [u, v] = at(a, bf);
            P(u, y, v, ridgeBlock, { facing: alongU ? 0 : 1 });
            P(u, y + 1, v, null);
            info.roofTop = y;
          }
        }
        if (bf >= bb) { if (bf > bb) info.roofTop = y - 1; break; }
        info.roofTop = y;
      }
      // round attic window in each gable
      if (span >= 5) {
        const mid = (span - 1) >> 1;
        for (const a of [0, len - 1]) { const [u, v] = at(a, mid); P(u, top + 1, v, S.scifi ? 'vx_window_glow' : 'vx_window_round', { facing: alongU ? 1 : 0 }); }
      }
      // tie beam + hanging lantern
      if (floors === 1 && span >= 4) {
        const mid = (span - 1) >> 1;
        for (let a = 1; a < len - 1; a++) { const [u, v] = at(a, mid); P(u, top, v, S.beam, { axis: alongU ? 1 : 2 }); }
      }
    }
    // ---- chimney column outside the wall
    if (chimney) {
      const [cu, cv] = chimney;
      const gy = o.ground(cu, cv);
      const ch = (info.roofTop || top) + 1;
      for (let y = gy + 1; y <= ch; y++) P(cu, y, cv, S.chimney);
      info.chimney = [cu, ch, cv];
    }
    // ---- interior furnishing
    const Y = F + 1;
    const lantern = S.light || (S.crystals ? 'vx_lantern_crystal' : 'vx_lantern');
    const seatB = S.seat || 'vx_chair', shelfB = S.shelf || 'vx_shelf', plantB = S.plant || 'vx_potplant';
    const bedCols = ['vx_bed_red', 'vx_bed_blue', 'vx_bed_green', 'vx_bed_yellow', 'vx_bed_purple', 'vx_bed_pink', 'vx_bed_teal', 'vx_bed_white'];
    const used = new Set();
    const take = (u, v) => { const k = u + ',' + v; if (used.has(k)) return false; used.add(k); return true; };
    take(du, 1); // keep the entrance free
    if (o.detail && kind === 'home' && VR.Detail) {
      // vgen 6: the placement grammar furnishes every storey room by room (gen_detail.js); the lamp and planters outside too
      VR.Detail.homeInterior(L, info, { w, d, floors, F, du, S, rng, seed: o.seed, alongU, top });
    } else if (kind === 'home' || kind === 'farmhouse' || kind === 'clinic') {
      // beds along the back wall on the top storey (head against the wall)
      const by = floors > 1 ? F + 5 : Y;
      const nb = Math.min(o.beds || 2, w - 2);
      let placed = 0;
      for (let u = 1; u < w - 1 && placed < nb; u++) {
        if (floors === 1 && u === du) continue;
        const col = kind === 'clinic' ? 'vx_bed_white' : bedCols[(o.seed + (placed >> 1)) % bedCols.length];
        P(u, by, d - 3, col, { facing: 2, part: 0 }); P(u, by, d - 2, col, { facing: 2, part: 1 });
        take(u, d - 3); take(u, d - 2);
        info.beds.push([u, by, d - 3, 2]);
        placed++;
      }
      if (floors > 1) {
        // ladder up (against the west wall), hole in the upper floor
        for (let y = Y; y <= F + 4; y++) P(1, y, 1, 'ladder', { facing: 1 });
        take(1, 1);
        P(1, F + 4, 1, 'ladder', { facing: 1 });
        P(w - 2, F + 5, 1, lantern);
        P(w - 2, F + 5, 2, shelfB, { facing: 3 });
      }
      // kitchen: stove by the chimney, counter beside it
      const sv = d - 2;
      if (floors > 1 || !used.has((w - 2) + ',' + sv)) { P(w - 2, Y, floors > 1 ? sv : 1 + (d > 5 ? 1 : 0), 'vx_stove', { facing: 3 }); take(w - 2, floors > 1 ? sv : 1 + (d > 5 ? 1 : 0)); info.work.push(['stove', w - 3, Y, floors > 1 ? sv : 1 + (d > 5 ? 1 : 0)]); }
      if (w >= 6 && take(w - 2, floors > 1 ? sv - 1 : 1)) P(w - 2, Y, floors > 1 ? sv - 1 : 1, 'vx_counter', { facing: 3 });
      // table & chairs in the middle
      const tu = Math.max(1, du - 1 - (w > 6 ? 1 : 0)), tv = Math.max(2, (d >> 1) - (floors > 1 ? 0 : 1));
      if (take(tu, tv)) {
        P(tu, Y, tv, 'vx_table');
        info.table = [tu, Y, tv];
        for (const [cu, cv, f] of [[tu - 1, tv, 1], [tu + 1, tv, 3], [tu, tv - 1, 2], [tu, tv + 1, 0]]) {
          if (cu < 1 || cu > w - 2 || cv < 1 || cv > d - 2) continue;
          if (!take(cu, cv)) continue;
          P(cu, Y, cv, seatB, seatB === 'vx_chair' ? { facing: f } : undefined);
          info.seats.push([cu, Y, cv, f]);
        }
      }
      // shelf & plant & rug
      if (take(1, d - 2) && floors > 1) P(1, Y, d - 2, shelfB, { facing: 1 });
      else if (take(1, 2)) P(1, Y, 2, shelfB, { facing: 1 });
      if (take(w - 2, 1)) P(w - 2, Y, 1, plantB);
      if (!S.noRugs) for (let u = 1; u < w - 1; u++) for (let v = 1; v < d - 1; v++) { if (used.has(u + ',' + v)) continue; if (Math.abs(u - du) <= 1 && v >= 2 && v <= d - 3) P(u, Y, v, 'vx_rug_' + ['red', 'blue', 'green', 'sand'][o.seed & 3]); }
      if (floors === 1) { const mid = (Math.min(w, d) >= 4) ? ((alongU ? d : w) - 1) >> 1 : 1; const [lu, lv] = alongU ? [du, mid] : [mid, du]; P(lu, F + 3, lv, lantern); info.lights.push([lu, F + 3, lv]); }
      else { P(du, F + 3, 2, S.light || 'vx_lantern'); }
    } else if (kind === 'bakery') {
      for (let u = 1; u < w - 1; u++) { if (u === du) continue; if (take(u, d - 2)) P(u, Y, d - 2, u % 2 ? 'vx_stove' : 'vx_counter', { facing: 0 }); }
      info.work.push(['bake', du, Y, d - 3]);
      if (take(1, 2)) P(1, Y, 2, 'vx_barrel'); if (take(w - 2, 2)) P(w - 2, Y, 2, 'vx_crate');
      P(du, F + 3, 2, lantern);
      // market counter out front
      P(du - 2, Y, -2, 'vx_counter', { facing: 0 }); P(du + 2, Y, -2, 'vx_counter', { facing: 0 });
      info.work.push(['sell', du - 2, Y, -3]);
    } else if (kind === 'smithy') {
      P(1, Y, d - 2, 'furnace', { facing: 2 }); P(2, Y, d - 2, 'furnace', { facing: 2 }); P(w - 2, Y, d - 2, 'blast_furnace', { facing: 2 });
      P(du, Y, 2, 'anvil', { facing: 1 }); take(du, 2);
      P(w - 2, Y, 1, 'vx_crate'); P(1, Y, 1, 'vx_barrel');
      info.work.push(['forge', du, Y, 3]);
      P(du, F + 3, 2, lantern);
      for (let u = 1; u < w - 1; u += Math.max(1, w - 3)) { P(u, Y, 0, S.beam, { axis: 0 }); P(u, Y + 1, 0, S.beam, { axis: 0 }); P(u, Y + 2, 0, S.beam, { axis: 0 }); }
    } else if (kind === 'library') {
      for (let u = 1; u < w - 1; u++) { if (take(u, d - 2)) P(u, Y, d - 2, 'vx_shelf', { facing: 2 }); }
      for (let v = 2; v < d - 2; v++) { if (take(1, v)) P(1, Y, v, 'vx_shelf', { facing: 1 }); if (take(w - 2, v)) P(w - 2, Y, v, 'vx_shelf', { facing: 3 }); }
      P(du, Y, 3, 'lectern', { facing: 2 }); take(du, 3);
      info.work.push(['read', du, Y, 2]);
      P(du, F + 3, 3, lantern);
    } else if (kind === 'hall') {
      for (let u = 2; u < w - 2; u++) { if (take(u, 3)) P(u, Y, 3, 'vx_table'); }
      for (let u = 2; u < w - 2; u++) { if (take(u, 2)) { P(u, Y, 2, 'vx_chair', { facing: 2 }); info.seats.push([u, Y, 2, 2]); } if (take(u, 4)) { P(u, Y, 4, 'vx_chair', { facing: 0 }); info.seats.push([u, Y, 4, 0]); } }
      P(du, F + 3, 3, lantern); P(1, Y, d - 2, 'vx_shelf', { facing: 1 });
      info.work.push(['council', du, Y, 5]);
    } else if (kind === 'barn') {
      // hay loft corner, a trough, milk churns and a wheelbarrow; the farmers fork hay here
      for (const [u, v, h] of [[1, d - 2, 3], [2, d - 2, 2], [1, d - 3, 2], [w - 2, d - 2, 2], [w - 3, d - 2, 1]]) for (let y = Y; y < Y + h; y++) P(u, y, v, 'vx_hay');
      P(w - 2, Y, 2, 'vx_trough', { facing: 3 }); P(w - 2, Y, 3, 'vx_trough', { facing: 3 });
      P(1, Y, 1, 'vx_milk_can'); P(w - 2, Y, 1, 'vx_wheelbarrow', { facing: 0 });
      P(du, F + 3, 2, lantern);
      info.work.push(['hay', du, Y, 3]);
    } else if (kind === 'workshop') {
      P(1, Y, d - 2, 'crafting_table'); P(2, Y, d - 2, 'vx_crate'); P(w - 2, Y, d - 2, 'vx_crate'); P(w - 2, Y, d - 3, 'vx_barrel');
      P(du, Y, 2, 'stonecutter'); take(du, 2);
      info.work.push(['craft', du, Y, 3]);
      P(du, F + 3, 3, lantern);
    }
    // ---- exterior decoration
    const sign = { bakery: 3, smithy: 1, library: 2, clinic: 6, hall: 7, workshop: 4, farmhouse: 0 }[kind];
    if (sign !== undefined) P(du + 1, F + 3, -1, 'vx_sign', { facing: 0, icon: sign });
    if (kind === 'bakery') for (let u = 0; u < w; u++) if (u !== du) P(u, F + 3, -1, 'vx_awning_' + rng.pick(['red', 'yellow', 'green', 'blue']), { facing: 0 });
    if (S.tech) { for (const u of [du - 2, du + 2]) if (u >= 0 && u < w) P(u, F + 1, -1, rng.chance(0.5) ? 'vx_fern_lush' : S.planter); }
    else if (S.flowers || rng.chance(0.5)) for (let u = 1; u < w - 1; u++) if (u % 2 === (du % 2) && Math.abs(u - du) > 1 && kind !== 'bakery') P(u, F + 1, -1, S.fence === 'vx_fence_wood' ? 'vx_windowbox_wood' : 'vx_windowbox', { facing: 0 });
    if (S.scifi && rng.chance(0.7) && !S.flat) info.solar = true;
    return info;
  }
  VG.building = building;
  // a palm: trunk, crown, four fronds (fronds hang outward)
  VG.palm = function (put, x, y, z, h) {
    for (let k = 0; k < h; k++) put(x, y + k, z, st('vx_palm_trunk'));
    put(x, y + h, z, st('vx_palm_crown'));
    put(x + 1, y + h, z, st('vx_palm_frond', { facing: 1 })); put(x - 1, y + h, z, st('vx_palm_frond', { facing: 3 }));
    put(x, y + h, z + 1, st('vx_palm_frond', { facing: 2 })); put(x, y + h, z - 1, st('vx_palm_frond', { facing: 0 }));
  };

  // ---------------------------------------------------------------- farm plot (local, front at v=0)
  function farm(L, o) {
    const P = L.P, rng = o.rng, w = o.w, d = o.d, F = o.F;
    const crops = o.style === 'snowy' ? ['potatoes', 'beetroots'] : ['wheat', 'carrots', 'potatoes', 'beetroots', 'wheat'];
    const crop = rng.pick(crops);
    const S = STYLES[o.style] || STYLES.meadow;
    const cells = [];
    const mid = w >> 1;
    for (let u = 0; u < w; u++) for (let v = 0; v < d; v++) {
      const gy = o.ground(u, v);
      for (let y = gy + 1; y < F; y++) P(u, y, v, 'dirt');
      for (let y = F + 1; y <= F + 3; y++) P(u, y, v, null);
      const edge = u === 0 || v === 0 || u === w - 1 || v === d - 1;
      if (edge) { P(u, F, v, 'coarse_dirt'); P(u, F + 1, v, (u === 0 || u === w - 1) && (v === 0 || v === d - 1) ? S.fence : (v === 0 && Math.abs(u - mid) <= 0 ? null : S.fence)); continue; }
      if (u === mid) { P(u, F, v, 'water'); continue; }
      P(u, F, v, 'farmland', { moisture: 7 });
      const age = rng.int(8);
      const t = R.byName[crop];
      const max = t && t.has('age') ? t.props[t.propIndex.age].n - 1 : 7;
      P(u, F + 1, v, crop, { age: Math.min(max, Math.round(age * max / 7)) });
      cells.push([u, F + 1, v]);
    }
    P(1, F + 1, 0, 'composter');
    P(w - 2, F + 1, 0, 'vx_hay');
    return { cells, crop, gate: [mid, F + 1, 0] };
  }
  VG.farm = farm;

  // ---------------------------------------------------------------- names
  const PRE = ['Bright', 'Oak', 'Star', 'Moss', 'Lumen', 'Amber', 'Willow', 'Crystal', 'Silver', 'Sun', 'Clover', 'Hearth', 'Maple', 'Honey', 'Dawn', 'Nova', 'Fern', 'River', 'Cloud', 'Aurora', 'Pine', 'Glimmer', 'Rose', 'Cedar'];
  const SUF = ['water', 'hollow', 'fall', 'vale', 'ford', 'haven', 'brook', 'rest', 'meadow', 'field', 'crest', 'glen', 'wick', 'shire', 'stead', 'reach', 'mere', 'bloom'];
  VG.dbg = null;
  VG.fail = (why) => { if (VG.dbg) VG.dbg[why] = (VG.dbg[why] || 0) + 1; return null; };
  VG.name = (seed) => { const r = new VR.RNG(M.hash2(seed, 0x7a11, 3)); r.next(); return r.pick(PRE) + r.pick(SUF); };

  // ---------------------------------------------------------------- site selection
  // v1 worlds keep their villages exactly as generated; worlds made from v0.17 on (vgen 2) get
  // larger, roomier villages spaced further apart
  const P1 = { CELL: 224, RAD: 58, M: 50 }, P2 = { CELL: 320, RAD: 78, M: 78 }, P3 = { CELL: 640, RAD: 78, M: 230 };   // vgen 5: villa-scale towns need 640-block cells
  const PAR = VG.par = (g) => (g && g.vgen >= 5) ? P3 : (g && g.vgen >= 2) ? P2 : P1;
  VG.CELL = P1.CELL; VG.RAD = P1.RAD;
  VG.cell = (g) => PAR(g).CELL; VG.rad = (g) => PAR(g).RAD;
  VG.siteRad = (g, site) => (site && site.rad) || PAR(g).RAD;
  const BAD = /ocean|river|beach|shore|swamp|mangrove|mushroom|peaks|ice_spikes|deep_dark|frozen_river|stony/;
  // a site cell's key (exact pairing: the old xor hash collided for mirrored cells)
  const siteKey = (i, j) => (i + 1048576) * 2097152 + (j + 1048576);
  // whether a site cell is computed already (a cold cell costs its terrain samples: worker_main.js computes it in a turn)
  VG.siteKnown = (g, i, j) => !!g._vilSites && g._vilSites.has(siteKey(i, j));
  // The search of a cell is a generator, siteSteps: one candidate spot per step (the home city tries up to 80), so a
  // worker builds a cold cell in slices (VG.siteAdvance). VG.site runs it to the end (the cache is g._vilSites).
  VG.siteSteps = function* (g, i, j) {
    let site = null;
    const { CELL: VCELL, M: MG } = PAR(g);
    const rng = new VR.RNG(M.hash2(i, j, g.seed + 90210));
    // the home city always exists (new worlds start there): cell (0,0), or one of its neighbours when the origin is at sea
    const home = g.vgen >= 2 && ((i === 0 && j === 0) || (Math.abs(i) <= 1 && Math.abs(j) <= 1 && !VG.site(g, 0, 0) && !g._homeFound));
    if (g.singleBiome < 0 && (home || rng.chance(0.8))) {
      for (let k = 0; k < (home ? 80 : 10) && !site; k++) {
        yield;   // one candidate per step
        const relax = home && k >= 40 ? 1.6 : 1;
        const x = i * VCELL + MG + rng.int(VCELL - 2 * MG), z = j * VCELL + MG + rng.int(VCELL - 2 * MG);
        const cl = g.climateAt(x, z);
        const h = g.surfaceY(x, z);
        if (h <= SEA + 2 || h > 150) continue;
        const bk = VR.BIOMES[g.biomeFor(cl, h)];
        if (!bk || bk.ocean || (BAD.test(bk.key) && !(home && relax > 1 && /beach|shore|stony/.test(bk.key)))) continue;
        if (cl.canyon > 0.18 || cl.ember > 0.45 || cl.river > 0.3) continue;
        // the heart must be dry & gentle; the outskirts may run down to a lake or up a hill
        let mn = h, mx = h, sum = h, n = 1, wet = 0, mn2 = h, mx2 = h;
        for (let a = 0; a < 12; a++) for (const r of [12, 26]) {
          const px = Math.round(x + Math.cos(a * 0.5236) * r), pz = Math.round(z + Math.sin(a * 0.5236) * r);
          const y = g.surfaceY(px, pz);
          if (r === 12) { if (y <= SEA + 1) wet = 99; mn = Math.min(mn, y); mx = Math.max(mx, y); sum += y; n++; }
          else { if (y <= SEA) wet++; else { mn2 = Math.min(mn2, y); mx2 = Math.max(mx2, y); } }
        }
        if (wet > 5 || mx - mn > 8 * relax || mx2 - mn2 > 18 * relax) continue;
        if (g.nearestOutpost) { const o = g.nearestOutpost(x, z); if (o && (o.x - x) ** 2 + (o.z - z) ** 2 < 125 * 125) continue; }
        let style = VG.styleFor(bk.key, cl);
        // tropical tech cities: most jungle sites, a share of the warm and temperate ones
        const techP = { jungle: 0.6, savanna: 0.3, meadow: 0.22, cherry: 0.22, prism: 0.15 }[style] || 0;
        if (techP && ((M.hash2(i, j, g.seed + 777) >>> 0) % 1000) < techP * 1000) style = 'tech';
        // rich modern towns: most meadow / cherry / savanna sites in vgen-3 worlds (the Heartland keeps its tech city)
        if (g.vgen >= 4 && VG.modern && (style === 'meadow' || style === 'cherry' || style === 'savanna') && ((M.hash2(i, j, g.seed + 991) >>> 0) % 100) < (style === 'meadow' ? 70 : 45)) style = 'modern';
        if (home) style = 'tech'; // the home city (new worlds start in its Starbase)
        site = { id: i + '_' + j, i, j, x, z, y: Math.round(sum / n), style, biome: bk.key, seed: rng.int(1 << 30), name: null };
        if (style === 'modern') site.rad = g.vgen >= 5 ? 230 : 120;   // rich towns spread wide: villa lots 30+ deep, two ring roads, farms outside
        // vgen 9: a meadow or cherry village becomes the Weißstadt, the hall city (gen_hallcity.js), where its hall fits the land
        if (!home && (style === 'meadow' || style === 'cherry') && VG.hallOn && VG.hallOn(g) && VG.hallFits(g, x, z, site.seed)) { site.style = 'hall'; site.from = style; site.rad = VG.HALL.RAD; }
        site.name = VG.name(site.seed);
        if (home) g._homeFound = true;
      }
    }
    return site;
  };
  // the cached site of a cell, else its search run to the end. In a worker job that needs the cell (VG.probe set) the
  // run ends instead, and the job waits for the cell's slices (worker_main.js).
  VG.site = function (g, i, j) {
    const key = siteKey(i, j);
    if (!g._vilSites) g._vilSites = new Map();
    if (g._vilSites.has(key)) return g._vilSites.get(key);
    if (VG.probe) { VG.probe.miss = { cell: true, i, j }; throw VG.probe; }
    if (g._vilSites.size > 600) g._vilSites.clear();
    const it = VG.siteSteps(g, i, j);
    let r;
    do { r = it.next(); } while (!r.done);
    g._vilSites.set(key, r.value);
    return r.value;
  };
  // one slice of a cell's search (a worker turn, about ms long): the site (null: none) when the search is done, else undefined
  VG.siteAdvance = function (g, i, j, ms) {
    const key = siteKey(i, j);
    if (!g._vilSites) g._vilSites = new Map();
    if (g._vilSites.has(key)) return g._vilSites.get(key);
    if (!g._siteBuild) g._siteBuild = new Map();
    let it = g._siteBuild.get(key);
    if (!it) {
      if (g._siteBuild.size >= 4) g._siteBuild.delete(g._siteBuild.keys().next().value);
      it = VG.siteSteps(g, i, j); g._siteBuild.set(key, it);
    }
    const t0 = performance.now();
    let r;
    try { do { r = it.next(); } while (!r.done && performance.now() - t0 < ms); }
    catch (e) { g._siteBuild.delete(key); throw e; }
    if (!r.done) return undefined;
    g._siteBuild.delete(key);
    if (g._vilSites.size > 600) g._vilSites.clear();
    g._vilSites.set(key, r.value);
    return r.value;
  };
  // the cells a chunk's generation reads, by layer (VG.cellNeeds: each layer adds its list; the worker computes the
  // cells of a job's needs in slices before the job runs). The village's own: its 3 x 3 cells.
  VG.cellNeeds = [];
  VG.cellNeeds.push((g, cx, cz) => VG.cellsFor(g, cx, cz));
  VG.near = function (g, x, z, pad) {
    const { CELL: VCELL, RAD } = PAR(g);
    const ci = Math.floor(x / VCELL), cj = Math.floor(z / VCELL);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const s = VG.site(g, ci + di, cj + dj);
      if (s && (s.x - x) ** 2 + (s.z - z) ** 2 < ((s.rad || RAD) + (pad || 0)) ** 2) return s;
    }
    return null;
  };
  VG.nearest = function (g, x, z, maxR) {
    const { CELL: VCELL } = PAR(g);
    const ci = Math.floor(x / VCELL), cj = Math.floor(z / VCELL);
    let best = null, bd = 1e18;
    const R0 = Math.ceil((maxR || 1500) / VCELL);
    for (let r = 0; r <= R0; r++) {
      for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const s = VG.site(g, ci + di, cj + dj);
        if (!s) continue;
        const d = (s.x - x) ** 2 + (s.z - z) ** 2;
        if (d < bd) { bd = d; best = s; }
      }
      if (best && Math.sqrt(bd) < (r - 1) * VCELL) break;
    }
    return best;
  };

  // ---------------------------------------------------------------- planning
  // plan: ops bucketed per chunk + a JSON-friendly summary for the game (homes, beds, work, farms, lots…)
  const KINDS_CIVIC = ['hall', 'bakery', 'smithy', 'library', 'clinic', 'workshop'];
  // A town's plan is built by planSteps, a generator that yields between its steps: VG.planAdvance runs it a slice
  // at a time, so a job never holds the worker for the whole plan (1.6–2.5 s for a modern town). The steps and their
  // order are unchanged, so the plan is the same whichever way it is built (test/town_slices.js).
  // an append-only list of k-number tuples in blocks of at most 16384 tuples: a block is a plain array (the values are
  // kept exactly), a new one starts when the current one is full, so an append copies at most one block
  const tupleList = (k) => {
    const L = { blocks: [], cur: null, lim: 16384 * k };
    L.push = (a, b, c, d, e) => {
      let c0 = L.cur;
      if (c0 === null || c0.length >= L.lim) { c0 = L.cur = []; L.blocks.push(c0); }
      if (k === 5) c0.push(a, b, c, d, e); else c0.push(a, b, c, d);
    };
    return L;
  };
  const planSteps = function* (g, site) {
    const rng = new VR.RNG(site.seed);
    const S = STYLES[site.style] || STYLES.meadow;
    const RAD = VG.siteRad(g, site), V2 = g.vgen >= 2;
    const HOME = !!(site.home && VR.Heart && VR.Heart.on(g) && VR.Heart.templeBase); // the Heartland's home city around the Gate Temple
    if (HOME && g.vgen >= 8 && VG.novaHaven) return yield* VG.novaHaven(g, site);   // vgen 8: the trailer's Nova Haven (gen_city.js)
    if (site.style === 'hall' && VG.hallCity) return yield* VG.hallCity(g, site);   // vgen 9: the Weißstadt hall city (gen_hallcity.js)
    const cx = site.x, cz = site.z;
    const SZ = RAD * 2 + 1, occ = new Uint8Array(SZ * SZ); // 0 free 1 road 2 plaza 3 lot 4 margin 5 path
    const oi = (x, z) => { const lx = x - cx + RAD, lz = z - cz + RAD; return (lx < 0 || lz < 0 || lx >= SZ || lz >= SZ) ? -1 : lz * SZ + lx; };
    const hcache = new Map();
    const ground = (x, z) => { const k = x * 65536 + z; let h = hcache.get(k); if (h === undefined) { h = g.surfaceY(x, z); hcache.set(k, h); } return h; };
    // op storage: x,y,z,state and x,z,y0,y1,state (tupleList: blocks, so no step copies a whole town's ops)
    const ops = tupleList(4), fills = tupleList(5);
    const crownCands = [];   // the shared palm crowns (vgen 7): [x, base, z, h, kind, road], placed by the crown pass
    const palms = [], drops = [];   // every palm placed: [kind, road, x, z, trunk h] (the node test counts them); the crowns no spot fits
    const put = (x, y, z, s) => { ops.push(x, y, z, s); };
    const fill = (x, z, y0, y1, s) => { if (y1 >= y0) fills.push(x, z, y0, y1, s); };
    // F6: towns made from vgen 6 on carry the detail layer (gen_detail.js); older towns are planned exactly as before
    const detOn = !!(VR.Detail && VR.Detail.on(g));
    const detP = (x, y, z, nm, pr) => put(x, y, z, typeof nm === 'number' ? nm : st(nm, pr));
    // the street decor draws from its own rng and runs after every lot is placed (it only takes cells nothing else
    // took), so a town keeps its roads and houses exactly as at vgen 5 and only gains the street pieces
    const detRng = new VR.RNG((site.seed ^ 0x2545f491) >>> 0), decorJobs = [];
    const AIR = 0;
    if (HOME) { const B = VR.TempleGen.box; for (let x = B.x0 - 2; x <= B.x1 + 2; x++) for (let z = B.z0 - 2; z <= B.z1 + 2; z++) { const o = oi(x, z); if (o >= 0) occ[o] = 7; } }
    const plan = { rad: RAD, id: site.id, name: site.name, style: site.style, x: cx, z: cz, y: site.y, seed: site.seed, homes: [], work: [], farms: [], lots: [], lamps: [], chimneys: [], plaza: null, roads: [], bell: null, pad: null, shops: [], pastures: [], orchards: [], windmills: [], base: null };
    // ---- plaza
    const PR = V2 ? 6 + rng.int(2) : 4 + rng.int(2);
    let py = 0, pn = 0;
    for (let dz = -PR; dz <= PR; dz++) for (let dx = -PR; dx <= PR; dx++) { py += ground(cx + dx, cz + dz); pn++; }
    py = Math.round(py / pn);
    const plazaMat = S.plaza.map(n => st(n));
    for (let dz = -PR - 1; dz <= PR + 1; dz++) for (let dx = -PR - 1; dx <= PR + 1; dx++) {
      const x = cx + dx, z = cz + dz, gy = ground(x, z);
      const rim = Math.max(Math.abs(dx), Math.abs(dz)) === PR + 1;
      occ[oi(x, z)] = 2;
      if (rim) { fill(x, z, gy + 1, py, st('dirt')); fill(x, z, py + 1, py + 8, AIR); put(x, py, z, st(site.style === 'snowy' ? 'snow_block' : 'grass_block')); continue; }
      fill(x, z, Math.min(gy, py) - 3, py - 1, st('stone'));
      fill(x, z, py + 1, Math.max(py + 10, gy + 3), AIR);
      const ring = (Math.abs(dx) + Math.abs(dz)) % 3;
      put(x, py, z, plazaMat[(ring === 0 ? 0 : ring === 1 ? 1 : (plazaMat.length > 2 ? 2 : 0))]);
    }
    plan.plaza = { x: cx, y: py + 1, z: cz, r: PR };
    // centerpiece: well (meadow…) or crystal fountain (prism)
    const wellMat = st(S.base === 'vx_sandstone' ? 'vx_sandstone' : 'vx_stonebrick');
    if (S.modern) {
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) put(cx + dx, py, cz + dz, st(dx === 0 && dz === 0 ? 'granite_paver' : 'water'));
      put(cx, py + 1, cz, st('vx_fountain'));
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if (Math.abs(dx) === 2 || Math.abs(dz) === 2) put(cx + dx, py, cz + dz, st('travertine'));
      for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) put(cx + dx, py + 1, cz + dz, st('vx_urn'));
      for (const [dx, dz] of [[-4, 0], [4, 0], [0, -4], [0, 4]]) put(cx + dx, py + 1, cz + dz, st('vx_bollard'));
    } else if (S.tech) {
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) put(cx + dx, py, cz + dz, st('vx_floor_pad'));
      put(cx, py + 1, cz, st('vx_holo_table'));
      // vgen 7: the corner palms stand in planters, so no trunk stands on the paving (no plant on a plaza)
      const pc = VR.Plants && VR.Plants.on(g) ? 4 : 3;   // vgen 7: the 7-block crowns stand 4 out, so their footprints do not meet
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const dx = sx * pc, dz = sz * pc; if (VR.Plants && VR.Plants.on(g)) { const ph = 7 + ((dx + dz + site.seed) & 1); put(cx + dx, py + 1, cz + dz, st('vx_tech_planter')); VR.Plants.palm(put, cx + dx, py + 2, cz + dz, ph); palms.push(['plaza', -1, cx + dx, cz + dz, ph]); } else { const ph = 4 + ((dx + dz + site.seed) & 1); VG.palm(put, cx + dx, py + 1, cz + dz, ph); palms.push(['plaza', -1, cx + dx, cz + dz, ph]); } }
      for (const [dx, dz] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) put(cx + dx, py + 1, cz + dz, st('vx_tech_planter'));
    } else if (S.crystals) {
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { if (dx || dz) put(cx + dx, py + 1, cz + dz, wellMat); }
      put(cx, py + 1, cz, st('aether')); put(cx, py + 2, cz, st('vx_crystal_violet'));
      for (const [dx, dz] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) put(cx + dx, py + 1, cz + dz, st('vx_planter'));
    } else {
      put(cx, py + 1, cz, st('vx_well'));
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { put(cx + dx, py + 1, cz + dz, st(S.beam, { axis: 0 })); put(cx + dx, py + 2, cz + dz, st(S.beam, { axis: 0 })); }
      const rc = 'vx_roof_' + rng.pick(S.roofs);
      put(cx - 1, py + 3, cz, st(rc, { facing: 1 })); put(cx + 1, py + 3, cz, st(rc, { facing: 3 }));
      put(cx - 1, py + 3, cz - 1, st(rc, { facing: 1 })); put(cx + 1, py + 3, cz - 1, st(rc, { facing: 3 }));
      put(cx - 1, py + 3, cz + 1, st(rc, { facing: 1 })); put(cx + 1, py + 3, cz + 1, st(rc, { facing: 3 }));
      put(cx, py + 3, cz - 1, st('vx_ridge_' + rc.slice(8), { facing: 1 })); put(cx, py + 3, cz, st('vx_ridge_' + rc.slice(8), { facing: 1 })); put(cx, py + 3, cz + 1, st('vx_ridge_' + rc.slice(8), { facing: 1 }));
    }
    // lamps at the plaza corners, benches, planters, the bell, market stalls
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const x = cx + sx * PR, z = cz + sz * PR;
      put(x, py + 1, z, st(S.lamp, { head: 0 })); put(x, py + 2, z, st(S.lamp, { head: 1 }));
      plan.lamps.push([x, py + 2, z]);
    }
    const seats = [];
    for (const [dx, dz, f] of [[0, -3, 2], [0, 3, 0], [-3, 0, 1], [3, 0, 3]]) {
      if (rng.chance(0.75)) { put(cx + dx + (f & 1 ? 0 : 1), py + 1, cz + dz + (f & 1 ? 1 : 0), st(S.bench || 'vx_bench', { facing: f })); seats.push([cx + dx + (f & 1 ? 0 : 1), py + 1, cz + dz + (f & 1 ? 1 : 0), f]); }
    }
    put(cx - PR + 1, py + 1, cz + PR - 1, st('bell', { facing: 0 }));
    plan.bell = [cx - PR + 1, py + 1, cz + PR - 1];
    const stalls = [];
    if (V2) for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(cx + sx * (PR - 2), py + 1, cz + sz * (PR - 2), st(site.style === 'snowy' ? 'vx_planter' : 'vx_flowerbed'));
    for (const [dx, dz, f] of (V2 ? [[PR - 1, -3, 3], [PR - 1, 0, 3], [PR - 1, 3, 3], [-PR + 1, -3, 1], [-PR + 1, 0, 1]] : [[PR - 1, -2, 3], [PR - 1, 2, 3], [-PR + 1, -2, 1]])) {
      if (!rng.chance(0.7)) continue;
      const x = cx + dx, z = cz + dz;
      put(x, py + 1, z, st('vx_counter', { facing: f }));
      put(x, py + 3, z, st('vx_awning_' + rng.pick(['red', 'blue', 'green', 'yellow']), { facing: f }));
      put(x + (f === 3 ? 1 : -1), py + 1, z, st(rng.chance(0.5) ? 'vx_crate' : 'vx_barrel'));
      stalls.push([x - (f === 3 ? 1 : -1), py + 1, z, f]);
    }
    plan.plaza.seats = seats; plan.plaza.stalls = stalls;
    yield;
    // ---- roads
    const nR = HOME ? 6 : S.modern ? 4 : V2 ? 4 + rng.int(3) : 3 + rng.int(3);
    const a0 = HOME ? Math.PI / 2 : S.modern ? Math.PI / 4 : rng.next() * Math.PI * 2;
    // modern towns: the mansion (town hall) stands north of the plaza, facing it across a paved forecourt
    let mansionLot = null;
    if (S.modern && VG.modern) {
      const [mw, md] = VG.modern.DIMS.hall[0], du = mw >> 1;
      const fcx = cx, fcz = cz - PR - 6, ox = fcx + du, oz = fcz;   // r = 2: the lot runs north, u runs west
      let ok = true, mn = 999, mx = -999;
      for (let u = -3; u < mw + 3 && ok; u++) for (let v = -3; v < md + 3; v++) { const x = ox - u, z = oz - v, o = oi(x, z); if (o < 0 || occ[o] === 2) { ok = false; break; } if (u >= 0 && u < mw && v >= 0 && v < md) { const y = ground(x, z); if (y <= SEA) { ok = false; break; } mn = Math.min(mn, y); mx = Math.max(mx, y); } }
      if (ok && mx - mn <= 12) {
        for (let u = -3; u < mw + 3; u++) for (let v = -3; v < md + 3; v++) { const o = oi(ox - u, oz - v); const inner = u >= 0 && u < mw && v >= 0 && v < md; occ[o] = inner ? 3 : 7; }
        mansionLot = { kind: 'hall', w: mw, d: md, r: 2, ox, oz, F: Math.max(py, mx - 3) + 1, road: 0, fcx, fcz, mn };
        // pave the forecourt between the plaza rim and the mansion's own plaza
        for (let x = cx - 8; x <= cx + 8; x++) for (let z = fcz + 4; z <= cz - PR - 1; z++) { const gy = ground(x, z), o = oi(x, z); if (o < 0) continue; if (occ[o] === 7) occ[o] = 5; fill(x, z, gy + 1, py - 1, st('dirt')); fill(x, z, py + 1, py + 6, AIR); put(x, py, z, st('granite_paver')); }
      }
    }
    const roadCells = [];
    const pathS = st(S.path), pathAlt = S.pathAlt ? st(S.pathAlt) : st(site.style === 'desert' ? 'sandstone' : 'coarse_dirt');
    const roads = [];
    const lineCells = new Set();
    const ringR = V2 ? (S.modern ? (RAD >= 200 ? [72 + rng.int(3), 158 + rng.int(3)] : [40 + rng.int(3), 82 + rng.int(3)]) : [31 + rng.int(8)]) : [];
    const zebra = new Map();   // "x,z" → axis: zebra crossings at the plaza exits and where the ring roads cross the radials
    const zebraAt = (px, pz, nx, nz, pa) => { const ax = Math.abs(Math.cos(pa)) >= Math.abs(Math.sin(pa)) ? 1 : 0; for (let wv = -1; wv <= 1; wv++) zebra.set(Math.round(px + nx * wv) + ',' + Math.round(pz + nz * wv), ax); };
    for (let r = 0; r < nR; r++) {
      yield;
      let ang = a0 + r * Math.PI * 2 / nR + (HOME && r === 0 ? 0 : (rng.next() - 0.5) * 0.5);
      const L = HOME ? (r === 0 ? 140 : 70 + rng.int(24)) : S.modern ? RAD - 6 : V2 ? 54 + rng.int(20) : 30 + rng.int(20);
      const pts = [];
      let x = cx + Math.cos(ang) * (PR + 1), z = cz + Math.sin(ang) * (PR + 1);
      const curve = HOME && r === 0 ? 0 : (rng.next() - 0.5) * (HOME ? 0.05 : 0.03);
      for (let t = 0; t < L; t++) {
        ang += curve;
        x += Math.cos(ang); z += Math.sin(ang);
        const ix = Math.round(x), iz = Math.round(z);
        const o0 = oi(ix, iz);
        if (o0 < 0 || Math.hypot(ix - cx, iz - cz) > RAD - 4 || occ[o0] === 7) break;
        pts.push([ix, iz, ang]);
      }
      // smoothed heights along the road (terraced lanes)
      const hs = pts.map(p => ground(p[0], p[1]));
      const sm = hs.map((h, k) => { let s2 = 0, n2 = 0; for (let q = -3; q <= 3; q++) { const hh2 = hs[k + q]; if (hh2 !== undefined) { s2 += hh2; n2++; } } return Math.round(s2 / n2); });
      // ease into the plaza height
      for (let k = 0; k < Math.min(6, sm.length); k++) sm[k] = Math.round(py + (sm[k] - py) * (k / 6));
      const road = { pts: [], ang: pts.length ? pts[0][2] : ang };
      let lastC = null;
      for (let k = 0; k < pts.length; k++) {
        const [px, pz, pa] = pts[k];
        const ry = sm[k];
        const nx = -Math.sin(pa), nz = Math.cos(pa);
        const RW = S.sidewalk ? 2 : 1;
        for (let wv = -RW; wv <= RW; wv++) {
          const qx = Math.round(px + nx * wv), qz = Math.round(pz + nz * wv);
          const o = oi(qx, qz);
          if (o < 0 || occ[o] === 2 || occ[o] === 7) continue;
          if (occ[o] !== 1) { occ[o] = 1; roadCells.push([qx, qz, ry, Math.abs(wv) === 2 ? 1 : 0]); }
        }
        if (S.trees && k % 10 === 4 && k > 4) {
          // street trees on the sidewalk line, alternating sides
          const side = (k / 10 | 0) % 2 ? -1 : 1;
          const tx = Math.round(px + nx * 3 * side), tz = Math.round(pz + nz * 3 * side), o2 = oi(tx, tz);
          if (o2 >= 0 && occ[o2] === 0) { occ[o2] = 6; const gy = ground(tx, tz), ty = Math.max(gy, ry); fill(tx, tz, gy + 1, ty, st('dirt')); put(tx, ty, tz, st(detOn && S.modern ? 'dirt' : 'grass_block')); if (detOn && S.modern) decorJobs.push(() => VR.Detail.treeGrate({ P: detP, occ, oi, ground, plan }, tx, ty, tz, st, fill)); fill(tx, tz, ty + 1, ty + 8, AIR); const f = ['apple', 'cherry', 'plum', 'orange'][(tx + tz) & 3]; put(tx, ty + 1, tz, st('vx_fruit_trunk')); put(tx, ty + 2, tz, st('vx_fruit_trunk')); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { put(tx + a, ty + 3, tz + b, st('vx_fruit_crown_' + f)); if (Math.abs(a) + Math.abs(b) <= 1) put(tx + a, ty + 4, tz + b, st('vx_fruit_crown_' + f)); } }
        }
        if (S.pathLine) {
          if (S.tech) {
            // the trailer's streets glow along both edges
            for (const sd of [1, -1]) { const ex = Math.round(px + nx * sd), ez = Math.round(pz + nz * sd); const lk = lastC && lastC[sd > 0 ? 2 : 3]; if (lk && lk[0] !== ex && lk[1] !== ez) lineCells.add(ex + ',' + lk[1]); lineCells.add(ex + ',' + ez); }
            lastC = [px, pz, [Math.round(px + nx), Math.round(pz + nz)], [Math.round(px - nx), Math.round(pz - nz)]];
          } else {
            // centre line, stepping round diagonal moves so the light-line stays connected
            if (lastC && lastC[0] !== px && lastC[1] !== pz) lineCells.add(px + ',' + lastC[1]);
            lineCells.add(px + ',' + pz); lastC = [px, pz];
          }
        }
        if (S.palms && k % 9 === 1 && k > 3) {
          const side = (k / 9 | 0) % 2 ? -1 : 1;
          const tx = Math.round(px + nx * 3 * side), tz = Math.round(pz + nz * 3 * side);
          let free = true;
          for (let a = -1; a <= 1 && free; a++) for (let b = -1; b <= 1; b++) { const o2 = oi(tx + a, tz + b); if (o2 < 0 || (occ[o2] !== 0 && occ[o2] !== 4)) { free = false; break; } }
          if (free) { for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) occ[oi(tx + a, tz + b)] = 6; const gy = ground(tx, tz), ty = Math.max(gy, ry); fill(tx, tz, gy + 1, ty, st('dirt')); put(tx, ty, tz, st('grass_block')); if (VR.Plants && VR.Plants.on(g)) crownCands.push([tx, ty + 1, tz, 7 + ((tx + tz) & 3), 'street', r]);   // vgen 7: the avenue's shared crown (the crown pass places it; no air column is cleared under it)
          else { const ph = 7 + ((tx + tz) & 3) + ((tx * 7 + tz) % 3 === 0 ? 2 : 0); fill(tx, tz, ty + 1, ty + 14, AIR); VG.palm(put, tx, ty + 1, tz, ph); palms.push(['street', r, tx, tz, ph]); } }
        }
        road.pts.push([px, ry + 1, pz]);
        if (S.modern) { const dist = Math.hypot(px - cx, pz - cz); if (k === 4 || ringR.some(Rr => Math.abs(Math.round(dist) - Rr) === 4)) zebraAt(px, pz, nx, nz, pa); }
        if (k % 9 === 5) {
          const side = (k / 9 | 0) % 2 ? 1 : -1;
          const lx = Math.round(px + nx * 2 * side), lz = Math.round(pz + nz * 2 * side);
          const o = oi(lx, lz);
          if (o >= 0 && occ[o] === 0) { occ[o] = 6; const gy = ground(lx, lz); const ly = Math.max(gy, ry); fill(lx, lz, gy + 1, ly, st('dirt')); put(lx, ly + 1, lz, st(S.lamp, { head: 0 })); put(lx, ly + 2, lz, st(S.lamp, { head: 1 })); fill(lx, lz, ly + 3, ly + 5, AIR); plan.lamps.push([lx, ly + 2, lz]); }
        }
      }
      if (detOn && S.modern) decorJobs.push(() => VR.Detail.roadDecor({ P: detP, occ, oi, ground, st, fill, AIR, rng: detRng, plan }, pts, sm, S));
      roads.push(road);
      plan.roads.push(road.pts.filter((_, k) => k % 3 === 0));
    }
    // v2: a ring lane links the radial streets (more street frontage, blocks of houses between the streets)
    if (V2) for (const Rr of ringR) {
      const roadY = new Map(); for (const [x, z, y] of roadCells) roadY.set(x + ',' + z, y);
      const N = Math.ceil(2 * Math.PI * Rr * 1.6);
      const segs = []; let seg = null, last = null;
      for (let k = 0; k <= N; k++) {
        const an = a0 + k / N * Math.PI * 2;
        const ix = Math.round(cx + Math.cos(an) * Rr), iz = Math.round(cz + Math.sin(an) * Rr);
        if (last && last[0] === ix && last[1] === iz) continue;
        last = [ix, iz];
        const o = oi(ix, iz), gy = ground(ix, iz);
        if (o < 0 || occ[o] === 2 || occ[o] === 7 || gy <= SEA + 1) { seg = null; continue; }
        if (!seg) { seg = []; segs.push(seg); }
        seg.push([ix, iz, an + Math.PI / 2]);
      }
      for (const pts of segs) {
        yield;
        if (pts.length < 12) continue;
        const pin = pts.map(p => roadY.get(p[0] + ',' + p[1]));
        const hs = pts.map((p, k) => pin[k] !== undefined ? pin[k] : ground(p[0], p[1]));
        const sm = hs.map((h, k) => { if (pin[k] !== undefined) return pin[k]; let s2 = 0, n2 = 0; for (let q = -3; q <= 3; q++) { const hh2 = hs[k + q]; if (hh2 !== undefined) { s2 += hh2; n2++; } } return Math.round(s2 / n2); });
        for (let it = 0; it < 3; it++) { for (let k = 1; k < sm.length; k++) if (pin[k] === undefined) sm[k] = Math.max(sm[k - 1] - 1, Math.min(sm[k - 1] + 1, sm[k])); for (let k = sm.length - 2; k >= 0; k--) if (pin[k] === undefined) sm[k] = Math.max(sm[k + 1] - 1, Math.min(sm[k + 1] + 1, sm[k])); }
        const road = { pts: [], ang: pts[0][2], ring: true };
        for (let k = 0; k < pts.length; k++) {
          const [px, pz, pa] = pts[k], ry = sm[k], nx = -Math.sin(pa), nz = Math.cos(pa);
          const RW = S.sidewalk ? 2 : 1;
          for (let wv = -RW; wv <= RW; wv++) {
            const qx = Math.round(px + nx * wv), qz = Math.round(pz + nz * wv), o = oi(qx, qz);
            if (o < 0 || occ[o] === 2 || occ[o] === 1 || occ[o] === 7) continue;
            occ[o] = 1; roadCells.push([qx, qz, ry, Math.abs(wv) === 2 ? 1 : 0]);
          }
          road.pts.push([px, ry + 1, pz]);
          if (S.modern) {
            // zebra crossings four cells before and after every junction with a radial street
            if (pin[k] !== undefined && pin[k - 1] === undefined && k >= 4) zebraAt(pts[k - 4][0], pts[k - 4][1], -Math.sin(pts[k - 4][2]), Math.cos(pts[k - 4][2]), pts[k - 4][2]);
            if (pin[k] !== undefined && pin[k + 1] === undefined && k + 4 < pts.length) zebraAt(pts[k + 4][0], pts[k + 4][1], -Math.sin(pts[k + 4][2]), Math.cos(pts[k + 4][2]), pts[k + 4][2]);
            // bus shelters and benches on the outer pavement
            const stop = k % 31 === 15, bench = k % 31 === 0;
            if (stop || bench) {
              const side = 1, cells = [];
              let ok = true;
              for (let q = 0; q < (stop ? 3 : 1) && ok; q++) { const pt = pts[k + q]; if (!pt) { ok = false; break; } const qn = [-Math.sin(pt[2]), Math.cos(pt[2])]; for (const wv of [3, 4]) { const qx = Math.round(pt[0] + qn[0] * wv * side), qz = Math.round(pt[1] + qn[1] * wv * side), o = oi(qx, qz); if (o < 0 || occ[o] !== 0 || Math.abs(ground(qx, qz) - ry) > 2) { ok = false; break; } cells.push([qx, qz, wv, q]); } }
              if (ok) {
                for (const [qx, qz] of cells) { occ[oi(qx, qz)] = 6; const gy = ground(qx, qz); fill(qx, qz, gy + 1, ry, st('dirt')); put(qx, ry, qz, st(S.sidewalk)); fill(qx, qz, ry + 1, ry + 6, AIR); }
                if (stop) {
                  for (const [qx, qz, wv, q] of cells) { if (wv === 3 && (q === 0 || q === 2)) { for (let y = ry + 1; y <= ry + 3; y++) put(qx, y, qz, st('black_metal')); } if (wv === 3 && q === 1) put(qx, ry + 1, qz, st('vx_bench', { facing: ((Math.round(pts[k + 1][2] / (Math.PI / 2)) + 1) & 3) })); put(qx, ry + 4, qz, st('roof_charcoal_slab', { type: 'bottom' })); if (wv === 4 && q === 1) { for (let y = ry + 1; y <= ry + 2; y++) put(qx, y, qz, st('frosted_glass')); } }
                  const sp = cells.find(c => c[2] === 4 && c[3] === 2); if (sp) put(sp[0], ry + 1, sp[1], st('vx_sign', { facing: 0, icon: 2 }));
                } else { const b = cells.find(c => c[2] === 3); if (b) put(b[0], ry + 1, b[1], st('vx_bench', { facing: ((Math.round(pts[k][2] / (Math.PI / 2)) + 1) & 3) })); const pl = cells.find(c => c[2] === 4); if (pl) put(pl[0], ry + 1, pl[1], st('vx_tech_planter')); }
              }
            }
          }
          if (k % 11 === 6) {
            const side = (k / 11 | 0) % 2 ? 1 : -1, lx = Math.round(px + nx * 2 * side), lz = Math.round(pz + nz * 2 * side), o = oi(lx, lz);
            if (o >= 0 && occ[o] === 0) { occ[o] = 6; const gy = ground(lx, lz), ly = Math.max(gy, ry); fill(lx, lz, gy + 1, ly, st('dirt')); put(lx, ly + 1, lz, st(S.lamp, { head: 0 })); put(lx, ly + 2, lz, st(S.lamp, { head: 1 })); fill(lx, lz, ly + 3, ly + 5, AIR); plan.lamps.push([lx, ly + 2, lz]); }
          }
        }
        roads.push(road);
        plan.roads.push(road.pts.filter((_, k) => k % 3 === 0));
      }
    }
    const lineS = S.pathLine ? st(S.pathLine) : 0, walkS = S.sidewalk ? st(S.sidewalk) : 0;
    let steps = 0;
    for (const [x, z, y, walk] of roadCells) {
      if ((++steps & 255) === 0) yield;
      const gy = ground(x, z);
      if (gy < y) fill(x, z, gy + 1, y - 1, st(site.style === 'desert' ? 'sandstone' : 'dirt'));
      fill(x, z, y + 1, Math.max(y + 4, gy + 2), AIR);
      if (walk && walkS) { put(x, y, z, walkS); continue; }
      if (zebra.has(x + ',' + z)) { put(x, y, z, st('asphalt_zebra', { axis: zebra.get(x + ',' + z) })); continue; }
      put(x, y, z, lineS && lineCells.has(x + ',' + z) ? (S.modern ? st('asphalt_dash', { axis: 0 }) : lineS) : (M.hash2(x, z, 5) & 7) === 0 ? pathAlt : pathS);
    }
    // ---- lots along the roads
    const lotsWanted = [];
    const MODERN = !!(S.modern && VG.modern);
    const civic = MODERN ? VG.modern.CIVIC.filter(k => k !== 'hall') : KINDS_CIVIC.filter(() => true);
    const MU = V2 ? 2 : 1, MV = V2 ? 3 : 2; // yard margins at the sides & back / in front
    const tryLot = (kind, w, d, road, k, side) => {
      const p = road.pts[k]; if (!p) return null;
      const ang = Math.atan2(road.pts[Math.min(road.pts.length - 1, k + 1)][2] - road.pts[Math.max(0, k - 1)][2], road.pts[Math.min(road.pts.length - 1, k + 1)][0] - road.pts[Math.max(0, k - 1)][0]);
      const nx = -Math.sin(ang) * side, nz = Math.cos(ang) * side; // from road toward the lot
      // front of the lot faces the road: pick the axis rotation closest to -n
      const fx = -nx, fz = -nz; // desired front direction
      let r;
      if (Math.abs(fx) > Math.abs(fz)) r = fx > 0 ? 1 : 3; else r = fz > 0 ? 2 : 0;
      // lot front-centre sits 3 blocks from the road centre
      const gap = 3 + (V2 ? 1 : 0) + (kind === 'farm' ? 1 : 0) + (Math.abs(Math.abs(nx) - Math.abs(nz)) < 0.5 ? 1 : 0) + (S.sidewalk ? 2 : 0) + (S.modern && kind === 'hall' ? 2 : 0);
      const fcx = Math.round(p[0] + nx * gap), fcz = Math.round(p[2] + nz * gap);
      // origin (u=0,v=0) from front centre: front centre = origin + rot(w>>1, 0)
      const du = w >> 1;
      const off = ROT[r](du, 0);
      const ox = fcx - off[0], oz = fcz - off[1];
      // footprint check: the building must sit on free ground, its 1-block margin may not touch other
      // buildings or the plaza, and only the second row in front may touch the road
      let mn = 999, mx = -999;
      for (let u = -MU; u < w + MU; u++) for (let v = -MV; v < d + MU; v++) {
        const q = ROT[r](u, v), x = ox + q[0], z = oz + q[1];
        const o = oi(x, z);
        if (o < 0) return null;
        const c = occ[o];
        const inner = u >= 0 && u < w && v >= 0 && v < d;
        if (inner) { if (c !== 0 && c !== 6) return VG.fail('inner' + c); } // a street lamp or palm gives way to a building
        else if (c === 3 || c === 2) return VG.fail('margin' + c);
        if (Math.hypot(x - cx, z - cz) > RAD - 2) return VG.fail('radius');
        if (inner && (u === 0 || u === w - 1 || v === 0 || v === d - 1 || (u === du && v === d >> 1))) { const y = ground(x, z); if (y <= SEA) return null; mn = Math.min(mn, y); mx = Math.max(mx, y); }
      }
      if (mx - mn > (kind === 'base' || (S.modern && (kind === 'hall' || kind === 'factory' || kind === 'school')) ? 9 : (S.modern && (kind === 'home' || kind === 'lot')) ? 8 : V2 ? 6 : 5)) return VG.fail('steep');
      for (let u = -MU; u < w + MU; u++) for (let v = -MV; v < d + MU; v++) {
        const q = ROT[r](u, v), o = oi(ox + q[0], oz + q[1]);
        const inner = u >= 0 && u < w && v >= 0 && v < d;
        if (inner) occ[o] = 3; else if (occ[o] === 0) occ[o] = 4;
      }
      return { kind, w, d, r, ox, oz, F: Math.max(mx, road.pts[k][1] - 1) + (kind === 'farm' || kind === 'garden' || kind === 'park' || kind === 'pasture' || kind === 'orchard' ? 0 : 1), road: k, fcx, fcz, mn };
    };
    const lots = [];
    if (mansionLot) lots.push(mansionLot);
    const kindsQueue = [];
    const nCivic = MODERN ? civic.length : Math.min(civic.length, 2 + rng.int(3));
    const pool = civic.slice(1);
    for (let k = pool.length - 1; k > 0; k--) { const q = rng.int(k + 1); const t = pool[k]; pool[k] = pool[q]; pool[q] = t; }
    kindsQueue.push(civic[0]);
    if (V2) kindsQueue.push('market');
    if (V2 && S.tech && !HOME) kindsQueue.unshift('base');
    for (let k = 1; k < nCivic; k++) kindsQueue.push(pool[k - 1]);
    const order = [];
    for (let ri = 0; ri < roads.length; ri++) for (let k = 3; k < roads[ri].pts.length - 2; k += 2) order.push([k, ri]);
    order.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let reserve = 1 + rng.int(2), farmsLeft = V2 ? 3 + rng.int(2) : 2 + rng.int(2);
    const stead = !V2 ? null : S.crops !== false ? { pasture: 1 + rng.int(2), orchard: 1 + rng.int(2), barn: 1 + rng.int(2), windmill: S.tech ? 0 : rng.chance(0.7) ? 1 : 0 } : { pasture: 1 + rng.int(2), barn: 1 };
    const pickStead = () => { if (!stead) return null; const opts = []; if (farmsLeft > 0) opts.push('farm', 'farm'); for (const k in stead) if (stead[k] > 0) opts.push(k); return opts.length ? opts[rng.int(opts.length)] : null; };
    const usedKinds = new Set(), kindFails = {};
    for (const [k, ri] of order) {
      yield;
      for (const side of [1, -1]) {
        if (lots.length > (S.modern ? 96 : V2 ? 70 : 22)) break;
        const rp = roads[ri].pts[k];
        const far = V2 ? Math.hypot(rp[0] - cx, rp[2] - cz) > RAD * 0.56 : k > roads[ri].pts.length * 0.6;
        let kind = 'home';
        if (kindsQueue.length && !far) { kind = kindsQueue[0]; }
        else if (V2 && far && rng.chance(0.75) && pickStead()) kind = pickStead();
        else if (!V2 && far && farmsLeft > 0 && S.crops !== false && rng.chance(0.65)) kind = 'farm';
        else if (far && reserve > 0 && rng.chance(0.35)) kind = 'lot';
        else if (!usedKinds.has('garden') && !usedKinds.has('park') && rng.chance(0.15)) kind = 'garden';
        if (MODERN && kind === 'garden') kind = 'park';
        const mdims = MODERN && VG.modern.DIMS[kind === 'lot' ? 'home' : kind];
        const dims = mdims ? mdims[kind === 'home' || kind === 'lot' ? rng.int(mdims.length) : 0].slice() : V2 ? ({ farm: [9 + rng.int(2) * 2, 11 + rng.int(4)], hall: [11, 8], garden: [6, 6], home: S.tech ? [7 + rng.int(5), 7 + rng.int(5)] : [6 + rng.int(3), 6 + rng.int(3)], lot: [6 + rng.int(2), 6 + rng.int(2)], market: [14, 11], base: [15, 22], barn: [9, 7], pasture: [9 + rng.int(3), 8 + rng.int(3)], orchard: [9 + rng.int(3), 9 + rng.int(2)], windmill: [5, 5] }[kind] || [8, 6 + rng.int(2)])
          : kind === 'farm' ? [7 + rng.int(2) * 2, 9 + rng.int(3)] : kind === 'hall' ? [9, 7] : kind === 'garden' ? [5, 5] : kind === 'home' || kind === 'lot' ? [5 + rng.int(3), 5 + rng.int(3)] : [7, 5 + rng.int(2)];
        let lot = tryLot(kind, dims[0], dims[1], roads[ri], k, side);
        yield;
        if (!lot && mdims && mdims.length > 1) {
          // smaller variants of a modern building, largest first (homes: the whole catalogue below the picked size)
          const smaller = mdims.filter(dm => dm[0] * dm[1] < dims[0] * dims[1]).sort((p, q) => q[0] * q[1] - p[0] * p[1]);
          for (const dm of (kind === 'home' || kind === 'lot' ? smaller : [mdims[mdims.length - 1]])) { lot = tryLot(kind, dm[0], dm[1], roads[ri], k, side); yield; if (lot) break; }
        }
        if (!lot && kind === kindsQueue[0]) { kindFails[kind] = (kindFails[kind] || 0) + 1; if (kindFails[kind] >= 6) { kindsQueue.push(kindsQueue.shift()); kindFails[kind] = 0; } }
        if (!lot && (kind === 'farm' || kind === 'lot' || kind === 'garden' || kind === 'park' || (stead && stead[kind] !== undefined))) { kind = 'home'; lot = MODERN ? (VG.modern.DIMS.home.length ? tryLot(kind, VG.modern.DIMS.home[VG.modern.DIMS.home.length - 1][0], VG.modern.DIMS.home[VG.modern.DIMS.home.length - 1][1], roads[ri], k, side) : null) : V2 ? tryLot(kind, 6 + rng.int(2), 6 + rng.int(2), roads[ri], k, side) : tryLot(kind, 5 + rng.int(2), 5 + rng.int(2), roads[ri], k, side); }
        yield;
        if (!lot) continue;
        if (kind === kindsQueue[0]) kindsQueue.shift();
        if (kind === 'farm') farmsLeft--; if (kind === 'lot') reserve--; if (stead && stead[kind] !== undefined) stead[kind]--; usedKinds.add(kind);
        lots.push(lot);
      }
    }
    // every village keeps at least one plot for its builders to grow on (the farthest home becomes a construction site)
    if (!lots.some(l => l.kind === 'lot')) {
      let far = null, fd = -1;
      for (const l of lots) { if (l.kind !== 'home') continue; const d = (l.fcx - cx) ** 2 + (l.fcz - cz) ** 2; if (d > fd) { fd = d; far = l; } }
      if (far && lots.filter(l => l.kind === 'home').length > 3) far.kind = 'lot';
    }
    // ================================================================ v2 villages: shops, farmsteads, yards
    // (lot-local coordinates: u across the front, v from the front (v = 0) to the back; facing 0 = toward the road)
    const decoUsed = new Set();
    const wxz = (lot, u, v) => { const q = ROT[lot.r](u, v); return [lot.ox + q[0], lot.oz + q[1]]; };
    const yardFree = (lot, u, v) => { const [x, z] = wxz(lot, u, v); const o = oi(x, z); if (o < 0 || occ[o] !== 4 || decoUsed.has(x + ',' + z)) return false; return true; };
    const claim = (lot, u, v) => { const [x, z] = wxz(lot, u, v); decoUsed.add(x + ',' + z); };
    const W3 = (lot, u, y, v) => { const [x, z] = wxz(lot, u, v); return [x, y, z]; };
    // a supermarket: glass front with sliding doors, aisles of stacked shelves, fridges along the back,
    // checkouts with cashiers by the doors, self-checkouts, carts, a glowing sign
    function buildMarket(lot, L, lrng) {
      const P = L.P, w = lot.w, d = lot.d, F = lot.F, H = 5;
      const wall = S.tech ? 'vx_tech_white' : S.modern ? 'stucco_white' : 'vx_plaster_white', band = S.tech ? 'vx_tech_band' : S.modern ? 'charcoal_panel' : 'vx_redbrick';
      const du = w >> 1; // doors at du - 1, du
      for (let u = 0; u < w; u++) for (let v = 0; v < d; v++) {
        const gy = lot.ground ? lot.ground(u, v) : F;
        for (let y = gy + 1; y < F; y++) P(u, y, v, S.base);
        P(u, F, v, 'vx_shop_floor');
        const edge = u === 0 || v === 0 || u === w - 1 || v === d - 1;
        for (let y = F + 1; y <= F + H; y++) {
          if (!edge) { P(u, y, v, null); continue; }
          if (v === 0 && u > 0 && u < w - 1 && y <= F + 3) { P(u, y, v, (u === du - 1 || u === du) && y <= F + 2 ? 'vx_shop_door' : 'vx_glass_wall', { facing: 0, open: 0 }); continue; }
          P(u, y, v, y === F + 1 && !S.tech ? band : (y === F + H && S.tech ? 'vx_tech_band' : wall));
        }
        // flat roof with a parapet
        P(u, F + H + 1, v, S.tech ? 'vx_tech_white' : S.modern ? 'roof_charcoal' : 'vx_stonebrick');
        if (edge) P(u, F + H + 2, v, S.tech ? 'vx_tech_railing' : S.modern ? 'vx_railing_black' : 'stone_brick_wall');
      }
      // store sign over the entrance, lamps and a cart bay outside
      for (let u = 2; u < w - 2; u++) P(u, F + 4, -1, 'vx_shop_sign', { facing: 0 });
      P(1, F + 1, -2, 'vx_shop_cart_bay', { facing: 0 }); P(2, F + 1, -2, 'vx_shop_cart_bay', { facing: 0 });
      P(w - 2, F + 1, -2, S.bench || 'vx_bench', { facing: 0 });
      // aisles: rows of two-high shelves from v = 3 to d - 4, back-to-back pairs
      const cats = ['bakery', 'cereal', 'pantry', 'snacks', 'sweets', 'drinks', 'dairy', 'home', 'pharmacy', 'toys', 'tech', 'flowers', 'fruit', 'veg'];
      let ci = lrng.int(cats.length);
      const shelfRow = (u, face) => { for (let v = 3; v <= d - 4; v++) { const c = cats[ci++ % cats.length]; P(u, F + 1, v, 'vx_shop_shelf_' + c, { facing: face }); P(u, F + 2, v, 'vx_shop_shelf_' + c, { facing: face }); } };
      // wall rows: produce and fresh food on the left, deli & bakery counters on the right
      for (let v = 3; v <= d - 4; v++) {
        const k = v - 3;
        P(1, F + 1, v, k < 2 ? 'vx_shop_produce' : k === 2 ? 'vx_shop_flower_stand' : 'vx_shop_shelf_' + (k & 1 ? 'fruit' : 'veg'), { facing: 1 });
        if (k >= 3) P(1, F + 2, v, 'vx_shop_shelf_' + (k & 1 ? 'fruit' : 'veg'), { facing: 1 });
        P(w - 2, F + 1, v, k < 2 ? 'vx_shop_deli' : k < 4 ? 'vx_shop_bakery_case' : 'vx_shop_freezer', { facing: 3 });
      }
      // island pairs, leaving the centre aisle (in front of the doors) open
      for (const u of [3, 4, w - 5, w - 4]) if (u > 2 && u < w - 3 && Math.abs(u - (du - 0.5)) > 1.6) shelfRow(u, u < du ? (u === 3 ? 3 : 1) : (u === w - 4 ? 1 : 3));
      // fridges along the back wall
      for (let u = 1; u < w - 1; u++) { const k = u < du ? 'vx_shop_fridge_drinks' : 'vx_shop_fridge_dairy'; P(u, F + 1, d - 2, k, { facing: 0 }); P(u, F + 2, d - 2, k, { facing: 0 }); }
      // promo island at the end of the centre aisle
      P(du - 1, F + 1, d - 3, 'vx_shop_promo', { facing: 0 }); P(du, F + 1, d - 3, 'vx_shop_promo', { facing: 0 });
      // checkouts by the entrance (cashier stands between counter and wall), self-checkouts, baskets
      P(2, F + 1, 2, 'vx_shop_checkout', { facing: 1 }); P(2, F + 1, 1, 'vx_shop_checkout_end', { facing: 1 });
      P(w - 3, F + 1, 2, 'vx_shop_checkout', { facing: 3 }); P(w - 3, F + 1, 1, 'vx_shop_checkout_end', { facing: 3 });
      P(du - 3, F + 1, 1, 'vx_shop_selfcheckout', { facing: 2 }); P(du + 2, F + 1, 1, 'vx_shop_selfcheckout', { facing: 2 });
      P(du - 2, F + 1, 1, 'vx_shop_basket_stack'); P(du + 1, F + 1, 1, 'vx_shop_cart_bay', { facing: 2 });
      // ceiling lights along the aisles and aisle number signs
      for (let v = 1; v < d - 1; v++) for (const u of [2, du - 1, du, w - 3]) P(u, F + H, v, 'vx_shop_light');
      let n = 0; for (const u of [2, du - 1, w - 3]) P(u, F + H - 1, (d >> 1), 'vx_shop_aisle_sign', { n: n++ });
      return {
        box: (() => { const a = W3(lot, 0, F, 0), b = W3(lot, w - 1, F, d - 1); return [Math.min(a[0], b[0]), F + 1, Math.min(a[2], b[2]), Math.max(a[0], b[0]), F + H, Math.max(a[2], b[2])]; })(),
        doors: [W3(lot, du - 1, F + 1, 0), W3(lot, du, F + 1, 0)],
        exit: W3(lot, du, F + 1, -3), inside: W3(lot, du, F + 1, 2),
        tills: [{ cashier: W3(lot, 1, F + 1, 2), lane: W3(lot, 3, F + 1, 2), counter: W3(lot, 2, F + 1, 2), face: (lot.r + 1) & 3 }, { cashier: W3(lot, w - 2, F + 1, 2), lane: W3(lot, w - 4, F + 1, 2), counter: W3(lot, w - 3, F + 1, 2), face: (lot.r + 3) & 3 }],
        carts: [W3(lot, du + 1, F + 1, 2), W3(lot, 1, F + 1, -3), W3(lot, 2, F + 1, -3)],
        work: [['cashier', 1, F + 1, 2], ['cashier', w - 2, F + 1, 2], ['stock', du - 1, F + 1, d - 3]],
      };
    }
    // fenced pasture with a trough, hay and a little shelter; the game puts animals in it
    function buildPasture(lot, L, lrng) {
      const P = L.P, w = lot.w, d = lot.d, F = lot.F, du = w >> 1;
      for (let u = 0; u < w; u++) for (let v = 0; v < d; v++) {
        const gy = lot.ground(u, v);
        for (let y = gy + 1; y < F; y++) P(u, y, v, 'dirt');
        P(u, F, v, site.style === 'snowy' ? 'snow_block' : site.style === 'desert' ? 'coarse_dirt' : 'grass_block');
        for (let y = F + 1; y <= F + 4; y++) P(u, y, v, null);
        const edge = u === 0 || v === 0 || u === w - 1 || v === d - 1;
        if (edge && !(v === 0 && Math.abs(u - du) <= 0)) P(u, F + 1, v, S.fence);
        else if (!edge && lrng.chance(0.12) && site.style !== 'snowy' && site.style !== 'desert') P(u, F + 1, v, lrng.pick(['short_grass', 'dandelion', 'poppy', 'short_grass']));
      }
      for (let u = 2; u <= 4; u++) P(u, F + 1, d - 2, 'vx_trough', { facing: 0 });
      P(w - 2, F + 1, 1, 'vx_hay'); P(w - 3, F + 1, 1, 'vx_hay'); P(w - 2, F + 2, 1, 'vx_hay');
      // lean-to shelter in the back corner
      const su = w - 4, sv = d - 4;
      for (const [a, b] of [[0, 0], [2, 0], [0, 2], [2, 2]]) { P(su + a, F + 1, sv + b, 'vx_beam_oak', { axis: 0 }); P(su + a, F + 2, sv + b, 'vx_beam_oak', { axis: 0 }); }
      for (let a = -1; a <= 3; a++) for (let b = 0; b <= 2; b++) P(su + a, F + 3, sv + b, 'vx_roof_' + lrng.pick(S.roofs), { facing: 0 });
      const a = W3(lot, 1, F + 1, 1), b = W3(lot, w - 2, F + 1, d - 2);
      const animal = site.style === 'jungle' || site.style === 'desert' ? 'moss_boar' : lrng.chance(0.65) ? 'bloom_sheep' : 'moss_boar';
      return { box: [Math.min(a[0], b[0]), F + 1, Math.min(a[2], b[2]), Math.max(a[0], b[0]), F + 1, Math.max(a[2], b[2])], y: F + 1, animal, n: 3 + lrng.int(3), gate: W3(lot, du, F + 1, 0), trough: W3(lot, 3, F + 1, d - 3) };
    }
    // fruit trees in rows
    function fruitTree(put3, u, y, v, fruit, big) {
      put3(u, y, v, 'vx_fruit_trunk'); put3(u, y + 1, v, 'vx_fruit_trunk');
      const crown = 'vx_fruit_crown_' + fruit;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        put3(u + a, y + 2, v + b, crown);
        if (big && (a === 0 || b === 0)) put3(u + a, y + 3, v + b, crown);
      }
    }
    function buildOrchard(lot, L, lrng) {
      const P = L.P, w = lot.w, d = lot.d, F = lot.F;
      const fruit = site.style === 'cherry' ? 'cherry' : lrng.pick(['apple', 'apple', 'orange', 'plum', 'cherry']);
      for (let u = 0; u < w; u++) for (let v = 0; v < d; v++) {
        const gy = lot.ground(u, v);
        for (let y = gy + 1; y < F; y++) P(u, y, v, 'dirt');
        P(u, F, v, site.style === 'snowy' ? 'snow_block' : 'grass_block');
        for (let y = F + 1; y <= F + 6; y++) P(u, y, v, null);
      }
      const trees = [];
      for (let u = 2; u <= w - 3; u += 4) for (let v = 2; v <= d - 3; v += 4) { fruitTree((a, y, b, n) => P(a, y, b, n), u, F + 1, v, fruit, true); trees.push(W3(lot, u, F + 1, v - 1 >= 0 ? v - 1 : v)); }
      P(0, F + 1, 0, 'vx_veg_crate', { facing: 0 }); P(1, F + 1, 0, 'vx_wheelbarrow', { facing: 0 });
      return { trees, fruit, crate: W3(lot, 0, F + 1, -1) };
    }
    // a windmill: whitewashed tower, a pointed roof and big sails facing the road
    function buildWindmill(lot, L, lrng) {
      const P = L.P, F = lot.F, T = 9, du = 2;
      const wall = site.style === 'desert' ? 'vx_sandstone' : 'vx_plaster_white';
      for (let u = 0; u < 5; u++) for (let v = 0; v < 5; v++) {
        const gy = lot.ground(u, v);
        for (let y = gy + 1; y < F; y++) P(u, y, v, S.base);
        P(u, F, v, S.floor);
        const edge = u === 0 || v === 0 || u === 4 || v === 4;
        for (let y = F + 1; y <= F + T; y++) P(u, y, v, edge ? (y <= F + 1 ? S.base : wall) : null);
      }
      P(du, F + 1, 0, S.wood + '_door', { facing: 2, half: 0, hinge: 0, open: 0 }); P(du, F + 2, 0, S.wood + '_door', { facing: 2, half: 1, hinge: 0, open: 0 });
      P(du, F + 5, 0, 'vx_window_round', { facing: 0 }); P(0, F + 4, 2, 'vx_window_round', { facing: 1 }); P(4, F + 4, 2, 'vx_window_round', { facing: 1 });
      const roofC = lrng.pick(S.roofs);
      for (let u = 0; u < 5; u++) for (let v = 0; v < 5; v++) {
        const ring = Math.max(Math.abs(u - 2), Math.abs(v - 2));
        const f = Math.abs(u - 2) >= Math.abs(v - 2) ? (u < 2 ? 1 : 3) : (v < 2 ? 2 : 0);
        if (ring === 2) P(u, F + T + 1, v, 'vx_roof_' + roofC, { facing: f });
        else if (ring === 1) P(u, F + T + 2, v, 'vx_roof_' + roofC, { facing: f });
        else P(u, F + T + 3, v, 'vx_ridge_' + roofC, { facing: 0 });
      }
      for (let a = 1; a <= 3; a++) for (let b = 0; b < 3; b++) P(a, F + T - 3 + b, -1, 'vx_windmill_sail', { facing: 0 });
      P(du, F + 3, 1, 'vx_lantern');
      return { top: W3(lot, 2, F + T, 2) };
    }
    // front and back yards of a home: flower beds, a mailbox, a small tree, a laundry line, a table…
    function decorateYard(lot, L, lrng, homeSm) {
      const P = L.P, w = lot.w, d = lot.d, F = lot.F, du = w >> 1, y = F;
      const at = (u, v, name, props) => { if (!yardFree(lot, u, v)) return false; claim(lot, u, v); P(u, y, v, name, props); return true; };
      const yard = {};
      if (S.tech) {
        // the trailer's lawns: a trimmed hedge along the street with a gap at the path, bushes and ferns, a palm in a corner
        for (let u = -1; u <= w; u++) if (Math.abs(u - du) > 1) at(u, -2, lrng.chance(0.85) || (VR.Plants && VR.Plants.on(g)) ? 'vx_hedge' : 'vx_bush');
        for (let v = -1; v <= d; v++) { if (lrng.chance(0.5)) at(-2, v, 'vx_hedge'); if (lrng.chance(0.5)) at(w + 1, v, 'vx_hedge'); }
        // a palm in the back corner. vgen 7: its shared crown goes to the crown pass, which keeps it where no house wall, roof
        // or light strip is inside the 7×7 crown (else the palm moves up to RMAX cells): the same spots and draws as vgen 5
        if (lrng.chance(0.6)) {
          const shp = VR.Plants && VR.Plants.on(g), pu = lrng.chance(0.5) ? -2 : w + 1, pv = d;
          if (yardFree(lot, pu, pv)) {
            claim(lot, pu, pv);
            const [px, pz] = wxz(lot, pu, pv), hy = 6 + lrng.int(4);
            if (shp) crownCands.push([px, y, pz, hy + 1, 'yard', -1]);
            else { VG.palm(put, px, y, pz, hy); palms.push(['yard', -1, px, pz, hy]); }
          }
        }
        for (const [u, v] of [[-2, 1], [w + 1, 2], [1, d + 1], [w - 2, d + 1]]) if (lrng.chance(0.5)) { const pk = lrng.pick(['vx_bush', 'vx_fern_lush', 'vx_bush_light', 'vx_tech_planter']); at(u, v, VR.Plants && VR.Plants.on(g) ? 'vx_tech_planter' : pk); }   // vgen 7: the paved forecourts keep their planters (no bush stands on a plaza)
        if (lrng.chance(0.35)) { const u = lrng.chance(0.5) ? -2 : w + 1; if (at(u, 3, 'vx_sofa_white', { facing: u < 0 ? 1 : 3 })) yard.seat = W3(lot, u, y, 3).concat([(lot.r + (u < 0 ? 1 : 3)) & 3]); }
        yard.spot = W3(lot, w + 1, y, d);
        if (homeSm) homeSm.yard = yard;
        return;
      }
      if (lrng.chance(0.65)) { const bed = lrng.pick(['vx_flowerbed', 'vx_flowerbed_roses', 'vx_flowerbed_tulips']); for (let u = 0; u < w; u++) if (Math.abs(u - du) > 1) at(u, -2, bed); }
      if (lrng.chance(0.7)) at(du + 2, -3, 'vx_mailbox', { facing: 0 });
      // a little tree in a back corner
      if (lrng.chance(0.7)) {
        const side = lrng.chance(0.5) ? -2 : w;
        const ok = [0, 1].every(a => [0, 1].every(b => yardFree(lot, side + a, d - 1 + b)));
        if (ok) {
          for (const a of [0, 1]) for (const b of [0, 1]) claim(lot, side + a, d - 1 + b);
          const fruit = site.style === 'cherry' ? 'cherry' : lrng.pick(['apple', 'cherry', 'plum', 'orange']);
          P(side, y, d - 1, 'vx_fruit_trunk'); P(side, y + 1, d - 1, 'vx_fruit_trunk');
          for (const a of [0, 1]) for (const b of [0, 1]) { P(side + a, y + 2, d - 1 + b, 'vx_fruit_crown_' + fruit); if ((side + a === -2 || side + a === w + 1) && lrng.chance(0.6)) P(side + a, y + 3, d - 1 + b, 'vx_fruit_crown_' + fruit); }
        }
      }
      if (lrng.chance(0.4) && site.style !== 'snowy') { let ok = true; for (let u = 1; u <= 3; u++) ok = ok && yardFree(lot, u, d); if (ok) for (let u = 1; u <= 3; u++) at(u, d, 'vx_laundry_line', { facing: 0 }); }
      if (lrng.chance(0.35)) { const u = lrng.chance(0.5) ? -2 : w + 1; if (at(u, 1, 'vx_picnic_table', { facing: u < 0 ? 1 : 3 })) yard.seat = W3(lot, u, y, 1).concat([(lot.r + (u < 0 ? 1 : 3)) & 3]); }
      if (lrng.chance(0.25)) at(lrng.chance(0.5) ? -2 : w + 1, 3, lrng.pick(['vx_birdbath', 'vx_beehive', 'vx_pumpkin_pile']));
      if (lrng.chance(0.4)) {
        const fence = S.fence;
        for (let v = -1; v <= d; v++) { at(-2, v, fence); at(w + 1, v, fence); }
        for (let u = -2; u <= w + 1; u++) at(u, d + 1, fence);
      }
      yard.spot = W3(lot, w + 1, y, d);
      if (homeSm) homeSm.yard = yard;
    }
    // the Starbase: a control room (holo screens, consoles, holo table) behind an octagonal portal that opens
    // onto a landing apron with the city's ship — the trailer's walk-out shot; new worlds start in here
    function buildBase(lot, L, lrng) {
      const P = L.P, w = lot.w, d = lot.d, F = lot.F, du = w >> 1, H = 8, V0 = 8; // hall from v = V0 to d - 1, apron in front
      const wallA = 'vx_tech_dark_strip', wallB = 'vx_tech_hex', wallC = 'vx_tech_gray';
      for (let u = 0; u < w; u++) for (let v = 0; v < d; v++) {
        const gy = lot.ground(u, v);
        for (let y = gy + 1; y < F; y++) P(u, y, v, S.base);
        if (v < V0) {
          // apron: deck, a landing pad ring in the middle, hazard rim at the front
          const pd = Math.max(Math.abs(u - du), Math.abs(v - 3));
          P(u, F, v, v === 0 ? 'hazard_stripes' : pd <= 2 ? 'vx_floor_pad' : 'vx_floor_deck');
          for (let y = F + 1; y <= F + 12; y++) P(u, y, v, null);
          continue;
        }
        P(u, F, v, 'vx_floor_hex');
        const edge = u === 0 || u === w - 1 || v === V0 || v === d - 1;
        for (let y = F + 1; y <= F + H; y++) {
          if (!edge) { P(u, y, v, null); continue; }
          if (v === V0 && Math.abs(u - du) <= 5 && y <= F + 8) continue; // the portal (below)
          P(u, y, v, y === F + 1 || y === F + H ? wallC : ((u + v + y) % 5 === 0 ? wallB : wallA));
        }
        P(u, F + H + 1, v, wallC);
        if (edge) P(u, F + H + 2, v, 'vx_tech_railing');
      }
      // the octagonal portal in the front wall: an 11-wide, 8-tall ring with two-step chamfers, orange glow
      const OPEN = [2, 3, 4, 4, 4, 3, 2]; // half-width of the opening for t = 1..7
      for (let y = F + 1; y <= F + 8; y++) for (let uu = du - 5; uu <= du + 5; uu++) {
        const a = Math.abs(uu - du), t = y - F;
        const open = t <= 7 && a <= OPEN[t - 1];
        const frame = t === 8 ? a <= 2 : a === OPEN[t - 1] + 1;
        if (open) P(uu, y, V0, null);
        else if (frame) P(uu, y, V0, 'vx_portal_frame_white', { facing: 0 });
        else P(uu, y, V0, (t === 8 || t === 1) ? wallC : wallA);
      }
      for (let uu = du - 2; uu <= du + 2; uu++) P(uu, F, V0, 'vx_floor_pad');
      // control room: holo wall at the back, a curve of consoles, the holo table, seats, lockers, lights
      const back = d - 1;
      for (let uu = 1; uu < w - 1; uu++) for (let y = F + 2; y <= F + 5; y++) { const sc = Math.abs(uu - du) <= 3 ? 'vx_holo_screen' : (y >= F + 3 && y <= F + 4 ? 'vx_holo_screen_amber' : null); if (sc) P(uu, y, back - 1, sc, { facing: 0 }); }
      for (let uu = du - 4; uu <= du + 4; uu++) { const vv = back - 2 - (Math.abs(uu - du) >= 3 ? 1 : 0); P(uu, F + 1, vv, 'vx_console', { facing: 2 }); if ((uu - du) % 2 === 0) P(uu, F + 1, vv - 1, 'vx_stool'); }
      P(du, F + 1, V0 + 6, 'vx_holo_table');
      for (const [a, b] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) P(du + a, F + 1, V0 + 6 + b, 'vx_stool_orange');
      for (let vv = V0 + 2; vv < back - 1; vv += 2) { P(1, F + 1, vv, 'vx_locker', { facing: 1 }); P(w - 2, F + 1, vv, 'vx_locker', { facing: 3 }); }
      for (let vv = V0 + 2; vv < back; vv += 3) for (const uu of [1, w - 2]) for (let y = F + 3; y <= F + 4; y++) P(uu, y, vv, 'vx_holo_screen', { facing: uu === 1 ? 1 : 3 });
      for (let uu = 2; uu < w - 2; uu += 3) for (let vv = V0 + 2; vv < back - 1; vv += 3) P(uu, F + H, vv, 'vx_hex_light_cyan');
      P(du, F + H, V0 + 1, 'vx_hex_light'); P(du - 3, F + H, V0 + 1, 'vx_hex_light'); P(du + 3, F + H, V0 + 1, 'vx_hex_light');
      // apron lamps and a fern or two by the gate
      for (const uu of [1, w - 2]) { P(uu, F + 1, 1, S.lamp, { head: 0 }); P(uu, F + 2, 1, S.lamp, { head: 1 }); }
      P(du - 4, F + 1, V0 - 1, 'vx_fern_lush'); P(du + 4, F + 1, V0 - 1, 'vx_fern_lush');
      const dir = ROT[lot.r](0, -1), yaw = Math.atan2(-dir[0], -dir[1]);
      const pad = W3(lot, du, F + 1, 3);
      return {
        inside: W3(lot, du, F + 1, V0 + 4), portal: W3(lot, du, F + 1, V0), apron: W3(lot, du, F + 1, 3), yaw,
        spawn: W3(lot, du, F + 1, V0 + 8).concat([yaw]),
        pad: { x: pad[0], y: pad[1], z: pad[2], seed: (site.seed ^ 0x51ab) >>> 0, dir: (lot.r + 2) & 3 },
        box: (() => { const a = W3(lot, 0, F, V0), b = W3(lot, w - 1, F, d - 1); return [Math.min(a[0], b[0]), F + 1, Math.min(a[2], b[2]), Math.max(a[0], b[0]), F + H, Math.max(a[2], b[2])]; })(),
        work: [['control', du - 2, F + 1, back - 3], ['control', du + 2, F + 1, back - 3]],
      };
    }
    // ---- build every lot
    const recordInfo = (lot, info) => {
      const W = (p) => { if (!p) return null; const q = ROT[lot.r](p[0], p[2]); return [lot.ox + q[0], p[1], lot.oz + q[1]]; };
      const WF = (p) => { const w3 = W(p); w3.push((p[3] + lot.r) & 3); return w3; };
      return {
        kind: lot.kind, door: W(info.door), outside: W(info.outside), inside: W(info.inside), beds: info.beds.map(WF), seats: info.seats.map(WF),
        work: info.work.map(wk => [wk[0]].concat(W([wk[1], wk[2], wk[3]]))), chimney: W(info.chimney), table: W(info.table), lights: info.lights.map(W),
        box: (() => { const a = W([-1, lot.F, -1]), b = W([lot.w, lot.F, lot.d]); return [Math.min(a[0], b[0]), lot.F, Math.min(a[2], b[2]), Math.max(a[0], b[0]), (info.roofTop || lot.F + 5) + 1, Math.max(a[2], b[2])]; })(),
        F: lot.F, r: lot.r, w: lot.w, d: lot.d, ox: lot.ox, oz: lot.oz,
      };
    };
    let homeSeed = site.seed;
    for (const lot of lots) {
      yield;
      const L = makeLot(put, lot.ox, lot.oz, lot.r);
      const lg = (u, v) => { const q = ROT[lot.r](u, v); return ground(lot.ox + q[0], lot.oz + q[1]); };
      // clear the air volume over the lot and fill the ground up to the floor
      lot.ground = lg;
      const flatKind = lot.kind === 'farm' || lot.kind === 'pasture' || lot.kind === 'orchard' || lot.kind === 'park';
      for (let u = -MU; u < lot.w + MU; u++) for (let v = -MV; v < lot.d + MU; v++) {
        const q = ROT[lot.r](u, v), x = lot.ox + q[0], z = lot.oz + q[1];
        const gy = ground(x, z);
        const inner = u >= 0 && u < lot.w && v >= 0 && v < lot.d;
        const top = lot.F + (lot.kind === 'farm' || lot.kind === 'garden' || lot.kind === 'park' || (lot.kind === 'lot' && !MODERN) || lot.kind === 'pasture' ? 5 : lot.kind === 'orchard' ? 8 : lot.kind === 'windmill' ? 18 : lot.kind === 'base' ? 13 : S.tech ? 21 : MODERN ? 18 : 16);
        if (inner) { fill(x, z, lot.F + 1, Math.max(top, gy + 4), AIR); }
        else {
          // yard: blend ground to the floor level, grassy
          const yy = lot.F - (flatKind ? 0 : 1);
          if (gy < yy) fill(x, z, gy + 1, yy, st(site.style === 'desert' ? 'sand' : S.modern ? 'stacked_stone' : 'dirt'));   // modern lots sit on ledgestone retaining walls
          if (occ[oi(x, z)] !== 1) { fill(x, z, yy + 1, Math.max(yy + 6, gy + 3), AIR); put(x, yy, z, st(site.style === 'desert' ? 'sand' : site.style === 'snowy' ? 'snow_block' : 'grass_block')); }
        }
      }
      homeSeed = (homeSeed * 1103515245 + 12345) >>> 0;
      const lrng = new VR.RNG(homeSeed);
      if (lot.kind === 'market') {
        const m = buildMarket(lot, L, lrng);
        const du = lot.w >> 1;
        const sm = recordInfo(lot, { beds: [], seats: [], work: m.work, door: [du, lot.F + 1, 0], outside: [du, lot.F + 1, -1], inside: [du, lot.F + 1, 2], chimney: null, table: null, lights: [], roofTop: lot.F + 7 });
        sm.shop = m; plan.work.push(sm); plan.shops.push(m);
        const dp = ROT[lot.r](du, -2); put(lot.ox + dp[0], lot.F - 1, lot.oz + dp[1], pathS);
        continue;
      }
      if (lot.kind === 'base') {
        const b = buildBase(lot, L, lrng);
        const du = lot.w >> 1;
        const sm = recordInfo(lot, { beds: [], seats: [], work: b.work, door: [du, lot.F + 1, 8], outside: [du, lot.F + 1, 6], inside: [du, lot.F + 1, 12], chimney: null, table: null, lights: [], roofTop: lot.F + 10 });
        sm.base = b; plan.work.push(sm); plan.base = b; plan.pad = b.pad;
        continue;
      }
      if (lot.kind === 'pasture') { plan.pastures.push(buildPasture(lot, L, lrng)); continue; }
      if (lot.kind === 'orchard') { plan.orchards.push(buildOrchard(lot, L, lrng)); continue; }
      if (lot.kind === 'windmill') { plan.windmills.push(buildWindmill(lot, L, lrng)); continue; }
      if (lot.kind === 'farm') {
        const fi = farm(L, { w: lot.w, d: lot.d, F: lot.F, rng: lrng, ground: lg, style: site.style });
        const W = (p) => { const q = ROT[lot.r](p[0], p[2]); return [lot.ox + q[0], p[1], lot.oz + q[1]]; };
        plan.farms.push({ crop: fi.crop, cells: fi.cells.map(W), gate: W(fi.gate), box: [lot.ox, lot.oz, lot.w, lot.d, lot.r] });
        continue;
      }
      if (lot.kind === 'garden') {
        for (let u = 0; u < lot.w; u++) for (let v = 0; v < lot.d; v++) {
          const edge = u === 0 || v === 0 || u === lot.w - 1 || v === lot.d - 1;
          L.P(u, lot.F, v, edge ? S.path : 'grass_block');
          if (!edge && (u + v) % 2 === 0) {
            const fern = S.tech && lrng.chance(0.5);   // drawn in every vgen, so the lots stay the same; vgen 7 plants no fern here
            if (!(S.palms && VR.Plants && VR.Plants.on(g) && u === lot.w - 2 && v === lot.d - 2)) L.P(u, lot.F + 1, v, S.tech && !(VR.Plants && VR.Plants.on(g)) ? (fern ? 'vx_fern_lush' : 'vx_fern') : 'vx_planter');   // vgen 7: the palm's trunk cell stays free
          }
        }
        const mid = lot.w >> 1;
        L.P(mid, lot.F + 1, lot.d >> 1, S.bench || 'vx_bench', { facing: 0 });
        if (S.palms) { const q = ROT[lot.r](lot.w - 2, lot.d - 2), gx = lot.ox + q[0], gz = lot.oz + q[1]; if (VR.Plants && VR.Plants.on(g)) crownCands.push([gx, lot.F + 1, gz, 7, 'garden', -1]); else { VG.palm(put, gx, lot.F + 1, gz, 4); palms.push(['garden', -1, gx, gz, 4]); } }
        // vgen 7: the lawn's tufts and flowers, not on the palm's trunk cell (the lawn is ground, the trunk stands there)
        if (VR.Plants && VR.Plants.on(g)) for (let u = 1; u < lot.w - 1; u++) for (let v = 1; v < lot.d - 1; v++) {
          const hv = M.hash2(lot.ox + u, lot.oz + v, site.seed + 613) >>> 0;   // a hash of the cell, not the lot's draws (vgen 5's lots stay the same)
          if (hv % 100 < 14 && !(S.palms && u === lot.w - 2 && v === lot.d - 2)) L.P(u, lot.F + 1, v, (hv >> 8) % 5 < 3 ? 'vm_tuft_grass' : 'vm_flower_cluster', { part: 'p000', facing: 0 });
        }
        // vgen 7: half the gardens have a blossom bush (the trailer's round topiary with white and pink flowers) in the corner by the lamp
        if (VR.Plants && VR.Plants.on(g) && (M.hash2(lot.ox, lot.oz, site.seed + 727) >>> 0) % 2 === 0) L.P(1, lot.F + 1, 1, 'vm_bush_blossom', { part: 'p000', facing: 0 });
        L.P(0, lot.F + 1, 0, S.lamp, { head: 0 }); L.P(0, lot.F + 2, 0, S.lamp, { head: 1 });
        if (S.crystals) L.P(mid, lot.F + 1, lot.d - 1, 'vx_crystal_' + lrng.pick(['violet', 'azure', 'rose']));
        plan.work.push({ kind: 'garden', spot: (() => { const q = ROT[lot.r](mid, (lot.d >> 1) - 1); return [lot.ox + q[0], lot.F + 1, lot.oz + q[1]]; })() });
        continue;
      }
      if (MODERN && lot.kind !== 'barn') {
        const mk = lot.kind === 'lot' ? 'home' : lot.kind;
        const info = yield* VG.modern.buildSteps(mk, L, lot, { rng: lrng, ground: lg, beds: 2 + lrng.int(3), put, palms: site.style === 'savanna', F: lot.F });
        if (info) {
          if (mk === 'park') { plan.work.push({ kind: 'garden', spot: (() => { const q = ROT[lot.r](info.spot[0], info.spot[2]); return [lot.ox + q[0], info.spot[1], lot.oz + q[1]]; })(), seats: info.seats.map(p => { const q = ROT[lot.r](p[0], p[2]); return [lot.ox + q[0], p[1], lot.oz + q[1], (p[3] + lot.r) & 3]; }) }); continue; }
          const sm = recordInfo(lot, info);
          if (info.skin) sm.skin = info.skin;
          if (info.desks) sm.desks = info.desks.map(p => { const q = ROT[lot.r](p[0], p[2]); return [lot.ox + q[0], p[1], lot.oz + q[1], (p[3] + lot.r) & 3]; });
          for (const l of sm.lights) plan.lamps.push(l);
          if (mk === 'home') plan.homes.push(sm); else plan.work.push(sm);
          continue;
        }
      }
      const walls = lot.kind === 'barn' ? (site.style === 'snowy' ? 'vx_siding_red' : lrng.pick(['vx_siding_red', 'vx_siding_red', 'vx_darkwood'])) : lrng.pick(S.walls), roof = lrng.pick(S.roofs), win = lrng.pick(S.windows);
      const kind = lot.kind === 'lot' ? 'home' : lot.kind;
      const tower = !!(S.tech && VG.techTower && kind === 'home' && lot.w >= 7 && lot.d >= 7);
      const floors = tower ? Math.min(4, 2 + (lot.w >= 9 && lot.d >= 9 ? lrng.int(2) : 0) + (lrng.chance(0.35) ? 1 : 0)) : kind === 'hall' ? 2 : (kind === 'home' && lot.w >= 6 && lrng.chance(0.4)) ? 2 : (S.tall && lot.w >= 5 && lrng.chance(0.65)) ? 2 : 1;
      const beds = kind === 'home' ? 2 + lrng.int(Math.max(1, Math.min(4, lot.w - 3))) : kind === 'clinic' ? 2 : 0;
      const bopt = { detail: detOn, w: lot.w, d: lot.d, floors, F: lot.F, style: site.style, rng: lrng, kind, beds, ground: lg, walls: kind === 'smithy' ? (S.tech ? 'vx_tech_gray' : S.base === 'vx_sandstone' ? 'vx_sandstone' : 'vx_stonebrick') : walls, window: win, roof, wood: S.wood, chimney: !S.noChimney && kind !== 'library' && kind !== 'clinic' && kind !== 'barn', seed: homeSeed & 255, pitched: kind === 'barn' };
      if (lot.kind === 'lot') {
        // reserved plot: foundation + fence posts + material crates; the real house is built by villagers later
        const rec = [];
        const Lr = makeLot((x, y, z, s) => rec.push(x, y, z, s), lot.ox, lot.oz, lot.r);
        const info = building(Lr, Object.assign({}, bopt, { rng: new VR.RNG(homeSeed) }));
        for (let u = 0; u < lot.w; u++) for (let v = 0; v < lot.d; v++) L.P(u, lot.F, v, S.floor);
        for (const [u, v] of [[-1, -1], [lot.w, -1], [-1, lot.d], [lot.w, lot.d]]) L.P(u, lot.F + 1, v, S.fence);
        L.P(1, lot.F + 1, 1, 'vx_crate'); L.P(2, lot.F + 1, 1, 'vx_crate'); L.P(1, lot.F + 2, 1, 'vx_crate'); L.P(lot.w - 2, lot.F + 1, 1, 'vx_barrel');
        L.P(lot.w >> 1, lot.F + 1, -1, 'vx_sign', { facing: 0, icon: 4 });
        const summary = recordInfo(lot, info);
        summary.ops = rec; summary.style = site.style;
        plan.lots.push(summary);
        continue;
      }
      const info = tower ? VG.techTower(L, bopt) : building(L, bopt);
      const sm = recordInfo(lot, info);
      if (info.chimney) plan.chimneys.push(sm.chimney);
      for (const l of sm.lights) plan.lamps.push(l);
      // little path from the doorstep to the road
      const dp = ROT[lot.r](lot.w >> 1, -2);
      const px = lot.ox + dp[0], pz = lot.oz + dp[1];
      put(px, lot.F - 1, pz, pathS);
      if (kind === 'home') { plan.homes.push(sm); if (V2) decorateYard(lot, L, lrng, sm); } else plan.work.push(sm);
      // solar panels on sci-fi homes
      if (info.solar && info.roofTop) { const q = ROT[lot.r](1, -1); put(lot.ox + q[0], lot.F + 1, lot.oz + q[1], st('vx_solar', { facing: (lot.r + 2) & 3 })); }
    }
    if (HOME) {
      const b = VR.Heart.templeBase(g);
      plan.base = b; plan.pad = null; // the temple's own chunk spawns the ship on the hangar pad
      plan.work.push({ kind: 'base', door: b.back.slice(), outside: [b.back[0], b.back[1], b.back[2] - 2], inside: b.inside.slice(), beds: [], seats: [], work: b.work.map(w => w.slice()), chimney: null, table: null, lights: [], box: b.box.slice(), base: b });
    }
    // hangar with a parked starship for villages with space-faring folk (prism / meadow sometimes)
    if (!plan.base && (S.scifi || rng.chance(0.3))) {
      const road = roads[rng.int(roads.length)];
      const end = road.pts[road.pts.length - 1];
      if (end) {
        const ex = end[0], ez = end[2];
        const ok = (() => { for (let dz = -6; dz <= 6; dz++) for (let dx = -6; dx <= 6; dx++) { const o = oi(ex + dx, ez + dz); if (o < 0) return false; if (occ[o] === 3) return false; } return true; })();
        if (ok) {
          const y = Math.max(end[1] - 1, ground(ex, ez));
          for (let dz = -6; dz <= 6; dz++) for (let dx = -6; dx <= 6; dx++) {
            const x = ex + dx, z = ez + dz, gy = ground(x, z);
            const edge = Math.max(Math.abs(dx), Math.abs(dz)) === 6;
            fill(x, z, gy + 1, y - 1, st('vx_stonebrick'));
            fill(x, z, y + 1, y + 12, AIR);
            put(x, y, z, st(edge ? 'hazard_stripes' : S.tech ? (Math.max(Math.abs(dx), Math.abs(dz)) <= 1 ? 'vx_floor_pad' : 'vx_floor_deck') : 'landing_pad'));
            occ[oi(x, z)] = 3;
          }
          for (const [dx, dz] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) { put(ex + dx, y + 1, ez + dz, st(S.lamp, { head: 0 })); put(ex + dx, y + 2, ez + dz, st(S.lamp, { head: 1 })); }
          plan.pad = { x: ex, y: y + 1, z: ez, seed: (site.seed ^ 0x51ab) >>> 0, dir: rng.int(4) };
        }
      }
    }
    // the street decor of a modern town, last: the free cells left after every lot and road
    for (const job of decorJobs) job();
    // ---- the shared palm crowns (vgen 7), placed last. A candidate's trunk stands on free land (no road, plaza, path or HOME)
    // on the soil of its cell (the soil the fills raised above the planned base is climbed, up to CLIMB blocks; the ground
    // lying lower is stepped down onto, up to DESCEND blocks), with air up the trunk, and its 7×7 crown holds only air or
    // leaves at the two crown rows: a crown may overhang a street, a lawn, a path or a hedge, and may replace an older palm's
    // crown. A house wall, a roof or a light strip inside the crown moves the palm to the first spot that fits, at the
    // candidate's height and up to RMAX cells away (the spot itself first); only when no spot fits, the trunk grows (up to
    // CROWN_HMAX blocks). The blocks are read as the chunks will see them (VG.apply): the terrain, then the fills, then the
    // ops; the crowns placed here are read back, so two crowns never share a block of the same row.
    if (crownCands.length) {
      const LEAF = VR.Plants.leafStates(), SOIL = VR.Plants.soilStates(), NAT = -1, CROWN_HMAX = 16, CLIMB = 8, DESCEND = 3, RMAX = 4;
      const near = new Set();   // the cells a candidate can read: its 7×7 and the moves up to RMAX cells
      for (const c of crownCands) for (let dx = -RMAX - 3; dx <= RMAX + 3; dx++) for (let dz = -RMAX - 3; dz <= RMAX + 3; dz++) near.add((c[0] + dx) + ',' + (c[2] + dz));
      const opsAt = new Map(), fillsAt = new Map();
      for (const blk of ops.blocks) for (let i = 0; i < blk.length; i += 4) { const k = blk[i] + ',' + blk[i + 2]; if (near.has(k)) { let l = opsAt.get(k); if (!l) opsAt.set(k, l = []); l.push(blk[i + 1], blk[i + 3]); } }
      for (const blk of fills.blocks) for (let i = 0; i < blk.length; i += 5) { const k = blk[i] + ',' + blk[i + 1]; if (near.has(k)) { let l = fillsAt.get(k); if (!l) fillsAt.set(k, l = []); l.push(blk[i + 2], blk[i + 3], blk[i + 4]); } }
      const blockAt = (x, y, z) => {
        const k = x + ',' + z, o = opsAt.get(k);
        if (o) for (let i = o.length - 2; i >= 0; i -= 2) if (o[i] === y) return o[i + 1];
        const f = fillsAt.get(k);
        if (f) for (let i = f.length - 3; i >= 0; i -= 3) if (y >= f[i] && y <= f[i + 1]) return f[i + 2];
        return y <= ground(x, z) ? NAT : AIR;
      };
      const open = (s) => s === AIR || (s >= 0 && LEAF[s] === 1);
      const soil = (s) => s === NAT || (s >= 0 && SOIL[s] === 1);
      // the trunk's base on a cell (-1: no fit): the planned surface, climbed over the soil the fills raised above it, stepped down over a lower ground
      const fits = (x, base0, z, h) => {
        const o = oi(x, z); if (o < 0) return -1;
        const oc = occ[o]; if (oc !== 0 && oc !== 3 && oc !== 4 && oc !== 6) return -1;   // free land: no road, plaza, path or HOME
        let y = base0 - 1;
        for (let k = 0; k < CLIMB && soil(blockAt(x, y + 1, z)); k++) y++;
        for (let k = 0; k < DESCEND && blockAt(x, y, z) === AIR; k++) y--;                // the ground lies lower here: the trunk steps down onto it
        if (blockAt(x, y, z) === AIR) return -1;                                          // the trunk stands on something solid
        const base = y + 1;
        for (let t = base; t < base + h; t++) if (blockAt(x, t, z) !== AIR) return -1;   // air up the trunk
        for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) for (let t = base + h; t <= base + h + 1; t++) if (!open(blockAt(x + dx, t, z + dz))) return -1;
        return base;
      };
      // a placed block is also read back, so the next candidates see the crowns and trunks placed before them
      const putRec = (x, y, z, s) => { put(x, y, z, s); const k = x + ',' + z; let l = opsAt.get(k); if (!l) opsAt.set(k, l = []); l.push(y, s); };
      for (const [px, base0, pz, h0, kind, road] of crownCands) {
        let done = false;
        // the spot first (ring 0), then the cells one to RMAX away, at the candidate's height; a taller trunk only when no spot fits
        for (let h = h0; h <= CROWN_HMAX && !done; h++) for (let ring = 0; ring <= RMAX && !done; ring++) for (let dx = -ring; dx <= ring && !done; dx++) for (let dz = -ring; dz <= ring && !done; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;   // the ring's cells only
          const x = px + dx, z = pz + dz;
          const base = fits(x, base0, z, h); if (base < 0) continue;
          VR.Plants.palm(putRec, x, base, z, h); palms.push([kind, road, x, z, h]); done = true;
        }
        if (!done) drops.push([kind, road, px, pz, base0, h0]);
      }
    }
    // ---- bucket ops per chunk
    const chunks = new Map();
    const bucket = (x, z) => { const k = (x >> 4) + ',' + (z >> 4); let b = chunks.get(k); if (!b) { b = { f: [], o: [] }; chunks.set(k, b); } return b; };
    let nF = 0, nO = 0;
    for (const blk of fills.blocks) for (let i = 0; i < blk.length; i += 5) { if (++nF % 4000 === 0) yield; bucket(blk[i], blk[i + 1]).f.push(blk[i], blk[i + 1], blk[i + 2], blk[i + 3], blk[i + 4]); }
    for (const blk of ops.blocks) for (let i = 0; i < blk.length; i += 4) { if (++nO % 5000 === 0) yield; bucket(blk[i], blk[i + 2]).o.push(blk[i], blk[i + 1], blk[i + 2], blk[i + 3]); }
    plan.palms = palms; plan.crownDrops = drops;
    plan.chunks = chunks;
    plan.center = [cx, py + 1, cz];
    return plan;
  };

  // The plan drivers. planAdvance runs a town's plan for about ms (returns the plan when it is done, else null);
  // VG.plan runs it to the end. Plans of the chunks are kept in g._vilPlans (up to 9, as before); the horizon's
  // (lod) in g._vilLodPlans until the horizon has built the town's mesh (a few at a time). In a worker job VG.probe
  // is set: a plan that is not there ends the run with probe.miss set, and the job waits for it (worker_main.js).
  const planGot = (g, site, lod) => (g._vilPlans && g._vilPlans.get(site.id)) || (lod && g._vilLodPlans && g._vilLodPlans.get(site.id)) || null;
  VG.planReady = (g, site, lod) => !!planGot(g, site, lod);
  VG.planAdvance = function (g, site, ms, lod) {
    const have = planGot(g, site, lod);
    if (have) return have;
    if (!g._vilBuild) g._vilBuild = new Map();
    let it = g._vilBuild.get(site.id);
    if (!it) {
      if (g._vilBuild.size >= 4) g._vilBuild.delete(g._vilBuild.keys().next().value);
      it = planSteps(g, site); g._vilBuild.set(site.id, it);
    }
    const t0 = performance.now();
    let r;
    try { do { r = it.next(); } while (!r.done && performance.now() - t0 < ms); }
    catch (e) { g._vilBuild.delete(site.id); throw e; }
    if (!r.done) return null;
    g._vilBuild.delete(site.id);
    const plan = r.value;
    if (lod) {
      if (!g._vilLodPlans) g._vilLodPlans = new Map();
      if (g._vilLodPlans.size > 4) g._vilLodPlans.delete(g._vilLodPlans.keys().next().value);
      g._vilLodPlans.set(site.id, plan);
    } else {
      if (!g._vilPlans) g._vilPlans = new Map();
      if (g._vilPlans.size > 8) g._vilPlans.delete(g._vilPlans.keys().next().value);
      g._vilPlans.set(site.id, plan);
    }
    return plan;
  };
  VG.plan = function (g, site, lod) {
    const have = planGot(g, site, lod);
    if (have) return have;
    if (VG.probe) { VG.probe.miss = { site, lod: !!lod }; throw VG.probe; }
    return VG.planAdvance(g, site, Infinity, lod);
  };

  // the site cells a chunk's column reads: its 3 x 3 neighbourhood of cells
  VG.cellsFor = function (g, cx, cz) {
    const VCELL = PAR(g).CELL;
    const ci = Math.floor((cx * 16 + 8) / VCELL), cj = Math.floor((cz * 16 + 8) / VCELL), out = [];
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) out.push([ci + di, cj + dj]);
    return out;
  };
  // the village sites whose footprint reaches a chunk: the ones VG.apply plans for it (same order)
  VG.sitesFor = function (g, cx, cz) {
    const { RAD } = PAR(g);
    const x0 = cx * 16, z0 = cz * 16;
    const res = [];
    for (const [si, sj] of VG.cellsFor(g, cx, cz)) {
      const site = VG.site(g, si, sj);
      if (!site) continue;
      const SR = site.rad || RAD;
      if (x0 + 16 < site.x - SR - 2 || x0 > site.x + SR + 2 || z0 + 16 < site.z - SR - 2 || z0 > site.z + SR + 2) continue;
      res.push(site);
    }
    return res;
  };
  // apply a village's ops to one generated chunk (fills first, then block ops in order)
  VG.apply = function (g, cx, cz, out) {
    const x0 = cx * 16, z0 = cz * 16;
    for (const site of VG.sitesFor(g, cx, cz)) {
      const plan = VG.plan(g, site);
      const b = plan.chunks.get(cx + ',' + cz);
      if (b) {
        const B = out.blocks;
        for (let i = 0; i < b.f.length; i += 5) {
          const lx = b.f[i] - x0, lz = b.f[i + 1] - z0, s = b.f[i + 4];
          const y0 = Math.max(1, b.f[i + 2]), y1 = Math.min(254, b.f[i + 3]);
          for (let y = y0; y <= y1; y++) B[(y << 8) | (lz << 4) | lx] = s;
        }
        for (let i = 0; i < b.o.length; i += 4) {
          const lx = b.o[i] - x0, lz = b.o[i + 2] - z0, y = b.o[i + 1];
          if (y < 1 || y > 254) continue;
          B[(y << 8) | (lz << 4) | lx] = b.o[i + 3];
        }
      }
      // the village announces itself from the chunk holding its plaza
      if (site.x >= x0 && site.x < x0 + 16 && site.z >= z0 && site.z < z0 + 16) {
        if (!out.spawns) out.spawns = [];
        out.spawns.push(['village', site.id, site.x, plan.center[1], site.z]);
        if (plan.pad) out.spawns.push(['starship', plan.pad.seed, plan.pad.x, plan.pad.y, plan.pad.z, plan.pad.dir]);
      }
    }
  };

  // JSON-friendly plan summary for the game thread
  VG.summary = function (plan) {
    return { rad: plan.rad, id: plan.id, name: plan.name, style: plan.style, x: plan.x, y: plan.center[1], z: plan.z, seed: plan.seed, plaza: plan.plaza, homes: plan.homes, work: plan.work, farms: plan.farms, lots: plan.lots, lamps: plan.lamps, chimneys: plan.chimneys, roads: plan.roads, bell: plan.bell, pad: plan.pad, shops: plan.shops, pastures: plan.pastures, orchards: plan.orchards, windmills: plan.windmills, base: plan.base, folkCap: plan.folkCap || null };
  };

  // ---------------------------------------------------------------- hooks into the overworld generator
  const OG = VR.OverworldGen && VR.OverworldGen.prototype;
  if (OG) {
    const prevGen = OG.generate;
    OG.generate = function (cx, cz) {
      const out = prevGen.call(this, cx, cz);
      if (this.singleBiome < 0) { try { VG.apply(this, cx, cz, out); } catch (e) { if (VG.probe && e === VG.probe) throw e; if (!this._vilErr) { this._vilErr = 1; console.warn('village gen', e); } } }
      return out;
    };
    // no trees inside villages (they plant their own gardens)
    const prevTree = OG.tree;
    OG.tree = function (w, key, x, y, z, rng) {
      if (this.singleBiome < 0 && VG.near(this, x, z, 4)) return;
      return prevTree.call(this, w, key, x, y, z, rng);
    };
    OG.villageNear = function (x, z, pad) { return VG.near(this, x, z, pad); };
    OG.nearestVillage = function (x, z, maxR) { return VG.nearest(this, x, z, maxR); };
    // spawn in the heart of the nearest village: the first thing you see is home
    const prevSpawn = OG.findSpawn;
    OG.findSpawn = function () {
      if (this.singleBiome < 0) {
        const s = VG.nearest(this, 0, 0, 1400);
        if (s) {
          const plan = VG.plan(this, s);
          if (plan.base) return plan.base.spawn.slice();
          const p = plan.plaza;
          const a = (s.seed % 4) * Math.PI / 2 + Math.PI / 4;
          const x = Math.round(p.x + Math.cos(a) * (p.r + 0.5)), z = Math.round(p.z + Math.sin(a) * (p.r + 0.5));
          return [x + 0.5, p.y, z + 0.5, Math.atan2(-(p.x - x), -(p.z - z))];
        }
      }
      return prevSpawn.call(this);
    };
  }
})(VR);

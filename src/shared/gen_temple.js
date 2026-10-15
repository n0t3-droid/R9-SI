// ============================================================================
// The Gate Temple — the home base of every new world (TRAILER.md §4): a
// monumental slate-blue temple 110 × 70 blocks, facing south onto the Gate
// Plaza. Three stepped tiers with fluted pilasters, amber windows and orange
// light bars rise over the octagonal portal (13 × 13, filled with the glowing
// portal veil); wings with roof gardens, fluted corner towers, two saucer
// landing-pad towers, a domed hall, twin grand staircases up to garden
// terraces, and the flagstone plaza with its dark runway. Inside runs the
// Hangar Hall: an octagonal navy hall lit cyan, with the landing pad ring,
// holo screens over console rows, lockers and a hex-light ceiling, opening
// through a second octagon onto the city. Built once per world into per-chunk
// op buckets (like the villages) and stamped by the Heartland pass.
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R, M = VR.M, HEART = VR.Heart, GEN = VR.GEN;
  if (!HEART || !GEN) return;
  const TEMPLE = VR.TempleGen = {};
  const stCache = new Map();
  const st = (name, props) => { const key = props ? name + JSON.stringify(props) : name; let s = stCache.get(key); if (s !== undefined) return s; const t = R.byName[name]; s = t ? (props ? t.state(props) : t.defaultState) : 0; stCache.set(key, s); return s; };
  const oct = (dx, dz) => Math.max(Math.abs(dx), Math.abs(dz), (Math.abs(dx) + Math.abs(dz)) * 0.7071);
  const OPEN = [3, 4, 5, 6, 6, 6, 6, 6, 6, 6, 5, 4, 3];   // portal half-widths, rows t = 0..12
  const BACK = [2, 3, 4, 4, 4, 4, 4, 3, 2];                // back door half-widths, rows 0..8
  const T = HEART.TEMPLE, Y = HEART.PLAT;                  // floor block level (stand on Y + 1)
  TEMPLE.Y = Y;
  // the Hangar Hall's crew (TRAILER.md shot E): two heroes in blue and orange armour stand in front of the console rows,
  // facing the pad, with their blasters up, mirror images about the hall's axis x 0.5 (clear of the stools at x ±6).
  // [x, y, z, yaw, suit, hair, hairstyle, skin] (hall.js shows them and walks them out to the corridor's city end)
  const yawTo = (x, z, tx, tz) => Math.atan2(-(tx - x), -(tz - z));
  TEMPLE.crew = (Y) => [[-3.9, Y + 1, 0.5, yawTo(-3.9, 0.5, 0.5, -9.5), 0, 1, 0, 0], [4.9, Y + 1, 0.5, yawTo(4.9, 0.5, 0.5, -9.5), 6, 4, 2, 1]];
  // the blinking lights on the console tops (x, y, z) — the console rows at x ±7, z −4 … +6 (hall.js blinks them)
  TEMPLE.consoleLights = (Y) => { const out = []; for (const sx of [-1, 1]) for (let z = -4; z <= 6; z += 2) out.push([sx * 7 + 0.5, Y + 2.1, z + 0.5]); return out; };
  // footprint (with the plaza) in world coordinates — reserved from villages, trees and random features
  TEMPLE.box = { x0: -66, x1: 84, z0: -50, z1: 142 };
  TEMPLE.inside = (x, z) => x >= TEMPLE.box.x0 && x <= TEMPLE.box.x1 && z >= TEMPLE.box.z0 && z <= TEMPLE.box.z1;

  // ---------------------------------------------------------------- materials
  function mats() {
    return {
      WALL: st('temple_stone'), SMOOTH: st('temple_stone_smooth'), BAND: st('temple_stone_band'), PIL: st('temple_pilaster', { axis: 0 }),
      BAR: st('temple_light_bar'), SLIT: st('temple_slit'), WIN: st('amber_window'), VEIL: st('portal_veil'), BEACON: st('beacon_red'), NEONA: st('neon_amber'),
      FRAME: st('vx_portal_frame', { facing: 0 }), CYAN: st('neon_cyan'), PANEL: st('tech_panel'), PANELA: st('tech_panel_amber'), ANT: st('antenna'),
      DARK: st('vx_tech_dark_strip'), HEX: st('vx_tech_hex'), GRAY: st('vx_tech_gray'), HEXF: st('vx_floor_hex'), PAD: st('vx_floor_pad'), LINE: st('vx_floor_plaza_line'), PLAZA: st('vx_floor_plaza'),
      DECK: st('vx_floor_deck'), FLAG: st('flagstone') || st('vx_floor_stone'), GRASS: st('grass_block'), DIRT: st('dirt'), STAIR: st('temple_stone_stairs', { facing: 0, half: 0 }),
      RAIL: st('vx_tech_railing'), LAMP0: st('vx_lamppost_tech', { head: 0 }), LAMP1: st('vx_lamppost_tech', { head: 1 }), HEDGE: st('vx_hedge') || st('vx_fern_lush'), BUSH: st('vx_bush') || st('vx_fern_lush'),
      FERN: st('vx_fern_lush'), PLANTER: st('vx_tech_planter'), HEXL: st('vx_hex_light', { head: 1 }), HEXLC: st('vx_hex_light_cyan', { head: 1 }), LOCKER1: st('vx_locker', { facing: 1 }), LOCKER3: st('vx_locker', { facing: 3 }),
      HOLO1: st('vx_holo_screen', { facing: 1 }), HOLO3: st('vx_holo_screen', { facing: 3 }), HOLOA1: st('vx_holo_screen_amber', { facing: 1 }), HOLOA3: st('vx_holo_screen_amber', { facing: 3 }),
      CON1: st('vx_console', { facing: 1 }), CON3: st('vx_console', { facing: 3 }), STOOL: st('vx_stool'), STOOLO: st('vx_stool_orange'), HTABLE: st('vx_holo_table'),
      CRY: st('violet_crystal_cluster', { facing: 4, size: 1 }), CRYB: st('violet_crystal_block'), CRYA: st('azure_crystal_cluster', { facing: 4, size: 1 }), CRYAB: st('azure_crystal_block'),
      SOFA: st('vx_sofa_white', { facing: 0 }), HAZ: st('hazard_stripes'), WHITE: st('hull_plating'),
      LANTERN: st('vx_lantern') || st('lantern'),   // (vgen 9: the terraces' lanterns)
    };
  }

  // ---------------------------------------------------------------- the material of one cell
  // returns -1 for "not part of the temple", 0 for air, else a block state
  function makeMat(K) {
    const fx = T.front, bx = T.back;
    // tiers: [x half-width, z0, z1, y0, y1]
    const TIERS = [[22, bx, fx, Y + 1, Y + 20], [16, -30, 14, Y + 21, Y + 34], [10, -22, 8, Y + 35, Y + 44]];
    const CROWN = [3, -13, -7, Y + 45, Y + 50];
    const inHall = (x, y, z) => {
      const ax = Math.abs(x);
      if (ax > 10 || z < bx + 1 || z > fx - 1 || y < Y + 1 || y > Y + 15) return false;
      if (ax > 6 && y > Y + 11 && (ax - 6) + (y - (Y + 11)) > 4) return false;
      return true;
    };
    // face pattern of a tier shell block: which face it is on and its column index along that face
    const shell = (x, y, z, hw, z0, z1, y0, y1, hasPortal) => {
      const ax = Math.abs(x);
      const onX = ax === hw, onZ = z === z0 || z === z1, top = y === y1;
      if (!onX && !onZ && !top) return null;
      if (top) return (onX || onZ || ax === hw - 1 || z === z0 + 1 || z === z1 - 1) ? K.BAR : K.SMOOTH; // light bars along every tier's top edge
      const cornerX = ax >= hw - 1 && (z <= z0 + 1 || z >= z1 - 1), cornerZ = (z === z0 || z === z1) && ax >= hw - 1;
      if ((onX && (z <= z0 + 1 || z >= z1 - 1)) || (onZ && ax >= hw - 1)) return (y - y0) % 4 === 3 ? K.BAND : K.SLIT; // glowing corner slits
      const along = onZ ? x + hw : (z - z0);                  // column index along the face
      const bay = ((along % 6) + 6) % 6;
      if (bay === 0) return K.PIL;                            // pilasters every 6 blocks
      if (y === y0 + 1) return K.BAND;                        // carved plinth band
      const h = y - y0;
      const winRow = h >= 3 && ((h - 3) % 7) <= 4 && h <= y1 - y0 - 3;   // rows of 5-tall windows every 7 blocks
      if (winRow && bay >= 2 && bay <= 4 && !(hasPortal && onZ && z === z1 && ax <= 9)) return K.WIN;
      void cornerX; void cornerZ;
      return K.WALL;
    };
    return function mat(x, y, z) {
      const ax = Math.abs(x), sx = x < 0 ? -1 : 1;
      // ---- the Hangar Hall cavity
      if (inHall(x, y, z)) return 0;
      // ---- portal (front face z = fx) and back door (z = bx)
      if (z === fx && ax <= 9 && y >= Y + 1 && y <= Y + 16) {
        const t = y - (Y + 1);
        if (t <= 12) {
          const o = OPEN[t];
          if (ax <= o) return K.VEIL;
          if (ax === o + 1) return K.FRAME;
          if (ax === o + 2) return K.BAND;
          if (ax === o + 3) return K.BAR;
        } else if (t === 13) { if (ax <= 4) return K.FRAME; if (ax === 5) return K.BAND; if (ax === 6) return K.BAR; }
        else if (t === 14) { if (ax <= 5) return K.BAND; if (ax === 6 || ax === 7) return K.BAR; }
        else if (t === 15) { if (ax <= 7) return K.BAR; }
      }
      if (z === bx && ax <= 6 && y >= Y + 1 && y <= Y + 10) {
        const t = y - (Y + 1);
        if (t <= 8) { const o = BACK[t]; if (ax <= o) return 0; if (ax === o + 1) return K.FRAME; if (ax === o + 2) return K.BAR; }
        else if (t === 9) { if (ax <= 3) return K.FRAME; if (ax === 4) return K.BAR; }
        else if (t === 10 && ax <= 4) return K.BAR;
      }
      // ---- hall lining: the blocks around the cavity are hangar panels
      if (ax <= 12 && z > bx && z < fx && y >= Y + 1 && y <= Y + 17) {
        const near = inHall(x - 1, y, z) || inHall(x + 1, y, z) || inHall(x, y - 1, z) || inHall(x, y + 1, z) || inHall(x, y, z - 1) || inHall(x, y, z + 1);
        if (near) {
          if (y === Y + 16 || y === Y + 17) return K.GRAY;                  // ceiling
          if (ax >= 7 && y > Y + 11) return K.GRAY;                         // chamfers
          return ((z + y) % 5 === 0) ? K.HEX : K.DARK;                       // walls with light strips
        }
      }
      // ---- crown & antenna
      if (ax <= CROWN[0] && z >= CROWN[1] && z <= CROWN[2] && y >= CROWN[3] && y <= CROWN[4]) return (y === CROWN[4] || ax === CROWN[0] || z === CROWN[1] || z === CROWN[2]) ? ((y - CROWN[3]) % 3 === 2 ? K.BAR : K.SMOOTH) : K.SMOOTH;
      if (x === 0 && z === -10 && y > CROWN[4] && y <= CROWN[4] + 5) return y === CROWN[4] + 5 ? K.BEACON : K.ANT;
      // ---- tiers (top to bottom so the upper tier's shell wins over the lower tier's roof)
      for (let k = TIERS.length - 1; k >= 0; k--) {
        const [hw, z0, z1, y0, y1] = TIERS[k];
        if (ax <= hw && z >= z0 && z <= z1 && y >= y0 && y <= y1) {
          const s = shell(x, y, z, hw, z0, z1, y0, y1, k === 0);
          return s !== null ? s : K.SMOOTH;
        }
      }
      // ---- wings
      if (ax >= 22 && ax <= 55 && z >= -28 && z <= 15 && y >= Y + 1 && y <= Y + 28) {
        const s = shell(sx * ax, y, z, 55, -28, 15, Y + 1, Y + 28, false);
        if (ax === 22 && s === null) return K.SMOOTH;
        if (s !== null) { if (ax === 22) return K.SMOOTH; return s; }
        // hollow inside with floors every 6 and hanging hex lights
        const h = y - (Y + 1);
        if (h % 6 === 0) return K.SMOOTH;
        if (h % 6 === 5 && (ax % 5 === 0) && (z % 5 === 0)) return K.HEXL;
        return 0;
      }
      // ---- fluted corner towers
      for (const [tx, tz, r, h] of [[50, -24, 4, 74], [24, -37, 3.5, 60]]) {
        const dx = ax - tx, dz = z - tz, d = oct(dx, dz);
        if (d > r + 1.5) continue;
        const t = y - (Y + 1);
        if (t < 0 || t > h + 12) continue;
        if (t === h + 12) { if (d < 1) return K.BEACON; continue; }
        let rr = r;
        if (t > h) rr = Math.max(0.5, r * (1 - (t - h) / 11));          // pointed cap
        if (d > rr + 0.01) continue;
        if (t > h) return d > rr - 1.01 ? K.SMOOTH : K.SMOOTH;
        if (d < rr - 1.01) return K.SMOOTH;
        const a8 = Math.atan2(dz, dx) / Math.PI * 4 + 8, frac = a8 - Math.floor(a8), sect = (a8 | 0) & 7;
        if (frac < 0.15 || frac > 0.85) return K.PIL;                      // ribs on the eight edges
        if (t % 12 === 11) return K.BAR;                                   // orange rings
        if (t > 4 && t < h - 4 && Math.abs(frac - 0.5) < 0.2 && (sect & 1) === 0 && (t % 12) >= 2 && (t % 12) <= 8) return K.SLIT;
        return K.WALL;
      }
      // ---- saucer pad towers
      {
        const dx = ax - 40, dz = z - 8, d = oct(dx, dz);
        if (d <= 8) {
          const t = y - (Y + 1);
          if (t >= 0 && t < 46 && d <= 2.5) return d > 1.5 ? ((t % 8 === 7) ? K.BAR : K.WALL) : K.SMOOTH;
          if (t >= 46 && t <= 48 && d <= 7) {
            if (t === 46) return d > 5.9 ? K.BAR : K.SMOOTH;
            if (t === 47) return d > 5.9 ? K.CYAN : K.SMOOTH;
            return d > 6.2 ? K.HAZ : d <= 1.5 ? K.PAD : K.DECK;
          }
          if (t >= 49 && t <= 66 && d <= 7) return 0;                     // keep the pad clear
        }
      }
      // ---- domed hall (east side)
      {
        const dx = x - 69, dz = z + 5, d = Math.hypot(dx, dz);
        if (d <= 13.5) {
          if (y >= Y + 1 && y <= Y + 7) { if (d > 12.5) return -1; if (d > 11.5) return (y === Y + 7) ? K.BAR : (Math.round(Math.atan2(dz, dx) / Math.PI * 12) % 3 === 0 ? K.SLIT : K.WALL); return K.SMOOTH; }
          if (y > Y + 7 && y <= Y + 21) {
            const dy = y - (Y + 7), rd = Math.hypot(d, dy * 1.05);
            if (rd > 12.6) return -1;
            if (rd > 11.5) return (dy === 5 || dy === 9) ? K.PANEL : K.SMOOTH;
            return 0;
          }
          if (x === 69 && z === -5 && y > Y + 21 && y <= Y + 28) return y === Y + 28 ? K.BEACON : (y > Y + 25 ? K.ANT : K.SMOOTH);
        }
      }
      // ---- garden terraces and grand stairs
      if (ax >= 24 && ax <= 56 && z >= 16 && z <= 30) {
        if (y > Y + 8) return -1;
        if (ax === 56 || z === 30 || ax === 24 || z === 16) return y === Y + 8 ? K.BAND : K.WALL;   // stone rim
        if (y === Y + 8) return K.GRASS;
        if (y === Y + 7) return K.DIRT;
        return K.SMOOTH;
      }
      if (ax >= 24 && ax <= 31 && z >= 31 && z <= 38) {
        const k = 38 - z;                                                  // step 0 at z 38 (plaza) … 7 at z 31
        const stepY = Y + 1 + k;
        if (y > stepY) return -1;
        if (y === stepY) return K.STAIR;
        return K.WALL;
      }
      if ((ax === 23 || ax === 32) && z >= 30 && z <= 38) { const k = Math.min(7, 38 - z); if (y <= Y + 2 + k) return y === Y + 2 + k ? K.BAND : K.WALL; return -1; }
      return -1;
    };
  }

  // ---------------------------------------------------------------- build (cached per generator)
  // The build is a generator: it yields every few columns of the footprint and between its sections, so a worker can
  // build it in slices (TEMPLE.advance, worker_main.js). TEMPLE.build runs it to the end, once per generator.
  TEMPLE.buildSteps = function* (g) {
    if (g._temple) return g._temple;
    const K = mats(), mat = makeMat(K);
    // vgen 6 (the trailer's Gate Temple: landing-strip lights, the 7-high hex corridor). Older worlds keep the temple they
    // were made with (AGENTS.md: old worlds' generated chunks stay identical), so their terrain is the HEAD one.
    const v6 = g.vgen >= 6;
    const chunks = new Map();
    const bucket = (x, z) => { const k = (x >> 4) + ',' + (z >> 4); let b = chunks.get(k); if (!b) { b = { f: [], o: [] }; chunks.set(k, b); } return b; };
    const fill = (x, z, y0, y1, s) => { if (y1 >= y0) bucket(x, z).f.push(x, z, y0, y1, s); };
    const put = (x, y, z, s) => { bucket(x, z).o.push(x, y, z, s); };
    const ground = (x, z) => g.surfaceY(x, z);
    const AIR = 0;
    // ---- the building: every column of the footprint, run-length encoded
    const bx0 = -66, bx1 = 84, bz0 = -50, bz1 = 42;
    // how high a column can reach (so the material scan stops early; 0 = no structure here at all)
    const colTop = (x, z) => {
      const ax = Math.abs(x);
      let top = 0;
      if (ax <= 22 && z >= T.back && z <= T.front) top = Y + 56;
      if (ax >= 22 && ax <= 55 && z >= -28 && z <= 15) top = Math.max(top, Y + 31);
      if (oct(ax - 50, z + 24) <= 6) top = Math.max(top, Y + 90);
      if (oct(ax - 24, z + 37) <= 5.5) top = Math.max(top, Y + 76);
      if (oct(ax - 40, z - 8) <= 8.5) top = Math.max(top, Y + 52);
      if (Math.hypot(x - 69, z + 5) <= 14) top = Math.max(top, Y + 30);
      if (ax >= 23 && ax <= 56 && z >= 16 && z <= 38) top = Math.max(top, Y + 10);
      return top;
    };
    for (let x = bx0; x <= bx1; x++) for (let z = bz0; z <= bz1; z++) {
      const TOP = colTop(x, z);
      if (!TOP) continue;
      yield;   // at most one column with structure per step (a tower column is ~90 material samples)
      let runS = -2, runY = 0, any = false, maxY = Y;
      const flush = (yEnd) => { if (runS === -2) return; if (runS >= 0) fill(x, z, runY, yEnd, runS); runS = -2; };
      for (let y = Y + 1; y <= TOP; y++) {
        const s = mat(x, y, z);
        if (s !== -1) { any = true; if (y > maxY) maxY = y; }
        const key = s === -1 ? -2 : s; // -1 → leave terrain (no run)
        if (key !== runS) { flush(y - 1); runS = key; runY = y; }
      }
      flush(TOP);
      if (any) {
        // foundation to the rock and clear air above the structure
        const gy = ground(x, z);
        if (gy < Y) fill(x, z, gy + 1, Y - 1, K.SMOOTH);
        put(x, Y, z, K.SMOOTH);
        fill(x, z, maxY + 1, Math.max(maxY + 6, gy + 3), AIR);
      }
    }
    yield;
    // ---- hall floor, pad ring, light lines, furniture
    const HZ = -10; // pad centre z
    for (let x = -10; x <= 10; x++) for (let z = T.back + 1; z <= T.front - 1; z++) {
      const d = oct(x, z - HZ);
      let s = K.HEXF;
      if (Math.abs(x) <= 1 && Math.abs(z - HZ) <= 1) s = K.PAD;
      else if (Math.abs(Math.round(d) - 5) === 0 || Math.abs(Math.round(d) - 8) === 0) s = K.LINE;
      else if (Math.abs(x) === 1 && (z > HZ + 8 || z < HZ - 8)) s = K.LINE;   // guide lines to both doors
      put(x, Y, z, s);
    }
    for (let z = HZ + 9; z <= T.front; z++) put(0, Y, z, K.DECK);
    for (let z = T.back; z < HZ - 8; z++) put(0, Y, z, K.DECK);
    // consoles (facing the wall behind them) with stools, big holo screens above
    for (const sx of [-1, 1]) {
      const wallX = sx * 10, conX = sx * 7, stoolX = sx * 6;
      for (let z = -4; z <= 6; z++) { put(conX, Y + 1, z, sx > 0 ? K.CON1 : K.CON3); if (z % 2 === 0) put(stoolX, Y + 1, z, K.STOOL); }
      for (let z = -6; z <= 8; z++) for (let y = Y + 4; y <= Y + 8; y++) put(wallX, y, z, sx > 0 ? K.HOLO1 : K.HOLO3);
      for (let z = -36; z <= -30; z++) for (let y = Y + 3; y <= Y + 5; y++) put(wallX, y, z, sx > 0 ? K.HOLOA1 : K.HOLOA3);
      for (let z = -28; z <= -14; z += 2) put(wallX, Y + 1, z, sx > 0 ? K.LOCKER1 : K.LOCKER3);
      for (let z = -38; z <= 16; z += 6) put(sx * 11, Y + 10, z, K.PANELA);   // amber accent lights in the walls
      put(sx * 8, Y + 1, 12, K.SOFA); put(sx * 8, Y + 1, 13, K.SOFA);
    }
    put(0, Y + 1, -30, K.HTABLE);
    for (const [dx, dz] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) put(dx, Y + 1, -30 + dz, K.STOOLO);
    // ceiling lights: an octagon ring over the pad, a row down the axis
    for (let x = -8; x <= 8; x++) for (let z = HZ - 8; z <= HZ + 8; z++) { if (Math.round(oct(x, z - HZ)) === 6) put(x, Y + 15, z, K.HEXLC); }
    for (let z = T.back + 4; z <= T.front - 4; z += 6) { if (Math.abs(z - HZ) > 7) { put(0, Y + 15, z, K.HEXL); put(-5, Y + 15, z, K.HEXL); put(5, Y + 15, z, K.HEXL); } }
    yield;
    // ---- outside: the path to the city from the back door
    // a corridor 7 wide and 7 high from the back door to the city (TRAILER.md shot E, t1_21): hex panels down both sides,
    // a row of cyan hex lights in the ceiling, the chamfered top corners in grey
    for (let z = T.back - 1; z >= T.back - 9; z--) {
      if (!v6) { for (let x = -3; x <= 3; x++) { const gy = ground(x, z); fill(x, z, gy + 1, Y - 1, K.DIRT); put(x, Y, z, Math.abs(x) === 3 ? K.LINE : K.PLAZA); fill(x, z, Y + 1, Y + 6, AIR); } continue; }
      for (let x = -3; x <= 3; x++) { const gy = ground(x, z); fill(x, z, gy + 1, Y - 1, K.DIRT); put(x, Y, z, Math.abs(x) === 3 ? K.LINE : K.PLAZA); fill(x, z, Y + 1, Y + 7, AIR); }
      for (const sx of [-1, 1]) {
        const gy = ground(sx * 4, z); if (gy < Y) fill(sx * 4, z, gy + 1, Y - 1, K.SMOOTH);
        for (let y = Y + 1; y <= Y + 6; y++) put(sx * 4, y, z, ((z + y) % 5 === 0) ? K.HEX : K.DARK);
        put(sx * 4, Y + 7, z, K.GRAY); put(sx * 3, Y + 7, z, K.GRAY);
      }
      for (let x = -2; x <= 2; x++) put(x, Y + 8, z, K.GRAY);
      put(0, Y + 8, z, z % 4 === 0 ? K.HEXLC : K.GRAY);
      // the city end (t3_04, the portal as a window): a veil across the opening, cut to an octagon by light-bar corners,
      // in a frame of orange light bars — from inside the corridor the palm city shows through its clear middle
      if (z === T.back - 9) {
        for (let y = Y + 1; y <= Y + 7; y++) for (let x = -3; x <= 3; x++) put(x, y, z, (Math.abs(x) === 3 && (y === Y + 1 || y === Y + 7)) ? K.BAR : K.VEIL);
        for (const sx of [-1, 1]) for (let y = Y + 1; y <= Y + 7; y++) put(sx * 4, y, z, K.BAR);
        for (let x = -2; x <= 2; x++) put(x, Y + 8, z, K.BAR);
      }
    }
    // ---- the plaza & runway
    for (let x = -60; x <= 60; x++) for (let z = 21; z <= 140; z++) {
      if (z === 21) yield;
      const ax = Math.abs(x);
      if (ax >= 24 && ax <= 56 && z <= 30) continue;                     // terraces
      if (ax >= 23 && ax <= 32 && z <= 38) continue;                     // stairs
      const gy = ground(x, z);
      if (gy < Y) fill(x, z, gy + 1, Y - 1, K.SMOOTH);
      let s = K.FLAG;
      if (ax <= 4) s = K.DECK; else if (ax === 5) s = K.LINE;
      // the landing strip's lights (vgen 6): amber neon bars across the centre line every 8 blocks, flush with the deck,
      // so they glow from above (the light bar's top is plain stone)
      if (v6 && x >= -1 && x <= 1 && z % 8 === 4) s = K.NEONA;
      if (ax >= 18 && ax <= 21 && z >= 40 && z <= 132 && (z % 24) >= 2 && (z % 24) <= 20) s = K.GRASS;   // lawn strips
      put(x, Y, z, s);
      fill(x, z, Y + 1, Math.max(Y + 8, gy + 3), AIR);
    }
    // lamps along the runway, hedges and trees on the lawns, crystals in the corners
    for (let z = 30; z <= 138; z += 12) for (const sx of [-1, 1]) { put(sx * 8, Y + 1, z, K.LAMP0); put(sx * 8, Y + 2, z, K.LAMP1); }
    const rng = new VR.RNG(g.seed ^ 0x7e3);
    const placed = new Map();
    const pk = (x, y, z) => (x + 512) * 1048576 + (z + 512) * 512 + y;
    const w = { set: (x, y, z, s) => { placed.set(pk(x, y, z), s); put(x, y, z, s); }, place: (x, y, z, s) => { const k = pk(x, y, z); if (placed.get(k)) return false; placed.set(k, s); put(x, y, z, s); return true; }, get: (x, y, z) => placed.get(pk(x, y, z)) || 0, ok: () => true };
    // vgen 9 (t-beauty): the plaza's trees are the city's round tree (vm_tree_round_l) in a raised bed — a light grey
    // kerb one block high round dark soil and ferns — instead of a blob of leaf blocks (from 150 m at the golden hour
    // they read as dark stepped cubes beside Nova Haven's round trees)
    const tree = g.vgen >= 9 && VR.Plants && R.byName.vm_tree_round_l ? (x, y, z) => {
      const KB = st('vollton_light_grey'), SOIL = st('podzol'), FERN = st('vx_fern_lush');
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
        const ex = Math.abs(dx) === 2, ez = Math.abs(dz) === 2;
        if (ex && ez) continue;                                            // (the bed's corners cut: an octagon)
        put(x + dx, y, z + dz, ex || ez ? KB : SOIL);
        if (!ex && !ez && Math.abs(dx) === 1 && Math.abs(dz) === 1) put(x + dx, y + 1, z + dz, FERN);
      }
      for (const [px, py, pz, s] of VR.Plants.parts('vm_tree_round_l', x - 2, y + 1, z - 2, 0)) put(px, py, pz, s);
    } : (x, y, z) => GEN.TREES.roundTree(w, x, y, z, rng);
    for (let z = 46; z <= 130; z += 24) for (const sx of [-1, 1]) {
      tree(sx * 28, Y + 1, z);
      for (let k = -6; k <= 6; k++) if (Math.abs(k) > 2) put(sx * 20, Y + 1, z + k, K.HEDGE);
      put(sx * 34, Y + 1, z - 4, K.BUSH); put(sx * 34, Y + 1, z + 4, K.BUSH);
    }
    // (vgen 9, VR.GEN.noCry: no crystals — a palm in a planter with two hedges at its foot in each corner)
    const noCry = VR.GEN.noCry(g);
    for (const [x, z] of [[-57, 136], [57, 136], [-58, 60], [58, 60]]) {
      if (noCry) { put(x, Y + 1, z, K.PLANTER); if (VR.Plants) VR.Plants.palm(put, x, Y + 2, z, 7); put(x + 1, Y + 1, z, K.HEDGE); put(x, Y + 1, z + 1, K.HEDGE); continue; }
      for (let k = 0; k < 4; k++) put(x, Y + 1 + k, z, K.CRYB); put(x, Y + 5, z, K.CRY); put(x + 1, Y + 1, z, K.CRY); put(x, Y + 1, z + 1, K.CRYA);
    }
    // ---- terrace gardens
    for (const sx of [-1, 1]) {
      const tx = sx * 40;
      tree(tx, Y + 9, 23);
      for (let x = 26; x <= 54; x++) if ((x % 3) !== 1) put(sx * x, Y + 9, 29, K.HEDGE);
      for (let z = 17; z <= 29; z++) if ((z % 3) !== 1) put(sx * 55, Y + 9, z, K.HEDGE);
      for (const [dx, dz] of [[-9, 19], [-6, 18], [8, 27]]) { put(sx * (40 + dx), Y + 9, dz, noCry ? K.HEDGE : K.CRYB); put(sx * (40 + dx), Y + 10, dz, noCry ? K.LANTERN : K.CRY); }   // (vgen 9: a hedge with a lantern on it)
      put(sx * 30, Y + 9, 18, K.LAMP0); put(sx * 30, Y + 10, 18, K.LAMP1); put(sx * 50, Y + 9, 18, K.LAMP0); put(sx * 50, Y + 10, 18, K.LAMP1);
      for (const [dx, dz] of [[-13, 26], [12, 22], [-3, 27]]) put(sx * (40 + dx), Y + 9, dz, K.BUSH);
      put(sx * 27, Y + 9, 17, K.PLANTER); put(sx * 53, Y + 9, 17, K.PLANTER);
    }
    yield;
    // ---- roof gardens on the wings, railings on every roof edge
    for (const sx of [-1, 1]) {
      for (let x = 22; x <= 55; x++) for (let z = -28; z <= 15; z++) {
        const edge = x === 55 || z === -28 || z === 15 || x === 22;
        if (edge && x !== 22) put(sx * x, Y + 29, z, K.RAIL);
        else if ((x % 6 === 3) && (z % 8 === 4)) put(sx * x, Y + 29, z, K.BUSH);
        else if ((x % 6 === 0) && (z % 8 === 0)) put(sx * x, Y + 29, z, K.PLANTER);
      }
    }
    const base = {
      inside: [0, Y + 1, -20], portal: [0, Y + 1, T.front], apron: [0, Y + 1, 30], yaw: Math.PI,
      // the spawn stands on the hall's deck in front of the pad, facing it (the parked hangar shuttle is solid and 23 m long:
      // a spawn on the pad itself was pushed out of its hull the moment the ship was built)
      spawn: [0.5, Y + 1, HZ + 14.5, Math.PI],
      pad: { x: 0, y: Y + 1, z: HZ, seed: (g.seed ^ 0x51ab) >>> 0, dir: 0 },
      box: [-10, Y + 1, T.back + 1, 10, Y + 15, T.front - 1],
      work: [['control', -6, Y + 1, 0], ['control', 6, Y + 1, 0], ['control', -6, Y + 1, 4], ['control', 6, Y + 1, 4]],
      back: [0, Y + 1, T.back],
    };
    g._temple = { chunks, base, box: TEMPLE.box };
    return g._temple;
  };
  // the temple of g, built to the end. In a worker job that needs it (VG.probe set) the run ends instead, and the job
  // waits for the slices (worker_main.js); a job that is not in a run builds it here.
  TEMPLE.build = function (g) {
    if (g._temple) return g._temple;
    const pr = VR.VillageGen && VR.VillageGen.probe;
    if (pr) { pr.miss = { temple: g }; throw pr; }
    return TEMPLE.advance(g, Infinity);
  };
  // builds the temple of g for about ms (a worker's turn); returns it when done, else null
  TEMPLE.advance = function (g, ms) {
    if (g._temple) return g._temple;
    if (!g._templeBuild) g._templeBuild = TEMPLE.buildSteps(g);
    const t0 = performance.now();
    let r;
    try { do { r = g._templeBuild.next(); } while (!r.done && performance.now() - t0 < ms); }
    catch (e) { g._templeBuild = null; throw e; }
    if (!r.done) return null;
    g._templeBuild = null;
    return r.value;
  };

  // ---------------------------------------------------------------- per-chunk stamp
  HEART.builders.push(function (g, cx, cz, out) {
    const x0 = cx * 16, z0 = cz * 16;
    const B = TEMPLE.box;
    if (x0 + 16 <= B.x0 || x0 > B.x1 || z0 + 16 <= B.z0 || z0 > B.z1) return;
    const tp = TEMPLE.build(g);
    const b = tp.chunks.get(cx + ',' + cz);
    if (!b) return;
    const blocks = out.blocks;
    for (let i = 0; i < b.f.length; i += 5) {
      const lx = b.f[i] - x0, lz = b.f[i + 1] - z0, s = b.f[i + 4];
      const y0 = Math.max(1, b.f[i + 2]), y1 = Math.min(254, b.f[i + 3]);
      for (let y = y0; y <= y1; y++) blocks[(y << 8) | (lz << 4) | lx] = s;
    }
    for (let i = 0; i < b.o.length; i += 4) {
      const lx = b.o[i] - x0, lz = b.o[i + 2] - z0, y = b.o[i + 1];
      if (y < 1 || y > 254) continue;
      blocks[(y << 8) | (lz << 4) | lx] = b.o[i + 3];
    }
    // the ship on the pad announces itself from the pad's chunk
    if (tp.base.pad.x >= x0 && tp.base.pad.x < x0 + 16 && tp.base.pad.z >= z0 && tp.base.pad.z < z0 + 16) {
      if (!out.spawns) out.spawns = [];
      const row = ['starship', tp.base.pad.seed, tp.base.pad.x, tp.base.pad.y, tp.base.pad.z, tp.base.pad.dir];
      if (g.vgen >= 6) row.push('hangar');   // vgen 6: a parked shuttle that burns its thrusters (starships.js hangarFx)
      out.spawns.push(row);
    }
    // the Hangar Hall's crew (vgen 6): spawned with the chunk they stand in
    if (g.vgen >= 6) for (const c of TEMPLE.crew(HEART.PLAT)) if (c[0] >= x0 && c[0] < x0 + 16 && c[2] >= z0 && c[2] < z0 + 16) {
      if (!out.spawns) out.spawns = [];
      out.spawns.push(['hallcrew', c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7]]);
    }
  });
  HEART.templeBase = (g) => TEMPLE.build(g).base;
})(VR);

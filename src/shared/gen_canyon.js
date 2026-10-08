// ============================================================================
// The Ember Canyon's tech layer (TRAILER.md §3.5): the Canyon Loop sky rail —
// a horseshoe line on thin pillars that leaves the Gate Plaza's rim, winds
// around the mesas high over the lava cracks and comes back to the plaza — with
// a tram shuttling on it; watchtowers (dark hull, cyan light strips, a deck
// with a turret and a red beacon) on the mesa tops; turret nests; and a small
// ruined village of dusk and ochre bricks with magenta windows.
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R, M = VR.M, HEART = VR.Heart, SEA = VR.C.SEA;
  const OG = VR.OverworldGen && VR.OverworldGen.prototype;
  if (!HEART || !OG) return;
  const CAN = VR.CanyonGen = {};
  const stCache = new Map();
  const st = (name, props) => { const key = props ? name + JSON.stringify(props) : name; let s = stCache.get(key); if (s !== undefined) return s; const t = R.byName[name]; s = t ? (props ? t.state(props) : t.defaultState) : 0; stCache.set(key, s); return s; };
  const Y = HEART.PLAT;
  // the loop's waypoints (world x, z): out of the plaza's east rim, around three mesas, back to the west rim
  const WAY = [[58, 140], [110, 186], [175, 250], [215, 335], [190, 420], [110, 478], [10, 496], [-90, 470], [-190, 400], [-205, 300], [-150, 215], [-58, 140]];
  CAN.box = { x0: -240, x1: 250, z0: 120, z1: 520 };

  // ---------------------------------------------------------------- the loop line
  CAN.line = function (g) {
    if (g._canyonLine) return g._canyonLine;
    // a smooth spline through the waypoints (Catmull-Rom), sampled about every block
    const P = [];
    const n = WAY.length;
    const cr = (p0, p1, p2, p3, t) => { const t2 = t * t, t3 = t2 * t; return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); };
    for (let i = 0; i < n - 1; i++) {
      const a = WAY[Math.max(0, i - 1)], b = WAY[i], c = WAY[i + 1], d = WAY[Math.min(n - 1, i + 2)];
      const seg = Math.hypot(c[0] - b[0], c[1] - b[1]), steps = Math.max(2, Math.round(seg));
      for (let k = 0; k < steps; k++) { const t = k / steps; P.push([cr(a[0], b[0], c[0], d[0], t), cr(a[1], b[1], c[1], d[1], t)]); }
    }
    P.push([WAY[n - 1][0], WAY[n - 1][1]]);
    // heights: clear the land generously (the deck rides 8–20 above the mesa tops), gentle grades, plaza level at the ends
    const m = P.length, ground = P.map(p => g.surfaceY(Math.round(p[0]), Math.round(p[1])));
    const req = new Float64Array(m);
    for (let i = 0; i < m; i++) { let mx = SEA; for (let k = -10; k <= 10; k++) { const q = ground[Math.max(0, Math.min(m - 1, i + k))]; if (q > mx) mx = q; } req[i] = Math.min(150, Math.max(Y + 6, mx + 9)); }
    req[0] = Y + 1; req[m - 1] = Y + 1;
    const H = Float64Array.from(req), GRADE = 1 / 7;
    for (let i = 1; i < m; i++) H[i] = Math.max(H[i], H[i - 1] - GRADE);
    for (let i = m - 2; i >= 0; i--) H[i] = Math.max(H[i], H[i + 1] - GRADE);
    for (let i = 0; i < m; i++) H[i] = Math.min(H[i], Y + 1 + Math.max(0, i - 8) * GRADE);
    for (let i = m - 1; i >= 0; i--) H[i] = Math.min(H[i], Y + 1 + Math.max(0, m - 1 - i - 8) * GRADE);
    const Yl = Array.from(H, v => Math.round(v));
    g._canyonLine = { key: 'heart-loop', pts: P, Y: Yl, ground, tech: true, names: ['Gate Plaza East', 'Gate Plaza West'] };
    return g._canyonLine;
  };
  // the track's block points: rounded, one point per block and 8-connected (the spline's samples are about a block apart,
  // so neighbours repeat or skip a block; the gaps are filled in along the way)
  CAN.describe = function (Ln) {
    const n = Ln.pts.length, out = [];
    let lx = NaN, lz = NaN, ly = 0;
    for (let i = 0; i < n; i++) {
      const x = Math.round(Ln.pts[i][0]), z = Math.round(Ln.pts[i][1]), y = Ln.Y[i];
      if (out.length) {
        const steps = Math.max(Math.abs(x - lx), Math.abs(z - lz));
        for (let k = 1; k < steps; k++) out.push([Math.round(lx + (x - lx) * k / steps), Math.round(ly + (y - ly) * k / steps), Math.round(lz + (z - lz) * k / steps)]);
        if (steps === 0) { out[out.length - 1][1] = y; ly = y; continue; }
      }
      out.push([x, y, z]); lx = x; lz = z; ly = y;
    }
    const P = new Int32Array(out.length * 3);
    out.forEach((q, i) => { P[i * 3] = q[0]; P[i * 3 + 1] = q[1]; P[i * 3 + 2] = q[2]; });
    return { key: Ln.key, pts: P, tech: true, names: Ln.names };
  };
  // the tram system learns about the loop through the same channel as the viaduct lines
  const RG = VR.RailGen;
  if (RG) {
    const prevNear = RG.near;
    RG.near = function (g, x, z, r) {
      const out = prevNear.call(this, g, x, z, r);
      if (HEART.on(g) && Math.hypot(x - 0, z - 320) < r + 260) out.push(CAN.describe(CAN.line(g)));
      return out;
    };
  }

  // the lava vents: where the two crack seams of the mesa tops cross (the noise gen_realm draws the seams with). Smoke
  // columns rise from them at run time (vents.js); computed once per world, a couple of dozen points at most.
  // one grid point (x, z) of the vent lattice: a vent [x, y, z] on a mesa top, or null
  CAN.ventAt = function (g, x, z) {
    if (Math.abs(g.nCrack.n2(x, z)) > 0.025 || Math.abs(g.nCrack2.n2(x, z)) > 0.025) return null;
    const cl = g.climateAt(x, z);
    if (cl.heart < 0.5 || cl.ember < 0.6 || cl.canyon > 0.3) return null;
    const h = g.surfaceY(x, z);
    if (h < 88 || h > 120) return null;
    return [x, h + 1, z];
  };
  // every vent of the canyon box (a lattice of 4 blocks; the chunks carry their own, see ventsIn)
  CAN.vents = function (g) {
    if (g._canyonVents) return g._canyonVents;
    VR.realmNoise(g);
    const out = [], B = CAN.box;
    for (let x = B.x0 + 4; x <= B.x1 - 4; x += 4) for (let z = B.z0 + 4; z <= B.z1 - 4; z += 4) { const v = CAN.ventAt(g, x, z); if (v) out.push(v); }
    g._canyonVents = out;
    return out;
  };
  // the vents of one chunk: the lattice points that fall inside it (the chunk generator writes them as spawns)
  CAN.ventsIn = function (g, cx, cz) {
    VR.realmNoise(g);
    const out = [], B = CAN.box, x0 = cx * 16, z0 = cz * 16;
    for (let x = B.x0 + 4; x <= B.x1 - 4; x += 4) {
      if (x < x0 || x >= x0 + 16) continue;
      for (let z = B.z0 + 4; z <= B.z1 - 4; z += 4) { if (z < z0 || z >= z0 + 16) continue; const v = CAN.ventAt(g, x, z); if (v) out.push(v); }
    }
    return out;
  };

  // ---------------------------------------------------------------- ops
  function mats() {
    return {
      DECK: st('hull_plating_dark'), EDGE: st('dark_hull_slab', { type: 1 }) || st('hull_plating_dark'), RAILX: st('powered_rail', { shape: 1, powered: 1 }), RAILZ: st('powered_rail', { shape: 0, powered: 1 }),
      PILLAR: st('hull_plating_dark'), STRIPE: st('hull_stripe_orange', { axis: 0 }) || st('hull_plating_gray'), CYAN: st('neon_cyan'), LIGHT: st('light_panel', { facing: 4 }) || st('neon_cyan'), PAD: st('vx_floor_deck'), PADC: st('vx_floor_pad'), HAZ: st('hazard_stripes'),
      LAMP0: st('vx_lamppost_tech', { head: 0 }), LAMP1: st('vx_lamppost_tech', { head: 1 }), BEACON: st('beacon_red'), LBEACON: st('launch_beacon'), ANT: st('antenna'), TURRET: st('turret'),
      HULLG: st('hull_plating_gray'), PANEL: st('tech_panel'), PANELA: st('tech_panel_amber'), RAILING: st('vx_tech_railing'), VIEW: st('viewport'),
      DUSK: st('duskrock_bricks'), OCHRE: st('ochre_bricks'), MAG: st('neon_magenta'), CRYV: st('violet_crystal_cluster', { facing: 4, size: 1 }), CRYVB: st('violet_crystal_block'), COBBLE: st('mossy_cobblestone') || st('cobblestone'),
      CRYB: (c) => st(c + '_crystal_block'), CRY: (c, big) => st(c + '_crystal_cluster', { facing: 4, size: big ? 1 : 0 }),
    };
  }
  CAN.build = function (g) {
    if (g._canyonOps) return g._canyonOps;
    const K = mats(), Ln = CAN.line(g);
    const chunks = new Map();
    const bucket = (x, z) => { const k = (x >> 4) + ',' + (z >> 4); let b = chunks.get(k); if (!b) { b = { f: [], o: [] }; chunks.set(k, b); } return b; };
    const fill = (x, z, y0, y1, s) => { if (y1 >= y0) bucket(x, z).f.push(x, z, y0, y1, s); };
    const put = (x, y, z, s) => { bucket(x, z).o.push(x, y, z, s); };
    const rng = new VR.RNG(g.seed ^ 0xca17);
    // ---- the loop: 3-wide dark deck, powered rail down the middle, cyan edge lights, one-block pillars
    const P = Ln.pts, n = P.length;
    const done = new Set();
    for (let i = 0; i < n; i++) {
      const [x, z] = P[i], y = Ln.Y[i];
      const nx0 = P[Math.min(n - 1, i + 1)][0] - P[Math.max(0, i - 1)][0], nz0 = P[Math.min(n - 1, i + 1)][1] - P[Math.max(0, i - 1)][1];
      const len = Math.hypot(nx0, nz0) || 1, tx = nx0 / len, tz = nz0 / len, sx = -tz, sz = tx;
      const alongX = Math.abs(tx) >= Math.abs(tz);
      for (let v = -1; v <= 1; v++) {
        const px = Math.round(x + sx * v), pz = Math.round(z + sz * v);
        const key = px + ',' + pz + ',' + y; if (done.has(key)) continue; done.add(key);
        put(px, y, pz, v === 0 ? K.DECK : K.EDGE);
        fill(px, pz, y + 1, y + 5, 0);
        if (v === 0) put(px, y + 1, pz, alongX ? K.RAILX : K.RAILZ);
        else if (i % 8 === (v > 0 ? 0 : 4)) put(px, y + 1, pz, K.LIGHT);
      }
      if (i % 5 === 0 && i > 8 && i < n - 9) {
        const px = Math.round(x), pz = Math.round(z), gy = g.surfaceY(px, pz);
        if (gy < y - 1) for (let yy = Math.max(2, gy - 2); yy < y; yy++) put(px, yy, pz, (yy % 7 === 0) ? K.STRIPE : K.PILLAR);
      }
    }
    // stations at both ends: a platform beside the track on the plaza's rim, lamps, a beacon
    for (const end of [0, n - 1]) {
      const [x, z] = P[end], y = Ln.Y[end], sx = end === 0 ? 1 : -1;
      for (let dx = -3; dx <= 3; dx++) for (let dz = -2; dz <= 4; dz++) {
        const px = Math.round(x) + dx + sx * 3, pz = Math.round(z) + dz;
        const gy = g.surfaceY(px, pz);
        fill(px, pz, gy + 1, y - 1, K.HULLG);
        put(px, y, pz, (Math.abs(dx) === 3 || dz === -2 || dz === 4) ? K.HAZ : K.PAD);
        fill(px, pz, y + 1, y + 6, 0);
      }
      put(Math.round(x) + sx * 6, y + 1, Math.round(z) - 1, K.LAMP0); put(Math.round(x) + sx * 6, y + 2, Math.round(z) - 1, K.LAMP1);
      put(Math.round(x) + sx * 6, y + 1, Math.round(z) + 3, K.LAMP0); put(Math.round(x) + sx * 6, y + 2, Math.round(z) + 3, K.LAMP1);
      put(Math.round(x) + sx * 3, y + 1, Math.round(z) + 4, K.LBEACON);
    }
    // ---- watchtowers & turret nests on the mesa tops (never on the line)
    const nearLine = (x, z, r) => { for (let i = 0; i < n; i += 4) { const dx = P[i][0] - x, dz = P[i][1] - z; if (dx * dx + dz * dz < r * r) return true; } return false; };
    const sites = [];
    for (let k = 0; k < 400 && sites.length < 7; k++) {
      const x = -230 + rng.int(470), z = 190 + rng.int(300);
      const h = g.surfaceY(x, z);
      if (h < 88 || h > 118) continue;
      const cl = g.climateAt(x, z);
      if (cl.ember < 0.6 || cl.canyon > 0.2) continue;
      if (nearLine(x, z, 9) || sites.some(s => Math.hypot(s[0] - x, s[1] - z) < 60) || Math.hypot(x, z - 140) < 80) continue;
      let flat = true; for (const [dx, dz] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) if (Math.abs(g.surfaceY(x + dx, z + dz) - h) > 3) flat = false;
      if (!flat) continue;
      sites.push([x, z, h]);
    }
    sites.forEach(([x, z, h], idx) => {
      if (idx % 3 === 2) {
        // turret nest: a 5×5 hull pad with two pulse turrets and a light
        for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) { const gy = g.surfaceY(x + dx, z + dz); fill(x + dx, z + dz, gy + 1, h, K.HULLG); put(x + dx, h + 1, z + dz, Math.max(Math.abs(dx), Math.abs(dz)) === 2 ? K.HAZ : K.PAD); fill(x + dx, z + dz, h + 2, h + 6, 0); }
        put(x - 1, h + 2, z - 1, K.TURRET); put(x + 1, h + 2, z + 1, K.TURRET); put(x + 1, h + 2, z - 1, K.CYAN);
        return;
      }
      // watchtower: an octagonal dark-hull shaft, cyan strips, a wider deck with railing, turret, antenna, beacon
      const HT = 20 + rng.int(6);
      for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) {
        const d = Math.max(Math.abs(dx), Math.abs(dz), (Math.abs(dx) + Math.abs(dz)) * 0.7071);
        const gy = g.surfaceY(x + dx, z + dz);
        if (d <= 2.6) {
          fill(x + dx, z + dz, gy + 1, h, K.HULLG);
          for (let t = 1; t <= HT; t++) { const shell = d > 1.6; put(x + dx, h + t, z + dz, shell ? ((t % 5 === 3 && (dx === 0 || dz === 0)) ? K.PANEL : (t % 5 === 0 ? K.HULLG : K.DECK)) : K.DECK); }
        }
        if (d <= 3.6) { put(x + dx, h + HT + 1, z + dz, d > 2.6 ? K.HULLG : K.PAD); put(x + dx, h + HT + 2, z + dz, d > 2.9 ? K.RAILING : 0); fill(x + dx, z + dz, h + HT + 3, h + HT + 8, 0); }
      }
      put(x + 1, h + HT + 2, z + 1, K.TURRET); put(x - 1, h + HT + 2, z - 1, K.PANELA);
      for (let t = 2; t <= 5; t++) put(x, h + HT + t, z, t === 5 ? K.BEACON : K.ANT);
      put(x + 3, h + 1, z + 3, K.LBEACON);
    });
    // ---- giant crystal clusters on the mesa tops (TRAILER.md §3.5: 8–22 tall, magenta, azure, verdant, rose): a column
    // of crystal blocks (their light makes the ground round it glow), two shorter shards and a cluster on top
    {
      const crng = new VR.RNG(g.seed ^ 0xc41e), B = CAN.box, gems = [];
      const COL = ['violet', 'azure', 'verdant', 'rose'];
      for (let k = 0; k < 1400 && gems.length < 14; k++) {
        const x = B.x0 + 8 + crng.int(B.x1 - B.x0 - 16), z = B.z0 + 8 + crng.int(B.z1 - B.z0 - 16);
        const h = g.surfaceY(x, z);
        if (h < 90 || h > 112) continue;
        const cl = g.climateAt(x, z);
        if (cl.ember < 0.6 || cl.canyon > 0.2) continue;
        if (nearLine(x, z, 12) || sites.some(s => Math.hypot(s[0] - x, s[1] - z) < 14) || gems.some(s => Math.hypot(s[0] - x, s[1] - z) < 40)) continue;
        let flat = true; for (const [dx, dz] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) if (Math.abs(g.surfaceY(x + dx, z + dz) - h) > 2) flat = false;
        if (!flat) continue;
        const c = COL[crng.int(COL.length)], H = 9 + crng.int(12);
        for (const [dx, dz, hh] of [[0, 0, H], [1, 0, H - 4], [0, 1, H - 6]]) for (let t = 0; t < hh; t++) put(x + dx, h + 1 + t, z + dz, K.CRYB(c));
        put(x, h + 1 + H, z, K.CRY(c, true)); put(x + 1, h + H - 3, z, K.CRY(c, false)); put(x, h + H - 5, z + 1, K.CRY(c, false));
        gems.push([x, z, h]);
      }
    }
    // ---- the ruin village: seven broken houses of dusk & ochre bricks, magenta windows, a crystal well
    {
      let cx = -125, cz = 330, best = null;
      for (let k = 0; k < 120 && !best; k++) { const x = -180 + rng.int(120), z = 250 + rng.int(150); const h = g.surfaceY(x, z); if (h < 90 || h > 112 || nearLine(x, z, 22) || sites.some(s => Math.hypot(s[0] - x, s[1] - z) < 30)) continue; let ok = true; for (let a = 0; a < 8; a++) if (Math.abs(g.surfaceY(x + Math.round(Math.cos(a * 0.785) * 12), z + Math.round(Math.sin(a * 0.785) * 12)) - h) > 4) ok = false; if (ok) best = [x, z, h]; }
      if (best) { cx = best[0]; cz = best[1]; }
      const houses = [[-9, -7], [-2, -10], [7, -8], [10, 1], [6, 9], [-4, 10], [-11, 3]];
      for (let hi = 0; hi < houses.length; hi++) {
        const [ox, oz] = houses[hi], hx = cx + ox, hz = cz + oz;
        const w = 4 + rng.int(3), d = 4 + rng.int(3), hh = 3 + rng.int(3), base = g.surfaceY(hx, hz);
        for (let x = 0; x < w; x++) for (let z = 0; z < d; z++) {
          const edge = x === 0 || z === 0 || x === w - 1 || z === d - 1, corner = (x === 0 || x === w - 1) && (z === 0 || z === d - 1);
          const gy = g.surfaceY(hx + x, hz + z);
          fill(hx + x, hz + z, gy + 1, base, K.COBBLE);
          put(hx + x, base, hz + z, K.COBBLE);
          if (!edge) { fill(hx + x, hz + z, base + 1, base + hh + 2, 0); continue; }
          const top = hh - (rng.chance(0.35) ? 1 + rng.int(2) : 0) + (corner ? 1 : 0);   // broken walls
          for (let y = 1; y <= top; y++) put(hx + x, base + y, hz + z, corner ? K.OCHRE : ((y === 2 && (x === (w >> 1) || z === (d >> 1)) && rng.chance(0.6)) ? K.MAG : K.DUSK));
          if (z === 0 && x === (w >> 1)) { put(hx + x, base + 1, hz + z, 0); put(hx + x, base + 2, hz + z, 0); }
          fill(hx + x, hz + z, base + top + 1, base + hh + 3, 0);
        }
      }
      const wy = g.surfaceY(cx, cz);
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) put(cx + dx, wy + 1, cz + dz, (dx || dz) ? K.OCHRE : K.CRYVB);
      put(cx, wy + 2, cz, K.CRYVB); put(cx, wy + 3, cz, K.CRYV);
    }
    g._canyonOps = chunks;
    return chunks;
  };

  HEART.builders.push(function (g, cx, cz, out) {
    const x0 = cx * 16, z0 = cz * 16, B = CAN.box;
    if (x0 + 16 <= B.x0 || x0 > B.x1 || z0 + 16 <= B.z0 || z0 > B.z1) return;
    const chunks = CAN.build(g);
    const b = chunks.get(cx + ',' + cz);
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
    // the tram line announces itself from the chunk holding its first point
    const Ln = CAN.line(g), P0 = Ln.pts[0];
    if (Math.round(P0[0]) >= x0 && Math.round(P0[0]) < x0 + 16 && Math.round(P0[1]) >= z0 && Math.round(P0[1]) < z0 + 16) { if (!out.spawns) out.spawns = []; out.spawns.push(['railway', Ln.key, Math.round(P0[0]), Ln.Y[0], Math.round(P0[1])]); }
    // the lava vents of this chunk: the smoke columns of the canyon rise from them (vents.js, on the client)
    for (const v of CAN.ventsIn(g, cx, cz)) { if (!out.spawns) out.spawns = []; out.spawns.push(['vent', v[0], v[1], v[2]]); }
  });
})(VR);

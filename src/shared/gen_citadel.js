// ============================================================================
// Spire Citadels — the trailer's cathedral of fluted spires (TRAILER.md §3.7):
// a main spire up to 140 blocks tall with eight pleated flutes in alternating
// tan and brown stone, cyan window slits at five heights, orange trim rings,
// a white cap with a red beacon; five secondary spires and buttress pinnacles
// clustered around it; a watchtower with a saucer observation ring and a
// spike; a ribbed plinth terrace with a landing pad; crystal groves at the
// foot. The Heartland places one on its mountain south-west of the temple;
// elsewhere one citadel per ~640-block cell sits on the highest mountain.
// The far horizon (lod.js) draws the same spires from kilometres away.
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R, M = VR.M, SEA = VR.C.SEA, GEN = VR.GEN;
  const OG = VR.OverworldGen && VR.OverworldGen.prototype;
  if (!OG || !GEN) return;
  const st = (n, p) => { const t = R.byName[n]; return t ? (p ? t.state(p) : t.defaultState) : 0; };
  const CIT = VR.CitadelGen = {};
  const CELL = CIT.CELL = 640;

  // ---------------------------------------------------------------- cluster layout
  // towers: [{x, z, h, r, kind: 'main' | 'sec' | 'pin' | 'watch'}]; heights are capped so the tips stay under y 250
  CIT.layout = function (x, z, y, rng, big) {
    const towers = [];
    const room = Math.max(40, 248 - y);
    const mainH = Math.min(room, big ? 140 : 100 + rng.int(30)), mainR = big ? 13 : 9 + rng.next() * 3;
    towers.push({ x, z, h: mainH, r: mainR, kind: 'main' });
    const a0 = rng.next() * Math.PI * 2, n = 5;
    for (let k = 0; k < n; k++) {
      const a = a0 + k * Math.PI * 2 / n + (rng.next() - 0.5) * 0.4, r = 5.5 + rng.next() * 3.5, d = mainR + r + 5 + rng.next() * 4;
      const h = Math.round(mainH * (0.45 + rng.next() * 0.28));
      towers.push({ x: x + Math.round(Math.cos(a) * d), z: z + Math.round(Math.sin(a) * d), h, r, kind: 'sec' });
    }
    for (let k = 0; k < 8; k++) {
      const a = a0 + (k + 0.5) * Math.PI / 4 + (rng.next() - 0.5) * 0.3, d = mainR + 2.5 + rng.next() * 2;
      towers.push({ x: x + Math.round(Math.cos(a) * d), z: z + Math.round(Math.sin(a) * d), h: 22 + rng.int(18), r: 2.2 + rng.next() * 0.8, kind: 'pin' });
    }
    const wa = a0 + Math.PI * 0.35 + rng.next() * 0.4, wd = mainR + 30 + rng.int(8);
    towers.push({ x: x + Math.round(Math.cos(wa) * wd), z: z + Math.round(Math.sin(wa) * wd), h: Math.min(room - 16, 56 + rng.int(10)), r: 5, kind: 'watch' });
    return towers;
  };

  // ---------------------------------------------------------------- sites
  CIT.site = function (g, i, j) {
    const key = (i + 1048576) * 2097152 + (j + 1048576);
    if (!g._citSites) g._citSites = new Map();
    if (g._citSites.has(key)) return g._citSites.get(key);
    if (g._citSites.size > 300) g._citSites.clear();
    let site = null;
    const rng = new VR.RNG(M.hash2(i, j, g.seed + 0xC17A));
    if (g.singleBiome < 0 && rng.chance(0.8)) {
      // the highest mountain top of the cell (sampled on a coarse grid, then refined)
      let best = null, bh = 0;
      for (let k = 0; k < 90; k++) {
        const x = i * CELL + 60 + rng.int(CELL - 120), z = j * CELL + 60 + rng.int(CELL - 120);
        const cl = g.climateAt(x, z);
        if (cl.river > 0.2 || cl.canyon > 0.1) continue;
        const h = g.surfaceY(x, z);
        if (h > bh && h > 100 && h <= 130 && (cl.mountain > 0.35 || cl.plateau > 0.3 || h > 118)) { bh = h; best = [x, z, cl]; }
      }
      if (best) {
        let [x, z] = best;
        for (let it = 0; it < 6; it++) { let mx = bh, nx = x, nz = z; for (let a = 0; a < 8; a++) { const px = x + Math.round(Math.cos(a * 0.785) * 12), pz = z + Math.round(Math.sin(a * 0.785) * 12); const h = g.surfaceY(px, pz); if (h > mx && h <= 130) { mx = h; nx = px; nz = pz; } } if (nx === x && nz === z) break; x = nx; z = nz; bh = mx; }
        const hs = []; for (let a = 0; a < 12; a++) hs.push(g.surfaceY(x + Math.round(Math.cos(a * 0.5236) * 9), z + Math.round(Math.sin(a * 0.5236) * 9)));
        hs.sort((p, q) => p - q);
        const y = Math.max(SEA + 20, Math.min(bh - 2, hs[6] + 2));
        if (!(g.villageNear && g.villageNear(x, z, 60))) {
          const towers = CIT.layout(x, z, y, rng, false);
          const pa = rng.next() * Math.PI * 2, pd = 24;
          const pad = { x: x + Math.round(Math.cos(pa) * pd), z: z + Math.round(Math.sin(pa) * pd) };
          site = { id: i + '_' + j, i, j, x, z, y, towers, pad, seed: rng.int(1 << 30), pal: rng.int(2), cry: rng.int(5), R: 32, viaducts: [] };
        }
      }
    }
    g._citSites.set(key, site);
    return site;
  };
  // the Heartland's citadel: fixed on its mountain, the big layout, two viaducts toward the plaza and the canyon
  CIT.heartSite = function (g, C) {
    {
      const rng = new VR.RNG(M.hash2(9, 9, g.seed + 0xC17A));
      const x = C.x, z = C.z, y = C.y;
      const towers = CIT.layout(x, z, y, rng, true);
      const pad = { x: x + 26, z: z - 4 };
      const site = { id: 'heart', i: Math.floor(x / CELL), j: Math.floor(z / CELL), x, z, y, towers, pad, seed: rng.int(1 << 30), pal: 0, cry: 1, R: 34, home: true, viaducts: [] };
      // viaducts: from the plinth rim toward the Gate Plaza's south rim and east into the canyon
      const toward = (tx, tz, len) => { const a = Math.atan2(tz - z, tx - x); return { x0: x + Math.round(Math.cos(a) * (site.R - 2)), z0: z + Math.round(Math.sin(a) * (site.R - 2)), a, len, y0: y + 1 }; };
      site.viaducts.push(toward(0, 150, 300), toward(x + 300, z + 60, 200));
      return site;
    }
  };
  CIT.near = function (g, x0, z0, x1, z1, pad) {
    const out = [], p = pad || 40;
    for (let j = Math.floor((z0 - p) / CELL); j <= Math.floor((z1 + p) / CELL); j++) for (let i = Math.floor((x0 - p) / CELL); i <= Math.floor((x1 + p) / CELL); i++) {
      const s = CIT.site(g, i, j);
      if (s && s.x + s.R + p > x0 && s.x - s.R - p < x1 && s.z + s.R + p > z0 && s.z - s.R - p < z1) out.push(s);
    }
    return out;
  };
  OG.nearestCitadel = function (x, z, maxR) {
    let best = null, bd = (maxR || 3000) ** 2;
    const ci = Math.floor(x / CELL), cj = Math.floor(z / CELL);
    for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) { const s = CIT.site(this, ci + di, cj + dj); if (!s) continue; const d = (s.x - x) ** 2 + (s.z - z) ** 2; if (d < bd) { bd = d; best = s; } }
    return best;
  };

  // ---------------------------------------------------------------- palettes
  let PALS = null;
  function palette(k) {
    if (!PALS) PALS = [
      { body: [st('spire_stone'), st('spire_stone_dark')], rib: st('spire_stone_dark'), trim: st('spire_trim'), win: st('spire_window'), glass: st('viewport'), cap: st('spire_cap'), floor: st('smooth_sandstone') || st('spire_stone'), edge: st('spire_trim') },
      { body: [st('spire_stone_dark'), st('spire_stone')], rib: st('spire_stone'), trim: st('spire_trim'), win: st('spire_window'), glass: st('viewport'), cap: st('spire_cap'), floor: st('polished_andesite') || st('spire_stone'), edge: st('spire_trim') },
    ].map(P => Object.assign(P, { pad: st('landing_pad'), hazard: st('hazard_stripes'), beacon: st('beacon_red'), lamp: st('vx_lamppost_tech', { head: 1 }), lampPost: st('vx_lamppost_tech', { head: 0 }), amber: st('neon_amber'), rail: st('vx_tech_railing'), line: st('vx_floor_plaza_line'), deck: st('spire_stone'), ochre: st('ochre_bricks') || st('spire_stone') }));
    return PALS[k] || PALS[0];
  }
  const oct = (ex, ez) => Math.max(Math.abs(ex), Math.abs(ez), (Math.abs(ex) + Math.abs(ez)) * 0.7071);
  // radius of a spire at height fraction f (0 foot … 1 tip): a slender shaft that steps in at every setback
  // and only needles out over the top quarter
  const STEPS = [0.26, 0.5, 0.7, 0.86];
  const prof = (r0, f) => { let r = r0 * Math.sqrt(Math.max(0, 1 - Math.pow(f, 1.8))); for (const sf of STEPS) if (f >= sf) r -= Math.min(1, r0 * 0.07); return Math.max(0.5, r) + 0.5; };

  // ---------------------------------------------------------------- one spire
  function spire(w, T, y0, P, g) {
    const h = T.h, r0 = T.r, pin = T.kind === 'pin', main = T.kind === 'main';
    const flutes = main ? 12 : 8;
    // foundation: a full pier from the rock up to the terrace
    const gmin = g ? Math.min(g.surfaceY(T.x, T.z), g.surfaceY(T.x + 3, T.z), g.surfaceY(T.x - 3, T.z), g.surfaceY(T.x, T.z + 3), g.surfaceY(T.x, T.z - 3)) : y0 - 5;
    const tmin = Math.max(-48, gmin - y0 - 1);
    const winBands = pin ? [] : [0.1, 0.32, 0.56, 0.75];
    const trims = pin ? [0.5] : STEPS;
    for (let t = tmin; t <= h + 1; t++) {
      const y = y0 + t;
      if (y < 1 || y > 252) continue;
      const f = Math.max(0, t) / h;
      const r = prof(r0, f);
      const foot = t < 8 && !pin ? (8 - Math.max(0, t)) * 0.3 : 0;
      const ribOn = f < 0.9;
      let band = -1; for (let k = 0; k < winBands.length; k++) { const c = Math.round(winBands[k] * h); if (t >= c && t < c + 6) band = k; }
      let trim = false; for (const tf of trims) if (t === Math.round(tf * h)) trim = true;
      const ri = Math.ceil(r + foot + 2);
      for (let dx = -ri; dx <= ri; dx++) for (let dz = -ri; dz <= ri; dz++) {
        const d = oct(dx, dz);
        const px = T.x + dx, pz = T.z + dz;
        if (!w.ok(px, y, pz)) continue;
        const af = (Math.atan2(dz, dx) / (Math.PI * 2) + 1) * flutes, sect = Math.floor(af) % flutes, frac = af - Math.floor(af);
        const onRib = ribOn && (frac < 0.12 || frac > 0.88);
        const rr = r + (onRib ? 1.2 : 0) + foot;
        if (d > rr + 0.01) continue;
        let s;
        if (t > h) s = d <= 0.7 ? P.beacon : null;
        else if (t >= h - 2) s = P.cap;
        else if (t < 0) s = d > r - 0.5 ? P.rib : P.body[0];
        else if (onRib && d > r - 0.6) s = P.rib;
        else if (trim && d > r - 1.01) s = P.trim;
        else if (band >= 0 && d > r - 1.01 && Math.abs(frac - 0.5) < 0.24 && (sect & 1) === 0) s = P.win;
        else if (d > r - 1.01) s = P.body[sect & 1];
        else s = P.body[0];
        if (s !== null) w.set(px, y, pz, s);
      }
    }
  }
  // watchtower: fluted shaft, a saucer observation ring near the top, a spike with a beacon
  function watchTower(w, T, y0, P, g) {
    const h = T.h, r0 = T.r;
    const gmin = g ? Math.min(g.surfaceY(T.x, T.z), g.surfaceY(T.x + 3, T.z), g.surfaceY(T.x - 3, T.z)) : y0 - 5;
    const ringY = h - 14;
    for (let t = Math.max(-48, gmin - y0 - 1); t <= h + 16; t++) {
      const y = y0 + t; if (y < 1 || y > 252) continue;
      let r = t <= h ? r0 - Math.max(0, t) / h * 1.5 : Math.max(0.6, 1.6 * (1 - (t - h) / 16));
      const inRing = t >= ringY && t <= ringY + 3;
      const rr = inRing ? (t === ringY ? 7.5 : t === ringY + 3 ? 8 : 10) : r;
      for (let dx = -11; dx <= 11; dx++) for (let dz = -11; dz <= 11; dz++) {
        const d = oct(dx, dz), px = T.x + dx, pz = T.z + dz;
        if (!w.ok(px, y, pz)) continue;
        const af = (Math.atan2(dz, dx) / (Math.PI * 2) + 1) * 8, sect = Math.floor(af) % 8, frac = af - Math.floor(af);
        const onRib = !inRing && t <= h && (frac < 0.13 || frac > 0.87);
        const lim = rr + (onRib ? 0.9 : 0);
        if (d > lim + 0.01) continue;
        let s;
        if (t > h + 15) s = d <= 0.7 ? P.beacon : null;
        else if (t > h) s = P.cap;
        else if (inRing) { const shellR = d > rr - 1.01; s = t === ringY + 1 ? (shellR ? P.trim : P.body[0]) : t === ringY + 2 ? (shellR ? (((dx + dz) & 1) ? P.win : P.glass) : P.body[0]) : (shellR ? P.cap : P.body[1]); }
        else if (t < 0) s = P.body[0];
        else if (onRib && d > r - 0.6) s = P.rib;
        else if (t % 14 === 13 && d > r - 1.01) s = P.trim;
        else if (d > r - 1.01 && Math.abs(frac - 0.5) < 0.2 && (sect & 1) === 0 && (t % 14) >= 3 && (t % 14) <= 9) s = P.win;
        else s = d > r - 1.01 ? P.body[sect & 1] : P.body[0];
        if (s !== null) w.set(px, y, pz, s);
      }
    }
  }
  // terrace: level the rock inside the radius, pave it, ribbed rim, a landing pad, lamps
  function terrace(g, w, s, P, x0, z0) {
    const RR = s.R;
    for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) {
      const px = x0 + lx, pz = z0 + lz;
      const d = Math.hypot(px - s.x, pz - s.z);
      if (d > RR + 1) continue;
      const gy = g.surfaceY(px, pz);
      const edge = d > RR - 1;
      const deep = s.y - gy;
      if (deep > 12 && d > 8) continue;
      if (gy < s.y) for (let y = gy + 1; y < s.y; y++) w.set(px, y, pz, d > RR - 3 ? ((Math.round(Math.atan2(pz - s.z, px - s.x) * 8) & 1) ? P.rib : P.body[0]) : P.body[0]);
      for (let y = s.y + 1; y <= Math.max(s.y + 12, gy + 3) && y < 250; y++) w.set(px, y, pz, 0);
      const pd = Math.max(Math.abs(px - s.pad.x), Math.abs(pz - s.pad.z));
      if (pd <= 5) w.set(px, s.y, pz, pd === 5 ? P.hazard : P.pad);
      else w.set(px, s.y, pz, edge ? P.edge : (((px + pz) % 9 === 0) ? P.body[1] : P.floor));
      if (edge && ((px * 3 + pz * 5) % 19 === 0)) { w.set(px, s.y + 1, pz, P.lampPost); w.set(px, s.y + 2, pz, P.lamp); }
    }
  }
  // stone-arch viaduct: a 5-wide deck on 3×3 piers every 10 blocks with round arches between, glass railings,
  // an amber lamp on every pier; the deck eases down from the plinth over its length
  function viaduct(g, w, V, P, x0, z0) {
    const cosA = Math.cos(V.a), sinA = Math.sin(V.a), nx = -sinA, nz = cosA;
    // does this chunk touch the viaduct's corridor at all?
    const cx = x0 + 8, cz = z0 + 8, rx = cx - V.x0, rz = cz - V.z0, along = rx * cosA + rz * sinA, side = Math.abs(rx * nx + rz * nz);
    if (along < -14 || along > V.len + 14 || side > 18) return;
    for (let u = 0; u <= V.len; u++) {
      const deckY = Math.round(V.y0 - u * 10 / V.len) - 1;
      const bx = V.x0 + cosA * u, bz = V.z0 + sinA * u;
      const pier = u % 10 === 0, span = u % 10, arch = Math.round(5 - Math.sqrt(Math.max(0, 25 - (span - 5) * (span - 5)))); // spandrel depth
      for (let v = -2; v <= 2; v++) {
        const px = Math.round(bx + nx * v), pz = Math.round(bz + nz * v);
        if (!w.ok(px, deckY, pz)) continue;
        const gy = g.surfaceY(px, pz);
        if (gy >= deckY - 1) continue;                                           // the land carries the line here
        w.set(px, deckY, pz, Math.abs(v) === 2 ? P.body[1] : P.deck);
        for (let y = deckY + 1; y <= deckY + 5; y++) w.set(px, y, pz, 0);
        if (Math.abs(v) === 2) w.set(px, deckY + 1, pz, P.rail);
        else if (v === 0 && (u % 3 === 0)) w.set(px, deckY, pz, P.line);
        if (pier && Math.abs(v) <= 1) { for (let y = gy + 1; y < deckY; y++) w.set(px, y, pz, (y === deckY - 1 && Math.abs(v) === 1) ? P.amber : ((y - gy) % 6 === 0 ? P.body[1] : P.body[0])); }
        else if (Math.abs(v) <= 1) { for (let y = deckY - 1; y >= deckY - arch && y > gy; y--) w.set(px, y, pz, P.body[0]); }
      }
      if (pier) for (const v of [-2, 2]) { const px = Math.round(bx + nx * v), pz = Math.round(bz + nz * v); if (w.ok(px, deckY, pz)) { const gy = g.surfaceY(px, pz); if (gy < deckY - 1) for (let y = Math.max(gy + 1, deckY - 6); y < deckY; y++) w.set(px, y, pz, y === deckY - 1 ? P.amber : P.body[0]); } }
    }
  }

  // ---------------------------------------------------------------- per chunk
  CIT.apply = function (g, cx, cz, out) {
    const x0 = cx * 16, z0 = cz * 16;
    const sites = CIT.near(g, x0, z0, x0 + 16, z0 + 16, 320);
    if (!sites.length) return;
    const w = new GEN.ColumnWriter(cx, cz, out.blocks);
    for (const s of sites) {
      const P = palette(s.pal);
      const nearSite = s.x + s.R + 44 > x0 && s.x - s.R - 44 < x0 + 16 && s.z + s.R + 44 > z0 && s.z - s.R - 44 < z0 + 16;
      if (nearSite) {
        terrace(g, w, s, P, x0, z0);
        for (const T of s.towers) {
          const reach = T.r + 3 + (T.kind === 'watch' ? 8 : 0);
          if (T.x + reach < x0 || T.x - reach > x0 + 16 || T.z + reach < z0 || T.z - reach > z0 + 16) continue;
          if (T.kind === 'watch') watchTower(w, T, s.y + 1, P, g); else spire(w, T, s.y + 1, P, g);
        }
        // crystal groves on the slopes around the terrace
        const crng = new VR.RNG(s.seed ^ 0x51);
        for (let k = 0; k < 16; k++) {
          const a = crng.next() * Math.PI * 2, d = s.R + 4 + crng.next() * 26;
          const px = Math.round(s.x + Math.cos(a) * d), pz = Math.round(s.z + Math.sin(a) * d);
          const big = crng.chance(0.35), cc = ['violet', 'azure', 'verdant', 'rose', 'amber'][(s.cry + k) % 5];
          if (px < x0 - 3 || px > x0 + 19 || pz < z0 - 3 || pz > z0 + 19) continue;
          const gy = g.surfaceY(px, pz);
          if (gy <= SEA + 2) continue;
          const hh = big ? 7 + crng.int(8) : 3 + crng.int(4), blk = st(cc + '_crystal_block'), cl = st(cc + '_crystal_cluster', { facing: 4, size: big ? 1 : 0 });
          for (let t = 0; t < hh; t++) { w.set(px, gy + 1 + t, pz, blk); if (big && t < hh - 3) { w.set(px + 1, gy + 1 + t, pz, blk); w.set(px, gy + 1 + t, pz + 1, blk); if (t < hh - 6) w.set(px + 1, gy + 1 + t, pz + 1, blk); } }
          w.set(px, gy + 1 + hh, pz, cl);
        }
        if (s.x >= x0 && s.x < x0 + 16 && s.z >= z0 && s.z < z0 + 16) { if (!out.spawns) out.spawns = []; out.spawns.push(['citadel', s.id, s.x, s.y + 1, s.z]); }
      }
      for (const V of (s.viaducts || [])) viaduct(g, w, V, P, x0, z0);
    }
  };
  const prevGen = OG.generate;
  OG.generate = function (cx, cz) {
    const out = prevGen.call(this, cx, cz);
    if (this.singleBiome < 0) { try { CIT.apply(this, cx, cz, out); } catch (e) { if (!this._citErr) { this._citErr = 1; console.warn('citadel gen', e); } } }
    return out;
  };
  // the far-horizon description: tapered boxes per tier (body), glowing slits and rings
  CIT.lodBoxes = function (s) {
    const B = [];
    const bodyC = s.pal === 1 ? [0x8A, 0x66, 0x40] : [0xC4, 0xA4, 0x7A];
    for (const T of s.towers) {
      if (T.kind === 'pin') { B.push({ x: T.x, z: T.z, y0: s.y + 1, y1: s.y + 1 + T.h, r: T.r * 0.7 + 0.5, c: bodyC, kd: 0 }); continue; }
      if (T.kind === 'watch') {
        B.push({ x: T.x, z: T.z, y0: s.y + 1, y1: s.y + 1 + T.h, r: T.r, c: bodyC, kd: 0 });
        B.push({ x: T.x, z: T.z, y0: s.y + 1 + T.h - 14, y1: s.y + 1 + T.h - 10, r: 10, c: bodyC, kd: 0 });
        B.push({ x: T.x, z: T.z, y0: s.y + 1 + T.h - 12, y1: s.y + 1 + T.h - 11, r: 10.3, c: [0x3A, 0xF0, 0xFF], kd: 4 });
        B.push({ x: T.x, z: T.z, y0: s.y + 1 + T.h, y1: s.y + 1 + T.h + 16, r: 1, c: [0xD8, 0xDC, 0xE4], kd: 0 });
        continue;
      }
      const n = 6;
      for (let k = 0; k < n; k++) {
        const f0 = k / n, f1 = (k + 1) / n;
        const r = prof(T.r, (f0 + f1) / 2) + 0.4;
        B.push({ x: T.x, z: T.z, y0: s.y + 1 + f0 * T.h, y1: s.y + 1 + f1 * T.h, r, c: bodyC, kd: 0 });
        if (k < 4) B.push({ x: T.x, z: T.z, y0: s.y + 1 + STEPS[k] * T.h, y1: s.y + 1 + STEPS[k] * T.h + 1, r: prof(T.r, STEPS[k]) + 0.6, c: [0xFF, 0x9A, 0x2A], kd: 4 });
        if (k < 4) B.push({ x: T.x, z: T.z, y0: s.y + 1 + [0.1, 0.32, 0.56, 0.75][k] * T.h, y1: s.y + 1 + [0.1, 0.32, 0.56, 0.75][k] * T.h + 6, r: r * 0.5, w: 1.2, c: [0x3A, 0xF0, 0xFF], kd: 4, slits: true });
      }
      B.push({ x: T.x, z: T.z, y0: s.y + 1 + T.h, y1: s.y + 3 + T.h, r: 0.8, c: [0xFF, 0x3A, 0x3A], kd: 4 });
    }
    return B;
  };
})(VR);

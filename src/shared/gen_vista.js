// ============================================================================
// Aussichten (t-vista, vgen 11; docs/superpowers/plans/2026-10-15-t-vista.md). The Heartland was laid out but not
// composed: walking outward, every landmark was behind you; the woods closed the views the land allowed; no place was
// staged for the eye. New worlds (vgen ≥ 11) get, on t-land's ways (the same network as vgen 10):
//   · eye-catchers at the outward ends — windmills at the two farms without one, a belvedere tower at the north
//     crossroads and one over the falls' spring, a round white temple (monopteros) in the east grove — and gates where
//     the ways leave the temple's plaza and enter Nova Haven;
//   · sight windows: walking either way along a way, a landmark is in view at least every 60 blocks — where only the
//     woods close a view the terrain allows, a corridor toward the landmark is kept free of trees (LAND.KEEP.VIEW);
//   · vista points every ~200 blocks: a spur jutting from the way toward a great landmark — paved, a low balustrade
//     along both sides (the leading lines), a bench facing the view, lanterns — framed by a tree pair or an arch at its
//     start, a grove in the middle distance beside the sight axis, the view cone free of trees; the composition (eye,
//     yaw, pitch with the landmark's top in the upper third, the leading lines, the landmark's box) is recorded and
//     listed as a 'vista' spawn of its chunk (the game's wow moments, wowmoment.js);
//   · far forms: the landmarks as boxes for the horizon tiles (lod.js) and the far ring (far.js).
// Everything is a land piece (LAND.PIECES, order 5.5: after t-land's pieces, before the hedges) or a pure function of
// the world: the same plan in every worker. Older worlds keep every chunk (test/vista_v10_same.js).
// ============================================================================
(function (VR) {
  'use strict';
  const LAND = VR.Land, HEART = VR.Heart, R = VR.R, M = VR.M, GEN = VR.GEN, SEA = VR.C.SEA;
  if (!LAND || !HEART || !R) return;
  const VISTA = VR.Vista = {};
  VISTA.VGEN = 11;
  VISTA.on = (g) => !!(g && g.vgen >= VISTA.VGEN && LAND.on(g));
  const st = LAND.st, h01 = LAND.h01, FACE4 = LAND.FACE4;
  const ck = (x, z) => x * 65536 + z;
  const Y = HEART.PLAT;
  const DEG = Math.PI / 180;

  // ---------------------------------------------------------------- rasters, 8-block cells (once per world and worker)
  // the ground (the design's height — within ±2 of the generated surface on the open land — raised over the temple and
  // the city's lots, their bulk blocks a view too) and where trees can stand (the woods' density, none in a zone)
  const RC = 8, RN = 224, R0 = -RC * RN / 2;
  VISTA.rasters = function (g) {
    if (g._vistaR) return g._vistaR;
    const H = new Float32Array(RN * RN), W = new Uint8Array(RN * RN);
    for (let j = 0; j < RN; j++) for (let i = 0; i < RN; i++) {
      const X = R0 + i * RC + RC / 2, Z = R0 + j * RC + RC / 2, k = j * RN + i;
      const D = HEART.design(g, X, Z);
      let h = D ? D.H : 70;
      if (X >= -55 && X <= 55 && Z >= -40 && Z <= 20) h = Math.max(h, Math.abs(X) <= 16 ? Y + 44 : Y + 28);   // the temple's tiers and wings
      else if (X >= -120 && X <= 116 && Z >= -176 && Z <= -12) h = Math.max(h, Y + 8);                          // Nova Haven's lots
      H[k] = h;
      if (!D || h <= SEA + 2 || LAND.zoneAt(g, X, Z)) continue;
      W[k] = Math.round(255 * LAND.woodAt(g, X, Z).d);
    }
    g._vistaR = { H, W };
    return g._vistaR;
  };
  const rIdx = (x, z) => { const i = Math.floor((x - R0) / RC), j = Math.floor((z - R0) / RC); return i < 0 || j < 0 || i >= RN || j >= RN ? -1 : j * RN + i; };
  VISTA.groundAt = (Rr, x, z) => { const k = rIdx(x, z); return k < 0 ? 70 : Rr.H[k]; };
  VISTA.woodsAt = (Rr, x, z) => { const k = rIdx(x, z); return k < 0 ? 0 : Rr.W[k] / 255; };

  // ---------------------------------------------------------------- the landmarks
  // {id, name, x, z, top, base, r, great (a vista may face it), members (the isles)}. The tops are vgen 11's (the
  // dome's lantern spire, the citadel's spires, the lighthouse); the land's pieces from the plan.
  VISTA.landmarks = function (g, P) {
    if (P && P._vistaLm) return P._vistaLm;
    const out = [], pc = (k) => P ? P.pieces.filter(p => p.kind === k) : [];
    out.push({ id: 'temple', x: 0, z: -15, top: Y + 87, base: Y, r: 52, great: true });
    out.push({ id: 'dome', x: 69, z: -5, top: Y + 31, base: Y, r: 13, great: false });
    const CIT = VR.CitadelGen, C = HEART.CITADEL;
    let ctop = 249;
    if (CIT && CIT.heartSite) { try { const s = CIT.heartSite(g, C), m = s.towers.find(t => t.kind === 'main'); if (m) ctop = s.y + 2 + m.h; } catch (e) { /* the fixed site's numbers */ } }
    out.push({ id: 'citadel', x: C.x, z: C.z, top: ctop, base: C.y, r: 30, great: true });
    if (VR.IslesGen) {
      const L = VR.IslesGen.list(g), mem = L.map(I => ({ x: I.x, z: I.z, top: Math.round(I.y + I.dome + 1), r: I.r }));
      out.push({ id: 'isles', x: HEART.ISLES.x, z: HEART.ISLES.z, top: Math.max(...mem.map(q => q.top)), base: Math.min(...L.map(I => I.y)) - 20, r: 110, great: true, members: mem });
    }
    for (const p of pc('lighthouse')) out.push({ id: 'lighthouse', x: p.x, z: p.z, top: p.top + 1, base: p.y, r: 4, great: true });
    for (const p of pc('waterfall')) out.push({ id: 'falls', x: p.x, z: p.z, top: p.top + 2, base: SEA, r: 5, great: true });
    out.push({ id: 'nova', x: 0, z: -140, top: Y + 20, base: Y, r: 95, great: true });
    const STA = VR.StationGen;
    if (STA && STA.site) { try { const s = STA.site(g); out.push({ id: 'station', x: s.x, z: s.z, top: s.y + 66, base: s.y - 20, r: 30, great: true }); } catch (e) { /* none */ } }
    for (const p of pc('lookout')) out.push({ id: 'lookout', x: p.x, z: p.z, top: p.top + 2, base: p.y, r: 4, great: true });
    { const mem = []; for (let x = -200; x <= 200; x += 100) { const D = HEART.design(g, x, -322); mem.push({ x, z: -322, top: Math.round((D ? D.H : 110) + 9), r: 40 }); }
      out.push({ id: 'hills', x: 0, z: -322, top: Math.max(...mem.map(q => q.top)), base: 90, r: 150, great: true, members: mem }); }
    for (const p of pc('windmill')) out.push({ id: 'mill_' + p.farm, x: p.x, z: p.z, top: p.y + 6, base: p.y - 10, r: 4, great: false });
    for (const p of pc('belvedere')) out.push({ id: p.name, x: p.x, z: p.z, top: p.top + 2, base: p.y, r: 4, great: false });
    for (const p of pc('monopteros')) out.push({ id: 'monopteros', x: p.x, z: p.z, top: p.top + 1, base: p.y, r: 6, great: false });
    for (const p of pc('obelisk')) out.push({ id: p.name, x: p.x, z: p.z, top: p.top, base: p.y, r: 2, great: false });
    if (P) P._vistaLm = out;
    return out;
  };
  // how far a landmark reads: by its height (a 16-high windmill to ~350, the temple and the citadel to 1100)
  const rangeOf = (L) => Math.min(1100, 16 * (L.top - L.base) + 100);

  // ---------------------------------------------------------------- does the eye see a landmark
  // e: the eye [x, y, z]; dir: the way's direction (dx, dz) and the cone's half angle, or null (any direction); trees:
  // the woods block the line where a 13-high tree could reach into it (the keep raster's VIEW cells are open). Returns
  // the member seen {x, z, top, r, d} or null.
  const SEEN = { x: 0, z: 0, top: 0, r: 0, d: 0 };
  VISTA.sees = function (g, Rr, P, ex, ey, ez, dx, dz, cone, L, trees) {
    const mem = L.members || null, n = mem ? mem.length : 1, rng = rangeOf(L);
    for (let m = 0; m < n; m++) {
      const q = mem ? mem[m] : L, vx = q.x - ex, vz = q.z - ez, d = Math.hypot(vx, vz);
      if (d > rng || d < 12) continue;
      if (dx !== null) {
        let a = Math.atan2(vz, vx) - Math.atan2(dz, dx);
        a = Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) - Math.atan2(q.r * 0.6, d);
        if (a > cone) continue;
      }
      const el = (q.top - ey) / d;
      if (el < -0.08) continue;
      let ok = true;
      for (let s = 6; s < d - q.r * 0.5 && ok; s += 4) {
        const x = ex + vx * s / d, z = ez + vz * s / d, line = ey + el * s, gr = VISTA.groundAt(Rr, x, z);
        if (gr + (s < 24 ? -1 : 1) > line) { ok = false; break; }   // (near the eye the raster's cell is coarser than the way cut into it)
        if (trees && s <= 220 && gr + 13 > line && VISTA.woodsAt(Rr, x, z) > 0.08 && !(LAND.keepAt(P, x, z) & 32)) ok = false;
      }
      if (ok) { SEEN.x = q.x; SEEN.z = q.z; SEEN.top = q.top; SEEN.r = q.r; SEEN.d = d; return SEEN; }
    }
    return null;
  };
  const CONE = 45 * DEG, STEP = 4, EYE = 1.62;
  // the way's direction at sample i walking dir (+1 a → b, −1 b → a)
  const tangent = (Ln, i, dir) => { const n = Ln.pts.length, a = Ln.pts[Math.max(0, Math.min(n - 1, i - 3 * dir))], b = Ln.pts[Math.max(0, Math.min(n - 1, i + 3 * dir))]; return [b[0] - a[0], b[1] - a[1]]; };
  // every way, both directions: the runs without a landmark in view ({line, dir, from, to, len}); trees counted or not
  VISTA.coverage = function (g, P, trees) {
    const Rr = VISTA.rasters(g), LM = VISTA.landmarks(g, P), runs = [];
    let samples = 0, seen = 0, worst = 0;
    P.lines.forEach((Ln, li) => {
      const n = Ln.pts.length;
      for (const dir of [1, -1]) {
        let run = 0, from = -1;
        for (let k = 0; k < n; k += STEP) {
          const i = dir > 0 ? k : n - 1 - k, [tx, tz] = tangent(Ln, i, dir);
          if (!tx && !tz) continue;
          const [px, pz] = Ln.pts[i], ey = Ln.y[i] + EYE;
          let hit = false;
          for (const L of LM) if (VISTA.sees(g, Rr, P, px, ey, pz, tx, tz, CONE, L, trees)) { hit = true; break; }
          samples++;
          if (hit) { seen++; if (run > 60) runs.push({ line: li, dir, from, to: i, len: run }); worst = Math.max(worst, run); run = 0; from = -1; }
          else { if (from < 0) from = i; run += STEP; }
        }
        if (run > 60) runs.push({ line: li, dir, from, to: dir > 0 ? n - 1 : 0, len: run });
        worst = Math.max(worst, run);
      }
    });
    return { samples, seen, share: seen / Math.max(1, samples), worst, runs };
  };

  // ---------------------------------------------------------------- building helpers
  const groundOf = (g, P) => (x, z) => { const k = ck(x, z); let y = P.gy.get(k); if (y === undefined) { y = g.surfaceY(x, z); P.gy.set(k, y); } return y; };
  const keepSet = (P, x, z, bit) => { const k = LAND._keepIdx(x, z); if (k >= 0) P.keep[k] |= bit; };
  // a spot near (sx, sz) for a w × w footprint: r0…r1 out, the ground within ±1 over it, no way, piece, field, pond
  // within pad; the score (higher = better) picks among the free ones
  function spotNear(g, P, gy, sx, sz, w, r0, r1, pad, score) {
    let best = null;
    for (let r = r0; r <= r1; r += 2) for (let a = 0; a < 6.283; a += 0.26) {
      const x = Math.round(sx + Math.cos(a) * r), z = Math.round(sz + Math.sin(a) * r), h = w >> 1;
      let ok = true, lo = 999, hi = -999;
      for (let dz = -h - pad; dz <= h + pad && ok; dz++) for (let dx = -h - pad; dx <= h + pad; dx++) {
        const qx = x + dx, qz = z + dz;
        if (P.cells.has(ck(qx, qz)) || (LAND.keepAt(P, qx, qz) & (2 | 4 | 16)) || LAND.zoneAt(g, qx, qz)) { ok = false; break; }
        if (Math.abs(dx) <= h && Math.abs(dz) <= h) { const y = gy(qx, qz); lo = Math.min(lo, y); hi = Math.max(hi, y); }
      }
      if (!ok || hi - lo > 2 || lo <= SEA + 1) continue;
      const s = (score ? score(x, z, hi) : 0) - r * 0.01;
      if (!best || s > best.s) best = { x, z, y: hi, s };
    }
    return best;
  }
  // how many samples of the ways see a point of this height from within reach, ahead (the eye-catchers' place)
  function aheadScore(g, P, x, z, top, reach) {
    const Rr = VISTA.rasters(g), L = { x, z, top, base: top - 20, r: 3 };
    let n = 0;
    for (const Ln of P.lines) {
      const m = Ln.pts.length;
      for (let i = 0; i < m; i += 8) {
        const [px, pz] = Ln.pts[i]; if (Math.abs(px - x) > reach || Math.abs(pz - z) > reach) continue;
        for (const dir of [1, -1]) { const [tx, tz] = tangent(Ln, i, dir); if ((tx || tz) && VISTA.sees(g, Rr, P, px, Ln.y[i] + EYE, pz, tx, tz, 30 * DEG, L, false)) n++; }
      }
    }
    return n;
  }

  // ---- a belvedere: a square stone tower, an open loggia on four corner piers at its top, a slate pyramid, a lantern
  // finial; its door toward `face`
  function belvedere(g, P, K, x, z, F, H, face, name) {
    const put = K.put, gy = groundOf(g, P), SB = st('stone_bricks'), MB = st('mossy_stone_bricks'), CH = st('chiseled_stone_bricks'), WALL = st('stone_brick_wall'), PL = st('polished_andesite');
    const dv = [[0, -1], [1, 0], [0, 1], [-1, 0]][face & 3], loggia = F + H - 4;
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      const qx = x + dx, qz = z + dz, y0 = gy(qx, qz), edge = Math.abs(dx) === 2 || Math.abs(dz) === 2, corner = Math.abs(dx) === 2 && Math.abs(dz) === 2;
      for (let y = Math.min(y0, F - 1) - 1; y < F; y++) put(qx, y, qz, SB);
      put(qx, F, qz, edge ? CH : PL);
      for (let y = F + 1; y <= F + H; y++) {
        let s = 0;
        if (y < loggia) s = edge ? (h01(qx * 3 + y, qz, 21) < 0.16 ? MB : SB) : 0;
        else if (y === loggia || y === F + H) s = edge ? CH : (y === F + H ? SB : 0);
        else s = corner ? SB : 0;                                       // the loggia: open between the corner piers
        put(qx, y, qz, s);
      }
      if (edge && !corner) put(qx, loggia + 1, qz, WALL);              // its parapet
    }
    // a door, slit windows, a ladder up the inside to the loggia
    put(x + dv[0] * 2, F + 1, z + dv[1] * 2, 0); put(x + dv[0] * 2, F + 2, z + dv[1] * 2, 0);
    for (let y = F + 5; y < loggia - 1; y += 4) for (const [ax, az] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) if (!(ax === dv[0] * 2 && az === dv[1] * 2)) put(x + ax, y, z + az, 0);
    const back = (face + 2) & 3, lv = [[0, -1], [1, 0], [0, 1], [-1, 0]][back];
    for (let y = F + 1; y < loggia; y++) put(x + lv[0], y, z + lv[1], st('ladder', { facing: face & 3 }));
    put(x + lv[0], loggia, z + lv[1], 0);
    // the slate pyramid over the loggia and a lantern finial
    const T = F + H;
    for (let k = 0; k <= 2; k++) for (let dz = -(3 - k); dz <= 3 - k; dz++) for (let dx = -(3 - k); dx <= 3 - k; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== 3 - k) continue;
      const f = Math.abs(dx) >= Math.abs(dz) ? (dx < 0 ? 3 : 1) : (dz < 0 ? 0 : 2);
      put(x + dx, T + 1 + k, z + dz, st('vx_roof_slate', { facing: f }));
    }
    put(x, T + 1, z, SB); put(x, T + 2, z, SB); put(x, T + 3, z, st('vx_ridge_slate', { facing: 1 }));
    put(x, T + 4, z, CH); put(x, T + 5, z, st('lantern', { hanging: 0 }));
    for (const [ax, az] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(x + ax, loggia + 1, z + az, st('lantern', { hanging: 0 }));
    LAND._markDisc(P, x, z, 5, LAND.KEEP.PIECE);
    LAND.addSpawn(P, ['beacon', x, T + 5, z], x, z);
    P.pieces.push({ kind: 'belvedere', name, x, z, y: F, top: T + 5, h: H });
  }
  // ---- a monopteros: a round temple of eight white columns on a stepped plinth, an entablature, a dome, a gilded finial
  function monopteros(g, P, K, x, z, F) {
    const put = K.put, gy = groundOf(g, P), QB = st('quartz_bricks') || st('smooth_quartz'), QP = st('quartz_pillar', { axis: 0 }) || QB, QS = st('smooth_quartz') || QB, QK = st('quartz_block') || QB, GOLD = st('gold_block') || st('vx_lantern');
    const RR = 5.2;
    for (let dz = -7; dz <= 7; dz++) for (let dx = -7; dx <= 7; dx++) {
      const d = Math.hypot(dx, dz), qx = x + dx, qz = z + dz; if (d > 6.6) continue;
      const y0 = gy(qx, qz), top = d <= 4.6 ? F : d <= 5.6 ? F - 1 : F - 2;   // three steps up
      for (let y = Math.min(y0, top - 1); y <= top; y++) put(qx, y, qz, y === top ? (d <= 4.6 ? QS : QB) : QB);
      for (let y = top + 1; y <= F + 13; y++) put(qx, y, qz, 0);
    }
    // eight columns on the octagon, the entablature ring over them
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4 + Math.PI / 8, cx = Math.round(x + Math.cos(a) * 4), cz = Math.round(z + Math.sin(a) * 4);
      for (let y = F + 1; y <= F + 6; y++) put(cx, y, cz, QP);
    }
    for (let dz = -5; dz <= 5; dz++) for (let dx = -5; dx <= 5; dx++) { const d = Math.hypot(dx, dz); if (d >= 3.3 && d <= RR) { put(x + dx, F + 7, z + dz, QK); if (d >= 4.4) put(x + dx, F + 8, z + dz, st('smooth_quartz_slab', { type: 'bottom' }) || QS); } }
    // the dome in courses, a gold band, the finial
    for (let k = 0; k < 4; k++) { const rr = 4.4 - k * 1.15; for (let dz = -5; dz <= 5; dz++) for (let dx = -5; dx <= 5; dx++) { const d = Math.hypot(dx, dz); if (d <= rr && d > rr - 1.3) put(x + dx, F + 8 + k, z + dz, k === 0 ? GOLD : QS); } }
    put(x, F + 12, z, QS); put(x, F + 13, z, GOLD); put(x, F + 14, z, st('lantern', { hanging: 0 }));
    put(x, F + 6, z, st('lantern', { hanging: 1 }));
    LAND._markDisc(P, x, z, 8, LAND.KEEP.PIECE); LAND._markDisc(P, x, z, 13, LAND.KEEP.CLEAR);
    P.pieces.push({ kind: 'monopteros', x, z, y: F, top: F + 14 });
  }
  // ---- an obelisk: a white needle on a stepped plinth, a gilded tip with a lantern — the filler eye-catcher on a rise
  // ahead of a way that would otherwise look into empty country
  function obelisk(g, P, K, x, z, F, H) {
    const put = K.put, gy = groundOf(g, P), SB = st('stone_bricks'), CH = st('chiseled_stone_bricks'), Q = st('smooth_quartz') || st('quartz_bricks'), QP = st('quartz_pillar', { axis: 0 }) || Q, GOLD = st('gold_block') || CH;
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      const qx = x + dx, qz = z + dz, y0 = gy(qx, qz), ring = Math.max(Math.abs(dx), Math.abs(dz));
      for (let y = Math.min(y0, F - 1) - 1; y < F; y++) put(qx, y, qz, SB);
      put(qx, F, qz, ring === 2 ? SB : CH);
      if (ring <= 1) put(qx, F + 1, qz, ring === 1 ? SB : CH);
      for (let y = F + (ring <= 1 ? 2 : 1); y <= F + H + 3; y++) put(qx, y, qz, 0);
    }
    const shaft = Math.round(H * 0.55);
    for (let y = F + 2; y < F + 2 + shaft; y++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (Math.abs(dx) + Math.abs(dz) < 2 || y < F + 2 + shaft - 2) put(x + dx, y, z + dz, Q);
    for (let y = F + 2 + shaft; y < F + H; y++) put(x, y, z, QP);
    put(x, F + H, z, GOLD); put(x, F + H + 1, z, st('lantern', { hanging: 0 }));
    LAND._markDisc(P, x, z, 4, LAND.KEEP.PIECE); LAND._markDisc(P, x, z, 7, LAND.KEEP.CLEAR);
    P.pieces.push({ kind: 'obelisk', name: 'obelisk_' + P.pieces.filter(p => p.kind === 'obelisk').length, x, z, y: F, top: F + H + 1 });
  }
  // ---- a gate across a way: two piers either side, an arch over it, lanterns; the temple's in its slate stone with an
  // orange light bar, the city's white with a cyan line
  function gate(g, P, K, Ln, i, style) {
    const put = K.put, gy = groundOf(g, P), [px, pz] = Ln.pts[i], y = Math.round(Ln.y[i]);
    const [tx, tz] = tangent(Ln, i, 1), l = Math.hypot(tx, tz) || 1, nx = -tz / l, nz = tx / l;
    const S = style === 'temple' ? { pier: st('temple_stone'), cap: st('temple_stone_band'), bar: st('temple_light_bar'), top: st('temple_stone_smooth') } : { pier: st('quartz_pillar', { axis: 0 }) || st('quartz_bricks'), cap: st('quartz_bricks'), bar: st('neon_cyan'), top: st('smooth_quartz') || st('quartz_bricks') };
    const H = 6, half = 3;
    const cells = [];
    for (let o = -half; o <= half; o++) { const x = Math.round(px + nx * o), z = Math.round(pz + nz * o); if (!cells.some(c => c[0] === x && c[1] === z)) cells.push([x, z, o]); }
    // (a pier never on the way: where two ways meet it steps outward until it is off it, the lintel reaching it)
    for (const c of cells.slice()) if (Math.abs(c[2]) === half && P.cells.has(ck(c[0], c[1]))) {
      for (let k = 1; k <= 3; k++) {
        const o2 = c[2] + Math.sign(c[2]) * k, x2 = Math.round(px + nx * o2), z2 = Math.round(pz + nz * o2);
        cells.push([c[0], c[1], c[2], true]); c[0] = x2; c[1] = z2;   // (the cell it left: the lintel's)
        if (!P.cells.has(ck(x2, z2))) break;
      }
    }
    for (const [x, z, o, lintel] of cells) {
      if (Math.abs(o) === half && !lintel) {   // a pier from the ground
        if (P.cells.has(ck(x, z))) continue;
        const g0 = gy(x, z);
        for (let yy = Math.min(g0, y) - 1; yy <= y + H; yy++) put(x, yy, z, yy === y + H ? S.cap : S.pier);
        put(x, y + H + 1, z, st('lantern', { hanging: 0 }));
      } else {
        const arch = Math.round(Math.sqrt(Math.max(0, half * half - o * o)) * 0.7);   // the arch's soffit rises to the middle
        put(x, y + H, z, Math.abs(o) <= 1 ? S.bar : S.top);
        for (let yy = y + H - 1; yy >= y + H - 1 - Math.max(0, 1 - arch); yy--) if (yy > y + 4) put(x, yy, z, S.top);
      }
    }
    P.pieces.push({ kind: 'gate', style, x: Math.round(px), z: Math.round(pz), y, line: P.lines.indexOf(Ln), i });
  }

  // ---------------------------------------------------------------- the piece
  VISTA.SPUR = 7;                 // the spur's walk (blocks) from the way's edge to its widening
  LAND.PIECES.push(Object.assign(function vista(g, P, K) {
    if (!VISTA.on(g)) return;
    const gy = groundOf(g, P), t0 = Date.now();
    P.vistas = []; P.windows = [];
    // ---- 1. the eye-catchers at the outward ends
    // windmills at the farms that have none (t-land built two: farm_c and farm_n), where the lanes in see them best
    for (const site of P.sites.filter(s => s.kind === 'farm')) {
      if (P.pieces.some(p => p.kind === 'windmill' && p.farm === site.id)) continue;
      const rng = new VR.RNG(M.hash2(site.x, site.z, g.seed ^ 0x3171) >>> 0);
      let best = null;
      for (let k = 0; k < 10; k++) {
        const Wm = LAND.findLot(g, P, gy, rng, site.x, site.z, 5, 5, 14, 36, 2, [], 4); if (!Wm) continue;
        const cx = Math.round((Wm.rect[0] + Wm.rect[2]) / 2), cz = Math.round((Wm.rect[1] + Wm.rect[3]) / 2), s = aheadScore(g, P, cx, cz, Wm.hi + 16, 420);
        if (!best || s > best.s) best = { Wm, s };
      }
      if (best) { LAND._markKeep(P, best.Wm.rect[0] - 3, best.Wm.rect[1] - 3, best.Wm.rect[2] + 3, best.Wm.rect[3] + 3, LAND.KEEP.PIECE); LAND.windmill(g, P, K, best.Wm, gy, rng, site); }
    }
    // a belvedere at the north crossroads, where the three ways that meet there see it best
    const site = (id) => P.sites.find(s => s.id === id);
    const cn = site('cross_n');
    if (cn) { const sp = spotNear(g, P, gy, cn.x, cn.z, 5, 7, 16, 2, (x, z, y) => aheadScore(g, P, x, z, y + 31, 560)); if (sp) belvedere(g, P, K, sp.x, sp.z, sp.y + 1, 26, FACE4(cn.x - sp.x, cn.z - sp.z), 'belvedere_n'); }
    // a smaller one over the falls' spring, on the cliff top the way climbs to
    const fs = site('falls');
    if (fs) { const sp = spotNear(g, P, gy, fs.x, fs.z, 5, 5, 12, 1, (x, z, y) => aheadScore(g, P, x, z, y + 16, 420) + y * 0.05); if (sp) belvedere(g, P, K, sp.x, sp.z, sp.y + 1, 13, FACE4(fs.x - sp.x, fs.z - sp.z), 'belvedere_falls'); }
    // the round temple in the east grove, beyond the way's end
    const es = site('east');
    if (es) { const sp = spotNear(g, P, gy, es.x, es.z, 13, 8, 20, 1, (x, z, y) => aheadScore(g, P, x, z, y + 14, 520)); if (sp) monopteros(g, P, K, sp.x, sp.z, sp.y + 1); }
    P._vistaLm = null;   // (the landmarks again, with the eye-catchers)
    // ---- 2. gates where the ways leave the temple's plaza and enter Nova Haven (12 blocks out along the way)
    for (const id of ['temple_w', 'temple_e', 'city_w', 'city_e']) {
      const si = P.sites.findIndex(s => s.id === id); if (si < 0) continue;
      for (const Ln of P.lines) {
        const n = Ln.pts.length; if (n < 30) continue;
        const at = Ln.a === si ? 12 : Ln.b === si ? n - 13 : -1; if (at < 0) continue;
        if (Ln.deck[at] || LAND.zoneAt(g, Math.round(Ln.pts[at][0]), Math.round(Ln.pts[at][1]))) continue;
        gate(g, P, K, Ln, at, id.startsWith('temple') ? 'temple' : 'city');
      }
    }
    // ---- 3. the vista points (VISTA.choose) and their spurs, frames and groves; 4. the sight windows
    VISTA.choose(g, P);
    for (const V of P.vistas) { VISTA.buildSpur(g, P, K, V); VISTA.dressFrame(g, P, V); }
    VISTA.openWindows(g, P);
    // ---- 5. where a way still looks into empty country for more than 60 blocks: an obelisk on the best rise ahead
    VISTA.fill(g, P, K);
    for (const V of P.vistas) VISTA.dressGrove(g, P, V);
    P.vistaMs = Date.now() - t0;
  }, { order: 5.5 }));

  // ---------------------------------------------------------------- the vista points
  // Candidates every 6 blocks of every way (not on a bridge, not by the temple or the city): a great landmark in view
  // from the spur's start — its top above the horizon line behind it and the line to it over the land — at a size the
  // eye reads (2–30° up), room for the spur toward it; the score likes a rise, a big landmark, a near-straight-on view.
  // Then greedily the best, none within 150 of another, a landmark not twice within 400.
  VISTA.SPACING = 150;
  const WEIGHT = { temple: 1.4, citadel: 1.35, isles: 1.4, lighthouse: 1.15, falls: 1.0, nova: 1.0, station: 1.05, lookout: 0.9, hills: 0.95 };
  VISTA.horizonOk = function (g, Rr, ex, ey, ez, q) {
    // the terrain behind the landmark along the same bearing: its elevation stays under the top's (a silhouette on sky)
    const vx = q.x - ex, vz = q.z - ez, d = Math.hypot(vx, vz), elTop = (q.top - ey) / d;
    for (let s = d + 40; s <= d + 1600; s += 40) {
      const x = ex + vx * s / d, z = ez + vz * s / d;
      let h = VISTA.groundAt(Rr, x, z);
      if (rIdx(x, z) < 0) { const c = g.computeClimate ? g.computeClimate(x, z) : null; h = c ? c.H : 70; }
      if ((h - ey) / s >= elTop) return false;
    }
    return true;
  };
  VISTA.choose = function (g, P) {
    const Rr = VISTA.rasters(g), LM = VISTA.landmarks(g, P).filter(L => L.great), gy = groundOf(g, P), cand = [];
    const nearSite = (x, z) => P.sites.some(s => (s.kind === 'temple' || s.kind === 'city') && Math.hypot(s.x - x, s.z - z) < 34);
    const targets = [];
    for (const L of LM) for (const q of (L.members || [L])) targets.push({ L, q: { x: q.x, z: q.z, top: q.top, r: q.r, base: L.base } });
    const one = { id: '', members: null, x: 0, z: 0, top: 0, base: 0, r: 0 };
    P.lines.forEach((Ln, li) => {
      const n = Ln.pts.length; if (n < 30) return;
      const [tx0, tz0] = tangent(Ln, n >> 1, 1);
      for (let i = 8; i < n - 8; i += 6) {
        if (Ln.deck[i] || Ln.deck[Math.max(0, i - 4)] || Ln.deck[Math.min(n - 1, i + 4)]) continue;
        const [px, pz] = Ln.pts[i], y = Math.round(Ln.y[i]);
        if (nearSite(px, pz) || LAND.zoneAt(g, Math.round(px), Math.round(pz))) continue;
        // the rise: the way here over the land round it (a ring of 8 at 24 blocks)
        let ring = 0; for (let k = 0; k < 8; k++) ring += VISTA.groundAt(Rr, px + Math.cos(k * 0.785) * 24, pz + Math.sin(k * 0.785) * 24);
        const rise = y - ring / 8, ey = y + EYE + 1.2;
        const [tx, tz] = tangent(Ln, i, 1), tl = Math.hypot(tx, tz) || 1;
        // the cheap tests first (range, size, the line over the land), then the costly ones for the best few
        const ok = [];
        for (const T of targets) {
          const { L, q } = T, vx = q.x - px, vz = q.z - pz, d = Math.hypot(vx, vz); if (d < 70 || d > rangeOf(L)) continue;
          const elTop = Math.atan2(q.top - ey, d), elBase = Math.atan2((L.base || Y) - ey, d), size = elTop - Math.max(elBase, -6 * DEG);
          if (elTop < 2 * DEG || elTop > 30 * DEG || size < 2.5 * DEG) continue;
          one.x = q.x; one.z = q.z; one.top = q.top; one.r = q.r; one.base = L.base; one.id = L.id;
          if (!VISTA.sees(g, Rr, P, px, ey, pz, null, null, 0, one, false)) continue;
          const ux = vx / d, uz = vz / d, side = Math.abs(ux * tz / tl - uz * tx / tl);   // 1 = straight off the way's side
          const sc = (WEIGHT[L.id] || 1) * Math.min(1.6, size / (6 * DEG)) * (1 + 0.12 * Math.max(-2, Math.min(6, rise))) * (0.75 + 0.25 * side) * (1 + h01(px, pz, 0x715) * 0.05);
          ok.push({ T, d, ux, uz, elTop, sc });
        }
        ok.sort((a, b) => b.sc - a.sc);
        let best = null;
        for (const o of ok.slice(0, 3)) {
          const { T, d, ux, uz } = o, { L, q } = T;
          if (!VISTA.horizonOk(g, Rr, px, ey, pz, q)) continue;
          // the spur's room: its cells free (the way's own cells only at its start), dry, the ground near the way's level
          let room = true, drop = 0;
          for (let t = 2; t <= VISTA.SPUR + 2 && room; t++) for (let oo = -3; oo <= 3; oo++) {
            const x = Math.round(px + ux * t - uz * oo), z = Math.round(pz + uz * t + ux * oo), k2 = ck(x, z);
            if ((P.cells.has(k2) && t > 3) || (LAND.keepAt(P, x, z) & (2 | 4 | 16)) || LAND.zoneAt(g, x, z)) { room = false; break; }
            const g0 = gy(x, z); if (g0 <= SEA + 1 || g0 > y + 1 || g0 < y - 6) { room = false; break; }
            drop = Math.max(drop, y - g0);
          }
          if (!room) continue;
          best = { li, i, x: px, z: pz, y, lm: L.id, q, u: [ux, uz], d, sc: o.sc * (1 + 0.04 * Math.min(5, drop)), rise, drop, elTop: o.elTop };
          break;
        }
        if (best) cand.push(best);
      }
      void tx0; void tz0;
    });
    cand.sort((a, b) => b.sc - a.sc);
    P._vistaCand = cand;   // (the tests read every candidate)
    const sel = [];
    const far = (c, sp) => sel.every(s => Math.hypot(s.x - c.x, s.z - c.z) >= sp);
    const varied = (c, r) => !sel.some(s => s.lm === c.lm && Math.hypot(s.x - c.x, s.z - c.z) < r);
    // greedily the best, a landmark not yet faced counting more, one faced often less (variety along the walks)
    const left = cand.slice();
    for (;;) {
      let bi = -1, bs = -1;
      for (let k = 0; k < left.length; k++) {
        const c = left[k]; if (!far(c, 100) || !varied(c, 180)) continue;
        let n = 0; for (const s2 of sel) if (s2.lm === c.lm) n++;
        const sc = c.sc * (n === 0 ? 1.3 : Math.pow(0.88, n));
        if (sc > bs) { bs = sc; bi = k; }
      }
      if (bi < 0) break;
      sel.push(left.splice(bi, 1)[0]);
    }
    // then per way: no stretch longer than 220 blocks without one (the best candidate in the gap, 60 from its ends)
    P.lines.forEach((Ln, li) => {
      const mine = cand.filter(c => c.li === li);
      for (let guard = 0; guard < 6 && mine.length; guard++) {
        const at = sel.filter(s => s.li === li).map(s => s.i).concat([0, Ln.pts.length - 1]).sort((a, b) => a - b);
        let g0 = 0, g1 = 0; for (let k = 1; k < at.length; k++) if (at[k] - at[k - 1] > g1 - g0) { g0 = at[k - 1]; g1 = at[k]; }
        if (g1 - g0 <= 200) break;
        const c = mine.find(c => c.i > g0 + 60 && c.i < g1 - 60 && !sel.includes(c) && far(c, 90));
        if (!c) break;
        sel.push(c);
      }
    });
    // the record: the spur, the composition (the eye 3 behind the spur's start and 1.2 over the eye's height, the
    // landmark's top a quarter of the frame's height under its top edge), the leading lines (the walls)
    sel.forEach((c, k) => {
      const [ux, uz] = c.u, ex = c.x - ux * 3, ez = c.z - uz * 3, ey = c.y + EYE + 1.2, fov = 62;
      const vx = c.q.x - ex, vz = c.q.z - ez, d = Math.hypot(vx, vz), elTop = Math.atan2(c.q.top - ey, d);
      const pitch = elTop - Math.atan(0.45 * Math.tan(fov * DEG / 2));
      const yaw = Math.atan2(-vx, -vz);
      const lead = [-2, 2].map(o => [[c.x + ux * 2 - uz * o, c.y + 1.5, c.z + uz * 2 + ux * o], [c.x + ux * (VISTA.SPUR + 1) - uz * o, c.y + 1.5, c.z + uz * (VISTA.SPUR + 1) + ux * o]]);
      const r = c.q.r, box = [c.q.x - r, c.q.base, c.q.z - r, c.q.x + r, c.q.top, c.q.z + r];
      P.vistas.push({ id: 'v' + k, line: c.li, i: c.i, x: Math.round(c.x), z: Math.round(c.z), y: c.y, u: c.u, lm: c.lm, aim: [c.q.x, c.q.top, c.q.z], d: Math.round(c.d), rise: +c.rise.toFixed(1), drop: c.drop, eye: [+ex.toFixed(2), +ey.toFixed(2), +ez.toFixed(2)], yaw: +yaw.toFixed(4), pitch: +pitch.toFixed(4), fov, lead, box, frame: elTop < 9 * DEG && c.q.r < 40 ? 'arch' : 'trees', score: +c.sc.toFixed(3) });
    });
    return P.vistas;
  };

  // ---- the spur: paved, low walls along it (the leading lines), its widening with the bench and lanterns, the terrace
  // under it where the land falls away
  VISTA.buildSpur = function (g, P, K, V) {
    const put = K.put, gy = groundOf(g, P), [ux, uz] = V.u, y = V.y, L = VISTA.SPUR;
    const white = P.sites.some(s => (s.kind === 'temple' || s.kind === 'city') && Math.hypot(s.x - V.x, s.z - V.z) < 90);
    const PAVE = white ? (st('vx_floor_plaza') || st('flagstone')) : st('flagstone'), BASE = st('stone_bricks'), MB = st('mossy_stone_bricks');
    const WALL = white ? st('vx_balustrade') : st('stone_brick_wall'), LANT = st('lantern', { hanging: 0 }), POST = st('stone_brick_wall');
    const sx = V.x + 0.5, sz = V.z + 0.5;
    const r = L + 4;
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const x = V.x + dx, z = V.z + dz, cx = x + 0.5 - sx, cz = z + 0.5 - sz;
      const t = cx * ux + cz * uz, o = -cx * uz + cz * ux, ao = Math.abs(o);
      const W = t > L - 1.5 ? 3 : 2;
      const floor = t >= 0.5 && t <= L + 1 && ao <= W - 0.5;
      const wall = (t >= 1 && t <= L + 1.5 && ao > W - 0.5 && ao <= W + 0.5) || (t > L + 1 && t <= L + 2 && ao <= W + 0.5);
      if (!floor && !wall) continue;
      if (P.cells.has(ck(x, z))) continue;                                    // (the way itself)
      const g0 = gy(x, z);
      for (let yy = g0 + 1; yy < y; yy++) put(x, yy, z, h01(x * 7 + yy, z, 31) < 0.15 ? MB : BASE);   // the terrace's wall
      put(x, y, z, floor ? PAVE : BASE);
      for (let yy = y + 1; yy <= Math.max(y + 4, g0 + 2); yy++) put(x, yy, z, 0);
      if (wall) put(x, y + 1, z, WALL);
      keepSet(P, x, z, LAND.KEEP.PIECE);
    }
    // the bench at the widening, facing the landmark; a lantern on each end corner, a post with a lantern at the start
    const at = (t, o) => [Math.round(sx + ux * t - uz * o - 0.5), Math.round(sz + uz * t + ux * o - 0.5)];
    { const [bx, bz] = at(L - 0.5, 0); put(bx, y + 1, bz, st('vx_bench', { facing: FACE4(ux, uz) })); }
    for (const o of [-3, 3]) { const [lx, lz] = at(L + 1.6, o); put(lx, y + 1, lz, POST); put(lx, y + 2, lz, LANT); }
    // the gate into the spur: a low pier either side of its mouth, a cap and a lantern on each — the picture's frame in
    // its lower corners — and never on the way (vista.mjs's first run: four-high piers at ±2 hid a third of the view, and
    // on 19 of 21 spurs they stood on the way's cells): the first place from the mouth outward that is off the way
    const PIERB = white ? (st('quartz_pillar', { axis: 0 }) || BASE) : BASE, CAP = white ? (st('chiseled_quartz_block') || BASE) : st('chiseled_stone_bricks');
    for (const o of [-3, 3]) {
      let pc = null;
      for (const t of [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5]) { const c = at(t, o); if (!P.cells.has(ck(c[0], c[1]))) { pc = c; break; } }   // (past 3 the spur's room is off the way: choose())
      if (!pc) continue;
      const [lx, lz] = pc, g0 = gy(lx, lz);
      for (let yy = g0 + 1; yy <= y; yy++) put(lx, yy, lz, BASE);   // (its footing where the land falls away)
      put(lx, y + 1, lz, PIERB); put(lx, y + 2, lz, PIERB); put(lx, y + 3, lz, CAP); put(lx, y + 4, lz, LANT);
      keepSet(P, lx, lz, LAND.KEEP.PIECE);
    }
    // the arch (V.frame 'arch': the landmark low enough to stand in its opening): two piers on the walls 2.5 out, a lintel
    // with a keystone over the walk — the picture's frame in the foreground
    if (V.frame === 'arch') {
      const PIER = white ? (st('quartz_pillar', { axis: 0 }) || BASE) : BASE, LIN = white ? (st('smooth_quartz') || BASE) : st('stone_bricks'), KEY = white ? (st('chiseled_quartz_block') || LIN) : st('chiseled_stone_bricks');
      const done = new Set(), offWay = (ta) => [-2, 2].every(o => { const c = at(ta, o); return !P.cells.has(ck(c[0], c[1])); });
      const ta = [2.5, 3.5, 4.5].find(offWay);   // (its piers never on the way)
      if (ta !== undefined) {
        for (let o = -2; o <= 2; o += 0.5) {
          const [ax, az] = at(ta, o), k = ax * 65536 + az; if (done.has(k)) continue; done.add(k);
          if (Math.abs(o) >= 2) { for (let yy = y + 1; yy <= y + 4; yy++) put(ax, yy, az, PIER); put(ax, y + 5, az, LIN); put(ax, y + 6, az, st('lantern', { hanging: 0 })); }
          else put(ax, y + 5, az, Math.abs(o) < 0.5 ? KEY : LIN);
        }
        { const [kx, kz] = at(ta, 0); put(kx, y + 6, kz, KEY); }
        V.arch = true;
      }
    }
    // the spawn the game's wow moment reads: the trigger (the spur's start), the composition
    LAND.addSpawn(P, ['vista', V.id, V.x, y + 1, V.z, V.eye[0], V.eye[1], V.eye[2], V.yaw, V.pitch, V.fov, V.lm], V.x, V.z);
    P.pieces.push({ kind: 'vista', id: V.id, x: V.x, z: V.z, y, lm: V.lm });
  };

  // ---- the sight windows. Walking either way along every way: where a run without a landmark in view (the trees
  // counted) reaches 40 blocks, the best sample of the run whose view the land allows opens a window — a corridor toward
  // the landmark, ±4 blocks, as far as a 13-high tree could still reach into the line — and the run starts again there.
  // The vista points' view cones (the landmark's width and 4° more, 160 blocks) are opened first.
  VISTA.openWindows = function (g, P, waysOnly) {
    const Rr = VISTA.rasters(g), LM = VISTA.landmarks(g, P);
    const corridor = (ex, ey, ez, q, half, maxLen) => {
      const vx = q.x - ex, vz = q.z - ez, d = Math.hypot(vx, vz), el = (q.top - ey) / d, ux = vx / d, uz = vz / d;
      let len = 0;
      for (let s = 3; s <= Math.min(maxLen, d - q.r); s += 2) if (VISTA.groundAt(Rr, ex + ux * s, ez + uz * s) + 13 > ey + el * s) len = s;
      // (a crown reaches out from its trunk: a cherry's arching boughs up to 9 blocks, a dark oak's or a fancy oak's 5 —
      // their trunks are kept that much further from the line)
      let cut = 0;
      for (let s = 3; s <= len; s += 2) for (let o = -half - 10; o <= half + 10; o += 2) {
        const x = ex + ux * s - uz * o, z = ez + uz * s + ux * o, k = LAND._keepIdx(x, z);
        if (k < 0 || (P.keep[k] & 32)) continue;
        if (Math.abs(o) > half) { const q = LAND.woodAt(g, x, z); if (q.d < 0.05 || Math.abs(o) > half + (q.kind === 4 ? 10 : q.kind === 2 || q.kind === 0 ? 4 : 2)) continue; }
        if (VISTA.woodsAt(Rr, x, z) > 0.05) cut++;
        P.keep[k] |= 32;
      }
      return { len, cut };
    };
    // the vista points' cones
    if (!waysOnly) for (const V of P.vistas) {
      const q = { x: V.aim[0], z: V.aim[2], top: V.aim[1], r: 4 }, [ex, ey, ez] = V.eye;
      const d = Math.hypot(q.x - ex, q.z - ez), half = Math.min(14, Math.round(Math.tan(Math.atan2((V.box[3] - V.box[0]) / 2, d) + 4 * DEG) * 30));
      const w = corridor(ex, ey, ez, q, Math.max(6, half) + 3, 160);
      P.windows.push({ vista: V.id, x: Math.round(ex), z: Math.round(ez), lm: V.lm, len: w.len, cut: w.cut });
    }
    // the ways
    P.lines.forEach((Ln, li) => {
      const n = Ln.pts.length;
      for (const dir of [1, -1]) {
        let run = 0, cands = [];
        for (let k = 0; k < n; k += STEP) {
          const i = dir > 0 ? k : n - 1 - k, [tx, tz] = tangent(Ln, i, dir);
          if (!tx && !tz) continue;
          const [px, pz] = Ln.pts[i], ey = Ln.y[i] + EYE;
          let hit = false;
          for (const L of LM) if (VISTA.sees(g, Rr, P, px, ey, pz, tx, tz, CONE, L, true)) { hit = true; break; }
          if (hit) { run = 0; cands = []; continue; }
          run += STEP;
          // what the land would show here without the woods: the great ones first, the nearest window
          for (const L of LM) {
            const s = VISTA.sees(g, Rr, P, px, ey, pz, tx, tz, CONE, L, false);
            if (s) { cands.push({ i, px, pz, ey, q: { x: s.x, z: s.z, top: s.top, r: s.r }, w: L.great ? 1 : 0.7, d: s.d, lm: L.id }); break; }
          }
          if (run >= 40 && cands.length) {
            const c = cands.reduce((a, b) => (b.w / (1 + b.d / 900) > a.w / (1 + a.d / 900) ? b : a));
            const w = corridor(c.px, c.ey, c.pz, c.q, 6, 220);
            P.windows.push({ line: li, dir, i: c.i, x: Math.round(c.px), z: Math.round(c.pz), lm: c.lm, len: w.len, cut: w.cut });
            run = Math.abs(i - c.i); cands = [];
          }
        }
      }
    });
  };

  VISTA.fill = function (g, P, K) {
    const Rr = VISTA.rasters(g), gy = groundOf(g, P);
    for (let round = 0; round < 3; round++) {
      const runs = VISTA.coverage(g, P, true).runs;
      if (!runs.length) break;
      let placed = 0;
      for (const r of runs) {
        const Ln = P.lines[r.line], n = Ln.pts.length, mid = Math.max(0, Math.min(n - 1, Math.round(r.from + r.dir * r.len / 2)));
        const [tx, tz] = tangent(Ln, mid, r.dir), tl = Math.hypot(tx, tz) || 1, hx = tx / tl, hz = tz / tl;
        // the run's samples (every 4): an obelisk is worth as many as see it
        const samp = []; for (let k = 0; k <= r.len; k += 4) { const i = Math.max(0, Math.min(n - 1, r.from + r.dir * k)); const t = tangent(Ln, i, r.dir); samp.push([Ln.pts[i][0], Ln.y[i] + EYE, Ln.pts[i][1], t[0], t[1]]); }
        let best = null;
        for (let dist = 50; dist <= 170; dist += 10) for (let a = -25; a <= 25; a += 5) {
          const ca = Math.cos(a * DEG), sa = Math.sin(a * DEG), x = Math.round(Ln.pts[mid][0] + (hx * ca - hz * sa) * dist), z = Math.round(Ln.pts[mid][1] + (hz * ca + hx * sa) * dist);
          let ok = true, hi = -999, lo = 999;
          for (let dz = -3; dz <= 3 && ok; dz++) for (let dx = -3; dx <= 3; dx++) {
            const qx = x + dx, qz = z + dz;
            if (P.cells.has(ck(qx, qz)) || (LAND.keepAt(P, qx, qz) & (1 | 2 | 4 | 16)) || LAND.zoneAt(g, qx, qz)) { ok = false; break; }
            if (Math.abs(dx) <= 2 && Math.abs(dz) <= 2) { const y = gy(qx, qz); hi = Math.max(hi, y); lo = Math.min(lo, y); }
          }
          if (!ok || hi - lo > 2 || lo <= SEA + 2) continue;
          const L = { x, z, top: hi + 15, base: hi, r: 2 };
          let seen = 0; for (const q of samp) if (VISTA.sees(g, Rr, P, q[0], q[1], q[2], q[3], q[4], CONE, L, false)) seen++;
          const sc = seen + hi * 0.01;
          if (seen && (!best || sc > best.sc)) best = { x, z, y: hi, sc };
        }
        if (!best) continue;
        if (P.pieces.some(p => p.kind === 'obelisk' && Math.hypot(p.x - best.x, p.z - best.z) < 60)) continue;
        obelisk(g, P, K, best.x, best.z, best.y + 1, 13);
        placed++;
      }
      if (!placed) break;
      P._vistaLm = null;
      VISTA.openWindows(g, P, true);
    }
  };
  // ---- a vista's frame and its middle ground: a tree pair at the spur's start (the picture's sides; planted before the
  // windows, they are the frame the view is cut in), an arch over the spur where the landmark is low enough to stand in
  // its opening (buildSpur), a grove 50–200 blocks out beside the sight axis (after the windows: none in a corridor)
  const planTree = (g, P, x, z, kind, view) => {
    x = Math.round(x); z = Math.round(z);
    if (LAND.zoneAt(g, x, z) || P.cells.has(ck(x, z)) || (LAND.keepAt(P, x, z) & (1 | 2 | 4 | 16 | (view ? 32 : 0)))) return false;
    const y0 = groundOf(g, P)(x, z); if (y0 <= SEA + 2) return false;
    if (P.trees.some(t => Math.abs(t.x - x) < 4 && Math.abs(t.z - z) < 4)) return false;
    P.trees.push({ x, z, y: y0 + 1, kind });
    return true;
  };
  VISTA.dressFrame = function (g, P, V) {
    const [ux, uz] = V.u;
    P.trees = P.trees || [];
    // a cherry's arching crown or a broad oak's either side, far enough out that the crowns close the picture's sides and
    // leave the landmark free (from the eye ~50° off the axis, the crowns reaching in to ~25°)
    V.framed = 0;
    const fk = h01(V.x, V.z, 0x7a1) < 0.5 ? 4 : 0;
    for (const sd of [-1, 1]) for (const [ft, fo] of (fk === 4 ? [[5, 11], [6, 12], [4, 10], [7, 12], [3, 10], [6, 10]] : [[4, 9], [5, 10], [3, 9], [6, 9], [5, 8], [7, 10]])) { const o = sd * fo; if (planTree(g, P, V.x + ux * ft - uz * o, V.z + uz * ft + ux * o, fk, false)) { V.framed++; break; } }
  };
  VISTA.dressGrove = function (g, P, V) {
    const [ux, uz] = V.u, kindHere = (x, z) => { const q = LAND.woodAt(g, x, z); return q.kind === 3 ? 0 : q.kind; };
    P.trees = P.trees || [];
    V.grove = 0; V.groveAt = null;
    const s0 = h01(V.z, V.x, 0x7a2) < 0.5 ? -1 : 1;
    for (const sd of [s0, -s0]) for (const ang of [22, 28, 34, 18]) for (const dist of [90, 60, 130, 170]) {
      if (V.groveAt) break;
      const a = sd * ang * DEG, ca = Math.cos(a), sa = Math.sin(a), gx = V.eye[0] + (ux * ca - uz * sa) * dist, gz = V.eye[2] + (uz * ca + ux * sa) * dist;
      const cx = Math.round(gx), cz = Math.round(gz);
      if (LAND.zoneAt(g, cx, cz) || (LAND.keepAt(P, cx, cz) & (1 | 2 | 4 | 16 | 32)) || g.surfaceY(cx, cz) <= SEA + 2) continue;
      if (LAND.woodAt(g, cx, cz).d >= 0.3) { V.grove = -1; V.groveAt = [cx, cz]; break; }   // (the woods there are the middle ground already)
      let n = 0;
      for (let k = 0; k < 9; k++) { const b = k * 2.4, rr = k === 0 ? 0 : 4 + 6 * h01(k, V.x, 0x7a5); if (planTree(g, P, gx + Math.cos(b) * rr, gz + Math.sin(b) * rr, kindHere(cx, cz), true)) n++; }
      if (n >= 3) { V.grove = n; V.groveAt = [cx, cz]; }
    }
  };

  // ---------------------------------------------------------------- the lighthouse on the far coast (t-land's hook)
  // The lake's east shore — across the water from the beach, the pier and the temple's ways, under the isles — 46 high.
  LAND.lighthouseAt = function (g) { return VISTA.on(g) ? { a0: -0.95, a1: 0.45, H: 46 } : null; };

  // ---------------------------------------------------------------- far forms
  // The landmarks as boxes {x0, y0, z0, x1, y1, z1, c: [r, g, b], k (0 lit, 4 glowing)} in world coordinates, for the
  // tiles that hold their anchor (each drawn once a level): the temple (the horizon only — the far ring has its
  // skyline), the land's towers and the isles' falls.
  VISTA.lodBoxes = function (g, x0, z0, x1, z1, ring) {
    if (!VISTA.on(g) || x1 < -820 || x0 > 820 || z1 < -820 || z0 > 820) return null;
    const out = [], P = LAND.plan(g), inT = (x, z) => x >= x0 && x < x1 && z >= z0 && z < z1;
    if (ring !== 1 && inT(0, -10)) VISTA.templeBoxes(out);
    for (const p of P.pieces) {
      if (!inT(p.x, p.z)) continue;
      if (p.kind === 'lighthouse') { box(out, p.x, p.z, 3.2, p.y, p.top - 5, WHITE); for (let y = p.y + 3; y < p.top - 5; y += 8) box(out, p.x, p.z, 3.3, y, y + 4, RED); box(out, p.x, p.z, 4, p.top - 5, p.top - 4, GREY); box(out, p.x, p.z, 1.7, p.top - 4, p.top - 2, LAMP, 4); box(out, p.x, p.z, 1.2, p.top - 2, p.top, RED); }
      else if (p.kind === 'lookout') { box(out, p.x, p.z, 2.5, p.y, p.top, STONE); box(out, p.x, p.z, 3.5, p.top, p.top + 1, WOOD); box(out, p.x, p.z, 0.6, p.top + 1, p.top + 2, LAMP, 4); }
      else if (p.kind === 'belvedere') { box(out, p.x, p.z, 2.5, p.y, p.top - 5, STONE); box(out, p.x, p.z, 3, p.top - 5, p.top - 3, SLATE); box(out, p.x, p.z, 1.5, p.top - 3, p.top - 1, SLATE); box(out, p.x, p.z, 0.6, p.top - 1, p.top, LAMP, 4); }
      else if (p.kind === 'monopteros') { box(out, p.x, p.z, 6, p.y - 2, p.y, WHITE); box(out, p.x, p.z, 4.3, p.y, p.y + 7, WHITE); box(out, p.x, p.z, 5, p.y + 7, p.y + 9, WHITE); box(out, p.x, p.z, 3, p.y + 9, p.y + 12, WHITE); box(out, p.x, p.z, 0.8, p.y + 12, p.top, GOLD, 4); }
      else if (p.kind === 'obelisk') { box(out, p.x, p.z, 2.5, p.y - 1, p.y + 1, STONE); box(out, p.x, p.z, 1.5, p.y + 1, p.y + 9, WHITE); box(out, p.x, p.z, 0.5, p.y + 9, p.top - 1, WHITE); box(out, p.x, p.z, 0.6, p.top - 1, p.top, GOLD, 4); }
      else if (p.kind === 'windmill') { box(out, p.x, p.z, 2.4, p.y - 8, p.y + 3, WHITE); box(out, p.x, p.z, 1.6, p.y + 3, p.y + 5, ROOF); }
      else if (p.kind === 'waterfall' && p.curtain && p.curtain.length) { const xs = p.curtain.map(c => c[0]), zs = p.curtain.map(c => c[1]); out.push({ x0: Math.min(...xs), x1: Math.max(...xs) + 1, z0: Math.min(...zs), z1: Math.max(...zs) + 1, y0: SEA, y1: p.top + 1, c: FOAM, k: 0 }); }
    }
    for (const f of VISTA.isleFalls(g)) if (inT(f.x, f.z)) out.push({ x0: f.x, x1: f.x + 2, z0: f.z, z1: f.z + 2, y0: f.foot, y1: f.top + 1, c: f.lava ? LAVA : FOAM, k: f.lava ? 4 : 0 });
    return out;
  };
  const WHITE = [232, 236, 240], RED = [200, 60, 50], GREY = [150, 150, 156], LAMP = [255, 214, 140], STONE = [138, 136, 132], WOOD = [110, 84, 56], SLATE = [70, 76, 90], GOLD = [230, 190, 80], ROOF = [160, 70, 52], FOAM = [214, 236, 255], LAVA = [255, 122, 26];
  const box = (out, x, z, r, y0, y1, c, k) => out.push({ x0: x - r + 0.5, x1: x + r + 0.5, z0: z - r + 0.5, z1: z + r + 0.5, y0, y1, c, k: k || 0 });
  // the temple from afar (TRAILER.md §4; gen_temple.js's measures): the three tiers with their light bars, the wings,
  // the fluted towers with their bands, the pad towers' saucers, the domed hall and its lantern spire
  const SL = [108, 122, 140], SLD = [80, 92, 108], BAR = [255, 122, 26], CY = [58, 240, 255], AMB = [255, 176, 42];
  VISTA.templeBoxes = function (out) {
    const B = (x0, x1, y0, y1, z0, z1, c, k) => out.push({ x0, x1: x1 + 1, y0, y1: y1 + 1, z0, z1: z1 + 1, c, k: k || 0 });
    B(-22, 22, Y + 1, Y + 19, -40, 20, SL); B(-22, 22, Y + 20, Y + 20, -40, 20, BAR, 4);
    B(-16, 16, Y + 21, Y + 33, -30, 14, SL); B(-16, 16, Y + 34, Y + 34, -30, 14, BAR, 4);
    B(-10, 10, Y + 35, Y + 43, -22, 8, SL); B(-10, 10, Y + 44, Y + 44, -22, 8, BAR, 4);
    B(-3, 3, Y + 45, Y + 50, -13, -7, SLD); B(0, 0, Y + 51, Y + 55, -10, -10, [255, 58, 58], 4);
    for (const sx of [-1, 1]) {
      B(sx > 0 ? 22 : -55, sx > 0 ? 55 : -22, Y + 1, Y + 27, -28, 15, SL); B(sx > 0 ? 22 : -55, sx > 0 ? 55 : -22, Y + 28, Y + 28, -28, 15, BAR, 4);
      for (const [tx, tz, r, h] of [[50, -24, 4, 74], [24, -37, 3.5, 60]]) {
        const x = sx * tx; out.push({ x0: x - r, x1: x + r + 1, y0: Y + 1, y1: Y + 1 + h, z0: tz - r, z1: tz + r + 1, c: SL, k: 0 });
        for (let t = 11; t < h; t += 12) out.push({ x0: x - r - 0.2, x1: x + r + 1.2, y0: Y + 1 + t, y1: Y + 3 + t, z0: tz - r - 0.2, z1: tz + r + 1.2, c: AMB, k: 4 });
        out.push({ x0: x - 0.6, x1: x + 1.6, y0: Y + 5, y1: Y + h - 4, z0: tz - r - 0.3, z1: tz + r + 1.3, c: CY, k: 4 });
        out.push({ x0: x - r * 0.6, x1: x + r * 0.6 + 1, y0: Y + 1 + h, y1: Y + 1 + h + 8, z0: tz - r * 0.6, z1: tz + r * 0.6 + 1, c: SLD, k: 0 });
        out.push({ x0: x, x1: x + 1, y0: Y + h + 9, y1: Y + h + 13, z0: tz, z1: tz + 1, c: [255, 58, 58], k: 4 });
      }
      const px = sx * 40; out.push({ x0: px - 2, x1: px + 3, y0: Y + 1, y1: Y + 47, z0: 6, z1: 11, c: SL, k: 0 }); out.push({ x0: px - 7, x1: px + 8, y0: Y + 47, y1: Y + 50, z0: 1, z1: 16, c: SLD, k: 0 }); out.push({ x0: px - 7.2, x1: px + 8.2, y0: Y + 48, y1: Y + 49, z0: 0.8, z1: 16.2, c: CY, k: 4 });
    }
    // the domed hall: the drum, the dome in two steps, the lantern (amber glass) and its spire
    out.push({ x0: 57, x1: 82, y0: Y + 1, y1: Y + 8, z0: -17, z1: 8, c: SL, k: 0 }, { x0: 59, x1: 80, y0: Y + 8, y1: Y + 14, z0: -15, z1: 6, c: SL, k: 0 }, { x0: 62, x1: 77, y0: Y + 14, y1: Y + 19, z0: -12, z1: 3, c: SL, k: 0 });
    out.push({ x0: 66, x1: 73, y0: Y + 19, y1: Y + 24, z0: -8, z1: -1, c: AMB, k: 4 }, { x0: 66, x1: 73, y0: Y + 24, y1: Y + 25, z0: -8, z1: -1, c: BAR, k: 4 }, { x0: 67, x1: 72, y0: Y + 25, y1: Y + 27, z0: -7, z1: -2, c: SLD, k: 0 }, { x0: 69, x1: 70, y0: Y + 27, y1: Y + 31, z0: -5, z1: -4, c: [255, 58, 58], k: 4 });
    return out;
  };
  // the designed isles' falls, as gen_realm.js lays them (the same walk out from the centre, the same curtain's foot):
  // {x, z, top, foot, lava}
  VISTA.isleFalls = function (g) {
    if (g._vistaFalls) return g._vistaFalls;
    const out = []; let bridges = null;
    if (VR.IslesGen && g.islandAt) for (const I of VR.IslesGen.list(g)) for (let f = 0; f < (I.falls || 0); f++) {
      const a = ((I.seed * 0.618 + f * 0.37) % 1) * Math.PI * 2;
      let fx = 0, fz = 0, ft = null;
      for (let r = 0; r < I.r * 1.4; r += 1) { const px = Math.round(I.x + Math.cos(a) * r), pz = Math.round(I.z + Math.sin(a) * r), J = g.islandAt(px, pz); if (J && J.isle === I) { fx = px; fz = pz; ft = J; } else if (ft) break; }
      if (!ft) continue;
      const o1 = [Math.round(Math.cos(a)), Math.round(Math.sin(a))], fs = ((I.seed | 0) * 31 + f * 17) >>> 0, base = 18 + fs % 12;
      const x = fx + o1[0] - (o1[0] > 0 ? 1 : 0), z = fz + o1[1] - (o1[1] > 0 ? 1 : 0);
      // (a curtain over another island's top ends on it: not a fall into the void)
      // (nor one that meets a bridge or the viaduct between the isles under its lip)
      if (!bridges) { bridges = new Set(); const ch = VR.IslesGen.build(g); for (const b of ch.values()) { for (let i = 0; i < b.o.length; i += 4) if (b.o[i + 3]) bridges.add(b.o[i] * 65536 + b.o[i + 2]); } }
      // (and where every cell of the 2 × 2 is the isle's own ground, the water only fills the rim pool: no curtain)
      let over = false, free = 0; for (const [ox, oz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const J = g.islandAt(x + ox, z + oz); if ((J && J.isle !== I && J.top < ft.top) || bridges.has((x + ox) * 65536 + z + oz)) over = true; if (!J || J.isle !== I || J.top < ft.top - 1) free++; }
      if (over || !free) continue;
      out.push({ x, z, top: ft.top, foot: ft.top - base - 6, lava: !!I.lava, isle: I.name });
    }
    return (g._vistaFalls = out);
  };
})(VR);

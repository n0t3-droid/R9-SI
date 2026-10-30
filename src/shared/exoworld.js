// ============================================================================
// u-stars2 · VR.Exo — the worlds of other stars worth landing on (docs/superpowers/plans/2026-10-30-u-stars2.md;
// roadmap §7.3 u-exo). Pure, main thread and workers. Everything here comes from hashes of the system and the planet,
// never from galaxy.js's own random stream: every system, planet and dim a save knows stays what it was.
//   Exo.ring(def, pl)            → null | { lat, tilt }       a ring round the world (giants 45 %, landable worlds 22 %)
//   Exo.sky(def, pl, t, out)     → the landed sky's suns: the day clock from the world's own spin (locked worlds: a sun
//                                   that stands), the companion of a pair where it really stands, its light share
//   Exo.signature(def, pl)       → 'crystal' (a hot star's crystal fields) · 'violet' (a red dwarf's violet growth) ·
//                                   'glass' (a hot desert's glass dunes) · null
//   Exo.interesting(N, from, visited, range) → the nearest unvisited system in range worth the jump, and why
//   XGEN (2): Bodies.stamp / bgenOf carry `exo` — a save that ever stood on an x.* world keeps 1 (its worlds as they
//   were), every other gets 2: the kind's generator decorated with the signature landscape (decorate)
// ============================================================================
(function (VR) {
  'use strict';
  const Exo = VR.Exo = { XGEN: 2 };
  const AU = 1.495978707e11, MU_SUN = 1.32712440018e20, D2R = Math.PI / 180;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  // a hash in [0, 1) (integers in, our own mix)
  const h01 = (a, b, c, d) => {
    let h = Math.imul((a | 0) ^ 0x2c1b3c6d, 0x297a2d39) ^ Math.imul((b | 0) + 0x632be5ab, 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 15) ^ Math.imul((c | 0) ^ 0x1b873593, 0xcc9e2d51), 0x27d4eb2f) ^ Math.imul((d | 0) + 0x165667b1, 0x9e3779b1);
    h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  Exo.h01 = h01;
  const pIndex = (def, pl) => +String(pl.id).slice(String(def.id).length + 1).split('m')[0] || 0;
  const sysKey = (def) => (def.idx | 0) * 7 + Math.round((def.p ? def.p[0] : 0) * 1000);

  // ---------------------------------------------------------------- rings
  Exo.ring = function (def, pl) {
    if (!def || !pl || !pl.planet) return null;
    const k = pIndex(def, pl), u = h01(sysKey(def), k, 0x7a19, 1);
    const giant = pl.kind === 'giant' || pl.kind === 'icegiant';
    if (u >= (giant ? 0.45 : pl.landable ? 0.22 : 0)) return null;
    return { lat: (20 + 30 * h01(sysKey(def), k, 0x7a19, 2)) * D2R, tilt: h01(sysKey(def), k, 0x7a19, 3) * 25 * D2R };
  };

  // ---------------------------------------------------------------- the signature landscapes
  Exo.signature = function (def, pl) {
    if (!def || !pl || !pl.landable) return null;
    const T = def.star.T, b = pl.base;
    if (T >= 7500) return 'crystal';
    if (T < 3900 && (b === 'aqua' || b === 'ocker')) return 'violet';
    if ((b === 'ocker' || b === 'zinn') && (pl.Teq | 0) > 380) return 'glass';
    return null;
  };

  // ---------------------------------------------------------------- the landed sky
  // the stars' angles round the system's barycentre (the system's plane x, z; the periods real ÷ 8 like starjump.js)
  function starAngles(def, pl, t) {
    const bs = def.bodies, s0 = bs[0], s1 = bs.find(b => b.kind === 'star' && b.parent);
    const close = !!(def.star2 && def.star2.close);
    const M1 = s0.mu, M2 = s1 ? s1.mu : 0;
    let p0 = [0, 0], p1 = null;
    if (s1) {
      const a = s1.orbit.a, n = 8 * Math.sqrt((M1 + M2) / (a * a * a)), th = s1.orbit.M0 * D2R + n * t;
      p0 = [-a * M2 / (M1 + M2) * Math.cos(th), -a * M2 / (M1 + M2) * Math.sin(th)];
      p1 = [a * M1 / (M1 + M2) * Math.cos(th), a * M1 / (M1 + M2) * Math.sin(th)];
    }
    const muC = close ? M1 + M2 : M1, cen = close ? [0, 0] : p0;
    const a = pl.orbit.a, n = 8 * Math.sqrt(muC / (a * a * a)), th = pl.orbit.M0 * D2R + n * t;
    const pp = [cen[0] + a * Math.cos(th), cen[1] + a * Math.sin(th)];
    const d0 = Math.hypot(p0[0] - pp[0], p0[1] - pp[1]);
    const out = { th0: Math.atan2(p0[1] - pp[1], p0[0] - pp[0]), d0, th1: 0, d1: 0, s1 };
    if (p1) { out.th1 = Math.atan2(p1[1] - pp[1], p1[0] - pp[0]); out.d1 = Math.hypot(p1[0] - pp[0], p1[1] - pp[1]); }
    return out;
  }
  // the local frame at latitude φ (x east, y up, z south): a star at hour angle H and declination δ (the season: the
  // world's tilt — a ringed world's ring is lit on the face we see only when δ ≠ 0, so its season is summer)
  const dirAt = (H, phi, o, dl) => {
    const sd = Math.sin(dl || 0), cd = Math.cos(dl || 0);
    o[0] = -cd * Math.sin(H); o[1] = Math.sin(phi) * sd + Math.cos(phi) * cd * Math.cos(H); o[2] = Math.sin(phi) * cd * Math.cos(H) - Math.cos(phi) * sd; return o;
  };
  Exo.dirAt = dirAt;
  // the landing's latitude and the day's start (per world, hashed); locked worlds keep their sun at 24–38°
  Exo.place = (def, pl) => {
    const k = pIndex(def, pl), rg = Exo.ring(def, pl);
    const phi = rg ? rg.lat : (15 + 30 * h01(sysKey(def), k, 0x51a7, 1)) * D2R;
    const dl = rg ? (14 + 10 * h01(sysKey(def), k, 0x51a7, 4)) * D2R : (h01(sysKey(def), k, 0x51a7, 4) - 0.5) * 36 * D2R;
    return { phi, dl, w0: h01(sysKey(def), k, 0x51a7, 2) * 2 * Math.PI, elLock: (24 + 14 * h01(sysKey(def), k, 0x51a7, 3)) * D2R };
  };
  Exo.locked = (pl) => !!(pl.locked || (pl.spin && pl.spin.locked) || !(pl.spin && pl.spin.T > 0));
  Exo.dayLength = (pl) => (Exo.locked(pl) ? Infinity : pl.spin.T);
  Exo.sky = function (def, pl, t, out) {
    out = out || { sun: [0, 1, 0], sun2: [0, 1, 0] };
    const A = starAngles(def, pl, t), P = Exo.place(def, pl), lk = Exo.locked(pl);
    // the hour angle: the world's turn minus the star's angle (a solar day); a locked world: the sun stands where it stands
    // (a locked world: the hour angle where the sun stands at elLock — sin el = sin φ sin δ + cos φ cos δ cos H)
    const H0 = lk ? Math.acos(clamp((Math.sin(P.elLock) - Math.sin(P.phi) * Math.sin(P.dl)) / (Math.cos(P.phi) * Math.cos(P.dl)), -1, 1)) * (h01(def.idx | 0, 3, 5, 7) < 0.5 ? -1 : 1) : P.w0 + 2 * Math.PI * t / pl.spin.T - A.th0;
    dirAt(H0, P.phi, out.sun, P.dl);
    out.ang = Math.min(0.3, def.star.R * 6.957e8 / Math.max(A.d0, 1));
    out.day = Exo.dayLength(pl); out.locked = lk; out.phi = P.phi; out.dl = P.dl;
    out.has2 = !!A.s1;
    if (A.s1) {
      // the companion: the same sky, its hour angle by its true angle from the world; its light share L₂/L₁ (d₁/d₂)²
      dirAt(H0 + (A.th0 - A.th1), P.phi, out.sun2, P.dl);
      const L1 = def.star.L, L2 = def.star2.L;
      out.k2 = clamp(L2 / L1 * Math.pow(A.d0 / Math.max(A.d1, 1), 2), 0, 4);
      out.ang2 = Math.min(0.3, A.s1.R / Math.max(A.d1, 1));
      out.sep = Math.acos(clamp(out.sun[0] * out.sun2[0] + out.sun[1] * out.sun2[1] + out.sun[2] * out.sun2[2], -1, 1));
      out.T2 = def.star2.T; out.color2 = def.star2.color;
    } else { out.k2 = 0; out.ang2 = 0; out.sep = 0; }
    return out;
  };

  // ---------------------------------------------------------------- the nearest system worth the jump
  Exo.why = function (N, idx) {
    const s = N.list[idx]; if (!s || s.home) return null;
    if (s.neb >= 0) return 'nebula';
    if (s.bin && s.bin.close) return 'binary';
    if (s.cls === 'O' || s.cls === 'B' || s.cls === 'A') return 'hot';
    if (s.cls === 'D') return 'dwarf';
    const G = VR.Galaxy, def = G && G.system(N, idx); if (!def) return null;
    for (const b of def.bodies) if (b.planet && b.landable && Exo.signature(def, b)) return 'sig.' + Exo.signature(def, b);
    for (const b of def.bodies) if (b.planet && Exo.ring(def, b)) return 'ring';
    if (s.bin) return 'binary';
    return null;
  };
  Exo.interesting = function (N, from, visited, range) {
    const G = VR.Galaxy, here = N.list[from || 0]; if (!G || !here) return null;
    const v = new Set(visited || []);
    for (const q of G.systemsNear(N, here.p, range || G.RANGE)) {
      if (q.idx === (from || 0) || q.idx === 0 || v.has(q.idx)) continue;
      const why = Exo.why(N, q.idx);
      if (why) return { idx: q.idx, d: q.d, why, name: q.s.name };
    }
    return null;
  };

  // ---------------------------------------------------------------- the save's xgen (like u-fields2's rgen)
  const B = VR.Bodies;
  if (B && B.stamp && !B.stamp.__exo) {
    const st0 = B.stamp, bg0 = B.bgenOf;
    B.stamp = function (meta) {
      const m = st0.apply(this, arguments);
      if (m && !m.guest && m.universe && !(m.universe.xgen > 0)) {
        const was = [m.dim].concat(Object.keys(m.pos || {})).some(d => /^x\./.test(String(d || '')));
        m.universe.xgen = was ? 1 : Exo.XGEN;
      }
      return m;
    };
    B.bgenOf = function (meta) { const o = bg0.apply(this, arguments), x = meta && meta.universe && meta.universe.xgen; o.exo = x > 0 ? x : Exo.XGEN; return o; };
    B.stamp.__exo = true;
  }

  // ---------------------------------------------------------------- the signature landscapes (xgen 2)
  // value noise on a lattice (our own), the columns' decoration: crystal spires in clusters, violet moss with fronds,
  // glass dunes. decoH(x, z) is what a column gains over its ground (spawn and surfaceY step over it)
  const vnoise = (x, z, sc, s) => {
    const fx = x / sc, fz = z / sc, ix = Math.floor(fx), iz = Math.floor(fz), u = fx - ix, v = fz - iz;
    const a = h01(ix, iz, s, 1), b = h01(ix + 1, iz, s, 1), c = h01(ix, iz + 1, s, 1), d = h01(ix + 1, iz + 1, s, 1);
    const su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
    return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv;
  };
  Exo.vnoise = vnoise;
  const CELL = 14;
  // a crystal column: the cluster of its cell (0.4 of the cells), a spire falling off from the centre; lone shards
  function crystalH(x, z, s) {
    let best = 0;
    const ci = Math.floor(x / CELL), cj = Math.floor(z / CELL);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const i = ci + di, j = cj + dj;
      if (h01(i, j, s, 11) > 0.4) continue;
      const cx = (i + 0.2 + 0.6 * h01(i, j, s, 12)) * CELL, cz = (j + 0.2 + 0.6 * h01(i, j, s, 13)) * CELL, R = 2.2 + 3.2 * h01(i, j, s, 14);
      const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz); if (d >= R) continue;
      // (run 3: smooth cones read as stepped ice pyramids — now separate prisms: two of three columns, each its own height)
      if (h01(x, z, s, 17) < 0.36) continue;
      const k = 1 - d / R, H = Math.round(Math.pow(k, 0.8) * (3 + 7 * h01(i, j, s, 15)) * (0.35 + 0.65 * h01(x, z, s, 16)));
      if (H > best) best = H;
    }
    if (!best && h01(x, z, s, 18) < 0.006) best = 1 + (h01(x, z, s, 19) < 0.4 ? 1 : 0);
    return best;
  }
  // a dune: ridges across a wind (the dune field's mask, crests sharper than the troughs)
  function duneH(x, z, s) {
    const a = h01(s, 3, 9, 1) * Math.PI, ca = Math.cos(a), sa = Math.sin(a);
    const m = vnoise(x, z, 70, s ^ 0x91);
    if (m < 0.38) return 0;
    const w = (x * ca + z * sa) / 11 + 2.2 * vnoise(x, z, 37, s ^ 0x92);
    const r = 0.5 + 0.5 * Math.sin(w * Math.PI);
    return Math.floor(Math.pow(r, 1.6) * 4.6 * clamp((m - 0.38) / 0.18, 0, 1));
  }
  Exo.decoH = (sig, x, z, s) => (sig === 'crystal' ? crystalH(x, z, s) : sig === 'glass' ? duneH(x, z, s) : 0);
  let IDS = null;
  function ids() {
    if (IDS) return IDS;
    const R = VR.R; if (!R || !R.byName) return null;
    const S = (n) => (R.byName[n] ? R.S(n) : 0);
    const ok = new Uint8Array(R.stateCount + 1);
    for (const t of R.types) {
      const bad = t.solid === false || /water|lava|ice|snow|frost|bedrock|glass|crystal/.test(t.name);
      for (let k = 0; k < t.nstates; k++) ok[t.base + k] = bad ? 0 : 1;
    }
    IDS = { crystal: S('exo_crystal'), moss: S('exo_moss'), frond: S('exo_frond'), glass: S('exo_glass'), ok };
    if (!IDS.crystal) { IDS = null; return null; }
    return IDS;
  }
  Exo.decoChunk = function (blocks, cx, cz, sig, s) {
    const I = ids(); if (!I || !sig) return 0;
    let n = 0;
    for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
      const col = lz * 16 + lx, x = cx * 16 + lx, z = cz * 16 + lz;
      let y = 250; while (y > 1 && !blocks[(y << 8) | col]) y--;
      const top = blocks[(y << 8) | col];
      if (!I.ok[top] || y > 240) continue;
      if (sig === 'crystal') {
        const H = crystalH(x, z, s);
        for (let k = 1; k <= H; k++) blocks[((y + k) << 8) | col] = I.crystal;
        n += H;
      } else if (sig === 'glass') {
        const m = vnoise(x, z, 70, s ^ 0x91); if (m < 0.33) continue;
        const H = duneH(x, z, s);
        blocks[(y << 8) | col] = I.glass;
        for (let k = 1; k <= H; k++) blocks[((y + k) << 8) | col] = I.glass;
        n += H + 1;
      } else if (sig === 'violet') {
        const c = vnoise(x, z, 13, s ^ 0x71) * 0.7 + vnoise(x, z, 4, s ^ 0x72) * 0.3;
        if (c < 0.36) continue;
        blocks[(y << 8) | col] = I.moss; n++;
        const f = h01(x, z, s, 31);
        if (f < 0.16 * clamp((c - 0.36) / 0.2, 0.3, 1)) { blocks[((y + 1) << 8) | col] = I.frond; n++; if (f < 0.035 && c > 0.5) { blocks[((y + 2) << 8) | col] = I.frond; n++; } }
      }
    }
    return n;
  };
  // the world of planet p of system sys under seed: its signature (cached per worker)
  const SIGC = new Map();
  Exo.sigOf = function (seed, sys, p) {
    const key = seed + ':' + sys + ':' + p; if (SIGC.has(key)) return SIGC.get(key);
    const G = VR.Galaxy; let sig = null;
    try { const N = G.build((seed >>> 0) || 0x5eed), def = G.system(N, sys), pl = def && def.bodies.find(b => b.id === def.id + 'p' + p); sig = pl ? Exo.signature(def, pl) : null; } catch (e) { sig = null; }
    SIGC.set(key, sig); return sig;
  };
  Exo.decorate = function (gen, sig, s) {
    if (!gen || !sig || gen.__exo) return gen;
    const g0 = gen.generate.bind(gen), sp0 = gen.findSpawn && gen.findSpawn.bind(gen), sy0 = gen.surfaceY && gen.surfaceY.bind(gen);
    gen.generate = function (cx, cz) { const r = g0(cx, cz); if (r && r.blocks) Exo.decoChunk(r.blocks, cx, cz, sig, s); return r; };
    if (sy0 && sig === 'glass') gen.surfaceY = (x, z) => sy0(x, z) + duneH(x, z, s);
    if (sp0) gen.findSpawn = function (x, z) {
      const r = sp0(x, z); if (!r) return r;
      if (sig === 'crystal') {
        // step out of a cluster: the nearest column without a spire
        let bx = Math.floor(r[0]), bz = Math.floor(r[2]);
        if (crystalH(bx, bz, s)) {
          outer: for (let rr = 1; rr < 24; rr++) for (let k = 0; k < 8 * rr; k++) {
            const a = k / (8 * rr) * 2 * Math.PI, xx = Math.round(bx + rr * Math.cos(a)), zz = Math.round(bz + rr * Math.sin(a));
            if (!crystalH(xx, zz, s) && !crystalH(xx + 1, zz, s) && !crystalH(xx, zz + 1, s)) { bx = xx; bz = zz; break outer; }
          }
          const y = sy0 ? sy0(bx, bz) + 1 : r[1];
          return [bx + 0.5, y, bz + 0.5, r[3] || 0];
        }
        return r;
      }
      if (sig === 'glass') return [r[0], r[1] + duneH(Math.floor(r[0]), Math.floor(r[2]), s) + 1, r[2], r[3] || 0];
      if (sig === 'violet') return [r[0], r[1] + 2, r[2], r[3] || 0];
      return r;
    };
    gen.__exo = sig;
    return gen;
  };
  // the dims (galaxy.js resolves them): a world of xgen ≥ 2 gets its landscape
  if (VR.DimReg && VR.DimReg.resolve && !VR.DimReg.resolve.__exo) {
    const res0 = VR.DimReg.resolve;
    VR.DimReg.resolve = function (id) {
      const d = res0.apply(this, arguments);
      if (d && d.exo && !d.gen.__exo) {
        const g0 = d.gen, e = d.exo;
        d.gen = function (seed, opts) {
          const gen = g0(seed, opts), xg = opts && opts.bgen && opts.bgen.exo;
          if (!(xg >= 2)) return gen;
          const sig = Exo.sigOf(seed, e.sys, e.p);
          return sig ? Exo.decorate(gen, sig, (Math.imul((seed >>> 0) ^ 0x3c6e, 31) + e.sys * 131 + e.p) | 0) : gen;
        };
        d.gen.__exo = true;
      }
      return d;
    };
    VR.DimReg.resolve.__exo = true;
  }
})((typeof globalThis !== 'undefined' ? globalThis : self).VR || ((typeof globalThis !== 'undefined' ? globalThis : self).VR = {}));

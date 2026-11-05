// ============================================================================
// 🎞 Der Welt-Trailer (t-film; docs/superpowers/plans/2026-11-05-t-film.md): the second trailer, „Die Welt heute" —
// `/trailer welt` or the pause menu's 🎞 choice. Nine shots, 46.5 s, cut like a warm cartoon film through what the
// Heartland is now: the high establishing wide over the land under the Sky Isles, a deer mother and her fawns on the
// meadow (a low hero angle; wildheart's family, Balanced and up), the village's life, a Flausel at the fairy tree in the
// golden light, the isles' reveal (the camera rises from behind the hill) with a freighter, a ferry shuttle over your
// head, an outpost's ✦ BEFREIT ✦ moment, the sunset turning to night with stars, and the title R9-SI with a German
// subtitle line. The old Heartland trailer (director.js's TRAILER) is untouched.
// The places are found when it starts (the nearest village the world knows, /locate's outpost, the fairy places); every
// shot is re-anchored to its ground once its chunks are in (resolve / reanchor) and staged then (the family spawned
// through Entities.summon + WildHeart.family, removed again at the end). The freeing is staged only on a recording
// (opts.stage: test/trailer_video.mjs plays it in a throwaway Abenteuer world) — in your own world the outpost is shown
// as it is (nothing is freed or awarded for you).
// Pure (test/trailer_welt.js): plan · resolve · reanchor. Game side: wraps VR.Director (play 'welt', update, stop) the
// way reel.js does. Cost 🟢: nothing while it isn't playing; the film plays at the game's own cost.
// ============================================================================
(function (VR) {
  'use strict';
  const TW = VR.TrailerWelt = VR.TrailerWelt || {};
  const tx = (k, v, de, en) => (VR.I18N && VR.I18N.tx ? VR.I18N.tx(k, v, de, en) : de);
  const add = (o, d) => [o[0] + d[0], o[1] + d[1], o[2] + d[2]];
  TW.ISLES = [330, 146, 140];      // the Sky Isles' centre (the Heartland: test/isles15.mjs)
  TW.MEADOW = [296, 82, 196];      // the meadow under the centre isle's south-west rim
  TW.FREE_AT = 0.6;                // the freeing starts this long into its shot

  // ---------------------------------------------------------------- the shot list (pure)
  // A: { meadow, village, fairy, outpost, beacon, isles } — [x, y, z] or null (y: the ground there, a guess until resolved)
  TW.plan = function (A) {
    A = A || {};
    const I = A.isles || TW.ISLES, M = A.meadow || TW.MEADOW;
    const shot = (name, dur, fov, tod, capKey, keys, o) => Object.assign({ name, dur, fov, tod, capKey, capAt: 0.8, capSmall: true, keys, welt: true, fadeIn: 0.15, fadeOut: 0.12 }, o || {});
    const rel = (o, k) => k.map(([t, p, l]) => [t, add(o, p), add(o, l)]);
    const S = [];
    // 1 · the establishing wide: high over the land under the isles, a slow push
    S.push(shot('auftakt', 5, 62, 3000, 'g.film.w.c1', rel(I, [[0, [-170, 40, 150], [-20, -30, 0]], [5, [-155, 36, 135], [-18, -30, 0]]]), { fadeIn: 1.0 }));
    // 2 · the meadow: a deer mother and her fawns, a low hero angle looking up toward the isle's underside
    S.push(shot('wiese', 5, 58, 2700, 'g.film.w.c2', rel(M, [[0, [-5, 1.7, 7.5], [1, 2.5, -2]], [5, [-3.4, 1.6, 5.2], [1.6, 2.8, -3]]]), { stage: 'family', anchor: M.slice() }));
    // 3 · the village's life on its plaza (or, in a world without one near, the land)
    if (A.village) S.push(shot('dorf', 5, 60, 5600, 'g.film.w.c3', rel(A.village, [[0, [13, 3.4, 9], [0, 2.6, 0]], [5, [9.5, 3.0, 6.5], [-1, 2.6, -1]]]), { stage: 'village', anchor: A.village.slice() }));
    else { const L = add(M, [-60, 0, 30]); S.push(shot('land', 5, 60, 4200, 'g.film.w.c3b', rel(L, [[0, [14, 8, 12], [0, 3, 0]], [5, [10, 7, 9], [0, 3, 0]]]), { anchor: L })); }
    // 4 · a Flausel at the fairy tree in the golden light (or the meadow's edge)
    if (A.fairy) S.push(shot('flausel', 4.5, 55, 10400, 'g.film.w.c4', rel(A.fairy, [[0, [14, 4.5, 12], [0, 3.5, 0]], [4.5, [9, 3.4, 8], [0, 3.2, 0]]]), { stage: 'fairy', anchor: A.fairy.slice() }));
    else { const L = add(M, [30, 0, 60]); S.push(shot('pfad', 4.5, 55, 10400, 'g.film.w.c4b', rel(L, [[0, [12, 3, 10], [0, 2, 0]], [4.5, [8, 2.4, 7], [0, 2, 0]]]), { anchor: L })); }
    // 5 · the reveal: the camera rises from behind the hill, the isles appear; a freighter crosses in front of them
    S.push(shot('inseln', 5.5, 66, 7600, 'g.film.w.c5', rel(I, [[0, [-170, -36, 60], [0, -10, 0]], [5.5, [-162, -8, 52], [0, -2, 0]]]),
      { fogR: 140, ships: [{ arch: 'freighter', A: add(I, [-60, 10, -110]), C: add(I, [-40, 8, 10]), B: add(I, [-20, 6, 140]), dur: 9, delay: 0 }] }));
    // 6 · the ferry: a shuttle passes close over the lake under the isles, the camera pans with it
    S.push(shot('faehre', 4.5, 64, 8800, 'g.film.w.c6', rel(M, [[0, [0, 2.2, 8], [-14, 6, -14]], [4.5, [3, 2.4, 6], [16, 8, -16]]]),
      { anchor: M.slice(), fixed: true, fogR: 140, ships: [{ arch: 'shuttle', A: add(M, [-44, 8, -10]), C: add(M, [0, 9, -15]), B: add(M, [52, 13, -22]), dur: 4.6, delay: 0 }] }));
    // 7 · an outpost freed: the Leuchtfeuer turns cyan, the beam, the ring of light, ✦ BEFREIT ✦ (or a golden ride)
    const B = A.beacon || (A.outpost ? add(A.outpost, [0, 1, 0]) : null);
    // (f-film2: low and wide — the beacon, its beam and the ring against the sky; the BEFREIT banner small up top)
    if (B) S.push(shot('befreit', 6, 58, 9800, 'g.film.w.c7', rel(B, [[0, [22, 3, 15], [0, 6, 0]], [6, [16, 2.5, 11], [0, 6, 0]]]), { stage: 'liberate', anchor: B.slice(), site: A.outpost ? Math.round(A.outpost[0]) + '_' + Math.round(A.outpost[2]) : null }));
    else { const L = add(M, [-30, 0, -70]); S.push(shot('weite', 6, 60, 9800, 'g.film.w.c7b', rel(L, [[0, [20, 12, 16], [0, 4, 0]], [6, [14, 10, 12], [0, 4, 0]]]), { anchor: L })); }
    // 8 · the sun goes down: the sky turns from gold to night, the stars come out over the isles
    S.push(shot('abend', 6, 64, 11000, 'g.film.w.c8', rel(I, [[0, [-160, 2, 18], [0, -6, 0]], [6, [-152, 4, 14], [0, -4, 0]]]), { todTo: 15200, fadeOut: 0, fogR: 2000 }));
    // 9 · the title over the night sky: the camera tilts up from the isles into the stars
    S.push(shot('titel', 5, 66, 15200, 'g.film.w.title', rel(I, [[0, [-152, 4, 14], [0, -4, 0]], [5, [-148, 6, 12], [0, 34, -10]]]), { todTo: 16500, caption: 'R9-SI', big: true, capSmall: false, capAt: 1.0, subKey: 'g.film.w.sub', fadeIn: 0, fadeOut: 1.0, seam: true, fogR: 2000 }));
    return S;
  };
  // every key at least `clear` over the ground (ground(x, z) → the top block's y); the look stays
  TW.resolve = function (shot, ground, clear) {
    const c = clear === undefined ? 1.2 : clear;
    for (const k of shot.keys) { const gy = ground(k[1][0], k[1][2]); if (Number.isFinite(gy) && k[1][1] < gy + c) k[1][1] = gy + c + 0.01; }
    return shot;
  };
  // the place found where it really is: every key (and the scripted ships) moved by the difference
  TW.reanchor = function (shot, at) {
    if (!shot.anchor || !at) return shot;
    const d = [at[0] - shot.anchor[0], at[1] - shot.anchor[1], at[2] - shot.anchor[2]];
    if (!d.every(Number.isFinite)) return shot;
    for (const k of shot.keys) { k[1] = add(k[1], d); k[2] = add(k[2], d); }
    for (const sp of shot.ships || []) { sp.A = add(sp.A, d); sp.B = add(sp.B, d); sp.C = add(sp.C, d); }
    shot.anchor = at.slice();
    return shot;
  };

  // a camera on a circle round T at the angle a (radians, 0 = +z): from r0 / h0 in to r1 / h1, looking at T + l0 → l1
  TW.orbitKeys = function (T, a, dur, r0, r1, h0, h1, l0, l1, da) {
    const s0 = Math.sin(a), c0 = Math.cos(a), a1 = a + (da || 0), s1 = Math.sin(a1), c1 = Math.cos(a1);
    return [[0, [T[0] + s0 * r0, T[1] + h0, T[2] + c0 * r0], [T[0], T[1] + l0, T[2]]], [dur, [T[0] + s1 * r1, T[1] + h1, T[2] + c1 * r1], [T[0], T[1] + l1, T[2]]]];
  };
  // the angle round T whose sight lines (from both ends of the move) are clearest: solid(x, y, z) → true for a block
  // (f-film2: avoid — [{p, r}…], things that must not stand in the frame in front of the target, a parked ship: a
  // heavy penalty when one is nearer than the target and inside the middle of the view)
  TW.clearAngle = function (solid, T, a0, r0, r1, h0, h1, lh, n, avoid) {
    n = n || 12; let best = a0, bs = 1e9;
    for (let i = 0; i < n; i++) {
      const a = a0 + i * Math.PI * 2 / n; let hits = 0;
      for (const [r, h] of [[r0, h0], [r1, h1]]) {
        const C = [T[0] + Math.sin(a) * r, T[1] + h, T[2] + Math.cos(a) * r];
        for (let k = 1; k < 20; k++) { const u = k / 20; if (solid(C[0] + (T[0] - C[0]) * u, C[1] + (T[1] + lh - C[1]) * u, C[2] + (T[2] - C[2]) * u)) hits++; }
        // elbow room: a wall right beside the lens fills a side of the frame
        for (let j = 0; j < 8; j++) { const b = j * Math.PI / 4; for (const rr of [2.5, 5]) if (solid(C[0] + Math.sin(b) * rr, C[1], C[2] + Math.cos(b) * rr)) hits += 1.5; }
      }
      for (const o of avoid || []) for (const [r, h] of [[r0, h0], [r1, h1]]) {
        const C = [T[0] + Math.sin(a) * r, T[1] + h, T[2] + Math.cos(a) * r], vt = [T[0] - C[0], T[1] + lh * 0.5 - C[1], T[2] - C[2]], vo = [o.p[0] - C[0], o.p[1] - C[1], o.p[2] - C[2]];
        const dt = Math.hypot(...vt), dq = Math.hypot(...vo); if (dq > dt + o.r || dq < 0.5) continue;
        const cos = (vt[0] * vo[0] + vt[1] * vo[1] + vt[2] * vo[2]) / (dt * dq), off = Math.acos(Math.max(-1, Math.min(1, cos))) - Math.atan(o.r / dq);
        if (off < 0.45) hits += 40 * (1 - Math.max(0, off) / 0.45);
      }
      const sc = hits + i * 0.01; if (sc < bs) { bs = sc; best = a; }
    }
    return best;
  };
  // a meadow near P for the family: a grass top, flat (±1) over 7 × 7, no water — the nearest in rings of 4 m
  TW.findMeadow = function (top, isGrass, P, R) {
    R = R || 64;
    for (let r = 0; r <= R; r += 4) {
      const n = Math.max(1, Math.round(r * 1.5));
      for (let i = 0; i < n; i++) {
        const a = i * Math.PI * 2 / n, x = Math.round(P[0] + Math.sin(a) * r), z = Math.round(P[2] + Math.cos(a) * r);
        const y = top(x, z); if (!Number.isFinite(y) || !isGrass(x, y, z)) continue;
        let ok = true;
        for (let dz = -3; dz <= 3 && ok; dz += 1) for (let dx = -3; dx <= 3 && ok; dx += 1) { const yy = top(x + dx, z + dz); if (!Number.isFinite(yy) || Math.abs(yy - y) > 1 || !isGrass(x + dx, yy, z + dz)) ok = false; }
        if (ok) return [x, y, z];
      }
    }
    return null;
  };

  // ---------------------------------------------------------------- f-film2: the cinema grade, the framing (pure)
  // (docs/superpowers/plans/2026-11-05-f-film2.md) Only while the film plays: VR.Grade's knobs swapped for these (richer,
  // a warmer cartoon film: more saturation and contrast, a stronger vignette, a thinner haze, a little more glow) and the
  // composite's FILMG pass (u_film: the shadows' warm lift, the warmth of the lights, the oval vignette, on).
  TW.FILM = { sat: 1.3, contrast: 0.44, vignette: 0.42, fogDens: 0.00007, expo: 0.8, bloomStr: 0.13 };
  TW.FILM_GL = [1, 1, 0.32, 1];
  TW.FOG_NEAR = 70;   // m: no fog-bank sprite whose edge is nearer than this to the lens while the film plays
  // the knobs of F put into G; returns what was there (swap it back with the result)
  TW.gradeSwap = function (G, F) { const was = {}; for (const k in F) { was[k] = G[k]; G[k] = F[k]; } return was; };
  // the fog-bank sprites ([x, y, z, r, …]) without the ones whose edge is within R of the camera (R 0: the list as it is)
  TW.fogNear = function (list, cam, R) {
    if (!(R > 0) || !list) return list;
    return list.filter((s) => Math.hypot(s[0] - cam.x, s[1] - cam.y, s[2] - cam.z) - (s[3] || 0) > R);
  };
  // parked ships as solid boxes (their occupancy grid, turned by yaw — starships.js getBlock's inverse) near T
  TW.shipSolid = function (ships, T, R) {
    const L = (ships || []).filter((s) => s && s.pos && s.d && s.d.occ && s.d.meta && Math.hypot(s.pos[0] - T[0], s.pos[2] - T[2]) < (R || 80));
    return function (x, y, z) {
      for (const s of L) {
        const o = s.d.occ, org = s.d.meta.origin, cx = x - s.pos[0], cy = y - s.pos[1] + (s.kneel || 0), cz = z - s.pos[2];
        const c = Math.cos(s.yaw || 0), sn = Math.sin(s.yaw || 0), lx = cx * c - cz * sn, lz = cx * sn + cz * c;
        const i = Math.floor(lx - org[0]), j = Math.floor(cy - org[1]), k = Math.floor(lz - org[2]);
        if (i < 0 || j < 0 || k < 0 || i >= o.bx || j >= o.by || k >= o.bz) continue;
        if (!o.occ || o.occ[(j * o.bz + k) * o.bx + i]) return true;
      }
      return false;
    };
  };
  // the foreground of a low shot: spots just past where the frame's bottom edge (inside the letterbox, fov the vertical
  // fov in degrees) meets the ground, in its lower corners (never the middle third) — on a free ground top (top(x, z) →
  // the top block's y; can(x, y, z) → a tuft may stand at y). A camera more than 4.5 m over the ground, or one whose
  // frame meets the ground farther than 14 m away: none (the corners show sky or far land).
  TW.dressSpots = function (cam, look, top, can, n, fov) {
    n = n || 12; const out = [];
    const dx = look[0] - cam[0], dz = look[2] - cam[2], dl = Math.hypot(dx, dz) || 1, fx = dx / dl, fz = dz / dl, rx = -fz, rz = fx;
    const gy0 = top(Math.floor(cam[0] + fx * 4), Math.floor(cam[2] + fz * 4));
    const h = cam[1] - (gy0 + 1); if (!Number.isFinite(gy0) || h > 4.5) return out;
    const tv = Math.tan((fov || 58) * Math.PI / 360), vb = Math.atan(tv * 0.74), pitch = Math.atan2(look[1] - cam[1], dl);   // (0.74: the letterbox)
    const down = vb - pitch; if (down < 0.05) return out;
    const a0 = Math.max(1.6, Math.max(0, h) / Math.tan(down) + 0.4); if (a0 > 14) return out;
    for (let i = 0; i < n * 3 && out.length < n; i++) {
      const u = ((i * 0.618034) % 1), v = ((i * 0.754878) % 1);
      const ahead = a0 + u * 4, side = (i % 2 ? 1 : -1) * ahead * tv * 1.78 * (0.42 + v * 0.45);
      const x = Math.floor(cam[0] + fx * ahead + rx * side), z = Math.floor(cam[2] + fz * ahead + rz * side);
      const y = top(x, z); if (!Number.isFinite(y) || !can(x, y + 1, z)) continue;
      if (out.some((p) => p[0] === x && p[2] === z)) continue;
      out.push([x, y + 1, z]);
    }
    return out;
  };

  // ---------------------------------------------------------------- the game side
  const Dir = VR.Director;
  if (!Dir || typeof document === 'undefined') return;
  const P = Dir.prototype, play0 = P.play, up0 = P.update, stop0 = P.stop;
  TW.run = null; TW.busy = false;
  TW.ok = (g) => !!(g && g.meta && g.meta.type === 'default' && (g.dim || 'overworld') === 'overworld');
  const ground = (g) => (x, z) => { const w = g.world; x = Math.floor(x); z = Math.floor(z); return w && w.isLoaded && w.isLoaded(x, z) ? w.topAt(x, z) : NaN; };
  const fairySite = () => { try { const L = VR.Fairy && VR.Fairy.debug ? VR.Fairy.debug.sites() : []; return L.find((s) => s.kind === 'tree') || L[0] || null; } catch (e) { return null; } };
  // the places, asked once (the worker's /locate for the outpost; the villages the world knows)
  TW.anchors = function (g, cb) {
    const p = g.player.pos, A = { isles: TW.ISLES.slice(), meadow: TW.MEADOW.slice(), village: null, fairy: null, outpost: null, beacon: null };
    let best = null, bn = -1;
    const V = g.villages; if (V && V.known) for (const v of V.known.values()) { const pz = v && v.plan && v.plan.plaza; if (!pz) continue; const n = (v.people || v.folk || []).length, d = Math.hypot(pz.x - p[0], pz.z - p[2]); if (d < 600 && n > bn) { bn = n; best = [pz.x, pz.y, pz.z]; } }
    A.village = best;
    const f = fairySite(); if (f) A.fairy = [f.x, f.y === null || f.y === undefined ? 84 : f.y, f.z];
    let done = false; const fin = () => { if (done) return; done = true; cb(A); };
    const ask = (biome, then) => { try { g.pool.direct(0, { type: 'locate', dim: 'overworld', biome, x: Math.floor(p[0]), z: Math.floor(p[2]) }, null, (m) => then(m && Array.isArray(m.pos) ? m.pos : null)); } catch (e) { then(null); } };
    ask('outpost', (o) => {
      if (o) { A.outpost = o.slice(); const s = VR.Liberate && VR.Liberate.siteOf ? VR.Liberate.siteOf(Math.round(o[0]) + '_' + Math.round(o[2])) : null; A.beacon = s && s.beacon ? s.beacon.slice() : null; }
      if (!A.village) ask('village', (v) => { if (v) A.village = [v[0], v[1] - 1, v[2]]; fin(); }); else fin();
    });
    setTimeout(fin, 5000);
  };
  TW.start = function (dir, o) {
    const g = dir.g; if (!g || g.state !== 'play' || !g.player || dir.active || TW.busy) return false;
    if (!TW.ok(g)) return false;
    TW.busy = true;
    TW.anchors(g, (A) => {
      TW.busy = false; if (g.state !== 'play' || dir.active) return;
      const shots = TW.plan(A);
      for (const s of shots) if (!s.caption) s.caption = tx(s.capKey, null, '', '');
      TW.run = { A, mobs: [], stage: !!(o && o.stage), wx: g.zenFreezeWeather, si: -1, o: o || {}, dressed: [] };
      g.zenFreezeWeather = true; document.body.classList.add('r9film');
      TW.filmOn(g);
      if (!play0.call(dir, shots, o)) { g.zenFreezeWeather = TW.run.wx; TW.filmOff(g); TW.run = null; }
    });
    return true;
  };
  P.play = function (name, o) { if (name === 'welt') return TW.start(this, o); return play0.apply(this, arguments); };
  // the subtitle line under the title
  const sub = (dir, text) => {
    const d = dir.dom; if (!d) return;
    let el = d.querySelector('.capsub');
    if (!el) { el = document.createElement('div'); el.className = 'capsub'; d.appendChild(el); }
    el.textContent = text || ''; el.style.display = text ? '' : 'none';
  };
  // a shot's chunks are in: put it on its ground, stage what it shows
  TW.ready = function (g, dir, shot) {
    const run = TW.run; if (!run) return;
    const w = g.world, R = VR.R, top = ground(g);
    const solid = (x, y, z) => { const b = w.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)); return !!b && !(R && R.T && R.T.type && R.byName.water && R.T.type[b] === R.byName.water.id); };
    if (shot.stage === 'fairy') { const f = fairySite(); if (f && f.y !== null && f.y !== undefined) TW.reanchor(shot, [f.x, f.y, f.z]); }
    else if (shot.stage === 'liberate') { const s = shot.site && VR.Liberate ? VR.Liberate.siteOf(shot.site) : null; if (s && s.beacon) TW.reanchor(shot, s.beacon); }
    else if (shot.stage === 'family') {
      const gid = R && R.byName.grass_block ? R.byName.grass_block.id : -1;
      const isGrass = (x, y, z) => { const b = w.getBlock(x, y, z); return !!b && R.T.type[b] === gid && !w.getBlock(x, y + 2, z); };
      const m = TW.findMeadow(top, isGrass, shot.anchor, 72); if (m) { TW.reanchor(shot, m); run.meadow = m.slice(); }
    }
    // (fixed: the ferry's lake — its floor is not the place)
    else if (shot.anchor && !shot.fixed) { const gy = top(shot.anchor[0], shot.anchor[2]); if (Number.isFinite(gy) && gy > 0) TW.reanchor(shot, [shot.anchor[0], gy, shot.anchor[2]]); }
    // the fairy tree and the outpost: circle to the side whose sight line is clear (a train, a wall, a hill in front)
    if (shot.stage === 'fairy' || shot.stage === 'liberate' || shot.stage === 'village') {
      const T = shot.anchor, k0 = shot.keys[0], k1 = shot.keys[shot.keys.length - 1];
      const r0 = Math.hypot(k0[1][0] - T[0], k0[1][2] - T[2]), r1 = Math.hypot(k1[1][0] - T[0], k1[1][2] - T[2]);
      const h0 = k0[1][1] - T[1], h1 = k1[1][1] - T[1], l0 = k0[2][1] - T[1], l1 = k1[2][1] - T[1];
      const a0 = Math.atan2(k0[1][0] - T[0], k0[1][2] - T[2]);
      // (f-film2: a parked world ship is a wall too — it is a model, not blocks)
      const SH = (g.starships && g.starships.ships || []).filter((q) => q && q.pos && Math.hypot(q.pos[0] - T[0], q.pos[2] - T[2]) < 70);
      const ss = TW.shipSolid(SH, T, 90), solid2 = (x, y, z) => solid(x, y, z) || ss(x, y, z);
      const avoid = SH.map((q) => { const o = q.d && q.d.occ; return { p: [q.pos[0], q.pos[1] + (o ? o.by / 2 : 2), q.pos[2]], r: o ? Math.max(o.bx, o.bz) * 0.5 + 1 : 8 }; });
      const a = TW.clearAngle(solid2, T, a0, r0, r1, h0, h1, (l0 + l1) / 2, 12, avoid);
      shot.keys = TW.orbitKeys(T, a, shot.dur, r0, r1, h0, h1, l0, l1, 0.12);
    }
    TW.resolve(shot, top, 1.8);
    if (run.stage) TW.dress(g, shot);
    TW.fogR = shot.fogR !== undefined ? shot.fogR : TW.FOG_NEAR;
    if (g.renderer) g.renderer.puffKey = '';   // (f-film2: the fog sprites again, without the ones by the lens)
    if (shot.stage === 'family') {
      const E = g.entities, H = g.companions && g.companions.heart, a = shot.anchor; if (!E || !E.summon) return;
      const mom = E.summon('glimmer_deer', a[0] + 0.5, a[1] + 1, a[2] + 0.5); if (!mom) return;
      mom.yaw = -Math.PI * 0.5;   // (walking toward +x, across the frame)
      const kids = [1, 2, 3].map((i) => E.summon('glimmer_deer', a[0] + 0.5 - i * 1.2, a[1] + 1, a[2] + 0.5 + (i % 2) * 0.6)).filter(Boolean);
      run.mobs.push(mom, ...kids);
      try { if (H && H.on) { H.update(1.1); H.family(mom, kids); } } catch (e) { console.warn('trailer welt', e); }
      if (mom.ai) { mom.ai.t = 99; mom.ai.target = [a[0] + 9, a[2] - 1]; }
    }
  };
  // ---- f-film2: the grade on and off (VR.Grade's knobs and the composite's FILMG define), the foreground, the fog
  TW.filmDef = false; TW.filmW = 1;
  const rebuild = (g) => {
    const R = g && g.renderer, G = VR.GL, S = VR.SHADERS; if (!R || !R.P || !R.P.composite || !G || !S) return;
    const was = G.deferred; G.deferred = true;
    try { R.P.composite = G.program(S.FS_VS, S.COMPOSITE_FS, 'composite'); } catch (e) { console.warn('trailer welt', e); } finally { G.deferred = was; }
  };
  TW.filmOn = function (g) {
    if (TW.filmSaved || (TW.run && TW.run.o && TW.run.o.nograde)) return;
    TW.filmSaved = VR.Grade ? TW.gradeSwap(VR.Grade, TW.FILM) : {}; TW.filmDef = true; TW.filmW = 1; rebuild(g);
    if (g.renderer) g.renderer.puffKey = '';
  };
  TW.filmOff = function (g) {
    if (!TW.filmSaved) return;
    if (VR.Grade) TW.gradeSwap(VR.Grade, TW.filmSaved); TW.filmSaved = null; TW.filmDef = false; rebuild(g);
    if (g.renderer) g.renderer.puffKey = '';
  };
  // the before/after: the grade off for a frame (the recorder's comparison) — the knobs and u_film.w, no rebuild
  TW.filmShow = function (on) {
    if (!TW.filmSaved || !VR.Grade) return;
    if (!on && !TW.filmHidden) { TW.filmHidden = TW.gradeSwap(VR.Grade, TW.filmSaved); TW.filmW = 0; }
    else if (on && TW.filmHidden) { TW.gradeSwap(VR.Grade, TW.filmHidden); TW.filmHidden = null; TW.filmW = 1; }
  };
  if (VR.GL) { const prev = VR.GL.defineHook || null; VR.GL.defineHook = (name, defines) => { const d = prev ? prev(name, defines) : (defines || []); return TW.filmDef && name === 'composite' && !d.includes('FILMG') ? d.concat(['FILMG']) : d; }; }
  if (VR.Renderer) {
    const RP = VR.Renderer.prototype, l2p0 = RP.l2Post;
    RP.l2Post = function (p, E, pass, F) {
      if (l2p0) l2p0.call(this, p, E, pass, F);
      if (pass === 'composite' && p.u.u_film) { const f = TW.FILM_GL; this.gl.uniform4f(p.u.u_film, f[0], f[1], f[2], TW.filmDef ? TW.filmW : 0); }
    };
  }
  // the fog banks (the isles' and the valleys') without the sprites by the lens, while the film plays
  const CL = VR.Clouds;
  if (CL && CL.field && !CL.field.__tw) {
    const f0 = CL.field;
    CL.field = function (cam) { const f = f0.apply(this, arguments); if (TW.run && f && f.fog) f.fog = TW.fogNear(f.fog, cam, TW.fogR || TW.FOG_NEAR); return f; };
    CL.field.__tw = true;
    if (CL.valleyFog) { const v0 = CL.valleyFog; CL.valleyFog = function (eye) { const L = v0.apply(this, arguments); const g = VR.game, p = g && g.player; return TW.run && p ? TW.fogNear(L, { x: p.pos[0], y: p.pos[1] + (p.eye || 1.6), z: p.pos[2] }, TW.fogR || TW.FOG_NEAR) : L; }; }
  }
  // the foreground (a recording only): the game's own flowers and grass tufts in the low shots' lower corners, put back at
  // the stop. (from the shot's last key: the camera moves in toward the subject, the tufts stay ahead of it all along)
  const TUFTS = ['poppy', 'dandelion', 'cornflower', 'oxeye_daisy', 'short_grass', 'fern', 'short_grass', 'lavender', 'rose_bush'];
  TW.dress = function (g, shot) {
    const run = TW.run, w = g.world, R = VR.R; if (!run || !w || !R || !R.byName.grass_block) return 0;
    const gid = R.byName.grass_block.id, ids = TUFTS.map((n) => R.byName[n] ? R.byName[n].defaultState : 0).filter(Boolean); if (!ids.length) return 0;
    const top = ground(g), can = (x, y, z) => { const b = w.getBlock(x, y - 1, z); return !!b && R.T.type[b] === gid && !w.getBlock(x, y, z) && !w.getBlock(x, y + 1, z); };
    const k = shot.keys[shot.keys.length - 1], spots = TW.dressSpots(k[1], k[2], top, can, 14, shot.fov);
    let n = 0;
    for (const [x, y, z] of spots) { const id = ids[(((x * 7 + z * 13 + n) % ids.length) + ids.length) % ids.length]; if (w.setBlock(x, y, z, id, 4)) { run.dressed.push([x, y, z]); n++; } }
    shot._dressed = n; return n;
  };
  TW.undress = function (g, run) { const w = g && g.world; if (!w || !run || !run.dressed) return; for (const [x, y, z] of run.dressed) w.setBlock(x, y, z, 0, 4); run.dressed.length = 0; };
  // the freeing, on a recording only (see the header)
  TW.free = function (g, shot) {
    const L = VR.Liberate, run = TW.run; if (!L || !run || !run.stage || !shot.site) return false;
    const s = L.siteOf(shot.site); if (!s || s.st === 'frei') return false;
    const ok = L.free(g, s); L.mcam = null;   // (the director keeps the camera)
    return ok;
  };
  P.update = function (dt) {
    const run = TW.run, mine = run && this.active && this.shots && this.shots[0] && this.shots[0].welt;
    if (!mine) return up0.apply(this, arguments);
    const g = this.g, si0 = this.si, ph0 = this.phase;
    const r = up0.apply(this, arguments);
    if (!this.active || TW.run !== run) return r;
    // a new shot: the last one's scripted ships go (a freighter parked at the end of its path would stand in the dusk)
    if (this.si !== si0 && this.myShips) { for (const sh of this.myShips) sh.dead = true; this.myShips.length = 0; }
    const shot = this.shots[this.si]; if (!shot) return r;
    if (this.phase === 'run' && (ph0 !== 'run' || si0 !== this.si) && !shot._ready) {
      shot._ready = true;
      try { TW.ready(g, this, shot); } catch (e) { console.warn('trailer welt', e); }
      if (VR.TrailerScore && !(run.o && run.o.silent)) VR.TrailerScore.onShot(g, this.shots, this.si);   // f-film2: the film's music
      const c = this.camAt(shot, this.t); g.player.pos = [c.pos[0], c.pos[1] - g.player.eye, c.pos[2]]; g.player.yaw = c.yaw; g.player.pitch = c.pitch;
    }
    if (this.phase === 'run' || this.phase === 'load') {
      const u = this.phase === 'run' ? Math.min(1, this.t / shot.dur) : 0;
      if (g.env && g.env.setTime) g.env.setTime(shot.todTo !== undefined ? shot.tod + (shot.todTo - shot.tod) * u : shot.tod);
      if (g.env) { g.env.rain = 0; g.env.rainTarget = 0; }
    }
    if (this.phase === 'run' && shot.stage === 'liberate' && !shot._freed && this.t >= TW.FREE_AT) { shot._freed = true; try { TW.free(g, shot); } catch (e) { console.warn('trailer welt', e); } }
    // the film's cuts: near-cuts between the shots (a 0.15 s dip), a slow fade from black at the start and to black at
    // the end, none at all where a shot runs on from the last (the dusk into the title)
    const fe = this.dom && this.dom.querySelector('.fade');
    if (fe) {
      if (this.phase === 'run') { const a = shot.fadeIn > 0 ? Math.min(1, this.t / shot.fadeIn) : 1, b = shot.fadeOut > 0 ? Math.min(1, Math.max(0, (shot.dur - this.t) / shot.fadeOut)) : 1; fe.style.opacity = 1 - Math.min(a, b); }
      else if (this.phase === 'load' && shot.seam) fe.style.opacity = 0;
    }
    sub(this, shot.subKey && this.capShown ? tx(shot.subKey, null, '', '') : '');
    return r;
  };
  P.stop = function () {
    const run = TW.run, was = this.active;
    const r = stop0.apply(this, arguments);
    if (was && run && !this.active) {
      const E = this.g.entities;
      if (E && E.mobs) for (const m of run.mobs) { const i = E.mobs.indexOf(m); if (i >= 0) E.mobs.splice(i, 1); }
      this.g.zenFreezeWeather = run.wx; TW.undress(this.g, run); TW.filmOff(this.g); if (VR.TrailerScore) VR.TrailerScore.stopLive(this.g);
      TW.run = null; sub(this, ''); document.body.classList.remove('r9film');
    }
    return r;
  };
  // the look of the subtitle line
  const st = document.createElement('style');
  st.textContent = '#cine .capsub{position:absolute;left:50%;bottom:calc(40% - 46px);transform:translateX(-50%);color:#fff;font-family:\'Rajdhani\',sans-serif;font-weight:600;font-size:24px;letter-spacing:.14em;white-space:nowrap;text-shadow:0 2px 10px #000,0 0 18px rgba(255,190,120,.55)}#pause .trlrow{display:flex;gap:6px}body.r9film #cine .cap{white-space:nowrap;font-size:26px}body.r9film #cine .cap.big{font-size:104px;letter-spacing:.16em;bottom:44%}body.r9film #cine .capsub{font-size:32px;bottom:calc(44% - 58px)}body.r9film #storycard,body.r9film #rpgfind{display:none!important}#pause .trlrow .btn{flex:1}body.r9film #libban{top:12%;zoom:.5}body.r9film #libban .sub{display:none}';
  document.head.appendChild(st);
  // 🎞 in the pause menu: which trailer
  const UI = VR.UI;
  if (UI && UI.prototype.pause && !UI.prototype.pause.__tw) {
    const pz0 = UI.prototype.pause;
    UI.prototype.pause = function () {
      const r = pz0.apply(this, arguments);
      try {
        const side = document.querySelector('#pause .pside'); if (side && !side.querySelector('.trlrow')) {
          const row = document.createElement('div'); row.className = 'trlrow';
          for (const [act, k, de, en] of [['trailer:old', 'g.film.btnOld', '🎞 Heartland', '🎞 Heartland'], ['trailer:welt', 'g.film.btnWelt', '🎞 Welt heute', '🎞 The world today']]) {
            const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.dataset.act = act; b.dataset.t = k; b.dataset.tt = 'g.film.btnTip';
            b.textContent = tx(k, null, de, en); b.title = tx('g.film.btnTip', null, 'Ein Trailer als kleiner Film — Esc stoppt', 'A trailer as a little film — Esc stops it');
            row.appendChild(b);
          }
          const reel = side.querySelector('[data-act="reel"]'); if (reel && reel.after) reel.after(row); else side.appendChild(row);
        }
      } catch (e) { console.warn('trailer welt', e); }
      return r;
    };
    UI.prototype.pause.__tw = true;
  }
  document.addEventListener('click', (e) => {
    const b = e.target && e.target.closest && e.target.closest('[data-act^="trailer:"]'); if (!b) return;
    const g = VR.game; if (!g || g.state !== 'play' || !g.director) return;
    e.preventDefault(); e.stopPropagation();
    const which = b.dataset.act === 'trailer:welt' ? 'welt' : 'trailer';
    if (g.ui && g.ui.resume) g.ui.resume();
    setTimeout(() => {
      const ok = which === 'welt' ? TW.ok(g) && g.director.play('welt') : g.director.play('trailer');
      if (g.ui && g.ui.toast) g.ui.toast(ok ? (which === 'welt' ? tx('g.film.cmd', null, 'Regie: „Die Welt heute“ läuft — Esc stoppt', 'Director: "The world today" is rolling — Esc stops it') : tx('g.cmd.trailer', null, 'Regie: der Trailer läuft — Esc stoppt', 'Director: rolling the trailer — Esc to stop')) : tx('g.film.no', null, 'Der Welt-Trailer läuft in einer Heartland-Welt (Weltart Standard, auf der Oberwelt).', 'The world trailer plays in a Heartland world (world type default, on the overworld).'), '', null);
    }, 60);
  }, true);
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

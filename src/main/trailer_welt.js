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
    S.push(shot('auftakt', 5, 62, 1500, 'g.film.w.c1', rel(I, [[0, [-170, 40, 150], [-20, -30, 0]], [5, [-155, 36, 135], [-18, -30, 0]]]), { fadeIn: 1.0 }));
    // 2 · the meadow: a deer mother and her fawns, a low hero angle looking up toward the isle's underside
    S.push(shot('wiese', 5, 58, 2200, 'g.film.w.c2', rel(M, [[0, [-5, 1.7, 7.5], [1, 2.5, -2]], [5, [-3.4, 1.6, 5.2], [1.6, 2.8, -3]]]), { stage: 'family', anchor: M.slice() }));
    // 3 · the village's life on its plaza (or, in a world without one near, the land)
    if (A.village) S.push(shot('dorf', 5, 60, 4200, 'g.film.w.c3', rel(A.village, [[0, [13, 3.4, 9], [0, 2.6, 0]], [5, [9.5, 3.0, 6.5], [-1, 2.6, -1]]]), { stage: 'village', anchor: A.village.slice() }));
    else { const L = add(M, [-60, 0, 30]); S.push(shot('land', 5, 60, 4200, 'g.film.w.c3b', rel(L, [[0, [14, 8, 12], [0, 3, 0]], [5, [10, 7, 9], [0, 3, 0]]]), { anchor: L })); }
    // 4 · a Flausel at the fairy tree in the golden light (or the meadow's edge)
    if (A.fairy) S.push(shot('flausel', 4.5, 55, 10400, 'g.film.w.c4', rel(A.fairy, [[0, [14, 4.5, 12], [0, 3.5, 0]], [4.5, [9, 3.4, 8], [0, 3.2, 0]]]), { stage: 'fairy', anchor: A.fairy.slice() }));
    else { const L = add(M, [30, 0, 60]); S.push(shot('pfad', 4.5, 55, 10400, 'g.film.w.c4b', rel(L, [[0, [12, 3, 10], [0, 2, 0]], [4.5, [8, 2.4, 7], [0, 2, 0]]]), { anchor: L })); }
    // 5 · the reveal: the camera rises from behind the hill, the isles appear; a freighter crosses in front of them
    S.push(shot('inseln', 5.5, 66, 7600, 'g.film.w.c5', rel(I, [[0, [-140, -58, 40], [0, 5, 0]], [5.5, [-128, -30, 34], [0, 0, 0]]]),
      { ships: [{ arch: 'freighter', A: add(I, [-80, 30, -120]), C: add(I, [0, 24, -10]), B: add(I, [90, 18, 110]), dur: 8, delay: 0 }] }));
    // 6 · the ferry: a shuttle over your head, away toward the isles
    S.push(shot('faehre', 4.5, 64, 8800, 'g.film.w.c6', rel(M, [[0, [-2, 1.6, 18], [14, 26, -40]], [4.5, [-2, 2.4, 15], [16, 30, -46]]]),
      { anchor: M.slice(), ships: [{ arch: 'shuttle', A: add(M, [-6, 9, 40]), C: add(M, [6, 16, -6]), B: add(M, [30, 46, -80]), dur: 5, delay: 0 }] }));
    // 7 · an outpost freed: the Leuchtfeuer turns cyan, the beam, the ring of light, ✦ BEFREIT ✦ (or a golden ride)
    const B = A.beacon || (A.outpost ? add(A.outpost, [0, 1, 0]) : null);
    if (B) S.push(shot('befreit', 6, 60, 9800, 'g.film.w.c7', rel(B, [[0, [17, 6, 13], [0, 3.5, 0]], [6, [12, 4.5, 9], [0, 4.5, 0]]]), { stage: 'liberate', anchor: B.slice(), site: A.outpost ? Math.round(A.outpost[0]) + '_' + Math.round(A.outpost[2]) : null }));
    else { const L = add(M, [-30, 0, -70]); S.push(shot('weite', 6, 60, 9800, 'g.film.w.c7b', rel(L, [[0, [20, 12, 16], [0, 4, 0]], [6, [14, 10, 12], [0, 4, 0]]]), { anchor: L })); }
    // 8 · the sun goes down: the sky turns from gold to night, the stars come out over the isles
    S.push(shot('abend', 6, 64, 11000, 'g.film.w.c8', rel(I, [[0, [-150, -18, 110], [0, 0, 0]], [6, [-142, -15, 102], [0, 2, 0]]]), { todTo: 15200, fadeOut: 0 }));
    // 9 · the title over the night sky: the camera tilts up from the isles into the stars
    S.push(shot('titel', 5, 66, 15200, 'g.film.w.title', rel(I, [[0, [-142, -15, 102], [0, 2, 0]], [5, [-138, -12, 98], [0, 90, -60]]]), { todTo: 16500, caption: 'R9-SI', big: true, capSmall: false, capAt: 1.0, subKey: 'g.film.w.sub', fadeIn: 0, fadeOut: 1.0, seam: true }));
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
  TW.clearAngle = function (solid, T, a0, r0, r1, h0, h1, lh, n) {
    n = n || 12; let best = a0, bs = 1e9;
    for (let i = 0; i < n; i++) {
      const a = a0 + i * Math.PI * 2 / n; let hits = 0;
      for (const [r, h] of [[r0, h0], [r1, h1]]) {
        const C = [T[0] + Math.sin(a) * r, T[1] + h, T[2] + Math.cos(a) * r];
        for (let k = 1; k < 20; k++) { const u = k / 20; if (solid(C[0] + (T[0] - C[0]) * u, C[1] + (T[1] + lh - C[1]) * u, C[2] + (T[2] - C[2]) * u)) hits++; }
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
      TW.run = { A, mobs: [], stage: !!(o && o.stage), wx: g.zenFreezeWeather, si: -1 };
      g.zenFreezeWeather = true; document.body.classList.add('r9film');
      if (!play0.call(dir, shots, o)) { g.zenFreezeWeather = TW.run.wx; TW.run = null; }
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
      const m = TW.findMeadow(top, isGrass, shot.anchor, 72); if (m) TW.reanchor(shot, m);
    }
    else if (shot.anchor) { const gy = top(shot.anchor[0], shot.anchor[2]); if (Number.isFinite(gy) && gy > 0) TW.reanchor(shot, [shot.anchor[0], gy, shot.anchor[2]]); }
    // the fairy tree and the outpost: circle to the side whose sight line is clear (a train, a wall, a hill in front)
    if (shot.stage === 'fairy' || shot.stage === 'liberate') {
      const T = shot.anchor, k0 = shot.keys[0], k1 = shot.keys[shot.keys.length - 1];
      const r0 = Math.hypot(k0[1][0] - T[0], k0[1][2] - T[2]), r1 = Math.hypot(k1[1][0] - T[0], k1[1][2] - T[2]);
      const h0 = k0[1][1] - T[1], h1 = k1[1][1] - T[1], l0 = k0[2][1] - T[1], l1 = k1[2][1] - T[1];
      const a0 = Math.atan2(k0[1][0] - T[0], k0[1][2] - T[2]);
      const a = TW.clearAngle(solid, T, a0, r0, r1, h0, h1, (l0 + l1) / 2, 12);
      shot.keys = TW.orbitKeys(T, a, shot.dur, r0, r1, h0, h1, l0, l1, 0.12);
    }
    TW.resolve(shot, top, 1.8);
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
    const shot = this.shots[this.si]; if (!shot) return r;
    if (this.phase === 'run' && (ph0 !== 'run' || si0 !== this.si) && !shot._ready) {
      shot._ready = true;
      try { TW.ready(g, this, shot); } catch (e) { console.warn('trailer welt', e); }
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
      this.g.zenFreezeWeather = run.wx; TW.run = null; sub(this, ''); document.body.classList.remove('r9film');
    }
    return r;
  };
  // the look of the subtitle line
  const st = document.createElement('style');
  st.textContent = '#cine .capsub{position:absolute;left:50%;bottom:calc(40% - 46px);transform:translateX(-50%);color:#fff;font-family:\'Rajdhani\',sans-serif;font-weight:600;font-size:24px;letter-spacing:.14em;white-space:nowrap;text-shadow:0 2px 10px #000,0 0 18px rgba(255,190,120,.55)}#pause .trlrow{display:flex;gap:6px}body.r9film #cine .cap{white-space:nowrap}body.r9film #storycard{display:none!important}#pause .trlrow .btn{flex:1}';
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

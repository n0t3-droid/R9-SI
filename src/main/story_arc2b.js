// ============================================================================
// a-story8 · Arc 2's beauty (plan docs/superpowers/plans/2026-11-01-a-story8.md) — after story_arc2.js, additive:
//   · the Dreilichterfest's people: while c16.b1 / c16.b2 play, the festival is staged at its own gathering spot (the
//     celebrating village's plaza, else your settlement's): families dancing in a ring (u-folk3's ring pose, hands
//     joined, the ring turning), children with lanterns walking round them the other way, Flausel hopping in the
//     middle and Flausel lights drifting among them; the lanterns and the lights flare three times together (her
//     greeting, VR.StoryFx.blink3). Where the village's own dancers hold the plaza, our ring stands round theirs. The
//     scenes' home target aims at the ring's middle.
//   · Wiegelinds Ruh: Wiegelind resting over the stone circle's altar (fy_wiege, fairy_models.js), breathing, turned
//     slowly to her visitor, a soft lilac halo (Low and up) — there whenever you come back. Wiegelinds Saatwiese: the
//     far Flausel settled visibly (Sämli and two more, their little houses, a lamp, glow seeds).
//   · Funke's close-ups (ch. 13–16): from in front at his eye height, the player behind; he turns to the camera; a warm
//     rim light behind his shoulder; his own light lifted in a scene. On a far world at night (ch. 14) a lantern-warm
//     haze over the scene's target.
// Very Low: fewer people (6 + 2), one Flausel, four lights; no halo at her place. Outside a scene only her place's
// model (one draw, only near it) and its halo (two glow draws, Low and up). Switch: „Lichter der Geschichte"
// (storyLights) for every glow here; the folk with the scene.
// ============================================================================
(function (VR) {
  'use strict';
  const P = VR.StoryPlay, A2 = VR.StoryArc2; if (!P || !P.Player || !A2 || A2._b) return;
  A2._b = true;
  const B = VR.StoryArc2b = { stats: { stage: 0, folk: 0, glows: 0, wiege: 0, rim: 0, ms: 0, draws: 0 }, off: false };   // (off: the measurement's switch)
  const TAU = Math.PI * 2, DEG = Math.PI / 180;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const smooth = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  const fr = (x) => x - Math.floor(x);
  const hs = (i, k) => fr(Math.sin(i * 127.1 + k * 311.7) * 43758.5453);
  const Pr = P.Player.prototype;
  const pl = (g) => { g = g || VR.game; const s = g && g.story; return s && s.world === g.world ? s : null; };
  const lowOf = (g) => !!(g && g.settings && g.settings.preset === 'potato');
  const blink = (t, off) => (VR.StoryFx && VR.StoryFx.blink3 ? VR.StoryFx.blink3(t, off) : 0);

  // ---------------------------------------------------------------- pure: the festival's cast and its ring
  B.N = (low) => (low ? { ring: 6, kids: 2, flausel: 1, lights: 4 } : { ring: 10, kids: 4, flausel: 3, lights: 8 });
  B.CHORD = 1.4;   // m between two dancers' middles (u-folk3: the hands meet)
  B.ringR = (n) => clamp(B.CHORD / (2 * Math.sin(Math.PI / Math.max(3, n))), 1.2, 3.2);
  B.W = 0.3;       // rad/s: the ring's turn; the children walk the other way
  // the cast: couples and their children (fam: which family), each a look's seed
  B.cast = function (seed, low) {
    const N = B.N(low), out = [];
    for (let i = 0; i < N.ring; i++) out.push({ role: 'ring', i, fam: i >> 1, kid: false, seed: ((seed | 0) * 31 + 0x1f35 + i * 7919) >>> 0 });
    for (let j = 0; j < N.kids; j++) out.push({ role: 'kid', i: j, fam: j % Math.max(1, N.ring >> 1), kid: true, seed: ((seed | 0) * 31 + 0x2c41 + j * 104729) >>> 0 });
    return out;
  };
  // where one stands at time t: [x, z, yaw] — the ring faces its middle; the children walk outside it, facing the way
  B.at = function (q, n, C, r, t, out) {
    out = out || [0, 0, 0];
    if (q.role === 'ring') {
      const th = q.i / n * TAU + t * B.W, x = C[0] + Math.cos(th) * r, z = C[2] + Math.sin(th) * r;
      out[0] = x; out[1] = z; out[2] = Math.atan2(-(C[0] - x), -(C[2] - z));
    } else {
      const rk = r + 1.7, th = q.i / n * TAU + 0.4 - t * B.W * 0.8, x = C[0] + Math.cos(th) * rk, z = C[2] + Math.sin(th) * rk;
      out[0] = x; out[1] = z; out[2] = Math.atan2(-Math.sin(th), Math.cos(th));   // (the way: dθ < 0 → (sin θ, −cos θ))
    }
    return out;
  };
  // a ring of radius r round (cx, cz) is open: 16 points on it (and 0.35 m either side)
  B.ringOpen = function (open, cx, cz, r) { for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; for (const rr of [r - 0.35, r + 0.35]) if (!open(cx + Math.cos(a) * rr, cz + Math.sin(a) * rr)) return false; } return true; };
  // the middle: the plaza's own first, then outward (1.5 … 6 m)
  B.centre = function (open, cx, cz, r) {
    if (B.ringOpen(open, cx, cz, r)) return [cx, cz, true];
    for (const st of [1.5, 3, 4.5, 6]) for (let k = 0; k < 8; k++) { const a = k / 8 * TAU, x = cx + Math.cos(a) * st, z = cz + Math.sin(a) * st; if (B.ringOpen(open, x, z, r)) return [x, z, true]; }
    return [cx, cz, false];
  };
  // the glows of the festival at time t: the children's lanterns, the Flausel lights, the warm air over the ring
  B.festGlows = function (F, t, low, out) {
    out = out || [];
    const C = F.c, N = F.n, k3 = blink(t), P0 = F._p || (F._p = [0, 0, 0]);
    for (const q of F.cast) {
      if (q.role !== 'kid') continue;
      const a = B.at(q, N.kids, C, F.r, t, P0), fx = -Math.sin(a[2]), fz = -Math.cos(a[2]);
      out.push({ p: [a[0] + fx * 0.5, C[1] + 0.85, a[1] + fz * 0.5], s: [0.75, 0.75], col: [1.0, 0.66, 0.3], a: 0.55 + 0.5 * k3, kind: 0 });
    }
    const COL = [[0.75, 1.0, 0.5], [1.0, 0.85, 0.45], [0.6, 0.9, 1.0]];
    for (let k = 0; k < N.lights; k++) {
      const a = k / N.lights * TAU + t * 0.22 * (k & 1 ? 1 : -1), rr = F.r * (0.35 + 0.9 * hs(k, 2)), y = C[1] + 1.7 + 1.3 * hs(k, 3) + 0.3 * Math.sin(t * 0.9 + k);
      out.push({ p: [C[0] + Math.cos(a) * rr, y, C[2] + Math.sin(a) * rr], s: [0.32, 0.32], col: COL[k % 3], a: 0.6 + 0.4 * blink(t, k * 0.07), kind: 0 });
    }
    out.push({ p: [C[0], C[1] + 1.4, C[2]], s: [F.r + 4, (F.r + 4) * 0.6], col: [1.0, 0.6, 0.32], a: 0.1 + 0.05 * k3, kind: 0 });
    return out;
  };
  // Wiegelind's breath: 5.5 s in and out — her size, her glow
  B.breath = (t) => { const s = Math.sin(t * TAU / 5.5); return { s: 1 + 0.035 * s, a: 0.6 + 0.25 * s, bob: 0.06 * Math.sin(t * TAU / 11) }; };
  // Funke's close camera: from in front of him (the scene's forward f), a little to the side, at his eye height
  B.closeCam = function (Q, f, d, u) {
    const rt = [-f[2], 0, f[0]], D = d * (1 - 0.12 * smooth(u));
    return { C: [Q[0] + f[0] * D * 0.92 + rt[0] * D * 0.4, Q[1] + 0.06 * D, Q[2] + f[2] * D * 0.92 + rt[2] * D * 0.4], L: [Q[0], Q[1] - 0.02 * D, Q[2]] };
  };
  const closeFunke = (sc) => { if (!sc || !sc.b || sc.b.ch < 13) return false; const at = VR.Story.shotAt(sc.b, sc.t); return !!(at && at.shot.cam === 'close' && at.shot.target === 'funke'); };
  B.closeFunke = closeFunke;

  // ---------------------------------------------------------------- the festival's gathering spot
  B.FEST = { 'c16.b1': 1, 'c16.b2': 1 };
  B.spot = function (g) {
    const V = g.villages, p = g.player && g.player.pos; if (!p) return null;
    let best = null, bd = 260;
    if (V && V.known) for (const vil of V.known.values()) {
      const pz = vil && vil.active && vil.plan && vil.plan.plaza; if (!pz) continue;
      const d = Math.hypot(pz.x - p[0], pz.z - p[2]); if (d >= bd) continue;
      let on = true; try { on = !V.festivalDay || !!V.festivalDay(vil); } catch (e) { on = true; }
      if (on) { bd = d; best = { x: pz.x + 0.5, y: pz.y, z: pz.z + 0.5, r: pz.r || 4, vil }; }
    }
    if (best) return best;
    const own = A2.ownHome && A2.ownHome(g); if (own && own.d < 320) return { x: own.at.x + 0.5, y: own.at.y, z: own.at.z + 0.5, r: 4, vil: null };
    return null;
  };
  B.stage = function (g, sc) {
    const sp = B.spot(g); if (!sp) return null;
    const low = lowOf(g), N = B.N(low);
    const y0 = (sc.ground && sc.ground(sp.x, sp.z)) || sp.y || g.player.pos[1];
    const open = (x, z) => { if (!sc.ground) return true; const gy = sc.ground(x, z); if (gy === null || gy === undefined || Math.abs(gy - y0) > 1.5) return false; return !sc.free || (sc.free([x, gy + 0.5, z]) && sc.free([x, gy + 1.6, z])); };
    let real = 0; if (sp.vil && sp.vil.agents) for (const a of sp.vil.agents) if (a.festRole === 'dance' && a.pos && Math.hypot(a.pos[0] - sp.x, a.pos[2] - sp.z) < sp.r + 5) real++;
    let r = B.ringR(N.ring), C;
    if (real >= 4) {   // the village's own ring holds the plaza: ours beside it (hands joined), else round it (cheering)
      const keep = sp.r + 1.2 + r, open2 = (x, z) => Math.hypot(x - sp.x, z - sp.z) > sp.r + 1.4 && open(x, z);
      C = null;
      for (const st of [keep, keep + 1.5, keep + 3]) { for (let k = 0; k < 12 && !C; k++) { const a = k / 12 * TAU, x = sp.x + Math.cos(a) * st, z = sp.z + Math.sin(a) * st; if (B.ringOpen(open2, x, z, r)) C = [x, z, true]; } if (C) break; }
      if (!C) { r = Math.max(r, sp.r + 2.6); C = [sp.x, sp.z, true]; }
    } else C = B.centre(open, sp.x, sp.z, r);
    const cy = (sc.ground && sc.ground(C[0], C[1])) || y0;
    const F = { c: [C[0], cy, C[1]], r, n: N, real, open: C[2], mid: open(C[0], C[1]), cast: B.cast(((g.meta && g.meta.seed) | 0) ^ Math.round(sp.x * 13 + sp.z * 7), low), folk: [] };
    const Lk = VR.LifeKit;
    if (Lk && Lk.folk) for (const q of F.cast) { const look = Lk.folk(q.seed, 'farmer', q.kid ? 'child' : 'adult'); if (look) F.folk.push({ q, look, pos: [F.c[0], cy, F.c[2]], yaw: 0, state: 'idle', walk: 0, walkAmt: 0, seed: (q.seed % 97) / 97, kid: q.kid }); }
    B.stats.stage++;
    return F;
  };
  const res0 = A2.resolve;
  A2.resolve = function (g, sc) {
    res0.apply(this, arguments);
    if (!B.FEST[sc.b.id] || (g.dim || 'overworld') !== 'overworld') return;
    try { const F = sc.fest = B.stage(g, sc); if (F) sc.tg.home = [F.c[0], F.c[1] + 2, F.c[2]]; } catch (e) { sc.fest = null; }
  };

  // the new place where fairy.js settled it (its spiral moves a place off a road or a town): the scenes look there
  const place0 = A2.place;
  A2.place = function (g) {
    const pc = place0.apply(this, arguments), st = VR.Fairy && VR.Fairy.state; if (!pc || !st || !st.sites) return pc;
    const s = st.sites.find((q) => q.id === 'overworld:wiege' && q.y !== null && q.y !== undefined);
    return s && String(st.key || '').split('|')[0] === pc.dim ? Object.assign({}, pc, { x: s.x, z: s.z, y: s.y }) : pc;
  };

  // ---------------------------------------------------------------- drawing the festival's people
  const MPF = { scale: 1, pose: null, shade: 0, noShade: true }, FPOSE = [];
  const P0 = [0, 0, 0];
  B.drawFest = function (g, r, E, cam, sc) {
    const F = sc.fest; if (!F || !F.folk.length || !g.entities || !VR.LifeKit) return 0;
    const Lk = VR.LifeKit, F3 = VR.Folk3, t = sc.t, prog = g.entities.beginVox(r, E), N = F.n; let n = 0;
    const ph = t * Math.PI / 0.6, chord = 2 * F.r * Math.sin(Math.PI / N.ring);
    for (const a of F.folk) {
      const q = a.q, at = B.at(q, q.role === 'ring' ? N.ring : N.kids, F.c, F.r, t, P0);
      const gy = sc.ground ? sc.ground(at[0], at[1]) : null;
      a.pos[0] = at[0]; a.pos[2] = at[1]; a.pos[1] = (gy !== null && gy !== undefined && Math.abs(gy - F.c[1]) < 2 ? gy : F.c[1]) + (q.role === 'ring' ? Math.abs(Math.sin(ph)) * 0.035 : 0);
      a.yaw = at[2];
      if (q.role === 'ring' && chord > 2.1) { a.walkAmt = 0; a.posefx = null; a.state = q.i % 3 === 1 ? 'wave' : 'cheer'; }   // (a ring round theirs: too wide for joined hands)
      else if (q.role === 'ring') { a.walkAmt = 0; a.state = 'idle'; a.posefx = a.ringFx || (a.ringFx = (Pz) => { if (F3 && F3.ringPose) F3.ringPose(Pz, 1, B._ph, B._chord, a.kid); }); }
      else { a.walk = (F.r + 1.7) * B.W * 0.8 * t; a.walkAmt = 0.55; a.posefx = a.posefx || ((Pz) => { if (Pz.arm_r) { Pz.arm_r[0] = 1.15; Pz.arm_r[2] = 0.08; } if (Pz.fore_r) Pz.fore_r[0] = 0.35; }); }
      B._ph = ph; B._chord = chord; a.talking = false;
      if (Lk.drawFolk(g, r, prog, a, cam, g.time || 0)) n++;
      if (q.role === 'kid') { const fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw); const lp = a.lp || (a.lp = [0, 0, 0]); lp[0] = a.pos[0] + fx * 0.5; lp[1] = a.pos[1] + 0.7 + Math.sin(t * 3 + q.i) * 0.02; lp[2] = a.pos[2] + fz * 0.5; MPF.scale = 0.42; MPF.pose = null; if (Lk.drawModel(g, r, prog, 'fy_lantern', lp, a.yaw + Math.sin(t * 2 + q.i) * 0.2, cam, MPF)) n++; }
    }
    // the Flausel hopping in the middle (round it when something stands there)
    for (let k = 0; k < N.flausel; k++) {
      const rr = F.mid ? 0.9 : F.r + 0.8, a = k / Math.max(1, N.flausel) * TAU + t * 0.8, x = F.c[0] + Math.cos(a) * rr, z = F.c[2] + Math.sin(a) * rr;
      const pz = FPOSE[k] || (FPOSE[k] = { pos: [0, 0, 0], pose: { wing_l: [0, 0, 0], wing_r: [0, 0, 0] } }), w = Math.sin(t * 14 + k) * 0.55;
      pz.pos[0] = x; pz.pos[1] = F.c[1] + Math.abs(Math.sin(t * 4 + k * 1.3)) * 0.3; pz.pos[2] = z; pz.pose.wing_l[1] = 0.4 + w; pz.pose.wing_r[1] = -0.4 - w;
      MPF.scale = 0.95; MPF.pose = pz.pose;
      if (Lk.drawModel(g, r, prog, 'fy_sprite_' + ((k * 2) % 5), pz.pos, a + Math.PI, cam, MPF)) n++;
      MPF.pose = null;
    }
    B.stats.folk += n;
    return n;
  };
  const ds0 = P.drawStory5;
  P.drawStory5 = function (g, r, E, cam) {
    const s = pl(g), sc = s && s.scene;
    if (sc && sc.fest && !B.off) { const t0 = performance.now(); try { B.drawFest(g, r, E, cam, sc); } catch (e) { if (!B.warned) { B.warned = true; console.warn('story fest', e); } } B.stats.ms = (B.stats.ms || 0) + performance.now() - t0; B.stats.draws = (B.stats.draws || 0) + 1; }
    return ds0 ? ds0.apply(this, arguments) : undefined;
  };

  // ---------------------------------------------------------------- the glows: the festival's lights, Funke's rim, the far night
  const gl0 = P.glowList;
  P.glowList = function (g, sc) {
    const out = gl0 ? gl0.apply(this, arguments) : [];
    if (!sc || !sc.b || sc.b.ch < 13 || B.off) return out;
    const low = lowOf(g), n0 = out.length;
    if (sc.fest) B.festGlows(sc.fest, sc.t, low, out);
    const fk = g.funke, cam = g.cam;
    if (closeFunke(sc) && fk && fk.pos && cam) {   // a warm rim: a soft light just behind him, as the camera sees it
      const v = [fk.pos[0] - cam.x, fk.pos[1] - cam.y, fk.pos[2] - cam.z], L = Math.hypot(v[0], v[1], v[2]) || 1;
      out.push({ p: [fk.pos[0] + v[0] / L * 0.3, fk.pos[1] + 0.1, fk.pos[2] + v[2] / L * 0.3], s: [0.45, 0.45], col: [1.0, 0.72, 0.42], a: 0.34, kind: 0 });
      out.push({ p: [fk.pos[0] + v[0] / L * 0.35, fk.pos[1] + 0.05, fk.pos[2] + v[2] / L * 0.35], s: [1.2, 0.9], col: [0.9, 0.55, 0.35], a: 0.1, kind: 0 });
      B.stats.rim++;
    }
    const E = g.env, dim = g.dim || 'overworld';
    if (sc.b.ch === 14 && dim !== 'overworld' && !/^stn\./.test(dim) && E && (E.night || 0) > 0.5) {   // a far world's night: lantern-warm air over the target
      const Q = sc.tg.fairy && sc.b.id === 'c14.b3' ? sc.tg.fairy : sc.tg.village;
      if (Q) { out.push({ p: [Q[0], Q[1] + 1, Q[2]], s: [16, 10], col: [1.0, 0.62, 0.36], a: 0.14, kind: 0 }); if (!low) out.push({ p: [Q[0], Q[1] + 0.5, Q[2]], s: [5, 4], col: [1.0, 0.8, 0.55], a: 0.22, kind: 0 }); }
    }
    B.stats.glows += out.length - n0;
    return out;
  };

  // ---------------------------------------------------------------- the close camera on Funke
  const pose00 = Pr.pose0;
  Pr.pose0 = function (sc, sh, u, base) {
    if (sc.b.ch >= 13 && sh.cam === 'close' && sh.target === 'funke' && sc.fwd) {
      const Q = this.target(sc, 'funke'), K = B.closeCam(Q, sc.fwd, 2.1, u);
      const C = VR.DirCam && VR.DirCam.lift ? VR.DirCam.lift(sc.ground, K.C, Q) : K.C, L = K.L;
      if (!sc.free || sc.free(C)) {
        const dx = L[0] - C[0], dy = L[1] - C[1], dz = L[2] - C[2];
        return Object.assign({}, base, { x: C[0], y: C[1], z: C[2], yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)), roll: 0, fov: 50 * DEG, fixed: true });
      }
    }
    return pose00.apply(this, arguments);
  };
  { const Fk = VR.Funke; if (Fk && Fk.Actor && !Fk._a8) { Fk._a8 = true; const AP = Fk.Actor.prototype;
    // (f-first3 hides him in the view's centre third nearer than 2.25 m — right where a close-up wants him)
    const ia0 = Fk.inAim; if (ia0) Fk.inAim = function () { const s = pl(), sc = s && s.scene; if (closeFunke(sc)) return false; return ia0.apply(this, arguments); };
    const ly0 = AP.lookYaw; if (ly0) AP.lookYaw = function (T) { const s = pl(this.g), sc = s && s.scene, cam = this.g.cam; if (cam && closeFunke(sc)) return Math.atan2(-(cam.x - this.pos[0]), -(cam.z - this.pos[2])); return ly0.apply(this, arguments); };
    const rl0 = AP.relight; if (rl0) AP.relight = function () { const r = rl0.apply(this, arguments); const s = pl(this.g), sc = s && s.scene, L = this.light; if (sc && sc.b && sc.b.ch >= 13 && L && L.bl) { L.sky = Math.max(L.sky, 0.7); L.bl[0] = Math.max(L.bl[0], 0.85); L.bl[1] = Math.max(L.bl[1], 0.72); L.bl[2] = Math.max(L.bl[2], 0.62); } return r; };
  } }

  // ---------------------------------------------------------------- Wiegelinds Ruh, Wiegelinds Saatwiese (fairy.js's places)
  B.FAR_FOLK = [['saemli', 2, 0.5, 3.2], ['fern0', 4, 2.6, 4.2], ['fern1', 1, 4.4, 3.6]];   // [who, look, angle, m from the middle]
  // what a story place gets: [{m, pos, yaw, o}] parts and [{who, ...}] folk (pure: gy(x, z) the ground)
  B.extra = function (s, gy) {
    const parts = [], folk = [], off = (a, r) => [s.x + Math.cos((s.yaw || 0) + a) * r, s.z + Math.sin((s.yaw || 0) + a) * r];
    if (s.kind === 'circle') {
      const al = s.parts && s.parts.find((q) => q.m === 'fy_altar'), y = al ? al.pos[1] + 0.95 : gy(s.x, s.z) + 0.85;
      parts.push({ m: 'fy_wiege', pos: [s.x, y, s.z], yaw: s.yaw || 0, o: { scale: 1, wiege: 1, y0: y } });
    } else if (s.kind === 'shroom') {
      for (const [who, v, a, r] of B.FAR_FOLK) { const [x, z] = off(a, r), p = [x, gy(x, z) + 0.1, z]; folk.push({ who, mood: 'busy', v, pos: p.slice(), home: p.slice(), yaw: 0, t: a * 3, sx: 0 }); }
      for (let i = 0; i < 3; i++) { const a = 0.9 + i * 1.9, [x, z] = off(a, 8.5); parts.push({ m: 'fy_house_' + i, pos: [x, gy(x, z) - 0.05, z], yaw: Math.atan2(Math.cos((s.yaw || 0) + a), Math.sin((s.yaw || 0) + a)) + Math.PI, o: { lite: i !== 1 } }); }
      { const [x, z] = off(2.2, 6.4); parts.push({ m: 'fy_lamp', pos: [x, gy(x, z), z], yaw: 0, o: { lite: true } }); }
      for (let i = 0; i < 3; i++) { const [x, z] = off(4.0 + i * 0.5, 2.6 + i * 0.6); parts.push({ m: 'fy_seed', pos: [x, gy(x, z) + 0.6, z], yaw: i, o: { scale: 1.6, lite: i === 0, seed: 1, y0: gy(x, z) + 0.6 } }); }
    }
    return { parts, folk };
  };
  { const F = VR.Fairy; if (F && F.frame && !F._a8) { F._a8 = true;
    const fr0 = F.frame;
    F.frame = function (g, dt) {
      const r = fr0.apply(this, arguments), st = F.state, s = st && st.near;
      if (!s || !s.story || !s.parts || !g || !g.world) return r;
      try {
        if (!s.parts._a8) {
          const w = g.world, gy = (x, z) => { const X = Math.floor(x), Z = Math.floor(z); return w.isLoaded && w.isLoaded(X, Z) && w.topAt ? w.topAt(X, Z) + 1 : (s.y || 64); };
          const ex = B.extra(s, gy); for (const q of ex.parts) s.parts.push(q); for (const f of ex.folk) s.folk.push(f);
          s.parts._a8 = true; B.stats.wiege++;
        }
        const t = st.t || 0, br = B.breath(t), p = g.player && g.player.pos;
        for (const q of s.parts) {
          if (q.o.wiege) {
            q.o.scale = br.s; q.pos[1] = q.o.y0 + br.bob;
            if (p) { const want = Math.atan2(-(p[0] - q.pos[0]), -(p[2] - q.pos[2])); let d = want - q.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); q.yaw += clamp(d, -dt * 0.35, dt * 0.35); }
          } else if (q.o.seed) q.pos[1] = q.o.y0 + Math.sin(t * 1.3 + q.yaw) * 0.12;
        }
      } catch (e) { /* a nicety */ }
      return r;
    };
    // her halo (Low and up, the switches of the wonders' glows and the story's lights): two soft glows, breathing
    const dr0 = F.draw, HL = [{ p: [0, 0, 0], s: [2.6, 2.6], col: [0.72, 0.58, 1.2], a: 0, kind: 0 }, { p: [0, 0, 0], s: [1.1, 1.1], col: [1.1, 1.0, 1.15], a: 0, kind: 0 }];
    F.draw = function (g, r, E, cam) {
      const out = dr0.apply(this, arguments), st = F.state, s = st && st.near;
      if (!s || !s.story || s.kind !== 'circle' || !s.parts || !s.parts._a8 || lowOf(g) || !VR.StoryGlow || !VR.StoryGlow.ok || !VR.StoryGlow.ok()) return out;
      const se = g.settings || {}; if (se.wonderGlow === false || se.storyLights === false || se.fairy === false) return out;
      const q = s.parts.find((x) => x.o.wiege), c = cam || r.cam; if (!q || !c) return out;
      if (Math.hypot(q.pos[0] - c.x, q.pos[2] - c.z) > 120) return out;
      const night = clamp(((E && E.night) || (g.env && g.env.night) || 0), 0, 1), br = B.breath(st.t || 0);
      for (const h of HL) { h.p[0] = q.pos[0]; h.p[1] = q.pos[1] + 0.95; h.p[2] = q.pos[2]; }
      HL[0].a = (0.25 + 0.45 * night) * br.a; HL[1].a = (0.2 + 0.4 * night) * br.a;
      try { VR.StoryGlow.draw(r, c, HL); } catch (e) { /* a nicety */ }
      return out;
    };
  } }
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

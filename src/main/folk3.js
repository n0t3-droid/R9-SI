// ============================================================================
// u-folk3 · VR.Folk3 — the inhabitants as lovely on screen as in code (plan docs/superpowers/plans/2026-11-01-u-folk3.md)
//   · the camera director: a frame for a face (3–5 m, the front first, the sun's side at the golden hour) or a group,
//     never inside a wall — a clear line from the face, open space round the lens, pulled back where it is narrow.
//     The 📷 photo mode's H frames the nearest face (H again: the next one); the tests frame their pictures with it.
//   · the circle dance (folkjoy.js's invitation): a ring sized by the hands' reach on open ground (off a monument, off a
//     wall), the members walk in from round the plaza and then move with the ring — facing the middle, hands joined,
//     a sway and a side step on the band's beat (the village band plays while it lasts), ♪ over every second dancer.
//     The fix: natives.js's „make room" (its openTalk, after folkjoy's) sent the dancers 8 m away — 1 of 6 danced.
//   · the far face: from 6 m the smooth head's faceFar part (folkmodel.js fineFace: big simple eyes, a smile) shows;
//     the voxel people's far LOD keeps its eyes (folkmodel.js lodEyes — the same model, no cost on Very Low)
//   · the moods over a day: sleepy at dawn (lids half down, a yawn), cheerful at noon (smiles come often), cosy at dusk;
//     the children's play shows in the body: the seeker's hands over the eyes, the tagger reaching, skipping with a rope's
//     arms. Low and up (Very Low: nothing per frame, no new draw).
// Pure parts (node: test/folk3.js): clearAt · lineFirst · frame · frameGroup · ringR · danceRing · ringPose · mood ·
// farFace · TEXT_KEYS. Cost: the director runs on a key press; the dance's ring once at its start (≤ 4 400 cell tests);
// the moods 2× a second over the people within 30 m (Low and up).
// ============================================================================
(function (VR) {
  'use strict';
  const F3 = VR.Folk3 = {};
  const TAU = Math.PI * 2, clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const tx = (k, v, de, en) => (VR.I18N && VR.I18N.tx ? VR.I18N.tx(k, v, de, en) : de);
  F3.TEXT_KEYS = ['g.photo.portrait', 'g.photo.noFace', 'g.photo.more3'];

  // ---------------------------------------------------------------- the camera director
  // solid(x, y, z) on world coordinates (floats; a block's cell). The lens needs r of open space all round
  F3.LENS = 0.45;
  const SPH = []; for (let i = 0; i < 14; i++) { const a = (i % 7) / 7 * TAU, e = i < 7 ? 0.55 : -0.55; SPH.push([Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)]); }
  SPH.push([0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]);
  F3.clearAt = function (solid, x, y, z, r) {
    if (solid(x, y, z)) return false;
    r = r || F3.LENS;
    for (const s of SPH) if (solid(x + s[0] * r, y + s[1] * r, z + s[2] * r)) return false;
    return true;
  };
  // the first solid along A → B (from 0.25 on, every 8 cm), or Infinity
  F3.lineFirst = function (solid, A, B) {
    const dx = B[0] - A[0], dy = B[1] - A[1], dz = B[2] - A[2], L = Math.hypot(dx, dy, dz) || 1;
    for (let s = 0.25; s <= L; s += 0.08) if (solid(A[0] + dx * s / L, A[1] + dy * s / L, A[2] + dz * s / L)) return s;
    return Infinity;
  };
  const look = (P, T) => { const dx = T[0] - P[0], dy = T[1] - P[1], dz = T[2] - P[2]; return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) }; };
  // the best place on rays from T (angles a, rises h): the farthest open spot up to dMax that the line reaches, ≥ dMin
  function best(solid, T, rays, o) {
    let win = null;
    for (const [a, h, pen] of rays) {
      const u = [Math.cos(a), 0, Math.sin(a)];
      for (const dMin of o.mins) {
        const far = [T[0] + u[0] * (o.dMax + 0.6), T[1] + h * (o.dMax + 0.6) / o.d, T[2] + u[2] * (o.dMax + 0.6)];
        const hit = F3.lineFirst(solid, T, far), full = Math.hypot(o.dMax + 0.6, h * (o.dMax + 0.6) / o.d);
        let d = Math.min(o.d, o.dMax, (Math.min(hit, full) - 0.6) * (o.dMax + 0.6) / full);
        let P = null;
        for (; d >= dMin; d -= 0.2) {
          const q = [T[0] + u[0] * d, T[1] + h * d / o.d, T[2] + u[2] * d];
          if (F3.clearAt(solid, q[0], q[1], q[2], o.lens) && F3.lineFirst(solid, T, q) === Infinity) { P = q; break; }
        }
        if (!P) continue;
        if (o.avoid && o.avoid.length && blockedBy(o.avoid, T, P)) continue;
        const sc = pen + Math.abs(d - o.d) * 0.6 + (dMin < o.mins[0] ? 1.5 : 0);
        if (!win || sc < win.score) win = { P, T: T.slice(), d, score: sc, clear: true, a };
        break;
      }
    }
    if (win) Object.assign(win, look(win.P, win.T));
    return win;
  }
  // someone else standing in the picture: within 0.5 m of the line from the subject to the lens (not by the subject's
  // own side), or within 0.9 m of the lens
  function blockedBy(avoid, T, P) {
    const dx = P[0] - T[0], dz = P[2] - T[2], L2 = dx * dx + dz * dz || 1;
    for (const q of avoid) {
      const ex = q[0] - T[0], ez = q[1] - T[2], k = Math.max(0, Math.min(1, (ex * dx + ez * dz) / L2));
      const hx = ex - dx * k, hz = ez - dz * k;
      if (k * Math.sqrt(L2) > 0.7 && hx * hx + hz * hz < 0.25) return true;
      if ((q[0] - P[0]) ** 2 + (q[1] - P[2]) ** 2 < 0.81) return true;
    }
    return false;
  }
  const sunPen = (a, sun) => (sun === null || sun === undefined ? 0 : (1 - Math.cos(a - sun)) * 1.1);
  // a face: S = {head: [x, y, z], yaw} (the person faces −z turned by yaw); o: {d (3.8), dMin (3), dMax (5), sun (the
  // sun's angle atan2(z, x) — the camera goes to that side), lens}
  F3.OFFS = [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.4, -1.4, 1.9, -1.9, 2.5, -2.5, Math.PI];
  F3.frame = function (solid, S, o) {
    o = o || {};
    const op = { d: o.d || 3.8, dMax: o.dMax || 5, mins: [o.dMin || 3, 2, 1.2], lens: o.lens || F3.LENS, avoid: o.avoid || null };
    const f = Math.atan2(-Math.cos(S.yaw), -Math.sin(S.yaw)), rays = [];
    for (const off of F3.OFFS) for (const h of [0.2, 0.55, 1.1]) rays.push([f + off, h, Math.abs(off) * 1.1 + h * 0.4 + sunPen(f + off, o.sun) * 2]);
    return best(solid, S.head, rays, op);
  };
  // a group round C (feet) of radius r: farther and raised; o: {pref (an angle to prefer), sun}
  F3.frameGroup = function (solid, C, r, o) {
    o = o || {};
    const d = clamp(2.2 * r + 1.5, 3.5, 9), T = [C[0], C[1] + 0.9, C[2]];
    const op = { d, dMax: d + 1.5, mins: [Math.max(3, d - 2.5), 2.2, 1.4], lens: o.lens || F3.LENS };
    const rays = [];
    for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; for (const h of [0.8 + 0.4 * r, 1.6 + 0.5 * r, 0.5]) rays.push([a, h, (o.pref !== undefined ? (1 - Math.cos(a - o.pref)) * 1.6 : 0) + sunPen(a, o.sun) * 1.5 + Math.abs(h - 0.8 - 0.4 * r) * 0.3]); }
    return best(solid, T, rays, op);
  };

  // the lens (vertical field of view, radians) for a portrait at d (the head and shoulders, ~1.3 m of height) and for a
  // group of radius r (its width and 2.4 m of height in the picture)
  F3.portraitFov = (d, kid) => clamp(2 * Math.atan((kid ? 1.2 : 1.55) / 2 / Math.max(0.5, d)), 14 * Math.PI / 180, 60 * Math.PI / 180);
  F3.groupFov = (d, r, aspect) => clamp(Math.max(2 * Math.atan(Math.tan(Math.atan((r + 0.9) / Math.max(0.5, d))) / (aspect || 16 / 9)), 2 * Math.atan(1.25 / Math.max(0.5, d))), 24 * Math.PI / 180, 75 * Math.PI / 180);

  // ---------------------------------------------------------------- the circle dance
  F3.CHORD = 1.4;   // m between two neighbours' middles: the hands meet (the arms out to the side and a little down)
  F3.ringR = (n) => clamp(F3.CHORD / (2 * Math.sin(Math.PI / Math.max(3, n))), 1.0, 2.6);
  F3.W = 0.35;      // rad/s: the ring's turn (≈ 0.5 m/s side steps at 6 dancers)
  // open(x, z): the dance's floor is open ground there. The player's place first, then nearer places before farther
  // ones, until the middle and 24 samples on the ring (and 0.3 m either side of it) are open
  F3.danceRing = function (open, pz, pl, n) {
    const r = F3.ringR(n), ok = (cx, cz) => {
      if (!open(cx, cz)) return false;
      for (let i = 0; i < 24; i++) { const a = i / 24 * TAU, c = Math.cos(a), s = Math.sin(a); for (const rr of [r - 0.3, r, r + 0.3]) if (!open(cx + c * rr, cz + s * rr)) return false; }
      return true;
    };
    const px = pl[0], pz2 = pl.length > 2 ? pl[2] : pl[1];
    if (ok(px, pz2)) return { c: [px, pz2], r, w: F3.W, ok: true };
    // (on a plaza with something in its middle: away from the middle first)
    const away = pz ? Math.atan2(pz2 - (pz.z + 0.5), px - (pz.x + 0.5)) : 0;
    for (const step of [0.6, 1.2, 1.8, 2.4, 3.2, 4.2, 5.4]) for (let i = 0; i < 12; i++) {
      const a = away + (i & 1 ? 1 : -1) * Math.ceil(i / 2) * TAU / 12, cx = px + Math.cos(a) * step, cz = pz2 + Math.sin(a) * step;
      if (ok(cx, cz)) return { c: [cx, cz], r, w: F3.W, ok: true };
    }
    return { c: [px, pz2], r, w: 0, ok: false };
  };
  // the dancer's body over its pose P (FolkAnim's [rx, ry, rz, ox, oy, oz] per joint): hands joined — each arm out to
  // its neighbour by the chord (−rz the left arm out, +rz the right), a sway of the body, a side step on ph's beat
  F3.ringPose = function (P, k, ph, chord, kid) {
    const len = kid ? 0.42 : 0.62, reach = clamp((chord / 2 - (kid ? 0.13 : 0.18)) / len, 0.25, 1);
    const up = Math.asin(reach), s = Math.sin(ph), sa = Math.abs(s);
    const set = (j, rx, ry, rz) => { const q = P[j]; if (!q) return; q[0] = q[0] * (1 - k) + rx * k; q[1] = q[1] * (1 - k) + ry * k; q[2] = q[2] * (1 - k) + rz * k; };
    set('arm_l', 0.28 + s * 0.06, 0, -up - s * 0.05);
    set('arm_r', 0.28 - s * 0.06, 0, up - s * 0.05);
    set('fore_l', 0.18, 0, 0); set('fore_r', 0.18, 0, 0);
    set('body', 0.03, 0, s * 0.075);
    set('head', -0.05, 0, s * 0.1);
    // the step: the leading leg out to the side while the other takes the weight, then they swap
    set('leg_l', 0.05, 0, -0.04 - Math.max(0, s) * 0.2);
    set('leg_r', 0.05, 0, 0.04 + Math.max(0, -s) * 0.2);
    set('shin_l', -0.12 * sa, 0, 0); set('shin_r', -0.12 * sa, 0, 0);
    return P;
  };

  // ---------------------------------------------------------------- the moods over a day (ticks: 0 sunrise, 6000 noon,
  // 12000 sunset): {k, lids (0 open … 1 shut), smile (a smile's chance a second), yawn}
  const hs = (s) => { let h = (s | 0) * 2654435761 >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; return (h >>> 0) / 4294967296; };
  F3.mood = function (tod, seed) {
    tod = ((tod % 24000) + 24000) % 24000;
    const late = 1300 + hs(seed) * 1300;   // (the morning goes by the person: some are awake early)
    if (tod >= 22800 || tod < late) return { k: 'sleepy', lids: 0.5, smile: 0.015, yawn: 0.05 };
    if (tod >= 4300 && tod < 7700) return { k: 'cheer', lids: 0, smile: 0.12, yawn: 0 };
    if (tod >= 10300 && tod < 12900) return { k: 'cosy', lids: 0.3, smile: 0.06, yawn: 0 };
    if (tod >= 12900 && tod < 22800) return { k: null, lids: 0, smile: 0, yawn: 0 };
    return { k: null, lids: 0, smile: 0.04, yawn: 0 };
  };
  F3.FAR_FACE = 6;
  F3.farFace = (d) => d >= F3.FAR_FACE;
  // the draw's options for a smooth person (villages.js draw → here, then FolkGPU.queue): the far face with a little
  // hysteresis, the lids of a mood (folkgpu.js lifts the lids part by o.lidUp head units: the eye half covered)
  F3.off = false;   // the switch (the measurement's): no far face, no moods, no play poses — the dance's ring stays
  F3.drawOpts = function (a, o, d2) {
    if (F3.off) { o.far = false; return o; }
    a.ffar = a.ffar ? d2 > 5.5 * 5.5 : d2 > F3.FAR_FACE * F3.FAR_FACE;
    o.far = a.ffar;
    const m = a.mood;
    if (m && m.lids > 0 && !a.ffar && o.hide && o.hide.lids && a.pose !== 'sleep' && !a.blinkOn && !a.eyesClosed) { o.hide.lids = false; o.lidUp = 2 * (1 - m.lids) * (a.kid ? 0.515 : 0.54); }
    return o;
  };

  // ================================================================ the game
  const Vs = VR.Villages;
  if (!Vs) return;
  const VP = Vs.prototype, R = VR.R, FL = VR.F;
  // (a palm is blocks, but props.js draws its trunk leaning up to a block off its column and its fronds wide: a cell
  // next to a palm block counts as taken — run 1's tag picture had a trunk before the lens)
  let PROPT = null;
  const propAt = (w, x, y, z) => { const s = w.getBlock(x, y, z); return !!(s && PROPT[R.T.type[s]]); };
  const solidW = (w) => {
    if (!PROPT) { PROPT = new Uint8Array(R.types.length + 1); R.types.forEach((t, i) => { if (t && t.o && (t.o.prop || t.o.propStem)) PROPT[i] = 1; }); }
    return (x, y, z) => {
      const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z), s = w.getBlock(X, Y, Z);
      if (s && (R.T.flags[s] & (FL.SOLID | FL.OPAQUE))) return true;
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (propAt(w, X + dx, Y, Z + dz)) return true;
      return false;
    };
  };
  const tierOf = (g) => (VR.LifeKit && VR.LifeKit.tierOf ? VR.LifeKit.tierOf(g.settings) : 2);
  const icon = (a, ch, t) => { a.bubble = { text: ch, t: t || 2.4, icon: true }; };

  // ---- the fix: an accepted invitation is folkjoy's alone (natives.js's greeting and „make room" stay out of it)
  const ot = VP.openTalk;
  VP.openTalk = function (a) {
    const act = a && a.act;
    if (act && act.type === 'joy' && act.wait && !act.done && this.joyAccept && this.joyAccept(a)) return undefined;
    return ot.apply(this, arguments);
  };
  // ---- the ring, once the invitation is taken
  const ja = VP.joyAccept;
  if (ja) VP.joyAccept = function (a) {
    const was = this.joy && this.joy.dance;
    const r = ja.apply(this, arguments);
    const D = this.joy && this.joy.dance;
    if (r && D && D !== was) this.f3Ring(D, a.vil);
    return r;
  };
  VP.f3Ring = function (D, vil) {
    const w = this.g.world, fy = Math.floor(D.c[1] + 0.05);
    const sol = (x, y, z) => { const s = w.getBlock(Math.floor(x), y, Math.floor(z)); return !!(s && (R.T.flags[s] & FL.SOLID)); };
    const wet = (x, y, z) => { const s = w.getBlock(Math.floor(x), y, Math.floor(z)); return !!(s && (R.T.flags[s] & FL.FLUID)); };
    const open = (x, z) => sol(x, fy - 1, z) && !sol(x, fy, z) && !sol(x, fy + 1, z) && !wet(x, fy, z);
    const pz = vil && vil.plan && vil.plan.plaza;
    const ring = F3.danceRing(open, pz, D.c, D.n);
    D.f3 = true; D.ring = ring.ok; D.r = ring.r; D.w = ring.w; D.c = [ring.c[0], fy, ring.c[1]];
    D.chord = 2 * ring.r * Math.sin(Math.PI / Math.max(3, D.n));
    for (const o of D.members) { o.hush = null; o.ringIn = false; }
    F3.lastRing = { c: D.c.slice(), r: D.r, ok: D.ring, n: D.n };
  };
  const jd = VP.joy_dancer;
  VP.joy_dancer = function (a, act, dt) {
    const D = this.joyState().dance;
    if (!D || !D.f3 || !D.ring) { a.ringDance = null; return jd.apply(this, arguments); }
    const an = D.phase + act.idx * TAU / D.n + D.t * D.w, x = D.c[0] + Math.cos(an) * D.r, z = D.c[2] + Math.sin(an) * D.r;
    const d = Math.hypot(x - a.pos[0], z - a.pos[2]);
    a.hush = null;
    if (!act.inRing) {
      a.ringDance = null; a.dance = false;
      if (d < 0.55 && Math.abs(a.pos[1] - D.c[1]) < 1.2) act.inRing = true;
      else {
        act.run = d > 3;
        if (d > 2.5) { a.steer = null; this.goTo(a, x, D.c[1], z, 0.5); }
        else { a.path = null; a.steer = a.steer || [0, 0]; a.steer[0] = x; a.steer[1] = z; }
        if (act.t > 20 && d < 4) act.inRing = true;   // (close enough after a long way: it joins where it stands)
        return;
      }
    }
    // on the ring: it moves with the ring (open ground all round, checked at the start), faces the middle
    a.steer = null; a.path = null; a.vel[0] = 0; a.vel[2] = 0; act.run = false;
    const k = Math.min(1, dt * 6); a.pos[0] += (x - a.pos[0]) * k; a.pos[2] += (z - a.pos[2]) * k;
    a.lookAt = [D.c[0], a.pos[1] + 1.4, D.c[2]];
    let dy = Math.atan2(-(D.c[0] - a.pos[0]), -(D.c[2] - a.pos[2])) - a.yaw; while (dy > Math.PI) dy -= TAU; while (dy < -Math.PI) dy += TAU; a.yaw += dy * Math.min(1, dt * 5);
    a.dance = true; a.ringDance = a.ringDance || { chord: D.chord };
    if (act.idx % 2 === 0 && !a.bubble && Math.random() < dt * 0.12) icon(a, '♪', 1.6);
  };
  // (natives.js: the people near the photo camera hold still — not the dancers: the dance goes on in the picture)
  const ua = VP.updateAgent;
  VP.updateAgent = function (a, dt, tod) { if (a.act && a.act.type === 'joy' && a.act.kind === 'dancer') a.photoT = 1e9; return ua.call(this, a, dt, tod); };
  const je = VP.joyEnd;
  VP.joyEnd = function (a) { if (a) { a.ringDance = null; a.drawOffY = 0; } return je.apply(this, arguments); };

  // ---- the pose: the ring dance, the children's games in the body
  const op = VP.pose;
  VP.pose = function (a, t) {
    const P = op.call(this, a, t);
    const D = this.joy && this.joy.dance;
    if (a.ringDance && a.dance && D) {
      const ph = D.t * Math.PI / 0.54;   // a step every two of the band's beats (0.27 s)
      F3.ringPose(P, 1, ph, a.ringDance.chord, a.kid);
      a.drawOffY = Math.abs(Math.sin(ph)) * (a.kid ? 0.05 : 0.035);
      return P;
    }
    const act = a.act;
    if (a.kid && act && act.type === 'play' && !F3.off && tierOf(this.g) >= 1) {
      const G = a.vil && a.vil.game, s = Math.sin(t * 7.5 + (a.p.seed || 0));
      const set = (j, rx, ry, rz) => { const q = P[j]; if (q) { q[0] = rx; q[1] = ry; q[2] = rz; } };
      if (G && G.type === 'hide' && G.seeker === a && G.phase === 'count') {
        // the seeker counts with the hands over the eyes
        set('arm_l', 2.05, 0, 0.42); set('arm_r', 2.05, 0, -0.42); set('fore_l', 1.25, 0, 0.3); set('fore_r', 1.25, 0, -0.3);
        if (P.head) P.head[0] = 0.18;
      } else if (G && G.type === 'tag' && G.it === a && Math.hypot(a.vel[0], a.vel[2]) > 1) {
        // the tagger reaches out for the next
        set('arm_r', 1.45 + s * 0.15, 0, 0.12); set('fore_r', 0.1, 0, 0);
      } else if (act.game === 'hop') {
        // skipping: the rope's arms turning at the sides, a hop on every turn
        set('arm_l', 0.45 + Math.cos(t * 7.5) * 0.35, 0, -0.55); set('arm_r', 0.45 + Math.cos(t * 7.5) * 0.35, 0, 0.55);
        set('fore_l', 0.6, 0, 0.2); set('fore_r', 0.6, 0, -0.2);
        if (P.shin_l) P.shin_l[0] = -0.55 * Math.max(0, s); if (P.shin_r) P.shin_r[0] = -0.55 * Math.max(0, s);
        a.drawOffY = Math.max(0, s) * 0.16; a.f3Hop = true;
        return P;
      }
    }
    if (a.f3Hop) { a.f3Hop = false; a.drawOffY = 0; }
    return P;
  };

  // ---- the moods: twice a second over the people within 30 m (Low and up)
  const up = VP.update;
  VP.update = function (dt) {
    up.call(this, dt);
    const g = this.g, p = g.player; if (!p || F3.off || tierOf(g) < 1) return;
    this.f3T = (this.f3T || 0) - dt; if (this.f3T > 0) return;
    this.f3T = 0.5;
    const tod = g.env ? g.env.timeOfDay : 6000;
    for (let i = 0; i < this.agents.length; i++) {
      const a = this.agents[i];
      if ((a.pos[0] - p.pos[0]) ** 2 + (a.pos[2] - p.pos[2]) ** 2 > 900) { a.mood = null; continue; }
      if (a.pose === 'sleep') { a.mood = null; continue; }
      const m = a.mood = F3.mood(tod, a.p.seed || i);
      if (a.expr || a.talkAnim > 0 || a.bubble) continue;
      if (m.smile && Math.random() < m.smile * 0.5) { a.expr = 'joy'; a.exprT = 1.4 + Math.random() * 1.6; }
      else if (m.yawn && Math.random() < m.yawn * 0.5 && Math.hypot(a.vel[0], a.vel[2]) < 0.3) { a.expr = 'wow'; a.exprT = 1.1; a.stretchT = 2.4; }
    }
  };

  // ---- the village band while the ring dances near
  const AU = VR.Audio;
  if (AU && AU.prototype.updateMusic) {
    const um = AU.prototype.updateMusic;
    AU.prototype.updateMusic = function (dt, s) {
      const g = VR.game, D = g && g.villages && g.villages.joy && g.villages.joy.dance, p = g && g.player;
      if (s && !s.festival && !s.danger && D && D.f3 && p && Math.hypot(p.pos[0] - D.c[0], p.pos[2] - D.c[2]) < 30) s.festival = true;
      return um.call(this, dt, s);
    };
  }

  // ---- 📷 the photo mode: H frames the nearest face (again: the next one), from the sun's side
  const PM = VR.PhotoMode;
  F3.subject = (a) => { const sp = a.p.look && a.p.look.species && VR.Folk.SPECIES_BODY && VR.Folk.SPECIES_BODY[a.p.look.species], sc = sp ? sp.scale : 1; return { head: [a.pos[0], a.pos[1] + (a.kid ? 1.0 : 1.6) * sc, a.pos[2]], yaw: a.yaw }; };
  F3.sunAngle = (g) => { const E = g.env && g.env.E, s = E && E.sunDir; return s && s[1] > -0.05 ? Math.atan2(s[2], s[0]) : null; };
  F3.portrait = function (pc) {
    const g = pc.g, s = pc.s, V = g.villages; if (!s || !V || !g.world) return false;
    const list = [];
    for (const a of V.agents) { if (a.pose === 'sleep' || a.inBoat) continue; const d = (a.pos[0] - s.x) ** 2 + (a.pos[2] - s.z) ** 2; if (d < 32 * 32) list.push([d, a]); }
    list.sort((x, y) => x[0] - y[0]);
    if (!list.length) { if (PM) PM.note(tx('g.photo.noFace', null, '📷 Niemand in der Nähe für ein Porträt', '📷 Nobody near for a portrait'), 2200); return false; }
    pc.f3i = pc.f3Last && pc.f3T > performance.now() - 8000 ? (pc.f3i + 1) % Math.min(6, list.length) : 0;
    const a = list[pc.f3i][1];
    pc.f3Last = a; pc.f3T = performance.now();
    return F3.portraitOf(pc, a);
  };
  // a portrait of a: o {d, dMin, dMax} (the default 3.8 m), the sun's side
  F3.portraitOf = function (pc, a, o) {
    const g = pc.g, s = pc.s; if (!s || !g.world || !a) return null;
    const avoid = []; if (a.vil) for (const q of a.vil.agents) if (q !== a && (q.pos[0] - a.pos[0]) ** 2 + (q.pos[2] - a.pos[2]) ** 2 < 100) avoid.push([q.pos[0], q.pos[2]]);
    const f = F3.frame(solidW(g.world), F3.subject(a), Object.assign({ sun: F3.sunAngle(g), avoid }, o || {}));
    if (!f) return null;
    // a portrait's lens: the head and the shoulders fill the picture (the aim a little under the eyes, the head in the
    // upper third); o.fov === false keeps the game's own (the far face's picture)
    if (!(o && o.fov === false)) { f.T[1] -= a.kid ? 0.12 : 0.18; Object.assign(f, look(f.P, f.T)); pc.f3Fov = F3.portraitFov(f.d, a.kid); } else pc.f3Fov = null;
    s.x = f.P[0]; s.y = f.P[1]; s.z = f.P[2]; s.yaw = f.yaw; s.pitch = f.pitch; s.vel[0] = s.vel[1] = s.vel[2] = 0; s.roll = 0;
    if (pc.orbit) pc.orbit = null;
    if (PM) PM.note(tx('g.photo.portrait', { n: a.p.name || '' }, '📷 Porträt: {n} — H: der Nächste · G: goldene Stunde', '📷 Portrait: {n} — H: the next one · G: golden hour'), 2600);
    return f;
  };
  // a group (the dance, a family, the children at play): the camera set on pc for the frame round C of radius r
  F3.groupShot = function (pc, C, r, o) {
    const g = pc.g, s = pc.s; if (!s || !g.world) return null;
    const f = F3.frameGroup(solidW(g.world), C, r, Object.assign({ sun: F3.sunAngle(g) }, o || {}));
    if (!f) return null;
    pc.f3Fov = F3.groupFov(f.d, r, g.renderer ? g.renderer.W / Math.max(1, g.renderer.H) : 16 / 9);
    s.x = f.P[0]; s.y = f.P[1]; s.z = f.P[2]; s.yaw = f.yaw; s.pitch = f.pitch; s.vel[0] = s.vel[1] = s.vel[2] = 0; s.roll = 0;
    if (pc.orbit) pc.orbit = null;
    return f;
  };
  F3.solidW = solidW;
  if (PM && PM.Photo) {
    const PP = PM.Photo.prototype, pu = PP.update, pe = PP.enter, pcm = PP.cam, pl = PP.leave;
    PP.update = function (dt, I) {
      const typing = this.g.ui && this.g.ui.typing;
      if (this.on && this.s && !this.first && !typing && I.hit('KeyH')) F3.portrait(this);
      else if (this.f3Fov && !typing && ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft'].some(c => I.down(c))) this.f3Fov = null;   // (gliding off: the game's lens again)
      return pu.call(this, dt, I);
    };
    PP.cam = function (base) { const c = pcm.call(this, base); if (c && this.f3Fov) c.fov = this.f3Fov; return c; };
    PP.leave = function () { this.f3Fov = null; return pl.apply(this, arguments); };
    PP.enter = function () {
      pe.call(this);
      if (this.on && this.g.villages && this.g.villages.agents.length) setTimeout(() => { const n = document.getElementById('photonote'); if (this.on && n && n.textContent && n.style.opacity !== '0') PM.note(n.textContent + tx('g.photo.more3', null, ' · H: Porträt', ' · H: portrait'), 6000); }, 0);
    };
  }
})(VR);

// ============================================================================
// e-portal2 · VR.PortalSpace — the Leuchtpfad's film shows the worlds through the real orbit renderer
// (docs/superpowers/plans/2026-10-31-e-portal2.md; review v0.54 R55-07). The film's space shots — the world's curve as
// you rise, Amarant's ring and its shadow, the destination swelling with its parent behind, a station's backdrop — are
// u-space0's own scene (spacescene.js: the lit spheres with their textures, the terminator, the air's limb, the ring's
// shadow on the bands, the bloom), drawn under the film's 2-D canvas, which then only adds the letterbox and the fades.
//   pure (node: test/portal2.js) · bodyOf(dim) · parentOf(id) · GL (the 3-D shots) · when(shot, id, t0) the moment the
//   shot has its light · pose(shot, k, v, id, eph) → a view {pos, fwd, up, fov, ref, body} · plan(film, from, to, t0) ·
//   bestHour(dim, pos, t0) → the next world second Helia stands 6–17° over the landing (or null)
//   game · ready(g) (asks SpaceScene.needs for this tier's textures) · render(g, shot, k, v, it) → true when drawn
// Cost: one space frame instead of the 2-D painting (the renderer's own tier: Very Low = tier-0 textures, herz_vl, the
// renderer's Very Low resolution); nothing while no film runs.
// ============================================================================
(function (VR) {
  'use strict';
  const PS = VR.PortalSpace = {};
  const D2R = Math.PI / 180;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => t * t * (3 - 2 * t);
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = (a) => Math.hypot(a[0], a[1], a[2]);
  const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const perp = (v, n) => { const d = dot(v, n); return norm([v[0] - n[0] * d, v[1] - n[1] * d, v[2] - n[2] * d]); };
  const rot = (v, k, a) => { const c = Math.cos(a), s = Math.sin(a), d = dot(k, v), x = cross(k, v); return [v[0] * c + x[0] * s + k[0] * d * (1 - c), v[1] * c + x[1] * s + k[1] * d * (1 - c), v[2] * c + x[2] * s + k[2] * d * (1 - c)]; };
  const ang = (a, b) => Math.acos(clamp(dot(norm(a), norm(b)), -1, 1));
  const SSc = () => VR.SpaceScene;

  PS.GL = { curve: 1, ring: 1, moon: 1, station: 1 };
  const MOONS = { opal: 1, basalt: 1, zinn: 1, ocker: 1, aqua: 1 };
  PS.bodyOf = function (dim) {
    const s = String(dim || '');
    if (MOONS[s]) return s;
    if (s.slice(0, 2) === 'x.') return null;   // another star: the tunnel, not our system
    return 'herz';   // home, the isles, the deep, the stations: Herzwelt below
  };
  const PARENT = { herz: 'amarant', aqua: 'herz', zinn: 'amarant', opal: 'amarant', basalt: 'amarant', ocker: 'amarant' };
  PS.parentOf = (id) => PARENT[id] || 'amarant';
  const R = (id) => SSc().BODIES[id].R;

  // ---------------------------------------------------------------- the poses (system frame, metres)
  // curve: over a place where Helia stands e° up, looking at azimuth az from the sun; rising from 0.05 R to 1.25 R; the
  // limb a fifth of the picture under its middle (the world's arc in the lower part, the black and the stars above)
  const CURVE = [{ e: 11, az: 0.0 }, { e: 16, az: 1.25 }, { e: 32, az: 2.75 }];
  function curve(id, k, v, eph) {
    const b = eph.bodies[id], r = R(id), s = norm(sub(eph.bodies.helia.p, b.p));
    let ax = cross(s, b.axis); if (len(ax) < 1e-6) ax = cross(s, [1, 0, 0]); ax = norm(ax);
    const c = CURVE[v % 3], N = rot(s, ax, (90 - c.e) * D2R), hs = perp(s, N), hd = rot(hs, N, c.az);
    const alt = r * lerp(0.05, 1.25, Math.pow(clamp(k, 0, 1), 1.5)), dip = Math.acos(r / (r + alt)), fov = 60 * D2R;
    const p = -dip + 0.2 * fov, fwd = norm(add(mul(hd, Math.cos(p)), mul(N, Math.sin(p))));
    return { pos: add(b.p, mul(N, r + alt)), fwd, up: perp(N, fwd), fov, ref: id, body: id };
  }
  // moon: the target from beyond it (its parent behind, a little aside and above), from 16 R in to 2.5 R
  const MOONV = [-14, 11, 20];
  function moon(id, k, v, eph) {
    const b = eph.bodies[id], par = eph.bodies[PS.parentOf(id)], r = R(id);
    const c0 = norm(sub(b.p, par.p)), c = norm(add(rot(c0, b.axis, MOONV[v % 3] * D2R), mul(b.axis, 0.1)));
    const d = r * lerp(16, 2.5, Math.pow(clamp(k, 0, 1), 1.3)), pos = add(b.p, mul(c, d));
    const dT = mul(c, -1), dP = norm(sub(par.p, pos)), w = lerp(0.32, 0.06, clamp(k, 0, 1));
    const fwd = norm(add(mul(dT, 1 - w), mul(dP, w)));
    return { pos, fwd, up: perp(b.axis, fwd), fov: 50 * D2R, ref: id, body: null };
  }
  // ring: 4.2 → 3.0 Amarant radii out over the ring's lit face, sweeping round so the ring and its shadow slide by
  function ring(k, v, eph) {
    const A = eph.bodies.amarant, n = A.axis, s = norm(sub(eph.bodies.helia.p, A.p)), sg = Math.sign(dot(s, n)) || 1;
    const sp = perp(s, n), side = cross(n, sp), e = ease(clamp(k, 0, 1));
    const az = 0.75 + ((v % 3) - 1) * 0.35 + lerp(-0.2, 0.2, e), el = lerp(24, 15, e) * D2R;
    const dir = norm(add(add(mul(sp, Math.cos(az)), mul(side, Math.sin(az))), mul(n, sg * Math.tan(el))));
    const pos = add(A.p, mul(dir, lerp(4.2, 3.0, e) * R('amarant')));
    const fwd = norm(sub(add(A.p, mul(n, -sg * 0.25 * R('amarant'))), pos));
    return { pos, fwd, up: perp(n, fwd), fov: 48 * D2R, ref: 'amarant', body: null };
  }
  PS.pose = function (shot, k, v, id, eph) {
    if (!eph || !eph.bodies) return null;
    if (shot === 'ring') return ring(k, v, eph);
    if (!id || !eph.bodies[id]) return null;
    if (shot === 'curve') return curve(id, k, v, eph);
    if (shot === 'station') return curve('herz', 0.3, v, eph);
    if (shot === 'moon') return moon(id, k, v, eph);
    return null;
  };

  // ---------------------------------------------------------------- the moments
  // moon: the next moment over the target's orbit when its terminator crosses it (phase ~65°) and its parent is lit
  // behind (not in eclipse); ring: in Amarant's season, Helia high over the ring's face; the rest: now
  PS.when = function (shot, id, t0) {
    const SS = SSc(); t0 = +t0 || 0;
    if (!SS) return t0;
    if (shot === 'moon' && id && SS.BODIES[id] && SS.BODIES[id].P) {
      const P = SS.BODIES[id].P, eph = {}; let best = t0, bs = 1e9;
      for (let i = 0; i < 72; i++) {
        const t = t0 + P * i / 72; SS.ephemeris(t, eph);
        const p = moon(id, 0.6, 1, eph), b = eph.bodies[id], par = eph.bodies[PS.parentOf(id)], h = eph.bodies.helia.p;
        const ph = ang(sub(h, b.p), sub(p.pos, b.p)) / D2R, pp = ang(sub(h, par.p), sub(p.pos, par.p)) / D2R;
        const sc = Math.abs(ph - 65) + Math.max(0, pp - 90) * 2 + i * 0.05;
        if (sc < bs) { bs = sc; best = t; }
      }
      return best;
    }
    if (shot === 'ring') {
      const P = SS.BODIES.amarant.P, eph = {}; let best = t0, bs = -1;
      for (let i = 0; i < 48; i++) {
        const t = t0 + P * i / 48; SS.ephemeris(t, eph);
        const A = eph.bodies.amarant, o = Math.abs(dot(norm(sub(eph.bodies.helia.p, A.p)), A.axis)) - i * 1e-4;
        if (o > bs) { bs = o; best = t; }
      }
      return best;
    }
    return t0;
  };
  // the film's plan: each shot's body and moment (3-D shots only)
  PS.plan = function (film, from, to, t0) {
    const fb = PS.bodyOf(from), tb = PS.bodyOf(to);
    return film.shots.map((s) => {
      if (!PS.GL[s.id]) return { gl: false };
      const id = s.id === 'ring' ? 'amarant' : s.id === 'station' ? 'herz' : s.id === 'moon' ? tb : (fb || tb);
      if (!id) return { gl: false };
      return { gl: true, id, t: PS.when(s.id, id, t0) };
    });
  };

  // ---------------------------------------------------------------- the best hour at the landing
  // the next world second (from t0, within 8 game days) Helia stands 6–17° over the place — rising or setting
  PS.bestHour = function (dim, pos, t0) {
    const U = VR.Universe; if (!U || !U.localSky) return null;
    let out;
    const el = (t) => { try { out = U.localSky(dim, pos, t, out); return Math.asin(clamp(out.sun.dir[1], -1, 1)) / D2R; } catch (e) { return null; } };
    const e0 = el(t0); if (e0 === null) return null;
    if (e0 >= 6 && e0 <= 17) return t0;
    const step = 20, end = t0 + 8 * 1200;
    let prev = e0;
    for (let t = t0 + step; t <= end; t += step) {
      const e = el(t); if (e === null) return null;
      if (e >= 6 && e <= 17) return t;
      if ((prev < 6 && e > 17) || (prev > 17 && e < 6)) {   // stepped over the band: halve back into it
        let a = t - step, b = t;
        for (let i = 0; i < 12; i++) { const m = (a + b) / 2, em = el(m); if (em >= 6 && em <= 17) return m; if ((prev < 6) === (em < 6)) a = m; else b = m; }
      }
      prev = e;
    }
    return null;
  };

  // ---------------------------------------------------------------- the game (the page)
  if (typeof window === 'undefined') return;
  const EPH = {}, CAM = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, fov: 1, far: 100 };
  PS.stats = { frames: 0, ms: 0, miss: 0 };
  PS.ready = function (g) {
    const SS = SSc(); if (!SS || !SS.needs || !g || !g.renderer || !g.pool) return false;
    try { return !!SS.needs(g, null, SS.tier(g)); } catch (e) { return false; }
  };
  PS.render = function (g, shot, k, v, it) {
    const SS = SSc(), r = g && g.renderer;
    if (!SS || !r || !it || !it.gl || !SS.frameSetup || !PS.ready(g)) { PS.stats.miss++; return false; }
    const t0 = performance.now(), tier = SS.tier(g);
    SS.ephemeris(it.t + k * 40, EPH);   // (40 s of the orbit across a shot: the bands flow, the moons creep)
    const view = PS.pose(shot, k, v, it.id, EPH); if (!view) return false;
    const was = SS.cur;
    try {
      const fr = SS.frameSetup({ anc: SS.anchor(view, EPH), tier }, EPH, { H: r.H, tier, bloom: !!(r.q && r.q.bloom && r.hdr), patch: null });
      SS.cur = fr;
      const ES = SS.env; ES.sunDir = fr.sunS; ES.moonDir = [-fr.sunS[0], -fr.sunS[1], -fr.sunS[2]]; ES.exposure = fr.look.exposure; ES.time = (g.env && g.env.anim) || g.time || 0;
      ES.bloomStrength = 0.06; ES.bloomThreshold = 1.4;
      CAM.fov = fr.fov;
      (r.__ptOrig || r.render).call(r, { cam: CAM, world: null, env: ES, noSky: true, drawOpaque: SS.draw });
    } catch (e) { PS.stats.miss++; SS.cur = was; return false; }
    SS.cur = was;
    PS.stats.frames++; PS.stats.ms = PS.stats.ms * 0.9 + (performance.now() - t0) * 0.1;
    return true;
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

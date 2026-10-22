// ============================================================================
// u-space0 · VR.SpaceScene — the home system drawn from any vantage, at its cheapest (docs/superpowers/plans/
// 2026-10-22-u-space0.md; U§2, §5.4, §11, §12). Through the renderer's own frame with world: null and noSky (the
// terrain passes drop out), a floating origin in doubles, one quad (or one full-screen pass for the planet under the
// camera) per body with analytic ray–sphere, the ring as one annulus, one star grid and the galaxy band, Helia white
// (#dddeff) with its glow. `/raum <herz|amarant|zinn|aqua>` opens a view (game.js), Esc or `/raum` closes it; there is no
// flight yet (u-ascent, wave 4).
//   · pure part (node tests: test/space0.js): the bodies of U§2.1, the fallback ephemeris, the views, findTime, the math
//   · GL part (VR.Renderer present): textures from the worker's bodytex jobs (src/shared/bodytex.js), the programs of
//     space_shaders.js, the draw list
//   · game part (VR.Game present): the playFrame wrapper while a view is open, raumCommand, the spaceDetail switch
// The ephemeris comes from VR.Universe.state(t) (u-orbit, the same wave) when it is there — SS.fromUniverse reads it; the
// merge checks that function against u-orbit's shape — else from SS.fallback (circular orbits, the same numbers).
// ============================================================================
(function (VR) {
  'use strict';
  const SS = VR.SpaceScene = {};
  const D2R = Math.PI / 180, TAU = Math.PI * 2;
  const BT = () => VR.BodyTex;
  // ---------------------------------------------------------------- small vector helpers (doubles, arrays)
  const V3 = SS.v3 = {
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    len: (a) => Math.hypot(a[0], a[1], a[2]),
    norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
    // v turned by angle about the unit axis k (Rodrigues; positive = counter-clockwise seen from k's tip — eastward)
    rot: (v, k, ang) => { const c = Math.cos(ang), s = Math.sin(ang), d = k[0] * v[0] + k[1] * v[1] + k[2] * v[2]; const x = k[1] * v[2] - k[2] * v[1], y = k[2] * v[0] - k[0] * v[2], z = k[0] * v[1] - k[1] * v[0]; return [v[0] * c + x * s + k[0] * d * (1 - c), v[1] * c + y * s + k[1] * d * (1 - c), v[2] * c + z * s + k[2] * d * (1 - c)]; },
    // the part of v perpendicular to the unit n, normalised
    perp: (v, n) => { const d = v[0] * n[0] + v[1] * n[1] + v[2] * n[2]; return V3.norm([v[0] - n[0] * d, v[1] - n[1] * d, v[2] - n[2] * d]); },
  };
  const { sub, add, mul, dot, cross, len, norm, rot, perp } = V3;

  // ---------------------------------------------------------------- the home system (U§2.1; game lengths = real ÷ 64)
  // R equatorial radius (m), Rp polar, a orbit radius, parent, inc inclination to the parent's ring plane (Amarant's
  // moons) or equator, retro, locked (the day = the orbit), day (spin period, s), ph0 the orbit's phase at t 0, mu = g·R²
  const B = SS.BODIES = {
    helia: { R: 16305e3, mu: 1.32712e20 * 1.33 / 4096, col: '#dddeff' },   // F5 V, 1.33 M☉ (μ ÷ 64² so periods are real ÷ 8, U§3)
    amarant: { R: 937500, Rp: 845600, a: 4.44e9, parent: 'helia', g: 35, day: 10.2 * 3600 },
    herz: { R: 99550, a: 7792e3, parent: 'amarant', inc: 8 * D2R, g: 9.81, ph0: 0.35 },
    aqua: { R: 37500, a: 539e3, parent: 'herz', retro: true, locked: true, g: 2.01, ph0: 2.2 },
    zinn: { R: 28400, a: 2969e3, parent: 'amarant', locked: true, g: 1.8, ph0: 1.3 },
    opal: { R: 17200, a: 4062e3, parent: 'amarant', inc: 3 * D2R, locked: true, g: 0.49, ph0: 2.9 },
    basalt: { R: 27200, a: 10938e3, parent: 'amarant', day: 3600, g: 1.62, ph0: 4.4 },
    ocker: { R: 53000, a: 17188e3, parent: 'amarant', day: 2400, g: 3.72, ph0: 5.6 },
  };
  for (const k in B) if (B[k].g) B[k].mu = B[k].g * B[k].R * B[k].R;
  for (const k in B) { const b = B[k]; if (b.parent) b.P = TAU * Math.sqrt(b.a * b.a * b.a / B[b.parent].mu); }
  SS.TABLE_P = { amarant: 103.7 * 86400, herz: 6.83 * 3600, aqua: 2.21 * 3600, zinn: 1.61 * 3600, opal: 2.57 * 3600, basalt: 11.35 * 3600, ocker: 22.36 * 3600 };   // U§2.1's periods
  SS.ORDER = ['amarant', 'herz', 'aqua', 'zinn', 'opal', 'basalt', 'ocker'];
  // Amarant's equator and ring 14° to the ecliptic (y = ecliptic north), the line of nodes along x; the world starts with
  // Helia 12° above the ring plane (U§2.1)
  const TILT = 14 * D2R, NA = [0, Math.cos(TILT), Math.sin(TILT)], E1 = [1, 0, 0], E2 = cross(NA, E1);
  const TH0 = Math.asin(Math.sin(12 * D2R) / Math.sin(TILT));
  SS.RING_NORMAL = NA;
  // the world clock (U§3): 20 ticks a second, 24000 a day; tick 6000 the Heartland's noon
  SS.worldTime = (day, ticks) => ((day | 0) * 24000 + (+ticks || 0)) / 20;

  // ---------------------------------------------------------------- the fallback ephemeris (circular orbits)
  // out.bodies[id] = { p: position (m, system frame, doubles), axis: the spin axis, xb: the prime meridian (λ 0, ⊥ axis) }
  function orbit(parentP, a, n, e1, ph) { const e2 = cross(n, e1), c = Math.cos(ph), s = Math.sin(ph); return [parentP[0] + a * (c * e1[0] + s * e2[0]), parentP[1] + a * (c * e1[1] + s * e2[1]), parentP[2] + a * (c * e1[2] + s * e2[2])]; }
  SS.fallback = function (t, out) {
    out = out || {}; out.t = t; out.src = 'fallback';
    const bs = out.bodies || (out.bodies = {});
    const put = (id, p, axis, xb) => { const o = bs[id] || (bs[id] = {}); o.p = p; o.axis = axis; o.xb = xb; o.R = B[id].R; return o; };
    put('helia', [0, 0, 0], [0, 1, 0], [1, 0, 0]);
    const thA = TH0 + TAU * t / B.amarant.P, a = B.amarant.a;
    const pA = [-a * Math.cos(thA), 0, -a * Math.sin(thA)];   // Helia seen from Amarant: (cos θ, 0, sin θ)
    put('amarant', pA, NA, rot(E1, NA, TAU * t / B.amarant.day));
    for (const id of ['herz', 'zinn', 'opal', 'basalt', 'ocker']) {
      const b = B[id], n = b.inc ? rot(NA, E1, b.inc) : NA;
      const p = orbit(pA, b.a, n, E1, b.ph0 + TAU * t / b.P);
      let axis = n, xb;
      if (id === 'herz') {
        // Herzwelt: its axis on the ecliptic's north (an eternal equinox); turned so the Heartland (λ 0) has its noon at tick 6000
        axis = [0, 1, 0];
        const sEq = perp(sub([0, 0, 0], p), axis);
        xb = rot(sEq, axis, TAU * (t / 1200 - 0.25));
      } else if (b.locked) xb = perp(sub(pA, p), n);
      else xb = rot(E1, n, TAU * t / b.day);
      put(id, p, axis, xb);
    }
    // Aquamarin round Herzwelt, retrograde in Herzwelt's equator, locked (its spin follows its orbit: the axis −y)
    { const pH = bs.herz.p, p = orbit(pH, B.aqua.a, [0, 1, 0], E1, B.aqua.ph0 - TAU * t / B.aqua.P); put('aqua', p, [0, -1, 0], perp(sub(pH, p), [0, -1, 0])); }
    return out;
  };
  // VR.Universe.state(t) (u-orbit) read into the same record: bodies by id with positions in metres; whatever is missing
  // or unreadable falls back to the table (the merge swaps this one function to the real shape)
  const IDS = { helia: ['helia', 'sun', 'star'], amarant: ['amarant'], herz: ['herz', 'herzwelt', 'overworld'], aqua: ['aqua', 'aquamarin'], zinn: ['zinn', 'zinnober'], opal: ['opal'], basalt: ['basalt'], ocker: ['ocker'] };
  SS.fromUniverse = function (st, out) {
    if (!st) return false;
    const src = st.bodies || st;
    const pick = (id) => { for (const k of IDS[id]) { const r = Array.isArray(src) ? src.find(q => q && (q.id === k || q.name === k)) : src[k]; if (r) return r; } return null; };
    const vec = (r) => { const v = r && (r.p || r.pos || r.r || r.position); return Array.isArray(v) || (v && v.length === 3) ? [+v[0], +v[1], +v[2]] : null; };
    const got = {};
    for (const id in IDS) { const r = pick(id), p = vec(r); if (!p || !p.every(Number.isFinite)) return false; got[id] = { p, r }; }
    // positions from the universe; orientations (spin) from it when given, else as the fallback turns them
    const fb = SS.fallback(st.t !== undefined ? st.t : 0, {});
    out.src = 'universe';
    const bs = out.bodies || (out.bodies = {});
    for (const id in got) { const r = got[id].r, o = bs[id] || (bs[id] = {}); o.p = got[id].p; o.R = B[id].R; o.axis = (r.axis && r.axis.length === 3) ? norm(r.axis) : fb.bodies[id].axis; o.xb = (r.xb && r.xb.length === 3) ? norm(r.xb) : fb.bodies[id].xb; }
    return true;
  };
  SS.ephemeris = function (t, out) {
    out = out || {}; out.t = t;
    const U = VR.Universe;
    if (U && typeof U.state === 'function') { try { if (SS.fromUniverse(U.state(t), out)) return out; } catch (e) { /* the table below */ } }
    return SS.fallback(t, out);
  };

  // ---------------------------------------------------------------- frames and places on the bodies
  // a body's frame: columns x (λ 0), y (north = the spin axis), z = x × y (so at λ 0 east is −z, BodyTex.normal)
  SS.frame = (b) => { const x = perp(b.xb, b.axis), y = b.axis, z = cross(x, y); return [x, y, z]; };
  SS.toSys = (F, v) => [F[0][0] * v[0] + F[1][0] * v[1] + F[2][0] * v[2], F[0][1] * v[0] + F[1][1] * v[1] + F[2][1] * v[2], F[0][2] * v[0] + F[1][2] * v[1] + F[2][2] * v[2]];
  SS.toBody = (F, v) => [dot(F[0], v), dot(F[1], v), dot(F[2], v)];
  // Helia's height and azimuth (from true north, clockwise) at Herzwelt's (θ, λ)
  SS.localSun = function (eph, th, lam) {
    const h = eph.bodies.herz, F = SS.frame(h), BTm = BT();
    const N = SS.toSys(F, BTm.normal(th, lam)), at = add(h.p, mul(N, B.herz.R));
    const s = norm(sub(eph.bodies.helia.p, at));
    const north = SS.toSys(F, [-Math.cos(th) * Math.cos(lam), Math.sin(th), Math.cos(th) * Math.sin(lam)]), east = SS.toSys(F, [-Math.sin(lam), 0, -Math.cos(lam)]);
    let az = Math.atan2(dot(s, east), dot(s, north)); if (az < 0) az += TAU;
    return { el: Math.asin(Math.max(-1, Math.min(1, dot(s, N)))), az };
  };

  // ---------------------------------------------------------------- the views of /raum
  // { pos (system frame, m), fwd, up (unit), fov (vertical, rad), nadir: {x, z} on Herzwelt's chart (the patch) | null,
  //   body: the body under the camera }
  const ALT = 3000;
  function lookFrame(fwd, upHint) { const f = norm(fwd), u = perp(upHint, f); return { fwd: f, up: u }; }
  // the camera at altitude over the unit body-frame normal Nb of body id, looking toward the target direction `dir`
  // pitched by `pitch` against the local horizontal (radians, negative = down)
  function overBody(eph, id, Nsys, alt) { return add(eph.bodies[id].p, mul(Nsys, B[id].R + alt)); }
  // a point on body id where the direction u (unit, system) stands `el` above the local horizontal, the one nearest the
  // unit normal `near` (both system frame)
  function pointWhere(u, el, near) {
    let w = perp(near, u);
    if (!Number.isFinite(w[0])) w = perp([0, 1, 0], u);
    return norm(add(mul(u, Math.sin(el)), mul(w, Math.cos(el))));
  }
  SS.view = function (name, eph, opt) {
    opt = opt || {};
    const bs = eph.bodies, BTm = BT();
    if (name === 'herz') {
      const x = +opt.x || 0, z = +opt.z || 0, sp = BTm.toSphere(x, z), F = SS.frame(bs.herz);
      const N = SS.toSys(F, BTm.normal(sp[0], sp[1]));
      const pos = overBody(eph, 'herz', N, ALT);
      const north = SS.toSys(F, [-Math.cos(sp[0]) * Math.cos(sp[1]), Math.sin(sp[0]), Math.cos(sp[0]) * Math.sin(sp[1])]), east = SS.toSys(F, [-Math.sin(sp[1]), 0, -Math.cos(sp[1])]);
      // the player's look on the map (forward = (−sin yaw, −cos yaw)) against the map's own true north there
      const yaw = +opt.yaw || 0, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      const nt = BTm.northTurn(x, z), nx = Math.sin(nt), nz = -Math.cos(nt), ex = -nz, ez = nx;
      const az = Math.atan2(fx * ex + fz * ez, fx * nx + fz * nz);
      const hdir = norm(add(mul(east, Math.sin(az)), mul(north, Math.cos(az))));
      const dip = Math.acos(B.herz.R / (B.herz.R + ALT)), p = dip + (opt.down === undefined ? 9 * D2R : opt.down);
      const fwd = norm(add(mul(hdir, Math.cos(p)), mul(N, -Math.sin(p)))), up = norm(add(mul(N, Math.cos(p)), mul(hdir, Math.sin(p))));
      return { name, pos, fwd, up, fov: 62 * D2R, nadir: { x, z }, body: 'herz' };
    }
    if (name === 'amarant') {
      // over Herzwelt where Amarant stands just above the limb (2° over the horizontal; the limb dips 13.9°), the place
      // nearest the player; the giant above the view's middle, the limb in the lower part
      const H = bs.herz, F = SS.frame(H), u = norm(sub(bs.amarant.p, H.p));
      const sp = BTm.toSphere(+opt.x || 0, +opt.z || 0), Np = SS.toSys(F, BTm.normal(sp[0], sp[1]));
      const N = pointWhere(u, 2 * D2R, Np), pos = overBody(eph, 'herz', N, ALT);
      const dA = norm(sub(bs.amarant.p, pos)), el = Math.asin(dot(dA, N)), h = perp(dA, N), e2 = el - 6 * D2R;
      const lf = lookFrame(add(mul(h, Math.cos(e2)), mul(N, Math.sin(e2))), N);
      const nb = SS.toBody(F, N), th = Math.acos(Math.max(-1, Math.min(1, nb[1]))), lam = Math.atan2(-nb[2], nb[0]), pl = BTm.toPlane(th, lam);
      return { name, pos, fwd: lf.fwd, up: lf.up, fov: 60 * D2R, nadir: { x: pl[0], z: pl[1] }, body: 'herz' };
    }
    if (name === 'zinn') {
      // 3 km over Zinnober where Amarant (37° wide, fixed in its sky) sits just over the limb (the limb dips 25°), on the
      // side toward Helia so the ground below is lit
      const Z = bs.zinn, u = norm(sub(bs.amarant.p, Z.p)), s = norm(sub(bs.helia.p, Z.p));
      const N = pointWhere(u, -1.6 * D2R, s), pos = overBody(eph, 'zinn', N, ALT);
      const dA = norm(sub(bs.amarant.p, pos)), el = Math.asin(dot(dA, N)), h = perp(dA, N), e2 = el - 3.4 * D2R;
      const lf = lookFrame(add(mul(h, Math.cos(e2)), mul(N, Math.sin(e2))), N);
      return { name, pos, fwd: lf.fwd, up: lf.up, fov: 68 * D2R, nadir: null, body: 'zinn' };
    }
    if (name === 'aqua') {
      // 150 km off Aquamarin, Herzwelt 539 km beyond it: the two worlds side by side, seen from Helia's side
      const A = bs.aqua, H = bs.herz, u = norm(sub(H.p, A.p)), s = norm(sub(bs.helia.p, A.p));
      let w = perp(s, u); if (!Number.isFinite(w[0])) w = perp([0, 1, 0], u);
      const be = 35 * D2R, pos = add(A.p, mul(add(mul(u, -Math.cos(be)), mul(w, Math.sin(be))), 150e3));
      const dQ = norm(sub(A.p, pos)), dH = norm(sub(H.p, pos));
      const lf = lookFrame(add(mul(dQ, 0.56), mul(dH, 0.44)), cross(w, u));
      return { name, pos, fwd: lf.fwd, up: lf.up, fov: 60 * D2R, nadir: null, body: null };
    }
    return null;
  };
  SS.VIEWS = ['herz', 'amarant', 'zinn', 'aqua'];
  // the phase angle of a body seen from pos (0 full, π new) and the angle between the view and Helia
  SS.phase = (eph, id, pos) => Math.acos(Math.max(-1, Math.min(1, dot(norm(sub(eph.bodies.helia.p, eph.bodies[id].p)), norm(sub(pos, eph.bodies[id].p))))));
  // the next moment (≤ 6 h on, 2-min steps) that gives a view its light: the target about half lit (phase ~80°), Helia
  // outside the picture
  SS.findTime = function (name, t0, opt) {
    const target = name === 'zinn' || name === 'amarant' ? 'amarant' : name === 'aqua' ? 'aqua' : 'herz';
    const want = (opt && opt.phase) || 80 * D2R;
    let best = t0, bestS = -1e9;
    const e = {};
    for (let t = t0; t < t0 + 6 * 3600; t += 120) {
      SS.ephemeris(t, e);
      const v = SS.view(name, e, opt);
      if (!v) return t0;
      const ph = SS.phase(e, target, v.pos), sunOff = Math.acos(Math.max(-1, Math.min(1, dot(norm(sub(e.bodies.helia.p, v.pos)), v.fwd))));
      const sc = -Math.abs(ph - want) - (sunOff < v.fov * 0.75 ? 1 : 0);
      if (sc > bestS) { bestS = sc; best = t; }
    }
    return best;
  };

  // ---------------------------------------------------------------- the math the shaders share (and the test checks)
  const M = SS.math = {};
  // the impostor frame: the camera at the origin, the body (unit radius) at distance d along +w; the ray D = (u, v, w).
  // The closest approach |q| = d·√(u² + v²) and the hit point q − D·√(1 − |q|²) carry no cancellation, so a body 10⁵
  // radii away keeps its round silhouette in floats (space_shaders.js IMPOSTOR)
  M.impostorHit = function (d, Du, Dv, Dw) {
    const s2 = Du * Du + Dv * Dv, q2 = d * d * s2;
    if (q2 > 1 || Dw <= 0) return { hit: false, q: Math.sqrt(q2) };
    const s = Math.sqrt(1 - q2), qv = [d * Dw * Du, d * Dw * Dv, -d * s2];
    return { hit: true, q: Math.sqrt(q2), t: d * Dw - s, N: [qv[0] - Du * s, qv[1] - Dv * s, qv[2] - Dw * s] };
  };
  // a ray against the ellipsoid (1, flat, 1) of the body frame (y the axis): O, D in equatorial radii
  M.ellipsoidHit = function (O, D, flat) {
    const o = [O[0], O[1] / flat, O[2]], dd = [D[0], D[1] / flat, D[2]], k = len(dd), d = [dd[0] / k, dd[1] / k, dd[2] / k];
    const b = dot(o, d), c = dot(o, o) - 1, h = b * b - c;
    if (h < 0) return { hit: false };
    const ts = -b - Math.sqrt(h);
    if (ts < 0) return { hit: false };
    const p = [o[0] + d[0] * ts, o[1] + d[1] * ts, o[2] + d[2] * ts];
    return { hit: true, t: ts / k, N: norm([p[0], p[1] / flat, p[2]]) };
  };
  // Helia's angular radius at Amarant (0.21°): the penumbra's half-width per radius of distance
  M.SUN_ANG = Math.asin(16305e3 / 4.44e9);
  // the planet's shadow on the ring: the ring point P (body frame, equatorial radii), L the unit way to Helia; 1 lit, 0 dark
  M.planetShadowOnRing = function (P, L, flat) {
    const p = [P[0], P[1] / flat, P[2]], l0 = [L[0], L[1] / flat, L[2]], l = norm(l0);
    const tc = -dot(p, l);
    if (tc <= 0) return 1;
    const dmin = len([p[0] + l[0] * tc, p[1] + l[1] * tc, p[2] + l[2] * tc]), w = Math.max(1e-4, M.SUN_ANG * tc);
    const x = Math.max(0, Math.min(1, (dmin - (1 - w)) / (2 * w)));
    return x * x * (3 - 2 * x);
  };
  // the ring's shadow on the planet: the surface point P (body frame), L the unit way to Helia; the transmittance of the
  // slant path through the sheet, exp(−τ(r)/|L·n|)
  M.ringShadowOnPlanet = function (P, L, tauFn) {
    if (Math.abs(L[1]) < 1e-6) return 1;
    const t = -P[1] / L[1];
    if (t <= 0) return 1;
    const r = Math.hypot(P[0] + L[0] * t, P[2] + L[2] * t), tau = tauFn(r);
    return tau > 0 ? Math.exp(-tau / Math.abs(L[1])) : 1;
  };

  // the GL part and the game part follow (src/main/spacescene.js is bundled after game.js; node loads only the above)
  if (typeof window === 'undefined' || !VR.Renderer) return;
  SS.install && SS.install();
})(VR);

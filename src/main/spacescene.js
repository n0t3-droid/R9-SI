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
    const src = st.bodies || st.b || st;   // (VR.Universe.state(t) → { t, b: { helia: { r, v, rel, B }, … } })
    const pick = (id) => { for (const k of IDS[id]) { const r = Array.isArray(src) ? src.find(q => q && (q.id === k || q.name === k)) : src[k]; if (r) return r; } return null; };
    // (VR.Universe works in the ecliptic with z up; the scene is y up: scene (x, y, z) = universe (y, z, x) — a cyclic
    // turn, so the handedness stays; the table below was built the same way: Amarant at t = 1000 s agrees to 0.2 %)
    const vec = (r) => { const v = r && (r.p || r.pos || r.r || r.position); return Array.isArray(v) || (v && v.length === 3) ? (st.b ? [+v[1], +v[2], +v[0]] : [+v[0], +v[1], +v[2]]) : null; };
    const got = {};
    for (const id in IDS) { const r = pick(id), p = vec(r); if (!p || !p.every(Number.isFinite)) return false; got[id] = { p, r }; }
    // positions from the universe; orientations (spin) from it when given, else as the fallback turns them
    const fb = SS.fallback(st.t !== undefined ? st.t : 0, {});
    out.src = 'universe';
    const bs = out.bodies || (out.bodies = {});
    for (const id in got) { const r = got[id].r, o = bs[id] || (bs[id] = {}), Bm = st.b && r.B && r.B.length === 9 ? r.B : null; o.p = got[id].p; o.R = B[id].R; o.axis = Bm ? norm([Bm[5], Bm[8], Bm[2]]) : (r.axis && r.axis.length === 3) ? norm(r.axis) : fb.bodies[id].axis; o.xb = Bm ? norm([Bm[3], Bm[6], Bm[0]]) : (r.xb && r.xb.length === 3) ? norm(r.xb) : fb.bodies[id].xb; }   // u-ascent: the turn from VR.Universe's B (body → system; the pole its third column) — the climb's land and the impostor's are one ground
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
  // { pos (system frame, m), fwd, up (unit), fov (vertical, rad), nadir: {x, z} on Herzwelt's chart — the patch's centre,
  //   the ground the view looks at (10 km ahead of the camera's ground point) | null, body: the body under the camera }
  const ALT = 3000, BEHIND = 6000, AHEAD = 10000;
  // the unit normal `N` moved `dist` metres over Herzwelt's ground toward the tangent direction `h` → the chart's {x, z}
  function chartAhead(eph, N, h, dist) {
    const a = dist / B.herz.R, F = SS.frame(eph.bodies.herz), nb = SS.toBody(F, norm(add(mul(N, Math.cos(a)), mul(perp(h, N), Math.sin(a)))));
    const pl = BT().toPlane(Math.acos(Math.max(-1, Math.min(1, nb[1]))), Math.atan2(-nb[2], nb[0]));
    return { x: pl[0], z: pl[1] };
  }
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
      // 3 km up and 6 km behind the player's place, looking the player's way: the place in the picture's lower middle,
      // the limb and the black above it
      const x = +opt.x || 0, z = +opt.z || 0, sp = BTm.toSphere(x, z), F = SS.frame(bs.herz);
      const Np = SS.toSys(F, BTm.normal(sp[0], sp[1]));
      const north = SS.toSys(F, [-Math.cos(sp[0]) * Math.cos(sp[1]), Math.sin(sp[0]), Math.cos(sp[0]) * Math.sin(sp[1])]), east = SS.toSys(F, [-Math.sin(sp[1]), 0, -Math.cos(sp[1])]);
      // the player's look on the map (forward = (−sin yaw, −cos yaw)) against the map's own true north there
      const yaw = +opt.yaw || 0, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      const nt = BTm.northTurn(x, z), nx = Math.sin(nt), nz = -Math.cos(nt), ex = -nz, ez = nx;
      const az = Math.atan2(fx * ex + fz * ez, fx * nx + fz * nz);
      const hp = norm(add(mul(east, Math.sin(az)), mul(north, Math.cos(az)))), b = BEHIND / B.herz.R;
      const N = norm(add(mul(Np, Math.cos(b)), mul(hp, -Math.sin(b)))), hdir = perp(hp, N);
      const pos = overBody(eph, 'herz', N, ALT);
      const dip = Math.acos(B.herz.R / (B.herz.R + ALT)), p = dip + (opt.down === undefined ? 9 * D2R : opt.down);
      const fwd = norm(add(mul(hdir, Math.cos(p)), mul(N, -Math.sin(p)))), up = norm(add(mul(N, Math.cos(p)), mul(hdir, Math.sin(p))));
      return { name, pos, fwd, up, fov: 62 * D2R, nadir: chartAhead(eph, N, hdir, AHEAD), body: 'herz', ref: 'herz' };
    }
    if (name === 'amarant') {
      // over Herzwelt where Amarant stands just above the limb (2° over the horizontal; the limb dips 13.9°), on the side
      // of its ring's north (the giant's equator, its bands and its ring then lie about level), leaning toward the
      // player's place; the giant above the view's middle, the limb in the lower part
      const H = bs.herz, F = SS.frame(H), u = norm(sub(bs.amarant.p, H.p));
      const sp = BTm.toSphere(+opt.x || 0, +opt.z || 0), Np = SS.toSys(F, BTm.normal(sp[0], sp[1]));
      const N = pointWhere(u, 2 * D2R, norm(add(mul(bs.amarant.axis, 0.85), mul(Np, 0.15)))), pos = overBody(eph, 'herz', N, ALT);
      const dA = norm(sub(bs.amarant.p, pos)), el = Math.asin(dot(dA, N)), h = perp(dA, N), e2 = el - 6 * D2R;
      const lf = lookFrame(add(mul(h, Math.cos(e2)), mul(N, Math.sin(e2))), N);
      return { name, pos, fwd: lf.fwd, up: lf.up, fov: 42 * D2R, nadir: chartAhead(eph, N, h, AHEAD), body: 'herz', ref: 'herz', pair: 'amarant' };   // (a longer lens: the giant and its ring fill the picture's middle)
    }
    if (name === 'zinn') {
      // 3 km over Zinnober where Amarant (37° wide, fixed in its sky) sits just over the limb (the limb dips 25°): near
      // its north pole, so the giant's bands lie level and its ring is the line through them (Zinnober orbits in the
      // ring's plane); Helia stands low over the ground there
      const Z = bs.zinn, u = norm(sub(bs.amarant.p, Z.p));
      const N = pointWhere(u, -1.6 * D2R, Z.axis), pos = overBody(eph, 'zinn', N, ALT);
      const dA = norm(sub(bs.amarant.p, pos)), el = Math.asin(dot(dA, N)), h = perp(dA, N), e2 = el - 3.4 * D2R;
      const lf = lookFrame(add(mul(h, Math.cos(e2)), mul(N, Math.sin(e2))), N);
      return { name, pos, fwd: lf.fwd, up: lf.up, fov: 68 * D2R, nadir: null, body: 'zinn', ref: 'zinn' };
    }
    if (name === 'aqua') {
      // 150 km off Aquamarin, Herzwelt 539 km beyond it: the two worlds side by side, seen from Helia's side
      const A = bs.aqua, H = bs.herz, u = norm(sub(H.p, A.p)), s = norm(sub(bs.helia.p, A.p));
      let w = perp(s, u); if (!Number.isFinite(w[0])) w = perp([0, 1, 0], u);
      const be = 35 * D2R, pos = add(A.p, mul(add(mul(u, -Math.cos(be)), mul(w, Math.sin(be))), 150e3));
      const dQ = norm(sub(A.p, pos)), dH = norm(sub(H.p, pos));
      const lf = lookFrame(add(mul(dQ, 0.56), mul(dH, 0.44)), cross(w, u));
      return { name, pos, fwd: lf.fwd, up: lf.up, fov: 60 * D2R, nadir: null, body: null, ref: 'aqua' };
    }
    return null;
  };
  SS.VIEWS = ['herz', 'amarant', 'zinn', 'aqua'];
  // the player's yaw that looks toward the true azimuth `az` (from north, clockwise) at the chart point (x, z) — the
  // inverse of view('herz')'s turn (the tests aim the views with it)
  SS.yawFor = (az, x, z) => -az - BT().northTurn(x, z);
  // the phase angle of a body seen from pos (0 full, π new) and the angle between the view and Helia
  SS.phase = (eph, id, pos) => Math.acos(Math.max(-1, Math.min(1, dot(norm(sub(eph.bodies.helia.p, eph.bodies[id].p)), norm(sub(pos, eph.bodies[id].p))))));
  // the next moment (≤ 6 h on, 2-min steps) that gives a view its light: the target about half lit (phase ~80°), Helia
  // outside the picture, and for the giant the ring's lit face toward the camera
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
      const A = e.bodies.amarant, litFace = target === 'amarant' && dot(sub(v.pos, A.p), A.axis) * dot(sub(e.bodies.helia.p, A.p), A.axis) > 0 ? 0.5 : 0;
      const sc = -Math.abs(ph - want) - (sunOff < v.fov * 0.75 ? 1 : 0) + litFace;
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

  // ---------------------------------------------------------------- the frame's draw list (pure: the GL part below runs
  // it; a CPU preview can shade the same list)
  // The camera's pose is kept relative to a body — it hovers over the same ground (herz, zinn), or keeps a pair of worlds
  // in view (amarant: Herzwelt's line to the giant; aqua: Aquamarin is locked to Herzwelt) — and turned with it each frame
  function refFrame(eph, ref, pair) {
    const b = eph.bodies[ref];
    if (!pair) return SS.frame(b);
    const x = norm(sub(eph.bodies[pair].p, b.p)), y = perp([0, 1, 0], x);
    return [x, y, cross(x, y)];
  }
  SS.anchor = function (view, eph) {
    const F = refFrame(eph, view.ref, view.pair), b = eph.bodies[view.ref];
    return { name: view.name, ref: view.ref, pair: view.pair || null, pos: SS.toBody(F, sub(view.pos, b.p)), fwd: SS.toBody(F, view.fwd), up: SS.toBody(F, view.up), fov: view.fov, nadir: view.nadir, body: view.body };
  };
  SS.pose = function (anc, eph) {
    const F = refFrame(eph, anc.ref, anc.pair), b = eph.bodies[anc.ref];
    return { pos: add(b.p, SS.toSys(F, anc.pos)), fwd: SS.toSys(F, anc.fwd), up: SS.toSys(F, anc.up), fov: anc.fov };
  };
  const SUN = [0.95, 0.96, 1.0];            // Helia's light on the worlds (F5: white to a camera balanced for daylight)
  const SUN_DISC = [0.72, 0.73, 1.0];       // its disc, #dddeff in linear light (REFERENCE §6.1) — the tone curve whitens it
  SS.SUN = SUN;
  // the galaxy's plane ~60° to the ecliptic, its centre low on the far side (our own sky)
  const GAL_N = norm([0.42, 0.5, -0.76]), GAL_C = perp([0.8, -0.35, 0.2], GAL_N);
  // the moons' looks: [model (0 airless · 1 air), limb, lava glow, glint], the limb's colour
  const LOOK = { aqua: { mk: [1, 0.7, 0, 1], col: [0.3, 0.55, 1.0] }, ocker: { mk: [1, 0.45, 0, 0], col: [0.95, 0.72, 0.5] }, zinn: { mk: [0, 0, 0.35, 0], col: [0, 0, 0] }, opal: { mk: [0, 0, 0, 0], col: [0, 0, 0] }, basalt: { mk: [0, 0, 0, 0], col: [0, 0, 0] } };
  const PARENT = { herz: 'amarant', aqua: 'herz', zinn: 'amarant', opal: 'amarant', basalt: 'amarant', ocker: 'amarant' };
  const PAR_ALB = { amarant: 0.5, herz: 0.32 };
  const smooth = (a, b, x) => { let t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
  // the parent's light on a body's night side: its lit disc (phase), its size in the sky; × 4 — the shadows lifted to stay
  // readable (U§12) — Amarant over Zinnober's night is a lamp (U§4.4); Herzwelt's night × 2 (its lights must lead)
  SS.parentLight = function (eph, id) {
    const par = PARENT[id]; if (!par) return [0, 0, 0];
    const b = eph.bodies[id], p = eph.bodies[par], dP = len(sub(p.p, b.p));
    const angP = Math.asin(Math.min(1, B[par].R / dP)), f = (1 + Math.cos(SS.phase(eph, par, b.p))) / 2;
    return mul(SUN, PAR_ALB[par] * f * angP * angP * (id === 'herz' ? 2.0 : 4.0));
  };
  // S: { anc, tier }; o: { H (pixels), tier, bloom, patch: {x0, z0, size, step, on} }
  SS.frameSetup = function (S, eph, o) {
    const P = SS.pose(S.anc, eph), tier = o.tier | 0, BTm = BT(), RING = BTm.RING, C = BTm.CHART;
    const Zs = mul(norm(P.fwd), -1), Ys = perp(P.up, P.fwd), Xs = cross(Ys, Zs);
    const toS = (v) => [dot(v, Xs), dot(v, Ys), dot(v, Zs)];
    const bs = eph.bodies, cam = P.pos, pxr = (o.H || 720) / P.fov;
    const sunRel = sub(bs.helia.p, cam), sunD = len(sunRel), sunS = toS(mul(sunRel, 1 / sunD)), sunAng = Math.asin(B.helia.R / sunD);
    const fr = { pos: cam, axes: [Xs, Ys, Zs], fov: P.fov, draws: [], sunS, sunAng, bodies: {}, t: eph.t };
    // the eye's adaptation: a lit world under the camera dims the faint stars; at night they come out
    const nb = S.anc.body ? bs[S.anc.body] : null;
    const muN = nb ? dot(norm(sub(cam, nb.p)), norm(sub(bs.helia.p, nb.p))) : 0.6;
    const dayK = smooth(-0.3, 0.06, muN);
    fr.look = { exposure: (3.7 - 1.6 * dayK) * (S.anc.body === 'zinn' ? 1 - 0.2 * dayK : 1), starK: 1.0 - 0.94 * dayK, dayK };   // (Zinnober's sulfur is twice as bright as Herzwelt's land)
    fr.draws.push({ prog: 'bg', full: true, u: { u_half: 0, u_sunDir: sunS, u_sunCol: SUN_DISC, u_sun: [sunAng, 60, 0, 0], u_stars: [fr.look.starK, pxr, tier, 0], u_galN: toS(GAL_N), u_galC: toS(GAL_C), u_galK: 0.03 }, tex: {} });
    const list = [];
    for (const id of SS.ORDER) { const rel = sub(bs[id].p, cam); list.push({ id, rel, d: len(rel) }); }
    list.sort((a, b) => b.d - a.d);
    let vis = 1;
    for (const it of list) {
      const id = it.id, b = bs[id], R = B[id].R, d = it.d;
      if (d <= R * 1.0005) continue;
      const cd = toS(mul(it.rel, 1 / d)), ang = Math.asin(R / d);
      vis *= smooth(ang - sunAng, ang + sunAng, Math.acos(Math.max(-1, Math.min(1, dot(cd, sunS)))));
      if (ang * pxr < 0.5) continue;
      const margin = id === 'herz' ? 1.019 : id === 'amarant' ? 1.035 : LOOK[id] && LOOK[id].mk[0] > 0.5 ? 1.022 : 1.0;
      const angQ = Math.asin(Math.min(1, R * margin / d)) + 2 / pxr, full = angQ > 1.15;
      const bu = perp(Math.abs(cd[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], cd), bv = cross(cd, bu);
      const F = SS.frame(b), rows = [toS(F[0]), toS(F[1]), toS(F[2])];
      const m3 = [rows[0][0], rows[1][0], rows[2][0], rows[0][1], rows[1][1], rows[2][1], rows[0][2], rows[1][2], rows[2][2]];
      const sunB = SS.toBody(F, norm(sub(bs.helia.p, b.p)));
      const base = { u_cdir: cd, u_bu: bu, u_bv: bv, u_half: full ? 0 : Math.tan(angQ) * 1.02, u_toBody: m3, u_sunB: sunB, u_sunCol: SUN };
      fr.bodies[id] = { ang, d, full };
      if (id === 'herz') fr.bodies[id].camB = SS.toBody(F, sub(cam, b.p));   // u-orbitlod: the camera in Herzwelt's body frame (m) for the planet tiles
      if (id === 'amarant') {
        const camB = mul(SS.toBody(F, sub(cam, b.p)), 1 / R), flat = B.amarant.Rp / R;
        fr.draws.push({ prog: 'giant', full, u: Object.assign(base, { u_camB: camB, u_flat: flat, u_flow: [eph.t % 300000, 2.2e-5, tier, 1], u_ringK: [RING.r0, RING.r1, 0, 0] }), tex: { u_bands: 'amarant', u_ring: 'ring' } });
        const r1 = RING.r1 * R / d, sa = Math.asin(B.helia.R / len(sub(bs.helia.p, b.p)));
        fr.draws.push({ prog: 'ring', u: { u_rc: cd, u_ra: mul(rows[0], r1), u_rb: mul(rows[2], r1), u_toBody: m3, u_camB: camB, u_flat: flat, u_sunB: sunB, u_sunCol: SUN, u_plCol: mul(SUN, 0.035), u_ringK: [RING.r0, RING.r1, sa, tier] }, tex: { u_ring: 'ring' } });
        continue;
      }
      const par = bs[PARENT[id]], parB = SS.toBody(F, norm(sub(par.p, b.p))), parCol = SS.parentLight(eph, id);
      if (id === 'herz') {
        const pt = o.patch && o.patch.on ? o.patch : null;
        fr.draws.push({ prog: 'herz', full, u: Object.assign(base, { u_d: d / R, u_parB: parB, u_parCol: parCol, u_patch: pt ? [pt.x0, pt.z0, 1 / pt.size, 1] : [0, 0, 1, 0], u_chart: [C.Px, C.Pz, C.phiH, C.R], u_air: [0, eph.t % 100000, tier, 0.05], u_look: [0.55, 1.0, 1.0, 1.0], u_px: [pt ? pt.step : 100, 200] }), tex: { u_texA: 'herzA', u_texB: 'herzB', u_patA: pt ? 'patchA' : 'herzA', u_patB: pt ? 'patchB' : 'herzB' } });
      } else {
        const L = LOOK[id];
        fr.draws.push({ prog: 'moon', full, u: Object.assign(base, { u_d: d / R, u_parB: parB, u_parCol: parCol, u_mk: L.mk, u_airCol: L.col, u_grain: [tier, R / 200] }), tex: { u_tex: id } });
      }
    }
    fr.sunVis = vis;
    if (vis > 0.01) {
      const bu = perp(Math.abs(sunS[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], sunS), bv = cross(sunS, bu);
      fr.draws.push({ prog: 'glare', add: true, u: { u_cdir: sunS, u_bu: bu, u_bv: bv, u_half: Math.tan(26 * D2R), u_sunDir: sunS, u_sunCol: SUN, u_gl: [vis, sunAng, 1.0, o.bloom ? 0.6 : 0.0] }, tex: {} });
    }
    return fr;
  };

  // ================================================================ GL (the game's page; not in node)
  if (typeof window === 'undefined' || !VR.Renderer || !VR.GL) return;
  const GL = VR.GL;
  const ST = SS.state = { tex: {}, texBytes: {}, bytes: 0, jobs: {}, progs: {}, seed: 0, patch: null, blank: null, patchKeys: [] };
  const T = (k, v, fb) => (VR.I18N ? VR.I18N.t(k, v, fb) : (fb !== undefined ? fb : k));
  function program(name) {
    if (ST.progs[name] !== undefined) return ST.progs[name];
    const src = VR.SpaceShaders.programs()[name];
    try { ST.progs[name] = GL.program(src.vs, src.fs, 'space.' + name, []); }
    catch (e) { console.error('space shader ' + name + ' failed: ' + (e && e.message)); ST.progs[name] = null; }
    return ST.progs[name];
  }
  function setU(gl, p, k, v) {
    const loc = p.u[k]; if (loc === undefined || loc === null) return;
    if (typeof v === 'number') gl.uniform1f(loc, v);
    else if (v.length === 2) gl.uniform2f(loc, v[0], v[1]);
    else if (v.length === 3) gl.uniform3f(loc, v[0], v[1], v[2]);
    else if (v.length === 4) gl.uniform4f(loc, v[0], v[1], v[2], v[3]);
    else if (v.length === 9) gl.uniformMatrix3fv(loc, false, v);
    else if (v.length === 16) gl.uniformMatrix4fv(loc, false, v);
  }
  function blank(gl) { if (!ST.blank) ST.blank = GL.tex2D(1, 1, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, { data: new Uint8Array([90, 100, 110, 255]) }); return ST.blank; }
  function upload(gl, key, w, h, data, srgb, repeat) {
    let t = ST.tex[key];
    if (!t) t = ST.tex[key] = gl.createTexture(); else ST.bytes -= ST.texBytes[key] || 0;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.texImage2D(gl.TEXTURE_2D, 0, srgb ? gl.SRGB8_ALPHA8 : gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const an = GL.ext && GL.ext.aniso; if (an) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, 8);
    gl.bindTexture(gl.TEXTURE_2D, null);
    ST.texBytes[key] = w * h * 4 * 4 / 3; ST.bytes += ST.texBytes[key];
  }
  // the worker's row jobs of one texture; the rows gathered, then one upload with its mipmaps
  function request(g, body, tier, extra) {
    const key = body + '@' + tier + (extra ? '@' + Math.round(extra.cx) + ',' + Math.round(extra.cz) : '');
    let st = ST.jobs[key];
    if (st) return st;
    const list = VR.BodyTex.jobs(body, tier, extra), j0 = list[0];
    st = ST.jobs[key] = { key, body, tier, w: j0.w, h: j0.h, left: list.length, rows: 0, a: new Uint8Array(j0.w * j0.h * 4), b: VR.BodyTex.TWO[body] ? new Uint8Array(j0.w * j0.h * 4) : null, ms: 0, maxMs: 0, t0: performance.now(), wall: 0, done: false, err: 0, extra: extra || null, jobs: list.length };
    const send = (j) => g.pool.submit(j, null, (m) => got(g, st, j, m), 1);
    st.send = send;
    for (const j of list) { j.seed = ST.seed; send(j); }
    return st;
  }
  // a patch's two textures deleted (the newest two are kept: a long session of /raum at many places stays bounded)
  function dropPatch(gl, key) {
    for (const n of ['patchA@', 'patchB@']) { const k = n + key; if (ST.tex[k]) { gl.deleteTexture(ST.tex[k]); ST.bytes -= ST.texBytes[k] || 0; delete ST.tex[k]; delete ST.texBytes[k]; } }
    delete ST.jobs[key];
  }
  function got(g, st, j, m) {
    if (ST.jobs[st.key] !== st) return;   // (dropped meanwhile: another world)
    if (!m || m.type !== 'bodytex' || !m.a) { if (st.err++ < 3) { delete j.id; st.send(j); } return; }
    st.a.set(m.a, m.y0 * st.w * 4); if (st.b && m.b) st.b.set(m.b, m.y0 * st.w * 4);
    st.ms += m.ms; st.maxMs = Math.max(st.maxMs, m.ms); st.rows += m.y1 - m.y0;
    if (--st.left > 0) return;
    const gl = g.renderer && g.renderer.gl; if (!gl) return;
    const b = st.body, rep = b !== 'patch' && b !== 'ring';
    if (b === 'herz' || b === 'patch') { upload(gl, (b === 'herz' ? 'herzA' : 'patchA') + '@' + st.key, st.w, st.h, st.a, true, rep); upload(gl, (b === 'herz' ? 'herzB' : 'patchB') + '@' + st.key, st.w, st.h, st.b, false, rep); }
    if (b === 'patch') { ST.patchKeys = ST.patchKeys.filter(k => k !== st.key); ST.patchKeys.push(st.key); while (ST.patchKeys.length > 2) dropPatch(gl, ST.patchKeys.shift()); }
    else upload(gl, b + '@' + st.key, st.w, st.h, st.a, true, rep);
    st.a = st.b = null; st.done = true; st.wall = performance.now() - st.t0;
  }
  // the textures a view needs at a tier (asked for once); true when all are there
  const MOONS = () => VR.BodyTex.MOONS;
  SS.needs = function (g, anc, tier) {
    if (VR.PlanetLODGL) VR.PlanetLODGL.game = g;   // u-orbitlod
    const want = [request(g, 'herz', tier), request(g, 'amarant', tier), request(g, 'ring', tier)];
    for (const id of MOONS()) want.push(request(g, id, tier));
    let pst = null;
    if (anc && anc.nadir) { const cx = Math.round(anc.nadir.x / 500) * 500, cz = Math.round(anc.nadir.z / 500) * 500; pst = request(g, 'patch', tier, { cx, cz }); want.push(pst); }
    SS.cur_need = want;
    // the names the draw list uses → this tier's textures (the patch: the view's own when it is there)
    const map = SS.texMap || (SS.texMap = {});
    map.herzA = 'herzA@herz@' + tier; map.herzB = 'herzB@herz@' + tier; map.amarant = 'amarant@amarant@' + tier; map.ring = 'ring@ring@' + tier;
    for (const id of MOONS()) map[id] = id + '@' + id + '@' + tier;
    if (pst && pst.done) { map.patchA = 'patchA@' + pst.key; map.patchB = 'patchB@' + pst.key; ST.patch = { x0: pst.extra.cx - pst.w * VR.BodyTex.size('patch', tier)[1] / 2, z0: pst.extra.cz - pst.w * VR.BodyTex.size('patch', tier)[1] / 2, size: pst.w * VR.BodyTex.size('patch', tier)[1], step: VR.BodyTex.size('patch', tier)[1], on: true }; }
    else if (!pst) ST.patch = null;
    return want.every(s => s.done);
  };
  // drop every texture (a new world: a new Herzwelt)
  SS.drop = function (g) {
    const gl = g && g.renderer && g.renderer.gl;
    if (gl) for (const k in ST.tex) gl.deleteTexture(ST.tex[k]);
    if (gl && VR.PlanetLODGL) VR.PlanetLODGL.clear(gl);   // u-orbitlod
    ST.tex = {}; ST.texBytes = {}; ST.bytes = 0; ST.jobs = {}; ST.patch = null; ST.patchKeys = [];
  };
  // the renderer's own frame calls this (F.drawOpaque) with the scene's framebuffer bound
  SS.draw = function (r) {
    const fr = SS.cur; if (!fr) return;
    const gl = r.gl, map = SS.texMap || {};
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(r.emptyVAO);
    for (const d of fr.draws) {
      const p = program(VR.SpaceShaders.progFor(d)); if (!p) continue;
      const tn = d.prog === 'herz' && VR.PlanetLODGL ? VR.PlanetLODGL.draw(r, d, fr.bodies.herz, null, null, map, (k) => ST.tex[k] || blank(gl)) : 0;   // u-orbitlod: the planet tiles first, the impostor at the far plane behind them
      gl.useProgram(p.p);
      if (d.prog === 'bg') gl.disable(gl.BLEND); else { gl.enable(gl.BLEND); if (d.add) gl.blendFunc(gl.ONE, gl.ONE); else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); }
      setU(gl, p, 'u_viewProj', r.viewProj); setU(gl, p, 'u_invViewProj', r.invViewProj);
      for (const k in d.u) setU(gl, p, k, d.u[k]);
      let unit = 0;
      for (const k in d.tex) { if (!p.u[k]) continue; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, ST.tex[map[d.tex[k]]] || blank(gl)); gl.uniform1i(p.u[k], unit); unit++; }
      if (tn) VR.PlanetLODGL.before(gl, p, tn, setU);   // u-orbitlod
      gl.drawArrays(gl.TRIANGLES, 0, d.full ? 3 : 6);
      if (tn) VR.PlanetLODGL.after(gl, p, tn, setU);   // u-orbitlod
      r.stats.draws++; r.stats.tris += d.full ? 1 : 2;
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.disable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
  };
  // the env of a space frame: dimId 6 (t-light2's hooks, the god rays, the clouds and the sky stay off), black around,
  // the view's exposure; the composite's tone curve, saturation and vignette do the rest
  const ES = { dimId: 6, fogColor: [0, 0, 0], fog: [0, 0, 0, 1], sunDir: [0, 1, 0], moonDir: [0, -1, 0], sunColor: [1, 1, 1], moonColor: [0, 0, 0], ambSky: [0, 0, 0], zenith: [0, 0, 0], horizon: [0, 0, 0], sunset: [0, 0, 0], skyMid: [0, 0, 0], blockTint: [1, 1, 1], planetDir: [0, 1, 0], planet2Dir: [0, 1, 0], ringNormal: [0, 1, 0], night: 0, time: 0, rain: 0, snow: 0, wet: 0, puddle: 0, wind: 0, windDir: [1, 0], gust: 0, cloudCover: 0, cloudDrift: [0, 0], emissiveBoost: 1, exposure: 3, bloomThreshold: 1.6, bloomStrength: 0.07, vignette: 0.3, saturation: 1.12, contrast: 0.05, grade: [1, 1, 1], vivid: 0.45, rays: 0, nebula: 0, sunDisc: 0, gridK: 0, snowCover: 0 };
  SS.env = ES;

  // ================================================================ the game: /raum, the frame, the switch
  const G = VR.Game; if (!G) return;
  // Weltraum-Detail (Bild · Qualität): 0 Very Low … 3 High — the texture sizes, the star grids, the clouds' detail, the
  // ring's finest ringlets; the preset's own unless the player sets it
  const TIER = { potato: 0, low: 1, balanced: 2, high: 3, ultra: 3, ultraLite: 3 };
  if (G.PRESETS) for (const k in G.PRESETS) if (G.PRESETS[k].spaceDetail === undefined) G.PRESETS[k].spaceDetail = TIER[k] !== undefined ? TIER[k] : 2;
  if (VR.Settings && VR.Settings.add) VR.Settings.add({ key: 'spaceDetail', g: 'img', sec: 'quality', t: 'slider', lab: 'g.set.spaceDetail', tip: 'g.set.spaceDetail.tip', cost: 'mid', def: 2, min: 0, max: 3, step: 1, vals: 'g.set.spaceDetailV' });
  SS.tier = (g) => { const s = (g && g.settings) || {}; const v = s.spaceDetail; return v === undefined || v === null ? (TIER[s.preset] !== undefined ? TIER[s.preset] : 2) : Math.max(0, Math.min(3, v | 0)); };
  const PLACES = { herz: 'herz', herzwelt: 'herz', amarant: 'amarant', zinn: 'zinn', zinnober: 'zinn', aqua: 'aqua', aquamarin: 'aqua' };
  const hud = (on) => { const h = document.getElementById('hud'); if (h) h.style.visibility = on ? 'visible' : 'hidden'; };
  SS.open = function (g, name) {
    if (!g.renderer || !g.pool || !g.player) return false;
    const p = g.player, t = SS.worldTime(g.env.day, g.env.ticks), eph = SS.ephemeris(t, {});
    const v = SS.view(name, eph, { x: p.pos[0], z: p.pos[2], yaw: p.yaw });
    if (!v) return false;
    ST.seed = ((g.meta && g.meta.seed) >>> 0) || 0x5eed;
    g.space = { name, anc: SS.anchor(v, eph), eph, yaw: 0, pitch: 0, since: performance.now(), ready: false, frames: 0, cam: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, fov: v.fov, far: 100 } };
    const ready = SS.needs(g, g.space.anc, SS.tier(g));
    g.ui.chatLine(ready ? T('g.space.on', { place: T('g.space.place.' + name) }) : T('g.space.wait'), '#cfe6ff');
    return true;
  };
  SS.close = function (g) {
    if (!g.space) return;
    const shown = g.space.shown;
    g.space = null; SS.cur = null;
    if (g.renderer) g.renderer.tsrReset = true;
    if (shown) hud(!g.hideHud);
  };
  G.prototype.raumCommand = function (arg) {
    const w = String(arg || '').toLowerCase(), name = PLACES[w];
    if (!w || w === 'aus' || w === 'off') { if (this.space) { SS.close(this); this.ui.chatLine(T('g.space.off'), '#cfe6ff'); } else this.ui.chatLine(T('g.space.help'), '#cfe6ff'); return; }
    if (!name) { this.ui.chatLine(T('g.space.help'), '#ffcf8a'); return; }
    if (this.space) SS.close(this);
    SS.open(this, name);
  };
  // one space frame (SS.step — SS.frame is a body's axes): Esc leaves, T / Enter / / open the chat, the mouse turns the
  // view; the clock and the weather's schedule go on, the world itself waits (it is not updated and not torn down)
  SS.step = function (g, dt) {
    const S = g.space, r = g.renderer, i = g.input, ui = g.ui;
    if (!ui.typing) {
      if (i.hit('Escape')) { if (ui.screen) ui.resume(); else { SS.close(g); ui.chatLine(T('g.space.off'), '#cfe6ff'); return; } }
      else if (!ui.screen) { if (i.hit('KeyT') || i.hit('Enter')) ui.openChat(''); else if (i.hit('Slash')) ui.openChat('/'); if (i.hit('F2') && g.screenshot) g.screenshot(); }
    }
    if (!ui.screen && !ui.typing) { const k = i.sensitivity || 0.0022; S.yaw -= i.mouse.dx * k; S.pitch = Math.max(-1.45, Math.min(1.45, S.pitch - i.mouse.dy * k * (i.invertY ? -1 : 1))); }
    g.time += dt;
    g.envFor([0, 64, 0], dt, { freezeTime: g.zenFreezeTime, freezeWeather: g.zenFreezeWeather });
    if (g.pool) g.pool.pump();
    const tier = SS.tier(g);
    SS.needs(g, S.anc, tier);
    SS.ephemeris(SS.worldTime(g.env.day, g.env.ticks), S.eph);
    const fr = SS.cur = SS.frameSetup(S, S.eph, { H: r.H, tier, bloom: !!(r.q.bloom && r.hdr), patch: ST.patch });
    ES.sunDir = fr.sunS; ES.moonDir = [-fr.sunS[0], -fr.sunS[1], -fr.sunS[2]]; ES.exposure = fr.look.exposure; ES.time = g.env.anim || g.time;
    ES.bloomStrength = 0.06; ES.bloomThreshold = 1.4;
    const c = S.cam; c.yaw = S.yaw; c.pitch = S.pitch; c.fov = fr.fov;
    r.render({ cam: c, world: null, env: ES, noSky: true, drawOpaque: SS.draw });
    S.frames++;
  };
  // while a view is open its frames replace the play frame (until its textures are there the ground goes on)
  const origPlay = G.prototype.playFrame;
  G.prototype.playFrame = function (dt) {
    const S = this.space;
    if (S && !S.ready) {
      S.ready = SS.needs(this, S.anc, SS.tier(this)) || performance.now() - S.since > 45000;
      if (S.ready) { S.shown = true; hud(false); if (this.renderer) this.renderer.tsrReset = true; this.ui.chatLine(T('g.space.on', { place: T('g.space.place.' + S.name) }), '#cfe6ff'); }
    }
    if (S && S.ready) return SS.step(this, dt);
    return origPlay.call(this, dt);
  };
  const origTear = G.prototype.teardownWorld;
  G.prototype.teardownWorld = function () { if (this.space) SS.close(this); SS.drop(this); return origTear.apply(this, arguments); };
  // what the test reads: the view, its textures' worker time, the GPU bytes, the last frame's draws
  SS.stats = function (g) {
    const jobs = {};
    for (const k in ST.jobs) { const s = ST.jobs[k]; jobs[k] = { done: s.done, ms: +s.ms.toFixed(0), maxMs: +s.maxMs.toFixed(0), wall: +s.wall.toFixed(0), jobs: s.jobs, w: s.w, h: s.h }; }
    const r = g && g.renderer;
    return { open: !!(g && g.space), ready: !!(g && g.space && g.space.ready), name: g && g.space ? g.space.name : null, tier: SS.tier(g), gpuMB: +(ST.bytes / 1048576).toFixed(2), patches: ST.patchKeys.length, jobs, draws: r ? r.stats.draws : 0, sunVis: SS.cur ? +SS.cur.sunVis.toFixed(3) : null, exposure: SS.cur ? SS.cur.look.exposure : null, progs: Object.keys(ST.progs).filter(k => ST.progs[k]).length, failed: Object.keys(ST.progs).filter(k => !ST.progs[k]) };
  };
})(VR);

// ============================================================================
// u-ascent · VR.Entry — re-entry and the landing anywhere on Herzwelt (docs/superpowers/plans/2026-10-22-u-ascent.md §3.5;
// U§4.4, §4.5, §5.6; REFERENCE §1.9). From orbit „Landen" (G, V or /landen): a retro burn lowers the orbit's low point into
// the air, the ship meets the air nose first and brakes on its reverse thrust and the drag while the plasma glows (the
// heating ρv³, U§4.4: by ρ, not by height — a white-yellow core at the nose, a violet-blue sheath at the edge, an
// orange-yellow wake with sparks), the hover jets hold the sink; where the speed is gone (≈ 1,400 m, the plasma cleared
// near 1,500) it sinks straight down, and the last 300 m are flight.js's own landing. The place it stops is predicted by
// flying the same guidance ahead (≈ 2 ms every 3 s), and the voxel world streams there from the start of the entry — the
// land is there when the plasma clears. Local time = the world clock + the longitude (U§4.5), faded in between 4 and 12 km
// from the Heartland, so the Heartland keeps its clock exactly.
//   · pure part (node: test/ascent.js) above the line; the glow overlay, the streaming and the hand-over below it
// ============================================================================
(function (VR) {
  'use strict';
  const EN = VR.Entry = {};
  const A = VR.Ascent, UNI = () => VR.Universe;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const M = A.math, dot = M.dot, len = M.len, unit = M.unit, v3 = M.v3;
  const set3 = (o, x, y, z) => { o[0] = x; o[1] = y; o[2] = z; return o; };

  // ---------------------------------------------------------------- local time (U§4.5)
  // the ticks to add to the world clock at a map point: the longitude east of the Heartland as a share of the day (94
  // ticks a km east at the Heartland's latitude), faded in from 4 to 12 km so the Heartland's sky is the clock's own
  EN.FADE = [4000, 12000];
  EN.tickShift = (x, z) => {
    const d = Math.hypot(x, z); if (!(d > EN.FADE[0])) return 0;
    const ch = UNI().chart('herz');
    let s = ch.localTicks(x, z, 0);
    if (s > 12000) s -= 24000;
    return s * ss(EN.FADE[0], EN.FADE[1], d);
  };

  // ---------------------------------------------------------------- the guidance: deorbit → entry → descend
  EN.DEORBIT_DV = 160;      // m/s of retro burn: the low point well into the air (test/ascent.js f: the plasma ~2,700 → 1,600 m)
  EN.REV = 1.25;            // g of reverse thrust in the entry (the nose first, the engine braking against the way)
  const G = { nose: v3(), up: null, throttle: 0, boost: false, jets: 'off', sink: null, keepClimb: false, hvel: null, done: false };
  const _up = v3(), _va = v3(), _h = v3(), _d = v3(), _hv = v3(), _hvel = v3();
  const reset = () => { G.up = null; G.throttle = 0; G.boost = false; G.jets = 'off'; G.sink = null; G.keepClimb = true; G.hvel = null; G.done = false; return G; };
  // the sink the jets hold in the entry and the descent: 40 m/s high up, slowing to 8 m/s near 300 m
  EN.sinkFor = (y, phase) => (phase === 'entry' ? (y > 2000 ? -40 : -clamp((y - 1400) * 0.08, 10, 40)) : -clamp((y - 300) * 0.1, 8, 40));
  EN.guide = (fl, h, a) => {
    const A_ = fl.auto, st = a.st, o = reset();
    if (st.frame !== 'herz') { o.done = true; A_.offWorld = true; return o; }
    const y = A.mapY(st);
    unit(st.r, _up);
    A.airVelocity(st, _va);
    const vu = dot(_va, _up);
    set3(_h, _va[0] - _up[0] * vu, _va[1] - _up[1] * vu, _va[2] - _up[2] * vu);
    const vh = len(_h);
    if (!A_.phase) A_.phase = A_.space === 'descend' ? 'descend' : (A.orbitOf(st).peri > A.BAND.top - 300 ? 'deorbit' : 'entry');
    if (A_.phase === 'deorbit') {
      unit(st.v, o.nose); o.nose[0] = -o.nose[0]; o.nose[1] = -o.nose[1]; o.nose[2] = -o.nose[2];
      const k = VR.SpaceFlight ? VR.SpaceFlight.aligned(a.S, o.nose) : 1;
      o.throttle = (2 / 3) * k;
      A_.dv = (A_.dv || 0) + 2 * A.SHIP.g * k * h;
      if (A_.dv >= EN.DEORBIT_DV) A_.phase = 'entry';
      return o;
    }
    if (A_.phase === 'entry') {
      // nose first into the air, the reverse thrust braking below 2,900 m, the jets holding the sink below 2,600 m
      if (vh > 1) unit(_h, _d); else set3(_d, -a.S[2], -a.S[5], -a.S[8]);
      unit(_va, o.nose);
      o.throttle = y < 2900 ? -EN.REV / A.SHIP.thrust : 0;
      if (y < 2600) { o.jets = 'radial'; o.sink = EN.sinkFor(y, 'entry'); }
      if (vh < 5 && y < 2600) A_.phase = 'descend';
      return o;
    }
    // the descent: level, straight down over the place (or toward A_.target), the jets carry it, hold the sink and steer the
    // map velocity (to rest, or toward the site); below the cap the air regime's landing takes over (ascent.js autoAir)
    if (vh > 1) unit(_h, _d); else { set3(_d, -a.S[2], -a.S[5], -a.S[8]); const k = dot(_d, _up); set3(_d, _d[0] - _up[0] * k, _d[1] - _up[1] * k, _d[2] - _up[2] * k); if (len(_d) < 1e-6) set3(_d, 1, 0, 0); unit(_d, _d); }
    set3(o.nose, _d[0], _d[1], _d[2]);
    o.jets = 'flat'; o.keepClimb = false;
    let dist = 0;
    o.hvel = set3(_hvel, 0, 0, 0);
    if (A_.target) {
      // toward the place (Heimkehr: the temple's apron): the map velocity toward it, slowing on the way in (2 m/s² of
      // braking, at most 60 m/s)
      dist = EN.siteDir(st, A_.target, _hv);
      const vd = Math.min(60, Math.sqrt(2 * 2 * Math.max(0, dist - 5)));
      set3(o.hvel, _hv[0] * vd, _hv[1] * vd, _hv[2] * vd);
      if (dist > 20) set3(o.nose, _hv[0], _hv[1], _hv[2]);
    }
    o.sink = dist > 150 ? 0 : EN.sinkFor(y, 'descend');
    return o;
  };
  // the horizontal way to a map site (unit, system axes, into out) and its distance (m) from the state's ground point
  const _sp = v3(), _sv = v3();
  EN.siteDir = (st, site, out) => {
    const S = UNI().home;
    S.chartToInertial('herz', [site.x, A.mapY(st), site.z], null, st.t, _sp, _sv);
    unit(st.r, _up);
    set3(out, _sp[0] - st.r[0], _sp[1] - st.r[1], _sp[2] - st.r[2]);
    const k = dot(out, _up); set3(out, out[0] - _up[0] * k, out[1] - _up[1] * k, out[2] - _up[2] * k);
    const d = len(out); if (d > 1e-6) { out[0] /= d; out[1] /= d; out[2] /= d; }
    return d;
  };

  // ---------------------------------------------------------------- where the entry will end (the place to stream)
  // the same guidance flown ahead on a copy (the attitude assumed to follow at once), 1/10 s steps with the drag and the
  // jets; returns the map point {x, z, y, t (s ahead)} where the descent reaches 400 m — or null
  EN.predict = (stIn, phase, maxT) => {
    const U = UNI(), S = U.home, b = S.body('herz'), mu = b.mu, w = b.spin.w, ax = b.spin.axis, g0 = A.SHIP.g;
    const r = Float64Array.from(stIn.r), v = Float64Array.from(stIn.v);
    let t = stIn.t, ph = phase || 'entry', dvUsed = 0;
    const T = maxT || 260;
    const up = v3(), va = v3(), hh = v3(), acc = v3(), wr = v3();
    for (let s = 0, dt = 0.1; s < T; s += dt) {
      const rr = len(r), y = A.DATUM + rr - b.R;
      // (a quarter second in the vacuum and the thin air above the jets' 2,600 m, a tenth below: ~1 ms for a whole entry)
      dt = ph !== 'deorbit' && y > 2650 ? 0.25 : 0.1;
      set3(up, r[0] / rr, r[1] / rr, r[2] / rr);
      set3(wr, w * (ax[1] * r[2] - ax[2] * r[1]), w * (ax[2] * r[0] - ax[0] * r[2]), w * (ax[0] * r[1] - ax[1] * r[0]));
      set3(va, v[0] - wr[0], v[1] - wr[1], v[2] - wr[2]);
      const vaL = len(va), vu = dot(va, up);
      set3(hh, va[0] - up[0] * vu, va[1] - up[1] * vu, va[2] - up[2] * vu);
      const vh = len(hh);
      const g = mu / (rr * rr);
      set3(acc, -up[0] * g, -up[1] * g, -up[2] * g);
      if (ph === 'deorbit') { const vl = len(v); acc[0] -= v[0] / vl * 2 * g0; acc[1] -= v[1] / vl * 2 * g0; acc[2] -= v[2] / vl * 2 * g0; dvUsed += 2 * g0 * dt; if (dvUsed >= EN.DEORBIT_DV) ph = 'entry'; }
      else if (ph === 'entry') {
        if (y < 2900 && vaL > 1e-3) { const k = EN.REV * g0 / vaL; acc[0] -= va[0] * k; acc[1] -= va[1] * k; acc[2] -= va[2] * k; }
        if (y < 2600) { const need = g - (vh * vh) / rr + (EN.sinkFor(y, 'entry') - vu) * 0.9; const j = clamp(need, 0, A.SHIP.jets * g0); acc[0] += up[0] * j; acc[1] += up[1] * j; acc[2] += up[2] * j; }
        if (vh < 5 && y < 2600) ph = 'descend';
      } else {
        // straight down (the flat jets keep the map velocity: the place stays)
        const pos = [0, 0, 0]; S.inertialToChart('herz', r, v, t, pos, null);
        if (y < 400) return { x: pos[0], z: pos[2], y, t: s };
        // (the rest of the way is straight down: the place is known)
        return { x: pos[0], z: pos[2], y, t: s + Math.max(0, y - 300) / 30 };
      }
      const rho = A.rho(y);
      if (rho > 0) { const kd = -rho * vaL / (2 * A.SHIP.beta); acc[0] += kd * va[0]; acc[1] += kd * va[1]; acc[2] += kd * va[2]; }
      // semi-implicit Euler (a tenth of a second: a few metres of error over the whole entry)
      v[0] += acc[0] * dt; v[1] += acc[1] * dt; v[2] += acc[2] * dt;
      r[0] += v[0] * dt; r[1] += v[1] * dt; r[2] += v[2] * dt;
      t += dt;
      if (y < 200) break;
    }
    return null;
  };

  // ================================================================ the game's glue (a page with the game)
  if (typeof window === 'undefined' || !VR.Game) return;
  EN.page = true;
  // each frame of the climb and of space (ascent.js A.frame, spaceflight.js SF.frame): the landing place predicted every
  // 3 s from the start of the entry (the autopilot's site: the nav tile and the HUD show it, the tiles and the chunks
  // stream there as the ship slows), the sparks off the nose in the plasma (from Low up), the roar
  EN.tick = function (g, fl, dt) {
    const A_ = fl.auto, a = fl.asc; if (!a) return;
    if (A_ && A_.space === 'land' && (A_.phase === 'entry' || A_.phase === 'deorbit') && a.st.frame === 'herz') {
      if ((A_.predT = (A_.predT || 0) - dt) <= 0) {
        A_.predT = 3;
        const P = EN.predict(a.st, A_.phase);
        if (P) { A_.pred = P; if (A_.site) { A_.site.x = P.x; A_.site.z = P.z; } A_.dist = Math.hypot(P.x - fl.b.pos[0], P.z - fl.b.pos[2]); A_.eta = P.t; }
      }
    }
    const I = a.info, glow = A.glowOf(I.q), P = g.particles, b = fl.b;
    if (glow > 0.05 && P && ((g.settings && g.settings.particles) | 0) > 0 && fl.toWorld) {
      const n = fl.dirWorld([0, 0, -1]), Lb = (b.length || 12) * 0.5, H = (b.height || 4) * 0.4;
      const k = Math.min(6, 1 + glow * 5) * (g.settings.particles >= 2 ? 1 : 0.5);
      for (let i = 0; i < k; i++) {
        if (Math.random() > 0.7) continue;
        const w = fl.toWorld([(Math.random() - 0.5) * (b.width || 6) * 0.6, H + (Math.random() - 0.5) * H, -Lb]);
        const sp = 18 + Math.random() * 30, hot = Math.random() < 0.4;
        P.spawn(w[0], w[1], w[2], b.vel[0] - n[0] * sp + (Math.random() - 0.5) * 8, b.vel[1] - n[1] * sp + (Math.random() - 0.5) * 8, b.vel[2] - n[2] * sp + (Math.random() - 0.5) * 8,
          { life: 0.35 + Math.random() * 0.4, size: 0.18 + Math.random() * 0.25, grav: 0, col: hot ? [1, 0.95, 0.75] : [1, 0.55 + Math.random() * 0.2, 0.2], emis: 1, drag: 2.5, grow: 0.6, collide: false });
      }
    }
  };
})(VR);

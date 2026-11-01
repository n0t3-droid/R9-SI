// ============================================================================
// x-robo · VR.Robo — the people's motion borrowed from robotics and physics (our own implementations of textbook maths):
//   · legIK / legFK / plant — a two-bone leg in its plane (the law of cosines), the feet planted on the ground under them
//     (a stair, a slab, a slope), the hips dropped so both feet reach; footGround samples the ground under a foot
//   · orca — reciprocal collision avoidance: each neighbour forbids a half-plane of velocities (the velocity obstacle for a
//     time horizon, each side taking its share of the turn), a small 2-D linear program picks the allowed velocity nearest
//     the wanted one (and, when nothing is allowed, the one that breaks the half-planes least)
//   · spring / pendulum — a damped harmonic oscillator solved exactly over the step (stable at any dt); a pendulum in an
//     accelerating frame (small angles: its rest angle leans against the acceleration)
//   · gaze — the head jumps between fixations (quick, damped), pursues a slowly moving target, blinks spontaneously
//     (~15 a minute), mostly with a big gaze shift, now and then twice
// Pure maths, no GL, no allocation in the hot calls (node test: test/robo.js). The hooks live in villages.js (x-robo blocks).
// Tiers (Robo.tier): Very Low or the animation switch off → 0 (nothing), Low → 1 (avoidance), Balanced and up → 2.
// ============================================================================
(function (VR) {
  'use strict';
  const Rb = VR.Robo = VR.Robo || {};
  Rb.off = Rb.off || false;
  Rb.tier = function (g) {
    if (Rb.off) return 0;
    const s = g && g.settings;
    if (!s || s.anim === false || s.preset === 'potato') return 0;
    return s.preset === 'low' ? 1 : 2;
  };

  // ------------------------------------------------------------------ the leg: two bones in the leg's plane
  // hip at the origin, the foot at f forward, y down (y > 0 below the hip) → o = [thigh angle (+ forward), knee bend ≥ 0]
  Rb.legIK = function (Lt, Ls, f, y, o) {
    let d = Math.hypot(f, y); const dmax = (Lt + Ls) * 0.9999;
    const dir = Math.atan2(f, y);
    if (d < 1e-6) d = 1e-6;
    if (d >= dmax) { o[0] = dir; o[1] = 0; return o; }
    const dmin = Math.abs(Lt - Ls) + 1e-6; if (d < dmin) d = dmin;
    const cK = (Lt * Lt + Ls * Ls - d * d) / (2 * Lt * Ls);
    const cA = (Lt * Lt + d * d - Ls * Ls) / (2 * Lt * d);
    o[0] = dir + Math.acos(cA < -1 ? -1 : cA > 1 ? 1 : cA);
    o[1] = Math.PI - Math.acos(cK < -1 ? -1 : cK > 1 ? 1 : cK);
    return o;
  };
  // the foot of a thigh at angle th with the shin folded back by k → o = [forward, down]
  Rb.legFK = function (Lt, Ls, th, k, o) {
    o[0] = Lt * Math.sin(th) + Ls * Math.sin(th - k);
    o[1] = Lt * Math.cos(th) + Ls * Math.cos(th - k);
    return o;
  };
  const FK = [0, 0], IK = [0, 0];
  // plant the feet of a pose: gL, gR the ground under each foot above the root's ground (model units). The swing foot keeps
  // its lift over its own ground; the hips go as high as both legs allow (never above the pose's own), the legs re-solve.
  // Returns the hips' extra drop (≤ 0, model units). Flat ground (|g| < 0.3 units): the pose stays as it is.
  Rb.plant = function (G, P, gL, gR) {
    if (gL > -0.3 && gL < 0.3 && gR > -0.3 && gR < 0.3) return 0;
    const Lt = G.thigh, Ls = G.shin, Le = (Lt + Ls) * 0.999, hip = G.hip;
    const lo = -0.35 * hip, hi = 0.4 * hip;
    gL = gL < lo ? lo : gL > hi ? hi : gL; gR = gR < lo ? lo : gR > hi ? hi : gR;
    const LL = P.leg_l, LR = P.leg_r, SL = P.shin_l, SR = P.shin_r;
    if (!LL || !LR || !SL || !SR) return 0;
    const hb = hip + LL[4];
    Rb.legFK(Lt, Ls, LL[0], -SL[0], FK); const fL = FK[0], liftL = Math.max(0, hb - FK[1]);
    Rb.legFK(Lt, Ls, LR[0], -SR[0], FK); const fR = FK[0], liftR = Math.max(0, hip + LR[4] - FK[1]);
    const mL = gL + liftL + Math.sqrt(Math.max(0, Le * Le - fL * fL)), mR = gR + liftR + Math.sqrt(Math.max(0, Le * Le - fR * fR));
    let hh = hb + Math.max(0, Math.min(gL, gR));
    if (mL < hh) hh = mL; if (mR < hh) hh = mR;
    const dh = hh - hb;
    Rb.legIK(Lt, Ls, fL, hh - gL - liftL, IK); LL[0] = IK[0]; SL[0] = -IK[1]; LL[4] += dh;
    Rb.legIK(Lt, Ls, fR, hh - gR - liftR, IK); LR[0] = IK[0]; SR[0] = -IK[1]; LR[4] += dh;
    if (P.hips) P.hips[4] += dh;
    return dh;
  };
  // the ground's height under a foot at (x, z) near the height y (absolute), NaN when there is none within a block.
  // C: the foot's cache (the cell's kind, corners or boxes), refreshed when the foot enters another cell
  const bilin = (c, fx, fz) => c[0] * (1 - fx) * (1 - fz) + c[1] * (1 - fx) * fz + c[2] * fx * fz + c[3] * fx * (1 - fz);
  Rb.footGround = function (get, x, y, z, C) {
    const ix = Math.floor(x), iz = Math.floor(z), y0 = Math.floor(y - 0.02);
    if (C.ix !== ix || C.iz !== iz || C.y0 !== y0) {
      C.ix = ix; C.iz = iz; C.y0 = y0; C.kind = 0;
      const R = VR.R, F = VR.F, PH = VR.PHYS, TF = R.T.flags;
      for (let yy = y0 + 1; yy >= y0 - 1; yy--) {
        const s = get(ix, yy, iz); if (!s || !(TF[s] & F.SOLID)) continue;
        if (TF[s] & F.SMOOTH) {
          const c = C.c || (C.c = [0, 0, 0, 0]);
          if (PH.smoothCorners(get, ix, yy, iz, c)) C.kind = 2; else { C.kind = 1; C.h = yy + 1; }
        } else { C.kind = 3; C.b = PH.collision(s); C.h = yy; }
        break;
      }
    }
    const fx = x - ix, fz = z - iz;
    if (C.kind === 1) return C.h;
    if (C.kind === 2) return bilin(C.c, fx, fz);
    if (C.kind === 3) {
      const B = C.b; let top = -1;
      for (let i = 0; i < B.length; i++) { const b = B[i]; if (fx >= b[0] - 1e-6 && fx <= b[3] + 1e-6 && fz >= b[2] - 1e-6 && fz <= b[5] + 1e-6 && b[4] > top) top = b[4]; }
      return top < 0 ? NaN : C.h + top;
    }
    return NaN;
  };

  // ------------------------------------------------------------------ ORCA: reciprocal collision avoidance
  // self: { x, z, vx, vz, r, pvx, pvz (the wanted velocity), vmax }; nb[0 … n): { x, z, vx, vz, r, resp } (resp: this
  // agent's share of the avoiding — 0.5 between two who both yield, 1 toward one who does not, e.g. the player).
  // tau: the time horizon (s), dt: the step (for a pair already touching). out ← the new velocity.
  const MAXL = 24;
  Rb.KEEP = 0.12;
  const LP = new Float64Array(MAXL * 4), LQ = new Float64Array(MAXL * 4), RES = [0, 0], TMP = [0, 0];
  const det = (ax, az, bx, bz) => ax * bz - az * bx;
  Rb.orca = function (self, nb, n, tau, dt, out) {
    if (n > MAXL) n = MAXL;
    const it = 1 / tau;
    let m = 0;
    for (let i = 0; i < n; i++) {
      const b = nb[i];
      const px = b.x - self.x, pz = b.z - self.z, vx = self.vx - b.vx, vz = self.vz - b.vz;
      const R = self.r + b.r, R2 = R * R, d2 = px * px + pz * pz;
      let dx, dz, ux, uz;
      if (d2 > R2) {
        const wx = vx - it * px, wz = vz - it * pz, wl2 = wx * wx + wz * wz, dot = wx * px + wz * pz;
        if (dot < 0 && dot * dot > R2 * wl2) {   // the cut-off circle's side
          const wl = Math.sqrt(wl2) || 1e-9, nx = wx / wl, nz = wz / wl;
          dx = nz; dz = -nx; ux = (R * it - wl) * nx; uz = (R * it - wl) * nz;
        } else {                                  // a leg of the cone
          const leg = Math.sqrt(d2 - R2);
          if (det(px, pz, wx, wz) > 0) { dx = (px * leg - pz * R) / d2; dz = (px * R + pz * leg) / d2; }
          else { dx = -(px * leg + pz * R) / d2; dz = -(-px * R + pz * leg) / d2; }
          const s = vx * dx + vz * dz; ux = s * dx - vx; uz = s * dz - vz;
        }
      } else {                                    // already touching: get apart within this step
        const idt = 1 / dt, wx = vx - idt * px, wz = vz - idt * pz, wl = Math.hypot(wx, wz) || 1e-9, nx = wx / wl, nz = wz / wl;
        dx = nz; dz = -nx; ux = (R * idt - wl) * nx; uz = (R * idt - wl) * nz;
      }
      const k = b.resp === undefined ? 0.5 : b.resp, o = m * 4;
      LP[o] = self.vx + k * ux; LP[o + 1] = self.vz + k * uz; LP[o + 2] = dx; LP[o + 3] = dz; m++;
    }
    const vmax = self.vmax;
    // people keep to the right: with someone coming, the wanted velocity turns a little right (it breaks the deadlock of
    // two who would mirror each other for ever)
    let pvx = self.pvx, pvz = self.pvz;
    // (a jam — someone held still far from its goal — turns it further: the crowd swirls round instead of standing)
    const jam = self.jam || 0;
    if (m) { const an = Rb.KEEP + Math.min(1, jam / 1.2) * 1.1, c = Math.cos(an), s = Math.sin(an); const x = pvx * c + pvz * s; pvz = -pvx * s + pvz * c; pvx = x; }
    const fail = lp2(LP, m, vmax, pvx, pvz, false, RES);
    if (fail < m) lp3(LP, m, fail, vmax, RES);
    const want2 = self.pvx * self.pvx + self.pvz * self.pvz;
    self.jam = want2 > 0.04 && RES[0] * RES[0] + RES[1] * RES[1] < want2 * 0.09 ? jam + dt : Math.max(0, jam - dt * 0.5);
    out[0] = RES[0]; out[1] = RES[1];
    return out;
  };
  // the best point on line i inside the circle and every earlier half-plane (false: none)
  function lp1(L, i, r, ox, oz, dirOpt, res) {
    const o = i * 4, px = L[o], pz = L[o + 1], dx = L[o + 2], dz = L[o + 3];
    const dot = px * dx + pz * dz, disc = dot * dot + r * r - (px * px + pz * pz);
    if (disc < 0) return false;
    const sq = Math.sqrt(disc);
    let tL = -dot - sq, tR = -dot + sq;
    for (let j = 0; j < i; j++) {
      const q = j * 4, den = det(dx, dz, L[q + 2], L[q + 3]), num = det(L[q + 2], L[q + 3], px - L[q], pz - L[q + 1]);
      if (Math.abs(den) <= 1e-9) { if (num < 0) return false; continue; }
      const t = num / den;
      if (den >= 0) { if (t < tR) tR = t; } else if (t > tL) tL = t;
      if (tL > tR) return false;
    }
    let t;
    if (dirOpt) t = ox * dx + oz * dz > 0 ? tR : tL;
    else { t = dx * (ox - px) + dz * (oz - pz); if (t < tL) t = tL; else if (t > tR) t = tR; }
    res[0] = px + t * dx; res[1] = pz + t * dz;
    return true;
  }
  // the allowed velocity nearest (ox, oz) (dirOpt: furthest along the unit direction (ox, oz)); returns the count of lines
  // satisfied (m: all; else the first line that could not be)
  function lp2(L, m, r, ox, oz, dirOpt, res) {
    if (dirOpt) { res[0] = ox * r; res[1] = oz * r; }
    else { const l2 = ox * ox + oz * oz; if (l2 > r * r) { const l = Math.sqrt(l2); res[0] = ox / l * r; res[1] = oz / l * r; } else { res[0] = ox; res[1] = oz; } }
    for (let i = 0; i < m; i++) {
      const o = i * 4;
      if (det(L[o + 2], L[o + 3], L[o] - res[0], L[o + 1] - res[1]) > 0) {
        const sx = res[0], sz = res[1];
        if (!lp1(L, i, r, ox, oz, dirOpt, res)) { res[0] = sx; res[1] = sz; return i; }
      }
    }
    return m;
  }
  // nothing satisfies all: the velocity that breaks the half-planes least (each line in turn, projected)
  function lp3(L, m, begin, r, res) {
    let dist = 0;
    for (let i = begin; i < m; i++) {
      const o = i * 4, ipx = L[o], ipz = L[o + 1], idx = L[o + 2], idz = L[o + 3];
      if (det(idx, idz, ipx - res[0], ipz - res[1]) <= dist) continue;
      let k = 0;
      for (let j = 0; j < i; j++) {
        const q = j * 4, jdx = L[q + 2], jdz = L[q + 3], dd = det(idx, idz, jdx, jdz);
        let px, pz;
        if (Math.abs(dd) <= 1e-9) { if (idx * jdx + idz * jdz > 0) continue; px = 0.5 * (ipx + L[q]); pz = 0.5 * (ipz + L[q + 1]); }
        else { const t = det(jdx, jdz, ipx - L[q], ipz - L[q + 1]) / dd; px = ipx + t * idx; pz = ipz + t * idz; }
        let nx = jdx - idx, nz = jdz - idz; const nl = Math.hypot(nx, nz) || 1e-9; nx /= nl; nz /= nl;
        const w = k * 4; LQ[w] = px; LQ[w + 1] = pz; LQ[w + 2] = nx; LQ[w + 3] = nz; k++;
      }
      TMP[0] = res[0]; TMP[1] = res[1];
      if (lp2(LQ, k, r, -idz, idx, true, res) < k) { res[0] = TMP[0]; res[1] = TMP[1]; }
      dist = det(idx, idz, ipx - res[0], ipz - res[1]);
    }
  }

  // ------------------------------------------------------------------ springs
  // s = { x, v } toward target with the natural frequency w (rad/s) and damping ratio z < 1, exactly over dt
  Rb.spring = function (s, target, w, z, dt) {
    const e = s.x - target, v = s.v;
    if (!(dt > 0)) return s;
    const a = z * w, wd = w * Math.sqrt(Math.max(1e-6, 1 - z * z));
    const ex = Math.exp(-a * dt), c = Math.cos(wd * dt), sn = Math.sin(wd * dt);
    const B = (v + a * e) / wd;
    s.x = target + ex * (e * c + B * sn);
    // (the solution's dx/dt: ex·[−a (e c + B sn) + wd (B c − e sn)])
    s.v = ex * (-a * (e * c + B * sn) + (-e * wd * sn + B * wd * c));
    return s;
  };
  // a pendulum (angle s.x, + forward) hanging in a frame accelerating forward by acc (b/s²): its rest angle leans back by
  // atan(acc / g); w = √(g / L), z its damping. The angle stays within ±1.2 rad.
  Rb.pendulum = function (s, acc, w, z, dt) {
    let t = -acc / 9.8; t = t < -0.9 ? -0.9 : t > 0.9 ? 0.9 : t;
    Rb.spring(s, t, w, z, dt);
    if (s.x > 1.2) { s.x = 1.2; if (s.v > 0) s.v = 0; } else if (s.x < -1.2) { s.x = -1.2; if (s.v < 0) s.v = 0; }
    return s;
  };

  // ------------------------------------------------------------------ the gaze
  // R: the person's gaze state; (ty, tp) where the head wants to look (yaw, pitch, rad, relative to the body); rnd → [0, 1).
  // R.hy, R.hp: the head's angles; R.blink: the lids are down; R.nfix counts the fixations.
  const SG = { w: 13, z: 0.82 };
  Rb.gaze = function (R, ty, tp, dt, rnd) {
    if (R.hy === undefined) { R.hy = ty; R.hp = tp; R.sy = { x: ty, v: 0 }; R.sp = { x: tp, v: 0 }; R.fy = ty; R.fp = tp; R.fixT = 0.3 + rnd() * 1.2; R.nfix = 0; R.blinkT = 0.5 + rnd() * 3; R.bl = 0; R.blink = false; R.dbl = 0; }
    R.fixT -= dt;
    const ey = ty - R.fy, ep = tp - R.fp, err = Math.abs(ey) + Math.abs(ep);
    if (err > 0.32 || R.fixT <= 0) {
      // a new fixation: where the target is (a little off: nobody lands exactly), held for a log-normal while
      const big = Math.abs(ey) > 0.5;
      R.fy = ty + (rnd() - 0.5) * 0.1; R.fp = tp + (rnd() - 0.5) * 0.05;
      const u = rnd() + rnd() + rnd() - 1.5;   // ~ normal (σ ½)
      R.fixT = Math.min(2.5, Math.max(0.3, 0.85 * Math.exp(u * 0.9)));
      R.nfix++;
      if (big && rnd() < 0.8) { R.bl = 0.13; R.blinkT = 2 + rnd() * 3; }
    } else { const k = Math.min(1, dt * 0.9); R.fy += ey * k; R.fp += ep * k; }   // the slow pursuit of a moving target
    Rb.spring(R.sy, R.fy, SG.w, SG.z, dt); Rb.spring(R.sp, R.fp, SG.w, SG.z, dt);
    R.hy = R.sy.x; R.hp = R.sp.x;
    // spontaneous blinks (~ every 4 s, from 1.2 s), now and then a second right after
    R.blinkT -= dt;
    if (R.blinkT <= 0 && R.bl <= 0) { R.bl = 0.13; R.blinkT = 1.2 + -Math.log(1 - rnd() * 0.999) * 2.8; if (rnd() < 0.12) R.dbl = 0.3; }
    if (R.dbl > 0) { R.dbl -= dt; if (R.dbl <= 0 && R.bl <= 0) R.bl = 0.12; }
    if (R.bl > 0) { R.bl -= dt; R.blink = true; } else R.blink = false;
    return R;
  };
})(VR);

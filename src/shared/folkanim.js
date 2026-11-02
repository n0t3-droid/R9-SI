// ============================================================================
// FolkAnim — the villagers' animation system. The rig (folkmodel.js) has ten
// joints: body, head, upper arms, forearms (elbows), thighs and shins (knees).
// A pose is { joint: [rx, ry, rz, tx, ty, tz] } — +rx swings a limb forward
// (the models face −z), +rz moves the right arm out to the side (the left arm
// uses −rz), translations are in model units (1/32 block). Clips are keyframe
// tracks per joint with eased interpolation; the walk and run cycles are
// parametric (driven by the walking phase), everything else is a clip. States
// crossfade, and the game layers the head look-at, blinking and the talking
// mouth on top. The Model Studio edits the clips with the same code.
// ============================================================================
(function (VR) {
  'use strict';
  const FA = VR.FolkAnim = {};
  // (t-folk: 'hips' — the people's pelvis, the root of their rig: the walk sways it, the idle shifts the weight on it;
  // t-folk2: the hands at the wrists and the things they hold — parts of the smooth people's rig only, the voxel people
  // keep hand and tool in the forearm)
  const JOINTS = FA.JOINTS = ['hips', 'body', 'head', 'arm_l', 'arm_r', 'fore_l', 'fore_r', 'leg_l', 'leg_r', 'shin_l', 'shin_r', 'hand_l', 'hand_r', 'item_l', 'item_r'];
  const clips = FA.clips = {};
  const Z6 = () => [0, 0, 0, 0, 0, 0];
  const ease = (t) => t * t * (3 - 2 * t);

  // clip: { len, loop, tracks: { joint: [[t, rx, ry, rz, tx, ty, tz], …] } } (keys in time order; missing joints stay at rest)
  FA.define = function (name, clip) { clip.name = name; for (const j in clip.tracks) clip.tracks[j].sort((a, b) => a[0] - b[0]); clips[name] = clip; return clip; };
  // the pose of a clip at time t (seconds)
  FA.sample = function (clip, t, out) {
    out = out || {};
    const L = clip.len || 1;
    const tt = clip.loop ? ((t % L) + L) % L : Math.min(L, Math.max(0, t));
    for (const j of JOINTS) {
      const keys = clip.tracks[j], o = out[j] || (out[j] = Z6());
      if (!keys || !keys.length) { o[0] = o[1] = o[2] = o[3] = o[4] = o[5] = 0; continue; }
      const last = keys.length - 1;
      let i = -1; for (let k = 0; k <= last; k++) { if (keys[k][0] <= tt) i = k; else break; }
      let a, b, ta, tb;
      if (keys.length === 1 || (i < 0 && !clip.loop)) { a = keys[0]; for (let k = 0; k < 6; k++) o[k] = a[k + 1] || 0; continue; }
      if (i === last && !clip.loop) { a = keys[last]; for (let k = 0; k < 6; k++) o[k] = a[k + 1] || 0; continue; }
      if (i < 0) { a = keys[last]; b = keys[0]; ta = a[0] - L; tb = b[0]; }
      else if (i === last) { a = keys[last]; b = keys[0]; ta = a[0]; tb = b[0] + L; }
      else { a = keys[i]; b = keys[i + 1]; ta = a[0]; tb = b[0]; }
      const f = tb <= ta ? 0 : ease((tt - ta) / (tb - ta));
      for (let k = 0; k < 6; k++) { const va = a[k + 1] || 0, vb = b[k + 1] || 0; o[k] = va + (vb - va) * f; }
    }
    return out;
  };
  // the parametric walk / run cycle: ph = walking phase, amt = 0..1 blend from standing, run = faster gait,
  // k = the stride's strength (1 = the villagers' gait; the heroes stride out with k ≈ 1.2). Allocation-free: the
  // joint arrays of `out` are reused from call to call, and the same phase always gives the same numbers.
  const setJ = (out, j, rx, rz, ty, ry) => { const o = out[j] || (out[j] = Z6()); o[0] = rx; o[1] = ry || 0; o[2] = rz || 0; o[3] = 0; o[4] = ty || 0; o[5] = 0; };
  // the shin folds while the leg swings through
  const kneeAt = (ph, sg, amt, run) => -Math.max(0, -Math.sin(ph * sg + 0.6)) * (run ? 1.4 : 0.9) * amt;
  FA.walk = function (ph, amt, run, out, k) {
    out = out || {};
    const kk = k === undefined ? 1 : k;
    const s = Math.sin(ph) * (run ? 0.95 : 0.68) * amt * kk, c = Math.cos(ph);
    const bob = Math.abs(c) * amt * (run ? 1.8 : 0.9) * kk;
    setJ(out, 'leg_l', s, 0, 0); setJ(out, 'shin_l', kneeAt(ph, 1, amt, run), 0, 0); setJ(out, 'leg_r', -s, 0, 0); setJ(out, 'shin_r', kneeAt(ph, -1, amt, run), 0, 0);
    setJ(out, 'arm_l', -s * 0.9 + (run ? 0.35 : 0) * amt, -0.07, bob); setJ(out, 'arm_r', s * 0.9 + (run ? 0.35 : 0) * amt, 0.07, bob);
    setJ(out, 'fore_l', (run ? 1.1 : 0.3) * amt, 0, 0); setJ(out, 'fore_r', (run ? 1.1 : 0.3) * amt, 0, 0);
    setJ(out, 'body', run ? -0.18 * amt : 0, 0, bob); setJ(out, 'head', run ? 0.1 * amt : 0, 0, bob);   // (t-folk2: a runner leans forward: the torso's −rx)
    return out;
  };
  FA.lerp = function (a, b, k, out) {
    out = out || {};
    for (const j of JOINTS) { const pa = a[j] || Z6(), pb = b[j] || Z6(), o = out[j] || (out[j] = Z6()); for (let i = 0; i < 6; i++) o[i] = pa[i] + (pb[i] - pa[i]) * k; }
    return out;
  };

  // ------------------------------------------------------------------ t-folk: the people's gait
  // The villagers of the real-proportions rig (folkmodel.js buildPerson) walk on their own legs: each foot has a stance
  // (60 % of a walking cycle, 38 % running) in which it moves back under the hip exactly as fast as the body moves on —
  // a planted foot does not slide — and a swing in which it lifts and comes forward again. The phase runs with the
  // distance walked, one cycle every two steps; the step length grows with the pace and is held to what the clothes let
  // the thigh swing (a robe's legs stay inside its hem). The legs reach their feet by a two-bone solve (hip, knee): the
  // pelvis rides as high as the stance leg allows (the bob of a real walk), shifts over the stance foot and drops a little
  // on the swinging side (the weight shift), turns with the forward leg while the shoulders turn against it; the arms
  // swing against the legs, the elbows bend more as an arm comes forward, the head stays level.
  // G (FA.gait): { unit, scale (the draw scale), hip, thigh, shin (model units), maxSwing (rad), kid, ph, S } — ph and S are
  // the walker's own (advanced by FA.stride each pose), the rest the rig's.
  // (t-folk2: arm { L1 the upper arm, L2 the forearm to the wrist, x, y the shoulder joint over the hip joint }, hw the
  // torso's half width, wide the skirt's half width at the hand's height (a robe holds the arms out), carry 'bag' | 'basket'
  // | 'can' in the right hand, cane in the left, item the right hand's tool, skirt: the clothes' family for sitting)
  FA.gait = function (o) {
    const unit = o.unit || 32, scale = o.scale || 1, thigh = o.thigh, shin = o.shin;
    return { unit, scale, hip: o.hip || thigh + shin, thigh, shin, L: thigh + shin, maxSwing: o.stride || 0.6, kid: !!o.kid, bpu: scale / unit, ph: o.ph || 0, S: 0, run: false, stoop: o.stoop || 0,
      arm: o.arm || null, hw: o.hw || 4, legX: o.legX || 2.5, wide: o.wide || 0, carry: o.carry || null, cane: !!o.cane, item: o.item || null, skirt: o.skirt || 0 };
  };
  const BETA_W = 0.6, BETA_R = 0.38;
  // the step length (blocks) at speed v (blocks a second)
  FA.stepLen = function (G, v, run) {
    const Lb = G.L * G.bpu;
    const S = run ? Math.min(1.45 * Lb, Math.max(0.6 * Lb, 0.42 * v)) : Math.max(0.35 * Lb, Math.min(0.95 * Lb, 0.4 * v));
    // a foot in stance reaches ±β·S from under the hip: the thigh's swing asin(β S / L) stays within the clothes' maxSwing
    const Smax = Math.sin(G.maxSwing) * Lb / (run ? BETA_R : BETA_W);
    return Math.min(S, Smax);
  };
  // advance the walker's phase by the distance walked (v · dt); the step length follows the pace smoothly
  FA.stride = function (G, v, dt, run) {
    const S = FA.stepLen(G, Math.max(v, 0.3), run);
    G.S = G.S > 0 ? G.S + (S - G.S) * Math.min(1, dt * 4) : S;
    G.run = !!run;
    if (v > 0.01) G.ph = (G.ph + (v * dt) / (2 * G.S) * Math.PI * 2) % (Math.PI * 2);
    return G;
  };
  // one leg's foot at phase u (0…1 of its cycle): its distance in front of the hip (model units) and its lift
  const footAt = (u, R, beta, lift, o) => {
    if (u < beta) { o[0] = R * (1 - 2 * u / beta); o[1] = 0; o[2] = Math.sin(Math.PI * u / beta); }   // [forward, lift, stance weight]
    else { const s = (u - beta) / (1 - beta), e = s * s * (3 - 2 * s); o[0] = -R + 2 * R * e; o[1] = lift * Math.sin(Math.PI * s); o[2] = 0; }
    return o;
  };
  // the two-bone solve in the leg's plane: the hip at the origin, the foot at (f forward, −y down) → [thigh angle (+ forward),
  // knee bend (≥ 0; the shin folds back by it)]
  const legIK = (Lt, Ls, f, y, o) => {
    let d = Math.hypot(f, y); const dmax = (Lt + Ls) * 0.9995;
    if (d > dmax) d = dmax; if (d < 1e-6) d = 1e-6;
    const cK = (Lt * Lt + Ls * Ls - d * d) / (2 * Lt * Ls), knee = Math.PI - Math.acos(Math.max(-1, Math.min(1, cK)));
    const cA = (Lt * Lt + d * d - Ls * Ls) / (2 * Lt * d), alpha = Math.acos(Math.max(-1, Math.min(1, cA)));
    o[0] = Math.atan2(f, y) + alpha; o[1] = knee;
    return o;
  };
  const FL = [0, 0, 0], FR = [0, 0, 0], IK = [0, 0];
  // the walk of a person: the pose (allocation-free, `out`'s arrays reused) of the cycle at G.ph with G.S; amt scales the
  // upper body's motion (the legs always reach their feet)
  FA.walkPerson = function (G, amt, out) {
    const run = G.run, beta = run ? BETA_R : BETA_W, S = (G.S || FA.stepLen(G, 1.4, run)) / G.bpu;   // (S in model units)
    const R = beta * S, Lt = G.thigh, Ls = G.shin, Le = (Lt + Ls) * 0.997;   // (a stance knee a little soft: some 7°)
    const long = G.maxSwing < 0.4;   // (a robe, a coat, a dress: a shorter lift, the thigh held inside the hem)
    const lift = (run ? 0.16 : long ? 0.045 : 0.075) * (Lt + Ls);
    const TAU = Math.PI * 2, u = ((G.ph % TAU) + TAU) % TAU / TAU;
    footAt(u, R, beta, lift, FL); footAt((u + 0.5) % 1, R, beta, lift, FR);
    // the pelvis as high as both legs allow — a lifted foot by its lift less (never above the standing hip): the stance
    // leg carries it, the swinging one takes over smoothly as its foot comes down
    const h = Math.min(G.hip, Math.sqrt(Math.max(0, Le * Le - FL[0] * FL[0])) + FL[1], Math.sqrt(Math.max(0, Le * Le - FR[0] * FR[0])) + FR[1]);
    const drop = G.hip - h;
    const wL = FL[2], wR = FR[2];
    // the legs
    legIK(Lt, Ls, FL[0], h - FL[1], IK); let thL = IK[0]; const kL = IK[1];
    legIK(Lt, Ls, FR[0], h - FR[1], IK); let thR = IK[0]; const kR = IK[1];
    if (long) { const cap = G.maxSwing * 1.25; if (u >= beta && thL > cap) thL = cap; if ((u + 0.5) % 1 >= beta && thR > cap) thR = cap; }   // (a swinging thigh only: a planted foot stays where it is)
    // the pelvis over the stance foot (+x is the right); the hip joints go with it, the legs lean back so the feet keep
    // their tracks
    const sx = 0.55 * (wR - wL) * amt, lean = -Math.asin(Math.max(-0.5, Math.min(0.5, sx / h)));
    setJ6(out, 'leg_l', thL, 0, lean, sx, -drop, 0); setJ6(out, 'shin_l', -kL, 0, 0, 0, 0, 0);
    setJ6(out, 'leg_r', thR, 0, lean, sx, -drop, 0); setJ6(out, 'shin_r', -kR, 0, 0, 0, 0, 0);
    // the pelvis: turned with the forward leg, dropped on the swinging side; the shoulders turn and roll against it
    const lead = (FL[0] - FR[0]) / (2 * R || 1);
    const hipYaw = -0.1 * lead * amt, hipRoll = -0.045 * (wL - wR) * amt;
    setJ6(out, 'hips', 0, hipYaw, hipRoll, sx, -drop, 0);
    // (t-folk2: the torso's +rx tips it back — it points up, a limb down: a walker leans a little forward, a runner more,
    // the head up against it)
    setJ6(out, 'body', -(run ? 0.14 : 0.035) * amt, -1.7 * hipYaw, 0.7 * -hipRoll, 0, 0, 0);
    setJ6(out, 'head', (run ? 0.1 : 0.02) * amt, 0.7 * hipYaw, -0.3 * hipRoll, 0, 0, 0);
    // the arms against the legs, swung from the shoulder: the left arm comes forward with the right leg (t-folk2: the
    // elbow follows the swing a little late — armSwing; what the hand carries changes the arm)
    const A = (run ? 0.75 : 0.16 + 0.55 * R / (Lt + Ls)) * amt;
    footAt((u - LAG + 1) % 1, R, beta, lift, FLAG); footAt((u + 1.5 - LAG) % 1, R, beta, lift, FRAG);
    const aL = -A * (FL[0] / (R || 1)), aR = -A * (FR[0] / (R || 1));
    const aLl = -A * (FLAG[0] / (R || 1)), aRl = -A * (FRAG[0] / (R || 1));
    armSwing(out, 'l', aL, aLl, run, amt, G.cane ? 'cane' : null, G.wide);
    armSwing(out, 'r', aR, aRl, run, amt, G.carry, G.wide);
    holdItems(G, out);
    return out;
  };
  // ------------------------------------------------------------------ t-folk2: the arms (the owner: arms like posts)
  // The rest pose of a person standing: the upper arm 7° out from the body, the elbow 12° bent with the forearm turned a
  // little in and back toward the thigh (the hand in front of the thigh, its palm toward it, the thumb forward) — from the
  // front the arm bends at the elbow instead of hanging as one post. The walk keeps 6° of it.
  const REST = FA.REST = { abd: 0.12, flex: 0.21, back: 0.09, turn: 0.22 };
  const LAG = 0.09, FLAG = [0, 0, 0], FRAG = [0, 0, 0];
  // one arm of the walk: a the upper arm's swing (+ forward), al the same a little earlier — the elbow follows it, bent
  // more as the arm comes forward (some 15° behind, 30° in front; running 70–85°). A bag, a basket or a can pulls its arm
  // straight (the elbow 3°, 9° out to clear the thigh) and swings a third as far; a cane's arm swings half, the elbow bent;
  // a tray's forearm stays level before the chest. A robe's or a gown's wide skirt holds the arms 3° further out
  function armSwing(out, s, a, al, run, amt, load, wide) {
    const sx = s === 'l' ? -1 : 1, w = wide ? 0.05 : 0;
    let rx, rz, fx, fz, fy;
    if (load === 'bag' || load === 'basket' || load === 'can' || load === 'lantern') { rx = a * 0.35; rz = sx * (0.16 + w) * amt; fx = 0.05 * amt; fz = 0; fy = 0; }
    else if (load === 'cane') { rx = a * 0.5 + 0.12 * amt; rz = sx * (0.08 + w) * amt; fx = (0.35 + 0.25 * Math.max(0, al)) * amt; fz = 0; fy = 0; }
    else if (load === 'tray') { rx = 0.12 * amt; rz = sx * 0.1 * amt; fx = 1.45 * amt; fz = 0; fy = sx * 0.3 * amt; }
    else {
      rx = a + (run ? 0.3 : 0) * amt; rz = sx * (0.1 + w) * amt;
      fx = ((run ? 1.2 : 0.26) + (run ? 0.3 : 0.6) * Math.max(0, al)) * amt;
      fz = -sx * REST.back * 0.7 * amt; fy = sx * REST.turn * 0.6 * amt;
    }
    setJ6(out, 'arm_' + s, rx, 0, rz, 0, 0, 0);
    setJ6(out, 'fore_' + s, fx, fy, fz, 0, 0, 0);
    setJ6(out, 'hand_' + s, load === 'tray' ? 0 : 0.08 * amt, load === 'tray' ? -sx * 1.45 : 0, 0, 0, 0, 0);
  }
  // ---- a little 3 × 3 algebra (row-major, scratch arrays: no allocation once warm)
  const M3a = new Float64Array(9), M3b = new Float64Array(9), M3c = new Float64Array(9), M3d = new Float64Array(9), V3a = [0, 0, 0], V3b = [0, 0, 0], V3c = [0, 0, 0], V3d = [0, 0, 0], V3e = [0, 0, 0], V3f = [0, 0, 0];
  // R = Ry(ry)·Rx(rx)·Rz(rz): the rotation folksmooth.js rigMats (and entities.js drawModel) applies for a pose
  const rotYXZ = FA.rotYXZ = function (rx, ry, rz, R) {
    const ca = Math.cos(ry), sa = Math.sin(ry), cb = Math.cos(rx), sb = Math.sin(rx), cc = Math.cos(rz), sc = Math.sin(rz);
    R[0] = ca * cc + sa * sb * sc; R[1] = -ca * sc + sa * sb * cc; R[2] = sa * cb;
    R[3] = cb * sc; R[4] = cb * cc; R[5] = -sb;
    R[6] = -sa * cc + ca * sb * sc; R[7] = sa * sc + ca * sb * cc; R[8] = ca * cb;
    return R;
  };
  // the pose angles [rx, ry, rz] of a rotation matrix (the inverse of rotYXZ)
  const eulerOf = FA.eulerOf = function (R, o) {
    const sb = Math.max(-1, Math.min(1, -R[5]));
    o[0] = Math.asin(sb);
    if (Math.abs(sb) < 0.99999) { o[1] = Math.atan2(R[2], R[8]); o[2] = Math.atan2(R[3], R[4]); }
    else { o[1] = Math.atan2(-R[6], R[0]); o[2] = 0; }
    return o;
  };
  const mulM3 = (a, b, o) => { for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]; return o; };
  const mulTV = (R, v, o) => { const x = R[0] * v[0] + R[3] * v[1] + R[6] * v[2], y = R[1] * v[0] + R[4] * v[1] + R[7] * v[2], z = R[2] * v[0] + R[5] * v[1] + R[8] * v[2]; o[0] = x; o[1] = y; o[2] = z; return o; };   // Rᵀ·v
  const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; v[0] /= l; v[1] /= l; v[2] /= l; return v; };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const jointR = (P, j, R) => { const q = P[j]; return q ? rotYXZ(q[0] || 0, q[1] || 0, q[2] || 0, R) : rotYXZ(0, 0, 0, R); };
  // ---- the arm solve: the wrist onto W (the body's frame: its origin at the hip joint, +x the person's right, −z ahead)
  // with the elbow toward the pole; the upper arm along its frame's −y, the elbow bending toward its −z (the pose's +rx).
  // Writes arm_<s> and fore_<s>; → the distance left between the wrist and W (0 when reachable)
  FA.armIK = function (G, s, W, pole, out) {
    const A = G.arm; if (!A) return Infinity;
    const sx = s === 'l' ? -1 : 1, L1 = A.L1, L2 = A.L2;
    const v = V3a; v[0] = W[0] - sx * A.x; v[1] = W[1] - A.y; v[2] = W[2];
    const d0 = Math.hypot(v[0], v[1], v[2]) || 1e-6, d = Math.max(Math.abs(L1 - L2) + 0.01, Math.min(L1 + L2 - 0.01, d0));
    v[0] /= d0; v[1] /= d0; v[2] /= d0;
    const cA = Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))), al = Math.acos(cA);
    // the pole's part across the reach, the elbow's side
    const p = V3b; p[0] = pole[0]; p[1] = pole[1]; p[2] = pole[2];
    const k = dot(p, v); p[0] -= k * v[0]; p[1] -= k * v[1]; p[2] -= k * v[2];
    if (Math.hypot(p[0], p[1], p[2]) < 1e-6) { p[0] = sx; p[1] = 0; p[2] = 0.3; } norm(p);
    const u = V3c; u[0] = Math.cos(al) * v[0] + Math.sin(al) * p[0]; u[1] = Math.cos(al) * v[1] + Math.sin(al) * p[1]; u[2] = Math.cos(al) * v[2] + Math.sin(al) * p[2];
    // the forearm's direction from the elbow to the (reachable) wrist
    const f = V3d; f[0] = v[0] * d - L1 * u[0]; f[1] = v[1] * d - L1 * u[1]; f[2] = v[2] * d - L1 * u[2]; norm(f);
    const flex = Math.acos(Math.max(-1, Math.min(1, dot(u, f))));
    // the arm's frame: y = −u, z = −(the forearm's part across u), x = y × z
    let cx = f[0] - dot(f, u) * u[0], cy = f[1] - dot(f, u) * u[1], cz = f[2] - dot(f, u) * u[2];
    let cl = Math.hypot(cx, cy, cz);
    if (cl < 1e-6) { cx = 0; cy = 0; cz = -1; const q = cz * u[2]; cx -= q * u[0]; cy -= q * u[1]; cz -= q * u[2]; cl = Math.hypot(cx, cy, cz) || 1; }
    cx /= cl; cy /= cl; cz /= cl;
    const yx = -u[0], yy = -u[1], yz = -u[2], zx = -cx, zy = -cy, zz = -cz;
    const xx = yy * zz - yz * zy, xy = yz * zx - yx * zz, xz = yx * zy - yy * zx;
    const R = M3a; R[0] = xx; R[1] = yx; R[2] = zx; R[3] = xy; R[4] = yy; R[5] = zy; R[6] = xz; R[7] = yz; R[8] = zz;
    const e = eulerOf(R, V3b);
    setJ6(out, 'arm_' + s, e[0], e[1], e[2], 0, 0, 0);
    setJ6(out, 'fore_' + s, flex, 0, 0, 0, 0, 0);
    return Math.max(0, d0 - d);
  };
  // the hand of side s turned so its fingers point along dir (the body's frame), twisted by tw about them (its palm, which
  // faces the body's middle at rest, turned by tw); the arm and forearm angles already in P
  FA.handAim = function (P, s, dir, tw, out) {
    const Rw = mulM3(jointR(P, 'arm_' + s, M3a), jointR(P, 'fore_' + s, M3b), M3c);
    const d = mulTV(Rw, dir, V3a); norm(d);
    // the shortest turn of (0, −1, 0) onto d: about (0, −1, 0) × d = (−d.z, 0, d.x)
    let ax = -d[2], az = d[0]; const al = Math.hypot(ax, az), th = Math.atan2(al, -d[1]);
    if (al > 1e-9) { ax /= al; az /= al; } else { ax = 1; az = 0; }
    const c = Math.cos(th), sn = Math.sin(th), t = 1 - c, R = M3d;
    R[0] = t * ax * ax + c; R[1] = -sn * az; R[2] = t * ax * az;
    R[3] = sn * az; R[4] = c; R[5] = -sn * ax;
    R[6] = t * ax * az; R[7] = sn * ax; R[8] = t * az * az + c;
    if (tw) mulM3(R, rotYXZ(0, tw, 0, M3a), M3b); else M3b.set(R);
    const e = eulerOf(M3b, V3b);
    setJ6(out, 'hand_' + s, e[0], e[1], e[2], 0, 0, 0);
    return out;
  };
  // the body's frame relative to the root (the hips' turn, then the body's): R = R_hips·R_body
  const bodyR = (P, R) => mulM3(jointR(P, 'hips', M3a), jointR(P, 'body', M3b), R);
  // a point of the root frame (origin at the hip joint) in the body's frame
  const toBody = (P, X, o) => { const R = bodyR(P, M3c); return mulTV(R, X, o); };
  // the things in the hands: a bag, a basket or a can hangs straight down (its pose turns it back against the arm, the
  // hand and the body), a cane too (its tip under the hand), a tray stays level (as the hand holds it)
  const IT = { bag: 1, basket: 1, can: 1, tray: 1, lantern: 1 };   // (f-polish4: the lamplighter's lantern hangs too)
  function holdItems(G, P) {
    if (G.carry && IT[G.carry]) hangItem(P, 'r');
    if (G.cane) hangItem(P, 'l');
  }
  function hangItem(P, s) {
    const R = mulM3(bodyR(P, M3c), jointR(P, 'arm_' + s, M3a), M3b);
    mulM3(R, jointR(P, 'fore_' + s, M3a), M3c);
    mulM3(M3c, jointR(P, 'hand_' + s, M3a), M3b);
    // the item's turn: the inverse of the chain (its own −y down); the transpose of M3b
    const T = M3d; T[0] = M3b[0]; T[1] = M3b[3]; T[2] = M3b[6]; T[3] = M3b[1]; T[4] = M3b[4]; T[5] = M3b[7]; T[6] = M3b[2]; T[7] = M3b[5]; T[8] = M3b[8];
    const e = eulerOf(T, V3b);
    setJ6(P, 'item_' + s, e[0], e[1], e[2], 0, 0, 0);
  }
  FA.holdItems = holdItems;
  // ---- standing: now and then a hand on the hip — the arm out (the elbow out and back), the back of the wrist on the hip
  // bone, the fingers pointing down along the hip. k: 0…1 blend
  FA.handOnHip = function (G, s, out) {
    if (!G.arm) return out;
    const sx = s === 'l' ? -1 : 1, kid = G.kid;
    const W = V3c; W[0] = sx * (G.hw + (kid ? 1.6 : 2.6) + (G.wide ? 2.6 : 0)); W[1] = kid ? 2.5 : 3.5; W[2] = 0.4;
    FA.armIK(G, s, [W[0], W[1], W[2]], [sx, 0.15, 0.55], out);
    return FA.handAim(out, s, [sx * 0.3, -0.75, -0.6], sx * -1.2, out);
  };
  // ---- f-polish9 · the embrace (the tale's ending hug): both arms round the partner — the wrists behind its back, the
  // elbows out and down —, the head turned beside the partner's. o (blocks): {gap (between the two middles), h (the wrists'
  // height over the ground), depth (the partner's half depth), wide (the wrists' x, model units), kneel (an adult down on
  // both knees to a child: the thighs upright, the shins back on the ground, the hips lowered), lean (the torso forward)}.
  // → the root's drop (model units)
  const EMB_PL = [-1, -0.55, 0.25], EMB_PR = [1, -0.55, 0.25], EMB_DL = [0.85, -0.1, -0.5], EMB_DR = [-0.85, -0.1, -0.5];
  FA.embrace = function (G, o, out) {
    if (!G || !G.arm) return 0;
    o = o || {};
    const U = 1 / G.bpu, Lt = G.thigh, kneel = !!o.kneel && !G.kid;
    const hipH = kneel ? Lt + 1 : G.hip, drop = G.hip - hipH, lean = o.lean !== undefined ? o.lean : kneel ? 0.12 : 0.16;
    for (const j of JOINTS) { const q = out[j] || (out[j] = Z6()); for (let i = 0; i < 6; i++) q[i] = 0; }
    setJ6(out, 'hips', 0, 0, 0, 0, -drop, 0);
    if (kneel) {
      setJ6(out, 'leg_l', 0.1, 0, -0.06, 0, -drop, 0); setJ6(out, 'leg_r', 0.1, 0, 0.06, 0, -drop, 0);
      setJ6(out, 'shin_l', -(Math.PI / 2 + 0.1), 0, 0, 0, 0, 0); setJ6(out, 'shin_r', -(Math.PI / 2 + 0.1), 0, 0, 0, 0, 0);
    } else {
      // (standing close: the hips back a little under the lean, the knees soft)
      setJ6(out, 'leg_l', 0.06, 0, -0.03, 0, 0, 0); setJ6(out, 'leg_r', 0.06, 0, 0.03, 0, 0, 0);
      setJ6(out, 'shin_l', -0.08, 0, 0, 0, 0, 0); setJ6(out, 'shin_r', -0.08, 0, 0, 0, 0, 0);
    }
    setJ6(out, 'body', -lean, 0, 0, 0, 0, 0);
    // (the head beside the partner's: turned and tipped toward its own left — the two heads pass each other)
    setJ6(out, 'head', kneel ? 0.05 : 0.18, 0.42, -0.1, 0, 0, 0);
    const gap = (o.gap || 0.3) * U, back = gap + (o.depth || 0.1) * U, y = (o.h || 1) * U - hipH, wide = o.wide !== undefined ? o.wide : G.hw * 0.5;
    const X = V3e, W = V3f;
    let miss = 0;
    for (const s of ['l', 'r']) {
      const sx = s === 'l' ? -1 : 1;
      // (one wrist a little higher than the other: they cross behind the back instead of meeting in one point)
      X[0] = sx * wide; X[1] = y + (s === 'l' ? 1.2 : -1.2); X[2] = -back;
      toBody(out, X, W);
      miss += FA.armIK(G, s, W, s === 'l' ? EMB_PL : EMB_PR, out);
      FA.handAim(out, s, s === 'l' ? EMB_DL : EMB_DR, 0, out);
    }
    FA.embrace.miss = miss;
    return drop;
  };
  // ---- talking: the speaker's forearms up at the waist with small swings and now and then an open-palm beat; the
  // listener's hands clasped before the belly. t seconds, seed the person's
  FA.gesture = function (G, t, seed, speaking, out) {
    const ph = (seed % 97) * 0.37, f = 1.15 + (seed % 5) * 0.06;
    if (speaking) {
      const sw = Math.sin((t * f + ph) * Math.PI * 2), sw2 = Math.sin((t * f * 0.7 + ph * 1.3) * Math.PI * 2);
      // a beat: every 3–4 s both palms open outward for a moment
      const bp = ((t + ph) % 3.6) / 3.6, beat = bp < 0.22 ? Math.sin(bp / 0.22 * Math.PI) : 0;
      setJ6(out, 'arm_r', 0.32 + 0.05 * sw2, 0, 0.17 + 0.08 * beat, 0, 0, 0); setJ6(out, 'fore_r', 1.32 + 0.17 * sw, 0.3, -0.05 - 0.25 * beat, 0, 0, 0);
      setJ6(out, 'arm_l', 0.24 - 0.04 * sw, 0, -0.15 - 0.08 * beat, 0, 0, 0); setJ6(out, 'fore_l', 1.18 + 0.1 * sw2, -0.3, 0.05 + 0.25 * beat, 0, 0, 0);
      setJ6(out, 'hand_r', -0.15 + 0.15 * sw, 0.6 + 0.6 * beat, 0, 0, 0, 0); setJ6(out, 'hand_l', -0.1, -0.6 - 0.6 * beat, 0, 0, 0, 0);
      return out;
    }
    // the listener: the wrists meet a hand's breadth before the belly, the elbows down and a little out
    const c = G.clasp || (G.clasp = {});
    if (!c.ok && G.arm) {
      const z = -(G.kid ? 5 : 6.8), y = G.kid ? 5 : 7;
      FA.armIK(G, 'r', [1.0, y, z], [1, -0.7, 0.15], c); FA.armIK(G, 'l', [-1.0, y, z], [-1, -0.7, 0.15], c);
      FA.handAim(c, 'r', [-0.7, -0.3, -0.6], 0, c); FA.handAim(c, 'l', [0.7, -0.3, -0.6], 0, c);
      c.ok = true;
    }
    for (const j of ['arm_l', 'arm_r', 'fore_l', 'fore_r', 'hand_l', 'hand_r']) if (c[j]) { const o = out[j] || (out[j] = Z6()); for (let i = 0; i < 6; i++) o[i] = c[j][i]; }
    // (a nod now and then)
    if (out.head) out.head[0] += 0.06 * Math.max(0, Math.sin((t * 0.5 + ph) * Math.PI * 2)) ** 8;
    return out;
  };
  // ---- sitting: the hips over the seat, the thighs on it, the feet on the floor a little ahead of the knees (the legs'
  // two-bone solve; a child's feet hang when they cannot reach), the back upright; at a table the guest sits forward,
  // leans in and rests one forearm on its top, the other hand on the thigh; without a table both hands on the thighs.
  // o: { seat (the seat's height, blocks), table: { d (its middle ahead of the seat's middle, blocks), h (its top), r (its
  // radius) } | null, side 'r' | 'l' (the arm on the table), lean } → { rootY (the model's origin over the floor, blocks),
  // fwd (blocks ahead of the seat's middle), hipH, knee (the knees' inner angle) }; the pose in out
  FA.SEAT = 0.49;
  // the parts a seated person does not show: a robe's or a gown's skirt turns forward only half way (it drapes over the
  // knees to the floor), so the thighs, level on the seat, and the knees would come out through its lap — the robe hides
  // the legs (the draw leaves them out: villages.js)
  FA.SIT_HIDE = ['leg_l', 'leg_r', 'shin_l', 'shin_r'];
  FA.sitHides = (G) => !!(G && G.skirt === 2);
  FA.sitPose = function (G, o, out) {
    o = o || {};
    const U = 1 / G.bpu, kid = G.kid, Lt = G.thigh, Ls = G.shin;
    // (the hip joint a little more than the thigh's half thickness over the seat: the buttocks on it; a child does not
    // reach a café table from its chair — its hands stay in its lap)
    const seat = (o.seat || FA.SEAT) * U, lift = kid ? 1.6 : 3.2, hipH = seat + lift;
    // (a table whose near edge is beyond a forearm's reach from the seat — two blocks off — is not leant on: the hands stay
    // on the thighs rather than the arm stretching out to it)
    const t0 = o.table, near = t0 ? (t0.d || 1) - (t0.r || 0.31) - 0.15 : 9;
    const table = !kid && t0 && t0.h > (o.seat || FA.SEAT) + 0.12 && near <= 0.62 ? t0 : null;
    const fwd = table ? 0.15 : 0.12, lean = table ? (o.lean || 0.36) : 0.04;
    // the legs: the feet on the floor with the knees at some 95° when they reach, else the thighs level and the shins down
    let th, kb;
    if (hipH < Lt + Ls - 0.3) {
      // (the knee at some 100°: the shin near upright, the thigh as level as the floor lets it be — the seat's front edge
      // a voxel under it at most)
      const kap = 100 * Math.PI / 180, d = Math.sqrt(Lt * Lt + Ls * Ls - 2 * Lt * Ls * Math.cos(kap));
      const f = d > hipH ? Math.sqrt(d * d - hipH * hipH) : 0.5;
      legIK(Lt, Ls, f, hipH, IK); th = IK[0]; kb = IK[1];
    } else { th = Math.PI / 2; kb = Math.PI / 2; }
    const wide = G.skirt === 2 ? 0.8 : G.skirt === 1 ? 1.15 : 0.22;   // the hips' turn: a robe drapes over the knees, a coat's tails lie on the thighs
    for (const j of JOINTS) { const q = out[j] || (out[j] = Z6()); for (let i = 0; i < 6; i++) q[i] = 0; }
    // (the hips turn the skirt forward like a limb (+rx); the torso, pointing up, leans forward by −rx: it takes the hips'
    // turn back and leans on; the head comes up to look ahead)
    setJ6(out, 'hips', wide, 0, 0, 0, 0, 0);
    setJ6(out, 'body', -wide - lean, 0, 0, 0, 0, 0);
    setJ6(out, 'head', lean * 0.6, 0, 0, 0, 0, 0);
    setJ6(out, 'leg_l', th, 0, -0.05, 0, 0, 0); setJ6(out, 'leg_r', th, 0, 0.05, 0, 0, 0);
    setJ6(out, 'shin_l', -kb, 0, 0, 0, 0, 0); setJ6(out, 'shin_r', -kb, 0, 0, 0, 0, 0);
    // the hands: on the thighs (a little behind the knees, on top), one on the table's top
    // (on a skirt's lap the hand lies on the cloth over the thigh: a robe's some three voxels over it)
    const up = 2.6 + 1 + (G.skirt === 2 ? 3.2 : G.skirt === 1 ? 1.4 : 0);
    const thigh = (sx) => { const t0 = 0.62 * Lt, ca = Math.cos(th), sa = Math.sin(th); return [sx * (G.legX || 2.5) * 1.1, -t0 * ca + up * sa, -t0 * sa - up * ca]; };
    const sides = table ? [o.side === 'l' ? 'r' : 'l'] : ['l', 'r'];
    for (const s of sides) {
      const sx = s === 'l' ? -1 : 1, W = toBody(out, thigh(sx), [0, 0, 0]);
      FA.armIK(G, s, W, [sx * 0.8, -0.4, 0.6], out);
      FA.handAim(out, s, toBody(out, [sx * -0.1, -Math.cos(th) * 0.5 - 0.5, -Math.sin(th)], [0, 0, 0]), sx * 1.4, out);
    }
    let reach = 0;
    if (table) {
      const s = o.side === 'l' ? 'l' : 'r', sx = s === 'l' ? -1 : 1;
      // the table's near edge ahead of the hip joint, its top over it; the wrist a little past the edge, the forearm level
      const edge = ((table.d || 1) - (table.r || 0.31) - fwd) * U, top = (table.h - (o.seat || FA.SEAT)) * U - lift;
      const W = toBody(out, [sx * 3.2, top + 1.6, -(edge + 2.2)], [0, 0, 0]);
      reach = FA.armIK(G, s, W, [sx * 0.5, -1, 0.35], out);
      FA.handAim(out, s, toBody(out, [-sx * 0.25, -0.12, -1], [0, 0, 0]), sx * 1.45, out);
    }
    const knee = Math.PI - kb;
    return { rootY: (hipH - G.hip) * G.bpu, fwd, hipH, knee, th, reach, table: !!table };
  };
  // the weight of a person standing: every 8–12 s it moves from one leg to the other (the free knee bends a little, the
  // pelvis drops on the free side and slides over the standing foot, the chest leans back over it); w −1 … 1
  // (no closure a call: the villagers' pose runs every frame for everyone near the eye)
  const addJ = (P, j, i, v) => { const o = P[j] || (P[j] = Z6()); o[i] += v; };
  FA.weightShift = function (P, t, seed, G, k) {
    const per = 8 + (seed % 5), w = Math.tanh(3 * Math.sin(t * Math.PI * 2 / per + (seed % 7))) * (k === undefined ? 1 : k);
    addJ(P, 'hips', 3, 0.55 * w); addJ(P, 'hips', 2, 0.035 * w); addJ(P, 'body', 2, -0.025 * w); addJ(P, 'head', 2, -0.01 * w);
    addJ(P, 'leg_l', 3, 0.55 * w); addJ(P, 'leg_r', 3, 0.55 * w);
    // (w > 0: the weight on the right leg — the left one free)
    const fl = Math.max(0, w), fr = Math.max(0, -w);
    addJ(P, 'leg_l', 0, 0.06 * fl); addJ(P, 'shin_l', 0, -0.13 * fl);
    addJ(P, 'leg_r', 0, 0.06 * fr); addJ(P, 'shin_r', 0, -0.13 * fr);
    return w;
  };
  function setJ6(out, j, rx, ry, rz, tx, ty, tz) { const o = out[j] || (out[j] = Z6()); o[0] = rx; o[1] = ry; o[2] = rz; o[3] = tx; o[4] = ty; o[5] = tz; }
  // ------------------------------------------------------------------ the clips
  const def = FA.define;
  def('idle', { len: 4, loop: true, tracks: {
    body: [[0, 0, 0, 0, 0, 0, 0], [2, 0.02, 0, 0.02, 0, 0.3, 0], [4, 0, 0, 0, 0, 0, 0]],
    head: [[0, 0, 0, 0], [1.5, 0.03, 0.08, 0], [3, -0.02, -0.05, 0], [4, 0, 0, 0]],
    // (t-folk2: the rest pose, FA.REST — the arm 7° out, the elbow 12° with the forearm turned in toward the thigh, breathing)
    arm_l: [[0, 0.02, 0, -0.12], [2, 0.05, 0, -0.135], [4, 0.02, 0, -0.12]], arm_r: [[0, 0.02, 0, 0.12], [2, 0.05, 0, 0.135], [4, 0.02, 0, 0.12]],
    fore_l: [[0, 0.21, -0.22, 0.09], [2, 0.24, -0.22, 0.09], [4, 0.21, -0.22, 0.09]], fore_r: [[0, 0.21, 0.22, -0.09], [2, 0.24, 0.22, -0.09], [4, 0.21, 0.22, -0.09]],
    hand_l: [[0, 0.1, 0, 0]], hand_r: [[0, 0.1, 0, 0]],
  } });
  def('sit', { len: 1, loop: false, tracks: { leg_l: [[0, 1.45, 0, -0.04]], leg_r: [[0, 1.45, 0, 0.04]], shin_l: [[0, -1.4, 0, 0]], shin_r: [[0, -1.4, 0, 0]], arm_l: [[0, 0.5, 0, -0.1]], arm_r: [[0, 0.5, 0, 0.1]], fore_l: [[0, 0.55, 0, 0.15]], fore_r: [[0, 0.55, 0, -0.15]], head: [[0, -0.08, 0, 0]], body: [[0, 0.04, 0, 0]] } });
  def('sitground', { len: 1, loop: false, tracks: { leg_l: [[0, 1.5, 0, -0.25]], leg_r: [[0, 1.5, 0, 0.25]], shin_l: [[0, -0.9, 0, 0.3]], shin_r: [[0, -0.9, 0, -0.3]], arm_l: [[0, 0.35, 0, -0.35]], arm_r: [[0, 0.35, 0, 0.35]], fore_l: [[0, 0.4, 0, 0]], fore_r: [[0, 0.4, 0, 0]] } });
  def('sleep', { len: 1, loop: false, tracks: { leg_l: [[0, 0.1, 0, -0.03]], leg_r: [[0, 0.1, 0, 0.03]], shin_l: [[0, -0.15, 0, 0]], shin_r: [[0, -0.15, 0, 0]], arm_l: [[0, 0.2, 0, -0.08]], arm_r: [[0, 0.2, 0, 0.08]], fore_l: [[0, 0.4, 0, 0]], fore_r: [[0, 0.4, 0, 0]], head: [[0, 0, 0, 0]] } });
  def('work', { len: 0.75, loop: true, tracks: {
    arm_r: [[0, 1.75, 0, -0.1], [0.3, 0.75, 0, -0.05], [0.42, 0.7, 0, -0.05], [0.75, 1.75, 0, -0.1]],
    fore_r: [[0, 0.55, 0, 0], [0.3, 1.05, 0, 0], [0.42, 1.0, 0, 0], [0.75, 0.55, 0, 0]],
    arm_l: [[0, 0.6, 0, 0.18]], fore_l: [[0, 0.45, 0, 0]], head: [[0, -0.22, 0, 0]], body: [[0, -0.06, 0, 0], [0.3, -0.12, 0, 0], [0.75, -0.06, 0, 0]],   // (t-folk2: −rx bends the torso forward over the work)
  } });
  def('crouch', { len: 1.6, loop: true, tracks: { leg_l: [[0, 1.1, 0, -0.14]], leg_r: [[0, 1.1, 0, 0.14]], shin_l: [[0, -1.25, 0, 0]], shin_r: [[0, -1.25, 0, 0]], body: [[0, -0.32, 0, 0]], arm_l: [[0, 0.95, 0, 0.12]], arm_r: [[0, 0.9, 0, -0.12], [0.8, 1.15, 0, -0.1], [1.6, 0.9, 0, -0.12]], fore_l: [[0, 0.5, 0, 0]], fore_r: [[0, 0.6, 0, 0], [0.8, 0.95, 0, 0], [1.6, 0.6, 0, 0]], head: [[0, -0.1, 0, 0]] } });
  def('read', { len: 1, loop: false, tracks: { arm_l: [[0, 0.75, 0, 0.3]], arm_r: [[0, 0.75, 0, -0.3]], fore_l: [[0, 0.95, 0, 0.1]], fore_r: [[0, 0.95, 0, -0.1]], head: [[0, -0.38, 0, 0]] } });
  def('aim', { len: 1, loop: false, tracks: { arm_r: [[0, 1.52, 0, -0.05]], fore_r: [[0, 0.05, 0, 0]], arm_l: [[0, 1.3, 0, 0.38]], fore_l: [[0, 0.55, 0, 0.3]], head: [[0, 0.05, 0, 0]] } });
  def('hug', { len: 1, loop: false, tracks: { arm_l: [[0, 1.25, 0, 0.45]], arm_r: [[0, 1.25, 0, -0.45]], fore_l: [[0, 0.75, 0, 0.5]], fore_r: [[0, 0.75, 0, -0.5]], head: [[0, -0.1, 0, 0]] } });
  def('talk', { len: 3.2, loop: true, tracks: {
    arm_r: [[0, 0.3, 0, -0.08], [0.8, 0.75, 0, -0.2], [1.6, 0.45, 0, -0.1], [2.4, 0.85, 0, -0.3], [3.2, 0.3, 0, -0.08]],
    fore_r: [[0, 0.5, 0, 0], [0.8, 1.05, 0, -0.2], [1.6, 0.7, 0, 0.1], [2.4, 1.15, 0, -0.1], [3.2, 0.5, 0, 0]],
    arm_l: [[0, 0.15, 0, 0.08], [1.2, 0.35, 0, 0.12], [2.2, 0.2, 0, 0.1], [3.2, 0.15, 0, 0.08]], fore_l: [[0, 0.35, 0, 0], [1.2, 0.7, 0, 0.1], [2.2, 0.4, 0, 0], [3.2, 0.35, 0, 0]],
    head: [[0, 0, 0, 0], [0.8, 0.05, 0.06, 0], [1.6, -0.03, -0.04, 0], [2.4, 0.04, 0.05, 0], [3.2, 0, 0, 0]], body: [[0, 0, 0, 0], [1.6, 0.03, 0.08, 0.02], [3.2, 0, 0, 0]],
  } });
  def('wave', { len: 1.2, loop: true, tracks: { arm_r: [[0, 2.7, 0, 0.3]], fore_r: [[0, 0.35, 0, -0.45], [0.3, 0.35, 0, 0.45], [0.6, 0.35, 0, -0.45], [0.9, 0.35, 0, 0.45], [1.2, 0.35, 0, -0.45]], head: [[0, 0.06, 0, 0]], arm_l: [[0, 0.05, 0, -0.1]], fore_l: [[0, 0.2, 0, 0]] } });
  // the trailer heroes hold their blaster ready at the hip (right arm forward and down, the elbow a little bent); they
  // breathe, glance left and right now and then, and the free left hand hangs loose
  def('hold', { len: 4, loop: true, tracks: {
    body: [[0, 0, 0, 0, 0, 0, 0], [2, 0.015, 0, 0.02, 0, 0.22, 0], [4, 0, 0, 0, 0, 0, 0]],
    head: [[0, 0, 0, 0], [1.2, 0.02, 0.12, 0], [2.6, -0.02, -0.14, 0], [4, 0, 0, 0]],
    arm_r: [[0, 0.95, 0, 0.1], [2, 1.0, 0, 0.1], [4, 0.95, 0, 0.1]],
    fore_r: [[0, 0.35, 0, 0], [2, 0.4, 0, 0], [4, 0.35, 0, 0]],
    arm_l: [[0, 0.06, 0, -0.1], [2, 0.1, 0, -0.1], [4, 0.06, 0, -0.1]], fore_l: [[0, 0.2, 0, 0]],
  } });
  // the left hand waves while the right keeps the blaster
  def('wave_l', { len: 1.2, loop: true, tracks: { arm_l: [[0, 2.7, 0, -0.3]], fore_l: [[0, 0.35, 0, 0.45], [0.3, 0.35, 0, -0.45], [0.6, 0.35, 0, 0.45], [0.9, 0.35, 0, -0.45], [1.2, 0.35, 0, 0.45]], head: [[0, 0.06, 0, 0]], arm_r: [[0, 0.95, 0, 0.1]], fore_r: [[0, 0.35, 0, 0]] } });
  def('cheer', { len: 0.7, loop: true, tracks: { arm_l: [[0, 2.5, 0, -0.35], [0.35, 2.15, 0, -0.5], [0.7, 2.5, 0, -0.35]], arm_r: [[0, 2.15, 0, 0.5], [0.35, 2.5, 0, 0.35], [0.7, 2.15, 0, 0.5]], fore_l: [[0, 0.35, 0, 0]], fore_r: [[0, 0.35, 0, 0]], head: [[0, 0.15, 0, 0]] } });
  def('stretch', { len: 2.4, loop: false, tracks: { arm_l: [[0, 0, 0, -0.08], [0.9, 2.9, 0, -0.25], [1.6, 2.9, 0, -0.25], [2.4, 0, 0, -0.08]], arm_r: [[0, 0, 0, 0.08], [0.9, 2.9, 0, 0.25], [1.6, 2.9, 0, 0.25], [2.4, 0, 0, 0.08]], fore_l: [[0, 0.2, 0, 0], [0.9, 0.05, 0, 0], [2.4, 0.2, 0, 0]], fore_r: [[0, 0.2, 0, 0], [0.9, 0.05, 0, 0], [2.4, 0.2, 0, 0]], body: [[0, 0, 0, 0], [1.2, 0.12, 0, 0], [2.4, 0, 0, 0]], head: [[0, 0, 0, 0], [1.2, 0.25, 0, 0], [2.4, 0, 0, 0]] } });
  def('dance', { len: 2, loop: true, tracks: {
    body: [[0, 0, -0.25, 0.04, 0, 0, 0], [0.5, 0.02, 0, -0.04, 0, 1.2, 0], [1, 0, 0.25, 0.04, 0, 0, 0], [1.5, 0.02, 0, -0.04, 0, 1.2, 0], [2, 0, -0.25, 0.04, 0, 0, 0]],
    arm_l: [[0, 0.4, 0, -0.9], [0.5, 2.2, 0, -0.6], [1, 0.4, 0, -0.9], [1.5, 1.2, 0, -1.4], [2, 0.4, 0, -0.9]], arm_r: [[0, 1.2, 0, 1.4], [0.5, 0.4, 0, 0.9], [1, 2.2, 0, 0.6], [1.5, 0.4, 0, 0.9], [2, 1.2, 0, 1.4]],
    fore_l: [[0, 0.8, 0, 0], [0.5, 0.3, 0, 0], [1, 0.8, 0, 0], [2, 0.8, 0, 0]], fore_r: [[0, 0.3, 0, 0], [0.5, 0.8, 0, 0], [1, 0.3, 0, 0], [2, 0.3, 0, 0]],
    leg_l: [[0, 0.2, 0, -0.1], [0.5, -0.15, 0, -0.1], [1, 0.2, 0, -0.1], [2, 0.2, 0, -0.1]], leg_r: [[0, -0.15, 0, 0.1], [0.5, 0.2, 0, 0.1], [1, -0.15, 0, 0.1], [2, -0.15, 0, 0.1]],
    shin_l: [[0, -0.3, 0, 0], [0.5, 0, 0, 0], [1, -0.3, 0, 0], [2, -0.3, 0, 0]], shin_r: [[0, 0, 0, 0], [0.5, -0.3, 0, 0], [1, 0, 0, 0], [2, 0, 0, 0]],
    head: [[0, 0, -0.2, 0], [1, 0, 0.2, 0], [2, 0, -0.2, 0]],
  } });
  def('point', { len: 1, loop: false, tracks: { arm_r: [[0, 1.5, 0, 0.05]], fore_r: [[0, 0, 0, 0]], head: [[0, 0.05, 0.1, 0]] } });
  def('carry', { len: 1, loop: false, tracks: { arm_l: [[0, 0.55, 0, 0.05]], arm_r: [[0, 0.55, 0, -0.05]], fore_l: [[0, 1.3, 0, 0.1]], fore_r: [[0, 1.3, 0, -0.1]] } });
  // u-folk2 (folkjoy.js): applause for the player's build — the hands meet before the chest, three claps a second
  // (+rz brings the left arm in, −rz the right); a gasp — both hands up to the cheeks, the chest back a little; give —
  // the right hand held out, palm up, something offered
  def('clap', { len: 0.36, loop: true, tracks: { arm_l: [[0, 0.95, 0, 0.12], [0.18, 0.95, 0, 0.32], [0.36, 0.95, 0, 0.12]], arm_r: [[0, 0.95, 0, -0.12], [0.18, 0.95, 0, -0.32], [0.36, 0.95, 0, -0.12]], fore_l: [[0, 0.95, 0, 0.2], [0.18, 0.95, 0, 0.45], [0.36, 0.95, 0, 0.2]], fore_r: [[0, 0.95, 0, -0.2], [0.18, 0.95, 0, -0.45], [0.36, 0.95, 0, -0.2]], head: [[0, 0.08, 0, 0]] } });
  def('gasp', { len: 1, loop: false, tracks: { arm_l: [[0, 0.75, 0, 0.3]], arm_r: [[0, 0.75, 0, -0.3]], fore_l: [[0, 1.9, 0, 0.35]], fore_r: [[0, 1.9, 0, -0.35]], body: [[0, 0.07, 0, 0]], head: [[0, 0.12, 0, 0]] } });
  def('give', { len: 1, loop: false, tracks: { arm_r: [[0, 1.05, 0, 0.06]], fore_r: [[0, 0.35, -0.6, 0]], hand_r: [[0, -0.2, 0, 0]], arm_l: [[0, 0.04, 0, -0.12]], fore_l: [[0, 0.25, 0, 0]], head: [[0, -0.12, 0, 0]], body: [[0, -0.04, 0, 0]] } });

  // ------------------------------------------------------------------ the player: per-agent state with crossfades
  // a.anim = { cur, t, prev, prevT, fade } ; the base is the walk cycle (by walkAmt) blended with the state clip
  const tmpA = {}, tmpB = {}, tmpW = {};
  FA.play = function (a, name, fade) {
    const st = a.anim || (a.anim = { cur: 'idle', t: Math.random() * 4, prev: null, prevT: 0, fade: 1, fadeLen: 0.25 });
    if (st.cur === name) return st;
    st.prev = st.cur; st.prevT = st.t; st.cur = name; st.t = 0; st.fade = 0; st.fadeLen = fade || 0.25;
    return st;
  };
  // the full body pose for an agent: state clip (crossfaded) under the walk cycle (by walkAmt)
  // k: the stride's strength of the walk (see FA.walk); the villagers pass nothing and walk as before
  // G (t-folk: a person's gait, FA.gait — advanced by FA.stride before the call): the walk is the person's own
  // (FA.walkPerson, walkPhase unused), and a person standing shifts its weight now and then (FA.weightShift)
  FA.pose = function (a, state, dt, walkPhase, walkAmt, run, out, k, G) {
    const st = FA.play(a, state);
    st.t += dt; if (st.fade < 1) { st.fade = Math.min(1, st.fade + dt / st.fadeLen); st.prevT += dt; }
    const cur = clips[st.cur] || clips.idle;
    if (a.seedW === undefined) a.seedW = (Math.random() * 97) | 0;
    if (G) hipClock(a, G, st.cur === 'idle' && walkAmt < 0.3 ? dt : -dt);
    stateP(a, st.cur, st.t, G, tmpA);
    let body = tmpA;
    if (st.fade < 1 && st.prev && clips[st.prev]) { stateP(a, st.prev, st.prevT, G, tmpB); body = FA.lerp(tmpB, tmpA, ease(st.fade), tmpB); }
    if (G && SHIFT[st.cur]) FA.weightShift(body, (a.anim.tw = (a.anim.tw || 0) + dt), a.seedW, G, 1 - Math.min(1, walkAmt * 2));
    out = out || {};
    if (walkAmt > 0.01 && !cur.still) { if (G) FA.walkPerson(G, 1, tmpW); else FA.walk(walkPhase, 1, run, tmpW, k); FA.lerp(body, tmpW, Math.min(1, walkAmt), out); }
    else for (const j of JOINTS) { const o = out[j] || (out[j] = Z6()), b = body[j] || Z6(); for (let i = 0; i < 6; i++) o[i] = b[i]; }
    // (an elder's back bends a little forward, the head comes up to look ahead)
    // (t-folk2: the torso's −rx bends it forward — +rx, as v0.46 had it, leaned the elders back)
    if (G && G.stoop && !cur.still) { out.body[0] -= G.stoop; out.head[0] += G.stoop * 0.7; }
    // (t-folk2: what the hands carry hangs straight down after every blend)
    if (G && !cur.still) holdItems(G, out);
    return out;
  };
  // t-folk2: a person's state as a pose — the clip, then what the person does in it: seated by FA.sitPose (kept on the agent
  // for its seat: a.sitO, set by villages.js sit()), talking by FA.gesture (a.speaking: the mouth moves), standing with a
  // bag's arm straight and a cane at the side, and now and then a hand on the hip
  function stateP(a, name, t, G, dst) {
    FA.sample(clips[name] || clips.idle, t, dst);
    if (!G) return dst;
    if (name === 'sit' && a.sitO) {
      const sp = FA.sitOf(a, G);
      for (const j of JOINTS) { const q = dst[j] || (dst[j] = Z6()), b = sp.pose[j]; for (let i = 0; i < 6; i++) q[i] = b ? b[i] : 0; }
      dst.body[4] += 0.22 * Math.sin(t * 1.7);   // (breathing)
      dst.head[1] += 0.12 * Math.sin(t * 0.31 + a.seedW);
    } else if (name === 'hug' && a.hugO && G.arm) FA.embrace(G, a.hugO, dst);   // (f-polish9: the tale's ending — both arms round the partner)
    else if (name === 'talk') FA.gesture(G, t, a.seedW | 0, !!a.speaking, dst);
    else if (name === 'idle') {
      if (G.carry === 'tray') armSwing(dst, 'r', 0, 0, false, 1, 'tray', 0);
      else if (G.carry && IT[G.carry]) restCarry(dst, 'r');
      if (G.cane) restCane(dst);
      const h = a.anim && a.anim.hh;
      if (h && h.k > 0) {
        const P = G.hipP || (G.hipP = {}), s = h.side, hp = P[s] || (P[s] = FA.handOnHip(G, s, {}));
        for (const j of ['arm_' + s, 'fore_' + s, 'hand_' + s]) { const q = dst[j] || (dst[j] = Z6()), b = hp[j]; if (b) for (let i = 0; i < 6; i++) q[i] += (b[i] - q[i]) * h.k; }
      }
    }
    return dst;
  }
  // a bag's arm standing: straight, a little out (the bag clears the thigh); a cane's: forward, the elbow bent, the cane's
  // tip on the floor a little ahead of the foot
  function restCarry(P, s) { const sx = s === 'l' ? -1 : 1; setJ6(P, 'arm_' + s, 0.03, 0, sx * 0.16, 0, 0, 0); setJ6(P, 'fore_' + s, 0.05, 0, 0, 0, 0, 0); setJ6(P, 'hand_' + s, 0, 0, 0, 0, 0, 0); }
  function restCane(P) { setJ6(P, 'arm_l', 0.16, 0, -0.1, 0, 0, 0); setJ6(P, 'fore_l', 0.42, 0, 0, 0, 0, 0); setJ6(P, 'hand_l', 0, 0, 0, 0, 0, 0); }
  // the hand-on-hip episodes of a person standing: every 20–40 s (seeded) for 6–12 s, blended in and out over 0.7 s; the
  // side the bag or the cane leaves free (a child and anyone not standing still: none). d < 0: the clock runs the blend out
  function hipClock(a, G, d) {
    const st = a.anim, sd = a.seedW | 0;
    const h = st.hh || (st.hh = { t: 0, next: 8 + (sd % 23), until: 0, side: sd & 1 ? 'r' : 'l', k: 0 });
    // (a hand on the hip needs the wrist to bend: the smooth people's hands — G.hands, set by the draw — not the voxel
    // people's, whose hand goes on in the forearm's line)
    // (the free hand only: whatever the right holds — a bag, a hammer, a hoe, a book — keeps it off the hip, as the cane
    // keeps the left; both hands full, none)
    const busyR = !!(G.item && G.item !== 'cane'), busyL = !!G.cane;
    if (G.kid || G.hands === false || (busyR && busyL)) { h.k = Math.max(0, h.k - Math.abs(d) / 0.7); return; }
    if (d > 0) {
      h.t += d;
      if (h.t >= h.next && h.until <= h.next) { h.until = h.t + 6 + ((sd * 7 + (h.t | 0)) % 7); h.side = busyR ? 'l' : busyL ? 'r' : ((sd + (h.t | 0)) & 1 ? 'r' : 'l'); }
      if (h.t >= h.until && h.until > h.next) h.next = h.t + 20 + ((sd * 13 + (h.t | 0)) % 21);
      const on = h.t >= h.next && h.t < h.until;
      h.k = Math.max(0, Math.min(1, h.k + (on ? d : -d) / 0.7));
    } else h.k = Math.max(0, h.k + d / 0.7);
  }
  // the seated pose of an agent for its seat (a.sitO: { seat, table, side }), solved once and kept
  FA.sitOf = function (a, G) {
    const o = a.sitO, key = o.seat + '|' + (o.table ? o.table.d + ',' + o.table.h + ',' + o.table.r : '') + '|' + o.side;
    if (!a.sitP || a.sitP.key !== key) { const pose = {}; const info = FA.sitPose(G, o, pose); a.sitP = { key, pose, info }; }
    return a.sitP;
  };
  // the states in which a person standing shifts its weight
  const SHIFT = { idle: 1, talk: 1, wave: 1, read: 1, point: 1, hold: 0 };
  // clips that keep their own legs even while the agent drifts (seated poses)
  for (const n of ['sit', 'sitground', 'sleep']) clips[n].still = true;
  // serialise a clip for the studio / notes
  FA.toSource = function (name) { const c = clips[name]; if (!c) return ''; const tr = Object.keys(c.tracks).map(j => `    ${j}: ${JSON.stringify(c.tracks[j])},`).join('\n'); return `FA.define('${name}', { len: ${c.len}, loop: ${!!c.loop}, tracks: {\n${tr}\n} });`; };
})(VR);

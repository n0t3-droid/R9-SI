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
  // (t-folk: 'hips' — the people's pelvis, the root of their rig: the walk sways it, the idle shifts the weight on it)
  const JOINTS = FA.JOINTS = ['hips', 'body', 'head', 'arm_l', 'arm_r', 'fore_l', 'fore_r', 'leg_l', 'leg_r', 'shin_l', 'shin_r'];
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
    setJ(out, 'body', run ? 0.18 * amt : 0, 0, bob); setJ(out, 'head', run ? -0.1 * amt : 0, 0, bob);
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
  FA.gait = function (o) {
    const unit = o.unit || 32, scale = o.scale || 1, thigh = o.thigh, shin = o.shin;
    return { unit, scale, hip: o.hip || thigh + shin, thigh, shin, L: thigh + shin, maxSwing: o.stride || 0.6, kid: !!o.kid, bpu: scale / unit, ph: o.ph || 0, S: 0, run: false };
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
    setJ6(out, 'body', (run ? 0.14 : 0.035) * amt, -1.7 * hipYaw, 0.7 * -hipRoll, 0, 0, 0);
    setJ6(out, 'head', (run ? -0.1 : -0.02) * amt, 0.7 * hipYaw, -0.3 * hipRoll, 0, 0, 0);
    // the arms against the legs: the left arm comes forward with the right leg
    const A = (run ? 0.75 : 0.16 + 0.55 * R / (Lt + Ls)) * amt;
    const aL = -A * (FL[0] / (R || 1)), aR = -A * (FR[0] / (R || 1));
    setJ6(out, 'arm_l', aL + (run ? 0.3 : 0) * amt, 0, -0.07, 0, 0, 0); setJ6(out, 'arm_r', aR + (run ? 0.3 : 0) * amt, 0, 0.07, 0, 0, 0);
    setJ6(out, 'fore_l', ((run ? 1.2 : 0.16) + 0.55 * Math.max(0, aL)) * amt, 0, 0, 0, 0, 0); setJ6(out, 'fore_r', ((run ? 1.2 : 0.16) + 0.55 * Math.max(0, aR)) * amt, 0, 0, 0, 0, 0);
    return out;
  };
  // the weight of a person standing: every 8–12 s it moves from one leg to the other (the free knee bends a little, the
  // pelvis drops on the free side and slides over the standing foot, the chest leans back over it); w −1 … 1
  FA.weightShift = function (P, t, seed, G, k) {
    const per = 8 + (seed % 5), w = Math.tanh(3 * Math.sin(t * Math.PI * 2 / per + (seed % 7))) * (k === undefined ? 1 : k);
    const add = (j, i, v) => { const o = P[j] || (P[j] = Z6()); o[i] += v; };
    add('hips', 3, 0.55 * w); add('hips', 2, 0.035 * w); add('body', 2, -0.025 * w); add('head', 2, -0.01 * w);
    add('leg_l', 3, 0.55 * w); add('leg_r', 3, 0.55 * w);
    // (w > 0: the weight on the right leg — the left one free)
    const fl = Math.max(0, w), fr = Math.max(0, -w);
    add('leg_l', 0, 0.06 * fl); add('shin_l', 0, -0.13 * fl);
    add('leg_r', 0, 0.06 * fr); add('shin_r', 0, -0.13 * fr);
    return w;
  };
  function setJ6(out, j, rx, ry, rz, tx, ty, tz) { const o = out[j] || (out[j] = Z6()); o[0] = rx; o[1] = ry; o[2] = rz; o[3] = tx; o[4] = ty; o[5] = tz; }
  // ------------------------------------------------------------------ the clips
  const def = FA.define;
  def('idle', { len: 4, loop: true, tracks: {
    body: [[0, 0, 0, 0, 0, 0, 0], [2, 0.02, 0, 0.02, 0, 0.3, 0], [4, 0, 0, 0, 0, 0, 0]],
    head: [[0, 0, 0, 0], [1.5, 0.03, 0.08, 0], [3, -0.02, -0.05, 0], [4, 0, 0, 0]],
    arm_l: [[0, 0, 0, -0.08], [2, 0.04, 0, -0.1], [4, 0, 0, -0.08]], arm_r: [[0, 0, 0, 0.08], [2, 0.04, 0, 0.1], [4, 0, 0, 0.08]],
    fore_l: [[0, 0.18, 0, 0]], fore_r: [[0, 0.18, 0, 0]],
  } });
  def('sit', { len: 1, loop: false, tracks: { leg_l: [[0, 1.45, 0, -0.04]], leg_r: [[0, 1.45, 0, 0.04]], shin_l: [[0, -1.4, 0, 0]], shin_r: [[0, -1.4, 0, 0]], arm_l: [[0, 0.5, 0, -0.1]], arm_r: [[0, 0.5, 0, 0.1]], fore_l: [[0, 0.55, 0, 0.15]], fore_r: [[0, 0.55, 0, -0.15]], head: [[0, -0.08, 0, 0]], body: [[0, 0.04, 0, 0]] } });
  def('sitground', { len: 1, loop: false, tracks: { leg_l: [[0, 1.5, 0, -0.25]], leg_r: [[0, 1.5, 0, 0.25]], shin_l: [[0, -0.9, 0, 0.3]], shin_r: [[0, -0.9, 0, -0.3]], arm_l: [[0, 0.35, 0, -0.35]], arm_r: [[0, 0.35, 0, 0.35]], fore_l: [[0, 0.4, 0, 0]], fore_r: [[0, 0.4, 0, 0]] } });
  def('sleep', { len: 1, loop: false, tracks: { leg_l: [[0, 0.1, 0, -0.03]], leg_r: [[0, 0.1, 0, 0.03]], shin_l: [[0, -0.15, 0, 0]], shin_r: [[0, -0.15, 0, 0]], arm_l: [[0, 0.2, 0, -0.08]], arm_r: [[0, 0.2, 0, 0.08]], fore_l: [[0, 0.4, 0, 0]], fore_r: [[0, 0.4, 0, 0]], head: [[0, 0, 0, 0]] } });
  def('work', { len: 0.75, loop: true, tracks: {
    arm_r: [[0, 1.75, 0, -0.1], [0.3, 0.75, 0, -0.05], [0.42, 0.7, 0, -0.05], [0.75, 1.75, 0, -0.1]],
    fore_r: [[0, 0.55, 0, 0], [0.3, 1.05, 0, 0], [0.42, 1.0, 0, 0], [0.75, 0.55, 0, 0]],
    arm_l: [[0, 0.6, 0, 0.18]], fore_l: [[0, 0.45, 0, 0]], head: [[0, -0.22, 0, 0]], body: [[0, 0.06, 0, 0], [0.3, 0.12, 0, 0], [0.75, 0.06, 0, 0]],
  } });
  def('crouch', { len: 1.6, loop: true, tracks: { leg_l: [[0, 1.1, 0, -0.14]], leg_r: [[0, 1.1, 0, 0.14]], shin_l: [[0, -1.25, 0, 0]], shin_r: [[0, -1.25, 0, 0]], body: [[0, 0.32, 0, 0]], arm_l: [[0, 0.95, 0, 0.12]], arm_r: [[0, 0.9, 0, -0.12], [0.8, 1.15, 0, -0.1], [1.6, 0.9, 0, -0.12]], fore_l: [[0, 0.5, 0, 0]], fore_r: [[0, 0.6, 0, 0], [0.8, 0.95, 0, 0], [1.6, 0.6, 0, 0]], head: [[0, -0.35, 0, 0]] } });
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
  def('stretch', { len: 2.4, loop: false, tracks: { arm_l: [[0, 0, 0, -0.08], [0.9, 2.9, 0, -0.25], [1.6, 2.9, 0, -0.25], [2.4, 0, 0, -0.08]], arm_r: [[0, 0, 0, 0.08], [0.9, 2.9, 0, 0.25], [1.6, 2.9, 0, 0.25], [2.4, 0, 0, 0.08]], fore_l: [[0, 0.2, 0, 0], [0.9, 0.05, 0, 0], [2.4, 0.2, 0, 0]], fore_r: [[0, 0.2, 0, 0], [0.9, 0.05, 0, 0], [2.4, 0.2, 0, 0]], body: [[0, 0, 0, 0], [1.2, -0.12, 0, 0], [2.4, 0, 0, 0]], head: [[0, 0, 0, 0], [1.2, 0.25, 0, 0], [2.4, 0, 0, 0]] } });
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
    FA.sample(cur, st.t, tmpA);
    let body = tmpA;
    if (st.fade < 1 && st.prev && clips[st.prev]) { FA.sample(clips[st.prev], st.prevT, tmpB); body = FA.lerp(tmpB, tmpA, ease(st.fade), tmpB); }
    if (G && SHIFT[st.cur]) FA.weightShift(body, (a.anim.tw = (a.anim.tw || 0) + dt), (a.seedW === undefined ? (a.seedW = (Math.random() * 97) | 0) : a.seedW), G, 1 - Math.min(1, walkAmt * 2));
    out = out || {};
    if (walkAmt > 0.01 && !cur.still) { if (G) FA.walkPerson(G, 1, tmpW); else FA.walk(walkPhase, 1, run, tmpW, k); FA.lerp(body, tmpW, Math.min(1, walkAmt), out); }
    else for (const j of JOINTS) { const o = out[j] || (out[j] = Z6()), b = body[j] || Z6(); for (let i = 0; i < 6; i++) o[i] = b[i]; }
    return out;
  };
  // the states in which a person standing shifts its weight
  const SHIFT = { idle: 1, talk: 1, wave: 1, read: 1, point: 1, hold: 0 };
  // clips that keep their own legs even while the agent drifts (seated poses)
  for (const n of ['sit', 'sitground', 'sleep']) clips[n].still = true;
  // serialise a clip for the studio / notes
  FA.toSource = function (name) { const c = clips[name]; if (!c) return ''; const tr = Object.keys(c.tracks).map(j => `    ${j}: ${JSON.stringify(c.tracks[j])},`).join('\n'); return `FA.define('${name}', { len: ${c.len}, loop: ${!!c.loop}, tracks: {\n${tr}\n} });`; };
})(VR);

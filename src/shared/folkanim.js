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
  const JOINTS = FA.JOINTS = ['body', 'head', 'arm_l', 'arm_r', 'fore_l', 'fore_r', 'leg_l', 'leg_r', 'shin_l', 'shin_r'];
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
  FA.pose = function (a, state, dt, walkPhase, walkAmt, run, out, k) {
    const st = FA.play(a, state);
    st.t += dt; if (st.fade < 1) { st.fade = Math.min(1, st.fade + dt / st.fadeLen); st.prevT += dt; }
    const cur = clips[st.cur] || clips.idle;
    FA.sample(cur, st.t, tmpA);
    let body = tmpA;
    if (st.fade < 1 && st.prev && clips[st.prev]) { FA.sample(clips[st.prev], st.prevT, tmpB); body = FA.lerp(tmpB, tmpA, ease(st.fade), tmpB); }
    out = out || {};
    if (walkAmt > 0.01 && !cur.still) { FA.walk(walkPhase, 1, run, tmpW, k); FA.lerp(body, tmpW, Math.min(1, walkAmt), out); }
    else for (const j of JOINTS) { const o = out[j] || (out[j] = Z6()), b = body[j] || Z6(); for (let i = 0; i < 6; i++) o[i] = b[i]; }
    return out;
  };
  // clips that keep their own legs even while the agent drifts (seated poses)
  for (const n of ['sit', 'sitground', 'sleep']) clips[n].still = true;
  // serialise a clip for the studio / notes
  FA.toSource = function (name) { const c = clips[name]; if (!c) return ''; const tr = Object.keys(c.tracks).map(j => `    ${j}: ${JSON.stringify(c.tracks[j])},`).join('\n'); return `FA.define('${name}', { len: ${c.len}, loop: ${!!c.loop}, tracks: {\n${tr}\n} });`; };
})(VR);

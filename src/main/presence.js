// ============================================================================
// Presence (F3 · Da-Sein): the curves of the player's body and camera — the FOV and its sprint kick, the head bob, the
// hand sway with the walk, the landing dip, the view nudge and hand push of a placed or broken block, the optional
// turn inertia, and the sway of plants in the wind as the terrain shader computes it (windOffset mirrors TERRAIN_VS,
// so the node test checks the very numbers the GPU adds). Pure functions: no DOM, no world, no clock of their own.
// ============================================================================
(function (VR) {
  'use strict';
  const FOV_DEF = 75, FOV_MIN = 60, FOV_MAX = 110, SPRINT_KICK = 8;
  const KICK_TAU = 0.045;          // seconds: 96 % of the kick after 150 ms
  const TURN_LAG = 0.03;           // radians: the drawn yaw never trails the real one by more
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const clamp01 = (x) => clamp(x, 0, 1);
  const wrapPi = (a) => { let r = (a + Math.PI) % (2 * Math.PI); if (r < 0) r += 2 * Math.PI; return r - Math.PI; };

  // ---- field of view
  function clampFov(f) { return Number.isFinite(f) ? clamp(f, FOV_MIN, FOV_MAX) : FOV_DEF; }
  // degrees: the settable base plus the sprint kick (kick 0..1)
  function fovDeg(base, kick) { return clampFov(base) + SPRINT_KICK * clamp01(kick); }
  // one frame of an exponential ease of the kick toward its target (0 or 1)
  function easeKick(cur, target, dt) { const a = 1 - Math.exp(-Math.max(0, dt) / KICK_TAU); return cur + (clamp01(target) - cur) * a; }

  // ---- head bob (phase = twice the walk phase, amount 0..1): x sways side to side, y bobs, roll tilts a little
  function bobAt(phase, amt) { const a = clamp01(amt); return { x: Math.sin(phase) * 0.035 * a, y: Math.abs(Math.cos(phase)) * 0.05 * a }; }
  function rollAt(phase, amt) { return clamp01(amt) * Math.sin(phase) * 0.004; }

  // ---- the first-person arm follows the walk: a small sway that grows with the speed up to a brisk walk
  function handSwayAt(speed, phase) { const a = clamp01((+speed || 0) / 5.6); return { x: Math.sin(phase) * 0.02 * a, y: Math.abs(Math.cos(phase)) * 0.015 * a }; }

  // ---- landing: a fall of more than 0.6 blocks dips the eye, up to 0.14 blocks; the dip starts at 0, peaks at once and
  // is back to about 0 within 0.6 s (dipAt, t seconds since the landing)
  function landingDip(fall) { return fall > 0 ? clamp((fall - 0.6) * 0.03, 0, 0.14) : 0; }
  function dipAt(t, amp) { if (!(t > 0)) return 0; return amp * Math.min(1, t / 0.05) * Math.exp(-Math.max(0, t - 0.05) * 9); }

  // ---- the view nudge of a placed block (amp 0.012 rad) or a broken one (0.006): a flick that is gone in about 0.2 s
  function nudgeAt(t, amp) { if (!(t > 0)) return 0; return amp * Math.min(1, t / 0.02) * Math.exp(-18 * Math.max(0, t - 0.02)); }
  // the hand push forward after a placed block: 0 at the start, 1 at its peak, gone after about 0.6 s; a break uses half
  function pushAt(t) { if (!(t > 0)) return 0; return Math.min(1, t / 0.03) * Math.exp(-12 * Math.max(0, t - 0.03)); }

  // ---- turn inertia (optional, Settings): the drawn yaw follows the real one and trails it by at most TURN_LAG
  function turnFollow(view, yaw, dt, on) {
    if (!on || !Number.isFinite(view) || !Number.isFinite(yaw)) return yaw;
    const k = 1 - Math.exp(-Math.max(0, dt) * 14);
    let v = view + wrapPi(yaw - view) * k;
    v = yaw - clamp(wrapPi(yaw - v), -TURN_LAG, TURN_LAG);
    return v;
  }

  // ---- wind sway: the same numbers as TERRAIN_VS (shaders.js). sway 0..3 (the mesher's channel), leaf 0/1, strength is
  // weather.js' wind (0 in still air), gust 0..1 (weather.js), (dx, dz) the wind direction as a unit vector in x and z.
  // Returns the displacement of a vertex at (ax, az) at time `time`: x and z in blocks, y for leaves only.
  function windOffset(ax, az, time, sway, strength, dx, dz, gust, leaf) {
    const out = { x: 0, y: 0, z: 0 };
    const sw = sway > 0 ? Math.min(3, Math.floor(sway)) : 0, lf = leaf ? 1 : 0;
    const st = Math.max(0, +strength || 0);
    if ((!sw && !lf) || !st) return out;
    const g = 1 + 0.5 * clamp01(+gust || 0);            // a full gust adds half again to the sway
    const t = time * 1.6, ph = ax * 0.37 + az * 0.29;
    const amp = (sw ? sw / 3 * 0.11 : 0.025) * st * g;
    const along = Math.sin(t + ph) * amp + Math.sin(t * 2.3 + ph * 1.7) * amp * 0.35;   // with the wind
    const across = Math.cos(t * 0.9 + ph * 1.3) * amp * 0.8;                              // across it
    out.x = dx * along - dz * across;
    out.z = dz * along + dx * across;
    if (lf) out.y = Math.sin(t * 1.7 + ph * 2.1) * 0.015 * st;
    return out;
  }

  VR.Presence = {
    FOV_DEF, FOV_MIN, FOV_MAX, SPRINT_KICK, KICK_TAU, TURN_LAG,
    clampFov, fovDeg, easeKick, bobAt, rollAt, handSwayAt, landingDip, dipAt, nudgeAt, pushAt, turnFollow, windOffset, wrapPi,
  };
})(VR);

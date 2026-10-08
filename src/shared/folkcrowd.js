// ============================================================================
// Crowd — the animation budget of the people and the behaviour of the trailer heroes. Shared and free of GL, so the
// node test drives it; the drawing lives in src/main/crowd.js.
//
// Budget: a member of the crowd (a villager, a hero) has a pose that is recomputed on a budget. A member within 24
// blocks is recomputed every frame, within 48 every 2nd frame, within 96 every 4th, and farther every 8th. One frame
// recomputes at most C.cap members (the Very Low preset has the smallest cap); the rest wait a frame. A member that
// waits keeps its last pose and its accumulated time, so its next recomputation advances by all the time that passed:
// the motion stays continuous, only its sampling gets coarser. Nothing is allocated per frame: the poses are reused.
//
// Heroes: the two suits of the trailer (blue, orange) with blasters. A hero holds its blaster ready ('hold': breathing,
// glances), strides out with a confident gait when it has somewhere to go, turns to face the player when they come
// close while it stands, and waves with its free left hand when the player comes within 7 blocks (25 s at most
// between two waves). Turning, walking-in and the head's look are all eased: no joint snaps.
// ============================================================================
(function (VR) {
  'use strict';
  const C = VR.Crowd = VR.Crowd || {};
  C.heroes = C.heroes || [];
  // squared distance (blocks²) → frames between two recomputations of a member's pose
  C.BANDS = [[24 * 24, 1], [48 * 48, 2], [96 * 96, 4], [Infinity, 8]];
  C.every = function (d2) { const B = C.BANDS; for (let i = 0; i < B.length; i++) if (d2 <= B[i][0]) return B[i][1]; return 8; };
  C.frame = C.frame || 0; C.dt = 0; C.left = 0; C.cap = 96; C.spread = 0;
  // once per frame, before the members are visited: the frame counter, the frame's time and this frame's budget
  C.tick = function (dt, cap) { C.frame++; C.dt = dt; C.left = cap === undefined ? C.cap : cap; };
  // is the member's pose recomputed this frame? It always accumulates its time (m.bAcc), a skipped member keeps its pose
  C.due = function (m, d2) {
    if (m.bPh === undefined) m.bPh = (C.spread++) & 7;   // members spread over the frames, so they do not all wait together
    m.bAcc = (m.bAcc || 0) + C.dt;
    const every = C.every(d2);
    if (C.left <= 0 || (C.frame + m.bPh) % every !== 0) return false;
    C.left--;
    return true;
  };

  // ------------------------------------------------------------------ the street: the people in view at dusk
  // The Palm City at dusk is not a mob. Each person walks home at its own time (C.homeAt, between dusk[0] and dusk[1]:
  // the streets empty gradually); one adult in plazaShare goes to the plaza, at most seats people sit on its benches at
  // a time, at most kids children run their games at a time (the others roam, running), a stroller pairs up with a
  // neighbour now and then, and at most C.streetCap(preset) people are drawn in view: the nearest ones (the villagers'
  // draw in src/main/villages.js). The numbers are pinned by test/t_heroes2.js.
  C.STREET = { dusk: [11100, 12400], plazaShare: 8, seats: 3, kids: 4, pairShare: 0.35, cap: { potato: 8, low: 12 }, capDefault: 16 };
  C.streetCap = function (preset) { const c = C.STREET.cap[preset]; return c === undefined ? C.STREET.capDefault : c; };
  // a number in [0, 1) from a seed and a salt: the same person has the same numbers in every session
  C.unit = function (seed, salt) {
    let h = Math.imul((seed | 0) ^ Math.imul((salt | 0) + 0x632BE5AB, 0x9E3779B1), 0x85EBCA6B);
    h = Math.imul(h ^ (h >>> 15), 0xC2B2AE35); h ^= h >>> 13;
    return (h >>> 0) / 4294967296;
  };
  // the time of day at which the person walks home
  C.homeAt = function (seed) { const d = C.STREET.dusk; return d[0] + C.unit(seed, 77) * (d[1] - d[0]); };
  // the activities that happen indoors: their people are drawn (the walls hide them) but do not count toward the cap
  C.INDOOR = { home: 1, sleep: 1, breakfast: 1, lunch: 1, school: 1, learn: 1, office: 1, cafe: 1 };
  // one person in plazaShare goes to the plaza's benches and its ring (decided once per person)
  C.plazaPerson = function (seed) { return C.unit(seed, 31) * C.STREET.plazaShare < 1; };
  // keeps the cap smallest squared distances of the people in view, in order, in buf (no allocation); n = how many
  // are kept so far; returns the new count. The threshold is buf[cap − 1] once n reaches cap.
  C.keepNearest = function (buf, n, cap, d2) {
    if (n < cap) { let i = n++; while (i > 0 && buf[i - 1] > d2) { buf[i] = buf[i - 1]; i--; } buf[i] = d2; return n; }
    if (d2 >= buf[cap - 1]) return n;
    let i = cap - 1; while (i > 0 && buf[i - 1] > d2) { buf[i] = buf[i - 1]; i--; } buf[i] = d2;
    return n;
  };

  // ------------------------------------------------------------------ heroes
  // (the body turns slowly and the head leads the look)
  C.HERO = { look: 14, turn: 2.5, lookTurn: 7, stride: 1.2, phase: 5.2, speed: 1.9, wave: { range: 7, time: 2.6, cool: 25 } };
  function angleDiff(to, from) { return Math.atan2(Math.sin(to - from), Math.cos(to - from)); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  // o: { id, pos: [x,y,z] feet, yaw, act, walk: { to: [x,z] or [x,y,z], speed } }, look: the folk look (VR.Folk.heroLook)
  C.newHero = function (o, look) {
    const yaw = o.yaw || 0;
    const h = { id: o.id || 'hero' + C.heroes.length, pos: [o.pos[0], o.pos[1], o.pos[2]], yaw, yawT: yaw, look, walk: null, walkAmt: 0, ph: o.ph || 0,
      state: 'hold', waveT: 0, waveCD: 0, headYaw: 0, headPitch: 0, bAcc: 0, pose: null, mdl: null, aim: o.act === 'aim' || o.aim === true };
    if (o.walk) h.walk = { to: [o.walk.to[0], o.walk.to[o.walk.to.length - 1]], speed: o.walk.speed || C.HERO.speed };
    return h;
  };
  // one frame of a hero's behaviour: walk, turn, wave, look. pl = the player's feet [x,y,z]
  C.stepHero = function (h, dt, pl) {
    const H = C.HERO;
    h.waveCD = Math.max(0, h.waveCD - dt); h.waveT = Math.max(0, h.waveT - dt);
    const dpx = pl[0] - h.pos[0], dpz = pl[2] - h.pos[2], dp = Math.hypot(dpx, dpz);
    let moving = false;
    if (h.walk) {
      const wx = h.walk.to[0] - h.pos[0], wz = h.walk.to[1] - h.pos[2], dw = Math.hypot(wx, wz);
      if (dw < 0.05) { h.walk = null; h.yawT = h.yaw; }
      else {
        const s = Math.min(dw, h.walk.speed * dt);
        h.pos[0] += wx / dw * s; h.pos[2] += wz / dw * s;
        h.ph += s * H.phase;                                 // the gait follows the distance walked: a steady stride at any speed
        h.yawT = Math.atan2(-wx, -wz); moving = true;
      }
    }
    if (!moving && dp < H.look && dp > 0.3) h.yawT = Math.atan2(-dpx, -dpz);   // a standing hero faces the player when close
    h.yaw += angleDiff(h.yawT, h.yaw) * Math.min(1, dt * H.turn);
    if (!moving && dp < H.wave.range && h.waveCD <= 0 && h.waveT <= 0) { h.waveT = H.wave.time; h.waveCD = H.wave.cool; }
    h.walkAmt += ((moving ? 1 : 0) - h.walkAmt) * Math.min(1, dt * 6);
    h.state = moving ? 'walk' : h.waveT > 0 ? 'wave' : 'hold';
    // the head looks at the player when close and standing (eased); otherwise the clip's glances
    let hy = 0, hp = 0;
    if (!moving && dp < H.look && dp > 0.3) {
      hy = clamp(angleDiff(Math.atan2(-dpx, -dpz), h.yaw), -1.1, 1.1);
      hp = clamp(Math.atan2(pl[1] - h.pos[1], dp) * 0.8, -0.5, 0.5);
    }
    const k = Math.min(1, dt * H.lookTurn);
    h.headYaw += (hy - h.headYaw) * k; h.headPitch += (hp - h.headPitch) * k;
    return h;
  };
  // the hero's pose for the time acc since its last one: the FolkAnim clip under the stride, the blaster arm kept up
  C.heroPose = function (h, acc) {
    const FA = VR.FolkAnim, H = C.HERO;
    const P = FA.pose(h, h.state === 'wave' ? 'wave_l' : 'hold', acc, h.ph, h.walkAmt, false, h.poseOut || (h.poseOut = {}), H.stride);
    const w = 0.65 * h.walkAmt;                              // while striding the blaster stays up, roughly where it was held
    P.arm_r[0] += (0.95 - P.arm_r[0]) * w; P.fore_r[0] += (0.4 - P.fore_r[0]) * w;
    // 'aim' (the crew of the hall and the walk out): the blaster is raised to the chest and pointed ahead
    if (h.aim) { P.arm_r[0] += (1.25 - P.arm_r[0]) * 0.85; P.fore_r[0] += (0.25 - P.fore_r[0]) * 0.85; }
    P.head[0] += h.headPitch; P.head[1] += h.headYaw;
    h.pose = P;
    return P;
  };
  // the whole crowd for one frame (the heroes; the villagers are gated in villages.js by C.due)
  C.stepCrowd = function (dt, pl) {
    for (const h of C.heroes) {
      C.stepHero(h, dt, pl);
      const dx = h.pos[0] - pl[0], dz = h.pos[2] - pl[2];
      if (C.due(h, dx * dx + dz * dz)) { C.heroPose(h, h.bAcc); h.bAcc = 0; }
    }
  };
})(VR);

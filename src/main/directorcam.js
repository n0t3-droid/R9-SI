// ============================================================================
// Die Reisekamera (e-ctx; docs/superpowers/specs/2026-10-22-erlebnis-design.md §2 and §5, plan docs/superpowers/plans/
// 2026-10-22-e-ctx.md §2.3): a trip by intent is cut like a film. One shot per phase — the call (behind you, the ship
// coming in; when it comes down over its pad, the low pad shot with you and the ship side by side, through the
// boarding), the take-off (the low chase from behind and below), the cruise (a chase,
// a side tracking shot and a fly-by from a point ahead, cut in turn), the approach (the target in the upper third, the
// ship small in the lower third), the landing (the low chase) and the arrival (3 s, the target framed like a wow moment,
// a slow push-in); a walk is a slow follow shot with the target framed ahead.
// Rules: a shot lasts ≥ 4 s (a phase that changes sooner waits); in the cruise a cut comes on motion — a turn begins,
// the bank flips — or at 8 s, never the same shot twice in a row, a fly-by only at speed; the mouse looks round freely
// (an offset that eases back after 1.5 s at rest) and never cancels; a camera is lifted until the line to its subject
// clears the ground. ⚙ Spiel „Reisekamera" (travelCam): off keeps your own view.
// Pure (test/dircam.js): compose · lift · seqState / cut / step · lookState / look · pose. Game side: travel(g, c, base,
// where) — intent.js asks for the frame's camera (on foot, or from flight.js's camera in the ship).
// Shared later with the highlight reel (erlebnis §5, wave 6). Cost 🟢: a few vector operations a frame while a trip runs.
// ============================================================================
(function (VR) {
  'use strict';
  const D = VR.DirCam = VR.DirCam || {};
  const DEG = Math.PI / 180, TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const wrapA = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
  const smooth = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  const k1 = (rate, dt) => 1 - Math.exp(-rate * dt);
  D.MIN = 4; D.MAX = 8; D.LOOK_YAW = 100 * DEG; D.LOOK_PITCH = 60 * DEG; D.LOOK_IDLE = 1.5;
  // the shot each phase opens with (the boarding keeps the call's shot running)
  D.OPEN = { call: 'call', board: 'call', walk: 'walk', takeoff: 'takeoff', cruise: 'chase', approach: 'approach', land: 'land', arrive: 'arrive', done: 'arrive' };
  const CRUISE = ['chase', 'side', 'flyby'];
  const lookAt = (out, C, P) => { const dx = P[0] - C[0], dy = P[1] - C[1], dz = P[2] - C[2]; out.x = C[0]; out.y = C[1]; out.z = C[2]; out.yaw = Math.atan2(-dx, -dz); out.pitch = Math.atan2(dy, Math.hypot(dx, dz)); return out; };

  // ---------------------------------------------------------------- composition (pure)
  // the camera behind the subject S on the line from the target T: T on the upper third line, S on the lower one, both
  // on the vertical middle; the subject small (6 × its size away); never under the ground + 3 m (then the lens widens)
  D.compose = function (T, S, opts) {
    opts = opts || {};
    const fov0 = opts.fov || 60 * DEG, size = opts.size || 6, back = opts.back || Math.max(30, size * 6);
    let ux = S[0] - T[0], uz = S[2] - T[2]; const L = Math.hypot(ux, uz) || 1; ux /= L; uz /= L;
    const cx = S[0] + ux * back, cz = S[2] + uz * back, dS = back, dT = back + L;
    const gap = 2 * Math.atan(Math.tan(fov0 / 2) / 3);
    const f = (y) => Math.atan2(T[1] - y, dT) - Math.atan2(S[1] - y, dS) - gap;
    // the lowest camera height that holds the thirds (f rises from below the ship, peaks, falls again far above)
    let y = S[1] - 40, prev = y;
    if (f(y) < 0) { let found = false; for (let h = S[1] - 40; h <= S[1] + 500; h += 2) { if (f(h) >= 0) { let lo = prev, hi = h; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (f(m) < 0) lo = m; else hi = m; } y = (lo + hi) / 2; found = true; break; } prev = h; } if (!found) y = S[1] + Math.max(6, size); }
    const gy = opts.ground ? opts.ground(cx, cz) : null;
    if (gy !== null && gy !== undefined && y < gy + 3) y = gy + 3;
    const aT = Math.atan2(T[1] - y, dT), aS = Math.atan2(S[1] - y, dS);
    const fov = clamp(2 * Math.atan(3 * Math.tan((aT - aS) / 2)), 30 * DEG, 80 * DEG);
    return { x: cx, y, z: cz, yaw: Math.atan2(-(T[0] - cx), -(T[2] - cz)), pitch: (aT + aS) / 2, roll: 0, fov };
  };
  // raise C until the line C → S passes 1.5 m over the ground (one pass: the largest need along the line)
  D.lift = function (ground, C, S) {
    if (!ground) return C;
    let need = 0;
    for (let i = 1; i < 40; i++) {
      const u = i / 40; if (u > 0.95) break;
      const x = C[0] + (S[0] - C[0]) * u, z = C[2] + (S[2] - C[2]) * u, y = C[1] + (S[1] - C[1]) * u, g = ground(x, z);
      if (g === null || g === undefined) continue;
      const d = (g + 1.5 - y) / (1 - u); if (d > need) need = d;
    }
    const g0 = ground(C[0], C[2]); if (g0 !== null && g0 !== undefined && C[1] + need < g0 + 1.5) need = g0 + 1.5 - C[1];
    if (need > 0) C[1] += need;
    return C;
  };

  // ---------------------------------------------------------------- the cut (pure)
  D.seqState = () => ({ kind: null, t: 0, phase: null, hist: [], side: 1, anchor: null, yr0: 0, bank0: 0, passed: false, cur: null, n: 0 });
  // s: {phase, speed, yawRate, bank, passed} → the shot to cut to now, or null
  D.cut = function (seq, s) {
    const open = D.OPEN[s.phase] || 'chase';
    if (!seq.kind) return open;
    if (s.phase !== seq.phase) {
      if (open === seq.kind || (open === 'call' && seq.kind === 'callland')) return null;   // (the call's shots run on through the boarding)
      if (seq.t >= D.MIN - 1e-3 || seq.kind === 'call' || seq.kind === 'walk') return open;
      return null;                                               // (the shot keeps its 4 s first)
    }
    // the called ship comes down over its pad: the cut to the low pad shot (once the call's shot had its 4 s)
    if (s.phase === 'call' && seq.kind === 'call' && seq.t >= D.MIN - 1e-3 && (s.stage === 'hover' || s.stage === 'settle')) return 'callland';
    if (s.phase !== 'cruise' || seq.t < D.MIN - 1e-3) return s.phase === 'approach' && seq.t >= 2 * D.MAX - 1e-3 ? 'approach' : null;
    const yr = Math.abs(s.yawRate || 0), turn = yr > 0.12 && Math.abs(seq.yr0) <= 0.12;
    const b = s.bank || 0, flip = Math.abs(b) > 0.1 && Math.sign(b) !== Math.sign(seq.bank0 || 0) && Math.abs(seq.bank0 || 0) > 0.02;
    if (turn || flip || seq.t >= D.MAX - 1e-3 || (seq.kind === 'flyby' && s.passed)) {
      const i0 = CRUISE.indexOf(seq.kind);
      for (let k = 1; k <= 3; k++) { const c = CRUISE[(Math.max(0, i0) + k) % 3]; if (c === seq.kind) continue; if (c === 'flyby' && (s.speed || 0) <= 12) continue; return c; }
    }
    return null;
  };
  // one frame of the sequencer: cut or run on → the shot
  D.step = function (seq, s, dt) {
    if (seq.kind) seq.t += dt;
    const c = D.cut(seq, s);
    if (c) { seq.kind = c; seq.t = 0; seq.phase = s.phase; seq.hist.push(c); seq.side = -seq.side; seq.anchor = null; seq.cur = null; seq.passed = false; seq.n++; }
    else if (D.OPEN[s.phase] === seq.kind || (s.phase === 'cruise' && CRUISE.indexOf(seq.kind) >= 0) || (seq.kind === 'callland' && (s.phase === 'call' || s.phase === 'board'))) seq.phase = s.phase;   // (a new phase waits for its shot until the old one had its 4 s)
    seq.yr0 = Math.abs(s.yawRate || 0) > 0.12 ? (s.yawRate || 0) : 0;
    if (Math.abs(s.bank || 0) > 0.02) seq.bank0 = s.bank;
    return seq.kind;
  };

  // ---------------------------------------------------------------- the free look (pure)
  D.lookState = () => ({ yaw: 0, pitch: 0, idle: 9 });
  D.look = function (L, dx, dy, dt, sens) {
    sens = sens || 0.0024;
    if (dx || dy) { L.yaw = clamp(L.yaw - dx * sens, -D.LOOK_YAW, D.LOOK_YAW); L.pitch = clamp(L.pitch - dy * sens, -D.LOOK_PITCH, D.LOOK_PITCH); L.idle = 0; }
    else { L.idle += dt; if (L.idle > D.LOOK_IDLE) { const k = k1(1.6, dt); L.yaw -= L.yaw * k; L.pitch -= L.pitch * k; } }
    return L;
  };

  // ---------------------------------------------------------------- the shots (pure given the context)
  // ctx: {subj: {pos (centre), vel, heading, size, yawRate, roll}, target: {pos, base, top}, player: [x, y, z], ship
  // (pos of a called ship, or null), spot (the landing pad), start (the take-off pad), ground(x, z), base: {fov}}
  const V = [0, 0, 0], W = [0, 0, 0];
  D.pose = function (seq, ctx, L, out) {
    const S = ctx.subj, T = ctx.target, fov0 = (ctx.base && ctx.base.fov) || 70 * DEG, size = (S && S.size) || 6, gnd = ctx.ground;
    const gy = (x, z, d) => { const v = gnd ? gnd(x, z) : null; return v === null || v === undefined ? d : v; };
    const head = S ? S.heading : 0, fx = -Math.sin(head), fz = -Math.cos(head), rx = Math.cos(head), rz = -Math.sin(head);
    const vel = S && S.vel ? S.vel : [fx, 0, fz], sp = Math.hypot(vel[0], vel[1], vel[2]);
    const vx = sp > 0.5 ? vel[0] / sp : fx, vz = sp > 0.5 ? vel[2] / sp : fz;
    out.roll = 0; out.fov = fov0;
    const k = seq.kind;
    if (k === 'chase') {
      const D0 = size * 2.6 + 9, h = size * 0.6 + 2.5;
      V[0] = S.pos[0] - vx * D0; V[1] = S.pos[1] + h; V[2] = S.pos[2] - vz * D0;
      W[0] = S.pos[0] + vx * size; W[1] = S.pos[1] + 0.5; W[2] = S.pos[2] + vz * size;
      D.lift(gnd, V, S.pos); lookAt(out, V, W); out.roll = -(S.roll || 0) * 0.25; out.fov = fov0 * 0.95;
    } else if (k === 'side') {
      const off = size * 2.4 + 8, sd = seq.side;
      V[0] = S.pos[0] + rx * sd * off + vx * size * 0.5; V[1] = S.pos[1] + size * 0.3 + 1.5; V[2] = S.pos[2] + rz * sd * off + vz * size * 0.5;
      D.lift(gnd, V, S.pos); lookAt(out, V, S.pos); out.fov = fov0 * 0.9;
    } else if (k === 'flyby') {
      if (!seq.anchor) {
        const ahead = Math.max(20, sp * 3.0) + size * 3, sd = seq.side, x = S.pos[0] + vx * ahead + rx * sd * (size * 1.6 + 6), z = S.pos[2] + vz * ahead + rz * sd * (size * 1.6 + 6);
        seq.anchor = [x, Math.max(S.pos[1] - 3 + (seq.n % 3) * 2.5, gy(x, z, S.pos[1] - 20) + 3), z];
      }
      const A = seq.anchor;
      seq.passed = (S.pos[0] - A[0]) * vx + (S.pos[2] - A[2]) * vz > size * 6;
      lookAt(out, A, S.pos); out.fov = fov0 * 0.8;
    } else if (k === 'takeoff') {
      if (!seq.anchor) {
        const P0 = ctx.start || S.pos, D0 = size * 2.2 + 7, sd = seq.side, x = P0[0] - fx * D0 + rx * sd * size * 0.8, z = P0[2] - fz * D0 + rz * sd * size * 0.8;
        seq.anchor = [x, gy(x, z, P0[1] - 1) + 1.6, z, P0[0], P0[1], P0[2]];
      }
      const A = seq.anchor;
      // the camera keeps low and drifts a quarter of the way after the ship, looking up at it
      V[0] = A[0] + (S.pos[0] - A[3]) * 0.25; V[2] = A[2] + (S.pos[2] - A[5]) * 0.25; V[1] = Math.max(A[1], gy(V[0], V[2], A[1] - 1.6) + 1.6);
      lookAt(out, V, S.pos); out.fov = fov0 * 0.95;
    } else if (k === 'land') {
      if (!seq.anchor) {
        const P0 = ctx.spot || S.pos, D0 = size * 2.6 + 10, sd = seq.side, x = P0[0] - vx * D0 + rx * sd * size, z = P0[2] - vz * D0 + rz * sd * size;
        seq.anchor = [x, gy(x, z, P0[1] - 1) + 1.8, z];
      }
      const A = seq.anchor; V[0] = A[0]; V[1] = A[1]; V[2] = A[2];
      D.lift(gnd, V, S.pos); lookAt(out, V, S.pos); out.fov = fov0 * 0.9;
    } else if (k === 'approach') {
      const top = T.top !== undefined ? T.top : T.pos[1] + 10, base = T.base !== undefined ? T.base : T.pos[1] - 10;
      const Tp = [T.pos[0], base + (top - base) * 0.66, T.pos[2]];
      const c = D.compose(Tp, S.pos, { fov: Math.min(fov0, 62 * DEG), size, ground: gnd });
      V[0] = c.x; V[1] = c.y; V[2] = c.z; out.x = c.x; out.y = c.y; out.z = c.z; out.yaw = c.yaw; out.pitch = c.pitch; out.fov = c.fov;
    } else if (k === 'arrive') {
      const top = T.top !== undefined ? T.top : T.pos[1] + 10, base = T.base !== undefined ? T.base : T.pos[1] - 10;
      const Tp = [T.pos[0], base + (top - base) * 0.55, T.pos[2]];
      if (!seq.anchor) {
        const P0 = S.pos; let ux = Tp[0] - P0[0], uz = Tp[2] - P0[2]; const Lh = Math.hypot(ux, uz) || 1; ux /= Lh; uz /= Lh;
        const sd = seq.side, x = P0[0] - ux * (size * 1.3 + 4) - uz * sd * (size * 1.2 + 3), z = P0[2] - uz * (size * 1.3 + 4) + ux * sd * (size * 1.2 + 3);
        seq.anchor = [x, Math.max(P0[1] + 2.5, gy(x, z, P0[1]) + 2.2), z, ux, uz];
      }
      const A = seq.anchor, push = 3 * smooth(seq.t / 3);
      V[0] = A[0] + A[3] * push; V[1] = A[1] + 0.2 * push; V[2] = A[2] + A[4] * push;
      const fov = fov0 * 0.85; lookAt(out, V, Tp);
      out.pitch -= Math.atan(Math.tan(fov / 2) / 3); out.fov = fov;   // (the target in the upper third)
    } else if (k === 'callland') {
      // the pad shot: low on the ground off to the side of the hero and the pad, both in the frame — the ship settles
      // down beside you
      const P = ctx.player || S.pos, Sh = ctx.ship || S.pos, pad = ctx.spot || Sh;
      if (!seq.anchor) {
        let ux = pad[0] - P[0], uz = pad[2] - P[2]; const Lp = Math.hypot(ux, uz) || 1; ux /= Lp; uz /= Lp;
        const sd = seq.side, off = Lp * 0.6 + size * 1.5 + 10, mx = (P[0] + pad[0]) / 2 - ux * Lp * 0.15, mz = (P[2] + pad[2]) / 2 - uz * Lp * 0.15;
        const x = mx - uz * sd * off, z = mz + ux * sd * off;
        seq.anchor = [x, gy(x, z, P[1] - 1) + 1.4, z];
      }
      const A = seq.anchor;
      W[0] = (P[0] + Sh[0]) / 2; W[2] = (P[2] + Sh[2]) / 2; W[1] = Math.min((P[1] + 1.6 + Sh[1]) / 2, P[1] + 1.6 + size * 1.2);
      V[0] = A[0]; V[1] = A[1]; V[2] = A[2];
      D.lift(gnd, V, W); lookAt(out, V, W); out.fov = fov0;
    } else if (k === 'call') {
      const P = ctx.player || S.pos, Sh = ctx.ship || null;
      let tx, ty, tz;
      if (Sh) { tx = Sh[0]; ty = Sh[1]; tz = Sh[2]; } else { tx = T.pos[0]; ty = P[1] + 25; tz = T.pos[2]; }
      let ux = tx - P[0], uz = tz - P[2]; const Lh = Math.hypot(ux, uz) || 1; ux /= Lh; uz /= Lh;
      const sd = seq.side;
      V[0] = P[0] - ux * 5.5 - uz * sd * 2; V[1] = P[1] + 2.4; V[2] = P[2] - uz * 5.5 + ux * sd * 2;
      V[1] = Math.max(V[1], gy(V[0], V[2], P[1]) + 1.8);
      // the ship and the hero both in the frame: aim a little under the ship (it high, you low)
      W[0] = tx; W[1] = Math.min(ty, P[1] + 1.6 + Math.max(4, Lh * 0.45)); W[2] = tz;
      lookAt(out, V, W); out.pitch = clamp(out.pitch - 0.08, -0.6, 0.9); out.fov = fov0;
    } else {   // walk: behind you, the target framed ahead
      const P = ctx.player || S.pos, hd = S ? S.heading : 0;
      const bx = -Math.sin(hd), bz = -Math.cos(hd);
      V[0] = P[0] - bx * 6; V[1] = P[1] + 2.8; V[2] = P[2] - bz * 6;
      V[1] = Math.max(V[1], gy(V[0], V[2], P[1]) + 1.8);
      const dT = T ? Math.hypot(T.pos[0] - P[0], T.pos[2] - P[2]) : 99;
      if (T && dT < 40) { W[0] = T.pos[0]; W[1] = Math.min(T.pos[1], P[1] + 6); W[2] = T.pos[2]; }
      else { W[0] = P[0] + bx * 12; W[1] = P[1] + 1.2; W[2] = P[2] + bz * 12; }
      lookAt(out, V, W); out.fov = fov0;
    }
    if (L) { out.yaw += L.yaw; out.pitch = clamp(out.pitch + L.pitch, -1.5, 1.5); }
    return out;
  };

  // ---------------------------------------------------------------- the game side: the frame's camera of a trip
  // c: the intent (intent.js), base: the camera the game (or the flight) made this frame, where: 'foot' | 'ship'
  const CTX = { subj: null, target: null, player: null, ship: null, spot: null, start: null, ground: null, base: null };
  const SUBJ = { pos: [0, 0, 0], vel: [0, 0, 0], heading: 0, size: 6, yawRate: 0, roll: 0 };
  const SST = { phase: '', speed: 0, yawRate: 0, bank: 0, passed: false, stage: null };
  const P0 = {};
  D.travel = function (g, c, base, where) {
    if (!c || !c.seq) return null;
    const dt = c.dt || 1 / 60, seq = c.seq, p = g.player;
    let phase = c.phase === 'done' ? 'arrive' : c.phase;
    if (!c.ground) { const w = g.world; c.ground = (x, z) => { const col = w && w.col(Math.floor(x) >> 4, Math.floor(z) >> 4); return col && col.ready ? col.height[((Math.floor(z) & 15) << 4) | (Math.floor(x) & 15)] + 1 : null; }; }
    const S = SUBJ;
    CTX.ship = null; CTX.spot = null; CTX.start = null; CTX.player = p.pos;
    if (where === 'ship' && c.fl) {
      const fl = c.fl, b = fl.b, m = fl.toWorld(b.center || [0, 0, 0]);
      S.pos[0] = m[0]; S.pos[1] = m[1]; S.pos[2] = m[2]; S.vel = b.vel; S.heading = b.heading; S.size = b.radius || 6; S.yawRate = fl.yawRate || 0; S.roll = fl.roll || 0;
      const A = fl.auto; CTX.spot = A && A.spot ? A.spot : null; CTX.start = c.fl0 || null;
      if (!c.fl0) c.fl0 = [b.pos[0], b.pos[1], b.pos[2]];
      CTX.start = c.fl0;
      if (phase === 'call' || phase === 'board') phase = 'takeoff';
    } else {
      const s = c.ship;
      if ((phase === 'call' || phase === 'board') && s && s.d && s.d.meta) { const md = s.d.meta; CTX.ship = [s.pos[0], s.pos[1] + md.height * 0.5, s.pos[2]]; S.pos[0] = CTX.ship[0]; S.pos[1] = CTX.ship[1]; S.pos[2] = CTX.ship[2]; S.size = Math.max(md.length, md.width) * 0.5; S.vel = s.vel || [0, 0, 0]; S.heading = s.yaw; CTX.spot = c.pad || null; }
      else { S.pos[0] = p.pos[0]; S.pos[1] = p.pos[1] + 1; S.pos[2] = p.pos[2]; S.size = 1; S.vel = p.vel || [0, 0, 0]; S.heading = p.yaw; }
      if (phase === 'arrive' || phase === 'walk') { S.heading = p.yaw; }
    }
    CTX.subj = S; CTX.target = c.target; CTX.ground = c.ground; CTX.base = base;
    SST.phase = phase; SST.speed = Math.hypot(S.vel[0], S.vel[1], S.vel[2]); SST.yawRate = S.yawRate; SST.bank = S.roll; SST.passed = seq.passed; SST.stage = where === 'ship' ? null : c.shipStage || null;
    if (phase === 'walk') SST.speed = 0;
    D.step(seq, SST, dt);
    const out = D.pose(seq, CTX, null, P0);
    // a moving camera glides (a cut snaps); then the free look
    const fresh = !seq.cur;
    if (fresh) seq.cur = { x: out.x, y: out.y, z: out.z, yaw: out.yaw, pitch: out.pitch, fov: out.fov, roll: out.roll || 0 };
    const cu = seq.cur, glide = seq.kind === 'chase' || seq.kind === 'side' || seq.kind === 'approach' || seq.kind === 'call' || seq.kind === 'walk';
    const kp = fresh || !glide ? 1 : k1(seq.kind === 'approach' ? 2.5 : 5, dt), ka = fresh ? 1 : k1(9, dt);
    cu.x += (out.x - cu.x) * kp; cu.y += (out.y - cu.y) * kp; cu.z += (out.z - cu.z) * kp;
    cu.yaw += wrapA(out.yaw - cu.yaw) * ka; cu.pitch += (out.pitch - cu.pitch) * ka; cu.fov += (out.fov - cu.fov) * ka; cu.roll += ((out.roll || 0) - cu.roll) * ka;
    const L = c.look || { yaw: 0, pitch: 0 };
    return Object.assign({}, base, { x: cu.x, y: cu.y, z: cu.z, yaw: cu.yaw + L.yaw, pitch: clamp(cu.pitch + L.pitch, -1.5, 1.5), roll: cu.roll, fov: cu.fov, fixed: true, far: (base.far || 1000) + 60, shot: seq.kind });
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

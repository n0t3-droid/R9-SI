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
    // e-access · Weniger Bewegung: a turn of more than ~25° (or a big tilt) is a cut, not a fast pan; the camera never rolls
    const less = !!(VR.A11y && VR.A11y.less(g.settings)), jump = less && !fresh && (Math.abs(wrapA(out.yaw - cu.yaw)) > 0.44 || Math.abs(out.pitch - cu.pitch) > 0.3);
    if (less) out.roll = 0;
    const kp = fresh || !glide || jump ? 1 : k1(seq.kind === 'approach' ? 2.5 : 5, dt), ka = fresh || jump ? 1 : k1(9, dt);
    cu.x += (out.x - cu.x) * kp; cu.y += (out.y - cu.y) * kp; cu.z += (out.z - cu.z) * kp;
    cu.yaw += wrapA(out.yaw - cu.yaw) * ka; cu.pitch += (out.pitch - cu.pitch) * ka; cu.fov += (out.fov - cu.fov) * ka; cu.roll += ((out.roll || 0) - cu.roll) * ka;
    const L = c.look || { yaw: 0, pitch: 0 };
    return Object.assign({}, base, { x: cu.x, y: cu.y, z: cu.z, yaw: cu.yaw + L.yaw, pitch: clamp(cu.pitch + L.pitch, -1.5, 1.5), roll: cu.roll, fov: cu.fov, fixed: true, far: (base.far || 1000) + 60, shot: seq.kind });
  };
  // ============================================================================ e-cam · die Highlight-Rolle, the pure part
  // (docs/superpowers/plans/2026-10-31-e-cam.md; erlebnis §5): the track, the highlights, the plan, the shots, the save.
  // Cost 🟢: the track is a compare and seven stores at 5 Hz; everything else runs only when the reel is built or plays.
  // ---------------------------------------------------------------- the track: pose, look, time of day and world at 5 Hz
  const TK = 7;
  D.TRACK_HZ = 5; D.TRACK_N = 6000;   // (20 minutes: 6,000 × 7 floats = 168 KB)
  D.Track = function (cap) { this.cap = cap || D.TRACK_N; this.a = new Float32Array(this.cap * TK); this.n = 0; this.i = 0; this.last = -1e9; this.bytes = this.a.byteLength; };
  D.Track.prototype.rec = function (t, x, y, z, yaw, tod, dim) {
    if (t - this.last < 1 / D.TRACK_HZ - 1e-3) return false;
    this.last = t; const a = this.a, o = this.i * TK;
    a[o] = t; a[o + 1] = x; a[o + 2] = y; a[o + 3] = z; a[o + 4] = yaw; a[o + 5] = tod; a[o + 6] = dim;
    this.i = (this.i + 1) % this.cap; if (this.n < this.cap) this.n++;
    return true;
  };
  D.Track.prototype.clear = function () { this.n = 0; this.i = 0; this.last = -1e9; };
  D.Track.prototype.off = function (k) { return (((this.n < this.cap ? 0 : this.i) + k) % this.cap) * TK; };   // (the k-th oldest)
  D.Track.prototype.first = function () { return this.n ? this.a[this.off(0)] : null; };
  // the pose at t (interpolated; the yaw the short way; never across a change of world): {t, x, y, z, yaw, tod, dim} or null
  D.Track.prototype.at = function (t) {
    const n = this.n, a = this.a; if (!n) return null;
    const t0 = a[this.off(0)], tN = a[this.off(n - 1)];
    if (t < t0 - 1e-3 || t > tN + 0.25) return null;
    let lo = 0, hi = n - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (a[this.off(m)] <= t) lo = m; else hi = m - 1; }
    const p = this.off(lo), q = lo < n - 1 ? this.off(lo + 1) : p;
    const P = (o) => ({ t: a[o], x: a[o + 1], y: a[o + 2], z: a[o + 3], yaw: a[o + 4], tod: a[o + 5], dim: a[o + 6] });
    if (p === q || a[p + 6] !== a[q + 6]) return P(p);
    const u = clamp((t - a[p]) / Math.max(1e-6, a[q] - a[p]), 0, 1), L = (k) => a[p + k] + (a[q + k] - a[p + k]) * u;
    return { t, x: L(1), y: L(2), z: L(3), yaw: wrapA(a[p + 4] + wrapA(a[q + 4] - a[p + 4]) * u), tod: L(5), dim: a[p + 6] };
  };

  // ---------------------------------------------------------------- the highlights (pure)
  D.REEL_TARGET = 60; D.REEL_MIN = 30; D.REEL_MAX = 90; D.REEL_HL = 12;
  const shotLen = (h) => (h.card ? 4 : h.w >= 5 ? 7 : h.w >= 4 ? 6 : 5);
  D.shotLen = shotLen;
  // events of weight ≥ 3 and the golden hours read from the 1-Hz samples (≥ 8 s of a low sun) → the reel's highlights,
  // in the order they happened: every peak (≤ 4), then by score (10 w, +3 seen, +2 a postcard, +4 the first of its sub,
  // +2 a long look, +5 a kind not yet in, +3 a sub not yet in), ≤ 2 of a sub and ≤ 3 of a kind, until the reel is ~60 s
  D.pick = function (events, samples, opts) {
    opts = opts || {};
    const cand = [];
    for (const e of events || []) if (e && e.w >= 3) cand.push(Object.assign({}, e));
    let run = null;
    const endRun = () => { if (run && run.n >= 8) { const s = run.mid; cand.push({ t: s.t, kind: 'sky', sub: s.tod > 6000 && s.tod < 18000 ? 'sunset' : 'sunrise', w: 3, x: s.x, y: null, z: s.z, r: 6, inView: true, long: true, tod: s.tod, dim: opts.dimAt ? opts.dimAt(s.t) : 'overworld', src: 'sample' }); } run = null; };
    for (const s of samples || []) {
      if (s && s.sky === 'low_sun') { if (!run) run = { n: 0, list: [] }; run.n++; run.list.push(s); run.mid = run.list[run.list.length >> 1]; }
      else endRun();
    }
    endRun();
    cand.sort((a, b) => a.t - b.t);
    const merged = [];
    for (const c of cand) {
      const m = merged.find((h) => h.sub === c.sub && Math.abs(h.t - c.t) <= 45 && Math.hypot(h.x - c.x, h.z - c.z) <= 60);
      if (m) { if (c.w > m.w) Object.assign(m, c); continue; }
      merged.push(c);
    }
    const seenSub = {};
    for (const h of merged) { h.score = 10 * h.w + (h.inView ? 3 : 0) + (h.card ? 2 : 0) + (seenSub[h.sub] ? 0 : 4) + (h.long ? 2 : 0); seenSub[h.sub] = 1; }
    const out = [], nSub = {}, nKind = {}, take = (h) => { out.push(h); nSub[h.sub] = (nSub[h.sub] || 0) + 1; nKind[h.kind] = (nKind[h.kind] || 0) + 1; h._in = true; };
    let time = 6;   // (the two cards)
    merged.filter((h) => h.w >= 5).sort((a, b) => b.score - a.score).slice(0, 4).forEach((h) => { take(h); time += shotLen(h); });
    for (;;) {
      if (out.length >= D.REEL_HL) break;
      let best = null, bs = -1;
      for (const h of merged) {
        if (h._in || (nSub[h.sub] || 0) >= 2 || (nKind[h.kind] || 0) >= 3 || time + shotLen(h) > D.REEL_TARGET + 0.01) continue;
        const s = h.score + (nKind[h.kind] ? 0 : 5) + (nSub[h.sub] ? 0 : 3);
        if (s > bs) { bs = s; best = h; }
      }
      if (!best) break;
      take(best); time += shotLen(best);
    }
    for (const h of merged) delete h._in;
    return out.sort((a, b) => a.t - b.t);
  };

  // ---------------------------------------------------------------- the plan: cards, shots, framings, captions (pure)
  const FRAME_SUB = { freed: 'crane', boss: 'orbit', site_done: 'orbit', life_done: 'orbit', showcase: 'orbit', arrive: 'compose', ferry_arrive: 'compose', landing: 'compose', sunset: 'sun', sunrise: 'sun', wonder: 'push', outpost: 'push' };
  const FRAME_KIND = { milestone: 'crane', discovery: 'push', build: 'orbit', travel: 'compose', sky: 'compose', story: 'push', encounter: 'orbit', wow: 'push', social: 'compose' };
  const ALT = ['orbit', 'push', 'compose', 'crane'];
  D.REEL_CAPS = ['freed', 'boss', 'moon_land', 'star_jump', 'site_done', 'life_done', 'arrive', 'ferry_arrive', 'sunset', 'sunrise', 'wonder', 'outpost', 'skyray', 'rays', 'murm', 'fireworks', 'showcase'];
  D.capKey = (h) => 'g.reel.c.' + (D.REEL_CAPS.indexOf(h.sub) >= 0 ? h.sub : 'k_' + (FRAME_KIND[h.kind] || h.kind === 'space' ? h.kind : 'other'));
  D.reelPlan = function (hl, opts) {
    opts = opts || {};
    const list = (hl || []).slice();
    const build = (stretch) => {
      const shots = [{ frame: 'title', dur: 3, cap: 'g.reel.title', tod: list.length ? list[0].tod : undefined }];
      for (const h of list) {
        let f = h.card ? 'card' : FRAME_SUB[h.sub] || FRAME_KIND[h.kind] || 'compose';
        const prev = shots[shots.length - 1].frame;
        if (f === prev) f = f === 'card' ? 'cardpan' : f === 'sun' ? 'compose' : ALT.find((a) => a !== prev);
        if (f === 'cardpan' && prev === 'cardpan') f = 'card';
        shots.push({ h, frame: f, dur: stretch ? 8 : shotLen(h), tod: h.tod, cap: D.capKey(h) });
      }
      shots.push({ frame: 'end', dur: 3, cap: 'g.reel.end', tod: list.length ? list[list.length - 1].tod : undefined });
      let dur = 0; for (const s of shots) dur += s.dur;
      return { shots, dur };
    };
    let pl = build(false);
    while (pl.dur > D.REEL_MAX && list.length > 1) { let wi = 0; for (let i = 1; i < list.length; i++) if ((list[i].score || 0) < (list[wi].score || 0)) wi = i; list.splice(wi, 1); pl = build(false); }
    if (pl.dur < D.REEL_MIN && list.length) pl = build(true);
    pl.short = pl.dur < D.REEL_MIN; pl.n = list.length;
    return pl;
  };

  // ---------------------------------------------------------------- staging one shot (pure): a camera function of t
  D.sunAz = (tod) => (((tod || 0) % 24000) / 24000) * TAU + 0.4;   // (env.js: the sun's azimuth; x = cos, z = sin)
  const look = (o, C, P) => { const dx = P[0] - C[0], dy = P[1] - C[1], dz = P[2] - C[2]; o.yaw = Math.atan2(-dx, -dz); o.pitch = Math.atan2(dy, Math.hypot(dx, dz)); return o; };
  // ctx: {target [x, y, z], r, avatar(t) → {x, y, z, yaw} | null, ground(x, z), sunAz}
  D.stage = function (shot, ctx) {
    const dur = shot.dur, T = ctx.target, r = Math.max(2, ctx.r || 6), gnd = ctx.ground || null, f = shot.frame;
    const gy = (x, z, d) => { const v = gnd ? gnd(x, z) : null; return v === null || v === undefined || !Number.isFinite(v) ? d : v; };
    const A0 = ctx.avatar ? ctx.avatar(dur / 2) : null;
    // the side the camera comes from: behind the avatar (it between us and the place), else a fixed quarter
    let ux = 0.6, uz = 0.8;
    if (A0) { const dx = A0.x - T[0], dz = A0.z - T[2], L = Math.hypot(dx, dz); if (L > 1) { ux = dx / L; uz = dz / L; } }
    const fov = (f === 'push' ? 50 : f === 'orbit' ? 55 : 58) * DEG;
    let subj = T, pos, S = null;   // pos(t) → [x, y, z] before the lift; then the camera looks at subj (or along the sun)
    if (f === 'compose') {
      S = A0 ? [A0.x, A0.y + 1, A0.z] : [T[0] + ux * (r * 2 + 15), gy(T[0] + ux * (r * 2 + 15), T[2] + uz * (r * 2 + 15), T[1] - 4) + 1, T[2] + uz * (r * 2 + 15)];
      const c0 = D.compose(T, S, { fov, size: 2, back: 26, ground: gnd }), c1 = D.compose(T, S, { fov, size: 2, back: 21, ground: gnd });
      pos = (t) => { const u = t / dur; return [c0.x + (c1.x - c0.x) * u, c0.y + (c1.y - c0.y) * u, c0.z + (c1.z - c0.z) * u]; };
    } else if (f === 'orbit') {
      const R = r * 2.2 + 12, a0 = Math.atan2(uz, ux), sw = 30 * DEG * (shot.h && (shot.h.t | 0) % 2 ? -1 : 1);
      pos = (t) => { const a = a0 + sw * (t / dur - 0.5), x = T[0] + Math.cos(a) * R, z = T[2] + Math.sin(a) * R; return [x, Math.max(T[1] + R * 0.35, gy(x, z, T[1]) + 3), z]; };
    } else if (f === 'crane') {
      const R = r * 1.8 + 14, x = T[0] + ux * R, z = T[2] + uz * R, y0 = gy(x, z, T[1] - 2) + 2, y1 = Math.max(y0 + 6, T[1] + R * 0.8);
      pos = (t) => { const u = t / dur; return [T[0] + ux * R * (1 + 0.15 * u), y0 + (y1 - y0) * u, T[2] + uz * R * (1 + 0.15 * u)]; };
    } else if (f === 'sun') {
      const az = ctx.sunAz !== undefined ? ctx.sunAz : 0, sx = Math.cos(az), sz = Math.sin(az), Ap = A0 ? [A0.x, A0.y, A0.z] : [T[0], gy(T[0], T[2], T[1]), T[2]];
      subj = [Ap[0] + sx * 40, Ap[1] + 1, Ap[2] + sz * 40];   // (the low sun's side of the land, ahead of you)
      pos = (t) => { const k = 9 - 0.6 * t, x = Ap[0] - sx * k, z = Ap[2] - sz * k; return [x, Math.max(Ap[1] + 2.6, gy(x, z, Ap[1]) + 2), z]; };
    } else {   // push (and any other): a slow push-in from the avatar's side
      const R0 = r * 2.6 + 20;
      pos = (t) => { const k = R0 * (1 - 0.15 * t / dur), x = T[0] + ux * k, z = T[2] + uz * k; return [x, T[1] + R0 * 0.25, z]; };
    }
    // the lift: one offset for the whole shot (the largest need at five moments), so the camera never hops
    let need = 0;
    for (let i = 0; i <= 4; i++) { const t = (dur * i) / 4, C = pos(t), y0 = C[1]; D.lift(gnd, C, subj); if (C[1] - y0 > need) need = C[1] - y0; }
    if (need > 0) need += 0.3;
    const out = { subject: subj, dur, frame: f };
    out.cam = (t) => {
      const C = pos(clamp(t, 0, dur)); C[1] += need;
      const o = { x: C[0], y: C[1], z: C[2], yaw: 0, pitch: 0, roll: 0, fov };
      look(o, C, subj);
      if (S) {   // compose: the place on the upper third, the avatar on the lower one (compose's own rule, after the lift)
        const dT = Math.hypot(T[0] - C[0], T[2] - C[2]), dS = Math.hypot(S[0] - C[0], S[2] - C[2]), aT = Math.atan2(T[1] - C[1], dT), aS = Math.atan2(S[1] - C[1], dS);
        o.pitch = (aT + aS) / 2; o.fov = clamp(2 * Math.atan(3 * Math.tan(Math.max(0.05, aT - aS) / 2)), 30 * DEG, 80 * DEG);
      }
      else if (f === 'sun') o.pitch = Math.max(o.pitch, -0.12);
      return o;
    };
    return out;
  };

  // ---------------------------------------------------------------- what the reel takes and gives back (pure on the game)
  D.reelSave = function (g) {
    const p = g.player, q = g.renderer && g.renderer.q;
    return { ticks: g.env ? g.env.ticks : undefined, freeze: g.zenFreezeTime, camMode: g.camMode, hideHud: g.hideHud,
      pos: p ? p.pos.slice() : null, yaw: p && p.yaw, pitch: p && p.pitch, flying: p && p.flying, bob: p && p.bob, bobAmt: p && p.bobAmt,
      scale: q ? q.scale : undefined, pad: g.padLife ? g.padLife.clock : undefined, tram: g.trams ? g.trams.clock : undefined };
  };
  // the clock-driven actors (the pads' visitors, the trams) wound back to `ago` seconds before the reel began
  D.reelRewind = function (g, s, ago) {
    ago = Math.max(0, ago || 0);
    if (g.padLife && s.pad !== undefined) g.padLife.clock = Math.max(0, s.pad - ago);
    if (g.trams && s.tram !== undefined) g.trams.clock = Math.max(0, s.tram - ago);
  };
  D.reelRestore = function (g, s) {
    if (!s) return;
    if (g.env && s.ticks !== undefined) { if (g.env.setTime) g.env.setTime(s.ticks); else g.env.ticks = s.ticks; }
    g.zenFreezeTime = s.freeze; g.camMode = s.camMode; g.hideHud = s.hideHud;
    const p = g.player; if (p && s.pos) { p.pos = s.pos.slice(); p.yaw = s.yaw; p.pitch = s.pitch; p.flying = s.flying; p.bob = s.bob; p.bobAmt = s.bobAmt; if (p.vel) p.vel = [0, 0, 0]; }
    const q = g.renderer && g.renderer.q; if (q && s.scale !== undefined) q.scale = s.scale;
    if (g.padLife && s.pad !== undefined) g.padLife.clock = s.pad;
    if (g.trams && s.tram !== undefined) g.trams.clock = s.tram;
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

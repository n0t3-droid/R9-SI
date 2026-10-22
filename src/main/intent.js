// ============================================================================
// Reisen per Absicht (e-ctx; docs/superpowers/specs/2026-10-22-erlebnis-design.md §2, plan docs/superpowers/plans/
// 2026-10-22-e-ctx.md §2.2): point at a landmark, a village, a wonder, a waypoint (or whatever a sibling registers) and
// press V — the game takes you there, and the trip looks like a film.
//   Targets: the Heartland's landmarks (eventlog.js's table; the vistas' landmarks from the worker's `vistas` job),
//   villages, the wonders that stand, waypoints, Intent.addSource(fn) (quests, beacons, bodies, stations — later fronts).
//   Aim: the view ray within 3° of a target's silhouette centre (a tall one: an ellipse of 0.9 × its angular size, ≤ 8°)
//   — the crosshair glides toward it and its label shows („Turmzitadelle · 1,2 km"); ctx.js row 5 offers the trip.
//   Means: walk under 150 m (VR.Folk.findPath — the road bonus keeps it on the land's paths — or straight, with step-ups);
//   150 m – 8 km: call a ship (the one you flew last, the nearest parked one, the village pilot's shuttle; in Kreativ / Zen
//   your own shuttle flies in) to a pad 12–30 m away, board it, and the autopilot (flight.js startAuto, the target as its
//   site) flies; in a ship: the autopilot at once; another world: a registered handler (Intent.spaceHandler) or a hint.
//   Phases: call → board → takeoff → cruise → approach → land → arrive (3 s) → done; walk → arrive → done.
//   Any movement or flight key takes over at once (the mouse only looks), with a 0.4-s blend back to your own view.
//   The travel shots are directorcam.js's; the trip's events go into VR.EventLog (kind travel).
// Pure (tested in node, test/intent.js): meansFor · aimAt · firstPhase / phaseOf · cancelState / wantsControl · blend ·
// arrival / arrivalAt · pickPad · followState / follow / stickFor · collect.
// Game side: start(g, target) · cancel(g, why) · current() · pre / post (around the player's update) · tick · cam (on
// foot) · shipCam (flight.js's camera) · ui (the marker) · flyTargets (G's list) — one marked hook line each.
// Cost 🟢 on every preset: the targets at 1 Hz (≤ 64), the aim at 10 Hz, the called ship one pose a frame and its plumes;
// no draw call of its own (the marker, the bar and the letterbox are DOM, written on change).
// ============================================================================
(function (VR) {
  'use strict';
  const I = VR.Intent = VR.Intent || {};
  const DEG = Math.PI / 180, TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const wrapA = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
  const smooth = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  const smoother = (u) => { u = clamp(u, 0, 1); return u * u * u * (u * (u * 6 - 15) + 10); };
  I.WALK_MAX = 150; I.CALL_MAX = 8000; I.WALK_FAR = 1500; I.NEAR_MIN = 20; I.BLEND = 0.4; I.ARRIVE = 3; I.WALK_ARRIVE = 1.2;
  I.HORIZON = 400; I.SNAP = 3 * DEG; I.SNAP_MAX = 8 * DEG;
  I.PHASES = ['call', 'board', 'walk', 'takeoff', 'cruise', 'approach', 'land', 'arrive', 'done'];
  const PI_ = (ph) => I.PHASES.indexOf(ph);

  // ================================================================ the means (pure)
  // o: {dist, inShip, sameWorld, ship (a ship can come), spaceOk (a handler for other worlds)} → {means, why}
  I.meansFor = function (o) {
    if (!o.sameWorld) return o.spaceOk ? { means: 'space', why: null } : { means: null, why: 'other' };
    if (o.dist > I.CALL_MAX) return { means: null, why: 'far' };
    if (o.inShip) return { means: 'fly', why: null };
    if (o.dist < I.WALK_MAX) return { means: 'walk', why: null };
    if (o.ship) return { means: 'call', why: null };
    if (o.dist <= I.WALK_FAR) return { means: 'walk', why: null };
    return { means: null, why: 'noShip' };
  };

  // ================================================================ the aim (pure)
  // targets [{pos (the silhouette's centre), base, top, r}], the eye and the view's unit direction → {target, dist, e}
  // (e: how far off, 0 = dead centre, 1 = the edge of what snaps) or null
  I.aimAt = function (targets, eye, dir, opts) {
    const minD = (opts && opts.min) || I.NEAR_MIN, maxD = (opts && opts.max) || I.CALL_MAX;
    const vyaw = Math.atan2(-dir[0], -dir[2]), vpitch = Math.asin(clamp(dir[1], -1, 1));
    let best = null, be = Infinity, bd = Infinity, ba = 0;
    for (let i = 0; i < targets.length; i++) {
      const q = targets[i]; if (!q || !q.pos) continue;
      const dx = q.pos[0] - eye[0], dy = q.pos[1] - eye[1], dz = q.pos[2] - eye[2], dh = Math.hypot(dx, dz);
      if (dh < minD || dh > maxD || dh < (q.r || 0)) continue;
      const halfH = Math.max(1, ((q.top || q.pos[1] + 2) - (q.base || q.pos[1] - 2)) / 2), halfW = Math.min(q.r || 2, 2 * halfH);
      const ha = clamp(0.9 * Math.atan(halfW / dh), I.SNAP, I.SNAP_MAX), va = clamp(0.9 * Math.atan(halfH / dh), I.SNAP, I.SNAP_MAX);
      const tyaw = Math.atan2(-dx, -dz), tpitch = Math.atan2(dy, dh);
      const ey = wrapA(vyaw - tyaw) / ha, ep = (vpitch - tpitch) / va, e = Math.hypot(ey, ep);
      if (e > 1) continue;
      if (e < be - 1e-9 || (Math.abs(e - be) <= 1e-9 && dh < bd)) { be = e; bd = dh; best = q; ba = Math.acos(clamp((dx * dir[0] + dy * dir[1] + dz * dir[2]) / (Math.hypot(dx, dy, dz) || 1), -1, 1)); }
    }
    return best ? { target: best, dist: bd, e: be, ang: ba } : null;
  };

  // ================================================================ the phases (pure, never backwards)
  I.firstPhase = (means) => (means === 'walk' ? 'walk' : means === 'call' ? 'call' : 'takeoff');
  // s: {means, dist, brake, phaseT, shipLanded, boarded, fl: {state, auto, landing, y, cruise}}
  I.phaseOf = function (prev, s) {
    const t = s.phaseT || 0;
    let ph = prev;
    if (ph === 'done') return ph;
    if (ph === 'arrive') return t >= (s.means === 'walk' ? I.WALK_ARRIVE : I.ARRIVE) ? 'done' : ph;
    if (ph === 'walk') return s.dist !== undefined && s.dist <= (s.reach || 3) ? 'arrive' : ph;
    if (ph === 'call') return s.shipLanded ? 'board' : ph;
    if (ph === 'board') return s.boarded ? 'takeoff' : ph;
    const fl = s.fl; if (!fl) return ph;
    if (fl.state === 'landed' && !fl.auto) return PI_(ph) >= PI_('takeoff') ? 'arrive' : ph;
    const apD = Math.max(260, (s.brake || 0) * 1.4);
    let next = ph;
    if (ph === 'takeoff' && ((fl.y !== undefined && fl.cruise !== undefined && fl.y >= fl.cruise - 15) || t >= 9 || (s.dist !== undefined && s.dist < apD))) next = 'cruise';
    if ((next === 'cruise') && s.dist !== undefined && s.dist < apD) next = 'approach';
    if ((next === 'cruise' || next === 'approach') && (fl.landing || fl.state === 'landing' || (next === 'approach' && s.dist !== undefined && s.dist < 25))) next = 'land';
    return PI_(next) > PI_(ph) ? next : ph;
  };

  // ================================================================ taking over (pure over an input-like object)
  const MOVE = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyV'];
  const FLY = ['KeyX', 'KeyB', 'KeyG'];
  I.MOVE = MOVE; I.FLY = FLY;
  const stickMag = (m) => (m ? Math.max(Math.abs(m.fwd || 0), Math.abs(m.str || 0)) : 0);
  I.cancelState = function (input) {
    const held = new Set();
    if (input) for (const k of MOVE.concat(FLY)) if (input.down(k)) held.add(k);
    const m = Math.max(stickMag(input && input.padMove), stickMag(input && input.touchMove));
    return { held, armed: m < 0.15 };
  };
  // a key pressed after the trip began (one held from before counts once it was let go), a stick pushed after it came
  // back to the middle, the wheel in a ship; the mouse never. → what took over (the key's name, 'stick', 'wheel') or false
  I.wantsControl = function (input, st, inShip) {
    if (!input) return false;
    const names = inShip ? MOVE.concat(FLY) : MOVE;
    for (let i = 0; i < names.length; i++) {
      const k = names[i], down = input.down(k);
      if (st.held.has(k)) { if (!down) st.held.delete(k); else if (!input.hit(k)) continue; }
      if (input.hit(k) || down) return k;
    }
    const m = Math.max(stickMag(input.padMove), stickMag(input.touchMove));
    if (m < 0.15) st.armed = true;
    else if (m > 0.35 && st.armed) return 'stick';
    if (inShip && input.mouse && input.mouse.wheel) return 'wheel';
    return false;
  };

  // ================================================================ the blend back (pure; writes out)
  I.blend = function (a, b, u, out) {
    out = out || {};
    const dy = wrapA(b.yaw - a.yaw);
    out.x = a.x + (b.x - a.x) * u; out.y = a.y + (b.y - a.y) * u; out.z = a.z + (b.z - a.z) * u;
    out.yaw = b.yaw - dy * (1 - u); out.pitch = a.pitch + (b.pitch - a.pitch) * u;
    out.roll = (a.roll || 0) + ((b.roll || 0) - (a.roll || 0)) * u;
    out.fov = (a.fov || b.fov) + ((b.fov || a.fov) - (a.fov || b.fov)) * u;
    return out;
  };

  // ================================================================ the called ship's way in (pure)
  // from {pos, yaw, parked}, the pad [x, y, z] (the ship's origin on the ground), opts {ground(x, z) → y | null, faceYaw,
  // size} → a path: lift (parked: 2.5 s, 12 m up), the cruise arc (≥ 30 m over the highest ground under the way, ≥ 40 m
  // over the pad; from 400 m out when it was farther — it comes in over the horizon), a hover over the pad turning to
  // face the target, a vertical settle with a flare (4 s); 10–30 s in all
  I.arrival = function (from, spot, opts) {
    opts = opts || {};
    const ground = opts.ground || (() => null);
    let s0 = from.pos.slice(), parked = !!from.parked, dx = s0[0] - spot[0], dz = s0[2] - spot[2], d = Math.hypot(dx, dz);
    if (d > I.HORIZON) { const k = I.HORIZON / d; dx *= k; dz *= k; d = I.HORIZON; s0 = [spot[0] + dx, NaN, spot[2] + dz]; parked = false; }
    // the floor along the way: the highest ground near each 12-m step (± one step), for the rise and the descent
    const n = Math.max(2, Math.ceil(d / 12)), raw = [], floor = [];
    let top = spot[1];
    let unknown = 0;
    for (let i = 0; i <= n; i++) { const u = i / n, gy = ground(spot[0] + dx * u, spot[2] + dz * u); raw.push(gy === null || gy === undefined ? -1e9 : gy); if (gy === null || gy === undefined) unknown++; else if (gy > top) top = gy; }
    if (unknown > n * 0.3) top = Math.max(top, spot[1] + 70);   // (a way over land not loaded yet: it could rise — come in high)
    for (let i = 0; i <= n; i++) floor.push(Math.max(raw[Math.max(0, i - 1)], raw[i], raw[Math.min(n, i + 1)]));
    const H = Math.max(top + 30, spot[1] + 40);
    if (!Number.isFinite(s0[1])) s0[1] = H;
    const lift = parked ? 2.5 : 0, liftY = parked ? s0[1] + 12 : s0[1];
    const v = clamp(d / 12, 25, 60), cruise = Math.max(4, d / v);
    const travelYaw = d > 0.5 ? Math.atan2(-(spot[0] - s0[0]), -(spot[2] - s0[2])) : (from.yaw || 0);
    const face = opts.faceYaw !== undefined ? opts.faceYaw : travelYaw;
    const hover = 1.5 + 1.5 * Math.abs(wrapA(face - travelYaw)) / Math.PI;   // (a half turn: 3 s)
    return { start: s0, spot: spot.slice(), H, hoverY: spot[1] + 22, lift, liftY, cruise, hover, settle: 4, dur: lift + cruise + hover + 4, face, yaw0: from.yaw || 0, travelYaw, d, n, floor, parked, vx: -dx, vz: -dz };
  };
  // the pose at t: {pos, yaw, pitch, roll, gear, speed, stage} (writes out)
  function poseAt(P, t, out) {
    const s0 = P.start, sp = P.spot, o = out;
    o.pos = o.pos || [0, 0, 0];
    let x, y, z, yaw, gear = 0, stage;
    if (t < P.lift) {
      const u = t / P.lift; x = s0[0]; z = s0[2]; y = s0[1] + (P.liftY - s0[1]) * smooth(u); yaw = P.yaw0; stage = 'lift';
      gear = 1 - smooth((y - s0[1] - 5) / 5);
    } else if (t < P.lift + P.cruise) {
      const tau = (t - P.lift) / P.cruise, h = smoother(tau);
      x = s0[0] + P.vx * h; z = s0[2] + P.vz * h;
      // the profile: rise to H over the first 35 %, hold, sink to the hover height over the last 30 %
      y = tau < 0.35 ? P.liftY + (P.H - P.liftY) * smooth(tau / 0.35) : tau < 0.7 ? P.H : P.H + (P.hoverY - P.H) * smooth((tau - 0.7) / 0.3);
      // never lower than 12 m over the ground under it (away from the start and the pad)
      const fi = h * P.n, i0 = Math.floor(fi), f = fi - i0, fl = P.floor[Math.min(P.n, i0)] * (1 - f) + P.floor[Math.min(P.n, i0 + 1)] * f;
      const dPad = Math.hypot(x - sp[0], z - sp[2]), dStart = Math.hypot(x - s0[0], z - s0[2]);
      if (dPad > 30 && dStart > 30 && y < fl + 12) y = fl + 12;
      // turn from the parked heading to the way in the first 2 s, toward the landing heading over the last 15 %
      const turnIn = smooth((t - P.lift) / 2), turnOut = smooth((tau - 0.85) / 0.15);
      yaw = P.yaw0 + wrapA(P.travelYaw - P.yaw0) * turnIn;
      if (turnOut > 0) yaw = yaw + wrapA(P.face - yaw) * turnOut * 0.5;
      stage = 'cruise';
    } else if (t < P.lift + P.cruise + P.hover) {
      const u = (t - P.lift - P.cruise) / P.hover, y0 = P.travelYaw + wrapA(P.face - P.travelYaw) * 0.5;
      x = sp[0]; z = sp[2]; y = P.hoverY; yaw = y0 + wrapA(P.face - y0) * smooth(u); stage = 'hover';
      gear = smooth(u);
    } else if (t < P.dur) {
      const u = (t - P.lift - P.cruise - P.hover) / P.settle;
      x = sp[0]; z = sp[2]; y = sp[1] + (P.hoverY - sp[1]) * (1 - smooth(u)); yaw = P.face; gear = 1; stage = 'settle';
    } else { x = sp[0]; y = sp[1]; z = sp[2]; yaw = P.face; gear = 1; stage = 'down'; }
    o.pos[0] = x; o.pos[1] = y; o.pos[2] = z; o.yaw = yaw; o.gear = gear; o.stage = stage;
    return o;
  }
  const PA = { pos: [0, 0, 0] }, PB = { pos: [0, 0, 0] }, PC = { pos: [0, 0, 0] };
  I.arrivalAt = function (P, t, out) {
    out = out || {};
    const h = 0.05, ta = Math.max(0, t - h), tb = Math.min(P.dur, t + h);
    poseAt(P, t, out); poseAt(P, ta, PA); poseAt(P, tb, PB);
    const dt = Math.max(1e-6, tb - ta), vx = (PB.pos[0] - PA.pos[0]) / dt, vy = (PB.pos[1] - PA.pos[1]) / dt, vz = (PB.pos[2] - PA.pos[2]) / dt;
    out.speed = t >= P.dur ? 0 : Math.hypot(vx, vy, vz);
    out.vel = [vx, vy, vz];
    // bank into the turn, the nose follows the climb and the braking (as flight.js does)
    const yr = wrapA(PB.yaw - PA.yaw) / dt;
    poseAt(P, Math.max(0, t - 2 * h), PC);
    const v0 = Math.hypot(PA.pos[0] - PC.pos[0], PA.pos[2] - PC.pos[2]) / h, v1 = Math.hypot(vx, vz), acc = (v1 - v0) / h;
    out.roll = t >= P.dur ? 0 : clamp(yr * 0.4, -0.5, 0.5) * clamp(v1 / 20, 0.2, 1);
    out.pitch = t >= P.dur ? 0 : clamp(vy / 14 * 0.12 - acc * 0.006, -0.18, 0.18);
    return out;
  };

  // ================================================================ the pad (pure)
  // ground(x, z) → the top solid block's y, −1 (water, leaves, a roof …), null (not loaded); player [x, y, z]; opts
  // {toward: [x, z], ext: [hx, hz]} → [x, y, z] (the ship's origin on the ground) or null
  I.pickPad = function (ground, player, opts) {
    opts = opts || {};
    const ext = opts.ext || [5, 8], half = Math.ceil(Math.max(ext[0], ext[1])) + 1, px = player[0], pz = player[2];
    const tw = opts.toward ? Math.atan2(opts.toward[0] - px, opts.toward[1] - pz) : 0;
    let best = null, bs = Infinity;
    for (const r of [16, 19, 22, 25, 28, Math.max(13, half + 4)]) {
      for (let k = 0; k < 16; k++) {
        const a = tw + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (TAU / 16);
        const cx = Math.round(px + Math.sin(a) * r), cz = Math.round(pz + Math.cos(a) * r);
        let mn = Infinity, mx = -Infinity, bad = false;
        for (let dz = -half; dz <= half && !bad; dz += 2) for (let dx = -half; dx <= half; dx += 2) {
          const y = ground(cx + dx, cz + dz);
          if (y === null || y === undefined || y < 0) { bad = true; break; }
          if (y < mn) mn = y; if (y > mx) mx = y;
        }
        if (bad || mx - mn > 1) continue;
        const sc = Math.abs(r - 20) * 0.4 + Math.abs(wrapA(a - tw)) * 8 + (mx - mn) * 3;
        if (sc < bs) { bs = sc; best = [cx + 0.5, mx + 1, cz + 0.5]; }
      }
    }
    return best;
  };

  // ================================================================ the walk (pure)
  I.followState = () => ({ i: 0 });
  // path [[x, z] …], pos [x, z] → the point 2.5 m ahead on the path {tx, tz, done}
  I.follow = function (path, pos, st, look) {
    look = look || 2.5;
    const n = path.length; if (!n) return { tx: pos[0], tz: pos[1], done: true };
    const L = path[n - 1];
    if (Math.hypot(L[0] - pos[0], L[1] - pos[1]) < 1.0) return { tx: L[0], tz: L[1], done: true };
    let i = Math.min(st.i, n - 1), u = 0;
    for (; i < n - 1; i++) {
      const a = path[i], b = path[i + 1], ex = b[0] - a[0], ez = b[1] - a[1], l2 = ex * ex + ez * ez || 1e-9;
      u = ((pos[0] - a[0]) * ex + (pos[1] - a[1]) * ez) / l2;
      if (u < 1) break;
    }
    st.i = Math.min(i, n - 1);
    if (st.i >= n - 1) return { tx: L[0], tz: L[1], done: false };
    // walk `look` metres on from the foot point
    let a = path[st.i], b = path[st.i + 1], seg = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-9, s = clamp(u, 0, 1) * seg + look, j = st.i;
    while (s > seg && j < n - 2) { s -= seg; j++; a = path[j]; b = path[j + 1]; seg = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-9; }
    const k = Math.min(1, s / seg);
    return { tx: a[0] + (b[0] - a[0]) * k, tz: a[1] + (b[1] - a[1]) * k, done: false };
  };
  // the stick that walks the player along dir [dx, dz] whatever way they look (player.js: wx = −sin·fw + cos·st …)
  I.stickFor = function (yaw, dir) {
    const L = Math.hypot(dir[0], dir[1]) || 1, dx = dir[0] / L, dz = dir[1] / L, sy = Math.sin(yaw), cy = Math.cos(yaw);
    return { fwd: -(dx * sy + dz * cy), str: dx * cy - dz * sy };
  };

  // ================================================================ the targets
  // the Heartland's landmarks: id, x, z, base, top, r (eventlog.js keeps the same table for its samples)
  const HEART = [['temple', 0, -15, 80, 167, 52], ['citadel', -420, 380, 112, 249, 30], ['isles', 330, 140, 130, 175, 110], ['nova', 0, -140, 80, 100, 95], ['station', -380, -150, 150, 230, 30], ['hills', 0, -322, 90, 125, 150]];
  const NAMES = { temple: ['Der Tor-Tempel', 'The Gate Temple'], citadel: ['Die Turmzitadelle', 'The Spire Citadel'], isles: ['Die Himmelsinseln', 'The Sky Isles'], lighthouse: ['Der Leuchtturm am fernen Ufer', 'The Lighthouse on the Far Shore'], falls: ['Der Wasserfall', 'The Waterfall'], nova: ['Nova Haven', 'Nova Haven'], station: ['Die Bergstation', 'The Mountain Station'], lookout: ['Der Aussichtsturm auf dem Grat', 'The Lookout on the Ridge'], hills: ['Die Kuppelhügel', 'The Pod Hills'] };
  const tx = (key, vars, de, en) => (VR.I18N && VR.I18N.tx ? VR.I18N.tx(key, vars || null, de, en) : de);
  const lmName = (id) => { const n = NAMES[id]; return n ? tx('g.wow.' + id, null, n[0], n[1]) : id; };
  I.sources = [];
  I.addSource = (fn) => { if (typeof fn === 'function' && I.sources.indexOf(fn) < 0) I.sources.push(fn); };
  I.vistaLm = [];   // the vistas' landmarks of this world (the worker's job, once)
  I.collect = function (g) {
    const out = [], dim = (g && g.dim) || 'overworld', m = g && g.meta;
    const heart = !!(m && (m.vgen | 0) >= 3 && m.type !== 'flat') && dim === 'overworld';
    if (heart) {
      const tab = (VR.EventLog && VR.EventLog.HEART_LM) || HEART;
      for (const q of tab) out.push({ kind: 'landmark', id: q[0], name: lmName(q[0]), toKey: 'g.ctx.to.' + q[0], pos: [q[1], (q[3] + q[4]) / 2, q[2]], base: q[3], top: q[4], r: q[5], dim });
      for (const q of I.vistaLm) if (!out.some(o => o.id === q.id)) out.push({ kind: 'landmark', id: q.id, name: lmName(q.id), toKey: NAMES[q.id] ? 'g.ctx.to.' + q.id : 'g.ctx.toThing', pos: [q.x, q.top - 12, q.z], base: q.top - 24, top: q.top, r: 6, dim });
    }
    const V = g && g.villages;
    if (V && V.list) { let L = null; try { L = V.list(); } catch (e) { L = null; } if (L) for (const v of L) { if (!v) continue; const y = v.y || 70; out.push({ kind: 'village', id: v.id, name: v.name || '', toKey: 'g.ctx.toPlace', pos: [v.x, y + 10, v.z], base: y, top: y + 20, r: v.rad || 40, dim, site: v }); } }
    const W = g && g.wonders;
    if (W && W.sites && W.st) for (const s of W.sites) { const e = W.st[s.key]; if (!e || (e.status !== 'built' && e.status !== 'found')) continue; const y = s.y || 70; let nm = s.type; try { nm = W.name(s.type); } catch (er) { nm = s.type; } out.push({ kind: 'wonder', id: s.key, name: nm, toKey: 'g.ctx.toWonder', pos: [s.x, y + 18, s.z], base: y, top: y + 36, r: 14, dim }); }
    const WP = g && g.gadgets && g.gadgets.waypoints;
    if (WP) WP.forEach((w, i) => { if (!w) return; out.push({ kind: 'waypoint', id: 'wp' + i, name: w.name || tx('g.int.wp', { n: i + 1 }, 'Wegpunkt ' + (i + 1), 'Waypoint ' + (i + 1)), toKey: 'g.ctx.toWp', pos: [w.x + 0.5, w.y + 1.5, w.z + 0.5], base: w.y, top: w.y + 3, r: 1, dim }); });
    for (const f of I.sources) { let L = null; try { L = f(g); } catch (e) { L = null; } if (L) for (const q of L) if (q && q.pos) out.push(Object.assign({ toKey: 'g.ctx.toThing', r: 2, base: q.pos[1] - 2, top: q.pos[1] + 2, dim }, q)); }
    return out.length > 64 ? out.slice(0, 64) : out;
  };

  // ================================================================================ the game side
  I.cost = { frames: 0, ms: 0, worst: 0 };
  I.on = true;
  I.targets = []; I.aimed = null; I.cur = null; I.spaceHandler = null;
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  let tAcc = 1, aAcc = 0, world = undefined, vistaAsked = null, ownRef = null, lastPilot = null;
  I.current = () => (I.cur && !I.cur.ending ? I.cur : null);
  const say = (g, key, vars, de, en, ms) => { if (g.ui && g.ui.hint) g.ui.hint(tx(key, vars, de, en), ms || 2600); };
  const lang = () => (VR.I18N && VR.I18N.lang === 'en' ? 'en' : 'de');
  const toPhrase = (t) => tx(t.toKey || 'g.ctx.toThing', { name: t.name }, (VR.Ctx && VR.Ctx.LABELS[t.toKey] ? VR.Ctx.LABELS[t.toKey][0] : 'zu {name}').replace('{name}', t.name), (VR.Ctx && VR.Ctx.LABELS[t.toKey] ? VR.Ctx.LABELS[t.toKey][1] : 'to {name}').replace('{name}', t.name));
  const distTxt = (m) => (VR.Ctx ? VR.Ctx.dist(m) : Math.round(m) + ' m');
  // the ground a pad may stand on: the top block of a loaded column — water, lava, leaves, wood, glass, roofs, crops: no
  const BAD = /leaves|log|wood|vx_|glass|fence|door|wheat|carrot|potato|beet|farmland|planks|bed|lamp|torch|chest|landing_pad|hazard|crystal|ice$|slab|stairs|wall/;
  function groundFn(g) {
    const w = g.world, Rg = VR.R, F = VR.F;
    return (x, z) => {
      x = Math.floor(x); z = Math.floor(z);
      const c = w && w.col(x >> 4, z >> 4); if (!c || !c.ready) return null;
      let y = c.height[((z & 15) << 4) | (x & 15)];
      for (let k = 0; k < 3 && y > 1; k++) { const b = w.getBlock(x, y, z); if (b && (Rg.T.flags[b] & F.SOLID)) break; y--; }
      const b = w.getBlock(x, y, z);
      if (!b || (Rg.T.flags[b] & (F.WATER | F.LAVA))) return -1;
      const t = Rg.types[Rg.T.type[b]]; if (t && BAD.test(t.name)) return -1;
      if (w.getBlock(x, y + 1, z) && (Rg.T.flags[w.getBlock(x, y + 1, z)] & F.SOLID)) return -1;
      return y;
    };
  }
  // the terrain's height for the cruise (the column's top, any block)
  const topFn = (g) => (x, z) => { const w = g.world, c = w && w.col(Math.floor(x) >> 4, Math.floor(z) >> 4); return c && c.ready ? c.height[((Math.floor(z) & 15) << 4) | (Math.floor(x) & 15)] : null; };

  // ---------------------------------------------------------------- the ship that comes
  const shipOk = (S, s) => s && s.d && s.d.meta && !s.hidden && !s.hangar && s !== S.pilot && s.state === 'parked' && !s.ectxBusy;
  function pickShip(g, target) {
    const S = g.starships, p = g.player; if (!S || !p) return null;
    const own = ownRef && S.ships.indexOf(ownRef) >= 0 ? ownRef : null;
    if (own && shipOk(S, own) && Math.hypot(own.pos[0] - p.pos[0], own.pos[2] - p.pos[2]) <= I.CALL_MAX) return own;
    const m = g.meta && g.meta.ectx;
    if (m && m.seed !== undefined) { const s = S.ships.find(q => q.d && q.d.seed === m.seed && shipOk(S, q)); if (s) { ownRef = s; return s; } }
    let best = null, bd = 3000;
    for (const s of S.ships) { if (!shipOk(S, s)) continue; const d = Math.hypot(s.pos[0] - p.pos[0], s.pos[2] - p.pos[2]); if (d < bd) { bd = d; best = s; } }
    void target;
    return best;
  }
  const canConjure = (g) => !!(g.starships && g.player && (g.player.creative || g.player.mode === 'zen') && !(g.meta && g.meta.guest) && !(g.mp && g.mp.isClient));
  function conjure(g, target, again) {
    const S = g.starships, p = g.player;
    let h = 2166136261; for (const ch of String((g.meta && g.meta.seed) || 0) + ':ectx' + (again ? ':' + again : '')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
    const pal = VR.Starship && VR.Starship.PAL && VR.Starship.PAL.find(q => q.key === 'starforge') ? 'starforge' : null;
    // it comes from beyond the target's side, over the horizon, toward you
    const dx = target.pos[0] - p.pos[0], dz = target.pos[2] - p.pos[2], L = Math.hypot(dx, dz) || 1;
    const pos = [p.pos[0] + dx / L * (I.HORIZON + 30), Math.max(p.pos[1] + 50, 130), p.pos[2] + dz / L * (I.HORIZON + 30)];
    const s = S.spawn(h, 'shuttle', pal, pos, Math.atan2(dx, dz));
    s.state = 'flying'; s.gear = 0; s.ectxBusy = true;
    ownRef = s;
    return s;
  }
  // a conjured shuttle whose design never came goes again (and its design with it, so a later call asks anew)
  function dropShip(g, s) {
    const S = g.starships; if (!S || !s) return;
    const i = S.ships.indexOf(s); if (i >= 0) S.ships.splice(i, 1);
    if (s.d && !s.d.meta && S.designs && S.designs.get(s.d.key) === s.d && !S.ships.some(q => q.d === s.d)) S.designs.delete(s.d.key);
    if (ownRef === s) ownRef = null;
  }
  function remember(g, s) {
    ownRef = s;
    if (g.meta && !g.meta.guest && s && s.d) g.meta.ectx = { seed: s.d.seed, arch: s.d.meta ? s.d.meta.arch : null };
  }
  const siteOf = (t, g) => {
    const y = t.kind === 'village' && t.site ? t.site.y : t.base !== undefined ? t.base : t.pos[1] - 10;
    return { id: 'ectx:' + t.kind + ':' + t.id, name: t.name, x: Math.floor(t.pos[0]), z: Math.floor(t.pos[2]), y: Math.max(1, Math.floor(y)), rad: Math.round((t.r || 8) + 12), ectx: true };
  };
  // G's list in a ship (flight.js autoTargets): every target but the villages it lists itself
  I.flyTargets = function (g, pos) {
    const out = [];
    for (const t of I.targets) { if (t.kind === 'village') continue; if (Math.hypot(t.pos[0] - pos[0], t.pos[2] - pos[2]) <= 140) continue; out.push(siteOf(t, g)); }
    return out;
  };

  // ---------------------------------------------------------------- start, cancel
  I.start = function (g, target) {
    if (!I.on || !g || !g.player || !target || !target.pos) return false;
    if (I.cur) end(g, 'restart', true);
    const p = g.player, dist = Math.hypot(target.pos[0] - p.pos[0], target.pos[2] - p.pos[2]);
    const S = g.starships, inShip = !!(S && S.pilot && g.flight);
    const sameWorld = !target.dim || target.dim === (g.dim || 'overworld');
    const guest = !!(g.meta && g.meta.guest) || !!(g.mp && g.mp.isClient);
    const ship = inShip || guest ? null : pickShip(g, target);
    const m = I.meansFor({ dist, inShip, sameWorld, ship: !!ship || canConjure(g), spaceOk: !!I.spaceHandler });
    if (!m.means) {
      if (m.why === 'noShip') say(g, 'g.int.noShip', { to: toPhrase(target) }, 'Kein Schiff in Reichweite — {to} ist zu Fuß zu weit', 'No ship within reach — {to} is too far to walk');
      else if (m.why === 'other') say(g, 'g.int.other', null, 'Reisen zu anderen Welten kommen bald', 'Trips to other worlds are coming soon');
      else say(g, 'g.int.far', null, 'Zu weit für eine Reise von hier', 'Too far to travel from here');
      return false;
    }
    if (m.means === 'space') return !!I.spaceHandler(g, target);
    const D = VR.DirCam;
    const c = I.cur = { target, means: m.means, phase: I.firstPhase(m.means), t: 0, phaseT: 0, cs: I.cancelState(g.input), look: D ? D.lookState() : null, seq: D ? D.seqState() : null, dist, startDist: dist, camMode: g.camMode, ending: null, lastCam: null };
    if (VR.EventLog) VR.EventLog.emit('travel', 'intent_' + m.means, 1, null, 'intent');
    if (m.means === 'walk') startWalk(g, c);
    else if (m.means === 'call') startCall(g, c, ship);
    else if (m.means === 'fly') { c.fl = g.flight; c.ship = S.pilot; c.boarded = true; c.site = siteOf(target, g); c.fl.startAuto(c.site); c.fl0y = c.fl.b.pos[1]; }
    chrome(g, true);
    return true;
  };
  function startWalk(g, c) {
    const p = g.player, t = c.target, F = VR.Folk;
    const dx = t.pos[0] - p.pos[0], dz = t.pos[2] - p.pos[2], L = Math.hypot(dx, dz) || 1;
    const stop = Math.max(2, Math.min(L - 2, (t.r || 2) * 0.5));                    // (a big target: walk to its edge)
    const gx = Math.floor(p.pos[0] + dx / L * (L - stop)), gz = Math.floor(p.pos[2] + dz / L * (L - stop));
    const top = topFn(g)(gx, gz), gy = top !== null ? top + 1 : Math.floor(p.pos[1]);
    let path = null;
    if (F && F.findPath && g.world) { try { const r = F.findPath(g.world, [Math.floor(p.pos[0]), Math.floor(p.pos[1] + 0.1), Math.floor(p.pos[2])], [gx, gy, gz], { near: 2, partial: true, max: 5000 }); if (r && r.path && r.path.length > 1) path = r.path.map(q => [q[0] + 0.5, q[2] + 0.5]); c.pathComplete = !!(r && r.complete); } catch (e) { path = null; } }
    if (!path) path = [[p.pos[0], p.pos[2]], [gx + 0.5, gz + 0.5]];
    else if (!c.pathComplete) path.push([gx + 0.5, gz + 0.5]);                    // (the rest straight, with step-ups)
    c.path = path; c.fst = I.followState(); c.goal = [gx + 0.5, gy, gz + 0.5]; c.prog = { d: Infinity, t: 0 }; c.jumpT = 0; c.repaths = 0;
    g.camMode = 1;
    say(g, 'g.int.walkTo', { to: toPhrase(t) }, 'Unterwegs {to}', 'On the way {to}', 2200);
  }
  function startCall(g, c, ship) {
    const p = g.player, S = g.starships;
    c.ship = ship || conjure(g, c.target);
    c.ship.ectxBusy = true; c.conjured = !ship;
    if (ship && ship.d && ship.d.meta) say(g, 'g.int.coming', { name: ship.d.meta.name }, 'Dein Schiff kommt: {name}', 'Your ship is coming: {name}', 3000);
    else say(g, 'g.int.coming', { name: tx('g.int.myShuttle', null, 'Dein Shuttle', 'Your shuttle') }, 'Dein Schiff kommt: {name}', 'Your ship is coming: {name}', 3000);
    c.arr = null; c.arrT = 0; c.shipLanded = false; c.boardT = 0;
    g.camMode = 1;
    // a ship standing by you already: no flight in
    if (ship && Math.hypot(ship.pos[0] - p.pos[0], ship.pos[2] - p.pos[2]) <= 30) { c.shipLanded = true; c.noFlight = true; }
    void S;
  }
  // the path of the called ship, once its design is there (its size picks the pad)
  function planArrival(g, c) {
    const s = c.ship, md = s.d && s.d.meta; if (!md || !s.d.cells) return false;
    const p = g.player, B = md.bounds, ext = [Math.max(Math.abs(B[0]), Math.abs(B[3])), Math.max(Math.abs(B[2]), Math.abs(B[5]))];
    const pad = I.pickPad(groundFn(g), p.pos, { toward: [c.target.pos[0], c.target.pos[2]], ext });
    if (!pad) return false;
    const face = Math.atan2(-(c.target.pos[0] - pad[0]), -(c.target.pos[2] - pad[2]));
    c.arr = I.arrival({ pos: s.pos.slice(), yaw: s.yaw, parked: s.state === 'parked' }, pad, { ground: topFn(g), faceYaw: face, size: Math.max(md.length, md.width) * 0.5 });
    c.arrT = 0; c.pad = pad;
    s.state = 'flying';   // (in the air: no solid proxy, nobody else moves it)
    if (g.starships.refreshNear) g.starships.refreshNear(true);
    return true;
  }
  const AP = { pos: [0, 0, 0] };
  function flyShip(g, c, dt) {
    const s = c.ship, P = c.arr; if (!s || !P) return;
    c.arrT = Math.min(P.dur, c.arrT + dt);
    I.arrivalAt(P, c.arrT, AP);
    s.pos[0] = AP.pos[0]; s.pos[1] = AP.pos[1]; s.pos[2] = AP.pos[2]; s.yaw = AP.yaw; s.pitch = AP.pitch; s.roll = AP.roll; s.gear = AP.gear; s.vel = AP.vel || [0, 0, 0];
    if (g.starships.rotOf) g.starships.rotOf(s);
    c.shipStage = AP.stage; c.shipSpeed = AP.speed;
    // the plumes (and the dust under it near the ground)
    const md = s.d.meta, TR = g.trails;
    if (TR && md && md.exhaust) for (let i = 0; i < md.exhaust.length; i++) { const e = md.exhaust[i]; TR.engine('ectx' + s.id + ':' + i, s.toWorld([e[0], e[1], e[2] + 0.3]), AP.speed, { thrust: AP.stage === 'cruise' ? 1 : 0.6, size: e[3] || 0.5, col: AP.speed > 25 ? [0.52, 0.92, 1] : [1, 0.6, 0.28], minor: i > 1 }); }
    const h = s.pos[1] - P.spot[1];
    if (g.particles && h < 8 && AP.stage !== 'down' && Math.random() < 0.6) { const a = Math.random() * TAU, r = Math.random() * 6; g.particles.spawn(P.spot[0] + Math.cos(a) * r, P.spot[1] + 0.15, P.spot[2] + Math.sin(a) * r, Math.cos(a) * 6, 0.5, Math.sin(a) * 6, { life: 0.9, size: 0.35, grav: -0.3, col: [0.66, 0.6, 0.5], drag: 1.6, grow: 1.1, collide: false }); }
    if (c.arrT >= P.dur) landed(g, c);
  }
  function landed(g, c) {
    const s = c.ship;
    s.state = 'parked'; s.vel = [0, 0, 0]; s.gear = 1; s.pitch = 0; s.roll = 0; s.dip = 0;
    if (g.starships.rotOf) g.starships.rotOf(s);
    if (g.starships.refreshNear) g.starships.refreshNear(true);
    if (g.audio) g.audio.play('thump', { vol: 0.5 });
    c.shipLanded = true;
    if (VR.EventLog) VR.EventLog.emit('travel', 'shipcall', 2, [s.pos[0], s.pos[1] + 3, s.pos[2]], 'intent', 8);
  }
  function board(g, c) {
    const S = g.starships, p = g.player, s = c.ship;
    if (!S || !s) return false;
    if (S.pilot !== s) S.board(s, p);
    if (S.pilot !== s || !s.flight) return false;
    s.ectxBusy = false;
    remember(g, s);
    c.fl = s.flight; c.site = siteOf(c.target, g); c.boarded = true;
    c.fl.startAuto(c.site);
    c.fl0y = s.pos[1];
    if (VR.EventLog) VR.EventLog.emit('travel', 'takeoff', 2, [s.pos[0], s.pos[1] + 3, s.pos[2]], 'intent', 8);
    return true;
  }
  // the trip ends: the camera blends back over 0.4 s (cut: at once), the walk's camera and the HUD come back
  function end(g, why, cut) {
    const c = I.cur; if (!c) return;
    // (how the last trip ended — the session runner and the browser test read it; I.debug adds where from)
    I.lastEnd = { why, by: c.by || null, means: c.means, phase: c.phase, t: Math.round((c.t || 0) * 100) / 100, stack: I.debug ? String(new Error().stack).split('\n').slice(2, 7).join(' | ') : null };
    if (c.injJump && g.input && g.input.tDown) { g.input.tDown.delete('jump'); c.injJump = false; }   // (never leave a jump held)
    if (c.ship && c.ship.ectxBusy && c.arr && !c.shipLanded) { c.ship.ectxDetached = true; detached.push({ c, ship: c.ship }); }   // a called ship on its way still lands
    else if (c.ship) c.ship.ectxBusy = false;
    if (c.fl && c.fl.auto && c.fl.auto.site && c.fl.auto.site.ectx && why !== 'done') c.fl.stopAuto(null);
    if (why === 'input' || why === 'blocked') say(g, 'g.int.cancel', null, 'Du steuerst selbst', 'You have the controls', 1800);
    if (c.means !== 'fly' && c.means !== 'call' || !c.boarded) g.camMode = c.camMode || 0;
    chrome(g, false);
    if (cut || !c.lastCam) { I.cur = null; return; }
    c.ending = { t: 0, from: Object.assign({}, c.lastCam) };
  }
  I.cancel = (g, why) => end(g, why || 'input', false);
  // the save (game.js saveMeta, after the ships wrote their records): a called ship still in the air is written standing on
  // its pad, facing the way — a reload never finds it hanging in the sky
  I.beforeSave = function (g, m) {
    const S = g && g.starships; if (!S || !m || !Array.isArray(m.starships)) return;
    const list = S.ships.filter(s => s.d && s.d.meta);
    const fix = (c) => { if (!c || !c.ship || c.shipLanded || !c.arr) return; const r = m.starships[list.indexOf(c.ship)]; if (!r) return; const P = c.arr; r.pos = [P.spot[0], P.spot[1], P.spot[2]].map(v => Math.round(v * 100) / 100); r.yaw = P.face; };
    fix(I.cur); for (const q of detached) fix(q.c);
  };
  const detached = [];

  // ---------------------------------------------------------------- the frame
  // before the player's update: any key takes over; the walk's stick and look
  I.pre = function (g, dt) {
    const c = I.cur; if (!c || c.ending || !g.player) return;
    const In = g.input, ui = g.ui;
    if (ui && (ui.screen || ui.typing)) return;
    const inShip = !!(g.starships && g.starships.pilot && g.flight);
    const took = c.phase !== 'arrive' && I.wantsControl(In, c.cs, inShip);
    if (took) { c.by = took; end(g, 'input'); return; }
    if (c.phase === 'arrive' && In && (In.pressed.size > 0 || (In.mouse.clicked && In.mouse.clicked.some(Boolean)))) { c.skip = true; return; }   // (any key: the arrival's framing ends)
    if (c.means === 'walk' && c.phase === 'walk' && In) {
      const p = g.player, f = I.follow(c.path, [p.pos[0], p.pos[2]], c.fst);
      c.saved = { pm: In.padMove, dx: In.mouse.dx, dy: In.mouse.dy };
      if (c.look && VR.DirCam) VR.DirCam.look(c.look, In.mouse.dx, In.mouse.dy, dt, In.sensitivity || 0.0024);
      In.mouse.dx = 0; In.mouse.dy = 0;
      if (f.done) { In.padMove = { fwd: 0, str: 0 }; return; }
      const dx = f.tx - p.pos[0], dz = f.tz - p.pos[2], want = Math.atan2(-dx, -dz);
      p.yaw += clamp(wrapA(want - p.yaw), -4 * dt, 4 * dt);
      p.pitch += (-0.08 - p.pitch) * Math.min(1, dt * 3);
      const st = I.stickFor(p.yaw, [dx, dz]);
      In.padMove = { fwd: st.fwd, str: st.str };
      // stuck: jump (the player's own auto-jump takes one-block steps); still stuck: find the way again, then give up
      const d = Math.hypot(c.goal[0] - p.pos[0], c.goal[2] - p.pos[2]);
      if (d < c.prog.d - 0.4) { c.prog.d = d; c.prog.t = 0; } else c.prog.t += dt;
      if (c.prog.t > 0.9 && c.jumpT <= 0) { c.jumpT = 0.3; }
      if (c.jumpT > 0) { c.jumpT -= dt; if (In.tDown) { In.tDown.add('jump'); c.injJump = true; } }
      if (c.prog.t > 4.5) {
        if (c.repaths < 1) { c.repaths++; startWalk(g, c); c.prog.t = 0; }
        else { end(g, 'blocked'); say(g, 'g.int.noWay', null, 'Ich finde keinen Weg dorthin', 'I cannot find a way there', 2600); }
      }
    } else if (In && c.look && VR.DirCam && (c.phase === 'call' || c.phase === 'board')) {
      // on foot while the ship comes: the mouse looks round the shot, the player stands
      VR.DirCam.look(c.look, In.mouse.dx, In.mouse.dy, dt, In.sensitivity || 0.0024);
      c.saved = { pm: In.padMove, dx: In.mouse.dx, dy: In.mouse.dy, still: true };
      In.mouse.dx = 0; In.mouse.dy = 0;
    }
  };
  // after it: the input as the player gave it
  I.post = function (g) {
    const c = I.cur; if (!c || !c.saved) return;
    const In = g.input;
    if (In) { In.padMove = c.saved.pm; In.mouse.dx = c.saved.dx; In.mouse.dy = c.saved.dy; if (c.injJump && In.tDown) { In.tDown.delete('jump'); c.injJump = false; } }
    c.saved = null;
  };
  // the phases, the called ship, the targets (1 Hz), the aim (10 Hz)
  I.tick = function (g, dt) {
    if (!I.on || !g || g.state !== 'play' || !g.player) { if (I.cur) end(g, 'state', true); return; }
    const t0 = now(), p = g.player;
    if (g.world !== world) { world = g.world; I.vistaLm = []; vistaAsked = null; ownRef = null; lastPilot = null; detached.length = 0; if (I.cur) end(g, 'state', true); }
    // the ship you fly is yours
    const S = g.starships;
    if (S && S.pilot !== lastPilot) { lastPilot = S.pilot; if (S.pilot && !(I.cur && I.cur.ship === S.pilot && !I.cur.boarded)) remember(g, S.pilot); }
    // the vistas' landmarks (once per world)
    if (!vistaAsked && g.pool && g.meta && (g.meta.vgen | 0) >= 11 && (g.dim || 'overworld') === 'overworld') {
      vistaAsked = world;
      try { g.pool.direct(0, { type: 'vistas', dim: g.dim || 'overworld' }, null, (m) => { if (world !== vistaAsked || !m || !Array.isArray(m.list)) return; const seen = {}; for (const v of m.list) { if (!v || !v.lm || !v.aim || seen[v.lm]) continue; seen[v.lm] = 1; I.vistaLm.push({ id: v.lm, x: v.aim[0], top: v.aim[1], z: v.aim[2] }); } }); } catch (e) { /* no worker: the Heartland's table */ }
    }
    if ((tAcc += dt) >= 1) { tAcc = 0; I.targets = I.collect(g); }
    // the aim: on foot, nothing open, 10 Hz
    const free = !(g.gadgets && g.gadgets.controlling) && !(g.ui && (g.ui.screen || g.ui.typing)) && !I.cur;
    if ((aAcc += dt) >= 0.1) {
      aAcc = 0;
      const a = free ? I.aimAt(I.targets, p.eyePos(), p.lookDir()) : null;
      I.aimed = a ? { kind: a.target.kind, id: a.target.id, name: a.target.name, toKey: a.target.toKey, dist: a.dist, target: a.target, e: a.e } : null;
    }
    // the detached called ships (their trip was cancelled): they land all the same
    for (let i = detached.length - 1; i >= 0; i--) { const q = detached[i]; flyShip(g, q.c, dt); if (q.c.shipLanded) { q.ship.ectxBusy = false; detached.splice(i, 1); } }
    const c = I.cur;
    if (c) step(g, c, dt);
    const Cs = I.cost, ms = now() - t0; Cs.frames++; Cs.ms += ms; if (ms > Cs.worst) Cs.worst = ms;
  };
  function step(g, c, dt) {
    const p = g.player;
    if (c.ending) { c.ending.t += dt; if (c.ending.t >= I.BLEND) I.cur = null; return; }
    c.t += dt; c.phaseT += dt; c.dt = dt;
    const tp = c.target.pos;
    let dist = Math.hypot(tp[0] - p.pos[0], tp[2] - p.pos[2]);
    const s = { means: c.means, phaseT: c.phaseT, dist, shipLanded: c.shipLanded, boarded: c.boarded };
    if (c.means === 'walk') { s.dist = Math.hypot(c.goal[0] - p.pos[0], c.goal[2] - p.pos[2]); s.reach = 2.2; }
    if (c.phase === 'call') {
      if (!c.arr && !c.noFlight && !planArrival(g, c)) {
        // a design that never came (its worker was replaced and the job lost): the shuttle you conjured is built again, once
        if (c.conjured && !c.again && c.phaseT > 8 && !(c.ship.d && c.ship.d.meta)) { c.again = 1; dropShip(g, c.ship); c.ship = conjure(g, c.target, 1); c.ship.ectxBusy = true; }
        else if (c.phaseT > 20) { end(g, 'noPad'); say(g, 'g.int.noWay', null, 'Ich finde keinen Weg dorthin', 'I cannot find a way there'); return; }
      }
      if (c.arr) flyShip(g, c, dt);
      s.shipLanded = c.shipLanded;
    } else if (c.phase === 'board') {
      if (c.phaseT >= 1.6 && !c.boarded) { if (!board(g, c) && c.phaseT > 5) { end(g, 'board'); return; } }
      s.boarded = c.boarded;
    }
    if (c.fl) {
      const fl = c.fl, A = fl.auto, b = fl.b;
      dist = Math.hypot(tp[0] - b.pos[0], tp[2] - b.pos[2]);
      s.dist = A ? A.dist : dist; s.brake = Math.max(70, Math.min(110, fl.cruise * 1.5) * 2.2);
      s.fl = { state: fl.state, auto: !!A, landing: !!(A && A.landing), y: b.pos[1], cruise: A ? A.cruise : b.pos[1] };
      // the autopilot stopped on its own way there (a flight key, V, the map): the player has the controls
      if (!A && fl.state !== 'landed' && c.phase !== 'arrive') { end(g, 'input'); return; }
      if (g.flight !== fl) { end(g, 'state', true); return; }
    }
    // the arrival's framing lasts its 3 s from the moment its shot opens (the landing's shot keeps its 4 s first)
    if (c.phase === 'arrive' && c.means !== 'walk') s.phaseT = c.skip ? 99 : !camOn(g) || !c.seq ? c.phaseT : c.seq.kind === 'arrive' ? Math.min(c.phaseT, c.seq.t) : 0;
    const next = I.phaseOf(c.phase, s);
    if (next !== c.phase) { c.prev = c.phase; c.phase = next; c.phaseT = 0; onPhase(g, c); if (!I.cur) return; }
    c.dist = s.dist;
    bar(g, c);
  }
  function onPhase(g, c) {
    const t = c.target;
    // the music rises as the ship lifts and again on the arrival (as a wow moment does)
    if ((c.phase === 'takeoff' || (c.phase === 'arrive' && c.means !== 'walk')) && g.audio && g.audio.swell) { try { g.audio.swell(g.env ? g.env.day | 0 : 0, c.phase === 'takeoff' ? 1.4 : 0.8); } catch (e) { /* no music */ } }
    if (c.phase === 'arrive') {
      if (VR.EventLog) VR.EventLog.emit('travel', c.means === 'walk' ? 'walk_arrive' : 'arrive', c.means === 'walk' ? 1 : 3, [t.pos[0], t.pos[1], t.pos[2]], 'intent', Math.max(4, (t.top - t.base) / 2 || 6));
      if (c.means !== 'walk') caption(g, t.name);
    } else if (c.phase === 'done') {
      caption(g, null);
      const p = g.player, S = g.starships;
      if (c.fl && S && S.pilot && S.pilot.flight === c.fl) S.exit();
      // you stand facing what you came for
      const dx = t.pos[0] - p.pos[0], dz = t.pos[2] - p.pos[2], dh = Math.hypot(dx, dz);
      p.yaw = Math.atan2(-dx, -dz); p.pitch = clamp(Math.atan2(t.pos[1] - (p.pos[1] + 1.6), Math.max(8, dh)), -0.3, 0.45); if (p.viewYaw !== undefined) p.viewYaw = p.yaw;
      g.camMode = 0;
      end(g, 'done');
    }
  }

  const camOn = (g) => !(g.settings && g.settings.travelCam === false);
  // ---------------------------------------------------------------- the cameras
  const OWN = {}, BL = {};
  // on foot (game.js, after vehicleCam): the call, the boarding, the walk, the blend back
  I.cam = function (g, cam) {
    const c = I.cur; if (!c || !g.player) return null;
    if (c.ending) {
      if (g.flight && c.fl) return null;   // (in the ship the flight's camera blends: shipCam)
      I.blend(c.ending.from, cam, smooth(c.ending.t / I.BLEND), BL);
      return Object.assign({}, cam, { x: BL.x, y: BL.y, z: BL.z, yaw: BL.yaw, pitch: BL.pitch, roll: BL.roll || 0, fov: BL.fov, fixed: true });
    }
    if (g.flight || !VR.DirCam || (g.settings && g.settings.travelCam === false && c.means !== 'walk')) return null;
    const out = VR.DirCam.travel(g, c, cam, 'foot');
    if (out) c.lastCam = Object.assign(c.lastCam || {}, out);
    return out;
  };
  // in the ship (flight.js camera(), the flight's own view in `own`): the travel shots, or the blend back to it
  I.shipCam = function (fl, own) {
    const c = I.cur; if (!c || c.fl !== fl) return null;
    const g = fl.g;
    if (c.ending) { I.blend(c.ending.from, own, smooth(c.ending.t / I.BLEND), BL); return Object.assign({}, own, { x: BL.x, y: BL.y, z: BL.z, yaw: BL.yaw, pitch: BL.pitch, roll: BL.roll || 0, fov: BL.fov, fixed: true }); }
    if (!VR.DirCam || (g.settings && g.settings.travelCam === false)) return null;
    const In = g.input;
    if (c.look && In && In.captured) VR.DirCam.look(c.look, In.mouse.dx, In.mouse.dy, fl.dt || 1 / 60, In.sensitivity || 0.0024);
    const out = VR.DirCam.travel(g, c, own, 'ship');
    if (out) c.lastCam = Object.assign(c.lastCam || {}, out);
    void OWN;
    return out;
  };

  // ---------------------------------------------------------------- the chrome: the letterbox, the bar, the caption, the marker
  let dom = null, barText = '', markShown = false, glide = [0, 0];
  function mount() {
    if (dom || typeof document === 'undefined') return dom;
    const hud = document.getElementById('hud'), app = hud || document.getElementById('app') || document.body;   // (in the HUD: it goes with the HUD — the title, F1, the photo mode)
    if (!document.getElementById('intentstyle')) {
      const s = document.createElement('style'); s.id = 'intentstyle';
      s.textContent = '.lbx{position:absolute;left:0;right:0;height:0;background:#000;z-index:25;pointer-events:none;transition:height .6s ease}.lbx.t{top:0}.lbx.b{bottom:0}.lbx.on{height:7.5vh}' +
        '#intentbar{position:absolute;left:50%;bottom:calc(7.5vh + 14px);transform:translateX(-50%);z-index:26;text-align:center;color:#eef6ff;font:600 15px/1.3 var(--font,sans-serif);letter-spacing:.04em;text-shadow:0 1px 4px rgba(0,0,0,.8);pointer-events:none;opacity:0;transition:opacity .5s;white-space:nowrap}#intentbar.on{opacity:1}#intentbar small{display:block;font-weight:500;font-size:12px;color:#b9cbe0;letter-spacing:.02em}' +
        '#intentcap{position:absolute;left:0;right:0;bottom:24%;text-align:center;z-index:26;pointer-events:none;opacity:0;transition:opacity .8s}#intentcap.on{opacity:1}#intentcap span{display:inline-block;padding:6px 26px;color:#fff;font:600 30px/1.2 var(--display,sans-serif);letter-spacing:.14em;text-shadow:0 2px 12px rgba(0,0,0,.55),0 0 26px rgba(120,200,255,.35);border-top:1px solid rgba(255,255,255,.45);border-bottom:1px solid rgba(255,255,255,.45)}' +
        '#intentmark{position:absolute;left:0;top:0;pointer-events:none;display:none;z-index:6;transform:translate(-50%,-50%)}#intentmark i{display:block;width:22px;height:22px;margin:0 auto;border:2px solid #9affd8;transform:rotate(45deg);box-shadow:0 0 10px rgba(154,255,216,.6)}#intentmark b{display:block;margin-top:6px;color:#e8fff6;font:600 13px var(--font,sans-serif);text-shadow:0 1px 3px #000;white-space:nowrap;text-align:center}';
      document.head.appendChild(s);
    }
    const t = document.createElement('div'); t.className = 'lbx t'; app.appendChild(t);
    const b = document.createElement('div'); b.className = 'lbx b'; app.appendChild(b);
    const bar = document.createElement('div'); bar.id = 'intentbar'; app.appendChild(bar);
    const cap = document.createElement('div'); cap.id = 'intentcap'; const capS = document.createElement('span'); cap.appendChild(capS); app.appendChild(cap);
    const mk = document.createElement('div'); mk.id = 'intentmark'; mk.appendChild(document.createElement('i')); const mkL = document.createElement('b'); mk.appendChild(mkL); (hud || app).appendChild(mk);
    return (dom = { t, b, bar, cap, capS, mk, mkL, ch: document.getElementById('crosshair') });
  }
  function chrome(g, on) {
    const d = mount(); if (!d) return;
    const film = on && !(g.settings && g.settings.travelCam === false);
    d.t.classList.toggle('on', film); d.b.classList.toggle('on', film);
    d.bar.classList.toggle('on', on); if (!on) { barText = ''; }
    const hud = document.getElementById('hud'); if (hud) hud.classList.toggle('travel', !!on);
  }
  function bar(g, c) {
    const d = mount(); if (!d) return;
    const ph = c.phase === 'done' ? 'arrive' : c.phase;
    const left = c.dist !== undefined ? c.dist : 0;
    const txt = tx('g.int.bar', { ph: tx('g.int.ph.' + ph, null, ph, ph), to: toPhrase(c.target), d: distTxt(Math.max(0, left)) }, '{ph} · {to} · noch {d}', '{ph} · {to} · {d} to go') + '|' + tx('g.int.take', null, 'Bewegen: selbst steuern · Maus: umsehen', 'Move: take over · Mouse: look around');
    if (txt === barText) return;
    barText = txt;
    const [a, b] = txt.split('|');
    d.bar.textContent = a; const sm = document.createElement('small'); sm.textContent = b; d.bar.appendChild(sm);
  }
  function caption(g, text) {
    const d = mount(); if (!d) return;
    if (text) { d.capS.textContent = text; d.cap.classList.add('on'); } else d.cap.classList.remove('on');
    void g;
  }
  // the marker on the aimed target and the crosshair's glide toward it (after the camera, every frame while aimed)
  I.ui = function (g) {
    const d = mount(); if (!d || !g.cam) return;
    const a = I.aimed, show = !!a && !I.cur && (!VR.Ctx || g.ctxRow === 5);
    let gx = 0, gy = 0;
    if (show) {
      const c = g.cam, q = a.target.pos, cy = Math.cos(c.yaw), sy = Math.sin(c.yaw), cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
      const fx = -sy * cp, fy = sp, fz = -cy * cp, rx = cy, rz = -sy, ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;
      const dx = q[0] - c.x, dy = q[1] - c.y, dz = q[2] - c.z, zc = dx * fx + dy * fy + dz * fz;
      const W = window.innerWidth || 960, H = window.innerHeight || 540, ty = Math.tan((c.fov || 1.2) / 2), txx = ty * W / H;
      if (zc > 1) {
        const nx = (dx * rx + dz * rz) / zc / txx, ny = (dx * ux + dy * uy + dz * uz) / zc / ty;
        const sx = (nx * 0.5 + 0.5) * W, syy = (0.5 - ny * 0.5) * H;
        d.mk.style.display = 'block'; d.mk.style.left = sx.toFixed(1) + 'px'; d.mk.style.top = syy.toFixed(1) + 'px';
        const lab = a.name + ' · ' + distTxt(a.dist);
        if (d.mkL.textContent !== lab) d.mkL.textContent = lab;
        // the crosshair glides up to 3°' worth toward it
        const lim = Math.tan(3 * DEG) / ty * H * 0.5, ox = sx - W / 2, oy = syy - H / 2, L = Math.hypot(ox, oy) || 1, k = Math.min(1, lim / L);
        gx = ox * k; gy = oy * k;
        markShown = true;
      } else if (markShown) { d.mk.style.display = 'none'; markShown = false; }
    } else if (markShown) { d.mk.style.display = 'none'; markShown = false; }
    glide[0] += (gx - glide[0]) * 0.25; glide[1] += (gy - glide[1]) * 0.25;
    if (d.ch) { const tr = Math.abs(glide[0]) + Math.abs(glide[1]) > 0.3 ? `translate(calc(-50% + ${glide[0].toFixed(1)}px), calc(-50% + ${glide[1].toFixed(1)}px))` : ''; if (d.ch.style.transform !== tr) d.ch.style.transform = tr; }
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

// ============================================================================
// f-quiet2 · VR.TaleEnd — a friendship tale's ending shown, not told (plan docs/superpowers/plans/2026-11-02-f-quiet2.md;
// the v0.57 review R58-07: „the ending is Merle's line in a bubble"). When the friend says the ending (tales.js sayEnd)
// a short warm scene plays, ≤ DUR s, any key skips (the camera back within a second):
//   come   the friend walks up to the child (the lost child) or to their family (else a neighbour; nobody near: to you)
//   touch  a hug — the lost child, the festival's family, the letter's family — or hands held — the Flausel home, the
//          woken beacon —, hearts over them
//   gift   the friend turns to you, both hands out, sparkles; the gift's name as a small caption
//   back   the camera eases back to your eyes
// The camera is u-folk3's director (Folk3.frameGroup round the pair: open space, the sun's side, never in a wall; else
// your own view turned toward them). The friend's line is the scene's caption, not a bubble. ⚙ Weniger Bewegung: the
// scene without the camera. Pure (node, test/quiet2.js): PLAN · T · DUR · phase · skip · partner · meet · KEYS.
// Cost 🟢: nothing at all unless a scene plays (once per tale): then one frame step and one camera blend.
// ============================================================================
(function (VR) {
  'use strict';
  const TE = VR.TaleEnd = VR.TaleEnd || {};
  // the five templates (tales_core.js TC.TPL): who the friend meets and how they touch
  TE.PLAN = {
    lost: { with: 'kid', touch: 'hug' },      // the lost child runs into the friend's arms
    ingr: { with: 'fam', touch: 'hug' },      // the festival saved: the friend hugs their family
    home: { with: 'fam', touch: 'hands' },    // the Flausel family's tiny house: hands held, looking at it
    letter: { with: 'fam', touch: 'hug' },    // the letter arrived: a hug
    beacon: { with: 'fam', touch: 'hands' },  // the beacon awake: hands held
  };
  TE.T = { touch: 2.6, gift: 5.0, back: 6.7 };
  TE.DUR = 7.5; TE.IN = 1.0;
  TE.KEYS = ['g.te.gift', 'g.te.thanks'];
  const ss = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  // the phase at t and the camera's share k (eases in over IN s, back over the last DUR − T.back s)
  TE.phase = (t) => ({ ph: t < TE.T.touch ? 'come' : t < TE.T.gift ? 'touch' : t < TE.T.back ? 'gift' : t < TE.DUR ? 'back' : 'end', k: t >= TE.DUR ? 0 : Math.min(ss(t / TE.IN), ss((TE.DUR - t) / (TE.DUR - TE.T.back))) });
  TE.skip = (t) => (t >= TE.T.back ? t : TE.T.back);
  // the partner: the child (lost), else the friend's family (awake, ≤ 40 m), else a neighbour (≤ 25 m), else null
  TE.partner = function (t, gv, agents, kid) {
    const P = TE.PLAN[t] || TE.PLAN.letter;
    if (P.with === 'kid' && kid) return kid;
    if (!gv || !gv.p) return null;
    const d = (a) => Math.hypot(a.pos[0] - gv.pos[0], a.pos[2] - gv.pos[2]);
    const ok = (a) => a && a !== gv && a.p && a.vil === gv.vil && a.pose !== 'sleep' && !a.guest && !(a.inBoat) && Math.abs(a.pos[1] - gv.pos[1]) < 4;
    let fam = null, fd = 40, nb = null, nd = 25;
    for (const a of agents || []) {
      if (!ok(a)) continue;
      const q = d(a);
      if (a.p.fam === gv.p.fam && q < fd) { fd = q; fam = a; }
      else if (a.p.fam !== gv.p.fam && q < nd) { nd = q; nb = a; }
    }
    return fam || nb || (P.with === 'kid' ? null : null);
  };
  // where they meet ([x, z]): the friend walks up to GAP m before the partner; mid: between them
  TE.GAP = 1.0; TE.GAPS = { hug: 0.5, hands: 0.85 };   // (a hug close, hands at arm's length)
  TE.meet = function (f, p, gap) {
    const dx = p[0] - f[0], dz = p[1] - f[1], L = Math.hypot(dx, dz) || 1, g = Math.min(gap || TE.GAP, L);
    const friend = [p[0] - dx / L * g, p[1] - dz / L * g];
    return { friend, mid: [(friend[0] + p[0]) / 2, (friend[1] + p[1]) / 2] };
  };

  // ================================================================ the browser
  if (typeof document === 'undefined' || !document.createElement || !VR.Villages) return;
  const Vs = VR.Villages, P = Vs.prototype;
  const T = (k, v) => (VR.I18N ? VR.I18N.t(k, v) : k);
  const wrapA = (a) => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };
  TE.cur = null; TE.hold = false; TE.log = [];
  TE.stats = { started: 0, skipped: 0, framed: 0, refused: 0 };
  const groundY = (g, x, z, y0) => { const w = g.world; if (!w || !w.topAt) return y0; const h = w.topAt(Math.floor(x), Math.floor(z)); return h > 0 && Math.abs(h + 1 - y0) < 6 ? h + 1 : y0; };
  function solidOf(g) {
    const w = g.world, R = VR.R, F = VR.F; if (!w || !R || !F) return () => false;
    return (x, y, z) => !!w.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));   // (any block: a palm's leaves are no wall, but no lens belongs in them — run 3)
  }
  function busy(g) {
    if (!g || g.state !== 'play' || !g.player) return 'state';
    if (g.ui && g.ui.screen && g.ui.screen !== 'hud') return 'screen';
    if (VR.First && VR.First.cine && VR.First.cine(g)) return 'cine';
    if (g.player.flying || g.player.vehicle || g.flight || g.player.inShip) return 'moving';
    return '';
  }
  // o: {t (the template), giver (the friend, a village agent), kid (the tale's child), text (the friend's line)}
  TE.start = function (V, o) {
    const g = V && V.g; o = o || {};
    const gv = o.giver; if (!gv || !gv.pos || TE.cur) { TE.stats.refused++; return false; }
    const why = busy(g); if (why) { TE.stats.refused++; TE.log.push(['refused', why]); return false; }
    const plan = TE.PLAN[o.t] || TE.PLAN.letter, pt = TE.partner(o.t, gv, V.agents, o.kid || null), p = g.player.pos;
    // the meeting: the friend walks to the partner (or to you); far away — the friend starts nearer (≤ 3.5 m to walk)
    const to = pt ? [pt.pos[0], pt.pos[2]] : [p[0], p[2]], m = TE.meet([gv.pos[0], gv.pos[2]], to, TE.GAPS[plan.touch]);
    if (!pt) { const dx = to[0] - gv.pos[0], dz = to[1] - gv.pos[2], L = Math.hypot(dx, dz) || 1; m.friend = [to[0] - dx / L * 1.8, to[1] - dz / L * 1.8]; m.mid = [(m.friend[0] + to[0]) / 2, (m.friend[1] + to[1]) / 2]; }
    const far = Math.hypot(gv.pos[0] - m.friend[0], gv.pos[2] - m.friend[1]);
    if (far > 3.5) { const u = 3.5 / far, x = m.friend[0] + (gv.pos[0] - m.friend[0]) * u, z = m.friend[1] + (gv.pos[2] - m.friend[1]) * u; gv.pos = [x, groundY(g, x, z, gv.pos[1]), z]; gv.path = null; gv.vel = [0, 0, 0]; }
    const fy = groundY(g, m.friend[0], m.friend[1], pt ? pt.pos[1] : gv.pos[1]);
    const C = { V, g, t: 0, tt: o.t || 'letter', plan, gv, pt, kid: o.kid || null, m, fy, text: String(o.text || ''), acts: [gv.act, pt ? pt.act : null], hud: !!g.hideHud, first: true, sparkT: 0, said: {}, pinP: pt ? [pt.pos[0], pt.pos[2]] : null };
    gv.act = { type: 'teEnd' }; gv.path = null; gv.bubble = null; gv.teHold = true;
    if (pt) { if (!pt.tlKid) pt.act = { type: 'teEnd' }; pt.path = null; pt.bubble = null; pt.teHold = true; }
    // the camera: u-folk3's director round the pair, on your side; ⚙ Weniger Bewegung: none
    C.less = !!(VR.A11y && VR.A11y.less && VR.A11y.less(g.settings)) || (g.settings && g.settings.travelCam === false);
    // (the friend alone comes to you — nobody of theirs near: your own eyes are the camera; runs 3–4: a group frame round
    // the friend and you rose into a palm's fronds, a face frame missed)
    if (!C.less && pt) {
      const F3 = VR.Folk3, cy = fy, mid = [m.mid[0], cy, m.mid[1]];
      let shot = null;
      try { if (F3 && F3.frameGroup) { const E = g.env, sun = E && E.sunDir ? Math.atan2(E.sunDir[2], E.sunDir[0]) : null; const ax = Math.atan2(to[1] - m.friend[1], to[0] - m.friend[0]), toYou = Math.atan2(p[2] - mid[2], p[0] - mid[0]), s1 = ax + Math.PI / 2, s2 = ax - Math.PI / 2;
          const pref = pt ? (Math.cos(s1 - toYou) >= Math.cos(s2 - toYou) ? s1 : s2) : toYou;   // (the pair from the side, on your side; the friend alone: from you)
          const avoid = []; for (const a of V.agents) if (a !== gv && a !== pt && Math.abs(a.pos[0] - mid[0]) < 12 && Math.abs(a.pos[2] - mid[2]) < 12) avoid.push([a.pos[0], a.pos[2]]);   // (nobody else before the lens)
          if (pt) {
            shot = F3.frameGroup(solidOf(g), mid, 0.9, { pref, sun, avoid });
            if (!shot && avoid.length) shot = F3.frameGroup(solidOf(g), mid, 0.9, { pref, sun });
          } } } catch (e) { shot = null; }
      if (shot) { TE.stats.framed++; C.shot = { x: shot.P[0], y: shot.P[1], z: shot.P[2], yaw: shot.yaw, pitch: shot.pitch, fov: F3.groupFov ? F3.groupFov(shot.d, pt ? 1.1 : 0.7, (innerWidth || 16) / (innerHeight || 9)) : null }; }
      else { const e = [p[0], p[1] + 1.6, p[2]], dx = mid[0] - e[0], dy = mid[1] + 1 - e[1], dz = mid[2] - e[2]; C.shot = { x: e[0], y: e[1], z: e[2], yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)), fov: null }; }   // (no frame: your view turned toward them)
    }
    g.hideHud = true; const hud = document.getElementById('hud'); if (hud) hud.style.visibility = 'hidden';
    TE.cur = C; TE.stats.started++; TE.log.push(['start', C.tt, pt ? (pt === C.kid ? 'kid' : pt.p.fam === gv.p.fam ? 'fam' : 'neighbour') : 'you', C.shot ? (C.less ? 'less' : 'cam') : 'nocam']);
    caption(C.text);
    if (VR.EventLog && VR.EventLog.emit) { try { VR.EventLog.emit('social', 'tale_end', 3, [m.mid[0], fy + 1, m.mid[1]], 'tales', 3); } catch (e) { /* the log's */ } }
    return true;
  };
  // ---- the caption (the friend's line, then the gift) — bottom centre, small, like the story's subtitles
  let capEl = null;
  function caption(text) {
    if (!capEl || !capEl.isConnected) {
      capEl = document.createElement('div'); capEl.id = 'tecap';
      capEl.style.cssText = 'position:absolute;left:50%;bottom:9%;transform:translateX(-50%);max-width:min(640px,80vw);padding:5px 14px;border-radius:12px;background:rgba(10,8,20,.42);color:#fff4e0;font:600 15px/1.35 var(--font,sans-serif);text-shadow:0 1px 3px rgba(0,0,0,.8);text-align:center;pointer-events:none;z-index:7;transition:opacity .4s ease';
      (document.getElementById('app') || document.body).appendChild(capEl);
    }
    capEl.textContent = text || ''; capEl.style.opacity = text ? '1' : '0';
  }
  TE.caption = () => (capEl && capEl.style.opacity !== '0' ? capEl.textContent : '');
  // ---- the poses: hands held (both arms forward and low, the hands meeting) and the gift (both hands out)
  const set = (Pz, j, rx, ry, rz) => { const q = Pz[j]; if (q) { q[0] = rx; q[1] = ry; q[2] = rz; } };
  const HANDS = (Pz) => { set(Pz, 'arm_l', 0.8, 0, 0.12); set(Pz, 'arm_r', 0.8, 0, -0.12); set(Pz, 'fore_l', 0.3, 0, 0); set(Pz, 'fore_r', 0.3, 0, 0); };
  const HUGKID = (Pz) => { set(Pz, 'arm_l', 0.95, 0, 0.42); set(Pz, 'arm_r', 0.95, 0, -0.42); set(Pz, 'fore_l', 0.75, 0, 0.35); set(Pz, 'fore_r', 0.75, 0, -0.35); if (Pz.body) Pz.body[0] = 0.22; if (Pz.head) Pz.head[0] = 0.25; };
  const GIFT = (Pz) => { set(Pz, 'arm_l', 1.25, 0, 0.22); set(Pz, 'arm_r', 1.25, 0, -0.22); set(Pz, 'fore_l', 0.55, 0, 0); set(Pz, 'fore_r', 0.55, 0, 0); if (Pz.head) Pz.head[0] = 0.12; };
  if (P.pose && !P.pose.__te) {
    const op = P.pose;
    P.pose = function (a, t) { const Pz = op.apply(this, arguments); if (a && a.teFx && Pz) { try { a.teFx(Pz, t); } catch (e) { a.teFx = null; } } return Pz; };
    P.pose.__te = true;
  }
  // ---- the friend's and the partner's own act while the scene holds them (tales' child too)
  if (P.runAct && !P.runAct.__te) {
    const orun = P.runAct;
    P.runAct = function (a, dt, tod) {
      const C = TE.cur;
      if (!a || !a.teHold || !C) return orun.apply(this, arguments);
      const ph = TE.phase(C.t).ph;
      if (a === C.gv && ph === 'come') {
        if (this.goTo(a, C.m.friend[0], C.fy, C.m.friend[1], 0.5)) { a.vel[0] = 0; a.vel[2] = 0; a.path = null; }
        return;
      }
      a.vel[0] = 0; a.vel[2] = 0; a.path = null;
    };
    P.runAct.__te = true;
  }
  if (P.think && !P.think.__te) { const ot = P.think; P.think = function (a) { if (a && a.teHold && TE.cur) return; return ot.apply(this, arguments); }; P.think.__te = true; }
  // ---- standing together: the villages' „make way" (x-robo) would part them — their places pinned, their faces turned
  const pin = (a, x, z) => { a.pos[0] = x; a.pos[2] = z; a.vel[0] = 0; a.vel[2] = 0; a.path = null; };
  const face = (a, q, dt) => { const ty = Math.atan2(-(q[0] - a.pos[0]), -(q[2] - a.pos[2])); let dy = ty - (a.yaw || 0); while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; a.yaw = (a.yaw || 0) + dy * Math.min(1, dt * 9 + 0.05); a.lookAt = q; };
  // ---- the frame step (after the villages' update)
  TE.step = function (V, dt) {
    const C = TE.cur; if (!C || C.V !== V) return;
    const g = C.g, I = g.input;
    const any = !!I && ((I.pressed && I.pressed.size > 0) || (I.mouse && I.mouse.clicked && I.mouse.clicked.some(Boolean)) || (I.padPressed && I.padPressed.size > 0) || (I.tPressed && I.tPressed.size > 0));
    if (any && !C.first && !C.skipped) { C.skipped = true; TE.stats.skipped++; C.t = TE.skip(C.t); }
    C.first = false;
    if (!TE.hold) C.t += Math.min(dt, 0.1);
    const gone = V.agents.indexOf(C.gv) < 0 || (C.pt && V.agents.indexOf(C.pt) < 0);
    const ph = TE.phase(C.t).ph, gv = C.gv, pt = C.pt, p = g.player.pos;
    if (ph === 'end' || gone || g.state !== 'play') { TE.end(); return; }
    const eye = C.shot && !C.less ? [C.shot.x, C.shot.y, C.shot.z] : [p[0], p[1] + 1.6, p[2]];
    if (ph === 'come') {
      if (pt) { if (!C.pinP) C.pinP = [pt.pos[0], pt.pos[2]]; pin(pt, C.pinP[0], C.pinP[1]); face(pt, [gv.pos[0], gv.pos[1] + 1.3, gv.pos[2]], dt); }
      gv.lookAt = pt ? [pt.pos[0], pt.pos[1] + 1, pt.pos[2]] : [p[0], p[1] + 1.4, p[2]];
      return;
    }
    pin(gv, C.m.friend[0], C.m.friend[1]); if (pt && C.pinP) pin(pt, C.pinP[0], C.pinP[1]);
    // (a slow machine, a seek: the friend is there when the touch begins)
    if (!C.said.at) {
      C.said.at = true;
      if (Math.hypot(gv.pos[0] - C.m.friend[0], gv.pos[2] - C.m.friend[1]) > 0.9) { gv.pos = [C.m.friend[0], C.fy, C.m.friend[1]]; }
      gv.vel = [0, 0, 0]; gv.path = null;
    }
    if (ph === 'touch') {
      const hug = C.plan.touch === 'hug';
      if (pt) { face(pt, [gv.pos[0], gv.pos[1] + 1.3, gv.pos[2]], dt); face(gv, [pt.pos[0], pt.pos[1] + 1, pt.pos[2]], dt); }
      else face(gv, eye, dt);
      const small = !!(pt && pt.kid && !gv.kid);
      gv.pose = hug && pt && !small ? 'hug' : 'stand'; gv.teFx = hug && pt ? (small ? HUGKID : null) : HANDS;
      if (pt) { pt.pose = hug ? 'hug' : 'stand'; pt.teFx = hug ? null : HANDS; }
      if (!C.said.touch) { C.said.touch = true; if (C.V.hearts) { C.V.hearts(gv); if (pt) C.V.hearts(pt); } if (g.audio && g.audio.play) { try { g.audio.play('pop'); } catch (e) { /* a sound */ } } }
      return;
    }
    if (ph === 'gift' || ph === 'back') {
      gv.pose = 'stand'; face(gv, eye, dt);
      gv.teFx = ph === 'gift' ? GIFT : null;
      if (pt) { pt.pose = 'stand'; pt.teFx = null; face(pt, eye, dt); }
      if (!C.said.gift) {
        C.said.gift = true;
        const L = VR.Tales && VR.Tales.state && VR.Tales.state.lastEnd, item = L && L.item;
        caption(item ? T('g.te.gift', { item: VR.itemName ? VR.itemName(item) : item, who: gv.p ? gv.p.name : '' }) : T('g.te.thanks', { who: gv.p ? gv.p.name : '' }));
        if (g.audio && g.audio.play) { try { g.audio.play('levelup'); } catch (e) { /* a sound */ } }
      }
      C.sparkT -= dt;
      if (ph === 'gift' && C.sparkT <= 0 && g.particles) {
        C.sparkT = 0.35;
        const y = gv.yaw || 0, hx = gv.pos[0] - Math.sin(y) * 0.45, hz = gv.pos[2] - Math.cos(y) * 0.45, hy = gv.pos[1] + (gv.h || 1.8) * 0.62;
        try { if (g.particles.spark) g.particles.spark(hx, hy, hz, [1, 0.88, 0.5], 10, 1.6, 1); if (g.particles.glow) g.particles.glow(hx, hy + 0.15, hz, [1, 0.8, 0.45], 1.2, 0.12, 0.7); } catch (e) { /* the pool's */ }
      }
      if (ph === 'back') caption('');
    }
  };
  TE.end = function () {
    const C = TE.cur; if (!C) return;
    TE.cur = null;
    const g = C.g, gv = C.gv, pt = C.pt;
    for (const a of [gv, pt]) if (a) { a.teHold = false; a.teFx = null; if (a.pose === 'hug') a.pose = 'stand'; }
    gv.act = null; gv.lookAt = null;
    if (pt && !pt.tlKid) { pt.act = C.acts[1] && C.acts[1].type !== 'talk' ? C.acts[1] : null; pt.lookAt = null; }
    g.hideHud = C.hud; const hud = document.getElementById('hud'); if (hud) hud.style.visibility = g.hideHud ? 'hidden' : 'visible';
    caption('');
    TE.log.push(['end', C.tt, +C.t.toFixed(2), C.skipped ? 'skipped' : 'full']);
    if (TE.log.length > 40) TE.log.splice(0, TE.log.length - 40);
  };
  // the camera handed to the renderer (game.js, one marked line beside the other view hooks)
  TE.cam = function (g, base) {
    const C = TE.cur; if (!C || !C.shot || C.less || !base) return null;
    const k = TE.phase(C.t).k; if (k <= 0.001) return null;
    const S = C.shot, fov = S.fov || base.fov;
    return Object.assign({}, base, { x: base.x + (S.x - base.x) * k, y: base.y + (S.y - base.y) * k, z: base.z + (S.z - base.z) * k, yaw: base.yaw + wrapA(S.yaw - base.yaw) * k, pitch: base.pitch + (S.pitch - base.pitch) * k, fov: base.fov && fov ? base.fov + (fov - base.fov) * k : base.fov, roll: (base.roll || 0) * (1 - k), fixed: true });
  };
  TE.seek = (t) => { if (TE.cur) TE.cur.t = t; };
  if (P.update && !P.update.__te) {
    const ou = P.update;
    P.update = function (dt) { const r = ou.apply(this, arguments); if (TE.cur) { try { TE.step(this, dt); } catch (e) { TE.err = String((e && e.message) || e); TE.end(); } } return r; };
    P.update.__te = true;
  }
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

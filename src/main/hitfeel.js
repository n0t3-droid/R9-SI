// ============================================================================
// Das erste Gefecht (f-hud; plan docs/superpowers/plans/2026-10-31-f-hud.md): the adventurer's first ten minutes.
//   · a new world starts with the HUD up: F1's hidden HUD of the last world and a story scene's body.storyon never carry
//     over (startWorld wrapped); F1 hiding it says once how to bring it back (a toast — the HUD's hint line hides with it)
//   · a hit on a machine is felt: a short bright burst of sparks where it was struck (more at the core; none extra on
//     Very Low), a metal „clank" whose pitch walks a little each time (inharmonic partials of our own, no samples), the
//     machine rocks back on its feet and slides a step away (not the crane on its tower), and — only with the switch
//     ⚙ „Bildschirmwackeln" (hitShake, default off, also on the Einfach page) — a 0.2-s jolt of the camera (≤ 3.5 cm,
//     never in a cinematic camera)
//   · a machine powered down: the „+20 EP" and the Heliataler pop up where it stood (the ring's own float stays)
//   · Funke says what now after each step: „noch 2 am Außenposten", „nur noch eine", the outpost freed → the next
//     disturbed outpost's way (and ⚔ points there), none left → look round or build a home
// Cost 🟢: nothing per frame outside a fight but one comparison (the shake off: none); a hit: ≤ 16 particles from the
// shared pool, four oscillators, one DOM node per power-down.
// ============================================================================
(function (VR) {
  'use strict';
  const H = VR.HitFeel = VR.HitFeel || {};
  const hasDoc = typeof document !== 'undefined';
  const tx = (k, v, de, en) => (VR.I18N && VR.I18N.tx ? VR.I18N.tx(k, v, de, en) : de);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // ---------------------------------------------------------------- a · a new world: the HUD up
  H.fresh = function (g, doc) {
    if (!g) return;
    g.hideHud = false;
    const d = doc || (hasDoc ? document : null); if (!d) return;
    const hud = d.getElementById && d.getElementById('hud'); if (hud && hud.style) hud.style.visibility = 'visible';
    if (d.body && d.body.classList) d.body.classList.remove('storyon');
  };

  // ---------------------------------------------------------------- d · the hit
  H.SHAKE_T = 0.22;   // s
  H.SHAKE_M = 0.035;  // m at most (the roll ≤ 4 × that in radians: ≤ 0.14 rad … in practice ≤ 0.05)
  H.shakeAt = function (t, amp, seed) {
    if (!(t >= 0) || t >= H.SHAKE_T) return { x: 0, y: 0, r: 0 };
    const k = 1 - t / H.SHAKE_T, e = k * k * clamp(amp || 0, 0, 1) * H.SHAKE_M, s = seed || 0;
    return { x: e * Math.sin(t * 83 + s), y: e * 0.8 * Math.sin(t * 97 + s * 1.7), r: e * 1.2 * Math.sin(t * 61 + s * 0.3) };
  };
  // the game's camera this frame (game.js, after every other camera): only with the switch on, never a fixed camera
  H.cam = function (g, cam, dt) {
    const s = g && g.hf; if (!s || !(s.shake > 0)) return;
    if (!(g.settings && g.settings.hitShake) || !cam || cam.fixed) { s.shake = 0; return; }
    const o = H.shakeAt(H.SHAKE_T - s.shake, s.amp, s.seed || 0);
    const c = Math.cos(cam.yaw || 0), sn = Math.sin(cam.yaw || 0);
    cam.x += o.x * c; cam.z -= o.x * sn; cam.y += o.y; cam.roll = (cam.roll || 0) + o.r;
    s.shake = Math.max(0, s.shake - (dt || 0));
  };
  // the clank's pitch: a golden-ratio walk through 0.82 … 1.22 (never the same twice running)
  H.pitch = (i) => 0.82 + (((i | 0) * 0.6180339887 + 0.31) % 1) * 0.4;
  // the machine rocks back (rad, about its feet) while its hit flash runs (foes.js f.hitT: 0.25 → 0)
  H.HIT_T = 0.25; H.RECOIL = 0.2;
  H.recoil = function (hitT) { if (!(hitT > 0) || hitT >= H.HIT_T) return 0; const s = (H.HIT_T - hitT) / H.HIT_T; return H.RECOIL * Math.sin(Math.PI * s) * (1 - 0.35 * s); };
  // the push: away from the player, m/s added to its velocity; nothing for a machine fixed on its place
  H.PUSH = 2.6;
  H.knock = function (m, p, kind) {
    const K = VR.Foes && VR.Foes.KINDS ? VR.Foes.KINDS[kind] : null;
    if ((K && K.fixed) || (!K && kind === 'crane') || !p) return [0, 0, 0];
    const dx = m[0] - p[0], dz = m[2] - p[2], L = Math.hypot(dx, dz); if (L < 1e-3) return [0, 0, 0];
    const k = H.PUSH * (K && K.fly ? 1.15 : 1);
    return [dx / L * k, 0, dz / L * k];
  };
  // the extra sparks of a hit by preset (the foes' own 8 come anyway): none on Very Low
  H.sparkN = function (preset, strong) { if (preset === 'potato') return 0; const n = preset === 'low' ? 6 : 10; return strong ? Math.round(n * 1.6) : n; };

  // ---------------------------------------------------------------- e · Funke: what now
  H.nextLine = function (o) {
    if (!o) return null;
    if (o.freed) {
      if (o.next && o.next.d > 0) return { key: 'g.hf.next', vars: { d: Math.max(10, Math.round(o.next.d / 10) * 10), arrow: o.next.arrow || '' } };
      return { key: 'g.hf.none', vars: {} };
    }
    if (o.left >= 2) return { key: 'g.hf.left', vars: { n: o.left | 0 } };
    if (o.left === 1) return { key: 'g.hf.left1', vars: {} };
    return null;   // (none left: liberate.js's own line — the beacon's ring or [V])
  };
  const LINES = {
    'g.hf.left': ['Eine ist zur Ruhe gekommen! Noch {n} am Außenposten.', 'One is calm! {n} more at the outpost.'],
    'g.hf.left1': ['Gut so! Nur noch eine Maschine.', 'Well done! Just one machine left.'],
    'g.hf.next': ['Weiter geht\'s: der nächste gestörte Außenposten — {d} m {arrow}', 'On we go: the next disturbed outpost — {d} m {arrow}'],
    'g.hf.none': ['Alle Außenposten hier leuchten wieder. Schau dich um — oder bau dir ein Zuhause!', 'Every outpost near here shines again. Look around — or build yourself a home!'],
  };
  H.text = (l) => (l ? tx(l.key, l.vars, LINES[l.key] ? LINES[l.key][0] : l.key, LINES[l.key] ? LINES[l.key][1] : l.key) : '');
  H.say = function (g, l) {
    const txt = H.text(l); if (!txt) return false;
    const fk = g.funke;
    if (fk && fk.on && fk.on() && fk.show) { if (fk.line && fk.endLine) fk.endLine(); fk.show(txt); }
    else if (g.ui && g.ui.toast) g.ui.toast(txt, '', null);
    if (VR.EventLog && VR.EventLog.emit) VR.EventLog.emit('social', 'funke_next', 1, null, 'hitfeel');
    return true;
  };

  // ================================================================ the game
  const G = VR.Game, Fo = VR.Foes, L = VR.Liberate, A = VR.Adventure;
  H.stats = { hits: 0, pops: 0, lines: 0 };
  if (G && G.prototype.startWorld && !G.prototype.startWorld.__hf) {
    const os = G.prototype.startWorld;
    G.prototype.startWorld = function () { H.fresh(this); this.hf = null; H.pend = []; H.freedAt = null; H.freedT = 0; if (VR.First2) VR.First2.moved = null; return os.apply(this, arguments); };
    G.prototype.startWorld.__hf = true;
  }
  // the clank: a struck plate — a noise tick and three inharmonic partials, the pitch walking
  H.clankN = 0;
  H.clank = function (g, v) {
    const au = g.audio; if (!au || !au.ctx || !au.tone) return;
    const p = H.pitch(H.clankN++), f0 = 610 * p;
    if (au.noiseHit) au.noiseHit({ f: 2600 * p, q: 7, g: 0.32 }, 0.4 * v, 0.16, p);
    au.tone(f0, 0.075 * v, 0.42, 'sine', true); au.tone(f0 * 2.71, 0.04 * v, 0.3, 'sine', true); au.tone(f0 * 5.18, 0.018 * v, 0.18, 'sine', true);
    au.tone(f0 * 0.5, 0.05 * v, 0.07, 'triangle', false);
  };
  if (Fo && Fo.sound && !Fo.sound.__hf) {
    const osd = Fo.sound;
    Fo.sound = function (g, what, at) {
      if (what === 'clang' && g && g.player) { const p = g.player.pos, d = at ? Math.hypot(at[0] - p[0], at[1] - p[1], at[2] - p[2]) : 0, v = clamp(1 - d / 48, 0, 1); if (v > 0.02) H.clank(g, v); return; }
      return osd.apply(this, arguments);
    };
    Fo.sound.__hf = true;
  }
  if (Fo && Fo.hurtMob && !Fo.hurtMob.__hf) {
    const oh = Fo.hurtMob;
    Fo.hurtMob = function (En, m, dmg, from) {
      const f = m && m.foe, hp0 = f ? f.hp : 0;
      const r = oh.apply(this, arguments);
      try { if (f && !f.remote && f.hp < hp0) H.onHit(En.game, m, from); } catch (e) { /* the hit as it was */ }
      return r;
    };
    Fo.hurtMob.__hf = true;
  }
  H.onHit = function (g, m, from) {
    const f = m.foe, K = Fo.KINDS[f.k] || {}, P = g.player, src = from || (P && P.pos);
    H.stats.hits++;
    const strong = f.lastK >= 2;
    // the push (not while it powers down) and the rock back (foes.js draws H.recoil(f.hitT))
    if (f.st !== 'down' && src) { const k = H.knock(m.pos, src, f.k); m.vel[0] += k[0]; m.vel[2] += k[2]; }
    // the sparks where it was struck: on its side toward the player, at the eye's height within its body
    const n = H.sparkN(g.settings && g.settings.preset, strong), Pp = g.particles;
    if (n && Pp && Pp.spark && src) {
      const dx = src[0] - m.pos[0], dz = src[2] - m.pos[2], Lh = Math.hypot(dx, dz) || 1, w = (K.w || 0.5) * 0.9;
      const eyeY = (src[1] || m.pos[1]) + 1.5, y = clamp(eyeY, m.pos[1] + (K.h || 1) * 0.25, m.pos[1] + (K.h || 1) * 0.9);
      Pp.spark(m.pos[0] + dx / Lh * w, y, m.pos[2] + dz / Lh * w, strong ? [1, 1, 0.82] : [1, 0.86, 0.5], n, strong ? 6 : 4.5, 1.6);
    }
    // the jolt (read only with the switch on)
    g.hf = { shake: H.SHAKE_T, amp: strong ? 1 : 0.6, seed: H.stats.hits * 1.37 };
  };
  // the machine gone (its power-down over, or calmed by the beam's light): its place for the award's pop
  if (Fo && Fo.gone && !Fo.gone.__hf) {
    const og = Fo.gone;
    Fo.gone = function (En, m) { const f = m && m.foe; if (f && !f.remote && (f.why === 'hit' || f.why === 'light')) { const K = Fo.KINDS[f.k] || {}; H.downAt = { pos: [m.pos[0], m.pos[1] + (K.h || 1) + 0.3, m.pos[2]], gt: (En.game && En.game.time) || 0 }; } return og.apply(this, arguments); };
    Fo.gone.__hf = true;
  }
  // the XP pop where the machine stood (the award of its power-down comes within a few seconds)
  H.POP_T = 4;   // s of play between the machine gone and its award
  H.project = function (g, P) {
    const r = g.renderer, cam = g.cam; if (!r || !r.viewProj || !cam) return null;
    const vp = r.viewProj, x = P[0] - cam.x, y = P[1] - cam.y, z = P[2] - cam.z, cw = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
    if (cw <= 0.05) return null;
    const cx = (vp[0] * x + vp[4] * y + vp[8] * z + vp[12]) / cw, cy = (vp[1] * x + vp[5] * y + vp[9] * z + vp[13]) / cw;
    if (Math.abs(cx) > 0.95 || Math.abs(cy) > 0.95) return null;
    const W = (r.canvas && r.canvas.clientWidth) || 1280, Hh = (r.canvas && r.canvas.clientHeight) || 720;
    return [(cx * 0.5 + 0.5) * W, (1 - (cy * 0.5 + 0.5)) * Hh];
  };
  H.pop = function (g, xp, tl) {
    if (!hasDoc || !(xp > 0 || tl > 0) || g.hideHud) return false;
    const D = H.downAt; if (!D || Math.abs((g.time || 0) - D.gt) > H.POP_T) return false;
    const s = H.project(g, D.pos) || [((g.renderer && g.renderer.canvas && g.renderer.canvas.clientWidth) || 1280) / 2, ((g.renderer && g.renderer.canvas && g.renderer.canvas.clientHeight) || 720) * 0.4];
    H.css();
    const el = document.createElement('div'); el.className = 'hfpop';
    const fmt = (n) => String(Math.round(n));
    const a = document.createElement('b'); a.textContent = xp > 0 ? tx('g.adv.float', { n: fmt(xp) }, '+' + fmt(xp) + ' EP', '+' + fmt(xp) + ' XP') : ''; el.appendChild(a);
    if (tl > 0) { const c = document.createElement('i'); c.textContent = '◉ +' + fmt(tl); el.appendChild(c); }
    el.style.left = Math.round(s[0]) + 'px'; el.style.top = Math.round(s[1]) + 'px';
    (document.getElementById('app') || document.body).appendChild(el);
    setTimeout(() => { if (el.remove) el.remove(); }, 1500);
    H.downAt = null; H.stats.pops++;
    return true;
  };
  H.css = function () {
    if (!hasDoc || document.getElementById('hfcss')) return;
    const st = document.createElement('style'); st.id = 'hfcss';
    st.textContent = '.hfpop{position:absolute;z-index:40;pointer-events:none;transform:translate(-50%,-100%);text-align:center;white-space:nowrap;animation:hfPop 1.45s cubic-bezier(.2,1.4,.4,1) both;font-weight:800;text-shadow:0 2px 0 rgba(40,20,0,.55),0 0 12px rgba(255,190,80,.7)}' +
      '.hfpop b{display:block;font-size:30px;color:#fff3c4}.hfpop i{display:block;font-style:normal;font-size:20px;color:#ffd166}' +
      '@keyframes hfPop{0%{opacity:0;transform:translate(-50%,-60%) scale(.5)}18%{opacity:1;transform:translate(-50%,-110%) scale(1.15)}35%{transform:translate(-50%,-120%) scale(1)}80%{opacity:1}100%{opacity:0;transform:translate(-50%,-190%) scale(.95)}}';
    document.head.appendChild(st);
  };
  if (A && A.flushFloat && !A.flushFloat.__hf) {
    const of = A.flushFloat;
    A.flushFloat = function () { const xp = A.floatXP, tl = A.floatTaler; const r = of.apply(this, arguments); try { const g = VR.game; if (g && g.state === 'play') H.pop(g, xp, tl); } catch (e) { /* the ring's float is there */ } return r; };
    A.flushFloat.__hf = true;
  }
  // Funke's what now: a machine of an outpost resolved (liberate.js), an outpost freed
  H.pend = [];
  H.queue = function (g, l, delay) { if (l) H.pend.push({ l, at: (g.time || 0) + (delay || 0) }); };
  if (L && L.resolved && !L.resolved.__hf) {
    const orr = L.resolved;
    L.resolved = function (g, id) {
      const r = orr.apply(this, arguments);
      try { const s = L.sites && L.sites().get(id); if (s && s.st !== 'frei' && L.state(s) === 'stoer' && s.strays > 0) H.queue(g, H.nextLine({ left: s.strays - s.res }), 1.6); } catch (e) { /* the outpost's own words */ }
      return r;
    };
    L.resolved.__hf = true;
  }
  if (L && L.free && !L.free.__hf) {
    const ofr = L.free;
    L.free = function (g, s) { const r = ofr.apply(this, arguments); if (r) H.freedAt = { id: s && s.id, g }; return r; };
    L.free.__hf = true;
  }
  H.ARROWS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
  H.afterFreed = function (g) {
    const SP = VR.StoryPlay, p = g.player; if (!p) return;
    const n = SP && SP.nearSite ? SP.nearSite(g, false) : null;
    let next = null;
    if (n && n.s && n.d < 3000) {
      const B = VR.First2 && VR.First2.bearing ? VR.First2.bearing(p.pos, p.yaw, [n.s.x, 0, n.s.z]) : null;
      next = { d: n.d, arrow: B && B.arrow ? B.arrow : '' };
      const st = g.meta && g.meta.advStart; if (st) { st.out = [n.s.x + 0.5, n.s.y || p.pos[1], n.s.z + 0.5]; st.reached = false; }   // (⚔ points on: first2.js's pointer)
    }
    H.queue(g, H.nextLine({ freed: true, next }), 0);
  };
  H.tick = function (g, dt) {
    H.acc = (H.acc || 0) + dt; if (H.acc < 0.25) return; H.acc = 0;
    if (H.freedAt && !L.moment && !L.mcam) { H.freedAt = null; H.freedT = (g.time || 0) + 5; }
    if (H.freedT && (g.time || 0) >= H.freedT) { H.freedT = 0; H.afterFreed(g); }
    if (!H.pend.length) return;
    const busy = (g.ui && g.ui.screen) || (VR.First2 && VR.First2.cine && VR.First2.cine(g)) || (g.funke && g.funke.line && (g.time || 0) - (H.lastSaid || -99) < 3);
    const q = H.pend[0]; if (busy || (g.time || 0) < q.at) return;
    H.pend.shift(); if (H.say(g, q.l)) { H.stats.lines++; H.lastSaid = g.time || 0; }
  };
  H.f1Said = false;
  if (G && G.prototype.playFrame && !G.prototype.playFrame.__hf) {
    const op = G.prototype.playFrame;
    G.prototype.playFrame = function (dt) {
      const I = this.input, f1 = !!(I && I.hit && !this.input.menuOpen && I.hit('F1'));
      const r = op.apply(this, arguments);
      try {
        if (f1 && this.hideHud && !H.f1Said && this.ui && this.ui.toast) { H.f1Said = true; const k = VR.Binds && VR.Binds.label ? VR.Binds.label('F1', VR.I18N && VR.I18N.lang) : 'F1'; this.ui.toast(tx('g.hf.hidden', { key: k }, 'HUD ausgeblendet — [{key}] zeigt es wieder.', 'HUD hidden — [{key}] brings it back.'), '', null); }
        if (L) H.tick(this, dt);
      } catch (e) { /* next frame */ }
      return r;
    };
    G.prototype.playFrame.__hf = true;
  }
  // ⚙ Einfach: the switch „Bildschirmwackeln" under the three sliders
  const S = VR.Settings;
  if (S && S.add) S.add({ key: 'hitShake', g: 'play', sec: 'steer', t: 'switch', lab: 'g.set.hitShake', tip: 'g.set.hitShake.tip', def: false });
  const F2 = VR.First2;
  if (F2 && F2.renderSimple && !F2.renderSimple.__hf) {
    const ors = F2.renderSimple;
    F2.renderSimple = function (ui) {
      const r = ors.apply(this, arguments);
      try {
        const body = r && hasDoc ? document.getElementById('setbody') : null, g = ui.game, St = g.settings;
        if (body) {
          const d = document.createElement('div'); d.className = 'setrow f2row hfrow';
          const lab = document.createElement('label'), cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!St.hitShake;
          cb.setAttribute('aria-label', tx('g.set.hitShake', null, 'Bildschirmwackeln', 'Screen shake'));
          lab.appendChild(cb); lab.appendChild(document.createTextNode(' ' + tx('g.set.hitShake', null, 'Bildschirmwackeln', 'Screen shake')));
          cb.onchange = () => { St.hitShake = !!cb.checked; if (g.saveSettings) g.saveSettings(); };
          const t = document.createElement('div'); t.className = 'setip'; t.textContent = tx('g.set.hitShake.tip', null, 'Ein kleiner Ruck, wenn du eine Maschine triffst.', 'A small jolt when you hit a machine.');
          d.appendChild(lab); d.appendChild(t); body.appendChild(d);
        }
      } catch (e) { /* the three sliders */ }
      return r;
    };
    F2.renderSimple.__hf = true;
  }
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

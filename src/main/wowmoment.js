// ============================================================================
// Wow-Momente (t-vista; docs/superpowers/plans/2026-10-15-t-vista.md): the first time you reach a vista point of a world
// (vgen 11: the generator lists each as a 'vista' spawn of its chunk, gen_vista.js), the view swings for four seconds —
// it eases from your eyes to the vista's framed composition (the landmark in the upper third, the spur's walls leading to
// it, the trees at the sides), drifts in, and eases back — with a four-bar rise of the day's music (klang.js swellPlan)
// and a one-line caption naming the place. Once per vista per world (meta.wowSeen, saved with the world); ⚙ Spiel →
// „Wow-Momente" switches them off; never for a multiplayer guest or with guests in the world, never while a menu, the
// Studio, the director or a vehicle has the view; at least GAP seconds between two (a vista passed in the gap waits for
// the next visit); any key or click ends one early. Four times a second a look at the few vistas loaded — in a world
// without vistas (vgen ≤ 10) nothing at all.
// ============================================================================
(function (VR) {
  'use strict';
  const tx = (k, de, en) => (VR.I18N && VR.I18N.tx ? VR.I18N.tx(k, null, de, en) : en);
  const W = VR.WowMoment = { RISE: 1.4, HOLD: 1.2, FALL: 1.4, REACH: 3.5, DRIFT: 0.7, GAP: 45 };
  W.DUR = W.RISE + W.HOLD + W.FALL;   // 4 s
  // ---- the pure parts (test/wowmoment.js)
  // smootherstep: 0 → 1 with no jolt at either end (its first and second derivatives vanish there)
  W.smoother = (t) => { const u = t <= 0 ? 0 : t >= 1 ? 1 : t; return u * u * u * (u * (u * 6 - 15) + 10); };
  // how far the view stands toward the composition at time t: 0 → 1 over RISE, held, 1 → 0 over FALL
  W.curve = (t) => t <= 0 || t >= W.DUR ? 0 : t < W.RISE ? W.smoother(t / W.RISE) : t < W.RISE + W.HOLD ? 1 : W.smoother((W.DUR - t) / W.FALL);
  // the slow push-in while the composition holds (0 → 1 from the rise's middle to the fall's middle)
  W.drift = (t) => W.smoother((t - W.RISE * 0.5) / (W.HOLD + (W.RISE + W.FALL) * 0.5));
  // a key or click before the fall: the time in the fall where the curve stands as high as now (the view turns back from
  // where it is — no jump: in the rise smoother(t / RISE) = smoother((DUR − t') / FALL))
  W.skipTo = (t) => t < W.RISE ? W.DUR - W.FALL * Math.max(0, t) / W.RISE : t < W.RISE + W.HOLD ? W.RISE + W.HOLD : t;
  // the caption's opacity: in after half a second, out before the end
  W.caption = (t) => Math.max(0, Math.min(1, (t - 0.45) / 0.5, (W.DUR - 0.35 - t) / 0.5));
  // may a moment start: the setting on, a world of one's own without guests, nothing else holding the view, the last one
  // GAP seconds ago
  W.allowed = (s) => !!s && s.enabled !== false && !s.guest && !s.guests && !s.busy && !(s.wait > 0);
  W.seen = (meta, id) => !!(meta && Array.isArray(meta.wowSeen) && meta.wowSeen.indexOf(id) >= 0);
  W.mark = (meta, id) => { if (!meta) return; if (!Array.isArray(meta.wowSeen)) meta.wowSeen = []; if (meta.wowSeen.indexOf(id) < 0) meta.wowSeen.push(id); };
  // the wow vista nearest the feet (x, y, z) not yet seen in this world, within REACH (and 3 blocks of height), or null
  W.pick = (list, meta, x, y, z) => {
    let best = null, bd = W.REACH * W.REACH;
    for (const v of list) {
      if (v.wow === false || W.seen(meta, v.id) || Math.abs(y - v.y) > 3) continue;
      const dx = v.x + 0.5 - x, dz = v.z + 0.5 - z, d = dx * dx + dz * dz;
      if (d <= bd) { bd = d; best = v; }
    }
    return best;
  };
  // the camera at weight u between a (the eye) and b (the composition), the composition pushed in by `push` blocks along
  // its look; yaw the short way round. Writes into out (no allocation)
  W.blend = (a, b, u, push, out) => {
    let dy = b.yaw - a.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
    const cp = Math.cos(b.pitch), bx = b.x - Math.sin(b.yaw) * cp * push, by = b.y + Math.sin(b.pitch) * push, bz = b.z - Math.cos(b.yaw) * cp * push;
    out.x = a.x + (bx - a.x) * u; out.y = a.y + (by - a.y) * u; out.z = a.z + (bz - a.z) * u;
    out.yaw = a.yaw + dy * u; out.pitch = a.pitch + (b.pitch - a.pitch) * u; out.fov = a.fov + (b.fov - a.fov) * u;
    return out;
  };
  // the place's name for the caption (lang keys g.wow.<landmark>)
  const NAMES = {
    temple: ['Der Tor-Tempel', 'The Gate Temple'], citadel: ['Die Turmzitadelle', 'The Spire Citadel'], isles: ['Die Himmelsinseln', 'The Sky Isles'],
    lighthouse: ['Der Leuchtturm am fernen Ufer', 'The Lighthouse on the Far Shore'], falls: ['Der Wasserfall', 'The Waterfall'], nova: ['Nova Haven', 'Nova Haven'],
    station: ['Die Bergstation', 'The Mountain Station'], lookout: ['Der Aussichtsturm auf dem Grat', 'The Lookout on the Ridge'], hills: ['Die Kuppelhügel', 'The Pod Hills'],
  };
  W.NAMES = NAMES;
  W.title = (lm) => { const n = NAMES[lm] || ['Aussicht', 'A View']; return tx('g.wow.' + (NAMES[lm] ? lm : 'view'), n[0], n[1]); };

  // ---- the game's actor
  class Actor {
    constructor(game) { this.g = game; this.list = new Map(); this.acc = 0; this.wait = 0; this.active = null; this.t = 0; this.dom = null; this.a = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, fov: 1 }; this.b = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, fov: 1 }; this.out = {}; this.saved = null; this.count = 0; }
    // the 'vista' spawns of a loaded column: ['vista', id, x, y, z, eyeX, eyeY, eyeZ, yaw, pitch, fov, landmark, wow] —
    // wow 0: a quiet vista (its landmark too small from there to swing the view for; its bench and its view stay)
    absorb(spawns) {
      for (const s of spawns) if (s && s[0] === 'vista' && !this.list.has(s[1])) this.list.set(s[1], { id: s[1], x: s[2], y: s[3], z: s[4], eye: [s[5], s[6], s[7]], yaw: s[8], pitch: s[9], fov: s[10], lm: s[11], wow: s[12] !== 0 });
    }
    // (a vehicle holds the view while gadgets.controlling — riding a bike, a tram, a ship, a seat, flying a drone; the
    // camera hook g.vehicleCam is always installed and says nothing: vista.mjs's first in-page run found every moment
    // refused by it)
    state() {
      const g = this.g, mp = g.mp, Z = VR.Zeit;
      return {
        enabled: g.settings ? g.settings.wowMoments !== false : true,
        guest: !!(g.meta && g.meta.guest) || !!(mp && mp.isClient),
        guests: !!(mp && mp.isHost && mp.remote && mp.remote.size > 0),
        busy: g.state !== 'play' || !!g.studioOpen || !!g.photo || !!(g.ui && (g.ui.screen || g.ui.typing || g.ui.blocking)) || !!(g.director && g.director.active) || !!(g.gadgets && g.gadgets.controlling) || !!g.revealPending || !!(g.wonders && g.wonders.rise) || !!(Z && (Z.active || Z.busy)) || !!(g.player && g.player.dead),
        wait: this.wait,
      };
    }
    update(dt) {
      if (this.active) { this.run(dt); return; }
      if (!this.list.size) return;                                  // no vistas loaded (a vgen ≤ 10 world: never any)
      if (this.wait > 0) this.wait -= dt;
      this.acc += dt; if (this.acc < 0.25) return; this.acc = 0;   // four times a second
      const g = this.g, p = g.player; if (!p || !g.meta) return;
      if (!W.allowed(this.state())) return;
      const v = W.pick(this.list.values(), g.meta, p.pos[0], p.pos[1], p.pos[2]);
      if (v) this.start(v);
    }
    start(v) {
      const g = this.g;
      this.active = v; this.t = 0; this.e = 0; this.capMax = 1; this.count++;
      W.mark(g.meta, v.id);
      if (g.saveMeta) { try { g.saveMeta(); } catch (e) { /* saved with the next autosave */ } }
      const b = this.b; b.x = v.eye[0]; b.y = v.eye[1]; b.z = v.eye[2]; b.yaw = v.yaw; b.pitch = v.pitch; b.fov = v.fov * Math.PI / 180;
      this.saved = { hideHud: g.hideHud };
      g.hideHud = true; const hud = document.getElementById('hud'); if (hud) hud.style.visibility = 'hidden';
      if (g.audio && g.audio.swell) g.audio.swell(g.env ? g.env.day | 0 : 0, W.DUR / 4);
      const d = this.ui(); this.capText.textContent = W.title(v.lm); d.style.display = 'block'; d.style.opacity = 0;
      this.first = true;
      if (VR.EventLog) VR.EventLog.emit('wow', v.lm || 'view', 3, null, 'wow');   // e-log: the view swings to a vista (eventlog.js)
    }
    run(dt) {
      const g = this.g;
      this.t += dt; this.e += dt;   // t: the curve's clock (a skip moves it on); e: the time since the start (the drift)
      // any key, click, tap or pad button: the view comes back now (the fall from where it is)
      const I = g.input, any = !!I && (I.pressed.size > 0 || I.mouse.clicked.some(Boolean) || (I.padPressed && I.padPressed.size > 0) || (I.tPressed && I.tPressed.size > 0));
      if (any && !this.first) this.skip();
      this.first = false;
      if (this.dom) this.dom.style.opacity = Math.min(this.capMax, W.caption(this.t)).toFixed(3);
      if (this.t >= W.DUR) this.stop();
    }
    skip() {
      if (!this.active || this.t >= W.RISE + W.HOLD) return;
      this.capMax = Math.min(this.capMax, W.caption(this.t)); this.t = W.skipTo(this.t);
    }
    stop() {
      const g = this.g; if (!this.active) return;
      this.active = null; this.wait = W.GAP;
      if (this.saved) { g.hideHud = this.saved.hideHud; const hud = document.getElementById('hud'); if (hud) hud.style.visibility = g.hideHud ? 'hidden' : 'visible'; }
      if (this.dom) this.dom.style.display = 'none';
    }
    // the camera handed to the renderer while a moment runs (base: the eye's own camera this frame)
    cam(base) {
      if (!this.active) return null;
      const a = this.a; a.x = base.x; a.y = base.y; a.z = base.z; a.yaw = base.yaw; a.pitch = base.pitch; a.fov = base.fov;
      const o = W.blend(a, this.b, W.curve(this.t), W.DRIFT * W.drift(this.e), this.out);
      return Object.assign({}, base, { x: o.x, y: o.y, z: o.z, yaw: o.yaw, pitch: o.pitch, fov: o.fov, roll: 0, fixed: true });
    }
    ui() {
      if (this.dom) return this.dom;
      const d = document.createElement('div'); d.id = 'wowcap';
      d.style.cssText = 'position:absolute;left:0;right:0;bottom:21%;text-align:center;pointer-events:none;display:none;z-index:30;transition:none';
      const s = document.createElement('span');
      s.style.cssText = 'display:inline-block;padding:6px 26px;color:#fff;font:600 28px/1.2 var(--display, sans-serif);letter-spacing:0.14em;text-shadow:0 2px 12px rgba(0,0,0,0.55),0 0 26px rgba(120,200,255,0.35);border-top:1px solid rgba(255,255,255,0.45);border-bottom:1px solid rgba(255,255,255,0.45)';
      d.appendChild(s); this.capText = s;
      (document.getElementById('app') || document.body).appendChild(d);
      return (this.dom = d);
    }
    destroy() { this.stop(); this.list.clear(); if (this.dom) this.dom.remove(); this.dom = null; this.capText = null; }
  }
  W.Actor = Actor;
  // ⚙ Spiel → „Wow-Momente" (on by default)
  if (VR.Settings && VR.Settings.add) VR.Settings.add({ key: 'wowMoments', g: 'play', sec: 'play', t: 'switch', lab: 'g.set.wowMoments', tip: 'g.set.wowMoments.tip', def: true });
})(VR);

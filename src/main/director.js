// ============================================================================
// Director: the cinematic camera. `/trailer` and the 🎬 Trailer buttons (start screen, pause menu) play the game's
// own trailer (src/shared/cine.js): a title card, the shots A–G of the first trailer with their scripted shuttles and
// heroes, the passages of the second and third cut, and the closing card — letterbox bars, captions, the HUD hidden,
// the golden hour set per shot, the music and the ambience running. Each cut waits for the chunks around the next
// camera (the title card holds the picture meanwhile); Esc ends the ride at any moment and gives the player back
// exactly where he was (from the start screen the temporary trailer world is left again). The same director flies
// the ✨ reveal (play with a plain shot list) and the 📽 Zeitraffer's orbit (orbit / orbitReset).
// Per frame: no allocation — the spline writes into buffers, the camera object is the renderer's own.
// ============================================================================
(function (VR) {
  'use strict';
  // the player's language (lang_de.js / lang_en.js)
  const T = (k, v, fb) => (VR.I18N ? VR.I18N.t(k, v, fb) : (fb !== undefined ? fb : k));
  const M = VR.M;
  const C = VR.Cine;
  const DEG = Math.PI / 180;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const DRAW_OPTS = { flash: 0, scale: 1, shade: 1 };   // the heroes' draw options (one object for every frame)

  class Director {
    constructor(g) {
      this.g = g; this.active = false; this.shots = null; this.si = 0; this.t = 0; this.phase = 'idle'; this.fade = 1; this.dom = null;
      this.opts = {}; this.saved = null; this.fov = 72; this.loadT = 0; this.tok = 0;
      this.designs = new Map();                       // ship design key → design (or null while it is being made)
      this.myShips = []; this.actors = [];
      this.cx = 0; this.cy = 0; this.cz = 0; this.cyaw = 0; this.cpitch = 0;
      this.b1 = new Float64Array(3); this.b2 = new Float64Array(3); this.b3 = new Float64Array(3);
    }
    ui() {
      if (this.dom) return this.dom;
      const d = document.createElement('div'); d.id = 'cine';
      d.innerHTML = '<div class="bar top"></div><div class="bar bot"></div><div class="fade"></div><div class="cap"></div><div class="hintc">' + T('g.chat.directorStop') + '</div>';
      document.getElementById('app').appendChild(d);
      this.dom = d; return d;
    }
    // o: quick (start as soon as the ground is there) · skipAny (any key or click ends it) · noFadeOut (the last shot
    // ends exactly where your own view begins, so the hand-over is seamless) · fromTitle (the temporary trailer world:
    // leaving returns to the start screen and removes it)
    play(name, o) {
      const g = this.g;
      if (this.active) return true;
      if (g.state !== 'play' || !g.player) return false;
      this.opts = o || {};
      this.shots = name === 'trailer' ? C.SHOTS : name;
      if (!this.shots || !this.shots.length) return false;
      this.designs.clear(); this.prepare(this.shots);      // (the designs are taken from the starships' cache again)
      this.active = true; this.si = -1; this.t = 0; this.fade = 1; this.phase = 'next';
      this.saved = { pos: g.player.pos.slice(), yaw: g.player.yaw, pitch: g.player.pitch, flying: g.player.flying, hideHud: g.hideHud, camMode: g.camMode, tod: g.env.timeOfDay, freeze: g.zenFreezeTime, noClip: g.player.noClip };
      g.hideHud = true; document.getElementById('hud').style.visibility = 'hidden'; g.camMode = 0; g.zoom = false;
      g.player.flying = true; g.player.vel = [0, 0, 0]; g.player.noClip = true;
      g.zenFreezeTime = true;                          // the golden hour stays where each shot sets it
      // the random sky traffic would fly through the shots: it is held back while the trailer runs
      if (g.traffic) { this.savedTraffic = g.traffic.t; g.traffic.t = 1e9; for (const s of g.traffic.ships) if (!s.scripted) s.dead = true; }
      const d = this.ui(); d.classList.add('on'); d.querySelector('.fade').style.opacity = 1; d.querySelector('.cap').textContent = '';
      g.ui.show(null); g.input.captured = true;
      if (g.ui.hint) g.ui.hint('', 1);
      return true;
    }
    stop() {
      const g = this.g; if (!this.active) return;
      this.active = false; this.phase = 'idle';
      this.clearShips();
      this.actors = [];
      const s = this.saved;
      if (s) { g.player.pos = s.pos; g.player.yaw = s.yaw; g.player.pitch = s.pitch; g.player.flying = s.flying; g.hideHud = s.hideHud; g.camMode = s.camMode; g.zenFreezeTime = s.freeze; g.player.noClip = s.noClip; if (s.tod !== undefined && g.env.setTime) g.env.setTime(s.tod); }
      g.player.noClip = s ? s.noClip : false; g.player.vel = [0, 0, 0];
      document.getElementById('hud').style.visibility = g.hideHud ? 'hidden' : 'visible';
      if (this.dom) this.dom.classList.remove('on');
      if (g.traffic && this.savedTraffic !== undefined) { g.traffic.t = this.savedTraffic; this.savedTraffic = undefined; }
      if (this.opts && this.opts.fromTitle) this.leaveTitleWorld();
    }
    // the trailer started from the start screen runs in a temporary world: back to the title, then it is removed
    async leaveTitleWorld() {
      const g = this.g, id = g.meta && g.meta.id;
      this.opts = {};
      try { await g.quitToTitle(); if (id && g.store) await g.store.deleteWorld(id); } catch (e) { console.warn('Trailer: the temporary world', e); }
    }
    // the designs of the scripted ships are made ahead, so a shot launches its shuttles on its first frame
    prepare(shots) {
      for (const sh of shots) {
        if (!sh.posTrack && sh.keys) { const flat = C.fromKeys(sh.keys); sh.posTrack = new C.Track(flat.map((k) => [k[0], k[1], k[2], k[3]])); sh.lookTrack = new C.Track(flat.map((k) => [k[0], k[4], k[5], k[6]])); }
        if (sh.ships) for (const sp of sh.ships) this.design(sp);
      }
    }
    seedOf(sp) { return (Math.round(sp.A[0] * 3 + sp.A[1] * 5 + sp.A[2] * 7 + sp.B[0] * 11 + sp.B[2] * 13) ^ (sp.arch.length * 977)) >>> 0; }
    design(sp) {
      const SS = this.g.starships, key = sp.arch + ':' + this.seedOf(sp);
      if (!SS || this.designs.has(key)) return this.designs.get(key) || null;
      this.designs.set(key, null);
      // (the starships' cache frees a design that nobody has flown for a minute: the callback marks it fresh, and update()
      // keeps the designs of the ride fresh)
      SS.design(this.seedOf(sp), VR.Starship && VR.Starship.ARCH[sp.arch] ? sp.arch : 'shuttle', null, (d) => { d.last = performance.now(); this.designs.set(key, d); });
      return this.designs.get(key) || null;
    }
    // scripted flights through the traffic (the shot's start is the run's first frame; t0 delays the flight inside it)
    launchShips(shot) {
      const g = this.g, Tr = g.traffic;
      if (!Tr || !shot.ships) return;
      const tok = this.tok;
      for (const sp of shot.ships) {
        const make = (d) => {
          if (!this.active || tok !== this.tok) return;
          const len = Math.hypot(sp.B[0] - sp.A[0], sp.B[1] - sp.A[1], sp.B[2] - sp.A[2]);
          const ship = { d, A: sp.A.slice(), B: sp.B.slice(), C: sp.C.slice(), off: sp.off ? sp.off.slice() : [0, 0, 0], t: -(sp.t0 || 0) / sp.dur, dur: sp.dur, speed: len / sp.dur, age: 0, heading: 0, roll: 0, pitch: 0, gear: 0, prevYaw: null, pos: sp.A.slice(), arch: d.meta.arch, big: false, fire: 99, defender: false, circle: null, life: 0, scripted: true };
          if (sp.quiet) { ship.arrived = true; ship.wt = 1; }      // a hovering ship: no arrival flash
          Tr.ships.push(ship); this.myShips.push(ship);
        };
        const d = this.design(sp);
        if (d) make(d); else { const SS = g.starships; if (SS) { const key = sp.arch + ':' + this.seedOf(sp); const wait = setInterval(() => { const dd = this.designs.get(key); if (dd || tok !== this.tok || !this.active) { clearInterval(wait); if (dd) make(dd); } }, 50); } }
      }
    }
    clearShips() { for (const sh of this.myShips) sh.dead = true; this.myShips = []; }
    // the camera pose of a shot at time t: the spline, or the follow-cam behind a scripted ship (writes cx … cpitch)
    pose(shot, t) {
      const f = shot.follow, s = f ? this.myShips[f.ship] : null;
      if (s && s.t >= 0) {
        const h = s.heading, fx = -Math.sin(h), fz = -Math.cos(h);
        this.cx = s.pos[0] - fx * f.back; this.cy = s.pos[1] + f.up; this.cz = s.pos[2] - fz * f.back;
        const lx = s.pos[0] + fx * f.ahead, ly = s.pos[1] - f.drop, lz = s.pos[2] + fz * f.ahead;
        this.aim(lx, ly, lz);
        return;
      }
      const P = shot.posTrack.eval(t, this.b1), L = shot.lookTrack.eval(t, this.b2);
      this.cx = P[0]; this.cy = P[1]; this.cz = P[2];
      this.aim(L[0], L[1], L[2]);
    }
    aim(lx, ly, lz) {
      const dx = lx - this.cx, dy = ly - this.cy, dz = lz - this.cz;
      this.cyaw = Math.atan2(-dx, -dz); this.cpitch = Math.atan2(dy, Math.hypot(dx, dz));
    }
    // move the player (the world streams around it) to the camera
    place() {
      const p = this.g.player, eye = p.eye || 1.62;
      p.pos[0] = this.cx; p.pos[1] = this.cy - eye; p.pos[2] = this.cz;
      p.yaw = this.cyaw; p.pitch = this.cpitch;
      if (p.vel) { p.vel[0] = 0; p.vel[1] = 0; p.vel[2] = 0; }
    }
    setCaption(text, big) {
      const c = this.ui().querySelector('.cap'); c.textContent = text || ''; c.classList.toggle('big', !!big && !!text);
    }
    // the chunks around the camera are in (no column pending, the generator and the far horizon are idle)
    ready() { const g = this.g, w = g.world; return !!w && w.pending.size === 0 && g.pool.busy < 3 && (!g.horizon || !g.horizon.inflight); }
    // enter shot i: a title card preloads the next real shot's area behind it; a real shot places its camera and waits
    enter(i) {
      const shots = this.shots;
      if (i >= shots.length) { this.stop(); return; }
      this.si = i; const shot = shots[i];
      this.t = 0; this.loadT = 0; this.tok++; this.realAt = performance.now();
      this.clearShips(); this.actors = [];
      if (shot.kind === 'title') {
        const nx = C.nextReal ? C.nextReal(i) : -1, pre = nx >= 0 ? shots[nx] : null;
        this.cardWaits = !!pre;                              // the closing card does not wait for chunks
        if (pre) { this.pose(pre, 0); this.place(); this.fov = pre.fov || 72; }
        this.phase = 'card';
        this.setCaption(shot.caption || '', true);
      } else {
        this.pose(shot, 0); this.place(); this.fov = shot.fov || 72;
        this.phase = 'load';
        this.setCaption(shot.caption || '', false);
      }
    }
    // the shot's own start: the time of day, its ships, its heroes
    startRun(shot) {
      const g = this.g;
      this.phase = 'run'; this.t = 0;
      if (shot.tod !== undefined && g.env.setTime) g.env.setTime(shot.tod);
      this.launchShips(shot);
      this.spawnActors(shot);
      this.pose(shot, 0); this.place();
    }
    spawnActors(shot) {
      const Folk = VR.Folk; this.actors = [];
      if (!Folk || !Folk.heroLook || !shot.actors) return;
      for (const a of shot.actors) this.actors.push({ look: Folk.heroLook(Object.assign({}, a.look)), pos: a.pos.slice(), yaw: a.yaw || 0, aim: !!a.aim, track: a.walk ? new C.Track(a.walk) : null, walk: 0, moving: !!a.walk });
    }
    update(dt) {
      const g = this.g;
      if (!this.active) {
        // the start screen's 🎬 Trailer: the temporary world is in — the ride starts
        if (g.trailerAfterLoad && g.state === 'play' && g.player) { g.trailerAfterLoad = false; this.play('trailer', { fromTitle: true }); }
        return;
      }
      const now = performance.now(); for (const d of this.designs.values()) if (d) d.last = now;   // the ride's ships stay in the starships' cache
      if (g.input.hit('Escape') || (this.opts && this.opts.skipAny && this.phase === 'run' && (g.input.pressed.size || g.input.mouse.clicked.some(Boolean)))) { this.stop(); return; }
      dt = Math.min(dt, 0.25);
      if (this.phase === 'next') this.enter(this.si + 1);
      if (!this.active) return;
      const shot = this.shots[this.si], fadeEl = this.ui().querySelector('.fade');
      if (this.phase === 'card') {
        // a title card: the picture behind it is black; the cut comes when the card has been shown and the next area is in
        this.t += dt; fadeEl.style.opacity = 1;
        if (this.t >= shot.dur && (!this.cardWaits || this.ready() || performance.now() - this.realAt > 12000)) this.phase = 'next';
        return;
      }
      if (this.phase === 'load') {
        // hold on black until the chunks around the camera are in (or 12 s of real time have passed)
        this.loadT += dt; fadeEl.style.opacity = 1;
        if ((this.ready() && this.loadT > (this.opts && this.opts.quick ? 0.15 : 0.4)) || performance.now() - this.realAt > 12000) this.startRun(shot);
        else { this.pose(shot, 0); this.place(); }
        return;
      }
      // run: the spline, fade in over the first 0.5 s and out over the last 0.4 s
      this.t += dt;
      const dur = shot.dur, last = this.si === this.shots.length - 1;
      this.pose(shot, Math.min(this.t, dur));
      this.place();
      this.updateActors(dt);
      const fin = clamp(this.t / 0.5, 0, 1), fout = last && this.opts && this.opts.noFadeOut ? 1 : clamp((dur - this.t) / 0.4, 0, 1);
      fadeEl.style.opacity = 1 - Math.min(fin, fout);
      if (this.t >= dur) this.phase = 'next';
    }
    updateActors(dt) {
      for (const a of this.actors) {
        if (!a.track) continue;
        const p = a.track.eval(this.t, this.b3);
        a.pos[0] = p[0]; a.pos[1] = p[1]; a.pos[2] = p[2];
        a.walk += dt * 6.5;
      }
    }
    // the heroes (the same armoured rig as the players and the villagers), drawn in the shot's opaque pass
    draw(r, E, cam) {
      const A = this.actors; if (!this.active || !A || !A.length) return;
      const g = this.g, ent = g.entities, Folk = VR.Folk;
      if (!ent || !Folk || !ent.beginVox || !ent.drawModel) return;
      const p = ent.beginVox(r, E);
      for (const a of A) {
        const dx = a.pos[0] - cam.x, dz = a.pos[2] - cam.z;
        if (dx * dx + dz * dz > 160 * 160) continue;
        const model = Folk.model(r.gl, a.look, false);
        if (!model) continue;
        const light = ent.lightAt(a.pos[0], a.pos[1] + 1.2, a.pos[2]);
        const pa = a.pose || (a.pose = { walk: 0, walkAmt: 0, swing: 0, pitch: 0, fly: false, sneak: false, aim: false });
        pa.walk = a.walk; pa.walkAmt = a.moving ? 1 : 0; pa.aim = a.aim;
        const pose = Folk.heroPose(pa);
        ent.drawModel(r, p, model, a.pos, cam, a.yaw, pose, light, DRAW_OPTS);
      }
    }
    // the fixed camera handed to the renderer (the base object is the renderer's own; nothing is allocated)
    cam(base) {
      if (!this.active) return null;
      base.x = this.cx; base.y = this.cy; base.z = this.cz; base.yaw = this.cyaw; base.pitch = this.cpitch;
      base.roll = 0; base.fov = (this.fov || 72) * DEG; base.fixed = true;
      return base;
    }
    // 📽 Zeitraffer (zeitraffer.js): the camera circles the build. o.center / o.radius: the whole build; o.focus /
    // o.extent: where it is changing now and how big that burst is — the camera drifts there and frames it; o.end: the
    // slower, wider orbit over the finished build; o.ground(x, z): the ground height (the camera stays above it).
    // Spring-damped, so a jump of the focus becomes a glide. Returns the camera {x, y, z, yaw, pitch, fov}.
    orbit(dt, o) {
      const R = Math.max(6, o.radius || 12), X = Math.max(5, o.extent || R);
      const s = this.orb || (this.orb = { a: Number.isFinite(o.angle) ? o.angle : 0.7, f: (o.focus || o.center).slice(), d: R * 2.3 + 14, el: 0.45, lift: 0 });
      const k = 1 - Math.exp(-dt * (o.end ? 0.8 : 1.5));
      const tg = o.focus || o.center;
      for (let i = 0; i < 3; i++) s.f[i] += (tg[i] - s.f[i]) * k;
      const want = o.end ? R * 2.3 + 14 : Math.min(R * 2.3 + 14, X * 2 + 16);
      s.d += (want - s.d) * k * 0.7;
      s.a += dt * (o.end ? 0.09 : 0.14);
      s.el += ((o.end ? 0.5 : 0.42) - s.el) * k;
      const ce = Math.cos(s.el), x = s.f[0] + Math.sin(s.a) * s.d * ce, z = s.f[2] + Math.cos(s.a) * s.d * ce;
      let y = s.f[1] + Math.sin(s.el) * s.d;
      if (o.ground) { const need = Math.max(0, o.ground(x, z) + 3 - y); s.lift += (need - s.lift) * Math.min(1, k * 3); y += s.lift; }
      const dx = s.f[0] - x, dy = s.f[1] - y, dz = s.f[2] - z;
      return { x, y, z, yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)), fov: (o.fov || 62) * Math.PI / 180, roll: 0, fixed: true };
    }
    orbitReset() { this.orb = null; }
  }
  VR.Director = Director;
})(VR);

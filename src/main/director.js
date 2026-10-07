// ============================================================================
// Director: the cinematic camera. `/trailer` (or the title-screen button) flies
// the trailer's six shots through the Heartland — canyon flyover with a shuttle
// and fighters, the Spire Citadel pull-back, the Sky Isles follow-cam, the Gate
// Temple approach, the Hangar Hall and the Palm City walk — with letterbox bars,
// captions and scripted ship flights. The player rides along invisibly so the
// world streams in around the camera; every shot fades in once its chunks are
// loaded. Esc stops it. Also used for the quick "orbit" shot around a village.
// ============================================================================
(function (VR) {
  'use strict';
  // the player's language (lang_de.js / lang_en.js)
  const T = (k, v, fb) => (VR.I18N ? VR.I18N.t(k, v, fb) : (fb !== undefined ? fb : k));
  const M = VR.M;
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => t * t * (3 - 2 * t);
  const v3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

  // the trailer: keys = [time, camera position, look-at]; ships = scripted flights (arch, from, via, to, offset, delay)
  const TRAILER = [
    { name: 'Ember Canyon', dur: 5.5, fov: 78, tod: 11400, keys: [[0, [-70, 168, 720], [0, 96, 330]], [5.5, [40, 132, 400], [0, 88, 140]]],
      ships: [{ arch: 'shuttle', A: [-85, 176, 760], C: [-5, 154, 560], B: [85, 120, 340], dur: 6.5, delay: 0 }, { arch: 'interceptor', A: [-115, 170, 780], C: [-25, 154, 560], B: [65, 118, 330], dur: 6.2, delay: 0.3, off: [-9, -2, 12] }, { arch: 'interceptor', A: [-55, 184, 790], C: [25, 162, 570], B: [105, 124, 350], dur: 6.2, delay: 0.5, off: [9, 3, 14] }] },
    { name: 'The Spire Citadel', dur: 5, fov: 70, tod: 11700, keys: [[0, [-372, 200, 440], [-420, 200, 380]], [5, [-282, 214, 566], [-420, 190, 380]]],
      ships: [{ arch: 'gunship', A: [-560, 230, 520], C: [-450, 236, 470], B: [-300, 246, 380], dur: 7, delay: 0.2 }, { arch: 'interceptor', A: [-570, 226, 535], C: [-455, 232, 482], B: [-305, 240, 392], dur: 7, delay: 0.4, off: [-8, -3, 10] }] },
    { name: 'Sky Isles', dur: 5.5, fov: 76, tod: 12000, keys: [[0, [140, 190, 320], [270, 160, 200]], [5.5, [400, 178, 30], [360, 150, 90]]],
      ships: [{ arch: 'shuttle', A: [165, 186, 300], C: [300, 176, 150], B: [440, 170, -10], dur: 6, delay: 0 }] },
    { name: 'The Gate Temple', dur: 4.5, fov: 74, tod: 12000, keys: [[0, [6, 98, 175], [0, 88, 40]], [4.5, [8, 88, 64], [0, 86, 20]]],
      ships: [{ arch: 'shuttle', A: [0, 108, 200], C: [0, 96, 120], B: [0, 84, 52], dur: 5.5, delay: 0 }] },
    { name: 'Hangar Hall', dur: 6, fov: 72, tod: 12000, keys: [[0, [0, 83.6, 17], [0, 84, -40]], [6, [0, 83.6, -22], [0, 84.5, -40]]] },
    { name: 'Nova Haven', dur: 9, fov: 74, tod: 11600, keys: [[0, [0, 82.6, -44], [0, 83.4, -110]], [5, [0, 82.6, -74], [0, 83.4, -140]], [9, [0, 108, -118], [0, 104, -300]]], caption: 'R9-SI', capAt: 6 },
  ];

  class Director {
    constructor(g) { this.g = g; this.active = false; this.shots = null; this.si = 0; this.t = 0; this.phase = 'idle'; this.fade = 1; this.dom = null; }
    ui() {
      if (this.dom) return this.dom;
      const d = document.createElement('div'); d.id = 'cine';
      d.innerHTML = '<div class="bar top"></div><div class="bar bot"></div><div class="fade"></div><div class="cap"></div><div class="hintc">' + T('g.chat.directorStop') + '</div>';
      document.getElementById('app').appendChild(d);
      this.dom = d; return d;
    }
    // o: quick (start as soon as the ground is there) · skipAny (any key or click ends it) · noFadeOut (the last shot
    // ends exactly where your own view begins, so the hand-over is seamless)
    play(name, o) {
      const g = this.g; if (g.state !== 'play' || !g.player) return false;
      this.opts = o || {};
      this.shots = name === 'trailer' ? TRAILER : name;
      if (!this.shots || !this.shots.length) return false;
      this.active = true; this.si = -1; this.t = 0; this.fade = 1; this.phase = 'next';
      this.saved = { pos: g.player.pos.slice(), yaw: g.player.yaw, pitch: g.player.pitch, flying: g.player.flying, hideHud: g.hideHud, camMode: g.camMode, tod: g.env.timeOfDay, freeze: g.zenFreezeTime };
      g.hideHud = true; document.getElementById('hud').style.visibility = 'hidden'; g.camMode = 0; g.zoom = false;
      g.player.flying = true; g.player.vel = [0, 0, 0]; g.player.noClip = true;
      const d = this.ui(); d.classList.add('on'); d.querySelector('.fade').style.opacity = 1; d.querySelector('.cap').textContent = '';
      g.ui.show(null); g.input.captured = true;
      if (g.ui.hint) g.ui.hint('', 1);
      return true;
    }
    stop() {
      const g = this.g; if (!this.active) return;
      this.active = false; this.phase = 'idle';
      const s = this.saved; if (s) { g.player.pos = s.pos; g.player.yaw = s.yaw; g.player.pitch = s.pitch; g.player.flying = s.flying; g.hideHud = s.hideHud; g.camMode = s.camMode; g.zenFreezeTime = s.freeze; if (s.tod !== undefined && g.env.setTime) g.env.setTime(s.tod); }
      g.player.noClip = false; g.player.vel = [0, 0, 0];
      document.getElementById('hud').style.visibility = g.hideHud ? 'hidden' : 'visible';
      if (this.dom) this.dom.classList.remove('on');
      for (const sh of (this.myShips || [])) sh.dead = true;
      this.myShips = null;
    }
    // scripted ship flights through the traffic system (designed asynchronously, so they are queued a moment ahead)
    launchShips(shot) {
      const g = this.g, T = g.traffic, SS = g.starships;
      if (!T || !SS || !shot.ships) return;
      this.myShips = this.myShips || [];
      for (const sp of shot.ships) {
        const seed = (M.hash2 ? M.hash2(sp.A[0] | 0, sp.B[2] | 0, 77) >>> 0 : (Math.random() * 4294967295) >>> 0);
        SS.design(seed, VR.Starship && VR.Starship.ARCH[sp.arch] ? sp.arch : 'shuttle', null, (d) => {
          if (!this.active) return;
          const len = Math.hypot(sp.B[0] - sp.A[0], sp.B[1] - sp.A[1], sp.B[2] - sp.A[2]);
          const ship = { d, A: sp.A.slice(), B: sp.B.slice(), C: sp.C.slice(), off: sp.off || [0, 0, 0], t: -(sp.delay || 0) / sp.dur, dur: sp.dur, speed: len / sp.dur, age: 0, heading: 0, roll: 0, pitch: 0, gear: 0, prevYaw: null, pos: sp.A.slice(), arch: d.meta.arch, big: false, fire: 99, defender: false, circle: null, life: 0, scripted: true };
          T.ships.push(ship); this.myShips.push(ship);
        });
      }
    }
    // camera for this frame: interpolated along the shot's keys
    camAt(shot, t) {
      const K = shot.keys; let i = 0;
      while (i < K.length - 2 && t > K[i + 1][0]) i++;
      const a = K[i], b = K[i + 1], u = ease(M.clamp((t - a[0]) / Math.max(1e-3, b[0] - a[0]), 0, 1));
      const pos = v3(a[1], b[1], u), look = v3(a[2], b[2], u);
      const dx = look[0] - pos[0], dy = look[1] - pos[1], dz = look[2] - pos[2];
      return { pos, yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
    }
    update(dt) {
      const g = this.g; if (!this.active) return;
      if (g.input.hit('Escape') || (this.opts && this.opts.skipAny && this.phase === 'run' && (g.input.pressed.size || g.input.mouse.clicked.some(Boolean)))) { this.stop(); return; }
      const d = this.ui(), fadeEl = d.querySelector('.fade');
      if (this.phase === 'next') {
        this.si++;
        if (this.si >= this.shots.length) { this.stop(); return; }
        const shot = this.shots[this.si];
        this.t = 0; this.phase = 'load'; this.loadT = 0;
        const c = this.camAt(shot, 0);
        g.player.pos = [c.pos[0], c.pos[1] - g.player.eye, c.pos[2]]; g.player.yaw = c.yaw; g.player.pitch = c.pitch; g.player.vel = [0, 0, 0];
        if (shot.tod !== undefined) g.env.setTime(shot.tod);
        d.querySelector('.cap').textContent = shot.capAt ? '' : (shot.caption || '');
        d.querySelector('.cap').classList.toggle('big', !!shot.caption && !shot.capSmall);
        this.launchShips(shot);
        this.fade = 1;
      }
      const shot = this.shots[this.si];
      if (this.phase === 'load') {
        // hold on black until the chunks around the camera are in (or 6 s have passed)
        this.loadT += dt;
        const w = g.world, ready = w.pending.size === 0 && g.pool.busy < 3 && (!g.horizon || !g.horizon.inflight);
        if ((ready && this.loadT > (this.opts && this.opts.quick ? 0.15 : 0.4)) || this.loadT > 6) { this.phase = 'run'; }
        const c = this.camAt(shot, 0); g.player.pos = [c.pos[0], c.pos[1] - g.player.eye, c.pos[2]]; g.player.yaw = c.yaw; g.player.pitch = c.pitch;
        fadeEl.style.opacity = 1;
        return;
      }
      // run: advance, fade in over the first 0.6 s and out over the last 0.5 s
      this.t += dt;
      const c = this.camAt(shot, this.t);
      g.player.pos = [c.pos[0], c.pos[1] - g.player.eye, c.pos[2]]; g.player.yaw = c.yaw; g.player.pitch = c.pitch; g.player.vel = [0, 0, 0];
      const last = this.si === this.shots.length - 1 && this.opts && this.opts.noFadeOut;
      const fin = M.clamp(this.t / 0.6, 0, 1), fout = last ? 1 : M.clamp((shot.dur - this.t) / 0.5, 0, 1);
      fadeEl.style.opacity = 1 - Math.min(fin, fout);
      this.fov = shot.fov || 72;
      if (shot.capAt && this.t >= shot.capAt && !this.capShown) { this.capShown = true; d.querySelector('.cap').textContent = shot.caption; }
      if (this.t >= shot.dur) { this.phase = 'next'; this.capShown = false; }
    }
    // the fixed camera handed to the renderer
    cam(base) {
      if (!this.active) return null;
      const g = this.g, p = g.player;
      return Object.assign({}, base, { x: p.pos[0], y: p.pos[1] + p.eye, z: p.pos[2], yaw: p.yaw, pitch: p.pitch, roll: 0, fov: (this.fov || 72) * Math.PI / 180, fixed: true });
    }
  }
  VR.Director = Director;
})(VR);

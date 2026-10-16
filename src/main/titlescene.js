// ============================================================================
// The living title (t-first · WOW VII; docs/superpowers/plans/2026-10-16-t-first.md): the start screen's background is
// the game's own world — the Spire Citadel at the golden hour seen from over the Ember Canyon, the low sun right of its
// spires, the ringed giant over the left, the mesas as silhouettes in the haze (the trailer's opening, t1_01 / t3_01),
// the clouds drifting, the camera arcing slowly round the citadel in a 60 s loop.
//   · no chunks: the title world is a World object for the upload queue and the horizon only — no column is ever asked
//     for; the far tiles (lod jobs from the climate functions, the far sampler) are the only worker work, the far ring is
//     off and the horizon at most level 3. Its generator: the Heartland of vgen 11 (the citadel's vgen-11 spires) without
//     the land plan (noLand: the far tiles never wait for it), a fixed seed — the citadel stands there in every seed.
//   · Very Low: one still frame of the sky dome (no world, no horizon, no workers), drawn again only when the window's
//     size changes. Low and up: the drift at 30 fps at most.
//   · the land comes out of the haze once the far ring stands (the fog eased back over 2.5 s); until the first frame the
//     start screen's CSS backdrop (#title .tbg) stands behind the tiles and fades away then.
//   · everything is released when a world opens (game.teardownWorld → destroy: the tiles, the world, the queue).
// ============================================================================
(function (VR) {
  'use strict';
  const TS = VR.TitleScene = {};
  TS.LOOP = 60;                 // seconds: one arc out and back
  TS.FPS = 30;                  // the drift's frame cap
  TS.TOD = VR.First ? VR.First.GOLD : 10800;   // the golden hour (t-light2's: the sun 7.4° high, in the west-south-west)
  TS.SEED = 4242;
  TS.HZ_MAX = 3;                // the horizon level at most (3 km)
  TS.REVEAL = 2.5;              // seconds: the land out of the haze
  TS.genOpts = () => ({ vgen: 11, noLand: true, noCrystal: true });
  TS.mode = (S) => (S && (S.preset === 'potato' || S.lite) ? 'still' : 'drift');
  TS.due = (acc) => acc >= 1 / TS.FPS - 1e-4;
  // the camera: an arc round the citadel (HEART.CITADEL) at ~300 blocks, from the east-south-east — the view's yaw 120° ± 6°
  // (the sun at 10800 stands 29–41° right of it, the giant 31–43° left), 170 ± 6 high over the canyon, the distance
  // breathing ± 12; the pitch 10° up, so the spires stand in the lower middle and the sky with the giant fills the top
  const DEG = Math.PI / 180;
  TS.VIEW = { yaw: 120 * DEG, amp: 6 * DEG, dist: 300, dd: 12, h: 170, dh: 6, look: 178, pitch: 10 * DEG, fov: 66 * DEG };
  TS.cam = function (t, out) {
    const H = VR.Heart && VR.Heart.CITADEL ? VR.Heart.CITADEL : { x: -420, z: 380, y: 112 }, V = TS.VIEW, w = 2 * Math.PI * t / TS.LOOP;
    const yaw = V.yaw + V.amp * Math.sin(w), d = V.dist + V.dd * Math.sin(w + 1.3), y = V.h + V.dh * Math.sin(w + 2.1);
    const o = out || {};
    o.x = H.x + Math.sin(yaw) * d; o.z = H.z + Math.cos(yaw) * d; o.y = y;   // (forward is (−sin yaw, −cos yaw): the camera stands d behind the citadel)
    o.yaw = yaw; o.pitch = V.pitch + Math.atan2(V.look - y, d) * 0.25; o.fov = V.fov; o.roll = 0;
    return o;
  };

  class Scene {
    constructor(g) {
      this.g = g; this.t = 0; this.acc = 1e9; this.mode = TS.mode(g.settings); this.drawn = 0; this.ready = false; this.reveal = 0; this.landAt = 0;
      this.cam = TS.cam(0, {}); this.lastW = 0; this.lastH = 0; this.t0 = performance.now();
      const env = g.env;
      env.wx.setSeed(null);                   // the title has no weather: clear
      env.setTime(TS.TOD); env.day = 0;
      if (this.mode === 'drift') {
        g.pool.broadcast({ type: 'init', seed: TS.SEED, opts: TS.genOpts(), custom: VR.CUSTOM });
        this.world = new VR.World(g, { dim: 'overworld', seed: TS.SEED, genOpts: TS.genOpts(), pool: g.pool, renderer: g.renderer, renderDist: 2 });
        g.world = this.world;
        const hz = g.horizon;
        if (hz) { hz.setFar(0); hz.setLevel(Math.max(1, Math.min(TS.HZ_MAX, (g.settings && g.settings.horizon) || TS.HZ_MAX))); }
      } else g.world = null;
    }
    // the far ring and the tiles near the camera stand: the land may come out of the haze
    landReady() {
      const hz = this.g.horizon;
      if (!hz || !hz.enabled()) return true;
      return (hz.stats.coarse || 0) >= 1 && hz.progress() >= 0.9;
    }
    frame(dt) {
      const g = this.g, r = g.renderer; if (!r) return;
      const sized = r.W !== this.lastW || r.H !== this.lastH;
      if (this.mode === 'still') {
        // one frame of the sky dome; again only when the drawing buffer was cleared by a new size
        if (this.drawn && !sized && !(r.canvas && (r.canvas.width !== r.W || r.canvas.height !== r.H))) return;
        this.draw(0); return;
      }
      this.t += dt; this.acc += dt;
      const w = this.world, now = performance.now(), hz = g.horizon;
      // (the settings may set the preset's horizon again meanwhile: the title keeps its own — no far ring, level ≤ 3)
      if (hz && w) { if (hz.farOn && hz.farOn()) hz.setFar(0); if (hz.level > TS.HZ_MAX) hz.setLevel(TS.HZ_MAX); }
      // the upload queue and the workers keep going every frame (no column requests: w.update is never called)
      if (w) { if (w.lastUpd !== undefined && now > w.lastUpd) w.uploadQ.frame(now - w.lastUpd, now); w.lastUpd = now; w.drainUploads(this.cam.x, this.cam.z, now); g.pool.pump(); }
      if (!this.landAt && (this.landReady() || now - this.t0 > 12000)) this.landAt = now;
      if (this.landAt) this.reveal = Math.min(1, (now - this.landAt) / 1000 / TS.REVEAL);
      if (!TS.due(this.acc) && !sized) return;   // (30 fps: the frame between keeps the last picture; the horizon asks again at the next)
      this.acc = 0;
      this.draw(this.t % TS.LOOP);
    }
    draw(t) {
      const g = this.g, r = g.renderer, c = TS.cam(t, this.cam);
      c.far = this.world ? g.farFor(this.world) : 1200;
      const E = g.envFor([c.x, c.y, c.z], 1 / TS.FPS, { freezeTime: true, freezeWeather: true });
      // the land comes out of the haze: the fog's start and end eased from the camera out to their own (smoothstep)
      if (this.world && this.reveal < 1 && E.fog && E.fog[3] !== 1) {
        const k = this.reveal * this.reveal * (3 - 2 * this.reveal);
        this.fogKeep = this.fogKeep || [0, 0, 0, 0];
        const f = this.fogKeep; f[0] = E.fog[0] * k; f[1] = 1 + (E.fog[1] - 1) * k; f[2] = E.fog[2] + (0.02 - E.fog[2]) * (1 - k); f[3] = 0;
        E.fog = f;
      }
      if (g.horizon && this.world) g.horizon.update(c);
      r.render({ cam: c, world: this.world || null, env: E, horizon: this.world ? g.horizon : null });
      this.lastW = r.W; this.lastH = r.H; this.drawn++;
      if (!this.ready) { this.ready = true; const tt = document.getElementById('title'); if (tt) tt.classList.add('live'); g.titleReadyMs = performance.now() - (g.bootT0 || this.t0); }
    }
    // what the title costs: the heap, the GPU (the chunk arenas — none here — and the horizon's tiles)
    cost() { const g = this.g, hz = g.horizon; return { mode: this.mode, frames: this.drawn, hzMB: hz ? +hz.stats.mb.toFixed(2) : 0, hzTiles: hz ? hz.stats.tiles : 0, arenaMB: g.renderer ? +g.renderer.gpuMemoryMB().toFixed(2) : 0, cols: this.world ? this.world.cols.size : 0, reveal: +this.reveal.toFixed(2) }; }
    destroy() {
      const g = this.g;
      if (this.world) { if (g.world === this.world) g.world = null; this.world.destroy(); this.world = null; }
      if (g.horizon) { g.horizon.reset(); const S = g.settings || {}; g.horizon.setLevel(S.horizon); if (g.horizon.setFar) g.horizon.setFar(S.far || 0); }
      const tt = document.getElementById('title'); if (tt) tt.classList.remove('live');
    }
  }
  TS.Scene = Scene;

  // ---------------------------------------------------------------- hooks into game.js (one wrapper each)
  const G = VR.Game; if (!G) return;
  const origStart = G.prototype.startTitle;
  G.prototype.startTitle = function () {
    if (!this.renderer || !this.pool || !this.env) return origStart.call(this);
    this.state = 'title';
    this.teardownWorld();
    this.titleScene = new Scene(this);
    this.ui.show('title');
    if (this.ui.studioNote) this.ui.studioNote();
  };
  // (the old panorama never runs: between a world's start and its first loading frame the canvas keeps the title's last
  // picture instead of streaming the new world round the title's camera)
  G.prototype.titleFrame = function (dt) { if (this.titleScene) this.titleScene.frame(dt); };
  const origTear = G.prototype.teardownWorld;
  G.prototype.teardownWorld = function () { if (this.titleScene) { const s = this.titleScene; this.titleScene = null; s.destroy(); } return origTear.call(this); };
})(VR);

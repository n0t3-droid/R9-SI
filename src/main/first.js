// ============================================================================
// Die erste Minute (t-first · WOW VII; docs/superpowers/plans/2026-10-16-t-first.md): what a new player sees first.
//   · the spawn of a new world: the vista point whose landmark scores highest (gen_vista.js's records, a worker job
//     'vistas'), the feet on the spur's walk facing the picture, at the golden hour (the sun 7.4° high — t-light2's —
//     in the evening or its morning mirror, whichever puts the sun into the picture), clear weather for the first day;
//     only for worlds made from the start screen (createWorld({ first: true })) with the setting „Start auf dem
//     Aussichtspunkt" on, no Studio landing and no 📍 spawn point for them (landing.js keeps priority); old worlds and
//     worlds made by code keep the generator's spawn
//   · the arrival: no black cut — a white veil over the picture fading in 2 s with the sun's flare (a CSS glow at the
//     sun's place on the screen), then the first wow moment at once (wowmoment.js: the swing, the swell, the caption),
//     then the HUD fades in; the player stands meanwhile; any key skips
//   · the loading screen's phases: generated → meshed → uploaded → the far land, one sentence each (German first),
//     the counts under the bar, the sky behind it, never longer than the world needs
// ============================================================================
(function (VR) {
  'use strict';
  const tx = (k, v, de, en) => (VR.I18N && VR.I18N.tx ? VR.I18N.tx(k, v, de, en) : de);
  const FI = VR.First = {};
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const ang = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  const smooth = (x) => { const t = clamp01(x); return t * t * (3 - 2 * t); };

  // ---------------------------------------------------------------- the clock
  // the golden hour of t-light2 (light2.mjs's 'golden': ticks 10800, the sun 7.4° over the horizon) and its morning
  // mirror about noon (6000 − 4800 = 1200): the same height, the same warm light (env.js and light2 grade by the sun's
  // height), the sun in the west-south-west in the evening, in the south-east under the ringed giant in the morning
  FI.GOLD = 10800; FI.GOLD_AM = 1200;
  // the sun's direction at a time of day — env.js's formula ("eternal dusk": a low arc, ~24° at noon)
  FI.sunAt = function (tod) {
    const th = (((tod % 24000) + 24000) % 24000) / 24000 * Math.PI * 2, el = Math.sin(th) * 0.42, az = th + 0.4;
    const v = [Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)], l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  };
  const yawOf = (d) => Math.atan2(-d[0], -d[2]);   // the camera's yaw that looks along d (forward = (−sin yaw, ·, −cos yaw))
  // the golden hour whose sun stands nearer the view's middle: then the sun (and its flare) is in the picture if it can be
  FI.clock = (yaw) => (Math.abs(ang(yaw - yawOf(FI.sunAt(FI.GOLD)))) <= Math.abs(ang(yaw - yawOf(FI.sunAt(FI.GOLD_AM)))) ? FI.GOLD : FI.GOLD_AM);
  // clear weather until the end of the start day (weather.js clearUntil, absolute ticks day × 24000 + time)
  FI.clearUntil = (day) => ((day | 0) + 1) * 24000;

  // ---------------------------------------------------------------- the vista
  // f-arrival (R50-02, docs/superpowers/plans/2026-10-23-f-arrival.md): the wow vista the sight test passed (gen_vista.js
  // VISTA.arrivals, the worker's records: its landmark ≥ 8 % of the arrival's frame, ≤ 10 % of it hidden, nothing within
  // 6 m in the frame's upper half) with the highest score; none passed (or no sight measured: an older worker) → the
  // highest score, as before (the landmark's weight × its size in the eye × the rise × the side view); ties by id; null
  // when there is none (no vistas: a vgen ≤ 10 world, outside the Heartland)
  FI.pick = function (list) {
    if (!Array.isArray(list)) return null;
    const better = (v, b) => !b || v.score > b.score || (v.score === b.score && String(v.id) < String(b.id));
    let best = null, ok = null;
    for (const v of list) if (v && v.wow && Number.isFinite(v.score)) { if (better(v, best)) best = v; if (v.sight && v.sight.ok && better(v, ok)) ok = v; }
    return ok || best;
  };
  // the record the arrival's wow moment plays: the vista with the sight test's camera (aimed at the landmark, the lens
  // narrowed until it fills a tenth of the frame), the vista's own composition kept as `look` (the eyes after the moment)
  FI.arrivalOf = function (v) {
    const a = v && v.arrive, A = Object.assign({}, v, { look: { yaw: v.yaw, pitch: v.pitch } });
    if (a && Array.isArray(a.eye) && Number.isFinite(a.yaw) && Number.isFinite(a.pitch) && a.fov > 0) Object.assign(A, { eye: a.eye.slice(0, 3), yaw: a.yaw, pitch: a.pitch, fov: a.fov });
    return A;
  };
  // the feet on the spur's walk: its axis 2.5 blocks out from the way's middle (past the way's own cells, between the
  // low walls, within the wow trigger's reach), on the paving (the walk's floor is at the way's level)
  // f-first3 (R55-12, critic_ux_v054_05_t15: the first picture a bench and two walls — a walled nook): the feet on the open
  // way itself, 1 m before the walk's mouth, facing the vista — the walk's low walls lead from the frame's lower corners to
  // the bench and the landmark, nothing within 3 m in the centre third (test/first3.js, critic_ux's view3)
  FI.WALK_T = -1;
  FI.feet = (v) => { const u = v.u || [0, 0]; return [v.x + 0.5 + u[0] * FI.WALK_T, v.y + 1, v.z + 0.5 + u[1] * FI.WALK_T]; };
  FI.spawn = (v) => (v ? { pos: FI.feet(v), yaw: v.yaw, pitch: v.pitch, vista: v } : null);

  // ---------------------------------------------------------------- the loading screen's phases
  const PHASE = {
    'g.load.p.gen': ['Die Hügel werden geformt …', 'Shaping the hills …'],
    'g.load.p.mesh': ['Die Stadt wird gebaut …', 'Building the town …'],
    'g.load.p.up': ['Das Licht wird gesetzt …', 'Setting the light …'],
    'g.load.p.far': ['Die Ferne wird gemalt …', 'Painting the distance …'],
  };
  FI.PHASE = PHASE;
  FI.phaseKey = (p) => (p.gen < 1 ? 'g.load.p.gen' : p.mesh < 1 ? 'g.load.p.mesh' : p.up < 1 ? 'g.load.p.up' : 'g.load.p.far');
  FI.phaseText = (p) => { const k = FI.phaseKey(p), d = PHASE[k]; return tx(k, null, d[0], d[1]); };
  FI.countsText = (c) => tx('g.load.counts', { g: c.cols, gn: c.colsNeed, m: c.secMesh, u: c.secUp, n: c.secNeed }, 'Erzeugt {g}/{gn} · Gebaut {m}/{n} · Hochgeladen {u}/{n}', 'Generated {g}/{gn} · Built {m}/{n} · Uploaded {u}/{n}');
  FI.loadFrac = (p) => clamp01(0.3 * clamp01(p.gen) + 0.3 * clamp01(p.mesh) + 0.2 * clamp01(p.up) + 0.2 * clamp01(p.far));
  // the needed sections: the (2R + 1)² columns round the spawn; of the arrived ones the sections with blocks — meshed
  // when their mesh came back (not dirty, not in a job), uploaded when it is on the GPU (meshed); a column still missing
  // counts as the arrived ones' mean
  FI.NEAR_R = 2;
  FI.progress = function (w, pcx, pcz, R) {
    R = R === undefined ? FI.NEAR_R : R;
    let cols = 0, need = 0, sec = 0, mesh = 0, up = 0;
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      need++;
      const c = w.col(pcx + dx, pcz + dz); if (!c) continue;
      cols++;
      for (const s of c.sec) { if (!(s.count > 0)) continue; sec++; if (!s.dirty && !s.pending) { mesh++; if (s.meshed) up++; } }
    }
    const per = cols ? sec / cols : 16, secNeed = Math.round(sec + (need - cols) * per);
    const gen = need ? cols / need : 1;
    return { cols, colsNeed: need, secNeed, secMesh: mesh, secUp: up, gen, mesh: secNeed ? Math.min(gen, mesh / secNeed) : gen, up: secNeed ? Math.min(gen, up / secNeed) : gen };
  };
  // when the loading screen ends: the near sections up and the coarse far ring there — the ring gets 6 s after the near
  // sections (an arrival 12 s: its landmark stands in the far tiles), 25 s in all at most
  FI.NEAR_WAIT = 6000; FI.ARRIVAL_WAIT = 12000; FI.MAX_WAIT = 25000;
  FI.loadDone = (s) => (s.now - s.start > FI.MAX_WAIT) || (!!s.near && (s.far >= 1 || s.now - s.nearAt > (s.arrival ? FI.ARRIVAL_WAIT : FI.NEAR_WAIT)));
  // one loading frame's numbers for the game (game.js loadingFrame): {frac, text, counts, done}
  FI.loadStep = function (g) {
    const p = g.player, w = g.world, now = performance.now();
    const pr = FI.progress(w, Math.floor(p.pos[0]) >> 4, Math.floor(p.pos[2]) >> 4, FI.NEAR_R);
    const hz = g.horizon && g.horizon.enabled() ? g.horizon : null;
    pr.far = hz ? (hz.stats.coarse === undefined ? 0 : hz.stats.coarse) : 1;
    const near = pr.gen >= 1 && pr.mesh >= 1 && pr.up >= 1;
    if (near && !g.nearReadyAt) g.nearReadyAt = now;
    if (!near) g.nearReadyAt = 0;
    return { frac: 0.05 + FI.loadFrac(pr) * 0.95, text: FI.phaseText(pr), counts: FI.countsText(pr), done: FI.loadDone({ near, far: pr.far, nearAt: g.nearReadyAt, now, start: g.loadStart || now, arrival: !!g.arrivalPending }), pr };
  };

  // ---------------------------------------------------------------- the arrival
  // (first.mjs run 1: the veil opened on the player's own eyes — the spur's wall, the held block and the hand filled the
  // first picture — and then swung to the composition and back. Now: the white rises over the loading screen (IN), the
  // world opens under it, the veil opens on the vista's composition itself — the wow moment's camera from its first frame,
  // held while the white thins, its caption coming as the white goes — then the moment's hold and its way down into the
  // player's eyes; the hand, the outline and the minimap stay away until the HUD fades in)
  FI.PRE = 2; FI.FLARE = 0.6; FI.SKIP = 0.3; FI.HUD_IN = 1.2; FI.IN = 0.4;
  // the white veil: 1 → 0 over PRE seconds, slow at first (the white lingers), then the picture comes
  FI.veil = (t) => 1 - smooth(t / FI.PRE);
  // the white rising over the loading screen: 0 → 1 over IN seconds
  FI.whiteIn = (t) => smooth(t / FI.IN);
  // the sun's flare: full while the white is thick, gone FLARE seconds after it
  FI.flare = (t) => 1 - smooth((t - FI.PRE * 0.35) / (FI.PRE * 0.65 + FI.FLARE));
  // the place's caption while the white thins: none while it is thick, full when it is gone
  FI.capVeil = (v) => clamp01((0.6 - v) / 0.45);
  // a direction d on the screen of a camera {yaw, pitch, fov (vertical)}: [x, y] in 0..1 (y down), null behind it or far
  // outside the frame — the flare's place (the renderer's own projection: forward (−sin yaw, ·, −cos yaw))
  FI.sunScreen = function (d, cam, aspect) {
    const cp = Math.cos(cam.pitch), f = [-Math.sin(cam.yaw) * cp, Math.sin(cam.pitch), -Math.cos(cam.yaw) * cp], rx = [Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)];
    const up = [rx[1] * f[2] - rx[2] * f[1], rx[2] * f[0] - rx[0] * f[2], rx[0] * f[1] - rx[1] * f[0]];
    const z = d[0] * f[0] + d[1] * f[1] + d[2] * f[2]; if (!(z > 0.01)) return null;
    const th = Math.tan(cam.fov / 2), x = (d[0] * rx[0] + d[1] * rx[1] + d[2] * rx[2]) / z / (th * (aspect || 16 / 9)), y = (d[0] * up[0] + d[1] * up[1] + d[2] * up[2]) / z / th;
    const sx = 0.5 + x / 2, sy = 0.5 - y / 2;
    return sx > -0.1 && sx < 1.1 && sy > -0.1 && sy < 1.1 ? [sx, sy] : null;
  };
  // the wow moment plays for this arrival: the setting on, the vista one that swings
  const momentOn = (g, v) => !!(g.wow && v && v.wow !== false && (!g.settings || g.settings.wowMoments !== false));
  // the camera the loading screen draws its sky with: the composition the veil opens on (an arrival), else the eyes
  FI.loadCam = function (g) {
    const p = g.player, S = g.settings || {}, A = g.arrivalPending, v = A && A.vista;
    if (v && v.eye && S.wowMoments !== false) return { x: v.eye[0], y: v.eye[1], z: v.eye[2], yaw: v.yaw, pitch: v.pitch, fov: v.fov * Math.PI / 180 };
    return { x: p.pos[0], y: p.pos[1] + p.eye, z: p.pos[2], yaw: p.yaw, pitch: p.pitch, fov: (S.fov || 75) * Math.PI / 180 };
  };
  const anyKey = (I) => !!I && (I.pressed.size > 0 || (I.mouse && I.mouse.clicked && I.mouse.clicked.some(Boolean)) || (I.padPressed && I.padPressed.size > 0) || (I.tPressed && I.tPressed.size > 0));
  // f-first (review v0.52 R53-06: on a slow machine the arrival ran on frames — 0.1 s of it a frame at 3 fps, half a
  // minute of white): it runs on the wall clock (a frame counts at most WALL_STEP s), any key — or a key still held,
  // W included — ends it in every phase, and MAX_WALL seconds after its start it is over whatever the frame rate
  FI.MAX_WALL = 7; FI.WALL_STEP = 0.5;
  const heldKey = (I) => !!I && ((I.keys && I.keys.size > 0) || (I.padDown && I.padDown.size > 0) || (I.tDown && I.tDown.size > 0));
  const wallNow = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
  class Arrival {
    // o: {vista (the record of the wow moment to play, or null), sun: [x, y] of the sun on the screen (0..1, y down) or null}
    // phases: in (the white rising over the loading screen) → full → veil (the picture through the thinning white) →
    // moment (the wow moment's hold and its way back to the eyes) → done; out: a key — the white goes in SKIP seconds
    constructor(g, o) { this.g = g; this.v = (o && o.vista) || null; this.sun = (o && o.sun) || null; this.phase = 'new'; this.t = 0; this.k = 0; this.from = 1; this.dom = null; this.first = true; this.on = false; this.saved = null; }
    holds() { return this.phase === 'in' || this.phase === 'full' || this.phase === 'veil' || this.phase === 'out'; }
    veilNow() { return this.phase === 'in' ? FI.whiteIn(this.t) : this.phase === 'full' ? 1 : this.phase === 'veil' ? FI.veil(this.t) : this.phase === 'out' ? this.from * (1 - clamp01(this.k / FI.SKIP)) : 0; }
    // over the loading screen: the white rises (game.js loadingFrame holds the world back meanwhile — FI.holdLoading)
    rise() { this.phase = 'in'; this.t = 0; this.ui(); this.paint(); }
    // the frame's step on the wall clock: never less than the game's dt, at most WALL_STEP (a stall is not a skip)
    wallDt(dt) { const n = wallNow(), w = this.lastW ? (n - this.lastW) / 1000 : dt; this.lastW = n; return Math.min(FI.WALL_STEP, Math.max(dt, w)); }
    stepIn(dt) { dt = this.wallDt(dt); this.t += dt; if (this.t >= FI.IN) { this.phase = 'full'; this.t = 0; } this.paint(); return this.phase === 'in'; }
    begin() {
      const g = this.g, v = this.v;
      this.phase = 'veil'; this.t = 0; this.first = true; this.t0w = wallNow(); this.lastW = this.t0w;
      const hud = document.getElementById('hud'); if (hud) { hud.style.transition = 'none'; hud.style.opacity = '0'; }
      if (!this.saved) { this.saved = { hideHud: g.hideHud }; g.hideHud = true; }   // (the hand, the block outline, the minimap)
      // the moment from the first frame: its camera at the composition, the clock held at the rise's end while the white
      // thins (update); without it the veil opens on the eyes — the vista seen all the same (no swing when walking off)
      this.on = momentOn(g, v);
      if (this.on) { g.wow.wait = 0; g.wow.start(v); g.wow.t = VR.WowMoment.RISE; }
      else if (v && VR.WowMoment) { VR.WowMoment.mark(g.meta, v.id); if (g.saveMeta) { try { g.saveMeta(); } catch (e) { /* the next autosave */ } } }
      this.ui(); this.paint();
    }
    ui() {
      if (this.dom || typeof document === 'undefined') return this.dom;
      const d = document.createElement('div'); d.id = 'arrival';
      d.style.cssText = 'position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:28';
      const glow = document.createElement('div'), white = document.createElement('div');
      glow.style.cssText = 'position:absolute;left:0;top:0;right:0;bottom:0;display:none';
      white.style.cssText = 'position:absolute;left:0;top:0;right:0;bottom:0;background:#fffaf2;opacity:0';
      d.appendChild(glow); d.appendChild(white);
      (document.getElementById('app') || document.body).appendChild(d);
      this.dom = d; this.glow = glow; this.white = white; this.sunSet = null;
      return d;
    }
    paint() {
      if (!this.dom) return;
      if (this.sun && this.sunSet !== this.sun) {
        this.sunSet = this.sun;
        const sx = (this.sun[0] * 100).toFixed(1), sy = (this.sun[1] * 100).toFixed(1);
        this.glow.style.background = 'radial-gradient(circle at ' + sx + '% ' + sy + '%, rgba(255,250,232,1) 0%, rgba(255,226,170,0.85) 5%, rgba(255,190,120,0.42) 14%, rgba(255,160,96,0.14) 30%, rgba(255,150,90,0) 52%)';
        this.glow.style.display = 'block';
      }
      const v = this.veilNow(), f = this.phase === 'in' || this.phase === 'full' ? 0 : this.phase === 'veil' ? FI.flare(this.t) : this.phase === 'out' ? v : this.phase === 'moment' ? FI.flare(FI.PRE + this.t) : 0;
      this.white.style.opacity = v.toFixed(3); this.glow.style.opacity = Math.max(0, f).toFixed(3);
      // the caption only as the white goes (the wow actor set it this frame from its own clock)
      const W = this.g.wow;
      if (this.on && W && W.dom && this.phase === 'veil') W.dom.style.opacity = Math.min(+W.dom.style.opacity || 0, FI.capVeil(v)).toFixed(3);
    }
    update(dt) {
      const g = this.g, WM = VR.WowMoment;
      const d = this.wallDt(dt);
      // (f-first) over at the latest MAX_WALL seconds after it began; a key in the moment ends the moment too
      if (this.t0w && (wallNow() - this.t0w) / 1000 > FI.MAX_WALL) { this.end(); return; }
      if (this.phase === 'moment' && !this.first && (anyKey(g.input) || heldKey(g.input))) { this.end(); return; }
      if (this.phase === 'veil') {
        this.t += d;
        if ((anyKey(g.input) || heldKey(g.input)) && !this.first) { this.skip(); return; }
        this.first = false;
        if (this.on && g.wow && g.wow.active === this.v) g.wow.t = WM.RISE;   // (the picture holds while the white thins)
        if (this.t >= FI.PRE) { this.phase = 'moment'; this.t = 0; if (!(this.on && g.wow && g.wow.active)) { this.finish(); return; } }
        this.paint();
      } else if (this.phase === 'out') {
        this.k += d; this.paint();
        if (this.k >= FI.SKIP) { if (this.on && g.wow && g.wow.active) { this.phase = 'moment'; this.t = FI.FLARE + FI.PRE; this.paint(); } else this.finish(); }
      } else if (this.phase === 'moment') {
        this.t += d; this.paint();
        if (this.on && g.wow && g.wow.active && d > dt) g.wow.t += d - dt;   // (f-first: the moment on the wall clock too — wow.update gave it dt)
        if (!(g.wow && g.wow.active)) this.finish();
      }
    }
    // (f-first) the end now: the moment stopped (the view back at the eyes), the white gone, the HUD in
    end() { const g = this.g; if (g.wow && g.wow.active && g.wow.stop) { try { g.wow.stop(); } catch (e) { /* the moment */ } } this.finish(); }
    // a key while the white is there: it goes in SKIP seconds, the camera turns back to the eyes from where it is
    skip() {
      const g = this.g;
      if (this.phase !== 'veil') return;
      this.from = FI.veil(this.t); this.k = 0; this.phase = 'out';
      if (this.on && g.wow && g.wow.active) { if (g.wow.stop) g.wow.stop(); else g.wow.skip(); }   // (f-first: a key ends it — the eyes under the going white, no swing back)
      this.paint();
    }
    restore() {
      const g = this.g;
      if (this.saved) { g.hideHud = this.saved.hideHud; this.saved = null; }
      return typeof document !== 'undefined' ? document.getElementById('hud') : null;
    }
    finish() {
      this.phase = 'done';
      if (this.dom) { this.dom.remove(); this.dom = null; }
      const hud = this.restore();
      if (hud) {
        hud.style.visibility = this.g.hideHud ? 'hidden' : 'visible';
        hud.style.transition = 'opacity ' + FI.HUD_IN + 's ease'; hud.style.opacity = '1';
        if (typeof setTimeout === 'function') setTimeout(() => { if (hud.style.opacity === '1') { hud.style.transition = ''; hud.style.opacity = ''; } }, FI.HUD_IN * 1000 + 200);
      }
      if (this.g.arrival === this) this.g.arrival = null;
    }
    destroy() { this.phase = 'done'; if (this.dom) { this.dom.remove(); this.dom = null; } const hud = this.restore(); if (hud) { hud.style.transition = ''; hud.style.opacity = ''; } }
  }
  FI.Arrival = Arrival;

  // ---------------------------------------------------------------- the game's side
  // a world made from the start screen: it may open on a vista (decided when it starts — the setting, the vgen, the type)
  FI.mark = function (g, meta) { if (meta && !meta.guest) meta.vistaStart = 1; };
  FI.want = function (g, meta) {
    if (!meta || meta.vistaStart !== 1 || meta.player || meta.guest || meta.type === 'flat' || (meta.vgen | 0) < 11) return false;
    if (g.settings && g.settings.vistaStart === false) return false;
    const LD = VR.Landing, o = LD ? LD.read(meta.id) : {};
    return !(o && (o.landing || o.spawn));   // (the Studio's landing and 📍 spawn point come first)
  };
  // the vista records of the world from a worker (the land plan is made there anyway for the first chunks)
  FI.vistas = (g, dim) => new Promise((res) => {
    let done = false; const fin = (v) => { if (!done) { done = true; res(v); } };
    setTimeout(() => fin([]), 30000);
    try { g.pool.direct(0, { type: 'vistas', dim }, null, (m) => fin(m && m.type === 'vistas' && Array.isArray(m.list) ? m.list : [])); } catch (e) { fin([]); }
  });
  // startWorld's spawn for a new world (game.js): the vista's spawn record with the clock and the weather set, or null
  FI.spawnFor = async function (g, meta, dim) {
    if (!FI.want(g, meta)) return null;
    meta.vistaStart = 2;   // (decided: the next start of this world is an ordinary one)
    const v = FI.pick(await FI.vistas(g, dim));
    if (g.meta !== meta) return null;
    // f-first (R53-09): an Abenteuer world starts 200–300 m from its first outpost, facing it, in the morning
    if (FI.advWorld(meta)) {
      const r = await FI.outpostStart(g, dim, v ? FI.feet(v) : [0, 0, 0]);
      if (r && r.pos && g.meta === meta) {
        g.env.setTime(FI.ADV_TOD); meta.time = FI.ADV_TOD;
        meta.clearUntil = FI.clearUntil(g.env.day | 0); g.env.wx.clearUntil = meta.clearUntil;
        meta.advStart = { out: r.out, d: r.d };
        return { pos: r.pos, yaw: r.yaw, pitch: -0.06 };
      }
    }
    if (!v) return null;
    // (the arrival's camera faces the landmark's middle: the feet face it too, at the walk's own pitch)
    const A = FI.arrivalOf(v), sp = { pos: FI.feet(v), yaw: A.yaw, pitch: v.pitch, vista: A }, tod = FI.clock(A.yaw);
    g.env.setTime(tod); meta.time = tod;
    meta.clearUntil = FI.clearUntil(g.env.day | 0); g.env.wx.clearUntil = meta.clearUntil;
    meta.vistaId = v.id;
    g.arrivalPending = { vista: A };
    return sp;
  };
  // f-first (R53-09): a world made with Spielweg „Abenteuer" (adventure.js marks it when the world is there — before
  // that its create choice waits in pendingCreate) starts near its first outpost in the morning: the sun 7.4° up in the
  // east (t-light2's golden mirror), nine minutes of day ahead instead of one
  FI.ADV_TOD = FI.GOLD_AM;
  FI.advWorld = (meta) => !!(meta && meta.adventure && meta.adventure.on) || !!(VR.Adventure && VR.Adventure.pendingCreate && Date.now() - VR.Adventure.pendingCreate.at < 120000);
  FI.outpostStart = (g, dim, ref) => new Promise((res) => {
    let done = false; const fin = (v) => { if (!done) { done = true; res(v); } };
    setTimeout(() => fin(null), 20000);
    try { g.pool.direct(0, { type: 'outpostStart', dim, x: Math.floor(ref[0]), z: Math.floor(ref[2]) }, null, (m) => fin(m && m.type === 'outpostStart' ? m.r : null)); } catch (e) { fin(null); }
  });
  // a world's start: its first day's clear sky again after a reload on that day
  FI.onLoad = function (g, meta) { if (meta && meta.clearUntil > 0 && g.env && g.env.wx) g.env.wx.clearUntil = meta.clearUntil; };
  // the loading screen's last moments (game.js loadingFrame, the world ready): an arrival's white rises over it first —
  // true while it rises (the world waits under the loading screen), false once it stands (or for any other world)
  FI.holdLoading = function (g, done, dt) {
    if (!done) return false;
    if (g.arrivalPending && !g.arrival && VR.First2 && VR.First2.vistaBack) { try { VR.First2.vistaBack(g, g.arrivalPending.vista); } catch (e) { /* the spawn stays */ } }   // (f-first4: one block back on the way, unseen)
    if (g.arrivalPending && !g.arrival) { const A = new Arrival(g, { vista: g.arrivalPending.vista }); g.arrival = A; A.rise(); return true; }
    const A = g.arrival;
    return !!(A && A.phase === 'in' && A.stepIn(dt));
  };
  // the loading screen's end: the arrival begins — the sun's place on the screen from the camera the veil opens on
  FI.arrive = function (g) {
    const A0 = g.arrivalPending; g.arrivalPending = null;
    if (!A0) return null;
    let A = g.arrival;
    if (!A || A.phase === 'done' || A.v !== A0.vista) { if (A) A.destroy(); A = g.arrival = new Arrival(g, { vista: A0.vista }); }
    let sun = null;
    try {
      const s = g.env && g.env.E && g.env.E.sunDir, v = A0.vista, p = g.player, r = g.renderer;
      const cam = momentOn(g, v) && v.eye ? { yaw: v.yaw, pitch: v.pitch, fov: v.fov * Math.PI / 180 } : p ? { yaw: p.yaw, pitch: p.pitch, fov: ((g.settings && g.settings.fov) || 75) * Math.PI / 180 } : null;
      if (s && cam && s[1] > -0.02) sun = FI.sunScreen(s, cam, r && r.H ? r.W / r.H : 16 / 9);
    } catch (e) { sun = null; }
    A.sun = sun;
    A.begin();
    return A;
  };

  // a world that goes (quit, another world) takes its arrival with it
  if (VR.Game) { const orig = VR.Game.prototype.teardownWorld; VR.Game.prototype.teardownWorld = function () { if (this.arrival) { this.arrival.destroy(); this.arrival = null; } this.arrivalPending = null; return orig.call(this); }; }

  // ⚙ Spiel → „Start auf dem Aussichtspunkt" (on by default)
  if (VR.Settings && VR.Settings.add) VR.Settings.add({ key: 'vistaStart', g: 'play', sec: 'play', t: 'switch', lab: 'g.set.vistaStart', tip: 'g.set.vistaStart.tip', def: true });
})(VR);

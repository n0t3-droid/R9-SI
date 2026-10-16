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
  // the wow vista whose landmark scores highest (gen_vista.js's score: the landmark's weight × its size in the eye × the
  // rise × the side view), ties by id; null when there is none (no vistas: a vgen ≤ 10 world, outside the Heartland)
  FI.pick = function (list) {
    if (!Array.isArray(list)) return null;
    let best = null;
    for (const v of list) if (v && v.wow && Number.isFinite(v.score) && (!best || v.score > best.score || (v.score === best.score && String(v.id) < String(best.id)))) best = v;
    return best;
  };
  // the feet on the spur's walk: its axis 2.5 blocks out from the way's middle (past the way's own cells, between the
  // low walls, within the wow trigger's reach), on the paving (the walk's floor is at the way's level)
  FI.WALK_T = 2.5;
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
  FI.PRE = 2; FI.FLARE = 0.6; FI.SKIP = 0.3; FI.HUD_IN = 1.2;
  // the white veil: 1 → 0 over PRE seconds, slow at first (the white lingers), then the picture comes
  FI.veil = (t) => 1 - smooth(t / FI.PRE);
  // the sun's flare: full while the white is thick, gone FLARE seconds after it
  FI.flare = (t) => 1 - smooth((t - FI.PRE * 0.35) / (FI.PRE * 0.65 + FI.FLARE));
  const anyKey = (I) => !!I && (I.pressed.size > 0 || (I.mouse && I.mouse.clicked && I.mouse.clicked.some(Boolean)) || (I.padPressed && I.padPressed.size > 0) || (I.tPressed && I.tPressed.size > 0));
  class Arrival {
    // o: {vista (the record of the wow moment to play, or null), sun: [x, y] of the sun on the screen (0..1, y down) or null}
    constructor(g, o) { this.g = g; this.v = (o && o.vista) || null; this.sun = (o && o.sun) || null; this.phase = 'new'; this.t = 0; this.k = 0; this.from = 1; this.dom = null; this.first = true; }
    holds() { return this.phase === 'veil' || this.phase === 'out'; }
    veilNow() { return this.phase === 'veil' ? FI.veil(this.t) : this.phase === 'out' ? this.from * (1 - clamp01(this.k / FI.SKIP)) : 0; }
    begin() {
      const g = this.g;
      this.phase = 'veil'; this.t = 0; this.first = true;
      const hud = document.getElementById('hud'); if (hud) { hud.style.transition = 'none'; hud.style.opacity = '0'; }
      if (g.wow) g.wow.wait = Math.max(g.wow.wait || 0, FI.PRE + 1);   // (the wow actor's own poll stays away: the arrival starts the moment)
      this.ui(); this.paint();
    }
    ui() {
      if (this.dom || typeof document === 'undefined') return this.dom;
      const d = document.createElement('div'); d.id = 'arrival';
      d.style.cssText = 'position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:28';
      const glow = document.createElement('div'), white = document.createElement('div');
      const sx = this.sun ? (this.sun[0] * 100).toFixed(1) : '50', sy = this.sun ? (this.sun[1] * 100).toFixed(1) : '40';
      glow.style.cssText = 'position:absolute;left:0;top:0;right:0;bottom:0;background:radial-gradient(circle at ' + sx + '% ' + sy + '%, rgba(255,250,232,1) 0%, rgba(255,226,170,0.85) 5%, rgba(255,190,120,0.42) 14%, rgba(255,160,96,0.14) 30%, rgba(255,150,90,0) 52%)';
      white.style.cssText = 'position:absolute;left:0;top:0;right:0;bottom:0;background:#fffaf2';
      if (!this.sun) glow.style.display = 'none';
      d.appendChild(glow); d.appendChild(white);
      (document.getElementById('app') || document.body).appendChild(d);
      this.dom = d; this.glow = glow; this.white = white;
      return d;
    }
    paint() {
      if (!this.dom) return;
      const v = this.veilNow(), f = this.phase === 'veil' ? FI.flare(this.t) : this.phase === 'out' ? v : this.phase === 'moment' ? FI.flare(FI.PRE + this.t) : 0;
      this.white.style.opacity = v.toFixed(3); this.glow.style.opacity = Math.max(0, f).toFixed(3);
    }
    update(dt) {
      const g = this.g;
      if (this.phase === 'veil') {
        this.t += dt;
        if (anyKey(g.input) && !this.first) { this.skip(); return; }
        this.first = false;
        if (this.t >= FI.PRE) this.moment(); else this.paint();
      } else if (this.phase === 'out') {
        this.k += dt; this.paint();
        if (this.k >= FI.SKIP) this.finish();
      } else if (this.phase === 'moment') {
        this.t += dt; this.paint();
        if (!(g.wow && g.wow.active)) this.finish();
      }
    }
    // the swing (t-vista's wow moment) right after the veil — when the wow moments are on and the vista swings
    moment() {
      const g = this.g, v = this.v;
      const on = !!(g.wow && v && v.wow !== false && (!g.settings || g.settings.wowMoments !== false));
      if (on) { g.wow.wait = 0; g.wow.start(v); this.phase = 'moment'; this.t = 0; this.paint(); }
      else this.finish();
    }
    skip() {
      const g = this.g;
      if (this.phase !== 'veil') return;
      this.from = FI.veil(this.t); this.k = 0; this.phase = 'out';
      if (this.v && VR.WowMoment) { VR.WowMoment.mark(g.meta, this.v.id); if (g.saveMeta) { try { g.saveMeta(); } catch (e) { /* the next autosave */ } } }
      this.paint();
    }
    finish() {
      this.phase = 'done';
      if (this.dom) { this.dom.remove(); this.dom = null; }
      const hud = typeof document !== 'undefined' ? document.getElementById('hud') : null;
      if (hud) {
        hud.style.transition = 'opacity ' + FI.HUD_IN + 's ease'; hud.style.opacity = '1';
        if (typeof setTimeout === 'function') setTimeout(() => { if (hud.style.opacity === '1') { hud.style.transition = ''; hud.style.opacity = ''; } }, FI.HUD_IN * 1000 + 200);
      }
      if (this.g.arrival === this) this.g.arrival = null;
    }
    destroy() { this.phase = 'done'; if (this.dom) { this.dom.remove(); this.dom = null; } const hud = typeof document !== 'undefined' ? document.getElementById('hud') : null; if (hud) { hud.style.transition = ''; hud.style.opacity = ''; } }
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
    if (!v || g.meta !== meta) return null;
    const sp = FI.spawn(v), tod = FI.clock(v.yaw);
    g.env.setTime(tod); meta.time = tod;
    meta.clearUntil = FI.clearUntil(g.env.day | 0); g.env.wx.clearUntil = meta.clearUntil;
    meta.vistaId = v.id;
    g.arrivalPending = { vista: v };
    return sp;
  };
  // a world's start: its first day's clear sky again after a reload on that day
  FI.onLoad = function (g, meta) { if (meta && meta.clearUntil > 0 && g.env && g.env.wx) g.env.wx.clearUntil = meta.clearUntil; };
  // the loading screen's end: the arrival begins (the sun's place on the screen from the last loading frame's camera)
  FI.arrive = function (g) {
    const A0 = g.arrivalPending; g.arrivalPending = null;
    if (!A0) return null;
    let sun = null;
    try {
      const r = g.renderer, m = r && r.viewProj, s = g.env && g.env.E && g.env.E.sunDir;
      if (m && s && s[1] > -0.02) {
        const c = [s[0] * 100, s[1] * 100, s[2] * 100];
        const cx = m[0] * c[0] + m[4] * c[1] + m[8] * c[2] + m[12], cy = m[1] * c[0] + m[5] * c[1] + m[9] * c[2] + m[13], cw = m[3] * c[0] + m[7] * c[1] + m[11] * c[2] + m[15];
        if (cw > 0) { const x = (cx / cw) * 0.5 + 0.5, y = 0.5 - (cy / cw) * 0.5; if (x > -0.1 && x < 1.1 && y > -0.1 && y < 1.1) sun = [x, y]; }
      }
    } catch (e) { sun = null; }
    if (g.arrival) g.arrival.destroy();
    g.arrival = new Arrival(g, { vista: A0.vista, sun });
    g.arrival.begin();
    return g.arrival;
  };

  // a world that goes (quit, another world) takes its arrival with it
  if (VR.Game) { const orig = VR.Game.prototype.teardownWorld; VR.Game.prototype.teardownWorld = function () { if (this.arrival) { this.arrival.destroy(); this.arrival = null; } this.arrivalPending = null; return orig.call(this); }; }

  // ⚙ Spiel → „Start auf dem Aussichtspunkt" (on by default)
  if (VR.Settings && VR.Settings.add) VR.Settings.add({ key: 'vistaStart', g: 'play', sec: 'play', t: 'switch', lab: 'g.set.vistaStart', tip: 'g.set.vistaStart.tip', def: true });
})(VR);

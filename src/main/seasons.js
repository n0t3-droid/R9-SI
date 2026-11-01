// ============================================================================
// w-seasons · VR.Seasons — the year turns (plan docs/superpowers/plans/2026-11-01-w-seasons.md). The owner: never
// boring, beauty, fairy-tale; the same place is new again.
//   the calendar  3 in-game days a season (an hour of play), a year of 12; day 0 the first day of spring — every saved
//                 world reads its own meta.day, nothing new is saved. The last half day blends into the next season.
//                 Kreativ: ⚙ „Jahreszeit" holds one (Automatisch · Frühling · Sommer · Herbst · Winter) or /jahreszeit.
//                 Multiplayer: the host's day (mp.js syncs it) and the host's held season (`ss` in the env message).
//   the look      uniforms only (nothing in a block, the generator or a saved chunk): the terrain's vertex shader shifts
//                 the green tints (shaders.js #ifdef SEASON — the define while ⚙ Jahreszeiten is on): spring fresh, some
//                 trees in blossom; summer gold; autumn red and gold tree by tree, dry grass; winter frosted leaves and
//                 white grass. Low and up: fallen leaves and petals on the ground, the snow cover on every open top
//                 (the t-motion cover, u_snowCover); shallow still water freezes (every preset); rain falls as snow.
//                 Near the player: falling leaves, drifting petals, breath in the cold (none on Very Low).
//   the festivals seasons_fest.js (the 2nd day of a season decorates, the 3rd celebrates).
// Pure (node, test/seasons.js): at · lockOf · wire/unwire · tint · uniforms · schedule · daysTo · record · seen · FESTS.
// Cost: Very Low — a few ALU per terrain vertex, no particles; Low and up — two noise taps on a green top while leaves
// or petals lie, ≤ 8 particles a second near the player.
// ============================================================================
(function (VR) {
  'use strict';
  const S = VR.Seasons = VR.Seasons || {};
  const T = (k, v, fb) => (VR.I18N ? VR.I18N.t(k, v, fb) : (fb !== undefined ? fb : k));
  const isObj = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  // ---------------------------------------------------------------- the calendar (pure)
  S.DAYS = 3;
  S.NAMES = ['spring', 'summer', 'autumn', 'winter'];
  S.BLEND = 0.5;   // the last half day of a season fades into the next
  // day, tod (0 … 24 000), lock (−1 the calendar, 0 … 3 a held season) → {idx, dayIn, next, k, w: [4 weights, sum 1]}
  S.at = function (day, tod, lock) {
    day = Number.isFinite(day) ? Math.floor(day) : 0; tod = Number.isFinite(tod) ? tod : 6000;
    if (lock >= 0 && lock <= 3) { const w = [0, 0, 0, 0]; w[lock] = 1; return { idx: lock, dayIn: ((day % S.DAYS) + S.DAYS) % S.DAYS, next: lock, k: 0, w }; }
    const yd = ((day % (S.DAYS * 4)) + S.DAYS * 4) % (S.DAYS * 4);
    const idx = Math.floor(yd / S.DAYS), dayIn = yd - idx * S.DAYS, next = (idx + 1) % 4;
    const pos = dayIn + Math.max(0, Math.min(23999, tod)) / 24000;   // 0 … 3 through the season
    const k = sm(S.DAYS - S.BLEND, S.DAYS, pos);
    const w = [0, 0, 0, 0]; w[idx] = 1 - k; w[next] += k;
    return { idx, dayIn, next, k, w };
  };
  // the held season: Kreativ worlds only; a guest takes the host's (hostSs: the wire word, '' the calendar)
  S.lockOf = function (settings, meta, hostSs) {
    if (meta && meta.guest && hostSs !== undefined && hostSs !== null) return S.unwire(hostSs);
    if (!meta || meta.mode !== 'creative' || !settings) return -1;
    const i = S.NAMES.indexOf(settings.seasonPick);
    return i;
  };
  S.wire = (lock) => (lock >= 0 && lock <= 3 ? S.NAMES[lock] : '');
  S.unwire = (s) => S.NAMES.indexOf(s);

  // ---------------------------------------------------------------- the tints (pure: the shader's math, TERRAIN_VS)
  // c: the vertex tint (linear rgb) · w: the season weights · o: {leaf, top (a top face of the ground), h (the tree
  // cell's hash 0…1), kind (the mesher's face kind: 1 / 6 water)} → the new tint. A tint that is not green stays.
  const PAL = {
    blossomA: [0.92, 0.5, 0.64], blossomB: [0.95, 0.86, 0.9],
    red: [0.6, 0.09, 0.04], orange: [0.82, 0.3, 0.05], gold: [0.84, 0.6, 0.08],
    snow: [0.86, 0.9, 0.97], frost: [0.78, 0.83, 0.9],
  };
  S.PAL = PAL;
  const mul = (c, m) => [c[0] * m[0], c[1] * m[1], c[2] * m[2]];
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  S.seasonTint = function (c, i, o) {
    const h = o.h, lum = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
    if (i === 0) {   // spring: fresh green; a third of the trees in blossom (pink and white)
      if (o.leaf && h < 0.38) return mix(PAL.blossomA, PAL.blossomB, h / 0.38);
      return mul(c, [0.88, 1.12, 0.78]);
    }
    if (i === 1) return mix(mul(c, [1.1, 1.0, 0.7]), [lum * 1.5, lum * 1.15, lum * 0.3], 0.3);   // summer: gold (a hue shift: the saturated greens turn too)
    if (i === 2) {   // autumn: tree by tree red, orange, gold; a few stay green-brown; the grass dry
      if (o.leaf) {
        if (h < 0.3) return PAL.red.slice();
        if (h < 0.58) return mix(PAL.orange, PAL.red, (0.58 - h) / 0.28 * 0.3);
        if (h < 0.86) return PAL.gold.slice();
        return mul(c, [1.6, 0.95, 0.45]);
      }
      return mix(c, [lum * 1.9, lum * 1.25, lum * 0.45], 0.7);
    }
    // winter: frosted leaves, white open grass, frosty sides and plants
    if (o.leaf) return mix(c, PAL.frost, 0.7);
    if (o.top) return mix(c, PAL.snow, 0.86);
    return mix(mul(c, [1.0, 0.86, 0.7]), PAL.frost, 0.32);
  };
  S.isGreen = (c) => c[1] > c[0] * 1.05 && c[1] > c[2] * 1.05;
  S.tint = function (c, w, o) {
    o = o || {};
    if (o.kind === 1 || o.kind === 6 || !S.isGreen(c)) return c.slice();
    const sum = w[0] + w[1] + w[2] + w[3];
    let out = [c[0] * (1 - sum), c[1] * (1 - sum), c[2] * (1 - sum)];
    for (let i = 0; i < 4; i++) if (w[i] > 0) { const s = S.seasonTint(c, i, o); out = [out[0] + s[0] * w[i], out[1] + s[1] * w[i], out[2] + s[2] * w[i]]; }
    return out;
  };
  // the uniforms: season = the weights (Herzwelt only: another world keeps its look); fx = [snow cover, petals, ice,
  // fallen leaves]
  S.SEASON_DIMS = { overworld: 1 };
  S.uniforms = function (a, dim) {
    if (!S.SEASON_DIMS[dim || 'overworld']) return { season: [0, 0, 0, 0], fx: [0, 0, 0, 0] };
    const w = a.w;
    return { season: w.slice(), fx: [w[3], w[0] * 0.9, sm(0.3, 0.9, w[3]), w[2]] };
  };

  // ---------------------------------------------------------------- the festivals (pure)
  // Herzwelt: one a season; every other people its own (the same day of the season: the host's calendar)
  S.FESTS = {
    bluete: { season: 0, ico: '🌸' }, drachen: { season: 1, ico: '🪁' }, tafel: { season: 2, ico: '🍂' }, lichter: { season: 3, ico: '🕯' },
    gezeiten: { sp: 'aqua', ico: '🌊' }, sandstern: { sp: 'ocker', ico: '⭐' }, funkel: { sp: 'zinn', ico: '✨' }, steinglut: { sp: 'basalt', ico: '🔥' }, eisbluete: { sp: 'opal', ico: '❄' },
  };
  S.FEST_IDS = Object.keys(S.FESTS);
  const BY_SEASON = ['bluete', 'drachen', 'tafel', 'lichter'];
  const BY_SP = {}; for (const id of S.FEST_IDS) if (S.FESTS[id].sp) BY_SP[S.FESTS[id].sp] = id;
  // day, dim, species (a native village's people, or null), lock → {phase: 'none' | 'prep' | 'fest', id}
  S.schedule = function (day, dim, species, lock) {
    const a = S.at(day, 6000, lock);
    let id = '';
    if (species && BY_SP[species]) id = BY_SP[species];
    else if (!species && S.SEASON_DIMS[dim || 'overworld']) id = BY_SEASON[a.idx];
    const phase = !id ? 'none' : a.dayIn === 1 ? 'prep' : a.dayIn === 2 ? 'fest' : 'none';
    return { phase, id };
  };
  S.daysTo = function (day, lock) { const a = S.at(day, 6000, lock); return (2 - a.dayIn + S.DAYS) % S.DAYS; };

  // ---------------------------------------------------------------- the save: the Wanderbuch's page „Feste"
  S.record = function (meta, id) {
    if (!meta || !S.FESTS[id]) return false;
    if (!isObj(meta.wander)) meta.wander = {};
    if (!isObj(meta.wander.festivals)) meta.wander.festivals = {};
    if (meta.wander.festivals[id]) return false;
    meta.wander.festivals[id] = 1;
    return true;
  };
  S.seen = function (meta) {
    const f = meta && isObj(meta.wander) && isObj(meta.wander.festivals) ? meta.wander.festivals : null;
    return f ? Object.keys(f).filter(id => S.FESTS[id]) : [];
  };
  S.name = (id) => T('g.ss.f.' + id);
  S.seasonName = (i) => T('g.ss.s.' + S.NAMES[i]);

  // ================================================================ the game's glue (browser only)
  const hasDoc = typeof document !== 'undefined';
  if (!hasDoc) return;
  S.cur = S.at(0, 6000, -1); S.U = S.uniforms(S.cur, 'overworld'); S.want = true; S.built = null;
  S.hostSs = null;   // a guest: the host's held season ('' the calendar)
  S.cost = { parts: 0 };
  const game = () => VR.game;
  S.lock = function (g) { g = g || game(); return g ? S.lockOf(g.settings, g.meta, S.hostSs) : -1; };
  S.on = (g) => !g || !g.settings || g.settings.seasons !== false;

  // the switches
  if (VR.Settings && VR.Settings.add) {
    VR.Settings.add({ key: 'seasons', g: 'img', sec: 'show', t: 'switch', lab: 'g.set.seasons', tip: 'g.set.seasons.tip', cost: 'low', def: true });
    VR.Settings.add({ key: 'seasonPick', g: 'img', sec: 'show', t: 'choice', lab: 'g.set.seasonPick', tip: 'g.set.seasonPick.tip', def: 'auto', opts: [['auto', 'g.set.seasonPick.auto', 'g.set.seasonPick.auto.tip'], ['spring', 'g.ss.s.spring', 'g.set.seasonPick.kreativ'], ['summer', 'g.ss.s.summer', 'g.set.seasonPick.kreativ'], ['autumn', 'g.ss.s.autumn', 'g.set.seasonPick.kreativ'], ['winter', 'g.ss.s.winter', 'g.set.seasonPick.kreativ']] });
  }

  // the define: the terrain's programs get SEASON while ⚙ Jahreszeiten is on (light2's, sky3's, bodysky's hooks first)
  if (VR.GL && !VR.GL.__seasons) {
    const prev = VR.GL.defineHook || null;
    const NAMES = { terrain: 1, terrainCut: 1, trans: 1, terrainCutZ: 1, lod: 1, lodFar: 1 };
    VR.GL.defineHook = (name, defines) => {
      const d = prev ? prev(name, defines) : (defines || []);
      return S.want && NAMES[name] ? d.concat(['SEASON']) : d;
    };
    VR.GL.__seasons = true;
  }

  // the environment: the season of the moment, its uniforms, the snow cover, snow for rain in winter
  const Env = VR.Env;
  if (Env && !Env.prototype.__seasons) {
    const up0 = Env.prototype.update;
    Env.prototype.update = function (dt, o) {
      const r = up0.apply(this, arguments);
      try { S.envStep(this, dt, o || {}); } catch (e) { /* a nicety: the sky never breaks */ }
      return r;
    };
    Env.prototype.__seasons = true;
  }
  S.envStep = function (env, dt, o) {
    const g = game(), E = env.E, dim = o.dim || 'overworld';
    const on = S.on(g);
    const a = S.at(env.day || 0, env.timeOfDay, S.lock(g));
    if (S.cur && a.idx !== S.cur.idx && g && g.state === 'play' && on && S.SEASON_DIMS[dim] && S.announced !== (env.day || 0) * 4 + a.idx) {
      S.announced = (env.day || 0) * 4 + a.idx;
      say(g, T('g.ss.begins.' + S.NAMES[a.idx]), 1, 'season');
    }
    S.cur = a;
    const U = S.U = on ? S.uniforms(a, dim) : { season: [0, 0, 0, 0], fx: [0, 0, 0, 0] };
    E.season = U.season; E.seasonFx = U.fx;
    if (U.fx[0] > 0) {
      // winter: rain falls as snow (the schedule is everyone's, so is this)
      if (env.rain > 0.01 && U.season[3] > 0.5) { env.snow = Math.max(env.snow, env.rain); env.rain = 0; E.rain = 0; E.snow = env.snow; env.thunder = 0; }
      if (o.motion) E.snowCover = Math.max(E.snowCover || 0, U.fx[0] * 0.92);
    }
  };
  function say(g, text, prio, key) {
    if (!g || !text) return;
    if (VR.Quiet && VR.Quiet.note) { try { VR.Quiet.note(text, prio, key); return; } catch (e) { /* fall through */ } }
    if (g.ui && g.ui.chatLine) g.ui.chatLine(text, '#ffe2a0');
  }
  S.say = say;

  // the uniforms (renderer.js common(): one hook line)
  const Z4 = [0, 0, 0, 0];
  S.setUniforms = function (gl, u, E) {
    const s = E.season || Z4, f = E.seasonFx || Z4;
    if (u.u_season) gl.uniform4f(u.u_season, s[0], s[1], s[2], s[3]);
    if (u.u_seasonFx) gl.uniform4f(u.u_seasonFx, f[0], f[1], f[2], f[3]);
  };

  // ---------------------------------------------------------------- the frame: the switch, the air's leaves, petals, breath
  let leafy = null;
  function leafTypes() {
    if (leafy) return leafy;
    const R = VR.R; leafy = new Uint8Array(R && R.types ? R.types.length : 1);
    if (R && R.types) for (let i = 0; i < R.types.length; i++) { const n = R.types[i] && R.types[i].name; if (n && /_leaves$/.test(n)) leafy[i] = 1; }
    return leafy;
  }
  const isLeaf = (w, x, y, z) => { const s = w.getBlock(x, y, z); if (!s) return false; const R = VR.R, t = R.T && R.T.type ? R.T.type[s] : -1; return t >= 0 && leafTypes()[t] === 1; };
  const LEAF_COL = [[0.75, 0.16, 0.06], [0.88, 0.42, 0.08], [0.9, 0.66, 0.14], [0.66, 0.24, 0.08]];
  const PETAL_COL = [[1, 0.78, 0.86], [1, 0.92, 0.95], [0.98, 0.66, 0.8]];
  let acc = 0, breathT = 0;
  S.frame = function (g, dt) {
    const want = S.on(g);
    if (g.renderer && S.built !== want) { const was = S.built; S.want = want; S.built = want; if ((was !== null || !want) && g.renderer.P) g.renderer.buildPrograms(); }
    if (!want || g.state !== 'play' || !g.particles || !g.world || !g.player) return;
    if (!S.SEASON_DIMS[g.dim || 'overworld']) return;
    const tier = VR.LifeKit && VR.LifeKit.tierOf ? VR.LifeKit.tierOf(g.settings) : 2;
    if (tier <= 0) return;   // Very Low: the tint only
    const U = S.U, pa = g.particles, p = g.player.pos, w = g.world;
    const leaves = U.fx[3], petals = U.fx[1] * (U.season[0] > 0.5 ? 1 : 0), cold = U.season[3];
    const rate = (tier >= 2 ? 7 : 3) * Math.max(leaves, petals);
    acc += dt * rate; let n = 0;
    while (acc >= 1 && n < 4) {
      acc -= 1; n++;
      for (let tries = 0; tries < 3; tries++) {
        const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 13;
        const x = Math.floor(p[0] + Math.cos(a) * r), z = Math.floor(p[2] + Math.sin(a) * r), y0 = Math.floor(p[1]) + 2 + Math.floor(Math.random() * 8);
        let y = -1; for (let k = 0; k < 4; k++) if (isLeaf(w, x, y0 + k, z)) { y = y0 + k; break; }
        if (y < 0) continue;
        const pet = petals > leaves;
        const col = pet ? PETAL_COL[(Math.random() * 3) | 0] : LEAF_COL[(Math.random() * 4) | 0];
        const wd = g.env && g.env.E && g.env.E.windDir ? g.env.E.windDir : [0.7, 0.7];
        pa.spawn(x + Math.random(), y - 0.05, z + Math.random(), wd[0] * 0.6 + (Math.random() - 0.5) * 0.5, -0.2, wd[1] * 0.6 + (Math.random() - 0.5) * 0.5,
          { life: 7 + Math.random() * 4, size: pet ? 0.06 : 0.085, grav: pet ? 0.25 : 0.45, col, emis: 0, drag: 2.2, collide: true, wind: 1, turb: 1.2, force: true });
        S.cost.parts++;
        break;
      }
    }
    // breath in the cold: the player's (first person, in front of the eye) and the villagers' near you, now and then
    if (cold > 0.5) {
      breathT -= dt;
      if (breathT <= 0) {
        breathT = 3.2 + Math.random() * 1.2;
        const yaw = g.player.yaw || 0, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
        const eye = (g.player.eyeHeight || 1.62);
        for (let k = 0; k < 3; k++) pa.spawn(p[0] + fx * 0.55, p[1] + eye - 0.22, p[2] + fz * 0.55, fx * 0.5 + (Math.random() - 0.5) * 0.2, 0.18, fz * 0.5 + (Math.random() - 0.5) * 0.2, { life: 1.4, size: 0.1, grow: 0.5, grav: -0.05, col: [0.92, 0.94, 0.98], emis: 0, alpha: 0.32, drag: 1.6, collide: false, force: true });
        const V = g.villages; let m = 0;
        if (V && V.agents) for (const ag of V.agents) {
          if (m >= 4 || !ag.pos || ag.pose === 'sleep') continue;
          const dx = ag.pos[0] - p[0], dz = ag.pos[2] - p[2]; if (dx * dx + dz * dz > 14 * 14) continue;
          const ay = ag.yaw || 0, ax = -Math.sin(ay), az = -Math.cos(ay), hy = ag.kid ? 1.15 : 1.55;
          pa.spawn(ag.pos[0] + ax * 0.3, ag.pos[1] + hy, ag.pos[2] + az * 0.3, ax * 0.4, 0.15, az * 0.4, { life: 1.2, size: 0.08, grow: 0.45, grav: -0.05, col: [0.92, 0.94, 0.98], emis: 0, alpha: 0.3, drag: 1.6, collide: false, force: true });
          m++;
        }
      }
    }
  };
  const Gm = VR.Game;
  if (Gm && !Gm.prototype.__seasons) {
    const pf0 = Gm.prototype.playFrame;
    Gm.prototype.playFrame = function (dt) { const r = pf0.apply(this, arguments); try { S.frame(this, dt || 0); } catch (e) { /* a nicety */ } return r; };
    // /jahreszeit [frühling|sommer|herbst|winter|auto] — Kreativ: hold a season (the same as ⚙ Jahreszeit)
    const chat0 = Gm.prototype.chat;
    Gm.prototype.chat = function (text) {
      const m = typeof text === 'string' ? /^\/(jahreszeit|season)\s*(\S*)/i.exec(text.trim()) : null;
      if (!m) return chat0.apply(this, arguments);
      const words = { 'frühling': 'spring', fruehling: 'spring', spring: 'spring', sommer: 'summer', summer: 'summer', herbst: 'autumn', autumn: 'autumn', fall: 'autumn', winter: 'winter', auto: 'auto', automatisch: 'auto' };
      const w = words[(m[2] || '').toLowerCase()];
      if (w && this.meta && this.meta.mode === 'creative') { this.settings.seasonPick = w; if (this.saveSettings) try { this.saveSettings(); } catch (e) { /* later */ } }
      else if (w) { this.ui.chatLine(T('g.ss.cmdKreativ'), '#ffd98a'); }
      const a = S.cur || S.at(this.env.day, this.env.timeOfDay, -1);
      const f = S.schedule(this.env.day || 0, this.dim, null, S.lock(this));
      this.ui.chatLine(T('g.ss.now', { s: S.seasonName(S.at(this.env.day || 0, this.env.timeOfDay, S.lock(this)).idx), d: a.dayIn + 1, n: S.daysTo(this.env.day || 0, S.lock(this)), f: f.id ? S.name(f.id) : '' }), '#ffe2a0');
      return true;
    };
    Gm.prototype.__seasons = true;
  }

  // multiplayer: the host's held season rides with the time (the day is synced already)
  const MP = VR.MP;
  if (MP && !MP.prototype.__seasons) {
    const ed0 = MP.prototype.envData;
    MP.prototype.envData = function () { const d = ed0.apply(this, arguments); d.ss = S.wire(S.lockOf(this.g.settings, this.g.meta, null)); return d; };
    const oe0 = MP.prototype.onEnv;
    MP.prototype.onEnv = function (m) { const r = oe0.apply(this, arguments); if (this.role === 'client' && m && m.peer === this.hostPeer && m.data) S.hostSs = typeof m.data.ss === 'string' ? m.data.ss : ''; return r; };
    MP.prototype.__seasons = true;
  }

  // the Wanderbuch: a page „Feste" (the festivals seen; meta.wander.festivals)
  const W = VR.Wander;
  if (W && W.PAGES && W.PAGES.indexOf('festivals') < 0) {
    W.PAGES.push('festivals'); W.SOFT.festivals = S.FEST_IDS.length;
    const html0 = W.html;
    W.html = function (meta, totals) {
      // the page lists the names in the language of the moment (the book keeps the ids)
      let m2 = meta;
      if (meta && isObj(meta.wander) && isObj(meta.wander.festivals)) {
        const named = {}; for (const id of S.seen(meta)) named[id] = S.FESTS[id].ico + ' ' + S.name(id);
        m2 = Object.assign({}, meta, { wander: Object.assign({}, meta.wander, { festivals: named }) });
      }
      return html0.call(this, m2, totals);
    };
  }
  S.debug = {
    set: (day, tod) => { const g = game(); if (!g) return null; g.env.day = day; if (tod !== undefined) g.env.setTime(tod); return S.at(day, g.env.timeOfDay, S.lock(g)); },
    cur: () => ({ cur: S.cur, U: S.U, lock: S.lock(), built: S.built }),
    cost: () => Object.assign({}, S.cost),
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

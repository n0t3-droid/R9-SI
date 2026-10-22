// ============================================================================
// Das Abenteuer in the game (a-core; plan docs/superpowers/plans/2026-10-22-a-core.md; spec
// docs/superpowers/specs/2026-10-22-abenteuer-design.md §1–§4, §15). VR.Adventure is the glue around the rules of
// src/shared/adventure.js (VR.Adv):
//   the switch    per world (meta.adventure.on) — the pause card „⚔ Abenteuer" and the create row „Spielweg"
//                 (start.js mounts both with one line). On, the world is peaceful (the old mobs and raids stay out,
//                 A§1) and its old difficulty is kept for when it is switched off; Kindersicher fixes Begegnungen to
//                 aus. A world that never switched it on gets nothing written into it
//   the awards    award(kind, ctx) from one marked line each in crafting.js, codex.js, villages.js, homes.js,
//                 wonders_game.js and wowmoment.js; placing takes g.onBlockPlaced (player.js afterPlace calls it);
//                 the flown distance and the binding to the world come from a timer twice a second — nothing per frame
//   the HUD       a ring with the level, the Sterntaler and the free points, top left inside #hud (it hides with the
//                 HUD: F1, the wow moment, the photo mode); written only when its numbers change, the motion is CSS
//   the level-up  a banner with rays and sparks, a chime in the day's key (klang.js), golden motes round the player —
//                 waiting while a menu, a wow moment, the director, the photo mode or a wonder's banner holds the view
//   the cards     #adventure (the switch, the band, Begegnungen, the summary) and #advstats (the five stats)
//   🛠 Geschick   mining is 5 % faster a point (Player.breakTime) — the first stat that works in the game
// ============================================================================
(function (VR) {
  'use strict';
  const Adv = VR.Adv; if (!Adv) return;
  const T = (k, v) => (VR.I18N ? VR.I18N.t(k, v) : k);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const game = () => VR.game || null;
  const hasDoc = typeof document !== 'undefined' && !!document.createElement;
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (!e.style) e.style = {}; if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const fmt = (n) => { try { return Number(n).toLocaleString(VR.I18N && VR.I18N.locale ? VR.I18N.locale() : undefined); } catch (e) { return String(n); } };
  const pct = (m) => Math.round((m - 1) * 100);
  // every text key the Abenteuer shows (test/adventure.js checks them in both tables)
  const KEYS = ['g.adv.title', 'g.adv.pause', 'g.adv.pauseTip', 'g.adv.way', 'g.adv.way.free', 'g.adv.way.freeS', 'g.adv.way.adv', 'g.adv.way.advS', 'g.adv.wayNote',
    'g.adv.band', 'g.adv.band.easy', 'g.adv.band.normal', 'g.adv.band.hard', 'g.adv.enc', 'g.adv.enc.normal', 'g.adv.enc.rare', 'g.adv.enc.off', 'g.adv.encNote', 'g.adv.encKids',
    'g.adv.confirm', 'g.adv.confirmCalm', 'g.adv.yes', 'g.adv.no', 'g.adv.offNote', 'g.adv.teaser', 'g.adv.level', 'g.adv.levelMax', 'g.adv.xp', 'g.adv.xpStar', 'g.adv.taler',
    'g.adv.pts1', 'g.adv.pts', 'g.adv.pts0', 'g.adv.toStats', 'g.adv.stats', 'g.adv.stat.aus', 'g.adv.stat.ene', 'g.adv.stat.spu', 'g.adv.stat.ges', 'g.adv.stat.pil',
    'g.adv.eff.aus', 'g.adv.eff.ene', 'g.adv.eff.spu', 'g.adv.eff.ges', 'g.adv.eff.pil', 'g.adv.plusTip', 'g.adv.respec', 'g.adv.respecTip', 'g.adv.respecFar', 'g.adv.statsNote',
    'g.adv.up.kick', 'g.adv.up.title', 'g.adv.up.star', 'g.adv.up.pt1', 'g.adv.up.pts', 'g.adv.up.gift', 'g.adv.up.how', 'g.adv.float', 'g.adv.welcome', 'g.adv.welcomeSub', 'g.adv.newWorld', 'g.adv.newWorldSub', 'g.adv.worldName',
    'g.set.advHud', 'g.set.advHud.tip', 'g.set.storyOffer', 'g.set.storyOffer.tip', 'g.btn.back'];

  const A = VR.Adventure = {
    rec: null, meta: null, sess: Adv.session(), pendingCreate: null, lastBuildAt: 0, up: null, upT: 0, banT: 0, asking: false,
    hudEl: null, hudHost: null, hud: null, hudKey: null, hudPending: false, floatXP: 0, floatTaler: 0, lastPos: null, timer: 0, ui: null, cwPrev: null,
    KEYS, MAX_STEP: 400, HOME_R: 24,
    stats: { hudWrites: 0, awards: 0, ups: 0, chimes: 0, survival: 0, welcomes: 0 },
  };

  // ⚙ Spiel: the ring on the HUD; Funke's word when a story beat is ready (read by the story front, a-story)
  if (VR.Settings && VR.Settings.add) {
    VR.Settings.add({ key: 'advHud', g: 'play', sec: 'play', t: 'switch', lab: 'g.set.advHud', tip: 'g.set.advHud.tip', def: true });
    VR.Settings.add({ key: 'storyOffer', g: 'play', sec: 'play', t: 'switch', lab: 'g.set.storyOffer', tip: 'g.set.storyOffer.tip', def: true });
  }

  // ---------------------------------------------------------------- the world: binding and the switch
  // the world's old difficulty is kept; the Abenteuer brings its own foes (A§1) — never the old ones
  function peaceful(g, m, rec) {
    if (m.difficulty !== 'peaceful') { rec.prevDiff = m.difficulty || null; m.difficulty = 'peaceful'; }
    else if (!rec.prevDiff) rec.prevDiff = 'peaceful';
    if (g) g.difficulty = 'peaceful';
  }
  function save(g) {
    if (!g || !g.meta || g.meta.guest || g.state !== 'play' || typeof g.saveMeta !== 'function') return;
    try { const p = g.saveMeta(); if (p && p.catch) p.catch(() => { /* the autosave keeps it */ }); } catch (e) { /* the autosave keeps it */ }
  }
  // the hand's placing (player.js afterPlace → g.onBlockPlaced, a hook point nobody else uses): chained, once per game
  function install(g) {
    if (!g || (g.onBlockPlaced && g.onBlockPlaced.__adv)) return;
    const prev = g.onBlockPlaced;
    const fn = function (x, y, z, s, p) { if (prev) prev.call(this, x, y, z, s, p); A.placed(x, y, z); };
    fn.__adv = true; g.onBlockPlaced = fn;
  }
  // the world now: its record (sanitized), a new session for the farming guards; a world just made with Spielweg
  // „Abenteuer" (the create row) gets its record here
  A.bind = function () {
    const g = game(), m = g ? g.meta || null : null;
    A.meta = m; A.rec = null; A.sess = Adv.session(); A.lastPos = null; A.up = null; A.asking = false;
    if (m && !m.guest) {
      const P = A.pendingCreate;
      if (P && !m.adventure && (m.created || 0) >= P.at - 2000 && Date.now() - P.at < 120000) {
        A.pendingCreate = null;
        m.adventure = Adv.fresh({ on: true, band: P.band, enc: g.settings && g.settings.kids ? 'off' : P.enc, since: g.env ? g.env.day | 0 : 0 });
        peaceful(g, m, m.adventure); A.greet = true;   // (the welcome when the world is there: tick)
        if (g.store && g.store.saveWorld) { try { const p = g.store.saveWorld(m); if (p && p.catch) p.catch(() => {}); } catch (e) { /* saved with the next autosave */ } }
      } else if (P && Date.now() - P.at >= 120000) A.pendingCreate = null;
      if (m.adventure) { A.rec = m.adventure = Adv.load(m.adventure); if (A.rec.on) peaceful(g, m, A.rec); }
      install(g);
    }
    A.hudKey = null; A.renderHud();
    return A.rec;
  };
  const sync = () => { const g = game(); if (g && g.meta !== A.meta) A.bind(); };
  A.on = () => { sync(); return !!(A.rec && A.rec.on); };
  A.enc = () => { sync(); const g = game(); return Adv.encOf(A.rec, !!(g && g.settings && g.settings.kids)); };
  A.setOn = function (on) {
    sync();
    const g = game(), m = A.meta;
    if (!g || !m || m.guest) return false;
    if (on) {
      if (!m.adventure) m.adventure = Adv.fresh({ on: true, since: g.env ? g.env.day | 0 : 0 });
      A.rec = m.adventure; A.rec.on = true;
      peaceful(g, m, A.rec);
      if (g.settings && g.settings.kids) A.rec.enc = 'off';
      install(g);
    } else {
      if (!A.rec) return true;
      A.rec.on = false; A.up = null;
      const d = A.rec.prevDiff; if (d) { m.difficulty = d; g.difficulty = d; }
    }
    A.hudKey = null; A.renderHud(); save(g);
    return true;
  };
  A.setBand = (b) => { sync(); if (!A.rec || !Adv.setBand(A.rec, b)) return false; save(game()); return true; };
  A.setEnc = (e) => {
    sync(); const g = game();
    if (!A.rec || Adv.ENC.indexOf(e) < 0 || (g && g.settings && g.settings.kids)) return false;
    A.rec.enc = e; save(g); return true;
  };

  // ---------------------------------------------------------------- the awards
  // the hooks call this; bookkeeping only (the HUD follows in the next frame)
  A.award = function (kind, ctx) {
    const g = game(); if (!g || g.state !== 'play') return null;   // (the start screen, the Studio, a loading world: nothing counts)
    if (g.meta !== A.meta) A.bind();
    const rec = A.rec; if (!rec || !rec.on) return null;
    const r = Adv.award(rec.me, kind, ctx, Date.now(), A.sess);
    if (!r) return null;
    A.stats.awards++;
    if (kind === 'survival') { A.stats.survival += (ctx && ctx.n) | 0; return r; }   // listened to, never rewarded (A§0.3)
    if (r.xp > 0 || r.taler > 0) {
      if (r.xp >= 5) A.floatXP += r.xp;
      if (r.taler + r.gift > 0) A.floatTaler += r.taler + r.gift;
      A.schedule();
      if (r.up > 0 || r.starUp > 0) A.levelUp(r);
    }
    return r;
  };
  A.placed = (x, y, z) => { A.lastBuildAt = Date.now(); return A.award('place', { x, y, z }); };
  // codex.js: a first find (unlock) — a biome, a milestone, a creature met; a wonder counts at its heart (wonders_game.js)
  // and a kill or a won raid never (A§0.3)
  const NO_MILESTONE = { kill: 1, raid: 1 };
  A.codexUnlock = function (id) {
    if (typeof id !== 'string' || id.length < 3 || id[1] !== ':') return null;
    const k = id[0], rest = id.slice(2);
    if (k === 'b') return A.award('biome', { id: rest });
    if (k === 'm') return NO_MILESTONE[rest] ? null : A.award('milestone', { id: rest });
    if (k === 'c') return A.award('creature', { id: rest });
    return null;
  };
  // codex.js: an event every time it happens — a blueprint built (3 an hour), the first flight at a helm
  A.codexEvent = (name) => (name === 'blueprint' ? A.award('blueprint', {}) : name === 'ship' ? A.award('flight', {}) : null);
  // 💡 inventions.js tells its listeners when a new invention is found (10 XP, once each) — its own API, no line there
  A.onInvention = (e) => (e && e.type === 'found' && e.k ? A.award('invention', { id: e.k }) : null);
  if (VR.Inventions && VR.Inventions.on) VR.Inventions.on(A.onInvention);
  // twice a second: the binding, the ring's visibility, a ship's or a jetpack's distance (5 XP a km), a waiting level-up
  A.tick = function () {
    const g = game(); if (!g) return;
    if (g.meta !== A.meta) A.bind(); else A.renderHud();
    const rec = A.rec, p = g.player;
    if (rec && rec.on && p && g.state === 'play' && (g.flight || (g.gadgets && g.gadgets.jetOn))) {
      const q = p.pos, L = A.lastPos;
      if (L) { const dx = q[0] - L[0], dy = q[1] - L[1], dz = q[2] - L[2], d = Math.sqrt(dx * dx + dy * dy + dz * dz); if (d > 0.5 && d < A.MAX_STEP) A.award('distance', { m: d }); }
      A.lastPos = [q[0], q[1], q[2]];
    } else A.lastPos = null;
    if (A.greet && rec && rec.on && g.state === 'play' && !A.busy()) { A.greet = false; A.welcome(); }   // a new Abenteuer world says hello once
    if (A.up) A.flushUp();
  };

  // ---------------------------------------------------------------- the five stats in the game
  A.points = () => { sync(); return A.rec ? Adv.points(A.rec.me) : 0; };
  A.addPoint = (k) => { sync(); if (!A.rec || !A.rec.on || !Adv.addPoint(A.rec.me, k)) return false; A.renderHud(); return true; };
  // free, at home: within HOME_R blocks of the player's place (the spawn they set, or the world's)
  A.atHome = function () {
    const g = game(), p = g && g.player; if (!p || !Array.isArray(p.pos)) return false;
    const s = Array.isArray(p.spawn) && p.spawn.length >= 3 && p.spawn.every(Number.isFinite) ? p.spawn : (g.worldSpawn ? g.worldSpawn() : null);
    return !!s && Math.hypot(p.pos[0] - s[0], p.pos[2] - s[2]) <= A.HOME_R && Math.abs(p.pos[1] - s[1]) <= 12;
  };
  A.respec = () => { sync(); if (!A.rec || !A.atHome()) return false; Adv.respec(A.rec.me); A.renderHud(); save(game()); return true; };
  // 🛠 Geschick: mining 5 % faster a point (no allocation: it is asked every frame a block is being mined)
  A.mineMul = () => { sync(); const r = A.rec; if (!r || !r.on) return 1; const v = r.me.pts.ges | 0; return 1 + 0.05 * (v < 0 ? 0 : v > 10 ? 10 : v); };
  if (VR.Player && VR.Player.prototype.breakTime && !VR.Player.prototype.breakTime.__adv) {
    const ob = VR.Player.prototype.breakTime;
    const nb = function (s, hdef) { const t = ob.call(this, s, hdef), k = A.mineMul(); return k > 1 && t < Infinity ? Math.max(0.05, t / k) : t; };
    nb.__adv = true; VR.Player.prototype.breakTime = nb;
  }

  // ---------------------------------------------------------------- the HUD: the ring, the Sterntaler, the free points
  const RING = (id, off) => `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3bf"/><stop offset=".5" stop-color="#ffc94d"/><stop offset="1" stop-color="#ff8a3d"/></linearGradient></defs><circle class="bg" cx="32" cy="32" r="27"/><circle class="arc" cx="32" cy="32" r="27" pathLength="100" stroke="url(#${id})" stroke-dasharray="100" stroke-dashoffset="${off === undefined ? 100 : off}"/></svg>`;
  // the Sterntaler (our own): a gold disc, a raised rim, a five-pointed star stamped in its middle
  const COIN = (id) => `<svg class="coin" viewBox="0 0 24 24" aria-hidden="true"><defs><radialGradient id="${id}" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#fff3b0"/><stop offset=".55" stop-color="#ffc83d"/><stop offset="1" stop-color="#c97a10"/></radialGradient></defs><circle cx="12" cy="12" r="11" fill="url(#${id})" stroke="#8a5208" stroke-width="1"/><circle cx="12" cy="12" r="8.4" fill="none" stroke="#fff1a8" stroke-opacity=".6" stroke-width=".8"/><path d="M12 5.8L13.47 9.98 17.9 10.08 14.38 12.77 15.64 17.02 12 14.5 8.36 17.02 9.62 12.77 6.1 10.08 10.53 9.98Z" fill="#fff6c8" stroke="#b86b0c" stroke-width=".6" stroke-linejoin="round"/></svg>`;
  A.ensureHud = function () {
    if (!hasDoc) return null;
    const hud = document.getElementById('hud'); if (!hud) return null;
    if (A.hudEl && A.hudHost === hud) return A.hudEl;
    css();
    const d = mk('div'); d.setAttribute('id', 'advhud'); d.setAttribute('aria-hidden', 'true'); d.style.display = 'none';
    const ring = mk('div', 'ring'); ring.innerHTML = RING('advgold-h');
    const lvl = mk('div', 'lvl', '0'); ring.appendChild(lvl);
    const side = mk('div', 'side'), tal = mk('div', 'tal'), ci = mk('span', 'ci'), tn = mk('span', 'n', '0'), st = mk('span', 'st', ''), pts = mk('div', 'pts none', '');
    ci.innerHTML = COIN('advcoin-h'); tal.appendChild(ci); tal.appendChild(tn); tal.appendChild(st);
    side.appendChild(tal); side.appendChild(pts); d.appendChild(ring); d.appendChild(side);
    hud.appendChild(d);
    A.hudEl = d; A.hudHost = hud; A.hud = { ring, lvl, tn, st, pts, arc: ring.querySelector ? ring.querySelector('.arc') : null };
    return d;
  };
  // the ring's numbers → the page, only when they changed (key) or when asked (force)
  A.renderHud = function (force) {
    A.hudPending = false;
    const g = game(), rec = A.rec;
    const show = !!(g && rec && rec.on && !(g.meta && g.meta.guest) && !(g.settings && g.settings.advHud === false));
    const el = show ? A.ensureHud() : A.hudEl;
    if (!el) return false;
    let key = 'off', lv = null;
    if (show) { const me = rec.me; lv = Adv.levelOf(me.xp); key = me.level + ':' + me.stars + ':' + Math.round(lv.frac * 400) + ':' + me.taler + ':' + Adv.points(me); }
    if (key === A.hudKey && !force) return false;
    A.hudKey = key; A.stats.hudWrites++;
    if (!show) { el.style.display = 'none'; return true; }
    const me = rec.me, H = A.hud, p = Adv.points(me);
    el.style.display = '';
    H.lvl.textContent = String(me.level);
    H.tn.textContent = fmt(me.taler);
    H.st.textContent = me.stars ? '⭐' + me.stars : '';
    H.pts.textContent = p ? '✦ ' + p : '';
    H.pts.className = 'pts' + (p ? '' : ' none');
    if (H.arc) H.arc.style.strokeDashoffset = String(+(100 - lv.frac * 100).toFixed(2));
    return true;
  };
  // the next animation frame (or a moment later outside a browser): one refresh for every award of a frame
  A.schedule = function () {
    if (A.hudPending) return; A.hudPending = true;
    const f = () => { A.renderHud(); A.flushFloat(); };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(f); else setTimeout(f, 16);
  };
  // „+20 EP" rising beside the ring (CSS), the Sterntaler of the award with it
  A.flushFloat = function () {
    const xp = A.floatXP, tl = A.floatTaler; A.floatXP = 0; A.floatTaler = 0;
    const el = A.hudEl; if (!el || el.style.display === 'none' || (!xp && !tl)) return;
    const f = mk('div', 'fl');
    f.innerHTML = (xp ? esc(T('g.adv.float', { n: fmt(xp) })) : '') + (tl ? ` <span class="ft">${COIN('advcoin-f')}+${esc(fmt(tl))}</span>` : '');
    el.appendChild(f);
    setTimeout(() => { if (f.remove) f.remove(); }, 1600);
  };

  // ---------------------------------------------------------------- the level-up: a moment worth feeling
  A.levelUp = function (r) {
    const q = A.up || (A.up = { level: r.level, points: 0, gift: 0, stars: r.stars, starUp: 0 });
    q.level = r.level; q.stars = r.stars; q.points += r.up; q.gift += r.gift; q.starUp += r.starUp;
    save(game());   // (a level is never lost to a crash)
    A.flushUp();
  };
  A.queued = () => !!A.up;
  // what holds the view now ('' when nothing does)
  A.busy = function () {
    const g = game(); if (!g) return 'game';
    if (g.state !== 'play') return 'state';
    if (g.ui && (g.ui.screen || g.ui.typing)) return 'menu';
    if (g.wow && g.wow.active) return 'wow';
    if (g.director && g.director.active) return 'director';
    if (g.photo || (g.photoCam && g.photoCam.on)) return 'photo';
    if (g.arrival || g.revealPending || g.studioOpen) return 'arrival';
    if (hasDoc) { const wb = document.getElementById('wbanner'); if (wb && wb.classList && wb.classList.contains('on')) return 'banner'; }
    return '';
  };
  A.flushUp = function () {
    if (!A.up) return false;
    if (A.busy()) { if (!A.upT) A.upT = setTimeout(() => { A.upT = 0; A.flushUp(); }, 400); return false; }
    const q = A.up; A.up = null;
    A.stats.ups++;
    A.banner(q); A.chime(q.level); A.burst(); A.pulse();
    return true;
  };
  A.banner = function (q) {
    if (!hasDoc) return null;
    css();
    let el = document.getElementById('advup');
    if (!el) { el = mk('div'); el.setAttribute('id', 'advup'); el.setAttribute('aria-live', 'polite'); (document.getElementById('app') || document.body).appendChild(el); }
    el.textContent = '';
    el.appendChild(mk('div', 'rays')); el.appendChild(mk('div', 'glow'));
    const sp = mk('div', 'sparks');
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + Math.random() * 0.3, r = 150 + Math.random() * 130, s = mk('i');
      s.style.cssText = `--x:${(Math.cos(a) * r).toFixed(0)}px;--y:${(Math.sin(a) * r * 0.62).toFixed(0)}px;--d:${(Math.random() * 0.25).toFixed(2)}s`;
      sp.appendChild(s);
    }
    el.appendChild(sp);
    el.appendChild(mk('div', 'kick', T('g.adv.up.kick')));
    el.appendChild(mk('div', 'big', q.starUp && !q.points ? T('g.adv.up.star', { n: q.stars }) : T('g.adv.up.title', { n: q.level })));
    const sub = [];
    if (q.points === 1) sub.push(T('g.adv.up.pt1')); else if (q.points > 1) sub.push(T('g.adv.up.pts', { n: q.points }));
    if (q.gift > 0) sub.push(T('g.adv.up.gift', { n: fmt(q.gift) }));
    if (sub.length) el.appendChild(mk('div', 'sub', sub.join('   ·   ')));
    if (q.points > 0) el.appendChild(mk('div', 'how', T('g.adv.up.how')));
    el.className = ''; void el.offsetWidth; el.className = 'on';   // (the animations from the start)
    clearTimeout(A.banT);
    A.banT = setTimeout(() => { el.className = 'off'; A.banT = setTimeout(() => { el.className = ''; }, 800); }, 3600);
    return el;
  };
  // the chime: six bells up the day's pentatonic key and the octave held (VR.Adv.chime), through audio.js's synth
  A.chime = function (level) {
    const g = game(), au = g && g.audio; if (!au || !au.ctx || typeof au.tone !== 'function') return 0;
    const K = VR.Klang, plan = K && K.musicPlan ? K.musicPlan(g.env ? g.env.day | 0 : 0) : { root: 60, scale: [0, 2, 4, 7, 9] };
    const notes = Adv.chime(plan, level, K && K.degreeMidi), t0 = (au.ctx.currentTime || 0) + 0.03;
    for (const n of notes) {
      const f = 440 * Math.pow(2, (n.midi - 69) / 12);
      if (n.kind === 'bell') { au.tone(f, n.gain * 1.6, n.dur, 'sine', true, t0 + n.t); au.tone(f * 2.01, n.gain * 0.45, n.dur * 0.6, 'sine', false, t0 + n.t + 0.005); }
      else au.tone(f, n.gain * 1.4, n.dur, 'triangle', true, t0 + n.t);
    }
    if (au.count) au.count('adv.chime');
    A.stats.chimes++;
    return notes.length;
  };
  // golden motes rising in a ring round the player, a warm spark before the eyes (particles.js; its own budget)
  A.burst = function () {
    const g = game(), P = g && g.particles, p = g && g.player; if (!P || !p || !p.pos) return 0;
    const gold = [1, 0.8, 0.32], warm = [1, 0.93, 0.62], x = p.pos[0], y = p.pos[1], z = p.pos[2];
    let n = 0;
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      if (P.spawn) P.spawn(x + c * 1.15, y + 0.25 + (i % 4) * 0.2, z + s * 1.15, c * 0.55, 1.5 + (i % 3) * 0.45, s * 0.55, { life: 1.7, size: 0.075, grav: -0.25, col: gold, emis: 1, drag: 0.6, collide: false });
      else if (P.glow) P.glow(x + c * 1.15, y + 0.3, z + s * 1.15, gold, 1.7, 0.075, 1.6);
      n++;
    }
    const ld = p.lookDir ? p.lookDir() : [0, 0, -1], eye = p.eye || 1.62;
    if (P.spark) { P.spark(x + ld[0] * 2.3, y + eye + ld[1] * 2.3, z + ld[2] * 2.3, warm, 36, 3.4, 1); n++; }
    return n;
  };
  A.pulse = function () { const el = A.hudEl; if (!el || !el.classList) return; el.classList.remove('up'); void el.offsetWidth; el.classList.add('up'); };
  A.welcome = function () {
    A.stats.welcomes++;
    const g = game(); if (g && g.ui && g.ui.toast) g.ui.toast(T('g.adv.welcome'), T('g.adv.welcomeSub'), null);
    const el = A.hudEl; if (el && el.classList) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
  };

  // ---------------------------------------------------------------- the pause card „⚔ Abenteuer" and the stats card
  const seg = (act, items, cur, dis) => `<div class="seg" role="group">` + items.map(([v, lab, sub]) => `<button type="button" data-act="${act}" data-v="${v}"${v === cur ? ' class="on"' : ''} aria-pressed="${v === cur}"${dis ? ' disabled' : ''}>${esc(lab)}${sub ? `<small>${esc(sub)}</small>` : ''}</button>`).join('') + '</div>';
  const ptsText = (p) => (p === 1 ? T('g.adv.pts1') : p > 1 ? T('g.adv.pts', { n: p }) : T('g.adv.pts0'));
  A.summary = function (rec, on) {
    const me = rec.me, lv = Adv.levelOf(me.xp), p = Adv.points(me), top = me.level >= Adv.CAP;
    const xp = top ? T('g.adv.xpStar', { a: fmt(lv.into), b: fmt(lv.need) }) : T('g.adv.xp', { a: fmt(lv.into), b: fmt(lv.need), n: me.level + 1 });
    const title = top && me.stars ? T('g.adv.levelMax', { s: me.stars }) : T('g.adv.level', { n: me.level });
    return `<div class="advsum${on ? '' : ' adv-dim'}"><div class="bigring">${RING('advgold-c', +(100 - lv.frac * 100).toFixed(2))}<div class="lvl">${me.level}</div></div>`
      + `<div class="advnums"><div class="lv">${esc(title)}</div><div class="xp">${esc(xp)}</div><div class="advbar"><i style="width:${(lv.frac * 100).toFixed(1)}%"></i></div>`
      + `<div class="advrow"><span class="tal">${COIN('advcoin-c')}${esc(T('g.adv.taler', { n: fmt(me.taler) }))}</span><span class="ptsl${p ? ' has' : ''}">${esc(ptsText(p))}</span></div></div>`
      + `<button type="button" class="btn primary go" data-act="adv:stats"${on ? '' : ' disabled'}>${esc(T('g.adv.toStats'))}</button></div>`;
  };
  A.renderCard = function () {
    const box = hasDoc && document.querySelector('#adventure .panel'); if (!box) return;
    sync();
    const g = game(), rec = A.rec, on = !!(rec && rec.on), kids = !!(g && g.settings && g.settings.kids);
    let h = `<div class="advhead"><h2>${esc(T('g.adv.title'))}</h2><button type="button" class="btn small" data-act="adv:back">← ${esc(T('g.btn.back'))}</button></div>`;
    h += rec ? A.summary(rec, on) : `<div class="advteaser">${esc(T('g.adv.teaser'))}</div>`;
    h += `<div class="field"><label>${esc(T('g.adv.way'))}</label>` + seg('adv:way', [['free', T('g.adv.way.free'), T('g.adv.way.freeS')], ['adv', T('g.adv.way.adv'), T('g.adv.way.advS')]], on || A.asking ? 'adv' : 'free') + '</div>';
    if (A.asking) h += `<div class="advask"><p>${esc(T(VR.Foes ? 'g.adv.confirm' : 'g.adv.confirmCalm'))}</p><div class="row gap"><button type="button" class="btn primary" data-act="adv:yes">${esc(T('g.adv.yes'))}</button><button type="button" class="btn small" data-act="adv:no">${esc(T('g.adv.no'))}</button></div></div>`;
    const band = rec ? rec.band : 'normal', enc = Adv.encOf(rec, kids);
    h += `<div class="field${on ? '' : ' adv-dim'}"><label>${esc(T('g.adv.band'))}</label>` + seg('adv:band', [['easy', T('g.adv.band.easy')], ['normal', T('g.adv.band.normal')], ['hard', T('g.adv.band.hard')]], band, !on) + '</div>';
    h += `<div class="field${on ? '' : ' adv-dim'}"><label>${esc(T('g.adv.enc'))}</label>` + seg('adv:enc', [['normal', T('g.adv.enc.normal')], ['rare', T('g.adv.enc.rare')], ['off', T('g.adv.enc.off')]], enc, !on || kids) + `<div class="note">${esc(T(kids ? 'g.adv.encKids' : 'g.adv.encNote'))}</div></div>`;
    if (rec && !on) h += `<div class="note advfoot">${esc(T('g.adv.offNote'))}</div>`;
    box.innerHTML = h;
  };
  const STAT_COL = { aus: '#ff7f93', ene: '#ffd84d', spu: '#7dffb4', ges: '#ffb35c', pil: '#7cc9ff' };
  A.renderStats = function () {
    const box = hasDoc && document.querySelector('#advstats .panel'); if (!box) return;
    sync();
    const rec = A.rec; if (!rec) { box.innerHTML = ''; return; }
    const me = rec.me, p = Adv.points(me), e = Adv.effects(me.pts), home = A.atHome();
    const eff = { aus: T('g.adv.eff.aus', { hp: e.hp }), ene: T('g.adv.eff.ene', { e: pct(e.energy), b: pct(e.boost) }), spu: T('g.adv.eff.spu', { r: e.scan }), ges: T('g.adv.eff.ges', { s: pct(e.speed) }), pil: T('g.adv.eff.pil', { b: pct(e.boostTime), t: pct(e.turn) }) };
    let h = `<div class="advhead"><h2>${esc(T('g.adv.stats'))}</h2><button type="button" class="btn small" data-act="adv:card">← ${esc(T('g.btn.back'))}</button></div>`;
    h += `<div class="advptsline"><b>${esc(T('g.adv.level', { n: me.level }))}</b><span class="ptsl${p ? ' has' : ''}">${esc(ptsText(p))}</span></div>`;
    for (const k of Adv.STATS) {
      const v = me.pts[k] | 0; let pips = ''; for (let i = 0; i < Adv.PT_MAX; i++) pips += `<i${i < v ? ' class="on"' : ''}></i>`;
      h += `<div class="advstat" style="--c:${STAT_COL[k]}"><div class="nm">${esc(T('g.adv.stat.' + k))}<small>${esc(eff[k])}</small></div><div class="pips" role="img" aria-label="${v} / ${Adv.PT_MAX}">${pips}<b>${v}</b></div>`
        + `<button type="button" class="btn small plus" data-act="adv:pt" data-stat="${k}" title="${esc(T('g.adv.plusTip'))}" aria-label="${esc(T('g.adv.plusTip'))}"${p && v < Adv.PT_MAX && rec.on ? '' : ' disabled'}>＋</button></div>`;
    }
    h += `<div class="advresp"><button type="button" class="btn small" data-act="adv:respec"${home && Adv.spent(me) ? '' : ' disabled'}>${esc(T('g.adv.respec'))}</button><span class="note">${esc(T(home ? 'g.adv.respecTip' : 'g.adv.respecFar'))}</span></div>`;
    h += `<div class="note advsn">${esc(T('g.adv.statsNote'))}</div>`;
    box.innerHTML = h;
  };
  A.openCard = function () { const ui = A.ui || (game() && game().ui); if (!ui) return; A.asking = false; A.renderCard(); ui.show('adventure'); };
  A.openStats = function () { const ui = A.ui || (game() && game().ui); if (!ui) return; A.renderStats(); ui.show('advstats'); };

  // ---------------------------------------------------------------- the create row „Spielweg" (Profi's create form)
  const pickSeg = (s, v) => { for (const x of s.children) { const on = x.dataset && x.dataset.v === v; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); } };
  function createRow() {
    const panel = hasDoc && document.querySelector('#create .panel'); if (!panel) return;
    if (!panel.querySelector('#cw_way')) {
      const mode = panel.querySelector('#cw_mode'), field = mode && mode.closest ? mode.closest('.field') : null;
      const f = document.createElement('div'); f.className = 'field advway';
      f.innerHTML = `<label>${esc(T('g.adv.way'))}</label><div class="seg" id="cw_way" role="group" aria-label="${esc(T('g.adv.way'))}"><button type="button" data-act="adv:cway" data-v="free">${esc(T('g.adv.way.free'))}<small>${esc(T('g.adv.way.freeS'))}</small></button><button type="button" data-act="adv:cway" data-v="adv">${esc(T('g.adv.way.adv'))}<small>${esc(T('g.adv.way.advS'))}</small></button></div><div class="note advwaynote" hidden>${esc(T('g.adv.wayNote'))}</div>`;
      if (field && field.after) field.after(f); else panel.appendChild(f);
    }
    A.cwPrev = null; createWay('free');
  }
  // Abenteuer: the difficulty row now says how strong the encounters are (Friedlich = without them) — Normal to start
  // with; Frei bauen gives the row its old choice back
  function createWay(v) {
    const s = hasDoc && document.querySelector('#cw_way'); if (!s) return;
    pickSeg(s, v);
    const note = document.querySelector('#create .advwaynote'); if (note) note.hidden = v !== 'adv';
    const diff = document.querySelector('#cw_diff'); if (!diff) return;
    if (v === 'adv' && A.cwPrev === null) { const cur = diff.querySelector('.on'); A.cwPrev = cur && cur.dataset ? cur.dataset.v : 'peaceful'; pickSeg(diff, 'normal'); }
    else if (v !== 'adv' && A.cwPrev !== null) { pickSeg(diff, A.cwPrev); A.cwPrev = null; }
  }
  // ✓ Welt erstellen: an Abenteuer world is peaceful itself (A§1); its band and Begegnungen come from the difficulty row
  A.beforeCreate = function () {
    const way = hasDoc && document.querySelector('#cw_way button.on');
    if (!way || way.dataset.v !== 'adv') { A.pendingCreate = null; return; }
    const cur = document.querySelector('#cw_diff .on'), d = cur && cur.dataset ? cur.dataset.v : 'normal';
    A.pendingCreate = { at: Date.now(), band: d === 'easy' || d === 'hard' ? d : 'normal', enc: d === 'peaceful' ? 'off' : 'normal' };
    const diff = document.querySelector('#cw_diff'); if (diff) pickSeg(diff, 'peaceful');
    A.cwPrev = null;
  };

  // ---------------------------------------------------------------- 🎒 Meins on the start screen: „⚔ Abenteuer-Welt beginnen" (A§1)
  // the way in for Einfach (no create form there): a tile on top of the page (all things, the worlds) that makes a new
  // world the way ▶ Losspielen does (Zen, peaceful) and marks it for the Abenteuer
  A.meinsTile = function () {
    const ST = VR.Start, body = hasDoc && document.querySelector('#meins .mbody'); if (!ST || !body) return false;
    if (ST.meinsFrom === 'pause' || (ST.meinsChip !== 'all' && ST.meinsChip !== 'worlds') || body.querySelector('.advtile')) return false;
    const b = mk('button', 'advtile'); b.setAttribute('type', 'button'); b.setAttribute('data-act', 'adv:newworld');
    if (b.dataset) b.dataset.act = 'adv:newworld';
    b.appendChild(mk('b', '', T('g.adv.newWorld'))); b.appendChild(mk('small', '', T('g.adv.newWorldSub')));
    if (body.firstChild && body.insertBefore) body.insertBefore(b, body.firstChild); else body.appendChild(b);
    return true;
  };
  A.newWorld = async function () {
    const g = game(), ST = VR.Start;
    if (ST && ST.ready) { if (!(await ST.ready(g))) return false; } else if (!g || g.state !== 'title') return false;   // (t-first: the start screen may stand before the game is ready)
    if (typeof g.createWorld !== 'function') return false;
    const base = T('g.adv.worldName'), ws = (ST && ST.worldsCache) || [];
    const n = ws.filter(w => w && String(w.name || '').startsWith(base)).length;
    A.pendingCreate = { at: Date.now(), band: 'normal', enc: g.settings && g.settings.kids ? 'off' : 'normal' };
    g.createWorld({ name: base + (n ? ' ' + (n + 1) : ''), mode: 'zen', difficulty: 'peaceful', type: 'default', seed: '', cheats: true, kit: true });
    return true;
  };

  // ---------------------------------------------------------------- the actions (before ui.js's own)
  A.act = function (a, b, ui) {
    const v = b && b.dataset ? b.dataset.v : undefined;
    switch (a) {
      case 'adventure': case 'adv:card': A.openCard(); return true;
      case 'adv:back': ui.pause(); return true;
      case 'adv:stats': A.openStats(); return true;
      case 'adv:way':
        if (v === 'adv' && !A.on()) { if (A.rec) { A.setOn(true); A.welcome(); } else A.asking = true; }   // (a world that never had it asks once)
        else if (v === 'free') { A.asking = false; if (A.on()) A.setOn(false); }
        A.renderCard(); return true;
      case 'adv:yes': A.asking = false; A.setOn(true); A.welcome(); A.renderCard(); return true;
      case 'adv:no': A.asking = false; A.renderCard(); return true;
      case 'adv:band': A.setBand(v); A.renderCard(); return true;
      case 'adv:enc': A.setEnc(v); A.renderCard(); return true;
      case 'adv:pt': A.addPoint(b.dataset.stat); A.renderStats(); return true;
      case 'adv:respec': A.respec(); A.renderStats(); return true;
      case 'adv:cway': createWay(v); return true;
      case 'adv:newworld': A.newWorld(); return true;
      case 'docreate': A.beforeCreate(); return false;   // (ui.js makes the world)
      default: return false;
    }
  };
  // the ⚔ button in the pause menu, after 🎒 Meins (Einfach and Profi; not for a multiplayer guest)
  function pauseButton() {
    const panel = hasDoc && document.querySelector('#pause .panel'); if (!panel) return;
    let b = panel.querySelector('[data-act="adventure"]');
    if (!b) {
      b = document.createElement('button'); b.type = 'button'; b.className = 'btn advbtn';
      b.dataset.act = 'adventure'; b.dataset.t = 'g.adv.pause'; b.dataset.tt = 'g.adv.pauseTip';
      b.textContent = T('g.adv.pause'); b.title = T('g.adv.pauseTip');
      const meins = panel.querySelector('[data-act="meins"]');
      if (meins && meins.after) meins.after(b); else (panel.querySelector('.ptop') || panel).appendChild(b);
    }
    const g = game(); b.style.display = g && g.meta && g.meta.guest ? 'none' : '';
    b.classList.toggle('on', A.on());
  }
  // start.js's one line: the screens, the hooks into this UI, the timer
  A.mount = function (ui) {
    if (!ui || ui.__adv || !hasDoc) return;
    ui.__adv = true; A.ui = ui;
    css();
    const root = ui.root || document.getElementById('ui');
    if (root) for (const id of ['adventure', 'advstats']) if (!document.getElementById(id)) { const s = document.createElement('div'); s.id = id; s.className = 'screen'; s.innerHTML = '<div class="panel box advcard"></div>'; root.appendChild(s); }
    const op = ui.pause; ui.pause = function () { const r = op.apply(this, arguments); try { pauseButton(); } catch (e) { console.warn('adventure', e); } return r; };
    const os = ui.show; ui.show = function (id) { const r = os.apply(this, arguments); try { if (id === 'create') createRow(); A.renderHud(); } catch (e) { console.warn('adventure', e); } return r; };
    const oa = ui.act; ui.act = function (a, b) { if (A.act(a, b, this)) return; return oa.apply(this, arguments); };
    const ST = VR.Start; if (ST && ST.renderMeins && !ST.renderMeins.__adv) { const orm = ST.renderMeins; ST.renderMeins = async function () { const r = await orm.apply(this, arguments); try { A.meinsTile(); } catch (e) { console.warn('adventure', e); } return r; }; ST.renderMeins.__adv = true; }
    if (VR.I18N && VR.I18N.on) VR.I18N.on(() => { try { if (ui.screen === 'create') createRow(); if (ui.screen === 'adventure') A.renderCard(); if (ui.screen === 'advstats') A.renderStats(); } catch (e) { console.warn('adventure', e); } });
    if (!A.timer) A.timer = setInterval(A.tick, 500);
  };
  // Esc on the cards: one step back (the stats → the card → the pause menu), before the game's own keys see it
  if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !A.ui) return;
    const sc = A.ui.screen; if (sc !== 'adventure' && sc !== 'advstats') return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (sc === 'advstats') A.openCard(); else if (A.asking) { A.asking = false; A.renderCard(); } else A.ui.pause();
  }, true);

  // ---------------------------------------------------------------- the look (injected once; the game's palette)
  let cssDone = false;
  function css() {
    if (cssDone || !hasDoc || !document.head) return; cssDone = true;
    const s = document.createElement('style'); s.id = 'advcss'; s.textContent = CSS; document.head.appendChild(s);
  }
  const CSS = `
#advhud { position: absolute; left: 14px; top: 14px; display: flex; align-items: center; gap: 9px; pointer-events: none; filter: drop-shadow(0 2px 6px rgba(0, 0, 0, .55)); }
#advhud .ring { position: relative; width: 58px; height: 58px; flex: none; }
#advhud .ring svg, .advsum .bigring svg { position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg); overflow: visible; }
#advhud .ring .bg, .advsum .bigring .bg { fill: rgba(8, 12, 26, .74); stroke: rgba(255, 214, 140, .2); stroke-width: 5; }
#advhud .ring .arc, .advsum .bigring .arc { fill: none; stroke-width: 5; stroke-linecap: round; transition: stroke-dashoffset .9s cubic-bezier(.2, .9, .3, 1); filter: drop-shadow(0 0 4px rgba(255, 190, 80, .8)); }
#advhud .lvl { position: absolute; inset: 0; display: grid; place-items: center; font: 900 21px/1 var(--display); color: #fff6dc; text-shadow: 0 0 10px rgba(255, 196, 90, .75), 0 1px 2px #000; }
#advhud .side { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
#advhud .tal { display: flex; align-items: center; gap: 6px; font: 700 17px/1 var(--font); color: #ffe9b0; background: rgba(8, 12, 26, .66); border: 1px solid rgba(255, 209, 102, .38); border-radius: 999px; padding: 3px 11px 3px 4px; }
#advhud .tal .ci, .advsum .tal svg, #advhud .ft svg { display: inline-flex; }
#advhud .coin, .advsum .coin { width: 20px; height: 20px; filter: drop-shadow(0 0 3px rgba(255, 196, 80, .6)); }
#advhud .st { color: #fff3c4; font-size: 14px; }
#advhud .pts { font: 800 12px/1 var(--font); color: #1a1206; background: linear-gradient(135deg, #ffe58f, #ffae42); border-radius: 999px; padding: 3px 9px; letter-spacing: .5px; box-shadow: 0 0 10px rgba(255, 196, 80, .65); }
#advhud .pts.none { display: none; }
#advhud .fl { position: absolute; left: 0; top: 64px; display: flex; align-items: center; gap: 6px; font: 800 16px/1 var(--font); color: #fff2c4; text-shadow: 0 0 8px rgba(255, 186, 70, .95), 0 1px 2px #000; white-space: nowrap; animation: advFloat 1.5s ease-out forwards; }
#advhud .ft { display: inline-flex; align-items: center; gap: 3px; } #advhud .ft svg { width: 16px; height: 16px; }
@keyframes advFloat { 0% { opacity: 0; transform: translate(0, 12px) scale(.85); } 15% { opacity: 1; transform: translate(0, 0) scale(1.08); } 80% { opacity: 1; } 100% { opacity: 0; transform: translate(0, -8px) scale(1); } }
#advhud.up .ring { animation: advPulse 1.3s ease-out; }
@keyframes advPulse { 0% { transform: scale(1); } 25% { transform: scale(1.25); filter: drop-shadow(0 0 18px rgba(255, 214, 110, 1)); } 100% { transform: scale(1); } }
#advhud.pop { animation: advPop .7s cubic-bezier(.2, 1.6, .4, 1); }
@keyframes advPop { 0% { opacity: 0; transform: scale(.5); } 100% { opacity: 1; transform: scale(1); } }
#advup { position: absolute; left: 50%; top: 31%; width: min(760px, 94vw); transform: translate(-50%, -50%); z-index: 41; pointer-events: none; text-align: center; display: none; }
#advup.on { display: block; animation: advUpIn .6s cubic-bezier(.2, 1.5, .35, 1) both; }
#advup.off { display: block; animation: advUpOut .75s ease-in both; }
@keyframes advUpIn { 0% { opacity: 0; transform: translate(-50%, -50%) scale(.5); } 100% { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
@keyframes advUpOut { 0% { opacity: 1; transform: translate(-50%, -50%) scale(1); } 100% { opacity: 0; transform: translate(-50%, -62%) scale(1.05); } }
#advup .rays { position: absolute; left: 50%; top: 50%; width: 620px; height: 620px; margin: -310px 0 0 -310px; border-radius: 50%; background: repeating-conic-gradient(from 0deg, rgba(255, 216, 128, .3) 0deg 5deg, rgba(255, 216, 128, 0) 5deg 15deg); -webkit-mask: radial-gradient(circle, #000 14%, rgba(0, 0, 0, .55) 38%, transparent 66%); mask: radial-gradient(circle, #000 14%, rgba(0, 0, 0, .55) 38%, transparent 66%); animation: advRays 3.6s ease-out both; }
@keyframes advRays { 0% { opacity: 0; transform: scale(.35) rotate(0deg); } 14% { opacity: 1; } 70% { opacity: .85; } 100% { opacity: 0; transform: scale(1.18) rotate(48deg); } }
#advup .glow { position: absolute; left: 50%; top: 50%; width: 560px; height: 250px; margin: -125px 0 0 -280px; border-radius: 50%; background: radial-gradient(ellipse at center, rgba(255, 196, 92, .62), rgba(255, 140, 60, .2) 42%, rgba(255, 140, 60, 0) 70%); animation: advGlow 3.6s ease-out both; }
@keyframes advGlow { 0% { opacity: 0; transform: scale(.6); } 18% { opacity: 1; transform: scale(1.06); } 75% { opacity: .9; } 100% { opacity: 0; transform: scale(1); } }
#advup .sparks i { position: absolute; left: 50%; top: 50%; width: 8px; height: 8px; margin: -4px; border-radius: 50%; background: #fff6cf; box-shadow: 0 0 10px 3px rgba(255, 204, 96, .95); opacity: 0; animation: advSpark 1.4s cubic-bezier(.12, .8, .3, 1) both; animation-delay: var(--d); }
@keyframes advSpark { 0% { opacity: 0; transform: translate(0, 0) scale(.5); } 12% { opacity: 1; transform: translate(calc(var(--x) * .2), calc(var(--y) * .2)) scale(1.2); } 100% { opacity: 0; transform: translate(var(--x), var(--y)) scale(.25); } }
#advup .kick { position: relative; font: 700 15px/1 var(--display); letter-spacing: 7px; color: #ffe4a6; text-shadow: 0 0 12px rgba(255, 186, 76, .95), 0 1px 2px #000; }
#advup .big { position: relative; margin: 6px 0 8px; font: 900 clamp(46px, 7.4vw, 92px)/1.04 var(--display); letter-spacing: 3px; background: linear-gradient(180deg, #fffef6 0%, #ffeeb4 42%, #ffc04c 100%); -webkit-background-clip: text; background-clip: text; color: transparent; filter: drop-shadow(0 0 16px rgba(255, 176, 66, .8)) drop-shadow(0 4px 0 rgba(70, 34, 0, .6)); }
#advup .sub { position: relative; font: 700 22px/1.25 var(--font); color: #fff5d8; text-shadow: 0 2px 8px rgba(0, 0, 0, .85), 0 0 14px rgba(255, 170, 60, .5); white-space: pre; }
#advup .how { position: relative; margin-top: 8px; font: 600 15px/1.2 var(--font); color: #dce7ff; text-shadow: 0 1px 4px #000; }
#adventure, #advstats { align-items: center; justify-content: center; background: radial-gradient(ellipse at 50% 40%, rgba(40, 26, 8, .35), rgba(4, 6, 14, .6)); }
.advcard { width: min(640px, 94vw); }
.advcard .advhead { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.advcard h2 { margin: 0; font-size: 25px; color: #ffe7a6; text-shadow: 0 0 14px rgba(255, 186, 76, .4); }
.advsum { display: grid; grid-template-columns: 104px 1fr; align-items: center; gap: 8px 18px; padding: 14px 18px; margin: 4px 0 14px; border-radius: 16px; background: linear-gradient(135deg, rgba(255, 192, 86, .16), rgba(58, 240, 255, .05)); border: 1px solid rgba(255, 209, 102, .38); box-shadow: inset 0 1px 0 rgba(255, 255, 255, .06); }
.advsum .bigring { position: relative; width: 104px; height: 104px; }
.advsum .bigring .lvl { position: absolute; inset: 0; display: grid; place-items: center; font: 900 38px/1 var(--display); color: #fff6dc; text-shadow: 0 0 14px rgba(255, 196, 90, .75); }
.advsum .lv { font: 800 23px/1.1 var(--display); color: #fff; letter-spacing: 1px; }
.advsum .xp { color: var(--muted); font-size: 15px; margin: 4px 0 6px; }
.advsum .advbar { height: 7px; border-radius: 4px; background: rgba(255, 255, 255, .08); overflow: hidden; }
.advsum .advbar i { display: block; height: 100%; border-radius: 4px; background: linear-gradient(90deg, #ffe08a, #ff9a3c); box-shadow: 0 0 10px rgba(255, 170, 70, .7); }
.advsum .advrow { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; margin-top: 10px; }
.advsum .tal { display: inline-flex; align-items: center; gap: 7px; font: 700 18px/1 var(--font); color: #ffe7a6; }
.advcard .ptsl { font: 700 15px/1 var(--font); color: var(--muted); }
.advcard .ptsl.has { color: #1a1206; background: linear-gradient(135deg, #ffe58f, #ffae42); border-radius: 999px; padding: 4px 11px; box-shadow: 0 0 10px rgba(255, 196, 80, .55); }
.advsum .go { grid-column: 1 / -1; margin-top: 4px; }
.advteaser { padding: 14px 16px; margin: 4px 0 12px; border-radius: 14px; border: 1px dashed rgba(255, 209, 102, .45); color: #ffeec4; font-size: 16px; line-height: 1.4; }
.advask { margin: 4px 0 10px; padding: 12px 14px; border-radius: 14px; background: rgba(255, 176, 86, .12); border: 1px solid rgba(255, 190, 110, .5); }
.advask p { margin: 0 0 10px; font-size: 16px; line-height: 1.4; color: #fff1d8; }
.advcard .field .note, .advcard .advfoot { font-size: 14px; color: var(--muted); margin-top: 4px; }
.adv-dim { opacity: .45; }
.adv-dim .seg button { pointer-events: none; }
.advptsline { display: flex; align-items: center; gap: 12px; margin: 0 0 10px; font: 700 18px/1 var(--font); }
.advstat { display: grid; grid-template-columns: 1fr auto 46px; align-items: center; gap: 12px; padding: 10px 12px; margin: 6px 0; border-radius: 12px; background: var(--slot); border: 1px solid var(--line); border-left: 3px solid var(--c); }
.advstat .nm { font: 700 18px/1.15 var(--font); color: #fff; }
.advstat .nm small { display: block; margin-top: 3px; font-weight: 500; font-size: 13px; color: var(--muted); }
.advstat .pips { display: flex; align-items: center; gap: 3px; }
.advstat .pips i { width: 9px; height: 17px; border-radius: 3px; background: rgba(255, 255, 255, .07); border: 1px solid rgba(255, 255, 255, .12); }
.advstat .pips i.on { background: var(--c); border-color: rgba(255, 255, 255, .55); box-shadow: 0 0 8px var(--c); }
.advstat .pips b { margin-left: 8px; min-width: 20px; font: 800 16px/1 var(--display); color: var(--c); }
.advstat .plus { min-width: 0; width: 44px; height: 40px; padding: 0; font-size: 22px; line-height: 1; }
.advresp { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 12px; }
.advresp .note, .advsn { font-size: 14px; color: var(--muted); }
.advsn { margin-top: 10px; line-height: 1.35; }
#meins .advtile { grid-column: 1 / -1; display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 14px 18px; border-radius: 16px; border: 2px solid rgba(255, 209, 102, .55); background: linear-gradient(120deg, rgba(255, 190, 80, .22), rgba(20, 28, 52, .92) 62%); color: var(--st-ink, #eef4ff); font: 700 calc(var(--st-fs, 18px) * 1.05) var(--st-font, sans-serif); text-align: left; cursor: pointer; box-shadow: 0 10px 30px rgba(0, 0, 0, .35); }
#meins .advtile small { font-weight: 500; font-size: calc(var(--st-fs, 18px) * .78); color: var(--st-mute, #a9b8d2); }
#meins .advtile:hover, #meins .advtile:focus-visible { border-color: #ffd166; box-shadow: 0 0 0 3px rgba(255, 209, 102, .35), 0 10px 30px rgba(0, 0, 0, .4); outline: none; }
#pause .advbtn.on { border-color: rgba(255, 209, 102, .7); box-shadow: 0 0 0 1px rgba(255, 209, 102, .3), 0 0 16px rgba(255, 190, 80, .25); }
@media (max-width: 700px) { #advhud { left: 8px; top: 8px; } #advhud .ring { width: 48px; height: 48px; } .advsum { grid-template-columns: 80px 1fr; } .advsum .bigring { width: 80px; height: 80px; } }
/* a-quests: the create form on a 720-px screen (a-core's open item) — name and seed side by side, tighter rows, the
   action row sticky at the bottom: „Welt erstellen" is in view without scrolling */
@media (max-height: 820px) {
  #create .panel.box { display: grid; grid-template-columns: 1fr 1fr; column-gap: 14px; padding-top: 16px; padding-bottom: 14px; }
  #create .panel.box > * { grid-column: 1 / -1; }
  #create .panel.box > .field:has(#cw_name) { grid-column: 1; grid-row: 2; }
  #create .panel.box > .field:has(#cw_seed) { grid-column: 2; grid-row: 2; }
  #create .panel.box h2 { margin-bottom: 4px; }
  #create .field { margin: 5px 0; gap: 4px; }
  #create .seg button { min-height: 40px; padding-top: 5px; padding-bottom: 5px; }
  #create .advwaynote { margin-top: 1px; font-size: 13px; }
  #create .hr { margin: 6px 0; }
  #create label.note { min-height: 34px; }
}
#create .panel.box > .row.gap:last-child { position: sticky; bottom: -14px; z-index: 2; padding: 8px 0 6px; background: linear-gradient(180deg, rgba(12, 17, 34, 0), rgba(12, 17, 34, .96) 35%); }
@media (prefers-reduced-motion: reduce) { #advup .rays, #advup .sparks { display: none; } #advup.on, #advup.off, #advhud.up .ring, #advhud.pop, #advhud .fl { animation-duration: .01s; } #advhud .ring .arc { transition: none; } }
`;
})(VR);

// ============================================================================
// ✨ Wunder der Welt in the game (wonders.js has the sites and the eight
// wonders). The worker lists the sites around you; when you come within 160
// blocks of one that is not built yet and its lot is loaded, the game looks at
// the land: columns it never saved or changed are as the generator made them;
// a changed one is compared with a fresh generation of it, and anything a
// person did there (beyond grass, plants, leaves, water and snow changing on
// their own) marks the site blocked — a wonder never lands on someone's
// building. Then it is planned like a Forge plan (the worker builds the piece,
// blueprints.js levels the lot) and rises from the ground in slices over a few
// seconds — the light of its columns computed once at the end, sparkles along
// the rising edge, a soft chime. Standing within four blocks of its glowing
// heart is the discovery: a big banner, a fanfare, the codex page and a gift:
// /bau <Name> builds that wonder wherever you like. The Wunderkompass at the
// top of the screen points to the nearest one not found yet. meta.wonders
// keeps it all with the world; with friends only the host builds (its blocks go
// to the guests), every page discovers on its own.
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R, F = VR.F;
  const T = (k, v, fb) => (VR.I18N ? VR.I18N.t(k, v, fb) : (fb !== undefined ? fb : k));
  const ROT = [(u, v) => [u, v], (u, v) => [-v, u], (u, v) => [-u, -v], (u, v) => [v, -u]];
  const NEAR = 160, FOUND = 4, ASK_R = 1300, STEP = 0.1;
  const ARROWS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
  // meta.wonders[key].status: 'building' (rising, or cut short by leaving the world) · 'built' · 'found' (built and
  // discovered; .found is the time) · 'blocked' (a person's work on the lot, or no room: never built)
  const STANDS = (e) => !!e && (e.status === 'built' || e.status === 'found');
  // the turning light's motes and the sparkles: one options object each, filled anew per mote (particles.js copies it)
  const BEAMO = { life: 0.14, size: 0.12, grav: 0, col: [1, 0.95, 0.75], emis: 1, drag: 0, collide: false, uv: [0, 0, 1, 1] };
  const SPARKO = { life: 1, size: 0.16, grav: -0.4, col: null, emis: 1, drag: 0.6, collide: false, uv: [0, 0, 1, 1] };
  // the sparkle colours of each wonder
  const GLOW = { kristall: [0.78, 0.55, 1], regenbogen: [1, 0.85, 0.4], sternwarte: [1, 0.86, 0.45], riesenbaum: [0.7, 1, 0.55], wolkenturm: [1, 0.95, 0.8], labyrinth: [0.6, 1, 0.8], pyramide: [1, 0.78, 0.3], mondtempel: [0.65, 0.85, 1] };
  // what changes on its own in untouched land (no person needed): plants, leaves, water, snow, fire — and grass ↔ dirt
  let SOFT = null, SOIL = null, ICE = -1, WATER = -1;
  function tables() {
    if (SOFT) return;
    SOFT = new Uint8Array(R.types.length); SOIL = new Uint8Array(R.types.length);
    for (const t of R.types) {
      if (!t || !t.name) continue;
      const fl = R.T.flags[t.defaultState];
      if ((fl & (F.PLANT | F.LEAVES | F.FLUID)) || /^(snow|fire|spirit_fire|sugar_cane|cactus|bamboo|bamboo_shoot|vines|glow_lichen|moss_carpet|leaf_litter)$/.test(t.name)) SOFT[t.id] = 1;
      if (/^(grass_block|dirt|coarse_dirt|podzol|mycelium|farmland|dirt_path|rooted_dirt)$/.test(t.name)) SOIL[t.id] = 1;
    }
    ICE = R.byName.ice ? R.byName.ice.id : -1; WATER = R.byName.water ? R.byName.water.id : -1;
  }
  // pristine state a → current b: something nature does by itself?
  function natural(a, b) {
    const ta = R.T.type[a], tb = R.T.type[b];
    if ((!a || SOFT[ta]) && (!b || SOFT[tb])) return true;
    if (a && b && SOIL[ta] && SOIL[tb]) return true;
    if ((ta === ICE && tb === WATER) || (ta === WATER && tb === ICE)) return true;
    return false;
  }
  VR.WonderNatural = (a, b) => { tables(); return natural(a, b); };

  class WondersGame {
    constructor(g, meta) {
      this.g = g; this.meta = meta || {};
      this.st = this.meta.wonders && typeof this.meta.wonders === 'object' ? this.meta.wonders : {};
      if (!this.meta.guest) this.meta.wonders = this.st;
      this.sites = []; this.siteAt = null; this.asking = false; this.more = false; this.askT = 0;
      this.planT = 1; this.findT = 0.5; this.compT = 0; this.beamA = 0;
      this.job = null; this.rise = null; this.hearts = new Map();
      this.beams = []; for (const k in this.st) { const e = this.st[k]; if (e && e.beam && STANDS(e)) this.beams.push(e.beam); }
    }
    get on() { const g = this.g; return !!(VR.Wonders && g.world && g.dim === 'overworld' && g.meta && g.meta.type !== 'flat'); }
    spawn() { const ws = this.g.worldSpawn ? this.g.worldSpawn() : [0.5, 64, 0.5]; return [ws[0], ws[2]]; }
    name(type) { const t = VR.Wonders && VR.Wonders.type(type); return T('g.wonder.n.' + type, null, t ? t.de : type); }
    beforeSave(meta) { if (!meta.guest) meta.wonders = this.st; }
    destroy() { this.dead = true; if (this.compEl) this.compEl.style.display = 'none'; this.rise = null; this.job = null; }
    blue() { const gd = this.g.gadgets; return gd && gd.blue; }

    // ---------------------------------------------------------------- every frame (E: the environment of the frame)
    update(dt, E) {
      if (!this.on || this.dead) { this.compass(dt, true); return; }
      this.refresh(dt);
      if (this.rise) this.tickRise(dt);
      else this.plan(dt);
      this.discover(dt);
      this.compass(dt, false);
      this.beam(dt, E);
    }
    // the sites around the player (the worker computes the cells it has time for; more → ask again soon)
    refresh(dt) {
      const g = this.g, p = g.player; if (!p || !g.pool || this.asking) return;
      // the first list waits until the land around you has loaded (at most 8 s): its first cell — the spawn's, with
      // the village sites the worker works out for it — takes the worker a few hundred ms, better not in the loading
      if (!this.siteAt && (this.waitT = (this.waitT || 0) + dt) < 8 && g.world.pending && g.world.pending.size > 0) return;
      this.askT -= dt;
      const moved = !this.siteAt || Math.hypot(p.pos[0] - this.siteAt[0], p.pos[2] - this.siteAt[1]) > 200;
      if (this.askT > 0 || (!moved && !this.more)) return;
      this.asking = true; this.askT = this.more ? 0.8 : 3;
      const at = [p.pos[0], p.pos[2]];
      g.pool.direct(0, { type: 'wonders', dim: g.dim, x: Math.floor(at[0]), z: Math.floor(at[1]), r: ASK_R, spawn: this.spawn(), budget: 120 }, null, (m) => {
        this.asking = false;
        if (this.dead || m.type !== 'wonders') return;
        this.sites = m.list || []; this.siteAt = at; this.more = !!m.more;
      });
    }
    // where a site's lot lies: {dna, lot, r, ox, oz, rect, x0, z0, x1, z1}
    lotOf(s) {
      const W = VR.Wonders, Fg = VR.Forge, dna = W.dnaOf(s), M = Fg.meta(dna); if (!M) return null;
      const LW = M.lot[0], LD = M.lot[1], r = (s.r | 0) & 3, c = ROT[r](LW >> 1, LD >> 1), ox = s.x - c[0], oz = s.z - c[1];
      const rect = (u0, v0, u1, v1) => { const a = ROT[r](u0, v0), b = ROT[r](u1, v1); return [ox + Math.min(a[0], b[0]), oz + Math.min(a[1], b[1]), ox + Math.max(a[0], b[0]), oz + Math.max(a[1], b[1])]; };
      const [x0, z0, x1, z1] = rect(0, 0, LW - 1, LD - 1);
      return { dna, lot: M.lot, r, ox, oz, rect, x0, z0, x1, z1 };
    }
    loaded(x0, z0, x1, z1) { const w = this.g.world; for (let cz = z0 >> 4; cz <= z1 >> 4; cz++) for (let cx = x0 >> 4; cx <= x1 >> 4; cx++) { const c = w.col(cx, cz); if (!c || !c.ready) return false; } return true; }
    // the floor of a lot: the middle of its ground heights (+1), so the levelling cuts as much as it fills
    floorOf(L, y0) {
      const b = this.blue(), hs = [];
      for (let k = 0; k <= 8; k++) for (let q = 0; q <= 8; q++) { const x = Math.round(L.x0 + (L.x1 - L.x0) * k / 8), z = Math.round(L.z0 + (L.z1 - L.z0) * q / 8); hs.push(b.groundAt(x, z, y0 + 48, y0 - 48)); }
      hs.sort((a, c) => a - c);
      return hs[hs.length >> 1] + 1;
    }
    // ---------------------------------------------------------------- planning: the nearest unbuilt site in reach
    plan(dt) {
      const g = this.g, p = g.player, b = this.blue();
      if (!p || !b || g.meta.guest || (g.mp && g.mp.isClient)) return;     // with friends, the host builds
      if (this.job) { this.advance(); return; }
      this.planT -= dt; if (this.planT > 0) return; this.planT = 0.5;
      let best = null, bd = NEAR;
      for (const s of this.sites) { const e = this.st[s.key]; if (e && e.status !== 'building') continue; const d = Math.hypot(s.x - p.pos[0], s.z - p.pos[2]); if (d < bd) { bd = d; best = s; } }
      if (!best) return;
      const L = this.lotOf(best); if (!L) { this.st[best.key] = { type: best.type, status: 'blocked', why: 'dna' }; return; }
      if (!this.loaded(L.x0 - 4, L.z0 - 4, L.x1 + 4, L.z1 + 4)) return;          // the lot and its verge (a short render distance: when you are closer)
      const prior = this.st[best.key], F0 = prior && prior.status === 'building' && prior.at ? prior.at[1] : this.floorOf(L, best.y);
      if (F0 < 2 || F0 + 130 >= VR.MAXY) { this.st[best.key] = { type: best.type, status: 'blocked', why: 'height' }; return; }
      const pl = { id: 'wonder-' + best.key, kind: 'forge', dna: L.dna, ox: L.ox, oz: L.oz, F: F0, r: L.r };
      this.job = { site: best, L, pl, phase: prior && prior.status === 'building' ? 'piece' : 'check', t0: performance.now() };
      this.advance();
    }
    advance() {
      const J = this.job, b = this.blue(); if (!J || !b) return;
      if (J.phase === 'check') { this.editCheck(J); return; }
      if (J.phase !== 'piece') return;
      const bp = b.forgePiece(J.pl);
      if (!bp) { if (J.pl.failed) { this.st[J.site.key] = { type: J.site.type, status: 'blocked', why: 'piece' }; this.job = null; } return; }
      if (!this.loaded(J.L.x0 - 4, J.L.z0 - 4, J.L.x1 + 4, J.L.z1 + 4)) return;
      const t0 = performance.now();
      const { list } = b.planAt({ bp, r: J.L.r, ox: J.L.ox, oz: J.L.oz, F: J.pl.F, x0: J.L.x0, z0: J.L.z0, x1: J.L.x1, z1: J.L.z1, rect: J.L.rect, ok: true });
      this.planMs = performance.now() - t0;
      this.startRise(J, bp, list);
    }
    // ---------------------------------------------------------------- untouched land? (columns compared with the generator)
    editCheck(J) {
      tables();
      const g = this.g, w = g.world, L = J.L, x0 = L.x0 - 3, z0 = L.z0 - 3, x1 = L.x1 + 3, z1 = L.z1 + 3, cols = [];
      for (let cz = z0 >> 4; cz <= z1 >> 4; cz++) for (let cx = x0 >> 4; cx <= x1 >> 4; cx++) { const c = w.col(cx, cz); if (!c) return; if (c.saved || c.modified || w.savedKeys.has(c.key)) cols.push(c); }
      if (!cols.length) { J.phase = 'piece'; this.advance(); return; }
      J.phase = 'checking';
      let left = cols.length, edited = false, failed = false;
      const yLo = Math.max(1, J.pl.F - 6), yHi = J.pl.F + 124;
      for (const c of cols) {
        g.pool.submit({ type: 'gen', dim: w.dim, cx: c.cx, cz: c.cz }, null, (m) => {
          if (this.job !== J || this.dead) return;
          if (!m || m.type !== 'gen') failed = true;
          else if (!edited) {
            const cur = this.g.world.col(c.cx, c.cz); const now = cur && cur.blocks;
            if (!now) failed = true;
            else {
              const pr = m.blocks, bx = c.cx * 16, bz = c.cz * 16;
              for (let lz = 0; lz < 16 && !edited; lz++) for (let lx = 0; lx < 16 && !edited; lx++) {
                const x = bx + lx, z = bz + lz; if (x < x0 || x > x1 || z < z0 || z > z1) continue;
                for (let y = yLo; y <= yHi; y++) { const i = (y << 8) | (lz << 4) | lx, a = i < pr.length ? pr[i] : 0, s = i < now.length ? now[i] : 0; if (a !== s && !natural(a, s)) { edited = true; this.editAt = [x, y, z, a, s]; break; } }
              }
            }
          }
          if (--left) return;
          if (failed) { J.phase = 'check'; this.job = null; this.planT = 2; return; }     // ask again in a moment
          if (edited) { this.st[J.site.key] = { type: J.site.type, seed: J.site.seed, r: J.site.r, status: 'blocked', why: 'edit', at: [J.site.x, J.pl.F, J.site.z] }; this.job = null; return; }
          J.phase = 'piece'; this.advance();
        }, 40);
      }
      g.pool.queueDirty = true;
    }
    // ---------------------------------------------------------------- the rise: cleared and filled at once, then row band by row band
    startRise(J, bp, list) {
      const g = this.g, w = g.world, F0 = J.pl.F, pre = [], up = [];
      for (const c of list) { if (c[3] === 0 || c[1] < F0) pre.push(c); else up.push(c); }
      up.sort((a, b) => a[1] - b[1]);
      const y0 = up.length ? up[0][1] : F0, rows = up.length ? up[up.length - 1][1] - y0 + 1 : 1;
      const dur = Math.max(3, Math.min(5.5, 2.4 + rows / 30)), steps = Math.max(1, Math.round(dur / STEP));
      const h = bp.heart, q = h ? ROT[J.L.r](h[0], h[2]) : null;
      const heart = h ? [J.L.ox + q[0], F0 + h[1], J.L.oz + q[1]] : [J.site.x, F0 + 1, J.site.z];
      this.st[J.site.key] = { type: J.site.type, seed: J.site.seed, r: J.site.r, status: 'building', at: [J.L.ox, F0, J.L.oz], heart, t: Date.now() };
      const defer = new Set();
      if (pre.length) { w.bulkSet(pre, false, defer); this.toGuests(pre); w.relightColumns([...defer]); defer.clear(); }
      const beam = bp.beam ? (() => { const b2 = ROT[J.L.r](bp.beam[0], bp.beam[2]); return [J.L.ox + b2[0] + 0.5, F0 + bp.beam[1] + 0.5, J.L.oz + b2[1] + 0.5]; })() : null;
      if (beam) this.st[J.site.key].beam = beam;
      this.rise = { J, bp, up, at: 0, k: 0, steps, y0, rows, t: 0, defer, w, col: GLOW[J.site.type] || [1, 0.9, 0.6], n: list.length };
      if (g.audio) g.audio.play('wonder');
      if (g.ui && g.ui.chatLine) g.ui.chatLine(T('g.wonder.rising'), '#ffe7a6');
    }
    tickRise(dt) {
      const S = this.rise, g = this.g, w = g.world;
      if (S.w !== w) { this.rise = null; this.job = null; return; }          // another world now: this one resumes it later
      S.t -= dt; if (S.t > 0) return;
      S.t = STEP; S.k++;
      const yTop = S.y0 + Math.ceil(S.rows * S.k / S.steps), from = S.at;
      let to = from; while (to < S.up.length && S.up[to][1] < yTop) to++;
      if (to > from) {
        const chunk = S.up.slice(from, to);
        w.bulkSet(chunk, false, S.defer); this.toGuests(chunk); S.at = to;
        this.sparkle(chunk, S.col);
      }
      if (S.at >= S.up.length) this.finishRise();
    }
    // glows along the rising edge: a dozen of the newest cells' tops, some big enough to see from afar
    sparkle(chunk, col) {
      const P = this.g.particles; if (!P) return;
      const n = Math.min(16, chunk.length);
      for (let k = 0; k < n; k++) {
        const c = chunk[(Math.random() * chunk.length) | 0];
        SPARKO.life = 0.9 + Math.random() * 0.9; SPARKO.size = k < 4 ? 0.45 : 0.16; SPARKO.col = col;
        P.spawn(c[0] + Math.random(), c[1] + 1.05, c[2] + Math.random(), (Math.random() - 0.5) * 0.6, 0.8 + Math.random() * 1.6, (Math.random() - 0.5) * 0.6, SPARKO);
      }
    }
    finishRise() {
      const S = this.rise, g = this.g, w = g.world, key = S.J.site.key;
      w.relightColumns([...S.defer]);
      const e = this.st[key]; e.status = e.found ? 'found' : 'built'; e.builtAt = Date.now();
      if (e.beam) this.beams.push(e.beam);
      this.rise = null; this.job = null;
      if (g.player && g.player.unstick) g.player.unstick();
      const P = g.particles, h = e.heart;
      if (P && h) P.spark(h[0] + 0.5, h[1] + 1, h[2] + 0.5, S.col, 60, 6);
      // into the save soon (the wonder's columns and the record that it stands)
      clearTimeout(this.saveT); this.saveT = setTimeout(() => { if (this.g.world === w && !this.g.meta.guest) Promise.resolve().then(() => this.g.saveMeta()).then(() => w.saveAll()).catch(() => { /* the autosave keeps it */ }); }, 600);
    }
    // multiplayer: the host's new blocks go to the guests as live block changes
    toGuests(list) { const mp = this.g.mp; if (!mp || !mp.isHost || !mp.active) return; for (const c of list) mp.onBlockChanged(c[0], c[1], c[2], 0, c[3]); }

    // ---------------------------------------------------------------- discovery: standing within four blocks of the heart
    discover(dt) {
      this.findT -= dt; if (this.findT > 0) return; this.findT = 0.25;
      const p = this.g.player; if (!p || p.dead) return;
      for (const s of this.sites) {
        const e = this.st[s.key]; if (e && (e.found || e.status === 'blocked')) continue;
        if (Math.abs(s.x - p.pos[0]) > 48 || Math.abs(s.z - p.pos[2]) > 48) continue;
        const h = this.heartOf(s); if (!h) continue;
        if (Math.hypot(h[0] + 0.5 - p.pos[0], h[1] + 0.5 - (p.pos[1] + 0.9), h[2] + 0.5 - p.pos[2]) <= FOUND) this.found(s, h);
      }
    }
    // the heart of a site's wonder: known when this page built it; else (a guest, or one the host built) its column is
    // searched for the glowing block the wonder has there
    heartOf(s) {
      const e = this.st[s.key]; if (e && e.heart && STANDS(e)) return e.heart;
      if (e && e.status === 'building') return null;
      const c = this.hearts.get(s.key); if (c) return c.h;
      const b = this.blue(), L = this.lotOf(s); if (!b || !L) return null;
      const bp = b.forgePiece({ id: 'wonder-' + s.key, kind: 'forge', dna: L.dna, ox: L.ox, oz: L.oz, F: s.y, r: L.r });
      if (!bp || !bp.heart) return null;
      if (bp.heartState === undefined) { bp.heartState = 0; for (let k = 0; k < bp.ops.length; k += 4) if (bp.ops[k] === bp.heart[0] && bp.ops[k + 1] === bp.heart[1] && bp.ops[k + 2] === bp.heart[2]) { bp.heartState = bp.ops[k + 3]; break; } }
      const q = ROT[L.r](bp.heart[0], bp.heart[2]), x = L.ox + q[0], z = L.oz + q[1], w = this.g.world;
      if (!w.col(x >> 4, z >> 4)) return null;
      for (let y = s.y + 40; y >= s.y - 30; y--) { const st = w.getBlock(x, y, z); if (st && st === VR.Custom.rotState(bp.heartState, L.r)) { const h = [x, y, z]; this.hearts.set(s.key, { h }); return h; } }
      return null;
    }
    found(s, h) {
      const g = this.g, name = this.name(s.type);
      this.st[s.key] = Object.assign(this.st[s.key] || { type: s.type, seed: s.seed, r: s.r, heart: h }, { status: 'found', found: Date.now() });
      this.banner(T('g.wonder.found', { name }));
      if (g.audio) g.audio.play('fanfare');
      if (g.codex && g.codex.unlock) g.codex.unlock('w:' + s.type, true);
      if (g.ui && g.ui.chatLine) g.ui.chatLine(T('g.wonder.gift', { name }), '#ffe7a6');
      const P = g.particles; if (P) { P.spark(h[0] + 0.5, h[1] + 1, h[2] + 0.5, GLOW[s.type] || [1, 0.9, 0.5], 80, 7); for (let k = 0; k < 24; k++) P.glow(h[0] + 0.5 + (Math.random() - 0.5) * 3, h[1] + 0.5 + Math.random() * 2, h[2] + 0.5 + (Math.random() - 0.5) * 3, GLOW[s.type] || [1, 0.9, 0.5], 2.2, 0.12, 0.6); }
      if (!g.meta.guest) Promise.resolve().then(() => g.saveMeta()).catch(() => { /* the autosave keeps it */ });
    }
    // the big banner in the middle of the screen (2.5 s, then it fades) — not the small toast
    banner(text) {
      let el = document.getElementById('wbanner');
      if (!el) { el = document.createElement('div'); el.id = 'wbanner'; (document.getElementById('app') || document.body).appendChild(el); }
      el.textContent = text; el.classList.remove('off'); el.classList.add('on');
      clearTimeout(this.bannerT); this.bannerT = setTimeout(() => { el.classList.remove('on'); el.classList.add('off'); }, 2500);
    }
    // the wonders this world has found (a type → the seed of one found here): /bau builds those
    foundSeed(type) { for (const k in this.st) { const e = this.st[k]; if (e && e.type === type && e.found) return e.seed || 1; } return 0; }

    // ---------------------------------------------------------------- ✨ the Wunderkompass: the nearest site not found yet
    compass(dt, off) {
      this.compT -= dt; if (this.compT > 0 && !off) return; this.compT = 0.2;
      const g = this.g, p = g.player;
      let el = this.compEl;
      if (!el) { el = this.compEl = document.getElementById('wcompass'); if (!el) { el = this.compEl = document.createElement('div'); el.id = 'wcompass'; (document.getElementById('hud') || document.body).appendChild(el); } }
      let text = '';
      if (!off && p && g.settings.wonderCompass !== false && !(g.ui && g.ui.screen) && !g.hideHud && !g.photo) {
        let best = null, bd = 1e9;
        for (const s of this.sites) { const e = this.st[s.key]; if (e && (e.found || e.status === 'blocked')) continue; const d = Math.hypot(s.x - p.pos[0], s.z - p.pos[2]); if (d < bd) { bd = d; best = s; } }
        if (best) {
          const a = Math.atan2(best.x - p.pos[0], -(best.z - p.pos[2])), rel = ((Math.round((a + p.yaw) * 180 / Math.PI) % 360) + 540) % 360 - 180;
          const m = bd < 100 ? Math.round(bd) : Math.round(bd / 10) * 10;
          text = '✨ ' + m.toLocaleString(VR.I18N && VR.I18N.locale ? VR.I18N.locale() : 'de-DE') + ' m ' + ARROWS[((Math.round(rel / 45) % 8) + 8) % 8];
        }
      }
      if (text !== this.compText) { this.compText = text; el.textContent = text; el.style.display = text ? 'block' : 'none'; }
    }
    // the Wolkenleuchtturm's light turns at night: a beam of glowing motes sweeping round its lantern room (no allocation)
    beam(dt, E) {
      const P = this.g.particles, p = this.g.player; if (!P || !p || !E || !(E.night > 0.35) || !this.beams.length) return;
      this.beamA += dt * 1.1;
      for (let j = 0; j < this.beams.length; j++) {
        const b = this.beams[j]; if (Math.abs(b[0] - p.pos[0]) > 260 || Math.abs(b[2] - p.pos[2]) > 260) continue;
        for (let side = 0; side < 2; side++) {
          const a = this.beamA + side * Math.PI, dx = Math.cos(a), dz = Math.sin(a);
          for (let i = 0; i < 4; i++) { const d = 3 + Math.random() * 46; BEAMO.size = 0.12 + d * 0.012; P.spawn(b[0] + dx * d, b[1] + (Math.random() - 0.5) * 0.6, b[2] + dz * d, 0, 0, 0, BEAMO); }
        }
      }
    }
    // the map's marks: found wonders (✨ and their name) and the sites not found yet within 1 km of the player (?) —
    // worked out at most twice a second (the minimap asks every frame it redraws)
    marks() {
      const now = performance.now(); if (this.marksAt && now - this.marksAt < 500) return this.marksList;
      this.marksAt = now;
      const p = this.g.player, out = this.marksList = [];
      for (const s of this.sites) { const e = this.st[s.key]; if (e && e.found) out.push({ x: s.x, z: s.z, found: true, name: this.name(s.type) }); else if (!(e && e.status === 'blocked') && p && Math.hypot(s.x - p.pos[0], s.z - p.pos[2]) <= 1000) out.push({ x: s.x, z: s.z, found: false }); }
      for (const k in this.st) { const e = this.st[k]; if (e.found && e.heart && !this.sites.some(s => s.key === k)) out.push({ x: e.heart[0], z: e.heart[2], found: true, name: this.name(e.type) }); }
      return out;
    }
  }
  VR.WondersGame = WondersGame;
})(VR);

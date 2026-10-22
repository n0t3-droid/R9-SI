// ============================================================================
// VR.NewLife — neues Leben (u-home · docs/superpowers/plans/2026-10-22-u-home.md; universe spec §9). One home per player
// on any world of the save. A bed or 📍 „Hier wohne ich" makes the world you are on your home; respawn and 🏠 go there
// (from any other world the trip home, no question asked); 🌍 Herzwelt is always one click away; the compass points home
// on the home's world and up („zum Schiff") elsewhere; the start screen's world card shows where you live and where you
// are, with the body as a small lit disc; Heimkehr brings the ships you left on other worlds to the home pad.
// The save: meta.universe.home = {dim, pos, since, bed} only when the home is not the save's home dim (Herzwelt, or a flat
// world's land) — there the spot stays where every old path reads it (player.spawn, spawnBed): every old world lives on
// Herzwelt, exactly as before. A guest's home rides in pdata (mp.js), kept by the host.
// Heimkehr in a moment: a trip that leaves the world of a Heimkehr target keeps the 5 × 5 columns round that target —
// their meshes stay on the GPU, out of the renderer's prop list while away — and the next start of that world adopts them
// (shown at once); any trip ends its loading as soon as the 5 × 5 round the arrival are in, the far lane idling meanwhile.
// Cost: nothing per frame (a compass line every 0.2 s while the minimap shows; Travel.update tests one field).
// ============================================================================
(function (VR) {
  'use strict';
  const D = VR.DimReg;
  const T = (k, v) => (VR.I18N ? VR.I18N.t(k, v) : k);
  const fill = (s, v) => String(s).replace(/\{(\w+)\}/g, (m, n) => (v && v[n] !== undefined ? v[n] : m));
  const tx = (k, v, de, en) => (VR.I18N && VR.I18N.tx ? VR.I18N.tx(k, v, de, en) : fill(de, v));
  const finite = (a, n) => Array.isArray(a) && a.length >= n && a.slice(0, n).every((v) => typeof v === 'number' && Number.isFinite(v));
  const r2 = (v) => Math.round(v * 100) / 100;
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const styleOf = (el) => el.style || (el.style = {});

  const NL = VR.NewLife = {
    KEEP_R: 2,        // the kept ring: (2·2 + 1)² columns round a Heimkehr target
    NEAR_R: 2,        // the early arrival's ring (the loading screen's own, first.js NEAR_R)
    COMPASS_NEAR: 24, // m: closer than this the compass says nothing about home
    PAD_HEART: 600,   // m: a Heartland home this near the Gate Temple parks its ships on the temple's apron
    lastTrip: null,   // the last trip's phases (arrived)
  };

  // ---------------------------------------------------------------- words
  // where: „auf Herzwelt", „auf den Driftinseln", „in der Unterschmiede" … (a dim may bring its own: DimReg def.at)
  const AT = {
    overworld: ['g.nl.at.overworld', 'auf Herzwelt', 'on Heartworld'],
    flat: ['g.nl.at.flat', 'auf der Flachwelt', 'on the flat world'],
    underforge: ['g.nl.at.underforge', 'in der Unterschmiede', 'in the Underforge'],
    hollow: ['g.nl.at.hollow', 'in der Hohlwelt', 'in the Hollow'],
    drift: ['g.nl.at.drift', 'auf den Driftinseln', 'on the Drift Isles'],
    opal: ['g.nl.at.opal', 'auf Opal', 'on Opal'],
    basalt: ['g.nl.at.basalt', 'auf Basalt', 'on Basalt'],
    aqua: ['g.nl.at.aqua', 'auf Aquamarin', 'on Aquamarine'],
    zinn: ['g.nl.at.zinn', 'auf Zinnober', 'on Cinnabar'],
    ocker: ['g.nl.at.ocker', 'auf Ocker', 'on Ochre'],
  };
  const name = (dim) => (VR.Travel ? VR.Travel.dimName(dim) : (D.name(dim)[1]));
  NL.at = (dim) => { const d = D.get(dim), a = (d && d.at) || AT[dim]; return a ? tx(a[0], null, a[1], a[2]) : tx('g.nl.at.other', { world: name(dim) }, 'auf {world}', 'on {world}'); };
  // a body of Helia by its id, in the player's language (VR.Universe, u-orbit); the id itself without it
  const bodyName = (id) => {
    const U = VR.Universe, b = U && U.home && U.home.by && U.home.by[id];
    if (b && b.name) return VR.I18N && VR.I18N.lang !== 'de' ? (b.name.en || b.name.de) : b.name.de;
    return String(id || '').replace(/^./, (c) => c.toUpperCase());
  };

  // ---------------------------------------------------------------- the home
  // {dim, pos, bed, since, implicit}: the stored home when its world is known and is not the save's home dim; else the
  // save's home dim (Herzwelt, a flat world's land) at the player's spot — every old save, and a home on a world this
  // build does not know (left untouched in the save for a newer build)
  NL.homeOf = function (meta, player) {
    const m = meta || {}, herz = D.home(m), U = m.universe, h = U && U.home;
    if (h && typeof h === 'object' && typeof h.dim === 'string' && h.dim !== herz && D.has(h.dim) && !D.get(h.dim).home && finite(h.pos, 3)) {
      return { dim: h.dim, pos: h.pos.slice(0, 3), bed: finite(h.bed, 3) ? h.bed.slice(0, 3) : null, since: +h.since || 0, implicit: false };
    }
    const pl = player || m.player || null;
    const sp = pl && finite(pl.spawn, 3) ? pl.spawn : (finite(m.worldSpawn, 3) ? m.worldSpawn : [0.5, 100, 0.5]);
    return { dim: herz, pos: sp.slice(0, 3), bed: pl && finite(pl.spawnBed, 3) ? pl.spawnBed.slice(0, 3) : null, since: 0, implicit: true };
  };
  NL.home = (g) => NL.homeOf(g && g.meta, g && g.player);
  NL.homeDim = (g) => NL.home(g).dim;
  // Heimkehr's target: the home ({dim, pos} — a bed only on the save's home dim: a gone bed falls back to worldSpawn(),
  // Herzwelt's numbers, never usable on another world); Herzwelt's spot and bed for the implicit home
  NL.target = function (g) {
    if (!g || !g.meta) return null;
    const h = NL.home(g);
    if (h.implicit) return VR.Travel && VR.Travel.herzTarget ? VR.Travel.herzTarget(g) : { dim: h.dim, pos: h.pos, bed: h.bed };
    return { dim: h.dim, pos: h.pos.slice(0, 3), bed: null };
  };

  // this world becomes the home (one home per player): Herzwelt keeps its spot in p.spawn and stores nothing; any other
  // world is stored with its spot, the day you moved in and a bed. 'spot' (the same world) · 'moved' (a new world) · false
  function setHome(g, pos, bed) {
    const m = g && g.meta, p = g && g.player; if (!m || !p || !finite(pos, 3)) return false;
    const herz = D.home(m), dim = g.dim || herz, before = NL.homeOf(m, p);
    if (dim === herz) {
      p.spawn = pos.slice(0, 3); p.spawnBed = finite(bed, 3) ? bed.slice(0, 3) : null;
      if (m.universe && m.universe.home) delete m.universe.home;
    } else {
      const U = m.universe || (m.universe = { v: 1 });
      U.home = { dim, pos: pos.slice(0, 3).map(r2), since: before.dim === dim && !before.implicit && before.since ? before.since : Date.now(), bed: finite(bed, 3) ? bed.slice(0, 3) : null };
    }
    if (before.dim === dim) return 'spot';
    const at = NL.at(dim), herzN = name(herz);
    const line = dim === herz ? tx('g.nl.movedHerz', { at }, '🏠 Du wohnst wieder {at}', '🏠 You live {at} again')
      : tx('g.nl.moved', { at, herz: herzN }, '🏠 Du wohnst jetzt {at} — 🌍 {herz} bleibt einen Klick entfernt', '🏠 You live {at} now — 🌍 {herz} stays one click away');
    if (g.ui) { if (g.ui.hint) g.ui.hint(line, 3600); if (g.ui.chatLine) g.ui.chatLine(line, '#9affd8'); }
    return 'moved';
  }
  // 📍 in the pause menu („Mein Platz ist hier" on the home world, „Hier wohne ich" elsewhere) and /sethome (exact)
  NL.pin = function (g, pos, exact) {
    const p = g && g.player; if (!p || p.dead || !g.meta || g.meta.guest) return false;
    const q = finite(pos, 3) ? pos : p.pos;
    const at = exact ? q.slice(0, 3) : [Math.floor(q[0]) + 0.5, Math.floor(q[1] + 0.01), Math.floor(q[2]) + 0.5];
    const r = setHome(g, at, null);
    if (r && g.saveMeta) { try { g.saveMeta(); } catch (e) { /* the next save takes it */ } }
    return r;
  };
  // a bed (crafting.js g.sleep) — a guest's too: its home lives in the guest's session and rides in pdata
  NL.bed = function (g, x, y, z) {
    if (!g || !g.player || !g.meta) return false;
    return setHome(g, [x + 0.5, y + 0.6, z + 0.5], [x, y, z]);
  };
  // the bed of a home off the save's home dim: gone (broken while away) → the spot stays, the bed is forgotten
  function bedCheck(g) {
    const m = g.meta, h = m && m.universe && m.universe.home, w = g.world, R = VR.R;
    if (!h || !finite(h.bed, 3) || !w || !w.isLoaded || !w.isLoaded(h.bed[0], h.bed[2]) || h.dim !== g.dim || !R) return;
    const s = w.getBlock(h.bed[0], h.bed[1], h.bed[2]), t = R.types[R.T.type[s]];
    if (t && t.o && (t.o.bed || t.o.kind === 'bed')) return;
    h.bed = null;
    if (g.ui && g.ui.chatLine) g.ui.chatLine(T('g.chat.bedGone'), '#ffb86a');
  }
  const riding = (g) => { if (g.gadgets && g.gadgets.riding) { if (g.ui && g.ui.chatLine) g.ui.chatLine(T('g.chat.landFirst'), '#ff8a8a'); return true; } return false; };

  // ---------------------------------------------------------------- the ways home
  // 🏠 (the pause menu, /home, the hold-V ring): the home on this world → there; any other world → the trip there, no
  // question asked. A guest keeps the old goHome (the host's world). Heimkehr brings the ships left elsewhere.
  NL.goHome = function (g) {
    const m = g && g.meta, p = g && g.player; if (!m || !p || m.guest) return false;
    if (p.dead) return true;
    const h = NL.homeOf(m, p), here = g.dim || D.home(m);
    if (h.dim !== here) { if (!VR.Travel) return false; VR.Travel.go(g, { dim: h.dim, via: 'home' }); return true; }
    if (riding(g)) return true;
    p.safeTeleport(h.pos[0], h.pos[1], h.pos[2], { bed: h.implicit ? h.bed : null });
    if (!h.implicit) bedCheck(g);
    if (g.ui && g.ui.chatLine) g.ui.chatLine(T(h.bed ? 'g.chat.homeBed' : 'g.chat.homeSpawn'), '#9affd8');
    NL.recall(g);
    return true;
  };
  // 🌍 Herzwelt (shown when the home is elsewhere): Herzwelt's spot and bed — a teleport there, else the trip
  NL.goHerz = function (g) {
    const m = g && g.meta, p = g && g.player; if (!m || !p || p.dead) return false;
    const herz = D.home(m), here = g.dim || herz;
    if (here !== herz) { if (!VR.Travel || m.guest) return false; VR.Travel.go(g, { dim: herz, via: 'herz' }); return true; }
    if (riding(g)) return true;
    const t = VR.Travel && VR.Travel.herzTarget ? VR.Travel.herzTarget(g) : { pos: g.worldSpawn(), bed: null };
    p.safeTeleport(t.pos[0], t.pos[1], t.pos[2], { bed: t.bed || null });
    if (g.ui && g.ui.chatLine) g.ui.chatLine(T(t.bed ? 'g.chat.homeBed' : 'g.chat.homeSpawn'), '#9affd8');
    return true;
  };
  // a death (player.js respawn): the home on this world → there; elsewhere → the instant trip home. The implicit home
  // keeps the old paths (Herzwelt's spot; away u-dims's meta.spawns of an old save, else home)
  NL.respawn = function (g, p) {
    const m = g && g.meta; if (!m || !p || m.guest) return false;
    const h = NL.homeOf(m, p), here = g.dim || D.home(m);
    if (h.implicit) return false;
    if (h.dim === here) { p.safeTeleport(h.pos[0], h.pos[1], h.pos[2]); bedCheck(g); return true; }
    if (!VR.Travel) return false;
    VR.Travel.go(g, { dim: h.dim, via: 'respawn', instant: true });
    return true;
  };

  // ---------------------------------------------------------------- guests (mp.js pdata)
  // a home as pdata may carry it: a world id (no ':' — storage keys are world:dim:cx:cz), a position, the day, a bed
  NL.sane = function (h) {
    if (!h || typeof h !== 'object' || typeof h.dim !== 'string' || !h.dim || h.dim.length > 40 || /[:\s]/.test(h.dim) || !finite(h.pos, 3)) return null;
    return { dim: h.dim, pos: h.pos.slice(0, 3).map(r2), since: Number.isFinite(+h.since) ? +h.since : 0, bed: finite(h.bed, 3) ? h.bed.slice(0, 3).map(Math.floor) : null };
  };
  NL.pdataOf = (g) => { const m = g && g.meta, h = m && m.universe && m.universe.home; return h ? NL.sane(h) : null; };
  NL.fromPdata = function (g, h) { const s = NL.sane(h); if (!s || !g || !g.meta) return false; (g.meta.universe || (g.meta.universe = { v: 1 })).home = s; return true; };

  // ---------------------------------------------------------------- the pause menu
  // home on Herzwelt: 🏠 Zu meinem Platz · 📍 (as before); home elsewhere: 🏠 Zuhause (<Welt>) · 🌍 Herzwelt, the 📍 below.
  // The 📍 says „Hier wohne ich" on any world that is not the home (it moves the home), „Mein Platz ist hier" on it.
  NL.pauseModel = function (g) {
    const m = (g && g.meta) || {}, guest = !!m.guest, herz = D.home(m), here = (g && g.dim) || herz, h = NL.homeOf(m, g && g.player), away = h.dim !== herz;
    return {
      home: away ? { custom: true, label: tx('g.nl.homeBtn', { world: name(h.dim) }, '🏠 Zuhause ({world})', '🏠 Home ({world})') } : { custom: false, label: T('g.pause.home') },
      herz: { show: away && !guest, label: tx('g.nl.herzBtn', { world: name(herz) }, '🌍 {world}', '🌍 {world}'), tip: tx('g.nl.herzTip', { world: name(herz) }, 'Zurück nach {world}, an deinen Platz dort — immer einen Klick entfernt', 'Back to {world}, to your spot there — always one click away') },
      pin: h.dim === here ? { key: 'g.pause.spawn', tipKey: 'g.pause.spawnTip', label: T('g.pause.spawn'), tip: T('g.pause.spawnTip') } : { key: 'g.nl.liveHere', tipKey: 'g.nl.liveHereTip', label: T('g.nl.liveHere'), tip: T('g.nl.liveHereTip') },
    };
  };
  NL.pauseMenu = function (ui) {
    const g = ui && ui.game; if (!g || typeof document === 'undefined' || !document.getElementById) return;
    const root = document.getElementById('pause'); if (!root || !root.querySelector) return;
    const bh = root.querySelector('[data-act="gohome"]'), bs = root.querySelector('[data-act="sethome"]'); if (!bh) return;
    const row = bh.parentNode || bh.parent || null;
    let bz = root.querySelector('[data-act="goherz"]');
    if (!bz) {
      bz = document.createElement('button'); bz.setAttribute('type', 'button'); bz.className = 'btn'; bz.setAttribute('data-act', 'goherz');
      if (row && row.insertBefore && bs && bs.parentNode === row) row.insertBefore(bz, bs); else if (row) row.appendChild(bz);
    }
    const M = NL.pauseModel(g);
    if (M.home.custom) { if (bh.removeAttribute) bh.removeAttribute('data-t'); else if (bh.attrs) delete bh.attrs['data-t']; } else bh.setAttribute('data-t', 'g.pause.home');
    bh.textContent = M.home.label;
    bz.textContent = M.herz.label; bz.title = M.herz.tip;
    const zs = styleOf(bz); zs.display = M.herz.show ? '' : 'none'; zs.flex = '1';
    if (bs) { bs.setAttribute('data-t', M.pin.key); bs.setAttribute('data-tt', M.pin.tipKey); bs.textContent = M.pin.label; bs.title = M.pin.tip; styleOf(bs).flexBasis = M.herz.show ? '100%' : ''; }
    if (row) styleOf(row).flexWrap = 'wrap';
  };

  // ---------------------------------------------------------------- the compass (map.js updateCompass, every 0.2 s)
  const ARROWS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
  NL.compassLine = function (g) {
    const p = g && g.player, m = g && g.meta; if (!p || !m || !p.pos) return '';
    const h = NL.homeOf(m, p), here = g.dim || D.home(m), icon = '<br><span style="color:#9affd8">🏠</span> ';
    if (h.dim !== here) return icon + '↑ ' + esc(tx('g.nl.cAway', { world: name(h.dim) }, '{world} — zum Schiff', '{world} — to the ship'));
    const dx = h.pos[0] - p.pos[0], dz = h.pos[2] - p.pos[2], d = Math.hypot(dx, dz);
    if (!(d > NL.COMPASS_NEAR)) return '';
    const a = Math.atan2(dx, -dz), rel = ((Math.round((a + p.yaw) * 180 / Math.PI) % 360) + 540) % 360 - 180;
    return icon + esc(tx('g.nl.cHome', { m: Math.round(d) }, 'Zuhause {m} m', 'Home {m} m')) + ' ' + ARROWS[((Math.round(rel / 45) % 8) + 8) % 8];
  };

  // ---------------------------------------------------------------- the world card (start.js worldCard)
  // „Wohnt auf den Driftinseln · zuletzt auf Herzwelt" — where you live, and where the save was left when that differs
  // (u-ascent: universe.at 'space' with the ship's frame → „zuletzt im Orbit über Basalt")
  NL.cardText = function (meta) {
    const m = meta || {}, h = NL.homeOf(m, null), U = m.universe || {};
    let last = null, lastDim;
    if (U.at === 'space') {
      const fr = U.ship && U.ship.space && U.ship.space.frame;
      last = fr ? tx('g.nl.orbit', { body: bodyName(fr) }, 'im Orbit über {body}', 'in orbit above {body}') : tx('g.nl.space', null, 'im All', 'in space');
      lastDim = 'space';
    } else { lastDim = D.dimOf(m); if (lastDim !== h.dim) last = NL.at(lastDim); }
    const lives = tx('g.nl.lives', { at: NL.at(h.dim) }, 'Wohnt {at}', 'Lives {at}');
    return { text: last ? lives + ' · ' + tx('g.nl.last', { at: last }, 'zuletzt {at}', 'last {at}') : lives, lives, last, homeDim: h.dim, lastDim };
  };
  NL.card = function (el, meta) {
    if (!el || typeof document === 'undefined' || !document.createElement) return null;
    const host = (el.querySelector && el.querySelector('.wtxt')) || el, C = NL.cardText(meta);
    const row = document.createElement('div'); row.className = 'wl';
    styleOf(row).cssText = 'display:flex;align-items:center;gap:8px;margin-top:5px;font-size:13px;line-height:1.25;opacity:.95';
    const cv = document.createElement('canvas'), ctx = cv.getContext ? cv.getContext('2d') : null;
    if (ctx && ctx.createImageData) {
      const k = Math.min(2, Math.max(1, Math.round((typeof window !== 'undefined' && window.devicePixelRatio) || 1))), n = 32 * k;
      cv.width = n; cv.height = n; styleOf(cv).cssText = 'width:32px;height:32px;flex:0 0 32px';
      const img = ctx.createImageData(n, n); img.data.set(NL.discPixels(C.homeDim, n)); ctx.putImageData(img, 0, 0);
      cv.setAttribute('aria-hidden', 'true'); row.appendChild(cv);
    }
    const sp = document.createElement('span'); sp.className = 'wlt'; sp.textContent = C.text; row.appendChild(sp);
    host.appendChild(row);
    return row;
  };

  // ---------------------------------------------------------------- the body as a small lit disc
  // A sphere lit from the upper left (a little light on the night side), its surface from the world's palette and a value
  // noise on the sphere (no seam), the air's limb and a thin halo for the worlds with air. Our own colours: Herzwelt's seas,
  // land and clouds; the Driftinseln a cyan orb with green isles; the Unterschmiede dark rock with ember cracks; the Hohlwelt
  // a violet shell round a dark core; Opal ice with red-brown lines; Basalt grey with dark maria; Aquamarin's teal sea,
  // Zinnober's sulfur, Ocker's rust and caps (u-moons). Deterministic: the same disc for the same world every time.
  const PAL = {
    overworld: { kind: 'terra', sea: [44, 108, 196], sea2: [28, 74, 156], land: [82, 160, 78], land2: [196, 176, 114], ice: [240, 246, 252], cloud: [248, 251, 255], limb: [140, 196, 255], air: 1, land0: 0, clouds: 0.6 },
    flat: { kind: 'terra', sea: [70, 140, 210], sea2: [52, 112, 182], land: [118, 186, 70], land2: [166, 208, 92], ice: [236, 244, 250], cloud: [244, 250, 255], limb: [190, 230, 255], air: 0.8, land0: 0.9, clouds: 0.7 },
    drift: { kind: 'isles', base: [150, 226, 255], deep: [92, 108, 214], land: [94, 172, 104], rock: [160, 136, 104], limb: [236, 252, 255], air: 0.9 },
    underforge: { kind: 'ember', base: [70, 44, 36], dark: [32, 20, 18], crack: [255, 128, 48] },
    hollow: { kind: 'shell', base: [116, 86, 190], core: [22, 12, 44], rim: [238, 226, 255], limb: [206, 186, 255], air: 0.45 },
    opal: { kind: 'ice', base: [238, 243, 250], shade: [194, 212, 232], line: [152, 88, 64] },
    basalt: { kind: 'crater', base: [146, 143, 138], mare: [72, 72, 76] },
    aqua: { kind: 'terra', sea: [40, 178, 194], sea2: [24, 128, 158], land: [62, 138, 148], land2: [96, 170, 168], ice: [236, 250, 255], cloud: [240, 252, 255], limb: [176, 240, 250], air: 0.7, land0: -0.9, clouds: 0.64 },
    zinn: { kind: 'volc', base: [232, 204, 82], spot: [214, 106, 44], dark: [62, 36, 22] },
    ocker: { kind: 'dust', base: [202, 122, 72], dark: [126, 66, 42], cap: [242, 236, 228], limb: [236, 186, 150], air: 0.25 },
  };
  const hex = (s) => { const v = parseInt(String(s || '#888888').slice(1, 7), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
  NL.palette = function (dim) {
    if (PAL[dim]) return PAL[dim];
    const b = VR.Universe && VR.Universe.DIM_BODY && VR.Universe.DIM_BODY[dim];
    if (b && PAL[b]) return PAL[b];
    const d = D.get(dim), v = d && d.veil;
    return v ? { kind: 'plain', base: hex(v[1]), dark: hex(v[2]), light: hex(v[0]) } : { kind: 'plain', base: [150, 150, 160], dark: [70, 70, 80], light: [210, 210, 220] };
  };
  const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  function hash3(ix, iy, iz, s) { let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(iz, 1440662683) + Math.imul(s, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
  function vnoise(x, y, z, s) {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), sz = fz * fz * (3 - 2 * fz);
    const a = hash3(ix, iy, iz, s), b = hash3(ix + 1, iy, iz, s), c = hash3(ix, iy + 1, iz, s), d = hash3(ix + 1, iy + 1, iz, s);
    const e = hash3(ix, iy, iz + 1, s), f = hash3(ix + 1, iy, iz + 1, s), g = hash3(ix, iy + 1, iz + 1, s), h = hash3(ix + 1, iy + 1, iz + 1, s);
    const x0 = a + (b - a) * sx, x1 = c + (d - c) * sx, x2 = e + (f - e) * sx, x3 = g + (h - g) * sx;
    const y0 = x0 + (x1 - x0) * sy, y1 = x2 + (x3 - x2) * sy;
    return y0 + (y1 - y0) * sz;
  }
  const fbm = (x, y, z, s) => vnoise(x, y, z, s) * 0.55 + vnoise(x * 2.03, y * 2.03, z * 2.03, s + 7) * 0.3 + vnoise(x * 4.1, y * 4.1, z * 4.1, s + 13) * 0.15;
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const sat = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
  // the surface colour at the unit normal (x, y, z), its glow (0..1, cracks and cores shine on the night side too)
  function surface(P, x, y, z, s, out) {
    const f = (k, o) => fbm(x * k + o, y * k + o * 0.7, z * k - o * 0.3, s);
    const lat = Math.asin(Math.max(-1, Math.min(1, y)));
    let c = P.base || P.sea, glow = 0;
    switch (P.kind) {
      case 'terra': {
        const h = f(2.2, 0) + (P.land0 || 0) * 0.12;
        c = h > 0.53 ? (h > 0.66 ? mix(P.land, P.land2, sat((h - 0.66) * 6)) : P.land) : mix(P.sea2, P.sea, sat((h - 0.3) * 4));
        if (Math.abs(lat) > 1.18 + (f(5, 3) - 0.5) * 0.3) c = P.ice;
        const cl = f(4.6, 11);
        if (cl > P.clouds) c = mix(c, P.cloud, sat((cl - P.clouds) * 5));
        break;
      }
      case 'isles': {
        c = mix(P.deep, P.base, sat(0.5 + y * 0.6));
        const i = f(5, 3);
        if (i > 0.62) c = P.land; else if (i > 0.585) c = P.rock;
        break;
      }
      case 'ember': {
        const n = f(3, 0), d = Math.abs(n - 0.5);
        if (d < 0.03) { c = P.crack; glow = 1 - d / 0.03; } else c = mix(P.dark, P.base, sat(f(6, 5) * 1.4 - 0.2));
        break;
      }
      case 'shell': {
        const rr = x * x + y * y;
        if (rr < 0.2) { c = P.core; glow = 0.15; } else if (rr < 0.27) { c = P.rim; glow = 0.55; } else c = mix(P.base, P.rim, sat((f(4, 2) - 0.55) * 2.5));
        break;
      }
      case 'ice': {
        c = mix(P.shade, P.base, sat(f(3, 1) * 1.6 - 0.3));
        if (Math.abs(Math.sin((x * 4 + z * 3 - y * 2) * 2.6 + f(2, 9) * 6)) < 0.11) c = P.line;
        break;
      }
      case 'crater': {
        c = f(2, 4) < 0.44 ? P.mare : P.base;
        const cr = f(7, 8);
        if (cr > 0.66) c = mix(c, [228, 226, 220], sat((cr - 0.66) * 4)); else if (cr < 0.3) c = mix(c, P.mare, 0.35);
        break;
      }
      case 'volc': {
        const n = f(4, 6);
        c = n > 0.72 ? P.dark : n > 0.62 ? P.spot : P.base;
        break;
      }
      case 'dust': {
        c = mix(P.dark, P.base, sat(f(3, 2) * 1.8 - 0.35));
        if (Math.abs(lat) > 1.22) c = P.cap;
        break;
      }
      default: c = mix(P.dark, P.base, sat(f(3, 1) * 1.5 - 0.2)); if (f(6, 3) > 0.7) c = mix(c, P.light, 0.5);
    }
    out[0] = c[0]; out[1] = c[1]; out[2] = c[2]; out[3] = glow;
  }
  NL.discPixels = function (dim, size) {
    const N = Math.max(4, size | 0), out = new Uint8ClampedArray(N * N * 4), P = NL.palette(dim), s = hashStr(String(dim || 'x')) & 0xffff;
    const L0 = [-0.55, 0.5, 0.67], ll = Math.hypot(L0[0], L0[1], L0[2]), lx = L0[0] / ll, ly = L0[1] / ll, lz = L0[2] / ll;
    const halo = P.air ? Math.max(1, N * 0.06) : 0, R = N / 2 - 0.5 - halo, c0 = (N - 1) / 2, col = [0, 0, 0, 0];
    for (let py = 0; py < N; py++) for (let px = 0; px < N; px++) {
      const u = (px - c0) / R, v = (py - c0) / R, rr = u * u + v * v, r = Math.sqrt(rr), o = (py * N + px) * 4;
      if (r > 1) {   // the air's thin halo, on the lit side
        if (!halo) continue;
        const k = 1 - (r - 1) * R / halo; if (k <= 0) continue;
        const li = sat((u / r) * lx + (-v / r) * ly + 0.35);
        const a = sat(k * k * 0.8 * P.air * li * 1.4);
        if (a < 0.02) continue;
        out[o] = P.limb[0]; out[o + 1] = P.limb[1]; out[o + 2] = P.limb[2]; out[o + 3] = Math.round(a * 255);
        continue;
      }
      const nx = u, ny = -v, nz = Math.sqrt(Math.max(0, 1 - rr));
      const lam = Math.max(0, nx * lx + ny * ly + nz * lz), sh = 0.07 + 0.93 * Math.pow(lam, 0.8);
      surface(P, nx, ny, nz, s, col);
      let cr = col[0] * sh, cg = col[1] * sh, cb = col[2] * sh;
      if (col[3]) { const gk = col[3] * (1 - sh) * 0.85; cr += col[0] * gk; cg += col[1] * gk; cb += col[2] * gk; }
      if (P.air) { const rim = Math.pow(1 - nz, 2.5) * P.air * (0.25 + 0.75 * lam) * 0.8; cr += (P.limb[0] - cr) * rim; cg += (P.limb[1] - cg) * rim; cb += (P.limb[2] - cb) * rim; }
      out[o] = cr; out[o + 1] = cg; out[o + 2] = cb; out[o + 3] = Math.round(255 * sat((1 - r) * R + 0.5));
    }
    return out;
  };

  // ---------------------------------------------------------------- ships come home
  // the home pad: on a Heartland home near the Gate Temple its apron (the autopilot's dock site, flight.js:640), a slot
  // apart along the runway; else a ring of slots 14 blocks round the home
  NL.padFor = function (home, meta, i) {
    const k = i | 0, H = VR.Heart, m = meta || {};
    if (H && H.TEMPLE && home.dim === 'overworld' && (m.vgen | 0) >= 3 && m.type !== 'flat' && Math.hypot(home.pos[0] - H.TEMPLE.x, home.pos[2] - (H.TEMPLE.front + 10)) < NL.PAD_HEART) {
      const SL = [[0, 0], [-18, 0], [18, 0], [0, 26], [-18, 26], [18, 26]], sl = SL[k % SL.length], row = Math.floor(k / SL.length);
      return [H.TEMPLE.x + 0.5 + sl[0], H.PLAT + 1, H.TEMPLE.front + 10.5 + sl[1] + row * 52];
    }
    const a = (k % 6) * (Math.PI / 3) + Math.PI / 6, rr = 14 + Math.floor(k / 6) * 12;
    return [Math.floor(home.pos[0] + Math.cos(a) * rr) + 0.5, Math.floor(home.pos[1]), Math.floor(home.pos[2] + Math.sin(a) * rr) + 0.5];
  };
  // every ship left on another world (starships.js keeps them in `elsewhere`) to the home pad — at home only
  NL.recall = function (g) {
    const S = g && g.starships, list = S && S.elsewhere; if (!list || !list.length || !g.meta) return 0;
    const h = NL.home(g); if (h.dim !== (g.dim || D.home(g.meta))) return 0;
    const st = g.nl || (g.nl = {}), q = st.settle || (st.settle = []), out = list.splice(0, list.length);
    let n = 0;
    for (const e of out) {
      if (!e || !Number.isFinite(e.seed)) continue;
      const pad = NL.padFor(h, g.meta, n);
      const s = S.spawn(e.seed, e.arch, e.palette, pad, e.yaw || 0, e.key);
      s.recalled = true;
      q.push({ s, y: pad[1], t: 0 });
      n++;
    }
    if (n && g.ui && g.ui.chatLine) g.ui.chatLine(n === 1 ? tx('g.nl.recall1', null, '🚀 Dein Schiff ist zurück am Landeplatz', '🚀 Your ship is back on the landing pad') : tx('g.nl.recallN', { n }, '🚀 {n} Schiffe sind zurück am Landeplatz', '🚀 {n} ships are back on the landing pad'), '#9affd8');
    return n;
  };
  // (Travel.update, every play frame: nothing unless a recalled ship waits for its design and the ground under the pad)
  NL.tick = function (g, dt) {
    const st = g.nl, q = st && st.settle; if (!q || !q.length) return;
    const S = g.starships; if (!S) { q.length = 0; return; }
    for (let i = q.length - 1; i >= 0; i--) {
      const it = q[i]; it.t += dt;
      if (it.t > 20 || S.ships.indexOf(it.s) < 0) { q.splice(i, 1); continue; }
      if (!it.s.d.meta || !it.s.d.allCells) continue;
      const y = S.groundY(it.s, it.y + 24, 64);
      if (y === null) continue;
      it.s.pos[1] = y; q.splice(i, 1);
    }
  };
  // (starships.js beforeSave) a recalled ship whose design is still being built keeps its place in the save
  NL.shipsSave = function (mgr, meta) {
    if (!mgr || !meta || !Array.isArray(meta.starships)) return;
    for (const s of mgr.ships) if (s.recalled && !s.d.meta) meta.starships.push({ seed: s.d.seed, arch: s.d.arch || null, palette: s.d.palette || null, pos: s.pos.map(v => Math.round(v * 100) / 100), yaw: s.yaw, key: s.key || null });
  };

  // ---------------------------------------------------------------- Heimkehr in a moment
  // what a section mesh depends on besides the blocks: leaves, the smooth props, the sway, the world's style, the look
  NL.keepSig = (g) => { const S = g.settings || {}; return [S.fancyLeaves ? 1 : 0, g.propMask ? g.propMask() : 0, S.motion ? 1 : 0, g.styleKey || '', S.look || '', (VR.Looks && VR.Looks.ver) || 0].join('|'); };
  // the spot a later trip may land on in this world: the home (on its world), Herzwelt's spot (🌍) on Herzwelt
  function keepTarget(g) {
    const m = g.meta, here = g.dim || D.home(m), h = NL.homeOf(m, g.player);
    if (h.dim === here) return h.pos;
    if (here === D.home(m) && VR.Travel && VR.Travel.herzTarget) { const t = VR.Travel.herzTarget(g); return t && t.pos; }
    return null;
  }
  function freeKeep(g, K) { const R = g.renderer; if (!R || !K) return; for (const c of K.cols) for (const s of c.sec) if (s.hasMesh || (s.mesh && s.mesh.some(Boolean))) R.freeSection(s); }
  NL.release = function (g) { const K = g && g.nlKeep; if (!K) return; for (const d of Object.keys(K)) freeKeep(g, K[d]); g.nlKeep = null; };
  NL.keepInfo = function (g) { const K = (g && g.nlKeep) || {}, o = {}; for (const d of Object.keys(K)) o[d] = { cols: K[d].cols.length, mb: +K[d].mb.toFixed(2), gpuMB: +K[d].gpuMB.toFixed(2), jsMB: +K[d].jsMB.toFixed(2) }; return o; };
  // (game.js teardownWorld, before the world is destroyed) a trip: the 5 × 5 round this world's Heimkehr target stay —
  // out of the world (its destroy frees what it holds), out of the renderer's prop list; anything else: every keep goes
  NL.beforeTeardown = function (g) {
    const w = g && g.world;
    if (!(VR.Travel && VR.Travel.busy(g))) { NL.release(g); farBack(g); return; }
    if (!w || !g.meta || g.meta.guest || !g.player || (g.settings && g.settings.homeKeep === false)) return;
    const tgt = keepTarget(g); if (!finite(tgt, 3)) return;
    const K = g.nlKeep || (g.nlKeep = {});
    if (K[w.dim]) { freeKeep(g, K[w.dim]); delete K[w.dim]; }
    const RR = NL.KEEP_R, cx0 = Math.floor(tgt[0]) >> 4, cz0 = Math.floor(tgt[2]) >> 4, cols = [], props = g.renderer && g.renderer.propSecs;
    let gpu = 0, js = 0;
    for (let dz = -RR; dz <= RR; dz++) for (let dx = -RR; dx <= RR; dx++) {
      const k = VR.ckey(cx0 + dx, cz0 + dz), c = w.cols.get(k);
      if (!c || !c.ready) continue;
      for (const s of c.sec) {
        // a newer mesh on its way (its job or its upload goes with the old world): meshed again after the return
        if (s.pending || s.dirty || (s.meshVer !== undefined && s.meshVer !== s.ver)) { s.pending = false; s.dirty = true; }
        if (props && s.propN) props.delete(s);
        if (s.mesh) for (const mm of s.mesh) if (mm && mm.cap) gpu += mm.cap * 16;
        if (s.vxData && s.vxData.byteLength) js += s.vxData.byteLength;
      }
      js += (c.blocks ? c.blocks.byteLength : 0) + (c.light ? c.light.byteLength : 0) + 2560;
      w.cols.delete(k); if (w.fading) w.fading.delete(c); if (w.shDirty) w.shDirty.delete(k);
      cols.push(c);
    }
    w.lastCol = null;
    if (cols.length) K[w.dim] = { id: g.meta.id, dim: w.dim, sig: NL.keepSig(g), cols, at: tgt.slice(0, 3), gpuMB: gpu / 1048576, jsMB: js / 1048576, mb: (gpu + js) / 1048576 };
  };
  // (game.js startWorld, the new world made) the kept columns of this world come back: shown at once, their spawns for
  // the actors (startWorld's loop gives them out), their shadow heights uploaded; a changed look or another save: freed
  NL.adopt = function (g) {
    g.nlAdopted = 0; g.nlAdoptedMB = 0;
    const w = g.world, K = g.nlKeep, E = K && w && K[w.dim]; if (!E) return 0;
    delete K[w.dim];
    if (E.id !== (g.meta && g.meta.id) || E.sig !== NL.keepSig(g)) { freeKeep(g, E); return 0; }
    const t = now(), props = g.renderer && g.renderer.propSecs, kept = w.keptCols || (w.keptCols = new Set());
    for (const c of E.cols) {
      c.lastSeen = t; if (!(c.shownAt >= 0)) c.shownAt = t - 1000; c.fade = 1;
      for (const s of c.sec) { s.fade = 1; if (props && s.propN) props.add(s); }
      if (c.spawns0) c.spawns = c.spawns0;
      w.cols.set(c.key, c); if (w.shDirty) w.shDirty.add(c.key); if (w.shGone) w.shGone.delete(c.key);
      if ((c.H >> 4) > (w.maxSec || 16)) w.maxSec = c.H >> 4;
      if (c.spawns && g.vents && g.vents.absorb) g.vents.absorb(c.spawns);
      kept.add(c);   // (the column itself: one unloaded and loaded again later is a new column, not a kept one)
    }
    w.lastCol = null; w.visDirty = true; if (g.renderer) g.renderer.visDirty = true;
    g.nlAdopted = E.cols.length; g.nlAdoptedMB = E.mb;
    return E.cols.length;
  };
  // the 5 × 5 round (pcx, pcz): every column there and every section with blocks has a mesh up (a kept one may be stale
  // for a moment: it draws while its new mesh is made)
  NL.nearReady = function (w, pcx, pcz, R) {
    if (!w) return false;
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const c = w.col(pcx + dx, pcz + dz); if (!c) return false;
      const sec = c.sec; for (let i = 0; i < sec.length; i++) if (sec[i].count > 0 && !sec[i].meshed) return false;
    }
    return true;
  };
  function farBack(g) { if (g && g.nlFar0 !== undefined) { if (g.pool) g.pool.farShare = g.nlFar0; g.nlFar0 = undefined; } }
  // (game.js loadingFrame) a trip's loading: the phases noted, the far lane idle, and the answer whether the near columns
  // are in — then the world opens (no wait for the far ring: it fills in while you play)
  NL.loading = function (g) {
    const trip = g && g.travel && g.travel.trip; if (!trip || !g.world || !g.player || !g.player.pos) return false;
    const w = g.world, p = g.player, t = now(), L = trip.nl || (trip.nl = { start: t, col: 0, gen: 0, mesh: 0, up: 0 });
    if (g.pool && g.nlFar0 === undefined) { g.nlFar0 = g.pool.farShare; g.pool.farShare = 0; }
    const R = NL.NEAR_R, pcx = Math.floor(p.pos[0]) >> 4, pcz = Math.floor(p.pos[2]) >> 4, need = (2 * R + 1) * (2 * R + 1);
    let cols = 0, secs = 0, clean = 0, up = 0;
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const c = w.col(pcx + dx, pcz + dz); if (!c) continue;
      cols++;
      const sec = c.sec; for (let i = 0; i < sec.length; i++) { const s = sec[i]; if (!(s.count > 0)) continue; secs++; if (!s.dirty && !s.pending) clean++; if (s.meshed) up++; }
    }
    if (cols && !L.col) L.col = t;
    if (cols === need && !L.gen) L.gen = t;
    if (cols === need && clean === secs && !L.mesh) L.mesh = t;
    const ready = cols === need && up === secs;
    if (ready && !L.up) L.up = t;
    return ready;
  };
  // (travel.js arrived, the first frame in the new world) the far lane back, the trip's phases, Heimkehr's ships
  NL.arrived = function (g, trip) {
    farBack(g);
    const L = (trip && trip.nl) || {}, t = trip && trip.tPlay ? trip.tPlay : now(), t0 = trip && trip.t0 ? trip.t0 : t, ts = trip && trip.tSwitch ? trip.tSwitch : t0;
    const since = (a) => (a && L.start ? Math.round(a - L.start) : null);
    NL.lastTrip = {
      from: trip && trip.from, to: trip && trip.to, via: trip && trip.via, adopted: g.nlAdopted || 0, keptMB: +(g.nlAdoptedMB || 0).toFixed(2),
      ms: { veil: Math.round(ts - t0), start: L.start ? Math.round(L.start - ts) : null, col: since(L.col), gen: since(L.gen), mesh: since(L.mesh), up: since(L.up), play: L.start ? Math.round(t - L.start) : null, total: Math.round(t - t0) },
    };
    if (trip && (trip.via === 'home' || trip.via === 'respawn')) bedCheck(g);
    if (trip && trip.via === 'home') NL.recall(g);
  };

  // ---------------------------------------------------------------- the world: a kept column stays clean
  // A column that arrives marks its 8 neighbours' sections for meshing again (world.js onColumn). For a kept column that is a
  // second mesh of the same thing — unless the newcomer's light walks into it (then it is meshed again). The wrapper also
  // remembers each column's spawns (the actors take them, gadgets clears them; a kept column hands them out again).
  const WP = VR.World && VR.World.prototype;
  if (WP && WP.onColumn && !WP.onColumn.__nl) {
    const orig = WP.onColumn, touch0 = WP._touch;
    const onColumn = function (m) {
      const sp = m && m.spawns && m.spawns.length ? m.spawns : null, K = this.keptCols;
      let snap = null, touched = null;
      if (K && K.size && m) {
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dz) continue;
          const n = this.col(m.cx + dx, m.cz + dz);
          if (n && K.has(n)) (snap || (snap = [])).push(n, n.sec.map((s) => [s.dirty, s.ver]));
        }
        if (snap) { touched = new Set(); this._touch = function (col, x, y, z) { touched.add(col.key); return touch0.call(this, col, x, y, z); }; }
      }
      try { orig.call(this, m); } finally { if (snap) delete this._touch; }
      const c = m && this.cols.get(VR.ckey(m.cx, m.cz)); if (c && sp) c.spawns0 = sp;
      if (snap) for (let i = 0; i < snap.length; i += 2) {
        const n = snap[i], st = snap[i + 1];
        if (touched.has(n.key)) { K.delete(n); continue; }
        for (let j = 0; j < st.length && j < n.sec.length; j++) { n.sec[j].dirty = st[j][0]; n.sec[j].ver = st[j][1]; }
      }
    };
    onColumn.__nl = true;
    WP.onColumn = onColumn;
  }

  // ---------------------------------------------------------------- the switch
  if (VR.Settings && VR.Settings.add) VR.Settings.add({ key: 'homeKeep', g: 'play', sec: 'play', t: 'switch', lab: 'g.set.homeKeep', tip: 'g.set.homeKeep.tip', cost: 'low', def: true });
  // the pause row in the new language (the 🏠 and 🌍 carry a world's name: no table key the page could renew itself)
  if (VR.I18N && VR.I18N.on) VR.I18N.on(() => { try { const g = VR.game; if (g && g.ui && g.ui.screen === 'pause') NL.pauseMenu(g.ui); } catch (e) { /* the menu is not built yet */ } });
})(VR);

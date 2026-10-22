// ============================================================================
// VR.Travel — from one world of a save to another while playing (u-dims; docs/superpowers/specs/
// 2026-10-22-universe-design.md §6.2, §9). The worlds are the dims of the registry (src/shared/dimreg.js): Herzwelt (or
// a flat world's land), the Unterschmiede, the Hohlwelt, the Driftinseln — later the moons. A trip keeps the place you
// left in each world (meta.pos), takes the ship you fly along, shows a short veil instead of a loading screen, and
// starts the other world through the game's own startWorld (its columns are already kept per dim, storage.js:70).
// The three old gates (blocks3.js: portal '<dim>') travel when you stand in one for two seconds; the gate of the world
// you are in leads home. Heimkehr (🏠, /home) works from every world, always: back to Herzwelt's spawn or bed.
// Cost: nothing per frame but a look at the two blocks the player stands in (no allocation); the veil is DOM, drawn only
// while a gate charges or a trip runs.
// ============================================================================
(function (VR) {
  'use strict';
  const D = VR.DimReg;
  const T = (k, v) => (VR.I18N ? VR.I18N.t(k, v) : k);
  const finite = (a, n) => Array.isArray(a) && a.length >= n && a.slice(0, n).every((v) => typeof v === 'number' && Number.isFinite(v));
  const r2 = (v) => Math.round(v * 100) / 100, r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : 0);
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  // the per-game state: the trip under way, the gate's charge, the ship that came along
  const st = (g) => g.travel || (g.travel = { trip: null, arriving: null, ride: null, gateT: 0, gateDim: null, armed: true });

  const Travel = VR.Travel = {
    FADE_IN: 350,    // ms: the veil closes over the world you leave
    FADE_OUT: 650,   // ms: and opens on the one you reach (the veil is a second in all, plus the loading under it)
    GATE_S: 2,       // s in a gate before it takes you
    last: null,      // the last trip: {from, to, via, veilMs, loadMs, totalMs}
  };

  // ---------------------------------------------------------------- facts
  Travel.home = (g) => D.home(g && g.meta);
  Travel.away = (g) => !!(g && g.meta && !g.meta.guest && g.dim && g.dim !== D.home(g.meta));
  Travel.busy = (g) => !!(g && g.travel && g.travel.trip);
  Travel.dimName = (id) => { const n = D.name(id); return VR.I18N ? VR.I18N.tx(n[0], null, n[1], n[2]) : n[1]; };
  // the place kept for a dim: [x, y, z, yaw, pitch] or null
  Travel.posOf = (meta, dim) => { const a = meta && meta.pos && meta.pos[dim]; return finite(a, 3) ? [a[0], a[1], a[2], r3(a[3]), r3(a[4])] : null; };
  // the gate of a dim leads there — or home, when you are in that dim already
  Travel.gateTarget = (cur, portalDim, meta) => (cur === portalDim ? D.home(meta) : portalDim);
  // Herzwelt's spawn and bed (spawnOnly: the world's own spawn, /spawn) — 🌍's target, and Heimkehr's for the home there
  Travel.herzTarget = (g, spawnOnly) => {
    if (!g || !g.meta) return null;
    const home = D.home(g.meta), p = g.player;
    if (spawnOnly || !p || !finite(p.spawn, 3)) return { dim: home, pos: g.worldSpawn().slice(0, 3), bed: null };
    return { dim: home, pos: p.spawn.slice(0, 3), bed: finite(p.spawnBed, 3) ? p.spawnBed.slice(0, 3) : null };
  };
  // Heimkehr's target: the player's home on whatever world it is (newlife.js), else Herzwelt's spawn and bed   // u-home
  Travel.homeTarget = (g, spawnOnly) => { if (!spawnOnly && VR.NewLife && g && g.meta) { const t = VR.NewLife.target(g); if (t) return t; } return Travel.herzTarget(g, spawnOnly); };   // u-home
  // the world the player calls home (newlife.js: the home's world; without it Herzwelt)   // u-home
  const homeDimOf = (g) => (VR.NewLife && g && g.meta ? VR.NewLife.homeDim(g) : D.home(g && g.meta));   // u-home
  // the gate blocks: a block type with o.portal (blocks3.js) leads to that dim — a table by type id, made once
  let PT = null;
  Travel.portalTable = () => {
    const R = VR.R, n = R.types.length;
    if (PT && PT.n === n) return PT;
    const byType = new Int16Array(n).fill(-1), dims = [], byName = {};
    for (let i = 0; i < n; i++) {
      const t = R.types[i], d = t && t.o && t.o.portal; if (!d) continue;
      let k = dims.indexOf(d); if (k < 0) { k = dims.length; dims.push(d); }
      byType[i] = k; byName[t.name] = d;
    }
    return (PT = { n, byType, dims, byName });
  };
  // the portal dim of the block at the player's feet or body (or null) — every frame, nothing allocated
  Travel.portalAt = (g) => {
    const p = g.player, w = g.world; if (!p || !w || !p.pos) return null;
    const P = Travel.portalTable(), TY = VR.R.T.type, x = Math.floor(p.pos[0]), z = Math.floor(p.pos[2]);
    for (let k = 0; k < 2; k++) {
      const s = w.getBlock(x, Math.floor(p.pos[1] + (k ? 0.9 : 0.1)), z);
      if (!s) continue;
      const i = P.byType[TY[s]];
      if (i >= 0) return P.dims[i];
    }
    return null;
  };
  // may this game travel to `to` now? null, or the key of the hint that says why not
  Travel.canGo = (g, to) => {
    if (!g || !g.meta) return 'g.travel.notNow';
    if (g.meta.guest) return 'g.travel.guest';
    if (Travel.busy(g)) return 'g.travel.busy';
    if (g.state !== 'play' || !g.world || !g.player || g.player.dead) return 'g.travel.notNow';
    const mp = g.mp; if (mp && mp.isHost && mp.remote && mp.remote.size > 0) return 'g.travel.guests';   // (Konvoi — Mitreisen — is wave 4's)
    const d = to && D.get(to);
    if (!d || (d.home && to !== D.home(g.meta))) return 'g.travel.unknown';
    if (to === g.dim) return 'g.travel.here';
    return null;
  };
  const say = (g, key, to, color) => { if (g && g.ui && g.ui.chatLine) g.ui.chatLine(T(key, { dim: Travel.dimName(to || g.dim), id: to }), color || '#ffcf8a'); };

  // ---------------------------------------------------------------- the trip
  // o: {dim, via: 'gate' | 'cmd' | 'home' | 'spawn' | 'respawn', at?: [x, y, z], instant?}
  Travel.go = async (g, o) => {
    try { return await goTrip(g, o || {}); }
    catch (e) {   // (nothing may leave the game between two worlds: an error ends the trip where it stands)
      console.error('travel', e);
      const S = g && g.travel; if (S) { if (S.trip) leadLoadingBack(g, S.trip); S.trip = null; S.arriving = null; }
      veilHide();
      if (g && g.state === 'travel' && g.startTitle) g.startTitle();
      return false;
    }
  };
  async function goTrip(g, o) {
    const to = o.dim, via = o.via || 'cmd', why = Travel.canGo(g, to);
    if (why) { say(g, why, to); return false; }
    const S = st(g), meta = g.meta, from = g.dim;
    const trip = S.trip = { from, to, via, meta, t0: now(), tSwitch: 0, tPlay: 0, ride: null, instant: !!(o.instant || via === 'respawn') };
    S.gateT = 0; S.gateDim = null;
    veilShow(to, trip.instant, homeDimOf(g) === to);   // u-home: 🏠 on the veil when the trip goes to the home's world
    let arrive = null;
    try { arrive = await arrivalOf(g, to, via, o); } catch (e) { console.warn('travel: no arrival', e); }
    if (!trip.instant) await sleep(Math.max(0, Travel.FADE_IN - (now() - trip.t0)));
    // (meanwhile the player may have quit, died or left: then nothing happens)
    if (S.trip !== trip || !arrive || g.meta !== meta || g.state !== 'play' || !g.world || !g.player || (g.player.dead && via !== 'respawn')) {
      if (S.trip === trip) S.trip = null;
      veilHide();
      return false;
    }
    switchNow(g, trip, arrive);
    try { await g.startWorld(meta, false); }
    catch (e) {
      console.error('travel: the world did not start', e);
      // back to the world you came from, at the place you left; if even that fails, the title (nothing is lost: saved)
      meta.dim = from;
      const back = Travel.posOf(meta, from);
      if (back) meta.player = Object.assign({}, meta.player, { pos: back.slice(0, 3), yaw: back[3], pitch: back[4] });
      try { await g.startWorld(meta, false); say(g, 'g.travel.failed', from, '#ff8a8a'); }
      catch (e2) { console.error(e2); leadLoadingBack(g, trip); S.trip = null; veilHide(); if (g.startTitle) g.startTitle(); return false; }
    }
    // Heimkehr: the bed is looked at when the land is there, as the old goHome did (gone → the world's spawn)
    if (arrive.home && g.player) g.player.safeTeleport(arrive.pos[0], arrive.pos[1], arrive.pos[2], { bed: arrive.bed || null });
    S.arriving = trip;
    return true;
  }
  // where the trip ends: Heimkehr → Herzwelt's spawn or bed; `at`; the place you left that world; else its own spawn
  async function arrivalOf(g, to, via, o) {
    const p = g.player, yaw = p ? p.yaw : 0, pitch = p ? p.pitch : 0;
    if (via === 'home' || via === 'respawn' || via === 'spawn' || via === 'herz') { const t = via === 'herz' ? Travel.herzTarget(g) : Travel.homeTarget(g, via === 'spawn'); return { pos: t.pos, bed: t.bed, yaw, pitch, home: true }; }   // u-home: 'herz' — 🌍 Herzwelt's spot
    if (finite(o.at, 3)) return { pos: o.at.slice(0, 3), yaw, pitch };
    const q = Travel.posOf(g.meta, to);
    if (q) return { pos: q.slice(0, 3), yaw: q[3], pitch: q[4] };
    const s = await spawnOf(g, to);
    return { pos: [s[0], s[1] + 0.2, s[2]], yaw: Number.isFinite(s[3]) ? s[3] : yaw, pitch: 0 };
  }
  // a world's own spawn, from a worker (the generators live there); near [0, 0] for the ones that search round a point
  function spawnOf(g, dim) {
    return new Promise((res) => {
      let done = false;
      const fin = (pos) => { if (done) return; done = true; res(finite(pos, 3) ? pos : [0.5, 100, 0.5]); };
      try { g.pool.direct(0, { type: 'spawn', dim, near: [0, 0] }, null, (m) => fin(m && m.pos)); } catch (e) { fin(null); }
      setTimeout(() => fin(null), 20000);
    });
  }
  // the switch, in one synchronous run: nothing of the old world is touched by a frame after it
  function switchNow(g, trip, arrive) {
    const p = g.player, m = g.meta, from = g.dim, to = trip.to;
    trip.tSwitch = now();
    // the ship you fly comes along: its row in the save list (beforeSave writes this world's ships first, in order)
    const S = g.starships, ship = S && S.pilot && S.pilot.d && S.pilot.d.meta ? S.pilot : null;
    const idx = ship ? S.ships.filter((s) => s.d.meta).indexOf(ship) : -1;
    // off every vehicle, as a quit to the title does (out of the seat, off the bike, the helm ship set down)
    try { if (S) S.shutdown(); if (g.gadgets && g.gadgets.shutdown) g.gadgets.shutdown(); } catch (e) { console.warn(e); }
    // the place you leave (the spot one died on is no place to come back to)
    if (trip.via !== 'respawn' && finite(p.pos, 3)) (m.pos || (m.pos = {}))[from] = [r2(p.pos[0]), r2(p.pos[1]), r2(p.pos[2]), r3(p.yaw), r3(p.pitch)];
    if (from === D.home(m) && !finite(m.worldSpawn, 3) && finite(p.spawn, 3) && !p.spawnBed) m.worldSpawn = p.spawn.slice(0, 3);   // (as loadingFrame: the world's own spawn, never a bed)
    // a host without guests closes the room: hosting is from home only (mp.js:193); it opens again back home
    if (g.mp && g.mp.isHost && g.mp.stopHosting) g.mp.stopHosting();
    // the save as it is now — both capture at once (IndexedDB clones on put): a crash mid-trip finds you where you were
    g.saveMeta(); if (g.world && g.world.saveAll) g.world.saveAll();
    // the trip in the save's memory: the ship's world and place, the world, the player's place there
    const e = idx >= 0 && m.starships ? m.starships[idx] : null;
    if (e && e.seed === ship.d.seed) { e.dim = to; e.pos = arrive.pos.slice(0, 3); trip.ride = { seed: e.seed, at: e.pos.slice(), t: 0 }; }
    m.dim = to;
    m.player = Object.assign({}, m.player, { pos: arrive.pos.slice(0, 3), yaw: Number.isFinite(arrive.yaw) ? arrive.yaw : p.yaw, pitch: Number.isFinite(arrive.pitch) ? arrive.pitch : 0 });
    // no frame draws the torn-down world; the game's loading screen is the veil's for the trip (the pointer stays locked)
    g.state = 'travel';
    leadLoading(g, trip);
    if (g.audio && g.audio.play) g.audio.play('warp');
  }
  function leadLoading(g, trip) { if (!g.ui || trip.uiLoading) return; trip.uiLoading = g.ui.loading; g.ui.loading = (msg, frac) => veilProgress(msg, frac); }
  function leadLoadingBack(g, trip) { if (g.ui && trip.uiLoading) { g.ui.loading = trip.uiLoading; trip.uiLoading = null; } }
  // the first frame in the new world: the veil opens, a line says where you are, the save knows it
  function arrived(g, S) {
    const trip = S.arriving; S.arriving = null;
    leadLoadingBack(g, trip);
    trip.tPlay = now();
    Travel.last = { from: trip.from, to: trip.to, via: trip.via, veilMs: Math.round(trip.tSwitch - trip.t0), loadMs: Math.round(trip.tPlay - trip.tSwitch), totalMs: Math.round(trip.tPlay - trip.t0) };
    if (VR.NewLife) VR.NewLife.arrived(g, trip);   // u-home: the far lane back, the trip's phases, Heimkehr's ships to the home pad
    S.trip = null; S.armed = false;   // (arrived in a gate: it waits until you have stepped out)
    veilHide();
    const home = g.dim === homeDimOf(g);   // u-home: „wieder daheim" on the home's world
    if (g.ui && g.ui.chatLine) g.ui.chatLine(T(home ? 'g.travel.home' : 'g.travel.arrived', { dim: Travel.dimName(g.dim) }), home ? '#9affd8' : '#9ad8ff');
    if (trip.ride) S.ride = trip.ride;
    try { g.saveMeta(); } catch (e) { console.warn(e); }
  }
  // the ship that came along: once its design is built and the land is there, it stands where you stand and you sit in it
  function rideTick(g, S, dt) {
    const R0 = S.ride, SS = g.starships, p = g.player;
    R0.t += dt;
    if (!SS || !p || R0.t > 20) { S.ride = null; return; }
    if (p.hold) return;
    const s = SS.ships.find((q) => q.d.seed === R0.seed && Math.abs(q.pos[0] - R0.at[0]) < 1e-6 && Math.abs(q.pos[2] - R0.at[2]) < 1e-6);
    if (!s) { S.ride = null; return; }
    if (!s.d.meta || !s.d.cells) return;
    s.pos[0] = p.pos[0]; s.pos[2] = p.pos[2];
    const y = SS.groundY(s, p.pos[1] + 8, 40); s.pos[1] = y !== null ? y : p.pos[1];
    S.ride = null;
    SS.board(s, p);
  }

  // ---------------------------------------------------------------- the game's hooks
  // per frame in play (game.js playFrame): a trip's arrival, the ship along, the gates
  Travel.update = (g, dt) => {
    const S = g.travel || st(g);
    if (S.arriving && g.state === 'play') arrived(g, S);
    if (S.ride) rideTick(g, S, dt);
    if (g.nl && VR.NewLife) VR.NewLife.tick(g, dt);   // u-home: a recalled ship set down on the ground under the home pad
    if (S.trip) return;
    const p = g.player, ui = g.ui;
    const frozen = !p || p.dead || (ui && ui.blocking) || (g.director && g.director.active) || (g.wow && g.wow.active) || g.studioOpen;
    const pd = frozen ? null : Travel.portalAt(g);
    if (!pd) { if (S.gateT > 0 || S.gateDim) { S.gateT = 0; S.gateDim = null; veilCharge(0); } if (!frozen) S.armed = true; return; }
    if (!S.armed) return;
    const to = Travel.gateTarget(g.dim, pd, g.meta);
    if (S.gateDim !== to) { S.gateDim = to; S.gateT = 0; }
    S.gateT += dt;
    veilCharge(Math.min(1, S.gateT / Travel.GATE_S), to, to === D.home(g.meta));
    if (S.gateT >= Travel.GATE_S) {
      S.gateT = 0; S.gateDim = null; S.armed = false;
      const why = Travel.canGo(g, to);
      if (why) { veilCharge(0); say(g, why, to); return; }
      Travel.go(g, { dim: to, via: 'gate' });
    }
  };
  // goHome (game.js): from another world the trip home; false at home (the old goHome goes on)
  Travel.goHome = (g, what) => {
    if (!Travel.away(g)) return false;
    if (!g.player || g.player.dead) return true;
    Travel.go(g, { dim: D.home(g.meta), via: what === 'spawn' ? 'spawn' : 'home' });
    return true;
  };
  // a death on another world (player.js respawn): that world's own place if one was set there, else home at once
  Travel.respawn = (g, p) => {
    if (!Travel.away(g)) return false;
    const s = g.meta.spawns && g.meta.spawns[g.dim];
    if (s && finite(s.pos, 3)) { p.safeTeleport(s.pos[0], s.pos[1], s.pos[2]); return true; }
    Travel.go(g, { dim: D.home(g.meta), via: 'respawn', instant: true });
    return true;
  };
  // a bed, 📍 or /sethome on another world (crafting.js, game.js): that world's place — Herzwelt's spawn stays
  Travel.awaySpawn = (g, pos, bed) => {
    if (!Travel.away(g) || !finite(pos, 3)) return false;
    (g.meta.spawns || (g.meta.spawns = {}))[g.dim] = { pos: [r2(pos[0]), r2(pos[1]), r2(pos[2])], bed: finite(bed, 3) ? bed.slice(0, 3) : null };
    return true;
  };
  // the dim a save opens (game.js startWorld): a world this build does not know → home, at your place there
  Travel.openDim = (g, meta) => {
    const d = D.dimOf(meta);
    if (meta && meta.dim && meta.dim !== d && meta.dim !== 'overworld' && meta.dim !== 'flat') {
      const q = Travel.posOf(meta, d);
      if (q && meta.player) meta.player = Object.assign({}, meta.player, { pos: q.slice(0, 3), yaw: q[3], pitch: q[4] });
      meta.dim = d;
    }
    return d;
  };
  // saveMeta (game.js): the place in this world
  Travel.beforeSave = (g, m) => {
    const p = g.player, S = g.travel;
    if (!m || m.guest || !p || !g.dim || p.dead || !finite(p.pos, 3)) return;
    if (S && S.trip && S.trip.via === 'respawn') return;
    (m.pos || (m.pos = {}))[g.dim] = [r2(p.pos[0]), r2(p.pos[1]), r2(p.pos[2]), r3(p.yaw), r3(p.pitch)];
  };
  // teardownWorld (game.js): a gate's charge ends with its world
  Travel.onTeardown = (g) => { const S = g.travel; if (!S) return; S.gateT = 0; S.gateDim = null; if (!S.trip) veilCharge(0); };
  // the ships of a save per world (starships.js): spawn this world's (no dim = home's), keep the others aside …
  Travel.shipHere = (g, s, mgr) => {
    const home = D.home(g.meta), d = s && s.dim ? s.dim : home;
    if (d === (g.dim || home)) return true;
    (mgr.elsewhere || (mgr.elsewhere = [])).push(s);
    return false;
  };
  // … and on saving tag this world's and keep the others
  Travel.shipsSave = (mgr, meta) => {
    const g = mgr.g, d = g.dim || D.home(g.meta);
    for (const e of meta.starships) e.dim = d;
    if (mgr.elsewhere) for (const e of mgr.elsewhere) meta.starships.push(e);
  };
  // /dim [world] (game.js, with commands): the worlds of this save, or the trip to one (its id or its name)
  Travel.command = (g, a) => {
    const word = String((a || []).join(' ')).trim().toLowerCase(), list = D.travelable(g.meta);
    if (!word) { if (g.ui) g.ui.chatLine(T('g.travel.list', { list: list.map((d) => Travel.dimName(d) + ' (' + d + ')').join(' · '), dim: Travel.dimName(g.dim) }), '#cfe6ff'); return true; }
    const home = D.home(g.meta);
    let id = null;
    for (const d of list) {
      const n = D.name(d), names = [d, n[1], n[2], Travel.dimName(d)].map((s) => String(s).toLowerCase());
      if (names.includes(word) || (word.length >= 3 && names.some((s) => s.startsWith(word)))) { id = d; break; }
    }
    if (!id && (word === 'home' || word === 'heim' || word === 'zuhause' || word === 'overworld' || word === 'flat')) id = home;
    if (!id) { say(g, 'g.travel.unknown', word, '#ff8a8a'); return true; }
    Travel.go(g, { dim: id, via: 'cmd' });
    return true;
  };

  // ---------------------------------------------------------------- the veil (DOM, inline styles)
  const VEIL = { el: null, cap: null, sub: null, bar: null, k: -1, dim: null };
  function veilEl() {
    if (VEIL.el) return VEIL.el;
    if (typeof document === 'undefined' || !document.createElement) return null;
    const mk = (t) => { const e = document.createElement(t); if (!e.style) e.style = {}; return e; };
    const v = mk('div'); v.id = 'travelVeil'; if (v.setAttribute) { v.setAttribute('id', 'travelVeil'); v.setAttribute('aria-hidden', 'true'); }
    v.style.cssText = 'position:fixed;inset:0;z-index:850;pointer-events:none;opacity:0;display:flex;flex-direction:column;align-items:center;justify-content:center;transition:opacity .35s ease;text-align:center';
    const cap = mk('div'); cap.style.cssText = 'font:800 clamp(28px,5vw,62px)/1.1 var(--display,sans-serif);letter-spacing:3px;color:#fff;text-shadow:0 0 26px rgba(255,255,255,.7),0 2px 0 rgba(10,8,30,.35)';
    const sub = mk('div'); sub.style.cssText = 'margin-top:12px;font:600 16px var(--font,sans-serif);letter-spacing:1.5px;color:rgba(255,255,255,.9);text-shadow:0 1px 6px rgba(10,8,30,.45)';
    const track = mk('div'); track.style.cssText = 'position:absolute;left:32%;right:32%;bottom:13%;height:3px;border-radius:2px;background:rgba(255,255,255,.2);overflow:hidden';
    const bar = mk('div'); bar.style.cssText = 'height:100%;width:0;background:rgba(255,255,255,.9);transition:width .25s ease';
    track.appendChild(bar); v.appendChild(cap); v.appendChild(sub); v.appendChild(track);
    const host = (document.getElementById && document.getElementById('app')) || document.body;
    if (host) host.appendChild(v);
    VEIL.el = v; VEIL.cap = cap; VEIL.sub = sub; VEIL.bar = bar;
    return v;
  }
  function veilPaint(to, home) {
    const d = D.get(to), c = (d && d.veil) || ['#ffffff', '#c8d8ff', '#202850'];
    VEIL.el.style.background = 'radial-gradient(ellipse at 50% 52%, ' + c[0] + ' 0%, ' + c[1] + ' 44%, ' + c[2] + ' 100%)';
    VEIL.cap.textContent = (home ? '🏠 ' : '✦ ') + Travel.dimName(to);
    VEIL.dim = to;
  }
  function veilShow(to, instant, home) {
    if (!veilEl()) return;
    veilPaint(to, home);
    VEIL.sub.textContent = T(home ? 'g.travel.goingHome' : 'g.travel.going');
    VEIL.bar.style.width = '0%';
    VEIL.el.style.transition = instant ? 'none' : 'opacity ' + (Travel.FADE_IN / 1000) + 's ease';
    VEIL.el.style.opacity = '1'; VEIL.k = 1;
  }
  // a gate charging: the destination's glow grows over the world, its name in it
  function veilCharge(k, to, home) {
    const q = Math.round(k * 50) / 50;
    if (q === VEIL.k && (!to || to === VEIL.dim)) return;
    if (!q && VEIL.k <= 0) { VEIL.k = 0; return; }
    if (!veilEl()) return;
    if (to && to !== VEIL.dim) { veilPaint(to, !!home); VEIL.sub.textContent = T('g.travel.gate', { dim: Travel.dimName(to) }); VEIL.bar.style.width = '0%'; }
    VEIL.el.style.transition = q ? 'none' : 'opacity .3s ease';
    VEIL.el.style.opacity = String(q * 0.55); VEIL.k = q;
    if (!q) VEIL.dim = null;
  }
  // the game's own loading phases move the line (the words stay the trip's)
  function veilProgress(msg, frac) {
    if (!veilEl()) return;
    VEIL.bar.style.width = Math.round(Math.max(0, Math.min(1, +frac || 0)) * 100) + '%';
  }
  function veilHide() {
    if (!VEIL.el) return;
    VEIL.el.style.transition = 'opacity ' + (Travel.FADE_OUT / 1000) + 's ease';
    VEIL.el.style.opacity = '0'; VEIL.k = 0; VEIL.dim = null;
  }
})(VR);

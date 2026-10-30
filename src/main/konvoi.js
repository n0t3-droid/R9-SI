// ============================================================================
// a-konvoi — playing together across worlds (plan docs/superpowers/plans/2026-10-30-a-konvoi.md; spec
// docs/superpowers/specs/2026-10-22-waves.md §5.1 Konvoi, §6.3 u-mp). Multiplayer stays host-authoritative (mp.js);
// this file adds, without a server of its own:
//   · Mitreisen — the host's Reiseantrieb {k:'cruise'} and its trip {dim, at} (topic 'travel') ask every guest
//     „Mitreisen?"; a guest in space who says Ja flies in formation beside the host (the same deterministic cruise from
//     the host's state, 40 m aside per slot) and lands with it; a guest on the ground goes through the loading veil into
//     the same world at the host's place. Nein: the guest stays where it is, in the session, kindly told, with
//     Heimkehr and Nachreisen; what it builds there is kept by the host for that world (meta.netPendingD[dim]).
//   · the world on the wire — blk, edit, req, mods and diff carry d (the world they belong to); a message of another
//     world is never applied to this one; presence carries d and, in space, a thin dead-reckoned sp (≤ 2 KB/s).
//   · together in the Abenteuer — the host's freed outpost is a moment for every guest (sparks, the ring, the chord, the
//     banner with the shared reward); the story's offer and the host's choice are shown to all.
//   · who is where — the roster (name · world · distance) and the emote wheel (hold K: 👋 📍 👀), no text needed.
// Pure core node-tested (test/konvoi.js); the glue wraps VR.MP's methods (mp.js keeps its shape) and VR.Cruise.
// Cost 🟢: a few small messages; the roster's DOM four times a second; nothing per frame while alone.
// ============================================================================
(function (VR) {
  'use strict';
  const K = VR.Konvoi = VR.Konvoi || {};
  const T = (k, v) => (VR.I18N ? VR.I18N.t(k, v) : k);
  const fin = (x) => typeof x === 'number' && isFinite(x);
  const fin3 = (a) => Array.isArray(a) && a.length >= 3 && fin(a[0]) && fin(a[1]) && fin(a[2]);
  const rd = (x, k) => Math.round(x * k) / k;
  const name = (s) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 24);
  const word = (s, n) => (typeof s === 'string' && /^[a-z][a-z0-9_:-]*$/i.test(s) && s.length <= (n || 24) ? s : null);

  K.EMOTES = ['wave', 'here', 'look'];
  K.ICON = { wave: '👋', here: '📍', look: '👀' };
  K.DTOP = { blk: 1, edit: 1, req: 1, mods: 1, diff: 1 };   // the topics that belong to one world
  K.ASK_S = 20;          // s to answer „Mitreisen?" (then: Nein)
  K.EMOTE_GAP = 1.5;     // s between two emotes of one player
  K.HZ = 10;             // the space presence's tick
  K.BEAT = 1;            // s: a ship under way is sent at least this often
  K.BEAT_COAST = 10;     // s: a coasting ship's conic, again
  K.FAR = 3000;          // m: a ship in space farther than this is not drawn (its tag in the roster)
  K.KBPS = 2048;         // bytes a second a guest may send (the acceptance)
  K.FORM = (i) => { i = Math.max(0, i | 0); return [(i % 2 ? -1 : 1) * 40, i > 1 ? 20 : 0, 25 * (1 + (i >> 1))]; };   // east, up, south (behind) of the leader, in the trip's frame

  // ---------------------------------------------------------------- the messages (all checked on arrival)
  K.travelMsg = (dim, at, h, via) => ({ dim, at: fin3(at) ? [rd(at[0], 10), rd(at[1], 10), rd(at[2], 10)] : null, h: name(h) || null, via: word(via) || 'ship' });
  K.spOf = (st, q, acc) => {
    const o = { f: st.frame, r: [rd(st.r[0], 1), rd(st.r[1], 1), rd(st.r[2], 1)], v: [rd(st.v[0], 10), rd(st.v[1], 10), rd(st.v[2], 10)], q: [rd(q[0], 1e4), rd(q[1], 1e4), rd(q[2], 1e4), rd(q[3], 1e4)], t: rd(st.t, 100), c: st.coast ? 1 : 0 };
    if (acc && !st.coast && Math.hypot(acc[0], acc[1], acc[2]) > 0.05) o.a = [rd(acc[0], 10), rd(acc[1], 10), rd(acc[2], 10)];
    return o;
  };
  const spCheck = (sp) => {
    if (!sp || typeof sp !== 'object' || !word(sp.f, 16) || !fin3(sp.r) || !fin3(sp.v) || !Array.isArray(sp.q) || sp.q.length !== 4 || !sp.q.every(fin) || !fin(sp.t)) return null;
    const o = { f: sp.f, r: sp.r.slice(0, 3), v: sp.v.slice(0, 3), q: sp.q.slice(0, 4), t: sp.t, c: sp.c ? 1 : 0 };
    if (fin3(sp.a)) o.a = sp.a.slice(0, 3);
    return o;
  };
  K.spCheck = spCheck;
  // → a clean copy, or null (junk, a wrong kind, too big)
  K.check = (topic, d) => {
    if (!d || typeof d !== 'object') return null;
    try { if (JSON.stringify(d).length > 4096) return null; } catch (e) { return null; }
    if (topic === 'travel') {
      const dim = word(d.dim); if (!dim) return null;
      return { dim, at: fin3(d.at) ? d.at.slice(0, 3) : null, h: name(d.h) || null, via: word(d.via) || 'ship' };
    }
    if (topic !== 'konvoi') return null;
    switch (d.k) {
      case 'cruise': { const to = word(d.to, 16); if (!to) return null; return { k: 'cruise', to, sp: spCheck(d.sp), o: Array.isArray(d.o) ? d.o.filter(p => typeof p === 'string' && p.length <= 64).slice(0, 8) : [] }; }
      case 'descend': { const body = word(d.body, 16); return body ? { k: 'descend', body } : null; }
      case 'along': return { k: 'along', y: d.y ? 1 : 0, d: word(d.d) || null, i: Math.max(0, Math.min(7, d.i | 0)) };
      case 'arrived': { const dd = word(d.d); return dd ? { k: 'arrived', d: dd } : null; }
      case 'freed': {
        const id = typeof d.id === 'string' && d.id.length <= 40 ? d.id : null; if (!id || !fin3(d.b)) return null;
        const r = d.r && typeof d.r === 'object' ? { xp: Math.max(0, Math.min(1e5, d.r.xp | 0)), taler: Math.max(0, Math.min(1e5, d.r.taler | 0)) } : null;
        return { k: 'freed', id, b: d.b.slice(0, 3), r };
      }
      case 'story': {
        const id = typeof d.id === 'string' && /^[a-z0-9._-]{1,40}$/i.test(d.id) ? d.id : null, a = ['offer', 'watch', 'later'].indexOf(d.a) >= 0 ? d.a : null;
        return id && a ? { k: 'story', id, ch: Math.max(1, Math.min(12, d.ch | 0 || 1)), a } : null;
      }
      case 'emote': { if (K.EMOTES.indexOf(d.e) < 0) return null; return { k: 'emote', e: d.e, p: fin3(d.p) ? d.p.slice(0, 3) : null }; }
      default: return null;
    }
  };

  // ---------------------------------------------------------------- the space presence: thin, dead-reckoned
  K.predict = (sp, dt, out) => {
    out = out || [0, 0, 0];
    const a = sp.a || null;
    for (let i = 0; i < 3; i++) out[i] = sp.r[i] + sp.v[i] * dt + (a ? 0.5 * a[i] * dt * dt : 0);
    return out;
  };
  const _pr = [0, 0, 0];
  // send this sp now? G {last} — the last one sent; pred(sp, dt, out) for a coasting conic (U.coast), else K.predict
  K.gate = (G, sp, pred) => {
    const L = G.last;
    if (!L) return true;
    const dt = sp.t - L.t;
    if (dt < 1 / K.HZ - 1e-6 && dt >= 0) return false;
    if (dt < 0 || sp.f !== L.f || sp.c !== L.c) return true;
    if (dt >= (sp.c ? K.BEAT_COAST : K.BEAT)) return true;
    const p = (sp.c && pred ? pred : K.predict)(L, dt, _pr);
    const err = Math.hypot(p[0] - sp.r[0], p[1] - sp.r[1], p[2] - sp.r[2]), tol = 4 + 0.002 * Math.hypot(sp.v[0], sp.v[1], sp.v[2]);
    return err > tol;
  };
  // the presence a ship in space sends: the ground's fields left out (the place on the map, the look, the ship's design)
  K.thin = (pl, sp) => {
    const v = pl.v && typeof pl.v === 'object' ? { s: pl.v.s, a: pl.v.a || null, pa: pl.v.pa || null } : null;
    return { n: pl.n, p: Array.isArray(pl.p) ? pl.p.map(x => Math.round(x)) : [0, 0, 0], d: 'space', sp, v, lk: pl.lk || null };
  };
  K.bytes = (o) => { try { return JSON.stringify(o).length; } catch (e) { return 0; } };

  // ---------------------------------------------------------------- who is where
  K.dist = (m) => (m < 1000 ? Math.round(m) + ' m' : (m < 1e6 ? (m / 1000).toFixed(1) : Math.round(m / 1000).toLocaleString('de-DE')) + ' km');
  K.whereOf = (d) => (d === 'space' ? T('g.kv.space') : VR.Travel && VR.Travel.dimName ? VR.Travel.dimName(d) : d);
  // rows for the roster: the host first, then by distance (those in another world last); each {name, host, where, dist, txt}
  K.roster = (meD, list) => {
    const rows = (list || []).map((a) => {
      const d = a.d || 'overworld', same = d === meD, dist = same && fin(a.dist) ? a.dist : null;
      return { name: name(a.name) || '?', host: !!a.host, d, same, dist, txt: (name(a.name) || '?') + (a.host ? ' ★' : '') + ' · ' + K.whereOf(d) + (dist !== null ? ' · ' + K.dist(dist) : '') };
    });
    rows.sort((x, y) => (y.host - x.host) || (y.same - x.same) || ((x.dist === null ? 1e12 : x.dist) - (y.dist === null ? 1e12 : y.dist)) || (x.name < y.name ? -1 : 1));
    return rows;
  };
  // an emote may go out (one per K.EMOTE_GAP s)
  K.emoteOk = (st, t) => { if (t - (st.at === undefined ? -1e9 : st.at) < K.EMOTE_GAP) return false; st.at = t; return true; };
  // the system position (helia frame) of r in `frame` at t
  K.sysPos = (S, frame, r, t, out) => {
    out = out || [0, 0, 0];
    if (frame === 'helia') { out[0] = r[0]; out[1] = r[1]; out[2] = r[2]; return out; }
    const b = S.state(t).b[frame], p = b ? b.r : [0, 0, 0];
    out[0] = p[0] + r[0]; out[1] = p[1] + r[1]; out[2] = p[2] + r[2]; return out;
  };
  // local (east, up, south) → system with the frame L (row-major, columns east, up, south)
  K.toSys = (L, o, out) => { out = out || [0, 0, 0]; for (let i = 0; i < 3; i++) out[i] = L[i * 3] * o[0] + L[i * 3 + 1] * o[1] + L[i * 3 + 2] * o[2]; return out; };
  K.toLocal = (L, v, out) => { out = out || [0, 0, 0]; for (let j = 0; j < 3; j++) out[j] = L[j] * v[0] + L[3 + j] * v[1] + L[6 + j] * v[2]; return out; };

  // ================================================================ the game's glue
  if (typeof window === 'undefined' || !VR.MP || !VR.MP.prototype) return;
  const S0 = K.S = { ask: null, along: null, form: null, followers: new Map(), travel: null, hostDim: null, landWait: null, ride: null, arrived: true, rehost: false, wantMods: new Set(), moment: null, emote: {}, wheel: null, rosterT: 0, G: { last: null }, acc: [0, 0, 0], vPrev: null, tPrev: 0, sent: { bytes: 0, n: 0, t0: 0 }, stay: null };
  const game = () => VR.game || null;
  const UNI = () => VR.Universe;
  const MPp = VR.MP.prototype;
  const wrap = (o, k, fn) => { const f0 = o[k]; if (typeof f0 !== 'function') return; o[k] = function (...a) { return fn.call(this, f0, ...a); }; };
  const say = (g, txt, col) => { if (g && g.ui && g.ui.chatLine) g.ui.chatLine(txt, col || '#9affd8'); };
  const hostName = (mp) => name(mp.hostName) || T('g.mp.friend');
  const myD = (g) => { const fl = g && g.flight; return fl && fl.asc && fl.regime === 'space' ? 'space' : (g && g.dim) || 'overworld'; };
  K.dimOk = (d) => !!(word(d) && VR.DimReg && VR.DimReg.get && VR.DimReg.get(d));

  // ---- the bytes this page hands the transport (presence and messages): the measure of ≤ 2 KB/s
  const count = (o) => { S0.sent.bytes += K.bytes(o); S0.sent.n++; };
  K.rate = () => { const s = S0.sent, dt = (performance.now() - s.t0) / 1000; return { bytes: s.bytes, n: s.n, s: dt, bps: dt > 0 ? s.bytes / dt : 0 }; };
  K.rateReset = () => { S0.sent = { bytes: 0, n: 0, t0: performance.now() }; };

  // ---- the session's plumbing: two topics more, the world on every message of one world
  wrap(MPp, 'subscribe', function (f0, room) {
    f0.call(this, room);
    const on = (topic, fn) => this.subs.push(room.on(topic, (m) => {
      if (!m || !m.data || typeof m.data !== 'object' || m.data.s !== this.session || m.sameTab) return;
      const d = K.check(topic, m.data); if (!d) return;
      try { fn(m, d); } catch (e) { console.warn('mp ' + topic, e); }
    }, (e) => this.roomError(e)));
    on('travel', (m, d) => K.onTravel(this, m, d));
    on('konvoi', (m, d) => K.onMsg(this, m, d));
  });
  const tagD = function (f0, topic, data) {
    if (K.DTOP[topic] && data && typeof data === 'object' && this.g) data = Object.assign({ d: this.g.dim || 'overworld' }, data);
    if (this.room && data) count({ topic, data });
    return f0.call(this, topic, data);
  };
  wrap(MPp, 'send', tagD);
  wrap(MPp, 'emitNow', tagD);
  // a message of another world: never applied here (a guest's building there is kept by the host for that world)
  for (const [fn, topic] of [['onBlk', 'blk'], ['onMods', 'mods'], ['onDiff', 'diff'], ['onReq', 'req'], ['onEdit', 'edit']]) {
    wrap(MPp, fn, function (f0, m) {
      const d = m && m.data && m.data.d, g = this.g;
      if (typeof d === 'string' && g && d !== (g.dim || 'overworld')) { if (topic === 'edit' && this.role === 'host' && !m.sameTab) K.foreignEdit(this, d, m.data.c); return; }
      if (topic !== 'edit' && topic !== 'req' && this.role === 'client' && !S0.arrived) return;   // (a guest between two worlds)
      return f0.call(this, m);
    });
  }
  // a diff worked out while the host changed worlds is dropped (the guest asks again)
  wrap(MPp, 'columnDiff', function (f0, cx, cz) { const g = this.g, w0 = g.world; return f0.call(this, cx, cz).then((r) => (g.world === w0 ? r : null)); });
  // the guests' edits kept for a world: meta.netPendingD[dim] (the home's in meta.netPending, as before)
  const homeLike = (d) => d === 'overworld' || d === 'flat';
  K.foreignEdit = (mp, dim, c) => {
    const g = mp.g, m = g.meta; if (!m || m.guest || !Array.isArray(c) || !word(dim)) return;
    const P = (m.netPendingD || (m.netPendingD = {})), o = P[dim] || (P[dim] = {});
    if (Object.keys(o).length > 2000) return;
    for (const part of c) {
      if (!Array.isArray(part) || !fin(part[0]) || !fin(part[1]) || typeof part[2] !== 'string') continue;
      let a; try { const u8 = VR.Net.unb64(part[2]); a = new Int32Array(u8.buffer, 0, u8.length >> 2); } catch (e) { continue; }
      const k = VR.ckey(part[0], part[1]), arr = o[k] || (o[k] = []);
      for (let i = 0; i + 1 < a.length; i += 2) arr.push(a[i], a[i + 1]);
    }
  };
  wrap(MPp, 'savePending', function (f0) {
    const g = this.g, m = g.meta; if (!m || m.guest) return f0.call(this);
    const keep = m.netPending; f0.call(this);
    if (!homeLike(g.dim || 'overworld')) { (m.netPendingD || (m.netPendingD = {}))[g.dim] = m.netPending; m.netPending = keep; }
  });
  wrap(MPp, 'onWelcome', function (f0, m) { const d = m && m.data; if (d && this.role === 'joining' && d.to === this.myPeer()) { this.lastWel = d; S0.arrived = true; } return f0.call(this, m); });
  wrap(MPp, 'onHello', function (f0, m) {
    // the welcome says which world the host is in (a guest joining on Opal starts there)
    const se = this.send;
    this.send = function (topic, data) { if (topic === 'welcome' && data && !data.err) data.dim = this.g.dim || 'overworld'; return se.call(this, topic, data); };
    try { return f0.call(this, m); } finally { this.send = se; }
  });
  // hosting goes on in the new world: its changed columns, the edits kept for it, the guests that arrived there
  wrap(MPp, 'startHosting', function (f0) { if (this.role === 'host' && S0.rehost) return K.rehost(this); return f0.call(this); });
  K.rehost = (mp) => {
    const g = mp.g, w = g.world, m = g.meta; if (!w || !m) return;
    S0.rehost = false;
    mp.modKeys.clear(); mp.pending.clear();
    for (const k of w.savedKeys) mp.modKeys.add(k);
    for (const c of w.cols.values()) if (c.modified) mp.modKeys.add(c.key);
    const np = homeLike(g.dim) ? (m.netPending || {}) : ((m.netPendingD || {})[g.dim] || {});
    for (const k in np) { const mm = new Map(), a = np[k]; for (let i = 0; i < a.length; i += 2) mm.set(a[i], a[i + 1]); mp.pending.set(+k, mm); mp.modKeys.add(+k); }
    if (!homeLike(g.dim) && m.netPendingD) delete m.netPendingD[g.dim];
    for (const peer of S0.wantMods) K.sendMods(mp, peer);
    S0.wantMods.clear();
    mp.publish(true);
  };
  K.sendMods = (mp, peer) => {
    const keys = [...mp.modKeys], per = Math.floor(3600 / 4 * 3 / 8);
    for (let i = 0; i < keys.length || i === 0; i += per) {
      const part = keys.slice(i, i + per), a = new Int32Array(part.length * 2);
      part.forEach((k, j) => { a[j * 2] = Math.floor(k / 65536) - 32768; a[j * 2 + 1] = (k % 65536) - 32768; });
      mp.send('mods', { to: peer, k: VR.Net.b64(new Uint8Array(a.buffer)), last: i + per >= keys.length });
      if (!keys.length) break;
    }
  };

  // ---- presence: d and the world of each friend, the thin space presence
  wrap(MPp, 'publish', function (f0, force) {
    const g = this.g, fl = g.flight, a = fl && fl.asc;
    if (!this.room || !g.player || !a || fl.regime !== 'space' || !VR.Cruise || !VR.Cruise.spOf) {
      S0.G.last = null; S0.vPrev = null;
      const before = this.lastPres, r = f0.call(this, force);
      if (this.lastPres !== before && this.lastPres) S0.sent.bytes += this.lastPres.length + 48, S0.sent.n++;   // (the presence's wrapper ≈ 48 bytes)
      return r;
    }
    // under way: the acceleration from the last two states (the cruise's speed law makes it smooth)
    const st = a.st;
    if (S0.vPrev && st.t > S0.tPrev && S0.fPrev === st.frame) { const h = st.t - S0.tPrev; for (let i = 0; i < 3; i++) S0.acc[i] += ((st.v[i] - S0.vPrev[i]) / h - S0.acc[i]) * 0.5; } else S0.acc.fill(0);
    S0.vPrev = Array.from(st.v); S0.tPrev = st.t; S0.fPrev = st.frame;
    const q = UNI().matToQuat ? UNI().matToQuat(a.S, [0, 0, 0, 1]) : [0, 0, 0, 1];
    const sp = K.spOf(st, q, S0.acc);
    const coast = (L, dt, out) => { try { UNI().coast(L.r, L.v, UNI().home.body(L.f).mu, dt, out, [0, 0, 0]); } catch (e) { K.predict(L, dt, out); } return out; };
    if (!force && !K.gate(S0.G, sp, coast)) return;
    S0.G.last = sp;
    // (the ship's design from the full presence, once)
    const S = g.starships && g.starships.pilot, v = S && S.d && S.d.meta ? { s: S.d.seed, a: S.d.arch || null, pa: S.d.palette || null } : null;
    const lk = (() => { const o = g.heroOpts ? g.heroOpts() : null; return o ? [o.suit | 0, o.hair | 0, o.hs | 0, o.skin | 0, o.lashes ? 1 : 0] : null; })();
    const pl = K.thin({ n: this.myName(), p: g.player.pos, v, lk }, sp);
    const pres = { pl, role: this.role === 'host' ? 'host' : 'guest', ss: this.session };
    const s = JSON.stringify(pl); if (!force && s === this.lastPres) return;
    this.lastPres = s; count(pres);
    this.room.presence(pres).catch(() => { });
  });
  wrap(MPp, 'peersChanged', function (f0, ch) {
    f0.call(this, ch);
    if (!this.session) return;
    const g = this.g, me = myD(g);
    for (const p of ch.peers) {
      const a = this.remote.get(p.peer), pl = p.presence && p.presence.pl; if (!a || !pl) continue;
      a.d = word(pl.d) || 'overworld';
      const sp = pl.d === 'space' ? spCheck(pl.sp) : null;
      if (sp) { if (!a.sp || a.sp.t !== sp.t || a.sp.r[0] !== sp.r[0]) { a.sp = sp; const fl = g.flight; a.spMyT = fl && fl.asc ? fl.asc.st.t : null; a.spWall = performance.now(); } } else a.sp = null;
      a.away = a.d !== me;
    }
  });
  // where a friend's ship is drawn in space: beside one's own (the formation), or where it is relative to it
  const _Lm = new Float64Array(9), _R = new Float64Array(9), _Rm = new Float64Array(9), _P1 = [0, 0, 0], _P2 = [0, 0, 0], _rr = [0, 0, 0], _loc = [0, 0, 0], _eul = [0, 0, 0];
  K.spacePose = (g, a) => {
    const fl = g.flight, my = fl && fl.asc, A = VR.Ascent; if (!my || fl.regime !== 'space' || !a.sp || !A || !A.localFrame) return null;
    const st = my.st, L = A.localFrame(st, _Lm), b = fl.b;
    let off = null;
    const F = S0.form;
    if (F && my.cruise && F.leader === a.peer) { const o = K.FORM(F.slot); off = [-o[0], -o[1], -o[2]]; }
    else if (my.cruise && S0.followers.has(a.peer)) off = K.FORM(S0.followers.get(a.peer));
    if (!off) {
      const dt = a.spMyT !== null && a.spMyT !== undefined ? Math.max(0, Math.min(30, st.t - a.spMyT)) : 0;
      K.predict(a.sp, dt, _rr);
      const S = UNI().home;
      K.sysPos(S, a.sp.f, _rr, st.t, _P1); K.sysPos(S, st.frame, st.r, st.t, _P2);
      K.toLocal(L, [_P1[0] - _P2[0], _P1[1] - _P2[1], _P1[2] - _P2[2]], _loc);
      if (Math.hypot(_loc[0], _loc[1], _loc[2]) > K.FAR) return null;
      off = _loc;
    }
    // the attitude: its rotation seen in one's own local frame
    UNI().quatToMat(a.sp.q, _R);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) _Rm[i * 3 + j] = L[i] * _R[j] + L[3 + i] * _R[3 + j] + L[6 + i] * _R[6 + j];
    const e = A.mToEuler ? A.mToEuler(_Rm, _eul) : [0, 0, 0];
    return { pos: [b.pos[0] + off[0], b.pos[1] + off[1], b.pos[2] + off[2]], yaw: e[0], pitch: e[1], roll: e[2] };
  };

  // ---- Mitreisen: the host's side
  const C = () => VR.Cruise;
  K.guests = (mp) => !!(mp && mp.isHost && mp.remote && mp.remote.size > 0);
  // travel.js switchNow: a host with guests keeps the room and takes them along (true: handled)
  K.hostTravel = (g, trip, arrive) => {
    const mp = g.mp; if (!K.guests(mp) || !trip || !arrive) return false;
    mp.flush(true);
    mp.savePending();
    mp.pending.clear(); mp.modKeys.clear(); mp.diffQ = []; mp.out.clear();
    S0.rehost = true; S0.wantMods = new Set();
    mp.emitNow('travel', K.travelMsg(trip.to, arrive.pos, mp.myName(), trip.via));
    return true;
  };
  K.install = () => {
    const CR = C(); if (!CR || CR.__kv) return; CR.__kv = true;
    const start0 = CR.start;
    CR.start = (fl, to, quiet) => {
      const ok = start0(fl, to, quiet);
      const g = fl && fl.g, mp = g && g.mp;
      if (ok && K.guests(mp) && !S0.joining) {
        const a = fl.asc, q = UNI().matToQuat ? UNI().matToQuat(a.S, [0, 0, 0, 1]) : [0, 0, 0, 1];
        S0.followers.clear();
        mp.send('konvoi', { k: 'cruise', to, sp: K.spOf(a.st, q), o: [...mp.remote.keys()].slice(0, 8) });
      }
      return ok;
    };
    const desc0 = CR.descend;
    CR.descend = (fl, body) => {
      const ok = desc0(fl, body), g = fl && fl.g, mp = g && g.mp;
      if (ok && K.guests(mp) && fl.asc && fl.asc.cruise && fl.asc.cruise.kind === 'descent') mp.send('konvoi', { k: 'descend', body });
      return ok;
    };
    // a guest in the Konvoi lands with the host (travel.js keeps every other trip for the host)
    const TR = VR.Travel;
    if (TR && TR.canGo && !TR.__kv) { TR.__kv = true; const cg = TR.canGo; TR.canGo = (g, to) => (g && g.meta && g.meta.guest && S0.landWait === 'descending' ? null : cg(g, to)); }
  };

  // ---- Mitreisen: the guest's side
  K.onTravel = (mp, m, d) => {
    if (mp.role !== 'client' || m.peer !== mp.hostPeer) return;
    S0.travel = d; S0.hostDim = d.dim;
    const g = mp.g;
    if (d.dim === g.dim) return;
    if (S0.landWait) return;   // (the descent beside the host: the switch when it is down)
    if (S0.along) { K.follow(mp, false); return; }
    K.ask(mp, 'travel', d);
  };
  K.onMsg = (mp, m, d) => {
    const g = mp.g, fromHost = m.peer === mp.hostPeer;
    switch (d.k) {
      case 'cruise': {
        if (mp.role !== 'client' || !fromHost) return;
        S0.hostCruise = d;
        const fl = g.flight;
        if (fl && fl.asc && fl.regime === 'space' && g.starships && g.starships.pilot) K.ask(mp, 'cruise', d);
        else say(g, T('g.kv.hostCruise', { host: hostName(mp), name: VR.SpaceFlight ? VR.SpaceFlight.nameOf(d.to) : d.to }));
        return;
      }
      case 'descend': {
        if (mp.role !== 'client' || !fromHost || !S0.along) return;
        const fl = g.flight; if (!fl || !fl.asc || fl.regime !== 'space') return;
        if (fl.asc.cruise && C().abort) C().abort(fl);
        S0.landWait = 'descending';
        try { C().descend(fl, d.body); } finally { if (S0.landWait === 'descending') S0.landWait = 'down'; }
        say(g, T('g.kv.descent', { name: VR.SpaceFlight ? VR.SpaceFlight.nameOf(d.body) : d.body }));
        return;
      }
      case 'along': {
        if (mp.role !== 'host') return;
        const a = mp.remote.get(m.peer), nm = a ? a.name : T('g.mp.aFriend');
        if (d.y) { S0.followers.set(m.peer, d.i); say(g, T('g.kv.joined', { name: nm })); }
        else { S0.followers.delete(m.peer); say(g, T('g.kv.declined', { name: nm }), '#cfd8e6'); }
        return;
      }
      case 'arrived': {
        if (mp.role !== 'host') return;
        if (d.d === g.dim && !S0.rehost && g.state === 'play') K.sendMods(mp, m.peer); else S0.wantMods.add(m.peer);
        return;
      }
      case 'freed': if (mp.role === 'client' && fromHost) K.guestMoment(g, d); return;
      case 'story': if (mp.role === 'client' && fromHost) K.storyLine(mp, d); return;
      case 'emote': K.showEmote(mp, m.peer, d); return;
    }
  };
  // the question card: „Mitreisen?" Ja / Nein (J / N, 20 s → Nein)
  K.ask = (mp, kind, d) => {
    const g = mp.g;
    const host = hostName(mp), txt = kind === 'cruise' ? T('g.kv.askCruise', { host, name: VR.SpaceFlight ? VR.SpaceFlight.nameOf(d.to) : d.to }) : T('g.kv.askTravel', { host, dim: K.whereOf(d.dim) });
    S0.ask = { kind, d, t: 0, mp };
    card(txt, [[T('g.kv.yes'), () => K.answer(true)], [T('g.kv.no'), () => K.answer(false)]]);
    if (g.audio && g.audio.play) { try { g.audio.play('ping', { vol: 0.6 }); } catch (e) { /* a sound */ } }
  };
  K.answer = (yes) => {
    const A0 = S0.ask; if (!A0) return false;
    S0.ask = null; card(null);
    const mp = A0.mp, g = mp.g;
    if (A0.kind === 'cruise') {
      const i = Math.max(0, (A0.d.o || []).indexOf(mp.myPeer()));
      mp.send('konvoi', { k: 'along', y: yes ? 1 : 0, d: g.dim, i });
      if (yes) K.joinCruise(mp, A0.d, i);
      return true;
    }
    if (yes) { S0.along = { yes: true }; mp.send('konvoi', { k: 'along', y: 1, d: A0.d.dim, i: 0 }); K.follow(mp, false); }
    else { mp.send('konvoi', { k: 'along', y: 0, d: g.dim, i: 0 }); K.stay(mp, A0.d); }
    return true;
  };
  // in formation: the host's state (its frame, place, way, attitude), the drive started, then set aside by the slot
  K.joinCruise = (mp, d, slot) => {
    const g = mp.g, fl = g.flight, a = fl && fl.asc, CR = C(); if (!a || !CR) return false;
    if (a.cruise && CR.abort) CR.abort(fl);
    if (d.sp) {
      const st = a.st, sp = d.sp;
      st.frame = sp.f; st.r.set(sp.r); st.v.set(sp.v); st.t = sp.t; st.coast = false;
      if (UNI().quatToMat) UNI().quatToMat(sp.q, a.S);
    }
    S0.joining = true;
    let ok = false; try { ok = CR.start(fl, d.to, true); } finally { S0.joining = false; }
    if (!ok) return false;
    const c = a.cruise, o = K.FORM(slot), M = CR.tripM;
    if (c && M) { const s = K.toSys(M, o); for (let i = 0; i < 3; i++) { c.P[i] += s[i]; a.st.r[i] += s[i]; } }
    S0.form = { leader: mp.hostPeer, slot }; S0.along = { yes: true };
    say(g, T('g.kv.alongOn', { host: hostName(mp) }));
    return true;
  };
  // into the host's world (the ship comes along when there was one); on foot through the loading veil
  K.follow = (mp, byShip) => {
    const g = mp.g, d = S0.travel; if (!d || !K.dimOk(d.dim) || mp.role !== 'client') return false;
    K.stayCard(null);
    const S = g.starships, s = S && S.pilot && S.pilot.d && S.pilot.d.meta ? S.pilot : null;
    S0.ride = byShip && s ? { seed: s.d.seed, arch: s.d.arch || null, pa: s.d.palette || null, t: 0 } : null;
    mp.flush(true);
    mp.modKeys.clear(); mp.reqQ.clear(); mp.requested.clear(); mp.out.clear();
    const slot = S0.form ? S0.form.slot : 0;
    S0.arrived = false; S0.landWait = null; S0.form = null;
    try { if (S) S.shutdown(); if (g.gadgets && g.gadgets.shutdown) g.gadgets.shutdown(); } catch (e) { console.warn(e); }
    const at = d.at || (mp.lastWel && mp.lastWel.spawn) || [0.5, 100, 0.5];
    const o = K.FORM(slot);
    const wel = Object.assign({}, mp.lastWel || {}, { dim: d.dim, spawn: [at[0] + o[0] * 0.15, at[1], at[2] + 6, 0, 0] });
    mp.lastWel = wel;
    g.startGuestWorld(wel, mp);
    return true;
  };
  // cruise.js descentStep, a guest's ship down at the end of the descent: the switch when the host's trip is known
  K.guestLand = (g, c) => { S0.landWait = { dim: c.dim, body: c.body }; };
  // Nein: stay here, kindly told; Heimkehr (to the title, the host keeps the pocket) or Nachreisen while the host is there
  K.stay = (mp, d) => {
    const g = mp.g, host = hostName(mp);
    say(g, T('g.kv.stay', { host, dim: K.whereOf(d.dim) }), '#ffd98a');
    S0.stay = { dim: d.dim };
    K.stayCard(T('g.kv.stay', { host, dim: K.whereOf(d.dim) }), mp);
  };
  K.stayCard = (txt, mp) => {
    if (!txt) { S0.stay = null; card(null, null, 'kvstay'); return; }
    card(txt, [[T('g.kv.follow'), () => { if (S0.travel) K.follow(mp, false); }], [T('g.kv.home'), () => { K.stayCard(null); const g = mp.g; mp.leave(); g.leaveGuestWorld(T('g.kv.homeNote', { host: hostName(mp) })); }]], 'kvstay', true);
  };

  // ---- together in the Abenteuer: the host's moment for every guest, the shared reward, the story
  K.installAdv = () => {
    const L = VR.Liberate; if (!L || L.__kv) return; L.__kv = true;
    const free0 = L.free;
    L.free = function (g, s) {
      const ok = free0.call(this, g, s), mp = g && g.mp;
      if (ok && K.guests(mp)) mp.send('konvoi', { k: 'freed', id: s.id, b: (s.beacon || [s.x, s.y + 1, s.z]).slice(0, 3) });
      return ok;
    };
    const ban0 = L.banner;
    L.banner = function (g, s, r) {
      ban0.call(this, g, s, r);
      const mp = g && g.mp;
      if (!K.guests(mp) || !s) return;
      // the reward shared: every guest's record in the host's save gets the same (meta.konvoi.guests[who])
      const rr = { xp: (r && r.xp) | 0, taler: ((r && r.taler) | 0) + ((r && r.gift) | 0) };
      const m = g.meta, K0 = m && !m.guest ? (m.konvoi || (m.konvoi = { guests: {} })) : null;
      if (K0) for (const a of mp.remote.values()) { const who = a.by || ('n:' + a.name), e = K0.guests[who] || (K0.guests[who] = { xp: 0, taler: 0, freed: 0 }); e.xp += rr.xp; e.taler += rr.taler; e.freed++; }
      mp.send('konvoi', { k: 'freed', id: s.id, b: (s.beacon || [s.x, s.y + 1, s.z]).slice(0, 3), r: rr });
    };
    const SP = VR.StoryPlay && VR.StoryPlay.Player && VR.StoryPlay.Player.prototype;
    if (SP) {
      const tell = (pl, b, a) => { const g = pl && pl.g, mp = g && g.mp; if (b && K.guests(mp)) mp.send('konvoi', { k: 'story', id: b.id, ch: b.ch, a }); };
      wrap(SP, 'announce', function (f0, b) { const ok = f0.call(this, b); if (ok) tell(this, b, 'offer'); return ok; });
      wrap(SP, 'watch', function (f0, b) { const b0 = b || (this.offer && this.offer.b); const ok = f0.call(this, b); if (ok) tell(this, b0 || (this.scene && this.scene.b), 'watch'); return ok; });
      wrap(SP, 'later', function (f0, said) { const b = this.offer && this.offer.b; f0.call(this, said); if (b) tell(this, b, 'later'); });
    }
  };
  K.storyLine = (mp, d) => {
    const g = mp.g, S = VR.Story, ch = S && S.CHAPTERS ? S.CHAPTERS[d.ch - 1] : null, title = ch ? T(ch.title) : '';
    const txt = T('g.kv.story.' + d.a, { host: hostName(mp), title });
    if (d.a === 'offer') { const fk = g.funke; if (fk && fk.on && fk.on() && fk.show) fk.show(txt); else if (g.ui && g.ui.hint) g.ui.hint(txt, 4000); }
    say(g, txt, '#ffd98a');
  };
  // the moment at a guest: the beacon's blocks come with the host's edits; the light, the ring, the chord and the
  // banner are drawn here on the host's clock (≈ 6 s)
  K.guestMoment = (g, d) => {
    const M = S0.moment;
    if (M && M.id === d.id) { if (d.r) { M.r = d.r; if (M.bannered) K.bannerAt(g, M); } return; }
    if (d.r) return;   // (the reward of a moment not seen: the record is kept by the host)
    S0.moment = { id: d.id, b: d.b, t: 0, done: {}, r: null, bannered: false };
  };
  K.bannerAt = (g, M) => {
    const L = VR.Liberate; if (!L || !L.banner) return;
    const s = { id: M.id, x: M.b[0], y: M.b[1] - 1, z: M.b[2] };
    // (L.banner is wrapped above: a guest is no host, so nothing is sent)
    L.banner(g, s, M.r ? { xp: M.r.xp, taler: M.r.taler } : null);
    M.bannered = true;
    if (M.r && (M.r.xp || M.r.taler)) say(g, T('g.kv.freed.share', { r: [M.r.xp ? T('g.adv.float', { n: M.r.xp }) : '', M.r.taler ? T('g.adv.taler', { n: '+' + M.r.taler }) : ''].filter(Boolean).join(' · ') }), '#ffd98a');
  };
  const stepMoment = (g, dt) => {
    const M = S0.moment, L = VR.Liberate, P = g.particles, au = g.audio, b = M.b, t0 = M.t;
    M.t += dt;
    const at = (t) => t0 < t && M.t >= t;
    if (P && M.t < 0.6 && Math.random() < 0.6) P.spark(b[0] + 0.5, b[1] + 0.8, b[2] + 0.5, Math.random() < 0.5 ? [1, 0.3, 0.9] : [0.5, 0.95, 1], 6, 2.5, 1);
    if (at(0.6)) { if (P) { P.spark(b[0] + 0.5, b[1] + 1, b[2] + 0.5, [0.6, 1, 1], 60, 7, 1); P.spark(b[0] + 0.5, b[1] + 1, b[2] + 0.5, [1, 1, 1], 30, 4, 1); } if (L && L.bloom) L.bloom(); if (au && au.play) au.play('thump', { vol: 0.8 }); }
    if (P && M.t > 0.6 && M.t < 3.5 && Math.random() < 0.5) P.glow(b[0] + 0.5 + (Math.random() - 0.5) * 2, b[1] + 1 + Math.random() * 3, b[2] + 0.5 + (Math.random() - 0.5) * 2, [0.55, 1, 1], 2.2, 0.06, 1.6);
    // the ring of light sweeping over the land (liberate.js's radius law; glints on its front, by the particle tier)
    const R = L && L.ringR ? L.ringR(M.t) : -1;
    if (P && R > 0) {
      const tier = g.settings && g.settings.preset === 'potato' ? 0 : g.settings && g.settings.preset === 'high' ? 2 : 1, n = Math.round((L.GLINTS ? L.GLINTS[tier] : 14) * dt * 60), w = g.world;
      for (let i = 0; i < n; i++) {
        const ang = Math.random() * Math.PI * 2, x = b[0] + 0.5 + Math.cos(ang) * R, z = b[2] + 0.5 + Math.sin(ang) * R;
        const y = w && w.topAt ? w.topAt(Math.floor(x), Math.floor(z)) + 1.1 : b[1];
        P.spawn(x, y, z, 0, 0.8 + Math.random(), 0, { life: 0.9, size: 0.3, grav: -0.2, col: Math.random() < 0.5 ? [1, 0.9, 0.5] : [0.6, 1, 0.6], emis: 1, drag: 0.5, collide: false });
      }
    }
    if (at(0.9) && au) { if (au.swell) au.swell(g.env ? g.env.day | 0 : 0, 0.9); if (au.ctx && au.tone) { const t = au.ctx.currentTime; [392, 494, 587, 784, 988].forEach((f, i) => { au.tone(f, 0.09, 2.6 - i * 0.2, 'sine', true, t + i * 0.16); }); } }
    if (at(2.4)) K.bannerAt(g, M);
    if (M.t > 6.5) S0.moment = null;
  };

  // ---- who is where: the roster (top right) · the emote wheel (hold K)
  const css = () => {
    if (document.getElementById('kvcss')) return;
    const st = document.createElement('style'); st.id = 'kvcss';
    st.textContent = '#kvroster{position:absolute;top:118px;right:12px;z-index:6;font:600 12px/1.45 system-ui,sans-serif;color:#e8f2ff;background:rgba(8,14,26,.55);border:1px solid rgba(140,190,255,.25);border-radius:8px;padding:5px 9px;pointer-events:none;max-width:260px}#kvroster b{color:#9fd4ff;font-weight:700}#kvroster .o{opacity:.62}' +
      '.kvcard{position:absolute;left:50%;top:22%;transform:translateX(-50%);z-index:30;background:rgba(10,18,34,.92);border:1px solid rgba(150,210,255,.5);border-radius:12px;padding:12px 16px;color:#eef6ff;font:600 15px/1.4 system-ui,sans-serif;text-align:center;box-shadow:0 8px 28px rgba(0,0,0,.45);max-width:520px}.kvcard.low{top:auto;bottom:120px}.kvcard button{margin:10px 6px 0;padding:6px 16px;border-radius:8px;border:1px solid rgba(160,220,255,.6);background:rgba(60,120,200,.35);color:#fff;font:700 14px system-ui,sans-serif;cursor:pointer}' +
      '#kvwheel{position:absolute;left:50%;top:50%;width:220px;height:220px;margin:-110px 0 0 -110px;z-index:25;pointer-events:none}#kvwheel div{position:absolute;width:76px;height:76px;margin:-38px 0 0 -38px;border-radius:50%;background:rgba(10,18,34,.75);border:2px solid rgba(150,210,255,.35);color:#fff;font:600 12px system-ui,sans-serif;text-align:center;padding-top:10px;box-sizing:border-box}#kvwheel div span{display:block;font-size:26px;line-height:30px}#kvwheel div.on{border-color:#ffd98a;background:rgba(80,60,10,.8)}' +
      '.kvemo{position:absolute;z-index:7;font:600 13px system-ui,sans-serif;color:#fff;text-shadow:0 1px 3px #000;pointer-events:none;text-align:center;transform:translate(-50%,-100%)}.kvemo span{display:block;font-size:30px;line-height:34px}';
    document.head.appendChild(st);
  };
  function card(txt, btns, id, low) {
    id = id || 'kvask';
    let el = document.getElementById(id);
    if (!txt) { if (el) el.remove(); return; }
    css();
    if (!el) { el = document.createElement('div'); el.id = id; el.className = 'kvcard' + (low ? ' low' : ''); el.setAttribute('role', 'dialog'); (document.getElementById('app') || document.body).appendChild(el); }
    el.textContent = '';
    const p = document.createElement('div'); p.textContent = txt; el.appendChild(p);
    for (const [lab, fn] of btns || []) { const b = document.createElement('button'); b.textContent = lab; b.onclick = (e) => { e.stopPropagation(); fn(); }; el.appendChild(b); }
  }
  K.card = card;
  const roster = (g) => {
    const mp = g.mp, on = !!(mp && mp.session && mp.remote.size && g.state === 'play' && !g.hideHud);
    let el = document.getElementById('kvroster');
    if (!on) { if (el) el.style.display = 'none'; return; }
    css();
    if (!el) { el = document.createElement('div'); el.id = 'kvroster'; (document.getElementById('hud') || document.body).appendChild(el); }
    const me = myD(g), fl = g.flight;
    const list = [...mp.remote.values()].filter(a => a.has).map(a => {
      let dist = mp.g.player ? Math.hypot(a.pos[0] - g.player.pos[0], a.pos[1] - g.player.pos[1], a.pos[2] - g.player.pos[2]) : null;
      if (a.d === 'space' && me === 'space' && fl && a.ship && a.ship.pos) dist = Math.hypot(a.ship.pos[0] - fl.b.pos[0], a.ship.pos[1] - fl.b.pos[1], a.ship.pos[2] - fl.b.pos[2]);
      return { name: a.name, host: a.host, d: a.d || 'overworld', dist };
    });
    const rows = K.roster(me, list);
    const html = '<b>' + T('g.kv.roster') + '</b>' + rows.map(r => '<div class="' + (r.same ? '' : 'o') + '">' + r.txt.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])) + '</div>').join('');
    if (el.__h !== html) { el.innerHTML = html; el.__h = html; }
    el.style.display = '';
  };
  K.emote = (e, p) => {
    const g = game(), mp = g && g.mp; if (!mp || !mp.session || K.EMOTES.indexOf(e) < 0) return false;
    if (!K.emoteOk(S0.emote, (performance.now() / 1000))) return false;
    const pos = p || (g.player ? [rd(g.player.pos[0], 10), rd(g.player.pos[1] + 2.2, 10), rd(g.player.pos[2], 10)] : null);
    mp.send('konvoi', { k: 'emote', e, p: pos });
    K.showEmote(mp, null, { e, p: pos });
    return true;
  };
  const emos = [];
  K.showEmote = (mp, peer, d) => {
    const g = mp.g, a = peer ? mp.remote.get(peer) : null;
    if (a && a.away) { say(g, K.ICON[d.e] + ' ' + a.name + ' (' + K.whereOf(a.d) + '): ' + T('g.kv.e.' + d.e), '#cfd8e6'); return; }
    const who = a ? a.name : mp.myName();
    css();
    const el = document.createElement('div'); el.className = 'kvemo';
    const sp = document.createElement('span'); sp.textContent = K.ICON[d.e]; el.appendChild(sp); el.appendChild(document.createTextNode(who + ' · ' + T('g.kv.e.' + d.e)));
    (document.getElementById('hud') || document.body).appendChild(el);
    emos.push({ el, a, p: d.p || (a ? [a.pos[0], a.pos[1] + 2.4, a.pos[2]] : null), t: 0 });
    if (peer && g.audio && g.audio.play) { try { g.audio.play('ping', { vol: 0.35 }); } catch (e) { /* a sound */ } }
    if (emos.length > 6) { const o = emos.shift(); o.el.remove(); }
  };
  const stepEmotes = (g, dt) => {
    const r = g.renderer, cam = g.cam;
    for (let i = emos.length - 1; i >= 0; i--) {
      const o = emos[i]; o.t += dt;
      if (o.t > 3.2 || !r || !cam || !o.p) { o.el.remove(); emos.splice(i, 1); continue; }
      const m = r.viewProj, px = o.p[0] - cam.x, py = o.p[1] + o.t * 0.3 - cam.y, pz = o.p[2] - cam.z;
      const X = m[0] * px + m[4] * py + m[8] * pz + m[12], Y = m[1] * px + m[5] * py + m[9] * pz + m[13], W = m[3] * px + m[7] * py + m[11] * pz + m[15];
      if (W <= 0.1) { o.el.style.display = 'none'; continue; }
      o.el.style.display = ''; o.el.style.left = Math.round((X / W * 0.5 + 0.5) * window.innerWidth) + 'px'; o.el.style.top = Math.round((0.5 - Y / W * 0.5) * window.innerHeight) + 'px';
      o.el.style.opacity = String(Math.min(1, (3.2 - o.t) * 2));
    }
  };
  // the wheel: hold K, the mouse points (up 👋, right 📍 at the place one looks at, left 👀), let go to send
  const wheelOpen = () => {
    if (S0.wheel) return; const g = game(); if (!g || !g.mp || !g.mp.session || g.state !== 'play') return;
    css();
    const el = document.createElement('div'); el.id = 'kvwheel';
    const pos = { wave: [110, 34], here: [186, 140], look: [34, 140] };
    for (const e of K.EMOTES) { const d = document.createElement('div'); d.dataset.e = e; d.style.left = pos[e][0] + 'px'; d.style.top = pos[e][1] + 'px'; const s = document.createElement('span'); s.textContent = K.ICON[e]; d.appendChild(s); d.appendChild(document.createTextNode(T('g.kv.e.' + e))); el.appendChild(d); }
    (document.getElementById('app') || document.body).appendChild(el);
    S0.wheel = { el, x: 0, y: 0, pick: 'wave' }; markWheel();
  };
  const markWheel = () => { const W = S0.wheel; if (!W) return; for (const d of W.el.children) d.className = d.dataset.e === W.pick ? 'on' : ''; };
  const wheelClose = (send) => {
    const W = S0.wheel; if (!W) return; S0.wheel = null; W.el.remove();
    if (!send) return;
    let p = null;
    if (W.pick === 'here') { const g = game(), h = g && g.lookHit ? g.lookHit : null; if (h && h.pos) p = [h.pos[0] + 0.5, h.pos[1] + 1.5, h.pos[2] + 0.5]; else if (g && g.player) { const pl = g.player, d = 6; p = [rd(pl.pos[0] - Math.sin(pl.yaw) * d, 10), rd(pl.pos[1] + 1.6, 10), rd(pl.pos[2] - Math.cos(pl.yaw) * d, 10)]; } }
    K.emote(W.pick, p);
  };
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const g = game(); if (!g || g.state !== 'play') return;
    const tgt = e.target; if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA')) return;
    if (S0.ask && (e.code === 'KeyJ' || e.code === 'KeyN')) { e.stopImmediatePropagation(); e.preventDefault(); K.answer(e.code === 'KeyJ'); return; }
    if (e.code === 'KeyK' && g.mp && g.mp.session) { wheelOpen(); }
  }, true);
  window.addEventListener('keyup', (e) => { if (e.code === 'KeyK' && S0.wheel) wheelClose(true); }, true);
  window.addEventListener('mousemove', (e) => {
    const W = S0.wheel; if (!W) return;
    W.x += e.movementX || 0; W.y += e.movementY || 0;
    const l = Math.hypot(W.x, W.y); if (l > 120) { W.x *= 120 / l; W.y *= 120 / l; }
    if (l > 18) { const ang = Math.atan2(W.x, -W.y); W.pick = Math.abs(ang) < Math.PI / 3 ? 'wave' : ang > 0 ? 'here' : 'look'; markWheel(); }
  }, true);

  // ---- per frame (game.js update → mp.update): the question's clock, the guest's arrival, the ride, the moment
  wrap(MPp, 'update', function (f0, dt) {
    f0.call(this, dt);
    const g = this.g;
    K.install(); K.installAdv();
    if (S0.ask && (S0.ask.t += dt) > K.ASK_S) K.answer(false);
    if (this.role === 'client') {
      // the descent beside the host is down: into its world when its trip is known
      const LW = S0.landWait;
      if (LW && typeof LW === 'object' && S0.travel && S0.travel.dim === LW.dim) { S0.landWait = null; K.follow(this, true); }
      if (!S0.arrived && g.state === 'play' && g.world) {
        S0.arrived = true;
        this.send('konvoi', { k: 'arrived', d: g.dim });
        for (const c of g.world.cols.values()) if (c.ready) this.requested.delete(c.key);
      }
      if (S0.ride && g.state === 'play') K.rideTick(g, dt);
      if (S0.stay && S0.hostDim === g.dim) K.stayCard(null);
    }
    if (S0.moment) stepMoment(g, dt);
    if (emos.length) stepEmotes(g, dt);
    if ((S0.rosterT -= dt) <= 0) { S0.rosterT = 0.25; roster(g); }
  });
  wrap(MPp, 'clearSession', function (f0) {
    f0.call(this);
    S0.ask = null; S0.along = null; S0.form = null; S0.followers.clear(); S0.travel = null; S0.hostDim = null; S0.landWait = null; S0.ride = null; S0.arrived = true; S0.rehost = false; S0.wantMods.clear(); S0.moment = null; S0.G.last = null;
    card(null); K.stayCard(null); wheelClose(false);
    const el = document.getElementById('kvroster'); if (el) el.style.display = 'none';
  });
  // the guest's ship after the descent: built over the place, boarded, sinking to the site (cruise.js C.ride)
  K.rideTick = (g, dt) => {
    const R0 = S0.ride, S = g.starships, p = g.player; if (!S || !p) return;
    R0.t += dt;
    if (R0.t > 30) { S0.ride = null; return; }
    if (!R0.ship) { try { S.placeInFront(R0.seed, R0.arch, R0.pa, p); } catch (e) { S0.ride = null; return; } R0.ship = true; return; }
    const s = S.ships.find(q => q.d.seed === R0.seed && !q.hangar);
    if (!s || !s.d.meta || !s.d.cells) return;
    S0.ride = null;
    const CR = C(); if (!CR || !CR.ride) return;
    if (!CR.landing || CR.landing.dim !== g.dim) CR.landing = { dim: g.dim, body: g.dim, t0: performance.now() };
    CR.ride(g, S, s, { air: CR.HOVER || 420 });
  };
})(typeof VR !== 'undefined' ? VR : (globalThis.VR = globalThis.VR || {}));

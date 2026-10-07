// ============================================================================
// Multiplayer: play together in one world.
//
// Model: the HOST's browser is the authority for its world (its save, its
// time & weather, every block). A friend who JOINS generates the same terrain
// locally from the same seed, receives the host's edits (a compact diff per
// changed chunk column + every live block change), and sends their own
// breaks & placements to the host, who applies and re-broadcasts them.
// Players see each other through presence (position, look, what they hold,
// the ship they fly) at ~10 Hz, smoothed.
//
// Topics (all ≤ 4 KiB JSON):
//   hello   guest → host   {v, n}                   ask to join
//   welcome host → guest   {to, v, w, time, day, rain, spawn, player, ...}
//   mods    host → guest   {to, k}                  changed columns (base64 Int32 pairs)
//   req     guest → host   {k}                      please send these columns' diffs
//   diff    host → guest   {to, c:[cx,cz,b64]}      one column's changes vs. generation
//   blk     host → all     {c:[[cx,cz,b64],...]}    live block changes
//   edit    guest → host   {c:[[cx,cz,b64],...]}    a guest's block changes
//   env     host → all     {t, d, r, th}            time & weather
//   chat    anyone         {t}
//   summon  host → guest   {to, p, f}               "come here"
//   pdata   guest → host   {p}                      guest's inventory etc. (kept in the host's save)
//   bye     anyone         {}                       leaving (host: session ends)
// Block edits are packed per column as Uint16 pairs (index y<<8|z<<4|x, state).
// Transport: every session runs in the page's LOBBY room (the one room every
// admitted viewer can use — named rooms may be closed to invited guests);
// each message carries its session id `s` and each player's presence `ss`,
// so pages ignore sessions they're not part of.
// ============================================================================
(function (VR) {
  'use strict';
  // the player's language (lang_de.js / lang_en.js)
  const T = (k, v, fb) => (VR.I18N ? VR.I18N.t(k, v, fb) : (fb !== undefined ? fb : k));
  const R = VR.R, F = VR.F;
  const PROTO = 1;
  const NOTICE = 'r9si.mpNotice';   // 👥 the one-time name notice: '1' = answered (✓ OK or a nickname), 'off' = „Mehrspieler aus“ — once per browser
  const TOPICS = ['hello', 'welcome', 'mods', 'req', 'diff', 'blk', 'edit', 'env', 'chat', 'summon', 'pdata', 'bye'];
  VR.MP_TOPICS = TOPICS;
  const unkey = (k) => [Math.floor(k / 65536) - 32768, (k % 65536) - 32768];
  const cleanName = (s) => String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 24);
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  const MAXB64 = 3600; // base64 chars per message part (leaves room for JSON around it)

  class MP {
    constructor(g) {
      this.g = g;
      this.T = null; this.ready = false; this.status = 'connecting'; this.online = [];
      this.role = null;            // 'host' | 'joining' | 'client' | null
      this.room = null; this.session = null; this.hostPeer = null;
      this.remote = new Map();     // peer → avatar
      this.out = new Map();        // colKey → Map(index → state), queued for sending
      this.applying = 0;
      this.modKeys = new Set();    // columns that differ from generation (host: all known; guest: told by host)
      this.reqQ = new Set(); this.requested = new Set();
      this.pending = new Map();    // host: colKey → Map(index → state) for guest edits in columns not loaded here
      this.diffQ = []; this.diffBusy = 0;
      this.lobbyHosts = [];
      this.subs = [];
      this.t = { pres: 0, flush: 0, env: 0, pdata: 0, req: 0, names: 0 };
      this.nameCache = new Map();
      this.sendQ = []; this.sendT = 0;
      if (g.ui && g.ui.renderHosts) { try { g.ui.renderHosts(); } catch (e) { /* title not built yet */ } }
    }
    get isHost() { return this.role === 'host'; }
    get isClient() { return this.role === 'client' || this.role === 'joining'; }
    get active() { return this.role === 'host' || this.role === 'client'; }
    // the name the others see: 'Explorer' until the one-time notice is answered — the claude.ai profile name is never
    // sent before that; afterwards the nickname (settings.playerName), else the profile name
    myName() { return this.noticeOk() ? this.nameIfShown() : 'Explorer'; }
    nameIfShown() { const s = this.g.settings; return cleanName(s.playerName) || cleanName(this.T && this.T.me && this.T.me.name) || 'Explorer'; }
    myPeer() { const p = this.T && this.T.myPeer ? this.T.myPeer() : null; if (p) return p; if (this.room) { const me = this.room.peers().find(q => q.sameTab); if (me) return me.peer; } return this.peerFallback || null; }

    // ---------------------------------------------------------------- 👥 privacy by default
    // Until the player answers the one-time notice („👥 Mitspieler sehen deinen Namen: X — ✓ OK · ✎ Spitzname ·
    // Mehrspieler aus“; src/main/legal.js shows it as a card) the lobby sees the name „Explorer“ and no profile name.
    // „Mehrspieler aus“ = no presence at all, and from the next start no connection ('r9si.mp' = 'off'; Settings →
    // Game turns it back on). „Friends can join my worlds“ off = no presence at all.
    noticeOk() { if (this.noticeMem) return true; try { return localStorage.getItem(NOTICE) === '1'; } catch (e) { return false; } }
    confirmNotice() {
      this.noticeMem = true;
      try { localStorage.setItem(NOTICE, '1'); } catch (e) { /* this page only */ }
      this.setLobby(); this.syncNotice();
      const g = this.g;
      if (g.state === 'play' && g.meta && !g.meta.guest) this.startHosting();
    }
    syncNotice() { if (VR.Legal && VR.Legal.syncNotice) VR.Legal.syncNotice(this.g); }
    turnOff() {
      try { localStorage.setItem('r9si.mp', 'off'); if (localStorage.getItem(NOTICE) !== '1') localStorage.setItem(NOTICE, 'off'); } catch (e) { /* this page only */ }   // (a confirmed answer is never overwritten: the notice is once per browser)
      const g = this.g, T = this.T, guest = this.isClient;
      this.ready = false; this.status = 'off';        // (from here setLobby sends nothing)
      if (this.role === 'host') this.stopHosting(); else if (this.role) this.leave();
      if (T && T.lobby) T.lobby.presence({ v: null, n: null, host: null, pl: null, role: null, ss: null }).catch(() => { });
      if (this.lobbyUnsub) { try { this.lobbyUnsub(); } catch (e) { /* gone */ } this.lobbyUnsub = null; }
      this.T = null; this.online = []; this.lobbyHosts = []; this.lobbyOn = false;
      this.syncNotice();
      if (guest && g.meta && g.meta.guest && (g.state === 'play' || g.state === 'loading')) g.leaveGuestWorld();
    }
    turnOn() {
      try { if (localStorage.getItem('r9si.mp') === 'off') localStorage.removeItem('r9si.mp'); } catch (e) { /* */ }
      if (this.ready || this.status === 'connecting') return Promise.resolve();
      this.status = 'connecting';
      return this.init();
    }

    // ---------------------------------------------------------------- start-up & lobby
    async init() {
      try { this.T = await VR.Net.open(); } catch (e) { this.T = null; }
      if (!this.T) { this.status = VR.Net.isOff && VR.Net.isOff() ? 'off' : 'unavailable'; if (this.g.ui && this.g.ui.renderHosts) this.g.ui.renderHosts(); return; }
      if (this.status === 'off') { this.T = null; return; }   // switched off while connecting
      this.ready = true; this.status = 'ready';
      const L = this.T.lobby;
      this.lobbyUnsub = L.onPeers((ch) => this.lobbyChanged(ch.peers), () => { });
      this.setLobby();
      this.syncNotice();
      if (this.g.ui && this.g.ui.renderHosts) this.g.ui.renderHosts();
    }
    setLobby() {
      if (!this.ready) return;
      const g = this.g;
      // 👥 „Friends can join my worlds“ off and no session running: nobody sees you in the lobby, the name included
      if (g.settings.mpHost === false && !this.role) {
        if (this.lobbyOn) { this.lobbyOn = false; this.T.lobby.presence({ v: null, n: null, host: null }).catch(() => { }); }
        return;
      }
      const host = this.role === 'host' && g.meta ? { s: this.session, w: cleanName(g.meta.name) || 'World', m: g.meta.mode, t: Date.now() } : null;
      this.lobbyOn = true;
      this.T.lobby.presence({ v: PROTO, n: this.myName(), host }).catch(() => { });
    }
    lobbyChanged(peers) {
      this.lobbyHosts = peers.filter(p => !p.sameTab && p.presence && p.presence.v === PROTO && p.presence.host && p.presence.host.s);
      // everyone else who has the game open right now (on the title screen or in a world)
      this.online = peers.filter(p => !p.sameTab && !p.isMe).map(p => ({ name: cleanName(p.presence && p.presence.n) || 'A friend', hosting: !!(p.presence && p.presence.host), guest: !!p.guest }));
      if (this.g.ui && this.g.ui.renderHosts) this.g.ui.renderHosts();
    }
    hostList() { return this.lobbyHosts.map(p => ({ peer: p.peer, name: cleanName(p.presence.n) || 'A friend', world: cleanName(p.presence.host.w), mode: p.presence.host.m, session: p.presence.host.s, isMe: p.isMe })); }

    // ---------------------------------------------------------------- session plumbing
    subscribe(room) {
      this.unsubscribe();
      const on = (topic, fn) => this.subs.push(room.on(topic, (m) => {
        if (!m || !m.data || typeof m.data !== 'object' || m.data.s !== this.session) return; // another session's traffic
        try { fn(m); } catch (e) { console.warn('mp ' + topic, e); }
      }, (e) => this.roomError(e)));
      on('hello', (m) => this.onHello(m));
      on('welcome', (m) => this.onWelcome(m));
      on('mods', (m) => this.onMods(m));
      on('req', (m) => this.onReq(m));
      on('diff', (m) => this.onDiff(m));
      on('blk', (m) => this.onBlk(m));
      on('edit', (m) => this.onEdit(m));
      on('env', (m) => this.onEnv(m));
      on('chat', (m) => this.onChat(m));
      on('summon', (m) => this.onSummon(m));
      on('pdata', (m) => this.onPdata(m));
      on('bye', (m) => this.onBye(m));
      this.subs.push(room.onPeers((ch) => this.peersChanged(ch), () => { }));
    }
    unsubscribe() { for (const u of this.subs) { try { u(); } catch (e) { /* ignore */ } } this.subs = []; }
    roomError(e) { if (this.g.ui) this.g.ui.chatLine(T('g.mp.lost', { code: e && e.code || 'error' }), '#ff8a8a'); }
    // messages go out through a small queue so bursts never exceed the platform's budget
    send(topic, data) {
      if (!this.room) return;
      this.sendQ.push([topic, Object.assign({ s: this.session }, data)]);
    }
    emitNow(topic, data) { if (this.room) this.room.emit(topic, Object.assign({ s: this.session }, data)).catch(() => { }); }
    // the room a session runs in
    sessionRoom() { return this.T.lobby; }
    leaveRoom(room) {
      if (!room) return;
      if (room === this.T.lobby) room.presence({ pl: null, role: null, ss: null }).catch(() => { });
      else room.leave();
    }
    pumpSend(dt) {
      this.sendT = Math.min(12, this.sendT + dt * 24);   // ≈ 24 messages a second, bursts of 12
      while (this.sendQ.length && this.sendT >= 1 && this.room) {
        const [topic, data] = this.sendQ.shift(); this.sendT -= 1;
        this.room.emit(topic, data).catch((e) => {
          if (e && e.code === 'not_permitted' && !this.warnedPerm) { this.warnedPerm = true; this.g.ui.chatLine(T('g.mp.notPermitted'), '#ffb86a'); }
        });
      }
    }

    // ---------------------------------------------------------------- hosting
    async startHosting() {
      const g = this.g;
      if (!this.ready || this.role || !g.meta || g.meta.guest || g.settings.mpHost === false) return;
      if (g.dim !== 'overworld' && g.dim !== 'flat') return;
      const sess = ('w-' + String(g.meta.id).toLowerCase().replace(/[^a-z0-9]/g, '')).slice(0, 40);
      const room = this.sessionRoom();
      if (!room || g.state !== 'play' || !g.world || g.meta.guest) return;
      this.role = 'host'; this.room = room; this.session = sess;
      // everything that differs from generation: saved columns + live changes + guests' pending edits
      for (const k of g.world.savedKeys) this.modKeys.add(k);
      for (const c of g.world.cols.values()) if (c.modified) this.modKeys.add(c.key);
      const np = g.meta.netPending || {};
      for (const k in np) { const m = new Map(); const a = np[k]; for (let i = 0; i < a.length; i += 2) m.set(a[i], a[i + 1]); this.pending.set(+k, m); this.modKeys.add(+k); }
      this.subscribe(room);
      this.setLobby();
      this.publish(true);
    }
    stopHosting() {
      if (this.role !== 'host') return;
      this.flush(true);
      this.emitNow('bye', { host: true });
      this.savePending();
      this.clearSession();
    }
    clearSession() {
      this.unsubscribe();
      clearTimeout(this.hostGone); this.hostGone = null;
      // what is still queued goes out now (up to a burst), then the room is left
      if (this.room) { for (const [topic, data] of this.sendQ.splice(0, 30)) this.room.emit(topic, data).catch(() => { }); this.leaveRoom(this.room); }
      this.role = null; this.room = null; this.session = null; this.hostPeer = null;
      for (const a of this.remote.values()) if (a.tag) a.tag.remove();
      this.remote.clear(); this.out.clear(); this.modKeys.clear(); this.reqQ.clear(); this.requested.clear(); this.pending.clear(); this.diffQ = []; this.sendQ = [];
      this.setLobby();
    }
    savePending() {
      const g = this.g; if (!g.meta || g.meta.guest) return;
      const o = {};
      for (const [k, m] of this.pending) { const a = []; for (const [i, s] of m) a.push(i, s); if (a.length) o[k] = a; }
      g.meta.netPending = o;
    }
    onHello(m) {
      if (this.role !== 'host' || m.sameTab) return;
      const g = this.g, d = m.data || {}, p = g.player;
      if (d.v !== PROTO) { this.send('welcome', { to: m.peer, err: 'version' }); return; }
      const meta = g.meta, key = m.by || ('n:' + cleanName(d.n));
      const saved = meta.guests && meta.guests[key] ? meta.guests[key] : null;
      this.send('welcome', {
        to: m.peer, v: PROTO,
        w: { id: meta.id, name: cleanName(meta.name), seed: meta.seed, type: meta.type, mode: meta.mode, difficulty: meta.difficulty, cheats: !!meta.cheats, keep: !!meta.keep, vgen: meta.vgen || 1 },
        time: Math.round(g.env.ticks), day: g.env.day || 0, rain: g.env.rainTarget || 0, th: g.env.thunder || 0, wx: g.env.wx.forced || '',
        spawn: [Math.round(p.pos[0] * 100) / 100, Math.round(p.pos[1] * 100) / 100, Math.round(p.pos[2] * 100) / 100, Math.round(p.yaw * 1000) / 1000, p.flying ? 1 : 0],
        home: meta.worldSpawn || null, host: this.myName(), look: g.settings.look === 'seamless' ? 'seamless' : 'classic',   // the host's block look wins
        // the world's style as multiplayer allows it: everyone sees the same buildings, furniture and trees
        style: (() => { const st = VR.WorldStyle ? VR.WorldStyle.effective(VR.WorldStyle.load(meta.id), true) : null; return st ? { sv: st.sv, rules: st.rules, water: null, mp: true } : null; })(),
      });
      if (saved) this.send('pdata', { to: m.peer, p: saved });
      // the list of changed columns, in parts
      const keys = [...this.modKeys];
      const per = Math.floor(MAXB64 / 4 * 3 / 8);
      for (let i = 0; i < keys.length || i === 0; i += per) {
        const part = keys.slice(i, i + per), a = new Int32Array(part.length * 2);
        part.forEach((k, j) => { const [cx, cz] = unkey(k); a[j * 2] = cx; a[j * 2 + 1] = cz; });
        this.send('mods', { to: m.peer, k: VR.Net.b64(new Uint8Array(a.buffer)), last: i + per >= keys.length });
        if (!keys.length) break;
      }
      this.send('env', this.envData());
    }
    // lk: the host's block look rides along, so a switch reaches the guests within a few seconds (older guests ignore it)
    // wx: the weather the host forced with /wetter ('' = the world's schedule, which every guest works out itself)
    envData() { const e = this.g.env; return { t: Math.round(e.ticks), d: e.day || 0, r: e.rainTarget || 0, th: e.thunder || 0, wx: e.wx.forced || '', lk: this.g.settings.look === 'seamless' ? 's' : 'c' }; }
    onPdata(m) {
      const g = this.g, d = m.data || {};
      if (this.role === 'host') {
        if (m.sameTab || !d.p || typeof d.p !== 'object') return;
        const meta = g.meta; if (!meta.guests) meta.guests = {};
        const key = m.by || ('n:' + cleanName(this.remote.get(m.peer) && this.remote.get(m.peer).name));
        meta.guests[key] = this.sanePlayer(d.p);
        return;
      }
      // guest: my saved things from the host's world
      if (d.to !== this.myPeer() || !g.player || !d.p) return;
      const P = this.sanePlayer(d.p);
      try { if (P.inv) g.player.inv.load(P.inv); ['health', 'food', 'sat', 'xp', 'level'].forEach(k => { if (typeof P[k] === 'number') g.player[k] = P[k]; }); if (P.spawn) g.player.spawn = P.spawn; g.player.inv.changed = true; g.ui.updateHUD(true); } catch (e) { console.warn(e); }
    }
    sanePlayer(p) {
      const o = {};
      if (p.inv && typeof p.inv === 'object') o.inv = p.inv;
      for (const k of ['health', 'food', 'sat', 'xp', 'level']) if (typeof p[k] === 'number' && isFinite(p[k])) o[k] = p[k];
      if (Array.isArray(p.spawn) && p.spawn.length === 3 && p.spawn.every(v => typeof v === 'number' && isFinite(v))) o.spawn = p.spawn;
      return o;
    }
    // a guest asks for the changes in some columns
    onReq(m) {
      if (this.role !== 'host' || m.sameTab) return;
      const u8 = VR.Net.unb64(m.data && m.data.k), a = new Int32Array(u8.buffer, 0, u8.length >> 2);
      for (let i = 0; i + 1 < a.length; i += 2) this.diffQ.push([m.peer, a[i], a[i + 1]]);
      if (this.diffQ.length > 4000) this.diffQ.splice(0, this.diffQ.length - 4000);
    }
    pumpDiffs() {
      while (this.diffBusy < 3 && this.diffQ.length && this.sendQ.length < 40) {
        const [peer, cx, cz] = this.diffQ.shift();
        this.diffBusy++;
        this.columnDiff(cx, cz).then((pairs) => {
          this.diffBusy--;
          if (!pairs || this.role !== 'host') return;
          this.sendDiff(peer, cx, cz, pairs);
        }).catch(() => { this.diffBusy--; });
      }
    }
    sendDiff(peer, cx, cz, pairs) {
      const per = Math.floor(MAXB64 * 3 / 32) * 2; // numbers per part (2 per edit, 4 bytes each)
      if (!pairs.length) { this.send('diff', { to: peer, c: [cx, cz, ''], n: 0 }); return; }
      for (let i = 0; i < pairs.length; i += per) {
        const a32 = new Int32Array(pairs.slice(i, i + per));
        this.send('diff', { to: peer, c: [cx, cz, VR.Net.b64(new Uint8Array(a32.buffer))], part: i > 0 ? 1 : 0 });
      }
    }
    // the column as it is here vs. as the generator makes it
    async columnDiff(cx, cz) {
      const g = this.g, w = g.world, k = VR.ckey(cx, cz);
      if (!w) return null;
      let cur = null;
      const c = w.cols.get(k);
      if (c && c.ready) cur = null; // read at the end (freshest)
      else if (w.savedKeys.has(k) && w.store) {
        try { cur = await w.store.loadColumn(w.dim, cx, cz); } catch (e) { cur = null; }
        // saved under other style rules: bring it up to the current ones first (only player edits are real differences)
        const sv = g.style ? g.style.sv : 0;
        if (cur && (cur.sv || 0) !== sv) cur = await new Promise((res) => { const b = cur; g.pool.submit({ type: 'relight', dim: w.dim, cx, cz, blocks: b, sv: b.sv || 0 }, [b.buffer], (msg) => res(msg && msg.type === 'gen' ? msg.blocks : null), 40); g.pool.queueDirty = true; });
      }
      const pristine = await new Promise((res) => { g.pool.submit({ type: 'gen', dim: w.dim, cx, cz }, null, (msg) => res(msg && msg.type === 'gen' ? msg.blocks : null), 40); g.pool.queueDirty = true; });
      if (!pristine || !this.g.world) return null;
      const c2 = w.cols.get(k);
      if (c2 && c2.ready) cur = c2.blocks;
      const out = [];
      if (cur) for (let i = 0; i < cur.length; i++) if (cur[i] !== (i < pristine.length ? pristine[i] : 0)) out.push(i, cur[i]);
      const pend = this.pending.get(k);
      if (pend && !(c2 && c2.ready)) for (const [i, s] of pend) out.push(i, s);
      return out;
    }

    // ---------------------------------------------------------------- joining
    async join(host) {
      const g = this.g;
      if (!this.ready || this.role) return false;
      g.ui.loading('Joining ' + host.name + '…', 0.05);
      const room = this.sessionRoom();
      if (!room) { g.ui.show('title'); g.ui.titleNote && g.ui.titleNote('Could not reach ' + host.name); return false; }
      this.role = 'joining'; this.room = room; this.session = host.session; this.hostPeer = host.peer;
      if (!this.myPeer()) { const me = room.peers().find(q => q.sameTab); if (me) this.peerFallback = me.peer; }
      this.subscribe(room);
      this.send('hello', { v: PROTO, n: this.myName() });
      this.joinTimer = setTimeout(() => { if (this.role === 'joining') { this.leave(); g.ui.show('title'); g.ui.titleNote && g.ui.titleNote(host.name + ' did not answer. Are they still in their world?'); } }, 15000);
      return true;
    }
    onWelcome(m) {
      const d = m.data || {};
      if (this.role !== 'joining' || d.to !== this.myPeer()) return;
      clearTimeout(this.joinTimer);
      if (d.err) { this.leave(); this.g.ui.show('title'); this.g.ui.titleNote && this.g.ui.titleNote(d.err === 'version' ? 'Your friend is on a different game version — both reload the page.' : 'Could not join.'); return; }
      this.hostPeer = m.peer;
      this.role = 'client';
      this.hostName = cleanName(d.host) || 'Host';
      this.g.startGuestWorld(d, this);
    }
    onMods(m) {
      const d = m.data || {};
      if (!this.isClient || d.to !== this.myPeer()) return;
      const u8 = VR.Net.unb64(d.k), a = new Int32Array(u8.buffer, 0, u8.length >> 2);
      for (let i = 0; i + 1 < a.length; i += 2) this.modKeys.add(VR.ckey(a[i], a[i + 1]));
      // columns already loaded before the list arrived
      if (this.g.world) for (const c of this.g.world.cols.values()) if (c.ready && this.modKeys.has(c.key) && !this.requested.has(c.key)) this.reqQ.add(c.key);
    }
    onDiff(m) {
      const d = m.data || {};
      if (this.role !== 'client' || d.to !== this.myPeer() || !Array.isArray(d.c)) return;
      this.applyCol(d.c[0], d.c[1], d.c[2]);
    }
    leave() {
      clearTimeout(this.joinTimer);
      if (this.role === 'client' || this.role === 'joining') {
        this.sendPdata(true);
        this.flush(true);
        this.emitNow('bye', {});
      }
      this.clearSession();
    }
    sendPdata(force) {
      const g = this.g; if (this.role !== 'client' || !g.player) return;
      const p = g.player.toJSON();
      const data = { p: { inv: p.inv, health: p.health, food: p.food, sat: p.sat, xp: p.xp, level: p.level, spawn: p.spawn } };
      if (JSON.stringify(data).length > 3900) data.p.inv = { slots: (p.inv.slots || []).slice(0, 36) };
      if (force) this.emitNow('pdata', data); else this.send('pdata', data);
    }

    // ---------------------------------------------------------------- live block changes
    // world listener (host: broadcast every change; guest: send own changes to the host)
    onBlockChanged(x, y, z, old, s) {
      if (!this.active || this.applying) return;
      const k = VR.ckey(x >> 4, z >> 4);
      let m = this.out.get(k); if (!m) { m = new Map(); this.out.set(k, m); }
      m.set((y << 8) | ((z & 15) << 4) | (x & 15), s);
      if (this.role === 'host') this.modKeys.add(k);
    }
    onColumnLoaded(c) {
      if (this.role === 'client') { if (this.modKeys.has(c.key) && !this.requested.has(c.key)) this.reqQ.add(c.key); return; }
      if (this.role === 'host' || (this.g.meta && !this.g.meta.guest)) {
        // guests' edits waiting for this column
        const pend = this.pending.get(c.key);
        if (pend) {
          this.pending.delete(c.key);
          const x0 = c.cx * 16, z0 = c.cz * 16, w = this.g.world;
          for (const [i, s] of pend) w.setBlock(x0 + (i & 15), i >> 8, z0 + ((i >> 4) & 15), s, 0);
        }
      }
    }
    onColumnUnloaded(c) { if (this.role === 'client') { this.requested.delete(c.key); this.reqQ.delete(c.key); } }
    flush(all) {
      if (!this.out.size || !this.room) return;
      const topic = this.role === 'host' ? 'blk' : 'edit';
      let parts = [], size = 0;
      const emitNow = () => { if (parts.length) { if (all) this.emitNow(topic, { c: parts }); else this.send(topic, { c: parts }); parts = []; size = 0; } };
      for (const [k, m] of this.out) {
        const [cx, cz] = unkey(k);
        const pairs = []; for (const [i, s] of m) pairs.push(i, s);
        const per = Math.floor(MAXB64 * 3 / 32) * 2;
        for (let i = 0; i < pairs.length; i += per) {
          const b = VR.Net.b64(new Uint8Array(new Int32Array(pairs.slice(i, i + per)).buffer));
          if (size + b.length > MAXB64) emitNow();
          parts.push([cx, cz, b]); size += b.length + 24;
        }
      }
      emitNow();
      this.out.clear();
    }
    // apply one column's packed changes (from the host)
    applyCol(cx, cz, b64) {
      const g = this.g, w = g.world; if (!w || typeof cx !== 'number' || typeof cz !== 'number') return;
      const k = VR.ckey(cx, cz);
      const c = w.col(cx, cz);
      if (!c) { this.modKeys.add(k); this.requested.delete(k); return; }
      this.requested.add(k);
      if (!b64) return;
      const u8 = VR.Net.unb64(b64), a = new Int32Array(u8.buffer, 0, u8.length >> 2);
      const nStates = R.T.type.length, x0 = cx * 16, z0 = cz * 16;
      this.applying++;
      try {
        for (let i = 0; i + 1 < a.length; i += 2) {
          const idx = a[i], s = a[i + 1];
          if (s >= nStates) continue;
          w.setBlock(x0 + (idx & 15), idx >> 8, z0 + ((idx >> 4) & 15), s, 0);
        }
      } finally { this.applying--; }
    }
    onBlk(m) {
      if (this.role !== 'client' || m.sameTab || m.peer !== this.hostPeer) return;
      const c = m.data && m.data.c; if (!Array.isArray(c)) return;
      for (const part of c) if (Array.isArray(part)) this.applyColLive(part[0], part[1], part[2]);
    }
    applyColLive(cx, cz, b64) {
      const w = this.g.world; if (!w) return;
      const k = VR.ckey(cx, cz);
      this.modKeys.add(k);
      if (!w.col(cx, cz)) { this.requested.delete(k); return; } // will ask for the whole diff when it loads
      this.applyCol(cx, cz, b64);
    }
    // a guest's changes, applied here (loaded) or kept for later (not loaded)
    onEdit(m) {
      if (this.role !== 'host' || m.sameTab) return;
      const c = m.data && m.data.c; if (!Array.isArray(c)) return;
      const g = this.g, w = g.world, nStates = R.T.type.length;
      for (const part of c) {
        if (!Array.isArray(part)) continue;
        const cx = part[0], cz = part[1]; if (typeof cx !== 'number' || typeof cz !== 'number') continue;
        const u8 = VR.Net.unb64(part[2]), a = new Int32Array(u8.buffer, 0, u8.length >> 2);
        const k = VR.ckey(cx, cz), col = w.col(cx, cz);
        if (col) {
          for (let i = 0; i + 1 < a.length; i += 2) { const idx = a[i], s = a[i + 1]; if (s < nStates) w.setBlock(cx * 16 + (idx & 15), idx >> 8, cz * 16 + ((idx >> 4) & 15), s, 0); }
        } else {
          let pm = this.pending.get(k); if (!pm) { pm = new Map(); this.pending.set(k, pm); }
          let o = this.out.get(k); if (!o) { o = new Map(); this.out.set(k, o); }
          for (let i = 0; i + 1 < a.length; i += 2) { if (a[i + 1] < nStates) { pm.set(a[i], a[i + 1]); o.set(a[i], a[i + 1]); } }
          this.modKeys.add(k);
        }
      }
    }

    // ---------------------------------------------------------------- time, weather, chat, summon
    onEnv(m) {
      if (this.role !== 'client' || m.peer !== this.hostPeer) return;
      const d = m.data || {}, e = this.g.env;
      const t = num(d.t, e.ticks);
      if (Math.abs(t - e.ticks) > 120) e.ticks = t; else e.ticks += (t - e.ticks) * 0.5;
      e.day = num(d.d, e.day);
      e.wx.force(VR.WX && VR.WX.KINDS.includes(d.wx) ? d.wx : null);   // the schedule itself is the same on every machine
      const lk = d.lk === 's' ? 'seamless' : d.lk === 'c' ? 'classic' : null;
      if (lk && lk !== this.g.hostLook) { this.g.hostLook = lk; this.g.applyLook(); }   // the host switched the block look
    }
    chat(text) {
      const t = String(text).slice(0, 200);
      this.g.ui.chatLine('<' + this.myName() + '> ' + t, '#e8f4ff');
      this.send('chat', { t });
    }
    onChat(m) {
      if (m.sameTab) return;
      const t = String((m.data && m.data.t) || '').replace(/[\u0000-\u001f]/g, ' ').slice(0, 200);
      if (!t) return;
      const a = this.remote.get(m.peer);
      this.g.ui.chatLine('<' + (a ? a.name : T('g.talk.friend')) + '> ' + t, '#ffe9a8');
    }
    summon(peer) {
      const p = this.g.player; if (!p || this.role !== 'host') return;
      this.send('summon', { to: peer, p: [Math.round(p.pos[0] * 100) / 100, Math.round(p.pos[1] * 100) / 100, Math.round(p.pos[2] * 100) / 100], f: p.flying ? 1 : 0 });
      const a = this.remote.get(peer);
      this.g.ui.chatLine(T('g.mp.called', { name: a ? a.name : T('g.mp.friend') }), '#9affd8');
    }
    onSummon(m) {
      const d = m.data || {};
      if (this.role !== 'client' || d.to !== this.myPeer() || m.peer !== this.hostPeer || !Array.isArray(d.p)) return;
      const [x, y, z] = d.p.map(v => num(v, 0));
      this.g.player.safeTeleport(x + 1.2, y, z + 0.6, { fly: d.f && this.g.player.creative });
      this.g.ui.chatLine(T('g.mp.calledYou', { name: this.hostName }), '#9affd8');
    }
    teleportToHost() {
      const h = this.hostPeer && this.remote.get(this.hostPeer);
      if (!h || !h.has) { this.g.ui.chatLine(T('g.mp.noHost'), '#ff8a8a'); return; }
      this.g.player.safeTeleport(h.tp[0] + 1.2, h.tp[1], h.tp[2] + 0.6, { fly: h.fly && this.g.player.creative });
      this.g.ui.chatLine(T('g.mp.teleported', { name: h.name }), '#9affd8');
    }
    teleportTo(peer) {
      const h = this.remote.get(peer); if (!h || !h.has) return;
      this.g.player.safeTeleport(h.tp[0] + 1.2, h.tp[1], h.tp[2] + 0.6, { fly: h.fly && this.g.player.creative });
    }
    onBye(m) {
      if (m.sameTab) return;
      const a = this.remote.get(m.peer);
      if (this.isClient && m.peer === this.hostPeer) {
        this.clearSession();
        const g = this.g;
        g.ui.chatLine(T('g.mp.hostClosed'), '#ffb86a');
        if (g.state === 'play' || g.state === 'loading') g.leaveGuestWorld('The host closed the world.');
        return;
      }
      if (a && this.role === 'host') g_say(this.g, T('g.mp.leftWorld', { name: a.name }));
    }

    // ---------------------------------------------------------------- players you see
    peersChanged(ch) {
      const g = this.g;
      if (!this.session) return;
      const inSess = (p) => !!(p && !p.sameTab && p.presence && p.presence.ss === this.session && p.presence.pl && Array.isArray(p.presence.pl.p));
      const byPeer = new Map(); for (const p of ch.peers) byPeer.set(p.peer, p);
      // the host dropping out (closed the page or left the world): give the connection a few seconds to come back
      if (this.role === 'client' && !inSess(byPeer.get(this.hostPeer)) && !this.hostGone) {
        this.hostGone = setTimeout(() => {
          this.hostGone = null;
          const back = this.room && this.room.peers().some(q => q.peer === this.hostPeer && q.presence && q.presence.ss === this.session);
          if (back || !this.isClient) return;
          this.clearSession();
          if (g.state === 'play' || g.state === 'loading') g.leaveGuestWorld('Lost the connection to the host.');
        }, 6000);
      }
      // everyone who left the page or this world
      for (const [peer, a] of this.remote) {
        if (inSess(byPeer.get(peer))) continue;
        if (peer === this.hostPeer && this.role === 'client') continue; // handled by the grace timer
        if (a.tag) a.tag.remove(); this.remote.delete(peer);
        if (a.name && g.ui) g.ui.chatLine(T('g.mp.left', { name: a.name }), '#cfd8e6');
      }
      for (const p of ch.peers) {
        if (!inSess(p)) continue;
        const pl = p.presence.pl;
        let a = this.remote.get(p.peer);
        if (!a) {
          a = { peer: p.peer, by: p.by, name: cleanName(pl.n) || 'Friend', has: false, pos: [0, 0, 0], tp: [0, 0, 0], yaw: 0, pitch: 0, walk: 0, walkAmt: 0, swing: 0, tag: null, seed: 0, look: null };
          this.remote.set(p.peer, a);
          if (g.ui && this.active) g.ui.chatLine(T('g.mp.joinedWorld', { name: cleanName(pl.n) || T('g.mp.aFriend') }), '#9affd8');
          if (g.audio) g.audio.play('toast');
        }
        a.name = cleanName(pl.n) || a.name;
        a.tp = [num(pl.p[0], 0), num(pl.p[1], 0), num(pl.p[2], 0)];
        if (!a.has) { a.pos = a.tp.slice(); a.has = true; }
        a.tyaw = num(pl.r && pl.r[0], 0); a.tpitch = num(pl.r && pl.r[1], 0);
        a.fly = !!(pl.f & 1); a.sneak = !!(pl.f & 2); a.swingOn = !!(pl.f & 4); a.dead = !!(pl.f & 8);
        a.held = typeof pl.h === 'string' ? pl.h.slice(0, 40) : null;
        a.mode = pl.m; a.hp = num(pl.hp, 20); a.host = p.presence.role === 'host';
        a.veh = pl.v && typeof pl.v === 'object' ? pl.v : null;
        const lk = Array.isArray(pl.lk) && pl.lk.length >= 4 && pl.lk.every(v => typeof v === 'number') ? pl.lk.join(',') : null;
        if (lk !== a.lk) { a.lk = lk; a.look = null; }
        a.seen = performance.now();
      }
    }
    publish(force) {
      const g = this.g, p = g.player; if (!this.room || !p) return;
      const S = g.starships && g.starships.pilot;
      const veh = S && S.d && S.d.meta ? { s: S.d.seed, a: S.d.arch || null, pa: S.d.palette || null, y: Math.round(S.yaw * 1000) / 1000, pi: Math.round((S.pitch || 0) * 1000) / 1000, ro: Math.round((S.roll || 0) * 1000) / 1000, p: S.pos.map(v => Math.round(v * 100) / 100) } : null;
      const pl = {
        n: this.myName(),
        p: [Math.round(p.pos[0] * 100) / 100, Math.round(p.pos[1] * 100) / 100, Math.round(p.pos[2] * 100) / 100],
        r: [Math.round(p.yaw * 1000) / 1000, Math.round(p.pitch * 1000) / 1000],
        f: (p.flying ? 1 : 0) | (p.sneaking ? 2 : 0) | (p.handSwing > 0 ? 4 : 0) | (p.dead ? 8 : 0),
        h: p.inv && p.inv.held ? p.inv.held.id : null, m: p.mode, hp: Math.round(p.health), v: veh,
        lk: (() => { const o = g.heroOpts ? g.heroOpts() : null; return o ? [o.suit | 0, o.hair | 0, o.hs | 0, o.skin | 0, o.lashes ? 1 : 0] : null; })(),
      };
      const s = JSON.stringify(pl);
      if (!force && s === this.lastPres) return;
      this.lastPres = s;
      this.room.presence({ pl, role: this.role === 'host' ? 'host' : 'guest', ss: this.session }).catch(() => { });
    }

    // ---------------------------------------------------------------- per frame
    update(dt) {
      if (!this.room) return;
      const T = this.t;
      T.pres -= dt; if (T.pres <= 0) { T.pres = 0.1; this.publish(); }
      T.flush -= dt; if (T.flush <= 0) { T.flush = 0.1; this.flush(); }
      if (this.role === 'host') {
        T.env -= dt; if (T.env <= 0) { T.env = 3; this.send('env', this.envData()); }
        // friends came or all left: the world's style switches between the multiplayer version and the full one
        const withFriends = this.remote.size > 0;
        if (withFriends !== !!this.styleMP) { this.styleMP = withFriends; if (this.g.applyStyle) this.g.applyStyle(); }
        this.pumpDiffs();
      } else if (this.role === 'client') {
        T.req -= dt;
        if (T.req <= 0 && this.reqQ.size) {
          T.req = 0.3;
          const keys = [...this.reqQ].slice(0, 400); for (const k of keys) { this.reqQ.delete(k); this.requested.add(k); }
          const a = new Int32Array(keys.length * 2); keys.forEach((k, i) => { const [cx, cz] = unkey(k); a[i * 2] = cx; a[i * 2 + 1] = cz; });
          this.send('req', { k: VR.Net.b64(new Uint8Array(a.buffer)) });
        }
        T.pdata -= dt; if (T.pdata <= 0) { T.pdata = 20; this.sendPdata(); }
      }
      this.pumpSend(dt);
      // smooth the others' movement
      const k = 1 - Math.exp(-dt * 12);
      for (const a of this.remote.values()) {
        if (!a.has) continue;
        const ox = a.pos[0], oz = a.pos[2];
        for (let i = 0; i < 3; i++) a.pos[i] += (a.tp[i] - a.pos[i]) * k;
        if (Math.hypot(a.tp[0] - a.pos[0], a.tp[1] - a.pos[1], a.tp[2] - a.pos[2]) > 24) a.pos = a.tp.slice();
        let dy = a.tyaw - a.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
        a.yaw += dy * k; a.pitch += (a.tpitch - a.pitch) * k;
        const sp = Math.hypot(a.pos[0] - ox, a.pos[2] - oz) / Math.max(dt, 1e-3);
        a.walk += sp * dt * 2.3; a.walkAmt += ((sp > 0.4 && !a.fly ? 1 : 0) - a.walkAmt) * Math.min(1, dt * 6);
        a.swing = a.swingOn ? Math.min(1, a.swing + dt * 6) : Math.max(0, a.swing - dt * 4);
      }
      this.updateTags();
    }
    // ---------------------------------------------------------------- drawing
    draw(r, E, cam) {
      if (!this.remote.size) return;
      const g = this.g, gl = r.gl, ent = g.entities, Folk = VR.Folk;
      if (!ent || !Folk) return;
      const p = ent.beginVox(r, E);
      const t = g.time;
      for (const a of this.remote.values()) {
        if (!a.has || a.dead || a.veh) continue;
        const dx = a.pos[0] - cam.x, dz = a.pos[2] - cam.z;
        const d2 = dx * dx + dz * dz; if (d2 > 160 * 160) continue;
        if (!VR.mat4.boxInFrustum(r.planes, dx - 2, a.pos[1] - cam.y - 1, dz - 2, dx + 2, a.pos[1] - cam.y + 3, dz + 2)) continue;
        const tool = Folk.isBlaster && Folk.isBlaster(a.held) ? 'blaster' : null;
        if (!a.look || a.lookTool !== tool) {
          a.lookTool = tool;
          if (a.lk && Folk.heroLook) { const v = a.lk.split(',').map(Number); a.look = Folk.heroLook({ suit: v[0], hair: v[1], hs: v[2], skin: v[3], lashes: !!v[4], tool }); }
          else { let h = 2166136261; for (const ch of (a.by || a.name)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } a.seed = h >>> 0; a.look = Folk.heroLook ? Folk.heroLook(Object.assign(Folk.randomHero(a.seed), { tool })) : Folk.look(a.seed, 'pilot', 'adult'); }
        }
        const model = Folk.model(gl, a.look, d2 > 24 * 24); if (!model) continue;
        const light = ent.lightAt(a.pos[0], a.pos[1] + 1.2, a.pos[2]);
        const pose = Folk.heroPose ? Folk.heroPose({ walk: a.walk, walkAmt: a.walkAmt, swing: a.swing, pitch: a.pitch, fly: a.fly, sneak: a.sneak, aim: tool === 'blaster' }) : this.pose(a, t);
        ent.drawModel(r, p, model, a.pos, cam, a.yaw, pose, light, { hide: { lids: true, mouth: true } });
      }
    }
    pose(a, t) {
      const wa = a.walkAmt, ph = a.walk * 3, s = Math.sin(ph) * 0.7 * wa;
      const bob = Math.abs(Math.cos(ph)) * wa * 0.9;
      const up = (rx, ry, rz) => [rx || 0, ry || 0, rz || 0, 0, bob, 0];
      const P = VR.FolkAnim ? VR.FolkAnim.walk(ph, wa, false, {}) : { leg_l: [s, 0, 0], leg_r: [-s, 0, 0], arm_l: up(-s * 0.9, 0, -0.07), arm_r: up(s * 0.9, 0, 0.07), body: up() };
      P.head = up(Math.max(-0.6, Math.min(0.6, -a.pitch)), 0, 0);
      if (a.swing > 0) P.arm_r = up(1.2 + Math.sin(a.swing * Math.PI) * 0.9, 0, 0.1);
      if (a.fly) { P.leg_l = [0.15, 0, -0.05]; P.leg_r = [0.1, 0, 0.05]; P.arm_l = up(0.25, 0, -0.3); P.arm_r = up(0.25, 0, 0.3); }
      if (a.sneak) { P.body[0] = 0.35; P.head[0] -= 0.2; }
      void t;
      return P;
    }
    // friends flying starships: their ships, for the starship renderer
    remoteShips() {
      const S = this.g.starships; if (!S || !this.remote.size) return null;
      const out = [];
      for (const a of this.remote.values()) {
        const v = a.veh; if (!a.has || !v) { a.ship = null; continue; }
        const d = S.design(v.s >>> 0, v.a || null, v.pa || null);
        if (!d || !d.meta || !d.gpu) continue;
        if (!a.ship || a.ship.d !== d) a.ship = { d, pos: null, yaw: 0, pitch: 0, roll: 0, vel: [0, 0, 0], gear: 0, state: 'remote', rot: null };
        const sh = a.ship;
        const tp = Array.isArray(v.p) ? [num(v.p[0], a.tp[0]), num(v.p[1], a.tp[1]), num(v.p[2], a.tp[2])] : a.tp;
        if (!sh.pos) sh.pos = tp.slice();
        for (let i = 0; i < 3; i++) sh.pos[i] += (tp[i] - sh.pos[i]) * 0.3;
        let dy = num(v.y, 0) - sh.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
        sh.yaw += dy * 0.3; sh.pitch = num(v.pi, 0); sh.roll = num(v.ro, 0);
        S.rotOf(sh);
        const g = this.g, m = d.meta;
        if (g.trails && m.exhaust) {
          const R3 = sh.rot, now = performance.now();
          if (sh.lastP) { const dtm = Math.max(1, now - sh.lastT) / 1000; const v = Math.hypot(sh.pos[0] - sh.lastP[0], sh.pos[1] - sh.lastP[1], sh.pos[2] - sh.lastP[2]) / dtm; sh.spd = (sh.spd || 0) + (v - (sh.spd || 0)) * 0.1; }
          sh.lastP = sh.pos.slice(); sh.lastT = now;
          const sp = sh.spd || 0;
          for (let ei = 0; ei < m.exhaust.length; ei++) { const e = m.exhaust[ei], l = [e[0], e[1], e[2] + 0.3]; g.trails.engine('mp' + a.peer + ei, [sh.pos[0] + R3[0] * l[0] + R3[4] * l[1] + R3[8] * l[2], sh.pos[1] + R3[1] * l[0] + R3[5] * l[1] + R3[9] * l[2], sh.pos[2] + R3[2] * l[0] + R3[6] * l[1] + R3[10] * l[2]], sp, { thrust: 0.7, size: e[3], col: [0.55, 0.5, 1] }); }
        }
        out.push(sh);
      }
      return out;
    }
    // name tags above the others (DOM, projected each frame)
    updateTags() {
      const g = this.g, r = g.renderer, cam = g.cam;
      if (!r || !cam) return;
      const root = document.getElementById('hud'); if (!root) return;
      for (const a of this.remote.values()) {
        if (!a.tag) { a.tag = document.createElement('div'); a.tag.className = 'mptag'; root.appendChild(a.tag); }
        const show = a.has && !a.dead && g.state === 'play' && !g.hideHud;
        const m = r.viewProj, px = a.pos[0] - cam.x, py = a.pos[1] + (a.veh ? 4.5 : 2.25) - cam.y, pz = a.pos[2] - cam.z;
        const X = m[0] * px + m[4] * py + m[8] * pz + m[12], Y = m[1] * px + m[5] * py + m[9] * pz + m[13], W = m[3] * px + m[7] * py + m[11] * pz + m[15];
        const dist = Math.hypot(px, pz);
        if (!show || W <= 0.1 || dist > 400) { if (a.tag.style.display !== 'none') a.tag.style.display = 'none'; continue; }
        const sx = (X / W * 0.5 + 0.5) * window.innerWidth, sy = (0.5 - Y / W * 0.5) * window.innerHeight;
        a.tag.style.display = 'block';
        a.tag.style.transform = `translate(${Math.round(sx)}px, ${Math.round(sy)}px) translate(-50%, -100%)`;
        const txt = a.name + (dist > 30 ? ' · ' + Math.round(dist) + 'm' : '') + (a.host ? ' ★' : '');
        if (a.tag.textContent !== txt) a.tag.textContent = txt;
      }
    }
    // everyone else in this world, for menus and the minimap
    players() { return [...this.remote.values()].filter(a => a.has).map(a => ({ peer: a.peer, name: a.name, host: a.host, pos: a.pos, dist: this.g.player ? Math.hypot(a.pos[0] - this.g.player.pos[0], a.pos[2] - this.g.player.pos[2]) : 0 })); }
  }
  function g_say(g, text) { if (g.ui) g.ui.chatLine(text, '#cfd8e6'); }
  VR.MP = MP;
})(VR);

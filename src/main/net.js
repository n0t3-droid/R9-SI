// ============================================================================
// Net: the transport under multiplayer. One small interface, several roads:
//
//   · "room"  — the claude.ai page's own realtime rooms (window.claude.use):
//               everyone who has the game's link open is in the lobby; a hosted
//               world is a named room. Messages ≤ 4 KiB, ~40 sends/s per page.
//   · "local" — BroadcastChannel between tabs of the same browser (development
//               and automated tests: ?mp=local).
//
// Both expose the same shape as the platform room:
//   lobby: { emit, on, presence, peers, onPeers, connected, onConnection }
//   join(name) → Promise<named room with the same calls + leave()>
//   me: { id, name, color, peer }
// Everything received is untrusted input from another page.
// ============================================================================
(function (VR) {
  'use strict';

  // ---------------------------------------------------------------- the platform's rooms
  async function openRoom() {
    if (typeof window === 'undefined' || !window.claude || typeof window.claude.use !== 'function') return null;
    let room = null, user = null;
    try { room = await window.claude.use('room'); } catch (e) { room = null; }
    if (!room) return null;
    try { user = await window.claude.use('user'); } catch (e) { user = null; }
    let me = { id: null, name: '', color: '#7ad8ff', isOwner: false, canEdit: false };
    if (user) { try { const v = await user.me(); me = { id: v.id, name: v.name || '', color: v.color || '#7ad8ff', isOwner: !!v.isOwner, canEdit: !!v.canEdit }; } catch (e) { /* keep defaults */ } }
    const T = {
      kind: 'room', lobby: room, me, user,
      join: (name) => room.join(name),
      // our own peer label = the lobby peer marked sameTab
      myPeer: () => { const p = room.peers().find(q => q.sameTab); return p ? p.peer : null; },
      // resolve display names for peers' durable ids
      names: async (ids) => { if (!user || !ids.length) return {}; try { const ps = await user.profiles(ids); const out = {}; for (const id of ids) if (ps[id] && ps[id].name) out[id] = ps[id].name; return out; } catch (e) { return {}; } },
    };
    return T;
  }

  // ---------------------------------------------------------------- BroadcastChannel stand-in
  // mirrors the room API closely enough for development & tests: presence with
  // heartbeats (peers that go quiet leave), emits echo back to the sender.
  function openLocal(tag) {
    if (typeof BroadcastChannel === 'undefined') return null;
    const peerId = 'p' + Math.random().toString(36).slice(2, 10);
    const bus = new BroadcastChannel('r9si-mp-' + (tag || 'dev'));
    const rooms = new Map();
    const mkRoom = (name) => {
      const R = { name, handlers: new Map(), peerFns: [], connFns: [], mine: {}, others: new Map(), left: false };
      const snapshot = () => {
        const arr = [{ peer: peerId, by: 'u_' + peerId, isMe: true, sameTab: true, kind: 'viewer', guest: false, presence: Object.freeze(Object.assign({}, R.mine)), updatedAt: Date.now() }];
        for (const [p, o] of R.others) arr.push({ peer: p, by: 'u_' + p, isMe: false, sameTab: false, kind: 'viewer', guest: false, presence: o.presence, updatedAt: o.t });
        return Object.freeze(arr);
      };
      let snap = snapshot();
      const notify = (joined, left, updated) => { snap = snapshot(); const ch = { peers: snap, joined: joined || [], left: left || [], updated: updated || [] }; for (const f of R.peerFns) { try { f(ch); } catch (e) { console.error(e); } } };
      const post = (o) => { if (!R.left) bus.postMessage(Object.assign({ room: name, from: peerId }, o)); };
      R.api = {
        name,
        emit(topic, data) {
          const s = JSON.stringify(data === undefined ? null : data);
          if (s.length > 4096) return Promise.reject({ code: 'invalid_argument', message: 'data over 4 KiB (' + s.length + ')' });
          post({ k: 'emit', topic, data });
          const msg = { topic, data, peer: peerId, by: 'u_' + peerId, isMe: true, sameTab: true, kind: 'viewer', guest: false };
          setTimeout(() => { const hs = R.handlers.get(topic); if (hs) for (const h of [...hs]) { try { h(msg); } catch (e) { console.error(e); } } }, 0);
          return Promise.resolve();
        },
        on(topic, fn) { let hs = R.handlers.get(topic); if (!hs) { hs = new Set(); R.handlers.set(topic, hs); } hs.add(fn); return () => hs.delete(fn); },
        presence(patch) {
          for (const k in patch) { if (patch[k] === null) delete R.mine[k]; else R.mine[k] = patch[k]; }
          if (JSON.stringify(R.mine).length > 4096) return Promise.reject({ code: 'invalid_argument', message: 'presence over 4 KiB' });
          post({ k: 'pres', presence: R.mine });
          notify([], [], []);
          return Promise.resolve();
        },
        peers() { return snap; },
        onPeers(fn) { R.peerFns.push(fn); setTimeout(() => fn({ peers: snap, joined: snap, left: [], updated: [] }), 0); return () => { const i = R.peerFns.indexOf(fn); if (i >= 0) R.peerFns.splice(i, 1); }; },
        connected() { return !R.left; },
        onConnection(fn) { R.connFns.push(fn); setTimeout(() => fn(!R.left), 0); return () => {}; },
        leave() { post({ k: 'bye' }); R.left = true; rooms.delete(name); return Promise.resolve(); },
      };
      R.onBus = (m) => {
        if (m.from === peerId || R.left) return;
        if (m.k === 'emit') {
          const msg = { topic: m.topic, data: m.data, peer: m.from, by: 'u_' + m.from, isMe: false, sameTab: false, kind: 'viewer', guest: false };
          const hs = R.handlers.get(m.topic); if (hs) for (const h of [...hs]) { try { h(msg); } catch (e) { console.error(e); } }
          return;
        }
        if (m.k === 'pres' || m.k === 'beat') {
          const had = R.others.get(m.from);
          const o = { presence: Object.freeze(Object.assign({}, m.presence || {})), t: had && m.k === 'beat' ? had.t : Date.now(), seen: Date.now() };
          R.others.set(m.from, o);
          if (!had) { notify([snapshot().find(p => p.peer === m.from)], [], []); post({ k: 'beat', presence: R.mine }); }
          else if (m.k === 'pres') notify([], [], [snapshot().find(p => p.peer === m.from)]);
          return;
        }
        if (m.k === 'bye') { if (R.others.has(m.from)) { const p = snapshot().find(q => q.peer === m.from); R.others.delete(m.from); notify([], [p], []); } }
        if (m.k === 'who') post({ k: 'beat', presence: R.mine });
      };
      R.tick = () => {
        post({ k: 'beat', presence: R.mine });
        const now = Date.now();
        for (const [p, o] of R.others) if (now - o.seen > 4000) { const pp = snapshot().find(q => q.peer === p); R.others.delete(p); notify([], [pp], []); }
      };
      rooms.set(name, R);
      post({ k: 'who' });
      return R;
    };
    bus.onmessage = (e) => { const m = e.data; if (!m || !m.room) return; const R = rooms.get(m.room); if (R) R.onBus(m); };
    setInterval(() => { for (const R of rooms.values()) R.tick(); }, 1000);
    window.addEventListener('beforeunload', () => { for (const R of rooms.values()) R.api.leave(); });
    const lobby = mkRoom('lobby').api;
    return {
      kind: 'local', lobby,
      me: { id: 'u_' + peerId, name: '', color: '#7ad8ff', isOwner: true, canEdit: true },
      join: (name) => Promise.resolve((rooms.get(name) || mkRoom(name)).api),
      myPeer: () => peerId,
      names: async () => ({}),
    };
  }

  // ---------------------------------------------------------------- pick a road
  VR.Net = {
    // ?mp=… (development, tests) wins over 'r9si.mp'; 'off' = „Mehrspieler aus": no connection at all
    mode() { let mode = null; try { const q = new URLSearchParams(location.search); mode = q.get('mp'); if (!mode) mode = localStorage.getItem('r9si.mp'); } catch (e) { mode = null; } return mode; },
    isOff() { return VR.Net.mode() === 'off'; },
    async open() {
      const mode = VR.Net.mode();
      if (mode === 'off') return null;
      if (mode && mode.startsWith('local')) return openLocal(mode.slice(6) || 'dev');
      return await openRoom();
    },
    // compact binary helpers: typed arrays ↔ base64 (keeps every message small)
    b64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); },
    unb64(str) { const s = atob(String(str || '')); const u8 = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i); return u8; },
  };
})(VR);

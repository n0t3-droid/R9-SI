// ============================================================================
// r-wunder · VR.WunderGame — the Wundertiere in the game (plan docs/superpowers/plans/2026-11-07-r-wunder.md; the rules in
// src/shared/wunder.js, the models in wunder_models.js). Three rare, large, gentle creatures — peaceful, never hurt:
//   the Himmelswal  where VR.Wunder says (the same for every guest); sings at dusk (our score's Heimat call, a voice of
//                   our own); the flute's answer (1 · 3 · 2) within hearing brings it down beside you; [V] climbs on —
//                   it carries you to the nearest isle (or from an isle back down to the valley), the chase view as the
//                   ferries'; at the end a farewell song and back to its loop. A trail of Flausel light behind it.
//   the Wanderbaum  stands in a meadow by day ([V] sit under it: a lantern seed, once a day), walks at night when no one
//                   is near, never through a village, a ring of blossoms where it stood; nights you were away it went
//                   on its own (caught up when you come back)
//   the Laternenhirsch  a dark night, you stood still 10 s far from the villages: it steps out and walks ahead to the
//                   nearest wonder spot you have not seen (Traumbaum, Glimmglockenring, a landmark); run or come within
//                   3 m and it is gone in a swirl of Flausel; following it to the end names the path
// The flute: learnt from an elder by the water (talking to them); held, keys 1 · 2 · 3 play its notes (the hotbar stays),
// a small prompt with three lights in the song's window. Sightings, the ride, the path, the flute: Chronik deeds (the
// villagers retell them: chronik_game.js' gossip), the Wanderbuch's „Wundertiere" section (the whale's next evening, the
// tree's last place, the paths found), the light field's pools (the lantern seed in your hand, the tree's seeds, the
// stag's antlers). One small Regie lead to the tree once per 2 game days.
// Switch ⚙ Spiel „Wundertiere" (wunder, default on). Cost 🟢: per frame a few dozen lines; drawn Balanced and up as
// VR.WildGPU kinds (≤ 4 instanced draws, the program exists already), Very Low / Low as voxel models (≤ 3 draws; the
// whale a far silhouette). Time frozen (golden's worlds, ⏸): nothing spawns, nothing is drawn.
// Test API: VR.WunderGame.test.
// ============================================================================
(function (VR) {
  'use strict';
  const WU = VR.Wunder; if (!WU || !VR.Game) return;
  const WG = VR.WunderGame = VR.WunderGame || {};
  const T = (k, v) => (VR.I18N ? VR.I18N.t(k, v) : k);
  const TAU = Math.PI * 2;
  const hs = (s) => { s = String(s); let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x | 0; };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const wrapA = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
  const sm = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
  if (VR.Settings && VR.Settings.add && !(VR.Settings.byKey && VR.Settings.byKey('wunder'))) { try { VR.Settings.add({ key: 'wunder', g: 'play', sec: 'play', t: 'switch', lab: 'g.set.wunder', tip: 'g.set.wunder.tip', cost: 'low', def: true }); } catch (e) { /* the settings' own */ } }
  WG.cost = { frames: 0, ms: 0, drawMs: 0, draws: 0 };
  WG.camOn = false;
  const tierOf = (g) => (VR.Wild && VR.Wild.tierOf ? VR.Wild.tierOf(g.settings) : 2);
  WG.on = (g) => !!(g && g.state === 'play' && g.world && g.player && g.env && g.meta && (g.dim || 'overworld') === 'overworld' && g.meta.type !== 'flat' && !(g.settings && g.settings.wunder === false) && !g.zenFreezeTime);
  const ticks = (g) => (g.env.day | 0) * 24000 + g.env.timeOfDay;
  const mem = (g) => { const m = g.meta.wunder || (g.meta.wunder = { v: 1, ev: {}, learned: false, seen: {}, paths: 0, tree: null, seedDay: -1, whaleSeen: -9 }); if (!m.ev) m.ev = {}; if (!m.seen) m.seen = {}; return m; };
  const S = (g) => {
    const key = (g.meta.id || '') + ':' + (g.world && g.world.seed);
    if (!g._wu || g._wu.key !== key) {
      const seed = hs(String(g.meta.seed));
      g._wu = { key, seed, loop: null, age: 0, time: 0, whale: { st: new Float32Array(10), mode: 'route', p: [0, 0, 0], yaw: 0, pitch: 0, bank: 0, ph: 0, vis: 0, t: 0, hover: null, dest: null, glow: 0.3 },
        song: null, songK: -1, sangNote: -1, presses: [], deer: null, still: 0, lastP: null, speed: 0, deerT: 0, spots: [], spotsT: -99, treeT: 0, ringT: 0, names: { whale: WU.nameOf('whale', seed), tree: WU.nameOf('tree', seed), deer: WU.nameOf('deer', seed) } };
    }
    return g._wu;
  };
  WG.state = S;
  const isles = (g) => (VR.IslesGen && VR.IslesGen.list ? VR.IslesGen.list({ seed: g.meta.seed }) : []);
  const F = () => VR.F, RT = () => VR.R && VR.R.T;
  // the ground under (x, z): the top solid block that is not leaves (or null where the chunk is not loaded)
  const ground = (w, x, z) => {
    const X = Math.floor(x), Z = Math.floor(z); if (!w.isLoaded(X, Z)) return null;
    const fl = RT().flags, Fx = F(); let y = w.topAt(X, Z);
    for (let k = 0; k < 40 && y > 1; k++, y--) { const f = fl[w.getBlock(X, y, Z)]; if ((f & Fx.SOLID) && !(f & Fx.LEAVES)) break; }
    return y;
  };
  const deed = (g, kind, o) => { try { if (VR.ChronikGame && VR.ChronikGame.deed) VR.ChronikGame.deed(g, kind, o || {}); } catch (e) { /* the Chronik's */ } };
  const note = (g, text, key, prio) => { if (VR.Quiet && VR.Quiet.note) VR.Quiet.note(text, prio || 2, key); else if (g.ui && g.ui.hint) g.ui.hint(text, 3600); };
  const villagesNear = (g) => { const out = [], V = g.villages; if (V && V.known) for (const v of V.known.values()) if (v && v.plan) out.push([v.plan.x, v.plan.z, 50]); return out; };

  // ================================================================ the audio (our own voices)
  const AC = (g) => { const A = g.audio; return A && A.ctx && A.sfx ? A : null; };
  const midiF = (m) => 440 * Math.pow(2, (m - 69) / 12);
  // the whale's voice: three long gliding tones an octave and a half under the flute, a soft vibrato, a hum of fifths
  WG.sing = function (g, at, farewell) {
    const A = AC(g); if (!A) return;
    const p = g.player.pos, d = at ? Math.hypot(at[0] - p[0], at[1] - p[1], at[2] - p[2]) : 0;
    const k = clamp(1 - d / (WU.WHALE.hear * 1.7), 0, 1); if (k <= 0.02) return;
    try {
      const c = A.ctx, t0 = c.currentTime + 0.05, M = farewell ? [WU.MOTIF[2], WU.MOTIF[1], WU.MOTIF[0]] : WU.MOTIF;
      for (let i = 0; i < 3; i++) {
        const f = midiF(WU.NOTES[M[i]] - 19), t = t0 + i * 1.55, dur = i === 2 ? 2.6 : 1.7;
        const o = c.createOscillator(), o2 = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), gn = c.createGain(), g2 = c.createGain();
        o.type = 'sine'; o2.type = 'triangle';
        o.frequency.setValueAtTime(f * 0.93, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.45);
        o2.frequency.setValueAtTime(f * 1.5 * 0.93, t); o2.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.5);
        lfo.frequency.value = 4.6; lg.gain.value = f * 0.012; lfo.connect(lg); lg.connect(o.frequency);
        gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(0.16 * k, t + 0.4); gn.gain.exponentialRampToValueAtTime(0.0008, t + dur);
        g2.gain.value = 0.25;
        o.connect(gn); o2.connect(g2); g2.connect(gn); gn.connect(A.sfx); if (A.rev) gn.connect(A.rev);
        for (const q of [o, o2, lfo]) { q.start(t); q.stop(t + dur + 0.1); }
      }
    } catch (e) { /* no sound */ }
  };
  WG.fluteNote = function (g, key) {
    const A = AC(g); if (!A) return;
    try {
      const c = A.ctx, t = c.currentTime + 0.01, f = midiF(WU.NOTES[key]);
      const o = c.createOscillator(), o2 = c.createOscillator(), gn = c.createGain(), g2 = c.createGain();
      o.type = 'sine'; o2.type = 'triangle'; o.frequency.value = f; o2.frequency.value = f * 2;
      gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(0.12, t + 0.05); gn.gain.setValueAtTime(0.11, t + 0.35); gn.gain.exponentialRampToValueAtTime(0.0008, t + 0.9);
      g2.gain.value = 0.12; o.connect(gn); o2.connect(g2); g2.connect(gn); gn.connect(A.sfx); if (A.rev) gn.connect(A.rev);
      for (const q of [o, o2]) { q.start(t); q.stop(t + 1); }
    } catch (e) { /* no sound */ }
  };

  // ================================================================ the Himmelswal
  const ROUTE = [0, 0, 0, 0, 0, 0];
  function fly(W, tg, dt, speed) {
    const dx = tg[0] - W.p[0], dy = tg[1] - W.p[1], dz = tg[2] - W.p[2], dh = Math.hypot(dx, dz);
    const want = Math.atan2(-dx, -dz), turn = dh > 1 ? clamp(wrapA(want - W.yaw), -0.45 * dt, 0.45 * dt) : 0;
    W.yaw = wrapA(W.yaw + turn);
    const v = Math.min(speed, dh * 0.35 + 0.6) * dt;
    if (dh < 24) { if (dh > 1e-3) { W.p[0] += dx / dh * Math.min(dh, v); W.p[2] += dz / dh * Math.min(dh, v); } }
    else { W.p[0] += -Math.sin(W.yaw) * v; W.p[2] += -Math.cos(W.yaw) * v; }
    const vy = clamp(dy * 0.6, -4, 4) * dt; W.p[1] += vy;
    W.pitch += (clamp(Math.atan2(vy / Math.max(dt, 1e-3), Math.max(1, v / Math.max(dt, 1e-3))), -0.3, 0.3) - W.pitch) * Math.min(1, dt * 2);
    W.bank += (clamp(-turn / Math.max(dt, 1e-3) * 1.6, -0.35, 0.35) - W.bank) * Math.min(1, dt * 1.5);
    return Math.hypot(dx, dy, dz);
  }
  function whaleFrame(g, R, dt, Tk) {
    const W = R.whale, m = mem(g), p = g.player.pos, day = g.env.day | 0;
    if (!R.loop) R.loop = WU.whaleRoute(R.seed, isles(g));
    WU.whaleAt(R.seed, R.loop, Tk, W.st);
    W.ph += dt * TAU / WU.WHALE.period * (W.mode === 'route' ? 1 : 1.25);
    const E = g.env.E || {}, tod = g.env.timeOfDay, dusk = sm((tod - 10600) / 1400) * (1 - sm((tod - 21500) / 900));
    W.glow = 0.22 + 0.78 * Math.max(E.night || 0, dusk);
    if (W.mode === 'route') {
      W.vis = W.st[7];
      if (W.vis) { W.p[0] = W.st[0]; W.p[1] = W.st[1]; W.p[2] = W.st[2]; W.yaw = W.st[3]; W.pitch = W.st[4]; W.bank = W.st[5]; }
    } else {
      W.vis = 1; W.t += dt;
      if (W.mode === 'descend') { if (fly(W, W.hover, dt, 7) < 2.5) { W.mode = 'wait'; W.t = 0; } }
      else if (W.mode === 'wait') {
        W.p[1] += (W.hover[1] + Math.sin(R.time * 0.8) * 0.4 - W.p[1]) * Math.min(1, dt * 1.5); W.bank *= 0.97; W.pitch *= 0.97;
        if (W.t > 75 || Math.hypot(p[0] - W.p[0], p[2] - W.p[2]) > 90) { W.mode = 'rejoin'; W.t = 0; }
      } else if (W.mode === 'ride') rideFrame(g, R, W, dt);
      else if (W.mode === 'rejoin') {
        const C = R.loop.C, on = W.st[7];
        const tg = on ? [W.st[0], W.st[1], W.st[2]] : [C[0] + (W.p[0] - C[0]) * 3, W.p[1] + 80, C[1] + (W.p[2] - C[1]) * 3];
        const d = fly(W, tg, dt, 8);
        if ((on && d < 14) || (!on && Math.hypot(W.p[0] - C[0], W.p[2] - C[1]) > 800) || W.t > 150) { W.mode = 'route'; W.t = 0; }
      }
    }
    if (!W.vis) return;
    const d = Math.hypot(W.p[0] - p[0], W.p[1] - p[1], W.p[2] - p[2]);
    // the sighting: once per 2 game days in the Chronik; a calm line the first time an evening
    if (d < 420 && W.st[8] > 0.6 && WU.canEvent(m, 'whale', day)) {
      WU.markEvent(m, 'whale', day); m.whaleSeen = day;
      note(g, T('g.wu.whale.seen', { name: R.names.whale }), 'wunder:whale');
      deed(g, 'w_whale', { x: W.p[0], z: W.p[2], who: R.names.whale });
      if (VR.Wander && VR.Wander.note) { try { VR.Wander.note(g.meta, 'places', 'wu:whale', R.names.whale); } catch (e) { /* the book's */ } }
      if (VR.EventLog && VR.EventLog.emit) { try { VR.EventLog.emit('encounter', 'wunder_whale', 3, W.p.slice(), 'wunder', 20); } catch (e) { /* the log's */ } }
    }
    // the song at dusk
    const s = WU.songAt(R.seed, Tk); R.song = s;
    if (s && s.sing && R.songK !== s.t0 && W.mode === 'route') {
      R.songK = s.t0;
      WG.sing(g, W.p);
      if (d < WU.WHALE.hear * 1.3 && R.sangNote !== day) { R.sangNote = day; note(g, T('g.wu.whale.sing', { name: R.names.whale }) + (m.learned ? ' — ' + T('g.wu.flute.prompt') : ''), 'wunder:sing'); }
    }
    // a trail of Flausel light from the flukes (Low and up)
    const P = g.particles;
    if (P && tierOf(g) >= 1 && d < 360) {
      R.moteAcc = (R.moteAcc || 0) + dt * (3 + 5 * W.glow);
      const L = WU.WHALE.len, cy = Math.cos(W.yaw), sy = Math.sin(W.yaw);
      while (R.moteAcc >= 1) {
        R.moteAcc -= 1;
        const lx = (Math.random() - 0.5) * L * 0.3, lz = L * (0.38 + Math.random() * 0.1);
        P.spawn(W.p[0] + lx * cy + lz * sy, W.p[1] + (Math.random() - 0.5) * 2, W.p[2] - lx * sy + lz * cy, (Math.random() - 0.5) * 0.4, -0.15 - Math.random() * 0.25, (Math.random() - 0.5) * 0.4, { life: 4 + Math.random() * 2, size: 0.35 + Math.random() * 0.25, grav: 0, drag: 0.4, col: Math.random() < 0.5 ? [1.0, 0.86, 0.55] : [0.7, 0.92, 1.0], emis: 1, collide: false, fade: true });
      }
    }
  }
  // the answer heard: it comes down beside you (between you and it, 13 m off, 7 m over the ground)
  WG.call = function (g) {
    const R = S(g), W = R.whale, p = g.player.pos;
    if (!W.vis || W.mode !== 'route') return false;
    let dx = W.p[0] - p[0], dz = W.p[2] - p[2]; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
    const hx = p[0] + dx * 13, hz = p[2] + dz * 13, gy = ground(g.world, hx, hz);
    W.hover = [hx, (gy === null ? p[1] : Math.max(gy, Math.floor(p[1]) - 1)) + 7, hz];
    W.mode = 'descend'; W.t = 0;
    note(g, T('g.wu.whale.heard', { name: R.names.whale }) + ' ' + T('g.wu.whale.come', { name: R.names.whale }), 'wunder:heard', 3);
    return true;
  };
  WG.board = function (g) {
    const R = S(g), W = R.whale, p = g.player.pos;
    if (W.mode !== 'wait') return false;
    // on an isle → down to the valley (outward from the archipelago); else → the nearest isle's crown
    const L = isles(g), C = R.loop.C;
    const on = L.find(I => Math.hypot(p[0] - I.x, p[2] - I.z) < I.r * 1.35 && p[1] > I.y - 12);
    let dest;
    if (on) { let dx = p[0] - C[0], dz = p[2] - C[1]; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl; dest = { x: C[0] + dx * 250, z: C[1] + dz * 250, y: null, up: false }; }
    else {
      let best = null, bd = 1e9; for (const I of L) { const dd = Math.hypot(I.x - p[0], I.z - p[2]); if (dd < bd) { bd = dd; best = I; } }
      if (!best) return false;
      let dx = p[0] - best.x, dz = p[2] - best.z; const dl = Math.hypot(dx, dz) || 1;
      dest = { x: best.x + dx / dl * best.r * 0.4, z: best.z + dz / dl * best.r * 0.4, y: null, up: true, top: best.y + (best.dome || 4) };
    }
    W.dest = dest; W.mode = 'ride'; W.t = 0; W.start = W.p.slice();
    WG.camOn = true; WG.camS = null;
    note(g, T('g.wu.whale.aboard', { name: R.names.whale, to: T(dest.up ? 'g.wu.whale.up' : 'g.wu.whale.down') }), 'wunder:ride', 3);
    return true;
  };
  function rideFrame(g, R, W, dt) {
    const D = W.dest, p = g.player, w = g.world;
    const gy = ground(w, D.x, D.z); if (gy !== null) D.y = gy; else if (D.up && D.y === null) D.y = D.top;
    const dh = Math.hypot(D.x - W.p[0], D.z - W.p[2]);
    const cruise = Math.max(W.start[1], (D.y === null ? W.start[1] : D.y)) + 26;
    const tg = dh > 45 || D.y === null ? [D.x, cruise, D.z] : [D.x, D.y + 6, D.z];
    const d = fly(W, tg, dt, 9);
    // the passenger on its back
    const back = WU.WHALE.len * 0.083;
    p.pos[0] = W.p[0] + Math.sin(W.yaw) * 2.5; p.pos[1] = W.p[1] + back; p.pos[2] = W.p[2] + Math.cos(W.yaw) * 2.5;
    if (p.vel) { p.vel[0] = 0; p.vel[1] = 0; p.vel[2] = 0; } p.fallStart = null;
    if ((D.y !== null && dh < 3.5 && d < 2.5) || W.t > 150) {
      const sx = Math.cos(W.yaw) * 6, sz = -Math.sin(W.yaw) * 6, y = D.y !== null ? D.y + 1 : p.pos[1];
      if (p.safeTeleport) p.safeTeleport(D.x + sx, y, D.z + sz); else { p.pos[0] = D.x + sx; p.pos[1] = y; p.pos[2] = D.z + sz; }
      p.fallStart = null; WG.camOn = false;
      W.mode = 'rejoin'; W.t = 0;
      WG.sing(g, W.p, true);
      note(g, T('g.wu.whale.bye', { name: R.names.whale }), 'wunder:bye', 3);
      deed(g, 'w_ride', { x: D.x, z: D.z, who: R.names.whale });
      if (VR.EventLog && VR.EventLog.emit) { try { VR.EventLog.emit('travel', 'wunder_ride', 4, [D.x, y + 2, D.z], 'wunder', 20); } catch (e) { /* the log's */ } }
    }
  }
  // the chase view: behind and over the whale, eased (as the ferries')
  WG.cam = function (g, base) {
    const R = g._wu; if (!R || R.whale.mode !== 'ride') { WG.camOn = false; return null; }
    const W = R.whale, fx = -Math.sin(W.yaw), fz = -Math.cos(W.yaw), rx = Math.cos(W.yaw), rz = -Math.sin(W.yaw);
    const want = [W.p[0] - fx * 31 + rx * 9, W.p[1] + 7.5, W.p[2] - fz * 31 + rz * 9], look = [W.p[0] + fx * 26, W.p[1] + 1, W.p[2] + fz * 26];
    const C = WG.camS || (WG.camS = { p: want.slice(), l: look.slice() }), k = 1 - Math.exp(-2.2 * Math.min(0.1, R.dt || 0.016));
    for (let i = 0; i < 3; i++) { C.p[i] += (want[i] - C.p[i]) * k; C.l[i] += (look[i] - C.l[i]) * k; }
    const dx = C.l[0] - C.p[0], dy = C.l[1] - C.p[1], dz = C.l[2] - C.p[2];
    return Object.assign({}, base, { x: C.p[0], y: C.p[1], z: C.p[2], yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)), roll: 0, fixed: true, far: (base.far || 600) + 200 });
  };

  // ================================================================ the flute
  WG.play = function (g, key) {
    const R = S(g), W = R.whale, p = g.player.pos;
    WG.fluteNote(g, key);
    R.presses.push({ k: key, T: ticks(g) }); if (R.presses.length > 8) R.presses.shift();
    R.fluteT = R.time;
    const P = g.particles; if (P) for (let i = 0; i < 4; i++) P.spawn(p[0] + (Math.random() - 0.5) * 0.6, p[1] + 1.5, p[2] + (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.5, 0.6 + Math.random() * 0.4, (Math.random() - 0.5) * 0.5, { life: 1.4, size: 0.12, grav: 0, drag: 0.6, col: [1.0, 0.9, 0.6], emis: 1, collide: false, fade: true });
    const s = R.song || WU.songAt(R.seed, ticks(g));
    if (s && W.vis && W.mode === 'route' && WU.hears(Math.hypot(W.p[0] - p[0], W.p[1] - p[1], W.p[2] - p[2])) && WU.answered(R.presses, s.end)) { R.presses.length = 0; WG.call(g); }
    prompt(g, R);
  };
  const heldFlute = (g) => { const h = g.player && g.player.inv && g.player.inv.held; return !!(h && h.id === 'wunder_flute'); };
  const PP = VR.Player && VR.Player.prototype;
  if (PP && PP.interact && !PP.interact.__wu) {
    const oi = PP.interact;
    PP.interact = function (dt, input) {
      const g = this.game;
      if (!(g && heldFlute(g) && input && input.captured && !(g.ui && g.ui.blocking))) return oi.apply(this, arguments);
      const sel = this.inv.sel; let hit = 0;
      for (let k = 1; k <= 3; k++) if (input.hit('Digit' + k)) { hit = k; try { WG.play(g, k); } catch (e) { /* the flute's */ } }
      const r = oi.apply(this, arguments);
      if (hit) { this.inv.sel = sel; this.inv.changed = true; }
      return r;
    };
    PP.interact.__wu = true;
  }
  // the prompt: three soft lights (1 · 3 · 2) that light as you play them, breathing with the beat, while the flute is
  // held and a song's window is open within hearing (else a small line: the keys)
  let promptEl = null;
  function prompt(g, R) {
    if (typeof document === 'undefined' || !document.body) return;
    const W = R.whale, p = g.player.pos, held = heldFlute(g) && !(g.ui && g.ui.blocking);
    const s = R.song, open = !!(held && s && W.vis && W.mode === 'route' && WU.hears(Math.hypot(W.p[0] - p[0], W.p[1] - p[1], W.p[2] - p[2])));
    if (!held) { if (promptEl) promptEl.style.display = 'none'; return; }
    if (!promptEl) {
      promptEl = document.createElement('div'); promptEl.id = 'wuflute';
      promptEl.style.cssText = 'position:fixed;left:50%;bottom:118px;transform:translateX(-50%);padding:6px 14px;border-radius:14px;background:rgba(20,24,40,.55);color:#ffe8b8;font:14px/1.3 sans-serif;pointer-events:none;z-index:40;text-align:center';
      const st = document.createElement('style'); st.textContent = '@keyframes wubeat{0%,100%{transform:scale(1)}50%{transform:scale(1.25)}}#wuflute .d{display:inline-block;width:22px;height:22px;margin:0 5px;border-radius:50%;background:rgba(255,220,150,.18);border:1px solid rgba(255,220,150,.6);line-height:22px;font-size:12px;animation:wubeat 1.4s ease-in-out infinite}#wuflute .on{background:#ffd27a;color:#3a2a10;box-shadow:0 0 12px #ffc860}';
      document.head.appendChild(st); document.body.appendChild(promptEl);
    }
    // how far into the motif the last presses are
    let got = 0; const L = R.presses.filter(q => !s || q.T >= s.end - 20).map(q => q.k), M = WU.MOTIF;
    for (let n = Math.min(3, L.length); n > 0; n--) { let ok = true; for (let j = 0; j < n; j++) if (L[L.length - n + j] !== M[j]) { ok = false; break; } if (ok) { got = n; break; } }
    const html = open ? '<div>' + T('g.wu.flute.prompt') + '</div>' + M.map((k, i) => `<span class="d${i < got ? ' on' : ''}" style="animation-delay:${i * 0.47}s">${k}</span>`).join('') : T('g.wu.flute.hint');
    if (promptEl._h !== html) { promptEl.innerHTML = html; promptEl._h = html; }
    promptEl.style.display = '';
  }
  // learning it: an elder by the water (talking to them) — the motif played once, the flute given
  const nearWater = (g, pos, r) => {
    const w = g.world, Fx = F(), fl = RT().flags, X = Math.floor(pos[0]), Y = Math.floor(pos[1]), Z = Math.floor(pos[2]);
    for (let dz = -r; dz <= r; dz += 2) for (let dx = -r; dx <= r; dx += 2) for (let dy = -3; dy <= 1; dy++) if (fl[w.getBlock(X + dx, Y + dy, Z + dz)] & Fx.WATER) return true;
    return false;
  };
  WG.learn = function (g, a) {
    const m = mem(g), inv = g.player && g.player.inv; if (m.learned || !inv) return false;
    if (inv.add('wunder_flute', 1) <= 0) return false;
    m.learned = true; inv.changed = true;
    const name = (a && a.name) || '';
    if (a && a.say) { a.say(T('g.wu.flute.lesson'), 9); a.lookAt = [g.player.pos[0], g.player.pos[1] + 1.5, g.player.pos[2]]; }
    note(g, T('g.wu.flute.got', { name }) + ' ' + T('g.wu.flute.hint'), 'wunder:flute', 3);
    deed(g, 'w_flute', { x: a ? a.pos[0] : g.player.pos[0], z: a ? a.pos[2] : g.player.pos[2] });
    [0, 650, 1300].forEach((ms, i) => setTimeout(() => WG.fluteNote(g, WU.MOTIF[i]), ms + 300));
    return true;
  };
  const VP = VR.Villages && VR.Villages.prototype;
  if (VP && VP.openTalk && !VP.openTalk.__wu) {
    const ot = VP.openTalk;
    VP.openTalk = function (a) {
      const r = ot.apply(this, arguments);
      try {
        const g = this.g, elder = a && ((a.p && a.p.look && a.p.look.age === 'elder') || a.role === 'elder');
        if (elder && WG.on(g) && !mem(g).learned && nearWater(g, a.pos, 12)) WG.learn(g, a);
      } catch (e) { /* the talk's own */ }
      return r;
    };
    VP.openTalk.__wu = true;
  }

  // ================================================================ the Wanderbaum
  function treeOk(g, x, z, vils) {
    const w = g.world, y = ground(w, x, z); if (y === null) return false;
    const b = w.getBlock(Math.floor(x), y, Math.floor(z)), R = VR.R, nm = R.types[R.T.type[b]] && R.types[R.T.type[b]].name;
    if (nm !== 'grass_block' && nm !== 'dirt' && nm !== 'moss_block') return false;
    for (const [dx, dz] of [[4, 0], [-4, 0], [0, 4], [0, -4]]) { const y2 = ground(w, x + dx, z + dz); if (y2 === null || Math.abs(y2 - y) > 2) return false; }
    if (nearWater(g, [x, y, z], 4)) return false;
    if (WU.inVillage(x, z, vils, WU.TREE.vilMargin + 10)) return false;
    return true;
  }
  const FLOWERS = ['poppy', 'cornflower', 'oxeye_daisy', 'allium', 'azure_bluet', 'dandelion', 'lily_of_the_valley'];
  function placeRing(g, x, z, seed) {
    const w = g.world, R = VR.R, fl = R.T.flags, Fx = F();
    if (!w.isLoaded(Math.floor(x), Math.floor(z))) return false;
    let n = 0;
    for (const [rx, rz] of WU.ringSpots(x, z, seed)) {
      const X = Math.floor(rx), Z = Math.floor(rz), y = ground(w, X, Z); if (y === null) continue;
      const below = R.types[R.T.type[w.getBlock(X, y, Z)]];
      if (!below || below.name !== 'grass_block') continue;
      const ab = w.getBlock(X, y + 1, Z); if (ab && (fl[ab] & Fx.SOLID)) continue;
      const t = R.byName[FLOWERS[(n + (seed & 7)) % FLOWERS.length]]; if (!t) continue;
      w.setBlock(X, y + 1, Z, t.defaultState); n++;
    }
    return n || true;
  }
  function treeFrame(g, R, dt) {
    if (g.meta.guest) return;
    const m = mem(g), p = g.player.pos, w = g.world, tod = g.env.timeOfDay, day = g.env.day | 0;
    const vils = villagesNear(g);
    if (!m.tree) {
      if (R.age < 15 || (R.treeT -= dt) > 0) return;
      R.treeT = 4;
      // a meadow 50–110 m from you, far from the villages
      for (let k = 0; k < 24; k++) {
        const a = WU.h01(R.seed, k, 0x71) * TAU, r = 50 + 60 * WU.h01(R.seed, k, 0x72), x = Math.round(p[0] + Math.cos(a) * r), z = Math.round(p[2] + Math.sin(a) * r);
        if (!treeOk(g, x, z, vils) || WU.inVillage(x, z, vils, 60)) continue;
        m.tree = { x: x + 0.5, z: z + 0.5, tx: null, tz: null, stood: true, planned: (tod >= WU.TREE.night0 ? day : day - 1), rings: [], yaw: WU.h01(R.seed, k, 0x73) * TAU };
        break;
      }
      return;
    }
    const tr = m.tree;
    if (Math.hypot(tr.x - p[0], tr.z - p[2]) > 260) return;
    const nightKey = tod >= WU.TREE.night0 ? day : day - 1, night = WU.isNight(tod);
    const ok = (x, z) => treeOk(g, x, z, vils);
    const ringAt = (x, z) => { if (!placeRing(g, x, z, R.seed ^ Math.round(x * 7 + z * 13))) { tr.rings.push([x, z]); if (tr.rings.length > 4) tr.rings.shift(); } };
    if (night) {
      if ((tr.tx === null || tr.tx === undefined) && tr.planned !== nightKey) { const t = WU.treeTarget(R.seed, nightKey, [tr.x, tr.z], ok); tr.planned = nightKey; if (t) { tr.tx = t[0]; tr.tz = t[1]; } }
      const e = WU.treeStep(tr, dt, { night: true, players: [[p[0], p[2]]], vils });
      if (e && e.k === 'ring') ringAt(e.x, e.z);
      if (tr.walking) R.treeWalk = (R.treeWalk || 0) + dt * 1.1;
    } else {
      tr.walking = false; tr.tx = null;
      // nights you were away: it went on its own (at most three)
      let guard = 0;
      while (tr.planned < nightKey && guard++ < 3) {
        tr.planned++;
        const t = WU.treeTarget(R.seed, tr.planned, [tr.x, tr.z], ok);
        if (t) { if (tr.stood !== false) ringAt(tr.x, tr.z); tr.x = t[0]; tr.z = t[1]; tr.stood = true; }
      }
      tr.planned = Math.max(tr.planned, nightKey);
      // seen by day: once per 2 game days into the Chronik
      if (Math.hypot(tr.x - p[0], tr.z - p[2]) < 45 && WU.canEvent(m, 'tree', day)) {
        WU.markEvent(m, 'tree', day); m.treeSeen = { d: day, x: tr.x, z: tr.z };
        note(g, T('g.wu.tree.seen', { name: R.names.tree }), 'wunder:tree');
        deed(g, 'w_tree', { x: tr.x, z: tr.z, who: R.names.tree });
      }
    }
    if (tr.rings.length && (R.ringT -= dt) <= 0) { R.ringT = 3; const q = tr.rings[0]; if (placeRing(g, q[0], q[1], R.seed ^ Math.round(q[0] * 7 + q[1] * 13))) tr.rings.shift(); }
  }
  WG.sit = function (g) {
    const R = S(g), m = mem(g), day = g.env.day | 0, inv = g.player.inv, tr = m.tree; if (!tr) return false;
    note(g, T('g.wu.tree.rest'), 'wunder:rest');
    if (!WU.isNight(g.env.timeOfDay) && WU.seedToday(m, day) && inv && inv.add('lantern_seed', 1) > 0) {
      m.seedDay = day; inv.changed = true;
      setTimeout(() => note(g, T('g.wu.tree.seed'), 'wunder:seed', 3), 1600);
      const P = g.particles, y = (ground(g.world, tr.x, tr.z) || g.player.pos[1]) + 7;
      if (P) for (let i = 0; i < 10; i++) P.spawn(g.player.pos[0] + (Math.random() - 0.5), y - i * 0.3, g.player.pos[2] + (Math.random() - 0.5), 0, -1.2, 0, { life: 2.2, size: 0.16, grav: 0, drag: 0.2, col: [1, 0.85, 0.5], emis: 1, collide: false, fade: true });
    }
    void R;
    return true;
  };

  // ================================================================ the Laternenhirsch
  function spots(g, R) {
    if (R.time - R.spotsT < 5) return R.spots;
    R.spotsT = R.time; const out = [];
    const L = g.entities && g.entities.land;
    if (L && L.fx) for (const f of L.fx.values()) if (f && (f.kind === 'petals' || f.kind === 'glowring')) out.push({ id: f.kind + ':' + Math.round(f.x) + ',' + Math.round(f.z), x: f.x, z: f.z, kind: f.kind });
    const I = VR.Intent; if (I && I.targets) for (const q of I.targets) if (q && q.kind === 'landmark' && q.pos) out.push({ id: 'lm:' + q.id, x: q.pos[0], z: q.pos[2], kind: 'landmark' });
    R.spots = out;
    return out;
  }
  function swirl(g, x, y, z) {
    const P = g.particles; if (!P) return;
    for (let i = 0; i < 36; i++) { const a = i / 36 * TAU * 3, r = 0.4 + i * 0.03; P.spawn(x + Math.cos(a) * r, y + 0.3 + i * 0.05, z + Math.sin(a) * r, -Math.sin(a) * 1.4, 0.6 + Math.random() * 0.5, Math.cos(a) * 1.4, { life: 1.8 + Math.random(), size: 0.18 + Math.random() * 0.1, grav: -0.1, drag: 0.8, col: i & 1 ? [1.0, 0.86, 0.55] : [0.7, 0.92, 1.0], emis: 1, collide: false, fade: true }); }
  }
  function deerFrame(g, R, dt) {
    if (g.meta.guest) return;
    const m = mem(g), p = g.player.pos, E = g.env.E || {}, day = g.env.day | 0, w = g.world;
    const lp = R.lastP || (R.lastP = [p[0], p[2]]), mv = Math.hypot(p[0] - lp[0], p[2] - lp[1]); lp[0] = p[0]; lp[1] = p[2];
    R.speed = mv < 60 * dt ? mv / Math.max(dt, 1e-3) : 0;
    R.still = R.speed < 0.25 ? R.still + dt : 0;
    // what you have seen yourself
    if ((R.seenT = (R.seenT || 0) - dt) <= 0) { R.seenT = 2; for (const q of spots(g, R)) if (!m.seen[q.id] && Math.hypot(q.x - p[0], q.z - p[2]) < 22) m.seen[q.id] = 1; }
    const D = R.deer;
    if (!D) {
      if ((R.deerT -= dt) > 0 || (E.night || 0) < WU.DEER.dark) return;
      R.deerT = 1;
      let vd = 1e9; for (const v of villagesNear(g)) vd = Math.min(vd, Math.hypot(v[0] - p[0], v[1] - p[2]));
      if (!WU.deerMay({ night: E.night, stillFor: R.still, vilDist: vd, day, st: m })) return;
      const tgt = WU.deerPick(spots(g, R), m.seen, p[0], p[2]); if (!tgt) return;
      let dx = tgt.x - p[0], dz = tgt.z - p[2]; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
      const x = p[0] + dx * 12 + dz * 3, z = p[2] + dz * 12 - dx * 3, gy = ground(w, x, z); if (gy === null) return;
      WU.markEvent(m, 'deer', day);
      R.deer = { x, z, y: gy + 1, tx: tgt.x, tz: tgt.z, id: tgt.id, yaw: Math.atan2(-dx, -dz), walk: 0, t: 0, out: 0, gone: 0 };
      swirl(g, x, gy + 1, z);
      note(g, T('g.wu.deer.seen') + ' ' + T('g.wu.deer.follow'), 'wunder:deer', 3);
      return;
    }
    D.t += dt;
    if (D.gone > 0) { D.gone -= dt; if (D.gone <= 0) R.deer = null; return; }
    const x0 = D.x, z0 = D.z;
    const r = (E.night || 0) < 0.3 ? 'vanish' : WU.deerStep(D, dt, { px: p[0], pz: p[2], speed: R.speed });
    D.walk += Math.hypot(D.x - x0, D.z - z0) * 2.2;
    const gy = ground(w, D.x, D.z); if (gy !== null) D.y += (gy + 1 - D.y) * Math.min(1, dt * 6);
    if (r === 'vanish') { swirl(g, D.x, D.y, D.z); note(g, T('g.wu.deer.gone'), 'wunder:deergone'); D.gone = 0.6; }
    else if (r === 'arrive') {
      m.seen[D.id] = 1; m.paths = (m.paths | 0) + 1;
      const lang = VR.I18N && VR.I18N.lang === 'en' ? 'en' : 'de', ps = R.seed ^ hs(D.id), name = WU.pathName(ps, lang);
      note(g, T('g.wu.deer.path', { path: name }), 'wunder:path', 3);
      deed(g, 'w_deer', { x: D.tx, z: D.tz, who: name });
      if (VR.Wander && VR.Wander.note) { try { VR.Wander.note(g.meta, 'places', 'wu:path:' + D.id, name); } catch (e) { /* the book's */ } }
      if (VR.EventLog && VR.EventLog.emit) { try { VR.EventLog.emit('discovery', 'wunder_path', 4, [D.tx, D.y + 2, D.tz], 'wunder', 20); } catch (e) { /* the log's */ } }
      swirl(g, D.x, D.y, D.z); D.gone = 2.5;
    }
  }

  // ================================================================ the frame
  WG.frame = function (g, dt) {
    if (!WG.on(g)) { if (g && g._wu && g._wu.whale.mode === 'ride') { g._wu.whale.mode = 'route'; WG.camOn = false; } if (promptEl) promptEl.style.display = 'none'; return; }
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    const t0 = performance.now(), R = S(g);
    R.age += dt; R.time += dt; R.dt = dt;
    const Tk = ticks(g);
    if ((g.meta.vgen | 0) >= 3) whaleFrame(g, R, dt, Tk);
    treeFrame(g, R, dt);
    deerFrame(g, R, dt);
    prompt(g, R);
    WG.cost.frames++; WG.cost.ms += performance.now() - t0;
  };
  const opf = VR.Game.prototype.playFrame;
  if (!opf.__wu) {
    VR.Game.prototype.playFrame = function (dt) { const r = opf.apply(this, arguments); try { WG.frame(this, dt); } catch (e) { if (!WG.warned) { WG.warned = true; console.warn('wunder', e); } } return r; };
    VR.Game.prototype.playFrame.__wu = true;
  }

  // ================================================================ [V]: climb on, sit under the tree
  if (VR.Ctx && VR.Ctx.hooks && Array.isArray(VR.Ctx.hooks.near)) VR.Ctx.hooks.near.push((g, eye, dir) => {
    if (!WG.on(g) || !g._wu) return null;
    const R = g._wu, W = R.whale, list = [];
    if (W.mode === 'wait' && Math.hypot(W.p[0] - eye[0], W.p[2] - eye[2]) < 26) list.push({ kind: 'wunder', name: T('g.wu.whale.board'), pos: W.p.slice(), r: 11, reach: 9, act: (gg) => WG.board(gg) });
    const tr = g.meta.wunder && g.meta.wunder.tree;
    if (tr && !tr.walking && Math.hypot(tr.x - eye[0], tr.z - eye[2]) < 12) { const y = ground(g.world, tr.x, tr.z); if (y !== null) list.push({ kind: 'wunder', name: T('g.wu.tree.sit'), pos: [tr.x, y + 3, tr.z], r: 3.5, reach: 6, act: (gg) => WG.sit(gg) }); }
    return list.length && VR.Ctx.pickNear ? VR.Ctx.pickNear(eye, dir, list) : null;
  });

  // ================================================================ the draw
  const KCAP = 8;
  WG.draw = function (g, r, E, layer, cam) {
    if (layer !== 'opaque' || !WG.on(g) || !g._wu) return;
    const t0 = performance.now(), R = g._wu, W = R.whale, tier = tierOf(g), m = g.meta.wunder || {};
    const tr = m.tree, D = R.deer, w = g.world;
    cam = cam || r.cam;
    const cx = cam.x, cy = cam.y, cz = cam.z;
    let draws = 0;
    const treeY = tr && Math.hypot(tr.x - cx, tr.z - cz) < 220 ? ground(w, tr.x, tr.z) : null;
    const night = (E && E.night) || 0, tod = g.env.timeOfDay;
    if (tier >= 2 && VR.WildGPU && VR.WildGPU.kind) {
      const G = VR.WildGPU, gl = r.gl, put = G.put, list = R.list || (R.list = []); list.length = 0;
      if (W.vis) {
        const x = W.p[0] - cx, y = W.p[1] - cy, z = W.p[2] - cz;
        if (x * x + z * z < 1400 * 1400) { const K = G.kind(gl, 'wwhale', KCAP); put(K.data, 0, x, y, z, WU.WHALE.len, W.yaw, W.pitch, W.bank, W.ph, 1, 1, 1, 1, 0.2, 1.4, -0.04, 0, W.glow, 0.12, 2); list.push([K, 1]); }
      }
      if (tr && treeY !== null) {
        const sc = 14, walk = tr.walking ? R.treeWalk || 0 : 0, bob = tr.walking ? Math.abs(Math.sin(walk * 2.5)) * 0.25 : 0;
        const K = G.kind(gl, 'wtree', KCAP), KR = G.kind(gl, 'wroot', KCAP), gw = 0.3 + 0.7 * Math.max(night, sm((tod - 11000) / 1500));
        put(K.data, 0, tr.x - cx, treeY + 0.6 + bob - cy, tr.z - cz, sc, tr.yaw || 0, 0, tr.walking ? Math.sin(walk * 2.5) * 0.03 : 0, R.time * 0.7, 1, 1, 1, 1, 0, 0, 0, 0.012, gw, 0, 2);
        list.push([K, 1]);
        for (let k = 0; k < 5; k++) { const a = (tr.yaw || 0) + k / 5 * TAU, lift = tr.walking ? Math.max(0, Math.sin(walk * 2.5 + k * TAU / 5)) * 0.4 : 0; put(KR.data, k, tr.x - cx, treeY + 0.6 + bob - cy, tr.z - cz, sc, a, 0, lift, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0); }
        list.push([KR, 5]);
      }
      if (D) {
        const sc = 1.15 * (D.gone > 0 && D.gone < 0.6 ? D.gone / 0.6 : 1), K = G.kind(gl, 'wdeer', KCAP), KL = G.kind(gl, 'wleg', KCAP), cyw = Math.cos(D.yaw), syw = Math.sin(D.yaw), wa = D.walking ? 1 : 0;
        put(K.data, 0, D.x - cx, D.y - cy, D.z - cz, sc, D.yaw, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0.6 + 0.4 * night, 0.1, 2);
        list.push([K, 1]);
        const H = VR.WunderModels.DEER;
        H.hips.forEach((hp, i) => { const lx = hp[0] * sc, lz = hp[1] * sc, sw = Math.sin(D.walk + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.45 * wa; put(KL.data, i, D.x + lx * cyw + lz * syw - cx, D.y + H.hipY * sc - cy, D.z - lx * syw + lz * cyw - cz, sc, D.yaw, sw, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0.6, 0, 2); });
        list.push([KL, 4]);
      }
      if (list.length) draws += G.draw(r, E, list);
    } else {
      const ent = g.entities; if (ent && ent.beginVox && VR.getVoxModel) {
        let prog = null; const pg = () => prog || (prog = ent.beginVox(r, E));
        const LT = { sky: 1, bl: [0, 0, 0] };
        if (W.vis) {
          const model = VR.getVoxModel(r.gl, 'wu_whale');
          if (model) {
            // (a silhouette far away: inside the far plane at the same angular size)
            let x = W.p[0], y = W.p[1], z = W.p[2], sc = 13.6;
            const dx = x - cx, dy = y - cy, dz = z - cz, d = Math.hypot(dx, dy, dz), far = (cam.far || 300) * 0.8;
            if (d > far) { const k = far / d; x = cx + dx * k; y = cy + dy * k; z = cz + dz * k; sc *= k; }
            ent.drawModel(r, pg(), model, [x, y, z], cam, W.yaw, null, LT, { scale: sc, pitch: W.pitch, roll: W.bank, noShade: true }); draws++;
          }
        }
        if (tr && treeY !== null) { const model = VR.getVoxModel(r.gl, 'wu_tree'); if (model) { ent.drawModel(r, pg(), model, [tr.x, treeY + 1, tr.z], cam, tr.yaw || 0, null, ent.lightAt ? ent.lightAt(tr.x, treeY + 3, tr.z) : LT, { scale: 9.3 }); draws++; } }
        if (D) {
          const model = VR.getVoxModel(r.gl, 'glimmer_deer');
          if (model) { const s = Math.sin(D.walk) * 0.6 * (D.walking ? 1 : 0); ent.drawModel(r, pg(), model, [D.x, D.y, D.z], cam, D.yaw, { leg_fl: [s, 0, 0], leg_br: [s, 0, 0], leg_fr: [-s, 0, 0], leg_bl: [-s, 0, 0] }, LT, { scale: 1.3 * (D.gone > 0 && D.gone < 0.6 ? D.gone / 0.6 : 1) }); draws++; }
        }
      }
    }
    WG.cost.draws = draws; WG.cost.drawMs = WG.cost.drawMs * 0.9 + (performance.now() - t0) * 0.1;
  };
  const WA = VR.Wild && VR.Wild.Actor && VR.Wild.Actor.prototype;
  if (WA && WA.draw && !WA.draw.__wu) {
    const od = WA.draw;
    WA.draw = function (r, E, layer, cam) { od.apply(this, arguments); try { WG.draw(this.g, r, E, layer, cam); } catch (e) { if (!WG.warnedD) { WG.warnedD = true; console.warn('wunder draw', e); } } };
    WA.draw.__wu = true;
  }

  // ================================================================ the light field (High and up): the lanterns
  const LFd = VR.LField;
  if (LFd && LFd.gather && !LFd.gather.__wu) {
    const og = LFd.gather;
    LFd.gather = function (g, f, E, t) {
      const r = og.apply(this, arguments);
      try {
        if (!WG.on(g) || !g._wu) return r;
        const nt = Math.max(0, Math.min(1, (E && E.night) || 0)), R = g._wu, p = g.player;
        const h = p && p.inv && p.inv.held;
        if (h && h.id === 'lantern_seed' && nt > 0.1) { const ep = p.eyePos ? p.eyePos() : [p.pos[0], p.pos[1] + 1.5, p.pos[2]]; f.add(ep[0], ep[1] - 0.5, ep[2], 1.0 * nt, 0.7 * nt, 0.35 * nt, 8); }
        const tr = g.meta.wunder && g.meta.wunder.tree;
        if (tr && nt > 0.2 && Math.hypot(tr.x - f.cx, tr.z - f.cz) < 64) { const y = ground(g.world, tr.x, tr.z); if (y !== null) f.add(tr.x, y + 7, tr.z, 1.1 * nt, 0.75 * nt, 0.35 * nt, 13); }
        const D = R.deer; if (D && Math.hypot(D.x - f.cx, D.z - f.cz) < 64) f.add(D.x, D.y + 2.2, D.z, 0.9, 0.66, 0.34, 8);
        const W = R.whale; if (W.vis && W.mode !== 'route' && Math.hypot(W.p[0] - f.cx, W.p[2] - f.cz) < 64) f.add(W.p[0], W.p[1] - 3, W.p[2], 1.0 * W.glow, 0.7 * W.glow, 0.35 * W.glow, 18);
      } catch (e) { /* the field's own */ }
      return r;
    };
    LFd.gather.__wu = true;
  }

  // ================================================================ the Wanderbuch: „Wundertiere"
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  WG.html = function (g) {
    const R = S(g), m = mem(g), day = g.env.day | 0, C = VR.Chronik, v = g._chr && g._chr.view;
    const rows = [];
    if ((g.meta.vgen | 0) >= 3) { const tonight = WU.whaleVisit(R.seed, day) && g.env.timeOfDay < WU.WHALE.from + WU.WHALE.dur; rows.push(T('g.wu.book.whale', { name: R.names.whale, when: T(tonight ? 'g.wu.book.next' : 'g.wu.book.next2') })); }
    if (m.treeSeen) {
      let where = '', when = '';
      if (C && v) { try { const e = { k: 'tree', c: C.cellOf(v, m.treeSeen.x, m.treeSeen.z), x: m.treeSeen.x, z: m.treeSeen.z, v: {}, d: m.treeSeen.d }; where = C.placeOf(v, e); when = C.when(e, day); } catch (er) { where = ''; } }
      rows.push(T('g.wu.book.tree', { name: R.names.tree, in: where, when }));
    }
    if (m.paths) rows.push(T('g.wu.book.deer', { n: m.paths }));
    return `<div class="wdsec wusec"><h3>🐋 ${esc(T('g.wu.book'))}</h3><div class="note">${esc(T('g.wu.book.note'))}</div>` +
      (rows.length ? rows.map(s => `<div class="chrow"><span class="chtx">${esc(s)}</span></div>`).join('') : `<span class="note">${esc(T('g.wu.book.none'))}</span>`) + '</div>';
  };
  const Wd = VR.Wander;
  if (Wd && Wd.html && !Wd.html.__wu) {
    const oh = Wd.html;
    Wd.html = function (meta) { let h = oh.apply(this, arguments); try { const g = VR.game; if (g && g.meta === meta && WG.on(g)) h = WG.html(g) + h; } catch (e) { /* the book's own */ } return h; };
    Wd.html.__wu = true;
  }

  // ================================================================ the Regie: a lead to the tree once per 2 game days
  if (VR.Regie && VR.Regie.addSource) VR.Regie.addSource(function wunderSource(g) {
    if (!WG.on(g) || !g.meta.wunder || !g.meta.wunder.tree) return null;
    const m = g.meta.wunder, tr = m.tree, p = g.player.pos, day = g.env.day | 0, d = Math.hypot(tr.x - p[0], tr.z - p[2]);
    if (d < 70 || d > 600 || WU.isNight(g.env.timeOfDay) || !WU.canEvent(m, 'lead', day) || !WU.canEvent(m, 'tree', day)) return null;
    return [{ source: 'wunder', act: 'wunder_lead', weight: 2, kind: 'discovery', place: 'wunder', eta: 0, start() {
      WU.markEvent(m, 'lead', day);
      note(g, T('g.wu.lead'), 'wunder:lead', 2);
      const gad = g.gadgets; if (gad && gad.addWaypoint) { try { const y = ground(g.world, tr.x, tr.z); gad.addWaypoint(Math.round(tr.x), (y || 70) + 2, Math.round(tr.z), '🌳 ' + T('g.wu.tree')); } catch (e) { /* the gadget's */ } }
      return true;
    } }];
  });

  WG.test = {
    state: (g) => g._wu, mem, ticks,
    // put the tree at (x, z) (a test's picture); the deer at (x, z) leading to (tx, tz)
    tree: (g, x, z) => { const m = mem(g); m.tree = { x, z, tx: null, tz: null, stood: true, planned: 1e9, rings: [], yaw: 0.6 }; return m.tree; },
    ring: (g, x, z) => placeRing(g, x, z, 5),
    deer: (g, x, z, tx, tz) => { const R = S(g), y = ground(g.world, x, z); R.deer = { x, z, y: (y || 64) + 1, tx, tz, id: 'test', yaw: Math.atan2(-(tx - x), -(tz - z)), walk: 0, t: 0, gone: 0 }; return R.deer; },
  };
})(VR);

// ============================================================================
// r-chronik · VR.ChronikGame — the Chronik in the game (plan docs/superpowers/plans/2026-11-07-r-chronik.md). The
// world simulation runs in worker 0 (worker_main.js job 'chronik', the rules in src/shared/chronik.js); this glue:
//   the clock    every 3 s of play, when ≥ 5 game minutes passed, a step job (env.day / env.ticks); the first job
//                loads meta.chronik (or starts the region round the player) and catches up the days you were away
//   the save     meta.chronik = the worker's latest compact save (saveMeta writes meta as it is)
//   the readers  the Wanderbuch's „Chronik" section (the last events with icons) · gossip: a villager with nothing
//                else to say quotes a Chronik event near the village (once per event and village) · wildheart: a
//                family the Chronik placed is there when you come near (mother and young, Balanced and up) · the Regie:
//                one small lead a game day at most (a waypoint to a new building or a family) · the player's deeds
//                (Gossip's deeds, a befriended animal, a joined dance) go into the ledger · a finished building
//                project builds the village's next lot (villages.js buildStep) when its chunks are loaded, else waits
//   the weather  the Chronik's front over you hints the next weather slot (Weather.chronik; single player only)
// Switch ⚙ Spiel „Chronik" (chronik, default on). Host only (a guest has none). Cost 🟢 on every preset: per frame one
// subtraction; the work is the worker's; the replies (≈ 3 s apart) a few loops over ≤ 60 events.
// Test API: VR.ChronikGame.test (stepNow, view, spawned, said, lastBuilt).
// ============================================================================
(function (VR) {
  'use strict';
  const C = VR.Chronik; if (!C || !VR.Game) return;
  const CG = VR.ChronikGame = VR.ChronikGame || {};
  const T = (k, v, fb) => (VR.I18N ? VR.I18N.t(k, v, fb) : (fb !== undefined ? fb : k));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hs = (s) => { s = String(s); let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x | 0; };
  if (VR.Settings && VR.Settings.add && !(VR.Settings.byKey && VR.Settings.byKey('chronik'))) { try { VR.Settings.add({ key: 'chronik', g: 'play', sec: 'play', t: 'switch', lab: 'g.set.chronik', tip: 'g.set.chronik.tip', cost: 'low', def: true }); } catch (e) { /* the panel's */ } }
  CG.STEP = 3; CG.WAIT = 6; CG.MINSTEP = 5; CG.FAM_R = 70; CG.FAM_MAX = 3; CG.LEAD_R = 700;
  CG.cost = { frames: 0, ms: 0, replies: 0, replyMs: 0, worker: 0 };
  CG.said = []; CG.spawned = []; CG.lastBuilt = null;
  const minutes = (g) => (g.env.day | 0) * 1440 + Math.floor((g.env.ticks || 0) * 1440 / 24000);
  CG.on = (g) => !!(g && g.meta && !g.meta.guest && g.pool && g.env && g.world && g.dim === 'overworld' && g.meta.type !== 'flat' && !(g.settings && g.settings.chronik === false));
  const S = (g) => { const key = (g.meta && g.meta.id) + ':' + g.dim + ':' + (g.world ? g.world.seed : ''); if (!g._chr || g._chr.key !== key) g._chr = { key, st: 'new', acc: 0, busy: false, view: null, took: [], tried: {}, lastT: -1, leadDay: -99, lead: null, famT: 0 }; return g._chr; };

  // ---------------------------------------------------------------- the clock
  CG.frame = function (g, dt) {
    if (!CG.on(g)) return;
    const R = S(g);
    if (R.st === 'off' || R.busy) return;
    if ((R.acc += dt) < CG.STEP) { if (R.lead) CG.leadCheck(g, R); return; }
    if (R.st === 'new' && ((R.age = (R.age || 0) + R.acc) < CG.WAIT || (g.pool.busy | 0) > 0)) { R.acc = 0; return; }   // (the first job waits for the world's first chunks: the workers idle, ≥ 6 s of play)
    R.acc = 0;
    const t0 = performance.now();
    if (R.st === 'new') CG.send(g, R, 'init');
    else if (minutes(g) - R.lastT >= CG.MINSTEP) CG.send(g, R, 'step');
    CG.cost.frames++; CG.cost.ms += performance.now() - t0;
  };
  CG.send = function (g, R, op, extra) {
    const p = g.player && g.player.pos;
    const msg = Object.assign({ type: 'chronik', op, day: g.env.day | 0, tod: g.env.ticks || 0, px: p ? p[0] : 0, pz: p ? p[2] : 0, took: R.took.splice(0) }, extra || {});
    if (op === 'init') { msg.save = g.meta.chronik || null; msg.seed = hs(String(g.meta.seed)); msg.ox = Math.round(p ? p[0] : 0); msg.oz = Math.round(p ? p[2] : 0); }
    R.busy = true; R.lastT = minutes(g);
    const t1 = performance.now();
    g.pool.direct(0, msg, null, (m) => {
      R.busy = false;
      if (g._chr !== R) return;   // (another world meanwhile)
      CG.cost.workerMs = performance.now() - t1; CG.cost.workerSim = m && m.ms;
      try { CG.reply(g, R, m, op); } catch (e) { if (!CG.warned) { CG.warned = true; console.warn('chronik', e); } }
    });
  };
  CG.reply = function (g, R, m, op) {
    const t0 = performance.now();
    if (!m || m.off || m.type !== 'chronik') { R.st = 'off'; return; }
    R.st = 'ready'; R.view = m.view; R.wx = m.wx || null;
    if (m.save) g.meta.chronik = m.save;
    if (op === 'init' && m.days >= 1 && m.events && m.events.length) {
      // while you were away: the most important event of the catch-up, one calm line
      const best = m.events.slice().sort((a, b) => b.imp - a.imp || b.i - a.i)[0];
      if (best && VR.Quiet && VR.Quiet.note) VR.Quiet.note(T('g.ch.away', { ev: C.text(best, R.view) }), 2, 'chronik:away');
    }
    for (const o of m.out || []) if ((R.tried[o.e] | 0) < 40) { const r = CG.build(g, o); if (r === true) R.took.push(o.e); else if (r === 'tried') R.tried[o.e] = (R.tried[o.e] | 0) + 1; }   // (a village not near yet: it waits, uncounted)
    CG.families(g, R);
    CG.weather(g, R);
    CG.cost.replies++; CG.cost.replyMs += performance.now() - t0;
  };
  // a step now (the test, the Zeitraffer's end): the next frame sends it
  CG.stepNow = function (g) { const R = S(g); R.acc = CG.STEP; R.lastT = -1e9; };

  // ---------------------------------------------------------------- a finished building → the village's next lot
  CG.build = function (g, o) {
    const V = g.villages; if (!V || !V.known) return false;
    const vil = V.known.get(o.vid);
    if (!vil) return false;   // (not met yet: it waits in the Chronik's queue)
    const P = vil.plan, st = vil.st;
    const free = P.lots.findIndex((l, i) => !(st.built || []).includes(i));
    if (!st.proj && free < 0) { CG.lastBuilt = { vid: o.vid, k: o.k, lot: -1 }; return true; }   // every lot built: it lives in the ledger
    if (!vil.active) return false;
    if (!st.proj) st.proj = { lot: free, i: 0 };
    const li = st.proj.lot, lot = P.lots[li];
    let guard = 0, r = null;
    V.selfEdit = true;
    try { while (guard++ < 6000) { r = V.buildStep(vil, true); if (!r || r.done) break; if (r.wait) break; } } finally { V.selfEdit = false; }
    if (r && r.done) { CG.lastBuilt = { vid: o.vid, k: o.k, lot: li, at: lot ? (lot.door || lot.outside || [P.x, P.y, P.z]) : [P.x, P.y, P.z], name: vil.name }; return true; }
    return 'tried';
  };

  // ---------------------------------------------------------------- families where the Chronik says they live
  CG.families = function (g, R) {
    const H = g.companions && g.companions.heart, E = g.entities, p = g.player && g.player.pos;
    if (!H || !H.on || !E || !E.summon || !p || !R.view) return;
    CG.spawned = CG.spawned.filter(s => s.mom && !s.mom.dead && !s.mom.removed && Math.hypot(s.mom.pos[0] - p[0], s.mom.pos[2] - p[2]) < 140);
    if (CG.spawned.length >= CG.FAM_MAX) return;
    const done = R.famDone || (R.famDone = new Set());
    const v = R.view, w = g.world;
    for (const f of v.fam) {
      if (done.has(f.i)) continue;
      const cx = v.ox + ((f.c % 25) - C.R) * C.CELL + C.CELL / 2, cz = v.oz + (Math.floor(f.c / 25) - C.R) * C.CELL + C.CELL / 2;
      if (Math.hypot(cx - p[0], cz - p[2]) > CG.FAM_R + C.CELL / 2) continue;
      // open grass in the cell, not in your face (≥ 14 m), the nearest of a few hashed tries to the cell's centre
      let at = null;
      for (let k = 0; k < 12 && !at; k++) {
        const x = Math.floor(cx + (C.h01(f.i, k, 1) - 0.5) * 56), z = Math.floor(cz + (C.h01(f.i, k, 2) - 0.5) * 56);
        if (!w.isLoaded(x, z) || Math.hypot(x - p[0], z - p[2]) < 14) continue;
        const y = w.topAt(x, z), b = w.getBlock(x, y, z), F = VR.F, RT = VR.R && VR.R.T;
        if (RT && F && (RT.flags[b] & F.SOLID) && !(RT.flags[b] & F.FLUID) && !(RT.flags[w.getBlock(x, y + 1, z)] & F.SOLID)) at = [x + 0.5, y + 1, z + 0.5];
      }
      if (!at) continue;
      const kind = C.MOB[f.sp]; if (!kind) { done.add(f.i); continue; }
      const mom = E.summon(kind, at[0], at[1], at[2]); if (!mom) continue;
      const kids = [];
      for (let k = 0; k < Math.min(3, f.n || 1); k++) { const kd = E.summon(kind, at[0] + (k + 1) * 0.9, at[1], at[2] + (k % 2 ? 0.6 : -0.6)); if (kd) kids.push(kd); }
      try { H.family(mom, kids); } catch (e) { /* the heart's */ }
      mom.chronik = f.i;
      done.add(f.i); CG.spawned.push({ i: f.i, sp: f.sp, mom, kids, at });
      if (VR.EventLog && VR.EventLog.emit) { try { VR.EventLog.emit('encounter', 'chronik_family', 2, at, 'chronik', 3); } catch (e) { /* the log's */ } }
      if (CG.spawned.length >= CG.FAM_MAX) break;
    }
  };

  // ---------------------------------------------------------------- the weather: the front over you
  CG.weather = function (g, R) {
    const wx = g.env && g.env.wx; if (!wx) return;
    const solo = !(g.mp && g.mp.isHost) && !g.meta.guest;
    const f = R.wx;
    if (!(solo && f && f.k < 0.85)) { wx.chronik = null; return; }
    if (!wx.chronik || wx.chronik.id !== f.id) wx.chronik = { kind: f.kind === 'storm' ? 'gewitter' : f.kind === 'snow' ? 'schnee' : 'regen', id: f.id };   // (the same front keeps its object: the weather stamps its slot on it)
  };

  // ---------------------------------------------------------------- deeds of the player
  CG.deed = function (g, kind, o) {
    if (!CG.on(g)) return;
    const R = S(g); if (R.st !== 'ready') return;
    const p = g.player && g.player.pos; o = o || {};
    CG.send(g, R, 'deed', { kind, x: Math.round(o.x !== undefined ? o.x : p ? p[0] : 0), z: Math.round(o.z !== undefined ? o.z : p ? p[2] : 0), sp: o.sp, who: o.who, pl: o.pl });
  };
  const G = VR.Gossip;
  if (G && G.deed && !G.deed.__chr) {
    const od = G.deed;
    G.deed = function (g, kind, o) { const d = od.apply(this, arguments); try { if (d) CG.deed(g, kind, { x: d.x, z: d.z, pl: d.pl }); } catch (e) { /* the Chronik's */ } return d; };
    G.deed.__chr = true;
  }
  const WH = VR.WildHeart;
  if (WH && WH.prototype.eat && !WH.prototype.eat.__chr) {
    const oe = WH.prototype.eat;
    WH.prototype.eat = function (m) {
      const was = m && m.wh && m.wh.bond ? m.wh.bond.state : null;
      const r = oe.apply(this, arguments);
      try { if (m && m.wh && m.wh.bond && m.wh.bond.state === 'friend' && was !== 'friend') { const sp = Object.keys(C.MOB).find(k => C.MOB[k] === m.kind); CG.deed(this.g, 'befriend', { x: m.pos[0], z: m.pos[2], sp: sp || 'fox' }); } } catch (e) { /* the Chronik's */ }
      return r;
    };
    WH.prototype.eat.__chr = true;
  }
  const F4 = VR.Folk4;
  if (F4 && F4.join && !F4.join.__chr) {
    const oj = F4.join;
    F4.join = function (V) { const r = oj.apply(this, arguments); try { const g = V && V.g; const day = g && g.env ? g.env.day | 0 : 0; if (g && CG.danceDay !== day) { CG.danceDay = day; CG.deed(g, 'dance'); } } catch (e) { /* the Chronik's */ } return r; };
    F4.join.__chr = true;
  }

  // ---------------------------------------------------------------- gossip quotes the Chronik
  // the newest event of weight ≥ 3 within 1.2 km of the village, not yet told there
  CG.newsFor = function (g, vil, told) {
    const R = g._chr; if (!R || !R.view) return null;
    const ev = R.view.ev, x = vil.plan.x, z = vil.plan.z, day = g.env.day | 0;
    for (let i = ev.length - 1; i >= 0; i--) {
      const e = ev[i]; if (e.imp < 3 || day - e.d > 6) continue;
      if (Math.hypot(e.x - x, e.z - z) > 1200) continue;
      if (told(e)) continue;
      return e;
    }
    return null;
  };
  if (G && G.lookVillage && !G.lookVillage.__chr) {
    const ol = G.lookVillage;
    G.lookVillage = function (V, vil, rec, t, tod, day) {
      const r = ol.apply(this, arguments);
      if (r) return r;
      try {
        const g = V.g; if (!CG.on(g) || V._gsPlay) return r;
        const vid = 'chr/' + vil.id;
        const e = CG.newsFor(g, vil, (x) => G.wasTold(rec, vid, 'chr', 'e' + x.i));
        if (!e) return r;
        const p = g.player.pos;
        let best = null, bd = 1e9;
        for (const a of vil.agents) {
          if (a.kid || a.pose === 'sleep' || a.bubble || a === V.talking || (a.act && a.act.type === 'arrive')) continue;
          const d = (a.pos[0] - p[0]) ** 2 + (a.pos[2] - p[2]) ** 2; if (d < 3 * 3 || d > 16 * 16) continue;
          if (d < bd) { bd = d; best = a; }
        }
        if (!best) return r;
        G.once(rec, vid, 'chr', 'e' + e.i);
        const text = T('g.ch.gs.' + (((best.p.seed >>> 0) + e.i) % 3), { ev: C.text(e, g._chr.view) });
        best.say(text, 6); best.greeted = true; best.talkCool = Math.max(best.talkCool || 0, 8);
        best.lookAt = [p[0], p[1] + 1.5, p[2]];
        CG.said.push({ t: Date.now(), who: best.p.id, vid: vil.id, e: e.i, text }); if (CG.said.length > 20) CG.said.shift();
        if (G.log) { G.log.push({ t: Date.now(), who: best.p.id, what: 'chronik', text }); if (G.log.length > 30) G.log.shift(); }
        return true;
      } catch (e) { return r; }
    };
    G.lookVillage.__chr = true;
  }

  // ---------------------------------------------------------------- the Regie: one small lead a game day
  CG.leadCheck = function (g, R) {
    const L = R.lead, p = g.player && g.player.pos; if (!L || !p) return;
    if (Math.hypot(L.x - p[0], L.z - p[2]) < 22) {
      R.lead = null;
      if (VR.Quiet && VR.Quiet.note) VR.Quiet.note(T('g.ch.leadDone'), 2, 'chronik:lead');
      const gad = g.gadgets; if (gad && gad.waypoints && L.wp) { const i = gad.waypoints.indexOf(L.wp); if (i >= 0) gad.waypoints.splice(i, 1); }
      if (VR.Wander && VR.Wander.note) VR.Wander.note(g.meta, 'places', 'chr:' + L.e, L.name || '');
    } else if ((g.env.day | 0) - L.day > 2) R.lead = null;
  };
  if (VR.Regie && VR.Regie.addSource) VR.Regie.addSource(function chronikSource(g) {
    if (!CG.on(g)) return null;
    const R = g._chr; if (!R || !R.view || R.lead) return null;
    const day = g.env.day | 0; if (day === R.leadDay) return null;
    const p = g.player.pos, ev = R.view.ev;
    let pick = null;
    for (let i = ev.length - 1; i >= 0; i--) {
      const e = ev[i]; if (day - e.d > 2) break;
      if ((e.k === 'built' || e.k === 'born' || e.k === 'bloom' || e.k === 'fell') && Math.hypot(e.x - p[0], e.z - p[2]) < CG.LEAD_R && Math.hypot(e.x - p[0], e.z - p[2]) > 40) { pick = e; break; }
    }
    if (!pick) return null;
    return [{ source: 'chronik', act: 'chronik_lead', weight: 2, kind: 'discovery', place: 'chronik', eta: 0, start() {
      R.leadDay = day;
      const text = C.text(pick, R.view);
      if (VR.Quiet && VR.Quiet.note) VR.Quiet.note(T('g.ch.lead', { ev: text }), 2, 'chronik:lead');
      let wp = null; const gad = g.gadgets, y = g.world.topAt(Math.floor(pick.x), Math.floor(pick.z)) + 1;
      if (gad && gad.addWaypoint) { try { wp = gad.addWaypoint(Math.round(pick.x), y, Math.round(pick.z), '📜 ' + C.placeOf(R.view, pick).replace(/^(im|am|in der|auf der|auf dem|an der|in|on|at|bei|near) /, '')); } catch (e) { wp = null; } }
      R.lead = { e: pick.i, x: pick.x, z: pick.z, day, wp, name: C.placeOf(R.view, pick) };
      return true;
    } }];
  });

  // ---------------------------------------------------------------- the Wanderbuch's Chronik page
  CG.html = function (g, n) {
    const R = g && g._chr, v = R && R.view;
    const list = v ? v.ev.slice(-(n || 12)).reverse() : [];
    const day = g && g.env ? g.env.day | 0 : 0;
    const rows = list.map(e => `<div class="chrow"><span class="chico">${C.icon(e)}</span><span class="chtx">${esc(C.text(e, v))}</span><span class="chwhen">${esc(C.when(e, day))}</span></div>`).join('');
    return `<div class="wdsec chsec"><h3>📜 ${esc(T('g.ch.title'))} <span class="note">${v ? v.ev.length : 0}</span></h3><div class="note">${esc(T('g.ch.note'))}</div>` +
      `<div class="chlist">${rows || `<span class="note">${esc(T('g.ch.none'))}</span>`}</div></div>`;
  };
  const W = VR.Wander;
  if (W && W.html && !W.html.__chr) {
    const oh = W.html;
    W.html = function (meta) { let h = oh.apply(this, arguments); try { const g = VR.game; if (g && g.meta === meta && CG.on(g)) h = CG.html(g) + h; } catch (e) { /* the book's own */ } return h; };
    W.html.__chr = true;
    if (typeof document !== 'undefined' && document.head) {
      const st = document.createElement('style');
      st.textContent = '#wanderbuch .chlist{margin-top:6px}#wanderbuch .chrow{display:flex;gap:8px;align-items:baseline;padding:3px 0;border-bottom:1px solid rgba(255,226,160,.12)}' +
        '#wanderbuch .chico{width:22px;text-align:center;font-size:16px}#wanderbuch .chtx{flex:1;font-size:14px;line-height:1.35}#wanderbuch .chwhen{opacity:.65;font-size:12px;white-space:nowrap}';
      document.head.appendChild(st);
    }
  }

  // ---------------------------------------------------------------- the frame hook
  const op = VR.Game.prototype.playFrame;
  if (!op.__chr) {
    VR.Game.prototype.playFrame = function (dt) { const r = op.apply(this, arguments); try { CG.frame(this, dt); } catch (e) { if (!CG.warned) { CG.warned = true; console.warn('chronik', e); } } return r; };
    VR.Game.prototype.playFrame.__chr = true;
  }
  CG.test = { view: (g) => (g._chr ? g._chr.view : null), state: (g) => (g._chr ? g._chr.st : 'none') };
})(VR);

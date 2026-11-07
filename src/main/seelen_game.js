// ============================================================================
// r-seelen · VR.SeelenGame — villagers with memory in the game (plan docs/superpowers/plans/2026-11-07-r-seelen.md; the
// rules are src/shared/seelen.js). villages.js is not edited: everything wraps.
//   senses     two villagers a frame (round robin): they see you, a storm, a Wundertier near the village, a monster;
//              the Chronik's new events near their village, a finished building (everyone), a talk, a gift, help, a
//              hit, a shared moment (folk4's tag / picnic / feeding / dance, folk5's lantern walk), a hug
//   reflection a sleeping villager thinks the day over once a night (S.reflect) — beliefs, ≤ 3
//   plans      once a game day per village: every villager's five slots (S.plan), a friend's meeting made mutual; the
//              village's schedule (villages.js schedule()) stays the executor — the plan only replaces a free hour
//              (a stroll, the plaza, the park, the lunch, the walk home before 12300) with its own: se_meet (meet a
//              friend · the quarrel's spat with turned backs · the shared bench · the peace gift), se_admire (stand at
//              the new building, show it to you), se_sky (watch for the whale at dusk)
//   storms     a storm-fearing villager hurries home when the front comes (faster, a word)
//   friends    one who counts you a friend walks up to you (once a game day) and greets you with a memory
//   speech     the greeting near you, the talk window's hello, „Wie geht's?“ and the goodbye come from the memories
//   the book   the Wanderbuch's „Menschen“ section: who you know, how they feel about you, their last words
// Save: meta.seelen (S.save — compact, capped) written in Game.saveMeta. Host only (a guest has none).
// Cost 🟢 on every preset (no GL): per frame two villagers' senses (a few comparisons), once a second a village look,
// once a game day the plans; SG.cost keeps the measured ms. Switch ⚙ Spiel „Bewohner mit Gedächtnis“ (settings.seelen).
// Test API: VR.SeelenGame.test.
// ============================================================================
(function (VR) {
  'use strict';
  const S = VR.Seelen; if (!S || !VR.Villages) return;
  const SG = VR.SeelenGame = VR.SeelenGame || {};
  const P = VR.Villages.prototype;
  const T = (k, v, fb) => (VR.I18N ? VR.I18N.t(k, v, fb) : (fb !== undefined ? fb : k));
  const TL = (k) => (VR.I18N && VR.I18N.list ? VR.I18N.list(k) : []);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  if (VR.Settings && VR.Settings.add && !(VR.Settings.byKey && VR.Settings.byKey('seelen'))) { try { VR.Settings.add({ key: 'seelen', g: 'play', sec: 'play', t: 'switch', lab: 'g.set.seelen', tip: 'g.set.seelen.tip', cost: 'low', def: true }); } catch (e) { /* the settings' own */ } }
  SG.PER_FRAME = 2; SG.COME_R = 28; SG.GREET_GAP = 360;   // villagers sensed a frame · a friend comes from this far · game minutes between two memory greetings
  SG.cost = { frames: 0, ms: 0, max: 0, sensed: 0, plans: 0, reflect: 0, said: 0, tickMax: 0, wantMax: 0 };
  SG.log = [];
  const FREE = { stroll: 1, plaza: 1, park: 1, lunch: 1, garden: 1, cafe: 1, learn: 1 };
  SG.on = (g) => !!(g && !SG.off && g.meta && !g.meta.guest && !(g.mp && g.mp.isClient) && !(g.settings && g.settings.seelen === false));
  const now = (g) => (g.env.day | 0) * S.DAY + Math.floor((g.env.timeOfDay || 0) * S.DAY / 24000);
  const dayOf = (g) => g.env.day | 0;
  const pidOf = (g, a) => (g.dim || 'overworld') + '/' + a.p.id;
  const lid = (p) => p.home + ':' + p.idx;
  const d2 = (a, p) => (a.pos[0] - p[0]) ** 2 + (a.pos[2] - p[2]) ** 2;
  const night = (tod) => tod >= 13000 && tod < 23300;
  const R0 = (g) => {
    const key = (g.meta.id || '') + ':' + (g.world ? g.world.seed : '');
    if (!g._se || g._se.key !== key) g._se = { key, d: S.load(g.meta.seelen), G: new Map(), plans: new Map(), rr: 0, vt: 0, chr: {}, qTried: {}, build: {}, come: null, comeT: -1e9, wu: {} };
    return g._se;
  };
  SG.state = R0;
  SG.mind = function (g, a) { const R = R0(g), id = pidOf(g, a); let m = R.d.p[id]; if (!m) { m = R.d.p[id] = S.newMind(); } if (!m.nm) { m.nm = a.name; m.vn = a.vil.name || ''; } return m; };
  const peopleOf = (vil) => vil.people.filter(p => !p.visit).map(p => ({ id: lid(p), fam: p.fam, home: p.home, role: p.role, age: p.age }));
  SG.graph = function (g, vil) {
    const R = R0(g); let G = R.G.get(vil.id);
    if (!G || G.n !== vil.people.length) { G = S.newGraph(peopleOf(vil), R.d.r[vil.id] || (R.d.r[vil.id] = {})); G.n = vil.people.length; R.G.set(vil.id, G); }
    return G;
  };
  const note = (g, a, k, o) => { if (!a || !a.p || a.guest) return null; const m = SG.mind(g, a); return S.note(m, k, now(g), o); };
  SG.note = note;
  const agentByLid = (vil, id) => { for (const o of vil.agents) if (!o.guest && lid(o.p) === id) return o; return null; };
  const personByLid = (vil, id) => vil.people.find(p => lid(p) === id) || null;

  // ---------------------------------------------------------------- the words' context
  SG.ctx = function (g, a, extra) {
    const vil = a.vil, mind = SG.mind(g, a), t = now(g), R = R0(g);
    const wuName = (k) => { const W = g._wu; const n = W && W.names ? W.names[k] : ''; return T('g.se.wu.' + (k === 'tree' || k === 'deer' ? k : 'whale'), { n: n || '' }).replace(/\s+$/, ''); };
    const c = {
      mind, now: t, name: pname(g), me: a.p.name, meId: lid(a.p), q: R.d.q[vil.id] || null,
      who: (id) => { const p = personByLid(vil, id); return p ? p.name : ''; },
      item: (id) => { const k = 'g.se.it.' + id, s = T(k, null, ''); if (s && s !== k) return s; if (/poppy|tulip|orchid|allium|bluet|daisy|rose|lily|flower/.test(id)) return T('g.se.it.flower'); return T('g.se.it.any', { n: VR.itemName ? VR.itemName(id) : id }); },
      wunder: wuName,
      thing: (b) => { const k = 'g.se.b.' + (b || 'home'), s = T(k, null, ''); return s && s !== k ? s : T('g.se.b.home'); },
      ev: (arg) => { const C = VR.Chronik, v = g._chr && g._chr.view; if (!C || !v) return ''; const i = +String(arg).slice(1); const e = v.ev.find(x => x.i === i); return e ? C.text(e, v) : ''; },
      moment: (k) => T('g.se.mo.' + (S.MOMENTS.indexOf(k) >= 0 ? k : 'fest')),
      topic: (n) => { const L = TL('g.se.topic'); return L.length ? L[(n | 0) % L.length] : ''; },
      when: (min) => (min < 180 ? T('g.se.when.now') : min < 600 ? T('g.se.when.today') : min < 2400 ? T('g.se.when.yesterday') : T('g.se.when.days', { n: Math.max(2, Math.round(min / S.DAY)) })),
      stormNear: stormy(g) > 0.15,
    };
    // friends (for gossip): the minds of the two closest
    const G = SG.graph(g, vil), ids = vil.people.map(lid);
    c.friends = S.friendsOf(G, lid(a.p), 2, ids).map(f => { const o = agentByLid(vil, f.w); return { w: f.w, mind: o ? SG.mind(g, o) : null }; }).filter(f => f.mind);
    return Object.assign(c, extra || {});
  };
  function pname(g) { const n = (g.settings && g.settings.playerName) || g.playerName; return n && String(n).trim() ? String(n).trim().slice(0, 24) : T('g.talk.traveler'); }
  const seedNow = (a, g, k) => S.h32(a.p.seed | 0, (now(g) / 7) | 0, k | 0);
  const lastWords = (g, a, text) => { const m = SG.mind(g, a); if (!m.pl) m.pl = S.newPl(); m.pl.lw = String(text).slice(0, 100); };
  const said = (a, text, kind) => { SG.cost.said++; SG.log.push({ t: Date.now(), who: a.p.id, kind, text }); if (SG.log.length > 40) SG.log.shift(); };

  // ---------------------------------------------------------------- the weather and the wonders
  function stormy(g) { const E = g.env; if (!E) return 0; const f = E.wx && E.wx.front ? E.wx.front : 0; return Math.max(f, (E.thunder | 0) > 0 ? 1 : 0, SG.forceStorm || 0); }
  SG.stormy = stormy;
  function wunderNear(g, vil) {
    const W = g._wu; if (!W) return '';
    const P0 = vil.plan;
    if (W.whale && W.whale.vis > 0.5 && W.whale.p && Math.hypot(W.whale.p[0] - P0.x, W.whale.p[2] - P0.z) < 260) return 'whale';
    if (W.deer && Math.hypot(W.deer.x - P0.x, W.deer.z - P0.z) < 70) return 'deer';
    const tr = g.meta.wunder && g.meta.wunder.tree; if (tr && tr.stood && Math.hypot(tr.x - P0.x, tr.z - P0.z) < 130) return 'tree';
    return '';
  }

  // ---------------------------------------------------------------- the senses (two villagers a frame)
  function sense(V, a, R) {
    const g = V.g, vil = a.vil, t = now(g), tod = g.env.timeOfDay, m = SG.mind(g, a);
    SG.cost.sensed++;
    if (a.pose === 'sleep') {
      const day = dayOf(g);
      if (m.rd !== day && m.m.length) { S.reflect(m, t, day); SG.cost.reflect++; }
      return;
    }
    const p = g.player.pos;
    if (d2(a, p) < 12 * 12) S.note(m, 'seen', t, { w: 'pl' });
    const st = stormy(g);
    if (st > 0.6 && !night(tod)) S.note(m, 'storm', t, { i: 4 + ((a.p.seed >>> 3) % 4) + (a.p.trait === 'shy' ? 1 : 0) });
    const wu = R.wu[vil.id];
    if (wu) S.note(m, 'wunder', t, { a: wu, i: 6 + ((a.p.seed >>> 5) & 1) });
    if (a.act && a.act.type === 'hide') S.note(m, 'danger', t, {});
  }

  // ---------------------------------------------------------------- once a second: the villages
  function villageTick(V, vil, R) {
    const g = V.g, day = dayOf(g), tod = g.env.timeOfDay;
    R.wu[vil.id] = wunderNear(g, vil);
    // the Chronik's new events near the village: the curious and a third of the others heard of them
    const v = g._chr && g._chr.view;
    if (v && v.ev && v.ev.length) {
      const last = R.chr[vil.id] === undefined ? (v.ev.length ? v.ev[Math.max(0, v.ev.length - 3)].i - 1 : -1) : R.chr[vil.id];
      let top = last;
      for (const e of v.ev) {
        if (e.i <= last) continue; top = Math.max(top, e.i);
        if ((e.imp | 0) < 3 || Math.hypot(e.x - vil.plan.x, e.z - vil.plan.z) > 1200) continue;
        const ours = e.k === 'built' && e.v && e.v.vil === vil.name;
        for (const a of vil.agents) {
          if (a.guest) continue;
          if (ours) note(g, a, 'build', { a: e.v.b || 'home' });
          else if (a.p.trait === 'curious' || (S.h32(a.p.seed, e.i, 61) % 3) === 0) note(g, a, 'chronik', { a: 'e' + e.i, i: Math.min(8, 2 + (e.imp | 0) / 2) });
        }
        if (ours) R.build[vil.id] = { at: CGlastAt(g, vil) || [vil.plan.plaza.x, vil.plan.plaza.y, vil.plan.plaza.z], k: e.v.b || 'home', d: day };
      }
      R.chr[vil.id] = top;
    }
    // the quarrel: one at a time, perhaps one a day; the machine runs on (the timeouts carry it while unseen)
    const G = SG.graph(g, vil);
    let q = R.d.q[vil.id];
    if (q && q.ph !== 'done') { const ph = q.ph; S.qCatch(q, day, tod); if (q.ph !== ph) onPhase(V, vil, q, ph); }
    if ((!q || (q.ph === 'done' && (q.at | 0) < day)) && R.qTried[vil.id] !== day && !night(tod)) {
      R.qTried[vil.id] = day;
      const nq = S.qPick(G, peopleOf(vil), day, vil.plan.seed | 0);
      if (nq) { R.d.q[vil.id] = q = nq; R.plans.delete(vil.id); }
    }
    // the day's plans
    // a friend comes to you
    friendComes(V, vil, R);
  }
  function CGlastAt(g, vil) { const CG = VR.ChronikGame, L = CG && CG.lastBuilt; return L && L.vid === vil.id && L.at ? L.at : null; }
  function onPhase(V, vil, q, was) {
    const g = V.g, R = R0(g);
    R.plans.delete(vil.id);
    const A = agentByLid(vil, q.a), B = agentByLid(vil, q.b);
    if (q.ph === 'done' && was !== 'done') {
      const G = SG.graph(g, vil); S.share(G, q.a, q.b, 'made_up');
      if (A) note(g, A, 'made_up', { w: q.b }); if (B) note(g, B, 'made_up', { w: q.a });
    }
  }
  // the day's plans: made one villager at a time when the schedule asks (no frame makes a village's all at once)
  function makePlans(V, vil, R, day) {
    const g = V.g, W = g._wu, WU = VR.Wunder;
    const out = { day, by: {}, vil, ids: vil.people.map(lid), whale: !!(W && WU && WU.whaleVisit && (g.meta.vgen | 0) >= 3 && WU.whaleVisit(W.seed, day)) };
    R.plans.set(vil.id, out);
    return out;
  }
  function rawPlan(g, R, PL, p) {
    const vil = PL.vil, id = lid(p), m = R.d.p[(g.dim || 'overworld') + '/' + p.id] || null;
    SG.cost.plans++;
    return S.plan({ seed: p.seed | 0, day: PL.day, kid: p.age === 'child', elder: p.age === 'elder', role: p.role, mind: m, friends: S.friendsOf(SG.graph(g, vil), id, 2, PL.ids), q: R.d.q[vil.id] || null, me: id, whale: PL.whale });
  }
  function planFor(g, R, PL, p) {
    const id = lid(p); let P0 = PL.by[id];
    if (P0 && P0.ok) return P0;
    if (!P0) P0 = PL.by[id] = rawPlan(g, R, PL, p);
    P0.ok = true;
    // a meeting needs two: the friend's slot becomes the same meeting (when it was free), else this one is dropped
    for (let i = 0; i < P0.length; i++) {
      const s = P0[i]; if (s.a !== 'meet') continue;
      let o = PL.by[s.w];
      if (!o) { const op = personByLid(PL.vil, s.w); if (!op || op.visit) { s.a = null; s.why = ''; s.w = ''; continue; } o = PL.by[s.w] = rawPlan(g, R, PL, op); }
      const so = o[i];
      if (so.a === 'meet' && so.w === id) continue;
      if (so.a === null || (so.a === 'meet' && !o.ok)) { so.a = 'meet'; so.why = 'friend'; so.w = id; } else { s.a = null; s.why = ''; s.w = ''; }
    }
    return P0;
  }
  SG.planOf = (g, a) => { const R = R0(g); let PL = R.plans.get(a.vil.id); if (!PL || PL.day !== dayOf(g)) PL = makePlans(g.villages, a.vil, R, dayOf(g)); return planFor(g, R, PL, a.p); };

  // ---------------------------------------------------------------- the plan feeds the schedule
  const bSched = P.schedule;
  P.schedule = function (a, tod) {
    const w = bSched.apply(this, arguments);
    const t0 = performance.now();
    try { return SG.want(this, a, tod, w); } catch (e) { return w; } finally { const dd = performance.now() - t0; SG.cost.ms += dd; if (dd > SG.cost.wantMax) SG.cost.wantMax = dd; }
  };
  SG.want = function (V, a, tod, w) {
    const g = V.g;
    if (!SG.on(g) || a.guest || !a.p) return w;
    if (a.seCome) return 'se_come';
    // a storm-fearing villager hurries home when the front comes
    const m = g._se && g._se.d.p[pidOf(g, a)];
    const fear = m && S.has(m, 'fearStorm');
    if (fear && w !== 'sleep' && w !== 'patrol' && stormy(g) > 0.15) { hurry(V, a, true); return 'home'; }
    if (a.seHurry) hurry(V, a, false);
    if (w === 'sleep' || w === 'school' || w === 'patrol' || w === 'breakfast') return w;
    const PL = SG.planOf(g, a), s = PL && S.slotAt(PL, tod);
    if (!s || !s.a || s.used) return w;
    const free = FREE[w] || (w === 'home' && tod < 12300) || (w === 'play' && a.kid) || (w === 'work' && (s.a === 'gift' || s.a === 'spat' || s.a === 'bench') && tod >= 5600 && tod < 6900);
    if (!free) return w;
    a.seSlot = s;
    if (s.a === 'admire') return R0(g).build[a.vil.id] ? 'se_admire' : w;
    if (s.a === 'skywatch') return tod >= 10600 ? 'se_sky' : w;
    if (s.a === 'news') return 'plaza';
    return 'se_meet';
  };
  function hurry(V, a, on) {
    if (on && !a.seHurry) {
      a.seHurry = true; a.seSpeed0 = a.speed; a.speed = a.speed * 1.55;
      if (V.near && V.near(a, 24) && !a.bubble) { const c = SG.ctx(V.g, a), r = S.beat('hurry', c, TL, seedNow(a, V.g, 3)); a.say(r.text, 3); said(a, r.text, 'hurry'); }
    } else if (!on && a.seHurry) { a.seHurry = false; if (a.seSpeed0) a.speed = a.seSpeed0; }
  }

  // ---------------------------------------------------------------- the acts: se_meet, se_admire, se_sky, se_come
  const bRun = P.runAct;
  P.runAct = function (a, dt, tod) {
    const t = a.act && a.act.type;
    if (t === 'se_meet' || t === 'se_admire' || t === 'se_sky' || t === 'se_come') {
      try { a.act.t += dt; if (t === 'se_meet') runMeet(this, a, dt); else if (t === 'se_admire') runAdmire(this, a, dt); else if (t === 'se_sky') runSky(this, a, dt); else runCome(this, a, dt); }
      catch (e) { a.act = null; a.seCome = false; if (!SG.warned) { SG.warned = true; console.warn('seelen act', e); } }
      return;
    }
    return bRun.apply(this, arguments);
  };
  // the meeting place of two: a point on the plaza's ring (the same for both), each half a step to one side
  function meetSpot(vil, A, B, mode) {
    const pz = vil.plan.plaza, key = S.key(A, B), h = S.hs(key + vil.id);
    const seats = pz.seats || [];
    if (mode === 'bench' && seats.length >= 2) {
      const s0 = seats[h % seats.length];
      let s1 = null, bd = 1e9; for (const s of seats) { if (s === s0) continue; const dd = (s[0] - s0[0]) ** 2 + (s[2] - s0[2]) ** 2 + (s[1] - s0[1]) ** 2 * 4; if (dd < bd) { bd = dd; s1 = s; } }
      if (s1 && bd <= 9) return { seat: A < B ? [s0, s1] : [s1, s0] };
    }
    const an = (h % 628) / 100, r = 3 + (h >>> 10) % 3;
    const cx = pz.x + 0.5 + Math.cos(an) * r, cz = pz.z + 0.5 + Math.sin(an) * r;
    const tx = -Math.sin(an) * 0.6, tz = Math.cos(an) * 0.6;
    return { c: [cx, pz.y, cz], pts: A < B ? [[cx - tx, cz - tz], [cx + tx, cz + tz]] : [[cx + tx, cz + tz], [cx - tx, cz - tz]] };
  }
  // the scene is over: the one who drives it moves the quarrel on (spat, bench: the smaller id; gift: the giver)
  function finishBeat(V, a, s, mode) {
    const g = V.g, vil = a.vil, q = R0(g).d.q[vil.id], me = lid(a.p);
    const driver = mode === 'gift' ? (q ? q.g === me : me < s.w) : me < s.w;
    if (driver && q && q.ph === mode && (mode === 'spat' || mode === 'bench' || mode === 'gift')) { const was = q.ph; S.qStep(q, { day: dayOf(g), tod: g.env.timeOfDay, beat: true }); onPhase(V, vil, q, was); }
    s.used = true; a.act.done = true; a.seBack = false; if (a.pose === 'talk') a.pose = 'stand';
  }
  function runMeet(V, a, dt) {
    const g = V.g, act = a.act, vil = a.vil, s = a.seSlot;
    if (!s || !s.w) { act.done = true; return; }
    const me = lid(a.p), mode = s.a, other = agentByLid(vil, s.w);
    if (act.slot !== s) { for (const k of ['spot', 'tw', 'wait', 'met', 's1', 's2', 'noted', 'k', 'arr']) delete act[k]; act.slot = s; act.t = 0; if (a.pose === 'sit') a.pose = 'stand'; }
    if (!act.spot) act.spot = meetSpot(vil, me, s.w, mode);
    const sp = act.spot, mine = sp.seat ? sp.seat[0] : null;
    let arrived;
    if (sp.seat && a.pose !== 'sit' && act.t > 25) { act.spot = meetSpot(vil, me, s.w, 'meet'); return; }   // (the bench out of reach: they stand together instead)
    if (sp.seat) {
      if (a.pose === 'sit') arrived = true;
      else if (V.goTo(a, mine[0], mine[1], mine[2], 0.8)) {
        for (const o of vil.agents) if (o !== a && o.pose === 'sit' && Math.abs(o.pos[0] - mine[0] - 0.5) < 0.8 && Math.abs(o.pos[2] - mine[2] - 0.5) < 0.8) { o.pose = 'stand'; o.act = null; o.thinkT = 0; }   // (someone on their bench gets up for them)
        V.sit(a, mine); arrived = a.pose === 'sit';
      }
    }
    else { const pt = sp.pts[0]; arrived = V.goTo(a, Math.floor(pt[0]), sp.c[1], Math.floor(pt[1]), 0.9); }
    if (act.t > 150) { s.used = true; act.done = true; return; }
    if (!arrived) return;
    if (!sp.seat) { a.vel[0] *= 0.5; a.vel[2] *= 0.5; }
    act.arr = true;
    const there = other && other.act && other.act.type === 'se_meet' && other.act.arr && other.seSlot && other.seSlot.w === me && d2(other, a.pos) < 3.2 * 3.2;
    if (!there && act.tw > 0) { finishBeat(V, a, s, mode); return; }   // (the other one's part is over: so is this one's)
    if (!there) { a.lookAt = other ? [other.pos[0], other.pos[1] + 1.4, other.pos[2]] : null; if ((act.wait = (act.wait || 0) + dt) > 70) { s.used = true; act.done = true; } return; }
    act.tw = (act.tw || 0) + dt;
    const lead = me < s.w;   // (the one with the smaller id drives the scene's words)
    const near = V.near && V.near(a, 22);
    const R = R0(g), q = R.d.q[vil.id];
    const say = (kind, v) => { if (!near) return; const r = S.beat(kind, SG.ctx(g, a), TL, seedNow(a, g, kind.length + (act.k = (act.k | 0) + 1)), v); a.say(r.text, 3.2); said(a, r.text, kind); };
    const face = (away) => { const dx = other.pos[0] - a.pos[0], dz = other.pos[2] - a.pos[2]; a.lookAt = away ? [a.pos[0] - dx * 3, a.pos[1] + 1.4, a.pos[2] - dz * 3] : [other.pos[0], other.pos[1] + 1.4, other.pos[2]]; };
    if (mode === 'meet') {
      face(false); a.pose = a.pose === 'sit' ? 'sit' : 'talk';
      if (!act.met) { act.met = true; note(g, a, 'hug', { w: s.w }); if (lead) { S.share(SG.graph(g, vil), me, s.w, 'hug'); say('meet', { who: other.p.name }); } }
      if (act.tw > 40) { s.used = true; act.done = true; a.pose = 'stand'; }
      return;
    }
    if (mode === 'spat') {
      if (act.tw < 6) { face(false); a.pose = 'talk'; if (!act.s1 && (lead ? act.tw > 0.3 : act.tw > 1.8)) { act.s1 = true; say('q.spat'); } }
      else { face(true); a.pose = 'stand'; a.seBack = true; if (!act.s2 && act.tw > 8 + (lead ? 0 : 1.2)) { act.s2 = true; say('q.cold'); } }
      if (!act.noted) { act.noted = true; note(g, a, 'quarrel', { w: s.w, a: q ? q.tp : 0 }); if (lead) S.share(SG.graph(g, vil), me, s.w, 'quarrel'); }
      if (act.tw > 22) finishBeat(V, a, s, mode);
      return;
    }
    if (mode === 'bench') {
      a.lookAt = act.tw < 8 ? [a.pos[0] - Math.sin(a.yaw) * 4, a.pos[1] + 1.2, a.pos[2] - Math.cos(a.yaw) * 4] : [other.pos[0], other.pos[1] + 1.4, other.pos[2]];
      if (!act.s1 && act.tw > (lead ? 4 : 9)) { act.s1 = true; say('q.bench'); }
      if (act.tw > 18) finishBeat(V, a, s, mode);
      return;
    }
    if (mode === 'gift') {
      face(false); a.pose = 'talk';
      const giver = q ? q.g === me : lead;
      if (giver && !act.s1 && act.tw > 0.5) { act.s1 = true; say('q.gift'); a.waveT = 1.4; if (g.particles && g.particles.glow) for (let k = 0; k < 10; k++) g.particles.glow((a.pos[0] + other.pos[0]) / 2 + (Math.random() - 0.5) * 0.6, a.pos[1] + 1.3 + Math.random() * 0.6, (a.pos[2] + other.pos[2]) / 2 + (Math.random() - 0.5) * 0.6, [1, 0.35, 0.55], 1.6, 0.09, 0.8); }
      if (!giver && !act.s1 && act.tw > 2.4) { act.s1 = true; say('q.thanks'); a.waveT = 1.2; note(g, a, 'fgift', { w: s.w, a: 'poppy' }); }
      if (act.tw > 14) finishBeat(V, a, s, mode);
    }
  }
  function runAdmire(V, a, dt) {
    const g = V.g, act = a.act, b = R0(g).build[a.vil.id], s = a.seSlot;
    if (!b) { if (s) s.used = true; act.done = true; return; }
    if (!act.spot) { const h = S.h32(a.p.seed, 71, 1), an = (h % 628) / 100; act.spot = [Math.floor(b.at[0] + Math.cos(an) * 3.5), b.at[1], Math.floor(b.at[2] + Math.sin(an) * 3.5)]; }
    if (V.goTo(a, act.spot[0], act.spot[1], act.spot[2], 1.4)) {
      a.lookAt = [b.at[0] + 0.5, b.at[1] + 2.5, b.at[2] + 0.5]; a.pose = 'stand';
      const p = g.player.pos;
      if (d2(a, p) < 10 * 10 && !act.shown && !a.bubble) { act.shown = true; const r = S.beat('show', SG.ctx(g, a), TL, seedNow(a, g, 5), { thing: SG.ctx(g, a).thing(b.k) }); a.say(r.text, 4); a.waveT = 1.2; said(a, r.text, 'show'); lastWords(g, a, r.text); }
      if ((act.st = (act.st || 0) + dt) > 45) { if (s) s.used = true; act.done = true; }
    } else if (act.t > 90) { if (s) s.used = true; act.done = true; }
  }
  function runSky(V, a, dt) {
    const g = V.g, act = a.act, pz = a.vil.plan.plaza, s = a.seSlot;
    if (!act.spot) { const an = (S.h32(a.p.seed, 73, 1) % 628) / 100; act.spot = [Math.floor(pz.x + Math.cos(an) * 5), pz.y, Math.floor(pz.z + Math.sin(an) * 5)]; }
    if (V.goTo(a, act.spot[0], act.spot[1], act.spot[2], 1.4)) {
      a.pose = 'stand'; if (!act.up) act.up = [a.pos[0] - Math.sin(a.yaw) * 3, a.pos[1] + 7, a.pos[2] - Math.cos(a.yaw) * 3]; a.lookAt = act.up;
      if (!act.said && V.near && V.near(a, 16) && Math.random() < dt * 0.05) { act.said = true; const c = SG.ctx(g, a), r = S.beat('sky', c, TL, seedNow(a, g, 7), { wunder: c.wunder('whale') }); a.say(r.text, 3.5); said(a, r.text, 'sky'); }
      if ((act.st = (act.st || 0) + dt) > 80) { if (s) s.used = true; act.done = true; }
    }
  }
  function runCome(V, a, dt) {
    const g = V.g, act = a.act, p = g.player.pos;
    if (act.t > 40 || V.talking === a) { endCome(V, a); return; }
    if (d2(a, p) > 2.4 * 2.4) { if (!act.go || act.t - act.go > 1.5) { act.go = act.t; a.path = null; a.goal = null; } V.goTo(a, Math.floor(p[0]), Math.floor(p[1]), Math.floor(p[2]), 2.0); if (!act.called && act.t > 0.4 && V.near && V.near(a, 30)) { act.called = true; const r = S.beat('come', SG.ctx(g, a), TL, seedNow(a, g, 9)); a.say(r.text, 2.6); a.waveT = 1.5; said(a, r.text, 'come'); } return; }
    a.vel[0] = 0; a.vel[2] = 0; a.lookAt = [p[0], p[1] + 1.5, p[2]]; a.pose = 'talk';
    if (!act.greet) { act.greet = act.t; SG.greet(V, a, true); }
    if (act.t - act.greet > 6) endCome(V, a);
  }
  function endCome(V, a) { a.seCome = false; a.act = null; a.thinkT = 0; a.pose = 'stand'; const R = R0(V.g); if (R.come === a) R.come = null; }
  function friendComes(V, vil, R) {
    const g = V.g; if (R.come || V.talking || (g.ui && g.ui.blocking) || night(g.env.timeOfDay)) return;
    const t = now(g); if (t - R.comeT < 120) return;
    const p = g.player.pos, day = dayOf(g);
    let best = null, bs = -1;
    for (const a of vil.agents) {
      if (a.guest) continue;
      if (a.pose === 'sleep' || !a.act || a.act.type === 'talk' || a.act.type === 'hide' || a.act.type === 'f4' || a.act.type === 'joy' || a.act.type === 'se_meet' || a.act.type === 'outing' || a.act.type === 'gsvisit' || a.act.type === 'gsplay') continue;
      const dd = d2(a, p); if (dd < 7 * 7 || dd > SG.COME_R * SG.COME_R) continue;
      const m = R.d.p[pidOf(g, a)]; if (!m || !m.pl || m.cd === day) continue;
      const sc = S.feelScore(m.pl); if (S.feelRank(S.feel(m.pl)) < 4 || sc <= bs) continue;
      bs = sc; best = a;
    }
    if (!best) return;
    const m = SG.mind(g, best); m.cd = day; R.come = best; R.comeT = t;
    best.seCome = true; V.setAct(best, { type: 'se_come' });
  }

  // ---------------------------------------------------------------- the greeting with a memory
  // true → said: the line from the memories (and the wave of folk4)
  SG.greet = function (V, a, force) {
    const g = V.g; if (!SG.on(g) || !a || !a.p || a.guest || a.kid && !force && !SG.mind(g, a).pl) return false;
    const m = SG.mind(g, a), t = now(g);
    S.plMeet(m, t);
    if (!force && t - (m.gt === undefined ? -1e9 : m.gt) < SG.GREET_GAP) return false;
    const r = S.greet(SG.ctx(g, a), TL, seedNow(a, g, 1));
    if (!r || (!force && r.key.indexOf('g.se.gr.feel.') === 0 && !(m.pl && m.pl.n > 1))) return false;   // (a plain word: folk4's own greeting says it better the first time)
    m.gt = t;
    const p = g.player.pos;
    a.say(r.text, 4.2); a.greeted = true; a.waveT = Math.max(a.waveT || 0, 1.3); a.lookAt = [p[0], p[1] + 1.5, p[2]]; a.talkCool = Math.max(a.talkCool || 0, 6);
    lastWords(g, a, r.text); said(a, r.text, 'greet:' + r.key);
    if (VR.Folk4 && VR.Folk4.hello) { try { VR.Folk4.hello(V, a, true); } catch (e) { /* the wave is folk4's */ } }
    return true;
  };
  const G0 = VR.Gossip || (VR.Gossip = {});
  if (!G0.se) {
    const bh = G0.hello;
    G0.hello = function (V, a) {
      try { const g = V && V.g; if (g && SG.on(g) && a && a.p && !V.talking && !(g.ui && g.ui.blocking) && !a.guest && SG.mind(g, a).pl && SG.greet(V, a, false)) return true; } catch (e) { /* the old greetings below */ }
      return bh ? bh.apply(this, arguments) : false;
    };
    G0.se = true;
  }

  // ---------------------------------------------------------------- the talk window
  const bTalk = P.openTalk;
  P.openTalk = function (a) {
    const out = bTalk.apply(this, arguments);
    try {
      const g = this.g;
      if (SG.on(g) && a && a.p && !a.guest) {
        const m = SG.mind(g, a), t = now(g);
        S.plMeet(m, t); S.note(m, 'talk', t, { w: 'pl' });
        const r = S.greet(SG.ctx(g, a), TL, seedNow(a, g, 2));
        if (r && r.key.indexOf('g.se.gr.feel.') !== 0 && (a.vil.st.rep || 0) >= -4) { this.talkText(r.text); lastWords(g, a, r.text); said(a, r.text, 'talk:' + r.key); }
        const el = document.getElementById('tk_role');
        if (el && m.b.length && !el.querySelector('.sebl')) {
          const c = SG.ctx(g, a);
          const words = m.b.map(b => T('g.se.bl.' + b.b, { thing: c.thing(b.a), wunder: c.wunder(b.a), who: c.who(b.w) })).filter(s => s.indexOf('{') < 0);
          if (words.length) { const sp = document.createElement('span'); sp.className = 'sebl note'; sp.textContent = ' · ' + words.join(' · '); el.appendChild(sp); }
        }
      }
    } catch (e) { /* the talk is open */ }
    return out;
  };
  const bChat = P.chatLine;
  P.chatLine = function (a) {
    const base = bChat.apply(this, arguments);
    try {
      const g = this.g;
      if (SG.on(g) && a && a.p && !a.guest) {
        const k = (this._seChat = (this._seChat | 0) + 1);
        const r = S.chat(SG.ctx(g, a), TL, S.h32(a.p.seed, k, 3));
        if (r && (k % 4) !== 0) { lastWords(g, a, r.text); said(a, r.text, 'chat:' + r.key); return r.text; }
      }
    } catch (e) { /* the old line */ }
    return base;
  };
  const bClose = P.closeTalk;
  P.closeTalk = function () {
    const a = this.talking;
    const out = bClose.apply(this, arguments);
    try { const g = this.g; if (a && SG.on(g) && a.p && !a.guest) { const r = S.bye(SG.ctx(g, a), TL, seedNow(a, g, 4)); a.say(r.text, 2.8); lastWords(g, a, r.text); said(a, r.text, 'bye'); } } catch (e) { /* the old goodbye */ }
    return out;
  };
  const bGift = P.gift;
  P.gift = function (a) {
    const g = this.g, inv = g.player && g.player.inv, held = inv && inv.held, id = held && held.id, n0 = id && inv.count ? inv.count(id) : 0;
    const q = a && a.vil && a.vil.st.quests && a.vil.st.quests[a.p.id], was = !!(q && q.done);
    const out = bGift.apply(this, arguments);
    try {
      if (id && SG.on(g) && a && a.p && !a.guest) {
        const helped = !!(q && !was && q.done), gave = helped || (inv.count ? inv.count(id) < n0 : false);
        if (gave) { const m = SG.mind(g, a), t = now(g); S.note(m, helped ? 'helped' : 'gift', t, { a: id, w: 'pl' }); S.plAdd(m, helped ? 'h' : 'g', t); }
      }
    } catch (e) { /* the gift is given */ }
    return out;
  };
  const bHit = P.onHit;
  P.onHit = function (a, from) {
    const out = bHit.apply(this, arguments);
    try { const g = this.g, p = g.player && g.player.pos; if (SG.on(g) && a && a.p && !a.guest && from && p && Math.hypot(from[0] - p[0], from[2] - p[2]) < 6) { const m = SG.mind(g, a), t = now(g); S.note(m, 'hurt', t, { w: 'pl' }); S.plAdd(m, 'x', t); } } catch (e) { /* hit anyway */ }
    return out;
  };
  // hugs and chats between neighbours (villages.js social)
  const bSocial = P.social;
  P.social = function (a) {
    const was = a.act;
    const out = bSocial.apply(this, arguments);
    try {
      const g = this.g, act = a.act;
      if (act && act !== was && act.type === 'talk' && act.with && act.t === 0 && SG.on(g) && !a.guest && !act.with.guest) {
        const o = act.with, G = SG.graph(g, a.vil);
        S.share(G, lid(a.p), lid(o.p), act.hug ? 'hug' : 'talk');
        if (act.hug) { note(g, a, 'hug', { w: lid(o.p) }); note(g, o, 'hug', { w: lid(a.p) }); }
      }
    } catch (e) { /* they talk anyway */ }
    return out;
  };
  // a house finished: the whole village is proud
  const bDone = P.onHouseDone;
  P.onHouseDone = function (vil, li, quiet) {
    const out = bDone.apply(this, arguments);
    try {
      const g = this.g;
      if (SG.on(g) && !quiet && vil && vil.active) {
        const lot = vil.plan.lots[li], at = lot ? (lot.door || lot.outside) : null;
        R0(g).build[vil.id] = { at: at || [vil.plan.plaza.x, vil.plan.plaza.y, vil.plan.plaza.z], k: 'home', d: dayOf(g) };
        for (const a of vil.agents) note(g, a, 'build', { a: 'home' });
      }
    } catch (e) { /* built anyway */ }
    return out;
  };
  // folk4's moments: everyone in it shared it (the graph, a memory of the one beside them); a dance you joined
  const F4 = VR.Folk4;
  if (F4 && F4.begin && !F4.begin.__se) {
    const ob = F4.begin;
    F4.begin = function (V, vil, kind) {
      const M = ob.apply(this, arguments);
      try {
        const g = V && V.g;
        if (M && SG.on(g) && M.members && M.members.length > 1) {
          const L = M.members.filter(a => a && a.p && !a.guest), G = SG.graph(g, vil);
          for (let i = 0; i < L.length; i++) {
            const o = L[(i + 1) % L.length];
            note(g, L[i], 'moment', { a: kind, w: lid(o.p) });
            for (let j = i + 1; j < L.length && j < i + 4; j++) S.share(G, lid(L[i].p), lid(L[j].p), kind);
          }
        }
      } catch (e) { /* the moment is on */ }
      return M;
    };
    F4.begin.__se = true;
    const oe = F4.end;
    F4.end = function (V, M) {
      try {
        const g = V && V.g, X = M || (V && V._f4M);
        if (X && X.kind === 'dance' && X.joined && SG.on(g)) for (const a of X.members || []) { if (!a || !a.p || a.guest) continue; const m = SG.mind(g, a), t = now(g); S.note(m, 'danced', t, { w: 'pl' }); S.plAdd(m, 'd', t); }
      } catch (e) { /* ends anyway */ }
      return oe.apply(this, arguments);
    };
  }

  // ---------------------------------------------------------------- the frame
  const bUpd = P.update;
  P.update = function (dt) {
    bUpd.call(this, dt);
    const g = this.g;
    if (!SG.on(g) || !g.env || !g.player) return;
    const t0 = performance.now();
    try {
      const R = R0(g), A = this.agents, n = A.length;
      if (n) for (let k = 0; k < SG.PER_FRAME; k++) { const a = A[(R.rr = (R.rr + 1) % n)]; if (a && !a.guest && a.p && a.vil && a.vil.active) sense(this, a, R); }
      if ((R.vt += dt) >= 1) { R.vt = 0; const t1 = performance.now(); for (const vil of this.known.values()) if (vil.active) villageTick(this, vil, R); const dd = performance.now() - t1; if (dd > SG.cost.tickMax) SG.cost.tickMax = dd; }
    } catch (e) { if (!SG.warned) { SG.warned = true; console.warn('seelen', e); } }
    const ms = performance.now() - t0;
    SG.cost.frames++; SG.cost.ms += ms; if (ms > SG.cost.max) SG.cost.max = ms;
  };
  // ---------------------------------------------------------------- the save
  if (VR.Game && VR.Game.prototype.saveMeta && !VR.Game.prototype.saveMeta.__se) {
    const os = VR.Game.prototype.saveMeta;
    VR.Game.prototype.saveMeta = function () { try { if (this._se && this.meta && !this.meta.guest && SG.on(this)) this.meta.seelen = S.save(this._se.d); } catch (e) { /* the save goes on */ } return os.apply(this, arguments); };
    VR.Game.prototype.saveMeta.__se = true;
  }

  // ---------------------------------------------------------------- the Wanderbuch: „Menschen“
  SG.html = function (g, n) {
    const R = R0(g), dim = (g.dim || 'overworld') + '/';
    const L = [];
    for (const id of Object.keys(R.d.p)) { const m = R.d.p[id]; if (!m.pl || !m.pl.n || id.indexOf(dim) !== 0) continue; L.push([S.feelScore(m.pl), m.pl.t, id, m]); }
    L.sort((x, y) => (y[0] - x[0]) || (y[1] - x[1]));
    const rows = L.slice(0, n || 10).map(([sc, tt, id, m]) => {
      const f = S.feel(m.pl), hearts = Math.max(0, Math.min(5, S.feelRank(f)));
      const bl = (m.b || []).map(b => { const s = T('g.se.bl.' + b.b, { thing: T('g.se.b.' + (b.a || 'home'), null, ''), wunder: T('g.se.wu.' + (b.a === 'tree' || b.a === 'deer' ? b.a : 'whale'), { n: (g._wu && g._wu.names && g._wu.names[b.a || 'whale']) || '' }), who: b.w ? whoName(g, id, b.w) : '' }); return s.indexOf('{') < 0 ? s : ''; }).filter(Boolean);
      const facts = [T('g.se.book.met', { n: m.pl.n })]; if (m.pl.g) facts.push(T('g.se.book.gifts', { n: m.pl.g }));
      return `<div class="serow"><div class="sehd"><b>${esc(m.nm || '?')}</b> <span class="note">${esc(m.vn || '')}</span><span class="seft"><span style="color:#ff6a8a">${'♥'.repeat(hearts)}</span><span style="opacity:.25">${'♥'.repeat(5 - hearts)}</span> ${esc(T('g.se.feel.' + f))}</span></div>` +
        `<div class="note">${esc(facts.concat(bl).join(' · '))}</div>` + (m.pl.lw ? `<div class="selw">„${esc(m.pl.lw)}“</div>` : '') + '</div>';
    }).join('');
    const qs = [];
    for (const vid of Object.keys(R.d.q)) { const q = R.d.q[vid]; if (!q || q.ph === 'done') continue; const V = g.villages, vil = V && V.known && V.known.get(vid); if (!vil) continue; const A = personByLid(vil, q.a), B = personByLid(vil, q.b); if (A && B) qs.push(T('g.se.book.quarrel', { who: A.name, who2: B.name, topic: (TL('g.se.topic')[q.tp] || '') })); }
    return `<div class="wdsec sesec"><h3>🧑‍🤝‍🧑 ${esc(T('g.se.book'))} <span class="note">${L.length}</span></h3><div class="note">${esc(T('g.se.book.note'))}</div>` +
      (rows || `<span class="note">${esc(T('g.se.book.none'))}</span>`) + qs.map(s => `<div class="note seq">⚡ ${esc(s)}</div>`).join('') + '</div>';
  };
  function whoName(g, pid, w) { const V = g.villages; if (!V || !V.known) return ''; const i = pid.indexOf('/'), id = pid.slice(i + 1); for (const vil of V.known.values()) { if (id.indexOf(vil.plan.id + ':') !== 0) continue; const p = personByLid(vil, w); return p ? p.name : ''; } return ''; }
  const Wd = VR.Wander;
  if (Wd && Wd.html && !Wd.html.__se) {
    const oh = Wd.html;
    Wd.html = function (meta) { let h = oh.apply(this, arguments); try { const g = VR.game; if (g && g.meta === meta && SG.on(g)) h = SG.html(g) + h; } catch (e) { /* the book's own */ } return h; };
    Wd.html.__se = true;
    if (typeof document !== 'undefined' && document.head) {
      const st = document.createElement('style');
      st.textContent = '#wanderbuch .serow{padding:5px 0;border-bottom:1px solid rgba(255,226,160,.12)}#wanderbuch .sehd{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}' +
        '#wanderbuch .seft{margin-left:auto;font-size:13px;white-space:nowrap}#wanderbuch .selw{font-style:italic;opacity:.85;font-size:14px;margin-top:2px}#wanderbuch .seq{margin-top:6px}';
      document.head.appendChild(st);
    }
  }

  // ---------------------------------------------------------------- the test API (test/seelen.mjs)
  SG.test = {
    R: () => R0(VR.game),
    mind: (pid) => R0(VR.game).d.p[pid] || null,
    note: (a, k, o) => note(VR.game, a, k, o),
    // a quarrel between two adults of the village near (at the phase asked), their plans now
    quarrel: (vil, a, b, ph) => { const g = VR.game, R = R0(g), q = S.qNew(lid(a.p), lid(b.p), dayOf(g), 1); q.ph = ph || 'spat'; R.d.q[vil.id] = q; R.qTried[vil.id] = dayOf(g); R.plans.delete(vil.id); return q; },
    plans: (vil) => { const g = VR.game, R = R0(g); R.plans.delete(vil.id); const PL = makePlans(g.villages, vil, R, dayOf(g)); for (const p of vil.people) if (!p.visit) planFor(g, R, PL, p); return PL; },
    reflect: (a) => { const g = VR.game, m = SG.mind(g, a); return S.reflect(m, now(g), dayOf(g)); },
    greet: (a) => SG.greet(VR.game.villages, a, true),
    come: (a) => { const V = VR.game.villages, R = R0(VR.game); R.come = a; a.seCome = true; V.setAct(a, { type: 'se_come' }); },
    storm: (v) => { SG.forceStorm = v; },
    build: (vil, at, k) => { R0(VR.game).build[vil.id] = { at, k: k || 'bakery', d: dayOf(VR.game) }; },
    lid, now: () => now(VR.game),
  };
})(VR);

// ============================================================================
// u-gossip · VR.Gossip — news travels and the world remembers you (plan docs/superpowers/plans/2026-11-02-u-gossip.md).
// Inspired by the ideas of a memory stream, importance, reflection and information diffusion among simulated people —
// but plain deterministic game rules: no language model, no network, nothing a player needs an account for.
//   the stream     every deed of the player is one record: kind, world time, place (x, z, world), the place's name and
//                  an importance (freed an outpost 9 · found a fairy place 7 · built a home 6 · helped 5 · a festival 4 ·
//                  a gift 3); its weight fades with a half-life of a few in-game days (G.score); ≤ 40 kept
//   diffusion      the people near it saw it (≤ 150 m: at once); farther villages hear it from travellers and caravans
//                  at ~900 blocks a day (G.heardAt: 0.15 d + distance / speed, a fixed jitter per village); an
//                  important deed reaches far (≤ 5 km), a small one stays close; over the Lichtbrücken the great ones
//                  reach the other worlds a day later
//   the people     who heard of it greets you by it once (a small bubble, ≤ 1 every 18 s, never while you talk to
//                  someone); two neighbours pass it on to each other (once per village and deed); children re-enact
//                  it at play; at a festival the musician sings a two-line verse about it; an elder sums up what the
//                  village thinks of you (the reflection: the kind most of what they heard is of)
//   friends        talking (once a day), gifts and help make friends (levels Bekannt · Freund · enger Freund); a friend
//                  invites you to dinner at dusk (go to their door: a meal, hearts), visits your home some mornings and
//                  leaves a small gift at your door (u-movein's gifts: walk onto it)
// Save: meta.gossip = {v: 1, n, deeds, greeted, told, fr, last} (G.load normalises; an old save has none → fresh).
// Multiplayer: the host keeps the stream and the people's words; a guest does nothing of it.
// Cost 🟢: the glue looks at the people twice a second (one loop over the active villagers), nothing per frame;
// the switch ⚙ settings.gossip. Pure part node-tested (test/gossip.js).
// ============================================================================
(function (VR) {
  'use strict';
  const G = VR.Gossip = VR.Gossip || {};
  G.V = 1; G.DAY = 24000; G.MAXD = 40; G.SPEED = 900; G.WITNESS = 150; G.COOL = 18; G.MAXPEOPLE = 300;
  // importance and half-life (days) per kind
  G.KINDS = { freed: { imp: 9, half: 14 }, fairy: { imp: 7, half: 10 }, home: { imp: 6, half: 9 }, helped: { imp: 5, half: 6 }, fest: { imp: 4, half: 4 }, gift: { imp: 3, half: 3 } };
  G.LV = [0, 4, 10, 22];   // friendship points for Bekannt · Freund · enger Freund
  const h32 = (a, b) => { let x = (Math.imul(a | 0, 0x2c1b3c6d) ^ Math.imul((b | 0) + 0x9e37, 0x297a2d39)) >>> 0; x = Math.imul(x ^ (x >>> 15), 0x85ebca6b) >>> 0; x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0; return (x ^ (x >>> 16)) >>> 0; };
  const hs = (s) => { s = String(s); let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; };
  G.h32 = h32; G.hs = hs;
  const fin = Number.isFinite;
  const isObj = (o) => !!o && typeof o === 'object' && !Array.isArray(o);

  // ---------------------------------------------------------------- the record
  G.fresh = () => ({ v: G.V, n: 0, deeds: [], greeted: {}, told: {}, fr: {}, last: {} });
  G.load = function (o) {
    const r = G.fresh();
    if (!isObj(o) || (o.v | 0) > G.V) return o && (o.v | 0) > G.V ? o : r;   // a newer save's record stays untouched
    r.n = fin(o.n) ? o.n | 0 : 0;
    if (Array.isArray(o.deeds)) for (const d of o.deeds) if (isObj(d) && G.KINDS[d.k] && fin(d.t) && fin(d.x) && fin(d.z)) r.deeds.push({ id: String(d.id || 'd' + r.n++), k: d.k, t: +d.t, x: +d.x, z: +d.z, dim: String(d.dim || 'overworld'), pl: String(d.pl || '').slice(0, 60), imp: fin(d.imp) ? +d.imp : G.KINDS[d.k].imp, key: String(d.key || '') });
    r.deeds = r.deeds.slice(-G.MAXD);
    for (const nm of ['greeted', 'told']) if (isObj(o[nm])) for (const k of Object.keys(o[nm])) if (Array.isArray(o[nm][k])) r[nm][k] = o[nm][k].map(String).slice(-8);
    if (isObj(o.fr)) for (const k of Object.keys(o.fr)) { const f = o.fr[k]; if (isObj(f) && fin(f.p)) r.fr[k] = { p: +f.p, name: String(f.name || '').slice(0, 40), sur: String(f.sur || '').slice(0, 40), vid: String(f.vid || ''), vn: String(f.vn || '').slice(0, 40), day: fin(f.day) ? f.day | 0 : -1, likes: String(f.likes || '') }; }
    if (isObj(o.last)) r.last = Object.assign({}, o.last);
    return r;
  };
  G.save = (rec) => JSON.parse(JSON.stringify(rec));

  // ---------------------------------------------------------------- the stream
  G.score = function (d, t) { const K = G.KINDS[d.k]; const age = Math.max(0, (t - d.t) / G.DAY); return d.imp * Math.pow(0.5, age / (K ? K.half : 5)); };
  // o: {t, x, z, dim, pl, key}: key dedupes (one festival a village a day, one outpost once, one home once)
  G.note = function (rec, kind, o) {
    const K = G.KINDS[kind]; if (!K || !o || !fin(o.t) || !fin(o.x) || !fin(o.z)) return null;
    const key = String(o.key || ''); if (key && rec.deeds.some(d => d.k === kind && d.key === key)) return null;
    const d = { id: 'd' + (rec.n++), k: kind, t: +o.t, x: Math.round(o.x), z: Math.round(o.z), dim: String(o.dim || 'overworld'), pl: String(o.pl || '').slice(0, 60), imp: K.imp, key };
    rec.deeds.push(d);
    if (rec.deeds.length > G.MAXD) { let wi = 0, ws = 1e9; for (let i = 0; i < rec.deeds.length - 1; i++) { const s = G.score(rec.deeds[i], d.t); if (s < ws) { ws = s; wi = i; } } rec.deeds.splice(wi, 1); }
    return d;
  };
  G.reach = (imp) => (imp >= 8 ? 5000 : imp >= 6 ? 2400 : imp >= 4 ? 1200 : 450);
  // when a place {x, z, dim, id} hears of deed d (world time), Infinity if never
  G.heardAt = function (d, site) {
    if (!site) return Infinity;
    const jit = 0.85 + (h32(hs(d.id), hs(site.id || (site.x + ',' + site.z))) % 1000) / 1000 * 0.3;
    if ((site.dim || 'overworld') !== d.dim) return d.imp >= 7 ? d.t + (1 + 0.25 * jit) * G.DAY : Infinity;   // over the Lichtbrücke
    const dist = Math.hypot(site.x - d.x, site.z - d.z);
    if (dist <= G.WITNESS) return d.t;
    if (dist > G.reach(d.imp)) return Infinity;
    return d.t + (0.15 + dist / G.SPEED * jit) * G.DAY;
  };
  // the deeds a place knows of at time t, the weightiest first (faded ones — score < 0.6 — are forgotten)
  G.heard = function (rec, site, t) {
    const out = [];
    for (const d of rec.deeds) { if (G.heardAt(d, site) > t) continue; const s = G.score(d, t); if (s >= 0.6) out.push([s, d]); }
    out.sort((a, b) => b[0] - a[0] || (a[1].id < b[1].id ? -1 : 1));
    return out.map(q => q[1]);
  };
  const push = (o, k, v, cap) => { const L = o[k] || (o[k] = []); if (L.indexOf(v) >= 0) return false; L.push(v); if (L.length > cap) L.shift(); return true; };
  const capKeys = (o, n) => { const ks = Object.keys(o); if (ks.length > n) for (const k of ks.slice(0, ks.length - n)) delete o[k]; };
  // the deed this person greets you by (once per person and deed), or null
  G.greetFor = function (rec, pid, site, t) {
    const L = rec.greeted[pid] || [];
    for (const d of G.heard(rec, site, t)) if (L.indexOf(d.id) < 0) return d;
    return null;
  };
  G.markGreeted = function (rec, pid, did) { const ok = push(rec.greeted, pid, did, 8); capKeys(rec.greeted, G.MAXPEOPLE); return ok; };
  // a village-wide moment (the neighbours' talk, the children's play, the bard, the elder) — true only the first time
  G.once = function (rec, vid, what, did) { const ok = push(rec.told, vid + '|' + what, did, 8); capKeys(rec.told, G.MAXPEOPLE); return ok; };
  G.wasTold = (rec, vid, what, did) => { const L = rec.told[vid + '|' + what]; return !!(L && L.indexOf(did) >= 0); };
  // the reflection: what most of what a place heard is of (≥ 2 deeds), or null
  G.reflect = function (rec, site, t) {
    const H = G.heard(rec, site, t); if (H.length < 2) return null;
    const w = {}; for (const d of H) w[d.k] = (w[d.k] || 0) + G.score(d, t);
    let best = null, bw = 0; for (const k of Object.keys(G.KINDS)) if ((w[k] || 0) > bw) { bw = w[k]; best = k; }
    return best;
  };
  // the words: the key of the line for a deed and a speaker ('greet' · 'tell' · 'reply' · 'kid' · 'kid2' · 'verse' · 'ref')
  G.VAR = { greet: 3, tell: 2, kid: 2, verse: 2 };
  G.lineKey = function (what, kind, seed) { const n = G.VAR[what] || 1; return 'g.gs.' + what + '.' + kind + (n > 1 ? '.' + ((seed >>> 0) % n) : ''); };

  // ---------------------------------------------------------------- friends
  G.level = (p) => (p >= G.LV[3] ? 3 : p >= G.LV[2] ? 2 : p >= G.LV[1] ? 1 : 0);
  // add friendship points; info {name, sur, vid, vn, likes}; returns {lvl, up} (up: a new level was reached)
  G.befriend = function (rec, pid, pts, info) {
    const f = rec.fr[pid] || (rec.fr[pid] = { p: 0, name: '', sur: '', vid: '', vn: '', day: -1, likes: '' });
    const before = G.level(f.p);
    f.p = Math.min(60, f.p + pts);
    if (info) for (const k of ['name', 'sur', 'vid', 'vn', 'likes']) if (info[k]) f[k] = String(info[k]).slice(0, 40);
    capKeys(rec.fr, 120);
    const lvl = G.level(f.p);
    return { lvl, up: lvl > before };
  };
  // the first talk of a day gives a point
  G.talked = function (rec, pid, day, info) { const f = rec.fr[pid]; if (f && f.day === day) return null; const r = G.befriend(rec, pid, 1, info); rec.fr[pid].day = day; return r; };
  G.friends = (rec, min) => Object.keys(rec.fr).filter(k => G.level(rec.fr[k].p) >= (min || 2)).sort();
  // the friend who visits you this morning (about every third day), or null
  G.visitor = function (rec, day) {
    const L = G.friends(rec, 2); if (!L.length || rec.last.visitDay === day) return null;
    if (h32(day, L.length) % 3 !== 0) return null;
    return L[h32(day, 77) % L.length];
  };
  // a friend invites you to dinner today (about every other day), true or false
  G.invites = (rec, pid, day) => G.level((rec.fr[pid] || { p: 0 }).p) >= 2 && rec.last.invDay !== day && h32(hs(pid), day) % 2 === 0;
  G.KEYS = [];   // (filled below: every key the glue uses, test/gossip.js checks both tables)
  for (const k of Object.keys(G.KINDS)) {
    for (const w of ['greet', 'tell', 'kid', 'verse']) for (let i = 0; i < G.VAR[w]; i++) G.KEYS.push('g.gs.' + w + '.' + k + '.' + i);
    G.KEYS.push('g.gs.kid2.' + k, 'g.gs.ref.' + k);
  }
  G.KEYS.push('g.gs.reply.0', 'g.gs.reply.1', 'g.gs.lv.1', 'g.gs.lv.2', 'g.gs.lv.3', 'g.gs.up', 'g.gs.invite', 'g.gs.dinnerT', 'g.gs.dinner', 'g.gs.visit', 'g.gs.you', 'g.gs.fairy', 'g.gs.set.gossip', 'g.gs.set.gossip.tip', 'g.gs.somewhere');

  // ================================================================ the game side (only with a DOM and VR.Villages)
  const Vs = VR.Villages;
  if (!Vs || typeof document === 'undefined') return;
  const P = Vs.prototype;
  const T = (k, v) => (VR.I18N ? VR.I18N.t(k, v) : k);
  const host = (g) => !(g.mp && g.mp.isClient);
  G.on = (g) => !!(g && g.meta && !g.meta.guest && host(g) && !(g.settings && g.settings.gossip === false) && !(g.meta.gossip && (g.meta.gossip.v | 0) > G.V));
  if (VR.Settings && VR.Settings.add && !(VR.Settings.byKey && VR.Settings.byKey('gossip'))) { try { VR.Settings.add({ key: 'gossip', g: 'play', sec: 'play', t: 'switch', lab: 'g.gs.set.gossip', tip: 'g.gs.set.gossip.tip', def: true }); } catch (e) { /* the settings' own */ } }
  const now = (g) => (g.env.day || 0) * G.DAY + g.env.timeOfDay;
  const pname = (g) => { const n = g.settings && g.settings.playerName; return n && String(n).trim() ? String(n).trim().slice(0, 24) : ''; };
  G.rec = function (g) {
    if (!g || !g.meta) return G.fresh();
    if (!g.meta.gossip || g._gsLoaded !== g.meta) { g.meta.gossip = G.load(g.meta.gossip); g._gsLoaded = g.meta; }
    return g.meta.gossip;
  };
  G.cost = { ticks: 0, ms: 0, worst: 0, said: 0 };
  G.log = [];   // the last lines said (the test API, the reel)
  const dimOf = (g) => g.dim || 'overworld';
  const siteOf = (g, vil) => ({ id: dimOf(g) + '/' + vil.id, x: vil.plan.x, z: vil.plan.z, dim: dimOf(g) });
  const pidOf = (g, a) => dimOf(g) + '/' + a.p.id;
  const vars = (g, d, a) => { const nm = pname(g); return { name: nm || T('g.gs.you'), o: d.pl || T('g.gs.somewhere'), v: (a && a.vil && a.vil.name) || '' }; };
  const say = (G0, a, text, dur, what) => { a.say(text, dur || 4.5); G.cost.said++; G.log.push({ t: Date.now(), who: a.p.id, what, text }); if (G.log.length > 30) G.log.shift(); };
  const nearestPlace = (g, x, z) => {
    const V = g.villages; let best = null, bd = 1e18;
    if (V && V.known) for (const vil of V.known.values()) { const d = (vil.plan.x - x) ** 2 + (vil.plan.z - z) ** 2; if (d < bd) { bd = d; best = vil; } }
    return best && bd < 400 * 400 ? best.name : '';
  };
  // a deed of the player (host only)
  G.deed = function (g, kind, o) {
    if (!G.on(g)) return null;
    const p = g.player && g.player.pos; o = o || {};
    const x = fin(o.x) ? o.x : p ? p[0] : 0, z = fin(o.z) ? o.z : p ? p[2] : 0;
    const d = G.note(G.rec(g), kind, { t: now(g), x, z, dim: dimOf(g), pl: o.pl || nearestPlace(g, x, z), key: o.key || '' });
    return d;
  };
  G.friendInfo = (a) => ({ name: a.p.name, sur: a.vil.fams && a.vil.fams[a.p.fam] ? a.vil.fams[a.p.fam].surname : '', vid: a.vil.id, vn: a.vil.name || '', likes: a.p.likes || '' });
  G.addFriend = function (g, a, pts) {
    if (!G.on(g) || !a || !a.p) return null;
    const r = G.befriend(G.rec(g), pidOf(g, a), pts, G.friendInfo(a));
    if (r.up && r.lvl >= 1) { const t = T('g.gs.up', { who: a.p.name, lv: T('g.gs.lv.' + r.lvl) }); if (VR.Quiet && VR.Quiet.note) { try { VR.Quiet.note(t, 2, 'gs:up'); } catch (e) { /* theirs */ } } else if (g.ui && g.ui.hint) g.ui.hint(t, 3600); }
    return r;
  };

  // ---------------------------------------------------------------- the 2-Hz look at the people
  G.tick = function (V, dt) {
    const g = V.g; if (!G.on(g) || !g.player || !g.env) return;
    G.acc = (G.acc || 0) + dt; if (G.acc < 0.5) return; G.acc = 0;
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    const rec = G.rec(g), t = now(g), tod = g.env.timeOfDay, day = g.env.day || 0, p = g.player.pos;
    G.t = (G.t || 0) + 0.5;
    if (!V.talking && !(g.ui && g.ui.blocking)) {
      // a festival you are at
      const fv = V.festivalNear ? V.festivalNear() : null;
      if (fv) G.deed(g, 'fest', { x: fv.plan.x, z: fv.plan.z, pl: fv.name, key: fv.id + '@' + day });
      const quiet = (G.t - (G.lastSay || -1e9)) < G.COOL;
      for (const vil of V.known.values()) {
        if (!vil.active || !vil.agents.length) continue;
        const dv = Math.hypot(p[0] - vil.plan.x, p[2] - vil.plan.z); if (dv > 170) continue;
        if (quiet) break;
        if (G.lookVillage(V, vil, rec, t, tod, day)) { G.lastSay = G.t; break; }
      }
      G.dinner(V, rec, tod, day);
      G.visit(V, rec, tod, day);
    }
    if (t0) { const ms = performance.now() - t0; G.cost.ticks++; G.cost.ms += ms; if (ms > G.cost.worst) G.cost.worst = ms; }
  };
  // one village: at most one moment (a greeting, the neighbours' talk, the children, the bard, the elder)
  G.lookVillage = function (V, vil, rec, t, tod, day) {
    const g = V.g, p = g.player.pos, site = siteOf(g, vil);
    const H = G.heard(rec, site, t); if (!H.length) return false;
    const awake = (a) => a.pose !== 'sleep' && !a.bubble && a !== V.talking && !(a.act && a.act.type === 'arrive');
    const d2 = (a) => (a.pos[0] - p[0]) ** 2 + (a.pos[2] - p[2]) ** 2;
    // the bard: a festival's musician sings a verse (once per village, day and deed)
    const F = vil.fest;
    if (F && F.roles && V.festivalOn && V.festivalOn(vil, tod)) {
      const d = H[0];
      if (!G.wasTold(rec, site.id, 'verse@' + day, d.id)) for (const [a, r] of F.roles) if (r === 'music' && d2(a) < 30 * 30 && !a.bubble) { G.once(rec, site.id, 'verse@' + day, d.id); say(G, a, '♪ ' + T(G.lineKey('verse', d.k, h32(hs(d.id), day)), vars(g, d, a)) + ' ♪', 7, 'verse'); return true; }
    }
    // the greeting: someone near you who heard of a deed and hasn't greeted you by it
    let best = null, bd = 7 * 7;
    for (const a of vil.agents) { if (!awake(a) || a.kid) continue; const q = d2(a); if (q < bd) { bd = q; best = a; } }
    if (best) {
      const pid = pidOf(g, best), d = G.greetFor(rec, pid, site, t);
      if (d) {
        G.markGreeted(rec, pid, d.id);
        // the elder sums it up once the village heard of two or more
        const rk = best.elder ? G.reflect(rec, site, t) : null;
        if (rk && G.once(rec, site.id, 'ref', rk)) say(G, best, T('g.gs.ref.' + rk, vars(g, d, best)), 5.5, 'ref');
        else say(G, best, T(G.lineKey('greet', d.k, best.p.seed), vars(g, d, best)), 5, 'greet');
        best.lookAt = [p[0], p[1] + 1.4, p[2]];
        G.addFriend(g, best, 0);
        return true;
      }
    }
    // the neighbours pass it on: two grown-ups close together, 4–20 m from you
    const d = H.find(x => !G.wasTold(rec, site.id, 'tell', x.id));
    if (d) for (const a of vil.agents) {
      if (!awake(a) || a.kid) continue; const q = d2(a); if (q < 4 * 4 || q > 20 * 20) continue;
      for (const b of vil.agents) {
        if (b === a || !awake(b) || b.kid) continue;
        if ((a.pos[0] - b.pos[0]) ** 2 + (a.pos[2] - b.pos[2]) ** 2 > 3.5 * 3.5) continue;
        G.once(rec, site.id, 'tell', d.id);
        say(G, a, T(G.lineKey('tell', d.k, a.p.seed), vars(g, d, a)), 5, 'tell');
        a.lookAt = [b.pos[0], b.pos[1] + 1.4, b.pos[2]]; b.lookAt = [a.pos[0], a.pos[1] + 1.4, a.pos[2]];
        setTimeout(() => { try { if (!b.bubble) say(G, b, T('g.gs.reply.' + (b.p.seed & 1), vars(g, d, b)), 4, 'reply'); } catch (e) { /* gone */ } }, 2200);
        return true;
      }
    }
    // the children play it: two children at play within 25 m (the weightiest deed only)
    const dk = H[0];
    if (!G.wasTold(rec, site.id, 'kid', dk.id)) {
      const kids = vil.agents.filter(a => a.kid && awake(a) && d2(a) < 25 * 25);
      if (kids.length >= 2) {
        G.once(rec, site.id, 'kid', dk.id);
        const [k1, k2] = kids;
        say(G, k1, T(G.lineKey('kid', dk.k, k1.p.seed), vars(g, dk, k1)), 4.5, 'kid');
        k1.lookAt = [k2.pos[0], k2.pos[1] + 1, k2.pos[2]];
        setTimeout(() => { try { if (!k2.bubble) say(G, k2, T('g.gs.kid2.' + dk.k, vars(g, dk, k2)), 4, 'kid2'); } catch (e) { /* gone */ } }, 2000);
        if (g.particles && g.particles.glow) for (let k = 0; k < 6; k++) g.particles.glow(k1.pos[0] + (Math.random() - 0.5), k1.pos[1] + 1.3 + Math.random() * 0.5, k1.pos[2] + (Math.random() - 0.5), [0.6, 1, 1]);
        return true;
      }
    }
    return false;
  };
  // dinner: a friend in their village invites you at dusk; their door between 10600 and 12600 → a meal
  G.dinner = function (V, rec, tod, day) {
    const g = V.g, p = g.player.pos, inv = rec.last.inv;
    if (inv && inv.day === day && tod >= 10600 && tod < 12600) {
      const dr = inv.door; if (dr && Math.hypot(dr[0] + 0.5 - p[0], dr[2] + 0.5 - p[2]) < 4 && Math.abs(dr[1] - p[1]) < 3) {
        rec.last.inv = null;
        const f = rec.fr[inv.pid];
        if (g.player.inv) { g.player.inv.add('bread', 2); const ok = (id) => !!((VR.itemDef && VR.itemDef(id)) || (VR.R && VR.R.byName[id])); g.player.inv.add(ok('cooked_cod') ? 'cooked_cod' : 'bread', 1); }
        G.befriend(rec, inv.pid, 2, null);
        if (g.ui) g.ui.toast(T('g.gs.dinnerT'), T('g.gs.dinner', { who: f ? f.name : '', fam: f ? f.sur : '' }), null);
        for (const a of V.agents) if (pidOf(g, a) === inv.pid && V.hearts) { V.hearts(a); break; }
        if (g.audio) { try { g.audio.play('pop'); } catch (e) { /* a sound */ } }
      }
      return;
    }
    if (tod < 9000 || tod >= 10600 || rec.last.invDay === day) return;
    for (const a of V.agents) {
      if (a.pose === 'sleep' || a.kid || a.bubble || a === V.talking) continue;
      if ((a.pos[0] - p[0]) ** 2 + (a.pos[2] - p[2]) ** 2 > 8 * 8) continue;
      const pid = pidOf(g, a); if (!G.invites(rec, pid, day)) continue;
      const home = a.vil.homes && a.vil.homes[a.p.home], door = home && (home.outside || home.door); if (!door) continue;
      rec.last.invDay = day; rec.last.inv = { pid, day, door: door.slice(0, 3) };
      say(G, a, T('g.gs.invite', { name: pname(g) || T('g.gs.you'), fam: G.friendInfo(a).sur }), 6, 'invite');
      a.lookAt = [p[0], p[1] + 1.4, p[2]];
      return;
    }
  };
  // a friend visits your home some mornings and leaves a gift at your door (u-movein's gifts carry it)
  G.visit = function (V, rec, tod, day) {
    const g = V.g, MI = VR.MoveIn;
    if (tod < 600 || tod > 5000 || !MI || !MI.rec || rec.last.visitDay === day) return;
    const pid = G.visitor(rec, day); if (!pid) { rec.last.visitDay = day; return; }
    const mr = MI.rec(g), b = g.player.spawnBed, p = g.player.pos;
    let at = null;
    for (const h of mr.homes || []) if (h.st === 'home' && h.outside && (!b || Math.hypot(h.door[0] - b[0], h.door[2] - b[2]) < 12)) { at = h.outside; break; }
    if (!at && b) at = [b[0], b[1], b[2] + 2];
    if (!at || Math.hypot(at[0] - p[0], at[2] - p[2]) > 150) return;   // (they come when you are home)
    rec.last.visitDay = day;
    const y = MI.groundAt && g.world ? MI.groundAt(g.world, at[0], at[1] + 2, at[2], 5) : at[1]; if (y === null || y === undefined) return;
    const f = rec.fr[pid], has = (id) => !!((VR.itemDef && VR.itemDef(id)) || (VR.R && VR.R.byName[id]));
    const it = MI.giftFor ? MI.giftFor(f.likes || '_', h32(hs(pid), day), has) : ['bread', 2];
    (mr.gifts || (mr.gifts = [])).push({ at: [at[0] + 0.5, y, at[2] + 0.5], item: it[0], n: it[1], fam: f.sur, name: f.name });
    const txt = T('g.gs.visit', { who: f.name, v: f.vn });
    if (VR.Quiet && VR.Quiet.note) { try { VR.Quiet.note(txt, 2, 'gs:visit'); } catch (e) { /* theirs */ } } else if (g.ui && g.ui.hint) g.ui.hint(txt, 5000);
  };

  // ---------------------------------------------------------------- hooks (wrapping, nothing edited)
  const baseUpdate = P.update;
  P.update = function (dt) { baseUpdate.call(this, dt); try { G.tick(this, dt); } catch (e) { if (!G.warned) { G.warned = true; console.warn('gossip', e); } } };
  // a gift handed over / a request done
  const baseGift = P.gift;
  if (baseGift) P.gift = function (a) {
    const g = this.g, inv = g.player && g.player.inv, held = inv && inv.held, id = held && held.id, n0 = id && inv.count ? inv.count(id) : 0;
    const q = a && a.vil && a.vil.st.quests && a.vil.st.quests[a.p.id], was = !!(q && q.done), rep0 = a && a.vil ? a.vil.st.rep || 0 : 0;
    const out = baseGift.call(this, a);
    try {
      if (id && G.on(g)) {
        const helped = (q && !was && q.done) || (a.vil.st.rep || 0) - rep0 >= 4;
        const gave = helped || (inv.count ? inv.count(id) < n0 : false);
        if (gave) {
          G.deed(g, helped ? 'helped' : 'gift', { x: a.pos[0], z: a.pos[2], pl: a.vil.name, key: helped ? 'h:' + a.p.id + ':' + (g.env.day || 0) : 'g:' + a.p.id + ':' + (g.env.day || 0) });
          G.addFriend(g, a, helped ? 5 : 3);
        }
      }
    } catch (e) { /* the gift is given */ }
    return out;
  };
  // a talk: a friendship point a day, the level beside the role
  const baseTalk = P.openTalk;
  if (baseTalk) P.openTalk = function (a) {
    const out = baseTalk.apply(this, arguments);
    try {
      const g = this.g;
      if (G.on(g) && a && a.p && a.vil) {
        const rec = G.rec(g), pid = pidOf(g, a);
        const r = G.talked(rec, pid, g.env.day || 0, G.friendInfo(a)), f = rec.fr[pid];
        if (r && r.up && r.lvl >= 1) G.addFriend(g, a, 0);
        const lv = f ? G.level(f.p) : 0, el = document.getElementById('tk_role');
        if (el && lv >= 1 && !/♥/.test(el.textContent)) el.textContent += ' · ♥ ' + T('g.gs.lv.' + lv);
      }
    } catch (e) { /* the talk is open */ }
    return out;
  };
  // the outpost freed (liberate_fest's celebration), a home moved into (u-movein), a fairy place found
  const LF = VR.LibFest;
  if (LF && LF.celebrate && !LF.celebrate.__gs) {
    const oc = LF.celebrate;
    LF.celebrate = function (g, s) { const r = oc.apply(this, arguments); try { if (s && G.on(g)) G.deed(g, 'freed', { x: s.x, z: s.z, pl: VR.Liberate && VR.Liberate.nameOf ? VR.Liberate.nameOf(s) : '', key: String(s.id) }); } catch (e) { /* freed anyway */ } return r; };
    LF.celebrate.__gs = true;
  }
  const MI = VR.MoveIn;
  if (MI && MI.moveIn && !MI.moveIn.__gs) {
    const om = MI.moveIn;
    MI.moveIn = function (V, h) { const r = om.apply(this, arguments); try { if (r && h && h.door && V && G.on(V.g)) G.deed(V.g, 'home', { x: h.door[0], z: h.door[2], pl: r.vil && r.vil.name, key: h.door.join(',') }); } catch (e) { /* moved in */ } return r; };
    MI.moveIn.__gs = true;
  }
  const W = VR.Wander;
  if (W && !(W.found && W.found.__gs)) {
    const of = W.found;
    W.found = function (kind, id) {
      try { const g = VR.game; if (kind === 'fairy' && g && G.on(g)) { const S = VR.Fairy && VR.Fairy.state, s = S && S.sites ? S.sites.find(q => q.id === id) : null; G.deed(g, 'fairy', { x: s ? s.x : undefined, z: s ? s.z : undefined, pl: s ? T('g.fairy.place.' + s.kind) : T('g.gs.fairy'), key: String(id) }); } } catch (e) { /* found anyway */ }
      return of ? of.apply(this, arguments) : undefined;
    };
    W.found.__gs = true;
  }
  // the test API (test/gossip.mjs)
  G.test = {
    deed: (kind, o) => G.deed(VR.game, kind, o),
    rec: () => G.rec(VR.game),
    log: () => G.log.slice(),
    friend: (pid, pts) => G.befriend(G.rec(VR.game), pid, pts, null),
    cool: () => { G.lastSay = -1e9; },
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

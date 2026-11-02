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
  // f-ux2 (pure): the children's little play and a friend's visit, as phases
  // the play: the 'machine' kneels, the 'hero' walks up (≤ 6 s), taps it (2.2 s), the machine rises, both cheer (3 s)
  G.PLAY = { walk: 6, tap: 2.2, rise: 3 };
  G.playNext = (ph, t, arrived) => (ph === 'walk' ? (arrived || t >= G.PLAY.walk ? 'tap' : ph) : ph === 'tap' ? (t >= G.PLAY.tap ? 'rise' : ph) : ph === 'rise' ? (t >= G.PLAY.rise ? 'done' : ph) : 'done');
  // the visit: the friend walks up to your door (≤ 50 s), waits there for you (≤ 40 s), chats when you come (7 s),
  // walks away (≤ 30 s) and is gone; the basket's gift is set down at the chat (or when they leave without you)
  G.VISIT = { walk: 50, wait: 40, chat: 7, leave: 30, near: 12 };
  G.visitNext = function (ph, t, o) {
    o = o || {};
    if (ph === 'walk') return o.arrived || t >= G.VISIT.walk ? 'wait' : ph;
    if (ph === 'wait') return o.near ? 'chat' : t >= G.VISIT.wait ? 'leave' : ph;
    if (ph === 'chat') return t >= G.VISIT.chat ? 'leave' : ph;
    if (ph === 'leave') return o.arrived || t >= G.VISIT.leave ? 'done' : ph;
    return 'done';
  };
  G.KEYS = [];   // (filled below: every key the glue uses, test/gossip.js checks both tables)
  for (const k of Object.keys(G.KINDS)) {
    for (const w of ['greet', 'tell', 'kid', 'verse']) for (let i = 0; i < G.VAR[w]; i++) G.KEYS.push('g.gs.' + w + '.' + k + '.' + i);
    G.KEYS.push('g.gs.kid2.' + k, 'g.gs.ref.' + k);
  }
  G.KEYS.push('g.gs.reply.0', 'g.gs.reply.1', 'g.gs.lv.1', 'g.gs.lv.2', 'g.gs.lv.3', 'g.gs.up', 'g.gs.invite', 'g.gs.dinnerT', 'g.gs.dinner', 'g.gs.visit', 'g.gs.you', 'g.gs.fairy', 'g.gs.set.gossip', 'g.gs.set.gossip.tip', 'g.gs.somewhere', 'g.gs.vis.hi', 'g.gs.vis.hiN', 'g.gs.vis.chat.0', 'g.gs.vis.chat.1', 'g.gs.vis.chat.2', 'g.gs.vis.bye', 'g.gs.play.machine');

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
  // (the villagers' own first hello and their small talk wait while the line stands: villages.js a.greeted, a.talkCool)
  const say = (G0, a, text, dur, what) => { a.say(text, dur || 4.5); a.greeted = true; a.talkCool = Math.max(a.talkCool || 0, (dur || 4.5) + 2); G.cost.said++; G.log.push({ t: Date.now(), who: a.p.id, what, text }); if (G.log.length > 30) G.log.shift(); };
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
  // ================================================================ f-ux2: the calm greeting, the play, the visit
  // the deed greeting is that person's first word (it replaces their plain „Hallo"); while it stands (6 s) the
  // neighbours within 12 m only wave — no bubble beside it
  G.CALM = 6000; G.calm = true;   // (false: the u-gossip screen — the neighbours' own hellos beside it; test/ux2_shots.mjs's „before“)
  const calmAround = (V, a) => {
    if (!G.calm) return;
    const p = V.g.player.pos; G.calmT = Date.now() + G.CALM;
    for (const o of V.agents) { if (o === a || o.greeted) continue; if ((o.pos[0] - p[0]) ** 2 + (o.pos[2] - p[2]) ** 2 < 12 * 12) { o.greeted = true; o.waveT = Math.max(o.waveT || 0, 0.9); } }
  };
  function greetBy(V, a, rec, site, d, t, pid) {
    const g = V.g, p = g.player.pos;
    G.markGreeted(rec, pid, d.id);
    const rk = a.elder ? G.reflect(rec, site, t) : null;   // (the elder sums it up once the village heard of two or more)
    if (rk && G.once(rec, site.id, 'ref', rk)) say(G, a, T('g.gs.ref.' + rk, vars(g, d, a)), 5.5, 'ref');
    else say(G, a, T(G.lineKey('greet', d.k, a.p.seed), vars(g, d, a)), 5, 'greet');
    a.lookAt = [p[0], p[1] + 1.4, p[2]]; a.waveT = 1.2;
    G.addFriend(g, a, 0);
    calmAround(V, a); G.lastSay = G.t || 0;
  }
  // villages.js asks this before a person's plain first hello: true → handled (the deed greeting, or a calm wave)
  G.hello = function (V, a) {
    const g = V && V.g; if (!g || !a || !a.p || !a.vil || !G.on(g) || !g.env) return false;
    if (Date.now() < (G.calmT || 0)) { a.greeted = true; a.waveT = Math.max(a.waveT || 0, 1); return true; }
    if (a.kid || V.talking || (g.ui && g.ui.blocking) || (a.act && (a.act.type === 'gsplay' || a.act.type === 'gsvisit'))) return false;
    const rec = G.rec(g), site = siteOf(g, a.vil), t = now(g), pid = pidOf(g, a), d = G.greetFor(rec, pid, site, t);
    if (!d) return false;
    greetBy(V, a, rec, site, d, t, pid);
    return true;
  };
  // the children's play: k1 the hero, k2 the machine (for the freed beacon: kneeling, blue sparks); one play at a time
  G.stagePlay = function (V, k1, k2, d) {
    const freed = d.k === 'freed';
    V._gsPlay = { k1, k2, d, ph: 'walk', t: 0, freed };
    for (const k of [k1, k2]) { k.act = { type: 'gsplay', role: k === k1 ? 'hero' : 'machine' }; k.path = null; k.goal = null; k.vel[0] = 0; k.vel[2] = 0; }
    k2.lookAt = [k1.pos[0], k1.pos[1] + 0.9, k1.pos[2]];
    if (freed) { k2.pose = 'crouch'; say(G, k2, T('g.gs.play.machine'), 3.2, 'play'); }
    G.log.push({ t: Date.now(), who: k1.p.id, what: 'play', text: 'stage' });
    return V._gsPlay;
  };
  const sparks = (g, a, col, n) => { if (g.particles && g.particles.glow) for (let k = 0; k < n; k++) g.particles.glow(a.pos[0] + (Math.random() - 0.5) * 0.8, a.pos[1] + 0.6 + Math.random() * 0.6, a.pos[2] + (Math.random() - 0.5) * 0.8, col, 1.4, 0.07, 0.5); };
  G.runPlay = function (V, a, dt) {
    const P0 = V._gsPlay, g = V.g;
    if (!P0 || (a !== P0.k1 && a !== P0.k2) || V.agents.indexOf(P0.k1) < 0 || V.agents.indexOf(P0.k2) < 0) { a.act = null; if (a.pose === 'crouch') a.pose = 'stand'; if (P0 && (a === P0.k1 || a === P0.k2)) V._gsPlay = null; return; }
    const { k1, k2, d } = P0;
    if (a === k2) { k2.vel[0] = 0; k2.vel[2] = 0; k2.lookAt = [k1.pos[0], k1.pos[1] + 0.9, k1.pos[2]]; if (P0.freed && P0.ph !== 'rise' && (P0.blink = (P0.blink || 0) + dt) > 0.6) { P0.blink = 0; sparks(g, k2, [0.45, 0.75, 1], 2); } return; }
    // the hero drives the play
    P0.t += dt;
    let arrived = false;
    if (P0.ph === 'walk') { const ux = k1.pos[0] - k2.pos[0], uz = k1.pos[2] - k2.pos[2], L = Math.hypot(ux, uz) || 1; arrived = L < 1.6; if (!arrived && V.goTo(k1, k2.pos[0] + ux / L * 1.1, k2.pos[1], k2.pos[2] + uz / L * 1.1, 0.8)) { const st = Math.min(L - 1.3, dt * (k1.speed || 2)); k1.pos[0] -= ux / L * st; k1.pos[2] -= uz / L * st; } }
    else { k1.vel[0] = 0; k1.vel[2] = 0; k1.path = null; }
    const nx = G.playNext(P0.ph, P0.t, arrived);
    if (nx === P0.ph) return;
    P0.ph = nx; P0.t = 0;
    if (nx === 'tap') {   // the hero faces the machine and taps it: the hero's line
      k1.lookAt = [k2.pos[0], k2.pos[1] + 0.8, k2.pos[2]]; k1.waveT = 1.4; k1.yaw = Math.atan2(-(k2.pos[0] - k1.pos[0]), -(k2.pos[2] - k1.pos[2]));
      say(G, k1, T(G.lineKey('kid', d.k, k1.p.seed), vars(g, d, k1)), 4.2, 'kid'); sparks(g, k2, [1, 0.85, 0.4], 6);
    } else if (nx === 'rise') {   // the machine stands up, friendly; both cheer
      k2.pose = 'stand'; k2.waveT = 1.6; k1.waveT = 1.6;
      say(G, k2, T('g.gs.kid2.' + d.k, vars(g, d, k2)), 4, 'kid2'); sparks(g, k2, [0.6, 1, 1], 8); sparks(g, k1, [1, 0.9, 0.5], 4);
    } else if (nx === 'done') { for (const k of [k1, k2]) { if (k.act && k.act.type === 'gsplay') k.act = null; if (k.pose === 'crouch') k.pose = 'stand'; k.lookAt = null; } V._gsPlay = null; }
  };
  // a friend's visit in person: their own person record (a guest with a basket) walks to your door; ≤ 1 at a time
  G.startVisit = function (V, pid, f, door, gift) {
    const g = V.g, w = g.world, MI = VR.MoveIn;
    if (V._gsVisit || !f || !w || !MI || !MI.groundAt) return false;
    const vil = V.known && V.known.get(f.vid), pidp = String(pid).slice(String(pid).indexOf('/') + 1);
    const person = vil && vil.people && vil.people.find(q => String(q.id) === pidp);
    const proto = V.agents.find(a => a && a.constructor && a.p && a.vil);
    if (!person || !proto) return false;
    // from 26–34 m out, toward their village first (the first heading with ground)
    const base = Math.atan2((vil.plan.z || 0) - door[2], (vil.plan.x || 0) - door[0]);
    let start = null;
    for (let k = 0; k < 8 && !start; k++) {
      const an = base + (k ? ((k + 1) >> 1) * (k & 1 ? 1 : -1) * Math.PI / 4 : 0), r = 30;
      const sx = Math.round(door[0] + Math.cos(an) * r), sz = Math.round(door[2] + Math.sin(an) * r);
      if (w.isLoaded && !w.isLoaded(sx, sz)) continue;
      const y = MI.groundAt(w, sx, door[1] + 14, sz, 30); if (y !== null && y !== undefined) start = [sx + 0.5, y, sz + 0.5];
    }
    if (!start) return false;
    let a = vil.active ? V.agents.find(o => o.vil === vil && o.p && String(o.p.id) === pidp) : null, guest = false;
    if (!a) {
      const look = person.look ? Object.assign({}, person.look, { tool: 'basket' }) : person.look;
      a = new proto.constructor(vil, Object.assign({}, person, { look }), start); a.guest = true; guest = true;
      V.agents.push(a);
    }
    a.act = { type: 'gsvisit' }; a.path = null; a.goal = null; a.bubble = null; a.pose = 'stand';
    V._gsVisit = { a, guest, pid, f, door: door.slice(0, 3), start, gift, ph: 'walk', t: 0, given: false };
    G.log.push({ t: Date.now(), who: person.id, what: 'visitStart', text: 'start' });
    return true;
  };
  G.runVisit = function (V, a, dt) {
    const J = V._gsVisit, g = V.g, MI = VR.MoveIn;
    if (!J || J.a !== a) { a.act = null; return; }
    J.t += dt;
    const p = g.player.pos, o = J.door, dP = Math.hypot(p[0] - a.pos[0], p[2] - a.pos[2]);
    let arrived = false;
    if (J.ph === 'walk') { arrived = V.goTo(a, o[0], o[1], o[2], 1.4); if (!arrived && J.t >= G.VISIT.walk - dt) { a.pos = [o[0] + 0.5, o[1], o[2] + 0.5]; a.path = null; } }
    else if (J.ph === 'leave') arrived = V.goTo(a, J.start[0] - 0.5, J.start[1], J.start[2] - 0.5, 1.6);
    else { a.vel[0] = 0; a.vel[2] = 0; a.path = null; if (dP < 20) a.lookAt = [p[0], p[1] + 1.4, p[2]]; }
    const give = () => { if (J.given) return; J.given = true; try { const mr = MI.rec(g); (mr.gifts || (mr.gifts = [])).push(J.gift); } catch (e) { /* the basket stays */ } };
    const nx = G.visitNext(J.ph, J.t, { arrived, near: dP < G.VISIT.near });
    if (nx === J.ph) {
      if (J.ph === 'chat' && !J.said2 && J.t > 3.2) { J.said2 = true; say(G, a, T('g.gs.vis.chat.' + (h32(hs(J.pid), g.env.day || 0) % 3), { v: J.f.vn, name: pname(g) || T('g.gs.you') }), 4, 'visit'); }
      return;
    }
    J.ph = nx; J.t = 0;
    if (nx === 'chat') { const nm = pname(g); a.waveT = 2; say(G, a, T(nm ? 'g.gs.vis.hi' : 'g.gs.vis.hiN', { name: nm, v: J.f.vn }), 3.4, 'visit'); a.pose = 'crouch'; setTimeout(() => { try { if (a.pose === 'crouch') a.pose = 'stand'; } catch (e) { /* gone */ } }, 1100); give(); G.addFriend(g, a, 0); }
    else if (nx === 'leave') {
      if (!J.given) { give(); const txt = T('g.gs.visit', { who: J.f.name, v: J.f.vn }); if (VR.Quiet && VR.Quiet.note) { try { VR.Quiet.note(txt, 2, 'gs:visit'); } catch (e) { /* theirs */ } } else if (g.ui && g.ui.hint) g.ui.hint(txt, 5000); }
      else { a.waveT = 1.4; if (dP < 16) say(G, a, T('g.gs.vis.bye'), 2.5, 'visit'); }
      a.pose = 'stand'; a.lookAt = null;
    } else if (nx === 'done') G.endVisit(V);
  };
  G.endVisit = function (V) {
    const J = V._gsVisit; if (!J) return; V._gsVisit = null;
    const a = J.a;
    if (J.guest) { const i = V.agents.indexOf(a); if (i >= 0) V.agents.splice(i, 1); } else if (a.act && a.act.type === 'gsvisit') a.act = null;
  };
  G.tick = function (V, dt) {
    const g = V.g; if (!G.on(g) || !g.player || !g.env) { G.why = 'off'; return; }
    G.acc = (G.acc || 0) + dt; if (G.acc < 0.5) return; G.acc = 0;
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    const rec = G.rec(g), t = now(g), tod = g.env.timeOfDay, day = g.env.day || 0, p = g.player.pos;
    G.t = (G.t || 0) + 0.5;
    G.why = V.talking ? 'talk' : g.ui && g.ui.blocking ? 'ui:' + g.ui.screen : 'look';
    if (!V.talking && !(g.ui && g.ui.blocking)) {
      // a festival you are at
      const fv = V.festivalNear ? V.festivalNear() : null;
      if (fv) G.deed(g, 'fest', { x: fv.plan.x, z: fv.plan.z, pl: fv.name, key: fv.id + '@' + day });
      const quiet = (G.t - (G.lastSay || -1e9)) < G.COOL;
      for (const vil of V.known.values()) {
        if (!vil.active || !vil.agents.length) continue;
        const dv = Math.hypot(p[0] - vil.plan.x, p[2] - vil.plan.z); if (dv > 170) continue;
        if (quiet) { G.why = 'quiet'; break; }
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
    const H = G.heard(rec, site, t); if (!H.length) { G.why = 'unheard'; return false; }
    const awake = (a) => a.pose !== 'sleep' && !a.bubble && a !== V.talking && !(a.act && a.act.type === 'arrive');
    const d2 = (a) => (a.pos[0] - p[0]) ** 2 + (a.pos[2] - p[2]) ** 2;
    // the bard: a festival's musician sings a verse (once per village, day and deed)
    const F = vil.fest;
    if (F && F.roles && V.festivalOn && V.festivalOn(vil, tod)) {
      const d = H[0];
      if (!G.wasTold(rec, site.id, 'verse@' + day, d.id)) for (const [a, r] of F.roles) if (r === 'music' && d2(a) < 20 * 20 && !a.bubble && a.drawn !== false) { G.once(rec, site.id, 'verse@' + day, d.id); say(G, a, '♪ ' + T(G.lineKey('verse', d.k, h32(hs(d.id), day)), vars(g, d, a)) + ' ♪', 7, 'verse'); return true; }
    }
    // the greeting: someone near you who heard of a deed and hasn't greeted you by it
    let best = null, bd = 7 * 7;
    for (const a of vil.agents) { if (!awake(a) || a.kid) continue; const q = d2(a); if (q < bd) { bd = q; best = a; } }
    G.why = best ? 'greeted' : 'nobody';
    if (best) {
      const pid = pidOf(g, best), d = G.greetFor(rec, pid, site, t);
      if (d) { greetBy(V, best, rec, site, d, t, pid); return true; }
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
      if (kids.length >= 2 && !V._gsPlay) {
        G.once(rec, site.id, 'kid', dk.id);
        G.stagePlay(V, kids[0], kids[1], dk);
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
    const gift = { at: [at[0] + 0.5, y, at[2] + 0.5], item: it[0], n: it[1], fam: f.sur, name: f.name };
    if (G.startVisit && G.startVisit(V, pid, f, [at[0], y, at[2]], gift)) return;   // (f-ux2: they come in person)
    (mr.gifts || (mr.gifts = [])).push(gift);
    const txt = T('g.gs.visit', { who: f.name, v: f.vn });
    if (VR.Quiet && VR.Quiet.note) { try { VR.Quiet.note(txt, 2, 'gs:visit'); } catch (e) { /* theirs */ } } else if (g.ui && g.ui.hint) g.ui.hint(txt, 5000);
  };

  // ---------------------------------------------------------------- hooks (wrapping, nothing edited)
  const baseUpdate = P.update;
  P.update = function (dt) { baseUpdate.call(this, dt); try { G.tick(this, dt); } catch (e) { if (!G.warned) { G.warned = true; console.warn('gossip', e); } } };
  // f-ux2: the play's and the visit's acts are theirs (the day's plan waits; a guest ends with its visit)
  const bThink = P.think, bRun = P.runAct, bSocial = P.social;
  const mine = (a) => a.act && (a.act.type === 'gsplay' || a.act.type === 'gsvisit');
  if (bThink) P.think = function (a, tod) { if (mine(a)) return; if (a.guest) { G.endVisit(this); return; } return bThink.apply(this, arguments); };
  if (bRun) P.runAct = function (a, dt, tod) {
    if (a.act && a.act.type === 'gsplay') { try { G.runPlay(this, a, dt); } catch (e) { a.act = null; this._gsPlay = null; } return; }
    if (a.act && a.act.type === 'gsvisit') { try { G.runVisit(this, a, dt); } catch (e) { a.act = null; G.endVisit(this); } return; }
    if (a.guest) return;
    return bRun.apply(this, arguments);
  };
  if (bSocial) P.social = function (a) { if (mine(a) || a.guest) return; return bSocial.apply(this, arguments); };
  // a guest's own village woke up (you walked there): the real one lives on, the guest goes
  const bAct = P.activate;
  if (bAct) P.activate = function (vil) { const J = this._gsVisit; if (J && J.guest && J.a.vil === vil) G.endVisit(this); return bAct.apply(this, arguments); };
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
    cool: () => { G.lastSay = -1e9; G.calmT = 0; },
    play: () => { const P0 = VR.game.villages && VR.game.villages._gsPlay; return P0 ? { ph: P0.ph, k1: P0.k1.pos.slice(), k2: P0.k2.pos.slice(), crouch: P0.k2.pose === 'crouch' } : null; },
    visit: () => { const J = VR.game.villages && VR.game.villages._gsVisit; return J ? { ph: J.ph, pos: J.a.pos.slice(), guest: J.guest, given: J.given, door: J.door } : null; },
    state: () => { const g = VR.game; return { on: G.on(g), why: G.why || '', screen: g.ui && g.ui.screen, blocking: !!(g.ui && g.ui.blocking), ticks: G.cost.ticks, said: G.cost.said }; },
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

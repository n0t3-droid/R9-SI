// ============================================================================
// a-quest · VR.Tales — Geschichten von Freunden: warm mini-adventures (3–8 minutes) that grow out of friendship and
// news (plan docs/superpowers/plans/2026-11-02-a-quest.md; the pure rules in tales_core.js, node-tested by
// test/tales.js). The owner: fairy-tale and adventurous play, loving coexistence, never boring.
//   the offer    a friend (u-gossip: Bekannt or closer) you stand beside asks in one small bubble — one offer at a time,
//                at most one a few game hours, never repeated, never while someone else speaks; [V] talks: „✿ Was ist
//                los?“ tells the request (and the news it grew out of), „Ich helfe dir!“ / „Ein andermal“ (then nobody
//                asks for most of a day). Five templates: the lost child at a fairy place at dusk · the festival's
//                missing ingredient from another town (the caravan) · a Flausel family's tiny house · a letter over
//                the Lichtbrücke before the festival · the sleepy beacon on a hill that needs three lights
//   the way      one calm line on the HUD (the step, its count, the distance), Funke's compass points to the target
//                (funke.js addSource), small marks in the world (footprints, stray sparks, a lens, a jar, a stake); a
//                child follows you home, a Flausel family hops after you; builders build, adventurers find
//   the end      the twist on the way, a heartfelt ending said by the friend, a Wanderbuch page (the section
//                „Geschichten“ with its verse), friendship, a small gift; the news (u-gossip kind 'tale') travels to
//                other villages; a woken beacon keeps shining at night, the Flausel house stays
// Save: meta.tales (TC.load). Multiplayer: the host only. Cost 🟢: a 2-Hz look (one loop over the agents near you
// while a tale runs or an offer is possible), ≤ 12 small voxel marks drawn while one runs; nothing per frame
// without one but the lit beacons near you at night (≤ 4 draws). Switch: ⚙ settings.tales.
// ============================================================================
(function (VR) {
  'use strict';
  const TC = VR.TalesCore, Vs = VR.Villages;
  if (!TC || !Vs || typeof document === 'undefined') return;
  const TL = VR.Tales = VR.Tales || {};
  const P = Vs.prototype, D = TC.DAY;
  const T = (k, v) => (VR.I18N ? VR.I18N.t(k, v) : k);
  const fin = Number.isFinite;
  const G = VR.Gossip;
  const host = (g) => !(g.mp && g.mp.isClient);
  const now = (g) => (g.env.day || 0) * D + g.env.timeOfDay;
  const dimOf = (g) => g.dim || 'overworld';
  const pname = (g) => { const n = g.settings && g.settings.playerName; return n && String(n).trim() ? String(n).trim().slice(0, 24) : ''; };
  TL.on = (g) => !!(g && g.meta && !g.meta.guest && host(g) && g.env && !(g.settings && g.settings.tales === false) && !(g.meta.tales && (g.meta.tales.v | 0) > TC.V));
  TL.rec = function (g) {
    if (!g || !g.meta) return TC.fresh();
    if (!g.meta.tales || g._tlLoaded !== g.meta) { g.meta.tales = TC.load(g.meta.tales); g._tlLoaded = g.meta; S.off = null; S.kid = null; S.fl = null; S.yc = {}; }
    return g.meta.tales;
  };
  const S = TL.state = { offer: null, acc: 0, line: '', el: null, kid: null, fl: null, yc: {}, dim: null, met: null, Ctor: null, cost: { ticks: 0, ms: 0, worst: 0, draws: 0 }, log: [] };
  const log = (what, text) => { S.log.push({ t: Date.now(), what, text: String(text || '').slice(0, 200) }); if (S.log.length > 40) S.log.shift(); };

  // ---------------------------------------------------------------- u-gossip: the tale is news
  if (G && G.KINDS && !G.KINDS.tale) {
    G.KINDS.tale = { imp: 6, half: 8 };
    if (Array.isArray(G.KEYS)) { for (const w of ['greet', 'tell', 'kid', 'verse']) for (let i = 0; i < G.VAR[w]; i++) G.KEYS.push('g.gs.' + w + '.tale.' + i); G.KEYS.push('g.gs.kid2.tale', 'g.gs.ref.tale'); }
  }
  if (VR.Settings && VR.Settings.add && !(VR.Settings.byKey && VR.Settings.byKey('tales'))) { try { VR.Settings.add({ key: 'tales', g: 'play', sec: 'play', t: 'switch', lab: 'g.tl.set', tip: 'g.tl.set.tip', def: true }); } catch (e) { /* the settings' own */ } }

  // ---------------------------------------------------------------- the world's places (for the generator)
  function ground(g, x, z) {
    const w = g.world; if (!w || !w.getBlock || (w.isLoaded && !w.isLoaded(Math.floor(x), Math.floor(z)))) return null;
    const R = VR.R, F = VR.F;
    // (f-polish8: from the column's height map down — a handful of reads, not 250: the 2-Hz look's 31-ms spike)
    const hm = w.topAt ? w.topAt(Math.floor(x), Math.floor(z)) : 0, y0 = hm > 0 ? Math.min(250, hm + 3) : Math.min(250, (VR.MAXY || 256) - 1);
    for (let y = y0; y > 1; y--) { const s = w.getBlock(Math.floor(x), y, Math.floor(z)); if (s && R && R.T.flags[s] & F.SOLID) return y + 1; }
    return null;
  }
  TL.ground = ground;
  const yAt = (g, x, z) => { const k = Math.round(x) + ',' + Math.round(z); if (fin(S.yc[k])) return S.yc[k]; const y = ground(g, x, z); if (y !== null) S.yc[k] = y; return y; };
  const ELDER = ['Ottilie', 'Hedwig', 'Frieda', 'Mathilde', 'Rosalie', 'Henriette', 'Amalie', 'Luise'];
  // the hills: three spots 200–320 m out (the land there is rarely loaded yet); the beacon finds the top of its hill
  // when you come near (TL.refine: the highest ground within 26 m, every point of the tale around it moves along)
  function hills(g, cx, cz, seed) {
    const out = [];
    for (let k = 0; k < 3; k++) { const a = (TC.h(seed, 'hill', k) / 4294967296) * Math.PI * 2, r = 200 + 120 * (TC.h(seed, 'hr', k) / 4294967296); out.push({ x: Math.round(cx + Math.cos(a) * r), z: Math.round(cz + Math.sin(a) * r) }); }
    return out;
  }
  // the child's hide and the trail stay on dry, safe ground: near the place, if lava or water lies there, the hide
  // turns round the place (45° at a time) until it and its footprints are on the land
  const unsafe = (g, x, z) => {
    const y = ground(g, x, z); if (y === null) return null;
    const R = VR.R, W = g.world;
    for (const yy of [y - 1, y, y + 1]) { const s = W.getBlock(Math.floor(x), yy, Math.floor(z)), t0 = s && R.types[R.T.type[s]]; if (t0 && /lava|magma|water|fire|ice/.test(t0.name)) return true; }
    return false;
  };
  TL.safe = function (g, tale) {
    const pl = tale.steps.find(q => q.at === 'place' && q.p), hd = tale.steps.find(q => q.at === 'hide' && q.p); if (!pl || !hd || tale.safe) return false;
    const p = g.player.pos; if (Math.hypot(pl.p[0] - p[0], pl.p[1] - p[2]) > 90) return false;
    const tr = tale.steps.find(q => q.id === 'trail'), prints = tr && tr.of && tr.of[0].pts ? tr.of[0].pts : [];
    const cx = pl.p[0], cz = pl.p[1], rot = (v, a) => { const dx = v[0] - cx, dz = v[1] - cz, c = Math.cos(a), sn = Math.sin(a); return [Math.round(cx + dx * c - dz * sn), Math.round(cz + dx * sn + dz * c)]; };
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4, pts = [rot(hd.p, a)].concat(prints.map(v => rot(v, a)));
      let bad = false; for (const v of pts) { const u = unsafe(g, v[0], v[1]); if (u === null) return false; if (u) { bad = true; break; } }
      if (bad) continue;
      tale.safe = true; if (!k) return true;
      const mv = (q) => { if (q.p && q.at === 'hide') q.p = rot(q.p, a); if (q.pts && (q.at === 'prints' || q.at === 'shrooms' || q.at === 'flies')) q.pts = q.pts.map(v => rot(v, a)); if (q.of) q.of.forEach(mv); };
      tale.steps.forEach(mv); S.mkKey = null; S.yc = {};
      if (S.kid) { endKid(g.villages); }
      log('safe', String(k * 45));
      return true;
    }
    tale.safe = true; return true;   // (no dry side: the place itself is the hide's only choice — it stays)
  };
  // the hilltop: the highest dry ground within 26 m (f-polish8: a resumable job, ≤ TL.PROBES probes a tick — it cost one
  // 31-ms tick; a top of lava or water is no place for a beacon)
  TL.PROBES = 12;
  const RF = []; for (let dz = -26; dz <= 26; dz += 6.5) for (let dx = -26; dx <= 26; dx += 6.5) if (dx * dx + dz * dz <= 27 * 27) RF.push([dx, dz]);
  // (run 1 of f-polish8: the beacon stood on an oak's crown — leaves and logs are no ground for it either)
  const wet = (g, x, y, z) => { const R = VR.R, s = g.world.getBlock(Math.floor(x), y, Math.floor(z)), t0 = s && R.types[R.T.type[s]]; return !!(t0 && /lava|magma|water|fire|leaves|log|wood\b/.test(t0.name)); };
  TL.refine = function (g, tale) {
    const s = tale.steps.find(q => q.at === 'hill' && q.p); if (!s || tale.refined) return false;
    const p = g.player.pos; if (Math.hypot(s.p[0] - p[0], s.p[1] - p[2]) > 110) return false;
    const J = S.rf && S.rf.tale === tale ? S.rf : (S.rf = { tale, i: 0, best: null });
    for (let k = 0; k < TL.PROBES && J.i < RF.length; k++, J.i++) {
      const dx = RF[J.i][0], dz = RF[J.i][1], x = s.p[0] + dx, z = s.p[1] + dz, y = ground(g, x, z);
      if (y === null) return false;   // (not loaded yet: the same probe next tick)
      if (wet(g, x, y, z) || wet(g, x, y - 1, z)) continue;
      if (!J.best || y > J.best[2]) J.best = [dx, dz, y];
    }
    if (J.i < RF.length) return false;
    const best = J.best; S.rf = null;
    tale.refined = true; if (!best) return true;
    const ox = Math.round(best[0]), oz = Math.round(best[1]);
    const mv = (q) => { if (q.p && (q.at === 'hill' || q.at === 'motes' || q.at === 'lens')) q.p = [q.p[0] + ox, q.p[1] + oz]; if (q.pts && (q.at === 'motes' || q.at === 'lens')) q.pts = q.pts.map(v => [v[0] + ox, v[1] + oz]); if (q.of) q.of.forEach(mv); };
    tale.steps.forEach(mv); S.mkKey = null;
    log('refine', ox + ',' + oz + ' y' + best[2]);
    return true;
  };
  // the sleepy beacon's stage as its tale goes (f-polish8): 0 dark · 1 the lens set in its bowl · 2, 3 brighter with each
  // light · 4 awake (a small flame); the woken one (kept) is drawn lit
  TL.stage = function (tale) {
    if (!tale || tale.t !== 'beacon') return -1;
    const lens = tale.steps.find(q => q.id === 'lens'), lights = tale.steps.find(q => q.id === 'lights');
    if (!lens || !lens.done) return 0;
    if (!lights || lights.done) return 4;
    let f = 0; for (const q of lights.of || [lights]) { if (q.k === 'place' && q.n) f = Math.max(f, (q.c | 0) / q.n); if (q.k === 'marks' && q.pts && q.pts.length) f = Math.max(f, (q.m | 0) / q.pts.length); }
    return Math.min(3, 1 + Math.floor(f * 3));
  };
  // its light at night: a halo round the lens and a soft beam that grows with the stage (5: the woken beacon) — StoryGlow
  // sprites (kind 0), positions over the beacon's foot; nt the night 0 … 1; out an array to fill (the draw reuses one)
  const BEAMH = [0, 0, 2.5, 5, 9, 16];
  TL.beam = function (stage, nt, t, out) {
    out = out || []; out.length = 0;
    if (!(stage >= 1) || !(nt > 0.05)) return out;
    const k = Math.min(5, stage), br = 0.92 + 0.08 * Math.sin((t || 0) * 1.7), hs = 0.9 + 0.35 * k;
    out.push({ p: [0, 4.5, 0], s: [hs, hs], col: [1.0, 0.86, 0.58], a: (0.12 + 0.1 * k) * nt * br, kind: 0 });
    // (a sprite is brightest at its middle: the beam in segments stacked from the lens up, fading as it climbs)
    const H = BEAMH[k], ns = Math.max(1, k - 1), L = H / ns;
    if (H > 0) for (let j = 0; j < ns; j++) out.push({ p: [0, 4.6 + L * (j + 0.5), 0], s: [0.42 + 0.05 * k, L * 0.8], col: [1.0, 0.9, 0.62], a: (0.14 + 0.06 * k) * nt * br * (1 - j / (ns + 1)), kind: 0 });
    return out;
  };
  // the woken beacon's height: at the ending from its mark's (the tale drew it there), else the ground once loaded
  TL.litY = function (g, L) {
    if (!L || fin(L.y)) return L ? L.y : null;
    const k = Math.round(L.x) + ',' + Math.round(L.z); let y = fin(S.yc[k]) ? S.yc[k] : null;
    if (y === null) y = ground(g, L.x, L.z);
    if (y !== null) L.y = y;
    return y;
  };
  function ctxFor(V, a) {
    const g = V.g, vil = a.vil, gpid = dimOf(g) + '/' + a.p.id, fams = vil.fams || {}, fam = fams[a.p.fam];
    let kids = (vil.people || []).filter(q => q.age === 'child' && q.fam === a.p.fam);
    if (!kids.length) kids = (vil.people || []).filter(q => q.age === 'child').slice(0, 3);
    const villages = []; for (const s of V.sites || []) villages.push({ id: s.id, name: s.name || '', x: s.x, z: s.z });
    if (!villages.some(v => String(v.id) === String(vil.id))) villages.push({ id: vil.id, name: vil.name || '', x: vil.plan.x, z: vil.plan.z });
    const FS = VR.Fairy && VR.Fairy.state && VR.Fairy.state.sites && VR.Fairy.state.g === g ? VR.Fairy.state.sites : [];
    const H = VR.Heart, heart = !!(g.meta && (g.meta.vgen | 0) >= 3 && g.meta.type !== 'flat' && dimOf(g) === 'overworld' && H && H.TEMPLE);
    const bed = g.player && g.player.spawnBed;
    const t = now(g), rec = TL.rec(g), grec = G && G.rec ? G.rec(g) : null;
    const news = grec ? grec.deeds.map(d => ({ k: d.k, pl: d.pl, score: G.score(d, t) })).filter(d => d.score >= 1).sort((x, y) => y.score - x.score).slice(0, 3) : [];
    const seed = String((g.meta && g.meta.seed) || 'r9');
    return {
      seed, n: rec.n | 0, t, tod: g.env.timeOfDay, dim: dimOf(g), role: roleOf(g),
      giver: { pid: gpid, name: a.p.name, sur: fam ? fam.surname || '' : '', vid: vil.id, vn: vil.name || '', x: vil.plan.x, z: vil.plan.z, kids: kids.map(q => ({ pid: dimOf(g) + '/' + q.id, name: q.name })) },
      villages, fairy: FS.filter(s => fin(s.x) && fin(s.z)).map(s => ({ id: s.id, kind: s.kind, name: T('g.fairy.place.' + s.kind), x: s.x, z: s.z })),
      hills: hills(g, vil.plan.x, vil.plan.z, seed + '|' + gpid + '|' + (rec.n | 0)), gate: heart ? { x: H.TEMPLE.x, z: H.TEMPLE.z - 5 } : null,
      home: Array.isArray(bed) && fin(bed[0]) ? { x: bed[0], z: bed[2] } : null, news, toName: ELDER[TC.h(seed, rec.n, gpid, 'to') % ELDER.length],
    };
  }
  function roleOf(g) {
    if (VR.Adventure && VR.Adventure.on && (() => { try { return VR.Adventure.on(); } catch (e) { return false; } })()) return 'adventurer';
    const m = g.player && g.player.mode; return m === 'creative' || (g.meta && g.meta.mode === 'creative') ? 'builder' : 'explorer';
  }

  // ---------------------------------------------------------------- the text of a tale
  const vars = (g, tale) => Object.assign(TC.vars(tale, T), { name: pname(g) || T('g.gs.you') });
  TL.title = (g, tale) => T('g.tl.' + tale.t + '.title', vars(g, tale));
  function askText(g, tale) {
    const V0 = vars(g, tale), Tp = TC.TPL[tale.t];
    const ask = T('g.tl.' + tale.t + '.ask' + (Tp.ways.length > 1 ? '.' + tale.way : ''), V0);
    return (tale.news ? T('g.tl.news.' + tale.news.k, { o: tale.news.pl || '' }) + ' ' : '') + ask;
  }
  TL.askText = askText;
  // the line on the HUD: ✿ the step (its count) · the distance
  function lineOf(g, tale) {
    const h = TC.hint(tale); if (!h) return '';
    const V0 = vars(g, tale); V0.style = tale.nm.style ? T('g.tl.style.' + tale.nm.style.id) : '';
    let s = '✿ ' + T(h.key, V0);
    if (h.m > 1) s += ' · ' + T('g.tl.prog', { n: h.n, m: h.m });
    const tg = TC.target(tale), p = g.player.pos;
    if (tg && dimOf(g) === tale.dim0) { const d = Math.hypot(tg[0] - p[0], tg[1] - p[2]); if (d > 12) s += ' · ' + T('g.tl.dist', { m: Math.round(d) }); }
    if (tale.due !== null && tale.due !== undefined && now(g) < tale.due && TC.TPL[tale.t].due) s += ' · ' + T('g.tl.' + tale.t + '.due');
    return s;
  }
  TL.line = lineOf;
  function hud(g, text) {
    const show = text && !(g.ui && g.ui.screen) && !g.photo;
    if (!S.el) {
      const host0 = document.getElementById('hud') || document.body; if (!host0) return;
      const el = S.el = document.createElement('div'); el.id = 'tlline';
      el.style.cssText = 'position:absolute;left:50%;top:58px;transform:translateX(-50%);max-width:min(620px,86vw);padding:5px 14px;border-radius:14px;background:rgba(28,20,12,.46);color:#fff4df;font:500 13px/1.35 inherit;text-align:center;pointer-events:none;text-shadow:0 1px 2px rgba(0,0,0,.5);border:1px solid rgba(255,214,150,.28);display:none;z-index:4';
      host0.appendChild(el);
    }
    const t = show ? text : '';
    if (t === S.line) return; S.line = t;
    S.el.textContent = t; S.el.style.display = t ? '' : 'none';
  }
  const note = (g, text, key) => { log('note', text); if (VR.Quiet && VR.Quiet.note) { try { VR.Quiet.note(text, 2, key || 'tl'); return; } catch (e) { /* theirs */ } } if (g.ui && g.ui.hint) g.ui.hint(text, 5000); };
  const say = (a, text, dur) => { if (!a || !a.say) return false; a.say(text, dur || 5); a.talkCool = Math.max(a.talkCool || 0, (dur || 5) + 2); a.greeted = true; log('say', text); return true; };
  const pidOf = (g, a) => dimOf(g) + '/' + a.p.id;
  const liveOf = (V, pid) => { const id = String(pid).slice(String(pid).indexOf('/') + 1); for (const a of V.agents) if (a.p && String(a.p.id) === id && !a.tlKid) return a; return null; };

  // ---------------------------------------------------------------- the offer
  function tryOffer(V, rec, t) {
    const g = V.g, p = g.player.pos;
    if (S.offer) {   // (it lapses quietly: you walked away, or the hours passed — never a reminder)
      const O = S.offer, a = O.a;
      if (V.agents.indexOf(a) < 0 || Math.hypot(a.pos[0] - p[0], a.pos[2] - p[2]) > 40 || t - O.t > 3000) { S.offer = null; a.tlOffer = false; rec.cool = t + D * 0.3; log('lapse', O.tale.t); }
      return;
    }
    if (!TC.canOffer(rec, t) || V.talking || (g.ui && g.ui.blocking)) return;
    if (G && G.lastSay !== undefined && (G.t || 0) - (G.lastSay || -1e9) < 6) return;   // (someone just spoke: one voice at a time)
    const grec = G && G.rec ? G.rec(g) : null; if (!grec) return;
    let best = null, bd = 6 * 6;
    for (const a of V.agents) {
      if (!a.p || !a.vil || a.kid || a.guest || a.tlKid || a.bubble || a.pose === 'sleep' || (a.act && a.act.type && /^gs|^tl|arrive|escort/.test(a.act.type))) continue;
      const q = (a.pos[0] - p[0]) ** 2 + (a.pos[2] - p[2]) ** 2; if (q > bd) continue;
      const f = grec.fr[pidOf(g, a)]; if (!f || G.level(f.p) < 1) continue;
      best = a; bd = q;
    }
    if (!best) return;
    const tale = TC.make(ctxFor(V, best), rec); if (!tale) { rec.cool = t + D * 0.25; return; }
    S.offer = { a: best, tale, t };
    best.tlOffer = true; best.lookAt = [p[0], p[1] + 1.4, p[2]]; best.waveT = 1.2;
    say(best, T('g.tl.hook.' + (TC.h(tale.seed, 'hook') % 3), vars(g, tale)), 5);
    log('offer', tale.t + ':' + tale.v);
  }
  function accept(V, a) {
    const g = V.g, O = S.offer; if (!O) return;
    const rec = TL.rec(g), t = now(g);
    S.offer = null; a.tlOffer = false;
    TC.accept(rec, O.tale, t, roleOf(g));
    S.met = null; S.dim = dimOf(g);
    if (V.talkText) V.talkText(T('g.tl.yes'));
    if (V.closeTalk) setTimeout(() => { try { if (V.talking === a) V.closeTalk(); } catch (e) { /* closed */ } }, 1400);
    log('accept', O.tale.t + ':' + O.tale.v + ':' + O.tale.role);
  }
  function decline(V, a) {
    const g = V.g, rec = TL.rec(g);
    S.offer = null; a.tlOffer = false; TC.decline(rec, now(g));
    if (V.talkText) V.talkText(T('g.tl.no'));
    log('decline', '');
  }

  // ---------------------------------------------------------------- the child who follows you (a guest of their own)
  function spawnKid(V, tale) {
    if (S.kid || !tale.kid || !S.Ctor) return null;
    const g = V.g, vil = V.known && V.known.get(tale.giver.vid); if (!vil) return null;
    const id = String(tale.kid.pid).slice(String(tale.kid.pid).indexOf('/') + 1), person = (vil.people || []).find(q => String(q.id) === id); if (!person) return null;
    const hide = tale.steps.find(s => s.at === 'hide' && s.p), at = hide ? hide.p : TC.target(tale); if (!at) return null;
    const y = yAt(g, at[0], at[1]); if (y === null) return null;
    const a = new S.Ctor(vil, Object.assign({}, person, { town: undefined }), [at[0] + 0.5, y, at[1] + 0.5]);
    a.tlKid = true; a.greeted = true; a.talkCool = 9999; a.act = { type: 'tlkid', ph: 'hide' }; a.path = null; a.goal = null; a.pose = 'sitground';
    V.agents.push(a); stashTwin(V, a);
    S.kid = { a, ph: 'hide', t: 0 };
    log('kid', person.name);
    return a;
  }
  function stashTwin(V, k) { for (let i = V.agents.length - 1; i >= 0; i--) { const o = V.agents[i]; if (o !== k && o.p && String(o.p.id) === String(k.p.id) && o.vil === k.vil) { V.agents.splice(i, 1); const j = o.vil.agents.indexOf(o); if (j >= 0) o.vil.agents.splice(j, 1); } } }
  function endKid(V) { const K = S.kid; if (!K) return; S.kid = null; const i = V.agents.indexOf(K.a); if (i >= 0) V.agents.splice(i, 1); }
  TL.kidAct = function (V, a, dt) {
    const K = S.kid, g = V.g; if (!K || K.a !== a) { a.act = null; return; }
    K.t += dt; const p = g.player.pos, d = Math.hypot(p[0] - a.pos[0], p[2] - a.pos[2]);
    if (K.ph === 'hide') { a.vel[0] = 0; a.vel[2] = 0; a.path = null; if (d < 14) a.lookAt = [p[0], p[1] + 1.4, p[2]]; return; }
    if (K.ph === 'follow') {
      if (a.pose === 'sitground') a.pose = 'stand';
      if (d > 36 && g.world) { const y = yAt(g, p[0] - 2, p[2] - 2); if (y !== null) { a.pos = [p[0] - 2, y, p[2] - 2]; a.path = null; } return; }
      if (d > 3) { if (V.goTo) V.goTo(a, p[0], p[1], p[2], 2.2); } else { a.vel[0] = 0; a.vel[2] = 0; a.path = null; a.lookAt = [p[0], p[1] + 1.4, p[2]]; }
      return;
    }
    if (K.ph === 'home') {   // to the friend's arms, then home on their own
      const gv = liveOf(V, S.endGiver || '');
      // (f-polish8: a child left far behind — the hops home outran her — runs ahead into the friend's arms: placed beside her)
      if (gv && K.t < 14 && Math.hypot(gv.pos[0] - a.pos[0], gv.pos[2] - a.pos[2]) > 12) { const p0 = g.player.pos, dx = p0[0] - gv.pos[0], dz = p0[2] - gv.pos[2], L = Math.hypot(dx, dz) || 1, x = gv.pos[0] + dx / L * 0.9, z = gv.pos[2] + dz / L * 0.9, y = g.world ? yAt(g, x, z) : null; a.pos = [x, y !== null ? y : gv.pos[1], z]; a.path = null; a.vel[0] = 0; a.vel[2] = 0; }
      if (gv && Math.hypot(gv.pos[0] - a.pos[0], gv.pos[2] - a.pos[2]) > 1.6 && K.t < 14) { if (V.goTo) V.goTo(a, gv.pos[0], gv.pos[1], gv.pos[2], 1.2); }
      else { a.vel[0] = 0; a.vel[2] = 0; a.path = null; if (gv) { a.lookAt = [gv.pos[0], gv.pos[1] + 1.3, gv.pos[2]]; gv.lookAt = [a.pos[0], a.pos[1] + 0.9, a.pos[2]]; } }
      if (K.t > 22) endKid(V);
    }
  };

  // ---------------------------------------------------------------- the events of a running tale
  function speakerNear(V, max) {
    const g = V.g, p = g.player.pos;
    if (S.met && V.agents.indexOf(S.met) >= 0 && Math.hypot(S.met.pos[0] - p[0], S.met.pos[2] - p[2]) < (max || 10) && !S.met.bubble) return S.met;
    if (S.kid && Math.hypot(S.kid.a.pos[0] - p[0], S.kid.a.pos[2] - p[2]) < (max || 10)) return S.kid.a;
    return null;
  }
  function handle(V, tale, outs) {
    const g = V.g, V0 = () => vars(g, tale), p = g.player.pos;
    for (const o of outs) {
      if (o.k === 'prog') { if (g.audio && g.audio.play) { try { g.audio.play('pop'); } catch (e) { /* a sound */ } } if (g.particles && g.particles.spark) g.particles.spark(p[0], p[1] + 0.8, p[2], [1, 0.9, 0.55], 14, 2.5, 1); log('prog', o.id); continue; }
      if (o.k === 'step') {
        log('step', o.id);
        if (o.with === 'kid') { const a = S.kid ? S.kid.a : spawnKid(V, tale); if (a) { S.kid.ph = 'follow'; S.kid.t = 0; a.pose = 'stand'; a.waveT = 1.4; } }
        if (o.with === 'flausel') S.fl = { ph: 'follow', pos: null };
        if (o.say) { const txt = T('g.tl.' + tale.t + '.say.' + o.id, V0()), sp = speakerNear(V, 12); if (!(sp && say(sp, txt, 5.5))) note(g, txt, 'tl:say'); }
        if (g.audio && g.audio.play) { try { g.audio.play('pop'); } catch (e) { /* a sound */ } }
        continue;
      }
      if (o.k === 'twist') {
        const txt = T('g.tl.' + tale.t + '.tw.' + tale.v, V0()), sp = speakerNear(V, 14);
        setTimeout(() => { try { if (!(sp && say(sp, txt, 7))) note(g, txt, 'tl:tw'); } catch (e) { /* gone */ } }, o.k === 'twist' && outs.some(x => x.say) ? 3200 : 200);
        log('twist', tale.v);
        continue;
      }
      if (o.k === 'done') finish(V, tale);
    }
  }
  function finish(V, tale) {
    const g = V.g, rec = TL.rec(g), t = now(g), V0 = vars(g, tale);
    const res = TC.finish(rec, t); if (!res) return;
    if (res.lit) TL.litY(g, res.lit);   // (f-polish8: its height now — the ending is said in the village, 200–320 m off)
    const end = T(res.key, V0), head = T(res.head, V0), gv = liveOf(V, res.giver.pid);
    S.endGiver = res.giver.pid;
    S.pend = { pid: res.giver.pid, text: end, t: Date.now() };   // (said by the friend in person: now, or as soon as their village is awake around you)
    sayEnd(V);
    if (S.kid) { S.kid.ph = 'home'; S.kid.t = 0; }
    if (S.fl) S.fl.ph = 'home';
    // friendship, the news, the page, a small gift
    if (G && G.rec) { try { const gr = G.rec(g); G.befriend(gr, res.giver.pid, res.fr, null); G.deed(g, 'tale', { x: res.giver.x, z: res.giver.z, pl: head.slice(0, 60), key: res.page.id }); } catch (e) { /* the news waits */ } }
    let item = null;
    const inv = g.player && g.player.inv, ok = (id) => !!((VR.itemDef && VR.itemDef(id)) || (VR.R && VR.R.byName && VR.R.byName[id]));
    for (const id of res.items) if (ok(id)) { item = id; break; }
    if (item && inv && inv.add) { try { inv.add(item, 1); } catch (e) { item = null; } }
    if (VR.Wander && VR.Wander.note) { try { VR.Wander.note(g.meta, 'people', res.giver.pid, res.giver.name); } catch (e) { /* the book's */ } }
    if (VR.Adventure && VR.Adventure.award && VR.Adventure.on && VR.Adventure.on()) { try { VR.Adventure.award('quest', { size: 'M' }); } catch (e) { /* theirs */ } }
    const body = T('g.tl.done', { title: head, giver: res.giver.name }) + (item ? ' · ' + T('g.tl.item', { item: VR.itemName ? VR.itemName(item) : item }) : '') + (res.late ? ' ' + T('g.tl.late') : '');
    setTimeout(() => { try { if (g.ui && g.ui.toast) g.ui.toast(T('g.tl.doneT'), body, null); } catch (e) { /* a toast */ } }, 2600);
    if (g.audio && g.audio.play) { try { g.audio.play('levelup'); } catch (e) { /* a sound */ } }
    S.lastEnd = { key: res.key, text: end, head, item, late: res.late, page: res.page.id, t: Date.now() };
    log('done', res.key);
    hud(g, '');
  }
  function sayEnd(V) {
    const J = S.pend, g = V.g; if (!J) return;
    const gv = liveOf(V, J.pid), p = g.player.pos;
    if (gv && Math.hypot(gv.pos[0] - p[0], gv.pos[2] - p[2]) < 90 && !(gv.bubble && gv.bubble.text === J.text)) {
      S.pend = null; say(gv, J.text, 9); gv.lookAt = [p[0], p[1] + 1.4, p[2]]; gv.waveT = 1.6; if (V.hearts) V.hearts(gv);
      if (S.kid) { S.kid.ph = 'home'; S.kid.t = 0; }
      return;
    }
    if (Date.now() - J.t > 15000) { S.pend = null; note(g, J.text, 'tl:end'); }
  }
  // the player's own placing (player.js afterPlace → g.onBlockPlaced, chained like adventure.js does)
  function install(g) {
    if (!g || (g.onBlockPlaced && g.onBlockPlaced.__tl)) return;
    const prev = g.onBlockPlaced;
    const fn = function (x, y, z, s) { if (prev) prev.apply(this, arguments); try { TL.placed(g, x, y, z, s); } catch (e) { /* placed anyway */ } };
    fn.__tl = true; if (prev && prev.__adv) fn.__adv = true; g.onBlockPlaced = fn;
  }
  TL.catsAt = function (g, s) {
    const R = VR.R; if (!s || !R) return [];
    const t0 = R.types[R.T.type[s]]; if (!t0) return [];
    const o = t0.o || {};
    return TC.catsOf(t0.name, { emit: !!(R.T.emit && R.T.emit[s]), door: o.kind === 'door' });
  };
  TL.placed = function (g, x, y, z, s) {
    if (!TL.on(g)) return; const rec = TL.rec(g), tale = rec.cur; if (!tale || tale.st !== 'on') return;
    const st = s || (g.world && g.world.getBlock(x, y, z));
    const outs = TC.feed(tale, { k: 'placed', x: x + 0.5, y, z: z + 0.5, cats: TL.catsAt(g, st), dim: dimOf(g) });
    if (outs.length && g.villages) handle(g.villages, tale, outs);
  };
  function run(V, rec, t) {
    const g = V.g, tale = rec.cur, p = g.player.pos, dim = dimOf(g);
    if (tale.st !== 'on') return;
    if (!tale.refined && TC.TPL[tale.t].keep && TC.TPL[tale.t].keep.k === 'beacon') TL.refine(g, tale);
    if (!tale.safe && tale.kid) TL.safe(g, tale);
    const outs = [];
    if (S.dim !== dim) { S.dim = dim; outs.push(...TC.feed(tale, { k: 'dim', dim })); }
    if (tale.st === 'on') outs.push(...TC.feed(tale, { k: 'pos', x: p[0], z: p[2], dim }));
    // meeting someone: an awake grown-up within 4 m (the trader, the letter's addressee) — or a village's middle in the other world
    const cur = TC.cur(tale);
    if (cur && (cur.k === 'talk' || cur.k === 'meet')) {
      let m = null;
      for (const a of V.agents) { if (!a.p || a.kid || a.tlKid || a.pose === 'sleep') continue; if ((a.pos[0] - p[0]) ** 2 + (a.pos[2] - p[2]) ** 2 < 16) { m = a; break; } }
      if (!m && cur.k === 'meet' && dim !== tale.dim0 && V.known) for (const vil of V.known.values()) if (Math.hypot(vil.plan.x - p[0], vil.plan.z - p[2]) < 30) { m = { pos: [vil.plan.x, 0, vil.plan.z], none: true }; break; }
      if (m) { if (!m.none) { S.met = m; m.lookAt = [p[0], p[1] + 1.4, p[2]]; } outs.push(...TC.feed(tale, { k: 'meet', x: m.pos[0], z: m.pos[2], dim })); }
    }
    // the child waits at the hide once you come near
    if (tale.kid && !S.kid && cur && tale.steps.some(s => s.with === 'kid' && !s.done)) { const h = tale.steps.find(s => s.at === 'hide' && s.p); if (h && Math.hypot(h.p[0] - p[0], h.p[1] - p[2]) < 70) spawnKid(V, tale); }
    if (outs.length) handle(V, tale, outs);
    if (rec.cur === tale) hud(g, lineOf(g, tale));
  }
  TL.tick = function (V, dt) {
    const g = V.g; if (!TL.on(g) || !g.player || g.state !== 'play') { if (S.line) hud(g || {}, ''); return; }
    if (!S.Ctor && V.agents.length && V.agents[0].constructor) S.Ctor = V.agents[0].constructor;
    S.acc += dt; if (S.acc < 0.5) return; S.acc = 0;
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    install(g);
    const rec = TL.rec(g), t = now(g);
    if (rec.cur && rec.cur.st === 'on') run(V, rec, t);
    else { if (S.line) hud(g, ''); if (rec.cur && rec.cur.st !== 'on') rec.cur = null; tryOffer(V, rec, t); }
    if (S.pend) sayEnd(V);
    if (S.kid && S.kid.ph === 'home' && !rec.cur && S.kid.t > 30) endKid(V);
    if (S.kid && !rec.cur && S.kid.ph !== 'home') endKid(V);
    // the woken beacons and the Flausel houses: their ground once near
    for (const L of rec.lit) if (L.dim === dimOf(g) && !fin(L.y) && Math.hypot(L.x - g.player.pos[0], L.z - g.player.pos[2]) < 200) TL.litY(g, L);
    if (t0) { const ms = performance.now() - t0; S.cost.ticks++; S.cost.ms += ms; if (ms > 1) S.cost.over1 = (S.cost.over1 | 0) + 1; if (ms > S.cost.worst) { S.cost.worst = ms; S.cost.worstAt = rec.cur ? 'run ' + rec.cur.t + ':' + (TC.cur(rec.cur) ? TC.cur(rec.cur).id : '-') : (S.pend ? 'end' : 'offer'); } }   // (f-polish8: where the worst tick was, how many over 1 ms)
  };

  // ---------------------------------------------------------------- the marks in the world (our own voxel models)
  const MARK = { prints: 'tl_print', shrooms: 'fy_shroom_1', flies: 'tl_spark', jar: 'tl_jar', blooms: 'tl_bloom', cozy: 'tl_cozy', petal: 'tl_bloom', motes: 'tl_spark', lens: 'tl_lens' };
  const FULL = { sky: 1, bl: [1, 1, 1] };
  const MP = { scale: 1, light: null, noShade: false, shade: 0 };
  TL.marks = function (g, tale) {   // [{m, x, z, glow, sc}] (rebuilt only when asked: the draw caches by the step)
    const out = [], cur = TC.cur(tale), add = (m, x, z, o) => out.push(Object.assign({ m, x, z }, o || {}));
    const keep = TC.TPL[tale.t].keep;
    if (keep && keep.k === 'beacon') { const s = tale.steps.find(q => q.at === 'hill' && q.p); if (s) add('tl_beacon', s.p[0], s.p[1], { big: true }); }
    const plot = tale.steps.find(q => q.at === 'plot' && q.p); if (plot) add('tl_stake', plot.p[0] + 1.5, plot.p[1] + 1.5);
    if (!cur) return out;
    const one = (q) => {
      if (q.k === 'marks') { const m = MARK[q.at] || 'tl_spark'; for (let i = q.m; i < Math.min(q.pts.length, q.m + (q.at === 'prints' ? 2 : 3)); i++) add(m, q.pts[i][0], q.pts[i][1], { glow: m === 'tl_spark' || m === 'tl_lens', yaw: q.at === 'prints' && q.pts[i + 1] ? Math.atan2(-(q.pts[i + 1][0] - q.pts[i][0]), -(q.pts[i + 1][1] - q.pts[i][1])) : i }); }
      else if ((q.k === 'place') && q.at === 'hive') add('tl_stake', q.p[0], q.p[1]);
    };
    if (cur.k === 'any') cur.of.forEach(one); else one(cur);
    return out;
  };
  function drawAll(V, r, E, cam) {
    const g = V.g; if (!TL.on(g)) return;
    const LK = VR.LifeKit, ent = g.entities; if (!LK || !ent || !LK.drawModel) return;
    const rec = TL.rec(g), tale = rec.cur && rec.cur.st === 'on' ? rec.cur : null, night = (g.env && (g.env.timeOfDay > 12200 && g.env.timeOfDay < 23000));
    if (!tale && !rec.lit.length && !S.fl) return;
    let prog = null; const Pg = () => prog || (prog = ent.beginVox(r, E)); const tt = g.time || 0;
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now(), fdt = Math.min(0.1, Math.max(0, (nowMs - (S.lastDraw || nowMs)) / 1000)); S.lastDraw = nowMs;
    let n = 0;
    // (f-polish8: the beacons' halo and beam at night — StoryGlow sprites, drawn after the models; not on Very Low)
    const nt = night ? Math.max(0.35, Math.min(1, (E && E.night) || (g.env && g.env.night) || 1)) : 0;
    const SGl = VR.StoryGlow, glowOk = !!(nt > 0 && SGl && SGl.draw && (!SGl.ok || SGl.ok()) && !(g.settings && (g.settings.preset === 'potato' || g.settings.storyLights === false)));
    const GL = S.gl || (S.gl = []), BT = S.bt || (S.bt = []); let ng = 0;
    const beamAt = (x, y, z, stage) => { if (!glowOk) return; TL.beam(stage, nt, tt, BT); for (const q of BT) { if (ng >= 8) break; const o = GL[ng] || (GL[ng] = { p: [0, 0, 0], s: [0, 0], col: [0, 0, 0], a: 0, kind: 0 }); o.p[0] = x + q.p[0]; o.p[1] = y + q.p[1]; o.p[2] = z + q.p[2]; o.s[0] = q.s[0]; o.s[1] = q.s[1]; o.col[0] = q.col[0]; o.col[1] = q.col[1]; o.col[2] = q.col[2]; o.a = q.a; ng++; } };
    // the woken beacons (at night, and while the tale's own light is fresh) and the Flausel houses' little folk
    for (const L of rec.lit) {
      if (L.dim !== dimOf(g)) continue;
      const dx = L.x - cam.x, dz = L.z - cam.z; if (dx * dx + dz * dz > 220 * 220) continue;
      if (!fin(L.y) && TL.litY(g, L) === null) continue;   // (f-polish8: its height found here too — a night picture missed it)
      if (L.k === 'beacon') { MP.scale = 1; MP.light = night ? FULL : null; MP.noShade = false; const bp = S.bp || (S.bp = [0, 0, 0]); bp[0] = L.x; bp[1] = L.y - 0.05; bp[2] = L.z; if (LK.drawModel(g, r, Pg(), night ? 'tl_beacon_lit' : 'tl_beacon_s4', bp, 0, cam, MP)) n++; beamAt(L.x, L.y, L.z, 5); S.litDrawn = (S.litDrawn | 0) + 1; if (night && g.particles && g.particles.glow && Math.random() < 0.3) g.particles.glow(L.x + (Math.random() - 0.5), L.y + 3.2 + Math.random(), L.z + (Math.random() - 0.5), [1, 0.85, 0.5], 1.6, 0.12, 0.3); }
      else if (L.k === 'flausel' && dx * dx + dz * dz < 60 * 60) { MP.scale = 1.05; MP.light = null; MP.noShade = false; for (let i = 0; i < 2; i++) if (LK.drawModel(g, r, Pg(), 'fy_sprite_' + ((TC.h(L.x, L.z, i) % 4)), [L.x + 1.2 + i * 0.9, L.y + Math.abs(Math.sin(tt * 2 + i)) * 0.12, L.z - 1.4], tt * 0.2 + i * 2, cam, MP)) n++; }
    }
    if (tale) {
      const cq = TC.cur(tale), key = tale.i * 4096 + (cq ? ((cq.m | 0) * 64 + (cq.c | 0)) : 0) + (cq && cq.of ? cq.of.reduce((x, b) => x + (b.m | 0) * 8 + (b.c | 0), 0) * 262144 : 0);   // (a number: no string per frame)
      if (S.mkKey !== key || S.mkTale !== tale) { S.mkKey = key; S.mkTale = tale; S.mk = TL.marks(g, tale); }
      for (const M0 of S.mk) {
        const dx = M0.x - cam.x, dz = M0.z - cam.z; if (dx * dx + dz * dz > (M0.big ? 160 * 160 : 64 * 64)) continue;
        const y = yAt(g, M0.x, M0.z); if (y === null) continue;
        MP.scale = M0.m === 'fy_shroom_1' ? 0.32 : 1; MP.light = M0.glow || M0.m === 'tl_print' ? FULL : null; MP.noShade = !!M0.glow;
        // (f-polish8: the sleepy beacon shows its stage — the lens set, brighter with each light, awake — and at night its beam)
        if (M0.m === 'tl_beacon') { const sg = Math.max(0, TL.stage(tale)), dp = S.dp || (S.dp = [0, 0, 0]); dp[0] = M0.x; dp[1] = y; dp[2] = M0.z; if (sg >= 2 && night) MP.light = FULL; if (LK.drawModel(g, r, Pg(), 'tl_beacon_s' + sg, dp, 0, cam, MP)) n++; beamAt(M0.x, y, M0.z, sg); continue; }
        const hov = M0.glow ? 0.5 + Math.sin(tt * 2.2 + M0.x) * 0.15 : M0.m === 'tl_print' ? 0.02 : 0;
        const dp = S.dp || (S.dp = [0, 0, 0]); dp[0] = M0.x; dp[1] = y + hov; dp[2] = M0.z;
        if (LK.drawModel(g, r, Pg(), M0.m, dp, M0.glow ? tt * 0.8 : (M0.yaw || 0), cam, MP)) n++;
        if (M0.glow && g.particles && g.particles.glow && Math.random() < 0.25 && !(g.settings && g.settings.preset === 'potato')) g.particles.glow(M0.x + (Math.random() - 0.5) * 0.5, y + hov + 0.2, M0.z + (Math.random() - 0.5) * 0.5, [1, 0.9, 0.55], 1.4, 0.06, 0.6);
      }
      // the little lost Flausel in the child's arms (the twist) until it is home
      if (S.kid && tale.t === 'lost' && tale.v === 'flausel' && tale.steps.some(q => q.id === 'flhome' && !q.done) && TC.cur(tale) && TC.cur(tale).id !== 'find') {
        const a = S.kid.a; MP.scale = 0.7; MP.light = null; MP.noShade = false;
        if (LK.drawModel(g, r, Pg(), 'fy_sprite_4', [a.pos[0] + Math.sin(a.yaw || 0) * -0.35, a.pos[1] + 0.55 + Math.sin(tt * 3) * 0.04, a.pos[2] + Math.cos(a.yaw || 0) * -0.35], a.yaw || 0, cam, MP)) n++;
      }
    }
    // the Flausel family hopping after you, then to their plot
    if (S.fl && tale && tale.t === 'home') {
      const F = S.fl, pl = g.player.pos, plot = tale.steps.find(q => q.at === 'plot' && q.p);
      if (!F.pos) { const e = tale.steps.find(q => q.at === 'edge' && q.p); F.pos = [0, 1, 2].map(i => [(e ? e.p[0] : pl[0]) + i, (e ? e.p[1] : pl[2]) + i * 0.6]); }
      const goal = F.ph === 'home' || (plot && TC.cur(tale) && TC.cur(tale).id !== 'plot' && TC.cur(tale).id !== 'meet') ? [plot.p[0] + 0.5, plot.p[1] - 1.5] : [pl[0], pl[2]];
      for (let i = 0; i < 3; i++) {
        const q = F.pos[i], tx = goal[0] + Math.cos(i * 2.1 + 0.4) * (1.6 + i * 0.5), tz = goal[1] + Math.sin(i * 2.1 + 0.4) * (1.6 + i * 0.5), dx = tx - q[0], dz = tz - q[1], d = Math.hypot(dx, dz);
        if (d > 40) { q[0] = tx; q[1] = tz; } else if (d > 0.3) { const st = Math.min(d, fdt * 5.2); q[0] += dx / d * st; q[1] += dz / d * st; }
        const y = yAt(g, q[0], q[1]); if (y === null) continue;
        MP.scale = i === 0 ? 1.15 : 0.95 - i * 0.1; MP.light = null; MP.noShade = false;
        if (LK.drawModel(g, r, Pg(), 'fy_sprite_' + [1, 0, 2][i], [q[0], y + Math.abs(Math.sin(tt * 7 + i * 1.7)) * (d > 0.3 ? 0.25 : 0.03), q[1]], Math.atan2(-(pl[0] - q[0]), -(pl[2] - q[1])), cam, MP)) n++;
      }
    }
    S.cost.draws = n;
    if (ng) { GL.length = Math.max(GL.length, ng); const L2 = S.gl2 || (S.gl2 = []); L2.length = 0; for (let i = 0; i < ng; i++) L2.push(GL[i]); try { SGl.draw(r, cam, L2); S.glows = ng; } catch (e) { TL.drawErr = 'glow ' + String((e && e.message) || e); } }
  }

  // ---------------------------------------------------------------- hooks (Villages' prototype, the talk, Funke, the books)
  const bUp = P.update;
  P.update = function (dt) { bUp.call(this, dt); try { TL.tick(this, dt); } catch (e) { if (!TL.warned) { TL.warned = true; console.warn('tales', e); } } };
  const bThink = P.think, bRun = P.runAct, bDraw = P.draw, bAct = P.activate, bSocial = P.social;
  if (bThink) P.think = function (a, tod) { if (a.tlKid) return; return bThink.apply(this, arguments); };
  if (bRun) P.runAct = function (a, dt, tod) { if (a.tlKid) { try { TL.kidAct(this, a, dt); } catch (e) { endKid(this); } return; } return bRun.apply(this, arguments); };
  if (bSocial) P.social = function (a) { if (a.tlKid) return; return bSocial.apply(this, arguments); };
  if (bDraw) P.draw = function (r, E, cam) { const o = bDraw.apply(this, arguments); try { drawAll(this, r, E, cam); } catch (e) { TL.drawErr = String((e && e.message) || e); } return o; };
  if (bAct) P.activate = function (vil) { const o = bAct.apply(this, arguments); try { if (S.kid && S.kid.a.vil === vil) stashTwin(this, S.kid.a); } catch (e) { /* the twin stays */ } return o; };
  const bOpts = P.talkOptions;
  if (bOpts) P.talkOptions = function (a) {
    const out = bOpts.apply(this, arguments);
    try {
      const g = this.g, box = document.querySelector('#tk_opts'); if (!box || !TL.on(g) || !a || !a.p) return out;
      const mk = (label, fn, cls) => { const b = document.createElement('button'); b.className = 'btn small' + (cls ? ' ' + cls : ''); b.textContent = label; b.setAttribute('data-tl', cls || ''); b.onclick = fn; return b; };
      const rec = TL.rec(g);
      if (S.offer && S.offer.a === a) {
        const V = this, tale = S.offer.tale;
        box.insertBefore(mk(T('g.tl.btn.offer'), () => {
          V.talkText(askText(g, tale));
          box.innerHTML = '';
          box.appendChild(mk(T('g.tl.btn.yes'), () => accept(V, a), 'tlyes'));
          box.appendChild(mk(T('g.tl.btn.no'), () => { decline(V, a); V.talkOptions(a); }, 'tlno'));
        }, 'tloffer'), box.firstChild);
      } else if (rec.cur && rec.cur.st === 'on' && rec.cur.giver.pid === pidOf(g, a)) {
        const V = this;
        box.insertBefore(mk('✿ ' + TL.title(g, rec.cur), () => V.talkText(lineOf(g, rec.cur).replace(/^✿ /, '')), 'tlcur'), box.firstChild);
        box.appendChild(mk(T('g.tl.drop'), () => { TC.abandon(rec, now(g)); endKid(V); S.fl = null; hud(g, ''); V.talkText(T('g.tl.no')); V.talkOptions(a); }, 'tldrop'));
      }
    } catch (e) { console.warn('tales', e); }
    return out;
  };
  const FU = VR.Funke;
  if (FU && FU.addSource) FU.addSource((g) => {
    if (!TL.on(g)) return null; const tale = TL.rec(g).cur; if (!tale || tale.st !== 'on' || dimOf(g) !== tale.dim0) return null;
    const tg = TC.target(tale); if (!tg) return null; const y = yAt(g, tg[0], tg[1]);
    return { pos: [tg[0], y === null ? g.player.pos[1] : y, tg[1]], name: TL.title(g, tale), kind: 'tale' };
  });
  // the books: the journal (Abenteuer) and the Wanderbuch get the section „Geschichten“
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  TL.html = function (g) {
    const rec = TL.rec(g); let h = '<div class="wdsec tlsec"><h3>✿ ' + esc(T('g.tl.book')) + ' <span class="note">' + rec.pages.length + '</span></h3>';
    if (rec.cur && rec.cur.st === 'on') h += '<p><b>' + esc(TL.title(g, rec.cur)) + '</b><br><span class="note">' + esc(lineOf(g, rec.cur)) + '</span></p>';
    if (!rec.pages.length) h += '<div class="wdl"><span class="note">' + esc(T('g.tl.none')) + '</span></div>';
    for (const pg of rec.pages.slice(-8).reverse()) {
      const fake = { t: pg.t, nm: pg.nm || {} }, V0 = vars(g, fake);
      h += '<div class="tlpage" style="margin:6px 0;padding:6px 10px;border-radius:10px;background:rgba(255,236,200,.08)"><b>' + esc(T('g.tl.' + pg.t + '.title', V0)) + '</b> <span class="note">' + esc(T('g.tl.pageof', { d: (pg.d | 0) + 1, giver: pg.giver || '', vn: pg.vn || '' })) + (pg.late ? ' ' + esc(T('g.tl.late')) : '') + '</span><br><i class="note">♪ ' + esc(T('g.tl.' + pg.t + '.verse', V0)) + '</i></div>';
    }
    return h + '</div>';
  };
  const W = VR.Wander;
  if (W && W.html && !W.html.__tl) { const oh = W.html; W.html = function (meta) { let h = oh.apply(this, arguments); try { const g = VR.game; if (g && g.meta === meta) h += TL.html(g); } catch (e) { /* the book's own */ } return h; }; W.html.__tl = true; }
  const Q = VR.Quests;
  if (Q && Array.isArray(Q.journalSections) && !(W && W.html)) Q.journalSections.push(() => { const g = VR.game; return g && g.meta ? TL.html(g) : ''; });

  // ---------------------------------------------------------------- the models (VR.VOXMODELS: our own voxel art)
  const M = VR.VOXMODELS, Grid = VR.VoxGrid;
  if (M && Grid) {
    const part = (sx, sy, sz, pv, fn) => { const gr = new Grid(sx, sy, sz, pv[0], pv[1], pv[2]); fn(gr); return { grid: gr, pivot: [0, 0, 0] }; };
    // two small bare footprints in the grass (1/16 block): pale earth, the toes as dots
    M.tl_print = () => ({ unit: 12, radius: 0.6, parts: { b: part(9, 1, 12, [4, 0, 6], (gr) => {   // (a little fairy dust in each: they glimmer at dusk)
      const foot = (ox, oz) => { for (let z = 0; z < 6; z++) for (let x = 0; x < 3; x++) if (!(z === 0 && x !== 1) && !(z === 5 && x === 1)) gr.set(ox + x, 0, oz + z, (x + z) % 3 ? 0xf6e2a8 : 0xfff6d8, 1); for (let x = 0; x < 3; x++) gr.set(ox + x, 0, oz - 1 - (x & 1), 0xffeebb, 1); };
      foot(0, 5); foot(5, 1);
    }) }, layout: { b: [0, 0, 0] } });
    // a stray spark: a small warm glowing orb with a pale core (it hovers and turns)
    M.tl_spark = () => ({ unit: 16, radius: 0.4, parts: { b: part(5, 5, 5, [2, 0, 2], (gr) => { for (let y = 0; y < 5; y++) for (let z = 0; z < 5; z++) for (let x = 0; x < 5; x++) { const d = Math.hypot(x - 2, y - 2, z - 2); if (d < 2.4) gr.set(x, y, z, d < 1.2 ? 0xfff6d0 : 0xffc85a, 1); } }) }, layout: { b: [0, 0, 0] } });
    // the beacon's lens: a round disc of pale blue glass in a brass ring, on its edge
    M.tl_lens = () => ({ unit: 16, radius: 0.5, parts: { b: part(9, 9, 2, [4, 0, 1], (gr) => { for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) { const d = Math.hypot(x - 4, y - 4); if (d < 4.6) gr.set(x, y, d > 3.6 ? 0 : 1, d > 3.6 ? 0xc89a3a : 0xbfe8ff, d > 3.6 ? 0 : 1); } }) }, layout: { b: [0, 0, 0] } });
    // a jar: amber glass, a checked cloth over the lid tied with string
    M.tl_jar = () => ({ unit: 16, radius: 0.5, parts: { b: part(6, 8, 6, [3, 0, 3], (gr) => { gr.box(0, 0, 0, 5, 5, 5, 0xe0962a); gr.box(1, 1, 1, 4, 4, 4, 0xf2b84a); for (let z = -0; z < 6; z++) for (let x = 0; x < 6; x++) gr.set(x, 6, z, (x + z) & 1 ? 0xd8343a : 0xf4f0e6); gr.box(1, 7, 1, 4, 7, 4, 0xd8343a); }) }, layout: { b: [0, 0, 0] } });
    // a cosy thing: a moss tuft with a smooth pebble and a feather
    M.tl_cozy = () => ({ unit: 16, radius: 0.5, parts: { b: part(8, 4, 8, [4, 0, 4], (gr) => { for (let z = 0; z < 8; z++) for (let x = 0; x < 8; x++) { const d = Math.hypot(x - 3.5, z - 3.5); if (d < 3.6) gr.set(x, 0, z, (x * 7 + z) % 3 ? 0x5a8a3a : 0x6aa04a); if (d < 2.2) gr.set(x, 1, z, 0x4a7a32); } gr.box(5, 1, 5, 6, 2, 6, 0xb8b0a4); for (let y = 1; y < 4; y++) gr.set(2, y, 5 - y, 0xf4f0e6); }) }, layout: { b: [0, 0, 0] } });
    // a little flower: a stem, two leaves, a pink bloom with a yellow eye
    M.tl_bloom = () => ({ unit: 16, radius: 0.4, parts: { b: part(5, 8, 5, [2, 0, 2], (gr) => { for (let y = 0; y < 5; y++) gr.set(2, y, 2, 0x4a8a32); gr.set(1, 2, 2, 0x5aa040); gr.set(3, 3, 2, 0x5aa040); for (let z = 1; z < 4; z++) for (let x = 1; x < 4; x++) gr.set(x, 6, z, x === 2 && z === 2 ? 0xffd84a : 0xf07aa8); gr.set(2, 7, 2, 0xf07aa8); gr.set(2, 5, 2, 0xf07aa8); }) }, layout: { b: [0, 0, 0] } });
    // the plot's stake: a peeled stick with a red ribbon
    M.tl_stake = () => ({ unit: 16, radius: 0.6, parts: { b: part(5, 20, 3, [2, 0, 1], (gr) => { gr.box(2, 0, 1, 2, 17, 1, 0xc8a070); gr.box(2, 18, 1, 2, 19, 1, 0xa88050); for (let y = 13; y < 16; y++) for (let x = 0; x < 5; x++) if (x !== 2) gr.set(x, y - (x === 0 || x === 4 ? 1 : 0), 1, 0xd8343a); }) }, layout: { b: [0, 0, 0] } });
    // the beacon: a round stone tower 3.5 blocks tall, a brass bowl on top; lit, the bowl holds a warm flame
    // (f-polish8: its stages — 0 the dark bowl · 1 the lens set in it, a pale gleam · 2, 3 the lens brighter, a small
    // lamp on the rim for each light · 4 awake: three lamps, a small flame over the bright lens · lit: the full flame)
    const beacon = (lit, stage) => () => ({ unit: 6, radius: 4, parts: { b: part(15, 30, 15, [7, 0, 7], (gr) => {
      for (let y = 0; y < 24; y++) for (let z = 0; z < 15; z++) for (let x = 0; x < 15; x++) {
        const d = Math.hypot(x - 7, z - 7), R0 = y < 3 ? 6.6 : 5.2 - y * 0.06; if (d > R0 || d < R0 - 1.6) continue;
        const c = ((Math.floor(y / 3) + Math.floor(Math.atan2(z - 7, x - 7) * 2.6)) & 1) ? 0xa8a49a : 0x928e84; gr.set(x, y, z, (x * 3 + y * 5 + z) % 11 === 0 ? 0x6a8a4a : c, 0);
      }
      for (let z = 0; z < 15; z++) for (let x = 0; x < 15; x++) { const d = Math.hypot(x - 7, z - 7); if (d < 6.2) gr.set(x, 24, z, 0xb88a3a); if (d > 5 && d < 6.4) { gr.set(x, 25, z, 0xc89a4a); gr.set(x, 26, z, 0xa87a2a); } }
      if (lit) for (let y = 25; y < 30; y++) for (let z = 0; z < 15; z++) for (let x = 0; x < 15; x++) { const d = Math.hypot(x - 7, z - 7); if (d < 4.6 - (y - 25) * 0.9) gr.set(x, y, z, y > 27 ? 0xfff2b0 : 0xffb84a, 1); }
      else {
        const st = stage | 0, glowR = [0, 1.2, 2.3, 3.5, 4.5][st], lensC = [0x3a3430, 0x9fd0f0, 0xbfe8ff, 0xe0f6ff, 0xf4fbff][st];
        for (let z = 0; z < 15; z++) for (let x = 0; x < 15; x++) { const d = Math.hypot(x - 7, z - 7); if (d < 4.4) gr.set(x, 25, z, st === 0 ? 0x3a3430 : d < 3.6 ? lensC : 0xc89a3a, st > 0 && d < glowR ? 1 : 0); }
        // the rim's lamps: one for each light brought (stage 2: one, 3: two, 4: three)
        for (let k = 0; k < Math.max(0, st - 1); k++) { const a = k * 2.094 + 0.5, x = Math.round(7 + Math.cos(a) * 5.6), z = Math.round(7 + Math.sin(a) * 5.6); gr.set(x, 27, z, 0xffc860, 1); gr.set(x, 28, z, 0xfff0b0, 1); }
        if (st >= 4) for (let y = 26; y < 28; y++) for (let z = 0; z < 15; z++) for (let x = 0; x < 15; x++) { const d = Math.hypot(x - 7, z - 7); if (d < 1.9 - (y - 26) * 0.9) gr.set(x, y, z, y > 26 ? 0xfff2b0 : 0xffb84a, 1); }
      }
    }) }, layout: { b: [0, 0, 0] } });
    for (let k = 0; k <= 4; k++) M['tl_beacon_s' + k] = beacon(false, k);
    M.tl_beacon = beacon(false, 0); M.tl_beacon_lit = beacon(true);
  }

  // ---------------------------------------------------------------- the test API (test/tales.mjs)
  TL.test = {
    rec: () => TL.rec(VR.game),
    offer: () => (S.offer ? { t: S.offer.tale.t, v: S.offer.tale.v, who: S.offer.a.p.name, pid: S.offer.a.p.id, ask: askText(VR.game, S.offer.tale) } : null),
    make: (pid, want) => {   // an offer by that person now (the tests: a chosen template, the cool-down skipped)
      const g = VR.game, V = g.villages, a = V.agents.find(x => x.p && String(x.p.id) === String(pid)); if (!a) return null;
      const rec = TL.rec(g), ctx = ctxFor(V, a); let tale = null;
      for (let k = 0; k < 60 && !tale; k++) { ctx.n = (rec.n | 0) + k; const q = TC.make(ctx, want ? { hist: TC.list().filter(x => x !== want).map(x => ({ t: x, v: '' })).slice(-1) } : rec); if (q && (!want || q.t === want)) tale = q; }
      if (!tale) return { none: true, opts: TC.options(ctx).map(o => o.t), ctx: { fairy: ctx.fairy.length, kids: ctx.giver.kids.length, hills: ctx.hills.length, gate: !!ctx.gate, vil: ctx.villages.length, tod: ctx.tod } };
      if (S.offer) S.offer.a.tlOffer = false;
      S.offer = { a, tale, t: now(g) }; a.tlOffer = true; say(a, T('g.tl.hook.0', vars(g, tale)), 5);
      return { t: tale.t, v: tale.v, way: tale.way, steps: tale.steps.map(s => s.id), nm: TC.vars(tale, T) };
    },
    accept: () => { const g = VR.game; if (!S.offer) return false; accept(g.villages, S.offer.a); return true; },
    cur: () => { const c = TL.rec(VR.game).cur; return c ? { t: c.t, v: c.v, i: c.i, n: c.steps.length, st: c.st, step: TC.cur(c) ? TC.cur(c).id : null, target: TC.target(c), line: lineOf(VR.game, c), role: c.role } : null; },
    tale: () => TL.rec(VR.game).cur,
    placed: (x, y, z, s) => TL.placed(VR.game, x, y, z, s),
    kid: () => (S.kid ? { ph: S.kid.ph, pos: S.kid.a.pos.slice(), name: S.kid.a.p.name } : null),
    fl: () => (S.fl ? { ph: S.fl.ph, pos: S.fl.pos } : null),
    hud: () => S.line,
    last: () => S.lastEnd || null,
    log: () => S.log.slice(),
    cost: () => Object.assign({}, S.cost, { avg: S.cost.ticks ? S.cost.ms / S.cost.ticks : 0 }),
    marks: () => { const c = TL.rec(VR.game).cur; return c ? TL.marks(VR.game, c) : []; },
    cool: () => { const r = TL.rec(VR.game); r.cool = 0; },
    markY: (x, z, y) => { S.yc[Math.round(x) + ',' + Math.round(z)] = y; },
    diag: () => ({ lit: TL.rec(VR.game).lit, litDrawn: S.litDrawn | 0, glows: S.glows | 0, draws: S.cost.draws, err: TL.drawErr || null, stage: TL.stage(TL.rec(VR.game).cur) }),
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

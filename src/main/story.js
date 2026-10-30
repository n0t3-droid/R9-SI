// ============================================================================
// Der Spieler der Geschichte (a-story; plan docs/superpowers/plans/2026-10-29-a-story.md §2, spec
// docs/superpowers/specs/2026-10-22-abenteuer-design.md §9, erlebnis §5). The beats of src/shared/story.js played like
// a cartoon film:
//   · the offer — once a second the brain asks VR.Story.next with the context of now (calm: 20 s without building, a
//     fight, a menu, a landing or another camera; the place, the hour, the outposts, the height, the orbit, the moon,
//     the eclipse); a beat that holds is handed to the Regie (regie.js) as an offer of weight 4, and when the Regie takes
//     it Funke says „Ich empfange ein Signal … [V] ansehen" and a small card shows 🎬 Ansehen [V] · Später
//   · V (the Aktion's row 3, ctx.js: VR.Ctx.hooks.story / VR.Story.watch) plays the scene: letterbox bars, the lines as
//     subtitles with the speaker's name, the director camera's shots (close · shoulder · wide · orbit · up · limb · ice ·
//     eye, framed by the target and lifted over the ground — DirCam.lift), ≤ 30 s; any key skips after 1 s (the lines go
//     to the journal); the player stands while it plays
//   · Später (the card's button, or the card untaken for 25 s): again in 5 min, three reminders, then the beat waits
//     silently in the journal — never forced on anyone, a builder included
//   · after a scene: XP (VR.Adventure.award('beat')), the beat's task as Funke's line and his Wegstück — the light line
//     toward the target (funke.js startWay; F.addSource keeps it his way's target)
//   · the journal's chapter page (VR.Quests.journalSections): the book's title, the chapter, the beats seen with their
//     lines, ▶ Ansehen for the beat waiting, ↺ for one seen, the chapters to come as loglines
//   · ch. 2 · the freeing's light ring replayed round the freed beacon (liberate.js's moment, its rewards not again);
//     ch. 3 · the Ringstation's red beacon blinking just over the limb (one additive glare draw in the space scene's list,
//     only while chapter 3's station beat is open); ch. 4 · the Eiswächter under Opal's ice, seen through it (a sentry's
//     mesh ×4, ice-blue and translucent, one cyan eye; drawn only during its scene)
//   · multiplayer: a guest is never offered a beat (the host's beats play at the host's place)
// Kindersicher and Friedlich: no beat needs a fight (an outpost frees by Beruhigen too). Switch ⚙ Spiel „Geschichte"
// (storyOffer, on): off, nothing is offered — the journal still plays the waiting beat. Cost 🟢: a 1-Hz brain; nothing
// drawn outside a scene. Hooks: game.js (the frame, the camera, the player held — three marked lines), lifedirector.js
// (the Regie's question — two), build.js.
// ============================================================================
(function (VR) {
  'use strict';
  const S = VR.Story; if (!S) return;
  const P = VR.StoryPlay = VR.StoryPlay || {};
  const T = (k, v) => (VR.I18N ? VR.I18N.t(k, v) : k);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hasDoc = typeof document !== 'undefined' && !!document.createElement;
  const DEG = Math.PI / 180, TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  const game = () => VR.game || null;
  const lookAt = (C, Q, fov, base) => { const dx = Q[0] - C[0], dy = Q[1] - C[1], dz = Q[2] - C[2]; return Object.assign({}, base, { x: C[0], y: C[1], z: C[2], yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)), roll: 0, fov: fov * DEG, fixed: true }); };
  const keyLabel = () => { const B = VR.Binds, code = B && B.current && B.current.slots ? (B.current.slots('veh') || ['KeyV'])[0] || 'KeyV' : 'KeyV'; return B && B.label ? B.label(code, (VR.I18N && VR.I18N.lang) || 'de') : 'V'; };
  P.stats = { offers: 0, scenes: 0, skips: 0, laters: 0, brainMs: 0, brains: 0, drawMs: 0 };

  if (VR.Settings && VR.Settings.add) VR.Settings.add({ key: 'storyOffer', g: 'play', sec: 'play', t: 'switch', lab: 'g.set.storyOffer', tip: 'g.set.storyOffer.tip', cost: 'low', def: true });

  // ---------------------------------------------------------------- the context of now (→ Story.why)
  const FIGHT = { notice: 1, approach: 1, tele: 1, strike: 1, recover: 1, chase: 1, attack: 1 };
  P.fighting = function (g) {
    const L = VR.Liberate; if (L && (L.ringSite || L.moment || L.calmSt || L.puz)) return true;
    const en = g.entities, p = g.player.pos; if (!en || !en.mobs) return false;
    for (const m of en.mobs) { const f = m.foe; if (!f || f.gone || f.helper || !FIGHT[f.st]) continue; if (Math.hypot(m.pos[0] - p[0], m.pos[2] - p[2]) < 40) return true; }
    return false;
  };
  P.building = (g) => { const F = g.funke; return !!(F && ((F.buildFocus && F.buildFocus()) || (F.budget && F.budget.quiet(g.time || 0)))); };
  P.otherCam = (g) => !!((g.director && g.director.active) || (g.wow && g.wow.active) || (VR.Liberate && VR.Liberate.mcam) || (g.photoCam && g.photoCam.on) || (VR.Zeit && VR.Zeit.active) || (g.funke && g.funke.shot));
  P.landing = (g) => { const fl = g.flight, a = fl && fl.auto; return !!((g.arrival && g.arrival.holds && g.arrival.holds()) || (a && (a.space === 'land' || a.space === 'descend' || a.land)) || (VR.Travel && VR.Travel.busy && VR.Travel.busy(g)) || (VR.Intent && VR.Intent.current && VR.Intent.current() && VR.Intent.current().phase)); };
  P.orbit = (g) => !!(g.space || (g.flight && g.flight.regime === 'space'));
  P.adv = () => { const A = VR.Adventure; try { return !!(A && A.on && A.on()); } catch (e) { return false; } };
  P.sites = function () { const L = VR.Liberate; try { return L && L.sites ? Array.from(L.sites().values()) : []; } catch (e) { return []; } };
  P.nearSite = function (g, free) {
    const p = g.player.pos; let best = null, bd = Infinity;
    for (const s of P.sites()) { if (free !== undefined && (s.st === 'frei') !== free) continue; const d = Math.hypot(s.x - p[0], s.z - p[2]); if (d < bd) { bd = d; best = s; } }
    return best ? { s: best, d: bd } : null;
  };
  P.ctxOf = function (g, pl) {
    const p = g.player, ui = g.ui, n = P.nearSite(g, false), A = VR.Adventure;
    let freed = 0; for (const s of P.sites()) if (s.st === 'frei') freed++;
    try { const fr = A && A.rec && A.rec.freed; if (fr) freed = Math.max(freed, Object.keys(fr).length); } catch (e) { /* optional */ }
    const BS = VR.BodySky, sea = (VR.C && VR.C.SEA) || 64;
    return {
      calm: pl ? pl.calm : 0, building: P.building(g), fighting: P.fighting(g), menu: !!(ui && (ui.screen || ui.typing)), studio: !!g.studioOpen,
      landing: P.landing(g), scene: P.otherCam(g) || !!(pl && pl.scene), guest: !!((g.meta && g.meta.guest) || (g.mp && g.mp.isClient)),
      place: g.lifeDirector && g.lifeDirector.ctx ? g.lifeDirector.ctx.place : '', hour: g.lifeDirector && g.lifeDirector.ctx ? g.lifeDirector.ctx.hour : '',
      played: pl ? pl.played : 0, adv: P.adv(), dim: g.dim || 'overworld', near: { outpost: n ? n.d : Infinity }, freed,
      high: p.pos[1] - sea, orbit: P.orbit(g), eclipse: BS && BS.cur && BS.cur.light ? BS.cur.light.eclipse || 0 : 0, kids: !!(g.settings && g.settings.kids),
    };
  };

  // a-story2: what the view sees for a deed (→ Story.actCheck): the angle and the distance to its target, the pitch, the
  // height, the moon, the eclipse, the ground (the frame's camera: on foot, in a ship, in the photo mode alike)
  P.actCtx = function (g, act) {
    const p = g.player, cam = g.cam || { x: p.pos[0], y: p.pos[1] + 1.6, z: p.pos[2], yaw: p.yaw || 0, pitch: p.pitch || 0 };
    const cp = Math.cos(cam.pitch || 0), d = [-Math.sin(cam.yaw || 0) * cp, Math.sin(cam.pitch || 0), -Math.cos(cam.yaw || 0) * cp], e = [cam.x, cam.y, cam.z];
    const BS = VR.BodySky, L = BS && BS.cur && BS.cur.light, sea = (VR.C && VR.C.SEA) || 64;
    const a = { pitch: (cam.pitch || 0) / DEG, high: p.pos[1] - sea, orbit: P.orbit(g), dim: g.dim || 'overworld', eclipse: L ? L.eclipse || 0 : 0, ground: !!p.onGround };
    const toward = (Q) => { if (!Q) return; const v = [Q[0] - e[0], Q[1] - e[1], Q[2] - e[2]], L0 = Math.hypot(v[0], v[1], v[2]) || 1; a.dist = L0; a.ang = Math.acos(clamp((v[0] * d[0] + v[1] * d[1] + v[2] * d[2]) / L0, -1, 1)) / DEG; };
    const k = act.target;
    if (k === 'vista') {
      let best = null, ba = 999;
      if (g.wow && g.wow.list) for (const v of g.wow.list.values()) { const Q = [v.x + 0.5, (v.y || e[1]) + 1, v.z + 0.5], dd = Math.hypot(Q[0] - e[0], Q[2] - e[2]); if (dd > act.max) continue; toward(Q); if (a.ang < ba) { ba = a.ang; best = Q; } }
      a.dist = undefined; a.ang = undefined; toward(best);
    } else if (k === 'outpost') { const n = P.nearSite(g, false) || P.nearSite(g); if (n) toward([n.s.x + 0.5, (n.s.y || e[1]) + 3, n.s.z + 0.5]); }
    else if (k === 'beacon' || k === 'beam') {
      const n = k === 'beam' ? P.nearSite(g, true) : P.nearSite(g), bc = n && n.s.beacon;
      if (bc) { if (k === 'beam') toward([bc[0] + 0.5, bc[1] + 14, bc[2] + 0.5]); else { toward([bc[0] + 0.5, bc[1] + 1.2, bc[2] + 0.5]); a.dist = Math.hypot(bc[0] + 0.5 - p.pos[0], bc[2] + 0.5 - p.pos[2], (bc[1] + 1) - (p.pos[1] + 1) ); } }
    } else if (k === 'amarant') {
      const md = L && g.dim !== 'overworld' ? L.moonDir : null;
      if (md && md[1] > -0.05) a.ang = Math.acos(clamp(md[0] * d[0] + md[1] * d[1] + md[2] * d[2], -1, 1)) / DEG;
    }
    return a;
  };

  // ---------------------------------------------------------------- the player of one world
  class Player {
    constructor(g) {
      this.g = g; this.world = g.world;
      this.rec = S.load(g.meta && g.meta.story); if (g.meta) g.meta.story = this.rec;
      this.calm = 0; this.played = 0; this.brainT = 1; this.want = null; this.offer = null; this.scene = null; this.wayTg = null; this.wayKind = null;
      this.lastWhy = '';
    }
    save() { const g = this.g; if (g.meta) g.meta.story = this.rec; if (g.saveMeta && g.meta && !g.meta.guest) { try { const q = g.saveMeta(); if (q && q.catch) q.catch(() => {}); } catch (e) { /* the autosave keeps it */ } } }
    update(dt) {
      const g = this.g; if (g.state !== 'play' || !g.player) return;
      this.played += dt;
      // (calm: the cheap checks every frame, the foes' and the cameras' twice a second)
      if ((this.calmCheckT = (this.calmCheckT || 0) - dt) <= 0) { this.calmCheckT = 0.5; this.loud = P.fighting(g) || P.landing(g) || P.otherCam(g); }
      const busy = !!this.scene || this.loud || P.building(g) || !!(g.ui && (g.ui.screen || g.ui.typing));
      this.calm = busy ? 0 : this.calm + dt;
      if (this.scene) this.step(dt);
      if (this.offer) this.offerTick(dt);
      if ((this.brainT -= dt) <= 0) { this.brainT = 1; this.brain(); }
      // a-story2: the deed between the beats (a 4-Hz watch), its hint a few seconds after the task's line
      if (!this.scene && (this.actT = (this.actT || 0) - dt) <= 0) { this.actT = 0.25; this.actTick(0.25); }
      if (this.actHint && !this.scene && (this.actHint.t -= dt) <= 0) { const b = this.actHint.b; this.actHint = null; const o = S.openAct(this.rec), fk = g.funke; if (o === b && fk && fk.show && fk.on && fk.on()) fk.show(T('story.act.' + b.id)); }
    }
    // ---- a-story2 · the deed (look · scan · touch · photo): S.actStep on what the view sees now
    actTick(dt, ev) {
      const g = this.g, b = S.openAct(this.rec);
      this.armed = null;
      if (!b || g.settings && g.settings.storyOffer === false) return false;
      const a = P.actCtx(g, b.act); if (ev) Object.assign(a, ev);
      const st = this.actSt && this.actSt.id === b.id ? this.actSt : (this.actSt = { id: b.id });
      const done = S.actStep(st, b.act, a, dt);
      if (done) { this.actDone(b); return true; }
      if (st.last === 'armed') this.armed = b;
      return false;
    }
    actDone(b) {
      const g = this.g; S.markAct(this.rec, b.id); this.armed = null; this.actHint = null; P.stats.acts = (P.stats.acts || 0) + 1;
      const fk = g.funke; if (fk && fk.show && fk.on && fk.on()) fk.show(T(b.act.kind === 'scan' ? 'story.act.scanning' : 'story.act.done'));
      else if (g.ui && g.ui.hint) g.ui.hint(T('story.act.done'), 3000);
      if (g.audio && g.audio.play) { try { g.audio.play('ping', { vol: 0.4 }); } catch (e) { /* a sound */ } }
      const A = VR.Adventure; if (A && A.award) { try { A.award('beat', { id: 'act:' + b.id, xp: 30 }); } catch (e) { /* optional */ } }
      if (VR.EventLog) VR.EventLog.emit('story', 'act:' + b.id, 2, null, 'act');
      this.save();
      if (VR.Quests && g.ui && g.ui.screen === 'journal') VR.Quests.renderJournal();
    }
    press() { return this.armed ? this.actTick(0, { press: true }) : false; }
    photo() { return this.actTick(0, { photo: true }); }
    brain() {
      const g = this.g, t0 = typeof performance !== 'undefined' ? performance.now() : 0;
      this.want = null;
      if (!this.scene && !this.offer && g.settings && g.settings.storyOffer !== false) {
        const ctx = P.ctxOf(g, this), b = S.open(this.rec);
        this.lastWhy = b ? (S.due(this.rec, b.id, g.time || 0) ? S.why(b, ctx, this.rec) || 'ready' : 'later') : 'end';
        const nb = S.next(this.rec, ctx, g.time || 0);
        if (nb) { this.want = nb; if (!VR.Regie || !VR.Regie.of(g)) this.announce(nb); }
      }
      if (t0) { P.stats.brainMs += performance.now() - t0; P.stats.brains++; }
    }
    // ---- the offer
    announce(b) {
      const g = this.g; if (this.offer || this.scene) return false;
      const q = this.rec.later[b.id], again = !!(q && q.n > 0);
      this.offer = { b, t: 0 }; this.want = null; P.stats.offers++;
      const text = T(again ? 'story.remind' : 'story.offer', { key: keyLabel() });
      const fk = g.funke; if (fk && fk.on && fk.on() && fk.show) fk.show(text); else if (g.ui && g.ui.hint) g.ui.hint(text, 4000);
      if (g.audio && g.audio.play) { try { g.audio.play('ping', { vol: 0.5 }); } catch (e) { /* a sound */ } }
      try { card(this); } catch (e) { /* the card is a convenience: [V] and the journal work without it */ }
      if (VR.EventLog) VR.EventLog.emit('story', b.id, 2, null, 'offer');   // a-regie: the offer is seen (Funke's line, the card) — not a beat (sessionstats counts beats without src 'offer'); taken at once, it and its beat are one moment
      return true;
    }
    offerTick(dt) {
      const o = this.offer; o.t += dt;
      const ctx = P.ctxOf(this.g, this);
      if (o.t > S.CARD || ctx.building || ctx.fighting || ctx.landing) this.later(false);
    }
    later(said) {
      const o = this.offer; if (!o) return;
      S.later(this.rec, o.b.id, this.g.time || 0); this.offer = null; P.stats.laters++;
      card(null);
      if (said) { const fk = this.g.funke; if (fk && fk.show) fk.show(T('story.later.ok')); }
      this.save();
    }
    // ---- the scene
    watch(b) {
      const g = this.g; b = b || (this.offer && this.offer.b) || S.open(this.rec);
      if (!b || this.scene || (g.meta && g.meta.guest)) return false;
      this.offer = null; card(null);
      if (g.ui && g.ui.screen) { try { if (g.ui.screen === 'journal' && VR.Quests) VR.Quests.closeJournal(); else g.ui.resume && g.ui.resume(); } catch (e) { /* the menu */ } }
      const texts = b.scene.lines.map(l => T(l.key)), tl = S.timeline(b, texts);
      const sc = this.scene = { b, t: 0, texts, tl, len: tl.len, line: -1, shot: -1, tg: {}, seen: S.isDone(this.rec, b.id) };
      this.resolve(sc);
      if (VR.Regie) VR.Regie.inScene(g, true);
      if (VR.EventLog) VR.EventLog.emit('story', b.id, 4, null, 'story');
      // in orbit the ship's view holds, levelled on the horizon (the limb across the frame, the station above it)
      const fl = g.flight; if (P.orbit(g) && fl) { sc.fl0 = { hp: fl.headPitch, hy: fl.headYaw }; fl.headPitch = 0.07; fl.headYaw = 0; }
      P.stats.scenes++;
      // ch. 2: the light ring replayed round the freed beacon (the moment's sights and its chord, not its rewards): it
      // leaves the beacon a second in, with Funke's first line
      if (b.id === 'c2.b2' && sc.tg.beacon && sc.tg.site && VR.Liberate && !VR.Liberate.moment) {
        const L = VR.Liberate; L.moment = { s: sc.tg.site, t: L.RING_T0 - 1.05, done: new Set(['flicker', 'cyan', 'beam', 'ring', 'stand', 'funke', 'banner']), replay: true };
      }
      overlay(this, true);
      return true;
    }
    // the targets of the scene, fixed at its start (the player and Funke move with it)
    resolve(sc) {
      const g = this.g, p = g.player, eye = p.eyePos ? p.eyePos() : [p.pos[0], p.pos[1] + 1.6, p.pos[2]], yaw = p.yaw, w = g.world;
      const fwd = [-Math.sin(yaw), 0, -Math.cos(yaw)];
      const ahead = (d, h) => [eye[0] + fwd[0] * d, eye[1] + (h || 0), eye[2] + fwd[2] * d];
      const top = (x, z, d) => (w && w.isLoaded && w.isLoaded(Math.floor(x), Math.floor(z)) ? w.topAt(Math.floor(x), Math.floor(z)) + 1 : d);
      // the floor under the eye's level (not the column's top: under the Hangar Hall's roof the top is the roof — run 5's
      // close shot was lifted onto it), and whether a point is free
      const R0 = VR.R, SOLID = VR.F ? VR.F.SOLID : 1, y0 = Math.floor(eye[1]) + 2;
      const solid = (x, y, z) => { const b = w && w.getBlock ? w.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)) : 0; return !!(b && R0 && (R0.T.flags[b] & SOLID)); };
      sc.ground = (x, z) => { if (!w || !w.isLoaded || !w.isLoaded(Math.floor(x), Math.floor(z))) return null; for (let y = y0; y > y0 - 40; y--) if (solid(x, y, z)) return y + 1; return null; };
      sc.free = (C) => !solid(C[0], C[1], C[2]) && !solid(C[0], C[1] + 0.4, C[2]);
      sc.eye0 = eye; sc.yaw0 = yaw; sc.fwd = fwd;
      // the vista: the nearest one in front (wow moments' list), else 90 m ahead
      let vista = null, vd = 400;
      if (g.wow && g.wow.list) for (const v of g.wow.list.values()) { const dx = v.x - eye[0], dz = v.z - eye[2], d = Math.hypot(dx, dz); if (d > 30 && d < vd && (dx * fwd[0] + dz * fwd[2]) > 0) { vd = d; vista = [v.x + 0.5, (v.y || eye[1]) + 1, v.z + 0.5]; } }
      sc.tg.vista = vista || ahead(90, 4);
      const n = P.nearSite(g), b = n && n.d < 160 && n.s.beacon ? n.s.beacon : null;
      sc.tg.site = n && n.d < 160 ? n.s : null;
      sc.tg.beacon = b ? [b[0] + 0.5, b[1] + 1.2, b[2] + 0.5] : null;
      sc.tg.outpost = n ? [n.s.x + 0.5, (n.s.y || eye[1]) + 3, n.s.z + 0.5] : ahead(120, 2);
      sc.tg.horizon = ahead(1500, 0);
      sc.tg.sky = ahead(60, 60);
      const BS = VR.BodySky, md = BS && BS.cur && BS.cur.light && g.dim !== 'overworld' ? BS.cur.light.moonDir : null;
      sc.tg.amarant = md && md[1] > -0.05 ? [eye[0] + md[0] * 200, eye[1] + md[1] * 200, eye[2] + md[2] * 200] : ahead(80, 70);
      // the Eiswächter: 8 m ahead, standing frozen in the ice — its head 1.6 m under the surface — and facing the player
      const wx = eye[0] + fwd[0] * 8, wz = eye[2] + fwd[2] * 8, wy = top(wx, wz, eye[1] - 1.6);
      sc.tg.warden = [wx, wy - 1.6 - P.WARDEN_H * P.WARDEN_SCALE, wz]; sc.wardenYaw = Math.atan2(fwd[0] + fwd[2] * 0.6, fwd[2] - fwd[0] * 0.6); sc.surf = wy;   // (a-story2: its own model, facing the player, a little turned)
    }
    target(sc, name) {
      const g = this.g, p = g.player;
      if (name === 'player') return [p.pos[0], p.pos[1] + 1.2, p.pos[2]];
      if (name === 'funke') { const f = g.funke; return f && f.pos ? [f.pos[0], f.pos[1], f.pos[2]] : [p.pos[0], p.pos[1] + 1.7, p.pos[2]]; }
      if (name === 'beacon') return sc.tg.beacon || this.target(sc, 'funke');
      if (name === 'warden') { const W = sc.tg.warden; return [W[0], W[1] + (29 / 16) * P.WARDEN_SCALE, W[2]]; }   // (its shoulders)
      return sc.tg[name] || sc.tg.horizon;
    }
    step(dt) {
      const sc = this.scene; sc.t += dt;
      let li = -1; for (const q of sc.tl.lines) if (sc.t >= q.t0 && sc.t < q.t1) li = q.i;
      if (li !== sc.line) { sc.line = li; subtitle(sc, li); }
      if (sc.por) P.porTick(sc);   // a-story2: the speaker's face blinks and talks
      if (sc.t >= sc.len) this.end(false);
    }
    skip() { const sc = this.scene; if (!sc || sc.t < S.SKIP_AFTER) return false; P.stats.skips++; this.end(true); return true; }
    end(skipped) {
      const g = this.g, sc = this.scene; if (!sc) return;
      this.scene = null; overlay(this, false);
      if (VR.Regie) VR.Regie.inScene(g, false);
      if (sc.fl0 && g.flight) { g.flight.headPitch = sc.fl0.hp; g.flight.headYaw = sc.fl0.hy; }
      if (sc.b.id === 'c2.b2' && VR.Liberate && VR.Liberate.moment && VR.Liberate.moment.replay) VR.Liberate.moment = null;
      if (sc.seen) return;   // (watched again from the journal)
      S.mark(this.rec, sc.b.id, skipped ? 'skip' : 'done');
      const A = VR.Adventure; if (A && A.award) { try { A.award('beat', { id: sc.b.id, xp: sc.b.reward.xp }); } catch (e) { /* optional */ } }
      this.save();
      this.task(sc.b);
      if (VR.Quests && g.ui && g.ui.screen === 'journal') VR.Quests.renderJournal();
    }
    // the beat's task: Funke's line and his Wegstück toward its target
    task(b) {
      const g = this.g, fk = g.funke, k = b.task.kind;
      this.wayKind = b.task.target;
      if (b.act) this.actHint = { b, t: 6 };   // a-story2: the deed's line after the task's
      if (!fk || !fk.on || !fk.on()) return;
      if (fk.show) fk.show(T('story.task.' + k));
      const tg = P.wayTarget(g) || (b.task.target === 'vista' && fk.target ? fk.target(false) : null);   // (the vista: Funke's own — the nearest unseen one)
      if (tg && fk.startWay) { try { fk.startWay(tg); } catch (e) { /* the way */ } }
    }
    // the camera of the frame while a scene plays (null: the game's own)
    cam(base) {
      const sc = this.scene; if (!sc) return null;
      if (P.orbit(this.g)) return null;   // (in orbit the ship's view holds; the station is put above the limb in it)
      const at = S.shotAt(sc.b, sc.t); if (!at) return null;
      if (at.i !== sc.shot) { sc.shot = at.i; sc.a0 = null; }
      return this.pose(sc, at.shot, at.u, base);
    }
    pose(sc, sh, u, base) {
      const c = this.pose0(sc, sh, u, base);
      if (c && sh.cam !== 'shoulder' && sh.cam !== 'ice' && sh.cam !== 'eye' && sc.free && !sc.free([c.x, c.y, c.z])) { (sc.blocked || (sc.blocked = {}))[sc.shot] = true; return this.pose0(sc, { cam: 'shoulder', target: sh.target, dur: sh.dur }, u, base); }
      return c;
    }
    pose0(sc, sh, u, base) {
      const g = this.g, p = g.player, e = sc.eye0, Q = this.target(sc, sh.target), f = sc.fwd, rt = [-f[2], 0, f[0]];
      const lift = (C, S0) => (VR.DirCam && VR.DirCam.lift ? VR.DirCam.lift(sc.ground, C, S0) : C);
      const pe = [p.pos[0], p.pos[1] + 1.6, p.pos[2]];
      switch (sh.cam) {
        case 'close': {
          // beside the subject, a little below its eye line, on the player's side; a slow push-in
          const d = (sh.target === 'funke' ? 2.3 : 4.5) * (1 - 0.15 * smooth(u)), dir = [pe[0] - Q[0], 0, pe[2] - Q[2]], L0 = Math.hypot(dir[0], dir[2]);
          if (L0 < 0.3 || sh.target === 'funke') { dir[0] = f[0]; dir[2] = f[2]; }   // (Funke: from in front, looking back at it with the player behind — the hall, not the sky, behind them)
          const L = Math.hypot(dir[0], dir[2]) || 1, sx = dir[0] / L, sz = dir[2] / L, C = [Q[0] + (sx * 0.8 + sz * 0.6) * d, Q[1] + (sh.target === 'funke' ? 0.32 : -0.18) * d, Q[2] + (sz * 0.8 - sx * 0.6) * d];   // (Funke a little from above: the deck and the land behind him, not the bright sky)
          // (a little from below — the hero's angle — the subject a touch above the middle)
          return lookAt(lift(C, Q), [Q[0], Q[1] - (sh.target === 'funke' ? 0.05 : 0.12) * d, Q[2]], sh.target === 'funke' ? 52 : 50, base);
        }
        case 'shoulder': {
          const C = [pe[0] - f[0] * 2.4 + rt[0] * 0.75, pe[1] + 0.35, pe[2] - f[2] * 2.4 + rt[2] * 0.75];
          const M = [Q[0] * 0.9 + pe[0] * 0.1, Q[1], Q[2] * 0.9 + pe[2] * 0.1];
          return lookAt(lift(C, pe), M, 58 - 4 * u, base);
        }
        case 'wide': {
          // high and back: the player small in the lower third, the target beyond
          const dx = Q[0] - pe[0], dz = Q[2] - pe[2], L = Math.hypot(dx, dz) || 1, D = 15 + 5 * u, C = [pe[0] - dx / L * D + rt[0] * 4, pe[1] + 7 + 2 * u, pe[2] - dz / L * D + rt[2] * 4];
          const far = L > 40 ? Q : [pe[0] + dx / L * 40, pe[1] + 4, pe[2] + dz / L * 40];
          return lookAt(lift(C, pe), [far[0] * 0.7 + pe[0] * 0.3, far[1] * 0.7 + pe[1] * 0.3, far[2] * 0.7 + pe[2] * 0.3], 64, base);
        }
        case 'orbit': {
          if (sc.a0 === null || sc.a0 === undefined) sc.a0 = Math.atan2(pe[0] - Q[0], pe[2] - Q[2]);
          const r = sh.target === 'beacon' ? 16 : 7, a = sc.a0 + (u - 0.5) * 1.1, C = [Q[0] + Math.sin(a) * r, Q[1] + (sh.target === 'beacon' ? 7 : 2.5), Q[2] + Math.cos(a) * r];
          return lookAt(lift(C, Q), sh.target === 'beacon' ? [Q[0], Q[1] + 3, Q[2]] : Q, 60, base);
        }
        case 'up': {
          // the sky's subject on the upper third, the land's edge in the frame below it when the subject stands low enough
          const C = [pe[0] - f[0] * 1.5, pe[1] - 0.3, pe[2] - f[2] * 1.5], fov = 66 - 8 * smooth(u), c = lookAt(C, Q, fov, base);
          c.pitch = Math.max(c.pitch * 0.55, c.pitch - fov * DEG * 0.13);   // (inside the letterbox: the subject a sixth above the middle)
          return c;
        }
        case 'limb': {
          const C = [pe[0], pe[1] + 0.2, pe[2]];
          return lookAt(C, [Q[0], C[1], Q[2]], 52, base);   // (the horizon at the eye's height: the curve shows itself)
        }
        case 'ice': {
          // from the surface in front of its face, looking down through the ice; a slow crane down
          const W = this.target(sc, 'warden'), C = [W[0] - f[0] * 7 + rt[0] * 6, sc.surf + 3.4 - 0.8 * smooth(u), W[2] - f[2] * 7 + rt[2] * 6];   // (from the side of the player — never through the player standing on the ice)   // (a-story2: higher and further back — the window, not the ice's grain, before the lens)
          return lookAt(C, [W[0], W[1] - 1.2, W[2]], 54, base);
        }
        case 'eye': {
          const E2 = sc.eyePos || this.target(sc, 'warden'), C = [E2[0] - f[0] * 6.2 + rt[0] * 1.0, sc.surf + 1.9 - 0.4 * smooth(u), E2[2] - f[2] * 6.2 + rt[2] * 1.0];
          return lookAt(C, [E2[0], E2[1] - 0.7, E2[2]], 36, base);   // (the eye on the upper third, its face and shoulders under it)
        }
        default: return null;
      }
    }
    holds() { return !!this.scene; }
    destroy() { if (this.scene) { this.scene = null; overlay(this, false); } card(null); if (VR.Regie) VR.Regie.inScene(this.g, false); }
  }
  P.Player = Player;
  P.WARDEN_SCALE = 3; P.WARDEN_H = 43 / 16;   // (a-story2: story_warden is 43 voxels tall — 8 m at ×3)

  // ---------------------------------------------------------------- the public calls
  const pl = (g) => { g = g || game(); const s = g && g.story; return s && s.world === g.world ? s : null; };
  P.of = pl;
  P.frame = function (g, dt) {
    if (g.state !== 'play' || !g.world || !g.player) return;
    if (P.frameN === g.frameN && g.frameN !== undefined) return;
    let s = g.story;
    if (!s || s.world !== g.world) { if (s) s.destroy(); s = g.story = new Player(g); }
    s.update(dt);
    if (VR.Regie && VR.Regie.frame) VR.Regie.frame(g, dt);
  };
  P.cam = (g, base) => { const s = pl(g); return s ? s.cam(base) : null; };
  P.holds = (g) => { const s = pl(g); return !!(s && s.scene); };
  P.debug = {
    play: (id) => { const s = pl(); const b = S.byId(id); return !!(s && b && s.watch(b)); },
    offer: (id) => { const s = pl(); const b = S.byId(id); return !!(s && b && s.announce(b)); },
    reach: (id) => { const s = pl(); if (!s) return false; for (const b of S.BEATS) { if (b.id === id) break; S.mark(s.rec, b.id); } s.save(); return true; },
    state: () => { const s = pl(); if (!s) return null; const sc = s.scene; return { calm: +s.calm.toFixed(1), want: s.want && s.want.id, offer: s.offer && s.offer.b.id, scene: sc ? { id: sc.b.id, t: +sc.t.toFixed(2), shot: sc.shot, line: sc.line } : null, open: (S.open(s.rec) || {}).id || null, why: s.lastWhy, beats: Object.assign({}, s.rec.beats), later: JSON.parse(JSON.stringify(s.rec.later)), chapter: S.chapter(s.rec), stats: Object.assign({}, P.stats), regie: VR.Regie ? VR.Regie.stats(s.g) : null }; },
  };
  // ctx.js row 3 (the Aktion: [V] Ansehen) and its act
  S.offer = (g) => { const s = pl(g); return s && s.offer && !s.scene ? s.offer.b : null; };
  S.watch = (g) => { const s = pl(g); if (s && !s.offer && !s.scene && s.armed) return s.press(); return !!(s && s.watch()); };
  // a-story2: an armed deed (scan, touch) takes row 3 too: „[V] Scannen" / „[V] Berühren"
  P.armedAct = (g) => { const s = pl(g); const b = s && !s.scene && !s.offer ? s.armed : null; return b && (b.act.kind === 'scan' || b.act.kind === 'touch') ? { id: b.id, ch: b.ch, act: b.act, storyAct: b.act.kind } : null; };
  if (VR.Ctx && VR.Ctx.hooks) VR.Ctx.hooks.story = (g) => S.offer(g) || P.armedAct(g);
  if (VR.Ctx && VR.Ctx.resolve && !VR.Ctx._story2) {
    VR.Ctx._story2 = true;
    const rs = VR.Ctx.resolve;
    VR.Ctx.resolve = function (c) { const r = rs.apply(this, arguments); return c && c.story && c.story.storyAct && r && r.row === 3 ? Object.assign({}, r, { key: 'story.ctx.' + c.story.storyAct, icon: c.story.storyAct === 'scan' ? '📡' : '✋' }) : r; };
  }
  // the Regie's source: the beat that holds, as an offer of weight 4
  if (VR.Regie && VR.Regie.addSource) VR.Regie.addSource(function storyOffer(g) {
    const s = pl(g); if (!s || !s.want || s.offer || s.scene) return null;
    const b = s.want;
    return [{ source: 'story', act: b.id, weight: 4, kind: 'story', place: '', eta: 0, start: () => s.announce(b) }];
  });
  // Funke's way: the open task's target (the outpost, the hangar)
  P.wayTarget = function (g) {
    const s = pl(g); if (!s || !s.wayKind) return null;
    const p = g.player.pos;
    if (s.wayKind === 'outpost') { const n = P.nearSite(g, false); if (n && n.d > 12) return { pos: [n.s.x + 0.5, n.s.y || p[1], n.s.z + 0.5], name: T('story.way.outpost'), kind: 'story' }; return null; }
    if (s.wayKind === 'home') { const sp = g.player.spawn; if (sp && Math.hypot(sp[0] - p[0], sp[2] - p[2]) > 30) return { pos: [sp[0], sp[1], sp[2]], name: T('story.way.home'), kind: 'story' }; return null; }
    return null;   // (the vista: Funke's own target — the nearest unseen vista; the sky and the moons: the ships)
  };
  if (VR.Funke && VR.Funke.addSource) VR.Funke.addSource((g) => P.wayTarget(g));

  // ---------------------------------------------------------------- the card, the letterbox, the subtitles (DOM)
  const CSS = `
#storycard { position: fixed; left: 50%; bottom: 17%; transform: translateX(-50%); z-index: 60; display: none; align-items: center; gap: 10px; padding: 9px 12px 9px 14px; border-radius: 14px;
  background: linear-gradient(180deg, rgba(20, 26, 44, .92), rgba(10, 14, 26, .92)); border: 1px solid rgba(140, 220, 255, .35); box-shadow: 0 6px 24px rgba(0, 0, 0, .45), 0 0 18px rgba(90, 210, 255, .18);
  color: #eaf6ff; font: 600 14px/1.25 system-ui, sans-serif; pointer-events: auto; animation: storyIn .35s ease-out; }
#storycard .k { color: #8fe4ff; font-size: 12px; letter-spacing: .02em; }
#storycard .t { font-size: 15px; }
#storycard button { font: 700 13px system-ui, sans-serif; border-radius: 9px; padding: 6px 11px; border: 1px solid rgba(255, 255, 255, .2); background: rgba(255, 255, 255, .08); color: #eaf6ff; cursor: pointer; }
#storycard button.w { background: linear-gradient(180deg, #4fd2ff, #2a9fd8); color: #062033; border-color: transparent; }
#storycard kbd { font: 700 11px system-ui; padding: 1px 5px; border-radius: 4px; background: rgba(6, 32, 51, .35); margin-left: 5px; }
#storybox { position: fixed; inset: 0; z-index: 58; pointer-events: none; display: none; }
#storybox .sbar { position: absolute; left: 0; right: 0; width: 100%; max-width: none; height: 11.5%; margin: 0; border-radius: 0; background: #000; transition: transform .6s ease; }
#storybox .sbar.t { top: 0; transform: translateY(-100%); } #storybox .sbar.b { bottom: 0; transform: translateY(100%); }
#storybox.on .sbar { transform: none; }
body.storyon #hud, body.storyon #funkebub, body.storyon #ctxprompt, body.storyon #wcompass, body.storyon #bhBtn, body.storyon #storycard, body.storyon #advup, body.storyon #libban { visibility: hidden !important; }
#storybox .sub { position: absolute; left: 50%; bottom: 13.5%; transform: translateX(-50%); max-width: min(78%, 900px); text-align: center; color: #fff;
  font: 600 clamp(15px, 2.1vw, 24px)/1.35 system-ui, sans-serif; text-shadow: 0 2px 6px rgba(0, 0, 0, .9), 0 0 2px #000; opacity: 0; transition: opacity .25s; }
#storybox .sub { display: flex; align-items: center; gap: 14px; text-align: left; }
#storybox .sub .por { flex: 0 0 auto; width: clamp(60px, 7.2vw, 96px); height: clamp(60px, 7.2vw, 96px); image-rendering: pixelated; image-rendering: crisp-edges; border-radius: 14px; border: 3px solid #8fe4ff; background: radial-gradient(circle at 35% 30%, rgba(143, 228, 255, .55), rgba(20, 40, 70, .9)); box-shadow: 0 4px 14px rgba(0, 0, 0, .55); }
#storybox .sub .por.ilka { border-color: #ffc37a; background: radial-gradient(circle at 35% 30%, rgba(255, 195, 122, .6), rgba(70, 40, 20, .92)); } #storybox .sub .por.oskar { border-color: #ffe08a; background: radial-gradient(circle at 35% 30%, rgba(255, 224, 138, .55), rgba(60, 50, 20, .92)); }
#storybox .sub .por.selma { border-color: #b9f2a0; background: radial-gradient(circle at 35% 30%, rgba(185, 242, 160, .55), rgba(30, 60, 30, .92)); } #storybox .sub .por.jonte { border-color: #a8c8ff; background: radial-gradient(circle at 35% 30%, rgba(168, 200, 255, .55), rgba(25, 35, 70, .92)); }
#storybox .sub .por.lumi { border-color: #ffb0d8; background: radial-gradient(circle at 35% 30%, rgba(255, 176, 216, .6), rgba(70, 30, 55, .92)); }
#storybox .sub b { display: block; font-size: .7em; letter-spacing: .06em; text-transform: uppercase; color: #8fe4ff; margin-bottom: 2px; }
#storybox .sub b.ilka { color: #ffc37a; } #storybox .sub b.oskar { color: #ffe08a; } #storybox .sub b.selma { color: #b9f2a0; } #storybox .sub b.jonte { color: #a8c8ff; } #storybox .sub b.lumi { color: #ffb0d8; }
#storybox .sub.on { opacity: 1; }
#storybox:not(.on) .kick, #storybox:not(.on) .skip { opacity: 0 !important; }
#storybox .kick { position: absolute; left: 4%; top: 3.2%; color: rgba(255, 255, 255, .78); font: 600 clamp(11px, 1.3vw, 15px) system-ui, sans-serif; letter-spacing: .04em; }
#storybox .skip { position: absolute; right: 4%; bottom: 3.6%; color: rgba(255, 255, 255, .55); font: 500 clamp(10px, 1.1vw, 13px) system-ui, sans-serif; opacity: 0; transition: opacity .4s; }
#storybox .skip.on { opacity: 1; }
@keyframes storyIn { from { opacity: 0; transform: translate(-50%, 10px); } to { opacity: 1; transform: translate(-50%, 0); } }
.jstory h3 .bk { font-weight: 500; opacity: .7; font-size: .85em; margin-left: 6px; }
.jstory .jch { margin: 6px 0 10px; padding: 9px 11px; border-radius: 10px; background: rgba(120, 200, 255, .07); border: 1px solid rgba(140, 220, 255, .18); }
.jstory .jch.soon { opacity: .62; background: transparent; }
.jstory .jch .w { font-size: 12px; opacity: .75; } .jstory .jch .lg { font-style: italic; opacity: .9; margin: 3px 0; }
.jstory .jline { margin: 3px 0 3px 8px; font-size: 13px; } .jstory .jline b { color: #8fe4ff; font-weight: 600; }
.jstory .jact { opacity: .85; } .jstory .jact.ok { color: #9ff0b0; opacity: 1; }
.jstory .jwait { margin-top: 6px; display: flex; gap: 8px; align-items: center; }
`;
  function css() { if (!hasDoc || document.getElementById('storycss')) return; const s = document.createElement('style'); s.id = 'storycss'; s.textContent = CSS; (document.head || document.body).appendChild(s); }
  function host() { return (hasDoc && (document.getElementById('app') || document.body)) || null; }
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  function card(pl0) {
    if (!hasDoc) return;
    let el = document.getElementById('storycard');
    if (!pl0) { if (el) el.style.display = 'none'; return; }
    css();
    if (!el) { el = mk('div'); el.id = 'storycard'; if (el.setAttribute) el.setAttribute('id', 'storycard'); const h = host(); if (!h) return; h.appendChild(el); }
    const b = pl0.offer.b, ch = S.CHAPTERS[b.ch - 1];
    el.innerHTML = '';
    const tx = mk('div'); tx.appendChild(mk('div', 'k', T('story.card.kick', { ch: b.ch, title: T(ch.title) }))); tx.appendChild(mk('div', 't', T(ch.where)));
    const w = mk('button', 'w', '🎬 ' + T('story.card.watch')), kb = mk('kbd', '', keyLabel()), l = mk('button', 'l', T('story.card.later'));
    w.type = 'button'; l.type = 'button'; w.appendChild(kb);
    w.onclick = (e) => { if (e && e.stopPropagation) e.stopPropagation(); pl0.watch(); };
    l.onclick = (e) => { if (e && e.stopPropagation) e.stopPropagation(); pl0.later(true); };
    el.appendChild(tx); el.appendChild(w); el.appendChild(l);
    el.style.display = 'flex';
  }
  let keyFn = null;
  function overlay(pl0, on) {
    if (!hasDoc) return;
    css();
    let el = document.getElementById('storybox');
    if (!el) { el = mk('div'); el.id = 'storybox'; if (el.setAttribute) el.setAttribute('id', 'storybox'); for (const c of ['sbar t', 'sbar b', 'kick', 'sub', 'skip']) el.appendChild(mk('div', c)); const h = host(); if (!h) return; h.appendChild(el); }
    if (on) {
      const sc = pl0.scene, b = sc.b, ch = S.CHAPTERS[b.ch - 1];
      el.querySelector('.kick').textContent = T('story.card.kick', { ch: b.ch, title: T(ch.title) });
      el.querySelector('.skip').textContent = T('story.skip');
      el.querySelector('.skip').classList.remove('on'); el.querySelector('.sub').classList.remove('on');
      el.style.display = 'block'; void el.offsetWidth; el.classList.add('on');
      const g = pl0.g; pl0.hud0 = !!g.hideHud; g.hideHud = true; if (document.body && document.body.classList) document.body.classList.add('storyon');   // (the HUD, the hand and Funke's bubble out of the picture)
      if (g.funke && g.funke.endLine) { try { g.funke.endLine(); } catch (e) { /* the bubble */ } }
      setTimeout(() => { if (pl0.scene === sc) el.querySelector('.skip').classList.add('on'); }, S.SKIP_AFTER * 1000);
      if (!keyFn) {
        keyFn = (e) => {
          const s = pl(); if (!s || !s.scene) return;
          if (e.type === 'keydown' && (e.repeat || e.code === 'F2' || e.code === 'F12')) return;
          if (s.skip() || e.code === 'Escape') { if (e.preventDefault) e.preventDefault(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); }
        };
        window.addEventListener('keydown', keyFn, true); window.addEventListener('mousedown', keyFn, true); window.addEventListener('touchstart', keyFn, true);
      }
    } else {
      const g = pl0.g; g.hideHud = !!pl0.hud0; if (document.body && document.body.classList) document.body.classList.remove('storyon');
      el.classList.remove('on'); el.querySelector('.sub').classList.remove('on');
      setTimeout(() => { const s = pl(); if (!s || !s.scene) el.style.display = 'none'; }, 650);
    }
  }
  function subtitle(sc, i) {
    if (!hasDoc) return;
    const el = document.getElementById('storybox'); if (!el) return;
    const s = el.querySelector('.sub');
    if (i < 0) { s.classList.remove('on'); return; }
    const ln = sc.b.scene.lines[i], who = ln.who;
    s.innerHTML = '';
    // a-story2: the speaker's face (story_art.js), a 24 × 24 canvas scaled up crisp, in a ring of the speaker's colour
    const Po = VR.Portrait;
    if (Po && Po.ops) {
      const cv = mk('canvas', 'por ' + who); s.appendChild(cv);
      const q = sc.tl.lines[i] || { t0: sc.t, t1: sc.t + 3 };
      sc.por = { cv, who, mood: ln.mood || 'neutral', t0: q.t0, len: q.t1 - q.t0, key: '' };
      P.porTick(sc);
    } else sc.por = null;
    const tx = mk('div', 'tx'); tx.appendChild(mk('b', who, T('story.who.' + who))); tx.appendChild(mk('span', '', sc.texts[i])); s.appendChild(tx);
    s.classList.add('on');
    const g = game(); if (g && g.funke && g.funke.blips && who === 'funke') { try { g.funke.blips(sc.texts[i]); } catch (e) { /* the blips */ } }
  }

  // a-story2: the face's frame — repainted only when the blink or the mouth changes
  P.porTick = function (sc) {
    const q = sc.por, Po = VR.Portrait; if (!q || !Po) return;
    const an = Po.anim(q.who, sc.t - q.t0, q.len), key = (an.blink ? 'b' : '') + (an.mouth ? 'm' : '');
    if (key === q.key) return;
    q.key = key; Po.paint(q.cv, Po.ops(q.who, q.mood, an.blink, an.mouth)); P.stats.porPaints = (P.stats.porPaints || 0) + 1;
  };

  // ---------------------------------------------------------------- the journal's chapter page
  P.journalHTML = function () {
    const s = pl(); if (!s) return '';
    const rec = s.rec, cur = S.chapter(rec), open = S.open(rec), adv = P.adv();
    const shown = S.ofChapter(cur).some(b => S.isDone(rec, b.id)) || cur === 1 ? cur : cur - 1;
    let h = `<div class="jstory"><h3>${esc(T('story.j.title'))}<span class="bk">${esc(T('story.j.book'))}</span></h3>`;
    for (const c of S.CHAPTERS) {
      if (c.n > cur + 1) break;
      const seen = S.ofChapter(c.n).filter(b => S.isDone(rec, b.id));
      const soon = c.n > cur || !c.written;
      h += `<div class="jch${soon ? ' soon' : ''}"><div><b>${esc(T('story.j.ch', { n: c.n }))} · ${esc(T(c.title))}</b></div><div class="w">${esc(T(c.where))}</div><div class="lg">${esc(T(c.log))}</div>`;
      if (c.n === shown) for (const b of seen) {
        for (const l of b.scene.lines) h += `<div class="jline"><b>${esc(T('story.who.' + l.who))}:</b> ${esc(T(l.key))}</div>`;   // (the lines of the chapter in play; the others: their logline and ↺)
        if (b.act) h += `<div class="jline jact${S.actDone(rec, b.id) ? ' ok' : ''}">${S.actDone(rec, b.id) ? '✓' : '☐'} <i>${esc(T('story.act.j'))}:</i> ${esc(T('story.act.' + b.id))}</div>`;   // a-story2: the deed, done or open
      } else if (seen.length) { const nd = seen.filter(b => S.actDone(rec, b.id)).length; h += `<div class="jline jact${nd === seen.length ? ' ok' : ''}">${nd === seen.length ? '✓' : '☐'} <i>${esc(T('story.act.j'))}:</i> ${nd} / ${seen.length}</div>`; }
      if (open && open.ch === c.n) {
        h += `<div class="jwait"><span>${esc(T('story.j.waiting'))}</span><button type="button" class="btn small" data-jact="story:watch">${esc(T('story.j.watch'))}</button></div>`;
        if (open.when.adv && !adv) h += `<div class="jl note">${esc(T('story.j.adv'))}</div>`;
      } else if (seen.length) h += `<div class="jwait"><button type="button" class="btn small" data-jact="story:again:${esc(seen[seen.length - 1].id)}">${esc(T('story.j.again'))}</button></div>`;
      if (!c.written && c.n === cur) h += `<div class="jl note">${esc(T('story.j.end'))}</div>`;
      h += '</div>';
    }
    return h + '</div>';
  };
  const Q = VR.Quests;
  if (Q && Array.isArray(Q.journalSections) && !Q._story) {
    Q._story = true;
    Q.journalSections.unshift(() => P.journalHTML());
    const ja = Q.jact;
    Q.jact = function (what, pid) {
      const m = /^story:(watch|again)(?::(.+))?$/.exec(String(what || ''));
      if (!m) return ja.apply(this, arguments);
      const s = pl(); if (!s) return;
      const b = m[1] === 'watch' ? S.open(s.rec) : S.byId(m[2]);
      if (b) { Q.closeJournal(); setTimeout(() => s.watch(b), 30); }
    };
  }

  // ---------------------------------------------------------------- ch. 3 · the Ringstation's beacon over the limb
  // (one additive glare in the space scene's list while chapter 3's station beat is open or playing: red, blinking)
  P.stationOn = function (g) { const s = pl(g); if (!s) return false; const o = S.open(s.rec); return !!((o && o.id === 'c3.b2') || (s.scene && s.scene.b.id === 'c3.b2')); };
  P.blink = (t) => { const u = ((t % 1.6) + 1.6) % 1.6; return u < 0.12 ? smooth(u / 0.12) : u < 0.42 ? 1 : u < 0.62 ? 1 - smooth((u - 0.42) / 0.2) : 0; };
  P.stationDir = function (fr, eph, t, cam) {
    const b = eph && eph.bodies && eph.bodies.herz, SS = VR.SpaceScene; if (!b || !SS || !SS.BODIES) return null;
    const R = SS.BODIES.herz.R, v = [b.p[0] - fr.pos[0], b.p[1] - fr.pos[1], b.p[2] - fr.pos[2]], d = Math.hypot(v[0], v[1], v[2]); if (!(d > R)) return null;
    // (the scene's axes: the camera looks into them by its yaw and pitch — the map's east, up, south in a ship, the view's
    // own frame in /raum; the system's directions come in through fr.axes)
    const A = fr.axes, cy = cam ? cam.yaw || 0 : 0, cp = cam ? cam.pitch || 0 : 0, Fs = [-Math.sin(cy) * Math.cos(cp), Math.sin(cp), -Math.cos(cy) * Math.cos(cp)];
    const F = [A[0][0] * Fs[0] + A[1][0] * Fs[1] + A[2][0] * Fs[2], A[0][1] * Fs[0] + A[1][1] * Fs[1] + A[2][1] * Fs[2], A[0][2] * Fs[0] + A[1][2] * Fs[1] + A[2][2] * Fs[2]];
    const c = [v[0] / d, v[1] / d, v[2] / d];
    const k = F[0] * c[0] + F[1] * c[1] + F[2] * c[2];
    let p = [F[0] - c[0] * k, F[1] - c[1] * k, F[2] - c[2] * k]; const pl0 = Math.hypot(p[0], p[1], p[2]);
    if (pl0 < 1e-6) return null; p = [p[0] / pl0, p[1] / pl0, p[2] / pl0];
    const a = Math.asin(R / d) + (1.6 + 0.35 * Math.sin(t * 0.05)) * DEG, ca = Math.cos(a), sa = Math.sin(a);
    const D = [c[0] * ca + p[0] * sa, c[1] * ca + p[1] * sa, c[2] * ca + p[2] * sa];
    return [A[0][0] * D[0] + A[0][1] * D[1] + A[0][2] * D[2], A[1][0] * D[0] + A[1][1] * D[1] + A[1][2] * D[2], A[2][0] * D[0] + A[2][1] * D[1] + A[2][2] * D[2]];
  };
  const SSc = VR.SpaceScene;
  if (SSc && SSc.frameSetup && !SSc._story) {
    SSc._story = true;
    const fs0 = SSc.frameSetup;
    SSc.frameSetup = function (Sx, eph, o) {
      const fr = fs0.apply(this, arguments);
      const g = game();
      try {
        if (g && fr && g.settings && g.settings.storyOffer !== false && P.stationOn(g)) {
          const tt = (typeof performance !== 'undefined' ? performance.now() : 0) / 1000, dS = P.stationDir(fr, eph, tt, P.spaceCam || (g.space && g.space.cam) || null);
          if (dS) {
            const bu = Math.abs(dS[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], k = bu[0] * dS[0] + bu[1] * dS[1] + bu[2] * dS[2];
            let u = [bu[0] - dS[0] * k, bu[1] - dS[1] * k, bu[2] - dS[2] * k]; const ul = Math.hypot(u[0], u[1], u[2]); u = [u[0] / ul, u[1] / ul, u[2] / ul];
            const v = [dS[1] * u[2] - dS[2] * u[1], dS[2] * u[0] - dS[0] * u[2], dS[0] * u[1] - dS[1] * u[0]], bl = 0.18 + 0.82 * P.blink(tt);
            fr.draws.push({ prog: 'glare', add: true, story: true, u: { u_cdir: dS, u_bu: u, u_bv: v, u_half: Math.tan(25 * DEG),   /* (the glare's own fade ends at 24.6°: a smaller quad shows its edge) */ u_sunDir: dS, u_sunCol: [1.0, 0.13, 0.07], u_gl: [bl, 0.0016, 1.3, 0.55] }   /* (a dimmer core: run 5's bright one bloomed into a square on the bloom's coarse mips) */, tex: {} });
            P.station = { dir: dS, blink: bl };
          }
        }
      } catch (e) { /* the scene draws without it */ }
      return fr;
    };
  }

  // a-story2: a picture in the photo mode counts for a photo deed (the eclipse, the sky for Jonte)
  P.photoNow = (g) => { const s = pl(g); return !!(s && !s.scene && s.photo()); };
  const PMc = VR.PhotoMode;
  if (PMc && PMc.Photo && PMc.Photo.prototype.shoot && !PMc.Photo.prototype.shoot.__story) {
    const os = PMc.Photo.prototype.shoot;
    PMc.Photo.prototype.shoot = function () { try { if (!this.busy) P.photoNow(game()); } catch (e) { /* the picture comes first */ } return os.apply(this, arguments); };
    PMc.Photo.prototype.shoot.__story = true;
    for (const k of Object.keys(os)) PMc.Photo.prototype.shoot[k] = os[k];   // (quests.js's own mark stays readable)
  }

  // (the ship's camera of the space frame: SpaceFlight.cameraFrame's own argument)
  const SFc = VR.SpaceFlight;
  if (SFc && SFc.cameraFrame && !SFc._story) {
    SFc._story = true;
    const cf0 = SFc.cameraFrame;
    SFc.cameraFrame = function (g, cam) { P.spaceCam = cam || null; try { return cf0.apply(this, arguments); } finally { P.spaceCam = null; } };
  }

  // ---------------------------------------------------------------- ch. 4 · the Eiswächter under the ice; Funke flickers awake
  // a-story2: the Eiswächter of its own (story_art.js: story_warden) under a clear window in Opal's ice (story_icewin):
  //   1 · the window — a disc on the ice, a clear deep blue in the middle fading to the ice's white at its rim (depth-tested
  //       on the surface, blended); 2 · a faint cyan rim (the figure × 1.05) so its outline reads; 3 · the figure itself,
  //       opaque, its depth squeezed to the front of the range (it shows through the ice, yet sorts its own faces); 4 · the
  //       ice's veil and a few white cracks over it; 5 · the eye — dark while it dreams, waking in its close shot.
  // Drawn only in c4.b2 (nothing outside the scene).
  const WIN_S = 0.31, CRACK_S = 0.125, WIN_OFF = 3.5;   // m a voxel of the window (R 24 → a disc of 7.4 m), of the cracks (R 60), the window's middle toward the camera (m)
  let MB = null;
  const wardenM = (W, cam, yaw, s, dy) => { const m4 = VR.mat4; MB.fill(0); MB[0] = MB[5] = MB[10] = MB[15] = 1; m4.translate(MB, MB, W[0] - cam.x, W[1] - cam.y + (dy || 0), W[2] - cam.z); m4.rotY(MB, MB, yaw); m4.scale(MB, MB, s, s, s); return MB; };
  P.wardenWake = function (sc) { const at = S.shotAt(sc.b, sc.t); if (!at) return 0; const shots = sc.b.scene.shots; return at.shot.cam === 'eye' ? smooth((at.u - 0.05) / 0.3) : at.i > shots.findIndex(q => q.cam === 'eye') && shots.some(q => q.cam === 'eye') ? 1 : 0; };
  P.drawWarden = function (g, r, E, cam) {
    const s = pl(g), sc = s && s.scene; if (!sc || sc.b.id !== 'c4.b2' || !g.entities || !VR.getVoxModel || !VR.mat4) return;
    const t0 = performance.now(), gl = r.gl, md = VR.getVoxModel(gl, 'story_warden'), mw = VR.getVoxModel(gl, 'story_icewin'); if (!md || !md.parts || !mw) return;
    const p = g.entities.beginVox(r, E), m4 = VR.mat4; MB = MB || new Float32Array(16);
    const W = sc.tg.warden, k = P.WARDEN_SCALE / 16, yaw = sc.wardenYaw;
    const part = (pr, M, tint, a) => { gl.uniform3f(p.u.u_tint, tint[0], tint[1], tint[2]); gl.uniform1f(p.u.u_alpha, a); gl.uniformMatrix4fv(p.u.u_model, false, M); gl.bindVertexArray(pr.vao); gl.drawArrays(gl.TRIANGLES, 0, pr.count); };
    gl.uniform1f(p.u.u_sky, 1); gl.uniform3f(p.u.u_blockLight, 0.35, 0.5, 0.6);
    if (p.u.u_sunShadow) gl.uniform1f(p.u.u_sunShadow, 0);
    gl.uniform1f(p.u.u_flash, 0); gl.uniform1f(p.u.u_noFog, 1);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    // 1 · the window on the surface (over the figure's middle)
    // (its middle 3.5 m toward the camera's side: the line from the lens down to the figure crosses the ice there)
    const f = sc.fwd || [0, 0, -1], wd = [(-f[0] * 7 - f[2] * 6) / 9.22, (-f[2] * 7 + f[0] * 6) / 9.22];   // (toward the ice shot's camera: −7 f + 6 rt)
    const flat = (sz) => { MB.fill(0); MB[0] = MB[5] = MB[10] = MB[15] = 1; m4.translate(MB, MB, W[0] + wd[0] * WIN_OFF - cam.x, sc.surf + 0.035 - cam.y, W[2] + wd[1] * WIN_OFF - cam.z); m4.scale(MB, MB, sz, 0.02, sz); return MB; };
    part(mw.parts.win, flat(WIN_S), [1.0, 1.0, 1.05], 0.88);
    // 2 · the rim, 3 · the figure: in front of the ice (the depth range squeezed to its front), its own faces sorted
    gl.depthRange(0, 0.02); gl.disable(gl.DEPTH_TEST);
    const H = (md.def.h || 2.7) * 16 * k, wake = P.wardenWake(sc);
    MB = wardenM(W, cam, yaw, k * 1.06, -H * 0.03); part(md.parts.whole, MB, [0.7 + 0.5 * wake, 1.6 + 0.6 * wake, 2.0 + 0.5 * wake], 0.42);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
    gl.uniform1f(p.u.u_sky, 0.62); gl.uniform3f(p.u.u_blockLight, 0.12, 0.2, 0.3);   // (less light down there: its facets read, its face stays dark)
    MB = wardenM(W, cam, yaw, k); part(md.parts.whole, MB, [0.48, 0.66, 0.95], 1);   // (a deeper blue: it stands in the ice's depth)
    gl.uniform1f(p.u.u_sky, 1); gl.uniform3f(p.u.u_blockLight, 0.35, 0.5, 0.6);
    gl.depthMask(false); gl.disable(gl.DEPTH_TEST);
    // 4 · the ice over it: the veil and the cracks (they lie over the figure — it is under the ice)
    part(mw.parts.veil, flat(WIN_S), [1, 1, 1], 0.12);
    part(mw.parts.cracks, flat(CRACK_S), [1.2, 1.25, 1.3], 0.5);
    // 5 · the eye: its place for the close shot, its glow (a dim dream, then awake: a slow pulse and a halo)
    const L = md.def.layout.optic || [0, 35, -4.6], a = yaw, x = L[0] * k, y = L[1] * k, z = L[2] * k;
    if (!sc.eyePos) sc.eyePos = [W[0] + x * Math.cos(a) + z * Math.sin(a), W[1] + y, W[2] - x * Math.sin(a) + z * Math.cos(a)];
    const pulse = 0.5 + 0.5 * Math.sin(sc.t * 2.2), lv = 0.22 + wake * (0.75 + 0.25 * pulse), opt = md.parts.optic;
    const eyeM = (sz) => { const M = wardenM(W, cam, yaw, k); m4.translate(M, M, L[0], L[1], L[2] - 0.2); m4.scale(M, M, sz, sz, 1); return M; };
    part(opt, eyeM(1), [0.2 * lv + 0.05, 1.25 * lv + 0.1, 1.7 * lv + 0.14], 1);   // (a saturated cyan, not white)
    if (wake > 0.05) { gl.blendFunc(gl.SRC_ALPHA, gl.ONE); part(opt, eyeM(1.45), [0.1, 0.9, 1.3], 0.4 * wake * (0.7 + 0.3 * pulse)); part(opt, eyeM(1.9), [0.05, 0.6, 0.9], 0.14 * wake); }   // (a small halo: run 3's 2.2× / 4.2× covered the face)
    gl.depthRange(0, 1); gl.uniform1f(p.u.u_alpha, 1); gl.uniform3f(p.u.u_tint, 1, 1, 1); gl.uniform1f(p.u.u_noFog, 0);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.BLEND); gl.depthMask(true); gl.enable(gl.DEPTH_TEST);
    gl.bindVertexArray(null);
    P.stats.drawMs += performance.now() - t0;
  };
  // c1.b1: the drone flickers awake (its first 1.6 s)
  P.flicker = function (g) { const s = pl(g), sc = s && s.scene; if (!sc || sc.b.id !== 'c1.b1' || sc.t > 1.8) return false; return ((sc.t * 14) | 0) % 3 === 0 || (sc.t < 0.5 && ((sc.t * 20) | 0) % 2 === 0); };
  const FA = VR.Funke && VR.Funke.Actor;
  if (FA && FA.prototype && FA.prototype.draw && !FA.prototype._story) {
    FA.prototype._story = true;
    const d0 = FA.prototype.draw;
    FA.prototype.draw = function (r, E, cam) {
      const g = this.g;
      if (g && g.story && g.story.scene) { try { P.drawWarden(g, r, E, cam); } catch (e) { if (!P.warned) { P.warned = true; console.warn('story draw', e); } } if (P.flicker(g)) return; }
      return d0.apply(this, arguments);
    };
  }

  // ---------------------------------------------------------------- the frames the game's own frame does not run (the space views)
  const G = VR.Game;
  if (G && G.prototype && !G.prototype._story) {
    G.prototype._story = true;
    const pf = G.prototype.playFrame;
    if (pf) G.prototype.playFrame = function (dt) {
      this.frameN = (this.frameN | 0) + 1;
      const r = pf.apply(this, arguments);
      if (P.frameN !== this.frameN && (this.space || (this.flight && this.flight.regime === 'space'))) { P.frame(this, dt); }
      return r;
    };
    const td = G.prototype.teardownWorld;
    if (td) G.prototype.teardownWorld = function () { if (this.story) { this.story.destroy(); this.story = null; } if (this.regie) this.regie = null; return td.apply(this, arguments); };
  }
  // (P.frame marks the frame it ran in, so the wrapper above does not run it twice)
  const fr0 = P.frame;
  P.frame = function (g, dt) { fr0(g, dt); P.frameN = g.frameN; };
})(VR);

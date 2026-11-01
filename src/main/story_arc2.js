// ============================================================================
// a-story7 · Arc 2 in the game — „Das Lied der Wiegelind", chapters 13–16 (plan docs/superpowers/plans/
// 2026-11-01-a-story7.md; the pure book: src/shared/story.js; the pictures: story_fx2.js). Wraps the story's player
// (story.js) in additive blocks:
//   · the context: near.fairy (the nearest fairy place, fairy.js's own list) and near.home (your settlement's plaza,
//     u-movein — else the village near), only while an Arc 2 beat is open
//   · the scene's targets: fairy, home, wiege (Wiegelind's spot in the sky: high ahead and to the right), place (the
//     new place), sign (where your sign stands); the deeds' look targets the same
//   · the deeds: trip (a journey of that kind taken — die Himmelsleiter, eine Lichtbrücke, eine Karawane: journey.js
//     counted into rec.trips) and sign (your way: S.styleWay on what you build, help or travel)
//   · the choice c15 → the gifts: the new place (a fairy place of its own near your settlement: Wiegelinds Ruh — the
//     stone circle where she rests — or Wiegelinds Saatwiese — glowing mushrooms where the far Flausel live), the
//     Dreilichterfest (every 7th night every village and your settlement celebrate: VR.Villages festivalDay), the
//     Wanderbuch's pages (places, people)
//   · the music: a scene of the arc starts with the score's story hook (audio.storyCue(id, mood) when e-score2 gives
//     one, else the 'wonder' sting)
// Cost: outside a scene nothing is drawn; one more check in the 1-Hz brain, one day check every 5 s, the festival day a
// table lookup per village frame. Very Low unchanged outside scenes.
// ============================================================================
(function (VR) {
  'use strict';
  const S = VR.Story, P = VR.StoryPlay; if (!S || !P || !P.Player || P._arc2) return;
  P._arc2 = true;
  const A2 = VR.StoryArc2 = {};
  const T = (k, v) => (VR.I18N ? VR.I18N.t(k, v) : k);
  const TAU = Math.PI * 2, DEG = Math.PI / 180;
  const Pr = P.Player.prototype;
  const pl = (g) => { g = g || VR.game; const s = g && g.story; return s && s.world === g.world ? s : null; };
  const arc2Open = (s) => { const b = s && S.open(s.rec); return !!(b && b.ch >= 13); };
  A2.stats = { cues: 0, trips: 0, found: 0, fest: 0 };

  // ---------------------------------------------------------------- where things are
  A2.fairyNear = function (g) {
    const F = VR.Fairy, st = F && F.state, p = g && g.player && g.player.pos; if (!st || !st.sites || !p) return null;
    if (String(st.key || '').split('|')[0] !== (g.dim || 'overworld')) return null;
    let best = null, bd = Infinity; for (const s of st.sites) { const d = Math.hypot(s.x - p[0], s.z - p[2]); if (d < bd) { bd = d; best = s; } }
    return best ? { s: best, d: bd } : null;
  };
  // your settlement (u-movein: the plaza of the nearest one with a family) — else the village near
  A2.ownHome = function (g) {
    const MI = VR.MoveIn, p = g.player.pos; let best = null, bd = Infinity;
    try { const rec = MI && MI.rec ? MI.rec(g) : null; if (rec) for (const s of rec.sets) { if (!MI.homesOf(rec, s).length) continue; const pz = MI.plazaOf(rec, s), d = Math.hypot(pz.x - p[0], pz.z - p[2]); if (d < bd) { bd = d; best = { x: pz.x, y: pz.y, z: pz.z, own: true, name: s.name }; } } } catch (e) { /* no settlement */ }
    return best ? { at: best, d: bd } : null;
  };
  A2.homeNear = function (g) {
    if ((g.dim || 'overworld') !== 'overworld' || !g.player) return null;
    const own = A2.ownHome(g); if (own) return own;
    const v = P.village(g); return v ? { at: { x: v.s.x, y: v.s.y, z: v.s.z, own: false }, d: v.d } : null;
  };
  A2.place = function (g) { const s = pl(g), gf = s && s.rec.gift; return gf && gf.place && gf.place.dim === (g.dim || 'overworld') ? gf.place : null; };

  const ctx0 = P.ctxOf;
  P.ctxOf = function (g, s) {
    const c = ctx0.apply(this, arguments);
    if (arc2Open(s)) { const f = A2.fairyNear(g), h = A2.homeNear(g); c.near.fairy = f ? f.d : Infinity; c.near.home = h ? h.d : Infinity; }
    return c;
  };

  // ---------------------------------------------------------------- the scene's targets
  const res0 = Pr.resolve;
  Pr.resolve = function (sc) { res0.call(this, sc); if (sc.b.ch >= 13) A2.resolve(this.g, sc); };
  A2.resolve = function (g, sc) {
    const e = sc.eye0, f = sc.fwd, rt = [-f[2], 0, f[0]];
    const gy = (x, z, d) => { const y = sc.ground ? sc.ground(x, z) : null; return y === null || y === undefined ? d : y; };
    const fn = A2.fairyNear(g);
    sc.tg.fairy = fn && fn.d < 200 ? [fn.s.x + 0.5, (fn.s.y !== null && fn.s.y !== undefined ? fn.s.y : gy(fn.s.x, fn.s.z, e[1] - 1.6)) + 1.5, fn.s.z + 0.5] : [e[0] + f[0] * 30, e[1], e[2] + f[2] * 30];
    const hn = A2.homeNear(g);
    sc.tg.home = hn && hn.d < 320 ? [hn.at.x + 0.5, (hn.at.y || gy(hn.at.x, hn.at.z, e[1])) + 2, hn.at.z + 0.5] : sc.tg.village;
    // Wiegelind's spot: 150 m out, 40 m to the right, 62 m up (≈ 22° over the horizon: in the skyline's frame and the up shot's)
    sc.tg.wiege = [e[0] + f[0] * 150 + rt[0] * 40, e[1] + 62, e[2] + f[2] * 150 + rt[2] * 40];
    const pc = A2.place(g); sc.tg.place = pc ? [pc.x + 0.5, gy(pc.x, pc.z, e[1] - 1.6) + 1.5, pc.z + 0.5] : sc.tg.fairy;
    sc.tg.sign = A2.signAt && Math.hypot(A2.signAt[0] - e[0], A2.signAt[2] - e[2]) < 200 ? A2.signAt : sc.tg.answer;
  };
  // a deed's view toward the arc's targets (the look deeds of 13.2, 14.3, 15.3, 16.1)
  const actCtx0 = P.actCtx;
  P.actCtx = function (g, act) {
    const a = actCtx0.apply(this, arguments), k = act && act.target;
    if (k !== 'fairy' && k !== 'place' && k !== 'home') return a;
    let Q = null;
    if (k === 'fairy') { const fn = A2.fairyNear(g); if (fn) Q = [fn.s.x + 0.5, (fn.s.y !== null && fn.s.y !== undefined ? fn.s.y : g.player.pos[1]) + 1.5, fn.s.z + 0.5]; }
    else if (k === 'place') { const pc = A2.place(g); if (pc) Q = [pc.x + 0.5, g.player.pos[1] + 1, pc.z + 0.5]; }
    else { const h = A2.homeNear(g); if (h) Q = [h.at.x + 0.5, (h.at.y || g.player.pos[1]) + 2, h.at.z + 0.5]; }
    if (!Q) return a;
    const cam = g.cam || { x: g.player.pos[0], y: g.player.pos[1] + 1.6, z: g.player.pos[2], yaw: g.player.yaw || 0, pitch: g.player.pitch || 0 };
    const cp = Math.cos(cam.pitch || 0), d = [-Math.sin(cam.yaw || 0) * cp, Math.sin(cam.pitch || 0), -Math.cos(cam.yaw || 0) * cp];
    const v = [Q[0] - cam.x, Q[1] - cam.y, Q[2] - cam.z], L = Math.hypot(v[0], v[1], v[2]) || 1;
    a.dist = L; a.ang = Math.acos(Math.max(-1, Math.min(1, (v[0] * d[0] + v[1] * d[1] + v[2] * d[2]) / L))) / DEG;
    return a;
  };
  // the arc's lower skyline: your home on the lower third, the sky over it (story.js's skyline treats 'home' as low)

  // ---------------------------------------------------------------- the deeds: trip and sign
  A2.signNow = function (g, base) {
    const f = P.featNow(g, base), m = g.meta || {}, fy = m.fairy && typeof m.fairy === 'object' ? m.fairy : {}, s = pl(g);
    let homes = 0; try { const MI = VR.MoveIn, r = MI && MI.rec ? MI.rec(g) : null; if (r) homes = r.homes.filter(h => h.st === 'home').length; } catch (e) { /* none */ }
    let trips = 0; const tr = s && s.rec.trips; if (tr) for (const k of S.TRIPS) trips += tr[k] | 0;
    return { placed: f.placed, span: f.span, homes, freed: f.freed, calms: f.calms, fairy: Array.isArray(fy.done) ? fy.done.length : 0, trips, places: fy.seen && typeof fy.seen === 'object' ? Object.keys(fy.seen).length : 0, dims: s ? Object.keys(s.rec.places || {}).length : 0 };
  };
  // where the sign stands: the top of what you built, the beacon you freed, else above you
  A2.signOf = function (g, way, base) { return P.answerOf(g, way === 'build' ? 'build' : way === 'quest' ? 'free' : 'fly', base); };
  const tick0 = Pr.actTick;
  Pr.actTick = function (dt, ev) {
    const b = S.openAct(this.rec), g = this.g;
    if (b && (b.act.kind === 'trip' || b.act.kind === 'sign') && !(g.settings && g.settings.storyOffer === false)) {
      const st = this.actSt && this.actSt.id === b.id ? this.actSt : (this.actSt = { id: b.id });
      ev = Object.assign({}, ev);
      if (b.act.kind === 'trip') { const tr = this.rec.trips || {}; if (!st.trips) st.trips = Object.assign({}, tr); ev.trip = S.TRIPS.filter(k => (tr[k] | 0) > (st.trips[k] | 0)); }
      else {
        if (!st.base) st.base = A2.signNow(g);
        const way = this.rec.choices && this.rec.choices.style || S.styleWay(st.base, A2.signNow(g, st.base));
        if (way) { if (!this.rec.choices.style) { this.rec.choices.style = way; A2.signAt = A2.signOf(g, way, st.base); } ev.sign = way; }   // (the act itself is marked by actDone — Funke then names your way)
      }
    }
    return tick0.call(this, dt, ev);
  };
  const done0 = Pr.actDone;
  Pr.actDone = function (b) {
    const r = done0.apply(this, arguments);
    const way = b && b.act.kind === 'sign' ? this.rec.choices && this.rec.choices.style : null, fk = this.g.funke;
    if (way && fk && fk.show && fk.on && fk.on()) fk.show(T('story.choice.style.' + way + '.after'));
    return r;
  };

  // ---------------------------------------------------------------- the journeys (journey.js): counted when one starts
  A2.trip = function (g, kind) { const s = pl(g); if (!s || !S.trip(s.rec, kind)) return false; A2.stats.trips++; if (g.meta) g.meta.story = s.rec; return true; };
  { const JY = VR.Journey; if (JY && !JY._arc2) { JY._arc2 = true; for (const k of S.TRIPS) { const f0 = JY[k]; if (typeof f0 !== 'function') continue; JY[k] = function (g, x, o) { const r = f0.apply(this, arguments); if (r && !(o && o.st)) { try { A2.trip(g, k); } catch (e) { /* counted next time */ } } return r; }; } } }

  // ---------------------------------------------------------------- the choice → the gifts
  // a spot for the new place: 36–72 m round your settlement's plaza (else Herzwelt's tree, else you), clear of the other
  // fairy places (60 m) and of the villages
  A2.spot = function (g) {
    const own = A2.ownHome(g), F = VR.Fairy, st = F && F.state, sites = (st && st.sites) || [], V = g.villages, vs = (V && V.sites) || [], p = g.player.pos;
    const tree = sites.find(s => s.kind === 'tree');
    const c0 = own ? [own.at.x, own.at.z] : tree ? [tree.x, tree.z] : [p[0], p[2]];
    const a0 = (((g.meta && g.meta.seed) >>> 0) % 628) / 100;
    for (const r of [48, 60, 72, 36]) for (let k = 0; k < 12; k++) {
      const a = a0 + k * TAU / 12, x = Math.round(c0[0] + Math.cos(a) * r), z = Math.round(c0[1] + Math.sin(a) * r);
      if (sites.some(s => s.id !== 'overworld:wiege' && Math.hypot(s.x - x, s.z - z) < 60)) continue;
      if (vs.some(v => v && Number.isFinite(v.x) && Math.hypot(v.x - x, v.z - z) < Math.min(90, (v.rad || 40)) + 14)) continue;
      return [x, z];
    }
    return [Math.round(c0[0] + 44), Math.round(c0[1])];
  };
  A2.found = function (g, opt) {
    const s = pl(g); if (!s || s.rec.gift) return false;
    const xz = A2.spot(g), day = g.env ? g.env.day | 0 : 0;
    if (!S.found(s.rec, { opt, x: xz[0], z: xz[1] }, day)) return false;
    A2.stats.found++;
    const W = VR.Wander, nm = T('story.place.' + opt);
    if (W && W.note && g.meta) { try { W.note(g.meta, 'places', 'story:wiege', nm); W.note(g.meta, 'people', 'story:wiegelind', T('story.who.wiegelind')); W.note(g.meta, 'people', 'story:tauli', T('story.who.tauli')); } catch (e) { /* the book */ } }
    const F = VR.Fairy; if (F && F.state && (g.dim || 'overworld') === 'overworld') F.state.key = '';   // (the fairy places set up again: the new one with them)
    s.save();
    return true;
  };
  const choose0 = Pr.choose;
  Pr.choose = function (opt) {
    const id = (this.choiceUp && this.choiceUp.id) || S.choicePending(this.rec), r = choose0.apply(this, arguments);
    if (r && id === 'c15') { try { A2.found(this.g, opt); } catch (e) { console.warn('story arc2 found', e); } }
    return r;
  };
  // the new place stands among the fairy places of its world (fairy.js sets them up from F.sites)
  { const F = VR.Fairy; if (F && F.sites && !F._arc2) { F._arc2 = true; const sites0 = F.sites; F.sites = function (seed, dim) {
    const out = sites0.apply(this, arguments), g = VR.game, m = g && g.meta && g.meta.story, gf = m && m.gift && m.gift.place;
    if (gf && gf.dim === dim && Number.isFinite(gf.x) && Number.isFinite(gf.z) && (gf.kind === 'circle' || gf.kind === 'shroom') && !out.some(o => o.id === 'overworld:wiege')) out.push({ id: 'overworld:wiege', kind: gf.kind, x: gf.x, z: gf.z, yaw: 0, story: true });
    return out;
  }; } }
  // the Dreilichterfest: every 7th night from the founding on, every village of Herzwelt (your settlement too) celebrates
  { const Vs = VR.Villages; if (Vs && Vs.prototype.festivalDay && !Vs._arc2) { Vs._arc2 = true; const fd0 = Vs.prototype.festivalDay; Vs.prototype.festivalDay = function (vil) {
    if (fd0.apply(this, arguments)) return true;
    const g = this.g, m = g && g.meta && g.meta.story;
    return !!(m && m.gift && (g.dim || 'overworld') === 'overworld' && g.env && S.festDay(m, g.env.day | 0));
  }; } }
  A2.festIn = function (rec, day) { if (!rec || !rec.gift) return null; for (let n = 0; n < S.FEST_EVERY; n++) if (S.festDay(rec, day + n)) return n; return null; };

  // ---------------------------------------------------------------- the scene: the music's hook, the gifts' note
  const watch0 = Pr.watch;
  Pr.watch = function (b) {
    const r = watch0.apply(this, arguments), sc = this.scene, au = this.g.audio;
    if (r && sc && sc.b.ch >= 13 && au) { try { if (au.storyCue) au.storyCue(sc.b.id, sc.b.scene.music); else if (au.cue) au.cue('wonder'); A2.stats.cues++; } catch (e) { /* the score */ } }
    return r;
  };
  const end0 = Pr.end;
  Pr.end = function (skipped) {
    const sc = this.scene, first = sc && !sc.seen;
    const r = end0.apply(this, arguments);
    if (first && sc.b.id === 'c16.b2') { const g = this.g, gf = this.rec.gift; if (gf && g.ui && g.ui.hint) { try { g.ui.hint(T('story.gift.arc2', { place: T('story.place.' + gf.place.opt) }), 7000); } catch (e) { /* the journal holds it */ } } }
    return r;
  };
  // tonight's festival: one quiet line at the evening of a Dreilichterfest day
  const upd0 = Pr.update;
  Pr.update = function (dt) {
    upd0.apply(this, arguments);
    if ((this.festT = (this.festT || 0) - dt) > 0) return; this.festT = 5;
    const g = this.g, e = g.env; if (!this.rec.gift || !e || (g.dim || 'overworld') !== 'overworld') return;
    const day = e.day | 0; if (this.festSaid === day || !S.festDay(this.rec, day) || !(e.timeOfDay >= 10500 && e.timeOfDay < 14800)) return;
    this.festSaid = day; A2.stats.fest++;
    const text = T('story.fest.tonight');
    if (VR.Quiet && VR.Quiet.note) { try { VR.Quiet.note(text, 2, 'story-fest'); return; } catch (e2) { /* the channel */ } }
    if (g.ui && g.ui.hint) g.ui.hint(text, 5000);
  };

  // ---------------------------------------------------------------- the pictures' inputs (story_fx2.js)
  // where Wiegelind's sky spot is in the view (0…1, from the frame's camera), the shot's kind, your way, the choice
  A2.project = function (cam, Q, aspect) {
    if (!cam || !Q) return null;
    const cy = Math.cos(cam.yaw || 0), sy = Math.sin(cam.yaw || 0), cp = Math.cos(cam.pitch || 0), sp = Math.sin(cam.pitch || 0);
    const fw = [-sy * cp, sp, -cy * cp], rt = [cy, 0, -sy], up = [rt[1] * fw[2] - rt[2] * fw[1], rt[2] * fw[0] - rt[0] * fw[2], rt[0] * fw[1] - rt[1] * fw[0]];
    const v = [Q[0] - cam.x, Q[1] - cam.y, Q[2] - cam.z], z = v[0] * fw[0] + v[1] * fw[1] + v[2] * fw[2]; if (z <= 0.1) return null;
    const tf = Math.tan((cam.fov || 70 * DEG) / 2);
    return [0.5 + (v[0] * rt[0] + v[1] * rt[1] + v[2] * rt[2]) / z / (2 * tf * (aspect || 16 / 9)), 0.5 - (v[0] * up[0] + v[1] * up[1] + v[2] * up[2]) / z / (2 * tf)];
  };
  const fx0 = P.fx3d;
  P.fx3d = function (g, sc, at) {
    const o = fx0 ? fx0.apply(this, arguments) : null;
    if (!sc || !sc.b || sc.b.ch < 13) return o;
    const asp = typeof window !== 'undefined' && window.innerHeight ? window.innerWidth / window.innerHeight : 16 / 9;
    return Object.assign({}, o, { cam: at && at.shot ? at.shot.cam : '', wiegeUV: A2.project(g.cam, sc.tg.wiege, asp), style: (sc.b && pl(g) && pl(g).rec.choices.style) || '', opt: (pl(g) && pl(g).rec.choices.c15) || '' });
  };

  // ---------------------------------------------------------------- the journal: Part Two's heading, the festival
  const jh0 = P.journalHTML;
  P.journalHTML = function () {
    let h = jh0.apply(this, arguments); const s = pl(); if (!s || !h) return h;
    const esc = (x) => String(x == null ? '' : x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const lab = esc(T('story.j.ch', { n: 13 })), i = h.indexOf(lab);
    if (i > 0) { const j = h.lastIndexOf('<div class="jch', i); if (j > 0) h = h.slice(0, j) + `<div class="jl"><b>${esc(T('story.j.arc2'))}</b></div>` + h.slice(j); }
    if (s.rec.gift) {
      const day = s.g.env ? s.g.env.day | 0 : 0, n = A2.festIn(s.rec, day);
      const line = n === 0 ? T('story.j.festNow') : n !== null ? T('story.j.fest', { n }) : '';
      h = h.replace(/<\/div>$/, `<div class="jch"><div><b>✨ ${esc(T('story.place.' + s.rec.gift.place.opt))}</b></div><div class="lg">${esc(line)}</div>${S.free2(s.rec) ? `<div class="lg">${esc(T('story.j.hook2'))}</div>` : ''}</div></div>`);
    }
    return h;
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

// ============================================================================
// Das Fest am Leuchtfeuer (a-adventure; plan docs/superpowers/plans/2026-11-01-a-adventure.md; review v0.55 R56-02:
// „the Abenteuer still has no payoff"). Around VR.Liberate's own moment (the beacon flickers and turns cyan, the beam, the
// ring of light, the music, the Helfer stand up, Funke cheers, the banner with XP and Taler, the RPG's find) this adds:
//   the goal      near a disturbed outpost (< 76 m) one calm line on the HUD — its name, the machines calmed or stopped
//                 of all, the next step with its key — and a soft light over every machine still to calm (over the
//                 beacon once it is ready); never during the moment, the Lichtleiter, the timing ring or the capture ring
//   the reward    a chest beside the beacon (once per outpost: the outpost loot table, crafting.js), its sparkle
//   the page      a Wanderbuch page per freed outpost (the journal's section „Leuchtfeuer-Seiten": the day, the name, how
//                 it was freed — calmed, brave or both), its toast
//   the cheer     the nearest village (≤ 900 m) heard of it: when the player next stands among its people they clap
//                 (folkjoy.js joyReact) and one line says why
//   the next goal 1.5 s after the moment Funke names the next disturbed outpost (or the nearest unvisited village) with
//                 its distance and direction, and its Wegweiser points there (funke.js addSource) until it is reached
// Everything additive: L.beat and L.look are wrapped, nothing in liberate.js changes. Pure parts node-tested
// (test/adventure_fest.js). Cost 🟢: the 4-Hz look only within 140 m of an outpost (DOM writes only on a change, ≤ 4
// particles); the switches LF.on (all of it) and LF.marks (the lights; off on Very Low).
// ============================================================================
(function (VR) {
  'use strict';
  const LF = VR.LibFest = VR.LibFest || {};
  LF.on = true; LF.marks = true;
  LF.cost = { looks: 0, ms: 0, marks: 0 };
  const T = (k, v) => (VR.I18N ? VR.I18N.t(k, v) : k);
  const Lb = () => VR.Liberate, Fo = () => VR.Foes;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

  // ---------------------------------------------------------------- pure
  // the goal of a disturbed outpost: the machines resolved of all, the next step
  LF.goalOf = function (s) {
    if (!s || s.st === 'frei') return null;
    const of = typeof s.strays === 'number' ? s.strays : null, n = Math.min(of === null ? 0 : of, s.res | 0);
    return { n, of, step: of !== null && n >= of ? 'beacon' : 'calm' };
  };
  // how it was freed: every machine calmed (peace), none calmed (brave), some of each (both)
  LF.howOf = (s) => { const of = typeof s.strays === 'number' ? s.strays : 0, c = s.cal | 0; return of <= 0 || c >= of ? 'peace' : c <= 0 ? 'brave' : 'both'; };
  // the chest's place: the first of eight spots round the beacon (2 m off) with air for it and a floor under it
  LF.chestSpot = function (get, solid, b) {
    for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2], [2, 2], [-2, 2], [2, -2], [-2, -2]]) {
      const x = b[0] + dx, z = b[2] + dz;
      for (const y of [b[1], b[1] + 1, b[1] - 1]) if (!get(x, y, z) && !get(x, y + 1, z) && solid(get(x, y - 1, z))) return [x, y, z];
    }
    return null;
  };
  // eight words of the compass from a direction (x east, z south; north is −z)
  LF.DIRS = ['n', 'no', 'o', 'so', 's', 'sw', 'w', 'nw'];
  LF.dirOf = (dx, dz) => { const a = Math.atan2(dx, -dz); return LF.DIRS[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8]; };
  // the next goal: the nearest other outpost not freed (60–1500 m), else the nearest village not visited (60–2000 m)
  LF.nextOf = function (sites, villages, p, skip) {
    let best = null, bd = 1500;
    for (const s of sites) { if (!s || s === skip || s.st === 'frei' || !Number.isFinite(s.x) || !Number.isFinite(s.z)) continue; const d = Math.hypot(s.x - p[0], s.z - p[2]); if (d >= 60 && d < bd) { bd = d; best = { kind: 'out', ref: s, x: s.x + 0.5, z: s.z + 0.5, d } }; }
    if (best) return best;
    bd = 2000;
    for (const v of villages) { if (!v || v.visited || !Number.isFinite(v.x)) continue; const d = Math.hypot(v.x - p[0], v.z - p[2]); if (d >= 60 && d < bd) { bd = d; best = { kind: 'vil', ref: v, x: v.x + 0.5, z: v.z + 0.5, d }; } }
    return best;
  };

  // ---------------------------------------------------------------- the record (meta.adventure.fest: pages, chests)
  const rec = () => (VR.Adventure && VR.Adventure.rec) || null;
  const fest = () => { const r = rec(); if (!r) return null; if (!r.fest || typeof r.fest !== 'object') r.fest = { pages: {}, chest: {} }; if (!r.fest.pages) r.fest.pages = {}; if (!r.fest.chest) r.fest.chest = {}; return r.fest; };
  LF.pages = () => { const f = fest(); return f ? f.pages : {}; };

  // ---------------------------------------------------------------- the goal on the HUD and the lights
  let goalEl = null, goalKey = '';
  function css() {
    if (typeof document === 'undefined' || document.getElementById('lfcss')) return;
    const st = document.createElement('style'); st.id = 'lfcss';
    st.textContent = '#libgoal{position:absolute;left:50%;top:54px;transform:translateX(-50%);padding:5px 14px;border-radius:14px;background:rgba(14,22,40,.62);color:#e8f6ff;font:600 13px/1.3 inherit;letter-spacing:.2px;pointer-events:none;white-space:nowrap;box-shadow:0 2px 10px rgba(0,0,0,.25);border:1px solid rgba(127,246,255,.35);transition:opacity .4s}#libgoal b{color:#7ff6ff;font-weight:700}#libgoal i{font-style:normal;opacity:.8;margin-left:8px}#libgoal.ready{border-color:rgba(255,226,140,.7)}#libgoal.ready b{color:#ffe28c}';
    document.head.appendChild(st);
  }
  LF.goalUi = function (s, G) {
    if (typeof document === 'undefined' || !document.createElement) return;
    const key = s && G ? s.id + ':' + G.step + ':' + G.n + '/' + G.of : '';
    if (key === goalKey) return; goalKey = key;
    if (!key) { if (goalEl) goalEl.style.display = 'none'; return; }
    if (!goalEl) { css(); goalEl = document.createElement('div'); goalEl.id = 'libgoal'; goalEl.setAttribute('aria-live', 'polite'); (document.getElementById('hud') || document.body).appendChild(goalEl); }
    const k = VR.Binds && VR.Binds.label ? VR.Binds.label('KeyV', VR.I18N && VR.I18N.lang) : 'V', name = Lb().nameOf(s);
    goalEl.className = G.step === 'beacon' ? 'ready' : '';
    goalEl.innerHTML = G.step === 'beacon'
      ? `✦ <b>${esc(T('g.lf.goal.ready', { name }))}</b><i>${esc(T('g.lf.goal.readyHow', { key: k }))}</i>`
      : `◇ <b>${esc(T('g.lf.goal', { name, n: G.n, of: G.of === null ? '?' : G.of }))}</b><i>${esc(T('g.lf.goal.how', { key: k }))}</i>`;
    goalEl.style.display = '';
  };
  // (the busy screens: the moment, its camera, the Lichtleiter, the timing ring, the capture ring — they say it themselves)
  const busy = (L) => !!(L.moment || L.mcam || L.puz || L.calmSt || L.ringSite);
  LF.look = function (g) {
    const t0 = now(), L = Lb(), F = Fo(); if (!LF.on || !L || !F || !g.player) return;
    const p = g.player.pos, P = g.particles, En = g.entities;
    let near = null, nd = 76;
    for (const s of L.sites().values()) { if (!s.known || s.st === 'frei') continue; const d = Math.hypot(p[0] - s.x, p[2] - s.z); if (d < nd) { nd = d; near = s; } }
    const G = near && F.advOn && F.advOn(g) ? LF.goalOf(near) : null;
    LF.goalUi(G && !busy(L) ? near : null, G);
    const lite = !!(g.settings && (g.settings.preset === 'potato' || g.settings.ultraLite));
    if (G && LF.marks && !lite && P && P.glow && !busy(L)) {
      if (G.step === 'beacon' && near.beacon) { const b = near.beacon; P.glow(b[0] + 0.5, b[1] + 2.4 + Math.random() * 0.4, b[2] + 0.5, [1, 0.9, 0.55], 1.4, 0.05, 0.5); LF.cost.marks++; }
      else if (En) { let k = 0; for (const m of En.mobs) { const f = m.foe; if (!f || f.gone || f.site !== near.id || f.wave || f.helper || f.st === 'down' || f.st === 'calm' || f.st === 'leave' || k >= 4) continue; const K = F.KINDS[f.k]; P.glow(m.pos[0], m.pos[1] + K.h + 0.55, m.pos[2], [0.65, 0.95, 1], 0.55, 0.02, 0.32); k++; LF.cost.marks++; } }
    }
    LF.lookCheer(g);
    if (LF.nextAt && (g.time || 0) >= LF.nextAt) { LF.nextAt = 0; LF.pointNext(g, LF.lastFreed); }
    if (LF.next && Math.hypot(p[0] - LF.next.x, p[2] - LF.next.z) < (LF.next.kind === 'out' ? 70 : 40)) LF.next = null;   // (reached: the Wegweiser lets go)
    LF.cost.looks++; LF.cost.ms += now() - t0;
  };

  // ---------------------------------------------------------------- the celebration
  LF.celebrate = function (g, s) {
    const f = fest(), L = Lb(); if (!f || !s) return;
    const day = g.env ? g.env.day | 0 : 0, how = LF.howOf(s), first = !f.pages[s.id];
    if (first) f.pages[s.id] = { day, how, n: typeof s.strays === 'number' ? s.strays : 0, c: s.cal | 0 };
    // the chest beside the beacon (once)
    const b = s.beacon, w = g.world, R = VR.R;
    if (b && w && !f.chest[s.id] && R && R.byName.chest) {
      const solid = (st) => !!(st && (R.T.flags[st] & VR.F.SOLID) && !(R.T.flags[st] & VR.F.LEAVES));
      const q = LF.chestSpot((x, y, z) => w.getBlock(x, y, z), solid, b);
      if (q) {
        let st = R.byName.chest.defaultState;
        try { const ty = R.byName.chest; if (ty.has && ty.has('facing') && ty.state) st = ty.state({ facing: Math.abs(q[0] - b[0]) > Math.abs(q[2] - b[2]) ? (q[0] > b[0] ? 'west' : 'east') : (q[2] > b[2] ? 'north' : 'south') }); } catch (e) { st = R.byName.chest.defaultState; }
        w.setBlock(q[0], q[1], q[2], st, 4);
        const c = w.col(q[0] >> 4, q[2] >> 4);
        if (c && c.blockEntities) c.blockEntities.set((q[1] << 8) | ((q[2] & 15) << 4) | (q[0] & 15), { type: 'chest', loot: 'outpost', items: null });
        f.chest[s.id] = q; LF.chestAt = q;
        if (g.particles) g.particles.spark(q[0] + 0.5, q[1] + 1, q[2] + 0.5, [1, 0.88, 0.45], 30, 3.2, 1);
        if (g.audio && g.audio.play) g.audio.play('twinkle');
      }
    }
    // the page's toast
    if (first && g.ui && g.ui.hint) setTimeout(() => { try { g.ui.hint(T('g.lf.page', { name: L.nameOf(s) }), 3200); } catch (e) { /* the screen changed */ } }, 4400);
    // the nearest village heard of it
    const V = g.villages; let best = null, bd = 900;
    if (V && V.sites) for (const v of V.sites) { const d = Math.hypot(v.x - s.x, v.z - s.z); if (d < bd) { bd = d; best = v; } }
    if (best) { const kn = V.known && V.known.get ? V.known.get(best.id) : null; LF.cheer = { id: best.id, x: best.x + 0.5, z: best.z + 0.5, name: (kn && kn.name) || best.name || '', out: L.nameOf(s), t: g.time || 0 }; }
    LF.lastFreed = s;
  };
  // the cheer: the player among the village's people (≥ 2 within 15 m) — they clap, one line says why
  LF.lookCheer = function (g) {
    const C = LF.cheer, V = g.villages; if (!C || !V || !V.joyReact) return;
    const p = g.player.pos; if (Math.hypot(p[0] - C.x, p[2] - C.z) > 60) return;
    let n = 0; if (V.agents) for (const a of V.agents) if (a && a.pos && Math.hypot(a.pos[0] - p[0], a.pos[2] - p[2]) < 15 && a.pose !== 'sleep') n++;
    if (n < 2) return;
    LF.cheer = null;
    try { V.joyReact('applaud'); } catch (e) { /* folkjoy's */ }
    LF.cheered = (LF.cheered | 0) + 1;
    const txt = T('g.lf.cheer', { v: C.name || T('g.lf.cheer.vil'), o: C.out });
    const fk = g.funke; if (fk && fk.on && fk.on() && fk.show) fk.show(txt); else if (g.ui && g.ui.hint) g.ui.hint(txt, 4200);
  };
  // the next goal: Funke names it, its Wegweiser points there
  LF.pointNext = function (g, s) {
    const L = Lb(), V = g.villages, p = g.player.pos; if (!L) return null;
    const vils = []; if (V && V.sites) for (const v of V.sites) { const kn = V.known && V.known.get ? V.known.get(v.id) : null; vils.push({ x: v.x, z: v.z, visited: !!(kn && kn.visited), name: (kn && kn.name) || v.name || '', y: v.y }); }
    const n = LF.nextOf([...L.sites().values()], vils, p, s); if (!n) return null;
    const name = n.kind === 'out' ? L.nameOf(n.ref) : n.ref.name, dir = T('g.lf.dir.' + LF.dirOf(n.x - p[0], n.z - p[2]));
    const y = n.kind === 'out' ? (n.ref.beacon ? n.ref.beacon[1] + 4 : Number.isFinite(n.ref.y) ? n.ref.y + 4 : p[1]) : (Number.isFinite(n.ref.y) ? n.ref.y + 2 : p[1]);
    LF.next = { kind: n.kind, x: n.x, z: n.z, pos: [n.x, y, n.z], name, t: g.time || 0 };
    const key = (VR.Binds && VR.Binds.label ? VR.Binds.label('KeyV', VR.I18N && VR.I18N.lang) : 'V');
    const chest = LF.chestAt ? T('g.lf.chest') + ' ' : '';
    const txt = chest + T(n.kind === 'out' ? 'g.lf.next.out' : 'g.lf.next.vil', { name, d: Math.round(n.d / 10) * 10, dir, key });
    const fk = g.funke; if (fk && fk.on && fk.on() && fk.show) fk.show(txt); else if (g.ui && g.ui.hint) g.ui.hint(txt, 5200);
    LF.chestAt = null;
    return LF.next;
  };

  // ---------------------------------------------------------------- the glue (wrapping, nothing edited)
  const L0 = Lb();
  if (L0 && L0.beat && !L0.beat.__lf) {
    const ob = L0.beat;
    L0.beat = function (g, s, k) {
      if (LF.on && k === 'banner') { try { LF.celebrate(g, s); } catch (e) { LF.err = String(e && e.message || e); } }
      const r = ob.apply(this, arguments);
      if (LF.on && k === 'end') LF.nextAt = (g.time || 0) + 1.5;
      return r;
    };
    L0.beat.__lf = true;
  }
  if (L0 && L0.look && !L0.look.__lf) {
    const ol = L0.look;
    L0.look = function (g) { const r = ol.apply(this, arguments); try { LF.look(g); } catch (e) { LF.err = String(e && e.message || e); } return r; };
    L0.look.__lf = true;
  }
  if (VR.Funke && VR.Funke.addSource) VR.Funke.addSource(() => (LF.on && LF.next ? { pos: LF.next.pos, name: LF.next.name, kind: 'libnext' } : null));
  const Q = VR.Quests;
  if (Q && Array.isArray(Q.journalSections)) Q.journalSections.push(() => {
    const P = LF.pages(), ids = Object.keys(P); if (!ids.length || !L0) return '';
    let h = `<h3>📖 ${esc(T('g.lf.pages'))}</h3><div class="jdone">`;
    for (const id of ids) { const q = P[id], s = L0.siteOf(id) || { id }; h += `<div>✦ ${esc(T('g.lf.pageLine', { day: q.day, name: L0.nameOf(s) }))} — ${esc(T('g.lf.how.' + (q.how || 'peace')))}</div>`; }
    return h + '</div>';
  });
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

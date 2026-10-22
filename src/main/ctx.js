// ============================================================================
// Die Aktion (e-ctx; docs/superpowers/specs/2026-10-22-erlebnis-design.md §1, plan docs/superpowers/plans/
// 2026-10-22-e-ctx.md §2.1): one key does the right thing. The vehicle key `veh` (V — the id stays, so saved bindings
// keep working; its label „Aktion (Kontext)") becomes the Aktion: the pad's west face button and on touch a round button
// that shows the action's icon. Near the crosshair a prompt says what V will do: „[V] Einsteigen", „[V] Mit Mara reden",
// „[V] Reise zur Turmzitadelle · 1,2 km". Holding V 1.5 s fills the Heimkehr ring and goes home (game.goHome); letting
// go earlier cancels it. Right-click "use" stays as it is.
//   VR.Ctx.resolve(c) — pure, the first row that matches wins:
//     1 a held tool claims V (the Builder Wand's paste)        → the tool does it (unchanged)
//     2 in a vehicle (ship, bike, seat, tram, aboard; in space: a bay, a body, an escape path) → the vehicle's own V
//     3 a story beat is offered                               → Ansehen
//     4 something within reach (≤ 4.5 m, a 6° cone)          → talk, open, sleep, get in, repair, shop, pet …
//     5 a travel target in the aim (intent.js)                → Reise zu ‹Ziel› · ‹Entfernung›
//     6 nothing                                               → Funke fragen (VR.Funke.ask, when it exists); else no
//                                                               prompt, and V whispers the nearest target on the HUD
//   c = {tool, vehicle: {kind, state, space}, story, near: {kind, name, dist, ang, open, broken, ref}, aim: {kind, id,
//   name, toKey, dist}, funke} → {row, id, key, vars, act, icon, target?, ref?}
//   VR.Ctx.text(res, code) the prompt · dist(m, lang) · pickNear(eye, dir, things) · pressState() · press(st, down, dt,
//   ring) the tap / hold machine · LABELS (the words, also in lang_de.js / lang_en.js) · hooks (siblings: story, space,
//   near) · gather(g) · tick(g, dt) the game's frame (one hook in game.js) · act(g, res)
// Cost 🟢 (every preset alike): the gather at 10 Hz (and at once on V) — the block under the crosshair, one entity ray,
// a cone over the villagers and pets within 6 m, the vistas near you; the prompt is DOM written on change.
// ============================================================================
(function (VR) {
  'use strict';
  const C = VR.Ctx = VR.Ctx || {};
  const DEG = Math.PI / 180;
  C.REACH = 4.5; C.CONE = 6 * DEG; C.TAP = 0.3; C.HOLD = 1.5; C.NEAR_MIN = 20; C.FAR_MAX = 8000;
  // the words (German first), also in the tables (test/ctx.js keeps them the same)
  const LABELS = C.LABELS = {
    'g.ctx.paste': ['Einfügen', 'Paste'],
    'g.ctx.getOut': ['Aussteigen', 'Get out'],
    'g.ctx.land': ['Landen', 'Land'],
    'g.ctx.landCancel': ['Landung abbrechen', 'Abort the landing'],
    'g.ctx.dismount': ['Absteigen', 'Get off'],
    'g.ctx.standUp': ['Aufstehen', 'Stand up'],
    'g.ctx.pilotSeat': ['Zum Pilotensitz', 'To the pilot seat'],
    'g.ctx.droneOff': ['Drohne beenden', 'End the drone'],
    'g.ctx.dock': ['Andocken', 'Dock'],
    'g.ctx.landOn': ['Landen', 'Land'],
    'g.ctx.orbit': ['Kreisbahn', 'Orbit'],
    'g.ctx.watch': ['Ansehen', 'Watch'],
    'g.ctx.talk': ['Mit {name} reden', 'Talk to {name}'],
    'g.ctx.quest': ['Auftrag von {name}', 'Task from {name}'],
    'g.ctx.open': ['Öffnen', 'Open'],
    'g.ctx.close': ['Schließen', 'Shut'],
    'g.ctx.chest': ['Öffnen', 'Open'],
    'g.ctx.sleep': ['Schlafen', 'Sleep'],
    'g.ctx.board': ['Einsteigen', 'Get in'],
    'g.ctx.repair': ['Reparieren', 'Repair'],
    'g.ctx.fast': ['Schnellreise', 'Fast travel'],
    'g.ctx.calm': ['Beruhigen', 'Calm it'],
    'g.ctx.shop': ['Einkaufen', 'Shop'],
    'g.ctx.portal': ['Hindurchgehen', 'Step through'],
    'g.ctx.view': ['Aussicht genießen', 'Enjoy the view'],
    'g.ctx.pet': ['Streicheln', 'Pet'],
    'g.ctx.sit': ['Hinsetzen', 'Sit down'],
    'g.ctx.travel': ['Reise {to} · {d}', 'Travel {to} · {d}'],
    'g.ctx.funke': ['Funke fragen', 'Ask Funke'],
    'g.ctx.home': ['Heimkehr …', 'Going home …'],
    'g.ctx.toPlace': ['nach {name}', 'to {name}'],
    'g.ctx.toWonder': ['zum Wunder {name}', 'to the wonder {name}'],
    'g.ctx.toWp': ['zum Wegpunkt {name}', 'to the waypoint {name}'],
    'g.ctx.toThing': ['zu {name}', 'to {name}'],
    'g.ctx.to.temple': ['zum Tor-Tempel', 'to the Gate Temple'],
    'g.ctx.to.citadel': ['zur Turmzitadelle', 'to the Spire Citadel'],
    'g.ctx.to.isles': ['zu den Himmelsinseln', 'to the Sky Isles'],
    'g.ctx.to.lighthouse': ['zum Leuchtturm', 'to the lighthouse'],
    'g.ctx.to.falls': ['zum Wasserfall', 'to the waterfall'],
    'g.ctx.to.nova': ['nach Nova Haven', 'to Nova Haven'],
    'g.ctx.to.station': ['zur Bergstation', 'to the Mountain Station'],
    'g.ctx.to.lookout': ['zum Aussichtsturm', 'to the lookout'],
    'g.ctx.to.hills': ['zu den Kuppelhügeln', 'to the Pod Hills'],
  };
  const R = (row, id, key, act, icon, vars) => ({ row, id, key, act, icon, vars: vars || null });
  const NONE = R(6, 'none', null, 'whisper', '◉'), FUNKE = R(6, 'funke', 'g.ctx.funke', 'funke', '✨');
  const TOOL = { paste: R(1, 'tool', 'g.ctx.paste', 'tool', '📋') };
  const VEH = {
    flying: R(2, 'vehicle', 'g.ctx.land', 'vehicle', '🛬'), landed: R(2, 'vehicle', 'g.ctx.getOut', 'vehicle', '⏏'), landing: R(2, 'vehicle', 'g.ctx.landCancel', 'vehicle', '⤴'),
    bike: R(2, 'vehicle', 'g.ctx.dismount', 'vehicle', '⏏'), seat: R(2, 'vehicle', 'g.ctx.standUp', 'vehicle', '⤴'), tram: R(2, 'vehicle', 'g.ctx.getOut', 'vehicle', '⏏'),
    cabin: R(2, 'vehicle', 'g.ctx.pilotSeat', 'vehicle', '🪑'), drone: R(2, 'vehicle', 'g.ctx.droneOff', 'vehicle', '⏏'),
    bay: R(2, 'vehicle', 'g.ctx.dock', 'dock', '⚓'), body: R(2, 'vehicle', 'g.ctx.landOn', 'landBody', '🛬'), escape: R(2, 'vehicle', 'g.ctx.orbit', 'orbit', '🪐'),
  };
  const STORY = R(3, 'story', 'g.ctx.watch', 'story', '🎬');
  // row 4: kind → [key, act, icon] (a door says Schließen when it stands open; a beacon Reparieren while broken)
  const NEAR = {
    villager: ['g.ctx.talk', 'talk', '💬'], quest: ['g.ctx.quest', 'talk', '✦'], door: ['g.ctx.open', 'use', '🚪'], gate: ['g.ctx.open', 'use', '🚪'],
    chest: ['g.ctx.chest', 'use', '🧰'], bed: ['g.ctx.sleep', 'use', '🛏'], ship: ['g.ctx.board', 'board', '🚀'], vehicle: ['g.ctx.board', 'board', '🛵'],
    beacon: ['g.ctx.fast', 'beacon', '⚡'], machine: ['g.ctx.calm', 'calm', '🕊'], shop: ['g.ctx.shop', 'shop', '🛒'], portal: ['g.ctx.portal', 'portal', '🌀'],
    bench: ['g.ctx.view', 'vista', '🌄'], pet: ['g.ctx.pet', 'pet', '🐾'], seat: ['g.ctx.sit', 'use', '🪑'],
  };
  // ---------------------------------------------------------------- the resolver (pure)
  C.resolve = function (c) {
    if (!c) return NONE;
    if (c.tool) return TOOL[c.tool.id] || TOOL.paste;
    const v = c.vehicle;
    if (v) {
      if (v.space && VEH[v.space]) return VEH[v.space];
      if (v.kind === 'ship' || v.kind === 'blockship') return VEH[v.state === 'landed' ? 'landed' : v.state === 'landing' ? 'landing' : 'flying'];
      return VEH[v.kind] || VEH.landed;
    }
    if (c.story) return STORY;
    const n = c.near;
    if (n && NEAR[n.kind] && n.dist <= C.REACH && (n.ang || 0) <= C.CONE) {
      const m = NEAR[n.kind];
      let key = m[0];
      if ((n.kind === 'door' || n.kind === 'gate') && n.open) key = 'g.ctx.close';
      if (n.kind === 'beacon' && n.broken) key = 'g.ctx.repair';
      const r = { row: 4, id: 'near', key, act: m[1], icon: n.kind === 'beacon' && n.broken ? '🔧' : m[2], vars: n.name ? { name: n.name } : null, kind: n.kind, ref: n.ref || null, near: n };
      return r;
    }
    const a = c.aim;
    if (a && a.dist >= C.NEAR_MIN && a.dist <= C.FAR_MAX) return { row: 5, id: 'travel', key: 'g.ctx.travel', act: 'travel', icon: '🧭', vars: { toKey: a.toKey || 'g.ctx.toThing', name: a.name || '', m: a.dist }, target: a.target || a };
    return c.funke ? FUNKE : NONE;
  };
  // ---------------------------------------------------------------- words
  const lang = () => (VR.I18N && VR.I18N.lang === 'en' ? 'en' : 'de');
  const tr = (key, vars) => {
    const L = LABELS[key];
    if (VR.I18N && VR.I18N.tx) return VR.I18N.tx(key, vars || null, L ? L[0] : key, L ? L[1] : key);
    let s = L ? L[0] : key; if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
    return s;
  };
  C.tr = tr;
  // the distance as a player reads it: 640 m · 1,2 km · 12 km
  C.dist = function (m, l) {
    l = l || lang();
    const r10 = Math.round((m || 0) / 10) * 10;
    if (r10 < 1000) return r10 + ' m';
    if (m < 10000) { const s = (m / 1000).toFixed(1); return (l === 'en' ? s : s.replace('.', ',')) + ' km'; }
    return Math.round(m / 1000) + ' km';
  };
  // the prompt: „[V] Mit Mara reden" (code: the key bound to veh); '' when the row shows nothing
  C.label = function (res, l) {
    if (!res || !res.key) return '';
    if (res.id === 'travel') return tr('g.ctx.travel', { to: tr(res.vars.toKey, { name: res.vars.name }), d: C.dist(res.vars.m, l) });
    return tr(res.key, res.vars);
  };
  C.text = function (res, code) {
    const s = C.label(res); if (!s) return '';
    const B = VR.Binds, k = B ? B.label(code || 'KeyV', lang()) : 'V';
    return '[' + k + '] ' + s;
  };
  // ---------------------------------------------------------------- the thing in reach (pure)
  // things: [{kind, pos, r?, name?, …}] → the one the eye looks at: its surface within reach, the angle to it (less the
  // angle its radius covers) within the cone; the smallest angle wins, then the nearest. → {…thing, dist, ang} or null
  C.pickNear = function (eye, dir, things, reach, cone) {
    reach = reach || C.REACH; cone = cone || C.CONE;
    let best = null, bA = Infinity, bD = Infinity;
    const dl = Math.hypot(dir[0], dir[1], dir[2]) || 1;
    for (let i = 0; i < things.length; i++) {
      const q = things[i]; if (!q || !q.pos) continue;
      const dx = q.pos[0] - eye[0], dy = q.pos[1] - eye[1], dz = q.pos[2] - eye[2], d = Math.hypot(dx, dy, dz) || 1e-6;
      const r = q.r || 0.4, surf = Math.max(0, d - r);
      if (surf > reach) continue;
      const cos = (dx * dir[0] + dy * dir[1] + dz * dir[2]) / (d * dl);
      if (cos <= 0) continue;
      const ang = Math.acos(Math.min(1, cos)), eff = Math.max(0, ang - Math.asin(Math.min(1, r / d)));
      if (eff > cone) continue;
      if (eff < bA - 1e-6 || (Math.abs(eff - bA) <= 1e-6 && surf < bD)) { bA = eff; bD = surf; best = { q, ang, eff, surf }; }
    }
    return best ? Object.assign({}, best.q, { dist: best.surf, ang: best.ang, eff: best.eff }) : null;
  };
  // a ship's hull along the look ray (pure over occ(x, y, z) → is that block cell the hull): the distance to the first
  // hull cell within reach, or null. A ship's hit box is the axis-aligned box round its turned footprint — beside a
  // parked ship you stand inside it, and the ray "hits" at 0 m whatever you look at (a browser pilot run: after a trip
  // every V said „Einsteigen" and boarded instead of the next trip); the hull itself decides.
  C.hullAlong = function (eye, dir, reach, occ, step) {
    reach = reach || C.REACH; step = step || 0.2;
    const dl = Math.hypot(dir[0], dir[1], dir[2]) || 1;
    let px = NaN, py = NaN, pz = NaN;
    for (let t = 0; t <= reach + 1e-9; t += step) {
      const x = Math.floor(eye[0] + dir[0] / dl * t), y = Math.floor(eye[1] + dir[1] / dl * t), z = Math.floor(eye[2] + dir[2] / dl * t);
      if (x === px && y === py && z === pz) continue;
      px = x; py = y; pz = z;
      if (occ(x, y, z)) return t;
    }
    return null;
  };
  // ---------------------------------------------------------------- tap or hold (pure)
  // a press shorter than TAP is the action (on release); held, the ring fills from TAP to HOLD and Heimkehr fires once;
  // let go between: nothing. ring false (a vehicle, a tool): never a ring, never Heimkehr.
  C.pressState = () => ({ t: -1, fired: false });
  const OUT = { act: null, ring: 0 };
  C.press = function (st, down, dt, ring) {
    const o = { act: null, ring: 0 };
    if (down) {
      if (st.t < 0) st.t = 0; else st.t += dt > 0 ? dt : 0;
      if (st.t === 0 && dt > 0) st.t = dt;
      if (ring) {
        o.ring = Math.max(0, Math.min(1, (st.t - C.TAP) / (C.HOLD - C.TAP)));
        if (st.t >= C.HOLD - 1e-9 && !st.fired) { st.fired = true; o.act = 'home'; }
      }
      return o;
    }
    if (st.t >= 0) { const t = st.t, f = st.fired; st.t = -1; st.fired = false; if (!f && t < C.TAP) o.act = 'tap'; }
    return o;
  };
  void OUT;

  // ================================================================ the game side
  C.hooks = { story: null, space: null, near: [] };   // siblings: story(g) → beat | null · space(g) → 'bay'|'body'|'escape'|null · near: [(g, eye, dir) → {kind, pos, r, name, act(g)} | null]
  C.cost = { frames: 0, ms: 0, worst: 0, gathers: 0, gatherMs: 0 };
  C.on = true;
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const GC = { tool: null, vehicle: null, story: null, near: null, aim: null, funke: false };
  const VEHC = { kind: '', state: '', space: null };
  let typeKind = null;
  // a block type → its row-4 kind (once per registry)
  function blockKinds() {
    const Rg = VR.R; if (!Rg || !Rg.types) return null;
    if (typeKind && typeKind.length === Rg.types.length) return typeKind;
    const out = new Array(Rg.types.length).fill(null);
    for (let i = 0; i < Rg.types.length; i++) {
      const t = Rg.types[i]; if (!t || !t.o) continue;
      const k = t.o.kind;
      if (k === 'door' || k === 'trapdoor') out[i] = t.o.ironDoor ? null : 'door';
      else if (k === 'gate') out[i] = 'gate';
      else if (t.o.vx && t.o.vx.kind === 'mdoor') out[i] = 'door';
      else if (k === 'bed' || t.o.bed) out[i] = 'bed';
      else if (t.o.ui === 'chest' || /chest$|barrel|cargo_crate/.test(t.name)) out[i] = 'chest';
      else if (k === 'seat' || t.o.seat) out[i] = 'seat';
      else if (t.o.portal) out[i] = 'portal';
    }
    return (typeKind = out);
  }
  const funkeOn = (g) => !!(VR.Funke && typeof VR.Funke.ask === 'function' && !(g.settings && g.settings.funke === false));
  // the situation now → GC (one object, refilled)
  C.gather = function (g) {
    const t0 = now(), c = GC;
    c.tool = null; c.vehicle = null; c.story = null; c.near = null; c.aim = null; c.funke = funkeOn(g);
    const p = g && g.player; if (!p) return c;
    // 1 · the wand holding a copy claims V (gadgets.js wandInput pastes)
    const h = p.inv && p.inv.held, hd = h && VR.itemDef ? VR.itemDef(h.id) : null, gad = g.gadgets;
    if (hd && hd.use === 'wand' && gad && gad.wand && gad.wand.clip) { c.tool = TOOL_PASTE; return c; }
    // 2 · a vehicle (its own V)
    const r = gad && gad.riding;
    if (r || (gad && gad.drone)) {
      const V = VEHC; V.space = C.hooks.space ? C.hooks.space(g) : null; V.state = '';
      if (gad.drone && !r) V.kind = 'drone';
      else if (r.type === 'starship') { V.kind = 'ship'; V.state = g.flight ? g.flight.state : 'landed'; }
      else if (r.type === 'ship') { V.kind = 'blockship'; const S = gad.ship, fl = S && S.flight; V.state = fl ? fl.state : (S && S.state === 'flying' ? 'flying' : 'landed'); }
      else V.kind = r.type === 'bike' ? 'bike' : r.type === 'seat' ? 'seat' : r.type === 'tram' ? 'tram' : r.type === 'cabin' ? 'cabin' : 'seat';
      c.vehicle = V; return c;
    }
    // 3 · a story beat
    const beat = C.hooks.story ? C.hooks.story(g) : (VR.Story && typeof VR.Story.offer === 'function' ? VR.Story.offer(g) : null);
    if (beat) { c.story = beat; return c; }
    // 4 · in reach: the crosshair's block, the crosshair's entity, the cone over people and pets, a vista bench, the siblings' things
    const eye = p.eyePos ? p.eyePos() : [p.pos[0], p.pos[1] + 1.62, p.pos[2]], dir = p.lookDir ? p.lookDir() : [-Math.sin(p.yaw), 0, -Math.cos(p.yaw)];
    let near = null;
    const t = p.target, BK = blockKinds();
    if (t && BK && (t.dist === undefined || t.dist <= C.REACH)) {
      const ty = VR.R.T.type[t.state], k = BK[ty];
      if (k) {
        const ti = VR.R.types[ty];
        let open = false; try { open = (k === 'door' || k === 'gate') && ti.has && ti.has('open') && !!ti.get(t.state, 'open'); } catch (e) { open = false; }
        near = { kind: k, dist: t.dist !== undefined ? t.dist : 2, ang: 0, open, block: [t.x, t.y, t.z, t.state] };
      }
    }
    const En = g.entities;
    if (En && En.rayEntity) {
      const hit = En.rayEntity(eye, dir, C.REACH);
      // (a ship: its hull along the ray, not its box — see hullAlong)
      const SS = g.starships, sh = hit && hit.ent && hit.ent.kind === 'starship' && SS && SS.inOcc && hit.ent.d && hit.ent.d.occ && hit.ent.d.meta ? hit.ent : null;
      const hd = sh ? C.hullAlong(eye, dir, C.REACH, (x, y, z) => SS.inOcc(sh, x, y, z)) : hit ? hit.dist : null;
      if (hit && hd !== null && (!near || hd < near.dist)) { const n2 = entityNear(g, hit.ent, hd); if (n2) near = n2; }
    }
    if (!near) {
      const list = CONE; list.length = 0;
      const Vg = g.villages;
      if (Vg && Vg.agents) for (const a of Vg.agents) { if (!a || !a.pos || Math.abs(a.pos[0] - eye[0]) > 6 || Math.abs(a.pos[2] - eye[2]) > 6) continue; list.push({ kind: questGiver(a) ? 'quest' : 'villager', name: a.p && a.p.name ? a.p.name : '', pos: [a.pos[0], a.pos[1] + 1.1, a.pos[2]], r: 0.45, ref: a }); }
      if (En && En.mobs) for (const m of En.mobs) { if (!m || m.dead || !m.def || !m.def.companion || !m.pos || Math.abs(m.pos[0] - eye[0]) > 6 || Math.abs(m.pos[2] - eye[2]) > 6) continue; list.push({ kind: 'pet', name: (m.pet && m.pet.name) || '', pos: [m.pos[0], m.pos[1] + (m.h || 0.6) * 0.5, m.pos[2]], r: Math.max(0.3, m.w || 0.4), ref: m }); }
      for (const f of C.hooks.near) { try { const q = f(g, eye, dir); if (q) list.push(q); } catch (e) { /* a sibling's hook never breaks the key */ } }
      near = list.length ? C.pickNear(eye, dir, list) : null;
    }
    if (!near && g.wow && g.wow.list && g.wow.list.size) {
      for (const v of g.wow.list.values()) { const dx = v.x - p.pos[0], dz = v.z - p.pos[2]; if (dx * dx + dz * dz < C.REACH * C.REACH && Math.abs(v.y - p.pos[1]) < 3) { near = { kind: 'bench', dist: Math.hypot(dx, dz), ang: 0, ref: v }; break; } }
    }
    c.near = near;
    // 5 · a travel target in the aim (intent.js keeps it, 10 Hz)
    const I = VR.Intent, aimed = I && I.aimed ? I.aimed : null;
    if (aimed) c.aim = aimed;
    const Cs = C.cost; Cs.gathers++; Cs.gatherMs += now() - t0;
    return c;
  };
  const CONE = [];
  const TOOL_PASTE = { id: 'paste' };
  const questGiver = (a) => !!(a && (a.questMark || (VR.Quests && typeof VR.Quests.isGiver === 'function' && VR.Quests.isGiver(a))));
  function entityNear(g, e, d) {
    if (!e) return null;
    if (e.kind === 'starship' && e.d) return { kind: 'ship', name: e.d.meta ? e.d.meta.name : '', dist: d, ang: 0, ref: e };
    if (e.def && e.def.companion) return { kind: 'pet', name: (e.pet && e.pet.name) || '', dist: d, ang: 0, ref: e };
    if (e.vil && e.p) return { kind: questGiver(e) ? 'quest' : 'villager', name: e.p.name || '', dist: d, ang: 0, ref: e };
    if (e.type === 'hoverbike' || e.kind === 'hoverbike' || (e.onUse && e.spd !== undefined)) return { kind: 'vehicle', dist: d, ang: 0, ref: e };
    if (e.onUse && g.trams && g.trams.cars && g.trams.cars.indexOf(e) >= 0) return { kind: 'vehicle', dist: d, ang: 0, ref: e };
    return null;
  }

  // ---------------------------------------------------------------- doing it
  C.act = function (g, res) {
    const p = g.player; if (!res || !p) return false;
    const n = res.near, ref = res.ref;
    switch (res.act) {
      case 'talk': if (ref && ref.onUse) { ref.onUse(p); return true; } if (ref && g.villages && g.villages.openTalk) { g.villages.openTalk(ref); return true; } return false;
      case 'use': if (n && n.block && g.interactBlock) return !!g.interactBlock(n.block[0], n.block[1], n.block[2], n.block[3], p); return false;
      case 'board':
        if (ref && ref.kind === 'starship' && g.starships) { g.starships.board(ref, p); return true; }
        if (ref && ref.onUse) { ref.onUse(p); return true; }
        return false;
      case 'pet': if (ref && g.companions && g.companions.pat) { g.companions.pat(ref); return true; } return false;
      case 'vista': if (ref && g.wow && g.wow.start && !g.wow.active) { g.wow.start(ref); return true; } return false;
      case 'portal': {
        const Tv = VR.Travel, blk = n && n.block, P = Tv && Tv.portalTable ? Tv.portalTable() : null;
        if (!Tv || !blk || !P) return false;
        const i = P.byType[VR.R.T.type[blk[3]]]; if (i < 0) return false;
        Tv.go(g, { dim: Tv.gateTarget(g.dim, P.dims[i], g.meta), via: 'gate' });
        return true;
      }
      case 'beacon': case 'calm': case 'shop': if (n && typeof n.act === 'function') { n.act(g); return true; } return false;
      case 'story': if (VR.Story && typeof VR.Story.watch === 'function') { VR.Story.watch(g); return true; } return false;
      case 'travel': return !!(VR.Intent && VR.Intent.start && VR.Intent.start(g, res.target));
      case 'funke': if (VR.Funke && VR.Funke.ask) { VR.Funke.ask(g); return true; } return false;
      case 'whisper': C.whisper(g); return true;
      default: return false;   // tool, vehicle: theirs (on press, in their own code)
    }
  };
  // nothing to do here: the HUD whispers the nearest target not stood at, with its way
  C.whisper = function (g) {
    const I = VR.Intent, p = g.player, ui = g.ui; if (!ui || !ui.hint || !p) return;
    const list = I && I.targets ? I.targets : [];
    let best = null, bd = Infinity;
    for (const q of list) { const d = Math.hypot(q.pos[0] - p.pos[0], q.pos[2] - p.pos[2]); if (d < Math.max(C.NEAR_MIN, q.r || 0) || d > 3000) continue; const s = d * (q.kind === 'landmark' ? 0.5 : 1); if (s < bd) { bd = s; best = q; } }
    if (!best) { ui.hint(tr('g.ctx.nothing'), 2600); return; }
    const d = Math.hypot(best.pos[0] - p.pos[0], best.pos[2] - p.pos[2]);
    const a = Math.atan2(best.pos[0] - p.pos[0], -(best.pos[2] - p.pos[2]));   // 0 = north (−z), clockwise
    const dirs = VR.I18N && VR.I18N.list ? VR.I18N.list('g.ctx.dirs') : [];
    const k = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
    const B = VR.Binds, code = B && B.current ? (B.current.slots('veh') || ['KeyV'])[0] || 'KeyV' : 'KeyV';
    ui.hint(tr('g.ctx.whisper', { name: best.name, d: C.dist(d), dir: dirs[k] || '', key: B ? B.label(code, lang()) : 'V' }), 4200);
  };

  // ---------------------------------------------------------------- the prompt, the ring, the touch button
  let dom = null, last = null, lastText = '', lastIcon = '', acc = 0, ringShown = -1, textRes = null, text = '';
  const st = C.pressState();
  function mount() {
    if (dom || typeof document === 'undefined') return dom;
    const hud = document.getElementById('hud'); if (!hud) return null;
    if (!document.getElementById('ctxstyle')) {
      const s = document.createElement('style'); s.id = 'ctxstyle';
      s.textContent = '#ctxprompt{position:absolute;left:50%;top:calc(50% + 26px);transform:translateX(-50%);padding:4px 12px;border-radius:14px;background:rgba(6,9,20,.42);color:#f4f7ff;font:600 14px/1.25 var(--font,sans-serif);letter-spacing:.02em;text-shadow:0 1px 3px rgba(0,0,0,.7);white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .2s}' +
        '#ctxprompt.on{opacity:1}#ctxprompt b{color:#9affd8;font-weight:700}' +
        '#ctxring{position:absolute;left:50%;top:50%;width:58px;height:58px;margin:-29px 0 0 -29px;border-radius:50%;pointer-events:none;display:none;--p:0;background:conic-gradient(#9affd8 calc(var(--p) * 1turn),rgba(255,255,255,.16) 0);-webkit-mask:radial-gradient(circle,transparent 22px,#000 23px);mask:radial-gradient(circle,transparent 22px,#000 23px)}' +
        '#ctxringl{position:absolute;left:50%;top:calc(50% + 36px);transform:translateX(-50%);color:#d8fff0;font:600 13px var(--font,sans-serif);text-shadow:0 1px 3px #000;display:none;pointer-events:none}';
      document.head.appendChild(s);
    }
    const pr = document.createElement('div'); pr.id = 'ctxprompt'; pr.setAttribute('role', 'status'); hud.appendChild(pr);
    const rg = document.createElement('div'); rg.id = 'ctxring'; hud.appendChild(rg);
    const rl = document.createElement('div'); rl.id = 'ctxringl'; hud.appendChild(rl);
    return (dom = { pr, rg, rl });
  }
  function show(text, res) {
    const d = mount(); if (!d) return;
    if (text === lastText) return;
    lastText = text;
    if (!text) { d.pr.classList.remove('on'); return; }
    const i = text.indexOf('] ');
    d.pr.innerHTML = '';
    const b = document.createElement('b'); b.textContent = text.slice(0, i + 1); d.pr.appendChild(b);
    d.pr.appendChild(document.createTextNode(' ' + text.slice(i + 2)));
    d.pr.classList.add('on');
    void res;
  }
  function ring(k) {
    const d = mount(); if (!d) return;
    const q = Math.round(k * 50) / 50; if (q === ringShown) return;
    ringShown = q;
    d.rg.style.display = q > 0 ? 'block' : 'none'; d.rl.style.display = q > 0 ? 'block' : 'none';
    if (q > 0) { d.rg.style.setProperty('--p', q.toFixed(2)); d.rl.textContent = tr('g.ctx.home'); }
  }
  function touchIcon(res) {
    const icon = res && res.key ? res.icon : '◉';
    if (icon === lastIcon || typeof document === 'undefined') return;
    lastIcon = icon;
    const e = document.querySelector && document.querySelector('.tb-act .ti'); if (e) e.textContent = icon;
  }
  // can the player act now? (no menu, no chat, no cut-scene)
  const free = (g) => g.state === 'play' && !(g.ui && (g.ui.screen || g.ui.typing)) && !(g.director && g.director.active) && !(g.wow && g.wow.active) && !(g.arrival && g.arrival.holds && g.arrival.holds()) && !(g.photoCam && g.photoCam.on) && !g.photo && !(g.player && g.player.dead);
  // the game's frame (game.js, one line): the gather at 10 Hz, the prompt, V's tap and hold
  C.tick = function (g, dt) {
    if (!C.on || !g) return;
    const t0 = now();
    const ok = free(g), I = g.input;
    const travelling = !!(VR.Intent && VR.Intent.current && VR.Intent.current());
    acc += dt;
    const down = ok && !travelling && !!I && I.down('KeyV');
    if (ok && !travelling && (acc >= 0.1 || (down && st.t < 0))) { acc = 0; last = C.resolve(C.gather(g)); }
    if (!ok || travelling) { show('', null); ring(0); st.t = -1; st.fired = false; g.ctxRow = 0; touchIcon(null); const Cs = C.cost; Cs.frames++; Cs.ms += now() - t0; return; }
    const res = last || NONE;
    g.ctxRow = res.row;
    // the prompt's words only when the resolution changed (10 Hz at most): no binding or language lookups in between
    if (res !== textRes) { textRes = res; const B = VR.Binds, code = B && B.current ? (B.current.slots('veh') || ['KeyV'])[0] || 'KeyV' : 'KeyV'; text = C.text(res, code); }
    show(text, res);
    touchIcon(res);
    // V: on foot a tap is the action and a hold the Heimkehr ring; a tool or a vehicle has V to itself
    const ringOk = res.row >= 3;
    const r = C.press(st, down, dt, ringOk);
    ring(r.ring);
    if (r.act === 'home') { ring(0); if (g.goHome) g.goHome(); }
    else if (r.act === 'tap' && ringOk) { last = C.resolve(C.gather(g)); if (last.row >= 3) C.act(g, last); acc = 0.1; }
    const Cs = C.cost, ms = now() - t0; Cs.frames++; Cs.ms += ms; if (ms > Cs.worst) Cs.worst = ms;
  };
  C.current = () => last;
  C.reset = () => { last = null; lastText = ''; lastIcon = ''; textRes = null; text = ''; st.t = -1; st.fired = false; ringShown = -1; if (dom) { dom.pr.classList.remove('on'); dom.rg.style.display = 'none'; dom.rl.style.display = 'none'; } };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

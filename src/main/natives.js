// ============================================================================
// u-worlds3 · VR.Natives — the native species up close (plan docs/superpowers/plans/2026-10-31-u-worlds3.md):
//   · their language: four invented words per species (hello, thanks, friend, farewell — our own, built from each
//     species' syllables; web-searched: no brand or product of these names), learnt one by one as you meet them and
//     shown with their meaning
//   · talking to a native: they turn to you, greet in their own way (greetPose, 2.4 s) and say a word with a line of
//     their culture; the others within 7 m make room (7–9 m) while the talk lasts and a few seconds after
//   · 📷 in a native village: the people within 14 m of the photo camera hold still (20 s at most)
//   · on the plaza they stand round the monument at 4–6 m (not inside it)
//   · a chain of three quests per species — greet three of them · bring a gift from home · join their culture moment —
//     and what they teach: Wellari the tide lantern's recipe, Dunelin the dune building set (Bauhand ★), Glutani the
//     glowing obsidian's recipe, Regoli the Geo Scanner (one given and its recipe), Nivari the frost building set
// The records: meta.natives = {[kind]: {s: 0…3, met: [pid…], w: [word indices known]}} (additive; an odd record reads
// as new). Cost 🟢: nothing per frame but a few comparisons per villager in a native village.
// ============================================================================
(function (VR) {
  'use strict';
  const T = (k, v) => (VR.I18N ? VR.I18N.t(k, v) : k), nm = (id) => (VR.itemName ? VR.itemName(id) : id), spN = (k) => T('g.eco.sp.' + k);
  const N = VR.Natives = {};
  const KINDS = N.KINDS = ['aqua', 'ocker', 'zinn', 'basalt', 'opal'];
  const MEAN = N.MEAN = ['hello', 'thanks', 'friend', 'bye'];
  const W = (a) => a.map((w, i) => ({ w, mean: MEAN[i] }));
  N.LANG = {
    aqua: W(['Lunavel', 'Marithi', 'Nelisa', 'Shavelun']),
    ocker: W(['Duraka', 'Tesulmar', 'Holgek', 'Zeromur']),
    zinn: W(['Glusoleta', 'Kaitiro', 'Vanuret', 'Pelorumi']),
    basalt: W(['Remunel', 'Sovitorn', 'Kathelo', 'Golixis']),
    opal: W(['Nivasen', 'Feltoril', 'Kelmia', 'Suvinha']),
  };
  N.TEACH = {
    aqua: { type: 'recipe', ins: ['glass', 'sea_pickle', 'kelp'], out: 'tide_lantern', n: 2 },
    ocker: { type: 'pieces', pieces: ['b:terracotta', 'b:red_sandstone', 'b:smooth_red_sandstone', 'b:orange_stained_glass', 'b:acacia_planks', 'b:lantern', 'b:amber_crystal_block', 'b:orange_wool'] },
    zinn: { type: 'recipe', ins: ['obsidian', 'magma_block'], out: 'glowing_obsidian', n: 2 },
    basalt: { type: 'gadget', ins: ['iron_ingot', 'copper_ingot', 'azure_crystal_block'], out: 'scanner', n: 1 },
    opal: { type: 'pieces', pieces: ['b:packed_ice', 'b:blue_ice', 'b:snow_block', 'b:light_blue_stained_glass', 'b:spruce_planks', 'b:rose_crystal_block', 'b:lantern', 'b:vx_lamppost_crystal'] },
  };
  // the three quests: greet three natives · bring the gift · join the culture moment
  N.CHAIN = {
    aqua: [{ k: 'greet', n: 3 }, { k: 'give', item: 'glass', n: 6 }, { k: 'cult' }],
    ocker: [{ k: 'greet', n: 3 }, { k: 'give', item: 'oak_log', n: 8 }, { k: 'cult' }],
    zinn: [{ k: 'greet', n: 3 }, { k: 'give', item: 'ice', n: 6 }, { k: 'cult' }],
    basalt: [{ k: 'greet', n: 3 }, { k: 'give', item: 'bread', n: 4 }, { k: 'cult' }],
    opal: [{ k: 'greet', n: 3 }, { k: 'give', item: 'poppy', n: 6 }, { k: 'cult' }],
  };
  N.GREET_S = 2.4; N.HUSH_R = 7; N.HUSH_D = 8; N.PHOTO_R = 14; N.PHOTO_S = 20;

  // ---------------------------------------------------------------- u-worlds4 · a town's day (test/worlds4.js e)
  // In a town (bgen 5's first site: plan.town) the natives keep a day of their own on top of the villages' schedule:
  // by day a share of the adults go to the market (stand at a stall, look, move on), at dusk to the hall (sit on its
  // benches, the rest stand inside), at night two or three lamplighters walk the avenues' lamps. The traders, the
  // mayor (the hall's keeper) and the gardener keep their work. The agents a town wakes are tiered by preset (Very Low
  // 14, Low 20, Balanced 30, High all): the others are at home (the street's draw cap, folkcrowd.js, stays as it is).
  N.MARKET_ACTS = new Set(['market', 'hall', 'lantern']);
  N.CAP = { potato: 14, low: 20, medium: 30, balanced: 30 };
  N.agentCap = (preset, n) => Math.min(n, N.CAP[preset] !== undefined ? N.CAP[preset] : n);
  const KEEP = { trader: 0, mayor: 0, cashier: 0 };   // (the gardeners go to market too: a third of a town's adults are gardeners)
  const u01 = (s, salt) => { let h = Math.imul((s | 0) ^ Math.imul((salt | 0) + 0x632BE5AB, 0x9E3779B1), 0x85EBCA6B); h = Math.imul(h ^ (h >>> 15), 0xC2B2AE35); h ^= h >>> 13; return (h >>> 0) / 4294967296; };
  // who a town wakes when it may wake only cap of its people: the keepers, the lamplighters, the adults, the elders,
  // the children — each group in the order of its seeds (the same people every time)
  N.keepers = function (ags, cap) {
    const rank = (a) => (KEEP[a.role] === 0 ? 0 : a.lamp ? 1 : a.kid ? 4 : a.elder ? 3 : 2);
    return ags.slice().sort((x, y) => (rank(x) - rank(y)) || (u01(x.p.seed, 3) - u01(y.p.seed, 3))).slice(0, cap);
  };
  // the town's lamplighters: the n adults (not keepers) with the smallest numbers of their seeds
  N.lamplighters = function (vil, n) {
    if (vil._lamp && vil._lamp.n === n) return vil._lamp.ids;
    const ad = (vil.people || []).filter(p => p.age === 'adult' && !(p.role in KEEP)).sort((a, b) => u01(a.seed, 9) - u01(b.seed, 9));
    const ids = new Set(ad.slice(0, n).map(p => p.id));
    vil._lamp = { n, ids };
    return ids;
  };
  N.LAMPS_N = (preset) => (preset === 'potato' ? 2 : 3);
  // f-polish4: the lantern in the lamplighter's hand (on: the round's look, a copy with tool 'lantern'; off: the day's look
  // back); the cached models and the gait follow the look. → true when the look changed
  N.lanternLook = (L) => Object.assign({}, L, { tool: 'lantern' });
  N.carryLantern = function (a, on) {
    const p = a && a.p; if (!p || !p.look || a.kid) return false;
    if (on === !!p._dayLook) return false;
    if (on) { p._dayLook = p.look; p.look = N.lanternLook(p.look); } else { p.look = p._dayLook; p._dayLook = null; }
    a.mdl = null; a.fg = null; a.gait = undefined;
    return true;
  };
  // the activity a native of a town wants now, or null (the villages' own schedule then)
  N.routine = function (a, tod, preset) {
    const vil = a.vil, P = vil && vil.plan;
    if (!P || !P.town || a.kid || (a.role in KEEP)) return null;
    const s = a.p.seed;
    if (tod >= 13000 && tod < 23300) return N.lamplighters(vil, N.LAMPS_N(preset)).has(a.p.id) ? 'lantern' : null;
    if (tod >= 10600 && tod < 12800) return u01(s, 41) < (a.elder ? 0.7 : 0.55) ? 'hall' : null;
    if (tod >= 1500 && tod < 10000 && !(tod >= 5600 && tod < 6900)) return !a.elder && u01(s, 42) < 0.32 ? 'market' : null;
    return null;
  };

  // ---------------------------------------------------------------- u-worlds4 · the portrait (test/worlds4.js f)
  // The head's middle over the feet per species (the rig's head at 1.5 m on a person's scale, the Dunelin's neck lifts
  // it, the Regoli are small) and the field of view that frames it: the head fills N.FRAME of the frame's height, the
  // game's own field of view at most, 12° at least. N.cam (game.js's camera chain): talking to a native the eye turns to
  // the head and the view narrows; 📷 a native's head within 5 m near the view's middle is framed the same way.
  N.HEAD_M = 0.44; N.FRAME = 0.26; N.PORTRAIT_R = 5; N.PORTRAIT_A = 0.21;
  const spBody = (k) => (VR.Folk && VR.Folk.SPECIES_BODY && VR.Folk.SPECIES_BODY[k]) || { scale: 1, neck: 0 };
  N.headAt = function (a) {
    const k = a.p && a.p.look && a.p.look.species, b = spBody(k), sc = b.scale * (a.kid ? 0.82 : 1);
    return [a.pos[0], a.pos[1] + (1.5 + (b.neck || 0) * 0.031) * sc, a.pos[2]];
  };
  N.portraitFov = function (d, kind, base) {
    const s = N.HEAD_M * spBody(kind).scale, f = 2 * Math.atan(s / (2 * Math.max(0.3, d) * N.FRAME));
    return Math.max(12 * Math.PI / 180, Math.min(base, f));
  };
  const PS = N.ps = { w: 0, t: 0, head: null, kind: null, a: null };
  // the native the 📷 camera looks at (its head within 5 m and 12° of the view's middle), or null
  N.photoTarget = function (g, s) {
    const V = g.villages; if (!V || !V.agents) return null;
    const fx = -Math.sin(s.yaw) * Math.cos(s.pitch), fy = Math.sin(s.pitch), fz = -Math.cos(s.yaw) * Math.cos(s.pitch);
    let best = null, bc = Math.cos(N.PORTRAIT_A);
    for (const a of V.agents) {
      if (!a.vil || !a.vil.plan || !a.vil.plan.species || a.pose === 'sleep') continue;
      const h = N.headAt(a), dx = h[0] - s.x, dy = h[1] - s.y, dz = h[2] - s.z, d = Math.hypot(dx, dy, dz);
      if (d > N.PORTRAIT_R || d < 0.4) continue;
      const c = (dx * fx + dy * fy + dz * fz) / d;
      if (c > bc) { bc = c; best = a; }
    }
    return best;
  };
  N.cam = function (g, cam, fdt) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now(), dt = fdt > 0 ? Math.min(0.1, fdt) : Math.min(0.1, Math.max(0, (now - (PS.t || now)) / 1000)); PS.t = now;
    const V = g.villages, pc = g.photoCam;
    let a = null;
    if (pc && pc.on && pc.s) a = N.photoTarget(g, pc.s);
    else if (V && V.talking && V.talking.vil && V.talking.vil.plan && V.talking.vil.plan.species) a = V.talking;
    if (a) { PS.a = a; PS.head = N.headAt(a); PS.kind = a.p.look && a.p.look.species; }
    PS.w += ((a ? 1 : 0) - PS.w) * Math.min(1, dt * 3.2);
    if (!a && PS.w < 0.003) { PS.w = 0; PS.a = null; N.last = null; return null; }
    if (!PS.head) return null;
    const H = PS.head, dx = H[0] - cam.x, dy = H[1] - cam.y, dz = H[2] - cam.z, hd = Math.hypot(dx, dz), d = Math.hypot(hd, dy);
    const w = PS.w * PS.w * (3 - 2 * PS.w), fovT = N.portraitFov(d, PS.kind, cam.fov);
    let dyw = Math.atan2(-dx, -dz) - cam.yaw; while (dyw > Math.PI) dyw -= Math.PI * 2; while (dyw < -Math.PI) dyw += Math.PI * 2;
    const fov = cam.fov + (fovT - cam.fov) * w;
    N.last = { fov, d, kind: PS.kind, w, frac: N.HEAD_M * spBody(PS.kind).scale / (2 * d * Math.tan(fov / 2)) };
    return Object.assign({}, cam, { yaw: cam.yaw + dyw * w, pitch: cam.pitch + (Math.atan2(dy, hd) - cam.pitch) * w, fov });
  };

  // ---------------------------------------------------------------- u-worlds4 · the arrival by day
  // The first arrival on a native world at night lands in the morning (the journey took the night): the clock to
  // N.DAWN, a day on when the night was before midnight. Not for a guest, nor with friends in the world (their clock).
  N.DAWN = 1000;
  N.dawn = (tod, first) => (first && (tod >= 12800 || tod < 300) ? N.DAWN : null);
  N.arrive = function (g, kind) {
    const m = g.meta || (g.meta = {}), d = isRecL(m.ecoDawn) ? m.ecoDawn : (m.ecoDawn = {});
    const first = !d[kind]; d[kind] = 1;
    if ((m.guest) || (g.mp && g.mp.remote && g.mp.remote.size > 0) || !g.env) return false;
    const tod = g.env.timeOfDay, t = N.dawn(tod, first); if (t === null) return false;
    if (tod >= 12800) g.env.day = (g.env.day || 0) + 1;
    g.env.setTime(t);
    if (g.ui && g.ui.chatLine) g.ui.chatLine('🌅 ' + T('g.nat.dawn', { sp: spN(kind) }), '#ffd98a');
    return true;
  };
  const isRecL = (r) => !!r && typeof r === 'object' && !Array.isArray(r);

  // ---------------------------------------------------------------- the pure core (test/worlds3.js c)
  const isRec = (r) => !!r && typeof r === 'object' && !Array.isArray(r);
  N.rec = function (meta, kind) {
    if (!meta) return { s: 0, met: [], w: [] };
    const all = isRec(meta.natives) ? meta.natives : (meta.natives = {});
    let r = all[kind];
    if (!isRec(r) || !(r.s >= 0 && r.s <= 3) || !Array.isArray(r.met) || !Array.isArray(r.w)) r = all[kind] = { s: 0, met: [], w: [] };
    return r;
  };
  N.step = (meta, kind) => N.rec(meta, kind).s;
  N.learned = (meta, kind) => N.rec(meta, kind).s >= 3;
  N.known = (meta, kind) => N.rec(meta, kind).w.filter(i => N.LANG[kind] && N.LANG[kind][i]).map(i => N.LANG[kind][i]);
  // a native greeted: counted once each; the third finishes the first quest → {done: 0}
  N.talked = function (meta, kind, pid) {
    const r = N.rec(meta, kind), Q = N.CHAIN[kind]; if (!Q) return null;
    if (r.s !== 0) return {};
    if (pid !== undefined && !r.met.includes(String(pid))) r.met.push(String(pid));
    if (r.met.length >= Q[0].n) { r.s = 1; return { done: 0 }; }
    return { n: r.met.length };
  };
  // the gift handed over (the second quest): true when given
  N.give = function (meta, kind, inv) {
    const r = N.rec(meta, kind), q = N.CHAIN[kind] && N.CHAIN[kind][1];
    if (!q || r.s !== 1 || !inv || inv.count(q.item) < q.n) return false;
    inv.remove(q.item, q.n); if ('changed' in inv) inv.changed = true;
    r.s = 2; return true;
  };
  // the culture moment joined (the third quest) → taught; the gadget given
  N.cult = function (meta, kind, inv) {
    const r = N.rec(meta, kind); if (r.s !== 2) return null;
    r.s = 3;
    const Tt = N.TEACH[kind];
    if (Tt && Tt.type === 'gadget' && inv && inv.add) { inv.add(Tt.out, 1); inv.changed = true; }
    return { taught: kind };
  };
  // the taught recipes (shapeless: exactly their things, one each)
  N.match = function (grid, n, meta) {
    if (!meta || !grid) return null;
    const ids = []; for (let i = 0; i < grid.length; i++) { const s = grid[i]; if (s && s.id) ids.push(s.id); }
    if (!ids.length) return null;
    for (const kind of KINDS) {
      const Tt = N.TEACH[kind]; if (!Tt.ins || !N.learned(meta, kind) || Tt.ins.length !== ids.length) continue;
      const left = ids.slice(); let ok = true;
      for (const w of Tt.ins) { const i = left.indexOf(w); if (i < 0) { ok = false; break; } left.splice(i, 1); }
      if (ok) return { id: Tt.out, n: Tt.n };
    }
    return null;
  };
  // the greeting: the next word not yet known (hello first), else one by h; its line in their culture
  N.greeting = function (meta, kind, h) {
    const L = N.LANG[kind]; if (!L) return null;
    const r = N.rec(meta, kind);
    let i = 0; while (i < L.length && r.w.includes(i)) i++;
    const fresh = i < L.length; if (!fresh) i = ((h >>> 0) % L.length);
    if (fresh) r.w.push(i);
    const word = L[i];
    return { word, fresh, text: T('g.nat.greet', { w: word.w, mean: T('g.nat.mean.' + word.mean), line: T('g.nat.line.' + kind) }) };
  };
  // the greeting's gesture, f: 0 → 1 over GREET_S (adds to the pose; nothing at its ends)
  // (each: [joint, axis, amount × the gesture's swell]; the Wellari flutter, the Glutani open their hands, the Regoli hop)
  const GP = {
    aqua: [['arm_l', 0, 1.1], ['arm_r', 0, 1.1], ['fore_l', 0, 0.9], ['fore_r', 0, 0.9]],       // hands raised before the chest, fluttering like fins
    ocker: [['head', 0, -0.55], ['body', 0, -0.12], ['arm_l', 2, -0.95], ['arm_r', 2, 0.95]],  // the long neck bowed, the arms opened wide
    zinn: [['arm_l', 0, 1], ['arm_r', 0, 1]],                                                  // the hands together, then opened to you
    basalt: [['arm_l', 0, 1.5], ['arm_r', 0, 1.5], ['arm_l', 2, -0.9], ['arm_r', 2, 0.9]],      // two happy hops, the arms up and out
    opal: [['body', 0, -0.35], ['head', 0, -0.2], ['arm_r', 0, 0.9], ['fore_r', 0, 1.2], ['arm_r', 2, -0.25]],   // a hand to the chest, a deep bow
  };
  N.greetPose = function (P, kind, f) {
    const L = GP[kind]; if (!(f > 0 && f < 1) || !P.body || !L) return;
    const w = Math.sin(f * Math.PI), add = (j, i, v) => { if (P[j]) P[j][i] += v; };
    for (const [j, i, v] of L) add(j, i, v * w);
    if (kind === 'aqua') { const q = Math.sin(f * 40) * 0.35 * w; add('fore_l', 2, q); add('fore_r', 2, -q); }
    else if (kind === 'zinn') { const o = f > 0.55 ? (f - 0.55) / 0.45 : 0; add('fore_l', 0, 1.1 * w * (1 - o)); add('fore_r', 0, 1.1 * w * (1 - o)); add('arm_l', 2, -0.6 * o * w); add('arm_r', 2, 0.6 * o * w); }
    else if (kind === 'basalt') add('hips', 4, Math.abs(Math.sin(f * Math.PI * 4)) * 2.4 * w);
  };
  // where someone near the player waits during a talk: on the line from the player through them, HUSH_D away
  N.hushSpot = function (pos, pl) {
    let dx = pos[0] - pl[0], dz = pos[2] - pl[2]; const d = Math.hypot(dx, dz);
    if (d < 0.05) { dx = 1; dz = 0; } else { dx /= d; dz /= d; }
    return [pl[0] + dx * N.HUSH_D, pos[1], pl[2] + dz * N.HUSH_D];
  };
  // someone inside the monument (a stuck villager is put back on its goal — the plaza's middle — in the monument's
  // solid shell; the Nivari's vault has an open way under it): out on the ring, 4.5 m from the middle → [x, z] or null
  N.offMonument = function (pos, pz, kind) {
    if (kind === 'opal' || !pz) return null;
    const cx = pz.x + 0.5, cz = pz.z + 0.5, dx = pos[0] - cx, dz = pos[2] - cz, d = Math.hypot(dx, dz);
    if (d >= 2.4 || Math.abs(pos[1] - pz.y) > 3) return null;
    const an = d > 0.05 ? Math.atan2(dz, dx) : 0.7;
    return [cx + Math.cos(an) * 4.5, cz + Math.sin(an) * 4.5];
  };
  // the quest's text for the talk panel
  N.status = function (meta, kind) {
    const r = N.rec(meta, kind), sp = spN(kind), Q = N.CHAIN[kind];
    const words = N.known(meta, kind).map(o => o.w + ' (' + T('g.nat.mean.' + o.mean) + ')').join(' · ');
    const wl = words ? '\n' + T('g.nat.words', { list: words }) : '';
    if (r.s === 0) return T('g.nat.q0', { sp, n: r.met.length, of: Q[0].n }) + wl;
    if (r.s === 1) return T('g.nat.q1', { sp, n: Q[1].n, item: nm(Q[1].item), why: T('g.nat.why.' + kind) }) + wl;
    if (r.s === 2) return T('g.nat.q2', { sp, what: T('g.eco.cult.' + kind) }) + wl;
    return T('g.nat.q3', { sp, what: N.teachText(kind) }) + wl;
  };
  N.teachText = function (kind) {
    const Tt = N.TEACH[kind];
    if (Tt.type === 'pieces') return T('g.nat.teach.pieces', { name: T('g.nat.set.' + kind), n: Tt.pieces.length });
    if (Tt.type === 'gadget') return T('g.nat.teach.gadget', { item: nm(Tt.out), ins: Tt.ins.map(nm).join(' + ') });
    return T('g.nat.teach.recipe', { ins: Tt.ins.map(nm).join(' + '), n: Tt.n, out: nm(Tt.out) });
  };

  // ---------------------------------------------------------------- the game's side
  const kindOfA = (a) => (a && a.p && a.p.look && a.p.look.species) || null;
  const H = (s) => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  N.taught = function (g, kind) {
    const Tt = N.TEACH[kind];
    if (Tt.type === 'pieces' && VR.Favs && VR.Favs.addMany) VR.Favs.addMany(Tt.pieces.filter(id => VR.R && VR.R.byName[id.slice(2)]));
    if (g && g.ui && g.ui.toast) g.ui.toast('🗝 ' + T('g.nat.learnt', { sp: spN(kind) }), N.teachText(kind));
    if (g && g.player && g.player.inv) g.player.inv.changed = true;
  };
  // the culture moment's join counts as the third quest
  const WL = VR.WorldLife;
  if (WL && WL.cultJoin && !WL.cultJoin.__nat) {
    const cj = WL.cultJoin;
    WL.cultJoin = function (g, vil) {
      const r = cj.apply(this, arguments);
      const kind = vil && vil.plan && vil.plan.species;
      if (r && kind && g && N.cult(g.meta || (g.meta = {}), kind, g.player && g.player.inv)) N.taught(g, kind);
      return r;
    };
    WL.cultJoin.__nat = true;
  }
  // the greeting's gesture over the pose (villages.js pose() → WL.idle, its last argument the villager)
  if (WL && WL.idle && !WL.idle.__nat) {
    const id0 = WL.idle;
    WL.idle = function (P, kind, t, wa, state, a) { id0.apply(this, arguments); if (a && a.greetT > 0) N.greetPose(P, kind, 1 - a.greetT / N.GREET_S); };
    WL.idle.__nat = true;
  }
  // the taught recipes at the crafting grid
  const C = VR.Crafting;
  if (C && C.match && !C.match.__nat) {
    const m0 = C.match;
    C.match = function (grid, n) { const g = VR.game, r = g && g.meta && g.meta.natives ? N.match(grid, n, g.meta) : null; return r || m0.apply(this, arguments); };
    C.match.__nat = true;
  }
  const Vs = VR.Villages;
  if (Vs && !Vs.prototype.__nat) {
    const VP = Vs.prototype; VP.__nat = true;
    const ua = VP.updateAgent;
    VP.updateAgent = function (a, dt, tod) {
      if (a.greetT > 0) a.greetT -= dt;
      const vil = a.vil, kind = vil && vil.plan && vil.plan.species;
      if (!kind) return ua.call(this, a, dt, tod);
      const g = this.g, pl = g.player.pos;
      const still = () => { a.t += dt; if (a.bubble) { a.bubble.t -= dt; if (a.bubble.t <= 0) a.bubble = null; } a.vel[0] = 0; a.vel[2] = 0; a.walkAmt += (0 - a.walkAmt) * Math.min(1, dt * 6); };
      // the one you talk to: turned to you, standing
      if (this.talking === a) {
        still();
        let dy = Math.atan2(-(pl[0] - a.pos[0]), -(pl[2] - a.pos[2])) - a.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
        a.yaw += dy * Math.min(1, dt * 6); a.lookAt = pl;
        return;
      }
      // 📷: the people near the camera hold still for a picture
      const pc = g.photoCam;
      if (pc && pc.on && pc.s) {
        if ((a.photoT = (a.photoT || 0) + dt) < N.PHOTO_S && (a.pos[0] - pc.s.x) ** 2 + (a.pos[2] - pc.s.z) ** 2 < N.PHOTO_R * N.PHOTO_R) { still(); return; }
      } else a.photoT = 0;
      // making room during a talk
      if (a.hush) {
        if (this.talking) a.hush.t = Math.max(a.hush.t, 4);
        a.hush.t -= dt;
        if (a.hush.t > 0) {
          a.t += dt; if (a.bubble) { a.bubble.t -= dt; if (a.bubble.t <= 0) a.bubble = null; }
          a.steer = [a.hush.spot[0], a.hush.spot[2]]; a.path = null;
          a.lookAt = this.talking ? this.talking.pos : null;
          this.move(a, dt); return;
        }
        a.hush = null; a.lookAt = null;
      }
      // the plaza's ring: round the monument, not in it (4–6 m from the middle)
      const act = a.act, pz = vil.plan.plaza;
      { const o = N.offMonument(a.pos, pz, kind); if (o) { a.pos[0] = o[0]; a.pos[2] = o[1]; a.pos[1] = pz.y; a.path = null; } }
      if (act && act.type === 'plaza' && act.spot && act.spot.length === 3 && pz) {
        const dx = act.spot[0] + 0.5 - (pz.x + 0.5), dz = act.spot[2] + 0.5 - (pz.z + 0.5), d = Math.hypot(dx, dz);
        if (d < 3.9) { const an = d > 0.1 ? Math.atan2(dz, dx) : (H(a.p.id) % 628) / 100, r = 4 + (H(a.p.id + 'r') % 20) / 10; act.spot[0] = Math.floor(pz.x + 0.5 + Math.cos(an) * r); act.spot[2] = Math.floor(pz.z + 0.5 + Math.sin(an) * r); }
      }
      return ua.call(this, a, dt, tod);
    };
    const ot = VP.openTalk;
    VP.openTalk = function (a) {
      const r = ot.apply(this, arguments);
      const kind = kindOfA(a); if (!kind || !N.LANG[kind]) return r;
      const g = this.g, meta = g.meta || (g.meta = {}), pl = g.player.pos;
      const gr = N.greeting(meta, kind, H(a.p.id + ':' + ((this.time || 0) | 0)));
      if (gr) { this.talkText(gr.text); a.say(gr.word.w + '!', 2.5); }
      a.greetT = N.GREET_S; a.path = null;
      const ev = N.talked(meta, kind, a.p.id);
      if (ev && ev.done === 0 && g.ui && g.ui.chatLine) g.ui.chatLine('🗝 ' + T('g.nat.done0', { sp: spN(kind), item: nm(N.CHAIN[kind][1].item), n: N.CHAIN[kind][1].n }), '#ffd98a');
      // the others make room
      for (const o of a.vil.agents) {
        if (o === a || o.pose === 'sleep' || o.inBoat) continue;
        if ((o.pos[0] - pl[0]) ** 2 + (o.pos[2] - pl[2]) ** 2 < N.HUSH_R * N.HUSH_R) o.hush = { t: 6, spot: N.hushSpot(o.pos, pl) };
      }
      return r;
    };
    // u-worlds4 · the town's day: the schedule, the three activities, the agents tiered
    const preset = (g) => (g && g.settings && g.settings.preset) || 'high';
    const sch = VP.schedule;
    VP.schedule = function (a, tod) {
      const r = a.vil && a.vil.plan && a.vil.plan.town ? N.routine(a, tod, preset(this.g)) : null;
      return r || sch.call(this, a, tod);
    };
    const ra = VP.runAct;
    VP.runAct = function (a, dt, tod) {
      const act = a.act;
      if (!act || !N.MARKET_ACTS.has(act.type)) return ra.call(this, a, dt, tod);
      act.t += dt;
      const P = a.vil.plan, H2 = (k) => H(a.p.id + ':' + k + ':' + ((act.n || 0)));
      if (act.type === 'market') {
        const M = P.market; if (!M || !M.spots.length) return;
        if (!act.spot) { const sp = M.spots[H2(1) % M.spots.length]; act.spot = [sp[0] + (H2(2) % 5) - 2, sp[1], sp[2] + Math.sign(P.z - sp[2]) * (H2(9) % 2)]; act.look = sp; }
        if (this.goTo(a, act.spot[0], act.spot[1], act.spot[2], 1.2)) { a.lookAt = [act.look[0] + 0.5, act.look[1] + 1, act.look[2] + 0.5 + Math.sign(act.look[2] - P.z) * 2]; if (act.t > 18 + H2(3) % 16) { act.spot = null; act.t = 0; act.n = (act.n || 0) + 1; } }
        return;
      }
      if (act.type === 'hall') {
        const Hl = P.hall; if (!Hl) return;
        if (a.pose === 'sit') { a.lookAt = [Hl.speaker[0] + 0.5, Hl.speaker[1] + 1, Hl.speaker[2] + 0.5]; return; }
        if (!act.seat && !act.stand) {
          const own = a.vil._hallSeat || (a.vil._hallSeat = new Map()), n = Hl.seats.length;
          for (let k = 0, i = H2(4) % n; k < n; k++, i = (i + 1) % n) { const o = own.get(i); if (!o || o === a || !o.act || o.act.type !== 'hall') { own.set(i, a); act.seat = Hl.seats[i]; break; } }
          if (!act.seat) act.stand = [Hl.inside[0] + (H2(5) % 7) - 3, Hl.inside[1], Hl.inside[2] + (H2(6) % 3) - 1];
        }
        const tg = act.seat || act.stand;
        if (this.goTo(a, tg[0], tg[1], tg[2], act.seat ? 0.8 : 1.4)) { if (act.seat) this.sit(a, act.seat); else a.lookAt = [Hl.speaker[0] + 0.5, Hl.speaker[1] + 1, Hl.speaker[2] + 0.5]; }
        return;
      }
      // the lamplighter: lamp after lamp along the avenues, a pause at each
      const L = P.lamps; if (!L || !L.length) return;
      if (act.i === undefined) act.i = H2(7) % L.length;
      const lp = L[act.i];
      if (this.goTo(a, lp[0] + 1, lp[1] - 2, lp[2], 1.4)) { a.lookAt = [lp[0] + 0.5, lp[1] - 0.5, lp[2] + 0.5]; act.rest = (act.rest || 0) + dt; if (act.rest > 3) { act.rest = 0; act.i = (act.i + 1 + (H2(8) % 3)) % L.length; act.n = (act.n || 0) + 1; } }
      else if (act.t > 60) { act.t = 0; act.i = (act.i + 1) % L.length; }
    };
    // f-polish4 · the lamplighter's lantern: while the lamp round is the act, the look holds a lantern (folkmodel.js
    // handLantern); the day's own thing back with the morning (the models are keyed by the look: two looks a lamplighter)
    const ra4 = VP.runAct;
    VP.runAct = function (a, dt, tod) { N.carryLantern(a, !!(a.act && a.act.type === 'lantern')); return ra4.call(this, a, dt, tod); };
    // (a preset changed while in a town: it wakes again with the new tier)
    const uv = VP.updateVillage;
    VP.updateVillage = function (vil, dt, tod) {
      if (vil.plan && vil.plan.town && vil._capP !== preset(this.g) && !this.talking) { this.deactivate(vil); this.activate(vil, tod); }
      return uv.apply(this, arguments);
    };
    const av = VP.activate;
    VP.activate = function (vil, tod) {
      const r = av.apply(this, arguments);
      if (vil.plan && vil.plan.town) {
        vil._capP = preset(this.g);
        const cap = N.agentCap(preset(this.g), vil.agents.length);
        const lamps = N.lamplighters(vil, N.LAMPS_N(preset(this.g)));
        for (const a of vil.agents) a.lamp = lamps.has(a.p.id);
        if (cap < vil.agents.length) {
          const keep = new Set(N.keepers(vil.agents, cap));
          for (const a of vil.agents) if (!keep.has(a)) { const i = this.agents.indexOf(a); if (i >= 0) this.agents.splice(i, 1); }
          vil.agents = vil.agents.filter(a => keep.has(a));
        }
      }
      return r;
    };
    const to = VP.talkOptions;
    VP.talkOptions = function (a) {
      const r = to.apply(this, arguments);
      const kind = kindOfA(a); if (!kind || !N.LANG[kind] || typeof document === 'undefined') return r;
      const box = document.getElementById('tk_opts'); if (!box) return r;
      const g = this.g, meta = g.meta || (g.meta = {});
      const mk = (label, fn) => { const b = document.createElement('button'); b.className = 'btn small'; b.textContent = label; b.onclick = () => { this.chirp(a); fn(); }; return b; };
      box.insertBefore(mk(T('g.nat.opt', { sp: spN(kind) }), () => {
        this.talkText(N.status(meta, kind));
        if (N.step(meta, kind) === 1 && !box.querySelector('[data-natgive]')) {
          const q = N.CHAIN[kind][1];
          const b = mk(T('g.nat.give', { n: q.n, item: nm(q.item) }), () => {
            const inv = g.player && g.player.inv;
            if (N.give(meta, kind, inv)) { this.talkText(T('g.nat.thanks', { w: N.LANG[kind][1].w, mean: T('g.nat.mean.thanks'), what: T('g.eco.cult.' + kind) })); a.greetT = N.GREET_S; b.remove(); if (g.ui.updateHUD) g.ui.updateHUD(true); }
            else this.talkText(T('g.nat.short', { have: inv ? inv.count(q.item) : 0, n: q.n }));
          });
          b.setAttribute('data-natgive', '1'); box.insertBefore(b, box.children[1] || null);
        }
      }), box.firstChild);
      return r;
    };
  }
})(VR);

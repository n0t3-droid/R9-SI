// ============================================================================
// u-gossip · VR.CityLife — Palmenhafen alive (review v0.56 R57-02: „Palmenhafen ist leer": 80 s by the city's plaza, nobody
// there). The home city (the Heartland's Nova Haven plan, plan.nova) has eleven villas with one bed each — eleven people
// spread over 200 blocks. This adds its townsfolk, appended to the city's roster after everyone else (nobody's name, job or
// clothes change), living with the villas' families:
//   · vendors at the arrival plaza (a spot each on its ring, all day, a call now and then when you stand near — at most
//     one every 40 s), home at dusk
//   · strollers on the roads round the plaza and the city's middle (never the far crescents: where people are seen),
//     lunch on the plaza, a share of night owls who walk the lit streets until late, the rest at home (inside the villas)
//   · a few children who play by the plaza (the villages' own kids' games)
// Counts by the life tier (VR.LifeKit.tierOf): Very Low 6 · Low 10 · Balanced 16 · High 22 · Ultra 26 — the street's draw
// cap (folkcrowd.js: Very Low 8 drawn) bounds what is drawn; the far ones update at the far rate (villages.js).
// Pure part node-tested (test/gossip.js): CL.count, CL.plan, CL.schedule. Switch: settings.citylife (on).
// ============================================================================
(function (VR) {
  'use strict';
  const CL = VR.CityLife = VR.CityLife || {};
  CL.COUNT = [6, 10, 16, 22, 26];
  CL.count = (tier) => CL.COUNT[Math.max(0, Math.min(CL.COUNT.length - 1, tier | 0))];
  const h32 = (a, b) => { let x = (Math.imul(a | 0, 0x2c1b3c6d) ^ Math.imul((b | 0) + 0x9e37, 0x297a2d39)) >>> 0; x = Math.imul(x ^ (x >>> 15), 0x85ebca6b) >>> 0; x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0; return (x ^ (x >>> 16)) >>> 0; };
  // the home city: the full plan carries plan.nova; the worker's summary (VG.summary) does not — then the Heartland's city
  // spot (VR.Heart.CITY) tells it
  CL.isCity = (plan) => { if (!plan || plan.style !== 'tech' || !plan.homes || !plan.homes.length) return false; if (plan.nova) return true; const C = VR.Heart && VR.Heart.CITY; return !!(C && Math.hypot(plan.x - C.x, plan.z - C.z) < 4); };
  // the townsfolk of a city plan: [{k, kind: 'vendor' | 'stroll' | 'owl' | 'kid', fam}] — fixed by the plan's seed
  CL.plan = function (plan, nFams, tier) {
    const n = CL.count(tier), out = [];
    const vendors = tier <= 0 ? 1 : tier <= 2 ? 2 : 3, kids = tier <= 0 ? 1 : Math.max(2, n >> 3);
    for (let k = 0; k < n; k++) {
      const hs = h32(plan.seed | 0, 500 + k);
      const kind = k < vendors ? 'vendor' : k < vendors + kids ? 'kid' : hs % 3 === 0 ? 'owl' : 'stroll';
      out.push({ k, kind, fam: nFams ? hs % nFams : 0, seed: hs });
    }
    return out;
  };
  // what a townsperson does at a time of day (null: the villages' own schedule)
  CL.schedule = function (kind, seed, tod) {
    const night = tod >= 13000 || tod < 600;
    if (kind === 'kid') return night ? 'home' : null;
    if (kind === 'vendor') return tod >= 1000 && tod < 11400 ? 'vend' : 'home';
    if (tod >= 5600 && tod < 6900) return 'plaza';
    if (night) return kind === 'owl' && (tod >= 13000 && tod < 16500 + (seed % 3000)) ? 'stroll' : 'home';
    if (tod < 1500 + (seed % 900)) return 'home';
    return (seed >> 3) % 4 === 0 ? 'plaza' : 'stroll';
  };
  CL.KEYS = ['g.cl.call.0', 'g.cl.call.1', 'g.cl.call.2', 'g.cl.call.3', 'g.cl.night.0', 'g.cl.night.1'];

  // ================================================================ the game side
  const Vs = VR.Villages;
  if (!Vs || typeof document === 'undefined') return;
  const P = Vs.prototype, Folk = VR.Folk;
  const T = (k, v) => (VR.I18N ? VR.I18N.t(k, v) : k);
  const on = (g) => !(g && g.settings && g.settings.citylife === false);
  CL.cost = { people: 0 };
  // the townsfolk join the roster when the city's plan arrives
  const baseAdd = P.addVillage;
  P.addVillage = function (plan) {
    const had = this.known.has(plan.id);
    const out = baseAdd.apply(this, arguments);
    try { if (!had && on(this.g) && (this.g.dim || 'overworld') === 'overworld' && CL.isCity(plan)) CL.populate(this, this.known.get(plan.id)); } catch (e) { if (!CL.warned) { CL.warned = true; console.warn('citylife', e); } }
    return out;
  };
  CL.populate = function (V, vil) {
    if (!vil || vil.town || !vil.fams || !vil.fams.length || !Folk) return;
    const g = V.g, tier = VR.LifeKit && VR.LifeKit.tierOf ? VR.LifeKit.tierOf(g.settings) : 2, P0 = vil.plan;
    const used = new Set(vil.people.map(q => q.name));
    const nameFor = (seed, kid) => { const L = kid ? Folk.KIDS : Folk.FIRST; for (let j = 0; j < 30; j++) { const n = L[h32(seed, j) % L.length]; if (!used.has(n)) { used.add(n); return n; } } return L[seed % L.length]; };
    vil.town = [];
    for (const q of CL.plan(P0, vil.fams.length, tier)) {
      const f = vil.fams[q.fam], home = vil.homes[f.home], kid = q.kind === 'kid';
      const m = { id: P0.id + ':t' + q.k, fam: q.fam, home: f.home, idx: 10 + q.k, age: kid ? 'child' : 'adult', role: kid ? 'child' : q.kind === 'vendor' ? 'trader' : 'crafter', seed: q.seed, newHome: false, town: q.kind,
        years: kid ? 6 + q.seed % 7 : 20 + q.seed % 45, name: nameFor(q.seed, kid), bed: (home && home.beds[0]) || null,
        trait: Folk.TRAITS[h32(q.seed, 1) % Folk.TRAITS.length], likes: Folk.LIKES[h32(q.seed, 2) % Folk.LIKES.length], look: null };
      m.look = Folk.look(m.seed, kid ? 'child' : m.role, kid ? 'child' : 'adult', kid && f.members[0] ? f.members[0].look : null, P0.style);
      f.members.push(m); vil.people.push(m); vil.town.push(m);
    }
    if (Folk.unlike) { try { Folk.unlike(vil.people, 3); } catch (e) { /* their dress */ } }
    // where the townsfolk walk: the road cells near the plaza and the city's middle
    const pz = P0.plaza, c = P0.center || [P0.x, P0.y, P0.z], pts = [];
    for (const rd of P0.roads || []) for (const q of rd) if (Math.hypot(q[0] - pz.x, q[2] - pz.z) < 46 || Math.hypot(q[0] - c[0], q[2] - c[2]) < 40) pts.push(q);
    vil.townPts = pts;
    CL.cost.people = vil.town.length;
  };
  // where a townsperson is when you arrive: out on the streets near the plaza (the vendors at their spots), the night
  // owls too after dark — the others at home
  const baseSpawn = P.spawnPos;
  P.spawnPos = function (vil, person, tod) {
    const k = person && person.town, L = vil.townPts;
    if (k && L && L.length) {
      const s = CL.schedule(k, person.seed, tod) || 'stroll';
      if (s === 'stroll' || s === 'plaza' || s === 'vend') { const q = L[h32(person.seed, 9) % L.length]; return [q[0] + 0.5, q[1], q[2] + 0.5]; }
    }
    return baseSpawn.call(this, vil, person, tod);
  };
  const baseActivate = P.activate;
  P.activate = function (vil, tod) {
    const out = baseActivate.apply(this, arguments);
    if (vil.town) for (const a of vil.agents) if (a.p.town && a.pose === 'sleep' && CL.schedule(a.p.town, a.p.seed, tod) !== 'home') { a.act = null; a.pose = 'stand'; }
    return out;
  };
  const baseSched = P.schedule;
  P.schedule = function (a, tod) {
    const k = a.p && a.p.town;
    if (k) { const s = CL.schedule(k, a.p.seed, tod); if (s) return s; }
    return baseSched.call(this, a, tod);
  };
  // a townsperson's walk: a point near the plaza or the middle
  const baseRoute = P.pickRoute;
  P.pickRoute = function (a, act, H2) {
    const r = baseRoute.call(this, a, act, H2);
    const L = a.p && a.p.town && a.vil.townPts;
    if (L && L.length) { const q = L[(h32(a.p.seed, (this.time * 0.37) | 0) + (H2 ? H2(13) : 0)) % L.length]; act.spot = q.slice(); }
    return r;
  };
  const baseRun = P.runAct;
  P.runAct = function (a, dt, tod) {
    const act = a.act;
    if (act && act.type === 'vend') {
      const pz = a.vil.plan.plaza;
      if (!act.spot) { const n = Math.max(1, (a.vil.town || []).filter(q => q.town === 'vendor').length), i = a.p.idx - 10, an = (i + 0.5) / n * Math.PI * 1.4 - Math.PI * 0.2, r = 7.5; act.spot = [Math.floor(pz.x + Math.cos(an) * r), pz.y, Math.floor(pz.z - Math.sin(an) * r)]; }
      if (this.goTo(a, act.spot[0], act.spot[1], act.spot[2], 1.2)) {
        a.pose = 'stand'; a.lookAt = [pz.x + 0.5, pz.y + 1.2, pz.z + 0.5];
        const g = this.g, p = g.player.pos;
        if (!a.bubble && this.near(a, 12) && this.time - (CL.callT || -1e9) > 40) { CL.callT = this.time; a.say(T('g.cl.call.' + (h32(a.p.seed, this.time | 0) % 4)), 3.5); a.lookAt = [p[0], p[1] + 1.4, p[2]]; }
      }
      return;
    }
    // a night owl's quiet line, rarely
    if (act && act.type === 'stroll' && a.p && a.p.town === 'owl' && (tod >= 13000 || tod < 600) && !a.bubble && this.near(a, 8) && this.time - (CL.owlT || -1e9) > 60) { CL.owlT = this.time; a.say(T('g.cl.night.' + (a.p.seed & 1)), 3.5); }
    return baseRun.call(this, a, dt, tod);
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

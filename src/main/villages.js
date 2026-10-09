// ============================================================================
// Villages (game thread): every generated village becomes a living community.
//  · rosters of families (partners, kids, grandparents) from the village plan
//  · daily rhythm: wake → breakfast together → work → lunch at the plaza →
//    work → evening together → home → sleep (rangers keep watch)
//  · farmers harvest & replant, bakers deliver bread, smiths forge, scholars
//    read, builders raise brand-new homes (a new family moves in!) and repair
//    anything knocked down, rangers shoot monsters, kids play tag
//  · conversations with real village facts, hugs & hearts, speech bubbles
//  · talk to anyone: chat, village lore + map waypoints, help requests, trade,
//    gifts and a reputation that makes the whole village love you
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R, F = VR.F, PH = VR.PHYS, Folk = VR.Folk;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const H = Folk.hash;
  // the player's language (lang_de.js / lang_en.js): T a text, TL a list, FS a villager's line (g.folk.<key>)
  const T = (k, v, fb) => (VR.I18N ? VR.I18N.t(k, v, fb) : (fb !== undefined ? fb : k)), TL = (k) => (VR.I18N && VR.I18N.list ? VR.I18N.list(k) : []);
  const FS = (key, h, vars) => Folk.say(key, h, vars), pickL = (key, k) => { const L = TL(key); return L.length ? L[(k >>> 0) % L.length] : ''; };
  const WORK_ROLE = { bakery: 'baker', smithy: 'smith', library: 'scholar', clinic: 'healer', hall: 'mayor', workshop: 'builder', garden: 'gardener', base: 'operator', market: 'cashier', barn: 'farmer', school: 'teacher', factory: 'worker', office: 'office', cafe: 'barista' };
  // how many keepers a workplace employs
  const WORK_N = { factory: 4, office: 4, school: 2, market: 1 };
  const TICK = () => 0;
  void TICK;

  // ---------------------------------------------------------------- roster
  function makeRoster(vil) {
    const P = vil.plan, st = vil.st;
    const fams = [];
    const usedNames = new Set(), usedSur = new Set();
    const nameFor = (seed, kid) => { const list = kid ? Folk.KIDS : Folk.FIRST; for (let k = 0; k < 40; k++) { const n = list[H(seed, k, 3) % list.length]; if (!usedNames.has(n)) { usedNames.add(n); return n; } } return list[seed % list.length]; };
    const surFor = (seed) => { for (let k = 0; k < 40; k++) { const n = Folk.SUR[H(seed, k, 5) % Folk.SUR.length]; if (!usedSur.has(n)) { usedSur.add(n); return n; } } return Folk.SUR[seed % Folk.SUR.length]; };
    const homes = P.homes.slice();
    for (const li of st.built || []) if (P.lots[li]) homes.push(Object.assign({}, P.lots[li], { newHome: true }));
    // houses the player built (a roof, a door and a bed near the village): a family moved in
    for (const ch of st.custom || []) homes.push(Object.assign({}, ch, { newHome: true, custom: true }));
    const kindsOf = homes.map((home, hi) => {
      const fs = H(P.seed, hi, 101);
      const nb = Math.max(1, home.beds.length);
      const kinds = [];
      if (nb === 1) kinds.push('adult');
      else if (nb === 2 && fs % 5 === 0) kinds.push('elder', 'elder');
      else { kinds.push('adult', 'adult'); for (let k = 2; k < nb; k++) kinds.push(k === nb - 1 && nb >= 4 && fs % 3 === 0 ? 'elder' : 'child'); }
      if (home.newHome) { kinds.length = 0; kinds.push('adult', 'adult'); }
      if (home.custom) { kinds.length = 0; kinds.push('adult'); if (nb >= 2) kinds.push('adult'); for (let k = 2; k < Math.min(nb, 5); k++) kinds.push('child'); }
      return kinds;
    });
    // a town that carries its villager budget (vgen 9: plan.folkCap — one villager per 9 blocks of walkable street and
    // plaza plus 2 per home): the biggest families shrink, the youngest first, until the town's people fit it
    Folk.fitBudget(kindsOf, P.folkCap && P.folkCap.max);
    homes.forEach((home, hi) => {
      const fs = H(P.seed, hi, 101);
      const fam = { id: hi, surname: surFor(fs), home: hi, members: [], newHome: !!home.newHome };
      const kinds = kindsOf[hi];
      let parentLook = null;
      kinds.forEach((age, k) => {
        const seed = H(fs, k, 7);
        const role = age === 'child' ? 'child' : age === 'elder' ? 'elder' : null;
        const person = {
          id: P.id + ':' + hi + ':' + k, fam: fams.length, home: hi, idx: k, age, role, seed, newHome: !!home.newHome,
          years: age === 'child' ? 5 + H(seed, 4, 9) % 8 : age === 'elder' ? 66 + H(seed, 4, 9) % 18 : 22 + H(seed, 4, 9) % 38,
          name: nameFor(seed, age === 'child'), bed: home.beds[k] || home.beds[0] || null,
          trait: Folk.TRAITS[H(seed, 1, 9) % Folk.TRAITS.length], likes: Folk.LIKES[H(seed, 2, 9) % Folk.LIKES.length],
          look: null,
        };
        fam.members.push(person);
        if (age === 'adult' && !parentLook) parentLook = Folk.look(seed, 'farmer', 'adult');
      });
      fam.members.forEach((m) => { if (m.age === 'child') m.parentLook = parentLook; });
      fams.push(fam);
    });
    // jobs: every workplace gets a keeper, then farms, rangers, builders, pilots
    const adults = [];
    for (const f of fams) for (const m of f.members) if (m.age === 'adult') adults.push(m);
    // newcomers take the jobs that are left, so nobody else changes job (or clothes) when a family moves in
    adults.sort((a, b) => ((a.newHome ? 1 : 0) - (b.newHome ? 1 : 0)) || (a.idx - b.idx) || (a.fam - b.fam));
    let ai = 0;
    const assign = (role) => { while (ai < adults.length && adults[ai].role) ai++; if (ai < adults.length) { adults[ai].role = role; ai++; return true; } return false; };
    for (const w of P.work) { const r = WORK_ROLE[w.kind]; if (r) for (let k = 0; k < (WORK_N[w.kind] || 1); k++) assign(r); if (w.kind === 'base') assign('operator'); if (w.kind === 'market') assign('clerk'); }
    const hasPlots = P.lots.length > (st.built || []).length || (st.repairs && st.repairs.length);
    if (P.lots.length) { assign('builder'); if (adults.length > 12) assign('builder'); }
    assign('ranger');
    if (P.pad) assign('pilot');
    for (let k = 0; k < P.farms.length * 2; k++) assign('farmer');
    if (adults.length > 8) assign('ranger');
    const spare = P.farms.length ? ['farmer', 'crafter', 'gardener'] : ['crafter', 'gardener', 'farmer'];
    let si = 0;
    for (const a of adults) if (!a.role) { a.role = spare[(si + (H(a.seed, 3, 3) & 1)) % spare.length]; si++; }
    void hasPlots;
    for (const f of fams) for (const m of f.members) m.look = Folk.look(m.seed, m.role, m.age === 'adult' ? 'adult' : m.age, m.parentLook, P.style);
    // workplace lookup per role
    vil.workOf = {};
    for (const w of P.work) { const r = WORK_ROLE[w.kind]; if (r) (vil.workOf[r] || (vil.workOf[r] = [])).push(w); if (w.kind === 'market') (vil.workOf.clerk || (vil.workOf.clerk = [])).push(w); }
    vil.fams = fams;
    vil.people = [];
    for (const f of fams) for (const m of f.members) vil.people.push(m);
    vil.homes = homes;
  }

  // ---------------------------------------------------------------- villager agent
  class Villager {
    constructor(vil, person, pos) {
      this.vil = vil; this.p = person;
      this.kid = person.age === 'child'; this.elder = person.age === 'elder';
      this.pos = pos.slice(); this.vel = [0, 0, 0];
      this.yaw = (H(person.seed, 11, 1) % 628) / 100; this.headYaw = 0; this.headPitch = 0;
      this.w = this.kid ? 0.22 : 0.3; this.h = this.kid ? 1.05 : 1.75;
      this.onGround = false;
      this.act = null; this.path = null; this.pi = 0; this.goal = null; this.pathWait = 0; this.stuckT = 0; this.lastProg = 0; this.fails = 0;
      this.pose = 'stand'; this.walk = 0; this.walkAmt = 0; this.t = Math.random() * 10;
      this.bubble = null; this.talkCool = 2 + Math.random() * 6; this.thinkT = Math.random() * 1.5;
      this.lookAt = null; this.hurt = 0; this.carry = 0; this.cycles = 0;
      this.speed = this.kid ? 2.9 : this.elder ? 1.5 : 2.2;
    }
    get name() { return this.p.name + ' ' + this.vil.fams[this.p.fam].surname; }
    get role() { return this.p.role; }
    hitbox() { return [this.pos[0] - this.w, this.pos[1], this.pos[2] - this.w, this.pos[0] + this.w, this.pos[1] + this.h, this.pos[2] + this.w]; }
    say(text, dur) { this.bubble = { text, t: dur || 3.5 }; this.talkAnim = Math.min(2.4, 0.5 + String(text).length * 0.055); this.vil.mgr.chirp(this); }
    onUse() { this.vil.mgr.openTalk(this); }
    onHit(from) { this.vil.mgr.onHit(this, from); }
  }

  // ---------------------------------------------------------------- manager
  class Villages {
    constructor(game, meta) {
      this.g = game; this.meta = meta;
      this.st = meta.villages || (meta.villages = {});
      this.known = new Map(); this.pending = new Set();
      this.agents = []; this.sites = []; this.siteT = 0.5; this.siteAt = null;
      this.doors = new Map(); this.selfEdit = false;
      this.pathBudget = 0; this.time = 0;
      this.buildDom();
    }
    buildDom() {
      const ui = $('#ui');
      if (!$('#folk')) { const d = document.createElement('div'); d.id = 'folk'; ui.appendChild(d); }
      this.bubRoot = $('#folk');
      this.bubRoot.innerHTML = '';
      this.bubs = [];
      for (let i = 0; i < 12; i++) { const b = document.createElement('div'); b.className = 'vbub'; b.style.display = 'none'; this.bubRoot.appendChild(b); this.bubs.push(b); }
      if (!$('#talk')) {
        const s = document.createElement('div');
        s.id = 'talk'; s.className = 'screen';
        s.innerHTML = `<div class="panel box talkbox"><div class="row gap" style="align-items:center"><canvas id="tk_face" width="96" height="96"></canvas><div class="col" style="gap:2px;flex:1"><div id="tk_name"></div><div id="tk_role" class="note"></div><div id="tk_rep"></div></div></div><div id="tk_text" class="tktext"></div><div id="tk_opts" class="tkopts"></div></div>`;
        ui.appendChild(s);
      }
    }
    destroy() { if (this.bubRoot) this.bubRoot.innerHTML = ''; this.agents.length = 0; this.known.clear(); }

    // -------------------------------------------------- discovery
    onColumnLoaded(c) {
      if (!c.spawns) return;
      for (const s of c.spawns) if (s[0] === 'village') this.ensure(s[1]);
    }
    ensure(id) {
      if (this.known.has(id) || this.pending.has(id)) return;
      this.pending.add(id);
      const g = this.g;
      g.pool.direct(0, { type: 'villageplan', dim: g.dim, vid: id }, null, (m) => {
        this.pending.delete(id);
        if (!m.plan || !this.g.world) return;
        this.addVillage(m.plan);
      });
    }
    addVillage(plan) {
      if (this.known.has(plan.id)) return;
      const st = this.st[plan.id] || (this.st[plan.id] = { rep: 0, built: [], proj: null, repairs: [], met: [], stats: { harvest: 0, bread: 0, blocks: 0, repaired: 0 }, quests: {}, founded: 40 + (plan.seed % 300) });
      if (!st.stats) st.stats = { harvest: 0, bread: 0, blocks: 0, repaired: 0 };
      const vil = { id: plan.id, plan, st, mgr: this, active: false, agents: [], name: plan.name, center: [plan.x, plan.y, plan.z] };
      makeRoster(vil);
      this.known.set(plan.id, vil);
    }
    // nearby village sites (names on the map & compass even before you arrive)
    pollSites(dt) {
      const g = this.g, p = g.player;
      this.siteT -= dt;
      if (this.siteT > 0) return;
      this.siteT = 6;
      if (this.siteAt && Math.hypot(p.pos[0] - this.siteAt[0], p.pos[2] - this.siteAt[1]) < 96 && this.sites.length) return;
      this.siteAt = [p.pos[0], p.pos[2]];
      g.pool.direct(0, { type: 'villages', dim: g.dim, x: Math.floor(p.pos[0]), z: Math.floor(p.pos[2]), r: 900 }, null, (m) => { if (m.list) this.sites = m.list; });
    }
    nearestSite(x, z) {
      let best = null, bd = 1e18;
      for (const s of this.sites) { const d = (s.x - x) ** 2 + (s.z - z) ** 2; if (d < bd) { bd = d; best = s; } }
      return best ? { site: best, dist: Math.sqrt(bd) } : null;
    }

    // -------------------------------------------------- lifecycle per village
    update(dt) {
      const g = this.g, p = g.player, w = g.world;
      if (!p || !w) return;
      this.time += dt;
      this.pollSites(dt);
      // saved worlds load chunks without generator spawns: discover villages from the site list too
      for (const s of this.sites) if (!this.known.has(s.id) && Math.abs(s.x - p.pos[0]) < 170 && Math.abs(s.z - p.pos[2]) < 170) this.ensure(s.id);
      this.pathBudget = g.cpuBound ? 1 : 2;
      const tod = g.env.timeOfDay;
      for (const vil of this.known.values()) {
        const d = Math.hypot(p.pos[0] - vil.plan.x, p.pos[2] - vil.plan.z);
        if (!vil.active && d < 110 && w.isLoaded(vil.plan.x, vil.plan.z)) this.activate(vil, tod);
        else if (vil.active && d > 190) this.deactivate(vil);
        if (vil.active) {
          // who sits and who plays right now: the benches' and the games' budgets read these counts
          let ns = 0, np = 0;
          for (const o of vil.agents) { if (o.pose === 'sit') ns++; if (o.act && o.act.type === 'play') np++; }
          vil.nSeated = ns; vil.nPlay = np;
          this.updateVillage(vil, dt, tod, d);
        }
      }
      // agents: every frame up close, every 2nd / 4th frame further away (with the time they skipped), and
      // half as often again while the main thread is the bottleneck — the far crowd keeps living, cheaper
      const fr = (this.frameN = (this.frameN || 0) + 1), slow = g.cpuBound ? 2 : 1;
      const px = p.pos[0], pz = p.pos[2];
      let budget = g.cpuBound ? 40 : 72; // agent updates per frame at most; the rest catch up with the time they skipped
      for (let i = 0; i < this.agents.length; i++) {
        const a = this.agents[i];
        const dx = a.pos[0] - px, dz = a.pos[2] - pz, d2 = dx * dx + dz * dz;
        let every = Math.min(8, (a.pose === 'sleep' ? 6 : d2 < 24 * 24 ? 1 : d2 < 56 * 56 ? 2 : d2 < 100 * 100 ? 3 : 6) * slow);
        // a person nobody sees (not drawn last frame: out of view, beyond the folk distance or past the street's cap) and
        // not right beside the player lives at the far rate: its time accumulates, its walk goes on in longer steps
        if (a.drawn === false && d2 > 16 * 16 && every < 4 * slow) every = Math.min(8, 4 * slow);
        a.dtAcc = (a.dtAcc || 0) + dt;
        if (every > 1 && ((fr + i) % every) !== 0) continue;
        if (budget <= 0 && d2 > 24 * 24 && a.dtAcc < 0.5) continue;
        budget--;
        const adt = Math.min(0.3, a.dtAcc); a.dtAcc = 0;
        this.updateAgent(a, adt, tod);
      }
      if (this.updateBoats) this.updateBoats(dt);
      if (this.separate) this.separate(dt);
      this.updateDoors(dt);
      if (this.agents.length) { const e = p.eyePos(), d = p.lookDir(); const hit = this.ray(e, d, 10); this.lookTarget = hit ? hit.ent : null; } else this.lookTarget = null;
      this.updateBubbles();
    }
    activate(vil, tod) {
      const g = this.g;
      vil.active = true;
      vil.agents = [];
      if (!vil.visited) { vil.visited = true; if (g.ui && g.settings.toasts !== false) g.ui.toast(T('g.vil.welcome', { v: vil.name }), T(vil.plan.style === 'hall' ? 'g.vil.hallSub' : 'g.vil.welcomeSub', { n: vil.people.length, f: vil.fams.length }), null); if (g.codex && g.codex.event) g.codex.event('village'); }
      this.catchUp(vil);
      for (const person of vil.people) {
        const pos = this.spawnPos(vil, person, tod);
        const a = new Villager(vil, person, pos);
        if (tod >= 13000 && tod < 23300 && person.bed && person.role !== 'ranger') { a.act = { type: 'sleep', phase: 'in', t: 1e9 }; a.pose = 'sleep'; }
        vil.agents.push(a); this.agents.push(a);
      }
    }
    deactivate(vil) {
      if (vil.outing && this.endOuting) this.endOuting(vil);
      vil.boats = [];
      vil.active = false;
      for (const a of vil.agents) { const i = this.agents.indexOf(a); if (i >= 0) this.agents.splice(i, 1); }
      vil.agents = [];
      vil.st.lastSeen = this.worldTime();
    }
    worldTime() { const e = this.g.env; return (e.day || 0) * 24000 + e.timeOfDay; }
    spawnPos(vil, person, tod) {
      const home = vil.homes[person.home];
      const night = tod >= 13000 && tod < 23300;
      if (night && person.bed) return this.bedPos(person.bed);
      const pz = vil.plan.plaza;
      // (one person in eight starts the day on the plaza's ring; the others at their own door: no crowd at the plaza)
      if (!night && VR.Crowd.plazaPerson(person.seed)) { const a = (H(person.seed, 5, 5) % 628) / 100, r = 1.5 + (H(person.seed, 6, 6) % 3); return [pz.x + 0.5 + Math.cos(a) * r, pz.y, pz.z + 0.5 + Math.sin(a) * r]; }
      const o = home && (home.outside || home.door);
      return o ? [o[0] + 0.5, o[1], o[2] + 0.5] : [pz.x + 0.5, pz.y, pz.z + 0.5];
    }
    bedPos(bed) {
      const f = bed[3];
      return [bed[0] + 0.5 + VR.HF_DX[f] * 0.5, bed[1] + 0.56, bed[2] + 0.5 + VR.HF_DZ[f] * 0.5];
    }
    // builders kept working while you were away
    catchUp(vil) {
      const st = vil.st, now = this.worldTime();
      if (st.lastSeen === undefined) { st.lastSeen = now; return; }
      const elapsed = Math.max(0, now - st.lastSeen);
      st.lastSeen = now;
      const secs = elapsed / 20 * 0.4;
      let n = Math.min(4000, Math.floor(secs / 0.9) * this.builders(vil));
      while (n > 0) { const r = this.buildStep(vil, true); if (!r) break; n--; }
    }
    builders(vil) { return Math.max(1, vil.people.filter(p => p.role === 'builder').length); }

    // -------------------------------------------------- village-level systems
    updateVillage(vil, dt, tod) {
      const g = this.g;
      vil.fx = (vil.fx || 0) - dt;
      if (vil.fx <= 0) {
        vil.fx = 0.25;
        const pl = g.player.pos;
        // chimney smoke (visible from afar) & lamp glints
        for (const c of vil.plan.chimneys) {
          if (!c) continue;
          const dd = (c[0] - pl[0]) ** 2 + (c[2] - pl[2]) ** 2;
          if (dd > 200 * 200) continue;
          if (Math.random() < 0.55) g.particles.spawn(c[0] + 0.5 + (Math.random() - 0.5) * 0.2, c[1] + 1.05, c[2] + 0.5 + (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.25 + 0.15, 0.8 + Math.random() * 0.35, (Math.random() - 0.5) * 0.25, { life: 3 + Math.random() * 1.5, size: 0.1 + Math.random() * 0.08, grav: -0.12, col: [0.86, 0.86, 0.9], drag: 0.35, collide: false, grow: 0.16 });
        }
        if (vil.plan.pad && vil.plan.pad.x !== undefined && tod > 12500 && tod < 23500 && Math.random() < 0.2) { const pd = vil.plan.pad; g.particles.glow(pd.x + (Math.random() - 0.5) * 11, pd.y + 0.2, pd.z + (Math.random() - 0.5) * 11, [0.3, 1, 1], 1.5, 0.06, 0.4); }
      }
      if (this.maybeOuting) this.maybeOuting(vil, dt, tod);
      // noon bell
      const day = g.env.day || 0;
      if (tod > 6000 && tod < 6300 && vil.bellDay !== day) { vil.bellDay = day; if (vil.plan.bell) this.bell(vil); }
    }
    bell(vil) {
      const g = this.g, b = vil.plan.bell;
      const d = Math.hypot(g.player.pos[0] - b[0], g.player.pos[2] - b[2]);
      if (d < 80 && g.audio && g.audio.ctx) { const a = g.audio, t = a.ctx.currentTime; const vol = Math.max(0.05, 0.3 * (1 - d / 80)); for (let k = 0; k < 3; k++) for (const f of [523, 1046, 1568]) a.tone(f, vol * (f === 523 ? 1 : 0.4), 2.2, 'sine', true, t + k * 0.9); }
      const mayor = vil.agents.find(a => a.role === 'mayor');
      if (mayor) mayor.say(T('g.folk.lunch'), 4);
    }

    // -------------------------------------------------- construction & repairs
    // returns true when a block was placed (or a step consumed)
    buildStep(vil, instant) {
      const st = vil.st, P = vil.plan, w = this.g.world;
      if (st.repairs && st.repairs.length) {
        const r = st.repairs[0];
        if (!w.isLoaded(r[0], r[2])) return false;
        // never build a block into someone (the player standing in the hole they dug, a neighbour walking by)
        if (this.occupied(r[0], r[1], r[2])) { st.repairs.push(st.repairs.shift()); return { pos: r, wait: true }; }
        st.repairs.shift();
        const cur = w.getBlock(r[0], r[1], r[2]);
        if (cur === 0 || (R.T.flags[cur] & F.REPLACE)) { this.setBlock(r[0], r[1], r[2], r[3]); st.stats.repaired++; return { pos: r, repair: true }; }
        return { pos: r, repair: true, skip: true };
      }
      if (!st.proj) {
        const next = P.lots.findIndex((l, i) => !(st.built || []).includes(i));
        if (next < 0) return false;
        st.proj = { lot: next, i: 0 };
      }
      const lot = P.lots[st.proj.lot];
      if (!lot || !lot.ops) { st.proj = null; return false; }
      const ops = lot.ops;
      // skip ops that already match (fast-forward), place the next real change
      let guard = 0;
      while (st.proj.i < ops.length && guard++ < 64) {
        const i = st.proj.i, x = ops[i], y = ops[i + 1], z = ops[i + 2], s = ops[i + 3];
        if (!w.isLoaded(x, z)) return false;
        if (w.getBlock(x, y, z) === s) { st.proj.i += 4; continue; }
        if (s && (R.T.flags[s] & F.SOLID) && this.occupied(x, y, z)) return { pos: [x, y, z], wait: true };
        st.proj.i += 4;
        this.setBlock(x, y, z, s);
        st.stats.blocks++;
        return { pos: [x, y, z], state: s };
      }
      if (st.proj.i >= ops.length) {
        const li = st.proj.lot;
        st.built = st.built || []; st.built.push(li);
        st.proj = null;
        this.onHouseDone(vil, li, instant);
        return { done: true };
      }
      return false;
    }
    onHouseDone(vil, li, quiet) {
      const g = this.g;
      const oldCount = vil.people.length;
      makeRoster(vil);
      if (vil.active) {
        const tod = g.env.timeOfDay;
        for (let k = oldCount; k < vil.people.length; k++) { const person = vil.people[k]; const a = new Villager(vil, person, this.spawnPos(vil, person, tod)); vil.agents.push(a); this.agents.push(a); a.say(TL('g.folk.newHome')[k === oldCount ? 0 : 1] || '', 5); }
        // re-link existing agents to (possibly re-ordered) roster entries
        for (const a of vil.agents) { const np = vil.people.find(pp => pp.id === a.p.id); if (np) a.p = np; }
      }
      const fam = vil.fams[vil.fams.length - 1];
      if (!quiet && g.ui) { g.ui.toast(T('g.vil.growing', { v: vil.name }), T('g.vil.movedIn', { fam: fam ? fam.surname : T('g.vil.newFam') }), null); if (g.audio) g.audio.play('achievement'); }
    }
    // a family moves into a house the player built
    onCustomHome(vil) {
      const g = this.g, oldCount = vil.people.length;
      makeRoster(vil);
      if (vil.active) {
        const tod = g.env.timeOfDay, home = vil.homes[vil.homes.length - 1];
        for (let k = oldCount; k < vil.people.length; k++) {
          const person = vil.people[k];
          const o = home && home.outside;
          const pos = o ? [o[0] + 0.5 + (k - oldCount) * 0.6, o[1], o[2] + 0.5] : this.spawnPos(vil, person, tod);
          const a = new Villager(vil, person, pos); vil.agents.push(a); this.agents.push(a);
          a.say(FS(k === oldCount ? 'builtFirst' : 'builtKids', person.seed), 5);
        }
        for (const a of vil.agents) { const np = vil.people.find(pp => pp.id === a.p.id); if (np) a.p = np; }
      }
      const fam = vil.fams[vil.fams.length - 1];
      vil.st.rep = (vil.st.rep || 0) + 6;
      if (g.ui) { g.ui.toast(T('g.vil.movedTitle'), T('g.vil.movedYours', { fam: fam ? fam.surname : T('g.vil.newFam'), v: vil.name }), null); if (g.audio) g.audio.play('achievement'); }
      if (g.codex && g.codex.event) g.codex.event('home');
    }
    setBlock(x, y, z, s) {
      // in a friend's world the host's villagers do the building; ours only live their lives
      if (this.g.mp && this.g.mp.isClient) return;
      this.selfEdit = true; try { this.g.world.setBlock(x, y, z, s, 0); } finally { this.selfEdit = false; }
    }
    // is a person (the player or a villager) standing in / touching block cell (x,y,z)?
    occupied(x, y, z) {
      const hit = (px, py, pz, hw, h) => px + hw > x - 0.05 && px - hw < x + 1.05 && pz + hw > z - 0.05 && pz - hw < z + 1.05 && py + h > y && py < y + 1.02;
      const p = this.g.player;
      if (p && !p.dead && hit(p.pos[0], p.pos[1], p.pos[2], 0.3, 1.8)) return true;
      for (const a of this.agents) if (hit(a.pos[0], a.pos[1], a.pos[2], 0.3, a.kid ? 1.2 : 1.8)) return true;
      return false;
    }
    onBlockChanged(x, y, z, old, s) {
      if (this.selfEdit || !old || s === old) return;
      if (s !== 0 && !(R.T.flags[s] & F.REPLACE)) return;
      for (const vil of this.known.values()) {
        if (Math.abs(x - vil.plan.x) > 70 || Math.abs(z - vil.plan.z) > 70) continue;
        const inBox = (b) => b && x >= b[0] && x <= b[3] && z >= b[2] && z <= b[5] && y >= b[1] - 1 && y <= b[4] + 1;
        if (vil.homes.some(h => inBox(h.box)) || vil.plan.work.some(wk => inBox(wk.box))) {
          const t = R.types[R.T.type[old]];
          if (t && /wheat|carrot|potato|beetroot/.test(t.name)) return;
          const rep = vil.st.repairs || (vil.st.repairs = []);
          if (rep.length < 300) rep.push([x, y, z, old]);
          // someone saw that…
          if (vil.active && vil.agents.length) { const a = this.closest(vil, x, z, 18); if (a && Math.random() < 0.35) a.say(FS('vandal', Math.random() < 0.5 ? 0 : 1, { s: this.houseName(vil, x, z) }), 3.5); }
          return;
        }
      }
    }
    houseName(vil, x, z) {
      for (let i = 0; i < vil.homes.length; i++) { const b = vil.homes[i].box; if (b && x >= b[0] && x <= b[3] && z >= b[2] && z <= b[5]) { const f = vil.fams.find(ff => ff.home === i); if (f) return f.surname; } }
      return T('g.vil.houseVillage');
    }
    closest(vil, x, z, maxD) { let best = null, bd = maxD * maxD; for (const a of vil.agents) { const d = (a.pos[0] - x) ** 2 + (a.pos[2] - z) ** 2; if (d < bd && a.act && a.act.type !== 'sleep') { bd = d; best = a; } } return best; }

    // -------------------------------------------------- doors
    tryOpenDoor(x, y, z) {
      const w = this.g.world;
      const s = w.getBlock(x, y, z);
      const t = R.types[R.T.type[s]];
      if (!t || t.o.kind !== 'door' && t.o.kind !== 'gate') return;
      const key = x + ',' + y + ',' + z;
      if (t.get(s, 'open') === 0) {
        this.setBlock(x, y, z, t.with(s, 'open', 1));
        if (t.o.kind === 'door') { const h = t.get(s, 'half'); const oy = h ? y - 1 : y + 1; const s2 = w.getBlock(x, oy, z); if (R.T.type[s2] === t.id) this.setBlock(x, oy, z, t.with(s2, 'open', 1)); }
        const d = Math.hypot(this.g.player.pos[0] - x, this.g.player.pos[2] - z);
        if (d < 18 && this.g.audio) this.g.audio.play('door', { at: [x + 0.5, y + 0.5, z + 0.5] });
      }
      this.doors.set(key, { x, y, z, t: 2.2 });
    }
    updateDoors(dt) {
      const w = this.g.world;
      for (const [key, d] of this.doors) {
        d.t -= dt;
        if (d.t > 0) continue;
        let busy = false;
        for (const a of this.agents) if (Math.abs(a.pos[0] - d.x - 0.5) < 1.3 && Math.abs(a.pos[2] - d.z - 0.5) < 1.3 && Math.abs(a.pos[1] - d.y) < 2.5) { busy = true; break; }
        const pp = this.g.player.pos;
        if (Math.abs(pp[0] - d.x - 0.5) < 1.2 && Math.abs(pp[2] - d.z - 0.5) < 1.2) busy = true;
        if (busy) { d.t = 0.8; continue; }
        this.doors.delete(key);
        const s = w.getBlock(d.x, d.y, d.z), t = R.types[R.T.type[s]];
        if (!t || (t.o.kind !== 'door' && t.o.kind !== 'gate') || !t.get(s, 'open')) continue;
        this.setBlock(d.x, d.y, d.z, t.with(s, 'open', 0));
        if (t.o.kind === 'door') { const h = t.get(s, 'half'); const oy = h ? d.y - 1 : d.y + 1; const s2 = w.getBlock(d.x, oy, d.z); if (R.T.type[s2] === t.id) this.setBlock(d.x, oy, d.z, t.with(s2, 'open', 0)); }
      }
    }

    // -------------------------------------------------- agent brain
    updateAgent(a, dt, tod) {
      const g = this.g, w = g.world;
      a.t += dt; a.talkCool -= dt; a.hurt = Math.max(0, a.hurt - dt);
      if (a.bubble) { a.bubble.t -= dt; if (a.bubble.t <= 0) a.bubble = null; }
      const cx = Math.floor(a.pos[0]), cz = Math.floor(a.pos[2]);
      if (!w.isLoaded(cx, cz)) return;
      a.thinkT -= dt;
      if (a.thinkT <= 0 || !a.act) { a.thinkT = 1.2 + Math.random() * 0.8; this.think(a, tod); }
      a.eyesClosed = false; a.steer = null;
      this.runAct(a, dt, tod);
      if (!a.inBoat) this.move(a, dt);
      this.social(a, dt, tod);
    }
    danger(a) {
      const E = this.g.entities; if (!E) return null;
      let best = null, bd = 14 * 14;
      for (const m of E.mobs) { if (!m.def.hostile || m.dead) continue; const d = (m.pos[0] - a.pos[0]) ** 2 + (m.pos[2] - a.pos[2]) ** 2; if (d < bd && Math.abs(m.pos[1] - a.pos[1]) < 8) { bd = d; best = m; } }
      return best;
    }
    // choose what to do (keeps the current activity if it is still right)
    think(a, tod) {
      const vil = a.vil, P = vil.plan;
      const want = this.schedule(a, tod);
      const threat = this.danger(a);
      if (threat) {
        if (a.role === 'ranger') { if (!a.act || a.act.type !== 'fight') this.setAct(a, { type: 'fight', mob: threat }); else a.act.mob = threat; return; }
        if (a.act && a.act.type === 'outing') this.endOuting(vil);
        if (!a.act || a.act.type !== 'hide') { this.setAct(a, { type: 'hide' }); if (Math.random() < 0.6) a.say(Folk.say('danger', H(a.p.seed, this.time | 0, 1)), 3); }
        return;
      }
      if (a.act && a.act.type === 'outing' && vil.outing === a.act.o) return;
      if (a.act && a.act.type === 'hide') { a.act = null; }
      if (a.act && a.act.type === 'fight') a.act = null;
      if (a.act && a.act.type === 'talk' && a.act.t > 0) return;
      if (a.act && a.act.type === want && !a.act.done) return;
      this.setAct(a, { type: want });
      void P;
    }
    schedule(a, tod) {
      const role = a.role, vil = a.vil;
      const school = (vil.workOf.teacher || [])[0], cafe = (vil.workOf.barista || [])[0], park = (vil.workOf.gardener || []).find(w => w.seats && w.seats.length);
      if (tod >= 13000 && tod < 23300) return role === 'ranger' && (a.p.idx === 0 || a.p.fam % 2 === 0) ? 'patrol' : 'sleep';
      if (tod >= 23300 || tod < 900) return 'breakfast';
      if (tod >= 5600 && tod < 6900) return (a.p.seed & 1) ? (cafe && !a.kid && ((a.p.seed >> 4) & 1) ? 'cafe' : 'plaza') : 'lunch';
      // dusk (the street's budget, src/shared/folkcrowd.js): each person walks home at its own time, so the streets empty
      // gradually; the adults who are out roam the village roads, a few sit at the plaza's benches, the children run
      if (tod >= 10600 && tod < 12300) {
        if (tod >= VR.Crowd.homeAt(a.p.seed)) return 'home';
        if (a.kid) return this.kidGames(a, vil);
        if ((a.p.seed >> 1) & 1) { if (park && (a.elder || ((a.p.seed >> 5) & 1))) return 'park'; if (VR.Crowd.plazaPerson(a.p.seed)) return 'plaza'; }
        return 'stroll';
      }
      if (tod >= 12300) return 'home';
      // school hours: every kid sits in class while the teacher teaches (the small ones go a little later)
      if (a.kid) { if (school && tod >= 1200 + (a.p.years < 7 ? 600 : 0) && tod < 5600) return 'school'; return (a.p.seed >> 2) & 1 && tod > 3000 && !school ? 'learn' : this.kidGames(a, vil); }
      if (a.elder) return (a.p.seed >> 3) & 1 ? 'garden' : park && tod > 2500 ? 'park' : 'stroll';
      return 'work';
    }
    setAct(a, act) {
      a.act = Object.assign({ phase: 'go', t: 0 }, act);
      a.path = null; a.goal = null; a.steer = null;
      if (act.type !== 'outing') a.inBoat = null;
      if (a.pose === 'sitground') a.pose = 'stand';
      if (a.pose === 'sleep' && act.type !== 'sleep') this.wake(a);
      if (a.pose === 'sit') a.pose = 'stand';
    }
    wake(a) {
      a.pose = 'stand';
      const home = a.vil.homes[a.p.home];
      if (a.p.bed) { const b = a.p.bed; const f = b[3]; a.pos = [b[0] + 0.5 - VR.HF_DX[f] * 0.9, b[1], b[2] + 0.5 - VR.HF_DZ[f] * 0.9]; }
      else if (home && home.inside) a.pos = [home.inside[0] + 0.5, home.inside[1], home.inside[2] + 0.5];
      a.vel = [0, 0, 0];
    }
    // navigate toward a block cell; returns true when arrived
    goTo(a, x, y, z, near) {
      const gx = Math.floor(x), gy = Math.floor(y), gz = Math.floor(z);
      const dx = a.pos[0] - (gx + 0.5), dz = a.pos[2] - (gz + 0.5);
      const nr = near || 0.6;
      if (dx * dx + dz * dz < nr * nr && Math.abs(a.pos[1] - gy) < 1.6) { a.path = null; a.offT = 0; return true; }
      if (!a.goal || a.goal[0] !== gx || a.goal[1] !== gy || a.goal[2] !== gz) { a.goal = [gx, gy, gz]; a.path = null; a.fails = 0; a.offT = 0; }
      // a walk nobody sees (t-town: a hall city's 149 people searched three times the paths of a village's 38): a person
      // not drawn (pick) and away from the player, whose goal no one sees either, searches no path — it arrives when the
      // walk would be done (the straight distance at its pace, a third more for the bends) and stands at the goal, unseen.
      // Drawn on the way (the player turned), it searches its path from where it stands, as before.
      if (!a.path && a.drawn === false && this.unseenWalk(a, gx, gy, gz)) {
        if (!a.offT) a.offT = this.time + Math.hypot(dx, dz) / Math.max(0.5, a.speed || 1) * 1.35 + 0.5;
        if (this.time < a.offT) return false;
        a.offT = 0; a.pos = [gx + 0.5, gy, gz + 0.5]; a.vel = [0, 0, 0]; a.fails = 0;
        return true;
      }
      a.offT = 0;
      if (!a.path) {
        a.pathWait -= 1;
        if (a.pathWait > 0 || this.pathBudget <= 0) return false;
        this.pathBudget--;
        const from = [Math.floor(a.pos[0]), Math.floor(a.pos[1] + 0.05), Math.floor(a.pos[2])];
        const res = Folk.findPath(this.g.world, from, a.goal, { kid: a.kid, farmer: a.role === 'farmer', near: near && near > 1 ? Math.floor(near) : 0, partial: true, max: this.g.cpuBound ? 1200 : 1800 });
        if (!res || res.path.length < 1) { a.fails++; a.pathWait = 20; if (a.fails > 3) { this.teleportTo(a, gx, gy, gz); } return false; }
        a.path = res.path; a.pi = 1; a.stuckT = 0; a.lastProg = 1e9;
        if (!res.complete) {
          // a partial path is fine on long walks as long as it brings us closer
          const last = res.path[res.path.length - 1];
          const before = Math.hypot(from[0] - gx, from[2] - gz), after = Math.hypot(last[0] - gx, last[2] - gz);
          if (after > before - 3) { a.fails++; if (a.fails > 4) this.teleportTo(a, gx, gy, gz); }
        }
      }
      return false;
    }
    // may a person walk unseen to (gx, gy, gz)? It and its goal away from the player, and the goal out of the last frame's
    // view or beyond the folk distance (so nobody sees it appear there)
    unseenWalk(a, gx, gy, gz) {
      const p = this.g.player.pos, c = this._pickCam, R = 24 * 24;
      if ((a.pos[0] - p[0]) ** 2 + (a.pos[2] - p[2]) ** 2 < R || (gx + 0.5 - p[0]) ** 2 + (gz + 0.5 - p[2]) ** 2 < R || !c) return false;
      const dx = gx + 0.5 - c.x, dy = gy - c.y, dz = gz + 0.5 - c.z;
      return dx * dx + dz * dz > c.FD * c.FD || !VR.mat4.boxInFrustum(this._pickPlanes, dx - 2, dy - 1, dz - 2, dx + 2, dy + 3, dz + 2);
    }
    teleportTo(a, x, y, z) {
      // unseen shortcut so nobody stays stuck forever
      const p = this.g.player.pos;
      const d = Math.hypot(p[0] - a.pos[0], p[2] - a.pos[2]);
      if (d < 18) { a.pathWait = 40; a.fails = 1; return; }
      a.pos = [x + 0.5, y, z + 0.5]; a.vel = [0, 0, 0]; a.path = null; a.fails = 0;
    }
    move(a, dt) {
      const g = this.g, w = g.world;
      // a guest's villagers can't open doors (the host's world owns them): they slip through
      const get = g.mp && g.mp.isClient ? (x, y, z) => { const s = w.getBlock(x, y, z); if (s) { const t = R.types[R.T.type[s]]; if (t && t.o.kind === 'door') return 0; } return s; } : (x, y, z) => w.getBlock(x, y, z), nb = w.nbFn();
      let tx = null, tz = null, ty = 0;
      if (a.path && a.pi < a.path.length && a.pose !== 'sleep' && a.pose !== 'sit') {
        const wp = a.path[a.pi];
        tx = wp[0] + 0.5; tz = wp[2] + 0.5; ty = wp[1];
        const dx = tx - a.pos[0], dz = tz - a.pos[2], dist = Math.hypot(dx, dz);
        // doors on the way open by themselves
        const s = get(wp[0], wp[1], wp[2]);
        if (Folk.passable(s) === 2) this.tryOpenDoor(wp[0], wp[1], wp[2]);
        const s2 = get(wp[0], wp[1] + 1, wp[2]); if (Folk.passable(s2) === 2) this.tryOpenDoor(wp[0], wp[1] + 1, wp[2]);
        if (dist < 0.3 && Math.abs(a.pos[1] - ty) < 1.2) { a.pi++; if (a.pi >= a.path.length) a.path = null; }
        // stuck detection
        a.stuckT += dt;
        if (a.stuckT > 1.5) { a.stuckT = 0; const prog = dist; if (prog > a.lastProg - 0.2) { a.path = null; a.pathWait = 0; a.fails++; if (a.fails > 5) { const gl = a.goal; if (gl) this.teleportTo(a, gl[0], gl[1], gl[2]); } } a.lastProg = prog; }
      }
      if (tx === null && a.steer) {
        // direct steering (plaza games, following the family on a hike): no path search, but never off a cliff or into water
        const dx = a.steer[0] - a.pos[0], dz = a.steer[1] - a.pos[2], d = Math.hypot(dx, dz);
        if (d > 0.25) {
          const fx = Math.floor(a.pos[0] + dx / d * 0.7), fz = Math.floor(a.pos[2] + dz / d * 0.7), fy = Math.floor(a.pos[1] + 0.05);
          if (this.safeCell(fx, fy, fz) || this.safeCell(fx, fy + 1, fz)) { tx = a.steer[0]; tz = a.steer[1]; ty = fy; }
          else a.steerBlocked = this.time;
        }
      }
      if (a.pose === 'sleep' || a.pose === 'sit' || a.pose === 'sitground') { a.vel[0] = 0; a.vel[2] = 0; a.walkAmt += (0 - a.walkAmt) * Math.min(1, dt * 6); return; }
      if (tx !== null) {
        const dx = tx - a.pos[0], dz = tz - a.pos[2], d = Math.hypot(dx, dz) || 1;
        const sp = a.act && a.act.run ? a.speed * 1.5 : a.speed;
        a.vel[0] += (dx / d * sp - a.vel[0]) * Math.min(1, dt * 8);
        a.vel[2] += (dz / d * sp - a.vel[2]) * Math.min(1, dt * 8);
        const ty2 = Math.atan2(-dx, -dz);
        let dy = ty2 - a.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
        a.yaw += dy * Math.min(1, dt * 8);
        if (ty > a.pos[1] + 0.55 && a.onGround && d < 1.3) a.vel[1] = 8.4;
      } else { a.vel[0] *= Math.exp(-dt * 10); a.vel[2] *= Math.exp(-dt * 10); }
      // face whatever we are looking at when standing
      if (tx === null && a.lookAt) { const dx = a.lookAt[0] - a.pos[0], dz = a.lookAt[2] - a.pos[2]; const ty2 = Math.atan2(-dx, -dz); let dy = ty2 - a.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; a.yaw += dy * Math.min(1, dt * 5); }
      // standing still on solid ground with nowhere to go: nothing moves this step, so no collision query — a town's most
      // common case (t-town: the hall city's 149 people); a person whose ground went away falls as before
      if (tx === null && a.onGround && a.vel[1] <= 0 && a.vel[0] * a.vel[0] + a.vel[2] * a.vel[2] < 1e-4 && (R.T.flags[get(Math.floor(a.pos[0]), Math.floor(a.pos[1] - 0.05), Math.floor(a.pos[2]))] & F.SOLID)) {
        a.vel[0] = 0; a.vel[1] = 0; a.vel[2] = 0;
        a.walkAmt += (0 - a.walkAmt) * Math.min(1, dt * 6);
        return;
      }
      const inFluid = R.T.flags[get(Math.floor(a.pos[0]), Math.floor(a.pos[1] + 0.3), Math.floor(a.pos[2]))] & F.FLUID;
      if (inFluid) { a.vel[1] = Math.min(a.vel[1] + 22 * dt, 2.6); } else a.vel[1] -= 28 * dt;
      let my = a.vel[1] * dt, follow = null;
      if (a.onGround && a.vel[1] <= 0 && !inFluid) { follow = PH.walkSmooth(get, a.pos, a.vel[0] * dt, a.vel[2] * dt); if (follow !== null) { my = follow; a.vel[1] = 0; } }
      const res = PH.move(get, a.pos, a.w, a.h, a.vel[0] * dt, my, a.vel[2] * dt, 0.6, nb, a.onGround);
      if (follow !== null) { res.onGround = true; res.hitY = true; }
      else if (a.vel[1] <= 0 && PH.snapSmooth(get, a.pos)) { res.onGround = true; res.hitY = true; }
      if (res.hitY) a.vel[1] = 0;
      a.onGround = res.onGround || (res.hitY && a.vel[1] === 0);
      if ((res.hitX || res.hitZ) && a.onGround && tx !== null) a.vel[1] = 8.4;
      if (res.hitX) a.vel[0] = 0; if (res.hitZ) a.vel[2] = 0;
      if (a.pos[1] < -10) { const h = a.vil.homes[a.p.home]; const o = h && h.outside; if (o) a.pos = [o[0] + 0.5, o[1] + 0.2, o[2] + 0.5]; a.vel = [0, 0, 0]; }
      const hs = Math.hypot(a.vel[0], a.vel[2]);
      a.walk += hs * dt * 2.3; a.walkAmt += ((hs > 0.3 ? 1 : 0) - a.walkAmt) * Math.min(1, dt * 6);
      if (hs > 0.3 && a.pose !== 'work') a.pose = 'stand';
    }
    // (see folklife.js for games, outings, boats and personal space)
    // -------------------------------------------------- activities
    runAct(a, dt, tod) {
      const act = a.act; if (!act) return;
      const vil = a.vil, P = vil.plan, g = this.g, w = g.world;
      act.t += dt;
      const home = vil.homes[a.p.home];
      const plaza = P.plaza;
      const H2 = (k) => H(a.p.seed, k, (this.time / 7) | 0);
      switch (act.type) {
        case 'sleep': {
          if (a.pose === 'sleep') { if (Math.random() < dt * 0.02 && this.near(a, 10)) a.say(Folk.say('sleep', H2(1)), 2.5); return; }
          if (!a.p.bed) { this.goHome(a); return; }
          const b = a.p.bed, f = b[3];
          const sx = b[0] - VR.HF_DX[f], sz = b[2] - VR.HF_DZ[f];
          // walk to the side of the bed's foot, then lie down
          if (this.goTo(a, sx + VR.HF_DX[(f + 1) & 3] * 0, b[1], sz, 1.3) || act.t > 70) {
            a.pose = 'sleep'; a.pos = this.bedPos(b); a.vel = [0, 0, 0];
            a.yaw = Math.atan2(VR.HF_DX[f], VR.HF_DZ[f]);
          }
          return;
        }
        case 'home': case 'hide': {
          if (!home) return;
          const tgt = home.table ? [home.table[0], home.table[1], home.table[2]] : home.inside;
          if (this.goTo(a, tgt[0], tgt[1], tgt[2], act.type === 'hide' ? 1.5 : 2.2)) { a.pose = 'stand'; if (Math.random() < dt * 0.1) a.yaw += (Math.random() - 0.5) * 2; }
          if (act.type === 'hide') act.run = true;
          return;
        }
        case 'breakfast': case 'lunch': {
          if (!home) return;
          const seat = home.seats && home.seats.length ? home.seats[a.p.idx % home.seats.length] : null;
          if (seat) {
            if (a.pose === 'sit') { if (Math.random() < dt * 0.08 && this.near(a, 12)) a.say(Folk.say(act.type === 'breakfast' && Math.random() < 0.5 ? 'morning' : 'eat', H2(2), { n: this.famName(a) }), 3); return; }
            if (this.goTo(a, seat[0], seat[1], seat[2], 0.8)) this.sit(a, seat);
          } else if (home.inside) this.goTo(a, home.inside[0], home.inside[1], home.inside[2], 1.2);
          return;
        }
        case 'plaza': case 'stroll': {
          if (act.type === 'plaza') {
            const seats = plaza.seats || [];
            if (!act.spot) {
              const k = H2(3) % (seats.length + 6);
              // (at most a few sit on the benches at a time: the street's budget; the others stand around the ring)
              if (k < seats.length && (vil.nSeated || 0) < VR.Crowd.STREET.seats) act.spot = seats[k].slice(); else { const an = (H2(4) % 628) / 100, r = 1.8 + (H2(5) % 30) / 10; act.spot = [Math.floor(plaza.x + Math.cos(an) * r), plaza.y, Math.floor(plaza.z + Math.sin(an) * r)]; }
            }
            if (a.pose === 'sit') { if (act.t > 40) { a.pose = 'stand'; act.spot = null; act.t = 0; } return; }
            if (this.goTo(a, act.spot[0], act.spot[1], act.spot[2], 1.1)) {
              if (act.spot.length > 3) this.sit(a, act.spot); else { a.lookAt = [plaza.x + 0.5, plaza.y, plaza.z + 0.5]; if (act.t > 25) { act.spot = null; act.t = 0; } }
            }
          } else {
            // a purposeful walk along the village roads (the light-line paths): a far point, a short pause there, the next
            if (!act.spot) this.pickRoute(a, act, H2);
            if (this.goTo(a, act.spot[0], act.spot[1], act.spot[2], 1.6)) { a.lookAt = null; act.rest = (act.rest || 0) + dt; if (act.rest > 2 + (H2(9) % 20) / 10) { act.spot = null; act.rest = 0; } }
          }
          return;
        }
        case 'outing': this.runOuting(a, act, dt, tod); return;
        case 'play': { this.play(a, act, dt); return; }
        case 'play_old': {
          // tag with the other kids around the plaza
          const kids = vil.agents.filter(o => o !== a && o.kid && o.act && o.act.type === 'play');
          act.run = true;
          if (!act.target || act.t > 6) {
            act.t = 0;
            const it = kids[H2(8) % Math.max(1, kids.length)];
            if (it && Math.random() < 0.6) act.target = it; else { const an = Math.random() * 6.28, r = 2 + Math.random() * (plaza.r + 3); act.target = [Math.floor(plaza.x + Math.cos(an) * r), plaza.y, Math.floor(plaza.z + Math.sin(an) * r)]; }
            if (Math.random() < 0.3 && this.near(a, 16)) a.say(Folk.say('play', H2(9)), 2);
          }
          const tg = act.target.pos ? [Math.floor(act.target.pos[0]), Math.floor(act.target.pos[1] + 0.05), Math.floor(act.target.pos[2])] : act.target;
          if (this.goTo(a, tg[0], tg[1], tg[2], 1.2)) { if (a.onGround && Math.random() < dt * 1.5) a.vel[1] = 6.5; act.target = null; }
          return;
        }
        case 'school': {
          // find a free desk in the classroom, sit facing the board, listen, answer now and then
          const school = (vil.workOf.teacher || [])[0];
          const desks = school && school.desks || [];
          if (!desks.length) { act.type = 'learn'; return; }
          if (!act.spot) { const mine = desks.filter((d, i) => !vil.agents.some(o => o !== a && o.act && o.act.type === 'school' && o.act.spot && o.act.spot[0] === d[0] && o.act.spot[2] === d[2])); if (!mine.length) { act.type = 'play'; act.recess = true; return; } act.spot = mine[H2(14) % mine.length].slice(); }
          if (a.pose === 'sit') {
            if (Math.random() < dt * 0.03 && this.near(a, 14)) a.say(FS('school', H2(15), { a: 2 + (a.p.years % 5), b: 3 + (a.p.years % 4), c: 5 + (a.p.years % 5) + (a.p.years % 4) }), 2.5);
            if (act.t > 90 + (H2(16) % 60)) { a.pose = 'stand'; a.stretchT = 2.4; act.t = 0; act.spot = null; }   // a quick stretch, then back to the desk
            return;
          }
          if (this.goTo(a, act.spot[0], act.spot[1], act.spot[2], 0.8)) { this.sit(a, act.spot); a.lookAt = school.work && school.work[0] ? [school.work[0][1] + 0.5, school.work[0][2] + 1.4, school.work[0][3] + 0.5] : null; }
          return;
        }
        case 'cafe': {
          const cafe = (vil.workOf.barista || [])[0];
          const seats = cafe && cafe.seats || [];
          if (!seats.length) { act.type = 'plaza'; return; }
          if (!act.spot) act.spot = seats[H2(17) % seats.length].slice();
          if (a.pose === 'sit') { if (Math.random() < dt * 0.05 && this.near(a, 12)) a.say(FS('cafe', H2(18), { v: vil.name }), 3); if (act.t > 60) act.done = true; return; }
          if (this.goTo(a, act.spot[0], act.spot[1], act.spot[2], 0.8)) this.sit(a, act.spot);
          return;
        }
        case 'park': {
          const park = (vil.workOf.gardener || []).find(w => w.seats && w.seats.length);
          if (!park) { act.type = 'stroll'; return; }
          if (!act.spot) act.spot = park.seats[H2(19) % park.seats.length].slice();
          if (a.pose === 'sit') { if (Math.random() < dt * 0.03 && this.near(a, 12)) a.say(FS(a.elder ? 'parkElder' : 'park', H2(21)), 3); if (act.t > 50) { act.done = true; } return; }
          if (this.goTo(a, act.spot[0], act.spot[1], act.spot[2], 0.8)) this.sit(a, act.spot);
          return;
        }
        case 'learn': {
          // kids gather by the scholar / at the library, or near a parent at work
          const lib = (vil.workOf.scholar || [])[0];
          const spot = lib && lib.work && lib.work[0] ? lib.work[0].slice(1) : (home && home.outside);
          if (!spot) { act.type = 'play'; return; }
          if (this.goTo(a, spot[0], spot[1], spot[2], 2.5)) { a.pose = 'stand'; if (Math.random() < dt * 0.05 && this.near(a, 10)) a.say(FS('library', H2(10)), 2.5); }
          return;
        }
        case 'garden': {
          const gardens = vil.workOf.gardener || [];
          const gd = gardens[a.p.fam % Math.max(1, gardens.length)];
          const spot = gd && gd.spot ? gd.spot : (P.plaza ? [P.plaza.x + 2, P.plaza.y, P.plaza.z + 2] : null);
          if (!spot) return;
          if (this.goTo(a, spot[0], spot[1], spot[2], 1.6)) {
            a.pose = 'crouch';
            if (Math.random() < dt * 1.5) g.particles.spawn(a.pos[0] + (Math.random() - 0.5), a.pos[1] + 0.8, a.pos[2] + (Math.random() - 0.5), 0, -1, 0, { life: 0.6, size: 0.05, grav: 8, col: [0.5, 0.7, 1] });
            if (act.t > 20) { act.done = true; }
          }
          return;
        }
        case 'patrol': {
          // walk between the plaza lamps and the lane ends; shoot at trouble
          if (!act.spot || act.t > 18) { act.t = 0; const lamps = P.lamps; const l = lamps[H2(11) % Math.max(1, lamps.length)] || [plaza.x, plaza.y, plaza.z]; act.spot = [l[0] + 1, l[1] - 1, l[2]]; if (Math.random() < 0.2 && this.near(a, 14)) a.say(Folk.say('patrol', H2(12)), 2.5); }
          this.goTo(a, act.spot[0], act.spot[1], act.spot[2], 2);
          return;
        }
        case 'fight': {
          const m = act.mob;
          if (!m || m.dead) { a.act = null; return; }
          const d = Math.hypot(m.pos[0] - a.pos[0], m.pos[2] - a.pos[2]);
          a.lookAt = m.pos;
          if (d > 11) this.goTo(a, Math.floor(m.pos[0]), Math.floor(m.pos[1]), Math.floor(m.pos[2]), 8);
          else { a.path = null; a.pose = 'aim'; }
          act.cool = (act.cool || 0) - dt;
          if (d < 20 && act.cool <= 0) {
            act.cool = 0.9;
            const o = [a.pos[0], a.pos[1] + 1.3, a.pos[2]], tg = [m.pos[0], m.pos[1] + m.h * 0.5, m.pos[2]];
            const dir = [tg[0] - o[0], tg[1] - o[1], tg[2] - o[2]], l = Math.hypot(dir[0], dir[1], dir[2]) || 1;
            g.entities.bolts.push({ pos: o, vel: [dir[0] / l * 42, dir[1] / l * 42, dir[2] / l * 42], dmg: 6, owner: a, life: 2, col: [0.4, 1, 0.6], friendly: true });
            if (this.near(a, 30)) g.audio.play('laser');
          }
          return;
        }
        case 'work': this.work(a, dt, tod); return;
        case 'talk': {
          if (act.t > act.len) { a.act = null; a.lookAt = null; a.pose = 'stand'; return; }
          if (act.with) a.lookAt = act.with.pos;
          a.pose = act.hug && act.t < 1.6 ? 'hug' : 'talk';
          return;
        }
      }
    }
    // a route for a stroller: a point of a village road (the light-line paths) at least 12 blocks away (the first of six
    // tries that is that far); the children roam running, an adult now and then walks with a neighbour (a pair)
    pickRoute(a, act, H2) {
      const P = a.vil.plan, roads = P.roads || [];
      let pt = null;
      for (let k = 0; k < 6 && roads.length; k++) {
        const rd = roads[H2(6 + 3 * k) % roads.length] || [];
        const c = rd.length ? rd[H2(7 + 3 * k) % rd.length] : null;
        if (!c) continue;
        pt = c;
        if (Math.hypot(c[0] - a.pos[0], c[2] - a.pos[2]) > 12) break;
      }
      if (!pt) pt = [P.plaza.x, P.plaza.y, P.plaza.z];
      act.spot = pt.slice(); act.pal = false;
      if (a.kid) act.run = true;
      else if (Math.random() < VR.Crowd.STREET.pairShare) this.pairWith(a, act);
    }
    // a neighbouring stroller (an adult within 12 blocks that is not paired yet) walks to the same point: a pair
    pairWith(a, act) {
      let best = null, bd = 144;
      for (const o of a.vil.agents) {
        if (o === a || o.kid || !o.act || o.act.type !== 'stroll' || o.act.pal) continue;
        const d = (o.pos[0] - a.pos[0]) ** 2 + (o.pos[2] - a.pos[2]) ** 2;
        if (d < bd) { bd = d; best = o; }
      }
      if (!best) return;
      act.pal = true; best.act.pal = true; best.act.spot = act.spot.slice(); best.act.rest = 0;
    }
    // the children's games: at most VR.Crowd.STREET.kids play at a time (a child who plays keeps on playing)
    kidGames(a, vil) {
      if (a.act && a.act.type === 'play') return 'play';
      return (vil.nPlay || 0) < VR.Crowd.STREET.kids ? 'play' : 'stroll';
    }
    sit(a, seat) {
      a.pose = 'sit'; a.path = null; a.vel = [0, 0, 0];
      a.pos = [seat[0] + 0.5, seat[1] + 0.05, seat[2] + 0.5];
      const f = seat[3] || 0;
      a.yaw = [0, -Math.PI / 2, Math.PI, Math.PI / 2][f];
    }
    goHome(a) { const h = a.vil.homes[a.p.home]; if (h && h.inside) this.goTo(a, h.inside[0], h.inside[1], h.inside[2], 1.2); }
    near(a, d) { const p = this.g.player.pos; return (p[0] - a.pos[0]) ** 2 + (p[2] - a.pos[2]) ** 2 < d * d; }
    famName(a) {
      const fam = a.vil.fams[a.p.fam];
      const others = fam.members.filter(m => m !== a.p);
      return others.length ? others[H(a.p.seed, (this.time / 5) | 0, 2) % others.length].name : T('g.talk.friend');
    }
    // role work
    work(a, dt, tod) {
      const act = a.act, vil = a.vil, P = vil.plan, g = this.g, w = g.world;
      const H2 = (k) => H(a.p.seed, k, (this.time / 9) | 0);
      const role = a.role;
      const spotOf = (r) => { const list = vil.workOf[r] || []; const wk = list[a.p.fam % Math.max(1, list.length)]; return wk && wk.work && wk.work.length ? wk.work[0].slice(1) : (wk && wk.inside) || null; };
      if (role === 'farmer' && P.farms.length) {
        const farm = P.farms[(a.p.fam + a.p.idx) % P.farms.length];
        if (!act.cell) {
          // look for a ripe crop (or an empty farmland to replant)
          let pick = null;
          for (let k = 0; k < 10 && !pick; k++) {
            const c = farm.cells[H2(20 + k) % farm.cells.length];
            const s = w.getBlock(c[0], c[1], c[2]); const t = R.types[R.T.type[s]];
            if (!s) { pick = { c, plant: true }; break; }
            if (t && t.has('age')) { const max = t.props[t.propIndex.age].n - 1; if (t.get(s, 'age') >= max) pick = { c, ripe: true }; }
          }
          act.cell = pick || { c: farm.cells[H2(31) % farm.cells.length], tend: true };
          act.t = 0;
        }
        const c = act.cell.c;
        if (this.goTo(a, c[0], c[1], c[2], 1.4)) {
          a.pose = 'crouch'; a.lookAt = [c[0] + 0.5, c[1], c[2] + 0.5];
          if (act.t > 2.2) {
            const s = w.getBlock(c[0], c[1], c[2]); const t = R.types[R.T.type[s]];
            if (act.cell.ripe && t && t.has('age')) { this.setBlock(c[0], c[1], c[2], t.with(s, 'age', 0)); vil.st.stats.harvest++; a.carry++; g.particles.spark(c[0] + 0.5, c[1] + 0.4, c[2] + 0.5, [0.95, 0.8, 0.3], 8, 1.5); if (this.near(a, 20) && Math.random() < 0.3) a.say(Folk.say('farm', H2(33)), 3); }
            else if (act.cell.plant && !s) { const below = w.getBlock(c[0], c[1] - 1, c[2]); const bt = R.types[R.T.type[below]]; if (bt && bt.name === 'farmland') { const ct = R.byName[farm.crop]; if (ct) this.setBlock(c[0], c[1], c[2], ct.state({ age: 0 })); } }
            else if (Math.random() < 0.5) g.particles.spawn(c[0] + 0.5, c[1] + 0.9, c[2] + 0.5, 0, -1, 0, { life: 0.6, size: 0.05, grav: 8, col: [0.5, 0.7, 1] });
            act.cell = null;
            if (a.carry >= 6) { a.carry = 0; act.deliver = true; }
          }
        }
        if (act.deliver) {
          const bake = spotOf('baker') || (vil.homes[a.p.home] && vil.homes[a.p.home].outside);
          act.cell = { c: bake, deliver: true };
          if (bake && this.goTo(a, bake[0], bake[1], bake[2], 2)) { act.deliver = false; act.cell = null; if (this.near(a, 20)) a.say(T('g.folk.basket', { crop: farm.crop === 'wheat' ? 'wheat' : farm.crop }), 3); }
        }
        return;
      }
      if (role === 'builder' || role === 'crafter') {
        const st = vil.st;
        const hasJob = (st.repairs && st.repairs.length) || st.proj || P.lots.some((l, i) => !(st.built || []).includes(i));
        if (hasJob && role === 'builder') {
          let site = null;
          if (st.repairs && st.repairs.length) site = st.repairs[0];
          else { if (!st.proj) this.buildStep(vil, false); const lot = st.proj && P.lots[st.proj.lot]; if (lot) site = lot.outside || lot.door; }
          if (site && this.goTo(a, site[0], site[1], site[2], 3.2)) {
            a.pose = 'work';
            act.acc = (act.acc || 0) + dt;
            if (act.acc > 0.85) {
              act.acc = 0;
              const r = this.buildStep(vil, false);
              if (r && r.pos) { a.lookAt = [r.pos[0] + 0.5, r.pos[1], r.pos[2] + 0.5]; g.particles.spark(r.pos[0] + 0.5, r.pos[1] + 0.5, r.pos[2] + 0.5, [1, 0.9, 0.6], 5, 1.5); if (r.state && this.near(a, 24)) g.audio.place(r.state); }
              if (r && r.repair && !r.skip && this.near(a, 20) && Math.random() < 0.4) a.say(Folk.say('repair', H2(40), { s: this.houseName(vil, r.pos[0], r.pos[2]) }), 3);
              if (r && r.done) a.say(Folk.say('build_done', H2(41), { s: vil.fams[vil.fams.length - 1].surname }), 5);
              if (!r) act.acc = -3;
              if (Math.random() < 0.02 && this.near(a, 16)) { const lot = st.proj && P.lots[st.proj.lot]; const pct = lot ? Math.round(100 * st.proj.i / lot.ops.length) : 0; a.say(pct ? T('g.folk.progress', { pct }) : Folk.say('build', H2(42), { s: T('g.vil.newHouse') }), 3); }
            }
          }
          return;
        }
        const spot = spotOf('builder') || spotOf('crafter') || (vil.homes[a.p.home] && vil.homes[a.p.home].outside);
        if (spot && this.goTo(a, spot[0], spot[1], spot[2], 1.8)) { a.pose = 'work'; if (Math.random() < dt * 0.6 && this.near(a, 20)) g.particles.spark(a.pos[0], a.pos[1] + 1, a.pos[2], [1, 0.8, 0.5], 3, 1); }
        return;
      }
      if (role === 'baker') {
        const spot = spotOf('baker');
        if (act.deliver) {
          const target = vil.homes[act.deliver - 1];
          const o = target && target.outside;
          if (!o) { act.deliver = 0; return; }
          if (this.goTo(a, o[0], o[1], o[2], 1.6)) { const fam = vil.fams.find(f => f.home === act.deliver - 1); if (this.near(a, 24)) a.say(T('g.folk.bread', { s: fam ? fam.surname : T('g.vil.neighbours') }), 3.5); vil.st.stats.bread++; act.deliver = 0; if (this.near(a, 14) && g.audio) g.audio.play('door', { at: a.pos }); }
          return;
        }
        if (spot && this.goTo(a, spot[0], spot[1], spot[2], 1.5)) {
          a.pose = 'work';
          if (Math.random() < dt * 2) g.particles.smoke(a.pos[0] + (Math.random() - 0.5), a.pos[1] + 1.4, a.pos[2] + (Math.random() - 0.5), 1);
          if (act.t > 14) { act.t = 0; act.deliver = 1 + (H2(50) % vil.homes.length); if (Math.random() < 0.4 && this.near(a, 18)) a.say(Folk.say('bake', H2(51)), 3); }
        }
        return;
      }
      if (role === 'smith') {
        const spot = spotOf('smith');
        if (spot && this.goTo(a, spot[0], spot[1], spot[2], 1.5)) {
          a.pose = 'work';
          act.acc = (act.acc || 0) + dt;
          if (act.acc > 0.55) { act.acc = 0; g.particles.spark(a.pos[0] - Math.sin(a.yaw) * 0.7, a.pos[1] + 0.9, a.pos[2] - Math.cos(a.yaw) * 0.7, [1, 0.7, 0.3], 6, 2.5, 1); if (this.near(a, 22) && g.audio.ctx) g.audio.tone(900 + Math.random() * 200, 0.05, 0.25, 'triangle', true); }
          if (Math.random() < dt * 0.04 && this.near(a, 14)) a.say(Folk.say('forge', H2(60)), 2.5);
        }
        return;
      }
      if (role === 'pilot' && P.pad) {
        const pd = P.pad;
        if (!act.spot || act.t > 14) { act.t = 0; const an = Math.random() * 6.28; act.spot = [Math.floor(pd.x + Math.cos(an) * 5), pd.y, Math.floor(pd.z + Math.sin(an) * 5)]; }
        if (this.goTo(a, act.spot[0], act.spot[1], act.spot[2], 1.5)) { a.lookAt = [pd.x, pd.y + 2, pd.z]; a.pose = 'stand'; if (Math.random() < dt * 0.03 && this.near(a, 14)) a.say(FS('pilot', H2(70)), 3); }
        return;
      }
      if (role === 'ranger') { act.type = 'patrol'; return; }
      if (role === 'gardener') { act.type = 'garden'; return; }
      if (role === 'teacher') {
        // at the front of the class: point at the board, walk the rows now and then, call on pupils by name
        const school = (vil.workOf.teacher || [])[0];
        if (school && school.work && school.work.length) {
          const wk = school.work[a.p.idx % school.work.length], spot = wk.slice(1);
          const pupils = vil.agents.filter(o => o.kid && o.act && o.act.type === 'school' && o.pose === 'sit');
          if (!act.spot || act.t > 26) { act.t = 0; act.spot = (H2(22) % 4 === 0 && pupils.length) ? [Math.floor(pupils[H2(23) % pupils.length].pos[0]), spot[1], Math.floor(pupils[H2(23) % pupils.length].pos[2]) + 1] : spot.slice(); }
          if (this.goTo(a, act.spot[0], act.spot[1], act.spot[2], 1.0)) {
            a.pose = 'talk'; const lookP = pupils[H2(24) % Math.max(1, pupils.length)]; a.lookAt = lookP ? lookP.pos : null;
            if (Math.random() < dt * 0.04 && this.near(a, 16)) a.say(pupils.length ? FS('teach', H2(29), { n: pupils[H2(25) % pupils.length].p.name, a: 3 + H2(26) % 6, b: 2 + H2(27) % 4, p: 4 + H2(28) % 30 }) : FS('teachIdle', H2(29)), 3);
          }
          return;
        }
      }
      if (role === 'worker') {
        const fac = (vil.workOf.worker || [])[0];
        if (fac && fac.work && fac.work.length) {
          const wk = fac.work[(a.p.idx + a.p.fam * 3) % fac.work.length], spot = wk.slice(1);
          if (this.goTo(a, spot[0], spot[1], spot[2], 1.1)) {
            a.pose = 'work'; act.acc = (act.acc || 0) + dt;
            if (act.acc > 0.7) { act.acc = 0; if (this.near(a, 30)) { g.particles.spark(a.pos[0] - Math.sin(a.yaw) * 0.8, a.pos[1] + 1.1, a.pos[2] - Math.cos(a.yaw) * 0.8, [0.5, 0.9, 1], 4, 2, 1); if (g.audio.ctx && Math.random() < 0.3) g.audio.tone(220 + Math.random() * 80, 0.06, 0.12, 'square', true); } }
            if (Math.random() < dt * 0.03 && this.near(a, 14)) a.say(FS('factory', H2(60)), 3);
          }
          return;
        }
      }
      if (role === 'office') {
        const off = (vil.workOf.office || [])[0];
        if (off && off.work && off.work.length) {
          const wk = off.work[(a.p.idx + a.p.fam * 2) % off.work.length], spot = wk.slice(1);
          const seat = off.seats && off.seats.find(sx => Math.abs(sx[0] - spot[0]) <= 1 && Math.abs(sx[2] - spot[2]) <= 1 && sx[1] === spot[1]);
          if (a.pose === 'sit') { if (Math.random() < dt * 0.02 && this.near(a, 12)) a.say(FS('office', H2(61)), 3); if (act.t > 120) { act.t = 0; a.pose = 'stand'; } return; }
          if (this.goTo(a, spot[0], spot[1], spot[2], 0.9)) { if (seat) this.sit(a, seat); else a.pose = 'work'; }
          return;
        }
      }
      if (role === 'barista') {
        const cafe = (vil.workOf.barista || [])[0];
        if (cafe && cafe.work && cafe.work.length) {
          const spot = cafe.work[0].slice(1);
          if (this.goTo(a, spot[0], spot[1], spot[2], 1.0)) { a.pose = 'work'; if (Math.random() < dt * 1.2 && this.near(a, 20)) g.particles.smoke(a.pos[0] + (Math.random() - 0.5) * 0.6, a.pos[1] + 1.3, a.pos[2] + (Math.random() - 0.5) * 0.6, 0.6); if (Math.random() < dt * 0.03 && this.near(a, 12)) a.say(FS('barista', H2(62)), 3); }
          return;
        }
      }
      if (role === 'operator') {
        // flight controllers work the consoles in the Starbase, glance at the holo wall, call out ship traffic
        const base = (vil.workOf.operator || [])[0], b = base && base.base;
        if (b) {
          const wk = base.work[a.p.idx % base.work.length];
          const spot = wk ? wk.slice(1) : b.inside;
          if (this.goTo(a, spot[0], spot[1], spot[2], 1.1)) {
            a.pose = 'work'; a.lookAt = [spot[0] + 0.5 - Math.sin(b.yaw + Math.PI) * 3, spot[1] + 1.8, spot[2] + 0.5 - Math.cos(b.yaw + Math.PI) * 3];
            if (Math.random() < dt * 0.03 && this.near(a, 14)) a.say(FS('control', H2(90)), 3);
          }
          return;
        }
      }
      if (role === 'cashier' || role === 'clerk') {
        const shop = (vil.workOf.cashier || [])[0], sh = shop && shop.shop;
        if (sh) {
          if (role === 'cashier') {
            const till = sh.tills[a.p.idx % sh.tills.length];
            if (this.goTo(a, till.cashier[0], till.cashier[1], till.cashier[2], 0.8)) { a.pose = 'stand'; a.lookAt = [till.lane[0] + 0.5, till.lane[1] + 1.5, till.lane[2] + 0.5]; if (Math.random() < dt * 0.02 && this.near(a, 12)) a.say(FS('cashier', H2(91)), 3); }
          } else {
            if (!act.spot || act.t > 22) { act.t = 0; const c = sh.box; act.spot = [c[0] + 1 + (H2(92) % Math.max(1, c[3] - c[0] - 2)), c[1], c[2] + 1 + (H2(93) % Math.max(1, c[5] - c[2] - 2))]; }
            if (this.goTo(a, act.spot[0], act.spot[1], act.spot[2], 1.4)) { a.pose = 'work'; if (Math.random() < dt * 0.02 && this.near(a, 12)) a.say(FS('clerk', H2(94)), 3); }
          }
          return;
        }
      }
      // scholar, healer, mayor… stand at their workplace, sometimes visit the plaza
      const spot = spotOf(role);
      const tgt = spot && (H2(80) % 3) ? spot : [P.plaza.x + 1, P.plaza.y, P.plaza.z - 2];
      if (this.goTo(a, tgt[0], tgt[1], tgt[2], 1.8)) {
        a.pose = role === 'scholar' ? 'read' : 'stand';
        if (act.t > 30) act.done = true;
        if (role === 'healer' && g.player.health < 12 && this.near(a, 8) && !act.healed) { act.healed = true; a.say(T('g.folk.heal'), 4); g.player.heal(8); g.particles.spark(g.player.pos[0], g.player.pos[1] + 1, g.player.pos[2], [0.4, 1, 0.5], 16, 2, 1); }
        if (Math.random() < dt * 0.03 && this.near(a, 14)) a.say(Folk.say(role === 'scholar' ? 'read' : 'friends', H2(81), { n: this.g.playerName || T('g.talk.friend'), fact: this.fact(vil) }), 3);
      }
    }
    fact(vil) {
      const s = vil.st.stats, P = vil.plan;
      const facts = [];
      if (s.harvest) facts.push(T('g.fact.harvest', { n: s.harvest }));
      if (s.bread) facts.push(T('g.fact.bread', { n: s.bread }));
      if (vil.st.proj) { const lot = P.lots[vil.st.proj.lot]; if (lot) facts.push(T('g.fact.house', { pct: Math.round(100 * vil.st.proj.i / lot.ops.length) })); }
      if (vil.st.rep > 4) facts.push(T('g.fact.traveler'));
      facts.push(...TL('g.fact.more'));
      return facts[(this.time | 0) % facts.length];
    }
    // chance meetings: family hugs, friends chatting
    social(a, dt, tod) {
      if (a.talkCool > 0 || !a.act || a.pose === 'sleep') return;
      const t = a.act.type;
      if (t === 'fight' || t === 'hide' || t === 'talk' || t === 'sleep' || t === 'outing' || a.inBoat || (t === 'play' && Math.random() < 0.9) || (t === 'work' && a.role !== 'farmer' && Math.random() < 0.7)) { a.talkCool = 3; return; }
      a.talkCool = 2 + Math.random() * 3;
      let best = null, bd = 3.2 * 3.2;
      for (const o of a.vil.agents) {
        if (o === a || o.talkCool > 0 || !o.act || o.pose === 'sleep' || o.act.type === 'talk' || o.act.type === 'outing' || o.inBoat) continue;
        const d = (o.pos[0] - a.pos[0]) ** 2 + (o.pos[2] - a.pos[2]) ** 2;
        if (d < bd && Math.abs(o.pos[1] - a.pos[1]) < 1.5) { bd = d; best = o; }
      }
      if (!best || Math.random() < 0.45) return;
      const fam = best.p.fam === a.p.fam;
      const len = 4 + Math.random() * 3;
      const hug = fam && Math.random() < 0.5;
      const saved = [a.act, best.act];
      a.act = { type: 'talk', with: best, t: 0, len, hug, resume: saved[0] };
      best.act = { type: 'talk', with: a, t: 0, len, hug, resume: saved[1] };
      a.path = null; best.path = null;
      a.talkCool = best.talkCool = 18 + Math.random() * 20;
      const vars = { n: best.p.name, fact: this.fact(a.vil) };
      let l1, l2;
      if (fam && a.kid && !best.kid) { l1 = Folk.say('kidParent', H(a.p.seed, this.time | 0, 1)); l2 = Folk.say('parentKid', H(best.p.seed, this.time | 0, 2), { n: a.p.name }); }
      else if (fam && !a.kid && best.kid) { l1 = Folk.say('parentKid', H(a.p.seed, this.time | 0, 3), { n: best.p.name }); l2 = Folk.say('kidParent', H(best.p.seed, this.time | 0, 4)); }
      else if (fam) { l1 = Folk.say(tod < 2000 || tod > 23000 ? 'morning' : 'family', H(a.p.seed, this.time | 0, 5), vars); l2 = Folk.say('family', H(best.p.seed, this.time | 0, 6), { n: a.p.name }); }
      else if (this.g.env.rain > 0.3) { l1 = Folk.say('rain', H(a.p.seed, this.time | 0, 7)); l2 = Folk.say('friends', H(best.p.seed, this.time | 0, 8), { n: a.p.name, fact: vars.fact }); }
      else { l1 = Folk.say('friends', H(a.p.seed, this.time | 0, 9), vars); l2 = Folk.say('friends', H(best.p.seed, this.time | 0, 10), { n: a.p.name, fact: vars.fact }); }
      if (this.near(a, 22)) {
        a.say(l1, 3);
        setTimeout(() => { if (best.act && best.act.type === 'talk') best.say(l2, 3); }, 1400);
        if (hug) for (let k = 0; k < 5; k++) this.g.particles.glow((a.pos[0] + best.pos[0]) / 2 + (Math.random() - 0.5) * 0.6, a.pos[1] + 1.6 + Math.random() * 0.5, (a.pos[2] + best.pos[2]) / 2 + (Math.random() - 0.5) * 0.6, [1, 0.35, 0.55], 1.6, 0.09, 0.6);
      }
    }

    // -------------------------------------------------- player interaction
    ray(o, d, maxD) {
      let best = null, bt = maxD;
      const b = this._rayBox || (this._rayBox = [0, 0, 0, 0, 0, 0]), M2 = (maxD + 2) * (maxD + 2);
      for (const a of this.agents) {
        if ((a.pos[0] - o[0]) ** 2 + (a.pos[2] - o[2]) ** 2 > M2) continue;   // (out of the ray's reach: no box test, no box made)
        b[0] = -a.w - 0.08; b[1] = 0; b[2] = -a.w - 0.08; b[3] = a.w + 0.08; b[4] = a.h + 0.1; b[5] = a.w + 0.08;
        const r = PH.rayBox(o[0], o[1], o[2], d[0], d[1], d[2], b, a.pos[0], a.pos[1], a.pos[2]);
        if (r && r[0] < bt) { bt = r[0]; best = a; }
      }
      return best ? { ent: best, dist: bt } : null;
    }
    blocks(x, y, z) {
      for (const a of this.agents) if (a.pos[0] + a.w > x && a.pos[0] - a.w < x + 1 && a.pos[2] + a.w > z && a.pos[2] - a.w < z + 1 && a.pos[1] + a.h > y && a.pos[1] < y + 1) return true;
      return false;
    }
    onHit(a, from) {
      const g = this.g;
      a.hurt = 0.4;
      if (from) { const dx = a.pos[0] - from[0], dz = a.pos[2] - from[2], l = Math.hypot(dx, dz) || 1; a.vel[0] += dx / l * 5; a.vel[2] += dz / l * 5; a.vel[1] = 4.5; }
      if (a.pose === 'sleep' || a.pose === 'sit') this.wake(a);
      a.say(Folk.say('hurt', H(a.p.seed, this.time | 0, 13)), 3);
      g.audio.play('hurt', { at: a.pos });
      a.vil.st.rep = Math.max(-20, (a.vil.st.rep || 0) - 2);
      const fam = a.vil.agents.find(o => o !== a && o.p.fam === a.p.fam && !o.kid && Math.hypot(o.pos[0] - a.pos[0], o.pos[2] - a.pos[2]) < 16);
      if (fam) setTimeout(() => fam.say(T('g.folk.leaveAlone', { n: a.p.name }), 3), 900);
    }
    chirp(a) {
      const g = this.g;
      if (!g.audio || !g.audio.ctx || !this.near(a, 16)) return;
      const au = g.audio, t = au.ctx.currentTime;
      const base = a.kid ? 620 : a.elder ? 260 : 360 + (a.p.seed % 7) * 30;
      const n = 2 + (a.p.seed % 3);
      for (let k = 0; k < n; k++) au.tone(base * (1 + ((a.p.seed >> k) & 3) * 0.12), 0.035, 0.07, 'triangle', false, t + k * 0.075);
    }

    // -------------------------------------------------- talk panel
    openTalk(a) {
      const g = this.g, ui = g.ui;
      this.talking = a;
      const vil = a.vil, st = vil.st;
      a.lookAt = g.player.pos; a.path = null;
      if (a.pose === 'sleep') { this.wake(a); a.act = null; }
      const met = st.met || (st.met = []);
      const first = !met.includes(a.p.id);
      if (first) { met.push(a.p.id); st.rep = (st.rep || 0) + 1; if (g.codex && g.codex.event) g.codex.event('villager'); }
      ui.show('talk');
      this.drawFace($('#tk_face'), a.p.look);
      const fam = vil.fams[a.p.fam];
      $('#tk_name').innerHTML = `<b>${esc(a.name)}</b>${a.p.years ? ` <span class="note">· ${esc(T('g.talk.years', { n: a.p.years }))}</span>` : ''}`;
      const rel = fam.members.filter(m => m !== a.p).map(m => `${esc(m.name)} <span class="note">(${esc(T('g.rel.' + this.relation(a.p, m)))})</span>`).join(', ');
      $('#tk_role').innerHTML = esc(T('g.talk.role', { role: Folk.roleTitle(a.role), v: vil.name, trait: T('g.trait.' + a.p.trait, null, a.p.trait), likes: T('g.likes.' + a.p.likes, null, a.p.likes) })) + (rel ? '<br>' + T('g.talk.family', { list: rel }) : '');
      this.renderRep();
      const pname = g.playerName || T('g.talk.traveler');
      const tod = g.env.timeOfDay;
      let hello;
      if (st.rep < -4) hello = T('g.talk.grumpy');
      else if (first) hello = T(a.kid ? 'g.talk.firstKid' : 'g.talk.first', { n: a.p.name, v: vil.name });
      else hello = Folk.say('helloBack', H(a.p.seed, this.time | 0, 20), { p: pname });
      if (tod >= 13000 && tod < 23300 && !first) hello = T('g.talk.sleepy', { s: hello });
      this.talkText(hello);
      this.talkOptions(a);
      this.chirp(a);
    }
    relation(me, other) {
      if (me.age === 'child' && other.age === 'adult') return 'parent';
      if (me.age === 'child' && other.age === 'child') return 'sibling';
      if (me.age === 'child' && other.age === 'elder') return 'grandparent';
      if (me.age === 'adult' && other.age === 'adult') return 'partner';
      if (me.age === 'adult' && other.age === 'child') return 'child';
      if (me.age === 'adult' && other.age === 'elder') return 'parent';
      if (me.age === 'elder' && other.age === 'elder') return 'partner';
      if (me.age === 'elder') return other.age === 'child' ? 'grandchild' : 'child';
      return 'family';
    }
    renderRep() {
      const a = this.talking; if (!a) return;
      const r = a.vil.st.rep || 0;
      const hearts = Math.max(0, Math.min(10, Math.round(r / 2)));
      $('#tk_rep').innerHTML = `<span style="color:#ff6a8a">${'♥'.repeat(hearts)}</span><span style="color:#44303a">${'♥'.repeat(10 - hearts)}</span> <span class="note">${esc(T('g.talk.rep'))}</span>`;
    }
    talkText(s) { const el = $('#tk_text'); el.textContent = s; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
    talkOptions(a) {
      const box = $('#tk_opts'); box.innerHTML = '';
      const add = (label, fn) => { const b = document.createElement('button'); b.className = 'btn small'; b.textContent = label; b.onclick = () => { this.chirp(a); fn(); }; box.appendChild(b); };
      add(T('g.talk.how'), () => this.talkText(this.chatLine(a)));
      add(T('g.talk.about', { v: a.vil.name }), () => this.talkText(this.aboutVillage(a)));
      add(T('g.talk.help'), () => this.talkText(this.quest(a)));
      if (!a.kid) add(T('g.talk.trade'), () => this.showTrade(a));
      add(T('g.talk.give'), () => this.gift(a));
      if (a.role === 'pilot' && a.vil.plan.pad && this.g.starships) add(T('g.talk.fly'), () => this.rideMenu(a));
      add(T('g.talk.bye'), () => this.closeTalk());
    }
    // the village pilot lends you the shuttle, with the autopilot set for another village
    padShip(vil) {
      const pd = vil.plan.pad, S = this.g.starships; if (!pd || !S) return null;
      return S.ships.find(s => s.state === 'parked' && s.d.meta && Math.hypot(s.pos[0] - pd.x, s.pos[2] - pd.z) < 9 && Math.abs(s.pos[1] - pd.y) < 6) || null;
    }
    rideMenu(a) {
      const vil = a.vil, g = this.g, box = $('#tk_opts');
      const ship = this.padShip(vil);
      if (!ship) { this.talkText(T('g.talk.shuttleOut')); return; }
      const p = g.player.pos;
      const list = this.sites.filter(s2 => s2.id !== vil.id && Math.hypot(s2.x - p[0], s2.z - p[2]) > 140).sort((x, y) => Math.hypot(x.x - p[0], x.z - p[2]) - Math.hypot(y.x - p[0], y.z - p[2])).slice(0, 4);
      if (!list.length) { this.talkText(T('g.talk.noVillage')); return; }
      this.talkText(T('g.talk.whereTo', { ship: ship.d.meta.name }));
      box.innerHTML = '';
      const add = (label, fn) => { const b = document.createElement('button'); b.className = 'btn small'; b.textContent = label; b.onclick = () => { this.chirp(a); fn(); }; box.appendChild(b); };
      for (const site of list) {
        const d = Math.hypot(site.x - p[0], site.z - p[2]);
        add(`${site.name} · ${(d / 1000).toFixed(1)} km ${this.compass(site.x - p[0], site.z - p[2])}`, () => {
          const S = g.starships;
          this.closeTalk();
          a.say(T('g.folk.hopIn', { s: site.name }), 4);
          if (!ship.d.meta || S.pilot || (g.gadgets && g.gadgets.riding)) return;
          S.board(ship, g.player);
          if (S.pilot === ship) { g.camMode = 0; S.startAuto(site); }
        });
      }
      add(T('g.btn.back'), () => this.talkOptions(a));
    }
    closeTalk() { const a = this.talking; this.talking = null; if (a) { a.lookAt = null; a.say(FS('bye', a.p.seed), 2.5); } this.g.ui.resume(); }
    chatLine(a) {
      const vil = a.vil, fam = vil.fams[a.p.fam], g = this.g;
      const kids = fam.members.filter(m => m.age === 'child' && m !== a.p);
      const partner = fam.members.find(m => m !== a.p && this.relation(a.p, m) === 'partner');
      const h = H(a.p.seed, (this.time / 3) | 0, 30);
      const opts = [];
      if (kids.length) opts.push(T('g.talk.kidNews', { kid: kids[h % kids.length].name, what: pickL('g.talk.kidDoing', h) }));
      if (partner) opts.push(T('g.talk.partnerNews', { p: partner.name, what: pickL('g.talk.partnerDoing', h) }));
      if (a.kid) { const ks = TL('g.talk.kidSays'), last = vil.workOf.teacher ? T('g.talk.kidTeacher', { who: pickL('g.talk.who', vil.workOf.teacher[0] ? 0 : 1), what: pickL('g.talk.moons', h) }) : T('g.talk.kidAge', { y: a.p.years }); opts.push([...ks, last][h % (ks.length + 1)]); }
      if (a.elder) opts.push(pickL('g.talk.elderSays', h).replace('{y}', a.p.years));
      const R = TL('g.talk.r.' + a.role);
      if (R.length) opts.push(R[h % R.length]);
      const tod = g.env.timeOfDay;
      opts.push(T(tod < 900 || tod >= 23300 ? 'g.talk.early' : tod < 5600 ? (a.kid ? 'g.talk.morningKid' : 'g.talk.morning') : tod < 6900 ? 'g.talk.lunch' : tod < 10600 ? 'g.talk.afternoon' : 'g.talk.evening'));
      if (g.env.rain > 0.3) opts.push(Folk.say('rain', h));
      opts.push(T('g.talk.mood', { mood: pickL('g.talk.moods', h), more: T(a.p.likes === 'stars' ? 'g.talk.likeStars' : a.p.likes === 'starships' ? 'g.talk.likeShips' : a.p.likes === 'bread' ? 'g.talk.likeBread' : 'g.talk.likeLife') }));
      if (vil.st.proj) { const lot = vil.plan.lots[vil.st.proj.lot]; if (lot) opts.push(T('g.talk.builders', { pct: Math.round(100 * vil.st.proj.i / lot.ops.length) })); }
      vil.st.rep = (vil.st.rep || 0) + (Math.random() < 0.25 ? 1 : 0);
      this.renderRep();
      return opts[h % opts.length];
    }
    aboutVillage(a) {
      const vil = a.vil, g = this.g;
      const pop = vil.people.length;
      let s = T('g.talk.aboutHome', { v: vil.name, pop, fams: vil.fams.length, years: vil.st.founded });
      s += vil.st.built && vil.st.built.length ? (vil.st.built.length > 1 ? T('g.talk.aboutBuiltN', { n: vil.st.built.length }) : T('g.talk.aboutBuilt1')) : '.';
      // point the traveler somewhere interesting (outpost / another village) and mark it
      const p = g.player.pos;
      const other = this.sites.filter(s2 => s2.id !== vil.id).sort((x, y) => ((x.x - p[0]) ** 2 + (x.z - p[2]) ** 2) - ((y.x - p[0]) ** 2 + (y.z - p[2]) ** 2))[0];
      if (other) {
        const d = Math.round(Math.hypot(other.x - p[0], other.z - p[2]));
        const dir = this.compass(other.x - p[0], other.z - p[2]);
        s += T('g.talk.cousins', { name: other.name, d, dir });
        if (g.gadgets && g.gadgets.addWaypoint) { try { g.gadgets.addWaypoint(other.name, [other.x, other.y + 2, other.z]); } catch (e) { void e; } }
      }
      return s;
    }
    compass(dx, dz) { const a = Math.atan2(dx, -dz); const names = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']; return T('g.dir.' + names[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8]); }
    // quests: small, role-flavoured requests
    quest(a) {
      const st = a.vil.st, q = st.quests || (st.quests = {});
      const cur = q[a.p.id];
      if (cur && !cur.done) return T('g.quest.still', { n: cur.n, item: VR.itemName ? VR.itemName(cur.id) : cur.id });
      // the requests: [item, count]; the words are g.quest.<role>
      const Q = {
        farmer: ['bone_meal', 8], baker: ['wheat', 12], smith: ['iron_ingot', 6], builder: ['oak_planks', 32], scholar: ['paper', 6], healer: ['honey_bottle', 2], mayor: ['lantern', 4],
        ranger: ['energy_cell', 2], pilot: ['energy_cell', 3], gardener: ['poppy', 6], child: ['cookie', 3], elder: ['book', 1], crafter: ['string', 8],
      };
      const role = Q[a.role] ? a.role : 'gardener', d = Q[role];
      if (!VR.itemDef(d[0]) && !R.byName[d[0]]) return T('g.quest.fine');
      q[a.p.id] = { id: d[0], n: d[1], done: false };
      return T('g.quest.' + role) + T('g.quest.hold');
    }
    gift(a) {
      const g = this.g, p = g.player, h = p.inv.held;
      const st = a.vil.st;
      if (!h) { this.talkText(T('g.gift.empty')); return; }
      const q = st.quests && st.quests[a.p.id];
      const name = VR.itemName ? VR.itemName(h.id) : h.id;
      if (q && !q.done && h.id === q.id) {
        const have = p.inv.count(q.id);
        if (have < q.n) { this.talkText(T('g.gift.short', { have, n: q.n })); return; }
        p.inv.remove(q.id, q.n); q.done = true;
        st.rep = (st.rep || 0) + 4;
        const rewards = [['emerald', 6], ['cake', 1], ['vx_crystal_violet', 2], ['golden_apple', 1], ['vx_window_shutter_green', 8], ['vx_lamppost', 4], ['shuttle_beacon', 1]];
        const rw = rewards[H(a.p.seed, 77, 1) % rewards.length];
        const ok = VR.itemDef(rw[0]) || R.byName[rw[0]];
        if (ok) p.inv.add(rw[0], rw[1]); else p.inv.add('emerald', 5);
        this.talkText(T('g.gift.done', { n: rw[1], item: VR.itemName ? VR.itemName(rw[0]) : rw[0] }));
        g.audio.play('levelup'); this.hearts(a); this.renderRep();
        if (g.codex && g.codex.event) g.codex.event('quest');
        return;
      }
      p.inv.consumeHeld(1);
      const def = VR.itemDef(h.id);
      const loved = (a.p.likes === 'bread' && /bread|cake|cookie|pie/.test(h.id)) || (a.p.likes === 'flowers' && /poppy|dandelion|tulip|orchid|allium|bluet|daisy|rose|lily|flower/.test(h.id)) || (a.p.likes === 'crystals' && /crystal|shard|amethyst/.test(h.id)) || (a.p.likes === 'books' && /book|paper/.test(h.id)) || (a.p.likes === 'stars' && /star|glow/.test(h.id));
      const food = def && def.food;
      st.rep = (st.rep || 0) + (loved ? 3 : food ? 2 : 1);
      this.talkText(loved ? T('g.gift.love', { item: name, likes: T('g.likes.' + a.p.likes, null, a.p.likes) }) : Folk.say('thanks', H(a.p.seed, this.time | 0, 41)));
      this.hearts(a); this.renderRep();
      g.audio.play('pop');
    }
    hearts(a) { for (let k = 0; k < 10; k++) this.g.particles.glow(a.pos[0] + (Math.random() - 0.5) * 0.8, a.pos[1] + a.h + Math.random() * 0.6, a.pos[2] + (Math.random() - 0.5) * 0.8, [1, 0.35, 0.55], 1.8, 0.1, 0.8); }
    showTrade(a) {
      const g = this.g, p = g.player;
      const T = {
        farmer: [[['wheat', 20], ['emerald', 1]], [['emerald', 1], ['bread', 4]], [['emerald', 1], ['carrot', 6]], [['emerald', 2], ['pumpkin_pie', 3]]],
        baker: [[['emerald', 1], ['bread', 5]], [['emerald', 3], ['cake', 1]], [['emerald', 1], ['cookie', 8]], [['wheat', 15], ['emerald', 1]]],
        smith: [[['iron_ingot', 4], ['emerald', 1]], [['emerald', 4], ['iron_pickaxe', 1]], [['emerald', 10], ['diamond_pickaxe', 1]], [['coal', 15], ['emerald', 1]]],
        builder: [[['emerald', 1], ['vx_plaster_white', 16]], [['emerald', 1], ['vx_roof_red', 16]], [['emerald', 1], ['vx_window_shutter_green', 6]], [['emerald', 2], ['vx_lamppost', 4]], [['emerald', 3], ['builder_wand', 1]]],
        scholar: [[['emerald', 1], ['book', 2]], [['paper', 12], ['emerald', 1]], [['emerald', 2], ['compass', 1]], [['emerald', 3], ['spyglass', 1]]],
        healer: [[['emerald', 1], ['golden_apple', 1]], [['emerald', 1], ['honey_bottle', 2]], [['sweet_berries', 12], ['emerald', 1]]],
        ranger: [[['emerald', 2], ['energy_cell', 3]], [['emerald', 8], ['laser_blaster', 1]], [['emerald', 5], ['jetpack', 1]]],
        pilot: [[['emerald', 6], ['hoverbike', 1]], [['emerald', 12], ['shuttle_beacon', 1]], [['energy_cell', 4], ['emerald', 2]]],
        gardener: [[['emerald', 1], ['vx_planter', 4]], [['emerald', 1], ['vx_potplant', 4]], [['emerald', 1], ['cherry_sapling', 2]], [['emerald', 2], ['vx_crystal_azure', 2]]],
        mayor: [[['emerald', 4], ['vx_lamppost_crystal', 4]], [['emerald', 2], ['vx_bench', 4]], [['emerald', 3], ['vx_well', 1]]],
        crafter: [[['emerald', 1], ['vx_bed_red', 1]], [['emerald', 1], ['vx_table', 2]], [['emerald', 1], ['vx_chair', 4]], [['emerald', 1], ['vx_shelf', 2]], [['emerald', 1], ['vx_rug_blue', 4]]],
        elder: [[['emerald', 1], ['vx_hay', 4]], [['emerald', 2], ['vx_barrel', 4]]],
      };
      const offers = (T[a.role] || T.farmer).filter(o => (VR.itemDef(o[0][0]) || R.byName[o[0][0]]) && (VR.itemDef(o[1][0]) || R.byName[o[1][0]]));
      const box = $('#tk_opts'); box.innerHTML = '';
      const nm = (id) => VR.itemName ? VR.itemName(id) : id;
      this.talkText(T('g.trade.offer', { n: p.inv.count('emerald'), emeralds: T(p.inv.count('emerald') === 1 ? 'g.trade.emerald1' : 'g.trade.emeraldN') }));
      for (const [give, get] of offers) {
        const b = document.createElement('button'); b.className = 'btn small tktrade';
        const can = p.inv.count(give[0]) >= give[1] || p.mode !== 'survival';
        b.innerHTML = `<canvas width="32" height="32"></canvas> ${give[1]} × ${esc(nm(give[0]))} → <canvas width="32" height="32"></canvas> ${get[1]} × ${esc(nm(get[0]))}`;
        const cvs = b.querySelectorAll('canvas');
        try { g.icons.paint(cvs[0], give[0], 32); g.icons.paint(cvs[1], get[0], 32); } catch (e) { void e; }
        b.disabled = !can;
        b.onclick = () => {
          if (p.mode === 'survival') { if (p.inv.count(give[0]) < give[1]) return; p.inv.remove(give[0], give[1]); }
          const got = p.inv.add(get[0], get[1]);
          if (got < get[1]) g.dropStack({ id: get[0], n: get[1] - got }, false, [p.pos[0], p.pos[1] + 1, p.pos[2]]);
          a.vil.st.rep = (a.vil.st.rep || 0) + 1;
          g.audio.play('pop'); this.renderRep();
          this.talkText(pickL('g.trade.thanks', H(a.p.seed, this.time | 0, 9)));
          this.showTrade(a);
        };
        box.appendChild(b);
      }
      const back = document.createElement('button'); back.className = 'btn small'; back.textContent = T('g.btn.back'); back.onclick = () => this.talkOptions(a); box.appendChild(back);
    }
    drawFace(cv, L) {
      const x = cv.getContext('2d'); const s = 10;
      x.clearRect(0, 0, cv.width, cv.height);
      const hex = (c) => '#' + ('000000' + c.toString(16)).slice(-6);
      const px = (i, j, c) => { x.fillStyle = hex(c); x.fillRect(8 + i * s, 8 + j * s, s, s); };
      for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) px(i, j, L.skin);
      const hc = L.hair;
      if (L.hs !== 'bald') { for (let i = 0; i < 8; i++) { px(i, 0, hc); if (i < 2 || i > 5 || (i & 1)) px(i, 1, hc); } px(0, 2, hc); px(7, 2, hc); if (L.hs === 'long' || L.hs === 'bob' || L.hs === 'braids') for (let j = 2; j < 7; j++) { px(0, j, hc); px(7, j, hc); } }
      const dk = (c, k) => ((Math.min(255, ((c >> 16) & 255) * k) << 16) | (Math.min(255, ((c >> 8) & 255) * k) << 8) | Math.min(255, (c & 255) * k)) >>> 0;
      px(1, 4, 0xffffff); px(2, 4, L.eye); px(5, 4, L.eye); px(6, 4, 0xffffff);
      px(1, 3, dk(hc, 0.85)); px(2, 3, dk(hc, 0.85)); px(5, 3, dk(hc, 0.85)); px(6, 3, dk(hc, 0.85));
      px(3, 5, dk(L.skin, 0.88)); px(4, 5, dk(L.skin, 0.88));
      px(3, 6, 0xB0485A); px(4, 6, 0xB0485A); px(2, 6, dk(L.skin, 0.85)); px(5, 6, dk(L.skin, 0.85));
      if (L.age === 'child' || L.freckles) { px(1, 5, 0xF09A9A); px(6, 5, 0xF09A9A); }
      if (L.beard) for (let i = 1; i < 7; i++) px(i, 7, hc);
      x.strokeStyle = 'rgba(255,255,255,.25)'; x.strokeRect(7.5, 7.5, 81, 81);
    }

    // -------------------------------------------------- rendering
    // who is drawn this frame — the street's budget (src/shared/folkcrowd.js): of the people within the folk distance and
    // in view, the nearest streetCap of those on the street (on the way in counts), and whoever has arrived indoors; the
    // others wait out of sight (they keep walking, so nobody pops in on the spot). Marks a.vis, a.street, a.d2v and
    // a.drawn: update() and separate() simulate a person nobody sees at the far rate (t-town: a hall city's 149 people)
    pick(planes, cam, cap, FD) {
      const C = VR.Crowd, near = this._near || (this._near = new Float64Array(16));
      const pc = this._pickCam || (this._pickCam = { x: 0, y: 0, z: 0, FD: 0 });
      pc.x = cam.x; pc.y = cam.y; pc.z = cam.z; pc.FD = FD; this._pickPlanes = planes;
      let nn = 0;
      for (const a of this.agents) {
        const dx = a.pos[0] - cam.x, dy = a.pos[1] - cam.y, dz = a.pos[2] - cam.z;
        const d2 = dx * dx + dz * dz;
        a.vis = false; a.drawn = false;
        if (d2 > FD * FD) continue;
        if (!VR.mat4.boxInFrustum(planes, dx - 2, dy - 1, dz - 2, dx + 2, dy + 3, dz + 2)) continue;
        a.vis = true; a.d2v = d2;
        a.street = C.onStreet(a);
        if (a.street) nn = C.keepNearest(near, nn, cap, d2);
      }
      const thr = nn >= cap ? near[cap - 1] : Infinity;
      for (const a of this.agents) if (a.vis) a.drawn = !(a.street && a.d2v > thr);
    }
    draw(r, E, cam) {
      if (!this.agents.length) return;
      const g = this.g, gl = r.gl, ent = g.entities;
      if (!ent) return;
      const p = ent.beginVox(r, E);
      const t = g.time;
      const C = VR.Crowd, FD = g.folkDist || g.folkBase || 100, cap = C.streetCap(g.settings && g.settings.preset);
      this.pick(r.planes, cam, cap, FD);
      for (const a of this.agents) {
        if (!a.drawn) continue;
        const d2 = a.d2v, dy = a.pos[1] - cam.y;
        const far = d2 > (FD < 100 ? 16 : 24) * (FD < 100 ? 16 : 24);
        // the model is looked up once per agent and LOD (the key is built from the look only once)
        const mk = far ? 1 : 0;
        const model = a.mdl && a.mdl[mk] ? a.mdl[mk] : ((a.mdl = a.mdl || [null, null])[mk] = Folk.model(gl, a.p.look, far));
        if (!model) continue;
        const light = ent.lightAt(a.pos[0], a.pos[1] + 1.2, a.pos[2]);
        // the budget (src/shared/folkcrowd.js): a villager far from the eye is posed every 2nd, 4th or 8th frame; between two its last pose holds
        const pose = (!VR.Crowd || VR.Crowd.due(a, d2) || !a.poseOut) ? this.pose(a, t) : a.poseOut;
        const sleeping = a.pose === 'sleep';
        if (a.shadeT === undefined || t - a.shadeT > 0.25) { a.shade = ent.sunShade(a.pos, 1.2); a.shadeT = t; }   // terrain-shadow ray only 4× a second per villager
        const opts = { flash: a.hurt > 0.2 ? 1 : 0, scale: a.kid ? 0.82 : 1, shade: a.shade, hide: { lids: far || !(a.blinkOn || sleeping || a.eyesClosed), mouth: far || !a.mouthOn } };
        let pos = a.pos;
        if (sleeping) { opts.pitch = Math.PI / 2; pos = [a.pos[0] - VR.HF_DX[a.p.bed ? a.p.bed[3] : 0] * 0.85, a.pos[1] + 0.12, a.pos[2] - VR.HF_DZ[a.p.bed ? a.p.bed[3] : 0] * 0.85]; }
        else if (a.pose === 'sit') pos = [a.pos[0], a.pos[1] - (a.kid ? 0.2 : 0.3), a.pos[2]];
        else if (a.pose === 'sitground') pos = [a.pos[0], a.pos[1] - (a.kid ? 0.26 : 0.6), a.pos[2]];
        else if (a.pose === 'crouch') pos = [a.pos[0], a.pos[1] - (a.kid ? 0.14 : 0.24), a.pos[2]];
        if (a.drawOffY) pos = [pos[0], pos[1] + a.drawOffY, pos[2]];
        ent.drawModel(r, p, model, pos, cam, a.yaw, pose, light, opts);
      }
      if (this.drawBoats) this.drawBoats(r, E, cam);
    }
    // the body pose: FolkAnim clips (crossfaded) under the parametric walk cycle, then the head look-at, blinking and
    // the talking mouth layered on top. [rx, ry, rz, ox, oy, oz] per joint; +X swings a limb forward (models face -z)
    pose(a, t) {
      const dt = Math.min(0.5, t - (a.poseT || t)); a.poseT = t;   // (0.5: a far villager waits a few frames for its pose, see folkcrowd.js)
      const FA = VR.FolkAnim;
      const run = !!(a.act && a.act.run) || (a.kid && a.act && a.act.type === 'play');
      const wa = a.walkAmt, ph = a.walk * 3;
      let state = 'idle';
      switch (a.pose) { case 'sit': case 'sitground': case 'sleep': case 'work': case 'crouch': case 'read': case 'aim': case 'hug': case 'talk': state = a.pose; break; }
      if (a.act && a.act.type === 'play' && a.pose !== 'sit' && (wa > 0.4 || a.act.game === 'hop')) state = 'cheer';   // children at play cheer while they run and hop
      if (a.stretchT > 0) { a.stretchT -= dt; state = 'stretch'; }
      if (a.waveT > 0) { a.waveT -= dt; state = 'wave'; }                                                               // wave when the player comes close
      if (a.dance) state = 'dance';
      const P = FA.pose(a, state, dt, ph, wa, run, a.poseOut || (a.poseOut = {}));
      // head: look at the target (or the player close by), otherwise glance around now and then
      let hy = 0, hp = 0;
      const pl = this.g.player.pos;
      const dP = (pl[0] - a.pos[0]) ** 2 + (pl[2] - a.pos[2]) ** 2;
      const look = a.lookAt || (dP < 36 && a.pose !== 'sleep' ? [pl[0], pl[1] + 1.5, pl[2]] : null);
      if (look) {
        const dx = look[0] - a.pos[0], dz = look[2] - a.pos[2];
        let yy = Math.atan2(-dx, -dz) - a.yaw; while (yy > Math.PI) yy -= Math.PI * 2; while (yy < -Math.PI) yy += Math.PI * 2;
        hy = Math.max(-1.1, Math.min(1.1, yy));
        hp = Math.max(-0.5, Math.min(0.5, Math.atan2((look[1] || a.pos[1] + 1.5) - (a.pos[1] + (a.kid ? 1 : 1.55)), Math.hypot(dx, dz)) * 0.8));
      } else {
        a.glanceT = (a.glanceT || 0) - dt;
        if (a.glanceT <= 0) { a.glanceT = 2 + Math.random() * 4; a.glance = wa > 0.5 ? 0 : (Math.random() - 0.5) * 1.1; a.glanceP = (Math.random() - 0.4) * 0.3; }
        hy = a.glance || 0; hp = a.glanceP || 0;
      }
      const k = Math.min(1, dt * 7);
      a.headYaw += (hy - a.headYaw) * k; a.headPitch += (hp - a.headPitch) * k;
      P.head[0] += a.headPitch + (a.bubble ? Math.sin(t * 7) * 0.04 : 0); P.head[1] += a.headYaw;
      // blinking and a talking mouth (the lids and mouth parts hang on the head: no pose of their own)
      a.blinkT = (a.blinkT === undefined ? Math.random() * 4 : a.blinkT) - dt;
      if (a.blinkT < 0) { a.blinkOn = true; if (a.blinkT < -0.14) { a.blinkOn = false; a.blinkT = 2.2 + Math.random() * 4; } }
      if (a.talkAnim > 0) { a.talkAnim -= dt; a.mouthOn = Math.sin(t * 21 + a.p.seed) > 0.1; } else a.mouthOn = false;
      P.lids = null; P.mouth = null;
      return P;
    }
    // speech bubbles & name tags (DOM, projected each frame)
    updateBubbles() {
      const g = this.g, r = g.renderer, cam = g.camPos || null;
      const list = [];
      const pl = g.player.pos;
      for (const a of this.agents) {
        const d2 = (a.pos[0] - pl[0]) ** 2 + (a.pos[2] - pl[2]) ** 2;
        if (d2 > 26 * 26 || a.drawn === false) continue;   // (no bubble floats where the street's budget drew nobody)
        const looked = this.lookTarget === a;
        if (!a.bubble && !(looked && d2 < 12 * 12)) continue;
        // greet the player the first time they come close
        list.push([d2, a, looked]);
      }
      // greetings
      for (const a of this.agents) {
        const d2 = (a.pos[0] - pl[0]) ** 2 + (a.pos[2] - pl[2]) ** 2;
        if (d2 < 5 * 5 && !a.greeted && a.pose !== 'sleep' && a.act && a.act.type !== 'talk' && a.act.type !== 'hide') {
          a.greeted = true; a.waveT = 1.2;
          const st = a.vil.st;
          const known = (st.met || []).includes(a.p.id);
          a.say(known ? Folk.say('helloBack', H(a.p.seed, this.time | 0, 3), { p: g.playerName || 'friend' }) : Folk.say('hello', H(a.p.seed, this.time | 0, 4)), 3);
        } else if (d2 > 14 * 14) a.greeted = false;
      }
      list.sort((x, y) => x[0] - y[0]);
      const vp = r.viewProj, W = r.canvas ? r.canvas.clientWidth : window.innerWidth, Hh = r.canvas ? r.canvas.clientHeight : window.innerHeight;
      const c = g.cam || cam;
      for (let i = 0; i < this.bubs.length; i++) {
        const el = this.bubs[i];
        const it = list[i];
        if (!it || !vp || !c || g.ui.blocking || g.hideHud) { if (el.style.display !== 'none') el.style.display = 'none'; continue; }
        const a = it[1];
        const x = a.pos[0] - c.x, y = a.pos[1] + a.h + (a.pose === 'sleep' ? -0.9 : 0.35) - c.y, z = a.pos[2] - c.z;
        const cw = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
        if (cw <= 0.1) { el.style.display = 'none'; continue; }
        const cx = (vp[0] * x + vp[4] * y + vp[8] * z + vp[12]) / cw, cy = (vp[1] * x + vp[5] * y + vp[9] * z + vp[13]) / cw;
        if (cx < -1.2 || cx > 1.2 || cy < -1.2 || cy > 1.2) { el.style.display = 'none'; continue; }
        const sx = (cx * 0.5 + 0.5) * W, sy = (1 - (cy * 0.5 + 0.5)) * Hh;
        const html = (it[2] || a.bubble ? `<b>${esc(a.p.name)}</b>` : '') + (a.bubble ? `<span>${esc(a.bubble.text)}</span>` : `<span class="role">${esc(Folk.ROLES[a.role] ? Folk.ROLES[a.role].title : '')}</span>`);
        if (el._html !== html) { el.innerHTML = html; el._html = html; }
        el.style.display = 'block';
        const sc = Math.max(0.65, Math.min(1.1, 9 / Math.sqrt(it[0] + 1)));
        el.style.transform = `translate(${sx | 0}px, ${sy | 0}px) translate(-50%, -100%) scale(${sc.toFixed(2)})`;
        el.style.opacity = a.bubble ? Math.min(1, a.bubble.t * 2).toFixed(2) : '0.85';
      }
    }
    // -------------------------------------------------- saving
    beforeSave(meta) { meta.villages = this.st; for (const vil of this.known.values()) if (vil.active) vil.st.lastSeen = this.worldTime(); }
    // for the map / compass
    list() { return this.sites; }
  }
  VR.Villages = Villages;
  Villages.makeRoster = makeRoster;   // (the families and jobs of a village record: test/town_folk.js)
})(VR);

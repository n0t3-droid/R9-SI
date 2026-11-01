// ============================================================================
// u-folk2 · VR.FolkJoy — the inhabitants warm and fun to be around (plan docs/superpowers/plans/2026-10-31-u-folk2.md).
// The owner (31 Oct): „die Bewohner sind nicht wirklich spaßig … ich will Schönheiten und friedliches und liebevolles
// Zusammenleben und Märchenhaftes sowie abenteuerliches Spiel". Small warm MOMENTS the player sees and shares:
//   among themselves — a parent and a child walk hand in hand, a grandparent tells the children a story by a little fire
//   at dusk, the village's pets (our own Glimmerfuchs, Mooskätzchen, Kristallwelpe) trot after their family, someone
//   hums (♪), the hugs and the waves come with a smile (the face's joy part, folkmodel.js);
//   with the player — applause for a build, a gasp at a big jump or fall (then relief), children follow the player for a
//   while and copy its jumps, a flower or a snack offered (take it with [use]), an invitation to dance (a ring dances
//   round the player for 30 s), a child's hide-and-seek (find it).
// No combat, no toasts: speech is a small icon bubble (villages.js updateBubbles: icons only within 14 m) and the two
// short invitations right beside the player. Everything is presentation: nothing saved but the village's love (rep).
// Pure (node, test/folk2.js): KINDS · gap · budget · petsOn · fireOn · choose · newBuild/noteBuild · newJump/noteJump ·
// handPose · sideOf · ring · arc · newStats/count/distinct · TEXT_KEYS. The game glue below extends VR.Villages.
// Cost: Very Low — the logic only (a 4-Hz think, a loop over the near people's timers), no pets, no fire glow;
// Balanced and up — the pets (≤ 6, one voxel model each, within 50 m) and the story fire's glow particles.
// ============================================================================
(function (VR) {
  'use strict';
  const FJ = VR.FolkJoy = VR.FolkJoy || {};
  const T = (k, v) => (VR.I18N ? VR.I18N.t(k, v) : k);
  const TAU = Math.PI * 2;
  FJ.KINDS = ['wave', 'hug', 'hand', 'story', 'pet', 'hum', 'applaud', 'gasp', 'follow', 'offer', 'dance', 'hide'];
  // the moments FJ.choose starts on its own; the others answer the player or come from the village's own life
  FJ.AMBIENT = ['hand', 'story', 'offer', 'dance', 'hide', 'follow'];
  // s between two of a kind in a village
  const GAP = { wave: 0, hug: 0, hand: 45, story: 150, pet: 60, hum: 9, applaud: 40, gasp: 5, follow: 40, offer: 80, dance: 110, hide: 75 };
  FJ.gap = (k) => (GAP[k] !== undefined ? GAP[k] : 30);
  // the world clock's windows (env.timeOfDay: villages.js schedule — sleep 13000–23300, dusk 10600–12300)
  FJ.WHEN = { hand: [900, 12300], story: [10400, 12700], offer: [900, 11800], dance: [8800, 12500], hide: [1200, 10600], follow: [900, 12000] };
  // moments at once (the people a moment borrows from their day) by cost tier 0 Very Low … 4 Ultra
  FJ.budget = (tier) => [1, 3, 4, 5, 6][Math.max(0, Math.min(4, tier | 0))];
  FJ.thinkEvery = (tier) => (tier >= 1 ? 0.25 : 1);   // s: Very Low thinks once a second (one moment at a time)
  FJ.petsOn = (tier) => tier >= 2;
  FJ.fireOn = (tier) => tier >= 2;
  const inWin = (k, tod) => { const w = FJ.WHEN[k]; return !!w && tod >= w[0] && tod < w[1]; };
  // which ambient moment to start now: ctx { tod, tier, now, active: { n }, last: { kind: t }, cand: { kind: bool } };
  // rnd() in [0, 1). null: none (the budget full, every candidate cooling down or out of its hours)
  FJ.choose = function (ctx, rnd) {
    if ((ctx.active && ctx.active.n || 0) >= FJ.budget(ctx.tier)) return null;
    const ok = [];
    for (const k of FJ.AMBIENT) {
      if (!ctx.cand || !ctx.cand[k] || !inWin(k, ctx.tod)) continue;
      const l = ctx.last && ctx.last[k];
      if (l !== undefined && ctx.now - l < FJ.gap(k)) continue;
      ok.push(k);
    }
    if (!ok.length) return null;
    return ok[Math.min(ok.length - 1, Math.floor((rnd ? rnd() : Math.random()) * ok.length))];
  };
  // ---- the player's build: four blocks within 15 s → applause, then 40 s of rest
  FJ.newBuild = () => ({ t: [], rest: -1e9 });
  FJ.noteBuild = function (B, now) {
    B.t.push(now);
    while (B.t.length && now - B.t[0] > 15) B.t.shift();
    if (now < B.rest) return false;
    if (B.t.length >= 4) { B.rest = now + 40; B.t.length = 0; return true; }
    return false;
  };
  // ---- the player's jumps: 'jump' at a take-off, 'gasp' on landing after a drop of 3.5 blocks or 1.3 s in the air
  FJ.newJump = () => ({ air: false, top: 0, t: 0 });
  FJ.noteJump = function (J, onGround, y, dt) {
    if (!J.air) { if (!onGround) { J.air = true; J.top = y; J.t = 0; return 'jump'; } return null; }
    if (!onGround) { if (y > J.top) J.top = y; J.t += dt; return null; }
    J.air = false;
    return (J.top - y >= 3.5 || J.t >= 1.3) ? 'gasp' : null;
  };
  // ---- hand in hand: the parent's right hand down and out to the side, the child's left arm up to it (k 0 … 1)
  FJ.handPose = function (P, role, k) {
    if (role === 'lead') { P.arm_r[2] += 0.26 * k; P.arm_r[0] += 0.12 * k; P.fore_r[0] = P.fore_r[0] * (1 - k) + 0.08 * k; }
    else if (role === 'hold') { P.arm_l[0] += 0.3 * k; P.arm_l[2] += -0.78 * k; P.fore_l[0] = P.fore_l[0] * (1 - k) + 0.12 * k; }
    return P;
  };
  // ---- places (x, z pairs): a person's right side (the models face −z: right is (cos yaw, −sin yaw)), a ring, an arc
  // before someone (the story's listeners)
  FJ.sideOf = function (pos, yaw, d, out) { out[0] = pos[0] + Math.cos(yaw) * d; out[1] = pos[2] - Math.sin(yaw) * d; return out; };
  FJ.ring = function (cx, cz, n, r, phase, out) { out.length = 0; for (let i = 0; i < n; i++) { const a = phase + i * TAU / n; out.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); } return out; };
  FJ.arc = function (px, pz, yaw, n, r, out) {
    out.length = 0; const b = Math.atan2(-Math.cos(yaw), -Math.sin(yaw));
    for (let i = 0; i < n; i++) { const o = n > 1 ? (i / (n - 1) - 0.5) * 1.8 : 0; out.push([px + Math.cos(b + o) * r, pz + Math.sin(b + o) * r]); }
    return out;
  };
  // ---- the counter (test/folk2.mjs counts the moments of a walk)
  FJ.newStats = () => ({ n: 0, by: {}, log: [] });
  FJ.count = function (S, k, t) { S.n++; S.by[k] = (S.by[k] || 0) + 1; if (S.log.length < 200) S.log.push([k, t || 0]); return S; };
  FJ.distinct = (S) => Object.keys(S.by).length;
  FJ.stats = FJ.newStats();
  // the children of a town without any: a modern or tech town's flats have two beds (Herzwelt's first town among them),
  // or one (Herzwelt's first town: eleven single flats), so no child lived there — no hand in hand, no story, no tag. From Low up, some grown-ups' child (a couple's or a single parent's, (H-picked, at most
  // VISIT_MAX, two at least) lives with them; the roster appends them after everyone else (nobody's name, job or clothes change).
  // Very Low: none (no more people to draw). Returns the families' indices.
  FJ.VISIT_MAX = 4;
  FJ.visitKids = function (fams, style, seed, tier) {
    if (!(tier >= 1) || !/^(modern|tech)$/.test(style || '')) return [];
    if (fams.some(f => f.members.some(m => m.age === 'child'))) return [];
    const out = [], ok = (f) => f.members.length >= 1 && f.members.length <= 2 && f.members.every(m => m.age === 'adult');
    for (let i = 0; i < fams.length && out.length < FJ.VISIT_MAX; i++) {
      const f = fams[i]; if (!ok(f)) continue;
      if ((((seed >>> 0) * 2654435761 + i * 40503) >>> 0) % 5 < 2) out.push(i);
    }
    for (let i = 0; i < fams.length && out.length < 2; i++) if (!out.includes(i) && ok(fams[i])) out.push(i);   // (two at least: a pair to play)
    return out;
  };
  FJ.TEXT_KEYS = ['g.joy.forYouFlower', 'g.joy.forYouSnack', 'g.joy.dance', 'g.joy.hide', 'g.joy.found', 'g.joy.here', 'g.joy.enjoy', 'g.joy.danceThanks'];

  // ============================================================== the game glue
  const Vs = VR.Villages;
  if (!Vs) return;
  const P = Vs.prototype, Folk = VR.Folk, R = VR.R;
  const BUSY = new Set(['talk', 'joy', 'outing', 'hide', 'fight', 'sleep', 'school', 'home', 'terrace']);
  const free = (a) => !!a.act && a.pose !== 'sleep' && a.pose !== 'sit' && a.pose !== 'sitground' && !a.inBoat && !BUSY.has(a.act.type) && !(a.clipQ && a.clipQ.length);
  const d2xz = (a, p) => (a.pos[0] - p[0]) ** 2 + (a.pos[2] - p[2]) ** 2;
  const icon = (a, ch, t) => { a.bubble = { text: ch, t: t || 2.4, icon: true }; };
  const smile = (a, k, t) => { a.expr = k || 'joy'; a.exprT = t || 2.5; };
  const tmp2 = [0, 0], tmpR = [];
  const itemOk = (id) => !!((VR.itemDef && VR.itemDef(id)) || (R && R.byName && R.byName[id]));

  const prevUpdate = P.update;
  P.update = function (dt) {
    prevUpdate.call(this, dt);
    try { this.joyUpdate(dt); } catch (e) { if (!this._joyErr) { this._joyErr = 1; console.error('folkjoy', e); } }
  };
  P.joyState = function () {
    return this.joy || (this.joy = { tick: 0.5, build: FJ.newBuild(), jump: FJ.newJump(), jumpAt: -9, still: 0, lp: [0, 0, 0], last: new Map(), active: [], pets: [], petVil: new Set(), dance: null, stats: FJ.stats });
  };
  P.joyCount = function (k) { const J = this.joyState(); FJ.count(J.stats, k, this.time); };
  P.joyLast = function (vil) { const J = this.joyState(); let L = J.last.get(vil); if (!L) J.last.set(vil, (L = {})); return L; };
  P.joyTier = function () { return VR.LifeKit && VR.LifeKit.tierOf ? VR.LifeKit.tierOf(this.g.settings) : 2; };

  P.joyUpdate = function (dt) {
    const g = this.g, p = g.player, J = this.joyState();
    if (!p || FJ.off) return;   // (FJ.off: the measurement's switch — the moments, their timers and the pets stop)
    // the player: still or moving, a take-off, a big landing
    const mv = Math.hypot(p.pos[0] - J.lp[0], p.pos[2] - J.lp[2]);
    J.still = mv < 0.04 ? J.still + dt : 0; J.lp[0] = p.pos[0]; J.lp[1] = p.pos[1]; J.lp[2] = p.pos[2];
    if (!p.flying && !(p.mode === 'spectator')) {
      const e = FJ.noteJump(J.jump, !!p.onGround, p.pos[1], dt);
      if (e === 'jump') J.jumpAt = this.time;
      else if (e === 'gasp') this.joyReact('gasp');
    }
    // the people's timers: the face's expression, the overlay clips (clap, gasp …), the pause they hold
    for (let i = 0; i < this.agents.length; i++) {
      const a = this.agents[i];
      if (a.exprT > 0) { a.exprT -= dt; if (a.exprT <= 0) a.expr = null; }
      if (a.clipQ && a.clipQ.length) {
        const c = a.clipQ[0];
        if (c[3] === undefined) { c[3] = c[1]; a.joyClip = c[0]; if (c[2]) smile(a, c[2], c[1] + 0.4); }
        c[3] -= dt;
        if (c[3] <= 0) { a.clipQ.shift(); if (!a.clipQ.length) { a.joyClip = null; if (a.lookAt === a._rlk) a.lookAt = null; a._rlk = null; } }
      }
    }
    if (J.dance) this.joyDanceTick(dt);
    if (FJ.petsOn(this.joyTier())) this.joyPets(dt); else if (J.pets.length) J.pets.length = 0;
    J.tick -= dt;
    if (J.tick <= 0) { J.tick = FJ.thinkEvery(this.joyTier()); this.joyThink(); }
  };

  // the nearest living village (its middle within 90 m, someone of it within 40 m)
  P.joyVillage = function () {
    const p = this.g.player.pos; let best = null, bd = 90 * 90;
    for (const vil of this.known.values()) {
      if (!vil.active) continue;
      const d = (vil.plan.x - p[0]) ** 2 + (vil.plan.z - p[2]) ** 2;
      if (d < bd && vil.agents.some(a => d2xz(a, p) < 40 * 40)) { bd = d; best = vil; }
    }
    return best;
  };

  P.joyThink = function () {
    const g = this.g, p = g.player.pos, J = this.joyState(), now = this.time;
    const vil = this.joyVillage(); if (!vil) return;
    const L = this.joyLast(vil), tod = g.env ? g.env.timeOfDay : 4000;
    J.active = J.active.filter(a => a.act && a.act.type === 'joy' && !a.act.done);
    for (const a of vil.agents) {
      const d2 = d2xz(a, p);
      // the waves and the hugs of the village's own life, now with a smile (counted when the player is near)
      if (a.waveT > 0) { if (!a._wvC) { a._wvC = true; smile(a, 'joy', 2.6); if (d2 < 15 * 15) this.joyCount('wave'); } } else a._wvC = false;
      const hug = a.act && a.act.type === 'talk' && a.act.hug;
      if (hug && !a._hgC) { a._hgC = true; smile(a, 'joy', 4); if (a.act.with && a.act.with._hgC !== true && d2 < 25 * 25) this.joyCount('hug'); } else if (!hug) a._hgC = false;
      // a person the player looks at smiles back
      if (this.lookTarget === a && d2 < 7 * 7 && !a.expr && a.pose !== 'sleep') smile(a, 'joy', 1.6);
    }
    // humming: one walker near the player now and then
    if (now - (L.hum === undefined ? -1e9 : L.hum) > FJ.gap('hum') && Math.random() < 0.35) {
      for (const a of vil.agents) if (!a.kid && !a.bubble && a.walkAmt > 0.4 && d2xz(a, p) < 12 * 12 && a.pose !== 'sleep') { icon(a, '♪', 2.6); smile(a, 'joy', 2.6); L.hum = now; this.joyCount('hum'); break; }
    }
    // an ambient moment
    if (Math.random() > 0.3) return;
    const cand = this.joyCand(vil, J);
    const k = FJ.choose({ tod, tier: this.joyTier(), now, active: { n: J.active.length }, last: L, cand }, Math.random);
    if (k && this.joyStart(vil, k, cand)) L[k] = now;
  };

  // who could take part in what, right now (the first found is kept in cand._who)
  P.joyCand = function (vil, J) {
    const p = this.g.player.pos, c = { _who: {} }, W = c._who;
    const kids = [], adults = [], elders = [];
    for (const a of vil.agents) { if (!free(a)) continue; const d2 = d2xz(a, p); if (d2 > 40 * 40) continue; (a.kid ? kids : a.elder ? elders : adults).push([a, d2]); }
    // hand in hand: a free adult and a free child of the same family, both within 35 m
    for (const [a] of adults) { const k = kids.find(([b]) => b.p.fam === a.p.fam && d2xz(b, a.pos) < 20 * 20); if (k) { c.hand = true; W.hand = [a, k[0]]; break; } }
    // (a grandparent tells; a town without one — the flats — a parent)
    if ((elders.length || adults.length) && kids.length >= 2) { c.story = true; W.story = [(elders[0] || adults[0])[0], kids.slice(0, 4).map(k => k[0])]; }
    const nearA = adults.concat(elders).filter(([, d2]) => d2 < 11 * 11).sort((x, y) => x[1] - y[1]);
    if (J.still >= 2.5 && nearA.length) { c.offer = true; W.offer = nearA[0][0]; }
    if (nearA.length && adults.length + elders.length >= 3 && !J.dance) { c.dance = true; W.dance = nearA[0][0]; }
    const nearK = kids.filter(([, d2]) => d2 < 12 * 12).sort((x, y) => x[1] - y[1]);
    if (nearK.length) { c.hide = true; W.hide = nearK[0][0]; }
    if (nearK.length && !J.active.some(a => a.act.kind === 'follow')) { c.follow = true; W.follow = nearK.slice(0, 2).map(k => k[0]); }
    return c;
  };

  P.joyBegin = function (a, kind, extra) {
    this.setAct(a, Object.assign({ type: 'joy', kind, t: 0, len: 40 }, extra || {}));
    a.joyHand = null; a.dance = false; a.joyClip = null;
    this.joyState().active.push(a);
    return a.act;
  };
  P.joyEnd = function (a) {
    if (!a.act || a.act.type !== 'joy') return;
    a.act.done = true; a.joyHand = null; a.dance = false; a.joyClip = null; a.steer = null; a.lookAt = null; a.thinkT = 0;
    if (a.act.sp0) a.speed = a.act.sp0;
    if (a.pose === 'sitground' || a.pose === 'crouch') a.pose = 'stand';
  };

  P.joyStart = function (vil, k, cand) {
    const W = cand._who, p = this.g.player.pos, pz = vil.plan.plaza;
    if (k === 'hand') {
      const [lead, kid] = W.hand;
      const la = this.joyBegin(lead, 'hand', { role: 'lead', len: 45 + Math.random() * 20, ang: Math.random() * TAU });
      const ka = this.joyBegin(kid, 'hand', { role: 'hold', len: 999, sp0: kid.speed });
      la.mate = kid; ka.mate = lead;
      this.joyCount('hand');
      return true;
    }
    if (k === 'story') {
      const [el, kids] = W.story;
      // the fire's place: the plaza's middle, a few steps aside (the well, a monument stand there)
      const an = Math.random() * TAU, fx = pz.x + 0.5 + Math.cos(an) * 4.5, fz = pz.z + 0.5 + Math.sin(an) * 4.5;
      const yaw = Math.atan2(-(pz.x + 0.5 - fx), -(pz.z + 0.5 - fz));   // the teller faces the plaza's middle, the fire before it
      const ex = fx + Math.sin(yaw) * 1.2, ez = fz + Math.cos(yaw) * 1.2;   // the teller sits 1.2 m behind the fire (forward is (−sin, −cos))
      const S = { fire: [fx, pz.y, fz], at: [ex, ez], yaw, kids: [], beat: 0, counted: false };
      this.joyBegin(el, 'story', { role: 'teller', S, len: 80 });
      const arc = FJ.arc(fx, fz, yaw, kids.length, 1.5, []);   // the children beyond the fire, facing the teller
      kids.forEach((kd, i) => { this.joyBegin(kd, 'story', { role: 'listen', S, seat: arc[i], len: 80 }); S.kids.push(kd); });
      return true;
    }
    if (k === 'offer') {
      const a = W.offer, flower = Math.random() < 0.55;
      const pool = flower ? ['poppy', 'dandelion', 'cornflower', 'blue_orchid'] : ['bread', 'apple', 'sweet_berries'];
      const ids = pool.filter(itemOk); if (!ids.length) return false;
      this.joyBegin(a, 'offer', { len: 30, item: ids[Math.floor(Math.random() * ids.length)], flower });
      return true;
    }
    if (k === 'dance') { this.joyBegin(W.dance, 'invite', { len: 30 }); return true; }
    if (k === 'hide') { this.joyBegin(W.hide, 'hideAsk', { len: 30 }); return true; }
    if (k === 'follow') {
      W.follow.forEach((kd, i) => { this.joyBegin(kd, 'follow', { len: 22 + Math.random() * 8, side: i ? -1 : 1 }); icon(kd, '☆', 2); smile(kd, 'joy', 3); });
      this.joyCount('follow');
      return true;
    }
    void p;
    return false;
  };

  // ---------------------------------------------------------------- the moments as acts
  const prevThink = P.think;
  P.think = function (a, tod) {
    if (a.act && a.act.type === 'joy' && !a.act.done) return;
    return prevThink.call(this, a, tod);
  };
  const prevRun = P.runAct;
  P.runAct = function (a, dt, tod) {
    const act = a.act;
    if (!act || act.type !== 'joy') return prevRun.call(this, a, dt, tod);
    if (act.done) return;
    act.t += dt;
    if (act.t > act.len) { this.joyEnd(a); return; }
    const f = this['joy_' + act.kind];
    if (f) f.call(this, a, act, dt, tod); else this.joyEnd(a);
  };
  // walk toward (x, z) by steering (short ways, the plaza's open ground); true when within near
  P.joySteer = function (a, x, z, near) {
    const d = Math.hypot(x - a.pos[0], z - a.pos[2]);
    if (d < (near || 0.6)) { a.steer = null; return true; }
    a.path = null; a.steer = a.steer || [0, 0]; a.steer[0] = x; a.steer[1] = z;
    if (d > 7) { a.steer = null; this.goTo(a, x, a.pos[1] + 0.05, z, near || 0.6); }
    return false;
  };
  const toPlayer = function (self, a, act, near) {
    const p = self.g.player.pos, dx = a.pos[0] - p[0], dz = a.pos[2] - p[2], d = Math.hypot(dx, dz) || 1;
    const arrived = self.joySteer(a, p[0] + dx / d * near, p[2] + dz / d * near, 0.5) || d < near + 0.35;
    if (arrived) { a.steer = null; a.lookAt = [p[0], p[1] + 1.5, p[2]]; }
    if (d > 25) self.joyEnd(a);
    return arrived;
  };

  P.joy_hand = function (a, act, dt) {
    const m = act.mate;
    if (!m || !m.act || m.act.type !== 'joy' || m.act.kind !== 'hand' || m.act.done) { this.joyEnd(a); return; }
    if (act.role === 'lead') {
      const pz = a.vil.plan.plaza;
      a.joyHand = Math.hypot(m.pos[0] - a.pos[0], m.pos[2] - a.pos[2]) < 1.1 ? 'lead' : null;
      // to the plaza, then slowly round it (the child keeps pace: the lead waits when it falls behind)
      const dP = Math.hypot(pz.x + 0.5 - a.pos[0], pz.z + 0.5 - a.pos[2]);
      if (!act.round && dP > 8) { this.goTo(a, pz.x, pz.y, pz.z, 6); }
      else { act.round = true; act.ang += dt * 0.11; this.joySteer(a, pz.x + 0.5 + Math.cos(act.ang) * 6, pz.z + 0.5 + Math.sin(act.ang) * 6, 0.4); }
      const dm = Math.hypot(m.pos[0] - a.pos[0], m.pos[2] - a.pos[2]);
      // (the child far and not coming — a way it cannot find: the parent fetches it)
      if (!a.joyHand && dm > 9 && act.t > 6) { a.steer = null; this.goTo(a, m.pos[0], m.pos[1] + 0.05, m.pos[2], 1.2); a.lookAt = null; }
      else if (!a.joyHand && dm > 2.5) { a.steer = null; a.path = null; a.lookAt = [m.pos[0], m.pos[1] + 1, m.pos[2]]; } else a.lookAt = null;
      if (act.t > act.len - 0.1) this.joyEnd(m);
      return;
    }
    // the child: at the lead's right side, a little ahead of where it goes
    const s = FJ.sideOf(m.pos, m.yaw, 0.62, tmp2), lv = Math.hypot(m.vel[0], m.vel[2]);
    const tx = s[0] + m.vel[0] * 0.35, tz = s[1] + m.vel[2] * 0.35, d = Math.hypot(tx - a.pos[0], tz - a.pos[2]);
    a.speed = Math.min(act.sp0 * 1.6, Math.max(0.6, lv + d * 2.2));
    act.run = d > 3;
    if (d < 0.25 && lv < 0.3) { a.steer = null; a.lookAt = null; let dy = m.yaw - a.yaw; while (dy > Math.PI) dy -= TAU; while (dy < -Math.PI) dy += TAU; a.yaw += dy * Math.min(1, dt * 5); }
    else if (d > 9) { a.steer = null; if (!act.go || Math.hypot(act.go[0] - m.pos[0], act.go[1] - m.pos[2]) > 2) act.go = [m.pos[0], m.pos[2]]; this.goTo(a, act.go[0], m.pos[1] + 0.05, act.go[1], 1.5); }
    else { a.path = null; a.steer = a.steer || [0, 0]; a.steer[0] = tx; a.steer[1] = tz; }
    a.joyHand = Math.hypot(s[0] - a.pos[0], s[1] - a.pos[2]) < 0.6 ? 'hold' : null;
    if (a.joyHand && Math.random() < dt * 0.15) smile(a, 'joy', 2);
  };

  P.joy_story = function (a, act, dt, tod) {
    const S = act.S, g = this.g;
    if (tod >= 12700 || (act.role === 'listen' && !S.teller) && act.t > 30) { this.joyEnd(a); return; }
    if (act.role === 'teller') {
      S.teller = a;
      if (a.pose !== 'sitground') { if (this.joySteer(a, S.at[0], S.at[1], 0.45) || (act.t > 25 && Math.hypot(S.at[0] - a.pos[0], S.at[1] - a.pos[2]) < 2)) { a.steer = null; a.pose = 'sitground'; a.yaw = S.yaw; } return; }
      a.yaw = S.yaw; a.joyStory = true;
      // the story's beats: every 9 s the children gasp, then laugh; the teller's mouth moves, a ✦ now and then
      S.beat += dt;
      if (Math.random() < dt * 0.9) a.talkAnim = 0.8;
      if (S.beat > 9) {
        S.beat = 0;
        if (Math.random() < 0.6) icon(a, Math.random() < 0.5 ? '✦' : '☾', 2.4);
        for (const k of S.kids) if (k.pose === 'sitground') k.clipQ = [[null, 1.4, 'wow'], [null, 2.2, 'joy']];
        const seated = S.kids.filter(k => k.pose === 'sitground').length;
        if (!S.counted && seated >= 2 && this.near(a, 30)) { S.counted = true; this.joyCount('story'); }
      }
      // the little fire (Balanced and up: warm glow rising; the people's light is the block light's — none here)
      if (FJ.fireOn(this.joyTier()) && this.near(a, 40) && g.particles) {
        S.fireT = (S.fireT || 0) - dt;
        if (S.fireT <= 0) { S.fireT = 0.09; const f = S.fire; g.particles.glow(f[0] + (Math.random() - 0.5) * 0.35, f[1] + 0.15, f[2] + (Math.random() - 0.5) * 0.35, Math.random() < 0.3 ? [1, 0.85, 0.4] : [1, 0.45, 0.12], 0.9, 0.09, 0.9); }
      }
      if (act.t > act.len - 0.2) for (const k of S.kids) this.joyEnd(k);
      return;
    }
    // a listener: to its seat on the arc, sits facing the teller
    if (a.pose !== 'sitground') {
      if (this.joySteer(a, act.seat[0], act.seat[1], 0.45) || (act.t > 25 && Math.hypot(act.seat[0] - a.pos[0], act.seat[1] - a.pos[2]) < 2)) {
        a.steer = null; a.pose = 'sitground';
        a.yaw = Math.atan2(-(S.fire[0] - a.pos[0]), -(S.fire[2] - a.pos[2]));
      }
      return;
    }
    if (S.teller) a.lookAt = [S.teller.pos[0], S.teller.pos[1] + 1.1, S.teller.pos[2]];
  };

  P.joy_offer = function (a, act) {
    if (!act.wait) {
      if (toPlayer(this, a, act, 1.35)) { act.wait = act.t; act.len = act.t + 14; a.joyClip = 'give'; a.say(T(act.flower ? 'g.joy.forYouFlower' : 'g.joy.forYouSnack'), 3.2); smile(a, 'joy', 4); }
      return;
    }
    a.joyClip = 'give';
    const p = this.g.player.pos; a.lookAt = [p[0], p[1] + 1.5, p[2]];
    if (!a.bubble && Math.random() < 0.02) icon(a, act.flower ? '✿' : '♨', 2);
    if (act.t > act.len - 0.2) smile(a, 'joy', 2);
  };
  P.joy_invite = function (a, act) {
    if (!act.wait) {
      if (toPlayer(this, a, act, 1.6)) { act.wait = act.t; act.len = act.t + 14; a.waveT = 1.2; a.say(T('g.joy.dance'), 3.5); smile(a, 'joy', 4); }
      return;
    }
    const p = this.g.player.pos; a.lookAt = [p[0], p[1] + 1.5, p[2]];
    if (!a.bubble && Math.random() < 0.02) icon(a, '♪', 2);
  };
  P.joy_hideAsk = function (a, act) {
    if (!act.wait) {
      if (toPlayer(this, a, act, 1.4)) { act.wait = act.t; act.len = act.t + 12; a.say(T('g.joy.hide'), 3.5); smile(a, 'joy', 4); a.joyClip = 'cheer'; setTimeout(() => { if (a.joyClip === 'cheer') a.joyClip = null; }, 900); }
      return;
    }
    const p = this.g.player.pos; a.lookAt = [p[0], p[1] + 1.2, p[2]];
  };
  P.joy_hiding = function (a, act) {
    const p = this.g.player.pos;
    if (act.found) { if (act.t > act.found + 2.6) { a.joyClip = null; this.joyEnd(a); } return; }
    if (a.pose !== 'crouch') {
      act.run = true;
      if (this.goTo(a, act.spot[0], act.spot[1], act.spot[2], 0.7) || (act.t > 20)) { a.pose = 'crouch'; a.steer = null; act.hidAt = act.t; }
    } else if (Math.random() < 0.01 && d2xz(a, p) < 14 * 14) icon(a, '♪', 1.6);   // a giggle gives it away
    if (a.pose === 'crouch' && d2xz(a, p) < 2.6 * 2.6) {
      act.found = act.t; a.pose = 'stand'; a.joyClip = 'cheer'; smile(a, 'joy', 3.5); a.say(T('g.joy.found'), 2.8); this.hearts(a); this.joyCount('hide');
      a.lookAt = [p[0], p[1] + 1.2, p[2]];
      return;
    }
    if (act.t > act.len - 3 && !act.out) { act.out = true; a.pose = 'stand'; a.waveT = 1.2; a.say(T('g.joy.here'), 2.5); }
  };
  P.joy_follow = function (a, act, dt) {
    const g = this.g, p = g.player, J = this.joyState();
    const vx = p.vel ? p.vel[0] : 0, vz = p.vel ? p.vel[2] : 0, sp = Math.hypot(vx, vz);
    let fx, fz; if (sp > 0.5) { fx = vx / sp; fz = vz / sp; } else { const ld = p.lookDir ? p.lookDir() : [0, 0, -1]; const l = Math.hypot(ld[0], ld[2]) || 1; fx = ld[0] / l; fz = ld[2] / l; }
    // behind the player and a little to the side, as children trail someone they like
    const tx = p.pos[0] - fx * 2.1 - fz * act.side * 1.1, tz = p.pos[2] - fz * 2.1 + fx * act.side * 1.1;
    const d = Math.hypot(tx - a.pos[0], tz - a.pos[2]);
    act.run = d > 3.2;
    if (d2xz(a, p.pos) > 26 * 26) { a.waveT = 1.2; this.joyEnd(a); return; }
    if (d > 0.5) this.joySteer(a, tx, tz, 0.5); else { a.steer = null; a.lookAt = [p.pos[0], p.pos[1] + 1.4, p.pos[2]]; }
    // copy the player's jump a moment later
    const since = this.time - J.jumpAt;
    if (since > 0.18 && since < 0.5 && a.onGround && act.jumped !== J.jumpAt) { act.jumped = J.jumpAt; a.vel[1] = 7.4; a.clipQ = [['cheer', 0.7, 'joy']]; FJ.count(J.stats, 'copy', this.time); }
    if (act.t > act.len - 0.2) a.waveT = 1.2;
  };
  P.joy_dancer = function (a, act) {
    const D = this.joyState().dance;
    if (!D) { this.joyEnd(a); return; }
    const an = D.phase + act.idx * TAU / D.n + D.t * 0.22, x = D.c[0] + Math.cos(an) * 2.5, z = D.c[2] + Math.sin(an) * 2.5;
    const d = Math.hypot(x - a.pos[0], z - a.pos[2]);
    if (d > 0.45) { a.dance = d < 1.2; this.joySteer(a, x, z, 0.3); act.run = d > 4; }
    else { a.steer = null; a.dance = true; a.lookAt = [D.c[0], a.pos[1] + 1.5, D.c[2]]; }
    if (!a.bubble && Math.random() < 0.006) icon(a, '♪', 1.8);
  };
  P.joyDanceTick = function (dt) {
    const D = this.joy.dance; D.t += dt;
    if (D.t > D.len) {
      for (const a of D.members) { if (a.act && a.act.kind === 'dancer') { this.joyEnd(a); smile(a, 'joy', 3); this.hearts(a); } }
      if (D.members[0]) D.members[0].say(T('g.joy.danceThanks'), 3);
      this.joy.dance = null;
    }
  };

  // ---------------------------------------------------------------- the player answers: [use] on the one who asks
  const prevOpen = P.openTalk;
  P.openTalk = function (a) {
    if (this.joyAccept(a)) return;
    return prevOpen.call(this, a);
  };
  P.joyAccept = function (a) {
    const act = a && a.act;
    if (!act || act.type !== 'joy' || act.done) return false;
    const g = this.g, p = g.player;
    if (act.kind === 'offer' && act.wait) {
      if (p.inv && p.inv.add) p.inv.add(act.item, act.flower ? 1 : 2);
      a.vil.st.rep = (a.vil.st.rep || 0) + 1;
      a.say(T('g.joy.enjoy'), 2.6); smile(a, 'joy', 3.5); this.hearts(a);
      try { g.audio.play('pop'); } catch (e) { /* no sound */ }
      this.joyCount('offer'); this.joyEnd(a);
      return true;
    }
    if (act.kind === 'invite' && act.wait) {
      const vil = a.vil, pp = p.pos, members = [a];
      for (const o of vil.agents) { if (members.length >= 6) break; if (o !== a && !o.kid && free(o) && d2xz(o, pp) < 30 * 30) members.push(o); }
      for (const o of vil.agents) { if (members.length >= 7) break; if (o.kid && free(o) && d2xz(o, pp) < 20 * 20) members.push(o); }
      const D = this.joyState().dance = { t: 0, len: 30, c: [pp[0], pp[1], pp[2]], phase: Math.random() * TAU, n: members.length, members };
      this.joyEnd(a);
      members.forEach((o, i) => { this.joyBegin(o, 'dancer', { idx: i, len: D.len + 1 }); smile(o, 'joy', 4); });
      icon(a, '♪', 2.5);
      try { g.audio.play('achievement'); } catch (e) { /* no sound */ }
      this.joyCount('dance');
      return true;
    }
    if (act.kind === 'hideAsk' && act.wait) {
      const spot = this.hideSpot ? this.hideSpot(a.vil, a) : null;
      this.joyEnd(a);
      if (!spot) return true;
      this.joyBegin(a, 'hiding', { len: 50, spot });
      a.say('☆', 1.5); smile(a, 'joy', 2);
      return true;
    }
    return false;
  };

  // ---------------------------------------------------------------- reactions to what the player does
  const prevBC = P.onBlockChanged;
  P.onBlockChanged = function (x, y, z, old, s) {
    if (!this.selfEdit && s && s !== old && this.g.player) {
      const p = this.g.player.pos;
      if ((x + 0.5 - p[0]) ** 2 + (z + 0.5 - p[2]) ** 2 < 12 * 12 && FJ.noteBuild(this.joyState().build, this.time)) this.joyReact('applaud');
    }
    return prevBC.call(this, x, y, z, old, s);
  };
  P.joyReact = function (kind) {
    const p = this.g.player.pos, R2 = (kind === 'gasp' ? 13 : 15) ** 2;
    const L = this.joyLast(this.joyVillage() || this);
    if (L[kind] !== undefined && this.time - L[kind] < FJ.gap(kind)) return;
    let n = 0;
    for (const a of this.agents) {
      if (a.pose === 'sleep' || a.pose === 'sit' || a.pose === 'sitground' || (a.act && a.act.type === 'joy' && a.act.kind === 'hiding') || d2xz(a, p) > R2 || a.drawn === false) continue;
      a.clipQ = kind === 'gasp' ? [['gasp', 1.2, 'wow'], ['clap', 1.1, 'joy']] : [['clap', 2.2, 'joy'], [null, 0.6, 'joy']];
      a.holdT = kind === 'gasp' ? 2.3 : 2.8;
      if (!a.lookAt) { a.lookAt = [p[0], p[1] + 1.5, p[2]]; a._rlk = a.lookAt; }
      if (n < 2) icon(a, kind === 'gasp' ? '!' : '♥', 2.2);
      n++;
    }
    if (n) { L[kind] = this.time; this.joyCount(kind); }
  };
  // a person clapping or gasping holds still for it
  const prevMove = P.move;
  P.move = function (a, dt) {
    if (a.holdT > 0) { a.holdT -= dt; a.vel[0] *= Math.exp(-dt * 12); a.vel[2] *= Math.exp(-dt * 12); a.walkAmt += (0 - a.walkAmt) * Math.min(1, dt * 6); if (!a.onGround || a.vel[1] > 0) return prevMove.call(this, a, dt); return; }
    return prevMove.call(this, a, dt);
  };

  // ---------------------------------------------------------------- the pose on top (hand in hand, the teller's hands)
  const prevPose = P.pose;
  P.pose = function (a, t) {
    const Pz = prevPose.call(this, a, t);
    if (a.joyHand && Pz.arm_l && Pz.arm_r && Pz.fore_l && Pz.fore_r) FJ.handPose(Pz, a.joyHand, 1);
    if (a.joyStory && a.pose === 'sitground' && Pz.arm_r && Pz.fore_r && Pz.arm_l) {
      const s = Math.sin(t * 1.7 + (a.p.seed || 0)), c = Math.sin(t * 1.1 + 1.3);
      Pz.arm_r[0] += 0.55 + 0.35 * s; Pz.fore_r[0] += 0.5 + 0.3 * c; Pz.arm_r[2] += 0.15 * c;
      Pz.arm_l[0] += 0.3 + 0.2 * c; if (Pz.head) Pz.head[2] += 0.06 * s;
    }
    if (!(a.act && a.act.type === 'joy' && a.act.kind === 'story')) a.joyStory = false;
    return Pz;
  };

  // ---------------------------------------------------------------- the village pets (our own creatures)
  const PET_KINDS = ['moss_cat', 'glimmer_fox', 'crystal_pup'];
  P.joyPets = function (dt) {
    const g = this.g, J = this.joy, p = g.player.pos, w = g.world;
    for (const vil of this.known.values()) {
      if (!vil.active || J.petVil.has(vil)) continue;
      J.petVil.add(vil);
      let n = 0;
      (vil.fams || []).forEach((f, i) => {
        if (n >= 3 || !f.members || !f.members.length || (Folk.hash(vil.plan.x, vil.plan.z, i * 7 + 3) % 3) !== 0) return;
        const own = vil.agents.find(a => a.p.fam === i && a.kid) || vil.agents.find(a => a.p.fam === i);
        if (!own) return;
        const kind = PET_KINDS[Folk.hash(i, vil.plan.x, 11) % PET_KINDS.length];
        if (!VR.getVoxModel) return;
        J.pets.push({ kind, pos: [own.pos[0] + 0.8, own.pos[1], own.pos[2] + 0.8], yaw: own.yaw, walk: 0, walkAmt: 0, id: i + 1, pet: { state: 'follow', wig: 0 }, owner: own, vil, still: 0, seenT: -1e9 });
        n++;
      });
    }
    for (let i = J.pets.length - 1; i >= 0; i--) {
      const q = J.pets[i], o = q.owner;
      if (!q.vil.active || !o.vil.agents.includes(o)) { J.pets.splice(i, 1); continue; }
      const dP = d2xz(q, p);
      if (dP > 60 * 60) continue;
      // beside the owner, a step behind; a sleeping or seated owner: the pet sits by
      const back = o.pose === 'sit' || o.pose === 'sleep' ? 0.9 : 1.1, sd = (q.id & 1) ? 0.55 : -0.55;
      const fx = -Math.sin(o.yaw), fz = -Math.cos(o.yaw);
      const tx = o.pos[0] - fx * back + Math.cos(o.yaw) * sd, tz = o.pos[2] - fz * back - Math.sin(o.yaw) * sd;
      const dx = tx - q.pos[0], dz = tz - q.pos[2], d = Math.hypot(dx, dz);
      if (d > 14 || o.pose === 'sleep') { q.pos[0] = tx; q.pos[2] = tz; q.pos[1] = o.pos[1]; }
      const sp = d > 0.25 ? Math.min(4.5, d * 2.4) : 0;
      if (sp > 0) { q.pos[0] += dx / d * sp * dt; q.pos[2] += dz / d * sp * dt; let dy = Math.atan2(-dx, -dz) - q.yaw; while (dy > Math.PI) dy -= TAU; while (dy < -Math.PI) dy += TAU; q.yaw += dy * Math.min(1, dt * 7); }
      // the ground under it (the owner's height, a block up or down)
      const bx = Math.floor(q.pos[0]), bz = Math.floor(q.pos[2]); let gy = Math.floor(o.pos[1] + 1.2);
      for (let k = 0; k < 4 && w && gy > 0; k++, gy--) { const s0 = w.getBlock(bx, gy - 1, bz); if (R.T.flags[s0] & VR.F.SOLID) break; }
      // (never up on a counter, a bench, a table: higher than the owner's floor — the pet keeps close behind its owner)
      if (gy > Math.floor(o.pos[1] + 0.05) + 0.5) { q.pos[0] = o.pos[0] - fx * 0.5; q.pos[2] = o.pos[2] - fz * 0.5; gy = o.pos[1]; }
      q.pos[1] += (gy - q.pos[1]) * Math.min(1, dt * 10);
      q.walk += sp * dt * 1.6; q.walkAmt += ((sp > 0.3 ? 1 : 0) - q.walkAmt) * Math.min(1, dt * 6);
      q.still = sp > 0.3 ? 0 : q.still + dt;
      q.state = q.still > 2 ? 'sit' : 'follow';
      q.pet.wig = dP < 3.5 * 3.5 ? 1 : Math.max(0, q.pet.wig - dt);
      if (dP < 9 * 9 && this.time - q.seenT > FJ.gap('pet')) { q.seenT = this.time; this.joyCount('pet'); }
    }
  };
  const prevDraw = P.draw;
  P.draw = function (r, E, cam) {
    prevDraw.call(this, r, E, cam);
    const J = this.joy; if (!J || FJ.off || !J.pets.length || !VR.LifeKit) return;
    const g = this.g, ent = g.entities; if (!ent) return;
    let prog = null, n = 0;
    for (const q of J.pets) {
      if (n >= 6) break;
      if ((q.pos[0] - cam.x) ** 2 + (q.pos[2] - cam.z) ** 2 > 50 * 50) continue;
      if (!prog) prog = ent.beginVox(r, E);
      if (VR.LifeKit.drawQuad(g, r, prog, q, cam, g.time)) n++;
    }
    J.petsDrawn = n;
  };
})(VR);

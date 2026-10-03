// ============================================================================
// The Lantern Festival: every third evening (the village you start in
// celebrates on your very first night) the whole village gathers on the
// plaza — a circle dance around the well, children hopping in the middle,
// musicians by the bell, grandparents on the benches — sky lanterns drift up
// at dusk and fireworks burst over the rooftops after dark, with festive
// music when you are there. Extends VR.Villages (villages.js).
// ============================================================================
(function (VR) {
  'use strict';
  const Vs = VR.Villages;
  if (!Vs) return;
  const P = Vs.prototype;
  const TAU = Math.PI * 2;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const hashId = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const FEST0 = 11200, FEST1 = 14800, FIRE0 = 13200, FIRE1 = 14650;
  const COLS = [[1, 0.25, 0.3], [0.3, 1, 0.45], [0.35, 0.55, 1], [1, 0.8, 0.25], [0.8, 0.4, 1], [0.3, 1, 1], [1, 0.45, 0.8], [1, 1, 1]];

  // ---------------------------------------------------------------- when
  P.festivalDay = function (vil) {
    if (vil.festOff === undefined) {
      const sp = this.g.player && this.g.player.spawn, pz = vil.plan.plaza;
      // the village you start in celebrates on your first night
      vil.festOff = sp && Math.hypot(sp[0] - pz.x, sp[2] - pz.z) < 90 ? 0 : hashId(String(vil.id)) % 3;
    }
    return ((this.g.env.day || 0) + vil.festOff) % 3 === 0;
  };
  P.festivalOn = function (vil, tod) { return tod >= FEST0 && tod < FEST1 && this.festivalDay(vil); };

  // ---------------------------------------------------------------- hooks
  const baseSchedule = P.schedule;
  P.schedule = function (a, tod) {
    if (this.festivalOn(a.vil, tod)) return a.role === 'ranger' && a.p.idx === 0 && a.p.fam % 2 === 0 ? 'patrol' : 'festival';
    return baseSchedule.call(this, a, tod);
  };
  const baseRun = P.runAct;
  P.runAct = function (a, dt, tod) {
    if (a.act && a.act.type === 'festival') { a.act.t += dt; this.runFestival(a, a.act, dt, tod); return; }
    return baseRun.call(this, a, dt, tod);
  };
  const baseSocial = P.social;
  P.social = function (a, dt, tod) { if (a.act && a.act.type === 'festival') { a.talkCool = 3; return; } return baseSocial.call(this, a, dt, tod); };
  const baseActivate = P.activate;
  P.activate = function (vil, tod) {
    baseActivate.call(this, vil, tod);
    // arriving during the festival: nobody is in bed yet
    if (this.festivalOn(vil, tod)) for (const a of vil.agents) if (a.pose === 'sleep') { this.wake(a); a.act = null; }
  };
  const baseUpdateVillage = P.updateVillage;
  P.updateVillage = function (vil, dt, tod, d) { baseUpdateVillage.call(this, vil, dt, tod, d); this.updateFestival(vil, dt, tod); };
  const basePose = P.pose;
  P.pose = function (a, t) { const Q = basePose.call(this, a, t); a.drawOffY = 0; if (a.act && a.act.type === 'festival' && a.pose === 'stand') this.festPose(a, t, Q); return Q; };

  // ---------------------------------------------------------------- who does what
  P.festState = function (vil) {
    let F = vil.fest;
    const day = this.g.env.day || 0;
    if (!F || F.day !== day) {
      F = vil.fest = { day, rockets: [], lantT: 0, fireT: 3, cheerT: 4, opened: false, roles: new Map(), ring: [], inner: [], told: false };
      const adults = vil.agents.filter(a => !a.kid && !a.elder && !(a.role === 'ranger' && a.p.idx === 0 && a.p.fam % 2 === 0));
      const musicians = adults.filter(a => (a.p.seed >> 4) % 5 === 0).slice(0, 2);
      if (!musicians.length && adults.length > 3) musicians.push(adults[adults.length - 1]);
      for (const a of vil.agents) {
        let r = 'dance';
        if (musicians.includes(a)) r = 'music';
        else if (a.elder) r = 'watch';
        F.roles.set(a, r);
      }
      const dancers = vil.agents.filter(a => F.roles.get(a) === 'dance');
      const kids = dancers.filter(a => a.kid), grown = dancers.filter(a => !a.kid);
      // small villages: one big circle; bigger ones: the children dance an inner ring
      if (dancers.length <= 14 || kids.length < 3) F.ring = dancers; else { F.inner = kids; F.ring = grown; }
    }
    return F;
  };
  P.runFestival = function (a, act, dt, tod) {
    const vil = a.vil, pz = vil.plan.plaza, F = this.festState(vil);
    const cx = pz.x + 0.5, cz = pz.z + 0.5, PR = pz.r || 4;
    let role = F.roles.get(a);
    if (!role) { role = a.kid ? 'dance' : 'watch'; F.roles.set(a, role); }
    a.festRole = role;
    const d = Math.hypot(a.pos[0] - cx, a.pos[2] - cz);
    // walk over to the plaza first (real paths from home), then move freely on its open floor
    if (d > PR + 5) { this.goTo(a, pz.x, pz.y, pz.z, PR + 2); a.pose = 'stand'; return; }
    const t = this.time;
    if (role === 'dance') {
      const inner = F.inner.includes(a), list = inner ? F.inner : F.ring;
      const i = Math.max(0, list.indexOf(a)), n = Math.max(1, list.length);
      const r = inner ? Math.max(2.4, PR - 2.2) : (F.inner.length ? PR + 0.8 : Math.max(2.9, PR - 1.1));
      const dir = inner ? -1 : 1, w = (inner ? 0.34 : 0.22) * dir;
      const th = i / n * TAU + t * w;
      a.steer = [cx + Math.cos(th) * r, cz + Math.sin(th) * r];
      a.lookAt = null;
      a.pose = 'stand';
      if (Math.random() < dt * 0.025 && this.near(a, 22)) a.say(a.kid ? pick(['Wheee!', 'Dance with me!', 'Round and round!', 'Look at the lanterns!', 'Fireworks! Fireworks!']) : pick(['Happy Lantern Festival!', 'What a night!', 'Round we go!', 'Mind my toes!', 'I love this song!']), 2.2);
    } else if (role === 'music') {
      const b = vil.plan.bell || [pz.x - PR + 1, pz.y, pz.z + PR - 1];
      const k = F.roles.size ? [...F.roles.entries()].filter(e => e[1] === 'music').findIndex(e => e[0] === a) : 0;
      const sx = b[0] + 0.5 + (k === 1 ? 1.6 : 0), sz = b[2] + 0.5 - (k === 1 ? 0.2 : 1.4);
      if (Math.hypot(a.pos[0] - sx, a.pos[2] - sz) > 0.5) a.steer = [sx, sz];
      a.lookAt = [cx, pz.y + 1, cz];
      a.pose = 'stand';
      if (Math.random() < dt * 1.6) this.g.particles.spawn(a.pos[0] + (Math.random() - 0.5) * 0.6, a.pos[1] + 2.1, a.pos[2] + (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.4, 0.9, (Math.random() - 0.5) * 0.4, { life: 1.6, size: 0.09, grav: 0, col: pick([[1, 0.85, 0.3], [0.5, 1, 0.9], [1, 0.5, 0.8]]), emis: 1, drag: 0.4, collide: false });
    } else {
      // grandparents watch from a bench (or the edge of the plaza)
      const seats = pz.seats || [];
      const k = vil.agents.filter(o => F.roles.get(o) === 'watch').indexOf(a);
      const seat = seats[k] || null;
      if (seat) {
        if (a.pose === 'sit') return;
        if (this.goTo(a, seat[0], seat[1], seat[2], 0.8)) this.sit(a, seat);
      } else {
        const th = (k * 2.39 + 0.5), r = PR + 2;
        const sx = cx + Math.cos(th) * r, sz = cz + Math.sin(th) * r;
        if (Math.hypot(a.pos[0] - sx, a.pos[2] - sz) > 0.6) a.steer = [sx, sz];
        a.lookAt = [cx, pz.y + 1, cz]; a.pose = 'stand';
      }
      if (Math.random() < dt * 0.02 && this.near(a, 20)) a.say(pick(['Just like when I was young.', 'Look at them go!', 'The lanterns are lovely this year.', 'Ahh, the old songs.']), 2.6);
    }
  };
  P.festPose = function (a, t, Q) {
    const k = a.p.seed % 7;
    a.drawOffY = 0;
    const set = (part, rx, ry, rz) => { const o = Q[part] || [0, 0, 0, 0, 0, 0]; Q[part] = [rx, ry, rz, 0, o[4] || 0, 0]; };
    if (a.festRole === 'dance') {
      const ph = t * 5 + k;
      const hop = Math.abs(Math.sin(ph)) * (a.kid ? 2.4 : 1.4);
      set('arm_l', 2.3 + Math.sin(ph) * 0.45, 0, -0.5 - Math.cos(ph) * 0.2);
      set('arm_r', 2.3 - Math.sin(ph) * 0.45, 0, 0.5 + Math.cos(ph) * 0.2);
      for (const part of ['body', 'head', 'arm_l', 'arm_r', 'lids', 'mouth']) if (Q[part]) Q[part][4] = (Q[part][4] || 0) + hop * 0.35;
      if (Q.head) Q.head[2] = Math.sin(ph * 0.5) * 0.15;
      // the whole dancer hops (children higher)
      a.drawOffY = hop / 32 * (a.kid ? 2.6 : 1.4);
      return;
    } else if (a.festRole === 'music') {
      // strumming a lute: left hand on the neck, right hand strums; head nods to the beat
      set('arm_l', 1.15, 0.35, 0.55);
      set('arm_r', 0.85 + Math.sin(t * 13 + k) * 0.28, 0, -0.35);
      if (Q.head) Q.head[0] = -0.1 + Math.abs(Math.sin(t * 4.2)) * 0.18;
    }
  };

  // ---------------------------------------------------------------- lanterns, fireworks, announcements
  P.updateFestival = function (vil, dt, tod) {
    const g = this.g, pz = vil.plan.plaza;
    const on = this.festivalOn(vil, tod);
    const pl = g.player.pos, dPl = Math.hypot(pl[0] - pz.x, pl[2] - pz.z);
    // tell the player in the morning / as it starts
    if (this.festivalDay(vil) && dPl < 120) {
      vil.festTold = vil.festTold || {};
      const day = g.env.day || 0;
      if (tod < FEST0 && tod > 500 && vil.festTold.am !== day) { vil.festTold.am = day; if (g.ui && g.settings.toasts !== false) g.ui.toast('Festival tonight!', `${vil.name} celebrates the Lantern Festival at dusk — lanterns, dancing & fireworks.`, null); }
      if (on && vil.festTold.pm !== day) { vil.festTold.pm = day; if (g.ui) g.ui.chatLine(`🏮 The Lantern Festival has begun in ${vil.name}! Head to the plaza.`, '#ffd98a'); }
    }
    if (!on) { if (vil.fest && vil.fest.rockets.length) this.stepRockets(vil.fest, dt, vil); return; }
    const F = this.festState(vil);
    if (!F.opened && dPl < 60) {
      F.opened = true;
      if (g.codex && g.codex.event) g.codex.event('festival');
      const mayor = vil.agents.find(a => !a.kid && F.roles.get(a) === 'dance') || vil.agents[0];
      if (mayor) mayor.say('Welcome, everyone, to the Lantern Festival!', 4.5);
    }
    const cx = pz.x + 0.5, cz = pz.z + 0.5, y = pz.y, PR = pz.r || 4;
    // sky lanterns from dusk on
    F.lantT -= dt;
    if (tod > 12100 && F.lantT <= 0 && dPl < 260) {
      F.lantT = 0.55 + Math.random() * 0.6;
      const a = Math.random() * TAU, r = Math.random() * (PR + 2);
      g.particles.spawn(cx + Math.cos(a) * r, y + 1.6, cz + Math.sin(a) * r, 0.25 + Math.random() * 0.2, 0.75 + Math.random() * 0.5, 0.08 + (Math.random() - 0.5) * 0.2, { life: 26 + Math.random() * 8, size: 0.24, grav: 0, col: pick([[1, 0.45, 0.12], [1, 0.55, 0.16], [1, 0.38, 0.14], [1, 0.62, 0.22]]), emis: 0.45, drag: 0.02, collide: false });
    }
    // fireworks after dark
    F.fireT -= dt;
    if (tod > FIRE0 && tod < FIRE1 && F.fireT <= 0 && dPl < 320) {
      F.fireT = 1.6 + Math.random() * 2.4;
      const n = Math.random() < 0.25 ? 3 : 1;
      for (let k = 0; k < n; k++) {
        const cor = [[-1, -1], [1, -1], [-1, 1], [1, 1]][Math.floor(Math.random() * 4)];
        const sx = cx + cor[0] * (PR + 3), sz = cz + cor[1] * (PR + 3);
        F.rockets.push({ p: [sx, y + 1, sz], v: [(Math.random() - 0.5) * 3, 26 + Math.random() * 7, (Math.random() - 0.5) * 3], fuse: 1.15 + Math.random() * 0.45 + k * 0.25, col: pick(COLS), col2: pick(COLS), type: pick(['peony', 'peony', 'ring', 'willow', 'crossette', 'palm']), whistle: false });
      }
    }
    this.stepRockets(F, dt, vil);
    // cheering when a big one goes off
    F.cheerT -= dt;
  };
  P.stepRockets = function (F, dt, vil) {
    const g = this.g, pa = g.particles, pl = g.player.pos;
    // glittering tails: tiny white strobes around a spent burst
    if (F.glitter && F.glitter.length) {
      for (let i = F.glitter.length - 1; i >= 0; i--) {
        const G = F.glitter[i]; G.t -= dt;
        if (G.t < -0.8) { F.glitter.splice(i, 1); continue; }
        if (G.t > 0) continue;
        for (let k = 0; k < 5; k++) { const u = Math.random() * 2 - 1, a = Math.random() * TAU, q = Math.sqrt(1 - u * u), rr = G.r * (0.6 + Math.random() * 0.5); pa.spawn(G.x + q * Math.cos(a) * rr, G.y + u * rr - 1.5, G.z + q * Math.sin(a) * rr, 0, -0.5, 0, { life: 0.09, size: 0.22, grav: 0, col: [1, 1, 0.92], emis: 1.2, drag: 0, collide: false }); }
      }
    }
    for (let i = F.rockets.length - 1; i >= 0; i--) {
      const r = F.rockets[i];
      const dist = Math.hypot(r.p[0] - pl[0], r.p[2] - pl[2]);
      if (!r.whistle) { r.whistle = true; if (dist < 140) this.fwSound('launch', dist); }
      r.v[1] -= 9 * dt;
      for (let k = 0; k < 3; k++) r.p[k] += r.v[k] * dt;
      if (!r.sub) pa.spawn(r.p[0], r.p[1], r.p[2], (Math.random() - 0.5) * 0.6, -1.5, (Math.random() - 0.5) * 0.6, { life: 0.45 + Math.random() * 0.3, size: 0.08, grav: 1, col: [1, 0.75, 0.4], emis: 1, drag: 1.5, collide: false });
      r.fuse -= dt;
      if (r.fuse > 0) continue;
      F.rockets.splice(i, 1);
      this.burst(F, r, dist);
    }
  };
  P.burst = function (F, r, dist) {
    const g = this.g, pa = g.particles, [x, y, z] = r.p;
    const big = !r.sub;
    const N = r.sub ? 26 : r.type === 'willow' ? 90 : 120;
    const spd = r.sub ? 5 : r.type === 'willow' ? 9 : 13;
    // a random plane for rings
    const ax = Math.random() * TAU, ay = Math.random() * 0.9;
    for (let k = 0; k < N; k++) {
      let dx, dy, dz;
      if (r.type === 'ring' && !r.sub) {
        const a = k / N * TAU; const c = Math.cos(a), s = Math.sin(a);
        dx = c; dy = s * Math.sin(ay); dz = s * Math.cos(ay);
        const cx2 = Math.cos(ax), sx2 = Math.sin(ax); const tx = dx * cx2 - dz * sx2; dz = dx * sx2 + dz * cx2; dx = tx;
      } else if (r.type === 'palm' && !r.sub) {
        const a = (k % 8) / 8 * TAU + Math.random() * 0.1, e = 0.25 + (k / N) * 0.5;
        dx = Math.cos(a) * Math.cos(e); dy = Math.sin(e); dz = Math.sin(a) * Math.cos(e);
      } else {
        const u = Math.random() * 2 - 1, a = Math.random() * TAU, q = Math.sqrt(1 - u * u);
        dx = q * Math.cos(a); dy = u; dz = q * Math.sin(a);
      }
      const s = spd * (0.85 + Math.random() * 0.3);
      const col = k % 3 === 0 ? r.col2 : r.col;
      const willow = r.type === 'willow';
      const c = willow ? [1, 0.7, 0.28] : col, life = (willow ? 2.8 : 1.8) + Math.random() * 0.6;
      // a bright star and a dimmer, slower follower: each spark leaves a short streak
      pa.spawn(x, y, z, dx * s, dy * s, dz * s, { life, size: big ? 0.46 : 0.3, grav: willow ? 5 : 3.2, col: c, emis: 0.9, drag: willow ? 1.6 : 1.3, collide: false });
      pa.spawn(x, y, z, dx * s * 0.82, dy * s * 0.82, dz * s * 0.82, { life: life * 0.8, size: big ? 0.3 : 0.2, grav: willow ? 5 : 3.2, col: c, emis: 0.5, drag: willow ? 1.6 : 1.3, collide: false });
    }
    // flash, then glitter
    pa.spawn(x, y, z, 0, 0, 0, { life: 0.2, size: 4, grav: 0, col: [1, 0.95, 0.85], emis: 0.8, drag: 0, collide: false, grow: 8 });
    if (big && Math.random() < 0.6) F.glitter = (F.glitter || []).concat([{ x, y, z, t: 1.0, r: spd * 0.75 }]);
    if (r.type === 'crossette' && !r.sub) {
      for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + 0.4; F.rockets.push({ p: [x, y, z], v: [Math.cos(a) * 9, 3, Math.sin(a) * 9], fuse: 0.55, col: r.col2, col2: r.col, type: 'peony', sub: true, whistle: true }); }
    }
    if (dist < 320) this.fwSound(r.sub ? 'pop' : 'boom', dist);
    if (big && F.cheerT <= 0 && dist < 40) {
      F.cheerT = 5;
      const fans = this.agents.filter(a => a.act && a.act.type === 'festival');
      const a = fans[Math.floor(Math.random() * fans.length)];
      if (a) a.say(a.kid ? pick(['Ooooh!', 'Wow!!', 'Another one!', 'So pretty!']) : pick(['Aaah!', 'Beautiful!', 'Bravo!', 'Look at that one!']), 1.8);
    }
  };
  P.fwSound = function (kind, dist) {
    const au = this.g.audio; if (!au || !au.ctx) return;
    const c = au.ctx, t = c.currentTime, vol = Math.max(0, 1 - dist / 320);
    if (vol <= 0.02) return;
    if (kind === 'launch') {
      const o = au.tone(900, 0.05 * vol, 1.1, 'sine', true); if (o) o.frequency.exponentialRampToValueAtTime(2600, t + 1.0);
      return;
    }
    const delay = dist / 340; // sound travels
    const src = c.createBufferSource(); src.buffer = au.noise;
    const f = c.createBiquadFilter(); f.type = kind === 'pop' ? 'bandpass' : 'lowpass'; f.frequency.setValueAtTime(kind === 'pop' ? 2400 : 1400, t + delay); if (kind !== 'pop') f.frequency.exponentialRampToValueAtTime(90, t + delay + 1.2);
    const gn = c.createGain(); gn.gain.setValueAtTime(0, t); gn.gain.setValueAtTime((kind === 'pop' ? 0.25 : 0.9) * vol, t + delay); gn.gain.exponentialRampToValueAtTime(0.001, t + delay + (kind === 'pop' ? 0.25 : 1.5));
    src.connect(f); f.connect(gn); gn.connect(au.sfx); if (au.rev) gn.connect(au.rev); src.start(t + delay, 0, 1.6);
    if (kind === 'boom') { au.tone(60, 0.5 * vol, 0.6, 'sine', false, t + delay); for (let i = 0; i < 6; i++) au.tone(2200 + Math.random() * 2600, 0.03 * vol, 0.03, 'square', false, t + delay + 0.35 + Math.random() * 0.7); }
  };
  // is the player at a festival right now? (festive music)
  P.festivalNear = function () {
    const g = this.g, tod = g.env.timeOfDay, pl = g.player.pos;
    for (const vil of this.known.values()) {
      if (!vil.active) continue;
      const pz = vil.plan.plaza;
      if (Math.hypot(pl[0] - pz.x, pl[2] - pz.z) < 70 && this.festivalOn(vil, tod)) return vil;
    }
    return null;
  };
})(VR);

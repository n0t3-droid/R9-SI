// ============================================================================
// w-seasons · the festivals of the year (plan docs/superpowers/plans/2026-11-01-w-seasons.md; the calendar:
// seasons.js S.schedule). Extends VR.Villages after festival.js (the Lantern Festival's dance, music, sky lanterns):
//   the day before  a season's 2nd day the villagers decorate the plaza (the pieces appear one by one through the day,
//                   two or three of them at work there) and invite you — a line from someone near, one quiet notice
//   the evening     the season's 3rd day, the festival's hours (festival.js FEST0 … FEST1): the dance, the music, and
//     🌸 Blütenreigen      blossom arches at the plaza's four ways, a rain of petals · hang a garland on an arch
//     🪁 Drachenwindtag    kites high over the plaza, now and then one breaks loose and drifts down · catch it
//     🍂 Laubtafelfest     two long tables, lantern posts; the grown-ups sit and eat together · share the food
//     🕯 Lichterbaumnacht  a giant lantern tree over the well, candles in the houses' windows · hang a lantern
//     the other peoples (one festival each): glowing bowls round their plaza in their colours, their own lights
//                   (Gezeitenleuchten, Sandsternnacht, Funkelreigen, Steinglut, Eisblütennacht) · celebrate with them
//   the Wanderbuch  every festival seen once (S.record: meta.wander.festivals) — a quiet notice
// Presentation only: no block is placed, nothing collides, nothing new is saved but the Wanderbuch's ids.
// Cost: a village with no festival today — one table lookup per village frame. On the day: ≤ 40 decor models (one
// draw each, culled, 200 m), ≤ 6 particles a second (Very Low: none but the base festival's).
// ============================================================================
(function (VR) {
  'use strict';
  const S = VR.Seasons, Vs = VR.Villages, LK = VR.LifeKit;
  if (!S || !Vs || typeof document === 'undefined') return;
  const P = Vs.prototype;
  const T = (k, v, fb) => (VR.I18N ? VR.I18N.t(k, v, fb) : (fb !== undefined ? fb : k));
  const TL = (k) => (VR.I18N && VR.I18N.list ? VR.I18N.list(k) : []);
  const fill = (s, v) => String(s).replace(/\{(\w+)\}/g, (m, n) => (v && v[n] !== undefined ? v[n] : m));
  const pick = (a) => (a && a.length ? a[Math.floor(Math.random() * a.length)] : '');
  const TAU = Math.PI * 2;
  const FEST0 = 11200, FEST1 = 14800;
  const SF = S.Fest = {};

  // ---------------------------------------------------------------- the models (our own: boxes and ellipsoids)
  const M = VR.VOXMODELS, Grid = VR.VoxGrid;
  const h3 = (a, b, c) => (LK ? LK.h(a, b, c) : ((Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453) % 1 + 1) % 1);
  if (M && Grid) {
    const part = (sx, sy, sz, pv, fn) => { const gr = new Grid(sx, sy, sz, pv[0], pv[1], pv[2]); fn(gr); return { grid: gr, pivot: [0, 0, 0] }; };
    const one = (unit, radius, p) => ({ unit, radius, parts: { body: p }, layout: { body: [0, 0, 0] } });
    // a blossom arch (1 voxel = 1/8 m): two birch posts, a bow of pink and white blossom 3.5 m wide, 3.4 m high
    M.ss_arch = () => one(8, 2.4, part(30, 30, 6, [15, 0, 3], (gr) => {
      gr.box(1, 0, 2, 2, 22, 3, (x, y) => (y % 5 === 0 ? 0x5a4a3a : 0xe8e2d6)); gr.box(27, 0, 2, 28, 22, 3, (x, y) => (y % 5 === 2 ? 0x5a4a3a : 0xe8e2d6));
      for (let x = 1; x <= 28; x++) { const y = Math.round(21 + 6 * Math.sin(Math.PI * (x - 1) / 27)); gr.box(x, y, 2, x, y + 1, 3, 0x8a6a4a); }
      for (let k = 0; k < 60; k++) {
        const x = 1 + (k * 27) / 59, y = 21 + 6 * Math.sin(Math.PI * (x - 1) / 27) + 1, r = 1.4 + h3(k, 3, 1) * 1.3;
        const c = h3(k, 7, 2) < 0.55 ? 0xf2a6c0 : h3(k, 8, 2) < 0.5 ? 0xfbe6ee : 0xe07aa0;
        gr.ell(x, y + (h3(k, 1, 9) - 0.3) * 2, 3, r, r, 1.6, (xx, yy, zz) => ((xx + yy + zz) % 4 === 0 ? 0xfff4f8 : (xx * 3 + zz) % 7 === 0 ? 0x6aa84a : c));
      }
      for (const px of [2, 27]) for (let y = 4; y < 22; y += 4) gr.ell(px, y, 2.5, 1.5, 1.2, 1.5, (xx, yy) => (yy % 2 ? 0xf6b8cc : 0x7ab85a));
    }));
    // a garland (1/16 m): a ring of green with pink and white flowers
    M.ss_wreath = () => one(16, 0.4, part(11, 11, 2, [5, 5, 1], (gr) => {
      for (let a = 0; a < 40; a++) { const t = a / 40 * TAU, x = Math.round(5 + Math.cos(t) * 4), y = Math.round(5 + Math.sin(t) * 4); gr.box(x, y, 0, x, y, 1, a % 5 === 0 ? 0xf6a0c0 : a % 7 === 0 ? 0xffffff : 0x4a9a3a); }
    }));
    // the kites (1/8 m): a diamond in two colours, a cross of spars, a tail of bows
    const KC = [[0xe8483a, 0xf6d24a], [0x3a7ad8, 0xf4f0e6], [0x5abf6a, 0xf08a2a], [0xc060d8, 0x60d8e8]];
    for (let i = 0; i < KC.length; i++) M['ss_kite_' + i] = () => one(8, 2.2, part(13, 30, 1, [6, 15, 0], (gr) => {
      const [a, b] = KC[i];
      for (let y = 15; y < 30; y++) { const t = y < 24 ? (y - 15) / 9 : (29 - y) / 5, w = Math.round(6 * t); for (let x = 6 - w; x <= 6 + w; x++) gr.set(x, y, 0, (x < 6) === (y < 24) ? a : b); }
      gr.box(6, 15, 0, 6, 29, 0, 0x5a3a2a); gr.box(1, 24, 0, 11, 24, 0, 0x5a3a2a);
      for (let y = 0; y < 15; y++) { const x = 6 + Math.round(Math.sin(y * 0.7) * 1.2); gr.set(x, y, 0, 0xf4f0e6); if (y % 4 === 1) { gr.set(x - 1, y, 0, y % 8 === 1 ? a : b); gr.set(x + 1, y, 0, y % 8 === 1 ? a : b); } }
    }));
    // a long table (1/8 m): 6 m, a cream cloth with a red hem, benches both sides, plates, bread, pumpkins, apples, candles
    M.ss_table = () => one(8, 3.4, part(48, 8, 20, [24, 0, 10], (gr) => {
      gr.box(0, 0, 1, 47, 2, 3, 0x8a5a32); gr.box(0, 0, 17, 47, 2, 19, 0x8a5a32);   // the benches
      for (const x of [1, 46]) for (const z of [7, 12]) gr.box(x, 0, z, x, 5, z, 0x6a4422);
      gr.box(0, 5, 6, 47, 5, 13, (x, y, z) => (z === 6 || z === 13 ? 0xb83a2a : 0xf2e8d0));   // the cloth
      for (let x = 2; x < 46; x += 4) {
        for (const z of [7, 11]) gr.box(x, 6, z, x + 1, 6, z + 1, 0xfafafa);
        const k = (x / 4) | 0;
        if (k % 3 === 0) gr.ell(x + 2.5, 7, 9.5, 1.2, 1.1, 1.2, 0xe8862a);   // a pumpkin
        else if (k % 3 === 1) gr.box(x + 2, 6, 9, x + 3, 6, 10, 0xc8964a);   // bread
        else { gr.set(x + 2, 6, 9, 0xd83a2a); gr.set(x + 3, 6, 10, 0x8ac83a); }   // apples
        if (k % 2 === 0) { gr.set(x + 3, 6, 8, 0xf4f0e6); gr.set(x + 3, 7, 8, 0xf4f0e6); gr.set(x + 3, 8, 8, 0xffc860, 1); }   // a candle
      }
    }));
    // a lantern post (1/8 m): 2.4 m, a lantern on a hook
    M.ss_lpost = () => one(8, 1.6, part(7, 22, 5, [2, 0, 2], (gr) => {
      gr.box(1, 0, 1, 2, 19, 2, 0x4a3220); gr.box(2, 19, 1, 5, 19, 2, 0x4a3220);
      gr.box(4, 14, 1, 6, 17, 3, (x, y, z) => (y === 14 || y === 17 ? 0x2a1a10 : 0xffa040), { emis: 1 });
    }));
    // the giant lantern tree (1/4 m): a 9 m fir, snow on its tiers, lanterns on a spiral, a star on top
    M.ss_ltree = () => one(4, 6, part(26, 40, 26, [13, 0, 13], (gr) => {
      gr.box(12, 0, 12, 13, 8, 13, 0x5a3a22);
      for (let y = 4; y < 37; y++) {
        const u = (y - 4) / 33, tier = (y - 4) % 6, r = (1 - u) * 10.5 * (0.62 + 0.38 * (tier / 5)) + 0.6;
        for (let z = 0; z < 26; z++) for (let x = 0; x < 26; x++) {
          const d = Math.hypot(x + 0.5 - 13, z + 0.5 - 13); if (d > r || d < r - 2.2) continue;
          gr.set(x, y, z, tier === 5 && d > r - 1.2 ? 0xf2f6fa : ((x + z + y) % 5 === 0 ? 0x2a5a32 : 0x1e4a2a));
        }
      }
      const LC = [0xffb040, 0xff6a3a, 0xffe070, 0xff8ac0, 0x9ad8ff];
      for (let k = 0; k < 46; k++) {
        const u = k / 46, y = Math.round(5 + u * 30), a = k * 2.4, r = (1 - (y - 4) / 33) * 10.5 * 0.9 + 0.8;
        const x = Math.round(13 + Math.cos(a) * r - 0.5), z = Math.round(13 + Math.sin(a) * r - 0.5);
        gr.box(x, y, z, x, y - 1, z, LC[k % LC.length], { emis: 1 });
      }
      gr.ell(12.5, 38, 12.5, 1.6, 1.6, 1.6, 0xffe27a, { emis: 1 });
    }));
    // a hung lantern (1/16 m) and a window candle (1/16 m)
    M.ss_lantern = () => one(16, 0.3, part(5, 7, 5, [2, 0, 2], (gr) => { gr.box(1, 1, 1, 3, 5, 3, (x, y) => (y === 1 || y === 5 ? 0x8a2a1a : 0xffa040), { emis: 1 }); gr.set(2, 6, 2, 0x2a1a10); }));
    M.ss_candle = () => one(16, 0.25, part(3, 7, 3, [1, 0, 1], (gr) => { gr.box(0, 0, 0, 2, 0, 2, 0xd0b070); gr.box(1, 1, 1, 1, 4, 1, 0xf4ecd8); gr.box(1, 5, 1, 1, 6, 1, 0xffc860, { emis: 1 }); }));
    // the peoples' festival bowls (1/8 m): a pedestal in their stone, a glowing light in their colour
    const NB = { gezeiten: [0xd8d0b0, 0x5ae0f0], sandstern: [0xd8a860, 0xffd860], funkel: [0x9aa0b0, 0xe0a0ff], steinglut: [0x3a3a40, 0xff7a2a], eisbluete: [0xd8e8f4, 0x8ad0ff] };
    for (const id of Object.keys(NB)) M['ss_bowl_' + id] = () => one(8, 1.2, part(9, 14, 9, [4, 0, 4], (gr) => {
      const [st, gl] = NB[id];
      gr.box(2, 0, 2, 6, 1, 6, st); gr.box(3, 2, 3, 5, 7, 5, st); gr.ell(4, 8.5, 4, 3.6, 1.5, 3.6, st);
      gr.ell(4, 10.5, 4, 2.2, 2.4, 2.2, gl, { emis: 1 });
    }));
  }
  SF.KC = 4;

  // ---------------------------------------------------------------- what a village celebrates today
  const isRec = (o) => !!o && typeof o === 'object';
  P.ssToday = function (vil) {
    const g = this.g, day = g.env.day || 0;
    if (!vil.ss || vil.ss.day !== day) {
      const sp = vil.plan && vil.plan.species ? vil.plan.species : null;
      const on = S.on(g);
      const s = on ? S.schedule(day, g.dim || 'overworld', sp, S.lock(g)) : { phase: 'none', id: '' };
      vil.ss = { day, phase: s.phase, id: s.id, deco: null, told: {}, n: 0, kites: null, loose: null, said: 0, seen: false };
    }
    return vil.ss;
  };
  const base = { festivalDay: P.festivalDay, festState: P.festState, runFestival: P.runFestival, updateFestival: P.updateFestival, schedule: P.schedule, runAct: P.runAct, draw: P.draw, festPose: P.festPose };
  P.festivalDay = function (vil) { const s = this.ssToday(vil); return s.phase === 'fest' ? true : base.festivalDay.call(this, vil); };
  P.festState = function (vil) {
    const F = base.festState.call(this, vil);
    if (F && F.sk === undefined) { const s = this.ssToday(vil); F.sk = s.phase === 'fest' ? s.id : ''; }
    return F;
  };

  // ---------------------------------------------------------------- the decorations: where they stand
  const SEASONAL = { bluete: 1, drachen: 1, tafel: 1, lichter: 1 };
  P.ssDeco = function (vil, id) {
    const s = this.ssToday(vil);
    if (s.deco) return s.deco;
    const pz = vil.plan.plaza, cx = pz.x + 0.5, cz = pz.z + 0.5, y = pz.y, PR = pz.r || 4;
    const D = s.deco = [];
    const add = (m, x, yy, z, yaw, o) => D.push(Object.assign({ m, pos: [x, yy, z], yaw: yaw || 0, scale: 1 }, o || {}));
    if (id === 'bluete') {
      for (let k = 0; k < 4; k++) { const a = k * TAU / 4 + Math.PI / 4, r = PR + 1.6; add('ss_arch', cx + Math.cos(a) * r, y, cz + Math.sin(a) * r, -a - Math.PI / 2, { act: 'blossom' }); }
    } else if (id === 'drachen') {
      for (let k = 0; k < 4; k++) { const a = k * TAU / 4 + 0.6, r = PR + 1.4; add('ss_lpost', cx + Math.cos(a) * r, y, cz + Math.sin(a) * r, -a); }
    } else if (id === 'tafel') {
      for (const dz of [-3, 3]) add('ss_table', pz.x + 0.5, y, pz.z + 0.5 + dz, 0, { act: 'food', table: dz });
      for (let k = 0; k < 4; k++) { const sx = k & 1 ? 1 : -1, sz = k & 2 ? 1 : -1; add('ss_lpost', cx + sx * 4.2, y, cz + sz * 4.4, sx > 0 ? Math.PI : 0); }
    } else if (id === 'lichter') {
      add('ss_ltree', cx, y - 0.02, cz, 0.3, { act: 'lantern', big: true });
      // candles in the windows (the houses' outer windows, three a house at most)
      const w = this.g.world, R = VR.R; let n = 0;
      const nameAt = (x, yy, z) => { const st = w.getBlock(x, yy, z); const t = st && R.T ? R.types[R.T.type[st]] : null; return t ? t.name : ''; };
      for (const hm of vil.homes || []) {
        const b = hm && hm.box; if (!b || b.length !== 6 || n >= 40) continue;
        let m = 0;
        for (let yy = b[1] + 1; yy <= b[1] + 3 && m < 3; yy++) {
          for (let x = b[0] + 1; x < b[3] && m < 3; x++) for (const [z, nz] of [[b[2] + 1, -1], [b[5] - 1, 1]]) if (m < 3 && /window|glass/.test(nameAt(x, yy, z)) && !nameAt(x, yy, z + nz)) { add('ss_candle', x + 0.5, yy + 0.02, z + 0.5 + nz * 0.62, 0, { small: true }); m++; n++; }
          for (let z = b[2] + 1; z < b[5] && m < 3; z++) for (const [x, nx] of [[b[0] + 1, -1], [b[3] - 1, 1]]) if (m < 3 && /window|glass/.test(nameAt(x, yy, z)) && !nameAt(x + nx, yy, z)) { add('ss_candle', x + 0.5 + nx * 0.62, yy + 0.02, z + 0.5, 0, { small: true }); m++; n++; }
        }
      }
    } else if (S.FESTS[id] && S.FESTS[id].sp) {
      for (let k = 0; k < 6; k++) { const a = k * TAU / 6 + 0.3, r = PR + 1.2; add('ss_bowl_' + id, cx + Math.cos(a) * r, y, cz + Math.sin(a) * r, -a, k === 0 ? { act: 'native' } : null); }
    }
    return D;
  };
  // how far the decorating has come: the 2nd day from morning to late afternoon; all of it on the festival's day
  SF.decoK = function (phase, tod) { if (phase === 'fest') return tod < FEST1 + 2600 ? 1 : 1; if (phase !== 'prep') return 0; return Math.max(0, Math.min(1, (tod - 1500) / 8500)); };

  // ---------------------------------------------------------------- the decorators (the day before)
  P.schedule = function (a, tod) {
    const vil = a.vil, s = vil && vil.plan ? this.ssToday(vil) : null;
    if (s && s.phase === 'prep' && tod > 1500 && tod < 10000 && !a.kid && !a.elder && a.p && (a.p.seed >> 3) % 4 === 0) return 'ssdeco';
    return base.schedule.call(this, a, tod);
  };
  P.runAct = function (a, dt, tod) {
    if (a.act && a.act.type === 'ssdeco') {
      a.act.t = (a.act.t || 0) + dt;
      const vil = a.vil, s = this.ssToday(vil), D = this.ssDeco(vil, s.id), pz = vil.plan.plaza;
      if (!D.length) return;
      const k = Math.abs(a.p.seed) % D.length, d = D[k];
      if (Math.hypot(a.pos[0] - d.pos[0], a.pos[2] - d.pos[2]) > 2.2) { this.goTo(a, Math.floor(d.pos[0]), pz.y, Math.floor(d.pos[2]) + 1, 1.6); a.pose = 'stand'; return; }
      a.lookAt = [d.pos[0], d.pos[1] + 1.4, d.pos[2]]; a.pose = 'stand'; a.ssWork = true;
      if (Math.random() < dt * 0.03 && this.near(a, 18)) a.say(pick(TL('g.ss.deco')), 2.2);
      return;
    }
    a.ssWork = false;
    return base.runAct.call(this, a, dt, tod);
  };
  P.festPose = function (a, t, Q) {
    if (base.festPose) base.festPose.call(this, a, t, Q);
    if (a.ssSit && Q && Q.arm_r) { Q.arm_r = [1.1 + Math.sin(t * 2.2 + (a.p.seed % 5)) * 0.35, 0, 0.25, 0, Q.arm_r[4] || 0, 0]; }   // eating at the table
  };
  const pose0 = P.pose;
  P.pose = function (a, t) {
    const Q = pose0.call(this, a, t);
    if (a.ssWork && a.pose === 'stand' && Q) { const k = Math.sin(t * 3 + (a.p.seed % 7)); Q.arm_l = [2.6 + k * 0.25, 0, -0.3, 0, (Q.arm_l && Q.arm_l[4]) || 0, 0]; Q.arm_r = [2.5 - k * 0.25, 0, 0.3, 0, (Q.arm_r && Q.arm_r[4]) || 0, 0]; }   // hanging things up
    return Q;
  };

  // ---------------------------------------------------------------- the feast: who sits where (the long tables)
  P.runFestival = function (a, act, dt, tod) {
    const vil = a.vil, F = this.festState(vil);
    a.ssSit = false;
    if (F.sk === 'tafel' && !a.kid && F.roles.get(a) !== 'music') {
      const pz = vil.plan.plaza;
      const sitters = vil.agents.filter(o => !o.kid && F.roles.get(o) !== 'music');
      const i = sitters.indexOf(a);
      if (i >= 0 && i < 24) {
        const tb = i % 2 ? 3 : -3, side = (i >> 1) % 2 ? 1 : -1, sx = ((i >> 2) % 6) - 3;
        const seat = [pz.x + sx, pz.y, pz.z + tb + side, side > 0 ? 0 : 2];
        a.ssSit = true;
        if (a.pose === 'sit') { a.festRole = 'watch'; return; }
        if (this.goTo(a, seat[0], seat[1], seat[2], 0.7)) this.sit(a, seat);
        return;
      }
    }
    return base.runFestival.call(this, a, act, dt, tod);
  };

  // ---------------------------------------------------------------- each village frame
  P.updateFestival = function (vil, dt, tod) {
    const g = this.g, s = this.ssToday(vil);
    if (s.phase === 'none' || !s.id) return base.updateFestival.call(this, vil, dt, tod);
    const pz = vil.plan.plaza, pl = g.player.pos, dPl = Math.hypot(pl[0] - pz.x, pl[2] - pz.z);
    const day = g.env.day || 0, nm = S.name(s.id);
    // the base festival's own morning toast and its start line name the Lantern Festival: ours speak instead
    vil.festTold = vil.festTold || {}; vil.festTold.am = day; vil.festTold.pm = day;
    if (s.phase === 'prep' && dPl < 70 && !s.told.prep && tod > 1200 && tod < 11000) { s.told.prep = true; S.say(g, T('g.ss.prep', { v: vil.name, f: nm }), 2, 'ssprep'); }
    if (s.phase === 'prep' && dPl < 40 && s.said < 2) {
      const a = vil.agents.find(o => !o.kid && o.pose !== 'sleep' && this.near(o, 7) && !o.bubble);
      if (a && Math.random() < dt * 0.5) { a.say(fill(pick(TL('g.ss.invite')), { f: nm }), 3.4); s.said++; }
    }
    if (s.phase === 'fest' && tod > 1200 && tod < FEST0 && dPl < 120 && !s.told.am) { s.told.am = true; S.say(g, T('g.ss.today', { v: vil.name, f: nm }), 2, 'ssam'); }
    const wasOpen = vil.fest && vil.fest.day === day && vil.fest.opened;
    base.updateFestival.call(this, vil, dt, tod);
    if (s.phase !== 'fest') return;
    const on = this.festivalOn(vil, tod);
    if (!on) return;
    const F = this.festState(vil);
    if (!s.told.pm && dPl < 120) { s.told.pm = true; S.say(g, T('g.ss.begun', { ico: S.FESTS[s.id].ico, f: nm, v: vil.name }), 2, 'sspm'); }
    if (F.opened && !wasOpen) {
      const mayor = vil.agents.find(a => !a.kid) || vil.agents[0];
      if (mayor) mayor.say(SEASONAL[s.id] ? T('g.ss.mayor.' + s.id) : T('g.ss.mayor.native', { f: nm }), 4.5);
    }
    if (dPl < 45 && !s.seen) { s.seen = true; if (S.record(g.meta, s.id)) S.say(g, T('g.ss.book', { f: S.FESTS[s.id].ico + ' ' + nm }), 2, 'ssbook'); }
    // the gentle festivals keep the sky for their own: no fireworks for blossoms and kites, no sky lanterns for kites
    if (s.id === 'bluete' || s.id === 'drachen') F.fireT = 1e9;
    if (s.id === 'drachen') F.lantT = 1e9;
    if (Math.random() < dt * 0.02 && dPl < 25) { const a = vil.agents.find(o => o.act && o.act.type === 'festival' && !o.bubble && Math.random() < 0.3); if (a) a.say(pick(TL(SEASONAL[s.id] ? 'g.ss.chat.' + s.id : 'g.ss.chat.native')), 2.4); }
    this.ssAir(vil, s, dt, tod, dPl);
  };
  // the festival's own air: petals, the kites, the peoples' lights
  const NCOL = { gezeiten: [[0.4, 0.95, 1], [0.7, 1, 1]], sandstern: [[1, 0.85, 0.35], [1, 0.95, 0.6]], funkel: [[0.9, 0.6, 1], [0.6, 0.8, 1], [1, 0.7, 0.9]], steinglut: [[1, 0.5, 0.15], [1, 0.7, 0.3]], eisbluete: [[0.6, 0.85, 1], [0.9, 0.97, 1]] };
  P.ssAir = function (vil, s, dt, tod, dPl) {
    const g = this.g, pa = g.particles, pz = vil.plan.plaza, cx = pz.x + 0.5, cz = pz.z + 0.5, y = pz.y, PR = pz.r || 4;
    const tier = LK && LK.tierOf ? LK.tierOf(g.settings) : 2;
    if (s.id === 'drachen') this.ssKites(vil, s, dt);
    if (tier <= 0 || dPl > 140 || !pa) return;
    s.airT = (s.airT || 0) - dt;
    if (s.airT > 0) return;
    s.airT = tier >= 2 ? 0.16 : 0.4;
    if (s.id === 'bluete') {
      const a = Math.random() * TAU, r = Math.random() * (PR + 3);
      pa.spawn(cx + Math.cos(a) * r, y + 5 + Math.random() * 3, cz + Math.sin(a) * r, (Math.random() - 0.5) * 0.8, -0.3, (Math.random() - 0.5) * 0.8, { life: 9, size: 0.07, grav: 0.2, col: pick([[1, 0.78, 0.86], [1, 0.93, 0.96], [0.98, 0.62, 0.78]]), emis: 0.1, drag: 2.4, collide: true, wind: 1, turb: 1.4, force: true });
    } else if (NCOL[s.id]) {
      const a = Math.random() * TAU, r = PR + 1.2, col = pick(NCOL[s.id]);
      const up = s.id === 'sandstern' || s.id === 'eisbluete' ? -0.4 : 0.9;
      const sy = up < 0 ? y + 7 + Math.random() * 3 : y + 1.6;
      pa.spawn(cx + Math.cos(a) * r * Math.random(), sy, cz + Math.sin(a) * r * Math.random(), (Math.random() - 0.5) * 0.4, up, (Math.random() - 0.5) * 0.4, { life: 7, size: 0.12, grav: 0, col, emis: 1, drag: 0.6, collide: false, turb: 0.8, force: true });
    } else if (s.id === 'lichter' && tod > 12000) {
      // a glimmer rising from the tree now and then
      const a = Math.random() * TAU, hh = Math.random() * 7, r = (1 - hh / 9) * 2.3;
      pa.spawn(cx + Math.cos(a) * r, y + 1.2 + hh, cz + Math.sin(a) * r, 0, 0.25, 0, { life: 2.4, size: 0.07, grav: 0, col: [1, 0.85, 0.5], emis: 1, drag: 0.3, collide: false, force: true });
    }
  };
  // the kites: high over the plaza, swaying with the wind; every 35–55 s one breaks loose and drifts down onto the plaza
  P.ssKites = function (vil, s, dt) {
    const g = this.g, pz = vil.plan.plaza, cx = pz.x + 0.5, cz = pz.z + 0.5, y = pz.y, PR = pz.r || 4, t = this.time;
    if (!s.kites) { s.kites = []; for (let k = 0; k < 6; k++) s.kites.push({ k, pos: [cx, y + 16, cz], yaw: 0, pitch: 0.35, free: 1 }); s.looseT = 18; }
    const wd = g.env && g.env.E && g.env.E.windDir ? g.env.E.windDir : [0.8, 0.6];
    const yawW = Math.atan2(wd[0], wd[1]);   // facing the wind's source
    for (const K of s.kites) {
      if (K.fall) {
        K.fall.t += dt; const u = Math.min(1, K.fall.t / 8);
        const a = K.fall.from, b = K.fall.to;
        K.pos[0] = a[0] + (b[0] - a[0]) * u + Math.sin(K.fall.t * 1.7) * (1 - u) * 1.5;
        K.pos[1] = a[1] + (b[1] - a[1]) * (u * u * (3 - 2 * u));
        K.pos[2] = a[2] + (b[2] - a[2]) * u + Math.cos(K.fall.t * 1.3) * (1 - u) * 1.5;
        K.pitch = 0.35 + u * 1.15; K.yaw += dt * (1 - u) * 1.2;
        continue;
      }
      if (K.back) { K.back.t += dt; if (K.back.t > 6) K.back = null; }
      const ph = K.k * 1.7, r = PR * 0.6 + (K.k % 3) * 1.6, ang = K.k / 6 * TAU;
      const sx = cx + Math.cos(ang) * r + wd[0] * (10 + (K.k % 3) * 3), sz = cz + Math.sin(ang) * r + wd[1] * (10 + (K.k % 3) * 3);
      const lift = K.back ? Math.min(1, K.back.t / 6) : 1;
      K.pos[0] = sx + Math.sin(t * 0.7 + ph) * 1.2; K.pos[2] = sz + Math.cos(t * 0.6 + ph) * 1.2;
      K.pos[1] = y + 1 + lift * (14 + (K.k % 3) * 3 + Math.sin(t * 0.9 + ph) * 1.0);
      K.yaw = yawW + Math.sin(t * 0.8 + ph) * 0.25; K.pitch = 0.35 + Math.sin(t * 1.1 + ph) * 0.08;
    }
    s.looseT -= dt;
    if (s.looseT <= 0 && !s.kites.some(K => K.fall)) {
      s.looseT = 35 + Math.random() * 20;
      const K = s.kites[Math.floor(Math.random() * s.kites.length)];
      const a = Math.random() * TAU, r = 1.5 + Math.random() * Math.max(1, PR - 2);
      K.fall = { t: 0, from: K.pos.slice(), to: [cx + Math.cos(a) * r, y + 0.05, cz + Math.sin(a) * r] };
    }
  };

  // ---------------------------------------------------------------- the activities (the Aktion key, ctx.js)
  SF.near = function (g, eye, dir) {
    const V = g.villages; if (!V || !V.known || !S.on(g)) return null;
    const list = [];
    for (const vil of V.known.values()) {
      if (!vil.active || !vil.ss || !vil.ss.id || vil.ss.phase === 'none') continue;
      const s = vil.ss, pz = vil.plan.plaza; if (Math.abs(pz.x - eye[0]) > 40 || Math.abs(pz.z - eye[2]) > 40) continue;
      const tod = g.env.timeOfDay, on = s.phase === 'fest' && V.festivalOn(vil, tod), k = SF.decoK(s.phase, tod);
      const D = V.ssDeco(vil, s.id);
      const push = (key, pos, r, act) => { if (Math.abs(pos[0] - eye[0]) < 7 && Math.abs(pos[2] - eye[2]) < 7) list.push({ kind: 'fairy', name: T(key), pos, r, act }); };
      for (const d of D) {
        if (!d.act) continue;
        const ok = d.act === 'blossom' || d.act === 'lantern' ? (on || k > 0.5) : on;
        if (!ok) continue;
        const R0 = d.big ? 2.4 : d.act === 'food' ? 2.6 : 1.4;
        push('g.ss.act.' + d.act, [d.pos[0], d.pos[1] + (d.big ? 1.6 : 1.2), d.pos[2]], R0, (gg) => SF.act(gg, vil, d));
      }
      if (on && s.kites) for (const K of s.kites) if (K.fall && K.fall.t > 8) push('g.ss.act.kite', [K.pos[0], K.pos[1] + 0.5, K.pos[2]], 1.0, (gg) => SF.catchKite(gg, vil, K));
    }
    return list.length && VR.Ctx && VR.Ctx.pickNear ? VR.Ctx.pickNear(eye, dir, list) : null;
  };
  if (VR.Ctx && VR.Ctx.hooks && Array.isArray(VR.Ctx.hooks.near)) VR.Ctx.hooks.near.push((g, eye, dir) => SF.near(g, eye, dir));
  function thank(g, vil) {
    const p = g.player.pos;
    let best = null, bd = 1e9; for (const a of vil.agents) { const d = Math.hypot(a.pos[0] - p[0], a.pos[2] - p[2]); if (d < bd && a.pose !== 'sleep') { bd = d; best = a; } }
    if (best && bd < 14) best.say(pick(TL('g.ss.thanks')), 2.4);
  }
  SF.act = function (g, vil, d) {
    const s = vil.ss; if (!s) return false;
    const nm = S.name(s.id);
    if (d.act === 'blossom' || d.act === 'lantern') {
      d.hung = (d.hung || 0) + 1; s.n++;
      S.say(g, T('g.ss.act.' + d.act + 'Done', { n: d.hung }), 3, 'ssact');
    } else if (d.act === 'food') {
      S.say(g, T('g.ss.act.foodDone', { food: pick(TL('g.ss.food')) }), 3, 'ssact');
      if (g.player && g.player.hunger !== undefined) g.player.hunger = Math.min(20, (g.player.hunger || 0) + 4);
    } else if (d.act === 'native') {
      const sp = VR.WorldEco && VR.WorldEco.KINDS && vil.plan.species && VR.WorldEco.KINDS[vil.plan.species] ? VR.WorldEco.KINDS[vil.plan.species].species : null;
      S.say(g, T('g.ss.act.nativeDone', { sp: sp ? (VR.I18N && VR.I18N.lang === 'de' ? sp.de : sp.en) : '', f: nm }), 3, 'ssact');
    }
    if (S.record(g.meta, s.id)) S.say(g, T('g.ss.book', { f: S.FESTS[s.id].ico + ' ' + nm }), 2, 'ssbook');
    thank(g, vil);
    if (g.audio && g.audio.tone) { try { g.audio.tone(660, 0.05, 0.25, 'sine'); g.audio.tone(990, 0.04, 0.35, 'sine', false, (g.audio.ctx ? g.audio.ctx.currentTime : 0) + 0.12); } catch (e) { /* a nicety */ } }
    return true;
  };
  SF.catchKite = function (g, vil, K) {
    const s = vil.ss; if (!K.fall) return false;
    K.fall = null; K.back = { t: 0 }; s.n++;
    S.say(g, T('g.ss.act.kiteDone', { n: s.n }), 3, 'ssact');
    if (S.record(g.meta, s.id)) S.say(g, T('g.ss.book', { f: S.FESTS[s.id].ico + ' ' + S.name(s.id) }), 2, 'ssbook');
    const kid = vil.agents.find(a => a.kid && a.act && a.act.type === 'festival'); if (kid) kid.say(pick(TL('g.ss.thanks')), 2.4); else thank(g, vil);
    return true;
  };

  // ---------------------------------------------------------------- drawing (villages.draw, game.js drawOpaque)
  const MP = { scale: 1, pose: null, shade: 0, noShade: true, pitch: 0 };
  const DUMMY = [0, 0, 0];
  P.draw = function (r, E, cam) {
    const res = base.draw.apply(this, arguments);
    try { this.ssDraw(r, E, cam || r.cam); } catch (e) { if (!SF.err) { SF.err = String(e && e.message); console.warn('seasons_fest draw', e); } }
    return res;
  };
  SF.cost = { models: 0 };
  P.ssDraw = function (r, E, c) {
    const g = this.g; if (!LK || !g.entities || !c || !S.on(g)) return;
    let prog = null; const PG = () => prog || (prog = g.entities.beginVox(r, E));
    const tod = g.env.timeOfDay, tier = LK.tierOf ? LK.tierOf(g.settings) : 2;
    let n = 0;
    for (const vil of this.known.values()) {
      if (!vil.active) continue;
      const s = this.ssToday(vil); if (s.phase === 'none' || !s.id) continue;
      const pz = vil.plan.plaza, dx0 = pz.x - c.x, dz0 = pz.z - c.z; if (dx0 * dx0 + dz0 * dz0 > 220 * 220) continue;
      const k = SF.decoK(s.phase, tod); if (k <= 0) continue;
      const D = this.ssDeco(vil, s.id), N = D.length;
      for (let i = 0; i < N; i++) {
        const d = D[i];
        if (d.small && tier <= 0 && i % 2) continue;
        const u = Math.max(0, Math.min(1, (k * N - i) * 1.5)); if (u <= 0) continue;
        if (d.small) { const ddx = d.pos[0] - c.x, ddz = d.pos[2] - c.z; if (ddx * ddx + ddz * ddz > 90 * 90) continue; }
        MP.scale = (d.scale || 1) * (u < 1 ? 0.3 + 0.7 * u : 1); MP.pitch = 0;
        if (LK.drawModel(g, r, PG(), d.m, d.pos, d.yaw, c, MP)) n++;
        // what the player hung: garlands on the arch, lanterns on the tree
        if (d.hung) for (let j = 0; j < Math.min(d.hung, 14); j++) {
          let p;
          if (d.act === 'lantern') { const hh = 1.6 + (j * 0.53) % 6.2, a = j * 2.1 + 0.4, rr = (1 - (hh + 0.2) / 10) * 2.75 + 0.1; p = [d.pos[0] + Math.cos(a) * rr, d.pos[1] + hh, d.pos[2] + Math.sin(a) * rr]; }
          else { const ca = Math.cos(d.yaw), sa = Math.sin(d.yaw), off = -1.3 + (j % 7) * 0.43; p = [d.pos[0] + ca * off, d.pos[1] + 2.5 + Math.sin(Math.PI * (off + 1.6) / 3.3) * 0.5 - (j >= 7 ? 0.5 : 0), d.pos[2] - sa * off]; }
          MP.scale = 1; if (LK.drawModel(g, r, PG(), d.act === 'lantern' ? 'ss_lantern' : 'ss_wreath', p, d.yaw, c, MP)) n++;
        }
      }
      if (s.kites && s.phase === 'fest' && this.festivalOn(vil, tod)) for (const K of s.kites) { MP.scale = 1; MP.pitch = K.pitch; if (LK.drawModel(g, r, PG(), 'ss_kite_' + (K.k % SF.KC), K.pos, K.yaw, c, MP)) n++; MP.pitch = 0; }
    }
    void DUMMY; SF.cost.models = n;
  };

  // ---------------------------------------------------------------- the tests' and the pictures' handles
  SF.debug = {
    today: () => { const V = VR.game && VR.game.villages; if (!V) return null; const vil = [...V.known.values()].find(v => v.active); if (!vil) return null; const s = V.ssToday(vil); return { vil: vil.name, phase: s.phase, id: s.id, deco: V.ssDeco(vil, s.id).length, n: s.n, kites: s.kites ? s.kites.length : 0, fallen: s.kites ? s.kites.filter(K => K.fall).length : 0, plaza: vil.plan.plaza, sp: vil.plan.species || null }; },
    reset: () => { const V = VR.game && VR.game.villages; if (V) for (const vil of V.known.values()) { vil.ss = null; vil.fest = null; } },
    act: (what) => { const g = VR.game, V = g.villages; const vil = [...V.known.values()].find(v => v.active); if (!vil) return false; const s = V.ssToday(vil); const d = V.ssDeco(vil, s.id).find(x => x.act === what); return d ? SF.act(g, vil, d) : false; },
    drop: () => { const V = VR.game.villages; const vil = [...V.known.values()].find(v => v.active); const s = vil && vil.ss; if (!s || !s.kites) return false; s.looseT = 0; return true; },
    catchAny: () => { const g = VR.game, V = g.villages; const vil = [...V.known.values()].find(v => v.active); const s = vil && vil.ss; const K = s && s.kites && s.kites.find(x => x.fall); if (!K) return false; K.fall.t = 9; return SF.catchKite(g, vil, K); },
    cost: () => Object.assign({}, SF.cost),
  };
  void isRec;
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

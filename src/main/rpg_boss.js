// ============================================================================
// Der Turmgänger — the first boss (a-rpg; plan docs/superpowers/plans/2026-10-30-a-rpg.md). A great worker machine of
// the old beacon network, four-legged, a lantern tower on its back: once two outposts of a region are freed it rises at
// the region's Kernfeuer (amid the freed beacons) and guards it. Our own design, a machine that powers down — never
// hurt, never killed. The rules are VR.RPG.Boss (src/shared/rpg.js, test/rpg.js); here the game:
//   the model     rpg_walker (voxmodels' grid, 1/16 block, drawn ×2.2: about five and a half blocks tall) — hull,
//                 four legs, glowing knees (phase 1's weak points), a chest core behind two hatch plates (phases 2–3),
//                 the visor, the lantern on its tower; the glowing parts tinted at draw time
//   the fight     a mob of its own kind ('rpg_boss', foe: true — VR.Foes.ai / hurtMob / gone / draw are wrapped here for
//                 it alone): it rises from the ground, walks at the player, telegraphs every attack (a ring of sparks on
//                 the ground for the stomp, a line for the slam, three aiming lines for the bolts; a rising tone) —
//                 the knees and the core glow gold when open; phase 2: a shield and three shadow drones, phase 3: the
//                 overload (the core open, quicker)
//   calm          Begegnungen aus or 🧸 Kindersicher: it stands, its lantern flickers; [V] near it starts a calm ring
//                 (VR.Liberate's rules) — three a phase, no attack ever
//   the finish    it kneels and sinks, steam and plates; the lantern turns gold, a flash and a ring of light, the music
//                 swells with a rising chord, the land's tint clears (VR.Liberate.applyMood); the banner, XP and Taler
//                 (VR.Adv 'boss'), a boss find (splendid or radiant); the region healed (its tribute ×2, gold on the map)
// Cost 🟡 only within 120 m of a ready Kernfeuer: one mob, ≤ 11 draws, the telegraph's sparks only while it warns
// (halved on Very Low); nothing else anywhere.
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.RPG, F = VR.Foes, M = VR.VOXMODELS, Grid = VR.VoxGrid;
  if (!R || !F) return;
  const T = (k, v) => (VR.I18N ? VR.I18N.t(k, v) : k);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hasDoc = typeof document !== 'undefined' && !!document.createElement;
  const game = () => VR.game || null;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
  const TAU = Math.PI * 2, BB = R.BAL.boss, SC = 2.2;
  const BS = VR.RPGBoss = { cur: null, cost: { frames: 0, ms: 0, draws: 0, sparks: 0 }, healT: -1, healAt: null, note: {}, hintEl: null };
  BS.KEYS = ['g.rpg.boss.name', 'g.rpg.boss.awake', 'g.rpg.boss.phase', 'g.rpg.boss.shield', 'g.rpg.boss.warn.stomp', 'g.rpg.boss.warn.slam', 'g.rpg.boss.warn.fan', 'g.rpg.boss.weak', 'g.rpg.boss.calm', 'g.rpg.boss.calmOk', 'g.rpg.boss.calmMiss', 'g.rpg.boss.won.kick', 'g.rpg.boss.won.title', 'g.rpg.boss.won.sub', 'g.rpg.boss.hint', 'g.rpg.boss.ready', 'g.rpg.boss.funke'];

  // ---------------------------------------------------------------- the model
  if (M && Grid) {
    const part = (sx, sy, sz, pv, build) => { const g = new Grid(sx, sy, sz, pv[0], pv[1], pv[2]); build(g); return { grid: g, pivot: [0, 0, 0] }; };
    const WH = 0xe6dfd2, WH2 = 0xcfc5b4, OR = 0xe2702c, OR2 = 0xb4521c, GR = 0x5b616a, GR2 = 0x3a3f47, DK = 0x24272d, RU = 0x95603c, LENS = 0xf6f2ff;
    const wz = (b, x, y, z) => { const h = ((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) >>> 0; return h % 19 === 0 ? RU : h % 6 === 0 ? WH2 : b; };
    const leg = () => part(5, 20, 5, [2, 19, 2], (g) => { g.box(0, 10, 0, 4, 19, 4, GR); g.box(0, 2, 0, 4, 9, 4, (x, y, z) => (y === 6 ? OR : wz(WH, x, y, z))); g.box(-0, 0, -1, 4, 1, 5, DK); });
    M.rpg_walker = () => ({
      h: 5.4, w: 1.6, parts: {
        hull: part(24, 14, 24, [12, 0, 12], (g) => {
          g.ell(12, 7, 12, 11.6, 6.8, 11.6, (x, y, z) => (y <= 2 ? GR2 : y === 7 && ((x + z) & 3) !== 0 ? OR : y < 6 ? OR2 : wz(WH, x, y, z)), { shade: 0.08 });
          for (let x = 6; x <= 17; x += 2) for (let z = 18; z <= 21; z++) g.set(x, 11, z, DK);   // the back's vents
          g.box(7, 4, 0, 16, 10, 1, GR2);   // the chest's frame (the core sits in it)
        }),
        tower: part(10, 12, 10, [5, 0, 5], (g) => {
          g.box(1, 0, 1, 8, 9, 8, (x, y, z) => (y % 4 === 3 ? OR : wz(WH, x, y, z)), { shade: 0.06 });
          g.box(0, 10, 0, 9, 11, 9, GR2);
        }),
        lantern: part(6, 6, 6, [3, 0, 3], (g) => { g.ell(3, 3, 3, 2.8, 3, 2.8, LENS); }),
        visor: part(12, 2, 1, [6, 1, 0], (g) => { g.box(0, 0, 0, 11, 1, 0, LENS); }),
        core: part(8, 6, 1, [4, 3, 0], (g) => { g.ell(4, 3, 0.5, 3.8, 2.9, 1, LENS); }),
        hatch: part(5, 7, 1, [0, 3, 0], (g) => { g.box(0, 0, 0, 4, 6, 0, (x, y) => (y === 3 ? OR : WH)); }),
        knee: part(5, 3, 5, [2, 1, 2], (g) => { g.ell(2, 1, 2, 2.6, 1.6, 2.6, LENS); }),
        leg_fl: leg(), leg_fr: leg(), leg_bl: leg(), leg_br: leg(),
      },
      layout: { hull: [0, 18, 0], tower: [0, 31, 3], lantern: [0, 43, 3], visor: [0, 26, -11.6], core: [0, 25, -12.2], hatch: [0, 25, -12.6], knee: [0, 0, 0], leg_fl: [-9, 20, -8], leg_fr: [9, 20, -8], leg_bl: [-9, 20, 8], leg_br: [9, 20, 8] },
    });
  }
  // the mob kind (not enumerable: the codex's creature pages stay as they are)
  VR.MOBS = VR.MOBS || {};
  Object.defineProperty(VR.MOBS, 'rpg_boss', { value: { model: 'rpg_walker', hp: 1e6, speed: 1.6, w: 1.5, h: 5.2, foe: true, foeKind: 'boss', drops: [], xp: 0 }, enumerable: false, writable: true, configurable: true });

  // ---------------------------------------------------------------- the wraps (the boss alone; every other foe as before)
  const isB = (m) => !!(m && m.rpgBoss);
  { const o = F.ai; F.ai = function (En, m, dt) { if (isB(m)) return BS.ai(En, m, dt); return o.apply(this, arguments); }; }
  { const o = F.hurtMob; F.hurtMob = function (En, m, dmg, from) { if (isB(m)) return BS.hurt(En, m, dmg, from); return o.apply(this, arguments); }; F.hurtMob.__rpg = true; }   // (rpg.js's Kraft is inside; the boss takes it in BS.hurt)
  { const o = F.gone; F.gone = function (En, m) { if (isB(m)) return; return o.apply(this, arguments); }; }
  { const o = F.draw; F.draw = function (En, r, p, m, cam, time) { if (isB(m)) return BS.draw(En, r, p, m, cam, time); return o.apply(this, arguments); }; }
  { const L = VR.Liberate; if (L && L.frame) { const o = L.frame; L.frame = function (g, dt, eye, E) { const r = o.apply(this, arguments); try { BS.frame(g, dt, eye, E); } catch (e) { if (!BS.warned) { BS.warned = true; console.warn('rpg boss', e); } } return r; }; } }

  // ---------------------------------------------------------------- where: the regions' ready Kernfeuer
  const st = () => (VR.RPGame && VR.RPGame.st ? VR.RPGame.st() : null);
  const calmNow = (g) => { const A = VR.Adventure; return !A || !A.enc || A.enc() === 'off' || !!(g.settings && g.settings.kids); };
  BS.ready = function () {
    const s = st(); if (!s || !VR.RPGame) return [];
    return R.conquest(VR.RPGame.sites(), s).regions.filter(r => r.boss === 'ready' && r.core);
  };
  // 2 Hz: a note when a Kernfeuer wakes, the distance hint, the boss raised within 70 m, dropped beyond 130
  BS.look = function () {
    const g = game(); if (!g || g.state !== 'play' || !g.player || !g.entities || !F.on(g)) { BS.hint(null); return; }
    const pp = g.player.pos, list = BS.ready();
    let best = null, bd = 1e9;
    for (const r of list) { const d = Math.hypot(r.core[0] - pp[0], r.core[1] - pp[2]); if (d < bd) { bd = d; best = r; } const s = st(); if (s && !s.seen['bossnote:' + r.id]) { s.seen['bossnote:' + r.id] = 1; BS.say(g, T('g.rpg.boss.ready', { region: VR.RPGame.regionName(r) })); if (VR.RPGame.save) VR.RPGame.save(); } }
    const C = BS.cur;
    if (C && (C.m.dead || g.entities.mobs.indexOf(C.m) < 0 || Math.hypot(C.m.pos[0] - pp[0], C.m.pos[2] - pp[2]) > 130)) { if (!C.won) BS.drop(g); }
    if (!BS.cur && best && bd < 70 && g.world.isLoaded(best.core[0], best.core[1])) BS.raise(g, best);
    BS.hint(best && !BS.cur && bd < 900 ? { d: bd, dx: best.core[0] - pp[0], dz: best.core[1] - pp[2] } : null);
  };
  BS.raise = function (g, reg) {
    const x = reg.core[0] + 0.5, z = reg.core[1] + 0.5, y = g.world.topAt(Math.floor(x), Math.floor(z)) + 1;
    const m = g.entities.summon('rpg_boss', x, y, z); if (!m) return null;
    const A = VR.Adventure, band = A && A.rec ? A.rec.band : 'normal';
    m.rpgBoss = true; m.yaw = Math.atan2(-(g.player.pos[0] - x), -(g.player.pos[2] - z));
    const b = new R.Boss(band, calmNow(g));
    BS.cur = { m, b, rid: reg.id, reg, home: [x, y, z], rise: 0, tele: 0, flare: 0, walk: 0, open: 0, sink: 0, won: false, calm: null, fxT: 0, kneel: 0, said: {} };
    BS.say(g, T('g.rpg.boss.awake'));
    if (g.audio && g.audio.play) g.audio.play('thump', { vol: 1 });
    BS.bar(true);
    return m;
  };
  BS.drop = function (g) {
    const C = BS.cur; BS.cur = null; BS.bar(false); BS.calmUi(false);
    if (C && g.entities) { const i = g.entities.mobs.indexOf(C.m); if (i >= 0) g.entities.mobs.splice(i, 1); }
    if (C) for (const m of g.entities.mobs) if (m.foe && m.foe.rpgAdd && !m.foe.gone) { m.foe.rpgAdd = false; }
  };
  BS.say = function (g, txt) { const fk = g.funke; if (fk && fk.on && fk.on() && fk.show) fk.show(txt); else if (g.ui && g.ui.toast) g.ui.toast(txt, '', null); };

  // ---------------------------------------------------------------- the fight
  const addsUp = (En) => { let n = 0; for (const m of En.mobs) if (m.foe && m.foe.rpgAdd && !m.foe.gone && m.foe.st !== 'down') n++; return n; };
  BS.ai = function (En, m, dt) {
    const t0 = now(), g = En.game, C = BS.cur;
    if (!C || C.m !== m) { m.vel[0] = 0; m.vel[2] = 0; return; }
    const p = g.player, b = C.b, dx = p.pos[0] - m.pos[0], dz = p.pos[2] - m.pos[2], dist = Math.hypot(dx, dz);
    C.rise = Math.min(1, C.rise + dt / BB.intro);
    const ev = dist < 48 || b.st === 'stagger' || b.st === 'down' ? b.step(dt, { dist, adds: addsUp(En) }) : [];
    for (const e of ev) BS.event(g, En, C, e);
    // facing and walking: toward the player while idle or recovering, never far from its Kernfeuer
    const want = Math.atan2(-dx, -dz);
    let dy = want - m.yaw; while (dy > Math.PI) dy -= TAU; while (dy < -Math.PI) dy += TAU;
    const turn = b.st === 'idle' || b.st === 'recover' ? 1.4 : b.st === 'tele' && b.att !== 'stomp' ? 0.5 : 0;
    m.yaw += clamp(dy, -turn * dt, turn * dt);
    const home = Math.hypot(m.pos[0] - C.home[0], m.pos[2] - C.home[2]);
    let sp = 0;
    if (!b.calm && b.st === 'idle' && C.rise >= 1 && dist > 6.5 && dist < 48 && home < 24) sp = b.ph === 3 ? 2.4 : 1.6;
    else if (!b.calm && b.st === 'idle' && home >= 24) { sp = 1.6; m.yaw = Math.atan2(-(C.home[0] - m.pos[0]), -(C.home[2] - m.pos[2])); }
    m.vel[0] = -Math.sin(m.yaw) * sp; m.vel[2] = -Math.cos(m.yaw) * sp;
    C.walk += sp * dt * 1.6;
    C.tele = b.st === 'tele' ? Math.min(1, b.t / R.teleOf(b.att, b.band)) : 0;
    C.flare += ((b.st === 'tele' ? 1 : 0) - C.flare) * Math.min(1, dt * 6);
    C.open += ((b.open ? 1 : 0) - C.open) * Math.min(1, dt * 5);
    C.kneel += ((b.st === 'stagger' || b.st === 'down' || b.st === 'won' ? 1 : 0) - C.kneel) * Math.min(1, dt * 2.5);
    if (b.st === 'down' || b.st === 'won') C.sink = Math.min(1, C.sink + dt / BB.down);
    BS.fx(g, C, dt, dist);
    if (C.calm) BS.stepCalm(g, C);
    if ((C.barT = (C.barT || 0) - dt) <= 0) { C.barT = 0.15; BS.bar(true); }
    const c = BS.cost; c.frames++; c.ms += now() - t0;
  };
  BS.event = function (g, En, C, e) {
    const m = C.m, b = C.b, au = g.audio, P = g.particles;
    if (e.startsWith('tele:')) { BS.warn(T('g.rpg.boss.warn.' + b.att)); if (au && au.ctx && au.tone) { const t = au.ctx.currentTime; [196, 247, 294, 370].forEach((f, i) => au.tone(f, 0.05, 0.3, 'sawtooth', false, t + i * (R.teleOf(b.att, b.band) / 5))); } return; }
    if (e.startsWith('strike:')) { BS.strike(g, C, b.att); return; }
    if (e === 'recover') { if (!C.said.weak) { C.said.weak = 1; BS.say(g, T('g.rpg.boss.weak')); } BS.warn(''); return; }
    if (e === 'fight') { BS.say(g, T(b.calm ? 'g.rpg.boss.calm' : 'g.rpg.boss.funke')); return; }
    if (e === 'phase2' || e === 'phase3') { BS.warn(T('g.rpg.boss.phase', { n: b.ph })); if (P) P.spark(m.pos[0], m.pos[1] + 3.5, m.pos[2], [1, 0.8, 0.4], 40, 6, 1); if (au && au.play) au.play('thump', { vol: 1 }); return; }
    if (e === 'shield:on') { BS.say(g, T('g.rpg.boss.shield')); return; }
    if (e.startsWith('adds:')) { BS.adds(g, En, C, +e.slice(5)); return; }
    if (e === 'won') { BS.finish(g, C); return; }
  };
  BS.adds = function (g, En, C, n) {
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n + 0.4, x = C.m.pos[0] + Math.cos(a) * 9, z = C.m.pos[2] + Math.sin(a) * 9;
      const gy = g.world.isLoaded(Math.floor(x), Math.floor(z)) ? g.world.topAt(Math.floor(x), Math.floor(z)) : C.m.pos[1];
      const m = En.summon('foe_drone', x, gy + 5, z); if (!m) continue;
      m.foe = F.make('drone', m.id, m.pos); m.foe.rpgAdd = true; m.foe.wave = true; m.foe.st = 'approach'; m.foe.cool = 1.2 + i * 0.7;
      if (g.particles) g.particles.spark(x, gy + 5, z, [0.8, 0.4, 1], 16, 3, 1);
    }
  };
  // the strikes: the ground's ring, the slam's band, three slow bolts — each was announced ≥ 0.6 s before
  BS.strike = function (g, C, att) {
    const m = C.m, p = g.player, P = g.particles, dx = p.pos[0] - m.pos[0], dz = p.pos[2] - m.pos[2], dist = Math.hypot(dx, dz);
    const hit = (dmg) => { F.hitPlayer(g, { p: p, dmg, kind: 'boss', x: m.pos[0], y: m.pos[1] + 1, z: m.pos[2] }); if (p.vel && dist > 0.1) { p.vel[0] += dx / dist * 9; p.vel[2] += dz / dist * 9; p.vel[1] = Math.max(p.vel[1], 6); } };
    if (att === 'stomp') {
      if (dist < BB.stompR && Math.abs(p.pos[1] - m.pos[1]) < 2.2) hit(BB.dmg.stomp);
      if (P) for (let i = 0; i < 28; i++) { const a = i * TAU / 28; P.spawn(m.pos[0] + Math.cos(a) * 2, m.pos[1] + 0.2, m.pos[2] + Math.sin(a) * 2, Math.cos(a) * 9, 1.5, Math.sin(a) * 9, { life: 0.7, size: 0.22, grav: 2, col: [0.75, 0.68, 0.58], drag: 2, collide: false }); }
      if (g.audio && g.audio.play) g.audio.play('thump', { vol: 1 });
    } else if (att === 'slam') {
      const fx = -Math.sin(m.yaw), fz = -Math.cos(m.yaw), al = dx * fx + dz * fz, lat = Math.abs(dx * fz - dz * fx);
      if (al > 0 && al < BB.slamR && lat < 1.8 && Math.abs(p.pos[1] - m.pos[1]) < 2.5) hit(BB.dmg.slam);
      if (P) for (let i = 0; i < 18; i++) { const d = 2 + i * (BB.slamR - 2) / 18; P.spark(m.pos[0] + fx * d, m.pos[1] + 0.3, m.pos[2] + fz * d, [1, 0.6, 0.3], 3, 3, 1); }
      if (g.audio && g.audio.play) g.audio.play('thump', { vol: 0.9 });
    } else if (att === 'fan') {
      const o = [m.pos[0] - Math.sin(m.yaw) * 2.6, m.pos[1] + 26 / 16 * SC, m.pos[2] - Math.cos(m.yaw) * 2.6], base = Math.atan2(p.pos[0] - o[0], p.pos[2] - o[2]);
      const tY = p.pos[1] + 1 - o[1], hd = Math.hypot(p.pos[0] - o[0], p.pos[2] - o[2]) || 1, v = 9;
      for (const s of [-0.3, 0, 0.3]) { const a = base + s; F.bolts.push({ pos: o.slice(), vel: [Math.sin(a) * v, tY / hd * v, Math.cos(a) * v], dmg: BB.dmg.fan, k: 'sentry', owner: -7, t: 0 }); }
      if (g.audio && g.audio.play) g.audio.play('laser');
    }
  };
  // a hit on the boss: the knees in phase 1 (low), the chest core from the front in 2 and 3; Kraft counts
  BS.hurt = function (En, m, dmg, from) {
    const C = BS.cur, g = En.game; if (!C || C.m !== m || !(dmg > 0)) return;
    const b = C.b, P = g.particles, k = VR.RPGame && VR.RPGame.mods() ? VR.RPGame.mods().dmg : 1;
    let zone = 'body';
    if (from) {
      const hy = from[1] - m.pos[1], dx = from[0] - m.pos[0], dz = from[2] - m.pos[2], l = Math.hypot(dx, dz) || 1, front = (dx / l) * -Math.sin(m.yaw) + (dz / l) * -Math.cos(m.yaw);
      zone = b.ph === 1 ? (hy < 2.8 ? 'weak' : 'body') : (front > 0.35 && hy > 2.0 && hy < 5 ? 'weak' : 'body');
    }
    const shielded = b.shield, d = b.hit(dmg * k, zone);
    const hp = from ? [from[0], from[1], from[2]] : [m.pos[0], m.pos[1] + 3, m.pos[2]];
    if (P) {
      if (shielded) P.spark(hp[0], hp[1], hp[2], [0.5, 0.8, 1], 6, 2, 1);
      else if (d > dmg * k) P.spark(hp[0], hp[1], hp[2], [1, 0.9, 0.35], 14, 4, 1);
      else P.spark(hp[0], hp[1], hp[2], [1, 0.6, 0.3], 5, 2, 1);
    }
    if (d > 0) { m.hitT = 0.2; if (g.audio && g.audio.play && Math.random() < 0.5) g.audio.play('hit'); }
    BS.bar(true);
  };

  // ---------------------------------------------------------------- the telegraphs and the boss's own life (sparks)
  BS.fx = function (g, C, dt, dist) {
    const P = g.particles; if (!P || dist > 70) return;
    const m = C.m, b = C.b, lo = g.settings && g.settings.preset === 'potato';
    if ((C.fxT -= dt) > 0) return; C.fxT = lo ? 0.16 : 0.08;
    if (C.rise < 1) { for (let i = 0; i < (lo ? 3 : 6); i++) { const a = Math.random() * TAU, r = 1.5 + Math.random() * 2.5; P.spawn(m.pos[0] + Math.cos(a) * r, m.pos[1] + 0.2, m.pos[2] + Math.sin(a) * r, 0, 1.5 + Math.random(), 0, { life: 1.2, size: 0.3, grav: -0.2, col: [0.6, 0.55, 0.5], drag: 1, collide: false }); } BS.cost.sparks += 6; }
    if (b.st === 'tele') {
      const u = C.tele, n = lo ? 12 : 22;
      if (b.att === 'stomp') { for (let i = 0; i < n; i++) { const a = i * TAU / n + u; P.spawn(m.pos[0] + Math.cos(a) * BB.stompR * (0.4 + 0.6 * u), m.pos[1] + 0.15, m.pos[2] + Math.sin(a) * BB.stompR * (0.4 + 0.6 * u), 0, 0.6, 0, { life: 0.25, size: 0.16, grav: 0, col: [1, 0.35 + 0.3 * u, 0.15], emis: 1, collide: false }); } }
      else if (b.att === 'slam') { const fx = -Math.sin(m.yaw), fz = -Math.cos(m.yaw); for (let i = 0; i < n * 0.6; i++) { const d = 2 + i * (BB.slamR - 2) / (n * 0.6); for (const s of [-1.6, 1.6]) P.spawn(m.pos[0] + fx * d + fz * s, m.pos[1] + 0.15, m.pos[2] + fz * d - fx * s, 0, 0.4, 0, { life: 0.22, size: 0.14, grav: 0, col: [1, 0.45, 0.2], emis: 1, collide: false }); } }
      else { const p = g.player.pos, o = [m.pos[0], m.pos[1] + 3.6, m.pos[2]], base = Math.atan2(p[0] - o[0], p[2] - o[2]), hd = Math.hypot(p[0] - o[0], p[2] - o[2]); for (const s of [-0.3, 0, 0.3]) for (let i = 1; i < 8; i++) { const d = i * hd / 8 * u; P.spawn(o[0] + Math.sin(base + s) * d, o[1] + (p[1] + 1 - o[1]) * i / 8 * u, o[2] + Math.cos(base + s) * d, 0, 0, 0, { life: 0.18, size: 0.1, grav: 0, col: [0.9, 0.4, 1], emis: 1, collide: false }); } }
      BS.cost.sparks += n;
    }
    if (b.shield) { for (let i = 0; i < (lo ? 6 : 14); i++) { const a = Math.random() * TAU, e = Math.random() * Math.PI * 0.5; P.spawn(m.pos[0] + Math.cos(a) * Math.cos(e) * 4.2, m.pos[1] + 0.5 + Math.sin(e) * 5, m.pos[2] + Math.sin(a) * Math.cos(e) * 4.2, 0, 0, 0, { life: 0.3, size: 0.12, grav: 0, col: [0.45, 0.75, 1], emis: 1, collide: false }); } }
    if (b.st === 'down' || b.st === 'won') { if (Math.random() < 0.6) P.spawn(m.pos[0] + (Math.random() - 0.5) * 3, m.pos[1] + 2 + Math.random() * 2, m.pos[2] + (Math.random() - 0.5) * 3, 0, 1.5, 0, { life: 1.6, size: 0.35, grav: -0.3, col: [0.85, 0.85, 0.9], drag: 0.8, collide: false }); if (Math.random() < 0.3) P.spark(m.pos[0], m.pos[1] + 3, m.pos[2], [1, 0.8, 0.4], 6, 3, 1); }
  };

  // ---------------------------------------------------------------- the calm version: [V] near it, a calm ring
  BS.calmTap = function (g) {
    const C = BS.cur; if (!C || !C.b.calm || C.b.st !== 'idle') return false;
    const d = Math.hypot(g.player.pos[0] - C.m.pos[0], g.player.pos[2] - C.m.pos[2]); if (d > 9) return false;
    const L = VR.Liberate, A = VR.Adventure, ges = A && A.rec ? A.rec.me.pts.ges | 0 : 0, t = now() / 1000;
    if (!C.calm) { C.calm = L && L.calmStart ? L.calmStart(Math.random, ges, t) : { t0: t, c: 180, w: 90 }; BS.calmUi(true); return true; }
    const ok = L && L.calmPress ? L.calmPress(C.calm, t) : true; C.calm = null; BS.calmUi(false);
    if (ok) { C.b.calmHit(true); if (g.particles) g.particles.spark(C.m.pos[0], C.m.pos[1] + 3.5, C.m.pos[2], [0.5, 1, 0.8], 30, 4, 1); BS.warn(T('g.rpg.boss.calmOk')); }
    else BS.warn(T('g.rpg.boss.calmMiss'));
    BS.bar(true);
    return true;
  };
  BS.stepCalm = function (g, C) {
    const el = hasDoc && document.getElementById('rpgcalm'); if (!el || !C.calm) return;
    const L = VR.Liberate, a = L && L.calmNeedle ? L.calmNeedle(C.calm, now() / 1000) : 0;
    const nd = el.querySelector('.nd'); if (nd) nd.style.transform = `rotate(${a}deg)`;
    if (now() / 1000 - C.calm.t0 > 6) { C.calm = null; BS.calmUi(false); }
  };
  BS.calmUi = function (on) {
    if (!hasDoc) return; css();
    let el = document.getElementById('rpgcalm');
    if (!on) { if (el) el.style.display = 'none'; return; }
    if (!el) { el = document.createElement('div'); el.id = 'rpgcalm'; (document.getElementById('app') || document.body).appendChild(el); }
    const C = BS.cur, w = C && C.calm ? C.calm.w : 90, c0 = C && C.calm ? C.calm.c : 0;
    el.innerHTML = `<svg viewBox="-60 -60 120 120"><circle r="46" class="bg"/><path class="arc" d="${arcPath(c0 - w / 2, c0 + w / 2, 46)}"/><g class="nd"><line x1="0" y1="0" x2="0" y2="-52"/></g></svg><div>${esc(T('g.rpg.boss.calm'))}</div>`;
    el.style.display = '';
  };
  const arcPath = (a0, a1, r) => { const p = (a) => [Math.sin(a * Math.PI / 180) * r, -Math.cos(a * Math.PI / 180) * r]; const s = p(a0), e = p(a1); return `M${s[0].toFixed(1)} ${s[1].toFixed(1)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${e[0].toFixed(1)} ${e[1].toFixed(1)}`; };
  if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('keydown', (e) => {
    if (e.code !== 'KeyV' || e.repeat) return;
    const g = game(); if (!g || g.state !== 'play' || !BS.cur || (g.ui && (g.ui.typing || g.ui.screen))) return;
    if (BS.calmTap(g)) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);

  // ---------------------------------------------------------------- the finish: the region heals
  BS.finish = function (g, C) {
    if (C.won) return; C.won = true;
    const s = st(), A = VR.Adventure, m = C.m, P = g.particles, au = g.audio, RG = VR.RPGame;
    if (s) { s.won[C.rid] = Date.now(); s.healed[C.rid] = 1; }
    let r = null; if (A && A.award) r = A.award('boss', { id: 'rpg:' + C.rid });
    if (P) { P.spark(m.pos[0], m.pos[1] + 5, m.pos[2], [1, 0.9, 0.5], 90, 9, 1); P.spark(m.pos[0], m.pos[1] + 5, m.pos[2], [0.6, 1, 1], 60, 6, 1); for (let i = 0; i < 60; i++) { const a = i * TAU / 60; P.spawn(m.pos[0], m.pos[1] + 0.5, m.pos[2], Math.cos(a) * 16, 0.5, Math.sin(a) * 16, { life: 1.6, size: 0.25, grav: 0, col: [1, 0.85, 0.45], emis: 1, drag: 0.6, collide: false }); } }
    const L = VR.Liberate; if (L && L.bloom) L.bloom();
    if (au && au.play) au.play('thump', { vol: 1 });
    if (au && au.swell) au.swell(g.env ? g.env.day | 0 : 0, 1);
    if (au && au.ctx && au.tone) { const t = au.ctx.currentTime + 0.3; [262, 330, 392, 523, 659, 784, 1047].forEach((f, i) => { au.tone(f, 0.08, 3 - i * 0.2, 'sine', true, t + i * 0.14); au.tone(f * 1.5, 0.03, 2, 'triangle', true, t + i * 0.14 + 0.02); }); }
    BS.healAt = [m.pos[0], m.pos[2]]; BS.healT = 0;
    BS.banner(g, r);
    if (VR.EventLog && VR.EventLog.emit) VR.EventLog.emit('milestone', 'boss', 5, [m.pos[0], m.pos[1] + 4, m.pos[2]], 'rpg', 60);
    if (RG) { setTimeout(() => RG.find('b:' + C.rid, 'boss'), 5200); RG.save(); }
    BS.bar(false); BS.calmUi(false); BS.warn('');
    setTimeout(() => { if (BS.cur === C) BS.drop(g); }, 9000);
  };
  BS.banner = function (g, r) {
    if (!hasDoc) return; css();
    let el = document.getElementById('rpgwon');
    if (!el) { el = document.createElement('div'); el.id = 'rpgwon'; (document.getElementById('app') || document.body).appendChild(el); }
    const xp = r && r.xp ? r.xp : 0, tl = r ? (r.taler || 0) + (r.gift || 0) : 0;
    el.innerHTML = `<div class="rays"></div><div class="kick">${esc(T('g.rpg.boss.won.kick'))}</div><div class="big">${esc(T('g.rpg.boss.won.title'))}</div><div class="sub">${esc(T('g.rpg.boss.won.sub', { xp, t: tl }))}</div>`;
    el.className = ''; void el.offsetWidth; el.className = 'on';
    clearTimeout(BS.banT); BS.banT = setTimeout(() => { el.className = 'off'; BS.banT = setTimeout(() => { el.className = ''; }, 900); }, 5200);
  };
  // the land's tint: red-violet round a waiting Turmgänger, cleared by the finish (VR.Liberate's grade)
  BS.frame = function (g, dt, eye, E) {
    const L = VR.Liberate; if (!L || !L.applyMood || !E || !E.grade) return;
    const C = BS.cur;
    if (BS.healT >= 0) { BS.healT += dt; const H = L.heal(BS.healT); L.applyMood(E, 0, H.c); if (BS.healT > 6) BS.healT = -1; return; }
    if (C && !C.won) { const d = Math.hypot(C.m.pos[0] - eye[0], C.m.pos[2] - eye[2]); const k = L.moodK ? L.moodK(d) : 0; if (k > 0) L.applyMood(E, k * 0.9, 0); }
  };

  // ---------------------------------------------------------------- drawing (the vox program is bound: F.draw's way)
  const mat4 = VR.mat4, M1 = mat4 ? mat4.create() : null, MB = mat4 ? mat4.create() : null, ID = mat4 ? mat4.create() : null;
  const ONE = [1, 1, 1], TN = [1, 1, 1], TK = [1, 1, 1];
  function part(r, p, model, name, base, L, rx, ry, rz, tint, flash) {
    const pr = model.parts[name]; if (!pr) return;
    const gl = r.gl, t = M1; t.set(base);
    const lay = L || model.def.layout[name];
    mat4.translate(t, t, lay[0], lay[1], lay[2]);
    if (ry) mat4.rotY(t, t, ry); if (rx) mat4.rotX(t, t, rx); if (rz) mat4.rotZ(t, t, rz);
    gl.uniform3f(p.u.u_tint, tint[0], tint[1], tint[2]); gl.uniform1f(p.u.u_flash, flash || 0);
    gl.uniformMatrix4fv(p.u.u_model, false, t);
    gl.bindVertexArray(pr.vao); gl.drawArrays(gl.TRIANGLES, 0, pr.count);
    BS.cost.draws++;
  }
  const LP = [0, 0, 0];
  BS.draw = function (En, r, p, m, cam) {
    const C = BS.cur; if (!C || C.m !== m || !mat4) return;
    const gl = r.gl, model = VR.getVoxModel(gl, 'rpg_walker'); if (!model) return;
    const b = C.b, light = En.lightAt(m.pos[0], m.pos[1] + 3, m.pos[2]);
    gl.uniform1f(p.u.u_sky, light.sky); gl.uniform3f(p.u.u_blockLight, light.bl[0], light.bl[1], light.bl[2]);
    if (p.u.u_sunShadow) gl.uniform1f(p.u.u_sunShadow, 0);
    gl.uniform1f(p.u.u_noFog, 0);
    const rise = 1 - Math.pow(1 - C.rise, 2), sink = C.sink;
    const lift = b.st === 'tele' && b.att === 'stomp' ? C.tele * 0.9 : b.st === 'strike' && b.att === 'stomp' ? -0.15 : 0;
    const B = MB; B.set(ID);
    mat4.translate(B, B, m.pos[0] - cam.x, m.pos[1] - cam.y - (1 - rise) * 5.5 - sink * 1.6 + lift - C.kneel * 0.5, m.pos[2] - cam.z);
    mat4.rotY(B, B, m.yaw);
    if (C.kneel > 0.01) mat4.rotX(B, B, -0.16 * C.kneel);
    if (b.st === 'tele' && b.att === 'fan') mat4.rotX(B, B, 0.08 * C.tele);
    mat4.scale(B, B, SC / 16, SC / 16, SC / 16);
    const fl = m.hitT > 0 ? (m.hitT -= 0.016, 0.6) : 0;
    // the tints: red-violet when disturbed (the warning brighter), gold where it is open, cyan-gold when healed
    const healed = C.won, pul = 0.5 + 0.5 * Math.sin(now() / 160);
    if (healed) { TN[0] = 1.5; TN[1] = 1.25; TN[2] = 0.5; } else { TN[0] = 1.25 + 0.5 * C.flare; TN[1] = 0.3 + 0.2 * C.flare; TN[2] = 1.05 + 0.2 * C.flare; }
    TK[0] = TN[0] + (1.7 - TN[0]) * C.open; TK[1] = TN[1] + (1.35 - TN[1]) * C.open * (0.7 + 0.3 * pul); TK[2] = TN[2] + (0.35 - TN[2]) * C.open;
    const s = Math.sin(C.walk * 2.2) * 0.35, kn = C.kneel * 0.5;
    const lifted = b.st === 'tele' && b.att === 'slam' ? -0.9 * C.tele : b.st === 'strike' && b.att === 'slam' ? 0.2 : 0;
    part(r, p, model, 'leg_fl', B, null, s + lifted - kn, 0, 0, ONE, fl); part(r, p, model, 'leg_br', B, null, s + kn, 0, 0, ONE, fl);
    part(r, p, model, 'leg_fr', B, null, -s - kn, 0, 0, ONE, fl); part(r, p, model, 'leg_bl', B, null, -s + kn, 0, 0, ONE, fl);
    const knees = b.ph === 1 && !b.calm ? TK : TN;
    for (const [lx, lz] of [[-9, -8], [9, -8], [-9, 8], [9, 8]]) { LP[0] = lx; LP[1] = 12; LP[2] = lz; part(r, p, model, 'knee', B, LP, 0, 0, 0, knees, 0); }
    part(r, p, model, 'hull', B, null, 0, 0, 0, ONE, fl);
    part(r, p, model, 'tower', B, null, 0, 0, 0, ONE, fl);
    part(r, p, model, 'visor', B, null, 0, 0, 0, TN, 0);
    const coreOpen = b.ph >= 2 && !b.calm ? C.open : 0;
    part(r, p, model, 'core', B, null, 0, 0, 0, b.ph >= 2 && !b.calm ? TK : TN, 0);
    // the hatches slide aside when the core opens
    LP[0] = -5 - 4 * coreOpen; LP[1] = 25; LP[2] = -12.6; part(r, p, model, 'hatch', B, LP, 0, 0, 0, ONE, fl);
    LP[0] = 0 + 4 * coreOpen; part(r, p, model, 'hatch', B, LP, 0, 0, 0, ONE, fl);
    const lant = healed ? [1.8, 1.5, 0.6] : b.calm ? [0.9 + 0.4 * pul, 0.5, 1.2] : TN;
    part(r, p, model, 'lantern', B, null, 0, now() / 900, 0, lant, 0);
    gl.uniform3f(p.u.u_tint, 1, 1, 1); gl.uniform1f(p.u.u_flash, 0);
  };

  // ---------------------------------------------------------------- the HUD: the bar, the warning, the hint
  BS.bar = function (on) {
    if (!hasDoc) return; css();
    let el = document.getElementById('rpgbossbar');
    const C = BS.cur;
    if (!on || !C) { if (el) el.style.display = 'none'; return; }
    if (!el) { el = document.createElement('div'); el.id = 'rpgbossbar'; el.innerHTML = '<div class="nm"></div><div class="bar"><i></i><span class="s1"></span><span class="s2"></span></div><div class="ph"></div><div class="wr"></div>'; (document.getElementById('hud') || document.body).appendChild(el); BS.warnEl = el.querySelector('.wr'); }
    el.style.display = '';
    const b = C.b;
    el.querySelector('.nm').textContent = T('g.rpg.boss.name');
    const i = el.querySelector('.bar i'); i.style.width = (b.frac * 100).toFixed(1) + '%';
    el.classList.toggle('shield', !!b.shield); el.classList.toggle('open', !!b.open); el.classList.toggle('calm', !!b.calm);
    el.querySelector('.ph').textContent = b.shield ? T('g.rpg.boss.shield') : T('g.rpg.boss.phase', { n: b.ph });
  };
  BS.warn = function (txt) { const w = BS.warnEl; if (!w) return; w.textContent = txt; w.classList.remove('on'); void w.offsetWidth; if (txt) w.classList.add('on'); };
  BS.hint = function (h) {
    if (!hasDoc) return;
    let el = BS.hintEl;
    if (!h) { if (el) el.style.display = 'none'; return; }
    css();
    if (!el) { el = BS.hintEl = document.createElement('div'); el.id = 'rpgcorehint'; const hud = document.getElementById('hud'); if (!hud) return; hud.appendChild(el); }
    const g = game(), yaw = g && g.player ? g.player.yaw : 0, a = Math.atan2(-h.dx, -h.dz) - yaw;
    el.innerHTML = `<i style="transform:rotate(${(-a * 180 / Math.PI).toFixed(0)}deg)">▲</i>${esc(T('g.rpg.boss.hint', { d: Math.round(h.d) }))}`;
    el.style.display = '';
  };
  if (typeof setInterval === 'function') BS.timer = setInterval(() => { try { BS.look(); } catch (e) { if (!BS.warned2) { BS.warned2 = true; console.warn('rpg boss', e); } } }, 500);

  let cssDone = false;
  function css() {
    if (cssDone || !hasDoc || !document.head) return; cssDone = true;
    const s = document.createElement('style'); s.id = 'rpgbosscss'; s.textContent = CSS; document.head.appendChild(s);
  }
  const CSS = `
#rpgbossbar { position: absolute; left: 50%; top: 18px; transform: translateX(-50%); width: min(560px, 80vw); text-align: center; pointer-events: none; filter: drop-shadow(0 2px 8px rgba(0,0,0,.6)); }
#rpgbossbar .nm { font: 900 20px/1 var(--display, sans-serif); color: #ffe0f2; letter-spacing: 1.5px; text-transform: uppercase; text-shadow: 0 0 12px rgba(255,80,170,.8); }
#rpgbossbar .bar { position: relative; height: 16px; margin-top: 6px; border-radius: 999px; background: rgba(10,8,20,.8); border: 2px solid rgba(255,140,210,.55); overflow: hidden; }
#rpgbossbar .bar i { display: block; height: 100%; background: linear-gradient(90deg, #ff3d8a, #c25cff); box-shadow: 0 0 14px #ff5ea8; transition: width .25s; }
#rpgbossbar .bar span { position: absolute; top: 0; bottom: 0; width: 2px; background: rgba(255,255,255,.65); } #rpgbossbar .s1 { left: 33.3%; } #rpgbossbar .s2 { left: 66.6%; }
#rpgbossbar.open .bar i { background: linear-gradient(90deg, #ffb23d, #ffe27a); box-shadow: 0 0 18px #ffd04d; }
#rpgbossbar.shield .bar { border-color: #6fc8ff; box-shadow: 0 0 16px #6fc8ff; } #rpgbossbar.shield .bar i { opacity: .5; }
#rpgbossbar.calm .bar i { background: linear-gradient(90deg, #5fe0b0, #b0ffe0); }
#rpgbossbar .ph { margin-top: 4px; font: 800 12px/1 var(--font, sans-serif); color: #f0d8ff; letter-spacing: 1px; text-transform: uppercase; }
#rpgbossbar .wr { margin-top: 10px; font: 900 22px/1 var(--display, sans-serif); color: #ffd36a; text-shadow: 0 0 12px rgba(255,120,40,.9), 0 2px 3px #000; opacity: 0; }
#rpgbossbar .wr.on { animation: rpgWarn 1.4s ease-out both; } @keyframes rpgWarn { 0% { opacity: 0; transform: scale(1.4); } 15% { opacity: 1; transform: scale(1); } 80% { opacity: 1; } 100% { opacity: 0; } }
#rpgcorehint { position: absolute; left: 50%; top: 14px; transform: translateX(-50%); display: flex; gap: 8px; align-items: center; font: 800 14px/1 var(--font, sans-serif); color: #ffd8ee; background: rgba(20,8,24,.7); border: 1px solid rgba(255,94,168,.5); border-radius: 999px; padding: 6px 14px; pointer-events: none; }
#rpgcorehint i { font-style: normal; color: #ff5ea8; display: inline-block; }
#rpgcalm { position: absolute; left: 50%; top: 58%; transform: translate(-50%, -50%); width: 150px; text-align: center; pointer-events: none; font: 800 13px/1.2 var(--font, sans-serif); color: #d8fff0; text-shadow: 0 1px 2px #000; }
#rpgcalm svg { width: 130px; height: 130px; } #rpgcalm .bg { fill: rgba(8,20,24,.55); stroke: rgba(255,255,255,.2); stroke-width: 6; } #rpgcalm .arc { fill: none; stroke: #5fe0b0; stroke-width: 8; stroke-linecap: round; filter: drop-shadow(0 0 4px #5fe0b0); } #rpgcalm line { stroke: #fff; stroke-width: 4; stroke-linecap: round; }
#rpgwon { position: absolute; left: 50%; top: 30%; width: min(820px, 94vw); transform: translate(-50%, -50%); z-index: 42; pointer-events: none; text-align: center; display: none; }
#rpgwon.on { display: block; animation: rpgWonIn .8s cubic-bezier(.2,1.5,.35,1) both; } #rpgwon.off { display: block; animation: rpgWonOut .9s ease-in both; }
@keyframes rpgWonIn { 0% { opacity: 0; transform: translate(-50%, -50%) scale(.4); } 100% { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
@keyframes rpgWonOut { 0% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -60%) scale(1.05); } }
#rpgwon .rays { position: absolute; left: 50%; top: 50%; width: 700px; height: 700px; margin: -350px 0 0 -350px; background: repeating-conic-gradient(rgba(255,214,110,.22) 0 6deg, transparent 6deg 18deg); border-radius: 50%; -webkit-mask: radial-gradient(circle, #000 20%, transparent 68%); mask: radial-gradient(circle, #000 20%, transparent 68%); animation: rpgSpin 12s linear infinite; }
@keyframes rpgSpin { to { transform: rotate(360deg); } }
#rpgwon .kick { position: relative; font: 800 16px/1 var(--font, sans-serif); letter-spacing: 6px; color: #fff3c4; text-transform: uppercase; }
#rpgwon .big { position: relative; margin-top: 10px; font: 900 54px/1.05 var(--display, sans-serif); color: #ffe27a; text-shadow: 0 0 24px rgba(255,190,60,.95), 0 3px 4px #000; }
#rpgwon .sub { position: relative; margin-top: 12px; font: 800 20px/1.2 var(--font, sans-serif); color: #fff; text-shadow: 0 2px 3px #000; }
`;
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

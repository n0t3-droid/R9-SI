// ============================================================================
// Der Turmgänger as a cinematic fight (a-boss2; plan docs/superpowers/plans/2026-10-30-a-boss2.md). On top of
// rpg_boss.js (VR.RPGBoss), all of it switched by VR.RPGBoss2.off:
//   the arena      at the region's Kernfeuer (pinned once, so it never wanders): a Kernfeuer obelisk with a crystal
//                  (red-violet → cyan), eight pylons — most broken —, sagging cables, red-violet glowing cracks in the
//                  ground that heal when the region is freed (decals: each vertex on the land's top)
//   the boss       drawn ×1.25 with a mast and an emissive core, visor and lantern (rpg_walker2); a searchlight beam it
//                  sweeps over the land, aimed at the player while it announces its bolts
//   the entrance   Liberate's framing camera on the boss and the obelisk (any key: back), a name banner, a low motif
//   readability    the telegraphs as ground decals with their timing (the zone, a ring closing in to the strike), the
//                  weak points glint when open, the bar's three phase pips, Funke one hint per phase
//   the finish     a colour wave from the arena across the land (the grade and glints along the front; cracks and pylon
//                  lamps turn cyan as it passes), the obelisk cyan, the boss bows, the drones leave, a radiant find on a
//                  pedestal (walk up to it; given anyway after 90 s or 90 m)
//   the map        region tiles in colour, the land's colours round the player, icons for outposts / the boss / shops /
//                  fast travel, a next-goal marker, a legend
// The pure part (layout, teleShape, beamYaw, healFront, nextGoal, mapIcons, hintKey) is node-tested: test/boss2.js.
// Cost 🟡 only within 160 m of an arena: ≤ 30 voxel draws (Very Low ≤ 12), ≤ 30 decal draws, no allocation per frame;
// the existing decal and voxel programs (no new shader).
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.RPG; if (!R) return;
  const TAU = Math.PI * 2, BB = R.BAL.boss;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const B2 = VR.RPGBoss2 = VR.RPGBoss2 || { off: false };
  B2.cost = { frames: 0, ms: 0, vox: 0, decals: 0, verts: 0 };
  if (!R.BAL.drop.crown) R.BAL.drop.crown = [0, 0, 0, 0, 1];   // the pedestal's find: radiant
  B2.KEYS = ['g.rpg.boss2.kick', 'g.rpg.boss2.sub', 'g.rpg.boss2.subCalm', 'g.rpg.boss2.hint1', 'g.rpg.boss2.hint2', 'g.rpg.boss2.hint3', 'g.rpg.boss2.hint1c', 'g.rpg.boss2.hint2c', 'g.rpg.boss2.hint3c',
    'g.rpg.boss2.ped', 'g.rpg.boss2.pedTaken', 'g.rpg.boss2.wonSub', 'g.rpg.boss2.next', 'g.rpg.boss2.nextBoss', 'g.rpg.boss2.nextOut', 'g.rpg.boss2.nextNone',
    'g.rpg.boss2.leg.out', 'g.rpg.boss2.leg.free', 'g.rpg.boss2.leg.boss', 'g.rpg.boss2.leg.shop', 'g.rpg.boss2.leg.travel', 'g.rpg.boss2.leg.goal'];

  // ================================================================ the pure part
  // the arena round the obelisk (metres from it): 8 pylons (2 whole, 4 broken, 2 stumps, shuffled), cables between
  // standing neighbours, 10 zigzag cracks inside the ring, the pedestal's place; Very Low: 4 pylons, 6 cracks, no cables
  B2.layout = function (rid, lo) {
    const rnd = R.rng('arena:' + rid), a0 = rnd() * TAU, kinds = ['whole', 'whole', 'broken', 'broken', 'broken', 'broken', 'stump', 'stump'];
    for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)) % (i + 1); const t = kinds[i]; kinds[i] = kinds[j]; kinds[j] = t; }
    const r2 = (v) => Math.round(v * 100) / 100, pylons = [];
    for (let i = 0; i < 8; i++) {
      const a = a0 + i * TAU / 8 + (rnd() - 0.5) * 0.25, d = 20 + rnd() * 6, k = kinds[i];
      pylons.push({ x: r2(Math.cos(a) * d), z: r2(Math.sin(a) * d), a: r2(a), kind: k, broken: k !== 'whole', stump: k === 'stump', s: r2(0.9 + rnd() * 0.25), tilt: k === 'broken' ? r2((rnd() - 0.5) * 0.3) : 0, rot: r2(rnd() * TAU) });
    }
    const cables = [];
    for (let i = 0; i < 8; i++) { const j = (i + 1) % 8; if (!pylons[i].stump && !pylons[j].stump) cables.push({ a: i, b: j, sag: r2(1 + rnd() * 1.2) }); }
    const cracks = [];
    for (let i = 0; i < 10; i++) {
      const a = a0 + (i + 0.5) * TAU / 10 + (rnd() - 0.5) * 0.3, r0 = 2.6 + rnd() * 1.2, len = 9 + rnd() * 5.5, n = 3 + (rnd() < 0.5 ? 1 : 0), segs = [];
      let px = Math.cos(a) * r0, pz = Math.sin(a) * r0;
      for (let s = 1; s <= n; s++) {
        const rr = Math.min(18, r0 + len * s / n), off = s === n ? 0 : (rnd() - 0.5) * 1.6, aa = a + off / rr;
        const qx = Math.cos(aa) * rr, qz = Math.sin(aa) * rr; segs.push([r2(px), r2(pz), r2(qx), r2(qz)]); px = qx; pz = qz;
      }
      cracks.push({ segs, w: r2(0.45 + rnd() * 0.25) });
    }
    const pa = a0 + TAU / 16;
    const out = { pylons, cables, cracks, ped: [r2(Math.cos(pa) * 4.5), r2(Math.sin(pa) * 4.5)] };
    if (lo) { out.pylons = pylons.filter((p, i) => i % 2 === 0); out.cables = []; out.cracks = cracks.filter((c, i) => i % 5 !== 1 && i % 5 !== 3); }
    return out;
  };
  // a telegraph's ground decal at u (0 announced … 1 the strike): the zone, its glow, the timing ring closing in
  B2.teleShape = function (att, u) {
    u = clamp(+u || 0, 0, 1);
    const a = 0.22 + 0.5 * u;
    if (att === 'stomp') { const r = BB.stompR; return { kind: 'disc', r, ring: +(r - (r - 0.5) * u).toFixed(3), a }; }
    if (att === 'slam') return { kind: 'band', len: BB.slamR, w: 3.6, fill: u, a };
    return { kind: 'lanes', n: 3, spread: 0.3, w: 1.1, fill: u, a };
  };
  // the searchlight: a slow sweep round the boss's facing, pointed down onto the land ahead
  B2.beamYaw = (t) => 0.9 * Math.sin(t * 0.35) + 0.35 * Math.sin(t * 0.13 + 1.1);
  B2.beamPitch = (t) => -0.42 + 0.06 * Math.sin(t * 0.5);
  // the heal wave's front (m from the arena) s seconds after the finish; a crack d m out heals once the front passed it
  B2.healFront = (s) => (s <= 0 ? 0 : 150 * (1 - Math.pow(1 - Math.min(1, s / 5), 2.2)));
  B2.crackHeal = (d, front) => (front < 0 ? 0 : clamp((front - d) / 6, 0, 1));
  // the next goal: a waiting Kernfeuer first, then the nearest disturbed outpost, else none
  B2.nextGoal = function (C, sites, pos) {
    const px = pos ? pos[0] : 0, pz = pos ? pos[2] : 0; let best = null, bd = 1e18;
    for (const r of (C && C.regions) || []) if (r.boss === 'ready' && r.core) { const d = Math.hypot(r.core[0] - px, r.core[1] - pz); if (d < bd) { bd = d; best = { kind: 'boss', rid: r.id, x: r.core[0], z: r.core[1], d: Math.round(d) }; } }
    if (best) return best;
    for (const s of sites || []) if (s && !s.free) { const d = Math.hypot(s.x - px, s.z - pz); if (d < bd) { bd = d; best = { kind: 'outpost', id: s.id, x: s.x, z: s.z, name: s.name || '', d: Math.round(d) }; } }
    return best;
  };
  // the map's icons: every outpost, a fast-travel mark on every freed one, the villages' shops, the Kernfeuer (ready / won)
  B2.mapIcons = function (C, sites, villages) {
    const out = [];
    for (const s of sites || []) { out.push({ kind: 'outpost', x: s.x, z: s.z, free: !!s.free, name: s.name || '' }); if (s.free) out.push({ kind: 'travel', x: s.x, z: s.z }); }
    for (const v of villages || []) if (v && Number.isFinite(+v.x)) out.push({ kind: 'shop', x: +v.x, z: +v.z, name: v.name || '' });
    for (const r of (C && C.regions) || []) if (r.core && (r.boss === 'ready' || r.boss === 'won')) out.push({ kind: 'boss', x: r.core[0], z: r.core[1], won: r.boss === 'won', rid: r.id });
    return out;
  };
  B2.hintKey = (ph, calm) => 'g.rpg.boss2.hint' + clamp(ph | 0, 1, 3) + (calm ? 'c' : '');

  // ================================================================ the game
  const F = VR.Foes, BS = VR.RPGBoss, M = VR.VOXMODELS, Grid = VR.VoxGrid, mat4 = VR.mat4;
  if (!F || !BS || !mat4) return;
  const T = (k, v) => (VR.I18N ? VR.I18N.t(k, v) : k);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hasDoc = typeof document !== 'undefined' && !!document.createElement;
  const game = () => VR.game || null;
  const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
  const st = () => (VR.RPGame && VR.RPGame.st ? VR.RPGame.st() : null);
  const lo = (g) => !!(g && g.settings && g.settings.preset === 'potato');
  const on = () => !B2.off;
  const warn = (e) => { if (!B2.warned) { B2.warned = true; console.warn('rpg boss2', e); } };
  // the boss's hit box grows with its drawing (×1.25)
  if (VR.MOBS && VR.MOBS.rpg_boss) { VR.MOBS.rpg_boss.h = 8.2; VR.MOBS.rpg_boss.w = 2.4; }

  // ---------------------------------------------------------------- the models (1 voxel = 1/4 m)
  if (M && Grid) {
    const part = (sx, sy, sz, pv, build) => { const g = new Grid(sx, sy, sz, pv[0], pv[1], pv[2]); build(g); return { grid: g, pivot: [0, 0, 0] }; };
    const WH = 0xe6dfd2, WH2 = 0xc9bfae, OR = 0xe2702c, GR = 0x5b616a, GR2 = 0x3a3f47, DK = 0x1d2026, LENS = 0xf6f2ff, GOLD = 0xd9a63a, STONE = 0x8a8d92;
    const h3 = (x, y, z) => (((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) >>> 0);
    const shaft = (g, top, jag) => g.box(1, 0, 1, 6, top, 6, (x, y, z) => {
      if (jag && y > top - jag && h3(x, 0, z) % jag < y - (top - jag)) return null;
      return y % 10 < 2 ? OR : y % 10 === 9 ? GR2 : (h3(x, y, z) % 7 === 0 ? WH2 : WH);
    }, { shade: 0.06 });
    M.rpg_arena = () => ({
      h: 10, w: 2, parts: {
        whole: part(8, 44, 8, [4, 0, 4], (g) => { shaft(g, 39, 0); g.box(0, 40, 0, 7, 41, 7, GR2); g.box(3, 42, 3, 4, 43, 4, GR); }),
        broken: part(8, 30, 8, [4, 0, 4], (g) => { shaft(g, 25, 6); g.box(2, 20, 2, 2, 29, 2, GR); g.box(5, 22, 5, 5, 28, 5, GR); g.set(3, 29, 2, GR); g.set(6, 28, 5, GR); }),
        stump: part(8, 14, 8, [4, 0, 4], (g) => { shaft(g, 11, 6); g.box(4, 8, 2, 4, 13, 2, GR); }),
        lamp: part(4, 4, 4, [2, 0, 2], (g) => { g.ell(2, 2, 2, 1.9, 2, 1.9, LENS, { emis: 1 }); }),
        obelisk: part(12, 60, 12, [6, 0, 6], (g) => { for (let y = 0; y < 56; y++) { const w = Math.round(5.2 - y * 0.055); g.box(6 - w, y, 6 - w, 5 + w, y, 5 + w, (x, yy, z) => (yy % 14 < 2 ? OR : yy % 14 === 13 ? GR2 : h3(x, yy, z) % 9 === 0 ? WH2 : WH), { shade: 0.05 }); } }),
        seam: part(12, 52, 12, [6, 0, 6], (g) => { for (let y = 4; y < 50; y++) { const w = Math.round(5.2 - y * 0.055) + 0; for (const [x, z] of [[6 - w - 0, 6 - w], [5 + w, 6 - w], [6 - w, 5 + w], [5 + w, 5 + w]]) if (y % 14 > 2) g.set(x, y, z, LENS, 1); } }),
        crystal: part(8, 14, 8, [4, 0, 4], (g) => { g.ell(4, 7, 4, 3.4, 7, 3.4, LENS, { emis: 1 }); }),
        plinth: part(36, 3, 36, [18, 0, 18], (g) => { g.box(0, 0, 0, 35, 2, 35, (x, y, z) => { const d = Math.hypot(x - 17.5, z - 17.5); return d > 17.5 ? null : d > 16 - y * 2 ? STONE : y < 2 ? null : (Math.abs(d - 11) < 0.7 ? GR2 : 0x9a9da3); }, { shade: 0.1 }); }),
        cable: part(1, 1, 16, [0, 0, 0], (g) => { g.box(0, 0, 0, 0, 0, 15, DK); }),
        pedestal: part(10, 12, 10, [5, 0, 5], (g) => { g.box(0, 0, 0, 9, 1, 9, GR2); g.box(2, 2, 2, 7, 9, 7, (x, y, z) => (y % 3 === 0 ? GOLD : WH)); g.box(1, 10, 1, 8, 11, 8, GOLD); }),
        gem: part(6, 8, 6, [3, 4, 3], (g) => { g.ell(3, 4, 3, 2.6, 4, 2.6, LENS, { emis: 1 }); }),
      },
      layout: {},
    });
  }

  // ---------------------------------------------------------------- where: the arena, pinned once per region
  B2.arenaOf = function (reg) {
    const s = st(); if (!s || !reg || !reg.core) return reg && reg.core;
    const kx = 'ax:' + reg.id, kz = 'az:' + reg.id;
    if (!s.seen[kx]) { s.seen[kx] = reg.core[0] + 1e6; s.seen[kz] = reg.core[1] + 1e6; if (VR.RPGame.save) VR.RPGame.save(); }
    return [s.seen[kx] - 1e6, s.seen[kz] - 1e6];
  };
  { const o = BS.ready; BS.ready = function () { const l = o.apply(this, arguments); if (!on()) return l; for (const r of l) { const a = B2.arenaOf(r); if (a) r.core = a; } return l; }; }
  // 2 Hz: the nearest arena within 260 m (a waiting Kernfeuer or a healed one), its ground once loaded; the pedestal
  B2.arena = null;
  B2.scan = function () {
    const g = game(); if (!on() || !g || g.state !== 'play' || !g.player || !VR.RPGame || !F.on(g)) { B2.arena = null; return; }
    const s = st(); if (!s) return;
    const pp = g.player.pos, C = R.conquest(VR.RPGame.sites(), s);
    let best = null, bd = 260;
    for (const r of C.regions) {
      if (r.boss !== 'ready' && r.boss !== 'won') continue;
      const pin = s.seen['ax:' + r.id] ? [s.seen['ax:' + r.id] - 1e6, s.seen['az:' + r.id] - 1e6] : r.boss === 'ready' ? B2.arenaOf(r) : r.core;
      if (!pin) continue;
      const d = Math.hypot(pin[0] - pp[0], pin[1] - pp[2]); if (d < bd) { bd = d; best = { r, pin }; }
    }
    if (!best) { B2.arena = null; return; }
    const lw = lo(g);
    let A = B2.arena;
    if (!A || A.rid !== best.r.id || A.lo !== lw) A = B2.arena = { rid: best.r.id, x: best.pin[0] + 0.5, z: best.pin[1] + 0.5, y: null, L: B2.layout(best.r.id, lw), lo: lw, won: false, ys: null, crk: null, heal: 0 };
    A.won = best.r.boss === 'won';
    if (A.won && !(B2.wave && B2.wave.rid === A.rid)) A.heal = 1;
    if (!A.ys) B2.ground(g, A);
    // a pedestal left waiting (a reload in between): back on its place
    if (A.won && s.seen['ped:' + A.rid] && !(B2.ped && B2.ped.rid === A.rid) && A.ys) B2.pedOn(g, A, 'b:' + A.rid);
    B2.pedLook(g);
  };
  const topY = (w, x, z) => w.topAt(Math.floor(x), Math.floor(z)) + 1;
  B2.ground = function (g, A) {
    const w = g.world; if (!w || !w.isLoaded(Math.floor(A.x), Math.floor(A.z))) return;
    for (const p of A.L.pylons) if (!w.isLoaded(Math.floor(A.x + p.x), Math.floor(A.z + p.z))) return;
    A.y = topY(w, A.x, A.z);
    A.ys = A.L.pylons.map(p => { let y = 1e9; for (const [dx, dz] of [[-0.7, -0.7], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7]]) y = Math.min(y, topY(w, A.x + p.x + dx, A.z + p.z + dz)); return y; });
    A.ped = [A.x + A.L.ped[0], topY(w, A.x + A.L.ped[0], A.z + A.L.ped[1]), A.z + A.L.ped[1]];
    B2.buildCracks(g, A);
  };

  // ---------------------------------------------------------------- the boss: raised beside the obelisk; the entrance
  { const o = BS.raise; BS.raise = function (g, reg) {
    if (on() && reg && reg.core) {   // (it stands up 8 m in front of the obelisk, toward the player)
      const pp = g.player.pos, dx = pp[0] - reg.core[0], dz = pp[2] - reg.core[1], d = Math.hypot(dx, dz) || 1;
      reg = Object.assign({}, reg, { core: [Math.round(reg.core[0] + dx / d * 8), Math.round(reg.core[1] + dz / d * 8)] });
    }
    const m = o.call(this, g, reg);
    if (m && on() && BS.cur) try { B2.entrance(g, BS.cur); } catch (e) { warn(e); }
    return m;
  }; }
  const air = (g, x, y, z) => { const b = g.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)); return !b || !(VR.R.T.flags[b] & VR.F.SOLID); };
  // a low shot looking up at the boss with the obelisk behind it: the camera on the player's side, 15 m out
  B2.compose = function (g, m) {
    const A = B2.arena, pp = g.player.pos, ty = m.pos[1] + 5.5;
    const ox = A ? A.x : m.pos[0], oz = A ? A.z : m.pos[2];
    let base = Math.atan2(pp[0] - m.pos[0], pp[2] - m.pos[2]);
    if (A && Math.hypot(m.pos[0] - ox, m.pos[2] - oz) > 1) base = Math.atan2(m.pos[0] - ox, m.pos[2] - oz);
    for (let k = 0; k < 16; k++) {
      const a = base + 0.35 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * Math.PI / 12, D = k < 8 ? 16 : 12;
      const cx = m.pos[0] + Math.sin(a) * D, cz = m.pos[2] + Math.cos(a) * D;
      if (!g.world.isLoaded(Math.floor(cx), Math.floor(cz))) continue;
      const cy = topY(g.world, cx, cz) + 1.6;
      let ok = air(g, cx, cy, cz) && air(g, cx, cy + 1, cz);
      for (let i = 1; i < 16 && ok; i++) { const u = i / 16; if (u > 0.85) break; if (!air(g, cx + (m.pos[0] - cx) * u, cy + (ty - cy) * u, cz + (m.pos[2] - cz) * u)) ok = false; }
      if (!ok) continue;
      return { x: cx, y: cy, z: cz, yaw: Math.atan2(-(m.pos[0] - cx), -(m.pos[2] - cz)), pitch: Math.atan2(ty - cy, Math.hypot(m.pos[0] - cx, m.pos[2] - cz)), fov: null };
    }
    return null;
  };
  B2.entrance = function (g, C) {
    const L = VR.Liberate, calm = C.b.calm;
    B2.entr = { t: 0, C, cam: false, tOff: 0 };
    if (L && L.camOk && L.camOk(g) && !L.moment) {
      const c = B2.compose(g, C.m);
      if (c) { L.mcam = { t: 0, e: 0, skipped: false, first: true, a: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, fov: 1 }, b: c, o: {}, hud: !!g.hideHud, boss2: true }; g.hideHud = true; const hud = hasDoc && document.getElementById('hud'); if (hud) hud.style.visibility = 'hidden'; B2.entr.cam = true; }
    }
    B2.title(g, C);
    // the motif: a low drone and four rising notes (minor; the calm version in major, softer)
    const au = g.audio;
    if (au && au.ctx && au.tone) {
      const t = au.ctx.currentTime + 0.2, notes = calm ? [147, 185, 220, 294] : [147, 175, 220, 208];
      au.tone(73.4, calm ? 0.05 : 0.09, 4.5, calm ? 'sine' : 'sawtooth', true, t);
      au.tone(110, calm ? 0.03 : 0.05, 4, 'triangle', true, t + 0.1);
      notes.forEach((f, i) => { au.tone(f, calm ? 0.06 : 0.08, 1.6, calm ? 'sine' : 'triangle', true, t + 0.9 + i * 0.55); au.tone(f * 2, 0.02, 1.2, 'sine', true, t + 0.92 + i * 0.55); });
    }
    // the dust wall as it rises
    const P = g.particles, m = C.m;
    if (P) { const n = lo(g) ? 20 : 44; for (let i = 0; i < n; i++) { const a = i * TAU / n; P.spawn(m.pos[0] + Math.cos(a) * 3.5, m.pos[1] + 0.3, m.pos[2] + Math.sin(a) * 3.5, Math.cos(a) * 4, 2 + Math.random() * 2, Math.sin(a) * 4, { life: 2.2, size: 0.55, grav: -0.1, col: [0.62, 0.56, 0.5], drag: 1.2, collide: false }); } }
  };
  B2.title = function (g, C) {
    if (!hasDoc) return; css();
    let el = document.getElementById('rpgintro');
    if (!el) { el = document.createElement('div'); el.id = 'rpgintro'; (document.getElementById('app') || document.body).appendChild(el); }
    const reg = C.reg && VR.RPGame && VR.RPGame.regionName ? VR.RPGame.regionName(C.reg) : '';
    el.innerHTML = `<div class="kick">${esc(T('g.rpg.boss2.kick', { region: reg }))}</div><div class="big">${esc(T('g.rpg.boss.name'))}</div><div class="line"></div><div class="sub">${esc(T(C.b.calm ? 'g.rpg.boss2.subCalm' : 'g.rpg.boss2.sub'))}</div>`;
    el.className = ''; void el.offsetWidth; el.className = 'on';
  };
  // (the banner leaves on the game's clock: 5.2 s after it came, 1 s to fade)
  B2.titleStep = function (E, dt) {
    if (E.tOff >= 2) return; E.t += dt;
    const el = hasDoc && document.getElementById('rpgintro'); if (!el) return;
    if (E.t > 5.2 && !E.tOff) { E.tOff = 1; el.className = 'off'; } else if (E.t > 6.2 && E.tOff === 1) { E.tOff = 2; el.className = ''; }
  };
  // the intro's clock waits for the camera; the weak points glint; the beam's clock
  { const o = BS.ai; BS.ai = function (En, m, dt) {
    const C = BS.cur;
    if (on() && C && C.m === m && B2.entr && B2.entr.C === C) {
      const L = VR.Liberate, camOn = !!(L && L.mcam && L.mcam.boss2);
      if (!camOn) B2.entr.cam = false;
      if (camOn && C.b.st === 'intro') C.b.t = Math.min(C.b.t, BB.intro - 1.4);
      B2.titleStep(B2.entr, dt);
    }
    const r = o.apply(this, arguments);
    if (on() && C && C.m === m) try { B2.bossFx(En.game, C, dt); } catch (e) { warn(e); }
    return r;
  }; }
  const KN = [[-9, -8], [9, -8], [-9, 8], [9, 8]];
  B2.bossFx = function (g, C, dt) {
    C.beamT = (C.beamT || 0) + dt * (C.b.calm ? 0.6 : 1);
    const P = g.particles, b = C.b, m = C.m; if (!P || !b.open || b.calm) return;
    if ((C.glT = (C.glT || 0) - dt) > 0) return; C.glT = lo(g) ? 0.3 : 0.15;
    const k = 3.5 / 16, cy = Math.cos(m.yaw), sy = Math.sin(m.yaw);
    const at = (lx, ly, lz) => { const x = lx * k, z = lz * k; return [m.pos[0] + x * cy + z * sy, m.pos[1] + ly * k, m.pos[2] - x * sy + z * cy]; };
    if (b.ph === 1) for (const [lx, lz] of KN) { const q = at(lx, 12, lz); P.spark(q[0], q[1], q[2], [1, 0.85, 0.3], 3, 1.5, 1); }
    else { const q = at(0, 25, -13); P.spark(q[0], q[1], q[2], [1, 0.85, 0.3], 6, 2, 1); }
  };
  // the lantern's world position (rpg_boss.js's draw calls this with its scale): the beam starts there
  B2.lantern = function (C, m, SC) { const k = SC / 16, lz = 3 * k; C.lp = C.lp || [0, 0, 0]; C.lp[0] = m.pos[0] + Math.sin(m.yaw) * lz; C.lp[1] = m.pos[1] + 71 * k; C.lp[2] = m.pos[2] + Math.cos(m.yaw) * lz; };

  // ---------------------------------------------------------------- Funke: one hint a phase; the bar's phase pips
  { const o = BS.event; BS.event = function (g, En, C, e) {
    if (on()) {
      if (e === 'fight') { BS.say(g, T(B2.hintKey(1, C.b.calm))); return; }
      if (e === 'shield:on') return;   // (phase 2's hint says it)
      if (e === 'recover' && !C.said.weak) { C.said.weak = 1; BS.warn(T('g.rpg.boss.weak')); return; }
      if (e === 'phase2' || e === 'phase3') { const r = o.apply(this, arguments); BS.say(g, T(B2.hintKey(C.b.ph, C.b.calm))); return r; }
    }
    return o.apply(this, arguments);
  }; }
  { const o = BS.bar; BS.bar = function (show) {
    o.apply(this, arguments);
    const el = hasDoc && document.getElementById('rpgbossbar'), C = BS.cur; if (!el || !C) return;
    el.classList.toggle('b2', on()); if (!on()) return;
    css();
    let pp = el.querySelector('.pips');
    if (!pp) { pp = document.createElement('div'); pp.className = 'pips'; pp.innerHTML = '<i>I</i><i>II</i><i>III</i>'; el.insertBefore(pp, el.querySelector('.ph')); }
    const ph = C.b.ph | 0, done = C.b.st === 'won' || C.b.st === 'down';
    pp.querySelectorAll('i').forEach((q, i) => { q.className = done || i + 1 < ph ? 'done' : i + 1 === ph ? 'on' : ''; });
  }; }

  // ---------------------------------------------------------------- the finish: the wave, the obelisk, the pedestal
  { const o = BS.finish; BS.finish = function (g, C) {
    const was = C.won, r = o.apply(this, arguments);
    if (was || !on()) return r;
    try {
      BS.healT = -1;   // (the wave's grade instead: it clears where the front has passed)
      const A = B2.arena, x = A ? A.x : C.m.pos[0], z = A ? A.z : C.m.pos[2];
      B2.wave = { rid: C.rid, x, z, t: 0, pass: -1, gl: 0 };
      if (A) A.heal = 0;
      if (A && A.ys) { const s = st(); if (s) { s.seen['ped:' + A.rid] = 1; if (VR.RPGame.save) VR.RPGame.save(); } B2.pedOn(g, A, 'b:' + C.rid); }
      const near = g.entities.mobs.filter(q => q.foe && !q.foe.gone && !q.foe.helper && Math.hypot(q.pos[0] - x, q.pos[2] - z) < 90);
      if (near.length && F.leaveAll) F.leaveAll(near, F.W);
      const sb = hasDoc && document.querySelector('#rpgwon .sub');
      if (sb) { const t0 = sb.textContent.split(' · ').slice(0, 2).join(' · '); sb.textContent = t0 + ' · ' + T('g.rpg.boss2.wonSub'); }
    } catch (e) { warn(e); }
    return r;
  }; }
  // the boss's find waits on the pedestal (VR.RPGame.find wrapped for the 'b:' seeds while an arena stands)
  if (VR.RPGame) { const o = VR.RPGame.find; B2.findOrig = o; VR.RPGame.find = function (seed, src, slot) {
    if (src === 'boss' && B2.ped && B2.ped.seed === seed && !B2.taking) return null;   // (it waits on the pedestal)
    return o.apply(this, arguments);
  }; }
  B2.pedOn = function (g, A, seed) {
    B2.ped = { rid: A.rid, seed, x: A.ped[0], y: A.ped[1], z: A.ped[2], t: 0, taken: false, told: false };
    if (g && g.particles) g.particles.spark(A.ped[0], A.ped[1] + 3, A.ped[2], [1, 0.9, 0.5], 40, 5, 1);
  };
  B2.take = function (g) {
    const P = B2.ped; if (!P || P.taken) return null;
    P.taken = true; const s = st(); if (s) delete s.seen['ped:' + P.rid];
    B2.taking = true; let it = null; try { it = B2.findOrig.call(VR.RPGame, P.seed, 'crown'); } finally { B2.taking = false; }
    if (g && g.particles) { g.particles.spark(P.x, P.y + 2.6, P.z, [1, 0.95, 0.6], 60, 6, 1); g.particles.spark(P.x, P.y + 2.6, P.z, [0.6, 1, 1], 30, 4, 1); }
    if (g) BS.say(g, T('g.rpg.boss2.pedTaken'));
    return it;
  };
  B2.pedLook = function (g) {
    const P = B2.ped; if (!P || P.taken || !g.player) return;
    P.t += 0.5;
    const d = Math.hypot(g.player.pos[0] - P.x, g.player.pos[2] - P.z);
    if (!P.told && P.t > 6) { P.told = true; BS.say(g, T('g.rpg.boss2.ped')); }
    if (d < 3.2 || P.t > 90 || d > 90) B2.take(g);
  };

  // the land's grade: red-violet round a waiting boss; after the finish it clears where the wave's front has passed
  { const o = BS.frame; BS.frame = function (g, dt, eye, E) {
    if (!on()) return o.apply(this, arguments);
    const t0 = now();
    try { B2.frame(g, dt, eye, E); } catch (e) { warn(e); }
    B2.cost.frames++; B2.cost.ms += now() - t0;
  }; }
  B2.frame = function (g, dt, eye, E) {
    const L = VR.Liberate, W = B2.wave, C = BS.cur, A = B2.arena;
    if ((B2.scanT = (B2.scanT || 0) - dt) <= 0) { B2.scanT = 0.5; B2.scan(); }
    if (A) A.clock = (A.clock || 0) + dt;
    if (W) {
      W.t += dt; const fr = B2.healFront(W.t), de = Math.hypot(eye[0] - W.x, eye[2] - W.z);
      if (A && A.rid === W.rid) A.heal = clamp(W.t / 1.2, 0, 1);
      if (W.pass < 0 && fr >= de) W.pass = W.t;
      if (L && L.applyMood && E && E.grade) {
        if (W.pass < 0) { const k = L.moodK ? L.moodK(de) : 0; if (k > 0) L.applyMood(E, k * 0.9, 0); }
        else { const H = L.heal(W.t - W.pass); L.applyMood(E, H.k * 0.9, H.c); }
      }
      // the glints along the front, on the land's top
      const P = g.particles, w = g.world;
      if (P && w && fr < 150 && (W.gl -= dt) <= 0) {
        W.gl = 0.05; const n = lo(g) ? 6 : 14;
        for (let i = 0; i < n; i++) {
          const a = Math.random() * TAU, x = W.x + Math.cos(a) * fr, z = W.z + Math.sin(a) * fr;
          if (Math.abs(x - eye[0]) > 120 || Math.abs(z - eye[2]) > 120 || !w.isLoaded(Math.floor(x), Math.floor(z))) continue;
          const y = topY(w, x, z);
          P.spawn(x, y + 0.3, z, 0, 2.2 + Math.random() * 2, 0, { life: 1.3, size: 0.32, grav: -0.4, col: Math.random() < 0.5 ? [0.45, 1, 1] : [1, 0.86, 0.45], emis: 1, drag: 0.6, collide: false });
        }
      }
      if (W.t > 12 && W.pass >= 0 && W.t - W.pass > 6) B2.wave = null;
      return;
    }
    if (C && !C.won && L && L.applyMood && E && E.grade) { const d = Math.hypot(C.m.pos[0] - eye[0], C.m.pos[2] - eye[2]); const k = L.moodK ? L.moodK(d) : 0; if (k > 0) L.applyMood(E, k * 0.9, 0); }
  };

  // ---------------------------------------------------------------- drawing the arena (voxel program, after the foes)
  const MB = mat4.create(), MT = mat4.create(), ID = mat4.create(), TN = [1, 1, 1], ONE = [1, 1, 1];
  function vpart(r, p, model, name, B, tint) {
    const pr = model.parts[name]; if (!pr) return;
    const gl = r.gl;
    gl.uniform3f(p.u.u_tint, tint[0], tint[1], tint[2]); gl.uniform1f(p.u.u_flash, 0);
    gl.uniformMatrix4fv(p.u.u_model, false, B);
    gl.bindVertexArray(pr.vao); gl.drawArrays(gl.TRIANGLES, 0, pr.count);
    B2.cost.vox++;
  }
  const mix3 = (o, a, b, u) => { o[0] = a[0] + (b[0] - a[0]) * u; o[1] = a[1] + (b[1] - a[1]) * u; o[2] = a[2] + (b[2] - a[2]) * u; return o; };
  const RV = [1.7, 0.32, 1.25], CY = [0.5, 1.7, 1.8], LT = [1, 1, 1];
  B2.lampTint = function (A, d) { const wv = B2.wave && B2.wave.rid === A.rid ? B2.crackHeal(d, B2.healFront(B2.wave.t)) : A.won ? 1 : 0; const pul = 0.75 + 0.25 * Math.sin((A.clock || 0) * 3 + d); mix3(LT, RV, CY, wv); if (wv < 1) { LT[0] *= pul; LT[1] *= pul; LT[2] *= pul; } return LT; };
  { const o = F.drawExtra; F.drawExtra = function (En, r, p, cam) {
    o.apply(this, arguments);
    if (on() && B2.arena && B2.arena.ys) try { B2.drawArena(En, r, p, cam); } catch (e) { warn(e); }
  }; }
  B2.drawArena = function (En, r, p, cam) {
    const A = B2.arena, gl = r.gl, dx = A.x - cam.x, dz = A.z - cam.z;
    if (dx * dx + dz * dz > 160 * 160) return;
    const model = VR.getVoxModel(gl, 'rpg_arena'); if (!model) return;
    const light = En.lightAt(A.x, A.y + 2, A.z);
    gl.uniform1f(p.u.u_sky, light.sky); gl.uniform3f(p.u.u_blockLight, light.bl[0], light.bl[1], light.bl[2]);
    if (p.u.u_sunShadow) gl.uniform1f(p.u.u_sunShadow, 0);
    gl.uniform1f(p.u.u_noFog, 0);
    const Q = 0.25, B = MB;
    // the obelisk on its plinth, the seams and the crystal: red-violet, cyan once healed
    const h = A.heal, pul = 0.8 + 0.2 * Math.sin((A.clock || 0) * 2.2);
    B.set(ID); mat4.translate(B, B, A.x - cam.x, A.y - cam.y - 0.5, A.z - cam.z); mat4.scale(B, B, Q, Q, Q);
    if (!A.lo) vpart(r, p, model, 'plinth', B, ONE);
    B.set(ID); mat4.translate(B, B, A.x - cam.x, A.y - cam.y + 0.2, A.z - cam.z); mat4.scale(B, B, Q, Q, Q);
    vpart(r, p, model, 'obelisk', B, ONE);
    mix3(TN, RV, CY, h); if (h < 1) { TN[0] *= pul; TN[1] *= pul; TN[2] *= pul; }
    vpart(r, p, model, 'seam', B, TN);
    B.set(ID); mat4.translate(B, B, A.x - cam.x, A.y - cam.y + 0.2 + 14.2 + 0.3 * Math.sin((A.clock || 0) * 1.3), A.z - cam.z); mat4.rotY(B, B, (A.clock || 0) * 0.4); mat4.scale(B, B, Q, Q, Q);
    TN[0] *= 1.4; TN[1] *= 1.4; TN[2] *= 1.4; vpart(r, p, model, 'crystal', B, TN);
    // the pylons, their lamps
    const L = A.L;
    for (let i = 0; i < L.pylons.length; i++) {
      const q = L.pylons[i], y = A.ys[i];
      B.set(ID); mat4.translate(B, B, A.x + q.x - cam.x, y - cam.y - 0.3, A.z + q.z - cam.z); mat4.rotY(B, B, q.rot); if (q.tilt) mat4.rotZ(B, B, q.tilt); mat4.scale(B, B, Q * q.s, Q * q.s, Q * q.s);
      vpart(r, p, model, q.kind, B, ONE);
      if (q.kind === 'whole') { MT.set(B); mat4.translate(MT, MT, 0, 42, 0); vpart(r, p, model, 'lamp', MT, B2.lampTint(A, Math.hypot(q.x, q.z))); }
    }
    // the cables: two sagging spans between the tops of standing neighbours
    for (const c of L.cables) {
      const a = L.pylons[c.a], b = L.pylons[c.b], ia = L.pylons.indexOf(a), ib = L.pylons.indexOf(b);
      const ha = A.ys[ia] + (a.kind === 'whole' ? 9.6 : 6) * a.s, hb = A.ys[ib] + (b.kind === 'whole' ? 9.6 : 6) * b.s;
      const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, my = Math.min(ha, hb) - c.sag;
      cable(r, p, model, cam, A.x + a.x, ha, A.z + a.z, A.x + mx, my, A.z + mz);
      cable(r, p, model, cam, A.x + mx, my, A.z + mz, A.x + b.x, hb, A.z + b.z);
    }
    // the pedestal and its find
    const P = B2.ped;
    if (P && P.rid === A.rid) {
      B.set(ID); mat4.translate(B, B, P.x - cam.x, P.y - cam.y, P.z - cam.z); mat4.scale(B, B, Q, Q, Q);
      vpart(r, p, model, 'pedestal', B, ONE);
      if (!P.taken) {
        const t = now() / 1000; B.set(ID); mat4.translate(B, B, P.x - cam.x, P.y + 4.2 + 0.25 * Math.sin(t * 2) - cam.y, P.z - cam.z); mat4.rotY(B, B, t * 1.2); mat4.scale(B, B, Q, Q, Q);
        TN[0] = 2.2; TN[1] = 1.5; TN[2] = 0.5; vpart(r, p, model, 'gem', B, TN);
      }
    }
    gl.uniform3f(p.u.u_tint, 1, 1, 1);
  };
  function cable(r, p, model, cam, x0, y0, z0, x1, y1, z1) {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, len = Math.hypot(dx, dy, dz) || 1, B = MB;
    B.set(ID); mat4.translate(B, B, x0 - cam.x, y0 - cam.y, z0 - cam.z);
    mat4.rotY(B, B, Math.atan2(dx, dz)); mat4.rotX(B, B, -Math.asin(clamp(dy / len, -1, 1)));
    mat4.scale(B, B, 0.12, 0.12, len / 16);
    vpart(r, p, model, 'cable', B, ONE);
  }

  // ---------------------------------------------------------------- the decals: cracks, telegraphs, the beam
  // (the renderer's decal program over one flat texel of the snow block's top, its colour divided out: no new shader)
  const DV = new Float32Array(6 * 4000), D = { n: 0 };
  let crackV = null;
  const putV = (x, y, z) => { if (D.n >= 4000) return; const o = D.n * 5; DV[o] = x; DV[o + 1] = y; DV[o + 2] = z; DV[o + 3] = 0.5; DV[o + 4] = 0.5; D.n++; };
  const quad = (ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz) => { putV(ax, ay, az); putV(bx, by, bz); putV(cx, cy, cz); putV(ax, ay, az); putV(cx, cy, cz); putV(dx, dy, dz); };
  B2.buildCracks = function (g, A) {
    const w = g.world, out = [], ranges = [];
    const pv = (x, y, z) => out.push(x - A.x, y - A.y, z - A.z, 0.5, 0.5);
    const strip = (x0, z0, x1, z1, hw) => {
      const len = Math.hypot(x1 - x0, z1 - z0) || 1, n = Math.max(1, Math.ceil(len / 0.9)), nx = -(z1 - z0) / len * hw, nz = (x1 - x0) / len * hw;
      for (let i = 0; i < n; i++) {
        const u0 = i / n, u1 = (i + 1) / n, ax = x0 + (x1 - x0) * u0, az = z0 + (z1 - z0) * u0, bx = x0 + (x1 - x0) * u1, bz = z0 + (z1 - z0) * u1;
        const ya = Math.max(topY(w, ax + nx, az + nz), topY(w, ax - nx, az - nz)) + 0.05, yb = Math.max(topY(w, bx + nx, bz + nz), topY(w, bx - nx, bz - nz)) + 0.05;
        pv(ax + nx, ya, az + nz); pv(ax - nx, ya, az - nz); pv(bx - nx, yb, bz - nz); pv(ax + nx, ya, az + nz); pv(bx - nx, yb, bz - nz); pv(bx + nx, yb, bz + nz);
      }
    };
    for (const c of A.L.cracks) {
      const s0 = out.length / 5;
      for (let i = 0; i < c.segs.length; i++) { const s = c.segs[i], k = 1 - 0.55 * i / c.segs.length; strip(A.x + s[0], A.z + s[1], A.x + s[2], A.z + s[3], c.w * 1.8 * k); }
      const s1 = out.length / 5;
      for (let i = 0; i < c.segs.length; i++) { const s = c.segs[i], k = 1 - 0.55 * i / c.segs.length; strip(A.x + s[0], A.z + s[1], A.x + s[2], A.z + s[3], c.w * 0.35 * k); }
      const s2 = out.length / 5, mid = c.segs[1] || c.segs[0];
      ranges.push({ halo: [s0, s1 - s0], core: [s1, s2 - s1], d: Math.hypot(mid[0], mid[1]) });
    }
    A.crk = { v: new Float32Array(out), ranges, up: false };
    crackV = null;
  };
  const SCc = [0.3, 0.02, 0.2], SHc = [0.05, 0.3, 0.32], ZOc = [0.85, 0.05, 0.04], RVc = [1, 0.12, 0.62], CYc = [0.25, 1, 1], GOc = [1, 0.75, 0.3], TEc = [1, 0.32, 0.08], RIc = [1, 0.9, 0.6], COL = [0, 0, 0];
  let flat = null;   // {layer, k: [1/r, 1/g, 1/b]}
  const flatOf = (g) => {
    if (flat) return flat;
    const RR = VR.R, b = RR && RR.byName && (RR.byName.snow_block || RR.byName.stone); if (!b) return null;
    const layer = RR.T.tex[b.defaultState * 6 + 2] & 0xfff, Av = g.tex && g.tex.avgColor;
    const c = Av ? [Av[layer * 4] || 0.8, Av[layer * 4 + 1] || 0.8, Av[layer * 4 + 2] || 0.8] : [0.85, 0.85, 0.85];
    return (flat = { layer, k: [1 / Math.max(0.2, c[0]), 1 / Math.max(0.2, c[1]), 1 / Math.max(0.2, c[2])] });
  };
  const Ren = VR.Renderer;
  if (Ren && Ren.prototype) {
    const o = Ren.prototype.popFx;
    Ren.prototype.popFx = function (Fr) {
      if (o) o.apply(this, arguments);
      if (!on() || !this.P || !this.P.decal || !Fr || !Fr.cam) return;
      const g = game(); if (!g) return;
      if (!(B2.arena && B2.arena.crk) && !BS.cur) return;
      try { B2.drawDecals(this, g); } catch (e) { warn(e); }
    };
  }
  B2.drawDecals = function (r, g) {
    const gl = r.gl, p = r.P.decal, cam = r.cam, fl = flatOf(g); if (!fl) return;
    if (!B2.vbo) {
      B2.vbo = gl.createBuffer(); B2.vao = gl.createVertexArray(); gl.bindVertexArray(B2.vao); gl.bindBuffer(gl.ARRAY_BUFFER, B2.vbo); gl.bufferData(gl.ARRAY_BUFFER, DV.byteLength, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12);
      B2.cvbo = gl.createBuffer(); B2.cvao = gl.createVertexArray(); gl.bindVertexArray(B2.cvao); gl.bindBuffer(gl.ARRAY_BUFFER, B2.cvbo);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12);
      gl.bindVertexArray(null);
    }
    const E = g.env || {}, day = 1 - 0.5 * Math.min(1, Math.max(0, E.night || 0));
    let bm = -1;   // the blend: 1 adds light (rings, the beam), 0 lays a colour over the ground (zones, the cracks' scorch)
    const color = (c, a, k, add) => { const m = add ? 1 : 0; if (m !== bm) { bm = m; if (m) gl.blendFunc(gl.SRC_ALPHA, gl.ONE); else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); } gl.uniform4f(p.u.u_color, c[0] * fl.k[0] * k, c[1] * fl.k[1] * k, c[2] * fl.k[2] * k, a); B2.cost.decals++; };
    gl.useProgram(p.p);
    gl.uniformMatrix4fv(p.u.u_viewProj, false, r.viewProj);
    gl.uniform1f(p.u.u_layer, fl.layer);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, r.texAlbedo); gl.uniform1i(p.u.u_albedo, 0);
    const cull = gl.isEnabled(gl.CULL_FACE); gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE); gl.depthMask(false);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-2, -4);
    // the cracks (static; per crack its colour: red-violet pulsing, cyan as the wave passes, then a faint gold)
    const A = B2.arena;
    if (A && A.crk && Math.hypot(A.x - cam.x, A.z - cam.z) < 160) {
      if (crackV !== A.crk) { gl.bindBuffer(gl.ARRAY_BUFFER, B2.cvbo); gl.bufferData(gl.ARRAY_BUFFER, A.crk.v, gl.STATIC_DRAW); crackV = A.crk; }
      gl.bindVertexArray(B2.cvao); gl.uniform3f(p.u.u_offset, A.x - cam.x, A.y - cam.y, A.z - cam.z);
      const W = B2.wave && B2.wave.rid === A.rid ? B2.wave : null, fr = W ? B2.healFront(W.t) : -1, tt = A.clock || 0;
      for (const q of A.crk.ranges) {
        const hh = W ? B2.crackHeal(q.d, fr) : A.won ? 1 : 0, fade = W ? clamp(1 - (W.t - 2 - q.d / 30) / 4, 0, 1) : A.won ? 0 : 1;
        if (hh >= 1 && fade <= 0) { mix3(COL, CYc, GOc, 0.6); color(COL, 0.3, 0.9 * day, true); gl.drawArrays(gl.TRIANGLES, q.core[0], q.core[1]); continue; }
        const pul = 0.75 + 0.25 * Math.sin(tt * 2.6 + q.d * 0.8);
        mix3(COL, SCc, SHc, hh); color(COL, 0.55 * (hh > 0 ? fade : 1), 1, false); gl.drawArrays(gl.TRIANGLES, q.halo[0], q.halo[1]);
        mix3(COL, RVc, CYc, hh); color(COL, 0.95, (hh > 0 ? 1.8 * fade + 0.5 : 2.4 * pul) * day, false); gl.drawArrays(gl.TRIANGLES, q.core[0], q.core[1]);
      }
    }
    // the boss's telegraph and its beam (dynamic)
    const C = BS.cur;
    if (C && !C.won && C.m && Math.hypot(C.m.pos[0] - cam.x, C.m.pos[2] - cam.z) < 120) {
      D.n = 0; const m = C.m, b = C.b, w = g.world, ox = m.pos[0], oz = m.pos[2], oy = m.pos[1];
      const gy = (x, z) => (w.isLoaded(Math.floor(x), Math.floor(z)) ? topY(w, x, z) : oy) - oy + 0.08;
      const parts = B2.parts; parts.length = 0;
      if (b.st === 'tele' && !b.calm) {
        const S = B2.teleShape(b.att, C.tele), seg = lo(g) ? 20 : 32;
        if (S.kind === 'disc') {
          const s0 = D.n;
          for (let i = 0; i < seg; i++) {
            const a0 = i * TAU / seg, a1 = (i + 1) * TAU / seg, c0 = Math.cos(a0), s_0 = Math.sin(a0), c1 = Math.cos(a1), s_1 = Math.sin(a1);
            for (let k = 0; k < 3; k++) { const r0 = S.r * k / 3, r1 = S.r * (k + 1) / 3; quad(c0 * r0, gy(ox + c0 * r0, oz + s_0 * r0), s_0 * r0, c0 * r1, gy(ox + c0 * r1, oz + s_0 * r1), s_0 * r1, c1 * r1, gy(ox + c1 * r1, oz + s_1 * r1), s_1 * r1, c1 * r0, gy(ox + c1 * r0, oz + s_1 * r0), s_1 * r0); }
          }
          parts.push(s0, ZOc, 0.2 + S.a * 0.5, 1, 0);
          const ring = (rr, hw, c, a, k) => { const s1 = D.n; for (let i = 0; i < seg; i++) { const a0 = i * TAU / seg, a1 = (i + 1) * TAU / seg, c0 = Math.cos(a0), s_0 = Math.sin(a0), c1 = Math.cos(a1), s_1 = Math.sin(a1), ri = Math.max(0, rr - hw), ro = rr + hw; quad(c0 * ri, gy(ox + c0 * ri, oz + s_0 * ri), s_0 * ri, c0 * ro, gy(ox + c0 * ro, oz + s_0 * ro), s_0 * ro, c1 * ro, gy(ox + c1 * ro, oz + s_1 * ro), s_1 * ro, c1 * ri, gy(ox + c1 * ri, oz + s_1 * ri), s_1 * ri); } parts.push(s1, c, a, k, 1); };
          ring(S.r, 0.22, TEc, 0.95, 3);
          ring(S.ring, 0.18, RIc, 0.9, 2.6);
        } else {
          const fx = -Math.sin(m.yaw), fz = -Math.cos(m.yaw);
          const lane = (dirx, dirz, len, hw, fill) => {
            const n = Math.max(2, Math.ceil(len / 1.2)), nx = -dirz * hw, nz = dirx * hw;
            const s0 = D.n;
            for (let i = 0; i < n; i++) { const d0 = 1.5 + (len - 1.5) * i / n, d1 = 1.5 + (len - 1.5) * (i + 1) / n; const ax = dirx * d0, az = dirz * d0, bx = dirx * d1, bz = dirz * d1; quad(ax + nx, gy(ox + ax + nx, oz + az + nz), az + nz, ax - nx, gy(ox + ax - nx, oz + az - nz), az - nz, bx - nx, gy(ox + bx - nx, oz + bz - nz), bz - nz, bx + nx, gy(ox + bx + nx, oz + bz + nz), bz + nz); }
            parts.push(s0, ZOc, 0.38, 1, 0);
            const s1 = D.n, fl2 = 1.5 + (len - 1.5) * fill, m2 = Math.max(1, Math.ceil((fl2 - 1.5) / 1.2));
            for (let i = 0; i < m2; i++) { const d0 = 1.5 + (fl2 - 1.5) * i / m2, d1 = 1.5 + (fl2 - 1.5) * (i + 1) / m2; const ax = dirx * d0, az = dirz * d0, bx = dirx * d1, bz = dirz * d1, h2 = 0.6; quad(ax + nx * h2, gy(ox + ax, oz + az) + 0.01, az + nz * h2, ax - nx * h2, gy(ox + ax, oz + az) + 0.01, az - nz * h2, bx - nx * h2, gy(ox + bx, oz + bz) + 0.01, bz - nz * h2, bx + nx * h2, gy(ox + bx, oz + bz) + 0.01, bz + nz * h2); }
            parts.push(s1, RIc, 0.85, 2.4, 1);
          };
          if (S.kind === 'band') lane(fx, fz, S.len, S.w / 2, S.fill);
          else { const pp = g.player.pos, base = Math.atan2(pp[0] - ox, pp[2] - oz), L2 = Math.min(30, Math.hypot(pp[0] - ox, pp[2] - oz) + 3); for (const s of [-S.spread, 0, S.spread]) lane(Math.sin(base + s), Math.cos(base + s), L2, S.w / 2, S.fill); }
        }
      }
      // the searchlight: crossed quads from the lantern down onto the land, its spot on the ground
      if (C.lp && C.rise >= 1 && b.st !== 'down' && b.st !== 'stagger') {
        let yaw = m.yaw + B2.beamYaw(C.beamT || 0), pitch = B2.beamPitch(C.beamT || 0);
        if (b.st === 'tele' && b.att === 'fan' && !b.calm) { const pp = g.player.pos; yaw = Math.atan2(-(pp[0] - C.lp[0]), -(pp[2] - C.lp[2])); pitch = Math.atan2(pp[1] + 1 - C.lp[1], Math.hypot(pp[0] - C.lp[0], pp[2] - C.lp[2])); }
        const cp = Math.cos(pitch), dx = -Math.sin(yaw) * cp, dy = Math.sin(pitch), dz = -Math.cos(yaw) * cp;
        if ((C.hitT = (C.hitT || 0) - 1) <= 0 || !C.hitL) { C.hitT = 8; let L3 = 40; for (let s = 2; s <= 40; s += 2) { const x = C.lp[0] + dx * s, y = C.lp[1] + dy * s, z = C.lp[2] + dz * s; if (w.isLoaded(Math.floor(x), Math.floor(z)) && y <= topY(w, x, z)) { L3 = s; break; } } C.hitL = L3; }
        const Lb = C.hitL, bx = C.lp[0] - ox, by = C.lp[1] - oy, bz = C.lp[2] - oz;
        const sx = -dz, sz = dx, sl = Math.hypot(sx, sz) || 1, ux = sx / sl, uz = sz / sl;   // the side and the up of the beam
        const upx = -dx * dy, upy = cp * cp, upz = -dz * dy;   // (the beam's up: its direction crossed with its side)
        const nseg = lo(g) ? 1 : 3, nlay = lo(g) ? 1 : 2;
        for (let j = 0; j < nseg * nlay; j++) {
          const i = j % nseg, lay = (j / nseg) | 0, wk = lay ? 2.6 : 1;
          const u0 = i / nseg, u1 = (i + 1) / nseg, w0 = (0.18 + 0.7 * u0) * wk, w1 = (0.18 + 0.7 * u1) * wk;
          const ax = bx + dx * Lb * u0, ay = by + dy * Lb * u0, az = bz + dz * Lb * u0, ex = bx + dx * Lb * u1, ey = by + dy * Lb * u1, ez = bz + dz * Lb * u1;
          const s1 = D.n;
          quad(ax + ux * w0, ay, az + uz * w0, ax - ux * w0, ay, az - uz * w0, ex - ux * w1, ey, ez - uz * w1, ex + ux * w1, ey, ez + uz * w1);
          quad(ax + upx * w0, ay + upy * w0, az + upz * w0, ax - upx * w0, ay - upy * w0, az - upz * w0, ex - upx * w1, ey - upy * w1, ez - upz * w1, ex + upx * w1, ey + upy * w1, ez + upz * w1);
          parts.push(s1, b.calm ? CYc : RVc, (lay ? 0.1 : 0.42) * (1 - 0.28 * i), lay ? 1.2 : 1.8, 1);
        }
        if (Lb < 40) {   // the spot where it touches the land
          const hx = bx + dx * Lb, hz = bz + dz * Lb, s2 = D.n, n = 12, rr = 1.6 + Lb * 0.05;
          for (let i = 0; i < n; i++) { const a0 = i * TAU / n, a1 = (i + 1) * TAU / n; const x0 = hx + Math.cos(a0) * rr, z0 = hz + Math.sin(a0) * rr, x1 = hx + Math.cos(a1) * rr, z1 = hz + Math.sin(a1) * rr; putV(hx, gy(ox + hx, oz + hz), hz); putV(x0, gy(ox + x0, oz + z0), z0); putV(x1, gy(ox + x1, oz + z1), z1); }
          parts.push(s2, b.calm ? CYc : RVc, 0.5, 2, 1);
        }
      }
      if (D.n) {
        gl.bindVertexArray(B2.vao); gl.bindBuffer(gl.ARRAY_BUFFER, B2.vbo); gl.bufferSubData(gl.ARRAY_BUFFER, 0, DV, 0, D.n * 5);
        gl.uniform3f(p.u.u_offset, ox - cam.x, oy - cam.y, oz - cam.z);
        for (let i = 0; i < parts.length; i += 5) { const a = parts[i], e = i + 5 < parts.length ? parts[i + 5] : D.n; if (e > a) { color(parts[i + 1], parts[i + 2], parts[i + 3] * (parts[i + 4] ? day : 1), parts[i + 4]); gl.drawArrays(gl.TRIANGLES, a, e - a); } }
        B2.cost.verts = D.n;
      }
    }
    gl.disable(gl.POLYGON_OFFSET_FILL); gl.depthMask(true); gl.disable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    if (cull) gl.enable(gl.CULL_FACE);
    gl.bindVertexArray(null);
  };
  B2.parts = [];

  // ---------------------------------------------------------------- the conquest map
  const RP = VR.RPGame;
  if (RP) {
    { const o = RP.drawMap; RP.drawMap = function () { if (!on()) return o.apply(this, arguments); try { return B2.drawMap(); } catch (e) { warn(e); return o.apply(this, arguments); } }; }
    { const o = RP.mapHtml; RP.mapHtml = function () {
      const h = o.apply(this, arguments); if (!on()) return h;
      const g = game(), s = RP.st(), sites = RP.sites(), C = R.conquest(sites, s), n = B2.nextGoal(C, sites, g && g.player ? g.player.pos : null);
      const goal = !n ? T('g.rpg.boss2.nextNone') : n.kind === 'boss' ? T('g.rpg.boss2.nextBoss', { d: n.d }) : T('g.rpg.boss2.nextOut', { name: n.name, d: n.d });
      const leg = [['out', '◆', '#b65cff'], ['free', '◆', '#7ff6ff'], ['travel', '⚡', '#7ff6ff'], ['boss', '⬢', '#ff5ea8'], ['shop', '⌂', '#ffd76a'], ['goal', '◎', '#ffe27a']]
        .map(([k, ic, c]) => `<span><i style="color:${c}">${ic}</i>${esc(T('g.rpg.boss2.leg.' + k))}</span>`).join('');
      const add = `<div class="rgoal"><small>${esc(T('g.rpg.boss2.next'))}</small><b>${esc(goal)}</b></div><div class="rleg">${leg}</div>`;
      return h.replace('<div class="rworld">', add + '<div class="rworld">');
    }; }
  }
  const shade = (c, k) => `rgb(${Math.round(c[0] * k)},${Math.round(c[1] * k)},${Math.round(c[2] * k)})`;
  B2.drawMap = function () {
    const cv = hasDoc && document.getElementById('rpgmapc'); if (!cv || !cv.getContext) return;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    css();
    const g = game(), s = RP.st(), sites = RP.sites(), C = R.conquest(sites, s), W = cv.width, H = cv.height, S = R.BAL.REGION;
    const pp = g && g.player ? g.player.pos : [0, 0, 0], vils = g && g.villages && g.villages.sites ? g.villages.sites : [];
    let x0 = pp[0], x1 = pp[0], z0 = pp[2], z1 = pp[2];
    for (const q of sites) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); z0 = Math.min(z0, q.z); z1 = Math.max(z1, q.z); }
    const span = Math.max(600, x1 - x0, z1 - z0) * 1.3, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, k = W / span;
    const X = (x) => W / 2 + (x - cx) * k, Z = (z) => H / 2 + (z - cz) * k;
    const bg = ctx.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, W * 0.75); bg.addColorStop(0, '#1b2a3c'); bg.addColorStop(1, '#0a111d');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    // the regions as their own tiles: red-violet while disturbed, toward teal as they are freed, gold-green when healed
    for (const r of C.regions) {
      const [rx, rz] = r.id.split('_').map(Number), t = r.pct / 100, healed = r.boss === 'won';
      const col = healed ? [120, 210, 120] : [Math.round(170 - 120 * t), Math.round(60 + 150 * t), Math.round(170 + 30 * t)];
      const px = X(rx * S), pz = Z(rz * S), pw = S * k;
      const gr = ctx.createLinearGradient(px, pz, px + pw, pz + pw); gr.addColorStop(0, `rgba(${col},0.30)`); gr.addColorStop(1, `rgba(${col},0.14)`);
      ctx.fillStyle = gr; ctx.fillRect(px, pz, pw, pw);
      ctx.strokeStyle = `rgba(${col},.75)`; ctx.lineWidth = 2; ctx.setLineDash(healed ? [] : [8, 6]); ctx.strokeRect(px + 1, pz + 1, pw - 2, pw - 2); ctx.setLineDash([]);
    }
    // the land's own colours round the player (the loaded columns, as the world map sees them)
    const mv = g && g.map;
    if (mv && mv.colorAt) {
      const R0 = Math.min(220, (g.settings.renderDist || 6) * 16), step = Math.max(2, Math.ceil(2 / k)), n = Math.ceil(2 * R0 / step);
      const off = B2.mapOff || (B2.mapOff = document.createElement('canvas')); off.width = n; off.height = n;
      const oc = off.getContext('2d'), img = oc.createImageData(n, n), d = img.data, col = [0, 0, 0];
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const wx = Math.floor(pp[0] - R0 + i * step), wz = Math.floor(pp[2] - R0 + j * step), o = (j * n + i) * 4, dd = Math.hypot(i - n / 2, j - n / 2) / (n / 2);
        if (dd > 1 || !mv.colorAt(wx, wz, col)) { d[o + 3] = 0; continue; }
        d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = Math.round(235 * Math.min(1, (1 - dd) * 3));
      }
      oc.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true; ctx.drawImage(off, X(pp[0] - R0), Z(pp[2] - R0), 2 * R0 * k, 2 * R0 * k);
    }
    ctx.strokeStyle = 'rgba(140,180,255,.06)'; ctx.lineWidth = 1;
    for (let i = 0; i <= 8; i++) { ctx.beginPath(); ctx.moveTo(i * W / 8, 0); ctx.lineTo(i * W / 8, H); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i * H / 8); ctx.lineTo(W, i * H / 8); ctx.stroke(); }
    // the fast-travel net between freed beacons
    const fr = sites.filter(q => q.free);
    ctx.strokeStyle = 'rgba(90,240,255,.45)'; ctx.lineWidth = 2; ctx.setLineDash([3, 5]);
    for (let i = 1; i < fr.length; i++) { ctx.beginPath(); ctx.moveTo(X(fr[i - 1].x), Z(fr[i - 1].z)); ctx.lineTo(X(fr[i].x), Z(fr[i].z)); ctx.stroke(); }
    ctx.setLineDash([]);
    // the next goal: a dashed line from the player, a double ring
    const ng = B2.nextGoal(C, sites, pp);
    if (ng) { ctx.strokeStyle = 'rgba(255,226,122,.7)'; ctx.lineWidth = 2; ctx.setLineDash([10, 7]); ctx.beginPath(); ctx.moveTo(X(pp[0]), Z(pp[2])); ctx.lineTo(X(ng.x), Z(ng.z)); ctx.stroke(); ctx.setLineDash([]); }
    const lab = (txt, x, y, c) => { ctx.font = '700 11px sans-serif'; const tw = ctx.measureText(txt).width; ctx.fillStyle = 'rgba(6,10,22,.72)'; ctx.fillRect(x - 3, y - 11, tw + 6, 15); ctx.fillStyle = c; ctx.fillText(txt, x, y); };
    for (const ic of B2.mapIcons(C, sites, vils)) {
      const x = X(ic.x), z = Z(ic.z); if (x < -20 || z < -20 || x > W + 20 || z > H + 20) continue;
      ctx.save(); ctx.translate(x, z);
      if (ic.kind === 'outpost') {
        const c = ic.free ? '#7ff6ff' : '#c06bff'; ctx.shadowColor = c; ctx.shadowBlur = 10;
        ctx.fillStyle = shade(ic.free ? [20, 60, 70] : [50, 20, 70], 1); ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(8, 0); ctx.lineTo(0, 11); ctx.lineTo(-8, 0); ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 0; ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = c; ctx.fillRect(-1.5, -5, 3, 8); ctx.beginPath(); ctx.arc(0, -6, 2.6, 0, TAU); ctx.fill();
      } else if (ic.kind === 'travel') {
        ctx.translate(10, 9); ctx.fillStyle = '#0d2a33'; ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, TAU); ctx.fill(); ctx.strokeStyle = '#7ff6ff'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.moveTo(1, -5); ctx.lineTo(-3, 1); ctx.lineTo(0, 1); ctx.lineTo(-1, 5); ctx.lineTo(3, -1); ctx.lineTo(0, -1); ctx.closePath(); ctx.fill();
      } else if (ic.kind === 'shop') {
        ctx.shadowColor = '#ffd76a'; ctx.shadowBlur = 8; ctx.fillStyle = '#ffd76a'; ctx.beginPath(); ctx.moveTo(-7, -1); ctx.lineTo(0, -8); ctx.lineTo(7, -1); ctx.closePath(); ctx.fill(); ctx.fillRect(-5.5, -1, 11, 8);
        ctx.shadowBlur = 0; ctx.fillStyle = '#5a3a10'; ctx.beginPath(); ctx.arc(0, 3, 2.6, 0, TAU); ctx.fill();
        if (ic.name) lab(ic.name, 10, 4, '#ffe8b0');
      } else if (ic.kind === 'boss') {
        const c = ic.won ? '#ffd76a' : '#ff5ea8';
        ctx.shadowColor = c; ctx.shadowBlur = 18; ctx.fillStyle = ic.won ? '#4a3a10' : '#3a0f2a';
        ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + Math.PI / 6; ctx.lineTo(Math.cos(a) * 13, Math.sin(a) * 13); } ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 0; ctx.strokeStyle = c; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.fillStyle = c; ctx.fillRect(-7, -3, 14, 4); ctx.fillRect(-1.5, -10, 3, 6); ctx.beginPath(); ctx.arc(0, 5, 2.5, 0, TAU); ctx.fill();
        lab(T('g.rpg.map.core'), 16, 4, ic.won ? '#ffe08a' : '#ffc0de');
      }
      ctx.restore();
    }
    for (const q of sites) { const x = X(q.x), z = Z(q.z); if (q.name) lab(q.name, x + 11, z - 6, q.free ? '#c8fbff' : '#ead2ff'); }
    // the regions' names at the foot of their visible tile, in the middle
    for (const r of C.regions) {
      const [rx, rz] = r.id.split('_').map(Number), ax = Math.max(0, X(rx * S)), bx = Math.min(W, X((rx + 1) * S)), bz = Math.min(H, Z((rz + 1) * S));
      const txt = RP.regionName(r) + ' · ' + r.pct + ' %'; ctx.font = '700 11px sans-serif'; const tw = ctx.measureText(txt).width;
      lab(txt, clamp((ax + bx) / 2 - tw / 2, 4, W - tw - 4), clamp(bz - 8, 14, H - 6), r.boss === 'won' ? '#ffe08a' : '#e8f4ff');
    }
    if (ng) {
      const x = X(ng.x), z = Z(ng.z); ctx.save(); ctx.translate(x, z);
      ctx.shadowColor = '#ffe27a'; ctx.shadowBlur = 16; ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 19, 0, TAU); ctx.stroke();
      ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 25, 0, TAU); ctx.stroke(); ctx.shadowBlur = 0;
      for (let i = 0; i < 4; i++) { const a = i * TAU / 4; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 27, Math.sin(a) * 27); ctx.lineTo(Math.cos(a) * 34, Math.sin(a) * 34); ctx.stroke(); }
      ctx.restore(); lab(T('g.rpg.boss2.leg.goal'), x - 20, z - 30, '#ffe27a');
    }
    const yaw = g && g.player ? g.player.yaw : 0, px = X(pp[0]), pz = Z(pp[2]);
    ctx.save(); ctx.translate(px, pz); ctx.rotate(-yaw + Math.PI); ctx.shadowColor = '#000'; ctx.shadowBlur = 6; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(8, 9); ctx.lineTo(0, 4); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill(); ctx.restore();
  };

  let cssDone = false;
  function css() {
    if (cssDone || !hasDoc || !document.head) return; cssDone = true;
    const s = document.createElement('style'); s.id = 'rpgboss2css'; s.textContent = CSS; document.head.appendChild(s);
  }
  const CSS = `
#rpgintro { position: absolute; left: 50%; bottom: 16%; width: min(900px, 94vw); transform: translateX(-50%); z-index: 41; pointer-events: none; text-align: center; display: none; }
#rpgintro.on { display: block; animation: rpgIntroIn 1.1s cubic-bezier(.2,1,.3,1) both; } #rpgintro.off { display: block; animation: rpgIntroOut 1s ease-in both; }
@keyframes rpgIntroIn { 0% { opacity: 0; letter-spacing: 22px; } 100% { opacity: 1; } }
@keyframes rpgIntroOut { 0% { opacity: 1; } 100% { opacity: 0; } }
#rpgintro .kick { font: 800 15px/1 var(--font, sans-serif); letter-spacing: 7px; text-transform: uppercase; color: #ffc6e6; text-shadow: 0 2px 4px #000; }
#rpgintro .big { margin-top: 10px; font: 900 64px/1 var(--display, sans-serif); letter-spacing: 6px; text-transform: uppercase; color: #fff0f8; text-shadow: 0 0 28px rgba(255,60,160,.95), 0 0 6px rgba(255,120,200,.9), 0 4px 4px #000; }
#rpgintro .line { margin: 14px auto 0; width: 62%; height: 2px; background: linear-gradient(90deg, transparent, #ff5ea8, #ffd36a, #ff5ea8, transparent); box-shadow: 0 0 12px #ff5ea8; }
#rpgintro .sub { margin-top: 12px; font: 700 18px/1.2 var(--font, sans-serif); color: #fff; text-shadow: 0 2px 3px #000; }
#rpgbossbar.b2 .pips { display: flex; justify-content: center; gap: 8px; margin-top: 6px; }
#rpgbossbar.b2 .pips i { font: 900 11px/1 var(--font, sans-serif); font-style: normal; color: rgba(255,255,255,.45); border: 1.5px solid rgba(255,140,210,.35); border-radius: 999px; padding: 3px 9px; background: rgba(10,8,20,.6); }
#rpgbossbar.b2 .pips i.on { color: #fff; border-color: #ff5ea8; background: rgba(255,60,150,.35); box-shadow: 0 0 10px #ff5ea8; }
#rpgbossbar.b2 .pips i.done { color: #ffe27a; border-color: rgba(255,214,110,.6); }
#rpgbossbar.b2.shield .pips i.on { border-color: #6fc8ff; background: rgba(80,170,255,.35); box-shadow: 0 0 10px #6fc8ff; }
#rpgbossbar.b2 .bar { height: 20px; } #rpgbossbar.b2 .bar span { width: 3px; background: rgba(255,255,255,.85); box-shadow: 0 0 6px #fff; }
#rpgchar .rgoal { margin: 0 0 10px; padding: 8px 12px; border-radius: 12px; background: rgba(255,226,122,.1); border: 1px solid rgba(255,226,122,.45); }
#rpgchar .rgoal small { display: block; font: 800 11px/1 var(--font, sans-serif); letter-spacing: 1.5px; text-transform: uppercase; color: #ffe27a; }
#rpgchar .rgoal b { display: block; margin-top: 4px; font: 800 14px/1.25 var(--font, sans-serif); color: #fff; }
#rpgchar .rleg { display: flex; flex-wrap: wrap; gap: 4px 10px; margin: 0 0 10px; font: 700 11px/1.3 var(--font, sans-serif); color: #cfe0f5; }
#rpgchar .rleg i { font-style: normal; margin-right: 4px; }
`;
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

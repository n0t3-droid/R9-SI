// ============================================================================
// f-folk5 · VR.Folk5 — u-folk4's villagers polished, and the Laternenzug (plan docs/superpowers/plans/2026-11-05-f-folk5.md).
// From u-folk4's self-review: the scenes were crowded, a friend's greeting small on screen. Built on folk4.js (the
// moments: VR.Folk4), folkjoy.js (the pets, the clips: clap, cheer, hug), dusk.js (the Flausellichter: VR.Dusk.lure).
//   room       while a dance ring or a picnic holds, pets, passive animals and passers-by are set back onto a keep-off
//              rim round it (walkers slide round); up to five free people near step to a loose onlooker ring outside it
//              (the side toward you left open), face the middle, clap in turns and sway to the fiddle
//   friends    from the third meeting (F4.meet) a greeting is big: the friend comes a few steps toward you, waves with
//              both arms (or leans in as for a hug), a heart over the head, a longer happy squint — and the squint now
//              also shows on the voxel people (Very Low): the lids part, lowered half an eye (villages.js' voxel branch)
//   Laternenzug on some evenings (~1 in 2 by a hash of seed, night and village; once a night; 11600–12800, after that
//              evening's dance or late; no rain; ≥ 3 free children near you) a line of children walks a loop through the
//              village with paper lanterns on sticks, singing a soft song of our own (the game's own tones, at their
//              place), now and then a line of it in a bubble; the Flausellichter follow; people they pass wave
// Pure (node, test/folk5.js): keepOff · ringSpots · evening · lantOk · loop · SONG · KEY · BEAT · TEXT_KEYS.
// Cost 🟢: the frame returns at its first test without a moment; with one a loop over the pets, the animals near and the
// village's people (a dance, a picnic) or the procession's 3–6 children. Lanterns (a voxel model, the creatures' existing
// program) and their glow drawn Low and up only; Very Low: the children walk and sing, nothing new drawn, no new program.
// Switch: folk4's „Kleine Momente im Dorf" (settings.folk4); F5.sw for measurements.
// ============================================================================
(function (VR) {
  'use strict';
  const F5 = VR.Folk5 = VR.Folk5 || {};
  const F4 = VR.Folk4;
  const TAU = Math.PI * 2;

  // ---------------------------------------------------------------- pure: the room round a scene
  // (x, z) inside the circle (cx, cz, R): out = the point on its rim on (x, z)'s side → true; outside → false
  F5.keepOff = function (x, z, cx, cz, R, out) {
    const dx = x - cx, dz = z - cz, d = Math.sqrt(dx * dx + dz * dz);
    if (d >= R) return false;
    if (d < 1e-4) { out[0] = cx + R; out[1] = cz; return true; }
    out[0] = cx + dx / d * R; out[1] = cz + dz / d * R; return true;
  };
  F5.OPEN = 0.9;   // rad: half the arc toward the player kept open (the view on the scene)
  // n onlooker spots on a ring of radius R round (cx, cz), spread over the arc away from openAng → [[x, z, angle]]
  F5.ringSpots = function (cx, cz, R, n, openAng) {
    const out = [], span = TAU - 2 * F5.OPEN;
    for (let i = 0; i < n; i++) { const a = openAng + F5.OPEN + span * (i + 0.5) / n; out.push([cx + Math.cos(a) * R, cz + Math.sin(a) * R, a]); }
    return out;
  };

  // ---------------------------------------------------------------- pure: the Laternenzug's evenings
  F5.WHEN = [11600, 12800];   // env.timeOfDay (12000 sunset; villages.js: dusk 10600–12300)
  F5.LEN = 70;                // s
  F5.SHARE = 50;              // % of the evenings
  F5.evening = (seed, night, place) => (F4 && F4.h3 ? F4.h3((seed | 0) ^ 0x4C41, night | 0, place | 0) : 0) % 100 < F5.SHARE;
  // ctx as F4.pick's {t, tod, rain, kids, seed, place, night}; mem: F4's memory
  F5.lantOk = function (c, mem) {
    if (!c || !mem || (c.rain || 0) > 0.3) return false;
    if (c.t - mem.lastAny < F4.GAP) return false;
    if (c.tod < F5.WHEN[0] || c.tod >= F5.WHEN[1] || (c.kids | 0) < 3) return false;
    if (mem.lant && mem.lant[c.place] === c.night) return false;
    if (c.tod < 12000 && !(mem.dance && mem.dance[c.place] === c.night)) return false;   // (early dusk: the dance first)
    return F5.evening(c.seed, c.night, c.place);
  };
  // n points of a loop of radius r round (cx, cz), the first at angle a0 → [[x, z]]
  F5.loop = function (cx, cz, r, n, a0) { const o = []; for (let i = 0; i < n; i++) { const a = a0 + i * TAU / n; o.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); } return o; };
  // the song (our own tune): G major pentatonic, eight bars of four, [midi, beats]
  F5.KEY = 67; F5.BPM = 92; F5.BEAT = 60 / F5.BPM;
  F5.SONG = [[67, 1], [69, 1], [71, 1], [71, 1], [69, 1], [71, 1], [74, 2], [76, 1], [74, 1], [71, 1], [69, 1], [71, 2], [67, 2],
    [69, 1], [71, 1], [74, 1], [76, 1], [79, 2], [76, 2], [74, 1], [71, 1], [69, 1], [71, 1], [67, 4]];
  F5.TEXT_KEYS = ['g.f5.lant.go', 'g.f5.lant.end', 'g.f5.lant.wave', 'g.f5.look.0', 'g.f5.look.1', 'g.f5.look.2'];
  for (let i = 0; i < 6; i++) F5.TEXT_KEYS.push('g.f5.lant.' + i);

  // the lanterns (our own: a paper lantern on a stick, 1 voxel = 3 cm; four warm colours)
  const VM = VR.VOXMODELS, Grid = VR.VoxGrid;
  F5.LANT = [0xF29A3A, 0xE8607A, 0xF2D04A, 0x9AD86A];
  if (VM && Grid && !VM.f5_lantern0) F5.LANT.forEach((col, k) => {
    VM['f5_lantern' + k] = () => {
      const gr = new Grid(12, 20, 14, 6, 0, 12);
      for (let y = 0; y <= 17; y++) gr.set(6, y, 12, y < 3 ? 0x5A3A22 : 0x7A5232, 0);   // the stick (the hand at its foot)
      for (let z = 5; z <= 12; z++) gr.set(6, 17, z, 0x7A5232, 0);                       // its arm forward
      gr.set(6, 16, 5, 0x3A2A1A, 0);                                                         // the string
      const dark = ((col >> 1) & 0x7F7F7F);
      gr.ell(6, 10.5, 5, 4, 4.6, 4, (x, y) => (y === 6 || y === 15 ? dark : (y & 1) ? col : (((col & 0xFEFEFE) >> 1) + 0x404040) & 0xFFFFFF), { emis: 1 });   // the paper, its ribs
      gr.box(5, 15, 4, 7, 15, 6, 0x3A2A1A); gr.box(5, 6, 4, 7, 6, 6, 0x3A2A1A);             // the rims
      return { unit: 32, radius: 0.5, parts: { l: { grid: gr, pivot: [0, 0, 0] } }, layout: { l: [0, 0, 0] } };
    };
  });

  // ================================================================ the game
  const Vs = VR.Villages;
  if (!Vs || !F4 || !F4.begin) return;
  const P = Vs.prototype;
  const T = (k, v) => (VR.I18N ? VR.I18N.t(k, v) : k);
  const tierOf = (g) => (VR.LifeKit && VR.LifeKit.tierOf ? VR.LifeKit.tierOf(g.settings) : 2);
  const d2xz = (a, p) => (a.pos[0] - p[0]) ** 2 + (a.pos[2] - p[2]) ** 2;
  const smile = (a, t) => { a.expr = 'joy'; a.exprT = Math.max(a.exprT || 0, t || 2.5); };
  const icon = (a, ch, t) => { a.bubble = { text: ch, t: t || 2.2, icon: true }; };
  const say = (V, a, key, vars, dur) => { if (V.near && !V.near(a, 26)) return; a.say(T(key, vars), dur || 3); };
  const turnTo = (a, x, z, k) => { const t = Math.atan2(-(x - a.pos[0]), -(z - a.pos[2])); let d = t - a.yaw; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; a.yaw += d * Math.min(1, k); };
  F5.stats = { claps: 0, hearts: 0, friends: 0, notes: 0, lookers: 0, lanterns: 0, pushed: 0, waves: 0 };
  F5.sw = { frame: true, draw: true, squint: true };
  const OUT = [0, 0], EMPTY = [];
  const BUSY = new Set(['talk', 'joy', 'outing', 'hide', 'fight', 'sleep', 'school', 'gsplay', 'gsvisit', 'festival', 'f4', 'arrive', 'f5look', 'f5hi', 'play']);
  const free = (V, a) => a && a.pos && !a._f4 && !a._f5 && !a.guest && !a.inBoat && a.pose !== 'sleep' && a.pose !== 'sit' && a.pose !== 'sitground' && a !== V.talking && !a.dance && !(a.act && BUSY.has(a.act.type) && !(a.act.type === 'joy' && (a.act.done || a.act.kind === 'follow'))) && a.drawn !== false;

  // ---------------------------------------------------------------- the room and the onlookers
  F5.zone = function (V) {
    const M = V && V._f4M; if (!M) return null;
    const Z = V._f5Z || (V._f5Z = { c: null, R: 0, M: null });
    if (M.kind === 'dance' && M.D) { Z.c = M.D.c; Z.R = (M.D.r || 2.5) + 0.9; }
    else if (M.kind === 'picnic' && M.spot) { Z.c = M.spot; Z.R = 1.7; }
    else return null;
    Z.M = M; return Z;
  };
  F5.lookers = (V) => (V && V._f5L) || EMPTY;
  function keepRoom(V, Z) {
    const g = V.g, cx = Z.c[0], cy = Z.c[1], cz = Z.c[2], R = Z.R;
    const J = V.joy;
    if (J && J.pets) for (const q of J.pets) if (Math.abs(q.pos[1] - cy) < 3 && F5.keepOff(q.pos[0], q.pos[2], cx, cz, R, OUT)) { q.pos[0] = OUT[0]; q.pos[2] = OUT[1]; F5.stats.pushed++; }
    const mobs = g.entities && g.entities.mobs;
    if (mobs) for (const m of mobs) {
      if (!m || m.dead || !m.pos || !m.def || m.def.hostile || m.def.companion || m.boss || m.foe || Math.abs(m.pos[1] - cy) > 3) continue;
      if (F5.keepOff(m.pos[0], m.pos[2], cx, cz, R, OUT)) { m.pos[0] = OUT[0]; m.pos[2] = OUT[1]; F5.stats.pushed++; }
    }
    const ag = Z.M.vil && Z.M.vil.agents; if (!ag) return;
    for (const a of ag) {
      if (a._f4 === Z.M || a.pose === 'sleep' || a.inBoat || Math.abs(a.pos[1] - cy) > 2.5) continue;
      if (!F5.keepOff(a.pos[0], a.pos[2], cx, cz, R, OUT)) continue;
      if (V.safeCell && !V.safeCell(Math.floor(OUT[0]), Math.floor(a.pos[1] + 0.05), Math.floor(OUT[1]))) continue;
      a.pos[0] = OUT[0]; a.pos[2] = OUT[1]; F5.stats.pushed++;
    }
  }
  F5.MAXL = 5;
  function recruit(V, Z) {
    const L = V._f5L || (V._f5L = []);
    for (let i = L.length - 1; i >= 0; i--) if (L[i]._f5 !== Z.M || !L[i].act || L[i].act.type !== 'f5look') { relL(V, L[i]); L.splice(i, 1); }
    if (L.length < F5.MAXL) {
      const c = Z.c, cand = [];
      for (const a of Z.M.vil.agents) if (free(V, a) && d2xz(a, c) < 16 * 16 && Math.abs(a.pos[1] - c[1]) < 3) cand.push(a);
      cand.sort((x, y) => d2xz(x, c) - d2xz(y, c));
      for (const a of cand) { if (L.length >= F5.MAXL) break; V.setAct(a, { type: 'f5look' }); a._f5 = Z.M; a.talkCool = Math.max(a.talkCool || 0, 1e6); L.push(a); F5.stats.lookers++; }
    }
    if (!L.length) return;
    // the spots: by each one's angle round the middle (nobody crosses another), the near side open
    const p = V.g.player.pos, c = Z.c, open = Math.atan2(p[2] - c[2], p[0] - c[0]);
    const rel = (a) => { let t = Math.atan2(a.pos[2] - c[2], a.pos[0] - c[0]) - open - F5.OPEN; while (t < 0) t += TAU; while (t >= TAU) t -= TAU; return t; };
    L.sort((x, y) => rel(x) - rel(y));
    const S = F5.ringSpots(c[0], c[2], 1, L.length, open);
    L.forEach((a, i) => { const r = Z.R + 1.2 + (i & 1) * 0.9 + (a.p.seed % 3) * 0.1, s = S[i]; const A = a.act; A.spot = [c[0] + (s[0] - c[0]) * r, c[2] + (s[1] - c[2]) * r]; });
  }
  function relL(V, a) {
    a._f5 = null; if (a.act && a.act.type === 'f5look') { a.act = null; a.thinkT = 0; }
    if (a.joyClip === 'clap') a.joyClip = null; a.lookAt = null; a.steer = null; if (a.talkCool > 1e5) a.talkCool = 2;
  }
  function releaseLookers(V) { const L = V._f5L; if (!L) return; for (const a of L) { try { relL(V, a); } catch (e) { a._f5 = null; } } L.length = 0; }
  F5.releaseLookers = releaseLookers;
  function runLook(V, a, act, dt) {
    const Z = F5.zone(V); if (!Z || a._f5 !== Z.M) { relL(V, a); return; }
    const s = act.spot, c = Z.c; if (!s) return;
    const d = Math.hypot(s[0] - a.pos[0], s[1] - a.pos[2]);
    if (act.there && d > 1.2) act.there = false;   // (the spot moved: a newcomer)
    if (!act.there) {
      if (d > 0.45 && act.t < 14) {
        if (d > 3.5 && !(V.time - (a.steerBlocked || -9) > 1)) { a.steer = null; V.goTo(a, s[0], c[1], s[1], 0.45); }
        else { a.path = null; a.steer = a.steer || [0, 0]; a.steer[0] = s[0]; a.steer[1] = s[1]; }
        return;
      }
      act.there = true; a.steer = null; a.path = null; a.vel[0] = 0; a.vel[2] = 0;
      if (Math.random() < 0.35) say(V, a, 'g.f5.look.' + (a.p.seed % 3), null, 2.4);
    }
    a.pose = 'stand'; a.lookAt = a.lookAt || [0, 0, 0]; a.lookAt[0] = c[0]; a.lookAt[1] = c[1] + 1.1; a.lookAt[2] = c[2];
    turnTo(a, c[0], c[2], dt * 5);
    act.clapT = (act.clapT === undefined ? (a.p.seed % 5) * 0.6 : act.clapT) - dt;
    if (act.clapT <= 0) {
      if (Z.M.kind === 'dance' && a.joyClip !== 'clap') { a.joyClip = 'clap'; act.clapT = 1.6 + (a.p.seed % 3) * 0.3; F5.stats.claps++; smile(a, 2.5); }
      else { if (a.joyClip === 'clap') a.joyClip = null; act.clapT = 2.5 + ((a.p.seed + (act.n = (act.n | 0) + 1)) % 4); if (Math.random() < 0.5) smile(a, 2); }
    }
  }

  // ---------------------------------------------------------------- a friend's big greeting
  F5.FR_GAP = 90;   // s between two big greetings of one person
  F5.friendOf = (V, a) => !!(a && a.act && a.act.type === 'f5hi');
  F5.friend = function (V, a) {
    if (!V || !a || V.time - (a._f5frT === undefined ? -1e9 : a._f5frT) < F5.FR_GAP) return false;
    a._f5frT = V.time; F5.stats.friends++;
    a.f4sq = V.time + 3.2; smile(a, 4);
    if (!free(V, a) || a.pose !== 'stand' && a.pose !== undefined && a.pose !== 'walk') { if (V.hearts) V.hearts(a); F5.stats.hearts++; return true; }
    V.setAct(a, { type: 'f5hi', ph: 'come', p0: [a.pos[0], a.pos[2]], hug: (a.p.seed & 1) === 0 && !a.kid });
    return true;
  };
  function endHi(V, a) { if (a.act && a.act.type === 'f5hi') { a.act = null; a.thinkT = 0; } if (a.joyClip === 'cheer' || a.joyClip === 'hug') a.joyClip = null; a.steer = null; a.lookAt = null; }
  function runHi(V, a, act, dt) {
    const p = V.g.player.pos, d = Math.hypot(p[0] - a.pos[0], p[2] - a.pos[2]);
    if (act.ph === 'come') {
      const walked = Math.hypot(a.pos[0] - act.p0[0], a.pos[2] - act.p0[1]);
      if (d > 1.9 && d < 12 && act.t < 3 && walked < 3.5 && !(V.time - (a.steerBlocked || -9) < 0.3)) {
        const k = (d - 1.7) / d; a.path = null; a.steer = a.steer || [0, 0]; a.steer[0] = a.pos[0] + (p[0] - a.pos[0]) * k; a.steer[1] = a.pos[2] + (p[2] - a.pos[2]) * k; return;
      }
      act.ph = 'greet'; act.t0 = act.t; a.steer = null; a.path = null; a.vel[0] = 0; a.vel[2] = 0;
      a.waveT = 0; a.joyClip = act.hug && d < 2.6 ? 'hug' : 'cheer'; smile(a, 3.5); a.f4sq = V.time + 3;
      if (V.hearts) V.hearts(a); F5.stats.hearts++;
    }
    a.lookAt = a.lookAt || [0, 0, 0]; a.lookAt[0] = p[0]; a.lookAt[1] = p[1] + 1.5; a.lookAt[2] = p[2];
    turnTo(a, p[0], p[2], dt * 6); a.pose = 'stand';
    if (act.ph === 'greet' && act.t - act.t0 > 1.9) { a.joyClip = null; act.ph = 'heart'; act.t0 = act.t; }
    if (act.ph === 'heart') {
      if (!act.icon && (!a.bubble || act.t - act.t0 > 2.5)) { icon(a, '♥', 1.6); act.icon = true; act.t0 = act.t; }
      if (act.icon && act.t - act.t0 > 1.4) endHi(V, a);
    }
    if (act.t > 10) endHi(V, a);
  }
  const bHello = F4.hello;
  if (bHello && !bHello.f5) {
    F4.hello = function (V, a, quiet) {
      const r = bHello.apply(this, arguments);
      try {
        const g = V && V.g;
        if (r && a && a.p && F4.on(g)) { const e = F4.rec(g).meet[(g.dim || 'overworld') + '/' + a.p.id]; if (e && e[0] >= 3) F5.friend(V, a); }
      } catch (e) { /* the greeting stands */ }
      return r;
    };
    F4.hello.f5 = true;
  }
  // the happy squint on the voxel people (villages.js' voxel branch calls it for each drawn person; Very Low too): the
  // lids part shown, lowered half an eye and a hair forward (the eye's lower half covered: the cheeks up)
  F5.SQ = [0, 0, 0, 0, -0.5, -0.15];
  F5.squintVox = function (V, a, pose, opts, far) {
    if (!pose) return;
    if (!far && F5.sw.squint && a.f4sq > V.time && !a.blinkOn && a.pose !== 'sleep' && opts && opts.hide) { opts.hide.lids = false; pose.lids = F5.SQ; }
    else if (pose.lids === F5.SQ) pose.lids = null;
  };

  // ---------------------------------------------------------------- the Laternenzug
  F4.LEN.lantern = F5.LEN; F4.COOL.lantern = 900; F4.WHEN.lantern = F5.WHEN;   // (not in F4.KINDS: the wrapped picker offers it)
  const bPick = F4.pick, bNote = F4.note;
  if (!bPick.f5) {
    F4.pick = function (c, mem) { if (F5.lantOk(c, mem)) return 'lantern'; return bPick.apply(this, arguments); };
    F4.pick.f5 = true;
    F4.note = function (mem, k, t, c) { if (k === 'lantern' && c) (mem.lant || (mem.lant = {}))[c.place] = c.night; return bNote.apply(this, arguments); };
  }
  const R = VR.R, FL = VR.F;
  const solidAt = (w, x, y, z) => { const s = w.getBlock(x, y, z); return !!(s && (R.T.flags[s] & FL.SOLID)); };
  const openAt = (w, x, y, z) => { const s = w.getBlock(x, y, z); return !s || !(R.T.flags[s] & (FL.SOLID | FL.OPAQUE | FL.FLUID)); };
  const wetAt = (w, x, y, z) => { const s = w.getBlock(x, y, z); return !!(s && (R.T.flags[s] & FL.FLUID)); };
  function floorAt(w, x, z, y) {
    const y0 = Math.floor(y);
    for (let yy = y0 + 2; yy >= y0 - 3; yy--) if (solidAt(w, x, yy - 1, z) && openAt(w, x, yy, z) && openAt(w, x, yy + 1, z) && !wetAt(w, x, yy - 1, z)) return yy;
    return null;
  }
  // the loop's walkable points (each on open ground, the next within a block's height): round c at radius r, starting
  // on the player's side
  F5.route = function (w, c, r, p) {
    const a0 = Math.atan2(p[2] - c[2], p[0] - c[0]), pts = [];
    let lastY = c[1];
    for (const q of F5.loop(c[0], c[2], r, 14, a0)) {
      let got = null;
      for (const dr of [0, -1.5, 1.5, -3]) {
        const k = (r + dr) / r, x = c[0] + (q[0] - c[0]) * k, z = c[2] + (q[1] - c[2]) * k, fy = floorAt(w, Math.floor(x), Math.floor(z), lastY);
        if (fy !== null && Math.abs(fy - lastY) <= 2) { got = [Math.floor(x) + 0.5, fy, Math.floor(z) + 0.5]; break; }
      }
      if (got) { pts.push(got); lastY = got[1]; }
    }
    return pts;
  };
  F4.extra.lantern = function (V, M, pool) {
    const g = V.g, p = g.player.pos, vil = M.vil;
    const kids = pool.filter(a => a.kid).slice(0, 6); if (kids.length < 3) return false;
    const pz = vil.plan && vil.plan.plaza, dp = pz ? Math.hypot(pz.x + 0.5 - p[0], pz.z + 0.5 - p[2]) : 1e9;
    let route = null;
    const cs = [];
    if (dp < 30) cs.push([pz.x + 0.5, pz.y, pz.z + 0.5]);
    const fy = floorAt(g.world, Math.floor(p[0]), Math.floor(p[2]), p[1]);
    cs.push([p[0] + 6 * Math.cos(g.player.yaw || 0), fy === null ? p[1] : fy, p[2] + 6 * Math.sin(g.player.yaw || 0)]);
    for (const c of cs) { for (const r of [9, 7, 11, 6]) { const rt = F5.route(g.world, c, r, p); if (rt.length >= 9) { route = rt; break; } } if (route) break; }
    if (!route) return false;
    M.route = route; M.wi = 1; M.trail = []; M.spot = route[0].slice(); M.lure = true; M.lureP = [route[0][0], route[0][1], route[0][2]];
    M.ni = 0; M.noteAt = V.time + 2.5; M.sayAt = V.time + 7; M.waveAt = 0; M.n = 0;
    // the leader first, then by distance to it (a short line forms at once)
    kids.sort((x, y) => d2xz(x, route[0]) - d2xz(y, route[0]));
    kids.forEach((k, i) => { V.setAct(k, { type: 'f4', role: 'lant', k: i }); k._f4 = M; k.f5lant = 1 + ((k.p.seed + i) % 4); M.members.push(k); smile(k, 4); });
    say(V, kids[0], 'g.f5.lant.go', null, 3.2);
    if (VR.Dusk) VR.Dusk.lure = M.lureP;
    F5.stats.lanterns++;
    return true;
  };
  function runLant(V, a, act, dt) {
    const M = a._f4, L = M.members, lead = L[0];
    let tx, tz, ty;
    if (a === lead) {
      const w = M.route[M.wi % M.route.length];
      if (Math.hypot(w[0] - a.pos[0], w[2] - a.pos[2]) < 1.1 || (act.t - (act.wiT || 0) > 12)) { M.wi++; act.wiT = act.t; }
      const q = M.route[M.wi % M.route.length]; tx = q[0]; tz = q[2]; ty = q[1];
      // the line keeps together: wait for the last one
      const last = L[L.length - 1];
      if (last !== a && Math.hypot(last.pos[0] - a.pos[0], last.pos[2] - a.pos[2]) > 1.6 * L.length + 2) { a.steer = null; a.path = null; a.vel[0] *= 0.5; a.vel[2] *= 0.5; return; }
    } else {
      const tr = M.trail, i = act.k * 3, j = tr.length - 1 - i;
      const q = j >= 0 ? tr[j] : tr.length ? tr[0] : null;
      if (!q) { tx = lead.pos[0]; tz = lead.pos[2]; ty = lead.pos[1]; } else { tx = q[0]; tz = q[2]; ty = q[1]; }
      const prev = L[act.k - 1], dp = prev ? Math.hypot(prev.pos[0] - a.pos[0], prev.pos[2] - a.pos[2]) : 9;
      if (dp < 1.0) { a.steer = null; a.path = null; return; }   // (not on the heels of the one before)
    }
    const d = Math.hypot(tx - a.pos[0], tz - a.pos[2]);
    if (d > 5 || (V.time - (a.steerBlocked === undefined ? -9 : a.steerBlocked) < 0.5)) { a.steer = null; V.goTo(a, tx, ty, tz, 0.8); }
    else if (d > 0.3) { a.path = null; a.steer = a.steer || [0, 0]; a.steer[0] = tx; a.steer[1] = tz; }
    else { a.steer = null; }
    act.run = d > 6;
    a.pose = 'stand'; a.lookAt = null;
  }
  function lanternTick(V, M, dt) {
    const L = M.members, lead = L[0]; if (!lead) return;
    // the leader's trail (a point every 0.5 m), the moment's place, the lure
    const tr = M.trail, lt = tr[tr.length - 1];
    if (!lt || Math.hypot(lead.pos[0] - lt[0], lead.pos[2] - lt[2]) > 0.5) { tr.push([lead.pos[0], lead.pos[1], lead.pos[2]]); if (tr.length > 3 * L.length + 4) tr.shift(); }
    let cx = 0, cy = 0, cz = 0; for (const k of L) { cx += k.pos[0]; cy += k.pos[1]; cz += k.pos[2]; } cx /= L.length; cy /= L.length; cz /= L.length;
    M.spot[0] = cx; M.spot[1] = cy; M.spot[2] = cz;
    M.lureP[0] = lead.pos[0]; M.lureP[1] = lead.pos[1]; M.lureP[2] = lead.pos[2];
    if (VR.Dusk) VR.Dusk.lure = M.lureP;
    // the song
    if (V.time - M.noteAt > 1) M.noteAt = V.time;
    if (V.time >= M.noteAt && M.t < M.len - 3) {
      const n = F5.SONG[M.ni]; sing(V, M, n); M.noteAt += n[1] * F5.BEAT; M.ni++;
      if (M.ni >= F5.SONG.length) { M.ni = 0; M.noteAt += 3.5; }
    }
    // a line of it now and then, the notes over their heads
    if (V.time >= M.sayAt && M.t < M.len - 6) { M.sayAt = V.time + 9 + (M.n % 3) * 2; const k = L[(M.n = M.n + 1) % L.length]; say(V, k, 'g.f5.lant.' + ((k.p.seed + M.n) % 6), null, 3); smile(k, 3); }
    else if (Math.random() < dt * 0.5) { const k = L[(Math.random() * L.length) | 0]; if (!k.bubble) icon(k, '♪', 1.4); }
    // the people they pass wave
    if (V.time >= M.waveAt) {
      M.waveAt = V.time + 0.5;
      for (const a of M.vil.agents) if (!a._f4 && a._f5wv !== M && a.pose !== 'sleep' && d2xz(a, lead.pos) < 4.5 * 4.5) { a._f5wv = M; a.waveT = Math.max(a.waveT || 0, 1.4); smile(a, 3); F5.stats.waves++; if (!a.bubble && Math.random() < 0.3) say(V, a, 'g.f5.lant.wave', null, 2.4); }
    }
    // the end: good night
    if (!M.bye && M.t > M.len - 3) { M.bye = true; say(V, lead, 'g.f5.lant.end', null, 3); if (V.hearts) V.hearts(lead); }
    // a warm glow round each lantern (Low and up)
    const g = V.g;
    if (tierOf(g) >= 1 && g.particles && g.particles.glow && Math.random() < dt * 1.5) { const k = L[(Math.random() * L.length) | 0], h = lanternAt(k); g.particles.glow(h[0], h[1], h[2], [1, 0.75, 0.4], 1.2, 0.07, 0.15); }
  }
  // where a child's lantern hangs (the hand forward right, the stick up, the lantern at its arm's end)
  const LP = [0, 0, 0];
  function lanternAt(a) {
    const y = a.yaw, sc = a.kid ? 0.82 : 1, fx = -Math.sin(y), fz = -Math.cos(y), rx = Math.cos(y), rz = -Math.sin(y);
    LP[0] = a.pos[0] + (fx * 0.3 + rx * 0.12) * sc + fx * 0.19; LP[1] = a.pos[1] + 0.66 * sc + 0.33; LP[2] = a.pos[2] + (fz * 0.3 + rz * 0.12) * sc + fz * 0.19;
    return LP;
  }
  function sing(V, M, n) {
    F5.stats.notes++;
    const g = V.g, au = g.audio; if (!au || !au.tone || F5.mute) return;
    const lead = M.members[0], f = 440 * Math.pow(2, (n[0] - 69) / 12), dur = n[1] * F5.BEAT * 0.92;
    try {
      let dest;
      if (au.ctx && au.inlet) { const at = M._at || (M._at = [0, 0, 0]); at[0] = lead.pos[0]; at[1] = lead.pos[1] + 1.1; at[2] = lead.pos[2]; dest = au.inlet(at, au.ctx.currentTime + dur + 0.3); if (!dest) return; }
      au.tone(f, 0.045, dur, 'sine', true, undefined, dest);
      au.tone(f * 1.006, 0.018, dur * 0.9, 'triangle', false, undefined, dest);   // (a second child's voice, a hair apart)
    } catch (e) { /* no sound */ }
  }

  // ---------------------------------------------------------------- the frame (after folk4's)
  F5.frame = function (V, dt) {
    if (!F5.sw.frame) return;
    const M = V._f4M;
    if (!M) { if (V._f5L && V._f5L.length) releaseLookers(V); return; }
    if (M.kind === 'lantern') { if (M.route) lanternTick(V, M, dt); return; }
    const Z = F5.zone(V); if (!Z) return;
    keepRoom(V, Z);
    if ((V._f5rc = (V._f5rc || 0) - dt) <= 0) { V._f5rc = 1; recruit(V, Z); }
  };
  const bEnd = F4.end;
  if (!bEnd.f5) {
    F4.end = function (V, M) {
      const MM = M || (V && V._f4M);
      try { bEnd.apply(this, arguments); } finally {
        if (V) { try { releaseLookers(V); } catch (e) { /* done */ } }
        if (MM && MM.kind === 'lantern') for (const k of MM.members) k.f5lant = 0;
      }
    };
    F4.end.f5 = true;
    F4.onClear.push((V) => { releaseLookers(V); for (const a of V.agents || []) { if (a.f5lant) a.f5lant = 0; if (a._f5) relL(V, a); if (a.act && a.act.type === 'f5hi') endHi(V, a); } });
  }

  // ---------------------------------------------------------------- the villages' hooks (additive)
  const bUpdate = P.update;
  P.update = function (dt) { bUpdate.call(this, dt); try { F5.frame(this, dt); } catch (e) { if (!F5.warned) { F5.warned = true; console.warn('folk5', e); } } };
  const bThink = P.think, bRun = P.runAct, bSocial = P.social, bSet = P.setAct;
  if (bThink) P.think = function (a) {
    if (a._f5 || (a.act && a.act.type === 'f5hi')) { if (this.danger && this.danger(a)) { if (a._f5) relL(this, a); else endHi(this, a); return bThink.apply(this, arguments); } return; }
    return bThink.apply(this, arguments);
  };
  if (bRun) P.runAct = function (a, dt) {
    const act = a.act;
    if (act) {
      if (act.type === 'f5look') { act.t = (act.t || 0) + dt; try { runLook(this, a, act, dt); } catch (e) { relL(this, a); } return; }
      if (act.type === 'f5hi') { act.t = (act.t || 0) + dt; try { runHi(this, a, act, dt); } catch (e) { endHi(this, a); } return; }
      if (act.type === 'f4' && act.role === 'lant') { if (!a._f4) { a.act = null; return; } act.t = (act.t || 0) + dt; try { runLant(this, a, act, dt); } catch (e) { F4.end(this, a._f4); } return; }
    }
    return bRun.apply(this, arguments);
  };
  if (bSet) P.setAct = function (a, act) { if (a && (a._f5 || (a.act && a.act.type === 'f5hi')) && act && act.type !== 'hide' && act.type !== 'fight' && act.type !== 'f5look' && act.type !== 'f5hi') return; return bSet.apply(this, arguments); };
  if (bSocial) P.social = function (a) { if (a._f5 || (a.act && a.act.type === 'f5hi')) return; return bSocial.apply(this, arguments); };
  // the bodies: onlookers sway, a friend leans in, a child holds the lantern up
  const bPose = P.pose;
  if (bPose) P.pose = function (a, t) {
    const Q = bPose.apply(this, arguments);
    if (!Q || !(a.f5lant || a._f5 || (a.act && a.act.type === 'f5hi'))) return Q;
    if (a.f5lant && a.pose === 'stand') {
      const o = Q.arm_r || [0, 0, 0]; Q.arm_r = [1.05 + Math.sin(t * 2.4 + a.p.seed) * 0.05, 0, -0.1, o[3] || 0, o[4] || 0, o[5] || 0];
      const f = Q.fore_r || [0, 0, 0]; Q.fore_r = [0.35, 0, 0, f[3] || 0, f[4] || 0, f[5] || 0];
    } else if (a._f5 && !a.joyClip && Q.body) {
      const M = a._f5; if (M.kind === 'dance') { Q.body[2] = (Q.body[2] || 0) + Math.sin(t * Math.PI * (F4.BPM || 104) / 60 + a.p.seed) * 0.07; if (Q.head) Q.head[2] = (Q.head[2] || 0) + Math.sin(t * Math.PI * (F4.BPM || 104) / 60 + a.p.seed + 0.6) * 0.06; }
    } else if (a.joyClip === 'hug' && a.act && a.act.type === 'f5hi' && Q.body) { Q.body[0] = (Q.body[0] || 0) - 0.2; }
    return Q;
  };
  // the lanterns' draw (Low and up)
  const bDraw = P.draw;
  if (bDraw) P.draw = function (r, E, cam) {
    bDraw.call(this, r, E, cam);
    const M = this._f4M; if (!M || M.kind !== 'lantern' || !F5.sw.draw || !VR.LifeKit) return;
    const g = this.g, ent = g.entities; if (!ent || !ent.beginVox || tierOf(g) < 1) return;
    let prog = null;
    const O = F5._lo || (F5._lo = { roll: 0, scale: 1 }), t = this.time;
    for (const a of M.members) {
      if (!a.f5lant || (a.pos[0] - cam.x) ** 2 + (a.pos[2] - cam.z) ** 2 > 50 * 50) continue;
      const y = a.yaw, sc = a.kid ? 0.82 : 1, fx = -Math.sin(y), fz = -Math.cos(y), rx = Math.cos(y), rz = -Math.sin(y);
      const H = F5._lp || (F5._lp = [0, 0, 0]);
      H[0] = a.pos[0] + (fx * 0.3 + rx * 0.12) * sc; H[1] = a.pos[1] + 0.66 * sc; H[2] = a.pos[2] + (fz * 0.3 + rz * 0.12) * sc;
      O.roll = Math.sin(t * 2.2 + a.p.seed) * 0.1;
      if (!prog) prog = ent.beginVox(r, E);
      VR.LifeKit.drawModel(g, r, prog, 'f5_lantern' + ((a.f5lant - 1) & 3), H, y, cam, O);
    }
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

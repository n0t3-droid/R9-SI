// ============================================================================
// Village life, part two: children really play (tag, hide & seek, hopping
// games), families go on hikes to scenic spots and have picnics, some take a
// little sailboat out on the lake or sea, and nobody walks through anybody.
// Extends VR.Villages (villages.js).
// ============================================================================
(function (VR) {
  'use strict';
  // the player's language (lang_de.js / lang_en.js): T a text, TL a list of lines
  const T = (k, v, fb) => (VR.I18N ? VR.I18N.t(k, v, fb) : (fb !== undefined ? fb : k)), TL = (k) => (VR.I18N && VR.I18N.list ? VR.I18N.list(k) : []);
  const Vs = VR.Villages, Folk = VR.Folk, R = VR.R, F = VR.F;
  if (!Vs || !Folk) return;
  const P = Vs.prototype;
  const pick = (arr) => (arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : '');
  const TAU = Math.PI * 2;

  // ---------------------------------------------------------------- steering on open ground
  // safe to step onto (x, z) at about height y? (ground below, no fluid, head room)
  P.safeCell = function (x, y, z) {
    const w = this.g.world, T = R.T;
    const b0 = w.getBlock(x, y, z), b1 = w.getBlock(x, y + 1, z);
    if ((T.flags[b0] & F.FLUID) || (T.flags[b1] & F.SOLID)) return false;
    if (T.flags[b0] & F.SOLID) return !(T.flags[w.getBlock(x, y + 2, z)] & F.SOLID); // a step up
    for (let k = 1; k <= 2; k++) { const s = w.getBlock(x, y - k, z); if (T.flags[s] & F.FLUID) return false; if (T.flags[s] & F.SOLID) return true; }
    return false;
  };

  // ---------------------------------------------------------------- children's games
  P.playGame = function (vil) {
    const now = this.time;
    const kids = vil.agents.filter(o => o.kid && o.act && o.act.type === 'play');
    let G = vil.game;
    if (!G || now > G.until || (G.type !== 'hop' && kids.length < 2)) {
      const types = kids.length >= 3 ? ['tag', 'hide', 'tag', 'hop', 'hide'] : kids.length === 2 ? ['tag', 'tag', 'hop'] : ['hop'];
      G = vil.game = { type: pick(types), until: now + 70 + Math.random() * 70, it: null, seeker: null, phase: 'count', t0: now, found: new Set(), spots: new Map(), lastN: 0 };
    }
    G.kids = kids;
    return G;
  };
  P.play = function (a, act, dt) {
    const vil = a.vil, G = this.playGame(vil);
    act.run = true; act.game = G.type;
    if (G.type === 'tag') this.playTag(a, act, vil, G, dt);
    else if (G.type === 'hide') this.playHide(a, act, vil, G, dt);
    else this.playHop(a, act, vil, G, dt);
  };
  P.playArea = function (vil) { const pz = vil.plan.plaza; return { cx: pz.x + 0.5, cz: pz.z + 0.5, y: pz.y, R: (pz.r || 5) + 5 }; };
  P.playTag = function (a, act, vil, G, dt) {
    const A = this.playArea(vil);
    if (!G.it || !G.kids.includes(G.it)) { G.it = pick(G.kids); G.itWait = this.time + 2; if (G.it && this.near(G.it, 24)) G.it.say(pick(TL('g.play.it')), 2.2); }
    const it = G.it;
    if (a === it) {
      if (this.time < G.itWait) { a.eyesClosed = true; a.lookAt = [A.cx, A.y + 1, A.cz]; return; }
      let best = null, bd = 1e9;
      for (const o of G.kids) { if (o === a || o.taggedT > this.time) continue; const d = (o.pos[0] - a.pos[0]) ** 2 + (o.pos[2] - a.pos[2]) ** 2; if (d < bd) { bd = d; best = o; } }
      if (!best) return;
      a.steer = [best.pos[0], best.pos[2]];
      if (bd < 0.85 * 0.85 && Math.abs(best.pos[1] - a.pos[1]) < 1.3) {
        G.it = best; G.itWait = this.time + 1.8; a.taggedT = this.time + 3;
        if (this.near(a, 24)) { a.say(T('g.play.tag'), 2); best.say(pick(TL('g.play.tagged')), 2); if (this.g.audio) this.g.audio.tone(880, 0.05, 0.12, 'triangle', true); }
      }
      return;
    }
    const dx = a.pos[0] - it.pos[0], dz = a.pos[2] - it.pos[2], d = Math.hypot(dx, dz) || 1;
    if (d < 6.5 && this.time >= G.itWait - 0.6) {
      // flee — bend around the play area's edge instead of running off into the fields
      let fx = dx / d, fz = dz / d;
      const ox = a.pos[0] - A.cx, oz = a.pos[2] - A.cz, od = Math.hypot(ox, oz) || 1;
      if (od > A.R * 0.7) { const side = (ox * fz - oz * fx) > 0 ? 1 : -1; fx = fx * 0.3 - oz / od * side - ox / od * 0.5; fz = fz * 0.3 + ox / od * side - oz / od * 0.5; }
      const l = Math.hypot(fx, fz) || 1;
      a.steer = [a.pos[0] + fx / l * 4, a.pos[2] + fz / l * 4];
      if (Math.random() < dt * 0.35 && this.near(a, 18)) a.say(pick(TL('g.play.run')), 1.5);
    } else {
      if (!act.wander || act.wt < this.time) { const an = Math.random() * TAU, r = Math.random() * A.R * 0.8; act.wander = [A.cx + Math.cos(an) * r, A.cz + Math.sin(an) * r]; act.wt = this.time + 2 + Math.random() * 3; }
      if (Math.hypot(a.pos[0] - act.wander[0], a.pos[2] - act.wander[1]) > 0.8) a.steer = act.wander; else { a.steer = null; a.lookAt = it.pos; }
    }
  };
  P.hideSpot = function (vil, a) {
    const w = this.g.world, pz = vil.plan.plaza, homes = vil.homes;
    for (let k = 0; k < 8; k++) {
      const h = homes[Math.floor(Math.random() * homes.length)];
      if (!h || !h.box) continue;
      const b = h.box, cx = (b[0] + b[3]) / 2, cz = (b[2] + b[5]) / 2;
      let dx = cx - pz.x, dz = cz - pz.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      const half = Math.max(b[3] - b[0], b[5] - b[2]) / 2 + 1.6;
      const side = (Math.random() - 0.5) * 2;
      const x = Math.floor(cx + dx * half - dz * side), z = Math.floor(cz + dz * half + dx * side);
      if (!w.isLoaded(x, z)) continue;
      const y = w.topAt(x, z) + 1;
      if (Math.abs(y - pz.y) > 6 || !this.safeCell(x, y, z)) continue;
      return [x, y, z];
    }
    const an = Math.random() * TAU;
    return [Math.floor(pz.x + Math.cos(an) * 8), pz.y, Math.floor(pz.z + Math.sin(an) * 8)];
  };
  P.playHide = function (a, act, vil, G, dt) {
    const A = this.playArea(vil), base = [Math.floor(A.cx), A.y, Math.floor(A.cz)];
    if (!G.seeker || !G.kids.includes(G.seeker)) { G.seeker = pick(G.kids); G.phase = 'count'; G.t0 = this.time; G.found = new Set(); G.spots = new Map(); G.lastN = 0; }
    const S = G.seeker;
    if (a === S) {
      act.run = false;
      if (G.phase === 'count') {
        a.eyesClosed = true; a.lookAt = [A.cx, A.y + 1.2, A.cz];
        if (!this.goTo(a, base[0], base[1], base[2], 2.2)) return;
        const n = Math.floor((this.time - G.t0) / 1.1) + 1;
        if (n !== G.lastN && n <= 10) { G.lastN = n; if (this.near(a, 22)) a.say(n < 10 ? n + '…' : T('g.play.ready'), 1.3); }
        if (this.time - G.t0 > 11.5) G.phase = 'seek';
        return;
      }
      const hid = G.kids.filter(o => o !== a && !G.found.has(o));
      if (!hid.length) { if (this.near(a, 22)) a.say(T('g.play.foundAll'), 3); G.seeker = null; G.until = Math.min(G.until, this.time + 25); return; }
      const tgt = hid[0], sp = G.spots.get(tgt) || [Math.floor(tgt.pos[0]), Math.floor(tgt.pos[1]), Math.floor(tgt.pos[2])];
      if (this.goTo(a, sp[0], sp[1], sp[2], 1.9)) {
        G.found.add(tgt);
        if (this.near(a, 22)) { a.say(pick(TL('g.play.found')).replace('{n}', tgt.p.name), 2); tgt.say(pick(TL('g.play.caught')), 2); }
      } else if (Math.random() < dt * 0.12 && this.near(a, 16)) a.say(pick(TL('g.play.seek')), 1.8);
      return;
    }
    if (G.found.has(a)) {
      const ox = ((a.p.seed % 5) - 2) * 0.9, oz = (((a.p.seed >> 3) % 5) - 2) * 0.9;
      if (this.goTo(a, Math.floor(A.cx + ox), A.y, Math.floor(A.cz + oz), 1.4)) { a.lookAt = S.pos; if (a.onGround && Math.random() < dt * 0.8) a.vel[1] = 5; }
      return;
    }
    let spot = G.spots.get(a);
    if (!spot) { spot = this.hideSpot(vil, a); G.spots.set(a, spot); }
    if (this.goTo(a, spot[0], spot[1], spot[2], 0.9)) { a.pose = 'crouch'; a.lookAt = null; act.run = false; if (Math.random() < dt * 0.04 && this.near(a, 8)) a.say(T('g.play.shh'), 1.5); }
  };
  P.playHop = function (a, act, vil, G, dt) {
    const A = this.playArea(vil);
    if (!act.spot || act.spotGame !== G.t0) { const an = (a.p.seed % 628) / 100 + G.t0, r = 2.4 + (a.p.seed % 3); act.spot = [Math.floor(A.cx + Math.cos(an) * r), A.y, Math.floor(A.cz + Math.sin(an) * r)]; act.spotGame = G.t0; }
    if (this.goTo(a, act.spot[0], act.spot[1], act.spot[2], 1.1)) {
      a.lookAt = [A.cx, A.y + 1, A.cz];
      if (a.onGround && Math.random() < dt * 2.4) a.vel[1] = 5.6;
      if (Math.random() < dt * 0.08 && this.near(a, 14)) a.say(pick(TL('g.play.hop')), 1.8);
    }
  };

  // ---------------------------------------------------------------- family outings
  P.hikeSpots = function (vil) {
    if (vil.hikeSpots && vil.hikeSpots.length) return vil.hikeSpots;
    const w = this.g.world, pz = vil.plan.plaza, out = [];
    for (let r = 26; r <= 58; r += 8) for (let k = 0; k < 16; k++) {
      const an = k / 16 * TAU + r * 0.1;
      const x = Math.floor(pz.x + Math.cos(an) * r), z = Math.floor(pz.z + Math.sin(an) * r);
      if (!w.isLoaded(x, z)) continue;
      const y = w.topAt(x, z);
      const s = w.getBlock(x, y, z);
      if (!s || (R.T.flags[s] & (F.FLUID | F.LEAVES))) continue;
      if (!this.safeCell(x, y + 1, z)) continue;
      out.push({ x, y: y + 1, z, score: (y - pz.y) + Math.random() * 6 });
    }
    out.sort((p, q) => q.score - p.score);
    vil.hikeSpots = out.slice(0, 5);
    return vil.hikeSpots;
  };
  // a lake / sea near the village: water point, shore standing spot, a loop of waypoints over the water
  P.shoreOf = function (vil) {
    if (vil.shore !== undefined && (vil.shore || vil.shoreTries > 3)) return vil.shore;
    vil.shoreTries = (vil.shoreTries || 0) + 1;
    const w = this.g.world, pz = vil.plan.plaza, T = R.T;
    const isWater = (x, y, z) => { const s = w.getBlock(x, y, z); return !!(T.flags[s] & F.WATER); };
    const surf = (x, z) => { const y = w.topAt(x, z); return isWater(x, y, z) ? y : -1; };
    let best = null;
    for (let r = 12; r <= 64 && !best; r += 4) for (let k = 0; k < 24; k++) {
      const an = k / 24 * TAU;
      const x = Math.floor(pz.x + Math.cos(an) * r), z = Math.floor(pz.z + Math.sin(an) * r);
      if (!w.isLoaded(x, z)) continue;
      const y = surf(x, z); if (y < 0) continue;
      // enough open water around?
      let n = 0; for (let dz = -4; dz <= 4; dz += 2) for (let dx = -4; dx <= 4; dx += 2) if (w.isLoaded(x + dx, z + dz) && surf(x + dx, z + dz) === y) n++;
      if (n < 22) continue;
      // walk back toward the village to find the shore
      const ux = (pz.x - x) / r, uz = (pz.z - z) / r;
      let prev = null, shore = null;
      for (let t = 0; t < r; t++) {
        const sx = Math.floor(x + ux * t), sz = Math.floor(z + uz * t);
        if (surf(sx, sz) === y) { prev = [sx, y, sz]; continue; }
        const gy = w.topAt(sx, sz);
        if (Math.abs(gy + 1 - (y + 1)) <= 2 && this.safeCell(sx, gy + 1, sz)) shore = [sx, gy + 1, sz];
        break;
      }
      if (!shore || !prev) continue;
      // waypoint loop around the water point
      let rad = 10, loop = null;
      for (; rad >= 4 && !loop; rad -= 2) {
        const pts = [];
        for (let j = 0; j < 10; j++) { const b = j / 10 * TAU; const qx = x + Math.cos(b) * rad, qz = z + Math.sin(b) * rad; if (!w.isLoaded(qx, qz) || surf(Math.floor(qx), Math.floor(qz)) !== y) { pts.length = 0; break; } pts.push([qx + 0.5, qz + 0.5]); }
        if (pts.length) loop = pts;
      }
      if (!loop) continue;
      best = { water: [x, y, z], launch: prev, shore, loop, level: y + 1 };
    }
    vil.shore = best;
    return best;
  };
  P.maybeOuting = function (vil, dt, tod) {
    vil.outT = (vil.outT === undefined ? 20 + Math.random() * 30 : vil.outT) - dt;
    if (vil.outT > 0) return;
    vil.outT = 45 + Math.random() * 60;
    if (vil.outing) return;
    const day = (tod > 1200 && tod < 5200) || (tod > 7200 && tod < 10200);
    if (!day || this.g.env.rain > 0.3) return;
    if (Math.random() > 0.55) return;
    this.startOuting(vil);
  };
  P.startOuting = function (vil, force) {
    if (vil.outing) return null;
    const busy = (m) => { const a = vil.agents.find(o => o.p === m); return !a || !a.act || ['sleep', 'fight', 'hide', 'talk'].includes(a.act.type) || a.role === 'ranger' || a.role === 'builder'; };
    const fams = vil.fams.filter(f => f.members.length >= 2 && f.members.every(m => !busy(m)));
    if (!fams.length) return null;
    fams.sort((p, q) => q.members.filter(m => m.age === 'child').length - p.members.filter(m => m.age === 'child').length);
    const fam = Math.random() < 0.7 ? fams[0] : pick(fams);
    const agents = fam.members.map(m => vil.agents.find(o => o.p === m)).filter(Boolean);
    const leader = agents.find(o => !o.kid && !o.elder) || agents[0];
    const shore = this.shoreOf(vil);
    let type = force || (shore && Math.random() < 0.5 ? 'boat' : 'hike');
    if (type === 'boat' && !shore) type = 'hike';
    let dest = null;
    if (type === 'hike') { const spots = this.hikeSpots(vil); if (!spots.length) { if (!shore) return null; type = 'boat'; } else dest = pick(spots); }
    const O = vil.outing = { type, fam, agents, leader, dest, shore, phase: 'go', t0: this.time, boat: null };
    for (const a of agents) this.setAct(a, { type: 'outing', o: O });
    if (this.near(leader, 40)) leader.say(pick(TL(type === 'boat' ? 'g.out.boat' : 'g.out.hike')), 3.5);
    const kid = agents.find(o => o.kid);
    if (kid) setTimeout(() => { if (kid.act && kid.act.type === 'outing' && this.near(kid, 40)) kid.say(pick(TL('g.out.kidYay')), 2.2); }, 1500);
    return O;
  };
  P.endOuting = function (vil) {
    const O = vil.outing; if (!O) return;
    for (const a of O.agents) { if (a.act && a.act.o === O) { a.act = null; a.steer = null; a.inBoat = null; if (a.pose === 'sit' || a.pose === 'sitground') a.pose = 'stand'; } }
    if (O.boat) { O.boat.moored = this.time; vil.boats = vil.boats || []; if (!vil.boats.includes(O.boat)) vil.boats.push(O.boat); }
    vil.outing = null;
  };
  // follow the leader in a little column; returns true when close to the leader
  P.followLeader = function (a, O, k) {
    const L = O.leader;
    const vx = L.vel[0], vz = L.vel[2], sp = Math.hypot(vx, vz);
    const bx = sp > 0.3 ? -vx / sp : Math.sin(L.yaw), bz = sp > 0.3 ? -vz / sp : Math.cos(L.yaw);
    const side = (k & 1) ? 0.7 : -0.7;
    const tx = L.pos[0] + bx * (1.3 + k * 0.9) - bz * side, tz = L.pos[2] + bz * (1.3 + k * 0.9) + bx * side;
    const d = Math.hypot(a.pos[0] - L.pos[0], a.pos[2] - L.pos[2]);
    if (d > 9 || Math.abs(a.pos[1] - L.pos[1]) > 3) { a.steer = null; this.goTo(a, Math.floor(L.pos[0]), Math.floor(L.pos[1] + 0.05), Math.floor(L.pos[2]), 2.5); a.act.run = true; return false; }
    a.path = null; a.act.run = d > 3.5;
    if (Math.hypot(a.pos[0] - tx, a.pos[2] - tz) > 0.6) a.steer = [tx, tz]; else { a.steer = null; a.lookAt = null; }
    return d < 3.2;
  };
  P.runOuting = function (a, act, dt, tod) {
    const O = act.o, vil = a.vil;
    if (!O || vil.outing !== O) { a.act = null; return; }
    if (tod > 12200 || tod < 900 || this.time - O.t0 > 420) { this.endOuting(vil); return; }
    const k = O.agents.indexOf(a);
    if (O.type === 'hike') {
      const D = O.dest;
      if (O.phase === 'go') {
        if (a === O.leader) { act.run = false; if (this.goTo(a, D.x, D.y, D.z, 2.2)) { O.phase = 'picnic'; O.t1 = this.time; if (this.near(a, 40)) a.say(pick(TL('g.out.arrive')), 3.5); } }
        else this.followLeader(a, O, k);
        if (Math.random() < dt * 0.03 && this.near(a, 24)) a.say(pick(TL(a.kid ? 'g.out.kidWalk' : 'g.out.adultWalk')), 2.2);
        return;
      }
      if (O.phase === 'picnic') {
        // sit in a small circle around the leader, look around, chat about the view
        const an = (k / O.agents.length) * TAU, r = 1.3;
        const sx = Math.floor(D.x + Math.cos(an) * r), sz = Math.floor(D.z + Math.sin(an) * r);
        if (a.pose === 'sitground' || this.goTo(a, sx, D.y, sz, 0.9)) {
          if (a.pose !== 'sitground') { a.pose = 'sitground'; a.path = null; a.vel = [0, 0, 0]; a.yaw = Math.atan2(-(D.x + 0.5 - a.pos[0]), -(D.z + 0.5 - a.pos[2])) + Math.PI; }
          if (Math.random() < dt * 0.05 && this.near(a, 26)) a.say(pick(TL(a.kid ? 'g.out.kidPicnic' : 'g.out.adultPicnic')), 2.8);
        }
        if (this.time - O.t1 > 40 + (O.fam.id % 4) * 5) { O.phase = 'back'; if (this.near(O.leader, 40)) O.leader.say(T('g.out.home'), 2.5); }
        return;
      }
      if (O.phase === 'back') {
        if (a.pose === 'sitground') a.pose = 'stand';
        const h = vil.homes[a.p.home], o = h && (h.outside || h.door);
        if (a === O.leader) { if (!o || this.goTo(a, o[0], o[1], o[2], 1.8)) this.endOuting(vil); }
        else this.followLeader(a, O, k);
        return;
      }
      return;
    }
    // ---- boat trip
    const S = O.shore;
    if (!S) { this.endOuting(vil); return; }
    if (O.phase === 'go') {
      const sh = S.shore;
      if (a === O.leader) { act.run = false; if (this.goTo(a, sh[0], sh[1], sh[2], 1.8)) { O.arrived = (O.arrived || 0) + 0; } }
      else this.followLeader(a, O, k);
      // gathered at the shore → launch (stragglers hop in a little later)
      const atShore = (o) => Math.hypot(o.pos[0] - (sh[0] + 0.5), o.pos[2] - (sh[2] + 0.5)) < 5;
      if (atShore(O.leader)) O.waitT = (O.waitT || 0) + dt;
      const n = O.agents.filter(atShore).length;
      if (atShore(O.leader) && (n === O.agents.length || (n * 2 >= O.agents.length && O.waitT > 12) || O.waitT > 40)) this.launchBoat(vil, O);
      return;
    }
    if (O.phase === 'sail' || O.phase === 'dock') { a.path = null; a.steer = null; return; }
  };
  // ---------------------------------------------------------------- boats
  P.launchBoat = function (vil, O) {
    const S = O.shore, L = S.launch;
    const dx = S.water[0] - L[0], dz = S.water[2] - L[2];
    const b = { pos: [L[0] + 0.5, S.level - 0.18, L[2] + 0.5], yaw: Math.atan2(-dx, -dz), vel: 0, wp: 0, lap: 0, bob: Math.random() * 10, O, style: vil.plan.style, home: [L[0] + 0.5, S.level - 0.18, L[2] + 0.5] };
    O.boat = b; O.phase = 'sail'; O.route = [[S.water[0] + 0.5, S.water[2] + 0.5]].concat(S.loop, S.loop.slice(0, 1), [[S.water[0] + 0.5, S.water[2] + 0.5], [L[0] + 0.5, L[2] + 0.5]]);
    O.agents.forEach((a, i) => { a.inBoat = b; a.seat = i; a.pose = 'sit'; a.path = null; a.steer = null; a.vel = [0, 0, 0]; });
    vil.boats = (vil.boats || []).filter(x => x !== b);
    if (this.near(O.leader, 40)) { O.leader.say(pick(TL('g.out.aboard')), 2.5); if (this.g.audio) this.g.audio.play('door'); }
  };
  const SEATS = [[0.32, -0.55], [-0.32, -0.55], [0.3, 0.3], [-0.3, 0.3], [0, 1.05], [0, -1.2]];
  P.updateBoats = function (dt) {
    for (const vil of this.known.values()) {
      if (!vil.active) continue;
      const O = vil.outing;
      if (O && O.boat && O.phase === 'sail') {
        const b = O.boat, tgt = O.route[b.wp];
        if (!tgt) { O.phase = 'dock'; }
        else {
          const dx = tgt[0] - b.pos[0], dz = tgt[1] - b.pos[2], d = Math.hypot(dx, dz);
          const want = Math.atan2(-dx, -dz);
          let dy = want - b.yaw; while (dy > Math.PI) dy -= TAU; while (dy < -Math.PI) dy += TAU;
          b.yaw += dy * Math.min(1, dt * 1.2);
          const vmax = b.wp === O.route.length - 1 ? 1.2 : 2.6;
          b.vel += ((Math.abs(dy) > 1 ? 0.8 : vmax) - b.vel) * Math.min(1, dt * 0.8);
          b.pos[0] += -Math.sin(b.yaw) * b.vel * dt; b.pos[2] += -Math.cos(b.yaw) * b.vel * dt;
          if (d < 1.4) b.wp++;
          if (Math.random() < dt * 0.05) { const who = pick(O.agents); if (this.near(who, 40)) who.say(pick(TL(who.kid ? 'g.out.kidBoat' : 'g.out.adultBoat')), 2.4); }
          if (Math.random() < dt * 3 && b.vel > 1) this.g.particles.spawn(b.pos[0] + Math.sin(b.yaw) * 1.4 + (Math.random() - 0.5) * 0.8, b.pos[1] + 0.05, b.pos[2] + Math.cos(b.yaw) * 1.4 + (Math.random() - 0.5) * 0.8, 0, 0.3, 0, { life: 1.1, size: 0.12, grav: 0.2, col: [0.92, 0.96, 1], drag: 1, grow: 0.5, collide: false });
        }
      }
      if (O && O.boat && O.phase === 'dock') {
        // step ashore
        const sh = O.shore.shore;
        O.agents.forEach((a, i) => { a.inBoat = null; a.pose = 'stand'; a.pos = [sh[0] + 0.5 + ((i % 3) - 1) * 0.7, sh[1] + 0.05, sh[2] + 0.5 + (Math.floor(i / 3) - 0.5) * 0.7]; a.vel = [0, 0, 0]; });
        if (this.near(O.leader, 40)) O.leader.say(pick(TL('g.out.back')), 2.5);
        this.endOuting(vil);
      }
      // seat passengers
      if (O && O.boat && O.phase === 'sail') {
        const b = O.boat, c = Math.cos(b.yaw), s = Math.sin(b.yaw);
        for (const a of O.agents) {
          const sp = SEATS[a.seat % SEATS.length];
          a.pos = [b.pos[0] + sp[0] * c + sp[1] * s, b.pos[1] + 0.22 + Math.sin(this.time * 1.7 + b.bob) * 0.04, b.pos[2] - sp[0] * s + sp[1] * c];
          a.yaw = b.yaw; a.vel = [0, 0, 0];
        }
      }
      // moored boats drift gently, then are pulled ashore
      if (vil.boats) vil.boats = vil.boats.filter(b => this.time - (b.moored || 0) < 240);
    }
  };
  P.drawBoats = function (r, E, cam) {
    const ent = this.g.entities; if (!ent) return;
    const gl = r.gl;
    let p = null;
    for (const vil of this.known.values()) {
      if (!vil.active) continue;
      const list = (vil.boats || []).slice(); if (vil.outing && vil.outing.boat) list.push(vil.outing.boat);
      for (const b of list) {
        const dx = b.pos[0] - cam.x, dz = b.pos[2] - cam.z;
        if (dx * dx + dz * dz > 140 * 140) continue;
        const model = VR.getVoxModel(gl, 'sailboat_' + (b.style || 'meadow'));
        if (!model) continue;
        if (!p) p = ent.beginVox(r, E);
        const t = this.time + b.bob;
        const moving = b.O && b.O.boat === b && b.O.phase === 'sail';
        const light = ent.lightAt(b.pos[0], b.pos[1] + 1.5, b.pos[2]);
        const pose = { sail: [0, (moving ? 0.25 : 0.05) * Math.sin(t * 0.7), 0], flag: [0, Math.sin(t * 5) * 0.4, 0] };
        ent.drawModel(r, p, model, [b.pos[0], b.pos[1] + Math.sin(t * 1.7) * 0.04, b.pos[2]], cam, b.yaw, pose, light, { roll: Math.sin(t * 1.3) * 0.04, pitch: Math.sin(t * 1.1) * 0.025 });
      }
    }
  };
  // little sailboat (1/16 voxels): painted hull, deck planks, benches, mast, striped sail, pennant
  const BOAT_COL = { meadow: [0x2F6FC0, 0xE84A4A], taiga: [0x3A6A4A, 0xF0C040], snowy: [0xC03A3A, 0x2A5AA0], desert: [0xE0A040, 0x2AA0A0], savanna: [0xC06030, 0xF0D070], prism: [0x6A4AE0, 0x3AE0F0] };
  for (const style of Object.keys(BOAT_COL)) {
    VR.VOXMODELS['sailboat_' + style] = () => {
      const G = VR.VoxGrid, [hullC, stripe] = BOAT_COL[style];
      const hull = new G(24, 12, 54, 12, 0, 27);
      const put = (g, x, y, z, c, e) => g.set(x + g.ox, y + g.oy, z + g.oz, c, e);
      for (let z = -26; z <= 26; z++) {
        const t = z / 26;
        const halfW = Math.max(1, Math.round(10 * Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, -t), 2) * 0.95)) * (t > 0.7 ? 1 - (t - 0.7) * 1.2 : 1)));
        const bottom = Math.round(Math.abs(t) > 0.6 ? (Math.abs(t) - 0.6) * 10 : 0);
        for (let x = -halfW; x <= halfW; x++) for (let y = bottom; y <= 9; y++) {
          const edge = Math.abs(x) >= halfW - 1 || y <= bottom || Math.abs(z) >= 25;
          if (!edge && y > bottom) { if (y === 3) put(hull, x, y, z, ((z + 40) % 4 === 0) ? 0x7A5234 : 0x9A6A44); continue; }
          let c = y >= 8 ? 0xF4F0E8 : y === 6 ? stripe : hullC;
          if (y <= 1) c = 0x5A3A2A;
          put(hull, x, y, z, VR.M.hash3(x, y, z, 5) & 1 ? c : ((c & 0xfefefe) >> 1) + ((c & 0xfefefe) >> 2) + ((c & 0xfcfcfc) >> 3));
        }
      }
      for (const bz of [-10, 4, 16]) for (let x = -8; x <= 8; x++) { put(hull, x, 5, bz, 0xB07A4A); put(hull, x, 5, bz + 1, 0xA06A3A); }
      // mast + boom
      for (let y = 4; y <= 11; y++) put(hull, 0, y, -6, 0x8A5A3A);
      const mast = new G(3, 40, 3, 1, 0, 1);
      for (let y = 0; y < 40; y++) mast.set(1, y, 1, 0x8A5A3A);
      const sail = new G(3, 34, 26, 1, 0, 1);
      for (let y = 0; y < 34; y++) { const len = Math.round((34 - y) * 0.7); for (let z = 1; z <= len; z++) sail.set(1, y, z + 0, (y % 9 < 2) ? stripe : ((z + y) % 7 === 0 ? 0xE8E4DA : 0xF6F4EE)); }
      for (let z = 0; z < 25; z++) sail.set(1, 0, z, 0x8A5A3A);
      const flag = new G(2, 3, 7, 0, 0, 0);
      for (let z = 0; z < 7; z++) for (let y = 0; y < 3; y++) if (z < 6 - y) flag.set(0, y, z, stripe);
      return {
        unit: 16, h: 2.5, w: 0.8, gait: 'none',
        parts: { hull: { grid: hull, pivot: [0, 0, 0] }, mast: { grid: mast, pivot: [0, 0, 0] }, sail: { grid: sail, pivot: [0, 0, 0] }, flag: { grid: flag, pivot: [0, 0, 0] } },
        layout: { hull: [0, -3, 0], mast: [0, 8, -6], sail: [0, 12, -6], flag: [0, 48, -6] },
      };
    };
  }

  // ---------------------------------------------------------------- personal space
  // villagers never stand inside each other (or inside the player); hugging pairs may come close
  P.separate = function (dt) {
    const list = this.agents, n = list.length; if (n < 2 && !this.g.player) return;
    const w = this.g.world, get = (x, y, z) => w.getBlock(x, y, z), nb = w.nbFn();
    const pl = this.g.player;
    // a 2-block grid: only neighbours in the same or adjacent cells can touch (no more n² over the whole city)
    const grid = this._sepGrid || (this._sepGrid = new Map());
    grid.clear();
    const gk = (x, z) => ((x >> 1) + 32768) * 65536 + ((z >> 1) + 32768);
    for (let j = 0; j < n; j++) { const b = list[j]; const k = gk(Math.floor(b.pos[0]), Math.floor(b.pos[2])); let cell = grid.get(k); if (!cell) { cell = []; grid.set(k, cell); } cell.push(b); }
    const cand = [];
    const ppx = pl ? pl.pos[0] : 0, ppz = pl ? pl.pos[2] : 0;
    for (let i = 0; i < n; i++) {
      const a = list[i];
      if (a.inBoat || a.pose === 'sleep' || a.pose === 'sit') continue;
      if (pl && (a.pos[0] - ppx) ** 2 + (a.pos[2] - ppz) ** 2 > 48 * 48) continue; // crowding far out of sight costs nothing
      let px = 0, pz = 0;
      cand.length = 0;
      const ax = Math.floor(a.pos[0]) >> 1, az = Math.floor(a.pos[2]) >> 1;
      for (let gx = ax - 1; gx <= ax + 1; gx++) for (let gz = az - 1; gz <= az + 1; gz++) { const cell = grid.get((gx + 32768) * 65536 + (gz + 32768)); if (cell) for (const b of cell) if (b !== a) cand.push(b); }
      for (let j = 0; j < cand.length; j++) {
        const b = cand[j];
        const dx = a.pos[0] - b.pos[0], dz = a.pos[2] - b.pos[2];
        if (Math.abs(dx) > 1 || Math.abs(dz) > 1 || Math.abs(a.pos[1] - b.pos[1]) > 1.5) continue;
        const hugging = a.act && b.act && a.act.type === 'talk' && a.act.with === b && a.act.hug;
        const minD = hugging ? 0.46 : (a.w + b.w) * 1.15;
        const d = Math.hypot(dx, dz);
        if (d >= minD) continue;
        const push = (minD - d) * (b.pose === 'sit' || b.pose === 'sleep' || b.inBoat ? 1 : 0.5);
        if (d < 1e-4) { const an = (a.p.seed % 628) / 100; px += Math.cos(an) * push; pz += Math.sin(an) * push; }
        else { px += dx / d * push; pz += dz / d * push; }
      }
      if (pl && !pl.dead) {
        const dx = a.pos[0] - pl.pos[0], dz = a.pos[2] - pl.pos[2], d = Math.hypot(dx, dz), minD = a.w + 0.34;
        if (d < minD && Math.abs(a.pos[1] - pl.pos[1]) < 1.6) { if (d < 1e-4) px += minD; else { px += dx / d * (minD - d); pz += dz / d * (minD - d); } }
      }
      if (px || pz) {
        const l = Math.hypot(px, pz), mx = Math.min(l, dt * 3.5) / l;
        VR.PHYS.move(get, a.pos, a.w, a.h, px * mx, 0, pz * mx, 0.6, nb, true); VR.PHYS.snapSmooth(get, a.pos);
      }
    }
  };

  // ---------------------------------------------------------------- the Weißstadt's afternoon (the hall city, style 'hall')
  // The town's grown-ups without a counter to keep (the trades keep their shops) spend part of the afternoon out: one in
  // three sits at the café's tables round the plaza ('terrace': the café of the hall city is outdoors, so its guests count
  // toward the street's budget of src/shared/folkcrowd.js, unlike an indoor café's), one in two goes shopping along the
  // street (a stroll, bag or basket in hand: villagers.js V.WEISS); at lunch the café's guests sit on the terrace too.
  const SHOPKEEPERS = { baker: 1, scholar: 1, cashier: 1, clerk: 1, barista: 1, mayor: 1, healer: 1, ranger: 1, teacher: 1 };
  P.TOWN_AFTERNOON = [6900, 10600];
  P.townPlan = function (a, tod, want) {
    if (!a.vil || !a.vil.plan || a.vil.plan.style !== 'hall') return want;
    if (want === 'cafe') return 'terrace';
    if (a.kid || want !== 'work' || SHOPKEEPERS[a.role] || tod < P.TOWN_AFTERNOON[0] || tod >= P.TOWN_AFTERNOON[1]) return want;
    const k = Folk.hash(a.p.seed, 23, 7) % 6;
    return k < 2 ? 'terrace' : k < 5 ? 'stroll' : want;
  };
  const prevSchedule = P.schedule;
  P.schedule = function (a, tod) { return this.townPlan(a, tod, prevSchedule.call(this, a, tod)); };
  // the terrace: a seat at one of the café's tables (the plaza's chairs), sitting a while, a word now and then
  const prevRunAct = P.runAct;
  P.runAct = function (a, dt, tod) {
    const act = a.act;
    if (!act || act.type !== 'terrace') return prevRunAct.call(this, a, dt, tod);
    act.t += dt;
    const vil = a.vil, cafe = (vil.workOf.barista || [])[0], seats = cafe && cafe.seats || [];
    if (!seats.length) { act.type = 'plaza'; return; }
    if (!act.spot) {
      // a free chair: the person's own pick first, the next ones round the tables when it is taken
      const k0 = Folk.hash(a.p.seed, 41, (this.time / 60) | 0) % seats.length;
      for (let i = 0; i < seats.length && !act.spot; i++) { const s = seats[(k0 + i) % seats.length]; if (!vil.agents.some(o => o !== a && o.act && o.act.spot && o.act.spot[0] === s[0] && o.act.spot[2] === s[2])) act.spot = s.slice(); }
      if (!act.spot) { act.type = 'plaza'; return; }
    }
    if (a.pose === 'sit') { if (Math.random() < dt * 0.04 && this.near(a, 12)) a.say(Folk.say('cafe', Folk.hash(a.p.seed, 18, (this.time / 7) | 0), { v: vil.name }), 3); if (act.t > 90) act.done = true; return; }
    if (this.goTo(a, act.spot[0], act.spot[1], act.spot[2], 0.8)) this.sit(a, act.spot);
  };
})(VR);

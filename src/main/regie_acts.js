// ============================================================================
// Die Regie's own acts — the adventurer's first encounter (a-regie; plan docs/superpowers/plans/2026-10-29-a-regie.md
// §2.2, review docs/reviews/v0.51.md R52-06). In an Abenteuer world the first five minutes meet the release:
//   · Der Ruf (≥ RULES.call s after the world starts): Funke points out the nearest disturbed outpost — one line, his way
//     ribbon toward it, and its Leuchtfeuer's red-violet beam made tall on the horizon (liberate.js L.callSite: one
//     additive draw while the call holds; not on Very Low)
//   · Der Verirrte (≥ RULES.stray s): one Wächter that wandered off from its outpost appears ahead in the view, where
//     foes.js's own rules allow a spawn (48 blocks from villages and the home, Bauruhe, Begegnungen, Kindersicher). It
//     walks toward the player, notices them (the event log's encounter), keeps its distance and never attacks (f.lost,
//     foes.js); [V] calms it as any stray; after RULES.life s, out of the view or far, it goes home (leave)
// Both are offers to the Regie (regie.js) marked `first`: taken at the first allowed moment (8 s spacing, one major a
// minute, never in a story scene). Pure part RA.offers(st, t) (test/regie.js §7). Cost 🟢: a 4-Hz look while an
// Abenteuer world is open; nothing drawn of its own.
// ============================================================================
(function (VR) {
  'use strict';
  const RA = VR.RegieActs = VR.RegieActs || {};
  RA.RULES = { call: 35, stray: 70, dmin: 24, dmax: 34, life: 45, callR: 1400, home: 10 };
  // ---- pure: the first acts on offer now. st: {adv, enc ('off'|…), kids, guest, t0, called, strayed, encounters, site}
  RA.offers = function (st, t) {
    const out = [], R = RA.RULES;
    if (!st || !st.adv || st.guest) return out;
    const since = t - (st.t0 || 0);
    if (!st.called && st.site && since >= R.call) out.push({ act: 'call', weight: 3, kind: 'discovery', first: true });
    if (!st.strayed && !st.kids && st.enc !== 'off' && !(st.encounters > 0) && since >= R.stray) out.push({ act: 'stray', weight: 4, kind: 'encounter', first: true });
    if (st.scan && R.scan && since >= R.scan && !st.foeNear && t - (st.scanT === undefined ? -1e9 : st.scanT) >= R.scanEvery) out.push({ act: 'scan', weight: 2, kind: 'discovery' });   // a-session: Funke's scan on the way
    return out;
  };
  // ---- pure: the spots ahead to try (the view's middle first, then a little to each side), forward = (-sin yaw, -cos yaw)
  RA.ahead = function (x, z, yaw, k) {
    const R = RA.RULES, side = [0, 0.22, -0.22, 0.4, -0.4][k % 5], d = R.dmin + (R.dmax - R.dmin) * ((Math.floor(k / 5) % 3) / 2), a = yaw + side;
    return [x - Math.sin(a) * d, z - Math.cos(a) * d];
  };
  // a-session (plan docs/superpowers/plans/2026-10-31-a-session.md §2.4): the Regie's fill on the way — Funke scans the
  // ground round the player (its ring, the marks of chests and ores, one line): a discovery when it finds something.
  // Offered after RULES.scan s, not with a foe near, at most once in RULES.scanEvery s; taken in a gap like any offer
  RA.RULES.scan = 50; RA.RULES.scanEvery = 120;
  function scan(g, S) {
    const fk = g.funke; if (!fk || !fk.on || !fk.on() || fk.scanJob || !fk.scan) return why('noscan');
    if (!fk.scan(false)) return why('noscan');
    fk.regieScan = true; S.scanT = g.time || 0; RA.stats.scans = (RA.stats.scans | 0) + 1;
    return true;
  }
  RA.st = null;
  RA.stats = { calls: 0, strays: 0, tries: 0, why: {} };
  const game = () => VR.game || null;
  function state(g) {
    if (RA.st && RA.st.world === g.world) return RA.st;
    RA.st = { world: g.world, t0: +(g.time || 0), called: 0, strayed: 0, m: null, mt: 0 };
    return RA.st;
  }
  function nearestSite(g) {
    const L = VR.Liberate; if (!L || !L.sites) return null;
    const P = g.player.pos; let best = null, bd = RA.RULES.callR;
    for (const s of L.sites().values()) { if (!s || s.st === 'frei') continue; const d = Math.hypot(s.x - P[0], s.z - P[2]); if (d < bd) { bd = d; best = s; } }
    return best;
  }
  const why = (k) => { RA.stats.why[k] = (RA.stats.why[k] | 0) + 1; return false; };
  function call(g, S) {
    const s = nearestSite(g), L = VR.Liberate; if (!s) { S.retry = (g.time || 0) + 4; return why('nosite'); }
    const P = g.player.pos, d = Math.hypot(s.x - P[0], s.z - P[2]), fk = g.funke, Fk = VR.Funke;
    L.callSite = s;
    if (fk && fk.on && fk.on()) {
      fk.say('regie.call', { d: Fk && Fk.dist ? Fk.dist(d) : Math.round(d) + ' m' }, true);
      if (fk.startWay) fk.startWay({ pos: [s.x + 0.5, s.y, s.z + 0.5], name: L.nameOf ? L.nameOf(s) : '', kind: 'outpost' });
    }
    if (VR.EventLog && VR.EventLog.emit) VR.EventLog.emit('discovery', 'beacon_call', 3, null, 'regie');
    S.called = g.time || 0; RA.stats.calls++;
    return true;
  }
  function stray(g, S) {
    const Fo = VR.Foes, En = g.entities, p = g.player; if (!Fo || !En || !Fo.spot || !Fo.ctx) return why('nofoes');
    RA.stats.tries++; S.retry = (g.time || 0) + 4;   // (a failed try: again in 4 s — the gap's fill is not held up meanwhile)
    const ctx = Fo.ctx(g), L = VR.EventLog;
    for (let k = 0; k < 15; k++) {
      const q = RA.ahead(p.pos[0], p.pos[2], p.yaw, k), pt = Fo.spot(g, q[0], q[1], 2.5, Math.random);
      if (!pt) { why('spot'); continue; }
      if (Math.abs(pt[1] - p.pos[1]) > 8) { why('height'); continue; }
      const zone = { id: 'lost:' + Math.round(pt[0]) + '_' + Math.round(pt[2]), kind: 'outpost', x: pt[0], z: pt[2], r: 40 };
      const ok = Fo.spawnOk(pt, Object.assign({}, ctx, { zones: [zone] }), 'sentry'); if (!ok.ok) { why(ok.why); continue; }
      if (L && L.inView) { const v = L.inView([pt[0], pt[1] + 1, pt[2]], 1.2, g); if (!v.inView) { why('view'); continue; } }
      const m = En.summon('foe_sentry', pt[0], pt[1], pt[2]); if (!m) return why('summon');
      m.foe = Fo.make('sentry', m.id, pt); m.foe.lost = true; m.foe.zone = zone;
      // (it walks toward the player: its patrol round a home between the two)
      const hx = p.pos[0] - pt[0], hz = p.pos[2] - pt[2], hd = Math.hypot(hx, hz) || 1, u = Math.max(0, hd - RA.RULES.home) / hd;
      m.foe.home = [pt[0] + hx * u, pt[1], pt[2] + hz * u];
      m.yaw = Math.atan2(-hx, -hz) + Math.PI;
      if (Fo.cost) Fo.cost.spawned++;
      S.strayed = g.time || 0; S.m = m; RA.stats.strays++;
      const fk = g.funke; if (fk && fk.on && fk.on()) fk.say('regie.stray', null, true);
      return true;
    }
    return false;
  }
  // the lost one's time: out of the view or far after RULES.life s, it goes home
  function tend(g, S) {
    const m = S.m, Fo = VR.Foes; if (!m || !Fo) return;
    const f = m.foe; if (!f || f.gone) { S.m = null; return; }
    if (f.st === 'calm' || f.helper || f.st === 'leave') { S.m = null; return; }
    if ((g.time || 0) - S.strayed < RA.RULES.life) return;
    const P = g.player.pos, d = Math.hypot(m.pos[0] - P[0], m.pos[2] - P[2]), L = VR.EventLog;
    const seen = L && L.inView ? L.inView([m.pos[0], m.pos[1] + 1, m.pos[2]], 1.2, g).inView : true;
    if (!seen || d > 30) { Fo.leaveAll([m], Fo.W); S.m = null; }
  }
  // the first sight of a disturbed outpost (its beacon in the view within RULES.sight m): Funke names it, the event
  // log's discovery — once a site, never on top of another moment (Regie.busy)
  RA.RULES.sight = 110; RA.RULES.at = 35;
  function sight(g, S) {
    const s = nearestSite(g), b = s && s.known && s.beacon; if (!b || (S.seen && S.seen[s.id])) return;
    const P = g.player.pos, d = Math.hypot(b[0] - P[0], b[2] - P[2]); if (d > RA.RULES.sight) return;
    const L = VR.EventLog, q = [b[0] + 0.5, b[1] + 2, b[2] + 0.5]; if (!L || !L.inView) return;
    const v = L.inView(q, 12, g); if (!v.inView || (v.frac > 0 && v.frac < 0.005)) return;
    // (f-polish9: already at it — within RULES.at m, after its guards — it is no discovery: seen, nothing told; the
    // adventurer's session had its sight 7 s before the last guard calmed, a pair)
    if (d < RA.RULES.at) { (S.seen || (S.seen = {}))[s.id] = g.time || 0; RA.stats.sightAt = (RA.stats.sightAt | 0) + 1; return; }
    if (VR.Regie && VR.Regie.busy && VR.Regie.busy(g)) return;
    if (VR.Funke && VR.Funke.foeOf && VR.Funke.foeOf(g)) return;   // (a-session: not in the middle of its fight — the outpost is no news then)
    (S.seen || (S.seen = {}))[s.id] = g.time || 0;
    const fk = g.funke, Lb = VR.Liberate; if (fk && fk.on && fk.on()) fk.say('regie.sight', { name: Lb && Lb.nameOf ? Lb.nameOf(s) : '' }, true);
    L.emit('discovery', 'outpost', 3, q, 'regie', 12);
    if (VR.Regie && VR.Regie.note) VR.Regie.note(g, 3, 'discovery', 'sight');
    RA.stats.sights = (RA.stats.sights | 0) + 1;
  }
  RA.source = function (g) {
    const Fo = VR.Foes; if (!Fo || !Fo.advOn || !Fo.advOn(g) || (g.dim || 'overworld') !== 'overworld') return null;
    const S = state(g); tend(g, S); sight(g, S);
    if ((g.time || 0) < (S.retry || 0)) return null;
    const st = { adv: true, guest: !!(g.meta && g.meta.guest), enc: Fo.enc ? Fo.enc() : 'off', kids: !!(g.settings && g.settings.kids), t0: S.t0, called: S.called, strayed: S.strayed, encounters: Fo.stats ? Fo.stats.encounters : 0, site: S.called ? null : nearestSite(g), scan: true, foeNear: !!(VR.Funke && VR.Funke.foeOf && VR.Funke.foeOf(g)), scanT: S.scanT };   // (a-session: foeNear, scanT)
    const list = RA.offers(st, g.time || 0); if (!list.length) return null;
    return list.map(o => Object.assign({ source: 'regie', place: '', eta: 0, start: () => (o.act === 'call' ? call(g, S) : o.act === 'scan' ? scan(g, S) : stray(g, S)) }, o));
  };
  if (VR.Regie && VR.Regie.addSource) VR.Regie.addSource(RA.source);
  void game;
  if (typeof module !== 'undefined' && module.exports) module.exports = RA;
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

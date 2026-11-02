// ============================================================================
// Die Regie — the event budget that keeps „immer etwas los" (a-story; plan docs/superpowers/plans/2026-10-29-a-story.md
// §2, spec docs/superpowers/specs/2026-10-22-abenteuer-design.md §10, erlebnis §7). One scheduler over every source of
// things worth seeing; it fills the gaps, it does not replace the sources:
//   · what was seen — the event log's records in view (EventLog.events) — moves its clocks: the last weight-≥2 event,
//     the last start (spacing), the last major (weight ≥ 4), the last story beat, the kinds of the last two;
//   · a self-scheduling source asks first — Regie.allow(g, w, kind): the life director's rotation (lifedirector.js
//     paced() and play(), one marked line each): never within 8 s of the last start, never during a story scene, during
//     Bauruhe only weight ≤ 2;
//   · the sources' offers — Regie.addSource(fn(g, ctx) → [{source, act, weight, kind, place, eta, start()}]): the life
//     director (its rotation's next act, pulled forward) and the story (a beat to announce, src/main/story.js). When the
//     time since the last weight-≥2 event passes its jittered target (18–42 s; never past 75 s, builder 90 s) the best
//     offer starts: weight within the budget (one major a minute, Bauruhe ≤ 2), not the kind of the last two, a hash of
//     (seed, slot, place) for ties — so host and guests choose alike. A story beat is taken at the first allowed moment
//     (≥ 5 min after the last one), not only in a gap.
// Pure core: Regie.Sched (test/regie.js — synthetic offer streams). Game part: g.regie, ticked by story.js's frame hook;
// switch ⚙ Spiel „Geschichte" (storyOffer) for the story's offers, lifeDir for the director's. Cost 🟢: reading the new
// records and the offers 4 times a second, nothing drawn.
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.Regie = VR.Regie || {};
  R.RULES = { min: 18, max: 42, gap: 75, gapBuilder: 90, space: 8, major: 60, beat: 300, bauruhe: 2, seenFrac: 0.005 };
  // a-regie (plan docs/superpowers/plans/2026-10-29-a-regie.md §2.1): the repeat cooldown per act (s); the adventurer's
  // rhythm (an Abenteuer world: a shorter target, a lower cap) — its first offers (`first`) are taken at the first allowed
  // moment like a story beat
  R.RULES.pend = 10;   // (f-polish9: s a start noted and not yet seen holds the others — Sched.pending)
  R.RULES.cool = 90; R.RULES.vary = 180; R.RULES.vistaHold = 20; R.ADV = { min: 12, max: 30, gap: 55 };
  // a hash in [0, 1) of three integers (the life director's own, LifeKit.h, when it is there)
  const h = (a, b, c) => { let x = (a | 0) ^ Math.imul(b | 0, 0x9E3779B1) ^ Math.imul((c | 0) + 0x7F4A7C15, 0x85EBCA77); x ^= x >>> 16; x = Math.imul(x, 0x7FEB352D); x ^= x >>> 15; x = Math.imul(x, 0x846CA68B); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
  const sh = (s) => { let x = 0x811c9dc5; s = String(s || ''); for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 0x01000193); } return x | 0; };
  R.h = h;

  // ================================================================ the scheduler (pure)
  class Sched {
    constructor(seed, o) {
      this.seed = seed | 0; this.o = Object.assign({}, R.RULES, o || {});
      this.last2 = 0; this.lastStart = -Infinity; this.lastMajor = -Infinity; this.lastBeat = -Infinity;
      this.kinds = []; this.slot = 0; this.target = this.jit(0); this.scene = false; this.bauruhe = false;
      this.log = [];   // (what it started or allowed: [t, w, kind, source] — the last 64)
      this.acts = Object.create(null);   // a-regie: act → its last start (the repeat cooldown)
      this.kindT = Object.create(null);  // a-regie: kind → when it was last seen (the variety)
      this.pend = -Infinity;             // f-polish9: a start noted, not seen yet
    }
    jit(k) { const o = this.o, A = o.adv && !o.builder ? R.ADV : null, lo = A ? A.min : o.min, hi = A ? A.max : o.max; return Math.min(this.gapCap() - 5, lo + (hi - lo) * h(this.seed, k, 0x5e91)); }
    // the budget now: the heaviest weight that may start
    budget(t) { if (this.bauruhe) return this.o.bauruhe; return t - this.lastMajor >= this.o.major ? 5 : 3; }
    // an event of weight w seen at t (in view): the clocks move
    // (small: seen too small to end a gap — it still counts for the spacing and the kinds)
    seen(t, w, kind, small) {
      if (!(w >= 2)) return;
      if (!small && t > this.last2) { this.last2 = t; this.slot++; this.target = this.jit(this.slot); }
      if (!small && t >= this.pend) this.pend = -Infinity;   // (f-polish9: the start noted is seen — or something else is)
      if (t > this.lastStart) this.lastStart = t;
      if (w >= 4 && t > this.lastMajor) this.lastMajor = t;
      if (kind === 'story' && t > this.lastBeat) this.lastBeat = t;
      if (kind && !(this.kindT[kind] > t)) this.kindT[kind] = t;
      this.kinds.push(kind); if (this.kinds.length > 2) this.kinds.shift();
    }
    // may a source start an event of weight w and kind now?
    allow(t, w, kind, act) {
      if (this.scene) return false;
      if (act && this.cooling(t, act)) return false;   // a-regie: the same act within its cooldown
      if (this.pending(t)) return false;   // f-polish9: a start noted and not seen yet — it is about to be (the one clock)
      if (t - this.lastStart < this.o.space) return false;
      if ((w | 0) > this.budget(t)) return false;
      if (kind === 'story' && t - this.lastBeat < this.o.beat) return false;
      return true;
    }
    due(t) { return t - this.last2 >= this.target; }
    gapCap() { return this.o.builder ? this.o.gapBuilder : this.o.adv ? R.ADV.gap : this.o.gap; }
    cooling(t, act) { const a = this.acts[act]; return a !== undefined && t - a < this.o.cool; }
    // a-regie: a self-scheduling source started an act (it asked allow first): the spacing and the cooldown move
    // f-polish9 (the one event clock): a start noted that no weighted event has shown yet holds the others RULES.pend s
    // (v0.57's sessions: the walker's moment noted, seen 4 s later, the story act 8 s after the note — a pair)
    pending(t) { return this.pend > -Infinity && t - this.pend < this.o.pend && t >= this.pend; }
    // (pend: only a start that will be seen — the walker's staged moments; the pads' and the traffic's passes go unseen
    // often and do not hold anything)
    note(t, w, kind, act, pend) { if (pend && (w | 0) >= 2) this.pend = t; if (t > this.lastStart) this.lastStart = t; if (!(this.lastNote > t)) this.lastNote = t; if (act) this.acts[act] = t; this.log.push([t, w, kind, act || '']); if (this.log.length > 64) this.log.shift(); }
    // the offer to start now, or null: a story beat at the first allowed moment; else, when the gap is due, the best
    // allowed offer (weight ≥ 2 within the budget, not the kind of the last two unless nothing else, ties by the hash)
    choose(t, offers, place) {
      if (!offers || !offers.length || this.scene) return null;
      let best = null, bs = -Infinity;
      for (const of of offers) if (of && of.kind === 'story' && this.allow(t, of.weight, 'story')) { const s = of.weight * 10 + h(this.seed, this.slot, sh(of.act)); if (s > bs) { bs = s; best = of; } }
      if (best) return best;
      // a-regie: an adventurer's first offers (the call, the first encounter) at the first allowed moment
      if (this.o.adv && !this.o.builder) for (const of of offers) if (of && of.first && of.kind !== 'story' && this.allow(t, of.weight, of.kind, of.act)) { const s = of.weight * 10 + h(this.seed, this.slot, sh(of.act)); if (s > bs) { bs = s; best = of; } }
      if (best) return best;
      if (!this.due(t) || t - this.lastStart < this.o.space) return null;
      const since = t - this.last2;
      const B = this.budget(t), pl = sh(place);
      for (const of of offers) {
        if (!of || of.kind === 'story' || !(of.weight >= 2) || of.weight > B) continue;
        let s = of.weight * 10 + 6 * h(this.seed ^ pl, this.slot, sh(of.source + ':' + of.act));
        if (this.kinds.indexOf(of.kind) >= 0) s -= 25;
        if (this.cooling(t, of.act)) { if (since < R.RULES.urgent) continue; s -= 40; }   // a-regie: not the same act again soon
        { const kt = this.kindT[of.kind]; if (!(t - kt < R.RULES.vary)) s += 12; }   // a-regie: a kind not seen for a while first (the variety)
        if (of.eta > 0) s -= Math.min(10, of.eta);   // (an act that comes later fills the gap later)
        if (s > bs) { bs = s; best = of; }
      }
      return best;
    }
    // the record of a start (the source tells the event log; seen() follows when it is seen)
    started(t, of) { if (!(this.lastNote > t)) this.lastNote = t; this.log.push([t, of.weight, of.kind, of.source]); if (this.log.length > 64) this.log.shift(); if (of.act) this.acts[of.act] = t; }
  }
  R.Sched = Sched;

  // ================================================================ the game part
  const SOURCES = R.SOURCES = [];
  R.addSource = function (fn) { if (typeof fn === 'function' && SOURCES.indexOf(fn) < 0) SOURCES.push(fn); };
  const game = () => VR.game || null;
  const now = (g) => +((g && g.time) || 0);
  R.of = (g) => { g = g || game(); return g && g.regie && g.regie.world === g.world ? g.regie : null; };
  // the life director's question (lifedirector.js): may an act of weight w start now?
  R.allow = function (g, w, kind, act) {
    const S = R.of(g); if (!S) return true;
    if (R.vistaNear(g)) return false;   // a-regie: a wow moment is coming (an unseen vista near) — nothing on top of it
    if (kind !== 'story' && R.claimed(g)) { S.st.claimNo = (S.st.claimNo | 0) + 1; return false; }   // o-wander3: the walker's moment is due — the slot is its
    return S.sched.allow(now(g), w || 2, kind || 'ambient', act);   // (a query: what starts is seen through the event log)
  };
  // a-regie: a self-scheduling source (the pads' visitors, the traffic's passes) tells what it started after allow said yes
  R.note = function (g, w, kind, act, pend) { const S = R.of(g); if (S) { S.sched.note(now(g), w || 2, kind || 'ambient', act, !!pend); S.st.noted = (S.st.noted | 0) + 1; } };
  // a-regie: is the screen busy — a weighted event seen or started within the spacing, a wow moment, an unseen vista
  // within 40 m (its moment is coming)? A toast (codex.js) waits meanwhile (≤ HOLD s)
  R.HOLD = 15;
  // (o-wander3: big — only what ends a gap or was started counts for the spacing, not a sliver seen far off: the
  // Wanderregisseur asks so; a small craft over the horizon every few seconds held its moments off for good)
  R.busy = function (g, hard, big) {
    const S = R.of(g); if (!S) return false;
    const t = now(g), q = S.sched; if (t - Math.max(q.last2, big ? (q.lastNote === undefined ? -Infinity : q.lastNote) : q.lastStart) < q.o.space || q.scene) return true;
    if (g.wow && g.wow.active) return true;
    if (!big && q.pending(t)) return true;   // f-polish9: a start noted, about to be seen (the walker keeps its own PACE.noted)
    return hard ? false : R.vistaNear(g) || R.foeComing(g);   // (hard: the spacing, a scene, a wow moment — what a held toast waits for even after HOLD s)
  };
  // f-polish9 · the one event clock: an encounter about to begin — a foe on patrol within its notice range and FOE_M m
  // more of you (foes.js VR.Foes.coming): the walker's moments and beats wait for it rather than pair with it
  R.FOE_M = 8;
  R.foeComing = function (g) { const F = VR.Foes; try { return !!(F && F.coming && F.coming(g, R.FOE_M)); } catch (e) { return false; } };
  // f-polish9: may an encounter begin now (foes.js asks before a foe notices you)? Not on top of a weighted event seen or
  // started within the spacing, a start about to be seen, a scene or a wow moment — the foe waits (≤ foes.js HOLD s)
  R.held = function (g) {
    const S = R.of(g); if (!S) return false;
    const t = now(g), q = S.sched;
    if (q.scene || (g.wow && g.wow.active) || q.pending(t)) return true;
    return t - Math.max(q.last2, q.lastNote === undefined ? -Infinity : q.lastNote) < q.o.space;
  };
  // an unseen vista within 40 m (its wow moment is coming as the player walks on) — checked once a second
  R.vistaNear = function (g) {
    const S = R.of(g), t = now(g); if (S && S.vt !== undefined && Math.abs(t - S.vt) < 1) return S.vn;
    let near = null; const P = g.player && g.player.pos, WM = VR.WowMoment;
    if (P && g.wow && g.wow.list && !(g.settings && g.settings.wowMoments === false)) for (const v of g.wow.list.values()) { if (v.wow === false || Math.abs(v.x - P[0]) > 40 || Math.abs(v.z - P[2]) > 40) continue; if (Math.hypot(v.x - P[0], v.z - P[2]) < 40 && !(WM && WM.seen && WM.seen(g.meta, v.id))) { near = v.id; break; } }
    // (a player who lingers near a vista without reaching it: the hold ends after RULES.vistaHold s)
    if (S) { if (near !== S.vid) { S.vid = near; S.v0 = t; } if (near && t - S.v0 > R.RULES.vistaHold) near = null; S.vt = t; S.vn = !!near; }
    return !!near;
  };
  // o-wander3 (R58-03): the Wanderregisseur claims the next slot while its moment is due (≤ CLAIM s at a time, refreshed
  // while it stages): the self-scheduling sources and the Regie's own fill wait — on a busy Herzwelt their starts, noted
  // every ≈ 11 s and often not seen, held the walker's moments off for good (node: test/wander3.js, 0 of 16)
  R.CLAIM = 4;
  R.claim = function (g, s) { const S = R.of(g); if (S) { S.claim = now(g) + Math.max(0, Math.min(R.CLAIM, s === undefined ? R.CLAIM : s)); S.st.claims = (S.st.claims | 0) + 1; } };
  R.claimed = function (g) { const S = R.of(g); return !!(S && S.claim > now(g)); };
  R.inScene = (g, on) => { const S = R.of(g); if (S) S.sched.scene = !!on; };
  function bind(g) {
    const seed = ((g.meta && g.meta.seed) >>> 0) || 0x5eed, A = VR.Adventure;
    let adv = false; try { adv = !!(A && A.on && A.on()); } catch (e) { /* optional */ }
    const S = { world: g.world, sched: new Sched(seed, { builder: !adv, adv }), n: 0, t: 0, st: { offers: 0, started: 0, story: 0, ld: 0, seen: 0 } };
    S.sched.last2 = now(g); S.sched.lastStart = now(g) - 4;
    if (VR.EventLog) S.n = VR.EventLog.count | 0;
    g.regie = S;
    return S;
  }
  // the order a gap is filled from (pure): the acts seen before the ones only heard (a gap wants something in view);
  // when the gap is long (≥ RULES.urgent s) the acts the rotation holds back for being played within the last minute come
  // after them, if they were not played within RULES.again s — a second meteor in a dark sky rather than nothing
  R.RULES.urgent = 45; R.RULES.again = 30;
  R.fillOrder = function (order, C, hist, t, since, heard) {
    const seen = order.filter(c => !(heard && heard[c])), only = order.filter(c => heard && heard[c]);
    let out = seen.concat(only);
    if (since >= R.RULES.urgent) {
      const last = (c) => { for (let i = hist.length - 1; i >= 0; i--) if (hist[i][1] === c) return hist[i][0]; return -Infinity; };
      const more = C.filter(c => out.indexOf(c) < 0 && !(heard && heard[c]) && t - last(c) >= R.RULES.again).sort((a, b) => last(a) - last(b));
      out = seen.concat(more, only);
    }
    return out;
  };
  // the director's next act (its rotation's order), pulled forward into a gap
  R.addSource(function ldOffer(g) {
    const D = g.lifeDirector, LD = VR.LifeDirector, S = R.of(g);
    const no = (w) => { if (S) { const q = S.st.ldNo || (S.st.ldNo = {}); q[w] = (q[w] | 0) + 1; } return null; };   // (a-regie: why the director offered nothing — the session's JSON)
    if (!D || !D.on || !D.ctx || !LD) return no('off');
    if (D.events && D.events.length >= (D.tier >= 2 ? 4 : 2)) return no('full');
    const since0 = S ? now(g) - S.sched.last2 : 0;
    if (D.time < D.flyUntil && since0 < R.RULES.urgent) return no('fly');   // (a-regie: a fly-by's moment holds the rest — not once the gap is long: v0.51's passes went unseen and held it 2 min)
    // a-regie: a slot of the director's own waiting for its pace (D.pend) is offered as it is — the Regie's spacing decides
    // (v0.51's sessions: the pending slot held the Regie's fill up a third of the time)
    const P = D.pend, k = P ? P.k : (D.lastK || 0) + 1, C = LD.candidates(D.ctx); if (!C.length) return no('none');
    if (P) no('pend');
    const since = S ? now(g) - S.sched.last2 : 0, HEARD = {};
    for (const c of C) if (LD.ACTS[c] && LD.ACTS[c].heard) HEARD[c] = 1;
    const order = R.fillOrder(LD.order(D.seed, k, C, D.acts, D.time, P ? P.first : LD.pick(D.seed, k, D.ctx)), C, D.acts, D.time, since, HEARD);
    if (!order.length) return no('order');
    // a-regie: the first three of the order with different kinds (the event log's own kind for each act) — the Regie
    // chooses among them by its rules (the variety, the cooldown); the one chosen plays first, the rest of the order after it
    const EA = VR.EventLog && VR.EventLog.ACTS, out = [], kinds = {};
    for (let i = 0; i < order.length && out.length < 3; i++) {
      const act = order[i], kind = LD.FLY[act] ? 'travel' : EA && EA[act] && EA[act].kind ? EA[act].kind : act === 'meteor' || act === 'skyray' || act === 'fireworks' ? 'sky' : 'ambient';
      if (kinds[kind]) continue; kinds[kind] = 1;
      const ord = [act].concat(order.filter(c => c !== act));
      out.push({ source: 'ld', act, weight: 2, kind, place: D.ctx.place, eta: LD.FLY[act] ? LD.ROT.eta : 0, start: () => { const ev = D.play(ord, { k: P ? P.k : 600000 + k * 16 + ((D.fillN = (D.fillN | 0) + 1) & 15) }); if (ev) { D.st.filled++; if (P && D.pend === P) D.pend = null; } return !!ev; } });
    }
    return out;
  });
  // a frame (story.js's hook): the new records seen, 4 times a second the offers
  R.frame = function (g, dt) {
    if (g.state !== 'play' || !g.world) return;
    let S = R.of(g); if (!S) S = bind(g);
    const L = VR.EventLog, t = now(g);
    if (L && L.count > S.n) {
      const list = L.events(S.n); S.n = L.count;
      // (seen as the measure sees it — sessionstats.js SEEN_HALF: in view, and half of a full sighting, 0.5 % of the screen,
      // or on the screen by itself: a cat across the plaza at 0.3 % does not end a gap)
      for (const e of list) if (e.inView && e.w >= 2) { const small = e.frac > 0 && e.frac < R.RULES.seenFrac; S.sched.seen(e.t, e.w, e.kind, small); if (!small) S.st.seen++; }
    }
    const F = g.funke;
    S.sched.bauruhe = !!(F && ((F.budget && F.budget.quiet(t)) || (F.buildFocus && F.buildFocus())));
    if ((S.t -= dt) > 0) return;
    S.t = 0.25;
    // o-wander3: why nothing started this tick (counted per tick of 0.25 s; the session's JSON)
    const why = (k) => { const q = S.st.why || (S.st.why = {}); q[k] = (q[k] | 0) + 1; };
    if (R.vistaNear(g)) return why('vista');   // a-regie: a wow moment is coming
    if (S.claim > t) return why('claim');   // o-wander3: the walker's moment has the slot
    const ctx = { t, place: g.lifeDirector && g.lifeDirector.ctx ? g.lifeDirector.ctx.place : '' }, offers = [];
    for (const fn of SOURCES) { try { const o = fn(g, ctx); if (o) for (const q of o) if (q) offers.push(q); } catch (e) { /* a source's */ } }
    S.st.offers += offers.length;
    const q = S.sched, due = q.due(t) && t - q.lastStart >= q.o.space;
    if (due) S.st.dueOffers = (S.st.dueOffers | 0) + offers.length;   // (o-wander3: the offers made while a gap was due — the real chances)
    const of = S.sched.choose(t, offers, ctx.place);
    if (!of) return why(!offers.length ? 'none' : !q.due(t) ? 'notdue' : t - q.lastStart < q.o.space ? 'space' : 'budget');
    let ok = false; try { ok = of.start() !== false; } catch (e) { ok = false; }
    if (!ok) why('fail');
    if (ok) { S.sched.started(t, of); S.sched.lastStart = Math.max(S.sched.lastStart, t); S.st.started++; S.st[of.source] = (S.st[of.source] | 0) + 1; if (of.kind === 'story') { S.sched.lastBeat = t; S.sched.lastStart = t; } }
  };
  R.stats = function (g) { const S = R.of(g); if (!S) return null; const q = S.sched; return { st: Object.assign({}, S.st), last2: q.last2, target: +q.target.toFixed(1), slot: q.slot, kinds: q.kinds.slice(), scene: q.scene, bauruhe: q.bauruhe, builder: !!q.o.builder, log: q.log.slice(-12) }; };

  if (typeof module !== 'undefined' && module.exports) module.exports = R;
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

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
  R.RULES = { min: 18, max: 42, gap: 75, gapBuilder: 90, space: 8, major: 60, beat: 300, bauruhe: 2 };
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
    }
    jit(k) { const o = this.o, cap = this.o.builder ? o.gapBuilder : o.gap; return Math.min(cap - 5, o.min + (o.max - o.min) * h(this.seed, k, 0x5e91)); }
    // the budget now: the heaviest weight that may start
    budget(t) { if (this.bauruhe) return this.o.bauruhe; return t - this.lastMajor >= this.o.major ? 5 : 3; }
    // an event of weight w seen at t (in view): the clocks move
    seen(t, w, kind) {
      if (!(w >= 2)) return;
      if (t > this.last2) { this.last2 = t; this.slot++; this.target = this.jit(this.slot); }
      if (t > this.lastStart) this.lastStart = t;
      if (w >= 4 && t > this.lastMajor) this.lastMajor = t;
      if (kind === 'story' && t > this.lastBeat) this.lastBeat = t;
      this.kinds.push(kind); if (this.kinds.length > 2) this.kinds.shift();
    }
    // may a source start an event of weight w and kind now?
    allow(t, w, kind) {
      if (this.scene) return false;
      if (t - this.lastStart < this.o.space) return false;
      if ((w | 0) > this.budget(t)) return false;
      if (kind === 'story' && t - this.lastBeat < this.o.beat) return false;
      return true;
    }
    due(t) { return t - this.last2 >= this.target; }
    gapCap() { return this.o.builder ? this.o.gapBuilder : this.o.gap; }
    // the offer to start now, or null: a story beat at the first allowed moment; else, when the gap is due, the best
    // allowed offer (weight ≥ 2 within the budget, not the kind of the last two unless nothing else, ties by the hash)
    choose(t, offers, place) {
      if (!offers || !offers.length || this.scene) return null;
      let best = null, bs = -Infinity;
      for (const of of offers) if (of && of.kind === 'story' && this.allow(t, of.weight, 'story')) { const s = of.weight * 10 + h(this.seed, this.slot, sh(of.act)); if (s > bs) { bs = s; best = of; } }
      if (best) return best;
      if (!this.due(t) || t - this.lastStart < this.o.space) return null;
      const B = this.budget(t), pl = sh(place);
      for (const of of offers) {
        if (!of || of.kind === 'story' || !(of.weight >= 2) || of.weight > B) continue;
        let s = of.weight * 10 + 6 * h(this.seed ^ pl, this.slot, sh(of.source + ':' + of.act));
        if (this.kinds.indexOf(of.kind) >= 0) s -= 25;
        if (of.eta > 0) s -= Math.min(10, of.eta);   // (an act that comes later fills the gap later)
        if (s > bs) { bs = s; best = of; }
      }
      return best;
    }
    // the record of a start (the source tells the event log; seen() follows when it is seen)
    started(t, of) { this.log.push([t, of.weight, of.kind, of.source]); if (this.log.length > 64) this.log.shift(); }
  }
  R.Sched = Sched;

  // ================================================================ the game part
  const SOURCES = R.SOURCES = [];
  R.addSource = function (fn) { if (typeof fn === 'function' && SOURCES.indexOf(fn) < 0) SOURCES.push(fn); };
  const game = () => VR.game || null;
  const now = (g) => +((g && g.time) || 0);
  R.of = (g) => { g = g || game(); return g && g.regie && g.regie.world === g.world ? g.regie : null; };
  // the life director's question (lifedirector.js): may an act of weight w start now?
  R.allow = function (g, w, kind) {
    const S = R.of(g); if (!S) return true;
    return S.sched.allow(now(g), w || 2, kind || 'ambient');   // (a query: what starts is seen through the event log)
  };
  R.inScene = (g, on) => { const S = R.of(g); if (S) S.sched.scene = !!on; };
  function bind(g) {
    const seed = ((g.meta && g.meta.seed) >>> 0) || 0x5eed, A = VR.Adventure;
    let adv = false; try { adv = !!(A && A.on && A.on()); } catch (e) { /* optional */ }
    const S = { world: g.world, sched: new Sched(seed, { builder: !adv }), n: 0, t: 0, st: { offers: 0, started: 0, story: 0, ld: 0, seen: 0 } };
    S.sched.last2 = now(g); S.sched.lastStart = now(g) - 4;
    if (VR.EventLog) S.n = VR.EventLog.count | 0;
    g.regie = S;
    return S;
  }
  // the director's next act (its rotation's order), pulled forward into a gap
  R.addSource(function ldOffer(g) {
    const D = g.lifeDirector, LD = VR.LifeDirector;
    if (!D || !D.on || !D.ctx || !LD || D.pend || (D.events && D.events.length >= (D.tier >= 2 ? 4 : 2)) || D.time < D.flyUntil) return null;
    const k = (D.lastK || 0) + 1, C = LD.candidates(D.ctx); if (!C.length) return null;
    const order = LD.order(D.seed, k, C, D.acts, D.time, LD.pick(D.seed, k, D.ctx));
    if (!order.length) return null;
    const kind = LD.FLY[order[0]] ? 'travel' : order[0] === 'meteor' || order[0] === 'skyray' || order[0] === 'fireworks' ? 'sky' : 'ambient';
    return [{ source: 'ld', act: order[0], weight: 2, kind, place: D.ctx.place, eta: LD.FLY[order[0]] ? LD.ROT.eta : 0, start: () => { const ev = D.play(order, { k: 600000 + k * 16 + ((D.fillN = (D.fillN | 0) + 1) & 15) }); if (ev) D.st.filled++; return !!ev; } }];
  });
  // a frame (story.js's hook): the new records seen, 4 times a second the offers
  R.frame = function (g, dt) {
    if (g.state !== 'play' || !g.world) return;
    let S = R.of(g); if (!S) S = bind(g);
    const L = VR.EventLog, t = now(g);
    if (L && L.count > S.n) {
      const list = L.events(S.n); S.n = L.count;
      for (const e of list) if (e.inView && e.w >= 2) { S.sched.seen(e.t, e.w, e.kind); S.st.seen++; }
    }
    const F = g.funke;
    S.sched.bauruhe = !!(F && ((F.budget && F.budget.quiet(t)) || (F.buildFocus && F.buildFocus())));
    if ((S.t -= dt) > 0) return;
    S.t = 0.25;
    const ctx = { t, place: g.lifeDirector && g.lifeDirector.ctx ? g.lifeDirector.ctx.place : '' }, offers = [];
    for (const fn of SOURCES) { try { const o = fn(g, ctx); if (o) for (const q of o) if (q) offers.push(q); } catch (e) { /* a source's */ } }
    S.st.offers += offers.length;
    const of = S.sched.choose(t, offers, ctx.place);
    if (!of) return;
    let ok = false; try { ok = of.start() !== false; } catch (e) { ok = false; }
    if (ok) { S.sched.started(t, of); S.st.started++; S.st[of.source] = (S.st[of.source] | 0) + 1; if (of.kind === 'story') { S.sched.lastBeat = t; S.sched.lastStart = t; } }
  };
  R.stats = function (g) { const S = R.of(g); if (!S) return null; const q = S.sched; return { st: Object.assign({}, S.st), last2: q.last2, target: +q.target.toFixed(1), slot: q.slot, kinds: q.kinds.slice(), scene: q.scene, bauruhe: q.bauruhe, builder: !!q.o.builder, log: q.log.slice(-12) }; };

  if (typeof module !== 'undefined' && module.exports) module.exports = R;
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

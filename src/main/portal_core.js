// ============================================================================
// e-portal · VR.PortalCore — the pure part of the Leuchtpfad (docs/superpowers/plans/2026-10-31-e-portal.md): travel to
// a world or a ★ spot you love through a gate (the Gate Temple's portal veil, a station's), the pause menu (🌍 Reisen)
// or by holding K — and watch the journey as a short film instead of piloting it. No DOM, no game: test/portal.js.
//   · kinds:     kindOf(dim) → home · deep · isles · moon · world · station · exo; airOf(dim) (clouds on the way up)
//   · the rules: why(ctx, meta, here, dest) → null (open) or 'guest' · 'here' · 'locked' · 'unknown'. Kreativ: every
//                world open; Abenteuer / Überleben: only worlds reached once by ship, ferry or gate (meta.pos keeps a
//                place for every world you have left — the first trip stays an adventure); another star's world only
//                after its system was reached; home always. ctx: {creative, adventure, guest}
//   · places(ctx, meta, here, {stations}) → the picker's cards; surprise(list, seed, prevId, here) → 'Überrasch mich'
//   · favourites (meta.portal.favs): favAdd · favRemove · favHasWorld · favToggleWorld — a spot (dim + at) or a world
//   · the film:  film(rec, seed, from, to, {low}) → {id, shots: [{id, v, dur}], low} — the gate's swallow, 1–3 shots
//                chosen for the trip (clouds / rise / deep / glide / curve / ring / moon / station / tunnel), the arrival;
//                10–15 s; never the same film as one of the last five trips (rec.films)
//   · the story: hook(rec, seed, dim, fav) → a caption's key (no repeat within three trips to that kind of place);
//                episode(rec, seed, dim) → a tiny scene of „Funke und die Leuchtfeuer" on the first gate arrival at a
//                world, each episode once per save
//   · fast flight (Kreativ, single-player only): fastOk(ctx) · flyMul(chosen, ctx, pending) (×1 … ×8, the soft cap
//                while the land streams in) · fovAdd(mul) · step(mul, wheel). ctx: {creative, adventure, guest, mp}
// The record (meta.portal): {v: 1, n, favs: [{id, dim, at?, yaw?, name?, t}], films: [id], hooks: {kind: [key]},
// eps: [id], gated: [dim], trips, last}. rec(meta) makes it sane (an old save gets a fresh one).
// ============================================================================
(function (VR) {
  'use strict';
  const D = () => VR.DimReg;
  const P = VR.PortalCore = {};
  P.FAV_MAX = 24;
  P.FILM_MIN = 10; P.FILM_MAX = 15;
  P.NO_REPEAT = 5;   // trips a film is not shown again

  // ---------------------------------------------------------------- kinds
  const KIND = { overworld: 'home', flat: 'home', underforge: 'deep', hollow: 'deep', drift: 'isles', basalt: 'moon', opal: 'moon', zinn: 'world', ocker: 'world', aqua: 'world' };
  const AIR = { overworld: 1, flat: 1, drift: 1, ocker: 1, aqua: 1 };
  P.kindOf = (dim) => { const s = String(dim || ''); if (KIND[s]) return KIND[s]; if (s.slice(0, 4) === 'stn.') return 'station'; if (s.slice(0, 2) === 'x.') return 'exo'; return 'unknown'; };
  P.airOf = (dim) => !!AIR[dim];
  P.ORDER = ['home', 'isles', 'deep', 'moon', 'world', 'station', 'exo', 'unknown'];
  const num3 = (a) => Array.isArray(a) && a.length >= 3 && a.slice(0, 3).every((v) => typeof v === 'number' && Number.isFinite(v));

  // a small seeded random (mulberry32)
  const rng = (s) => { let a = (s >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  P.rng = rng; P.hash = hash;

  // ---------------------------------------------------------------- the record
  P.rec = function (meta) {
    const m = meta || {}, o = m.portal && typeof m.portal === 'object' ? m.portal : {};
    const favs = Array.isArray(o.favs) ? o.favs.filter((f) => f && typeof f === 'object' && typeof f.id === 'string' && typeof f.dim === 'string' && (f.at === undefined || num3(f.at))).slice(0, P.FAV_MAX) : [];
    const strs = (a, n) => (Array.isArray(a) ? a.filter((x) => typeof x === 'string').slice(-n) : []);
    const hooks = {}; if (o.hooks && typeof o.hooks === 'object') for (const k of Object.keys(o.hooks)) hooks[k] = strs(o.hooks[k], 3);
    const r = { v: 1, n: Number.isFinite(o.n) ? o.n | 0 : favs.length, favs, films: strs(o.films, 8), hooks, eps: strs(o.eps, 64), gated: strs(o.gated, 256), trips: Number.isFinite(o.trips) ? o.trips | 0 : 0, last: typeof o.last === 'string' ? o.last : null };
    m.portal = r;
    return r;
  };

  // ---------------------------------------------------------------- the rules
  P.visited = (meta, here) => { const m = meta || {}, s = new Set([D().home(m)]); if (here) s.add(here); if (m.dim) s.add(m.dim); for (const k of Object.keys(m.pos || {})) s.add(k); return s; };
  P.free = (ctx) => !!(ctx && ctx.creative && !ctx.adventure);
  P.why = function (ctx, meta, here, dest) {
    if (ctx && ctx.guest) return 'guest';
    if (!dest || !dest.dim) return 'unknown';
    const dim = dest.dim, home = D().home(meta);
    if (dim === here && !num3(dest.at)) return 'here';
    if (dim === home) return null;
    const K = P.kindOf(dim);
    if (K === 'unknown' && !D().has(dim)) return 'unknown';
    const seen = P.visited(meta, here).has(dim);
    if (K === 'exo') return seen ? null : 'locked';   // (another star: only once its system was reached, in Kreativ too)
    if (P.free(ctx)) return null;
    return seen ? null : 'locked';
  };

  // ---------------------------------------------------------------- the cards
  P.places = function (ctx, meta, here, extra) {
    const m = meta || {}, rec = P.rec(m), home = D().home(m), out = [{ id: 'surprise', dim: null, kind: 'surprise', open: true, why: null }];
    const card = (dim) => { const why = P.why(ctx, m, here, { dim }); return { id: 'w:' + dim, dim, kind: P.kindOf(dim), open: why === null, why, here: dim === here, fav: false, star: P.favHasWorld(rec, dim) }; };
    out.push(card(home));
    for (const f of rec.favs) { if (!f.at) continue; const why = P.why(ctx, m, here, f); out.push({ id: f.id, dim: f.dim, at: f.at.slice(0, 3), yaw: f.yaw, name: f.name || null, kind: P.kindOf(f.dim), open: why === null, why, here: false, fav: true }); }
    const dims = [];
    for (const d of D().travelable(m)) if (d !== home) dims.push(d);
    for (const d of (extra && extra.stations) || []) if (!dims.includes(d)) dims.push(d);
    for (const d of P.visited(m, here)) if (P.kindOf(d) === 'exo' && !dims.includes(d)) dims.push(d);
    const rank = (d) => P.ORDER.indexOf(P.kindOf(d));
    dims.sort((a, b) => (P.favHasWorld(rec, b) - P.favHasWorld(rec, a)) || (rank(a) - rank(b)));
    for (const d of dims) out.push(card(d));
    return out;
  };
  P.surprise = function (list, seed, prevId, here) {
    const c = (list || []).filter((q) => q.open && q.id !== 'surprise' && q.id !== prevId && !(q.dim === here && !q.at));
    if (!c.length) return null;
    return c[Math.floor(rng(seed ^ 0x51ED)() * c.length)];
  };

  // ---------------------------------------------------------------- favourites
  P.favHasWorld = (rec, dim) => !!(rec && rec.favs.some((f) => f.dim === dim && !f.at));
  P.favAdd = function (rec, o) {
    if (!rec || !o || typeof o.dim !== 'string') return null;
    const at = num3(o.at) ? o.at.slice(0, 3).map((v) => Math.round(v * 10) / 10) : null;
    for (const f of rec.favs) {
      if (f.dim !== o.dim) continue;
      if (!at && !f.at) return null;
      if (at && f.at && Math.hypot(f.at[0] - at[0], f.at[1] - at[1], f.at[2] - at[2]) < 8) return null;
    }
    const f = { id: 'f' + (rec.n = (rec.n | 0) + 1).toString(36), dim: o.dim, t: Number.isFinite(o.t) ? o.t : 0 };
    if (at) { f.at = at; f.yaw = Number.isFinite(o.yaw) ? Math.round(o.yaw * 1000) / 1000 : 0; }
    if (typeof o.name === 'string' && o.name) f.name = o.name.slice(0, 40);
    rec.favs.unshift(f);
    if (rec.favs.length > P.FAV_MAX) rec.favs.length = P.FAV_MAX;
    return f;
  };
  P.favRemove = function (rec, id) { const i = rec ? rec.favs.findIndex((f) => f.id === id) : -1; if (i < 0) return false; rec.favs.splice(i, 1); return true; };
  P.favToggleWorld = function (rec, dim) { const f = rec.favs.find((q) => q.dim === dim && !q.at); if (f) { P.favRemove(rec, f.id); return false; } return !!P.favAdd(rec, { dim }); };

  // ---------------------------------------------------------------- the film
  // each shot: its length (s) and three variants (the palette, the side it comes from, the light) — film.js draws them
  P.SHOTS = { swallow: 1.8, clouds: 2.6, rise: 2.4, deep: 3.0, glide: 3.4, curve: 2.8, ring: 2.6, moon: 3.0, station: 3.0, tunnel: 3.2, arrive: 2.8 };
  function middle(r, from, to) {
    const fk = P.kindOf(from), tk = P.kindOf(to), pick = (a) => a[Math.floor(r() * a.length)];
    if (from === to) return (r() < 0.6 ? ['clouds'] : []).concat(['glide']);
    if (fk === 'deep' || tk === 'deep') return r() < 0.5 ? ['deep'] : ['deep', 'deep'];
    const seq = [P.airOf(from) ? 'clouds' : 'rise'];
    const space = [];
    if (tk !== 'exo' || r() < 0.5) space.push('curve');
    if ((fk === 'home' || tk === 'moon' || tk === 'station') && r() < 0.55) space.push('ring');
    if (space.length === 2 && r() < 0.5) space.reverse();
    const approach = tk === 'exo' ? 'tunnel' : tk === 'station' ? 'station' : (tk === 'moon' || tk === 'world') ? 'moon' : P.airOf(to) ? 'clouds' : pick(['curve', 'moon']);
    if (fk === 'exo' && tk !== 'exo') seq.push('tunnel');   // (home from another star: the tunnel first)
    for (const s of space) if (seq.length + 2 <= 4 && s !== approach) seq.push(s);
    if (seq[seq.length - 1] !== approach) seq.push(approach);
    return seq;
  }
  P.film = function (rec, seed, from, to, o) {
    const R = rec || P.rec({}), recent = R.films.slice(-P.NO_REPEAT);
    let best = null;
    for (let k = 0; k < 64; k++) {
      const r = rng((seed >>> 0) ^ Math.imul(R.trips + 1, 0x9E3779B1) ^ Math.imul(k + 1, 0x85EBCA77) ^ hash(from + '>' + to));
      const mid = middle(r, from, to), shots = [{ id: 'swallow', v: Math.floor(r() * 3), dur: P.SHOTS.swallow }];
      let prevV = -1;
      for (const id of mid) { let v = Math.floor(r() * 3); if (id === shots[shots.length - 1].id && v === prevV) v = (v + 1) % 3; prevV = v; shots.push({ id, v, dur: P.SHOTS[id] }); }
      shots.push({ id: 'arrive', v: Math.floor(r() * 3), dur: P.SHOTS.arrive });
      // 10–15 s: a short film's middle shots stretch, a long one's shorten
      let len = shots.reduce((s, q) => s + q.dur, 0);
      const mids = shots.slice(1, -1);
      if (len < P.FILM_MIN && mids.length) { const add = (P.FILM_MIN + 0.4 - len) / mids.length; for (const q of mids) q.dur = Math.round((q.dur + add) * 10) / 10; }
      if (len > P.FILM_MAX && mids.length) { const cut = (len - P.FILM_MAX + 0.4) / mids.length; for (const q of mids) q.dur = Math.round((q.dur - cut) * 10) / 10; }
      len = shots.reduce((s, q) => s + q.dur, 0);
      const id = mid.map((s, i) => s + '.' + shots[i + 1].v).join('>') + '|' + shots[0].v + shots[shots.length - 1].v;
      best = { id, shots, len: Math.round(len * 10) / 10, low: !!(o && o.low), from, to };
      if (!recent.includes(id)) break;
    }
    R.films.push(best.id); if (R.films.length > 8) R.films.splice(0, R.films.length - 8);
    R.trips++;
    return best;
  };

  // ---------------------------------------------------------------- the captions and the episodes
  P.HOOKS = { home: 4, deep: 3, isles: 3, moon: 4, world: 3, station: 3, exo: 3, fav: 3, unknown: 2 };
  P.hook = function (rec, seed, dim, fav) {
    const kind = fav ? 'fav' : P.kindOf(dim), n = P.HOOKS[kind] || P.HOOKS.unknown, R = rec || P.rec({});
    const last = R.hooks[kind] || (R.hooks[kind] = []);
    const r = rng((seed >>> 0) ^ hash(kind) ^ Math.imul(R.trips + 7, 0x27D4EB2F));
    let i = Math.floor(r() * n), key = null;
    for (let k = 0; k < n; k++) { const c = 'g.pt.hook.' + kind + '.' + (((i + k) % n) + 1); if (!last.slice(-2).includes(c)) { key = c; break; } }
    if (!key) key = 'g.pt.hook.' + kind + '.' + (i + 1);
    last.push(key); if (last.length > 3) last.splice(0, last.length - 3);
    return key;
  };
  // the episodes: who speaks, in which kind of place (null: anywhere); each a little scene, two or three lines
  const E = (id, kinds, who) => ({ id, kinds, lines: who.map((w, i) => ({ who: w, key: 'g.pt.ep.' + id + '.' + (i + 1) })) });
  P.EPISODES = [
    E('moon1', ['moon'], ['funke', 'lumi']),
    E('moon2', ['moon'], ['oskar', 'funke', 'oskar']),
    E('world1', ['world'], ['selma', 'funke']),
    E('world2', ['world'], ['funke', 'jonte']),
    E('deep1', ['deep'], ['jonte', 'funke']),
    E('deep2', ['deep'], ['funke', 'ilka']),
    E('isles1', ['isles'], ['lumi', 'funke']),
    E('stn1', ['station'], ['ilka', 'funke']),
    E('stn2', ['station'], ['funke', 'oskar']),
    E('exo1', ['exo'], ['funke', 'selma']),
    E('exo2', ['exo'], ['funke', 'funke']),
    E('home1', ['home'], ['funke', 'lumi']),
    E('any1', null, ['funke', 'jonte']),
    E('any2', null, ['ilka', 'funke']),
    E('any3', null, ['funke', 'selma']),
  ];
  P.episode = function (rec, seed, dim) {
    const R = rec || P.rec({});
    if (!dim || R.gated.includes(dim)) return null;
    R.gated.push(dim);
    const kind = P.kindOf(dim), free = P.EPISODES.filter((e) => !R.eps.includes(e.id));
    let c = free.filter((e) => e.kinds && e.kinds.includes(kind));
    if (!c.length) c = free.filter((e) => !e.kinds);
    if (!c.length) return null;
    const e = c[Math.floor(rng((seed >>> 0) ^ hash(dim))() * c.length)];
    R.eps.push(e.id);
    return e;
  };

  // ---------------------------------------------------------------- fast flight
  P.FLY_MAX = 8;
  P.fastOk = (ctx) => !!(ctx && ctx.creative && !ctx.adventure && !ctx.guest && !ctx.mp);
  P.flyMul = function (chosen, ctx, pending) {
    if (!P.fastOk(ctx)) return 1;
    const m = Math.max(1, Math.min(P.FLY_MAX, Math.floor(Number(chosen) || 1)));
    const p = Number(pending) || 0, cap = p <= 48 ? P.FLY_MAX : Math.max(2, P.FLY_MAX - Math.floor((p - 48) / 16));
    return Math.min(m, cap);
  };
  P.fovAdd = (mul) => Math.round(Math.max(0, (mul || 1) - 1) * 1.6 * 10) / 10;   // +11° at ×8
  P.step = (mul, wheel) => Math.max(1, Math.min(P.FLY_MAX, (mul | 0 || 1) + (wheel < 0 ? 1 : wheel > 0 ? -1 : 0)));

  // ---------------------------------------------------------------- e-portal2: the skip that always takes
  // a press at t (s): before `after` it is kept (null: take it at `after`); from then on the film is at its end — the
  // reveal follows the moment the land is there (portal.js)
  P.skipTo = (t, len, after) => (t < after ? null : len);
  // a gamepad's fresh press of A (0), B (1) or Start (9): true once per press (st keeps what was held)
  P.PAD_SKIP = [0, 1, 9];
  P.padSkip = function (pads, st) {
    let held = false;
    if (pads) for (const p of pads) { if (!p || !p.buttons) continue; for (const i of P.PAD_SKIP) { const b = p.buttons[i]; if (b && (b.pressed || b.value > 0.5)) held = true; } }
    const fresh = held && !st.held; st.held = held; return fresh;
  };

  // ---------------------------------------------------------------- the words
  P.UI_KEYS = ['g.pt.title', 'g.pt.sub.free', 'g.pt.sub.earned', 'g.pt.surprise', 'g.pt.surpriseTip', 'g.pt.home', 'g.pt.here', 'g.pt.locked', 'g.pt.lockedTip',
    'g.pt.favHere', 'g.pt.favHereDone', 'g.pt.favSpot', 'g.pt.favWorld', 'g.pt.unfav', 'g.pt.close', 'g.pt.skip', 'g.pt.menu', 'g.pt.menuTip', 'g.pt.holdK',
    'g.pt.guest', 'g.pt.busy', 'g.pt.gate', 'g.pt.kind.home', 'g.pt.kind.deep', 'g.pt.kind.isles', 'g.pt.kind.moon', 'g.pt.kind.world', 'g.pt.kind.station',
    'g.pt.kind.exo', 'g.pt.kind.unknown', 'g.pt.kind.fav', 'g.pt.episode', 'g.pt.fly', 'g.set.flyFast', 'g.set.flyFast.tip', 'g.pt.flyMp', 'g.pt.slow', 'g.pt.skipWait', 'g.pt.bestHour'];
  P.keys = function () {
    const out = P.UI_KEYS.slice();
    for (const k of Object.keys(P.HOOKS)) for (let i = 1; i <= P.HOOKS[k]; i++) out.push('g.pt.hook.' + k + '.' + i);
    for (const e of P.EPISODES) for (const l of e.lines) out.push(l.key);
    return out;
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

// ============================================================================
// a-quest · VR.TalesCore — the pure part of the Geschichten (adventures that grow out of friendship and news; plan
// docs/superpowers/plans/2026-11-02-a-quest.md). No DOM, no game: test/tales.js. The glue is src/main/tales.js.
//   templates   TC.TPL: data, not code — each a list of ways (the places it needs: a fairy place, another village, a
//               hill, the gate of the Lichtbrücke, a plot by your home), points derived from them (an offset, a trail,
//               a ring), the steps, the twists (each a short reveal and 0–1 extra steps spliced in at '@twist'), a
//               deadline (the festival at dusk), the rewards. A new template is one more entry here plus its texts.
//   steps       go (reach a point) · marks (visit points in order: footprints, lost sparks, cozy things) · place (put
//               n blocks of a kind near a point: lights, flowers) · build (n blocks near a plot with every kind of a
//               style) · talk (meet someone near a point) · cross (over the Lichtbrücke and back) · meet (anyone in the
//               other world) · any (alternatives: builders build, adventurers and explorers find)
//   generator   TC.make(ctx, rec) — a pure function of (seed, the quest counter, the giver, the world's places and the
//               news): the template (weighted by recent deeds, never the last one again while another fits, never a
//               template + twist of the last TC.NOREP), its way, twist, names and points
//   play        TC.feed(tale, ev) with ev {k:'pos'|'placed'|'meet'|'dim', …} → what happened ({k:'prog'|'step'|
//               'twist'|'done'}); TC.hint / TC.target for the HUD line and Funke's compass; TC.finish → the rewards
// The record: meta.tales = {v: 1, n, cur, hist: [{t, v, d}], pages: [...], lit: [...], cool} (TC.load normalises; a
// newer save's record stays untouched; a tale is saved mid-way with its steps' progress).
// ============================================================================
(function (VR) {
  'use strict';
  const TC = VR.TalesCore = VR.TalesCore || {};
  TC.V = 1; TC.DAY = 24000; TC.NOREP = 8; TC.PAGES = 40; TC.HIST = 24; TC.SPEED = 4.6;
  TC.DUSK = 12000;   // the festival begins at sunset (ticks: 0 sunrise, 12000 sunset)
  TC.ROLES = ['builder', 'adventurer', 'explorer'];
  TC.CATS = ['light', 'door', 'wood', 'stone', 'leaf', 'flower'];
  const fin = Number.isFinite;
  const isObj = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
  TC.h = function () {
    let x = 0x811c9dc5;
    for (let i = 0; i < arguments.length; i++) { const s = String(arguments[i]); for (let j = 0; j < s.length; j++) { x ^= s.charCodeAt(j); x = Math.imul(x, 0x01000193); } x ^= 0x7c; x = Math.imul(x, 0x01000193); }
    x ^= x >>> 16; x = Math.imul(x, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16;
    return x >>> 0;
  };
  const u = function () { return TC.h.apply(null, arguments) / 4294967296; };
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

  // the kinds of a block (the glue reads the registry; this is the name part)
  TC.catsOf = function (name, o) {
    o = o || {}; const n = String(name || ''), out = [];
    if (o.emit) out.push('light');
    if (o.door) out.push('door');
    if (/plank|_log$|_wood$|stripped_/.test(n)) out.push('wood');
    if (/stone|brick|cobble|deepstone|andesite|granite|diorite/.test(n)) out.push('stone');
    if (/leaves|moss/.test(n)) out.push('leaf');
    if (/flower|tulip|rose|poppy|daisy|lily_of|orchid|allium|dandelion|cornflower|sunflower|azalea/.test(n)) out.push('flower');
    return out;
  };

  // ================================================================ the templates (data)
  // pick: [source, min, max] — source 'fairy' | 'village' (another than the giver's) | 'hill' | 'gate'; min/max from
  //   the giver's village (blocks). 'plot' is special: by your home (ctx.home) or at the giver's village's edge.
  // pts: derived points — ['off', base, rmin, rmax] · ['trail', from, to, n] · ['ring', base, rmin, rmax, n]
  // a step: {id, k, at, r, n, cat, cats, of, roles, with, say}; '@twist' where the twist goes
  TC.TPL = {
    lost: {
      w: 1, news: { fairy: 3, helped: 1, tale: 0.5 }, hours: [6500, 12600], fr: 5, items: ['lantern', 'torch'], verse: true,
      need: { kid: true },
      ways: [{
        id: 'wood', pick: { place: ['fairy', 0, 650, ['shroom', 'tree', 'circle', 'spring']] },   // (not the floating garden: a child stays on the ground)
        pts: { hide: ['off', 'place', 18, 30], prints: ['trail', 'place', 'hide', 3], shrooms: ['ring', 'hide', 5, 9, 2], flies: ['ring', 'hide', 6, 10, 1] },
        steps: [
          { id: 'place', k: 'go', at: 'place', r: 18 },
          { id: 'trail', k: 'any', of: [{ k: 'marks', at: 'prints', r: 3, roles: ['adventurer', 'explorer'] }, { k: 'place', at: 'place', r: 28, n: 2, cat: 'light', roles: ['builder'] }] },
          { id: 'find', k: 'go', at: 'hide', r: 4, say: true, with: 'kid' },
          '@twist',
          { id: 'home', k: 'go', at: 'home', r: 14 },
        ],
      }],
      twists: {
        flausel: [{ id: 'flhome', k: 'go', at: 'place', r: 7, say: true }],
        gift: [{ id: 'gather', k: 'marks', at: 'shrooms', r: 3, say: true }],
        dark: [{ id: 'light', k: 'any', say: true, of: [{ k: 'place', at: 'hide', r: 8, n: 1, cat: 'light', roles: ['builder'] }, { k: 'marks', at: 'flies', r: 3, roles: ['adventurer', 'explorer'] }] }],
      },
    },
    ingr: {
      w: 1, news: { fest: 3, gift: 1, tale: 0.5 }, hours: [0, 8000], due: 'dusk', fr: 4, items: ['honey_bottle', 'cake', 'bread'], verse: true,
      names: { ingr: ['moonhoney', 'glowberry', 'sunflour', 'cloudcream'] },
      ways: [{
        id: 'caravan', pick: { other: ['village', 250, 750] },
        pts: { jar: ['off', 'other', 18, 28], hive: ['off', 'other', 14, 24], blooms: ['ring', 'hive', 6, 14, 2] },
        steps: [
          { id: 'go', k: 'go', at: 'other', r: 35 },
          { id: 'ask', k: 'talk', at: 'other', r: 70, say: true },
          '@twist',
          { id: 'back', k: 'go', at: 'home', r: 16 },
        ],
      }],
      twists: {
        grandma: [{ id: 'jar', k: 'marks', at: 'jar', r: 3, say: true }],
        garden: [{ id: 'bloom', k: 'any', say: true, of: [{ k: 'place', at: 'hive', r: 12, n: 2, cat: 'flower', roles: ['builder'] }, { k: 'marks', at: 'blooms', r: 3, roles: ['adventurer', 'explorer'] }] }],
        story: [],
      },
    },
    home: {
      w: 1, news: { home: 3, fairy: 1.5, tale: 0.5 }, hours: [0, 11000], fr: 4, items: ['flower_pot', 'lantern'], verse: true, keep: { k: 'flausel', at: 'plot' },
      names: { fam: ['moosbart', 'tauglanz', 'kieselklee', 'wurzelwisch'], style: ['moss', 'stone', 'round'] },
      styles: { moss: ['wood', 'leaf', 'light'], stone: ['stone', 'flower', 'door'], round: ['wood', 'door', 'light'] },
      ways: [{
        id: 'plot', pick: { plot: ['plot', 0, 700] },
        pts: { edge: ['off', 'home', 60, 90], root: ['off', 'plot', 70, 110], cozy: ['ring', 'root', 8, 22, 3], petal: ['ring', 'plot', 8, 16, 1] },
        steps: [
          { id: 'meet', k: 'go', at: 'edge', r: 6, say: true, with: 'flausel' },
          { id: 'plot', k: 'go', at: 'plot', r: 8 },
          { id: 'make', k: 'any', of: [{ k: 'build', at: 'plot', r: 6, n: 10, cats: '@style', roles: ['builder'] }, { k: 'marks', at: 'cozy', r: 3, roles: ['adventurer', 'explorer'] }] },
          '@twist',
          { id: 'greet', k: 'go', at: 'plot', r: 5, say: true },
        ],
      }],
      twists: {
        granny: [{ id: 'granny', k: 'any', of: [{ k: 'place', at: 'plot', r: 7, n: 1, cat: 'flower', roles: ['builder'] }, { k: 'marks', at: 'petal', r: 3, roles: ['adventurer', 'explorer'] }] }],
        seed: [],
        song: [],
      },
    },
    letter: {
      w: 1, news: { tale: 1, helped: 1, gift: 1 }, hours: [0, 8500], due: 'dusk', fr: 4, items: ['paper', 'book'], verse: true,
      ways: [{
        id: 'bridge', pick: { gate: ['gate', 0, 650] },
        steps: [
          { id: 'gate', k: 'go', at: 'gate', r: 14 },
          { id: 'cross', k: 'cross' },
          { id: 'meet', k: 'meet', say: true },
          '@twist',
          { id: 'back', k: 'cross', back: true },
          { id: 'home', k: 'go', at: 'home', r: 16 },
        ],
      }, {
        id: 'hills', pick: { other: ['village', 380, 750] },
        steps: [
          { id: 'far', k: 'go', at: 'other', r: 35 },
          { id: 'ask', k: 'talk', at: 'other', r: 70, say: true },
          '@twist',
          { id: 'home', k: 'go', at: 'home', r: 16 },
        ],
      }],
      twists: { reply: [], gift: [], invite: [] },
    },
    beacon: {
      w: 1, news: { freed: 3, fest: 1, tale: 0.5 }, hours: [0, 11500], fr: 4, items: ['lantern', 'glowstone'], verse: true, keep: { k: 'beacon', at: 'hill' },
      names: { hill: ['lark', 'glimmer', 'slumber', 'cloudrest'] },
      ways: [{
        id: 'hill', pick: { hill: ['hill', 150, 380] },
        pts: { motes: ['ring', 'hill', 18, 40, 3], lens: ['off', 'hill', 40, 70] },
        steps: [
          { id: 'hill', k: 'go', at: 'hill', r: 12 },
          { id: 'lens', k: 'marks', at: 'lens', r: 3, say: true },
          { id: 'lights', k: 'any', of: [{ k: 'place', at: 'hill', r: 10, n: 3, cat: 'light', roles: ['builder'] }, { k: 'marks', at: 'motes', r: 3, roles: ['adventurer', 'explorer'] }] },
          '@twist',
          { id: 'home', k: 'go', at: 'home', r: 20 },
        ],
      }],
      twists: { song: [{ id: 'hum', k: 'go', at: 'hill', r: 3, say: true }], owl: [{ id: 'owl', k: 'go', at: 'hill', r: 3, say: true }], kids: [] },
    },
  };
  TC.list = () => Object.keys(TC.TPL).sort();

  // ================================================================ the generator
  // ctx: {seed, n, t, dim, giver: {pid, name, sur, vid, vn, x, z, kids: [{pid, name}]}, villages: [{id, name, x, z}],
  //       fairy: [{id, kind, name, x, z}], hills: [{x, z, y}], gate: {x, z} | null, home: {x, z} | null,
  //       news: [{k, pl, score}], role}
  function source(ctx, kind) {
    const G = ctx.giver;
    if (kind === 'fairy') return (ctx.fairy || []).map(f => ({ x: f.x, z: f.z, name: f.name || '', id: 'f:' + f.id, kind: f.kind }));
    if (kind === 'village') return (ctx.villages || []).filter(v => String(v.id) !== String(G.vid)).map(v => ({ x: v.x, z: v.z, name: v.name || '', id: 'v:' + v.id }));
    if (kind === 'hill') return (ctx.hills || []).map((p, i) => ({ x: p.x, z: p.z, y: p.y, id: 'h:' + i }));
    if (kind === 'gate') return ctx.gate ? [{ x: ctx.gate.x, z: ctx.gate.z, name: ctx.gate.name || '', id: 'gate' }] : [];
    return [];
  }
  // a way's places, or null when the world lacks one
  TC.resolve = function (ctx, tn, way, hs) {
    const G = ctx.giver, home = { x: G.x, z: G.z }, P = { home: Object.assign({ id: 'home', name: G.vn || '' }, home) };
    for (const nm of Object.keys(way.pick || {})) {
      const [src, mn, mx, kinds] = way.pick[nm];
      if (src === 'plot') {
        const b = ctx.home && dist(ctx.home, home) <= mx ? ctx.home : home, near = b === ctx.home, a = u(hs, 'plot') * Math.PI * 2, r = near ? 6 + 4 * u(hs, 'plr') : 28 + 10 * u(hs, 'plr');
        P[nm] = { x: Math.round(b.x + Math.cos(a) * r), z: Math.round(b.z + Math.sin(a) * r), id: near ? 'plot:home' : 'plot:vil', mine: near };
        continue;
      }
      const L = source(ctx, src).filter(p => { const d = dist(p, home); return d >= mn && d <= mx && (!kinds || kinds.indexOf(p.kind) >= 0); }).sort((a, b) => (a.id < b.id ? -1 : 1));
      if (!L.length) return null;
      P[nm] = L[TC.h(hs, nm) % L.length];
    }
    for (const nm of Object.keys(way.pts || {})) {
      const d = way.pts[nm], b = P[d[1]]; if (!b) return null;
      if (d[0] === 'off') { const a = u(hs, nm) * Math.PI * 2, r = d[2] + (d[3] - d[2]) * u(hs, nm, 'r'); P[nm] = { x: Math.round(b.x + Math.cos(a) * r), z: Math.round(b.z + Math.sin(a) * r) }; }
      else if (d[0] === 'trail') {
        const e = P[d[2]]; if (!e) return null; const L = [];
        const dx = e.x - b.x, dz = e.z - b.z, len = Math.hypot(dx, dz) || 1;
        for (let i = 0; i < d[3]; i++) { const f = (i + 1) / (d[3] + 1), w = (u(hs, nm, i) - 0.5) * 6; L.push({ x: Math.round(b.x + dx * f - dz / len * w), z: Math.round(b.z + dz * f + dx / len * w) }); }
        P[nm] = L;
      } else if (d[0] === 'ring') {
        const L = [], a0 = u(hs, nm) * Math.PI * 2;
        for (let i = 0; i < d[4]; i++) { const a = a0 + i * Math.PI * 2 / d[4] + (u(hs, nm, i) - 0.5) * 0.8, r = d[2] + (d[3] - d[2]) * u(hs, nm, 'r', i); L.push({ x: Math.round(b.x + Math.cos(a) * r), z: Math.round(b.z + Math.sin(a) * r) }); }
        P[nm] = L;
      }
    }
    return P;
  };
  // the eligible (template, way) pairs
  TC.options = function (ctx) {
    const out = [];
    for (const tn of TC.list()) {
      const T0 = TC.TPL[tn];
      if (T0.need && T0.need.kid && !(ctx.giver.kids && ctx.giver.kids.length)) continue;
      if (T0.hours && fin(ctx.tod) && !(ctx.tod >= T0.hours[0] && ctx.tod < T0.hours[1])) continue;   // (the lost child at dusk, the festival's errands by day)
      for (const way of T0.ways) { const P = TC.resolve(ctx, tn, way, TC.h(ctx.seed, ctx.n, ctx.giver.pid, tn)); if (P) { out.push({ t: tn, way, P }); break; } }
    }
    return out;
  };
  const combo = (t, v) => t + ':' + v;
  TC.weight = function (tn, news) {
    const T0 = TC.TPL[tn]; let w = T0.w || 1;
    for (const d of news || []) if (T0.news && T0.news[d.k]) w += T0.news[d.k] * Math.min(1, (d.score || 0) / 5);
    return w;
  };
  TC.make = function (ctx, rec) {
    const hist = (rec && rec.hist) || [], last = hist.length ? hist[hist.length - 1].t : null, recent = new Set(hist.slice(-TC.NOREP).map(x => combo(x.t, x.v)));
    let opts = TC.options(ctx);
    if (!opts.length) return null;
    const twistsOf = (o) => Object.keys(TC.TPL[o.t].twists).sort().filter(v => !recent.has(combo(o.t, v)));
    let L = opts.filter(o => o.t !== last && twistsOf(o).length);
    if (!L.length) L = opts.filter(o => twistsOf(o).length);
    if (!L.length) L = opts;
    const hs = TC.h(ctx.seed, ctx.n, ctx.giver.pid);
    let sum = 0; const W = L.map(o => (sum += TC.weight(o.t, ctx.news)));
    const r = u(hs, 'pick') * sum; let o = L[L.length - 1];
    for (let i = 0; i < L.length; i++) if (r < W[i]) { o = L[i]; break; }
    const T0 = TC.TPL[o.t];
    let tw = twistsOf(o); if (!tw.length) tw = Object.keys(T0.twists).sort();
    const v = tw[TC.h(hs, 'twist') % tw.length];
    const nm = { giver: ctx.giver.name || '', vn: ctx.giver.vn || '' };
    for (const k of Object.keys(T0.names || {})) nm[k] = { k: k, id: T0.names[k][TC.h(hs, 'nm', k) % T0.names[k].length] };
    for (const k of Object.keys(o.P)) if (!Array.isArray(o.P[k]) && o.P[k].name) nm[k] = o.P[k].name;
    let kid = null;
    if (T0.need && T0.need.kid) { const K = ctx.giver.kids.slice().sort((a, b) => (String(a.pid) < String(b.pid) ? -1 : 1)); kid = K[TC.h(hs, 'kid') % K.length]; nm.kid = kid.name; }
    if (o.t === 'letter') nm.to = ctx.toName || '';
    const steps = [];
    let twAt = -1;
    const mk = (s) => {
      const q = { id: s.id || '', k: s.k, done: false };
      for (const f of ['r', 'n', 'cat', 'with', 'say', 'back']) if (s[f] !== undefined) q[f] = s[f];
      if (s.cats) q.cats = s.cats === '@style' ? (T0.styles[nm.style.id] || []).slice() : s.cats.slice();
      if (s.roles) q.roles = s.roles.slice();
      if (s.at) { const p = o.P[s.at]; q.at = s.at; if (Array.isArray(p)) q.pts = p.map(x => [x.x, x.z]); else if (s.k === 'marks') q.pts = [[p.x, p.z]]; else q.p = [p.x, p.z]; }
      if (s.k === 'marks') q.m = 0;
      if (s.k === 'place' || s.k === 'build') { q.c = 0; q.cm = 0; }
      if (s.k === 'any') q.of = s.of.map(mk);
      return q;
    };
    for (const s of o.way.steps) {
      if (s === '@twist') { twAt = steps.length; for (const x of T0.twists[v]) { const q = mk(x); q.tw = true; steps.push(q); } continue; }
      steps.push(mk(s));
    }
    const due = T0.due === 'dusk' ? dueAt(ctx.t || 0) : null;
    return {
      id: 'tl' + (ctx.n | 0) + '-' + (hs % 9973), t: o.t, way: o.way.id, v, seed: hs, giver: { pid: ctx.giver.pid, name: ctx.giver.name || '', sur: ctx.giver.sur || '', vid: ctx.giver.vid, vn: ctx.giver.vn || '', x: ctx.giver.x, z: ctx.giver.z },
      kid: kid ? { pid: kid.pid, name: kid.name } : null, nm, steps, i: 0, twAt, st: 'offer', dim0: ctx.dim || 'overworld', t0: ctx.t || 0, due, role: ctx.role || 'explorer',
      news: (ctx.news && ctx.news[0] && ctx.news[0].score >= 1) ? { k: ctx.news[0].k, pl: String(ctx.news[0].pl || '').slice(0, 60) } : null,
    };
  };
  // the next dusk (the festival): today's if still ahead (at least 2 game hours away), else tomorrow's
  function dueAt(t) { const day = Math.floor(t / TC.DAY), tod = t - day * TC.DAY; return (tod <= TC.DUSK - 2000 ? day : day + 1) * TC.DAY + TC.DUSK; }
  TC.dueAt = dueAt;

  // ================================================================ play
  const near = (p, x, z, r) => !!p && Math.hypot(p[0] - x, p[1] - z) <= r;
  // one step against one event: true when it finished; 'prog' when it moved on
  function stepFeed(tale, s, ev) {
    if (s.done) return false;
    const away = (d) => d !== undefined && d !== tale.dim0;
    if (s.k === 'go') { if (ev.k === 'pos' && !away(ev.dim) && near(s.p, ev.x, ev.z, s.r)) return true; return false; }
    if (s.k === 'marks') {
      if (ev.k !== 'pos' || away(ev.dim)) return false;
      const p = s.pts[s.m]; if (p && near(p, ev.x, ev.z, s.r)) { s.m++; return s.m >= s.pts.length ? true : 'prog'; }
      return false;
    }
    if (s.k === 'place' || s.k === 'build') {
      if (ev.k !== 'placed' || away(ev.dim) || !near(s.p, ev.x, ev.z, s.r)) return false;
      const cats = ev.cats || [];
      if (s.k === 'place') { if (cats.indexOf(s.cat) < 0) return false; s.c++; return s.c >= s.n ? true : 'prog'; }
      s.c++; for (const c of cats) { const i = (s.cats || []).indexOf(c); if (i >= 0) s.cm |= 1 << i; }
      return s.c >= s.n && s.cm === (1 << s.cats.length) - 1 ? true : 'prog';
    }
    if (s.k === 'talk') { if (ev.k === 'meet' && !away(ev.dim) && near(s.p, ev.x, ev.z, s.r)) return true; return false; }
    if (s.k === 'meet') { if (ev.k === 'meet' && away(ev.dim)) return true; return false; }
    if (s.k === 'cross') { if ((ev.k === 'dim' || ev.k === 'pos') && ev.dim !== undefined && (s.back ? ev.dim === tale.dim0 : ev.dim !== tale.dim0)) return true; return false; }
    if (s.k === 'any') {
      let prog = false;
      for (const b of s.of) { const r = stepFeed(tale, b, ev); if (r === true) { b.done = true; s.by = s.of.indexOf(b); return true; } if (r) prog = true; }
      return prog ? 'prog' : false;
    }
    return false;
  }
  TC.feed = function (tale, ev) {
    const out = [];
    if (!tale || tale.st !== 'on' || !ev) return out;
    for (let guard = 0; guard < 4 && tale.i < tale.steps.length; guard++) {
      const s = tale.steps[tale.i], r = stepFeed(tale, s, ev);
      if (!r) break;
      if (r === 'prog') { out.push({ k: 'prog', id: s.id }); break; }
      s.done = true; tale.i++;
      out.push({ k: 'step', id: s.id, say: !!s.say, with: s.with || null });
      if (tale.i === tale.twAt && !tale.twSaid) { tale.twSaid = true; out.push({ k: 'twist', v: tale.v }); }
      if (tale.i >= tale.steps.length) { tale.st = 'done'; out.push({ k: 'done' }); break; }
      // (the same event may finish the next step too: you stand at the place already)
    }
    return out;
  };
  TC.cur = (tale) => (tale && tale.i < tale.steps.length ? tale.steps[tale.i] : null);
  // the point to walk to now (the current mark, the place, null for a crossing or a meeting)
  TC.target = function (tale) {
    const s = TC.cur(tale); if (!s) return null;
    const pt = (q) => (q.k === 'marks' ? q.pts[q.m] || null : q.p || null);
    if (s.k === 'any') { const R = tale.role === 'builder' ? 'builder' : 'explorer'; const b = s.of.find(q => q.roles && q.roles.indexOf(R) >= 0) || s.of[0]; return pt(b) || pt(s.of[0]); }
    return pt(s);
  };
  // the line's key and its counters
  TC.hint = function (tale) {
    const s = TC.cur(tale); if (!s) return null;
    let n = 0, m = 0;
    const cnt = (q) => { if (q.k === 'marks') { n = Math.max(n, q.m); m = m || q.pts.length; } if (q.k === 'place' || q.k === 'build') { n = Math.max(n, q.c); m = m || q.n; } };
    if (s.k === 'any') { const R = tale.role === 'builder' ? 'builder' : 'explorer'; const b = s.of.find(q => q.roles && q.roles.indexOf(R) >= 0) || s.of[0]; cnt(b); } else cnt(s);
    return { key: 'g.tl.' + tale.t + '.s.' + s.id, n, m };
  };
  // the texts' variables (names as keys are resolved by the caller's T)
  TC.vars = function (tale, T) {
    const o = {};
    for (const k of Object.keys(tale.nm || {})) { const v = tale.nm[k]; o[k] = v && typeof v === 'object' ? (T ? T('g.tl.' + v.k + '.' + v.id) : v.id) : String(v == null ? '' : v); }
    return o;
  };

  // ================================================================ the record
  TC.fresh = () => ({ v: TC.V, n: 0, cur: null, hist: [], pages: [], lit: [], cool: 0 });
  function okStep(s) {
    if (!isObj(s) || typeof s.k !== 'string') return false;
    if (s.p && !(Array.isArray(s.p) && s.p.length === 2 && fin(s.p[0]) && fin(s.p[1]))) return false;
    if (s.k === 'marks' && !(Array.isArray(s.pts) && s.pts.length && s.pts.every(p => Array.isArray(p) && fin(p[0]) && fin(p[1])) && fin(s.m))) return false;
    if ((s.k === 'go' || s.k === 'place' || s.k === 'build' || s.k === 'talk') && !s.p) return false;
    if (s.k === 'any' && !(Array.isArray(s.of) && s.of.length && s.of.every(okStep))) return false;
    return ['go', 'marks', 'place', 'build', 'talk', 'meet', 'cross', 'any'].indexOf(s.k) >= 0;
  }
  TC.okTale = function (c) {
    return isObj(c) && !!TC.TPL[c.t] && Array.isArray(c.steps) && c.steps.length > 0 && c.steps.every(okStep) && fin(c.i) && c.i >= 0 && c.i <= c.steps.length && isObj(c.giver) && isObj(c.nm) && (c.st === 'on' || c.st === 'offer' || c.st === 'done');
  };
  TC.load = function (o) {
    if (isObj(o) && (o.v | 0) > TC.V) return o;   // a newer save's record stays untouched
    const r = TC.fresh(); if (!isObj(o)) return r;
    r.n = fin(o.n) ? o.n | 0 : 0; r.cool = fin(o.cool) ? +o.cool : 0;
    if (TC.okTale(o.cur)) r.cur = o.cur;
    if (Array.isArray(o.hist)) r.hist = o.hist.filter(x => isObj(x) && TC.TPL[x.t]).map(x => ({ t: x.t, v: String(x.v || ''), d: fin(x.d) ? x.d | 0 : 0 })).slice(-TC.HIST);
    if (Array.isArray(o.pages)) r.pages = o.pages.filter(x => isObj(x) && TC.TPL[x.t]).slice(-TC.PAGES);
    if (Array.isArray(o.lit)) r.lit = o.lit.filter(x => isObj(x) && fin(x.x) && fin(x.z)).slice(-12);
    return r;
  };
  TC.save = (rec) => JSON.parse(JSON.stringify(rec));
  TC.canOffer = (rec, t) => !!rec && !rec.cur && (t || 0) >= (rec.cool || 0);
  TC.accept = function (rec, tale, t, role) { tale.st = 'on'; tale.t0 = t || tale.t0; if (role) tale.role = role; rec.cur = tale; rec.n = (rec.n | 0) + 1; return tale; };
  TC.decline = function (rec, t) { rec.n = (rec.n | 0) + 1; rec.cool = (t || 0) + TC.DAY * 0.75; };
  TC.abandon = function (rec, t) { if (!rec.cur) return; rec.hist.push({ t: rec.cur.t, v: rec.cur.v, d: Math.floor((t || 0) / TC.DAY) }); rec.cur = null; rec.cool = (t || 0) + TC.DAY * 0.5; };
  // the end: the page, the friendship, the item, the lit beacon; the history for no-repeat
  TC.finish = function (rec, t) {
    const c = rec.cur; if (!c || c.st !== 'done') return null;
    const T0 = TC.TPL[c.t], late = c.due !== null && c.due !== undefined && t > c.due, day = Math.floor((t || 0) / TC.DAY);
    const page = { id: c.id, t: c.t, v: c.v, d: day, giver: c.giver.name, vn: c.giver.vn, nm: c.nm, late };
    rec.pages.push(page); if (rec.pages.length > TC.PAGES) rec.pages.shift();
    rec.hist.push({ t: c.t, v: c.v, d: day }); if (rec.hist.length > TC.HIST) rec.hist.shift();
    let lit = null;
    if (T0.keep) { const s = c.steps.find(q => q.at === T0.keep.at && q.p); if (s) { lit = { k: T0.keep.k, x: s.p[0], z: s.p[1], dim: c.dim0, d: day, v: c.v }; rec.lit.push(lit); if (rec.lit.length > 12) rec.lit.shift(); } }
    rec.cur = null; rec.cool = (t || 0) + TC.DAY * 0.25;
    return { page, fr: T0.fr || 3, items: (T0.items || []).slice(), late, lit, key: 'g.tl.' + c.t + '.end.' + c.v + (late ? '.late' : ''), head: 'g.tl.' + c.t + '.head', verse: T0.verse ? 'g.tl.' + c.t + '.verse' : null, giver: c.giver, kid: c.kid };
  };

  // an estimate of the play time (seconds) for a role: the walk between the targets plus a little per action
  TC.estimate = function (tale, role) {
    let pos = [tale.giver.x, tale.giver.z], s = 0;
    const walk = (p) => { if (!p) return; s += Math.hypot(p[0] - pos[0], p[1] - pos[1]) / TC.SPEED; pos = p; };
    const one = (q) => {
      if (q.k === 'go') { walk(q.p); s += 5; }
      else if (q.k === 'marks') { for (let i = q.m; i < q.pts.length; i++) { walk(q.pts[i]); s += 10; } }
      else if (q.k === 'place') { walk(q.p); s += 15 * q.n; }
      else if (q.k === 'build') { walk(q.p); s += 130; }
      else if (q.k === 'talk') { walk(q.p); s += 20; }
      else if (q.k === 'meet') s += 50;
      else if (q.k === 'cross') s += 45;
      else if (q.k === 'any') { const b = q.of.find(x => x.roles && x.roles.indexOf(role) >= 0) || q.of[0]; one(b); }
    };
    for (let i = tale.i; i < tale.steps.length; i++) one(tale.steps[i]);
    return s + 40;   // (the offer, the twist's moment, the ending: three short talks)
  };

  // every text key a template can show (test/tales.js checks both tables)
  TC.keys = function () {
    const K = ['g.tl.hook.0', 'g.tl.hook.1', 'g.tl.hook.2', 'g.tl.btn.offer', 'g.tl.btn.yes', 'g.tl.btn.no', 'g.tl.yes', 'g.tl.no', 'g.tl.doneT', 'g.tl.done', 'g.tl.book', 'g.tl.none', 'g.tl.set', 'g.tl.set.tip', 'g.tl.prog', 'g.tl.late', 'g.tl.pageof', 'g.tl.dist', 'g.tl.away', 'g.tl.twT', 'g.tl.item', 'g.tl.drop'];
    for (const k of ['freed', 'fairy', 'home', 'helped', 'fest', 'gift', 'tale']) K.push('g.tl.news.' + k);
    for (const tn of TC.list()) {
      const T0 = TC.TPL[tn], P = 'g.tl.' + tn + '.';
      K.push(P + 'title', P + 'head', P + 'verse'); if (T0.ways.length === 1) K.push(P + 'ask');
      if (T0.due) K.push(P + 'due');
      const ids = new Set(), says = new Set();
      const walk = (s) => { if (s === '@twist') return; if (s.id) ids.add(s.id); if (s.say && s.id) says.add(s.id); };
      for (const w of T0.ways) w.steps.forEach(walk);
      for (const v of Object.keys(T0.twists)) { T0.twists[v].forEach(walk); K.push(P + 'tw.' + v, P + 'end.' + v); if (T0.due) K.push(P + 'end.' + v + '.late'); }
      for (const id of ids) K.push(P + 's.' + id);
      for (const id of says) K.push(P + 'say.' + id);
      for (const k of Object.keys(T0.names || {})) for (const id of T0.names[k]) K.push('g.tl.' + k + '.' + id);
      if (T0.ways.length > 1) for (const w of T0.ways) K.push(P + 'ask.' + w.id);
    }
    return [...new Set(K)];
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
